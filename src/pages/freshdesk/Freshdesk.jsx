/*
 * src/pages/freshdesk/Freshdesk.jsx
 *
 * The helpdesk shell: routing between screens, the live data + realtime
 * providers, toasts, and the theme.
 *
 * Everything else lives in a sibling module:
 *   fdApi.js / useFreshdeskData.js / useFreshdeskRealtime.js / fdSound.js
 *                              the backend, the working set, realtime, the chime
 *   fdStyles.jsx               the stylesheet
 *   fdConstants.js             colour maps, views, enums, option lists
 *   fdStore.js                 the live ticket store
 *   fdShared.jsx               contexts and primitives
 *   fdAgent.js                 who is signed in + signatures
 *   fdTheme.js                 the runtime theme editor
 *   components/Chrome.jsx      the workspace rail and its modals
 *   pages/*.jsx                one file per screen
 */
import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useLocation, useNavigate } from "react-router-dom";
import { announceExpanded, onExpanded } from "../../hooks/sidebarBus";
import useFreshdeskData from "./useFreshdeskData";
import { tickets as fdTicketsApi } from "./fdApi";
import { VIEWS as FD_VIEWS } from "./fdConstants";
import { applySavedStudentContext, buildCustomers, syncTicketStore } from "./fdStore";
import useFreshdeskRealtime from "./useFreshdeskRealtime";
import { notificationPermission, primeAudio, requestNotificationPermission } from "./fdSound";
import { DeskCtx, Spinner, ToastCtx, ToastHost } from "./fdShared";
import { Styles } from "./fdStyles";
import { AlertCircle, ChevronRight, Menu, RefreshCw } from "lucide-react";
import { THEME_DARK, THEME_DEFAULT, applyTheme } from "./fdTheme";
import { DashboardPage } from "./pages/DashboardPage";
import { AutomationPage } from "./pages/AutomationPage";
import { AdminProfilePage, SettingsPage } from "./pages/SettingsPage";
import { CallerPage } from "./pages/CallerPage";
import { ReportsPage } from "./pages/ReportsPage";
import { CustomerProfilePage, CustomersPage } from "./pages/CustomersPage";
import { TicketDetailPage } from "./pages/TicketDetailPage";
import { TicketsPage } from "./pages/TicketsPage";
import { CommandPalette, Sidebar, ThemeDrawer, TopBar } from "./components/Chrome";


/**
 * Shown while a deep-linked ticket or customer is being resolved, and when it
 * turns out not to exist.
 *
 * Before this, a refresh on /freshdesk/tickets/336966 fell through the render
 * chain to the ticket LIST -- so the URL said one thing and the screen showed
 * another, which reads as "the page is broken".
 */
