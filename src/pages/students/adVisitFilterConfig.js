// Ad-visit filter: presets, labels and styles shared by AdVisitFilter.jsx and AllStudents.jsx.

export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };

export const DATE_PRESETS = [
  { key: 'today', label: 'Today', range: () => [daysAgo(0), daysAgo(0)] },
  { key: 'yesterday', label: 'Yesterday', range: () => [daysAgo(1), daysAgo(1)] },
  { key: 'last7', label: 'Last 7 days', range: () => [daysAgo(6), daysAgo(0)] },
  { key: 'last30', label: 'Last 30 days', range: () => [daysAgo(29), daysAgo(0)] },
  { key: 'custom', label: 'Custom' },
];
export const COUNT_PRESETS = [
  { min: 1, label: 'Any' }, { min: 2, label: '2+' }, { min: 3, label: '3+' }, { min: 5, label: '5+' }, { min: 10, label: '10+' },
];
export const MATCH = { any: 'Any match', device: 'Same browser only' };
export const TIMING = { any: 'Any time', before: 'Before signup', after: 'After signup' };
export const SORT = { visits: 'Most visits', recent: 'Newest signup', first_visit: 'Earliest ad visit' };
export const COMMON_SOURCES = ['facebook', 'instagram', 'google', 'youtube', 'linkedin'];

export const DEFAULT_FILTER = (() => {
  const [from, to] = DATE_PRESETS[2].range();
  return { preset: 'last7', from, to, min: 1, source: '', match: 'any', timing: 'any', sort: 'visits' };
})();

export const SOURCE_COLORS = {
  facebook: '#1877f2', fb: '#1877f2', instagram: '#d62976', ig: '#d62976', meta: '#0668e1',
  google: '#ea4335', youtube: '#ff0000', linkedin: '#0a66c2', whatsapp: '#25d366',
};
export const sourceColor = (s) => SOURCE_COLORS[String(s || '').toLowerCase()] || '#64748b';

