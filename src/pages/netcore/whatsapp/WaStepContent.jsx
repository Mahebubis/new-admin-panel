import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import SearchableSelect from './SearchableSelect';
import WaAttributeField from './WaAttributeField';
import WaPhonePreview from './WaPhonePreview';
import WaTemplateImportModal from './WaTemplateImportModal';
import { buildCustomAttributeTags } from '../campaignMergeTags';
import { WA_API, WA_TPL_API, WA_SET_API, ATTR_API, FORM, WA, inp, label, card, previewNormalizedPhone } from './waShared';
import { ApprovalBadge, CategoryChip, Notice, Radio } from './WaUi';

/** How many {{n}} placeholders a string declares — mirrors wa_placeholder_count() in PHP. */
function countVars(text) {
  const m = String(text || '').match(/\{\{\s*(\d+)\s*\}\}/g) || [];
  return m.reduce((max, tok) => Math.max(max, parseInt(tok.replace(/\D/g, ''), 10) || 0), 0);
}

export default function WaStepContent({ draft, setField, onValidChange, applyTemplate, saveDraft }) {
  const nav = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loadingTpl, setLoadingTpl] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [customAttrTags, setCustomAttrTags] = useState([]);
  const [businessName, setBusinessName] = useState('Internship Studio');
  const [defaultCc, setDefaultCc] = useState('91');

  const [testOpen, setTestOpen] = useState(false);
  const [testMode, setTestMode] = useState('add');     // 'add' | 'paste' — mirrors Netcore's own dialog
  const [testNumbers, setTestNumbers] = useState(['']);
  const [testPaste, setTestPaste] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResults, setTestResults] = useState(null);

  const loadTemplates = async () => {
    setLoadingTpl(true);
    try {
      const res = await api.post(WA_TPL_API, new URLSearchParams({ action: 'list', page: 1, per_page: 200, status: 'active' }), FORM);
      if (res.data.success) setTemplates(res.data.data.templates || []);
    } catch { toast.error('Could not load templates'); }
    finally { setLoadingTpl(false); }
  };

  /* Sync is offered right here, not only on the Templates page: an empty dropdown almost always
     means "nothing synced yet" rather than "you need to write one", and making the fix a click
     away is the difference between a dead end and a two-second detour. */
  const syncTemplates = async () => {
    setSyncing(true);
    const t = toast.loading('Reading your templates from WhatsApp…');
    try {
      const res = await api.post(WA_TPL_API, new URLSearchParams({ action: 'sync' }), FORM);
      if (res.data.success) {
        const d = res.data.data;
        toast.success(`${d.found} found · ${d.imported} imported, ${d.updated} updated`, { id: t });
        loadTemplates();
      } else toast.error(res.data.message || 'Sync failed', { id: t, duration: 12000 });
    } catch (e) { toast.error(e?.response?.data?.message || 'Sync failed', { id: t, duration: 12000 }); }
    finally { setSyncing(false); }
  };
  useEffect(() => { loadTemplates(); }, []);

  useEffect(() => {
    (async () => {
      try {
        const [attrRes, setRes] = await Promise.all([
          api.post(ATTR_API, new URLSearchParams({ action: 'list', per_page: 200 }), FORM),
          api.post(WA_SET_API, new URLSearchParams({ action: 'get' }), FORM),
        ]);
        if (attrRes.data.success) setCustomAttrTags(buildCustomAttributeTags(attrRes.data.data.attributes));
        if (setRes.data.success) {
          setDefaultCc(setRes.data.data.settings.default_country_code || '91');
          // The preview header names whichever number THIS campaign sends from, not a global
          // business name — with several numbers configured they can have different names.
          const sender = (setRes.data.data.senders || []).find(s => Number(s.id) === Number(draft.sender_id));
          setBusinessName(sender?.display_name || draft.sender_display_name || 'Internship Studio');
        }
      } catch { /* non-critical — picker falls back to the fixed identity tags */ }
    })();
  }, [draft.sender_id]); // eslint-disable-line

  const bodyVarCount = countVars(draft.body_text);
  const headerVarCount = draft.header_type === 'text' ? countVars(draft.header_text) : 0;
  const dynamicButtonIdx = (draft.buttons || []).findIndex(b => b.type === 'url' && b.dynamic);

  const vars = draft.variables || { header: [], body: [], button_url_suffix: '' };
  const setVar = (group, index, value) => {
    const next = { header: [...(vars.header || [])], body: [...(vars.body || [])], button_url_suffix: vars.button_url_suffix || '' };
    next[group][index] = value;
    setField('variables', next);
  };
  const setSuffix = (value) => setField('variables', { ...vars, button_url_suffix: value });

  const valid = draft.message_type === 'template'
    ? !!(draft.template_name && Array.from({ length: bodyVarCount }).every((_, i) => String(vars.body?.[i] || '').trim() !== '')
        && Array.from({ length: headerVarCount }).every((_, i) => String(vars.header?.[i] || '').trim() !== ''))
    : !!String(draft.text_content || '').trim();
  useEffect(() => { onValidChange(valid); }, [valid]); // eslint-disable-line

  const templateOptions = useMemo(() => templates.map(t => ({
    value: t.id,
    label: t.display_name || t.name,
    sublabel: `${t.category} · ${t.language}`,
    meta: t,
  })), [templates]);

  const selectedTemplate = templates.find(t => Number(t.id) === Number(draft.template_id));

  const sendTest = async () => {
    const raw = testMode === 'add' ? testNumbers.filter(Boolean).join(',') : testPaste;
    const list = raw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    if (!list.length) return toast.error('Enter at least one WhatsApp number');

    setTestSending(true); setTestResults(null);
    try {
      const id = await saveDraft();
      if (!id) return toast.error('Save the campaign before sending a test');
      const res = await api.post(WA_API, new URLSearchParams({ action: 'send_test', id, phones: list.join(',') }), FORM);
      if (res.data.success) {
        const results = res.data.data.results || [];
        setTestResults(results);
        const okCount = results.filter(r => r.ok).length;
        if (okCount > 0) toast.success(`Accepted for ${okCount}/${list.length} number(s)`);
        else toast.error('Every test send was rejected — see the reasons below');
      } else toast.error(res.data.message || 'Failed to send test');
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error'); }
    finally { setTestSending(false); }
  };

  return (
    <div style={{ display: 'flex', gap: 24, maxWidth: 1120, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* ── Message type ─────────────────────────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Message type</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
            WhatsApp only allows free-form messages inside a 24-hour service window. Everything else must be an approved template.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { v: 'template', title: 'Approved template', desc: 'Reaches every opted-in contact, any time' },
              { v: 'text', title: 'Free text', desc: 'Only reaches contacts who messaged you in the last 24h' },
            ].map(o => {
              const on = draft.message_type === o.v;
              return (
                <button key={o.v} type="button" onClick={() => setField('message_type', o.v)}
                  style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', padding: '13px 14px',
                    border: `1.5px solid ${on ? WA.greenDark : '#e2e8f0'}`, background: on ? '#f0fdf4' : '#fff',
                    borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  <span style={{ marginTop: 2 }}><Radio on={on} /></span>
                  <span>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{o.title}</span>
                    <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 2, lineHeight: 1.4 }}>{o.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {draft.message_type === 'template' ? (
          <>
            {/* ── Template picker ──────────────────────────────────────────────────────── */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Select template</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Pre-approved message for this WhatsApp campaign</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button type="button" onClick={loadTemplates} title="Refresh"
                    style={{ width: 34, height: 34, border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, cursor: 'pointer', color: '#475569' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ margin: 'auto' }}>
                      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                  </button>
                  <button type="button" onClick={syncTemplates} disabled={syncing}
                    title="Read the live template list from your WhatsApp Business Account"
                    style={{ padding: '9px 16px', background: WA.green, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: syncing ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                    {syncing ? 'Syncing…' : 'Sync templates'}
                  </button>
                  <button type="button" onClick={() => window.open('/netcore/whatsapp/templates/new', '_blank')}
                    style={{ padding: '9px 16px', background: '#fff', color: WA.primary, border: `1.5px solid ${WA.primary}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                    + Create
                  </button>
                </div>
              </div>

              <label style={label}>Template <span style={{ color: '#dc2626' }}>*</span></label>
              <SearchableSelect
                value={draft.template_id}
                onChange={(_, opt) => applyTemplate(opt.meta)}
                options={templateOptions}
                placeholder={loadingTpl ? 'Loading templates…' : 'Select a template'}
                searchPlaceholder="Search by name or message text…"
                emptyText={templates.length === 0 ? 'None yet — press "Sync templates" above' : 'No matches'}
                maxHeight={300}
                renderValue={o => (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{o.label}</span>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>{o.sublabel}</span>
                  </span>
                )}
                renderRow={(o, isSel) => {
                  const t = o.meta;
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: isSel ? 700 : 600, color: isSel ? '#1e3a8a' : '#0f172a', fontSize: 12.5 }}>
                          {t.display_name || t.name}
                        </span>
                        <span style={{ display: 'inline-flex', gap: 6, flexShrink: 0 }}>
                          <CategoryChip category={t.category} />
                          <ApprovalBadge status={t.approval_status} />
                        </span>
                      </div>
                      <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.name} · {t.language} · {String(t.body_text || '').replace(/\s+/g, ' ').slice(0, 70)}
                      </div>
                    </div>
                  );
                }}
                footer={
                  <button type="button" onClick={() => nav('/netcore/whatsapp/templates')}
                    style={{ width: '100%', border: 'none', background: 'none', color: '#1e3a8a', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', padding: '4px', fontFamily: 'inherit', textAlign: 'left' }}>
                    Manage all templates →
                  </button>
                }
              />

              {selectedTemplate && selectedTemplate.approval_status !== 'approved' && (
                <Notice tone="warn" style={{ marginTop: 12 }} title="This template is not marked approved">
                  WhatsApp only delivers templates Meta has approved. Netcore will still accept the send and
                  return success, but nothing will arrive. Mark it approved in the template editor once Meta
                  confirms it.
                </Notice>
              )}
            </div>

            {/* ── Variable mapping ─────────────────────────────────────────────────────── */}
            {draft.template_id && (headerVarCount > 0 || bodyVarCount > 0 || dynamicButtonIdx >= 0) && (
              <div style={card}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Configure content</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
                  Give every placeholder a value. Type a fixed value, or insert an attribute to personalize it per contact.
                </div>

                {headerVarCount > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#1e3a8a', letterSpacing: '.4px', marginBottom: 10 }}>HEADER</div>
                    {Array.from({ length: headerVarCount }).map((_, i) => (
                      <div key={i} style={{ marginBottom: 12 }}>
                        <WaAttributeField
                          label={`Header variable {{${i + 1}}}`}
                          required
                          value={vars.header?.[i] || ''}
                          onChange={v => setVar('header', i, v)}
                          placeholder="Value or attribute"
                          customTags={customAttrTags}
                          showExamTags
                        />
                      </div>
                    ))}
                  </div>
                )}

                {bodyVarCount > 0 && (
                  <div style={{ marginBottom: dynamicButtonIdx >= 0 ? 18 : 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#1e3a8a', letterSpacing: '.4px', marginBottom: 10 }}>BODY</div>
                    {Array.from({ length: bodyVarCount }).map((_, i) => (
                      <div key={i} style={{ marginBottom: 12 }}>
                        <WaAttributeField
                          label={`Body variable {{${i + 1}}}`}
                          required
                          value={vars.body?.[i] || ''}
                          onChange={v => setVar('body', i, v)}
                          placeholder="Value or attribute"
                          hint={contextFor(draft.body_text, i + 1)}
                          customTags={customAttrTags}
                          showExamTags
                        />
                      </div>
                    ))}
                  </div>
                )}

                {dynamicButtonIdx >= 0 && (
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#1e3a8a', letterSpacing: '.4px', marginBottom: 10 }}>BUTTON</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: '#475569' }}>
                      <span style={{ padding: '4px 10px', background: '#eef2ff', color: '#1e3a8a', borderRadius: 6, fontWeight: 700, fontSize: 11 }}>
                        {draft.buttons[dynamicButtonIdx].text || 'Button 1'}
                      </span>
                      <span style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {draft.buttons[dynamicButtonIdx].url}
                      </span>
                    </div>
                    {/*
                      With a conversion goal set, this value is not a choice — it is the
                      attribution string, and any other value silently breaks tracking. So it is
                      shown as settled rather than offered as a field: nothing to type, nothing to
                      get wrong, and no campaign can be sent with tracking half-configured.
                    */}
                    {String(draft.goal_event_name || '').trim() !== '' ? (
                      <div>
                        <label style={label}>Link tracking</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 8 }}>
                          <span style={{ color: '#15803d', display: 'flex', flexShrink: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Set automatically</div>
                            <div style={{ fontSize: 10.5, color: '#15803d', marginTop: 2, lineHeight: 1.5 }}>
                              Each recipient's button carries this campaign, their phone number and the goal
                              <b> {draft.goal_event_name}</b> — so a click can be recorded and credited.
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <WaAttributeField
                          label="Dynamic URL suffix"
                          value={vars.button_url_suffix || ''}
                          onChange={setSuffix}
                          placeholder="e.g. XX_USER_EMAIL_XX"
                          hint="Appended to the button's approved base URL for each contact."
                          customTags={customAttrTags}
                        />
                        {/* A URL button whose approved link contains {{1}} expects a value at send
                            time. Left empty, WhatsApp can drop the whole message — and it does so
                            silently, after the API has already answered "accepted". */}
                        {!String(vars.button_url_suffix || '').trim() && (
                          <Notice tone="warn" style={{ marginTop: 10 }}>
                            This button's approved URL contains <b>{'{{1}}'}</b>, so WhatsApp expects a value for
                            it. Set a conversion goal on the Setup step and this fills itself in — otherwise give
                            it a value here, or the message can be accepted and then silently dropped.
                          </Notice>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {draft.template_id && headerVarCount === 0 && bodyVarCount === 0 && dynamicButtonIdx < 0 && (
              <div style={card}>
                <div style={{ fontSize: 12.5, color: '#475569' }}>
                  This template has no variables — every contact receives exactly the message shown in the preview.
                </div>
              </div>
            )}
          </>
        ) : (
          /* ── Free-text message ──────────────────────────────────────────────────────── */
          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Message</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
              Supports WhatsApp formatting: *bold*, _italic_, ~strikethrough~.
            </div>
            <WaAttributeField
              label="Message text"
              required
              multiline
              rows={7}
              maxLength={4096}
              value={draft.text_content}
              onChange={v => setField('text_content', v)}
              placeholder={'Hi XX_USER_FNAME_XX,\n\nYour iCAT exam is still pending…'}
              customTags={customAttrTags}
              showExamTags
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!draft.preview_url} onChange={e => setField('preview_url', e.target.checked ? 1 : 0)} />
              <span style={{ fontSize: 12, color: '#334155' }}>Show a link preview for the first URL in the message</span>
            </label>
            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4, marginLeft: 24 }}>
              Ignored automatically when the message has no link — WhatsApp rejects a preview request with
              nothing to preview.
            </div>
            <Notice tone="warn" style={{ marginTop: 14 }} title="24-hour window applies">
              WhatsApp silently drops free-text messages to anyone who hasn't messaged your business in the
              last 24 hours. For a bulk campaign to a segment, use an approved template instead.
            </Notice>
          </div>
        )}
      </div>

      {/* ── Live preview ─────────────────────────────────────────────────────────────── */}
      <div style={{ width: 330, flexShrink: 0 }}>
        <div style={{ ...card, position: 'sticky', top: 96, marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Preview</div>
            <button type="button"
              onClick={() => (valid ? setTestOpen(true) : toast.error('Finish the message first'))}
              style={{ padding: '7px 12px', border: `1.5px solid ${valid ? WA.greenDark : '#cbd5e1'}`, color: valid ? WA.greenDark : '#94a3b8', background: '#fff', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: valid ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
              ✈ Send test
            </button>
          </div>

          <WaPhonePreview
            businessName={businessName}
            headerType={draft.message_type === 'template' ? draft.header_type : 'none'}
            headerText={draft.header_text}
            headerValues={vars.header || []}
            bodyText={draft.body_text}
            bodyValues={vars.body || []}
            footerText={draft.message_type === 'template' ? draft.footer_text : ''}
            buttons={draft.message_type === 'template' ? draft.buttons : []}
            plainText={draft.message_type === 'text' ? draft.text_content : null}
            height={470}
            emptyHint={draft.message_type === 'template' ? 'Select a template to preview it here' : 'Type your message to preview it here'}
          />

          <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 10, lineHeight: 1.5 }}>
            Attribute tokens are shown as typed here — they're replaced with each contact's real value only at send time.
          </div>
        </div>
      </div>

      {importOpen && (
        <WaTemplateImportModal onClose={() => setImportOpen(false)} onImported={loadTemplates} />
      )}

      {/* ── Test send dialog ─────────────────────────────────────────────────────────── */}
      {testOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => !testSending && setTestOpen(false)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 26, width: 500, maxHeight: '86vh', overflowY: 'auto', fontFamily: "'Plus Jakarta Sans',sans-serif" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Test WhatsApp</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
              WhatsApp messages can only be sent to opted-in numbers. This bypasses the audience entirely.
            </div>

            <div style={{ display: 'flex', gap: 22, marginBottom: 14 }}>
              {[['add', 'Add WhatsApp numbers'], ['paste', 'Paste numbers (comma-separated)']].map(([v, l]) => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setTestMode(v)}>
                  <Radio on={testMode === v} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{l}</span>
                </label>
              ))}
            </div>

            {testMode === 'add' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {testNumbers.map((num, i) => {
                  const normalized = previewNormalizedPhone(num, defaultCc);
                  return (
                    <div key={i}>
                      <label style={label}>WhatsApp number {i + 1}</label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input style={{ ...inp, flex: 1 }} value={num} placeholder="Ex: 8168586133"
                          onChange={e => setTestNumbers(ns => ns.map((n, j) => (j === i ? e.target.value : n)))} />
                        {testNumbers.length > 1 && (
                          <button type="button" onClick={() => setTestNumbers(ns => ns.filter((_, j) => j !== i))}
                            style={{ border: 'none', background: 'none', color: '#dc2626', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>×</button>
                        )}
                      </div>
                      {/* Shows the exact number the API will be handed — a 10-digit entry silently
                          becoming 91XXXXXXXXXX is worth seeing before you wonder why nothing arrived. */}
                      {num.trim() !== '' && (
                        <div style={{ fontSize: 10.5, marginTop: 4, color: normalized ? '#15803d' : '#dc2626' }}>
                          {normalized ? `Will be sent to +${normalized}` : 'Not a valid WhatsApp number'}
                        </div>
                      )}
                    </div>
                  );
                })}
                {testNumbers.length < 5 && (
                  <button type="button" onClick={() => setTestNumbers(ns => [...ns, ''])}
                    style={{ alignSelf: 'flex-start', padding: '8px 14px', border: '1.5px dashed #a5b4fc', background: '#f5f3ff', borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: '#1e3a8a', cursor: 'pointer', fontFamily: 'inherit' }}>
                    + ADD WHATSAPP NUMBER ({5 - testNumbers.length})
                  </button>
                )}
              </div>
            ) : (
              <div>
                <label style={label}>WhatsApp number list</label>
                <textarea rows={4} style={{ ...inp, resize: 'vertical' }} value={testPaste}
                  onChange={e => setTestPaste(e.target.value)} placeholder="9921079337, 919876543210" />
              </div>
            )}

            {testResults && (() => {
              const okCount = testResults.filter(r => r.ok).length;
              const allOk = okCount === testResults.length;
              return (
                <div style={{ marginTop: 14, border: `1px solid ${allOk ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: 8, overflow: 'hidden' }}>
                  {/* A green headline when everything was accepted. The caveat underneath used to
                      be amber, which made a successful send read as a failure. */}
                  {allOk && (
                    <div style={{ padding: '10px 12px', background: '#f0fdf4', borderBottom: '1px solid #dcfce7' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#15803d' }}>
                        ✓ Sent — check your phone
                      </div>
                      <div style={{ fontSize: 10.5, color: '#475569', marginTop: 3, lineHeight: 1.5 }}>
                        Delivery normally takes a few seconds. If nothing arrives, the cause is almost always
                        an unapproved template, or a free-text message outside the 24-hour window.
                      </div>
                    </div>
                  )}
                  {testResults.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 12px', fontSize: 11.5, borderBottom: i < testResults.length - 1 ? '1px solid #f1f5f9' : 'none', background: r.ok ? '#fff' : '#fef2f2' }}>
                      <span style={{ fontWeight: 600, color: '#334155' }}>+{r.phone}</span>
                      <span style={{ color: r.ok ? '#15803d' : '#dc2626', textAlign: 'right', minWidth: 0 }}>
                        {r.ok ? 'Accepted' : (r.error || 'Failed')}
                        {/* The provider's own id — what you search for in Netcore's Live feed to
                            see what happened to this exact message. */}
                        {r.ok && r.message_id && (
                          <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 2, wordBreak: 'break-all' }}>{r.message_id}</div>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={() => setTestOpen(false)}
                style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>CANCEL</button>
              <button onClick={sendTest} disabled={testSending}
                style={{ padding: '9px 22px', border: 'none', background: WA.green, color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: testSending ? 'wait' : 'pointer', opacity: testSending ? .7 : 1, fontFamily: 'inherit' }}>
                {testSending ? 'Sending…' : 'SEND'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* The words immediately around a placeholder, so "Body variable {{2}}" isn't a mystery when a
   template has four of them. */
function contextFor(bodyText, n) {
  const src = String(bodyText || '');
  const idx = src.search(new RegExp(`\\{\\{\\s*${n}\\s*\\}\\}`));
  if (idx < 0) return null;
  const before = src.slice(Math.max(0, idx - 28), idx).replace(/\s+/g, ' ');
  const after = src.slice(idx).replace(/\{\{\s*\d+\s*\}\}/, '').slice(0, 28).replace(/\s+/g, ' ');
  return `…${before}[  ]${after}…`;
}
