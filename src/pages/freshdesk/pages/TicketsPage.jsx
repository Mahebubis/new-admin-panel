/*
 * src/pages/freshdesk/pages/TicketsPage.jsx
 *
 * The ticket list: the eight sidebar views, search, the filter drawer, sorting,
 * card/table layouts and every bulk action.
 *
 * Filtering happens client-side over the working set held by useFreshdeskData,
 * which is what makes switching views instant. Bulk actions go through the
 * store so they are persisted and rolled back on failure.
 */
import { Activity, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown, Bold, Building2, CalendarDays, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, Clock, Code, Copy, Download, Eye, FileSpreadsheet, FileText, FolderInput, Headphones, Inbox, Italic, LayoutGrid, Link2, List, ListOrdered, Loader2, Lock, Mail, MessageSquareText, MoreHorizontal, MoreVertical, Paperclip, Pencil, Printer, Reply, RotateCcw, Rows3, Search, ShieldX, SlidersHorizontal, Tag as TagIcon, Trash, Trash2, Underline, User, UserCheck, UserPlus, X } from "lucide-react";
import { BULK_AGENTS, BULK_PRIORITY, BULK_STATUS, CATS, DEPTS, EMPTY, SORTS, STATUS_OPTS, TAG_BANK, TICKET_TYPES, VIEWS, avColor, initials, prioColor, prioStyle, slaStyle, statusStyle } from "../fdConstants";
import { useCallback, useEffect, useMemo, useRef, useState  } from "react";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useTicketList } from "../useFreshdeskData";
import { ConfirmDialog, downloadBlob, EmptyState, exportCSV, exportExcel, exportPDF, Portal, PrioBadge, Spinner, StatusBadge, useClickAway, useDesk, useToast } from "../fdShared";

/* ============================================================================
   TICKETS PAGE
   ========================================================================== */
/*
 * The view list.
 *
 * Collapsed by default, the way Freshdesk's is. Collapsed does NOT mean hidden:
 * the row you are actually on stays visible, because a navigation panel that
 * cannot tell you where you are is worse than no panel. Opening it reveals the
 * rest; the choice is remembered per browser.
 */
/*
 * The view list.
 *
 * Collapsed it is a single 34px button, not a narrow card: a panel that is
 * "closed" but still holds a column of the grid is just a smaller panel. The
 * grid track collapses with it, so the ticket list gets the whole width back.
 *
 * It starts collapsed on every visit. This is navigation you use when you
 * change queue, which is rarely; the tickets are what you came for.
 */
function TicketSidebar({ view, setView, counts, setOpen }) {
  const shown = VIEWS.filter((v) => !v.hidden);

  const Row = ({ v }) => (
    <div className={`tnav-item ${view === v.key ? "on" : ""}`} onClick={() => setView(v.key)}>
      <v.icon size={16} /> <span className="tnav-lab">{v.label}</span>
      <span className="c">{counts[v.key]}</span>
    </div>
  );

  return (
    <div className="card card-pad tnav">
      <button className="grp" onClick={() => setOpen(false)} aria-expanded>
        <PanelLeftClose size={15} />
        <span style={{ flex: 1, textAlign: "left" }}>Default</span>
      </button>
      <div className="tnav-list">
        {shown.slice(0, 5).map((v) => <Row key={v.key} v={v} />)}
        <div className="tnav-sep" />
        {shown.slice(5).map((v) => <Row key={v.key} v={v} />)}
      </div>

      {/* The header carries the split for the selected view now, so this
          panel does not repeat it. */}
    </div>
  );
}

/* Pagination. Rendered above AND below the list -- on a 30-row page the bottom
   control is off-screen when you arrive, which is exactly when you want it. */
function Pager({ page, pages, perPage, total, onPage, onPerPage, compact, navOpen, onNav }) {
  return (
    <div className={`pager ${compact ? "pager-top" : ""}`}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {/* The views toggle sits with the row count -- the two things that
            describe what the list is currently showing. */}
        {onNav && (
          <button className={`icon-btn sm ${navOpen ? "on" : ""}`}
                  title={navOpen ? "Hide views" : "Show views"} onClick={onNav}>
            {navOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </button>
        )}
        <div className="info">
          Showing {total === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of{" "}
          {total.toLocaleString("en-IN")} tickets
        </div>
        {!compact && (
          <div className="perpage">Per page{" "}
            <select value={perPage} onChange={(e) => onPerPage(Number(e.target.value))}>
              {[10, 30, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="pg-btns">
        <button disabled={page === 1} onClick={() => onPage(page - 1)}><ChevronLeft size={15} /> Prev</button>
        {pageWindow(page, pages).map((p, i) =>
          p === "…"
            ? <span key={`gap${i}`} className="pg-gap">…</span>
            : <button key={p} className={p === page ? "on" : ""} onClick={() => onPage(p)}>{p}</button>
        )}
        <button disabled={page === pages} onClick={() => onPage(page + 1)}>Next <ChevronRight size={15} /></button>
      </div>
    </div>
  );
}

function SortDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false); const ref = useRef(null);
  useEffect(() => { const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false); document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  return (
    <div className="dd" ref={ref}>
      <button className="btn btn-ghost" onClick={() => setOpen(o => !o)}><ArrowUpDown size={15} /> Sort: <b style={{color:"var(--primary)"}}>{value}</b> <ChevronDown size={14} /></button>
      {open && (<div className="dd-menu">{SORTS.map((s) => (<button key={s} className={value===s?"on":""} onClick={()=>{onChange(s);setOpen(false);}}>{s}{value===s && <CheckCheck size={14} style={{marginLeft:"auto"}} />}</button>))}</div>)}
    </div>
  );
}

/*
 * The filters, as a column of the ticket layout rather than a drawer over it.
 *
 * It mirrors the views column on the left: it takes its own width and the list
 * narrows to make room, so the rows being filtered stay visible and readable
 * while the filters change. The overlay drawer this replaced hid the very list
 * it was narrowing behind a dimmed backdrop.
 */
function FilterSidebar({ onClose, draft, setDraft, onApply, onReset }) {
  const desk = useDesk();
  /*
   * The real roster, the same one the row picker and the bulk assign dialog
   * use -- this list used to be the AGENTS sample data, so every name in it
   * matched nothing and the filter always came back empty.
   *
   * Unassigned is added by hand: it is a state a ticket can be in rather than
   * a person on the team, so it is not in the roster the API returns. A name
   * the current filter refers to is kept even if the roster no longer has it,
   * or applying the drawer would silently change the filter to "Any agent".
   */
  const agentOpts = useMemo(() => {
    const names = (desk.agents || []).map((a) => a.name).filter(Boolean);
    const out = ["Unassigned", ...names.filter((n) => n !== "Unassigned")];
    if (draft.agent && !out.includes(draft.agent)) out.unshift(draft.agent);
    return out;
  }, [desk.agents, draft.agent]);

  const toggle = (key, val) => setDraft(d => { const arr = d[key]; return { ...d, [key]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] }; });
  const Multi = ({ label, keyName, opts }) => (
    <div className="fld"><label>{label}</label><div className="chips">{opts.map((o) => (<button key={o} className={`fchip ${draft[keyName].includes(o) ? "on" : ""}`} onClick={() => toggle(keyName, o)}>{o}</button>))}</div></div>
  );
  return (
    <aside className="card fsb" aria-label="Filter tickets">
      <div className="drawer-head"><h3 className="card-title"><SlidersHorizontal size={16} style={{verticalAlign:"-3px",marginRight:7,color:"var(--primary)"}} />Filter Tickets</h3><button className="icon-btn sm" title="Hide filters" onClick={onClose}><PanelRightClose size={15} /></button></div>
      <div className="drawer-body">
        {/* First, because "what has nobody looked at" is the question this
            drawer gets opened for most often. */}
        <div className="fld">
          <label>Read state</label>
          <div className="chips">
            {[["", "Any"], ["unread", "Unread"], ["read", "Read"]].map(([v, lab]) => (
              <button key={v || "any"} className={`fchip ${draft.readState === v ? "on" : ""}`}
                      onClick={() => setDraft((d) => ({ ...d, readState: v }))}>{lab}</button>
            ))}
          </div>
        </div>
        <div className="fld"><label>Created Date (from)</label><input type="date" value={draft.createdFrom} onChange={(e)=>setDraft(d=>({...d,createdFrom:e.target.value}))} /></div>
        {/* One per row: two date pickers side by side do not fit a 300px column,
            and the second one was cut off behind a sideways scrollbar. */}
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:12}}>
          <div className="fld"><label>Resolved At</label><input type="date" value={draft.resolvedAt} onChange={(e)=>setDraft(d=>({...d,resolvedAt:e.target.value}))} /></div>
          <div className="fld"><label>Closed At</label><input type="date" value={draft.closedAt} onChange={(e)=>setDraft(d=>({...d,closedAt:e.target.value}))} /></div>
        </div>
        <Multi label="Status" keyName="status" opts={["New","Open","Pending","Overdue","Resolved","Closed"]} />
        <Multi label="Priority" keyName="priority" opts={["Low","Medium","High","Critical"]} />
        <Multi label="Category" keyName="category" opts={CATS} />
        <div className="fld"><label>Assigned Agent</label><select value={draft.agent} onChange={(e)=>setDraft(d=>({...d,agent:e.target.value}))}><option value="">Any agent</option>{agentOpts.map(a=><option key={a}>{a}</option>)}</select></div>
        <div className="fld"><label>Customer Name</label><input placeholder="e.g. Ananya" value={draft.customer} onChange={(e)=>setDraft(d=>({...d,customer:e.target.value}))} /></div>
      </div>
      <div className="drawer-foot"><button className="btn btn-soft" style={{flex:1,justifyContent:"center"}} onClick={onReset}><RotateCcw size={15} /> Reset</button><button className="btn btn-primary" style={{flex:1,justifyContent:"center"}} onClick={onApply}><CheckCheck size={15} /> Apply</button></div>
    </aside>
  );
}

/*
 * The hover card.
 *
 * Anchored to the subject or the ticket number, and led by the MESSAGE. The old
 * version opened from a "View" button and spent its first two lines repeating
 * the customer's name, which the row already showed an inch to the left -- so
 * hovering told you nothing you did not know. What an agent wants from a hover
 * is "what does this one say, and can I deal with it without opening it".
 *
 * It fades and lifts in over 140ms and survives the pointer travelling from the
 * row into the card (the caller holds it open for 180ms on leave).
 */
function TicketHoverPreview({ t, anchor, onOpen, onEnter, onLeave, onClose, onAction }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose && onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    if (!anchor) return;
    const W = 430, H = 330, M = 12;   // W matches .hp in fdStyles
    const r = anchor.getBoundingClientRect();
    // Below the anchor by preference — that is where the pointer already is.
    let left = Math.min(r.left, window.innerWidth - W - M);
    if (left < M) left = M;
    let top = r.bottom + 10;
    if (top + H > window.innerHeight - M) top = Math.max(M, r.top - H - 10);
    setPos({ left, top });
  }, [anchor]);
  if (!pos) return null;

  const preview = (t.preview || "").trim();
  const custLast = t.previewWho === "cust" || (!t.previewWho && !!t.custReplied);
  const msgCount = Number(t.messageCount) || 0;
  const who = custLast ? (t.name || "Customer")
    : t.previewWho === "note" ? "Internal note" : "Support";

  return (
    <div className="hp" style={{ left: pos.left, top: pos.top }} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <div className="hp-top">
        <div className="hp-subj">{t.subject || "(no subject)"}</div>
        <button className="hp-close" title="Close (Esc)" onClick={onClose}><X size={13} /></button>
      </div>
      <div className="hp-sub">
        <span className="hp-id">#{t.id}</span>
        <span className="badge-xs" style={{ background: statusStyle(t.status).bg, color: statusStyle(t.status).fg }}>{t.status}</span>
        {custLast && <span className="hp-new"><span className="rd" /> New reply</span>}
        <span className="hp-when">{t.lastActivity || t.created}</span>
      </div>

      <div className="hp-msg">
        {preview ? (
          <>
            <div className="hp-who">{who} wrote</div>
            <div className="hp-text">{preview}</div>
            {msgCount > 1 && <div className="hp-more">{msgCount} messages in this thread</div>}
            {t.hasAttachments && <div className="hp-more"><Paperclip size={10} /> has attachments</div>}
          </>
        ) : <div className="hp-text hp-dim">No messages on this ticket yet.</div>}
      </div>

      <div className="hp-foot">
        <button className="hp-a primary" onClick={() => onAction("reply", t)}><Reply size={13} /> Reply</button>
        <button className="hp-a" onClick={() => onAction("note", t)}><Lock size={13} /> Add note</button>
        <button className="hp-a ghost" onClick={() => onOpen && onOpen(t)}>Open →</button>
      </div>
    </div>
  );
}

