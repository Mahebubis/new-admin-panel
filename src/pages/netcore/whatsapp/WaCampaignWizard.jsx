import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import ConfirmDialog from '../ConfirmDialog';
import { WA_API, WA_TPL_API, FORM, WA, WA_CSS, n0 } from './waShared';
import { Spinner, WhatsAppIcon } from './WaUi';
import WaSummaryPanel from './WaSummaryPanel';
import WaStepSetup from './WaStepSetup';
import WaStepAudience from './WaStepAudience';
import WaStepContent from './WaStepContent';
import WaStepSchedule from './WaStepSchedule';

const STEPS = [
  { key: 'setup', label: 'Setup' },
  { key: 'audience', label: 'Audience' },
  { key: 'content', label: 'Content' },
  { key: 'schedule', label: 'Schedule' },
];

const DEFAULT_DRAFT = {
  id: null, name: '', tags: [],
  ga_enabled: true, ga_source: 'Netcore', ga_medium: 'WhatsApp', ga_campaign: '', ga_content: '', ga_term: 'Campaign',
  // Which business number this goes out from. Preselected with the default sender by the Setup
  // step once the sender list loads.
  // sender_label is display-only (never saved) — the Setup step fills it in from the sender
  // list so the summary, review and preview can name the number without refetching it.
  sender_id: null, waba_id: '', sender_label: '', sender_display_name: '',
  // '' means 'follow the sending number's own setting' — see WaStepSetup's route picker.
  send_provider: '',
  goal_enabled: false, goal_event_name: '', goal_window_days: 2,
  dedup_enabled: false, dedup_window_hours: 24, dedup_scope: 'all_campaigns',
  audience_type: 'segments', segment_ids: [], list_ids: [], exclude_enabled: false, exclude_segment_ids: [],
  reachable_count: 0,
  audience_stats: { raw_count: 0, unreachable: 0, duplicates: 0, opted_out: 0, dedup_skipped: 0 },
  message_type: 'template',
  template_id: null, template_name: '', template_language: 'en', template_category: '',
  header_type: 'none', header_text: '', header_media_url: '', body_text: '', footer_text: '', buttons: [],
  variables: { header: [], body: [], button_url_suffix: '' },
  text_content: '', preview_url: 1,
  schedule_type: 'now', scheduled_at: '',
  contact_limit_enabled: false, contact_limit: '', retry_enabled: true,
  status: 'draft',
};

