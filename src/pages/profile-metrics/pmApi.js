/*
 * src/pages/profile-metrics/pmApi.js
 *
 * The page's whole conversation with the server, plus the small vocabulary the
 * rest of the folder shares: date ranges, number formatting, the plain-English
 * names for things the database spells in its own way, and the validated series
 * palette.
 *
 * Everything on the page is one of five calls. Keeping them here means a filter
 * is built once and every tab, chart and drawer level sends the identical
 * envelope -- which is what makes "apply a filter, drill three levels down, and
 * still be looking at the same population" true rather than aspirational.
 */
import api from '../../api/axios';

const URL = '/api/profile-metrics/profile_metrics.php';

/*
 * The shared axios client times out at 30s, which is the right default for the
 * rest of the panel but wrong at both ends here.
 *
 * Counts should answer in well under a second once the indexes in schema.sql
 * exist — 20s is a generous ceiling that still fails fast enough to tell you
 * something is wrong rather than leaving the page spinning. Creating those
 * indexes, on the other hand, is an ALTER over millions of rows and legitimately
 * takes minutes, so it gets its own budget.
 */
const TIMEOUT = { normal: 20000, install: 600000 };

async function call(action, body = {}, timeout = TIMEOUT.normal) {
  const { data } = await api.post(URL, { action, ...body }, { timeout });
  if (!data?.success) throw new Error(data?.message || 'Request failed');
  return data.data;
}

export const pm = {
  bootstrap: (refresh = false) => call('bootstrap', refresh ? { refresh: 1 } : {}),
  /* Its own call because it is a full read of `users`. Nothing waits for it and
     it is allowed to fail — the card just shows nothing. */
  stock: () => call('stock', {}, 30000),
  health: () => call('health'),
  /* One index per call — the page loops until `done`. A single ALTER on a large
     table can run for minutes and a proxy or FPM timeout would cut a whole batch
     in the middle, losing the report of what had already succeeded. */
  installIndexes: (limit = 1) => call('install_indexes', { limit }, TIMEOUT.install),
  overview: (tab, range, filters) => call('overview', { tab, ...range, filters }),
  series: (metrics, range, filters) => call('series', { metrics, ...range, filters }),
  breakdown: (metric, dim, range, filters, limit = 200, offset = 0) =>
    call('breakdown', { metric, dim, ...range, filters, limit, offset }),
  rows: (metric, range, filters, page = 1, per_page = 50) =>
    call('rows', { metric, ...range, filters, page, per_page }),
};

/* ── dates ────────────────────────────────────────────────────────────────
   Built from the browser's local day, which is what the person reading the
   page means by "today". The server works in Asia/Kolkata; for a panel used
   from one office those agree, and the chips send explicit dates anyway so
   there is never an implied "now" crossing the wire. */
export const iso = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

export const RANGE_PRESETS = [
  { key: 'today',     label: 'Today',        make: () => ({ start: iso(new Date()), end: iso(new Date()) }) },
  { key: 'yesterday', label: 'Yesterday',    make: () => ({ start: iso(daysAgo(1)), end: iso(daysAgo(1)) }) },
  { key: '7d',        label: 'Last 7 days',  make: () => ({ start: iso(daysAgo(6)), end: iso(new Date()) }) },
  { key: '15d',       label: 'Last 15 days', make: () => ({ start: iso(daysAgo(14)), end: iso(new Date()) }) },
  { key: '30d',       label: 'Last 30 days', make: () => ({ start: iso(daysAgo(29)), end: iso(new Date()) }) },
  { key: 'custom',    label: 'Custom',       make: null },
];

/** "12 Mar 2026" — unambiguous for a reader who is not thinking about formats. */
export const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const fmtDateTime = (s) => {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};
/** Short axis tick — the year is already in the range caption above the chart. */
export const fmtAxisDate = (s) => {
  const d = new Date(String(s) + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

export const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');
/** 12.4k on an axis, where the exact value is one hover away. */
export const fmtCompact = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1e7) return (v / 1e7).toFixed(1).replace(/\.0$/, '') + 'Cr';
  if (Math.abs(v) >= 1e5) return (v / 1e5).toFixed(1).replace(/\.0$/, '') + 'L';
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(v);
};
export const fmtPct = (n, d = 1) =>
  n === null || n === undefined || Number.isNaN(n) ? '—' : `${Number(n).toFixed(d)}%`;

export const rangeLabel = (r) =>
  !r ? '' : r.start === r.end ? fmtDate(r.start) : `${fmtDate(r.start)} – ${fmtDate(r.end)}`;

/* ── vocabulary ───────────────────────────────────────────────────────────
   update_profile.php names its thirteen sections in kebab case. A manager
   reading "extracurricular-activities" has to translate; these labels mean
   nobody has to. The keys are the exact strings the dashboard writes, so an
   unmapped one falls through to a tidied version of itself rather than
   disappearing. */
