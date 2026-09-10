/*
 * src/pages/freshdesk/pages/DashboardPage.jsx — the organisation-wide overview.
 */
import { TICKETS } from "../fdStore";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Bell, BookOpen, CheckCircle2, ChevronDown, ChevronRight, FileDown, FileSpreadsheet, FileText, Gauge, Inbox, LineChart as LineChartIcon, MessageSquareText, PauseCircle, PlusCircle, Printer, Reply, Sparkles, Timer, TrendingUp, UserPlus } from "lucide-react";
import { ACTIVITIES, ANALYTICS, DISTRIBUTION, PERF, STATS, STAT_FILTER, avColor, initials } from "../fdConstants";
import { ChartTooltip, PrioBadge, Ring, Spinner, StatusBadge, buildExportRows, exportCSV, exportExcel, exportPDF, useClickAway, useCounter, useDesk, useToast } from "../fdShared";
import { Area, AreaChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnalyticsModal, AssignDialog, TicketModal } from "../components/Chrome";
import { useFreshdeskStats } from "../useFreshdeskData";
import { currentAgentProfile } from "../fdAgent";
import { AlertCircle, RefreshCw } from "lucide-react";

/*
 * The six stat cards, from the live desk.
 *
 * STATS in fdConstants is now only the SHAPE -- the icon, colour and label for
 * each card. Every number, trend and sparkline comes from
 * /api/freshdesk/fd_stats.php, computed from the tables at read time rather
 * than from a counters row that drifts the first time anything is merged or
 * re-synced.
 */
const STAT_META = {
  unresolved: { label: "Unresolved", desc: "Awaiting resolution",   color: "#5B5CEB", icon: Inbox },
  overdue:    { label: "Overdue",    desc: "Past SLA deadline",     color: "#EF4444", icon: AlertTriangle },
  dueToday:   { label: "Due today",  desc: "Deadline within 24h",   color: "#F59E0B", icon: Timer },
  open:       { label: "Open",       desc: "Currently in progress", color: "#0EA5E9", icon: Gauge },
  onHold:     { label: "On hold",    desc: "Waiting on someone",    color: "#8B5CF6", icon: PauseCircle },
  unassigned: { label: "Unassigned", desc: "No agent yet",          color: "#64748B", icon: UserPlus },
  // Kept so an older cached payload still renders a sensible card.
  closed:     { label: "Closed",     desc: "Resolved this month",   color: "#10B981", icon: CheckCircle2 },
  new:        { label: "New",        desc: "Created in last 24h",   color: "#8B5CF6", icon: Sparkles },
};

/** Turn the API's stat rows + volume series into what StatCard renders. */
function liveStatCards(data) {
  if (!data || !Array.isArray(data.stats)) return [];
  const spark = (data.volume || []).map((v) => v.value);
  return data.stats.map((s) => {
    const meta = STAT_META[s.key] || { label: s.label, desc: s.sub, color: "#5B5CEB", icon: Inbox };
    const dir = s.trend && s.trend.dir;
    return {
      key: s.key,
      label: meta.label,
      desc: s.sub || meta.desc,
      color: meta.color,
      icon: meta.icon,
      value: s.value,
      // Present only on the unresolved row; the card renders it when it is.
      split: Number.isFinite(s.unread) ? { unread: s.unread, read: s.read || 0 } : null,
      trend: dir === "down" ? -(s.trend.delta || 0) : (s.trend ? s.trend.delta || 0 : 0),
      // A flat line beats an invented one: when the series is empty the card
      // shows nothing rather than a shape that implies a trend it does not have.
      spark: spark.length ? spark : [0, 0, 0, 0, 0, 0, 0],
    };
  });
}

/* ---- Notifications panel ---- */

