import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

/* API: https://cit3.internshipstudio.com/admin/react-api/api/monitoring/monitoring.php
   Actions: overview | runs | run | incidents | trend | export
   Every timestamp arrives from PHP already converted to IST, as
   "YYYY-MM-DD HH:MM:SS" — so nothing here re-interprets a time zone. */
const API = '/api/monitoring/monitoring.php';

const OVERVIEW_POLL_MS = 60000;   // the light checks run every 5 min; a minute is plenty
const PER_PAGE = 50;

/* ── formatting ─────────────────────────────────────────── */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* The API strings are already IST. Slicing them beats new Date(), which would
   re-read them in the browser's own zone and shift every timestamp. */
const fmtIST = (s, withSeconds = false) => {
  if (!s) return '—';
  const [d, t = ''] = String(s).split(' ');
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return s;
  const time = withSeconds ? t : t.slice(0, 5);
  return `${Number(day)} ${MONTHS[Number(m) - 1] || m} ${y}${time ? ' · ' + time : ''}`;
};
const fmtDay = (s) => {
  if (!s) return '—';
  const [, m, day] = String(s).split('-');
  return `${Number(day)} ${MONTHS[Number(m) - 1] || m}`;
};
const fmtMs = (ms) => {
  if (ms === null || ms === undefined) return '—';
  const n = Number(ms);
  return n < 1000 ? `${n} ms` : `${(n / 1000).toFixed(n < 10000 ? 2 : 1)} s`;
};
const fmtMinutes = (mins) => {
  if (mins === null || mins === undefined) return '—';
  const n = Number(mins);
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60), m = n % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
};
const fmtPct = (p) => (p === null || p === undefined ? '—' : `${Number(p).toFixed(2).replace(/\.00$/, '')}%`);

const STATUS = {
  pass:    { label: 'Pass',    bg: '#dcfce7', fg: '#15803d', dot: '#22c55e' },
  fail:    { label: 'Fail',    bg: '#fee2e2', fg: '#b91c1c', dot: '#ef4444' },
  skip:    { label: 'Skipped', bg: '#f1f5f9', fg: '#64748b', dot: '#94a3b8' },
  unknown: { label: 'No data', bg: '#f8fafc', fg: '#94a3b8', dot: '#cbd5e1' },
};
const st = (s) => STATUS[s] || STATUS.unknown;
const pctColor = (p) => (p === null || p === undefined ? '#94a3b8' : p >= 99 ? '#16a34a' : p >= 95 ? '#0369a1' : p >= 90 ? '#d97706' : '#dc2626');

/* ── shared styles ──────────────────────────────────────── */
const card = { background: '#fff', border: '1px solid #e9e7f7', borderRadius: 12, boxShadow: '0 1px 2px rgba(15,23,42,.04)' };
const inp = { border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, outline: 'none', color: '#1e293b', background: '#fff', fontFamily: 'inherit' };
const lblS = { display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5 };
const thS = { background: '#4f46e5', color: '#fff', fontSize: 11, fontWeight: 600, padding: '11px 12px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px', whiteSpace: 'nowrap' };
const tdS = { padding: '9px 12px', borderBottom: '1px solid #f5f3ff', color: '#334155', fontSize: 12, verticalAlign: 'middle' };
const btn = (primary) => ({
  border: primary ? 'none' : '1.5px solid #e2e8f0', borderRadius: 8, padding: '8px 14px',
  fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  background: primary ? '#4f46e5' : '#fff', color: primary ? '#fff' : '#475569',
});

function StatusPill({ status, small }) {
  const s = st(status);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: small ? '2px 8px' : '3px 10px',
      borderRadius: 99, fontSize: small ? 10 : 10.5, fontWeight: 700, background: s.bg, color: s.fg, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      {s.label}
    </span>
  );
}

function Spinner({ label = 'Loading…' }) {
  return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{label}</div>;
}

/* ════════ RUN DETAIL MODAL ════════ */
/* One run = every check in the same sweep, each with its step trace. The step
   objects come straight from the monitor, so this renders whatever keys are
   present rather than assuming a fixed shape. */
