/*
 * Kumo — Email campaign composer (create + edit).
 *
 * The same four-step wizard as the Netcore campaign builder, and deliberately
 * so: the sticky header with the back arrow on the left and FINISH LATER /
 * NEXT STEP on the right, the numbered step rail under it, the Summary rail on
 * the right of the first two steps, and the pre-flight checklist modal that
 * stands between the last NEXT and anything actually leaving the building.
 *
 * Only the data layer is Kumo's: every read and write goes through
 * kapi() → /api/kumo/kumo.php instead of the campaigns.php form endpoints.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { kapi } from './kumoShared';
import KumoCampaignSummary from './KumoCampaignSummary';
import KumoCampaignStepSetup from './KumoCampaignStepSetup';
import KumoCampaignStepAudience from './KumoCampaignStepAudience';
import KumoCampaignStepContent from './KumoCampaignStepContent';
import KumoCampaignStepSchedule from './KumoCampaignStepSchedule';

const STEPS = [
  { key: 'setup', label: 'Setup' },
  { key: 'audience', label: 'Audience' },
  { key: 'content', label: 'Content' },
  { key: 'schedule', label: 'Schedule' },
];

const DEFAULT_DRAFT = {
  id: null, name: '',
  subject: '', preheader: '', from_name: '', from_email: '', reply_to: '',
  template_id: null, template_name: '', body_html: '', body_text: '',
  audience_type: 'list', list_ids: [], segment_ids: [],
  exclude_enabled: false, exclude_list_ids: [],
  reachable_count: 0,
  ip_mode: 'auto', ip_ids: [],
  schedule_type: 'now', scheduled_at: '', throttle_per_hour: '',
  // Always on — not a wizard choice. kumo.php forces these to 1 as well, so an
  // older campaign loaded for editing comes back with tracking on regardless.
  track_opens: true, track_clicks: true,
  /* Owned by the server: uploads write straight to kumo_campaigns.attachments,
     so this is only ever read back, never posted with the draft. */
  attachments: [],
  status: 'draft',
};

const CHECK_MESSAGES = [
  'Subject is empty',
  'Email body is empty',
  'Sender email is not set',
  'Audience has 0 reachable contacts',
  'No healthy sending IP is available',
];

const asArray = (v) => {
  if (Array.isArray(v)) return v.map(String);
  if (v === null || v === undefined || v === '') return [];
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p.map(String) : []; }
    catch { return v.split(',').map(s => s.trim()).filter(Boolean); }
  }
  return [];
};
const toSql = (v) => { if (!v) return ''; const s = String(v).replace('T', ' '); return s.length === 16 ? `${s}:00` : s.slice(0, 19); };
const toInput = (v) => (v ? String(v).replace(' ', 'T').slice(0, 16) : '');

function Spinner() {
  return <span style={{ display: 'inline-block', width: 32, height: 32, borderRadius: '50%', border: '3px solid #c4b5fd', borderTopColor: '#4f46e5', animation: 'km_spin 0.85s linear infinite' }} />;
}

