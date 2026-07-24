import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const LISTS_API = '/api/lists/lists.php';
const UPLOAD_API = '/api/lists/contact_uploads.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

const STEPS = [{ key: 'upload', label: 'Upload file' }, { key: 'map', label: 'Map attributes' }, { key: 'status', label: 'Status' }];

// Single source of truth for the dropdown options — mirrors the canonical
// list documented server-side in public/react-api/api/lists/lib/CsvMapper.php.
const CANONICAL_FIELDS = [
  { value: 'email', label: 'Email (required)' },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'phone', label: 'Phone' },
  { value: 'state', label: 'State' },
  { value: 'country', label: 'Country' },
  { value: 'city', label: 'City' },
  { value: 'extra', label: 'Custom field (store as-is)' },
];

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 18 };
const inp = { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box' };

function Spinner() {
  return <span style={{ display: 'inline-block', width: 32, height: 32, borderRadius: '50%', border: '3px solid #c4b5fd', borderTopColor: '#4f46e5', animation: 'nc_spin 0.85s linear infinite' }} />;
}

export default function ImportContactsWizard({ basePath = '/netcore/lists', listIdOverride } = {}) {
  const { listId: listIdParam } = useParams();
  const listId = listIdOverride || listIdParam;
  const nav = useNavigate();
  const fileInputRef = useRef(null);

  const [listName, setListName] = useState('');
  const [current, setCurrent] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [preview, setPreview] = useState(null); // { token, headers, suggested_mapping, sample_row, total_rows, original_filename }
  const [mapping, setMapping] = useState({});   // header -> canonical key | 'extra'
  const [defaults, setDefaults] = useState({}); // header -> default value string
  const [confirming, setConfirming] = useState(false);

  const [uploadId, setUploadId] = useState(null);
  const [status, setStatus] = useState(null); // polled campaign_contact_uploads row

  useEffect(() => {
    (async () => {
      try {
        const res = await api.post(LISTS_API, new URLSearchParams({ action: 'get', id: listId }), FORM);
        if (res.data.success) setListName(res.data.data.list.name);
      } catch { /* non-critical — header just won't show the list name */ }
    })();
  }, [listId]);

  // Step 3: poll upload status every 3s until it leaves pending/processing.
  useEffect(() => {
    if (!uploadId || current !== 2) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await api.post(UPLOAD_API, new URLSearchParams({ action: 'status', id: uploadId }), FORM);
        if (res.data.success && !stop) setStatus(res.data.data.upload);
      } catch { /* keep trying */ }
    };
    tick();
    const interval = setInterval(() => {
      if (status && !['pending', 'processing'].includes(status.status)) return;
      tick();
    }, 3000);
    return () => { stop = true; clearInterval(interval); };
  }, [uploadId, current]); // eslint-disable-line

  const pickFile = () => fileInputRef.current?.click();

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) return toast.error('Only CSV files are supported — export your spreadsheet as CSV first');
    setUploading(true);
    const t = toast.loading('Reading file…');
    try {
      const fd = new FormData();
      fd.append('action', 'preview_upload'); fd.append('list_id', listId); fd.append('file', file);
      const res = await api.post(UPLOAD_API, fd, { headers: { 'Content-Type': undefined } });
      if (res.data.success) {
        const d = res.data.data;
        setPreview(d);
        setMapping(d.suggested_mapping || {});
        setDefaults({});
        toast.success(`Found ${d.total_rows.toLocaleString()} row(s)`, { id: t });
        setCurrent(1);
      } else toast.error(res.data.message || 'Could not read file', { id: t });
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Network error', { id: t });
    } finally { setUploading(false); }
  };

  const onDrop = e => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const setColumnMapping = (header, value) => setMapping(m => ({ ...m, [header]: value === '' ? null : value }));
  const setColumnDefault = (header, value) => setDefaults(d => ({ ...d, [header]: value }));

  const confirmImport = async () => {
    if (!Object.values(mapping).includes('email')) return toast.error('Map at least one column to Email before importing');
    setConfirming(true);
    const t = toast.loading('Starting import…');
    try {
      const body = new URLSearchParams({
        action: 'start_import', list_id: listId, token: preview.token,
        mapping: JSON.stringify(mapping), default_values: JSON.stringify(defaults),
        original_filename: preview.original_filename, total_rows: preview.total_rows,
      });
      const res = await api.post(UPLOAD_API, body, FORM);
      if (res.data.success) {
        toast.success('Upload request successful', { id: t });
        setUploadId(res.data.data.upload_id);
        setCurrent(2);
      } else toast.error(res.data.message || 'Could not start import', { id: t });
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Network error', { id: t });
    } finally { setConfirming(false); }
  };

  const downloadSample = async () => {
    try {
      const res = await api.get(UPLOAD_API, { params: { action: 'sample_file' }, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = 'contacts_sample.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { toast.error('Could not download sample file'); }
  };

  const percent = status && status.total_rows > 0 ? status.percent : (status?.status === 'processed' ? 100 : 0);
  const inProgress = status && ['pending', 'processing'].includes(status.status);

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      <style>{`@keyframes nc_spin { to { transform: rotate(360deg); } }`}</style>

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
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 18 }}>
              Great, we found {preview.total_rows.toLocaleString()} row(s). Confirm how each column maps before importing — you can see a real sample value next to each choice.
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b', fontSize: 11, fontWeight: 700 }}>CSV header</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b', fontSize: 11, fontWeight: 700 }}>Map with System Attribute</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b', fontSize: 11, fontWeight: 700 }}>Default value (optional)</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b', fontSize: 11, fontWeight: 700 }}>Sample input data</th>
                </tr>
              </thead>
              <tbody>
                {preview.headers.map(h => (
                  <tr key={h} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '10px', fontWeight: 600, color: '#0f172a' }}>{h}</td>
                    <td style={{ padding: '10px' }}>
                      <select style={inp} value={mapping[h] ?? ''} onChange={e => setColumnMapping(h, e.target.value)}>
                        <option value="">— Don't import —</option>
                        {CANONICAL_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <input style={inp} placeholder="Enter default value" value={defaults[h] || ''} onChange={e => setColumnDefault(h, e.target.value)} />
                    </td>
                    <td style={{ padding: '10px', color: '#64748b' }}>{preview.sample_row?.[h] || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => { setPreview(null); setCurrent(0); }} style={{ padding: '10px 22px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#334155' }}>Change file</button>
              <button onClick={confirmImport} disabled={confirming}
                style={{ padding: '10px 22px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: confirming ? 'wait' : 'pointer' }}>
                {confirming ? 'Starting…' : 'Confirm & Import'}
              </button>
            </div>
          </div>
        )}

        {current === 2 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✓</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Upload request successful</div>
                <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Request ID: {uploadId}</div>
              </div>
            </div>

            {status ? (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{status.original_filename}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                    background: status.status === 'processed' ? '#dcfce7' : status.status === 'failed' ? '#fee2e2' : '#fef3c7',
                    color: status.status === 'processed' ? '#16a34a' : status.status === 'failed' ? '#dc2626' : '#92400e',
                  }}>
                    {inProgress ? `IN-PROGRESS (${percent}%)` : status.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ height: '100%', width: `${percent}%`, background: status.status === 'failed' ? '#dc2626' : '#1e3a8a', transition: 'width .3s' }} />
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>
                  {status.processed_rows.toLocaleString()} / {status.total_rows.toLocaleString()} rows processed
                  — {status.success_count.toLocaleString()} succeeded, {status.failed_count.toLocaleString()} failed
                </div>
              </div>
            ) : <div style={{ padding: 20, textAlign: 'center' }}><Spinner /></div>}

            <div style={{ marginTop: 16, fontSize: 11.5, color: '#94a3b8' }}>
              Processing runs in the background — you can safely leave this page. Check <button onClick={() => nav(basePath + '/logs')} style={{ border: 'none', background: 'none', color: '#1e3a8a', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 11.5 }}>Contact Logs</button> any time for progress.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
