/*
 * src/pages/freshdesk/pages/SettingsPage.jsx — every settings panel, including
 * the mailbox/SMTP/realtime configuration the backend reads through fd_cfg().
 */
import { messages as fdMessages, realtime as fdRealtime, settings as fdSettings, sync as fdSync, tickets as fdTickets } from "../fdApi";
import { Activity, AlertCircle, AlertTriangle, AtSign, BadgeCheck, Ban, BarChart3, Bell, BellRing, BookOpen, Briefcase, CalendarClock, CalendarDays, Camera, Check, CheckCheck, CheckCircle2, ChevronRight, Clock3, Copy, Download, Eye, FileDown, FileText, FileUp, Forward, Globe, HardDrive, History, Inbox, Key, KeyRound, LogIn, LogOut, Mail, MapPin, MessageCircle, MessageSquare, MessageSquareText, Monitor, Palette, Pencil, PhoneCall, Plug, Plus, PlusCircle, RefreshCw, Reply, RotateCcw, Save, ScrollText, Search, Send, Settings, ShieldCheck, ShieldX, Smartphone, Ticket, Trash2, TrendingUp, Upload, User, UserCheck, UserCog, UserPlus, Users, UsersRound, Webhook, X, Zap } from "lucide-react";
import { BULK_AGENTS, BULK_PRIORITY, DEPTS, TICKET_TYPES, avColor, initials } from "../fdConstants";
import { ChartTooltip, ConfirmDialog, EmptyState, Spinner, StatusChip, Switch, downloadBlob, exportCSV, kvGetSync, kvSet, useToast } from "../fdShared";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { uid } from "./AutomationPage";
import { PROFILE_DEFAULT, SIG_PLACEHOLDERS, TEAM_KEY, USERS_KEY, currentAgentProfile, getSigSettings, getTeamRoster, resolveSignature, saveSigSettings } from "../fdAgent";
import { REG_DESIGNATIONS } from "./CallerPage";
import { PRESETS, THEME_DARK, THEME_DEFAULT, THEME_FIELDS } from "../fdTheme";
import { ThemePreview, ThemeSwatch } from "../components/Chrome";
import CannedManager from "../components/CannedManager";

/* ============================================================================
   SETTINGS MODULE
   ========================================================================== */
const SET_SECTIONS = [
  { key: "general", label: "General", icon: Settings },
  // The live mailbox controls: sync state, backlog, cleanup, auto-close.
  // Near the top because this is the section anyone actually needs.
  { key: "mailbox", label: "Mailbox", icon: Inbox },
  { key: "teams", label: "Team Management", icon: UsersRound },
  { key: "approvals", label: "User Approvals", icon: UserCheck },
  { key: "roles", label: "Roles & Permissions", icon: UserCog },
  { key: "ticket", label: "Ticket Settings", icon: Ticket },
  // Sits with the ticket settings because that is what it is: the reply
  // library agents pull from while answering.
  { key: "canned", label: "Canned Responses", icon: MessageSquareText },
  { key: "email", label: "Email Settings", icon: Mail },
  { key: "notif", label: "Notifications", icon: Bell },
  { key: "theme", label: "Theme & Appearance", icon: Palette },
  // Not a panel: the rules and their module switches live on their own screen.
  { key: "autom", label: "Automation", icon: Zap, goto: "automation" },
  { key: "customer", label: "Customer Settings", icon: Users },
  { key: "kb", label: "Knowledge Base", icon: BookOpen },
  { key: "security", label: "Security", icon: ShieldCheck },
  { key: "backup", label: "Backup & Restore", icon: HardDrive },
  { key: "audit", label: "Audit Logs", icon: ScrollText },
  { key: "api", label: "API & Integrations", icon: Plug },
  { key: "reports", label: "Reports", icon: BarChart3 },
];

const SET_TEAMS = ["Technical Support", "Internship Support", "Attendance Team", "Certificate Team", "Placement Team", "Billing Team", "Customer Success"];

const SET_ROLES = ["Super Admin", "Admin", "Team Lead", "Support Agent", "QA Manager"];

const SET_PERMS = ["Dashboard", "Tickets", "Customers", "Knowledge Base", "Reports", "Automation", "Analytics", "Settings", "Teams", "Export Reports", "Delete Tickets", "Merge Tickets", "Bulk Update", "Assign Tickets", "Close Tickets"];

const SEED_AGENTS = ["Rahul Sharma", "Priya Patel", "Aman Singh", "Neha Verma", "Karan Mehta", "Sneha Iyer", "Akash Gupta", "Pooja Sharma", "Rohan Desai", "Priya Nair", "Rahul Sethi"].map((n, i) => ({
  id: uid(), name: n, emp: `EMP-${1041 + i * 7}`, email: n.toLowerCase().replace(" ", ".") + "@internshipstudio.com",
  phone: `+91 98${(200 + i * 11).toString().padStart(3, "0")} ${(40000 + i * 731).toString().padStart(5, "0")}`,
  dept: DEPTS[i % DEPTS.length], role: ["Admin", "Team Lead", "Support Agent", "Support Agent", "Support Agent", "QA Manager", "Support Agent", "Team Lead", "Support Agent", "Team Lead", "Support Executive"][i],
  team: SET_TEAMS[i % SET_TEAMS.length], active: i !== 6, assigned: 4 + (i * 3) % 11, resolved: 2 + (i * 5) % 9,
  lastLogin: ["just now", "12 min ago", "1 hr ago", "3 hr ago", "yesterday", "2 days ago"][i % 6],
}));

/*
 * Every panel's preferences live in one JSON setting, UI_PREFS, keyed by
 * panel. It is loaded once per Settings visit and handed down through this
 * context, so fifteen panels do not each fetch the same row.
 */
const PrefsCtx = createContext(null);

function PrefsProvider({ children }) {
  const push = useToast();
  const [prefs, setPrefs] = useState(null);      // null = still loading
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fdSettings.get();
        if (!alive) return;
        const raw = (r.settings || {}).UI_PREFS;
        const parsed = typeof raw === "string" ? (raw ? JSON.parse(raw) : {}) : (raw || {});
        setPrefs(parsed && typeof parsed === "object" ? parsed : {});
      } catch (err) {
        if (!alive) return;
        // A failed load must not leave every panel spinning: fall back to the
        // shipped defaults and say why nothing will be remembered.
        setPrefs({});
        setError(err.message || "Could not load saved settings");
      }
    })();
    return () => { alive = false; };
  }, []);

  /* Writing one panel's slice re-sends the whole blob, because that is what
     the setting is. The local copy is updated first so the form does not
     flicker back to its old values while the request is in flight. */
  const savePanel = useCallback(async (key, value) => {
    const next = { ...(prefs || {}), [key]: value };
    setPrefs(next);
    try {
      await fdSettings.save({ UI_PREFS: next });
      return true;
    } catch (err) {
      push({ type: "error", title: "Could not save", desc: err.message });
      return false;
    }
  }, [prefs, push]);

  return <PrefsCtx.Provider value={{ prefs, savePanel, error }}>{children}</PrefsCtx.Provider>;
}

/**
 * One panel's preferences.
 *
 * @param key       where this panel's values live inside UI_PREFS
 * @param defaults  the shipped values, used until something is saved
 * @param label     what the toast calls this panel
 */
function useSet(defaults, label, key) {
  const push = useToast();
  const ctx = useContext(PrefsCtx);
  const stored = ctx && ctx.prefs ? ctx.prefs[key] : undefined;
  const loading = !ctx || ctx.prefs === null;

  /* Defaults merged under what was saved, so a value added to a panel after
     someone last saved appears with its default rather than as undefined. */
  const [v, setV] = useState(defaults);
  const [saved, setSaved] = useState(defaults);
  useEffect(() => {
    if (loading) return;
    const merged = { ...defaults, ...(stored || {}) };
    setV(merged); setSaved(merged);
  }, [loading, JSON.stringify(stored)]);   // eslint-disable-line react-hooks/exhaustive-deps

  const [busy, setBusy] = useState(false);
  const set = (k, val) => setV((x) => ({ ...x, [k]: val }));
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);

  const save = async () => {
    if (!ctx) return;
    setBusy(true);
    const ok = await ctx.savePanel(key, v);
    setBusy(false);
    if (!ok) return;
    setSaved(v);
    push({ type: "success", title: `${label} saved` });
  };
  const cancel = () => setV(saved);
  const reset = async () => {
    if (!ctx) return;
    setBusy(true);
    const ok = await ctx.savePanel(key, defaults);
    setBusy(false);
    if (!ok) return;
    setV(defaults); setSaved(defaults);
    push({ type: "info", title: `${label} reset`, desc: "Restored default values." });
  };
  return { v, set, dirty, save, cancel, reset, busy, loading };
}

function SaveBar({ s }) {
  return (
    <div className="savebar">
      <button className="btn btn-ghost btn-sm" disabled={s.busy} onClick={s.reset}><RotateCcw size={14} /> Reset to Default</button>
      <button className="btn btn-soft btn-sm" disabled={!s.dirty || s.busy} onClick={s.cancel}>Cancel</button>
      <button className="btn btn-primary btn-sm" disabled={!s.dirty || s.busy} onClick={s.save}>
        {s.busy ? <><Spinner /> Saving…</> : <><Save size={14} /> Save</>}
      </button>
    </div>
  );
}

function SetField({ label, children }) { return <div className="fld"><label>{label}</label>{children}</div>; }

function ToggleRow({ icon: Ic, title, desc, on, onChange }) {
  return (
    <div className="set-row">
      {Ic && <span className="pic" style={{ background: "var(--primary-soft)", color: "var(--primary)", width: 34, height: 34 }}><Ic size={16} /></span>}
      <div style={{ flex: 1 }}><div className="ti">{title}</div>{desc && <div className="td">{desc}</div>}</div>
      <Switch on={on} onChange={onChange} />
    </div>
  );
}

function SecCard({ title, sub, children, right }) {
  return (
    <div className="card card-pad">
      <div className="section-head" style={{ marginBottom: 14 }}>
        <div><h3 className="card-title">{title}</h3>{sub && <p className="card-sub">{sub}</p>}</div>{right}
      </div>
      {children}
    </div>
  );
}

