import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Helmet } from "react-helmet-async";

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/support/community_links.php';
const post = d => fetch(API, { method: 'POST', body: new URLSearchParams(d) }).then(r => r.json());

/* ─── helpers ─── */
const copyLink = txt =>
  navigator.clipboard.writeText(txt).then(() => toast.success('Copied!')).catch(() => toast.error('Failed'));

/* ─── status badge ─── */
const StatusBadge = ({ status }) => {
  const cfg = {
    active: { bg: '#dcfce7', color: '#15803d' },
    pending: { bg: '#fef9c3', color: '#854d0e' },
    inactive: { bg: '#f3f4f6', color: '#6b7280' },
    closed: { bg: '#fee2e2', color: '#b91c1c' },
  };
  const c = cfg[status?.toLowerCase()] || cfg.inactive;
  return <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>{status}</span>;
};

/* ─── shared table header style ─── */
const thS = {
  padding: '10px 13px', fontSize: 10.5, fontWeight: 700, color: '#fff', textAlign: 'left',
  textTransform: 'uppercase', letterSpacing: '.5px',
  background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
  borderRight: '1px solid rgba(255,255,255,.15)', whiteSpace: 'nowrap'
};
const tdS = (active) => ({
  padding: '10px 13px', fontSize: 12.5, borderBottom: '1px solid #f5f3ff',
  verticalAlign: 'middle', whiteSpace: 'nowrap',
  background: active ? 'rgba(34,197,94,.06)' : 'transparent',
  color: active ? '#15803d' : '#1e293b',
});

/* ─── inline input ─── */
const InlineInput = ({ value, onChange, type = 'text', min, style = {} }) => (
  <input type={type} value={value} min={min} onChange={e => onChange(e.target.value)}
    style={{
      padding: '5px 9px', border: '1.5px solid #c4b5fd', borderRadius: 7, fontSize: 12.5,
      fontFamily: 'inherit', outline: 'none', background: '#fff', width: '100%', ...style
    }} />
);

