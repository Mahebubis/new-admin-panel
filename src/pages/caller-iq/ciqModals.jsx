import { useState } from 'react';
import toast from 'react-hot-toast';
import { ripple } from '../netcore/analytics/maShared';
import { ciq, errText, Modal, Ic, Avatar } from './ciqShared';

/** Name the counselor behind a phone, put them in a team, or hide a test handset. */
export function AgentModal({ device, teams = [], onClose, onSaved }) {
  const [name, setName] = useState(device.agent_name || '');
  const [team, setTeam] = useState(device.team || '');
  const [hidden, setHidden] = useState(!!Number(device.is_hidden));
  const [busy, setBusy] = useState(false);
  const unidentified = device.device_id === '';

  const save = async close => {
    setBusy(true);
    try {
      await ciq('save_device', { device_id: device.device_id, agent_name: name.trim(), team: team.trim(), is_hidden: hidden });
      toast.success('Agent saved');
      onSaved?.();
      close();
    } catch (e) { toast.error(errText(e)); setBusy(false); }
  };

  return (
    <Modal
      onClose={onClose}
      title="Edit agent"
      sub={unidentified
        ? 'Calls from phones running the original app build, which does not identify the handset. Update the app to split them per agent.'
        : `${device.device_model || 'Android phone'}${device.app_version ? ` · app v${device.app_version}` : ''} · ID ${device.device_id}`}
      footer={close => (
        <>
          <button className="ma-btn ma-rip" onPointerDown={ripple} onClick={close} disabled={busy}>Cancel</button>
          <button className="ma-btn primary ma-rip" onPointerDown={ripple} onClick={() => save(close)} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </>
      )}
    >
      {close => (
        <form onSubmit={e => { e.preventDefault(); save(close); }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <Avatar name={name || device.label} size={44} />
            <div style={{ fontSize: 12.5, color: '#64748b' }}>This name replaces the phone model everywhere in Caller IQ.</div>
          </div>
          <label className="ciq-field"><span>Agent name</span>
            <input className="ciq-input" maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rahul Sharma" /></label>
          <label className="ciq-field"><span>Team</span>
            <input className="ciq-input" maxLength={80} value={team} onChange={e => setTeam(e.target.value)} list="ciq-teams" placeholder="e.g. Admissions" />
            <datalist id="ciq-teams">{teams.map(t => <option key={t} value={t} />)}</datalist>
            <em>Teams become a filter in the Filters drawer.</em>
          </label>
          <div className="ciq-switch" role="switch" aria-checked={hidden} tabIndex={0}
               onClick={() => setHidden(h => !h)} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setHidden(h => !h); } }}>
            <div><b>Hide this phone</b><small>For test handsets. Its calls leave every total unless you pick it in the Agent filter.</small></div>
            <span className="ciq-toggle" data-on={hidden ? '1' : undefined} />
          </div>
          <button type="submit" hidden />
        </form>
      )}
    </Modal>
  );
}

