/*
 * src/pages/freshdesk/components/RichEditor.jsx
 *
 * The reply editor: bold, italic, underline, headings, ordered and unordered
 * lists, quotes, links, and a code span.
 *
 * WHY contentEditable AND NOT A LIBRARY
 * The composer sends HTML email. A textarea can only send plain text, which the
 * server then has to nl2br() into something that looks like formatting -- and
 * that is exactly what produced the wall of blank lines customers were seeing.
 * A full editor framework (Slate, TipTap, Lexical) is 50-150KB for a box that
 * needs seven buttons, in a bundle already carrying recharts and TinyMCE.
 * contentEditable + execCommand covers all of it in every browser this panel
 * supports.
 *
 * execCommand is formally deprecated but has no replacement, is not going
 * anywhere (every major editor still falls back to it), and the alternative is
 * hand-writing Range/Selection surgery for each command. The one thing it is
 * genuinely bad at -- pasted markup from Word and Gmail -- is handled by
 * intercepting paste ourselves, below.
 *
 * THE UNCONTROLLED RULE
 * A contentEditable must never have its innerHTML rewritten by React on each
 * keystroke: setting innerHTML destroys the caret, so the cursor jumps to the
 * start on every character. So this component is UNCONTROLLED. `value` seeds it
 * once per `resetKey`; after that the DOM owns the content and onChange only
 * reports upward.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import {
  Bold, Italic, Underline, Heading1, Heading2, Type,
  List, ListOrdered, Link2, Quote, Code, Eraser,
} from "lucide-react";

/** One toolbar button. `cmd` is the execCommand name; `arg` its value. */
function RteButton({ icon: Ic, title, cmd, arg, onRun, active }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={!!active}
      className={active ? "on" : ""}
      /* onMouseDown + preventDefault, NOT onClick: clicking a button blurs the
         editor and collapses the selection, so by the time onClick fires there
         is nothing selected to format. */
      onMouseDown={(e) => { e.preventDefault(); onRun(cmd, arg); }}
    >
      <Ic size={16} />
    </button>
  );
}

