/*
 * Kumo campaign wizard — step 4, Schedule & sending.
 *
 * The Netcore final step, unchanged in shape: the boxed review card on the
 * left, "when to send" under it, and a sticky email preview on the right. The
 * actual SEND NOW / SCHEDULE CAMPAIGN button lives one level up in
 * KumoCampaignWizard.jsx's header, exactly as it does in Netcore.
 *
 * THE ONE ADDITION KUMO NEEDS: which IPs carry the send. Netcore hands the mail
 * to an ESP and the IP is the provider's problem; here the IPs are ours, they
 * have individual reputations and individual daily caps, and a campaign put on
 * a cold or throttled address is a campaign that lands in spam. So the choice
 * is offered here, in the same card language as everything else on this step —
 * a radio pair, then selectable rows when a specific set is wanted.
 */
import { useEffect, useState } from 'react';
import { kapi } from './kumoShared';

const inp = { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box' };
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 18 };

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
/* One boxed group of related facts inside the review card. */
const Group = ({ title, children }) => (
  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 12 }}>{title}</div>
    {children}
  </div>
);

const HEALTH_DOT = { green: '#10b981', yellow: '#f59e0b', red: '#ef4444', unknown: '#94a3b8' };
const HEALTH_LABEL = { green: 'Healthy', yellow: 'Watch', red: 'Critical', unknown: 'No data' };

