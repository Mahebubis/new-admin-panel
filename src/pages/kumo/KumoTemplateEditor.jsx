/*
 * Kumo — Email template editor (full-screen route, outside the module chrome).
 *
 * A clone of the Netcore template editor (src/pages/netcore/TemplateEditor.jsx): same
 * top bar, same "create using" step, same 340px field rail beside a full-height TinyMCE,
 * same save bar and the same discard-changes confirm. Only the data layer differs —
 * template_get / template_save go through kapi() against api/kumo/kumo.php.
 *
 * TinyMCE is the SELF-HOSTED build served from /tinymce/tinymce.min.js (license_key:'gpl',
 * base_url:'/tinymce'). This is deliberate and must stay that way — the cloud build's API
 * key is domain-locked and 404s/watermarks on these panels.
 *
 * Two things Netcore has that Kumo has no endpoint for:
 *   • image upload to S3 — the image button stays, but images_upload_handler rejects with a
 *     clear message instead of failing silently, so pasted/dropped binaries tell you to host
 *     the file and paste its URL (which the same dialog accepts).
 *   • "Upload HTML" — Kumo has no upload action, so the file is read in the browser and saved
 *     through the ordinary template_save call. Same screen, same result.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { kapi } from './kumoShared';

const TINYMCE_SRC = '/tinymce/tinymce.min.js';
const EDITOR_ID = 'kmt-tpl-editor';
const NO_UPLOADS_MSG = 'Host the image and paste its URL — uploads are not wired up for Kumo yet';

function loadTinyMCE(cb) {
  if (window.tinymce) return cb();
  const existing = document.querySelector(`script[src="${TINYMCE_SRC}"]`);
  if (existing) { existing.addEventListener('load', cb); return; }
  const s = document.createElement('script');
  s.src = TINYMCE_SRC; s.onload = cb;
  document.head.appendChild(s);
}

/* File.text() isn't in every browser this panel still has to run on. */
function readFileText(f) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('Could not read that file'));
    r.readAsText(f);
  });
}

/* Rough plain-text fallback so the text part is never empty when a client demands one. */
function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const inp = { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box' };
const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 };

