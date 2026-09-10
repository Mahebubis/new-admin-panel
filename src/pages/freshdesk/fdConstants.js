/*
 * src/pages/freshdesk/fdConstants.js
 *
 * Vocabulary shared across the desk: status/priority/SLA colour maps, the
 * sidebar views, the student-context enums, and the option lists the filter
 * drawers offer.
 *
 * These are DISPLAY definitions, not data. The rows themselves come from the
 * API (see fdApi.js); what is here is how a row is rendered -- which badge
 * colour "Breached" gets, which views exist and what each one filters on.
 * Keeping them in one module is what stops the ticket list and the sidebar
 * counts drifting apart over time.
 */
import { Activity, AlertTriangle, ArrowUp, BarChart3, BookOpen, Bot, CalendarClock, CheckCheck, CheckCircle2, Gauge, Globe, Inbox, LayoutDashboard, LogIn, Mail, MailWarning, MessageCircle, MessageSquare, Phone, PhoneCall, PlusCircle, Reply, RotateCcw, Send, Settings, ShieldAlert, ShieldCheck, ShieldX, Smile, Sparkles, Ticket, Ticket as TicketIcon, Timer, Trash, UserCheck, UserPlus, Users } from "lucide-react";

/* ============================================================================
   HELPERS + DATA
   ========================================================================== */
const initials = (n) => n.split(" ").map(w => w[0]).slice(0, 2).join("");

const avColor = (n) => ["#5B5CEB","#0EA5E9","#10B981","#F59E0B","#8B5CF6","#EC4899","#64748B"][n.length % 7];

const prioColor = { Critical:"#EF4444", Urgent:"#EF4444", High:"#F59E0B", Medium:"#0EA5E9", Low:"#10B981" };

const prioStyle = (p) => ({ Critical:{bg:"#FEE2E2",fg:"#DC2626"}, Urgent:{bg:"#FEE2E2",fg:"#DC2626"}, High:{bg:"#FEF3C7",fg:"#D97706"}, Medium:{bg:"#E0F2FE",fg:"#0284C7"}, Low:{bg:"#DCFCE7",fg:"#16A34A"} }[p] || {bg:"#F1F5F9",fg:"#64748B"});

const statusStyle = (s) => ({ Open:{bg:"#E0F2FE",fg:"#0284C7"}, "In Progress":{bg:"#EEF0FE",fg:"#5B5CEB"}, Pending:{bg:"#FEF3C7",fg:"#D97706"}, Waiting:{bg:"#FEF3C7",fg:"#D97706"}, New:{bg:"#DCFCE7",fg:"#16A34A"}, Escalated:{bg:"#FEE2E2",fg:"#DC2626"}, Overdue:{bg:"#FEE2E2",fg:"#DC2626"}, Resolved:{bg:"#DCFCE7",fg:"#16A34A"}, Closed:{bg:"#F1F5F9",fg:"#64748B"} }[s] || {bg:"#F1F5F9",fg:"#64748B"});

const slaStyle = { "On track":{bg:"#DCFCE7",fg:"#16A34A"}, "At risk":{bg:"#FEF3C7",fg:"#D97706"}, "Breached":{bg:"#FEE2E2",fg:"#DC2626"} };

const SOURCE_ICON = { Email:Mail, Chat:MessageCircle, WhatsApp:MessageSquare, Phone:Phone, Portal:Globe };

const STATS = [
  { key:"unresolved", label:"Unresolved", value:47, desc:"Awaiting first action", color:"#5B5CEB", icon:Inbox, trend:+8, spark:[12,18,14,22,19,25,23] },
  { key:"overdue", label:"Overdue", value:9, desc:"Past SLA deadline", color:"#EF4444", icon:AlertTriangle, trend:-12, spark:[8,11,9,13,7,6,5] },
  { key:"open", label:"Open", value:63, desc:"Currently in progress", color:"#0EA5E9", icon:Ticket, trend:+5, spark:[40,44,50,48,55,60,63] },
  { key:"closed", label:"Closed", value:412, desc:"Resolved this month", color:"#10B981", icon:CheckCircle2, trend:+21, spark:[280,310,330,360,380,400,412] },
  { key:"due", label:"Due Today", value:14, desc:"Deadline within 24h", color:"#F59E0B", icon:CalendarClock, trend:+3, spark:[6,9,8,11,10,13,14] },
  { key:"new", label:"New", value:26, desc:"Created in last 24h", color:"#8B5CF6", icon:Sparkles, trend:+17, spark:[10,14,12,18,20,24,26] },
];

