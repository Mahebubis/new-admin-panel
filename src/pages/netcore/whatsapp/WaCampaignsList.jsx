import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import { WA_API, WA_SET_API, FORM, WA, WA_CSS, fmtDt, n0 } from './waShared';
import { Badge, Spinner, WhatsAppIcon, Notice } from './WaUi';

const PER_PAGE_OPTS = [10, 25, 50, 100];

const TABS = [
  { key: 'all', label: 'All' }, { key: 'draft', label: 'Drafts' }, { key: 'sent', label: 'Sent' },
  { key: 'scheduled', label: 'Scheduled' }, { key: 'running', label: 'Running' },
  { key: 'suspended', label: 'Suspended' }, { key: 'failed', label: 'Failed' },
];

const COLS = [
  { key: 'sent_on', label: 'Sent on' },
  { key: 'total_recipients', label: 'Audience' },
  { key: 'sent_count', label: 'Sent' },
  { key: 'delivered_count', label: 'Delivered' },
  { key: 'read_count', label: 'Read' },
  // People, not taps — see clicked_users in wa_campaigns.php. Every other column on this row
  // counts people, and a Clicked that counted taps could exceed Sent, which it did.
  { key: 'clicked_users', label: 'Clicked' },
  { key: 'conversion_count', label: 'Converted' },
  { key: 'failed_count', label: 'Failed' },
  { key: 'skipped_dedup_count', label: 'Deduped' },
];

function menuFor(status) {
  switch (status) {
    case 'draft':     return ['edit', 'duplicate', 'delete'];
    case 'scheduled': return ['edit', 'duplicate', 'suspend'];
    case 'running':   return ['report', 'suspend'];
    case 'sent':      return ['report', 'duplicate', 'requeue'];
    case 'suspended': return ['resume', 'duplicate', 'delete'];
    case 'failed':    return ['report', 'requeue', 'duplicate', 'delete'];
    default:          return ['edit', 'duplicate', 'delete'];
  }
}
const MENU_LABELS = {
  edit: 'Edit', duplicate: 'Duplicate', delete: 'Delete', suspend: 'Suspend',
  resume: 'Resume', requeue: 'Retry failed', report: 'Detailed report',
};

/* "Sent on" must reflect what actually happened for that status rather than falling back to
   created_at — a draft has no "sent on" date at all. */
function sentOnValue(r) {
  switch (r.status) {
    case 'scheduled': return r.scheduled_at;
    case 'running':   return r.started_at;
    case 'sent':      return r.completed_at || r.started_at;
    case 'failed':    return r.started_at;
    case 'suspended': return r.scheduled_at || r.started_at;
    default:          return null;
  }
}

/* Live progress for a RUNNING campaign. While total_recipients is still 0 the worker hasn't
   materialized the audience yet — show an indeterminate bar rather than a false 0/0. The API
   returns these as strings, so coerce explicitly: `!"0"` is false in JS. */
function RunningProgress({ sent, total }) {
  const totalNum = Number(total) || 0;
  const sentNum = Number(sent) || 0;
  if (!totalNum) {
    return (
      <div style={{ marginTop: 5, width: 140 }}>
        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>Resolving audience…</div>
        <div className="wa-progress-track"><span className="wa-progress-indeterminate" /></div>
      </div>
    );
  }
  const pct = Math.min(100, Math.round((sentNum / totalNum) * 100));
  return (
    <div style={{ marginTop: 5, width: 140 }}>
      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>{n0(sent)} / {n0(total)} sent · {pct}%</div>
      <div className="wa-progress-track">
        <span style={{ width: `${pct}%`, background: WA.green, height: '100%', display: 'block', borderRadius: 999, transition: 'width .5s ease' }} />
      </div>
    </div>
  );
}