export default function RichEditor({
  value = "",
  onChange,
  placeholder = "",
  resetKey = 0,
  autoFocus = false,
  minHeight = 200,
  onSlashCommand,
  onMention,
  editorRef,
}) {
  const ref = useRef(null);
  const [active, setActive] = useState({});

  /* Seed the DOM once per resetKey. See "THE UNCONTROLLED RULE" above --
     doing this on every value change would fight the caret. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = value || "";
    if (autoFocus) {
      // End of the existing content, so the agent types after the greeting
      // rather than before it.
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      el.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    if (editorRef) editorRef.current = ref.current;
  }, [editorRef]);

  /** Which marks apply at the caret, for the pressed state on the buttons. */
  const syncActive = useCallback(() => {
    if (typeof document.queryCommandState !== "function") return;
    try {
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        insertUnorderedList: document.queryCommandState("insertUnorderedList"),
        insertOrderedList: document.queryCommandState("insertOrderedList"),
      });
    } catch { /* not supported here; the buttons still work, just unlit */ }
  }, []);

  const emit = useCallback(() => {
    const el = ref.current;
    if (el && onChange) onChange(el.innerHTML);
  }, [onChange]);

  const run = useCallback((cmd, arg) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    try {
      if (cmd === "createLink") {
        const url = window.prompt("Link URL", "https://");
        if (!url) return;
        // A bare "example.com" href resolves against the panel's own origin.
        const href = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
        document.execCommand("createLink", false, href);
      } else {
        document.execCommand(cmd, false, arg);
      }
    } catch { /* unsupported command -- leave the content untouched */ }
    syncActive();
    emit();
  }, [emit, syncActive]);

  /*
   * Paste as clean HTML.
   *
   * Word and Gmail paste hundreds of <span style="mso-...">, class attributes
   * and font tags. Left alone they end up in the customer's inbox and, worse,
   * in the quoted history of every later reply. Only a small, known-safe set of
   * tags survives; everything else keeps its text and loses its markup.
   */
  const onPaste = useCallback((e) => {
    const html = e.clipboardData?.getData("text/html");
    const text = e.clipboardData?.getData("text/plain") || "";
    e.preventDefault();

    if (!html) {
      document.execCommand("insertText", false, text);
      emit();
      return;
    }

    const ALLOWED = new Set(["B", "STRONG", "I", "EM", "U", "A", "UL", "OL", "LI", "P", "BR", "H1", "H2", "H3", "BLOCKQUOTE", "CODE", "PRE", "DIV", "SPAN"]);
    const doc = new DOMParser().parseFromString(html, "text/html");

    const clean = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) return;                    // text: keep
        if (child.nodeType !== 1) { child.remove(); return; } // comments etc.
        if (!ALLOWED.has(child.tagName)) {
          // Unwrap rather than delete, so the words survive the formatting.
          while (child.firstChild) node.insertBefore(child.firstChild, child);
          child.remove();
          return;
        }
        [...child.attributes].forEach((a) => {
          const keep = child.tagName === "A" && a.name === "href";
          if (!keep) child.removeAttribute(a.name);
        });
        if (child.tagName === "A") {
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noopener noreferrer");
        }
        clean(child);
      });
    };
    clean(doc.body);

    document.execCommand("insertHTML", false, doc.body.innerHTML);
    emit();
  }, [emit]);

  /*
   * The text immediately before the caret, within its own text node.
   *
   * Deliberately not the editor's whole textContent: the reply seed puts a
   * signature BELOW the caret, so the document's last characters are
   * "...Internship Studio" however much you type in the middle.
   */
  const textBeforeCaret = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return "";
    const r = sel.getRangeAt(0);
    if (!r.collapsed) return "";
    const node = r.startContainer;
    if (!node || node.nodeType !== 3) return "";   // text nodes only
    return String(node.textContent || "").slice(0, r.startOffset);
  };

  const onInput = useCallback((e) => {
    emit();
    syncActive();
    const before = textBeforeCaret();
    // "/c" opens the canned-response picker, same trigger the textarea had.
    if (onSlashCommand && /\/c$/i.test(before)) onSlashCommand();
    /*
     * "@" offers the team, but only at a word boundary -- otherwise every
     * email address typed into a note would open the picker.
     */
    if (onMention && /(^|\s)@$/.test(before)) onMention();
  }, [emit, syncActive, onSlashCommand, onMention]);

  /*
   * Ctrl/Cmd + click opens a link from inside the editor.
   *
   * A contentEditable eats the click so it can put the caret there, which is
   * correct while writing -- but it also means a URL you have just pasted is
   * dead. The modifier is the standard escape hatch and leaves plain clicks
   * doing what they should.
   */
  const onClick = useCallback((e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    e.preventDefault();
    window.open(a.getAttribute("href"), "_blank", "noopener,noreferrer");
  }, []);

  const onKeyDown = useCallback((e) => {
    // Ctrl/Cmd+B / I / U — browsers do these natively in contentEditable, but
    // handling them keeps the toolbar's pressed state in sync.
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "b" || k === "i" || k === "u") {
        e.preventDefault();
        run(k === "b" ? "bold" : k === "i" ? "italic" : "underline");
      }
    }
  }, [run]);

  return (
    <div className="rte-wrap">
      <div className="rte" role="toolbar" aria-label="Formatting">
        <RteButton icon={Bold}      title="Bold (Ctrl+B)"      cmd="bold"                onRun={run} active={active.bold} />
        <RteButton icon={Italic}    title="Italic (Ctrl+I)"    cmd="italic"              onRun={run} active={active.italic} />
        <RteButton icon={Underline} title="Underline (Ctrl+U)" cmd="underline"           onRun={run} active={active.underline} />
        <span className="div" />
        <RteButton icon={Heading1}  title="Heading"            cmd="formatBlock" arg="h2" onRun={run} />
        <RteButton icon={Heading2}  title="Subheading"         cmd="formatBlock" arg="h3" onRun={run} />
        <RteButton icon={Type}      title="Normal text"        cmd="formatBlock" arg="p"  onRun={run} />
        <span className="div" />
        <RteButton icon={List}        title="Bulleted list" cmd="insertUnorderedList" onRun={run} active={active.insertUnorderedList} />
        <RteButton icon={ListOrdered} title="Numbered list" cmd="insertOrderedList"   onRun={run} active={active.insertOrderedList} />
        <RteButton icon={Quote}       title="Quote"         cmd="formatBlock" arg="blockquote" onRun={run} />
        <span className="div" />
        <RteButton icon={Link2}  title="Insert link"      cmd="createLink"   onRun={run} />
        <RteButton icon={Code}   title="Code"             cmd="formatBlock" arg="pre" onRun={run} />
        <RteButton icon={Eraser} title="Clear formatting" cmd="removeFormat" onRun={run} />
      </div>

      <div
        ref={ref}
        className="rte-body"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        style={{ minHeight }}
        onInput={onInput}
        onClick={onClick}
        onKeyUp={syncActive}
        onMouseUp={syncActive}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={emit}
      />
    </div>
  );
}