/* ─── inline status select ─── */
const InlineSelect = ({ value, onChange, options }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    style={{
      padding: '5px 9px', border: '1.5px solid #c4b5fd', borderRadius: 7, fontSize: 12.5,
      fontFamily: 'inherit', outline: 'none', background: '#fff'
    }}>
    {options.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
  </select>
);

/* ─── confirm modal ─── */
function ConfirmModal({ msg, onConfirm, onClose }) {
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
        <div style={{ fontSize: 38, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>Are you sure?</div>
        <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 20 }}>{msg}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          <button onClick={onClose} style={{
            padding: '8px 18px', border: '1.5px solid #e2e8f0',
            borderRadius: 8, background: '#fff', color: '#475569', fontSize: 12.5, fontWeight: 600,
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

/* ════════════════════════════════════
   SECTION 1 — New Table (whatsapp_community_link_new)
════════════════════════════════════ */
function NewLinksSection({ citVersions }) {
  const [citId, setCitId] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [confirm, setConfirm] = useState(null);

  const loadNew = useCallback(async (id) => {
    if (!id) { setRows([]); return; }
    setLoading(true);
    const res = await post({ action: 'fetch_new', cit_id: id });
    setRows(res.success ? res.data : []);
    setLoading(false);
  }, []);

  const handleAdd = async () => {
    if (!citId) { toast.error('Please select a CIT version first!'); return; }
    const res = await post({ action: 'add_new', cit_id: citId });
    if (res.status === 'success') { toast.success(res.message); loadNew(citId); }
    else toast.error(res.message || 'Failed');
  };

  const startEdit = (row) => {
    setEditId(row.id);
    setEditForm({ name: row.name, link: row.link, status: row.status, ranking: row.ranking });
  };
  const cancelEdit = () => { setEditId(null); setEditForm({}); };

  const handleUpdate = async (id) => {
    const res = await post({ action: 'update_new', id, ...editForm });
    if (res.status === 'success') { toast.success(res.message); setEditId(null); loadNew(citId); }
    else toast.error(res.message || 'Failed');
  };

  const handleDelete = async (id) => {
    const res = await post({ action: 'delete_new', id });
    if (res.status === 'success') { toast.success(res.message); loadNew(citId); }
    else toast.error(res.message || 'Failed');
  };

  return (
    <><Helmet>
        <title>Whatsapp Link | Admin Panel</title>
      </Helmet>
    <div style={{
      background: '#fff', borderRadius: 14, border: '1.5px solid #ede9fe',
      overflow: 'hidden', boxShadow: '0 1px 8px rgba(79,70,229,.07)'
    }}>
      {/* section header */}
      <div style={{
        padding: '14px 18px', borderBottom: '1.5px solid #f5f3ff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>📋 WhatsApp Community Links (New)</div>
          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>Filtered by CIT version — <code style={{ background: '#f5f3ff', padding: '1px 5px', borderRadius: 4, color: '#4f46e5', fontSize: 11 }}>whatsapp_community_link_new</code></div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={citId} onChange={e => { setCitId(e.target.value); loadNew(e.target.value); }}
            style={{
              padding: '7px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13,
              fontFamily: 'inherit', color: '#1e293b', outline: 'none', background: '#fff',
              minWidth: 180, cursor: 'pointer'
            }}>
            <option value="">-- Select CIT Version --</option>
            {citVersions.map(v => <option key={v.id} value={v.id}>{v.cit_name}</option>)}
          </select>
          <button onClick={handleAdd}
            style={{
              padding: '7px 16px', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
              background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', whiteSpace: 'nowrap'
            }}>
            + Add New Link
          </button>
        </div>
      </div>

      {/* table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 700 }}>
          <thead>
            <tr>
              {['Name', 'Link', 'Status', 'Ranking', 'Action'].map(h => <th key={h} style={thS}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>
                Loading...
              </td></tr>
            ) : !citId ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: 13 }}>
                Select a CIT version above to view data...
              </td></tr>
            ) : !rows.length ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: 13 }}>
                No records found for this CIT version
              </td></tr>
            ) : rows.map(row => {
              const isActive = row.status === 'active';
              const isEditing = editId === row.id;
              return (
                <tr key={row.id}>
                  <td style={tdS(isActive)}>
                    {isEditing
                      ? <InlineInput value={editForm.name} onChange={v => setEditForm(p => ({ ...p, name: v }))} />
                      : <span style={{ fontWeight: 500 }}>{row.name}</span>}
                  </td>
                  <td style={{ ...tdS(isActive), maxWidth: 260 }}>
                    {isEditing
                      ? <InlineInput value={editForm.link} onChange={v => setEditForm(p => ({ ...p, link: v }))} style={{ minWidth: 200 }} />
                      : <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <a href={row.link} target="_blank" rel="noreferrer"
                          style={{
                            color: '#4f46e5', fontSize: 12, overflow: 'hidden',
                            textOverflow: 'ellipsis', maxWidth: 200, display: 'block'
                          }}>{row.link}</a>
                        <button onClick={() => copyLink(row.link)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#94a3b8', fontSize: 12, padding: 2, flexShrink: 0
                          }}>📋</button>
                      </div>}
                  </td>
                  <td style={tdS(isActive)}>
                    {isEditing
                      ? <InlineSelect value={editForm.status} options={['active', 'inactive', 'pending']}
                        onChange={v => setEditForm(p => ({ ...p, status: v }))} />
                      : <StatusBadge status={row.status} />}
                  </td>
                  <td style={{ ...tdS(isActive), textAlign: 'center' }}>
                    {isEditing
                      ? <InlineInput type="number" min="0" value={editForm.ranking}
                        onChange={v => setEditForm(p => ({ ...p, ranking: v }))} style={{ width: 70 }} />
                      : <span style={{ fontWeight: 600 }}>{row.ranking}</span>}
                  </td>
                  <td style={tdS(isActive)}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {isEditing ? <>
                        <button onClick={() => handleUpdate(row.id)}
                          style={{
                            padding: '4px 12px', border: 'none', borderRadius: 6, fontSize: 11.5,
                            fontWeight: 700, cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
                            background: 'linear-gradient(135deg,#16a34a,#15803d)'
                          }}>✔ Update</button>
                        <button onClick={cancelEdit}
                          style={{
                            padding: '4px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                            fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            background: '#fff', color: '#64748b'
                          }}>✕ Cancel</button>
                      </> : <>
                        <button onClick={() => startEdit(row)}
                          style={{
                            padding: '4px 12px', border: 'none', borderRadius: 6, fontSize: 11.5,
                            fontWeight: 700, cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
                            background: 'linear-gradient(135deg,#0ea5e9,#0284c7)'
                          }}>✏️ Edit</button>
                        <button onClick={() => setConfirm({ msg: 'Once deleted, you cannot recover this link!', fn: () => handleDelete(row.id) })}
                          style={{
                            padding: '4px 10px', border: 'none', borderRadius: 6, fontSize: 11.5,
                            fontWeight: 700, cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
                            background: 'linear-gradient(135deg,#dc2626,#b91c1c)'
                          }}>✕</button>
                      </>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {confirm && <ConfirmModal {...confirm} onClose={() => setConfirm(null)} onConfirm={confirm.fn} />}
    </div>
    </>
  );
}

/* ════════════════════════════════════
   SECTION 2 — Current Table (whatsapp_community_link)
════════════════════════════════════ */
function CurrentLinksSection() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [confirm, setConfirm] = useState(null);

  const loadCurrent = useCallback(async () => {
    setLoading(true);
    const res = await post({ action: 'fetch_current' });
    setRows(res.success ? res.data : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadCurrent(); }, [loadCurrent]);

  const handleAdd = async () => {
    const res = await post({ action: 'add_current' });
    if (res.status === 'success') { toast.success(res.message); loadCurrent(); }
    else toast.error(res.message || 'Failed');
  };

  const startEdit = async (id) => {
    const res = await post({ action: 'fetch_current_by_id', id });
    if (res.id) {
      setEditId(id);
      setEditForm({ community_name: res.community_name, community_link: res.community_link, status: res.status });
    }
  };
  const cancelEdit = () => { setEditId(null); setEditForm({}); };

  const handleUpdate = async (id) => {
    const res = await post({ action: 'update_current', id, ...editForm });
    if (res.status === 'success') { toast.success(res.message); setEditId(null); loadCurrent(); }
    else toast.error(res.message || 'Failed');
  };

  const handleDisable = async (id) => {
    const res = await post({ action: 'disable_current', id });
    if (res.status === 'success') toast.success(res.message);
    else toast.error(res.message || 'Failed');
    loadCurrent();
  };

  const handleDelete = async (id) => {
    const res = await post({ action: 'delete_current', id });
    if (res.status === 'success') toast.success(res.message);
    else toast.error(res.message || 'Failed');
    loadCurrent();
  };

  return (
    <><Helmet>
        <title>Whatsapp Link | Admin Panel</title>
      </Helmet>
    <div style={{
      background: '#fff', borderRadius: 14, border: '1.5px solid #ede9fe',
      overflow: 'hidden', boxShadow: '0 1px 8px rgba(79,70,229,.07)'
    }}>
      {/* header */}
      <div style={{
        padding: '14px 18px', borderBottom: '1.5px solid #f5f3ff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>📌 Current Community Links</div>
          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>Auto-filtered by current + next CIT — <code style={{ background: '#f5f3ff', padding: '1px 5px', borderRadius: 4, color: '#4f46e5', fontSize: 11 }}>whatsapp_community_link</code></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={loadCurrent}
            style={{
              padding: '7px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8,
              background: '#fff', color: '#64748b', fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit'
            }}>🔄 Refresh</button>
          <button onClick={handleAdd}
            style={{
              padding: '7px 16px', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
              background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', whiteSpace: 'nowrap'
            }}>
            + Add Community Link
          </button>
        </div>
      </div>

      {/* table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 650 }}>
          <thead>
            <tr>
              {['Name', 'Link', 'Status', 'Action'].map(h => <th key={h} style={thS}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>Loading...</td></tr>
            ) : !rows.length ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: 13 }}>No community links found</td></tr>
            ) : rows.map(row => {
              const isActive = row.status === 'active';
              const isEditing = editId === row.id;
              return (
                <tr key={row.id}>
                  <td style={tdS(isActive)}>
                    {isEditing
                      ? <InlineInput value={editForm.community_name} onChange={v => setEditForm(p => ({ ...p, community_name: v }))} style={{ minWidth: 180 }} />
                      : <span style={{ fontWeight: 500 }}>{row.community_name}</span>}
                  </td>
                  <td style={{ ...tdS(isActive), maxWidth: 280 }}>
                    {isEditing
                      ? <InlineInput value={editForm.community_link} onChange={v => setEditForm(p => ({ ...p, community_link: v }))} style={{ minWidth: 220 }} />
                      : <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <a href={row.community_link} target="_blank" rel="noreferrer"
                          style={{
                            color: '#4f46e5', fontSize: 12, overflow: 'hidden',
                            textOverflow: 'ellipsis', maxWidth: 220, display: 'block'
                          }}>
                          {row.community_link}
                        </a>
                        <button onClick={() => copyLink(row.community_link)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#94a3b8', fontSize: 12, padding: 2, flexShrink: 0
                          }}>📋</button>
                      </div>}
                  </td>
                  <td style={tdS(isActive)}>
                    {isEditing
                      ? <InlineSelect value={editForm.status} options={['active', 'pending', 'closed']}
                        onChange={v => setEditForm(p => ({ ...p, status: v }))} />
                      : <StatusBadge status={row.status === 'active' ? 'active' : row.status === 'pending' ? 'pending' : 'closed'} />}
                  </td>
                  <td style={tdS(isActive)}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {isEditing ? <>
                        <button onClick={() => handleUpdate(row.id)}
                          style={{
                            padding: '4px 12px', border: 'none', borderRadius: 6, fontSize: 11.5,
                            fontWeight: 700, cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
                            background: 'linear-gradient(135deg,#16a34a,#15803d)'
                          }}>✔ Update</button>
                        <button onClick={cancelEdit}
                          style={{
                            padding: '4px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                            fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: '#fff',
                            color: '#64748b', fontFamily: 'inherit'
                          }}>✕ Cancel</button>
                      </> : <>
                        {row.status !== 'active' && (
                          <button onClick={() => startEdit(row.id)}
                            style={{
                              padding: '4px 12px', border: 'none', borderRadius: 6, fontSize: 11.5,
                              fontWeight: 700, cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
                              background: 'linear-gradient(135deg,#0ea5e9,#0284c7)'
                            }}>✏️ Edit</button>
                        )}
                        <button onClick={() => setConfirm({ msg: 'You want to disable this community link!', fn: () => handleDisable(row.id) })}
                          style={{
                            padding: '4px 10px', border: 'none', borderRadius: 6, fontSize: 11.5,
                            fontWeight: 700, cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
                            background: 'linear-gradient(135deg,#f59e0b,#d97706)'
                          }}>⏸ Disable</button>
                        <button onClick={() => setConfirm({ msg: 'Once deleted, you cannot recover this community link!', fn: () => handleDelete(row.id) })}
                          style={{
                            padding: '4px 10px', border: 'none', borderRadius: 6, fontSize: 11.5,
                            fontWeight: 700, cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
                            background: 'linear-gradient(135deg,#dc2626,#b91c1c)'
                          }}>✕</button>
                      </>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {confirm && <ConfirmModal {...confirm} onClose={() => setConfirm(null)} onConfirm={confirm.fn} />}
    </div>
    </>
  );
}

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
export default function WhatsAppCommunityLinks() {
  const [citVersions, setCitVersions] = useState([]);

  useEffect(() => {
    post({ action: 'get_cit_versions' })
      .then(res => { if (res.success) setCitVersions(res.data || []); })
      .catch(() => { });
  }, []);

  return (
    <>
    <Helmet>
        <title>Whatsapp Link | Admin Panel</title>
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .wacl-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
      `}</style>

      <div className="wacl-root" style={{
        display: 'flex', flexDirection: 'column',
        minHeight: 'calc(100vh - 62px)', padding: 20, gap: 16, overflowY: 'auto', background: '#f5f3ff'
      }}>

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>💬 WhatsApp Community Links</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Manage community links for current and CIT-version-specific groups
            </div>
          </div>
        </div>

        {/* ── SECTION 1: New Table ── */}
        <NewLinksSection citVersions={citVersions} />

        {/* ── SECTION 2: Current Table ── */}
        <CurrentLinksSection />

      </div>
    </>
  );
}