import { useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/lists/lists.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const CLOSE_ANIM_MS = 240;
const EMPTY_ROW = { email: '', first_name: '', last_name: '', phone: '', state: '', country: '', city: '', reason: '' };

const inp = { width: '100%', padding: '9px 11px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box' };
const label = { display: 'block', fontSize: 11.5, fontWeight: 700, color: '#0f172a', marginBottom: 5 };
const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
const isValidEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

/**
 * Add one or more contacts to a List/Blocklist without a CSV import, or edit an existing
 * contact's details in place (with an explicit opt-in to also push the edit into the real
 * `users` table, not just our own campaign_contacts copy). Same lists.php backend
 * (add_contact/update_contact) that also runs SendGrid suppression sync when the target
 * is the Blocklist.
 *
 * Right-side drawer, matching CreateAttributeModal.jsx's animation pattern — slides in on
 * mount and, since unmounting is instant with no chance for a CSS animation to play,
 * slides back out first via a local `closing` state before actually calling the parent's
 * onClose/onSaved (which unmounts it).
 */
export default function AddEditContactModal({ listId, editRow, onClose, onSaved, isBlocklist = false }) {
  const isEdit = !!editRow;
  const [contacts, setContacts] = useState(isEdit ? null : [{ ...EMPTY_ROW }]);
  const [email, setEmail] = useState(editRow?.email || '');
  const [firstName, setFirstName] = useState(editRow?.first_name || '');
  const [lastName, setLastName] = useState(editRow?.last_name || '');
  const [phone, setPhone] = useState(editRow?.phone || '');
  const [state, setState] = useState(editRow?.state || '');
  const [country, setCountry] = useState(editRow?.country || '');
  const [city, setCity] = useState(editRow?.city || '');
  const [updateRealTable, setUpdateRealTable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);

  const animateCloseThen = (cb) => {
    if (closing) return;
    setClosing(true);
    setTimeout(cb, CLOSE_ANIM_MS);
  };
  const requestClose = () => !saving && animateCloseThen(onClose);

  const setRow = (i, field, value) => setContacts(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  const addRow = () => setContacts(rows => [...rows, { ...EMPTY_ROW }]);
  const removeRow = (i) => setContacts(rows => rows.filter((_, idx) => idx !== i));

  const submitAdd = async () => {
    const valid = contacts.filter(r => r.email.trim());
    if (valid.length === 0) return toast.error('Enter at least one email address');
    const invalid = valid.find(r => !isValidEmail(r.email));
    if (invalid) return toast.error(`"${invalid.email}" isn't a valid email address`);

    setSaving(true);
    const t = toast.loading(valid.length > 1 ? `Adding ${valid.length} contacts…` : 'Adding contact…');
    let ok = 0, failed = 0;
    for (const r of valid) {
      try {
        const res = await api.post(API, new URLSearchParams({
          action: 'add_contact', list_id: listId, email: r.email.trim(),
          first_name: r.first_name, last_name: r.last_name, phone: r.phone, state: r.state, country: r.country, city: r.city,
          ...(isBlocklist ? { reason: r.reason } : {}),
        }), FORM);
        if (res.data.success) ok++; else failed++;
      } catch { failed++; }
    }
    if (failed === 0) toast.success(ok > 1 ? `${ok} contacts added` : 'Contact added', { id: t });
    else toast.error(`${ok} added, ${failed} failed`, { id: t });
    if (ok > 0) animateCloseThen(onSaved); else setSaving(false);
  };

  const submitEdit = async () => {
    if (!email.trim() || !isValidEmail(email)) return toast.error('Enter a valid email address');
    setSaving(true);
    const t = toast.loading('Saving…');
    try {
      const res = await api.post(API, new URLSearchParams({
        action: 'update_contact', contact_id: editRow.id, email: email.trim(),
        ...(updateRealTable ? { first_name: firstName, last_name: lastName, phone, state, country, city } : {}),
        update_real_table: updateRealTable ? '1' : '0',
      }), FORM);
      if (res.data.success) {
        toast.success(updateRealTable ? 'Saved — also updated the real database record' : 'Saved', { id: t });
        animateCloseThen(onSaved);
      } else { toast.error(res.data.message || 'Could not save', { id: t }); setSaving(false); }
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Network error', { id: t });
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 950, animation: `${closing ? 'nc_fade_out' : 'nc_fade_in'} .22s ease forwards` }}
      onClick={requestClose}>
      <style>{`
        @keyframes nc_fade_in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nc_fade_out { from { opacity: 1; } to { opacity: 0; } }
        @keyframes nc_slide_in_right { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes nc_slide_out_right { from { transform: translateX(0); } to { transform: translateX(100%); } }
        .nc-toggle { position: relative; display: inline-block; width: 38px; height: 22px; flex-shrink: 0; }
        .nc-toggle input { opacity: 0; width: 0; height: 0; }
        .nc-toggle-track { position: absolute; inset: 0; background: #cbd5e1; border-radius: 999px; transition: background .15s; cursor: pointer; }
        .nc-toggle input:checked + .nc-toggle-track { background: #1e3a8a; }
        .nc-toggle-thumb { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; background: #fff; border-radius: 50%; transition: transform .15s; box-shadow: 0 1px 2px rgba(0,0,0,.2); }
        .nc-toggle input:checked ~ .nc-toggle-track .nc-toggle-thumb { transform: translateX(16px); }
      `}</style>
      <div style={{
          position: 'absolute', top: 0, right: 0, height: '100%', width: 480, maxWidth: '92vw',
          background: '#fff', boxShadow: '-12px 0 40px rgba(0,0,0,.18)', padding: 26, overflowY: 'auto', boxSizing: 'border-box',
          animation: `${closing ? 'nc_slide_out_right' : 'nc_slide_in_right'} .3s cubic-bezier(.16,1,.3,1) forwards`,
          fontFamily: "'Plus Jakarta Sans',sans-serif",
        }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{isEdit ? 'Edit contact' : 'Add contact'}</div>
          <button onClick={requestClose} disabled={saving} title="Close"
            style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 18 }}>
          {isEdit ? 'Update this contact\'s details.' : 'Add one or more contacts directly, without a CSV import.'}
        </div>

        {isEdit ? (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Email</label>
              <input style={inp} value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: updateRealTable ? 14 : 4 }}>
              <label className="nc-toggle">
                <input type="checkbox" checked={updateRealTable} onChange={e => setUpdateRealTable(e.target.checked)} />
                <span className="nc-toggle-track"><span className="nc-toggle-thumb" /></span>
              </label>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>Edit real database value also</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {updateRealTable
                    ? 'On — if this email belongs to a registered student, these changes will also update their real record (users.fname/lname/phone/state/country).'
                    : 'Off — only this list\'s own copy is edited (just the email above). The real student record, if any, is left untouched.'}
                </div>
              </div>
            </div>

            {updateRealTable && (
              <>
                <div style={{ ...row2, marginBottom: 14 }}>
                  <div><label style={label}>First name</label><input style={inp} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" /></div>
                  <div><label style={label}>Last name</label><input style={inp} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" /></div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={label}>Phone</label>
                  <input style={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" />
                </div>
                <div style={{ ...row2, marginBottom: 14 }}>
                  <div><label style={label}>State</label><input style={inp} value={state} onChange={e => setState(e.target.value)} placeholder="State" /></div>
                  <div><label style={label}>Country</label><input style={inp} value={country} onChange={e => setCountry(e.target.value)} placeholder="Country" /></div>
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label style={label}>City</label>
                  <input style={inp} value={city} onChange={e => setCity(e.target.value)} placeholder="City" />
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {contacts.map((r, i) => (
              <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 12, position: 'relative' }}>
                {contacts.length > 1 && (
                  <button type="button" onClick={() => removeRow(i)} title="Remove this row"
                    style={{ position: 'absolute', top: 8, right: 8, border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                )}
                <div style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8', letterSpacing: '.4px', marginBottom: 8 }}>CONTACT {i + 1}</div>
                <div style={{ marginBottom: 10 }}>
                  <label style={label}>Email <span style={{ color: '#dc2626' }}>*</span></label>
                  <input style={inp} value={r.email} onChange={e => setRow(i, 'email', e.target.value)} placeholder="name@example.com" autoFocus={i === 0} />
                </div>
                <div style={{ ...row2, marginBottom: 10 }}>
                  <div><label style={label}>First name</label><input style={inp} value={r.first_name} onChange={e => setRow(i, 'first_name', e.target.value)} placeholder="First name" /></div>
                  <div><label style={label}>Last name</label><input style={inp} value={r.last_name} onChange={e => setRow(i, 'last_name', e.target.value)} placeholder="Last name" /></div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={label}>Phone</label>
                  <input style={inp} value={r.phone} onChange={e => setRow(i, 'phone', e.target.value)} placeholder="Phone number" />
                </div>
                <div style={{ ...row2, marginBottom: isBlocklist ? 10 : 0 }}>
                  <div><label style={label}>State</label><input style={inp} value={r.state} onChange={e => setRow(i, 'state', e.target.value)} placeholder="State" /></div>
                  <div><label style={label}>Country</label><input style={inp} value={r.country} onChange={e => setRow(i, 'country', e.target.value)} placeholder="Country" /></div>
                </div>
                {isBlocklist && (
                  <div>
                    <label style={label}>Reason</label>
                    <input style={inp} value={r.reason} onChange={e => setRow(i, 'reason', e.target.value)} placeholder="Why is this contact being blocked? (optional)" />
                  </div>
                )}
              </div>
            ))}
            <button type="button" onClick={addRow}
              style={{ width: '100%', padding: '9px', border: '1.5px dashed #c4b5fd', background: '#f8fafc', color: '#1e3a8a', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 18 }}>
              + Add another contact
            </button>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={requestClose} disabled={saving} style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          <button onClick={isEdit ? submitEdit : submitAdd} disabled={saving}
            style={{ padding: '9px 18px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: saving ? 'wait' : 'pointer', opacity: saving ? .7 : 1 }}>
            {saving ? 'Saving…' : isEdit ? 'Save' : contacts.length > 1 ? `Add ${contacts.length} contacts` : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
