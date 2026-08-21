import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import {
  WA, WA_CSS, WA_INBOX_CSS, WA_INBOX_API,
  fmtListTime, initialsOf, avatarColor, n0,
} from './waShared';
import { Spinner, WhatsAppIcon } from './WaUi';
import WaChatThread from './WaChatThread';
import WaContactPanel from './WaContactPanel';

/*
 * Live Chat — the two-way inbox for the WhatsApp channel.
 *
 * Campaigns push; this is what comes back. Someone who replies to a campaign message lands here
 * as a conversation, and an admin can answer them by hand — inside the 24 hours WhatsApp allows
 * free-form messages, or with an approved template after that.
 *
 * This component owns THE POLL. A chat inbox that is left open all day is, by request volume,
 * easily the busiest page in an admin panel, so there is exactly one timer here and it fetches
 * the conversation list and the open thread's new messages in a SINGLE request
 * (wa_inbox.php action=poll). The alternatives — a timer per pane, or one per mounted child —
 * double or triple that load for no visible benefit, and let the list and the thread disagree
 * with each other for a tick.
 *
 * Three panes, WhatsApp Web's proportions:
 *   left    conversations, newest first, with unread badges and a search
 *   centre  the thread itself + composer (WaChatThread)
 *   right   who this person is and every campaign they've received (WaContactPanel)
 */

/*
 * Five minutes, not six seconds.
 *
 * The old cadence made 600 requests an hour per open tab, each one a full list query, to catch a
 * volume of inbound WhatsApp that arrives a few times a day — the poll was costing far more than
 * it was worth. What actually makes an inbox feel live is not the interval but refreshing on the
 * moments a person can perceive: switching back to the tab, opening a thread, and sending a
 * message all tick immediately (see `tick` below and `refreshNow`), and there is a manual refresh
 * in the header for the rest. The interval is only the backstop for a tab left open and untouched.
 */
const POLL_MS = 5 * 60 * 1000;

const FILTERS = [
  { id: 'all',      label: 'All' },
  { id: 'unread',   label: 'Unread' },
  { id: 'open',     label: 'Open' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'archived', label: 'Archived' },
];

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
    <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
  </svg>
);

const RefreshIcon = ({ spinning }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
       style={spinning ? { animation: 'wa-spin .8s linear infinite' } : undefined}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
  </svg>
);

