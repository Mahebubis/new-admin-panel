import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

/* API: https://cit3.internshipstudio.com/admin/react-api/api/examinations/result_publish.php */
const API = '/api/examinations/result_publish.php';
const FH  = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk  = obj => new URLSearchParams(obj);

const card = {
  background: '#fff', borderRadius: 12, border: '1.5px solid #ede9fe',
  boxShadow: '0 1px 8px rgba(79,70,229,.05)', padding: 18,
};
const thS = {
  color: '#fff', fontSize: 11, fontWeight: 600, padding: '10px 12px',
  textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px', whiteSpace: 'nowrap',
};
const tdS = { padding: '9px 12px', borderBottom: '1px solid #f5f3ff', color: '#334155', fontSize: 12 };

export default function ResultPublish() {
  const [stats,    setStats]    = useState(null);
  const [logs,     setLogs]     = useState([]);
  const [round,    setRound]    = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState(false);
  const [result,   setResult]   = useState(null);   // last publish summary

  /* ── load stats + logs ── */
  const loadStats = useCallback(() => {
    return api.post(API, mk({ action: 'get_stats' }), FH)
      .then(r => { if (r.data.status === 'success') setStats(r.data.data); })
      .catch(() => toast.error('Failed to load stats'));
  }, []);

  const loadLogs = useCallback(() => {
    return api.post(API, mk({ action: 'get_logs' }), FH)
      .then(r => { if (r.data.status === 'success') setLogs(r.data.data || []); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([loadStats(), loadLogs()]).finally(() => setLoading(false));
  }, [loadStats, loadLogs]);

  /* ── publish (real) ── */
  const handlePublish = async () => {
    if (!window.confirm(
      `Publish results for ${stats?.cit_version}?\n\n` +
      `${stats?.user_count} results will be processed. This cannot be undone easily.`
    )) return;
    setBusy(true); setResult(null);
    try {
      // long timeout — the loop can take a while for large batches
      const r = await api.post(API, mk({ action: 'publish', round }), { ...FH, timeout: 300000 });
      if (r.data.status === 'success') {
        toast.success(r.data.message);
        setResult(r.data.data);
        await loadStats(); await loadLogs();
      } else {
        toast.error(r.data.message || 'Publish failed');
      }
    } catch {
      toast.error('Publish request failed');
    } finally { setBusy(false); }
  };

  /* ── delete existing batch ── */
  const handleDelete = async () => {
    if (!window.confirm(`Delete the existing batch for ${stats?.date}? All its result rows will be removed.`)) return;
    setBusy(true);
    try {
      const r = await api.post(API, mk({ action: 'delete_batch', date: stats.date }), FH);
      if (r.data.status === 'success') {
        toast.success(r.data.message);
        await loadStats();
      } else {
        toast.error(r.data.message || 'Delete failed');
      }
    } catch {
      toast.error('Delete request failed');
    } finally { setBusy(false); }
  };

  /* ════════ RENDER ════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .rp-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        @keyframes rp_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="rp-root" style={{
        height: 'calc(100vh - 62px)', overflowY: 'auto',
        padding: 20, background: '#f5f3ff', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {/* HEADER */}
        <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>📢 Publish CIT Results</div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ display: 'inline-block', width: 30, height: 30, border: '3px solid #ede9fe',
              borderTop: '3px solid #4f46e5', borderRadius: '50%', animation: 'rp_spin .7s linear infinite' }} />
          </div>
        ) : (
          <>
            {/* ── STATS / ACTION CARD ── */}
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
                Confirmation Required
              </div>

              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 14 }}>
                {[
                  ['Date', stats?.date],
                  ['CIT Version', stats?.cit_version],
                  ['Results to process', stats?.user_count],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>{k}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#4f46e5' }}>{v ?? '—'}</div>
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Round</div>
                  <input type="number" min={1} value={round}
                    onChange={e => setRound(Math.max(1, +e.target.value || 1))}
                    style={{ width: 70, padding: '4px 8px', border: '1.5px solid #e2e8f0',
                      borderRadius: 6, fontSize: 14, fontWeight: 700, color: '#4f46e5', outline: 'none' }} />
                </div>
              </div>

              {stats?.batch_exists ? (
                <>
                  <div style={{ background: '#fef9c3', borderLeft: '4px solid #eab308',
                    color: '#854d0e', padding: '10px 14px', borderRadius: 6, marginBottom: 12, fontSize: 12.5 }}>
                    <strong>Warning!</strong> A batch (#{stats.batch_id}) already exists for {stats.date}.
                    Delete it before publishing again.
                  </div>
                  <button onClick={handleDelete} disabled={busy}
                    style={{ padding: '9px 20px', border: 'none', borderRadius: 8, fontSize: 12.5,
                      fontWeight: 700, color: '#fff', background: '#dc2626',
                      cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? .6 : 1 }}>
                    {busy ? 'Working…' : '🗑 Delete Existing Batch'}
                  </button>
                </>
              ) : (
                <button onClick={handlePublish} disabled={busy || !stats?.user_count}
                  style={{ padding: '9px 22px', border: 'none', borderRadius: 8, fontSize: 12.5,
                    fontWeight: 700, color: '#fff',
                    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                    cursor: (busy || !stats?.user_count) ? 'not-allowed' : 'pointer',
                    opacity: (busy || !stats?.user_count) ? .6 : 1 }}>
                  {busy ? 'Publishing…' : '✅ Yes, Publish Results'}
                </button>
              )}
            </div>

            {/* ── LAST PUBLISH SUMMARY ── */}
            {result && (
              <div style={{ ...card, background: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>
                  ✔ Processing Complete (Batch #{result.batch_id})
                </div>
                <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', fontSize: 12, color: '#334155' }}>
                  <span>Added: <strong>{result.added}</strong></span>
                  <span>Skipped: <strong>{result.skipped}</strong></span>
                  <span>Total: <strong>{result.total_users}</strong></span>
                  <span>Start: <strong>{result.publish_start_time}</strong></span>
                  <span>End: <strong>{result.publish_end_time}</strong></span>
                </div>
              </div>
            )}

            {/* ── PUBLISH LOGS ── */}
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', padding: '14px 18px 8px' }}>
                Publish Logs
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                      {['ID', 'CIT Version', 'Batch', 'Mode', 'Total', 'Added', 'Skipped',
                        'First User', 'Last User', 'Start (1st student)', 'End (last student)', 'Status'].map(h => (
                        <th key={h} style={thS}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr><td colSpan={12} style={{ textAlign: 'center', color: '#94a3b8', padding: 32, fontSize: 13 }}>
                        No publish logs yet
                      </td></tr>
                    ) : logs.map(l => (
                      <tr key={l.id}>
                        <td style={tdS}>{l.id}</td>
                        <td style={{ ...tdS, fontWeight: 600, color: '#4f46e5' }}>{l.cit_version}</td>
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
                            background: '#dcfce7', color: '#15803d' }}>{l.status}</span>
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
