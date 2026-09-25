/*
 * KumoMTA — full-screen segment builder.
 *
 * A clone of the Netcore segment builder (NetcoreSegmentCreate) down to the
 * markup: the same condition rows, AND/OR connectors, event picker with
 * category tabs, day/date-range controls, running-border "+ ADD" buttons and
 * exit confirmation. Only the data layer differs — everything goes through
 * kapi() against api/kumo/kumo.php, and the option lists come from the Kumo
 * side (campaigns / lists / segments) or degrade to an empty picker with a
 * hint where Kumo has no equivalent (journeys, tags).
 *
 * The config JSON this page produces is byte-compatible with the Netcore
 * builder's, because the Kumo backend hands it to the same buildSegmentSql().
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { kapi } from './kumoShared';
import {
  ALL_EVENTS, PAYLOAD_OPTIONS, PAYLOAD_VALUES,
  ENGAGEMENT_EVENTS, CONTACT_EVENTS, SOURCE_TYPES, ENGAGEMENT_FILTERS, FILTER_OP_LABELS,
  engagementEvent, newCondition, validateSegmentConfig,
} from './kumoSegmentConfig';

/* Picker data (campaigns, journeys, tags, lists, segments) loaded once per page. */
const OptionsCtx = createContext({ opts: null, selfId: 0 });

const COMP_OPS  = ['is greater than or equal to', 'is greater than', 'is less than or equal to', 'is less than', 'is'];
const COMP_MAP  = { 'is greater than or equal to':'>=', 'is greater than':'>', 'is less than or equal to':'<=', 'is less than':'<', 'is':'=' };
const FILT_OPS  = ['exists', 'does not exist', 'is', 'is not', 'contains', 'does not contain'];

const SOURCE_OPTS = [
  { value: 'any',              label: 'Any Source' },
  { value: 'any_website',      label: 'Any Website' },
  { value: 'specific_website', label: 'Specific Website' },
  { value: 'any_app',          label: 'Any App' },
  { value: 'specific_app',     label: 'Specific App' },
];

const DAY_OPTS = [
  { label: 'Any Day', value: 'any' },
  { label: 'Between', value: 'between' },
  { label: 'In the past', value: 'in_past' },
  { label: 'Exactly before', value: 'exactly_before' },
];

/* Kumo has no journeys and keeps no per-message tags — the pickers stay but say so. */
const NO_SOURCE_HINT = {
  journey: 'KumoMTA has no journeys — nothing to pick here yet.',
  tags:    'KumoMTA does not tag sends yet — nothing to pick here yet.',
};

