/*
 * Kumo — "Create list" modal.
 *
 * Clone of src/pages/netcore/CreateListModal.jsx: same 440px card, same copy,
 * the same name validation, and the same "Save & Add Contact" button that drops
 * the user straight into the import wizard. Doubles as the rename dialog — pass
 * a `list` row and it PUTs through the very same `list_save` action with an id.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { kapi } from './kumoShared';

const inp = { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box' };
const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 };

export default function KumoCreateListModal({ list = null, onClose, onSaved }) {
  const isEdit = !!(list && list.id);
  const [name, setName] = useState(list?.name || '');
  const [description, setDescription] = useState(list?.description || '');
  const [saving, setSaving] = useState(false);

  const validName = /^[a-zA-Z0-9 _&-]*$/.test(name);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return toast.error('List name is required');
    if (!validName) return toast.error('Only letters, numbers, spaces, underscores, hyphens, and ampersands are allowed');

    setSaving(true);
    const t = toast.loading(isEdit ? 'Saving…' : 'Creating list…');
    try {
      const d = await kapi('list_save', isEdit
        ? { id: list.id, name: trimmed, description }
        : { name: trimmed, description });
      toast.success(isEdit ? 'List updated' : 'List created', { id: t });
      onSaved(d.id || list?.id, !isEdit);
    } catch (e) {
      toast.error(e.message || 'Could not save list', { id: t });
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={() => !saving && onClose()}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 26, width: 440, fontFamily: "'Plus Jakarta Sans',sans-serif" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{isEdit ? 'Rename list' : 'Create list'}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 18 }}>
          {isEdit ? 'Update the name or description — the contacts in it are untouched.' : "Give your contact list a name — you'll import a CSV into it next."}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>List name <span style={{ color: '#dc2626' }}>*</span></label>
          <input style={inp} value={name} maxLength={100} onChange={e => setName(e.target.value)}
            placeholder="e.g. July 2026 Leads" autoFocus onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
          <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>
            Only alphanumeric characters, space, underscores (_), hyphen (-), and ampersands (&amp;) are allowed. {name.length}/100
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={label}>Description <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional)</span></label>
          <input style={inp} value={description} maxLength={100} onChange={e => setDescription(e.target.value)} placeholder="What is this list for?" />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={saving} style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={saving}
            style={{ padding: '9px 18px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: saving ? 'wait' : 'pointer', opacity: saving ? .7 : 1 }}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save & Add Contact'}
          </button>
        </div>
      </div>
    </div>
  );
}
