import { useEffect, useState } from 'react';

// Display names for email_campaigns.esp_transport. 'mailwizz' is retired but still a legal
// stored value on campaigns created before it was removed, so it keeps a label here.
const ESP_LABELS = { sendgrid: 'SendGrid', elasticemail: 'Elastic Email', ses: 'Amazon SES', mailwizz: 'MailWizz (retired)' };

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

/* One labeled fact inside a review group — dash when empty, never a raw blank. */
const Fact = ({ label, value }) => (
  <div style={{ marginBottom: 11 }}>
    <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600, lineHeight: 1.4, wordBreak: 'break-word' }}>{value || <span style={{ color: '#cbd5e1', fontWeight: 500 }}>—</span>}</div>
  </div>
);
/* One boxed group of related facts inside the review card — "Sender & subject", "Audience", etc. */
const Group = ({ title, children }) => (
  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 12 }}>{title}</div>
    {children}
  </div>
);

function toLocalInputValue(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Final review + "when to send" step. The actual Send Now / Schedule action itself
 * lives one level up in CampaignWizard.jsx now — its header shows FINISH LATER and
 * SEND NOW/SCHEDULE CAMPAIGN side by side at the top right on this last step, so the
 * send button doesn't need to be repeated in the body here too.
 */
export default function CampaignStepSchedule({ draft, setField, onValidChange, segmentNames = {}, listNames = {} }) {
  const [frequencyCap, setFrequencyCap] = useState(false);

  const valid = draft.schedule_type === 'now' || (draft.schedule_type === 'later' && !!draft.scheduled_at);
  useEffect(() => { onValidChange(valid); }, [valid]); // eslint-disable-line

  const minDateTime = toLocalInputValue(new Date(Date.now() + 5 * 60000));

  const audienceValue = draft.audience_type === 'all_contacts'
    ? 'All contacts'
    : [
        (draft.segment_ids || []).length ? `${draft.segment_ids.length} segment(s)` : null,
        (draft.list_ids || []).length ? `${draft.list_ids.length} list(s)` : null,
      ].filter(Boolean).join(', ') || 'None selected';
  const segmentNamesList = (draft.segment_ids || []).map(id => segmentNames?.[id] || `ID ${id}`).join(', ');
  const listNamesList = (draft.list_ids || []).map(id => listNames?.[id] || `ID ${id}`).join(', ');
  const excludeNamesList = (draft.exclude_segment_ids || []).map(id => segmentNames?.[id] || `ID ${id}`).join(', ');
  const totalAttachedBytes = (draft.attachments || []).reduce((sum, a) => sum + (a.size || 0), 0);

  return (
    <div style={{ display: 'flex', gap: 24, maxWidth: 1120 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Review your campaign</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Double-check everything below — this is exactly what will go out.</div>

          <div style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>{draft.name || 'Untitled campaign'}</div>
          {draft.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
              {draft.tags.map(t => (
                <span key={t} style={{ fontSize: 10.5, fontWeight: 700, color: '#1e3a8a', background: '#eef2ff', padding: '3px 10px', borderRadius: 999 }}>{t}</span>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: draft.tags?.length ? 0 : 18 }}>
            <Group title="Sender & subject">
              <Fact label="From" value={draft.sender_name ? `${draft.sender_name} <${draft.sender_email}>` : draft.sender_email} />
              <Fact label="Subject" value={draft.subject} />
              <Fact label="Pre-header" value={draft.preheader} />
              <Fact label="Reply-to" value={draft.reply_to} />
            </Group>

            <Group title="Audience">
              <Fact label="Target" value={audienceValue} />
              {segmentNamesList && <Fact label="Segments" value={segmentNamesList} />}
              {listNamesList && <Fact label="Lists" value={listNamesList} />}
              {excludeNamesList && <Fact label="Excluded" value={excludeNamesList} />}
              <Fact label="Reachable contacts" value={Number(draft.reachable_count || 0).toLocaleString()} />
              {draft.domain_enabled && draft.domain_filter && <Fact label="Domain filter" value={draft.domain_filter} />}
            </Group>

            <Group title="Tracking & goals">
              <Fact label="Google Analytics" value={draft.ga_enabled ? [draft.ga_source, draft.ga_medium, draft.ga_campaign].filter(Boolean).join(' / ') || 'On' : 'Off'} />
              <Fact label="Conversion goal" value={draft.goal_enabled ? `${draft.goal_event_name || 'Event not set'} (within ${draft.goal_window_days || 2}d)` : 'Off'} />
              <Fact label="Exam tie-in" value={draft.exam_cit_version || 'None'} />
              <Fact label="Sending via" value={ESP_LABELS[draft.esp_transport] || 'SendGrid'} />
            </Group>

            <Group title="Attachments">
              {(draft.attachments || []).length === 0 ? (
                <Fact label="Files" value="None" />
              ) : (
                <>
                  <Fact label="Files" value={draft.attachments.map(a => a.filename).join(', ')} />
                  <Fact label="Total size" value={`${Math.round(totalAttachedBytes / 1024)} KB`} />
                </>
              )}
            </Group>
          </div>
        </div>

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
      </div>

      <div style={{ width: 360, flexShrink: 0 }}>
        <div style={{ ...card, position: 'sticky', top: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Email preview</div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', height: 460, background: '#f8fafc' }}>
            {draft.content_html ? (
              <iframe title="preview" srcDoc={draft.content_html} style={{ width: '100%', height: '100%', border: 'none' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 12 }}>No template selected</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
