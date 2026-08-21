import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Search, Download, Hash, Percent, ArrowUpDown, MoreVertical, Pin, X, MessageCircle, Mail } from 'lucide-react';
import { listJourneys, createJourney, duplicateJourney, removeJourney, setStatus, loadOptions } from './journeyStore';
import FilterDrawer from '../FilterDrawer';
import { resolvePreset, describePreset } from '../filterPresets';
import { entranceNudgeGraph, batchReminderGraph, paymentRecoveryGraph, dormantGraph, referralGraph } from './journeyGraphs';

/*
  Journeys landing — Engage → Journeys. Reads/writes through journeyStore so every row
  action is a real persisted operation (create, duplicate, pause/resume, stop, archive,
  restore, delete), plus search / sort / pagination and the Netcore metric columns.
*/

const BADGE = {
  ongoing:   { bg: '#e7f7ee', fg: '#15803d', bd: '#bbe7cd', label: 'ONGOING' },
  scheduled: { bg: '#e5edff', fg: '#1d4ed8', bd: '#c7d7fe', label: 'SCHEDULED' },
  paused:    { bg: '#fff0e0', fg: '#c2410c', bd: '#fdd8b5', label: 'PAUSED' },
  draft:     { bg: '#f1ecfe', fg: '#6d28d9', bd: '#ddd0fb', label: 'DRAFT' },
  completed: { bg: '#fdf3d7', fg: '#b45309', bd: '#f6e0a8', label: 'COMPLETED' },
  stopped:   { bg: '#fdeaea', fg: '#dc2626', bd: '#f7cccc', label: 'STOPPED' },
  archived:  { bg: '#eef1f6', fg: '#64748b', bd: '#dbe1ea', label: 'ARCHIVED' },
};
const TAB_ORDER = ['all', 'ongoing', 'scheduled', 'paused', 'draft', 'completed', 'stopped', 'archived'];
const TAB_LABEL = { all: 'All', ongoing: 'Ongoing', scheduled: 'Scheduled', paused: 'Paused', draft: 'Drafts', completed: 'Completed', stopped: 'Stopped', archived: 'Archived' };
const PAGE = 8;

const GOAL_EVENTS = ['batch_allotted', 'exam_started', 'exam_success', 'course_purchased', 'batch_joined', 'portal_login', 'certificate_issued', 'referral_signup'];
const CONTROL_LISTS = ['Aug 2026 walk-ins', 'TPO referred — Pune', 'WhatsApp opt-in base', 'Maharashtra TPO contacts'];
const DLET = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* Create-journey template gallery. graphObj = a preloaded flow (null = blank canvas). */
const TEMPLATES = [
  { key: 'blank', title: 'Create New', desc: 'Start a new journey with a blank canvas', cat: 'Blank', name: '', graphObj: null, blank: true },
  { key: 'entrance', title: 'Entrance exam nudge', desc: 'Registered but hasn’t taken iCAT — nudge across WhatsApp, SMS and email', cat: 'OffCampusly', name: 'iCAT · Entrance exam nudge', graphObj: entranceNudgeGraph },
  { key: 'batch', title: 'Batch start reminders', desc: 'Fired by your scheduler, targeted to students by batch code', cat: 'Business event', name: 'Batch start reminders', graphObj: batchReminderGraph },
  { key: 'payment', title: 'Payment recovery', desc: 'Reach the cheapest available channel first when a payment fails', cat: 'Revenue', name: '₹99 store · Payment recovery', graphObj: paymentRecoveryGraph },
  { key: 'dormant', title: 'Dormant reactivation', desc: 'Win back inactive students with a measured holdout group', cat: 'Retention', name: 'Dormant reactivation', graphObj: dormantGraph },
  { key: 'referral', title: 'Certificate → referral loop', desc: 'Reward students who refer after their certificate is issued', cat: 'Referral', name: 'Certificate · referral loop', graphObj: referralGraph },
];

/* Which date the Duration filter measures against — module scope so the pill labels and the
   drawer's radio options cannot drift out of step. */
const BASIS_LABEL = { createdAt: 'Last created', updatedAt: 'Last edited', durationMs: 'Journey duration' };

const nUS = v => Number(v || 0).toLocaleString('en-US');
const pct = (part, whole) => (!whole ? '—' : (Math.round((Number(part) / Number(whole)) * 1000) / 10).toFixed(1) + '%');

