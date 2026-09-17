import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

/* API: https://cit3.internshipstudio.com/admin/react-api/api/monitoring/monitoring.php */
const API = '/api/monitoring/monitoring.php';

/* Auto-refresh the overview. The light checks run every 5 minutes, so a
   60s poll always shows something no more than a minute stale. */
const POLL_MS = 60000;

const thS = {
  color: '#fff', fontSize: 11, fontWeight: 600, padding: '11px 12px',
  textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px', whiteSpace: 'nowrap',
};
const tdS = { padding: '9px 12px', borderBottom: '1px solid #f5f3ff', color: '#334155', fontSize: 12, verticalAlign: 'middle' };
const lblS = { display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 4 };
const inp = { border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, outline: 'none', color: '#1e293b', background: '#fff', fontFamily: 'inherit' };

/* Semantic colours, deliberately separate from the panel's indigo accent —
   status must never be confused with branding. */
const SEV = {
  pass:    { fg: '#15803d', bg: '#dcfce7', dot: '#22c55e', label: 'Operational' },
  fail:    { fg: '#dc2626', bg: '#fee2e2', dot: '#ef4444', label: 'Failing' },
  skip:    { fg: '#64748b', bg: '#f1f5f9', dot: '#94a3b8', label: 'Skipped' },
  unknown: { fg: '#64748b', bg: '#f1f5f9', dot: '#cbd5e1', label: 'No data' },
};

const CHECK_OPTIONS = [
  ['all', 'All checks'],
  ['website-availability', 'Website availability'],
  ['api-health', 'API health'],
  ['registration', 'Student registration'],
  ['login-exam-start', 'Login and exam start'],
  ['exam-submission', 'Exam submission'],
  ['payment-checkout', 'Payment checkout'],
];

/* ── formatting ───────────────────────────────────────────── */

const fmtDateTime = (s) => {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d)) return s;
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const fmtDateTimeFull = (s) => {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d)) return s;
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
};

const fmtMs = (ms) => {
  if (ms === null || ms === undefined) return '—';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
};

const fmtMins = (m) => {
  if (m === null || m === undefined) return '—';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
};

const ago = (s) => {
  if (!s) return 'never';
  const secs = Math.floor((Date.now() - new Date(String(s).replace(' ', 'T')).getTime()) / 1000);
  if (secs < 0)    return 'just now';
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
};

const uptimeColor = (p) =>
  p === null || p === undefined ? '#94a3b8'
    : p >= 99.5 ? '#16a34a'
    : p >= 97   ? '#0369a1'
    : p >= 90   ? '#d97706'
    : '#dc2626';

/* ── small pieces ─────────────────────────────────────────── */

function StatusPill({ status, small }) {
  const s = SEV[status] || SEV.unknown;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: small ? '2px 8px' : '3px 10px', borderRadius: 99,
      fontSize: small ? 10 : 11, fontWeight: 700, whiteSpace: 'nowrap',
      background: s.bg, color: s.fg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: s.dot }} />
      {s.label}
    </span>
  );
}

/* Uptime as a bar as well as a number — a 96% that looks nearly full is
   easier to misread than one you can see is short. */
