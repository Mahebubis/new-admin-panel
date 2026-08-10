import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import ConfirmDialog from '../ConfirmDialog';
import SearchableSelect from './SearchableSelect';
import WaPhonePreview from './WaPhonePreview';
import { WA_TPL_API, FORM, WA, WA_CSS, inp, label, card } from './waShared';
import { Spinner, WhatsAppIcon, Notice, ApprovalBadge } from './WaUi';


const LANGUAGES = [
  { value: 'en', label: 'English', sublabel: 'en' },
  { value: 'en_US', label: 'English (US)', sublabel: 'en_US' },
  { value: 'en_GB', label: 'English (UK)', sublabel: 'en_GB' },
  { value: 'hi', label: 'Hindi', sublabel: 'hi' },
  { value: 'mr', label: 'Marathi', sublabel: 'mr' },
  { value: 'gu', label: 'Gujarati', sublabel: 'gu' },
  { value: 'ta', label: 'Tamil', sublabel: 'ta' },
  { value: 'te', label: 'Telugu', sublabel: 'te' },
  { value: 'bn', label: 'Bengali', sublabel: 'bn' },
  { value: 'kn', label: 'Kannada', sublabel: 'kn' },
  { value: 'ml', label: 'Malayalam', sublabel: 'ml' },
  { value: 'pa', label: 'Punjabi', sublabel: 'pa' },
];

const CATEGORIES = [
  { value: 'utility', label: 'Utility', sublabel: 'order/exam updates, reminders' },
  { value: 'marketing', label: 'Marketing', sublabel: 'offers, announcements' },
  { value: 'authentication', label: 'Authentication', sublabel: 'one-time passcodes' },
];

const HEADER_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'text', label: 'Text' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'document', label: 'Document' },
];

const APPROVALS = [
  { value: 'pending', label: 'Pending with Meta', sublabel: 'submitted, not yet usable' },
  { value: 'approved', label: 'Approved', sublabel: 'ready to send' },
  { value: 'rejected', label: 'Rejected', sublabel: 'needs changes' },
  { value: 'unknown', label: 'Unknown', sublabel: 'status not tracked' },
];

const BUTTON_TYPES = [
  { value: 'url', label: 'Visit website', sublabel: 'opens a link' },
  { value: 'phone', label: 'Call phone number', sublabel: 'dials a number' },
  { value: 'quick_reply', label: 'Quick reply', sublabel: 'sends a canned reply' },
];

const EMPTY = {
  id: null, meta_template_id: '', name: '', display_name: '', category: 'utility', language: 'en',
  header_type: 'none', header_text: '', header_media_url: '',
  body_text: '', footer_text: '', buttons: [], click_target_url: '',
  sample_values: { header: [], body: [] },
  approval_status: 'pending',
};

function countVars(text) {
  const m = String(text || '').match(/\{\{\s*(\d+)\s*\}\}/g) || [];
  return m.reduce((max, tok) => Math.max(max, parseInt(tok.replace(/\D/g, ''), 10) || 0), 0);
}

