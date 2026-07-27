import { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import ConfirmDialog from './ConfirmDialog';

const API = '/api/campaigns/templates.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const TINYMCE_SRC = '/tinymce/tinymce.min.js';
const CLOSE_ANIM_MS = 320;
const EDITOR_ID = 'nc-tpl-editor-drawer';

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

/**
 * Edit an existing email template without leaving the campaign builder — slides up
 * from the bottom, same rich-text editor as the full /netcore/templates/:id page.
 * Back arrow warns (via ConfirmDialog) if there are unsaved edits before closing, since
 * unmounting is instant and would otherwise silently discard them.
 */
export default function TemplateEditDrawer({ templateId, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [initialHtml, setInitialHtml] = useState('<p></p>');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testEmails, setTestEmails] = useState('');
  const [testSending, setTestSending] = useState(false);
  const editorRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.post(API, new URLSearchParams({ action: 'get', id: templateId }), FORM);
        if (res.data.success) {
          const t = res.data.data.template;
          setName(t.name); setCategory(t.category || ''); setSubject(t.subject_default || '');
          setInitialHtml(t.body_html || '<p></p>');
        } else toast.error('Template not found');
      } finally { setLoading(false); }
    })();
  }, [templateId]);

  useEffect(() => {
    if (loading) return;
    loadTinyMCE(() => {
      try { window.tinymce.get(EDITOR_ID)?.remove(); } catch { /* not yet initialized */ }
      window.tinymce.init({
        selector: `#${EDITOR_ID}`, license_key: 'gpl', base_url: '/tinymce', suffix: '.min',
        plugins: 'lists advlist link image table code emoticons fullscreen',
        menubar: false, height: '100%', branding: false, resize: false,
        toolbar: 'undo redo | formatselect fontsizeselect fontselect | bold italic underline | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image table | code emoticons fullscreen',
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
    return () => { try { window.tinymce?.get(EDITOR_ID)?.remove(); } catch { /* ignore */ } };
  }, [loading]); // eslint-disable-line

  const animateCloseThen = (cb) => {
    if (closing) return;
    setClosing(true);
    setTimeout(cb, CLOSE_ANIM_MS);
  };

  const requestClose = () => {
    if (saving) return;
    if (dirty) { setConfirmOpen(true); return; }
    animateCloseThen(onClose);
  };
  const discardAndClose = () => { setConfirmOpen(false); animateCloseThen(onClose); };

  const save = async () => {
    if (!name.trim()) return toast.error('Template name is required');
    setSaving(true);
    try {
      const html = editorRef.current ? editorRef.current.getContent() : '';
      if (!html.trim()) { toast.error('Template content is empty'); setSaving(false); return; }
      const body = new URLSearchParams({ action: 'save', id: templateId, name, category, subject_default: subject, body_html: html });
      const res = await api.post(API, body, FORM);
      if (res.data.success) {
        toast.success('Template saved');
        setDirty(false);
        animateCloseThen(() => onSaved({ id: templateId, name, category, subject_default: subject, body_html: html }));
      } else toast.error(res.data.message || 'Failed to save');
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error'); }
    finally { setSaving(false); }
  };

  const sendTest = async () => {
    const emails = testEmails.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    if (!emails.length) return toast.error('Enter at least one email address');
    setTestSending(true);
    try {
      const res = await api.post(API, new URLSearchParams({ action: 'send_test', id: templateId, emails: emails.join(',') }), FORM);
      if (res.data.success) {
        const ok = (res.data.data.results || []).filter(r => r.ok).length;
        if (ok > 0) toast.success(`Sent to ${ok}/${emails.length} address(es)`);
        else toast.error('All test sends failed — check ESP settings');
      } else toast.error(res.data.message || 'Failed');
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error'); }
    finally { setTestSending(false); setTestOpen(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 950, animation: `${closing ? 'nc_ted_fade_out' : 'nc_ted_fade_in'} .22s ease forwards` }}
      onClick={requestClose}>
      <style>{`
        @keyframes nc_ted_fade_in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nc_ted_fade_out { from { opacity: 1; } to { opacity: 0; } }
        @keyframes nc_ted_slide_in_bottom { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes nc_ted_slide_out_bottom { from { transform: translateY(0); } to { transform: translateY(100%); } }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: '88vh', maxHeight: '92vh',
          background: '#f8fafc', borderRadius: '18px 18px 0 0', boxShadow: '0 -12px 40px rgba(0,0,0,.18)',
          animation: `${closing ? 'nc_ted_slide_out_bottom' : 'nc_ted_slide_in_bottom'} .32s cubic-bezier(.16,1,.3,1) forwards`,
          display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0, borderRadius: '18px 18px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={requestClose} title="Back" disabled={saving}
              style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Edit template</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setTestOpen(true)} disabled={loading} style={{ padding: '9px 16px', border: '1.5px solid #1e3a8a', color: '#1e3a8a', background: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              ✈ Send Test Email
            </button>
            <button onClick={save} disabled={saving || loading}
              style={{ padding: '9px 20px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Saving…' : 'SAVE TEMPLATE'}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
            <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid #e2e8f0', background: '#fff', padding: 20, overflowY: 'auto' }}>
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
              <div id={EDITOR_ID} style={{ height: '100%' }} />
            </div>
          </div>
        )}

        {testOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 970, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setTestOpen(false)}>
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

        <ConfirmDialog
          open={confirmOpen}
          tone="warn"
          title="Discard unsaved changes?"
          message="You've made changes to this template that haven't been saved. Going back now will discard them."
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          onConfirm={discardAndClose}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    </div>
  );
}
