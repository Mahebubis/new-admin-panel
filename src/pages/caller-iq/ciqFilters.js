import { TYPE, WEEKDAYS, fmtDur } from './ciqShared';

/*
 * The filter model. Every field maps 1:1 onto ciq_filter_sql() in caller_iq.php, and every tab and
 * drawer sends the same object, so a number on a tile always equals the rows behind it.
 */
export const EMPTY_FILTERS = {
  types: [], devices: [], team: '', sims: [], outcomes: [],
  connected: '', callback: '', repeat: '',
  min_dur: '', max_dur: '', hour_from: '', hour_to: '', weekdays: [], q: '',
};

export const normalize = f => ({ ...EMPTY_FILTERS, ...(f || {}) });

const isOn = v => (Array.isArray(v) ? v.length > 0 : v !== '' && v != null);
export const activeCount = f => Object.keys(EMPTY_FILTERS).filter(k => k !== 'q' && isOn(f[k])).length + (f.q ? 1 : 0);

const hourText = h => `${(Number(h) % 12) || 12}${Number(h) < 12 ? 'am' : 'pm'}`;
const listText = (arr, fn, max = 2) => {
  const names = arr.map(fn);
  return names.length > max ? `${names.slice(0, max).join(', ')} +${names.length - max}` : names.join(', ');
};

/** Removable chips for everything currently narrowing the page. */
export function filterChips(f, { deviceLabel = d => d } = {}) {
  const chips = [];
  const push = (key, label, value, clear) => chips.push({ key, label, value, clear });
  if (f.types.length) push('types', 'Type', listText(f.types, t => TYPE[t]?.label || t, 3), { types: [] });
  if (f.devices.length) push('devices', 'Agent', listText(f.devices, deviceLabel), { devices: [] });
  if (f.team) push('team', 'Team', f.team, { team: '' });
  if (f.sims.length) push('sims', 'SIM', listText(f.sims, s => (Number(s) ? `SIM ${s}` : 'Unknown slot')), { sims: [] });
  if (f.outcomes.length) push('outcomes', 'Outcome', listText(f.outcomes, o => (o === '__none__' ? 'Untagged' : o)), { outcomes: [] });
  if (f.connected) push('connected', 'Status', f.connected === 'yes' ? 'Connected' : 'Not connected', { connected: '' });
  if (f.callback) push('callback', 'Callback', f.callback === 'pending' ? 'Pending' : 'Called back', { callback: '' });
  if (f.repeat) push('repeat', 'Callers', f.repeat === 'repeat' ? 'Repeat callers' : 'One-time callers', { repeat: '' });
  if (f.min_dur !== '' || f.max_dur !== '') {
    const v = f.min_dur !== '' && f.max_dur !== '' ? `${fmtDur(f.min_dur)} – ${fmtDur(f.max_dur)}`
      : f.min_dur !== '' ? `≥ ${fmtDur(f.min_dur)}` : `≤ ${fmtDur(f.max_dur)}`;
    push('dur', 'Duration', v, { min_dur: '', max_dur: '' });
  }
  if (f.hour_from !== '' || f.hour_to !== '') {
    push('hours', 'Time', `${hourText(f.hour_from === '' ? 0 : f.hour_from)} – ${hourText(f.hour_to === '' ? 23 : f.hour_to)}`, { hour_from: '', hour_to: '' });
  }
  if (f.weekdays.length) push('weekdays', 'Days', listText([...f.weekdays].sort(), d => WEEKDAYS[d], 4), { weekdays: [] });
  if (f.q) push('q', 'Search', `“${f.q}”`, { q: '' });
  return chips;
}

/* ── Saved views (per browser; a convenience, not shared state) ─────────── */
const VIEWS_KEY = 'ciq.views.v1';
export function loadViews() {
  try { const v = JSON.parse(localStorage.getItem(VIEWS_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function storeViews(views) {
  try { localStorage.setItem(VIEWS_KEY, JSON.stringify(views.slice(0, 30))); } catch { /* storage blocked */ }
}

/* Ready-made views every counselor lead reaches for. */
export const PRESET_VIEWS = [
  { name: 'Missed, not called back', filters: { callback: 'pending' } },
  { name: 'Connected calls over 3 min', filters: { connected: 'yes', min_dur: 180 } },
  { name: 'Outgoing that did not connect', filters: { types: ['OUTGOING'], connected: 'no' } },
  { name: 'Untagged connected calls', filters: { connected: 'yes', outcomes: ['__none__'] } },
  { name: 'Interested & enrolled', filters: { outcomes: ['Interested', 'Enrolled'] } },
  { name: 'Repeat callers', filters: { repeat: 'repeat' } },
  { name: 'After hours (8pm – 9am)', filters: { hour_from: 20, hour_to: 8 } },
];
