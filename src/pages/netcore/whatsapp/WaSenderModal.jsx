import { useState } from 'react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import { WA_SET_API, FORM, WA, inp, label } from './waShared';
import { Notice } from './WaUi';

/*
 * Edit one sending number's local details.
 *
 * Registering a NEW number is a different job with its own four-step Meta flow — see
 * WaAddNumberModal. This form only edits what we store about a number that already exists:
 *
 *   WABA ID          the ACCOUNT that owns the numbers (shared by all of them)
 *   Business number  which phone the message comes from
 *   Phone number ID  Meta's id for that number — the value Cloud API actually sends through
 *
 * Everything here is normally filled in automatically by the settings page's refresh; the form
 * exists for the occasional correction.
 */
export default function WaSenderModal({ sender, existingWabas = [], onClose, onSaved }) {
  const [form, setForm] = useState({
    id: sender?.id || null,
    waba_id: sender?.waba_id || (existingWabas[0]?.waba_id ?? ''),
    waba_name: sender?.waba_name || (existingWabas[0]?.waba_name ?? ''),
    business_number: sender?.business_number || '',
    display_name: sender?.display_name || '',
    provider: sender?.provider === 'netcore' ? 'netcore' : 'meta',
    phone_number_id: sender?.phone_number_id || '',
    api_key: '',
    source_id: sender?.source_id || '',
    quality_rating: sender?.quality_rating || '',
    messaging_limit: sender?.messaging_limit || '',
    notes: sender?.notes || '',
    is_default: sender ? Number(sender.is_default) === 1 : false,
    is_active: sender ? Number(sender.is_active) === 1 : true,
  });
  const netcore = form.provider === 'netcore';
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.waba_id.trim()) return toast.error('WABA ID is required');
    if (!form.business_number.trim()) return toast.error('Business number is required');
    setSaving(true);
    try {
      const body = new URLSearchParams({
        action: 'sender_save',
        id: form.id || '',
        waba_id: form.waba_id.trim(),
        waba_name: form.waba_name.trim(),
        business_number: form.business_number.trim(),
        display_name: form.display_name.trim(),
        provider: form.provider,
        phone_number_id: form.phone_number_id.trim(),
        source_id: form.source_id.trim(),
        quality_rating: form.quality_rating.trim(),
        messaging_limit: form.messaging_limit.trim(),
        notes: form.notes.trim(),
        is_default: form.is_default ? 1 : 0,
        is_active: form.is_active ? 1 : 0,
      });
      // Only sent when actually typed — an empty box means "leave the stored key alone", not
      // "erase it". The server applies the same rule for the masked placeholder.
      if (form.api_key.trim()) body.set('api_key', form.api_key.trim());
      const res = await api.post(WA_SET_API, body, FORM);
      if (res.data.success) { toast.success(form.id ? 'Number updated' : 'Number added'); onSaved(); }
      else toast.error(res.data.message || 'Could not save');
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 960, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={() => !saving && onClose()}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 26, width: 560, maxHeight: '88vh', overflowY: 'auto', fontFamily: "'Plus Jakarta Sans',sans-serif" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
          {form.id ? 'Edit sending number' : 'Add a sending number'}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 18 }}>
          Corrections to what we store. Meta is the source of truth — use Refresh to re-read it.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={label}>WABA ID <span style={{ color: '#dc2626' }}>*</span></label>
            <input style={inp} value={form.waba_id} onChange={e => set('waba_id', e.target.value.replace(/\s/g, ''))}
              placeholder="1229117948963194" list="wa-existing-wabas" />
            <datalist id="wa-existing-wabas">
              {existingWabas.map(w => <option key={w.waba_id} value={w.waba_id}>{w.waba_name || w.waba_id}</option>)}
            </datalist>
            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>
              The account, not the number — numbers under one business share it.
            </div>
          </div>
          <div>
            <label style={label}>WABA name</label>
            <input style={inp} value={form.waba_name} onChange={e => set('waba_name', e.target.value)} placeholder="Internship studio" />
            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>Label shown in the WABA dropdown.</div>
          </div>

          <div>
            <label style={label}>Business number <span style={{ color: '#dc2626' }}>*</span></label>
            <input style={inp} value={form.business_number} onChange={e => set('business_number', e.target.value)} placeholder="+91 8237850238" />
          </div>
          <div>
            <label style={label}>Display name</label>
            <input style={inp} value={form.display_name} onChange={e => set('display_name', e.target.value)} placeholder="Internship Studio" />
            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>Shown in message previews.</div>
          </div>

          {/*
            Which API this number sends through. Both are kept because they fail in opposite
            situations: Meta Cloud API is the direct route but only works once your Meta app is
            connected to the WABA, while Netcore works today precisely because their app holds
            that connection. Templates are read from Meta either way — Netcore has no template
            endpoint — so this setting decides delivery only.
          */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>Send through</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { id: 'meta', title: 'Meta Cloud API', sub: 'Direct. Needs your app connected to the WABA.' },
                { id: 'netcore', title: 'Netcore API', sub: 'Via your BSP. Needs this number\'s API key.' },
              ].map(o => (
                <button key={o.id} type="button" onClick={() => set('provider', o.id)}
                  style={{
                    flex: 1, textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    fontFamily: 'inherit', background: form.provider === o.id ? '#f0fdf4' : '#fff',
                    border: `1.5px solid ${form.provider === o.id ? WA.greenDark : '#e2e8f0'}`,
                    transition: 'all 200ms cubic-bezier(.4,0,.2,1)',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${form.provider === o.id ? WA.greenDark : '#cbd5e1'}` }}>
                      {form.provider === o.id && <span style={{ width: 6, height: 6, borderRadius: '50%', background: WA.greenDark }} />}
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{o.title}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4, lineHeight: 1.45 }}>{o.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Only the credential the chosen route actually uses is shown — the other is dead
              weight that makes the form look half-filled-in. Both stay stored either way, so
              switching back never means re-entering anything. */}
          {netcore ? (
            <>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={label}>
                  Netcore API key
                  <span style={{ fontWeight: 500, color: sender?.has_api_key ? '#94a3b8' : '#dc2626' }}>
                    {sender?.has_api_key ? ` — saved (${sender.api_key_masked})` : ' — required to send'}
                  </span>
                </label>
                <input style={{ ...inp, borderColor: (sender?.has_api_key || form.api_key) ? '#e2e8f0' : '#fca5a5' }}
                  type="password" autoComplete="new-password" value={form.api_key}
                  onChange={e => set('api_key', e.target.value)}
                  placeholder={sender?.has_api_key ? 'Leave blank to keep the current key' : 'Paste this number\'s API key'} />
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>
                  Netcore issues this <b>per business number</b> — Business number → Edit → Integrate API.
                  The key is what decides which number a message goes out from.
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={label}>Source ID <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional)</span></label>
                <input style={inp} value={form.source_id} onChange={e => set('source_id', e.target.value)}
                  placeholder="e.g. istudio_panel" />
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>
                  Netcore's webhook routing tag. Without it your endpoint receives events for every
                  message on this number, including other systems sharing it. Messages still send.
                </div>
              </div>
            </>
          ) : (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={label}>
                Phone number ID
                <span style={{ fontWeight: 500, color: form.phone_number_id.trim() ? '#94a3b8' : '#dc2626' }}>
                  {form.phone_number_id.trim() ? '' : ' — required to send'}
                </span>
              </label>
              <input style={{ ...inp, borderColor: form.phone_number_id.trim() ? '#e2e8f0' : '#fca5a5' }}
                value={form.phone_number_id} onChange={e => set('phone_number_id', e.target.value.replace(/\D/g, ''))}
                placeholder="838879545973071" />
              <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>
                Meta's id for this number — not the phone number itself. <b>Refresh</b> on the settings page
                fills this in automatically.
              </div>
            </div>
          )}

          <div>
            <label style={label}>Quality rating <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional)</span></label>
            <input style={inp} value={form.quality_rating} onChange={e => set('quality_rating', e.target.value)} placeholder="HIGH" />
          </div>
          <div>
            <label style={label}>Messaging limit <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional)</span></label>
            <input style={inp} value={form.messaging_limit} onChange={e => set('messaging_limit', e.target.value)} placeholder="100000 / 24hrs" />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>Notes <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional)</span></label>
            <input style={inp} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="e.g. use for exam reminders only" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, marginTop: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_default} onChange={e => set('is_default', e.target.checked)} />
            <span style={{ fontSize: 12, color: '#334155' }}>Use as the default for new campaigns</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
            <span style={{ fontSize: 12, color: '#334155' }}>Available for sending</span>
          </label>
        </div>

        <Notice tone={netcore ? 'info' : 'success'} style={{ marginTop: 16 }}>
          {netcore
            ? <>Messages go out through Netcore using this number\'s own API key. Delivery receipts still
              arrive on the same webhook URL — register it in the Netcore panel under
              Business number → Edit → Webhook Integration.</>
            : <>Sending needs no per-number key — the account\'s Meta access token plus this number\'s phone
              number ID is the whole credential. Delivery receipts arrive on the Meta app webhook.</>}
        </Notice>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} disabled={saving}
            style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>CANCEL</button>
          <button onClick={save} disabled={saving}
            style={{ padding: '9px 22px', border: 'none', background: WA.green, color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : form.id ? 'SAVE CHANGES' : 'ADD NUMBER'}
          </button>
        </div>
      </div>
    </div>
  );
}
