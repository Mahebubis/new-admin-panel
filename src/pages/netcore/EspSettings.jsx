import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/campaigns/settings.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

// Everything provider-specific lives here so the card below stays generic — adding a
// fourth ESP later means one entry here plus a transport class on the PHP side.
// `extraFields` are the inputs only that provider needs (SendGrid and Elastic Email both
// authenticate with a bare API key, so neither has any). Both `keyLabel` and `extraFields`
// may be functions of the current form state, which is what lets SES relabel its two
// credential boxes when the auth mode changes — the same two columns hold an access key pair
// in API mode and an SMTP user/password pair in SMTP mode, and they are NOT interchangeable,
// so calling them "API key" in both would be actively misleading.
const PROVIDERS = {
  sendgrid: {
    label: 'SendGrid',
    blurb: 'Raw delivery API — full first-party open/click tracking, real-time bounce webhook support.',
    keyPlaceholder: 'SG.xxxxxxxx…',
    extraFields: [],
    webhookPath: '/api/campaigns/sendgrid-webhook.php',
    webhookHint: 'SendGrid → Settings → Mail Settings → Event Webhook → HTTP POST URL:',
  },
  elasticemail: {
    label: 'Elastic Email',
    blurb: 'Transactional REST API (v4) — same first-party open/click tracking; delivery and bounce events need webhooks, which Elastic Email only allows on paid plans.',
    keyPlaceholder: 'Paste the key from Elastic Email → Settings → API',
    extraFields: [],
    webhookPath: '/api/campaigns/elasticemail-webhook.php',
    webhookHint: 'Elastic Email → Settings → Notifications → Manage webhooks (PRO plan only) → URL:',
  },
  ses: {
    label: 'Amazon SES',
    blurb: 'Cheapest per email by a wide margin, and the only provider here with two ways in: the signed HTTPS API (preferred) or plain SMTP. Same first-party open/click tracking; delivery and bounce events arrive through Amazon SNS.',
    keyLabel: (f) => (f.auth_mode === 'smtp' ? 'SMTP user name' : 'Access key ID'),
    keyPlaceholder: 'AKIA…',
    extraFields: (f) => [
      {
        key: 'auth_mode', label: 'Auth mode', type: 'select',
        options: [
          { value: 'api', label: 'API — signed HTTPS (recommended)' },
          { value: 'smtp', label: 'SMTP — email-smtp.<region>.amazonaws.com' },
        ],
        hint: f.auth_mode === 'smtp'
          ? 'Works with the SMTP credentials the SES console shows once. Sending is fully supported, but suppression sync, domain authentication and the account check below all need API mode — the SMTP password is a one-way hash of the secret key and cannot be turned back into one.'
          : 'Needs an IAM access key ID + secret access key (IAM → Users → the SES user → Security credentials → Create access key). Gives message IDs, suppression sync, domain authentication and the account check.',
      },
      {
        key: 'api_secret', type: 'secret', maskedFrom: 'api_secret_masked',
        label: f.auth_mode === 'smtp' ? 'SMTP password' : 'Secret access key',
        placeholder: f.auth_mode === 'smtp' ? 'The password shown once when the SMTP credentials were created' : 'wJalr…',
      },
      { key: 'aws_region', label: 'AWS region', placeholder: 'ap-south-1' },
      {
        key: 'configuration_set', label: 'Configuration set',
        placeholder: 'e.g. campaign-events',
        hint: 'Required for delivery/bounce/complaint counts. SES publishes events ONLY for sends tagged with a configuration set that has an SNS event destination — without one, campaigns send fine and report 0 delivered and 0 bounced forever.',
      },
    ],
    webhookPath: '/api/campaigns/ses-webhook.php',
    webhookHint: 'SNS → Topics → your topic → Create subscription → Protocol HTTPS → Endpoint (confirmation is automatic):',
  },
};

// Same base + fallback as src/api/axios.js — the webhook URLs shown below have to be the
// real public ones the provider will POST to, which is never localhost even in dev.
const API_BASE = import.meta.env.VITE_API_URL || 'https://cit3.internshipstudio.com/admin/react-api';