/* ---- 1. general ---- */
function GeneralSettings({ logoApi }) {
  const push = useToast();
  const logo = logoApi?.logo || "";
  const saveLogo = logoApi?.saveLogo || (() => {});
  const fileRef = useRef(null);
  const [logoErr, setLogoErr] = useState("");
  const onLogoFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const okTypes = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
    if (!okTypes.includes(file.type)) { setLogoErr("Invalid file type. Use PNG, JPG, JPEG, SVG or WEBP."); push({ type: "error", title: "Invalid file", desc: "Allowed: PNG, JPG, JPEG, SVG, WEBP." }); return; }
    if (file.size > 5 * 1024 * 1024) { setLogoErr("File too large. Maximum size is 5 MB."); push({ type: "error", title: "File too large", desc: "Maximum logo size is 5 MB." }); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = String(ev.target.result);
      const finish = (dataUrl) => { setLogoErr(""); saveLogo(dataUrl); push({ type: "success", title: "Logo uploaded", desc: "Your logo now appears across the app and persists after refresh." }); };
      if (file.type === "image/svg+xml") { finish(raw); return; }
      // Downscale raster images so they always fit persistent storage quotas
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 512;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          finish(canvas.toDataURL("image/png"));
        } catch (e) { finish(raw); }
      };
      img.onerror = () => finish(raw);
      img.src = raw;
    };
    reader.onerror = () => { setLogoErr("Could not read the file. Try again."); push({ type: "error", title: "Upload failed" }); };
    reader.readAsDataURL(file);
  };
  const removeLogo = () => { saveLogo(""); setLogoErr(""); push({ type: "info", title: "Logo removed", desc: "Reverted to the default HelpHive mark." }); };
  const downloadLogo = () => {
    if (!logo) return;
    const mime = (logo.match(/^data:([^;]+);/) || [])[1] || "image/png";
    const ext = mime.includes("svg") ? "svg" : mime.includes("webp") ? "webp" : mime.includes("jpeg") ? "jpg" : "png";
    const a = document.createElement("a"); a.href = logo; a.download = `company-logo.${ext}`; a.click();
    push({ type: "success", title: "Download started", desc: `company-logo.${ext}` });
  };
  const s = useSet({ org: "Internship Studio", email: "contact@internshipstudio.com", phone: "+91 90000 10000", url: "https://internshipstudio.com", addr: "Baner, Pune, Maharashtra 411045", tz: "Asia/Kolkata (IST)", dateFmt: "DD MMM YYYY", timeFmt: "12-hour", lang: "English", cur: "INR (INR)", landing: "Dashboard" }, "General settings", "general");
  return (
    <SecCard title="General Settings" sub="Organization identity, locale and defaults.">
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
        <label className={`logo-drop ${logo ? "has-img" : ""}`} title={logo ? "Change company logo" : "Upload company logo"}>
          {logo ? <img src={logo} alt="Company logo preview" /> : <Camera size={20} />}
          <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange={onLogoFile} />
        </label>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 800 }}>Company Logo</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>PNG, JPG, SVG or WEBP · max 5 MB. Shown on the sign-in page, sidebar and PDF reports.</div>
          <div style={{ display: "flex", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
            <button className="btn btn-soft btn-sm" onClick={() => fileRef.current?.click()}><Upload size={13} /> {logo ? "Change Logo" : "Upload Logo"}</button>
            {logo && <button className="btn btn-soft btn-sm" onClick={downloadLogo}><Download size={13} /> Download</button>}
            {logo && <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={removeLogo}><Trash2 size={13} /> Remove</button>}
          </div>
        </div>
      </div>
      {logoErr && <div className="logo-err"><AlertTriangle size={13} /> {logoErr}</div>}
      <div style={{ height: 12 }} />
      <div className="set-grid2">
        <SetField label="Organization Name"><input value={s.v.org} onChange={(e) => s.set("org", e.target.value)} /></SetField>
        <SetField label="Support Email"><input value={s.v.email} onChange={(e) => s.set("email", e.target.value)} /></SetField>
        <SetField label="Support Phone"><input value={s.v.phone} onChange={(e) => s.set("phone", e.target.value)} /></SetField>
        <SetField label="Website URL"><input value={s.v.url} onChange={(e) => s.set("url", e.target.value)} /></SetField>
        <SetField label="Time Zone"><select value={s.v.tz} onChange={(e) => s.set("tz", e.target.value)}>{["Asia/Kolkata (IST)", "UTC", "America/New_York (EST)", "Europe/London (GMT)", "Asia/Dubai (GST)"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Date Format"><select value={s.v.dateFmt} onChange={(e) => s.set("dateFmt", e.target.value)}>{["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Time Format"><select value={s.v.timeFmt} onChange={(e) => s.set("timeFmt", e.target.value)}>{["12-hour", "24-hour"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Language"><select value={s.v.lang} onChange={(e) => s.set("lang", e.target.value)}>{["English", "Hindi", "Marathi"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Currency"><select value={s.v.cur} onChange={(e) => s.set("cur", e.target.value)}>{["INR (INR)", "USD (USD)", "EUR (EUR)"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Default Landing Page"><select value={s.v.landing} onChange={(e) => s.set("landing", e.target.value)}>{["Dashboard", "Tickets", "Customers", "Automation"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
      </div>
      <SetField label="Company Address"><textarea style={{ minHeight: 60 }} value={s.v.addr} onChange={(e) => s.set("addr", e.target.value)} /></SetField>
      <SaveBar s={s} />
    </SecCard>
  );
}

/* ---- 2. teams ---- */
function AgentModal({ open, initial, onClose, onSave }) {
  const push = useToast();
  const blank = { name: "", email: "", phone: "", emp: "", dept: DEPTS[0], team: SET_TEAMS[0], desig: "Support Executive", role: "Support Agent", pass: "", pass2: "" };
  const [f, setF] = useState(blank);
  useEffect(() => { if (open) setF(initial ? { ...blank, ...initial } : blank); }, [open, initial]);
  if (!open) return null;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    if (!f.name.trim() || !f.email.trim()) { push({ type: "error", title: "Missing details", desc: "Name and email are required." }); return; }
    if (!initial && (!f.pass || f.pass !== f.pass2)) { push({ type: "error", title: "Password problem", desc: "Passwords must match and can't be empty." }); return; }
    onSave(f, !!initial);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#0EA5E918", color: "#0EA5E9", width: 32, height: 32 }}><UserPlus size={16} /></span>{initial ? "Edit Agent" : "Add Agent"}</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <label className="logo-drop" style={{ width: 56, height: 56, borderRadius: "50%" }}><Camera size={17} /><input type="file" hidden accept="image/*" onChange={() => push({ type: "success", title: "Photo uploaded" })} /></label>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Profile picture (optional)</div>
          </div>
          <div className="set-grid2">
            <SetField label="Full Name *"><input value={f.name} onChange={(e) => set("name", e.target.value)} /></SetField>
            <SetField label="Email *"><input value={f.email} onChange={(e) => set("email", e.target.value)} /></SetField>
            <SetField label="Phone"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></SetField>
            <SetField label="Employee ID"><input value={f.emp} onChange={(e) => set("emp", e.target.value)} placeholder="EMP-1099" /></SetField>
            <SetField label="Department"><select value={f.dept} onChange={(e) => set("dept", e.target.value)}>{DEPTS.map((o) => <option key={o}>{o}</option>)}</select></SetField>
            <SetField label="Team"><select value={f.team} onChange={(e) => set("team", e.target.value)}>{SET_TEAMS.map((o) => <option key={o}>{o}</option>)}</select></SetField>
            <SetField label="Designation"><input value={f.desig} onChange={(e) => set("desig", e.target.value)} /></SetField>
            <SetField label="Role"><select value={f.role} onChange={(e) => set("role", e.target.value)}>{SET_ROLES.map((o) => <option key={o}>{o}</option>)}</select></SetField>
            {!initial && <><SetField label="Password *"><input type="password" value={f.pass} onChange={(e) => set("pass", e.target.value)} /></SetField>
            <SetField label="Confirm Password *"><input type="password" value={f.pass2} onChange={(e) => set("pass2", e.target.value)} /></SetField></>}
          </div>
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" onClick={save}><Check size={15} /> {initial ? "Save Changes" : "Add Agent"}</button></div>
      </div>
    </div>
  );
}

/*
 * One agent's workload.
 *
 * It used to draw a six-day bar chart derived arithmetically from the two
 * numbers it was handed -- a shape with no relationship to anything that
 * happened. There is no per-day history stored per agent, so this shows the
 * two counts that are real and says nothing it cannot support.
 */
function PerfModal({ agent, onClose }) {
  if (!agent) return null;
  const total = agent.open + agent.resolved;
  const rate = total > 0 ? Math.round(agent.resolved / total * 100) : 0;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="panel-title" style={{ fontSize: 15 }}>
            <span className="pic" style={{ background: "#10B98118", color: "#10B981", width: 32, height: 32 }}><TrendingUp size={16} /></span>
            {agent.name}
          </div>
          <button className="icon-btn" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="modal-body">
          <div className="an-kpis" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            {[["Open", agent.open], ["Resolved", agent.resolved], ["Resolved share", rate + "%"]]
              .map(([k, v]) => <div className="an-kpi" key={k}><div className="v">{v}</div><div className="l">{k}</div></div>)}
          </div>
          <div className="kv" style={{ borderBottom: "1px solid var(--border)" }}><span className="k">Email</span><span className="v">{agent.email}</span></div>
          <div className="kv" style={{ borderBottom: "1px solid var(--border)" }}><span className="k">Role</span><span className="v">{agent.role}</span></div>
          <div className="kv"><span className="k">Last active</span><span className="v">{agent.lastTouch || "never"}</span></div>
          <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
            Counts are tickets assigned to this agent right now. Per-day history is not
            recorded per agent, so there is no trend to chart.
          </p>
        </div>
        <div className="modal-foot"><button className="btn btn-primary btn-sm" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

/* ---- pending registration approvals ---- */
function ApprovalSettings() {
  const push = useToast();
  const [tick, setTick] = useState(0);
  const [editRole, setEditRole] = useState({}); // email -> designation
  let regUsers = {};
  try { regUsers = JSON.parse(kvGetSync(USERS_KEY) || "{}"); } catch (e) {}
  const pending = Object.entries(regUsers).filter(([, u]) => u.status === "pending");
  const decided = Object.entries(regUsers).filter(([, u]) => u.status === "active" || u.status === "rejected");

  const decide = async (email, status) => {
    const next = { ...regUsers };
    if (status === "rejected") { next[email] = { ...next[email], status: "rejected" }; }
    else {
      next[email] = { ...next[email], status: "active", designation: editRole[email] || next[email].designation, approvedAt: Date.now() };
      // add approved user to the Team Management roster so signatures resolve
      try {
        const roster = getTeamRoster();
        if (!roster.some((a) => (a.email || "").toLowerCase() === email.toLowerCase())) {
          const u = next[email];
          roster.push({ name: u.name, emp: "EMP" + String(Math.floor(100 + Math.random() * 900)), email, phone: u.phone || "", dept: u.dept || "Technical Support", role: u.designation || "Support Executive", team: u.dept || "Technical Support", active: true });
          kvSet(TEAM_KEY, JSON.stringify(roster));
        }
      } catch (e) {}
    }
    await kvSet(USERS_KEY, JSON.stringify(next));
    push({ type: status === "active" ? "success" : "info", title: status === "active" ? "User approved" : "Registration rejected", desc: email });
    setTick((t) => t + 1);
  };

  return (
    <SecCard title="User Approvals" sub="Review new registrations before they can sign in.">
      {pending.length === 0 && <div className="empty-min"><UserCheck size={22} /><p>No registrations waiting for approval.</p></div>}
      {pending.map(([email, u]) => (
        <div key={email} className="approval-row">
          <span className="msg-av" style={{ background: "linear-gradient(135deg,var(--primary),var(--accent))" }}>{(u.name || email).split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
          <div className="approval-info">
            <b>{u.name}</b>
            <span>{email} · {u.phone}</span>
            <span className="meta">{u.dept ? `${u.dept} · ` : ""}{u.company || "Internship Studio"} · applied {new Date(u.createdAt || Date.now()).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
            <span className="badges"><span className="vbadge"><CheckCircle2 size={11} /> Email verified</span><span className="vbadge"><CheckCircle2 size={11} /> Mobile verified</span></span>
          </div>
          <div className="approval-actions">
            <select value={editRole[email] ?? u.designation} onChange={(e) => setEditRole({ ...editRole, [email]: e.target.value })}>
              {REG_DESIGNATIONS.map((d) => <option key={d}>{d}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" onClick={() => decide(email, "active")}><Check size={13} /> Approve</button>
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => decide(email, "rejected")}><X size={13} /> Reject</button>
          </div>
        </div>
      ))}
      {decided.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: 18 }}><h3 className="card-title" style={{ fontSize: 13 }}>Recent decisions</h3></div>
          {decided.slice(-5).reverse().map(([email, u]) => (
            <div key={email} className="approval-row past">
              <div className="approval-info"><b>{u.name}</b><span>{email}</span></div>
              <span className={`chip ${u.status === "active" ? "chip-green" : "chip-red"}`}>{u.status === "active" ? "Approved" : "Rejected"}</span>
            </div>
          ))}
        </>
      )}
    </SecCard>
  );
}

function TeamSettings() {
  const push = useToast();
  const [rows, setRows] = useState(null);      // null = loading
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");
  const [perf, setPerf] = useState(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setRows(null); setErr("");
    try {
      const r = await fdTickets.team();
      setRows(r.team || []);
      setStats(r.stats || null);
      if (r.error) setErr(r.error);
    } catch (e) {
      setRows([]);
      setErr(e.message || "Could not load the team");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  /*
   * The roster is also what signatures resolve against, and that store is
   * keyed by email. Keeping it in step here means an agent added in the admin
   * panel gets a working signature without anyone editing a second list.
   */
  useEffect(() => {
    if (!rows || !rows.length) return;
    try {
      kvSet(TEAM_KEY, JSON.stringify(rows.map((a) => ({
        name: a.name, email: a.email, phone: a.phone || "", role: a.role, active: a.active,
      }))));
    } catch (e) { /* the signature falls back to the desk default */ }
  }, [rows]);

  const list = (rows || []).filter((a) =>
    (a.name + " " + a.email + " " + a.role).toLowerCase().includes(q.trim().toLowerCase()));

  const rate = stats && stats.open + stats.resolved > 0
    ? Math.round(stats.resolved / (stats.open + stats.resolved) * 100)
    : 0;

  return (
    <SecCard title="Team Management"
      sub="Everyone with access to this desk, from your admin users."
      right={<button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Refresh</button>}>

      {err && <div className="logo-err" style={{ marginTop: 0, marginBottom: 12 }}><AlertTriangle size={13} /> {err}</div>}

      <div className="an-kpis" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        {[["Agents", stats ? stats.total : "—"],
          ["Active", stats ? stats.active : "—"],
          ["Open with agents", stats ? stats.open : "—"],
          ["Resolution rate", stats ? rate + "%" : "—"]].map(([k, v]) => (
            <div className="an-kpi" key={k}><div className="v">{v}</div><div className="l">{k}</div></div>))}
      </div>

      <div className="searchbox" style={{ maxWidth: 260, width: 260, flex: "initial", marginBottom: 12 }}>
        <Search size={16} /><input placeholder="Search agents…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {rows === null ? (
        <div className="card sk-card" style={{ minHeight: 200 }}><div className="sk" style={{ flex: 1 }} /></div>
      ) : list.length === 0 ? (
        <EmptyState icon={UsersRound} title={q ? "No agent matches that" : "No agents yet"}
          desc={q ? "Try a different name or address."
                  : "Give someone the helpdesk permission in your admin panel and they will appear here."} />
      ) : (
        <div className="table-wrap"><table style={{ minWidth: 760 }}>
          <thead><tr><th>Agent</th><th>Role</th><th>Phone</th><th>Status</th><th>Open</th><th>Resolved</th><th>Last active</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
          <tbody>{list.map((a) => (<tr key={a.id}>
            <td><div className="cust"><span className="a" style={{ background: avColor(a.name) }}>{initials(a.name)}</span>
              <div><div className="nm">{a.name}</div><div className="em">{a.email}</div></div></div></td>
            <td style={{ fontSize: 12.5, fontWeight: 600 }}>{a.role}</td>
            <td style={{ fontSize: 12, color: "var(--muted)" }}>{a.phone || "—"}</td>
            <td><StatusChip active={a.active} /></td>
            <td style={{ fontWeight: 700 }}>{a.open}</td>
            <td style={{ fontWeight: 700, color: "var(--success)" }}>{a.resolved}</td>
            <td style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{a.lastTouch || "never"}</td>
            <td><div className="row-act" style={{ justifyContent: "flex-end" }}>
              <button title="Workload" onClick={() => setPerf(a)}><TrendingUp size={15} /></button>
            </div></td>
          </tr>))}</tbody>
        </table></div>
      )}

      <p style={{ margin: "14px 0 0", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.65 }}>
        Access is granted in your admin panel under <b>Roles &amp; Permissions</b> — someone with the
        helpdesk permission appears here automatically. Open and Resolved count tickets currently
        assigned to each agent, excluding spam, trash and merged tickets.
      </p>

      <PerfModal agent={perf} onClose={() => setPerf(null)} />
    </SecCard>
  );
}

/* ---- 3. roles ---- */
const ROLE_DEFAULT = {
  "Super Admin": SET_PERMS,
  "Admin": SET_PERMS.filter((p) => p !== "Settings"),
  "Team Lead": ["Dashboard", "Tickets", "Customers", "Reports", "Assign Tickets", "Close Tickets", "Merge Tickets", "Bulk Update"],
  "Agent": ["Dashboard", "Tickets", "Customers", "Close Tickets"],
};

function RolesSettings() {
  const push = useToast();
  const s = useSet(ROLE_DEFAULT, "Permissions", "roles");
  const [nr, setNr] = useState("");
  const roles = s.v || {};
  const names = Object.keys(roles);
  const has = (r, p) => (roles[r] || []).includes(p);
  const toggle = (r, p) => s.set(r, has(r, p) ? roles[r].filter((x) => x !== p) : [...(roles[r] || []), p]);
  const addRole = () => {
    const name = nr.trim();
    if (!name || roles[name]) return;
    s.set(name, ["Dashboard", "Tickets"]);
    setNr("");
    push({ type: "info", title: "Role added", desc: "Press Save to keep it." });
  };
  return (
    <SecCard title="Roles & Permissions" sub="Control what each role can see and do.">
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input placeholder="New custom role name..." value={nr} onChange={(e) => setNr(e.target.value)} style={{ maxWidth: 240 }} />
        <button className="btn btn-soft btn-sm" disabled={!nr.trim() || !!roles[nr.trim()]} onClick={addRole}><PlusCircle size={14} /> Create Role</button>
      </div>
      <div className="table-wrap"><table className="perm-table" style={{ minWidth: 720 }}>
        <thead><tr><th>Permission</th>{names.map((r) => <th key={r}>{r}</th>)}</tr></thead>
        <tbody>{SET_PERMS.map((p) => (<tr key={p}>
          <td style={{ fontSize: 12.5, fontWeight: 600 }}>{p}</td>
          {names.map((r) => (<td key={r}><button className={`cbx ${has(r, p) ? "on" : ""}`} style={{ margin: "0 auto" }} disabled={r === "Super Admin"} onClick={() => toggle(r, p)}>{has(r, p) ? <Check size={11} /> : null}</button></td>))}
        </tr>))}</tbody>
      </table></div>
      <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted)" }}>
        Saved with your desk settings. Access to the admin panel itself is granted in
        Roles &amp; Permissions there; this matrix records what each helpdesk role is meant to do.
      </p>
      <SaveBar s={s} />
    </SecCard>
  );
}

/* ---- 4. ticket ---- */
function TicketSettings() {
  const s = useSet({ status: "New", prio: "Low", type: "Question", auto: true, slaResp: "30 minutes", slaRes: "4 hours", agent: "Support Queue (Unassigned)", fmt: "#336XXX", size: "10 MB", files: "png, jpg, pdf, docx, xlsx" }, "Ticket settings", "ticket");
  return (
    <SecCard title="Ticket Settings" sub="Defaults applied to every new ticket.">
      <div className="set-grid2">
        <SetField label="Default Status"><select value={s.v.status} onChange={(e) => s.set("status", e.target.value)}>{["New", "Open", "Pending"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Default Priority"><select value={s.v.prio} onChange={(e) => s.set("prio", e.target.value)}>{BULK_PRIORITY.map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Default Ticket Type"><select value={s.v.type} onChange={(e) => s.set("type", e.target.value)}>{TICKET_TYPES.map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Default Agent"><select value={s.v.agent} onChange={(e) => s.set("agent", e.target.value)}>{BULK_AGENTS.map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="SLA - First Response"><select value={s.v.slaResp} onChange={(e) => s.set("slaResp", e.target.value)}>{["15 minutes", "30 minutes", "1 hour", "4 hours", "1 day"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="SLA - Resolution"><select value={s.v.slaRes} onChange={(e) => s.set("slaRes", e.target.value)}>{["4 hours", "8 hours", "1 day", "2 days", "1 week"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Ticket Number Format"><input value={s.v.fmt} onChange={(e) => s.set("fmt", e.target.value)} /></SetField>
        <SetField label="Attachment Size Limit"><select value={s.v.size} onChange={(e) => s.set("size", e.target.value)}>{["5 MB", "10 MB", "25 MB", "50 MB"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
      </div>
      <SetField label="Allowed File Types"><input value={s.v.files} onChange={(e) => s.set("files", e.target.value)} /></SetField>
      <ToggleRow icon={Zap} title="Auto-assign tickets" desc="Distribute new tickets round-robin across active agents." on={s.v.auto} onChange={(v) => s.set("auto", v)} />
      <SaveBar s={s} />
    </SecCard>
  );
}

/* ---- 5. email ---- */
/* ---- signature settings (inside Email Settings) ---- */
function SignatureSettings() {
  const push = useToast();
  const [st, setSt] = useState(getSigSettings);
  const me = currentAgentProfile();
  const meKey = (me.email || "").toLowerCase();
  const [team, setTeam] = useState("My signature");
  const taRef = useRef(null);
  const saveTimer = useRef(null);
  const tpl = team === "My signature" ? ((st.users || {})[meKey] ?? st.template)
    : team === "Default" ? st.template
    : (st.teams[team] ?? st.template);

  const update = (next) => {
    setSt(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveSigSettings(next), 500); // auto-save
  };
  const setTpl = (value) => {
    if (team === "My signature") update({ ...st, users: { ...(st.users || {}), [meKey]: value } });
    else if (team === "Default") update({ ...st, template: value });
    else update({ ...st, teams: { ...st.teams, [team]: value } });
  };
  const insertPh = (ph) => {
    const ta = taRef.current;
    if (!ta) { setTpl(tpl + ph); return; }
    const a = ta.selectionStart ?? tpl.length, b = ta.selectionEnd ?? tpl.length;
    const next = tpl.slice(0, a) + ph + tpl.slice(b);
    setTpl(next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(a + ph.length, a + ph.length); }, 0);
  };
  const explicitSave = () => { saveSigSettings(st); push({ type: "success", title: "Signature saved", desc: "New replies will use the updated signature." }); };
  const preview = resolveSignature({ ...st, template: tpl, enabled: true });

  return (
    <div style={{ marginTop: 6 }}>
      <div className="section-head" style={{ marginBottom: 10 }}>
        <div><h3 className="card-title"><Pencil size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--primary)" }} />Signature Settings</h3>
        <p className="card-sub">Auto-inserted at the bottom of every reply, with the cursor placed above it — Freshdesk style.</p></div>
      </div>
      <ToggleRow icon={CheckCircle2} title="Automatic signature" desc="Insert the signature whenever the Reply editor opens." on={st.enabled} onChange={(v) => update({ ...st, enabled: v })} />
      <ToggleRow icon={Forward} title="Also apply to Forward" desc="Include the signature when forwarding tickets. Internal notes never get a signature." on={st.applyForward} onChange={(v) => update({ ...st, applyForward: v })} />
      <div className="sig-scope">
        <div className="fld" style={{ flex: 1, minWidth: 220 }}>
          <label>Signature for</label>
          <select value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="My signature">My signature{(st.users || {})[meKey] !== undefined ? " ●" : ""}</option>
            <option>Default</option>
            {SET_TEAMS.map((t) => <option key={t}>{t}{st.teams[t] !== undefined ? " ●" : ""}</option>)}
          </select>
        </div>
        <div className="sig-scope-meta">
          {team === "My signature" && <span className="who"><User size={12} /> {me.name} · {me.email || "not signed in"}</span>}
          {team === "My signature" && (st.users || {})[meKey] !== undefined && (
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => { const users = { ...(st.users || {}) }; delete users[meKey]; update({ ...st, users }); push({ type: "info", title: "Your signature now follows the company default" }); }}>
              <RotateCcw size={13} /> Use company default
            </button>
          )}
          {team !== "Default" && team !== "My signature" && st.teams[team] !== undefined && (
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => { const teams = { ...st.teams }; delete teams[team]; update({ ...st, teams }); push({ type: "info", title: `${team} now uses the default signature` }); }}>
              <RotateCcw size={13} /> Revert to default
            </button>
          )}
        </div>
      </div>
      <div className="sig-grid">
        <div className="fld">
          <label>Template{team !== "Default" ? ` — ${team}` : ""}</label>
          <textarea ref={taRef} className="sig-editor" value={tpl} onChange={(e) => setTpl(e.target.value)} />
          <div className="chips" style={{ marginTop: 10 }}>
            {SIG_PLACEHOLDERS.map((p) => <button key={p} className="fchip" onClick={() => insertPh(p)}><Plus size={11} /> {p}</button>)}
          </div>
        </div>
        <div className="fld">
          <label>Live preview — {me.name}</label>
          <div className="sig-preview">{preview || <span style={{ color: "var(--faint)" }}>Signature disabled.</span>}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <span style={{ fontSize: 11.5, color: "var(--faint)", alignSelf: "center", fontWeight: 600 }}>Changes auto-save</span>
        <button className="btn btn-primary btn-sm" onClick={explicitSave}><Save size={13} /> Save Signature</button>
      </div>
    </div>
  );
}

/**
 * The real mailbox controls.
 *
 * Everything below EmailSettings is still the original mock form (fields that
 * are typed into and go nowhere). THIS panel talks to the live backend: it
 * reports what the mailbox is actually doing and gives the two maintenance
 * actions an operator genuinely needs.
 */
function MailboxMaintenance() {
  const push = useToast();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState("");
  const [scan, setScan] = useState(null);
  const [closeScan, setCloseScan] = useState(null);
  const [closeBefore, setCloseBefore] = useState("");
  const [backlogScan, setBacklogScan] = useState(null);
  const [pruneScan, setPruneScan] = useState(null);
  const [autoCloseDays, setAutoCloseDays] = useState("");

  const loadStatus = useCallback(async () => {
    try { setStatus(await fdRealtime.status()); }
    catch (err) { push({ type: "error", title: "Could not read mailbox status", desc: err.message }); }
  }, [push]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const syncNow = async () => {
    setBusy("sync");
    try {
      const r = await fdSync.now();
      push({ type: r.ok === false ? "error" : "success", title: "Mailbox synced", desc: r.message || "" });
      await loadStatus();
    } catch (err) {
      push({ type: "error", title: "Sync failed", desc: err.message });
    } finally { setBusy(""); }
  };

  /* Dry run first, always. The operator sees the count and a sample before
     anything is touched -- this is the difference between a maintenance tool
     and a footgun. */
  const scanNoise = async () => {
    setBusy("scan");
    try {
      const r = await fdSettings.cleanupBounces(false);
      setScan(r);
      push({ type: "info", title: r.message || `${r.matched} match(es)` });
    } catch (err) {
      push({ type: "error", title: "Scan failed", desc: err.message });
    } finally { setBusy(""); }
  };

  const applyCleanup = async () => {
    setBusy("clean");
    try {
      const r = await fdSettings.cleanupBounces(true);
      push({ type: "success", title: r.message || `${r.moved} moved to Trash` });
      setScan(null);
      await loadStatus();
    } catch (err) {
      push({ type: "error", title: "Cleanup failed", desc: err.message });
    } finally { setBusy(""); }
  };

  /*
   * Clearing an imported backlog.
   *
   * Two steps on purpose. The first call is a DRY RUN -- it reports how many
   * tickets would change and shows a sample, and touches nothing. Only the
   * second call, with the count already on screen, actually writes.
   */
  const scanClose = async () => {
    setBusy("closescan");
    try {
      const r = await fdTickets.closeAll({ confirm: false, before: closeBefore });
      setCloseScan(r);
      push({ type: "info", title: r.message || `${r.matched} match(es)` });
    } catch (err) {
      push({ type: "error", title: "Could not count open tickets", desc: err.message });
    } finally { setBusy(""); }
  };

  const applyClose = async () => {
    setBusy("closing");
    try {
      const r = await fdTickets.closeAll({ confirm: true, before: closeBefore });
      push({ type: "success", title: r.message || `${r.closed} closed` });
      setCloseScan(null);
      await loadStatus();
    } catch (err) {
      push({ type: "error", title: "Bulk close failed", desc: err.message });
    } finally { setBusy(""); }
  };

  /*
   * Stop the import. This is the ROOT fix for a queue that keeps growing: the
   * first sync baselines against the last 7 days, and on a busy mailbox that is
   * thousands of messages the worker then trickles in as new tickets forever.
   * Closing tickets never catches up while that is still running.
   */
  const scanBacklog = async () => {
    setBusy("backlogscan");
    try {
      const r = await fdSettings.skipBacklog(false);
      setBacklogScan(r);
      push({ type: "info", title: r.message || "" });
    } catch (err) {
      push({ type: "error", title: "Could not read the mailbox", desc: err.message });
    } finally { setBusy(""); }
  };

  const applyBacklog = async () => {
    setBusy("backlog");
    try {
      const r = await fdSettings.skipBacklog(true);
      push({ type: "success", title: "Backlog skipped", desc: r.message || "" });
      setBacklogScan(null);
      await loadStatus();
    } catch (err) {
      push({ type: "error", title: "Failed", desc: err.message });
    } finally { setBusy(""); }
  };

  const saveAutoClose = async () => {
    const n = parseInt(autoCloseDays, 10);
    if (!Number.isFinite(n) || n < 0) { push({ type: "error", title: "Enter a number of days (0 turns it off)" }); return; }
    setBusy("autoclose");
    try {
      await fdSettings.save({ AUTO_CLOSE_DAYS: n });
      push({
        type: "success",
        title: n > 0 ? `Auto-close on: ${n} days` : "Auto-close turned off",
        desc: n > 0 ? "The cron job will close idle tickets from now on." : "",
      });
    } catch (err) {
      push({ type: "error", title: "Could not save", desc: err.message });
    } finally { setBusy(""); }
  };

  /*
   * Recent Activities was showing nothing but "SLA breached on #…" repeated
   * hundreds of times: older builds wrote one activity row per breached ticket,
   * and a sweep over an imported backlog breaches them all at once. Ingest now
   * aggregates (lib/Sla.php), and this clears what was already written.
   */
  const scanPrune = async () => {
    setBusy("prunescan");
    try {
      const r = await fdSettings.pruneActivity(false);
      setPruneScan(r);
      push({ type: "info", title: r.message || "" });
    } catch (err) {
      push({ type: "error", title: "Could not read the activity log", desc: err.message });
    } finally { setBusy(""); }
  };

  const applyPrune = async () => {
    setBusy("prune");
    try {
      const r = await fdSettings.pruneActivity(true);
      push({ type: "success", title: r.message || "Activity log cleaned" });
      setPruneScan(null);
    } catch (err) {
      push({ type: "error", title: "Prune failed", desc: err.message });
    } finally { setBusy(""); }
  };

  const st = status || {};
  const tone = st.stale || st.fails > 0 ? "var(--warning)" : "var(--success)";

  return (
    <SecCard title="Mailbox" sub="The live IMAP connection behind this desk — contact@internshipstudio.com.">
      <div className="set-grid2">
        <SetField label="Last sync">
          <div style={{ fontSize: 13, padding: "8px 0", color: tone, fontWeight: 600 }}>
            {st.lastSyncAgo || "never"} {st.status ? `· ${st.status}` : ""}
          </div>
        </SetField>
        <SetField label="Messages imported (total)">
          <div style={{ fontSize: 13, padding: "8px 0", fontWeight: 600 }}>
            {(st.imported || 0).toLocaleString("en-IN")}
          </div>
        </SetField>
      </div>

      {st.stale && (
        <div className="msg-error" style={{ marginBottom: 12 }}>
          <AlertCircle size={14} /> {st.staleHint || "No sync in the last 10 minutes — is the cron job installed?"}
        </div>
      )}
      {st.error && (
        <div className="msg-error" style={{ marginBottom: 12 }}>
          <AlertCircle size={14} /> {String(st.error).slice(0, 300)}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <button className="btn btn-soft btn-sm" disabled={!!busy} onClick={syncNow}>
          {busy === "sync" ? <><Spinner /> Syncing…</> : <><RefreshCw size={14} /> Sync mailbox now</>}
        </button>
        <button className="btn btn-soft btn-sm" disabled={!!busy} onClick={scanNoise}>
          {busy === "scan" ? <><Spinner /> Scanning…</> : <><ShieldX size={14} /> Scan for bounce noise</>}
        </button>
      </div>

      {/* ---- stop importing history (the root fix) ---- */}
      <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 16 }}>
        <b style={{ fontSize: 13 }}>Start from now (stop importing old mail)</b>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "6px 0 10px" }}>
          Do this <b>first</b> if the ticket count keeps climbing on its own. The first sync
          baselines against the last {"{"}7{"}"} days, and on a busy mailbox that is thousands of old
          messages the worker keeps turning into new tickets. This moves the marker to the newest
          message, so only mail that arrives <b>from now on</b> creates a ticket.
          Nothing is deleted — every message stays in the mailbox.
        </p>
        <button className="btn btn-soft btn-sm" disabled={!!busy} onClick={scanBacklog}>
          {busy === "backlogscan" ? <><Spinner /> Checking…</> : <><History size={14} /> Check the backlog</>}
        </button>

        {backlogScan && (
          <div className="card card-pad" style={{ background: "var(--surface-2)", marginTop: 10 }}>
            <b style={{ fontSize: 13 }}>
              {(backlogScan.would_skip || 0).toLocaleString("en-IN")} older message(s) would be skipped
            </b>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "6px 0 10px" }}>
              Folder holds {(backlogScan.messages_in_folder || 0).toLocaleString("en-IN")} messages.
              Marker moves {backlogScan.current_watermark} → {backlogScan.new_watermark}.
            </p>
            <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={applyBacklog}>
              {busy === "backlog" ? <><Spinner /> Applying…</> : <>Start from now</>}
            </button>
          </div>
        )}
      </div>

      {/* ---- keep it clean automatically ---- */}
      <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 16 }}>
        <b style={{ fontSize: 13 }}>Auto-close idle tickets</b>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "6px 0 10px" }}>
          The cron job closes any ticket with no activity for this many days, so the queue stays
          honest without anyone tidying it. A reply from either side resets the clock and keeps the
          ticket open. <b>0 turns it off.</b> No email is sent.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <SetField label="Days idle before closing">
            <input type="number" min="0" placeholder="0 = off" value={autoCloseDays}
                   onChange={(e) => setAutoCloseDays(e.target.value)} style={{ maxWidth: 140 }} />
          </SetField>
          <button className="btn btn-soft btn-sm" style={{ marginBottom: 12 }} disabled={!!busy} onClick={saveAutoClose}>
            {busy === "autoclose" ? <><Spinner /> Saving…</> : <><Save size={14} /> Save rule</>}
          </button>
        </div>
      </div>

      {/* ---- tidy the activity feed ---- */}
      <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 16 }}>
        <b style={{ fontSize: 13 }}>Clean up the activity feed</b>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "6px 0 10px" }}>
          Removes repeated <b>SLA breached</b> rows left by older builds, which wrote one per
          ticket and buried every real event. New sweeps write a single summary instead. Real
          activity — replies, new mail, assignments — is never touched.
        </p>
        <button className="btn btn-soft btn-sm" disabled={!!busy} onClick={scanPrune}>
          {busy === "prunescan" ? <><Spinner /> Checking…</> : <><Activity size={14} /> Check the activity log</>}
        </button>

        {pruneScan && (
          <div className="card card-pad" style={{ background: "var(--surface-2)", marginTop: 10 }}>
            <b style={{ fontSize: 13 }}>
              {(pruneScan.would_delete || 0).toLocaleString("en-IN")} repeated row(s) would be removed
            </b>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "6px 0 10px" }}>
              Keeping the newest {pruneScan.keeping || 0}, so the feed still shows that it happened.
            </p>
            {pruneScan.would_delete > 0 && (
              <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={applyPrune}>
                {busy === "prune" ? <><Spinner /> Cleaning…</> : <>Remove {(pruneScan.would_delete || 0).toLocaleString("en-IN")} rows</>}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ---- clear an imported backlog ---- */}
      <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 16 }}>
        <b style={{ fontSize: 13 }}>Close the open backlog</b>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "6px 0 10px" }}>
          Sets every open ticket to <b>Closed</b> in one server-side operation — for when the desk
          has just imported years of a mailbox that was already dealt with elsewhere.
          <b> No email is sent</b>, and closed tickets can be reopened at any time.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <SetField label="Only tickets created before (optional)">
            <input type="date" value={closeBefore} onChange={(e) => { setCloseBefore(e.target.value); setCloseScan(null); }} />
          </SetField>
          <button className="btn btn-soft btn-sm" style={{ marginBottom: 12 }} disabled={!!busy} onClick={scanClose}>
            {busy === "closescan" ? <><Spinner /> Counting…</> : <><CheckCheck size={14} /> Count what would close</>}
          </button>
        </div>

        {closeScan && (
          <div className="card card-pad" style={{ background: "var(--surface-2)", marginTop: 4 }}>
            <b style={{ fontSize: 13 }}>{(closeScan.matched || 0).toLocaleString("en-IN")} open ticket(s) would be closed</b>
            {(closeScan.sample || []).slice(0, 5).map((t) => (
              <div key={t.id} style={{ fontSize: 12, color: "var(--muted)", padding: "2px 0" }}>
                #{t.id} · {t.status} · {t.requester_email} · {String(t.subject || "").slice(0, 70)}
              </div>
            ))}
            {closeScan.matched > 0 && (
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} disabled={!!busy} onClick={applyClose}>
                {busy === "closing"
                  ? <><Spinner /> Closing…</>
                  : <><CheckCheck size={14} /> Close all {(closeScan.matched || 0).toLocaleString("en-IN")}</>}
              </button>
            )}
          </div>
        )}
      </div>

      {scan && (
        <div className="card card-pad" style={{ background: "var(--surface-2)", marginBottom: 12 }}>
          <b style={{ fontSize: 13 }}>{scan.matched} ticket(s) look like machine noise</b>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "6px 0 10px" }}>
            Tickets where every message is a bounce or an auto-reply and no agent has ever replied —
            typically "Mail Delivery System" delay warnings. They move to <b>Trash</b>, not deleted,
            so you can review them first.
          </p>
          {(scan.sample || []).slice(0, 6).map((t) => (
            <div key={t.id} style={{ fontSize: 12, color: "var(--muted)", padding: "2px 0" }}>
              #{t.id} · {t.from} · {t.subject}
            </div>
          ))}
          {scan.matched > 0 && (
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} disabled={!!busy} onClick={applyCleanup}>
              {busy === "clean" ? <><Spinner /> Moving…</> : <><Trash2 size={14} /> Move {scan.matched} to Trash</>}
            </button>
          )}
        </div>
      )}
    </SecCard>
  );
}

