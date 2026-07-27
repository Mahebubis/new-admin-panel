import { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/attributes/attributes.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

const inp = { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box' };
const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 };

const DATA_TYPES = ['text', 'number', 'date', 'url', 'boolean'];
const MODE_OPTIONS = [
  { value: 'column', label: 'Link with database' },
  { value: 'existing', label: 'Existing attribute' },
];

/** Small searchable dropdown for the mode selector — only 2 options today, but built as a
 *  proper searchable popover (matching AttributePicker.jsx's pattern) rather than a plain
 *  <select>, per request. */
function ModeDropdown({ value, onChange }) {
  const current = MODE_OPTIONS.find(o => o.value === value);
  return (
    <SearchDropdown
      buttonLabel={current?.label}
      options={MODE_OPTIONS}
      getKey={o => o.value}
      getLabel={o => o.label}
      renderOption={o => <span>{o.label}</span>}
      isSelected={o => o.value === value}
      onPick={o => onChange(o.value)}
      searchPlaceholder="Search…"
    />
  );
}

/** Generic closed-by-default dropdown that opens a searchable popover on click — reused
 *  for both the mode selector and the existing-attribute picker, so every dropdown in
 *  this drawer behaves the same way instead of one being an always-expanded inline list. */
function SearchDropdown({ buttonLabel, buttonPlaceholder, options, getKey, getLabel, renderOption, isSelected, onPick, searchPlaceholder, emptyText }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const filtered = options.filter(o => getLabel(o).toLowerCase().includes(search.toLowerCase()));
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ ...inp, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left', color: buttonLabel ? '#1e293b' : '#94a3b8' }}>
        <span>{buttonLabel || buttonPlaceholder}</span>
        <span style={{ color: '#94a3b8', fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 10px 28px rgba(0,0,0,.14)', zIndex: 60, padding: 8 }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={searchPlaceholder}
            style={{ width: '100%', padding: '7px 9px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, marginBottom: 6, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>{emptyText || 'No matches'}</div>
            ) : filtered.map(o => (
              <button key={getKey(o)} type="button" onClick={() => { onPick(o); setOpen(false); setSearch(''); }}
                style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', padding: '8px 10px', border: 'none', background: isSelected?.(o) ? '#eef2ff' : 'none', cursor: 'pointer', fontSize: 12.5, borderRadius: 6, fontFamily: 'inherit', color: '#334155' }}
                onMouseEnter={e => { if (!isSelected?.(o)) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={e => { if (!isSelected?.(o)) e.currentTarget.style.background = 'transparent'; }}>
                {renderOption(o)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Create or edit an attribute.
 *
 * Creating fresh (not editing) offers two modes via the dropdown below Data Type:
 *   - "Link with database": pick a Data Type, then search+pick a table.column
 *     (attributes.php?action=search_columns) — mapping is MANDATORY in this mode.
 *   - "Existing attribute": pick a Data Type (filters the list to attributes of that
 *     type), then pick one of your existing attributes as a TEMPLATE — this copies its
 *     table.column mapping (and suggests its name/default value as a starting point) into
 *     a brand-new attribute. It never modifies the attribute you picked; you type your own
 *     (different) name, e.g. picking FIR_NAME (→ users.fname) while naming this one
 *     FIRST_NAME2 creates a second, independent attribute pointing at the same column.
 *     Duplicate names are rejected server-side either way.
 *
 * Only an explicit row-menu "Edit" ever updates an existing attribute in place — creating
 * (via either mode above) always POSTs action=create. Once an attribute is mapped
 * (category='system'), the mapping — and the name/token — become permanent thereafter.
 */
export default function CreateAttributeModal({ editRow, onClose, onSaved }) {
  const isEdit = !!editRow;
  const isMapped = isEdit && editRow.category === 'system';
  const mappedInfo = isMapped ? {
    db: editRow.mapped_db, table: editRow.mapped_table, column: editRow.mapped_column, join_col: editRow.mapped_join_col,
  } : null;

  const [tab, setTab] = useState('column'); // 'column' | 'existing' — only relevant when !isEdit

  const [allAttrs, setAllAttrs] = useState([]);
  const [selectedExisting, setSelectedExisting] = useState(null);

  useEffect(() => {
    if (isEdit || tab !== 'existing' || allAttrs.length) return;
    (async () => {
      const res = await api.post(API, new URLSearchParams({ action: 'list', per_page: 200 }), FORM);
      if (res.data.success) setAllAttrs(res.data.data.attributes || []);
    })();
  }, [tab, isEdit]); // eslint-disable-line

  const [name, setName] = useState(editRow?.name || '');
  const [dataType, setDataType] = useState(editRow?.data_type || '');
  const [defaultValue, setDefaultValue] = useState(editRow?.default_value || '');
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);

  // Unmounting a component is instant — there's no chance for its own CSS animation to
  // play. So closing (by any route: ×, Cancel, backdrop, or a successful save) first
  // flips this flag to trigger the slide-out animation, and only calls the parent's
  // onClose/onSaved (which actually unmounts the drawer) once that animation finishes.
  const animateCloseThen = (cb) => {
    if (closing) return;
    setClosing(true);
    setTimeout(cb, 240);
  };
  const requestClose = () => !saving && animateCloseThen(onClose);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null); // the table.column this NEW attribute will map to (fresh search, or copied from a template)
  const debounceRef = useRef(null);

  // Picking a template in "Existing attribute" mode copies its mapping + suggests its
  // name/default value as a starting point — none of this locks anything, it's purely a
  // convenience so you don't have to re-search a column you've already mapped once.
  const pickTemplate = (a) => {
    setSelectedExisting(a);
    setName(a.name);
    setDefaultValue(a.default_value || '');
    setPicked(a.category === 'system' ? { db: a.mapped_db, table: a.mapped_table, column: a.mapped_column, join_col: a.mapped_join_col } : null);
  };

  // Data Type and the picked template must always agree — if Data Type changes to
  // something that no longer matches an already-picked template, the pick is no longer
  // valid, so clear it rather than leave a mismatched state on screen.
  useEffect(() => {
    if (selectedExisting && selectedExisting.data_type !== dataType) {
      toast.error(`You picked "${selectedExisting.name}" (data type "${selectedExisting.data_type}"), but are now choosing "${dataType}" — clearing your pick since these must match.`);
      setSelectedExisting(null);
      setPicked(null);
    }
  }, [dataType]); // eslint-disable-line

  useEffect(() => {
    if (isMapped) return; // mapping is locked once set — no need to search
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.post(API, new URLSearchParams({ action: 'search_columns', q: query }), FORM);
        if (res.data.success) setResults(res.data.data.results || []);
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, isMapped]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed && !isEdit) return toast.error('Attribute name is required');
    if (!isEdit && !dataType) return toast.error('Select a data type');
    if (!isEdit && tab === 'existing' && !selectedExisting) return toast.error('Pick an existing attribute first');
    if (!isEdit && tab === 'column' && !picked) return toast.error('Map to a database column — required in Link with database mode');

    setSaving(true);
    const t = toast.loading(isEdit ? 'Saving…' : 'Creating attribute…');
    try {
      const body = isEdit
        ? new URLSearchParams({
            action: 'update', id: editRow.id, default_value: defaultValue,
            ...(!isMapped ? { name: trimmed } : {}),
            ...(picked && !isMapped ? { mapped_db: picked.db, mapped_table: picked.table, mapped_column: picked.column } : {}),
          })
        : new URLSearchParams({
            action: 'create', name: trimmed, data_type: dataType, default_value: defaultValue,
            ...(picked ? { mapped_db: picked.db, mapped_table: picked.table, mapped_column: picked.column } : {}),
          });
      const res = await api.post(API, body, FORM);
      if (res.data.success) { toast.success(isEdit ? 'Saved' : 'Attribute created', { id: t }); animateCloseThen(onSaved); }
      else { toast.error(res.data.message || 'Could not save', { id: t }); setSaving(false); }
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Network error', { id: t });
      setSaving(false);
    }
  };

  const filteredExisting = allAttrs.filter(a => a.data_type === dataType);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 950, animation: `${closing ? 'nc_fade_out' : 'nc_fade_in'} .22s ease forwards` }}
      onClick={requestClose}>
      <style>{`
        @keyframes nc_fade_in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nc_fade_out { from { opacity: 1; } to { opacity: 0; } }
        @keyframes nc_slide_in_right { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes nc_slide_out_right { from { transform: translateX(0); } to { transform: translateX(100%); } }
      `}</style>
      <div style={{
          position: 'absolute', top: 0, right: 0, height: '100%', width: 480, maxWidth: '92vw',
          background: '#fff', boxShadow: '-12px 0 40px rgba(0,0,0,.18)', padding: 26, overflowY: 'auto',
          animation: `${closing ? 'nc_slide_out_right' : 'nc_slide_in_right'} .3s cubic-bezier(.16,1,.3,1) forwards`, boxSizing: 'border-box',
          fontFamily: "'Plus Jakarta Sans',sans-serif",
        }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{isEdit ? 'Edit attribute' : 'Create new attribute'}</div>
          <button onClick={requestClose} disabled={saving} title="Close"
            style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 18 }}>
          {isEdit ? `Used in templates as [${editRow.name}]` : 'Becomes usable in any campaign template as [ATTRIBUTE_NAME].'}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Attribute name <span style={{ color: '#dc2626' }}>*</span></label>
          <input style={{ ...inp, ...(isMapped ? { background: '#f8fafc', color: '#94a3b8' } : {}) }}
            value={name} maxLength={100} onChange={e => setName(e.target.value)} placeholder="e.g. First Name"
            disabled={isMapped} />
          <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>
            {isMapped ? 'Locked — mapped attribute names cannot be changed.'
              : (!isEdit && tab === 'existing' && selectedExisting) ? `Pre-filled from "${selectedExisting.name}" — change it to create a separate attribute (must be unique).`
              : 'Auto-formatted to UPPER_SNAKE_CASE, e.g. "First Name" → FIRST_NAME.'}
          </div>
        </div>

        {!isEdit && (
          <div style={{ marginBottom: 14 }}>
            <label style={label}>Data type <span style={{ color: '#dc2626' }}>*</span></label>
            <select style={{ ...inp, color: dataType ? '#1e293b' : '#94a3b8' }} value={dataType} onChange={e => setDataType(e.target.value)}>
              <option value="" disabled>Select data type…</option>
              {DATA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {tab === 'existing' && <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>Filters the existing-attribute list below to this type.</div>}
          </div>
        )}

        {!isEdit && dataType && (
          <div style={{ marginBottom: 14 }}>
            <label style={label}>How is this attribute set up?</label>
            <ModeDropdown value={tab} onChange={v => { setTab(v); setPicked(null); setQuery(''); setSelectedExisting(null); }} />
          </div>
        )}

        {!isEdit && dataType && tab === 'existing' && (
          <div style={{ marginBottom: 14 }}>
            <label style={label}>Copy mapping from <span style={{ color: '#dc2626' }}>*</span></label>
            {selectedExisting ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1.5px solid #ede9fe', background: '#f5f3ff', borderRadius: 8, fontSize: 12.5, color: '#7c3aed', fontFamily: 'monospace' }}>
                <span>[{selectedExisting.name}] <span style={{ color: '#94a3b8', fontFamily: 'inherit' }}>({selectedExisting.category})</span></span>
                <button type="button" onClick={() => { setSelectedExisting(null); setPicked(null); }} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, lineHeight: 1, fontFamily: 'inherit' }}>×</button>
              </div>
            ) : (
              <SearchDropdown
                buttonPlaceholder={`Select a ${dataType} attribute…`}
                options={filteredExisting}
                getKey={a => a.id}
                getLabel={a => a.name}
                renderOption={a => (<><span style={{ fontFamily: 'monospace' }}>[{a.name}]</span><span style={{ color: '#94a3b8' }}>{a.category}</span></>)}
                onPick={pickTemplate}
                searchPlaceholder={`Search ${dataType} attributes…`}
                emptyText={`No ${dataType} attributes yet.`}
              />
            )}
            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>This creates a NEW attribute with your own name — the one you pick here is only a template and is never changed.</div>
          </div>
        )}

        {(isEdit || (dataType && tab === 'column') || (dataType && tab === 'existing' && selectedExisting)) && (
          <div style={{ marginBottom: 14 }}>
            <label style={label}>
              Map to a database column {(!isEdit && tab === 'column') && <span style={{ color: '#dc2626' }}>*</span>}
            </label>
            {isMapped ? (
              <div style={{ padding: '10px 12px', border: '1.5px solid #dbeafe', background: '#eff6ff', borderRadius: 8, fontSize: 12.5, color: '#1d4ed8' }}>
                {mappedInfo.db}.{mappedInfo.table}.{mappedInfo.column} <span style={{ color: '#64748b' }}>(matched via {mappedInfo.join_col})</span>
              </div>
            ) : picked ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1.5px solid #dbeafe', background: '#eff6ff', borderRadius: 8, fontSize: 12.5, color: '#1d4ed8' }}>
                <span>{picked.db}.{picked.table}.{picked.column} <span style={{ color: '#64748b' }}>(via {picked.join_col})</span></span>
                <button type="button" onClick={() => { setPicked(null); setQuery(''); }} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
              </div>
            ) : (
              <>
                <input style={inp} value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Search table or column name (e.g. score, amount, college)…" />
                {query.trim() && (
                  <div style={{ marginTop: 6, border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 180, overflowY: 'auto' }}>
                    {searching ? (
                      <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>Searching…</div>
                    ) : results.length === 0 ? (
                      <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>No matching columns (must belong to a table with a user_id or email column).</div>
                    ) : results.map(r => (
                      <button key={`${r.db}.${r.table}.${r.column}`} type="button"
                        onClick={() => { setPicked(r); setQuery(''); setResults([]); }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', borderBottom: '1px solid #f1f5f9', background: 'none', cursor: 'pointer', fontSize: 12.5 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{r.db}.{r.table}.{r.column}</span>
                        <span style={{ color: '#94a3b8', marginLeft: 8 }}>{r.data_type} · via {r.join_col}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>
                  {(!isEdit && tab === 'column') ? 'Required — pick the table.column this attribute reads from.' : 'Optional — leave unmapped to keep this a plain custom attribute.'}
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <label style={label}>Default value <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional)</span></label>
          <input style={inp} value={defaultValue} onChange={e => setDefaultValue(e.target.value)} placeholder="Shown when no value is found for a recipient" />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={requestClose} disabled={saving} style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={saving}
            style={{ padding: '9px 18px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: saving ? 'wait' : 'pointer', opacity: saving ? .7 : 1 }}>
            {saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