/*
  One metric cell: the combined figure, with the per-channel split behind two icons.

  A journey mixes channels, so a single number hides whether the WhatsApp leg or the
  email leg is carrying it. Printing both numbers under every figure turned the table
  into a wall of zeroes, so the channels are icons by default and the count appears
  beside the icon you point at.

  Revealed in place rather than in a floating tooltip on purpose: the table wrapper
  scrolls horizontally, which makes it clip anything positioned outside a cell — an
  absolute tooltip would be cut off on the first and last rows.

  An icon is tinted only when that channel actually contributed, so which channel did
  the work is still readable at a glance without hovering anything.

  Rates are a share of that channel's OWN sends: 1 of 1 WhatsApp delivered is 100%.
  Dividing by the journey's total sends would read as 50% and mean nothing.
*/
const METRIC_CSS = `
.jm-n{display:inline-block;font-size:15px;font-weight:650;font-variant-numeric:tabular-nums;
      cursor:default;border-bottom:1px dashed transparent;transition:border-color .12s}
.jm-n.hov:hover{border-bottom-color:#cbd5e1}
.jm-tip{position:fixed;z-index:2000;transform:translate(-50%,-100%);margin-top:-9px;
  background:#0f172a;color:#fff;border-radius:8px;padding:7px 10px;
  display:flex;gap:14px;align-items:center;white-space:nowrap;pointer-events:none;
  box-shadow:0 8px 22px -6px rgba(15,23,42,.5);animation:jmTip .1s ease}
.jm-tip.below{transform:translate(-50%,0);margin-top:9px}
.jm-tip i{display:inline-flex;align-items:center;gap:5px;font-style:normal;font-size:12px;font-weight:600;
  font-variant-numeric:tabular-nums;color:#e2e8f0}
.jm-tip i svg{color:#94a3b8}
.jm-tip::after{content:'';position:absolute;left:50%;margin-left:-5px;border:5px solid transparent}
.jm-tip:not(.below)::after{top:100%;border-top-color:#0f172a}
.jm-tip.below::after{bottom:100%;border-bottom-color:#0f172a}
@keyframes jmTip{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.jm-tip{animation:none}}

/* The journey name is the only navigation target in the row: a link in appearance, a button in
   markup so it stays keyboard-reachable and is announced correctly. */
.jl-name{border:0;background:none;padding:0;font-family:inherit;font-size:13px;font-weight:600;
  color:#0f172a;cursor:pointer;text-align:left;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;border-bottom:1px solid transparent;
  transition:color .15s cubic-bezier(.4,0,.2,1),border-color .15s}
.jl-name:hover{color:#1e3a8a;border-bottom-color:#a5b4fc}
.jl-name:focus-visible{outline:2px solid #1e3a8a;outline-offset:2px;border-radius:3px}

/* Beside the name rather than at the far right of a wide metric table, where a horizontal
   scroll would put it out of reach.

   Quiet until wanted: a permanent ⋮ on every row is a column of noise for a control almost
   nobody uses on almost every row. Faded rather than removed, so nothing shifts sideways on
   hover and the button stays in the tab order — :focus-visible reveals it for keyboard users,
   and [data-open] keeps it visible while its own menu is up. */
.jl-dots{flex:none;border:0;cursor:pointer;color:#64748b;padding:4px;border-radius:6px;
  display:grid;place-items:center;opacity:0;
  transition:opacity .14s cubic-bezier(.4,0,.2,1),background .15s,color .15s}
tr:hover .jl-dots,.jl-dots:focus-visible,.jl-dots[data-open]{opacity:1}
.jl-dots:hover{background:#eef2ff;color:#1e3a8a}
.jl-dots[data-open]{background:#eef2ff;color:#1e3a8a}
.jl-dots:focus-visible{outline:2px solid #1e3a8a;outline-offset:2px}
/* A coarse pointer has no hover at all, so it would be permanently invisible there. */
@media (hover:none){.jl-dots{opacity:1}}
`;

function Metric({ row, k, isPct }) {
  const by = row.byChannel;
  const total = Number(row[k] || 0);
  const [tip, setTip] = useState(null);
  const show = (v, base) => (isPct ? pct(v, base) : nUS(v));

  const enter = e => {
    if (!by) return;
    const r = e.currentTarget.getBoundingClientRect();
    // Flip under the number when there is no room above it, so a first-row cell
    // does not push the bubble off the top of the window.
    const below = r.top < 70;
    setTip({ x: r.left + r.width / 2, y: below ? r.bottom : r.top, below });
  };

  return (
    <>
      <span
        className={'jm-n' + (by ? ' hov' : '')}
        style={{ color: total ? '#0f172a' : '#cbd5e1' }}
        onMouseEnter={enter}
        onMouseLeave={() => setTip(null)}
      >
        {show(total, row.sent)}
      </span>

      {/*
        Rendered into document.body rather than into the cell. The table wrapper
        scrolls horizontally, and CSS makes that clip the vertical axis too — a bubble
        positioned inside the cell would be sliced off on the top and bottom rows. A
        portal with fixed positioning is outside that clipping context entirely.
      */}
      {tip && createPortal(
        <div className={'jm-tip' + (tip.below ? ' below' : '')} style={{ left: tip.x, top: tip.y }}>
          <i><MessageCircle size={13} strokeWidth={2.2} />{show(by.whatsapp?.[k] || 0, by.whatsapp?.sent || 0)}</i>
          <i><Mail size={13} strokeWidth={2.2} />{show(by.email?.[k] || 0, by.email?.sent || 0)}</i>
        </div>,
        document.body,
      )}
    </>
  );
}
const nowLocal = () => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

function Badge({ status }) {
  const b = BADGE[status] || BADGE.draft;
  return <span style={{ background: b.bg, color: b.fg, border: `1px solid ${b.bd}`, fontSize: 9.5, fontWeight: 800, padding: '2px 8px', borderRadius: 5, letterSpacing: '.4px', whiteSpace: 'nowrap' }}>{b.label}</span>;
}

/* actions available for a given status */
function actionsFor(status) {
  const a = [{ k: 'view', label: 'View / Edit' }];
  if (['ongoing', 'scheduled', 'paused', 'stopped', 'completed', 'archived'].includes(status)) a.push({ k: 'report', label: 'View report' });
  a.push({ k: 'duplicate', label: 'Duplicate' });
  if (status === 'ongoing') a.push({ k: 'pause', label: 'Pause' }, { k: 'stop', label: 'Stop' });
  if (status === 'scheduled') a.push({ k: 'stop', label: 'Stop' });
  if (status === 'paused') a.push({ k: 'resume', label: 'Resume' }, { k: 'stop', label: 'Stop' });
  if (status === 'stopped') a.push({ k: 'resume', label: 'Reactivate' }, { k: 'archive', label: 'Archive' });
  if (status === 'completed') a.push({ k: 'archive', label: 'Archive' });
  if (status === 'draft') a.push({ k: 'archive', label: 'Archive' }, { k: 'delete', label: 'Delete', danger: 1 });
  if (status === 'archived') a.push({ k: 'restore', label: 'Restore' }, { k: 'delete', label: 'Delete', danger: 1 });
  return a;
}

