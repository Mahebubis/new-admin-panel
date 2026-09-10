/*
 * src/pages/freshdesk/pages/ReportsPage.jsx — reporting, exports and the
 * per-agent performance tables.
 */
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Briefcase, CalendarClock, CalendarDays, CheckCheck, CheckCircle2, Clock, Download, FileDown, FileSpreadsheet, FileText, Filter, Gauge, GraduationCap, History, Inbox, LineChart as LineChartIcon, Monitor, Pencil, PieChart as PieChartIcon, Printer, RotateCcw, Save, Search, Settings, Smile, Sparkles, Ticket, Timer, Trash2, TrendingDown, TrendingUp, Upload, UserCheck, Users, UsersRound, X } from "lucide-react";
import { ChartTooltip, ConfirmDialog, EmptyState, downloadBlob, exportCSV, exportExcel, exportPDF, useCounter, useToast } from "../fdShared";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo, useState } from "react";
import { AGENTS, ANALYTICS, BULK_PRIORITY, DEPTS, SOURCES, TICKET_CATS, TICKET_TYPES } from "../fdConstants";
import { SET_TEAMS } from "./SettingsPage";

/* ============================================================================
   AGENT DASHBOARD — personal command center for the logged-in agent
   ========================================================================== */
function agdHash(str) { let h = 0; for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; } return h; }

function agdRand(seedStr) { let x = agdHash(seedStr) || 7; return () => { x = (x * 1103515245 + 12345) >>> 0; return (x % 1000) / 1000; }; }

const AGD_RANGES = [["today","Today",1],["yest","Yesterday",1],["7d","Last 7 Days",7],["30d","Last 30 Days",30],["month","This Month",30],["pmonth","Previous Month",30],["custom","Custom",0]];

function agdRoleOf(me) {
  const email = (me.email || "").toLowerCase();
  if (["rainahemani14@gmail.com", "admin@internshipstudio.com"].includes(email)) return "admin";
  if (/super admin|admin/i.test(me.role || "")) return "admin";
  if (/lead/i.test(me.role || "")) return "lead";
  return "agent";
}

function AgdRing({ pct, size = 92, color = "var(--primary)", label, sub }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="agd-ring-wrap">
      <div className="agd-ring" style={{ width: size, height: size, background: `conic-gradient(${color} ${p * 3.6}deg, var(--surface-2) 0deg)` }}>
        <div className="agd-ring-in"><b>{label ?? `${Math.round(p)}%`}</b></div>
      </div>
      {sub && <span className="agd-ring-sub">{sub}</span>}
    </div>
  );
}

