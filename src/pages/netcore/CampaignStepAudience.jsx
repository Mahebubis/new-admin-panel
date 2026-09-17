import { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const SEG_API = '/api/netcore/segments.php';
const LISTS_API = '/api/lists/lists.php';
const CAMP_API = '/api/campaigns/campaigns.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 18 };
const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 };
const Toggle = ({ on, onClick }) => (
  <button type="button" onClick={onClick} style={{ width: 38, height: 21, borderRadius: 999, border: 'none', background: on ? '#16a34a' : '#cbd5e1', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
    <span style={{ position: 'absolute', top: 2, left: on ? 19 : 2, width: 17, height: 17, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
  </button>
);
const Radio = ({ on }) => (
  <span style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${on ? '#1e3a8a' : '#cbd5e1'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    {on && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1e3a8a' }} />}
  </span>
);

// Segments and Lists are separate auto-increment sequences and CAN numerically collide
// (segment #7 and list #7 both existing) — every selected/blocked/lookup operation below
// is keyed by a composite "type:id" string so the two can never be confused with each other.
const ckey = (type, id) => `${type}:${id}`;
const findOption = (options, key) => options.find(o => ckey(o._type, o.id) === key);
const keyIn = (list, key) => list.some(x => String(x) === String(key));

function fmtSegDt(s) {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d.getTime())) return s;
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function TypeBadge({ type }) {
  const isList = type === 'list';
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 5, letterSpacing: '.3px',
      background: isList ? '#dcfce7' : '#eef2ff', color: isList ? '#15803d' : '#4338ca', marginRight: 6, whiteSpace: 'nowrap',
    }}>
      {isList ? 'LIST' : 'SEGMENT'}
    </span>
  );
}

/** Unified Segments + Lists picker — `options` is the merged array, each row tagged
 *  `_type: 'segment'|'list'`. `selected`/`blockedIds`/`onChange` all operate on
 *  composite "type:id" keys (see ckey() above), not raw numeric ids. */
function AudiencePicker({ options, selected, onChange, max, blockedIds = [], blockedLabel = 'already used in the other list' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const toggle = key => {
    // Removing is ALWAYS allowed, even for a currently-conflicting row — otherwise
    // something that ended up in both lists could never be taken back out.
    if (keyIn(selected, key)) { onChange(selected.filter(x => String(x) !== String(key))); return; }
    if (keyIn(blockedIds, key)) return; // can't newly add something already used in the other list
    if (!max || selected.length < max) onChange([...selected, key]);
  };

  const filtered = options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ minHeight: 42, border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '6px 34px 6px 8px', cursor: 'pointer', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', position: 'relative' }}>
        {selected.length === 0 && <span style={{ color: '#94a3b8', fontSize: 12.5, padding: '4px 4px' }}>Select segments or lists…</span>}
        {selected.map(key => {
          const o = findOption(options, key);
          const conflict = keyIn(blockedIds, key);
          return (
            <span key={key} style={{ background: conflict ? '#fee2e2' : '#6d5bd0', color: conflict ? '#dc2626' : '#fff', fontSize: 11.5, fontWeight: 600, padding: '4px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title={conflict ? "Also selected in the other list — remove one" : undefined}>
              {o ? o.name : `#${key}`}
              <span onClick={e => { e.stopPropagation(); toggle(key); }} style={{ cursor: 'pointer', opacity: .85 }}>×</span>
            </span>
          );
        })}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2.4} style={{ position: 'absolute', right: 10, top: '50%', transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)` }}><path d="M6 9l6 6 6-6" /></svg>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 10px 24px rgba(0,0,0,.12)', zIndex: 40, overflow: 'hidden' }}>
          <div style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ position: 'relative' }}>
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search segments and lists"
                style={{ width: '100%', padding: '8px 32px 8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </div>
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                <tr>
                  <th style={{ width: 34, padding: '8px 8px' }} />
                  <th style={{ textAlign: 'left', padding: '8px 8px', fontWeight: 600, color: '#64748b', fontSize: 10.5 }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '8px 8px', fontWeight: 600, color: '#64748b', fontSize: 10.5 }}>ID No.</th>
                  <th style={{ textAlign: 'left', padding: '8px 8px', fontWeight: 600, color: '#64748b', fontSize: 10.5 }}>No. of Contacts</th>
                  <th style={{ textAlign: 'left', padding: '8px 8px', fontWeight: 600, color: '#64748b', fontSize: 10.5, whiteSpace: 'nowrap' }}>Last refreshed</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 18, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                    {options.length === 0 ? 'No segments or lists yet — create one under Audience.' : 'No matches.'}
                  </td></tr>
                )}
                {filtered.map(o => {
                  const key = ckey(o._type, o.id);
                  const isSel = keyIn(selected, key);
                  const isBlocked = !isSel && keyIn(blockedIds, key);
                  const count = o._type === 'list' ? o.contact_count : o.user_count;
                  const refreshed = o._type === 'list' ? o.updated_at : o.user_count_refreshed_at;
                  return (
                    <tr key={key} onClick={() => !isBlocked && toggle(key)}
                      style={{ cursor: isBlocked ? 'not-allowed' : 'pointer', background: isSel ? '#eef2ff' : 'transparent', opacity: isBlocked ? 0.45 : 1 }}
                      onMouseEnter={e => { if (!isSel && !isBlocked) e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={e => { if (!isSel && !isBlocked) e.currentTarget.style.background = 'transparent'; }}>
                      <td style={{ padding: '8px 8px' }}>
                        <input type="checkbox" checked={isSel} disabled={isBlocked} readOnly
                          style={{ cursor: isBlocked ? 'not-allowed' : 'pointer', width: 14, height: 14 }} />
                      </td>
                      <td style={{ padding: '8px 8px', color: '#334155', fontWeight: 500 }}>
                        <TypeBadge type={o._type} />{o.name}
                        {isBlocked && <div style={{ color: '#c2410c', fontSize: 9.5, fontWeight: 700, marginTop: 2 }}>{blockedLabel}</div>}
                      </td>
                      <td style={{ padding: '8px 8px', color: '#94a3b8' }}>{o.id}</td>
                      <td style={{ padding: '8px 8px', color: '#94a3b8' }}>{Number(count || 0).toLocaleString()}</td>
                      <td style={{ padding: '8px 8px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmtSegDt(refreshed)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '8px 12px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', fontSize: 11.5, color: '#475569', fontWeight: 600 }}>
            Selected: {selected.length}{max ? ` / ${max}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CampaignStepAudience({ draft, setField, onValidChange, onSegmentNamesChange, onListNamesChange }) {
  const [segments, setSegments] = useState([]);
  const [lists, setLists] = useState([]);
  const [loadingSegs, setLoadingSegs] = useState(true);
  const [countLoading, setCountLoading] = useState(false);
  // matched/excluded ride along with the reachable count. Kept in local state rather than on the
  // draft: they are derived figures, and putting them on the draft would have the wizard warning
  // about unsaved changes every time the count refreshes.
  const [stats, setStats] = useState({ matched: 0, excluded: 0 });
  const [exporting, setExporting] = useState(false);
  /*
    Whether verification CAN run (an Elastic Email key exists) and what a campaign that has never
    chosen should show. Both come from the account, so the card is hidden entirely when there is no
    key — offering a switch that silently does nothing is worse than not offering it.
  */
  const [verifyPossible, setVerifyPossible] = useState(false);
  const [verifyDefault, setVerifyDefault] = useState(false);
  const abortRef = useRef(null);
  const toastedForRef = useRef(''); // dedupe: only toast once per distinct overlap set

  /*
    What the switch shows. The draft's own answer when it has one, the account default when it does
    not — a campaign carrying null really will be verified if the default is on, so showing it as
    off would misrepresent what pressing Send does.
  */
  const verifyOn = draft.verify_before_send === null || draft.verify_before_send === undefined
    ? verifyDefault
    : !!Number(draft.verify_before_send);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.post(CAMP_API, new URLSearchParams({ action: 'domains' }), FORM);
        if (!res.data.success) return;
        setVerifyPossible(!!res.data.data.verify_possible);
        setVerifyDefault(!!res.data.data.verify_default);
      } catch { /* non-critical — the card just stays hidden */ }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingSegs(true);
      try {
        const [segRes, listRes] = await Promise.all([
          api.post(SEG_API, new URLSearchParams({ action: 'list', page: 1, per_page: 100 }), FORM),
          api.post(LISTS_API, new URLSearchParams({ action: 'list', page: 1, per_page: 100 }), FORM),
        ]);
        if (segRes.data.status === 'success') {
          setSegments(segRes.data.segments || []);
          const map = {}; (segRes.data.segments || []).forEach(s => { map[s.id] = s.name; });
          onSegmentNamesChange?.(map);
        }
        if (listRes.data.success) {
          setLists(listRes.data.data.lists || []);
          const map = {}; (listRes.data.data.lists || []).forEach(l => { map[l.id] = l.name; });
          onListNamesChange?.(map);
        }
      } finally { setLoadingSegs(false); }
    })();
  }, []); // eslint-disable-line

  const segmentOptions = segments.map(s => ({ ...s, _type: 'segment' }));
  const options = [...segmentOptions, ...lists.map(l => ({ ...l, _type: 'list' }))];

  // Composite "type:id" arrays are how the picker itself works; draft.segment_ids/
  // draft.list_ids (two separate numeric arrays) are what actually gets saved.
  const selectedComposite = [
    ...(draft.segment_ids || []).map(id => ckey('segment', id)),
    ...(draft.list_ids || []).map(id => ckey('list', id)),
  ];
  // Exclude takes Segments AND Lists, saved to draft.exclude_segment_ids /
  // draft.exclude_list_ids exactly like the audience pair above. Server-side the two are
  // merged into one set of emails and subtracted from the whole audience — segment-sourced
  // and list-sourced alike (see AudienceResolver.php's audience_exclude_emails_sql()).
  const excludeComposite = [
    ...(draft.exclude_segment_ids || []).map(id => ckey('segment', id)),
    ...(draft.exclude_list_ids || []).map(id => ckey('list', id)),
  ];
  const splitComposite = keys => {
    const segIds = [], listIds = [];
    keys.forEach(k => {
      const [type, id] = String(k).split(':');
      (type === 'list' ? listIds : segIds).push(id);
    });
    return { segIds, listIds };
  };
  const onAudienceChange = keys => {
    const { segIds, listIds } = splitComposite(keys);
    setField('segment_ids', segIds); setField('list_ids', listIds);
  };
  const onExcludeChange = keys => {
    const { segIds, listIds } = splitComposite(keys);
    setField('exclude_segment_ids', segIds); setField('exclude_list_ids', listIds);
  };

  const overlapKeys = draft.exclude_enabled ? selectedComposite.filter(k => keyIn(excludeComposite, k)) : [];
  const hasOverlap = overlapKeys.length > 0;

  const valid = (draft.audience_type === 'all_contacts' || selectedComposite.length > 0) && !hasOverlap;
  useEffect(() => { onValidChange(valid); }, [valid]); // eslint-disable-line

  useEffect(() => {
    const key = [...overlapKeys].map(String).sort().join(',');
    if (hasOverlap && key !== toastedForRef.current) {
      const names = overlapKeys.map(k => findOption(options, k)?.name || `#${k}`).join(', ');
      toast.error(`"${names}" can't be in both the audience and the exclude list.`);
      toastedForRef.current = key;
    } else if (!hasOverlap) {
      toastedForRef.current = '';
    }
  }, [hasOverlap, overlapKeys.join(','), options.length]); // eslint-disable-line

  /* The audience as the server needs it, built once. Shared by the live count and the CSV
     export so the file can never describe a different audience than the number on screen. */
  const audienceParams = () => ({
    audience_type: draft.audience_type,
    segment_ids: JSON.stringify(draft.segment_ids || []),
    list_ids: JSON.stringify(draft.list_ids || []),
    exclude_segment_ids: JSON.stringify(draft.exclude_enabled ? (draft.exclude_segment_ids || []) : []),
    exclude_list_ids: JSON.stringify(draft.exclude_enabled ? (draft.exclude_list_ids || []) : []),
    domain_filter: draft.domain_enabled ? (draft.domain_filter || '') : '',
  });

  const downloadAudience = async () => {
    setExporting(true);
    const t = toast.loading('Preparing your file…');
    try {
      const body = new URLSearchParams({ action: 'audience_export', name: draft.name || 'audience', ...audienceParams() });
      const res = await api.post(CAMP_API, body, { ...FORM, responseType: 'blob' });
      const slug = (draft.name || 'audience').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'audience';
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = slug + '-audience.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Downloaded', { id: t });
    } catch { toast.error('Could not prepare the file', { id: t }); }
    finally { setExporting(false); }
  };

  const depsKey = JSON.stringify([draft.audience_type, draft.segment_ids, draft.list_ids, draft.exclude_enabled, draft.exclude_segment_ids, draft.exclude_list_ids, draft.domain_enabled, draft.domain_filter]);
  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    const t = setTimeout(async () => {
      setCountLoading(true);
      try {
        const body = new URLSearchParams({ action: 'audience_count', ...audienceParams() });
        const res = await api.post(CAMP_API, body, { ...FORM, signal: ctrl.signal });
        if (res.data.success) {
          const d = res.data.data;
          setField('reachable_count', d.count);
          setStats({ matched: d.matched ?? d.count, excluded: d.excluded || 0 });
        }
      } catch { /* aborted or failed — ignore, next debounce will retry */ }
      finally { setCountLoading(false); }
    }, 450);
    return () => clearTimeout(t);
  }, [depsKey]); // eslint-disable-line

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Target audience</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>Create a target audience for your campaign.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#eef2ff', color: '#1e3a8a', padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
              {countLoading ? '…' : Number(draft.reachable_count || 0).toLocaleString()} reachable
            </div>
            {/* The audience exactly as it stands — exclusions and Blocklist already taken out,
                which is the list someone wants to eyeball before a send goes out. */}
            <button type="button" onClick={downloadAudience}
              disabled={exporting || countLoading || !Number(draft.reachable_count || 0)}
              title="Download this audience as a CSV (opens in Excel)"
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999,
                border: '1.5px solid #e2e8f0', background: '#fff', color: '#334155', fontSize: 12,
                fontWeight: 700, fontFamily: 'inherit',
                cursor: exporting || countLoading || !Number(draft.reachable_count || 0) ? 'not-allowed' : 'pointer',
                opacity: exporting || countLoading || !Number(draft.reachable_count || 0) ? 0.55 : 1,
              }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              {exporting ? 'Preparing…' : 'Download CSV'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 22, marginBottom: 16 }}>
          {[['all_contacts', 'All contacts'], ['segments', 'Segments/Lists'], ['adhoc', 'Ad-hoc segment']].map(([val, lbl]) => (
            <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: val === 'adhoc' ? 'not-allowed' : 'pointer', opacity: val === 'adhoc' ? 0.5 : 1 }}
              onClick={() => val !== 'adhoc' && setField('audience_type', val)}>
              <Radio on={draft.audience_type === val} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{lbl}{val === 'adhoc' && <span style={{ fontSize: 9, color: '#94a3b8', marginLeft: 6 }}>COMING SOON</span>}</span>
            </label>
          ))}
        </div>

        {draft.audience_type === 'segments' && (
          <AudiencePicker options={options} selected={selectedComposite} onChange={onAudienceChange}
            blockedIds={draft.exclude_enabled ? excludeComposite : []} blockedLabel="already in exclude list" />
        )}
        {loadingSegs && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>Loading segments &amp; lists…</div>}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Exclude contacts</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>Remove contacts belonging to selected segment(s)/list(s) from the audience above.</div>
          </div>
          <Toggle on={draft.exclude_enabled} onClick={() => setField('exclude_enabled', !draft.exclude_enabled)} />
        </div>
        {hasOverlap && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '10px 12px', marginTop: 14, fontSize: 12 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            <span>
              <b>{overlapKeys.map(k => findOption(options, k)?.name || `#${k}`).join(', ')}</b> {overlapKeys.length === 1 ? 'is' : 'are'} selected in both the audience and the exclude list — the same one can't be in both. Click the <b>×</b> on the red chip to remove it from one of them.
            </span>
          </div>
        )}
        {draft.exclude_enabled && (
          <div style={{ marginTop: 14 }}>
            <label style={label}>List / Segment <span style={{ fontWeight: 500, color: '#94a3b8' }}>(up to 15)</span></label>
            <AudiencePicker options={options} selected={excludeComposite} onChange={onExcludeChange} max={15}
              blockedIds={selectedComposite} blockedLabel="already in audience" />
            {/* What the exclusion actually cost, in contacts — a number that only shrinks with
                no stated reason is the thing people end up not trusting. */}
            {excludeComposite.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12, padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, color: '#475569' }}>
                <span><b style={{ color: '#0f172a' }}>{countLoading ? '…' : stats.matched.toLocaleString()}</b> matched</span>
                <span style={{ color: '#cbd5e1' }}>−</span>
                <span><b style={{ color: '#dc2626' }}>{countLoading ? '…' : stats.excluded.toLocaleString()}</b> excluded</span>
                <span style={{ color: '#cbd5e1' }}>=</span>
                <span><b style={{ color: '#15803d' }}>{countLoading ? '…' : Number(draft.reachable_count || 0).toLocaleString()}</b> reachable</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/*
        VERIFY THIS CAMPAIGN'S AUDIENCE.

        Here rather than in Settings because it is a decision about THIS audience, and the right
        answer differs campaign to campaign: a freshly imported list is worth checking address by
        address, and a segment of students who have been receiving mail for a year is not — the
        verification credits would buy nothing.

        Beside Domain filters because the two do the same kind of thing: both take people out of the
        audience before it is queued.
      */}
      {verifyPossible && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0, paddingRight: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Verify addresses first</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2, lineHeight: 1.55 }}>
                Check each address really exists before this campaign is queued. Anything that comes back
                <b> invalid</b> or <b> high risk</b> goes on the Blocklist and is left out of this send and
                every one after it.
              </div>
            </div>
            <Toggle on={!!verifyOn} onClick={() => setField('verify_before_send', verifyOn ? 0 : 1)} />
          </div>
          <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 10, lineHeight: 1.55,
                        borderTop: '1px solid #f1f5f9', paddingTop: 9 }}>
            <b>Each address is checked once, ever.</b> Anyone already verified by an earlier campaign or
            journey is decided from the stored verdict with no API call, so overlapping audiences and
            re-imported lists cost nothing extra.
            {draft.verify_before_send === null && verifyDefault && (
              <> This campaign is following the account default, which is on.</>
            )}
          </div>
        </div>
      )}

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Domain filters</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>Include only a specific email domain from your selected audience.</div>
          </div>
          <Toggle on={draft.domain_enabled} onClick={() => setField('domain_enabled', !draft.domain_enabled)} />
        </div>
        {draft.domain_enabled && (
          <div style={{ marginTop: 14 }}>
            <label style={label}>Domain</label>
            <input style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              value={draft.domain_filter || ''} onChange={e => setField('domain_filter', e.target.value.replace(/^@/, ''))} placeholder="e.g. gmail.com" />
          </div>
        )}
      </div>
    </div>
  );
}
