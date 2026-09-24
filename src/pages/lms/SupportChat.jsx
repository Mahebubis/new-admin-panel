// ===========================================================================
//  SupportChat.jsx — one ticket, opened from the Support queue.
//
//  A panel that slides in from the right over the queue:
//    • width is adjustable — drag the left edge, or maximise to full screen;
//      the width is remembered per browser
//    • the thread opens at the LATEST message (bottom) and stays pinned there
//      while images and videos finish loading, unless the admin has scrolled
//      up to read — then a "Latest" button appears instead
//    • the reply box takes files: the paperclip, drag-and-drop, or a pasted
//      screenshot; each file becomes its own message on the learner's side
//    • Reply and Close are separate. After a reply, a small alert drops from
//      the top asking whether to close the ticket (or park it in Pending)
//    • the student panel on the right: email, phone and internship domain
//      with copy buttons, LMS courses, and this learner's earlier tickets.
//      On a narrow panel it becomes an overlay behind the (i) button.
// ===========================================================================
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  X, Send, Paperclip, Maximize2, Minimize2, Info, Copy, Check, CheckCircle2, PauseCircle,
  RotateCcw, ChevronDown, Mail, Phone, GraduationCap, BookOpen, Hash, Clock, Trash2, UploadCloud,
  MessageSquare,
} from 'lucide-react';
import { LMS } from './lmsApi';
import { Attachment, FilePreview, KindIcon, Linkified } from './supportFiles';
import { BUCKET, bucketOf, copyText, extOf, fileKind, fileSize, fullStamp } from './supportUtils';

/* Kept in step with LMS_SUPPORT_EXT / _MAX_BYTES / _MAX_FILES in lms_api.php. */
const OK_EXT = [
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp',
  'pdf', 'txt', 'csv', 'xls', 'xlsx', 'doc', 'docx', 'ppt', 'pptx',
  'mp4', 'webm', 'mov', 'mkv', 'm4v', 'mp3', 'wav', 'ogg', 'm4a',
  'zip', 'rar', '7z',
];
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 5;
const WIDTH_KEY = 'lms_support_chat_width';

