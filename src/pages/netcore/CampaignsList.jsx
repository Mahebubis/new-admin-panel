import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import CampaignCreateFlow from './CampaignCreateFlow';

const API = '/api/campaigns/campaigns.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const PER_PAGE_OPTS = [10, 25, 50, 100];

const TABS = [
  { key: 'all', label: 'All' }, { key: 'draft', label: 'Drafts' }, { key: 'sent', label: 'Sent' },
  { key: 'scheduled', label: 'Scheduled' }, { key: 'suspended', label: 'Suspended' },
  { key: 'running', label: 'Running' }, { key: 'failed', label: 'Failed' },
];

const BADGE = {
  draft:     { bg: '#ede9fe', fg: '#6d28d9', label: 'DRAFT' },
  scheduled: { bg: '#fef3c7', fg: '#b45309', label: 'SCHEDULED' },
  running:   { bg: '#dbeafe', fg: '#1d4ed8', label: 'RUNNING' },
  sent:      { bg: '#dcfce7', fg: '#15803d', label: 'SENT' },
  suspended: { bg: '#fed7aa', fg: '#c2410c', label: 'SUSPENDED' },
  failed:    { bg: '#fee2e2', fg: '#dc2626', label: 'FAILED' },
};

function Badge({ status }) {
  const b = BADGE[status] || BADGE.draft;
  return <span style={{ background: b.bg, color: b.fg, fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999, letterSpacing: '.4px', whiteSpace: 'nowrap' }}>{b.label}</span>;
}

/* Small live progress bar shown under the badge for RUNNING campaigns.
   While total_recipients is still 0, the audience hasn't been materialized by the
   worker's next tick yet — show an indeterminate "preparing" bar instead of a false 0/0. */
function RunningProgress({ sent, total }) {
  // The API returns these as text ("0"), not numbers — a plain `!total` check treats the
  // string "0" as truthy (only a real empty string or the number 0 is falsy in JS), which
  // let this fall through to real math on text and produce "NaN%" instead of the intended
  // "still preparing" message. Coerce explicitly instead of trusting the wire type.
  const totalNum = Number(total) || 0;
  const sentNum = Number(sent) || 0;
  if (!totalNum) {
    return (
      <div style={{ marginTop: 5, width: 130 }}>
        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>Preparing recipient list…</div>
        <div className="nc-progress-track"><span className="nc-progress-indeterminate" /></div>
      </div>
    );
  }
  const pct = Math.min(100, Math.round((sentNum / totalNum) * 100));
  return (
    <div style={{ marginTop: 5, width: 130 }}>
      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>{n0(sent)} / {n0(total)} sent · {pct}%</div>
      <div className="nc-progress-track"><span style={{ width: `${pct}%`, background: '#1d4ed8', height: '100%', display: 'block', borderRadius: 999, transition: 'width .5s ease' }} /></div>
    </div>
  );
}

/* "Sent on" must reflect what actually happened for that status, not just fall back to
   created_at — a draft that's never been sent/scheduled has no "sent on" date at all. */
function sentOnValue(r) {
  switch (r.status) {
    case 'scheduled': return r.scheduled_at;
    case 'running':   return r.started_at;
    case 'sent':      return r.completed_at || r.started_at;
    case 'failed':    return r.started_at;
    case 'suspended': return r.scheduled_at || r.started_at;
    default:          return null; // draft — nothing has happened yet
  }
}

function Spinner({ size = 32 }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', border: '3px solid #c4b5fd', borderTopColor: '#4f46e5', animation: 'nc_spin 0.85s linear infinite' }} />;
}

function fmtDt(s) {
  if (!s) return 'NA';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d.getTime())) return s;
  const pad = n => String(n).padStart(2, '0');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()} ${pad(d.getHours() % 12 || 12)}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}
const n0 = v => Number(v || 0).toLocaleString();

const COLS = [
  { key: 'sent_on', label: 'Sent on' },
  { key: 'total_recipients', label: 'Published' },
  { key: 'sent_count', label: 'Sent' },
  { key: 'delivered_count', label: 'Delivered' },
  { key: 'unique_open_count', label: 'Opened / Read' },
  { key: 'unique_click_count', label: 'Clicked' },
  { key: 'conversions', label: 'Conversions' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'unsubscribe_count', label: 'Unsubscribed' },
  { key: 'bounce_count', label: 'Bounce' },
];