const inp = { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box' };
const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 };
const hintStyle = { fontSize: 10.5, color: '#94a3b8', marginTop: 5, lineHeight: 1.5 };
const card = { background: '#fff', borderRadius: 12, padding: 22, marginBottom: 18 };
const Radio = ({ on }) => (
  <span style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${on ? '#1e3a8a' : '#cbd5e1'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    {on && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1e3a8a' }} />}
  </span>
);

/* The active/inactive control. Reads as a statement when it's the chosen provider
   ("Active sender", not clickable — clicking the already-active one would be a no-op that
   still fires a save) and as an action when it isn't ("Select"). Both states were previously
   the same static "Active sender" label, so there was no way to tell which card was live or
   that the other one could be clicked at all. */
function SenderToggle({ isActive, onSelect }) {
  if (isActive) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0, padding: '7px 14px', borderRadius: 999, background: '#eef2ff', border: '1.5px solid #1e3a8a' }}>
        <Radio on />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a' }}>Active sender</span>
      </span>
    );
  }
  return (
    <button type="button" onClick={onSelect}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0, padding: '7px 14px', borderRadius: 999, background: '#fff', border: '1.5px solid #cbd5e1', cursor: 'pointer', fontFamily: 'inherit' }}>
      <Radio on={false} />
      <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Select</span>
    </button>
  );
}

/* SES only. The sandbox is the single most common reason a correctly configured SES setup
   looks broken — every send to an unverified address is rejected, the cap is 200/day and the
   rate is 1/s — and nothing else in this UI can tell you that's what is happening. */
