import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Helmet } from "react-helmet-async";

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/support/support_panel.php';
const post = d => fetch(API, { method: 'POST', body: new URLSearchParams(d) }).then(r => r.json());

/* ─── helpers ─── */
const fmtDate = d => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
  } catch { return d; }
};
const truncate = (s, n = 50) => {
  const decoded = s ? s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'") : '';
  return decoded.length > n ? decoded.slice(0, n) + '...' : decoded;
};

/* ─── stat card ─── */
const StatCard = ({ label, value, color, bg, border }) => (
  <div style={{
    background: '#fff', borderRadius: 12, border: `1.5px solid ${border}`,
    padding: '16px 20px', textAlign: 'center', boxShadow: '0 1px 6px rgba(79,70,229,.07)',
    minWidth: 120, flex: 1
  }}>
    <div style={{ fontSize: 28, fontWeight: 800, color }}>{value ?? '—'}</div>
    <div style={{
      fontSize: 11.5, fontWeight: 600, color: '#64748b', marginTop: 4,
      textTransform: 'uppercase', letterSpacing: '.04em'
    }}>{label}</div>
  </div>
);

/* ─── status badge ─── */
const StatusBadge = ({ status }) => {
  const cfg = {
    open: { bg: '#dcfce7', color: '#15803d' },
    closed: { bg: '#fee2e2', color: '#b91c1c' },
    pending: { bg: '#fef9c3', color: '#854d0e' },
  };
  const c = cfg[status?.toLowerCase()] || { bg: '#f3f4f6', color: '#6b7280' };
  const lbl = status ? status.charAt(0).toUpperCase() + status.slice(1) : '—';
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 99,
      fontSize: 11, fontWeight: 700, background: c.bg, color: c.color
    }}>
      {lbl}
    </span>
  );
};

