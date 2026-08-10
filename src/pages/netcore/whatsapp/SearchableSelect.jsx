import { useEffect, useMemo, useRef, useState } from 'react';

/*
 * The searchable dropdown used everywhere in the WhatsApp builder — template picker, business
 * number, language, attribute picker, dedup window.
 *
 * One component rather than a per-field variant, because the interaction has to be identical
 * in all of them: click to open, type to filter, arrow keys to move, Enter to choose, Esc to
 * close, click-outside to dismiss. `renderRow` is what lets the same control show a plain
 * label in one place and a rich two-line row (template name + category + approval badge) in
 * another without forking the behaviour.
 */
export default function SearchableSelect({
  value,
  onChange,
  options,                 // [{ value, label, sublabel?, meta?, disabled? }]
  placeholder = 'Select',
  searchPlaceholder = 'Search',
  renderRow,               // optional (option, isSelected) => node
  renderValue,             // optional (option) => node
  emptyText = 'No matches',
  footer,                  // optional node pinned under the list (e.g. "+ Create new")
  disabled,
  width,
  maxHeight = 260,
  style,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState(0);
  const ref = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o =>
      String(o.label || '').toLowerCase().includes(q) ||
      String(o.sublabel || '').toLowerCase().includes(q) ||
      String(o.value || '').toLowerCase().includes(q));
  }, [options, search]);

  const current = options.find(o => String(o.value) === String(value));

  // The highlight is reset wherever the visible set actually changes (typing, opening) rather
  // than from an effect watching it — an effect here would be a cascading render, and this way
  // Enter can never pick a row that has scrolled out of the filtered list.
  const onSearchChange = (v) => { setSearch(v); setCursor(0); };

  const pick = (opt) => {
    if (!opt || opt.disabled) return;
    onChange(opt.value, opt);
    setOpen(false);
    setSearch('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(filtered[cursor]); }
    else if (e.key === 'Escape') { setOpen(false); setSearch(''); }
  };

  // Keeps the keyboard-highlighted row inside the scroll viewport.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${cursor}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [cursor, open]);

  return (
    <div ref={ref} style={{ position: 'relative', width: width || '100%', ...style }}>
      <button type="button" disabled={disabled} onClick={() => { setOpen(o => !o); setCursor(0); }}
        style={{
          width: '100%', padding: '10px 12px', border: `1.5px solid ${open ? '#1e3a8a' : '#e2e8f0'}`, borderRadius: 8,
          fontSize: 12.5, fontFamily: 'inherit', background: disabled ? '#f8fafc' : '#fff', textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', gap: 8, color: current ? '#1e293b' : '#94a3b8', boxSizing: 'border-box',
        }}>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current ? (renderValue ? renderValue(current) : current.label) : placeholder}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2.4}
          style={{ flexShrink: 0, transform: `rotate(${open ? 180 : 0}deg)`, transition: 'transform .15s' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 12px 28px rgba(15,23,42,.14)', zIndex: 80, overflow: 'hidden' }}>
          <div style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ position: 'relative' }}>
              <input autoFocus value={search} onChange={e => onSearchChange(e.target.value)} onKeyDown={onKeyDown}
                placeholder={searchPlaceholder}
                style={{ width: '100%', padding: '8px 30px 8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          <div ref={listRef} style={{ maxHeight, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>{emptyText}</div>
            )}
            {filtered.map((o, i) => {
              const isSel = String(o.value) === String(value);
              const isCursor = i === cursor;
              return (
                <div key={`${o.value}-${i}`} data-idx={i} onClick={() => pick(o)} onMouseEnter={() => setCursor(i)}
                  style={{
                    padding: renderRow ? '9px 12px' : '9px 12px', cursor: o.disabled ? 'not-allowed' : 'pointer',
                    background: isSel ? '#eef2ff' : isCursor ? '#f8fafc' : 'transparent',
                    borderLeft: `3px solid ${isSel ? '#1e3a8a' : 'transparent'}`,
                    opacity: o.disabled ? .45 : 1, fontSize: 12.5, color: '#334155',
                  }}>
                  {renderRow ? renderRow(o, isSel) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontWeight: isSel ? 700 : 500, color: isSel ? '#1e3a8a' : '#334155' }}>{o.label}</span>
                      {o.sublabel && <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>{o.sublabel}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {footer && <div style={{ borderTop: '1px solid #f1f5f9', padding: 8, background: '#f8fafc' }}>{footer}</div>}
        </div>
      )}
    </div>
  );
}