function UptimeBar({ data, label }) {
  const pct = data?.pct;
  const c = uptimeColor(pct);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.3px' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: c, fontVariantNumeric: 'tabular-nums' }}>
          {pct === null || pct === undefined ? '—' : `${pct}%`}
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct ?? 0}%`, background: c, borderRadius: 99, transition: 'width .35s ease' }} />
      </div>
      {data?.runs > 0 && (
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
          {data.runs} runs · avg {fmtMs(data.avg_ms)}
        </div>
      )}
    </div>
  );
}

function CheckCard({ c, onOpenRun }) {
  const s = SEV[c.status] || SEV.unknown;
  const failing = c.status === 'fail';
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 16,
      border: `1.5px solid ${failing ? '#fecaca' : '#ede9fe'}`,
      boxShadow: failing ? '0 1px 10px rgba(220,38,38,.08)' : '0 1px 8px rgba(79,70,229,.05)',
      display: 'flex', flexDirection: 'column', gap: 12,
      /* A left stripe encodes state in form as well as colour, so it still
         reads for anyone who cannot separate the red from the green. */
      borderLeft: `4px solid ${s.dot}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1e293b' }}>{c.check_name}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, lineHeight: 1.45 }}>{c.blurb}</div>
        </div>
        <StatusPill status={c.status} />
      </div>

      {failing && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '9px 11px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b' }}>
            Failed at: {c.failed_step || 'unknown step'}
          </div>
          {c.error && (
            <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 3, lineHeight: 1.5,
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
              title={c.error}>
              {c.error}
            </div>
          )}
          <div style={{ fontSize: 10.5, color: '#b91c1c', marginTop: 5, opacity: .85 }}>
            Failing for {c.failed_runs} run{c.failed_runs === 1 ? '' : 's'}
            {c.down_since ? ` · since ${fmtDateTime(c.down_since)}` : ''}
            {c.alerted ? ' · alert sent' : ''}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <UptimeBar data={c.uptime_24h} label="24 hours" />
        <UptimeBar data={c.uptime_7d}  label="7 days" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: '1px solid #f5f3ff', paddingTop: 9 }}>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          Last run {ago(c.last_run)} · {fmtMs(c.duration_ms)}
        </span>
        {c.run_id && (
          <button onClick={() => onOpenRun(c.run_id)} style={{
            border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 11, fontWeight: 700, color: '#4f46e5', padding: 0,
          }}>View trace →</button>
        )}
      </div>
    </div>
  );
}

/* 30-day bar chart. Canvas would be overkill for 30 bars; flexbox divs keep
   it crisp at any zoom and need no library. */
function TrendChart({ rows }) {
  if (!rows?.length) {
    return <div style={{ textAlign: 'center', color: '#94a3b8', padding: 28, fontSize: 12.5 }}>Not enough history yet</div>;
  }
  const max = Math.max(...rows.map(r => r.runs), 1);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 96 }}>
        {rows.map(r => {
          const h = Math.max(3, (r.runs / max) * 100);
          const failH = r.runs ? (r.failed / r.runs) * 100 : 0;
          return (
            <div key={r.day} title={`${r.day} · ${r.passed} passed, ${r.failed} failed`}
              style={{ flex: 1, height: `${h}%`, minWidth: 4, borderRadius: 3, overflow: 'hidden',
                background: '#22c55e', display: 'flex', flexDirection: 'column-reverse', cursor: 'default' }}>
              {failH > 0 && <div style={{ height: `${failH}%`, background: '#ef4444' }} />}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 10.5, color: '#94a3b8' }}>
        <span>{rows[0]?.day}</span>
        <span style={{ display: 'flex', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: '#22c55e' }} /> passed
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: '#ef4444' }} /> failed
          </span>
        </span>
        <span>{rows[rows.length - 1]?.day}</span>
      </div>
    </div>
  );
}

