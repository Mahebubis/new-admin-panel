import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Helmet } from "react-helmet-async";

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/support/whatsapp_placement_club_links.php';
const POLL_MS = 5000; // real-time: poll every 5 seconds
const PROTECTED = 'https://whatsapp.com/channel/0029VbALkpa6rsQxzwHG1Q1k';

const post = d => fetch(API, { method: 'POST', body: new URLSearchParams(d) }).then(r => r.json());

/* ─── format datetime — same as PHP JS formatDateTime() ─── */
const fmtDT = (dt) => {
  if (!dt || dt === '0000-00-00 00:00:00') return '—';
  try {
    const d = new Date(dt);
    const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
    return `${date} at ${time}`;
  } catch { return dt; }
};

/* ─── copy ─── */
const copyLink = txt =>
  navigator.clipboard.writeText(txt).then(() => toast.success('Copied!')).catch(() => toast.error('Failed'));

/* ─── status badge ─── */
const StatusBadge = ({ status }) => {
  const cfg = {
    active: { bg: '#dcfce7', color: '#15803d', dot: '#22c55e' },
    pending: { bg: '#fef9c3', color: '#854d0e', dot: '#f59e0b' },
    closed: { bg: '#fee2e2', color: '#b91c1c', dot: '#ef4444' },
  };
  const c = cfg[status?.toLowerCase()] || { bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px',
      borderRadius: 99, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot }} />
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
};

/* ─── inline input ─── */
const InlineInput = ({ value, onChange }) => (
  <input type="text" value={value} onChange={e => onChange(e.target.value)}
    style={{
      padding: '5px 9px', border: '1.5px solid #c4b5fd', borderRadius: 7,
      fontSize: 12.5, fontFamily: 'inherit', outline: 'none', background: '#fff', width: '100%'
    }} />
);

/* ─── inline select ─── */
const InlineSelect = ({ value, onChange }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    style={{
      padding: '5px 9px', border: '1.5px solid #c4b5fd', borderRadius: 7,
      fontSize: 12.5, fontFamily: 'inherit', outline: 'none', background: '#fff'
    }}>
    {['active', 'pending', 'closed'].map(s =>
      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
    )}
  </select>
);

