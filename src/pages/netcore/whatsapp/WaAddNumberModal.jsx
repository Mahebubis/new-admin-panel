import { useRef, useState } from 'react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import { WA_SET_API, FORM, WA, inp, label } from './waShared';
import { Notice } from './WaUi';

/*
 * Registers a brand-new business number on the WhatsApp Business Account, without leaving the
 * panel. Meta's flow is four calls and each can fail for its own reason, so it is walked as
 * four visible steps rather than one button that either works or doesn't:
 *
 *   1. Add        the number is attached to the WABA and gets its phone_number_id
 *   2. Verify     Meta sends a 6-digit code by SMS or voice; you type it back
 *   3. Register   the number is enabled for Cloud API with a 6-digit PIN
 *   4. Status     Meta's live view — display-name review, quality, throughput
 *
 * The number row is saved after step 1, so closing this dialog half-way doesn't lose it: it
 * reappears in the list and the remaining steps can be finished later.
 */
const ALL_STEPS = ['Number', 'Verify', 'Register', 'Done'];

/**
 * @param existing  when set, this is a TAKEOVER rather than an add: the number is already on the
 *                  WABA but registered to somebody else's app (a BSP like Netcore), so only the
 *                  verify + register half of the flow applies. Registering re-points the number
 *                  at THIS app — which is what makes Cloud API sending work, and simultaneously
 *                  stops the previous provider from sending on it. Meta allows exactly one app
 *                  per number; there is no sharing.
 */
