// ===========================================================================
//  LmsSupport.jsx — the "Support" tab.
//
//  The admin end of the learner portal's help desk. A learner raises a ticket
//  at training.internshipstudio.com/support; it appears here, and the reply
//  written in this drawer lands in the thread they are already watching —
//  nothing is emailed, and there is no second inbox to keep in step.
//
//  The queue is ordered by "somebody is waiting" rather than by date:
//  ?resource=support&action=list sorts admin_unread first, so a ticket that
//  has been answered and then written into again comes back to the top instead
//  of sinking under newer noise. The default filter is Waiting for us for the
//  same reason — an admin opening this tab wants the work, not the archive.
//
//  Attachments are one-way: the portal lets a learner attach a screenshot or a
//  PDF, and they render inline here. The reply is text — an admin who needs to
//  send a file has better channels for it than a support thread.
// ===========================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  LifeBuoy, Search, Send, Paperclip, ExternalLink, Trash2, CheckCircle2,
  Clock, MessageSquare, RotateCcw,
} from 'lucide-react';
import { LMS, shortDate } from './lmsApi';
import { useAuth } from '../../hooks/useAuth';
import { Loader, Empty, Drawer, Confirm, Pill } from './LmsStyles';

/* "Waiting for us" is first and selected by default: it is the only one of
   these that is a to-do list. */