function StepRow({ step, index }) {
  if (step === null || typeof step !== 'object') {
    return (
      <div style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px dashed #f1f5f9', fontSize: 12 }}>
        <span style={{ color: '#94a3b8', width: 20 }}>{index + 1}</span>
        <span style={{ color: '#334155' }}>{String(step)}</span>
      </div>
    );
  }
  const name = step.name || step.step || step.label || step.title || `Step ${index + 1}`;
  const status = step.status || (step.ok === true ? 'pass' : step.ok === false ? 'fail' : null);
  const ms = step.duration_ms ?? step.ms ?? step.duration ?? null;
  const error = step.error || step.message || null;
  const known = ['name', 'step', 'label', 'title', 'status', 'ok', 'duration_ms', 'ms', 'duration', 'error', 'message'];
  const extra = Object.fromEntries(Object.entries(step).filter(([k]) => !known.includes(k)));

  return (
    <div style={{ padding: '8px 0', borderBottom: '1px dashed #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ color: '#cbd5e1', fontSize: 11, fontWeight: 700, width: 20 }}>{index + 1}</span>
        {status && <StatusPill status={status} small />}
        <span style={{ fontSize: 12.5, color: '#1e293b', fontWeight: 600 }}>{name}</span>
        {ms !== null && <span style={{ fontSize: 11, color: '#94a3b8' }}>{fmtMs(ms)}</span>}
      </div>
      {error && (
        <div style={{ marginLeft: 30, marginTop: 4, fontSize: 11.5, color: '#b91c1c', fontFamily: 'ui-monospace, monospace', wordBreak: 'break-word' }}>
          {error}
        </div>
      )}
      {Object.keys(extra).length > 0 && (
        <div style={{ marginLeft: 30, marginTop: 4, fontSize: 11, color: '#64748b', fontFamily: 'ui-monospace, monospace', wordBreak: 'break-word' }}>
          {JSON.stringify(extra)}
        </div>
      )}
    </div>
  );
}

function RunModal({ runId, onClose }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get(API, { params: { action: 'run', run_id: runId } })
      .then(r => { if (alive) setRecords(r.data?.data?.records || []); })
      .catch(e => { if (alive) toast.error(e.response?.data?.message || 'Could not load that run'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [runId]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, width: '100%', maxWidth: 860, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Run detail</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', fontFamily: 'ui-monospace, monospace', marginTop: 2 }}>{runId}</div>
          </div>
          <button onClick={onClose} style={{ ...btn(false), padding: '6px 12px' }}>Close</button>
        </div>

        <div style={{ padding: 18, maxHeight: '70vh', overflowY: 'auto' }}>
          {loading ? <Spinner /> : records.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 30 }}>Nothing recorded for this run.</div>
          ) : records.map(r => (
            <div key={r.id} style={{ border: '1px solid #eef2ff', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: '#fafaff', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <StatusPill status={r.status} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{r.check_name || r.check_id}</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{fmtIST(r.started_at, true)}</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{fmtMs(r.duration_ms)}</span>
                {r.attempts > 1 && <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>{r.attempts} attempts</span>}
                {r.alerted && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: 99 }}>Alert sent</span>}
                {r.host && <span style={{ fontSize: 11, color: '#cbd5e1', marginLeft: 'auto', fontFamily: 'ui-monospace, monospace' }}>{r.host}</span>}
              </div>

              {(r.failed_step || r.error) && (
                <div style={{ padding: '10px 14px', background: '#fff5f5', borderTop: '1px solid #fee2e2', fontSize: 12, color: '#b91c1c' }}>
                  {r.failed_step && <div style={{ fontWeight: 700, marginBottom: 3 }}>Failed at: {r.failed_step}</div>}
                  {r.error && <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, wordBreak: 'break-word' }}>{r.error}</div>}
                </div>
              )}

              {Array.isArray(r.steps) && r.steps.length > 0 && (
                <div style={{ padding: '6px 14px 12px' }}>
                  <div style={{ ...lblS, marginTop: 8 }}>Step trace</div>
                  {r.steps.map((s, i) => <StepRow key={i} step={s} index={i} />)}
                </div>
              )}

              {r.context && Object.keys(r.context).length > 0 && (
                <div style={{ padding: '0 14px 12px' }}>
                  <div style={lblS}>Context</div>
                  <pre style={{ margin: 0, fontSize: 11, color: '#475569', background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 8, padding: 10, overflowX: 'auto' }}>
                    {JSON.stringify(r.context, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════ OVERVIEW ════════ */
function UptimeCell({ label, u }) {
  return (
    <div style={{ flex: 1, minWidth: 74 }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: pctColor(u?.pct), lineHeight: 1.3 }}>{fmtPct(u?.pct)}</div>
      <div style={{ fontSize: 10, color: '#cbd5e1' }}>{u ? `${u.runs} runs · avg ${fmtMs(u.avg_ms)}` : 'no runs'}</div>
    </div>
  );
}

function CheckCard({ c, onOpenRun }) {
  const s = st(c.status);
  return (
    <div style={{ ...card, padding: 16, borderLeft: `4px solid ${s.dot}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{c.check_name}</div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 3, lineHeight: 1.5, maxWidth: 380 }}>{c.blurb}</div>
        </div>
        <StatusPill status={c.status} />
      </div>

      {c.status === 'fail' && (
        <div style={{ marginTop: 12, background: '#fff5f5', border: '1px solid #fee2e2', borderRadius: 9, padding: '9px 12px', fontSize: 11.5, color: '#b91c1c' }}>
          <div style={{ fontWeight: 700 }}>
            Down since {fmtIST(c.down_since)} · {c.failed_runs} failed run{c.failed_runs === 1 ? '' : 's'}
          </div>
          {c.failed_step && <div style={{ marginTop: 3 }}>Failed at: {c.failed_step}</div>}
          {c.error && <div style={{ marginTop: 3, fontFamily: 'ui-monospace, monospace', fontSize: 11, wordBreak: 'break-word' }}>{c.error}</div>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <UptimeCell label="24 h" u={c.uptime_24h} />
        <UptimeCell label="7 d"  u={c.uptime_7d} />
        <UptimeCell label="30 d" u={c.uptime_30d} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 10, borderTop: '1px solid #f5f3ff', fontSize: 11, color: '#94a3b8', flexWrap: 'wrap' }}>
        <span>Last run {fmtIST(c.last_run)}</span>
        {c.duration_ms !== null && c.duration_ms !== undefined && <span>· {fmtMs(c.duration_ms)}</span>}
        {c.attempts > 1 && <span style={{ color: '#d97706', fontWeight: 600 }}>· {c.attempts} attempts</span>}
        {c.run_id && (
          <button onClick={() => onOpenRun(c.run_id)}
            style={{ marginLeft: 'auto', border: 'none', background: 'none', color: '#4f46e5', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
            View run →
          </button>
        )}
      </div>
    </div>
  );
}

/* ── the uptime strip ───────────────────────────────────────
   One step per calendar day, oldest on the left and today on the right, so a
   window that has only just started to fill reads as "we began today" rather
   than as a broken chart. Days the monitor never reported are drawn as empty
   steps, not skipped — an absent day and a passing day must never look alike.

   Colour is a STATUS encoding (good / warning / critical), never a series
   palette. The three steps clear CVD and normal-vision separation as a set;
   a fourth amber class was dropped because it sat too close to `warning` to
   be told apart. Amber is below 3:1 on white, so it never carries meaning on
   its own: the legend names every class in text, the tooltip gives the
   numbers, and the Run-history tab is the table view of the same data. */
const DAY_STATE = {
  good:     { fill: '#0ca30c', label: 'All checks passed' },
  warning:  { fill: '#fab219', label: 'Some failures' },
  critical: { fill: '#d03b3b', label: 'Mostly failing' },
  none:     { fill: '#eef1f6', label: 'No runs recorded' },
};

/* "Today" has to be today in IST — the API buckets by IST calendar day, and the
   browser may be anywhere. en-CA gives YYYY-MM-DD, which is what the API returns. */
const istToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const shiftDay = (ymd, delta) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
};

/* Expand the API's sparse rows into every day of the window. */
function buildWindow(rows, days) {
  const byDay = Object.fromEntries(rows.map(r => [r.day, r]));
  const end = istToday();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = shiftDay(end, -i);
    const r = byDay[day];
    const runs = r ? r.runs : 0;
    let state = 'none';
    if (runs > 0) state = r.failed === 0 ? 'good' : (r.pct >= 90 ? 'warning' : 'critical');
    out.push({ day, state, runs, passed: r?.passed ?? 0, failed: r?.failed ?? 0, pct: r?.pct ?? null });
  }
  return out;
}

function TrendChart({ rows, days, onDays }) {
  const [hover, setHover] = useState(null);   // index of the hovered day
  const dayWindow = useMemo(() => buildWindow(rows, days), [rows, days]);

  /* Window totals — the headline the strip is a breakdown of. */
  const totals = useMemo(() => dayWindow.reduce((a, d) => ({
    runs: a.runs + d.runs, passed: a.passed + d.passed, failed: a.failed + d.failed,
    reported: a.reported + (d.runs > 0 ? 1 : 0),
  }), { runs: 0, passed: 0, failed: 0, reported: 0 }), [dayWindow]);

  const uptime = totals.runs > 0 ? (totals.passed / totals.runs) * 100 : null;
  const hovered = hover === null ? null : dayWindow[hover];

  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>Daily uptime</div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>One step per day · hover a day for its numbers</div>
        </div>
        <select value={days} onChange={e => { setHover(null); onDays(Number(e.target.value)); }} style={{ ...inp, padding: '6px 9px' }}>
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* headline */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: uptime === null ? '#94a3b8' : pctColor(uptime), letterSpacing: '-.5px' }}>
          {uptime === null ? '—' : fmtPct(uptime)}
        </span>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          uptime across {totals.runs.toLocaleString('en-IN')} run{totals.runs === 1 ? '' : 's'}
          {totals.failed > 0 && <strong style={{ color: '#b91c1c' }}> · {totals.failed.toLocaleString('en-IN')} failed</strong>}
        </span>
        {totals.reported < days && (
          <span style={{ fontSize: 11.5, color: '#94a3b8' }}>
            · reported on {totals.reported} of {days} days
          </span>
        )}
      </div>

      {/* the strip */}
      <div style={{ position: 'relative' }}>
        {hovered && (
          <div style={{
            position: 'absolute', bottom: '100%', marginBottom: 8, zIndex: 5,
            left: `${((hover + 0.5) / dayWindow.length) * 100}%`,
            transform: `translateX(${hover < dayWindow.length / 2 ? '-20%' : '-80%'})`,
            background: '#1e293b', color: '#fff', borderRadius: 8, padding: '8px 11px',
            fontSize: 11.5, lineHeight: 1.6, whiteSpace: 'nowrap', pointerEvents: 'none',
            boxShadow: '0 4px 14px rgba(15,23,42,.22)',
          }}>
            <div style={{ fontWeight: 700 }}>{fmtIST(hovered.day)}</div>
            {hovered.runs === 0 ? (
              <div style={{ color: '#cbd5e1' }}>No runs recorded</div>
            ) : (
              <>
                <div>Uptime <strong>{fmtPct(hovered.pct)}</strong></div>
                <div style={{ color: '#cbd5e1' }}>
                  {hovered.runs} run{hovered.runs === 1 ? '' : 's'} · {hovered.passed} passed · {hovered.failed} failed
                </div>
              </>
            )}
          </div>
        )}

        <div onMouseLeave={() => setHover(null)}
          style={{ display: 'flex', gap: 2, height: 46, alignItems: 'stretch' }}>
          {dayWindow.map((d, i) => (
            <div key={d.day}
              onMouseEnter={() => setHover(i)}
              title={d.runs === 0 ? `${d.day} — no runs recorded` : `${d.day} — ${fmtPct(d.pct)} uptime, ${d.passed} passed, ${d.failed} failed`}
              style={{
                flex: 1, minWidth: 3, borderRadius: 4, background: DAY_STATE[d.state].fill,
                opacity: hover === null || hover === i ? 1 : .45, transition: 'opacity .12s',
              }} />
          ))}
        </div>

        {/* the two ends only — never a label per day, and nothing that can clip */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, color: '#94a3b8' }}>
          <span>{fmtDay(dayWindow[0]?.day)}</span>
          <span>Today</span>
        </div>
      </div>

      {/* legend — every class named, so colour never carries meaning alone */}
      <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 12, borderTop: '1px solid #f5f3ff', flexWrap: 'wrap' }}>
        {Object.entries(DAY_STATE).map(([key, s]) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
            <span style={{
              width: 11, height: 11, borderRadius: 3, background: s.fill,
              border: key === 'none' ? '1px solid #e2e8f0' : 'none',
            }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* The overview payload is owned by the page (it also feeds the run-history
   check dropdown), so this only renders what it is handed. */
function Overview({ data, loading, error, onOpenRun }) {
  const [trend, setTrend] = useState([]);
  const [days, setDays] = useState(30);

  /* Skipped while the overview is failing — the chart is not rendered in that
     state anyway, and a down API should not be asked the same question twice. */
  useEffect(() => {
    if (error) return;
    let alive = true;
    api.get(API, { params: { action: 'trend', days } })
      .then(r => { if (alive) setTrend(r.data?.data?.trend || []); })
      .catch(() => { /* the banner already reports an unreachable API */ });
    return () => { alive = false; };
  }, [days, error]);

  if (loading) return <Spinner label="Reading monitoring history…" />;
  if (error) {
    return (
      <div style={{ ...card, padding: 18, borderLeft: '4px solid #ef4444', color: '#b91c1c', fontSize: 13, lineHeight: 1.7 }}>
        <strong>Monitoring history unavailable.</strong>
        <div style={{ marginTop: 6, color: '#7f1d1d' }}>{error}</div>
      </div>
    );
  }
  if (!data) return null;

  const s = data.summary || {};
  const banner = s.stale
    ? { bg: '#fffbeb', bd: '#fde68a', fg: '#92400e', icon: '⚠️', title: 'The monitor has stopped reporting' }
    : s.healthy
      ? { bg: '#f0fdf4', bd: '#bbf7d0', fg: '#166534', icon: '✅', title: 'All checks are passing' }
      : { bg: '#fff5f5', bd: '#fecaca', fg: '#b91c1c', icon: '🔴', title: `${s.failing} of ${s.total} checks failing` };

  const light   = (data.checks || []).filter(c => c.check_group === 'light');
  const journey = (data.checks || []).filter(c => c.check_group !== 'light');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: banner.bg, border: `1px solid ${banner.bd}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22 }}>{banner.icon}</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: banner.fg }}>{banner.title}</div>
          <div style={{ fontSize: 11.5, color: banner.fg, opacity: .85, marginTop: 2 }}>
            Last report {fmtIST(s.last_seen, true)}
            {s.minutes_ago !== null && s.minutes_ago !== undefined && ` · ${fmtMinutes(s.minutes_ago)} ago`}
            {s.stale && ' — the light checks should run every 5 minutes.'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: banner.fg, opacity: .7, textAlign: 'right' }}>
          {(s.total_rows || 0).toLocaleString('en-IN')} runs recorded<br />since {fmtIST(s.oldest)}
        </div>
      </div>

      {light.length > 0 && (
        <div>
          <div style={{ ...lblS, marginBottom: 8 }}>Light checks — every 5 minutes</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 14 }}>
            {light.map(c => <CheckCard key={c.check_id} c={c} onOpenRun={onOpenRun} />)}
          </div>
        </div>
      )}

      {journey.length > 0 && (
        <div>
          <div style={{ ...lblS, marginBottom: 8 }}>Student journey — every 15 minutes</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 14 }}>
            {journey.map(c => <CheckCard key={c.check_id} c={c} onOpenRun={onOpenRun} />)}
          </div>
        </div>
      )}

      <TrendChart rows={trend} days={days} onDays={setDays} />
    </div>
  );
}

