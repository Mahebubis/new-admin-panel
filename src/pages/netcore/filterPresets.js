/*
 * Date-range presets, shared by every Filters drawer.
 *
 * In their own module rather than alongside the component so the drawer file exports only a
 * component (React Fast Refresh cannot hot-reload a file that mixes the two), and — more
 * usefully — so the Campaigns and Journeys screens resolve "Last 30 days" through exactly one
 * function. The moment two screens each own a copy of this, one of them ends up off by a day.
 *
 * Presets resolve to concrete dates in the BROWSER's timezone and are sent to the server as
 * plain YYYY-MM-DD, so the server never has to know what "last month" means.
 */

export const DATE_PRESETS = [
  { id: '',        label: 'All time' },
  { id: '7d',      label: 'Last 7 days' },
  { id: '30d',     label: 'Last 30 days' },
  { id: '90d',     label: 'Last 90 days' },
  { id: 'month',   label: 'This month' },
  { id: 'lastmon', label: 'Last month' },
  { id: 'custom',  label: 'Custom range' },
];

/** Local YYYY-MM-DD. NOT toISOString(): that converts to UTC first, which in IST shifts the
 *  date back a day for any time before 05:30 and quietly drops today from "last 7 days". */
const iso = d => {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** A preset id → {from, to}. Both ends inclusive; the server widens them to 00:00:00 / 23:59:59. */
export function resolvePreset(id) {
  const now = new Date();
  const back = n => { const d = new Date(now); d.setDate(d.getDate() - n); return d; };
  switch (id) {
    // n-1, because "last 7 days" includes today — 6 days back plus today is 7.
    case '7d':    return { from: iso(back(6)),  to: iso(now) };
    case '30d':   return { from: iso(back(29)), to: iso(now) };
    case '90d':   return { from: iso(back(89)), to: iso(now) };
    case 'month': return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
    case 'lastmon': {
      // Day 0 of this month is the last day of the previous one — avoids month-length arithmetic.
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last  = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: iso(first), to: iso(last) };
    }
    default: return { from: '', to: '' };
  }
}

/** The label for an applied range, for the filter pills above a list. */
export function describePreset(id, from, to) {
  if (!id) return '';
  if (id === 'custom') return `${from || '…'} → ${to || '…'}`;
  return DATE_PRESETS.find(p => p.id === id)?.label || id;
}
