/*
 * src/pages/freshdesk/fdApi.js
 *
 * The single place the Freshdesk UI talks to the backend.
 *
 * Everything goes through the shared axios instance (src/api/axios.js), so the
 * JWT header, the 401 -> /login redirect and the 5xx toast are all inherited.
 * What this module adds on top:
 *
 *   - one function per backend action, with the parameter names the UI thinks
 *     in ("view", "search") rather than the querystring the PHP expects;
 *   - a uniform unwrap of the {success, message, data} envelope, so callers get
 *     data or an Error and never have to inspect response.data.success;
 *   - request de-duplication + cancellation for the list, because typing in the
 *     search box fires a request per keystroke and the responses do NOT come
 *     back in order -- without this the list regularly settles on the results
 *     for a prefix of what is actually in the box.
 */

import api from '../../api/axios';

const BASE = '/api/freshdesk';

/** Absolute URL for links the browser follows itself (downloads, inline images). */
export function fdUrl(relative) {
  if (!relative) return '';
  if (/^https?:\/\//i.test(relative)) return relative;
  const root = (import.meta.env.VITE_API_URL || 'https://cit3.internshipstudio.com/admin/react-api').replace(/\/+$/, '');
  return `${root}${BASE}/${String(relative).replace(/^\/+/, '')}`;
}

/**
 * Unwrap the API envelope.
 *
 * The backend answers 200 with success:false for outcomes that are real states
 * rather than transport failures -- a reply the SMTP server rejected, for one.
 * Those still carry data the UI needs (the message id, so it can offer Retry),
 * so they are NOT turned into exceptions here; the caller checks the flag.
 * Anything that throws is a genuine failure.
 */
function unwrap(res) {
  const body = res?.data;
  if (!body || typeof body !== 'object') {
    throw new Error('The server sent a response we could not read. It may have printed a PHP error.');
  }
  return { ok: body.success !== false, message: body.message || '', ...(body.data || {}) };
}

function fail(err, fallback) {
  // A cancelled request is not an error the user should ever see.
  if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
    const e = new Error('canceled');
    e.canceled = true;
    throw e;
  }
  const serverMsg = err?.response?.data?.message;
  const e = new Error(serverMsg || err?.message || fallback);
  e.status = err?.response?.status;
  e.original = err;
  throw e;
}

async function get(file, params = {}, config = {}) {
  try {
    // Cache-buster: this API sets no-store, but a stale CDN/proxy in front of
    // it has bitten this codebase before (see config/cors.php).
    return unwrap(await api.get(`${BASE}/${file}`, { params: { ...params, _: Date.now() }, ...config }));
  } catch (err) { return fail(err, 'Request failed'); }
}

async function post(file, body = {}, config = {}) {
  try {
    return unwrap(await api.post(`${BASE}/${file}`, body, config));
  } catch (err) { return fail(err, 'Request failed'); }
}

/* ============================================================== tickets == */

/*
 * One in-flight list request PER CALLER.
 *
 * Each keystroke in the search box starts a request. Responses arrive out of
 * order, so without cancelling the previous one the list can end up showing
 * results for "int" after the user has typed "internship". Aborting the old
 * request makes the last one issued always the last one applied.
 *
 * Keyed by scope, because two independent callers now use this endpoint: the
 * paged ticket list and the in-memory working set the other screens read. With
 * one shared controller whichever fired second killed the first, so opening the
 * desk raced its own startup and the customer directory came up empty.
 */
const listAborts = new Map();