/* ════════ RUN HISTORY ════════ */
function Runs({ checks, onOpenRun }) {
  /* draft filters (the inputs) */
  const [check, setCheck] = useState('all');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');

  /* committed filters (what was actually searched) */
  const [committed, setCommitted] = useState({ check: 'all', status: 'all', from: '', to: '', q: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ records: [], total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const buildParams = useCallback((c) => {
    const p = { check: c.check, status: c.status };
    if (c.from) p.date_from = c.from;
    if (c.to) p.date_to = c.to;
    if (c.q.trim()) p.q = c.q.trim();
    return p;
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get(API, { params: { action: 'runs', ...buildParams(committed), page, per_page: PER_PAGE } })
      .then(r => { if (alive) setData(r.data?.data || { records: [], total: 0, total_pages: 1 }); })
      .catch(e => { if (alive) toast.error(e.response?.data?.message || 'Could not load run history'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [committed, page, buildParams]);

  const search = () => {
    if (from && to && from > to) { toast.error('“From” date is after “To” date'); return; }
    setPage(1);
    setCommitted({ check, status, from, to, q });
  };
  const reset = () => {
    setCheck('all'); setStatus('all'); setFrom(''); setTo(''); setQ('');
    setPage(1);
    setCommitted({ check: 'all', status: 'all', from: '', to: '', q: '' });
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
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <label style={lblS}>Check</label>
          <select value={check} onChange={e => setCheck(e.target.value)} style={{ ...inp, width: 200 }}>
            <option value="all">All checks</option>
            {checks.map(c => <option key={c.check_id} value={c.check_id}>{c.check_name}</option>)}
          </select>
        </div>
        <div>
          <label style={lblS}>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inp, width: 130 }}>
            <option value="all">All</option>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
            <option value="skip">Skipped</option>
          </select>
        </div>
        <div>
          <label style={lblS}>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...inp, width: 145 }} />
        </div>
        <div>
          <label style={lblS}>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...inp, width: 145 }} />
        </div>
        <div>
          <label style={lblS}>Run ID / step / error</label>
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="e.g. timeout" style={{ ...inp, width: 220 }} />
        </div>
        <button onClick={search} style={btn(true)}>Search</button>
        <button onClick={reset} style={btn(false)}>Reset</button>
        <button onClick={exportCSV} disabled={exporting} style={{ ...btn(false), marginLeft: 'auto', opacity: exporting ? .6 : 1 }}>
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={thS}>Time (IST)</th>
                <th style={thS}>Check</th>
                <th style={thS}>Status</th>
                <th style={thS}>Duration</th>
                <th style={thS}>Attempts</th>
                <th style={thS}>Failed step</th>
                <th style={thS}>Error</th>
                <th style={thS}>Alert</th>
                <th style={thS} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ ...tdS, textAlign: 'center', color: '#94a3b8', padding: 30 }}>Loading…</td></tr>
              ) : data.records.length === 0 ? (
                <tr><td colSpan={9} style={{ ...tdS, textAlign: 'center', color: '#94a3b8', padding: 30 }}>No runs match these filters.</td></tr>
              ) : data.records.map(r => (
                <tr key={r.id} style={{ background: r.status === 'fail' ? '#fffafa' : '#fff' }}>
                  <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{fmtIST(r.started_at, true)}</td>
                  <td style={tdS}>{r.check_name || r.check_id}</td>
                  <td style={tdS}><StatusPill status={r.status} small /></td>
                  <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{fmtMs(r.duration_ms)}</td>
                  <td style={{ ...tdS, color: r.attempts > 1 ? '#d97706' : '#94a3b8', fontWeight: r.attempts > 1 ? 700 : 400 }}>{r.attempts}</td>
                  <td style={{ ...tdS, color: '#b91c1c' }}>{r.failed_step || '—'}</td>
                  <td style={{ ...tdS, maxWidth: 320, color: '#b91c1c', fontSize: 11.5 }}>
                    <span title={r.error || ''} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.error || '—'}
                    </span>
                  </td>
                  <td style={tdS}>{r.alerted ? '🔔' : '—'}</td>
                  <td style={tdS}>
                    <button onClick={() => onOpenRun(r.run_id)}
                      style={{ border: 'none', background: 'none', color: '#4f46e5', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid #f5f3ff', fontSize: 12, color: '#64748b', flexWrap: 'wrap', gap: 8 }}>
          <span>{(data.total || 0).toLocaleString('en-IN')} run{data.total === 1 ? '' : 's'} · page {page} of {totalPages}</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              style={{ ...btn(false), padding: '6px 12px', opacity: page <= 1 ? .5 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>Previous</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              style={{ ...btn(false), padding: '6px 12px', opacity: page >= totalPages ? .5 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}>Next</button>
          </span>
        </div>
      </div>
    </>
  );
}

/* ════════ INCIDENTS ════════ */
function Incidents() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get(API, { params: { action: 'incidents', days } })
      .then(r => { if (alive) setRows(r.data?.data?.incidents || []); })
      .catch(e => { if (alive) toast.error(e.response?.data?.message || 'Could not load incidents'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [days]);

  const ongoing = useMemo(() => rows.filter(r => r.ongoing).length, [rows]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <label style={lblS}>Window</label>
          <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ ...inp, width: 170 }}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 180 days</option>
          </select>
        </div>
        <div style={{ fontSize: 12, color: '#64748b', alignSelf: 'flex-end', paddingBottom: 9 }}>
          {rows.length} incident{rows.length === 1 ? '' : 's'}
          {ongoing > 0 && <strong style={{ color: '#b91c1c' }}> · {ongoing} still open</strong>}
        </div>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr>
                <th style={thS}>Check</th>
                <th style={thS}>Started (IST)</th>
                <th style={thS}>Recovered</th>
                <th style={thS}>Duration</th>
                <th style={thS}>Failed runs</th>
                <th style={thS}>Failed step</th>
                <th style={thS}>Error</th>
                <th style={thS}>Alert</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ ...tdS, textAlign: 'center', color: '#94a3b8', padding: 30 }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} style={{ ...tdS, textAlign: 'center', color: '#16a34a', padding: 30 }}>No outages in this window. 🎉</td></tr>
              ) : rows.map((r, i) => (
                <tr key={`${r.check_id}-${r.started_at}-${i}`} style={{ background: r.ongoing ? '#fff5f5' : '#fff' }}>
                  <td style={{ ...tdS, fontWeight: 600 }}>{r.check_name || r.check_id}</td>
                  <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{fmtIST(r.started_at, true)}</td>
                  <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                    {r.ongoing
                      ? <span style={{ color: '#b91c1c', fontWeight: 700 }}>Ongoing</span>
                      : fmtIST(r.recovered_at, true)}
                  </td>
                  <td style={{ ...tdS, whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtMinutes(r.minutes)}</td>
                  <td style={tdS}>{r.failed_runs}</td>
                  <td style={{ ...tdS, color: '#b91c1c' }}>{r.failed_step || '—'}</td>
                  <td style={{ ...tdS, maxWidth: 300, color: '#b91c1c', fontSize: 11.5 }}>
                    <span title={r.error || ''} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.error || '—'}
                    </span>
                  </td>
                  <td style={tdS}>{r.alerted ? '🔔' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ════════ PAGE ════════ */
const TABS = [
  { key: 'overview',  label: 'Overview' },
  { key: 'runs',      label: 'Run history' },
  { key: 'incidents', label: 'Incidents' },
];

export default function Monitoring() {
  const [tab, setTab] = useState('overview');
  const [runId, setRunId] = useState(null);

  /* One overview fetch for the whole page: the Overview tab renders it, and
     the run-history filter takes its check dropdown from the same payload
     (?action=overview is the only endpoint that defines the check list). */
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get(API, { params: { action: 'overview' } })
      .then(r => { setData(r.data?.data || null); setError(''); })
      .catch(e => setError(e.response?.data?.message || 'Could not reach the monitoring API'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, OVERVIEW_POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const checks = data?.checks || [];

  return (
    <div style={{ padding: '4px 2px 24px' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', margin: 0 }}>Monitoring</h1>
        <p style={{ fontSize: 12.5, color: '#94a3b8', margin: '4px 0 0' }}>
          Synthetic checks run against the live student journey — availability and API health every 5 minutes,
          registration through payment every 15.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid #eef2ff' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            border: 'none', background: 'none', padding: '9px 14px', fontSize: 13, fontFamily: 'inherit',
            fontWeight: tab === t.key ? 700 : 500, color: tab === t.key ? '#4f46e5' : '#64748b',
            borderBottom: `2px solid ${tab === t.key ? '#4f46e5' : 'transparent'}`, marginBottom: -1, cursor: 'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview'  && <Overview data={data} loading={loading} error={error} onOpenRun={setRunId} />}
      {tab === 'runs'      && <Runs checks={checks} onOpenRun={setRunId} />}
      {tab === 'incidents' && <Incidents />}

      {runId && <RunModal runId={runId} onClose={() => setRunId(null)} />}
    </div>
  );
}