/* Same "are you sure?" card the Netcore flow uses, kept local so this module owns it. */
function KmtConfirm({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'danger', busy = false, onConfirm, onCancel }) {
  if (!open) return null;
  const colors = tone === 'warn'
    ? { bg: '#fef3c7', stroke: '#d97706', btn: '#d97706' }
    : { bg: '#fee2e2', stroke: '#dc2626', btn: '#dc2626' };
  return (
    <div onClick={() => !busy && onCancel()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'kmt_fade_in .15s ease' }}>
      <style>{`
        @keyframes kmt_fade_in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes kmt_pop_in { from { opacity: 0; transform: scale(.94) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, padding: '26px 26px 22px', width: 380, maxWidth: '90vw', boxShadow: '0 24px 60px rgba(15,23,42,.28)', animation: 'kmt_pop_in .18s cubic-bezier(.16,1,.3,1)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          {tone === 'warn' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.stroke} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.stroke} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
            </svg>
          )}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.55, marginBottom: 22 }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button disabled={busy} onClick={onCancel}
            style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#334155', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {cancelLabel}
          </button>
          <button disabled={busy} onClick={onConfirm}
            style={{ padding: '9px 18px', border: 'none', background: colors.btn, color: '#fff', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? .75 : 1, fontFamily: 'inherit' }}>
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KumoTemplateEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const isEdit = !!id;

  const [mode, setMode] = useState(isEdit ? 'editor' : null);   // null | 'upload' | 'editor'
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [initialHtml, setInitialHtml] = useState('<p>Start typing your email…</p>');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef(null);
  const [dirty, setDirty] = useState(false);
  const [confirmBackOpen, setConfirmBackOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState(null);
  const [device, setDevice] = useState('desktop');

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const d = await kapi('template_get', { id });
        const t = d?.template || {};
        setName(t.name || '');
        setCategory(t.category || '');
        setSubject(t.subject || '');
        setPreheader(t.preheader || '');
        setBodyText(t.body_text || '');
        setInitialHtml(t.body_html || '<p></p>');
        setMode('editor');
      } catch (e) {
        toast.error(e.message || 'Template not found');
      } finally { setLoading(false); }
    })();
  }, [id]); // eslint-disable-line

  useEffect(() => {
    if (mode !== 'editor' || loading) return undefined;
    loadTinyMCE(() => {
      try { window.tinymce.get(EDITOR_ID)?.remove(); } catch { /* not yet initialized */ }
      window.tinymce.init({
        selector: `#${EDITOR_ID}`, license_key: 'gpl', base_url: '/tinymce', suffix: '.min',
        plugins: 'lists advlist link image table code emoticons fullscreen',
        menubar: false, height: '100%', branding: false, resize: false,
        toolbar: 'undo redo | formatselect fontsizeselect fontselect | bold italic underline | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image table | code emoticons fullscreen',
        // Kumo has no S3 upload endpoint, so binaries dropped or pasted into the editor are
        // refused loudly rather than turning into giant inline base64 blobs (which real
        // ESPs/mail clients often strip or choke on). The image dialog still takes a URL, so
        // "host it somewhere and paste the link" remains the supported path.
        images_upload_handler: () => {
          toast.error(NO_UPLOADS_MSG);
          // `remove: true` pulls the placeholder back out of the document, so a refused
          // paste leaves the body exactly as it was instead of a broken <img>.
          return Promise.reject({ message: NO_UPLOADS_MSG, remove: true });
        },
        automatic_uploads: true,
        paste_data_images: true,
        image_advtab: true,
        setup: (editor) => {
          editor.on('init', () => { editor.setContent(initialHtml); editorRef.current = editor; });
          editor.on('input change undo keyup', () => setDirty(true));
        },
      });
    });
    return () => { try { window.tinymce?.get(EDITOR_ID)?.remove(); } catch { /* ignore */ } };
  }, [mode, loading]); // eslint-disable-line

  const getCurrentHtml = () => (editorRef.current ? editorRef.current.getContent() : initialHtml);

  const persist = async (html) => {
    const payload = {
      name: name.trim(),
      category: category.trim(),
      subject,
      preheader,
      body_html: html,
      body_text: bodyText.trim() || htmlToText(html),
    };
    if (id) payload.id = id;
    await kapi('template_save', payload);
  };

  const save = async () => {
    if (!name.trim()) return toast.error('Template name is required');
    setSaving(true);
    try {
      const html = getCurrentHtml();
      if (!html.trim()) { toast.error('Template content is empty'); setSaving(false); return; }
      await persist(html);
      // Nothing to adopt here: this page navigates straight back to the gallery, which re-reads
      // every template from the server — so the stored copy is what it shows.
      toast.success('Template saved');
      setDirty(false);
      nav('/kumo/templates');
    } catch (e) { toast.error(e.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const upload = async () => {
    if (!name.trim()) return toast.error('Template name is required');
    if (!file) return toast.error('Choose an .htm/.html file');
    setSaving(true);
    try {
      const html = await readFileText(file);
      if (!html.trim()) { toast.error('That file is empty'); setSaving(false); return; }
      await persist(html);
      toast.success('Template uploaded');
      setDirty(false);
      nav('/kumo/templates');
    } catch (e) { toast.error(e.message || 'Upload failed'); }
    finally { setSaving(false); }
  };

  const openPreview = async () => {
    if (mode === 'upload') {
      if (!file) return toast.error('Choose an .htm/.html file first');
      try { setPreviewHtml(await readFileText(file)); } catch (e) { toast.error(e.message || 'Could not read that file'); return; }
    } else {
      setPreviewHtml(getCurrentHtml());
    }
    setDevice('desktop');
  };

  const requestBack = () => {
    if (dirty) setConfirmBackOpen(true);
    else nav('/kumo/templates');
  };

  const BackConfirm = () => (
    <KmtConfirm
      open={confirmBackOpen}
      tone="warn"
      title="Discard unsaved changes?"
      message="This template has changes that haven't been saved. Going back now will discard them."
      confirmLabel="Discard changes"
      cancelLabel="Keep editing"
      onConfirm={() => { setConfirmBackOpen(false); nav('/kumo/templates'); }}
      onCancel={() => setConfirmBackOpen(false)}
    />
  );

  const Preview = () => {
    if (previewHtml === null) return null;
    return (
      <div onClick={() => setPreviewHtml(null)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 960, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div onClick={e => e.stopPropagation()}
          style={{ background: '#fff', borderRadius: 14, width: 'min(960px, 92vw)', height: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{name || 'Untitled template'}</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{subject || 'No subject set'}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {['desktop', 'mobile'].map(d => (
                <button key={d} onClick={() => setDevice(d)}
                  style={{ padding: '7px 14px', border: `1.5px solid ${device === d ? '#1e3a8a' : '#e2e8f0'}`, background: device === d ? '#eff6ff' : '#fff', color: device === d ? '#1e3a8a' : '#475569', borderRadius: 6, fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', textTransform: 'capitalize' }}>{d}</button>
              ))}
              <button onClick={() => setPreviewHtml(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 22, lineHeight: 1, padding: '0 4px' }}>×</button>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, background: '#f1f5f9', display: 'flex', justifyContent: 'center', padding: 16 }}>
            <iframe title="template preview" srcDoc={previewHtml || '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Nothing to preview yet.</p>'} sandbox=""
              style={{ width: device === 'mobile' ? 390 : '100%', height: '100%', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }} />
          </div>
        </div>
      </div>
    );
  };

  const TopBar = ({ onSave, extra }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 26px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={requestBack} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{isEdit ? 'Edit template' : 'Create template'}</div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {extra}
        {mode && (
          <button onClick={openPreview} style={{ padding: '10px 18px', border: '1.5px solid #1e3a8a', color: '#1e3a8a', background: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            👁 Preview
          </button>
        )}
        {onSave && (
          <button onClick={onSave} disabled={saving}
            style={{ padding: '10px 22px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : 'SAVE TEMPLATE'}
          </button>
        )}
      </div>
    </div>
  );

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8' }}>Loading…</div>;

  // ── Step 1 for new templates: choose Upload vs Editor ──
  if (!mode) {
    return (
      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
        <TopBar />
        <div style={{ flex: 1, overflow: 'auto', padding: 26, maxWidth: 640, margin: '0 auto', width: '100%' }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 22, marginBottom: 18 }}>
            <label style={label}>Template&apos;s name <span style={{ color: '#dc2626' }}>*</span></label>
            <input style={inp} value={name} onChange={e => { setName(e.target.value); setDirty(true); }} placeholder="Name" />
            <div style={{ marginTop: 14 }}>
              <label style={label}>Category <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional)</span></label>
              <input style={inp} value={category} onChange={e => { setCategory(e.target.value); setDirty(true); }} placeholder="Choose category or add new" />
            </div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Create using</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <button onClick={() => setMode('upload')} style={{ textAlign: 'left', padding: 20, border: '1.5px solid #e2e8f0', borderRadius: 12, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Upload HTML</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>Upload a finished .html file directly.</div>
            </button>
            <button onClick={() => setMode('editor')} style={{ textAlign: 'left', padding: 20, border: '1.5px solid #e2e8f0', borderRadius: 12, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Rich-text editor</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>Compose with the same editor used for your other email templates.</div>
            </button>
          </div>
        </div>
        <BackConfirm />
      </div>
    );
  }

  // ── Upload flow ──
  if (mode === 'upload') {
    return (
      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
        <TopBar onSave={upload} />
        <div style={{ flex: 1, overflow: 'auto', padding: 26, maxWidth: 640, margin: '0 auto', width: '100%' }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 22 }}>
            <label style={label}>Template&apos;s name <span style={{ color: '#dc2626' }}>*</span></label>
            <input style={inp} value={name} onChange={e => { setName(e.target.value); setDirty(true); }} />
            <div style={{ marginTop: 14 }}>
              <label style={label}>Category</label>
              <input style={inp} value={category} onChange={e => { setCategory(e.target.value); setDirty(true); }} />
            </div>
            <div style={{ marginTop: 14, marginBottom: 18 }}>
              <label style={label}>Default subject</label>
              <input style={inp} value={subject} onChange={e => { setSubject(e.target.value); setDirty(true); }} placeholder="Used to prefill a campaign's subject" />
            </div>
            <label style={label}>Upload file (.htm/.html) <span style={{ color: '#dc2626' }}>*</span></label>
            <div style={{ border: '2px dashed #cbd5e1', borderRadius: 10, padding: 30, textAlign: 'center' }}>
              <input type="file" accept=".htm,.html" onChange={e => { setFile(e.target.files?.[0] || null); setDirty(true); }} style={{ fontSize: 12.5 }} />
              {file && <div style={{ marginTop: 10, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>{file.name} ({Math.round(file.size / 1024)} KB)</div>}
            </div>
            <div style={{ marginTop: 12, fontSize: 11.5, color: '#94a3b8', lineHeight: 1.6 }}>
              Images must already be hosted somewhere public — the file is stored exactly as written, and Kumo does not rewrite or upload the assets it points at.
            </div>
          </div>
        </div>
        <Preview />
        <BackConfirm />
      </div>
    );
  }

  // ── Rich-text editor flow (also used for editing an existing template) ──
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      <TopBar onSave={save} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: 340, flexShrink: 0, borderRight: '1px solid #e2e8f0', background: '#fff', padding: 20, overflowY: 'auto' }}>
          <label style={label}>Template&apos;s name <span style={{ color: '#dc2626' }}>*</span></label>
          <input style={inp} value={name} onChange={e => { setName(e.target.value); setDirty(true); }} />
          <div style={{ marginTop: 14 }}>
            <label style={label}>Category</label>
            <input style={inp} value={category} onChange={e => { setCategory(e.target.value); setDirty(true); }} />
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={label}>Default subject</label>
            <input style={inp} value={subject} onChange={e => { setSubject(e.target.value); setDirty(true); }} placeholder="Used to prefill a campaign's subject" />
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={label}>Preheader</label>
            <input style={inp} value={preheader} onChange={e => { setPreheader(e.target.value); setDirty(true); }} placeholder="Preview line shown after the subject" />
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ ...label, marginBottom: 0 }}>Plain-text version</label>
              <button onClick={() => { setBodyText(htmlToText(getCurrentHtml())); setDirty(true); }}
                style={{ border: 'none', background: 'none', color: '#1e3a8a', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                Generate from HTML
              </button>
            </div>
            <textarea rows={6} style={{ ...inp, resize: 'vertical' }} value={bodyText}
              onChange={e => { setBodyText(e.target.value); setDirty(true); }}
              placeholder="Left blank, a plain-text part is generated from the HTML on save." />
          </div>
          <div style={{ marginTop: 16, padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>
            <strong style={{ color: '#334155' }}>Images:</strong> {NO_UPLOADS_MSG}. Use the image button and paste the link into its <em>Source</em> field — dropping or pasting a file will be refused.
          </div>
        </div>
        <div style={{ flex: 1, padding: 16, minWidth: 0 }}>
          <div id={EDITOR_ID} style={{ height: '100%' }} />
        </div>
      </div>

      <Preview />
      <BackConfirm />
    </div>
  );
}