export const tickets = {
  async list({ view = 'all', page = 1, perPage = 25, search = '', sort = 'Created Date', sortDir = 'DESC', filters = {}, scope = 'list' } = {}) {
    const prev = listAborts.get(scope);
    if (prev) prev.abort();
    const ctl = new AbortController();
    listAborts.set(scope, ctl);
    return get('fd_tickets.php', {
      action: 'list', view, page, per_page: perPage, search, sort, sort_dir: sortDir,
      filters: JSON.stringify(filters || {}),
    }, { signal: ctl.signal });
  },

  counts: () => get('fd_tickets.php', { action: 'counts' }),
  /* The team screen: admin_users with their real ticket counts. Heavier than
     agents(), which is the assignee picker and is fetched almost everywhere. */
  team: () => get('fd_tickets.php', { action: 'team' }),
  get: (id) => get('fd_tickets.php', { action: 'get', id }),
  create: (payload) => post('fd_tickets.php', { action: 'create', ...payload }),
  update: (id, fields) => post('fd_tickets.php', { action: 'update', id, ...fields }),
  bulk: (ids, fields) => post('fd_tickets.php', { action: 'bulk', ids, fields }),
  merge: (primaryId, ids) => post('fd_tickets.php', { action: 'merge', primary_id: primaryId, ids }),
  spam: (ids, value = true, blockSender = false) =>
    post('fd_tickets.php', { action: 'spam', ids, value, block_sender: blockSender }),
  trash: (ids, value = true) => post('fd_tickets.php', { action: 'trash', ids, value }),
  remove: (ids) => post('fd_tickets.php', { action: 'delete', ids }),
  markRead: (ids) => post('fd_tickets.php', { action: 'mark_read', ids: Array.isArray(ids) ? ids : [ids] }),

  /**
   * Close every ticket matching a scope, server-side.
   *
   * For clearing an imported backlog — thousands of historical emails that were
   * handled years ago somewhere else. Set-based, so it does not fall over on
   * volumes the 200-id `bulk` endpoint cannot take. Sends no email.
   *
   * Dry run unless `confirm` is true: the first call only reports how many rows
   * WOULD change, plus a sample.
   */
  closeAll: ({ confirm = false, scope = 'unresolved', status = 'Closed', before = '', keepAwaitingReply = false } = {}) =>
    post('fd_tickets.php', {
      action: 'close_all', confirm: confirm ? 1 : 0, scope, status,
      before, keep_awaiting_reply: keepAwaitingReply ? 1 : 0,
    }, { timeout: 180000 }),
  agents: () => get('fd_tickets.php', { action: 'agents' }),
  meta: () => get('fd_tickets.php', { action: 'meta' }),
};

/* ============================================================= messages == */