/*
 * A compact inline dropdown for one field of one ticket row.
 *
 * Freshdesk lets an agent set priority, assignee and status straight from the
 * list, which is how most tickets are triaged -- opening each one to change a
 * single field is the slow path. Three of these stack down the right edge of a
 * row, in that order.
 *
 * The write is optimistic and reported by the caller; this component only
 * renders and reports the choice.
 */
function RowSelect({ value, options, onPick, icon: Ic, dot, title, busy, width = 118 }) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState(null);      // fixed coords for the portalled menu
  const ref = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => {
      // The menu lives outside this subtree now, so "outside" has to account
      // for it explicitly or the first click inside it would close it.
      if (ref.current && ref.current.contains(e.target)) return;
      if (e.target.closest && e.target.closest(".rsel-menu")) return;
      setOpen(false);
    };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };

    /*
     * The menu is positioned in viewport coordinates, so it cannot follow its
     * button: if the PAGE scrolls it would drift away from the row it belongs
     * to, and closing is the honest response.
     *
     * But the menu is itself a scroller -- the agent list is longer than its
     * 230px -- and a capturing scroll listener sees that scroll too. Without
     * this check, scrolling down to reach "Karan Rathod" closed the very menu
     * you were scrolling.
     */
    const onScroll = (e) => {
      const t = e.target;
      if (t && t.nodeType === 1 && t.closest && t.closest(".rsel-menu")) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);

    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  /* Measure on open: right-aligned to the button, flipped up when the menu
     would otherwise run past the bottom of the window. */
  const toggle = (e) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const H = Math.min(230, options.length * 34 + 8);
      const up = r.bottom + H + 8 > window.innerHeight && r.top > H + 16;
      setBox({
        right: Math.max(8, window.innerWidth - r.right),
        top: up ? undefined : r.bottom + 4,
        bottom: up ? window.innerHeight - r.top + 4 : undefined,
        minWidth: Math.max(width, r.width),
      });
    }
    setOpen(true);
  };

  const cur = options.find((o) => o.value === value);

  return (
    <div className={`rsel ${open ? "open" : ""}`} ref={ref} onClick={(e) => e.stopPropagation()}>
      <button ref={btnRef} className="rsel-btn" title={title} onClick={toggle} disabled={busy}>
        {dot ? <span className="rsel-dot" style={{ background: cur?.color || "var(--faint)" }} /> : Ic ? <Ic size={12} /> : null}
        <span className="rsel-lab">{busy ? "Saving…" : (cur?.label ?? value ?? "--")}</span>
        <ChevronDown size={12} className="rsel-caret" />
      </button>
      {open && box && (
        <Portal>
          <div className="rsel-menu fixed" style={box} onClick={(e) => e.stopPropagation()}>
            {options.map((o) => (
              <button key={String(o.value)} className={`rsel-opt ${o.value === value ? "on" : ""}`}
                      onClick={() => { setOpen(false); if (o.value !== value) onPick(o.value); }}>
                {dot && <span className="rsel-dot" style={{ background: o.color }} />}
                <span className="rsel-lab">{o.label}</span>
                {o.value === value && <Check size={12} className="rsel-tick" />}
              </button>
            ))}
            {options.length === 0 && <div className="rsel-empty">Nothing to choose</div>}
          </div>
        </Portal>
      )}
    </div>
  );
}

const ROW_PRIORITY_OPTS = ["Low", "Medium", "High", "Urgent"].map((p) => ({ value: p, label: p, color: prioColor[p] }));
/* The full set the backend accepts, not just Freshdesk's four -- a ticket that
   is "New" or "On Hold" must be able to show its own status. */
const ROW_STATUS_OPTS = STATUS_OPTS.map((v) => ({ value: v, label: v }));

/*
 * One ticket in the list.
 *
 * The "View" button is gone. It duplicated the row's own click target and its
 * tooltip repeated the customer's name, which was already two inches to the
 * left. The preview now hangs off the subject and the ticket number -- the two
 * things an agent actually points at when they want to know what a ticket says.
 */
/*
 * The contact card that hangs off a requester's name.
 *
 * Portalled and fixed-positioned for the same reason the row dropdowns are:
 * anything rendered inside a row can be clipped by it. "View tickets" narrows
 * the list to that person -- the server already matches on requester_email, so
 * their address IS the query.
 */
function ContactHoverCard({ t, anchor, onEnter, onLeave, onViewTickets }) {
  const [box, setBox] = useState(null);
  useEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const W = 268, H = 150, M = 10;
    setBox({
      left: Math.min(Math.max(M, r.left - 12), window.innerWidth - W - M),
      top: r.bottom + H + M > window.innerHeight ? Math.max(M, r.top - H - 8) : r.bottom + 8,
      width: W,
    });
  }, [anchor]);
  if (!box) return null;

  return (
    <Portal>
      <div className="chc" style={box} onMouseEnter={onEnter} onMouseLeave={onLeave}
           onClick={(e) => e.stopPropagation()}>
        <div className="chc-top">
          <span className="chc-av" style={{ background: avColor(t.name) }}>{initials(t.name)}</span>
          <div style={{ minWidth: 0 }}>
            <div className="chc-name">{t.name || "Unknown"}</div>
            <button className="chc-link" onClick={() => onViewTickets(t)}>View tickets</button>
          </div>
        </div>
        {t.email && (
          <a className="chc-mail" href={`mailto:${t.email}`} onClick={(e) => e.stopPropagation()}>
            <Mail size={13} /> <span>{t.email}</span>
          </a>
        )}
      </div>
    </Portal>
  );
}

/*
 * One ticket in the list.
 *
 * Two lines, the way Freshdesk reads: the SUBJECT alone on the first, because
 * that is what you are scanning for, and everything about the ticket on the
 * second -- who sent it, when it was created, where its clock stands.
 *
 * The name is light and the subject bold on purpose. Both bold and the eye has
 * nothing to lock onto; the requester matters once you have already found the
 * ticket you want.
 */
function TicketCard({ t, i, hoverId, onHoverEnter, onHoverLeave, onOpen, selected, onToggle, recent = false,
                      agents, onField, savingField, onContactEnter, onContactLeave }) {
  const sla = slaStyle[t.sla];
  const subjRef = useRef(null);
  const nameRef = useRef(null);

  const agentOpts = useMemo(() => ([
    { value: "Unassigned", label: "Unassigned" },
    ...(agents || []).filter((a) => a.name && a.name !== "Unassigned").map((a) => ({ value: a.name, label: a.name })),
  ]), [agents]);

  return (
    <div data-tid={t.id} className={`card tcard slim ${selected ? "sel" : ""} ${hoverId === t.id ? "peek" : ""} ${t.unread === false ? "read" : "unread"} ${recent ? "recent" : ""}`}
         style={{ "--pc": prioColor[t.priority], cursor: "pointer" }}
         onClick={() => onOpen && onOpen(t)}>

      <button className={`selbox ${selected ? "on" : ""}`} title="Select ticket"
              onClick={(e) => { e.stopPropagation(); onToggle(t.id); }}>{selected ? <Check size={12} /> : null}</button>
      <span className="slim-av" style={{ background: avColor(t.name) }}>{initials(t.name)}</span>

      <div className="slim-main">
        {/* Line one: the subject, and nothing else competing with it. */}
        <div className="slim-row">
          {/* Undelivered is a property of the ticket, not of the view -- a
              bounced reply is worth flagging wherever the row turns up. */}
          {t.undelivered && <span className="tag-undeliv">Undelivered</span>}
          <span ref={subjRef} className="slim-subj peekable" title={t.subject}
                onMouseEnter={() => onHoverEnter(t, subjRef.current)} onMouseLeave={onHoverLeave}>
            {t.subject || "(no subject)"}
          </span>
          <span className="slim-id">#{t.id}</span>
          {/* Small, and only on rows that have been read -- the absence of it
              is what marks the rest as new. */}
          {t.unread === false && <span className="tag-read" title={t.readBy ? `Read by ${t.readBy}${t.readAgo ? " " + t.readAgo : ""}` : "Read"}>Read</span>}
        </div>

        {/* Line two: who, when, and where the clock stands. */}
        <div className="slim-meta">
          <span ref={nameRef} className="slim-who"
                onMouseEnter={() => onContactEnter(t, nameRef.current)} onMouseLeave={onContactLeave}
                onClick={(e) => e.stopPropagation()}>
            <Mail size={11} /> {t.name}
          </span>
          <span>·</span>
          {/* One timestamp. Created and last-activity were both being printed,
              which read as two different facts about the same minute. */}
          <span className="sm">Created {t.created}</span>

          {t.readBy && t.unread === false && (
            <>
              <span>·</span>
              <span className="sm read-by" title={`Read by ${t.readBy}${t.readAgo ? " " + t.readAgo : ""}`}>
                <Eye size={11} /> {t.readByMe ? "Read by you" : `Read by ${String(t.readBy).split(" ")[0]}`}
              </span>
            </>
          )}
          {t.custReplied ? (<>
            <span className="replied"><span className="rd" /> Customer replied · {t.repliedAgo}</span>
            {t.newReplies > 0 && <span className="newct">{t.newReplies} new</span>}
          </>) : <span className="badge-xs" style={{ background: sla.bg, color: sla.fg }}>{t.sla}</span>}
        </div>
      </div>

      {/* Three fields, stacked — the shape Freshdesk uses, and the reason its
          rows scan cleanly: every row's controls line up in the same column. */}
      <div className="slim-ctl">
        <RowSelect value={t.priority} options={ROW_PRIORITY_OPTS} dot title="Priority"
                   busy={savingField === "priority"} onPick={(v) => onField(t, "priority", v)} />
        <RowSelect value={t.agent || "Unassigned"} options={agentOpts} icon={UserPlus} title="Assigned agent"
                   width={170} busy={savingField === "agent"} onPick={(v) => onField(t, "agent", v)} />
        <RowSelect value={t.status} options={ROW_STATUS_OPTS} icon={Activity} title="Status"
                   busy={savingField === "status"} onPick={(v) => onField(t, "status", v)} />
      </div>
    </div>
  );
}

