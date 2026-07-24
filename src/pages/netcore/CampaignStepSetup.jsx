import { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import { ALL_EVENTS } from './eventsConfig';

const CAMP_API = '/api/campaigns/campaigns.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

const inp = { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box' };
const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 };
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 18 };
const Toggle = ({ on, onClick }) => (
  <button type="button" onClick={onClick} style={{ width: 38, height: 21, borderRadius: 999, border: 'none', background: on ? '#16a34a' : '#cbd5e1', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
    <span style={{ position: 'absolute', top: 2, left: on ? 19 : 2, width: 17, height: 17, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
  </button>
);

/* Tag badge colors. A color picked at creation time is remembered (localStorage) so that
   tag always renders the same badge color everywhere afterward; tags created before this
   existed fall back to a deterministic hash-based color. */
const TAG_COLORS = [
  { bg: '#dbeafe', fg: '#1d4ed8' }, { bg: '#dcfce7', fg: '#15803d' }, { bg: '#fef3c7', fg: '#b45309' },
  { bg: '#fce7f3', fg: '#be185d' }, { bg: '#ede9fe', fg: '#6d28d9' }, { bg: '#ffedd5', fg: '#c2410c' },
  { bg: '#e0f2fe', fg: '#0369a1' }, { bg: '#fee2e2', fg: '#dc2626' }, { bg: '#ecfccb', fg: '#4d7c0f' },
  { bg: '#f1f5f9', fg: '#475569' },
];
const TAG_COLOR_STORAGE_KEY = 'nc_tag_colors_v1';
function readTagColorOverrides() {
  try { return JSON.parse(localStorage.getItem(TAG_COLOR_STORAGE_KEY) || '{}'); } catch { return {}; }
}
function writeTagColorOverride(tag, idx) {
  try {
    const map = readTagColorOverrides();
    map[tag] = idx;
    localStorage.setItem(TAG_COLOR_STORAGE_KEY, JSON.stringify(map));
  } catch { /* localStorage unavailable (private browsing etc.) — color just won't persist */ }
}
function tagColorIndex(tag) {
  const overrides = readTagColorOverrides();
  if (overrides[tag] !== undefined && TAG_COLORS[overrides[tag]]) return overrides[tag];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return hash % TAG_COLORS.length;
}
function tagColor(tag) { return TAG_COLORS[tagColorIndex(tag)]; }

/* Tag picker — click to open a searchable dropdown of existing tags (colored badges),
   pick multiple, or create a brand new one if the search text doesn't match anything. */
function TagPicker({ selected, onChange, allTags }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const atMax = selected.length >= 5;
  // Defensive String() coercion — e.g. a purely numeric tag like "171" could arrive here
  // as a JS number rather than a string depending on how the backend serialized it.
  const filtered = allTags.filter(t => String(t).toLowerCase().includes(search.toLowerCase()));
  const exactMatch = allTags.some(t => String(t).toLowerCase() === search.trim().toLowerCase());

  // Color chosen for whatever's currently typed (only relevant when creating a brand-new tag) —
  // defaults to the same deterministic color it would have gotten anyway, but the user can pick differently.
  const [newColorIdx, setNewColorIdx] = useState(0);
  useEffect(() => { if (search.trim()) setNewColorIdx(tagColorIndex(search.trim())); }, [search]);

  const toggle = (t) => {
    if (selected.includes(t)) onChange(selected.filter(x => x !== t));
    else if (!atMax) onChange([...selected, t]);
  };
  const createNew = () => {
    const t = search.trim();
    if (!t || selected.includes(t) || atMax) return;
    writeTagColorOverride(t, newColorIdx);
    onChange([...selected, t]);
    setSearch('');
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 30); }}
        style={{ minHeight: 42, border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', cursor: 'text', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {selected.length === 0 && <span style={{ color: '#94a3b8', fontSize: 12.5, padding: '4px 2px' }}>Select up to 5 tags</span>}
        {selected.map(t => {
          const c = tagColor(t);
          return (
            <span key={t} style={{ background: c.bg, color: c.fg, fontSize: 11.5, fontWeight: 700, padding: '4px 9px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {t}
              <span onClick={e => { e.stopPropagation(); toggle(t); }} style={{ cursor: 'pointer', opacity: .75, lineHeight: 1 }}>×</span>
            </span>
          );
        })}
      </div>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 10px 24px rgba(0,0,0,.12)', zIndex: 60, padding: 8 }}>
          <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !exactMatch) createNew(); }}
            placeholder="Search or create a tag…"
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12.5, marginBottom: 8, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {filtered.length === 0 && (
              <div style={{ fontSize: 12, color: '#94a3b8', padding: '6px 4px' }}>{allTags.length === 0 ? 'No tags created yet — type above to create one.' : 'No matching tags.'}</div>
            )}
            {filtered.map(t => {
              const c = tagColor(t);
              const isSel = selected.includes(t);
              const disabled = !isSel && atMax;
              return (
                <button key={t} type="button" onClick={() => toggle(t)} disabled={disabled}
                  style={{ background: c.bg, color: c.fg, fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 999, border: isSel ? `1.5px solid ${c.fg}` : '1.5px solid transparent', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .5 : 1, fontFamily: 'inherit' }}>
                  {isSel ? '✓ ' : ''}{t}
                </button>
              );
            })}
          </div>
          {search.trim() !== '' && !exactMatch && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', marginBottom: 7 }}>PICK A COLOR FOR "{search.trim()}"</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {TAG_COLORS.map((c, i) => (
                  <button key={i} type="button" onClick={() => setNewColorIdx(i)} title={`Color ${i + 1}`}
                    style={{ width: 22, height: 22, borderRadius: '50%', background: c.fg, border: newColorIdx === i ? '2px solid #0f172a' : '2px solid transparent', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {newColorIdx === i && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3}><path d="M20 6 9 17l-5-5" /></svg>}
                  </button>
                ))}
              </div>
              <button type="button" onClick={createNew} disabled={atMax}
                style={{ width: '100%', textAlign: 'center', padding: '8px 10px', border: 'none', background: atMax ? '#94a3b8' : '#1e3a8a', borderRadius: 6, fontSize: 12.5, color: '#fff', fontWeight: 700, cursor: atMax ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                Create New
              </button>
            </div>
          )}
          {atMax && <div style={{ fontSize: 10.5, color: '#c2410c', marginTop: 6 }}>Maximum 5 tags — remove one to add another.</div>}
        </div>
      )}
    </div>
  );
}