export const messages = {
  thread: (ticketId) => get('fd_messages.php', { action: 'thread', ticket_id: ticketId }),

  reply: ({ ticketId, body, to, cc, bcc, subject, attachmentIds = [], includeSignature = true, quoteHistory = false, isHtml }) =>
    post('fd_messages.php', {
      action: 'reply', ticket_id: ticketId, body,
      to: to || [], cc: cc || [], bcc: bcc || [], subject: subject || '',
      attachment_ids: attachmentIds,
      include_signature: includeSignature, quote_history: quoteHistory, is_html: isHtml,
    }),

  forward: ({ ticketId, body, to, cc, bcc, attachmentIds = [], includeAttachments = true, isHtml }) =>
    post('fd_messages.php', {
      action: 'forward', ticket_id: ticketId, body,
      to: to || [], cc: cc || [], bcc: bcc || [],
      attachment_ids: attachmentIds, include_attachments: includeAttachments,
      // Without this the server sniffs the body and, on a short reply with no
      // tags, nl2br()s markup that is already HTML.
      is_html: isHtml,
    }),

  note: ({ ticketId, body, isHtml }) =>
    post('fd_messages.php', { action: 'note', ticket_id: ticketId, body, is_html: isHtml }),

  retry: (messageId) => post('fd_messages.php', { action: 'retry', message_id: messageId }),
  deleteNote: (messageId) => post('fd_messages.php', { action: 'delete_note', message_id: messageId }),

  /* Every draft this agent has -- what the "Drafts" chip in the list is built
     from, and what the ticket screen restores on open. */
  drafts: () => get('fd_messages.php', { action: 'drafts' }),
  saveDraft: (ticketId, draft) => post('fd_messages.php', { action: 'save_draft', ticket_id: ticketId, ...draft }),
  getDraft: (ticketId) => get('fd_messages.php', { action: 'get_draft', ticket_id: ticketId }),
  discardDraft: (ticketId) => post('fd_messages.php', { action: 'discard_draft', ticket_id: ticketId }),

  /* Pass all=true to include inactive responses -- the settings screen
     manages those; the reply picker only ever wants the live ones. */
  canned: (all = false) => get('fd_messages.php', { action: 'canned', all: all ? 1 : 0 }),
  cannedFolderSave: (payload) => post('fd_messages.php', { action: 'canned_folder_save', ...payload }),
  cannedFolderDelete: (id) => post('fd_messages.php', { action: 'canned_folder_delete', id }),
  cannedSave: (payload) => post('fd_messages.php', { action: 'canned_save', ...payload }),
  cannedUse: (id) => post('fd_messages.php', { action: 'canned_use', id }),
  cannedDelete: (id) => post('fd_messages.php', { action: 'canned_delete', id }),

  /* ---- automation rules ---- */
  automations: () => get('fd_messages.php', { action: 'automations' }),
  automationSave: (payload) => post('fd_messages.php', { action: 'automation_save', ...payload }),
  automationToggle: (id, isActive) => post('fd_messages.php', { action: 'automation_toggle', id, is_active: isActive }),
  automationDelete: (id) => post('fd_messages.php', { action: 'automation_delete', id }),
  automationModules: (mods) => post('fd_messages.php', { action: 'automation_modules', ...mods }),
  automationLog: (limit = 50) => get('fd_messages.php', { action: 'automation_log', limit }),
  /* The KPI cards, the weekly bars and the rule split, counted server-side. */
  automationStats: (days = 30) => get('fd_messages.php', { action: 'automation_stats', days }),
  /* Dry run -- which rules WOULD match, without executing anything. */
  automationTest: (payload) => get('fd_messages.php', { action: 'automation_test', ...payload }),
};

/* ========================================================== attachments == */