function TicketTable({ rows, hoverId, onHoverEnter, onHoverLeave, onOpen, sel = [], onToggle, recentId = null,
                       agents, onField, savingRow = {} }) {
  const agentOpts = useMemo(() => ([
    { value: "Unassigned", label: "Unassigned" },
    ...(agents || []).filter((a) => a.name && a.name !== "Unassigned").map((a) => ({ value: a.name, label: a.name })),
  ]), [agents]);

  return (<div className="card card-pad"><div className="table-wrap"><table>
    <thead><tr><th>Ticket</th><th>Customer</th><th>Subject</th><th>Category</th><th>Priority</th><th>Agent</th><th>Source</th><th>Status</th><th style={{textAlign:"right"}}>Actions</th></tr></thead>
    <tbody>{rows.map((t) => (<tr key={t.id} data-tid={t.id} className={`${sel.includes(t.id) ? "sel" : ""} ${t.id === recentId ? "recent" : ""}`} style={{ cursor: "pointer" }} onClick={() => onOpen && onOpen(t)}>
      <td><button className={`selbox ${sel.includes(t.id) ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); onToggle(t.id); }}>{sel.includes(t.id) ? <Check size={12} /> : null}</button></td>
      <td><span className="peekable" style={{fontWeight:700,color:"var(--primary)"}}
                 onMouseEnter={(e) => onHoverEnter(t, e.currentTarget)}
                 onMouseLeave={onHoverLeave}>#{t.id}</span></td>
      <td><div className="cust"><span className="a" style={{background:avColor(t.name)}}>{initials(t.name)}</span><div><div className="nm">{t.name}</div><div className="em">{t.email}</div></div></div></td>
      {/* Same hover target as the card layout: the subject itself. */}
      <td><div className="subj peekable" title={t.subject}
               onMouseEnter={(e) => onHoverEnter(t, e.currentTarget)}
               onMouseLeave={onHoverLeave}>{t.subject || "(no subject)"}</div></td>
      <td style={{fontWeight:600,fontSize:12.5}}>{t.category}</td>
      {/* stopPropagation, not preventDefault: the row's own click opens the
          ticket, and picking a priority must not do that as well. */}
      <td onClick={(e) => e.stopPropagation()}>
        {onField
          ? <RowSelect value={t.priority} options={ROW_PRIORITY_OPTS} dot title="Priority"
                       busy={savingRow[t.id] === "priority"} onPick={(v) => onField(t, "priority", v)} />
          : <PrioBadge p={t.priority} />}
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        {onField
          ? <RowSelect value={t.agent || "Unassigned"} options={agentOpts} icon={UserPlus} title="Assigned agent"
                       width={160} busy={savingRow[t.id] === "agent"} onPick={(v) => onField(t, "agent", v)} />
          : <span style={{fontWeight:600,fontSize:12.5}}>{t.agent}</span>}
      </td>
      <td style={{fontSize:12.5,color:"var(--muted)"}}>{t.source}</td>
      <td onClick={(e) => e.stopPropagation()}>
        {onField
          ? <RowSelect value={t.status} options={ROW_STATUS_OPTS} icon={Activity} title="Status"
                       busy={savingRow[t.id] === "status"} onPick={(v) => onField(t, "status", v)} />
          : <StatusBadge s={t.status} />}
      </td>
      <td><div className="row-act" style={{justifyContent:"flex-end"}}>
        <button title="Reply" onClick={(e) => { e.stopPropagation(); onOpen && onOpen(t, "Reply"); }}><Reply size={15} /></button>
        <button title="Add note" onClick={(e) => { e.stopPropagation(); onOpen && onOpen(t, "Note"); }}><Lock size={15} /></button>
      </div></td>
    </tr>))}</tbody></table></div></div>);
}

/**
 * One ticket on a single line: who, then the subject running into its own
 * first words, then when.
 *
 * The point of this layout is density -- thirty tickets on a screen instead of
 * six -- so everything that would wrap is truncated instead, and the priority
 * shows as a coloured bar down the left rather than a chip that would cost a
 * column. Unread rows carry a heavier subject, the same signal the queue uses.
 */
const GROUP_OPTS = [{ value: "—", label: "No group" },
                    ...DEPTS.map((d) => ({ value: d, label: d }))];

function InboxRow({ t, selected, onToggle, onOpen, onHoverEnter, onHoverLeave, recent = false,
                    onContactEnter, onContactLeave, agents, onField, savingField }) {
  const unread = t.newReplies > 0 || t.unread;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useClickAway(menuRef, () => setMenuOpen(false));

  const agentOpts = useMemo(() => ([
    { value: "Unassigned", label: "Unassigned" },
    ...(agents || []).filter((a) => a.name && a.name !== "Unassigned").map((a) => ({ value: a.name, label: a.name })),
  ]), [agents]);
  return (
    <div data-tid={t.id} className={`inbox-row ${selected ? "sel" : ""} ${unread ? "unread" : ""} ${recent ? "recent" : ""}`}>
      <span className="ib-prio" style={{ background: prioColor[t.priority] || "var(--border)" }}
            title={t.priority || "No priority"} />

      <button className={`cbx ${selected ? "on" : ""}`} onClick={() => onToggle(t.id)}
              title={selected ? "Deselect" : "Select"}>
        {selected ? <Check size={11} /> : null}
      </button>

      <span className="ib-who"
            onMouseEnter={(e) => onContactEnter && onContactEnter(t, e.currentTarget)}
            onMouseLeave={onContactLeave}>
        {t.name || "Unknown"}
      </span>

      {/* One click target for the whole line: the subject and the snippet are
          the same ticket, and splitting them would make the snippet dead space. */}
      <button className="ib-main" onClick={() => onOpen(t)}
              onMouseEnter={(e) => onHoverEnter && onHoverEnter(t, e.currentTarget)}
              onMouseLeave={onHoverLeave}>
        <span className="ib-subj">{t.subject || "(no subject)"}</span>
        <span className="ib-id">#{t.id}</span>
        {t.preview && <span className="ib-snip">— {t.preview}</span>}
      </button>

      <span className="ib-when">{t.lastActivity || t.created}</span>
      {t.newReplies > 0 && <span className="ib-new">{t.newReplies}</span>}

      <div className="dd-wrap ib-menu" ref={menuRef}>
        <button className="icon-btn" title="Quick update" onClick={() => setMenuOpen((o) => !o)}>
          <MoreVertical size={16} />
        </button>
        {menuOpen && (
          <div className="menu menu-top right ib-quick" style={{ minWidth: 320 }}>
            <div className="ib-quick-head">Quick update properties</div>
            <div className="ib-quick-grid">
              <label>Priority
                <RowSelect value={t.priority} options={ROW_PRIORITY_OPTS} dot title="Priority"
                           busy={savingField === "priority"} onPick={(v) => onField(t, "priority", v)} />
              </label>
              <label>Status
                <RowSelect value={t.status} options={ROW_STATUS_OPTS} icon={Activity} title="Status"
                           busy={savingField === "status"} onPick={(v) => onField(t, "status", v)} />
              </label>
              <label>Group
                <RowSelect value={t.dept || "—"} options={GROUP_OPTS} icon={Building2} title="Group"
                           busy={savingField === "dept"} onPick={(v) => onField(t, "dept", v === "—" ? "" : v)} />
              </label>
              <label>Agent
                <RowSelect value={t.agent || "Unassigned"} options={agentOpts} icon={UserPlus} title="Agent"
                           busy={savingField === "agent"} onPick={(v) => onField(t, "agent", v)} />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Skeletons({ layout }) {
  if (layout === "table") return (<div className="card card-pad"><div style={{display:"flex",flexDirection:"column",gap:14}}>{Array.from({length:6}).map((_,i)=>(<div key={i} style={{display:"flex",gap:12,alignItems:"center"}}><div className="sk" style={{width:32,height:32,borderRadius:9}} /><div className="sk" style={{height:14,flex:1}} /><div className="sk" style={{height:14,width:80}} /><div className="sk" style={{height:22,width:70,borderRadius:20}} /></div>))}</div></div>);
  return (<div style={{display:"flex",flexDirection:"column",gap:14}}>{Array.from({length:4}).map((_,i)=>(<div key={i} className="card sk-card">
    <div style={{display:"flex",gap:13}}><div className="sk" style={{width:44,height:44,borderRadius:12}} /><div style={{flex:1}}><div className="sk" style={{height:12,width:120,marginBottom:8}} /><div className="sk" style={{height:16,width:"70%"}} /></div></div>
    <div style={{display:"flex",gap:8}}>{Array.from({length:4}).map((_,j)=><div key={j} className="sk" style={{height:22,width:80,borderRadius:8}} />)}</div>
    <div className="sk" style={{height:32,width:"55%",borderRadius:9}} /></div>))}</div>);
}

/**
 * Assign tickets to a real agent.
 *
 * The agent list is the ACTIVE rows of admin_users, fetched through
 * desk.ensureAgents() the first time this dialog opens. It used to render the
 * AGENTS constant -- five invented names -- so the dialog offered people who do
 * not exist and assigned tickets to a string nothing matched.
 *
 * Department is still a fixed list: fd_tickets has a free-text `department`
 * column and no departments table, so DEPTS is genuinely the vocabulary here
 * rather than a stand-in for data.
 */
function BulkAssignModal({ open, count, onClose, onApply }) {
  const desk = useDesk();
  const [agent, setAgent] = useState("");
  const [dept, setDept] = useState("");
  const [busy, setBusy] = useState(false);

  // Fetched on open, not on mount -- most sessions never assign anything.
  useEffect(() => { if (open && desk.ensureAgents) desk.ensureAgents(); }, [open, desk]);

  const agents = desk.agents || [];
  const loading = open && agents.length === 0;

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="panel-title" style={{ fontSize: 15 }}>
            <span className="pic" style={{ background: "#0EA5E918", color: "#0EA5E9", width: 32, height: 32 }}><UserPlus size={16} /></span>
            Assign {count} ticket{count > 1 ? "s" : ""}
          </div>
          <button className="icon-btn" onClick={onClose}><X size={17} /></button>
        </div>

        <div className="modal-body">
          <div className="fld">
            <label>Support Agent</label>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 2px", color: "var(--muted)", fontSize: 13 }}>
                <Spinner size={14} /> Loading agents…
              </div>
            ) : (
              <select value={agent} onChange={(e) => setAgent(e.target.value)}>
                <option value="">— Select an agent —</option>
                {agents.map((a) => (
                  <option key={a.id ?? a.name} value={a.name}>
                    {a.name}{a.role ? ` · ${a.role}` : ""}{a.email ? ` (${a.email})` : ""}
                  </option>
                ))}
              </select>
            )}
            {!loading && agents.length <= 1 && (
              /* Only "Unassigned" came back -- say why rather than showing an
                 empty picker the agent cannot act on. */
              <small style={{ color: "var(--warning)", fontSize: 11.5, marginTop: 6, display: "block" }}>
                No agents found in admin_users. Check that the accounts are active.
              </small>
            )}
          </div>

          <div className="fld">
            <label>Department <span style={{ color: "var(--faint)", fontWeight: 500 }}>(optional)</span></label>
            <select value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">— No change —</option>
              {DEPTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" disabled={busy || !agent}
                  title={!agent ? "Pick an agent first" : ""}
                  onClick={async () => {
                    setBusy(true);
                    // Only send what was actually chosen: an empty department
                    // must not wipe the one a ticket already has.
                    try { await onApply(dept ? { agent, dept } : { agent }); }
                    finally { setBusy(false); }
                  }}>
            {busy ? <><Spinner /> Assigning…</> : <><UserCheck size={15} /> Assign</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkUpdateModal({ open, count, onClose, onApply }) {
  const desk = useDesk();
  /* Real agents, fetched on open -- this offered BULK_AGENTS, ten invented
     names, so assigning here set agent_name to a string no account matched. */
  useEffect(() => { if (open && desk.ensureAgents) desk.ensureAgents(); }, [open, desk]);
  const KEEP = "";
  const blank = { type: KEEP, status: KEEP, priority: KEEP, agent: KEEP, reply: "" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setF(blank); setBusy(false); } }, [open]);
  if (!open) return null;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const dirty = f.type || f.status || f.priority || f.agent || f.reply.trim();

  const apply = () => {
    if (!dirty) return;
    setBusy(true);
    setTimeout(() => { setBusy(false); onApply({ ...f, reply: f.reply.trim() }); }, 600);
  };

  const Field = ({ label, k, opts }) => (
    <div className="fld">
      <label>{label}</label>
      <select value={f[k]} onChange={(e) => set(k, e.target.value)}>
        <option value="">— keep unchanged —</option>
        {opts.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="panel-title" style={{ fontSize: 15 }}>
            <span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB", width: 32, height: 32 }}><SlidersHorizontal size={16} /></span>
            Bulk Update <span className="count-badge" style={{ marginLeft: 5 }}>{count} ticket{count > 1 ? "s" : ""}</span>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>Only the fields you change will be applied to the selected tickets.</p>
          <Field label="Ticket Type" k="type" opts={TICKET_TYPES} />
          <Field label="Status" k="status" opts={BULK_STATUS} />
          <Field label="Priority" k="priority" opts={BULK_PRIORITY} />
          <Field label="Assigned Agent" k="agent" opts={(desk.agents || []).map((a) => a.name)} />
          <div className="fld">
            <label>Bulk Reply <span style={{ fontWeight: 500, color: "var(--faint)", textTransform: "none", letterSpacing: 0 }}>(optional — sent to every selected ticket)</span></label>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--muted)", margin: "2px 0 7px" }}>
              <Mail size={13} /> From: <b style={{ color: "var(--text)" }}>IS Support</b> (contact@internshipstudio.com)
            </div>
            <div className="bu-editor">
              <textarea placeholder="Add your reply here" value={f.reply} onChange={(e) => set("reply", e.target.value)} style={{ minHeight: 96 }} />
              <div className="rte">
                {[Bold, Italic, Underline, List, ListOrdered, Link2].map((Ic, i) => <button key={i} type="button"><Ic size={15} /></button>)}
                <span className="div" />
                <button type="button" title="Attach"><Paperclip size={15} /></button>
                <button type="button" title="Canned response"><MessageSquareText size={15} /></button>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" disabled={!dirty || busy} onClick={apply}>
            {busy ? <><Spinner /> Updating…</> : <><Check size={15} /> Update Tickets</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function MergeModal({ open, tickets, onClose, onApply }) {
  const [primary, setPrimary] = useState(null);
  useEffect(() => { if (open && tickets.length) setPrimary(tickets[0].id); }, [open, tickets]);
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#8B5CF618", color: "#8B5CF6", width: 32, height: 32 }}><FolderInput size={16} /></span>Merge {tickets.length} tickets</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>Choose the primary ticket. Conversations from the others are preserved and moved into it, then those tickets are closed as duplicates.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tickets.map((t) => (
              <label key={t.id} className="fchip" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer", borderColor: primary === t.id ? "var(--primary)" : undefined, background: primary === t.id ? "var(--primary-soft)" : undefined, color: primary === t.id ? "var(--primary)" : undefined }}>
                <input type="radio" checked={primary === t.id} onChange={() => setPrimary(t.id)} />
                <span style={{ fontWeight: 700 }}>#{t.id}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</span>
                <span style={{ fontSize: 11, opacity: .7 }}>{Number(t.messageCount) || 0} msgs</span>
              </label>
            ))}
          </div>
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" onClick={() => onApply(primary)}><FolderInput size={15} /> Merge Tickets</button></div>
      </div>
    </div>
  );
}

function TagsModal({ open, mode, count, existing, onClose, onApply }) {
  const [sel, setSel] = useState([]);
  useEffect(() => { if (open) setSel([]); }, [open]);
  if (!open) return null;
  const opts = mode === "remove" ? existing : TAG_BANK;
  const toggle = (t) => setSel((x) => x.includes(t) ? x.filter((y) => y !== t) : [...x, t]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#F59E0B18", color: "#F59E0B", width: 32, height: 32 }}><TagIcon size={16} /></span>{mode === "remove" ? "Remove tags from" : "Add tags to"} {count} ticket{count > 1 ? "s" : ""}</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          {opts.length ? <div className="chips">{opts.map((t) => <button key={t} className={`fchip ${sel.includes(t) ? "on" : ""}`} onClick={() => toggle(t)}><TagIcon size={12} /> {t}</button>)}</div>
            : <EmptyState icon={TagIcon} title="No tags found" desc="The selected tickets don't have any tags to remove." />}
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" disabled={!sel.length} onClick={() => onApply(sel)}><Check size={15} /> {mode === "remove" ? "Remove" : "Add"} {sel.length || ""}</button></div>
      </div>
    </div>
  );
}

function PickModal({ open, title, icon: Ic, options, onClose, onApply }) {
  const [val, setVal] = useState(options[0]);
  useEffect(() => { if (open) setVal(options[0]); }, [open, options]);
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB", width: 32, height: 32 }}><Ic size={16} /></span>{title}</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body"><div className="chips">{options.map((o) => <button key={o} className={`fchip ${val === o ? "on" : ""}`} onClick={() => setVal(o)}>{o}</button>)}</div></div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" onClick={() => onApply(val)}><Check size={15} /> Apply</button></div>
      </div>
    </div>
  );
}

/**
 * The bulk action bar, shown the moment anything is ticked.
 *
 * Two things were wrong with the previous version:
 *
 *  1. Half the actions were hidden by `mobile-hide`/`tablet-hide` below
 *     1100px. With the 250px workspace rail taking a bite out of the viewport
 *     that fires on ordinary laptop screens, so Merge, Spam and Trash simply
 *     were not there when you needed them.
 *  2. It scrolled away with the page. Tick a box halfway down a long list and
 *     the actions were off-screen above you.
 *
 * Now: the six primary actions are ALWAYS rendered (they wrap onto a second
 * line rather than disappearing), everything secondary lives in one More menu,
 * and the bar sticks to the top of the list while you scroll.
 */
function BulkBar({ count, selTickets, actions }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  useClickAway(moreRef, () => setMoreOpen(false));

  /* Everything that is not one of the six primary actions. Grouped rather than
     hidden at a breakpoint, so an action is always reachable — just one click
     deeper. */
  const more = [
    ["Change Priority", ArrowUp, actions.changePriority],
    ["Change Status", Activity, actions.changeStatus],
    ["Add Tags", TagIcon, actions.addTags],
    ["Remove Tags", X, actions.removeTags],
    ["Move to Trash", Trash, actions.trash],
    ["Export as Excel", FileSpreadsheet, () => actions.exportSel("xlsx")],
    ["Export as CSV", FileText, () => actions.exportSel("csv")],
    ["Export as PDF", Printer, () => actions.exportSel("pdf")],
    ["Add Internal Note", Lock, () => actions.more("Add Internal Note")],
    ["Change Department", Building2, () => actions.more("Change Department")],
    ["Archive Tickets", FolderInput, () => actions.more("Archive Tickets")],
    ["Restore Tickets", RotateCcw, () => actions.more("Restore Tickets")],
    ["Print Summary", Printer, () => actions.more("Print Ticket Summary")],
  ];

  return (
    <div className="bulkbar">
      <span className="selcount"><CheckCheck size={15} /> {count} selected</span>
      <span className="bdiv" />

      <button className="bbtn" onClick={actions.assign}><UserPlus size={13} /> Assign</button>
      <button className="bbtn" onClick={actions.close}><CheckCheck size={13} /> Close</button>
      <button className="bbtn" onClick={actions.bulkUpdate}><SlidersHorizontal size={13} /> Bulk update</button>
      <button className="bbtn" disabled={count < 2}
              title={count < 2 ? "Select two or more tickets to merge" : "Merge selected tickets"}
              onClick={actions.merge}><FolderInput size={13} /> Merge</button>
      <button className="bbtn" onClick={actions.spam}><ShieldX size={13} /> Spam</button>
      <button className="bbtn danger" onClick={actions.del}><Trash2 size={13} /> Delete</button>

      <div className="dd-wrap" ref={moreRef}>
        <button className="bbtn" onClick={() => setMoreOpen((o) => !o)} title="More actions">
          <MoreHorizontal size={15} /> More
        </button>
        {moreOpen && (
          <div className="menu menu-top right" style={{ minWidth: 220 }}>
            {more.map(([label, Ic, run]) => (
              <button key={label} className="mi" style={{ padding: "9px 11px" }}
                      onClick={() => { setMoreOpen(false); run(); }}>
                <span className="mic" style={{ background: "var(--surface-2)" }}><Ic size={14} /></span> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="bbtn" style={{ marginLeft: "auto" }} onClick={actions.clear} title="Clear selection">
        <X size={13} /> Clear
      </button>
    </div>
  );
}

/**
 * The empty state.
 *
 * Its whole job is to answer "why is this empty when the header says 1,791?".
 * That happens when a filter from an earlier stat-card click is still applied,
 * so it names the filters, says how many rows the current VIEW holds without
 * them, and gives one button to clear.
 */
function EmptyTickets({ view, counts, activeFilterCount, hasSearch, timeWindow, onClearFilters }) {
  const inView = counts[view] || 0;
  const filtered = activeFilterCount > 0 || hasSearch || !!timeWindow;

  return (
    <div className="card card-pad" style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
      <Inbox size={30} style={{ opacity: .4, marginBottom: 10 }} />
      <div style={{ fontWeight: 600, color: "var(--text)" }}>
        {filtered ? "Nothing matches these filters" : "No tickets here"}
      </div>

      {filtered ? (
        <>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            This view holds <b>{inView.toLocaleString("en-IN")}</b> ticket{inView === 1 ? "" : "s"},
            but {[
              activeFilterCount > 0 && `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"}`,
              hasSearch && "a search term",
              timeWindow && "a time window",
            ].filter(Boolean).join(" and ")} {" "}
            {activeFilterCount + (hasSearch ? 1 : 0) + (timeWindow ? 1 : 0) === 1 ? "is" : "are"} hiding {inView === 1 ? "it" : "them"}.
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} onClick={onClearFilters}>
            <RotateCcw size={14} /> Clear filters and search
          </button>
        </>
      ) : (
        <div style={{ fontSize: 13, marginTop: 4 }}>
          Nothing in this view yet — try another one from the list on the left.
        </div>
      )}
    </div>
  );
}

