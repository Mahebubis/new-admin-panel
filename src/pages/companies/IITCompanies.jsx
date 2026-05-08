import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/companies/iit_companies.php';
const PER_PAGE = 10;

const post = d => fetch(API, { method: 'POST', body: new URLSearchParams(d) }).then(r => r.json());

/* ─── helpers ─── */
const copyToClipboard = (text) =>
  navigator.clipboard.writeText(text).then(() => toast.success('Copied!')).catch(() => toast.error('Failed'));

/* ─── status badge ─── */
const StatusBadge = ({ status }) => {
  const cfg = {
    active: { bg: '#dcfce7', color: '#15803d', label: '✅ Active' },
    inactive: { bg: '#dbeafe', color: '#1d4ed8', label: '🔵 Inactive' },
    blocked: { bg: '#fee2e2', color: '#b91c1c', label: '🔴 Blocked' },
  };
  const c = cfg[status] || { bg: '#f3f4f6', color: '#374151', label: status };
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 99,
      fontSize: 11, fontWeight: 700, background: c.bg, color: c.color
    }}>
      {c.label}
    </span>
  );
};

/* ─── IIT block modal (remove from event, NOT status block) ─── */
function IITRemoveModal({ company, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) { toast.error('Please enter a reason'); return; }
    setLoading(true);
    await onConfirm(company.employer_id, reason.trim());
    setLoading(false);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '26px 28px', width: 460,
        maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>🎓 Remove from IIT E-Summit</div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: '#94a3b8', padding: 4
          }}>×</button>
        </div>

        {/* info banner */}
        <div style={{
          background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 9,
          padding: '10px 14px', marginBottom: 16, fontSize: 12.5, color: '#92400e'
        }}>
          ⚠️ This will remove <strong>{company.employer_name}</strong> from the IIT E-Summit event (<code style={{ background: '#ffedd5', padding: '1px 5px', borderRadius: 4 }}>special_event = 0</code>).
          Their company account remains active on the platform.
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{
            fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
            letterSpacing: '.5px', display: 'block', marginBottom: 6
          }}>Removal Reason *</label>
          <textarea autoFocus value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Enter reason for removing from IIT E-Summit..."
            rows={3}
            style={{
              width: '100%', padding: '10px 12px', border: '1.5px solid #c4b5fd', borderRadius: 8,
              fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', color: '#1e293b'
            }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose}
            style={{
              padding: '8px 16px', border: '1.5px solid #e2e8f0', borderRadius: 8,
              background: '#fff', color: '#475569', fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit'
            }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            style={{
              padding: '8px 22px', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', color: '#fff', fontFamily: 'inherit', opacity: loading ? .7 : 1,
              background: 'linear-gradient(135deg,#dc2626,#b91c1c)'
            }}>
            {loading ? '⏳ Removing...' : '🚫 Remove from Event'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── stat card ─── */
const StatCard = ({ label, value, color }) => (
  <div style={{
    background: '#fff', borderRadius: 12, border: '1.5px solid #ede9fe',
    padding: '14px 18px', textAlign: 'center', boxShadow: '0 1px 6px rgba(79,70,229,.07)'
  }}>
    <div style={{ fontSize: 26, fontWeight: 800, color }}>{value?.toLocaleString('en-IN') ?? '—'}</div>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b', marginTop: 4 }}>{label}</div>
  </div>
);

/* ─── pagination ─── */
function Pagination({ page, total, perPage, onChange }) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;
  const range = 2;
  const pages = [];
  for (let i = Math.max(1, page - range); i <= Math.min(totalPages, page + range); i++) pages.push(i);
  const bS = (active, disabled) => ({
    padding: '6px 12px', border: `1.5px solid ${active ? '#4f46e5' : '#e2e8f0'}`, borderRadius: 7,
    fontSize: 12, fontWeight: active ? 700 : 500, cursor: disabled ? 'not-allowed' : 'pointer',
    background: active ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#fff',
    color: active ? '#fff' : '#475569', opacity: disabled ? .4 : 1, fontFamily: 'inherit',
  });
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 5, flexWrap: 'wrap' }}>
      <button style={bS(false, page <= 1)} disabled={page <= 1} onClick={() => onChange(page - 1)}>← Prev</button>
      {page > range + 1 && <><button style={bS(false, false)} onClick={() => onChange(1)}>1</button>{page > range + 2 && <span style={{ color: '#94a3b8', padding: '6px 2px' }}>…</span>}</>}
      {pages.map(p => <button key={p} style={bS(p === page, false)} onClick={() => onChange(p)}>{p}</button>)}
      {page < totalPages - range && <>{page < totalPages - range - 1 && <span style={{ color: '#94a3b8', padding: '6px 2px' }}>…</span>}<button style={bS(false, false)} onClick={() => onChange(totalPages)}>{totalPages}</button></>}
      <button style={bS(false, page >= totalPages)} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next →</button>
    </div>
  );
}

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
export default function IITCompanies() {
  const [stats, setStats] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [removeTarget, setRemoveTarget] = useState(null);
  const searchRef = useRef(null);

  /* ── stats ── */
  const loadStats = useCallback(async () => {
    try {
      const res = await post({ action: 'get_stats' });
      if (res.success) setStats(res);
    } catch (e) { }
  }, []);

  /* ── companies ── */
  const loadCompanies = useCallback(async (p = page, s = search, st = filterStatus) => {
    setLoading(true);
    try {
      const params = { action: 'get_companies', limit: PER_PAGE, offset: (p - 1) * PER_PAGE };
      if (s) params.keyword = s;
      if (st && st !== 'none') params.status = st;
      const res = await post(params);
      if (!res.success) { toast.error(res.message || 'Failed'); return; }
      setCompanies(res.data || []);
      setTotal(res.total || 0);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [page, search, filterStatus]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadCompanies(page, search, filterStatus); }, [page]);

  const handleSearch = () => { setPage(1); loadCompanies(1, search, filterStatus); };
  const handleFilter = v => { setFilterStatus(v); setPage(1); loadCompanies(1, search, v); };
  const handleClear = () => { setSearch(''); setPage(1); loadCompanies(1, '', filterStatus); searchRef.current?.focus(); };

  /* ── activate ── */
  const handleActivate = async (id) => {
    const res = await post({ action: 'activate_company', employer_id: id });
    if (res.status === 'success') { toast.success(res.message); loadCompanies(page, search, filterStatus); loadStats(); }
    else toast.error(res.message || 'Failed');
  };

  /* ── iit remove ── */
  const handleIITRemove = async (id, reason) => {
    const res = await post({ action: 'iit_block_company', employer_id: id, block_reason: reason });
    if (res.status === 'success') { toast.success(res.message); loadCompanies(page, search, filterStatus); loadStats(); }
    else toast.error(res.message || 'Failed');
  };

  /* ── table styles ── */
  const thS = {
    padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#fff',
    textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.5px',
    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', whiteSpace: 'nowrap',
    borderRight: '1px solid rgba(255,255,255,.15)', position: 'sticky', top: 0, zIndex: 2,
  };
  const tdS = {
    padding: '11px 14px', fontSize: 12.5, color: '#1e293b',
    borderBottom: '1px solid #f5f3ff', verticalAlign: 'middle', whiteSpace: 'nowrap',
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .iit-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .iit-tr:hover td { background:#faf9ff!important; }
        .iit-inp:focus { border-color:#4f46e5!important; box-shadow:0 0 0 3px rgba(79,70,229,.1)!important; }
        .iit-sel:focus { border-color:#4f46e5!important; }
        @keyframes iit_spin { to { transform:rotate(360deg); } }
        .iit-spin { display:inline-block;width:18px;height:18px;border:2.5px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:iit_spin .7s linear infinite; }
        .iit-btn { padding:5px 12px;border-radius:7px;font-size:11.5px;font-weight:700;cursor:pointer;border:none;font-family:inherit;white-space:nowrap; }
        .iit-btn:hover { opacity:.85; }
      `}</style>

      <div className="iit-root" style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100vh - 62px)', padding: 20, gap: 14, overflow: 'hidden', background: '#f5f3ff'
      }}>

        {/* ── HEADER ── */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>🎓</span>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>IIT E-Summit Companies</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                  Companies with <code style={{
                    background: '#ede9fe', padding: '1px 6px', borderRadius: 4,
                    color: '#4f46e5', fontSize: 11
                  }}>special_event = 1</code> only
                </div>
              </div>
            </div>
          </div>
          <button onClick={() => { loadStats(); loadCompanies(page, search, filterStatus); }}
            style={{
              padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', color: '#fff', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7
            }}>
            🔄 Refresh
          </button>
        </div>

        {/* ── STATS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, flexShrink: 0 }}>
          <StatCard label="Total (Event)" value={stats?.total} color="#1e293b" />
          <StatCard label="Unapproved" value={stats?.inactive} color="#1d4ed8" />
          <StatCard label="Approved" value={stats?.active} color="#15803d" />
          <StatCard label="Blocked" value={stats?.blocked} color="#b91c1c" />
        </div>

        {/* ── SEARCH + FILTER ── */}
        <div style={{
          background: '#fff', borderRadius: 12, border: '1.5px solid #ede9fe',
          padding: '13px 16px', flexShrink: 0, display: 'flex', gap: 10, flexWrap: 'wrap',
          alignItems: 'flex-end', boxShadow: '0 1px 6px rgba(79,70,229,.06)'
        }}>
          {/* search */}
          <div style={{ flex: '1 1 240px' }}>
            <label style={{
              fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
              letterSpacing: '.5px', display: 'block', marginBottom: 5
            }}>Search</label>
            <div style={{
              display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: 8,
              overflow: 'hidden', background: '#fff'
            }}>
              <input ref={searchRef} className="iit-inp" value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Name, email or phone..."
                style={{
                  border: 'none', outline: 'none', padding: '8px 12px', fontSize: 13,
                  fontFamily: 'inherit', color: '#1e293b', flex: 1, background: 'transparent'
                }} />
              {search && (
                <button onClick={handleClear}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#94a3b8', padding: '0 10px', fontSize: 17
                  }}>×</button>
              )}
              <button onClick={handleSearch}
                style={{
                  padding: '0 14px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                  border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13
                }}>🔍</button>
            </div>
          </div>
          {/* filter */}
          <div style={{ minWidth: 170 }}>
            <label style={{
              fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
              letterSpacing: '.5px', display: 'block', marginBottom: 5
            }}>Filter by Status</label>
            <select className="iit-sel" value={filterStatus} onChange={e => handleFilter(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
                fontSize: 13, fontFamily: 'inherit', color: '#1e293b', outline: 'none',
                cursor: 'pointer', background: '#fff', appearance: 'auto'
              }}>
              <option value="none">All</option>
              <option value="inactive">Inactive</option>
              <option value="blocked">Blocked</option>
              <option value="active">Active</option>
            </select>
          </div>
          {/* count */}
          <div style={{ fontSize: 12.5, color: '#64748b', alignSelf: 'center', paddingBottom: 2 }}>
            {loading
              ? <span className="iit-spin" />
              : <><strong style={{ color: '#1e293b' }}>{total}</strong> IIT companies</>
            }
          </div>
        </div>

        {/* ── TABLE ── */}
        <div style={{
          flex: 1, minHeight: 0, background: '#fff', borderRadius: 12,
          border: '1.5px solid #ede9fe', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', boxShadow: '0 1px 6px rgba(79,70,229,.06)'
        }}>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1000 }}>
              <thead>
                <tr>
                  {['Name', 'Email', 'Phone', 'Location', 'Website', 'Total Posts', 'Open Posts', 'Status', 'Action'].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && !companies.length ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 50, color: '#94a3b8' }}>
                    <div className="iit-spin" style={{ width: 28, height: 28, margin: '0 auto 10px' }} />
                    <div style={{ fontSize: 13 }}>Loading IIT E-Summit companies...</div>
                  </td></tr>
                ) : !companies.length ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 50, color: '#94a3b8' }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>🎓</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>No IIT E-Summit companies found</div>
                  </td></tr>
                ) : companies.map(row => (
                  <tr key={row.employer_id} className="iit-tr">
                    {/* name */}
                    <td style={{ ...tdS, fontWeight: 600, maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190 }} title={row.employer_name}>
                        {row.employer_name}
                      </div>
                    </td>

                    {/* email */}
                    <td style={tdS}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12 }}>{row.employer_email}</span>
                        <button onClick={() => copyToClipboard(row.employer_email)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 12, color: '#94a3b8', padding: 2
                          }} title="Copy">📋</button>
                      </div>
                    </td>

                    {/* phone */}
                    <td style={tdS}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12 }}>{row.employer_phone}</span>
                        <button onClick={() => copyToClipboard(row.employer_phone)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 12, color: '#94a3b8', padding: 2
                          }} title="Copy">📋</button>
                      </div>
                    </td>

                    {/* location */}
                    <td style={{ ...tdS, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.employer_location || '—'}
                    </td>

                    {/* website */}
                    <td style={tdS}>
                      {row.employer_website
                        ? <a href={row.employer_website} target="_blank" rel="noreferrer"
                          style={{ color: '#4f46e5', fontSize: 12, fontWeight: 600 }}>🔗 Link</a>
                        : <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 600 }}>N/A</span>
                      }
                    </td>

                    {/* total posts */}
                    <td style={{ ...tdS, textAlign: 'center', fontWeight: 600 }}>
                      {row.total_posting_count}
                    </td>

                    {/* open posts */}
                    <td style={{
                      ...tdS, textAlign: 'center', fontWeight: 600,
                      color: row.open_posting_count > 0 ? '#15803d' : '#94a3b8'
                    }}>
                      {row.open_posting_count}
                    </td>

                    {/* status */}
                    <td style={tdS}>
                      <StatusBadge status={row.status} />
                      {row.status === 'blocked' && row.block_reason && (
                        <div style={{
                          fontSize: 11, color: '#94a3b8', marginTop: 3,
                          maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis'
                        }}
                          title={row.block_reason}>
                          {row.block_reason}
                        </div>
                      )}
                    </td>

                    {/* action */}
                    <td style={{ ...tdS, minWidth: 160 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {/* Activate: show if inactive or blocked */}
                        {(row.status === 'inactive' || row.status === 'blocked') && (
                          <button className="iit-btn"
                            onClick={() => handleActivate(row.employer_id)}
                            style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', color: '#fff' }}>
                            ✅ Activate
                          </button>
                        )}
                        {/* Remove from IIT Event: show for active and inactive */}
                        {(row.status === 'active' || row.status === 'inactive') && (
                          <button className="iit-btn"
                            onClick={() => setRemoveTarget(row)}
                            style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', color: '#fff' }}>
                            🚫 Remove from Event
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── FOOTER ── */}
          {total > 0 && (
            <div style={{
              padding: '10px 16px', borderTop: '1.5px solid #f5f3ff', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10
            }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Showing <strong style={{ color: '#1e293b' }}>{Math.min((page - 1) * PER_PAGE + 1, total)}–{Math.min(page * PER_PAGE, total)}</strong> of <strong style={{ color: '#4f46e5' }}>{total}</strong> companies
              </div>
              <Pagination page={page} total={total} perPage={PER_PAGE}
                onChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL ── */}
      {removeTarget && (
        <IITRemoveModal
          company={removeTarget}
          onClose={() => setRemoveTarget(null)}
          onConfirm={handleIITRemove}
        />
      )}
    </>
  );
}