export const attachments = {
  /**
   * Upload one file, staged against a ticket until a reply is sent.
   * onProgress gets 0..100 -- a 15MB attachment on a slow connection with no
   * progress bar looks exactly like a hung page.
   */
  async upload(ticketId, file, onProgress) {
    const form = new FormData();
    form.append('action', 'upload');
    form.append('ticket_id', ticketId);
    form.append('file', file);
    try {
      const res = await api.post(`${BASE}/fd_attachments.php?action=upload&ticket_id=${ticketId}`, form, {
        // Explicitly undefined, not 'multipart/form-data': the browser must set
        // this header itself so it can append the multipart boundary. Setting
        // it by hand produces a body PHP cannot parse and an empty $_FILES.
        headers: { 'Content-Type': undefined },
        timeout: 120000,
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      return unwrap(res);
    } catch (err) { return fail(err, 'Upload failed'); }
  },

  remove: (id) => post('fd_attachments.php', { action: 'delete', id }),
  list: (ticketId) => get('fd_attachments.php', { action: 'list', ticket_id: ticketId }),
  url: (relative) => fdUrl(relative),
};

/* ========================================================= notifications == */

/*
 * One agent's own notifications. Every call is scoped server-side to the
 * signed-in user; there is no parameter for whose inbox to read.
 */
export const notifications = {
  /** @param filter 'all' | 'unread' */
  list: (filter = 'all', limit = 30) =>
    get('fd_notifications.php', { action: 'list', filter, limit }),
  /** Just the badge number. One indexed COUNT, cheap enough to poll. */
  count: () => get('fd_notifications.php', { action: 'count' }),
  read: (ids) => post('fd_notifications.php', { action: 'read', ids }),
  readAll: () => post('fd_notifications.php', { action: 'read', all: 1 }),
  unread: (id) => post('fd_notifications.php', { action: 'unread', id }),
  clear: () => post('fd_notifications.php', { action: 'clear' }),
};

/* ============================================================== realtime == */

export const realtime = {
  config: () => get('fd_realtime.php', { action: 'config' }),
  poll: (since, limit = 100) => get('fd_realtime.php', { action: 'poll', since, limit }),
  status: () => get('fd_realtime.php', { action: 'status' }),
  test: () => post('fd_realtime.php', { action: 'test' }),
  /** Endpoint pusher-js POSTs to for private-channel authorisation. */
  authEndpoint: () => fdUrl('fd_realtime.php?action=auth'),
};

/* ================================================================= sync == */

export const sync = {
  /** Ask the server to check the mailbox now. Slow by nature -- it talks IMAP. */
  now: () => get('fd_sync.php', { action: 'sync' }, { timeout: 90000 }),
};

/* ================================================================ stats == */

export const stats = {
  dashboard: (days = 7) => get('fd_stats.php', { action: 'dashboard', days }),
  analytics: (from, to) => get('fd_stats.php', { action: 'analytics', from, to }),
  agents: (days = 30) => get('fd_stats.php', { action: 'agents', days }),
  feed: (limit = 20) => get('fd_stats.php', { action: 'feed', limit }),
};

/* ============================================================== archive == */

/*
 * The mail archive: how far back the desk's own records go, what sits in a
 * date range, and the whole selection as a sheet.
 *
 * `coverage` and `range` are ordinary JSON calls. `csvUrl` is deliberately NOT
 * one: a CSV of the whole archive should stream straight from PHP to the disk,
 * never through a fetch that first materialises tens of megabytes as a string
 * in the tab. That means the browser makes the request itself and cannot attach
 * an Authorization header — so the JWT rides in the querystring, which
 * middleware/auth.php's get_bearer_token() accepts as its documented fallback
 * (fd_contacts.php's customer export has worked this way since day one).
 */
export const archive = {
  coverage: () => get('fd_export.php', { action: 'coverage' }),

  /** One page of the selected window, plus the counts for the WHOLE window. */
  range: ({ from = '', to = '', direction = 'all', search = '', page = 1, perPage = 50,
            includeSpam = false, includeTrash = false } = {}) =>
    get('fd_export.php', {
      action: 'range', from, to, direction, search, page, per_page: perPage,
      include_spam: includeSpam ? 1 : 0, include_trash: includeTrash ? 1 : 0,
    }),

  /**
   * Counts straight from the IMAP server, per year, importing nothing.
   * Slow by nature — it opens a mail session — so it is only ever called from
   * an explicit button, never on mount.
   */
  mailbox: (years = 6) => get('fd_export.php', { action: 'mailbox', years }, { timeout: 120000 }),

  /** @param format 'emails' | 'tickets' */
  csvUrl({ from = '', to = '', direction = 'all', search = '', format = 'emails',
           includeSpam = false, includeTrash = false } = {}) {
    const qs = new URLSearchParams({
      action: 'csv', format, from, to, direction, search,
      include_spam: includeSpam ? '1' : '0',
      include_trash: includeTrash ? '1' : '0',
    });
    let token = '';
    try { token = localStorage.getItem('token') || ''; } catch { /* private mode */ }
    if (token) qs.set('token', token);
    return fdUrl(`fd_export.php?${qs.toString()}`);
  },
};

/* ============================================================= backfill == */

/*
 * Importing the mailbox's history — the mail older than the day the desk went
 * live, which the forward sync will never reach.
 *
 * `run` takes ONE batch and returns progress. The caller loops it; it is not a
 * fire-and-forget "import everything" call, because a two-year mailbox cannot
 * be imported inside one PHP request and pretending otherwise just produces a
 * gateway timeout halfway through with no cursor to resume from.
 */
export const backfill = {
  status: () => get('fd_backfill.php', { action: 'status' }),
  /**
   * How many messages a given start date would import. Talks IMAP: slow.
   *
   * Answers for BOTH settings of skipAuto regardless of what is passed, so the
   * card can show what excluding bounces saves without a second round trip.
   */
  preview: (until, skipAuto = false) =>
    get('fd_backfill.php', { action: 'preview', until, skip_auto: skipAuto ? 1 : 0 }, { timeout: 180000 }),
  start: (until, skipAuto = false) =>
    post('fd_backfill.php', { action: 'start', until, skip_auto: skipAuto ? 1 : 0 }, { timeout: 180000 }),
  run: () => post('fd_backfill.php', { action: 'run' }, { timeout: 120000 }),
  resume: () => post('fd_backfill.php', { action: 'resume' }, { timeout: 120000 }),
  stop: () => post('fd_backfill.php', { action: 'stop' }),
  reset: () => post('fd_backfill.php', { action: 'reset' }),
};

/* ============================================================= contacts == */

export const contacts = {
  list: (params = {}) => get('fd_contacts.php', { action: 'list', ...params }),

  /**
   * Address suggestions for a To / Cc / Bcc field.
   * Drawn from people this desk actually corresponds with, so an agent never
   * has to retype an address they have already written to.
   */
  recipients: (q) => get('fd_contacts.php', { action: 'recipients', q }),
  get: (idOrEmail) =>
    get('fd_contacts.php', typeof idOrEmail === 'number'
      ? { action: 'get', id: idOrEmail }
      : { action: 'get', email: idOrEmail }),
  update: (id, fields) => post('fd_contacts.php', { action: 'update', id, ...fields }),
  block: (id, value = true) => post('fd_contacts.php', { action: 'block', id, value }),
  merge: (primaryId, ids) => post('fd_contacts.php', { action: 'merge', primary_id: primaryId, ids }),
  exportUrl: (search = '') => fdUrl(`fd_contacts.php?action=export&search=${encodeURIComponent(search)}`),
};

/* ============================================================= settings == */

export const settings = {
  get: () => get('fd_settings.php', { action: 'get' }),
  save: (values) => post('fd_settings.php', { action: 'save', ...values }),
  testImap: () => get('fd_settings.php', { action: 'test_imap' }, { timeout: 60000 }),
  testSmtp: (to) => post('fd_settings.php', { action: 'test_smtp', to }, { timeout: 60000 }),
  testPusher: () => post('fd_settings.php', { action: 'test_pusher' }),
  folders: () => get('fd_settings.php', { action: 'folders' }, { timeout: 60000 }),
  diagnostics: () => get('fd_settings.php', { action: 'diagnostics' }, { timeout: 90000 }),
  resetSync: () => post('fd_settings.php', { action: 'reset_sync' }),

  /* The audit trail, read from fd_activity. */
  audit: (params = {}) => get('fd_settings.php', { action: 'audit', ...params }),

  /**
   * Collapse a flood of repeated activity rows (old per-ticket SLA breaches).
   * Dry run unless confirm.
   */
  pruneActivity: (confirm = false) =>
    post('fd_settings.php', { action: 'prune_activity', confirm: confirm ? 1 : 0 }, { timeout: 60000 }),

  /**
   * Stop importing the mailbox's history.
   *
   * Moves the sync watermark to the top of the folder so only mail that ARRIVES
   * FROM NOW ON becomes a ticket. Nothing is deleted -- this only moves a
   * number; every message stays in the mailbox.
   *
   * Dry run unless `confirm`.
   */
  skipBacklog: (confirm = false) =>
    post('fd_settings.php', { action: 'skip_backlog', confirm: confirm ? 1 : 0 }, { timeout: 60000 }),

  /**
   * Find (and optionally trash) tickets that are nothing but bounce/auto-reply
   * noise — the "Mail Delivery System: message delayed 72 hours" pile a long
   * running mailbox accumulates.
   *
   * Two-step by design: called without `confirm` it only REPORTS what it would
   * move, so an operator sees the count and a sample before anything changes.
   */
  cleanupBounces: (confirm = false) =>
    post('fd_settings.php', { action: 'cleanup_bounces', confirm: confirm ? 1 : 0 }, { timeout: 120000 }),
  log: (lines = 200) => get('fd_settings.php', { action: 'log', lines }),
};

export default { tickets, messages, attachments, realtime, sync, stats, archive, backfill, contacts, settings, fdUrl };
