/*
 * Kumo — bulk contact import wizard.
 *
 * Clone of src/pages/netcore/ImportContactsWizard.jsx — same top bar, same
 * numbered step rail (Upload file → Map attributes → Status), same drop zone and
 * the same card chrome. Only the plumbing differs:
 *
 *   • there is no multipart upload endpoint on the Kumo API, so the CSV is read in
 *     the browser with FileReader.readAsText and posted as plain text (`csv`);
 *   • the mapping is expressed the way kumo.php wants it — one COLUMN INDEX per
 *     canonical field (-1 = not mapped) — so step 2 lists the fields and lets you
 *     pick which column feeds each, rather than the other way round;
 *   • the import is synchronous, so step 3 shows the final counts instead of
 *     polling a background job.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { kapi } from './kumoShared';

const STEPS = [{ key: 'upload', label: 'Upload file' }, { key: 'map', label: 'Map attributes' }, { key: 'status', label: 'Status' }];

/* The four fields kumo_contacts actually stores from a CSV. */
const CANONICAL_FIELDS = [
  { value: 'email',      label: 'Email (required)', required: true },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name',  label: 'Last Name' },
  { value: 'phone',      label: 'Phone' },
];

const MAX_BYTES = 10 * 1024 * 1024;

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 18 };
const inp = { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box' };

function Spinner() {
  return <span style={{ display: 'inline-block', width: 32, height: 32, borderRadius: '50%', border: '3px solid #c4b5fd', borderTopColor: '#4f46e5', animation: 'km_spin 0.85s linear infinite' }} />;
}

/** Reads a File as text — the CSV never leaves the browser until we post it. */
function readText(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload  = () => resolve(String(fr.result || ''));
    fr.onerror = () => reject(new Error('Could not read that file'));
    fr.readAsText(file);
  });
}