function toLocalInputValue(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* Red health, a paused/retired row, or a warmup quota already spent today —
   any of the three means this IP cannot carry the campaign, so it is shown
   greyed out and cannot be ticked. */
const ipUsable = ip => ip.health !== 'red'
  && ip.status === 'active'
  && !(Number(ip.today_cap || 0) > 0 && Number(ip.today_remaining || 0) <= 0);

const ipBlockedWhy = (ip) => {
  if (ip.status !== 'active') return `This IP is ${ip.status}`;
  if (ip.health === 'red') return 'Health is red — sending is blocked';
  if (Number(ip.today_cap || 0) > 0 && Number(ip.today_remaining || 0) <= 0) return "Today's warmup quota is used up";
  return 'Not selectable';
};

export default function KumoCampaignStepSchedule({ draft, setField, onValidChange, segmentNames = {}, listNames = {}, onIpNamesChange }) {
  const [ips, setIps] = useState([]);
  const [loadingIps, setLoadingIps] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingIps(true);
      try {
        const d = await kapi('ips_list');
        const list = d?.ips || [];
        setIps(list);
        const map = {}; list.forEach(i => { map[i.id] = i.label || i.ip; });
        onIpNamesChange?.(map);
      } catch { /* the card says so below */ }
      finally { setLoadingIps(false); }
    })();
  }, []); // eslint-disable-line

  const selectedIpIds = (draft.ip_ids || []).map(String);
  const usableIps = ips.filter(ipUsable);
  const chosenIps = ips.filter(i => selectedIpIds.includes(String(i.id)));
  const ipOk = draft.ip_mode === 'fixed'
    ? chosenIps.some(ipUsable)
    : (loadingIps || usableIps.length > 0);

  const whenOk = draft.schedule_type === 'now' || (draft.schedule_type === 'later' && !!draft.scheduled_at);
  const valid = whenOk && ipOk;
  useEffect(() => { onValidChange(valid); }, [valid]); // eslint-disable-line

  const minDateTime = toLocalInputValue(new Date(Date.now() + 5 * 60000));

  const toggleIp = (ip) => {
    if (!ipUsable(ip)) return;
    const id = String(ip.id);
    setField('ip_ids', selectedIpIds.includes(id) ? selectedIpIds.filter(x => x !== id) : [...selectedIpIds, id]);
  };

  const audienceValue = draft.audience_type === 'all_contacts'
    ? 'All contacts'
    : draft.audience_type === 'segment'
      ? (`${(draft.segment_ids || []).length} segment(s)` )
      : (`${(draft.list_ids || []).length} list(s)`);
  const segmentNamesList = (draft.segment_ids || []).map(id => segmentNames?.[id] || `ID ${id}`).join(', ');
  const listNamesList = (draft.list_ids || []).map(id => listNames?.[id] || `ID ${id}`).join(', ');
  const excludeNamesList = (draft.exclude_enabled ? (draft.exclude_list_ids || []) : []).map(id => listNames?.[id] || `ID ${id}`).join(', ');
  const ipSummary = draft.ip_mode === 'fixed'
    ? (chosenIps.map(i => i.label || i.ip).join(', ') || 'None picked yet')
    : `Rotate across ${usableIps.length || 0} healthy IP(s)`;

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Review your campaign</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Double-check everything below — this is exactly what will go out.</div>

          <div style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>{draft.name || 'Untitled campaign'}</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 18 }}>
            <Group title="Sender & subject">
              <Fact label="From" value={draft.from_name ? `${draft.from_name} <${draft.from_email}>` : draft.from_email} />
              <Fact label="Subject" value={draft.subject} />
              <Fact label="Pre-header" value={draft.preheader} />
              <Fact label="Reply-to" value={draft.reply_to} />
            </Group>

            <Group title="Audience">
              <Fact label="Target" value={audienceValue} />
              {draft.audience_type === 'segment' && segmentNamesList && <Fact label="Segments" value={segmentNamesList} />}
              {draft.audience_type === 'list' && listNamesList && <Fact label="Lists" value={listNamesList} />}
              {excludeNamesList && <Fact label="Excluded" value={excludeNamesList} />}
              <Fact label="Reachable contacts" value={Number(draft.reachable_count || 0).toLocaleString()} />
            </Group>

            <Group title="Content">
              <Fact label="Template" value={draft.template_name} />
              <Fact label="Tracking" value="Opens + clicks (always on)" />
            </Group>

            <Group title="Delivery">
              <Fact label="Sending IPs" value={ipSummary} />
              <Fact label="Throttle" value={draft.throttle_per_hour ? `${Number(draft.throttle_per_hour).toLocaleString()} / hour` : 'No limit'} />
              <Fact label="When" value={draft.schedule_type === 'later' ? (draft.scheduled_at ? draft.scheduled_at.replace('T', ' ') : 'Send later') : 'Send now'} />
            </Group>
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>When to send</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Start straight away, or hand it to the scheduler.</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[['now', 'Send now'], ['later', 'Send later']].map(([val, lbl]) => (
              <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setField('schedule_type', val)}>
                <Radio on={draft.schedule_type === val} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{lbl}</span>
              </label>
            ))}
          </div>

          {draft.schedule_type === 'later' && (
            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Select date and time</label>
              <input type="datetime-local" style={inp} min={minDateTime} value={draft.scheduled_at || ''} onChange={e => setField('scheduled_at', e.target.value)} />
            </div>
          )}

          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
              Throttle <span style={{ fontWeight: 500, color: '#94a3b8' }}>(messages per hour, optional)</span>
            </label>
            <input type="number" min={0} step={100} style={inp} value={draft.throttle_per_hour || ''}
              onChange={e => setField('throttle_per_hour', e.target.value)} placeholder="Leave empty to send as fast as the IPs allow" />
            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 5 }}>
              A ceiling for the whole campaign, on top of each IP&apos;s own daily cap.
            </div>
          </div>
        </div>

        {/* ── the Kumo-specific bit: which of our own IPs carry this send ── */}
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Sending IPs</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Decide which addresses this campaign goes out from.</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setField('ip_mode', 'auto')}>
              <Radio on={draft.ip_mode !== 'fixed'} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>
                Rotate across healthy IPs <span style={{ fontWeight: 500, color: '#94a3b8' }}>(recommended)</span>
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setField('ip_mode', 'fixed')}>
              <Radio on={draft.ip_mode === 'fixed'} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>Use specific IPs</span>
            </label>
          </div>

          {draft.ip_mode !== 'fixed' && (
            <div style={{ fontSize: 11.5, color: '#475569', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', marginTop: 14 }}>
              {loadingIps
                ? 'Checking which IPs are available…'
                : usableIps.length > 0
                  ? `${usableIps.length} IP${usableIps.length === 1 ? '' : 's'} are healthy and active right now — the sender spreads the campaign across them and skips any that turn red or run out of quota mid-send.`
                  : 'No IP is healthy and active right now. Fix one under Infrastructure → Sending IPs before launching.'}
            </div>
          )}

          {draft.ip_mode === 'fixed' && (
            <div style={{ marginTop: 14 }}>
              {loadingIps && <div style={{ fontSize: 11, color: '#94a3b8' }}>Loading sending IPs…</div>}
              {!loadingIps && ips.length === 0 && (
                <div style={{ fontSize: 11.5, color: '#c2410c', background: '#fff7ed', borderRadius: 8, padding: '10px 12px' }}>
                  No sending IPs are configured yet — add one under Infrastructure → Sending IPs.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ips.map(ip => {
                  const id = String(ip.id);
                  const isSel = selectedIpIds.includes(id);
                  const usable = ipUsable(ip);
                  const cap = Number(ip.today_cap || 0);
                  const left = Number(ip.today_remaining || 0);
                  const used = Math.max(0, cap - left);
                  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
                  return (
                    <div key={id} onClick={() => toggleIp(ip)}
                      title={usable ? undefined : ipBlockedWhy(ip)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 10,
                        border: `1.5px solid ${isSel ? '#1e3a8a' : '#e2e8f0'}`,
                        background: isSel ? '#eef2ff' : '#fff',
                        cursor: usable ? 'pointer' : 'not-allowed', opacity: usable ? 1 : 0.5,
                      }}>
                      <input type="checkbox" checked={isSel} disabled={!usable} readOnly
                        style={{ width: 14, height: 14, flexShrink: 0, cursor: usable ? 'pointer' : 'not-allowed' }} />
                      <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: HEALTH_DOT[ip.health] || HEALTH_DOT.unknown }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>
                          {ip.label || ip.ip}
                          <span style={{ fontWeight: 500, color: '#94a3b8', marginLeft: 8, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 11 }}>{ip.ip}</span>
                        </div>
                        <div style={{ fontSize: 10.5, color: usable ? '#94a3b8' : '#b45309', marginTop: 2 }}>
                          {ip.tenant || ip.hostname || '—'} · {HEALTH_LABEL[ip.health] || 'No data'}
                          {ip.status !== 'active' ? ` · ${ip.status}` : ''}
                          {!usable && ` · ${ipBlockedWhy(ip)}`}
                        </div>
                      </div>
                      <div style={{ width: 150, flexShrink: 0 }}>
                        <div style={{ height: 6, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: HEALTH_DOT[ip.health] || HEALTH_DOT.unknown, transition: 'width .4s' }} />
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, textAlign: 'right' }}>
                          {Number(left).toLocaleString()} of {Number(cap).toLocaleString()} left today
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!loadingIps && ips.length > 0 && !chosenIps.some(ipUsable) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '10px 12px', marginTop: 12, fontSize: 12 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  <span>Pick at least one healthy, active IP — red and paused addresses can&apos;t carry a campaign.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: '0 1 620px', minWidth: 360, position: 'sticky', top: 16 }}>
        <div style={{ ...card, position: 'sticky', top: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Email preview</div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', height: 460, background: '#f8fafc' }}>
            {draft.body_html ? (
              <iframe title="preview" srcDoc={draft.body_html} style={{ width: '100%', height: '100%', border: 'none' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 12 }}>No content yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
