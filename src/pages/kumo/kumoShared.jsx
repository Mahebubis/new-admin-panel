/*
 * KumoMTA — shared design kit.
 *
 * One import for every page in this module: the API seam, formatters, the
 * date-range toolkit and the glossy UI primitives (cards, tiles, buttons,
 * dropdowns, drawers, modals, tables, charts, skeletons).
 *
 * Design language: frosted glass over a soft aurora gradient, indigo/violet
 * accents, 200–320ms cubic-bezier motion, focus rings everywhere, and layouts
 * that collapse cleanly from 1920px down to a phone.
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/axios';

/* ══════════════════════════════════════════════════════════════════════════
   API SEAM
   ══════════════════════════════════════════════════════════════════════════ */
export const KUMO_API = '/api/kumo/kumo.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

/** kapi('dashboard', { from, to }) → resolves with res.data.data, throws on failure. */
export async function kapi(action, params = {}, opts = {}) {
  const body = new URLSearchParams();
  body.append('action', action);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    body.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  });
  const res = await api.post(KUMO_API, body, { ...FORM, ...opts });
  if (res?.data?.success) return res.data.data ?? {};
  const msg = res?.data?.message || 'Something went wrong';
  const err = new Error(msg);
  err.payload = res?.data;
  throw err;
}

/* ══════════════════════════════════════════════════════════════════════════
   FORMATTERS
   ══════════════════════════════════════════════════════════════════════════ */
