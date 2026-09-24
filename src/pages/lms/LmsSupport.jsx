// ===========================================================================
//  LmsSupport.jsx — the "Support" tab.
//
//  The admin end of the learner portal's help desk. A learner raises a ticket
//  at training.internshipstudio.com/support; it appears here, and the reply
//  written in the chat panel lands in the thread they are already watching —
//  nothing is emailed, and there is no second inbox to keep in step.
//
//  Three buckets, nothing else:
//    Opened   the learner wrote (or we replied and have not closed it)
//    Pending  we are holding it — only an admin moves a ticket in or out
//    Closed   done; if the learner writes again it comes back to Opened on
//             its own with a "Reopened" badge (see lms_api.php, SUPPORT)
//
//  Within a bucket, tickets with unread learner messages sort first and carry
//  a "N new" badge. The filters — search, course, topic, a date range on last
//  activity or on when it was raised, "only new replies / only reopened" —
//  also drive the bucket counts, so "Yesterday" shows yesterday's split.
//
//  The conversation itself is SupportChat.jsx; file previews and link
//  handling are supportFiles.jsx.
// ===========================================================================
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  LifeBuoy, Search, Trash2, CheckCircle2, PauseCircle, Inbox, RotateCcw, SlidersHorizontal, X,
  Paperclip, Layers, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { LMS } from './lmsApi';
import { useAuth } from '../../hooks/useAuth';
import { Loader, Empty, Confirm, Pill } from './LmsStyles';
import SupportChat from './SupportChat';
import { BUCKET, bucketOf, fullStamp } from './supportUtils';
import { SUPPORT_CSS } from './supportStyles';

const TABS = [
  { key: 'open', label: 'Opened', icon: Inbox, tone: '#f79009' },
  { key: 'pending', label: 'Pending', icon: PauseCircle, tone: '#2e90fa' },
  { key: 'closed', label: 'Closed', icon: CheckCircle2, tone: '#12b76a' },
];

/* Kept in step with $topics in lms_api.php / SUPPORT_TOPICS in the portal. */
const TOPICS = [
  ['video', "A video won't play or keeps buffering"],
  ['access', 'I cannot open a course I have paid for'],
  ['certificate', 'My certificate has not arrived'],
  ['quiz', 'A quiz or assignment is not accepting my answer'],
  ['progress', 'My progress or completion is not saving'],
  ['attachment', 'A PDF or attachment will not open'],
  ['login', 'Trouble signing in to the portal'],
  ['other', 'Something else'],
];

