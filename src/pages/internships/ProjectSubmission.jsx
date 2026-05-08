import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/internships/project_submission.php';
const FH = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk = obj => new URLSearchParams(obj);

const LIMIT = 10;

const tdS = {
  padding: '9px 12px', borderBottom: '1px solid #f5f3ff', color: '#334155',
  fontSize: 12, verticalAlign: 'middle'
};
const thS = {
  color: '#fff', fontSize: 11, fontWeight: 600, padding: '11px 12px',
  textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px',
  borderRight: '1px solid rgba(255,255,255,.15)', whiteSpace: 'nowrap'
};

/* ── reject reason modal ── */
function RejectModal({ onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden'
      }}>
        <div style={{
          padding: '14px 20px', background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
          fontSize: 14, fontWeight: 700, color: '#fff'
        }}>
          Enter Decline Reason
        </div>
        <div style={{ padding: 20 }}>
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Enter the reason for declining this project..."
            style={{
              width: '100%', minHeight: 100, padding: '10px 12px', border: '1.5px solid #e2e8f0',
              borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', resize: 'vertical',
              outline: 'none', boxSizing: 'border-box'
            }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
            <button onClick={onCancel}
              style={{
                padding: '8px 18px', border: '1.5px solid #e2e8f0', background: '#f8fafc',
                color: '#475569', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer'
              }}>
              Cancel
            </button>
            <button onClick={() => { if (reason.trim()) onConfirm(reason); else toast.error('Enter a reason'); }}
              style={{
                padding: '8px 18px', background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
                color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer'
              }}>
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectSubmission() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({}); // { `${uid}_${iid}_approve`: true }
  const [rejectModal, setRejectModal] = useState(null);   // { user_id, internship_id }

  /* ── fetch — AbortController stops duplicate StrictMode calls ── */
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const offset = (page - 1) * LIMIT;
    const params = { action: 'fetch_project_submissions', limit: LIMIT, offset };
    if (search) params.keyword = search;
    if (statusFilter) params.status = statusFilter;

    api.post(API, mk(params), { ...FH, signal: controller.signal })
      .then(res => {
        const d = res.data;
        setRows(d.submissions || []);
        setTotal(d.count || 0);
        setStats(d.stats || { total: 0, pending: 0, approved: 0, rejected: 0 });
      })
      .catch(err => { if (!api.isCancel?.(err) && err?.name !== 'CanceledError' && err?.name !== 'AbortError') toast.error('Failed to load'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [page, search, statusFilter]);

  /* ── approve ── */
  const approve = async (user_id, internship_id) => {
    const key = `${user_id}_${internship_id}_approve`;
    setActionLoading(p => ({ ...p, [key]: true }));
    try {
      const res = await api.post(API, mk({
        action: 'approve_project_submission',
        user_id, internship_id
      }), FH);
      if (res.data.status === 'success') {
        toast.success('Project approved');
        // Update row in place (same as PHP — no full reload)
        setRows(p => p.map(r =>
          r.user_id == user_id && r.internship_id == internship_id
            ? { ...r, status: 'approved', reject_reason: null }
            : r
        ));
        setStats(p => ({ ...p, approved: p.approved + 1, pending: p.pending !== 0 ? p.pending - 1 : 0 }));
      } else {
        toast.error(res.data.message || 'Failed');
      }
    } catch { toast.error('Error'); }
    finally { setActionLoading(p => ({ ...p, [key]: false })); }
  };

  /* ── decline ── */
  const decline = async (user_id, internship_id, reason) => {
    setRejectModal(null);
    const key = `${user_id}_${internship_id}_decline`;
    setActionLoading(p => ({ ...p, [key]: true }));
    try {
      const res = await api.post(API, mk({
        action: 'decline_project_submission',
        user_id, internship_id, reject_reason: reason
      }), FH);
      if (res.data.status === 'success') {
        toast.success('Project declined');
        setRows(p => p.map(r =>
          r.user_id == user_id && r.internship_id == internship_id
            ? { ...r, status: 'rejected', reject_reason: reason }
            : r
        ));
        setStats(p => ({ ...p, rejected: p.rejected + 1, pending: p.pending !== 0 ? p.pending - 1 : 0 }));
      } else {
        toast.error(res.data.message || 'Failed');
      }
    } catch { toast.error('Error'); }
    finally { setActionLoading(p => ({ ...p, [key]: false })); }
  };

  const doSearch = () => { setPage(1); setSearch(searchInput); };
  const clearSearch = () => { setSearchInput(''); setSearch(''); setPage(1); };
  const totalPages = Math.ceil(total / LIMIT);

  /* ── stat cards ── */
  const statCards = [
    { label: 'Total', val: stats.total, bg: '#ede9fe', color: '#4f46e5' },
    { label: 'Pending', val: stats.pending, bg: '#fef9c3', color: '#b45309' },
    { label: 'Approved', val: stats.approved, bg: '#dcfce7', color: '#16a34a' },
    { label: 'Rejected', val: stats.rejected, bg: '#fee2e2', color: '#dc2626' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .ps-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .ps-tr:hover td{background:#faf9ff!important;}
        @keyframes ps_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="ps-root" style={{ background: '#f5f3ff', minHeight: '100vh', padding: 24 }}>

        {/* header */}
        <div style={{
          fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 18,
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          📋 Project Submissions
        </div>

        {/* stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {statCards.map(s => (
            <div key={s.label} style={{
              background: s.bg, borderRadius: 12, padding: '14px 18px',
              border: `1.5px solid ${s.color}22`
            }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* toolbar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* search */}
          <div style={{
            display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: 8,
            overflow: 'hidden', background: '#fff', flex: '0 0 300px'
          }}>
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search by email..."
              style={{
                border: 'none', padding: '8px 12px', fontSize: 12.5, flex: 1,
                outline: 'none', fontFamily: 'inherit', color: '#1e293b'
              }} />
            <button onClick={doSearch}
              style={{ background: '#4f46e5', color: '#fff', border: 'none', padding: '0 13px', cursor: 'pointer', fontSize: 12 }}>
              🔍
            </button>
            <button onClick={clearSearch}
              style={{ background: '#f1f5f9', color: '#64748b', border: 'none', padding: '0 10px', cursor: 'pointer', fontSize: 13 }}>
              ×
            </button>
          </div>

          {/* status filter */}
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            style={{
              padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5,
              fontFamily: 'inherit', color: '#334155', background: '#fff', cursor: 'pointer', outline: 'none'
            }}>
            <option value="">Filter by Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* <span style={{ fontSize:12.5, color:'#64748b', fontWeight:600, marginLeft:'auto' }}>
            Total: <strong style={{ color:'#4f46e5' }}>{total}</strong>
          </span> */}
        </div>

        {/* table */}
        <div style={{
          background: '#fff', borderRadius: 12, border: '1.5px solid #ede9fe',
          boxShadow: '0 1px 8px rgba(79,70,229,.05)', overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {['Student', 'Email', 'Internship', 'Batch', 'Submission', 'Date', 'Action', 'Status'].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48 }}>
                    <div style={{
                      display: 'inline-block', width: 28, height: 28, border: '3px solid #ede9fe',
                      borderTop: '3px solid #4f46e5', borderRadius: '50%', animation: 'ps_spin .7s linear infinite'
                    }} />
                    <style>{`@keyframes ps_spin{to{transform:rotate(360deg)}}`}</style>
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: 36, fontSize: 13 }}>
                    No submissions found
                  </td></tr>
                ) : rows.map((r, i) => {
                  const appKey = `${r.user_id}_${r.internship_id}_approve`;
                  const decKey = `${r.user_id}_${r.internship_id}_decline`;
                  const isApproved = r.status === 'approved';
                  const isRejected = r.status === 'rejected';

                  return (
                    <tr key={i} className="ps-tr">
                      <td style={{ ...tdS, fontWeight: 600, color: '#1e293b' }}>{r.name}</td>
                      <td style={{ ...tdS, fontSize: 11.5, color: '#4f46e5' }}>{r.email}</td>
                      <td style={{ ...tdS, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.internship_name}
                      </td>
                      <td style={{ ...tdS, fontSize: 11 }}>{r.batch}</td>
                      <td style={tdS}>
                        {r.file_link
                          ? <a href={r.file_link} target="_blank" rel="noreferrer"
                            style={{ color: '#4f46e5', fontWeight: 600, fontSize: 11.5 }}>View Link</a>
                          : <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>}
                      </td>
                      <td style={{ ...tdS, fontSize: 11, whiteSpace: 'nowrap' }}>{r.created_at}</td>
                      <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                        {/* Approve button */}
                        <button
                          disabled={isApproved || actionLoading[appKey]}
                          onClick={() => approve(r.user_id, r.internship_id)}
                          style={{
                            padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                            border: 'none', cursor: isApproved ? 'not-allowed' : 'pointer',
                            marginBottom: 4, display: 'block',
                            background: isApproved ? '#dcfce7' : '#e0f2fe',
                            color: isApproved ? '#16a34a' : '#0369a1',
                            opacity: actionLoading[appKey] ? .6 : 1
                          }}>
                          {actionLoading[appKey] ? 'Approving...' : isApproved ? '✓ Approved' : 'Approve'}
                        </button>
                        {/* Decline button */}
                        <button
                          disabled={isRejected || actionLoading[decKey]}
                          onClick={() => setRejectModal({ user_id: r.user_id, internship_id: r.internship_id })}
                          style={{
                            padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                            border: 'none', cursor: isRejected ? 'not-allowed' : 'pointer',
                            background: isRejected ? '#fee2e2' : '#fef2f2',
                            color: isRejected ? '#dc2626' : '#b91c1c',
                            opacity: actionLoading[decKey] ? .6 : 1
                          }}>
                          {actionLoading[decKey] ? 'Declining...' : isRejected ? '✗ Declined' : 'Decline'}
                        </button>
                      </td>
                      <td style={tdS}>
                        {r.status === 'approved' && (
                          <span style={{
                            padding: '3px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
                            background: '#dcfce7', color: '#16a34a'
                          }}>Approved</span>
                        )}
                        {r.status === 'rejected' && (
                          <div>
                            <span style={{
                              padding: '3px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
                              background: '#fee2e2', color: '#dc2626', display: 'inline-block', marginBottom: 4
                            }}>Rejected</span>
                            {r.reject_reason && (
                              <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
                                {r.reject_reason}
                              </div>
                            )}
                          </div>
                        )}
                        {r.status === 'pending' && (
                          <span style={{
                            padding: '3px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
                            background: '#fef9c3', color: '#b45309'
                          }}>Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
            <button disabled={page === 1} onClick={() => setPage(1)}
              style={{
                padding: '5px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                background: '#fff', fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer',
                color: page === 1 ? '#cbd5e1' : '#334155'
              }}>First</button>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              style={{
                padding: '5px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                background: '#fff', fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer',
                color: page === 1 ? '#cbd5e1' : '#334155'
              }}>Prev</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pg = page <= 3 ? i + 1 : page - 2 + i;
              if (pg > totalPages) return null;
              return (
                <button key={pg} onClick={() => setPage(pg)}
                  style={{
                    padding: '5px 12px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                    background: pg === page ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#fff',
                    color: pg === page ? '#fff' : '#334155', fontSize: 12, cursor: 'pointer',
                    fontWeight: pg === page ? 700 : 400
                  }}>{pg}</button>
              );
            })}
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              style={{
                padding: '5px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                background: '#fff', fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer',
                color: page === totalPages ? '#cbd5e1' : '#334155'
              }}>Next</button>
            <button disabled={page === totalPages} onClick={() => setPage(totalPages)}
              style={{
                padding: '5px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                background: '#fff', fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer',
                color: page === totalPages ? '#cbd5e1' : '#334155'
              }}>Last</button>
          </div>
        )}
      </div>

      {/* reject modal */}
      {rejectModal && (
        <RejectModal
          onConfirm={reason => decline(rejectModal.user_id, rejectModal.internship_id, reason)}
          onCancel={() => setRejectModal(null)}
        />
      )}
    </>
  );
}