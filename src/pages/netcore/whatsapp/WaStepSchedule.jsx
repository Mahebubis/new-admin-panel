import { useEffect, useRef } from 'react';
import WaPhonePreview from './WaPhonePreview';
import { WA, inp, label, card, n0 } from './waShared';
import { Toggle, Radio, Notice } from './WaUi';

/* One labeled fact inside a review group — a dash when empty, never a raw blank. */
const Fact = ({ label: l, value }) => (
  <div style={{ marginBottom: 11 }}>
    <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>{l}</div>
    <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600, lineHeight: 1.4, wordBreak: 'break-word' }}>
      {value || <span style={{ color: '#cbd5e1', fontWeight: 500 }}>—</span>}
    </div>
  </div>
);

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
 * Final review + "when to send". The send action itself lives in the wizard header (FINISH
 * LATER / SEND NOW sit together at the top right on this last step), so it isn't repeated here.
 */
export default function WaStepSchedule({ draft, setField, onValidChange, segmentNames = {}, listNames = {} }) {
  const limitInvalid = draft.contact_limit_enabled && !(parseInt(draft.contact_limit, 10) > 0);
  const valid = (draft.schedule_type === 'now' || (draft.schedule_type === 'later' && !!draft.scheduled_at)) && !limitInvalid;
  useEffect(() => { onValidChange(valid); }, [valid]); // eslint-disable-line

  /* The datetime input's floor is set from an effect rather than computed during render:
     reading the clock while rendering is impure (the value would differ between two renders of
     the same state), and this also keeps the floor fresh if the step stays open for a while. */
  const dateInputRef = useRef(null);
  useEffect(() => {
    if (dateInputRef.current) dateInputRef.current.min = toLocalInputValue(new Date(Date.now() + 5 * 60000));
  });

  const stats = draft.audience_stats || {};
  const vars = draft.variables || {};

  const audienceValue = draft.audience_type === 'all_contacts'
    ? 'All contacts'
    : [
        (draft.segment_ids || []).length ? `${draft.segment_ids.length} segment(s)` : null,
        (draft.list_ids || []).length ? `${draft.list_ids.length} list(s)` : null,
      ].filter(Boolean).join(', ') || 'None selected';
  const segNames = (draft.segment_ids || []).map(id => segmentNames?.[id] || `ID ${id}`).join(', ');
  const lstNames = (draft.list_ids || []).map(id => listNames?.[id] || `ID ${id}`).join(', ');
  const excNames = (draft.exclude_segment_ids || []).map(id => segmentNames?.[id] || `ID ${id}`).join(', ');

  const willReceive = Number(draft.reachable_count) || 0;
  const capped = draft.contact_limit_enabled && parseInt(draft.contact_limit, 10) > 0
    ? Math.min(willReceive, parseInt(draft.contact_limit, 10))
    : willReceive;

  return (
    <div style={{ display: 'flex', gap: 24, maxWidth: 1120, alignItems: 'flex-start' }}>
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
            <Group title="Message">
              <Fact label="Sending from"
                value={draft.sender_label ? `${draft.sender_display_name || ''} ${draft.sender_label}`.trim() : 'Not selected'} />
              <Fact label="Type" value={draft.message_type === 'template' ? 'Approved template' : 'Free text (24h window)'} />
              {draft.message_type === 'template' && <Fact label="Template" value={draft.template_name} />}
              {draft.message_type === 'template' && <Fact label="Language / category" value={`${draft.template_language} · ${draft.template_category || '—'}`} />}
              <Fact label="Variables"
                value={(vars.body || []).length || (vars.header || []).length
                  ? [...(vars.header || []), ...(vars.body || [])].filter(Boolean).join(' · ')
                  : 'None'} />
            </Group>

            <Group title="Audience">
              <Fact label="Target" value={audienceValue} />
              {segNames && <Fact label="Segments" value={segNames} />}
              {lstNames && <Fact label="Lists" value={lstNames} />}
              {excNames && <Fact label="Excluded" value={excNames} />}
              <Fact label="Reachable numbers" value={n0(willReceive)} />
            </Group>

            <Group title="Deduplication">
              <Fact label="Within this campaign" value="Always on — one message per contact" />
              <Fact label="Across past campaigns"
                value={draft.dedup_enabled
                  ? `On — skip anyone messaged in the last ${draft.dedup_window_hours}h (${draft.dedup_scope === 'same_template' ? 'same template only' : 'any campaign'})`
                  : 'Off'} />
              {draft.dedup_enabled && <Fact label="Would skip now" value={`${n0(stats.dedup_skipped ?? 0)} contact(s)`} />}
              {Number(stats.duplicates) > 0 && <Fact label="Duplicate numbers merged" value={n0(stats.duplicates)} />}
            </Group>

            <Group title="Delivery">
              <Fact label="When" value={draft.schedule_type === 'now' ? 'Send now' : (draft.scheduled_at ? draft.scheduled_at.replace('T', ' ') : 'Not picked yet')} />
              <Fact label="Contact limit" value={draft.contact_limit_enabled ? `${n0(draft.contact_limit)} contact(s)` : 'Off'} />
              <Fact label="Retry failed messages" value={draft.retry_enabled ? 'On — up to 3 attempts' : 'Off'} />
              <Fact label="Will be messaged" value={n0(capped)} />
            </Group>
          </div>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Schedule campaign</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
              Timezone: <b style={{ color: '#334155' }}>Asia/Calcutta</b>
            </div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>When to send</div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[['now', 'Send now'], ['later', 'Send later']].map(([val, lbl]) => (
              <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setField('schedule_type', val)}>
                <Radio on={draft.schedule_type === val} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{lbl}</span>
              </label>
            ))}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: .5, cursor: 'not-allowed' }}
              title="Send-time optimization isn't wired up yet">
              <Radio on={false} disabled />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>Optimize send time</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8' }}>COMING SOON</span>
            </label>
          </div>

          {draft.schedule_type === 'later' && (
            <div style={{ marginTop: 16, maxWidth: 320 }}>
              <label style={label}>Select date and time</label>
              <input ref={dateInputRef} type="datetime-local" style={inp}
                value={draft.scheduled_at || ''} onChange={e => setField('scheduled_at', e.target.value)} />
              {/* Stated explicitly because it's a real behavioural choice, not an oversight. */}
              <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 6, lineHeight: 1.5 }}>
                The audience is resolved when the campaign actually fires, not now — anyone who qualifies
                by then receives it.
              </div>
            </div>
          )}
        </div>

        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Contact limit</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>Cap how many contacts can receive this message.</div>
            </div>
            <Toggle on={draft.contact_limit_enabled} onClick={() => setField('contact_limit_enabled', !draft.contact_limit_enabled)} />
          </div>
          {draft.contact_limit_enabled && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eff6ff', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                <span style={{ fontSize: 11.5, color: '#475569', fontWeight: 600 }}>Reachable contacts</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#1e3a8a' }}>{n0(willReceive)}</span>
              </div>
              <label style={label}>Set contact limit <span style={{ color: '#dc2626' }}>*</span></label>
              <input type="number" min={1} max={willReceive || undefined} style={{ ...inp, maxWidth: 240, borderColor: limitInvalid ? '#fca5a5' : '#e2e8f0' }}
                value={draft.contact_limit} onChange={e => setField('contact_limit', e.target.value)} placeholder="Enter value" />
              {limitInvalid && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>Please set a contact limit value</div>}
              {!limitInvalid && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>
                  The first {n0(capped)} contacts in the resolved audience will be messaged.
                </div>
              )}
            </div>
          )}
        </div>

        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Retry failed messages</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                Retry a number up to 3 times when the provider is busy or briefly unreachable.
              </div>
            </div>
            <Toggle on={draft.retry_enabled} onClick={() => setField('retry_enabled', !draft.retry_enabled)} />
          </div>
          <Notice tone="info" style={{ marginTop: 14 }}>
            Retries never repeat a message that WhatsApp actually rejected (bad number, unapproved template)
            — only ones that never got through. They cost nothing extra and cannot cause a duplicate send.
          </Notice>
        </div>
      </div>

      <div style={{ width: 330, flexShrink: 0 }}>
        <div style={{ ...card, position: 'sticky', top: 96, marginBottom: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Message preview</div>
          <WaPhonePreview
            businessName={draft.sender_display_name || 'Internship Studio'}
            headerType={draft.message_type === 'template' ? draft.header_type : 'none'}
            headerText={draft.header_text}
            headerValues={vars.header || []}
            bodyText={draft.body_text}
            bodyValues={vars.body || []}
            footerText={draft.message_type === 'template' ? draft.footer_text : ''}
            buttons={draft.message_type === 'template' ? draft.buttons : []}
            plainText={draft.message_type === 'text' ? draft.text_content : null}
            height={460}
            emptyHint="No message content yet"
          />
          <div style={{ marginTop: 12, padding: '10px 12px', background: '#f0fdf4', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 10.5, color: '#15803d', fontWeight: 700, letterSpacing: '.3px' }}>WILL BE SENT TO</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: WA.greenDark, marginTop: 2 }}>{n0(capped)}</div>
            <div style={{ fontSize: 10.5, color: '#64748b' }}>WhatsApp number(s)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
