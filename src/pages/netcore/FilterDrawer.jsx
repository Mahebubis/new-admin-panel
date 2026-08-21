import { useEffect, useMemo, useRef, useState } from 'react';
import { DATE_PRESETS, resolvePreset } from './filterPresets';

/*
 * The right-hand Filters drawer, shared by the Campaigns and Journeys lists.
 *
 * One component rather than two because the two screens ask nearly the same questions (a date
 * range, a dimension or two, tags) and the moment they are written separately they start to
 * disagree about what "Last 7 days" means and which end of the range is inclusive. Callers
 * declare the fields; everything about how a drawer behaves lives here.
 *
 * Field kinds:
 *   radio     one of N, laid out in a row (Journeys' Last created / duration / Last edited)
 *   select    one of N in a dropdown
 *   chips     multi-select, shown as pressable pills with counts (Channel, Tags)
 *   daterange a preset list plus a custom from/to pair
 *
 * WHY DRAFT STATE
 * Nothing is applied until APPLY is pressed. A drawer that filters as you type turns every
 * intermediate state into a full round-trip, and on a 6,000-row table each of those is a visible
 * stall — so edits accumulate in `draft` and are handed over in one go. CLEAR ALL resets the
 * draft, not the applied filters, so it too needs APPLY: the alternative is a button that
 * silently wipes what you were looking at.
 */