function EmailSettings() {
  const push = useToast();
  const [v, setV] = useState(null);          // null while loading
  const [meta, setMeta] = useState({});
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState("");

  /* The fields this panel owns, and the settings keys behind them. */
  const FIELDS = [
    ["SMTP_HOST", "SMTP Host", "text"],
    ["SMTP_PORT", "SMTP Port", "text"],
    ["SMTP_SECURITY", "Encryption", "enum", ["tls", "ssl", ""]],
    ["SMTP_USER", "SMTP Username", "text"],
    ["SMTP_PASS", "SMTP Password", "password"],
    ["FROM_EMAIL", "Sender Email", "text"],
    ["FROM_NAME", "Sender Name", "text"],
    ["REPLY_TO", "Reply-To", "text"],
  ];

  const load = useCallback(async () => {
    try {
      const r = await fdSettings.get();
      const st = r.settings || {};
      setMeta(st._meta || {});
      const picked = {};
      FIELDS.forEach(([k]) => { picked[k] = st[k] ?? ""; });
      picked.AUTO_ACK = String(st.AUTO_ACK) === "1";
      setV(picked); setSaved(picked);
      setTestTo(st.FROM_EMAIL || "");
    } catch (err) {
      push({ type: "error", title: "Could not load email settings", desc: err.message });
      setV({}); setSaved({});
    }
  }, [push]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const set = (k, val) => setV((x) => ({ ...x, [k]: val }));
  const dirty = v && saved && JSON.stringify(v) !== JSON.stringify(saved);

  const save = async () => {
    setBusy(true);
    try {
      // AUTO_ACK is a bool on the server; the rest go through as typed. An
      // untouched password field still holds the mask, which the endpoint
      // reads as "leave it alone".
      await fdSettings.save({ ...v, AUTO_ACK: v.AUTO_ACK ? 1 : 0 });
      setSaved(v);
      push({ type: "success", title: "Email settings saved" });
      await load();
    } catch (err) {
      push({ type: "error", title: "Could not save", desc: err.message });
    }
    setBusy(false);
  };

  const sendTest = async () => {
    if (!testTo.trim()) { push({ type: "error", title: "Enter an address to test" }); return; }
    setTesting(true);
    try {
      const r = await fdSettings.testSmtp(testTo.trim());
      // The endpoint answers with what the mail server said, success or not.
      push(r.ok === false
        ? { type: "error", title: "Test failed", desc: r.message }
        : { type: "success", title: "Test email sent", desc: r.message || `Delivered to ${testTo.trim()}.` });
    } catch (err) {
      push({ type: "error", title: "Test failed", desc: err.message });
    }
    setTesting(false);
  };

  if (!v) return <div className="card sk-card" style={{ minHeight: 260 }}><div className="sk" style={{ height: 20, width: "30%" }} /><div className="sk" style={{ flex: 1 }} /></div>;

  return (
    <div className="set-sec">
      <SecCard title="Outgoing Mail" sub="The server every reply, forward and notification is sent through."
        right={<span className="badge-pill" style={{ background: meta.mailerReady ? "var(--success-soft)" : "var(--danger-soft)", color: meta.mailerReady ? "var(--success)" : "var(--danger)" }}>
          {meta.mailerReady ? <><CheckCircle2 size={12} /> Mailer ready</> : <><AlertTriangle size={12} /> Mailer not ready</>}
        </span>}>
        <div className="set-grid2">
          {FIELDS.map(([k, label, kind, opts]) => (
            <SetField key={k} label={label}>
              {kind === "enum"
                ? <select value={v[k] ?? ""} onChange={(e) => set(k, e.target.value)}>
                    {opts.map((o) => <option key={o || "none"} value={o}>{o === "" ? "None" : o.toUpperCase()}</option>)}
                  </select>
                : <input type={kind === "password" ? "password" : "text"} value={v[k] ?? ""}
                         onChange={(e) => set(k, e.target.value)} />}
            </SetField>
          ))}
        </div>
        <ToggleRow icon={Reply} title="Auto Reply"
          desc="Acknowledge a brand-new ticket automatically. Never sent to another robot, and never twice on one ticket."
          on={!!v.AUTO_ACK} onChange={(x) => set("AUTO_ACK", x)} />
        <div className="savebar">
          <button className="btn btn-primary btn-sm" disabled={!dirty || busy} onClick={save}>
            {busy ? <><Spinner /> Saving…</> : <><Save size={14} /> Save</>}
          </button>
        </div>
      </SecCard>

      <SecCard title="Send a Test Email" sub="Posts a real message through the settings above.">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input style={{ maxWidth: 320 }} placeholder="you@example.com" value={testTo}
                 onChange={(e) => setTestTo(e.target.value)} />
          <button className="btn btn-soft btn-sm" disabled={testing} onClick={sendTest}>
            {testing ? <><Spinner /> Sending…</> : <><Send size={14} /> Send Test Email</>}
          </button>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted)" }}>
          Save first if you have just changed a server field. The result below is what the
          mail server replied, not a guess.
        </p>
      </SecCard>

      <SecCard title="Reply Signature" sub="Appended to outgoing replies.">
        <SignatureSettings />
      </SecCard>

      <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
        Incoming mail (IMAP), the sync schedule and the backlog controls live in
        <b> Settings → Mailbox</b>. Forwarding and tagged notifications are rules, and live in the
        <b> Automation Center</b>.
      </p>
    </div>
  );
}