export default function WaAddNumberModal({ wabaId, existing = null, onClose, onDone }) {
  const takeover = !!existing;
  // Step values stay 0..3 across both modes so every handler below is unchanged; the stepper just
  // renders the tail of the list when the first step doesn't apply.
  const baseStep = takeover ? 1 : 0;
  const STEPS = takeover ? ALL_STEPS.slice(1) : ALL_STEPS;

  const [step, setStep] = useState(baseStep);
  const [busy, setBusy] = useState(false);

  const [cc, setCc] = useState('91');
  const [phone, setPhone] = useState(takeover ? String(existing.business_number || '').replace(/\D/g, '') : '');
  const [name, setName] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState(takeover ? String(existing.phone_number_id || '') : '');

  // In takeover mode the number is already known in full, so the cc+phone concatenation used by
  // the add flow would print the country code twice.
  const displayNumber = takeover ? `+${phone}` : `+${cc}${phone}`;

  const [method, setMethod] = useState('SMS');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState(null);

  /* Meta's last refusal, kept so a caller can react to a specific one rather than only knowing
     that something failed — "already verified" in particular is not really an error. */
  const lastError = useRef('');

  const call = async (action, params, okMsg) => {
    setBusy(true);
    lastError.current = '';
    const t = toast.loading('Working…');
    try {
      const res = await api.post(WA_SET_API, new URLSearchParams({ action, ...params }), FORM);
      if (res.data.success) {
        if (okMsg) toast.success(okMsg, { id: t }); else toast.dismiss(t);
        return res.data.data || {};
      }
      // Meta's messages are specific ("business not verified", "number already registered"), so
      // they're shown for long enough to actually read.
      lastError.current = String(res.data.message || '');
      toast.error(res.data.message || 'Failed', { id: t, duration: 14000 });
      return null;
    } catch (e) {
      lastError.current = String(e?.response?.data?.message || '');
      toast.error(lastError.current || 'Network error', { id: t, duration: 14000 });
      return null;
    } finally { setBusy(false); }
  };

  /*
   * "You have already verified ownership of this phone number" is Meta telling us this step is
   * unnecessary, not that anything went wrong — it happens on any number added through Business
   * Manager, and on a takeover where the previous provider verified it. Treated as a pass so the
   * flow doesn't dead-end on a green light.
   */
  const skipIfAlreadyVerified = () => {
    if (/already verified|already been verified/i.test(lastError.current)) {
      toast.success('Already verified — moving on to registration');
      setStep(2);
      return true;
    }
    return false;
  };

  const addNumber = async () => {
    if (!cc.trim() || !phone.trim()) return toast.error('Country code and number are both required');
    if (!name.trim()) return toast.error('A display name is required');
    const d = await call('number_add', { cc, phone_number: phone, verified_name: name, waba_id: wabaId || '' },
      'Number added to your WhatsApp account');
    if (!d) return;
    setPhoneNumberId(d.phone_number_id);
    setStep(1);
    onDone?.({ soft: true }); // refresh the list behind the dialog — the row exists from here on
  };

  const requestCode = async () => {
    const d = await call('number_request_code', { phone_number_id: phoneNumberId, code_method: method },
      `Code sent by ${method === 'VOICE' ? 'voice call' : 'SMS'}`);
    if (d) { setCode(''); return; }
    skipIfAlreadyVerified();
  };

  const verifyCode = async () => {
    if (code.trim().length < 4) return toast.error('Enter the code Meta sent');
    const d = await call('number_verify_code', { phone_number_id: phoneNumberId, code }, 'Number verified');
    if (d) { setStep(2); return; }
    skipIfAlreadyVerified();
  };

  const register = async () => {
    if (!/^\d{6}$/.test(pin)) return toast.error('The PIN must be exactly 6 digits');
    const d = await call('number_register', { phone_number_id: phoneNumberId, pin }, 'Registered for sending');
    if (!d) return;
    const st = await call('number_status', { phone_number_id: phoneNumberId });
    setStatus(st?.status || null);
    setStep(3);
    onDone?.({ soft: true });
  };

  const refreshStatus = async () => {
    const st = await call('number_status', { phone_number_id: phoneNumberId });
    if (st) setStatus(st.status);
  };

  return (
    <div className="wa-backdrop" onClick={() => !busy && onClose()}>
      <div className="wa-dialog" style={{ padding: 26, width: 560, maxHeight: '88vh', overflowY: 'auto', fontFamily: "'Plus Jakarta Sans',sans-serif" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
          {takeover ? 'Connect this number to your app' : 'Add a business number'}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3, marginBottom: 18 }}>
          {takeover
            ? <>Re-registers <b style={{ color: '#475569' }}>{displayNumber}</b> against your own Meta app so this panel can send through it.</>
            : 'Registered directly on your WhatsApp Business Account — no other panel needed.'}
        </div>

        {takeover && (
          <Notice tone="danger" title="This disconnects your current provider" style={{ marginBottom: 18 }}>
            WhatsApp allows only <b>one app per number</b>. This number is currently registered to another
            app (your BSP — Netcore), which is why sending from here fails with <b>#200</b>. Registering it
            here fixes that, and <b>anything still sending through the old provider on this number stops
            immediately</b>. Move a spare number first if you have one, and avoid doing this mid-campaign.
          </Notice>
        )}

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          {STEPS.map((s, i) => {
            const value = i + baseStep;    // this label's position on the 0..3 scale
            const last = i === STEPS.length - 1;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: last ? '0 0 auto' : 1 }}>
                <span style={{
                  width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 10.5, fontWeight: 800, flexShrink: 0,
                  background: value < step ? WA.green : value === step ? WA.primary : '#e2e8f0',
                  color: value <= step ? '#fff' : '#94a3b8',
                }}>{value < step ? '✓' : i + 1}</span>
                <span style={{ fontSize: 11.5, fontWeight: value === step ? 700 : 600, color: value === step ? '#0f172a' : '#94a3b8', marginLeft: 7, whiteSpace: 'nowrap' }}>{s}</span>
                {!last && <span style={{ flex: 1, height: 2, background: value < step ? WA.green : '#e2e8f0', margin: '0 10px' }} />}
              </div>
            );
          })}
        </div>

        {step === 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 12 }}>
              <div>
                <label style={label}>Country code</label>
                <input style={inp} value={cc} onChange={e => setCc(e.target.value.replace(/\D/g, ''))} placeholder="91" />
              </div>
              <div>
                <label style={label}>Phone number</label>
                <input style={inp} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="9876543210" />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={label}>Display name</label>
              <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Internship Studio" />
              <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>
                What recipients see above the chat. Meta reviews it — it must match your real business name.
              </div>
            </div>
            <Notice tone="warn" style={{ marginTop: 14 }}>
              The number must not be active on WhatsApp or WhatsApp Business already. If it is, delete that
              account first, or Meta rejects it. Your business also has to be verified with Meta.
            </Notice>
          </>
        )}

        {step === 1 && (
          <>
            <div style={{ fontSize: 12.5, color: '#334155', marginBottom: 12, lineHeight: 1.6 }}>
              Meta will call or text <b>{displayNumber}</b> with a 6-digit code.
              {takeover && <> Its verification has expired, so it has to be re-verified before it can be
                registered to this app.</>}
            </div>
            <div style={{ display: 'flex', gap: 18, marginBottom: 12 }}>
              {['SMS', 'VOICE'].map(m => (
                <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }} onClick={() => setMethod(m)}>
                  <span style={{ width: 15, height: 15, borderRadius: '50%', border: `2px solid ${method === m ? WA.primary : '#cbd5e1'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {method === m && <span style={{ width: 7, height: 7, borderRadius: '50%', background: WA.primary }} />}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{m === 'SMS' ? 'Text message' : 'Voice call'}</span>
                </label>
              ))}
              <button className="wa-btn wa-btn-outlined wa-btn-sm" onClick={requestCode} disabled={busy}>Send code</button>
            </div>
            <label style={label}>Verification code</label>
            <input style={{ ...inp, maxWidth: 200, letterSpacing: '.3em', fontSize: 16, fontWeight: 700 }}
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="000000" />

            {/* A number added through Business Manager, or one a BSP already onboarded, is
                verified for good — Meta then refuses to send a code at all. Without this the
                flow dead-ends on a message that sounds like success. */}
            <button className="wa-btn wa-btn-text wa-btn-sm" onClick={() => setStep(2)} disabled={busy}
              style={{ marginTop: 12, paddingLeft: 0 }}>
              ALREADY VERIFIED — SKIP TO REGISTER →
            </button>
            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2, lineHeight: 1.55 }}>
              Use this if Meta says <i>"You have already verified ownership of this phone number"</i>.
              Ownership only needs proving once.
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ fontSize: 12.5, color: '#334155', marginBottom: 12, lineHeight: 1.6 }}>
              Last step — set a 6-digit PIN. This is the number's two-factor PIN, needed again if it's ever
              re-registered. It's stored with the number so you don't have to remember it.
              {takeover && <> Pick a new one; you don't need whatever PIN the previous provider used.</>}
            </div>
            <label style={label}>6-digit PIN</label>
            <input style={{ ...inp, maxWidth: 200, letterSpacing: '.3em', fontSize: 16, fontWeight: 700 }}
              value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
          </>
        )}

        {step === 3 && (
          <>
            <Notice tone="success" title="Number registered">
              <b>{displayNumber}</b> is {takeover ? 'now registered to your app' : 'on your WhatsApp Business Account'} and
              enabled for sending. {takeover
                ? 'Retry a failed campaign — the #200 error should be gone.'
                : 'It appears in the campaign wizard\'s Business number dropdown straight away.'}
            </Notice>
            {status && (
              <div style={{ marginTop: 14, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                {[
                  ['Display name review', status.name_status],
                  ['Verification', status.code_verification_status],
                  ['Quality rating', status.quality_rating],
                  ['Platform', status.platform_type],
                  ['Messaging limit', status.messaging_limit_tier],
                ].filter(([, v]) => v).map(([k, v], i) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: 11.5, background: i % 2 ? '#f8fafc' : '#fff' }}>
                    <span style={{ color: '#64748b' }}>{k}</span>
                    <span style={{ color: '#0f172a', fontWeight: 700 }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 8, lineHeight: 1.55 }}>
              Display-name review can take a few minutes to a couple of days. The number can send before it
              finishes — the name just shows as the number until then.
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 22 }}>
          <button className="wa-btn wa-btn-text" onClick={onClose} disabled={busy}>
            {step === 3 ? 'Close' : 'Cancel'}
          </button>
          {step === 0 && <button className="wa-btn wa-btn-contained" onClick={addNumber} disabled={busy}>Add number</button>}
          {step === 1 && <button className="wa-btn wa-btn-contained" onClick={verifyCode} disabled={busy}>Verify</button>}
          {step === 2 && <button className="wa-btn wa-btn-contained" onClick={register} disabled={busy}>Register</button>}
          {step === 3 && <button className="wa-btn wa-btn-outlined" onClick={refreshStatus} disabled={busy}>Refresh status</button>}
        </div>
      </div>
    </div>
  );
}
