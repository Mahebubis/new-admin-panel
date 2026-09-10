/*
 * src/pages/freshdesk/pages/TicketDetailPage.jsx
 *
 * One conversation: the real message thread from the mailbox, the reply /
 * note / forward composer with S3-backed attachments, and the ticket's
 * properties.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertCircle, ArrowUpDown, AtSign, BadgeCheck, Bold, BookOpen, Briefcase, Building2, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, Code, Copy, CornerUpLeft, Download, Eye, Folder, FolderInput, Forward, GraduationCap, Heading1, Heading2, History, Image as ImageIcon, Italic, Link2, List, ListOrdered, Lock, Mail, Maximize2, MessageSquareText, Minus, MoreHorizontal, PanelLeftClose, PanelLeftOpen, PanelRight, PanelRightClose, PanelRightOpen, Paperclip, Pencil, PhoneCall, Plus, PlusCircle, Printer, RefreshCw, Reply, Save, Search, Send, ShieldX, Sparkles, Star, Table as TableIcon, Tag as TagIcon, Ticket, Timer, Trash2, Type, Underline, UserPlus, X } from "lucide-react";
import { ConfirmDialog, EmptyState, PrioBadge, Spinner, StatusBadge, Switch, fireConfetti, humanBytes, kvGetSync, kvSet, useClickAway, useDesk, useToast } from "../fdShared";
import { attachments as fdAttachments, fdUrl, messages as fdMessages, tickets as fdTicketsApi } from "../fdApi";
import RichEditor from "../components/RichEditor";
import RecipientInput from "../components/RecipientInput";
import AttachmentPreview, { ICON as ATT_ICON, KIND_COLOR as ATT_COLOR, kindOf } from "../components/AttachmentPreview";
import { AGENTS, DEPTS, SOURCE_ICON, STU_DOMAINS, STU_ENUMS, TAG_BANK, avColor, bodyFor, initials, slaStyle, stuDateDisplay, stuDomainLabel, stuMachine, stuPills, hasStudentContext } from "../fdConstants";
import { getCallsSeed } from "../fdStore";
import { CANNED_SEED } from "./AutomationPage";
import { currentAgentProfile, getSigSettings, resolveSignature } from "../fdAgent";

/*
 * Canned responses, loaded once per session.
 *
 * Module-level rather than component state: the picker is mounted and unmounted
 * every time "/c" is typed, and re-fetching the list on each keystroke-triggered
 * open would be a request per attempt.
 */
let _cannedCache = null;
let _cannedInFlight = null;

function useCanned() {
  const [rows, setRows] = useState(_cannedCache || []);
  const [loading, setLoading] = useState(!_cannedCache);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (_cannedCache) return undefined;
    let alive = true;
    _cannedInFlight = _cannedInFlight || fdMessages.canned();
    _cannedInFlight
      .then((res) => {
        // folder_id -> folder name, so each row can name its own folder.
        const byId = {};
        (res.folders || []).forEach((f) => { byId[Number(f.id)] = f.name; });
        _cannedCache = (res.responses || []).map((r) => ({
          id: r.id,
          name: r.name,
          folder: byId[Number(r.folder_id)] || r.category || "Unfiled",
          body: r.body || "",
          uses: Number(r.uses) || 0,
          shortcut: r.shortcut || "",
        }));
        if (alive) { setRows(_cannedCache); setLoading(false); }
      })
      .catch((err) => {
        _cannedInFlight = null;           // let the next open retry
        if (alive) { setError(err.message); setLoading(false); }
      });
    return () => { alive = false; };
  }, []);

  return { rows, loading, error };
}

/*
 * The team, for "@" inside a note.
 *
 * Reads the same admin_users list the assignee picker uses, through the desk
 * store, so there is one definition of "who works here" rather than two that
 * can drift.
 */
function MentionPopup({ query, setQuery, onPick, onClose }) {
  const desk = useDesk();
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { if (desk.ensureAgents) desk.ensureAgents(); }, [desk]);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setHi(0); }, [query]);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = (desk.agents || []).filter((a) => a.name && a.name !== "Unassigned");
    if (!q) return all.slice(0, 8);
    return all.filter((a) => (a.name + " " + (a.email || "")).toLowerCase().includes(q)).slice(0, 8);
  }, [desk.agents, query]);

  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setHi((i) => Math.min(i + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (list[hi]) onPick(list[hi]); }
  };

  return (
    <div className="canned-pop mention-pop" ref={ref} onKeyDown={onKey}>
      <div className="cp-search">
        <AtSign size={15} color="var(--muted)" />
        <input ref={inputRef} placeholder="Search your team" value={query}
               onChange={(e) => setQuery(e.target.value)} />
        <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={onClose}><X size={14} /></button>
      </div>
      <div className="cp-list">
        {list.length ? list.map((a, i) => (
          <div key={a.id ?? a.name} className={`cp-item ${i === hi ? "hi" : ""}`}
               onMouseEnter={() => setHi(i)} onClick={() => onPick(a)}>
            <span className="men-av" style={{ background: avColor(a.name) }}>{initials(a.name)}</span>
            <div style={{ minWidth: 0 }}>
              <div className="cp-nm">{a.name}</div>
              {a.email && <div className="men-mail">{a.email}</div>}
            </div>
            {a.role && <span className="men-role">{a.role}</span>}
          </div>
        )) : <div className="cp-empty">No teammate matches “{query}”.</div>}
      </div>
    </div>
  );
}

function CannedPopup({ query, setQuery, onPick, onClose }) {
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  const inputRef = useRef(null);
  const { rows, loading, error } = useCanned();
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.name + " " + r.folder + " " + r.shortcut + " " + r.body).toLowerCase().includes(q));
  }, [rows, query]);

  /*
   * Grouped by folder for display, but the flat list is what survives, so the
   * arrow keys and the highlighted index keep working across the whole result.
   */
  const groups = useMemo(() => {
    const out = [];
    const seen = new Map();
    list.forEach((r, i) => {
      const key = r.folder || "Unfiled";
      if (!seen.has(key)) { seen.set(key, out.length); out.push({ folder: key, items: [] }); }
      out[seen.get(key)].items.push({ r, i });
    });
    return out;
  }, [list]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setHi(0); }, [query]);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setHi(i => Math.min(i + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (list[hi]) onPick(list[hi]); }
  };

  return (
    <div className="canned-pop" ref={ref} onKeyDown={onKey}>
      <div className="cp-search">
        <Search size={16} color="var(--muted)" />
        <input ref={inputRef} placeholder="Search for canned responses" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={onClose}><X size={14} /></button>
      </div>
      <div className="cp-lab">{query.trim() ? "Results" : "Most used"}</div>
      <div className="cp-list">
        {loading ? (
          <div className="cp-empty"><Spinner size={14} /> Loading your saved replies…</div>
        ) : error ? (
          <div className="cp-empty">Could not load canned responses: {error}</div>
        ) : list.length ? groups.map((g) => (
          <div key={g.folder} className="cp-group">
            <div className="cp-folder"><Folder size={11} /> {g.folder} <span>{g.items.length}</span></div>
            {g.items.map(({ r, i }) => (
              <div key={r.id ?? r.name} className={`cp-item ${i === hi ? "hi" : ""}`}
                   onMouseEnter={() => setHi(i)} onClick={() => onPick(r)}>
                <MessageSquareText size={15} color="var(--primary)" style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div className="cp-nm">
                    {r.name}
                    {r.shortcut ? <code className="cp-sc">/{r.shortcut}</code> : null}
                  </div>
                  {/* The first line of the reply, so a name like "Refund policy"
                      does not have to be trusted blind. */}
                  <div className="cp-pv">{String(r.body || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 90)}</div>
                </div>
              </div>
            ))}
          </div>
        )) : (
          <div className="cp-empty">
            {rows.length === 0
              ? "No canned responses saved yet — add them under Automation."
              : `No canned responses match “${query}”.`}
          </div>
        )}
      </div>
    </div>
  );
}