/* ─── pagination ─── */
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  const start = Math.max(1, page - 5);
  const end = Math.min(totalPages, page + 4);
  const pages = [];
  for (let i = start; i <= end; i++) pages.push(i);

  const bS = (active, disabled) => ({
    padding: '5px 11px', border: `1.5px solid ${active ? '#4f46e5' : '#e2e8f0'}`, borderRadius: 6,
    fontSize: 12, fontWeight: active ? 700 : 500, cursor: disabled ? 'not-allowed' : 'pointer',
    background: active ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#fff',
    color: active ? '#fff' : '#475569', opacity: disabled ? .4 : 1, fontFamily: 'inherit',
  });

  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
      {page > 1 && (
        <>
          <button style={bS(false, false)} onClick={() => onChange(1)}>First</button>
          <button style={bS(false, false)} onClick={() => onChange(page - 1)}>‹</button>
        </>
      )}
      {pages.map(p => (
        <button key={p} style={bS(p === page, false)} onClick={() => onChange(p)}>{p}</button>
      ))}
      {page < totalPages && (
        <>
          <button style={bS(false, false)} onClick={() => onChange(page + 1)}>›</button>
          <button style={bS(false, false)} onClick={() => onChange(totalPages)}>Last</button>
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
export default function SupportPanel() {
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [agentId, setAgentId] = useState('');
  const [loading, setLoading] = useState(false);

  /* ── agent lookup map ── */
  const agentMap = useMemo(() => {
    const m = {};
    agents.forEach(a => { m[a.agent_id] = a.agent_name; });
    return m;
  }, [agents]);

  /* ── load stats + agents on mount ── */
  useEffect(() => {
    post({ action: 'get_stats' }).then(r => { if (r.success) setStats(r); }).catch(() => { });
    post({ action: 'get_agents' }).then(r => { if (r.success) setAgents(r.agents || []); }).catch(() => { });
  }, []);

  /* ── load tickets ── */
  const loadTickets = useCallback(async (p = page, aid = agentId, pp = perPage) => {
    setLoading(true);
    try {
      const params = { action: 'get_tickets', page: p, per_page: pp };
      if (aid) params.agent_id = aid;
      const res = await post(params);
      if (!res.success) { toast.error(res.message || 'Failed'); return; }
      setTickets(res.tickets || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [page, agentId, perPage]);

  useEffect(() => { loadTickets(page, agentId, perPage); }, [page]);

  const handleAgentChange = (val) => {
    setAgentId(val); setPage(1);
    loadTickets(1, val, perPage);
  };
  const handlePerPage = (val) => {
    setPerPage(+val); setPage(1);
    loadTickets(1, agentId, +val);
  };
  const handlePage = (p) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── styles ── */
  const thS = {
    padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#fff', textAlign: 'left',
    textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap',
    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
    borderRight: '1px solid rgba(255,255,255,.15)', position: 'sticky', top: 0, zIndex: 2,
  };
  const tdS = {
    padding: '11px 14px', fontSize: 12.5, color: '#1e293b',
    borderBottom: '1px solid #f5f3ff', verticalAlign: 'middle'
  };
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <>
    <Helmet>
        <title>Support Ticket | Admin Panel</title>
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .sp-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .sp-tr:hover td { background:#faf9ff!important; }
        .sp-sel:focus { border-color:#4f46e5!important; box-shadow:0 0 0 3px rgba(79,70,229,.1)!important; }
        @keyframes sp_spin { to { transform:rotate(360deg); } }
        .sp-spin { display:inline-block;width:18px;height:18px;border:2.5px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:sp_spin .7s linear infinite; }
      `}</style>

      <div className="sp-root" style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100vh - 62px)', padding: 20, gap: 14, overflow: 'hidden', background: '#f5f3ff'
      }}>

        {/* ── HEADER ── */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>🎫 Support Panel</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Manage and track customer support tickets</div>
          </div>
          <button onClick={() => { post({ action: 'get_stats' }).then(r => { if (r.success) setStats(r); }); loadTickets(page, agentId, perPage); }}
            style={{
              padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', color: '#fff', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7
            }}>
            🔄 Refresh
          </button>
        </div>

        {/* ── STATS ── */}
        <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
          <StatCard label="Open Tickets" value={stats?.open} color="#15803d" bg="#dcfce7" border="#bbf7d0" />
          <StatCard label="Pending" value={stats?.pending} color="#854d0e" bg="#fef9c3" border="#fde68a" />
          <StatCard label="Closed Tickets" value={stats?.closed} color="#b91c1c" bg="#fee2e2" border="#fca5a5" />
          <StatCard label="Total" value={stats?.total} color="#4f46e5" bg="#ede9fe" border="#c4b5fd" />
        </div>

        {/* ── MAIN CARD ── */}
        <div style={{
          flex: 1, minHeight: 0, background: '#fff', borderRadius: 14,
          border: '1.5px solid #ede9fe', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', boxShadow: '0 1px 8px rgba(79,70,229,.07)'
        }}>

          {/* ── TOOLBAR ── */}
          <div style={{
            padding: '12px 16px', borderBottom: '1.5px solid #f5f3ff', flexShrink: 0,
            display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap'
          }}>

            {/* agent filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
                Filter by Agent:
              </label>
              <select className="sp-sel" value={agentId} onChange={e => handleAgentChange(e.target.value)}
                style={{
                  padding: '7px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
                  fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none',
                  background: '#fff', cursor: 'pointer', appearance: 'auto', minWidth: 160
                }}>
                <option value="">All Agents</option>
                {agents.map(a => (
                  <option key={a.agent_id} value={a.agent_id}>{a.agent_name}</option>
                ))}
              </select>
            </div>

            {/* per page */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
                Per page:
              </label>
              <select className="sp-sel" value={perPage} onChange={e => handlePerPage(e.target.value)}
                style={{
                  padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8,
                  fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none',
                  background: '#fff', cursor: 'pointer', appearance: 'auto'
                }}>
                {[10, 25, 50].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            {/* result info */}
            <div style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>
              {loading
                ? <span className="sp-spin" />
                : total > 0 && <>Showing <strong style={{ color: '#1e293b' }}>{from}–{to}</strong> of <strong style={{ color: '#4f46e5' }}>{total}</strong> tickets</>}
            </div>
          </div>

          {/* ── TABLE ── */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
              <thead>
                <tr>
                  {['Ticket ID', 'User ID', 'Subject', 'Status', 'Assigned Agent', 'Created At', 'Actions'].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && !tickets.length ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
                    <div className="sp-spin" style={{ width: 28, height: 28, margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 13 }}>Loading tickets...</div>
                  </td></tr>
                ) : !tickets.length ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
                    <div style={{ fontSize: 38, marginBottom: 10 }}>🎫</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>No tickets found</div>
                    {agentId && <div style={{ fontSize: 12, marginTop: 4 }}>No tickets assigned to the selected agent</div>}
                  </td></tr>
                ) : tickets.map(t => (
                  <tr key={t.ticket_id} className="sp-tr">
                    {/* Ticket ID */}
                    <td style={tdS}>
                      <span style={{
                        fontFamily: 'monospace', fontSize: 12, background: '#f5f3ff',
                        color: '#4f46e5', padding: '2px 8px', borderRadius: 5, fontWeight: 600
                      }}>
                        #{t.ticket_id}
                      </span>
                    </td>
                    {/* User ID */}
                    <td style={{ ...tdS, color: '#64748b', fontSize: 12 }}>{t.user_id}</td>
                    {/* Subject */}
                    <td style={{ ...tdS, maxWidth: 220 }}>
                      <div style={{
                        fontSize: 12.5, fontWeight: 500, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210
                      }}
                        title={truncate(t.subject, 200)}>
                        {truncate(t.subject)}
                      </div>
                    </td>
                    {/* Status */}
                    <td style={tdS}><StatusBadge status={t.status} /></td>
                    {/* Agent */}
                    <td style={{ ...tdS, fontSize: 12.5 }}>
                      {agentMap[t.agent_id]
                        ? <span style={{ fontWeight: 600 }}>{agentMap[t.agent_id]}</span>
                        : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</span>}
                    </td>
                    {/* Created At */}
                    <td style={{ ...tdS, fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                      {fmtDate(t.created_at)}
                    </td>
                    {/* Actions */}
                    <td style={tdS}>
                      <Link to={`/support/ticket/${t.ticket_id}`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px',
                          border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          color: '#fff', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                          textDecoration: 'none', whiteSpace: 'nowrap'
                        }}>
                        👁 View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── PAGINATION ── */}
          {totalPages > 1 && (
            <div style={{ padding: '12px 16px', borderTop: '1.5px solid #f5f3ff', flexShrink: 0 }}>
              <Pagination page={page} totalPages={totalPages} onChange={handlePage} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}