function SesAccountCheck() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setBusy(true);
    try {
      const res = await api.post(API, new URLSearchParams({ action: 'ses_status' }), FORM);
      setState(res.data?.data?.ses || { ok: false, error: res.data?.message || 'Request failed' });
    } catch (e) {
      setState({ ok: false, error: e?.response?.data?.message || 'Network error' });
    } finally { setBusy(false); }
  };

  return (
    <div style={{ marginTop: 12, padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Account status, sending quota and sandbox check</div>
        <button type="button" onClick={check} disabled={busy}
          style={{ padding: '6px 12px', border: '1.5px solid #cbd5e1', background: '#fff', borderRadius: 7, fontSize: 11, fontWeight: 700, color: '#334155', cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          {busy ? 'Checking…' : 'Check SES account'}
        </button>
      </div>

      {state && !state.ok && (
        <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 8, lineHeight: 1.55 }}>{state.error}</div>
      )}
      {state && state.ok && (
        <div style={{ fontSize: 11, color: '#334155', marginTop: 8, lineHeight: 1.7 }}>
          <div><b>Region:</b> {state.region}</div>
          <div>
            <b>Access:</b>{' '}
            {state.sandbox
              ? <span style={{ color: '#b45309' }}>SANDBOX — sends are only accepted for addresses verified in SES, capped at 200/day. Request production access in the SES console before running a real campaign.</span>
              : <span style={{ color: '#15803d' }}>Production</span>}
          </div>
          <div><b>Sending rate:</b> {state.max_send_rate}/second — set SES_MAX_CONCURRENCY in lib/config.php to match</div>
          <div><b>24h quota:</b> {state.sent_last_24_hours} of {state.max_24_hour_send} used</div>
          {!state.sending_enabled && <div style={{ color: '#b91c1c' }}><b>Sending is currently DISABLED on this account</b> ({state.enforcement})</div>}
        </div>
      )}
    </div>
  );
}

function ProviderCard({ row, isActive, onSave, onActivate }) {
  const meta = PROVIDERS[row.provider];
  const [form, setForm] = useState({
    api_key: '', api_secret: '',
    auth_mode: row.auth_mode || 'api',
    aws_region: row.aws_region || 'ap-south-1',
    configuration_set: row.configuration_set || '',
    api_base_url: row.api_base_url || '', list_uid: row.list_uid || '',
    default_sender_name: row.default_sender_name || '', default_sender_email: row.default_sender_email || '',
    default_sending_domain: row.default_sending_domain || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Unknown provider rows (e.g. a retired one still sitting in the DB) are never rendered —
  // the backend already filters them out, this is just belt-and-braces so a stray row can't
  // crash the page on meta.label.
  if (!meta) return null;

  const extras = typeof meta.extraFields === 'function' ? meta.extraFields(form) : (meta.extraFields || []);

  /* Only the fields this provider actually renders are submitted. One form shape backs every
     card, so without this filter saving SendGrid would also write SES's auth_mode and region
     into the SendGrid row — inert today, but it makes the stored rows lie about what is
     configured, which is exactly the kind of thing someone later reads as meaningful. */
  const save = async () => {
    setSaving(true);
    try {
      const keys = ['api_key', 'api_base_url', 'list_uid', 'default_sender_name',
                    'default_sender_email', 'default_sending_domain', ...extras.map(f => f.key)];
      const payload = {};
      for (const k of keys) if (form[k] !== undefined) payload[k] = form[k];
      await onSave(row.provider, payload);
    }
    finally { setSaving(false); }
  };
  const keyLabel = typeof meta.keyLabel === 'function' ? meta.keyLabel(form) : (meta.keyLabel || 'API key');

  return (
    // The active card is outlined so which provider is live is readable at a glance from
    // across the page, not only from the pill in its corner.
    <div style={{ ...card, border: isActive ? '2px solid #1e3a8a' : '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{meta.label}</div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{meta.blurb}</div>
        </div>
        <SenderToggle isActive={isActive} onSelect={() => onActivate(row.provider)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={label}>{keyLabel} <span style={{ fontWeight: 500, color: '#94a3b8' }}>(currently {row.api_key_masked})</span></label>
          <input style={inp} value={form.api_key} onChange={e => set('api_key', e.target.value)} placeholder={meta.keyPlaceholder} />
        </div>
        {extras.map(f => (
          <div key={f.key}>
            <label style={label}>
              {f.label}
              {/* A secret is never sent back to the browser, so the only honest thing to show
                  is the masked tail of what is stored — and leaving the box empty must mean
                  "keep it", not "clear it" (settings.php skips empty values). */}
              {f.type === 'secret' && <span style={{ fontWeight: 500, color: '#94a3b8' }}> (currently {row[f.maskedFrom] || '—'})</span>}
            </label>
            {f.type === 'select' ? (
              <select style={inp} value={form[f.key] ?? ''} onChange={e => set(f.key, e.target.value)}>
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input style={inp} value={form[f.key] ?? ''} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder || ''} />
            )}
            {f.hint && <div style={hintStyle}>{f.hint}</div>}
          </div>
        ))}
        <div><label style={label}>Default sender name</label><input style={inp} value={form.default_sender_name} onChange={e => set('default_sender_name', e.target.value)} /></div>
        <div><label style={label}>Default sender email</label><input style={inp} value={form.default_sender_email} onChange={e => set('default_sender_email', e.target.value)} /></div>
        <div><label style={label}>Default sending domain</label><input style={inp} value={form.default_sending_domain} onChange={e => set('default_sending_domain', e.target.value)} /></div>
      </div>

      <div style={{ marginTop: 14, padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>{meta.webhookHint}</div>
        <code style={{ fontSize: 11, color: '#1e3a8a', wordBreak: 'break-all' }}>{API_BASE + meta.webhookPath}</code>
      </div>

      {row.provider === 'ses' && <SesAccountCheck />}

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <button onClick={save} disabled={saving} style={{ padding: '9px 20px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default function EspSettings() {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.post(API, new URLSearchParams({ action: 'get' }), FORM);
      if (res.data.success) setRows(res.data.data.settings || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async (provider, form) => {
    const t = toast.loading('Saving…');
    try {
      const body = { action: 'save', provider, ...form };
      const res = await api.post(API, new URLSearchParams(body), FORM);
      if (res.data.success) {
        // The backend warns rather than refuses when a provider is made the active sender
        // before its credentials are real — otherwise the first sign of it is a campaign in
        // which every single recipient failed.
        const warning = res.data.data?.warning;
        if (warning) toast(warning, { id: t, icon: '⚠️', duration: 8000 });
        else toast.success('Saved', { id: t });
        load();
      }
      else toast.error(res.data.message || 'Failed', { id: t });
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error', { id: t }); }
  };
  const activate = async (provider) => save(provider, { is_active: 1 });

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", padding: 26, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <button onClick={() => nav('/netcore/campaigns')} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#0f172a' }}>Email provider settings</div>
          <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Click <b>Select</b> to change which provider sends your campaigns and journeys. The choice is applied when a campaign is sent or scheduled, so drafts always go out through whichever provider is active at that moment.</div>
        </div>
      </div>

      {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading…</div> :
        rows.map(r => (
          // Number(), not !!. mysqli returns TINYINT as a string, and `!!"0"` is true in JS —
          // which drew every card as the active sender. settings.php now casts it server-side
          // too; this stays numeric so a future caller can't reintroduce the same bug.
          <ProviderCard key={r.provider} row={r} isActive={Number(r.is_active) === 1} onSave={save} onActivate={activate} />
        ))}
    </div>
  );
}