function ReplyComposer({ ticket, onSend, mode, focusTick, onClose, lastAgentReply }) {
  const push = useToast();
  const [tab, setTab] = useState("Reply");
  useEffect(() => { if (mode) setTab(mode); }, [mode]);
  const sigSettings = getSigSettings();
  const sigText = resolveSignature(sigSettings, ticket.dept);
  /*
   * The editor is HTML now, so the seed is HTML: one paragraph for the
   * greeting, one empty paragraph for the agent to type into, then the
   * signature. Building it as real markup is what removed the wall of blank
   * lines -- the old version was plain text with stacked \n that nl2br() turned
   * into a run of <br>.
   */
  const esc = (v) => String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const firstName = String(ticket.name || "there").split(" ")[0];
  /*
    * The seed, and the room in it.
    *
    * Greeting, then TWO empty paragraphs, then a spacer, then the signature.
    * The caret goes in the first empty paragraph -- so it blinks a clear line
    * below "Hi Aman," with the signature pushed a further line down, instead of
    * sitting jammed against "Regards," the way it was.
    */
  /*
   * BLANK is a paragraph containing a single <br>, not an empty one. An empty
   * <p></p> renders at zero height, so every "blank line" in the seed simply
   * did not exist and the caret ended up against the signature.
   */
  const BLANK = "<p><br></p>";
  const sigHtml = sigText
    ? `${BLANK}<p>${esc(sigText).replace(/\n/g, "<br>")}</p>`
    : "";
  //   0 greeting · 1 blank · 2 CARET · 3 blank · 4 signature
  const initialBody = `<p>Hi ${esc(firstName)},</p>${BLANK}${BLANK}${sigHtml}`;
  const CARET_PARA = 2;
  /*
   * Park the caret in the empty paragraph between the greeting and the
   * signature, once the composer has finished sliding open.
   *
   * The textarea version measured a character offset into a plain string; with
   * an HTML editor the target is a NODE, so it walks to the second <p> — the
   * blank one the seed leaves for the agent to type into.
   */
  const fwdToRef = useRef(null);
  useEffect(() => {
    if (!focusTick) return;
    /*
     * A forward with no recipient cannot go anywhere, so that is where the
     * cursor belongs. Sooner than the caret placement below, which waits for
     * the panel to finish sliding open -- an address field has nothing to
     * measure and no caret to position.
     */
    if (isFwd && !fwdTo.trim()) {
      const quick = setTimeout(() => fwdToRef.current && fwdToRef.current.focus(), 80);
      return () => clearTimeout(quick);
    }
    const id = setTimeout(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      // Two lines below the greeting; see the seed above.
      const ps = el.querySelectorAll("p");
      const target = ps[CARET_PARA] || ps[ps.length - 1] || el.lastElementChild || el;
      try {
        const r = document.createRange();
        r.selectNodeContents(target);
        r.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      } catch { /* caret placement is a nicety, never fatal */ }
    }, 300);
    return () => clearTimeout(id);
    // tab matters: see the note above about effect ordering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTick, tab]);
  /* Where the caret was when "/c" or "@" fired -- see pick()/pickMention(). */
  const savedRange = useRef(null);
  const [menOpen, setMenOpen] = useState(false);
  const [menQ, setMenQ] = useState("");

  /*
   * Insert a mention as plain text, not a link.
   *
   * A note is stored and re-rendered as HTML like any other message; an anchor
   * pointing at an internal user id would mean nothing to anyone reading it
   * later, and mailto: would be worse -- notes never leave the desk.
   */
  const pickMention = (agent) => {
    const el = taRef.current;
    const text = "@" + (agent.name || agent.email) + " ";
    if (el) {
      el.focus();
      const range = savedRange.current;
      if (range) {
        try {
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        } catch { /* the DOM moved; insert wherever focus landed */ }
      }
      // Remove the "@" that opened the picker.
      try { document.execCommand("delete"); } catch { /* nothing to delete */ }
      try { document.execCommand("insertText", false, text); } catch { el.innerHTML += text; }
      setValue(el.innerHTML);
    } else {
      setValue((b) => b + text);
    }
    savedRange.current = null;
    setMenOpen(false);
  };

  /* The lightbox for files staged on THIS reply, separate from the one the
     conversation uses -- these are not part of the thread yet. */
  const [filePreview, setFilePreview] = useState(null);   // { list, index } | null

  const [body, setBody] = useState(initialBody);
  /*
   * A saved draft is restored the first time the composer opens for this
   * ticket. Once only -- re-applying it on every tab switch would overwrite
   * whatever the agent has typed since.
   */
  const [draftInfo, setDraftInfo] = useState(null);
  const draftLoaded = useRef(false);
  useEffect(() => {
    if (draftLoaded.current) return undefined;
    draftLoaded.current = true;
    let alive = true;
    fdMessages.getDraft(ticket.id)
      .then((r) => {
        const d = r && r.draft;
        if (!alive || !d || !d.body) return;
        setDraftInfo({ at: d.at, mode: d.mode || "Reply" });
        if ((d.mode || "Reply") === "Reply") setBody(d.body);
        else if (d.mode === "Note") setNote(d.body);
        else setFwdNote(d.body);
      })
      .catch(() => { /* no draft, or the endpoint is older -- not an error */ });
    return () => { alive = false; };
  }, [ticket.id]);
  const [to, setTo] = useState(ticket.email);
  const [fwdTo, setFwdTo] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [note, setNote] = useState("");
  const [fwdNote, setFwdNote] = useState(() => (sigSettings.applyForward && sigText ? "\n\n" + sigText : ""));
  const [keepThread, setKeepThread] = useState(true);
  const [cpOpen, setCpOpen] = useState(false);
  const [cpQ, setCpQ] = useState("");
  const [trigIdx, setTrigIdx] = useState(-1);
  const [saved, setSaved] = useState(false);
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return;
    const onKey = (e) => { if (e.key === "Escape") setFull(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [full]);
  const rootRef = useRef(null);
  /* Kept in sync with the conversation column, which is the scroller the
     composer lives in. The composer stops 72px short of filling it, so the
     end of the last message stays visible behind the editor. */
  useEffect(() => {
    const col = document.querySelector(".td-convo");
    const el = rootRef.current;
    if (!col || !el || typeof ResizeObserver === "undefined") return undefined;
    const apply = () => el.style.setProperty("--convo-h", col.clientHeight + "px");
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(col);
    return () => ro.disconnect();
  }, []);

  /* Bring the whole frame back into view once the new tab has laid out. Two
     frames, because the tab's own content (the forward quote, the extra
     address rows) is measured after the first. */
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const col = document.querySelector(".td-convo");
        if (col) col.scrollTop = col.scrollHeight;
      });
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [tab]);

  const taRef = useRef(null);
  const autoGrow = () => { const ta = taRef.current; if (!ta || full) return; ta.style.height = "auto"; ta.style.height = Math.max(420, ta.scrollHeight) + "px"; };

  /* ---------------------------- attachments ---------------------------- */
  /*
   * Files are uploaded the moment they are picked, not on Send. Two reasons:
   * the agent sees immediately whether a file was rejected (too big, wrong
   * type) instead of finding out after composing a long reply, and Send stays
   * a single fast call that only has to reference the ids.
   */
  const [files, setFiles] = useState([]);            // [{id,name,sizeText,uploading,progress,error}]
  const fileRef = useRef(null);

  const pickFiles = () => fileRef.current && fileRef.current.click();

  const onFiles = async (e) => {
    const chosen = Array.from(e.target.files || []);
    // Reset the input straight away, or picking the SAME file twice in a row
    // fires no change event and looks like the button is broken.
    e.target.value = "";
    for (const f of chosen) {
      const tempId = `tmp-${Date.now()}-${Math.random()}`;
      setFiles((x) => [...x, { tempId, name: f.name, sizeText: humanBytes(f.size), uploading: true, progress: 0 }]);
      try {
        const res = await fdAttachments.upload(ticket.id, f, (pct) =>
          setFiles((x) => x.map((it) => (it.tempId === tempId ? { ...it, progress: pct } : it))));
        setFiles((x) => x.map((it) => (it.tempId === tempId
          ? { ...it, id: res.id, name: res.name, sizeText: res.sizeText, mime: res.mime,
              url: res.url, viewUrl: res.viewUrl || res.url, uploading: false, progress: 100 }
          : it)));
      } catch (err) {
        setFiles((x) => x.map((it) => (it.tempId === tempId
          ? { ...it, uploading: false, error: err.message } : it)));
        push({ type: "error", title: `Could not attach ${f.name}`, desc: err.message });
      }
    }
  };

  const removeFile = async (file) => {
    setFiles((x) => x.filter((it) => (it.id || it.tempId) !== (file.id || file.tempId)));
    // Delete the staged copy on the server too, or it is re-attached to the
    // next forward from this ticket (forwards pull every stored attachment).
    if (file.id) { try { await fdAttachments.remove(file.id); } catch (err) { /* orphan, harmless */ } }
  };

  const isNote = tab === "Note", isFwd = tab === "Forward";
  /*
   * Who answered last, if anyone.
   *
   * Two agents working the same queue will both open a ticket that shows a
   * customer reply, and both will answer it -- the customer then gets two
   * different replies from the same address. Freshdesk warns about this and so
   * do we: it costs one line and prevents a genuinely embarrassing failure.
   */
  const priorReply = lastAgentReply;

  const value = isNote ? note : isFwd ? fwdNote : body;
  const setValue = isNote ? setNote : isFwd ? setFwdNote : setBody;

  const change = (e) => {
    const v = e.target.value, pos = e.target.selectionStart;
    setValue(v); setSaved(true);
    requestAnimationFrame(autoGrow);
    // "/c" typed → open the canned response search (reply & forward only)
    if (!isNote && /\/c$/i.test(v.slice(0, pos))) { setTrigIdx(pos - 2); setCpQ(""); setCpOpen(true); }
  };
  const pick = (r) => {
    // Fire-and-forget: the counter only drives the "most used" ordering, and a
    // failed increment must never block the insert.
    if (r && r.id) { fdMessages.cannedUse(r.id).catch(() => {}); }

    /* Insert at the caret through the editor itself. Splicing a character
       offset into the string has no meaning now that the value is HTML -- it
       would cut a tag in half. */
    const el = taRef.current;
    const body = String(r.body || "");
    // Already HTML (from the rich editor in Settings) or plain text?
    const html = /<[a-z][\s\S]*>/i.test(body)
      ? body
      : `<p>${body.replace(/\n/g, "<br>")}</p>`;

    if (el) {
      el.focus();
      // Put the caret back exactly where "/c" was typed.
      const range = savedRange.current;
      if (range) {
        try {
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        } catch { /* the DOM moved under us; carry on at wherever focus landed */ }
      }
      // Remove the "/c" that triggered the picker before inserting.
      try { document.execCommand("delete"); document.execCommand("delete"); } catch { /* nothing to delete */ }
      try { document.execCommand("insertHTML", false, html); } catch { el.innerHTML += html; }
      setValue(el.innerHTML);
    } else {
      setValue((b) => b + html);
    }
    savedRange.current = null;
    setCpOpen(false); setTrigIdx(-1);
  };
  const closePop = () => { setCpOpen(false); setTrigIdx(-1); taRef.current?.focus(); };

  const attachmentIds = files.filter((f) => f.id && !f.error).map((f) => f.id);
  const uploadsPending = files.some((f) => f.uploading);

  /*
   * Send for real.
   *
   * The composer is only cleared on a CONFIRMED success. If the mail server
   * rejects the message, the agent's text stays exactly where it is so they can
   * fix the address (or hit Retry from the thread) instead of retyping a reply
   * they have already written once.
   */
  /* An empty editor still contains "<p></p>", so emptiness is judged on the
     TEXT, not the markup. */
  const isBlank = (html) => !String(html || "")
    .replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").trim();

  /*
   * Deliberately not async, and nothing here is awaited.
   *
   * onSend() puts the message into the thread and returns; the network call
   * happens after this function has already finished, so the composer clears
   * and folds away in the same frame as the click.
   */
  const send = () => {
    /*
     * A forward with no covering note is normal -- the point is the thread
     * underneath. Only a reply and a note actually need words.
     */
    if (!isFwd && isBlank(value)) {
      push({ type: "error", title: isNote ? "Write the note first" : "Write a reply first" });
      return;
    }
    if (isFwd && !fwdTo.trim()) { push({ type: "error", title: "Enter an address to forward to" }); return; }
    if (uploadsPending) { push({ type: "info", title: "Still uploading", desc: "Wait for the attachments to finish." }); return; }

    if (isNote) {
      onSend({ type: "note", body: note, isHtml: true });
      setNote("");
    } else if (isFwd) {
      onSend({ type: "forward", body: fwdNote, to: fwdTo, cc, bcc, keepThread, attachmentIds, isHtml: true });
      setFwdNote(""); setFwdTo(""); setFiles([]);
    } else {
      onSend({ type: "reply", body, to, cc, bcc, attachmentIds, isHtml: true });
      setBody(initialBody); setFiles([]);
    }
    setSaved(false);
  };

  const RTE = [Bold, Italic, Underline, "d", Heading1, Heading2, Type, "d", List, ListOrdered, "d", Link2, ImageIcon, TableIcon, Code];

  return (
    <>
    {full && <div className="comp-fs-backdrop" onClick={() => setFull(false)} />}
    <div ref={rootRef} className={`composer ${isNote ? "comp-note" : ""} ${isFwd && !full ? "comp-short" : ""} ${full ? "comp-fs" : ""}`}>
      <div className="comp-tabs">
        {[["Reply", Reply], ["Note", Lock], ["Forward", Forward]].map(([k, Ic]) => (
          <button key={k} className={tab === k ? "on" : ""}
                  onClick={() => {
                    setTab(k);
                    // Same reasoning as the focusTick effect: a forward needs an
                    // address before it needs a body.
                    if (k === "Forward") setTimeout(() => fwdToRef.current?.focus(), 60);
                    else setTimeout(() => taRef.current?.focus(), 60);
                  }}><Ic size={15} /> {k}</button>
        ))}
        <button style={{ marginLeft: "auto" }} title={full ? "Exit fullscreen (Esc)" : "Fullscreen compose"} onClick={() => setFull((f) => !f)}><Maximize2 size={15} style={full ? { transform: "rotate(180deg)" } : undefined} /></button>
        {onClose && <button title="Close editor — your draft is kept" onClick={() => { setFull(false); onClose(); }}><X size={16} /></button>}
      </div>

      {isNote && (
        <div className="note-banner"><Lock size={14} /> Internal note — visible to your team only. The customer will never see this.</div>
      )}

      {tab === "Reply" && (<>
        <div className="comp-addr">
          <span className="lb">From</span>
          <span style={{ fontWeight: 700 }}>IS Support</span>
          <span style={{ color: "var(--muted)" }}>(contact@internshipstudio.com)</span>
        </div>
        <div className="comp-addr">
          <span className="lb">To</span>
          <RecipientInput value={to} onChange={setTo} placeholder="name@example.com" />
          <span className="cc"><button onClick={() => setShowCc(s => !s)}>Cc</button><button onClick={() => setShowCc(s => !s)}>Bcc</button></span>
        </div>
        {showCc && (<>
          <div className="comp-addr"><span className="lb">Cc</span><RecipientInput value={cc} onChange={setCc} placeholder="cc@example.com" /></div>
          <div className="comp-addr"><span className="lb">Bcc</span><RecipientInput value={bcc} onChange={setBcc} placeholder="bcc@example.com" /></div>
        </>)}
      </>)}

      {isFwd && (<>
        <div className="comp-addr">
          <span className="lb">To</span>
          <RecipientInput ref={fwdToRef} value={fwdTo} onChange={setFwdTo} placeholder="Forward to anyone — name@company.com" autoFocus />
          <span className="cc"><button onClick={() => setShowCc(s => !s)}>Cc</button><button onClick={() => setShowCc(s => !s)}>Bcc</button></span>
        </div>
        {showCc && (<>
          <div className="comp-addr"><span className="lb">Cc</span><RecipientInput value={cc} onChange={setCc} placeholder="cc@example.com" /></div>
          <div className="comp-addr"><span className="lb">Bcc</span><RecipientInput value={bcc} onChange={setBcc} placeholder="bcc@example.com" /></div>
        </>)}
        <div className="comp-addr">
          <span className="lb" style={{ width: "auto" }}>Subject</span>
          <input readOnly value={`Fwd: ${ticket.subject} (#${ticket.id})`} style={{ color: "var(--muted)" }} />
        </div>
      </>)}

      {/* Everything from here to the actions scrolls; everything outside it
          stays on screen. */}
      <div className="comp-scroll">

      {/* Only on Reply -- a note or a forward does not reach the customer, so
          there is nothing to collide with. */}
      {priorReply && !isNote && !isFwd && (
        <div className="comp-warn">
          <AlertCircle size={14} />
          <div>
            <b>{priorReply.who}</b> already replied to this ticket {priorReply.when}.
            <span className="comp-warn-sub"> Check the thread above before sending, so the customer does not get two answers.</span>
          </div>
        </div>
      )}

      <div className="comp-area">
        <RichEditor
          value={value}
          onChange={(html) => { setValue(html); setSaved(true); }}
          editorRef={taRef}
          /* Re-seeded only when the ticket or the tab changes -- never on a
             keystroke, or the caret jumps to the start of the box. */
          resetKey={`${ticket.id}:${tab}:${focusTick}`}
          /* Not on a forward that still has no recipient: the To field is
             about to be focused instead, and two grabs would fight. */
          autoFocus={!!focusTick && !(isFwd && !fwdTo.trim())}
          minHeight={full ? 420 : 220}
          placeholder={isNote ? "Add an internal note for your team…"
            : isFwd ? "Add a message above the forwarded conversation…"
            : "Type your response here…  ( type /c to insert a canned response )"}
          onSlashCommand={() => {
            // Remember where the caret was; the picker's search box is about
            // to take focus away from the editor.
            const sel = window.getSelection();
            savedRange.current = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
            setTrigIdx(-1); setCpQ(""); setCpOpen(true);
          }}
          /* "@" on a note offers the team. Notes are internal, so tagging a
             colleague there is the whole point of having them. */
          onMention={isNote ? () => {
            const sel = window.getSelection();
            savedRange.current = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
            setMenQ(""); setMenOpen(true);
          } : undefined}
        />
      </div>

      {isFwd && (
        <div style={{ padding: "0 16px 12px" }}>
          <div className="quote"><b>---------- Forwarded message ----------</b>{"\n"}From: {ticket.name} &lt;{ticket.email}&gt;{"\n"}Subject: {ticket.subject}{"\n\n"}{bodyFor(ticket).slice(0, 180)}…</div>
          <label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            <Switch on={keepThread} onChange={setKeepThread} /> Retain original email thread
          </label>
        </div>
      )}

      </div>{/* /comp-scroll */}

      {/* Anchored to the composer rather than the editor, so they sit above the
          action bar and outside the scroller that would clip them. */}
      {cpOpen && <CannedPopup query={cpQ} setQuery={setCpQ} onPick={pick} onClose={closePop} />}
      {menOpen && <MentionPopup query={menQ} setQuery={setMenQ} onPick={pickMention}
                                onClose={() => { setMenOpen(false); taRef.current?.focus(); }} />}

      {/* Formatting lives in RichEditor's own toolbar; these are the actions
          that are not formatting. The row that used to be here rendered a dozen
          icons with no onClick — they looked like a toolbar and did nothing. */}
      <div className="rte rte-actions">
        <button type="button" title="Attach a file" onClick={pickFiles}><Paperclip size={16} /></button>
        <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={onFiles} />
        {!isNote && (
          <button type="button" title="Canned responses"
                  onClick={() => { setTrigIdx(-1); setCpQ(""); setCpOpen(true); }}><MessageSquareText size={16} /></button>
        )}
      </div>

      {files.length > 0 && (
        <div className="comp-files">
          {files.map((f) => {
            // Only a finished upload has something to preview.
            const ready = !f.uploading && !f.error && f.id;
            const kind = kindOf(f);
            const isPic = ready && kind === "image";
            const Ic = ATT_ICON[kind] || Paperclip;
            const done = files.filter((x) => !x.uploading && !x.error && x.id);
            const open = () => ready && setFilePreview({ list: done, index: done.indexOf(f) });

            return isPic ? (
              /* An image says what it is far better than its filename does. */
              <button key={f.id || f.tempId} type="button" className="att-thumb" title={`${f.name} — click to preview`}
                      onClick={open}>
                <img src={fdUrl(f.viewUrl || f.url)} alt={f.name} loading="lazy"
                     onError={(e) => { e.currentTarget.style.display = "none"; }} />
                <span className="att-thumb-x" title="Remove"
                      onClick={(e) => { e.stopPropagation(); removeFile(f); }}><X size={11} /></span>
                <span className="att-thumb-cap">{f.sizeText}</span>
              </button>
            ) : (
              <span key={f.id || f.tempId}
                    className={`att-chip ${f.error ? "att-err" : ""} ${ready ? "att-open" : ""}`}
                    title={ready ? "Click to preview" : undefined}
                    onClick={open}>
                {f.uploading ? <Spinner /> : f.error ? <AlertCircle size={13} /> : <Ic size={13} color={ATT_COLOR[kind]} />}
                <span className="att-name">{f.name}</span>
                <span className="att-size">{f.uploading ? `${f.progress}%` : f.error ? f.error : f.sizeText}</span>
                <button className="att-x" title="Remove"
                        onClick={(e) => { e.stopPropagation(); removeFile(f); }}><X size={12} /></button>
              </span>
            );
          })}
        </div>
      )}

      {/* Same lightbox the conversation uses -- pdf, sheets, docs, images. */}
      {filePreview && (
        <AttachmentPreview attachments={filePreview.list} startIndex={filePreview.index}
                           onClose={() => setFilePreview(null)} />
      )}

      <div className="comp-foot">
        <span className="hint">
          {isNote ? <><Lock size={12} /> Only agents on your team can read this</> : <>Tip: type <code>/c</code> for canned responses</>}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="char-count">
            {(() => {
              const t = String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").trim();
              return t ? `${t.split(/\s+/).length} words · ${t.length} chars` : "0 words";
            })()}
          </span>
          {saved && <span className="saved">Saved</span>}
          <button className="btn btn-soft btn-sm" title="Save draft" onClick={async () => {
            try {
              await fdMessages.saveDraft(ticket.id, { body: value, to: [isFwd ? fwdTo : to], cc: cc ? [cc] : [], mode: tab });
              setSaved(true);
              push({ type: "success", title: "Draft saved", desc: "It will be here when you come back to this ticket." });
            } catch (err) { push({ type: "error", title: "Could not save the draft", desc: err.message }); }
          }}><Save size={14} /> Save Draft</button>
          <button className="icon-btn" title="Discard draft" onClick={async () => {
            setValue(""); setSaved(false);
            try { await fdMessages.discardDraft(ticket.id); } catch (err) { /* nothing was stored */ }
          }}><Trash2 size={16} /></button>
          {/* Only the upload is worth waiting for: the ids have to exist before
              the message that references them is sent. Forward needs no covering
              note, so it is not gated on the body being non-empty. */}
          <button className="btn btn-primary" onClick={send}
                  disabled={uploadsPending || (!isFwd && isBlank(value))}>
            {isNote ? <><Lock size={15} /> Add Note</> : isFwd ? <><Forward size={15} /> Forward</> : <><Send size={15} /> Send</>}
          </button>
        </span>
      </div>
    </div>
    </>
  );
}