const ANALYTICS = {
  Day:["9am","11am","1pm","3pm","5pm","7pm","9pm"].map((t,i)=>({t,Received:[8,14,11,17,13,9,5][i],Resolved:[5,10,9,14,12,8,6][i],Pending:[3,7,5,8,6,4,2][i]})),
  Week:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((t,i)=>({t,Received:[62,74,58,81,69,44,38][i],Resolved:[55,66,52,72,64,40,35][i],Pending:[14,18,12,20,15,9,7][i]})),
  Month:Array.from({length:8},(_,i)=>({t:`W${i+1}`,Received:[210,268,234,289,301,255,278,312][i],Resolved:[190,240,220,265,280,238,260,296][i],Pending:[40,52,44,58,55,48,50,44][i]})),
  Year:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((t,i)=>({t,Received:[820,910,880,1020,1180,1240,1310,1290,1150,1080,1220,1360][i],Resolved:[790,880,850,980,1120,1190,1260,1250,1110,1040,1180,1310][i],Pending:[90,110,95,130,150,140,160,145,120,110,135,150][i]})),
  Custom:["01","05","10","15","20","25","30"].map((t,i)=>({t,Received:[45,62,58,71,66,80,74][i],Resolved:[40,55,52,64,60,72,68][i],Pending:[9,13,11,15,12,16,14][i]})),
};

const ACTIVITIES = [
  { name:"Ananya Sharma", id:"#TKT-4821", prio:"High", agent:"Priya Nair", status:"In Progress", when:"2 min ago", action:"replied to", color:"#5B5CEB" },
  { name:"Vikram Patel", id:"#TKT-4818", prio:"Critical", agent:"Rahul Sethi", status:"Escalated", when:"12 min ago", action:"escalated", color:"#EF4444" },
  { name:"Meera Iyer", id:"#TKT-4809", prio:"Medium", agent:"Aisha Khan", status:"Resolved", when:"38 min ago", action:"resolved", color:"#10B981" },
  { name:"Rohan Gupta", id:"#TKT-4802", prio:"Low", agent:"Karan Mehta", status:"Open", when:"1 hr ago", action:"opened", color:"#0EA5E9" },
  { name:"Diya Menon", id:"#TKT-4797", prio:"High", agent:"Sneha Rao", status:"Waiting", when:"2 hr ago", action:"assigned to", color:"#F59E0B" },
];

const DISTRIBUTION = [
  { name:"Technical", value:184, color:"#5B5CEB" }, { name:"Billing", value:126, color:"#0EA5E9" },
  { name:"Internship", value:152, color:"#8B5CF6" }, { name:"Attendance", value:78, color:"#10B981" },
  { name:"Certificate", value:94, color:"#F59E0B" }, { name:"Placement", value:112, color:"#EC4899" },
  { name:"General", value:64, color:"#64748B" },
];

const PERF = [
  { title:"Avg Response Time", sub:"Target under 2h", pct:82, display:"1h 08m", color:"#5B5CEB", icon:Timer },
  { title:"Avg Resolution Time", sub:"Target under 8h", pct:74, display:"5h 24m", color:"#0EA5E9", icon:Gauge },
  { title:"Customer Satisfaction", sub:"CSAT this month", pct:94, display:"94%", color:"#10B981", icon:Smile },
  { title:"First Response SLA", sub:"Compliance rate", pct:88, display:"88%", color:"#F59E0B", icon:ShieldCheck },
  { title:"SLA Breaches", sub:"Down from 11 last wk", pct:16, display:"6", color:"#EF4444", icon:ShieldAlert },
];

