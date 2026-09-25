/*
 * Kumo — the multi-step lookup builder behind a category='linked' attribute.
 *
 * A clone of src/pages/netcore/AttributeChainBuilder.jsx, now with the SAME data layer:
 * the table picker calls attributes.php?action=search_tables and the column dropdowns call
 * action=table_columns, so a chain is picked from the live schema instead of typed. The
 * earlier version of this file had to fall back to free-text inputs because the module's own
 * endpoint has no schema browser; that limitation is gone.
 *
 * The shape it edits is unchanged, because it is what goes into resolver_json:
 *   { seed: 'user_id' | 'email',
 *     branches: [ { label, steps: [ { db, table, match_col, out_col, order_by, order_dir } ] } ] }
 *
 * Reading a path out loud: start from the recipient's user_id, look it up in
 * assigned_links matching user_id and take assigned_id, then look THAT up in
 * whatsapp_placement_club_link matching id and take community_link. A second path can then
 * do the same through the *_for_refund tables, and it is only tried for the recipients the
 * first path found nothing for.
 *
 * `readOnly` renders the whole builder as a static description of a saved chain — used
 * nowhere by default now that both Kumo-owned and shared attributes are editable, but kept
 * so a caller can still show a chain without offering to change it.
 */
import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import { SearchDropdown, inp, label, hintText, req } from './kumoAttributeUi';

const ATTR_API = '/api/attributes/attributes.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

const SEEDS = [
  { value: 'user_id', label: "The recipient's user_id", hint: 'Looked up from their email in istudio_cit.users when the recipient has no user_id of their own.' },
  { value: 'email',   label: "The recipient's email",   hint: 'Use when the first table you look in is keyed by email rather than user_id.' },
];

export const EMPTY_STEP = { db: '', table: '', match_col: '', out_col: '', order_by: '', order_dir: 'desc' };
export const EMPTY_CHAIN = { seed: 'user_id', branches: [{ label: '', steps: [{ ...EMPTY_STEP }] }] };