export default function WaCampaignWizard() {
  const { id: routeId } = useParams();
  const [searchParams] = useSearchParams();
  const preselectTemplateId = searchParams.get('template_id');
  const nav = useNavigate();

  const [draft, setDraft] = useState({ ...DEFAULT_DRAFT });
  const [loading, setLoading] = useState(!!routeId);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState(0);
  const [stepValid, setStepValid] = useState({ setup: false, audience: false, content: false, schedule: true });
  const [maxReached, setMaxReached] = useState(0);
  const [segmentNames, setSegmentNames] = useState({});
  const [listNames, setListNames] = useState({});
  const [confirmBackOpen, setConfirmBackOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState(null);
  const [sending, setSending] = useState(false);

  // Snapshot of the draft as the server has it — compared against the live draft to decide
  // whether the back arrow needs to warn before discarding anything.
  const lastSavedRef = useRef(JSON.stringify(DEFAULT_DRAFT));

  useEffect(() => {
    if (!routeId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await api.post(WA_API, new URLSearchParams({ action: 'get', id: routeId }), FORM);
        if (!res.data.success) { toast.error('Campaign not found'); return; }
        const c = res.data.data.campaign;
        const vars = c.variables || {};
        const loaded = {
          ...DEFAULT_DRAFT,
          id: c.id, name: c.name || '',
          tags: c.tags ? c.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          ga_enabled: !!(c.ga_source || c.ga_medium), ga_source: c.ga_source || 'Netcore', ga_medium: c.ga_medium || 'WhatsApp',
          ga_campaign: c.ga_campaign || '', ga_content: c.ga_content || '', ga_term: c.ga_term || 'Campaign',
          sender_id: c.sender_id ? Number(c.sender_id) : null, waba_id: c.waba_id || '',
          send_provider: c.send_provider || '',
          goal_enabled: !!(c.goal_event_name), goal_event_name: c.goal_event_name || '',
          goal_window_days: Number(c.goal_window_days) || 2,
          dedup_enabled: Number(c.dedup_enabled) === 1,
          dedup_window_hours: Number(c.dedup_window_hours) || 24,
          dedup_scope: c.dedup_scope || 'all_campaigns',
          audience_type: c.audience_type || 'segments',
          segment_ids: c.segment_ids || [], list_ids: c.list_ids || [],
          exclude_segment_ids: c.exclude_segment_ids || [],
          exclude_enabled: (c.exclude_segment_ids || []).length > 0,
          reachable_count: Number(c.reachable_count) || 0,
          message_type: c.message_type || 'template',
          template_id: c.template_id ? Number(c.template_id) : null,
          template_name: c.template_name || '', template_language: c.template_language || 'en',
          template_category: c.template_category || '',
          header_type: c.header_type || 'none', header_text: c.header_text || '',
          header_media_url: c.header_media_url || '', body_text: c.body_text || '',
          footer_text: c.footer_text || '', buttons: c.buttons || [],
          variables: { header: vars.header || [], body: vars.body || [], button_url_suffix: vars.button_url_suffix || '' },
          text_content: c.text_content || '', preview_url: Number(c.preview_url) === 1 ? 1 : 0,
          schedule_type: c.schedule_type || 'now',
          scheduled_at: c.scheduled_at ? String(c.scheduled_at).replace(' ', 'T').slice(0, 16) : '',
          contact_limit_enabled: Number(c.contact_limit_enabled) === 1,
          contact_limit: c.contact_limit || '', retry_enabled: Number(c.retry_enabled) === 1,
          status: c.status || 'draft',
        };
        setDraft(loaded);
        lastSavedRef.current = JSON.stringify(loaded);

        // Unlock only as far as the SAVED data actually validates — a half-filled draft must
        // not let you jump to Schedule just because the campaign already has an id. (Whether
        // the saved sender is still usable is re-checked live by the Setup step itself.)
        const setupOk = !!loaded.name.trim() && !!loaded.sender_id;
        const audienceOk = loaded.audience_type === 'all_contacts' || loaded.segment_ids.length > 0 || loaded.list_ids.length > 0;
        const contentOk = loaded.message_type === 'template'
          ? !!loaded.template_name
          : !!loaded.text_content.trim();

        let mr = 0;
        if (setupOk) mr = 1;
        if (mr === 1 && audienceOk) mr = 2;
        if (mr === 2 && contentOk) mr = 3;
        setMaxReached(mr);
        setStepValid(sv => ({ ...sv, setup: setupOk, audience: audienceOk, content: contentOk }));
      } catch { toast.error('Could not load campaign'); }
      finally { setLoading(false); }
    })();
  }, [routeId]);

  // Arriving from the templates gallery's "Use" button — preselect that template.
  useEffect(() => {
    if (routeId || !preselectTemplateId) return;
    (async () => {
      try {
        const res = await api.post(WA_TPL_API, new URLSearchParams({ action: 'get', id: preselectTemplateId }), FORM);
        if (res.data.success) applyTemplate(res.data.data.template);
      } catch { /* ignore — a template can still be picked in the Content step */ }
    })();
  }, [routeId, preselectTemplateId]);

  const setField = (key, value) => setDraft(d => ({ ...d, [key]: value }));
  const setValid = (stepKey, v) => setStepValid(sv => (sv[stepKey] === v ? sv : { ...sv, [stepKey]: v }));

  /** Copies a template onto the draft and resizes the variable arrays to match it. */
  const applyTemplate = (t) => {
    const bodyVars = countVars(t.body_text);
    const headerVars = t.header_type === 'text' ? countVars(t.header_text) : 0;
    setDraft(d => ({
      ...d,
      message_type: 'template',
      template_id: t.id, template_name: t.name, template_language: t.language, template_category: t.category,
      header_type: t.header_type, header_text: t.header_text || '', header_media_url: t.header_media_url || '',
      body_text: t.body_text || '', footer_text: t.footer_text || '', buttons: t.buttons || [],
      variables: {
        // Existing values are preserved positionally when switching between templates with the
        // same variable count — retyping "iCAT 174" for every template revision is needless.
        header: resize(d.variables?.header, headerVars),
        body: resize(d.variables?.body, bodyVars),
        button_url_suffix: d.variables?.button_url_suffix || '',
      },
    }));
  };

  const buildSavePayload = (d) => ({
    action: 'save',
    id: d.id || undefined,
    name: d.name, tags: (d.tags || []).join(','),
    ga_source: d.ga_enabled ? d.ga_source : '', ga_medium: d.ga_enabled ? d.ga_medium : '',
    ga_campaign: d.ga_enabled ? (d.ga_campaign || d.name) : '', ga_content: d.ga_enabled ? d.ga_content : '',
    ga_term: d.ga_enabled ? d.ga_term : '',
    sender_id: d.sender_id || 0, send_provider: d.send_provider || '',
    // Clearing the toggle must clear the stored goal, or the report keeps counting a goal the
    // wizard no longer shows.
    goal_event_name: d.goal_enabled ? (d.goal_event_name || '') : '',
    goal_window_days: Number(d.goal_window_days) || 2,
    dedup_enabled: d.dedup_enabled ? 1 : 0, dedup_window_hours: d.dedup_window_hours || 24, dedup_scope: d.dedup_scope,
    audience_type: d.audience_type,
    segment_ids: JSON.stringify(d.segment_ids || []),
    list_ids: JSON.stringify(d.list_ids || []),
    exclude_segment_ids: JSON.stringify(d.exclude_enabled ? (d.exclude_segment_ids || []) : []),
    // Already computed live by the Audience step's debounced count — sent as a plain value so
    // every "Next step" click doesn't redo that heavy resolve.
    reachable_count: d.reachable_count || 0,
    message_type: d.message_type,
    template_id: d.message_type === 'template' ? (d.template_id || '') : 0,
    variables: JSON.stringify(d.variables || {}),
    text_content: d.text_content || '',
    preview_url: d.preview_url ? 1 : 0,
    schedule_type: d.schedule_type,
    contact_limit_enabled: d.contact_limit_enabled ? 1 : 0,
    contact_limit: d.contact_limit_enabled ? (parseInt(d.contact_limit, 10) || 0) : 0,
    retry_enabled: d.retry_enabled ? 1 : 0,
  });

  const saveDraft = async () => {
    setSaving(true);
    try {
      const payload = buildSavePayload(draft);
      const body = new URLSearchParams(Object.entries(payload).filter(([, v]) => v !== undefined));
      const res = await api.post(WA_API, body, FORM);
      if (res.data.success) {
        const updated = { ...draft, id: res.data.data.id, status: res.data.data.status ?? draft.status };
        setDraft(updated);
        lastSavedRef.current = JSON.stringify(updated);
        return res.data.data.id;
      }
      toast.error(res.data.message || 'Could not save');
      return null;
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error'); return null; }
    finally { setSaving(false); }
  };

  const goNext = async () => {
    if (!stepValid[STEPS[current].key]) return toast.error('Complete this step first');
    const id = await saveDraft();
    if (!id) return;
    const next = Math.min(current + 1, STEPS.length - 1);
    setCurrent(next);
    setMaxReached(m => Math.max(m, next));
  };
  const finishLater = async () => { await saveDraft(); nav('/netcore/whatsapp'); };
  const requestBack = () => {
    if (JSON.stringify(draft) !== lastSavedRef.current) setConfirmBackOpen(true);
    else nav('/netcore/whatsapp');
  };
  const goToStep = (idx) => {
    if (idx <= maxReached) { setCurrent(idx); return; }
    toast.error(`Complete the "${STEPS[current].label}" step first`);
  };

  /* The checklist is computed SERVER-side (action=preflight), not in the browser: the two
     things that actually stop a WhatsApp message arriving — a missing per-number API key and an
     unapproved template — are server state the wizard can't see. */
  const runChecklist = async () => {
    if (draft.schedule_type === 'later' && !draft.scheduled_at) return toast.error('Pick a date & time first');
    setChecking(true);
    try {
      const id = await saveDraft();
      if (!id) return;
      const res = await api.post(WA_API, new URLSearchParams({ action: 'preflight', id }), FORM);
      if (res.data.success) setChecks(res.data.data);
      else toast.error(res.data.message || 'Could not run the pre-send checks');
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error'); }
    finally { setChecking(false); }
  };

  const confirmSend = async () => {
    setSending(true);
    try {
      const action = draft.schedule_type === 'later' ? 'schedule' : 'send_now';
      const body = { action, id: draft.id };
      if (action === 'schedule') body.scheduled_at = draft.scheduled_at.replace('T', ' ') + ':00';
      const res = await api.post(WA_API, new URLSearchParams(body), FORM);
      if (res.data.success) {
        toast.success(action === 'schedule' ? 'Campaign scheduled' : 'Campaign is sending now');
        setChecks(null);
        nav('/netcore/whatsapp');
      } else toast.error(res.data.message || 'Failed');
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error'); }
    finally { setSending(false); }
  };

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><Spinner /></div>;
  }

  const StepBody = [
    <WaStepSetup key="setup" draft={draft} setField={setField} onValidChange={v => setValid('setup', v)} />,
    <WaStepAudience key="audience" draft={draft} setField={setField} onValidChange={v => setValid('audience', v)}
      onSegmentNamesChange={setSegmentNames} onListNamesChange={setListNames} />,
    <WaStepContent key="content" draft={draft} setField={setField} onValidChange={v => setValid('content', v)}
      applyTemplate={applyTemplate} saveDraft={saveDraft} />,
    <WaStepSchedule key="schedule" draft={draft} setField={setField} onValidChange={v => setValid('schedule', v)}
      segmentNames={segmentNames} listNames={listNames} />,
  ][current];

  const isLast = current === STEPS.length - 1;

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      <style>{WA_CSS}</style>

      {/* Header + step indicator scroll away as one sticky unit, deliberately relying on
          native page scroll rather than a nested overflow container (which is not reliably
          scrollable inside this app's surrounding layout — see CampaignWizard.jsx). */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 26px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={requestBack} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: WA.green, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <WhatsAppIcon size={18} color="#fff" />
            </span>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>WhatsApp campaign</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={finishLater} disabled={saving}
              style={{ padding: '10px 20px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#334155', fontFamily: 'inherit' }}>
              FINISH LATER
            </button>
            {!isLast ? (
              <button onClick={goNext} disabled={saving}
                style={{ padding: '10px 22px', border: 'none', background: WA.primary, color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving…' : 'NEXT STEP'}
              </button>
            ) : (
              <button onClick={runChecklist} disabled={checking || !stepValid.schedule}
                style={{ padding: '10px 22px', border: 'none', background: stepValid.schedule ? WA.green : '#94a3b8', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: stepValid.schedule ? (checking ? 'wait' : 'pointer') : 'not-allowed', fontFamily: 'inherit' }}>
                {checking ? 'Checking…' : draft.schedule_type === 'later' ? 'SCHEDULE CAMPAIGN' : 'SEND NOW'}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 26px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
          {STEPS.map((s, i) => {
            const done = stepValid[s.key] && i < current;
            const clickable = i <= maxReached;
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
                {/* Not a native `disabled` button — a locked step must still fire onClick so
                    goToStep() can explain why, instead of doing nothing silently. */}
                <button onClick={() => goToStep(i)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', cursor: 'pointer', padding: '4px 6px', fontFamily: 'inherit' }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11.5, fontWeight: 700,
                    background: i === current ? WA.primary : done ? WA.green : '#e2e8f0',
                    color: (i === current || done) ? '#fff' : '#94a3b8',
                  }}>{done ? '✓' : i + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: i === current ? 700 : 600, color: i === current ? '#0f172a' : clickable ? '#475569' : '#cbd5e1' }}>{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <span style={{ width: 40, height: 2, background: i < current ? WA.green : '#e2e8f0', margin: '0 8px' }} />}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <div style={{ flex: 1, padding: '26px 26px 140px', minWidth: 0 }}>{StepBody}</div>
        {/* Hidden on Content and Schedule — both carry their own live preview/review panel. */}
        {current < 2 && <WaSummaryPanel draft={draft} segmentNames={segmentNames} listNames={listNames} />}
      </div>

      <ConfirmDialog
        open={confirmBackOpen}
        tone="warn"
        title="Leave without saving?"
        message={'This campaign has changes that haven\'t been saved. Going back now will discard them — use "Finish later" instead if you want to keep them as a draft.'}
        confirmLabel="Leave anyway"
        cancelLabel="Stay"
        onConfirm={() => { setConfirmBackOpen(false); nav('/netcore/whatsapp'); }}
        onCancel={() => setConfirmBackOpen(false)}
      />

      {checks && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => !sending && setChecks(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 520, maxHeight: '86vh', overflowY: 'auto', fontFamily: "'Plus Jakarta Sans',sans-serif" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 800, color: checks.blocking.length ? '#dc2626' : '#0f172a', marginBottom: 4, textAlign: 'center' }}>
              {checks.blocking.length
                ? 'A few things need attention'
                : `Ready to ${draft.schedule_type === 'later' ? 'schedule' : 'send'}`}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 18 }}>
              {n0(checks.audience?.count)} contact(s) will receive this message
              {checks.sender && <> from <b style={{ color: '#334155' }}>{checks.sender.business_number}</b></>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 16 }}>
              {['No sending number selected',
                'No API key for the selected sending number',
                'The selected sending number is switched off',
                'No template selected', 'Template variables are not all filled in',
                'Message text is empty', 'Audience has 0 reachable WhatsApp numbers']
                .filter(msg => checks.blocking.includes(msg) || defaultCheckShown(msg, draft))
                .map(msg => {
                  const failed = checks.blocking.includes(msg);
                  return (
                    <div key={msg} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: failed ? '#fee2e2' : '#dcfce7', color: failed ? '#dc2626' : '#16a34a', fontSize: 12 }}>
                        {failed ? '✕' : '✓'}
                      </span>
                      <span style={{ fontSize: 12.5, color: failed ? '#dc2626' : '#334155' }}>{checkLabel(msg, checks)}</span>
                    </div>
                  );
                })}
            </div>

            {(checks.warnings || []).length > 0 && (
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '11px 14px', marginBottom: 18 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#c2410c', marginBottom: 5 }}>WORTH KNOWING</div>
                {checks.warnings.map((w, i) => (
                  <div key={i} style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.6 }}>• {w}</div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setChecks(null)}
                style={{ padding: '10px 24px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>CANCEL</button>
              <button onClick={confirmSend} disabled={checks.blocking.length > 0 || sending}
                style={{ padding: '10px 28px', border: 'none', background: checks.blocking.length ? '#94a3b8' : WA.green, color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: checks.blocking.length ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {sending ? 'Working…' : draft.schedule_type === 'later' ? 'SCHEDULE' : 'SEND NOW'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Which checklist rows are worth showing when they PASS — a free-text campaign shouldn't
   display a green tick next to "No template selected", and vice versa. */
function defaultCheckShown(msg, draft) {
  if (msg === 'No template selected' || msg === 'Template variables are not all filled in') {
    return draft.message_type === 'template';
  }
  if (msg === 'Message text is empty') return draft.message_type === 'text';
  return true;
}

function checkLabel(msg, checks) {
  if (msg === 'Audience has 0 reachable WhatsApp numbers') {
    return `Reachable WhatsApp numbers (${n0(checks.audience?.count)})`;
  }
  return msg
    .replace(' is not configured', ' configured')
    .replace(' is not set', ' set')
    .replace('No sending number selected', 'Sending number selected')
    .replace('No API key for the selected sending number', 'API key set for that number')
    .replace('The selected sending number is switched off', 'That number is available for sending')
    .replace('No template selected', 'Template selected')
    .replace('Template variables are not all filled in', 'All template variables filled in')
    .replace('Message text is empty', 'Message text written');
}

function countVars(text) {
  const m = String(text || '').match(/\{\{\s*(\d+)\s*\}\}/g) || [];
  return m.reduce((max, tok) => Math.max(max, parseInt(tok.replace(/\D/g, ''), 10) || 0), 0);
}
function resize(arr, len) {
  const out = Array.from({ length: len }, (_, i) => (arr && arr[i]) || '');
  return out;
}