export default function KumoImportWizard({ basePath = '/kumo/lists', listIdOverride } = {}) {
  const { listId: listIdParam, id: idParam } = useParams();
  const listId = listIdOverride || listIdParam || idParam;
  const nav = useNavigate();
  const fileInputRef = useRef(null);

  const [listName, setListName] = useState('');
  const [current, setCurrent] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [csvText, setCsvText]   = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview]   = useState(null);   // { columns, rows, total_rows, has_header, mapping }
  const [mapping, setMapping]   = useState({ email: -1, first_name: -1, last_name: -1, phone: -1 });
  const [hasHeader, setHasHeader] = useState(true);
  const [confirming, setConfirming] = useState(false);

  const [result, setResult] = useState(null);       // { rows, imported, invalid, suppressed, duplicate }

  /* The API has no "get one list", so the name comes from the full listing. */
  useEffect(() => {
    (async () => {
      try {
        const d = await kapi('lists_list');
        const row = (d.lists || []).find(l => String(l.id) === String(listId));
        if (row) setListName(row.name);
      } catch { /* non-critical — the header just won't show the list name */ }
    })();
  }, [listId]);

  const pickFile = () => fileInputRef.current?.click();

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) return toast.error('Only CSV files are supported — export your spreadsheet as CSV first');
    if (file.size > MAX_BYTES) return toast.error('That file is larger than 10MB — split it into smaller files first');
    setUploading(true);
    const t = toast.loading('Reading file…');
    try {
      const text = await readText(file);
      const d = await kapi('csv_preview', { csv: text });
      setCsvText(text);
      setFileName(file.name);
      setPreview(d);
      setMapping({
        email:      Number(d.mapping?.email ?? -1),
        first_name: Number(d.mapping?.first_name ?? -1),
        last_name:  Number(d.mapping?.last_name ?? -1),
        phone:      Number(d.mapping?.phone ?? -1),
      });
      setHasHeader(Number(d.has_header) === 1);
      toast.success(`Found ${Number(d.total_rows || 0).toLocaleString()} row(s)`, { id: t });
      setCurrent(1);
    } catch (e) {
      toast.error(e.message || 'Could not read file', { id: t });
    } finally { setUploading(false); }
  };

  const onDrop = e => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const setFieldColumn = (field, value) => setMapping(m => ({ ...m, [field]: Number(value) }));

  const columnCount = Math.max(
    preview?.columns?.length || 0,
    ...((preview?.rows || []).map(r => r.length)), 0);
  const columnLabel = (i) => {
    const head = preview?.columns?.[i];
    return hasHeader && String(head || '').trim() !== '' ? String(head) : `Column ${i + 1}`;
  };
  /* A real value from the file, so the picker is not a guessing game. */
  const sampleFor = (i) => {
    const body = hasHeader ? (preview?.rows || []).slice(1) : (preview?.rows || []);
    const row = body.find(r => String(r?.[i] ?? '').trim() !== '');
    return row ? String(row[i]) : '';
  };

  const previewRows = (hasHeader ? (preview?.rows || []).slice(1) : (preview?.rows || [])).slice(0, 5);

  const confirmImport = async () => {
    if (!(mapping.email >= 0)) return toast.error('Map at least one column to Email before importing');
    setConfirming(true);
    const t = toast.loading('Importing…');
    try {
      const d = await kapi('contacts_import', {
        csv: csvText,
        list_id: listId,
        mapping: { email: mapping.email, first_name: mapping.first_name, last_name: mapping.last_name, phone: mapping.phone },
        has_header: hasHeader ? 1 : 0,
        file_name: fileName,
      });
      toast.success('Import finished', { id: t });
      setResult(d);
      setCurrent(2);
    } catch (e) {
      toast.error(e.message || 'Could not import contacts', { id: t });
    } finally { setConfirming(false); }
  };

  /* No sample-file endpoint on this API — the same one-click sample, built here. */
  const downloadSample = () => {
    const csv = 'email,first_name,last_name,phone\n'
      + 'asha@example.com,Asha,Verma,9876543210\n'
      + 'rahul@example.com,Rahul,Nair,9812345678\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'contacts_sample.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const STAT_TILES = result ? [
    { label: 'Rows read',    value: result.rows,       color: '#0f172a' },
    { label: 'Imported',     value: result.imported,   color: '#16a34a' },
    { label: 'Invalid',      value: result.invalid,    color: '#dc2626' },
    { label: 'Suppressed',   value: result.suppressed, color: '#b45309' },
    { label: 'Duplicates',   value: result.duplicate,  color: '#64748b' },
  ] : [];

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", height: '100%', minHeight: 520, display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      <style>{`@keyframes km_spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 26px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => nav(basePath)} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Bulk upload {listName && <span style={{ color: '#94a3b8', fontWeight: 500 }}>— {listName}</span>}</div>
        </div>
        {current === 2 && (
          <button onClick={() => nav(basePath)} style={{ padding: '10px 22px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>DONE</button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '16px 26px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        {STEPS.map((s, i) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px' }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 700, background: i === current ? '#1e3a8a' : i < current ? '#16a34a' : '#e2e8f0', color: (i === current || i < current) ? '#fff' : '#94a3b8' }}>
                {i < current ? '✓' : i + 1}
              </span>
              <span style={{ fontSize: 13, fontWeight: i === current ? 700 : 600, color: i === current ? '#0f172a' : '#475569' }}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <span style={{ width: 40, height: 2, background: i < current ? '#16a34a' : '#e2e8f0', margin: '0 8px' }} />}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 26, maxWidth: 900, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {current === 0 && (
          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Upload file</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 18 }}>Drop the file containing your contacts</div>

            <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }}
              onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
            <div onClick={pickFile}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              style={{ border: `2px dashed ${dragOver ? '#1e3a8a' : '#c4b5fd'}`, borderRadius: 10, padding: 50, textAlign: 'center', cursor: uploading ? 'wait' : 'pointer', background: dragOver ? '#eef2ff' : '#f8fafc' }}>
              {uploading ? <Spinner /> : (
                <>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={1.5} style={{ margin: '0 auto 14px' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Drop your file here or <span style={{ color: '#1e3a8a', textDecoration: 'underline' }}>browse</span></div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8' }}>CSV only, max 10MB / 50,000 rows</div>
                </>
              )}
            </div>
            <div style={{ marginTop: 14, textAlign: 'center' }}>
              <button onClick={downloadSample} style={{ border: 'none', background: 'none', color: '#1e3a8a', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                Download sample file
              </button>
            </div>
          </div>
        )}

        {current === 1 && preview && (
          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Map attributes</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
              Great, we found {Number(preview.total_rows || 0).toLocaleString()} row(s) in <strong style={{ color: '#475569' }}>{fileName}</strong>. Confirm which column feeds each field before importing — a real sample value is shown next to each choice.
            </div>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#334155', marginBottom: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
              The first row is a header row (skip it when importing)
            </label>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b', fontSize: 11, fontWeight: 700 }}>System attribute</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b', fontSize: 11, fontWeight: 700 }}>Map with CSV column</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b', fontSize: 11, fontWeight: 700 }}>Sample input data</th>
                </tr>
              </thead>
              <tbody>
                {CANONICAL_FIELDS.map(f => {
                  const idx = mapping[f.value];
                  const sample = idx >= 0 ? sampleFor(idx) : '';
                  return (
                    <tr key={f.value} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '10px', fontWeight: 600, color: '#0f172a' }}>
                        {f.label}
                        {f.required && <span style={{ color: '#dc2626' }}> *</span>}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <select style={inp} value={idx} onChange={e => setFieldColumn(f.value, e.target.value)}>
                          <option value={-1}>— Don't import —</option>
                          {Array.from({ length: columnCount }, (_, i) => (
                            <option key={i} value={i}>{columnLabel(i)}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '10px', color: '#64748b' }}>{sample || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ marginTop: 22, fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.4px' }}>File preview</div>
            <div style={{ marginTop: 8, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {Array.from({ length: columnCount }, (_, i) => (
                      <th key={i} style={{ textAlign: 'left', padding: '9px 12px', color: '#475569', fontSize: 11, fontWeight: 700, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{columnLabel(i)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.length === 0
                    ? <tr><td colSpan={Math.max(1, columnCount)} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Nothing to preview.</td></tr>
                    : previewRows.map((row, ri) => (
                        <tr key={ri}>
                          {Array.from({ length: columnCount }, (_, i) => (
                            <td key={i} style={{ padding: '9px 12px', borderBottom: '1px solid #f1f5f9', color: '#334155', whiteSpace: 'nowrap' }}>
                              {String(row?.[i] ?? '').trim() !== '' ? row[i] : <span style={{ color: '#cbd5e1' }}>—</span>}
                            </td>
                          ))}
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => { setPreview(null); setCsvText(''); setCurrent(0); }} style={{ padding: '10px 22px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#334155' }}>Change file</button>
              <button onClick={confirmImport} disabled={confirming}
                style={{ padding: '10px 22px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: confirming ? 'wait' : 'pointer' }}>
                {confirming ? 'Importing…' : 'Confirm & Import'}
              </button>
            </div>
          </div>
        )}

        {current === 2 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✓</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Import finished</div>
                <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{fileName}{listName ? ` → ${listName}` : ''}</div>
              </div>
            </div>

            {result ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                  {STAT_TILES.map(s => (
                    <div key={s.label} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', background: '#fff' }}>
                      <div style={{ fontSize: 21, fontWeight: 800, color: s.color }}>{Number(s.value || 0).toLocaleString()}</div>
                      <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16, fontSize: 11.5, color: '#94a3b8', lineHeight: 1.6 }}>
                  Invalid rows had no usable email address. Suppressed addresses are on the blocklist and were skipped on purpose — they are never added to a list.
                </div>

                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => { setPreview(null); setCsvText(''); setResult(null); setCurrent(0); }}
                    style={{ padding: '10px 22px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#334155' }}>
                    Import another file
                  </button>
                  <button onClick={() => nav(`${basePath}/${listId}/contacts`)}
                    style={{ padding: '10px 22px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    View contacts
                  </button>
                </div>
              </>
            ) : <div style={{ padding: 20, textAlign: 'center' }}><Spinner /></div>}
          </div>
        )}
      </div>
    </div>
  );
}