const card = { border: '1.5px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#fff' };
const smallBtn = { padding: '5px 10px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: '#475569' };
const chip = { fontFamily: 'monospace', fontSize: 11.5, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 6, padding: '2px 7px' };
const miniLabel = { fontSize: 10.5, fontWeight: 700, color: '#64748b', marginBottom: 4 };
const staticBox = { ...inp, padding: '7px 10px', fontSize: 12, background: '#f8fafc', color: '#64748b' };

/** One step of one path. Columns are real dropdowns rather than free text, so a typo can't
 *  produce a chain that only fails at send time — the column list is fetched from the table
 *  the moment one is picked. */
function StepEditor({ step, index, isFirst, seed, prevLabel, onChange, onRemove, canRemove, readOnly }) {
  const [columns, setColumns] = useState([]);
  const [loadingCols, setLoadingCols] = useState(false);

  useEffect(() => {
    if (readOnly) return;
    if (!step.db || !step.table) { setColumns([]); return; }
    let alive = true;
    (async () => {
      setLoadingCols(true);
      try {
        const res = await api.post(ATTR_API, new URLSearchParams({ action: 'table_columns', db: step.db, table: step.table }), FORM);
        if (alive && res.data.success) setColumns(res.data.data.columns || []);
      } catch {
        if (alive) setColumns([]);
      } finally { if (alive) setLoadingCols(false); }
    })();
    return () => { alive = false; };
  }, [step.db, step.table, readOnly]);

  const searchTables = useCallback(async (q) => {
    const res = await api.post(ATTR_API, new URLSearchParams({ action: 'search_tables', q }), FORM);
    return res.data.success ? (res.data.data.results || []) : [];
  }, []);

  const set = (patch) => onChange({ ...step, ...patch });
  const colOptions = columns.map(c => ({ ...c, key: c.column }));
  const inputName = isFirst ? seed : prevLabel;

  return (
    <div style={{ ...card, borderColor: '#eef2ff', background: '#fbfcff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569' }}>Step {index + 1}</div>
        {canRemove && !readOnly && (
          <button type="button" onClick={onRemove} style={{ ...smallBtn, border: 'none', color: '#dc2626', padding: '2px 6px' }}>Remove</button>
        )}
      </div>

      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
        Takes <span style={chip}>{inputName}</span> and looks it up in:
      </div>

      {readOnly ? (
        <div style={staticBox}>{step.table ? `${step.db ? step.db + '.' : ''}${step.table}` : '— no table —'}</div>
      ) : (
        <SearchDropdown
          compact
          buttonLabel={step.table ? `${step.db}.${step.table}` : ''}
          buttonPlaceholder="Search for a table…"
          getKey={t => `${t.db}.${t.table}`}
          getLabel={t => t.table}
          renderOption={t => (<><span style={{ fontWeight: 600 }}>{t.table}</span><span style={{ color: '#94a3b8' }}>{t.db}</span></>)}
          onSearch={searchTables}
          onPick={t => set({ db: t.db, table: t.table, match_col: '', out_col: '', order_by: '' })}
          searchPlaceholder="Table name…"
          emptyText="No matching tables"
        />
      )}

      {step.table && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <div>
            <div style={miniLabel}>Match on column {req}</div>
            {readOnly ? <div style={staticBox}>{step.match_col || '—'}</div> : (
              <SearchDropdown
                compact
                buttonLabel={step.match_col}
                buttonPlaceholder={loadingCols ? 'Loading…' : 'Select…'}
                options={colOptions}
                getKey={c => c.key}
                getLabel={c => c.column}
                renderOption={c => (<><span>{c.column}</span><span style={{ color: '#94a3b8' }}>{c.data_type}</span></>)}
                isSelected={c => c.column === step.match_col}
                onPick={c => set({ match_col: c.column })}
                searchPlaceholder="Column…"
              />
            )}
          </div>
          <div>
            <div style={miniLabel}>Take value from {req}</div>
            {readOnly ? <div style={staticBox}>{step.out_col || '—'}</div> : (
              <SearchDropdown
                compact
                buttonLabel={step.out_col}
                buttonPlaceholder={loadingCols ? 'Loading…' : 'Select…'}
                options={colOptions}
                getKey={c => c.key}
                getLabel={c => c.column}
                renderOption={c => (<><span>{c.column}</span><span style={{ color: '#94a3b8' }}>{c.data_type}</span></>)}
                isSelected={c => c.column === step.out_col}
                onPick={c => set({ out_col: c.column })}
                searchPlaceholder="Column…"
              />
            )}
          </div>
        </div>
      )}

      {step.table && (
        <div style={{ marginTop: 8 }}>
          <div style={miniLabel}>
            If several rows match <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 8 }}>
            {readOnly ? <div style={staticBox}>{step.order_by || 'Any matching row'}</div> : (
              <SearchDropdown
                compact
                buttonLabel={step.order_by}
                buttonPlaceholder="Any matching row"
                options={[{ key: '__none__', column: '(any matching row)', data_type: '' }, ...colOptions]}
                getKey={c => c.key}
                getLabel={c => c.column}
                renderOption={c => (<><span>{c.column}</span><span style={{ color: '#94a3b8' }}>{c.data_type}</span></>)}
                isSelected={c => c.column === step.order_by}
                onPick={c => set({ order_by: c.key === '__none__' ? '' : c.column })}
                searchPlaceholder="Order by column…"
              />
            )}
            <select value={step.order_dir} onChange={e => set({ order_dir: e.target.value })}
              disabled={readOnly || !step.order_by}
              style={{ ...inp, padding: '7px 8px', fontSize: 11.5, cursor: (!readOnly && step.order_by) ? 'pointer' : 'not-allowed', background: (!readOnly && step.order_by) ? '#fff' : '#f8fafc' }}>
              <option value="desc">Highest / newest</option>
              <option value="asc">Lowest / oldest</option>
            </select>
          </div>
          <div style={hintText}>
            Pick the column that says which row is newest (e.g. result_id or a timestamp) when one
            {' '}{inputName} can have many rows here.
          </div>
        </div>
      )}
    </div>
  );
}

