import { useEffect, useRef, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export const API = '/api/campaigns/messaging_analytics.php';

/* ── Vocabulary ────────────────────────────────────────────────────────────
   Email is the indigo family and WhatsApp the green family everywhere on the page, with the
   campaign the deep shade and the journey the light one — so a colour alone says both the channel
   and the engine, in the pies, the trend chart and the table alike. */
export const STREAMS = [
  { key: 'email_campaign', label: 'Email campaigns',    short: 'Email · Campaign',    channel: 'email',    kind: 'campaign', color: '#4f46e5' },
  { key: 'email_journey',  label: 'Email journeys',     short: 'Email · Journey',     channel: 'email',    kind: 'journey',  color: '#a5b4fc' },
  { key: 'wa_campaign',    label: 'WhatsApp campaigns', short: 'WhatsApp · Campaign', channel: 'whatsapp', kind: 'campaign', color: '#059669' },
  { key: 'wa_journey',     label: 'WhatsApp journeys',  short: 'WhatsApp · Journey',  channel: 'whatsapp', kind: 'journey',  color: '#6ee7b7' },
];
export const STREAM = Object.fromEntries(STREAMS.map(s => [s.key, s]));

export const METRICS = [
  { key: 'attempted',   label: 'Attempted',   color: '#64748b' },
  { key: 'sent',        label: 'Sent',        color: '#6366f1' },
  { key: 'delivered',   label: 'Delivered',   color: '#0ea5e9' },
  { key: 'opened',      label: 'Opened / Read', color: '#8b5cf6' },
  { key: 'clicked',     label: 'Clicked',     color: '#f59e0b' },
  { key: 'failed',      label: 'Failed',      color: '#ef4444' },
  { key: 'bounced',     label: 'Bounced',     color: '#f97316' },
  { key: 'skipped',     label: 'Skipped',     color: '#94a3b8' },
  { key: 'conversions', label: 'Conversions', color: '#10b981' },
];
export const METRIC = Object.fromEntries(METRICS.map(m => [m.key, m]));

const PROVIDER_COLORS = {
  sendgrid: '#1a82e2', elasticemail: '#7c3aed', ses: '#ff9900', mailwizz: '#0891b2',
  meta: '#0866ff', netcore: '#e11d48', whatsapp: '#be123c', '': '#cbd5e1',
};
export const providerColor = p => PROVIDER_COLORS[(p || '').toLowerCase()] || '#64748b';

export const ZERO = { attempted: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0, bounced: 0, skipped: 0, conversions: 0, revenue: 0 };
export const sumMetrics = list => list.reduce((acc, m) => {
  for (const k of Object.keys(ZERO)) acc[k] += Number(m?.[k] || 0);
  return acc;
}, { ...ZERO });

/* ── Formatting ────────────────────────────────────────────────────────── */
export const nf = n => Number(n || 0).toLocaleString('en-IN');
export const compact = n => {
  const v = Number(n || 0);
  if (v >= 1e7) return `${(v / 1e7).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(1).replace(/\.0$/, '')}L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(v);
};
export const rate = (a, b) => (b > 0 ? (a / b) * 100 : 0);
export const pctText = (a, b) => (b > 0 ? `${rate(a, b).toFixed(rate(a, b) < 10 ? 1 : 0)}%` : '—');
export const inr = v => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtBucket = (b, gran) => {
  if (!b) return '';
  if (gran === 'hour') { const h = Number(b.slice(11, 13)); return `${(h % 12) || 12}${h < 12 ? 'am' : 'pm'}`; }
  return `${Number(b.slice(8, 10))} ${MON[Number(b.slice(5, 7)) - 1]}`;
};
export const fmtBucketLong = (b, gran) => {
  if (!b) return '';
  const d = `${Number(b.slice(8, 10))} ${MON[Number(b.slice(5, 7)) - 1]} ${b.slice(0, 4)}`;
  if (gran !== 'hour') return d;
  const h = Number(b.slice(11, 13)); const h2 = (h + 1) % 24;
  const f = x => `${(x % 12) || 12}${x < 12 ? ' am' : ' pm'}`;
  return `${d}, ${f(h)} – ${f(h2)}`;
};
export const fmtDateTime = s => {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return s;
  const h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MON[d.getMonth()]}, ${(h % 12) || 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
};
export const fmtDay = ymd => (ymd ? `${Number(ymd.slice(8, 10))} ${MON[Number(ymd.slice(5, 7)) - 1]} ${ymd.slice(0, 4)}` : '');

/* ── Date presets (browser-local, which is IST for this team) ─────────── */
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const PRESETS = [
  { key: 'today',     label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d',        label: 'Last 7 days' },
  { key: '15d',       label: 'Last 15 days' },
  { key: '30d',       label: 'Last 30 days' },
  { key: 'custom',    label: 'Custom' },
];
export function resolveRange(key, from, to) {
  const now = new Date();
  const back = n => { const d = new Date(now); d.setDate(d.getDate() - n); return ymd(d); };
  switch (key) {
    case 'yesterday': return { from: back(1), to: back(1) };
    case '7d':  return { from: back(6),  to: ymd(now) };
    case '15d': return { from: back(14), to: ymd(now) };
    case '30d': return { from: back(29), to: ymd(now) };
    case 'custom': if (from && to) return from <= to ? { from, to } : { from: to, to: from };
    // falls through — a custom range without both dates is Today
    default: return { from: ymd(now), to: ymd(now) };
  }
}
export const todayYmd = () => ymd(new Date());

/* ── Hooks ─────────────────────────────────────────────────────────────── */

/** Animates a number from its previous value to the new one — ease-out, ~650ms. */
export function useCountUp(value, ms = 650) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const start = prev.current; const end = Number(value || 0);
    prev.current = end;
    if (start === end || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(end); return; }
    let raf; const t0 = performance.now();
    const tick = t => {
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (end - start) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

export const CountUp = ({ value, format = nf }) => <>{format(useCountUp(value))}</>;

/** Material-style ink ripple: call on pointerdown of any element with class ma-rip. */
export function ripple(e) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2;
  const s = document.createElement('span');
  s.className = 'ma-ripple';
  s.style.width = s.style.height = `${size}px`;
  s.style.left = `${e.clientX - r.left - size / 2}px`;
  s.style.top = `${e.clientY - r.top - size / 2}px`;
  el.appendChild(s);
  setTimeout(() => s.remove(), 650);
}

/* ── Primitives ────────────────────────────────────────────────────────── */

export const Skel = ({ w = '100%', h = 14, r = 6, style }) => (
  <span className="ma-skel" style={{ width: w, height: h, borderRadius: r, ...style }} />
);

export const DotLoader = ({ color }) => (
  <span className="ma-dots" role="status" aria-label="Loading" style={color ? { '--c': color } : undefined}><i /><i /><i /></span>
);

export function Empty({ title = 'Nothing sent in this range', sub = 'Try a wider date range or clear a filter.' }) {
  return (
    <div className="ma-empty">
      <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#c7d2fe" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-8-8 18-2-8-8-2z" /></svg>
      <b>{title}</b><span>{sub}</span>
    </div>
  );
}

/**
 * Donut with a live centre label: hovering a slice (or its legend row) swaps the centre to that
 * slice's value and share, so the chart can be read without a tooltip chasing the pointer.
 */
export function Donut({ data, centerLabel = 'Total', height = 210, format = nf, emptyText = 'No data' }) {
  const [hover, setHover] = useState(null);
  const rows = data.filter(d => d.value > 0);
  const total = rows.reduce((a, d) => a + d.value, 0);
  const active = hover != null ? rows[hover] : null;
  if (!total) return <div className="ma-donut-empty">{emptyText}</div>;
  return (
    <div className="ma-donut">
      <div className="ma-donut-chart" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="label" innerRadius="64%" outerRadius="92%" paddingAngle={rows.length > 1 ? 2 : 0}
                 stroke="none" isAnimationActive animationDuration={700}
                 onMouseLeave={() => setHover(null)} onMouseEnter={(_, i) => setHover(i)}>
              {rows.map((d, i) => (
                <Cell key={d.label} fill={d.color} style={{ cursor: 'pointer', transition: 'opacity .18s', outline: 'none' }}
                      opacity={hover == null || hover === i ? 1 : 0.35} />
              ))}
            </Pie>
            <Tooltip content={() => null} />
          </PieChart>
        </ResponsiveContainer>
        <div className="ma-donut-center">
          <b>{format(active ? active.value : total)}</b>
          <span>{active ? `${pctText(active.value, total)} · ${active.label}` : centerLabel}</span>
        </div>
      </div>
      <ul className="ma-legend">
        {rows.map((d, i) => (
          <li key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} data-dim={hover != null && hover !== i ? '1' : undefined}>
            <i style={{ background: d.color }} />
            <span className="l" title={d.label}>{d.label}</span>
            <span className="v">{format(d.value)}</span>
            <span className="p">{pctText(d.value, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const StatusPill = ({ status }) => {
  const map = {
    clicked: ['#fffbeb', '#b45309'], opened: ['#f5f3ff', '#6d28d9'], delivered: ['#f0f9ff', '#0369a1'],
    sent: ['#eef2ff', '#4338ca'], failed: ['#fef2f2', '#b91c1c'], bounced: ['#fff7ed', '#c2410c'],
    skipped: ['#f1f5f9', '#475569'], read: ['#f5f3ff', '#6d28d9'],
  };
  const [bg, fg] = map[status] || ['#f1f5f9', '#475569'];
  return <span className="ma-pill" style={{ background: bg, color: fg }}><i style={{ background: fg }} />{status}</span>;
};

export const ChannelIcon = ({ channel, size = 14 }) => (channel === 'whatsapp'
  ? <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.48-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.8h-.02a9.8 9.8 0 0 1-4.99-1.37l-.36-.21-3.71.97.99-3.62-.23-.37a9.79 9.79 0 0 1-1.5-5.22c0-5.41 4.4-9.81 9.82-9.81a9.75 9.75 0 0 1 6.94 2.88 9.74 9.74 0 0 1 2.87 6.94c0 5.41-4.4 9.81-9.81 9.81M20.52 3.45A11.66 11.66 0 0 0 12.05 0C5.6 0 .35 5.25.35 11.7c0 2.06.54 4.08 1.56 5.85L.25 24l6.59-1.73a11.66 11.66 0 0 0 5.2 1.24h.01c6.45 0 11.7-5.25 11.7-11.7 0-3.13-1.22-6.07-3.43-8.28" /></svg>
  : <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2.8" y="5" width="18.4" height="14" rx="2.2" /><path d="m3.4 7 8.6 6 8.6-6" /></svg>);

export const KindIcon = ({ kind, size = 13 }) => (kind === 'journey'
  ? <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="5.5" r="2.4" /><circle cx="6" cy="18.5" r="2.4" /><circle cx="18" cy="12" r="2.4" /><path d="M6 7.9v8.2M8.4 5.9h4.2a3 3 0 0 1 3 3v.9" /></svg>
  : <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-8-8 18-2-8-8-2z" /></svg>);

export function Pagination({ page, pages, total, perPage, onPage, onPerPage, sizes = [10, 25, 50, 100] }) {
  if (!total) return null;
  const start = (page - 1) * perPage + 1;
  const end = Math.min(total, page * perPage);
  const nums = [];
  const push = n => { if (!nums.includes(n) && n >= 1 && n <= pages) nums.push(n); };
  push(1); for (let n = page - 1; n <= page + 1; n++) push(n); push(pages);
  nums.sort((a, b) => a - b);
  return (
    <div className="ma-pager">
      <span className="ma-pager-info">{nf(start)}–{nf(end)} of {nf(total)}</span>
      {onPerPage && (
        <label className="ma-pager-size">Rows
          <select value={perPage} onChange={e => onPerPage(Number(e.target.value))}>
            {sizes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      )}
      <div className="ma-pager-btns">
        <button className="ma-rip" onPointerDown={ripple} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">‹</button>
        {nums.map((n, i) => (
          <span key={n} style={{ display: 'contents' }}>
            {i > 0 && n - nums[i - 1] > 1 && <span className="ma-pager-gap">…</span>}
            <button className="ma-rip" onPointerDown={ripple} data-on={n === page ? '1' : undefined} onClick={() => onPage(n)}>{n}</button>
          </span>
        ))}
        <button className="ma-rip" onPointerDown={ripple} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">›</button>
      </div>
    </div>
  );
}

/* ── Styles ────────────────────────────────────────────────────────────── */
export const CSS = `
.ma, .ma-portal { --ink:#0f172a; --ink2:#334155; --mute:#64748b; --faint:#94a3b8; --line:#e2e8f0; --soft:#f8fafc; --brand:#1e3a8a; --accent:#4f46e5;
  --ease:cubic-bezier(.2,.8,.2,1); color:var(--ink); }
.ma { padding:22px 26px 40px; font-family:inherit; color:var(--ink); max-width:1600px; margin:0 auto; }
@media (max-width:720px){ .ma { padding:16px 14px 32px; } }

/* progress bar on refetch */
.ma-progress { position:sticky; top:0; z-index:30; height:3px; margin:-22px -26px 19px; overflow:hidden; background:transparent; }
.ma-progress[data-on] { background:#e0e7ff; }
.ma-progress[data-on]::after { content:''; position:absolute; inset:0 auto 0 0; width:38%; background:linear-gradient(90deg,#6366f1,#22c55e);
  animation:ma-indet 1.05s var(--ease) infinite; border-radius:3px; }
@keyframes ma-indet { from { transform:translateX(-100%); } to { transform:translateX(270%); } }
@media (max-width:720px){ .ma-progress { margin:-16px -14px 13px; } }

.ma-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:18px; }
.ma-head h1 { margin:0; font-size:22px; font-weight:800; letter-spacing:-.02em; }
.ma-head p { margin:4px 0 0; font-size:13px; color:var(--mute); }
.ma-head-r { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.ma-updated { font-size:11.5px; color:var(--faint); font-variant-numeric:tabular-nums; }

/* buttons + ripple */
.ma-rip { position:relative; overflow:hidden; -webkit-tap-highlight-color:transparent; }
.ma-ripple { position:absolute; border-radius:50%; background:currentColor; opacity:.18; transform:scale(0); pointer-events:none;
  animation:ma-rip .6s var(--ease) forwards; }
@keyframes ma-rip { to { transform:scale(1); opacity:0; } }
.ma-btn { display:inline-flex; align-items:center; gap:7px; height:36px; padding:0 14px; border-radius:9px; border:1px solid var(--line);
  background:#fff; color:var(--ink2); font:600 12.5px/1 inherit; font-family:inherit; cursor:pointer;
  transition:background .18s, border-color .18s, box-shadow .18s, transform .12s; }
.ma-btn:hover { background:var(--soft); border-color:#cbd5e1; box-shadow:0 2px 8px rgba(15,23,42,.06); }
.ma-btn:active { transform:scale(.97); }
.ma-btn:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.ma-btn.primary { background:var(--brand); color:#fff; border-color:var(--brand); }
.ma-btn.primary:hover { background:#1e40af; box-shadow:0 6px 16px rgba(30,58,138,.28); }
.ma-btn svg.spin { animation:ma-spin .8s linear infinite; }
@keyframes ma-spin { to { transform:rotate(360deg); } }

/* toolbar */
.ma-toolbar { position:sticky; top:0; z-index:20; display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:10px 12px;
  margin-bottom:18px; background:rgba(255,255,255,.86); backdrop-filter:saturate(1.4) blur(10px); border:1px solid var(--line);
  border-radius:14px; box-shadow:0 1px 2px rgba(15,23,42,.04); }
.ma-seg { display:inline-flex; padding:3px; background:#f1f5f9; border-radius:10px; gap:2px; max-width:100%; overflow-x:auto; scrollbar-width:none; }
.ma-seg::-webkit-scrollbar { display:none; }
.ma-seg button { position:relative; overflow:hidden; border:0; background:none; padding:7px 12px; border-radius:8px; white-space:nowrap;
  font:600 12.5px/1 inherit; font-family:inherit; color:var(--mute); cursor:pointer; transition:color .18s, background .18s, box-shadow .18s; }
.ma-seg button:hover { color:var(--ink); }
.ma-seg button[data-on] { background:#fff; color:var(--brand); box-shadow:0 1px 3px rgba(15,23,42,.12), 0 0 0 1px rgba(15,23,42,.04); }
.ma-seg button:focus-visible { outline:2px solid var(--accent); outline-offset:-2px; }
.ma-seg button .ic { display:inline-flex; vertical-align:-2px; margin-right:6px; }
.ma-divider { width:1px; height:24px; background:var(--line); }
@media (max-width:900px){ .ma-divider { display:none; } }
.ma-rangechip { font-size:12px; color:var(--mute); margin-left:auto; white-space:nowrap; font-variant-numeric:tabular-nums; }
.ma-rangechip b { color:var(--ink2); font-weight:650; }

/* custom range popover */
.ma-pop-wrap { position:relative; }
.ma-pop { position:absolute; top:calc(100% + 8px); left:0; z-index:40; width:300px; padding:16px; background:#fff; border-radius:14px;
  border:1px solid var(--line); box-shadow:0 20px 48px rgba(15,23,42,.18); transform-origin:top left; animation:ma-pop .18s var(--ease); }
@keyframes ma-pop { from { opacity:0; transform:translateY(-6px) scale(.97); } to { opacity:1; transform:none; } }
.ma-pop h4 { margin:0 0 12px; font-size:13px; }
.ma-pop label { display:block; font-size:11.5px; font-weight:650; color:var(--mute); margin-bottom:10px; }
.ma-pop input { display:block; width:100%; box-sizing:border-box; margin-top:5px; height:38px; padding:0 10px; border:1px solid var(--line);
  border-radius:9px; font:500 13px inherit; font-family:inherit; color:var(--ink); transition:border-color .15s, box-shadow .15s; }
.ma-pop input:focus { outline:0; border-color:#818cf8; box-shadow:0 0 0 3px rgba(99,102,241,.18); }
.ma-pop .row { display:flex; gap:8px; justify-content:flex-end; margin-top:6px; }

/* cards */
.ma-card { background:#fff; border:1px solid var(--line); border-radius:16px; box-shadow:0 1px 2px rgba(15,23,42,.04);
  transition:box-shadow .25s var(--ease), border-color .25s, transform .25s var(--ease); min-width:0; }
.ma-card:hover { box-shadow:0 10px 30px rgba(15,23,42,.08); border-color:#dbe3ee; }
.ma-card-h { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:16px 18px 0; flex-wrap:wrap; }
.ma-card-h h3 { margin:0; font-size:14px; font-weight:750; letter-spacing:-.01em; }
.ma-card-h small { display:block; font-size:11.5px; color:var(--faint); font-weight:500; margin-top:2px; }
.ma-card-b { padding:14px 18px 18px; }
.ma-fade { animation:ma-fade .45s var(--ease) both; }
@keyframes ma-fade { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }

/* KPI tiles */
.ma-kpis { display:grid; grid-template-columns:repeat(auto-fill, minmax(188px, 1fr)); gap:12px; margin-bottom:16px; }
.ma-kpi { position:relative; overflow:hidden; padding:15px 16px 14px; cursor:pointer; text-align:left; font-family:inherit; width:100%; }
.ma-kpi:hover { transform:translateY(-2px); }
.ma-kpi[data-on] { border-color:var(--c); box-shadow:0 0 0 3px color-mix(in srgb, var(--c) 18%, transparent), 0 10px 26px rgba(15,23,42,.08); }
.ma-kpi::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--c); opacity:.9; }
.ma-kpi .t { display:flex; align-items:center; gap:7px; font-size:11.5px; font-weight:700; color:var(--mute); text-transform:uppercase; letter-spacing:.05em; }
.ma-kpi .t i { width:8px; height:8px; border-radius:50%; background:var(--c); }
.ma-kpi .n { display:block; font-size:26px; font-weight:800; letter-spacing:-.03em; margin:7px 0 2px; font-variant-numeric:tabular-nums; color:var(--ink); }
.ma-kpi .r { font-size:12px; color:var(--mute); font-variant-numeric:tabular-nums; min-height:16px; }
.ma-kpi .r b { color:var(--ink2); font-weight:700; }
.ma-kpi .split { display:flex; height:5px; border-radius:5px; overflow:hidden; background:#f1f5f9; margin-top:11px; }
.ma-kpi .split span { transition:width .6s var(--ease); }
.ma-kpi .split-l { display:flex; justify-content:space-between; margin-top:6px; font-size:11px; color:var(--faint); font-variant-numeric:tabular-nums; }
.ma-kpi .split-l em { font-style:normal; display:inline-flex; align-items:center; gap:4px; }

/* grids */
.ma-grid { display:grid; gap:16px; margin-bottom:16px; }
.ma-g-trend { grid-template-columns:minmax(0, 2fr) minmax(0, 1fr); }
.ma-g-3 { grid-template-columns:repeat(3, minmax(0, 1fr)); }
.ma-g-2 { grid-template-columns:repeat(2, minmax(0, 1fr)); }
.ma-g-4 { grid-template-columns:repeat(4, minmax(0, 1fr)); }
@media (max-width:1280px){ .ma-g-4 { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
@media (max-width:1100px){ .ma-g-trend, .ma-g-3 { grid-template-columns:minmax(0, 1fr); } }
@media (max-width:760px){ .ma-g-2, .ma-g-4 { grid-template-columns:minmax(0, 1fr); } }

/* chips */
.ma-chips { display:flex; flex-wrap:wrap; gap:6px; }
.ma-chip { position:relative; overflow:hidden; display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 10px; border-radius:999px;
  border:1px solid var(--line); background:#fff; font:600 12px/1 inherit; font-family:inherit; color:var(--mute); cursor:pointer;
  transition:all .18s var(--ease); white-space:nowrap; }
.ma-chip:hover { border-color:#cbd5e1; color:var(--ink); }
.ma-chip i { width:8px; height:8px; border-radius:50%; background:var(--c, #94a3b8); }
.ma-chip[data-on] { background:color-mix(in srgb, var(--c, #4f46e5) 10%, #fff); border-color:color-mix(in srgb, var(--c, #4f46e5) 45%, #fff); color:var(--ink); }
.ma-chip .cnt { font-size:11px; color:var(--faint); font-variant-numeric:tabular-nums; }
.ma-chip[data-on] .cnt { color:var(--ink2); }

/* chart tooltip */
.ma-tip { background:#0f172a; color:#fff; border-radius:10px; padding:10px 12px; font-size:12px; box-shadow:0 12px 32px rgba(15,23,42,.3); min-width:180px; }
.ma-tip b { display:block; font-size:11.5px; color:#cbd5e1; font-weight:600; margin-bottom:7px; }
.ma-tip .r { display:flex; align-items:center; gap:8px; padding:2px 0; font-variant-numeric:tabular-nums; }
.ma-tip .r i { width:8px; height:8px; border-radius:2px; }
.ma-tip .r span { flex:1; color:#e2e8f0; }
.ma-tip .tot { border-top:1px solid rgba(255,255,255,.14); margin-top:6px; padding-top:6px; font-weight:700; }

/* donut */
.ma-donut { display:flex; flex-direction:column; gap:10px; }
.ma-donut-chart { position:relative; }
.ma-donut-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none; text-align:center; padding:0 22%; }
.ma-donut-center b { font-size:22px; font-weight:800; letter-spacing:-.03em; font-variant-numeric:tabular-nums; }
.ma-donut-center span { font-size:11px; color:var(--mute); margin-top:2px; line-height:1.3; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.ma-donut-empty { height:210px; display:grid; place-items:center; color:var(--faint); font-size:12.5px; }
.ma-legend { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:2px; }
.ma-legend li { display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:8px; font-size:12.5px; cursor:default; transition:background .15s, opacity .15s; }
.ma-legend li:hover { background:var(--soft); }
.ma-legend li[data-dim] { opacity:.45; }
.ma-legend i { width:10px; height:10px; border-radius:3px; flex:none; }
.ma-legend .l { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ink2); }
.ma-legend .v { font-weight:700; font-variant-numeric:tabular-nums; }
.ma-legend .p { width:48px; text-align:right; color:var(--faint); font-variant-numeric:tabular-nums; font-size:11.5px; }

/* funnel */
.ma-funnel { display:flex; flex-direction:column; gap:9px; }
.ma-funnel-row { display:grid; grid-template-columns:92px minmax(0,1fr) 64px 50px; align-items:center; gap:10px; font-size:12px; }
.ma-funnel-row .lb { color:var(--mute); font-weight:600; }
.ma-funnel-row .bar { height:10px; border-radius:6px; background:#f1f5f9; overflow:hidden; }
.ma-funnel-row .bar span { display:block; height:100%; border-radius:6px; transition:width .7s var(--ease); }
.ma-funnel-row .v { text-align:right; font-weight:700; font-variant-numeric:tabular-nums; }
.ma-funnel-row .p { text-align:right; color:var(--faint); font-variant-numeric:tabular-nums; }
.ma-stream-h { display:flex; align-items:center; gap:10px; }
.ma-stream-ic { width:34px; height:34px; border-radius:10px; display:grid; place-items:center; flex:none; }

/* tables */
.ma-tablewrap { overflow-x:auto; overscroll-behavior-x:contain; }
.ma-table { width:100%; border-collapse:separate; border-spacing:0; font-size:12.5px; }
.ma-table th { position:sticky; top:0; z-index:1; background:#f8fafc; text-align:right; padding:10px 12px; font-size:10.5px; font-weight:750;
  text-transform:uppercase; letter-spacing:.05em; color:var(--mute); border-bottom:1px solid var(--line); white-space:nowrap; user-select:none; }
.ma-table th.l, .ma-table td.l { text-align:left; }
.ma-table th[data-sort] { cursor:pointer; transition:color .15s; }
.ma-table th[data-sort]:hover { color:var(--ink); }
.ma-table th .arr { display:inline-block; width:10px; margin-left:3px; opacity:.35; transition:transform .2s, opacity .2s; }
.ma-table th[data-active] { color:var(--brand); }
.ma-table th[data-active] .arr { opacity:1; }
.ma-table td { padding:11px 12px; border-bottom:1px solid #f1f5f9; text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; color:var(--ink2); }
.ma-table tbody tr { transition:background .15s; }
.ma-table tbody tr:hover { background:#f8faff; }
.ma-table tbody tr[data-click] { cursor:pointer; }
.ma-table tbody tr:last-child td { border-bottom:0; }
.ma-table .sub { display:block; font-size:10.5px; color:var(--faint); margin-top:2px; }
.ma-table .rate { display:inline-flex; flex-direction:column; align-items:flex-end; gap:3px; }
.ma-table .rate .mini { width:56px; height:4px; background:#f1f5f9; border-radius:4px; overflow:hidden; }
.ma-table .rate .mini span { display:block; height:100%; border-radius:4px; }
.ma-table .zero { color:#cbd5e1; }
.ma-table .bad { color:#dc2626; font-weight:650; }
.ma-name { display:flex; align-items:center; gap:10px; min-width:0; max-width:340px; }
.ma-name .ic { width:30px; height:30px; border-radius:9px; display:grid; place-items:center; flex:none; }
.ma-name b { display:block; font-weight:650; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; transition:color .15s; }
.ma-table tbody tr[data-click]:hover .ma-name b { color:var(--accent); }
.ma-name .meta { display:flex; align-items:center; gap:6px; margin-top:3px; font-size:10.5px; color:var(--faint); }
.ma-tag { display:inline-flex; align-items:center; gap:4px; padding:2px 7px; border-radius:6px; font-size:10px; font-weight:750; text-transform:uppercase; letter-spacing:.04em; }
.ma-go { opacity:0; transform:translateX(-4px); transition:all .18s var(--ease); color:var(--accent); }
.ma-table tbody tr:hover .ma-go { opacity:1; transform:none; }

.ma-search { position:relative; flex:1 1 220px; max-width:320px; }
.ma-search svg { position:absolute; left:11px; top:50%; transform:translateY(-50%); color:var(--faint); pointer-events:none; }
.ma-search input { width:100%; box-sizing:border-box; height:36px; padding:0 12px 0 34px; border:1px solid var(--line); border-radius:9px;
  font:500 12.5px inherit; font-family:inherit; color:var(--ink); background:#fff; transition:border-color .15s, box-shadow .15s; }
.ma-search input:hover { border-color:#cbd5e1; }
.ma-search input:focus { outline:0; border-color:#818cf8; box-shadow:0 0 0 3px rgba(99,102,241,.16); }

.ma-pager { display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:12px 16px; border-top:1px solid #f1f5f9; font-size:12px; color:var(--mute); }
.ma-pager-info { font-variant-numeric:tabular-nums; }
.ma-pager-size { display:inline-flex; align-items:center; gap:6px; }
.ma-pager-size select { height:30px; border:1px solid var(--line); border-radius:8px; padding:0 6px; font:600 12px inherit; font-family:inherit; color:var(--ink2); background:#fff; cursor:pointer; }
.ma-pager-btns { display:flex; gap:4px; margin-left:auto; }
.ma-pager-btns button { min-width:32px; height:32px; padding:0 9px; border-radius:8px; border:1px solid var(--line); background:#fff;
  font:600 12.5px inherit; font-family:inherit; color:var(--ink2); cursor:pointer; transition:all .15s; }
.ma-pager-btns button:hover:not(:disabled) { background:var(--soft); border-color:#cbd5e1; }
.ma-pager-btns button[data-on] { background:var(--brand); border-color:var(--brand); color:#fff; box-shadow:0 4px 10px rgba(30,58,138,.25); }
.ma-pager-btns button:disabled { opacity:.4; cursor:not-allowed; }
.ma-pager-gap { align-self:center; padding:0 2px; color:var(--faint); }

.ma-pill { display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:999px; font-size:10.5px; font-weight:750; text-transform:uppercase; letter-spacing:.03em; }
.ma-pill i { width:6px; height:6px; border-radius:50%; }

/* failure reasons */
.ma-reasons { display:flex; flex-direction:column; }
.ma-reason { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:4px 14px; padding:11px 0; border-bottom:1px dashed #eef2f7; }
.ma-reason:last-child { border-bottom:0; }
.ma-reason .txt { font-size:12.5px; color:var(--ink2); line-height:1.45; word-break:break-word; }
.ma-reason .c { font-weight:800; font-variant-numeric:tabular-nums; font-size:13px; text-align:right; }
.ma-reason .meta { grid-column:1 / -1; display:flex; align-items:center; gap:8px; }
.ma-reason .bar { flex:1; height:5px; background:#f1f5f9; border-radius:5px; overflow:hidden; }
.ma-reason .bar span { display:block; height:100%; border-radius:5px; transition:width .6s var(--ease); }

/* skeleton + loaders */
.ma-skel { display:inline-block; background:linear-gradient(90deg,#eef2f7 0%,#f8fafc 45%,#eef2f7 90%); background-size:220% 100%; animation:ma-shim 1.25s ease-in-out infinite; }
@keyframes ma-shim { from { background-position:120% 0; } to { background-position:-120% 0; } }
.ma-dots { display:inline-flex; gap:4px; align-items:center; --c:#4f46e5; }
.ma-dots i { width:6px; height:6px; border-radius:50%; background:var(--c); animation:ma-dot 1.2s infinite ease-in-out; }
.ma-dots i:nth-child(2) { animation-delay:.15s; } .ma-dots i:nth-child(3) { animation-delay:.3s; }
@keyframes ma-dot { 0%,80%,100% { opacity:.2; transform:scale(.8); } 40% { opacity:1; transform:scale(1); } }
.ma-empty { display:flex; flex-direction:column; align-items:center; gap:6px; padding:38px 16px; text-align:center; }
.ma-empty b { font-size:14px; color:var(--ink2); margin-top:6px; }
.ma-empty span { font-size:12.5px; color:var(--faint); }
.ma-note { display:flex; gap:8px; align-items:flex-start; padding:9px 12px; border-radius:10px; background:#fffbeb; border:1px solid #fde68a; color:#92400e; font-size:12px; line-height:1.45; }

/* drawer */
.ma-scrim { position:fixed; inset:0; z-index:2000; background:rgba(15,23,42,.42); backdrop-filter:blur(2px); animation:ma-scrim .25s ease both; }
.ma-scrim[data-closing] { animation:ma-scrim-out .22s ease both; }
@keyframes ma-scrim { from { opacity:0; } } @keyframes ma-scrim-out { to { opacity:0; } }
.ma-drawer { position:fixed; top:0; right:0; bottom:0; z-index:2001; width:min(1040px, 100vw); background:#f8fafc; display:flex; flex-direction:column;
  box-shadow:-24px 0 60px rgba(15,23,42,.22); animation:ma-in .34s var(--ease) both; }
.ma-drawer[data-closing] { animation:ma-out .24s cubic-bezier(.4,0,1,1) both; }
@keyframes ma-in { from { transform:translateX(100%); } } @keyframes ma-out { to { transform:translateX(100%); } }
.ma-drawer-h { display:flex; align-items:flex-start; gap:14px; padding:18px 22px 0; background:#fff; border-bottom:1px solid var(--line); }
.ma-drawer-h h2 { margin:0; font-size:18px; font-weight:800; letter-spacing:-.02em; line-height:1.3; word-break:break-word; }
.ma-drawer-b { flex:1; overflow-y:auto; padding:18px 22px 30px; overscroll-behavior:contain; }
@media (max-width:720px){ .ma-drawer-h { padding:14px 14px 0; } .ma-drawer-b { padding:14px 14px 24px; } }
.ma-x { width:36px; height:36px; border-radius:10px; border:0; background:transparent; display:grid; place-items:center; color:var(--mute); cursor:pointer; flex:none; transition:background .15s, color .15s, transform .2s; }
.ma-x:hover { background:#f1f5f9; color:var(--ink); transform:rotate(90deg); }
.ma-tabs { display:flex; gap:2px; margin-top:14px; overflow-x:auto; scrollbar-width:none; }
.ma-tabs button { position:relative; overflow:hidden; border:0; background:none; padding:11px 14px; font:600 13px inherit; font-family:inherit; color:var(--mute); cursor:pointer; white-space:nowrap; transition:color .15s; }
.ma-tabs button:hover { color:var(--ink); }
.ma-tabs button::after { content:''; position:absolute; left:10px; right:10px; bottom:0; height:2.5px; border-radius:3px 3px 0 0; background:var(--brand); transform:scaleX(0); transition:transform .25s var(--ease); }
.ma-tabs button[data-on] { color:var(--brand); }
.ma-tabs button[data-on]::after { transform:scaleX(1); }

/* steps accordion */
.ma-step { background:#fff; border:1px solid var(--line); border-radius:14px; margin-bottom:10px; overflow:hidden; transition:box-shadow .2s, border-color .2s; }
.ma-step:hover { border-color:#cbd5e1; }
.ma-step[data-open] { box-shadow:0 10px 28px rgba(15,23,42,.08); border-color:#c7d2fe; }
.ma-step-h { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:12px; align-items:center; width:100%; padding:14px 16px; border:0; background:none; text-align:left; cursor:pointer; font-family:inherit; position:relative; overflow:hidden; }
.ma-step-n { width:28px; height:28px; border-radius:50%; display:grid; place-items:center; font-size:12px; font-weight:800; background:#eef2ff; color:#3730a3; }
.ma-step-t b { display:block; font-size:13.5px; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ma-step-t span { font-size:11.5px; color:var(--faint); }
.ma-step-stats { display:flex; gap:16px; align-items:center; }
.ma-step-stats div { text-align:right; min-width:52px; }
.ma-step-stats div b { display:block; font-size:14px; font-variant-numeric:tabular-nums; }
.ma-step-stats div span { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:var(--faint); font-weight:700; }
@media (max-width:760px){ .ma-step-h { grid-template-columns:auto minmax(0,1fr); } .ma-step-stats { grid-column:1 / -1; justify-content:space-between; } }
.ma-chev { transition:transform .25s var(--ease); color:var(--faint); }
.ma-step[data-open] .ma-chev { transform:rotate(180deg); color:var(--brand); }
.ma-step-body { border-top:1px solid #eef2f7; background:#fcfdff; animation:ma-fade .3s var(--ease) both; }

@media (prefers-reduced-motion: reduce) {
  .ma *, .ma-drawer, .ma-scrim, .ma-drawer * { animation-duration:.001ms !important; transition-duration:.001ms !important; }
}
`;