/**
 * The page numbers to show: first, last, and a window around the current one.
 *
 * Rendering every page was fine at 3 pages and broke the layout at 24 -- the
 * row simply overflowed its container. This keeps the control a fixed width no
 * matter how deep the list goes.
 *
 *   1 … 7 [8] 9 … 24
 */
function pageWindow(current, total, span = 1) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const out = [1];
  const from = Math.max(2, current - span);
  const to = Math.min(total - 1, current + span);

  if (from > 2) out.push("…");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < total - 1) out.push("…");
  out.push(total);
  return out;
}

/*
 * Where the agent was in the list when they opened a ticket.
 *
 * Coming back from a ticket used to land on page 1 of a freshly mounted list,
 * so an agent working page 3 lost their place every time. This keeps the page,
 * the query that produced it (view, sort, search, filters, page size, layout)
 * and the ticket they opened, so the list comes back exactly there with that
 * row marked. Session storage, so a refresh on the ticket page does not lose
 * it; forgotten as soon as the agent goes anywhere else in the desk (see
 * forgetListPosition in Freshdesk.jsx), so a fresh visit still starts at the
 * top.
 */
const LIST_POS_KEY = "fd-list-pos";
function rememberListPosition(pos) {
  try { sessionStorage.setItem(LIST_POS_KEY, JSON.stringify(pos)); } catch { /* private mode: no memory, no harm */ }
}
function readListPosition() {
  try { return JSON.parse(sessionStorage.getItem(LIST_POS_KEY) || "null"); } catch { return null; }
}
function forgetListPosition() {
  try { sessionStorage.removeItem(LIST_POS_KEY); } catch { /* nothing stored */ }
}
/* Moved to another ticket from inside the detail page (Close & Next, the
   arrows, the rail): that ticket is now the one to mark on the way back. */
