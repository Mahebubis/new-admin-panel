/*
 * src/pages/freshdesk/useFreshdeskData.js
 *
 * Owns the desk's working set: the tickets array every page renders from, the
 * sidebar counts, the agent list, and every write action.
 *
 * WHY THE WHOLE SET IS HELD IN MEMORY
 * The existing UI filters, searches, sorts and paginates the tickets array
 * client-side, and that is what makes switching between the eight sidebar views
 * instant. So one request pulls the working set (up to 500 most-recent, INCLUDING
 * spam and trash so those views are not empty), and the UI keeps doing what it
 * already did. `total` comes back too, so the caller can tell when the desk has
 * outgrown that and needs server-side paging.
 *
 * WRITES ARE OPTIMISTIC, WITH REAL ROLLBACK
 * Every mutation updates local state immediately, then calls the API. On
 * failure the previous rows are put back and the error is surfaced. The
 * alternative -- waiting for the round-trip before the row changes -- makes a
 * bulk action on 40 tickets feel broken; the alternative to rolling back is a
 * UI that quietly disagrees with the database.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { tickets as ticketsApi, messages as messagesApi, stats as statsApi } from './fdApi';

const WORKING_SET = 500;

export default function useFreshdeskData({ onToast } = {}) {
  const [tickets, setTicketsState] = useState([]);
  const [counts, setCounts] = useState({});
  const [agents, setAgents] = useState([]);
  const [meta, setMeta] = useState({ categories: [], departments: [], tags: [], statuses: [], priorities: [], sources: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [loadedAt, setLoadedAt] = useState(null);

  const toast = useRef(onToast);
  useEffect(() => { toast.current = onToast; }, [onToast]);

  const notify = useCallback((t) => { try { toast.current?.(t); } catch { /* toast host not mounted */ } }, []);

  /*
   * Mirror state into a ref.
   *
   * The optimistic-update helpers need the CURRENT rows to build a rollback
   * snapshot, but reading `tickets` inside a useCallback would capture the
   * array from the render the callback was created in -- so a rollback after
   * two quick edits would restore state from before both of them.
   */
  const ticketsRef = useRef(tickets);
  useEffect(() => { ticketsRef.current = tickets; }, [tickets]);

  const setTickets = useCallback((updater) => {
    setTicketsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      ticketsRef.current = next;
      return next;
    });
  }, []);

  /* ------------------------------------------------------------- loading -- */

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await ticketsApi.list({ view: 'everything', page: 1, perPage: WORKING_SET, sort: 'Created Date', scope: 'workingset' });
      setTickets(res.tickets || []);
      setCounts(res.counts || {});
      setTotal(res.total || 0);
      setError(null);
      setLoadedAt(Date.now());
      return res;
    } catch (err) {
      if (err.canceled) return null;
      setError(err.message);
      // A silent background refresh that fails must not throw a toast at
      // someone who is mid-reply; the connection banner already shows it.
      if (!silent) notify({ type: 'error', title: 'Could not load tickets', desc: err.message });
      throw err;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [setTickets, notify]);

  const refreshCounts = useCallback(async () => {
    try {
      const res = await ticketsApi.counts();
      setCounts(res.counts || {});
    } catch { /* counts are cosmetic; the list is the source of truth */ }
  }, []);

  /*
   * ONE request on mount. Opening the page is an explicit action, and without
   * this there is nothing to show.
   *
   * The agent roster and the category/tag lists used to be fetched here too --
   * three requests before the agent had done anything, for data only the assign
   * dialog and the filter drawer ever read. They are lazy now (ensureAgents /
   * ensureMeta below), fetched at most once, the first time something opens
   * that needs them.
   */
  useEffect(() => { load().catch(() => {}); }, [load]);

  const agentsLoaded = useRef(false);
  const metaLoaded = useRef(false);

  /** Fetch the assignable agents once, on first use. Safe to call repeatedly. */
  const ensureAgents = useCallback(async () => {
    if (agentsLoaded.current) return;
    agentsLoaded.current = true;
    try {
      const r = await ticketsApi.agents();
      setAgents(r.agents || []);
    } catch {
      // Let a failed fetch be retried next time something needs the list.
      agentsLoaded.current = false;
    }
  }, []);

  /** Same, for the categories / departments / tags in use. */
  const ensureMeta = useCallback(async () => {
    if (metaLoaded.current) return;
    metaLoaded.current = true;
    try {
      const r = await ticketsApi.meta();
      setMeta((m) => ({ ...m, ...r }));
    } catch {
      metaLoaded.current = false;
    }
  }, []);

  /* ------------------------------------------------- optimistic plumbing -- */

  /**
   * Apply a local patch, run the API call, roll back if it fails.
   * @param ids     ticket ids to patch
   * @param patch   object or (ticket)=>object
   * @param apiCall async () => any
   */
  const optimistic = useCallback(async (ids, patch, apiCall, { successToast, errorTitle } = {}) => {
    const idSet = new Set(ids);
    const snapshot = ticketsRef.current;

    setTickets((ts) => ts.map((t) => (idSet.has(t.id)
      ? { ...t, ...(typeof patch === 'function' ? patch(t) : patch) }
      : t)));

    try {
      const res = await apiCall();
      if (res && res.counts) setCounts(res.counts);
      if (successToast) notify({ type: 'success', ...successToast });
      return res;
    } catch (err) {
      setTickets(snapshot);
      notify({ type: 'error', title: errorTitle || 'Update failed', desc: err.message });
      throw err;
    }
  }, [setTickets, notify]);

  /* --------------------------------------------------------------- edits -- */

  const updateTicket = useCallback((id, fields) => optimistic(
    [id],
    () => {
      // Keep the derived flags the sidebar filters on in step with the status
      // change, or the row stays in "Unresolved" until the next full reload.
      const p = { ...fields };
      if (fields.status) p.unresolved = !['Resolved', 'Closed'].includes(fields.status);
      return p;
    },
    () => ticketsApi.update(id, fields),
    { successToast: { title: `#${id} updated` }, errorTitle: `Could not update #${id}` }
  ), [optimistic]);

  const bulkUpdate = useCallback((ids, fields) => optimistic(
    ids,
    () => {
      const p = { ...fields };
      if (fields.status) p.unresolved = !['Resolved', 'Closed'].includes(fields.status);
      return p;
    },
    () => ticketsApi.bulk(ids, fields),
    { successToast: { title: `${ids.length} ticket${ids.length === 1 ? '' : 's'} updated` }, errorTitle: 'Bulk update failed' }
  ), [optimistic]);

  const setSpam = useCallback((ids, value = true, blockSender = false) => optimistic(
    ids, { spam: value, trash: false },
    () => ticketsApi.spam(ids, value, blockSender),
    { successToast: { title: value ? `${ids.length} moved to Spam` : `${ids.length} restored` }, errorTitle: 'Could not update Spam' }
  ), [optimistic]);

  const setTrash = useCallback((ids, value = true) => optimistic(
    ids, { trash: value, spam: false },
    () => ticketsApi.trash(ids, value),
    { successToast: { title: value ? `${ids.length} moved to Trash` : `${ids.length} restored` }, errorTitle: 'Could not update Trash' }
  ), [optimistic]);

  /** Permanent delete. Removes rows locally and restores them all if it fails. */
  const removeTickets = useCallback(async (ids) => {
    const snapshot = ticketsRef.current;
    const idSet = new Set(ids);
    setTickets((ts) => ts.filter((t) => !idSet.has(t.id)));
    try {
      const res = await ticketsApi.remove(ids);
      if (res.counts) setCounts(res.counts);
      notify({ type: 'success', title: `${res.deleted ?? ids.length} ticket(s) deleted permanently` });
      return res;
    } catch (err) {
      setTickets(snapshot);
      notify({ type: 'error', title: 'Delete failed', desc: err.message });
      throw err;
    }
  }, [setTickets, notify]);

  const mergeTickets = useCallback(async (primaryId, ids) => {
    try {
      const res = await ticketsApi.merge(primaryId, ids);
      // Merging rewrites message ownership on the server; a targeted local
      // patch could not reproduce that faithfully, so reload instead.
      await load({ silent: true });
      notify({ type: 'success', title: res.message || 'Tickets merged' });
      return res;
    } catch (err) {
      notify({ type: 'error', title: 'Merge failed', desc: err.message });
      throw err;
    }
  }, [load, notify]);

  const createTicket = useCallback(async (payload) => {
    try {
      const res = await ticketsApi.create(payload);
      if (res.ticket) setTickets((ts) => [res.ticket, ...ts]);
      notify({ type: 'success', title: `Ticket #${res.id} created` });
      return res;
    } catch (err) {
      notify({ type: 'error', title: 'Could not create the ticket', desc: err.message });
      throw err;
    }
  }, [setTickets, notify]);

  const markRead = useCallback(async (ids) => {
    const list = Array.isArray(ids) ? ids : [ids];
    const idSet = new Set(list);
    setTickets((ts) => ts.map((t) => (idSet.has(t.id) ? { ...t, newReplies: 0, custReplied: false } : t)));
    try {
      const res = await ticketsApi.markRead(list);
      if (res.counts) setCounts(res.counts);
    } catch { /* purely cosmetic; the next load corrects it */ }
  }, [setTickets]);

  /* ------------------------------------------------------------ sending -- */

  /**
   * Send a reply / forward / note.
   *
   * A send that the mail server REJECTED comes back as ok:true, sent:false --
   * that is a real outcome, not a transport failure: the message row exists and
   * is visible in the thread marked "not delivered". Treating it as a thrown
   * error would make the composer discard text that is actually recoverable.
   */
  const sendMessage = useCallback(async ({ ticketId, type = 'reply', body, to, cc, bcc, subject, attachmentIds, includeAttachments }) => {
    try {
      let res;
      if (type === 'note') {
        res = await messagesApi.note({ ticketId, body });
      } else if (type === 'forward') {
        res = await messagesApi.forward({ ticketId, body, to, cc, bcc, attachmentIds, includeAttachments, isHtml: true });
      } else {
        res = await messagesApi.reply({ ticketId, body, to, cc, bcc, subject, attachmentIds });
      }

      if (res.sent === false) {
        notify({ type: 'error', title: 'Not delivered', desc: res.error || res.message });
      } else {
        notify({
          type: 'success',
          title: type === 'note' ? 'Note added' : type === 'forward' ? 'Forwarded' : 'Reply sent',
          desc: type === 'note' ? 'Visible to agents only.' : `Delivered from contact@internshipstudio.com.`,
        });
        // A sent reply moves the ticket on server-side; mirror it so the row
        // does not keep showing "Customer replied" with an unread badge.
        if (type !== 'note') {
          setTickets((ts) => ts.map((t) => (t.id === ticketId
            ? { ...t, responseStatus: 'Agent responded', custReplied: false, newReplies: 0,
                status: t.status === 'New' ? 'Pending' : t.status, lastActivity: 'just now' }
            : t)));
        }
      }
      return res;
    } catch (err) {
      notify({ type: 'error', title: 'Send failed', desc: err.message });
      throw err;
    }
  }, [setTickets, notify]);

  /* ---------------------------------------------------------- realtime -- */

  /**
   * Fold a realtime event into local state.
   *
   * New mail is fetched individually rather than triggering a full reload: a
   * busy desk would otherwise re-pull 500 rows per arriving email, and doing so
   * while an agent is typing would also blow away their scroll position.
   */
  const applyRealtimeEvent = useCallback(async (evt) => {
    if (!evt) return;
    const tid = evt.ticket_id || evt.data?.ticket_id;

    if (evt.event === 'new-ticket' || evt.event === 'new-message') {
      if (!tid) return;
      try {
        const res = await ticketsApi.get(tid);
        if (!res.ticket) return;
        setTickets((ts) => {
          const i = ts.findIndex((t) => t.id === res.ticket.id);
          if (i === -1) return [res.ticket, ...ts];
          const copy = ts.slice();
          copy[i] = { ...copy[i], ...res.ticket };
          return copy;
        });
      } catch { /* the next poll or manual refresh will pick it up */ }
      refreshCounts();
      return;
    }

    // Bulk/structural changes from ANOTHER agent's session: a targeted patch
    // cannot be reconstructed from the event, so resync quietly.
    if (['tickets-bulk-updated', 'tickets-merged', 'tickets-deleted', 'tickets-spam', 'tickets-trash'].includes(evt.event)) {
      load({ silent: true }).catch(() => {});
      return;
    }

    if (evt.event === 'ticket-updated' && tid) {
      try {
        const res = await ticketsApi.get(tid);
        if (res.ticket) {
          setTickets((ts) => ts.map((t) => (t.id === res.ticket.id ? { ...t, ...res.ticket } : t)));
        }
      } catch { /* ignore */ }
      refreshCounts();
    }
  }, [setTickets, load, refreshCounts]);

  return {
    tickets, setTickets, counts, setCounts, agents, meta,
    loading, error, total, loadedAt,
    load, refreshCounts,
    updateTicket, bulkUpdate, setSpam, setTrash, removeTickets, mergeTickets,
    createTicket, markRead, sendMessage,
    ensureAgents, ensureMeta,
    applyRealtimeEvent,
    /** True when the desk has more tickets than the in-memory working set. */
    truncated: total > tickets.length,
    workingSet: WORKING_SET,
  };
}

