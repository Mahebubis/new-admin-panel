// ===========================================================================
//  Support.jsx — "/support", the learner's help desk.
//
//  One screen, three states:
//    list      every ticket this learner has raised, newest activity first
//    compose   raise a new one
//    thread    the conversation, their messages and ours
//
//  On a wide screen the list sits beside whatever is open. On a phone only ONE
//  of the two is ever mounted — a 320px-wide master/detail split is unusable,
//  and the list is what you go back to, so it behaves like a back button.
//
//  The form
//    A pre-set query is picked from a list (served by support.php, so the
//    server validates against the same list it hands out) which also titles
//    the ticket. Describing the problem is REQUIRED; the attachment is
//    OPTIONAL — a ticket that is nothing but a screenshot cannot be triaged.
//    Images and PDFs only, 5 MB, and both limits are checked here as well as
//    on the server so nobody waits for an upload that was always going to be
//    refused.
//
//  Replies come from an admin in the LMS panel and land in this same thread,
//  which is why a ticket carries an unread count rather than a "read" flag:
//  the learner needs to see that something new arrived from the list, before
//  opening anything.
// ===========================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, PageLoader } from '../components/Layout';
import {
  Attachment, Check, ChevronLeft, Download, Pdf, Send, Support as SupportIcon, Ticket, Trash, Upload,
} from '../components/icons';
import './support.css';

const MAX_BYTES = 5 * 1024 * 1024;
const OK_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf'];

const extOf = (name = '') => String(name).split('.').pop().toLowerCase();
const isImage = (name = '', type = '') =>
  String(type).startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extOf(name));