export default function WaTemplateEditor() {
  const { id: routeId } = useParams();
  const nav = useNavigate();
  const [tpl, setTpl] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(!!routeId);
  const [saving, setSaving] = useState(false);
  const [metaBusy, setMetaBusy] = useState(false);
  const [confirmBackOpen, setConfirmBackOpen] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const bodyRef = useRef(null);
  const lastSavedRef = useRef(JSON.stringify(EMPTY));

  useEffect(() => {
    if (!routeId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await api.post(WA_TPL_API, new URLSearchParams({ action: 'get', id: routeId }), FORM);
        if (res.data.success) {
          const t = res.data.data.template;
          const loaded = {
            ...EMPTY, ...t,
            id: Number(t.id),
            buttons: t.buttons || [],
            click_target_url: t.click_target_url || '',
            sample_values: {
              header: t.sample_values?.header || [],
              body: t.sample_values?.body || [],
            },
          };
          setTpl(loaded);
          lastSavedRef.current = JSON.stringify(loaded);
        } else toast.error('Template not found');
      } catch { toast.error('Could not load the template'); }
      finally { setLoading(false); }
    })();
  }, [routeId]);

  const set = (k, v) => setTpl(t => ({ ...t, [k]: v }));
  // Meta already holds this one's approved wording, so it can only be saved locally.
  const alreadyApproved = !!tpl.meta_template_id && tpl.approval_status === 'approved';
  const bodyVars = countVars(tpl.body_text);
  const headerVars = tpl.header_type === 'text' ? countVars(tpl.header_text) : 0;

  /* Appends the next placeholder at the cursor. WhatsApp requires a consecutive 1..N run, so
     the number is derived from what's already used rather than being typed by hand. */
  const insertVariable = () => {
    const el = bodyRef.current;
    const next = bodyVars + 1;
    const token = `{{${next}}}`;
    const start = el?.selectionStart ?? (tpl.body_text || '').length;
    const end = el?.selectionEnd ?? start;
    const text = (tpl.body_text || '');
    set('body_text', text.slice(0, start) + token + text.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const setSample = (group, i, v) => {
    setTpl(t => {
      const s = { header: [...(t.sample_values?.header || [])], body: [...(t.sample_values?.body || [])] };
      s[group][i] = v;
      return { ...t, sample_values: s };
    });
  };

  const addButton = () => {
    if ((tpl.buttons || []).length >= 3) return toast.error('WhatsApp allows at most 3 buttons');
    set('buttons', [...(tpl.buttons || []), { type: 'url', text: '', url: '', phone: '', dynamic: false }]);
  };
  const setButton = (i, patch) => set('buttons', tpl.buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const removeButton = i => set('buttons', tpl.buttons.filter((_, j) => j !== i));

  const validate = () => {
    if (!tpl.name.trim()) return 'Template name is required';
    if (!/^[a-z0-9_]+$/.test(tpl.name.trim())) return 'Template name may only contain lowercase letters, numbers and underscores';
    if (!tpl.body_text.trim()) return 'Message body is required';
    // Mirrors the server check — a body using {{1}} and {{3}} but never {{2}} is rejected by Meta.
    const used = [...new Set((tpl.body_text.match(/\{\{\s*\d+\s*\}\}/g) || []).map(t => parseInt(t.replace(/\D/g, ''), 10)))].sort((a, b) => a - b);
    if (used.length && used.join(',') !== used.map((_, i) => i + 1).join(',')) {
      return `Body placeholders must run consecutively from {{1}} — found {{${used.join('}}, {{')}}}`;
    }
    for (const b of tpl.buttons || []) {
      if (!b.text.trim()) return 'Every button needs a label';
      if (b.type === 'url' && !b.url.trim()) return 'A "Visit website" button needs a URL';
      if (b.type === 'phone' && !b.phone.trim()) return 'A "Call phone number" button needs a number';
    }
    return null;
  };

  /** Writes the local copy and returns its id, without navigating — so the combined
   *  save-and-submit flow can chain straight into the Meta call. */
  const persist = async () => {
    const err = validate();
    if (err) { toast.error(err); return null; }
    setSaving(true);
    try {
      const body = new URLSearchParams({
        action: 'save',
        id: tpl.id || '',
        name: tpl.name.trim(),
        display_name: tpl.display_name || tpl.name.trim(),
        category: tpl.category, language: tpl.language,
        header_type: tpl.header_type, header_text: tpl.header_text || '', header_media_url: tpl.header_media_url || '',
        body_text: tpl.body_text, footer_text: tpl.footer_text || '',
        buttons: JSON.stringify(tpl.buttons || []),
        click_target_url: tpl.click_target_url || '',
        sample_values: JSON.stringify(tpl.sample_values || {}),
        approval_status: tpl.approval_status,
      });
      const res = await api.post(WA_TPL_API, body, FORM);
      if (res.data.success) {
        const savedId = res.data.data.id;
        lastSavedRef.current = JSON.stringify({ ...tpl, id: savedId });
        return savedId;
      }
      toast.error(res.data.message || 'Could not save');
      return null;
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error'); return null; }
    finally { setSaving(false); }
  };

  /* Local-only save. Used for templates Meta has already approved, where submitting again would
     just be a duplicate-name rejection. */
  const saveOnly = async () => {
    const id = await persist();
    if (!id) return;
    toast.success('Template saved');
    nav('/netcore/whatsapp/templates');
  };

  /*
   * One button does both, in the only order that works: our copy is written first, then that
   * saved version is what gets submitted. Two separate buttons meant you could submit yesterday's
   * wording after editing today's and get no hint that you had.
   */
  const saveAndSubmit = async () => {
    const id = await persist();
    if (!id) return;

    setMetaBusy(true);
    const t = toast.loading('Saved — submitting to Meta for approval…');
    try {
      const res = await api.post(WA_TPL_API, new URLSearchParams({ action: 'submit_to_meta', id }), FORM);
      if (res.data.success) {
        const d = res.data.data;
        toast.success(`Submitted to Meta — status "${d.approval_status}". Usually approved within minutes.`, { id: t, duration: 8000 });
        nav('/netcore/whatsapp/templates');
      } else {
        // The local copy IS saved at this point, so the message says so — otherwise a Meta
        // rejection reads as if the whole edit was lost.
        toast.error(`Saved locally, but Meta rejected it: ${res.data.message || 'unknown reason'}`, { id: t, duration: 14000 });
        set('id', id);
      }
    } catch (e) {
      toast.error(`Saved locally, but Meta rejected it: ${e?.response?.data?.message || 'network error'}`, { id: t, duration: 14000 });
      set('id', id);
    } finally { setMetaBusy(false); }
  };

  const refreshStatus = async () => {
    setMetaBusy(true);
    const t = toast.loading('Checking with Meta…');
    try {
      const res = await api.post(WA_TPL_API, new URLSearchParams({ action: 'refresh_status', id: tpl.id }), FORM);
      if (res.data.success) {
        set('approval_status', res.data.data.approval_status);
        toast.success(`Status: ${res.data.data.approval_status}`, { id: t });
      } else toast.error(res.data.message || 'Could not check', { id: t, duration: 10000 });
    } catch (e) { toast.error(e?.response?.data?.message || 'Could not check', { id: t, duration: 10000 }); }
    finally { setMetaBusy(false); }
  };

  const requestBack = () => {
    if (JSON.stringify(tpl) !== lastSavedRef.current) setConfirmBackOpen(true);
    else nav('/netcore/whatsapp/templates');
  };

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><Spinner /></div>;
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100vh', background: '#f8fafc' }}>
      <style>{WA_CSS}</style>

      <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 26px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={requestBack} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: WA.green, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <WhatsAppIcon size={18} color="#fff" />
          </span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{tpl.id ? 'Edit template' : 'Create WhatsApp template'}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{tpl.id ? `ID ${tpl.id} · ${tpl.name}` : 'Compose the message, then submit it to Meta for approval'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <ApprovalBadge status={tpl.approval_status} />
          {tpl.id && tpl.meta_template_id && (
            <button onClick={refreshStatus} disabled={metaBusy}
              title="Ask Meta for this template's current approval status"
              style={{ padding: '10px 16px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: metaBusy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
              Refresh status
            </button>
          )}
          {/*
           * One action, not two. For a template Meta has ALREADY approved it saves locally only —
           * re-submitting that is a guaranteed duplicate-name rejection, and the wording Meta
           * holds is what actually gets sent regardless. For everything else it saves and then
           * submits, in that order.
           */}
          {/* Always confirms first. Submitting to Meta is not undoable — an approved template
              can't be renamed or un-submitted — so it should never happen on a single click. */}
          <button onClick={() => { const err = validate(); if (err) return toast.error(err); setConfirmSaveOpen(true); }}
            disabled={saving || metaBusy}
            title={alreadyApproved ? 'Updates the local copy — Meta already holds the approved wording' : 'Saves your copy and sends it to Meta for approval'}
            style={{ padding: '10px 24px', border: 'none', background: WA.green, color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: (saving || metaBusy) ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : metaBusy ? 'Submitting…' : alreadyApproved ? 'SAVE TEMPLATE' : 'SAVE & SEND TO META'}
          </button>
        </div>
      </div>

      {/* Full width: the form is dense (three-column detail rows, a buttons builder) and capping
          it at 1180px left a large dead margin on the right of any normal monitor. */}
      <div style={{ display: 'flex', gap: 24, padding: '24px 26px 80px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* An already-approved template is Meta's copy, not ours. Editing the body here changes
              only the preview — WhatsApp sends the wording Meta approved — and re-submitting it
              is rejected as a duplicate name+language. Saying so up front avoids both traps. */}
          {alreadyApproved ? (
            <Notice tone="warn" style={{ marginBottom: 18 }} title="This template is already approved by Meta — edit with care">
              <b>Save</b> updates our local copy only: the preview and the sample values. It does <b>not</b>
              change what WhatsApp sends — Meta holds the approved wording, and we send the template's
              <i> name</i>, not its text. So editing the body here only makes the preview differ from reality.
              <div style={{ marginTop: 8 }}>
                To genuinely change the wording, create a <b>new</b> template with a new name (e.g.
                <code> {tpl.name}_v2</code>) and submit that one. Re-submitting this one is rejected by Meta
                as a duplicate.
              </div>
              <div style={{ marginTop: 8 }}>
                What is worth editing here: <b>sample values</b>, so the preview and the campaign's variable
                mapping show something realistic.
              </div>
            </Notice>
          ) : (
            <Notice tone="info" style={{ marginBottom: 18 }} title="Save & send to Meta does both">
              One button: it stores your copy here (preview, sample values, variable mapping) and then sends
              the template to Meta for approval.
              <div style={{ marginTop: 8 }}>
                Meta reviews within about 48 hours, usually minutes. The badge above tracks it and updates on
                its own if the Template webhook is registered — or press <b>Refresh status</b>.
              </div>
              <div style={{ marginTop: 8 }}>
                Every variable needs a <b>sample value</b> below, or Meta rejects the submission outright. If
                Meta does reject it, your copy is still saved here so you can fix it and try again.
              </div>
            </Notice>
          )}

          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Template details</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={label}>Template name <span style={{ color: '#dc2626' }}>*</span></label>
                <input style={inp} value={tpl.name} placeholder="exam_reminder_1"
                  onChange={e => set('name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} />
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>Lowercase, numbers and underscores only — exactly as approved by Meta.</div>
              </div>
              <div>
                <label style={label}>Display name</label>
                <input style={inp} value={tpl.display_name} placeholder="Exam reminder"
                  onChange={e => set('display_name', e.target.value)} />
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>Friendly label shown in this admin panel only.</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <label style={label}>Category</label>
                <SearchableSelect value={tpl.category} onChange={v => set('category', v)} options={CATEGORIES} searchPlaceholder="Search categories…" />
              </div>
              <div>
                <label style={label}>Language</label>
                <SearchableSelect value={tpl.language} onChange={v => set('language', v)} options={LANGUAGES} searchPlaceholder="Search languages…" />
              </div>
              <div>
                <label style={label}>Approval status</label>
                <SearchableSelect value={tpl.approval_status} onChange={v => set('approval_status', v)} options={APPROVALS} searchPlaceholder="Search…" />
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Header <span style={{ fontSize: 11.5, fontWeight: 500, color: '#94a3b8' }}>optional</span></div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>A short title or a piece of media above the message.</div>
            <div style={{ maxWidth: 240, marginBottom: 14 }}>
              <SearchableSelect value={tpl.header_type} onChange={v => set('header_type', v)} options={HEADER_TYPES} searchPlaceholder="Search…" />
            </div>
            {tpl.header_type === 'text' && (
              <div>
                <label style={label}>Header text</label>
                <input style={inp} value={tpl.header_text} maxLength={60} onChange={e => set('header_text', e.target.value)}
                  placeholder="Exam Reminder" />
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>Max 60 characters. May contain one {'{{1}}'} placeholder.</div>
              </div>
            )}
            {['image', 'video', 'document'].includes(tpl.header_type) && (
              <div>
                <label style={label}>Media URL</label>
                <input style={inp} value={tpl.header_media_url} onChange={e => set('header_media_url', e.target.value)}
                  placeholder="https://…/banner.jpg" />
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>Must be a publicly reachable URL — WhatsApp fetches it directly.</div>
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Message body <span style={{ color: '#dc2626' }}>*</span></div>
              <button type="button" onClick={insertVariable}
                style={{ padding: '7px 12px', border: '1.5px dashed #a5b4fc', background: '#f5f3ff', borderRadius: 7, fontSize: 11, fontWeight: 700, color: WA.primary, cursor: 'pointer', fontFamily: 'inherit' }}>
                + Add variable {`{{${bodyVars + 1}}}`}
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
              Supports *bold*, _italic_ and ~strikethrough~. Use variables for anything that changes per contact.
            </div>
            <textarea ref={bodyRef} rows={8} maxLength={1024} value={tpl.body_text}
              onChange={e => set('body_text', e.target.value)}
              placeholder={'Hi {{1}},\n\nOur records show you have not completed your exam. Please log in to your dashboard to complete it before the deadline.\n\nReply "STOP" to unsubscribe.'}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.55 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{bodyVars} variable(s)</span>
              <span style={{ fontSize: 10.5, color: (tpl.body_text || '').length > 950 ? '#c2410c' : '#cbd5e1' }}>{(tpl.body_text || '').length}/1024</span>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={label}>Footer <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional, max 60 chars)</span></label>
              <input style={inp} value={tpl.footer_text} maxLength={60} onChange={e => set('footer_text', e.target.value)}
                placeholder="Internship Studio" />
            </div>

            {/*
              The real page behind a tracked button.

              Lives on the template rather than the campaign because the button URL is part of what
              Meta approved — its destination is the same for every campaign that uses this
              template, and asking per campaign would invite a different answer each time.

              Only meaningful when the button URL routes through c.php, which is what makes the tap
              observable at all; WhatsApp reports nothing for a link button that goes straight out.
            */}
            {/*
              A tracked button is TWO things and both have to be right, so they are spelled out
              rather than described: the URL Meta approves, and the variable the campaign fills.
              Getting either wrong produces a link that works perfectly and reports nothing.
            */}
            <Notice tone="info" title="To track clicks and conversions on a link button" style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 6 }}>
                <b>1.</b> Make the button a <b>URL</b> button, tick <b>Dynamic</b>, and set its link to your
                real destination with <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>?&#123;&#123;1&#125;&#125;</code> on the end:
              </div>
              <div style={{ background: '#fff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '7px 9px', margin: '0 0 8px', fontFamily: 'monospace', fontSize: 10.5, wordBreak: 'break-all', color: '#0f172a' }}>
                https://dashboard.internshipstudio.com/login?&#123;&#123;1&#125;&#125;
              </div>
              <div style={{ marginBottom: 6 }}>
                <b>2.</b> On the campaign's Content step, set the button variable to:
              </div>
              <div style={{ background: '#fff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '7px 9px', fontFamily: 'monospace', fontSize: 10.5, color: '#0f172a' }}>
                XX_WA_ATTR_XX
              </div>
              <div style={{ marginTop: 8, lineHeight: 1.6 }}>
                Each recipient then gets their own link carrying <b>campaign_id</b>, <b>medium</b>,
                <b> phone</b>, <b>goal</b>, <b>attr_window</b> and <b>wa_rid</b> — so your platform can log
                the click and set the attribution cookie exactly as it does for a tracked email link.
                A <b>fixed</b> button URL cannot carry any of this and will always report zero.
              </div>
            </Notice>
          </div>

          {(headerVars > 0 || bodyVars > 0) && (
            <div style={card}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Sample values</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
                Used for the preview here and on the template card — and it's what Meta asks for when you
                submit the template for approval. Real values are chosen per campaign.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {Array.from({ length: headerVars }).map((_, i) => (
                  <div key={`h${i}`}>
                    <label style={label}>Header {`{{${i + 1}}}`}</label>
                    <input style={inp} value={tpl.sample_values?.header?.[i] || ''} onChange={e => setSample('header', i, e.target.value)} placeholder="e.g. iCAT 174" />
                  </div>
                ))}
                {Array.from({ length: bodyVars }).map((_, i) => (
                  <div key={`b${i}`}>
                    <label style={label}>Body {`{{${i + 1}}}`}</label>
                    <input style={inp} value={tpl.sample_values?.body?.[i] || ''} onChange={e => setSample('body', i, e.target.value)} placeholder="e.g. Rahul" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Buttons <span style={{ fontSize: 11.5, fontWeight: 500, color: '#94a3b8' }}>optional, up to 3</span></div>
              <button type="button" onClick={addButton}
                style={{ padding: '7px 14px', border: '1.5px dashed #a5b4fc', background: '#f5f3ff', borderRadius: 7, fontSize: 11, fontWeight: 700, color: WA.primary, cursor: 'pointer', fontFamily: 'inherit' }}>
                + Add button
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>Buttons are part of the approved template — they can't be changed per campaign.</div>

            {(tpl.buttons || []).length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#cbd5e1', fontSize: 12, border: '1px dashed #e2e8f0', borderRadius: 8 }}>No buttons</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tpl.buttons.map((b, i) => (
                  <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: WA.primary }}>BUTTON {i + 1}</span>
                      <button type="button" onClick={() => removeButton(i)}
                        style={{ border: 'none', background: 'none', color: '#dc2626', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={label}>Type</label>
                        <SearchableSelect value={b.type} onChange={v => setButton(i, { type: v })} options={BUTTON_TYPES} searchPlaceholder="Search…" />
                      </div>
                      <div>
                        <label style={label}>Button text</label>
                        <input style={inp} value={b.text} maxLength={25} onChange={e => setButton(i, { text: e.target.value })} placeholder="Log in" />
                      </div>
                      {b.type === 'url' && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={label}>Button URL</label>
                          <input style={inp} value={b.url} onChange={e => setButton(i, { url: e.target.value })}
                            placeholder="https://dashboard.internshipstudio.com/login" />
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
                            <input type="checkbox" checked={!!b.dynamic} onChange={e => setButton(i, { dynamic: e.target.checked })} />
                            <span style={{ fontSize: 11.5, color: '#334155' }}>
                              Dynamic URL — append a per-contact suffix (chosen in the campaign's Content step)
                            </span>
                          </label>
                        </div>
                      )}
                      {b.type === 'phone' && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={label}>Phone number</label>
                          <input style={inp} value={b.phone} onChange={e => setButton(i, { phone: e.target.value })} placeholder="+918237850238" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ width: 360, flexShrink: 0 }}>
          <div style={{ ...card, position: 'sticky', top: 88, marginBottom: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Live preview</div>
            <WaPhonePreview
              headerType={tpl.header_type}
              headerText={tpl.header_text}
              headerValues={tpl.sample_values?.header || []}
              bodyText={tpl.body_text}
              bodyValues={tpl.sample_values?.body || []}
              footerText={tpl.footer_text}
              buttons={tpl.buttons || []}
              height={470}
              emptyHint="Start writing the message body to see it here"
            />
            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 10, lineHeight: 1.5 }}>
              Rendered from the sample values above. Each campaign supplies its own real values for these variables.
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmBackOpen}
        tone="warn"
        title="Leave without saving?"
        message="This template has unsaved changes. Going back now will discard them."
        confirmLabel="Leave anyway"
        cancelLabel="Stay"
        onConfirm={() => { setConfirmBackOpen(false); nav('/netcore/whatsapp/templates'); }}
        onCancel={() => setConfirmBackOpen(false)}
      />

      <ConfirmDialog
        open={confirmSaveOpen}
        tone="warn"
        busy={saving || metaBusy}
        title={alreadyApproved ? 'Save this template?' : 'Send this template to Meta?'}
        message={alreadyApproved
          ? `This saves your local copy of "${tpl.name}" — the preview and sample values. It does not change the wording Meta approved, which is what WhatsApp actually sends.`
          : `"${tpl.name}" will be saved here and submitted to Meta for approval in ${tpl.language}. Once submitted the name and language are fixed — changing the wording later means creating a new template. Meta usually reviews within minutes.`}
        confirmLabel={alreadyApproved ? 'Save' : 'Save & send to Meta'}
        cancelLabel="Keep editing"
        onConfirm={async () => {
          setConfirmSaveOpen(false);
          if (alreadyApproved) await saveOnly();
          else await saveAndSubmit();
        }}
        onCancel={() => setConfirmSaveOpen(false)}
      />
    </div>
  );
}