function RouteLoading({ label, busy, missing, missingText, onBack }) {
  return (
    <div className="content route">
      <div className="card card-pad" style={{ textAlign: "center", padding: "56px 24px" }}>
        {busy ? (
          <>
            <Spinner size={22} />
            <p style={{ marginTop: 12, color: "var(--muted)", fontSize: 13.5 }}>{label}</p>
          </>
        ) : missing ? (
          <>
            <h3 className="card-title" style={{ marginBottom: 6 }}>Not found</h3>
            <p style={{ color: "var(--muted)", fontSize: 13.5, marginBottom: 16 }}>{missingText}</p>
            <button className="btn btn-primary btn-sm" onClick={onBack}>Back to the list</button>
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Catches a render error in any screen.
 *
 * The desk renders data that came out of a mailbox, and mail is not tidy: a
 * missing phone number, a null subject, a contact with no name. Any one of
 * those throwing during render used to blank the entire page with nothing but a
 * console trace -- and the agent's only clue was that the desk "stopped
 * working".
 *
 * This keeps the chrome on screen, names the failure, and offers a way out.
 * It is a safety net, not a licence to skip the null checks: every crash that
 * lands here is still a bug to fix.
 */
class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("[freshdesk] render error", error, info);
  }

  componentDidUpdate(prev) {
    // Navigating away from the broken screen clears the error, so the desk
    // recovers without a full reload.
    if (prev.routeKey !== this.props.routeKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="content route">
        <div className="card card-pad" style={{ padding: "48px 24px", textAlign: "center" }}>
          <AlertCircle size={30} style={{ color: "var(--danger)", marginBottom: 12 }} />
          <h3 className="card-title" style={{ marginBottom: 6 }}>This screen hit an error</h3>
          <p style={{ color: "var(--muted)", fontSize: 13.5, marginBottom: 4 }}>
            The rest of the desk is fine — you can keep working.
          </p>
          <p style={{ color: "var(--faint)", fontSize: 12.5, marginBottom: 18, wordBreak: "break-word" }}>
            {String(this.state.error && this.state.error.message || this.state.error)}
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => this.setState({ error: null })}>
            <RefreshCw size={14} /> Try again
          </button>
        </div>
      </div>
    );
  }
}

export default function App() {
  const [dark, setDark] = useState(false);
  /* No sign-in / register screen here: the page is already behind the admin panel's
     ProtectedRoute + PermissionGate ('freshdesk'), so it renders the dashboard directly
     and defers sign-out to the panel's own auth. */
  const { logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  /* ======================= URL-BACKED NAVIGATION =========================
   * Every screen has a real address, so a refresh, a bookmark or a pasted link
   * all land where they should:
   *
   *   /freshdesk                    dashboard
   *   /freshdesk/tickets            the queue        (?view=unresolved)
   *   /freshdesk/tickets/336966     one conversation
   *   /freshdesk/customers          the directory
   *   /freshdesk/customers/<id>     one customer
   *   /freshdesk/settings/<section>   one settings section
   *   /freshdesk/automation/<module>  one automation module
   *   /freshdesk/caller|reports|profile
   *
   * The URL is the source of truth; `route` is derived from it. That ordering
   * matters -- keeping them as two independent states is how a Back button ends
   * up showing the previous URL with the current screen.
   */
  const location = useLocation();
  const navigate = useNavigate();

  const parsed = useMemo(() => {
    const seg = location.pathname.replace(/^\/+|\/+$/g, "").split("/");
    const i = seg.indexOf("freshdesk");
    const rest = i === -1 ? [] : seg.slice(i + 1).filter(Boolean);
    const head = rest[0] || "home";
    const KNOWN = ["home", "tickets", "customers", "caller", "reports", "automation", "settings", "profile"];
    if (!KNOWN.includes(head)) return { route: "home", id: null };
    if (head === "tickets"   && rest[1]) return { route: "ticket",   id: rest[1] };
    if (head === "customers" && rest[1]) return { route: "customer", id: decodeURIComponent(rest[1]) };
    // /freshdesk/settings/canned, /freshdesk/automation/forward -- the open
    // section is part of the address, so a refresh and a shared link both land
    // where the person actually was.
    if (head === "settings"   && rest[1]) return { route: "settings",   id: rest[1] };
    if (head === "automation" && rest[1]) return { route: "automation", id: rest[1] };
    return { route: head, id: null };
  }, [location.pathname]);

  const route = parsed.route;
  /* ?view=open keeps the chosen queue across a reload and makes a filtered
     list something you can send someone. */
  const urlView = new URLSearchParams(location.search).get("view");
  /** Navigate by screen name. Kept as the same `setRoute(name)` shape callers used. */
  const setRoute = useCallback((r) => {
    navigate(r === "home" ? "/freshdesk" : `/freshdesk/${r}`);
  }, [navigate]);
  /*
   * The student lookup in the top bar.
   *
   * Same destination as the admin panel's own navbar field, which this page
   * hides: /search_result takes an email or a phone number and resolves it to
   * the student. Leaving the desk is the point -- the answer lives on the
   * student's record, not in the mailbox.
   */
  const searchStudent = useCallback((term) => {
    const q = String(term || "").trim();
    if (q) navigate(`/search_result?q=${encodeURIComponent(q)}`);
  }, [navigate]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [activeCustomer, setActiveCustomer] = useState(null);
  const [tFilter, setTFilter] = useState({ view: "unresolved", status: [], createdWithinHours: null, dueWithinHours: null });
  const [toasts, setToasts] = useState([]);
  /*
   * This workspace nav is a RIGHT-hand rail, mutually exclusive with the admin
   * panel's left sidebar (see hooks/sidebarBus.js).
   *
   * It starts COLLAPSED. The ticket screens are the work; the rail is
   * navigation you reach for occasionally, and 240px of it permanently docked
   * was squeezing the conversation column on every laptop. The choice is
   * remembered, so an agent who prefers it open only says so once.
   */
  const [collapsed, setCollapsed] = useState(() => {
    try { const v = localStorage.getItem("hh-rail-collapsed"); return v === null ? true : v === "1"; }
    catch { return true; }
  });
  /* The moment the admin sidebar is expanded again, this rail gives way. */
  useEffect(() => onExpanded((which) => { if (which === "admin") setCollapsed(true); }), []);
  /* Expanding the rail claims the screen back, so it announces in turn. */
  const setNavCollapsed = (next) => {
    setCollapsed(next);
    try { localStorage.setItem("hh-rail-collapsed", next ? "1" : "0"); } catch { /* private window */ }
    if (!next) announceExpanded("freshdesk");
  };
  const [logo, setLogo] = useState(() => { try { return localStorage.getItem("hh-logo") || ""; } catch { return ""; } });
  useEffect(() => {
    (async () => {
      try {
        if (window.storage) {
          const r = await window.storage.get("hh-logo");
          if (r && r.value) setLogo(r.value);
        }
      } catch (e) { /* key missing — fine */ }
    })();
  }, []);
  const saveLogo = async (dataUrl) => {
    setLogo(dataUrl);
    let ok = false;
    try { if (dataUrl) localStorage.setItem("hh-logo", dataUrl); else localStorage.removeItem("hh-logo"); ok = true; } catch (e) {}
    try {
      if (window.storage) {
        if (dataUrl) await window.storage.set("hh-logo", dataUrl); else await window.storage.delete("hh-logo");
        ok = true;
      }
    } catch (e) {}
    if (dataUrl && !ok) push({ type: "warning", title: "Logo saved for this session only", desc: "Persistent storage is unavailable, so it may reset after a refresh." });
  };
  const navHist = useRef([]);
  const [navTick, setNavTick] = useState(0);
  const [theme, setTheme] = useState(null);        // null = untouched defaults
  const [themeOpen, setThemeOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdOpen((o) => !o); }
      if (e.key === "Escape") setCmdOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  /* ===================== LIVE DATA + REALTIME =========================== */
  /*
   * `fd` owns the working set and every write. `tickets` is passed down exactly
   * as the mock array used to be, so every page below renders unchanged -- the
   * rows are simply real now.
   */
  const fd = useFreshdeskData({ onToast: (t) => push(t) });
  const { tickets, setTickets } = fd;

  /* Keep the module-level TICKETS binding in step for the handful of helpers
     that read it outside React (exports, analytics, command palette). */
  useEffect(() => { applySavedStudentContext(syncTicketStore(tickets)); }, [tickets]);

  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem("fd-sound") !== "0"; } catch { return true; }
  });
  const [notifyOn, setNotifyOn] = useState(() => {
    try { return localStorage.getItem("fd-notify") === "1"; } catch { return false; }
  });
  /*
   * Background polling, off by default and remembered per browser.
   *
   * Only relevant when Pusher is not configured. With Pusher the websocket
   * delivers events and this changes nothing; without it, leaving this off
   * means an open panel issues no repeating requests at all and the agent
   * pulls updates with Refresh (or by opening a screen).
   */
  const [liveOn, setLiveOn] = useState(() => {
    try { return localStorage.getItem("fd-live") === "1"; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem("fd-live", liveOn ? "1" : "0"); } catch { /* private mode */ } }, [liveOn]);
  useEffect(() => { try { localStorage.setItem("fd-sound", soundOn ? "1" : "0"); } catch { /* private mode */ } }, [soundOn]);
  useEffect(() => { try { localStorage.setItem("fd-notify", notifyOn ? "1" : "0"); } catch { /* private mode */ } }, [notifyOn]);

  /*
   * The event handlers are wrapped in useCallback so the realtime hook does not
   * rebuild its websocket on every render of this component (it holds them in
   * refs, but a stable identity keeps the dependency honest either way).
   */
  /* Keyed on the one stable method rather than `fd`, which is a fresh object
     every render -- depending on it would rebuild the websocket continuously. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onRealtimeEvent = useCallback((evt) => { fd.applyRealtimeEvent(evt); }, [fd.applyRealtimeEvent]);

  const onRealtimeNewMail = useCallback((evt) => {
    const d = evt.data || {};
    if (evt.event === "test-event") {
      push({ type: "info", title: "Realtime test", desc: d.preview || "Connection is live." });
      return;
    }
    push({
      type: "info",
      title: evt.event === "new-ticket"
        ? `New ticket from ${d.from_name || "a customer"}`
        : `New reply from ${d.from_name || "a customer"}`,
      desc: d.subject || d.preview || "",
    });
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onRealtimeCounts = useCallback((c) => { fd.setCounts(c); }, [fd.setCounts]);

  const rt = useFreshdeskRealtime({
    onEvent: onRealtimeEvent,
    onNewMessage: onRealtimeNewMail,
    onCounts: onRealtimeCounts,
    soundEnabled: soundOn,
    notificationsEnabled: notifyOn,
    livePolling: liveOn,
  });

  /* Turning desktop notifications on must happen inside the click that asked
     for them -- Chrome ignores a permission prompt raised any other way. */
  const toggleNotifications = async () => {
    if (notifyOn) { setNotifyOn(false); return; }
    primeAudio();
    const perm = await requestNotificationPermission();
    if (perm === "granted") { setNotifyOn(true); push({ type: "success", title: "Desktop notifications on" }); }
    else if (perm === "denied") push({ type: "error", title: "Notifications blocked", desc: "Allow them for this site in your browser's address-bar settings." });
    else push({ type: "info", title: "Notifications not enabled" });
  };

  const deskApi = {
    ...fd,
    realtime: rt,
    soundOn, setSoundOn, notifyOn, toggleNotifications, liveOn, setLiveOn,
    notificationPermission: notificationPermission(),
  };
  useEffect(() => {                                  // load saved theme once
    try { const raw = localStorage.getItem("helphive-theme"); if (raw) setTheme({ ...THEME_DEFAULT, ...JSON.parse(raw) }); } catch (e) {}
  }, []);
  useEffect(() => { if (theme) applyTheme(theme, dark); }, [theme, dark]);
  const push = (t) => {
    const id = Date.now() + Math.random();
    setToasts((x) => [...x, { id, ...t }]);
    // An Undo the agent cannot reach in time is not an undo.
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), t && t.action ? 9000 : 4200);
  };
  const dismiss = (id) => setToasts((x) => x.filter((y) => y.id !== id));
  const top = () => window.scrollTo({ top: 0, behavior: "smooth" });
  /* Signing out logs the admin out of the whole panel, not just this page. */
  const signOut = () => { setNavOpen(false); setThemeOpen(false); logout(); };
  const go = (r) => { navigate(r === "home" ? "/freshdesk" : `/freshdesk/${r}`); setNavOpen(false); top(); };
  const [composeIntent, setComposeIntent] = useState(null);   // "Reply" | "Note" | null
  const openTicket = (t, compose = null) => {
    if (!t) return;
    setActiveTicket(t);
    setComposeIntent(compose);
    navigate(`/freshdesk/tickets/${t.id}`);
    top();
  };
  /**
   * Open the ticket list.
   *
   * Accepts either the old (view, statuses) pair or a descriptor from
   * STAT_FILTER. The descriptor form is what lets a stat card reproduce its own
   * query -- "created in the last 24h, any status" cannot be said with a view
   * name and a status list.
   */
  const openTickets = (viewOrSpec, status) => {
    const spec = (viewOrSpec && typeof viewOrSpec === "object")
      ? viewOrSpec
      : { view: viewOrSpec || "all", status: status || [] };

    setTFilter({
      view: spec.view || "all",
      status: spec.status || [],
      createdWithinHours: spec.createdWithinHours || null,
      dueWithinHours: spec.dueWithinHours || null,
    });
    navigate(`/freshdesk/tickets${spec.view && spec.view !== "all" ? `?view=${encodeURIComponent(spec.view)}` : ""}`);
    top();
  };
  const openCustomer = (c) => {
    if (!c) return;
    setActiveCustomer(c);
    navigate(`/freshdesk/customers/${encodeURIComponent(c.cid || c.id || c.email)}`);
    top();
  };
  /* The browser's own history IS the history now, so Back means Back --
     including out of the desk and back into it. The bespoke stack this
     replaced could disagree with the address bar. */
  const goBack = () => { navigate(-1); top(); };

  /*
   * What the top bar says about where you are.
   *
   * A ticket names the queue it came from and its own number; the list names
   * the view and how many are in it. Everything else keeps the plain screen
   * name, because "Reports > Reports" tells nobody anything.
   */
  const topCrumb = useMemo(() => {
    const viewKey = urlView || tFilter.view || "unresolved";
    const viewLabel = (FD_VIEWS.find((v) => v.key === viewKey) || {}).label || "All Tickets";

    if (route === "ticket") {
      return (<>
        <a onClick={() => go("tickets")}>{viewLabel}</a>
        <ChevronRight size={14} />
        <span className="cur">#{parsed.id}</span>
      </>);
    }
    if (route === "tickets") {
      const n = fd.counts ? fd.counts[viewKey] : null;
      return (<>
        <span className="cur">{viewLabel}</span>
        {n != null && <span className="count-badge">{Number(n).toLocaleString("en-IN")}</span>}
      </>);
    }
    if (route === "customer") {
      return (<>
        <a onClick={() => go("customers")}>Customers</a>
        <ChevronRight size={14} />
        <span className="cur">{activeCustomer ? activeCustomer.name : parsed.id}</span>
      </>);
    }
    const plain = { home: "Dashboard", customers: "Customers", caller: "Caller",
                    reports: "Reports", automation: "Automation", settings: "Settings",
                    profile: "Profile" }[route];
    return plain ? <span className="cur">{plain}</span> : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, parsed.id, urlView, tFilter.view, fd.counts, activeCustomer]);
  const canGoBack = true;
  const resetTheme = () => { setTheme(null); try { localStorage.removeItem("helphive-theme"); } catch (e) {} const root = document.querySelector(".app"); if (root) root.removeAttribute("style"); };
  const themeApi = { theme: theme || (dark ? THEME_DARK : THEME_DEFAULT), setTheme, resetTheme, dark };
  /*
   * Prev / Next through the queue, and what "Close" hands off to.
   *
   * Three things here were wrong and produced the same visible bug — closing a
   * ticket threw you back onto one you had already answered:
   *
   *   1. It moved activeTicket WITHOUT navigating, so the URL still named the
   *      old ticket. The deep-link effect below re-reads the URL on every
   *      `tickets` change — which is constantly, because every optimistic patch
   *      and every poll replaces that array — sees activeTicket disagreeing
   *      with the address bar, and snaps you back to the ticket you just left.
   *      Going through openTicket() keeps the two in step.
   *
   *   2. It stepped by array position in a list sorted by last_message_at.
   *      Replying bumps a ticket to index 0, so after answering two or three in
   *      a row, "next" from the top walked straight into the one answered
   *      before it.
   *
   *   3. It wrapped with % length, so Next from the last row silently became
   *      the first row.
   *
   * Now: move forward to the next ticket that still needs an agent, skipping
   * anything already Resolved/Closed and anything filed away, and stop at the
   * end of the queue instead of wrapping.
   */
  const step = (d) => {
    if (!tickets.length) return;
    const i = tickets.findIndex(t => t.id === (activeTicket && activeTicket.id));
    if (i < 0) return;

    const needsWork = (t) => t
      && !["Resolved", "Closed"].includes(t.status)
      && !t.spam && !t.trash;

    for (let j = i + d; j >= 0 && j < tickets.length; j += d) {
      if (needsWork(tickets[j])) { openTicket(tickets[j]); return; }
    }

    /* Nothing left in that direction. The queue is the right place to land --
       silently staying put reads as a dead button. */
    push({ type: "success", title: "That is the end of the queue", desc: "Nothing left to answer this way." });
    go("tickets");
  };
  /*
   * Deep links.
   *
   * On a cold load of /freshdesk/tickets/336966 there is no activeTicket yet --
   * the working set has not arrived, and the ticket may not even be in it (it
   * holds the 500 most recent). So: look in the loaded rows first, and fall
   * back to fetching that one ticket by id. Without this, a refresh on a ticket
   * page renders nothing at all.
   */
  const [deepLoading, setDeepLoading] = useState(false);
  useEffect(() => {
    if (route !== "ticket" || !parsed.id) return;
    const wanted = Number(parsed.id);
    if (activeTicket && Number(activeTicket.id) === wanted) return;

    const inSet = tickets.find((t) => Number(t.id) === wanted);
    if (inSet) { setActiveTicket(inSet); return; }
    if (fd.loading) return;            // the list is still coming; wait for it

    let alive = true;
    setDeepLoading(true);
    fdTicketsApi.get(wanted)
      .then((res) => {
        if (!alive) return;
        if (res.redirect_to) { navigate(`/freshdesk/tickets/${res.redirect_to}`, { replace: true }); return; }
        if (res.ticket) setActiveTicket(res.ticket);
      })
      .catch(() => { if (alive) push({ type: "error", title: `Ticket #${wanted} could not be opened` }); })
      .finally(() => { if (alive) setDeepLoading(false); });
    return () => { alive = false; };
  }, [route, parsed.id, tickets, fd.loading]);

  useEffect(() => {
    if (route !== "customer" || !parsed.id) return;
    if (activeCustomer && String(activeCustomer.cid || activeCustomer.id || activeCustomer.email) === String(parsed.id)) return;
    const list = buildCustomers();
    const hit = list.find((c) => String(c.cid) === String(parsed.id)
                              || String(c.id) === String(parsed.id)
                              || String(c.email) === String(parsed.id));
    if (hit) setActiveCustomer(hit);
  }, [route, parsed.id, tickets]);

  /*
   * The open ticket, always as the working set currently has it.
   *
   * activeTicket is a SNAPSHOT taken when the row was clicked. Every later
   * write — a status change, a reply bumping last_message_at, a poll — replaces
   * the object inside `tickets` but leaves that snapshot untouched, so the
   * detail screen could go on showing a status the list had already moved past.
   * Re-reading it by id on each render means there is one copy of the truth.
   *
   * The fallback matters: a deep link to a ticket outside the 500-row working
   * set is fetched on its own and is legitimately absent from `tickets`.
   */
  const active = useMemo(() => {
    if (!activeTicket) return null;
    const live = tickets.find((t) => Number(t.id) === Number(activeTicket.id));
    return live || activeTicket;
  }, [tickets, activeTicket]);
  return (
    <ToastCtx.Provider value={push}>
    <DeskCtx.Provider value={deskApi}>
    <div className={`app ${dark ? "dark" : ""}`}>
      <Styles />
      <div className="shell">
        {navOpen && <div className="overlay" onClick={() => setNavOpen(false)} />}
        {/* Only shown under 1024px, where the rail is off-canvas. */}
        <button className="rail-burger" onClick={() => setNavOpen(true)} title="Open workspace"><Menu size={19} /></button>
        {/* Page first, rail second: `.shell` is a flex row, so DOM order is visual
            order and the rail has to come last to sit on the right. */}
        {/* The ticket screen is a fixed three-column frame that scrolls in
            one place, and the list is a frame too -- its header stays put while
            the rows move. Both switch the shell's own scrolling off. */}
        <div className={`main ${route === "ticket" || route === "tickets" ? "main-fixed" : ""}`}>
          {/* The floating top bar is gone -- everything it carried (search, New,
              activity, notifications, theme, back) now lives in the right rail,
              which is the only chrome this page draws. That returns a full band
              of vertical space to every screen and stops the page competing
              with the admin panel's own header. */}
          <TopBar desk={deskApi} counts={fd.counts} dark={dark} setDark={setDark}
                  onOpenTicket={openTicket} onBack={goBack} canBack={canGoBack}
                  crumb={topCrumb} onStudentSearch={searchStudent} />

          <div className={`fd-stage ${route === "ticket" || route === "tickets" ? "on" : ""}`
                          + `${route === "ticket" || route === "tickets" ? " fd-fixed" : ""}`}>
          <RouteErrorBoundary routeKey={`${route}:${parsed.id || ""}`}>
          {route === "home" ? <DashboardPage onOpen={openTicket} onOpenTickets={openTickets} go={go} tickets={tickets} />
            : route === "automation" ? <AutomationPage onTheme={() => setThemeOpen(true)} go={go}
                  section={parsed.id} onSection={(k) => navigate(`/freshdesk/automation/${k}`)} />
            : route === "settings" ? <SettingsPage themeApi={themeApi} go={go} logoApi={{ logo, saveLogo }}
                  section={parsed.id} onSection={(k) => navigate(`/freshdesk/settings/${k}`)} />
            : route === "profile" ? <AdminProfilePage go={go} onSignOut={signOut} />
            : route === "caller" ? <CallerPage tickets={tickets} onOpenTicket={openTicket} />
            : route === "reports" ? <ReportsPage tickets={tickets} />
            : route === "customers" ? <CustomersPage onProfile={openCustomer} onOpenTicket={openTicket} tickets={tickets} />
            : route === "customer"
              ? (activeCustomer
                  ? <CustomerProfilePage customer={activeCustomer} onBack={() => go("customers")} onOpenTicket={openTicket} />
                  : <RouteLoading label="Loading customer…" busy={fd.loading}
                      missing={!fd.loading}
                      missingText={`No customer matches "${parsed.id}".`}
                      onBack={() => go("customers")} />)
            : route === "ticket"
              ? (active
                  ? <TicketDetailPage ticket={tickets.find(t => t.id === active.id) || active}
                      onBack={() => go("tickets")} onPrev={() => step(-1)} onNext={() => step(1)}
                      tickets={tickets} setTickets={setTickets}
                      onOpenTicket={openTicket} initialCompose={composeIntent} />
                  : <RouteLoading label={`Loading ticket #${parsed.id}…`}
                      busy={fd.loading || deepLoading}
                      missing={!fd.loading && !deepLoading}
                      missingText={`Ticket #${parsed.id} was not found. It may have been deleted or merged.`}
                      onBack={() => go("tickets")} />)
            : <TicketsPage key={`${urlView || tFilter.view}-${(tFilter.status || []).join()}-${tFilter.createdWithinHours || ""}-${tFilter.dueWithinHours || ""}`}
                onOpen={openTicket}
                initialView={urlView || tFilter.view} initialStatus={tFilter.status || []}
                initialCreatedWithinHours={tFilter.createdWithinHours}
                initialDueWithinHours={tFilter.dueWithinHours}
                tickets={tickets} setTickets={setTickets} />}
          </RouteErrorBoundary>
          </div>
        </div>
        <Sidebar
          open={navOpen}
          route={route === "ticket" ? "tickets" : route === "customer" ? "customers" : route}
          go={go}
          collapsed={collapsed}
          setCollapsed={setNavCollapsed}
          counts={fd.counts}
          desk={deskApi}
          onOpenTicket={openTicket}
        />
      </div>
      <ToastHost toasts={toasts} dismiss={dismiss} />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} tickets={tickets} go={go} openTicket={openTicket} dark={dark} setDark={setDark} openTheme={() => { setCmdOpen(false); setThemeOpen(true); }} />
      <ThemeDrawer open={themeOpen} onClose={() => setThemeOpen(false)} theme={theme || (dark ? THEME_DARK : THEME_DEFAULT)} setTheme={setTheme} dark={dark} onResetDefault={() => { setTheme(null); try { localStorage.removeItem("helphive-theme"); } catch (e) {} const root = document.querySelector(".app"); if (root) root.removeAttribute("style"); }} />
    </div>
    </DeskCtx.Provider>
    </ToastCtx.Provider>
  );

}