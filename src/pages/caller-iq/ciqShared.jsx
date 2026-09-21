import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import api from '../../api/axios';
import { nf, pctText, ripple } from '../netcore/analytics/maShared';

/*
 * Caller IQ — shared vocabulary, formatters and primitives.
 *
 * The page sits on the Messaging Analytics design system (maShared: .ma-* classes, ripple, count-up,
 * portalled popovers) so buttons, menus, drawers and tiles behave identically across the panel.
 * Everything specific to calls — types, outcomes, the heatmap, the modal — lives here.
 */

export const API = '/api/caller-iq/caller_iq.php';

export async function ciq(action, body = {}) {
  const r = await api.post(API, { action, ...body });
  if (!r.data?.success) throw new Error(r.data?.message || 'Request failed');
  return r.data.data;
}
export const errText = e => e?.response?.data?.message || e?.message || 'Something went wrong';

/* ── Request cache ─────────────────────────────────────────────────────────
   Nothing on this page refreshes itself. A request leaves the browser on exactly three
   occasions: the page is opened, a filter or page changes, or the refresh button is pressed.

   Every tab is a different read of the same call table and people move between them
   constantly, so a result is kept under its own (action + arguments) and served straight back
   from memory on the return trip — switching tabs costs nothing. Two components that happen to
   ask for the same thing at the same moment share one round trip instead of racing. */
const _cache = new Map();
const _inflight = new Map();
const _ckey = (action, body) => action + '|' + JSON.stringify(body);

/** Peek without fetching — lets a tab paint its last data on mount instead of a skeleton. */
export const ciqPeek = (action, body = {}) => _cache.get(_ckey(action, body));

/** Drop everything so the next read goes to the server (refresh button, or after a save). */
export function ciqInvalidate() { _cache.clear(); _inflight.clear(); }

export function ciqCached(action, body = {}, { force = false } = {}) {
  const k = _ckey(action, body);
  if (force) _cache.delete(k);
  if (!force && _cache.has(k)) return Promise.resolve(_cache.get(k));
  const dup = _inflight.get(k);
  if (dup) return dup;
  const p = ciq(action, body).then(
    d => { _cache.set(k, d); _inflight.delete(k); return d; },
    e => { _inflight.delete(k); throw e; },
  );
  _inflight.set(k, p);
  return p;
}

/* A phone number belongs to the same student all day, so it is resolved once and then never
   asked about again — paging through the log, or coming back to a tab, re-matches nothing.
   Deliberately survives a refresh: the roster is not what the refresh button is for. */
const _students = new Map();
export async function ciqMatchNumbers(numbers) {
  const uniq = [...new Set((numbers || []).filter(Boolean))];
  const want = uniq.filter(n => !_students.has(n));
  if (want.length) {
    const got = (await ciq('match_numbers', { numbers: want })).students || {};
    want.forEach(n => _students.set(n, got[n] || null));
  }
  const out = {};
  uniq.forEach(n => { const s = _students.get(n); if (s) out[n] = s; });
  return out;
}

/* ── Vocabulary ────────────────────────────────────────────────────────────
   Colors validated as a categorical set (light surface, CVD-separated) in this stack order.
   Missed and rejected keep their warm hues everywhere: in tiles, pies, bars and badges alike. */
export const TYPES = [
  { key: 'OUTGOING', label: 'Outgoing', color: '#4f46e5', bg: '#eef2ff', fg: '#4338ca' },
  { key: 'INCOMING', label: 'Incoming', color: '#059669', bg: '#ecfdf5', fg: '#047857' },
  { key: 'MISSED',   label: 'Missed',   color: '#ef4444', bg: '#fef2f2', fg: '#b91c1c' },
  { key: 'REJECTED', label: 'Rejected', color: '#f59e0b', bg: '#fffbeb', fg: '#b45309' },
  { key: 'BLOCKED',  label: 'Blocked',  color: '#94a3b8', bg: '#f1f5f9', fg: '#475569' },
  { key: 'VOICEMAIL', label: 'Voicemail', color: '#94a3b8', bg: '#f1f5f9', fg: '#475569' },
  { key: 'UNKNOWN',  label: 'Other',    color: '#94a3b8', bg: '#f1f5f9', fg: '#475569' },
];
export const TYPE = Object.fromEntries(TYPES.map(t => [t.key, t]));
export const MAIN_TYPES = TYPES.slice(0, 4);

/* The seven one-tap dispositions the Android app offers, in validated color order. */
export const OUTCOMES = [
  { key: 'Interested',         color: '#059669' },
  { key: 'Enrolled',           color: '#7c3aed' },
  { key: 'Callback Scheduled', color: '#d97706' },
  { key: 'Resolved',           color: '#0891b2' },
  { key: 'Not Answering',      color: '#dc2626' },
  { key: 'Course Query',       color: '#4f46e5' },
  { key: 'Escalated to Tech',  color: '#db2777' },
];
const OUTCOME_COLOR = Object.fromEntries(OUTCOMES.map(o => [o.key, o.color]));
export const outcomeColor = o => (!o ? '#cbd5e1' : OUTCOME_COLOR[o] || '#64748b');

/*
 * How the phone worked out which SIM a call used (app v1.3+). The call log only stores an
 * OEM-specific phone-account id, so the app resolves it and says which evidence it used —
 * a SIM label can then be trusted or questioned instead of taken on faith.
 */
export const SIM_SOURCES = {
  telecom: { label: 'Phone account', hint: 'Matched through Android telecom — exact', good: true },
  account: { label: 'Phone account', hint: 'Matched through Android telecom — exact', good: true },
  exact: { label: 'Phone account', hint: 'Android’s own telephony matched the call to the SIM card — exact', good: true },
  label: { label: 'SIM name', hint: 'The call’s phone account carries this SIM’s name, colour or number — and no other SIM’s', good: true },
  oem: { label: 'Maker’s column', hint: 'The phone maker’s own SIM column in the call log', good: true },
  subid: { label: 'Subscription id', hint: 'The call log stored the subscription id', good: true },
  iccid: { label: 'SIM ICCID', hint: 'Matched on the SIM serial', good: true },
  live: { label: 'Live capture', hint: 'The SIM that was busy while the call was connected', good: true },
  learned: { label: 'Remembered', hint: 'This phone account resolved to this slot before', good: true },
  slot: { label: 'Slot number', hint: 'The call log stored the slot itself', good: true },
  single: { label: 'Only SIM', hint: 'This phone has one active SIM', good: true },
  app: { label: 'Set in app', hint: 'Sent when the call was re-tagged in the app', good: true },
  unknown: { label: 'Not identified', hint: 'Nothing could identify the SIM for this call', good: false },
  legacy: { label: 'Older app build', hint: 'Synced before SIM detection shipped', good: false },
};
export const simSourceText = s => SIM_SOURCES[s] || SIM_SOURCES.legacy;

/** "SIM 2 · Airtel" — or an honest "Unknown SIM" when the phone could not tell. */
export const simText = row => {
  if (!row?.sim_slot) return 'Unknown SIM';
  return row.sim_label || `SIM ${row.sim_slot}`;
};

/** Where an outcome tag came from. */
export const TAG_VIA = {
  popup: 'Post-call popup',
  notification: 'Post-call notification',
  app: 'Caller IQ app',
  device: 'On the phone',
  panel: 'This panel',
};
export const tagOriginText = row => {
  if (!row?.outcome) return '';
  if (String(row.outcome_source || '').startsWith('admin')) return TAG_VIA.panel;
  return TAG_VIA[row.tagged_via] || TAG_VIA[row.outcome_source] || 'On the phone';
};

/** "to" for a call we placed, "from" for one we received — read against the counselor's phone. */
export const directionWord = type => (String(type).startsWith('OUTGOING') ? 'to' : 'from');

/**
 * Who ended the call, but only where Android actually says so.
 *
 * The call log records the TYPE of a call, and for some types that settles it: REJECTED means the
 * person holding this phone declined it, MISSED means it rang out and the caller gave up. For a
 * call that connected, Android gives an ordinary app no disconnect cause at all — so rather than
 * guess, this returns null and the column stays empty. Only the default phone app is told more.
 */
