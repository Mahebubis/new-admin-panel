import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import {
  WA, WA_INBOX_API, FORM,
  fmtChatTime, fmtDayDivider, dayKey, fmtWindow, initialsOf, avatarColor, fmtBytes,
} from './waShared';
import { Spinner } from './WaUi';
import WaTemplateSendModal from './WaTemplateSendModal';

/*
 * The middle pane: one conversation, WhatsApp Web's layout and palette.
 *
 * Two things here are not cosmetic and drive most of the code:
 *
 * 1. THE 24-HOUR WINDOW. WhatsApp only delivers free-form messages within 24 hours of the
 *    contact's last message. Outside it, Meta accepts nothing but an approved template. So the
 *    composer swaps itself out when the window lapses rather than letting someone type a reply
 *    that will be rejected — the rejection (#131047) arrives asynchronously and reads like a
 *    bug, not an explanation.
 *
 * 2. CAMPAIGN MESSAGES ARE IN THIS THREAD. The server merges wa_campaign_recipients rows into
 *    the history, so the template that prompted a reply sits directly above it, tagged with its
 *    campaign. That context is the whole reason to read a reply inside the panel rather than on
 *    a phone.
 */

const PAGE = 60;

/* Media is fetched through the API (JWT-gated), never as a bare <img src>, so it arrives as a
   blob. Cached per message id for the session: re-fetching a photo every time the pane
   re-renders would be both slow and pointless. */
const mediaCache = new Map();

