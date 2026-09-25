/*
 * Kumo campaign wizard — step 3, Content.
 *
 * Netcore's Content step, rebuilt on the Kumo API: sender block on the left with
 * an attribute picker under every personalisable field, the template gallery
 * under it, attachments, and the sticky live preview on the right.
 *
 * The body is a TEMPLATE, not a text box. There used to be an "Email HTML"
 * textarea here; a campaign is now defined by the template it points at, so the
 * gallery is the only way to set the body — you edit the markup in Content →
 * Email templates, where the editor lives. draft.body_html is still what gets
 * sent (the template's HTML is copied into it when you pick one), so a template
 * edited after the campaign was built does not silently change a scheduled send.
 *
 * Attribute tokens are [NAME] — Mailer.php resolves them per recipient through
 * AttributeResolver.php at send time. The preview shows them as-is, since their
 * real value only exists once a recipient is known.
 */
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { kapi } from './kumoShared';
import KumoAttributeField from './KumoAttributeField';
import { IDENTITY_TAGS, buildAttributeTags } from './kumoMergeTags';

const ATTR_API = '/api/attributes/attributes.php';
const KUMO_API = '/api/kumo/kumo.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 18 };
const inp = { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box' };
const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 };

/* Sample values so the preview reads like a real email rather than a template. */
const SAMPLE = {
  '{{first_name}}': 'Aarav', '{{last_name}}': 'Sharma', '{{full_name}}': 'Aarav Sharma',
  '{{email}}': 'aarav@example.com', '{{unsubscribe_url}}': '#unsubscribe',
};

const ATTACH_MAX_FILE = 5 * 1024 * 1024;
const ATTACH_MAX_TOTAL = 15 * 1024 * 1024;