export function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s.replace(' ', 'T'));
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
export function fmtDateTime(s) {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T'));
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function dateLabel(f) {
  const p = DATE_PRESETS.find((x) => x.key === f.preset);
  if (p && p.key !== 'custom') return p.label;
  return f.from === f.to ? fmtDate(f.from) : `${fmtDate(f.from)} – ${fmtDate(f.to)}`;
}

/** Chips describing an applied filter; each knows how to undo itself. */
export function filterChips(f) {
  const chips = [{ key: 'date', label: `Registered: ${dateLabel(f)}` }];
  chips.push({ key: 'min', label: f.min > 1 ? `${f.min}+ ad visits` : 'Any ad visits', reset: f.min > 1 ? { min: 1 } : null });
  if (f.source) chips.push({ key: 'source', label: `Source: ${f.source}`, reset: { source: '' } });
  if (f.match !== 'any') chips.push({ key: 'match', label: MATCH[f.match], reset: { match: 'any' } });
  if (f.timing !== 'any') chips.push({ key: 'timing', label: TIMING[f.timing], reset: { timing: 'any' } });
  if (f.sort !== 'visits') chips.push({ key: 'sort', label: `Sort: ${SORT[f.sort]}`, reset: { sort: 'visits' } });
  return chips;
}

export const AD_FILTER_CSS = `
  .af-btn { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; min-width: 32px; padding: 0 10px; border-radius: 8px; border: 1.5px solid #e2e8f0; background: #fff; color: #475569; cursor: pointer; font-size: 12px; font-weight: 600; font-family: inherit; transition: all .2s ease; }
  .af-btn:hover { border-color: #a5b4fc; color: #4f46e5; }
  .af-btn.on { background: #eef2ff; border-color: #818cf8; color: #4338ca; }
  .af-badge { position: absolute; top: -6px; right: -6px; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 9px; background: #4f46e5; color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; }
  .af-collapse { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .35s cubic-bezier(.4,0,.2,1); flex-shrink: 0; }
  .af-collapse.open { grid-template-rows: 1fr; }
  .af-collapse > div { overflow: hidden; }
  .af-panel { margin: 12px 20px 0; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 16px 18px; opacity: 0; transform: translateY(-6px); transition: opacity .3s ease, transform .3s ease; box-shadow: 0 4px 18px rgba(15,23,42,.05); }
  .af-collapse.open .af-panel { opacity: 1; transform: none; }
  .af-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px 24px; }
  .af-label { font-size: 10.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; }
  .af-chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .af-chip { padding: 6px 12px; border-radius: 999px; border: 1.5px solid #e2e8f0; background: #fff; color: #475569; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .15s ease; }
  .af-chip:hover { border-color: #a5b4fc; color: #4f46e5; }
  .af-chip.on { background: #4f46e5; border-color: #4f46e5; color: #fff; box-shadow: 0 2px 8px rgba(79,70,229,.25); }
  .af-input { height: 32px; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 0 10px; font-size: 12px; font-family: inherit; color: #1e293b; outline: none; background: #fff; transition: border-color .15s; }
  .af-input:focus { border-color: #818cf8; }
  .af-more { display: inline-flex; align-items: center; gap: 6px; margin-top: 14px; background: none; border: none; color: #4f46e5; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; padding: 0; }
  .af-more svg { transition: transform .25s ease; }
  .af-more.open svg { transform: rotate(180deg); }
  .af-foot { display: flex; align-items: center; gap: 8px; margin-top: 16px; padding-top: 14px; border-top: 1px solid #f1f5f9; }
  .af-apply { height: 34px; padding: 0 18px; border-radius: 8px; border: none; background: #4f46e5; color: #fff; font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit; transition: background .15s; }
  .af-apply:hover { background: #4338ca; }
  .af-ghost { height: 34px; padding: 0 14px; border-radius: 8px; border: 1.5px solid #e2e8f0; background: #fff; color: #475569; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .af-ghost:hover { border-color: #cbd5e1; color: #0f172a; }
  .af-applied { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 10px 20px 0; animation: af-in .3s ease both; flex-shrink: 0; }
  .af-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 6px 4px 10px; border-radius: 999px; background: #eef2ff; color: #3730a3; font-size: 11.5px; font-weight: 600; border: 1px solid #c7d2fe; }
  .af-pill button { width: 16px; height: 16px; border-radius: 50%; border: none; background: #c7d2fe; color: #3730a3; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 11px; line-height: 1; padding: 0; }
  .af-pill button:hover { background: #4f46e5; color: #fff; }
  .af-count { font-size: 11.5px; color: #64748b; font-weight: 600; margin-left: 4px; }
  .af-reset { background: none; border: none; color: #dc2626; font-size: 11.5px; font-weight: 700; cursor: pointer; font-family: inherit; padding: 4px 6px; }
  @keyframes af-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

  .afr { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 12px; animation: af-in .35s ease both; }
  .afr-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; flex-shrink: 0; }
  .afr-stat { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; }
  .afr-stat-l { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .5px; }
  .afr-stat-v { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 3px; }
  .afr-stat-s { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .afr-bar { display: flex; height: 7px; border-radius: 6px; overflow: hidden; background: #f1f5f9; margin-top: 10px; }
  .afr-list { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-bottom: 4px; }
  .afr-list::-webkit-scrollbar { width: 5px; } .afr-list::-webkit-scrollbar-thumb { background: #c7d2fe; border-radius: 10px; }
  .afr-row { display: grid; grid-template-columns: minmax(220px, 1.4fr) 150px minmax(200px, 1.6fr) minmax(170px, 1fr) 120px; gap: 16px; align-items: center; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; animation: af-in .35s ease both; transition: border-color .15s, box-shadow .15s, transform .15s; }
  .afr-row:hover { border-color: #c7d2fe; box-shadow: 0 4px 16px rgba(79,70,229,.08); transform: translateY(-1px); }
  @media (max-width: 1200px) { .afr-row { grid-template-columns: 1fr 1fr; } }
  .afr-av { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
  .afr-name { font-size: 13px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .afr-sub { font-size: 11.5px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .afr-big { font-size: 22px; font-weight: 800; color: #7e22ce; line-height: 1; }
  .afr-mini { display: flex; height: 5px; border-radius: 4px; overflow: hidden; background: #f1f5f9; margin-top: 6px; width: 110px; }
  .afr-src { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 700; text-transform: capitalize; }
  .afr-touch { font-size: 11.5px; color: #334155; line-height: 1.45; overflow: hidden; }
  .afr-touch b { color: #94a3b8; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: .4px; margin-right: 4px; }
  .afr-view { height: 32px; padding: 0 12px; border-radius: 8px; border: none; background: #7e22ce; color: #fff; font-size: 11.5px; font-weight: 700; cursor: pointer; font-family: inherit; transition: background .15s, transform .1s; white-space: nowrap; }
  .afr-view:hover { background: #6b21a8; }
  .afr-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #94a3b8; font-size: 13px; background: #fff; border: 1.5px dashed #e2e8f0; border-radius: 12px; }
  .afr-skel { background: linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size: 200% 100%; animation: afr-sh 1.2s infinite; border-radius: 12px; }
  @keyframes afr-sh { to { background-position: -200% 0; } }
  .afr-foot { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 8px 4px; font-size: 11.5px; color: #64748b; }
`;
