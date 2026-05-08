import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/netcore/segments.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

/* events grouped for the picker tabs (mirrors Netcore UI) */
const EVENT_GROUPS = {
  Behaviour: [
    { key: 'register',                 label: 'Register' },
    { key: 'signin',                   label: 'Signin' },
    { key: 'exam_success',             label: 'Exam Success' },
    { key: 'course_purchase',          label: 'Course Purchase' },
    { key: 'payment_success',          label: 'Payment Success' },
    { key: 'preferred_domain',         label: 'Preferred Domain' },
    { key: 'visited_iap',              label: 'Visited IAP' },
    { key: 'result_view',              label: 'Result View' },
    { key: 'placement_community_link', label: 'Placement Community Link' },
    { key: 'instantexam_reminder',     label: 'Instantexam Reminder' },
    { key: 'course_edit',              label: 'Course Edit' },
  ],
};

/* payload options per event — feeds the filter dropdown */
const PAYLOAD_OPTIONS = {
  register:                 ['country','mobile','last_name','state','first_name','email','method','source','referral','express','instantexam','instantresult','setreminder','campaign','adset','ad','medium','is_from_refund','full_url','register_type','device'],
  signin:                   ['email'],
  exam_success:             ['status','result_score'],
  course_purchase:          ['amount','internship_name','batch_date','coupon_applied'],
  payment_success:          ['paid_amount','paid_internship_name','paid_batch_date','coupon_applied_success','order_id'],
  preferred_domain:         ['preferred_domain'],
  visited_iap:              ['visited'],
  result_view:              ['score'],
  placement_community_link: ['refund_non_refund'],
  instantexam_reminder:     ['time_slot'],
  course_edit:              ['edit_internship_name','edit_page_url','edit_batch_date','edit_type'],
  register_company:         ['company_logo','company_mobile','company_name','company_email'],
  company_signin:           ['company_signin_email','company_signin_status','company_signin_ip'],
  company_vacancy_post:     ['vp_email','vp_job_type','vp_job_title','vp_mode','vp_comp_type','vp_comp_period','vp_method','vp_source'],
};

/* preset value options per payload key — when set, the value input becomes a searchable custom dropdown */
const PAYLOAD_VALUES = {
  /* yes/no flags */
  is_from_refund:        ['yes', 'no'],
  referral:              ['yes', 'no'],
  express:               ['yes', 'no'],
  setreminder:           ['yes', 'no'],
  visited:               ['yes', 'no'],
  refund_non_refund:     ['Non Refund', 'Refund'],
  coupon_applied:        ['yes', 'no'],
  coupon_applied_success:['yes', 'no'],
  company_logo:          ['Has Logo', 'No Logo'],

  /* on/off flags */
  instantexam:           ['on', 'off'],
  instantresult:         ['on', 'off'],

  /* enum values */
  method:                ['Google', 'Manual'],
  source:                ['web', 'app', 'organic', 'paid'],
  device:                ['mobile', 'desktop', 'tablet'],
  register_type:         ['normal', 'agency', 'iit'],
  status:                ['Completed', 'In Progress'],
  edit_type:             ['UPDATE', 'EXTEND', 'CREATE'],
  company_signin_status: ['success', 'failed'],
  vp_job_type:           ['internship', 'full-time', 'part-time'],
  vp_mode:               ['wfo', 'wfh', 'hybrid'],
  vp_comp_type:          ['Fixed', 'Range', 'Performance'],
  vp_comp_period:        ['hour', 'month', 'year'],
  vp_method:             ['full-time', 'part-time', 'contract', 'freelance'],
  vp_source:             ['Direct', 'is_cit'],
};

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