export const nf = (n) => Number(n || 0).toLocaleString('en-IN');
export const compact = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1e7) return (v / 1e7).toFixed(v % 1e7 === 0 ? 0 : 1) + ' Cr';
  if (Math.abs(v) >= 1e5) return (v / 1e5).toFixed(v % 1e5 === 0 ? 0 : 1) + ' L';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(v % 1e3 === 0 ? 0 : 1) + 'k';
  return String(v);
};
export const pct = (n, digits = 2) => `${Number(n || 0).toFixed(digits)}%`;
export const fmtDt = (s) => {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d)) return String(s);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
};
export const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d)) return String(s);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const ago = (s) => {
  if (!s) return '—';
  const t = new Date(String(s).replace(' ', 'T')).getTime();
  if (isNaN(t)) return '—';
  const diff = Math.max(0, Date.now() - t) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

/* ══════════════════════════════════════════════════════════════════════════
   DATE RANGE
   ══════════════════════════════════════════════════════════════════════════ */
const localDay = (d) => {
  // Deliberately NOT toISOString() — that shifts by the IST offset.
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const RANGE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'custom', label: 'Custom' },
];
export function resolveRange(id, from, to) {
  const now = new Date();
  const back = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  switch (id) {
    case 'today':  return { from: localDay(now), to: localDay(now), bucket: 'hour' };
    case '7d':     return { from: localDay(back(6)), to: localDay(now), bucket: 'day' };
    case '90d':    return { from: localDay(back(89)), to: localDay(now), bucket: 'day' };
    case 'custom': return { from: from || localDay(back(29)), to: to || localDay(now), bucket: 'day' };
    case '30d':
    default:       return { from: localDay(back(29)), to: localDay(now), bucket: 'day' };
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   THEME TOKENS + GLOBAL CSS
   ══════════════════════════════════════════════════════════════════════════ */
export const T = {
  ink: '#0b1020', ink2: '#1e293b', muted: '#64748b', faint: '#94a3b8',
  line: 'rgba(15,23,42,.08)', line2: 'rgba(15,23,42,.14)',
  brand: '#4f46e5', brand2: '#7c3aed', cyan: '#06b6d4',
  green: '#059669', greenSoft: '#d1fae5',
  amber: '#d97706', amberSoft: '#fef3c7',
  red: '#dc2626', redSoft: '#fee2e2',
  glass: '#ffffff',
  radius: 10,
};

export const HEALTH = {
  green:   { label: 'Healthy',  dot: '#10b981', bg: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', ring: 'rgba(16,185,129,.35)', text: '#065f46' },
  yellow:  { label: 'Watch',    dot: '#f59e0b', bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)', ring: 'rgba(245,158,11,.35)', text: '#92400e' },
  red:     { label: 'Critical', dot: '#ef4444', bg: 'linear-gradient(135deg,#fef2f2,#fee2e2)', ring: 'rgba(239,68,68,.35)',  text: '#991b1b' },
  unknown: { label: 'No data',  dot: '#94a3b8', bg: 'linear-gradient(135deg,#f8fafc,#f1f5f9)', ring: 'rgba(148,163,184,.3)', text: '#475569' },
};

export const KUMO_CSS = `
.km *, .km *::before, .km *::after { box-sizing: border-box; }
.km { font-family:'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif; color:${T.ink};
      -webkit-font-smoothing:antialiased; }

/* ── the glossy stage ─────────────────────────────────────────────────────
   Three fixed layers: colour aurora, a slow-drifting specular sheen, and a
   fine glass grain. Everything above sits on frosted panels. */
.km-shell { position:relative; min-height:100%; padding:14px 16px 26px; }
.km-page  { padding:16px 20px; }
.km-wrap  { max-width:1480px; margin:0 auto; }
.km-shell::before { content:''; position:absolute; inset:0; z-index:-2;
  background:
    radial-gradient(760px 520px at 8% -6%,  rgba(99,102,241,.22), transparent 62%),
    radial-gradient(680px 480px at 96% 2%,  rgba(14,165,233,.18), transparent 60%),
    radial-gradient(620px 520px at 52% 106%, rgba(168,85,247,.18), transparent 62%),
    #f1f0ff;
  animation:km-drift 26s ease-in-out infinite alternate; }
.km-shell::after { content:''; position:fixed; inset:0; z-index:-1; pointer-events:none;
  background:
    linear-gradient(115deg, rgba(255,255,255,.55) 0%, rgba(255,255,255,0) 32%,
                    rgba(255,255,255,0) 64%, rgba(255,255,255,.42) 100%),
    radial-gradient(rgba(15,23,42,.05) 1px, transparent 1px);
  background-size:auto, 20px 20px; opacity:.85; }
@keyframes km-drift { from { transform:translate3d(0,0,0) scale(1); } to { transform:translate3d(-1.5%,1.5%,0) scale(1.05); } }
@media (prefers-reduced-motion: reduce) { .km-shell::before { animation:none; } }

/* ── surfaces ─────────────────────────────────────────────────────────── */
.km-card { position:relative; background:#fff; border:1px solid #e6e8f2; border-radius:10px;
  box-shadow:0 1px 3px rgba(15,23,42,.06);
  transition:box-shadow .2s ease, transform .2s ease; }
.km-card--hover:hover { transform:translateY(-1px); box-shadow:0 6px 18px -8px rgba(15,23,42,.22); }
.km-card--pad { padding:13px 15px; }
/* the specular streak that makes the panel read as glass */


.km-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:12px; }
.km-h1 { margin:0; font-size:19.5px; font-weight:800; letter-spacing:-.4px;
  background:linear-gradient(120deg,#0f172a,#4338ca 60%,#0891b2); -webkit-background-clip:text; background-clip:text; color:transparent; }
.km-sub { margin-top:3px; font-size:11.8px; color:${T.muted}; font-weight:500; }
.km-h2 { margin:0; font-size:13.5px; font-weight:700; letter-spacing:-.2px; color:${T.ink2}; }
.km-h3 { margin:0; font-size:11px; font-weight:700; letter-spacing:.5px; text-transform:uppercase; color:${T.faint}; }

/* ── buttons ──────────────────────────────────────────────────────────── */
.km-btn { position:relative; overflow:hidden; display:inline-flex; align-items:center; gap:7px; border:0; cursor:pointer;
  padding:8px 13px; border-radius:11px; font:600 12.4px/1 'Plus Jakarta Sans',sans-serif; color:#fff;
  background:linear-gradient(135deg,#4f46e5,#7c3aed); box-shadow:0 10px 24px -12px rgba(79,70,229,.95);
  transition:transform .18s cubic-bezier(.22,1,.36,1), box-shadow .18s, filter .18s; white-space:nowrap; }
.km-btn:hover { transform:translateY(-1px); filter:brightness(1.06); box-shadow:0 16px 30px -14px rgba(79,70,229,1); }
.km-btn:active { transform:translateY(1px) scale(.985); }
.km-btn:disabled { opacity:.55; cursor:not-allowed; transform:none; filter:none; }
.km-btn--ghost { background:rgba(255,255,255,.8); color:${T.ink2}; border:1px solid ${T.line2}; box-shadow:0 1px 2px rgba(15,23,42,.05); }
.km-btn--ghost:hover { background:#fff; }
.km-btn--danger { background:linear-gradient(135deg,#ef4444,#b91c1c); box-shadow:0 10px 24px -12px rgba(239,68,68,.95); }
.km-btn--success { background:linear-gradient(135deg,#10b981,#047857); box-shadow:0 10px 24px -12px rgba(16,185,129,.95); }
.km-btn--sm { padding:7px 12px; font-size:12px; border-radius:10px; }
.km-btn--icon { padding:9px; border-radius:11px; }
.km-ripple { position:absolute; border-radius:50%; transform:scale(0); background:rgba(255,255,255,.55);
  animation:km-ripple .6s ease-out; pointer-events:none; }
@keyframes km-ripple { to { transform:scale(3.2); opacity:0; } }

/* ── inputs ───────────────────────────────────────────────────────────── */
.km-input, .km-select, .km-textarea { width:100%; padding:7px 10px; border-radius:10px; border:1px solid ${T.line2};
  background:rgba(255,255,255,.9); font:500 13px/1.4 'Plus Jakarta Sans',sans-serif; color:${T.ink};
  transition:border-color .18s, box-shadow .18s, background .18s; outline:none; }
.km-input:focus, .km-select:focus, .km-textarea:focus { border-color:#818cf8; background:#fff;
  box-shadow:0 0 0 4px rgba(99,102,241,.16); }
.km-input::placeholder { color:#a6b0c0; }
.km-label { display:block; font-size:11.5px; font-weight:700; letter-spacing:.3px; text-transform:uppercase;
  color:${T.faint}; margin-bottom:6px; }
.km-field { margin-bottom:14px; }

/* ── pills / badges ───────────────────────────────────────────────────── */
.km-pill { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px;
  font:700 11px/1 'Plus Jakarta Sans',sans-serif; letter-spacing:.2px; white-space:nowrap; }
.km-dot { width:7px; height:7px; border-radius:50%; display:inline-block; }
.km-dot--pulse { animation:km-pulse 1.8s ease-in-out infinite; }
@keyframes km-pulse { 0%,100%{ box-shadow:0 0 0 0 currentColor; opacity:1 } 50%{ box-shadow:0 0 0 5px transparent; opacity:.65 } }

/* ── tables ───────────────────────────────────────────────────────────── */
.km-tablewrap { overflow:auto; border-radius:14px; }
.km-table { width:100%; border-collapse:separate; border-spacing:0; font-size:12.3px; }
.km-table thead th { position:sticky; top:0; z-index:2; text-align:left; padding:8px 11px; font-weight:700; font-size:10.8px;
  letter-spacing:.4px; text-transform:uppercase; color:${T.faint}; background:rgba(248,250,252,.94);
  backdrop-filter:blur(8px); border-bottom:1px solid ${T.line}; white-space:nowrap; }
.km-table tbody td { padding:8px 11px; border-bottom:1px solid rgba(15,23,42,.05); color:${T.ink2}; vertical-align:middle; }
.km-table tbody tr { transition:background .16s; }
.km-table tbody tr:hover td { background:rgba(99,102,241,.05); }
.km-table tbody tr:last-child td { border-bottom:0; }

/* ── misc ─────────────────────────────────────────────────────────────── */
.km-grid { display:grid; gap:12px; }
.km-skel { background:linear-gradient(90deg,#eef1f6 25%,#f7f9fc 37%,#eef1f6 63%); background-size:400% 100%;
  animation:km-shimmer 1.3s ease-in-out infinite; border-radius:10px; }
@keyframes km-shimmer { 0%{background-position:100% 50%} 100%{background-position:0 50%} }
.km-fade { animation:km-fade .36s cubic-bezier(.22,1,.36,1) both; }
@keyframes km-fade { from{ opacity:0; transform:translateY(8px) } to{ opacity:1; transform:none } }
.km-pop { animation:km-pop .28s cubic-bezier(.22,1,.36,1) both; }
@keyframes km-pop { from{ opacity:0; transform:scale(.96) translateY(8px) } to{ opacity:1; transform:none } }
.km-spin { animation:km-spin 1s linear infinite; }
@keyframes km-spin { to { transform:rotate(360deg) } }
.km-scroll::-webkit-scrollbar { width:9px; height:9px; }
.km-scroll::-webkit-scrollbar-thumb { background:rgba(15,23,42,.18); border-radius:8px; border:2px solid transparent; background-clip:content-box; }
.km-scroll::-webkit-scrollbar-thumb:hover { background:rgba(15,23,42,.3); background-clip:content-box; }
.km-scroll::-webkit-scrollbar-track { background:transparent; }

/* ── responsive ───────────────────────────────────────────────────────── */
@media (max-width: 1100px) { .km-shell { padding:12px 12px 22px; } }
@media (max-width: 720px)  { .km-shell { padding:10px 10px 20px; } .km-h1 { font-size:17.5px; } }

/* ── dark mode friendliness (panel is light, but respect the OS) ───────── */
@media (prefers-color-scheme: dark) {
  .km-shell::before { filter:none; }
}
`;

/** Mounts the shared stylesheet once per page. */
export function KumoStyles() {
  return <style>{KUMO_CSS}</style>;
}

/* ══════════════════════════════════════════════════════════════════════════
   PRIMITIVES
   ══════════════════════════════════════════════════════════════════════════ */
export function ripple(e) {
  const el = e.currentTarget;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const span = document.createElement('span');
  const size = Math.max(r.width, r.height);
  span.className = 'km-ripple';
  span.style.width = span.style.height = `${size}px`;
  span.style.left = `${e.clientX - r.left - size / 2}px`;
  span.style.top = `${e.clientY - r.top - size / 2}px`;
  el.appendChild(span);
  setTimeout(() => span.remove(), 620);
}

export function Btn({ children, variant = '', size = '', onClick, loading, icon, ...rest }) {
  const cls = ['km-btn', variant && `km-btn--${variant}`, size && `km-btn--${size}`].filter(Boolean).join(' ');
  return (
    <button className={cls} onClick={(e) => { ripple(e); onClick?.(e); }} disabled={loading || rest.disabled} {...rest}>
      {loading ? <Spinner size={14} light /> : icon}
      {children}
    </button>
  );
}

export function Spinner({ size = 16, light = false }) {
  return (
    <svg className="km-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke={light ? 'rgba(255,255,255,.35)' : 'rgba(79,70,229,.2)'} strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke={light ? '#fff' : '#4f46e5'} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Card({ children, pad = true, hover = false, style, className = '', ...rest }) {
  const cls = ['km-card', pad && 'km-card--pad', hover && 'km-card--hover', className].filter(Boolean).join(' ');
  return <div className={cls} style={style} {...rest}>{children}</div>;
}

export function Pill({ tone = 'slate', children, pulse = false, style }) {
  const tones = {
    green:  { bg: 'rgba(16,185,129,.12)',  fg: '#047857', dot: '#10b981' },
    yellow: { bg: 'rgba(245,158,11,.14)',  fg: '#b45309', dot: '#f59e0b' },
    red:    { bg: 'rgba(239,68,68,.12)',   fg: '#b91c1c', dot: '#ef4444' },
    indigo: { bg: 'rgba(99,102,241,.12)',  fg: '#4338ca', dot: '#6366f1' },
    cyan:   { bg: 'rgba(6,182,212,.12)',   fg: '#0e7490', dot: '#06b6d4' },
    slate:  { bg: 'rgba(100,116,139,.12)', fg: '#475569', dot: '#94a3b8' },
  };
  const t = tones[tone] || tones.slate;
  return (
    <span className="km-pill" style={{ background: t.bg, color: t.fg, ...style }}>
      <i className={`km-dot ${pulse ? 'km-dot--pulse' : ''}`} style={{ background: t.dot, color: t.dot }} />
      {children}
    </span>
  );
}

export function HealthPill({ health, pulse }) {
  const map = { green: 'green', yellow: 'yellow', red: 'red', unknown: 'slate' };
  return <Pill tone={map[health] || 'slate'} pulse={pulse ?? health === 'red'}>{(HEALTH[health] || HEALTH.unknown).label}</Pill>;
}

/** Number that animates up when it changes. */
export function CountUp({ value, format = nf, duration = 700 }) {
  const [shown, setShown] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const to = Number(value || 0);
    prev.current = to;
    if (from === to) { setShown(to); return; }
    let raf; const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(Math.round(shown))}</>;
}

/** Headline metric tile with optional sparkline + delta. */
export function StatTile({ label, value, format = nf, sub, tone = 'indigo', icon, spark, onClick, loading }) {
  const tones = {
    indigo: ['#6366f1', '#8b5cf6'], cyan: ['#06b6d4', '#0ea5e9'], green: ['#10b981', '#059669'],
    amber: ['#f59e0b', '#ea580c'], red: ['#ef4444', '#dc2626'], slate: ['#64748b', '#475569'],
  };
  const [c1, c2] = tones[tone] || tones.indigo;
  return (
    <Card hover={!!onClick} pad={false} className="km-fade"
      style={{ padding: '12px 14px', cursor: onClick ? 'pointer' : 'default', minWidth: 0 }}
      onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span className="km-h3" style={{ fontSize: 11 }}>{label}</span>
        {icon && (
          <span style={{ width: 30, height: 30, borderRadius: 10, display: 'grid', placeItems: 'center',
            background: `linear-gradient(135deg, ${c1}22, ${c2}22)`, color: c1, flexShrink: 0 }}>{icon}</span>
        )}
      </div>
      <div style={{ marginTop: 6, fontSize: 21, fontWeight: 800, letterSpacing: '-.6px', lineHeight: 1.1,
        background: `linear-gradient(120deg, ${c1}, ${c2})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
        {loading ? <span className="km-skel" style={{ display: 'inline-block', width: 72, height: 24 }} />
                 : <CountUp value={value} format={format} />}
      </div>
      {sub !== undefined && <div style={{ marginTop: 5, fontSize: 11.5, color: T.muted, fontWeight: 600 }}>{sub}</div>}
      {spark && spark.length > 1 && <Sparkline data={spark} color={c1} />}
    </Card>
  );
}

/** Tiny inline SVG sparkline — no chart library needed. */
export function Sparkline({ data = [], color = '#6366f1', height = 26 }) {
  const path = useMemo(() => {
    const vals = data.map((d) => Number(d) || 0);
    if (vals.length < 2) return null;
    const max = Math.max(...vals, 1); const min = Math.min(...vals, 0);
    const span = max - min || 1;
    const w = 100;
    const pts = vals.map((v, i) => [ (i / (vals.length - 1)) * w, height - ((v - min) / span) * (height - 6) - 3 ]);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
    const area = `${d} L${w},${height} L0,${height} Z`;
    return { d, area };
  }, [data, height]);
  if (!path) return null;
  const id = `kmspark${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, marginTop: 8, display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.area} fill={`url(#${id})`} />
      <path d={path.d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Horizontal progress bar (warmup quota, delivery share…). */
export function Meter({ value = 0, max = 100, tone = 'indigo', height = 8, label }) {
  const tones = { indigo: ['#6366f1', '#8b5cf6'], green: ['#10b981', '#059669'], amber: ['#f59e0b', '#ea580c'], red: ['#ef4444', '#dc2626'] };
  const [c1, c2] = tones[tone] || tones.indigo;
  const p = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  return (
    <div>
      {label && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: T.muted, fontWeight: 600, marginBottom: 5 }}>{label}</div>}
      <div style={{ height, borderRadius: 999, background: 'rgba(15,23,42,.07)', overflow: 'hidden' }}>
        <div style={{ width: `${p}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${c1}, ${c2})`,
          transition: 'width .6s cubic-bezier(.22,1,.36,1)', boxShadow: `0 0 12px -2px ${c1}` }} />
      </div>
    </div>
  );
}

export function Empty({ title = 'Nothing here yet', sub, icon, action }) {
  return (
    <div style={{ padding: '30px 18px', textAlign: 'center', color: T.muted }} className="km-fade">
      <div style={{ width: 54, height: 54, borderRadius: 16, margin: '0 auto 12px', display: 'grid', placeItems: 'center',
        background: 'linear-gradient(135deg, rgba(99,102,241,.12), rgba(6,182,212,.12))', color: T.brand }}>
        {icon || <IconInbox />}
      </div>
      <div style={{ fontWeight: 700, color: T.ink2, fontSize: 14 }}>{title}</div>
      {sub && <div style={{ marginTop: 5, fontSize: 12.5, maxWidth: 420, marginInline: 'auto', lineHeight: 1.6 }}>{sub}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function Skel({ w = '100%', h = 14, r = 8, style }) {
  return <span className="km-skel" style={{ display: 'block', width: w, height: h, borderRadius: r, ...style }} />;
}

/* ── overlays ─────────────────────────────────────────────────────────── */
export function Modal({ open, onClose, title, subtitle, children, footer, width = 560 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(15,23,42,.42)', backdropFilter: 'blur(4px)',
        display: 'grid', placeItems: 'center', padding: 18 }}>
      <div className="km-pop km-card km-scroll" style={{ width: '100%', maxWidth: width, maxHeight: '88vh', overflow: 'auto', padding: 0 }}>
        <div style={{ padding: '18px 22px 12px', borderBottom: `1px solid ${T.line}`, position: 'sticky', top: 0,
          background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(10px)', zIndex: 2, borderRadius: `${T.radius}px ${T.radius}px 0 0` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h3 className="km-h2" style={{ fontSize: 16 }}>{title}</h3>
              {subtitle && <div className="km-sub" style={{ marginTop: 3 }}>{subtitle}</div>}
            </div>
            <button className="km-btn km-btn--ghost km-btn--icon" onClick={onClose} aria-label="Close"><IconX /></button>
          </div>
        </div>
        <div style={{ padding: '13px 16px' }}>{children}</div>
        {footer && <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.line}`, display: 'flex', justifyContent: 'flex-end', gap: 10,
          position: 'sticky', bottom: 0, background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(10px)' }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, subtitle, children, width = 720, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,23,42,.38)',
        backdropFilter: 'blur(3px)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity .3s' }} />
      <aside className="km km-scroll" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1101, width: 'min(96vw, ' + width + 'px)',
        background: 'linear-gradient(180deg,#ffffff, #fbfcff)', boxShadow: '-30px 0 60px -30px rgba(15,23,42,.5)',
        transform: open ? 'translateX(0)' : 'translateX(101%)', transition: 'transform .36s cubic-bezier(.22,1,.36,1)',
        display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h3 className="km-h2" style={{ fontSize: 16 }}>{title}</h3>
            {subtitle && <div className="km-sub" style={{ marginTop: 3 }}>{subtitle}</div>}
          </div>
          <button className="km-btn km-btn--ghost km-btn--icon" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        <div className="km-scroll" style={{ flex: 1, overflow: 'auto', padding: '13px 16px' }}>{children}</div>
        {footer && <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.line}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>{footer}</div>}
      </aside>
    </>
  );
}

export function Confirm({ open, title, message, confirmLabel = 'Confirm', tone = 'danger', busy, onConfirm, onCancel }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} width={440}
      footer={<>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant={tone === 'danger' ? 'danger' : ''} loading={busy} onClick={onConfirm}>{confirmLabel}</Btn>
      </>}>
      <div style={{ fontSize: 13.5, color: T.ink2, lineHeight: 1.65 }}>{message}</div>
    </Modal>
  );
}

/** Anchored popover (date range, filters, row menus). */
export function Popover({ anchor, onClose, width = 280, align = 'right', children }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target) && !anchor?.contains?.(e.target)) onClose?.(); };
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [anchor, onClose]);
  if (!anchor) return null;
  const r = anchor.getBoundingClientRect();
  const left = align === 'right' ? Math.max(12, r.right - width) : Math.min(window.innerWidth - width - 12, r.left);
  // Flip above the anchor when there is no room below, so a menu on the last
  // row of a long table does not open off the bottom of the window.
  const below = window.innerHeight - r.bottom;
  const flip = below < 200 && r.top > below;

  // Rendered into <body>. It has to be: .km-card--hover applies transform on
  // hover, and a transformed ancestor becomes the containing block for
  // position:fixed — which made every menu inside an IP card resolve its
  // viewport coordinates against the card and land off-screen.
  return createPortal(
    <div ref={ref} className="km km-pop km-card km-scroll"
      style={{ position: 'fixed', left, width, zIndex: 1300, padding: 12, maxHeight: '70vh', overflow: 'auto',
        ...(flip ? { bottom: window.innerHeight - r.top + 8 } : { top: r.bottom + 8 }) }}>
      {children}
    </div>,
    document.body);
}

/* ── controls ─────────────────────────────────────────────────────────── */
export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', userSelect: 'none' }}>
      <span onClick={() => onChange?.(!checked)} style={{ width: 40, height: 23, borderRadius: 999, padding: 3, flexShrink: 0,
        background: checked ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(15,23,42,.15)',
        boxShadow: checked ? '0 6px 16px -8px rgba(99,102,241,.9)' : 'none', transition: 'background .25s, box-shadow .25s' }}>
        <span style={{ display: 'block', width: 17, height: 17, borderRadius: '50%', background: '#fff',
          transform: `translateX(${checked ? 17 : 0}px)`, transition: 'transform .25s cubic-bezier(.22,1,.36,1)',
          boxShadow: '0 1px 3px rgba(15,23,42,.35)' }} />
      </span>
      {(label || hint) && (
        <span>
          {label && <span style={{ fontSize: 13, fontWeight: 600, color: T.ink2 }}>{label}</span>}
          {hint && <span style={{ display: 'block', fontSize: 11.5, color: T.muted, marginTop: 2 }}>{hint}</span>}
        </span>
      )}
    </label>
  );
}

export function Tabs({ tabs = [], value, onChange, size = 'md' }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 13, background: 'rgba(15,23,42,.05)', flexWrap: 'wrap' }}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button key={t.id} onClick={(e) => { ripple(e); onChange?.(t.id); }}
            style={{ position: 'relative', overflow: 'hidden', border: 0, cursor: 'pointer', borderRadius: 10,
              padding: size === 'sm' ? '6px 11px' : '8px 14px', fontSize: size === 'sm' ? 12 : 12.8, fontWeight: 700,
              color: active ? '#fff' : T.muted, background: active ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'transparent',
              boxShadow: active ? '0 8px 20px -12px rgba(79,70,229,.95)' : 'none',
              transition: 'all .22s cubic-bezier(.22,1,.36,1)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            {t.icon}{t.label}
            {t.count !== undefined && (
              <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 6px', borderRadius: 999,
                background: active ? 'rgba(255,255,255,.22)' : 'rgba(15,23,42,.08)', color: active ? '#fff' : T.muted }}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', width = 240 }) {
  return (
    <div style={{ position: 'relative', width }}>
      <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: T.faint, display: 'flex' }}><IconSearch /></span>
      <input className="km-input" value={value} placeholder={placeholder} onChange={(e) => onChange?.(e.target.value)}
        style={{ paddingLeft: 33, paddingRight: value ? 30 : 12 }} />
      {value && (
        <button onClick={() => onChange?.('')} aria-label="Clear"
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent',
            cursor: 'pointer', color: T.faint, display: 'flex', padding: 2 }}><IconX size={13} /></button>
      )}
    </div>
  );
}

export function Pagination({ page, perPage, total, onPage, onPerPage, sizes = [25, 50, 100, 200] }) {
  const pages = Math.max(1, Math.ceil((total || 0) / (perPage || 25)));
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 4px', flexWrap: 'wrap' }}>
      <div style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>
        {total ? `${nf((page - 1) * perPage + 1)}–${nf(Math.min(page * perPage, total))} of ${nf(total)}` : 'No rows'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {onPerPage && (
          <select className="km-select" value={perPage} onChange={(e) => onPerPage(Number(e.target.value))} style={{ width: 'auto', padding: '6px 10px' }}>
            {sizes.map((s) => <option key={s} value={s}>{s} / page</option>)}
          </select>
        )}
        <Btn variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</Btn>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.ink2, minWidth: 74, textAlign: 'center' }}>Page {page} / {pages}</span>
        <Btn variant="ghost" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Btn>
      </div>
    </div>
  );
}

/** Date-range control used on every screen with a chart. */
export function RangePicker({ value, onChange }) {
  const [anchor, setAnchor] = useState(null);
  const { id, from, to } = value;
  const label = id === 'custom' ? `${fmtDate(from)} → ${fmtDate(to)}` : (RANGE_PRESETS.find((p) => p.id === id)?.label || 'Last 30 days');
  return (
    <>
      <button className="km-btn km-btn--ghost km-btn--sm" onClick={(e) => { ripple(e); setAnchor(anchor ? null : e.currentTarget); }}>
        <IconCalendar /> {label}
      </button>
      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} width={268}>
          <div style={{ display: 'grid', gap: 4 }}>
            {RANGE_PRESETS.map((p) => (
              <button key={p.id} onClick={() => { if (p.id !== 'custom') { onChange({ id: p.id, ...resolveRange(p.id) }); setAnchor(null); } else onChange({ ...value, id: 'custom', ...resolveRange('custom', from, to) }); }}
                style={{ textAlign: 'left', border: 0, cursor: 'pointer', borderRadius: 9, padding: '8px 10px', fontSize: 12.8, fontWeight: 600,
                  background: id === p.id ? 'rgba(99,102,241,.1)' : 'transparent', color: id === p.id ? T.brand : T.ink2 }}>{p.label}</button>
            ))}
          </div>
          {id === 'custom' && (
            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              <div>
                <label className="km-label">From</label>
                <input type="date" className="km-input" value={from} max={to} onChange={(e) => onChange({ ...value, id: 'custom', from: e.target.value })} />
              </div>
              <div>
                <label className="km-label">To</label>
                <input type="date" className="km-input" value={to} min={from} onChange={(e) => onChange({ ...value, id: 'custom', to: e.target.value })} />
              </div>
              <Btn size="sm" onClick={() => setAnchor(null)}>Apply</Btn>
            </div>
          )}
        </Popover>
      )}
    </>
  );
}

/** Small kebab menu for table rows. */
export function RowMenu({ items = [] }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <button className="km-btn km-btn--ghost km-btn--icon km-btn--sm" onClick={(e) => { e.stopPropagation(); setAnchor(anchor ? null : e.currentTarget); }} aria-label="Actions">
        <IconDots />
      </button>
      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} width={200}>
          <div style={{ display: 'grid', gap: 2 }}>
            {items.filter(Boolean).map((it, i) => (
              <button key={i} onClick={() => { setAnchor(null); it.onClick?.(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left', border: 0, cursor: 'pointer', borderRadius: 9,
                  padding: '8px 10px', fontSize: 12.8, fontWeight: 600, background: 'transparent',
                  color: it.tone === 'danger' ? T.red : T.ink2 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = it.tone === 'danger' ? 'rgba(239,68,68,.08)' : 'rgba(99,102,241,.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                {it.icon}{it.label}
              </button>
            ))}
          </div>
        </Popover>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ICONS — inline SVG, 24-grid, currentColor
   ══════════════════════════════════════════════════════════════════════════ */
const ic = (p, size = 16) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden>{p}</svg>
);
export const IconDashboard = ({ size }) => ic(<><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /></>, size);
export const IconServer = ({ size }) => ic(<><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></>, size);
export const IconSend = ({ size }) => ic(<><path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M22 2 11 13" /></>, size);
export const IconUsers = ({ size }) => ic(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>, size);
export const IconLayers = ({ size }) => ic(<><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></>, size);
export const IconShield = ({ size }) => ic(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>, size);
export const IconSettings = ({ size }) => ic(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.18.42.53.75.95.91H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>, size);
export const IconActivity = ({ size }) => ic(<path d="M22 12h-4l-3 9L9 3l-3 9H2" />, size);
export const IconMail = ({ size }) => ic(<><rect x="2" y="4" width="20" height="16" rx="3" /><path d="m2 7 10 6 10-6" /></>, size);
export const IconOpen = ({ size }) => ic(<><path d="M2 8.5V19a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8.5" /><path d="m2 8.5 10-6 10 6-10 6-10-6Z" /></>, size);
export const IconClick = ({ size }) => ic(<><path d="m9 9 5 12 1.8-5.2L21 14 9 9Z" /><path d="M7.2 2.2 8 5M5 7l-2.8-.8M12 5l-.8 2.8M5 12l-2.8.8" /></>, size);
export const IconBounce = ({ size }) => ic(<><path d="M3 12a9 9 0 1 0 9-9" /><path d="M3 3v6h6" /><path d="M15 9l-6 6M9 9l6 6" /></>, size);
export const IconSpam = ({ size }) => ic(<><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></>, size);
export const IconBolt = ({ size }) => ic(<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />, size);
export const IconClock = ({ size }) => ic(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, size);
export const IconRefresh = ({ size }) => ic(<><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" /><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" /><path d="M21 3v5h-5M3 21v-5h5" /></>, size);
export const IconPlus = ({ size }) => ic(<><path d="M12 5v14M5 12h14" /></>, size);
export const IconX = ({ size }) => ic(<><path d="M18 6 6 18M6 6l12 12" /></>, size);
export const IconSearch = ({ size = 14 }) => ic(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>, size);
export const IconCalendar = ({ size }) => ic(<><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 10h18" /></>, size);
export const IconDots = ({ size = 15 }) => ic(<><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></>, size);
export const IconPause = ({ size }) => ic(<><rect x="6" y="4" width="4" height="16" rx="1.5" /><rect x="14" y="4" width="4" height="16" rx="1.5" /></>, size);
export const IconPlay = ({ size }) => ic(<path d="M7 4.5v15l13-7.5-13-7.5Z" />, size);
export const IconTrash = ({ size }) => ic(<><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6" /><path d="M10 11v6M14 11v6" /></>, size);
export const IconEdit = ({ size }) => ic(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></>, size);
export const IconCopy = ({ size }) => ic(<><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>, size);
export const IconDownload = ({ size }) => ic(<><path d="M12 3v12" /><path d="m7 12 5 5 5-5" /><path d="M21 21H3" /></>, size);
export const IconUpload = ({ size }) => ic(<><path d="M12 21V9" /><path d="m7 12 5-5 5 5" /><path d="M21 3H3" /></>, size);
export const IconInbox = ({ size = 22 }) => ic(<><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></>, size);
export const IconCheck = ({ size }) => ic(<path d="m20 6-11 11-5-5" />, size);
export const IconAlert = ({ size }) => ic(<><path d="M10.3 3.2 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>, size);
export const IconEye = ({ size }) => ic(<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>, size);
export const IconGlobe = ({ size }) => ic(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>, size);
export const IconFlame = ({ size }) => ic(<path d="M12 22c4 0 7-2.7 7-6.5 0-4.5-4-6-4-9.5 0 0-3 1.5-3 5 0 1.5-1 2-1.5 1.2C10 11 9.5 9.5 9.5 8 7 10 5 12.4 5 15.5 5 19.3 8 22 12 22Z" />, size);

/* ══════════════════════════════════════════════════════════════════════════
   HOOKS
   ══════════════════════════════════════════════════════════════════════════ */

/** Polls a loader while the tab is visible. Returns {data, loading, error, reload}. */
export function usePolling(loader, deps = [], intervalMs = 0) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const alive = useRef(true);

  const run = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const d = await loader();
      if (alive.current) { setData(d); setError(null); }
    } catch (e) {
      if (alive.current) setError(e.message || 'Failed to load');
    } finally {
      if (alive.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    alive.current = true;
    run();
    if (!intervalMs) return () => { alive.current = false; };
    const t = setInterval(() => { if (document.visibilityState === 'visible') run(true); }, intervalMs);
    return () => { alive.current = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, intervalMs]);

  return { data, loading, error, reload: run, setData };
}

/** Debounced value — used by every search box. */
export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/* Small helper so pages can show a metric with its own colour scale. */
export function rateTone(kind, value) {
  const v = Number(value || 0);
  if (kind === 'bounce')    return v >= 2 ? 'red' : v >= 1 ? 'yellow' : 'green';
  if (kind === 'complaint') return v >= 0.1 ? 'red' : v >= 0.05 ? 'yellow' : 'green';
  if (kind === 'deferral')  return v >= 8 ? 'red' : v >= 2 ? 'yellow' : 'green';
  if (kind === 'delivery')  return v >= 97 ? 'green' : v >= 92 ? 'yellow' : 'red';
  if (kind === 'open')      return v >= 20 ? 'green' : v >= 8 ? 'yellow' : 'slate';
  if (kind === 'click')     return v >= 3 ? 'green' : v >= 1 ? 'yellow' : 'slate';
  return 'slate';
}