/** "Are you sure?" modal — the Netcore ConfirmDialog, copied in rather than imported. */
function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'danger', busy = false, onConfirm, onCancel }) {
  if (!open) return null;
  const colors = tone === 'warn'
    ? { bg: '#fef3c7', stroke: '#d97706', btn: '#d97706' }
    : { bg: '#fee2e2', stroke: '#dc2626', btn: '#dc2626' };
  return (
    <div onClick={() => !busy && onCancel()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'km_confirm_fade_in .15s ease' }}>
      <style>{`
        @keyframes km_confirm_fade_in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes km_confirm_pop_in { from { opacity: 0; transform: scale(.94) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, padding: '26px 26px 22px', width: 380, maxWidth: '90vw', boxShadow: '0 24px 60px rgba(15,23,42,.28)', animation: 'km_confirm_pop_in .18s cubic-bezier(.16,1,.3,1)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
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

export default function KumoCampaignWizard() {
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
  const [ipLabels, setIpLabels] = useState({});
  const [confirmBackOpen, setConfirmBackOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState(null); // { blocking: [], count }
  const [sending, setSending] = useState(false);
  /* Snapshot of the draft as it exists on the server — compared against the live `draft`
     to decide whether the top-left back arrow needs to warn before discarding anything.
     Updated right after load and after every successful saveDraft(). */
  const lastSavedRef = useRef(JSON.stringify(DEFAULT_DRAFT));

  useEffect(() => {
    if (!routeId) return;
    (async () => {
      setLoading(true);
      try {
        const d = await kapi('campaign_get', { id: routeId });
        const c = d?.campaign;
        if (!c) { toast.error('Campaign not found'); return; }
        const loaded = {
          ...DEFAULT_DRAFT,
          id: c.id, name: c.name || '',
          subject: c.subject || '', preheader: c.preheader || '',
          from_name: c.from_name || '', from_email: c.from_email || '', reply_to: c.reply_to || '',
          template_id: c.template_id || null, template_name: c.template_name || '',
          body_html: c.body_html || '', body_text: c.body_text || '',
          audience_type: c.audience_type || 'list',
          list_ids: asArray(c.list_ids), segment_ids: asArray(c.segment_ids),
          exclude_list_ids: asArray(c.exclude_list_ids),
          exclude_enabled: asArray(c.exclude_list_ids).length > 0,
          reachable_count: Number(c.total_recipients || 0),
          ip_mode: c.ip_mode || 'auto', ip_ids: asArray(c.ip_ids),
          schedule_type: c.schedule_type || 'now', scheduled_at: toInput(c.scheduled_at),
          throttle_per_hour: c.throttle_per_hour ? String(c.throttle_per_hour) : '',
          track_opens: true,
          track_clicks: true,
          attachments: Array.isArray(c.attachments) ? c.attachments : [],
          status: c.status || 'draft',
        };
        setDraft(loaded);
        lastSavedRef.current = JSON.stringify(loaded);

        /* Unlock only as far as the SAVED data actually validates — a draft that was only
           ever half filled in must not let you jump straight to Schedule just because the
           campaign already has an id. */
        const setupOk = !!(loaded.name && loaded.name.trim());
        const audienceOk = loaded.audience_type === 'segment'
          ? loaded.segment_ids.length > 0
          : loaded.audience_type === 'list' && loaded.list_ids.length > 0;
        const contentOk = !!(loaded.subject.trim() && loaded.from_email.trim() && loaded.body_html.trim());

        let mr = 0;
        if (setupOk) mr = 1;
        if (mr === 1 && audienceOk) mr = 2;
        if (mr === 2 && contentOk) mr = 3;
        setMaxReached(mr);
        setStepValid(sv => ({ ...sv, setup: setupOk, audience: audienceOk, content: contentOk }));
      } catch (e) { toast.error(e.message || 'Could not load campaign'); }
      finally { setLoading(false); }
    })();
  }, [routeId]);

  useEffect(() => {
    if (routeId || !preselectTemplateId) return;
    (async () => {
      try {
        const d = await kapi('template_get', { id: preselectTemplateId });
        const t = d?.template;
        if (!t) return;
        setDraft(dr => ({
          ...dr, template_id: t.id, template_name: t.name,
          body_html: t.body_html || dr.body_html, body_text: t.body_text || dr.body_text,
          subject: dr.subject || t.subject || '',
        }));
      } catch { /* ignore — a template can still be picked by hand in the Content step */ }
    })();
  }, [routeId, preselectTemplateId]);

  const setField = (key, value) => setDraft(d => (d[key] === value ? d : { ...d, [key]: value }));
  const setValid = (stepKey, v) => setStepValid(sv => (sv[stepKey] === v ? sv : { ...sv, [stepKey]: v }));

  const buildSavePayload = (d) => ({
    ...(d.id ? { id: d.id } : {}),
    name: d.name.trim() || 'Untitled campaign',
    subject: d.subject, preheader: d.preheader,
    from_name: d.from_name, from_email: d.from_email, reply_to: d.reply_to,
    template_id: d.template_id || '',
    body_html: d.body_html, body_text: d.body_text,
    audience_type: d.audience_type,
    list_ids: (d.list_ids || []).map(String),
    segment_ids: (d.segment_ids || []).map(String),
    exclude_list_ids: d.exclude_enabled ? (d.exclude_list_ids || []).map(String) : [],
    ip_mode: d.ip_mode,
    // Only a 'fixed' campaign owns a list of IPs — sending them while on 'auto' would
    // quietly pin a campaign the user asked to have rotated.
    ip_ids: d.ip_mode === 'fixed' ? (d.ip_ids || []).map(String) : [],
    schedule_type: d.schedule_type,
    scheduled_at: d.schedule_type === 'later' ? toSql(d.scheduled_at) : '',
    throttle_per_hour: Number(d.throttle_per_hour || 0),
    track_opens: 1,
    track_clicks: 1,
  });

  const saveDraft = async () => {
    if (!draft.name.trim()) { toast.error('Give the campaign a name first'); return null; }
    setSaving(true);
    try {
      const res = await kapi('campaign_save', buildSavePayload(draft));
      const newId = Number(res?.id || draft.id || 0) || draft.id;
      const updated = { ...draft, id: newId };
      setDraft(updated);
      lastSavedRef.current = JSON.stringify(updated);
      return newId;
    } catch (e) { toast.error(e.message || 'Could not save'); return null; }
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
  const finishLater = async () => { await saveDraft(); nav('/kumo/campaigns'); };
  const requestBack = () => {
    if (JSON.stringify(draft) !== lastSavedRef.current) setConfirmBackOpen(true);
    else nav('/kumo/campaigns');
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
      if (!(draft.body_html || '').trim()) blocking.push('Email body is empty');
      if (!draft.from_email?.trim()) blocking.push('Sender email is not set');
      if (!draft.reachable_count || draft.reachable_count <= 0) blocking.push('Audience has 0 reachable contacts');
      // The Schedule step will not validate without a usable IP, so reaching here with an
      // invalid schedule step means the IP question is the one still open.
      if (!stepValid.schedule) blocking.push('No healthy sending IP is available');
      setChecks({ blocking, count: draft.reachable_count || 0 });
      setChecklistOpen(true);
    } finally { setChecking(false); }
  };

  const confirmSend = async () => {
    setSending(true);
    try {
      if (draft.schedule_type === 'later') {
        await kapi('campaign_schedule', { id: draft.id, scheduled_at: toSql(draft.scheduled_at) });
        toast.success('Campaign scheduled');
      } else {
        const d = await kapi('campaign_send_now', { id: draft.id });
        toast.success(`Campaign is sending now${d?.recipients ? ` to ${Number(d.recipients).toLocaleString()} recipients` : ''}`);
      }
      setChecklistOpen(false);
      nav(`/kumo/campaigns/${draft.id}`);
    } catch (e) { toast.error(e.message || 'Failed'); }
    finally { setSending(false); }
  };

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><style>{'@keyframes km_spin { to { transform: rotate(360deg); } }'}</style><Spinner /></div>;
  }

  const StepBody = [
    <KumoCampaignStepSetup key="setup" draft={draft} setField={setField} onValidChange={v => setValid('setup', v)} />,
    <KumoCampaignStepAudience key="audience" draft={draft} setField={setField} onValidChange={v => setValid('audience', v)} onSegmentNamesChange={setSegmentNames} onListNamesChange={setListNames} />,
    <KumoCampaignStepContent key="content" draft={draft} setField={setField} onValidChange={v => setValid('content', v)} saveDraft={saveDraft} />,
    <KumoCampaignStepSchedule key="schedule" draft={draft} setField={setField} onValidChange={v => setValid('schedule', v)} segmentNames={segmentNames} listNames={listNames} onIpNamesChange={setIpLabels} />,
  ][current];

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      <style>{'@keyframes km_spin { to { transform: rotate(360deg); } }'}</style>

      {/* Header + step indicator wrapped together so they scroll away as ONE sticky unit —
          deliberately relying on native page scroll rather than a nested overflow:auto
          region, which is not reliably scrollable inside this app's surrounding layout. */}
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
        {current !== 2 && current !== 3 && (
          <KumoCampaignSummary draft={draft} segmentNames={segmentNames} listNames={listNames} ipLabels={ipLabels} />
        )}
      </div>

      <ConfirmDialog
        open={confirmBackOpen}
        tone="warn"
        title="Leave without saving?"
        message={'This campaign has changes that haven\'t been saved. Going back now will discard them — use "Finish later" instead if you want to keep them as a draft.'}
        confirmLabel="Leave anyway"
        cancelLabel="Stay"
        onConfirm={() => { setConfirmBackOpen(false); nav('/kumo/campaigns'); }}
        onCancel={() => setConfirmBackOpen(false)}
      />

      {checklistOpen && checks && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => !sending && setChecklistOpen(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 30, width: 460, fontFamily: "'Plus Jakarta Sans',sans-serif", textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 700, color: checks.blocking.length ? '#dc2626' : '#0f172a', marginBottom: 18 }}>
              {checks.blocking.length ? 'A few things need attention' : `All good! You can ${draft.schedule_type === 'later' ? 'schedule' : 'send'} this campaign.`}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left', marginBottom: 22 }}>
              {CHECK_MESSAGES.map(msg => {
                const failed = checks.blocking.includes(msg);
                return (
                  <div key={msg} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: failed ? '#fee2e2' : '#dcfce7', color: failed ? '#dc2626' : '#16a34a', fontSize: 12 }}>{failed ? '✕' : '✓'}</span>
                    <span style={{ fontSize: 12.5, color: '#334155' }}>
                      {msg
                        .replace(' is empty', '')
                        .replace(' is not set', '')
                        .replace('Audience has 0 reachable contacts', `Reachable contacts (${checks.count.toLocaleString()})`)
                        .replace('No healthy sending IP is available', draft.ip_mode === 'fixed' ? 'Chosen sending IPs' : 'Healthy sending IPs')}
                    </span>
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
