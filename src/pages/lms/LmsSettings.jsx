// ===========================================================================
//  LmsSettings.jsx — the "Settings" tab.
//  School-wide LMS defaults, stored as key/value rows in lms_settings.
// ===========================================================================
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Save, Settings as SettingsIcon, Shield, Play, Mail, KeyRound, ExternalLink } from 'lucide-react';
import { LMS } from './lmsApi';
import { Loader, Toggle } from './LmsStyles';

const DEFAULTS = {
  school_name: 'Internship Studio',
  support_email: 'contact@internshipstudio.com',
  default_validity_days: '365',
  default_encryption: 'unencrypted',
  currency_symbol: '₹',
  allow_download: '0',
  watermark_videos: '1',
  autoplay_next: '1',
  require_sequential: '0',
  certificate_enabled: '1',
  certificate_pass_percent: '70',
  welcome_email: '1',
  enrollment_email: '1',
};

/* every key that renders as an on/off switch rather than a text input */
const BOOLS = [
  ['allow_download', 'Allow lesson downloads', 'Let learners download attached files for offline use.'],
  ['watermark_videos', 'Watermark videos', 'Overlay the learner’s email on the player to discourage screen recording.'],
  ['autoplay_next', 'Autoplay next lesson', 'Roll straight into the next lesson when one finishes.'],
  ['require_sequential', 'Sequential unlocking', 'A lesson only unlocks once the previous one is complete.'],
  ['certificate_enabled', 'Issue completion certificates', 'Generate a certificate when a learner finishes a course.'],
  ['welcome_email', 'Send welcome email', 'Email new learners their login details when you register them.'],
  ['enrollment_email', 'Send enrollment email', 'Notify a learner whenever they are enrolled into a course.'],
];