export default function WaCampaignsList() {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [settings, setSettings] = useState(null);
  const menuRef = useRef(null);

  const fetchPage = async (p = page, pp = perPage, t = tab, s = search, { silent = false } = {}) => {
    if (!silent) { setLoading(true); setOpenMenu(null); }
    try {
      const body = new URLSearchParams({ action: 'list', page: p, per_page: pp, status: t, search: s });
      const res = await api.post(WA_API, body, FORM);
      if (res.data.success) {
        const d = res.data.data;
        setRows(d.campaigns || []); setTotal(d.total || 0);
        setPage(d.page); setPages(d.pages); setPerPage(d.per_page); setCounts(d.counts || {});
      }
    } finally { if (!silent) setLoading(false); }
  };

  useEffect(() => { fetchPage(1, perPage, tab, search); }, [tab]); // eslint-disable-line

  // The setup banner is the single most useful thing on this page while the WABA is still
  // being provisioned — without a per-number API key nothing can be sent at all.
  useEffect(() => {
    (async () => {
      try {
        const res = await api.post(WA_SET_API, new URLSearchParams({ action: 'get' }), FORM);
        if (res.data.success) setSettings(res.data.data.settings);
      } catch { /* non-critical — the banner just won't render */ }
    })();
  }, []);

  const hasRunning = rows.some(r => r.status === 'running');
  useEffect(() => {
    if (!hasRunning) return;
    const t = setInterval(() => fetchPage(page, perPage, tab, search, { silent: true }), 6000);
    return () => clearInterval(t);
  }, [hasRunning, page, perPage, tab, search]); // eslint-disable-line

  useEffect(() => {
    if (!openMenu) return;
    const onDown = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openMenu]);

  const runAction = async (action, id) => {
    setOpenMenu(null);
    const t = toast.loading('Working…');
    try {
      const res = await api.post(WA_API, new URLSearchParams({ action, id }), FORM);
      if (res.data.success) { toast.success('Done', { id: t }); fetchPage(); }
      else toast.error(res.data.message || 'Failed', { id: t });
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error', { id: t }); }
  };

  const onMenuClick = (key, row) => {
    setOpenMenu(null);
    if (key === 'edit')      return nav(`/netcore/whatsapp/${row.id}`);
    if (key === 'report')    return nav(`/netcore/whatsapp/${row.id}/report`);
    if (key === 'duplicate') return runAction('duplicate', row.id);
    if (key === 'delete')    return setConfirm({ id: row.id, action: 'delete', label: 'delete this campaign' });
    if (key === 'suspend')   return setConfirm({ id: row.id, action: 'pause', label: 'suspend this campaign' });
    if (key === 'resume')    return runAction('resume', row.id);
    if (key === 'requeue')   return runAction('requeue', row.id);
  };

  const notReady = settings && !settings.ready;

  return (
    <>
      <style>{WA_CSS}</style>

      <div className="wa" style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, flexShrink: 0, gap: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ width: 40, height: 40, borderRadius: 10, background: WA.green, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <WhatsAppIcon size={22} color="#fff" />
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>WhatsApp campaigns</h2>
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>
                Send approved WhatsApp templates to your segments and lists — with deduplication, personalization and delivery tracking
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <button onClick={() => nav('/netcore/whatsapp/templates')} title="WhatsApp templates"
              style={{ padding: '11px 16px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, cursor: 'pointer', color: '#475569', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
              Templates
            </button>
            <button onClick={() => nav('/netcore/whatsapp/settings')} title="WhatsApp API settings"
              style={{ width: 42, height: 42, border: `1.5px solid ${notReady ? '#fca5a5' : '#e2e8f0'}`, background: notReady ? '#fef2f2' : '#fff', borderRadius: 8, cursor: 'pointer', color: notReady ? '#dc2626' : '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            </button>
            <button onClick={() => nav('/netcore/whatsapp/new')}
              style={{ padding: '11px 22px', background: WA.green, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, letterSpacing: '.4px', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M12 5v14M5 12h14" /></svg> Create
            </button>
          </div>
        </div>

        {notReady && (
          <Notice tone="warn" title="Finish connecting WhatsApp before sending" style={{ margin: '12px 0 4px' }}>
            {settings.sender_count === 0
              ? <div>• No sending numbers added yet.</div>
              : <div>• <b>None of your {settings.sender_count} number(s) has an API key.</b> Netcore issues the key per business number — copy it from Business number → Edit → Integrate API.</div>}
            <div style={{ marginTop: 6 }}>
              <button onClick={() => nav('/netcore/whatsapp/settings')}
                style={{ border: 'none', background: 'none', color: '#1e3a8a', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}>
                Open WhatsApp settings →
              </button>
            </div>
          </Notice>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', margin: '14px 0', flexShrink: 0, gap: 16 }}>
          <div style={{ display: 'flex', overflowX: 'auto' }}>
            {TABS.map(t => (
              <button key={t.key} className={`wa-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
                {t.label} ({n0(counts[t.key])})
              </button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchPage(1, perPage, tab, search)}
            placeholder="Search campaigns…"
            style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', outline: 'none', width: 200, marginBottom: 6, flexShrink: 0 }} />
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
                    <th key={c.key} style={{ padding: '14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading ? (
                  <tr><td colSpan={COLS.length + 1} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                    No WhatsApp campaigns yet. Click "Create" to build your first one.
                  </td></tr>
                ) : rows.map(r => (
                  <tr key={r.id} className="wa-row">
                    <td style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ color: WA.greenDark, marginTop: 2, flexShrink: 0 }}><WhatsAppIcon size={15} /></span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ color: '#0f172a', fontWeight: 600, fontSize: 13 }}>{r.name}</span>
                            <Badge status={r.status} />
                            {Number(r.dedup_enabled) === 1 && (
                              <span title="Deduplication is on for this campaign"
                                style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 5, letterSpacing: '.3px' }}>DEDUP</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                            ID - {r.id}{r.template_name ? ` · ${r.template_name}` : ' · free text'}
                            {/* Only shown once a campaign has actually been sent/scheduled — a
                                draft hasn't snapshotted its sending number yet. */}
                            {r.business_number ? ` · from ${r.business_number}` : ''}
                          </div>
                          {r.status === 'running' && <RunningProgress sent={r.sent_count} total={r.total_recipients} />}
                        </div>
                        <div style={{ position: 'relative', marginLeft: 'auto' }}>
                          <button className={`wa-dots${openMenu === r.id ? ' open' : ''}`}
                            onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === r.id ? null : r.id); }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2.2" /><circle cx="12" cy="12" r="2.2" /><circle cx="12" cy="19" r="2.2" /></svg>
                          </button>
                          {openMenu === r.id && (
                            <div ref={menuRef} style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: '#fff', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', border: '1px solid #e2e8f0', zIndex: 50, width: 180, padding: 6 }}>
                              {menuFor(r.status).map(k => (
                                <button key={k} onClick={() => onMenuClick(k, r)}
                                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: k === 'delete' ? '#dc2626' : '#334155', borderRadius: 6, fontFamily: 'inherit' }}
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
                    <td style={{ padding: 14, borderBottom: '1px solid #f1f5f9', color: '#475569', whiteSpace: 'nowrap' }}>{fmtDt(sentOnValue(r))}</td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{n0(r.total_recipients)}</td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f1f5f9', color: '#475569', fontWeight: 600 }}>{n0(r.sent_count)}</td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f1f5f9', color: '#475569' }}
                      title="Only moves when the delivery webhook is registered in the Netcore panel">{n0(r.delivered_count)}</td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{n0(r.read_count)}</td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f1f5f9', color: '#475569' }}
                        title={`${n0(r.click_count)} tap${Number(r.click_count) === 1 ? '' : 's'} in total`}>
                      {n0(r.clicked_users)}
                    </td>
                    {/* An em dash, not 0, when no goal was set. "0 conversions" and "we weren't
                        counting" are different statements and a report must not conflate them. */}
                    <td style={{ padding: 14, borderBottom: '1px solid #f1f5f9', color: r.goal_event_name ? '#7c3aed' : '#cbd5e1', fontWeight: r.goal_event_name ? 700 : 400 }}
                      title={r.goal_event_name
                        ? `Recipients who did "${r.goal_event_name}" within the conversion window`
                        : 'No conversion goal set for this campaign'}>
                      {r.goal_event_name ? n0(r.conversion_count) : '—'}
                    </td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f1f5f9', color: Number(r.failed_count) > 0 ? '#dc2626' : '#475569' }}>{n0(r.failed_count)}</td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f1f5f9', color: '#15803d' }}
                      title="Contacts skipped because they were messaged too recently">{n0(r.skipped_dedup_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 13, color: '#475569', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Per page:</span>
            <select value={perPage} onChange={e => fetchPage(1, parseInt(e.target.value, 10), tab, search)}
              style={{ padding: '6px 10px', border: '1.5px solid #c4b5fd', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none', background: '#fff', cursor: 'pointer' }}>
              {PER_PAGE_OPTS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span style={{ marginLeft: 8, color: '#94a3b8' }}>{n0(total)} total</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Page {page} of {pages || 1}</span>
            <button disabled={page <= 1 || loading} onClick={() => fetchPage(page - 1, perPage, tab, search)}
              style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Prev</button>
            <button disabled={page >= pages || loading} onClick={() => fetchPage(page + 1, perPage, tab, search)}
              style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: page >= pages ? 'not-allowed' : 'pointer', opacity: page >= pages ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Next</button>
          </div>
        </div>
      </div>

      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setConfirm(null)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 380, textAlign: 'center', fontFamily: "'Plus Jakarta Sans',sans-serif" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>Are you sure you want to {confirm.label}?</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setConfirm(null)} style={{ padding: '10px 22px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>NO</button>
              <button onClick={() => { runAction(confirm.action, confirm.id); setConfirm(null); }}
                style={{ padding: '10px 22px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>YES</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