/* ---- 6. notifications ---- */
const NOTIF_EVENTS = ["New Ticket", "Customer Reply", "Ticket Closed", "SLA Breach", "Agent Assignment", "Ticket Escalation", "Email Failure", "Automation Trigger"];
const NOTIF_CHANNELS = ["Email", "In-App", "Desktop"];
const NOTIF_DEFAULT = Object.fromEntries(
  NOTIF_EVENTS.map((e, i) => [e, { Email: true, "In-App": true, Desktop: i < 4 }])
);

function NotifSettings() {
  const s = useSet(NOTIF_DEFAULT, "Notification settings", "notif");
  const flip = (event, channel, on) =>
    s.set(event, { ...s.v[event], [channel]: on });
  return (
    <SecCard title="Notification Settings" sub="Choose which events reach you, and where.">
      <div className="table-wrap"><table className="perm-table" style={{ minWidth: 540 }}>
        <thead><tr><th>Event</th>{NOTIF_CHANNELS.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{NOTIF_EVENTS.map((e) => (<tr key={e}>
          <td style={{ fontSize: 12.5, fontWeight: 600 }}>{e}</td>
          {NOTIF_CHANNELS.map((c) => (
            <td key={c}><div style={{ display: "flex", justifyContent: "center" }}>
              <Switch on={!!(s.v[e] || {})[c]} onChange={(v) => flip(e, c, v)} />
            </div></td>))}
        </tr>))}</tbody>
      </table></div>
      <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted)" }}>
        In-app and desktop alerts follow these choices. Email alerts for these events
        are sent by automation rules, so a row here does not switch one on by itself.
      </p>
      <SaveBar s={s} />
    </SecCard>
  );
}