export default function WaChatThread({ conversationId, summary, incoming, onCursor, onRead, onChanged }) {
  const [conv, setConv]         = useState(summary || null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [hasMore, setHasMore]   = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending]   = useState(false);
  const [text, setText]         = useState('');
  const [attachment, setAttachment] = useState(null);
  const [templateOpen, setTemplateOpen] = useState(false);

  const scrollRef = useRef(null);
  const fileRef   = useRef(null);
  const taRef     = useRef(null);
  /* Set before a state update that should NOT jump the view to the bottom (loading older
     messages). Without it, prepending history yanks the reader back to the newest message. */
  const keepScrollRef = useRef(null);

  /* ── load ──────────────────────────────────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(WA_INBOX_API, { params: { action: 'thread', id: conversationId, limit: PAGE } });
        if (cancelled) return;
        if (res.data?.success) {
          setConv(res.data.data.conversation);
          setMessages(res.data.data.messages || []);
          setHasMore(!!res.data.data.has_more);
        } else {
          toast.error(res.data?.message || 'Could not open this conversation');
        }
      } catch (e) {
        if (!cancelled) toast.error(e?.response?.data?.message || 'Could not open this conversation');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId]);

  /*
   * Clearing the badge is a side effect of opening the thread, and also tells WhatsApp to show
   * the contact blue ticks. Fire-and-forget — a failed read receipt must not surface as an error
   * the admin can do anything about.
   *
   * onRead is held in a ref rather than listed as a dependency: the parent re-renders on every
   * poll tick, so an inline callback prop changes identity every six seconds and would turn a
   * once-per-thread request into a permanent one.
   */
  const onReadRef = useRef(onRead);
  useEffect(() => { onReadRef.current = onRead; }, [onRead]);
  useEffect(() => {
    api.post(WA_INBOX_API, new URLSearchParams({ action: 'mark_read', id: String(conversationId) }), FORM)
      .then(() => onReadRef.current?.())
      .catch(() => {});
  }, [conversationId]);

  /* New messages handed down by the parent's poll. Merged by key so a message that was already
     optimistically inserted after a send isn't shown twice. */
  useEffect(() => {
    if (!incoming?.messages?.length) return;
    setMessages(prev => {
      const seen = new Set(prev.map(m => m.key));
      const add = incoming.messages.filter(m => !seen.has(m.key));
      return add.length ? [...prev, ...add] : prev;
    });
  }, [incoming]);

  /* The poll's resume point. Reported upward on every change so the parent never re-requests
     history it already has. */
  const newestAt = messages.length ? messages[messages.length - 1].created_at : null;
  useEffect(() => { onCursor?.(newestAt); }, [newestAt, onCursor]);

  /*
   * Scroll behaviour, in the order the cases actually matter:
   *   - just prepended older messages → hold the reader's place, don't jump anywhere
   *   - reader is at (or near) the bottom → follow the new message, like any chat client
   *   - reader has scrolled up to read history → leave them alone; a poll landing a message
   *     must not yank them back down mid-sentence
   *
   * `atBottom` is measured BEFORE the paint that added the message, which is why it's captured
   * in the same effect rather than read from a scroll handler.
   */
  const atBottomRef = useRef(true);
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (keepScrollRef.current !== null) {
      el.scrollTop = el.scrollHeight - keepScrollRef.current;
      keepScrollRef.current = null;
      return;
    }
    if (atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const loadOlder = async () => {
    if (!messages.length || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.get(WA_INBOX_API, {
        params: { action: 'thread', id: conversationId, limit: PAGE, before: messages[0].created_at },
      });
      if (res.data?.success) {
        const older = res.data.data.messages || [];
        keepScrollRef.current = scrollRef.current?.scrollHeight ?? 0;
        setMessages(prev => {
          const seen = new Set(prev.map(m => m.key));
          return [...older.filter(m => !seen.has(m.key)), ...prev];
        });
        setHasMore(!!res.data.data.has_more && older.length > 0);
      }
    } catch { /* the button stays; a retry costs one tap */ }
    finally { setLoadingMore(false); }
  };

  /* ── send ──────────────────────────────────────────────────────────────────────────── */

  const windowOpen = conv?.window_open ?? false;

  const appendSent = msg => {
    if (!msg) return;
    setMessages(prev => [...prev, {
      key: `m-${msg.id}`, src: 'm', id: Number(msg.id), direction: 'out',
      type: msg.msg_type, body: msg.body, caption: msg.caption,
      has_media: !!(msg.media_id || msg.local_path),
      media_mime: msg.media_mime, media_filename: msg.media_filename,
      media_size: msg.media_size ? Number(msg.media_size) : null,
      template_name: msg.template_name, status: msg.status, error: msg.error_message,
      created_at: msg.created_at, campaign_id: null, campaign_name: null, click_count: 0,
    }]);
    onChanged?.();
  };

  const sendText = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await api.post(WA_INBOX_API,
        new URLSearchParams({ action: 'send', id: String(conversationId), text: body }), FORM);
      if (res.data?.success) {
        setText('');
        if (taRef.current) taRef.current.style.height = 'auto';
        appendSent(res.data.data.message);
      } else {
        toast.error(res.data?.message || 'Could not send');
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not send');
    } finally { setSending(false); }
  };

  const sendAttachment = async caption => {
    if (!attachment || sending) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('action', 'send_media');
      fd.append('id', String(conversationId));
      fd.append('caption', caption || '');
      fd.append('file', attachment.file);
      // Uploads run through Meta and can be slow for a 16 MB video, so this one call opts out of
      // the client's global 30-second timeout.
      const res = await api.post(WA_INBOX_API, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000,
      });
      if (res.data?.success) { setAttachment(null); appendSent(res.data.data.message); }
      else toast.error(res.data?.message || 'Could not send the file');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not send the file');
    } finally { setSending(false); }
  };

  const onPickFile = e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAttachment({ file, url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null });
  };

  const onKeyDown = e => {
    // Enter sends, Shift+Enter breaks the line — WhatsApp's own behaviour, and the one people
    // reach for without thinking.
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); }
  };

  const autoGrow = e => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 132) + 'px';
  };

  /* ── render ────────────────────────────────────────────────────────────────────────── */

  const grouped = useMemo(() => {
    const out = [];
    let lastDay = null;
    for (const m of messages) {
      const k = dayKey(m.created_at);
      if (k !== lastDay) { out.push({ divider: true, key: `d-${k}`, at: m.created_at }); lastDay = k; }
      out.push(m);
    }
    return out;
  }, [messages]);

  const name = conv?.name || summary?.name || '';

  return (
    <div className="wa-pane">
      {/* header */}
      <div className="wa-pane-head" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 16px', background: '#f0f2f5' }}>
        <span className="wa-avatar" style={{ background: avatarColor(conv?.phone || ''), width: 38, height: 38, fontSize: 13 }}>
          {initialsOf(name)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111b21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </div>
          <div style={{ fontSize: 11, color: '#667781', marginTop: 1 }}>
            +{conv?.phone}
            {conv?.email ? <span style={{ color: '#8696a0' }}> · {conv.email}</span> : null}
          </div>
        </div>
        <WindowChip conv={conv} />
      </div>

      {/* messages */}
      <div className="wa-scroll wa-chat-bg" ref={scrollRef} onScroll={onScroll}
        style={{ display: 'flex', flexDirection: 'column', padding: '6px 5% 10px' }}>
        {loading ? (
          <div style={{ margin: 'auto' }}><Spinner /></div>
        ) : (
          <>
            {hasMore && (
              <button onClick={loadOlder} disabled={loadingMore}
                style={{
                  alignSelf: 'center', margin: '10px auto 4px', padding: '6px 16px', borderRadius: 999,
                  border: 'none', background: '#fff', color: '#54656f', fontSize: 11, fontWeight: 700,
                  cursor: loadingMore ? 'wait' : 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 1px .5px rgba(11,20,26,.13)',
                }}>
                {loadingMore ? 'Loading…' : 'Load earlier messages'}
              </button>
            )}
            {grouped.length === 0 && (
              <div className="wa-sys-pill" style={{ marginTop: 24 }}>
                No messages yet. Outside the 24-hour window you can still start this conversation
                with an approved template.
              </div>
            )}
            {grouped.map(m => m.divider
              ? <div key={m.key} className="wa-day-pill">{fmtDayDivider(m.at)}</div>
              : <MessageRow key={m.key} m={m} />)}
          </>
        )}
      </div>

      {/* composer */}
      {windowOpen ? (
        <div className="wa-composer">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <input ref={fileRef} type="file" hidden onChange={onPickFile}
              accept="image/jpeg,image/png,video/mp4,video/3gpp,audio/mpeg,audio/ogg,audio/aac,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip" />
            <button className="wa-icon-btn" title="Attach a file" disabled={sending} onClick={() => fileRef.current?.click()}>
              <ClipIcon />
            </button>
            <textarea ref={taRef} className="wa-composer-input" rows={1} value={text}
              onChange={autoGrow} onKeyDown={onKeyDown} placeholder="Type a message"
              disabled={sending} />
            <button className="wa-send-btn" onClick={sendText} disabled={sending || !text.trim()}
              title={sending ? 'Sending…' : 'Send (Enter)'}>
              <SendIcon />
            </button>
          </div>
          <div style={{ fontSize: 10, color: '#8696a0', marginTop: 5, paddingLeft: 42 }}>
            Enter to send · Shift+Enter for a new line · {fmtWindow(conv?.window_seconds_left)} in the free-form window
          </div>
        </div>
      ) : (
        <ClosedWindowComposer conv={conv} onTemplate={() => setTemplateOpen(true)} />
      )}

      {attachment && (
        <AttachmentPreview
          attachment={attachment} sending={sending}
          onCancel={() => { if (attachment.url) URL.revokeObjectURL(attachment.url); setAttachment(null); }}
          onSend={sendAttachment} />
      )}

      {templateOpen && (
        <WaTemplateSendModal
          conversationId={conversationId}
          contact={conv}
          onClose={() => setTemplateOpen(false)}
          onSent={msg => { setTemplateOpen(false); appendSent(msg); }} />
      )}
    </div>
  );
}