/* ════════ RUN TRACE MODAL ════════ */
function RunModal({ runId, onClose }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get(API, { params: { action: 'run', run_id: runId } })
      .then(r => { if (alive) setRecords(r.data?.data?.records || []); })
      .catch(() => toast.error('Failed to load the run'))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [runId]);

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, width: 720, maxWidth: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,.3)', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>🛰️ Run trace</div>
            <div style={{ fontSize: 11.5, color: '#64748b', fontFamily: 'ui-monospace,monospace' }}>{runId}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8,
            width: 30, height: 30, cursor: 'pointer', fontSize: 16, color: '#64748b' }}>×</button>
        </div>

        <div style={{ padding: 22, maxHeight: '70vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid #ede9fe',
                borderTop: '3px solid #4f46e5', borderRadius: '50%', animation: 'mon_spin .7s linear infinite' }} />
            </div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: 32, fontSize: 13 }}>No data for this run</div>
          ) : records.map(rec => (
            <div key={rec.id} style={{ border: '1px solid #f1f5f9', borderRadius: 12, marginBottom: 14, overflow: 'hidden' }}>
              <div style={{ padding: '12px 15px', background: '#faf9ff',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{rec.check_name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    {fmtDateTimeFull(rec.started_at)} · {fmtMs(rec.duration_ms)}
                    {rec.attempts > 1 ? ` · ${rec.attempts} attempts` : ''}
                  </div>
                </div>
                <StatusPill status={rec.status} />
              </div>

              {rec.error && (
                <div style={{ padding: '10px 15px', background: '#fef2f2', borderTop: '1px solid #fee2e2' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', marginBottom: 2 }}>
                    Failed at: {rec.failed_step || 'unknown step'}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#b91c1c', lineHeight: 1.55, wordBreak: 'break-word' }}>{rec.error}</div>
                </div>
              )}

              {rec.steps?.length > 0 && (
                <div style={{ padding: '12px 15px' }}>
                  {rec.steps.map((s, i) => {
                    const c = s.ok ? '#22c55e' : s.soft ? '#f59e0b' : '#ef4444';
                    return (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start',
                        padding: '5px 0', borderBottom: i < rec.steps.length - 1 ? '1px solid #fafafa' : 'none' }}>
                        <span style={{ width: 16, height: 16, borderRadius: 99, background: c, color: '#fff',
                          fontSize: 10, display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1, fontWeight: 700 }}>
                          {s.ok ? '✓' : s.soft ? '!' : '✕'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: '#334155', fontWeight: s.ok ? 500 : 700 }}>{s.name}</div>
                          {s.error && (
                            <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2, lineHeight: 1.5, wordBreak: 'break-word' }}>{s.error}</div>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{fmtMs(s.ms)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {rec.context && Object.keys(rec.context).length > 0 && (
                <div style={{ padding: '10px 15px', background: '#f8fafc', borderTop: '1px solid #f1f5f9',
                  display: 'flex', flexWrap: 'wrap', gap: '5px 16px' }}>
                  {Object.entries(rec.context).map(([k, v]) => (
                    <span key={k} style={{ fontSize: 11, color: '#64748b' }}>
                      <strong style={{ color: '#475569', fontWeight: 600 }}>{k}:</strong>{' '}
                      <span style={{ fontFamily: 'ui-monospace,monospace' }}>
                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════ OVERVIEW TAB ════════ */
function Overview({ onOpenRun }) {
  const [data, setData]   = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const first = useRef(true);

  const load = useCallback(() => {
    /* Only the first load shows a spinner — a poll that blanks the screen
       every minute is worse than one you cannot see. */
    if (first.current) setLoading(true);
    Promise.all([
      api.get(API, { params: { action: 'overview' } }),
      api.get(API, { params: { action: 'trend', days: 30 } }),
    ])
      .then(([o, t]) => {
        setData(o.data?.data || null);
        setTrend(t.data?.data?.trend || []);
      })
      .catch(() => { if (first.current) toast.error('Failed to load monitoring status'); })
      .finally(() => { setLoading(false); first.current = false; });
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ display: 'inline-block', width: 30, height: 30, border: '3px solid #ede9fe',
          borderTop: '3px solid #4f46e5', borderRadius: '50%', animation: 'mon_spin .7s linear infinite' }} />
      </div>
    );
  }
  if (!data) {
    return <div style={{ textAlign: 'center', color: '#94a3b8', padding: 48, fontSize: 13 }}>No monitoring data available</div>;
  }

  const { summary, checks } = data;
  const healthy = summary.healthy && !summary.stale;

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 2 }}>

      {/* headline banner */}
      <div style={{
        background: healthy ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#dc2626,#b91c1c)',
        borderRadius: 12, padding: '16px 20px', color: '#fff',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            {summary.stale
              ? 'The monitor has stopped reporting'
              : healthy
                ? 'All student journeys are working'
                : `${summary.failing} of ${summary.total} checks are failing`}
          </div>
          <div style={{ fontSize: 12, opacity: .9, marginTop: 2 }}>
            {summary.stale
              ? `Nothing recorded for ${summary.minutes_ago} minutes — check the monitoring server`
              : `Registration, exam and payment verified every 15 minutes · last run ${ago(summary.last_seen)}`}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {summary.total - summary.failing}/{summary.total}
          </div>
          <div style={{ fontSize: 10.5, opacity: .9, fontWeight: 600 }}>CHECKS PASSING</div>
        </div>
      </div>

      {/* check cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))', gap: 12 }}>
        {checks.map(c => <CheckCard key={c.check_id} c={c} onOpenRun={onOpenRun} />)}
      </div>

      {/* trend */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #ede9fe', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>Last 30 days</div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
            {summary.total_rows?.toLocaleString('en-IN')} results recorded since {fmtDateTime(summary.oldest)}
          </div>
        </div>
        <TrendChart rows={trend} />
      </div>
    </div>
  );
}

/* ════════ RUN HISTORY TAB ════════ */
function RunHistory({ onOpenRun }) {
  const [check, setCheck]     = useState('all');
  const [status, setStatus]   = useState('all');
  const [dateMode, setMode]   = useState('all');
  const [date, setDate]       = useState('');
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');
  const [q, setQ]             = useState('');

  const [committed, setCommitted] = useState({ check: 'all', status: 'all', dateMode: 'all', date: '', from: '', to: '', q: '' });
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;

  const [data, setData] = useState({ records: [], total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const buildParams = useCallback((c) => {
    const p = {};
    if (c.check !== 'all')  p.check  = c.check;
    if (c.status !== 'all') p.status = c.status;
    if (c.q.trim())         p.q      = c.q.trim();
    if (c.dateMode === 'single' && c.date) p.date = c.date;
    if (c.dateMode === 'range') { if (c.from) p.date_from = c.from; if (c.to) p.date_to = c.to; }
    return p;
  }, []);

  const fetchPage = useCallback((c, p) => {
    setLoading(true);
    api.get(API, { params: { action: 'runs', ...buildParams(c), page: p, per_page: PER_PAGE } })
      .then(r => {
        const d = r.data?.data;
        if (!d) { toast.error(r.data?.message || 'Failed to load history'); return; }
        setData(d);
      })
      .catch(() => toast.error('Failed to load run history'))
      .finally(() => setLoading(false));
  }, [buildParams]);

  useEffect(() => { fetchPage(committed, page); }, [committed, page, fetchPage]);

  const runSearch = () => {
    if (dateMode === 'range' && from && to && from > to) { toast.error('"From" date is after "To" date'); return; }
    setPage(1);
    setCommitted({ check, status, dateMode, date, from, to, q });
  };
  const resetSearch = () => {
    setCheck('all'); setStatus('all'); setMode('all'); setDate(''); setFrom(''); setTo(''); setQ('');
    setPage(1);
    setCommitted({ check: 'all', status: 'all', dateMode: 'all', date: '', from: '', to: '', q: '' });
  };

  const exportCSV = async () => {
    setExporting(true);
    const t = toast.loading('Preparing CSV…');
    try {
      const res = await api.get(API, { params: { action: 'export', ...buildParams(committed) }, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `monitoring_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded', { id: t });
    } catch { toast.error('Export failed', { id: t }); }
    finally { setExporting(false); }
  };

  const totalPages = data.total_pages || 1;

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
        <div>
          <label style={lblS}>Check</label>
          <select value={check} onChange={e => setCheck(e.target.value)} style={{ ...inp, cursor: 'pointer', width: 190 }}>
            {CHECK_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <div>
          <label style={lblS}>Result</label>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
            <option value="all">All</option>
            <option value="fail">Failed only</option>
            <option value="pass">Passed only</option>
            <option value="skip">Skipped</option>
          </select>
        </div>

        <div>
          <label style={lblS}>Date</label>
          <select value={dateMode} onChange={e => setMode(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
            <option value="all">All dates</option>
            <option value="single">Single date</option>
            <option value="range">Date range</option>
          </select>
        </div>
        {dateMode === 'single' && (
          <div><label style={lblS}>On</label><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} /></div>
        )}
        {dateMode === 'range' && (
          <>
            <div><label style={lblS}>From</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inp} /></div>
            <div><label style={lblS}>To</label><input type="date" value={to} onChange={e => setTo(e.target.value)} style={inp} /></div>
          </>
        )}

        <div>
          <label style={lblS}>Run ID or error text</label>
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && runSearch()}
            placeholder="e.g. timeout" style={{ ...inp, width: 200 }} />
        </div>

        <button onClick={runSearch} style={{ ...inp, background: '#4f46e5', color: '#fff', fontWeight: 700, cursor: 'pointer', border: 'none' }}>🔍 Search</button>
        <button onClick={resetSearch} style={{ ...inp, background: '#f1f5f9', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>Reset</button>
        <button onClick={exportCSV} disabled={exporting}
          style={{ ...inp, background: '#ecfdf5', color: '#15803d', border: '1.5px solid #a7f3d0', fontWeight: 700, cursor: exporting ? 'wait' : 'pointer' }}>
          {exporting ? '⏳ Exporting…' : '⬇️ Export CSV'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#64748b', flexShrink: 0 }}>
        <strong style={{ color: '#4f46e5' }}>{data.total?.toLocaleString('en-IN')}</strong> matching result{data.total === 1 ? '' : 's'}
        <span style={{ marginLeft: 8, color: '#94a3b8' }}>· click any row to see the step-by-step trace</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 12, border: '1.5px solid #ede9fe',
        boxShadow: '0 1px 8px rgba(79,70,229,.05)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                {['Time (IST)', 'Check', 'Group', 'Result', 'Failed step', 'Error', 'Duration', 'Tries', 'Alert'].map(h => <th key={h} style={thS}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 48 }}>
                  <div style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid #ede9fe',
                    borderTop: '3px solid #4f46e5', borderRadius: '50%', animation: 'mon_spin .7s linear infinite' }} />
                </td></tr>
              ) : data.records.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 }}>No matching results</td></tr>
              ) : data.records.map(r => (
                <tr key={r.id} className="mon-tr" onClick={() => onOpenRun(r.run_id)} style={{ cursor: 'pointer' }}>
                  <td style={{ ...tdS, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtDateTime(r.started_at)}</td>
                  <td style={{ ...tdS, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{r.check_name}</td>
                  <td style={tdS}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                      background: r.check_group === 'journey' ? '#ede9fe' : '#e0f2fe',
                      color: r.check_group === 'journey' ? '#6d28d9' : '#0369a1', textTransform: 'uppercase' }}>
                      {r.check_group}
                    </span>
                  </td>
                  <td style={tdS}><StatusPill status={r.status} small /></td>
                  <td style={{ ...tdS, maxWidth: 200 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.failed_step}>
                      {r.failed_step || '—'}
                    </div>
                  </td>
                  <td style={{ ...tdS, maxWidth: 300 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: r.status === 'fail' ? '#dc2626' : '#94a3b8' }} title={r.error}>
                      {r.error || '—'}
                    </div>
                  </td>
                  <td style={{ ...tdS, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtMs(r.duration_ms)}</td>
                  <td style={{ ...tdS, fontVariantNumeric: 'tabular-nums' }}>{r.attempts || '—'}</td>
                  <td style={tdS}>{r.alerted ? '📧' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
            padding: '10px 14px', borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={pgBtn(page <= 1)}>‹ Prev</button>
            <span style={{ fontSize: 12, color: '#64748b' }}>Page <strong>{page}</strong> of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={pgBtn(page >= totalPages)}>Next ›</button>
          </div>
        )}
      </div>
    </>
  );
}
const pgBtn = (disabled) => ({
  padding: '6px 12px', borderRadius: 7, border: '1.5px solid #e2e8f0', fontSize: 12, fontWeight: 600,
  background: disabled ? '#f8fafc' : '#fff', color: disabled ? '#cbd5e1' : '#4f46e5', cursor: disabled ? 'not-allowed' : 'pointer',
});

/* ════════ INCIDENTS TAB ════════ */
function Incidents() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(API, { params: { action: 'incidents', days } })
      .then(r => setRows(r.data?.data?.incidents || []))
      .catch(() => toast.error('Failed to load incidents'))
      .finally(() => setLoading(false));
  }, [days]);

  const openCount = rows.filter(r => r.ongoing).length;

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0 }}>
        <div>
          <label style={lblS}>Period</label>
          <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ ...inp, cursor: 'pointer' }}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        <div style={{ fontSize: 12, color: '#64748b', paddingBottom: 9 }}>
          <strong style={{ color: '#4f46e5' }}>{rows.length}</strong> incident{rows.length === 1 ? '' : 's'}
          {openCount > 0 && <span style={{ color: '#dc2626', fontWeight: 700, marginLeft: 8 }}>· {openCount} still ongoing</span>}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 12, border: '1.5px solid #ede9fe',
        boxShadow: '0 1px 8px rgba(79,70,229,.05)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            <tr style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
              {['Started (IST)', 'Check', 'Duration', 'Failed runs', 'Failed step', 'Error', 'Recovered', 'Alert'].map(h => <th key={h} style={thS}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48 }}>
                <div style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid #ede9fe',
                  borderTop: '3px solid #4f46e5', borderRadius: '50%', animation: 'mon_spin .7s linear infinite' }} />
              </td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 }}>
                No incidents in this period — everything has been working
              </td></tr>
            ) : rows.map((r, i) => (
              <tr key={`${r.check_id}_${r.started_at}_${i}`} className="mon-tr">
                <td style={{ ...tdS, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtDateTime(r.started_at)}</td>
                <td style={{ ...tdS, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{r.check_name}</td>
                <td style={{ ...tdS, whiteSpace: 'nowrap', fontWeight: 700,
                  color: r.minutes >= 60 ? '#dc2626' : r.minutes >= 15 ? '#d97706' : '#334155' }}>
                  {fmtMins(r.minutes)}
                </td>
                <td style={{ ...tdS, fontVariantNumeric: 'tabular-nums' }}>{r.failed_runs}</td>
                <td style={{ ...tdS, maxWidth: 190 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.failed_step}>{r.failed_step || '—'}</div>
                </td>
                <td style={{ ...tdS, maxWidth: 280 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#dc2626' }} title={r.error}>{r.error || '—'}</div>
                </td>
                <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                  {r.ongoing
                    ? <span style={{ padding: '3px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: '#fee2e2', color: '#dc2626' }}>Ongoing</span>
                    : fmtDateTime(r.recovered_at)}
                </td>
                <td style={tdS}>{r.alerted ? '📧' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ════════ PAGE ════════ */
export default function Monitoring() {
  const [tab, setTab] = useState('overview');   // overview | history | incidents
  const [openRun, setOpenRun] = useState(null);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .mon-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .mon-tr:hover td{background:#faf9ff!important;}
        @keyframes mon_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="mon-root" style={{
        display: 'flex', flexDirection: 'column', height: 'calc(100vh - 62px)',
        padding: 20, gap: 14, overflow: 'hidden', background: '#f5f3ff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>🛰️ Site Monitoring</div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            Registration, exam and payment checked automatically every 5–15 minutes
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0, borderBottom: '1.5px solid #ede9fe' }}>
          {[['overview', '📊 Overview'], ['history', '🧾 Run History'], ['incidents', '🚨 Incidents']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
              padding: '8px 14px', fontSize: 12.5, fontWeight: 700,
              color: tab === key ? '#4f46e5' : '#94a3b8',
              borderBottom: tab === key ? '2.5px solid #4f46e5' : '2.5px solid transparent', marginBottom: -1.5,
            }}>{label}</button>
          ))}
        </div>

        {tab === 'overview'  && <Overview onOpenRun={setOpenRun} />}
        {tab === 'history'   && <RunHistory onOpenRun={setOpenRun} />}
        {tab === 'incidents' && <Incidents />}
      </div>

      {openRun && <RunModal runId={openRun} onClose={() => setOpenRun(null)} />}
    </>
  );
}