function markListTicket(ticketId) {
  const p = readListPosition();
  if (p) rememberListPosition({ ...p, ticketId });
}

function TicketsPage({ onOpen: openTicketProp, initialView = "unresolved", initialStatus = [],
                       initialCreatedWithinHours = null, initialDueWithinHours = null,
                       tickets, setTickets }) {
  /* Only a return to the SAME view restores; another view is a new question. */
  const [restoreFrom] = useState(() => {
    const p = readListPosition();
    return p && p.view === initialView ? p : null;
  });
  /* The row the agent opened last, marked until they open another. */
  const [recentId, setRecentId] = useState(restoreFrom ? restoreFrom.ticketId : null);
  const push = useToast();
  const desk = useDesk();
  const [sel, setSel] = useState([]);                 // selected ticket ids
  const [modal, setModal] = useState(null);           // active bulk modal
  const [confirm, setConfirm] = useState(null);
  const [expOpen, setExpOpen] = useState(false);
  const expRef = useRef(null);
  useClickAway(expRef, () => setExpOpen(false));
  const [view, setView] = useState(initialView);
  const [q, setQ] = useState(restoreFrom ? restoreFrom.q || "" : "");
  const [sort, setSort] = useState(restoreFrom ? restoreFrom.sort || "Created Date" : "Created Date");
  const [layout, setLayout] = useState(restoreFrom ? restoreFrom.layout || "card" : "card");
  /* 30 matches what Freshdesk shows and what fits a laptop screen; 5 meant
     paging through 2,000 tickets sixty rows at a time. */
  const [perPage, setPerPage] = useState(restoreFrom ? Number(restoreFrom.perPage) || 30 : 30);
  const [drawer, setDrawer] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [applied, setApplied] = useState(restoreFrom && restoreFrom.applied ? restoreFrom.applied : { ...EMPTY, status: initialStatus });
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState({ t: null, el: null });
  /* The requester card is its own hover, separate from the ticket preview --
     they anchor to different words on the same row. */
  const [contact, setContact] = useState({ t: null, el: null });
  const contactTimer = useRef(null);
  const clearContactTimer = () => { if (contactTimer.current) { clearTimeout(contactTimer.current); contactTimer.current = null; } };
  const onContactEnter = (t, el) => { clearContactTimer(); setContact({ t, el }); };
  const onContactLeave = () => {
    clearContactTimer();
    contactTimer.current = setTimeout(() => setContact({ t: null, el: null }), 180);
  };
  useEffect(() => clearContactTimer, []);

  /*
   * Every ticket this person has raised.
   *
   * The server's search already matches requester_email, so the address is the
   * query -- no new endpoint, and the result is exactly "their tickets".
   */
  const viewCustomerTickets = (t) => {
    clearContactTimer();
    setContact({ t: null, el: null });
    if (!t.email) return;
    setView("all");
    setQ(t.email);
    setPage(1);
  };
  const hoverTimer = useRef(null);
  const clearHoverTimer = () => { if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; } };
  const onHoverEnter = (t, el) => { clearHoverTimer(); setHover({ t, el }); };
  const onHoverLeave = () => { clearHoverTimer(); hoverTimer.current = setTimeout(() => setHover({ t: null, el: null }), 180); };
  const closeHover = () => { clearHoverTimer(); setHover({ t: null, el: null }); };
  const hoverAction = (kind, t) => {
    closeHover();
    // Open the ticket with the composer already in the right mode, so "Reply"
    // from a hover card lands in the reply box rather than at the top of a
    // ticket the agent then has to scroll.
    if (kind === "reply") { onOpen(t, "Reply"); return; }
    if (kind === "note")  { onOpen(t, "Note"); return; }
    setSel([t.id]);
    setModal(kind === "assign" ? "assign" : null);
    if (kind === "close") setConfirm({ title: "Close ticket", msg: `Close #${t.id} — “${t.subject}”?`, label: "Close Ticket",
      run: async () => {
        if (await bulkWrite([t.id], { status: "Closed" }, () => desk.updateTicket(t.id, { status: "Closed" }))) setSel([]);
      } });
  };
  useEffect(() => clearHoverTimer, []);
  /*
   * Row-level edits.
   *
   * The list is a SERVER page, so the store's optimistic update to the
   * in-memory working set never reaches these rows. Patches are held here and
   * painted over the server's copy until the next fetch replaces it, which is
   * what stops a priority the agent just set from flicking back for a moment.
   */
  const [patches, setPatches] = useState({});     // { [id]: { field: value } }
  const [savingRow, setSavingRow] = useState({}); // { [id]: 'status' | ... }

  const setRowField = useCallback(async (t, field, value) => {
    /* A status change carries `unresolved` with it, the same way the desk's own
       updateTicket does. Without it a ticket closed from this row still reads
       as unresolved, and the Unresolved view goes on showing it. */
    const patch = field === "status"
      ? { status: value, unresolved: !["Resolved", "Closed"].includes(value) }
      : { [field]: value };
    setPatches((p) => ({ ...p, [t.id]: { ...(p[t.id] || {}), ...patch } }));
    setSavingRow((p) => ({ ...p, [t.id]: field }));
    try {
      await desk.updateTicket(t.id, { [field]: value });
    } catch (err) {
      // desk.updateTicket has already raised the toast; drop the optimistic paint.
      setPatches((p) => {
        const next = { ...p };
        if (next[t.id]) {
          const f = { ...next[t.id] };
          Object.keys(patch).forEach((k) => delete f[k]);
          next[t.id] = f;
        }
        return next;
      });
    } finally {
      setSavingRow((p) => { const n = { ...p }; delete n[t.id]; return n; });
    }
  }, [desk]);

  /*
   * The view list is closed on arrival, every time. Deliberately NOT
   * remembered: it is a detour, and a panel that reopens itself is one the
   * agent has to close again on every visit.
   */
  const [navOpen, setNavOpen] = useState(false);

  const [page, setPage] = useState(restoreFrom ? Number(restoreFrom.page) || 1 : 1);
  /* Every way of opening a ticket from this list goes through here -- the row,
     the hover card, quick Reply/Note -- so the way back always knows the spot.
     clampedPage is read at click time, after render has defined it. */
  const onOpen = (t, mode) => {
    if (!t) return;
    rememberListPosition({ view, page: clampedPage, perPage, sort, q, applied, layout, ticketId: t.id });
    setRecentId(t.id);
    openTicketProp(t, mode);
  };

  /*
   * The page the SERVER selected, not a slice of an in-memory array.
   *
   * Client filter names differ from the API's, so they are mapped here rather
   * than in the hook -- the drawer's shape is this page's business.
   * `agent` and `customer` are single strings in the drawer and arrays/LIKE on
   * the server.
   */
  const serverFilters = useMemo(() => {
    const f = {
      readState: applied.readState || "",
      status:   applied.status || [],
      priority: applied.priority || [],
      category: applied.category || [],
      createdFrom: applied.createdFrom || "",
      createdTo:   applied.createdTo || "",
      resolvedAt:  applied.resolvedAt || "",
    };
    if (applied.agent) f.agent = [applied.agent];
    // A stat card can arrive carrying a time window; "created in the last 24h"
    // becomes a createdFrom the server already understands.
    if (initialCreatedWithinHours) {
      f.createdFrom = new Date(Date.now() - initialCreatedWithinHours * 3600e3)
        .toISOString().slice(0, 10);
    }
    if (initialDueWithinHours) f.dueWithinHours = initialDueWithinHours;
    return f;
  }, [applied, initialCreatedWithinHours, initialDueWithinHours]);

  const list = useTicketList({
    view,
    page,
    perPage,
    search: q.trim(),
    sort,
    sortDir: sort === "Customer Name" || sort === "Status" ? "ASC" : "DESC",
    filters: serverFilters,
  });

  const activeView = VIEWS.find((v) => v.key === view);

  const rows = useMemo(
    () => list.rows.map((t) => (patches[t.id] ? { ...t, ...patches[t.id] } : t)),
    [list.rows, patches]
  );
  // A new page from the server supersedes every local paint.
  useEffect(() => { setPatches({}); }, [list.rows]);

  // Assignable agents, for the per-row picker. Fetched once, on first render of
  // the list -- the dropdown has to be populated before it is opened.
  useEffect(() => { if (desk.ensureAgents) desk.ensureAgents(); }, [desk]);
  // navigation history across views AND pages (browser-style back/forward)
  const hist = useRef({ stack: [{ view: initialView, page: 1 }], idx: 0 });
  const skipPush = useRef(false);
  const [histTick, setHistTick] = useState(0);
  useEffect(() => {
    const h = hist.current;
    const cur = h.stack[h.idx];
    if (skipPush.current) { skipPush.current = false; return; }
    if (cur && cur.view === view && cur.page === page) return;
    h.stack = h.stack.slice(0, h.idx + 1).concat({ view, page });
    h.idx = h.stack.length - 1;
    setHistTick((x) => x + 1);
  }, [view, page]);
  const jump = (d) => {
    const h = hist.current;
    const next = h.idx + d;
    if (next < 0 || next > h.stack.length - 1) return;
    h.idx = next;
    const snap = h.stack[next];
    skipPush.current = true;
    setView(snap.view); setPage(snap.page);
    setHistTick((x) => x + 1);
  };
  const goPage = (p) => setPage(p);
  const back = () => jump(-1);
  const fwd = () => jump(1);
  const canBack = hist.current.idx > 0;
  const canFwd = hist.current.idx < hist.current.stack.length - 1;

  /*
   * Badge numbers come from the SERVER, not from the rows in memory.
   *
   * The working set is capped (500 most recent), so counting it locally made
   * every view report at most 500 -- while the rail, which used the real
   * server count, showed the true figure a few pixels away. The server
   * computes these with COUNT(*) over the same WHERE clauses the list itself
   * uses, so a badge and its list can no longer disagree.
   *
   * The local count is kept only as the pre-first-response fallback.
   */
  const localCounts = useMemo(
    () => Object.fromEntries(VIEWS.map((v) => [v.key, tickets.filter(v.f).length])),
    [tickets]
  );
  const counts = useMemo(() => {
    const server = (list.counts && Object.keys(list.counts).length ? list.counts : desk.counts) || {};
    /*
     * Start from everything the server sent, then overlay the view totals with
     * the local fallback where a number is missing. Spreading first is what
     * keeps the *Unread / *Read companions -- rebuilding the object from VIEWS
     * alone silently dropped them.
     */
    const out = { ...server };
    for (const v of VIEWS) {
      out[v.key] = Number.isFinite(server[v.key]) ? server[v.key] : localCounts[v.key];
    }
    return out;
  }, [list.counts, desk.counts, localCounts]);

  /*
   * Refresh really refetches. It used to be an 800ms timer that showed a
   * success toast without touching the server -- reassuring and completely
   * untrue, which is worse than no button.
   */
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([desk.load({ silent: true }), list.reload()]);
      push({ type: "success", title: "Tickets refreshed", desc: "Showing the latest data from the mailbox." });
    } catch (err) {
      push({ type: "error", title: "Could not refresh", desc: err.message });
    } finally {
      setLoading(false);
    }
    // desk is a fresh object each render; load is stable inside the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The list fetches per page now, so the spinner tracks a real request.
  useEffect(() => { setLoading(list.loading); }, [list.loading]);


  /* One place that puts the list back to "everything in this view", including
     the time window a stat card may have carried in. */
  const clearAllFilters = () => {
    setDraft(EMPTY);
    setApplied(EMPTY);
    setQ("");
    setPage(1);
  };

  const activeFilterCount = useMemo(() => (
    (applied.createdFrom?1:0)+(applied.resolvedAt?1:0)+(applied.closedAt?1:0)+
    applied.status.length+applied.priority.length+applied.category.length+(applied.agent?1:0)+(applied.customer?1:0)+(applied.readState?1:0)
  ), [applied]);


  // ---- bulk action helpers ----
  const selTickets = useMemo(() => tickets.filter((t) => sel.includes(t.id)), [tickets, sel]);
  const selCount = sel.length;
  const toggleSel = (id) => setSel((x) => x.includes(id) ? x.filter((y) => y !== id) : [...x, id]);
  const clearSel = () => setSel([]);
  /*
   * Bulk edits are PERSISTED, not just reflected locally.
   *
   * The store applies the change optimistically and rolls the rows back if the
   * API rejects it, so the list is never left quietly disagreeing with the
   * database. patchSel stays for the few cosmetic-only fields the backend does
   * not model (there is no server-side "type" on a ticket yet).
   */
  const patchSel = (patch) => setTickets((ts) => ts.map((t) => sel.includes(t.id) ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t));

  /*
   * Paint a bulk change onto the rows this page is showing, before the server
   * answers.
   *
   * The page's rows are the server's page, not the desk's working set, so the
   * store's own optimistic patch never reached them -- close 100 tickets and
   * all 100 stayed on screen until a refresh. This writes the same patches
   * setRowField does, so viewRows re-tests them and a closed, trashed or
   * spammed row leaves the view immediately.
   *
   * Returns the undo for the failure path. On success the page is refetched
   * silently, which refills it from the rows after this page and brings the
   * pager's total back in line with the database.
   */
  const paintRows = (ids, fields) => {
    const patch = fields.status
      ? { ...fields, unresolved: !["Resolved", "Closed"].includes(fields.status) }
      : { ...fields };
    let before = null;
    setPatches((p) => {
      before = p;
      const next = { ...p };
      ids.forEach((id) => { next[id] = { ...(p[id] || {}), ...patch }; });
      return next;
    });
    return () => setPatches(() => before || {});
  };
  /** Run a bulk write with the rows painted first; refill on success. */
  const bulkWrite = async (ids, fields, write) => {
    const undo = paintRows(ids, fields);
    try {
      await write();
      list.reload({ silent: true });
      return true;
    } catch (err) {
      undo();          // the store raised the toast and rolled its own copy back
      return false;
    }
  };

  /** Send a field set for the whole selection and report the outcome once. */
  const saveSel = async (fields, title, desc) => {
    const ids = [...sel];
    const ok = await bulkWrite(ids, fields, () => desk.bulkUpdate(ids, fields));
    if (!ok) return;   // keep the selection so the agent can retry without re-picking 40 rows
    setModal(null); clearSel();
    if (title) push({ type: "success", title, desc });
  };
  const done = (title, desc) => { push({ type: "success", title, desc }); clearSel(); setModal(null); };
  const selExisting = useMemo(() => Array.from(new Set(selTickets.flatMap((t) => t.tags || []))), [selTickets]);

  const bulkExport = (kind) => {
    try {
      const data = selTickets.map((t) => ({
        "Ticket ID": t.id, "Customer Name": t.name, "Email": t.email, "Subject": t.subject,
        "Category": t.category, "Priority": t.priority, "Status": t.status, "Assigned Agent": t.agent,
        "Created Date": t.created, "Closed Date": ["Resolved", "Closed"].includes(t.status) ? "18 Jul 2026" : "—",
      }));
      if (!data.length) return;
      if (kind === "xlsx") exportExcel(data, "selected-tickets.xlsx");
      else if (kind === "csv") exportCSV(data, "selected-tickets.csv");
      else { const ok = exportPDF("Selected Tickets", ["Ticket ID", "Customer Name", "Subject", "Category", "Priority", "Status", "Assigned Agent"], data); if (!ok) { push({ type: "error", title: "Popup blocked", desc: "Allow popups to export PDF." }); return; } }
      push({ type: "success", title: "Export ready", desc: `${data.length} selected tickets exported.` });
    } catch (e) { push({ type: "error", title: "Export failed" }); }
  };

  const actions = {
    // The agent roster and the tag/category lists are fetched on first use, not
    // on page load -- see ensureAgents/ensureMeta in useFreshdeskData.
    assign: () => { desk.ensureAgents(); setModal("assign"); },
    bulkUpdate: () => { desk.ensureAgents(); desk.ensureMeta(); setModal("update"); },
    merge: () => setModal("merge"),
    addTags: () => { desk.ensureMeta(); setModal("addTags"); },
    removeTags: () => { desk.ensureMeta(); setModal("removeTags"); },
    changePriority: () => setModal("priority"),
    changeStatus: () => setModal("status"),
    exportSel: bulkExport,
    clear: clearSel,
    close: () => setConfirm({
      title: "Close tickets",
      msg: `Close the selected ${selCount} ticket${selCount > 1 ? "s" : ""}? They move to Closed and can be reopened at any time.`,
      label: "Close Tickets",
      run: () => saveSel({ status: "Closed" }, "Tickets closed", `${selCount} moved to Closed.`),
    }),

    /*
     * Delete is two-step, matching the backend: from a normal view this moves
     * to Trash, and only tickets ALREADY in Trash are destroyed. Permanent
     * deletion of a customer conversation cannot be undone from anywhere, so it
     * is never one mis-click away from the working queue.
     */
    del: () => {
      const permanent = selTickets.length > 0 && selTickets.every((t) => t.trash);
      setConfirm({
        title: permanent ? "Delete permanently" : "Move to Trash",
        msg: permanent
          ? `Permanently delete ${selCount} ticket${selCount > 1 ? "s" : ""}, including every message and attachment? This cannot be undone.`
          : `Move ${selCount} ticket${selCount > 1 ? "s" : ""} to Trash? You can restore them from the Trash view.`,
        label: permanent ? "Delete Forever" : "Move to Trash",
        danger: true,
        run: async () => {
          const ids = [...sel];
          const ok = permanent
            ? await bulkWrite(ids, { __gone: true }, () => desk.removeTickets(ids))
            : await bulkWrite(ids, { trash: true, spam: false }, () => desk.setTrash(ids, true));
          if (ok) { setModal(null); clearSel(); }
        },
      });
    },

    spam: () => setConfirm({
      title: "Mark as spam",
      msg: `Move ${selCount} ticket${selCount > 1 ? "s" : ""} to Spam?`,
      label: "Mark as Spam",
      run: async () => {
        const ids = [...sel];
        if (await bulkWrite(ids, { spam: true, trash: false }, () => desk.setSpam(ids, true))) { setModal(null); clearSel(); }
      },
    }),

    trash: () => setConfirm({
      title: "Move to trash",
      msg: `Move ${selCount} ticket${selCount > 1 ? "s" : ""} to Trash?`,
      label: "Move to Trash",
      danger: true,
      run: async () => {
        const ids = [...sel];
        if (await bulkWrite(ids, { trash: true, spam: false }, () => desk.setTrash(ids, true))) { setModal(null); clearSel(); }
      },
    }),
    more: (label) => {
      if (label === "Duplicate Tickets") { const copies = selTickets.map((t, i) => ({ ...t, id: t.id + 900000 + i, status: "New", created: "just now" })); setTickets((ts) => [...copies, ...ts]); done("Tickets duplicated", `${copies.length} copies created.`); return; }
      if (label === "Archive Tickets") { saveSel({ status: "Closed" }, "Tickets archived", `${selCount} archived.`); return; }
      if (label === "Restore Tickets") {
        const ids = [...sel];
        bulkWrite(ids, { trash: false, spam: false }, () => Promise.all([desk.setTrash(ids, false), desk.setSpam(ids, false)]))
          .then((ok) => { if (ok) clearSel(); });
        return;
      }
      if (label === "Print Ticket Summary") { const ok = exportPDF("Ticket Summary", ["Ticket ID", "Customer Name", "Subject", "Status", "Priority"], selTickets.map((t) => ({ "Ticket ID": t.id, "Customer Name": t.name, "Subject": t.subject, "Status": t.status, "Priority": t.priority }))); push(ok ? { type: "success", title: "Opening print dialog" } : { type: "error", title: "Popup blocked" }); return; }
      push({ type: "info", title: label, desc: `${label} applied to ${selCount} ticket${selCount > 1 ? "s" : ""}.` });
      clearSel();
    },
  };

  const doExport = (kind) => {
    setExpOpen(false);
    try {
      const data = rows.map((t) => ({
        "Ticket Number": t.id, "Customer Name": t.name, "Email": t.email, "Phone": t.phone,
        "Subject": t.subject, "Category": t.category, "Priority": t.priority, "Status": t.status,
        "Assigned Agent": t.agent, "Source": t.source, "Department": t.dept,
        "Created": t.created, "Last Activity": t.lastActivity,
        "First Response Due": t.firstResp, "Resolution Due": t.resolution, "SLA Status": t.sla,
      }));
      if (!data.length) { push({ type: "error", title: "Nothing to export", desc: "No tickets match the current view." }); return; }
      const label = VIEWS.find((v) => v.key === view)?.label.replace(/ /g, "-").toLowerCase() || "tickets";
      if (kind === "xlsx") { exportExcel(data, `${label}.xlsx`); push({ type: "success", title: "Export ready", desc: `${data.length} tickets → ${label}.xlsx` }); }
      else if (kind === "csv") { exportCSV(data, `${label}.csv`); push({ type: "success", title: "Export ready", desc: `${data.length} tickets → ${label}.csv` }); }
      else if (kind === "json") { downloadBlob(JSON.stringify(data, null, 2), `${label}.json`, "application/json"); push({ type: "success", title: "Export ready", desc: `${data.length} tickets → ${label}.json` }); }
      else { const ok = exportPDF("Tickets Report", ["Ticket Number","Customer Name","Subject","Category","Priority","Status","Assigned Agent"], data); push(ok ? { type: "success", title: "Opening print dialog", desc: "Choose “Save as PDF”." } : { type: "error", title: "Popup blocked", desc: "Allow popups to export PDF." }); }
    } catch (e) { push({ type: "error", title: "Export failed", desc: "Could not generate the file." }); }
  };

  // Straight from the server: rows IS the page, and pages/total describe the
  // whole table rather than the slice we happen to be holding.
  const pages = list.pages;
  const clampedPage = Math.min(page, pages);
  /*
   * The server built this page, so a row it sent stays where it is -- except
   * one the agent has just edited. Close a ticket from its status dropdown and
   * it stops matching "Unresolved", so it leaves the list there and then
   * instead of lingering until the next fetch.
   *
   * Only patched rows are re-tested. Re-testing every row would second-guess
   * the server's own filter, which knows about fields this page never sees.
   */
  const viewRows = useMemo(() => {
    const match = activeView && activeView.f;
    return rows.filter((t) => {
      if (t.__gone) return false;                  // permanently deleted just now
      return !patches[t.id] || !match || match(t);
    });
  }, [rows, patches, activeView]);
  /* Back from a ticket: bring the row that was opened into view, once. */
  const scrolledToRef = useRef(null);
  useEffect(() => {
    if (!restoreFrom || list.loading || scrolledToRef.current === restoreFrom.ticketId) return;
    const box = document.querySelector(".tl-scroll");
    const el = box && box.querySelector('[data-tid="' + restoreFrom.ticketId + '"]');
    if (!el) return;
    scrolledToRef.current = restoreFrom.ticketId;
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    box.scrollTop = Math.max(0, top - (box.clientHeight - el.offsetHeight) / 2);
  }, [restoreFrom, list.loading, viewRows]);
  // What the pager says, less the rows this tab has just taken out, so
  // "Showing 1-30 of 359" does not lag the list under it until the refill.
  const totalMatching = Math.max(0, list.total - (rows.length - viewRows.length));
  // Anything that changes WHAT is being asked for goes back to page 1 --
  // staying on page 7 of a result that now has 2 pages shows an empty list.
  // `view` belongs here now that the server, not a client filter, builds the page.
  /*
   * Only when the query actually CHANGES. As a plain effect this also ran on
   * mount -- which is harmless for a fresh list but wiped out the page being
   * restored on the way back from a ticket. Compared by value, not by a
   * first-run flag, because StrictMode runs mount effects twice.
   */
  const queryKey = JSON.stringify([view, q, applied, perPage, sort]);
  const lastQueryKey = useRef(queryKey);
  useEffect(() => {
    if (lastQueryKey.current === queryKey) return;
    lastQueryKey.current = queryKey;
    setPage(1);
  }, [queryKey]);

  return (
    <div className="content route content-frame">
      <div className="toolbar">
        {counts[view + "Unread"] != null && (
          <span className="head-split" style={{ marginRight: 4 }}>
            <span className="ss unread"><b>{counts[view + "Unread"].toLocaleString("en-IN")}</b> unread</span>
            <span className="ss read"><b>{(counts[view + "Read"] ?? 0).toLocaleString("en-IN")}</b> read</span>
          </span>
        )}
        <div className="searchbox" style={{ maxWidth:230, flex:"initial", width:230 }}><Search size={16} /><input placeholder="Search tickets..." value={q} onChange={(e)=>setQ(e.target.value)} /></div>
        <SortDropdown value={sort} onChange={setSort} />
        <div className="seg" style={{ marginLeft:6 }}>
          <button className={layout==="card"?"on":""} onClick={()=>setLayout("card")}><LayoutGrid size={15} /> Card</button>
          <button className={layout==="inbox"?"on":""} onClick={()=>setLayout("inbox")}><Inbox size={15} /> Inbox</button>
          <button className={layout==="table"?"on":""} onClick={()=>setLayout("table")}><Rows3 size={15} /> Table</button>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          <div className="dd-wrap" ref={expRef}>
            <button className="btn btn-ghost" onClick={() => setExpOpen((o) => !o)}><Download size={15} /> Export <ChevronDown size={13} /></button>
            {expOpen && (
              <div className="menu menu-top right" style={{ minWidth: 190 }}>
                <button className="mi" onClick={() => doExport("xlsx")}><span className="mic" style={{ background: "#10B98118", color: "#10B981" }}><FileSpreadsheet size={15} /></span><span>Excel (.xlsx)<small>{rows.length} tickets in view</small></span></button>
                <button className="mi" onClick={() => doExport("csv")}><span className="mic" style={{ background: "#0EA5E918", color: "#0EA5E9" }}><FileText size={15} /></span> CSV (.csv)</button>
                <button className="mi" onClick={() => doExport("json")}><span className="mic" style={{ background: "#5B5CEB18", color: "#5B5CEB" }}><Code size={15} /></span> JSON (.json)</button>
                <button className="mi" onClick={() => doExport("pdf")}><span className="mic" style={{ background: "#EF444418", color: "#EF4444" }}><Printer size={15} /></span> PDF (print)</button>
              </div>
            )}
          </div>
          <button className="icon-btn" title="Refresh tickets" onClick={refresh}>{loading ? <Loader2 size={17} className="spin" /> : <RotateCcw size={17} />}</button>
          <button className="icon-btn" title={canBack ? "Back" : "No history yet"} onClick={back} disabled={!canBack}><ArrowLeft size={17} /></button>
          <button className="icon-btn" title={canFwd ? "Forward" : "Nothing ahead"} onClick={fwd} disabled={!canFwd}><ArrowRight size={17} /></button>
          {/*
            * The filter drawer's opener, drawn like the views toggle on the left
            * edge because it does the same job from the other side: it slides a
            * panel in from the right. Lit, with a count, while filters apply --
            * with the labelled button gone this dot is what tells the agent the
            * list is narrowed.
            */}
          <button className={`icon-btn fd-filter-toggle ${drawer || activeFilterCount > 0 ? "on" : ""}`}
                  title={activeFilterCount > 0 ? `Filters (${activeFilterCount} applied)` : "Filters"}
                  aria-label={drawer ? "Hide filters" : "Show filters"} aria-expanded={drawer}
                  onClick={() => {
                    if (drawer) { setDrawer(false); return; }
                    desk.ensureMeta(); desk.ensureAgents(); setDraft(applied); setDrawer(true);
                  }}>
            {drawer ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
            {activeFilterCount > 0 && <span className="dot">{activeFilterCount}</span>}
          </button>
        </div>
      </div>

      {selCount > 0 && <BulkBar count={selCount} selTickets={selTickets} actions={actions} />}

      <div className={`tickets-layout ${navOpen ? "" : "nav-shut"} ${drawer ? "filters-open" : ""}`}>
        {navOpen && <TicketSidebar view={view} setView={setView} counts={counts} setOpen={setNavOpen} />}
        <div className="tl-main">
          {/* Pagination above the list as well: on a 30-row page the bottom
              control starts below the fold, which is where it is least useful. */}
          {!loading && rows.length > 0 && (
            <Pager compact page={clampedPage} pages={pages} perPage={perPage}
                   total={totalMatching} onPage={goPage} onPerPage={setPerPage}
                   navOpen={navOpen} onNav={() => setNavOpen((v) => !v)} />
          )}

          {!loading && viewRows.length > 0 && (
            <div className="selall">
              <button className={`selbox ${viewRows.every((t) => sel.includes(t.id)) && viewRows.length ? "on" : ""}`}
                onClick={() => { const ids = viewRows.map((t) => t.id); const all = ids.every((id) => sel.includes(id)); setSel(all ? sel.filter((id) => !ids.includes(id)) : Array.from(new Set([...sel, ...ids]))); }}>
                {viewRows.every((t) => sel.includes(t.id)) && viewRows.length ? <Check size={12} /> : null}
              </button>
              Select all {viewRows.length} on this page{selCount > 0 && <span style={{ marginLeft: "auto", color: "var(--primary)", fontWeight: 700 }}>{selCount} selected</span>}
            </div>
          )}
          {/* Everything below the two header rows scrolls; they stay put. */}
          <div className="tl-scroll">
          {loading ? <Skeletons layout={layout} /> : (
            !viewRows.length && layout !== "table" ? (
              <EmptyTickets view={view} counts={counts} activeFilterCount={activeFilterCount}
                            hasSearch={!!q.trim()} timeWindow={initialCreatedWithinHours || initialDueWithinHours}
                            onClearFilters={clearAllFilters} />
            ) : layout === "card" ? (
              <div className="tlist" style={{display:"flex",flexDirection:"column",gap:10}}>{viewRows.map((t, i) => (
                <TicketCard key={t.id} t={t} i={i} hoverId={hover.t?.id} recent={t.id === recentId}
                            onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave} onOpen={onOpen}
                            selected={sel.includes(t.id)} onToggle={toggleSel}
                            agents={desk.agents} onField={setRowField} savingField={savingRow[t.id]}
                            onContactEnter={onContactEnter} onContactLeave={onContactLeave} />
              ))}</div>
            ) : layout === "inbox" ? (
              <div className="card inbox-list">{viewRows.map((t) => (
                <InboxRow key={t.id} t={t} recent={t.id === recentId} selected={sel.includes(t.id)} onToggle={toggleSel} onOpen={onOpen}
                          onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave}
                          onContactEnter={onContactEnter} onContactLeave={onContactLeave}
                          agents={desk.agents} onField={setRowField} savingField={savingRow[t.id]} />
              ))}</div>
            ) : <TicketTable rows={viewRows} recentId={recentId} hoverId={hover.t?.id} onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave}
                             onOpen={onOpen} sel={sel} onToggle={toggleSel}
                             agents={desk.agents} onField={setRowField} savingRow={savingRow} />
          )}

          {!loading && rows.length > 0 && (
            <Pager page={clampedPage} pages={pages} perPage={perPage}
                   total={totalMatching} onPage={goPage} onPerPage={setPerPage} />
          )}
          </div>
        </div>
        {/* The filters column, on the right the way the views column is on the
            left. Applying keeps it open: filters get tuned a step at a time. */}
        {drawer && (
          <FilterSidebar onClose={() => setDrawer(false)} draft={draft} setDraft={setDraft}
            onApply={() => setApplied(draft)}
            onReset={() => { setDraft(EMPTY); setApplied(EMPTY); }} />
        )}
      </div>

      {contact.t && contact.el && (
        <ContactHoverCard t={contact.t} anchor={contact.el}
                          onEnter={clearContactTimer} onLeave={onContactLeave}
                          onViewTickets={viewCustomerTickets} />
      )}

      {hover.t && hover.el && <TicketHoverPreview t={hover.t} anchor={hover.el} onOpen={onOpen} onEnter={clearHoverTimer} onLeave={onHoverLeave} onClose={closeHover} onAction={hoverAction} />}

      <BulkAssignModal open={modal === "assign"} count={selCount} onClose={() => setModal(null)}
        onApply={({ agent, dept }) => saveSel({ agent, dept }, "Tickets assigned", `${selCount} assigned to ${agent}.`)} />
      <BulkUpdateModal open={modal === "update"} count={selCount} onClose={() => setModal(null)}
        onApply={async (f) => {
          const n = selCount;
          const ids = [...sel];
          const fields = {
            ...(f.type ? { type: f.type } : {}),
            ...(f.status ? { status: f.status } : {}),
            ...(f.priority ? { priority: f.priority } : {}),
            ...(f.agent ? { agent: f.agent === "Support Queue (Unassigned)" ? "Unassigned" : f.agent } : {}),
          };

          try {
            // Painted onto the page first, so a bulk close empties the rows at once.
            if (Object.keys(fields).length && !(await bulkWrite(ids, fields, () => desk.bulkUpdate(ids, fields)))) return;

            /*
             * The bulk reply sends a REAL email per ticket, one at a time.
             *
             * Sequential rather than Promise.all on purpose: this is SMTP, and
             * forty simultaneous connections to a shared cPanel mailhost gets
             * the account rate-limited or temporarily blocked. Failures are
             * counted and reported rather than aborting the run, so one bad
             * recipient address does not stop the other thirty-nine.
             */
            let sent = 0, failed = 0;
            if (f.reply && f.reply.trim()) {
              for (const id of ids) {
                try {
                  const r = await desk.sendMessage({ ticketId: id, type: "reply", body: f.reply });
                  if (r && r.sent === false) failed++; else sent++;
                } catch (err) { failed++; }
              }
            }

            setModal(null); clearSel();
            push({
              type: failed ? "warning" : "success",
              title: `${n} ticket${n > 1 ? "s" : ""} updated`,
              desc: [
                f.type && `Type: ${f.type}`,
                f.status && `Status: ${f.status}`,
                f.priority && `Priority: ${f.priority}`,
                f.agent && `Agent: ${f.agent}`,
                f.reply && `${sent} repl${sent === 1 ? "y" : "ies"} sent${failed ? `, ${failed} failed` : ""}`,
              ].filter(Boolean).join(" · "),
            });
          } catch (err) { /* the store rolled back and reported */ }
        }} />
      <MergeModal open={modal === "merge"} tickets={selTickets} onClose={() => setModal(null)}
        onApply={async (primaryId) => {
          // Server-side: messages and attachments move to the primary and the
          // sources become tombstones pointing at it, so an old link (or a
          // [#IS-nnn] token still in a customer's mail client) keeps resolving.
          const others = sel.filter((id) => id !== primaryId);
          // The merged-away tickets leave the page now; the primary stays.
          if (await bulkWrite(others, { __gone: true }, () => desk.mergeTickets(primaryId, others))) {
            setModal(null); clearSel();
          }
        }} />
      <TagsModal open={modal === "addTags"} mode="add" count={selCount} existing={selExisting} onClose={() => setModal(null)}
        onApply={async (tags) => {
          // Tags are per-ticket (each keeps the ones it already had), so this
          // cannot be one bulk field write.
          const ids = [...sel];
          try {
            await Promise.all(ids.map((id) => {
              const t = tickets.find((x) => x.id === id);
              const next = Array.from(new Set([...((t && t.tags) || []), ...tags]));
              return desk.updateTicket(id, { tags: next });
            }));
            setModal(null); clearSel();
            push({ type: "success", title: "Tags added", desc: `${tags.join(", ")} → ${ids.length} tickets.` });
          } catch (err) { /* handled */ }
        }} />
      <TagsModal open={modal === "removeTags"} mode="remove" count={selCount} existing={selExisting} onClose={() => setModal(null)}
        onApply={async (tags) => {
          const ids = [...sel];
          try {
            await Promise.all(ids.map((id) => {
              const t = tickets.find((x) => x.id === id);
              const next = ((t && t.tags) || []).filter((x) => !tags.includes(x));
              return desk.updateTicket(id, { tags: next });
            }));
            setModal(null); clearSel();
            push({ type: "success", title: "Tags removed", desc: `${tags.join(", ")} removed.` });
          } catch (err) { /* handled */ }
        }} />
      <PickModal open={modal === "priority"} title={`Change priority · ${selCount} tickets`} icon={ArrowUp} options={["Low", "Medium", "High", "Critical"]}
        onClose={() => setModal(null)} onApply={(v) => saveSel({ priority: v }, "Priority updated", `${selCount} set to ${v}.`)} />
      <PickModal open={modal === "status"} title={`Change status · ${selCount} tickets`} icon={Activity} options={STATUS_OPTS}
        onClose={() => setModal(null)} onApply={(v) => saveSel({ status: v }, "Status updated", `${selCount} set to ${v}.`)} />
      <ConfirmDialog open={!!confirm} danger={confirm?.danger} title={confirm?.title || ""} message={confirm?.msg || ""} confirmLabel={confirm?.label || "Confirm"}
        onConfirm={() => confirm?.run()} onClose={() => setConfirm(null)} />

    </div>
  );
}

export {
  BulkAssignModal,
  BulkBar,
  BulkUpdateModal,
  FilterSidebar,
  forgetListPosition,
  markListTicket,
  MergeModal,
  PickModal,
  Skeletons,
  SortDropdown,
  TagsModal,
  TicketCard,
  TicketHoverPreview,
  TicketSidebar,
  TicketTable,
  TicketsPage,
};