const CSS = `
.fd-scrim { position:fixed; inset:0; background:rgba(16,24,40,.45); z-index:60;
  opacity:0; pointer-events:none; transition:opacity 220ms cubic-bezier(.4,0,.2,1); }
.fd-scrim.on { opacity:1; pointer-events:auto; }

.fd { position:fixed; top:0; right:0; height:100%; width:400px; max-width:94vw; z-index:61;
  background:#fff; display:flex; flex-direction:column;
  box-shadow:-24px 0 60px rgba(16,24,40,.18);
  transform:translateX(102%); transition:transform 260ms cubic-bezier(.4,0,.2,1); }
.fd.on { transform:none; }

.fd-head { display:flex; align-items:center; padding:18px 22px 16px; border-bottom:1px solid #f2f4f7; flex:none; }
.fd-head h2 { font-size:17px; font-weight:750; color:#101828; margin:0; }
.fd-x { margin-left:auto; width:32px; height:32px; display:grid; place-items:center; border:0; background:none;
  border-radius:8px; color:#667085; cursor:pointer; transition:background 150ms, color 150ms; }
.fd-x:hover { background:#f2f4f7; color:#101828; }
.fd-x:focus-visible { outline:2px solid #4f46e5; outline-offset:2px; }

.fd-body { flex:1; overflow-y:auto; padding:8px 22px 24px; }
.fd-group { padding:16px 0; border-bottom:1px solid #f2f4f7; }
.fd-group:last-child { border-bottom:0; }
.fd-group > h3 { font-size:12.5px; font-weight:700; color:#344054; margin:0 0 11px;
  letter-spacing:.01em; display:flex; align-items:center; gap:7px; }
.fd-count { font-size:10.5px; font-weight:700; color:#4f46e5; background:#eef2ff;
  padding:1px 7px; border-radius:999px; }

.fd-radios { display:flex; gap:8px; flex-wrap:wrap; }
.fd-radio { display:inline-flex; align-items:center; gap:7px; cursor:pointer;
  font-size:12.5px; color:#344054; padding:7px 11px; border:1px solid #e4e7ec; border-radius:8px;
  transition:border-color 160ms cubic-bezier(.4,0,.2,1), background 160ms; }
.fd-radio:hover { border-color:#a5b4fc; background:#fafaff; }
.fd-radio input { accent-color:#4f46e5; margin:0; cursor:pointer; }
.fd-radio.on { border-color:#4f46e5; background:#eef2ff; color:#3730a3; font-weight:650; }

.fd-sel { width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid #d0d5dd; border-radius:8px;
  font-size:13px; font-family:inherit; color:#101828; background:#fff; outline:none; cursor:pointer;
  transition:border-color 160ms cubic-bezier(.4,0,.2,1), box-shadow 160ms; }
.fd-sel:hover { border-color:#98a2b3; }
.fd-sel:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,.14); }

.fd-chips { display:flex; gap:7px; flex-wrap:wrap; }
.fd-chip { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:999px;
  border:1px solid #e4e7ec; background:#fff; color:#475467; font-family:inherit; font-size:12.5px;
  font-weight:600; cursor:pointer;
  transition:all 170ms cubic-bezier(.4,0,.2,1); }
.fd-chip:hover { border-color:#98a2b3; background:#f9fafb; transform:translateY(-1px); }
.fd-chip:active { transform:translateY(0) scale(.97); }
.fd-chip:focus-visible { outline:2px solid #4f46e5; outline-offset:2px; }
.fd-chip[aria-pressed="true"] { background:#eef2ff; border-color:#4f46e5; color:#3730a3; }
.fd-chip .dot { width:8px; height:8px; border-radius:50%; flex:none; }
.fd-chip .n { font-size:11px; color:#98a2b3; font-variant-numeric:tabular-nums; }
.fd-chip[aria-pressed="true"] .n { color:#6366f1; }

.fd-dates { display:grid; grid-template-columns:1fr auto 1fr; gap:9px; align-items:center; margin-top:11px; }
.fd-date { padding:9px 11px; border:1px solid #d0d5dd; border-radius:8px; font-size:12.5px;
  font-family:inherit; color:#101828; outline:none; width:100%; box-sizing:border-box;
  transition:border-color 160ms cubic-bezier(.4,0,.2,1), box-shadow 160ms; }
.fd-date:hover { border-color:#98a2b3; }
.fd-date:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,.14); }
.fd-dates span { font-size:12px; color:#98a2b3; }

.fd-empty { font-size:12px; color:#98a2b3; font-style:italic; }

.fd-foot { flex:none; display:flex; gap:10px; align-items:center; padding:16px 22px;
  border-top:1px solid #f2f4f7; background:#fcfcfd; }
.fd-btn { padding:10px 20px; border-radius:8px; font-size:13px; font-weight:650; font-family:inherit;
  cursor:pointer; border:1px solid transparent;
  transition:background 160ms cubic-bezier(.4,0,.2,1), box-shadow 160ms, transform 90ms, border-color 160ms, color 160ms; }
.fd-btn:active:not(:disabled) { transform:translateY(1px); }
.fd-btn:focus-visible { outline:2px solid #4f46e5; outline-offset:2px; }
.fd-btn-solid { background:#4f46e5; color:#fff; box-shadow:0 1px 2px rgba(16,24,40,.06); flex:1; }
.fd-btn-solid:hover { background:#4338ca; box-shadow:0 4px 12px rgba(79,70,229,.3); }
.fd-btn-ghost { background:none; color:#475467; border-color:#d0d5dd; }
.fd-btn-ghost:hover { background:#f9fafb; border-color:#98a2b3; }
.fd-btn-ghost:disabled { opacity:.45; cursor:default; }
`;

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export default function FilterDrawer({ open, onClose, fields, value, onApply, title = 'Filters' }) {
  const [draft, setDraft] = useState(value || {});
  const panelRef = useRef(null);

  /*
   * Re-seed on the transition into open, so the drawer always shows what is actually applied
   * rather than the half-finished edit somebody abandoned by pressing Escape last time.
   *
   * Done during render off a previous-value ref, not in an effect: this is derived state, and an
   * effect would render the stale draft once and then immediately re-render with the right one —
   * a visible flash of the previous filters every time the drawer opens.
   */
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft({ ...(value || {}) });
  }

  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    // Focus moves into the panel so the drawer is keyboard-reachable and Escape lands here.
    const t = setTimeout(() => panelRef.current?.focus(), 60);
    return () => { document.removeEventListener('keydown', onKey); clearTimeout(t); };
  }, [open, onClose]);

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const toggleIn = (k, v) => setDraft(d => {
    const cur = Array.isArray(d[k]) ? d[k] : [];
    return { ...d, [k]: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] };
  });

  const activeCount = useMemo(() => fields.reduce((n, f) => {
    const v = draft[f.key];
    if (f.kind === 'chips') return n + (Array.isArray(v) ? v.length : 0);
    if (f.kind === 'daterange') return n + (v && v !== '' ? 1 : 0);
    return n + (v && v !== (f.default ?? '') ? 1 : 0);
  }, 0), [fields, draft]);

  const clearAll = () => {
    const next = {};
    fields.forEach(f => { next[f.key] = f.kind === 'chips' ? [] : (f.default ?? ''); });
    // Custom-range endpoints are not fields of their own, so they are cleared explicitly.
    next.from = ''; next.to = '';
    setDraft(next);
  };

  const apply = () => { onApply(draft); onClose(); };

  return (
    <>
      <style>{CSS}</style>
      <div className={`fd-scrim${open ? ' on' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`fd${open ? ' on' : ''}`} role="dialog" aria-modal="true" aria-label={title}
             tabIndex={-1} ref={panelRef}>
        <div className="fd-head">
          <h2>{title}</h2>
          {activeCount > 0 && <span className="fd-count" style={{ marginLeft: 9 }}>{activeCount}</span>}
          <button className="fd-x" onClick={onClose} aria-label="Close filters"><XIcon /></button>
        </div>

        <div className="fd-body">
          {fields.map(f => (
            <div className="fd-group" key={f.key}>
              <h3>{f.label}{f.hint && <span style={{ fontWeight: 400, color: '#98a2b3', fontSize: 11.5 }}>{f.hint}</span>}</h3>

              {f.kind === 'radio' && (
                <div className="fd-radios">
                  {f.options.map(o => (
                    <label key={o.id} className={`fd-radio${draft[f.key] === o.id ? ' on' : ''}`}>
                      <input type="radio" name={f.key} checked={draft[f.key] === o.id}
                             onChange={() => set(f.key, o.id)} />
                      {o.label}
                    </label>
                  ))}
                </div>
              )}

              {f.kind === 'select' && (
                <select className="fd-sel" value={draft[f.key] ?? ''} onChange={e => set(f.key, e.target.value)}>
                  <option value="">{f.placeholder || 'Select'}</option>
                  {f.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              )}

              {f.kind === 'chips' && (
                f.options.length ? (
                  <div className="fd-chips">
                    {f.options.map(o => {
                      const on = (draft[f.key] || []).includes(o.id);
                      return (
                        <button key={o.id} className="fd-chip" aria-pressed={on}
                                onClick={() => toggleIn(f.key, o.id)}>
                          {o.color && <span className="dot" style={{ background: o.color }} />}
                          {o.label}
                          {o.count != null && <span className="n">{o.count}</span>}
                        </button>
                      );
                    })}
                  </div>
                ) : <div className="fd-empty">{f.emptyText || 'Nothing to filter on yet'}</div>
              )}

              {f.kind === 'daterange' && (
                <>
                  <select className="fd-sel" value={draft[f.key] ?? ''}
                          onChange={e => {
                            const id = e.target.value;
                            const r = id === 'custom' ? { from: draft.from || '', to: draft.to || '' } : resolvePreset(id);
                            setDraft(d => ({ ...d, [f.key]: id, from: r.from, to: r.to }));
                          }}>
                    {DATE_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                  {draft[f.key] === 'custom' && (
                    <div className="fd-dates">
                      <input className="fd-date" type="date" aria-label="From"
                             value={draft.from || ''} onChange={e => set('from', e.target.value)} />
                      <span>to</span>
                      <input className="fd-date" type="date" aria-label="To"
                             value={draft.to || ''} onChange={e => set('to', e.target.value)} />
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        <div className="fd-foot">
          <button className="fd-btn fd-btn-ghost" onClick={clearAll} disabled={activeCount === 0}>Clear all</button>
          <button className="fd-btn fd-btn-solid" onClick={apply}>Apply</button>
        </div>
      </aside>
    </>
  );
}
