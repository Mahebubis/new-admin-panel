/*
 * Kumo — add contacts to a list by hand, without a CSV.
 *
 * Clone of src/pages/netcore/AddEditContactModal.jsx in its add mode: the same
 * right-side drawer, the same "CONTACT n" cards, the same dashed "+ Add another
 * contact" row and the same slide-out-before-unmount close, so the habit carries
 * over from Netcore. The field set stops at what kumo_contacts stores — Netcore's
 * state/country/city have no column here.
 *
 * One kapi('contact_save') call per row: it upserts into kumo_contacts and, with
 * list_id, adds the contact to the list in the same request.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { kapi } from './kumoShared';

const CLOSE_ANIM_MS = 240;
const EMPTY_ROW = { email: '', first_name: '', last_name: '', phone: '' };

const inp = { width: '100%', padding: '9px 11px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box' };
const label = { display: 'block', fontSize: 11.5, fontWeight: 700, color: '#0f172a', marginBottom: 5 };
const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim());

export default function KumoAddContactDrawer({ listId, listName, onClose, onSaved }) {
  const [rows, setRows] = useState([{ ...EMPTY_ROW }]);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);

  const animateCloseThen = (cb) => {
    if (closing) return;
    setClosing(true);
    setTimeout(cb, CLOSE_ANIM_MS);
  };
  const requestClose = () => !saving && animateCloseThen(onClose);

  const setField = (i, field, value) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const addRow = () => setRows((rs) => [...rs, { ...EMPTY_ROW }]);
  const dropRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const submit = async () => {
    const valid = rows.filter((r) => String(r.email || '').trim());
    if (valid.length === 0) { toast.error('Enter at least one email address'); return; }
    const bad = valid.find((r) => !isValidEmail(r.email));
    if (bad) { toast.error(`"${bad.email}" isn't a valid email address`); return; }

    /* Two rows with the same address would upsert onto each other and report a
       success count higher than the list actually grew. */
    const seen = new Set();
    const dupe = valid.find((r) => {
      const e = String(r.email).trim().toLowerCase();
      if (seen.has(e)) return true;
      seen.add(e);
      return false;
    });
    if (dupe) { toast.error(`"${dupe.email}" is listed twice`); return; }

    setSaving(true);
    const t = toast.loading(valid.length > 1 ? `Adding ${valid.length} contacts…` : 'Adding contact…');
    let ok = 0; let failed = 0; let firstError = '';
    for (const r of valid) {
      try {
        await kapi('contact_save', {
          email: String(r.email).trim(),
          first_name: r.first_name || '',
          last_name: r.last_name || '',
          phone: r.phone || '',
          list_id: listId,
        });
        ok += 1;
      } catch (e) {
        failed += 1;
        if (!firstError) firstError = e?.message || '';
      }
    }
    if (failed === 0) toast.success(ok > 1 ? `${ok} contacts added` : 'Contact added', { id: t });
    else toast.error(`${ok} added, ${failed} failed${firstError ? ` — ${firstError}` : ''}`, { id: t });

    if (ok > 0) animateCloseThen(onSaved); else setSaving(false);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 950, animation: `${closing ? 'kmac_fade_out' : 'kmac_fade_in'} .22s ease forwards` }}
      onClick={requestClose}
    >
      <style>{`
        @keyframes kmac_fade_in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes kmac_fade_out { from { opacity: 1 } to { opacity: 0 } }
        @keyframes kmac_slide_in { from { transform: translateX(100%) } to { transform: translateX(0) } }
        @keyframes kmac_slide_out { from { transform: translateX(0) } to { transform: translateX(100%) } }
      `}</style>

      <div
        style={{
          position: 'absolute', top: 0, right: 0, height: '100%', width: 480, maxWidth: '92vw',
          background: '#fff', boxShadow: '-12px 0 40px rgba(0,0,0,.18)', padding: 26, overflowY: 'auto', boxSizing: 'border-box',
          animation: `${closing ? 'kmac_slide_out' : 'kmac_slide_in'} .3s cubic-bezier(.16,1,.3,1) forwards`,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Add contact</div>
          <button onClick={requestClose} disabled={saving} title="Close"
            style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 18 }}>
          Add one or more contacts to {listName ? <b style={{ color: '#475569' }}>{listName}</b> : 'this list'} directly, without a CSV import.
        </div>

        {rows.map((r, i) => (
          <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 12, position: 'relative' }}>
            {rows.length > 1 && (
              <button type="button" onClick={() => dropRow(i)} title="Remove this row"
                style={{ position: 'absolute', top: 8, right: 8, border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
            )}
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8', letterSpacing: '.4px', marginBottom: 8 }}>CONTACT {i + 1}</div>
            <div style={{ marginBottom: 10 }}>
              <label style={label}>Email <span style={{ color: '#dc2626' }}>*</span></label>
              <input style={inp} value={r.email} onChange={(e) => setField(i, 'email', e.target.value)}
                placeholder="name@example.com" autoFocus={i === 0} />
            </div>
            <div style={{ ...row2, marginBottom: 10 }}>
              <div><label style={label}>First name</label><input style={inp} value={r.first_name} onChange={(e) => setField(i, 'first_name', e.target.value)} placeholder="First name" /></div>
              <div><label style={label}>Last name</label><input style={inp} value={r.last_name} onChange={(e) => setField(i, 'last_name', e.target.value)} placeholder="Last name" /></div>
            </div>
            <div>
              <label style={label}>Phone</label>
              <input style={inp} value={r.phone} onChange={(e) => setField(i, 'phone', e.target.value)} placeholder="Phone number" />
            </div>
          </div>
        ))}

        <button type="button" onClick={addRow}
          style={{ width: '100%', padding: 9, border: '1.5px dashed #c4b5fd', background: '#f8fafc', color: '#1e3a8a', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 18 }}>
          + Add another contact
        </button>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={requestClose} disabled={saving}
            style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={saving}
            style={{ padding: '9px 18px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : rows.length > 1 ? `Add ${rows.length} contacts` : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