const AGENTS = ["Priya Nair", "Rahul Sethi", "Aisha Khan", "Karan Mehta", "Sneha Rao", "Unassigned"];

const CATS = ["Internship","Attendance","Certificate","Placement","Technical","Billing","Account Access","General"];

const DEPTS = ["Student Success","Payments","Tech Support","Placements","Onboarding"];

const SOURCES = ["Email","Chat","WhatsApp","Phone","Portal"];

/* The demo ticket seed that used to live here is gone — every row now comes
   from the live mailbox. See the LIVE TICKET STORE block below. */
const dueTexts = ["in 30 min","in 2 hours","in a day","in 4 hours","overdue by 2h","in 6 hours","tomorrow 10am"];

/* ============================================================================
   STUDENT CONTEXT — structured, AI-ready attributes per customer/ticket
   ========================================================================== */
const STU_ENUMS = {
  registrationStatus: { registered: ["Registered", "g", 1], not_registered: ["Not Registered", "r", 0], pending: ["Registration Pending", "o", 0] },
  examStatus: { not_given: ["Exam Not Given", "x", 0], scheduled: ["Exam Scheduled", "o", 0], completed: ["Exam Completed", "g", 1], failed: ["Exam Failed", "r", 0], passed: ["Exam Passed", "g", 1] },
  projectStatus: { not_started: ["Not Started", "x", 0], in_progress: ["In Progress", "o", 0], submitted: ["Submitted", "b", 0], under_review: ["Under Review", "o", 0], approved: ["Approved", "g", 1], rejected: ["Rejected", "r", 0] },
  refundEligibility: { eligible: ["Refund Eligible", "g", 1], not_eligible: ["Refund Not Eligible", "r", 0], requested: ["Refund Requested", "o", 0], processing: ["Refund Processing", "o", 0], completed: ["Refund Completed", "g", 1] },
  enrollmentStatus: { active: ["Active", "g", 0], completed: ["Completed", "b", 0], on_hold: ["On Hold", "o", 0], cancelled: ["Cancelled", "r", 0], dropped: ["Dropped", "r", 0], expired: ["Expired", "x", 0] },
};

const STU_DOMAINS = ["Data Analytics", "Web Development", "Java Development", "Artificial Intelligence", "Machine Learning", "Cyber Security", "Software Testing", "Full Stack Development", "Python Development", "AWS Cloud", "HR Management"];

const stuMachine = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, "_");

/* Always returns a STRING. The old version ended in `|| v`, which handed back
   the undefined it was given when a ticket has no domain -- and every pill
   renderer calls .replace() on this. */
const stuDomainLabel = (v) => {
  if (v === null || v === undefined || v === "") return "No domain";
  return STU_DOMAINS.find((d) => stuMachine(d) === v) || String(v);
};