export default function LmsSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(DEFAULTS);
  const [storePw, setStorePw] = useState('');
  const [storeBusy, setStoreBusy] = useState(false);

  useEffect(() => {
    LMS.getSettings()
      .then(d => setSettings({ ...DEFAULTS, ...(d.settings || {}) }))
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await LMS.saveSettings(settings);
      toast.success('Settings saved');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  /* The store password never round-trips through `settings`: it is hashed
     server-side by its own action, so the plaintext leaves this component
     once and is not held in state afterwards. */
  const saveStorePassword = async (clear = false) => {
    setStoreBusy(true);
    try {
      const d = await LMS.setStorePassword(clear ? '' : storePw);
      setSettings(s => ({ ...s, store_login_password_set: d.set ? '1' : '0' }));
      setStorePw('');
      toast.success(d.set ? 'Store login password updated' : 'Store login password removed');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setStoreBusy(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="lms-page" style={{ maxWidth: 780 }}>
      <div className="lms-page-head">
        <div>
          <h1 className="lms-h1">LMS Settings</h1>
          <p className="lms-sub">Defaults applied across every course in the LMS</p>
        </div>
        <button className="lms-btn lms-btn-dark" onClick={save} disabled={saving}>
          <Save size={16} /> {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <div className="lms-card lms-card-pad" style={{ marginBottom: 20 }}>
        <h3 className="lms-h3" style={{ marginBottom: 4 }}>
          <SettingsIcon size={16} style={{ verticalAlign: -3, marginRight: 7 }} /> General
        </h3>
        <p className="lms-help" style={{ margin: '0 0 18px' }}>Branding and defaults for new courses.</p>

        <div className="lms-row-2">
          <div className="lms-field">
            <label className="lms-label">School name</label>
            <input className="lms-input" value={settings.school_name}
              onChange={e => set('school_name', e.target.value)} />
          </div>
          <div className="lms-field">
            <label className="lms-label">Support email</label>
            <input className="lms-input" type="email" value={settings.support_email}
              onChange={e => set('support_email', e.target.value)} />
          </div>
        </div>
        <div className="lms-row-3">
          <div className="lms-field">
            <label className="lms-label">Default validity (days)</label>
            <input className="lms-input" type="number" min="0" value={settings.default_validity_days}
              onChange={e => set('default_validity_days', e.target.value)} />
          </div>
          <div className="lms-field">
            <label className="lms-label">Default content security</label>
            <select className="lms-select" value={settings.default_encryption}
              onChange={e => set('default_encryption', e.target.value)}>
              <option value="unencrypted">No Encryption</option>
              <option value="encrypted">Encryption (DRM)</option>
            </select>
          </div>
          <div className="lms-field">
            <label className="lms-label">Currency symbol</label>
            <input className="lms-input" maxLength={3} value={settings.currency_symbol}
              onChange={e => set('currency_symbol', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="lms-card lms-card-pad" style={{ marginBottom: 20 }}>
        <h3 className="lms-h3" style={{ marginBottom: 4 }}>
          <Play size={16} style={{ verticalAlign: -3, marginRight: 7 }} /> Player & content
        </h3>
        <p className="lms-help" style={{ margin: '0 0 6px' }}>How lessons behave inside the course player.</p>

        {BOOLS.slice(0, 4).map(([k, label, help]) => (
          <div className="lms-toggle-row" key={k}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{label}</div>
              <div style={{ fontSize: 12, color: 'var(--lms-text-2)' }}>{help}</div>
            </div>
            <Toggle on={settings[k] === '1' || settings[k] === 1 || settings[k] === true}
              onChange={v => set(k, v ? '1' : '0')} />
          </div>
        ))}
      </div>

      <div className="lms-card lms-card-pad" style={{ marginBottom: 20 }}>
        <h3 className="lms-h3" style={{ marginBottom: 4 }}>
          <Shield size={16} style={{ verticalAlign: -3, marginRight: 7 }} /> Certificates
        </h3>
        <p className="lms-help" style={{ margin: '0 0 6px' }}>When a learner earns a completion certificate.</p>

        <div className="lms-toggle-row">
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 500 }}>Issue completion certificates</div>
            <div style={{ fontSize: 12, color: 'var(--lms-text-2)' }}>Generate a certificate when a learner finishes a course.</div>
          </div>
          <Toggle on={settings.certificate_enabled === '1'} onChange={v => set('certificate_enabled', v ? '1' : '0')} />
        </div>
        <div className="lms-field" style={{ marginTop: 18 }}>
          <label className="lms-label">Minimum completion to qualify (%)</label>
          <input className="lms-input" type="number" min="0" max="100" style={{ maxWidth: 200 }}
            disabled={settings.certificate_enabled !== '1'}
            value={settings.certificate_pass_percent}
            onChange={e => set('certificate_pass_percent', e.target.value)} />
        </div>
      </div>

      <div className="lms-card lms-card-pad">
        <h3 className="lms-h3" style={{ marginBottom: 4 }}>
          <Mail size={16} style={{ verticalAlign: -3, marginRight: 7 }} /> Notifications
        </h3>
        <p className="lms-help" style={{ margin: '0 0 6px' }}>
          Emails sent from the LMS. These flags are read by the sending job — the LMS panel itself never sends mail.
        </p>

        {BOOLS.slice(5).map(([k, label, help]) => (
          <div className="lms-toggle-row" key={k}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{label}</div>
              <div style={{ fontSize: 12, color: 'var(--lms-text-2)' }}>{help}</div>
            </div>
            <Toggle on={settings[k] === '1'} onChange={v => set(k, v ? '1' : '0')} />
          </div>
        ))}
      </div>

      <div className="lms-card lms-card-pad" style={{ marginTop: 20 }}>
        <h3 className="lms-h3" style={{ marginBottom: 4 }}>
          <KeyRound size={16} style={{ verticalAlign: -3, marginRight: 7 }} /> Learning portal
        </h3>
        <p className="lms-help" style={{ margin: '0 0 18px' }}>
          Buyers who came through the ₹99 store have no dashboard account, so they sign in to
          {' '}<a href="https://training.internshipstudio.com" target="_blank" rel="noreferrer"
             style={{ color: 'var(--lms-blue)' }}>training.internshipstudio.com <ExternalLink size={11} style={{ verticalAlign: -1 }} /></a>
          {' '}with their store email and this one shared password. Everyone else keeps using their own
          dashboard password. Leave it unset and that path stays closed.
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
          fontSize: 12.5, color: settings.store_login_password_set === '1' ? 'var(--lms-green-dark)' : 'var(--lms-text-2)',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: 999,
            background: settings.store_login_password_set === '1' ? 'var(--lms-green)' : 'var(--lms-text-3)',
          }} />
          {settings.store_login_password_set === '1'
            ? `A password is set${settings.store_login_password_set_at ? ` — last changed ${settings.store_login_password_set_at}` : ''}`
            : 'No password set — store-only buyers cannot sign in'}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="lms-field" style={{ flex: '1 1 280px', margin: 0 }}>
            <label className="lms-label">New store login password</label>
            <input
              className="lms-input"
              type="text"
              autoComplete="off"
              placeholder="At least 8 characters"
              value={storePw}
              onChange={e => setStorePw(e.target.value)}
            />
          </div>
          <button className="lms-btn lms-btn-dark" disabled={storePw.length < 8 || storeBusy}
            onClick={() => saveStorePassword(false)}>
            {storeBusy ? 'Saving…' : 'Set password'}
          </button>
          {settings.store_login_password_set === '1' && (
            <button className="lms-btn lms-btn-ghost" disabled={storeBusy}
              onClick={() => saveStorePassword(true)}>
              Remove
            </button>
          )}
        </div>

        <p className="lms-help" style={{ marginTop: 14 }}>
          It is stored as a bcrypt hash and never shown again — write it down before you leave this page.
        </p>
      </div>

      <div style={{ marginTop: 24 }}>
        <button className="lms-btn lms-btn-dark lms-btn-lg" onClick={save} disabled={saving}>
          <Save size={16} /> {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