export function endedBy(row) {
  const type = String(row?.call_type || '');
  const connected = Number(row?.duration_sec || 0) > 0;
  if (type.startsWith('REJECTED')) return { short: 'declined here', long: 'Declined on the counselor’s phone', by: 'us' };
  if (type.startsWith('BLOCKED')) return { short: 'blocked', long: 'Blocked by the phone', by: 'us' };
  if (type.startsWith('MISSED')) return { short: 'rang out', long: 'Nobody answered — the caller rang off', by: 'them' };
  if (type.startsWith('OUTGOING') && !connected) return { short: 'no answer', long: 'No answer from the other side', by: 'them' };
  // A call that connected: Android does not tell an ordinary app which end hung up.
  return null;
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DURATION_BUCKETS = ['Not connected', '1–30s', '31–60s', '1–3 min', '3–5 min', '5–10 min', '10 min+'];

/* ── Formatters ────────────────────────────────────────────────────────── */
export function fmtDur(sec) {
  const s = Math.round(Number(sec || 0));
  if (s <= 0) return '0s';
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return r ? `${m}m ${r}s` : `${m}m`;
  return `${r}s`;
}
/** One call's length: "2s", "45s" under a minute; "02:04" from a minute; "1:02:04" from an hour. */
export const fmtClock = sec => {
  const s = Math.max(0, Math.round(Number(sec || 0)));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60;
  const two = n => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(r)}` : `${two(m)}:${two(r)}`;
};
export const toDate = s => (s ? new Date(String(s).replace(' ', 'T')) : null);

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const t12 = d => `${(d.getHours() % 12) || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'am' : 'pm'}`;
export function fmtWhen(s) {
  const d = toDate(s); if (!d || Number.isNaN(d.getTime())) return '—';
  const today = new Date(); const y = new Date(); y.setDate(y.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, today)) return `Today, ${t12(d)}`;
  if (same(d, y)) return `Yesterday, ${t12(d)}`;
  return `${d.getDate()} ${MON[d.getMonth()]}${d.getFullYear() !== today.getFullYear() ? ` ${d.getFullYear()}` : ''}, ${t12(d)}`;
}
export function fmtAgo(s) {
  const d = toDate(s); if (!d || Number.isNaN(d.getTime())) return 'never';
  const sec = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 7 * 86400) return `${Math.floor(sec / 86400)}d ago`;
  return `${d.getDate()} ${MON[d.getMonth()]}`;
}
/** Indian numbers read as +91 98765 43210; anything else is shown as dialled. */
export function fmtPhone(n) {
  const raw = String(n || '');
  const d = raw.replace(/\D/g, '');
  if (!d || d.length < 5) return raw === 'UNKNOWN' || /^-\d$/.test(raw) ? 'Private number' : raw || '—';
  const ten = d.length > 10 ? d.slice(-10) : d;
  if (ten.length === 10 && (d.length === 10 || d.startsWith('91') || d.startsWith('0'))) return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
  return raw;
}
export const telHref = n => `tel:${String(n || '').replace(/[^\d+]/g, '')}`;
export const waHref = norm => `https://wa.me/${norm && norm.length === 10 ? `91${norm}` : norm}`;

/** Percent change, or null when there is nothing to compare against. */
export const delta = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? null : 0);

