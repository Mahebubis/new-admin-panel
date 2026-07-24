import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/campaigns/settings.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

const inp = { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box' };
const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 };
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 22, marginBottom: 18 };
const Radio = ({ on }) => (
  <span style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${on ? '#1e3a8a' : '#cbd5e1'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    {on && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1e3a8a' }} />}
  </span>
);

function ProviderCard({ row, isActive, onSave, onActivate }) {
  const [form, setForm] = useState({
    api_key: '', api_base_url: row.api_base_url || '', list_uid: row.list_uid || '',
    default_sender_name: row.default_sender_name || '', default_sender_email: row.default_sender_email || '',
    default_sending_domain: row.default_sending_domain || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try { await onSave(row.provider, form); }
    finally { setSaving(false); }
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', textTransform: 'capitalize' }}>{row.provider === 'sendgrid' ? 'SendGrid' : 'MailWizz'}</div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
            {row.provider === 'sendgrid' ? 'Raw delivery API — full first-party open/click tracking, real-time bounce webhook support.' : 'Self-hosted transactional API — used as a delivery engine only; bounce/unsubscribe events are best-effort (see docs).'}
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }} onClick={() => onActivate(row.provider)}>
          <Radio on={isActive} /><span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Active sender</span>
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={label}>API key <span style={{ fontWeight: 500, color: '#94a3b8' }}>(currently {row.api_key_masked})</span></label>
          <input style={inp} value={form.api_key} onChange={e => set('api_key', e.target.value)} placeholder="Paste the real key to replace it" />
        </div>
        {row.provider === 'mailwizz' && (
          <>
            <div><label style={label}>MailWizz base URL</label><input style={inp} value={form.api_base_url} onChange={e => set('api_base_url', e.target.value)} placeholder="https://your-mailwizz.example.com/api" /></div>
            <div><label style={label}>List UID</label><input style={inp} value={form.list_uid} onChange={e => set('list_uid', e.target.value)} /></div>
          </>
        )}
        <div><label style={label}>Default sender name</label><input style={inp} value={form.default_sender_name} onChange={e => set('default_sender_name', e.target.value)} /></div>
        <div><label style={label}>Default sender email</label><input style={inp} value={form.default_sender_email} onChange={e => set('default_sender_email', e.target.value)} /></div>
        <div><label style={label}>Default sending domain</label><input style={inp} value={form.default_sending_domain} onChange={e => set('default_sending_domain', e.target.value)} /></div>
      </div>

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
      if (res.data.success) { toast.success('Saved', { id: t }); load(); }
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
          <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Both are seeded with dummy placeholder values — paste real credentials any time, no deploy needed.</div>
        </div>
      </div>

      {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading…</div> :
        rows.map(r => (
          <ProviderCard key={r.provider} row={r} isActive={!!r.is_active} onSave={save} onActivate={activate} />
        ))}
    </div>
  );
}