function size(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** "24 Aug, 10:51" — a support thread is read in hours, not dates. */
function when(d) {
  if (!d) return '';
  const t = new Date(String(d).replace(' ', 'T'));
  const today = new Date();
  const sameDay = t.toDateString() === today.toDateString();
  return t.toLocaleString('en-IN', sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABEL = { open: 'Awaiting reply', answered: 'Replied', closed: 'Closed' };

/** The one place a chosen file is judged, so compose and reply agree. */
function checkFile(f) {
  if (!f) return '';
  if (!OK_EXT.includes(extOf(f.name))) return 'Only images (PNG, JPG, WEBP, GIF) and PDF files can be attached.';
  if (f.size > MAX_BYTES) return `That file is ${size(f.size)} — the limit is 5 MB.`;
  if (f.size <= 0) return 'That file is empty.';
  return '';
}

/* ── the attachment picker, shared by the form and the reply box ────────── */
function FilePick({ file, onPick, onClear, id }) {
  const ref = useRef(null);
  return (
    <div className="sup-file">
      <input
        ref={ref}
        id={id}
        type="file"
        className="sup-file-input"
        accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,image/*,application/pdf"
        onChange={(e) => {
          onPick(e.target.files?.[0] || null);
          /* Cleared so that picking the SAME file again still fires change —
             otherwise a learner who removed a file cannot re-add it. */
          e.target.value = '';
        }}
      />
      {file ? (
        <div className="sup-file-chip">
          <span className="sup-file-ico">
            {isImage(file.name, file.type) ? <Attachment size={15} /> : <Pdf size={15} />}
          </span>
          <span className="sup-file-name">{file.name}</span>
          <span className="sup-file-size">{size(file.size)}</span>
          <button type="button" className="sup-file-x" onClick={onClear} aria-label="Remove this file">
            <Trash size={15} />
          </button>
        </div>
      ) : (
        <button type="button" className="sup-file-btn" onClick={() => ref.current?.click()}>
          <Upload size={16} />
          <span>Attach a screenshot or PDF</span>
          <em>optional · max 5 MB</em>
        </button>
      )}
    </div>
  );
}

/* ── one message bubble ────────────────────────────────────────────────── */
function Message({ m }) {
  const mine = m.sender === 'learner';
  return (
    <div className={`sup-msg${mine ? ' sup-mine' : ''}`}>
      <div className="sup-bubble">
        <div className="sup-msg-head">
          <strong>{mine ? 'You' : (m.author || 'Support team')}</strong>
          <span>{when(m.created_at)}</span>
        </div>
        {m.body && <p className="sup-msg-body">{m.body}</p>}

        {m.file_url && (
          isImage(m.file_name, m.file_type) ? (
            <a className="sup-msg-img" href={m.file_url} target="_blank" rel="noreferrer">
              <img src={m.file_url} alt={m.file_name || 'attachment'} />
            </a>
          ) : (
            <a className="sup-msg-doc" href={m.file_url} target="_blank" rel="noreferrer">
              <Pdf size={18} />
              <span className="sup-msg-doc-name">{m.file_name || 'Attachment'}</span>
              {m.file_size > 0 && <span className="sup-msg-doc-size">{size(m.file_size)}</span>}
              <Download size={16} />
            </a>
          )
        )}
      </div>
    </div>
  );
}

export default function Support() {
  const [booting, setBooting] = useState(true);
  const [topics, setTopics] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [courses, setCourses] = useState([]);
  const [flash, setFlash] = useState('');

  /* Which pane is showing. `openId` of 0 with composing false is the list. */
  const [openId, setOpenId] = useState(0);
  const [composing, setComposing] = useState(false);
  const [thread, setThread] = useState(null);
  const [threadBusy, setThreadBusy] = useState(false);

  /* compose */
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const [courseId, setCourseId] = useState('');
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);

  /* reply */
  const [reply, setReply] = useState('');
  const [replyFile, setReplyFile] = useState(null);
  const [replyErr, setReplyErr] = useState('');
  const [replying, setReplying] = useState(false);

  const endRef = useRef(null);

  const say = useCallback((m) => {
    setFlash(m);
    setTimeout(() => setFlash(''), 3600);
  }, []);

  /* ── first load ───────────────────────────────────────────────────────── */
  useEffect(() => {
    let alive = true;
    Promise.all([
      api.supportTopics().catch(() => ({ topics: [] })),
      api.supportList().catch(() => ({ tickets: [] })),
      /* Naming the course is optional, so a failure here must not stop the
         desk from working — the dropdown simply does not appear. */
      api.enrollments().catch(() => ({ enrollments: [] })),
    ]).then(([t, l, e]) => {
      if (!alive) return;
      setTopics(t.topics || []);
      setTickets(l.tickets || []);
      setCourses((e.enrollments || []).map((r) => ({ id: r.course_id, title: r.title })));
      setBooting(false);
    });
    return () => { alive = false; };
  }, []);

  const refreshList = useCallback(async () => {
    try {
      const d = await api.supportList();
      setTickets(d.tickets || []);
    } catch { /* the list on screen is still the last good one */ }
  }, []);

  /* ── open a thread ────────────────────────────────────────────────────── */
  const openTicket = useCallback(async (id) => {
    setComposing(false);
    setOpenId(id);
    setThread(null);
    setThreadBusy(true);
    setReply('');
    setReplyFile(null);
    setReplyErr('');
    try {
      const d = await api.supportTicket(id);
      setThread(d);
      /* Opening it cleared the unread count on the server; mirror that here
         rather than refetching the whole list for one number. */
      setTickets((rows) => rows.map((r) => (r.id === id ? { ...r, unread: 0 } : r)));
    } catch (e) {
      say(e.message);
      setOpenId(0);
    } finally {
      setThreadBusy(false);
    }
  }, [say]);

  /* A new message should be the thing you are looking at. */
  useEffect(() => {
    if (thread?.messages?.length) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [thread?.messages?.length]);

  const startCompose = () => {
    setComposing(true);
    setOpenId(0);
    setThread(null);
    setErr('');
  };

  const resetCompose = () => {
    setTopic(''); setSubject(''); setBody(''); setFile(null); setCourseId(''); setErr('');
  };

  /* ── raise a ticket ───────────────────────────────────────────────────── */
  const submit = async (e) => {
    e.preventDefault();
    setErr('');

    const text = body.trim();
    if (!text) return setErr('Please describe the problem — this part is required.');
    if (text.length < 10) return setErr('Please add a little more detail — at least a sentence.');
    const bad = checkFile(file);
    if (bad) return setErr(bad);

    setSending(true);
    try {
      /* FormData either way: the endpoint reads multipart and JSON alike, and
         one path through this function is one thing that can go wrong. */
      const fd = new FormData();
      fd.append('topic', topic || 'other');
      fd.append('subject', subject.trim());
      fd.append('body', text);
      fd.append('course_id', courseId || '0');
      if (file) fd.append('file', file);

      const d = await api.supportCreate(fd);
      resetCompose();
      await refreshList();
      say('Your ticket has been raised — our reply will appear here.');
      if (d?.ticket_id) openTicket(d.ticket_id);
      else setComposing(false);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSending(false);
    }
  };

  /* ── add to a thread ──────────────────────────────────────────────────── */
  const sendReply = async (e) => {
    e.preventDefault();
    setReplyErr('');

    const text = reply.trim();
    if (!text) return setReplyErr('Type a message first.');
    const bad = checkFile(replyFile);
    if (bad) return setReplyErr(bad);

    setReplying(true);
    try {
      const fd = new FormData();
      fd.append('ticket_id', String(openId));
      fd.append('body', text);
      if (replyFile) fd.append('file', replyFile);

      await api.supportReply(fd);
      setReply('');
      setReplyFile(null);
      const d = await api.supportTicket(openId);
      setThread(d);
      refreshList();
    } catch (e2) {
      setReplyErr(e2.message);
    } finally {
      setReplying(false);
    }
  };

  const closeTicket = async () => {
    try {
      await api.supportClose(openId);
      const d = await api.supportTicket(openId);
      setThread(d);
      refreshList();
      say('Ticket closed — writing again will reopen it.');
    } catch (e) { say(e.message); }
  };

  const unread = useMemo(() => tickets.reduce((a, t) => a + (t.unread || 0), 0), [tickets]);
  /* Which pane a phone should be showing. */
  const detail = composing || openId > 0;

  if (booting) return <PageLoader label="Opening your support desk…" />;

  return (
    <section className={`sup${detail ? ' sup-detail' : ''}`}>
      <div className="sup-head">
        <div className="sup-head-text">
          <h1 className="h1 sup-h1">Support</h1>
          <p className="muted sup-head-sub">
            Something not playing, a course missing, a certificate late? Raise it here and the reply
            arrives in this same thread.
          </p>
        </div>
        <button type="button" className="btn btn-dark sup-new" onClick={startCompose}>
          <Ticket size={16} /> Raise a ticket
        </button>
      </div>

      <div className="sup-grid">
        {/* ── the list ─────────────────────────────────────────────────── */}
        <aside className="sup-list">
          <div className="sup-list-head">
            <span>Your tickets</span>
            {unread > 0 && <b className="sup-badge">{unread} new</b>}
          </div>

          {tickets.length === 0 ? (
            <div className="sup-list-empty">
              <SupportIcon size={26} />
              <p>No tickets yet</p>
              <span>When something goes wrong, raise it here — you will get a reply in this screen.</span>
            </div>
          ) : (
            <ul className="sup-items">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`sup-item${t.id === openId ? ' on' : ''}`}
                    onClick={() => openTicket(t.id)}
                  >
                    <div className="sup-item-top">
                      <span className="sup-item-subject">{t.subject}</span>
                      {t.unread > 0 && <i className="sup-dot" aria-label={`${t.unread} new replies`} />}
                    </div>
                    {t.preview && <p className="sup-item-preview">{t.preview}</p>}
                    <div className="sup-item-meta">
                      <span className={`sup-status sup-${t.status}`}>{STATUS_LABEL[t.status] || t.status}</span>
                      <span>#{t.id}</span>
                      <span>{when(t.last_message_at || t.created_at)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* ── the right pane ───────────────────────────────────────────── */}
        <div className="sup-pane">
          {/* compose */}
          {composing && (
            <form className="sup-card" onSubmit={submit}>
              <div className="sup-pane-head">
                <button type="button" className="sup-back" onClick={() => setComposing(false)}>
                  <ChevronLeft size={18} /><span>Back</span>
                </button>
                <h2 className="sup-pane-title">Raise a ticket</h2>
              </div>

              <div className="sup-body">
                <label className="sup-label">What is it about?</label>
                <div className="sup-topics">
                  {topics.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      className={`sup-topic${topic === t.key ? ' on' : ''}`}
                      onClick={() => setTopic(topic === t.key ? '' : t.key)}
                    >
                      {topic === t.key && <Check size={14} />}
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="sup-help">
                  Picking one titles the ticket for you. Not sure? Leave them all alone and just
                  describe it below.
                </p>

                {courses.length > 0 && (
                  <>
                    <label className="sup-label" htmlFor="sup-course">Which course? <em>optional</em></label>
                    <select
                      id="sup-course"
                      className="field sup-select"
                      value={courseId}
                      onChange={(e) => setCourseId(e.target.value)}
                    >
                      <option value="">Not about a particular course</option>
                      {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </>
                )}

                <label className="sup-label" htmlFor="sup-subject">Subject <em>optional</em></label>
                <input
                  id="sup-subject"
                  className="field"
                  value={subject}
                  maxLength={190}
                  placeholder={topics.find((t) => t.key === topic)?.label || 'A one-line summary'}
                  onChange={(e) => setSubject(e.target.value)}
                />

                <label className="sup-label" htmlFor="sup-body">
                  Describe the problem <b className="sup-req">required</b>
                </label>
                <textarea
                  id="sup-body"
                  className="field sup-textarea"
                  value={body}
                  maxLength={4000}
                  rows={7}
                  placeholder="What were you doing, what happened, and what did you expect instead? The lesson name and any error message help us most."
                  onChange={(e) => setBody(e.target.value)}
                />
                <div className="sup-count">{body.length} / 4000</div>

                <FilePick id="sup-file-new" file={file} onPick={setFile} onClear={() => setFile(null)} />

                {err && <p className="sup-err" role="alert">{err}</p>}
              </div>

              <div className="sup-foot">
                <button type="button" className="btn btn-outline" onClick={() => { resetCompose(); setComposing(false); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-brand" disabled={sending || !body.trim()}>
                  <Send size={16} /> {sending ? 'Sending…' : 'Send ticket'}
                </button>
              </div>
            </form>
          )}

          {/* thread */}
          {!composing && openId > 0 && (
            <div className="sup-card">
              <div className="sup-pane-head">
                <button type="button" className="sup-back" onClick={() => { setOpenId(0); setThread(null); }}>
                  <ChevronLeft size={18} /><span>Back</span>
                </button>
                <div className="sup-pane-heading">
                  <h2 className="sup-pane-title">{thread?.ticket?.subject || 'Ticket'}</h2>
                  {thread?.ticket && (
                    <div className="sup-pane-meta">
                      <span className={`sup-status sup-${thread.ticket.status}`}>
                        {STATUS_LABEL[thread.ticket.status] || thread.ticket.status}
                      </span>
                      <span>#{thread.ticket.id}</span>
                      {thread.ticket.course_title && <span>{thread.ticket.course_title}</span>}
                      <span>raised {when(thread.ticket.created_at)}</span>
                    </div>
                  )}
                </div>
                {thread?.ticket?.status !== 'closed' && thread?.ticket && (
                  <button type="button" className="sup-close-btn" onClick={closeTicket}>
                    <Check size={15} /><span>Mark resolved</span>
                  </button>
                )}
              </div>

              {threadBusy && !thread ? (
                <div className="sup-body"><p className="muted">Loading the conversation…</p></div>
              ) : (
                <>
                  <div className="sup-thread">
                    {(thread?.messages || []).map((m) => <Message key={m.id} m={m} />)}
                    {thread?.messages?.length === 1 && (
                      <p className="sup-waiting">
                        We have your ticket. A reply lands right here — you do not need to email anyone.
                      </p>
                    )}
                    <div ref={endRef} />
                  </div>

                  <form className="sup-reply" onSubmit={sendReply}>
                    <textarea
                      className="field sup-reply-text"
                      rows={2}
                      maxLength={4000}
                      value={reply}
                      placeholder="Add to this ticket…"
                      onChange={(e) => setReply(e.target.value)}
                    />
                    <div className="sup-reply-row">
                      <FilePick
                        id="sup-file-reply"
                        file={replyFile}
                        onPick={setReplyFile}
                        onClear={() => setReplyFile(null)}
                      />
                      <button type="submit" className="btn btn-brand sup-send" disabled={replying || !reply.trim()}>
                        <Send size={16} /> {replying ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                    {replyErr && <p className="sup-err" role="alert">{replyErr}</p>}
                  </form>
                </>
              )}
            </div>
          )}

          {/* nothing open — desktop only, the phone shows the list instead */}
          {!composing && openId === 0 && (
            <div className="sup-idle">
              <EmptyState
                title={tickets.length ? 'Pick a ticket to read it' : 'Nothing open'}
                message={tickets.length
                  ? 'Your conversation and our replies appear here.'
                  : 'Raise a ticket and the whole conversation stays on this screen.'}
                action={<button type="button" className="btn btn-dark" onClick={startCompose}>
                  <Ticket size={16} /> Raise a ticket
                </button>}
              />
            </div>
          )}
        </div>
      </div>

      {flash && <div className="sup-flash" role="status">{flash}</div>}
    </section>
  );
}
