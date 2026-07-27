import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import CampaignSummaryPanel from './CampaignSummaryPanel';
import CampaignStepSetup from './CampaignStepSetup';
import CampaignStepAudience from './CampaignStepAudience';
import CampaignStepContent from './CampaignStepContent';
import CampaignStepSchedule from './CampaignStepSchedule';
import ConfirmDialog from './ConfirmDialog';

const CAMP_API = '/api/campaigns/campaigns.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

const STEPS = [
  { key: 'setup', label: 'Setup' },
  { key: 'audience', label: 'Audience' },
  { key: 'content', label: 'Content' },
  { key: 'schedule', label: 'Schedule' },
];

const DEFAULT_DRAFT = {
  id: null, name: '', tags: [],
  ga_enabled: true, ga_source: 'Netcore', ga_medium: 'Email', ga_campaign: '', ga_content: '', ga_term: 'Campaign',
  goal_enabled: false, goal_event_name: '', goal_window_days: 2, goal_revenue_param: '',
  audience_type: 'segments', segment_ids: [], list_ids: [], exclude_enabled: false, exclude_segment_ids: [], domain_enabled: false, domain_filter: '',
  reachable_count: 0,
  sender_name: '', sender_email: '', sending_domain: '', subject: '', preheader: '', reply_to: '',
  template_id: null, template_name: '', content_html: '', attachments: [],
  esp_transport: 'sendgrid',
  exam_cit_version: '',
  schedule_type: 'now', scheduled_at: '',
  status: 'draft',
};

function Spinner() {
  return <span style={{ display: 'inline-block', width: 32, height: 32, borderRadius: '50%', border: '3px solid #c4b5fd', borderTopColor: '#4f46e5', animation: 'nc_spin 0.85s linear infinite' }} />;
}

