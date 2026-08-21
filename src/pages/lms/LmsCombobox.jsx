// ===========================================================================
//  LmsCombobox.jsx — the searchable select used by every "which product?"
//  picker in the LMS.
//
//  A plain <select> is unusable once the list passes ~20 entries, and the
//  internship catalogue alone is 31 before the ₹99 courses are added. This is
//  the Chakra/MUI-style autocomplete: type to filter, arrow keys to move,
//  Enter to pick, Escape to close, grouped headings, and — when `allowCustom`
//  is on — whatever the admin typed is offered as its own option so a product
//  that is not in either catalogue can still be entered.
//
//  Deliberately dependency-free: the panel ships no combobox library, and one
//  file of focus handling is cheaper than adding downshift to the bundle.
// ===========================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

/**
 * @param options  [{ name, group? }] or plain strings
 * @param value    the selected name ('' = nothing chosen)
 * @param onChange (name) => void
 * @param allowCustom  offer the typed text as a pickable option
 */
export default function LmsCombobox({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Type to search…',
  emptyLabel = 'Nothing matches',
  allowCustom = false,
  clearable = true,
  disabled = false,
  id,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const items = useMemo(
    () => options.map(o => (typeof o === 'string' ? { name: o, group: '' } : o)).filter(o => o?.name),
    [options]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    /* Rank exact prefix matches above mid-string ones — typing "hr" should
       reach "HR Interview" before "Cyber Security Internship". */
    const starts = [];
    const contains = [];
    for (const it of items) {
      const n = it.name.toLowerCase();
      if (n.startsWith(q)) starts.push(it);
      else if (n.includes(q)) contains.push(it);
    }
    return [...starts, ...contains];
  }, [items, query]);

  /* The typed text becomes an option of its own when it matches nothing in
     either catalogue — that is the "custom internship name" escape hatch. */
  const custom = allowCustom
    && query.trim() !== ''
    && !items.some(i => i.name.toLowerCase() === query.trim().toLowerCase())
    ? query.trim()
    : '';

  const rows = useMemo(() => {
    const out = [];
    if (custom) out.push({ kind: 'custom', name: custom });
    let lastGroup = null;
    for (const it of filtered) {
      if (it.group && it.group !== lastGroup) {
        out.push({ kind: 'group', name: it.group });
        lastGroup = it.group;
      }
      out.push({ kind: 'option', name: it.name });
    }
    return out;
  }, [filtered, custom]);

  const pickable = rows.filter(r => r.kind !== 'group');

  /* cursor is clamped at render rather than corrected in an effect: the list
     shrinks as you type, and an effect that fixed it afterwards would paint
     one frame with the highlight out of range (and cost a second render). */
  const active = pickable.length ? Math.min(cursor, pickable.length - 1) : 0;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    /* Focus after paint, or the click that opened the list steals it back. */
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  /* Keep the highlighted row in view while arrowing through a long list. */
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector('[data-active="1"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (name) => { onChange?.(name); setOpen(false); };
  const toggle = () => {
    setOpen(o => !o);
    setQuery('');
    setCursor(0);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!pickable.length) return;
      const next = e.key === 'ArrowDown' ? active + 1 : active - 1;
      setCursor((next + pickable.length) % pickable.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = pickable[active];
      if (hit) choose(hit.name);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  let pickIndex = -1;

  return (
    <div className="lms-combo" ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`lms-combo-control${open ? ' open' : ''}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && toggle()}
      >
        <span className={`lms-combo-value${value ? '' : ' placeholder'}`}>{value || placeholder}</span>
        {clearable && value && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear"
            className="lms-combo-clear"
            onClick={(e) => { e.stopPropagation(); onChange?.(''); }}
          >
            <X size={13} />
          </span>
        )}
        <ChevronDown size={15} className="lms-combo-caret" />
      </button>

      {open && (
        <div className="lms-combo-pop">
          <div className="lms-combo-search">
            <Search size={14} />
            <input
              ref={inputRef}
              value={query}
              placeholder={searchPlaceholder}
              onChange={e => { setQuery(e.target.value); setCursor(0); }}
              onKeyDown={onKeyDown}
            />
          </div>

          <div className="lms-combo-list" ref={listRef} role="listbox">
            {rows.length === 0 && <div className="lms-combo-empty">{emptyLabel}</div>}

            {rows.map((r, i) => {
              if (r.kind === 'group') {
                return <div className="lms-combo-group" key={`g${i}`}>{r.name}</div>;
              }
              pickIndex += 1;
              const isActive = pickIndex === active;
              const selected = r.name === value;
              return (
                <button
                  type="button"
                  key={`${r.kind}${i}`}
                  role="option"
                  aria-selected={selected}
                  data-active={isActive ? '1' : '0'}
                  className={`lms-combo-item${isActive ? ' active' : ''}${selected ? ' selected' : ''}`}
                  onMouseEnter={() => setCursor(pickIndex)}
                  onClick={() => choose(r.name)}
                >
                  <span className="t">
                    {r.kind === 'custom' ? <>Use <b>{r.name}</b></> : r.name}
                  </span>
                  {selected && <Check size={14} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