/* ─── small reusable custom dropdown with optional search ─── */
function Dropdown({ value, options, onChange, placeholder = 'Select', searchable = false, width = 'auto', minWidth = 120 }) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const opts = options.filter(o => !s || (typeof o === 'string' ? o : o.label).toLowerCase().includes(s.toLowerCase()));

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', width, minWidth }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '6px 24px 6px 10px', border: '1px solid #c4b5fd', borderRadius: 6, background: '#fff', fontSize: 12.5, color: value ? '#1e3a8a' : '#94a3b8', cursor: 'pointer', textAlign: 'left', position: 'relative', fontFamily: 'inherit' }}>
        {value || placeholder}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: 8, top: '50%', transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`, transition: 'transform .15s' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
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
                return (
                  <div key={v} onClick={() => { onChange(v); setOpen(false); setS(''); }}
                    style={{ padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, color: value === v ? '#1e3a8a' : '#334155', background: value === v ? '#eff6ff' : 'transparent', fontWeight: value === v ? 600 : 500 }}
                    onMouseEnter={e => { if (value !== v) e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={e => { if (value !== v) e.currentTarget.style.background = 'transparent'; }}>
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

/* ─── event picker dropdown with category tabs (Behaviour etc.) ─── */
function EventPicker({ value, onPick }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('Behaviour');
  const [s, setS] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const groupItems = EVENT_GROUPS[tab] || [];
  const filtered = groupItems.filter(o => !s || o.label.toLowerCase().includes(s.toLowerCase()));
  const valueLabel = (Object.values(EVENT_GROUPS).flat().find(o => o.key === value) || {}).label;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ padding: '6px 24px 6px 10px', border: '1px solid #c4b5fd', borderRadius: 6, background: '#fff', fontSize: 12.5, color: value ? '#1e3a8a' : '#94a3b8', cursor: 'pointer', position: 'relative', fontFamily: 'inherit', minWidth: 130 }}>
        {valueLabel || 'Select event'}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: 360, background: '#fff', borderRadius: 8, boxShadow: '0 10px 24px rgba(0,0,0,.15)', border: '1px solid #e2e8f0', zIndex: 200, padding: 10 }}>
          <input autoFocus value={s} onChange={e => setS(e.target.value)} placeholder="Search"
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12.5, marginBottom: 8, fontFamily: 'inherit', outline: 'none' }} />
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 6, fontSize: 11.5 }}>
            {Object.keys(EVENT_GROUPS).map(t => (
              <div key={t} onClick={() => setTab(t)}
                style={{ padding: '6px 10px', cursor: 'pointer', fontWeight: 600, color: tab === t ? '#1e3a8a' : '#94a3b8', borderBottom: `2px solid ${tab === t ? '#1e3a8a' : 'transparent'}`, marginBottom: -1 }}>
                {t}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', padding: '4px 8px' }}>{tab}</div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtered.map(o => (
              <div key={o.key} onClick={() => { onPick(o.key); setOpen(false); setS(''); }}
                style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#334155' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {o.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── single condition row ─── */
function ConditionRow({ cond, onChange, onCopy, onDelete, isFirst }) {
  /* normalise legacy multi-filter array → single filter */
  const filter = (cond.filter && typeof cond.filter === 'object')
    ? cond.filter
    : (Array.isArray(cond.filters) && cond.filters.length ? cond.filters[0] : null);
  const [showFilter, setShowFilter] = useState(!!filter);
  const payloadOpts = PAYLOAD_OPTIONS[cond.event] || [];
  const set = patch => onChange({ ...cond, ...patch });
  const setFilter = nf => set({ filter: nf, filters: undefined });
  const sourceLabel = (SOURCE_OPTS.find(o => o.value === (cond.source?.type || 'any')) || SOURCE_OPTS[0]).label;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
      {/* connector */}
      {!isFirst && (
        <div style={{ marginLeft: 8 }}>
          <Dropdown value={cond.condConnector || 'AND'} options={['AND', 'OR']} onChange={v => set({ condConnector: v })} minWidth={60} />
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        {isFirst && <span style={{ fontSize: 12, color: '#94a3b8', minWidth: 30 }}>who</span>}
        <Dropdown value={cond.did === 'did_not_do' ? 'Did Not Do' : 'Did'}
          options={[{ label: 'Did', value: 'did' }, { label: 'Did Not Do', value: 'did_not_do' }]}
          onChange={v => set({ did: v })} minWidth={80} />
        <EventPicker value={cond.event} onPick={ev => set({ event: ev })} />
        <Dropdown value="Number of occurrences" options={['Number of occurrences']} onChange={() => {}} minWidth={170} />
        <Dropdown value={Object.keys(COMP_MAP).find(k => COMP_MAP[k] === (cond.operator || '>=')) || 'is greater than or equal to'}
          options={COMP_OPS} onChange={v => set({ operator: COMP_MAP[v] })} minWidth={200} />
        <input type="number" value={cond.count ?? 1}
          onChange={e => set({ count: parseInt(e.target.value || '0', 10) })}
          style={{ width: 60, padding: '6px 10px', border: '1px solid #c4b5fd', borderRadius: 6, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', color: '#1e3a8a' }} />
        <Dropdown value={sourceLabel}
          options={SOURCE_OPTS.map(o => ({ value: o.value, label: o.label }))}
          onChange={v => set({ source: { ...(cond.source || {}), type: v, value: '' } })} minWidth={120} />
        {(cond.source?.type === 'specific_website' || cond.source?.type === 'specific_app') && (
          <input value={cond.source?.value || ''}
            placeholder={cond.source?.type === 'specific_website' ? 'e.g. example.com' : 'e.g. com.app.id'}
            onChange={e => set({ source: { ...(cond.source || {}), value: e.target.value } })}
            style={{ padding: '6px 10px', border: '1px solid #c4b5fd', borderRadius: 6, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', color: '#1e3a8a', minWidth: 160 }} />
        )}
        <Dropdown value={(() => {
          const t = cond.day?.type || 'any';
          return { any: 'Any Day', between: 'Between', in_past: 'In the past', exactly_before: 'Exactly before' }[t] || 'Any Day';
        })()} options={[
          { label: 'Any Day', value: 'any' },
          { label: 'Between', value: 'between' },
          { label: 'In the past', value: 'in_past' },
          { label: 'Exactly before', value: 'exactly_before' },
        ]} onChange={v => set({ day: { ...(cond.day || {}), type: v } })} minWidth={110} />

        {/* day extra inputs */}
        {cond.day?.type === 'between' && (
          <>
            <input type="date" value={cond.day?.from || ''} onChange={e => set({ day: { ...(cond.day || {}), from: e.target.value } })}
              style={{ padding: 5, fontSize: 12, borderRadius: 6, border: '1px solid #c4b5fd', fontFamily: 'inherit' }} />
            <input type="date" value={cond.day?.to || ''} onChange={e => set({ day: { ...(cond.day || {}), to: e.target.value } })}
              style={{ padding: 5, fontSize: 12, borderRadius: 6, border: '1px solid #c4b5fd', fontFamily: 'inherit' }} />
          </>
        )}
        {(cond.day?.type === 'in_past' || cond.day?.type === 'exactly_before') && (
          <>
            <input type="number" value={cond.day?.n || 7} onChange={e => set({ day: { ...(cond.day || {}), n: parseInt(e.target.value || '0', 10) } })}
              style={{ width: 60, padding: 6, border: '1px solid #c4b5fd', borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }} />
            <Dropdown value={cond.day?.unit || 'days'} options={['hours', 'days', 'weeks', 'months']}
              onChange={v => set({ day: { ...(cond.day || {}), unit: v } })} minWidth={80} />
          </>
        )}

        {/* action icons */}
        <span style={{ marginLeft: 6, display: 'inline-flex', gap: 4 }}>
          <button title="Add Filter" onClick={() => { setShowFilter(s => !s); if (!showFilter && !filter) setFilter({ payload: '', op: 'is', value: '' }); }}
            style={{ width: 28, height: 28, border: `1px solid ${showFilter ? '#1e3a8a' : '#e2e8f0'}`, background: showFilter ? '#eff6ff' : '#fff', borderRadius: 6, cursor: 'pointer', color: showFilter ? '#1e3a8a' : '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          </button>
          <button title="Copy" onClick={onCopy}
            style={{ width: 28, height: 28, border: '1px solid #e2e8f0', background: '#fff', borderRadius: 6, cursor: 'pointer', color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          </button>
          <button title="Delete" onClick={onDelete}
            style={{ width: 28, height: 28, border: '1px solid #e2e8f0', background: '#fff', borderRadius: 6, cursor: 'pointer', color: '#dc2626', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
          </button>
        </span>
      </div>

      {/* single filter row */}
      {showFilter && filter && (
        <div style={{ marginLeft: 50, display: 'flex', gap: 6, alignItems: 'center' }}>
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
              style={{ padding: '6px 10px', border: '1px solid #c4b5fd', borderRadius: 6, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', color: '#1e3a8a', width: 160 }} />
          )}
          <button onClick={() => { setShowFilter(false); set({ filter: undefined, filters: undefined }); }}
            style={{ width: 28, height: 28, border: '1px solid #e2e8f0', background: '#fff', borderRadius: 6, cursor: 'pointer', color: '#dc2626' }}>×</button>
        </div>
      )}
    </div>
  );
}

/* ─── block (a card) containing many conditions ─── */
function Block({ block, onChange, onDelete, isFirst, blockNumber }) {
  const set = patch => onChange({ ...block, ...patch });
  const setCond = (i, c) => { const arr = [...(block.conditions || [])]; arr[i] = c; set({ conditions: arr }); };
  const addCond = () => set({ conditions: [...(block.conditions || []), { did: 'did', event: '', operator: '>=', count: 1, source: { type: 'any', value: '' }, day: { type: 'any' }, filter: null, condConnector: 'AND' }] });
  const removeCond = i => set({ conditions: (block.conditions || []).filter((_, idx) => idx !== i) });
  const copyCond = i => { const c = block.conditions[i]; set({ conditions: [...block.conditions, { ...c, condConnector: 'AND' }] }); };

  return (
    <div style={{ position: 'relative', padding: 14, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 600 }}>Block {blockNumber}</div>
        {!isFirst && <button onClick={onDelete}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 13 }}>Delete block</button>}
      </div>
      {!isFirst && (
        <div style={{ marginBottom: 8 }}>
          <Dropdown value={block.blockConnector || 'AND'} options={['AND', 'OR']} onChange={v => set({ blockConnector: v })} minWidth={60} />
        </div>
      )}
      {(block.conditions || []).map((c, i) => (
        <ConditionRow key={i} cond={c}
          isFirst={i === 0}
          onChange={nc => setCond(i, nc)}
          onCopy={() => copyCond(i)}
          onDelete={() => removeCond(i)} />
      ))}
      <button onClick={addCond} className="nc-add-anim" style={{ marginTop: 8 }}>
        <span>+ ADD</span>
      </button>
    </div>
  );
}

/* ─── main page ─── */
export default function NetcoreSegmentCreate() {
  const { id } = useParams();
  const nav = useNavigate();
  const isEdit = !!id;

  const [name, setName]               = useState('Untitled segment');
  const [contactType, setContactType] = useState('all_identified');
  const [include, setInclude]         = useState({ blocks: [{ blockConnector: 'AND', conditions: [] }] });
  const [exclude, setExclude]         = useState({ blocks: [{ blockConnector: 'AND', conditions: [] }] });
  const [count, setCount]             = useState(null);
  const [counting, setCounting]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [exitOpen, setExitOpen]       = useState(false);

  /* load existing if editing */
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await api.post(API, new URLSearchParams({ action: 'get', id }), FORM);
        if (res.data.status === 'success') {
          const seg = res.data.segment;
          setName(seg.name);
          setContactType(seg.contact_type);
          if (seg.config?.include?.blocks) setInclude(seg.config.include);
          if (seg.config?.exclude?.blocks) setExclude(seg.config.exclude);
          setCount(seg.user_count);
        }
      } catch { toast.error('Failed to load segment'); }
    })();
  }, [id]); // eslint-disable-line

  const buildConfig = () => ({ contact_type: contactType, include, exclude });

  const getCount = async () => {
    setCounting(true); setCount(null);
    try {
      const res = await api.post(API, new URLSearchParams({ action: 'count', config: JSON.stringify(buildConfig()) }), FORM);
      if (res.data.status === 'success') setCount(res.data.count);
      else toast.error(res.data.message || 'Failed');
    } catch { toast.error('Network error'); } finally { setCounting(false); }
  };

  const save = async () => {
    if (!name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      const params = new URLSearchParams({ action: 'save', name: name.trim(), contact_type: contactType, config: JSON.stringify(buildConfig()) });
      if (isEdit) params.append('id', id);
      const res = await api.post(API, params, FORM);
      if (res.data.status === 'success') { toast.success('Saved'); nav('/netcore/segments'); }
      else toast.error(res.data.message || 'Failed');
    } catch { toast.error('Network error'); } finally { setSaving(false); }
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
      <button onClick={() => updateBlocks(key, [...(state.blocks || []), { blockConnector: 'AND', conditions: [] }])}
        className="nc-add-anim nc-add-anim-block">
        <span>+ ADD BLOCK</span>
      </button>
    </>
  );

  return (
    <>
      <style>{`
        .nc-sg *{ box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }

        /* ── animated running-border button ── */
        @keyframes nc_run_border { to { background-position: 200% 0; } }
        .nc-add-anim {
          padding: 1.5px;
          border-radius: 7px;
          background: linear-gradient(90deg, #1e3a8a, #c4b5fd, #1e3a8a, #c4b5fd, #1e3a8a) 0 0 / 200% 100%;
          animation: nc_run_border 2s linear infinite;
          border: none; cursor: pointer; font-family: inherit;
        }
        .nc-add-anim > span {
          display: block; background: #fff; border-radius: 5.5px;
          padding: 6px 14px; color: #1e3a8a; font-size: 12px; font-weight: 700; letter-spacing: .3px;
        }
        .nc-add-anim-block { margin: 6px auto 0; display: block; }
        .nc-add-anim-block > span { padding: 8px 18px; }
        .nc-add-anim:hover > span { background: #f5f3ff; }
      `}</style>
      <div className="nc-sg" style={{ position: 'fixed', inset: 0, background: '#f1f0ff', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 1000 }}>

        {/* top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button title="Back" onClick={() => setExitOpen(true)}
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
          <button onClick={save} disabled={saving}
            style={{ padding: '9px 26px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: '.4px', cursor: saving ? 'not-allowed' : 'pointer', textTransform: 'uppercase', opacity: saving ? .6 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 20 }}>
          {/* contact type */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 12.5, color: '#475569' }}>Contact type:</span>
            <Dropdown value={contactType === 'all_identified' ? 'All identified' : contactType}
              options={[{ label: 'All identified', value: 'all_identified' }]}
              onChange={v => setContactType(v)} minWidth={150} />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <button onClick={getCount} disabled={counting}
              style={{ padding: '9px 22px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: '.4px', cursor: counting ? 'not-allowed' : 'pointer', textTransform: 'uppercase', opacity: counting ? .6 : 1 }}>
              {counting ? 'Counting…' : 'Get Count'}
            </button>
            <div style={{ background: '#fff', border: '1px solid #1e3a8a', borderRadius: 8, padding: '14px 22px', minWidth: 150 }}>
              <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 4 }}>User count</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{count === null ? '-' : Number(count).toLocaleString()}</div>
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
                <button onClick={() => setExitOpen(false)}
                  style={{ padding: '9px 22px', background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: '.4px', cursor: 'pointer', textTransform: 'uppercase', fontFamily: 'inherit' }}>
                  No
                </button>
                <button onClick={() => { setExitOpen(false); nav('/netcore/segments'); }}
                  style={{ padding: '9px 26px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: '.4px', cursor: 'pointer', textTransform: 'uppercase', fontFamily: 'inherit' }}>
                  Yes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