/* ── one message ──────────────────────────────────────────────────────────────────────── */

function MessageRow({ m }) {
  const out = m.direction === 'out';
  const failed = m.status === 'failed';
  return (
    <div className={`wa-msg-row ${out ? 'out' : 'in'}`}>
      <div className={`wa-bubble ${out ? 'out' : 'in'}`} style={failed ? { background: '#fee2e2' } : undefined}>
        {m.campaign_name && (
          <div className="wa-campaign-tag" title={`Campaign #${m.campaign_id}`}>
            <MegaphoneIcon />{m.campaign_name}
          </div>
        )}
        {!m.campaign_name && m.template_name && (
          <div className="wa-campaign-tag" style={{ color: '#6d28d9', background: 'rgba(109,40,217,.1)' }}>
            Template · {m.template_name}
          </div>
        )}

        {m.has_media && <MediaBlock m={m} />}

        {(m.body || m.caption) && (
          <div style={{ marginTop: m.has_media ? 5 : 0 }}>{m.body || m.caption}</div>
        )}

        {failed && m.error && (
          <div style={{ fontSize: 10.5, color: '#b91c1c', marginTop: 5, fontWeight: 600 }}>
            Not delivered — {m.error}
          </div>
        )}

        <div className="wa-bubble-meta">
          {fmtChatTime(m.created_at)}
          {out && <Ticks status={m.status} />}
        </div>
        <div style={{ clear: 'both' }} />
      </div>
    </div>
  );
}