/** "just now" / "4 min ago" — enough to tell a quiet inbox from a stalled poll. */
const fmtAgo = ts => {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

export default function WaInbox() {
  const [params, setParams] = useSearchParams();

  const [threads, setThreads]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [search, setSearch]     = useState('');
  const [debounced, setDebounced] = useState('');
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [total, setTotal]       = useState(0);

  const activeId = Number(params.get('c') || 0) || null;
  const setActiveId = useCallback(id => {
    setParams(id ? { c: String(id) } : {}, { replace: true });
  }, [setParams]);

  /*
   * The newest message the thread pane is currently showing. The poll sends it as `after` so
   * the server returns only what arrived since — the difference between a few hundred bytes a
   * tick and re-sending the whole conversation every six seconds.
   *
   * A ref rather than state on purpose: it changes on every message and must not itself
   * re-trigger the poll effect.
   */
  const cursorRef = useRef(null);
  const [incoming, setIncoming] = useState({ seq: 0, messages: [] });
  const seqRef = useRef(0);

  // The live poll function, so a send or a button press can force one off-schedule.
  const tickRef = useRef(null);
  const [polling, setPolling]   = useState(false);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const activeThread = useMemo(() => threads.find(t => t.id === activeId) || null, [threads, activeId]);

  /** Full list refresh — on mount and whenever the filter or search changes. */
  const loadThreads = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await api.get(WA_INBOX_API, { params: { action: 'threads', filter, search: debounced, per_page: 60 } });
      if (res.data?.success) {
        setThreads(res.data.data.threads || []);
        setUnreadTotal(res.data.data.unread_threads || 0);
        setTotal(res.data.data.total || 0);
      } else if (!quiet) {
        toast.error(res.data?.message || 'Could not load conversations');
      }
    } catch (e) {
      if (!quiet) toast.error(explainError(e));
    } finally {
      setLoading(false);
    }
  }, [filter, debounced]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  /*
   * The single poll. Paused while the tab is hidden — an inbox left open in a background tab
   * all day would otherwise poll into the void — and resumed with an immediate tick so switching
   * back never shows stale messages.
   *
   * tickRef holds the live tick so anything outside this effect (the composer after a send, the
   * refresh button, opening a thread) can force one without waiting out the interval. That is
   * what keeps a five-minute poll from feeling like a five-minute delay.
   */
  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      setPolling(true);
      try {
        const res = await api.get(WA_INBOX_API, {
          params: {
            action: 'poll', filter, search: debounced, per_page: 60,
            conversation_id: activeId || '', after: cursorRef.current || '',
          },
        });
        if (cancelled || !res.data?.success) return;
        const d = res.data.data;
        setThreads(d.threads || []);
        setUnreadTotal(d.unread_threads || 0);
        setTotal(d.total || 0);
        if (d.messages?.length) {
          seqRef.current += 1;
          setIncoming({ seq: seqRef.current, messages: d.messages });
        }
        if (!cancelled) setLastSync(Date.now());
      } catch {
        // Silent: a dropped poll is not worth a toast. The next tick recovers, and anything the
        // admin actually initiates still reports its own errors.
      } finally {
        if (!cancelled) setPolling(false);
      }
    };

    tickRef.current = tick;
    timer = setInterval(tick, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true; clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      if (tickRef.current === tick) tickRef.current = null;
    };
  }, [filter, debounced, activeId]);

  /** Force a poll right now — used after a send, on opening a thread, and by the refresh button. */
  const refreshNow = useCallback(() => { tickRef.current?.(); }, []);

  /** Called by the thread pane after it renders, so the poll knows where to resume from. */
  const onCursor = useCallback(ts => { cursorRef.current = ts; }, []);

  /** Local unread reset — the server call happens in the thread pane; this keeps the badge from
   *  lingering for a whole poll interval after a click. */
  const clearUnread = useCallback(id => {
    setThreads(ts => ts.map(t => (t.id === id ? { ...t, unread_count: 0 } : t)));
  }, []);

  const openThread = useCallback(id => {
    cursorRef.current = null;
    setActiveId(id);
    clearUnread(id);
    // The effect re-runs on activeId and installs a new tick; force it on the next frame so the
    // thread is current the moment it opens rather than up to five minutes behind.
    setTimeout(() => tickRef.current?.(), 0);
  }, [setActiveId, clearUnread]);

  return (
    <div style={{ position: 'relative', height: '100%' }} className="wa">
      <style>{WA_CSS}{WA_INBOX_CSS}</style>

      <div className={`wa-inbox${activeId ? '' : ' wa-inbox-2col'}`}>

        {/* ── left: conversations ─────────────────────────────────────────────────────── */}
        <div className="wa-pane">
          <div className="wa-pane-head" style={{ padding: '11px 14px 9px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ color: WA.greenDark, display: 'flex' }}><WhatsAppIcon size={17} /></span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Live Chat</span>
              {unreadTotal > 0 && <span className="wa-unread-dot">{unreadTotal}</span>}
              <span style={{ marginLeft: 'auto', fontSize: 10.5, color: '#94a3b8', fontWeight: 600 }}>
                {n0(total)} chats
              </span>
              {/* The poll is a five-minute backstop, so the interval has to be visible and
                  overridable — otherwise "nothing new" and "not checked yet" look identical. */}
              <button
                type="button" onClick={refreshNow} disabled={polling}
                title={lastSync ? `Checked ${fmtAgo(lastSync)} · checks every 5 min` : 'Check for new messages'}
                className="wa-refresh-btn" aria-label="Check for new messages">
                <RefreshIcon spinning={polling} />
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex' }}>
                <SearchIcon />
              </span>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, number or email"
                style={{
                  width: '100%', padding: '8px 12px 8px 31px', border: '1px solid #e2e8f0', borderRadius: 8,
                  fontSize: 12, fontFamily: 'inherit', outline: 'none', background: '#f8fafc', color: '#1e293b',
                }} />
            </div>

            <div style={{ display: 'flex', gap: 5, marginTop: 9, flexWrap: 'wrap' }}>
              {FILTERS.map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  style={{
                    padding: '3px 10px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'inherit', border: '1px solid ' + (filter === f.id ? WA.greenDark : '#e2e8f0'),
                    background: filter === f.id ? WA.greenDark : '#fff',
                    color: filter === f.id ? '#fff' : '#64748b',
                    transition: 'all 200ms cubic-bezier(.4,0,.2,1)',
                  }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="wa-scroll">
            {loading ? (
              <div style={{ padding: 50, textAlign: 'center' }}><Spinner /></div>
            ) : threads.length === 0 ? (
              <EmptyList filter={filter} search={debounced} />
            ) : (
              threads.map(t => (
                <ThreadRow key={t.id} t={t} active={t.id === activeId} onClick={() => openThread(t.id)} />
              ))
            )}
          </div>
        </div>

        {/* ── centre: the conversation ────────────────────────────────────────────────── */}
        {activeId ? (
          <WaChatThread
            key={activeId}
            conversationId={activeId}
            summary={activeThread}
            incoming={incoming}
            onCursor={onCursor}
            onRead={() => clearUnread(activeId)}
            /* A send is the one moment the list is guaranteed stale (preview, ordering, and any
               reply that landed while the composer was open), so it forces a poll rather than
               only refreshing the list — the merge is by message key, so nothing doubles up. */
            onChanged={refreshNow}
          />
        ) : (
          <NoThreadSelected hasAny={threads.length > 0} />
        )}

        {/* ── right: who this is ──────────────────────────────────────────────────────── */}
        {activeId && (
          <WaContactPanel
            key={`p-${activeId}`}
            conversationId={activeId}
            onChanged={() => loadThreads(true)}
          />
        )}
      </div>
    </div>
  );
}

/* ── list row ─────────────────────────────────────────────────────────────────────────── */

function ThreadRow({ t, active, onClick }) {
  const unread = t.unread_count > 0;
  return (
    <button className={`wa-thread${active ? ' active' : ''}${unread ? ' unread' : ''}`} onClick={onClick}>
      <span className="wa-avatar" style={{ background: avatarColor(t.phone) }}>{initialsOf(t.name)}</span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className="wa-thread-name" style={{ flex: 1 }}>{t.name}</span>
          <span style={{ fontSize: 10, color: unread ? WA.greenDark : '#94a3b8', fontWeight: unread ? 800 : 600, flexShrink: 0 }}>
            {fmtListTime(t.last_message_at)}
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="wa-thread-prev" style={{ flex: 1 }}>
            {t.last_message_direction === 'out' && <span style={{ color: '#94a3b8', marginRight: 3 }}>You:</span>}
            {t.last_message_text || 'No messages yet'}
          </span>
          {unread && <span className="wa-unread-dot">{t.unread_count}</span>}
          {!unread && t.status === 'resolved' && (
            <span title="Resolved" style={{ color: '#94a3b8', display: 'flex' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/* ── empty states ─────────────────────────────────────────────────────────────────────── */

function EmptyList({ filter, search }) {
  return (
    <div style={{ padding: '46px 26px', textAlign: 'center' }}>
      <div style={{ color: '#cbd5e1', display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <WhatsAppIcon size={38} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
        {search ? 'No matches' : filter === 'unread' ? 'Nothing unread' : 'No conversations yet'}
      </div>
      <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.6 }}>
        {search
          ? 'Try a different name, number or email.'
          : 'A conversation appears here the moment someone replies to one of your campaign messages.'}
      </div>
    </div>
  );
}

function NoThreadSelected({ hasAny }) {
  return (
    <div className="wa-pane wa-chat-bg" style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 40 }}>
      <div style={{ maxWidth: 380 }}>
        <div style={{ color: '#c9c4bd', display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <WhatsAppIcon size={54} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#41525d', marginBottom: 8 }}>WhatsApp Live Chat</div>
        <p style={{ fontSize: 12.5, color: '#667781', lineHeight: 1.7, margin: 0 }}>
          {hasAny
            ? 'Pick a conversation on the left to read it and reply.'
            : 'Replies to your WhatsApp campaigns land here automatically. Nothing to do — just keep the webhook subscribed to the messages field.'}
        </p>
        <p style={{ fontSize: 11, color: '#8696a0', lineHeight: 1.7, marginTop: 18, background: 'rgba(255,255,255,.6)', padding: '10px 14px', borderRadius: 8 }}>
          WhatsApp allows free-form replies for <b>24 hours</b> after the contact's last message.
          After that only an approved template will be delivered — this screen tells you which
          state each conversation is in.
        </p>
      </div>
    </div>
  );
}

/** Maps the failure modes that actually happen here to something an admin can act on. */
function explainError(e) {
  const msg = e?.response?.data?.message || e?.message || 'Network error';
  if (/invalid action/i.test(msg)) {
    return 'The backend does not have the Live Chat API yet — upload react-api/api/whatsapp/ to the server.';
  }
  return msg;
}