const fmtBytes = (n) => {
  const b = Number(n || 0);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

/* A scaled-down render of the template's real HTML, the same trick the Netcore
   gallery uses: a sandboxed iframe at 200% scaled to 0.5 shows the true layout
   instead of a screenshot that would have to be generated and stored. */
function TemplateThumbnail({ html, height = 190 }) {
  if (!String(html || '').trim()) {
    return (
      <div style={{ height, background: '#f8fafc', borderRadius: 6, border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: 11 }}>
        Empty template
      </div>
    );
  }
  return (
    <div style={{ height, background: '#fff', overflow: 'hidden', position: 'relative', borderRadius: 6, border: '1px solid #f1f5f9' }}>
      <iframe title="template preview" srcDoc={previewDoc(html)} sandbox="" scrolling="no"
        style={{ width: '200%', height: '200%', border: 'none', overflow: 'hidden', transform: 'scale(0.5)', transformOrigin: 'top left', pointerEvents: 'none' }} />
    </div>
  );
}

function previewDoc(html) {
  let out = String(html || '');
  if (!out.trim()) return '';
  Object.entries(SAMPLE).forEach(([k, v]) => { out = out.split(k).join(v); });
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:16px;font-family:'Segoe UI',system-ui,sans-serif;color:#0f172a;background:#fff;}img{max-width:100%}</style>
</head><body>${out}</body></html>`;
}

export default function KumoCampaignStepContent({ draft, setField, onValidChange, saveDraft }) {
  const [templates, setTemplates] = useState([]);
  const [loadingTpl, setLoadingTpl] = useState(true);
  const [attrTags, setAttrTags] = useState([]);
  const [showReplyTo, setShowReplyTo] = useState(!!draft.reply_to);
  const [showText, setShowText] = useState(!!draft.body_text);
  const [testOpen, setTestOpen] = useState(false);
  const [testEmails, setTestEmails] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const attachments = draft.attachments || [];
  const attachedBytes = attachments.reduce((sum, a) => sum + Number(a.size || 0), 0);

  const loadTemplates = async () => {
    setLoadingTpl(true);
    try {
      const d = await kapi('templates_list', { with_html: 1 });
      setTemplates(d?.templates || []);
    } catch { toast.error('Could not load templates'); }
    finally { setLoadingTpl(false); }
  };
  useEffect(() => { loadTemplates(); }, []);

  /* The same attributes the Audience → Attributes screen manages, so a token
     inserted here is one the resolver actually knows about. */
  useEffect(() => {
    (async () => {
      try {
        const res = await api.post(ATTR_API, new URLSearchParams({ action: 'list' }), FORM);
        const shared = res?.data?.success ? (res.data.data?.attributes || []) : [];
        let mine = [];
        try { mine = (await kapi('attributes_list', { include_netcore: 0 }))?.attributes || []; } catch { /* optional */ }
        const seen = new Set();
        const all = [...shared, ...mine].filter((a) => {
          const k = String(a?.name || '').toLowerCase();
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        setAttrTags(buildAttributeTags(all));
      } catch { /* the fields still work without the picker */ }
    })();
  }, []);

  /* Sender defaults from Settings only ever fill a blank. */
  useEffect(() => {
    (async () => {
      try {
        const d = await kapi('settings_get');
        const s = d?.settings || {};
        if (!draft.from_name && s.from_name) setField('from_name', s.from_name);
        if (!draft.from_email && s.from_email) setField('from_email', s.from_email);
        if (!draft.reply_to && s.reply_to) setField('reply_to', s.reply_to);
      } catch { /* non-critical */ }
    })();
  }, []); // eslint-disable-line

  const hasBody = !!String(draft.body_html || '').trim();
  const valid = !!(draft.subject?.trim() && draft.from_email?.trim() && hasBody);
  useEffect(() => { onValidChange(valid); }, [valid]); // eslint-disable-line

  const pickTemplate = async (tpl) => {
    try {
      const d = await kapi('template_get', { id: tpl.id }).catch(() => null);
      const full = d?.template || tpl;
      setField('template_id', full.id);
      setField('template_name', full.name);
      setField('body_html', full.body_html || tpl.preview_html || tpl.snippet || '');
      if (full.body_text) setField('body_text', full.body_text);
      if (!draft.subject && full.subject) setField('subject', full.subject);
      if (!draft.preheader && full.preheader) setField('preheader', full.preheader);
      toast.success(`"${full.name || 'Template'}" selected`);
    } catch { toast.error('Could not load that template'); }
  };

  /* ── attachments ──────────────────────────────────────────────────────── */
  const chooseFile = async () => {
    /* The upload is keyed to a campaign row, so an unsaved draft is saved first —
       otherwise the file would have nowhere to belong. */
    if (!draft.id) {
      const id = await saveDraft();
      if (!id) { toast.error('Could not save the campaign — try again'); return; }
    }
    fileRef.current?.click();
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > ATTACH_MAX_FILE) { toast.error('That file is over 5MB — attach a link instead'); return; }
    if (attachedBytes + file.size > ATTACH_MAX_TOTAL) { toast.error('Total attachments would go over 15MB for this campaign'); return; }

    setUploading(true);
    const t = toast.loading(`Attaching ${file.name}…`);
    try {
      const fd = new FormData();
      fd.append('action', 'upload_attachment');
      fd.append('id', draft.id);
      fd.append('file', file);
      /* Content-Type must be cleared, not set: the axios instance defaults to
         application/json, and a FormData body sent under that label reaches PHP
         unparsed — $_POST and $_FILES both come out empty, so even the action is
         lost. undefined lets the browser write multipart/form-data + boundary. */
      const res = await api.post(KUMO_API, fd, { headers: { 'Content-Type': undefined } });
      if (res?.data?.success) {
        setField('attachments', res.data.data?.attachments || []);
        toast.success('Attached', { id: t });
      } else {
        toast.error(res?.data?.message || 'Could not attach that file', { id: t });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not attach that file', { id: t });
    } finally { setUploading(false); }
  };

  const removeAttachment = async (s3Key) => {
    const t = toast.loading('Removing…');
    try {
      const res = await api.post(KUMO_API, new URLSearchParams({ action: 'remove_attachment', id: draft.id, s3_key: s3Key }), FORM);
      if (res?.data?.success) {
        setField('attachments', res.data.data?.attachments || []);
        toast.success('Removed', { id: t });
      } else toast.error(res?.data?.message || 'Could not remove it', { id: t });
    } catch (err) { toast.error(err?.response?.data?.message || 'Could not remove it', { id: t }); }
  };

  /* ── test send ────────────────────────────────────────────────────────── */
  const sendTest = async () => {
    const emails = testEmails.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (!emails.length) return toast.error('Enter at least one email address');
    if (emails.some((e) => !/\S+@\S+\.\S+/.test(e))) return toast.error('One of those is not a valid email address');
    setTestSending(true); setTestResults(null);
    try {
      const id = await saveDraft();
      if (!id) return toast.error('Save the campaign before sending a test');
      const d = await kapi('campaign_send_test', { id, emails: emails.join(',') });
      const results = Array.isArray(d?.results) && d.results.length ? d.results : emails.map((e) => ({ email: e, ok: true }));
      setTestResults(results);
      const okCount = results.filter((r) => r.ok).length;
      if (okCount > 0) toast.success(`Test email sent to ${okCount}/${emails.length} address(es)`);
      else toast.error('All test sends failed — check Infrastructure → Settings');
    } catch (e) { toast.error(e.message || 'Failed to send test'); }
    finally { setTestSending(false); }
  };

  const doc = previewDoc(draft.body_html);
  const selected = templates.find((t) => String(t.id) === String(draft.template_id || ''));

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* ── sender ─────────────────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Sender details</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 18 }}>Define sender details to be used for sending the email</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, alignItems: 'start' }}>
            <KumoAttributeField label="Sender name" value={draft.from_name} onChange={(v) => setField('from_name', v)}
              placeholder="Internship Studio" tags={attrTags} identityTags={IDENTITY_TAGS} />
            <div>
              <label style={label}>Sender email <span style={{ color: '#dc2626' }}>*</span></label>
              <input style={inp} value={draft.from_email || ''} onChange={(e) => setField('from_email', e.target.value.trim())} placeholder="hello@mail.nitrocampus.com" />
              <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 5 }}>
                The domain must be one this MTA is authorised to sign for — see Infrastructure → Settings.
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <KumoAttributeField label="Subject" required value={draft.subject} onChange={(v) => setField('subject', v)}
              placeholder="Your subject line" tags={attrTags} identityTags={IDENTITY_TAGS} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <KumoAttributeField label="Pre-header" value={draft.preheader} onChange={(v) => setField('preheader', v)}
              placeholder="Shown next to the subject in most inboxes" tags={attrTags} identityTags={IDENTITY_TAGS} />
          </div>

          {!showReplyTo ? (
            <button type="button" onClick={() => setShowReplyTo(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', border: '1.5px dashed #c4b5fd', background: '#f5f3ff', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#1e3a8a', cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><path d="M12 5v14M5 12h14" /></svg>
              Add Reply-To Email
            </button>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ ...label, marginBottom: 0 }}>Reply-To email <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional)</span></label>
                <button type="button" onClick={() => { setShowReplyTo(false); setField('reply_to', ''); }}
                  style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Remove</button>
              </div>
              <input style={inp} list="km-reply-to-suggestions" value={draft.reply_to || ''} onChange={(e) => setField('reply_to', e.target.value)} placeholder="contact@internshipstudio.com" />
              <datalist id="km-reply-to-suggestions">
                <option value="contact@internshipstudio.com" />
                <option value="hr@internshipstudio.com" />
              </datalist>
            </div>
          )}
        </div>

        {/* ── template ───────────────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Email body</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Pick a saved template. Attributes written as <b style={{ color: '#475569' }}>[NAME]</b> inside it are filled per recipient when the campaign goes out.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button type="button" onClick={loadTemplates} title="Refresh templates"
                style={{ width: 34, height: 34, border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, cursor: 'pointer', color: '#475569' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ margin: 'auto' }}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
              </button>
              <button type="button" onClick={() => window.open('/kumo/templates/new', '_blank')}
                style={{ padding: '9px 16px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                + Create New Template
              </button>
            </div>
          </div>

          {loadingTpl ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>Loading templates…</div>
          ) : templates.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>
              No templates yet — create one in Content → Email templates, then come back and pick it.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16, marginTop: 16 }}>
              {templates.map((t) => {
                const active = String(draft.template_id || '') === String(t.id);
                return (
                  <button key={t.id} type="button" onClick={() => pickTemplate(t)}
                    style={{ width: '100%', textAlign: 'left', border: `2px solid ${active ? '#1e3a8a' : '#e2e8f0'}`, borderRadius: 10, padding: 10, background: active ? '#eef2ff' : '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <TemplateThumbnail html={t.preview_html || t.snippet} />
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', marginTop: 8, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.name || 'Untitled'}
                    </div>
                    <div style={{ fontSize: 10, color: active ? '#1e3a8a' : '#cbd5e1', fontWeight: 700 }}>
                      {active ? '✓ SELECTED' : `ID: ${t.id}`}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!hasBody && !loadingTpl && templates.length > 0 && (
            <div style={{ marginTop: 14, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 8, padding: '9px 12px', fontSize: 11.5 }}>
              Pick a template to continue — the campaign has no body yet.
            </div>
          )}

          {/* plain-text alternative */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
            {!showText ? (
              <button type="button" onClick={() => setShowText(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', border: '1.5px dashed #c4b5fd', background: '#f5f3ff', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#1e3a8a', cursor: 'pointer', fontFamily: 'inherit' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><path d="M12 5v14M5 12h14" /></svg>
                Add plain-text version
              </button>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ ...label, marginBottom: 0 }}>Plain-text version <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional)</span></label>
                  <button type="button" onClick={() => { setShowText(false); setField('body_text', ''); }}
                    style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Remove</button>
                </div>
                <textarea rows={5} style={{ ...inp, resize: 'vertical' }} value={draft.body_text || ''}
                  onChange={(e) => setField('body_text', e.target.value)}
                  placeholder="The same message with no markup — sent as the multipart alternative. Left blank, it is generated from the HTML." />
              </div>
            )}
          </div>
        </div>

        {/* ── attachments ────────────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Attachments</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                Sent with every copy of this campaign. Max 5MB per file, 15MB in total — {fmtBytes(attachedBytes)} used.
              </div>
            </div>
            <button type="button" onClick={chooseFile} disabled={uploading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', border: '1.5px dashed #c4b5fd', background: '#f5f3ff', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#1e3a8a', cursor: uploading ? 'wait' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                <path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.18 5.18l-9.2 9.2a1.83 1.83 0 0 1-2.59-2.6l8.5-8.49" />
              </svg>
              {uploading ? 'Uploading…' : 'Add attachment'}
            </button>
            <input ref={fileRef} type="file" onChange={onFile} style={{ display: 'none' }}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.txt,.csv,.zip" />
          </div>

          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              {attachments.map((a) => (
                <div key={a.s3_key || a.filename}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2} style={{ flexShrink: 0 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
                  </svg>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: '#0f172a', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.filename}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{fmtBytes(a.size)}</span>
                  <button type="button" onClick={() => removeAttachment(a.s3_key)} title="Remove"
                    style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── preview rail ─────────────────────────────────────────────────── */}
      <div style={{ flex: '0 1 620px', minWidth: 360, position: 'sticky', top: 16 }}>
        <div style={{ ...card, position: 'sticky', top: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Live preview</div>
              {selected && (
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selected.name}
                </div>
              )}
            </div>
            <button type="button" onClick={() => (hasBody ? setTestOpen(true) : toast.error('Pick a template first'))}
              disabled={!hasBody} title={!hasBody ? 'Pick a template first' : undefined}
              style={{ padding: '7px 12px', border: `1.5px solid ${hasBody ? '#1e3a8a' : '#cbd5e1'}`, color: hasBody ? '#1e3a8a' : '#94a3b8', background: '#fff', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: hasBody ? 'pointer' : 'not-allowed', flexShrink: 0 }}>
              ✈ Send Test Email
            </button>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', height: 460, background: '#f8fafc' }}>
            {doc ? (
              <iframe title="preview" srcDoc={doc} style={{ width: '100%', height: '100%', border: 'none' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 12 }}>
                Pick a template to preview it here
              </div>
            )}
          </div>
          <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 8 }}>
            Built-in tags like {'{{first_name}}'} are shown with sample values. Attribute tokens such as [COURSE] stay
            as-is here — their value only exists once a recipient is known, and is filled in at send time.
          </div>
        </div>
      </div>

      {testOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setTestOpen(false)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 26, width: 440, fontFamily: "'Plus Jakarta Sans',sans-serif" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Send test email</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
              Sends the current draft immediately, attachments included — bypasses the audience list.
            </div>
            <textarea rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="one@example.com, two@example.com"
              value={testEmails} onChange={(e) => setTestEmails(e.target.value)} />
            {testResults && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {testResults.map((r, i) => (
                  <div key={i} style={{ fontSize: 11.5, display: 'flex', justifyContent: 'space-between', color: r.ok ? '#15803d' : '#dc2626' }}>
                    <span>{r.email}</span><span>{r.ok ? '✓ Sent' : r.error || 'Failed'}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={() => setTestOpen(false)} style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={sendTest} disabled={testSending}
                style={{ padding: '9px 18px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: testSending ? 'wait' : 'pointer', opacity: testSending ? 0.7 : 1 }}>
                {testSending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