const stuDateDisplay = (iso) => {
  if (!iso) return "Not Set";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1]} ${y}`;
};

const STU_MONTHS = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

function buildStudentContext(i, t) {
  const domain = stuMachine(t.program);
  const [dd, mon, yy] = (t.startDate || "").split(" ");
  const startIso = mon && STU_MONTHS[mon] ? `${yy}-${STU_MONTHS[mon]}-${String(dd).padStart(2, "0")}` : "";
  const batchCode = t.program.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) + "-B" + ((i % 5) + 12);
  return {
    registrationStatus: t.registered ? "registered" : ["not_registered", "pending"][i % 2],
    domain,
    examStatus: ["completed", "passed", "scheduled", "not_given", "completed", "failed"][i % 6],
    startDate: i % 7 === 6 ? "" : startIso,
    projectStatus: ["submitted", "in_progress", "approved", "not_started", "under_review", "submitted", "rejected"][i % 7],
    refundEligibility: ["eligible", "not_eligible", "requested", "eligible", "processing", "completed"][i % 6],
    batch: batchCode,
    enrollmentStatus: stuMachine(t.planStatus) in STU_ENUMS.enrollmentStatus ? stuMachine(t.planStatus) : "active",
    _meta: {
      examDate: `${(i % 25) + 1} ${["Jul","Aug","Jun"][i % 3]} 2026`,
      examScore: 60 + ((i * 7) % 40),
      domainSelectedOn: `${(i % 27) + 1} ${["May","Jun","Jul"][i % 3]} 2026`,
      refundVerifiedOn: "12 Aug 2026",
    },
  };
}

/*
 * Compact pill descriptors — display text derives from machine values, never
 * the reverse.
 *
 * `ctx` is null for most real tickets: a student context only exists once the
 * sender's address has been matched to a platform account. Every accessor below
 * therefore has to tolerate an empty object, and callers should check
 * hasStudentContext() first to decide whether to render the pills at all.
 */
function hasStudentContext(ctx) {
  return !!(ctx && typeof ctx === "object" && Object.keys(ctx).some((k) => k !== "_meta" && ctx[k]));
}

function stuPills(ctx) {
  const c = ctx && typeof ctx === "object" ? ctx : {};
  const e = (f) => (STU_ENUMS[f] && STU_ENUMS[f][c[f]]) || ["—", "x", 0];
  const m = c._meta || {};
  // Guarantee every pill has a string `text`: callers do p.text.replace(...)
  // and a single undefined blanks the whole ticket page with a TypeError.
  const asText = (v) => (v === null || v === undefined ? "—" : String(v));
  return [
    { key: "registrationStatus", text: asText(e("registrationStatus")[0]), tone: e("registrationStatus")[1], check: e("registrationStatus")[2],
      tip: ["Registration Status", e("registrationStatus")[0], `Enrollment ID linked to this student`] },
    { key: "domain", text: asText(stuDomainLabel(c.domain)), tone: "b", check: 0,
      tip: ["Selected Domain", stuDomainLabel(c.domain), `Selected on: ${m.domainSelectedOn || "—"}`] },
    { key: "examStatus", text: asText(e("examStatus")[0]), tone: e("examStatus")[1], check: e("examStatus")[2],
      tip: ["Exam Status", e("examStatus")[0], ...(["completed", "passed", "failed"].includes(c.examStatus) ? [`Exam date: ${m.examDate}`, `Score: ${m.examScore}%`] : c.examStatus === "scheduled" ? [`Exam date: ${m.examDate}`] : ["No exam attempt recorded yet"])] },
    { key: "batch", text: asText(`Batch: ${stuDateDisplay(c.startDate)}`), tone: c.startDate ? "b" : "x", check: 0,
      tip: ["Batch", stuDateDisplay(c.startDate), c.startDate ? "Cohort start date for this student" : "Will be set after batch allocation"] },
    { key: "projectStatus", text: asText(`Project: ${e("projectStatus")[0]}`), tone: e("projectStatus")[1], check: e("projectStatus")[2],
      tip: ["Project Status", e("projectStatus")[0], "Tracked from the student dashboard"] },
    { key: "refundEligibility", text: asText(e("refundEligibility")[0]), tone: e("refundEligibility")[1], check: e("refundEligibility")[2],
      tip: ["Refund Eligibility", e("refundEligibility")[0], "Based on: registration date,", "refund policy, project status", `Last verified: ${m.refundVerifiedOn || "—"}`] },
    { key: "enrollmentStatus", text: asText(`Status: ${e("enrollmentStatus")[0]}`), tone: e("enrollmentStatus")[1], check: 0,
      tip: ["Enrollment Status", e("enrollmentStatus")[0], "Overall program standing"] },
  ];
}

/* ============================================================================
   CALLER / TELEPHONY — mock call data, AI-ready schema
   ========================================================================== */
const CALL_TYPES = ["Incoming", "Outgoing", "Missed", "Voicemail", "Callback"];

const CALL_STATUS = ["Ringing", "Answered", "Missed", "Rejected", "Completed", "Voicemail"];

const CALL_TYPE_META = {
  Incoming:  { icon: "PhoneIncoming", tone: "g", color: "#22C55E" },
  Outgoing:  { icon: "PhoneOutgoing", tone: "b", color: "#0EA5E9" },
  Missed:    { icon: "PhoneMissed",   tone: "r", color: "#EF4444" },
  Voicemail: { icon: "Voicemail",     tone: "o", color: "#F59E0B" },
  Callback:  { icon: "PhoneForwarded",tone: "b", color: "#8B5CF6" },
};

const fmtDur = (sec) => sec == null ? "—" : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

const AGENT_POOL = ["Priya Nair", "Rahul Sethi", "Aisha Khan", "Karan Mehta", "Sneha Rao"];

const VOICEMAIL_TRANSCRIPTS = [
  "Hello, I am calling to know when my internship will start. I finished my exam last week.",
  "Hi, I submitted my project but the dashboard still shows it as pending. Please check.",
  "I wanted to ask about the refund process. I am not able to continue the program.",
  "My certificate has not been issued yet even though I completed everything. Kindly help.",
  "Please call me back regarding my batch allocation, I have not received any email.",
];

const isOpen = (t) => t.status === "Open" || t.status === "New";

const VIEWS = [
  { key:"all", label:"All Tickets", icon:Inbox, f:(t)=>!t.trash && !t.spam },
  { key:"unresolved", label:"All Unresolved Tickets", icon:TicketIcon, f:(t)=>t.unresolved && !t.trash && !t.spam },
  { key:"undelivered", label:"All Undelivered Messages", icon:MailWarning, f:(t)=>t.undelivered },
  { key:"open", label:"Open Tickets", icon:Activity, f:(t)=>isOpen(t) && !t.trash && !t.spam },
  { key:"closed", label:"Closed Tickets", icon:CheckCheck, f:(t)=>t.status === "Closed" && !t.trash && !t.spam },
  { key:"mine", label:"Tickets I Raised", icon:UserCheck, f:(t)=>t.mine && !t.trash && !t.spam },
  { key:"trash", label:"Trash", icon:Trash, f:(t)=>t.trash },
  { key:"spam", label:"Spam", icon:ShieldX, f:(t)=>t.spam },
  /*
   * Reachable from the dashboard stat cards rather than the sidebar (hence
   * hidden:true). They MUST exist here even so -- TicketsPage resolves the
   * active view out of this list, and a card pointing at a key that is not in
   * it took the whole page down.
   *
   * The predicates mirror fd_view_where() in fd_tickets.php so the client-side
   * filter and the server-side badge count cannot disagree.
   */
  { key:"overdue", label:"Overdue", icon:AlertTriangle, hidden:true,
    f:(t)=>t.sla === "Breached" && t.unresolved && !t.trash && !t.spam },
  { key:"unassigned", label:"Unassigned", icon:UserPlus, hidden:true,
    f:(t)=>(!t.agent || t.agent === "Unassigned") && t.unresolved && !t.trash && !t.spam },
];

/* ============================================================================
   SHARED CHROME
   ========================================================================== */
/*
 * Workspace navigation.
 *
 * The ticket badge is filled from live counts, not a hard-coded "47" -- a
 * number on a nav item that never changes is worse than no number at all.
 */
const NAV = [
  { icon: LayoutDashboard, label: "Dashboard", route: "home", group: "Workspace" },
  { icon: Ticket, label: "Tickets", route: "tickets", group: "Workspace", countKey: "unresolved" },
  { icon: Users, label: "Customers", route: "customers", group: "Workspace" },
  { icon: PhoneCall, label: "Caller", route: "caller", group: "Workspace" },
  { icon: BookOpen, label: "Knowledge Base", group: "Workspace",
    href: "https://dashboard.tawk.to/#/knowledgebase/610113a8d6e7610a49ad5a1e/articles" },
  { icon: BarChart3, label: "Reports", route: "reports", group: "Organization" },
  { icon: Bot, label: "Automation", route: "automation", group: "Organization" },
  { icon: Settings, label: "Settings", route: "settings", group: "Organization" },
];

const TICKET_CATS = ["Internship","Attendance","Certificate","Placement","Technical","Billing","Account Access","General"];

const ACTIVITY_FEED = [
  { type:"Ticket Created", icon:PlusCircle, color:"#5B5CEB", tid:"#336270", cust:"Nidhi Maheshwari", action:"created a new ticket", agent:"System", when:"2 min ago", dt:"18 Jul 2026, 03:10 pm" },
  { type:"Ticket Assigned", icon:UserPlus, color:"#0EA5E9", tid:"#336267", cust:"Jagadish Krishnaa", action:"assigned to Priya Nair", agent:"Admin", when:"12 min ago", dt:"18 Jul 2026, 03:00 pm" },
  { type:"Customer Replied", icon:MessageCircle, color:"#8B5CF6", tid:"#336085", cust:"Ananya Sharma", action:"sent a reply", agent:"—", when:"22 min ago", dt:"18 Jul 2026, 02:50 pm" },
  { type:"Ticket Replied", icon:Reply, color:"#10B981", tid:"#336258", cust:"Raju Rao", action:"replied via email", agent:"Aisha Khan", when:"35 min ago", dt:"18 Jul 2026, 02:37 pm" },
  { type:"Ticket Escalated", icon:ArrowUp, color:"#EF4444", tid:"#336044", cust:"Amar Wadwale", action:"escalated the ticket", agent:"Rahul Sethi", when:"1 hr ago", dt:"18 Jul 2026, 02:12 pm" },
  { type:"Email Sent", icon:Send, color:"#0EA5E9", tid:"#336122", cust:"Vikram Patel", action:"sent a confirmation email", agent:"Sneha Rao", when:"2 hr ago", dt:"18 Jul 2026, 01:05 pm" },
  { type:"Ticket Closed", icon:CheckCheck, color:"#10B981", tid:"#335998", cust:"Meera Iyer", action:"closed the ticket", agent:"Karan Mehta", when:"3 hr ago", dt:"18 Jul 2026, 12:20 pm" },
  { type:"Email Received", icon:Mail, color:"#5B5CEB", tid:"#335880", cust:"Diya Menon", action:"new inbound email", agent:"System", when:"4 hr ago", dt:"18 Jul 2026, 11:40 am" },
  { type:"Ticket Reopened", icon:RotateCcw, color:"#F59E0B", tid:"#335565", cust:"Makarand Karangale", action:"reopened the ticket", agent:"Priya Nair", when:"5 hr ago", dt:"18 Jul 2026, 10:30 am" },
  { type:"Agent Logged In", icon:LogIn, color:"#64748B", tid:"—", cust:"—", action:"Aisha Khan signed in", agent:"Aisha Khan", when:"6 hr ago", dt:"18 Jul 2026, 09:15 am" },
];

/* Clicking a stat card opens the ticket list filtered to what the card counts:
   [view, statuses]. Keys match fd_stats.php's dashboard payload exactly, so a
   card can never count one thing and filter to another. */
/*
 * What each dashboard stat card opens.
 *
 * { view, status?, createdWithinHours?, resolvedThisMonth? } -- a full
 * descriptor, because [view, statuses] could not express "created in the last
 * 24 hours whatever its status", which is what the New card actually counts.
 * The definitions mirror fd_stats.php's dashboard query one-for-one, so a card
 * and the list it opens can no longer answer different questions.
 */
const STAT_FILTER = {
  unresolved: { view: "unresolved" },
  overdue:    { view: "overdue" },
  dueToday:   { view: "unresolved", dueWithinHours: 24 },
  open:       { view: "open" },
  onHold:     { view: "all", status: ["Pending", "On Hold", "Waiting"] },
  unassigned: { view: "unassigned" },
  // Kept for older cached payloads that still send these keys.
  closed:     { view: "closed" },
  new:        { view: "all", createdWithinHours: 24 },
};

const SORTS = ["Created Date","Updated Date","Priority","Status","Customer Name","Due Date"];

/* ============================================================================
   BULK ACTIONS
   ========================================================================== */
const TAG_BANK = ["Urgent", "VIP", "Internship", "Attendance", "Placement", "Certificate", "Refund", "Billing"];

const STATUS_OPTS = ["New", "Open", "Pending", "Resolved", "Closed", "On Hold"];

const TICKET_TYPES = ["Question", "Incident", "Problem", "Feature Request", "Refund"];

const BULK_STATUS = ["Open", "Pending", "Resolved", "Closed"];

const BULK_PRIORITY = ["Low", "Medium", "High", "Urgent"];

const BULK_AGENTS = ["Rahul Sharma", "Priya Patel", "Aman Singh", "Neha Verma", "Karan Mehta", "Sneha Iyer", "Akash Gupta", "Pooja Sharma", "Rohan Desai", "Support Queue (Unassigned)"];

const EMPTY = { createdFrom:"", resolvedAt:"", closedAt:"", status:[], priority:[], category:[], agent:"", customer:"", readState:"" };

/* ============================================================================
   TICKET DETAIL  (conversation + reply composer + /c canned responses)
   ========================================================================== */
const bodyFor = (t) => `Hi team,\n\nI'm writing regarding "${t.subject}". I've already tried the usual steps from my ${t.source.toLowerCase()} account but the issue is still not resolved on my end.\n\nCould you please look into this and let me know the next steps? Happy to share screenshots or my registered details if that helps.\n\nThanks,\n${t.name}`;

/* ============================================================================
   CUSTOMERS — directory of everyone who raised a ticket
   ========================================================================== */
const SUBJ_BANK = {
  Internship: ["Internship start date confirmation", "Batch shift request for training", "Internship extension request"],
  Attendance: ["Present mark not reflecting", "Attendance correction request", "Missed session marked absent"],
  Certificate: ["Certificate not received", "Name correction on certificate", "Certificate download not working"],
  Placement: ["Placement drive eligibility", "Offer letter verification pending", "Interview schedule query"],
  Technical: ["Video lectures not loading", "Exam portal not opening", "Dashboard error on login"],
  Billing: ["Course access locked after payment", "Refund for duplicate charge", "GST invoice request"],
  "Account Access": ["Unable to login to portal", "Password reset not working", "Account temporarily locked"],
  General: ["Where to find lecture resources", "Mentor session rescheduling", "General query about program"],
};

const HIST_STATUS = ["Open", "Pending", "Resolved", "Closed", "New", "Resolved", "Overdue"];

const HIST_CREATED = ["2 days ago", "1 week ago", "3 weeks ago", "1 month ago", "2 months ago"];

const HIST_UPDATED = ["1 hr ago", "yesterday", "2 days ago", "5 days ago", "3 weeks ago"];

const CUST_SORTS = ["Customer Name", "Total Tickets Raised", "Most Recent Ticket", "Oldest Customer", "Last Activity", "Highest Priority Tickets"];

const CUST_EMPTY = { status: [], category: [], priority: [], agent: "", from: "", to: "" };

/* Everything above is exported so module order never matters. */
export {
  ACTIVITIES,
  ACTIVITY_FEED,
  AGENTS,
  AGENT_POOL,
  ANALYTICS,
  BULK_AGENTS,
  BULK_PRIORITY,
  BULK_STATUS,
  CALL_STATUS,
  CALL_TYPES,
  CALL_TYPE_META,
  CATS,
  CUST_EMPTY,
  CUST_SORTS,
  DEPTS,
  DISTRIBUTION,
  EMPTY,
  HIST_CREATED,
  HIST_STATUS,
  HIST_UPDATED,
  NAV,
  PERF,
  SORTS,
  SOURCES,
  SOURCE_ICON,
  STATS,
  STATUS_OPTS,
  STAT_FILTER,
  STU_DOMAINS,
  STU_ENUMS,
  STU_MONTHS,
  SUBJ_BANK,
  TAG_BANK,
  TICKET_CATS,
  TICKET_TYPES,
  VIEWS,
  VOICEMAIL_TRANSCRIPTS,
  avColor,
  bodyFor,
  buildStudentContext,
  dueTexts,
  fmtDur,
  initials,
  isOpen,
  prioColor,
  prioStyle,
  slaStyle,
  statusStyle,
  stuDateDisplay,
  stuDomainLabel,
  stuMachine,
  hasStudentContext,
  stuPills,
};
