import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

/* TEST API: https://cit3.internshipstudio.com/admin/react-api/api/examinations/result_publish_test.php */
const API = '/api/examinations/result_publish_test.php';
const FH  = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk  = obj => new URLSearchParams(obj);

const card = {
  background: '#fff', borderRadius: 12, border: '1.5px solid #ede9fe',
  boxShadow: '0 1px 8px rgba(124,58,237,.05)', padding: 18,
};
const thS = {
  color: '#fff', fontSize: 11, fontWeight: 600, padding: '10px 12px',
  textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px', whiteSpace: 'nowrap',
};
const tdS = { padding: '9px 12px', borderBottom: '1px solid #f5f3ff', color: '#334155', fontSize: 12 };

export default function ResultPublishTest() {
  const [stats,   setStats]   = useState(null);
  const [logs,    setLogs]    = useState([]);
  const [round,   setRound]   = useState(1);
  const [ids,     setIds]     = useState('');
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(false);
  const [result,  setResult]  = useState(null);

  /* ── load stats + logs ── */
  const loadStats = useCallback(() => (
    api.post(API, mk({ action: 'get_stats' }), FH)
      .then(r => { if (r.data.status === 'success') setStats(r.data.data); })
      .catch(() => toast.error('Failed to load stats'))
  ), []);

  const loadLogs = useCallback(() => (
    api.post(API, mk({ action: 'get_logs' }), FH)
      .then(r => { if (r.data.status === 'success') setLogs(r.data.data || []); })
      .catch(() => {})
  ), []);

  useEffect(() => {
    Promise.all([loadStats(), loadLogs()]).finally(() => setLoading(false));
  }, [loadStats, loadLogs]);

  /* ── test publish ── */
  const handlePublish = async () => {
    const list = ids.split(',').map(s => s.trim()).filter(Boolean);
    if (list.length === 0 || list.length > 3) {
      toast.error('Enter 1 to 3 user IDs, comma-separated'); return;
    }
    if (!window.confirm(`Run TEST publish for user IDs: ${list.join(', ')}?\nWrites only to *_test tables.`)) return;

    setBusy(true); setResult(null);
    try {
      const r = await api.post(API, mk({ action: 'publish', user_ids: list.join(','), round }), FH);
      if (r.data.status === 'success') {
        toast.success(r.data.message);
        setResult(r.data.data);
        await loadLogs();
      } else {
        toast.error(r.data.message || 'Test publish failed');
      }
    } catch {
      toast.error('Test publish request failed');
    } finally { setBusy(false); }
  };

  /* ── clear a test batch ── */
  const clearBatch = async (batch_id) => {
    if (!window.confirm(`Clear all result_test rows for test batch #${batch_id}?`)) return;
    try {
      const r = await api.post(API, mk({ action: 'delete_test', batch_id }), FH);
      if (r.data.status === 'success') { toast.success(r.data.message); await loadLogs(); }
      else toast.error(r.data.message || 'Failed');
    } catch { toast.error('Request failed'); }
  };

  /* ════════ RENDER ════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .rpt-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        @keyframes rpt_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="rpt-root" style={{
        height: 'calc(100vh - 62px)', overflowY: 'auto',
        padding: 20, background: '#f5f3ff', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>🧪 Publish CIT Results — Test</span>
          <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
            background: '#ede9fe', color: '#7c3aed' }}>TEST MODE</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ display: 'inline-block', width: 30, height: 30, border: '3px solid #ede9fe',
              borderTop: '3px solid #7c3aed', borderRadius: '50%', animation: 'rpt_spin .7s linear infinite' }} />
          </div>
        ) : (
          <>
            {/* ── INPUT CARD ── */}
            <div style={{ ...card, border: '1.5px dashed #c4b5fd' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', marginBottom: 4 }}>
                Test Publish (2-3 users)
              </div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 12 }}>
                Writes only to <code>result_test</code> / <code>user_steps_test</code> / <code>result_publish_logs_test</code>.
                Real data is never touched.
              </div>

              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 14 }}>
                {[
                  ['Date', stats?.date],
                  ['CIT Version', stats?.cit_version],
                  ['Eligible results', stats?.user_count],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>{k}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#7c3aed' }}>{v ?? '—'}</div>
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Round</div>
                  <input type="number" min={1} value={round}
                    onChange={e => setRound(Math.max(1, +e.target.value || 1))}
                    style={{ width: 70, padding: '4px 8px', border: '1.5px solid #e2e8f0',
                      borderRadius: 6, fontSize: 14, fontWeight: 700, color: '#7c3aed', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={ids} onChange={e => setIds(e.target.value)}
                  placeholder="User IDs — e.g. 101, 102, 103"
                  style={{ flex: '0 0 280px', padding: '8px 12px', border: '1.5px solid #e2e8f0',
                    borderRadius: 8, fontSize: 12.5, outline: 'none', color: '#1e293b' }} />
                <button onClick={handlePublish} disabled={busy}
                  style={{ padding: '9px 22px', border: 'none', borderRadius: 8, fontSize: 12.5,
                    fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                    cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? .6 : 1 }}>
                  {busy ? 'Running…' : '▶ Run Test Publish'}
                </button>
              </div>
            </div>

            {/* ── LAST TEST RESULT ── */}
            {result && (
              <div style={{ ...card, background: '#faf5ff', border: '1.5px solid #ddd6fe' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', marginBottom: 8 }}>
                  ✔ {result.mode} Publish Complete (Batch #{result.batch_id})
                </div>
                <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', fontSize: 12, color: '#334155', marginBottom: 10 }}>
                  <span>Added: <strong>{result.added}</strong></span>
                  <span>Skipped: <strong>{result.skipped}</strong></span>
                  <span>Total: <strong>{result.total_users}</strong></span>
                  <span>Start: <strong>{result.publish_start_time}</strong></span>
                  <span>End: <strong>{result.publish_end_time}</strong></span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#7c3aed' }}>
                      {['User ID', 'Right', 'Wrong', 'Total', 'Rank', 'Percentile'].map(h => (
                        <th key={h} style={thS}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.users.map(u => (
                      <tr key={u.user_id}>
                        <td style={{ ...tdS, fontWeight: 600, color: '#7c3aed' }}>{u.user_id}</td>
                        <td style={{ ...tdS, color: '#16a34a', fontWeight: 600 }}>{u.rightans}</td>
                        <td style={{ ...tdS, color: '#dc2626', fontWeight: 600 }}>{u.wrongans}</td>
                        <td style={tdS}>{u.total}</td>
                        <td style={tdS}>#{u.rank}</td>
                        <td style={tdS}>{u.percentile}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── TEST LOGS ── */}
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', padding: '14px 18px 8px' }}>
                Test Publish Logs
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                      {['ID', 'CIT Version', 'Batch', 'Mode', 'Total', 'Added', 'Skipped',
                        'First User', 'Last User', 'Start (1st student)', 'End (last student)',
                        'Status', 'Action'].map(h => (
                        <th key={h} style={thS}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr><td colSpan={13} style={{ textAlign: 'center', color: '#94a3b8', padding: 32, fontSize: 13 }}>
                        No test logs yet
                      </td></tr>
                    ) : logs.map(l => (
                      <tr key={l.id}>
                        <td style={tdS}>{l.id}</td>
                        <td style={{ ...tdS, fontWeight: 600, color: '#7c3aed' }}>{l.cit_version}</td>
                        <td style={tdS}>#{l.batch_id}</td>
                        <td style={tdS}>{l.mode}</td>
                        <td style={tdS}>{l.total_users}</td>
                        <td style={{ ...tdS, color: '#16a34a', fontWeight: 600 }}>{l.added_count}</td>
                        <td style={{ ...tdS, color: '#dc2626', fontWeight: 600 }}>{l.skipped_count}</td>
                        <td style={tdS}>{l.first_user_id}</td>
                        <td style={tdS}>{l.last_user_id}</td>
                        <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{l.publish_start_time}</td>
                        <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{l.publish_end_time}</td>
                        <td style={tdS}>
                          <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
                            background: '#ede9fe', color: '#7c3aed' }}>{l.status}</span>
                        </td>
                        <td style={tdS}>
                          <button onClick={() => clearBatch(l.batch_id)}
                            style={{ padding: '4px 9px', background: '#fee2e2', color: '#dc2626',
                              border: '1.5px solid #fecaca', borderRadius: 6, fontSize: 10.5,
                              fontWeight: 600, cursor: 'pointer' }}>
                            Clear
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
