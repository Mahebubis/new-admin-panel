/*
 * src/pages/freshdesk/pages/CustomersPage.jsx — the customer directory, derived
 * from the tickets people have raised.
 */
import { AGENTS, CUST_EMPTY, CUST_SORTS, TICKET_CATS, avColor, initials, statusStyle } from "../fdConstants";
import { Activity, ArrowUpDown, AtSign, BadgeCheck, CalendarDays, CheckCheck, ChevronDown, ChevronRight, Clock, Eye, FileSpreadsheet, Filter, GraduationCap, LayoutGrid, Lock, LogIn, Mail, MessageCircle, Phone, PhoneCall, PlusCircle, Reply, RotateCcw, Rows3, Search, Send, SlidersHorizontal, Ticket, UserCheck, UserPlus, Users, X } from "lucide-react";
import { ChartTooltip, EmptyState, exportExcel, Portal, PrioBadge, StatusBadge, useClickAway, useToast } from "../fdShared";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildCustomers } from "../fdStore";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { EmailComposeModal } from "../components/Chrome";

function CustomerCard({ c, i, onProfile, onEmail }) {
  const st = statusStyle(c.activeStatus);
  return (
    <div className="card ccard" style={{ animationDelay: `${i * 45}ms` }}>
      <div className="ccard-top">
        <span className="cav" style={{ background: avColor(c.name) }}>{initials(c.name)}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="nm" onClick={() => onProfile(c)}>{c.name}{c.registered && <BadgeCheck size={15} color="var(--success)" style={{ verticalAlign: "-2px", marginLeft: 5 }} />}</div>
          <div className="cid">{c.cid}</div>
        </div>
        <span className="badge-pill" style={{ background: st.bg, color: st.fg }}>{c.activeStatus}</span>
      </div>
      <div className="cmini">
        <div className="b"><div className="v">{c.total}</div><div className="l">Total</div></div>
        <div className="b"><div className="v" style={{ color: "var(--accent)" }}>{c.open}</div><div className="l">Open</div></div>
        <div className="b"><div className="v" style={{ color: "var(--success)" }}>{c.closed}</div><div className="l">Closed</div></div>
      </div>
      <div className="ccard-info">
        <div className="r"><AtSign size={14} /><span>{c.email}</span></div>
        <div className="r"><PhoneCall size={14} /><span>{c.phone}</span></div>
        <div className="r"><GraduationCap size={14} /><span>{c.college}</span></div>
        <div className="r"><UserCheck size={14} /><span>{c.agent}</span></div>
        <div className="r"><Clock size={14} /><span>Last ticket {c.lastTicketDate} · active {c.lastActivity}</span></div>
      </div>
      <div className="tactions" style={{ paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <button onClick={() => onProfile(c)}><Eye size={14} /> Profile</button>
        <button onClick={() => onProfile(c)}><Ticket size={14} /> Tickets</button>
        <button onClick={() => onEmail(c)}><Mail size={14} /> Email</button>
        {/* Most people who email support never give a phone number. */}
        {c.phone && (
          <a href={`tel:${String(c.phone).replace(/[^\d+]/g, "")}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 11px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}><Phone size={14} /> Call</a>
        )}
      </div>
    </div>
  );
}

function CustomerTable({ rows, onProfile }) {
  return (
    <div className="card"><div className="table-wrap"><table style={{ minWidth: 900 }}>
      <thead><tr><th>Customer</th><th>Customer ID</th><th>Phone</th><th>Total</th><th>Open</th><th>Closed</th><th>Last Ticket</th><th>Agent</th><th>Status</th></tr></thead>
      <tbody>{rows.map((c) => (<tr key={c.cid} style={{ cursor: "pointer" }} onClick={() => onProfile(c)}>
        <td><div className="cust"><span className="a" style={{ background: avColor(c.name) }}>{initials(c.name)}</span><div><div className="nm">{c.name}</div><div className="em">{c.email}</div></div></div></td>
        <td style={{ fontWeight: 600, fontSize: 12.5 }}>{c.cid}</td>
        <td style={{ fontSize: 12.5, color: "var(--muted)" }}>{c.phone}</td>
        <td style={{ fontWeight: 700 }}>{c.total}</td>
        <td style={{ color: "var(--accent)", fontWeight: 700 }}>{c.open}</td>
        <td style={{ color: "var(--success)", fontWeight: 700 }}>{c.closed}</td>
        <td style={{ fontSize: 12.5, color: "var(--muted)" }}>{c.lastTicketDate}</td>
        <td style={{ fontSize: 12.5, fontWeight: 600 }}>{c.agent}</td>
        <td><StatusBadge s={c.activeStatus} /></td>
      </tr>))}</tbody>
    </table></div></div>
  );
}

function CustSort({ value, onChange }) {
  const [open, setOpen] = useState(false); const ref = useRef(null);
  useClickAway(ref, () => setOpen(false));
  return (
    <div className="dd-wrap" ref={ref}>
      <button className="btn btn-ghost" onClick={() => setOpen((o) => !o)}><ArrowUpDown size={15} /> Sort: <b style={{ color: "var(--primary)" }}>{value}</b> <ChevronDown size={14} /></button>
      {open && <div className="menu menu-top left" style={{ minWidth: 210 }}>{CUST_SORTS.map((so) => <button key={so} className="mi" style={{ padding: "9px 11px" }} onClick={() => { onChange(so); setOpen(false); }}>{so}{value === so && <CheckCheck size={14} style={{ marginLeft: "auto" }} />}</button>)}</div>}
    </div>
  );
}

function CustFilterDrawer({ open, onClose, draft, setDraft, onApply, onReset }) {
  if (!open) return null;
  return <Portal>{<CustFilterDrawerBody onClose={onClose} draft={draft} setDraft={setDraft} onApply={onApply} onReset={onReset} />}</Portal>;
}

function CustFilterDrawerBody({ onClose, draft, setDraft, onApply, onReset }) {
  const toggle = (key, val) => setDraft((d) => { const a = d[key]; return { ...d, [key]: a.includes(val) ? a.filter((x) => x !== val) : [...a, val] }; });
  const Multi = ({ label, k, opts }) => (<div className="fld"><label>{label}</label><div className="chips">{opts.map((o) => <button key={o} className={`fchip ${draft[k].includes(o) ? "on" : ""}`} onClick={() => toggle(k, o)}>{o}</button>)}</div></div>);
  return (<>
    <div className="drawer-overlay" onClick={onClose} />
    <div className="drawer">
      <div className="drawer-head"><h3 className="card-title"><SlidersHorizontal size={16} style={{ verticalAlign: "-3px", marginRight: 7, color: "var(--primary)" }} />Filter Customers</h3><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
      <div className="drawer-body">
        <Multi label="Ticket Status" k="status" opts={["New", "Open", "Pending", "Overdue", "Resolved", "Closed"]} />
        <Multi label="Ticket Category" k="category" opts={TICKET_CATS} />
        <Multi label="Priority" k="priority" opts={["Low", "Medium", "High", "Critical"]} />
        <div className="fld"><label>Assigned Agent</label><select value={draft.agent} onChange={(e) => setDraft((d) => ({ ...d, agent: e.target.value }))}><option value="">Any agent</option>{AGENTS.map((a) => <option key={a}>{a}</option>)}</select></div>
        <div className="grid2">
          <div className="fld"><label>From date</label><input type="date" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} /></div>
          <div className="fld"><label>To date</label><input type="date" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} /></div>
        </div>
      </div>
      <div className="drawer-foot"><button className="btn btn-soft" style={{ flex: 1, justifyContent: "center" }} onClick={onReset}><RotateCcw size={15} /> Reset</button><button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={onApply}><CheckCheck size={15} /> Apply</button></div>
    </div>
  </>);
}

function CustomersPage({ onProfile, onOpenTicket, tickets }) {
  /*
   * The directory is a VIEW over the tickets, not a separate data source, so it
   * is rebuilt whenever the live ticket set changes.
   *
   * `tickets` is in the dependency list purely as the change signal --
   * buildCustomers() reads the module-level store rather than this argument, so
   * the linter sees the dependency as unused. It is not: without it the
   * directory would be built once from an empty store and never again.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const CUSTOMERS = useMemo(() => buildCustomers(), [tickets]);
  const push = useToast();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("Customer Name");
  const [layout, setLayout] = useState("card");
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [draft, setDraft] = useState(CUST_EMPTY);
  const [applied, setApplied] = useState(CUST_EMPTY);
  const [emailTo, setEmailTo] = useState(null);
  useEffect(() => { setLoading(true); const t = setTimeout(() => setLoading(false), 700); return () => clearTimeout(t); }, []);

  const activeFilters = applied.status.length + applied.category.length + applied.priority.length + (applied.agent ? 1 : 0) + (applied.from ? 1 : 0) + (applied.to ? 1 : 0);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    let r = CUSTOMERS.filter((c) => {
      // Any of these can be null on a contact we only know an address for.
      if (term && ![c.name, c.email, c.phone, c.cid, ...(c.history || []).map((t) => String(t.id))]
            .filter(Boolean).join(" ").toLowerCase().includes(term)) return false;
      if (applied.agent && c.agent !== applied.agent && !c.history.some((t) => t.agent === applied.agent)) return false;
      if (applied.status.length && !c.history.some((t) => applied.status.includes(t.status))) return false;
      if (applied.category.length && !c.history.some((t) => applied.category.includes(t.category))) return false;
      if (applied.priority.length && !c.history.some((t) => applied.priority.includes(t.priority))) return false;
      return true;
    });
    const cmp = {
      "Customer Name": (a, b) => a.name.localeCompare(b.name),
      "Total Tickets Raised": (a, b) => b.total - a.total,
      "Most Recent Ticket": (a, b) => a.lastActivitySort - b.lastActivitySort,
      "Oldest Customer": (a, b) => a.regSort - b.regSort,
      "Last Activity": (a, b) => a.lastActivitySort - b.lastActivitySort,
      "Highest Priority Tickets": (a, b) => b.prioRank - a.prioRank,
    }[sort];
    return [...r].sort(cmp);
    // CUSTOMERS belongs here: it is rebuilt when new mail arrives, and without
    // it the visible list kept showing the previous directory until the agent
    // happened to change a filter.
  }, [CUSTOMERS, q, applied, sort]);

  const doExport = () => {
    try {
      const data = CUSTOMERS.map((c) => ({ "Customer ID": c.cid, "Name": c.name, "Email": c.email, "Phone": c.phone, "College": c.college, "Total Tickets": c.total, "Open": c.open, "Closed": c.closed, "Pending": c.pending, "Resolved": c.resolved, "Assigned Agent": c.agent, "Last Ticket": c.lastTicketDate, "CSAT": c.csat + "%" }));
      exportExcel(data, "helphive-customers.xlsx");
      push({ type: "success", title: "Export ready", desc: "helphive-customers.xlsx downloaded." });
    } catch (e) { push({ type: "error", title: "Export failed", desc: "Could not generate the file." }); }
  };

  return (
    <div className="content route">
      <div className="page-head">
        <div><h1>Customers <span className="count-badge">{CUSTOMERS.length} total</span></h1><p>View and manage customers who have raised support tickets.</p></div>
        <button className="btn btn-soft" onClick={doExport}><FileSpreadsheet size={15} /> Export Customers</button>
      </div>

      <div className="toolbar">
        <div className="searchbox" style={{ maxWidth: 300, flex: "initial", width: 300 }}><Search size={16} /><input placeholder="Search name, email, phone, ID, ticket #…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <CustSort value={sort} onChange={setSort} />
        <button className="btn btn-ghost" onClick={() => { setDraft(applied); setDrawer(true); }}><Filter size={15} /> Filters{activeFilters > 0 && <span className="count-badge" style={{ fontSize: 11, padding: "1px 8px" }}>{activeFilters}</span>}</button>
        <div className="seg" style={{ marginLeft: "auto" }}>
          <button className={layout === "card" ? "on" : ""} onClick={() => setLayout("card")}><LayoutGrid size={15} /> Card</button>
          <button className={layout === "table" ? "on" : ""} onClick={() => setLayout("table")}><Rows3 size={15} /> Table</button>
        </div>
      </div>

      {loading ? (
        <div className="cust-grid">{Array.from({ length: 6 }).map((_, i) => (<div key={i} className="card sk-card"><div style={{ display: "flex", gap: 13 }}><div className="sk" style={{ width: 48, height: 48, borderRadius: 14 }} /><div style={{ flex: 1 }}><div className="sk" style={{ height: 14, width: "60%", marginBottom: 8 }} /><div className="sk" style={{ height: 11, width: "40%" }} /></div></div><div className="sk" style={{ height: 54, borderRadius: 11 }} /><div className="sk" style={{ height: 60 }} /></div>))}</div>
      ) : rows.length === 0 ? (
        <div className="card"><EmptyState icon={Users} title="No customers found" desc="No customers match your search or filters. Try adjusting them." action="Clear filters" onAction={() => { setQ(""); setApplied(CUST_EMPTY); }} /></div>
      ) : layout === "card" ? (
        <div className="cust-grid">{rows.map((c, i) => <CustomerCard key={c.cid} c={c} i={i} onProfile={onProfile} onEmail={(x) => setEmailTo(x.email)} />)}</div>
      ) : <CustomerTable rows={rows} onProfile={onProfile} />}

      <CustFilterDrawer open={drawer} onClose={() => setDrawer(false)} draft={draft} setDraft={setDraft} onApply={() => { setApplied(draft); setDrawer(false); }} onReset={() => { setDraft(CUST_EMPTY); setApplied(CUST_EMPTY); }} />
      <EmailComposeModal key={emailTo || "none"} open={!!emailTo} to={emailTo || ""} onClose={() => setEmailTo(null)} />
    </div>
  );
}

/* ---- customer profile ---- */
function CustomerProfilePage({ customer: c, onBack, onOpenTicket }) {
  const push = useToast();
  const statusDist = ["Open", "Pending", "Resolved", "Closed", "New", "Overdue"].map((s, i) => ({ name: s, value: c.history.filter((t) => t.status === s).length, color: ["#0EA5E9", "#F59E0B", "#10B981", "#64748B", "#8B5CF6", "#EF4444"][i] })).filter((d) => d.value);
  const acts = [
    { icon: PlusCircle, color: "#5B5CEB", txt: `raised ticket ${"#" + c.history[0].id}`, who: c.name, when: "2 days ago" },
    { icon: UserPlus, color: "#0EA5E9", txt: `assigned to ${c.agent}`, who: "Admin", when: "2 days ago" },
    { icon: Reply, color: "#10B981", txt: "replied via email", who: c.agent, when: "1 day ago" },
    { icon: MessageCircle, color: "#8B5CF6", txt: "customer responded", who: c.name, when: "1 day ago" },
    { icon: Lock, color: "#F59E0B", txt: "added an internal note", who: c.agent, when: "22 hr ago" },
    { icon: Send, color: "#0EA5E9", txt: "sent a follow-up email", who: c.agent, when: "5 hr ago" },
    { icon: CheckCheck, color: "#10B981", txt: `closed ticket ${"#" + c.history[0].id}`, who: c.agent, when: "3 hr ago" },
  ];
  const kpis = [
    ["Total Tickets", c.total], ["Open", c.open], ["Closed", c.closed], ["Pending", c.pending],
    ["Resolved", c.resolved], ["Avg Response", c.avgResponse], ["Avg Resolution", c.avgResolution], ["CSAT", c.csat + "%"],
  ];
  return (
    <div className="content route">
      <div className="crumb"><a onClick={onBack}>Customers</a> <ChevronRight size={14} /> <span style={{ color: "var(--text)" }}>{c.name}</span></div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="cprof-head">
          <span className="pav" style={{ background: avColor(c.name) }}>{initials(c.name)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{c.name}{c.registered && <BadgeCheck size={20} color="var(--success)" />}</h1>
            <div className="cprof-meta">
              <span className="m"><Ticket size={13} /> {c.cid}</span>
              <span className="m"><AtSign size={13} /> {c.email}</span>
              <span className="m"><PhoneCall size={13} /> {c.phone}</span>
              <span className="m"><GraduationCap size={13} /> {c.college}</span>
            </div>
            <div className="cprof-meta">
              <span className="m"><CalendarDays size={13} /> Registered {c.regDate}</span>
              <span className="m"><LogIn size={13} /> Last login {c.lastLogin}</span>
              <span className="m"><UserCheck size={13} /> Agent: {c.agent}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-primary btn-sm" onClick={() => push({ type: "info", title: "Compose email", desc: `Opening a new email to ${c.name}.` })}><Mail size={14} /> Email</button>
            {c.phone && <a className="btn btn-ghost btn-sm" href={`tel:${String(c.phone).replace(/[^\d+]/g, "")}`} style={{ textDecoration: "none" }}><Phone size={14} /> Call</a>}
          </div>
        </div>
      </div>

      <div className="td-grid">
        <div>
          <div className="card card-pad" style={{ marginBottom: 18 }}>
            <h3 className="card-title" style={{ marginBottom: 14 }}>Customer Analytics</h3>
            <div className="an-kpis">{kpis.map(([k, v]) => (<div className="an-kpi" key={k}><div className="v">{typeof v === "number" ? v : v}</div><div className="l">{k}</div></div>))}</div>
            <div style={{ marginTop: 16 }}>
              <div className="prog-line"><div className="pl"><span>Customer Satisfaction</span><span style={{ color: "var(--accent)" }}>{c.csat}%</span></div><div className="pb"><i style={{ width: c.csat + "%", background: "var(--accent)" }} /></div></div>
              <div className="prog-line"><div className="pl"><span>Resolution Rate</span><span style={{ color: "var(--success)" }}>{Math.round(((c.closed + c.resolved) / c.total) * 100)}%</span></div><div className="pb"><i style={{ width: Math.round(((c.closed + c.resolved) / c.total) * 100) + "%", background: "var(--success)" }} /></div></div>
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ width: 150, height: 150, position: "relative" }}>
                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusDist} dataKey="value" nameKey="name" innerRadius={44} outerRadius={68} paddingAngle={2} stroke="none">{statusDist.map((d) => <Cell key={d.name} fill={d.color} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart></ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}><div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800 }}>{c.total}</div><div style={{ fontSize: 10, color: "var(--muted)" }}>tickets</div></div></div>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                {statusDist.map((d) => (<div className="dist-row" key={d.name}><span className="dotc" style={{ background: d.color, width: 9, height: 9 }} /><span className="nm">{d.name}</span><span className="ct">{d.value}</span></div>))}
                <div style={{ display: "flex", gap: 18, marginTop: 10, fontSize: 12, color: "var(--muted)" }}><span>First ticket: <b style={{ color: "var(--text)" }}>{c.firstTicket}</b></span><span>Recent: <b style={{ color: "var(--text)" }}>{c.recentTicket}</b></span></div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-head" style={{ padding: "18px 20px 0", marginBottom: 12 }}>
              <div><h3 className="card-title">Ticket History</h3><p className="card-sub">Every ticket raised by {String(c.name || c.email || "this customer").split(" ")[0]} — click to open</p></div>
              <span className="count-badge">{c.total} tickets</span>
            </div>
            <div className="table-wrap"><table style={{ minWidth: 820 }}>
              <thead><tr><th>Ticket</th><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Created</th><th>Updated</th><th>Agent</th><th>Resolved</th></tr></thead>
              <tbody>{c.history.map((t) => (<tr key={t.id} style={{ cursor: "pointer" }} onClick={() => onOpenTicket(t)}>
                <td style={{ fontWeight: 700, color: "var(--primary)" }}>#{t.id}</td>
                <td><div className="subj" title={t.subject}>{t.subject}</div></td>
                <td style={{ fontSize: 12.5, fontWeight: 600 }}>{t.category}</td>
                <td><PrioBadge p={t.priority} /></td>
                <td><StatusBadge s={t.status} /></td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{t.created}</td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{t.updated}</td>
                <td style={{ fontSize: 12.5, fontWeight: 600 }}>{t.agent}</td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{t.resolvedOn || "—"}</td>
              </tr>))}</tbody>
            </table></div>
          </div>
        </div>

        <div className="props">
          <div className="card card-pad">
            <h3 className="card-title" style={{ marginBottom: 14 }}><Activity size={15} style={{ verticalAlign: "-2px", marginRight: 7, color: "var(--primary)" }} />Recent Activities</h3>
            <div>{acts.map((a, i) => (
              <div className="act-item" key={i} style={{ padding: "12px 0" }}>
                <span className="ai" style={{ background: `${a.color}18`, color: a.color }}><a.icon size={16} /></span>
                <div style={{ minWidth: 0 }}><div className="at"><b>{a.who}</b> {a.txt}</div><div className="am"><span>{a.when}</span></div></div>
              </div>
            ))}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export {
  CustFilterDrawer,
  CustSort,
  CustomerCard,
  CustomerProfilePage,
  CustomerTable,
  CustomersPage,
};