/* ─── confirm modal ─── */
function ConfirmModal({ text, onConfirm, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: '24px 26px', width: 360,
        maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,.2)', textAlign: 'center'
      }}>
        <div style={{ fontSize: 38, marginBottom: 10 }}>⚠️</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Are you sure?</div>
        <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 20 }}>{text}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          <button onClick={onClose}
            style={{
              padding: '8px 18px', border: '1.5px solid #e2e8f0', borderRadius: 8,
              background: '#fff', color: '#475569', fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit'
            }}>Cancel</button>
          <button onClick={() => { onConfirm(); onClose(); }}
            style={{
              padding: '8px 20px', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
              background: 'linear-gradient(135deg,#dc2626,#b91c1c)'
            }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

/* ─── action button ─── */
const ActBtn = ({ label, onClick, grad, small }) => (
  <button onClick={onClick}
    style={{
      padding: small ? '4px 9px' : '4px 12px',
      border: 'none', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
      cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
      background: grad, whiteSpace: 'nowrap'
    }}>
    {label}
  </button>
);

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
export default function PlacementClubLinks() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [live, setLive] = useState(true);   // toggle real-time
  const pollRef = useRef(null);
  const editingRef = useRef(false);

  /* ── fetch ── */
  const fetchRows = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await post({ action: 'fetch_all' });
      if (res.success) {
        // Don't overwrite state if user is mid-edit (avoid flickering inputs)
        if (!editingRef.current) setRows(res.data || []);
        setLastSync(new Date());
      }
    } catch (e) { if (!silent) toast.error(e.message); }
    finally { if (!silent) setLoading(false); }
  }, []);

  /* ── initial load ── */
  useEffect(() => { fetchRows(); }, [fetchRows]);

  /* ── real-time polling ── */
  // useEffect(() => {
  //   clearInterval(pollRef.current);
  //   if (live) {
  //     pollRef.current = setInterval(() => {
  //       fetchRows(true); // silent refresh
  //     }, POLL_MS);
  //   }
  //   return () => clearInterval(pollRef.current);
  // }, [live, fetchRows]);

  /* ── track editing state for polling ── */
  useEffect(() => { editingRef.current = editId !== null; }, [editId]);

  /* ── add ── */
  const handleAdd = async () => {
    const res = await post({ action: 'add' });
    if (res.status === 'success') { toast.success(res.message); fetchRows(); }
    else toast.error(res.message || 'Failed');
  };

  /* ── start edit ── */
  const startEdit = async (id) => {
    const res = await post({ action: 'fetch_by_id', id });
    if (res.id) {
      setEditId(id);
      setEditForm({ community_name: res.community_name, community_link: res.community_link, status: res.status });
    }
  };
  const cancelEdit = () => { setEditId(null); setEditForm({}); };

  /* ── update ── */
  const handleUpdate = async (id) => {
    const res = await post({ action: 'update', id, ...editForm });
    if (res.status === 'success') { toast.success(res.message); setEditId(null); fetchRows(); }
    else toast.error(res.message || 'Failed');
  };

  /* ── disable ── */
  const handleDisable = async (id) => {
    const res = await post({ action: 'disable', id });
    if (res.status === 'success') toast.success(res.message);
    else toast.error(res.message || 'Failed');
    fetchRows();
  };

  /* ── delete ── */
  const handleDelete = async (id) => {
    const res = await post({ action: 'delete', id });
    if (res.status === 'success') toast.success(res.message);
    else toast.error(res.message || 'Failed');
    fetchRows();
  };

  const thS = {
    padding: '11px 14px', fontSize: 10.5, fontWeight: 700, color: '#fff', textAlign: 'left',
    textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap',
    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
    borderRight: '1px solid rgba(255,255,255,.15)', position: 'sticky', top: 0, zIndex: 2,
  };
  const tdS = (active) => ({
    padding: '11px 14px', fontSize: 12.5, borderBottom: '1px solid #f5f3ff',
    verticalAlign: 'middle', whiteSpace: 'nowrap',
    background: active ? 'rgba(22,163,74,.07)' : 'transparent',
    color: active ? '#15803d' : '#1e293b',
  });

  return (
    <>
    <Helmet>
        <title>Whatsapp Placement Club Link | Admin Panel</title>
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .pcl-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .pcl-tr:hover td { filter:brightness(.97); }
        @keyframes pcl_spin { to { transform:rotate(360deg); } }
        .pcl-spin { display:inline-block;width:16px;height:16px;border:2px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:pcl_spin .7s linear infinite; }
        @keyframes pcl_pulse { 0%,100%{opacity:1}50%{opacity:.5} }
        .live-dot { display:inline-block;width:7px;height:7px;border-radius:50%;background:#22c55e;animation:pcl_pulse 2s infinite; }
      `}</style>

      <div className="pcl-root" style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100vh - 62px)', padding: 20, gap: 14, overflow: 'hidden', background: '#f5f3ff'
      }}>

        {/* ── HEADER ── */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>🎓 Placement Club Community Links</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Manage WhatsApp placement club group links
            </div>
          </div>
          {/* controls */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* real-time indicator */}
            {/* <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
              background: '#fff', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 12,
              fontWeight: 600, color: '#64748b'
            }}>
              {live && <span className="live-dot" />}
              {live
                ? <span style={{ color: '#15803d' }}>Live ({POLL_MS / 1000}s)</span>
                : <span>Paused</span>}
              <button onClick={() => setLive(p => !p)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: '#4f46e5', fontWeight: 700, marginLeft: 2
                }}>
                {live ? 'Pause' : 'Resume'}
              </button>
            </div>
            
            {lastSync && (
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                🕐 {lastSync.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            )} */}
            <button onClick={() => fetchRows()}
              style={{
                padding: '7px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8,
                background: '#fff', color: '#64748b', fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit'
              }}>🔄 Refresh</button>
            <button onClick={handleAdd}
              style={{
                padding: '7px 18px', border: 'none', borderRadius: 8, fontSize: 12.5,
                fontWeight: 700, cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
                background: 'linear-gradient(135deg,#4f46e5,#7c3aed)'
              }}>
              + Add Community Link
            </button>
          </div>
        </div>

        {/* ── TABLE CARD ── */}
        <div style={{
          flex: 1, minHeight: 0, background: '#fff', borderRadius: 14,
          border: '1.5px solid #ede9fe', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', boxShadow: '0 1px 8px rgba(79,70,229,.07)'
        }}>

          {/* live banner */}
          <div style={{
            padding: '7px 16px', background: '#f0fdf4', borderBottom: '1.5px solid #bbf7d0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
          }}>
            {/* <div style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5,
              color: '#15803d', fontWeight: 500
            }}>
              {loading ? <><span className="pcl-spin" /> Loading...</>
                : <><span className="live-dot" /> {rows.length} links loaded — auto-refreshing every {POLL_MS / 1000}s</>}
            </div> */}
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              Active rows highlighted in green
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
              <thead>
                <tr>
                  {['Name', 'Link', 'Status', 'Activated At', 'Closed At', 'Action'].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!rows.length && !loading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 50, color: '#94a3b8' }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>No placement club links found</div>
                  </td></tr>
                ) : rows.map(row => {
                  const isActive = row.status === 'active';
                  const isEditing = editId === row.id;
                  const isProtected = row.community_link === PROTECTED;
                  return (
                    <tr key={row.id} className="pcl-tr">

                      {/* Name */}
                      <td style={tdS(isActive)}>
                        {isEditing
                          ? <InlineInput value={editForm.community_name}
                            onChange={v => setEditForm(p => ({ ...p, community_name: v }))} />
                          : <span style={{ fontWeight: 600 }}>{row.community_name}</span>}
                      </td>

                      {/* Link */}
                      <td style={{ ...tdS(isActive), maxWidth: 300 }}>
                        {isEditing
                          ? <InlineInput value={editForm.community_link}
                            onChange={v => setEditForm(p => ({ ...p, community_link: v }))} />
                          : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <a href={row.community_link} target="_blank" rel="noreferrer"
                                style={{
                                  color: isActive ? '#15803d' : '#4f46e5', fontSize: 12,
                                  overflow: 'hidden', textOverflow: 'ellipsis',
                                  maxWidth: 240, display: 'block'
                                }}>
                                {row.community_link}
                              </a>
                              <button onClick={() => copyLink(row.community_link)}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: '#94a3b8', fontSize: 12, padding: 2, flexShrink: 0
                                }}>📋</button>
                            </div>
                          )}
                      </td>

                      {/* Status */}
                      <td style={tdS(isActive)}>
                        {isEditing
                          ? <InlineSelect value={editForm.status}
                            onChange={v => setEditForm(p => ({ ...p, status: v }))} />
                          : <StatusBadge status={row.status} />}
                      </td>

                      {/* Activated At */}
                      <td style={{ ...tdS(isActive), fontSize: 11.5, color: isActive ? '#15803d' : '#94a3b8' }}>
                        {fmtDT(row.activated_at)}
                      </td>

                      {/* Closed At */}
                      <td style={{ ...tdS(isActive), fontSize: 11.5, color: '#94a3b8' }}>
                        {fmtDT(row.closed_at)}
                      </td>

                      {/* Action */}
                      <td style={tdS(isActive)}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <ActBtn label="✔ Update" grad="linear-gradient(135deg,#16a34a,#15803d)"
                              onClick={() => handleUpdate(row.id)} />
                            <button onClick={cancelEdit}
                              style={{
                                padding: '4px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                                fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                background: '#fff', color: '#64748b'
                              }}>✕ Cancel</button>
                          </div>
                        ) : isProtected ? (
                          /* Protected link — no actions shown (matches PHP isProtectedLink check) */
                          <span style={{ fontSize: 11.5, color: '#94a3b8', fontStyle: 'italic' }}>Protected</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {/* Edit — only for non-active links */}
                            {row.status !== 'active' && (
                              <ActBtn label="✏️ Edit" grad="linear-gradient(135deg,#0ea5e9,#0284c7)"
                                onClick={() => startEdit(row.id)} />
                            )}
                            {/* Disable */}
                            <ActBtn label="⏸ Disable" grad="linear-gradient(135deg,#f59e0b,#d97706)"
                              onClick={() => setConfirm({
                                text: 'You want to disable this community link!',
                                fn: () => handleDisable(row.id),
                              })} />
                            {/* Delete */}
                            <ActBtn label="✕" grad="linear-gradient(135deg,#dc2626,#b91c1c)" small
                              onClick={() => setConfirm({
                                text: 'Once deleted, you will not be able to recover this community link!',
                                fn: () => handleDelete(row.id),
                              })} />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* footer */}
          <div style={{
            padding: '8px 16px', borderTop: '1.5px solid #f5f3ff', flexShrink: 0,
            display: 'flex', gap: 16, fontSize: 11.5, flexWrap: 'wrap'
          }}>
            {[
              { label: 'Active', color: '#15803d', bg: '#dcfce7', count: rows.filter(r => r.status === 'active').length },
              { label: 'Pending', color: '#854d0e', bg: '#fef9c3', count: rows.filter(r => r.status === 'pending').length },
              { label: 'Closed', color: '#b91c1c', bg: '#fee2e2', count: rows.filter(r => r.status === 'closed').length },
            ].map(s => (
              <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                  background: s.bg, color: s.color
                }}>{s.count}</span>
                <span style={{ color: '#64748b' }}>{s.label}</span>
              </span>
            ))}
            <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>Total: {rows.length}</span>
          </div>
        </div>
      </div>

      {confirm && <ConfirmModal text={confirm.text} onConfirm={confirm.fn} onClose={() => setConfirm(null)} />}
    </>
  );
}