const AVATAR = ['#4f46e5', '#059669', '#d97706', '#0891b2', '#7c3aed', '#db2777', '#0f766e', '#b45309'];
export const avatarColor = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AVATAR[h % AVATAR.length]; };
export const initials = s => String(s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

/* ── Icons ─────────────────────────────────────────────────────────────── */
const sv = (children, size = 15, sw = 2.2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
export const Ic = {
  phone: s => sv(<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />, s),
  OUTGOING: s => sv(<><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>, s, 2.4),
  INCOMING: s => sv(<><path d="M17 7 7 17" /><path d="M16 17H7V8" /></>, s, 2.4),
  MISSED: s => sv(<><path d="m3 7 6 6 4-4 8 8" /><path d="M21 11v6h-6" /></>, s, 2.4),
  REJECTED: s => sv(<><circle cx="12" cy="12" r="9" /><path d="m5.7 5.7 12.6 12.6" /></>, s, 2.2),
  OTHER: s => sv(<><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></>, s, 2.2),
  refresh: cls => <svg className={cls} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" /><path d="M21 3v5h-5" /></svg>,
  search: sv(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>, 14),
  filter: sv(<path d="M3 5h18l-7 8.5V19l-4 2v-7.5z" />, 14),
  cal: sv(<><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M8 3v3M16 3v3" /></>, 14),
  caret: <svg className="car" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>,
  tick: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>,
  x: sv(<path d="M18 6 6 18M6 6l12 12" />, 16, 2.4),
  arrow: sv(<path d="M5 12h14M13 6l6 6-6 6" />, 14),
  edit: sv(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>, 14),
  copy: sv(<><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>, 14),
  download: sv(<><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></>, 14),
  link: sv(<><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>, 14),
  user: sv(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>, 14),
  ext: sv(<><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></>, 10, 2.6),
  clock: sv(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, 14),
  alert: sv(<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />, 15),
  bookmark: sv(<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />, 14),
  wa: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.48-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.8h-.02a9.8 9.8 0 0 1-4.99-1.37l-.36-.21-3.71.97.99-3.62-.23-.37a9.79 9.79 0 0 1-1.5-5.22c0-5.41 4.4-9.81 9.82-9.81a9.75 9.75 0 0 1 6.94 2.88 9.74 9.74 0 0 1 2.87 6.94c0 5.41-4.4 9.81-9.81 9.81" /></svg>,
};
export const typeIcon = (t, s = 13) => (Ic[t] || Ic.OTHER)(s);

/* ── Small components ──────────────────────────────────────────────────── */

export function TypeBadge({ type, compact }) {
  const t = TYPE[type] || TYPE.UNKNOWN;
  return (
    <span className="ciq-type" style={{ background: t.bg, color: t.fg }} title={t.label}>
      {typeIcon(type, 12)}{!compact && t.label}
    </span>
  );
}

export function OutcomePill({ outcome, onClick }) {
  const c = outcomeColor(outcome);
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag className={`ciq-outcome${onClick ? ' ma-rip' : ''}`} data-empty={outcome ? undefined : '1'} style={{ '--c': c }}
         onClick={onClick} onPointerDown={onClick ? ripple : undefined} type={onClick ? 'button' : undefined}>
      <i />{outcome || 'Untagged'}
    </Tag>
  );
}

/*
 * The panel's global search (the navbar box) is /search_result?q=… and matches a user id, an email
 * or a phone EXACTLY — never a partial. So a matched student is searched by the email `users`
 * holds, and an unmatched number by the number as dialled. Opens in a new tab: nobody wants to
 * lose the call they are looking at.
 */
export const globalSearchUrl = q => `/search_result?q=${encodeURIComponent(q)}`;

export function StudentChip({ student, number, canSearch = true, style }) {
    const q = student ? (student.email || student.phone || number) : number;
    const text = student ? (student.name || student.email) : `Search ${fmtPhone(number)}`;
    const title = student
        ? `${student.name || ''}${student.email ? ` · ${student.email}` : ''} — open in global search`
        : 'Search this number in the panel';
    if (!canSearch || !q) {
        return <span className="ciq-student" style={style} title={student?.email}>{Ic.user}{text}</span>;
    }
    return (
        <a className="ciq-student" style={style} href={globalSearchUrl(q)} target="_blank" rel="noreferrer"
           title={title} onClick={e => e.stopPropagation()}>
            {Ic.user}{text}{Ic.ext}
        </a>
    );
}

export const Avatar = ({ name, size = 30 }) => (
  <span className="ciq-avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: avatarColor(name) }}>{initials(name)}</span>
);

export function Delta({ cur, prev, invert, suffix = '' }) {
  const d = delta(cur, prev);
  if (d === null) return <span className="ciq-delta" data-new="1" title="Nothing in the previous period">new</span>;
  if (!Number.isFinite(d) || Math.abs(d) < 0.5) return <span className="ciq-delta" title="Same as the previous period">±0%{suffix}</span>;
  const good = invert ? d < 0 : d > 0;
  return (
    <span className="ciq-delta" data-good={good ? '1' : '0'} title={`vs previous period: ${nf(prev)}`}>
      {d > 0 ? '▲' : '▼'} {Math.abs(d) >= 100 ? Math.round(Math.abs(d)) : Math.abs(d).toFixed(Math.abs(d) < 10 ? 1 : 0)}%{suffix}
    </span>
  );
}

export const StatusDot = ({ status }) => (
  <span className="ciq-status" data-s={status} title={{ online: 'Synced in the last 3 hours', idle: 'Last sync within 2 days', offline: 'No sync for over 2 days' }[status]}>
    <i />{{ online: 'Active', idle: 'Idle', offline: 'Offline' }[status] || status}
  </span>
);

export function Sparkline({ data, color = '#4f46e5', width = 110, height = 30 }) {
  if (!data?.length) return null;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - 3 - (v / max) * (height - 6)).toFixed(1)}`);
  const id = `sp${color.slice(1)}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="ciq-spark" aria-hidden="true">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".28" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`M0,${height} L${pts.join(' L')} L${width},${height} Z`} fill={`url(#${id})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Donut with its legend beside it (not below), so a pie costs one short row of screen. Hovering a
 * slice or legend row swaps the centre label; clicking either calls onPick with the row.
 */
export function SideDonut({ data, centerLabel = 'Total', size = 150, format = nf, emptyText = 'No data', onPick, active }) {
  const [hover, setHover] = useState(null);
  const rows = data.filter(d => d.value > 0);
  const total = rows.reduce((a, d) => a + d.value, 0);
  const cur = hover != null ? rows[hover] : null;
  if (!total) return <div className="ciq-donut-empty">{emptyText}</div>;
  return (
    <div className="ciq-donut">
      <div className="ciq-donut-chart" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="label" innerRadius="66%" outerRadius="96%" paddingAngle={rows.length > 1 ? 2 : 0}
                 stroke="#fff" strokeWidth={2} isAnimationActive animationDuration={700}
                 onMouseLeave={() => setHover(null)} onMouseEnter={(_, i) => setHover(i)} onClick={(_, i) => onPick?.(rows[i])}>
              {rows.map((d, i) => (
                <Cell key={d.key ?? d.label} fill={d.color} style={{ cursor: onPick ? 'pointer' : 'default', transition: 'opacity .18s', outline: 'none' }}
                      opacity={(hover == null || hover === i) && (!active || active === d.key) ? 1 : 0.35} />
              ))}
            </Pie>
            <Tooltip content={() => null} />
          </PieChart>
        </ResponsiveContainer>
        <div className="ma-donut-center" style={{ padding: '0 16%' }}>
          <b style={{ fontSize: 19 }}>{format(cur ? cur.value : total)}</b>
          <span>{cur ? pctText(cur.value, total) : centerLabel}</span>
        </div>
      </div>
      <ul className="ma-legend ciq-legend">
        {rows.map((d, i) => (
          <li key={d.key ?? d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              data-dim={hover != null && hover !== i ? '1' : undefined} data-click={onPick ? '1' : undefined} onClick={() => onPick?.(d)}>
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

/** Weekday × hour grid, one indigo ramp light → dark. Hover for the numbers, click to filter. */
export function Heatmap({ cells, onPick }) {
  const [tip, setTip] = useState(null);
  const grid = {}; let max = 0;
  for (const c of cells || []) { grid[`${c.d}-${c.h}`] = c; max = Math.max(max, c.n); }
  const shade = n => {
    if (!n) return '#f1f5f9';
    const t = Math.pow(n / max, 0.7);
    // #e0e7ff → #3730a3 along the indigo ramp
    const a = [224, 231, 255]; const b = [55, 48, 163];
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
  };
  return (
    <div className="ciq-heat" onMouseLeave={() => setTip(null)}>
      <div className="ciq-heat-grid">
        <span />
        {Array.from({ length: 24 }, (_, h) => <span key={h} className="hh">{h % 3 === 0 ? `${(h % 12) || 12}${h < 12 ? 'a' : 'p'}` : ''}</span>)}
        {WEEKDAYS.map((w, d) => (
          <div key={w} style={{ display: 'contents' }}>
            <span className="dd">{w}</span>
            {Array.from({ length: 24 }, (_, h) => {
              const c = grid[`${d}-${h}`];
              return (
                <button key={h} type="button" className="cell" style={{ background: shade(c?.n || 0) }}
                        onMouseEnter={e => { const r = e.currentTarget.getBoundingClientRect(); setTip({ x: r.left + r.width / 2, y: r.top, d, h, c }); }}
                        onClick={() => c && onPick?.(d, h)} aria-label={`${w} ${h}:00 — ${c?.n || 0} calls`} />
              );
            })}
          </div>
        ))}
      </div>
      <div className="ciq-heat-scale"><span>Fewer</span>{[0.08, 0.3, 0.55, 0.8, 1].map(t => <i key={t} style={{ background: shade(Math.max(1, t * max)) }} />)}<span>More</span></div>
      {tip && createPortal(
        <div className="ma-portal">
          <div className="ma-tip" style={{ position: 'fixed', left: Math.min(tip.x - 90, window.innerWidth - 200), top: tip.y - 8, transform: 'translateY(-100%)', zIndex: 2100, pointerEvents: 'none' }}>
            <b>{WEEKDAYS[tip.d]} · {(tip.h % 12) || 12}{tip.h < 12 ? ' am' : ' pm'} – {((tip.h + 1) % 12) || 12}{tip.h + 1 < 12 || tip.h === 23 ? ' am' : ' pm'}</b>
            <div className="r"><i style={{ background: '#4f46e5' }} /><span>Calls</span>{nf(tip.c?.n || 0)}</div>
            <div className="r"><i style={{ background: '#059669' }} /><span>Connected</span>{nf(tip.c?.connected || 0)}</div>
            <div className="r"><i style={{ background: '#ef4444' }} /><span>Missed / rejected</span>{nf(tip.c?.missed || 0)}</div>
          </div>
        </div>, document.body)}
    </div>
  );
}

/* ── Overlays ──────────────────────────────────────────────────────────── */

/** Animated close: flag closing, let the exit animation run, then unmount. */
function useClosing(onClose, ms = 220) {
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => { setClosing(true); setTimeout(onClose, ms); }, [onClose, ms]);
  return [closing, close];
}

function useEscape(fn) {
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') fn(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [fn]);
}

/** Right-hand drawer (MUI Drawer / Chakra Drawer behaviour: scrim, slide, Esc, scroll lock). */
export function Drawer({ onClose, width = 820, header, children, footer }) {
  const [closing, close] = useClosing(onClose, 230);
  useEscape(close);
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o; }; }, []);
  return createPortal(
    <div className="ma-portal ciq-portal">
      <div className="ma-scrim" data-closing={closing ? '1' : undefined} onClick={close} />
      <aside className="ma-drawer" role="dialog" aria-modal="true" data-closing={closing ? '1' : undefined} style={{ width: `min(${width}px, 100vw)` }}>
        <div className="ma-drawer-h" style={{ paddingBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>{typeof header === 'function' ? header(close) : header}</div>
          <button className="ma-x" onClick={close} aria-label="Close">{Ic.x}</button>
        </div>
        <div className="ma-drawer-b">{typeof children === 'function' ? children(close) : children}</div>
        {footer && <div className="ciq-drawer-f">{typeof footer === 'function' ? footer(close) : footer}</div>}
      </aside>
    </div>,
    document.body,
  );
}

/** Centred modal dialog with a scale-in / scale-out (Chakra Modal, MUI Dialog). */
export function Modal({ onClose, title, sub, width = 480, children, footer }) {
  const [closing, close] = useClosing(onClose, 180);
  const box = useRef(null);
  useEscape(close);
  useEffect(() => { box.current?.querySelector('input, select, textarea, button.primary')?.focus(); }, []);
  return createPortal(
    <div className="ma-portal ciq-portal">
      <div className="ma-scrim" style={{ zIndex: 2200 }} data-closing={closing ? '1' : undefined} onClick={close} />
      <div className="ciq-modal-wrap">
        <div ref={box} className="ciq-modal" role="dialog" aria-modal="true" data-closing={closing ? '1' : undefined} style={{ width: `min(${width}px, calc(100vw - 32px))` }}>
          <div className="ciq-modal-h">
            <div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>
            <button className="ma-x" onClick={close} aria-label="Close">{Ic.x}</button>
          </div>
          <div className="ciq-modal-b">{typeof children === 'function' ? children(close) : children}</div>
          {footer && <div className="ciq-modal-f">{typeof footer === 'function' ? footer(close) : footer}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── CSS (on top of maShared's .ma-* system) ───────────────────────────── */
export const CIQ_CSS = `
.ciq, .ciq *, .ciq-portal * { box-sizing:border-box; }
.ciq { max-width:1760px; padding:14px 22px 30px; }
@media (max-width:720px){ .ciq { padding:12px 12px 24px; } }
.ciq .ma-sticky { margin:0 -22px 12px; padding:8px 22px 10px; }
@media (max-width:720px){ .ciq .ma-sticky { margin:0 -12px 10px; padding:8px 12px; } }

/* title bar with tabs */
.ciq-top { display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin-bottom:6px; }
.ciq-brand { display:flex; align-items:center; gap:10px; min-width:0; }
.ciq-logo { width:34px; height:34px; border-radius:10px; display:grid; place-items:center; color:#fff; flex:none;
  background:linear-gradient(135deg,#4f46e5,#0891b2); box-shadow:0 6px 16px rgba(79,70,229,.3); }
.ciq-brand h1 { margin:0; font-size:17px; font-weight:800; letter-spacing:-.02em; line-height:1.15; }
.ciq-brand p { margin:1px 0 0; font-size:11.5px; color:var(--mute); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ciq-tabs { display:inline-flex; gap:2px; padding:3px; background:#eef0f7; border-radius:11px; margin-left:8px; }
.ciq-tabs button { position:relative; overflow:hidden; display:inline-flex; align-items:center; gap:7px; border:0; background:none; padding:7px 13px;
  border-radius:8px; font-weight:600; font-size:12.5px; font-family:inherit; color:var(--mute); cursor:pointer; transition:color .18s, background .18s, box-shadow .2s; }
.ciq-tabs button:hover { color:var(--ink); }
.ciq-tabs button[data-on] { background:#fff; color:var(--brand); box-shadow:0 1px 3px rgba(15,23,42,.14), 0 0 0 1px rgba(15,23,42,.04); }
.ciq-tabs button .n { font-size:10.5px; padding:2px 6px; border-radius:999px; background:#e2e8f0; color:var(--ink2); font-variant-numeric:tabular-nums; }
.ciq-tabs button[data-on] .n { background:#e0e7ff; color:var(--brand); }
.ciq-top-r { margin-left:auto; display:flex; align-items:center; gap:8px; }
.ciq-sync { display:inline-flex; align-items:center; gap:6px; height:30px; padding:0 10px; border-radius:999px; background:#fff; border:1px solid var(--line);
  font-size:11.5px; color:var(--mute); white-space:nowrap; font-variant-numeric:tabular-nums; }
.ciq-sync i { width:7px; height:7px; border-radius:50%; background:#10b981; box-shadow:0 0 0 0 rgba(16,185,129,.5); animation:ciq-pulse 2s infinite; }
.ciq-sync[data-stale] i { background:#f59e0b; animation:none; }
@keyframes ciq-pulse { 0% { box-shadow:0 0 0 0 rgba(16,185,129,.45); } 70% { box-shadow:0 0 0 7px rgba(16,185,129,0); } 100% { box-shadow:0 0 0 0 rgba(16,185,129,0); } }
.ciq .ma-btn.sm { height:30px; padding:0 11px; font-size:12px; border-radius:8px; }

/* ── Live now ─────────────────────────────────────────────────────────── */
.ciq-live { margin:0 0 10px; padding:9px 12px; background:#fff; border:1px solid var(--line); border-radius:14px;
  box-shadow:0 1px 2px rgba(15,23,42,.04); animation:ma-fade .35s var(--ease) both; }
.ciq-live[data-empty] { padding:7px 12px; background:rgba(255,255,255,.7); }
.ciq-live-head { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--mute); }
.ciq-live-head b { font-size:11px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; color:var(--ink2); }
.ciq-live-dot { width:8px; height:8px; border-radius:50%; background:#cbd5e1; flex:none; }
.ciq-live-dot[data-on] { background:#ef4444; animation:ciq-live-pulse 1.8s infinite; }
.ciq-live-dot[data-err] { background:#f59e0b; animation:none; }
@keyframes ciq-live-pulse { 0% { box-shadow:0 0 0 0 rgba(239,68,68,.5); } 70% { box-shadow:0 0 0 8px rgba(239,68,68,0); } 100% { box-shadow:0 0 0 0 rgba(239,68,68,0); } }
.ciq-live-sum { font-weight:650; color:var(--ink2); font-variant-numeric:tabular-nums; }
.ciq-live-hint { font-size:10.5px; color:var(--faint); white-space:nowrap; }
.ciq-live-actions { margin-left:auto; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
/* Live calls are fetched on request, so the strip carries the button that does it. */
.ciq-live-cta { position:relative; overflow:hidden; display:inline-flex; align-items:center; gap:7px; height:28px; padding:0 13px;
  border:1px solid #c7d2fe; border-radius:999px; background:#eef2ff; font-weight:700; font-size:12px; font-family:inherit; color:#4338ca;
  cursor:pointer; white-space:nowrap; transition:background .18s, border-color .18s, box-shadow .2s, transform .12s; }
.ciq-live-cta:hover { background:#e0e7ff; border-color:#a5b4fc; box-shadow:0 4px 12px rgba(79,70,229,.18); }
.ciq-live-cta:active { transform:scale(.97); }
.ciq-live-cta:disabled { opacity:.65; cursor:progress; }
.ciq-live-cta svg.spin { animation:ma-spin .8s linear infinite; }
.ciq-live-row { display:flex; gap:10px; margin-top:9px; overflow-x:auto; padding-bottom:2px; scrollbar-width:thin; }
.ciq-live-row::-webkit-scrollbar { height:6px; }

.ciq-live-card { position:relative; overflow:hidden; flex:0 0 302px; max-width:302px; text-align:left; font-family:inherit;
  background:#fff; border:1px solid var(--line); border-radius:13px; padding:10px 12px 9px; cursor:pointer;
  transition:border-color .18s, box-shadow .22s var(--ease), transform .18s var(--ease); animation:ciq-live-in .3s var(--ease) both; }
@keyframes ciq-live-in { from { opacity:0; transform:translateY(-6px) scale(.97); } }
.ciq-live-card:hover { transform:translateY(-2px); box-shadow:0 10px 26px rgba(15,23,42,.1); border-color:#c7d2fe; }
.ciq-live-card:active { transform:scale(.99); }
.ciq-live-card.no-click { cursor:default; }
.ciq-live-card.no-click:hover { transform:none; box-shadow:none; border-color:var(--line); }
.ciq-live-card[data-state="ringing"] { border-color:#fcd34d; background:linear-gradient(180deg,#fffdf5,#fff); }
.ciq-live-card[data-state="connected"] { border-color:#a7f3d0; background:linear-gradient(180deg,#f6fffb,#fff); }
.ciq-live-card[data-state="ended"] { opacity:.62; }
.ciq-live-card[data-stale] { border-style:dashed; }
.ciq-live-card::after { content:''; position:absolute; left:0; right:0; top:0; height:2px; background:transparent; }
.ciq-live-card[data-state="ringing"]::after { background:linear-gradient(90deg,#f59e0b,#fcd34d,#f59e0b); background-size:200% 100%; animation:ciq-live-scan 1.6s linear infinite; }
.ciq-live-card[data-state="connected"]::after { background:linear-gradient(90deg,#059669,#6ee7b7,#059669); background-size:200% 100%; animation:ciq-live-scan 2.6s linear infinite; }
/* Outgoing, still dialling: indigo, and three dots where a timer would be — there is no talk time
   to show until the call ends. */
.ciq-live-card[data-dialling] { border-color:#c7d2fe; background:linear-gradient(180deg,#f7f8ff,#fff); }
.ciq-live-card[data-dialling]::after { background:linear-gradient(90deg,#4f46e5,#a5b4fc,#4f46e5); background-size:200% 100%; animation:ciq-live-scan 1.9s linear infinite; }
.ciq-live-dialing { display:inline-flex; align-items:center; gap:3px; height:17px; }
.ciq-live-dialing i { width:5px; height:5px; border-radius:50%; background:#4f46e5; animation:ciq-dial 1.1s infinite ease-in-out; }
.ciq-live-dialing i:nth-child(2) { animation-delay:.16s; }
.ciq-live-dialing i:nth-child(3) { animation-delay:.32s; }
@keyframes ciq-dial { 0%,80%,100% { opacity:.25; transform:translateY(0); } 40% { opacity:1; transform:translateY(-2px); } }
@keyframes ciq-live-scan { from { background-position:0 0; } to { background-position:200% 0; } }

.ciq-live-state { display:inline-flex; align-items:center; gap:5px; height:19px; padding:0 8px; border-radius:999px;
  font-size:10px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; }
.ciq-live-state i { width:6px; height:6px; border-radius:50%; background:currentColor; animation:ciq-live-blink 1.4s infinite; }
@keyframes ciq-live-blink { 0%,100% { opacity:1; } 50% { opacity:.25; } }
.ciq-live-card[data-state="ended"] .ciq-live-state i { animation:none; }
.ciq-live-main { display:flex; align-items:center; gap:9px; margin-top:7px; }
.ciq-live-dir { width:26px; height:26px; border-radius:8px; display:grid; place-items:center; flex:none; }
.ciq-live-num { display:block; font-size:14.5px; font-weight:750; color:var(--ink); font-variant-numeric:tabular-nums;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ciq-live-meta { margin-top:2px; font-size:11px; color:var(--faint); display:flex; align-items:center; gap:6px; min-width:0; }
.ciq-live-meta > span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ciq-live-foot { display:flex; align-items:center; gap:8px; margin-top:8px; padding-top:7px; border-top:1px solid #f1f5f9; font-size:11px; color:var(--mute); }
.ciq-live-foot .who { display:inline-flex; align-items:center; gap:5px; min-width:0; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ciq-live-foot .who .dirword { font-style:normal; color:var(--faint); font-weight:600; }
.ciq-live-foot .sim { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; }
.ciq-live-foot .time { margin-left:auto; display:flex; flex-direction:column; align-items:flex-end; font-weight:800; font-size:13px;
  color:var(--ink); font-variant-numeric:tabular-nums; flex:none; line-height:1.15; }
.ciq-live-foot .time em { font-style:normal; font-weight:600; font-size:9.5px; letter-spacing:.05em; text-transform:uppercase; color:var(--faint); }
.ciq-live-tag { display:inline-block; margin-top:6px; font-size:10.5px; color:var(--faint); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }
.ciq-live-stale { display:block; margin-top:4px; font-size:10.5px; color:#b45309; }

/* filter row */
.ciq-searchbox { position:relative; flex:0 1 230px; min-width:160px; }
.ciq-searchbox svg { position:absolute; left:9px; top:50%; transform:translateY(-50%); color:var(--faint); pointer-events:none; }
.ciq-searchbox input { width:100%; height:30px; padding:0 26px 0 30px; border:1px solid var(--line); border-radius:8px; background:#fff;
  font-weight:500; font-size:12px; font-family:inherit; color:var(--ink); transition:border-color .15s, box-shadow .15s; }
.ciq-searchbox input:hover { border-color:#cbd5e1; }
.ciq-searchbox input:focus { outline:0; border-color:#818cf8; box-shadow:0 0 0 3px rgba(99,102,241,.16); }
.ciq-searchbox .clr { position:absolute; right:4px; top:50%; transform:translateY(-50%); width:22px; height:22px; border:0; border-radius:6px; background:none; color:var(--faint); cursor:pointer; display:grid; place-items:center; }
.ciq-searchbox .clr:hover { background:#f1f5f9; color:var(--ink); }
.ciq-badge { display:inline-grid; place-items:center; min-width:17px; height:17px; padding:0 5px; border-radius:999px; background:var(--brand); color:#fff; font-size:10px; font-weight:800; }
/* Reset: deliberately the loudest control on the bar while a filter is on. A page quietly showing
   a subset is the single easiest way to misread this dashboard. */
.ciq-reset { position:relative; overflow:hidden; display:inline-flex; align-items:center; gap:6px; height:30px; padding:0 11px; flex:none;
  border:1px solid #fca5a5; border-radius:8px; background:#fef2f2; font-weight:700; font-size:12px; font-family:inherit; color:#b91c1c;
  cursor:pointer; white-space:nowrap; transition:background .16s, border-color .16s, box-shadow .2s; }
.ciq-reset:hover { background:#fee2e2; border-color:#f87171; box-shadow:0 3px 10px rgba(239,68,68,.22); }
.ciq-reset svg { width:12px; height:12px; }
.ciq-reset .n { display:inline-grid; place-items:center; min-width:17px; height:17px; padding:0 5px; border-radius:999px; background:#b91c1c; color:#fff; font-size:10px; }

.ciq-chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:7px; align-items:center; }
.ciq-chips[data-on] { padding:7px 9px; margin-top:8px; border-radius:10px; background:#fffbeb; border:1px solid #fde68a; }
.ciq-chips-lead { display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; color:#92400e; margin-right:2px; }
.ciq-chips-lead b { font-weight:800; }
.ciq-chips-lead svg { width:13px; height:13px; }
.ciq-chips-clear { margin-left:auto; border:0; background:none; font-weight:700; font-size:11.5px; font-family:inherit; color:#b45309;
  cursor:pointer; padding:3px 6px; border-radius:6px; text-decoration:underline; }
.ciq-chips-clear:hover { background:#fef3c7; }
.ciq-fchip { display:inline-flex; align-items:center; gap:5px; height:24px; padding:0 4px 0 9px; border-radius:999px; background:#eef2ff; border:1px solid #c7d2fe;
  font-size:11.5px; color:#3730a3; font-weight:600; animation:ma-pop .16s var(--ease); white-space:nowrap; }
.ciq-fchip em { font-style:normal; color:#6366f1; font-weight:500; }
.ciq-fchip button { width:18px; height:18px; border:0; border-radius:50%; background:transparent; color:#6366f1; display:grid; place-items:center; cursor:pointer; transition:background .15s; }
.ciq-fchip button:hover { background:#c7d2fe; color:#312e81; }
.ciq-fchip button svg { width:11px; height:11px; }

/* stat tiles */
.ciq .ma-stats { grid-template-columns:repeat(9, minmax(0, 1fr)); }
@media (max-width:1500px){ .ciq .ma-stats { grid-template-columns:repeat(5, minmax(0, 1fr)); } }
@media (max-width:820px){ .ciq .ma-stats { grid-template-columns:repeat(3, minmax(0, 1fr)); } }
@media (max-width:520px){ .ciq .ma-stats { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
.ciq .ma-stat .cs { justify-content:space-between; }
.ciq-delta { font-size:10.5px; font-weight:700; color:var(--faint); font-variant-numeric:tabular-nums; white-space:nowrap; }
.ciq-delta[data-good="1"] { color:#047857; } .ciq-delta[data-good="0"] { color:#b91c1c; } .ciq-delta[data-new] { color:#6366f1; }

/* grids that fill one screen */
.ciq-grid { display:grid; gap:12px; margin-bottom:12px; }
.ciq-r1 { grid-template-columns:minmax(0, 1.9fr) minmax(0, 1fr) minmax(0, 1fr); }
.ciq-r2 { grid-template-columns:minmax(0, 1.25fr) minmax(0, 1.45fr) minmax(0, 1fr); }
.ciq-r3 { grid-template-columns:repeat(3, minmax(0, 1fr)); }
@media (max-width:1280px){ .ciq-r1, .ciq-r2 { grid-template-columns:minmax(0, 1fr) minmax(0, 1fr); } .ciq-r1 > :first-child, .ciq-r2 > :first-child { grid-column:1 / -1; } }
@media (max-width:760px){ .ciq-r1, .ciq-r2, .ciq-r3 { grid-template-columns:minmax(0, 1fr); } }
.ciq .ma-card-h { padding:12px 14px 0; }
.ciq .ma-card-h h3 { font-size:13px; }
.ciq .ma-card-b { padding:10px 14px 14px; }
.ciq-card-fill { display:flex; flex-direction:column; }
.ciq-card-fill > .ma-card-b { flex:1; min-height:0; }

/* donut */
.ciq-donut { display:flex; align-items:center; gap:14px; min-height:150px; }
.ciq-donut-chart { position:relative; flex:none; }
.ciq-legend { flex:1; min-width:0; }
.ciq-legend li { padding:4px 6px; font-size:12px; }
.ciq-legend li[data-click] { cursor:pointer; }
.ciq-legend .p { width:40px; }
.ciq-donut-empty { height:150px; display:grid; place-items:center; color:var(--faint); font-size:12.5px; }
@media (max-width:420px){ .ciq-donut { flex-direction:column; } }

/* heatmap */
.ciq-heat-grid { display:grid; grid-template-columns:30px repeat(24, minmax(0, 1fr)); gap:3px; align-items:center; }
.ciq-heat-grid .hh { font-size:9.5px; color:var(--faint); text-align:left; white-space:nowrap; }
.ciq-heat-grid .dd { font-size:10.5px; color:var(--mute); font-weight:600; }
.ciq-heat-grid .cell { height:19px; border:0; border-radius:4px; padding:0; cursor:pointer; transition:transform .12s var(--ease), box-shadow .12s; }
.ciq-heat-grid .cell:hover { transform:scale(1.25); box-shadow:0 0 0 2px #fff, 0 4px 10px rgba(15,23,42,.25); position:relative; z-index:1; }
.ciq-heat-scale { display:flex; align-items:center; gap:4px; justify-content:flex-end; margin-top:8px; font-size:10.5px; color:var(--faint); }
.ciq-heat-scale i { width:16px; height:9px; border-radius:3px; }

/* compact lists */
.ciq-list { display:flex; flex-direction:column; }
.ciq-li { flex:none; position:relative; overflow:hidden; display:grid; grid-template-columns:auto minmax(0, 1fr) auto; gap:10px; align-items:center; width:100%; padding:7px 8px;
  border:0; border-radius:9px; background:none; font-family:inherit; text-align:left; cursor:pointer; transition:background .15s; }
.ciq-li:hover { background:#f5f7ff; }
.ciq-li + .ciq-li { box-shadow:0 -1px 0 #f1f5f9; }
.ciq-li b { display:block; font-size:12.5px; font-weight:650; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ciq-li small { display:block; font-size:11px; color:var(--faint); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:1px; }
.ciq-li .end { text-align:right; font-variant-numeric:tabular-nums; font-size:12px; color:var(--ink2); white-space:nowrap; }
.ciq-li .end small { text-align:right; }
.ciq-scroll { overflow-y:auto; overscroll-behavior:contain; }

/* leaderboard */
.ciq-lb { width:100%; border-collapse:collapse; font-size:12px; font-variant-numeric:tabular-nums; }
.ciq-lb th { font-size:9.5px; text-transform:uppercase; letter-spacing:.06em; color:var(--faint); font-weight:750; text-align:right; padding:0 6px 6px; white-space:nowrap; position:sticky; top:0; background:#fff; }
.ciq-lb th.l, .ciq-lb td.l { text-align:left; }
.ciq-lb td { padding:6px; text-align:right; border-top:1px solid #f1f5f9; white-space:nowrap; color:var(--ink2); }
.ciq-lb tbody tr { cursor:pointer; transition:background .15s; }
.ciq-lb tbody tr:hover { background:#f5f7ff; }
.ciq-lb .who { display:flex; align-items:center; gap:8px; min-width:0; max-width:190px; }
.ciq-lb .who b { font-weight:650; color:var(--ink); overflow:hidden; text-overflow:ellipsis; }
.ciq-stack { display:flex; height:6px; width:86px; margin-left:auto; border-radius:4px; overflow:hidden; background:#f1f5f9; gap:1px; }
.ciq-stack i { display:block; height:100%; transition:width .6s var(--ease); }

/* bars */
.ciq-bars { display:flex; flex-direction:column; gap:7px; }
.ciq-bar { display:grid; grid-template-columns:92px minmax(0, 1fr) 52px 40px; gap:8px; align-items:center; font-size:11.5px; }
.ciq-bar .lb { color:var(--mute); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ciq-bar .tr { height:9px; border-radius:5px; background:#f1f5f9; overflow:hidden; }
.ciq-bar .tr span { display:block; height:100%; border-radius:5px; transition:width .7s var(--ease); }
.ciq-bar .v { text-align:right; font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums; }
.ciq-bar .p { text-align:right; color:var(--faint); font-variant-numeric:tabular-nums; }
.ciq-bar[data-click] { cursor:pointer; border-radius:6px; transition:background .15s; }
.ciq-bar[data-click]:hover { background:#f5f7ff; }

/* badges */
.ciq-type { display:inline-flex; align-items:center; gap:4px; height:22px; padding:0 8px 0 6px; border-radius:6px; font-size:11px; font-weight:700; white-space:nowrap; }
.ciq-outcome { position:relative; overflow:hidden; display:inline-flex; align-items:center; gap:6px; height:24px; padding:0 10px; border-radius:999px; max-width:170px;
  border:1px solid color-mix(in srgb, var(--c) 35%, #fff); background:color-mix(in srgb, var(--c) 9%, #fff); color:var(--ink2);
  font-weight:600; font-size:11.5px; font-family:inherit; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ciq-outcome i { width:7px; height:7px; border-radius:50%; background:var(--c); flex:none; }
.ciq-outcome[data-empty] { border-style:dashed; border-color:#cbd5e1; background:#fff; color:var(--faint); }
button.ciq-outcome { cursor:pointer; transition:box-shadow .15s, border-color .15s, transform .12s; }
button.ciq-outcome:hover { border-color:var(--c); box-shadow:0 2px 8px color-mix(in srgb, var(--c) 25%, transparent); }
button.ciq-outcome[data-empty]:hover { border-color:#818cf8; color:var(--accent); }
button.ciq-outcome:active { transform:scale(.97); }
.ciq-avatar { display:inline-grid; place-items:center; border-radius:50%; color:#fff; font-weight:750; flex:none; letter-spacing:.02em; }
.ciq-status { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:650; color:var(--mute); }
.ciq-status i { width:7px; height:7px; border-radius:50%; background:#94a3b8; }
.ciq-status[data-s="online"] { color:#047857; } .ciq-status[data-s="online"] i { background:#10b981; animation:ciq-pulse 2s infinite; }
.ciq-status[data-s="idle"] { color:#b45309; } .ciq-status[data-s="idle"] i { background:#f59e0b; }
.ciq-pend { display:inline-flex; align-items:center; gap:4px; height:20px; padding:0 7px; border-radius:6px; background:#fef2f2; color:#b91c1c; font-size:10.5px; font-weight:750; white-space:nowrap; }
/* Phone setup — the chip on each Agents card and the checklist it opens. */
.ciq-setup { display:inline-flex; align-items:center; gap:5px; height:22px; margin-top:5px; padding:0 8px; border:0; border-radius:7px; font:inherit; font-size:10.5px; font-weight:750; white-space:nowrap; max-width:100%; overflow:hidden; text-overflow:ellipsis; cursor:pointer; transition:filter .15s, box-shadow .15s, transform .1s; }
.ciq-setup:hover { filter:brightness(.97); box-shadow:0 1px 3px rgba(15,23,42,.14); }
.ciq-setup:active { transform:scale(.97); }
.ciq-setup:focus-visible { outline:2px solid #6366f1; outline-offset:2px; }
.ciq-setup i { width:6px; height:6px; border-radius:50%; flex:none; }
.ciq-setup[data-tone="ok"] { background:#ecfdf5; color:#047857; } .ciq-setup[data-tone="ok"] i { background:#10b981; }
.ciq-setup[data-tone="warn"] { background:#fffbeb; color:#b45309; } .ciq-setup[data-tone="warn"] i { background:#f59e0b; }
.ciq-setup[data-tone="bad"] { background:#fef2f2; color:#b91c1c; } .ciq-setup[data-tone="bad"] i { background:#ef4444; }
.ciq-setup[data-tone="muted"] { background:#f1f5f9; color:#64748b; } .ciq-setup[data-tone="muted"] i { background:#cbd5e1; }
.ciq-checks { display:flex; flex-direction:column; gap:2px; margin:0 -4px; }
.ciq-check { display:flex; gap:10px; align-items:flex-start; padding:9px 8px; border-radius:10px; }
.ciq-check + .ciq-check { border-top:1px solid #f1f5f9; }
.ciq-check-dot { flex:none; width:22px; height:22px; border-radius:50%; display:grid; place-items:center; font-size:12px; font-weight:800; margin-top:1px; }
.ciq-check[data-s="done"] .ciq-check-dot, .ciq-check[data-s="confirmed"] .ciq-check-dot { background:#ecfdf5; color:#047857; }
.ciq-check[data-s="todo"] .ciq-check-dot { background:#fef2f2; color:#b91c1c; }
.ciq-check[data-s="unknown"] .ciq-check-dot { background:#fffbeb; color:#b45309; }
.ciq-check b { display:block; font-size:13px; font-weight:700; color:var(--ink); }
.ciq-check small { display:block; font-size:11.5px; color:#64748b; line-height:1.45; margin-top:2px; }
.ciq-check em { font-style:normal; font-size:10px; font-weight:700; letter-spacing:.02em; text-transform:uppercase; color:#94a3b8; margin-left:6px; }
.ciq-issue { display:flex; gap:9px; align-items:flex-start; padding:9px 11px; border-radius:10px; font-size:12px; line-height:1.45; }
.ciq-issue + .ciq-issue { margin-top:6px; }
.ciq-issue svg { flex:none; margin-top:2px; }
.ciq-issue b { display:block; font-weight:750; font-size:12.5px; }
.ciq-issue[data-l="bad"] { background:#fef2f2; color:#991b1b; }
.ciq-issue[data-l="warn"] { background:#fffbeb; color:#92400e; }
.ciq-issue[data-l="info"] { background:#f1f5f9; color:#475569; }
.ciq-facts { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px; }
.ciq-facts > div { background:#f8fafc; border:1px solid #eef2f7; border-radius:10px; padding:8px 10px; min-width:0; }
.ciq-facts span { display:block; font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#94a3b8; }
.ciq-facts b { display:block; font-size:13px; font-weight:700; color:var(--ink); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ciq-facts b[data-bad] { color:#b91c1c; }
.ciq-sec { font-size:10.5px; font-weight:750; letter-spacing:.05em; text-transform:uppercase; color:#94a3b8; margin:16px 0 8px; }
.ciq-attn { display:flex; flex-direction:column; gap:6px; }
.ciq-attn button { all:unset; cursor:pointer; font-weight:750; text-decoration:underline; text-decoration-color:rgba(146,64,14,.35); text-underline-offset:2px; }
.ciq-attn button:hover { text-decoration-color:currentColor; }
.ciq-attn button:focus-visible { outline:2px solid #6366f1; outline-offset:2px; border-radius:3px; }
.ciq-ok { display:inline-flex; align-items:center; gap:4px; height:20px; padding:0 7px; border-radius:6px; background:#ecfdf5; color:#047857; font-size:10.5px; font-weight:700; white-space:nowrap; }
.ciq-student { display:inline-flex; align-items:center; gap:4px; font-size:10.5px; font-weight:650; color:#0369a1; background:#f0f9ff; border-radius:5px; padding:1px 6px; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ciq-dur { display:inline-flex; flex-direction:column; align-items:flex-end; gap:3px; }
.ciq-dur .mini { width:64px; height:4px; border-radius:4px; background:#f1f5f9; overflow:hidden; }
.ciq-dur .mini span { display:block; height:100%; border-radius:4px; background:#4f46e5; }

/* tables in tabs */
.ciq .ma-table td { padding:8px 12px; }
.ciq .ma-table th { padding:9px 12px; }
.ciq-tablecard { overflow:hidden; display:flex; flex-direction:column; }
.ciq-tablecard .ma-tablewrap { max-height:calc(100vh - 330px); min-height:260px; overflow:auto; }
.ciq-num b { font-weight:650; color:var(--ink); font-variant-numeric:tabular-nums; display:inline-flex; align-items:center; gap:6px; }
/* The arrow beside a number says which way the call went, without reading the Type column. */
.ciq-dir { display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:6px; flex:none; }
.ciq-dir-word { font-weight:600; font-size:11px; color:var(--faint); text-transform:lowercase; }
.ciq-endedby { display:inline-flex; align-items:center; gap:4px; font-size:10.5px; font-weight:600; white-space:nowrap; }
.ciq-endedby[data-by="us"] { color:#b45309; }
.ciq-endedby[data-by="them"] { color:#64748b; }
.ciq-num .meta { display:flex; align-items:center; gap:6px; margin-top:2px; font-size:10.5px; color:var(--faint); }
.ciq-rowacts { display:inline-flex; gap:4px; opacity:0; transition:opacity .15s; }
.ma-table tbody tr:hover .ciq-rowacts { opacity:1; }
.ciq-act { position:relative; overflow:hidden; width:28px; height:28px; display:inline-grid; place-items:center; border-radius:8px; border:1px solid var(--line); background:#fff;
  color:var(--mute); cursor:pointer; transition:all .15s; text-decoration:none; }
.ciq-act:hover { color:var(--brand); border-color:#c7d2fe; background:#eef2ff; }
.ciq-act.wa:hover { color:#047857; border-color:#a7f3d0; background:#ecfdf5; }

/* SIM register */
.ciq-simcounts { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.ciq-simcount { display:inline-flex; align-items:center; gap:6px; height:24px; padding:0 10px; border-radius:999px;
  font-size:11.5px; font-weight:700; white-space:nowrap; }
.ciq-simcount i { width:7px; height:7px; border-radius:50%; }
.ciq-simstatus { display:inline-flex; align-items:center; gap:6px; height:22px; padding:0 9px; border-radius:6px;
  font-size:11px; font-weight:750; white-space:nowrap; }
.ciq-simstatus i { width:7px; height:7px; border-radius:50%; }
.ciq-fromop { color:#047857 !important; font-weight:600; }
.ciq-optext { display:block; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-style:italic; }

/* agents */
.ciq-agents { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:12px; }
.ciq-agent { position:relative; overflow:hidden; padding:14px; cursor:pointer; text-align:left; font-family:inherit; width:100%; }
.ciq-agent:hover { transform:translateY(-2px); }
.ciq-agent:active { transform:scale(.99); }
.ciq-agent[data-hidden] { opacity:.55; }
.ciq-agent-h { display:flex; align-items:center; gap:10px; }
.ciq-agent-h b { display:block; font-size:14px; font-weight:750; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ciq-agent-h small { display:block; font-size:11px; color:var(--faint); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ciq-agent-kpis { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:6px; margin:12px 0 8px; }
.ciq-agent-kpis div { background:#f8fafc; border-radius:9px; padding:6px 8px; }
.ciq-agent-kpis span { display:block; font-size:9.5px; text-transform:uppercase; letter-spacing:.05em; color:var(--faint); font-weight:750; }
.ciq-agent-kpis b { display:block; font-size:15px; font-weight:800; color:var(--ink); font-variant-numeric:tabular-nums; margin-top:1px; }
.ciq-agent-f { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:11px; color:var(--faint); }
.ciq-spark { display:block; }
.ciq-edit { position:absolute; top:10px; right:10px; opacity:0; transform:translateY(-3px); transition:all .18s var(--ease); }
.ciq-agent:hover .ciq-edit, .ciq-agent:focus-within .ciq-edit { opacity:1; transform:none; }

/* drawer + modal */
.ciq-portal .ma-drawer { z-index:2101; }
.ciq-portal .ma-scrim { z-index:2100; }
.ciq-drawer-f { display:flex; justify-content:flex-end; gap:8px; padding:12px 22px; background:#fff; border-top:1px solid var(--line); }
.ciq-modal-wrap { position:fixed; inset:0; z-index:2201; display:grid; place-items:center; padding:16px; pointer-events:none; }
.ciq-modal { pointer-events:auto; background:#fff; border-radius:16px; box-shadow:0 30px 80px rgba(15,23,42,.35); max-height:calc(100vh - 32px); display:flex; flex-direction:column;
  animation:ciq-modal-in .22s cubic-bezier(.2,.9,.3,1.2) both; }
.ciq-modal[data-closing] { animation:ciq-modal-out .18s ease-in both; }
@keyframes ciq-modal-in { from { opacity:0; transform:translateY(12px) scale(.95); } }
@keyframes ciq-modal-out { to { opacity:0; transform:translateY(8px) scale(.96); } }
.ciq-modal-h { display:flex; align-items:flex-start; gap:12px; justify-content:space-between; padding:18px 20px 6px; }
.ciq-modal-h h3 { margin:0; font-size:16px; font-weight:800; letter-spacing:-.01em; }
.ciq-modal-h p { margin:3px 0 0; font-size:12.5px; color:var(--mute); line-height:1.45; }
.ciq-modal-b { padding:10px 20px 14px; overflow-y:auto; }
.ciq-modal-f { display:flex; justify-content:flex-end; gap:8px; padding:12px 20px; border-top:1px solid #f1f5f9; }

/* form fields (Chakra/MUI outlined inputs) */
.ciq-field { display:block; margin-bottom:12px; }
.ciq-field > span { display:block; font-size:11.5px; font-weight:650; color:var(--ink2); margin-bottom:5px; }
.ciq-field > em { display:block; font-style:normal; font-size:11px; color:var(--faint); margin-top:4px; }
.ciq-input { width:100%; height:38px; padding:0 11px; border:1px solid #d7dde8; border-radius:9px; background:#fff; font-weight:500; font-size:13px; font-family:inherit; color:var(--ink);
  transition:border-color .15s, box-shadow .15s; box-sizing:border-box; }
textarea.ciq-input { height:auto; min-height:84px; padding:9px 11px; resize:vertical; line-height:1.45; }
select.ciq-input { cursor:pointer; }
.ciq-input:hover { border-color:#b8c2d3; }
.ciq-input:focus { outline:0; border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.18); }
.ciq-row2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.ciq-switch { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px; border:1px solid var(--line); border-radius:10px; cursor:pointer; }
.ciq-switch b { display:block; font-size:12.5px; } .ciq-switch small { display:block; font-size:11px; color:var(--faint); margin-top:2px; }
.ciq-toggle { position:relative; width:36px; height:20px; border-radius:999px; background:#cbd5e1; transition:background .2s; flex:none; }
.ciq-toggle::after { content:''; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(15,23,42,.3); transition:transform .2s var(--ease); }
.ciq-toggle[data-on] { background:var(--brand); } .ciq-toggle[data-on]::after { transform:translateX(16px); }

/* filter drawer sections */
.ciq-fsec { background:#fff; border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin-bottom:10px; }
.ciq-fsec h4 { margin:0 0 9px; font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--mute); display:flex; align-items:center; justify-content:space-between; }
.ciq-fsec h4 button { border:0; background:none; font-weight:600; font-size:11px; font-family:inherit; color:var(--accent); cursor:pointer; text-transform:none; letter-spacing:0; }
.ciq-opts { display:flex; flex-wrap:wrap; gap:6px; }
.ciq-opts .ma-chip { height:30px; }
.ciq-opts .ma-chip svg { flex:none; }

/* number drawer */
.ciq-hero { display:flex; align-items:center; gap:12px; }
.ciq-hero-ic { width:44px; height:44px; border-radius:12px; display:grid; place-items:center; background:#eef2ff; color:#4338ca; flex:none; }
.ciq-hero h2 { margin:0; font-size:19px; font-weight:800; letter-spacing:-.01em; font-variant-numeric:tabular-nums; }
.ciq-hero .sub { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-top:4px; font-size:12px; color:var(--mute); }
.ciq-mini-stats { display:grid; grid-template-columns:repeat(6, minmax(0, 1fr)); gap:8px; margin-bottom:14px; }
@media (max-width:760px){ .ciq-mini-stats { grid-template-columns:repeat(3, minmax(0, 1fr)); } }
.ciq-mini-stats div { background:#fff; border:1px solid var(--line); border-radius:11px; padding:8px 10px; }
.ciq-mini-stats span { display:block; font-size:9.5px; text-transform:uppercase; letter-spacing:.05em; color:var(--faint); font-weight:750; }
.ciq-mini-stats b { display:block; font-size:16px; font-weight:800; margin-top:2px; font-variant-numeric:tabular-nums; }
.ciq-tl { list-style:none; margin:0; padding:0; }
.ciq-tl > li { position:relative; display:grid; grid-template-columns:32px minmax(0, 1fr); gap:10px; padding-bottom:10px; }
.ciq-tl > li::before { content:''; position:absolute; left:15px; top:30px; bottom:0; width:2px; background:#e2e8f0; }
.ciq-tl > li:last-child::before { display:none; }
.ciq-tl .dot { width:32px; height:32px; border-radius:50%; display:grid; place-items:center; box-shadow:0 0 0 3px #f8fafc; position:relative; z-index:1; }
.ciq-tl .body { background:#fff; border:1px solid var(--line); border-radius:12px; padding:9px 12px; transition:border-color .15s, box-shadow .2s; }
.ciq-tl .body[data-sel] { border-color:#a5b4fc; box-shadow:0 0 0 3px rgba(99,102,241,.14); }
.ciq-tl .row1 { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:12.5px; }
.ciq-tl .row1 .when { margin-left:auto; font-size:11.5px; color:var(--faint); font-variant-numeric:tabular-nums; }
.ciq-tl .row2 { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:6px; font-size:11.5px; color:var(--mute); }
.ciq-tl .note { margin-top:7px; padding:7px 9px; background:#fffbeb; border-radius:8px; font-size:12px; color:#78350f; white-space:pre-wrap; word-break:break-word; }
.ciq-outcome-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:6px; margin-bottom:10px; }
.ciq-outcome-opt { position:relative; overflow:hidden; display:flex; align-items:center; gap:8px; padding:9px 10px; border:1px solid var(--line); border-radius:10px; background:#fff;
  font-weight:600; font-size:12.5px; font-family:inherit; color:var(--ink2); cursor:pointer; text-align:left; transition:all .15s; }
.ciq-outcome-opt i { width:9px; height:9px; border-radius:50%; background:var(--c); flex:none; }
.ciq-outcome-opt:hover { border-color:var(--c); background:color-mix(in srgb, var(--c) 6%, #fff); }
.ciq-outcome-opt[data-on] { border-color:var(--c); background:color-mix(in srgb, var(--c) 12%, #fff); color:var(--ink); box-shadow:0 0 0 2px color-mix(in srgb, var(--c) 25%, transparent); }

.ciq-code { display:flex; align-items:center; gap:8px; padding:9px 10px; background:#0f172a; color:#a7f3d0; border-radius:10px; font:12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; word-break:break-all; }
.ciq-code span { flex:1; }
.ciq-code button { flex:none; border:0; border-radius:7px; background:#1e293b; color:#e2e8f0; height:28px; padding:0 9px; cursor:pointer; font-weight:600; font-size:11.5px; font-family:inherit; display:inline-flex; align-items:center; gap:5px; }
.ciq-code button:hover { background:#334155; }
.ciq-steps { margin:0; padding-left:18px; font-size:12.5px; color:var(--ink2); line-height:1.6; }
.ciq-steps li { margin-bottom:4px; }
.ciq-steps code { font-size:11.5px; background:#f1f5f9; padding:1px 5px; border-radius:4px; }

@media (prefers-reduced-motion: reduce) {
  .ciq *, .ciq-portal * { animation-duration:.001ms !important; transition-duration:.001ms !important; }
}
`;