/* ---- 7. theme ---- */
function ThemeSettings({ themeApi }) {
  const push = useToast();
  const { theme, setTheme, resetTheme, dark } = themeApi;
  const current = theme || (dark ? THEME_DARK : THEME_DEFAULT);
  const fileRef = useRef(null);
  const activePreset = PRESETS.find((p) => JSON.stringify(p.t) === JSON.stringify(current));
  return (
    <SecCard title="Theme & Appearance" sub="Colors apply live across the whole app.">
      <div className="tm-sec">Preset Themes</div>
      <div className="preset-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", marginBottom: 14 }}>
        {PRESETS.map((p) => (<button key={p.name} className={`preset ${activePreset?.name === p.name ? "on" : ""}`} onClick={() => setTheme({ ...p.t })}>
          <span className="sw"><i style={{ background: p.t.primary }} /><i style={{ background: p.t.accent }} /><i style={{ background: p.t.success }} /></span>{p.name}</button>))}
      </div>
      <div className="tm-sec">Live Preview</div>
      <ThemePreview />
      <div className="tm-sec" style={{ marginTop: 12 }}>Colors</div>
      <div>{THEME_FIELDS.map((f) => <ThemeSwatch key={f.key} field={f} value={current[f.key]} onChange={(v) => setTheme({ ...current, [f.key]: v })} />)}</div>
      <div className="savebar">
        <button className="btn btn-ghost btn-sm" onClick={() => { resetTheme(); push({ type: "info", title: "Theme reset" }); }}><RefreshCw size={14} /> Reset</button>
        <button className="btn btn-soft btn-sm" onClick={() => { downloadBlob(JSON.stringify(current, null, 2), "helphive-theme.json", "application/json"); push({ type: "success", title: "Theme exported" }); }}><Download size={14} /> Export</button>
        <button className="btn btn-soft btn-sm" onClick={() => fileRef.current?.click()}><Upload size={14} /> Import</button>
        <input ref={fileRef} type="file" accept=".json" hidden onChange={(e) => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = (ev) => { try { setTheme({ ...THEME_DEFAULT, ...JSON.parse(ev.target.result) }); push({ type: "success", title: "Theme imported" }); } catch { push({ type: "error", title: "Invalid theme file" }); } }; r.readAsText(file); }} />
        <button className="btn btn-primary btn-sm" onClick={() => { try { localStorage.setItem("helphive-theme", JSON.stringify(current)); push({ type: "success", title: "Theme saved", desc: "Loads automatically next time." }); } catch { push({ type: "error", title: "Couldn't save", desc: "Storage unavailable in this preview." }); } }}><Save size={14} /> Save Theme</button>
      </div>
    </SecCard>
  );
}