/* ─── icons ─── */
const I = {
  all:        <path d="M4 6h16M4 12h16M4 18h16" />,
  engagement: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
  behaviour:  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  contacts:   <><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="10" r="3" /><path d="M7 18c1-2.5 3-3.5 5-3.5s4 1 5 3.5" /></>,
  list:       <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></>,
  segment:    <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="5" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.3 11 15.7 6M8.3 13l7.4 5" /></>,
  info:       <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>,
};
const Icon = ({ name, size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{I[name]}</svg>
);
const Chevron = ({ open }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: 8, top: '50%', transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`, transition: 'transform .15s' }}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

function useOutsideClose(open, setOpen) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, setOpen]);
  return ref;
}

const triggerStyle = (hasValue, extra = {}) => ({
  width: '100%', padding: '6px 24px 6px 10px', border: '1px solid #c4b5fd', borderRadius: 6, background: '#fff', fontSize: 12.5,
  color: hasValue ? '#1e3a8a' : '#94a3b8', cursor: 'pointer', textAlign: 'left', position: 'relative', fontFamily: 'inherit',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...extra,
});
const inputStyle = { padding: '6px 10px', border: '1px solid #c4b5fd', borderRadius: 6, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', color: '#1e3a8a' };
const iconBtn = (active, color = '#64748b') => ({
  width: 28, height: 28, border: `1px solid ${active ? '#1e3a8a' : '#e2e8f0'}`, background: active ? '#eff6ff' : '#fff', borderRadius: 6,
  cursor: 'pointer', color: active ? '#1e3a8a' : color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
});

/* ─── small reusable custom dropdown with optional search ─── */
function Dropdown({ value, options, onChange, placeholder = 'Select', searchable = false, width = 'auto', minWidth = 120 }) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState('');
  const ref = useOutsideClose(open, setOpen);

  const opts = options.filter(o => !s || (typeof o === 'string' ? o : o.label).toLowerCase().includes(s.toLowerCase()));

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', width, minWidth }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={triggerStyle(!!value)}>
        {value || placeholder}
        <Chevron open={open} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '100%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,.12)', zIndex: 100, padding: 6 }}>
          {searchable && (
            <input autoFocus value={s} onChange={e => setS(e.target.value)} placeholder="Search"
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12.5, marginBottom: 6, fontFamily: 'inherit', outline: 'none' }} />
          )}
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {opts.length === 0
              ? <div style={{ padding: 8, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>No matches</div>
              : opts.map(o => {
                const v = typeof o === 'string' ? o : o.value;
                const l = typeof o === 'string' ? o : o.label;
                const sel = value === v || value === l;
                return (
                  <div key={v} onClick={() => { onChange(v); setOpen(false); setS(''); }}
                    style={{ padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, whiteSpace: 'nowrap', color: sel ? '#1e3a8a' : '#334155', background: sel ? '#eff6ff' : 'transparent', fontWeight: sel ? 600 : 500, borderLeft: `3px solid ${sel ? '#1e3a8a' : 'transparent'}` }}
                    onMouseEnter={e => { if (!sel) e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent'; }}>
                    {l}
                  </div>
                );
              })
            }
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── multi-select with search + select-all (campaigns / journeys / lists / segments / tags) ─── */
function MultiPicker({ items, selected, onChange, placeholder, noun, showId = true, loading = false, emptyHint = '' }) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState('');
  const ref = useOutsideClose(open, setOpen);
  const sel = selected || [];
  const selSet = new Set(sel.map(String));

  const q = s.trim().toLowerCase();
  const filtered = items.filter(it => !q || it.name.toLowerCase().includes(q) || String(it.id).includes(q));
  const allOn = filtered.length > 0 && filtered.every(it => selSet.has(String(it.id)));

  const toggle = id => {
    const k = String(id);
    onChange(selSet.has(k) ? sel.filter(x => String(x) !== k) : [...sel, id]);
  };
  const toggleAll = () => {
    const ids = filtered.map(it => it.id);
    if (allOn) { const drop = new Set(ids.map(String)); onChange(sel.filter(x => !drop.has(String(x)))); }
    else onChange([...sel, ...ids.filter(id => !selSet.has(String(id)))]);
  };

  const firstName = sel.length === 1 ? (items.find(it => String(it.id) === String(sel[0]))?.name ?? `#${sel[0]}`) : '';
  const label = sel.length === 0 ? '' : sel.length === 1 ? firstName : `${sel.length} ${noun}s selected`;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', minWidth: 150, maxWidth: 240 }}>
      <button type="button" title={label} onClick={() => setOpen(o => !o)} style={triggerStyle(!!label, { maxWidth: 240 })}>
        {label || placeholder}
        <Chevron open={open} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: 330, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 10px 24px rgba(0,0,0,.15)', zIndex: 150 }}>
          <div style={{ padding: 8, borderBottom: '1px solid #eef2f7', position: 'relative' }}>
            <input autoFocus value={s} onChange={e => setS(e.target.value)} placeholder={showId ? 'Search by Name or ID' : 'Search'}
              style={{ width: '100%', padding: '8px 30px 8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }} />
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2} style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', fontSize: 12, color: '#64748b', borderBottom: '1px solid #eef2f7', cursor: filtered.length ? 'pointer' : 'default' }}>
            <input type="checkbox" checked={allOn} disabled={!filtered.length} onChange={toggleAll} />
            <span style={{ flex: 1 }}>{noun} Name</span>
            {showId && <span style={{ fontSize: 11 }}>ID</span>}
          </label>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {loading
              ? <div style={{ padding: 14, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>Loading…</div>
              : filtered.length === 0
                ? <div style={{ padding: 14, fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 1.6 }}>{items.length ? 'No matches' : (emptyHint || `No ${noun.toLowerCase()}s found`)}</div>
                : filtered.map(it => {
                  const on = selSet.has(String(it.id));
                  return (
                    <label key={it.id} title={it.name}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, color: '#334155', background: on ? '#eff6ff' : 'transparent', borderLeft: `3px solid ${on ? '#1e3a8a' : 'transparent'}` }}>
                      <input type="checkbox" checked={on} onChange={() => toggle(it.id)} />
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</span>
                      {it.hint && <span style={{ fontSize: 10.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>{it.hint}</span>}
                      {showId && <span style={{ fontSize: 12, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{it.id}</span>}
                    </label>
                  );
                })}
          </div>
          {sel.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderTop: '1px solid #eef2f7', fontSize: 12 }}>
              <span style={{ color: '#64748b' }}>{sel.length} selected</span>
              <button type="button" onClick={() => onChange([])} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Clear</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── event picker with category tabs: All / Engagement / Behaviour / Contacts ─── */
const PICKER_GROUPS = [
  { tab: 'Engagement', icon: 'engagement', kind: 'engagement', items: ENGAGEMENT_EVENTS },
  { tab: 'Behaviour',  icon: 'behaviour',  kind: 'behaviour',  items: ALL_EVENTS },
  { tab: 'Contacts',   icon: 'contacts',   kind: 'contacts',   items: CONTACT_EVENTS },
];
const itemIcon = (group, item) => group.kind === 'contacts' ? (item.key === 'list' ? 'list' : 'segment') : group.icon;

function EventPicker({ kind, value, onPick }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('All');
  const [s, setS] = useState('');
  const ref = useOutsideClose(open, setOpen);

  const q = s.trim().toLowerCase();
  const groups = PICKER_GROUPS
    .filter(g => tab === 'All' || g.tab === tab)
    .map(g => ({ ...g, items: g.items.filter(it => !q || it.label.toLowerCase().includes(q)) }))
    .filter(g => g.items.length);

  const cur = PICKER_GROUPS.find(g => g.kind === (kind || 'behaviour'));
  const valueLabel = cur?.items.find(it => it.key === value)?.label;

  const openPicker = () => {
    if (!open) setTab(value ? (cur?.tab || 'All') : 'All');
    setOpen(o => !o);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={openPicker} style={triggerStyle(!!valueLabel, { minWidth: 150, width: 'auto' })}>
        {valueLabel || 'Select event'}
        <Chevron open={open} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: 'min(560px, 90vw)', background: '#fff', borderRadius: 8, boxShadow: '0 10px 24px rgba(0,0,0,.15)', border: '1px solid #e2e8f0', zIndex: 200 }}>
          <div style={{ padding: 10, borderBottom: '1px solid #eef2f7', position: 'relative' }}>
            <input autoFocus value={s} onChange={e => setS(e.target.value)} placeholder="Search"
              style={{ width: '100%', padding: '9px 32px 9px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2} style={{ position: 'absolute', right: 22, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          </div>
          <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #e2e8f0', padding: '0 8px', fontSize: 12.5, overflowX: 'auto' }}>
            {[{ tab: 'All', icon: null }, ...PICKER_GROUPS].map(g => {
              const on = tab === g.tab;
              return (
                <div key={g.tab} onClick={() => setTab(g.tab)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 12px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', color: on ? '#1e3a8a' : '#64748b', borderBottom: `2px solid ${on ? '#1e3a8a' : 'transparent'}`, marginBottom: -1 }}>
                  {g.icon && <Icon name={g.icon} size={13} />}{g.tab}
                </div>
              );
            })}
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto', padding: '4px 0 8px' }}>
            {groups.length === 0 && <div style={{ padding: 16, fontSize: 12.5, color: '#94a3b8', textAlign: 'center' }}>No matches</div>}
            {groups.map(g => (
              <div key={g.tab}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', padding: '10px 16px 4px' }}>{g.tab}</div>
                {g.items.map(it => {
                  const selected = g.kind === (kind || 'behaviour') && it.key === value;
                  return (
                    <div key={it.key}
                      title={it.disabled ? 'This channel is not connected — no events are recorded for it yet' : (it.info || '')}
                      onClick={() => { if (it.disabled) return; onPick(g.kind, it.key); setOpen(false); setS(''); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', cursor: it.disabled ? 'not-allowed' : 'pointer', fontSize: 13, color: it.disabled ? '#b6bfcc' : selected ? '#1e3a8a' : '#334155', background: selected ? '#eff6ff' : 'transparent', fontWeight: selected ? 600 : 500 }}
                      onMouseEnter={e => { if (!it.disabled && !selected) e.currentTarget.style.background = '#f5f3ff'; }}
                      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}>
                      <Icon name={itemIcon(g, it)} size={13} color={it.disabled ? '#cbd5e1' : '#64748b'} />
                      <span>{it.label}</span>
                      {it.info && !it.disabled && <Icon name="info" size={12} color="#94a3b8" />}
                      {it.disabled && <span style={{ marginLeft: 'auto', fontSize: 10.5, color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1px 7px' }}>Not connected</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── shared pieces ─── */
function DayPicker({ day, onChange }) {
  const d = day || { type: 'any' };
  const label = (DAY_OPTS.find(o => o.value === (d.type || 'any')) || DAY_OPTS[0]).label;
  return (
    <>
      <Dropdown value={label} options={DAY_OPTS} onChange={v => onChange({ ...d, type: v })} minWidth={110} />
      {d.type === 'between' && (
        <>
          <input type="date" value={d.from || ''} onChange={e => onChange({ ...d, from: e.target.value })}
            style={{ padding: 5, fontSize: 12, borderRadius: 6, border: '1px solid #c4b5fd', fontFamily: 'inherit' }} />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>and</span>
          <input type="date" value={d.to || ''} onChange={e => onChange({ ...d, to: e.target.value })}
            style={{ padding: 5, fontSize: 12, borderRadius: 6, border: '1px solid #c4b5fd', fontFamily: 'inherit' }} />
        </>
      )}
      {(d.type === 'in_past' || d.type === 'exactly_before') && (
        <>
          <input type="number" min={1} value={d.n || 7} onChange={e => onChange({ ...d, n: Math.max(1, parseInt(e.target.value || '1', 10)) })}
            style={{ width: 60, padding: 6, border: '1px solid #c4b5fd', borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }} />
          {d.type === 'in_past'
            ? <Dropdown value={d.unit || 'days'} options={['hours', 'days', 'weeks', 'months']} onChange={v => onChange({ ...d, unit: v })} minWidth={80} />
            : <span style={{ fontSize: 12, color: '#64748b' }}>days ago</span>}
        </>
      )}
    </>
  );
}

function CountInputs({ cond, set }) {
  return (
    <>
      <Dropdown value={Object.keys(COMP_MAP).find(k => COMP_MAP[k] === (cond.operator || '>=')) || 'is greater than or equal to'}
        options={COMP_OPS} onChange={v => set({ operator: COMP_MAP[v] })} minWidth={200} />
      <input type="number" min={0} value={cond.count ?? 1}
        onChange={e => set({ count: Math.max(0, parseInt(e.target.value || '0', 10)) })}
        style={{ ...inputStyle, width: 60 }} />
    </>
  );
}

function RowIcons({ showFilter, filterOn, onFilter, onCopy, onDelete }) {
  return (
    <span style={{ marginLeft: 6, display: 'inline-flex', gap: 4 }}>
      {showFilter && (
        <button type="button" title={filterOn ? 'Remove filter' : 'Add filter'} onClick={onFilter} style={iconBtn(filterOn)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
        </button>
      )}
      <button type="button" title="Copy" onClick={onCopy} style={iconBtn(false)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      </button>
      <button type="button" title="Delete" onClick={onDelete} style={iconBtn(false, '#dc2626')}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
      </button>
    </span>
  );
}

const DID_OPTS = [{ label: 'Did', value: 'did' }, { label: 'Did Not Do', value: 'did_not_do' }];

/* ─── Behaviour condition (existing platform events) ─── */
function BehaviourFields({ cond, set, onPick, icons }) {
  /* normalise legacy multi-filter array → single filter */
  const filter = (cond.filter && typeof cond.filter === 'object')
    ? cond.filter
    : (Array.isArray(cond.filters) && cond.filters.length ? cond.filters[0] : null);
  const payloadOpts = PAYLOAD_OPTIONS[cond.event] || [];
  const setFilter = nf => set({ filter: nf, filters: undefined });
  const sourceLabel = (SOURCE_OPTS.find(o => o.value === (cond.source?.type || 'any')) || SOURCE_OPTS[0]).label;

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        {icons.who}
        <Dropdown value={cond.did === 'did_not_do' ? 'Did Not Do' : 'Did'} options={DID_OPTS} onChange={v => set({ did: v })} minWidth={80} />
        <EventPicker kind="behaviour" value={cond.event} onPick={onPick} />
        <Dropdown value="Number of occurrences" options={['Number of occurrences']} onChange={() => {}} minWidth={170} />
        <CountInputs cond={cond} set={set} />
        <Dropdown value={sourceLabel} options={SOURCE_OPTS}
          onChange={v => set({ source: { ...(cond.source || {}), type: v, value: '' } })} minWidth={120} />
        {(cond.source?.type === 'specific_website' || cond.source?.type === 'specific_app') && (
          <input value={cond.source?.value || ''}
            placeholder={cond.source?.type === 'specific_website' ? 'e.g. example.com' : 'e.g. com.app.id'}
            onChange={e => set({ source: { ...(cond.source || {}), value: e.target.value } })}
            style={{ ...inputStyle, minWidth: 160 }} />
        )}
        <DayPicker day={cond.day} onChange={day => set({ day })} />
        <RowIcons showFilter filterOn={!!filter}
          onFilter={() => filter ? set({ filter: undefined, filters: undefined }) : setFilter({ payload: '', op: 'is', value: '' })}
          onCopy={icons.onCopy} onDelete={icons.onDelete} />
      </div>

      {filter && (
        <div style={{ marginLeft: 50, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>where</span>
          <Dropdown value={filter.payload || ''} options={payloadOpts}
            onChange={v => setFilter({ ...filter, payload: v, value: '' /* reset value when payload changes */ })}
            placeholder="Payload" searchable minWidth={130} />
          <Dropdown value="Value" options={['Value']} onChange={() => {}} minWidth={80} />
          <Dropdown value={filter.op || 'is'} options={FILT_OPS}
            onChange={v => setFilter({ ...filter, op: v })}
            placeholder="Operator" minWidth={130} />
          {PAYLOAD_VALUES[filter.payload] ? (
            <Dropdown value={filter.value || ''}
              options={PAYLOAD_VALUES[filter.payload]}
              onChange={v => setFilter({ ...filter, value: v })}
              placeholder="Select value" searchable minWidth={160} />
          ) : (
            <input value={filter.value || ''}
              onChange={e => setFilter({ ...filter, value: e.target.value })}
              placeholder="Type value…"
              style={{ ...inputStyle, width: 160 }} />
          )}
          <button type="button" onClick={() => set({ filter: undefined, filters: undefined })}
            style={{ ...iconBtn(false, '#dc2626') }}>×</button>
        </div>
      )}
    </>
  );
}

/* ─── Engagement condition (email / WhatsApp / list activity) ─── */
function EngagementFields({ cond, set, onPick, icons }) {
  const { opts } = useContext(OptionsCtx);
  const ev = engagementEvent(cond.event) || {};
  const src = cond.source || { type: 'campaign', scope: 'any', ids: [], tags: [] };
  const st = SOURCE_TYPES[src.type] || SOURCE_TYPES.campaign;
  const setSrc = patch => set({ source: { ...src, ...patch } });
  const loading = !opts;

  /* the campaign picker must list the right channel — email and WhatsApp campaign ids overlap */
  const items = useMemo(() => {
    if (!opts) return [];
    if (src.type === 'journey') return opts.journeys.map(j => ({ id: j.id, name: j.name, hint: j.status }));
    if (src.type === 'list') return opts.lists.map(l => ({ id: l.id, name: l.kind === 'blocklist' ? `${l.name} (blocklist)` : l.name, hint: `${Number(l.contact_count).toLocaleString()}` }));
    const camps = ev.channel === 'whatsapp' ? opts.wa_campaigns : opts.email_campaigns;
    return camps.map(c => ({ id: c.id, name: c.name, hint: c.status }));
  }, [opts, src.type, ev.channel]);

  const tagItems = useMemo(() => {
    if (!opts) return [];
    const base = ev.channel === 'whatsapp' ? opts.wa_tags : opts.email_tags;
    const all = (ev.sources || []).includes('journey') ? [...base, ...opts.journey_tags] : base;
    return [...new Set(all)].sort((a, b) => a.localeCompare(b)).map(t => ({ id: t, name: t }));
  }, [opts, ev.channel, ev.sources]);

  const filters = src.type === 'campaign' ? (ev.filters || []) : [];
  const filter = cond.filter && filters.includes(cond.filter.payload) ? cond.filter : null;
  const fdef = filter ? ENGAGEMENT_FILTERS[filter.payload] : null;
  const defaultFilter = key => ({ payload: key, op: ENGAGEMENT_FILTERS[key].ops[0], value: ENGAGEMENT_FILTERS[key].defaultValue || '' });
  const showMeasure = !ev.oncePerMessage && ev.channel !== 'list';
  const hint = NO_SOURCE_HINT[src.type] || (ev.channel === 'whatsapp' ? 'KumoMTA sends email only — no WhatsApp campaigns here.' : '');

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        {icons.who}
        <Dropdown value={cond.did === 'did_not_do' ? 'Did Not Do' : 'Did'} options={DID_OPTS} onChange={v => set({ did: v })} minWidth={80} />
        <EventPicker kind="engagement" value={cond.event} onPick={onPick} />
        {showMeasure && (
          <Dropdown value={cond.measure === 'unique' ? 'Unique' : 'Total'}
            options={[{ label: 'Total', value: 'total' }, { label: 'Unique', value: 'unique' }]}
            onChange={v => set({ measure: v })} minWidth={80} />
        )}
        <CountInputs cond={cond} set={set} />
        <Dropdown value={st.label}
          options={(ev.sources || []).map(t => ({ value: t, label: SOURCE_TYPES[t].label }))}
          onChange={v => { if (v !== src.type) set({ source: { type: v, scope: 'any', ids: [], tags: [] }, filter: v === 'campaign' ? cond.filter : null }); }}
          minWidth={100} />
        {src.type === 'tags' ? (
          <MultiPicker items={tagItems} selected={src.tags} onChange={tags => setSrc({ tags })}
            placeholder={st.pick} noun={st.noun} showId={false} loading={loading} emptyHint={hint} />
        ) : (
          <>
            <Dropdown value={src.scope === 'specific' ? st.specific : st.any}
              options={[{ value: 'specific', label: st.specific }, { value: 'any', label: st.any }]}
              onChange={v => setSrc({ scope: v, ids: v === 'any' ? [] : (src.ids || []) })} minWidth={140} />
            {src.scope === 'specific' && (
              <MultiPicker items={items} selected={src.ids} onChange={ids => setSrc({ ids })}
                placeholder={st.pick} noun={st.noun} loading={loading} emptyHint={hint} />
            )}
          </>
        )}
        <DayPicker day={cond.day} onChange={day => set({ day })} />
        <RowIcons showFilter={filters.length > 0} filterOn={!!filter}
          onFilter={() => set({ filter: filter ? null : defaultFilter(filters[0]) })}
          onCopy={icons.onCopy} onDelete={icons.onDelete} />
      </div>

      {!loading && hint && (
        <div style={{ marginLeft: 50, fontSize: 11.5, color: '#94a3b8' }}>{hint}</div>
      )}

      {filter && fdef && (
        <div style={{ marginLeft: 50, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>where</span>
          <Dropdown value={fdef.label}
            options={filters.map(k => ({ value: k, label: ENGAGEMENT_FILTERS[k].label }))}
            onChange={v => set({ filter: defaultFilter(v) })} minWidth={110} />
          <Dropdown value={FILTER_OP_LABELS[filter.op] || 'Is'}
            options={fdef.ops.map(o => ({ value: o, label: FILTER_OP_LABELS[o] }))}
            onChange={v => set({ filter: { ...filter, op: v } })} minWidth={80} />
          {fdef.values ? (
            <Dropdown value={(fdef.values.find(v => v.value === filter.value) || {}).label || ''}
              options={fdef.values} placeholder="Select value"
              onChange={v => set({ filter: { ...filter, value: v } })} minWidth={120} />
          ) : (
            <input value={filter.value || ''} placeholder="e.g. internshipstudio.com/courses"
              onChange={e => set({ filter: { ...filter, value: e.target.value } })}
              style={{ ...inputStyle, width: 240 }} />
          )}
          <button type="button" title="Remove filter" onClick={() => set({ filter: null })} style={iconBtn(false, '#dc2626')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
          </button>
        </div>
      )}
    </>
  );
}

/* ─── Contacts condition (belongs to list / segment) ─── */
function ContactsFields({ cond, set, onPick, icons }) {
  const { opts, selfId } = useContext(OptionsCtx);
  const isList = cond.event === 'list';
  const items = useMemo(() => {
    if (!opts) return [];
    if (isList) return opts.lists.map(l => ({ id: l.id, name: l.kind === 'blocklist' ? `${l.name} (blocklist)` : l.name, hint: `${Number(l.contact_count).toLocaleString()} contacts` }));
    /* a segment cannot include itself */
    return opts.segments.filter(s => s.id !== selfId).map(s => ({ id: s.id, name: s.name, hint: `${Number(s.user_count).toLocaleString()} users` }));
  }, [opts, isList, selfId]);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      {icons.who}
      <Dropdown value={cond.did === 'did_not_do' ? 'Does not belong to' : 'Belongs to'}
        options={[{ label: 'Belongs to', value: 'did' }, { label: 'Does not belong to', value: 'did_not_do' }]}
        onChange={v => set({ did: v })} minWidth={130} />
      <EventPicker kind="contacts" value={cond.event} onPick={onPick} />
      <MultiPicker items={items} selected={cond.ids} onChange={ids => set({ ids })}
        placeholder={isList ? 'Select List' : 'Select Segment'} noun={isList ? 'List' : 'Segment'} loading={!opts} />
      {cond.ids?.length > 1 && <span style={{ fontSize: 11.5, color: '#94a3b8' }}>(any of these)</span>}
      {isList && <span style={{ fontSize: 11.5, color: '#94a3b8' }} title="List contacts are matched to registered users by email">matched by email</span>}
      <RowIcons showFilter={false} onCopy={icons.onCopy} onDelete={icons.onDelete} />
    </div>
  );
}

/* ─── single condition row ─── */
function ConditionRow({ cond, onChange, onCopy, onDelete, isFirst }) {
  const kind = cond.kind || 'behaviour';
  const set = patch => onChange({ ...cond, ...patch });

  const onPick = (newKind, key) => {
    if (newKind === kind && key === cond.event) return;
    if (newKind === kind && kind === 'behaviour') { set({ event: key, filter: undefined, filters: undefined }); return; }
    if (newKind === kind && kind === 'engagement') {
      const prevEv = engagementEvent(cond.event);
      const ev = engagementEvent(key);
      /* keep the campaign selection only while the channel (and so the id space) is unchanged */
      const keepSrc = prevEv && prevEv.channel === ev.channel && ev.sources.includes(cond.source?.type);
      const keepFilter = cond.filter && ev.filters.includes(cond.filter.payload);
      onChange({
        ...cond, event: key,
        source: keepSrc ? cond.source : { type: ev.sources[0], scope: 'any', ids: [], tags: [] },
        filter: keepFilter ? cond.filter : null,
        measure: ev.oncePerMessage ? 'total' : (cond.measure || 'total'),
      });
      return;
    }
    if (newKind === kind && kind === 'contacts') { set({ event: key, ids: [] }); return; }
    onChange(newCondition(newKind, key, cond));
  };

  const icons = {
    who: isFirst ? <span style={{ fontSize: 12, color: '#94a3b8', minWidth: 30 }}>who</span> : <span style={{ minWidth: 30 }} />,
    onCopy, onDelete,
  };
  const Fields = kind === 'engagement' ? EngagementFields : kind === 'contacts' ? ContactsFields : BehaviourFields;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
      {!isFirst && (
        <div style={{ marginLeft: 8 }}>
          <Dropdown value={cond.condConnector || 'AND'} options={['AND', 'OR']} onChange={v => set({ condConnector: v })} minWidth={60} />
        </div>
      )}
      <Fields cond={cond} set={set} onPick={onPick} icons={icons} />
    </div>
  );
}

/* ─── block (a card) containing many conditions ─── */
function Block({ block, onChange, onDelete, isFirst, blockNumber }) {
  const set = patch => onChange({ ...block, ...patch });
  const setCond = (i, c) => { const arr = [...(block.conditions || [])]; arr[i] = c; set({ conditions: arr }); };
  const addCond = () => set({ conditions: [...(block.conditions || []), newCondition('behaviour', '')] });
  const removeCond = i => set({ conditions: (block.conditions || []).filter((_, idx) => idx !== i) });
  const copyCond = i => { const c = block.conditions[i]; set({ conditions: [...block.conditions, JSON.parse(JSON.stringify({ ...c, condConnector: 'AND' }))] }); };

  return (
    <div style={{ position: 'relative', padding: 14, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 600 }}>Block {blockNumber}</div>
        {!isFirst && <button type="button" onClick={onDelete}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 13 }}>Delete block</button>}
      </div>
      {!isFirst && (
        <div style={{ marginBottom: 8 }}>
          <Dropdown value={block.blockConnector || 'AND'} options={['AND', 'OR']} onChange={v => set({ blockConnector: v })} minWidth={60} />
        </div>
      )}
      {(block.conditions || []).length === 0 && (
        <div style={{ fontSize: 12, color: '#94a3b8', padding: '6px 0 2px' }}>No conditions yet — add one to start narrowing this block.</div>
      )}
      {(block.conditions || []).map((c, i) => (
        <ConditionRow key={i} cond={c}
          isFirst={i === 0}
          onChange={nc => setCond(i, nc)}
          onCopy={() => copyCond(i)}
          onDelete={() => removeCond(i)} />
      ))}
      <button type="button" onClick={addCond} className="km-add-anim" style={{ marginTop: 8 }}>
        <span>+ ADD</span>
      </button>
    </div>
  );
}

const EMPTY_SECTION = () => ({ blocks: [{ blockConnector: 'AND', conditions: [] }] });

/* ─── main page ─── */
export default function KumoSegmentCreate() {
  const { id } = useParams();
  const nav = useNavigate();
  const isEdit = !!id;

  const [name, setName]               = useState('Untitled segment');
  const [description, setDescription] = useState('');
  const [contactType, setContactType] = useState('all_identified');
  const [include, setInclude]         = useState(EMPTY_SECTION);
  const [exclude, setExclude]         = useState(EMPTY_SECTION);
  const [count, setCount]             = useState(null);   // number | null
  const [counting, setCounting]       = useState(false);
  const [countErr, setCountErr]       = useState('');   // a failed count — shown in red
  const [countHint, setCountHint]     = useState('');   // an unfinished config — shown in grey
  const [saving, setSaving]           = useState(false);
  const [exitOpen, setExitOpen]       = useState(false);
  const [opts, setOpts]               = useState(null);
  const [loaded, setLoaded]           = useState(!isEdit);

  /* picker data for the Engagement / Contacts tabs.
     Kumo has campaigns, lists and segments of its own; journeys and per-send
     tags do not exist here, so those pickers stay empty with a hint. */
  useEffect(() => {
    let alive = true;
    (async () => {
      const safe = async (action, params) => { try { return await kapi(action, params); } catch { return null; } };
      const [camps, lists, segs] = await Promise.all([
        safe('campaigns_list', { page: 1, per_page: 500 }),
        safe('lists_list'),
        safe('segments_list'),
      ]);
      if (!alive) return;
      if (!camps && !lists && !segs) toast.error('Failed to load campaigns and lists');
      setOpts({
        email_campaigns: (camps?.campaigns || []).map(c => ({ id: c.id, name: c.name, status: c.status })),
        wa_campaigns: [],
        journeys: [],
        email_tags: [], wa_tags: [], journey_tags: [],
        lists: (lists?.lists || []).map(l => ({ id: l.id, name: l.name, kind: l.kind || 'list', contact_count: l.contact_count || 0 })),
        segments: (segs?.segments || []).map(s => ({ id: s.id, name: s.name, user_count: s.cached_count || 0 })),
      });
    })();
    return () => { alive = false; };
  }, []);

  /* load existing if editing — segments_list carries the whole config */
  useEffect(() => {
    if (!isEdit) return;
    let alive = true;
    (async () => {
      try {
        const d = await kapi('segments_list');
        if (!alive) return;
        const seg = (d.segments || []).find(s => String(s.id) === String(id));
        if (!seg) { toast.error('Segment not found'); setLoaded(true); return; }
        const cfg = typeof seg.config === 'string' ? (JSON.parse(seg.config || '{}') || {}) : (seg.config || {});
        setName(seg.name || 'Untitled segment');
        setDescription(seg.description || '');
        if (cfg.contact_type) setContactType(cfg.contact_type);
        if (cfg.include?.blocks) setInclude(cfg.include);
        if (cfg.exclude?.blocks) setExclude(cfg.exclude);
        setCount(seg.cached_count ?? null);
      } catch (err) { toast.error(err?.message || 'Failed to load segment'); }
      finally { if (alive) setLoaded(true); }
    })();
    return () => { alive = false; };
  }, [id, isEdit]);

  const buildConfig = () => ({ contact_type: contactType, include, exclude });

  const configProblem = cfg => {
    const hasInclude = (cfg.include.blocks || []).some(b => (b.conditions || []).length);
    if (!hasInclude) return 'Add at least one condition under Include users';
    return validateSegmentConfig(cfg);
  };
  const checkConfig = cfg => {
    const problem = configProblem(cfg);
    if (problem) { toast.error(problem); return false; }
    return true;
  };

  /* ── live count: debounced 600ms whenever the rules change ── */
  const cfgKey = JSON.stringify({ contactType, include, exclude });
  const countReq = useRef(0);
  useEffect(() => {
    if (!loaded) return;
    const cfg = buildConfig();
    const problem = configProblem(cfg);
    if (problem) { setCounting(false); setCountErr(''); setCountHint(problem); setCount(null); return; }
    setCountErr(''); setCountHint('');
    const my = ++countReq.current;
    setCounting(true);
    const t = setTimeout(async () => {
      try {
        const d = await kapi('segment_count', { source: 'rules', config: cfg });
        if (my !== countReq.current) return;
        setCount(Number(d.count || 0));
      } catch (err) {
        if (my !== countReq.current) return;
        setCount(null); setCountErr(err?.message || 'Count failed');
      } finally { if (my === countReq.current) setCounting(false); }
    }, 600);
    return () => clearTimeout(t);
  }, [cfgKey, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  /* manual recount — same button Netcore has */
  const getCount = async () => {
    const cfg = buildConfig();
    if (!checkConfig(cfg)) return;
    const my = ++countReq.current;
    setCounting(true); setCountErr(''); setCountHint('');
    try {
      const d = await kapi('segment_count', { source: 'rules', config: cfg });
      if (my !== countReq.current) return;
      setCount(Number(d.count || 0));
    } catch (err) {
      if (my !== countReq.current) return;
      setCount(null); setCountErr(err?.message || 'Count failed');
      toast.error(err?.message || 'Count failed');
    } finally { if (my === countReq.current) setCounting(false); }
  };

  const save = async () => {
    if (!name.trim()) { toast.error('Name required'); return; }
    const cfg = buildConfig();
    if (!checkConfig(cfg)) return;
    setSaving(true);
    try {
      const params = { name: name.trim(), description: description.trim(), source: 'rules', config: cfg };
      if (isEdit) params.id = id;
      const d = await kapi('segment_save', params);
      toast.success(`Saved · ${Number(d?.count || 0).toLocaleString()} contacts`);
      nav('/kumo/segments');
    } catch (err) { toast.error(err?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const updateBlocks = (key, blocks) =>
    (key === 'include' ? setInclude : setExclude)(prev => ({ ...prev, blocks }));

  const renderSection = (key, state) => (
    <>
      {(state.blocks || []).map((b, i) => (
        <Block key={i} block={b} blockNumber={i + 1} isFirst={i === 0}
          onChange={nb => { const arr = [...state.blocks]; arr[i] = nb; updateBlocks(key, arr); }}
          onDelete={() => updateBlocks(key, state.blocks.filter((_, x) => x !== i))} />
      ))}
      <button type="button" onClick={() => updateBlocks(key, [...(state.blocks || []), { blockConnector: 'AND', conditions: [] }])}
        className="km-add-anim km-add-anim-block">
        <span>+ ADD BLOCK</span>
      </button>
    </>
  );

  const fmt = v => (v === null || v === undefined ? '-' : Number(v).toLocaleString());
  const ctx = useMemo(() => ({ opts, selfId: isEdit ? parseInt(id, 10) : 0 }), [opts, isEdit, id]);

  return (
    <OptionsCtx.Provider value={ctx}>
      <style>{`
        .km-sg *{ box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }

        /* ── animated running-border button ── */
        @keyframes km_run_border { to { background-position: 200% 0; } }
        .km-add-anim {
          padding: 1.5px;
          border-radius: 7px;
          background: linear-gradient(90deg, #1e3a8a, #c4b5fd, #1e3a8a, #c4b5fd, #1e3a8a) 0 0 / 200% 100%;
          animation: km_run_border 2s linear infinite;
          border: none; cursor: pointer; font-family: inherit;
        }
        .km-add-anim > span {
          display: block; background: #fff; border-radius: 5.5px;
          padding: 6px 14px; color: #1e3a8a; font-size: 12px; font-weight: 700; letter-spacing: .3px;
        }
        .km-add-anim-block { margin: 6px auto 0; display: block; }
        .km-add-anim-block > span { padding: 8px 18px; }
        .km-add-anim:hover > span { background: #f5f3ff; }
      `}</style>
      <div className="km-sg" style={{ position: 'fixed', inset: 0, background: '#f1f0ff', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 1000 }}>

        {/* top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button type="button" title="Back" onClick={() => setExitOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0f172a', padding: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}
              onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <input value={name} onChange={e => setName(e.target.value)}
              style={{ border: 'none', fontSize: 18, fontWeight: 700, color: '#0f172a', outline: 'none', minWidth: 220, fontFamily: 'inherit' }} />
            <span style={{ color: '#94a3b8', fontSize: 14 }}>✎</span>
          </div>
          <button type="button" onClick={save} disabled={saving}
            style={{ padding: '9px 26px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: '.4px', cursor: saving ? 'not-allowed' : 'pointer', textTransform: 'uppercase', opacity: saving ? .6 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 20 }}>
          {/* contact type + description */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 14, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 12.5, color: '#475569' }}>Contact type:</span>
            <Dropdown value={contactType === 'all_identified' ? 'All identified' : contactType}
              options={[{ label: 'All identified', value: 'all_identified' }]}
              onChange={v => setContactType(v)} minWidth={150} />
            <span style={{ fontSize: 12.5, color: '#475569', marginLeft: 6 }}>Description:</span>
            <input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Who is in this segment and why (optional)"
              style={{ ...inputStyle, flex: 1, minWidth: 220, color: '#0f172a' }} />
          </div>

          {/* Include users */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 10 }}>Include users</div>
            {renderSection('include', include)}
          </div>

          {/* Exclude users */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 10 }}>Exclude users</div>
            {renderSection('exclude', exclude)}
          </div>

          {/* Get count */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <button type="button" onClick={getCount} disabled={counting}
              style={{ padding: '9px 22px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: '.4px', cursor: counting ? 'not-allowed' : 'pointer', textTransform: 'uppercase', opacity: counting ? .6 : 1 }}>
              {counting ? 'Counting…' : 'Get Count'}
            </button>
            <div style={{ background: '#fff', border: '1px solid #1e3a8a', borderRadius: 8, padding: '14px 22px', minWidth: 150 }}>
              <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 4 }}>Contact count</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{counting ? '…' : fmt(count)}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 22px', maxWidth: 420 }}>
              <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 4 }}>Live count</div>
              <div style={{ fontSize: 12.5, color: countErr ? '#dc2626' : countHint ? '#64748b' : '#0f172a', lineHeight: 1.5 }}>
                {counting ? 'Recounting as you build…' : (countErr || countHint || 'Up to date — the count refreshes ~0.6s after every change.')}
              </div>
            </div>
          </div>
        </div>

        {/* exit confirmation modal */}
        {exitOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 12, width: 'min(420px, 100%)', boxShadow: '0 20px 60px rgba(0,0,0,.3)', overflow: 'hidden' }}>
              <div style={{ padding: '28px 24px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 600 }}>
                  Are you sure you want to exit without {isEdit ? 'editing' : 'creating'} segment?
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 18px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <button type="button" onClick={() => setExitOpen(false)}
                  style={{ padding: '9px 22px', background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: '.4px', cursor: 'pointer', textTransform: 'uppercase', fontFamily: 'inherit' }}>
                  No
                </button>
                <button type="button" onClick={() => { setExitOpen(false); nav('/kumo/segments'); }}
                  style={{ padding: '9px 26px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: '.4px', cursor: 'pointer', textTransform: 'uppercase', fontFamily: 'inherit' }}>
                  Yes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </OptionsCtx.Provider>
  );
}