export default function CampaignWizard() {
  const { id: routeId } = useParams();
  const [searchParams] = useSearchParams();
  const preselectTemplateId = searchParams.get('template_id');
  const nav = useNavigate();
  const [draft, setDraft] = useState({ ...DEFAULT_DRAFT });
  const [loading, setLoading] = useState(!!routeId);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState(0);
  const [stepValid, setStepValid] = useState({ setup: false, audience: false, content: false, schedule: false });
  const [maxReached, setMaxReached] = useState(0);
  const [segmentNames, setSegmentNames] = useState({});
  const [listNames, setListNames] = useState({});
  const [confirmBackOpen, setConfirmBackOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState(null); // { blocking: [], count }
  const [sending, setSending] = useState(false);
  // Snapshot of the draft as it exists on the server — compared against the live `draft`
  // to decide whether the top-left back arrow needs to warn before discarding anything.
  // Updated right after load and after every successful saveDraft().
  const lastSavedRef = useRef(JSON.stringify(DEFAULT_DRAFT));

  useEffect(() => {
    if (!routeId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await api.post(CAMP_API, new URLSearchParams({ action: 'get', id: routeId }), FORM);
        if (res.data.success) {
          const c = res.data.data.campaign;
          const loaded = {
            ...DEFAULT_DRAFT, id: c.id, name: c.name || '', tags: c.tags ? c.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            ga_enabled: !!(c.ga_source || c.ga_medium), ga_source: c.ga_source || 'Netcore', ga_medium: c.ga_medium || 'Email',
            ga_campaign: c.ga_campaign || '', ga_content: c.ga_content || '', ga_term: c.ga_term || 'Campaign',
            goal_enabled: !!c.goal_event_name, goal_event_name: c.goal_event_name || '', goal_window_days: c.goal_window_days || 2, goal_revenue_param: c.goal_revenue_param || '',
            audience_type: c.audience_type || 'segments', segment_ids: c.segment_ids || [], list_ids: c.list_ids || [], exclude_segment_ids: c.exclude_segment_ids || [],
            exclude_enabled: (c.exclude_segment_ids || []).length > 0, domain_filter: c.domain_filter || '', domain_enabled: !!c.domain_filter,
            reachable_count: c.reachable_count || 0,
            sender_name: c.sender_name || '', sender_email: c.sender_email || '', sending_domain: c.sending_domain || '',
            subject: c.subject || '', preheader: c.preheader || '', reply_to: c.reply_to || '',
            template_id: c.template_id || null, content_html: c.content_html || '', attachments: c.attachments || [], esp_transport: c.esp_transport || 'sendgrid',
            exam_cit_version: c.exam_cit_version || '',
            schedule_type: c.schedule_type || 'now', scheduled_at: c.scheduled_at ? c.scheduled_at.replace(' ', 'T').slice(0, 16) : '',
            status: c.status || 'draft',
          };
          setDraft(loaded);
          lastSavedRef.current = JSON.stringify(loaded);

          // Unlock only as far as the SAVED data actually validates — a draft that was only
          // ever half-filled-in (e.g. Setup done, Content never touched) must not let you
          // jump straight to Schedule just because the campaign already has an id.
          const setupOk = !!(c.name && c.name.trim());
          const excludeIds = c.exclude_segment_ids || [];
          const hasOverlap = excludeIds.length > 0 && (c.segment_ids || []).some(id => excludeIds.map(String).includes(String(id)));
          const audienceOk = (c.audience_type === 'all_contacts' || (c.segment_ids || []).length > 0 || (c.list_ids || []).length > 0) && !hasOverlap;
          const contentOk = !!(c.subject && c.subject.trim() && c.sender_email && c.sender_email.trim() && c.sending_domain && c.template_id);

          let mr = 0;
          if (setupOk) mr = 1;
          if (mr === 1 && audienceOk) mr = 2;
          if (mr === 2 && contentOk) mr = 3;
          setMaxReached(mr);
          setStepValid(sv => ({ ...sv, setup: setupOk, audience: audienceOk, content: contentOk }));
        } else toast.error('Campaign not found');
      } catch { toast.error('Could not load campaign'); }
      finally { setLoading(false); }
    })();
  }, [routeId]);

  useEffect(() => {
    if (routeId || !preselectTemplateId) return;
    (async () => {
      try {
        const res = await api.post('/api/campaigns/templates.php', new URLSearchParams({ action: 'get', id: preselectTemplateId }), FORM);
        if (res.data.success) {
          const t = res.data.data.template;
          setDraft(d => ({ ...d, template_id: t.id, template_name: t.name, content_html: t.body_html, subject: d.subject || t.subject_default || '' }));
        }
      } catch { /* ignore — user can still pick a template manually in the Content step */ }
    })();
  }, [routeId, preselectTemplateId]);

  const setField = (key, value) => setDraft(d => ({ ...d, [key]: value }));
  const setValid = (stepKey, v) => setStepValid(sv => (sv[stepKey] === v ? sv : { ...sv, [stepKey]: v }));

  const buildSavePayload = (d) => ({
    action: 'save',
    id: d.id || undefined, name: d.name, tags: (d.tags || []).join(','),
    ga_source: d.ga_enabled ? d.ga_source : '', ga_medium: d.ga_enabled ? d.ga_medium : '',
    ga_campaign: d.ga_enabled ? (d.ga_campaign || d.name) : '', ga_content: d.ga_enabled ? d.ga_content : '', ga_term: d.ga_enabled ? d.ga_term : '',
    goal_event_name: d.goal_enabled ? d.goal_event_name : '', goal_window_days: d.goal_enabled ? d.goal_window_days : '', goal_revenue_param: d.goal_enabled ? d.goal_revenue_param : '',
    audience_type: d.audience_type, segment_ids: JSON.stringify(d.segment_ids || []),
    list_ids: JSON.stringify(d.list_ids || []),
    exclude_segment_ids: JSON.stringify(d.exclude_enabled ? (d.exclude_segment_ids || []) : []),
    domain_filter: d.domain_enabled ? d.domain_filter : '',
    // Already computed live by the Audience step's own debounced audience_count call — sent
    // as a plain value so "save" doesn't redo that same heavy query on every step's Next click.
    reachable_count: d.reachable_count || 0,
    sender_name: d.sender_name, sender_email: d.sender_email, sending_domain: d.sending_domain,
    subject: d.subject, preheader: d.preheader, reply_to: d.reply_to,
    template_id: d.template_id || '', esp_transport: d.esp_transport,
    exam_cit_version: d.exam_cit_version || '',
  });

  const saveDraft = async () => {
    setSaving(true);
    try {
      const payload = buildSavePayload(draft);
      const body = new URLSearchParams(Object.entries(payload).filter(([, v]) => v !== undefined));
      const res = await api.post(CAMP_API, body, FORM);
      if (res.data.success) {
        const newId = res.data.data.id;
        const updated = { ...draft, id: newId, reachable_count: res.data.data.reachable_count ?? draft.reachable_count, status: res.data.data.status ?? draft.status };
        setDraft(updated);
        lastSavedRef.current = JSON.stringify(updated);
        return newId;
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
  const finishLater = async () => { await saveDraft(); nav('/netcore/campaigns'); };
  const requestBack = () => {
    if (JSON.stringify(draft) !== lastSavedRef.current) setConfirmBackOpen(true);
    else nav('/netcore/campaigns');
  };
  const goToStep = (idx) => {
    if (idx <= maxReached) { setCurrent(idx); return; }
    toast.error(`Complete the "${STEPS[current].label}" step first`);
  };

  const runChecklist = async () => {
    if (draft.schedule_type === 'later' && !draft.scheduled_at) return toast.error('Pick a date & time first');
    setChecking(true);
    try {
      const id = await saveDraft();
      if (!id) return toast.error('Could not save the campaign');
      const blocking = [];
      if (!draft.subject?.trim()) blocking.push('Subject is empty');
      if (!draft.template_id) blocking.push('No template selected');
      if (!draft.sender_email?.trim()) blocking.push('Sender email is not set');
      if (!draft.sending_domain) blocking.push('Sending domain is not set');
      if (!draft.reachable_count || draft.reachable_count <= 0) blocking.push('Audience has 0 reachable contacts');
      setChecks({ blocking, count: draft.reachable_count || 0 });
      setChecklistOpen(true);
    } finally { setChecking(false); }
  };

  const confirmSend = async () => {
    setSending(true);
    try {
      const action = draft.schedule_type === 'later' ? 'schedule' : 'send_now';
      const body = { action, id: draft.id };
      if (action === 'schedule') body.scheduled_at = draft.scheduled_at.replace('T', ' ') + ':00';
      const res = await api.post(CAMP_API, new URLSearchParams(body), FORM);
      if (res.data.success) {
        toast.success(action === 'schedule' ? 'Campaign scheduled' : 'Campaign is sending now');
        setChecklistOpen(false);
        nav('/netcore/campaigns');
      } else toast.error(res.data.message || 'Failed');
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error'); }
    finally { setSending(false); }
  };

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><Spinner /></div>;
  }

  const StepBody = [
    <CampaignStepSetup key="setup" draft={draft} setField={setField} onValidChange={v => setValid('setup', v)} />,
    <CampaignStepAudience key="audience" draft={draft} setField={setField} onValidChange={v => setValid('audience', v)} onSegmentNamesChange={setSegmentNames} onListNamesChange={setListNames} />,
    <CampaignStepContent key="content" draft={draft} setField={setField} onValidChange={v => setValid('content', v)} saveDraft={saveDraft} />,
    <CampaignStepSchedule key="schedule" draft={draft} setField={setField} onValidChange={v => setValid('schedule', v)} segmentNames={segmentNames} listNames={listNames} />,
  ][current];

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      <style>{`@keyframes nc_spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header + step indicator wrapped together so they scroll away as ONE sticky
          unit — deliberately relying on native page scroll (position:sticky against the
          whole document) instead of a nested flex/overflow:auto region, since that inner
          scroll container turned out not to be reliably scrollable inside this app's
          surrounding layout. Sticky-against-the-page is guaranteed to work regardless of
          any ancestor's height/overflow quirks. */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 26px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={requestBack} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Email campaign</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={finishLater} disabled={saving}
            style={{ padding: '10px 20px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#334155' }}>
            FINISH LATER
          </button>
          {current < STEPS.length - 1 ? (
            <button onClick={goNext} disabled={saving}
              style={{ padding: '10px 22px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Saving…' : 'NEXT STEP'}
            </button>
          ) : (
            <button onClick={runChecklist} disabled={checking || !stepValid.schedule}
              style={{ padding: '10px 22px', border: 'none', background: stepValid.schedule ? '#1e3a8a' : '#94a3b8', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: stepValid.schedule ? (checking ? 'wait' : 'pointer') : 'not-allowed' }}>
              {checking ? 'Checking…' : draft.schedule_type === 'later' ? 'SCHEDULE CAMPAIGN' : 'SEND NOW'}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '16px 26px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        {STEPS.map((s, i) => {
          const done = stepValid[s.key] && i < current;
          const clickable = i <= maxReached;
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
              {/* Not a native `disabled` button — locked steps must still fire onClick so
                  goToStep() can show the "complete this step first" toast instead of doing
                  nothing silently. */}
              <button onClick={() => goToStep(i)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', cursor: 'pointer', padding: '4px 6px', fontFamily: 'inherit' }}>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 700,
                  background: i === current ? '#1e3a8a' : done ? '#16a34a' : '#e2e8f0',
                  color: (i === current || done) ? '#fff' : '#94a3b8',
                }}>
                  {done ? '✓' : i + 1}
                </span>
                <span style={{ fontSize: 13, fontWeight: i === current ? 700 : 600, color: i === current ? '#0f172a' : clickable ? '#475569' : '#cbd5e1' }}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <span style={{ width: 40, height: 2, background: i < current ? '#16a34a' : '#e2e8f0', margin: '0 8px' }} />}
            </div>
          );
        })}
      </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <div style={{ flex: 1, padding: '26px 26px 140px' }}>{StepBody}</div>
        {/* Hidden on Content (its own live preview) and Schedule (full review screen replaces this recap) */}
        {current !== 2 && current !== 3 && <CampaignSummaryPanel draft={draft} segmentNames={segmentNames} listNames={listNames} />}
      </div>

      <ConfirmDialog
        open={confirmBackOpen}
        tone="warn"
        title="Leave without saving?"
        message={'This campaign has changes that haven\'t been saved. Going back now will discard them — use "Finish later" instead if you want to keep them as a draft.'}
        confirmLabel="Leave anyway"
        cancelLabel="Stay"
        onConfirm={() => { setConfirmBackOpen(false); nav('/netcore/campaigns'); }}
        onCancel={() => setConfirmBackOpen(false)}
      />

      {checklistOpen && checks && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => !sending && setChecklistOpen(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 30, width: 440, fontFamily: "'Plus Jakarta Sans',sans-serif", textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 700, color: checks.blocking.length ? '#dc2626' : '#0f172a', marginBottom: 18 }}>
              {checks.blocking.length ? 'A few things need attention' : `All good! You can ${draft.schedule_type === 'later' ? 'schedule' : 'send'} this campaign.`}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left', marginBottom: 22 }}>
              {['Subject is empty', 'No template selected', 'Sender email is not set', 'Sending domain is not set', 'Audience has 0 reachable contacts'].map(msg => {
                const failed = checks.blocking.includes(msg);
                return (
                  <div key={msg} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: failed ? '#fee2e2' : '#dcfce7', color: failed ? '#dc2626' : '#16a34a', fontSize: 12 }}>{failed ? '✕' : '✓'}</span>
                    <span style={{ fontSize: 12.5, color: '#334155' }}>{msg.replace(' is empty', '').replace(' is not set', '').replace('Audience has 0 reachable contacts', `Reachable contacts (${checks.count.toLocaleString()})`)}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setChecklistOpen(false)} style={{ padding: '10px 24px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>CANCEL</button>
              <button onClick={confirmSend} disabled={checks.blocking.length > 0 || sending}
                style={{ padding: '10px 24px', border: 'none', background: checks.blocking.length ? '#94a3b8' : '#1e3a8a', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: checks.blocking.length ? 'not-allowed' : 'pointer' }}>
                {sending ? 'Working…' : draft.schedule_type === 'later' ? 'SCHEDULE' : 'SEND'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