const PRESETS = [
  { key: 'any', label: 'Any time' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
  { key: 'lastmonth', label: 'Last month' },
  { key: 'custom', label: 'Custom range' },
];

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** A preset → [from, to] in local dates. */
function presetRange(key, from, to) {
  const now = new Date();
  const days = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  switch (key) {
    case 'today': return [ymd(now), ymd(now)];
    case 'yesterday': return [ymd(days(1)), ymd(days(1))];
    case '7d': return [ymd(days(6)), ymd(now)];
    case '30d': return [ymd(days(29)), ymd(now)];
    case 'month': return [ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(now)];
    case 'lastmonth': return [
      ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      ymd(new Date(now.getFullYear(), now.getMonth(), 0)),
    ];
    case 'custom': return [from || '', to || ''];
    default: return ['', ''];
  }
}

const PER_PAGE = [10, 25, 50, 100];

/** 1 … 4 5 [6] 7 8 … 20 — the page buttons worth showing. */
function pageList(page, pages) {
  const want = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach(n => want.add(n));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach(n => want.add(n));
  const list = [...want].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out = [];
  list.forEach((n, i) => { if (i && n - list[i - 1] > 1) out.push('…' + n); out.push(n); });
  return out;
}

/** Queue timestamps: time only for today, otherwise day + time. */
function when(d) {
  if (!d) return '—';
  const t = new Date(String(d).replace(' ', 'T'));
  const same = t.toDateString() === new Date().toDateString();
  return t.toLocaleString('en-IN', same
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function LmsSupport() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [counts, setCounts] = useState({});
  const [bucket, setBucket] = useState('open');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('');
  const [courses, setCourses] = useState([]);

  /* advanced */
  const [advOpen, setAdvOpen] = useState(false);
  const [preset, setPreset] = useState('any');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [dateField, setDateField] = useState('activity');
  const [topic, setTopic] = useState('');
  const [flag, setFlag] = useState('');

  const [openId, setOpenId] = useState(0);
  const [confirm, setConfirm] = useState(null);

  const [from, to] = useMemo(() => presetRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  /* The page number belongs to one set of filters: change any filter and it
     is back to page 1, without an effect resetting it after the fact. */
  const filterKey = [bucket, search, courseId, topic, flag, from, to, dateField].join('|');
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  const page = paging.key === filterKey ? paging.page : 1;
  const setPage = (p) => setPaging({ key: filterKey, page: p });
  const [perPage, setPerPage] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  /* Only the newest request may paint — a slow poll must not land on top of
     a status change the admin just made. */
  const seq = useRef(0);

  /* The table takes exactly the height left under it on screen, so the page
     itself never scrolls — only the rows do, with the header and the pager
     pinned. Re-measured on resize and whenever the filter panel or the
     filter chips change what sits above it. */
  const wrapRef = useRef(null);
  const [advKey, chipKey] = [String(advOpen), [preset, topic, flag, courseId, search].join('|')];
  useLayoutEffect(() => {
    const fit = () => {
      const el = wrapRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      el.style.maxHeight = `${Math.max(320, window.innerHeight - top - 20)}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [advKey, chipKey, loading]);

  const load = useCallback(async (quiet = false) => {
    const mine = ++seq.current;
    if (!quiet) setLoading(true);
    try {
      const d = await LMS.listTickets({
        status: bucket, q: search, course_id: courseId, topic, flag, from, to,
        date_field: from || to ? dateField : '', page, per_page: perPage,
      });
      if (mine !== seq.current) return;
      setTickets(d.tickets || []);
      setCounts(d.counts || {});
      setPagination(d.pagination || { page: 1, pages: 1, total: (d.tickets || []).length });
      /* Closing the last ticket on the last page leaves that page empty — step back. */
      if (d.pagination && page > d.pagination.pages) setPaging({ key: filterKey, page: d.pagination.pages });
    } catch (e) {
      if (!quiet && mine === seq.current) toast.error(e.message);
    } finally {
      if (!quiet && mine === seq.current) setLoading(false);
    }
  }, [bucket, search, courseId, topic, flag, from, to, dateField, page, perPage, filterKey]);

  useEffect(() => { load(); }, [load]);

  /* New learner messages arrive without anyone refreshing: a quiet re-read
     every 15 s while the tab is visible, and at once when it comes back. */
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') load(true); };
    const t = setInterval(tick, 15000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [load]);

  useEffect(() => {
    LMS.listCourses({ status: 'all' }).then(d => setCourses(d.courses || [])).catch(() => {});
  }, []);

  /* Typing filters on the server, so it waits for the typing to stop. */
  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const openTicket = (id) => {
    setOpenId(id);
    /* The server zeroes the unread counter when the thread is read; mirror
       it rather than reloading the whole queue for one badge. */
    setTickets(rows => rows.map(r => (r.id === id ? { ...r, unread: 0 } : r)));
  };
  const closeChat = useCallback(() => setOpenId(0), []);
  /* Moving tickets — one from the chat, many from the checkboxes — shifts
     the rows and the counts right away; the quiet re-read that follows fills
     in the gap the moved rows left on this page. */
  const applyMoves = useCallback((ids, status) => {
    const next = bucketOf(status);
    const moved = tickets.filter(r => ids.includes(r.id) && bucketOf(r.status) !== next);
    if (moved.length) {
      setCounts(c => {
        const out = { ...c };
        moved.forEach(row => {
          const prev = bucketOf(row.status);
          out[prev] = Math.max(0, (out[prev] ?? 0) - 1);
          out[next] = (out[next] ?? 0) + 1;
          if (prev === 'open' && row.unread > 0) out.unread = Math.max(0, (out.unread ?? 0) - 1);
          if (prev === 'open' && row.reopened) out.reopened = Math.max(0, (out.reopened ?? 0) - 1);
        });
        return out;
      });
    }
    setTickets(rows => rows
      .map(r => (ids.includes(r.id) ? { ...r, status, bucket: next, reopened: false } : r))
      .filter(r => !ids.includes(r.id) || next === bucket));
    load(true);
  }, [load, bucket, tickets]);

  const onChanged = useCallback((change) => {
    if (change?.id && change.status) applyMoves([change.id], change.status);
    else load(true);
  }, [applyMoves, load]);

  /* ── selection: belongs to one page of one filter set, like the page no. */
  const selKey = `${filterKey}|${page}|${perPage}`;
  const [selection, setSelection] = useState({ key: selKey, ids: [] });
  const pageIds = tickets.map(t => t.id);
  /* Only ids still on screen count — a background refresh can take rows away. */
  const selected = selection.key === selKey ? selection.ids.filter(id => pageIds.includes(id)) : [];
  const setSelected = (ids) => setSelection({ key: selKey, ids });
  const allOnPage = pageIds.length > 0 && pageIds.every(id => selected.includes(id));
  const someOnPage = selected.length > 0 && !allOnPage;
  const toggleOne = (id) => setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  const toggleAll = () => setSelected(allOnPage ? [] : pageIds);
  const headBox = useRef(null);
  useEffect(() => { if (headBox.current) headBox.current.indeterminate = someOnPage; }, [someOnPage]);

  const [bulkBusy, setBulkBusy] = useState(false);
  const bulkMove = async (status) => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      await LMS.bulkTicketStatus(ids, status);
      toast.success(`${ids.length} ticket${ids.length === 1 ? '' : 's'} moved to ${BUCKET[bucketOf(status)].label}`);
      setSelected([]);
      applyMoves(ids, status);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBulkBusy(false);
    }
  };

  const remove = async (id) => {
    try {
      await LMS.deleteTicket(id);
      setConfirm(null);
      if (openId === id) setOpenId(0);
      toast.success('Ticket deleted');
      load(true);
    } catch (e) { toast.error(e.message); }
  };

  /* ── active filter chips ─────────────────────────────────────────── */
  const chips = [];
  if (preset !== 'any' && (from || to)) {
    const p = PRESETS.find(x => x.key === preset)?.label;
    chips.push({
      key: 'date',
      label: `${dateField === 'created' ? 'Raised' : 'Activity'}: ${preset === 'custom' ? `${from || '…'} → ${to || '…'}` : p}`,
      clear: () => { setPreset('any'); setCustomFrom(''); setCustomTo(''); },
    });
  }
  if (topic) chips.push({ key: 'topic', label: TOPICS.find(t => t[0] === topic)?.[1], clear: () => setTopic('') });
  if (flag) chips.push({ key: 'flag', label: flag === 'unread' ? 'Only new replies' : 'Only reopened', clear: () => setFlag('') });
  if (courseId) chips.push({ key: 'course', label: courses.find(c => String(c.id) === String(courseId))?.title || 'Course', clear: () => setCourseId('') });
  if (search) chips.push({ key: 'q', label: `“${search}”`, clear: () => { setQ(''); setSearch(''); } });
  const clearAll = () => chips.forEach(c => c.clear());
  const advCount = chips.filter(c => ['date', 'topic', 'flag'].includes(c.key)).length;

  const emptyCopy = {
    open: ['Nothing open', 'No learner is waiting — new tickets and replies land here the moment they are sent.'],
    pending: ['Nothing on hold', 'Use “Pending” inside a ticket to park it here while you check something.'],
    closed: ['No closed tickets', 'Tickets you close move here. If the learner writes again, it goes back to Opened.'],
  }[bucket];

  return (
    <div className="lms-page sp-page">
      <style>{SUPPORT_CSS}</style>

      <div className="lms-page-head">
        <div>
          <h1 className="lms-h1">Support</h1>
        </div>
        <button className="lms-btn lms-btn-ghost" onClick={() => load()} disabled={loading}>
          <RotateCcw size={16} /> Refresh
        </button>
      </div>

      {/* ── the three buckets ─────────────────────────────────────────── */}
      <div className="sp-cards">
        {TABS.map(tb => {
          const I = tb.icon;
          return (
            <button key={tb.key} type="button" className={`sp-card${bucket === tb.key ? ' active' : ''}`}
              style={{ '--sp-tone': tb.tone }} onClick={() => setBucket(tb.key)}>
              <span className="sp-card-ico"><I size={20} /></span>
              <div style={{ minWidth: 0 }}>
                <div className="sp-card-label">{tb.label}</div>
                <div className="sp-card-value">{counts[tb.key] ?? 0}</div>
                <div className="sp-card-hint">
                  {tb.key === 'open' && (
                    <>
                      <b>{counts.unread ?? 0}</b> with new replies
                      {counts.reopened > 0 && <> · {counts.reopened} reopened</>}
                    </>
                  )}
                  {tb.key === 'pending' && 'On hold by the team'}
                  {tb.key === 'closed' && 'Reopen when the learner replies'}
                </div>
              </div>
            </button>
          );
        })}
        {/* The sum of the three — a stat, not a fourth bucket. */}
        <div className="sp-card sp-card-total" style={{ '--sp-tone': '#475467' }}>
          <span className="sp-card-ico"><Layers size={20} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="sp-card-label">Total tickets</div>
            <div className="sp-card-value">{(counts.open ?? 0) + (counts.pending ?? 0) + (counts.closed ?? 0)}</div>
            <div className="sp-card-hint">Opened + Pending + Closed</div>
          </div>
        </div>
      </div>

      {/* ── toolbar ───────────────────────────────────────────────────── */}
      <div className="sp-toolbar">
        <div className="lms-segment">
          {TABS.map(tb => (
            <button key={tb.key} className={bucket === tb.key ? 'active' : ''} onClick={() => setBucket(tb.key)}>
              {tb.label}<span className="sp-seg-count">{counts[tb.key] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="lms-search">
          <Search size={16} />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search subject, learner, email, or ticket #" />
        </div>

        <select className="lms-select" style={{ width: 210 }} value={courseId}
          onChange={e => setCourseId(e.target.value)}>
          <option value="">All courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>

        <select className="lms-select" style={{ width: 150 }} value={preset}
          onChange={e => { setPreset(e.target.value); if (e.target.value === 'custom') setAdvOpen(true); }}>
          {PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>

        <button type="button" className={`lms-btn ${advOpen ? 'lms-btn-dark' : 'lms-btn-ghost'} sp-filter-btn`}
          onClick={() => setAdvOpen(v => !v)}>
          <SlidersHorizontal size={15} /> Filters
          {advCount > 0 && <span className="sp-filter-dot">{advCount}</span>}
        </button>
      </div>

      {advOpen && (
        <div className="sp-adv">
          <div className="sp-adv-field sp-adv-wide">
            <label>Date range</label>
            <div className="sp-presets">
              {PRESETS.map(p => (
                <button key={p.key} type="button" className={`sp-preset${preset === p.key ? ' on' : ''}`}
                  onClick={() => setPreset(p.key)}>{p.label}</button>
              ))}
            </div>
            {preset === 'custom' && (
              <div className="sp-range" style={{ marginTop: 6 }}>
                <input type="date" value={customFrom} max={customTo || undefined} onChange={e => setCustomFrom(e.target.value)} />
                <span style={{ color: 'var(--lms-text-3)' }}>to</span>
                <input type="date" value={customTo} min={customFrom || undefined} onChange={e => setCustomTo(e.target.value)} />
              </div>
            )}
          </div>
          <div className="sp-adv-field">
            <label>Date applies to</label>
            <div className="lms-segment">
              <button className={dateField === 'activity' ? 'active' : ''} onClick={() => setDateField('activity')}>Last activity</button>
              <button className={dateField === 'created' ? 'active' : ''} onClick={() => setDateField('created')}>Raised on</button>
            </div>
          </div>
          <div className="sp-adv-field">
            <label>Topic</label>
            <select className="lms-select" value={topic} onChange={e => setTopic(e.target.value)}>
              <option value="">All topics</option>
              {TOPICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="sp-adv-field">
            <label>Show</label>
            <div className="lms-segment">
              <button className={flag === '' ? 'active' : ''} onClick={() => setFlag('')}>All</button>
              <button className={flag === 'unread' ? 'active' : ''} onClick={() => setFlag('unread')}>New replies</button>
              <button className={flag === 'reopened' ? 'active' : ''} onClick={() => setFlag('reopened')}>Reopened</button>
            </div>
          </div>
        </div>
      )}

      {chips.length > 0 && (
        <div className="sp-active-filters">
          {chips.map(c => (
            <span key={c.key} className="sp-af">{c.label}
              <button type="button" onClick={c.clear} title="Remove filter"><X size={12} /></button>
            </span>
          ))}
          <button type="button" className="sp-af-clear" onClick={clearAll}>Clear all</button>
          <span className="sp-result-note">{tickets.length} ticket{tickets.length === 1 ? '' : 's'}</span>
        </div>
      )}

      {/* ── the queue ─────────────────────────────────────────────────── */}
      <div className="lms-table-wrap sp-tablewrap" ref={wrapRef}>
        {loading ? <Loader inline /> : tickets.length === 0 ? (
          <Empty
            icon={<LifeBuoy size={24} />}
            title={chips.length ? 'No tickets match these filters' : emptyCopy[0]}
            message={chips.length ? 'Try a wider date range or clear the filters.' : emptyCopy[1]}
            action={chips.length ? <button className="lms-btn lms-btn-ghost" onClick={clearAll}>Clear filters</button> : null}
          />
        ) : (
          <>
          {selected.length > 0 && (
            <div className="sp-bulk">
              <span className="sp-bulk-count"><b>{selected.length}</b> selected</span>
              {!allOnPage && (
                <button type="button" className="sp-bulk-link" onClick={toggleAll}>
                  Select all {pageIds.length} on this page
                </button>
              )}
              <span className="sp-bulk-sep" />
              <span className="sp-bulk-label">Move to</span>
              {bucket !== 'open' && (
                <button type="button" className="lms-btn lms-btn-ghost sp-btn-sm" disabled={bulkBusy} onClick={() => bulkMove('open')}>
                  <Inbox size={14} /> Opened
                </button>
              )}
              {bucket !== 'pending' && (
                <button type="button" className="lms-btn lms-btn-ghost sp-btn-sm" disabled={bulkBusy} onClick={() => bulkMove('pending')}>
                  <PauseCircle size={14} /> Pending
                </button>
              )}
              {bucket !== 'closed' && (
                <button type="button" className="lms-btn lms-btn-dark sp-btn-sm" disabled={bulkBusy} onClick={() => bulkMove('closed')}>
                  <CheckCircle2 size={14} /> Closed
                </button>
              )}
              <button type="button" className="sp-bulk-clear" onClick={() => setSelected([])} disabled={bulkBusy}>
                <X size={14} /> Clear
              </button>
            </div>
          )}
          <div className="lms-table-scroll">
            <table className="lms-table sp-table">
              <thead>
                <tr>
                  <th className="sp-check-cell">
                    <input ref={headBox} type="checkbox" className="sp-check" checked={allOnPage}
                      onChange={toggleAll} aria-label="Select all tickets on this page" />
                  </th>
                  <th>Ticket</th><th>Learner</th><th>About</th><th>Course</th>
                  <th>Status</th><th>Messages</th><th>Last activity</th><th />
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => {
                  const b = BUCKET[bucketOf(t.status)];
                  return (
                    <tr key={t.id}
                      className={`sp-row${t.unread > 0 ? ' unread' : ''}${selected.includes(t.id) ? ' picked' : ''}`}
                      onClick={() => openTicket(t.id)}>
                      <td className="sp-check-cell" onClick={(e) => { e.stopPropagation(); toggleOne(t.id); }}>
                        <input type="checkbox" className="sp-check" checked={selected.includes(t.id)}
                          onChange={() => toggleOne(t.id)} onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ticket #${t.id}`} />
                      </td>
                      <td>
                        <div className="sp-subj" title={t.subject}>{t.subject}</div>
                        <div className="sp-badges">
                          <span className="sp-id">#{t.id}</span>
                          {t.unread > 0 && <span className="sp-badge new">{t.unread} new</span>}
                          {t.reopened && t.bucket === 'open' && (
                            <span className="sp-badge reopen" title={`Learner replied after it was closed · ${fullStamp(t.reopened_at)}`}>
                              <RotateCcw size={10} /> Reopened
                            </span>
                          )}
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
                      <td className="sp-cell-clip sp-cell-muted" style={{ maxWidth: 150 }} title={t.topic_label}>{t.topic_label}</td>
                      <td className="sp-cell-clip" style={{ maxWidth: 170 }}
                        title={t.course_title ? t.course_title + (t.course_inferred ? ' (enrolled — not picked on the ticket)' : '') : ''}>
                        {t.course_title || '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <Pill tone={b.tone}>{b.label}</Pill>
                        {t.bucket === 'open' && t.last_sender && (
                          <span className={`sp-last${t.last_sender === 'learner' ? ' learner' : ''}`}>
                            {t.last_sender === 'learner' ? 'Awaiting reply' : 'Replied'}
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {t.messages}
                          {t.preview === '' && <Paperclip size={12} color="var(--lms-text-3)" />}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12.5 }} title={fullStamp(t.last_message_at || t.created_at)}>
                        {when(t.last_message_at || t.created_at)}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="lms-icon-btn" title="Delete this ticket"
                          onClick={(e) => { e.stopPropagation(); setConfirm(t); }}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}

        {!loading && pagination.total > 0 && (
          <div className="sp-pager">
            <span className="sp-pager-info">
              Showing <b>{(pagination.page - 1) * perPage + 1}–{Math.min(pagination.page * perPage, pagination.total)}</b> of <b>{pagination.total}</b>
            </span>
            <label className="sp-pager-size">
              Rows
              <select className="lms-select" value={perPage}
                onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}>
                {PER_PAGE.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <div className="sp-pager-pages">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
                <ChevronLeft size={15} />
              </button>
              {pageList(page, pagination.pages).map(n => (typeof n === 'string'
                ? <span key={n} className="sp-pager-gap">…</span>
                : <button key={n} type="button" className={n === page ? 'on' : ''} onClick={() => setPage(n)}>{n}</button>))}
              <button type="button" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)} aria-label="Next page">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {openId > 0 && (
        <SupportChat
          ticketId={openId}
          author={user?.name || user?.email || 'Support team'}
          onClose={closeChat}
          onChanged={onChanged}
          onOpenTicket={openTicket}
          onDelete={(t) => setConfirm(t)}
        />
      )}

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
