import { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { API, FORM, SearchDropdown, inp, label, hintText, req } from './attributeUi';
import AttributeChainBuilder, { EMPTY_CHAIN, validateChain } from './AttributeChainBuilder';

const DATA_TYPES = ['text', 'number', 'date', 'url', 'boolean'];

/*
 * The four ways an attribute can get its value. "Not linked" is the default and the
 * simplest: no database source at all, so the default value IS the value — which is why
 * choosing it makes Default value a required field further down.
 */
const MODE_OPTIONS = [
  { value: '',         label: 'Not linked — I will give a default value', note: 'No database lookup. Every recipient gets the default value you type below.' },
  { value: 'column',   label: 'Link with database',                       note: 'Read one column of one table, matched to the recipient by user_id or email.' },
  { value: 'existing', label: 'Existing attribute',                       note: "Copy another attribute's mapping as a starting point for this new one." },
  { value: 'chain',    label: 'Linked lookup (across several tables)',    note: 'For a value no single column holds — walk from the recipient through as many tables as it takes.' },
];

/**
 * Create or edit an attribute.
 *
 * Creating offers the four modes above via "How is this attribute set up?", which is
 * OPTIONAL — leaving it on "Not linked" produces a plain custom attribute whose default
 * value is what every template renders, with no database mapping of any kind.
 *
 *   - "Link with database": pick a Data Type, then search+pick a table.column
 *     (attributes.php?action=search_columns) — mapping is MANDATORY in this mode.
 *   - "Existing attribute": pick one of your existing attributes as a TEMPLATE — this
 *     copies its table.column mapping (and suggests its name/default value) into a brand-new
 *     attribute. It never modifies the attribute you picked.
 *   - "Linked lookup": build a multi-step chain in AttributeChainBuilder — e.g.
 *     user_id → assigned_links.assigned_id → whatsapp_placement_club_link.community_link,
 *     with a fallback path through the *_for_refund tables.
 *
 * A data_type='date' attribute additionally picks the format its value is rendered in
 * (attributes.php?action=date_formats). That is presentation only, so unlike a mapping it
 * stays editable forever.
 *
 * Only an explicit row-menu "Edit" ever updates an existing attribute in place — creating
 * always POSTs action=create. Once an attribute is mapped to a single column
 * (category='system'), that mapping — and its name/token — become permanent.
 */
export default function CreateAttributeModal({ editRow, onClose, onSaved }) {
  const isEdit = !!editRow;
  const isMapped = isEdit && editRow.category === 'system';
  const isLinked = isEdit && editRow.category === 'linked';
  const mappedInfo = isMapped ? {
    db: editRow.mapped_db, table: editRow.mapped_table, column: editRow.mapped_column, join_col: editRow.mapped_join_col,
  } : null;

  const [tab, setTab] = useState(isLinked ? 'chain' : ''); // '' | 'column' | 'existing' | 'chain'

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
  /* Editing a custom attribute's default value changes what every template renders, so the field
     starts locked and has to be deliberately unlocked with its Edit button. */
  const lockDefault = isEdit && editRow.category === 'custom';
  const [defaultUnlocked, setDefaultUnlocked] = useState(false);
  const defaultRef = useRef(null);
  const defaultLocked = lockDefault && !defaultUnlocked;
  const [dateFormat, setDateFormat] = useState(editRow?.date_format || '');
  const [chain, setChain] = useState(() => {
    if (!editRow?.resolver_json) return EMPTY_CHAIN;
    try { return JSON.parse(editRow.resolver_json) || EMPTY_CHAIN; } catch { return EMPTY_CHAIN; }
  });
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);

  // The date output formats, fetched from the server so the labels here are literally
  // rendered by the same code that will render the real value at send time.
  const [dateFormats, setDateFormats] = useState([]);
  useEffect(() => {
    if (dataType !== 'date' || dateFormats.length) return;
    (async () => {
      const res = await api.post(API, new URLSearchParams({ action: 'date_formats' }), FORM);
      if (res.data.success) setDateFormats(res.data.data.formats || []);
    })();
  }, [dataType]); // eslint-disable-line

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
    if (a.date_format) setDateFormat(a.date_format);
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
    if (dataType !== 'date' && dateFormat) setDateFormat(''); // a format only means anything on a date
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

  /* ---- Test against a real recipient -------------------------------------------- */
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { value, user_id } | { error }

  const usesChain = tab === 'chain' || isLinked;
  const effectiveMapping = isMapped ? mappedInfo : picked;

  const runTest = async () => {
    if (!testEmail.trim()) return toast.error('Enter an email address to test with');
    if (usesChain) {
      const err = validateChain(chain);
      if (err) return toast.error(err);
    }
    setTesting(true); setTestResult(null);
    try {
      const body = new URLSearchParams({
        action: 'preview', email: testEmail.trim(), data_type: dataType || 'text',
        date_format: dateFormat, default_value: defaultValue,
      });
      if (usesChain) body.set('resolver_json', JSON.stringify(chain));
      else if (effectiveMapping) {
        body.set('mapped_db', effectiveMapping.db);
        body.set('mapped_table', effectiveMapping.table);
        body.set('mapped_column', effectiveMapping.column);
      }
      const res = await api.post(API, body, FORM);
      setTestResult(res.data.success ? res.data.data : { error: res.data.message || 'Could not resolve' });
    } catch (e) {
      setTestResult({ error: e?.response?.data?.message || 'Network error' });
    } finally { setTesting(false); }
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed && !isEdit) return toast.error('Attribute name is required');
    if (!isEdit && !dataType) return toast.error('Select a data type');
    if (!isEdit && tab === 'existing' && !selectedExisting) return toast.error('Pick an existing attribute first');
    if (!isEdit && tab === 'column' && !picked) return toast.error('Map to a database column — required in Link with database mode');
    if (usesChain) {
      const err = validateChain(chain);
      if (err) return toast.error(err);
    }
    // Nothing to look the value up from, so the default value is the whole attribute.
    const needsDefault = !usesChain && !effectiveMapping && (isEdit ? editRow.category === 'custom' && !!editRow.default_value : true);
    if (needsDefault && !defaultValue.trim()) {
      return toast.error('Enter a default value — this attribute has no database source to read from');
    }

    setSaving(true);
    const t = toast.loading(isEdit ? 'Saving…' : 'Creating attribute…');
    try {
      const body = isEdit
        ? new URLSearchParams({
            action: 'update', id: editRow.id, default_value: defaultValue,
            ...(editRow.data_type === 'date' ? { date_format: dateFormat } : {}),
            ...(!isMapped ? { name: trimmed } : {}),
            ...(isLinked ? { resolver_json: JSON.stringify(chain) } : {}),
            ...(picked && !isMapped && !isLinked ? { mapped_db: picked.db, mapped_table: picked.table, mapped_column: picked.column } : {}),
          })
        : new URLSearchParams({
            action: 'create', name: trimmed, data_type: dataType, default_value: defaultValue,
            ...(dataType === 'date' ? { date_format: dateFormat } : {}),
            ...(tab === 'chain' ? { resolver_json: JSON.stringify(chain) } : {}),
            ...(tab !== 'chain' && picked ? { mapped_db: picked.db, mapped_table: picked.table, mapped_column: picked.column } : {}),
          });
      const res = await api.post(API, body, FORM);
      if (res.data.success) {
        toast.success(isEdit ? 'Saved' : 'Attribute created', { id: t });
        /*
          A changed value is pushed to every WhatsApp template whose Call button uses it. That
          outcome used to be thrown away here, so the attribute read "saved" while the templates
          went on dialling the old number — sometimes for a day, because Meta takes one edit of an
          approved template per 24 hours. Each template's result is said out loud instead.
        */
        const pushed = (res.data.data && res.data.data.resubmitted) || [];
        pushed.forEach((r) => {
          if (r.ok) {
            toast.success('"' + r.name + '" sent to Meta with the new number — it takes effect once Meta approves it.', { duration: 9000 });
          } else if (r.retry_at) {
            toast('"' + r.name + '" still dials its old number. Meta allows one edit of an approved template every 24 hours, '
              + 'so the new number is applied automatically at ' + r.retry_at + ' and then needs Meta\'s approval. '
              + 'Campaigns sent before then use the old number.', { duration: 20000, icon: '⏳' });
          } else if (r.error) {
            toast.error('"' + (r.name || 'A template') + '" was not updated: ' + r.error, { duration: 15000 });
          }
        });
        animateCloseThen(onSaved);
      }
      else { toast.error(res.data.message || 'Could not save', { id: t }); setSaving(false); }
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Network error', { id: t });
      setSaving(false);
    }
  };

  const filteredExisting = allAttrs.filter(a => a.data_type === dataType);
  const currentMode = MODE_OPTIONS.find(o => o.value === tab);
  const showColumnPicker = isEdit ? (!isLinked) : (tab === 'column' || (tab === 'existing' && selectedExisting));
  // Mirrors the server's rule: a default is mandatory only when nothing else can produce a
  // value — and, when editing, only for an attribute that already has one (a CSV-created
  // attribute holds real per-contact data and never needed a default).
  const defaultIsRequired = !usesChain && !effectiveMapping
    && (isEdit ? (editRow.category === 'custom' && !!editRow.default_value) : true);
  const showTest = usesChain || !!effectiveMapping;

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
          position: 'absolute', top: 0, right: 0, height: '100%', width: 560, maxWidth: '96vw',
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
          <label style={label}>Attribute name {req}</label>
          <input style={{ ...inp, ...(isMapped ? { background: '#f8fafc', color: '#94a3b8' } : {}) }}
            value={name} maxLength={100} onChange={e => setName(e.target.value)} placeholder="e.g. First Name"
            disabled={isMapped} />
          <div style={hintText}>
            {isMapped ? 'Locked — mapped attribute names cannot be changed.'
              : (!isEdit && tab === 'existing' && selectedExisting) ? `Pre-filled from "${selectedExisting.name}" — change it to create a separate attribute (must be unique).`
              : 'Auto-formatted to UPPER_SNAKE_CASE, e.g. "First Name" → FIRST_NAME.'}
          </div>
        </div>

        {!isEdit && (
          <div style={{ marginBottom: 14 }}>
            <label style={label}>Data type {req}</label>
            <select style={{ ...inp, color: dataType ? '#1e293b' : '#94a3b8' }} value={dataType} onChange={e => setDataType(e.target.value)}>
              <option value="" disabled>Select data type…</option>
              {DATA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {tab === 'existing' && <div style={hintText}>Filters the existing-attribute list below to this type.</div>}
          </div>
        )}

        {/* Date format — presentation only, so it is offered in edit mode too and can be
            changed as often as you like without touching a single stored value. */}
        {dataType === 'date' && (
          <div style={{ marginBottom: 14 }}>
            <label style={label}>Date format <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional)</span></label>
            <select style={{ ...inp, color: dateFormat ? '#1e293b' : '#94a3b8', cursor: 'pointer' }}
              value={dateFormat} onChange={e => setDateFormat(e.target.value)}>
              <option value="">Leave exactly as stored in the database</option>
              {dateFormats.map(f => <option key={f.id} value={f.id}>{f.sample}</option>)}
            </select>
            <div style={hintText}>
              How this attribute is written into an email or WhatsApp template. Editable at any time —
              it only changes the way the value is displayed.
            </div>
          </div>
        )}

        {!isEdit && dataType && (
          <div style={{ marginBottom: 14 }}>
            <label style={label}>
              How is this attribute set up? <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional)</span>
            </label>
            <SearchDropdown
              buttonLabel={currentMode?.label}
              options={MODE_OPTIONS}
              getKey={o => o.value}
              getLabel={o => o.label}
              renderOption={o => <span>{o.label}</span>}
              isSelected={o => o.value === tab}
              onPick={o => { setTab(o.value); setPicked(null); setQuery(''); setSelectedExisting(null); setTestResult(null); }}
              searchPlaceholder="Search…"
            />
            <div style={hintText}>{currentMode?.note}</div>
          </div>
        )}

        {!isEdit && dataType && tab === 'existing' && (
          <div style={{ marginBottom: 14 }}>
            <label style={label}>Copy mapping from {req}</label>
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
            <div style={hintText}>This creates a NEW attribute with your own name — the one you pick here is only a template and is never changed.</div>
          </div>
        )}

        {usesChain && (
          <>
            {isLinked && (
              <div style={{ padding: '9px 12px', border: '1.5px solid #ede9fe', background: '#f5f3ff', borderRadius: 8, fontSize: 11.5, color: '#6d28d9', marginBottom: 12 }}>
                Editing the lookup steps of a linked attribute. Nothing is stored per recipient, so
                changing these steps takes effect on the very next send.
              </div>
            )}
            <AttributeChainBuilder value={chain} onChange={setChain} />
          </>
        )}

        {showColumnPicker && (
          <div style={{ marginBottom: 14 }}>
            <label style={label}>
              Map to a database column {(!isEdit && tab === 'column') && req}
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
                <div style={hintText}>
                  {(!isEdit && tab === 'column') ? 'Required — pick the table.column this attribute reads from.'
                    : 'Optional — leave unmapped to keep this a plain custom attribute.'}
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <label style={label}>
            Default value {defaultIsRequired ? req : <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional)</span>}
          </label>
          <input ref={defaultRef} value={defaultValue} onChange={e => setDefaultValue(e.target.value)}
            disabled={defaultLocked} aria-disabled={defaultLocked}
            style={defaultLocked ? { ...inp, background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' } : inp}
            placeholder={defaultIsRequired ? 'The value every recipient will see' : 'Shown when no value is found for a recipient'} />
          {lockDefault && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              {defaultLocked ? (
                <button type="button"
                  onClick={() => { setDefaultUnlocked(true); setTimeout(() => { defaultRef.current?.focus(); defaultRef.current?.select(); }, 0); }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1.5px solid #1e3a8a', background: '#fff', color: '#1e3a8a', borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                  Edit
                </button>
              ) : (
                <button type="button"
                  onClick={() => { setDefaultValue(editRow.default_value || ''); setDefaultUnlocked(false); }}
                  style={{ padding: '6px 12px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', borderRadius: 7, fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel edit
                </button>
              )}
              <span style={{ fontSize: 10.5, color: '#94a3b8' }}>
                {defaultLocked ? 'Locked — click Edit to change the default value.' : 'Editing — Save to apply, or Cancel edit to restore the current value.'}
              </span>
            </div>
          )}
          {defaultIsRequired && (
            <div style={hintText}>
              Required, because this attribute reads nothing from the database — the default is the
              value every template will render.
            </div>
          )}
        </div>

        {/* Test against one real recipient, through the exact code path a real send uses. */}
        {showTest && (
          <div style={{ marginBottom: 18, padding: 12, border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}>
            <label style={label}>Test this with a real recipient</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inp, padding: '8px 10px', fontSize: 12 }} value={testEmail} onChange={e => setTestEmail(e.target.value)}
                placeholder="someone@example.com" onKeyDown={e => { if (e.key === 'Enter') runTest(); }} />
              <button type="button" onClick={runTest} disabled={testing}
                style={{ padding: '8px 16px', border: '1.5px solid #1e3a8a', background: '#fff', color: '#1e3a8a', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: testing ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                {testing ? 'Testing…' : 'Test'}
              </button>
            </div>
            {testResult && (
              testResult.error ? (
                <div style={{ marginTop: 8, fontSize: 12, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 10px' }}>{testResult.error}</div>
              ) : (
                <div style={{ marginTop: 8, fontSize: 12, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 10px', wordBreak: 'break-all' }}>
                  <div style={{ fontFamily: 'monospace' }}>{testResult.value === '' ? '(empty — nothing found and no default set)' : testResult.value}</div>
                  <div style={{ color: '#64748b', marginTop: 4, fontSize: 11 }}>
                    {testResult.user_id ? `Resolved via user_id ${testResult.user_id}` : 'No user_id found for this email'}
                  </div>
                </div>
              )
            )}
          </div>
        )}

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