const PLAN_LENGTHS = [
  ['28 days', 28], ['56 days', 56], ['84 days', 84], ['90 days', 90], ['1 year', 365],
];
const addDays = (from, days) => {
  const d = new Date(`${from}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Record a recharge against one SIM.
 *
 * Typed rather than fetched, because no Android API reports a prepaid balance or a plan's validity
 * — carriers keep that behind USSD, their own apps and SMS. The pack lengths below are the ones
 * Indian prepaid plans actually come in, so the expiry is one tap rather than date arithmetic.
 */
export function SimModal({ sim, onClose, onSaved }) {
  const [msisdn, setMsisdn] = useState(sim.msisdn || '');
  const [plan, setPlan] = useState(sim.plan_name || '');
  const [amount, setAmount] = useState(sim.amount ?? '');
  const [from, setFrom] = useState(sim.recharged_on || todayStr());
  const [till, setTill] = useState(sim.valid_till || '');
  const [notes, setNotes] = useState(sim.notes || '');
  const [busy, setBusy] = useState(false);

  const save = async close => {
    setBusy(true);
    try {
      await ciq('save_sim', {
        device_id: sim.device_id, slot: sim.slot, msisdn: msisdn.trim(), plan_name: plan.trim(),
        amount: amount === '' ? null : Number(amount), recharged_on: from || null, valid_till: till || null, notes,
      });
      toast.success('Recharge saved');
      onSaved?.();
      close();
    } catch (e) { toast.error(errText(e)); setBusy(false); }
  };

  return (
    <Modal
      onClose={onClose}
      width={540}
      title={`SIM ${sim.slot}${sim.carrier ? ` · ${sim.carrier}` : ''}`}
      sub={`${sim.agent}${sim.device_model ? ` · ${sim.device_model}` : ''}`}
      footer={close => (
        <>
          <button className="ma-btn ma-rip" onPointerDown={ripple} onClick={close} disabled={busy}>Cancel</button>
          <button className="ma-btn primary ma-rip" onPointerDown={ripple} onClick={() => save(close)} disabled={busy}>
            {busy ? 'Saving…' : 'Save recharge'}
          </button>
        </>
      )}
    >
      {close => (
        <form onSubmit={e => { e.preventDefault(); save(close); }}>
          <div className="ciq-row2">
            <label className="ciq-field"><span>SIM number</span>
              <input className="ciq-input" maxLength={20} value={msisdn} onChange={e => setMsisdn(e.target.value)} placeholder="e.g. +91 98765 43210" />
              <em>Only some SIMs carry their own number; type it once and it stays.</em>
            </label>
            <label className="ciq-field"><span>Plan</span>
              <input className="ciq-input" maxLength={120} value={plan} onChange={e => setPlan(e.target.value)} placeholder="e.g. ₹299 unlimited" />
            </label>
          </div>

          <div className="ciq-row2">
            <label className="ciq-field"><span>Amount paid (₹)</span>
              <input className="ciq-input" type="number" min="0" step="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="299" />
            </label>
            <label className="ciq-field"><span>Recharged on</span>
              <input className="ciq-input" type="date" max={todayStr()} value={from} onChange={e => setFrom(e.target.value)} />
            </label>
          </div>

          <label className="ciq-field"><span>Valid till</span>
            <input className="ciq-input" type="date" value={till} onChange={e => setTill(e.target.value)} />
            <em>This is the date the dashboard warns you about, five days ahead.</em>
          </label>

          <div className="ciq-opts" style={{ marginTop: -4, marginBottom: 12 }}>
            {PLAN_LENGTHS.map(([label, days]) => (
              <button key={days} type="button" className="ma-chip ma-rip" onPointerDown={ripple}
                      data-on={from && till === addDays(from, days) ? '1' : undefined}
                      onClick={() => setTill(addDays(from || todayStr(), days))} disabled={!from}>
                +{label}
              </button>
            ))}
          </div>

          <label className="ciq-field"><span>Notes</span>
            <textarea className="ciq-input" style={{ minHeight: 60 }} value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="Who recharges this SIM, which account it is paid from…" />
          </label>
          <button type="submit" hidden />
        </form>
      )}
    </Modal>
  );
}

/** How to point a phone at this panel. */
export function SetupModal({ ingestUrl, onClose }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(ingestUrl); toast.success('Endpoint copied'); } catch { toast.error('Copy blocked by the browser'); }
  };
  return (
    <Modal onClose={onClose} width={560} title="Connect a counselor's phone"
           sub="Caller IQ reads the phone's call log after every call and syncs it here in the background, with retries when the phone is offline."
           footer={close => <button className="ma-btn primary ma-rip" onPointerDown={ripple} onClick={close}>Done</button>}>
      <ol className="ciq-steps">
        <li>Install the <b>CallIQ</b> app on the Android phone and open it.</li>
        <li>Allow <b>Call log</b>, <b>Phone</b> and <b>Notifications</b> when asked. The Phone permission is also what lets the app tell SIM 1 from SIM 2.</li>
        <li>Tap <b>Fix now</b> on the <b>post-call popup</b> banner and work through <b>Post-Call Popup Setup</b> — “Display over other apps”, plus the pop-up and autostart switches that Xiaomi, Realme/Oppo, Vivo and Honor add on top. Finish with <b>Test it now</b>.</li>
        <li>Tap <b>Fix now</b> on the battery banner so Android does not pause syncing.</li>
        <li>Tap the <b>⚙ gear</b>, enter the admin PIN, and set <b>CRM Call Log Endpoint URL</b> to:</li>
      </ol>
      <div className="ciq-code" style={{ margin: '8px 0 12px' }}>
        <span>{ingestUrl}</span>
        <button type="button" onClick={copy}>{Ic.copy} Copy</button>
      </div>
      <ol className="ciq-steps" start={6}>
        <li>Tap <b>Save Endpoint</b>, then <b>Force Flush</b>. The phone appears under <b>Agents</b> within a minute.</li>
        <li>In the app's settings tap <b>Preview popup</b> to check the prompt appears, then open <b>Agents</b> here and give the phone the counselor's name and team.</li>
      </ol>
      <div className="ma-note" style={{ marginTop: 12 }}>
        Phones on the original app build send no handset ID, so they all show as one “Unidentified phone”, and their SIM shows as unknown.
        App v1.3 sends the handset ID, resolves SIM 1 / SIM 2 exactly, catches up on calls made while the app was closed, and asks for the
        outcome right after each call.
      </div>
    </Modal>
  );
}