function menuFor(status) {
  switch (status) {
    case 'draft':     return ['edit', 'duplicate', 'delete'];
    case 'scheduled': return ['edit', 'duplicate', 'suspend'];
    case 'running':   return ['report', 'suspend'];
    case 'sent':      return ['report', 'duplicate', 'requeue'];
    case 'suspended': return ['resume', 'duplicate', 'delete'];
    case 'failed':    return ['requeue', 'report', 'duplicate'];
    default:          return ['edit', 'duplicate', 'delete'];
  }
}
const MENU_LABELS = {
  edit: 'Edit', duplicate: 'Duplicate', delete: 'Delete', suspend: 'Suspend',
  resume: 'Resume', requeue: 'Requeue', report: 'Detailed Report',
};

export default function CampaignsList() {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [menuFor_, setMenuFor_] = useState(null);
  const [confirm, setConfirm] = useState(null); // { id, action, label }
  const [flow, setFlow] = useState(null);
  const menuRef = useRef(null);

  const fetchPage = async (p = page, pp = perPage, t = tab, { silent = false } = {}) => {
    if (!silent) { setLoading(true); setMenuFor_(null); }
    try {
      const body = new URLSearchParams({ action: 'list', page: p, per_page: pp, status: t });
      const res = await api.post(API, body, FORM);
      if (res.data.success) {
        const d = res.data.data;
        setRows(d.campaigns || []); setTotal(d.total || 0);
        setPage(d.page); setPages(d.pages); setPerPage(d.per_page); setCounts(d.counts || {});
      }
    } finally { if (!silent) setLoading(false); }
  };
  useEffect(() => { fetchPage(1, perPage, tab); }, [tab]); // eslint-disable-line

  /* Live progress: while any visible row is RUNNING, quietly re-poll every 6s
     (no spinner flash) so the progress bar advances without a manual refresh. */
  const hasRunning = rows.some(r => r.status === 'running');
  useEffect(() => {
    if (!hasRunning) return;
    const t = setInterval(() => fetchPage(page, perPage, tab, { silent: true }), 6000);
    return () => clearInterval(t);
  }, [hasRunning, page, perPage, tab]); // eslint-disable-line

  useEffect(() => {
    if (!menuFor_) return;
    const onDown = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuFor_(null); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuFor_]);

  const runAction = async (action, id) => {
    setMenuFor_(null);
    const t = toast.loading('Working…');
    try {
      const res = await api.post(API, new URLSearchParams({ action, id }), FORM);
      if (res.data.success) { toast.success('Done', { id: t }); fetchPage(); }
      else toast.error(res.data.message || 'Failed', { id: t });
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error', { id: t }); }
  };

  const onMenuClick = (key, row) => {
    setMenuFor_(null);
    if (key === 'edit') return nav(`/netcore/campaigns/${row.id}`);
    if (key === 'report') return nav(`/netcore/campaigns/${row.id}/report`);
    if (key === 'duplicate') return runAction('duplicate', row.id).then(() => {});
    if (key === 'delete') return setConfirm({ id: row.id, action: 'delete', label: 'delete this campaign' });
    if (key === 'suspend') return setConfirm({ id: row.id, action: 'pause', label: 'suspend this campaign' });
    if (key === 'resume') return runAction('resume', row.id);
    if (key === 'requeue') return runAction('requeue', row.id);
  };

  return (
    <>
      <style>{`
        @keyframes nc_spin { to { transform: rotate(360deg); } }
        .nc-camp *{ box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .nc-camp-tab { padding: 10px 4px; margin-right: 22px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap; background:none; border-top:none; border-left:none; border-right:none; }
        .nc-camp-tab.active { color: #1e3a8a; border-bottom-color: #1e3a8a; }
        .nc-camp-row:hover td { background: #f5f3ff; }
        .nc-camp-dots { background: none; border: none; cursor: pointer; padding: 4px; color: #1e293b; border-radius: 6px; }
        .nc-camp-dots:hover, .nc-camp-dots.open { color: #1e3a8a; background: #eef2ff; }
        .nc-progress-track { position: relative; height: 5px; border-radius: 999px; background: #e2e8f0; overflow: hidden; }
        .nc-progress-indeterminate { position: absolute; top: 0; left: -40%; height: 100%; width: 40%; background: #1d4ed8; border-radius: 999px; animation: nc_indeterminate 1.1s ease-in-out infinite; }
        @keyframes nc_indeterminate { 0% { left: -40%; } 100% { left: 100%; } }
      `}</style>

      <div className="nc-camp" style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Campaigns</h2>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>Create, send and track your email campaigns</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => nav('/netcore/settings')} title="Email provider settings"
              style={{ width: 40, height: 40, border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, cursor: 'pointer', color: '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            </button>
            <button onClick={() => setFlow('create')}
              style={{ padding: '11px 22px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: '.4px', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M12 5v14M5 12h14" /></svg> Create
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: 14, flexShrink: 0, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.key} className={`nc-camp-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label} ({n0(counts[t.key])})
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.05)', overflow: 'hidden', position: 'relative' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.85)', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
          )}
          <div style={{ height: '100%', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2 }}>
                <tr>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Campaign name</th>
                  {COLS.map(c => (
                    <th key={c.key} style={{ padding: '14px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading
                  ? <tr><td colSpan={COLS.length + 1} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No campaigns yet. Click "Create" to start.</td></tr>
                  : rows.map(r => (
                    <tr key={r.id} className="nc-camp-row">
                      <td style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1e3a8a" strokeWidth={2}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" /></svg>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ color: '#0f172a', fontWeight: 600, fontSize: 13 }}>{r.name}</span>
                              <Badge status={r.status} />
                            </div>
                            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>ID - {r.id}</div>
                            {r.status === 'running' && <RunningProgress sent={r.sent_count} total={r.total_recipients} />}
                          </div>
                          <div style={{ position: 'relative', marginLeft: 'auto' }}>
                            <button className={`nc-camp-dots${menuFor_ === r.id ? ' open' : ''}`}
                              onClick={e => { e.stopPropagation(); setMenuFor_(menuFor_ === r.id ? null : r.id); }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2.2" /><circle cx="12" cy="12" r="2.2" /><circle cx="12" cy="19" r="2.2" /></svg>
                            </button>
                            {menuFor_ === r.id && (
                              <div ref={menuRef} style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: '#fff', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', border: '1px solid #e2e8f0', zIndex: 50, width: 180, padding: 6 }}>
                                {menuFor(r.status).map(k => (
                                  <button key={k} onClick={() => onMenuClick(k, r)}
                                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: k === 'delete' ? '#dc2626' : '#334155', borderRadius: 6 }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    {MENU_LABELS[k]}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 14px', borderBottom: '1px solid #f1f5f9', color: '#475569', whiteSpace: 'nowrap' }}>{fmtDt(sentOnValue(r))}</td>
                      <td style={{ padding: '14px 14px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{n0(r.total_recipients)}</td>
                      <td style={{ padding: '14px 14px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{n0(r.sent_count)}</td>
                      <td style={{ padding: '14px 14px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{n0(r.delivered_count)}</td>
                      <td style={{ padding: '14px 14px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{n0(r.unique_open_count)}</td>
                      <td style={{ padding: '14px 14px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{n0(r.unique_click_count)}</td>
                      <td style={{ padding: '14px 14px', borderBottom: '1px solid #f1f5f9', color: r.goal_event_name ? '#475569' : '#94a3b8' }} title={r.goal_event_name ? '' : 'No conversion goal set for this campaign'}>
                        {r.goal_event_name ? n0(r.conversion_count) : 'NA'}
                      </td>
                      <td style={{ padding: '14px 14px', borderBottom: '1px solid #f1f5f9', color: '#94a3b8' }} title="Revenue tracking isn't wired yet">NA</td>
                      <td style={{ padding: '14px 14px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{n0(r.unsubscribe_count)}</td>
                      <td style={{ padding: '14px 14px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{n0(r.bounce_count)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 13, color: '#475569', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Per page:</span>
            <select value={perPage} onChange={e => { const v = parseInt(e.target.value, 10); fetchPage(1, v, tab); }}
              style={{ padding: '6px 10px', border: '1.5px solid #c4b5fd', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none', background: '#fff', cursor: 'pointer' }}>
              {PER_PAGE_OPTS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span style={{ marginLeft: 8, color: '#94a3b8' }}>{n0(total)} total</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Page {page} of {pages || 1}</span>
            <button disabled={page <= 1 || loading} onClick={() => fetchPage(page - 1, perPage, tab)}
              style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Prev</button>
            <button disabled={page >= pages || loading} onClick={() => fetchPage(page + 1, perPage, tab)}
              style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: page >= pages ? 'not-allowed' : 'pointer', opacity: page >= pages ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Next</button>
          </div>
        </div>
      </div>

      <CampaignCreateFlow flow={flow} setFlow={setFlow} />

      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setConfirm(null)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 380, textAlign: 'center', fontFamily: "'Plus Jakarta Sans',sans-serif" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>Are you sure you want to {confirm.label}?</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setConfirm(null)} style={{ padding: '10px 22px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>NO</button>
              <button onClick={() => { runAction(confirm.action, confirm.id); setConfirm(null); }} style={{ padding: '10px 22px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>YES</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