/**
 * One attachment, as a card.
 *
 * Deliberately not a <button> wrapping other buttons -- that is invalid, and
 * the browser's own click handling gets it wrong. The card is a div; the
 * actions inside it are the buttons.
 */
function AttachmentCard({ att, onView }) {
  const kind = kindOf(att);
  const Ic = ATT_ICON[kind] || Paperclip;
  const color = ATT_COLOR[kind] || "var(--muted)";
  const isPic = kind === "image";
  const [imgState, setImgState] = useState(isPic ? "loading" : "none");

  return (
    /* A div with a role, not a <button>: a button cannot legally contain the
       download link, and nesting them breaks the browser's own click handling. */
    <div className={`att-card ${isPic ? "att-card-pic" : ""}`} title={att.name}
         role="button" tabIndex={0}
         onClick={() => onView && onView(att)}
         onKeyDown={(e) => {
           if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onView && onView(att); }
         }}>
      <div className="att-card-thumb" style={isPic ? undefined : { color }}>
        {isPic && imgState !== "error" ? (
          <>
            {imgState === "loading" && <span className="att-card-skel" aria-hidden="true" />}
            <img src={fdUrl(att.viewUrl || att.url)} alt={att.name} loading="lazy"
                 style={{ opacity: imgState === "ready" ? 1 : 0 }}
                 onLoad={() => setImgState("ready")}
                 onError={() => setImgState("error")} />
          </>
        ) : <Ic size={30} />}

        {/* Over the tile, not beside it: the tile is the biggest target and
            the action belongs to the thing you are pointing at. stopPropagation
            because the whole card opens the viewer -- without it, downloading
            would also pop the viewer open behind the save dialog. */}
        <div className="att-card-acts">
          <a title={`Download ${att.name}`} href={fdUrl(att.url || att.viewUrl)}
             download={att.name} target="_blank" rel="noopener noreferrer"
             onClick={(e) => e.stopPropagation()}>
            <Download size={16} />
          </a>
        </div>
      </div>

      <div className="att-card-meta">
        <span className="att-card-name">{att.name}</span>
        <span className="att-card-sub">
          <Ic size={11} color={color} />
          {(att.sizeText || "").trim() || kind.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

/* ============================================================================
   CONVERSATION — real messages from the mailbox
   ========================================================================== */

/**
 * Absolute timestamp in the form Freshdesk prints beside the relative one:
 * "Fri, 4 Sep 2026 at 11:32 AM". Falls back to whatever the server formatted
 * if the ISO value is missing or unparseable.
 */
/**
 * Point a stored message body's own attachment URLs at the API.
 *
 * They are stored relative to the API folder ("fd_attachments.php?...") so that
 * nothing in the database depends on where the panel is served from. A browser
 * resolves that against the PAGE, which is a ticket URL, so every inline image
 * 404s until the prefix is put back.
 *
 * An image parked in data-fd-src that turns out to be one of ours is restored
 * at the same time: the remote-image block exists to stop tracking pixels, and
 * a picture served by this desk is not one.
 */
function withApiUrls(html) {
  if (!html) return html;

  let out = String(html);

  // Residue of an image that was parked twice: no URL, nothing to restore.
  out = out.replace(/\sdata-fd-src\s*=\s*(["'])\s*\1/gi, "");

  /*
   * Elements that can load or run something. Removed with their content --
   * a <script> body is not text anyone wants to read, and the inside of an
   * <iframe> is the fallback nobody sees.
   */
  const DANGEROUS = "script|style|iframe|object|embed|form|link|meta|base|applet|frameset|frame";
  out = out.replace(new RegExp(`<\\s*(${DANGEROUS})\\b[^>]*>[\\s\\S]*?<\\s*/\\s*\\1\\s*>`, "gi"), "");
  out = out.replace(new RegExp(`<\\s*/?\\s*(${DANGEROUS})\\b[^>]*>`, "gi"), "");
  // Inline event handlers, quoted and bare.
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");
  // Script-bearing URL schemes in any attribute that fetches.
  out = out.replace(/(href|src|action|background|formaction)\s*=\s*(["']?)\s*(javascript|vbscript)\s*:/gi,
                    "$1=$2#blocked:");

  // `tag`, not `out`: the outer name is already taken, and shadowing it here
  // is how a one-line change ends up editing the whole body by accident.
  return out.replace(/<img\b[^>]*>/gi, (tag) => {
    /* Already parked by the server: our own URL is in data-fd-src with an
       empty src beside it. Restore it, drop the block, and frame it. */
    const parked = /\sdata-fd-src\s*=\s*(["'])(fd_attachments\.php[^"']*)\1/i.exec(tag);
    if (parked) {
      const restored = tag
        .replace(parked[0], "")
        .replace(/\ssrc\s*=\s*(["'])[^"']*\1/i, "")
        .replace(/\sdata-fd-blocked\s*=\s*(["'])?[^\s"'>]*\1?/i, "")
        .replace(/^<img/i, `<img src="${fdUrl(parked[2])}"`);
      return frameImage(restored, attIdOf(parked[2]));
    }

    /* Or already a plain src pointing at our endpoint, just relative. */
    const own = /(\ssrc\s*=\s*)(["'])(fd_attachments\.php[^"']*)\2/i.exec(tag);
    if (!own) return tag;
    return frameImage(
      tag.replace(own[0], `${own[1]}${own[2]}${fdUrl(own[3])}${own[2]}`),
      attIdOf(own[3]));
  });
}

/**
 * Put an attachment picture in its frame, with the hover action.
 *
 * The id travels on both the wrapper and the image: the wrapper is what the
 * delegated click handler looks for, and the image carries it so a second
 * pass over the same markup can see it has already been framed.
 */
function frameImage(imgTag, id) {
  if (/^<span class="msg-img"/.test(imgTag)) return imgTag;   // already framed
  return `<span class="msg-img" data-fd-att="${id}">`
       + imgTag.replace(/^<img/i, `<img data-fd-att="${id}"`)
       + '<span class="msg-img-acts">'
       + '<button type="button" data-fd-act="download" title="Download">' + SVG_DOWN + '</button>'
       + '</span></span>';
}

/*
 * The download glyph as raw SVG. The overlay is built with DOM calls rather
 * than JSX -- it lives inside a dangerouslySetInnerHTML subtree that React
 * does not manage -- so the icon cannot be a component here.
 */
const SVG_DOWN = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" '
  + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>'
  + '<polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

/** The attachment id out of one of our own view/download URLs. */
function attIdOf(url) {
  const m = /[?&](?:amp;)?id=(\d+)/i.exec(String(url || ""));
  return m ? m[1] : "";
}

/**
 * Scroll `el` into view WITHIN `box`, and nowhere else.
 *
 * The deliberate difference from Element.scrollIntoView(): that walks up the
 * tree scrolling every ancestor it can, which on this screen drags the whole
 * shell out of position. This moves one scrollTop.
 *
 * @param where "center" | "end" | "nearest"
 */
function scrollWithin(el, box, where = "nearest") {
  if (!el || !box) return;
  const top = el.offsetTop - box.offsetTop;         // both relative to the same
  const bottom = top + el.offsetHeight;             // positioned ancestor
  const viewTop = box.scrollTop;
  const viewBottom = viewTop + box.clientHeight;

  if (where === "center") {
    box.scrollTop = Math.max(0, top - (box.clientHeight - el.offsetHeight) / 2);
    return;
  }
  if (where === "end") { box.scrollTop = Math.max(0, bottom - box.clientHeight); return; }
  // "nearest": only move if it is actually out of view.
  if (top < viewTop) box.scrollTop = top;
  else if (bottom > viewBottom) box.scrollTop = bottom - box.clientHeight;
}

function fullStamp(iso, fallback) {
  if (!iso) return fallback || "";
  const d = new Date(String(iso).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return fallback || "";
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${day} at ${time}`;
}

/*
 * One message in the thread.
 *
 * LAYOUT
 * Modelled on Freshdesk: an avatar, one header line saying plainly who did what
 * and when, the message, and the quoted history folded away behind a "···".
 * Agent replies sit on a tinted card so the two sides of the conversation are
 * told apart at a glance rather than by reading the names.
 *
 * WHY THE BODY IS SHORT NOW
 * The server splits quoted history off the body (fd_split_quoted_html) and
 * normalises the sender's typography (fd_tidy_email_html). Before that, this
 * component rendered the entire quoted chain inline in every message, so a
 * seven-message ticket redisplayed the whole conversation seven times.
 *
 * dangerouslySetInnerHTML is safe HERE and only here because the string went
 * through fd_sanitize_html() on the server BEFORE it was stored: scripts,
 * iframes, event handlers and javascript: URLs are gone, and remote images are
 * parked in data-fd-src. Nothing that skipped that pass ever reaches this.
 */
const MessageEntry = memo(function MessageEntry({ m, onRetry, onDeleteNote, onPreview, isFirst }) {
  const [showQuoted, setShowQuoted] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const isNote = m.who === "note";
  const isCust = m.who === "cust";
  const failed = m.status === "failed";
  const bodyRef = useRef(null);
  const quoteRef = useRef(null);

  /* Read through a ref: onPreview is rebuilt by the parent on some renders,
     and listing it as a dependency would tear down and rebuild every frame. */
  const onPreviewRef = useRef(null);
  onPreviewRef.current = (att) => onPreview && onPreview([att], 0);

  /*
   * Declared here, above the effects that list them as dependencies: a
   * dependency array is evaluated during render, so a value defined further
   * down the component is still in its temporal dead zone at that point.
   */
  const bodyHtml = useMemo(() => withApiUrls(m.html), [m.html]);
  const quotedHtml = useMemo(() => withApiUrls(m.quoted || ""), [m.quoted]);

  /*
   * "Show images" un-blocks the genuinely remote ones. Our own were restored
   * in withApiUrls() before this markup was ever injected, so what is left
   * parked here is exactly what the agent has not agreed to load yet: merely
   * opening a ticket must never fire a spammer's tracking pixel and confirm
   * the address is live.
   */
  useEffect(() => {
    if (!showImages) return;
    [bodyRef.current, quoteRef.current].filter(Boolean).forEach((el) =>
      el.querySelectorAll("img[data-fd-blocked]").forEach((img) => {
        const parked = img.getAttribute("data-fd-src");
        if (!parked) return;
        img.src = parked;
        img.removeAttribute("data-fd-blocked");
      }));
  }, [showImages, showQuoted, m.id]);

  /*
   * One listener per message, bound to the container rather than to the
   * pictures inside it. The frames arrive and leave with the markup; a
   * listener on the thing that holds them cannot fall out of step with them.
   */
  useEffect(() => {
    const roots = [bodyRef.current, quoteRef.current].filter(Boolean);
    if (!roots.length) return undefined;

    const onClick = (e) => {
      const frame = e.target.closest && e.target.closest(".msg-img");
      if (!frame) return;

      const id = Number(frame.getAttribute("data-fd-att"));
      const att = (m.attachments || []).find((a) => Number(a.id) === id);
      const img = frame.querySelector("img");
      const resolved = att || { id, name: (img && img.getAttribute("alt")) || "image",
                                viewUrl: img && img.getAttribute("src") };

      // The download link is a real anchor; let the browser take it.
      const dl = e.target.closest("[data-fd-act='download']");
      if (dl) {
        e.preventDefault();
        const url = fdUrl(resolved.url || resolved.viewUrl || "");
        if (!url) return;
        const a = document.createElement("a");
        a.href = url;
        a.download = resolved.name || "attachment";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }

      e.preventDefault();
      onPreviewRef.current(resolved);
    };

    roots.forEach((r) => r.addEventListener("click", onClick));
    return () => roots.forEach((r) => r.removeEventListener("click", onClick));
  }, [bodyHtml, quotedHtml, showQuoted, m.attachments]);

  useEffect(() => {
    const roots = [bodyRef.current, quoteRef.current].filter(Boolean);
    if (!roots.length) return undefined;
    const cleanups = [];

    roots.forEach((root) => root.querySelectorAll("img").forEach((img) => {
      // A blocked image is not loading; it is waiting to be asked for.
      if (img.hasAttribute("data-fd-blocked")) return;

      const done = () => {
        img.removeAttribute("data-fd-loading");
        img.removeAttribute("data-fd-failed");
      };
      const failed = () => {
        img.removeAttribute("data-fd-loading");
        img.setAttribute("data-fd-failed", "1");
      };

      // complete && naturalWidth: a cached image is already there and must not
      // flash a shimmer; complete with no width means it has already failed.
      if (img.complete) {
        if (img.naturalWidth > 0) done(); else failed();
        return;
      }

      img.setAttribute("data-fd-loading", "1");
      img.addEventListener("load", done);
      img.addEventListener("error", failed);
      cleanups.push(() => {
        img.removeEventListener("load", done);
        img.removeEventListener("error", failed);
      });
    }));

    return () => cleanups.forEach((fn) => fn());
  }, [bodyHtml, quotedHtml, showQuoted, showImages]);

  /*
   * Only genuinely remote images count. One of our own attachment URLs parked
   * in data-fd-src is shown regardless, so counting it would put a "1 remote
   * image blocked" bar above a picture that is plainly visible.
   */
  const blockedCount = useMemo(() => {
    if (!m.html) return 0;
    const parked = m.html.match(/data-fd-src=["'][^"']*["']/g) || [];
    return parked.filter((a) => a.indexOf("fd_attachments.php") === -1
                             && a.indexOf("data:image/") === -1
                             // An empty one is residue, not a blocked image.
                             && !/data-fd-src=["']\s*["']/.test(a)).length;
  }, [m.html]);

  /* The server sends the quoted chain separately now; rows written before that
     only have the plain-text fallback, so both are still supported. */
  const quotedText = !quotedHtml && m.fullText && m.msg && m.fullText.length > m.msg.length + 40 ? m.fullText : "";
  const hasQuoted = !!(quotedHtml || quotedText);

  const files = useMemo(() => (m.attachments || []).filter((a) => !a.inline), [m.attachments]);
  /* Pictures are shown; everything else stays a chip. A screenshot of the bug
     is the message half the time, and making the agent click to see it is a
     step that buys nothing. */


  // What this person did, in the words Freshdesk uses.
  const verb = isNote ? "added a private note"
    : isCust ? (isFirst ? "reported via email" : "replied")
    : `replied${m.sentBy ? ` (${m.sentBy})` : ""}`;

  return (
    <div className={`entry ${isNote ? "entry-note" : ""} ${failed ? "entry-failed" : ""}`}>
      <div className="msg-av" style={{ background: isNote ? "#F59E0B" : avColor(m.from || "?") }}>
        {isNote ? <Lock size={14} /> : initials(m.from || "?")}
      </div>

      <div className={`msg-card ${isCust || isNote ? "" : "msg-card-agent"}`}>
        <div className="msg-head">
          <b>{m.from || (isCust ? "Customer" : "Support")}</b>{" "}
          <span className="msg-verb">{verb}</span>
          <span className="msg-when"> · {m.ago}{fullStamp(m.atIso, m.at) ? ` (${fullStamp(m.atIso, m.at)})` : ""}</span>
          {m.isAuto && <span className="chip" style={{ marginLeft: 8 }}>Auto-reply</span>}
          {m.status === "queued" && <span className="chip" style={{ marginLeft: 8 }}>Sending…</span>}
          {failed && <span className="badge-pill" style={{ marginLeft: 8, background: "#FEE2E2", color: "#DC2626" }}>Not delivered</span>}
        </div>

        {/* addressText, not join(): inbound recipients are stored as
            {name, email} objects, so a bare join printed "To: [object Object]". */}
        {!isNote && m.to && m.to.length > 0 && (
          <div className="msg-to">
            <b>To:</b> {addressText(m.to)}
            {m.cc && m.cc.length > 0 && <> · <b>Cc:</b> {addressText(m.cc)}</>}
          </div>
        )}

        {blockedCount > 0 && !showImages && (
          <div className="msg-blocked">
            <ShieldX size={13} /> {blockedCount} remote image{blockedCount === 1 ? "" : "s"} blocked
            <button className="btn btn-ghost btn-sm" onClick={() => setShowImages(true)}>Show images</button>
          </div>
        )}

        {bodyHtml
          ? <div className="msg-body msg-html" ref={bodyRef} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          : <div className="msg-body">{m.msg}</div>}

        {/* Freshdesk's "···": the quoted thread is one click away and takes up
            no room at all until it is asked for. */}
        {hasQuoted && (
          <button className={`quote-dots ${showQuoted ? "on" : ""}`}
                  title={showQuoted ? "Hide quoted history" : "Show quoted history"}
                  aria-expanded={showQuoted}
                  onClick={() => setShowQuoted((v) => !v)}>
            <MoreHorizontal size={15} />
          </button>
        )}
        {showQuoted && (quotedHtml
          ? <div className="msg-quoted msg-html" ref={quoteRef} dangerouslySetInnerHTML={{ __html: quotedHtml }} />
          : <div className="msg-quoted quote">{quotedText}</div>)}

        {files.length > 0 && (
          <div className="att-strip">
            <div className="att-strip-head">
              <Paperclip size={13} />
              {files.length} attachment{files.length === 1 ? "" : "s"}
            </div>
            <div className="att-grid">
              {files.map((a) => (
                <AttachmentCard key={a.id} att={a}
                                onView={() => onPreview && onPreview(files, files.indexOf(a))} />
              ))}
            </div>
          </div>
        )}

        {failed && (
          <div className="msg-error">
            <AlertCircle size={13} /> {m.error || "The mail server rejected this message."}
            <button className="btn btn-soft btn-sm" onClick={() => onRetry && onRetry(m)}><RefreshCw size={13} /> Retry</button>
          </div>
        )}
        {isNote && onDeleteNote && m.id > 0 && (
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => onDeleteNote(m)}>
            <Trash2 size={13} /> Delete note
          </button>
        )}
      </div>
    </div>
  );
});

/*
 * The queue rail.
 *
 * Working a support inbox means going through tickets in order, and having to
 * bounce back to the list between every one is most of the friction in the job.
 * This is the same queue the list was showing, docked beside the conversation:
 * the current ticket is marked, the rest are one click away.
 *
 * It scrolls on its own so the conversation column keeps the page's scrollbar,
 * and it centres itself on the open ticket when you arrive from anywhere.
 */
/*
 * The queue rail — the same shape Freshdesk uses.
 *
 * Each row is: who wrote, the subject in bold, a one-line snippet of the
 * message, and how long ago on the right. That is enough to decide whether to
 * open something without opening it, which is the whole point of having the
 * queue beside the conversation rather than a click away.
 *
 * It scrolls on its own so the conversation keeps the page's scrollbar, and it
 * centres itself on the open ticket whenever you arrive from anywhere.
 */
const QUEUE_PAGE = 30;

const QUEUE_SORTS = [
  { k: "created",  label: "Date created" },
  { k: "modified", label: "Last modified" },
  { k: "priority", label: "Priority" },
];
/* High first when sorting by priority: "descending" on an ordered scale means
   the most urgent, not the alphabetically last. */
const PRIO_RANK = { Urgent: 4, Critical: 4, High: 3, Medium: 2, Low: 1 };

/*
 * What the queue rail shows, chosen from the properties column.
 *
 * Open is the default because the rail exists to be worked down: a run of
 * closed tickets between the ones still waiting is noise. "Open" here means
 * everything that is not finished rather than the status literally called
 * Open -- the same line the desk's Unresolved view draws, and the reason a
 * Pending ticket does not vanish out from under the agent reading it.
 */
const QUEUE_FILTERS = [
  { key: "open",   label: "Open" },
  { key: "closed", label: "Closed" },
  { key: "all",    label: "All" },
];
const isFinished = (t) => t.status === "Closed" || t.status === "Resolved";
const queueMatches = (t, key) => {
  if (t.trash || t.spam) return false;
  if (key === "open") return !isFinished(t);
  if (key === "closed") return isFinished(t);
  return true;
};

function TicketQueue({ tickets, currentId, onOpen, onCollapse, filter = "open" }) {
  const listRef = useRef(null);
  const [sortKey, setSortKey] = useState("created");
  const [sortDesc, setSortDesc] = useState(true);
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef(null);
  useClickAway(sortRef, () => setSortOpen(false));

  /*
   * Filtered against the working set rather than refetched, which is what
   * makes closing a ticket drop it out of the rail on the spot: the desk
   * patches the ticket's status optimistically, and this recomputes.
   */
  const pool = useMemo(
    () => tickets.filter((t) => queueMatches(t, filter)),
    [tickets, filter]
  );

  /*
   * Sorted here rather than refetched: this is the working set the page
   * already holds, and a round trip to reorder thirty rows the browser is
   * looking at would be slower and could disagree with the list behind it.
   */
  const ordered = useMemo(() => {
    const key = (t) => {
      if (sortKey === "priority") return PRIO_RANK[t.priority] || 0;
      const raw = sortKey === "modified" ? (t.updatedAt || t.lastMessageAt || t.createdAt) : t.createdAt;
      const ms = raw ? Date.parse(String(raw).replace(" ", "T")) : NaN;
      return Number.isNaN(ms) ? 0 : ms;
    };
    const out = [...pool].sort((a, b) => key(a) - key(b));
    return sortDesc ? out.reverse() : out;
  }, [pool, sortKey, sortDesc]);

  const idx = ordered.findIndex((t) => t.id === currentId);
  const sortLabel = (QUEUE_SORTS.find((x) => x.k === sortKey) || QUEUE_SORTS[0]).label;

  /*
   * How many rows are actually in the DOM.
   *
   * Enough to include the open ticket -- arriving at #400 and finding the rail
   * scrolled to nothing would be worse than the lag this fixes -- then thirty
   * more each time the scroll gets near the end.
   */
  const [limit, setLimit] = useState(() =>
    Math.min(ordered.length, Math.max(QUEUE_PAGE, (idx >= 0 ? idx + 1 : 0) + 10)));

  // A different ticket -- or a different order -- resets the window.
  useEffect(() => {
    setLimit(Math.min(ordered.length, Math.max(QUEUE_PAGE, (idx >= 0 ? idx + 1 : 0) + 10)));
  }, [currentId, ordered.length, idx, sortKey, sortDesc]);

  const shown = useMemo(() => ordered.slice(0, limit), [ordered, limit]);

  const onScroll = useCallback((e) => {
    const el = e.currentTarget;
    // 300px of runway, so the next batch is already there when you reach it.
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
      setLimit((n) => (n >= ordered.length ? n : Math.min(ordered.length, n + QUEUE_PAGE)));
    }
  }, [ordered.length]);

  useEffect(() => {
    const el = listRef.current?.querySelector('[data-cur="1"]');
    scrollWithin(el, listRef.current, "center");
    // Deliberately NOT keyed on the window size: growing it must never move
    // the scroll position, or loading more throws you back to the top.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  if (!tickets.length) return null;

  return (
    <div className="tq">
      <div className="tq-head">
        <div className="dd-wrap" ref={sortRef}>
          <button className="tq-sort" onClick={() => setSortOpen((o) => !o)}>
            <ArrowUpDown size={13} />
            <span className="tq-title">{sortLabel}</span>
            <ChevronDown size={13} style={sortOpen ? { transform: "rotate(180deg)" } : undefined} />
          </button>
          {sortOpen && (
            <div className="menu" style={{ minWidth: 190, left: 0, top: "calc(100% + 6px)" }}>
              {[[true, "Descending"], [false, "Ascending"]].map(([d, label]) => (
                <button key={label} className="mi" style={{ padding: "8px 11px" }}
                        onClick={() => { setSortDesc(d); setSortOpen(false); }}>
                  {label}{sortDesc === d && <Check size={14} style={{ marginLeft: "auto" }} />}
                </button>))}
              <div className="menu-sep" />
              {QUEUE_SORTS.map((o) => (
                <button key={o.k} className="mi" style={{ padding: "8px 11px" }}
                        onClick={() => { setSortKey(o.k); setSortOpen(false); }}>
                  {o.label}{sortKey === o.k && <Check size={14} style={{ marginLeft: "auto" }} />}
                </button>))}
            </div>
          )}
        </div>
        <span className="tq-count">{idx >= 0 ? `${idx + 1}/${ordered.length}` : ordered.length}</span>
        {onCollapse && (
          <button className="icon-btn tq-toggle" title="Hide the ticket list" onClick={onCollapse}>
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      <div className="tq-list" ref={listRef} onScroll={onScroll}>
        {shown.map((t) => (
          <button key={t.id} data-cur={t.id === currentId ? "1" : undefined}
                  className={`tq-item ${t.id === currentId ? "on" : ""}`}
                  onClick={() => t.id !== currentId && onOpen(t)}>
            <span className="tq-av" style={{ background: avColor(t.name) }}>{initials(t.name)}</span>

            <span className="tq-txt">
              <span className="tq-line1">
                <span className="tq-who">{t.name || "Unknown"}</span>
                <span className="tq-ago">
                  {t.custReplied && <CornerUpLeft size={10} />}
                  {shortAgo(t.lastActivity || t.created)}
                </span>
              </span>
              <span className="tq-subj">{t.subject || "--"}</span>
              <span className="tq-snip"><Mail size={10} /> {t.preview || "No message body"}</span>
            </span>

            {t.newReplies > 0 && (
              <span className="tq-new" title={`${t.newReplies} new message${t.newReplies === 1 ? "" : "s"}`}>
                <b>{t.newReplies}</b>
                <i>new</i>
              </span>
            )}

          </button>
        ))}
        {limit < ordered.length && (
          <div className="tq-more">Loading {Math.min(QUEUE_PAGE, ordered.length - limit)} more…</div>
        )}
        {/* The filter can empty the rail even when the desk has tickets, so
            this says which filter did it rather than leaving a blank column. */}
        {ordered.length === 0 && (
          <div className="tq-more">
            No {filter === "all" ? "" : `${filter} `}tickets in this list.
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * "3 hours ago" -> "3h". The rail is 270px wide; a full relative phrase eats
 * the room the subject needs, and Freshdesk abbreviates for the same reason.
 */
function shortAgo(text) {
  const s = String(text || "");
  const m = s.match(/(\d+)\s*(second|minute|hour|day|week|month|year)/i);
  if (m) return m[1] + { second: "s", minute: "m", hour: "h", day: "d", week: "w", month: "mo", year: "y" }[m[2].toLowerCase()];
  if (/just now|few seconds/i.test(s)) return "now";
  if (/^an hour/i.test(s)) return "1h";
  if (/^a day|yesterday/i.test(s)) return "1d";
  if (/^a minute/i.test(s)) return "1m";
  if (/^a month/i.test(s)) return "1mo";
  return s.slice(0, 6);
}

/**
 * The conversation, with the middle folded away.
 *
 * A long ticket is read at its ends: the original request, then the last few
 * exchanges. Freshdesk collapses everything between behind a "+N conversations"
 * pill and so does this. It keeps the reply box within reach instead of a
 * screen and a half below the fold, and it keeps the DOM small — which is most
 * of why the page felt slow to open.
 */
function ThreadList({ thread, onRetry, onDeleteNote, onPreview }) {
  const [expanded, setExpanded] = useState(false);

  const HEAD = 1, TAIL = 3, MIN = HEAD + TAIL + 2;   // below MIN nothing is worth hiding
  const firstId = thread.length ? thread[0].id : null;

  // Opening a different ticket starts folded again.
  useEffect(() => { setExpanded(false); }, [firstId]);

  const collapsible = thread.length >= MIN;
  const hidden = collapsible ? thread.length - HEAD - TAIL : 0;

  const entry = (m, i) => (
    <MessageEntry key={m.id} m={m} isFirst={i === 0}
                  onRetry={onRetry} onDeleteNote={onDeleteNote} onPreview={onPreview} />
  );

  if (!collapsible || expanded) return <>{thread.map(entry)}</>;

  return (
    <>
      {thread.slice(0, HEAD).map(entry)}
      <div className="convo-fold">
        <button className="convo-fold-btn" onClick={() => setExpanded(true)}>
          <Plus size={13} /> {hidden} conversation{hidden === 1 ? "" : "s"}
        </button>
      </div>
      {/* isFirst is never true here: index 0 always lives in the head slice. */}
      {thread.slice(thread.length - TAIL).map((m) => entry(m, -1))}
    </>
  );
}

/**
 * Split a recipient field into addresses.
 *
 * A named helper, not an inline regex, because the inline one shipped as
 * `[,;s]+` instead of `[,;\s]+` — a single lost backslash — and split on the
 * LETTER "s". "maheboob.istudio@gmail.com" became
 * ["maheboob.i", "tudio@gmail.com"], so replies were delivered to a nonexistent
 * address and came back as bounces. The character class is spelled out here so
 * the same slip cannot happen silently again.
 *
 * Accepts a string ("a@b.com, c@d.com"), an array of strings, or an array of
 * {name, email} objects — all three shapes reach this from different callers.
 */
function parseAddressList(value) {
  if (!value) return undefined;

  const raw = Array.isArray(value) ? value : String(value).split(SEPARATORS);
  const out = [];

  for (const item of raw) {
    if (!item) continue;
    // Recipients from a stored message come back as {name, email}.
    let addr = (typeof item === "object") ? (item.email || "") : String(item);
    addr = addr.trim().replace(/^[<"']+|[>"']+$/g, "");
    if (!addr) continue;
    // "Name <a@b.com>" pasted straight into the field.
    const angled = addr.match(/<([^>]+)>/);
    if (angled) addr = angled[1].trim();
    if (addr.includes("@")) out.push(addr);
  }
  return out.length ? Array.from(new Set(out)) : undefined;
}

/* Commas, semicolons and whitespace separate addresses. Nothing else. */
const SEPARATORS = /[,;\s]+/;

/** The address(es) a stored message went to, as plain text for display. */
function addressText(list) {
  const parsed = parseAddressList(list);
  return parsed ? parsed.join(", ") : "";
}

/* ---- student / contact profile ---- */
/*
 * The contact panel.
 *
 * Collapsible, and open by default. It also carries the ticket's own badges --
 * status, priority, SLA, category, the student tags -- which used to sit under
 * the subject at the top of the conversation. They belong here: they are
 * properties of the ticket, they were pushing the first message a long way down
 * the page, and this column is where an agent already looks for facts about who
 * they are talking to.
 *
 * Everything is a size smaller than the conversation on purpose. This is
 * reference material, read at a glance; it should not compete with the message.
 */
/*
 * The queue rail's filter, parked at the top of this column.
 *
 * Here rather than in the rail's own header because that header is 330px wide
 * and already carrying the sort control, the position counter and the collapse
 * button; a fourth control wrapped it onto a second line.
 *
 * The counts come off the same working set the rail lists, so they move the
 * moment a status changes rather than at the next reload.
 */
function QueueFilterPanel({ value, onChange, counts }) {
  return (
    <div className="card">
      <div className="props-body">
        <div className="plab">Ticket list</div>
        <div className="seg">
          {QUEUE_FILTERS.map((f) => (
            <button key={f.key} className={value === f.key ? "on" : ""}
                    style={{ flex: 1, justifyContent: "center", gap: 5 }}
                    title={`Show ${f.label.toLowerCase()} tickets in the list on the left`}
                    onClick={() => onChange(f.key)}>
              {f.label}
              <span className="count-badge" style={{ fontSize: 10, padding: "0 6px" }}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContactPanel({ ticket, badges }) {
  const t = ticket;
  /*
   * Closed on arrival.
   *
   * Who the person is matters once; the ticket's own properties -- status,
   * priority, tags, the SLA clocks -- are what an agent actually touches while
   * working it. Opening the column on the contact card pushed all of that below
   * the fold. The choice still sticks once it is made.
   */
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem("hh-contact-open") === "1"; } catch { return false; }
  });
  const toggle = () => setOpen((v) => {
    const n = !v;
    try { localStorage.setItem("hh-contact-open", n ? "1" : "0"); } catch { /* private window */ }
    return n;
  });

  return (
    <div className="card cp-compact" style={{ marginBottom: 14 }}>
      <button className="who who-btn" onClick={toggle} aria-expanded={open}>
        <span className="wa" style={{ background: avColor(t.name) }}>{initials(t.name)}</span>
        <span style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
          <span className="wn">{t.name}</span>
          <span className="wm">{t.registered ? <>Student · {t.college}</> : <>Contact · not registered</>}</span>
        </span>
        {t.registered && <BadgeCheck size={15} color="var(--success)" style={{ flexShrink: 0 }} />}
        <ChevronDown size={14} className={`grp-caret ${open ? "" : "shut"}`} style={{ flexShrink: 0, color: "var(--faint)" }} />
      </button>

      {!open ? null : (<>

      {badges && <div className="cp-badges">{badges}</div>}

      {/* Only shown for a contact that is actually matched to a student
          account. Most people who email support are not, and eight rows of
          "—" reads as broken rather than as "no data". */}
      {hasStudentContext(t.studentContext) && (
      <div className="cp-stu">
        <div className="cp-stu-head">
          <span className="cp-stu-title"><GraduationCap size={13} /> Student Context</span>
          <span className="ai-ready" title="Structured attributes available for AI automation"><Sparkles size={10} /> AI Context Ready</span>
        </div>
        {stuPills(t.studentContext).map((p) => (
          <div key={p.key} className="cp-stu-row">
            <span className="k">{{ registrationStatus: "Registration", domain: "Domain", examStatus: "Exam", startDate: "Start Date", projectStatus: "Project", refundEligibility: "Refund", batch: "Batch", enrollmentStatus: "Enrollment" }[p.key]}</span>
            <span className={`v tv-${p.tone}`}>{!!p.check && <Check size={10} strokeWidth={3.2} />}{String(p.text || "—").replace(/^(Start|Project|Batch|Status): /, "")}</span>
          </div>
        ))}
      </div>
      )}

      {(() => {
        const cc = getCallsSeed().filter((c) => c.customerId === t.id);
        if (!cc.length) return null;
        const miss = cc.filter((c) => c.callType === "Missed" || c.status === "Missed").length;
        return (
          <div className="cp-calls">
            <div className="cp-calls-head"><PhoneCall size={13} /> Customer Calls</div>
            <div className="cp-calls-row"><b>{cc.length}</b> previous call{cc.length !== 1 ? "s" : ""}{miss > 0 && <span className="cp-miss">{miss} missed</span>}</div>
            <div className="cp-calls-last">Last call: {cc[0].day} — {cc[0].time}</div>
          </div>
        );
      })()}

      <div className="info">
        <div className="info-row"><span className="ii"><AtSign size={13} /></span><div style={{ minWidth: 0 }}><div className="il">Email</div><a className="iv" href={`mailto:${t.email}`}>{t.email}</a></div></div>
        {/* Someone who emailed support has an address and, usually, nothing
            else. Show what we have and say so plainly for the rest — rendering
            "undefined tickets · customer since undefined" reads as broken. */}
        <div className="info-row">
          <span className="ii"><PhoneCall size={13} /></span>
          <div>
            <div className="il">Contact number</div>
            {t.phone
              ? <a className="iv" href={`tel:${String(t.phone).replace(/[^\d+]/g, "")}`}>{t.phone}</a>
              : <div className="iv" style={{ color: "var(--faint)" }}>Not provided</div>}
          </div>
        </div>
        <div className="info-row">
          <span className="ii"><Ticket size={14} /></span>
          <div>
            <div className="il">Ticket history</div>
            <div className="iv">
              {Number(t.totalTickets) || 1} ticket{(Number(t.totalTickets) || 1) === 1 ? "" : "s"}
              {t.joined ? ` · first seen ${t.joined}` : ""}
            </div>
          </div>
        </div>
      </div>

      {t.registered ? (
        <div className="intern">
          <div className="intern-head">
            <span className="t"><GraduationCap size={13} /> Internship details</span>
            <span className="badge-pill" style={{ background: t.planStatus === "Completed" ? "var(--success-soft)" : t.planStatus === "On Hold" ? "var(--warning-soft)" : "var(--primary-soft)", color: t.planStatus === "Completed" ? "var(--success)" : t.planStatus === "On Hold" ? "var(--warning)" : "var(--primary)" }}>{t.planStatus}</span>
          </div>
          <div className="kv"><span className="k">Enrollment ID</span><span className="v">{t.enrollId}</span></div>
          <div className="kv"><span className="k">Program</span><span className="v">{t.program}</span></div>
          <div className="kv"><span className="k">Batch</span><span className="v">{t.batch}</span></div>
          <div className="kv"><span className="k">Start date</span><span className="v">{t.startDate}</span></div>
          <div className="kv"><span className="k">Duration</span><span className="v">{t.duration}</span></div>
          <div className="kv"><span className="k">Mentor</span><span className="v">{t.mentor}</span></div>
          <div className="prog">
            <div className="pl"><span style={{ color: "var(--muted)" }}>Course progress</span><span style={{ color: "var(--primary)" }}>{t.progress}%</span></div>
            <div className="pb"><i style={{ width: `${t.progress}%` }} /></div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center", marginTop: 14 }}><Briefcase size={14} /> View full profile</button>
        </div>
      ) : (
        <div className="noreg">
          <GraduationCap size={26} color="var(--faint)" />
          <p>No internship registered against this email yet.</p>
          <button className="btn btn-soft btn-sm" style={{ width: "100%", justifyContent: "center" }}><Search size={14} /> Search enrollments</button>
        </div>
      )}

      </>)}
    </div>
  );
}

function PropertiesPanel({ ticket }) {
  const desk = useDesk();
  /*
   * The real assignable agents, not the five invented names this offered
   * before. Picking one of those wrote a string the server could match to no
   * user, so the ticket ended up assigned to nobody and no one was told.
   */
  useEffect(() => { if (desk.ensureAgents) desk.ensureAgents(); }, [desk]);
  const agentOptions = useMemo(() => {
    const names = (desk.agents || []).map((a) => a.name).filter(Boolean);
    // The current assignee stays in the list even if they have since lost
    // access, or the select would silently show the wrong person.
    if (ticket.agent && !names.includes(ticket.agent)) names.unshift(ticket.agent);
    return names.length ? names : ["Unassigned"];
  }, [desk.agents, ticket.agent]);

  const [status, setStatus] = useState(ticket.status);
  const [prio, setPrio] = useState(ticket.priority);
  const [agent, setAgent] = useState(ticket.agent);
  const [tags, setTags] = useState([ticket.category]);
  const [type, setType] = useState(ticket.type || "—");
  const [tq, setTq] = useState("");
  const addTag = (e) => { if (e.key === "Enter" && tq.trim()) { setTags(t => t.includes(tq.trim()) ? t : [...t, tq.trim()]); setTq(""); } };
  const overdue = ticket.sla === "Breached";
  return (
    <div className="card">
      <div className="props-head"><h3>{status}</h3><button className="icon-btn" style={{ width: 32, height: 32 }}><PanelRight size={16} /></button></div>
      <div className="sla-row">
        <span className="si" style={{ background: overdue ? "var(--danger-soft)" : "var(--warning-soft)", color: overdue ? "var(--danger)" : "var(--warning)" }}><CornerUpLeft size={14} /></span>
        <div><div className="st">First response {overdue ? "overdue by an hour" : `due ${ticket.firstResp}`}</div><div className="sd">Sat 18 Jul 2026, 03:11 pm</div></div>
      </div>
      <div className="sla-row">
        <span className="si" style={{ background: "var(--success-soft)", color: "var(--success)" }}><Timer size={14} /></span>
        <div><div className="st">Resolution due {ticket.resolution}</div><div className="sd">Mon 20 Jul 2026, 03:11 pm</div></div>
      </div>
      <div className="props-body">
        <div className="plab">Properties</div>
        <div>
          <label style={{ display: "block", marginBottom: 7, fontSize: 12, fontWeight: 600 }}>Tags</label>
          <input placeholder="Search tags to add" value={tq} onChange={(e) => setTq(e.target.value)} onKeyDown={addTag} />
          <div className="tagbox">{tags.map(t => (<span className="tg" key={t}><TagIcon size={11} /> {t}<button onClick={() => setTags(x => x.filter(y => y !== t))}><X size={11} /></button></span>))}</div>
        </div>
        {[
          ["Type", ["—", "Question", "Incident", "Problem", "Feature Request", "Refund"], type, setType],
          ["Status", ["New", "Open", "Pending", "Overdue", "Resolved", "Closed"], status, setStatus],
          ["Priority", ["Low", "Medium", "High", "Urgent", "Critical"], prio, setPrio],
          ["Group", ["—", "Student Success", "Payments", "Tech Support", "Placements"], null, null],
          ["Agent", agentOptions, agent, setAgent],
        ].map(([lab, opts, val, set]) => (
          <div key={lab}>
            <label style={{ display: "block", marginBottom: 7, fontSize: 12, fontWeight: 600 }}>{lab}{lab === "Status" && <span style={{ color: "var(--danger)" }}> *</span>}</label>
            {set ? <select value={val} onChange={(e) => set(e.target.value)}>{opts.map(o => <option key={o}>{o}</option>)}</select>
                 : <select defaultValue={opts[0]}>{opts.map(o => <option key={o}>{o}</option>)}</select>}
          </div>
        ))}
        <button className="btn btn-primary" style={{ justifyContent: "center", marginTop: 4 }}>Update</button>
      </div>
    </div>
  );
}

function ThreadEntry({ e }) {
  if (e.type === "note") return (
    <div className="entry">
      <div className="msg-av" style={{ background: "var(--warning)" }}>AD</div>
      <div className="note-card">
        <span className="note-tag"><Lock size={11} /> Internal note · team only</span>
        <div className="msg-head" style={{ marginBottom: 7 }}><b>Admin</b> added a private note · <i>{e.when}</i></div>
        <div className="msg-body">{e.body}</div>
      </div>
    </div>
  );
  if (e.type === "forward") return (
    <div className="entry">
      <div className="msg-av" style={{ background: "var(--accent)" }}>AD</div>
      <div className="fwd-card">
        <span className="fwd-tag"><Forward size={11} /> Forwarded</span>
        <div className="msg-head" style={{ marginBottom: 7 }}><b>Admin</b> forwarded this ticket to <b>{e.to}</b> · <i>{e.when}</i></div>
        {e.cc && <div className="msg-to" style={{ margin: "0 0 6px" }}><b>Cc:</b> {e.cc}</div>}
        {e.body && <div className="msg-body">{e.body}</div>}
        {e.keepThread && <div className="quote">Original conversation was included in the forward.</div>}
      </div>
    </div>
  );
  return (
    <div className="entry">
      <div className="msg-av" style={{ background: "linear-gradient(135deg,var(--primary),var(--accent))" }}>AD</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="msg-head"><b>Admin</b> replied via email · <i>{e.when}</i></div>
        <div className="msg-to"><b>To:</b> {e.to}</div>
        <div className="msg-body">{e.body}</div>
      </div>
    </div>
  );
}

/* ---- ticket-detail sub-modals ---- */
function TdPickModal({ open, title, icon: Ic, options, current, onClose, onApply }) {
  const [v, setV] = useState(current || options[0]);
  useEffect(() => { if (open) setV(current || options[0]); }, [open, current, options]);
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB", width: 32, height: 32 }}><Ic size={16} /></span>{title}</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <div className="chips">{options.map((o) => <button key={o} className={`fchip ${v === o ? "on" : ""}`} onClick={() => setV(o)}>{o}</button>)}</div>
          {current && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Currently: <b style={{ color: "var(--text)" }}>{current}</b></div>}
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" disabled={v === current} onClick={() => onApply(v)}><Check size={15} /> Apply</button></div>
      </div>
    </div>
  );
}

function TdTagsModal({ open, title, existing, bank, onClose, onApply }) {
  const [sel, setSel] = useState([]);
  const [custom, setCustom] = useState("");
  useEffect(() => { if (open) { setSel([]); setCustom(""); } }, [open]);
  if (!open) return null;
  const available = bank.filter((t) => !existing.includes(t));
  const toggle = (t) => setSel((x) => x.includes(t) ? x.filter((y) => y !== t) : [...x, t]);
  const addCustom = () => { const v = custom.trim(); if (!v) return; if (!sel.includes(v)) setSel((x) => [...x, v]); setCustom(""); };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#F59E0B18", color: "#F59E0B", width: 32, height: 32 }}><TagIcon size={16} /></span>{title}</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          {existing.length > 0 && <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 6 }}>Already tagged</div>
            <div className="chips">{existing.map((t) => <span key={t} className="fchip" style={{ cursor: "default", opacity: .7 }}><TagIcon size={11} /> {t}</span>)}</div>
          </div>}
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--faint)", margin: "8px 0 6px" }}>Pick tags</div>
            {available.length ? <div className="chips">{available.map((t) => <button key={t} className={`fchip ${sel.includes(t) ? "on" : ""}`} onClick={() => toggle(t)}><TagIcon size={11} /> {t}</button>)}</div>
              : <div style={{ fontSize: 12.5, color: "var(--muted)" }}>All standard tags are already applied.</div>}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input placeholder="Or add a custom tag…" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
            <button className="btn btn-soft btn-sm" disabled={!custom.trim()} onClick={addCustom}><PlusCircle size={13} /> Add</button>
          </div>
          {sel.length > 0 && <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--faint)", margin: "10px 0 6px" }}>Selected</div>
            <div className="tagbox">{sel.map((t) => <span key={t} className="tg"><TagIcon size={11} /> {t}<button onClick={() => setSel((x) => x.filter((y) => y !== t))}><X size={11} /></button></span>)}</div>
          </div>}
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" disabled={!sel.length} onClick={() => onApply(sel)}><Check size={15} /> Add {sel.length || ""}</button></div>
      </div>
    </div>
  );
}

function TdMergeModal({ open, ticket, tickets, onClose, onApply }) {
  const [q, setQ] = useState("");
  const [target, setTarget] = useState(null);
  useEffect(() => { if (open) { setQ(""); setTarget(null); } }, [open]);
  if (!open) return null;
  const term = q.trim().toLowerCase();
  const candidates = tickets.filter((t) => t.id !== ticket.id && !t.trash && !t.spam)
    .filter((t) => !term || [t.id, t.subject, t.name].filter(Boolean).join(" ").toLowerCase().includes(term))
    .slice(0, 20);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#8B5CF618", color: "#8B5CF6", width: 32, height: 32 }}><FolderInput size={16} /></span>Merge #{ticket.id} into…</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>Pick the ticket to keep as primary. This ticket's conversation is moved into it, then this one is closed as a duplicate.</p>
          <div className="searchbox"><Search size={16} /><input placeholder="Search by ticket #, subject, or customer…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div style={{ maxHeight: 300, overflow: "auto", border: "1px solid var(--border)", borderRadius: 12 }}>
            {candidates.length ? candidates.map((t) => (
              <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid var(--border)", background: target?.id === t.id ? "var(--primary-soft)" : undefined }}>
                <input type="radio" checked={target?.id === t.id} onChange={() => setTarget(t)} />
                <span className="a" style={{ background: avColor(t.name), width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{initials(t.name)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                    <span style={{ fontWeight: 700, color: "var(--primary)", fontSize: 12 }}>#{t.id}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.name} · {t.status} · {Number(t.messageCount) || 0} messages</div>
                </div>
              </label>
            )) : <div style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted)" }}>No matching tickets.</div>}
          </div>
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" disabled={!target} onClick={() => onApply(target)}><FolderInput size={15} /> Merge into #{target?.id || "…"}</button></div>
      </div>
    </div>
  );
}

/* ---- student context UI ---- */
function StuTag({ tone, check, tip, small, children }) {
  return (
    <span className={`stu-tag t-${tone} ${small ? "sm" : ""}`}>
      {!!check && <Check size={small ? 9 : 10} strokeWidth={3.2} />}
      {children}
      {tip && !small && (
        <span className="stu-tip">
          <b>{tip[0]}</b>
          {tip.slice(1).map((l, i2) => <span key={i2}>{l}</span>)}
        </span>
      )}
    </span>
  );
}

function StudentTags({ ticket, onEdit }) {
  const ctx = ticket.studentContext;

  /*
   * Most people who email support are not linked to a platform account, so
   * there is no student context to show. Say that plainly instead of rendering
   * seven pills reading "—", which looks like data that failed to load.
   */
  if (!hasStudentContext(ctx)) {
    return (
      <div className="stu-wrap">
        <div className="stu-row">
          <StuTag tone="x" check={0} tip={["Student record", "Not linked", ticket.registered ? "This contact has an account but no programme data yet." : "No platform account matches " + (ticket.email || "this address") + "."]}>
            {ticket.registered ? "Registered · no programme data" : "Not a registered student"}
          </StuTag>
          <button className="stu-edit" onClick={onEdit} title="Add student details">
            <Pencil size={11} /> Add Student Details
          </button>
        </div>
      </div>
    );
  }

  const pills = stuPills(ctx);
  return (
    <div className="stu-wrap">
      <div className="stu-row">
        {pills.map((p) => <StuTag key={p.key} tone={p.tone} check={p.check} tip={p.tip}>{p.text}</StuTag>)}
        <button className="stu-edit" onClick={onEdit} title="Edit Student Details"><Pencil size={11} /> Edit Student Details</button>
      </div>
      {(ticket.stuActivity || []).length > 0 && (
        <div className="stu-activity">
          {ticket.stuActivity.slice(-2).reverse().map((a, i2) => (
            <span key={i2}><History size={11} /> <b>{a.by}</b> changed {a.field} from "{a.from}" to "{a.to}" — {a.when}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function StudentEditModal({ ticket, onClose, onSave }) {
  /* ticket.studentContext is null until someone fills it in -- spreading
     null would make every field undefined and the form uncontrolled. */
  const [c, setC] = useState(() => ({ ...(ticket.studentContext || {}) }));
  const set = (k, v) => setC((x) => ({ ...x, [k]: v }));
  const Row = ({ label, children }) => (
    <div className="stu-edit-row"><label>{label}</label>{children}</div>
  );
  const EnumSel = ({ field }) => (
    <select value={c[field]} onChange={(e) => set(field, e.target.value)}>
      {Object.entries(STU_ENUMS[field]).map(([v, [lbl]]) => <option key={v} value={v}>{lbl}</option>)}
    </select>
  );
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 470 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "var(--primary-soft)", color: "var(--primary)", width: 32, height: 32 }}><GraduationCap size={16} /></span>Edit Student Details</div>
          <button className="icon-btn" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="modal-body stu-edit-grid">
          <Row label="Registration Status"><EnumSel field="registrationStatus" /></Row>
          <Row label="Domain">
            <select value={c.domain} onChange={(e) => set("domain", e.target.value)}>
              {STU_DOMAINS.map((d) => <option key={d} value={stuMachine(d)}>{d}</option>)}
            </select>
          </Row>
          <Row label="Exam Status"><EnumSel field="examStatus" /></Row>
          <Row label="Start Date"><input type="date" value={c.startDate || ""} onChange={(e) => set("startDate", e.target.value)} /></Row>
          <Row label="Project Status"><EnumSel field="projectStatus" /></Row>
          <Row label="Refund Eligibility"><EnumSel field="refundEligibility" /></Row>
          <Row label="Batch"><input value={c.batch} onChange={(e) => set("batch", e.target.value)} placeholder="DA-B12" /></Row>
          <Row label="Enrollment Status"><EnumSel field="enrollmentStatus" /></Row>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={() => onSave(c)}><Save size={13} /> Save Changes</button>
        </div>
      </div>
    </div>
  );
}

/*
 * What the single-ticket endpoint knows and the list does not.
 *
 * A whitelist rather than a blind merge: the list row is kept live by the
 * store, so an optimistic status or priority change lands there first. Letting
 * the last fetched detail overwrite the whole row would make those changes
 * appear to revert until the next refetch.
 */
const CONTACT_FIELDS = ["phone", "contactId", "registered", "blocked", "userId", "college",
                        "program", "enrollId", "totalTickets", "joined", "notes", "meta",
                        "studentContext"];

function TicketDetailPage({ ticket: listTicket, onBack, onPrev, onNext, tickets, setTickets, onOpenTicket, initialCompose }) {
  /*
   * The contact half of the ticket, from the single-ticket endpoint. Null
   * until it arrives, and cleared whenever a different ticket is opened so one
   * person's number can never be shown under another's name.
   */
  const [detail, setDetail] = useState(null);
  const ticket = useMemo(() => {
    if (!detail || detail.id !== listTicket.id) return listTicket;
    const overlay = {};
    CONTACT_FIELDS.forEach((k) => { if (detail[k] !== undefined) overlay[k] = detail[k]; });
    return { ...listTicket, ...overlay };
  }, [listTicket, detail]);

  const Src = SOURCE_ICON[ticket.source];
  const sla = slaStyle[ticket.sla];
  const push = useToast();
  const desk = useDesk();

  /*
   * The conversation lives on the server, not in this component. `thread` is
   * the real message list for this ticket; it is refetched whenever the ticket
   * changes and after anything is added to it, so the panel always shows what
   * was actually sent rather than an optimistic guess about it.
   */
  const [thread, setThread] = useState([]);
  const [threadLoading, setThreadLoading] = useState(true);
  const [threadError, setThreadError] = useState(null);

  const ticketId = ticket ? ticket.id : null;

  const loadThread = useCallback(async (opts = {}) => {
    if (!ticket || !ticket.id) return;
    if (!opts.silent) setThreadLoading(true);
    try {
      const res = await fdTicketsApi.get(ticket.id);
      // A merged ticket answers with a redirect instead of a conversation.
      if (res.redirect_to) {
        push({ type: "info", title: "Ticket was merged", desc: `Showing #${res.redirect_to} instead.` });
        setThread([]);
        return;
      }
      setThread(res.convo || []);
      // The half of the ticket only this endpoint returns -- see CONTACT_FIELDS.
      if (res.ticket) setDetail(res.ticket);
      setThreadError(null);
    } catch (err) {
      if (err.canceled) return;
      setThreadError(err.message);
    } finally {
      if (!opts.silent) setThreadLoading(false);
    }
    // Plain value, not `ticket && ticket.id`: a computed expression in a
    // dependency array cannot be checked statically, and this one changed
    // identity on every render where ticket was falsy.
  }, [ticketId]);

  /*
   * Reset and load whenever a DIFFERENT ticket is opened.
   *
   * The other values this reads (ticket.status, ticket.newReplies, desk) are
   * deliberately not dependencies: this is "on open", not "on every change".
   * Including them would re-blank the composer and re-fetch the thread every
   * time a realtime update touched the row -- while the agent was typing in it.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setStarred(false); setStatus(ticket.status); setMode(null); setComposerOpen(false);
    setThread([]);
    setDetail(null);
    loadThread();
    // Opening a ticket is reading it -- clear the unread badge in the list too.
    if (ticket.newReplies > 0 && desk.markRead) desk.markRead(ticket.id);
  }, [ticketId]);

  /*
   * New mail on THIS ticket while the agent is looking at it must appear in the
   * open thread, not just bump a counter in the list behind it.
   *
   * Keyed on the realtime clock, lifted into a plain variable so the dependency
   * is statically checkable. Silent, so it never shows a loading state over a
   * conversation the agent is already reading.
   */
  const lastRealtimeAt = desk.realtime ? desk.realtime.lastEventAt : null;
  useEffect(() => {
    if (!lastRealtimeAt) return;
    loadThread({ silent: true });
  }, [lastRealtimeAt, loadThread]);

  /**
   * Send a reply / forward / note.
   *
   * Returns as soon as the message is on screen. The network call runs after
   * this function has finished, so the composer can clear and fold away in the
   * same frame as the click rather than waiting on SMTP.
   *
   * Failure is shown where the message is, not where the composer was: the row
   * stays in the thread marked "Not delivered", still holding the agent's text,
   * with a Retry button. Putting the words back into a box the agent has
   * already moved on from loses them more often than it saves them.
   */
  const add = (entry) => {
    // Negative id, so an optimistic row can never collide with a real one.
    const tempId = -Date.now();
    const me = currentAgentProfile();

    setThread((t) => [...t, {
      id: tempId,
      who: entry.type === "note" ? "note" : "agent",
      type: entry.type,
      html: entry.body,
      msg: String(entry.body || "").replace(/<[^>]*>/g, " ").trim(),
      from: me.name || "Support",
      sentBy: me.name || "",
      to: parseAddressList(entry.to) || [],
      cc: parseAddressList(entry.cc) || [],
      at: "just now",
      atIso: new Date().toISOString(),
      ago: "just now",
      status: "queued",              // renders the "Sending…" chip
      attachments: [],
      pending: true,
      // Kept so Retry can send exactly this again -- nothing was stored on the
      // server for a row that never got there, so there is no id to retry with.
      retryPayload: entry,
    }]);

    // The composer's work is done the moment the message is in the thread.
    setComposerOpen(false);
    setMode(null);
    if (entry.type !== "note") setStatus((st) => (st === "New" ? "Pending" : st));

    /*
     * Fired, not awaited. sendMessage() raises its own toasts for both the
     * success and the two kinds of failure, so nothing is swallowed here.
     */
    (async () => {
      try {
        const res = await desk.sendMessage({
          ticketId: ticket.id,
          type: entry.type,
          body: entry.body,
          to: parseAddressList(entry.to),
          cc: parseAddressList(entry.cc),
          bcc: parseAddressList(entry.bcc),
          attachmentIds: entry.attachmentIds || [],
          includeAttachments: entry.keepThread !== false,
        });

        /*
         * res.sent === false is the soft failure: the message WAS stored, the
         * mail server just would not take it. Refetching is still right --
         * the stored row comes back with a real id and its own failed state,
         * so Retry goes through the server's own retry path.
         *
         * The refetch also removes the optimistic row, which is not in the
         * response, and replaces it with the authoritative copy carrying the
         * real id, the stored attachments and the delivery status.
         */
        await loadThread({ silent: true });
      } catch (err) {
        // Nothing reached the server, so there is nothing to refetch. Mark the
        // row the agent is already looking at, and undo the status the send
        // optimistically moved the ticket to.
        setThread((t) => t.map((m) => (m.id === tempId
          ? { ...m, status: "failed", pending: false,
              error: err.message || "Could not reach the server." }
          : m)));
        if (entry.type !== "note") setStatus(ticket.status);
      }
    })();

    return true;
  };

  /*
   * These two are handed to every MessageEntry, which is memoised. A fresh
   * arrow function on each render would change their identity and re-render the
   * whole thread on every keystroke in the composer, which is exactly the
   * sluggishness memo was added to remove.
   *
   * push() comes from context and is itself rebuilt on each render of the
   * shell, so it is read through a ref rather than listed as a dependency.
   */
  const pushRef = useRef(push);
  pushRef.current = push;
  const addRef = useRef(add);
  addRef.current = add;

  const retryMessage = useCallback(async (m) => {
    /*
     * A negative id means this message never got as far as the database, so
     * there is nothing on the server to retry -- send it again from the payload
     * the row kept. addRef is used rather than add itself so this callback
     * keeps a stable identity and the memoised thread does not re-render.
     */
    if (m.id < 0) {
      if (!m.retryPayload) {
        pushRef.current({ type: "error", title: "Nothing to retry", desc: "Write the message again." });
        return;
      }
      setThread((t) => t.filter((x) => x.id !== m.id));   // the resend adds a fresh row
      addRef.current(m.retryPayload);
      return;
    }

    setThread((t) => t.map((x) => (x.id === m.id ? { ...x, status: "queued" } : x)));
    try {
      const res = await fdMessages.retry(m.id);
      await loadThread({ silent: true });
      pushRef.current(res.sent
        ? { type: "success", title: "Message resent" }
        : { type: "error", title: "Still not delivered", desc: res.error });
    } catch (err) {
      await loadThread({ silent: true });
      pushRef.current({ type: "error", title: "Retry failed", desc: err.message });
    }
  }, [loadThread]);

  const deleteNote = useCallback(async (m) => {
    try {
      await fdMessages.deleteNote(m.id);
      await loadThread({ silent: true });
      pushRef.current({ type: "success", title: "Note deleted" });
    } catch (err) {
      pushRef.current({ type: "error", title: "Could not delete the note", desc: err.message });
    }
  }, [loadThread]);

  const noteCount = thread.filter((e) => e.who === "note").length;

  /*
   * The most recent outbound reply, for the composer's collision warning.
   * Notes are excluded: they never reach the customer.
   */
  const lastAgentReply = useMemo(() => {
    for (let i = thread.length - 1; i >= 0; i--) {
      const m = thread[i];
      if (m.who === "agent" && m.type !== "note") {
        return { who: m.sentBy || m.from || "Another agent", when: m.ago || m.at || "earlier" };
      }
    }
    return null;
  }, [thread]);

  const [starred, setStarred] = useState(false);
  const [status, setStatus] = useState(ticket.status);
  const [mode, setMode] = useState(null);                    // "Reply" | "Note" | "Forward"
  const [composerOpen, setComposerOpen] = useState(false);   // hidden until Reply/Note/Forward is clicked
  const [focusTick, setFocusTick] = useState(0);
  const [confirm, setConfirm] = useState(null);
  const [stuEdit, setStuEdit] = useState(false);
  const saveStudentCtx = async (next) => {
    const prev = ticket.studentContext || {};
    const FIELD_LBL = { registrationStatus: "Registration Status", domain: "Domain", examStatus: "Exam Status", startDate: "Start Date", projectStatus: "Project Status", refundEligibility: "Refund Eligibility", batch: "Batch", enrollmentStatus: "Enrollment Status" };
    const disp = (f, v) => f === "domain" ? stuDomainLabel(v) : f === "startDate" ? stuDateDisplay(v) : f === "batch" ? v : (STU_ENUMS[f] && STU_ENUMS[f][v] ? STU_ENUMS[f][v][0] : v);
    const by = currentAgentProfile().name;
    const entries = Object.keys(FIELD_LBL).filter((f) => prev[f] !== next[f]).map((f) => ({ by, field: FIELD_LBL[f], from: disp(f, prev[f]), to: disp(f, next[f]), when: "just now", at: Date.now() }));
    if (!entries.length) { setStuEdit(false); return; }
    setTickets((ts) => ts.map((t) => t.id === ticket.id ? { ...t, studentContext: next, stuActivity: [...(t.stuActivity || []), ...entries] } : t));
    try {
      const saved = JSON.parse(kvGetSync("hh-student-ctx") || "{}");
      saved[ticket.id] = next;
      await kvSet("hh-student-ctx", JSON.stringify(saved));
    } catch (e) {}
    setStuEdit(false);
    push({ type: "success", title: "Student details updated", desc: entries.map((e2) => e2.field).join(", ") + " changed." });
  };
  const [moreOpen, setMoreOpen] = useState(false);
  const [acts, setActs] = useState(false);
  const moreRef = useRef(null);
  const composerRef = useRef(null);
  useClickAway(moreRef, () => setMoreOpen(false));

  /*
   * A hover card's "Reply" / "Add note" arrives as a compose intent on the URL
   * state. Honour it once the ticket has actually rendered, so the composer is
   * open and focused by the time the agent's eyes get there.
   */
  useEffect(() => {
    if (!initialCompose) return undefined;
    const id = setTimeout(() => focusComposer(initialCompose), 120);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCompose, ticket.id]);

  const focusComposer = (which) => {
    setComposerOpen(true);
    setMode(which);
    setFocusTick((t) => t + 1); // if already open, this just re-focuses the editor
    /* Bring the end of the conversation into view inside its own scroller.
       scrollIntoView on the composer would move the PAGE, which no longer
       scrolls -- so nothing happened and the editor stayed below the fold. */
    /*
     * The conversation COLUMN is the scroller (the composer lives inside it).
     * Twice on purpose: once now for the case where the composer was already
     * open, and again after .comp-collapse has finished its 280ms expand --
     * before that it has no height, so there is nothing to scroll to.
     */
    const bringIntoView = () => {
      const el = document.querySelector(".td-convo");
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    };
    requestAnimationFrame(bringIntoView);
    setTimeout(bringIntoView, 320);
    // re-set null on next tick so a second click on the same tab still switches & re-focuses
    /* setMode(null) on the next tick so clicking the same tab again still
       switches and re-focuses. The composer is brought into view by
       bringIntoView() above, which scrolls the conversation column and nothing
       else -- see the note on scrollWithin(). */
    setTimeout(() => setMode(null), 60);
  };
  /* Every property change is persisted, not just reflected locally. The
     optimistic patch + rollback lives in useFreshdeskData.updateTicket, so a
     rejected change snaps back instead of leaving the UI disagreeing with the
     database. */
  const saveField = async (fields) => {
    try { await desk.updateTicket(ticket.id, fields); }
    catch (err) { /* the toast and the rollback both come from updateTicket */ }
  };

  /*
    * Close, with no confirmation step.
    *
    * Closing is not destructive -- the ticket keeps every message and reopens
    * by itself the moment the customer writes again -- so a dialog in front of
    * it was pure friction on the single most-used button on this screen. The
    * toast carries an Undo instead, which is the right shape for a reversible
    * action.
    *
    * Then leave: an agent who has just closed a ticket is done with it, and
    * staying on a screen whose only remaining action is "reopen" is a dead end.
    */
  const closeTicket = async () => {
    if (status === "Closed") return;
    const was = status;
    setStatus("Closed");
    try {
      await saveField({ status: "Closed" });
      fireConfetti();
      push({
        type: "success",
        title: `#${ticket.id} closed`,
        desc: "Moving to the next ticket.",
        action: {
          label: "Undo",
          run: async () => { setStatus(was); await saveField({ status: was }); },
        },
      });
      /*
       * Straight on to the next one in the queue rather than back to the list.
       * Closing tickets is done in a run; bouncing out to the list after each
       * one means finding your place again every time.
       */
      if (onNext) onNext(); else if (onBack) onBack();
    } catch (err) {
      setStatus(was);            // saveField raised its own toast
    }
  };
  /*
   * The properties column is closed on arrival, every time. Not remembered:
   * the conversation is the reason this screen exists, and a panel that
   * reopens itself is one the agent closes again on every ticket.
   */
  const [propsOpen, setPropsOpen] = useState(false);
  /*
   * The queue collapses the same way the properties panel does. Not persisted:
   * it is a "give me room for a moment" gesture, and a list that stayed hidden
   * across visits would look like the queue had broken.
   */
  const [queueOpen, setQueueOpen] = useState(true);
  /*
   * Which tickets the rail lists. Open by default -- see QUEUE_FILTERS. It
   * lives here rather than in the rail because the control that changes it
   * sits in the properties column, on the other side of the conversation.
   */
  const [queueFilter, setQueueFilter] = useState("open");
  /* What each segment of that control says. Off the same working set the rail
     lists, so closing a ticket moves both the list and the numbers at once. */
  const queueCounts = useMemo(() => {
    const list = tickets || [];
    return {
      open: list.filter((t) => queueMatches(t, "open")).length,
      closed: list.filter((t) => queueMatches(t, "closed")).length,
      all: list.filter((t) => queueMatches(t, "all")).length,
    };
  }, [tickets]);
  /* The conversation's own scroller -- the page no longer scrolls, so anything
     that wants to "scroll into view" has to move THIS. */
  const threadScrollRef = useRef(null);

  /* Which attachment set the lightbox is showing, and where in it. */
  const [preview, setPreview] = useState(null);   // { list, index } | null
  const openPreview = useCallback((list, index) => setPreview({ list, index }), []);

  const [pickModal, setPickModal] = useState(null);           // "dept" | "tag" | "merge"
  const [duplicateBusy, setDuplicateBusy] = useState(false);

  const doMore = (label) => {
    setMoreOpen(false);
    if (label === "Delete Ticket") {
      /*
       * Two-step, matching the backend: a live ticket goes to Trash, and only a
       * ticket already IN Trash is destroyed. Permanent deletion of a customer
       * conversation is not recoverable from anywhere, so it is never one click
       * away from the normal working view.
       */
      const permanent = !!ticket.trash;
      setConfirm({
        title: permanent ? "Delete permanently" : "Move to Trash",
        msg: permanent
          ? `Permanently delete #${ticket.id} and its entire conversation, including attachments? This cannot be undone.`
          : `Move #${ticket.id} to Trash? You can restore it from the Trash view.`,
        label: permanent ? "Delete Forever" : "Move to Trash",
        danger: true,
        run: async () => {
          try {
            if (permanent) await desk.removeTickets([ticket.id]);
            else await desk.setTrash([ticket.id], true);
            setTimeout(() => { onBack && onBack(); }, 200);
          } catch (err) { /* toast comes from the store */ }
        },
      });
      return;
    }
    if (label === "Print Summary") { window.print(); return; }
    if (label === "Copy Link") { try { navigator.clipboard.writeText(`${window.location.origin}/tickets/${ticket.id}`); } catch (e) {} push({ type: "success", title: "Link copied" }); return; }
    if (label === "Change Department") { setPickModal("dept"); return; }
    if (label === "Add Tag") { setPickModal("tag"); return; }
    if (label === "Merge with...") { setPickModal("merge"); return; }
    if (label === "Duplicate Ticket") {
      /*
       * A real ticket, through the API. This used to build a copy in local
       * state with a random six-digit id -- it was never saved, collided with
       * nothing, and disappeared on reload.
       */
      setDuplicateBusy(true);
      desk.createTicket({
        subject: `${ticket.subject} (copy)`,
        email: ticket.email,
        name: ticket.name,
        phone: ticket.phone,
        priority: ticket.priority,
        category: ticket.category,
        dept: ticket.dept,
        source: ticket.source,
        status: "Open",
        tags: ticket.tags || [],
      })
        .catch(() => { /* createTicket raised the toast */ })
        .finally(() => setDuplicateBusy(false));
      return;
    }
    push({ type: "info", title: label, desc: `${label} applied to #${ticket.id}.` });
  };
  const timeline = [
    { icon: Ticket, color: "#5B5CEB", txt: `${ticket.name} raised the ticket`, when: ticket.created },
    { icon: UserPlus, color: "#0EA5E9", txt: `Assigned to ${ticket.agent}`, when: ticket.created },
    ...thread.map((e) => ({
      icon: e.who === "note" ? Lock : e.type === "forward" ? Forward : e.who === "cust" ? Mail : Reply,
      color: e.who === "note" ? "#F59E0B" : e.type === "forward" ? "#0EA5E9" : e.who === "cust" ? "#5B5CEB" : "#10B981",
      txt: e.who === "note" ? "Internal note added"
         : e.type === "forward" ? `Forwarded to ${(e.to || []).join(", ")}`
         : e.who === "cust" ? `${e.from} replied by email`
         : `Replied to customer${e.sentBy ? " by " + e.sentBy : ""}`,
      when: e.ago || e.at,
    })),
    ...(starred ? [{ icon: Star, color: "#F59E0B", txt: "Ticket starred", when: "just now" }] : []),
    ...(status !== ticket.status ? [{ icon: CheckCheck, color: "#10B981", txt: `Status changed to ${status}`, when: "just now" }] : []),
  ];
  /*
   * The ticket's state chips, rendered into the properties column.
   * Small and wrapped tight -- this is reference material beside the
   * conversation, not a headline above it.
   */
  const ticketBadges = (
    <>
      <StatusBadge s={status} />
      <PrioBadge p={ticket.priority} />
      <span className="sla" style={{ background: sla.bg, color: sla.fg }}>
        <AlertCircle size={11} /> First response {ticket.sla === "Breached" ? "overdue" : `due ${ticket.firstResp}`}
      </span>
      <span className="chip">{ticket.category}</span>
      {starred && (
        <span className="badge-pill" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>
          <Star size={10} fill="var(--warning)" /> Starred
        </span>
      )}
      <StudentTags ticket={ticket} onEdit={() => setStuEdit(true)} />
    </>
  );

  const more = [
    ["Change Department", Building2], ["Duplicate Ticket", Copy], ["Merge with...", FolderInput],
    ["Add Tag", TagIcon], ["Copy Link", Link2], ["Print Summary", Printer], ["Delete Ticket", Trash2],
  ];

  return (
    <div className="content route content-fixed">

      <div className={`td-grid ${propsOpen ? "" : "props-shut"} ${queueOpen ? "" : "queue-shut"}`}>
        {/* The queue you were working, kept to hand. */}
        {queueOpen && (
          <TicketQueue tickets={tickets || []} currentId={ticket.id} filter={queueFilter}
                       onOpen={(t) => (onOpenTicket ? onOpenTicket(t) : null)}
                       onCollapse={() => setQueueOpen(false)} />
        )}

        <div className="card card-pad td-convo">
          <div className="td-bar">
            {!queueOpen && (
              <button className="icon-btn" title="Show the ticket list" onClick={() => setQueueOpen(true)}>
                <PanelLeftOpen size={17} />
              </button>
            )}
            <button className="icon-btn" title={starred ? "Unstar" : "Star ticket"} onClick={() => { setStarred((v) => !v); push({ type: "success", title: starred ? "Ticket unstarred" : "Ticket starred", desc: `#${ticket.id}` }); }}>
              <Star size={17} fill={starred ? "#F59E0B" : "none"} color={starred ? "#F59E0B" : "currentColor"} />
            </button>
            <button className={`btn btn-ghost btn-sm ${mode === "Reply" ? "on" : ""}`} onClick={() => focusComposer("Reply")}><Reply size={15} /> Reply</button>
            <button className={`btn btn-ghost btn-sm ${mode === "Note" ? "on" : ""}`} onClick={() => focusComposer("Note")}><Lock size={15} /> Note{noteCount > 0 && <span className="count-badge" style={{ fontSize: 10, padding: "0 6px" }}>{noteCount}</span>}</button>
            <button className={`btn btn-ghost btn-sm ${mode === "Forward" ? "on" : ""}`} onClick={() => focusComposer("Forward")}><Forward size={15} /> Forward</button>
            <button className="btn btn-ghost btn-sm" onClick={closeTicket} disabled={status === "Closed"}><CheckCheck size={15} /> {status === "Closed" ? "Closed" : "Close"}</button>
            <div className="dd-wrap" ref={moreRef}>
              <button className="icon-btn" title="More actions" onClick={() => setMoreOpen((o) => !o)}><MoreHorizontal size={17} /></button>
              {moreOpen && (
                <div className="menu menu-top left" style={{ minWidth: 210 }}>
                  {more.map(([label, Ic]) => (
                    <button key={label} className={`mi ${label === "Delete Ticket" ? "danger" : ""}`} style={{ padding: "9px 11px" }} onClick={() => doMore(label)}>
                      <span className="mic" style={{ background: "var(--surface-2)" }}><Ic size={14} /></span> {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="sp" />
            <button className="btn btn-ghost btn-sm" onClick={() => setActs(true)}><Activity size={15} /> Activities{timeline.length > 0 && <span className="count-badge" style={{ fontSize: 10, padding: "0 6px" }}>{timeline.length}</span>}</button>
            <button className="icon-btn" title="Previous ticket" onClick={onPrev}><ChevronLeft size={17} /></button>
            <button className="icon-btn" title="Next ticket" onClick={onNext}><ChevronRight size={17} /></button>
            <button className={`icon-btn ${propsOpen ? "on" : ""}`}
                    title={propsOpen ? "Hide ticket properties" : "Show ticket properties"}
                    onClick={() => setPropsOpen((v) => !v)}>
              {propsOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
            </button>
          </div>

          <div className="td-subj">
            <span className="env"><Src size={18} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2>{ticket.subject || "(no subject)"}</h2>
              {/* Under the title rather than beside it: a long subject wraps,
                  and a badge on the same line would end up orphaned. */}
              {status === "New" && <span className="subj-new">New</span>}
            </div>
          </div>

          {/* Only this scrolls. */}
          <div className="td-thread" ref={threadScrollRef}>
          {threadLoading && thread.length === 0 && (
            <div className="entry" style={{ marginTop: 8 }}>
              <div className="msg-av" style={{ background: "var(--border)" }}><Spinner /></div>
              <div style={{ flex: 1 }}><div className="msg-head">Loading the conversation…</div></div>
            </div>
          )}

          {threadError && (
            <div className="msg-error" style={{ marginTop: 12 }}>
              <AlertCircle size={14} /> Could not load this conversation: {threadError}
              <button className="btn btn-soft btn-sm" onClick={() => loadThread()}><RefreshCw size={13} /> Retry</button>
            </div>
          )}

          {!threadLoading && !threadError && thread.length === 0 && (
            <div className="entry" style={{ marginTop: 8 }}>
              <div className="msg-av" style={{ background: avColor(ticket.name) }}>{initials(ticket.name)}</div>
              <div style={{ flex: 1 }}>
                <div className="msg-head"><b>{ticket.name}</b> · <i>{ticket.created}</i></div>
                <div className="msg-body" style={{ color: "var(--muted)" }}>
                  This ticket has no stored messages yet. If it was just created by an agent,
                  send the first reply below.
                </div>
              </div>
            </div>
          )}

          <ThreadList thread={thread} onRetry={retryMessage} onDeleteNote={deleteNote}
                      onPreview={openPreview} />
          </div>

          {!composerOpen && (
            <div className="reply-bar" ref={composerRef}>
              <button className="btn btn-primary" onClick={() => focusComposer("Reply")}><Reply size={15} /> Reply</button>
              <button className="btn btn-soft" onClick={() => focusComposer("Note")}><Lock size={15} /> Add Note</button>
              <button className="btn btn-soft" onClick={() => focusComposer("Forward")}><Forward size={15} /> Forward</button>
              <span className="hint">Reading mode — the editor opens only when you need it.</span>
            </div>
          )}
          <div ref={composerOpen ? composerRef : undefined} className={`comp-collapse ${composerOpen ? "open" : ""}`} aria-hidden={!composerOpen}>
            <div>
              <div style={{ paddingTop: 18, borderTop: "1px solid var(--border)" }}>
                <ReplyComposer key={ticket.id} ticket={ticket} onSend={add} mode={mode} focusTick={focusTick}
                               onClose={() => setComposerOpen(false)} lastAgentReply={lastAgentReply} />
              </div>
            </div>
          </div>
        </div>

        {propsOpen && (
          <div className="props">
            <QueueFilterPanel value={queueFilter} onChange={setQueueFilter}
                              counts={queueCounts} />
            <ContactPanel ticket={ticket} badges={ticketBadges} />
            <PropertiesPanel ticket={ticket} />
          </div>
        )}
        {/* Outside the column: the dialog must survive the column closing. */}
        {stuEdit && <StudentEditModal ticket={ticket} onClose={() => setStuEdit(false)} onSave={saveStudentCtx} />}
      </div>

      {/* Activities side drawer */}
      {acts && (<>
        <div className="drawer-overlay" onClick={() => setActs(false)} />
        <div className="drawer">
          <div className="drawer-head">
            <h3 className="card-title"><Activity size={16} style={{ verticalAlign: "-3px", marginRight: 7, color: "var(--primary)" }} />Ticket Activity <span className="count-badge" style={{ marginLeft: 5 }}>{timeline.length}</span></h3>
            <button className="icon-btn" onClick={() => setActs(false)}><X size={17} /></button>
          </div>
          <div className="drawer-body">
            {timeline.length === 0 ? <EmptyState icon={Activity} title="No activity yet" desc="Actions taken on this ticket will show up here." />
              : timeline.map((a, i) => (
                <div className="act-item" key={i} style={{ padding: "12px 0" }}>
                  <span className="ai" style={{ background: `${a.color}18`, color: a.color }}><a.icon size={16} /></span>
                  <div style={{ minWidth: 0 }}><div className="at">{a.txt}</div><div className="am"><span>{a.when}</span></div></div>
                </div>
              ))}
          </div>
        </div>
      </>)}

      <TdPickModal open={pickModal === "dept"} title={`Change department for #${ticket.id}`} icon={Building2}
        current={ticket.dept} options={DEPTS} onClose={() => setPickModal(null)}
        onApply={(v) => {
          // saveField goes through the store: optimistic locally, persisted
          // server-side, rolled back if the API rejects it.
          saveField({ dept: v });
          setPickModal(null);
        }} />

      <TdTagsModal open={pickModal === "tag"} title={`Add tag to #${ticket.id}`}
        existing={ticket.tags || []} bank={TAG_BANK} onClose={() => setPickModal(null)}
        onApply={(tags) => {
          const next = Array.from(new Set([...(ticket.tags || []), ...tags]));
          saveField({ tags: next });
          setPickModal(null);
        }} />

      <TdMergeModal open={pickModal === "merge"} ticket={ticket} tickets={tickets || []} onClose={() => setPickModal(null)}
        onApply={(target) => {
          /*
           * The modal's label reads "Merge into #<target>", so TARGET is the
           * survivor and the ticket currently open is the one folded into it.
           *
           * The server moves messages and attachments across and leaves the
           * source as a tombstone pointing at the survivor, so old links -- and
           * any [#IS-nnn] token still sitting in a customer's mail client --
           * keep resolving. Afterwards this ticket no longer has a
           * conversation of its own, so we navigate away from it.
           */
          if (!target || !target.id) return;
          desk.mergeTickets(target.id, [ticket.id])
            .then(() => { setPickModal(null); onBack && onBack(); })
            .catch(() => { /* mergeTickets reported it and reloaded */ });
        }} />

      {preview && (
        <AttachmentPreview attachments={preview.list} startIndex={preview.index}
                           onClose={() => setPreview(null)} />
      )}

      <ConfirmDialog open={!!confirm} danger={confirm?.danger} title={confirm?.title || ""} message={confirm?.msg || ""} confirmLabel={confirm?.label || "Confirm"}
        onConfirm={() => confirm?.run()} onClose={() => setConfirm(null)} />
    </div>
  );
}

export {
  CannedPopup,
  ContactPanel,
  MessageEntry,
  PropertiesPanel,
  ReplyComposer,
  StuTag,
  StudentEditModal,
  StudentTags,
  TdMergeModal,
  TdPickModal,
  TdTagsModal,
  ThreadEntry,
  TicketDetailPage,
};
