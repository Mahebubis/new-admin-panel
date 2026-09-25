/*
 * Kumo — a text field with an attribute picker underneath.
 *
 * Clone of src/pages/netcore/AttributePicker.jsx: the small person-icon button
 * appears under the input while it is focused, opens a searchable popover of the
 * attributes from Audience → Attributes, and inserting one splices its [NAME]
 * token in at the cursor. The popover stays open so several can be chained into
 * the same field.
 *
 * Used on Sender name, Subject, Pre-header and Reply-To in the Content step —
 * every place Netcore offers the same picker.
 */
import { useEffect, useRef, useState } from 'react';
import { insertTokenAtCursor } from './kumoMergeTags';

const inputStyle = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
  fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box',
};
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 };

export default function KumoAttributeField({
  label, value, onChange, placeholder, required, hint,
  tags = [], identityTags = [], onBlurValue,
}) {
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setFocused(false); setSearch(''); }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const insert = (token) => insertTokenAtCursor(inputRef.current, token, value || '', onChange);

  const q = search.trim().toLowerCase();
  const match = (t) => t.title.toLowerCase().includes(q) || t.value.toLowerCase().includes(q);
  const attrs = tags.filter(match);
  const fixed = identityTags.filter(match);

  const Item = ({ t }) => (
    <button key={t.value} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(t.value)}
      style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: 10,
        padding: '8px 10px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12.5, color: '#334155',
        borderRadius: 6, fontFamily: 'inherit', textAlign: 'left' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
      <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>+ Insert</span>
    </button>
  );

  return (
    <div ref={wrapRef}>
      {label && <label style={labelStyle}>{label}{required && <span style={{ color: '#dc2626' }}> *</span>}</label>}
      <input
        ref={inputRef}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { onBlurValue?.(); setTimeout(() => { if (!open) setFocused(false); }, 120); }}
        placeholder={placeholder}
        style={inputStyle}
      />
      {hint && <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 5 }}>{hint}</div>}

      {/* In normal flow, not absolutely positioned, so it always sits right under
          the input whether or not a hint is present. */}
      {(focused || open) && (
        <div style={{ position: 'relative', display: 'inline-block', marginTop: 4 }}>
          <button type="button" title="Insert an attribute"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpen((o) => !o)}
            style={{ width: 24, height: 24, borderRadius: 6,
              border: `1px solid ${open ? '#1e3a8a' : '#e2e8f0'}`, background: open ? '#eef2ff' : '#fff',
              color: open ? '#1e3a8a' : '#64748b', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </button>

          {open && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: 250, background: '#fff',
              border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 10px 28px rgba(0,0,0,.14)', zIndex: 60, padding: 8 }}>
              <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
                style={{ width: '100%', padding: '7px 9px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12,
                  marginBottom: 6, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#1e3a8a', letterSpacing: '.4px', padding: '2px 4px 6px' }}>
                  YOUR ATTRIBUTES ({tags.length}) — click to insert
                </div>
                {attrs.length === 0 && (
                  <div style={{ padding: '6px 4px 10px', fontSize: 11.5, color: '#94a3b8' }}>
                    {tags.length === 0 ? 'None created yet — add one in Audience → Attributes.' : 'No matches'}
                  </div>
                )}
                {attrs.map((t) => <Item key={t.value} t={t} />)}

                {fixed.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '.4px',
                      padding: '10px 4px 6px', borderTop: '1px solid #f1f5f9', marginTop: 6 }}>
                      BUILT-IN
                    </div>
                    {fixed.map((t) => <Item key={t.value} t={t} />)}
                  </>
                )}
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 4, paddingTop: 6, textAlign: 'right' }}>
                <button type="button" onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setOpen(false); setFocused(false); setSearch(''); }}
                  style={{ border: 'none', background: 'none', color: '#1e3a8a', fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: '4px 8px' }}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