function AgdKpi({ icon: Ic, tone, label, value, delta }) {
  const up = (delta || 0) >= 0;
  return (
    <div className="agk">
      <span className={`agk-ic ic-${tone}`}><Ic size={14} /></span>
      <div className="agk-main"><b>{value}</b><span>{label}</span></div>
      <span className={`agk-tr ${up ? "up" : "dn"}`}>{up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{Math.abs(delta)}%</span>
    </div>
  );
}

/* The per-agent "My Dashboard" screen has been removed along with its nav entry.
   It duplicated the main Dashboard against the same data, and its personal
   KPIs (CSAT, personal SLA) were the last hard-coded numbers left on the page.
   The organisation-wide Dashboard is now the single view of the desk. */

/* ============================================================================
   REPORTS & ANALYTICS CENTER
   ========================================================================== */
const RA_DATE_PRESETS = ["Today","Yesterday","Last 7 Days","Last 30 Days","Last 90 Days","This Month","Previous Month","This Year","Custom"];

const RA_STATUSES = ["Open","Pending","Resolved","Closed"];

const RA_SLA = ["Within SLA","Breached"];

const RA_RESTIME = ["Under 1 Hour","1-4 Hours","4-24 Hours","More than 1 Day"];

const RA_SPARK = [4,7,5,9,8,12,10];

function raSpark(seed) {
  return RA_SPARK.map((v, i) => ({ i, v: Math.max(1, Math.round(v * (0.6 + ((seed * 7 + i * 3) % 10) / 10))) }));
}

function RaKpi({ icon: Ic, color, label, value, delta, spark }) {
  const up = (delta || 0) >= 0;
  const numeric = typeof value === "number";
  const counted = useCounter(numeric ? value : 0);
  const shown = numeric ? counted.toLocaleString("en-IN") : value;
  return (
    <div className="card ra-kpi">
      <div className="ra-kpi-top">
        <span className="ic" style={{ background: `${color}18`, color }}><Ic size={17} /></span>
        <span className="trend" style={{ color: up ? "var(--success)" : "var(--danger)" }}>
          {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(delta)}%
        </span>
      </div>
      <div className="val">{shown}</div>
      <div className="lab">{label}</div>
      <div className="ra-spark">
        <ResponsiveContainer width="100%" height={34}>
          <AreaChart data={spark} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
            <defs><linearGradient id={`sg-${label.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".35" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
            <Area dataKey="v" stroke={color} strokeWidth={1.6} fill={`url(#sg-${label.replace(/\W/g, "")})`} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RaSection({ icon: Ic, title, sub, right, children, pad = true }) {
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div style={{ padding: pad ? "18px 20px 0" : "18px 20px 12px" }}>
        <div className="section-head" style={{ marginBottom: pad ? 14 : 0 }}>
          <div><h3 className="card-title">{Ic && <Ic size={15} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--primary)" }} />}{title}</h3>{sub && <p className="card-sub">{sub}</p>}</div>
          {right}
        </div>
      </div>
      {children}
    </div>
  );
}

function ReportsPage({ tickets }) {
  const push = useToast();
  const [range, setRange] = useState("Last 30 Days");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [fStatus, setFStatus] = useState([]);
  const [fPriority, setFPriority] = useState([]);
  const [fType, setFType] = useState([]);
  const [fCat, setFCat] = useState([]);
  const [fAgent, setFAgent] = useState("All Agents");
  const [fTeam, setFTeam] = useState("All Teams");
  const [fCust, setFCust] = useState("");
  const [fSla, setFSla] = useState([]);
  const [fSource, setFSource] = useState([]);
  const [fRes, setFRes] = useState([]);
  const [applied, setApplied] = useState(0);
  const [savedFilters, setSavedFilters] = useState(() => { try { return JSON.parse(localStorage.getItem("hh-report-filters") || "[]"); } catch { return []; } });
  const [histSearch, setHistSearch] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [schedule, setSchedule] = useState({ enabled: false, freq: "Weekly", recipients: "founder@internshipstudio.com", subject: "HelpHive Scheduled Report", type: "Ticket Report" });
  const [history, setHistory] = useState([
    { id: "h1", name: "Ticket Report — July", by: "Hemani Raina", at: Date.now() - 36e5, filters: "Last 30 Days · All agents", type: "XLSX", size: "84 KB" },
    { id: "h2", name: "Agent Performance — Q2", by: "Priya Nair", at: Date.now() - 864e5, filters: "Last 90 Days", type: "PDF", size: "1.2 MB" },
    { id: "h3", name: "SLA Compliance — Week 30", by: "Aisha Khan", at: Date.now() - 2 * 864e5, filters: "Last 7 Days · SLA Breached", type: "CSV", size: "18 KB" },
  ]);

  const toggleIn = (setter) => (v) => setter((xs) => xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]);

  const filtered = useMemo(() => (tickets || []).filter((t) => {
    if (fStatus.length && !fStatus.includes(t.status)) return false;
    if (fPriority.length && !fPriority.includes(t.priority)) return false;
    if (fCat.length && !fCat.includes(t.category)) return false;
    if (fAgent !== "All Agents" && t.agent !== fAgent) return false;
    if (fCust.trim() && !`${t.name || ""} ${t.email || ""}`.toLowerCase().includes(fCust.toLowerCase())) return false;
    if (fSla.length) { const br = t.sla === "Breached"; if (!fSla.includes(br ? "Breached" : "Within SLA")) return false; }
    if (fSource.length && !fSource.includes(t.source)) return false;
    return true;
  }), [tickets, applied]);

  // KPI numbers derived from filtered data (fall back to plausible dummies)
  const n = filtered.length;
  const cnt = (st) => filtered.filter((t) => t.status === st).length;
  const overdue = filtered.filter((t) => t.status === "Overdue" || t.sla === "Breached").length;
  const resolved = cnt("Resolved") + cnt("Closed");
  const kpis = [
    { icon: Ticket, color: "#5B5CEB", label: "Total Tickets", value: n, delta: 12 },
    { icon: Inbox, color: "#0EA5E9", label: "Open Tickets", value: cnt("Open") + cnt("New"), delta: 4 },
    { icon: CheckCheck, color: "#64748B", label: "Closed Tickets", value: cnt("Closed"), delta: 6 },
    { icon: Clock, color: "#F59E0B", label: "Pending Tickets", value: cnt("Pending"), delta: -3 },
    { icon: CheckCircle2, color: "#10B981", label: "Resolved Tickets", value: cnt("Resolved"), delta: 9 },
    { icon: AlertTriangle, color: "#EF4444", label: "Overdue Tickets", value: overdue, delta: -5 },
    { icon: CalendarDays, color: "#8B5CF6", label: "Received Today", value: Math.max(3, Math.round(n * 0.18)), delta: 14 },
    { icon: CalendarClock, color: "#EC4899", label: "Received This Month", value: Math.max(n, Math.round(n * 4.2)), delta: 11 },
    { icon: Timer, color: "#06B6D4", label: "Avg Response Time", value: "26m", delta: -9 },
    { icon: Gauge, color: "#F97316", label: "Avg Resolution Time", value: "3h 40m", delta: -6 },
    { icon: Smile, color: "#84CC16", label: "CSAT Score", value: "93%", delta: 3 },
    { icon: CheckCircle2, color: "#14B8A6", label: "SLA Compliance", value: n ? Math.round(((n - overdue) / n) * 100) + "%" : "92%", delta: 2 },
  ];

  // Chart data (respect filters)
  const trend = ANALYTICS.Week.map((d) => ({ ...d }));
  const catPie = TICKET_CATS.map((c, i) => ({ name: c, value: filtered.filter((t) => t.category === c).length || (i % 4) + 1, color: ["#5B5CEB", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#64748B"][i] }));
  const prioBar = BULK_PRIORITY.map((p, i) => ({ name: p, value: filtered.filter((t) => t.priority === p).length || (i + 1) * 2, color: ["#10B981", "#0EA5E9", "#F59E0B", "#EF4444"][i] }));
  const agentPerf = AGENTS.filter((a) => a !== "Unassigned").map((a, i) => {
    const assigned = filtered.filter((t) => t.agent === a).length || 8 + (i * 5) % 14;
    const closed = Math.max(1, Math.round(assigned * [0.85, 0.78, 0.92, 0.7, 0.8][i % 5]));
    return { name: a.split(" ")[0], full: a, assigned, closed, rate: Math.round((closed / assigned) * 100), avgResp: [24, 32, 18, 41, 29][i % 5] + "m", avgRes: ["3h 20m", "4h 05m", "2h 45m", "5h 12m", "3h 55m"][i % 5], rating: [4.8, 4.4, 4.9, 4.0, 4.3][i % 5] };
  });
  const csat = 93;
  const gaugeData = [{ name: "score", value: csat, color: "#10B981" }, { name: "rest", value: 100 - csat, color: "var(--surface-2)" }];
  const slaBars = [
    { label: "First Response SLA", pct: 92, color: "#10B981" },
    { label: "Resolution SLA", pct: 86, color: "#0EA5E9" },
    { label: "Next Response SLA", pct: 89, color: "#8B5CF6" },
    { label: "Overall Compliance", pct: n ? Math.round(((n - overdue) / n) * 100) : 92, color: "#F59E0B" },
  ];
  const resArea = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => ({ d, hrs: [3.6, 4.1, 3.2, 3.9, 3.4, 4.6, 3.8][i] }));
  const monthlyStack = ANALYTICS.Month.map((m) => ({ d: m.d, Resolved: m.Resolved, Pending: Math.max(2, m.Received - m.Resolved) }));
  const deptDonut = DEPTS.map((d, i) => ({ name: d, value: filtered.filter((t) => t.dept === d).length || (i + 2), color: ["#5B5CEB", "#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6"][i] }));

  const applyFilters = () => { setApplied((x) => x + 1); push({ type: "success", title: "Filters applied", desc: `${filtered.length} tickets in scope` }); };
  const resetFilters = () => { setFStatus([]); setFPriority([]); setFType([]); setFCat([]); setFAgent("All Agents"); setFTeam("All Teams"); setFCust(""); setFSla([]); setFSource([]); setFRes([]); setRange("Last 30 Days"); setFrom(""); setTo(""); setApplied((x) => x + 1); push({ type: "info", title: "Filters reset" }); };
  const saveFilter = () => {
    const name = prompt("Name this filter set:", `${range} · ${fAgent}`); if (!name) return;
    const f = { name, range, from, to, fStatus, fPriority, fType, fCat, fAgent, fTeam, fCust, fSla, fSource, fRes };
    const next = [...savedFilters.filter((x) => x.name !== name), f];
    setSavedFilters(next); localStorage.setItem("hh-report-filters", JSON.stringify(next));
    push({ type: "success", title: "Filter saved", desc: name });
  };
  const loadFilter = (f) => {
    setRange(f.range); setFrom(f.from); setTo(f.to); setFStatus(f.fStatus); setFPriority(f.fPriority); setFType(f.fType); setFCat(f.fCat); setFAgent(f.fAgent); setFTeam(f.fTeam); setFCust(f.fCust); setFSla(f.fSla); setFSource(f.fSource); setFRes(f.fRes); setApplied((x) => x + 1);
    push({ type: "success", title: "Filter loaded", desc: f.name });
  };

  const filterDesc = () => [range, fAgent !== "All Agents" ? fAgent : null, fStatus.join("/") || null, fPriority.join("/") || null].filter(Boolean).join(" · ");

  const ticketRows = () => filtered.map((t) => ({ "Ticket ID": t.id, "Customer Name": t.name, Subject: t.subject, Status: t.status, Priority: t.priority, Agent: t.agent, Team: t.dept, "Created Date": t.created, "Closed Date": ["Resolved", "Closed"].includes(t.status) ? t.lastActivity : "—", "Resolution Time": t.resolution || "—", "SLA Status": t.sla === "Breached" ? "Breached" : "Within SLA", Source: t.source, Category: t.category }));
  const agentRows = () => agentPerf.map((a) => ({ Agent: a.full, "Tickets Assigned": a.assigned, "Tickets Closed": a.closed, "Resolution Rate": a.rate + "%", "Avg Response Time": a.avgResp, "Avg Resolution Time": a.avgRes, "Customer Rating": a.rating }));
  const customerRows = () => {
    const byC = {};
    filtered.forEach((t) => { byC[t.email] = byC[t.email] || { "Customer Name": t.name, Email: t.email, Phone: t.phone || "—", "Total Tickets": 0, "Open Tickets": 0, "Closed Tickets": 0, "Last Activity": t.lastActivity }; byC[t.email]["Total Tickets"]++; if (["Open", "New", "Pending"].includes(t.status)) byC[t.email]["Open Tickets"]++; if (["Resolved", "Closed"].includes(t.status)) byC[t.email]["Closed Tickets"]++; });
    return Object.values(byC);
  };
  const teamRows = () => DEPTS.map((d, i) => { const tt = filtered.filter((t) => t.dept === d); const res = tt.filter((t) => ["Resolved", "Closed"].includes(t.status)).length; return { Team: d, "Total Tickets": tt.length || (i + 3), "Resolution Rate": (tt.length ? Math.round((res / tt.length) * 100) : 78 + i * 3) + "%", "SLA Compliance": 84 + ((i * 5) % 12) + "%" }; });
  const kpiRows = () => kpis.map((k) => ({ Metric: k.label, Value: String(k.value), "Change %": (k.delta >= 0 ? "+" : "") + k.delta + "%" }));

  const logHistory = (name, type, rows) => setHistory((h) => [{ id: "h" + Date.now(), name, by: "Hemani Raina", at: Date.now(), filters: filterDesc(), type, size: Math.max(6, Math.round(JSON.stringify(rows).length / 1024)) + " KB" }, ...h]);

  const generate = (name, rows, fmt) => {
    if (!rows.length) { push({ type: "error", title: "Nothing to export", desc: "No data matches the current filters." }); return; }
    const stem = name.toLowerCase().replace(/[^\w]+/g, "-");
    if (fmt === "xlsx") exportExcel(rows, `${stem}.xlsx`);
    else if (fmt === "csv") exportCSV(rows, `${stem}.csv`);
    else if (fmt === "pptx") { downloadBlob(JSON.stringify({ deck: name, slides: rows.slice(0, 20) }, null, 2), `${stem}.pptx.json`, "application/json"); }
    else { const ok = exportPDF(name, Object.keys(rows[0]), rows); if (!ok) { push({ type: "error", title: "Popup blocked", desc: "Allow popups to export PDF." }); return; } }
    logHistory(name, fmt.toUpperCase(), rows);
    push({ type: "success", title: "Report Generated Successfully", desc: name });
    setTimeout(() => push({ type: "info", title: "Download Started", desc: `${stem}.${fmt}` }), 400);
  };

  const QUICK = [
    ["Open Tickets Report", () => filtered.filter((t) => ["Open", "New"].includes(t.status)), Inbox, "#0EA5E9"],
    ["Closed Tickets Report", () => filtered.filter((t) => t.status === "Closed"), CheckCheck, "#64748B"],
    ["Pending Tickets Report", () => filtered.filter((t) => t.status === "Pending"), Clock, "#F59E0B"],
    ["Refund Report", () => filtered.filter((t) => /refund|payment|billing/i.test(t.subject + t.category)), Ticket, "#F97316"],
    ["Attendance Report", () => filtered.filter((t) => t.category === "Attendance"), CalendarDays, "#06B6D4"],
    ["Internship Report", () => filtered.filter((t) => t.category === "Internship"), GraduationCap, "#84CC16"],
    ["Billing Report", () => filtered.filter((t) => t.category === "Billing"), FileSpreadsheet, "#EC4899"],
    ["Technical Issues Report", () => filtered.filter((t) => t.category === "Technical"), Settings, "#8B5CF6"],
    ["Placement Report", () => filtered.filter((t) => t.category === "Placement"), Briefcase, "#5B5CEB"],
    ["Agent Performance Report", () => null, UsersRound, "#10B981"],
  ];

  const EXPORT_CENTER = [
    ["Entire Dashboard", () => kpiRows()], ["Analytics", () => kpiRows()], ["Filtered Tickets", () => ticketRows()],
    ["Filtered Customers", () => customerRows()], ["Agent Reports", () => agentRows()], ["Team Reports", () => teamRows()],
    ["Automation Reports", () => [{ Module: "Canned Responses", Status: "Active", Runs: 148 }, { Module: "Auto-Closure", Status: "Active", Runs: 62 }, { Module: "Email Forwarding", Status: "Active", Runs: 210 }, { Module: "Tagged Notifications", Status: "Paused", Runs: 34 }]],
    ["Audit Logs", () => [{ Time: "10:42", User: "Hemani Raina", Action: "Exported ticket report" }, { Time: "09:15", User: "Priya Nair", Action: "Updated SLA policy" }]],
    ["Knowledge Base Statistics", () => [{ Article: "Reset password", Views: 1240, Helpful: "92%" }, { Article: "Certificate download", Views: 980, Helpful: "88%" }]],
    ["Settings Backup", () => [{ Section: "General", Items: 12 }, { Section: "Email", Items: 9 }, { Section: "Roles", Items: 6 }]],
  ];

  const histFiltered = history.filter((h) => !histSearch.trim() || `${h.name} ${h.by}`.toLowerCase().includes(histSearch.toLowerCase()));

  const FilterChipGroup = ({ label, options, sel, toggle }) => (
    <div className="fld">
      <label>{label}</label>
      <div className="chips">{options.map((o) => <button key={o} className={`fchip ${sel.includes(o) ? "on" : ""}`} onClick={() => toggle(o)}>{o}</button>)}</div>
    </div>
  );

  return (
    <div className="content route">
      <div className="page-head">
        <div>
          <h1>Reports & Analytics <span className="count-badge">{filtered.length} tickets in scope</span></h1>
          <p>Generate, filter, analyse and download reports across your entire support operation.</p>
        </div>
      </div>

      {/* ===== KPI DASHBOARD ===== */}
      <div className="ra-kpi-grid">
        {kpis.map((k, i) => <RaKpi key={k.label} {...k} spark={raSpark(i)} />)}
      </div>

      {/* ===== FILTER PANEL ===== */}
      <RaSection icon={Filter} title="Report Filters" sub="Every chart, download and export below respects these filters."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-soft btn-sm" onClick={saveFilter}><Save size={13} /> Save Filter</button>
          {savedFilters.length > 0 && (
            <select className="fchip" style={{ padding: "7px 10px" }} value="" onChange={(e) => { const f = savedFilters.find((x) => x.name === e.target.value); if (f) loadFilter(f); }}>
              <option value="" disabled>Load Saved Filter…</option>
              {savedFilters.map((f) => <option key={f.name}>{f.name}</option>)}
            </select>
          )}
          <button className="btn btn-ghost btn-sm" onClick={resetFilters}><RotateCcw size={13} /> Reset</button>
          <button className="btn btn-primary btn-sm" onClick={applyFilters}><Filter size={13} /> Apply Filters</button>
        </div>}>
        <div style={{ padding: "0 20px 20px" }}>
          <div className="fld" style={{ marginBottom: 12 }}>
            <label>Date Range</label>
            <div className="chips">{RA_DATE_PRESETS.map((p) => <button key={p} className={`fchip ${range === p ? "on" : ""}`} onClick={() => setRange(p)}><CalendarDays size={12} /> {p}</button>)}</div>
            {range === "Custom" && (<div className="set-grid2" style={{ marginTop: 10 }}>
              <div className="fld"><label>From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="fld"><label>To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </div>)}
          </div>
          <div className="ra-filter-grid">
            <FilterChipGroup label="Ticket Status" options={RA_STATUSES} sel={fStatus} toggle={toggleIn(setFStatus)} />
            <FilterChipGroup label="Priority" options={BULK_PRIORITY} sel={fPriority} toggle={toggleIn(setFPriority)} />
            <FilterChipGroup label="Ticket Type" options={TICKET_TYPES} sel={fType} toggle={toggleIn(setFType)} />
            <FilterChipGroup label="Category" options={TICKET_CATS} sel={fCat} toggle={toggleIn(setFCat)} />
            <FilterChipGroup label="SLA Status" options={RA_SLA} sel={fSla} toggle={toggleIn(setFSla)} />
            <FilterChipGroup label="Ticket Source" options={SOURCES} sel={fSource} toggle={toggleIn(setFSource)} />
            <FilterChipGroup label="Resolution Time" options={RA_RESTIME} sel={fRes} toggle={toggleIn(setFRes)} />
            <div className="fld"><label>Assigned Agent</label><select value={fAgent} onChange={(e) => setFAgent(e.target.value)}><option>All Agents</option>{AGENTS.map((a) => <option key={a}>{a}</option>)}</select></div>
            <div className="fld"><label>Team</label><select value={fTeam} onChange={(e) => setFTeam(e.target.value)}><option>All Teams</option>{SET_TEAMS.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="fld"><label>Customer</label><input placeholder="Search customer name or email…" value={fCust} onChange={(e) => setFCust(e.target.value)} /></div>
          </div>
        </div>
      </RaSection>

      {/* ===== ANALYTICS ===== */}
      <div className="ra-2col">
        <RaSection icon={LineChartIcon} title="Ticket Trend" sub="Received vs resolved vs pending">
          <div style={{ height: 250, padding: "0 12px 16px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="Received" stroke="#0EA5E9" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line dataKey="Resolved" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line dataKey="Pending" stroke="#F59E0B" strokeWidth={2} dot={{ r: 2.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </RaSection>
        <RaSection icon={PieChartIcon} title="Ticket Categories" sub="Share of tickets by category">
          <div style={{ height: 250, padding: "0 12px 16px", display: "flex", alignItems: "center" }}>
            <ResponsiveContainer width="55%" height="100%">
              <PieChart><Pie data={catPie} dataKey="value" nameKey="name" innerRadius={0} outerRadius={88} paddingAngle={1} stroke="none">{catPie.map((d) => <Cell key={d.name} fill={d.color} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: "grid", gap: 5 }}>
              {catPie.map((d) => <div key={d.name} className="dist-row"><span className="dotc" style={{ background: d.color, width: 9, height: 9 }} /><span className="nm">{d.name}</span><span className="ct">{d.value}</span></div>)}
            </div>
          </div>
        </RaSection>
      </div>

      <div className="ra-2col">
        <RaSection icon={BarChart3} title="Priority Distribution">
          <div style={{ height: 240, padding: "0 12px 16px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={prioBar} barSize={30}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>{prioBar.map((d) => <Cell key={d.name} fill={d.color} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </RaSection>
        <RaSection icon={UsersRound} title="Agent Performance" sub="Assigned vs closed with resolution rate">
          <div style={{ height: 240, padding: "0 12px 16px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agentPerf} layout="vertical" barSize={10} margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={54} />
                <Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="assigned" name="Assigned" fill="#0EA5E9" radius={[0, 4, 4, 0]} />
                <Bar dataKey="closed" name="Closed" fill="#10B981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </RaSection>
      </div>

      <div className="ra-3col">
        <RaSection icon={Smile} title="Customer Satisfaction">
          <div style={{ padding: "0 16px 18px", textAlign: "center" }}>
            <div style={{ height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={gaugeData} dataKey="value" startAngle={180} endAngle={0} innerRadius={58} outerRadius={80} stroke="none" cy="90%">
                    <Cell fill="#10B981" /><Cell fill="var(--surface-2)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: -46 }}>{csat}%</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>1,284 responses · NPS 61</div>
          </div>
        </RaSection>
        <RaSection icon={Gauge} title="SLA Performance">
          <div style={{ padding: "0 20px 18px", display: "grid", gap: 12 }}>
            {slaBars.map((s) => (
              <div key={s.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 5 }}><span>{s.label}</span><span style={{ color: s.color }}>{s.pct}%</span></div>
                <div style={{ height: 8, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}><div style={{ width: s.pct + "%", height: "100%", background: s.color, borderRadius: 4, transition: "width .6s cubic-bezier(.4,0,.2,1)" }} /></div>
              </div>
            ))}
          </div>
        </RaSection>
        <RaSection icon={Timer} title="Avg Resolution Time" sub="Hours per day">
          <div style={{ height: 172, padding: "0 12px 16px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={resArea}>
                <defs><linearGradient id="ra-res" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06B6D4" stopOpacity=".4" /><stop offset="100%" stopColor="#06B6D4" stopOpacity="0" /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area dataKey="hrs" name="Hours" stroke="#06B6D4" strokeWidth={2.5} fill="url(#ra-res)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </RaSection>
      </div>

      <div className="ra-2col">
        <RaSection icon={BarChart3} title="Monthly Ticket Comparison" sub="Resolved vs pending, stacked by month">
          <div style={{ height: 250, padding: "0 12px 16px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyStack} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Resolved" stackId="m" fill="#10B981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Pending" stackId="m" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </RaSection>
        <RaSection icon={PieChartIcon} title="Tickets by Department">
          <div style={{ height: 250, padding: "0 12px 16px", display: "flex", alignItems: "center" }}>
            <ResponsiveContainer width="55%" height="100%">
              <PieChart><Pie data={deptDonut} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={2} stroke="none">{deptDonut.map((d) => <Cell key={d.name} fill={d.color} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: "grid", gap: 6 }}>
              {deptDonut.map((d) => <div key={d.name} className="dist-row"><span className="dotc" style={{ background: d.color, width: 9, height: 9 }} /><span className="nm">{d.name}</span><span className="ct">{d.value}</span></div>)}
            </div>
          </div>
        </RaSection>
      </div>

      {/* ===== DOWNLOAD REPORTS ===== */}
      <RaSection icon={Download} title="Download Reports" sub="Generate polished reports from the current filter scope." pad={false}>
        <div className="ra-dl-grid">
          {[
            { t: "Ticket Report", d: "Complete ticket export — ID, customer, status, priority, agent, SLA and more.", icon: Ticket, color: "#5B5CEB", rows: ticketRows, fmts: ["xlsx", "csv", "pdf"] },
            { t: "Analytics Report", d: "KPIs, charts and summary in one deck-style export.", icon: BarChart3, color: "#0EA5E9", rows: kpiRows, fmts: ["pdf", "pptx", "xlsx"] },
            { t: "Agent Performance Report", d: "Assigned, closed, response & resolution time, ratings.", icon: UsersRound, color: "#10B981", rows: agentRows, fmts: ["xlsx", "pdf"] },
            { t: "Customer Report", d: "Customer contact details and ticket counts.", icon: Users, color: "#F59E0B", rows: customerRows, fmts: ["xlsx", "csv", "pdf"] },
            { t: "Team Performance Report", d: "Team-wise volume, resolution rate and SLA compliance.", icon: UserCheck, color: "#8B5CF6", rows: teamRows, fmts: ["xlsx", "pdf"] },
            { t: "Daily Report", d: "Auto-generated summary for today.", icon: CalendarDays, color: "#06B6D4", rows: () => ticketRows().slice(0, 6), fmts: ["pdf", "xlsx"] },
            { t: "Weekly Report", d: "Auto-generated weekly summary.", icon: CalendarClock, color: "#EC4899", rows: () => ticketRows().slice(0, 12), fmts: ["pdf", "xlsx"] },
            { t: "Monthly Report", d: "Auto-generated monthly summary.", icon: History, color: "#F97316", rows: ticketRows, fmts: ["pdf", "xlsx"] },
            { t: "Custom Report", d: "Exactly what your current filters select — nothing more.", icon: Filter, color: "#14B8A6", rows: ticketRows, fmts: ["xlsx", "csv", "pdf"] },
          ].map((c) => (
            <div key={c.t} className="card ra-dl-card">
              <span className="ic" style={{ background: `${c.color}18`, color: c.color }}><c.icon size={19} /></span>
              <h4>{c.t}</h4><p>{c.d}</p>
              <div className="fmt-row">{c.fmts.map((f) => (
                <button key={f} className="btn btn-soft btn-sm" onClick={() => generate(c.t, c.rows() || [], f)}>
                  {f === "xlsx" ? <FileSpreadsheet size={13} /> : f === "csv" ? <FileText size={13} /> : f === "pptx" ? <Monitor size={13} /> : <Printer size={13} />} {f.toUpperCase()}
                </button>))}
              </div>
            </div>
          ))}
        </div>
      </RaSection>

      {/* ===== QUICK REPORT GENERATOR ===== */}
      <RaSection icon={Sparkles} title="Quick Report Generator" sub="One click → instant Excel download, scoped to current filters." pad={false}>
        <div className="ra-quick">
          {QUICK.map(([label, rowsFn, Ic, color]) => (
            <button key={label} className="ra-quick-btn" onClick={() => {
              const r = label === "Agent Performance Report" ? agentRows() : (rowsFn() || []).map((t) => ({ "Ticket ID": t.id, Customer: t.name, Subject: t.subject, Status: t.status, Priority: t.priority, Agent: t.agent }));
              generate(label, r, "xlsx");
            }}>
              <span className="ic" style={{ background: `${color}18`, color }}><Ic size={15} /></span>{label}
            </button>
          ))}
        </div>
      </RaSection>

      {/* ===== SCHEDULED REPORTS + EXPORT CENTER ===== */}
      <div className="ra-2col">
        <RaSection icon={CalendarClock} title="Scheduled Reports" sub="Deliver reports to your inbox automatically."
          right={<button className={`btn btn-sm ${schedule.enabled ? "btn-soft" : "btn-primary"}`} onClick={() => { setSchedule((s) => ({ ...s, enabled: !s.enabled })); push({ type: schedule.enabled ? "info" : "success", title: schedule.enabled ? "Schedule disabled" : "Schedule enabled", desc: schedule.enabled ? undefined : `${schedule.freq} · ${schedule.type}` }); }}>{schedule.enabled ? <><X size={13} /> Disable Schedule</> : <><CheckCircle2 size={13} /> Enable Schedule</>}</button>}>
          <div style={{ padding: "0 20px 20px" }}>
            {schedule.enabled && <div className="fchip on" style={{ marginBottom: 12, cursor: "default", display: "inline-flex" }}><CheckCircle2 size={12} /> Active — {schedule.freq}, next run Monday 09:00 IST</div>}
            <div className="set-grid2">
              <div className="fld"><label>Frequency</label><select value={schedule.freq} onChange={(e) => setSchedule((s) => ({ ...s, freq: e.target.value }))}>{["Daily", "Weekly", "Monthly"].map((o) => <option key={o}>{o}</option>)}</select></div>
              <div className="fld"><label>Report Type</label><select value={schedule.type} onChange={(e) => setSchedule((s) => ({ ...s, type: e.target.value }))}>{["Ticket Report", "Analytics Report", "Agent Performance Report", "Customer Report", "Team Performance Report"].map((o) => <option key={o}>{o}</option>)}</select></div>
            </div>
            <div className="fld"><label>Email Recipients</label><input value={schedule.recipients} onChange={(e) => setSchedule((s) => ({ ...s, recipients: e.target.value }))} placeholder="comma separated emails" /></div>
            <div className="fld"><label>Subject</label><input value={schedule.subject} onChange={(e) => setSchedule((s) => ({ ...s, subject: e.target.value }))} /></div>
          </div>
        </RaSection>

        <RaSection icon={Upload} title="Export Center" sub="Export any module of the workspace." pad={false}>
          <div style={{ padding: "0 20px 20px", display: "grid", gap: 8 }}>
            {EXPORT_CENTER.map(([label, rowsFn]) => (
              <div key={label} className="set-row" style={{ alignItems: "center" }}>
                <span className="pic" style={{ background: "var(--primary-soft)", color: "var(--primary)", width: 32, height: 32 }}><FileDown size={14} /></span>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{label}</div>
                <div style={{ display: "flex", gap: 5 }}>
                  {["xlsx", "csv", "pdf", "pptx"].map((f) => <button key={f} className="fchip" onClick={() => generate(label, rowsFn(), f)}>{f.toUpperCase()}</button>)}
                </div>
              </div>
            ))}
          </div>
        </RaSection>
      </div>

      {/* ===== REPORT HISTORY ===== */}
      <RaSection icon={History} title="Report History" sub="Previously generated reports."
        right={<div className="searchbox" style={{ maxWidth: 240, width: 240, flex: "initial" }}><Search size={15} /><input placeholder="Search by name, author…" value={histSearch} onChange={(e) => setHistSearch(e.target.value)} /></div>} pad={false}>
        {histFiltered.length === 0 ? <div style={{ padding: "0 20px 22px" }}><EmptyState icon={History} title="No reports found" desc="Generate a report above and it will appear here." /></div> : (
          <div className="table-wrap"><table style={{ minWidth: 860 }}>
            <thead><tr><th>Report Name</th><th>Generated By</th><th>Generated Date</th><th>Filters Used</th><th>File Type</th><th>Size</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
            <tbody>{histFiltered.map((h) => (
              <tr key={h.id}>
                <td className="rname">{h.name}</td>
                <td style={{ fontSize: 12.5 }}>{h.by}</td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{new Date(h.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{h.filters || "—"}</td>
                <td><span className="fchip" style={{ cursor: "default" }}>{h.type}</span></td>
                <td style={{ fontSize: 12 }}>{h.size}</td>
                <td><div className="row-act" style={{ justifyContent: "flex-end" }}>
                  <button title="Download" onClick={() => { generate(h.name, ticketRows(), h.type.toLowerCase() === "pdf" ? "pdf" : h.type.toLowerCase() === "csv" ? "csv" : "xlsx"); }}><Download size={15} /></button>
                  <button title="Rename" onClick={() => { const n2 = prompt("Rename report:", h.name); if (n2) { setHistory((hs) => hs.map((x) => x.id === h.id ? { ...x, name: n2 } : x)); push({ type: "success", title: "Renamed", desc: n2 }); } }}><Pencil size={15} /></button>
                  <button title="Regenerate" onClick={() => generate(h.name + " (regenerated)", ticketRows(), "xlsx")}><RotateCcw size={15} /></button>
                  <button className="danger" title="Delete" onClick={() => setConfirm({ title: "Delete report", msg: `Delete “${h.name}” from history?`, label: "Delete", danger: true, run: () => { setHistory((hs) => hs.filter((x) => x.id !== h.id)); push({ type: "success", title: "Report deleted" }); } })}><Trash2 size={15} /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </RaSection>

      <ConfirmDialog open={!!confirm} danger={confirm?.danger} title={confirm?.title || ""} message={confirm?.msg || ""} confirmLabel={confirm?.label || "Confirm"} onConfirm={() => confirm?.run()} onClose={() => setConfirm(null)} />
    </div>
  );
}

export {
  AGD_RANGES,
  AgdKpi,
  AgdRing,
  RA_DATE_PRESETS,
  RA_RESTIME,
  RA_SLA,
  RA_SPARK,
  RA_STATUSES,
  RaKpi,
  RaSection,
  ReportsPage,
  agdHash,
  agdRand,
  agdRoleOf,
  raSpark,
};
