import { useRef, useState } from 'react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import { WA_TPL_API, FORM, WA, inp, label } from './waShared';
import { Notice } from './WaUi';

/*
 * Bulk-import templates from the Netcore panel.
 *
 * This exists because Netcore's messaging API (waapi.pepipost.com) has no template endpoint —
 * every /api/v2/template* path returns 404, since template management lives on the
 * cpaas.netcorecloud.com side. Rather than leave the campaign wizard with an empty dropdown,
 * this takes whatever the panel can already give you.
 *
 * The JSON route is the better one: it carries the full body, buttons and header, AND the
 * request URL it came from is the endpoint we'd need to automate this properly.
 */
export default function WaTemplateImportModal({ onClose, onImported }) {
  const [tab, setTab] = useState('csv'); // 'csv' | 'json'
  const [payload, setPayload] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('File too large — max 5MB');
    // Read in the browser rather than multipart-uploading: the endpoint accepts a plain text
    // field, and this lets the admin see and correct what is about to be imported.
    const text = await file.text();
    setPayload(text);
    setTab(text.trim().startsWith('{') || text.trim().startsWith('[') ? 'json' : 'csv');
    toast.success(`Loaded ${file.name}`);
  };

  const submit = async () => {
    if (!payload.trim()) return toast.error('Paste the export, or choose a file');
    setBusy(true); setResult(null);
    try {
      const res = await api.post(WA_TPL_API, new URLSearchParams({ action: 'import', payload }), FORM);
      if (res.data.success) {
        const d = res.data.data;
        setResult(d);
        toast.success(`${d.imported} imported, ${d.updated} updated`);
        onImported?.();
      } else toast.error(res.data.message || 'Import failed', { duration: 10000 });
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Import failed', { duration: 10000 });
    } finally { setBusy(false); }
  };

  const TabBtn = ({ id, children }) => (
    <button type="button" onClick={() => setTab(id)}
      style={{
        padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        border: `1.5px solid ${tab === id ? WA.primary : '#e2e8f0'}`,
        background: tab === id ? '#eef2ff' : '#fff', color: tab === id ? WA.primary : '#64748b',
      }}>
      {children}
    </button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 960, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={() => !busy && onClose()}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 26, width: 640, maxHeight: '88vh', overflowY: 'auto', fontFamily: "'Plus Jakarta Sans',sans-serif" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Paste import</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
          Fallback for when you don't have a Meta token yet — <b>Sync from WhatsApp</b> is the better route
          and needs no copying.
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <TabBtn id="csv">From the download button</TabBtn>
          <TabBtn id="json">From the panel's network request</TabBtn>
        </div>

        {tab === 'csv' ? (
          <Notice tone="info" title="Easiest — takes about a minute">
            <div>1. Open <b>Netcore → Templates</b> (Template management).</div>
            <div>2. Click the <b>download icon</b> next to the search box. You'll get a CSV/Excel file.</div>
            <div>3. Choose that file below, or open it and paste its contents.</div>
            <div style={{ marginTop: 6 }}>
              The export usually has no message body column. Templates without body text are skipped and
              listed, so you can add just those by hand.
            </div>
          </Notice>
        ) : (
          <Notice tone="success" title="Better — brings the full body, header and buttons">
            <div>1. Open <b>Netcore → Templates</b> with DevTools open (F12) on the <b>Network</b> tab.</div>
            <div>2. Reload the page. Find the request that returns the template list (filter by Fetch/XHR).</div>
            <div>3. Right-click it → <b>Copy → Copy response</b>, and paste it below.</div>
            <div style={{ marginTop: 6 }}>
              While you're there, copy that request's <b>URL</b> too — that's the endpoint we need to make
              this sync automatic, and it isn't documented anywhere we have.
            </div>
          </Notice>
        )}

        <div style={{ marginTop: 16 }}>
          <label style={label}>{tab === 'csv' ? 'CSV contents' : 'JSON response'}</label>
          <textarea rows={9} value={payload} onChange={e => setPayload(e.target.value)}
            placeholder={tab === 'csv'
              ? 'Template name,Category,Type,Language,Status\nyet_to_appear_exam,Utility,Text,English,APPROVED'
              : '{"data":[{"name":"yet_to_appear_exam","language":"en","components":[…]}]}'}
            style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: 11.5, lineHeight: 1.5 }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.json" onChange={onFile} style={{ display: 'none' }} />
          <button type="button" onClick={() => fileRef.current?.click()}
            style={{ padding: '8px 14px', border: '1.5px dashed #a5b4fc', background: '#f5f3ff', borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: WA.primary, cursor: 'pointer', fontFamily: 'inherit' }}>
            Choose a file instead
          </button>
          {payload.trim() !== '' && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{payload.length.toLocaleString()} characters ready</span>
          )}
        </div>

        {result && (
          <div style={{ marginTop: 16, padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#15803d' }}>
              {result.imported} imported · {result.updated} updated
              {result.skipped > 0 && ` · ${result.skipped} skipped`}
            </div>
            {result.skipped > 0 && (
              <div style={{ fontSize: 11.5, color: '#475569', marginTop: 6, lineHeight: 1.6 }}>
                Skipped because the export carried no message text — open each in the editor and paste its
                body from the panel:<br />
                <b>{(result.skipped_names || []).join(', ')}</b>
                {result.skipped > (result.skipped_names || []).length && ' …'}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} disabled={busy}
            style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            {result ? 'DONE' : 'CANCEL'}
          </button>
          <button onClick={submit} disabled={busy}
            style={{ padding: '9px 22px', border: 'none', background: WA.green, color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
            {busy ? 'Importing…' : 'IMPORT'}
          </button>
        </div>
      </div>
    </div>
  );
}
