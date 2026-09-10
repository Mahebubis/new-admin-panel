import { useEffect, useRef, useState } from 'react';

/*
 * Shared look-and-feel for the attribute create/edit drawer and the lookup-chain builder
 * it embeds. Pulled out of CreateAttributeModal.jsx so both files style their inputs and
 * dropdowns from one place instead of the builder growing a second, slightly-different set.
 */

export const API = '/api/attributes/attributes.php';
export const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

export const inp = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
  fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box',
};
export const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 };
export const hintText = { fontSize: 10.5, color: '#94a3b8', marginTop: 4 };
export const req = <span style={{ color: '#dc2626' }}>*</span>;

/**
 * Closed-by-default dropdown that opens a searchable popover on click — used for every
 * dropdown in this feature so they all behave the same way instead of some being plain
 * <select>s and others always-expanded inline lists.
 *
 * `onSearch` turns it into a REMOTE picker: instead of filtering `options` locally it calls
 * onSearch(term) (debounced) and lists whatever comes back, which is what the table picker
 * needs — there are far too many tables to ship the whole list to the browser.
 */
export function SearchDropdown({
  buttonLabel, buttonPlaceholder, options = [], getKey, getLabel, renderOption, isSelected,
  onPick, searchPlaceholder, emptyText, onSearch, disabled, minChars = 2, compact,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [remote, setRemote] = useState([]);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  useEffect(() => {
    if (!onSearch) return;
    clearTimeout(debounceRef.current);
    if (search.trim().length < minChars) { setRemote([]); return; }
    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      try { setRemote(await onSearch(search.trim()) || []); } finally { setBusy(false); }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, onSearch, minChars]);

  const list = onSearch ? remote : options.filter(o => getLabel(o).toLowerCase().includes(search.toLowerCase()));
  const box = compact ? { ...inp, padding: '7px 10px', fontSize: 12 } : inp;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" disabled={disabled} onClick={() => setOpen(o => !o)}
        style={{
          ...box, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
          cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
          color: buttonLabel ? '#1e293b' : '#94a3b8', background: disabled ? '#f8fafc' : '#fff',
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{buttonLabel || buttonPlaceholder}</span>
        <span style={{ color: '#94a3b8', fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 10px 28px rgba(0,0,0,.14)', zIndex: 60, padding: 8, minWidth: 220 }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={searchPlaceholder}
            style={{ width: '100%', padding: '7px 9px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, marginBottom: 6, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {busy ? (
              <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>Searching…</div>
            ) : (onSearch && search.trim().length < minChars) ? (
              <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>Type at least {minChars} characters…</div>
            ) : list.length === 0 ? (
              <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>{emptyText || 'No matches'}</div>
            ) : list.map(o => (
              <button key={getKey(o)} type="button" onClick={() => { onPick(o); setOpen(false); setSearch(''); }}
                style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: 10, textAlign: 'left', padding: '8px 10px', border: 'none', background: isSelected?.(o) ? '#eef2ff' : 'none', cursor: 'pointer', fontSize: 12.5, borderRadius: 6, fontFamily: 'inherit', color: '#334155' }}
                onMouseEnter={e => { if (!isSelected?.(o)) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={e => { if (!isSelected?.(o)) e.currentTarget.style.background = 'transparent'; }}>
                {renderOption(o)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