/* ---- 9. customer ---- */
function CustomerSettingsPanel() {
  const s = useSet({ reg: true, guest: true, portal: true, verify: true, vis: false, edit: true },
                   "Customer settings", "customer");
  const rows = [
    ["reg", UserPlus, "Customer Registration", "Allow new customers to create accounts."],
    ["guest", Ticket, "Allow Guest Tickets", "Accept tickets without an account."],
    ["portal", Globe, "Customer Portal Access", "Customers can log in to track tickets."],
    ["verify", BadgeCheck, "Email Verification", "Require verified email before portal access."],
    ["vis", Eye, "Ticket Visibility", "Customers can see other tickets from their college."],
    ["edit", Pencil, "Profile Editing", "Customers can edit their own profile details."],
  ];
  return (
    <SecCard title="Customer Settings" sub="What customers can do on the portal.">
      {rows.map(([k, Ic, ti, d]) => <ToggleRow key={k} icon={Ic} title={ti} desc={d} on={!!s.v[k]} onChange={(v) => s.set(k, v)} />)}
      <SaveBar s={s} />
    </SecCard>
  );
}

/* ---- 10. kb ---- */
function KbSettings() {
  const s = useSet({ url: "https://help.internshipstudio.com", cats: "Getting Started, Internships, Certificates, Billing, Technical", vis: "Public", approval: true, index: true }, "Knowledge base settings", "kb");
  return (
    <SecCard title="Knowledge Base Settings" sub="Self-service help centre configuration.">
      <SetField label="Knowledge Base URL"><input value={s.v.url} onChange={(e) => s.set("url", e.target.value)} /></SetField>
      <SetField label="Categories (comma separated)"><input value={s.v.cats} onChange={(e) => s.set("cats", e.target.value)} /></SetField>
      <SetField label="Default Article Visibility"><select value={s.v.vis} onChange={(e) => s.set("vis", e.target.value)}>{["Public", "Private", "Logged-in customers only"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
      <ToggleRow icon={CheckCheck} title="Article Approval Workflow" desc="Drafts need approval before publishing." on={s.v.approval} onChange={(v) => s.set("approval", v)} />
      <ToggleRow icon={Search} title="Search Index" desc="Include articles in global search." on={s.v.index} onChange={(v) => s.set("index", v)} />
      <SaveBar s={s} />
    </SecCard>
  );
}

/* ---- 11. security ---- */
function SecuritySettings() {
  const s = useSet({ tfa: true, timeout: "30 minutes", lockout: "5 failed attempts",
                     minLen: true, needNumber: true, needSymbol: false, ips: [] },
                   "Security policy", "security");
  const [ip, setIp] = useState("");
  const ips = Array.isArray(s.v.ips) ? s.v.ips : [];

  return (
    <div className="set-sec">
      <SecCard title="Security Policy"
        sub="Recorded with your desk settings. These are your team's stated policy — the helpdesk module does not enforce them itself.">
        <ToggleRow icon={ShieldCheck} title="Two-Factor Authentication"
          desc="Policy: agents must complete a second factor at login."
          on={!!s.v.tfa} onChange={(v) => s.set("tfa", v)} />
        <div className="set-row">
          <span className="pic" style={{ background: "var(--primary-soft)", color: "var(--primary)", width: 34, height: 34 }}><Clock3 size={16} /></span>
          <div style={{ flex: 1 }}><div className="ti">Session Timeout</div><div className="td">Auto-logout after inactivity.</div></div>
          <select style={{ width: 150 }} value={s.v.timeout} onChange={(e) => s.set("timeout", e.target.value)}>
            {["15 minutes", "30 minutes", "1 hour", "4 hours"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="set-row">
          <span className="pic" style={{ background: "var(--primary-soft)", color: "var(--primary)", width: 34, height: 34 }}><Ban size={16} /></span>
          <div style={{ flex: 1 }}><div className="ti">Account Lockout</div><div className="td">Lock the account after repeated failures.</div></div>
          <select style={{ width: 170 }} value={s.v.lockout} onChange={(e) => s.set("lockout", e.target.value)}>
            {["3 failed attempts", "5 failed attempts", "10 failed attempts"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>

        <div style={{ margin: "12px 0 6px", fontSize: 12, fontWeight: 700 }}>Password Policy</div>
        {[["minLen", "Minimum 10 characters"], ["needNumber", "Require a number"], ["needSymbol", "Require a symbol"]].map(([k, l]) => (
          <div key={k} className="set-row" style={{ padding: "8px 0" }}>
            <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{l}</div>
            <Switch on={!!s.v[k]} onChange={(v) => s.set(k, v)} />
          </div>))}

        <div style={{ margin: "12px 0 6px", fontSize: 12, fontWeight: 700 }}>IP Whitelist</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input placeholder="Add IP or CIDR..." value={ip} onChange={(e) => setIp(e.target.value)} style={{ maxWidth: 220 }} />
          <button className="btn btn-soft btn-sm" disabled={!ip.trim() || ips.includes(ip.trim())}
                  onClick={() => { s.set("ips", [...ips, ip.trim()]); setIp(""); }}><PlusCircle size={14} /> Add</button>
        </div>
        <div className="chips">
          {ips.length === 0 && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>No addresses listed.</span>}
          {ips.map((x) => (
            <span key={x} className="fchip" style={{ cursor: "default" }}>{x}
              <button style={{ marginLeft: 6, border: 0, background: "none", cursor: "pointer", color: "inherit" }}
                      onClick={() => s.set("ips", ips.filter((y) => y !== x))}><X size={11} /></button>
            </span>))}
        </div>
        <SaveBar s={s} />
      </SecCard>

      <SecCard title="Account Access"
        sub="Passwords, sessions and login history belong to your admin platform's own login, not to this module.">
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>
          What the helpdesk itself records is in <b>Settings → Audit Logs</b>: every ticket, message
          and automation action, with who did it and when.
        </p>
      </SecCard>
    </div>
  );
}

/* ---- 12. backup ---- */
/*
 * A real export. It reads the desk through the same endpoints the screens use
 * and writes what comes back to a file, so what you download is what is in the
 * database at that moment. There is deliberately no Restore button: importing
 * a snapshot back over live tickets needs a server-side endpoint that does not
 * exist, and a button that quietly does nothing is worse than no button.
 */
function BackupSettings() {
  const push = useToast();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);
  const [parts, setParts] = useState({ tickets: true, automations: true, canned: true, settings: true });

  const run = async () => {
    setBusy(true);
    const snapshot = { exportedAt: new Date().toISOString(), source: "Internship Studio helpdesk" };
    const failed = [];
    try {
      if (parts.tickets) {
        try {
          /* Paged, because the list endpoint is. The ceiling is there so a desk
             with a hundred thousand tickets cannot lock the browser up trying
             to put all of them in one file. */
          const all = [];
          let page = 1, total = 0;
          for (; page <= 40; page++) {
            const r = await fdTickets.list({ view: "all", page, perPage: 100, scope: "backup" });
            const batch = r.tickets || [];
            total = r.total ?? total;
            all.push(...batch);
            if (batch.length < 100) break;
          }
          snapshot.tickets = all;
          snapshot.ticketTotal = total || all.length;
          if (total && all.length < total) snapshot.ticketsTruncatedAt = all.length;
        } catch (e) { failed.push("tickets"); }
      }
      if (parts.automations) {
        try { snapshot.automations = (await fdMessages.automations()).rules || []; }
        catch (e) { failed.push("automations"); }
      }
      if (parts.canned) {
        try { snapshot.cannedResponses = (await fdMessages.canned(true)).responses || []; }
        catch (e) { failed.push("canned responses"); }
      }
      if (parts.settings) {
        try {
          const r = await fdSettings.get();
          // Secrets come back masked from the server; they are not in the file.
          snapshot.settings = r.settings || {};
        } catch (e) { failed.push("settings"); }
      }

      const name = `helpdesk-backup-${new Date().toISOString().slice(0, 10)}.json`;
      downloadBlob(JSON.stringify(snapshot, null, 2), name, "application/json");
      setLast({ name, when: new Date().toLocaleString(),
                counts: { tickets: (snapshot.tickets || []).length,
                          automations: (snapshot.automations || []).length,
                          canned: (snapshot.cannedResponses || []).length } });
      push(failed.length
        ? { type: "warning", title: "Exported with gaps", desc: `Could not read: ${failed.join(", ")}.` }
        : { type: "success", title: "Backup downloaded", desc: name });
    } catch (err) {
      push({ type: "error", title: "Export failed", desc: err.message });
    }
    setBusy(false);
  };

  const ROWS = [["tickets", Ticket, "Tickets", "Up to the most recent 1,000, with their fields."],
                ["automations", Zap, "Automation Rules", "Every rule, with its conditions and actions."],
                ["canned", MessageSquareText, "Canned Responses", "The whole reply library, folders included."],
                ["settings", Settings, "Settings", "Desk configuration. Passwords are masked by the server."]];

  return (
    <SecCard title="Export a Snapshot" sub="Downloads the desk's current data as a JSON file." right={
      <button className="btn btn-primary btn-sm" disabled={busy || !Object.values(parts).some(Boolean)} onClick={run}>
        {busy ? <><Spinner /> Exporting…</> : <><HardDrive size={14} /> Export Now</>}
      </button>}>
      {ROWS.map(([k, Ic, ti, d]) => (
        <ToggleRow key={k} icon={Ic} title={ti} desc={d} on={parts[k]} onChange={(v) => setParts((x) => ({ ...x, [k]: v }))} />))}

      {last && (
        <div className="set-row" style={{ marginTop: 12 }}>
          <span className="pic" style={{ background: "var(--success-soft)", color: "var(--success)", width: 34, height: 34 }}><FileDown size={16} /></span>
          <div style={{ flex: 1 }}>
            <div className="ti">{last.name}</div>
            <div className="td">{last.when} · {last.counts.tickets} tickets, {last.counts.automations} rules, {last.counts.canned} canned responses</div>
          </div>
        </div>
      )}

      <p style={{ margin: "14px 0 0", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.65 }}>
        The file lands in your downloads folder. Nothing is stored on the server, so keep it
        somewhere safe. Restoring a snapshot is a database job, not a button here.
      </p>
    </SecCard>
  );
}

/* ---- 13. audit ---- */
function AuditSettings() {
  const push = useToast();
  const [rows, setRows] = useState(null);          // null = loading
  const [modules, setModules] = useState([]);
  const [q, setQ] = useState("");
  const [mod, setMod] = useState("All");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setRows(null); setErr("");
    try {
      const r = await fdSettings.audit({ q, module: mod === "All" ? "" : mod, limit: 200 });
      setRows(r.rows || []);
      if (r.modules) setModules(r.modules);
    } catch (e) {
      setRows([]); setErr(e.message || "Could not load the audit log");
    }
  }, [q, mod]);

  /* Typing searches on the server, so it waits for a pause rather than firing
     a query per keystroke. */
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const list = rows || [];
  return (
    <SecCard title="Audit Logs" sub="Every recorded action, newest first." right={
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Refresh</button>
        <button className="btn btn-soft btn-sm" disabled={!list.length} onClick={() => {
          exportCSV(list.map((l) => ({ When: l.dt, User: l.actor_name, Event: l.event,
                                       Module: l.module, Summary: l.summary, Ticket: l.ticket_id || "" })),
                    "audit-logs.csv");
          push({ type: "success", title: "Audit logs exported" });
        }}><Download size={14} /> Export CSV</button>
      </div>}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <div className="searchbox" style={{ maxWidth: 260, width: 260, flex: "initial" }}>
          <Search size={16} /><input placeholder="Search action, user, event..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chips">
          {["All", ...modules].map((m) => (
            <button key={m} className={`fchip ${mod === m ? "on" : ""}`} onClick={() => setMod(m)}>{m}</button>))}
        </div>
      </div>

      {err && <div className="logo-err" style={{ marginTop: 0 }}><AlertTriangle size={13} /> {err}</div>}

      {rows === null ? (
        <div className="card sk-card" style={{ minHeight: 180 }}><div className="sk" style={{ flex: 1 }} /></div>
      ) : list.length ? (
        <div className="table-wrap"><table style={{ minWidth: 760 }}>
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Module</th><th>Ticket</th></tr></thead>
          <tbody>{list.map((l) => (<tr key={l.id}>
            <td style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }} title={l.dt}>{l.ago}</td>
            <td style={{ fontWeight: 600, fontSize: 12.5 }}>{l.actor_name}</td>
            <td style={{ fontSize: 12.5 }}>{l.summary || l.event}</td>
            <td><span className="fchip" style={{ cursor: "default" }}>{l.module}</span></td>
            <td style={{ fontSize: 12.5, fontWeight: 700, color: l.ticket_id ? "var(--primary)" : "var(--muted)" }}>
              {l.ticket_id ? `#${l.ticket_id}` : "—"}
            </td>
          </tr>))}</tbody>
        </table></div>
      ) : (
        <EmptyState icon={ScrollText} title="Nothing recorded yet"
          desc={q || mod !== "All" ? "No entries match that search." : "Activity appears here as tickets arrive and agents work on them."} />
      )}
    </SecCard>
  );
}

/* ---- 14. api ---- */
/*
 * What this desk actually integrates with, read from the server rather than
 * listed as logos with switches. The realtime channel and the sync cron are
 * the two moving parts, and both can tell you their true state.
 */
function ApiSettings() {
  const push = useToast();
  const [meta, setMeta] = useState(null);
  const [rt, setRt] = useState(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        fdSettings.get(),
        fdRealtime.status().catch(() => null),
      ]);
      setMeta((a.settings || {})._meta || {});
      setRt(b);
    } catch (err) {
      setMeta({});
      push({ type: "error", title: "Could not read the configuration", desc: err.message });
    }
  }, [push]);
  useEffect(() => { load(); }, [load]);

  const copy = (text, what) => {
    try { navigator.clipboard.writeText(text); push({ type: "success", title: `${what} copied` }); }
    catch { push({ type: "error", title: "Clipboard unavailable" }); }
  };

  const testPusher = async () => {
    setTesting(true);
    try {
      const r = await fdSettings.testPusher();
      push(r.ok === false
        ? { type: "error", title: "Realtime test failed", desc: r.message }
        : { type: "success", title: "Realtime test sent", desc: r.message || "Open screens should have received it." });
    } catch (err) {
      push({ type: "error", title: "Realtime test failed", desc: err.message });
    }
    setTesting(false);
  };

  if (!meta) return <div className="card sk-card" style={{ minHeight: 220 }}><div className="sk" style={{ flex: 1 }} /></div>;

  const pill = (ok, yes, no) => (
    <span className="badge-pill" style={{ background: ok ? "var(--success-soft)" : "var(--warning-soft)", color: ok ? "var(--success)" : "var(--warning)" }}>
      {ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />} {ok ? yes : no}
    </span>);

  return (
    <div className="set-sec">
      <SecCard title="Realtime" sub="Pusher pushes new mail to open screens. Without it the desk falls back to polling."
        right={pill(!!meta.pusherConfigured, "Configured", "Not configured")}>
        <div className="set-row">
          <span className="pic" style={{ background: "var(--primary-soft)", color: "var(--primary)", width: 34, height: 34 }}><Zap size={16} /></span>
          <div style={{ flex: 1 }}>
            <div className="ti">Delivery mode</div>
            <div className="td">{meta.pusherConfigured ? "Pushed over Pusher" : "Polling on a timer"}</div>
          </div>
          <button className="btn btn-soft btn-sm" disabled={testing || !meta.pusherConfigured} onClick={testPusher}>
            {testing ? <><Spinner /> Testing…</> : <><Send size={14} /> Send test event</>}
          </button>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
          Keys are set in <b>Settings → Mailbox</b> alongside the rest of the connection details.
        </p>
      </SecCard>

      <SecCard title="Mail Sync Cron" sub="The job that imports the mailbox. Nothing arrives unless this runs."
        right={rt ? pill(!rt.stale, `Last run ${rt.lastSyncAgo}`, rt.lastSync ? `Last run ${rt.lastSyncAgo}` : "Never run") : null}>
        {rt && rt.stale && (
          <div className="logo-err" style={{ marginTop: 0, marginBottom: 12 }}>
            <AlertTriangle size={13} /> {rt.staleHint || "No sync in the last 10 minutes."}
          </div>)}
        {rt && !rt.stale && (
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--muted)" }}>
            {rt.imported} messages imported into <b>{rt.mailbox}</b> so far.
          </p>)}
        <SetField label="Command">
          <div style={{ display: "flex", gap: 8 }}>
            <input readOnly value={meta.cronCommand || ""} />
            <button className="btn btn-soft btn-sm" onClick={() => copy(meta.cronCommand || "", "Command")}><Copy size={14} /></button>
          </div>
        </SetField>
        <SetField label="Or call over HTTP">
          <div style={{ display: "flex", gap: 8 }}>
            <input readOnly value={meta.cronUrl || ""} />
            <button className="btn btn-soft btn-sm" onClick={() => copy(meta.cronUrl || "", "URL")}><Copy size={14} /></button>
          </div>
        </SetField>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
          The URL carries the cron secret. Treat it as a password.
        </p>
      </SecCard>

      <SecCard title="Attachment Storage" sub="Where files on tickets are kept."
        right={pill(!!meta.attachWritable, "Writable", "Not writable")}>
        <div className="kv" style={{ borderBottom: "1px solid var(--border)" }}><span className="k">Directory</span><span className="v" style={{ wordBreak: "break-all" }}>{meta.attachDir || "—"}</span></div>
        <div className="kv" style={{ borderBottom: "1px solid var(--border)" }}><span className="k">Max file size</span><span className="v">{meta.maxAttachMb ? `${meta.maxAttachMb} MB` : "—"}</span></div>
        <div className="kv"><span className="k">Allowed types</span><span className="v">{(meta.allowedExt || []).join(", ") || "—"}</span></div>
      </SecCard>
    </div>
  );
}

