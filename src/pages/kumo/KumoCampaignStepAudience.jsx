/*
 * Kumo campaign wizard — step 2, Audience.
 *
 * A straight port of the Netcore Audience step: the same searchable
 * Lists/Segments table-dropdown, the same live "reachable" pill, the same
 * exclude card with the overlap guard, and the same matched − excluded =
 * reachable read-out underneath it.
 *
 * ONE DIFFERENCE, AND IT IS THE API'S: a Kumo campaign has a single
 * audience_type ('all_contacts' | 'list' | 'segment'), so the picker shows one
 * kind at a time rather than merging both into one box. Exclusions are lists
 * only, which is all campaign_save accepts.
 */
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { kapi } from './kumoShared';

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

const keyIn = (list, id) => list.some(x => String(x) === String(id));
const findOption = (options, id) => options.find(o => String(o.id) === String(id));

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

/** Searchable table-dropdown over lists OR segments. `selected`/`blockedIds` are plain ids. */
function AudiencePicker({ options, kind, selected, onChange, max, blockedIds = [], blockedLabel = 'already used in the other list', emptyText }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const toggle = id => {
    // Removing is ALWAYS allowed, even for a currently-conflicting row — otherwise
    // something that ended up in both lists could never be taken back out.
    if (keyIn(selected, id)) { onChange(selected.filter(x => String(x) !== String(id))); return; }
    if (keyIn(blockedIds, id)) return;
    if (!max || selected.length < max) onChange([...selected, String(id)]);
  };

  const filtered = options.filter(o => String(o.name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ minHeight: 42, border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '6px 34px 6px 8px', cursor: 'pointer', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', position: 'relative' }}>
        {selected.length === 0 && <span style={{ color: '#94a3b8', fontSize: 12.5, padding: '4px 4px' }}>Select {kind === 'segment' ? 'segments' : 'lists'}…</span>}
        {selected.map(id => {
          const o = findOption(options, id);
          const conflict = keyIn(blockedIds, id);
          return (
            <span key={id} style={{ background: conflict ? '#fee2e2' : '#6d5bd0', color: conflict ? '#dc2626' : '#fff', fontSize: 11.5, fontWeight: 600, padding: '4px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              title={conflict ? 'Also selected in the other list — remove one' : undefined}>
              {o ? o.name : `#${id}`}
              <span onClick={e => { e.stopPropagation(); toggle(id); }} style={{ cursor: 'pointer', opacity: .85 }}>×</span>
            </span>
          );
        })}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2.4} style={{ position: 'absolute', right: 10, top: '50%', transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)` }}><path d="M6 9l6 6 6-6" /></svg>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 10px 24px rgba(0,0,0,.12)', zIndex: 40, overflow: 'hidden' }}>
          <div style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ position: 'relative' }}>
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${kind === 'segment' ? 'segments' : 'lists'}`}
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
                    {options.length === 0 ? (emptyText || 'Nothing here yet — create one under Audience.') : 'No matches.'}
                  </td></tr>
                )}
                {filtered.map(o => {
                  const isSel = keyIn(selected, o.id);
                  const isBlocked = !isSel && keyIn(blockedIds, o.id);
                  const count = kind === 'segment' ? (o.email_count ?? o.contact_count) : o.contact_count;
                  const refreshed = kind === 'segment' ? (o.counted_at || o.updated_at) : (o.updated_at || o.created_at);
                  return (
                    <tr key={o.id} onClick={() => !isBlocked && toggle(o.id)}
                      style={{ cursor: isBlocked ? 'not-allowed' : 'pointer', background: isSel ? '#eef2ff' : 'transparent', opacity: isBlocked ? 0.45 : 1 }}
                      onMouseEnter={e => { if (!isSel && !isBlocked) e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={e => { if (!isSel && !isBlocked) e.currentTarget.style.background = 'transparent'; }}>
                      <td style={{ padding: '8px 8px' }}>
                        <input type="checkbox" checked={isSel} disabled={isBlocked} readOnly
                          style={{ cursor: isBlocked ? 'not-allowed' : 'pointer', width: 14, height: 14 }} />
                      </td>
                      <td style={{ padding: '8px 8px', color: '#334155', fontWeight: 500 }}>
                        <TypeBadge type={kind} />{o.name}
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

export default function KumoCampaignStepAudience({ draft, setField, onValidChange, onSegmentNamesChange, onListNamesChange }) {
  const [segments, setSegments] = useState([]);
  const [lists, setLists] = useState([]);
  const [loadingSegs, setLoadingSegs] = useState(true);
  const [countLoading, setCountLoading] = useState(false);
  /* matched/excluded ride along with the reachable count. Kept in local state rather than on the
     draft: they are derived figures, and putting them on the draft would have the wizard warning
     about unsaved changes every time the count refreshes. */
  const [stats, setStats] = useState({ matched: 0, excluded: 0 });
  const toastedForRef = useRef('');
  const reqRef = useRef(0);

  useEffect(() => {
    (async () => {
      setLoadingSegs(true);
      try {
        const [listRes, segRes] = await Promise.all([
          kapi('lists_list').catch(() => ({ lists: [] })),
          kapi('segments_list').catch(() => ({ segments: [] })),
        ]);
        const ls = listRes?.lists || [];
        const sg = segRes?.segments || [];
        setLists(ls);
        setSegments(sg);
        const lm = {}; ls.forEach(l => { lm[l.id] = l.name; });
        const sm = {}; sg.forEach(s => { sm[s.id] = s.name; });
        onListNamesChange?.(lm);
        onSegmentNamesChange?.(sm);
      } finally { setLoadingSegs(false); }
    })();
  }, []); // eslint-disable-line

  const listIds = (draft.list_ids || []).map(String);
  const segmentIds = (draft.segment_ids || []).map(String);
  const excludeIds = (draft.exclude_list_ids || []).map(String);

  const selectedIds = draft.audience_type === 'segment' ? segmentIds : listIds;

  /* Only lists can be excluded, so an overlap can only ever be a list that is both in the
     audience and in the exclude box. */
  const overlapIds = draft.exclude_enabled && draft.audience_type === 'list'
    ? listIds.filter(id => keyIn(excludeIds, id))
    : [];
  const hasOverlap = overlapIds.length > 0;

  /* A list or segment must actually be chosen — "all contacts" is no longer a
     valid audience, so a stale draft carrying it does not pass this step. */
  const valid = selectedIds.length > 0 && draft.audience_type !== 'all_contacts' && !hasOverlap;
  useEffect(() => { onValidChange(valid); }, [valid]); // eslint-disable-line

  useEffect(() => {
    const key = [...overlapIds].map(String).sort().join(',');
    if (hasOverlap && key !== toastedForRef.current) {
      const names = overlapIds.map(id => findOption(lists, id)?.name || `#${id}`).join(', ');
      toast.error(`"${names}" can't be in both the audience and the exclude list.`);
      toastedForRef.current = key;
    } else if (!hasOverlap) {
      toastedForRef.current = '';
    }
  }, [hasOverlap, overlapIds.join(','), lists.length]); // eslint-disable-line

  /* Live reachable count — debounced, because this is a full audience resolve on the server and
     every change would otherwise queue another one. A request counter, not an AbortController:
     kapi() owns the axios call, so the cheap correct thing is to ignore stale answers. */
  const depsKey = JSON.stringify([draft.audience_type, listIds, segmentIds, draft.exclude_enabled, excludeIds]);
  useEffect(() => {
    const t = setTimeout(async () => {
      const mine = ++reqRef.current;
      if (draft.audience_type === 'list' && listIds.length === 0) { setField('reachable_count', 0); setStats({ matched: 0, excluded: 0 }); return; }
      if (draft.audience_type === 'segment' && segmentIds.length === 0) { setField('reachable_count', 0); setStats({ matched: 0, excluded: 0 }); return; }
      setCountLoading(true);
      try {
        const d = await kapi('campaign_preview_audience', {
          audience_type: draft.audience_type,
          list_ids: listIds,
          segment_ids: segmentIds,
          exclude_list_ids: draft.exclude_enabled ? excludeIds : [],
        });
        if (mine !== reqRef.current) return; // a newer request already answered
        const count = Number(d?.count || 0);
        setField('reachable_count', count);
        setStats({ matched: Number(d?.matched ?? count), excluded: Number(d?.excluded || 0) });
      } catch { /* failed — the next debounce retries */ }
      finally { if (mine === reqRef.current) setCountLoading(false); }
    }, 450);
    return () => clearTimeout(t);
  }, [depsKey]); // eslint-disable-line

  const onAudienceChange = ids => {
    if (draft.audience_type === 'segment') setField('segment_ids', ids);
    else setField('list_ids', ids);
  };

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
          </div>
        </div>

        <div style={{ display: 'flex', gap: 22, marginBottom: 16 }}>
          {/* "All contacts" was removed on purpose: sending to everyone is how a
              warming IP gets burned. A campaign must name a list or a segment. */}
          {[['list', 'Lists'], ['segment', 'Segments']].map(([val, lbl]) => (
            <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              onClick={() => setField('audience_type', val)}>
              <Radio on={draft.audience_type === val} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{lbl}</span>
            </label>
          ))}
        </div>

        {draft.audience_type === 'list' && (
          <AudiencePicker options={lists} kind="list" selected={listIds} onChange={onAudienceChange}
            blockedIds={draft.exclude_enabled ? excludeIds : []} blockedLabel="already in exclude list"
            emptyText="No lists yet — create one under Audience → Lists." />
        )}
        {draft.audience_type === 'segment' && (
          <AudiencePicker options={segments} kind="segment" selected={segmentIds} onChange={onAudienceChange}
            emptyText="No segments yet — create one under Audience → Segments." />
        )}
        {/* A draft saved before "All contacts" was removed still carries that
            value; nudge it back to a list rather than silently sending to all. */}
        {draft.audience_type === 'all_contacts' && (
          <div style={{ fontSize: 11.5, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px' }}>
            This draft was set to “all contacts”, which is no longer allowed — pick a list or a segment above.
          </div>
        )}
        {loadingSegs && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>Loading lists &amp; segments…</div>}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Exclude contacts</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>Remove contacts belonging to selected list(s) from the audience above.</div>
          </div>
          <Toggle on={!!draft.exclude_enabled} onClick={() => setField('exclude_enabled', !draft.exclude_enabled)} />
        </div>
        {hasOverlap && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '10px 12px', marginTop: 14, fontSize: 12 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            <span>
              <b>{overlapIds.map(id => findOption(lists, id)?.name || `#${id}`).join(', ')}</b> {overlapIds.length === 1 ? 'is' : 'are'} selected in both the audience and the exclude list — the same one can&apos;t be in both. Click the <b>×</b> on the red chip to remove it from one of them.
            </span>
          </div>
        )}
        {draft.exclude_enabled && (
          <div style={{ marginTop: 14 }}>
            <label style={label}>Lists <span style={{ fontWeight: 500, color: '#94a3b8' }}>(up to 15)</span></label>
            <AudiencePicker options={lists} kind="list" selected={excludeIds} max={15}
              onChange={ids => setField('exclude_list_ids', ids)}
              blockedIds={draft.audience_type === 'list' ? listIds : []} blockedLabel="already in audience"
              emptyText="No lists yet — create one under Audience → Lists." />
            {/* What the exclusion actually cost, in contacts — a number that only shrinks with
                no stated reason is the thing people end up not trusting. */}
            {excludeIds.length > 0 && (
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
    </div>
  );
}
