import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/lists/contact_uploads.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const PER_PAGE_OPTS = [10, 25, 50, 100];

function fmtDt(s) {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T'));
  if (isNaN(d.getTime())) return s;
  const pad = n => String(n).padStart(2, '0');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()} ${pad(d.getHours() % 12 || 12)}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

function StatusBadge({ status, percent }) {
  const styles = {
    processed:  { bg: '#dcfce7', fg: '#16a34a', label: 'PROCESSED' },
    failed:     { bg: '#fee2e2', fg: '#dc2626', label: 'FAILED' },
    processing: { bg: '#fef3c7', fg: '#92400e', label: `IN-PROGRESS (${percent}%)` },
    pending:    { bg: '#fef3c7', fg: '#92400e', label: `IN-PROGRESS (${percent}%)` },
  }[status] || { bg: '#f1f5f9', fg: '#475569', label: status?.toUpperCase() };
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: styles.bg, color: styles.fg, whiteSpace: 'nowrap' }}>{styles.label}</span>;
}

function Spinner() {
  return <span style={{ display: 'inline-block', width: 32, height: 32, borderRadius: '50%', border: '3px solid #c4b5fd', borderTopColor: '#4f46e5', animation: 'nc_spin 0.85s linear infinite' }} />;
}

export default function ContactLogs({ basePath = '/netcore/lists', listId } = {}) {
  const nav = useNavigate();
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [pages, setPages]     = useState(1);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const fetchPage = async (p = page, pp = perPage) => {
    setLoading(true);
    try {
      const params = { action: 'logs', page: p, per_page: pp };
      if (listId) params.list_id = listId;
      const res = await api.post(API, new URLSearchParams(params), FORM);
      if (res.data.success) {
        setRows(res.data.data.uploads || []);
        setTotal(res.data.data.total || 0);
        setPage(res.data.data.page); setPages(res.data.data.pages); setPerPage(res.data.data.per_page);
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchPage(1, perPage); }, []); // eslint-disable-line

  // Live-refresh the whole page every 5s while ANY row is still in progress —
  // simplest way to keep the % moving without per-row polling plumbing.
  useEffect(() => {
    const anyInProgress = rows.some(r => ['pending', 'processing'].includes(r.status));
    if (anyInProgress) {
      pollRef.current = setTimeout(() => fetchPage(page, perPage), 5000);
    }
    return () => clearTimeout(pollRef.current);
  }, [rows]); // eslint-disable-line

  const downloadFailures = async (id, filename) => {
    const t = toast.loading('Preparing download…');
    try {
      const res = await api.get(API, { params: { action: 'download_failures', id }, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = `failures_${filename || id}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Downloaded', { id: t });
    } catch { toast.error('Download failed', { id: t }); }
  };

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`@keyframes nc_spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexShrink: 0 }}>
        <button onClick={() => nav(basePath)} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#0f172a' }}>Contact logs <span style={{ fontWeight: 600, color: '#64748b' }}>({total.toLocaleString()})</span></div>
          <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Every CSV import you've run, with live progress and failure reports</div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.05)', overflow: 'hidden', position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.85)', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spinner />
          </div>
        )}
        <div style={{ height: '100%', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2 }}>
              <tr>
                {['Request ID', 'File name', 'Status', 'Upload started on', 'Requested on', 'List', 'Failure report'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading
                ? <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No imports yet.</td></tr>
                : rows.map(r => (
                    <tr key={r.id}>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>{r.id}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#1e3a8a', fontWeight: 600 }}>
                        {r.s3_url ? <a href={r.s3_url} target="_blank" rel="noreferrer" style={{ color: '#1e3a8a' }}>{r.original_filename}</a> : r.original_filename}
                      </td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9' }}><StatusBadge status={r.status} percent={r.percent} /></td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>{fmtDt(r.started_at)}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>{fmtDt(r.created_at)}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>{r.list_name || '—'}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9' }}>
                        {r.failed_count > 0
                          ? <button onClick={() => downloadFailures(r.id, r.original_filename)} style={{ border: 'none', background: 'none', color: '#dc2626', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                              Failures: {r.failed_count}
                            </button>
                          : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 13, color: '#475569', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Per page:</span>
          <select value={perPage} onChange={e => fetchPage(1, parseInt(e.target.value, 10))}
            style={{ padding: '6px 10px', border: '1.5px solid #c4b5fd', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none', background: '#fff', cursor: 'pointer' }}>
            {PER_PAGE_OPTS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Page {page} of {pages || 1}</span>
          <button disabled={page <= 1 || loading} onClick={() => fetchPage(page - 1, perPage)}
            style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Prev</button>
          <button disabled={page >= pages || loading} onClick={() => fetchPage(page + 1, perPage)}
            style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: page >= pages ? 'not-allowed' : 'pointer', opacity: page >= pages ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Next</button>
        </div>
      </div>
    </div>
  );
}
