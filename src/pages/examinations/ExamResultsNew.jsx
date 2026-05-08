import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/examinations/exam_results_new.php';
const FH = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk = obj => new URLSearchParams(obj);
const LIMIT = 15;

/* ── today / last-7 defaults — same as PHP's $(document).ready ── */
const today = () => new Date().toISOString().split('T')[0];
const last7 = () => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; };

const thS = {
  color: '#fff', fontSize: 10, fontWeight: 700, padding: '10px 10px',
  textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px',
  borderRight: '1px solid rgba(255,255,255,.15)', whiteSpace: 'nowrap'
};
const tdS = {
  padding: '8px 10px', borderBottom: '1px solid #f5f3ff', fontSize: 11.5,
  color: '#334155', verticalAlign: 'middle', maxWidth: 160, overflow: 'hidden',
  textOverflow: 'ellipsis', whiteSpace: 'nowrap'
};

/* ── edit modal ── */
function EditModal({ row, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    rightans: row.rightans || '',
    wrongans: row.wrongans || '',
    total: row.total || '',
    rank: row.rank || '',
  });
  const s = (k, v) => setForm(p => ({ ...p, [k]: v, ...(k === 'rightans' ? { total: parseInt(v || 0) * 3 } : {}) }));
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, maxWidth: 420, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden'
      }}>
        <div style={{ padding: '13px 18px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>✏️ Edit Result — User #{row.user_id}</span>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          {[['rightans', 'Right Answers', 'number'], ['wrongans', 'Wrong Answers', 'number'],
          ['total', 'Total Marks', 'number'], ['rank', 'Rank', 'number']].map(([k, lbl, t]) => (
            <div key={k}>
              <label style={{
                display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748b',
                textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4
              }}>{lbl}</label>
              <input type={t} value={form[k]} readOnly={k === 'total'}
                onChange={e => s(k, e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0',
                  borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: '#1e293b',
                  outline: 'none', background: k === 'total' ? '#f8fafc' : '#fff'
                }} />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1.5px solid #f1f5f9', paddingTop: 14 }}>
            <button onClick={onClose} style={{
              padding: '8px 16px', border: '1.5px solid #e2e8f0',
              background: '#f8fafc', color: '#475569', borderRadius: 8, fontSize: 12.5,
              fontWeight: 600, cursor: 'pointer'
            }}>Cancel</button>
            <button onClick={() => onSave(form)} disabled={saving}
              style={{
                padding: '8px 22px', border: 'none', borderRadius: 8, fontSize: 12.5,
                fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', color: '#fff',
                background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', opacity: saving ? .7 : 1
              }}>
              {saving ? 'Saving...' : '💾 Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── confirm delete ── */
function ConfirmDel({ row, onOk, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, maxWidth: 400, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden'
      }}>
        <div style={{ padding: '13px 18px', background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>⚠️ Delete Result</span>
        </div>
        <div style={{ padding: '18px 22px' }}>
          <p style={{ fontSize: 13, color: '#334155', marginBottom: 18, lineHeight: 1.55 }}>
            Delete the result for <strong>{row.name}</strong>? This will delete from cit_exam_login, cit_exam_data, cit_results and result tables.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={onCancel} style={{
              padding: '8px 16px', border: '1.5px solid #e2e8f0',
              background: '#f8fafc', color: '#475569', borderRadius: 8, fontSize: 12.5,
              fontWeight: 600, cursor: 'pointer'
            }}>Cancel</button>
            <button onClick={onOk} style={{
              padding: '8px 22px', border: 'none', borderRadius: 8,
              fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: '#fff',
              background: 'linear-gradient(135deg,#dc2626,#b91c1c)'
            }}>Yes, Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExamResultsNew() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [allRows, setAllRows] = useState([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [startDate, setStartDate] = useState(last7); // default: last 7 days
  const [endDate, setEndDate] = useState(today); // default: today
  const [endDisabled, setEndDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editRow, setEditRow] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [delRow, setDelRow] = useState(null);
  const [deleting, setDeleting] = useState(false);

  /* ── fetch — same as PHP's fetchData() + JS defaults ── */
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const offset = (page - 1) * LIMIT;
    const params = {
      action: 'fetch_exam_results', limit: LIMIT, offset,
      keyword: search, start_date: startDate, end_date: endDate
    };
    api.post(API, mk(params), { ...FH, signal: controller.signal })
      .then(res => {
        if (res.data.status === 'success') {
          setRows(res.data.data || []);
          setTotal(res.data.total || 0);
        }
      })
      .catch(err => { if (err?.name !== 'CanceledError' && err?.name !== 'AbortError') toast.error('Failed to load'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, search, startDate, endDate]);

  /* ── start date change — disable endDate until startDate set (same as PHP JS) ── */
  const handleStartDate = (val) => {
    setStartDate(val);
    setEndDisabled(!val);
    if (!val) setEndDate('');
    setPage(1);
  };

  /* ── clear filter — resets to last 7 days (same as PHP clearButton click) ── */
  const clearFilter = () => {
    setSearchInput(''); setSearch('');
    setStartDate(last7()); setEndDate(today());
    setEndDisabled(false); setPage(1);
  };

  /* ── edit ── */
  const saveEdit = async (form) => {
    setEditSaving(true);
    try {
      const res = await api.post(API, mk({
        action: 'edit_student_exam_result_new',
        user_id: editRow.user_id, ...form
      }), FH);
      if (res.data.status === 'success') {
        toast.success(res.data.message); setEditRow(null);
        // Refresh page data
        setPage(p => p); // trigger re-fetch via dependency change
        setRows(p => p.map(r => r.user_id == editRow.user_id
          ? { ...r, rightans: form.rightans, wrongans: form.wrongans, total: form.total, rank: form.rank }
          : r));
      } else toast.error(res.data.message);
    } catch { toast.error('Error'); }
    finally { setEditSaving(false); }
  };

  /* ── delete ── */
  const execDelete = async () => {
    setDeleting(true);
    try {
      const res = await api.post(API, mk({
        action: 'delete_student_exam_result_new',
        user_id: delRow.user_id, rightans: delRow.rightans
      }), FH);
      if (res.data.status === 'success') {
        toast.success(res.data.message); setDelRow(null);
        setRows(p => p.filter(r => !(r.user_id == delRow.user_id && r.rightans == delRow.rightans)));
        setTotal(p => p - 1);
      } else toast.error(res.data.message);
    } catch { toast.error('Error'); }
    finally { setDeleting(false); }
  };

  /* ── download CSV — same as PHP's downloadReport, requires filter ── */
  const downloadCSV = async () => {
    if (!search && !startDate && !endDate) {
      toast.error('Apply at least one filter and then download'); return;
    }
    setLoading(true);
    try {
      const res = await api.post(API, mk({
        action: 'fetch_exam_results', limit: total || 9999, offset: 0,
        keyword: search, start_date: startDate, end_date: endDate
      }), FH);
      if (res.data.status !== 'success') { toast.error('No data'); return; }
      const data = res.data.data || [];
      const headers = ['User ID', 'Name', 'Email', 'Phone', 'Medium', 'Ad', 'Ad Set', 'Campaign',
        'Total', 'Right', 'Wrong', 'Rank', 'Time Spent', 'Registered At', 'Exam Date',
        'Time Difference', 'CIT Version', 'Assigned WA Name', 'Assigned WA Link',
        'Selected Domain', 'Sub Domain', 'Internship Purchased', 'Instant'];
      const seen = new Set();
      const lines = data.filter(r => { if (seen.has(r.user_id)) return false; seen.add(r.user_id); return true; })
        .map(r => [r.user_id, `"${r.name}"`, `"${r.email}"`, `"${r.phone}"`,
        `"${r.medium ?? '-'}"`, `"${r.ad ?? '-'}"`, `"${r.adset ?? '-'}"`, `"${r.campaign ?? '-'}"`,
        r.total, r.rightans, r.wrongans, `"${r.rank ?? ''}"`, r.time_taken,
        `"${r.registered_at}"`, `"${r.exam_taken_date}"`, `"${r.time_difference ?? ''}"`,
        `"${r.cit_version ?? ''}"`, `"${r.assigned_name ?? ''}"`, `"${r.assigned_link ?? ''}"`,
        `"${r.domain ?? ''}"`, `"${r.subdomain ?? ''}"`, `"${r.internship_purchased ?? ''}"`,
        r.instant_exam].join(','));
      const csv = [headers.join(','), ...lines].join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = `Exam_Results_Page_${page}.csv`; a.click();
      URL.revokeObjectURL(a.href);
      toast.success('CSV downloaded successfully');
    } catch { toast.error('Error'); }
    finally { setLoading(false); }
  };

  const totalPages = Math.ceil(total / LIMIT) || 1;
  const pageButtons = () => {
    const maxV = 5;
    let start = Math.max(1, page - Math.floor(maxV / 2));
    let end = Math.min(totalPages, start + maxV - 1);
    if (end - start + 1 < maxV) start = Math.max(1, end - maxV + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const cell = (v) => v || '—';

  /* ════════ RENDER ════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .ern-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .ern-tr:hover td{background:#faf9ff!important;}
        .ern-pg:hover:not(:disabled){background:#ede9fe!important;color:#4f46e5!important;}
        @keyframes ern_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="ern-root" style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100vh - 62px)',
        padding: 20, gap: 12, overflow: 'hidden', background: '#f5f3ff',
      }}>

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>📊 Exam Result Dashboard</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>
              Count: <strong style={{ color: '#4f46e5' }}>{total}</strong>
            </span>
            <button onClick={downloadCSV}
              style={{
                padding: '7px 16px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700,
                cursor: 'pointer', color: '#fff', background: 'linear-gradient(135deg,#16a34a,#15803d)'
              }}>
              ⬇️ Download CSV
            </button>
          </div>
        </div>

        {/* ── TOOLBAR — same as PHP search + date row ── */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          {/* search — triggers on change same as PHP ── */}
          <div style={{
            display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: 8,
            overflow: 'hidden', background: '#fff', flex: '0 0 260px'
          }}>
            <input value={searchInput}
              onChange={e => { setSearchInput(e.target.value); setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or email..."
              style={{
                border: 'none', padding: '8px 12px', fontSize: 12.5, flex: 1,
                outline: 'none', fontFamily: 'inherit', color: '#1e293b'
              }} />
          </div>

          {/* Start Date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Start</label>
            <input type="date" value={startDate}
              onChange={e => handleStartDate(e.target.value)}
              style={{
                padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8,
                fontSize: 12, fontFamily: 'inherit', color: '#1e293b', outline: 'none',
                background: '#fff', cursor: 'pointer'
              }} />
          </div>
          {/* End Date — disabled until start is set (same as PHP) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>End</label>
            <input type="date" value={endDate}
              disabled={endDisabled}
              min={startDate}
              onChange={e => { setEndDate(e.target.value); setPage(1); }}
              style={{
                padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8,
                fontSize: 12, fontFamily: 'inherit', color: '#1e293b', outline: 'none',
                background: endDisabled ? '#f8fafc' : '#fff', cursor: endDisabled ? 'not-allowed' : 'pointer'
              }} />
          </div>

          {/* Clear Filter — same as PHP: resets to last 7 days */}
          <button onClick={clearFilter}
            style={{
              padding: '7px 14px', border: '1.5px solid #e2e8f0', background: '#f8fafc',
              color: '#475569', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}>
            ✕ Clear Filter
          </button>
        </div>

        {/* ── TABLE CARD ── */}
        <div style={{
          flex: 1, minHeight: 0, background: '#fff', borderRadius: 12,
          border: '1.5px solid #ede9fe', boxShadow: '0 1px 8px rgba(79,70,229,.05)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1400 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {['ID', 'Name', 'Email', 'Phone', 'Total', 'Right', 'Wrong', 'Rank',
                    'Time Spent', 'Registered', 'Exam Date', 'Δ Time', 'CIT Ver',
                    'WA Name', 'Domain', 'Subdomain', 'Internship', 'Instant', 'Action'].map(h => (
                      <th key={h} style={thS}>{h}</th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={19} style={{ textAlign: 'center', padding: 48 }}>
                    <div style={{
                      display: 'inline-block', width: 28, height: 28, border: '3px solid #ede9fe',
                      borderTop: '3px solid #4f46e5', borderRadius: '50%', animation: 'ern_spin .7s linear infinite'
                    }} />
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={19} style={{ textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 }}>
                    No records found
                  </td></tr>
                ) : rows.map((r, i) => (
                  <tr key={`${r.user_id}-${i}`} className="ern-tr">
                    <td style={{ ...tdS, color: '#4f46e5', fontWeight: 600 }}>{r.user_id}</td>
                    <td style={{ ...tdS, fontWeight: 600, color: '#1e293b', maxWidth: 130 }}>{cell(r.name)}</td>
                    <td style={{ ...tdS, fontSize: 11, maxWidth: 160 }}>{cell(r.email)}</td>
                    <td style={tdS}>{cell(r.phone)}</td>
                    <td style={{ ...tdS, fontWeight: 700, color: parseInt(r.total) >= 60 ? '#16a34a' : '#dc2626' }}>{cell(r.total)}</td>
                    <td style={{ ...tdS, color: '#16a34a', fontWeight: 700 }}>{cell(r.rightans)}</td>
                    <td style={{ ...tdS, color: '#dc2626', fontWeight: 700 }}>{cell(r.wrongans)}</td>
                    <td style={tdS}>
                      {r.rank ? <span style={{
                        padding: '2px 8px', background: '#ede9fe', color: '#4f46e5',
                        borderRadius: 99, fontSize: 10.5, fontWeight: 700
                      }}>#{r.rank}</span>
                        : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={{ ...tdS, fontSize: 10.5, maxWidth: 100 }}>{cell(r.time_taken)}</td>
                    <td style={{ ...tdS, fontSize: 10.5 }}>{cell(r.registered_at)}</td>
                    <td style={{ ...tdS, fontSize: 10.5 }}>{cell(r.exam_taken_date)}</td>
                    <td style={{ ...tdS, fontSize: 10.5, maxWidth: 100 }}>{cell(r.time_difference)}</td>
                    <td style={tdS}>{cell(r.cit_version)}</td>
                    <td style={{ ...tdS, maxWidth: 120 }}>{cell(r.assigned_name)}</td>
                    <td style={{ ...tdS, fontSize: 10.5, maxWidth: 110 }}>{cell(r.domain)}</td>
                    <td style={{ ...tdS, fontSize: 10.5, maxWidth: 110 }}>{cell(r.subdomain)}</td>
                    <td style={{ ...tdS, fontSize: 10.5, maxWidth: 100 }}>
                      <span style={{ color: r.internship_purchased === 'No' ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                        {cell(r.internship_purchased)}
                      </span>
                    </td>
                    <td style={tdS}>{r.instant_exam == 1
                      ? <span style={{
                        padding: '2px 7px', background: '#dbeafe', color: '#1d4ed8',
                        borderRadius: 99, fontSize: 10, fontWeight: 700
                      }}>Yes</span>
                      : <span style={{ color: '#94a3b8', fontSize: 10.5 }}>No</span>}</td>
                    <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                      <button onClick={() => setEditRow(r)}
                        style={{
                          padding: '4px 9px', background: '#fef9c3', color: '#b45309',
                          border: '1.5px solid #fde68a', borderRadius: 5, fontSize: 10.5,
                          fontWeight: 600, cursor: 'pointer', marginRight: 4
                        }}>✏️</button>
                      <button onClick={() => setDelRow(r)}
                        style={{
                          padding: '4px 9px', background: '#fee2e2', color: '#dc2626',
                          border: '1.5px solid #fecaca', borderRadius: 5, fontSize: 10.5,
                          fontWeight: 600, cursor: 'pointer'
                        }}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── PAGINATION ── */}
          {totalPages > 1 && (
            <div style={{
              flexShrink: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
              gap: 4, padding: '7px 14px', borderTop: '1px solid #f5f3ff', background: '#fafafa'
            }}>
              <span style={{ fontSize: 11.5, color: '#64748b', marginRight: 6 }}>Page {page} of {totalPages}</span>
              {[['First', () => setPage(1)], ['Prev', () => setPage(p => p - 1)]].map(([l, fn]) => (
                <button key={l} className="ern-pg" onClick={fn} disabled={page === 1}
                  style={{
                    padding: '4px 9px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                    background: '#fff', fontSize: 11.5, cursor: page === 1 ? 'not-allowed' : 'pointer',
                    color: page === 1 ? '#cbd5e1' : '#334155'
                  }}>{l}</button>
              ))}
              {pageButtons().map(pg => (
                <button key={pg} className="ern-pg" onClick={() => setPage(pg)}
                  style={{
                    padding: '4px 9px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                    background: pg === page ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#fff',
                    color: pg === page ? '#fff' : '#334155', fontSize: 11.5, cursor: 'pointer',
                    fontWeight: pg === page ? 700 : 400
                  }}>{pg}</button>
              ))}
              {[['Next', () => setPage(p => p + 1)], ['Last', () => setPage(totalPages)]].map(([l, fn]) => (
                <button key={l} className="ern-pg" onClick={fn} disabled={page === totalPages}
                  style={{
                    padding: '4px 9px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                    background: '#fff', fontSize: 11.5, cursor: page === totalPages ? 'not-allowed' : 'pointer',
                    color: page === totalPages ? '#cbd5e1' : '#334155'
                  }}>{l}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── EDIT MODAL ── */}
      {editRow && <EditModal row={editRow} onSave={saveEdit} onClose={() => setEditRow(null)} saving={editSaving} />}

      {/* ── DELETE CONFIRM ── */}
      {delRow && <ConfirmDel row={delRow} onOk={execDelete} onCancel={() => setDelRow(null)} />}
    </>
  );
}