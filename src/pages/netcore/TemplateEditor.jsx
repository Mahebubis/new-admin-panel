import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import ConfirmDialog from './ConfirmDialog';
import EmailBuilder from './EmailBuilder';

const API = '/api/campaigns/templates.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const TINYMCE_SRC = '/tinymce/tinymce.min.js';

function loadTinyMCE(cb) {
  if (window.tinymce) return cb();
  const existing = document.querySelector(`script[src="${TINYMCE_SRC}"]`);
  if (existing) { existing.addEventListener('load', cb); return; }
  const s = document.createElement('script');
  s.src = TINYMCE_SRC; s.onload = cb;
  document.head.appendChild(s);
}

const inp = { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box' };
const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 };

export default function TemplateEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const isEdit = !!id;

  const [mode, setMode] = useState(isEdit ? 'editor' : null); // null | 'upload' | 'editor' | 'builder'
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [initialHtml, setInitialHtml] = useState('<p>Start typing your email…</p>');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef(null);
  const builderRef = useRef(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testEmails, setTestEmails] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmBackOpen, setConfirmBackOpen] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await api.post(API, new URLSearchParams({ action: 'get', id }), FORM);
        if (res.data.success) {
          const t = res.data.data.template;
          setName(t.name); setCategory(t.category || ''); setSubject(t.subject_default || '');
          setInitialHtml(t.body_html || '<p></p>');
          setMode('editor');
        } else toast.error('Template not found');
      } finally { setLoading(false); }
    })();
  }, [id]); // eslint-disable-line

  useEffect(() => {
    if (mode !== 'editor' || loading) return;
    loadTinyMCE(() => {
      try { window.tinymce.get('nc-tpl-editor')?.remove(); } catch { /* not yet initialized */ }
      window.tinymce.init({
        selector: '#nc-tpl-editor', license_key: 'gpl', base_url: '/tinymce', suffix: '.min',
        plugins: 'lists advlist link image table code emoticons fullscreen',
        menubar: false, height: '100%', branding: false, resize: false,
        toolbar: 'undo redo | formatselect fontsizeselect fontselect | bold italic underline | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image table | code emoticons fullscreen',
        // Drag an image file from your desktop straight onto the editor (or paste one) and it
        // uploads here, then TinyMCE inserts a normal <img src="..."> pointing at it — real
        // hosted images, not giant inline base64 blobs (which real ESPs/mail clients often
        // strip or choke on). This is what makes drag-and-drop actually work in this editor.
        images_upload_handler: (blobInfo) => new Promise((resolve, reject) => {
          const fd = new FormData();
          fd.append('action', 'upload_image');
          fd.append('image', blobInfo.blob(), blobInfo.filename());
          api.post(API, fd, { headers: { 'Content-Type': undefined } })
            .then((res) => {
              if (res.data?.success && res.data?.data?.location) resolve(res.data.data.location);
              else reject(res.data?.message || 'Image upload failed');
            })
            .catch((err) => reject(err?.response?.data?.message || 'Image upload failed'));
        }),
        automatic_uploads: true,
        paste_data_images: true,
        setup: (editor) => {
          editor.on('init', () => { editor.setContent(initialHtml); editorRef.current = editor; });
          editor.on('input change undo keyup', () => setDirty(true));
        },
      });
    });
    return () => { try { window.tinymce?.get('nc-tpl-editor')?.remove(); } catch { /* ignore */ } };
  }, [mode, loading]); // eslint-disable-line

  const getCurrentHtml = () => {
    if (mode === 'builder') return builderRef.current ? builderRef.current.runCommand('gjs-get-inlined-html') : '';
    return editorRef.current ? editorRef.current.getContent() : '';
  };

  // Hands the in-progress HTML from one editor to the other when the admin switches —
  // without this, switching modes would silently discard whatever was just built.
  const switchToBuilder = () => { setInitialHtml(getCurrentHtml()); setMode('builder'); };
  const switchToEditor = () => { setInitialHtml(getCurrentHtml()); setMode('editor'); };

  const save = async () => {
    if (!name.trim()) return toast.error('Template name is required');
    setSaving(true);
    try {
      const html = getCurrentHtml();
      if (!html.trim()) { toast.error('Template content is empty'); setSaving(false); return; }
      const body = new URLSearchParams({ action: 'save', id: id || '', name, category, subject_default: subject, body_html: html });
      const res = await api.post(API, body, FORM);
      if (res.data.success) {
        toast.success('Template saved');
        setDirty(false);
        nav('/netcore/templates');
      } else toast.error(res.data.message || 'Failed to save');
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error'); }
    finally { setSaving(false); }
  };

  const upload = async () => {
    if (!name.trim()) return toast.error('Template name is required');
    if (!file) return toast.error('Choose an .htm/.html file');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('action', 'upload'); fd.append('name', name); fd.append('category', category); fd.append('html_file', file);
      const res = await api.post(API, fd, { headers: { 'Content-Type': undefined } });
      if (res.data.success) { toast.success('Template uploaded'); nav('/netcore/templates'); }
      else toast.error(res.data.message || 'Upload failed');
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error'); }
    finally { setSaving(false); }
  };

  const sendTest = async () => {
    if (!isEdit) return toast.error('Save the template first');
    const emails = testEmails.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    if (!emails.length) return toast.error('Enter at least one email address');
    setTestSending(true);
    try {
      const res = await api.post(API, new URLSearchParams({ action: 'send_test', id, emails: emails.join(',') }), FORM);
      if (res.data.success) {
        const ok = (res.data.data.results || []).filter(r => r.ok).length;
        if (ok > 0) toast.success(`Sent to ${ok}/${emails.length} address(es)`);
        else toast.error('All test sends failed — check ESP settings');
      } else toast.error(res.data.message || 'Failed');
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error'); }
    finally { setTestSending(false); setTestOpen(false); }
  };

  const requestBack = () => {
    if (dirty) setConfirmBackOpen(true);
    else nav('/netcore/templates');
  };

  const BackConfirm = () => (
    <ConfirmDialog
      open={confirmBackOpen}
      tone="warn"
      title="Discard unsaved changes?"
      message="This template has changes that haven't been saved. Going back now will discard them."
      confirmLabel="Discard changes"
      cancelLabel="Keep editing"
      onConfirm={() => { setConfirmBackOpen(false); nav('/netcore/templates'); }}
      onCancel={() => setConfirmBackOpen(false)}
    />
  );

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
        {isEdit && (
          <button onClick={() => setTestOpen(true)} style={{ padding: '10px 18px', border: '1.5px solid #1e3a8a', color: '#1e3a8a', background: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            ✈ Send Test Email
          </button>
        )}
        {onSave && (
          <button onClick={onSave} disabled={saving}
            style={{ padding: '10px 22px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
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
            <label style={label}>Template's name <span style={{ color: '#dc2626' }}>*</span></label>
            <input style={inp} value={name} onChange={e => { setName(e.target.value); setDirty(true); }} placeholder="Name" />
            <div style={{ marginTop: 14 }}>
              <label style={label}>Category <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional)</span></label>
              <input style={inp} value={category} onChange={e => { setCategory(e.target.value); setDirty(true); }} placeholder="Choose category or add new" />
            </div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Create using</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <button onClick={() => setMode('upload')} style={{ textAlign: 'left', padding: 20, border: '1.5px solid #e2e8f0', borderRadius: 12, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Upload HTML</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>Upload a finished .html file directly.</div>
            </button>
            <button onClick={() => setMode('editor')} style={{ textAlign: 'left', padding: 20, border: '1.5px solid #e2e8f0', borderRadius: 12, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Rich-text editor</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>Compose with the same editor used for your other email templates.</div>
            </button>
            <button onClick={() => setMode('builder')} style={{ textAlign: 'left', padding: 20, border: '1.5px solid #e2e8f0', borderRadius: 12, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', position: 'relative' }}>
              <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 800, color: '#1e3a8a', background: '#eef2ff', padding: '2px 7px', borderRadius: 999 }}>UNIFIED</span>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Drag & drop editor</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>Build visually — drag blocks like text, image, button and divider onto a canvas.</div>
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
            <label style={label}>Template's name <span style={{ color: '#dc2626' }}>*</span></label>
            <input style={inp} value={name} onChange={e => { setName(e.target.value); setDirty(true); }} />
            <div style={{ marginTop: 14, marginBottom: 18 }}>
              <label style={label}>Category</label>
              <input style={inp} value={category} onChange={e => { setCategory(e.target.value); setDirty(true); }} />
            </div>
            <label style={label}>Upload file (.htm/.html) <span style={{ color: '#dc2626' }}>*</span></label>
            <div style={{ border: '2px dashed #cbd5e1', borderRadius: 10, padding: 30, textAlign: 'center' }}>
              <input type="file" accept=".htm,.html" onChange={e => { setFile(e.target.files?.[0] || null); setDirty(true); }} style={{ fontSize: 12.5 }} />
              {file && <div style={{ marginTop: 10, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>{file.name} ({Math.round(file.size / 1024)} KB)</div>}
            </div>
          </div>
        </div>
        <BackConfirm />
      </div>
    );
  }

  // ── Drag & drop (unified) builder flow ──
  if (mode === 'builder') {
    return (
      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
          <button onClick={requestBack} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#334155', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <input style={{ ...inp, width: 200, flexShrink: 0 }} value={name} onChange={e => { setName(e.target.value); setDirty(true); }} placeholder="Template's name *" />
          <input style={{ ...inp, width: 160, flexShrink: 0 }} value={category} onChange={e => { setCategory(e.target.value); setDirty(true); }} placeholder="Category" />
          <input style={{ ...inp, flex: 1, minWidth: 140 }} value={subject} onChange={e => { setSubject(e.target.value); setDirty(true); }} placeholder="Default subject (optional)" />
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <button onClick={switchToEditor} style={{ padding: '10px 16px', border: '1.5px solid #e2e8f0', color: '#334155', background: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Rich-text editor
            </button>
            {isEdit && (
              <button onClick={() => setTestOpen(true)} style={{ padding: '10px 16px', border: '1.5px solid #1e3a8a', color: '#1e3a8a', background: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                ✈ Send Test
              </button>
            )}
            <button onClick={save} disabled={saving}
              style={{ padding: '10px 20px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
              {saving ? 'Saving…' : 'SAVE TEMPLATE'}
            </button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <EmailBuilder initialHtml={initialHtml} onReady={e => { builderRef.current = e; }} onDirty={() => setDirty(true)} />
        </div>

        {testOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setTestOpen(false)}>
            <div style={{ background: '#fff', borderRadius: 14, padding: 26, width: 420, fontFamily: "'Plus Jakarta Sans',sans-serif" }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Send test email</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>Sends this saved template using your default ESP sender.</div>
              <textarea rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="one@example.com, two@example.com" value={testEmails} onChange={e => setTestEmails(e.target.value)} />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button onClick={() => setTestOpen(false)} style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                <button onClick={sendTest} disabled={testSending} style={{ padding: '9px 18px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: testSending ? 'wait' : 'pointer' }}>{testSending ? 'Sending…' : 'Send'}</button>
              </div>
            </div>
          </div>
        )}
        <BackConfirm />
      </div>
    );
  }

  // ── Rich-text editor flow (also used for editing an existing template) ──
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      <TopBar onSave={save} extra={(
        <button onClick={switchToBuilder} style={{ padding: '10px 16px', border: '1.5px solid #e2e8f0', color: '#334155', background: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          ⬚ Drag & drop editor
        </button>
      )} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: 340, flexShrink: 0, borderRight: '1px solid #e2e8f0', background: '#fff', padding: 20, overflowY: 'auto' }}>
          <label style={label}>Template's name <span style={{ color: '#dc2626' }}>*</span></label>
          <input style={inp} value={name} onChange={e => { setName(e.target.value); setDirty(true); }} />
          <div style={{ marginTop: 14 }}>
            <label style={label}>Category</label>
            <input style={inp} value={category} onChange={e => { setCategory(e.target.value); setDirty(true); }} />
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={label}>Default subject</label>
            <input style={inp} value={subject} onChange={e => { setSubject(e.target.value); setDirty(true); }} placeholder="Used to prefill a campaign's subject" />
          </div>
        </div>
        <div style={{ flex: 1, padding: 16, minWidth: 0 }}>
          <div id="nc-tpl-editor" style={{ height: '100%' }} />
        </div>
      </div>

      {testOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setTestOpen(false)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 26, width: 420, fontFamily: "'Plus Jakarta Sans',sans-serif" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Send test email</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>Sends this saved template using your default ESP sender.</div>
            <textarea rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="one@example.com, two@example.com" value={testEmails} onChange={e => setTestEmails(e.target.value)} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setTestOpen(false)} style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={sendTest} disabled={testSending} style={{ padding: '9px 18px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: testSending ? 'wait' : 'pointer' }}>{testSending ? 'Sending…' : 'Send'}</button>
            </div>
          </div>
        </div>
      )}
      <BackConfirm />
    </div>
  );
}
