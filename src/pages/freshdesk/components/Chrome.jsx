/*
 * src/pages/freshdesk/components/Chrome.jsx
 *
 * The workspace rail and everything it opens.
 *
 * This is the ONLY chrome the helpdesk draws. The floating top bar it replaced
 * duplicated the admin panel's own header -- a second search field, a second
 * back button, a second theme toggle -- and spent a band of vertical space on
 * every screen doing it. Search is an icon until it is wanted (Ctrl+K also
 * opens it), and the rail carries the live mailbox/realtime state so a desk
 * that has quietly stopped receiving mail cannot look like a quiet morning.
 */
import { notifications as fdNotifications, stats as fdStats, tickets as fdTicketsApi } from "../fdApi";
import RecipientInput from "./RecipientInput";
import { SearchSelect } from "./SearchSelect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AttachField, ChartTooltip, EmptyState, Spinner, computeAnalytics, downloadBlob, exportPDF, loadXLSX, useClickAway, useDesk, useToast } from "../fdShared";
import { ACTIVITY_FEED, AGENTS, ANALYTICS, DISTRIBUTION, NAV, TICKET_CATS, avColor, initials, statusStyle } from "../fdConstants";
import { Activity, AlertCircle, AlertTriangle, ArrowLeft, AtSign, BarChart3, Bell, Bold, Bot, Check, CheckCheck, ChevronDown, ChevronsLeft, ChevronsRight, Download, Droplet, FileSpreadsheet, FileText, FolderInput, Forward, Heading1, Image as ImageIcon, Italic, LayoutDashboard, Link2, List, ListOrdered, Lock, Mail, Moon, Palette, Plus, PlusCircle, RefreshCw, Reply, Search, Send, Settings, ShieldX, SlidersHorizontal, Sparkles, Sun, Tag as TagIcon, Ticket, Trash, Trash2, Underline, Upload, User, UserCheck, UserPlus, Users, X, Zap, ZapOff } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { currentAgentProfile } from "../fdAgent";
import { PRESETS, THEME_DEFAULT, THEME_FIELDS, hexToRgb } from "../fdTheme";

/*
 * The workspace rail -- now the ONLY chrome this page draws.
 *
 * The floating top bar that used to sit above every page is gone. It duplicated
 * the admin panel's own header (a second search box, a second back button, a
 * second theme toggle), stole a band of vertical space from every screen, and
 * put the desk's controls in a different place from its navigation. Everything
 * it did lives here now: search, New, activity, notifications, theme, and the
 * live connection state.
 */
/**
 * The slim top bar.
 *
 * Back, search, notifications and theme used to live in the top of the 250px
 * workspace rail, where an expanded search field had nowhere to go. Up here
 * they cost ~44px of height and the search can use the full width of the
 * content column.
 *
 * Search is an ICON until it is wanted -- Ctrl/Cmd+K opens it from anywhere, so
 * hiding it costs the fast path nothing.
 */
function TopBar({ desk, counts = {}, dark, setDark, onOpenTicket, onBack, canBack, crumb, onStudentSearch }) {
  const [searchOpen, setSearchOpen] = useState(false);
  /* The student lookup, kept separate from the ticket search beside it: one
     asks "which conversation", the other "who is this person". */
  const [stuQ, setStuQ] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  useClickAway(notifRef, () => setNotifOpen(false));

  /*
   * Fetched rather than derived: a notification belongs to one agent, so the
   * only place the number can come from is that agent's own inbox. Polled
   * slowly -- it is a courtesy, not a live feed, and the panel refreshes it
   * every time it opens.
   */
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let alive = true;
    const tick = () => fdNotifications.count()
      .then((r) => { if (alive) setUnread(r.unread || 0); })
      .catch(() => {});
    tick();
    const id = setInterval(tick, 60000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); }
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /*
   * Whether anything has scrolled beneath the bar.
   *
   * Two scrollers to watch, because the two screens work differently: the list
   * scrolls the shell column, while the ticket screen holds the shell still
   * and scrolls the conversation inside it. Listening to both means the bar
   * behaves the same way on either.
   *
   * Passive listeners: this only reads scrollTop and must never be able to
   * delay a scroll.
   */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    /*
     * One listener on the document, in the capture phase.
     *
     * Scroll events do not bubble, so the usual approach is to find the
     * scrolling element and bind to it -- but which element that is depends on
     * the screen (the shell column on a list, the conversation on a ticket),
     * and it is replaced whenever a different ticket is opened. Capturing at
     * the document catches all of them without this component having to know
     * any of that, or re-bind when the route changes.
     */
    let frame = 0;
    const read = () => {
      frame = 0;
      const any = [".main", ".td-convo"].some((sel) => {
        const el = document.querySelector(sel);
        return el && el.scrollTop > 4;
      });
      setScrolled(any);
    };
    // Coalesced to one read per frame: scroll fires far more often than the
    // class needs to change, and each read forces layout.
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(read); };

    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    read();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, []);

  /* A new screen starts at the top, so the bar starts flat again. */
  useEffect(() => { setScrolled(false); }, [crumb]);

  return (
    <header className={`fd-topbar ${scrolled ? "is-scrolled" : ""}`}>
      <button className="icon-btn" title={canBack ? "Back" : "Nothing to go back to"}
              onClick={onBack} disabled={!canBack}><ArrowLeft size={17} /></button>

      {/* Where you are. Given by the shell rather than drawn by each page, so
          every screen says it in the same place and the same way. */}
      {crumb && <div className="fd-crumb">{crumb}</div>}

      <span className="fd-topbar-gap" />

      {/*
        * The admin panel's own navbar is hidden on this page (OWN_CHROME_ROUTES
        * in AdminLayout), and the student lookup went with it. This is that
        * lookup, put back where an agent reading a ticket can reach it: type
        * the writer's email or phone and it opens their record.
        *
        * Always a field, never an icon -- unlike the ticket search next to it
        * this has no keyboard shortcut, and the spelt-out placeholder is what
        * stops the two being mistaken for each other.
        */}
      {onStudentSearch && (
        <form className="fd-stusearch"
              onSubmit={(e) => { e.preventDefault(); if (stuQ.trim()) { onStudentSearch(stuQ.trim()); setStuQ(""); } }}>
          <User size={15} />
          <input value={stuQ} onChange={(e) => setStuQ(e.target.value)}
                 aria-label="Global search with email or phone"
                 title="Find a student by email address or phone number"
                 placeholder="Global search with email or phone" />
        </form>
      )}

      {/* The button and the field are the SAME element widening, not two things
          swapping places -- that is what makes the expansion read as one motion
          instead of a flicker. */}
      <div className={`fd-search ${searchOpen ? "open" : ""}`}>
        {searchOpen ? (
          <GlobalSearch autoFocus
                        onOpen={(t) => { setSearchOpen(false); onOpenTicket && onOpenTicket(t); }}
                        onDismiss={() => setSearchOpen(false)} />
        ) : (
          <button className="fd-search-btn" title="Search tickets (Ctrl+K)" onClick={() => setSearchOpen(true)}>
            <Search size={16} /> <span>Search tickets</span> <kbd>⌘K</kbd>
          </button>
        )}
      </div>

      <div className="dd-wrap" ref={notifRef}>
        <button className="icon-btn" title="Notifications" onClick={() => setNotifOpen((o) => !o)}>
          <Bell size={17} />{unread > 0 && <span className="dot">{unread > 99 ? "99+" : unread}</span>}
        </button>
        {notifOpen && <RailNotifications desk={desk} onClose={() => setNotifOpen(false)}
                                         onOpenTicket={onOpenTicket} onCount={setUnread} />}
      </div>

      <button className="icon-btn" title={dark ? "Light mode" : "Dark mode"} onClick={() => setDark((d) => !d)}>
        {dark ? <Sun size={17} /> : <Moon size={17} />}
      </button>
    </header>
  );
}

