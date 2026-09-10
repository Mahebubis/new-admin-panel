/*
 * src/pages/freshdesk/components/RecipientInput.jsx
 *
 * An address field that suggests people this desk already corresponds with.
 *
 * WHY IT EXISTS: the To field was a plain text input, so every reply to a new
 * address meant retyping it — and one wrong character is a bounce the agent
 * only discovers minutes later. Suggestions come from fd_contacts, i.e. real
 * addresses that have actually written in.
 *
 * The value stays a plain comma-separated STRING rather than a token/chip
 * model. Every caller (reply, forward, new email) already passes a string
 * through parseAddressList on the way out, and a chip widget would mean a
 * second representation to keep in sync for no gain here.
 */

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Mail, Loader2 } from "lucide-react";
import { contacts as contactsApi } from "../fdApi";
import { useClickAway } from "../fdShared";

/** The fragment being typed — everything after the last separator. */
function currentFragment(value) {
  const parts = String(value || "").split(/[,;]/);
  return parts[parts.length - 1].trim();
}

/** Replace that trailing fragment with a chosen address. */
function replaceFragment(value, email) {
  const parts = String(value || "").split(/[,;]/);
  parts[parts.length - 1] = ` ${email}`;
  return parts.join(",").replace(/^[\s,]+/, "") + ", ";
}

const RecipientInput = forwardRef(function RecipientInput({
  value = "",
  onChange,
  placeholder = "name@example.com",
  autoFocus = false,
  id,
}, ref) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [hi, setHi] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const reqRef = useRef(0);

  /* Only focus() and select() are exposed. Handing out the raw node would let
     a caller reach past this component's own suggestion state. */
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current && inputRef.current.focus(),
    select: () => inputRef.current && inputRef.current.select(),
  }), []);

  useClickAway(wrapRef, () => setOpen(false));

  const frag = currentFragment(value);

  /*
   * Debounced lookup.
   *
   * Without the delay this fires a request per keystroke; without the sequence
   * number the responses can land out of order and the list settles on the
   * results for a PREFIX of what is actually in the box.
   */
  useEffect(() => {
    if (frag.length < 2) { setRows([]); setBusy(false); return undefined; }
    const seq = ++reqRef.current;
    setBusy(true);
    const t = setTimeout(() => {
      contactsApi.recipients(frag)
        .then((r) => {
          if (seq !== reqRef.current) return;   // a newer keystroke won
          setRows(r.recipients || []);
          setHi(0);
          setOpen((r.recipients || []).length > 0);
        })
        .catch(() => { if (seq === reqRef.current) setRows([]); })
        .finally(() => { if (seq === reqRef.current) setBusy(false); });
    }, 180);
    return () => clearTimeout(t);
  }, [frag]);

  const choose = useCallback((row) => {
    onChange(replaceFragment(value, row.email));
    setOpen(false);
    setRows([]);
    inputRef.current?.focus();
  }, [onChange, value]);

  const onKeyDown = (e) => {
    if (!open || !rows.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((i) => Math.min(i + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" || e.key === "Tab") {
      // Enter picks the highlighted suggestion rather than submitting the form
      // out from under the agent.
      if (rows[hi]) { e.preventDefault(); choose(rows[hi]); }
    } else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div className="rcpt" ref={wrapRef}>
      <input
        id={id}
        ref={inputRef}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => rows.length && setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {busy && <Loader2 size={14} className="spin rcpt-busy" />}

      {open && rows.length > 0 && (
        <div className="rcpt-menu">
          {rows.map((r, i) => (
            <button
              key={r.email}
              type="button"
              className={`rcpt-row ${i === hi ? "hi" : ""}`}
              onMouseEnter={() => setHi(i)}
              /* onMouseDown, not onClick: onClick fires after blur, and blur
                 closes the menu — so the click would land on nothing. */
              onMouseDown={(e) => { e.preventDefault(); choose(r); }}
            >
              <span className="rcpt-ic"><Mail size={13} /></span>
              <span className="rcpt-txt">
                <b>{r.name}</b>
                <small>{r.email}</small>
              </span>
              {r.tickets > 0 && (
                <span className="rcpt-count">{r.tickets} ticket{r.tickets === 1 ? "" : "s"}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default RecipientInput;