/**
 * Inbound media, fetched through the JWT-gated API and rendered from a blob URL.
 *
 * Meta deletes media 30 days after it was sent; from then on only our server-side cache has it,
 * which is why a failure here explains that rather than showing a broken image.
 */
function MediaBlock({ m }) {
  const [url, setUrl]   = useState(() => mediaCache.get(m.id) || null);
  const [err, setErr]   = useState(null);
  const [busy, setBusy] = useState(false);

  const isImage = (m.media_mime || '').startsWith('image/');
  const isVideo = (m.media_mime || '').startsWith('video/');
  const isAudio = (m.media_mime || '').startsWith('audio/');

  const load = useCallback(async () => {
    if (url || busy) return;
    setBusy(true);
    try {
      const res = await api.get(WA_INBOX_API, {
        params: { action: 'media', message_id: m.id }, responseType: 'blob', timeout: 120000,
      });
      const objUrl = URL.createObjectURL(res.data);
      mediaCache.set(m.id, objUrl);
      setUrl(objUrl);
    } catch (e) {
      // A JSON error arrives as a blob because of responseType — read it back out so the real
      // reason (expired media, no token) is shown instead of a generic failure.
      let msg = 'Could not load this attachment';
      try { msg = JSON.parse(await e?.response?.data?.text?.() || '{}').message || msg; } catch { /* keep default */ }
      setErr(msg);
    } finally { setBusy(false); }
  }, [m.id, url, busy]);

  // Images and audio load on sight; video and documents wait for a click so a thread full of
  // attachments doesn't pull tens of megabytes on open.
  useEffect(() => { if (isImage || isAudio) load(); }, [isImage, isAudio, load]);

  if (err) {
    return <div style={{ fontSize: 11, color: '#b91c1c', background: 'rgba(185,28,28,.07)', padding: '7px 9px', borderRadius: 6 }}>{err}</div>;
  }

  if (isImage) {
    return url
      ? <img src={url} alt={m.media_filename || 'Photo'} onClick={() => window.open(url, '_blank')}
          style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 6, display: 'block', cursor: 'zoom-in' }} />
      : <div style={{ width: 220, height: 150, background: 'rgba(15,23,42,.06)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={20} /></div>;
  }
  if (isVideo) {
    return url
      ? <video src={url} controls style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 6, display: 'block' }} />
      : <MediaStub m={m} busy={busy} onClick={load} label="Play video" icon={<PlayIcon />} />;
  }
  if (isAudio) {
    return url
      ? <audio src={url} controls style={{ width: 240, height: 36 }} />
      : <MediaStub m={m} busy={busy} onClick={load} label="Voice message" icon={<PlayIcon />} />;
  }
  return url
    ? <a href={url} download={m.media_filename || 'file'} style={{ textDecoration: 'none' }}>
        <MediaStub m={m} busy={false} label="Download" icon={<DocIcon />} />
      </a>
    : <MediaStub m={m} busy={busy} onClick={load} label="Load document" icon={<DocIcon />} />;
}

function MediaStub({ m, busy, onClick, label, icon }) {
  return (
    <button onClick={onClick} disabled={busy}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', minWidth: 200,
        background: 'rgba(15,23,42,.05)', border: 'none', borderRadius: 6, cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'inherit', textAlign: 'left', width: '100%',
      }}>
      <span style={{ color: WA.greenDark, display: 'flex', flexShrink: 0 }}>{busy ? <Spinner size={18} /> : icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#111b21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.media_filename || label}
        </span>
        <span style={{ display: 'block', fontSize: 10.5, color: '#667781', marginTop: 1 }}>
          {busy ? 'Loading…' : [m.media_mime, m.media_size ? fmtBytes(m.media_size) : null].filter(Boolean).join(' · ') || label}
        </span>
      </span>
    </button>
  );
}