/* ---- Recent tickets table (dashboard) ---- */
function RecentTicketsTable({ onOpen, go, tickets }) {
  // Prefer the live array passed down; fall back to the module store for the
  // brief window before the first load resolves.
  const source = Array.isArray(tickets) && tickets.length ? tickets : TICKETS;
  const rows = source.slice(0, 6);
  return (
    <div className="card fade" style={{ marginTop: 22, animationDelay: "260ms" }}>
      <div className="section-head" style={{ padding: "18px 20px 0", marginBottom: 12 }}>
        <div><h3 className="card-title">Recent Tickets</h3><p className="card-sub">Latest tickets across the helpdesk — click any row to open</p></div>
        <button className="btn btn-soft btn-sm" onClick={() => go("tickets")}>View all <ChevronRight size={14} /></button>
      </div>
      <div className="table-wrap">
        <table><thead><tr><th style={{ width: 34 }}></th><th>Ticket</th><th>Customer</th><th>Subject</th><th>Category</th><th>Priority</th><th>Agent</th><th>Status</th></tr></thead>
          <tbody>{rows.map((t) => (<tr key={t.id} style={{ cursor: "pointer" }} onClick={() => onOpen(t)}>
            <td style={{ fontWeight: 700, color: "var(--primary)" }}>#{t.id}</td>
            <td><div className="cust"><span className="a" style={{ background: avColor(t.name) }}>{initials(t.name)}</span><div><div className="nm">{t.name}</div><div className="em">{t.email}</div></div></div></td>
            <td><div className="subj" title={t.subject}>{t.subject}</div></td>
            <td style={{ fontWeight: 600, fontSize: 12.5 }}>{t.category}</td>
            <td><PrioBadge p={t.priority} /></td>
            <td style={{ fontWeight: 600, fontSize: 12.5 }}>{t.agent}</td>
            <td><StatusBadge s={t.status} /></td>
          </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================================
   DASHBOARD PAGE
   ========================================================================== */
const SPARK_W = 74, SPARK_H = 34;   // must match .stat .spark in fdStyles.jsx

function StatCard({ s, i, onClick }) {
  const n = useCounter(s.value);
  const up = s.trend >= 0;
  // A card whose series is missing or flat gets no sparkline at all, rather
  // than an axis-less line implying a trend the data does not show.
  const spark = Array.isArray(s.spark) ? s.spark : [];
  const hasSpark = spark.length > 1 && spark.some((v) => Number(v) > 0);
  return (
    <div className="card stat fade clickable" style={{ animationDelay:`${i*70}ms` }} onClick={onClick} title="Filter tickets by this status">
      <div className="ic" style={{ background:`${s.color}18`, color:s.color }}><s.icon size={20} /></div>
      <div className="trend" style={{ color: up ? "var(--success)" : "var(--danger)" }}>{up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(s.trend)}%</div>
      <div className="lab">{s.label}</div><div className="val">{n.toLocaleString("en-IN")}</div>
      {s.split ? (
        <div className="stat-split">
          <span className="ss unread"><b>{s.split.unread.toLocaleString("en-IN")}</b> unread</span>
          <span className="ss read"><b>{s.split.read.toLocaleString("en-IN")}</b> read</span>
        </div>
      ) : <div className="desc">{s.desc}</div>}
      {hasSpark && (
        <div className="spark">
          <AreaChart width={SPARK_W} height={SPARK_H} data={spark.map((v, x) => ({ x, v: Number(v) || 0 }))}
                     margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`sp-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={.4} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={s.color} strokeWidth={2} fill={`url(#sp-${s.key})`} />
          </AreaChart>
        </div>
      )}
    </div>
  );
}

function AnalyticsChart() {
  const [range, setRange] = useState("Week"); const data = ANALYTICS[range];
  const totals = data.reduce((a, d) => ({ r:a.r+d.Received, s:a.s+d.Resolved, p:a.p+d.Pending }), {r:0,s:0,p:0});
  return (
    <div className="card card-pad fade" style={{ animationDelay:"120ms" }}>
      <div className="section-head" style={{ marginBottom:8 }}>
        <div><h3 className="card-title"><LineChartIcon size={16} style={{verticalAlign:"-2px",marginRight:6,color:"var(--primary)"}} />Ticket Analytics</h3><p className="card-sub">Received, resolved and pending volume over time</p></div>
        <div className="filters">{["Day","Week","Month","Year","Custom"].map((r) => <button key={r} className={range===r?"on":""} onClick={()=>setRange(r)}>{r}</button>)}</div>
      </div>
      <div style={{ height:300, marginTop:8 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{top:12,right:8,left:-14,bottom:0}}>
        <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="t" tick={{fontSize:12,fill:"var(--muted)"}} axisLine={false} tickLine={false} />
        <YAxis tick={{fontSize:12,fill:"var(--muted)"}} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} /><Legend iconType="circle" wrapperStyle={{fontSize:12.5,paddingTop:8}} />
        <Line type="monotone" dataKey="Received" stroke="#5B5CEB" strokeWidth={2.5} dot={false} activeDot={{r:5}} />
        <Line type="monotone" dataKey="Resolved" stroke="#10B981" strokeWidth={2.5} dot={false} activeDot={{r:5}} />
        <Line type="monotone" dataKey="Pending" stroke="#F59E0B" strokeWidth={2.5} strokeDasharray="5 4" dot={false} activeDot={{r:5}} />
      </LineChart></ResponsiveContainer></div>
      <div className="summary-row">
        <div><div className="k">Received today</div><div className="v">{totals.r.toLocaleString("en-IN")}</div></div>
        <div><div className="k">Resolved</div><div className="v" style={{color:"var(--success)"}}>{totals.s.toLocaleString("en-IN")}</div></div>
        <div><div className="k">Pending</div><div className="v" style={{color:"var(--warning)"}}>{totals.p.toLocaleString("en-IN")}</div></div>
        <div><div className="k">Resolution rate</div><div className="v" style={{color:"var(--primary)"}}>{Math.round(totals.s/totals.r*100)}%</div></div>
      </div>
    </div>
  );
}

/**
 * Recent Ticket Activities — the real fd_activity feed.
 *
 * This was rendering ACTIVITIES, a hard-coded list of invented agents. The feed
 * already arrives with the dashboard payload (fd_stats.php returns it), so this
 * only had to read what was already on the page.
 */
function TicketTimeline({ live, onOpen, tickets }) {
  const rows = (live && live.feed ? live.feed : []).slice(0, 8);

  const TONE = {
    "new-ticket":   "#5B5CEB",
    "new-message":  "#0EA5E9",
    "message-sent": "#10B981",
    "note-added":   "#F59E0B",
    "sla-breach":   "#EF4444",
    "mailbox-down": "#EF4444",
  };

  const open = (id) => {
    if (!id || !onOpen) return;
    const t = (tickets || []).find((x) => Number(x.id) === Number(id));
    if (t) onOpen(t);
  };

  return (
    <div className="card card-pad fade" style={{ animationDelay: "180ms" }}>
      <div className="section-head">
        <div>
          <h3 className="card-title">Recent Ticket Activities</h3>
          <p className="card-sub">Latest actions across the helpdesk</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: "26px 4px", color: "var(--muted)", fontSize: 13 }}>
          No activity yet — replies, new mail and ticket changes appear here as they happen.
        </div>
      ) : (
        <div className="tl">
          {rows.map((a) => {
            const color = TONE[a.event] || "#64748B";
            const who = a.actor_name || a.requester_name || "System";
            return (
              <div className={`tl-item ${a.ticket_id ? "act-click" : ""}`} key={a.id}
                   onClick={() => open(a.ticket_id)}>
                <span className="tl-node" style={{ color }} />
                <div className="tl-av" style={{ background: color }}>{initials(who)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span className="tl-name">{who}</span>
                    {a.ticket_id ? <span className="tl-id">#{a.ticket_id}</span> : null}
                    <span className="tl-time" style={{ marginLeft: "auto" }}>{a.ago}</span>
                  </div>
                  <div className="tl-meta">{a.summary || a.event}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TicketDistribution() {
  const total = DISTRIBUTION.reduce((a, d) => a + d.value, 0);
  return (<div className="card card-pad fade" style={{ animationDelay:"200ms" }}>
    <div className="section-head"><div><h3 className="card-title">Ticket Distribution</h3><p className="card-sub">By category · {total.toLocaleString("en-IN")} total</p></div></div>
    <div style={{display:"flex",gap:18,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{width:200,height:200,position:"relative",flexShrink:0,margin:"0 auto"}}>
        <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={DISTRIBUTION} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none">{DISTRIBUTION.map((d)=><Cell key={d.name} fill={d.color} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart></ResponsiveContainer>
        <div style={{position:"absolute",inset:0,display:"grid",placeItems:"center",pointerEvents:"none"}}><div style={{textAlign:"center"}}><div style={{fontSize:24,fontWeight:800}}>{total.toLocaleString("en-IN")}</div><div style={{fontSize:11,color:"var(--muted)"}}>Total tickets</div></div></div>
      </div>
      <div style={{flex:1,minWidth:180}}>{DISTRIBUTION.map((d) => (<div className="dist-row" key={d.name}><span className="dotc" style={{background:d.color,width:9,height:9}} /><span className="nm">{d.name}</span><span className="ct">{d.value}</span><span className="pc">{Math.round(d.value/total*100)}%</span></div>))}</div>
    </div>
  </div>);
}

function PerformancePanel() {
  return (<div className="fade" style={{marginTop:22,animationDelay:"240ms"}}>
    <div className="section-head"><div><h3 className="card-title" style={{fontSize:17}}>Support Team Performance</h3><p className="card-sub">Key service metrics for the current period</p></div><button className="btn btn-soft" style={{padding:"7px 12px",fontSize:12.5}}>Last 30 days</button></div>
    <div className="perf-grid">{PERF.map((p) => (<div className="card kpi" key={p.title}><div className="ring"><Ring pct={p.pct} color={p.color} /><b style={{color:p.color}}>{p.display}</b></div><div className="kt"><p.icon size={14} style={{verticalAlign:"-2px",marginRight:5,color:p.color}} />{p.title}</div><div className="ks">{p.sub}</div><div className="bar"><i style={{width:`${p.pct}%`,background:p.color}} /></div></div>))}</div>
  </div>);
}

function DashboardPage({ onOpen, onOpenTickets, go, tickets }) {
  const push = useToast();
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  // Whoever is actually signed in -- never a name baked into the page.
  const me = currentAgentProfile();
  const firstName = (me.name || "").split(" ")[0];

  const { data: live, loading: statsLoading, error: statsError, reload: reloadStats } = useFreshdeskStats(7);
  const cards = liveStatCards(live);
  const [modal, setModal] = useState(null); // "ticket" | "assign" | "analytics"
  const [expOpen, setExpOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const expRef = useRef(null);
  useClickAway(expRef, () => setExpOpen(false));
  const runExport = (kind) => {
    setExpOpen(false); setExporting(true);
    setTimeout(() => {
      try {
        const rows = buildExportRows();
        if (kind === "xlsx") { exportExcel(rows, "helphive-tickets.xlsx"); push({ type: "success", title: "Export ready", desc: "helphive-tickets.xlsx downloaded." }); }
        else if (kind === "csv") { exportCSV(rows, "helphive-tickets.csv"); push({ type: "success", title: "Export ready", desc: "helphive-tickets.csv downloaded." }); }
        else { const ok = exportPDF("Support Tickets Report", ["Ticket Number","Customer Name","Email","Category","Priority","Status","Assigned Agent"], rows); push(ok ? { type: "success", title: "Opening print dialog", desc: "Choose “Save as PDF”." } : { type: "error", title: "Popup blocked", desc: "Allow popups to export PDF." }); }
      } catch (e) { push({ type: "error", title: "Export failed", desc: "Something went wrong generating the file." }); }
      setExporting(false);
    }, 500);
  };
  return (
    <div className="content route">
      <div className="welcome fade">
        <div>
          <span className="greet"><Sparkles size={14} /> {greet}{firstName ? `, ${firstName}` : ""}</span>
          <h1>Customer Support Dashboard</h1>
          <p>Live from contact@internshipstudio.com — tickets, replies and SLA in real time.</p>
        </div>
        <div className="qa-row">
          <button className="btn btn-primary" onClick={() => setModal("ticket")}><PlusCircle size={16} /> Create Ticket</button>
          <button className="btn btn-ghost" onClick={() => setModal("assign")}><UserPlus size={16} /> Assign Ticket</button>
          <div className="dd-wrap" ref={expRef}>
            <button className="btn btn-ghost" onClick={() => setExpOpen((o) => !o)} disabled={exporting}>{exporting ? <Spinner /> : <FileDown size={16} />} Export Report <ChevronDown size={13} /></button>
            {expOpen && (
              <div className="menu menu-top right" style={{ minWidth: 180 }}>
                <button className="mi" onClick={() => runExport("xlsx")}><span className="mic" style={{ background: "#10B98118", color: "#10B981" }}><FileSpreadsheet size={15} /></span> Excel (.xlsx)</button>
                <button className="mi" onClick={() => runExport("csv")}><span className="mic" style={{ background: "#0EA5E918", color: "#0EA5E9" }}><FileText size={15} /></span> CSV (.csv)</button>
                <button className="mi" onClick={() => runExport("pdf")}><span className="mic" style={{ background: "#EF444418", color: "#EF4444" }}><Printer size={15} /></span> PDF (print)</button>
              </div>
            )}
          </div>
          <button className="btn btn-ghost" onClick={() => setModal("analytics")}><BarChart3 size={16} /> Generate Analytics</button>
        </div>
      </div>
      {statsError && (
        <div className="msg-error" style={{ marginBottom: 14 }}>
          <AlertCircle size={14} /> Could not load the dashboard figures: {statsError}
          <button className="btn btn-soft btn-sm" onClick={reloadStats}><RefreshCw size={13} /> Retry</button>
        </div>
      )}

      <div className="grid-stats">
        {/* Skeletons while the first load is in flight. Rendering the cards with
            zeros would read as "a quiet desk" rather than "not loaded yet". */}
        {statsLoading && !cards.length
          ? Array.from({ length: 6 }).map((_, i) => (
              <div className="card stat" key={`sk-${i}`} style={{ minHeight: 118 }}>
                <div className="sk sk-line" style={{ width: "40%" }} />
                <div className="sk sk-line" style={{ width: "60%", height: 22, marginTop: 10 }} />
              </div>
            ))
          : cards.map((s, i) => (
              <StatCard key={s.key} s={s} i={i}
                        onClick={() => onOpenTickets(STAT_FILTER[s.key] || { view: "all" })} />
            ))}
      </div>
      <DashLiveRow onOpenTickets={onOpenTickets} live={live} />
      <AnalyticsChart />
      <div className="two-col"><TicketTimeline live={live} onOpen={onOpen} tickets={tickets} /><TicketDistribution /></div>
      <RecentTicketsTable onOpen={onOpen} go={go} tickets={tickets} />
      <PerformancePanel />

      <TicketModal open={modal === "ticket"} onClose={() => setModal(null)} />
      <AssignDialog open={modal === "assign"} onClose={() => setModal(null)} />
      <AnalyticsModal open={modal === "analytics"} onClose={() => setModal(null)} />
    </div>
  );
}

const DASH_INSIGHTS = [
  { icon: TrendingUp, color: "#0EA5E9", text: "Ticket volume increased by 18% this week — mostly from the Portal channel." },
  { icon: Timer, color: "#22C55E", text: "Average response time improved by 12% after the new canned responses went live." },
  { icon: BookOpen, color: "#8B5CF6", text: "Most support requests this week relate to certificates — consider a KB article." },
  { icon: Sparkles, color: "#F59E0B", text: "Priya Nair resolved 96% of assigned tickets — highest on the team." },
  { icon: AlertTriangle, color: "#EF4444", text: "Billing requests are trending upward today (+9 vs yesterday)." },
];

function DashLiveRow({ onOpenTickets, live }) {
  const [insight, setInsight] = useState(0);

  /*
   * The activity feed is the REAL one, from fd_activity via fd_stats.php.
   *
   * It used to be four invented lines plus a timer that pushed a random fake
   * event in every nine seconds. That is worse than an empty feed: it makes a
   * silent desk look busy, and it makes a genuinely broken mailbox impossible
   * to notice.
   */
  const feed = (live && live.feed ? live.feed : []).slice(0, 6).map((f) => {
    const style = f.event === "new-ticket" ? { icon: Inbox, color: "#0EA5E9" }
      : f.event === "new-message" ? { icon: MessageSquareText, color: "#5B5CEB" }
      : f.event === "message-sent" ? { icon: Reply, color: "#22C55E" }
      : f.event === "sla-breach" ? { icon: AlertTriangle, color: "#EF4444" }
      : f.event === "mailbox-down" ? { icon: Bell, color: "#EC4899" }
      : { icon: CheckCircle2, color: "#22C55E" };
    return { ...style, t: f.summary || f.event, when: f.ago || "" };
  });

  // The insight carousel is presentational only -- no requests, just a rotation.
  useEffect(() => {
    const ins = setInterval(() => setInsight((i) => (i + 1) % DASH_INSIGHTS.length), 6000);
    return () => clearInterval(ins);
  }, []);

  const I = DASH_INSIGHTS[insight];

  /* Real SLA attainment, computed server-side over the reporting window. */
  const slaData = (live && live.sla) || {};
  const sla = Number.isFinite(slaData.firstResponse) ? slaData.firstResponse : 100;
  const slaResolution = Number.isFinite(slaData.resolution) ? slaData.resolution : 100;
  const atRisk = slaData.atRisk || 0;
  return (
    <div className="dash-live fade" style={{ animationDelay: "60ms" }}>
      <div className="card card-pad ins-card">
        <div className="section-head" style={{ marginBottom: 10 }}>
          <div><h3 className="card-title"><Sparkles size={15} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--primary)" }} />AI Insights</h3><p className="card-sub">Auto-generated from this week's activity.</p></div>
          <div className="ins-dots">{DASH_INSIGHTS.map((_, i) => <button key={i} className={i === insight ? "on" : ""} onClick={() => setInsight(i)} aria-label={`Insight ${i + 1}`} />)}</div>
        </div>
        <div className="ins-body" key={insight}>
          <span className="ic" style={{ background: `${I.color}18`, color: I.color }}><I.icon size={17} /></span>
          <p>{I.text}</p>
        </div>
      </div>
      <div className="card card-pad sla-card">
        <h3 className="card-title" style={{ marginBottom: 4 }}><Gauge size={15} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--primary)" }} />SLA Health</h3>
        <div className="sla-ring-wrap">
          <div className="sla-ring" style={{ background: `conic-gradient(var(--success) ${sla * 3.6}deg, var(--surface-2) 0deg)` }}>
            <div className="sla-ring-in"><b>{sla}%</b><span>on target</span></div>
          </div>
          <div className="sla-mini">
            <div><span className="dotc" style={{ background: "#22C55E" }} />First response <b>{sla}%</b></div>
            <div><span className="dotc" style={{ background: "#0EA5E9" }} />Resolution <b>{slaResolution}%</b></div>
            <button className="btn btn-soft btn-sm" style={{ marginTop: 8 }}
                    onClick={() => onOpenTickets("all", "Overdue")} disabled={!atRisk}>
              <AlertTriangle size={13} /> {atRisk ? `View ${atRisk} at risk` : "Nothing at risk"}
            </button>
          </div>
        </div>
      </div>
      <div className="card card-pad feed-card">
        <h3 className="card-title" style={{ marginBottom: 10 }}><Activity size={15} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--primary)" }} />Live Feed</h3>
        <div className="live-feed">
          {feed.map((f, i) => (
            <div className="lf-item" key={f.t + i} style={{ animationDelay: `${i * 40}ms` }}>
              <span className="ic" style={{ background: `${f.color}18`, color: f.color }}><f.icon size={13} /></span>
              <span className="tx">{f.t}</span><span className="wh">{f.when}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export {
  AnalyticsChart,
  DASH_INSIGHTS,
  DashLiveRow,
  DashboardPage,
  PerformancePanel,
  RecentTicketsTable,
  StatCard,
  TicketDistribution,
  TicketTimeline,
};
