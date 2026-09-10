import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

/**
 * A searchable dropdown.
 *
 * WHY NOT A NATIVE <select>
 * The Assign dialog listed every ticket in a native select. With hundreds of
 * rows the browser builds the whole popup on the click, which is the pause the
 * dialog was showing, and a native list cannot be searched by anything but
 * first-letter typeahead -- useless when every entry starts with "#33". So the
 * picker is a real combobox: type a ticket number, a name, a subject or an
 * email address and it narrows as you type.
 *
 * SMOOTHNESS
 * Two things keep it instant no matter how long the list is:
 *   - only the first MAX_ROWS matches are rendered (the rest are reachable by
 *     typing, which is the point of having a search box), and
 *   - the search text lives in local state, so a keystroke re-renders this
 *     component alone rather than the dialog that owns the selection.
 *
 * `options` are `{ value, label, sub, hint, search }`. `search` is the haystack;
 * when it is absent, label + sub are used.
 */

const MAX_ROWS = 60;

export function SearchSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches",
  disabled = false,
  id,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)) || null,
    [options, value]
  );

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options.slice(0, MAX_ROWS);
    // "#337811" and "337811" must both find the same ticket.
    const bare = needle.replace(/^#/, "");
    const out = [];
    for (let i = 0; i < options.length && out.length < MAX_ROWS; i++) {
      const o = options[i];
      const hay = (o.search || `${o.label || ""} ${o.sub || ""}`).toLowerCase();
      if (hay.includes(needle) || (bare && hay.includes(bare))) out.push(o);
    }
    return out;
  }, [options, q]);

  const total = q.trim() ? null : options.length;

  /* Close on an outside click or Escape. */
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  /* Focus the search box as the panel appears, and start from a clean query. */
  useEffect(() => {
    if (!open) return;
    setQ("");
    setHi(0);
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [open]);

  /* Keep the highlighted row in view while arrowing through a long list. */
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-i="${hi}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [hi, open]);

  const pick = (o) => { onChange(o.value, o); setOpen(false); };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((i) => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (matches[hi]) pick(matches[hi]); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
  };

  return (
    <div className={`ssel ${open ? "open" : ""}`} ref={wrapRef}>
      <button
        type="button"
        id={id}
        className="ssel-btn"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`ssel-val ${selected ? "" : "ph"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={15} className="ssel-caret" />
      </button>

      {open && (
        <div className="ssel-panel">
          <div className="ssel-search">
            <Search size={14} />
            <input
              ref={inputRef}
              value={q}
              placeholder={searchPlaceholder}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => { setQ(e.target.value); setHi(0); }}
              onKeyDown={onKeyDown}
            />
            {q && (
              <button type="button" className="ssel-clear" onClick={() => { setQ(""); inputRef.current?.focus(); }}>
                <X size={13} />
              </button>
            )}
          </div>

          <div className="ssel-list" ref={listRef}>
            {matches.length === 0 ? (
              <div className="ssel-empty">{emptyText}</div>
            ) : matches.map((o, i) => {
              const on = String(o.value) === String(value);
              return (
                <button
                  key={String(o.value)}
                  type="button"
                  data-i={i}
                  className={`ssel-row ${i === hi ? "hi" : ""} ${on ? "on" : ""}`}
                  onMouseEnter={() => setHi(i)}
                  onClick={() => pick(o)}
                >
                  <span className="ssel-txt">
                    <b>{o.label}</b>
                    {o.sub ? <small>{o.sub}</small> : null}
                  </span>
                  {o.hint ? <span className="ssel-hint">{o.hint}</span> : null}
                  {on ? <Check size={14} className="ssel-tick" /> : null}
                </button>
              );
            })}
          </div>

          {/* Say so when the list is capped, or a missing row looks like a bug. */}
          {total !== null && total > matches.length && (
            <div className="ssel-foot">
              Showing {matches.length} of {total.toLocaleString("en-IN")} — type to search the rest
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchSelect;