/* Searchable single-select dropdown for the conversion-goal event — lists every event
   the segment builder knows about (ALL_EVENTS, shared with NetcoreSegmentCreate.jsx). */
function EventDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const filtered = ALL_EVENTS.filter(e => e.label.toLowerCase().includes(search.toLowerCase()));
  const current = ALL_EVENTS.find(e => e.key === value);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ ...inp, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: current ? '#1e293b' : '#94a3b8' }}>
        {current ? current.label : 'Select event'}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2.4} style={{ flexShrink: 0, transform: `rotate(${open ? 180 : 0}deg)`, transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 10px 24px rgba(0,0,0,.12)', zIndex: 60, padding: 8 }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events…"
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12.5, marginBottom: 6, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0 && <div style={{ padding: 8, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>No matches</div>}
            {filtered.map(ev => (
              <div key={ev.key} onClick={() => { onChange(ev.key); setOpen(false); setSearch(''); }}
                style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, color: value === ev.key ? '#1e3a8a' : '#334155', background: value === ev.key ? '#eff6ff' : 'transparent', fontWeight: value === ev.key ? 600 : 500 }}
                onMouseEnter={e => { if (value !== ev.key) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={e => { if (value !== ev.key) e.currentTarget.style.background = 'transparent'; }}>
                {ev.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CampaignStepSetup({ draft, setField, onValidChange }) {
  const valid = !!draft.name?.trim();
  useEffect(() => { onValidChange(valid); }, [valid]); // eslint-disable-line

  const [allTags, setAllTags] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await api.post(CAMP_API, new URLSearchParams({ action: 'tags' }), FORM);
        if (res.data.success) setAllTags(res.data.data.tags || []);
      } catch { /* non-critical — tag creation still works without the existing list */ }
    })();
  }, []);

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Campaign details</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 18 }}>Provide basic details about your campaign</div>

        <div style={{ marginBottom: 16 }}>
          <label style={label}>Campaign name <span style={{ color: '#dc2626' }}>*</span></label>
          <input style={inp} value={draft.name} maxLength={100} onChange={e => setField('name', e.target.value)} placeholder="e.g. iCAT 171 exam reminder" />
          <div style={{ textAlign: 'right', fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>{(draft.name || '').length}/100</div>
        </div>

        <div>
          <label style={label}>Add tags <span style={{ fontWeight: 500, color: '#94a3b8' }}>(up to 5)</span></label>
          <TagPicker selected={draft.tags || []} onChange={v => setField('tags', v.slice(0, 5))} allTags={allTags} />
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Google Analytics tracking</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>Add URL parameters to track campaign efficiency under Google Analytics campaign reports.</div>
          </div>
          <Toggle on={draft.ga_enabled} onClick={() => setField('ga_enabled', !draft.ga_enabled)} />
        </div>
        {draft.ga_enabled && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
            <div><label style={label}>Source (utm_source)</label><input style={inp} value={draft.ga_source} onChange={e => setField('ga_source', e.target.value)} /></div>
            <div><label style={label}>Medium (utm_medium)</label><input style={inp} value={draft.ga_medium} onChange={e => setField('ga_medium', e.target.value)} /></div>
            <div><label style={label}>Campaign (utm_campaign)</label><input style={inp} value={draft.ga_campaign || draft.name} onChange={e => setField('ga_campaign', e.target.value)} /></div>
            <div><label style={label}>Content (utm_content)</label><input style={inp} value={draft.ga_content} onChange={e => setField('ga_content', e.target.value)} placeholder="Ex: Sale" /></div>
            <div><label style={label}>Term (utm_term)</label><input style={inp} value={draft.ga_term} onChange={e => setField('ga_term', e.target.value)} /></div>
          </div>
        )}
        <div style={{ fontSize: 10.5, color: '#c2410c', background: '#fff7ed', borderRadius: 6, padding: '6px 10px', marginTop: 14 }}>
          Captured for reference only — not yet wired into a live analytics dashboard.
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Set conversion goal</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>Select the event you would like to count as a conversion.</div>
          </div>
          <Toggle on={draft.goal_enabled} onClick={() => setField('goal_enabled', !draft.goal_enabled)} />
        </div>
        {draft.goal_enabled && (
          <div style={{ marginTop: 16 }}>
            <label style={label}>Event name</label>
            <EventDropdown value={draft.goal_event_name} onChange={v => setField('goal_event_name', v)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <div><label style={label}>Conversion window (days)</label><input type="number" min={1} style={inp} value={draft.goal_window_days} onChange={e => setField('goal_window_days', e.target.value)} /></div>
              <div><label style={label}>Revenue parameter</label><input style={inp} value={draft.goal_revenue_param} onChange={e => setField('goal_revenue_param', e.target.value)} placeholder="e.g. amount" /></div>
            </div>
          </div>
        )}
        <div style={{ fontSize: 10.5, color: '#c2410c', background: '#fff7ed', borderRadius: 6, padding: '6px 10px', marginTop: 14 }}>
          Captured for reference only — no revenue/conversion attribution is calculated yet.
        </div>
      </div>
    </div>
  );
}