export default function JourneyList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTabRaw] = useState('all');
  const [q, setQRaw] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [mode, setMode] = useState('abs');
  // Newest journey first. Sorting by last-edited pushed whatever you touched most
  // recently to the top, which is not the same thing and made a fresh journey hard to find.
  const [sort, setSort] = useState({ key: 'createdAt', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [menuFor, setMenuFor] = useState(null);
  const [confirm, setConfirm] = useState(null);   // { row, action }
  const [createStep, setCreateStep] = useState(null); // null | 'gallery' | 'details'
  const [tpl, setTpl] = useState(null);            // chosen template
  const [picked, setPicked] = useState(() => new Set()); // bulk-selected row ids
  const [bulkConfirm, setBulkConfirm] = useState(null);  // { action }

  /*
   * The Filters drawer.
   *
   * `basis` is which date the Duration range is measured against — created, edited, or the
   * journey's own configured run length. They are genuinely different questions ("what did we
   * build last month" vs "what has been touched lately" vs "what runs for more than a week"),
   * and collapsing them into one date filter was the reason the old list could not answer any
   * of them.
   */
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ basis: 'createdAt', duration: '', from: '', to: '', editedBy: [], tags: [] });
  const [editors, setEditors] = useState([]);
  const [allTags, setAllTags] = useState([]);

  useEffect(() => {
    loadOptions()
      .then(o => { setEditors(o?.editors || []); setAllTags(o?.journeyTags || []); })
      .catch(() => { /* the drawer degrades to date + tag filtering only */ });
  }, []);

  // The list is server-side now. refresh() is awaited by every mutation below so the
  // table always shows what the database actually holds, not an optimistic guess.
  const refresh = async () => {
    setLoading(true);
    try { setRows(await listJourneys()); } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);
  // Changing the filter/search/sort resets to page 1 and clears bulk selection.
  const setTab = v => { setTabRaw(v); setPage(1); setPicked(new Set()); };
  const setQ = v => { setQRaw(v); setPage(1); setPicked(new Set()); };
  const changeSort = next => { setSort(next); setPage(1); setPicked(new Set()); };
  const togglePick = id => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const counts = useMemo(() => {
    const c = { all: rows.length };
    for (const s of TAB_ORDER) if (s !== 'all') c[s] = rows.filter(r => r.status === s).length;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    // Inclusive both ends, and compared as timestamps rather than strings — a date-string
    // compare silently gets '2026-9-1' wrong against '2026-10-01'.
    const fromTs = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : null;
    const toTs   = filters.to   ? new Date(`${filters.to}T23:59:59`).getTime()   : null;

    let out = rows
      .filter(r => tab === 'all' || r.status === tab)
      .filter(r => !needle || r.name.toLowerCase().includes(needle) || String(r.id).includes(needle))
      .filter(r => {
        if (fromTs === null && toTs === null) return true;
        /* "Journey duration" is a length, not a date, so a date range cannot be applied to it —
           it changes the SORT instead, and the range is ignored rather than silently dropping
           every row. Saying so in the drawer's hint is what stops that reading as a bug. */
        if (filters.basis === 'durationMs') return true;
        const t = r[filters.basis] || 0;
        if (fromTs !== null && t < fromTs) return false;
        if (toTs   !== null && t > toTs)   return false;
        return true;
      })
      .filter(r => !filters.editedBy.length || filters.editedBy.includes(String(r.editedById || 0)))
      .filter(r => !filters.tags.length || (r.tags || []).some(t => filters.tags.includes(t)));

    const { key, dir } = sort, mul = dir === 'asc' ? 1 : -1;
    out = out.slice().sort((a, b) => {
      let x = a[key], y = b[key];
      if (key === 'name') { x = x.toLowerCase(); y = y.toLowerCase(); return x < y ? -mul : x > y ? mul : 0; }
      return ((Number(x) || 0) - (Number(y) || 0)) * mul;
    });
    return out;
  }, [rows, tab, q, sort, filters]);

  const filterFields = useMemo(() => [
    { key: 'basis', label: 'Measure by', kind: 'radio', default: 'createdAt',
      options: [
        { id: 'createdAt', label: 'Last created' },
        { id: 'updatedAt', label: 'Last edited' },
        { id: 'durationMs', label: 'Journey duration' },
      ] },
    { key: 'duration', label: 'Duration', kind: 'daterange',
      hint: '— applies to the date chosen above' },
    { key: 'editedBy', label: 'Edited by', kind: 'chips',
      options: editors.map(e => ({ id: String(e.id), label: e.name })),
      emptyText: 'Nobody has edited a journey since this started being recorded' },
    { key: 'tags', label: 'Tags', kind: 'chips',
      options: allTags.map(t => ({ id: t, label: t })),
      emptyText: 'No journey has been tagged yet' },
  ], [editors, allTags]);

  const activePills = useMemo(() => {
    const out = [];
    if (filters.basis && filters.basis !== 'createdAt') out.push({ k: 'basis', label: BASIS_LABEL[filters.basis] });
    if (filters.duration) out.push({ k: 'duration', label: describePreset(filters.duration, filters.from, filters.to) });
    filters.editedBy.forEach(id =>
      out.push({ k: 'editedBy', v: id, label: editors.find(e => String(e.id) === id)?.name || `Admin #${id}` }));
    filters.tags.forEach(t => out.push({ k: 'tags', v: t, label: `#${t}` }));
    return out;
  }, [filters, editors]);

  const applyFilters = next => {
    const r = next.duration === 'custom'
      ? { from: next.from || '', to: next.to || '' }
      : resolvePreset(next.duration);
    setFilters({ ...next, basis: next.basis || 'createdAt', from: r.from, to: r.to });
    // "Journey duration" is a length, so it drives the sort rather than a date window.
    if (next.basis === 'durationMs') changeSort({ key: 'durationMs', dir: 'desc' });
    setPage(1);
  };

  const dropPill = p => {
    if (p.k === 'basis') setFilters(f => ({ ...f, basis: 'createdAt' }));
    else if (p.k === 'duration') setFilters(f => ({ ...f, duration: '', from: '', to: '' }));
    else setFilters(f => ({ ...f, [p.k]: f[p.k].filter(x => x !== p.v) }));
    setPage(1);
  };

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageRows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const pageAllPicked = pageRows.length > 0 && pageRows.every(r => picked.has(r.id));
  const togglePage = () => setPicked(p => { const n = new Set(p); if (pageAllPicked) pageRows.forEach(r => n.delete(r.id)); else pageRows.forEach(r => n.add(r.id)); return n; });
  /*
    Every mutation below is sequential on purpose. Firing N duplicates in parallel
    would race the server's version numbering and give the list a half-updated view;
    these are 2-5 row operations, so the loop costs nothing worth optimising.
    Failures are already toasted by the store — we just stop and re-read the truth.
  */
  const bulkDuplicate = async () => {
    try { for (const id of picked) await duplicateJourney(id); toast.success(`Duplicated ${picked.size} journeys`); }
    finally { setPicked(new Set()); await refresh(); }
  };
  const doBulkConfirm = async () => {
    const ids = [...picked], a = bulkConfirm.action;
    setBulkConfirm(null);
    try {
      for (const id of ids) {
        if (a === 'archive') await setStatus(id, 'archived');
        if (a === 'delete')  await removeJourney(id);
      }
      toast.success(a === 'delete' ? `Deleted ${ids.length} journeys` : `Archived ${ids.length} journeys`);
    } finally { setPicked(new Set()); await refresh(); }
  };

  const runAction = async (row, action) => {
    setMenuFor(null);
    switch (action) {
      case 'view': navigate(`/netcore/journeys/${row.id}`); return;
      case 'report': navigate(`/netcore/journeys/${row.id}/report`); return;
      case 'duplicate': { const c = await duplicateJourney(row.id); await refresh(); toast.success(`Duplicated as “${c.name}”`); return; }
      case 'pause':  await setStatus(row.id, 'paused'); await refresh(); toast('Journey paused.'); return;
      // Resuming re-runs server-side validation, so a journey edited into an invalid
      // state while paused is refused here rather than failing silently in the worker.
      case 'resume': await setStatus(row.id, 'ongoing'); await refresh(); toast.success('Journey resumed.'); return;
      case 'restore': await setStatus(row.id, 'draft'); await refresh(); toast.success('Restored to draft.'); return;
      case 'stop': case 'archive': case 'delete': setConfirm({ row, action }); return;
      default: return;
    }
  };
  const doConfirm = async () => {
    const { row, action } = confirm;
    setConfirm(null);
    try {
      if (action === 'stop')    { await setStatus(row.id, 'stopped');  toast('Journey stopped.'); }
      if (action === 'archive') { await setStatus(row.id, 'archived'); toast('Journey archived.'); }
      if (action === 'delete')  { await removeJourney(row.id);         toast.success('Journey deleted.'); }
    } finally { await refresh(); }
  };

  const exportCsv = () => {
    const head = ['ID', 'Name', 'Status', 'Sent', 'Delivered', 'Opened', 'Clicked', 'Conversions', 'Revenue'];
    const lines = filtered.map(r => [r.id, `"${r.name}"`, r.status, r.sent, r.delivered, r.opened, r.clicked, r.conversions, r.revenue].join(','));
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `journeys-${tab}.csv`; a.click(); URL.revokeObjectURL(a.href);
    toast.success(`Exported ${filtered.length} journeys`);
  };

  const isPct = mode === 'pct';
  const cell = { padding: '13px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#334155', whiteSpace: 'nowrap' };
  const th = { padding: '12px 14px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', color: '#64748b', whiteSpace: 'nowrap' };

  return (
    <div style={{ padding: '20px 24px 48px' }}>
      {/* The metric cells need :hover, which inline styles cannot express. */}
      <style>{METRIC_CSS}</style>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Journeys</h1>
            <Pin size={15} style={{ color: '#94a3b8' }} />
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Orchestrate cross-channel journeys to boost retention and revenue</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {searchOpen && (
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} onBlur={() => !q && setSearchOpen(false)} placeholder="Search journeys…"
              style={{ padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, width: 220, background: '#fff', outline: 'none' }} />
          )}
          <button onClick={() => setSearchOpen(o => !o)} title="Search" style={iconBtn}><Search size={17} /></button>
          <button onClick={() => { setTpl(null); setCreateStep('gallery'); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#1e3a8a', color: '#fff', border: 0, padding: '10px 18px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, letterSpacing: '.3px', cursor: 'pointer' }}>
            <Plus size={16} /> CREATE JOURNEY
          </button>
        </div>
      </div>

      {/* tabs + toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid #e2e8f0', marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {TAB_ORDER.map(k => {
            const on = tab === k;
            return (
              <button key={k} onClick={() => setTab(k)}
                style={{ border: 0, background: 'none', cursor: 'pointer', padding: '10px 12px', fontSize: 13, fontWeight: on ? 700 : 500, color: on ? '#1e3a8a' : '#64748b', borderBottom: on ? '2px solid #1e3a8a' : '2px solid transparent', marginBottom: -1 }}>
                {TAB_LABEL[k]} ({counts[k] ?? 0})
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 6 }}>
          <select value={`${sort.key}:${sort.dir}`} onChange={e => { const [key, dir] = e.target.value.split(':'); changeSort({ key, dir }); }}
            title="Sort" style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, color: '#475569', background: '#fff', cursor: 'pointer' }}>
            <option value="updatedAt:desc">Recently edited</option>
            <option value="name:asc">Name A–Z</option>
            <option value="name:desc">Name Z–A</option>
            <option value="sent:desc">Most sent</option>
            <option value="conversions:desc">Most conversions</option>
          </select>
          <button onClick={() => setFilterOpen(true)} title="Filters"
            style={{ ...iconBtn, position: 'relative', borderColor: activePills.length ? '#4f46e5' : undefined,
                     color: activePills.length ? '#4f46e5' : undefined }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 5h18M6 12h12M10 19h4" />
            </svg>
            {activePills.length > 0 && (
              <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, padding: '0 4px',
                             borderRadius: 999, background: '#4f46e5', color: '#fff', fontSize: 9.5, fontWeight: 800,
                             display: 'grid', placeItems: 'center', boxShadow: '0 0 0 2px #fff' }}>
                {activePills.length}
              </span>
            )}
          </button>
          <button onClick={exportCsv} title="Export CSV" style={iconBtn}><Download size={16} /></button>
          <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setMode('abs')} title="Show counts" style={{ ...toggleBtn, background: !isPct ? '#1e3a8a' : '#fff', color: !isPct ? '#fff' : '#64748b' }}><Hash size={15} /></button>
            <button onClick={() => setMode('pct')} title="Show rates" style={{ ...toggleBtn, background: isPct ? '#1e3a8a' : '#fff', color: isPct ? '#fff' : '#64748b', borderLeft: '1px solid #e2e8f0' }}><Percent size={15} /></button>
          </div>
          <button title="Sort direction" onClick={() => changeSort({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })} style={iconBtn}><ArrowUpDown size={16} /></button>
        </div>
      </div>

      {/* Applied filters, each removable on its own — a drawer you must reopen to undo one
          choice is why people end up clearing everything and starting again. */}
      {activePills.length > 0 && (
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
          {activePills.map((p, i) => (
            <span key={`${p.k}-${p.v || i}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px 11px',
                           borderRadius: 999, background: '#eef2ff', border: '1px solid #c7d2fe',
                           color: '#3730a3', fontSize: 11.5, fontWeight: 650 }}>
              {p.label}
              <button onClick={() => dropPill(p)} aria-label={`Remove ${p.label} filter`}
                      style={{ width: 17, height: 17, display: 'grid', placeItems: 'center', border: 0,
                               borderRadius: '50%', background: 'rgba(55,48,163,.12)', color: '#3730a3', cursor: 'pointer' }}>
                <X size={9} />
              </button>
            </span>
          ))}
          <button onClick={() => applyFilters({ basis: 'createdAt', duration: '', from: '', to: '', editedBy: [], tags: [] })}
                  style={{ border: 0, background: 'none', color: '#64748b', fontSize: 11.5, fontWeight: 650,
                           cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            Clear all
          </button>
        </div>
      )}

      <FilterDrawer
        open={filterOpen} onClose={() => setFilterOpen(false)}
        title="Filters" fields={filterFields} value={filters} onApply={applyFilters}
      />

      {/* bulk action bar */}
      {picked.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10, marginBottom: 12 }}>
          <span style={{ fontWeight: 600, color: '#1e3a8a', fontSize: 13 }}>{picked.size} selected</span>
          <div style={{ flex: 1 }} />
          <button onClick={bulkDuplicate} style={bulkBtn}>Duplicate</button>
          <button onClick={() => setBulkConfirm({ action: 'archive' })} style={bulkBtn}>Archive</button>
          <button onClick={() => setBulkConfirm({ action: 'delete' })} style={{ ...bulkBtn, color: '#dc2626', borderColor: '#f3c8c4' }}>Delete</button>
          <button onClick={() => setPicked(new Set())} style={bulkBtn}>Clear</button>
        </div>
      )}

      {/* table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1010 }}>
          <thead>
            <tr style={{ textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ ...th, width: 36, paddingRight: 0 }}><input type="checkbox" checked={pageAllPicked} onChange={togglePage} aria-label="Select page" style={{ cursor: 'pointer' }} /></th>
              <th style={{ ...th, textAlign: 'left', minWidth: 230 }}>Journeys</th>
              <th style={{ ...th, textAlign: 'left', minWidth: 230 }}>Start - End date</th>
              {/* "Messages" not "Sent": these columns count MESSAGES. A journey with
                  several message steps sends more messages than it has students. */}
              {[
                ['Messages', 'Messages sent. One student can receive several if the journey has more than one message step.'],
                ['Delivered', 'Messages the provider confirmed as delivered.'],
                ['Opened / Read', 'Emails opened, WhatsApp messages read.'],
                ['Clicked', 'Messages with at least one link tap.'],
                ['Conversions', 'Students who did the goal event after clicking.'],
              ].map(([h, tip]) => (
                <th key={h} style={th} title={tip}>{h}</th>
              ))}
              <th style={th}>Revenue</th>
              <th style={{ ...th, textAlign: 'left' }}>Conversion goal</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} style={{ padding: '46px 16px', textAlign: 'center', color: '#94a3b8' }}>
                Loading journeys…
              </td></tr>
            )}
            {!loading && pageRows.length === 0 && (
              <tr><td colSpan={10} style={{ padding: '46px 16px', textAlign: 'center', color: '#94a3b8' }}>
                No journeys here. <button onClick={() => { setTab('all'); setQ(''); }} style={{ border: 0, background: 'none', color: '#1e3a8a', fontWeight: 600, cursor: 'pointer' }}>Clear filters</button>
              </td></tr>
            )}
            {pageRows.map(r => (
              /* The row is NOT clickable. A whole-row target turns every stray click into a
                 navigation, including one aimed at the checkbox or the menu — only the journey
                 name is a link, and the actions menu sits beside it in the same column. */
              <tr key={r.id}
                onMouseEnter={e => (e.currentTarget.style.background = '#fafbff')} onMouseLeave={e => (e.currentTarget.style.background = picked.has(r.id) ? '#f5f8ff' : '#fff')}
                style={{ borderBottom: '1px solid #eef1f6', background: picked.has(r.id) ? '#f5f8ff' : '#fff' }}>
                <td style={{ padding: '13px 8px 13px 14px', verticalAlign: 'top' }}>
                  <input type="checkbox" checked={picked.has(r.id)} onChange={() => togglePick(r.id)} aria-label={`Select ${r.name}`} style={{ cursor: 'pointer', marginTop: 3 }} />
                </td>
                <td style={{ padding: '13px 14px', verticalAlign: 'top' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
                    <button className="jl-name" title={r.name}
                      onClick={() => navigate(`/netcore/journeys/${r.id}/report`)}>
                      {r.name}
                    </button>
                    {/*
                      The menu opens through a portal. It used to be positioned inside its cell,
                      and the table wrapper scrolls horizontally — which makes CSS clip the
                      vertical axis too, so the menu was sliced off and only the first option was
                      reachable. Anchored to the button's screen position instead.
                    */}
                    <button title="Actions" aria-label={`Actions for ${r.name}`} aria-haspopup="menu"
                      className="jl-dots"
                      aria-expanded={menuFor?.id === r.id}
                      data-open={menuFor?.id === r.id ? '1' : undefined}
                      onClick={e => {
                        if (menuFor?.id === r.id) { setMenuFor(null); return; }
                        const b = e.currentTarget.getBoundingClientRect();
                        const items = actionsFor(r.status).length;
                        const h = items * 34 + 10;
                        // Flip above the button when there is not enough room below it.
                        const below = b.bottom + h < window.innerHeight - 8;
                        setMenuFor({ id: r.id, row: r, x: b.right, y: below ? b.bottom + 6 : b.top - 6, below });
                      }}
                      style={{ background: 'none' }}>
                      <MoreVertical size={16} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11.5, color: '#94a3b8' }}>ID - {r.id}</span><Badge status={r.status} />
                  </div>
                </td>
                <td style={{ padding: '13px 14px', verticalAlign: 'top', minWidth: 230 }}>
                  <div style={{ color: '#334155' }}>{r.dates || '-'}</div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>Last edited: {r.edited || '—'}</div>
                </td>
                <td style={cell}><Metric row={r} k="sent" isPct={isPct} /></td>
                <td style={cell}><Metric row={r} k="delivered" isPct={isPct} /></td>
                <td style={cell}><Metric row={r} k="opened" isPct={isPct} /></td>
                <td style={cell}><Metric row={r} k="clicked" isPct={isPct} /></td>
                <td style={cell}><Metric row={r} k="conversions" isPct={isPct} /></td>
                <td style={cell}>{r.revenue ? nUS(r.revenue) : 0}</td>
                <td style={{ padding: '13px 14px', verticalAlign: 'top' }}>
                  {r.convGoal ? <span style={{ color: '#15803d', fontWeight: 600 }}>Set</span>
                    : <button onClick={() => navigate(`/netcore/journeys/${r.id}`)} style={linkBtn}>Set goal</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {menuFor && createPortal(
        <>
          <div onClick={() => setMenuFor(null)} style={{ position: 'fixed', inset: 0, zIndex: 1900 }} />
          <div style={{
            position: 'fixed', left: menuFor.x, top: menuFor.y, zIndex: 1901,
            transform: menuFor.below ? 'translateX(-100%)' : 'translate(-100%,-100%)',
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
            boxShadow: '0 12px 28px rgba(15,23,42,.18)', padding: 5, minWidth: 168,
          }}>
            {actionsFor(menuFor.row.status).map(a => (
              <button key={a.k} onClick={() => runAction(menuFor.row, a.k)}
                style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, background: 'none', cursor: 'pointer', padding: '8px 10px', borderRadius: 7, fontSize: 12.5, fontWeight: 500, color: a.danger ? '#dc2626' : '#334155' }}
                onMouseEnter={e => (e.currentTarget.style.background = a.danger ? '#fef2f2' : '#f5f7fb')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                {a.label}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}

      {/* pagination */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, fontSize: 12.5, color: '#64748b' }}>
          <span>Showing {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, filtered.length)} of {filtered.length}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={pageBtn(page <= 1)}>Prev</button>
            <span style={{ padding: '7px 4px' }}>Page {page} / {pageCount}</span>
            <button disabled={page >= pageCount} onClick={() => setPage(p => p + 1)} style={pageBtn(page >= pageCount)}>Next</button>
          </div>
        </div>
      )}

      {createStep === 'gallery' && (
        <GalleryModal onClose={() => setCreateStep(null)} onProceed={t => { setTpl(t); setCreateStep('details'); }} />
      )}
      {createStep === 'details' && (
        <CreateModal
          preset={tpl}
          onBack={() => setCreateStep('gallery')}
          onClose={() => { setCreateStep(null); setTpl(null); }}
          onCreate={async d => {
            // The server assigns the id, so the redirect has to wait for it. A failed
            // create throws (and has already toasted) — we stay on the modal rather
            // than navigating to /journeys/undefined.
            const j = await createJourney({ ...d, graph: tpl && tpl.graphObj ? tpl.graphObj : undefined });
            if (!j?.id) return;
            toast.success(tpl && !tpl.blank ? `Draft created from “${tpl.title}”.` : 'Draft created.');
            navigate(`/netcore/journeys/${j.id}`);
          }} />
      )}
      {confirm && (
        <ConfirmModal
          title={confirm.action === 'delete' ? 'Delete journey?' : confirm.action === 'stop' ? 'Stop journey?' : 'Archive journey?'}
          body={confirm.action === 'delete'
            ? `“${confirm.row.name}” will be permanently removed. This cannot be undone.`
            : confirm.action === 'stop'
              ? `“${confirm.row.name}” will stop. Students already waiting inside won't receive anything further.`
              : `“${confirm.row.name}” will be moved to Archived.`}
          danger={confirm.action === 'delete'}
          confirmLabel={confirm.action === 'delete' ? 'Delete' : confirm.action === 'stop' ? 'Stop' : 'Archive'}
          onCancel={() => setConfirm(null)} onConfirm={doConfirm} />
      )}
      {bulkConfirm && (
        <ConfirmModal
          title={bulkConfirm.action === 'delete' ? `Delete ${picked.size} journeys?` : `Archive ${picked.size} journeys?`}
          body={bulkConfirm.action === 'delete'
            ? `${picked.size} selected journeys will be permanently removed. This cannot be undone.`
            : `${picked.size} selected journeys will be moved to Archived.`}
          danger={bulkConfirm.action === 'delete'}
          confirmLabel={bulkConfirm.action === 'delete' ? 'Delete' : 'Archive'}
          onCancel={() => setBulkConfirm(null)} onConfirm={doBulkConfirm} />
      )}
    </div>
  );
}

function CreateModal({ preset, onBack, onClose, onCreate }) {
  const fromTemplate = preset && !preset.blank;
  const [name, setName] = useState(preset && preset.name ? preset.name : '');
  const [tags, setTags] = useState('');
  const [startAt, setStartAt] = useState(nowLocal());
  const [endType, setEndType] = useState('never');
  const [endAt, setEndAt] = useState('');
  // Journey goal
  const [goal, setGoal] = useState(false);
  const [goalEvent, setGoalEvent] = useState('batch_allotted');
  const [goalWindow, setGoalWindow] = useState('72');
  // Control group
  const [control, setControl] = useState(false);
  const [controlMode, setControlMode] = useState('Percentage');
  const [controlPct, setControlPct] = useState(10);
  const [controlList, setControlList] = useState(CONTROL_LISTS[0]);
  // DND
  const [dnd, setDnd] = useState(true);
  const [dndDays, setDndDays] = useState([1, 1, 1, 1, 1, 1, 1]);
  const [dndTimes, setDndTimes] = useState(Array.from({ length: 7 }, () => ({ f: '21:00', t: '09:30' })));

  const valid = name.trim().length > 0 && (endType === 'never' || !!endAt);

  const setDayTime = (i, key, val) => setDndTimes(t => t.map((x, ix) => ix === i ? { ...x, [key]: val } : x));
  const toggleDay = i => setDndDays(d => d.map((v, ix) => ix === i ? (v ? 0 : 1) : v));
  const copyForAll = () => {
    const first = dndDays.findIndex(Boolean);
    if (first < 0) return;
    const src = dndTimes[first];
    setDndTimes(t => t.map((x, ix) => dndDays[ix] ? { ...src } : x));
  };

  const submit = () => {
    const tagArr = tags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 5);
    const settings = {
      start: startAt, end: endType === 'date' ? 'On a date' : 'Never ending', endDate: endAt, tags: tagArr,
      goal, goalEvent, goalWindow,
      control, controlMode, controlPct, controlList,
      dnd, dndDays, dndTimes,
      cap: true, capN: 2,
    };
    onCreate({ name, tags: tagArr, startAt, endType, endAt, settings });
  };

  return (
    <Scrim onClose={onClose} width={560}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Create journey</h3>
        <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#64748b' }}>
        {fromTemplate
          ? <>Starting from <b style={{ color: '#1e3a8a' }}>{preset.title}</b> — the canvas will be pre-loaded. Change anything except the goal after publishing.</>
          : 'Set the details up front — you can change everything except the goal after publishing.'}
      </p>

      <div style={{ maxHeight: '64vh', overflowY: 'auto', paddingRight: 4, margin: '0 -4px 0 0' }}>
        {/* details */}
        <Field label="Journey name" req>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. iCAT · Entrance exam nudge" style={inp} />
        </Field>
        <Field label="Tags" hint="Up to 5, comma separated">
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder="offcampusly, icat" style={inp} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Start date" req><input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} style={inp} /></Field>
          <Field label="End date">
            <select value={endType} onChange={e => setEndType(e.target.value)} style={inp}>
              <option value="never">Never ending</option><option value="date">On a date</option>
            </select>
          </Field>
        </div>
        {endType === 'date' && <Field label="Ends at" req><input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} style={inp} /></Field>}

        {/* journey goal */}
        <Card title="Journey goal" desc="Count a student as converted when they fire this event after entering. Locked once published." on={goal} onToggle={() => setGoal(g => !g)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 10 }}>
            <Field label="Event"><select value={goalEvent} onChange={e => setGoalEvent(e.target.value)} style={inp}>{GOAL_EVENTS.map(x => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Window (hours)"><input type="number" min="1" value={goalWindow} onChange={e => setGoalWindow(e.target.value)} style={inp} /></Field>
          </div>
        </Card>

        {/* control group */}
        <Card title="Control group" desc="Hold a slice out of the journey so you can measure real lift." on={control} onToggle={() => setControl(c => !c)}>
          <div style={{ display: 'flex', gap: 4, background: '#eef1f6', padding: 3, borderRadius: 8, marginBottom: 10 }}>
            {['Percentage', 'Uploaded list'].map(m => (
              <button key={m} onClick={() => setControlMode(m)} style={{ flex: 1, border: 0, cursor: 'pointer', padding: '7px', borderRadius: 6, fontSize: 12.5, fontWeight: 600, background: controlMode === m ? '#fff' : 'transparent', color: controlMode === m ? '#1e3a8a' : '#64748b' }}>{m}</button>
            ))}
          </div>
          {controlMode === 'Percentage'
            ? <Field label="Hold back (%)"><input type="number" min="0" max="50" value={controlPct} onChange={e => setControlPct(e.target.value)} style={inp} /></Field>
            : <Field label="Control list"><select value={controlList} onChange={e => setControlList(e.target.value)} style={inp}>{CONTROL_LISTS.map(l => <option key={l}>{l}</option>)}</select></Field>}
        </Card>

        {/* DND */}
        <Card title="Do not disturb (DND)" desc="Messages are held during the blocked window and released when it opens. Evaluated in IST." on={dnd} onToggle={() => setDnd(d => !d)}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {DLET.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i)} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid ' + (dndDays[i] ? '#1e3a8a' : '#e2e8f0'), background: dndDays[i] ? '#1e3a8a' : '#fff', color: dndDays[i] ? '#fff' : '#94a3b8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{d}</button>
            ))}
          </div>
          {DAYS.map((d, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '84px 1fr 14px 1fr', gap: 7, alignItems: 'center', marginBottom: 6, opacity: dndDays[i] ? 1 : 0.4 }}>
              <span style={{ fontSize: 12, color: '#334155' }}>{d}</span>
              <input type="time" value={dndTimes[i].f} disabled={!dndDays[i]} onChange={e => setDayTime(i, 'f', e.target.value)} style={{ ...inp, padding: '7px 8px' }} />
              <span style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>to</span>
              <input type="time" value={dndTimes[i].t} disabled={!dndDays[i]} onChange={e => setDayTime(i, 't', e.target.value)} style={{ ...inp, padding: '7px 8px' }} />
            </div>
          ))}
          <button onClick={copyForAll} style={{ border: 0, background: 'none', color: '#c2410c', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', marginTop: 4, padding: 0 }}>Copy the first selected day to all</button>
        </Card>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button disabled={!valid} onClick={submit}
          style={{ padding: '10px 18px', borderRadius: 9, border: 0, background: valid ? '#1e3a8a' : '#cbd5e1', color: '#fff', fontWeight: 700, fontSize: 13, cursor: valid ? 'pointer' : 'not-allowed' }}>
          Save as draft &amp; continue
        </button>
        {onBack && <button onClick={onBack} style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Back</button>}
        <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
      </div>
    </Scrim>
  );
}