/**
 * Server-side ticket list.
 *
 * WHY THIS EXISTS
 * The desk keeps a 500-row working set in memory, which is what makes switching
 * between the sidebar views instant. But once the mailbox held 1,812 tickets
 * that cap became a lie: the header said 1,812 and the pager said "of 500",
 * because it was paging the slice rather than the table. Everything past the
 * 500 most recent was simply unreachable.
 *
 * So the LIST asks the server for exactly the page it is showing. The working
 * set stays for everything else (the customer directory, the command palette,
 * the caller screen) where holding recent rows in memory is the right call.
 *
 * The request is debounced and sequence-numbered: typing in the search box
 * fires one per keystroke and the responses do NOT come back in order, so
 * without the sequence check the list settles on the results for a PREFIX of
 * what was typed.
 */
export function useTicketList({ view, page, perPage, search, sort, sortDir, filters }) {
  const [state, setState] = useState({
    rows: [], total: 0, pages: 1, counts: {}, loading: true, error: null,
  });
  const seqRef = useRef(0);

  // Serialised so the effect compares by VALUE -- `filters` is a fresh object
  // every render and would otherwise refetch forever.
  const filterKey = JSON.stringify(filters || {});

  const fetchPage = useCallback(async () => {
    const seq = ++seqRef.current;
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await ticketsApi.list({
        view, page, perPage, search, sort, sortDir,
        filters: JSON.parse(filterKey),
      });
      if (seq !== seqRef.current) return;    // a newer request won
      setState({
        rows: res.tickets || [],
        total: res.total || 0,
        pages: Math.max(1, res.pages || 1),
        counts: res.counts || {},
        loading: false,
        error: null,
      });
    } catch (err) {
      if (err.canceled || seq !== seqRef.current) return;
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [view, page, perPage, search, sort, sortDir, filterKey]);

  useEffect(() => {
    // Typing gets a short debounce; changing a view or a page should feel
    // immediate, so only the search term waits.
    const delay = search ? 260 : 0;
    const t = setTimeout(fetchPage, delay);
    return () => clearTimeout(t);
  }, [fetchPage, search]);

  return { ...state, reload: fetchPage };
}

/** Dashboard stats, kept separate so the stats page can refresh independently. */
export function useFreshdeskStats(days = 7) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await statsApi.dashboard(days));
      setError(null);
    } catch (err) {
      if (!err.canceled) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}