export const SECTION_LABELS = {
  'profile-summary': 'Profile summary',
  'resume-headline': 'Resume headline',
  'key-skills': 'Key skills',
  employment: 'Work experience',
  education: 'Education',
  projects: 'Projects',
  'online-profiles': 'Online profiles',
  'career-profile': 'Career profile',
  'personal-details': 'Personal details',
  'availability-status': 'Availability',
  languages: 'Languages',
  certifications: 'Certifications',
  'extracurricular-activities': 'Extracurricular',
  other: 'Other',
};
export const sectionLabel = (k) =>
  SECTION_LABELS[k] || String(k || '').replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase());

export const DIM_LABELS = {
  day: 'Date',
  employer: 'Company',
  job: 'Job / internship',
  app_status: 'Application status',
  job_type: 'Opportunity type',
  job_mode: 'Work mode',
  read_state: 'Read status',
  section: 'Profile section',
  resume_kind: 'Upload type',
  source_page: 'Source',
  user: 'Learner',
};
export const dimLabel = (d) => DIM_LABELS[d] || d;

/**
 * Where a click on a row of THIS dimension goes next.
 *
 * The chain is the question a manager asks in order: which day, then which
 * company, then which role at that company, then who -- and the learner level
 * is the leaf, because past a named person there is nothing left to group by,
 * only the records themselves.
 */
export function nextDim(dim, available = []) {
  const can = (d) => available.includes(d);
  const first = (...c) => c.find(can) || null;
  switch (dim) {
    case 'day':         return first('employer', 'section', 'user');
    case 'employer':    return first('job', 'user');
    case 'job':         return first('user');
    case 'section':     return first('user');
    case 'resume_kind': return first('user');
    case 'source_page': return first('user');
    case 'app_status':  return first('employer', 'user');
    case 'job_type':    return first('employer', 'user');
    case 'job_mode':    return first('employer', 'user');
    case 'read_state':  return first('employer', 'user');
    case 'user':        return null;
    default:            return null;
  }
}

/** The filter a click on this row adds on the way down. */
export function dimFilter(dim, row) {
  switch (dim) {
    case 'employer':    return { employer_id: [Number(row.id)] };
    case 'job':         return { job_id: [Number(row.id)] };
    case 'user':        return { user_id: [Number(row.id)] };
    case 'app_status':  return { app_status: [String(row.id)] };
    case 'job_type':    return { job_type: [String(row.id)] };
    case 'job_mode':    return { job_mode: [String(row.id)] };
    case 'read_state':  return { read_state: String(row.id) };
    case 'section':     return { section: [String(row.id)] };
    default:            return {};
  }
}

/* ── series palette ───────────────────────────────────────────────────────
   Slot 1 is the panel's own indigo; the rest are the data-viz reference hues
   in an order that clears the adjacent-pair gates on a white card surface
   (checked with the palette validator, not by eye). Assigned by slot, never
   cycled -- a chart that drops a series must not repaint the ones that remain,
   or a manager comparing two screenshots is comparing colours that moved.

   Three of these sit under 3:1 against white, so every chart that uses them
   also ships a legend and a table view in the drawer beneath it. That is the
   relief the contrast warning asks for, and it doubles as the secondary
   encoding the CVD band asks for. */
export const SERIES = ['#4f46e5', '#eb6834', '#1baf7a', '#e87ba4', '#eda100', '#e34948'];

/* Read/unread is a two-state polarity, not two identities: opened uses the
   brand indigo, not-opened a deliberate neutral so the eye reads it as absence
   rather than as a second category. */
export const STATE = { read: '#4f46e5', unread: '#cbd5e1' };

export const INK = {
  primary: '#0f172a',
  secondary: '#475569',
  muted: '#94a3b8',
  grid: '#eef2f7',
  border: '#e2e8f0',
  surface: '#ffffff',
};

/* ── CSV ──────────────────────────────────────────────────────────────────
   Excel is where these numbers go to be argued about, so every list on the
   page can leave as one. Written with a BOM: without it Excel on Windows
   renders Indian names in a CSV as mojibake. */
export function toCsv(rows, columns) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(c.get(r))).join(',')).join('\r\n');
  return '﻿' + head + '\r\n' + body;
}

export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  /* Revoked on the next tick rather than immediately: Safari cancels the
     download if the object URL dies in the same frame as the click. */
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
};

/* ── saved views ──────────────────────────────────────────────────────────
   localStorage, not the server: a saved view is one person's shortcut to the
   slice they look at every morning, and putting it behind an API would mean a
   table, an endpoint and a permission for something that is worth neither. */
const PRESET_KEY = 'pm_saved_views_v1';

export function loadPresets() {
  try {
    const raw = JSON.parse(localStorage.getItem(PRESET_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}
export function savePresets(list) {
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(list.slice(0, 40)));
  } catch {
    /* Private mode, or the quota is full. A shortcut that cannot be saved is
       not worth an error dialog -- the view still works, it just will not be
       there tomorrow. */
  }
}