/** WhatsApp's own delivery indicators — one tick sent, two delivered, two blue read. */
function Ticks({ status }) {
  if (status === 'failed') {
    return <span title="Not delivered" style={{ color: '#dc2626', fontWeight: 800, fontSize: 11 }}>!</span>;
  }
  if (status === 'pending' || status === 'processing') {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth={2.2} strokeLinecap="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
      </svg>
    );
  }
  const read = status === 'read';
  const double = read || status === 'delivered';
  const color = read ? '#53bdeb' : '#8696a0';
  return (
    <svg width="15" height="11" viewBox="0 0 18 12" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"
      title={read ? 'Read' : double ? 'Delivered' : 'Sent'}>
      <path d="M1.5 6.5L4.5 9.5L10 3.5" />
      {double && <path d="M7.5 6.5L10.5 9.5L16 3.5" />}
    </svg>
  );
}

/* ── window state ─────────────────────────────────────────────────────────────────────── */

function WindowChip({ conv }) {
  const open = conv?.window_open;
  return (
    <span title={open
      ? 'You can send free-form messages until this runs out'
      : 'WhatsApp will only deliver an approved template now'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999,
        fontSize: 10.5, fontWeight: 800, letterSpacing: '.2px', whiteSpace: 'nowrap',
        background: open ? '#dcfce7' : '#fef3c7', color: open ? '#15803d' : '#b45309',
      }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: open ? '#22c55e' : '#f59e0b' }} />
      {open ? fmtWindow(conv?.window_seconds_left) : '24h window closed'}
    </span>
  );
}

function ClosedWindowComposer({ conv, onTemplate }) {
  return (
    <div className="wa-composer" style={{ background: '#fffbeb', borderTop: '1px solid #fde68a' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: '#b45309', display: 'flex', flexShrink: 0 }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
          </svg>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>The 24-hour reply window has closed</div>
          <div style={{ fontSize: 11, color: '#a16207', marginTop: 2, lineHeight: 1.5 }}>
            {conv?.last_message_at
              ? 'WhatsApp only delivers free-form messages within 24 hours of the contact\'s last message. Send an approved template — replying to it reopens the window.'
              : 'This contact has never messaged us, so only an approved template can be delivered.'}
          </div>
        </div>
        <button className="wa-btn wa-btn-contained" onClick={onTemplate} style={{ flexShrink: 0 }}>
          SEND TEMPLATE
        </button>
      </div>
    </div>
  );
}

/* ── attachment confirm ───────────────────────────────────────────────────────────────── */

function AttachmentPreview({ attachment, sending, onCancel, onSend }) {
  const [caption, setCaption] = useState('');
  const f = attachment.file;
  return (
    <div className="wa-backdrop" onClick={() => !sending && onCancel()}>
      <div className="wa-dialog" style={{ width: 460, padding: 22 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>Send attachment</div>
        <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 16 }}>
          Uploaded to Meta, then delivered on WhatsApp. A copy is kept in the panel.
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 14, textAlign: 'center' }}>
          {attachment.url
            ? <img src={attachment.url} alt="" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8 }} />
            : <div style={{ padding: '18px 0', color: '#64748b' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: WA.greenDark }}><DocIcon size={30} /></div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', wordBreak: 'break-all' }}>{f.name}</div>
              </div>}
          <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 8 }}>
            {f.type || 'unknown type'} · {fmtBytes(f.size)}
          </div>
        </div>

        <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Add a caption (optional)"
          disabled={sending}
          style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="wa-btn wa-btn-text" onClick={onCancel} disabled={sending}>CANCEL</button>
          <button className="wa-btn wa-btn-contained" onClick={() => onSend(caption)} disabled={sending}>
            {sending ? 'SENDING…' : 'SEND'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── icons ────────────────────────────────────────────────────────────────────────────── */

const ClipIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);
const SendIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
);
const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
);
const DocIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
  </svg>
);
const MegaphoneIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z" /><path d="M17 9a4 4 0 0 1 0 6" />
  </svg>
);