function GalleryModal({ onClose, onProceed }) {
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState('blank');
  const cats = ['All', ...Array.from(new Set(TEMPLATES.filter(t => !t.blank).map(t => t.cat)))];
  const needle = q.trim().toLowerCase();
  const shown = TEMPLATES.filter(t => t.blank || ((cat === 'All' || t.cat === cat) && (!needle || (t.title + ' ' + t.desc).toLowerCase().includes(needle))));
  const chosen = TEMPLATES.find(t => t.key === sel);

  return (
    <Scrim onClose={onClose} width={720}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Which type of journey would you like to create?</h3>
        <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Category</label>
          <select value={cat} onChange={e => setCat(e.target.value)} style={{ ...inp, width: 200 }}>{cats.map(c => <option key={c}>{c}</option>)}</select>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative', alignSelf: 'flex-end' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search templates…" style={{ ...inp, width: 230, paddingLeft: 30 }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxHeight: '52vh', overflowY: 'auto', paddingRight: 4 }}>
        {shown.map(t => {
          const on = sel === t.key;
          if (t.blank) return (
            <button key={t.key} onClick={() => setSel(t.key)}
              style={{ border: '1.5px ' + (on ? 'solid #1e3a8a' : 'dashed #cbd5e1'), background: on ? '#f5f8ff' : '#fff', borderRadius: 12, padding: 18, cursor: 'pointer', textAlign: 'center', minHeight: 138, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eef2ff', color: '#1e3a8a', display: 'grid', placeItems: 'center' }}><Plus size={22} /></div>
              <div style={{ fontWeight: 700, color: '#1e3a8a', fontSize: 14 }}>Create New</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Blank canvas</div>
            </button>
          );
          return (
            <button key={t.key} onClick={() => setSel(t.key)}
              style={{ border: '1.5px solid ' + (on ? '#1e3a8a' : '#e2e8f0'), background: on ? '#f5f8ff' : '#fff', borderRadius: 12, padding: 16, cursor: 'pointer', textAlign: 'left', minHeight: 138, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginBottom: 6 }}>{t.title}</div>
              <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, flex: 1 }}>{t.desc}</div>
              <div style={{ marginTop: 12, fontSize: 11, color: '#64748b' }}>Category: <b style={{ color: '#334155' }}>{t.cat}</b></div>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        <button disabled={!chosen} onClick={() => onProceed(chosen)}
          style={{ padding: '10px 22px', borderRadius: 9, border: 0, background: chosen ? '#1e3a8a' : '#cbd5e1', color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: '.3px', cursor: chosen ? 'pointer' : 'not-allowed' }}>PROCEED</button>
      </div>
    </Scrim>
  );
}

function Card({ title, desc, on, onToggle, children }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 12, marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <b style={{ fontSize: 13, color: '#0f172a' }}>{title}</b>
          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#94a3b8', lineHeight: 1.45 }}>{desc}</p>
        </div>
        <Toggle on={on} onClick={onToggle} />
      </div>
      {on && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}
function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick} aria-pressed={on} style={{ width: 38, height: 22, borderRadius: 999, border: 0, cursor: 'pointer', background: on ? '#15803d' : '#cbd5e1', position: 'relative', flex: 'none', transition: 'background .15s' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
    </button>
  );
}

function ConfirmModal({ title, body, confirmLabel, danger, onCancel, onConfirm }) {
  return (
    <Scrim onClose={onCancel} width={420}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{title}</h3>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{body}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        <button onClick={onConfirm} style={{ padding: '9px 18px', borderRadius: 9, border: 0, background: danger ? '#dc2626' : '#1e3a8a', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{confirmLabel}</button>
      </div>
    </Scrim>
  );
}

function Scrim({ children, onClose, width = 480 }) {
  return (
    <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.35)', display: 'grid', placeItems: 'center', zIndex: 60 }}>
      <div onMouseDown={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, width, maxWidth: '92vw', boxShadow: '0 24px 60px rgba(15,23,42,.28)' }}>
        {children}
      </div>
    </div>
  );
}
function Field({ label, req, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>{label}{req && <span style={{ color: '#ff6a1f' }}> *</span>}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

const iconBtn = { width: 38, height: 38, display: 'grid', placeItems: 'center', border: '1px solid #e2e8f0', borderRadius: 9, background: '#fff', color: '#475569', cursor: 'pointer' };
const toggleBtn = { width: 34, height: 30, display: 'grid', placeItems: 'center', border: 0, cursor: 'pointer' };
const linkBtn = { border: 0, background: 'none', color: '#2563eb', fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0 };
const inp = { width: '100%', padding: '9px 11px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, background: '#fff', outline: 'none', boxSizing: 'border-box' };
const pageBtn = disabled => ({ padding: '7px 13px', borderRadius: 8, border: '1px solid #e2e8f0', background: disabled ? '#f8fafc' : '#fff', color: disabled ? '#cbd5e1' : '#334155', fontWeight: 600, fontSize: 12.5, cursor: disabled ? 'not-allowed' : 'pointer' });
const bulkBtn = { padding: '7px 13px', borderRadius: 8, border: '1px solid #c7d2fe', background: '#fff', color: '#1e3a8a', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' };
