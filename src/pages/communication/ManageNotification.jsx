import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/communication/notifications.php';
const PER_PAGE = 20;

const thS = {
  color: '#fff', fontSize: 11, fontWeight: 600, padding: '11px 12px',
  textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px',
  borderRight: '1px solid rgba(255,255,255,.15)', whiteSpace: 'nowrap',
};
const tdS = { padding: '9px 12px', borderBottom: '1px solid #f5f3ff', color: '#334155', fontSize: 12, verticalAlign: 'middle' };

/* strip HTML → plain text (same as PHP's strip_tags) */
const stripHtml = (html) => {
  if (!html) return '—';
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent || d.innerText || '').trim();
};

/* yes/no badge */
const YesNo = ({ v }) => (
  <span style={{
    padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
    background: v == 1 ? '#dcfce7' : '#fee2e2', color: v == 1 ? '#16a34a' : '#dc2626'
  }}>
    {v == 1 ? 'Yes' : 'No'}
  </span>
);

/* confirmation modal */
function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden'
      }}>
        <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>⚠️ Confirm Delete</span>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <p style={{ fontSize: 13.5, color: '#334155', marginBottom: 20, lineHeight: 1.5 }}>{message}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={onCancel}
              style={{
                padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#f8fafc',
                color: '#475569', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer'
              }}>
              Cancel
            </button>
            <button onClick={onConfirm}
              style={{
                padding: '9px 22px', border: 'none', background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
                color: '#fff', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer'
              }}>
              Yes, Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ManageNotifications() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(null); // null | 'selected' | 'all'

  /* ── pagination derived ── */
  const totalPages = Math.ceil(rows.length / PER_PAGE);
  const paged = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  /* ── fetch ── */
  const fetchData = () => {
    setLoading(true);
    api.get(API)
      .then(res => {
        if (res.data.status === 'success') {
          const sorted = (res.data.notifications || []).sort((a, b) => b.id - a.id);
          setRows(sorted);
          setPage(1);
        }
      })
      .catch(() => toast.error('Failed to load notifications'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  /* ── selection ── */
  const toggleAll = (checked) => setSelected(checked ? new Set(paged.map(r => r.id)) : new Set());
  const toggleOne = (id) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allPageChecked = paged.length > 0 && paged.every(r => selected.has(r.id));

  /* ── execute delete ── */
  const execDelete = async (ids) => {
    setConfirm(null);
    setDeleting(true);
    try {
      const res = await api.post(API, { notification_ids: ids });
      if (res.data.status === 'success') {
        toast.success(res.data.message || 'Deleted');
        setRows(p => p.filter(r => !ids.includes(r.id)));
        setSelected(new Set());
        // adjust page if needed
        setPage(p => {
          const newTotal = Math.ceil((rows.length - ids.length) / PER_PAGE);
          return p > newTotal ? Math.max(1, newTotal) : p;
        });
      } else {
        toast.error(res.data.message || 'Delete failed');
      }
    } catch { toast.error('Error'); }
    finally { setDeleting(false); }
  };

  /* ── page buttons window ── */
  const pageButtons = () => {
    const maxV = 5;
    let start = Math.max(1, page - Math.floor(maxV / 2));
    let end = Math.min(totalPages, start + maxV - 1);
    if (end - start + 1 < maxV) start = Math.max(1, end - maxV + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .mn-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .mn-tr:hover td{background:#faf9ff!important;}
        .mn-pg:hover:not(:disabled){background:#ede9fe!important;color:#4f46e5!important;border-color:#c4b5fd!important;}
        @keyframes mn_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="mn-root" style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100vh - 62px)',
        padding: 20, gap: 14, overflow: 'hidden', background: '#f5f3ff',
      }}>

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>🔔 Manage Notifications</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {/* Delete Selected */}
            {selected.size > 0 && (
              <button onClick={() => setConfirm('selected')} disabled={deleting}
                style={{
                  padding: '9px 18px', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                  cursor: 'pointer', color: '#fff', background: 'linear-gradient(135deg,#f59e0b,#d97706)'
                }}>
                🗑 Delete Selected ({selected.size})
              </button>
            )}
            {/* Delete All */}
            {rows.length > 0 && (
              <button onClick={() => setConfirm('all')} disabled={deleting}
                style={{
                  padding: '9px 18px', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                  cursor: 'pointer', color: '#fff', background: 'linear-gradient(135deg,#dc2626,#b91c1c)'
                }}>
                🗑 Delete All ({rows.length})
              </button>
            )}
          </div>
        </div>

        {/* ── TABLE CARD ── */}
        <div style={{
          flex: 1, minHeight: 0, background: '#fff', borderRadius: 12,
          border: '1.5px solid #ede9fe', boxShadow: '0 1px 8px rgba(79,70,229,.05)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>

          {/* scrollable table — only 10 rows */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  <th style={{ ...thS, width: 44, textAlign: 'center' }}>
                    <input type="checkbox"
                      checked={allPageChecked}
                      onChange={e => toggleAll(e.target.checked)}
                      style={{ accentColor: '#fff', width: 14, height: 14 }} />
                  </th>
                  {['No.', 'Payment', 'Exam Given', 'Title', 'Message', 'Link', 'Created At'].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48 }}>
                    <div style={{
                      display: 'inline-block', width: 28, height: 28, border: '3px solid #ede9fe',
                      borderTop: '3px solid #4f46e5', borderRadius: '50%', animation: 'mn_spin .7s linear infinite'
                    }} />
                  </td></tr>
                ) : paged.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 }}>
                    No notifications found
                  </td></tr>
                ) : paged.map(row => (
                  <tr key={row.id} className="mn-tr">
                    <td style={{ ...tdS, textAlign: 'center' }}>
                      <input type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                        style={{ accentColor: '#4f46e5', width: 14, height: 14 }} />
                    </td>
                    <td style={{ ...tdS, fontWeight: 700, color: '#4f46e5', fontSize: 11.5 }}>#{row.id}</td>
                    <td style={tdS}><YesNo v={row.payment} /></td>
                    <td style={tdS}><YesNo v={row.exam_given} /></td>
                    <td style={{
                      ...tdS, fontWeight: 600, color: '#1e293b', maxWidth: 180,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {row.title || '—'}
                    </td>
                    {/* message — strip HTML, same as PHP's render truncate */}
                    {/* message — rendered HTML same as PHP DataTable */}
                    <td style={{ ...tdS, maxWidth: 280, overflow: 'hidden' }}>
                      <div
                        style={{ maxHeight: 72, overflow: 'hidden', fontSize: 12, lineHeight: 1.45 }}
                        dangerouslySetInnerHTML={{ __html: row.message || '—' }}
                      />
                    </td>
                    <td style={tdS}>
                      {row.redirection_link
                        ? <a href={row.redirection_link} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#4f46e5', fontWeight: 600, fontSize: 11.5 }}>🔗 Link</a>
                        : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={{ ...tdS, fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                      {row.created_at || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── PAGINATION ── */}
          {totalPages > 1 && (
            <div style={{
              flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center',
              gap: 4, padding: '8px 14px', borderTop: '1px solid #f5f3ff', background: '#fafafa', flexWrap: 'wrap'
            }}>
              <button className="mn-pg" onClick={() => setPage(1)} disabled={page === 1}
                style={{
                  padding: '4px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                  background: '#fff', fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer',
                  color: page === 1 ? '#cbd5e1' : '#334155'
                }}>First</button>
              <button className="mn-pg" onClick={() => setPage(p => p - 1)} disabled={page === 1}
                style={{
                  padding: '4px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                  background: '#fff', fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer',
                  color: page === 1 ? '#cbd5e1' : '#334155'
                }}>Prev</button>
              {pageButtons().map(pg => (
                <button key={pg} className="mn-pg" onClick={() => setPage(pg)}
                  style={{
                    padding: '4px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                    background: pg === page ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#fff',
                    color: pg === page ? '#fff' : '#334155', fontSize: 12, cursor: 'pointer',
                    fontWeight: pg === page ? 700 : 400
                  }}>{pg}</button>
              ))}
              <button className="mn-pg" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
                style={{
                  padding: '4px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                  background: '#fff', fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  color: page === totalPages ? '#cbd5e1' : '#334155'
                }}>Next</button>
              <button className="mn-pg" onClick={() => setPage(totalPages)} disabled={page === totalPages}
                style={{
                  padding: '4px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                  background: '#fff', fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  color: page === totalPages ? '#cbd5e1' : '#334155'
                }}>Last</button>
              <span style={{ fontSize: 11.5, color: '#64748b', marginLeft: 6 }}>
                Page {page} of {totalPages}
              </span>
            </div>
          )}

          {/* ── FOOTER ── */}
          {!loading && rows.length > 0 && (
            <div style={{
              flexShrink: 0, padding: '7px 16px', borderTop: '1px solid #f5f3ff',
              background: '#fafafa', fontSize: 11.5, color: '#64748b', fontWeight: 600,
              display: 'flex', justifyContent: 'space-between'
            }}>
              <span>Total: <strong style={{ color: '#4f46e5' }}>{rows.length}</strong> notifications</span>
              {selected.size > 0 && <span>{selected.size} selected</span>}
            </div>
          )}
        </div>
      </div>

      {/* ── CONFIRM MODAL ── */}
      {confirm && (
        <ConfirmModal
          message={
            confirm === 'all'
              ? `Are you sure you want to delete all ${rows.length} notifications? This cannot be undone.`
              : `Are you sure you want to delete ${selected.size} selected notification(s)? This cannot be undone.`
          }
          onConfirm={() => execDelete(
            confirm === 'all' ? rows.map(r => r.id) : [...selected]
          )}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}