const parseDate = (d) => (d ? new Date(String(d).replace(' ', 'T')) : null);
const timeOf = (d) => parseDate(d)?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) || '';
function dayLabel(d) {
  const t = parseDate(d);
  if (!t) return '';
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (t.toDateString() === today.toDateString()) return 'Today';
  if (t.toDateString() === y.toDateString()) return 'Yesterday';
  return t.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function CopyBtn({ value, label }) {
  const [done, setDone] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      className={`sp-copy${done ? ' done' : ''}`}
      title={`Copy ${label}`}
      onClick={() => {
        copyText(value, `${label} copied`);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function checkFile(f) {
  const e = extOf(f.name);
  if (!OK_EXT.includes(e)) return `${f.name}: .${e || '?'} files cannot be attached`;
  if (f.size > MAX_BYTES) return `${f.name} is ${fileSize(f.size)} — the limit is 25 MB`;
  if (f.size <= 0) return `${f.name} is empty`;
  return '';
}

/* ── the alert that drops from the top after a reply ───────────────────── */
function ClosePrompt({ name, onCloseTicket, onPending, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 15000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className="sp-prompt" role="alertdialog" aria-label="Close this ticket?">
      <span className="sp-prompt-ico"><CheckCircle2 size={20} /></span>
      <div className="sp-prompt-text">
        <strong>Reply sent{name ? ` to ${name}` : ''}</strong>
        <span>Is this resolved? Close the ticket now — if they write back it reopens on its own.</span>
      </div>
      <div className="sp-prompt-actions">
        <button type="button" className="lms-btn lms-btn-ghost sp-btn-sm" onClick={onPending}>
          <PauseCircle size={14} /> Pending
        </button>
        <button type="button" className="lms-btn lms-btn-dark sp-btn-sm" onClick={onCloseTicket}>
          <CheckCircle2 size={14} /> Close ticket
        </button>
      </div>
      <button type="button" className="sp-prompt-x" onClick={onDismiss} title="Keep it open"><X size={16} /></button>
      <span className="sp-prompt-timer" />
    </div>
  );
}

/* ── one message ───────────────────────────────────────────────────────── */
function Bubble({ m, onPreview, onMediaLoad }) {
  const fromUs = m.sender === 'admin';
  const who = fromUs ? (m.author || 'Support team') : (m.author || 'Learner');
  return (
    <div className={`sp-msg${fromUs ? ' us' : ''}`}>
      {!fromUs && <div className="sp-msg-av">{who.charAt(0).toUpperCase()}</div>}
      <div className="sp-bubble">
        <div className="sp-msg-head">
          <strong>{who}</strong>
          <span title={fullStamp(m.created_at)}>{timeOf(m.created_at)}</span>
        </div>
        {m.body && <div className="sp-msg-body"><Linkified text={m.body} /></div>}
        {m.file_url && <Attachment m={m} onPreview={onPreview} onMediaLoad={onMediaLoad} />}
      </div>
    </div>
  );
}

/* ── the student panel ─────────────────────────────────────────────────── */
function StudentPanel({ data, onOpenTicket }) {
  const { ticket: t, student: s = {}, history = [] } = data;
  const b = BUCKET[bucketOf(t.status)];
  const domains = (s.internships || []).map(i => i.name).filter(Boolean);
  const summary = [
    s.name && `Name: ${s.name}`,
    (s.email || t.email) && `Email: ${s.email || t.email}`,
    s.phone && `Phone: ${s.phone}`,
    domains.length && `Internship: ${domains.join(', ')}`,
    `Ticket: #${t.id} — ${t.subject}`,
  ].filter(Boolean).join('\n');

  return (
    <div className="sp-side-inner">
      <div className="sp-stu-head">
        <div className="sp-stu-av">{(s.name || t.name || t.email || '?').charAt(0).toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <div className="sp-stu-name">{s.name || t.name || 'Learner'}</div>
          <div className="sp-stu-sub">User #{t.user_id}</div>
        </div>
        <button type="button" className="sp-copy-all" onClick={() => copyText(summary, 'Student details copied')}
          title="Copy name, email, phone and domain">
          <Copy size={13} /> Copy all
        </button>
      </div>

      <div className="sp-kv">
        <div className="sp-kv-row">
          <Mail size={14} />
          <div className="sp-kv-body"><label>Email</label><span>{s.email || t.email || '—'}</span></div>
          <CopyBtn value={s.email || t.email} label="Email" />
        </div>
        {s.phone && (
          <div className="sp-kv-row">
            <Phone size={14} />
            <div className="sp-kv-body"><label>Phone</label><span>{s.phone}</span></div>
            <CopyBtn value={s.phone} label="Phone" />
          </div>
        )}
      </div>

      <div className="sp-side-title"><GraduationCap size={14} /> Internship domain</div>
      {(s.internships || []).length === 0 ? (
        <div className="sp-side-empty">No internship purchase found for this account.</div>
      ) : (
        <div className="sp-domains">
          {s.internships.map((i, k) => (
            <div className="sp-domain" key={k}>
              {i.logo ? <img src={i.logo} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                : <span className="sp-domain-ph"><GraduationCap size={15} /></span>}
              <div className="sp-kv-body">
                <span className="sp-domain-name">{i.name}</span>
                <label>
                  {[i.batch && `Batch ${i.batch}`, i.paid_at && `paid ${fullStamp(i.paid_at).split(',')[0]}`]
                    .filter(Boolean).join(' · ')}
                </label>
              </div>
              <CopyBtn value={i.name} label="Domain" />
            </div>
          ))}
        </div>
      )}

      {(s.courses || []).length > 0 && (
        <>
          <div className="sp-side-title"><BookOpen size={14} /> LMS courses</div>
          <div className="sp-chips">
            {s.courses.map(c => (
              <span key={c.id} className={`sp-chip${c.status === 'revoked' ? ' muted' : ''}`} title={c.status}>
                {c.title}
              </span>
            ))}
          </div>
        </>
      )}

      <div className="sp-side-title"><Hash size={14} /> This ticket</div>
      <div className="sp-facts">
        <div><label>Status</label><span className={`lms-pill ${b.tone}`}>{b.label}</span></div>
        <div><label>About</label><span>{t.topic_label}</span></div>
        {t.course_title && <div><label>Course</label><span>{t.course_title}</span></div>}
        <div><label>Raised</label><span>{fullStamp(t.created_at)}</span></div>
        <div><label>Messages</label><span>{t.messages}</span></div>
        <div>
          <label>Ticket ID</label>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            #{t.id} <CopyBtn value={`#${t.id}`} label="Ticket ID" />
          </span>
        </div>
      </div>

      {history.length > 0 && (
        <>
          <div className="sp-side-title"><Clock size={14} /> Earlier tickets</div>
          <div className="sp-history">
            {history.map(h => (
              <button key={h.id} type="button" className="sp-history-item" onClick={() => onOpenTicket(h.id)}>
                <span className="sp-history-subj">#{h.id} · {h.subject}</span>
                <span className={`lms-pill ${BUCKET[bucketOf(h.status)].tone}`}>{BUCKET[bucketOf(h.status)].label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
export default function SupportChat({ ticketId, author, onClose, onChanged, onOpenTicket, onDelete }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [files, setFiles] = useState([]);           // [{ file, url }]
  const [sending, setSending] = useState(false);
  const [moving, setMoving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [prompt, setPrompt] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [maxed, setMaxed] = useState(false);
  const [width, setWidth] = useState(() => {
    try { return Number(localStorage.getItem(WIDTH_KEY)) || 1120; } catch { return 1120; }
  });
  const [panelW, setPanelW] = useState(1120);
  const [infoOpen, setInfoOpen] = useState(false);
  const [atBottom, setAtBottom] = useState(true);

  const panelRef = useRef(null);
  const threadRef = useRef(null);
  const stickRef = useRef(true);
  const fileInput = useRef(null);
  const textRef = useRef(null);

  /* ── load ──────────────────────────────────────────────────────────── */
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const d = await LMS.getTicket(ticketId);
      setData(d);
      return d;
    } catch (e) {
      toast.error(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    setData(null);
    setReply('');
    setFiles(fs => { fs.forEach(f => f.url && URL.revokeObjectURL(f.url)); return []; });
    setPrompt(false);
    stickRef.current = true;
    load();
  }, [load]);

  /* Free the object URLs made for the chips' thumbnails — one at a time as
     chips are removed, and whatever is left when the panel goes away. */
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => () => filesRef.current.forEach(f => f.url && URL.revokeObjectURL(f.url)), []);
  const clearFiles = () => { files.forEach(f => f.url && URL.revokeObjectURL(f.url)); setFiles([]); };

  /* ── the page underneath does not scroll; Escape closes ───────────── */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const { body } = document;
    const prev = body.style.overflow;
    body.style.overflow = 'hidden';
    /* A confirm dialog on top gets the Escape, not this panel. */
    const h = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('.lms-modal')) closeRef.current();
    };
    window.addEventListener('keydown', h);
    return () => { body.style.overflow = prev; window.removeEventListener('keydown', h); };
  }, []);

  /* ── how wide the panel really is decides where the student panel goes */
  useEffect(() => {
    const el = panelRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setPanelW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const wide = panelW >= 940;

  /* ── bottom-first ──────────────────────────────────────────────────── */
  const toBottom = useCallback((smooth = false) => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useLayoutEffect(() => {
    if (data?.messages && stickRef.current) toBottom();
  }, [data?.messages, toBottom]);

  /* An image or video that finishes loading grows the thread after the
     first scroll — follow it down, unless the admin scrolled up to read. */
  const onMediaLoad = useCallback(() => { if (stickRef.current) toBottom(); }, [toBottom]);

  const onScroll = () => {
    const el = threadRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickRef.current = near;
    setAtBottom(near);
  };

  /* ── resizing ──────────────────────────────────────────────────────── */
  const startDrag = (e) => {
    e.preventDefault();
    const move = (ev) => {
      const x = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const w = Math.min(window.innerWidth, Math.max(520, window.innerWidth - x));
      setWidth(w);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
      document.body.classList.remove('sp-resizing');
      setWidth(w => { try { localStorage.setItem(WIDTH_KEY, String(Math.round(w))); } catch { /* private mode */ } return w; });
    };
    document.body.classList.add('sp-resizing');
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move);
    window.addEventListener('touchend', up);
  };

  /* ── files ─────────────────────────────────────────────────────────── */
  const addFiles = (list) => {
    const incoming = Array.from(list || []);
    if (!incoming.length) return;
    const next = [...files];
    for (const f of incoming) {
      const bad = checkFile(f);
      if (bad) { toast.error(bad); continue; }
      if (next.length >= MAX_FILES) { toast.error(`At most ${MAX_FILES} files per reply`); break; }
      next.push({ file: f, url: fileKind(f.name, f.type) === 'image' ? URL.createObjectURL(f) : '' });
    }
    setFiles(next);
  };
  const removeFile = (i) => {
    if (files[i]?.url) URL.revokeObjectURL(files[i].url);
    setFiles(fs => fs.filter((_, k) => k !== i));
  };

  const onPaste = (e) => {
    const pasted = Array.from(e.clipboardData?.files || []);
    if (pasted.length) {
      e.preventDefault();
      /* A pasted screenshot arrives as "image.png" — give it a real name. */
      addFiles(pasted.map(f => (f.name === 'image.png'
        ? new File([f], `screenshot-${Date.now()}.png`, { type: f.type }) : f)));
    }
  };

  /* ── send / move ───────────────────────────────────────────────────── */
  const send = async () => {
    const body = reply.trim();
    if (!body && !files.length) return toast.error('Type a reply or attach a file');
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('ticket_id', String(ticketId));
      fd.append('body', body);
      fd.append('author', author || 'Support team');
      files.forEach(f => fd.append('files[]', f.file));
      await LMS.replyTicket(fd);
      setReply('');
      clearFiles();
      stickRef.current = true;
      const d = await load(true);
      onChanged?.();
      if (d?.ticket && d.ticket.status !== 'closed') setPrompt(true);
      else toast.success('Reply sent');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const move = async (status, msg) => {
    setMoving(true);
    setPrompt(false);
    try {
      await LMS.setTicketStatus(ticketId, status);
      toast.success(msg);
      /* Header, side panel and the queue behind all move at once — the
         re-reads that follow only confirm what is already on screen. */
      setData(d => (d ? { ...d, ticket: { ...d.ticket, status, reopened: false } } : d));
      onChanged?.({ id: ticketId, status });
      load(true);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setMoving(false);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (!sending) send(); }
  };

  /* Grow the textarea with its content, up to a limit. */
  useLayoutEffect(() => {
    const ta = textRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 220)}px`;
  }, [reply]);

  /* Day separators between messages. */
  const rows = useMemo(() => {
    const out = [];
    let last = '';
    (data?.messages || []).forEach(m => {
      const d = dayLabel(m.created_at);
      if (d !== last) { out.push({ sep: d, key: `sep-${m.id}` }); last = d; }
      out.push({ m, key: m.id });
    });
    return out;
  }, [data?.messages]);

  const t = data?.ticket;
  const bucket = t ? bucketOf(t.status) : 'open';
  const panelStyle = maxed ? { width: '100vw' } : { width: `min(${Math.round(width)}px, 100vw)` };

  return (
    <>
      <div className="sp-backdrop" onClick={onClose} />
      <aside ref={panelRef} className={`sp-panel${maxed ? ' maxed' : ''}`} style={panelStyle}
        role="dialog" aria-modal="true" aria-label={t?.subject || 'Ticket'}>
        {!maxed && <div className="sp-grip" onMouseDown={startDrag} onTouchStart={startDrag} title="Drag to resize" />}

        {prompt && t && (
          <ClosePrompt
            name={t.name}
            onDismiss={() => setPrompt(false)}
            onCloseTicket={() => move('closed', 'Ticket closed')}
            onPending={() => move('pending', 'Moved to Pending')}
          />
        )}

        {/* ── header ─────────────────────────────────────────────────── */}
        <header className="sp-head">
          <div className="sp-head-main">
            <div className="sp-head-title">
              <span className="sp-head-subj" title={t?.subject}>{t?.subject || 'Loading…'}</span>
              {t && <span className={`lms-pill ${BUCKET[bucket].tone}`}>{BUCKET[bucket].label}</span>}
            </div>
            {t && (
              <div className="sp-head-sub">
                #{t.id} · {t.name || t.email || `user #${t.user_id}`} · {t.topic_label}
                {t.course_title ? ` · ${t.course_title}` : ''}
              </div>
            )}
          </div>

          {t && (
            <div className="sp-head-actions">
              {bucket !== 'pending' && bucket !== 'closed' && (
                <button type="button" className="lms-btn lms-btn-ghost sp-btn-sm" disabled={moving}
                  onClick={() => move('pending', 'Moved to Pending')} title="Hold this ticket in Pending">
                  <PauseCircle size={15} /> <span className="sp-hide-sm">Pending</span>
                </button>
              )}
              {bucket !== 'open' && (
                <button type="button" className="lms-btn lms-btn-ghost sp-btn-sm" disabled={moving}
                  onClick={() => move('open', 'Moved to Opened')}>
                  <RotateCcw size={15} /> <span className="sp-hide-sm">{bucket === 'closed' ? 'Reopen' : 'Move to Opened'}</span>
                </button>
              )}
              {bucket !== 'closed' && (
                <button type="button" className="lms-btn lms-btn-dark sp-btn-sm" disabled={moving}
                  onClick={() => move('closed', 'Ticket closed')}>
                  <CheckCircle2 size={15} /> <span className="sp-hide-sm">Close ticket</span>
                </button>
              )}
              <span className="sp-head-sep" />
              <button type="button" className="lms-icon-btn danger" title="Delete this ticket" onClick={() => onDelete?.(t)}>
                <Trash2 size={16} />
              </button>
              {!wide && (
                <button type="button" className={`lms-icon-btn${infoOpen ? ' sp-on' : ''}`} title="Student details"
                  onClick={() => setInfoOpen(v => !v)}>
                  <Info size={17} />
                </button>
              )}
              <button type="button" className="lms-icon-btn sp-hide-xs" title={maxed ? 'Restore size' : 'Full screen'}
                onClick={() => setMaxed(v => !v)}>
                {maxed ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button type="button" className="lms-icon-btn" title="Close (Esc)" onClick={onClose}><X size={18} /></button>
            </div>
          )}
          {!t && <button type="button" className="lms-icon-btn" onClick={onClose}><X size={18} /></button>}
        </header>

        {/* ── body ───────────────────────────────────────────────────── */}
        <div className="sp-body">
          <section
            className={`sp-chat${dragging ? ' dragging' : ''}`}
            onDragOver={(e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDragging(true); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          >
            <div className="sp-thread" ref={threadRef} onScroll={onScroll}>
              {loading && !data ? (
                <div className="sp-thread-loading"><span className="sp-spinner" /> Loading conversation…</div>
              ) : rows.length === 0 ? (
                <div className="sp-thread-loading"><MessageSquare size={18} /> No messages yet</div>
              ) : rows.map(r => (r.sep
                ? <div key={r.key} className="sp-day"><span>{r.sep}</span></div>
                : <Bubble key={r.key} m={r.m} onPreview={setPreview} onMediaLoad={onMediaLoad} />))}
            </div>

            {!atBottom && (
              <button type="button" className="sp-jump" onClick={() => { stickRef.current = true; toBottom(true); }}>
                <ChevronDown size={15} /> Latest
              </button>
            )}

            {dragging && (
              <div className="sp-drop"><UploadCloud size={30} /><strong>Drop files to attach</strong>
                <span>Up to {MAX_FILES} files · 25 MB each</span></div>
            )}

            {/* ── composer ─────────────────────────────────────────── */}
            <div className="sp-composer">
              {t?.status === 'closed' && (
                <div className="sp-composer-note">This ticket is closed. Replying moves it back to Opened.</div>
              )}
              {files.length > 0 && (
                <div className="sp-files">
                  {files.map((f, i) => (
                    <div className="sp-file" key={`${f.file.name}-${i}`}>
                      {f.url ? <img src={f.url} alt="" /> : <span className="sp-file-ico"><KindIcon name={f.file.name} type={f.file.type} size={16} /></span>}
                      <div className="sp-file-meta">
                        <span className="sp-file-name" title={f.file.name}>{f.file.name}</span>
                        <span className="sp-file-size">{fileSize(f.file.size)}</span>
                      </div>
                      <button type="button" className="sp-file-x" onClick={() => removeFile(i)} title="Remove"><X size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="sp-compose-box">
                <button type="button" className="sp-attach" title="Attach files (or drag & drop / paste)"
                  onClick={() => fileInput.current?.click()} disabled={sending}>
                  <Paperclip size={18} />
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  hidden
                  accept={OK_EXT.map(e => `.${e}`).join(',')}
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
                />
                <textarea
                  ref={textRef}
                  className="sp-input"
                  rows={1}
                  value={reply}
                  maxLength={6000}
                  placeholder={t ? `Reply to ${t.name || 'the learner'}… (links become clickable)` : 'Reply…'}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={onKey}
                  onPaste={onPaste}
                  disabled={!t}
                />
                <button type="button" className="lms-btn lms-btn-green sp-send"
                  disabled={sending || !t || (!reply.trim() && !files.length)} onClick={send}>
                  <Send size={15} /> <span className="sp-hide-xs">{sending ? 'Sending…' : 'Send reply'}</span>
                </button>
              </div>
              <div className="sp-compose-hint">
                <span>Ctrl + Enter to send · paste or drop screenshots, PDFs, sheets, videos, zips</span>
                <span>The learner sees this in their portal thread</span>
              </div>
            </div>
          </section>

          {data && (wide || infoOpen) && (
            <aside className={`sp-side${wide ? '' : ' floating'}`}>
              {!wide && (
                <button type="button" className="lms-icon-btn sp-side-x" onClick={() => setInfoOpen(false)}><X size={16} /></button>
              )}
              <StudentPanel data={data} onOpenTicket={onOpenTicket} />
            </aside>
          )}
        </div>
      </aside>

      <FilePreview key={preview?.file_url || 'none'} file={preview} onClose={() => setPreview(null)} />
    </>
  );
}
