/*
 * Kumo — Attribute logs.
 *
 * A clone of src/pages/netcore/AttributeLogs.jsx against the very same audit trail
 * (attributes.php?action=logs), reached from the "Logs" button in the Attributes toolbar and
 * routed at /kumo/attributes/logs.
 *
 * It lists what happened to the SHARED attribute store — every create/edit/delete plus the
 * attributes a CSV import created on its own — which is the same history the Netcore screen
 * shows, because it is the same store. Rows that live only in this module (origin 'kumo')
 * are saved through kapi('attribute_save') and are not written to this trail.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { KumoStyles } from './kumoShared';

const ATTR_API = '/api/attributes/attributes.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const PER_PAGE_OPTS = [10, 25, 50, 100];

function fmtDt(s) {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d.getTime())) return s;
  const pad = n => String(n).padStart(2, '0');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()} ${pad(d.getHours() % 12 || 12)}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

function StatusBadge({ status }) {
  const ok = status === 'processed';
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: ok ? '#dcfce7' : '#fee2e2', color: ok ? '#16a34a' : '#dc2626' }}>{String(status || '').toUpperCase()}</span>;
}

function Spinner() {
  return <span style={{ display: 'inline-block', width: 32, height: 32, borderRadius: '50%', border: '3px solid #c4b5fd', borderTopColor: '#4f46e5', animation: 'kma_spin 0.85s linear infinite' }} />;
}

export default function KumoAttributeLogs() {
  const nav = useNavigate();
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [pages, setPages]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchPage = async (p = page, pp = perPage) => {
    setLoading(true); setError('');
    try {
      const res = await api.post(ATTR_API, new URLSearchParams({ action: 'logs', page: p, per_page: pp }), FORM);
      if (res.data.success) {
        setRows(res.data.data.logs || []);
        setTotal(res.data.data.total || 0);
        setPage(res.data.data.page); setPages(res.data.data.pages); setPerPage(res.data.data.per_page);
      } else {
        setRows([]); setTotal(0); setError(res.data.message || 'Could not load the log');
      }
    } catch (e) {
      setRows([]); setTotal(0);
      setError(e?.response?.data?.message || 'Network error');
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchPage(1, perPage); }, []); // eslint-disable-line

  return (
    <>
      <KumoStyles />
      <style>{`
        @keyframes kma_spin { to { transform: rotate(360deg); } }
        .kma-logs *{ box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
      `}</style>

      <div className="km km-page kma-logs" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexShrink: 0 }}>
          <button onClick={() => nav('/kumo/attributes')} title="Back to Attributes"
            style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#334155', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#0f172a' }}>
              Attribute logs <span style={{ fontWeight: 600, color: '#64748b' }}>({total.toLocaleString()})</span>
            </div>
            <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Every create/edit/delete of a shared attribute, plus attributes auto-created from a CSV import</div>
          </div>
          <button onClick={() => nav('/kumo/attributes')}
            style={{ padding: '9px 16px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#1e3a8a', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Back to attributes
          </button>
          <button title="Refresh" onClick={() => fetchPage()}
            style={{ width: 36, height: 36, border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, cursor: 'pointer', color: '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
          </button>
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
                  {['Action', 'Attribute', 'Requested on', 'Username', 'Status'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading
                  ? <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: error ? '#b91c1c' : '#94a3b8' }}>{error || 'No activity yet.'}</td></tr>
                  : rows.map(r => (
                      <tr key={r.id}>
                        <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>{r.action}</td>
                        <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#1e3a8a', fontWeight: 600, fontFamily: 'monospace' }}>{r.attribute_name}</td>
                        <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>{fmtDt(r.created_at)}</td>
                        <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>{r.username || '—'}</td>
                        <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9' }}><StatusBadge status={r.status} /></td>
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
    </>
  );
}