function Sidebar({ open, route, go, collapsed, setCollapsed, counts = {}, desk, onOpenTicket }) {
  const [newOpen, setNewOpen] = useState(false);
  const [actsOpen, setActsOpen] = useState(false);
  const [modal, setModal] = useState(null);          // "ticket" | "email"
  const newRef = useRef(null);
  useClickAway(newRef, () => setNewOpen(false));

  const item = (it) => {
    const badge = it.countKey ? counts[it.countKey] : null;
    const body = (
      <>
        <it.icon size={17} />
        <span className="lbl">{it.label}</span>
        {badge > 0 && <span className="badge">{badge > 999 ? "999+" : badge}</span>}
      </>
    );
    return it.href ? (
      <a key={it.label} href={it.href} target="_blank" rel="noopener noreferrer"
         className="nav-item" data-label={it.label} title={it.label}>{body}</a>
    ) : (
      <button key={it.label} type="button"
              className={`nav-item ${route === it.route ? "active" : ""}`} data-label={it.label}
              title={it.label}
              onClick={() => it.route && go(it.route)}>{body}</button>
    );
  };

  const workspace = NAV.filter((n) => n.group === "Workspace");
  const org = NAV.filter((n) => n.group === "Organization");

  return (
    <aside className={`sidebar ${open ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>

      {/* ---- actions ---- */}
      <div className="rail-actions">
        <div className="dd-wrap" ref={newRef}>
          <button className="btn btn-primary rail-new" data-label="New" title="New ticket or email"
                  onClick={() => setNewOpen((o) => !o)}>
            <Plus size={16} /> <span className="lbl">New</span> <ChevronDown size={14} className="lbl" />
          </button>
          {newOpen && (
            <div className="menu right" style={{ minWidth: 210 }}>
              <button className="mi" onClick={() => { setNewOpen(false); setModal("ticket"); }}>
                <span className="mic" style={{ background: "#5B5CEB18", color: "#5B5CEB" }}><Ticket size={16} /></span>
                <span>New Ticket<small>Log a support request</small></span>
              </button>
              <button className="mi" onClick={() => { setNewOpen(false); setModal("email"); }}>
                <span className="mic" style={{ background: "#0EA5E918", color: "#0EA5E9" }}><Mail size={16} /></span>
                <span>New Email<small>Compose an outbound email</small></span>
              </button>
            </div>
          )}
        </div>

        <button className="nav-item subtle" data-label="Recent Activity" title="Recent Activity"
                onClick={() => setActsOpen(true)}>
          <Activity size={17} /> <span className="lbl">Recent Activity</span>
        </button>
      </div>

      {/* ---- navigation ---- */}
      <nav className="nav">
        <span className="nav-label">Workspace</span>
        {workspace.map(item)}
        <span className="nav-label">Organization</span>
        {org.map(item)}
      </nav>

      {/* ---- live state + account ---- */}
      <div className="side-foot">
        <ConnectionPill desk={desk} />
        <AccountChip desk={desk} />
        <button className="collapse-btn" data-label={collapsed ? "Show workspace" : "Hide workspace"}
                onClick={() => setCollapsed(!collapsed)}
                title={collapsed ? "Show workspace" : "Hide workspace"}>
          {collapsed ? <ChevronsLeft size={16} /> : <ChevronsRight size={16} />}
          <span className="lbl">Hide workspace</span>
        </button>
      </div>

      <TicketModal open={modal === "ticket"} onClose={() => setModal(null)} />
      <EmailComposeModal open={modal === "email"} onClose={() => setModal(null)} />
      <RecentActivitiesDrawer open={actsOpen} onClose={() => setActsOpen(false)}
                              onOpenTicket={onOpenTicket} tickets={desk && desk.tickets} />
    </aside>
  );
}

/**
 * Live mailbox + realtime state.
 *
 * This is deliberately always visible rather than tucked into Settings. The
 * worst failure this system has is going quietly deaf -- the cron stops, the
 * mailbox password changes, the websocket dies -- and every one of those looks
 * exactly like "a quiet morning" unless something on screen says otherwise.
 */
function ConnectionPill({ desk }) {
  const rt = (desk && desk.realtime) || {};
  const mb = rt.mailbox || {};
  const [busy, setBusy] = useState(false);
  const push = useToast();

  const healthy = rt.connected && mb.healthy !== false;
  const tone = mb.healthy === false || rt.transport === "offline" ? "bad"
             : rt.transport === "pusher" || rt.transport === "polling" ? "ok"
             : "warn";
  // Pusher pushes to us, so there is nothing to toggle; the switch only exists
  // for the polling fallback.
  const canToggleLive = rt.transport !== "pusher" && typeof desk?.setLiveOn === "function";

  const label = rt.transport === "pusher" ? "Live"
              : rt.transport === "polling" ? "Live · polling"
              : rt.transport === "connecting" ? "Connecting…"
              : rt.transport === "manual" ? "Manual refresh"
              : "Offline";

  const detail = mb.healthy === false
    ? (mb.error ? String(mb.error).slice(0, 120) : "The mailbox is not reachable.")
    : rt.error ? String(rt.error).slice(0, 120)
    : mb.lastSyncAgo ? `Mailbox checked ${mb.lastSyncAgo}` : "";

  const syncNow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await rt.syncNow?.();
      push({ type: res && res.ok === false ? "error" : "success",
             title: "Mailbox checked", desc: res?.message || "" });
      await desk?.load?.({ silent: true });
    } catch (err) {
      push({ type: "error", title: "Could not check the mailbox", desc: err.message });
    } finally { setBusy(false); }
  };

  return (
    <div className={`fd-conn ${tone}`} title={detail || (rt.transport === "manual"
      ? "This panel makes no background requests. Cron syncs the mailbox; press refresh to pull the latest."
      : "")}>
      <span className="dot" />
      <span className="lbl">{label}</span>
      <span className="grow lbl">
        {canToggleLive && (
          <button
            className={`icon-btn sm ${desk.liveOn ? "on" : ""}`}
            title={desk.liveOn
              ? "Live updates on — the panel polls for new mail. Click to stop."
              : "Live updates off — no background requests. Click to poll every few seconds."}
            onClick={() => desk.setLiveOn(!desk.liveOn)}
          >
            {desk.liveOn ? <Zap size={13} /> : <ZapOff size={13} />}
          </button>
        )}
        <button className="icon-btn sm" title="Sync the mailbox now and reload" onClick={syncNow} disabled={busy}>
          {busy ? <Spinner size={13} /> : <RefreshCw size={13} />}
        </button>
      </span>
    </div>
  );
}

/** Whoever is actually signed in -- never a hard-coded name. */
function AccountChip({ desk }) {
  const me = currentAgentProfile();
  const rt = (desk && desk.realtime) || {};
  const mb = rt.mailbox || {};
  const tone = mb.healthy === false || rt.transport === "offline" ? "bad"
             : rt.transport === "pusher" || rt.transport === "polling" ? "ok"
             : "warn";
  const state = rt.transport === "pusher" ? "Live"
              : rt.transport === "polling" ? "Live · polling"
              : rt.transport === "connecting" ? "Connecting…"
              : rt.transport === "manual" ? "Manual refresh"
              : "Offline";

  return (
    <div className="rail-account" title={`${me.name || "Agent"}${me.email ? " · " + me.email : ""} — ${state}`}>
      <span className={`wa acc-av ${tone}`}>{initials(me.name || "Agent")}</span>
      <span className="lbl">
        <b>{me.name || "Agent"}</b>
        <small>{me.role || me.email || ""}</small>
      </span>
    </div>
  );
}

/* What each kind of notification looks like. */
const NOTIF_STYLE = {
  assigned:  { icon: UserPlus, color: "#5B5CEB" },
  forwarded: { icon: Forward, color: "#F59E0B" },
  mentioned: { icon: AtSign, color: "#0EA5E9" },
  tagged:    { icon: TagIcon, color: "#EC4899" },
};

/**
 * The signed-in agent's own notifications.
 *
 * Opening one marks it read and takes you to the ticket -- those are the same
 * action, and making them two would leave a list of things you have already
 * dealt with still bolded.
 */
function RailNotifications({ desk, onClose, onOpenTicket, onCount }) {
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState("unread");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (which) => {
    setRows(null);
    try {
      const r = await fdNotifications.list(which, 40);
      setRows(r.notifications || []);
      if (onCount) onCount(r.unread || 0);
    } catch {
      setRows([]);
    }
  }, [onCount]);

  useEffect(() => { load(tab); }, [tab, load]);

  const open = async (n) => {
    onClose();
    if (!n.is_read) {
      // Fire and forget: the panel is already closing, and a failed mark is
      // worth far less than making the agent wait to see the ticket.
      fdNotifications.read([n.id]).then((r) => onCount && onCount(r.unread || 0)).catch(() => {});
    }
    if (n.ticket_id && onOpenTicket) {
      const t = (desk?.tickets || []).find((x) => x.id === Number(n.ticket_id));
      if (t) onOpenTicket(t);
      else onOpenTicket({ id: Number(n.ticket_id) });
    }
  };

  const markAll = async () => {
    setBusy(true);
    try {
      const r = await fdNotifications.readAll();
      if (onCount) onCount(r.unread || 0);
      await load(tab);
    } catch { /* the list will say so on the next open */ }
    setBusy(false);
  };

  const list = rows || [];
  return (
    <div className="menu right notif-pop" style={{ minWidth: 340 }}>
      <div className="notif-head">
        <b>Notifications</b>
        <button className="icon-btn sm" onClick={onClose}><X size={14} /></button>
      </div>

      <div className="notif-tabs">
        {[["unread", "Unread"], ["all", "All"]].map(([k, label]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label}</button>
        ))}
        <button className="notif-clear" disabled={busy} onClick={markAll}>
          <CheckCheck size={13} /> Mark all read
        </button>
      </div>

      {rows === null && <div className="notif-empty"><Spinner /> Loading…</div>}
      {rows && list.length === 0 && (
        <div className="notif-empty">
          {tab === "unread" ? "Nothing waiting for you." : "No notifications yet."}
        </div>
      )}

      {list.map((n) => {
        const st = NOTIF_STYLE[n.kind] || { icon: Mail, color: "var(--muted)" };
        return (
          <button key={n.id} className={`notif-row ${n.is_read ? "" : "unread"}`} onClick={() => open(n)}>
            <span className="notif-ic" style={{ background: `${st.color}18`, color: st.color }}>
              <st.icon size={14} />
            </span>
            <span className="notif-txt">
              <b>{n.title}</b>
              {(n.subject || n.body) && <span className="notif-sub">{n.subject || n.body}</span>}
              <small>{n.ago}{n.actor_name ? ` · ${n.actor_name}` : ""}</small>
            </span>
            {!n.is_read && <span className="notif-dot" aria-label="Unread" />}
          </button>
        );
      })}
    </div>
  );
}

/* ---- global search ---- */
function GlobalSearch({ onOpen, autoFocus = false, onDismiss }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  const inputRef = useRef(null);
  useClickAway(ref, () => setOpen(false));

  /* When the rail expands the search, the caret has to land in the field --
     otherwise the icon-first design costs an extra click instead of saving
     space. rAF because the input does not exist until after this paint. */
  useEffect(() => {
    if (!autoFocus) return;
    const id = requestAnimationFrame(() => inputRef.current && inputRef.current.focus());
    return () => cancelAnimationFrame(id);
  }, [autoFocus]);
  /*
   * Server-backed, debounced, and sequence-numbered.
   *
   * The working set only holds the 500 most recent tickets, so filtering it
   * meant older ones were unfindable from here. The server matches ticket id,
   * subject, name, email, phone, category and agent across the whole table.
   */
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const seqRef = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults([]); setSearching(false); return undefined; }

    setSearching(true);
    const seq = ++seqRef.current;
    const id = setTimeout(() => {
      fdTicketsApi.list({ view: "everything", search: term, page: 1, perPage: 8, scope: "globalsearch" })
        .then((r) => {
          if (seq !== seqRef.current) return;       // a newer keystroke won
          setResults(r.tickets || []);
          setSearching(false);
        })
        .catch((err) => {
          if (err.canceled || seq !== seqRef.current) return;
          setResults([]);
          setSearching(false);
        });
    }, 220);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => setHi(0), [q]);
  const choose = (t) => { onOpen(t); setQ(""); setOpen(false); };
  const onKey = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && results[hi]) { choose(results[hi]); }
    else if (e.key === "Escape") { setOpen(false); onDismiss && onDismiss(); }
  };
  return (
    <div className="search-wrap" ref={ref}>
      <div className="searchbox" style={{ maxWidth: "none" }}>
        <Search size={17} />
        <input ref={inputRef} placeholder="Search tickets, customers, phone, email…" value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey} />
        <kbd>⌘K</kbd>
      </div>
      {open && q.trim() && (
        <div className="search-results">
          {searching && !results.length ? (
            <div className="sr-busy"><Spinner size={15} /> Searching all tickets…</div>
          ) : results.length ? (<>
            <div className="sr-lab">{results.length} result{results.length > 1 ? "s" : ""}</div>
            {results.map((t, i) => (
              <div key={t.id} className={`sresult ${i === hi ? "hi" : ""}`} onMouseEnter={() => setHi(i)} onClick={() => choose(t)}>
                <span className="sa" style={{ background: avColor(t.name) }}>{initials(t.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="snm">{t.subject}</div>
                  <div className="smeta"><span>{t.name}</span><span>#{t.id}</span><span>{t.category}</span><span>{t.agent}</span></div>
                </div>
                <span className="badge-pill" style={{ marginLeft: "auto", ...(() => { const c = statusStyle(t.status); return { background: c.bg, color: c.fg }; })() }}>{t.status}</span>
              </div>
            ))}
          </>) : <EmptyState icon={Search} title="No tickets found" desc={`Nothing matches “${q}”. Try a name, email, phone or ticket number.`} />}
        </div>
      )}
    </div>
  );
}

/* ---- New ticket modal ---- */
function TicketModal({ open, onClose }) {
  const push = useToast();
  const [f, setF] = useState({ name: "", email: "", phone: "", subject: "", desc: "", cat: "Internship", prio: "Medium", agent: "Unassigned" });
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  if (!open) return null;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    if (!f.name || !f.email || !f.subject) { push({ type: "error", title: "Missing details", desc: "Name, email and subject are required." }); return; }
    setSaving(true);
    setTimeout(() => { setSaving(false); onClose(); push({ type: "success", title: "Ticket created", desc: `“${f.subject}” added and assigned to ${f.agent}.` }); }, 700);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB", width: 32, height: 32 }}><Ticket size={16} /></span>New Ticket</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <div className="grid2">
            <div className="fld"><label>Customer Name *</label><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Ananya Sharma" /></div>
            <div className="fld"><label>Email *</label><input value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@email.com" /></div>
            <div className="fld"><label>Phone Number</label><input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 …" /></div>
            <div className="fld"><label>Category</label><select value={f.cat} onChange={(e) => set("cat", e.target.value)}>{TICKET_CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div className="fld"><label>Subject *</label><input value={f.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Short summary of the issue" /></div>
          <div className="fld"><label>Description</label><textarea value={f.desc} onChange={(e) => set("desc", e.target.value)} placeholder="Describe the issue in detail…" /></div>
          <div className="grid2">
            <div className="fld"><label>Priority</label><select value={f.prio} onChange={(e) => set("prio", e.target.value)}>{["Low","Medium","High","Critical"].map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="fld"><label>Assigned Agent</label><select value={f.agent} onChange={(e) => set("agent", e.target.value)}>{AGENTS.map((a) => <option key={a}>{a}</option>)}</select></div>
          </div>
          <AttachField files={files} setFiles={setFiles} />
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? <><Spinner /> Saving…</> : <><Check size={15} /> Save Ticket</>}</button></div>
      </div>
    </div>
  );
}

/* ---- Compose email modal ---- */
function EmailComposeModal({ open, onClose, to = "" }) {
  const push = useToast();
  const [f, setF] = useState({ to, cc: "", bcc: "", subject: "", body: "" });
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  if (!open) return null;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const send = () => {
    if (!f.to || !f.subject) { push({ type: "error", title: "Missing details", desc: "A recipient and subject are required." }); return; }
    setSending(true);
    setTimeout(() => { setSending(false); onClose(); push({ type: "success", title: "Email sent", desc: `Your email to ${f.to} has been sent.` }); }, 700);
  };
  const draft = () => { onClose(); push({ type: "info", title: "Saved as draft", desc: "Your email was saved to drafts." }); };
  const RTE = [Bold, Italic, Underline, Heading1, List, ListOrdered, Link2, ImageIcon];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#0EA5E918", color: "#0EA5E9", width: 32, height: 32 }}><Mail size={16} /></span>New Email</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <div className="fld"><label>To *</label>
            <div className="rcpt-field"><RecipientInput value={f.to} onChange={(v) => set("to", v)} placeholder="recipient@email.com" autoFocus /></div>
          </div>
          <div className="grid2">
            <div className="fld"><label>Cc</label>
              <div className="rcpt-field"><RecipientInput value={f.cc} onChange={(v) => set("cc", v)} placeholder="cc@email.com" /></div>
            </div>
            <div className="fld"><label>Bcc</label>
              <div className="rcpt-field"><RecipientInput value={f.bcc} onChange={(v) => set("bcc", v)} placeholder="bcc@email.com" /></div>
            </div>
          </div>
          <div className="fld"><label>Subject *</label><input value={f.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Email subject" /></div>
          <div className="fld"><label>Message</label>
            <div className="rte" style={{ border: "1px solid var(--border)", borderRadius: "10px 10px 0 0", borderBottom: 0 }}>{RTE.map((Ic, i) => <button key={i} type="button"><Ic size={16} /></button>)}</div>
            <textarea style={{ borderRadius: "0 0 10px 10px", minHeight: 150 }} value={f.body} onChange={(e) => set("body", e.target.value)} placeholder="Write your message…" />
          </div>
          <AttachField files={files} setFiles={setFiles} />
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={draft}>Save as Draft</button><button className="btn btn-primary btn-sm" onClick={send} disabled={sending}>{sending ? <><Spinner /> Sending…</> : <><Send size={15} /> Send Email</>}</button></div>
      </div>
    </div>
  );
}

/* ---- Assign dialog ---- */
/*
 * Assign one ticket to a real agent.
 *
 * Both pickers used to be fiction. The agent list was the AGENTS constant --
 * five invented names -- and "assigning" was a 600ms setTimeout that showed a
 * success toast and wrote nothing. It now reads the active rows of admin_users
 * through desk.ensureAgents() and calls the same update endpoint the ticket
 * screen uses, so the assignment survives a refresh.
 *
 * The ticket picker is a combobox rather than a <select>: with hundreds of
 * tickets the native popup stalls on open, and typeahead over entries that all
 * begin "#33" finds nothing. Search accepts a ticket number, a requester name,
 * an email address, or words from the subject.
 */
function AssignDialog({ open, onClose }) {
  const push = useToast();
  const desk = useDesk();
  const [tid, setTid] = useState("");
  const [agent, setAgent] = useState("");
  const [busy, setBusy] = useState(false);

  // Fetched when the dialog opens, not on mount -- most sessions never assign.
  useEffect(() => { if (open && desk.ensureAgents) desk.ensureAgents(); }, [open, desk]);
  useEffect(() => { if (open) { setTid(""); setAgent(""); } }, [open]);

  const tickets = (desk && desk.tickets) || [];
  const agents = (desk && desk.agents) || [];
  const agentsLoading = open && agents.length === 0;

  const ticketOptions = useMemo(() => tickets.map((t) => ({
    value: t.id,
    label: `#${t.id} — ${t.subject || "(no subject)"}`,
    sub: [t.name, t.email].filter(Boolean).join(" · "),
    hint: t.status,
    // Everything the agent might type, in one haystack.
    search: [t.id, t.subject, t.name, t.email, t.status, t.priority].filter(Boolean).join(" "),
  })), [tickets]);

  const agentOptions = useMemo(() => agents
    .filter((a) => a.name && a.name !== "Unassigned")
    .map((a) => ({
      value: a.name,
      label: a.name,
      sub: a.email || "",
      hint: a.role || "",
      search: [a.name, a.email, a.role].filter(Boolean).join(" "),
    })), [agents]);

  if (!open) return null;

  const assign = async () => {
    setBusy(true);
    try {
      await desk.updateTicket(Number(tid), { agent });
      onClose();
      push({ type: "success", title: "Ticket assigned", desc: `#${tid} assigned to ${agent}.` });
    } catch (err) {
      // updateTicket already rolled the row back and raised its own toast.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="panel-title" style={{ fontSize: 15 }}>
            <span className="pic" style={{ background: "#0EA5E918", color: "#0EA5E9", width: 32, height: 32 }}><UserPlus size={16} /></span>
            Assign Ticket
          </div>
          <button className="icon-btn" onClick={onClose}><X size={17} /></button>
        </div>

        <div className="modal-body">
          <div className="fld">
            <label>Select Ticket</label>
            <SearchSelect
              value={tid}
              onChange={setTid}
              options={ticketOptions}
              placeholder="Choose a ticket…"
              searchPlaceholder="Ticket number, name, email or subject…"
              emptyText="No ticket matches that"
            />
          </div>

          <div className="fld">
            <label>Assign to Agent</label>
            {agentsLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 2px", color: "var(--muted)", fontSize: 13 }}>
                <Spinner size={14} /> Loading agents…
              </div>
            ) : (
              <SearchSelect
                value={agent}
                onChange={setAgent}
                options={agentOptions}
                placeholder="Choose an agent…"
                searchPlaceholder="Name or email…"
                emptyText="No agent matches that"
              />
            )}
            {!agentsLoading && agentOptions.length === 0 && (
              /* An empty picker with no explanation reads as a broken dialog. */
              <small style={{ color: "var(--warning)", fontSize: 11.5, marginTop: 6, display: "block" }}>
                No agents found in admin_users. Check that the accounts are active.
              </small>
            )}
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" disabled={busy || !tid || !agent}
                  title={!tid ? "Pick a ticket first" : !agent ? "Pick an agent first" : ""}
                  onClick={assign}>
            {busy ? <><Spinner /> Assigning…</> : <><UserCheck size={15} /> Assign</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Analytics modal ---- */
function AnalyticsModal({ open, onClose }) {
  const push = useToast();
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (open) { setLoading(true); const t = setTimeout(() => setLoading(false), 700); return () => clearTimeout(t); } }, [open]);
  const A = useMemo(computeAnalytics, []);
  if (!open) return null;
  const kpis = [
    ["Total Tickets", A.total], ["Open", A.open], ["Closed", A.closed], ["Pending", A.pending],
    ["Overdue", A.overdue], ["Resolution Rate", A.resolutionRate + "%"], ["Avg Response", A.avgResp], ["Avg Resolution", A.avgRes],
    ["CSAT", A.csat + "%"], ["SLA Compliance", A.slaCompliance + "%"], ["Received Today", A.today], ["This Month", A.month],
  ];
  const doExcel = async () => {
    try {
      const XLSX = await loadXLSX();
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpis.map(([k, v]) => ({ Metric: k, Value: v }))), "Summary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(A.byCategory.map((c) => ({ Category: c.name, Tickets: c.value }))), "By Category");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(A.byAgent.map((c) => ({ Agent: c.name, Tickets: c.value }))), "By Agent");
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      downloadBlob(out, "helphive-analytics.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      push({ type: "success", title: "Analytics exported", desc: "helphive-analytics.xlsx downloaded." });
    } catch (e) { push({ type: "error", title: "Export failed", desc: "Could not generate the file." }); }
  };
  const doPDF = () => {
    const ok = exportPDF("Support Analytics Report", ["Metric", "Value"], kpis.map(([k, v]) => ({ Metric: k, Value: v })));
    push(ok ? { type: "success", title: "Opening print dialog", desc: "Choose “Save as PDF”." } : { type: "error", title: "Popup blocked", desc: "Allow popups to export PDF." });
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB", width: 32, height: 32 }}><BarChart3 size={16} /></span>Support Analytics</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn btn-soft btn-sm" onClick={doExcel}><FileSpreadsheet size={14} /> Excel</button>
            <button className="btn btn-soft btn-sm" onClick={doPDF}><FileText size={14} /> PDF</button>
            <button className="icon-btn" onClick={onClose}><X size={17} /></button>
          </div>
        </div>
        <div className="modal-body">
          {loading ? <div style={{ padding: "60px", display: "grid", placeItems: "center", color: "var(--muted)", gap: 12 }}><Spinner size={30} /><span style={{ fontSize: 13, fontWeight: 600 }}>Crunching ticket data…</span></div> : (<>
            <div className="an-kpis">{kpis.map(([k, v]) => (<div className="an-kpi" key={k}><div className="v">{typeof v === "number" ? v.toLocaleString("en-IN") : v}</div><div className="l">{k}</div></div>))}</div>
            <div style={{ marginTop: 16 }}>
              <div className="prog-line"><div className="pl"><span>Resolution Rate</span><span style={{ color: "var(--primary)" }}>{A.resolutionRate}%</span></div><div className="pb"><i style={{ width: A.resolutionRate + "%", background: "var(--primary)" }} /></div></div>
              <div className="prog-line"><div className="pl"><span>SLA Compliance</span><span style={{ color: "var(--success)" }}>{A.slaCompliance}%</span></div><div className="pb"><i style={{ width: A.slaCompliance + "%", background: "var(--success)" }} /></div></div>
              <div className="prog-line"><div className="pl"><span>Customer Satisfaction</span><span style={{ color: "var(--accent)" }}>{A.csat}%</span></div><div className="pb"><i style={{ width: A.csat + "%", background: "var(--accent)" }} /></div></div>
            </div>
            <div className="an-charts">
              <div className="card card-pad"><h4 className="card-title" style={{ marginBottom: 10 }}>Tickets by Category</h4>
                <div style={{ height: 200 }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={A.byCategory} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="none">{A.byCategory.map((d, i) => <Cell key={i} fill={DISTRIBUTION[i % DISTRIBUTION.length].color} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart></ResponsiveContainer></div>
              </div>
              <div className="card card-pad"><h4 className="card-title" style={{ marginBottom: 10 }}>Tickets by Priority</h4>
                <div style={{ height: 200 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={A.byPriority} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--hover)" }} /><Bar dataKey="value" name="Tickets" radius={[7, 7, 0, 0]} maxBarSize={46}>{A.byPriority.map((d, i) => <Cell key={i} fill={d.color} />)}</Bar></BarChart></ResponsiveContainer></div>
              </div>
              <div className="card card-pad" style={{ gridColumn: "1 / -1" }}><h4 className="card-title" style={{ marginBottom: 10 }}>Received vs Resolved (this week)</h4>
                <div style={{ height: 220 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={ANALYTICS.Week} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}><CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} /><XAxis dataKey="t" tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12.5 }} /><Line type="monotone" dataKey="Received" stroke="#5B5CEB" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="Resolved" stroke="#10B981" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div>
              </div>
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}

/* ---- Recent activities drawer ---- */
/**
 * Recent Activities — the REAL fd_activity feed.
 *
 * This drawer was still rendering ACTIVITY_FEED, a hard-coded array of invented
 * people and July 2026 timestamps. Every event on this desk is already written
 * to fd_activity by fd_emit() before it is published, so the feed exists; it
 * just was not being read.
 *
 * Fetched when the drawer OPENS, not on mount — it is a panel most agents never
 * open, and the desk deliberately makes no request nobody asked for.
 */
function RecentActivitiesDrawer({ open, onClose, onOpenTicket, tickets }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [rows, setRows] = useState(null);   // null = not loaded yet
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setRows(null); setError(null);
    fdStats.feed(60)
      .then((r) => { if (alive) setRows(r.feed || []); })
      .catch((e) => { if (alive) { setRows([]); setError(e.message); } });
    return () => { alive = false; };
  }, [open]);

  if (!open) return null;

  /* fd_activity stores machine event names; these are the human labels and the
     colours the rows are tinted with. Anything unmapped still renders — it just
     gets the neutral treatment rather than being dropped. */
  const EVENTS = {
    "new-ticket":           { label: "Ticket Created",  color: "#5B5CEB", icon: PlusCircle },
    "new-message":          { label: "Customer Replied", color: "#0EA5E9", icon: Mail },
    "message-sent":         { label: "Agent Replied",   color: "#10B981", icon: Reply },
    "note-added":           { label: "Note Added",      color: "#F59E0B", icon: Lock },
    "ticket-updated":       { label: "Ticket Updated",  color: "#8B5CF6", icon: SlidersHorizontal },
    "tickets-bulk-updated": { label: "Bulk Update",     color: "#8B5CF6", icon: SlidersHorizontal },
    "tickets-bulk-closed":  { label: "Bulk Closed",     color: "#64748B", icon: CheckCheck },
    "tickets-auto-closed":  { label: "Auto Closed",     color: "#64748B", icon: CheckCheck },
    "tickets-merged":       { label: "Tickets Merged",  color: "#0EA5E9", icon: FolderInput },
    "tickets-spam":         { label: "Marked Spam",     color: "#EF4444", icon: ShieldX },
    "tickets-trash":        { label: "Moved to Trash",  color: "#EF4444", icon: Trash },
    "tickets-deleted":      { label: "Deleted",         color: "#EF4444", icon: Trash2 },
    "sla-breach":           { label: "SLA Breached",    color: "#EF4444", icon: AlertTriangle },
    "mailbox-down":         { label: "Mailbox Error",   color: "#EF4444", icon: AlertCircle },
    "contact-blocked":      { label: "Sender Blocked",  color: "#EF4444", icon: ShieldX },
    "test-event":           { label: "Test",            color: "#64748B", icon: Activity },
  };
  const meta = (ev) => EVENTS[ev] || { label: ev || "Activity", color: "#64748B", icon: Activity };

  /* Only the event types actually present, so the filter never offers a chip
     that matches nothing. */
  const present = Array.from(new Set((rows || []).map((r) => meta(r.event).label)));
  const types = ["All", ...present];

  const term = q.trim().toLowerCase();
  const list = (rows || []).filter((a) => {
    const m = meta(a.event);
    if (filter !== "All" && m.label !== filter) return false;
    if (!term) return true;
    return [m.label, a.summary, a.actor_name, a.requester_name, a.subject, a.ticket_id]
      .filter(Boolean).join(" ").toLowerCase().includes(term);
  });

  const openTicket = (id) => {
    if (!id || !onOpenTicket) return;
    const t = (tickets || []).find((x) => Number(x.id) === Number(id));
    if (t) { onClose(); onOpenTicket(t); }
  };

  return (<>
    <div className="drawer-overlay" onClick={onClose} />
    <div className="drawer">
      <div className="drawer-head">
        <h3 className="card-title">
          <Activity size={16} style={{ verticalAlign: "-3px", marginRight: 7, color: "var(--primary)" }} />
          Recent Activities
        </h3>
        <button className="icon-btn" onClick={onClose}><X size={17} /></button>
      </div>

      <div style={{ padding: "14px 20px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="searchbox" style={{ maxWidth: "none" }}>
          <Search size={15} />
          <input placeholder="Search activities…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {types.length > 1 && (
          <div className="chips">
            {types.map((t) => (
              <button key={t} className={`fchip ${filter === t ? "on" : ""}`} onClick={() => setFilter(t)}>{t}</button>
            ))}
          </div>
        )}
      </div>

      <div className="drawer-body" style={{ paddingTop: 6 }}>
        {rows === null && (
          <div className="act-loading"><Spinner size={18} /> Loading activity…</div>
        )}

        {rows !== null && error && (
          <EmptyState icon={AlertCircle} title="Could not load activity" desc={error} />
        )}

        {rows !== null && !error && list.length === 0 && (
          <EmptyState icon={Activity}
                      title={rows.length ? "No matching activity" : "Nothing has happened yet"}
                      desc={rows.length
                        ? "Nothing matches your search or filter."
                        : "Replies, new mail and ticket changes will appear here as they happen."} />
        )}

        {list.map((a) => {
          const m = meta(a.event);
          const Ic = m.icon;
          return (
            <div className={`act-item ${a.ticket_id ? "act-click" : ""}`} key={a.id}
                 onClick={() => openTicket(a.ticket_id)}>
              <span className="ai" style={{ background: `${m.color}18`, color: m.color }}><Ic size={17} /></span>
              <div style={{ minWidth: 0 }}>
                <div className="at">
                  {/* summary is written server-side and already names who did
                      what; falling back to the raw event keeps an unmapped
                      type readable rather than blank. */}
                  {a.summary || m.label}
                  {a.ticket_id ? <> · <b style={{ color: "var(--primary)" }}>#{a.ticket_id}</b></> : null}
                </div>
                <div className="am">
                  <span className="badge-pill" style={{ background: `${m.color}14`, color: m.color }}>{m.label}</span>
                  {a.actor_name && <span>{a.actor_name}</span>}
                  <span>·</span>
                  <span>{a.ago}</span>
                  {a.dt && <span style={{ color: "var(--faint)" }}>({a.dt})</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </>);
}

function ThemeSwatch({ field, value, onChange }) {
  return (
    <div className="swatch-row">
      <label className="chip-color" style={{ background: value }}><input type="color" value={value} onChange={(e) => onChange(e.target.value)} /></label>
      <div style={{ flex: 1, minWidth: 0 }}><div className="lab">{field.label}</div><div className="rgb">rgb({hexToRgb(value)})</div></div>
      <input className="hex" value={value} onChange={(e) => { let v = e.target.value; if (!v.startsWith("#")) v = "#" + v; onChange(v); }} />
    </div>
  );
}

function ThemePreview() {
  return (
    <div className="tm-preview">
      <div className="tm-pv-nav"><span style={{ width: 22, height: 22, borderRadius: 7, background: "var(--primary)", display: "grid", placeItems: "center" }}><Ticket size={12} color="#fff" /></span><span style={{ fontSize: 12, fontWeight: 700 }}>HelpHive</span><span style={{ marginLeft: "auto", display: "flex", gap: 6 }}><span className="btn btn-primary" style={{ padding: "5px 10px", fontSize: 11 }}>Button</span></span></div>
      <div className="tm-pv-body">
        <div className="tm-pv-side"><i className="a" /><i /><i /><i /></div>
        <div className="tm-pv-main">
          <div className="tm-pv-card"><div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Ticket card</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><span className="badge-pill" style={{ background: "var(--success-soft)", color: "var(--success)" }}>Open</span><span className="badge-pill" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>Pending</span><span className="badge-pill" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>Overdue</span></div>
            <div className="tm-pv-bar"><i /></div>
          </div>
          <div style={{ display: "flex", gap: 6 }}><span className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 11.5 }}>Primary</span><span className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 11.5 }}>Ghost</span></div>
        </div>
      </div>
    </div>
  );
}

function ThemeDrawer({ open, onClose, theme, setTheme, dark, onResetDefault }) {
  const push = useToast();
  const fileRef = useRef(null);
  if (!open) return null;
  const set = (k, v) => setTheme((t) => ({ ...t, [k]: v }));
  const activePreset = PRESETS.find((p) => JSON.stringify(p.t) === JSON.stringify(theme));
  const save = () => { try { localStorage.setItem("helphive-theme", JSON.stringify(theme)); push({ type: "success", title: "Theme saved", desc: "It'll load automatically next time." }); } catch (e) { push({ type: "error", title: "Couldn't save", desc: "Local storage is unavailable here." }); } };
  const exportTheme = () => { downloadBlob(JSON.stringify(theme, null, 2), "helphive-theme.json", "application/json"); push({ type: "success", title: "Theme exported", desc: "helphive-theme.json downloaded." }); };
  const importTheme = (file) => { if (!file) return; const r = new FileReader(); r.onload = (e) => { try { const t = JSON.parse(e.target.result); setTheme({ ...THEME_DEFAULT, ...t }); push({ type: "success", title: "Theme imported", desc: "Applied instantly." }); } catch (err) { push({ type: "error", title: "Invalid file", desc: "That doesn't look like a theme JSON." }); } }; r.readAsText(file); };
  return (<>
    <div className="drawer-overlay" onClick={onClose} />
    <div className="drawer theme-drawer">
      <div className="drawer-head"><h3 className="card-title"><Palette size={16} style={{ verticalAlign: "-3px", marginRight: 7, color: "var(--primary)" }} />Theme Customization</h3><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
      <div className="drawer-body">
        <div className="tm-sec">Preset Themes</div>
        <div className="preset-grid">
          {PRESETS.map((p) => (
            <button key={p.name} className={`preset ${activePreset?.name === p.name ? "on" : ""}`} onClick={() => setTheme({ ...p.t })}>
              <span className="sw"><i style={{ background: p.t.primary }} /><i style={{ background: p.t.accent }} /><i style={{ background: p.t.success }} /></span>{p.name}
            </button>
          ))}
        </div>
        <div className="tm-sec" style={{ marginTop: 10 }}>Live Preview</div>
        <ThemePreview />
        <div className="tm-sec" style={{ marginTop: 10 }}>Colors</div>
        <div>{THEME_FIELDS.map((f) => <ThemeSwatch key={f.key} field={f} value={theme[f.key]} onChange={(v) => set(f.key, v)} />)}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button className="btn btn-soft btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={exportTheme}><Download size={14} /> Export</button>
          <button className="btn btn-soft btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => fileRef.current?.click()}><Upload size={14} /> Import</button>
          <input ref={fileRef} type="file" accept=".json" hidden onChange={(e) => importTheme(e.target.files[0])} />
        </div>
      </div>
      <div className="drawer-foot">
        <button className="btn btn-soft" style={{ justifyContent: "center" }} onClick={() => { onResetDefault(); push({ type: "info", title: "Theme reset", desc: "Back to the default palette." }); }}><RefreshCw size={15} /> Reset</button>
        <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={save}><Check size={15} /> Save Theme</button>
      </div>
    </div>
  </>);
}

function CommandPalette({ open, onClose, tickets, go, openTicket, dark, setDark, openTheme }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { if (open) { setQ(""); setTimeout(() => inputRef.current?.focus(), 40); } }, [open]);
  if (!open) return null;
  const ql = q.toLowerCase();
  const pages = [
    { icon: LayoutDashboard, label: "Go to Dashboard", run: () => go("home") },
    { icon: Ticket, label: "Go to Tickets", run: () => go("tickets") },
    { icon: Users, label: "Go to Customers", run: () => go("customers") },
    { icon: BarChart3, label: "Go to Reports", run: () => go("reports") },
    { icon: Bot, label: "Go to Automation", run: () => go("automation") },
    { icon: Settings, label: "Go to Settings", run: () => go("settings") },
    { icon: User, label: "Open Admin Profile", run: () => go("profile") },
  ].filter((p) => !ql || p.label.toLowerCase().includes(ql));
  const actions = [
    { icon: dark ? Sun : Moon, label: dark ? "Switch to Light Mode" : "Switch to Dark Mode", run: () => setDark(!dark) },
    { icon: Droplet, label: "Customize Theme", run: openTheme },
  ].filter((a) => !ql || a.label.toLowerCase().includes(ql));
  const tix = !ql ? [] : (tickets || []).filter((t) => `${t.id} ${t.name || ""} ${t.subject || ""}`.toLowerCase().includes(ql)).slice(0, 5);
  const custSeen = new Set();
  const custs = !ql ? [] : (tickets || []).filter((t) => { const k = t.email; if (!k || custSeen.has(k)) return false; custSeen.add(k); return `${t.name || ""} ${t.email || ""}`.toLowerCase().includes(ql); }).slice(0, 4);
  const fire = (fn) => { fn(); onClose(); };
  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-in"><Search size={17} /><input ref={inputRef} placeholder="Search tickets, customers, pages, actions…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }} /><kbd>ESC</kbd></div>
        <div className="cmdk-body">
          {pages.length > 0 && <><div className="cmdk-h">Pages</div>{pages.map((p) => <button key={p.label} className="cmdk-item" onClick={() => fire(p.run)}><span className="ic"><p.icon size={15} /></span>{p.label}</button>)}</>}
          {actions.length > 0 && <><div className="cmdk-h">Actions</div>{actions.map((a) => <button key={a.label} className="cmdk-item" onClick={() => fire(a.run)}><span className="ic"><a.icon size={15} /></span>{a.label}</button>)}</>}
          {tix.length > 0 && <><div className="cmdk-h">Tickets</div>{tix.map((t) => <button key={t.id} className="cmdk-item" onClick={() => fire(() => openTicket(t))}><span className="ic" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}><Ticket size={14} /></span><span style={{ flex: 1, textAlign: "left" }}>#{t.id} · {t.subject}</span><span className="cmdk-meta">{t.name}</span></button>)}</>}
          {custs.length > 0 && <><div className="cmdk-h">Customers</div>{custs.map((t) => <button key={t.email} className="cmdk-item" onClick={() => fire(() => go("customers"))}><span className="a" style={{ background: avColor(t.name), width: 24, height: 24, borderRadius: 8, display: "grid", placeItems: "center", color: "#fff", fontSize: 10, fontWeight: 800 }}>{initials(t.name)}</span><span style={{ flex: 1, textAlign: "left" }}>{t.name}</span><span className="cmdk-meta">{t.email}</span></button>)}</>}
          {ql && !pages.length && !actions.length && !tix.length && !custs.length && <div className="cmdk-empty"><Search size={20} />No results for “{q}”</div>}
        </div>
        <div className="cmdk-foot"><span><kbd>↑↓</kbd> browse</span><span><kbd>↵</kbd> open</span><span><kbd>Ctrl K</kbd> toggle</span></div>
      </div>
    </div>
  );
}

function AiAssistant({ tickets, go, openTickets, openTicket }) {
  const push = useToast();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ who: "ai", text: "Hi! I'm your HelpHive copilot. Try: “show overdue tickets”, “open attendance tickets”, or “generate weekly report”." }]);
  const [q, setQ] = useState("");
  const bodyRef = useRef(null);
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [msgs, open]);
  const answer = (text) => {
    const t = text.toLowerCase();
    if (/overdue/.test(t)) { setTimeout(() => { openTickets("all", "Overdue"); }, 500); return "Opening all overdue tickets for you…"; }
    if (/attendance/.test(t)) { const m = (tickets || []).filter((x) => x.category === "Attendance"); return { text: `Found ${m.length} attendance ticket${m.length !== 1 ? "s" : ""}:`, links: m.slice(0, 4) }; }
    if (/certificate/.test(t)) { const m = (tickets || []).filter((x) => x.category === "Certificate"); return { text: `Found ${m.length} certificate ticket${m.length !== 1 ? "s" : ""}:`, links: m.slice(0, 4) }; }
    if (/weekly report|generate.*report/.test(t)) { setTimeout(() => go("reports"), 500); return "Taking you to the Reports centre — use Quick Report Generator for a one-click weekly report."; }
    if (/refund/.test(t)) { const m = (tickets || []).filter((x) => /refund|payment|billing/i.test(`${x.subject || ""} ${x.category || ""}`)); return { text: `There are ${m.length} refund-related tickets. I can bulk-assign them from the Tickets page (select → Assign).`, links: m.slice(0, 3) }; }
    if (/csat|satisfaction/.test(t)) return "CSAT is at 93% this month (▲3%). Detractors are down to 4% — the biggest driver was faster first responses.";
    if (/sla/.test(t)) return "SLA health: first response 92%, resolution 86% against a 90% target. 3 tickets are currently at risk.";
    return "Here's what I can do: navigate (“show overdue tickets”), find by category (“open attendance tickets”), or reporting (“generate weekly report”). More skills coming soon!";
  };
  const send = () => {
    const text = q.trim(); if (!text) return;
    setQ("");
    setMsgs((m) => [...m, { who: "me", text }]);
    setTimeout(() => {
      const a = answer(text);
      setMsgs((m) => [...m, typeof a === "string" ? { who: "ai", text: a } : { who: "ai", text: a.text, links: a.links }]);
    }, 450);
  };
  return (
    <>
      <button className={`ai-fab ${open ? "hidden" : ""}`} onClick={() => setOpen(true)} title="AI Assistant" aria-label="Open AI Assistant"><Sparkles size={20} /></button>
      {open && (
        <div className="ai-panel">
          <div className="ai-head"><span className="ic"><Sparkles size={15} /></span><div style={{ flex: 1 }}><b>HelpHive Copilot</b><span className="st"><span className="dotc" style={{ background: "#22C55E", width: 6, height: 6 }} /> online</span></div><button className="icon-btn" onClick={() => setOpen(false)}><X size={16} /></button></div>
          <div className="ai-body" ref={bodyRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`ai-msg ${m.who}`}>
                <div className="bub">{m.text}
                  {m.links && m.links.length > 0 && <div className="ai-links">{m.links.map((t) => <button key={t.id} onClick={() => { setOpen(false); openTicket(t); }}><Ticket size={12} /> #{t.id} · {String(t.subject || "").slice(0, 34)}{String(t.subject || "").length > 34 ? "…" : ""}</button>)}</div>}
                </div>
              </div>
            ))}
          </div>
          <div className="ai-in"><input placeholder="Ask me anything…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} /><button className="btn btn-primary btn-sm" onClick={send}><Send size={14} /></button></div>
        </div>
      )}
    </>
  );
}

export {
  TopBar,
  AccountChip,
  AiAssistant,
  AnalyticsModal,
  AssignDialog,
  CommandPalette,
  ConnectionPill,
  EmailComposeModal,
  GlobalSearch,
  RailNotifications,
  RecentActivitiesDrawer,
  Sidebar,
  ThemeDrawer,
  ThemePreview,
  ThemeSwatch,
  TicketModal,
};
