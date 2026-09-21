import { nf } from '../netcore/analytics/maShared';
import { Modal, Ic, fmtAgo } from './ciqShared';
import { phoneIssues, agoMs, osText, SIM_METHOD_TEXT } from './ciqHealth';

/*
 * One phone's setup, exactly as the phone reported it: every switch Android and the phone maker
 * require, which of them are on, and the phone's own evidence that it actually works — when calls
 * last uploaded, and when CallIQ last ran by itself in the background.
 *
 * Nothing here is inferred from the dashboard side. A phone that cannot read a switch says so,
 * and it is shown as "not confirmed", never as off and never as on.
 */

const gapText = ms => {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 90) return `${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} days`;
};

const MARK = { done: '✓', confirmed: '✓', todo: '✕', unknown: '?' };
const STATUS_WORD = { done: 'On', confirmed: 'Confirmed', todo: 'Off', unknown: 'Not confirmed' };

export default function PhoneSetupModal({ agent: a, onClose }) {
  const h = a.health;
  const issues = phoneIssues(a);
  const steps = h?.steps || [];
  const req = steps.filter(s => s.required);
  const opt = steps.filter(s => !s.required);
  const sent = Number(h?.sent_at) || 0;
  const bg = Number(h?.bg_run_at) || 0;

  return (
    <Modal onClose={onClose} width={560}
           title={a.label}
           sub={[a.device_model, osText(a), a.app_version && `app v${a.app_version}`].filter(Boolean).join(' · ') || 'Phone setup'}>
      {issues.length > 0 ? (
        <div>
          {issues.map(i => (
            <div key={i.key} className="ciq-issue" data-l={i.level}>
              {Ic.alert}
              <div><b>{i.title}</b>{i.detail}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="ciq-issue" data-l="info" style={{ background: '#ecfdf5', color: '#065f46' }}>
          {Ic.tick}
          <div><b>Everything this phone needs is on</b>Calls from it upload by themselves and the post-call popup can appear.</div>
        </div>
      )}

      {h && (
        <>
          <div className="ciq-sec">Required on this phone</div>
          <div className="ciq-checks">
            {req.map(s => <Check key={s.key} s={s} />)}
          </div>
          {opt.length > 0 && (
            <>
              <div className="ciq-sec">Recommended</div>
              <div className="ciq-checks">{opt.map(s => <Check key={s.key} s={s} />)}</div>
            </>
          )}

          <div className="ciq-sec">What the phone reported</div>
          <div className="ciq-facts">
            <div>
              <span>Calls last uploaded</span>
              <b>{agoMs(h.sync_ok_at)}</b>
            </div>
            <div>
              <span>Waiting on the phone</span>
              <b data-bad={Number(h.pending_uploads) > 0 ? '1' : undefined}>
                {h.pending_uploads == null ? '—' : `${nf(h.pending_uploads)} call${Number(h.pending_uploads) === 1 ? '' : 's'}`}
              </b>
            </div>
            <div title="The background catch-up runs every 15 minutes. If it has not run for hours, the phone is stopping CallIQ.">
              <span>Ran in background</span>
              <b data-bad={sent && (!bg || sent - bg > 6 * 3600 * 1000) ? '1' : undefined}>
                {!bg ? 'never' : sent ? `${gapText(sent - bg)} before this report` : agoMs(bg)}
              </b>
            </div>
            <div>
              <span>Report received</span>
              <b>{fmtAgo(a.last_checkin_at)}</b>
            </div>
            <div title="How this phone works out which SIM each call used">
              <span>SIMs · detection</span>
              <b data-bad={h.sim_method === 'unknown' && Number(h.sims) >= 2 ? '1' : undefined}>
                {h.sims ?? '—'}{h.sim_method ? ` · ${SIM_METHOD_TEXT[h.sim_method] || h.sim_method}` : ''}
              </b>
            </div>
            <div>
              <span>Post-call popup</span>
              <b data-bad={a.popup_state === 'off' ? '1' : undefined}>
                {a.popup_state === 'on' ? 'Ready' : a.popup_state === 'off' ? 'Cannot appear' : 'Unknown'}
              </b>
            </div>
          </div>
        </>
      )}

      <p style={{ fontSize: 12, color: '#64748b', margin: '16px 0 0', lineHeight: 1.5 }}>
        {h
          ? <>To fix anything above: open <b>CallIQ</b> on this phone and tap <b>Allow all permissions</b>. It walks through only what is still off, in order, and this card updates the moment the phone reports back.</>
          : <>Install app <b>v{a.latest_version || '1.4'}</b> on this phone, open it once, and tap <b>Allow all permissions</b>. From then on this card shows exactly which switches are on.</>}
      </p>
    </Modal>
  );
}

function Check({ s }) {
  return (
    <div className="ciq-check" data-s={s.status}>
      <span className="ciq-check-dot">{MARK[s.status] || '?'}</span>
      <div style={{ minWidth: 0 }}>
        <b>{s.title}<em>{STATUS_WORD[s.status] || s.status}</em></b>
        {s.status !== 'done' && s.status !== 'confirmed' && s.how && <small>{s.how}</small>}
      </div>
    </div>
  );
}
