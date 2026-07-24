import { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import AttributeField from './AttributePicker';

const TPL_API = '/api/campaigns/templates.php';
const CAMP_API = '/api/campaigns/campaigns.php';
const SETTINGS_API = '/api/campaigns/settings.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

const inp = { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box' };
const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 };
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 18 };

/* Real scaled-down render of the template's actual HTML — see TemplatesList.jsx for the same pattern. */
function TemplateThumbnail({ html, height = 100 }) {
  if (!html) {
    return <div style={{ height, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: 10 }}>No preview</div>;
  }
  return (
    <div style={{ height, background: '#fff', overflow: 'hidden', position: 'relative', borderRadius: 6, border: '1px solid #f1f5f9' }}>
      <iframe title="template preview" srcDoc={html} sandbox=""
        style={{ width: '400%', height: '400%', border: 'none', transform: 'scale(0.25)', transformOrigin: 'top left', pointerEvents: 'none' }} />
    </div>
  );
}

/* Searchable domain picker + "add a new one on the fly" — mirrors the tag picker's UX. */
function DomainPicker({ value, onChange, domains }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const filtered = domains.filter(d => d.toLowerCase().includes(search.toLowerCase()));
  const exact = domains.some(d => d.toLowerCase() === search.trim().toLowerCase());

  const pick = d => { onChange(d); setOpen(false); setSearch(''); };
  const addNew = () => {
    const d = search.trim().replace(/^@/, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!d) return;
    pick(d);
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: 220, flexShrink: 0 }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ ...inp, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: value ? '#1e293b' : '#94a3b8' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || 'Select domain'}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2.4} style={{ flexShrink: 0, marginLeft: 6, transform: `rotate(${open ? 180 : 0}deg)`, transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 10px 24px rgba(0,0,0,.12)', zIndex: 60, padding: 8 }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !exact) addNew(); }}
            placeholder="Search or add a domain…"
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12.5, marginBottom: 6, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filtered.length === 0 && <div style={{ padding: 8, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>{domains.length === 0 ? 'No domains yet — add one below' : 'No matches'}</div>}
            {filtered.map(d => (
              <div key={d} onClick={() => pick(d)}
                style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, color: value === d ? '#1e3a8a' : '#334155', background: value === d ? '#eff6ff' : 'transparent', fontWeight: value === d ? 600 : 500 }}
                onMouseEnter={e => { if (value !== d) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={e => { if (value !== d) e.currentTarget.style.background = 'transparent'; }}>
                {d}
              </div>
            ))}
          </div>
          {search.trim() !== '' && !exact && (
            <button type="button" onClick={addNew}
              style={{ marginTop: 8, width: '100%', textAlign: 'left', padding: '8px 10px', border: '1px dashed #a5b4fc', background: '#f5f3ff', borderRadius: 6, fontSize: 12.5, color: '#1e3a8a', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Use "{search.trim().replace(/^@/, '')}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function CampaignStepContent({ draft, setField, onValidChange, saveDraft }) {
  const [templates, setTemplates] = useState([]);
  const [loadingTpl, setLoadingTpl] = useState(true);
  const [domains, setDomains] = useState([]);
  const [examVersions, setExamVersions] = useState([]);
  const [showReplyTo, setShowReplyTo] = useState(!!draft.reply_to);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testEmails, setTestEmails] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResults, setTestResults] = useState(null);

  const totalAttachedBytes = (draft.attachments || []).reduce((sum, a) => sum + (a.size || 0), 0);

  const onAttachmentPicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again later
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('File too large — max 5MB per file');
    if (totalAttachedBytes + file.size > 15 * 1024 * 1024) return toast.error('Total attachments would exceed 15MB for this campaign');

    setUploadingAttachment(true);
    try {
      const id = await saveDraft();
      if (!id) return toast.error('Could not save the campaign before uploading');
      const fd = new FormData();
      fd.append('action', 'upload_attachment'); fd.append('id', id); fd.append('file', file);
      const res = await api.post(CAMP_API, fd, { headers: { 'Content-Type': undefined } });
      if (res.data.success) {
        setField('attachments', res.data.data.attachments || []);
        toast.success('Attachment added');
      } else toast.error(res.data.message || 'Upload failed');
    } catch (e2) { toast.error(e2?.response?.data?.message || 'Network error'); }
    finally { setUploadingAttachment(false); }
  };

  const removeAttachment = async (storedName) => {
    if (!draft.id) return;
    try {
      const res = await api.post(CAMP_API, new URLSearchParams({ action: 'remove_attachment', id: draft.id, stored_name: storedName }), FORM);
      if (res.data.success) setField('attachments', res.data.data.attachments || []);
      else toast.error(res.data.message || 'Could not remove attachment');
    } catch { toast.error('Network error'); }
  };

  const loadTemplates = async () => {
    setLoadingTpl(true);
    try {
      const res = await api.post(TPL_API, new URLSearchParams({ action: 'list', page: 1, per_page: 12 }), FORM);
      if (res.data.success) setTemplates(res.data.data.templates || []);
    } finally { setLoadingTpl(false); }
  };
  useEffect(() => { loadTemplates(); }, []); // eslint-disable-line

  const loadDomains = async () => {
    try {
      const res = await api.post(CAMP_API, new URLSearchParams({ action: 'domains' }), FORM);
      if (res.data.success) setDomains(res.data.data.domains || []);
    } catch { /* non-critical — user can still type a new domain */ }
  };
  useEffect(() => { loadDomains(); }, []); // eslint-disable-line

  useEffect(() => {
    (async () => {
      try {
        const res = await api.post(CAMP_API, new URLSearchParams({ action: 'exam_versions' }), FORM);
        if (res.data.success) setExamVersions(res.data.data.versions || []);
      } catch { /* non-critical — exam merge tags just won't have an exam to pick */ }
    })();
  }, []); // eslint-disable-line

  useEffect(() => {
    (async () => {
      try {
        const res = await api.post(SETTINGS_API, new URLSearchParams({ action: 'get' }), FORM);
        if (res.data.success) {
          const rows = res.data.data.settings || [];
          const active = rows.find(r => r.is_active);
          if (active && !draft.sender_email) {
            setField('sender_email', active.default_sender_email || '');
            setField('sender_name', draft.sender_name || active.default_sender_name || '');
            if (!draft.sending_domain && active.default_sending_domain) setField('sending_domain', active.default_sending_domain);
          }
        }
      } catch { /* settings not reachable — leave fields for manual entry */ }
    })(); // eslint-disable-next-line
  }, []);

  const valid = !!(draft.subject?.trim() && draft.sender_email?.trim() && draft.sending_domain && draft.template_id);
  useEffect(() => { onValidChange(valid); }, [valid]); // eslint-disable-line

  // Sender email is edited as just the local part ("alert") — the domain comes from the
  // picker next to it. draft.sender_email itself still stores the full "local@domain"
  // address, since that's what the backend/SendGrid actually needs.
  const localPart = (draft.sender_email || '').split('@')[0] || '';
  const setLocalPart = (v) => {
    const clean = v.replace(/[^a-zA-Z0-9._+-]/g, '');
    setField('sender_email', clean + (draft.sending_domain ? '@' + draft.sending_domain : ''));
  };
  const setDomain = (d) => {
    setField('sending_domain', d);
    setField('sender_email', localPart + '@' + d);
  };

  const pickTemplate = async (tpl) => {
    try {
      const res = await api.post(TPL_API, new URLSearchParams({ action: 'get', id: tpl.id }), FORM);
      if (res.data.success) {
        const full = res.data.data.template;
        setField('template_id', full.id);
        setField('template_name', full.name);
        setField('content_html', full.body_html);
        if (!draft.subject && full.subject_default) setField('subject', full.subject_default);
      }
    } catch { toast.error('Could not load template'); }
  };

  const sendTest = async () => {
    const emails = testEmails.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    if (!emails.length) return toast.error('Enter at least one email address');
    setTestSending(true); setTestResults(null);
    try {
      const id = await saveDraft();
      if (!id) return toast.error('Save the campaign before sending a test');
      const res = await api.post(CAMP_API, new URLSearchParams({ action: 'send_test', id, emails: emails.join(',') }), FORM);
      if (res.data.success) {
        setTestResults(res.data.data.results || []);
        const okCount = (res.data.data.results || []).filter(r => r.ok).length;
        if (okCount > 0) toast.success(`Test email sent to ${okCount}/${emails.length} address(es)`);
        else toast.error('All test sends failed — check the ESP settings');
      } else toast.error(res.data.message || 'Failed to send test');
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error'); }
    finally { setTestSending(false); }
  };

  return (
    <div style={{ display: 'flex', gap: 24, maxWidth: 1100 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Sender details</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 18 }}>Define sender details to be used for sending the email</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <AttributeField label="Sender name" value={draft.sender_name} onChange={v => setField('sender_name', v)} placeholder="Internship Studio" />
            <div>
              <label style={label}>Sender email <span style={{ color: '#dc2626' }}>*</span></label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input style={{ ...inp, flex: 1, minWidth: 0 }} value={localPart} onChange={e => setLocalPart(e.target.value)} placeholder="alert" />
                <span style={{ color: '#94a3b8', fontSize: 13, flexShrink: 0 }}>@</span>
                <DomainPicker value={draft.sending_domain} onChange={setDomain} domains={domains} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <AttributeField label="Subject" required value={draft.subject} onChange={v => setField('subject', v)} placeholder="Your subject line" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <AttributeField label="Pre-header" value={draft.preheader} onChange={v => setField('preheader', v)} placeholder="Shown next to the subject in most inboxes" />
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
              <input style={inp} list="nc-reply-to-suggestions" value={draft.reply_to || ''} onChange={e => setField('reply_to', e.target.value)} placeholder="contact@internshipstudio.com" />
              <datalist id="nc-reply-to-suggestions">
                <option value="contact@internshipstudio.com" />
                <option value="hr@internshipstudio.com" />
              </datalist>
            </div>
          )}

          <div style={{ marginTop: showReplyTo ? 16 : 10 }}>
            <input ref={fileInputRef} type="file" onChange={onAttachmentPicked} style={{ display: 'none' }} />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingAttachment}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', border: '1.5px dashed #c4b5fd', background: '#f5f3ff', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#1e3a8a', cursor: uploadingAttachment ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M21.44 11.05 12.25 20.24a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95L9.64 17.28a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
              {uploadingAttachment ? 'Uploading…' : 'Add Attachment'}
            </button>
            <span style={{ fontSize: 10.5, color: '#94a3b8', marginLeft: 10 }}>Max 5MB per file, 15MB total</span>

            {(draft.attachments || []).length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {draft.attachments.map(a => (
                  <div key={a.s3_key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155', minWidth: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2} style={{ flexShrink: 0 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.filename}</span>
                      <span style={{ color: '#94a3b8', flexShrink: 0 }}>({Math.round((a.size || 0) / 1024)} KB)</span>
                    </span>
                    <button type="button" onClick={() => removeAttachment(a.s3_key)}
                      style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4, flexShrink: 0 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Exam <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional)</span></div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
            Only needed if your template uses exam merge tags (like XX_EXAM_SCORE_XX). Ties this campaign to one specific exam,
            so each recipient's own score/rank/status for THAT exam gets filled in at send time.
          </div>
          <select style={inp} value={draft.exam_cit_version || ''} onChange={e => setField('exam_cit_version', e.target.value)}>
            <option value="">— None (no exam merge tags) —</option>
            {examVersions.map(v => <option key={v.id} value={v.cit_name}>{v.cit_name}</option>)}
          </select>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Email body</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Pick a saved template, or create a new one.</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={loadTemplates} title="Refresh"
                style={{ width: 34, height: 34, border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, cursor: 'pointer', color: '#475569' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ margin: 'auto' }}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
              </button>
              <button type="button" onClick={() => window.open('/netcore/templates/new', '_blank')}
                style={{ padding: '9px 16px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                + Create New Template
              </button>
            </div>
          </div>

          {loadingTpl ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>Loading templates…</div>
          ) : templates.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>No templates yet — create one to get started.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginTop: 16 }}>
              {templates.map(t => {
                const active = draft.template_id === t.id;
                return (
                  <button key={t.id} type="button" onClick={() => pickTemplate(t)}
                    style={{ textAlign: 'left', border: `2px solid ${active ? '#1e3a8a' : '#e2e8f0'}`, borderRadius: 10, padding: 10, background: active ? '#eef2ff' : '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <TemplateThumbnail html={t.body_html} />
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', marginTop: 8, marginBottom: 2 }}>{t.name}</div>
                    <div style={{ fontSize: 10, color: active ? '#1e3a8a' : '#cbd5e1', fontWeight: 700 }}>{active ? '✓ SELECTED' : `ID: ${t.id}`}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ width: 340, flexShrink: 0 }}>
        <div style={{ ...card, position: 'sticky', top: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Live preview</div>
            <button type="button" onClick={() => draft.template_id ? setTestOpen(true) : toast.error('Select a template first')}
              disabled={!draft.template_id}
              title={!draft.template_id ? 'Select a template first' : undefined}
              style={{ padding: '7px 12px', border: `1.5px solid ${draft.template_id ? '#1e3a8a' : '#cbd5e1'}`, color: draft.template_id ? '#1e3a8a' : '#94a3b8', background: '#fff', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: draft.template_id ? 'pointer' : 'not-allowed' }}>
              ✈ Send Test Email
            </button>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', height: 420, background: '#f8fafc' }}>
            {draft.content_html ? (
              <iframe title="preview" srcDoc={draft.content_html} style={{ width: '100%', height: '100%', border: 'none' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 12 }}>Select a template to preview it here</div>
            )}
          </div>
          <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 8 }}>Attribute tokens (like XX_USER_FNAME_XX) are shown as-is here — they're replaced with each recipient's real value only at send time.</div>
        </div>
      </div>

      {testOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setTestOpen(false)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 26, width: 440, fontFamily: "'Plus Jakarta Sans',sans-serif" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Send test email</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Sends the current draft immediately — bypasses the audience list.</div>
            <textarea rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="one@example.com, two@example.com"
              value={testEmails} onChange={e => setTestEmails(e.target.value)} />
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
                style={{ padding: '9px 18px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: testSending ? 'wait' : 'pointer', opacity: testSending ? .7 : 1 }}>
                {testSending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