export default function KumoAttributeChainBuilder({ value, onChange, readOnly = false }) {
  const chain = value || EMPTY_CHAIN;
  const seedLabel = chain.seed === 'email' ? 'email' : 'user_id';
  const branches = chain.branches || [];

  const setBranch = (bi, branch) => onChange({ ...chain, branches: branches.map((b, i) => (i === bi ? branch : b)) });
  const addBranch = () => onChange({ ...chain, branches: [...branches, { label: '', steps: [{ ...EMPTY_STEP }] }] });
  const removeBranch = (bi) => onChange({ ...chain, branches: branches.filter((_, i) => i !== bi) });

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={label}>Start from {req}</label>
      <select value={chain.seed} disabled={readOnly} onChange={e => onChange({ ...chain, seed: e.target.value })}
        style={{ ...inp, cursor: readOnly ? 'not-allowed' : 'pointer', background: readOnly ? '#f8fafc' : '#fff' }}>
        {SEEDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <div style={hintText}>{SEEDS.find(s => s.value === chain.seed)?.hint}</div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {branches.map((branch, bi) => (
          <div key={bi} style={{ ...card, background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                Path {bi + 1}
                {bi > 0 && <span style={{ fontWeight: 500, color: '#94a3b8', marginLeft: 6 }}>— only tried if path {bi} found nothing</span>}
              </div>
              {branches.length > 1 && !readOnly && (
                <button type="button" onClick={() => removeBranch(bi)} style={{ ...smallBtn, border: 'none', color: '#dc2626', padding: '2px 6px' }}>Remove path</button>
              )}
            </div>

            <input value={branch.label || ''} maxLength={60} disabled={readOnly}
              onChange={e => setBranch(bi, { ...branch, label: e.target.value })}
              placeholder="Name this path (optional) — e.g. Regular, Refund"
              style={{ ...inp, padding: '7px 10px', fontSize: 12, marginBottom: 10, ...(readOnly ? { background: '#f8fafc', color: '#64748b' } : {}) }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(branch.steps || []).map((step, si) => (
                <StepEditor
                  key={si}
                  step={step}
                  index={si}
                  isFirst={si === 0}
                  seed={seedLabel}
                  prevLabel={si > 0 ? (branch.steps[si - 1].out_col || `step ${si}'s value`) : ''}
                  readOnly={readOnly}
                  onChange={next => setBranch(bi, { ...branch, steps: branch.steps.map((s, i) => (i === si ? next : s)) })}
                  onRemove={() => setBranch(bi, { ...branch, steps: branch.steps.filter((_, i) => i !== si) })}
                  canRemove={(branch.steps || []).length > 1}
                />
              ))}
            </div>

            {(branch.steps || []).length < 6 && !readOnly && (
              <button type="button" onClick={() => setBranch(bi, { ...branch, steps: [...branch.steps, { ...EMPTY_STEP }] })}
                style={{ ...smallBtn, marginTop: 10 }}>+ Add step</button>
            )}
          </div>
        ))}
      </div>

      {branches.length < 5 && !readOnly && (
        <button type="button" onClick={addBranch} style={{ ...smallBtn, marginTop: 10, borderColor: '#c7d2fe', color: '#4338ca' }}>
          + Add fallback path
        </button>
      )}
      <div style={hintText}>
        A fallback path is for values that live in one place for some people and another for others —
        assigned_links for most, assigned_links_for_refund for refunded users.
      </div>
    </div>
  );
}

/** Client-side sanity check so an obviously-incomplete chain is caught in the drawer rather
 *  than by the server. The server re-validates everything against INFORMATION_SCHEMA
 *  regardless — this is only here to give a faster, more specific message. */
export function validateChain(chain) {
  if (!chain || !chain.branches?.length) return 'Add at least one lookup path';
  for (let bi = 0; bi < chain.branches.length; bi++) {
    const steps = chain.branches[bi].steps || [];
    if (!steps.length) return `Path ${bi + 1} has no steps`;
    for (let si = 0; si < steps.length; si++) {
      const s = steps[si];
      if (!s.table) return `Path ${bi + 1}, step ${si + 1}: pick a table`;
      if (!s.match_col) return `Path ${bi + 1}, step ${si + 1}: pick the column to match on`;
      if (!s.out_col) return `Path ${bi + 1}, step ${si + 1}: pick the column to take the value from`;
    }
  }
  return '';
}

/** One-line description of a saved chain, for the "Mapped source" column of the table. The
 *  shared endpoint sends a chain_summary string of its own; the module's own rows do not, so
 *  the same sentence is built here from resolver_json. */
export function chainSummary(resolverJson) {
  let chain = resolverJson;
  if (typeof chain === 'string') {
    if (!chain.trim()) return '';
    try { chain = JSON.parse(chain); } catch { return ''; }
  }
  if (!chain || !chain.branches?.length) return '';
  const path = chain.branches[0].steps || [];
  if (!path.length) return '';
  const hops = path.map(s => `${s.table || '?'}.${s.out_col || '?'}`).join(' → ');
  const extra = chain.branches.length > 1 ? ` (+${chain.branches.length - 1} fallback)` : '';
  return `${chain.seed === 'email' ? 'email' : 'user_id'} → ${hops}${extra}`;
}
