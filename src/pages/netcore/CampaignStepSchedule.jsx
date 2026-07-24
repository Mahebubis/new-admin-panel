import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const CAMP_API = '/api/campaigns/campaigns.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

const inp = { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box' };
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 18 };
const Toggle = ({ on, onClick }) => (
  <button type="button" onClick={onClick} style={{ width: 38, height: 21, borderRadius: 999, border: 'none', background: on ? '#16a34a' : '#cbd5e1', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
    <span style={{ position: 'absolute', top: 2, left: on ? 19 : 2, width: 17, height: 17, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
  </button>
);
const Radio = ({ on, disabled }) => (
  <span style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${on ? '#1e3a8a' : '#cbd5e1'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: disabled ? .5 : 1 }}>
    {on && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1e3a8a' }} />}
  </span>
);

function toLocalInputValue(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CampaignStepSchedule({ draft, setField, onValidChange, saveDraft }) {
  const nav = useNavigate();
  const [frequencyCap, setFrequencyCap] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState(null); // { blocking: [], count }
  const [sending, setSending] = useState(false);

  const valid = draft.schedule_type === 'now' || (draft.schedule_type === 'later' && !!draft.scheduled_at);
  useEffect(() => { onValidChange(valid); }, [valid]); // eslint-disable-line

  const minDateTime = toLocalInputValue(new Date(Date.now() + 5 * 60000));

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

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Frequency cap</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>Skip frequency capping for this campaign.</div>
          </div>
          <Toggle on={frequencyCap} onClick={() => setFrequencyCap(v => !v)} />
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>When to send</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[['now', 'Send now'], ['later', 'Send later']].map(([val, lbl]) => (
            <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setField('schedule_type', val)}>
              <Radio on={draft.schedule_type === val} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{lbl}</span>
            </label>
          ))}
          {[['slice', 'Slice & Send'], ['co', 'Optimize with Co-marketer']].map(([val, lbl]) => (
            <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: .5, cursor: 'not-allowed' }}>
              <Radio on={false} disabled /> <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{lbl}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8' }}>COMING SOON</span>
            </label>
          ))}
        </div>

        {draft.schedule_type === 'later' && (
          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Select date and time</label>
            <input type="datetime-local" style={inp} min={minDateTime} value={draft.scheduled_at || ''} onChange={e => setField('scheduled_at', e.target.value)} />
          </div>
        )}
      </div>

      <button type="button" onClick={runChecklist} disabled={checking || !valid}
        style={{ padding: '13px 26px', background: valid ? '#1e3a8a' : '#94a3b8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: valid ? 'pointer' : 'not-allowed', letterSpacing: '.3px' }}>
        {checking ? 'Checking…' : draft.schedule_type === 'later' ? 'SCHEDULE CAMPAIGN' : 'SEND NOW'}
      </button>

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