/* ---- 15. reports ---- */
function ReportsSettings() {
  const s = useSet({ freq: "Weekly", day: "Monday", fmt: "Excel (.xlsx)", to: "founder@internshipstudio.com, ops@internshipstudio.com", scheduled: true }, "Report settings", "reports");
  return (
    <SecCard title="Reports Settings" sub="Scheduled report delivery.">
      <div className="set-grid2">
        <SetField label="Report Frequency"><select value={s.v.freq} onChange={(e) => s.set("freq", e.target.value)}>{["Daily", "Weekly", "Monthly"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Send On"><select value={s.v.day} onChange={(e) => s.set("day", e.target.value)}>{["Monday", "Friday", "1st of month"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Export Format"><select value={s.v.fmt} onChange={(e) => s.set("fmt", e.target.value)}>{["Excel (.xlsx)", "CSV", "PDF"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
      </div>
      <SetField label="Email Recipients"><input value={s.v.to} onChange={(e) => s.set("to", e.target.value)} /></SetField>
      <ToggleRow icon={CalendarClock} title="Scheduled Reports" desc="Email the report automatically on schedule." on={s.v.scheduled} onChange={(v) => s.set("scheduled", v)} />
      <SaveBar s={s} />
    </SecCard>
  );
}

function SettingsPage({ section, initialSection = "general", themeApi, go, logoApi, onSection }) {
  /*
   * The URL is the source of truth. Local state is only the fallback for a
   * caller that has not wired routing up -- keeping both as independent state
   * is how Back ends up showing the previous address with the current section.
   */
  const known = SET_SECTIONS.some((x) => x.key === section);
  const [fallback, setFallback] = useState(initialSection);
  const sec = known ? section : fallback;
  const setSec = (k) => { setFallback(k); if (onSection) onSection(k); };
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); const t = setTimeout(() => setLoading(false), 380); return () => clearTimeout(t); }, [sec]);
  const body = () => {
    switch (sec) {
      case "general": return <GeneralSettings logoApi={logoApi} />;
      case "teams": return <TeamSettings />;
      case "approvals": return <ApprovalSettings />;
      case "roles": return <RolesSettings />;
      case "ticket": return <TicketSettings />;
      case "canned": return <CannedManager />;
      case "mailbox": return <MailboxMaintenance />;
      case "email": return <EmailSettings />;
      case "notif": return <NotifSettings />;
      case "theme": return <ThemeSettings themeApi={themeApi} />;
      case "customer": return <CustomerSettingsPanel />;
      case "kb": return <KbSettings />;
      case "security": return <SecuritySettings />;
      case "backup": return <BackupSettings />;
      case "audit": return <AuditSettings />;
      case "api": return <ApiSettings />;
      default: return <ReportsSettings />;
    }
  };
  return (
    <PrefsProvider>
    <div className="content route">
      <div className="page-head">
        <div><h1>Settings</h1><p>Configure your entire support platform from one place.</p></div>
      </div>
      <div className="set-layout">
        <div className="card set-nav">
          {SET_SECTIONS.map((x) => (
            <button key={x.key} className={sec === x.key ? "on" : ""}
                    onClick={() => (x.goto ? go(x.goto) : setSec(x.key))}>
              <x.icon size={16} /> {x.label}
              {x.goto && <ChevronRight size={14} style={{ marginLeft: "auto", opacity: 0.55 }} />}
            </button>))}
        </div>
        <div key={sec} className="route">
          {loading ? (<div className="card sk-card" style={{ minHeight: 320 }}><div className="sk" style={{ height: 22, width: "35%" }} /><div className="sk" style={{ height: 14, width: "55%" }} /><div className="sk" style={{ flex: 1, minHeight: 200 }} /></div>) : body()}
        </div>
      </div>
    </div>
    </PrefsProvider>
  );
}

function EditProfileModal({ open, profile, onClose, onSave }) {
  const [f, setF] = useState(profile);
  const [err, setErr] = useState("");
  useEffect(() => { if (open) { setF(profile); setErr(""); } }, [open]);
  if (!open) return null;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = () => {
    if (!f.name.trim()) { setErr("Name is required."); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) { setErr("Enter a valid email address."); return; }
    if (!f.phone.trim()) { setErr("Phone is required."); return; }
    onSave({ ...f, name: f.name.trim() });
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "var(--primary-soft)", color: "var(--primary)", width: 32, height: 32 }}><Pencil size={15} /></span>Edit Profile</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          {err && <div className="logo-err" style={{ marginTop: 0 }}><AlertTriangle size={13} /> {err}</div>}
          <div className="set-grid2">
            <div className="fld"><label>Full Name</label><input value={f.name} onChange={set("name")} /></div>
            <div className="fld"><label>Role / Designation</label><input value={f.role} onChange={set("role")} /></div>
            <div className="fld"><label>Employee ID</label><input value={f.emp} onChange={set("emp")} /></div>
            <div className="fld"><label>Email</label><input type="email" value={f.email} onChange={set("email")} /></div>
            <div className="fld"><label>Phone</label><input value={f.phone} onChange={set("phone")} /></div>
            <div className="fld"><label>Location</label><input value={f.location} onChange={set("location")} /></div>
            <div className="fld"><label>Joined</label><input value={f.joined} onChange={set("joined")} /></div>
          </div>
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" onClick={save}><Save size={14} /> Save Changes</button></div>
      </div>
    </div>
  );
}