const FILTERS = [
  { key: 'unanswered', label: 'Waiting for us' },
  { key: 'open', label: 'Open' },
  { key: 'answered', label: 'Answered' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
];

const STATUS_TONE = { open: 'amber', answered: 'green', closed: 'grey' };
const STATUS_LABEL = { open: 'Open', answered: 'Answered', closed: 'Closed' };

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const isImage = (name = '', type = '') =>
  String(type).startsWith('image/') ||
  IMAGE_EXT.includes(String(name).split('.').pop().toLowerCase());

function size(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** A support thread is worked in hours, so the clock matters as much as the date. */
const stamp = (d) => (d
  ? new Date(String(d).replace(' ', 'T')).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  : '—');

/* ── one message in the thread ─────────────────────────────────────────── */
function Message({ m }) {
  const fromUs = m.sender === 'admin';
  return (
    <div style={{
      display: 'flex',
      justifyContent: fromUs ? 'flex-end' : 'flex-start',
      marginBottom: 12,
    }}>
      <div style={{
        maxWidth: '84%',
        padding: '10px 13px',
        borderRadius: 10,
        border: '1px solid var(--lms-border)',
        /* Our replies on the tinted surface, the learner's on plain — the
           reverse of what the learner sees, because on both screens "mine" is
           the tinted one. */
        background: fromUs ? 'var(--lms-green-soft)' : 'var(--lms-bg)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', gap: 14,
          alignItems: 'baseline', marginBottom: 4,
        }}>
          <strong style={{ fontSize: 12.5 }}>{fromUs ? (m.author || 'Support team') : (m.author || 'Learner')}</strong>
          <span style={{ fontSize: 11, color: 'var(--lms-text-3)' }}>{stamp(m.created_at)}</span>
        </div>

        {m.body && (
          <p style={{
            margin: 0, fontSize: 13.5, lineHeight: 1.6,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>{m.body}</p>
        )}

        {m.file_url && (
          isImage(m.file_name, m.file_type) ? (
            <a href={m.file_url} target="_blank" rel="noreferrer"
              style={{ display: 'block', marginTop: 9 }}>
              <img
                src={m.file_url}
                alt={m.file_name || 'attachment'}
                style={{
                  display: 'block', maxWidth: '100%', maxHeight: 260,
                  borderRadius: 8, border: '1px solid var(--lms-border)',
                }}
              />
            </a>
          ) : (
            <a href={m.file_url} target="_blank" rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 8, marginTop: 9,
                padding: '8px 10px', borderRadius: 8,
                border: '1px solid var(--lms-border)', background: 'var(--lms-bg)',
                fontSize: 12.5, color: 'var(--lms-text)',
              }}>
              <Paperclip size={14} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.file_name || 'Attachment'}
              </span>
              {m.file_size > 0 && <span style={{ color: 'var(--lms-text-3)' }}>{size(m.file_size)}</span>}
              <ExternalLink size={13} />
            </a>
          )
        )}
      </div>
    </div>
  );
}

export default function LmsSupport() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [counts, setCounts] = useState({});
  const [filter, setFilter] = useState('unanswered');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('');
  const [courses, setCourses] = useState([]);

  const [open, setOpen] = useState(null);      // { ticket, messages, history }
  const [opening, setOpening] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await LMS.listTickets({ status: filter, q: search, course_id: courseId });
      setTickets(d.tickets || []);
      setCounts(d.counts || {});
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter, search, courseId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    LMS.listCourses({ status: 'all' }).then(d => setCourses(d.courses || [])).catch(() => {});
  }, []);

  /* Typing filters on the server, so it waits for the typing to stop. */
  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const openTicket = async (id) => {
    setOpening(true);
    setReply('');
    try {
      const d = await LMS.getTicket(id);
      setOpen(d);
      /* The server just zeroed the unread counter; mirror it rather than
         reloading the whole queue for one badge. */
      setTickets(rows => rows.map(r => (r.id === id ? { ...r, unread: 0 } : r)));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setOpening(false);
    }
  };

  /** Send the reply. `close` also settles the ticket in the same round trip. */
  const send = async (close = false) => {
    const body = reply.trim();
    if (!body) return toast.error('Type a reply first');

    setSending(true);
    try {
      await LMS.replyTicket({
        ticket_id: open.ticket.id,
        body,
        /* This file's PHP has no admin session — the panel is what knows who
           is answering, and the learner sees this name on the reply. */
        author: user?.name || user?.email || 'Support team',
        close,
      });
      setReply('');
      const d = await LMS.getTicket(open.ticket.id);
      setOpen(d);
      load();
      toast.success(close ? 'Replied and closed' : 'Reply sent — the learner sees it in their portal');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (id, status) => {
    try {
      await LMS.setTicketStatus(id, status);
      toast.success(`Marked ${status}`);
      if (open?.ticket?.id === id) {
        setOpen(o => ({ ...o, ticket: { ...o.ticket, status } }));
      }
      load();
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (id) => {
    try {
      await LMS.deleteTicket(id);
      setConfirm(null);
      setOpen(null);
      toast.success('Ticket deleted');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const counters = useMemo(() => ([
    { label: 'Waiting for us', value: counts.unanswered ?? 0, icon: <Clock size={17} /> },
    { label: 'Open', value: counts.open ?? 0, icon: <LifeBuoy size={17} /> },
    { label: 'Answered', value: counts.answered ?? 0, icon: <CheckCircle2 size={17} /> },
    { label: 'Closed', value: counts.closed ?? 0, icon: <MessageSquare size={17} /> },
    { label: 'All tickets', value: counts.total ?? 0, icon: <MessageSquare size={17} /> },
  ]), [counts]);

  return (
    <div className="lms-page">
      <div className="lms-page-head">
        <div>
          <h1 className="lms-h1">Support</h1>
          <p className="lms-sub">
            Tickets raised by learners in the training portal. Your reply appears in their
            thread — they do not get an email, they see it at training.internshipstudio.com/support
          </p>
        </div>
        <button className="lms-btn lms-btn-ghost" onClick={load} disabled={loading}>
          <RotateCcw size={16} /> Refresh
        </button>
      </div>

      <div className="lms-counters">
        {counters.map(c => (
          <div className="lms-counter" key={c.label}>
            <div>
              <div className="lms-counter-label">{c.label}</div>
              <div className="lms-counter-value">{c.value}</div>
            </div>
            <span style={{ color: 'var(--lms-text-3)' }}>{c.icon}</span>
          </div>
        ))}
      </div>

      <div className="lms-toolbar">
        <div className="lms-segment">
          {FILTERS.map(f => (
            <button key={f.key} className={filter === f.key ? 'active' : ''} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="lms-search">
          <Search size={16} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search subject, learner, email, or ticket #"
          />
        </div>

        <select className="lms-select" style={{ width: 230 }} value={courseId}
          onChange={e => setCourseId(e.target.value)}>
          <option value="">All courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>

      <div className="lms-table-wrap">
        {loading ? <Loader inline /> : tickets.length === 0 ? (
          <Empty
            icon={<LifeBuoy size={24} />}
            title={filter === 'unanswered' ? 'Nothing waiting for a reply' : 'No tickets here'}
            message={filter === 'unanswered'
              ? 'Every ticket has been answered. Switch to All to see the archive.'
              : 'Learners raise tickets from the Support screen in the training portal — they land here the moment they are sent.'}
          />
        ) : (
          <div className="lms-table-scroll">
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Ticket</th><th>Learner</th><th>About</th><th>Course</th>
                  <th>Status</th><th>Messages</th><th>Last activity</th><th />
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => (
                  <tr
                    key={t.id}
                    onClick={() => openTicket(t.id)}
                    style={{ cursor: 'pointer', fontWeight: t.unread > 0 ? 500 : 400 }}
                  >
                    <td style={{ maxWidth: 260 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* The dot is the whole reason this queue is readable at
                            a glance: it marks a learner still waiting. */}
                        {t.unread > 0 && (
                          <span
                            title={`${t.unread} unread from the learner`}
                            style={{
                              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                              background: 'var(--lms-green-dark)',
                            }}
                          />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.subject}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--lms-text-3)' }}>#{t.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="lms-user-cell">
                        <div className="lms-avatar">{(t.name || t.email || '?').charAt(0)}</div>
                        <div>
                          <div className="lms-user-name">{t.name || '—'}</div>
                          <div className="lms-user-mail">{t.email || `user #${t.user_id}`}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ maxWidth: 210, fontSize: 12.5, color: 'var(--lms-text-2)' }}>{t.topic_label}</td>
                    <td style={{ fontSize: 12.5 }}>{t.course_title || '—'}</td>
                    <td><Pill tone={STATUS_TONE[t.status] || 'grey'}>{STATUS_LABEL[t.status] || t.status}</Pill></td>
                    <td>{t.messages}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>{stamp(t.last_message_at || t.created_at)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="lms-icon-btn"
                        title="Delete this ticket"
                        onClick={(e) => { e.stopPropagation(); setConfirm(t); }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── the thread ─────────────────────────────────────────────────── */}
      <Drawer
        open={!!open}
        width={620}
        title={open?.ticket?.subject || 'Ticket'}
        subtitle={open?.ticket
          ? `#${open.ticket.id} · ${open.ticket.name || open.ticket.email || `user #${open.ticket.user_id}`}`
          : ''}
        onClose={() => { setOpen(null); setReply(''); }}
        footer={open?.ticket && (
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}>
            {open.ticket.status !== 'closed' ? (
              <button className="lms-btn lms-btn-quiet" disabled={sending}
                onClick={() => setStatus(open.ticket.id, 'closed')}>
                Close without replying
              </button>
            ) : (
              <button className="lms-btn lms-btn-quiet" disabled={sending}
                onClick={() => setStatus(open.ticket.id, 'open')}>
                Reopen
              </button>
            )}
            <button className="lms-btn lms-btn-ghost" disabled={sending || !reply.trim()}
              onClick={() => send(true)}>
              Reply &amp; close
            </button>
            <button className="lms-btn lms-btn-green" disabled={sending || !reply.trim()}
              onClick={() => send(false)}>
              <Send size={15} /> {sending ? 'Sending…' : 'Send reply'}
            </button>
          </div>
        )}
      >
        {opening && !open ? <Loader inline /> : open && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <Pill tone={STATUS_TONE[open.ticket.status] || 'grey'}>
                {STATUS_LABEL[open.ticket.status] || open.ticket.status}
              </Pill>
              <Pill tone="grey">{open.ticket.topic_label}</Pill>
              {open.ticket.course_title && <Pill tone="blue">{open.ticket.course_title}</Pill>}
              <Pill tone="grey">raised {shortDate(open.ticket.created_at)}</Pill>
            </div>

            <div style={{
              maxHeight: '46vh', overflowY: 'auto', padding: 14,
              border: '1px solid var(--lms-border)', borderRadius: 10,
              background: 'var(--lms-bg-soft)', marginBottom: 16,
            }}>
              {open.messages.map(m => <Message key={m.id} m={m} />)}
            </div>

            <label className="lms-label" htmlFor="lms-support-reply">Your reply</label>
            <textarea
              id="lms-support-reply"
              className="lms-textarea"
              rows={5}
              value={reply}
              maxLength={6000}
              placeholder="Written here, this appears in the learner's own support thread in the training portal."
              onChange={e => setReply(e.target.value)}
            />
            <p className="lms-help">
              Sending marks the ticket <b>Answered</b> and puts an unread badge on their thread.
              If they write back, it returns to <b>Waiting for us</b>.
            </p>

            {open.history?.length > 0 && (
              <>
                <div className="lms-divider" style={{ margin: '18px 0 12px' }} />
                <div className="lms-label" style={{ marginBottom: 8 }}>
                  Earlier tickets from this learner
                </div>
                {open.history.map(h => (
                  <button
                    key={h.id}
                    className="lms-btn lms-btn-quiet"
                    style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginBottom: 6 }}
                    onClick={() => openTicket(h.id)}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      #{h.id} · {h.subject}
                    </span>
                    <span style={{ color: 'var(--lms-text-3)', fontSize: 11.5, flexShrink: 0 }}>
                      {STATUS_LABEL[h.status] || h.status} · {shortDate(h.created_at)}
                    </span>
                  </button>
                ))}
              </>
            )}
          </>
        )}
      </Drawer>

      <Confirm
        open={!!confirm}
        title={`Delete ticket #${confirm?.id || ''}?`}
        message="The whole conversation goes with it, on both sides. The learner will simply no longer see this thread."
        confirmLabel="Delete ticket"
        onConfirm={() => remove(confirm.id)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