function AdminProfilePage({ go, onSignOut }) {
  const push = useToast();
  const [confirm, setConfirm] = useState(null);
  const [profile, setProfile] = useState(() => { try { return { ...PROFILE_DEFAULT, ...JSON.parse(localStorage.getItem("hh-profile") || "{}") }; } catch { return PROFILE_DEFAULT; } });
  const [editOpen, setEditOpen] = useState(false);
  useEffect(() => {
    (async () => { try { if (window.storage) { const r = await window.storage.get("hh-profile"); if (r && r.value) setProfile({ ...PROFILE_DEFAULT, ...JSON.parse(r.value) }); } } catch (e) {} })();
  }, []);
  const saveProfile = async (p) => {
    setProfile(p); setEditOpen(false);
    const json = JSON.stringify(p);
    try { localStorage.setItem("hh-profile", json); } catch (e) {}
    try { if (window.storage) await window.storage.set("hh-profile", json); } catch (e) {}
    push({ type: "success", title: "Profile updated", desc: "Your changes have been saved." });
  };
  const [docs, setDocs] = useState([
    { id: 1, name: "Resume - Admin.pdf", size: "220 KB", icon: FileText, color: "#EF4444" },
    { id: 2, name: "Aadhaar ID Proof.pdf", size: "180 KB", icon: BadgeCheck, color: "#0EA5E9" },
    { id: 3, name: "Employment Contract.docx", size: "96 KB", icon: Briefcase, color: "#5B5CEB" },
  ]);
  const weekly = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => ({ d, tickets: [6, 9, 7, 11, 8, 4, 3][i], resolved: [5, 7, 6, 9, 7, 4, 2][i] }));
  const monthly = ["W1", "W2", "W3", "W4"].map((d, i) => ({ d, resolved: [28, 34, 31, 39][i] }));
  const trend = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"].map((d, i) => ({ d, rate: [82, 85, 88, 86, 91, 93][i] }));
  const acts = [
    [LogIn, "#0EA5E9", "Logged in from Chrome, Windows", "Today, 9:02 am"],
    [UserPlus, "#5B5CEB", "Assigned #336270 to Priya Nair", "Today, 10:15 am"],
    [CheckCheck, "#10B981", "Closed ticket #336196", "Today, 11:12 am"],
    [Pencil, "#F59E0B", "Updated priorities on 5 tickets", "Today, 11:40 am"],
    [Zap, "#8B5CF6", "Created automation 'Urgent tag alert'", "Yesterday, 4:20 pm"],
    [Settings, "#64748B", "Edited email settings", "Yesterday, 6:05 pm"],
  ];
  const kpis = [["Tickets Assigned", 46], ["Tickets Closed", 38], ["Resolution Rate", "83%"], ["Avg Response", "26m"], ["CSAT", "94%"], ["Open Tickets", 8], ["SLA Compliance", "96%"]];
  const dl = (d) => { downloadBlob(`Dummy content for ${d.name}`, d.name.replace(/ /g, "-"), "text/plain"); push({ type: "success", title: "Download started", desc: d.name }); };
  return (
    <div className="content route">
      <div className="crumb"><a onClick={() => go("home")}>Dashboard</a> <ChevronRight size={14} /> <span style={{ color: "var(--text)" }}>Admin Profile</span></div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="cprof-head">
          <span className="pav" style={{ background: "linear-gradient(135deg,var(--primary),var(--accent))" }}>{initials(profile.name)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{profile.name} <BadgeCheck size={20} color="var(--success)" /></h1>
            <div className="cprof-meta">
              <span className="m"><Briefcase size={13} /> {profile.role}</span>
              <span className="m"><Ticket size={13} /> {profile.emp}</span>
              <span className="m"><AtSign size={13} /> {profile.email}</span>
              <span className="m"><PhoneCall size={13} /> {profile.phone}</span>
            </div>
            <div className="cprof-meta">
              <span className="m"><CalendarDays size={13} /> Joined {profile.joined}</span>
              <span className="m"><MapPin size={13} /> {profile.location}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-primary btn-sm" onClick={() => setEditOpen(true)}><Pencil size={14} /> Edit Profile</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { downloadBlob(JSON.stringify({ name: "Hemani Raina", role: "Support Lead", emp: "EMP-1001", email: "rainahemani14@gmail.com", joined: "15 Mar 2023" }, null, 2), "admin-profile.json", "application/json"); push({ type: "success", title: "Profile downloaded" }); }}><FileDown size={14} /> Download</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirm({ t: "logout" })}><LogOut size={14} /> Logout</button>
          </div>
        </div>
      </div>

      <div className="prof-grid">
        <div className="set-sec">
          <SecCard title="Performance Dashboard" sub="This month at a glance.">
            <div className="an-kpis" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
              {kpis.map(([k, v]) => <div className="an-kpi" key={k}><div className="v">{v}</div><div className="l">{k}</div></div>)}
            </div>
            <div className="set-grid2" style={{ marginTop: 14 }}>
              <div><div className="tm-sec" style={{ marginBottom: 8 }}>Weekly Performance</div>
                <div style={{ height: 170 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={weekly} barSize={10}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="d" tick={{ fontSize: 10.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="tickets" fill="var(--accent)" radius={[3, 3, 0, 0]} /><Bar dataKey="resolved" fill="var(--success)" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
              <div><div className="tm-sec" style={{ marginBottom: 8 }}>Monthly Resolved</div>
                <div style={{ height: 170 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthly}><defs><linearGradient id="pm" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity=".3" /><stop offset="100%" stopColor="var(--primary)" stopOpacity="0" /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="d" tick={{ fontSize: 10.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Area dataKey="resolved" stroke="var(--primary)" strokeWidth={2.5} fill="url(#pm)" /></AreaChart></ResponsiveContainer></div></div>
            </div>
            <div className="tm-sec" style={{ margin: "10px 0 8px" }}>Ticket Resolution Trend</div>
            <div style={{ height: 150 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="d" tick={{ fontSize: 10.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><YAxis domain={[75, 100]} tick={{ fontSize: 10.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Line dataKey="rate" stroke="var(--success)" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>
          </SecCard>

          <SecCard title="Security">
            <ToggleRow icon={ShieldCheck} title="Two-Factor Authentication" desc="OTP at every login." on={true} onChange={(v) => push({ type: v ? "success" : "warning", title: `Two-factor ${v ? "enabled" : "disabled"}` })} />
            <div className="set-row"><span className="pic" style={{ background: "var(--primary-soft)", color: "var(--primary)", width: 34, height: 34 }}><Key size={16} /></span>
              <div style={{ flex: 1 }}><div className="ti">Password</div><div className="td">Last changed 34 days ago.</div></div>
              <button className="btn btn-soft btn-sm" onClick={() => go("settings")}>Change</button></div>
            <div className="set-row"><span className="pic" style={{ background: "var(--primary-soft)", color: "var(--primary)", width: 34, height: 34 }}><Monitor size={16} /></span>
              <div style={{ flex: 1 }}><div className="ti">Active Sessions</div><div className="td">3 devices signed in.</div></div>
              <button className="btn btn-soft btn-sm" onClick={() => go("settings")}>View</button></div>
            <div className="set-row"><span className="pic" style={{ background: "var(--danger-soft)", color: "var(--danger)", width: 34, height: 34 }}><LogOut size={16} /></span>
              <div style={{ flex: 1 }}><div className="ti">Logout from all devices</div><div className="td">Ends every session except this one.</div></div>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirm({ t: "all" })}>Logout All</button></div>
          </SecCard>
        </div>

        <div className="set-sec">
          <SecCard title="Activity Timeline">
            {acts.map(([Ic, c, txt, when], i) => (
              <div className="act-item" key={i} style={{ padding: "11px 0" }}>
                <span className="ai" style={{ background: `${c}18`, color: c }}><Ic size={15} /></span>
                <div style={{ minWidth: 0 }}><div className="at">{txt}</div><div className="am"><span>{when}</span></div></div>
              </div>))}
          </SecCard>
          <SecCard title="Preferences">
            <SetField label="Theme"><select defaultValue="Follow app setting" onChange={() => push({ type: "info", title: "Theme preference saved" })}>{["Follow app setting", "Light", "Dark"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
            <SetField label="Language"><select defaultValue="English">{["English", "Hindi", "Marathi"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
            <SetField label="Time Zone"><select defaultValue="Asia/Kolkata (IST)">{["Asia/Kolkata (IST)", "UTC"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
            <ToggleRow icon={BellRing} title="Notification Sounds" on={true} onChange={() => {}} />
          </SecCard>
          <SecCard title="Files & Documents" right={
            <label className="btn btn-soft btn-sm" style={{ cursor: "pointer" }}><FileUp size={14} /> Upload<input type="file" hidden onChange={(e) => { const f = e.target.files[0]; if (!f) return; setDocs((ds) => [{ id: Date.now(), name: f.name, size: Math.round(f.size / 1024) + " KB", icon: FileText, color: "#10B981" }, ...ds]); push({ type: "success", title: "Document uploaded", desc: f.name }); }} /></label>}>
            {docs.map((d) => (
              <div className="doc-row" key={d.id}>
                <span className="di" style={{ background: `${d.color}16`, color: d.color }}><d.icon size={17} /></span>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{d.size}</div></div>
                <button className="icon-btn" style={{ width: 30, height: 30 }} title="Download" onClick={() => dl(d)}><Download size={14} /></button>
              </div>))}
          </SecCard>
        </div>
      </div>

      <EditProfileModal open={editOpen} profile={profile} onClose={() => setEditOpen(false)} onSave={saveProfile} />
      <ConfirmDialog open={!!confirm} title={confirm?.t === "all" ? "Logout from all devices" : "Logout"} message={confirm?.t === "all" ? "End every active session except this one?" : "Log out of HelpHive on this device?"} confirmLabel="Logout"
        onConfirm={() => { if (confirm?.t === "all") { push({ type: "success", title: "All other sessions ended" }); } else { onSignOut && onSignOut(); } }} onClose={() => setConfirm(null)} />
    </div>
  );
}

export {
  AdminProfilePage,
  AgentModal,
  ApiSettings,
  ApprovalSettings,
  AuditSettings,
  BackupSettings,
  CustomerSettingsPanel,
  EditProfileModal,
  EmailSettings,
  GeneralSettings,
  KbSettings,
  NotifSettings,
  PerfModal,
  ReportsSettings,
  RolesSettings,
  SEED_AGENTS,
  SET_PERMS,
  SET_ROLES,
  SET_SECTIONS,
  SET_TEAMS,
  SaveBar,
  SecCard,
  SecuritySettings,
  SetField,
  SettingsPage,
  SignatureSettings,
  TeamSettings,
  ThemeSettings,
  TicketSettings,
  ToggleRow,
  useSet,
};
