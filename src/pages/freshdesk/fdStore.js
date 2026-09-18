/*
 * src/pages/freshdesk/fdStore.js
 *
 * The module-level ticket store.
 *
 * `TICKETS` is the live working set, reassigned by syncTicketStore() whenever
 * useFreshdeskData loads. It exists as a module binding -- rather than only as
 * React state -- because a handful of helpers read it outside of a component
 * (CSV/PDF export, the analytics summary, the command palette's search). Those
 * all run during a render, i.e. after the first load, so they see real rows.
 *
 * Anything that must RE-RENDER when the data changes takes `tickets` as a prop
 * instead; reading this binding in a component body would not subscribe it to
 * updates.
 */
import { kvGetSync } from "./fdShared";
import { AGENTS, AGENT_POOL, CALL_TYPES, DEPTS, HIST_CREATED, HIST_STATUS, HIST_UPDATED, SOURCES, SUBJ_BANK, TICKET_CATS, VOICEMAIL_TRANSCRIPTS } from "./fdConstants";

/* ============================================================================
   LIVE TICKET STORE

   `TICKETS` used to be a hard-coded array of nineteen invented rows. It is now
   the real working set, loaded from the contact@internshipstudio.com mailbox
   through /api/freshdesk/fd_tickets.php and kept in sync by
   useFreshdeskData() + useFreshdeskRealtime().

   It stays a MODULE-LEVEL binding, reassigned on every load, because a number
   of helpers in this file read it outside of React —
   computeAnalytics(), the command palette's search, the dashboard's recent-
   tickets table. Those all run during a render, i.e. after the first load has
   populated it, so they see real data. Anything that needs to re-render when
   the data changes must take `tickets` as a prop instead (they all do).
   ========================================================================== */
let TICKETS = [];

/** Called by useFreshdeskData whenever the working set changes. */
function syncTicketStore(rows) {
  TICKETS = Array.isArray(rows) ? rows : [];
  return TICKETS;
}

/*
 * Agent edits to the student-context panel are still kept locally (the panel is
 * an overlay on top of platform data, not something the mailbox knows about).
 * Re-applied on every store sync rather than once at import, since the rows now
 * arrive asynchronously.
 */
function applySavedStudentContext(rows) {
  try {
    const saved = JSON.parse(kvGetSync("hh-student-ctx") || "{}");
    rows.forEach((t) => { if (saved[t.id]) t.studentContext = { ...(t.studentContext || {}), ...saved[t.id] }; });
  } catch (e) { /* nothing saved yet, or storage unavailable */ }
  return rows;
}

function seedCalls() {
  const days = ["Today", "Today", "Today", "Yesterday", "Yesterday", "2 days ago", "3 days ago"];
  const times = ["10:42 AM", "10:15 AM", "9:58 AM", "3:22 PM", "3:15 PM", "1:04 PM", "11:37 AM", "5:48 PM", "2:26 PM", "8:12 AM"];
  const calls = [];
  let n = 0;
  // derive callers from real tickets so numbers match student profiles
  const students = TICKETS.slice(0, 16);
  // No tickets loaded yet (or a brand-new desk): there is nobody to have called.
  // Without this, students[i % 0] is NaN and every field below throws.
  if (!students.length) return [];
  for (let i = 0; i < 60; i++) {
    const known = i % 5 !== 4; // ~80% registered
    const stu = students[i % students.length];
    const type = CALL_TYPES[i % 5 === 0 ? 2 : i % 7 === 3 ? 3 : i % 3 === 0 ? 1 : 0]; // mix, weighted to incoming
    const answered = type === "Incoming" || type === "Outgoing" || type === "Callback";
    const status = type === "Missed" ? "Missed" : type === "Voicemail" ? "Voicemail" : (i % 11 === 0 ? "Rejected" : (answered ? (i % 2 ? "Answered" : "Completed") : "Missed"));
    const duration = ["Missed", "Rejected", "Voicemail"].includes(status) ? (type === "Voicemail" ? 60 + (i * 7) % 90 : 0) : 45 + (i * 37) % 600;
    const dayIdx = Math.min(days.length - 1, Math.floor(i / 9));
    calls.push({
      callId: `CALL-${20260 + i}`,
      phoneNumber: known ? stu.phone : `+91 9${(700000000 + i * 137911).toString().slice(0, 9)}`,
      customerId: known ? stu.id : null,
      customerName: known ? stu.name : "Unknown Caller",
      email: known ? stu.email : "",
      agentId: answered ? AGENT_POOL[i % AGENT_POOL.length] : null,
      agent: answered ? AGENT_POOL[i % AGENT_POOL.length] : "—",
      callType: type,
      status,
      day: days[dayIdx],
      time: times[i % times.length],
      startTime: Date.now() - i * 3.4e6,
      duration,
      recordingUrl: answered && status !== "Rejected" && i % 3 !== 0 ? `#rec/${20260 + i}` : null,
      voicemailUrl: type === "Voicemail" ? `#vm/${20260 + i}` : null,
      transcription: type === "Voicemail" ? VOICEMAIL_TRANSCRIPTS[i % VOICEMAIL_TRANSCRIPTS.length] : null,
      transcriptionStatus: type === "Voicemail" ? "completed" : "none",
      ticketId: known && i % 4 === 0 ? stu.id : null,
      notes: answered && i % 5 === 0 ? "Student asked about internship start date. Confirmed batch start. No follow-up required." : "",
      callbackStatus: type === "Missed" ? ["Pending", "Pending", "Completed", "Rescheduled", "Unreachable"][i % 5] : null,
      // AI-ready structured slot (populated later by an AI service)
      ai: { intent: null, sentiment: null, priority: null, summary: null, category: null },
      createdAt: Date.now() - i * 3.4e6,
    });
    n++;
  }
  return calls;
}

/*
 * Telephony is still simulated: there is no phone system wired into this desk,
 * so these rows are generated FROM the real tickets to give the Caller screen
 * plausible callers. It is now lazy rather than computed at import time --
 * TICKETS is empty until the first API load, and seeding from an empty array
 * produced NaN indexes and a crash on the Caller page.
 */
let _callsSeed = null;

function getCallsSeed() {
  if (_callsSeed === null || (_callsSeed.length === 0 && TICKETS.length > 0)) {
    _callsSeed = seedCalls();
  }
  return _callsSeed;
}

function callStats(calls) {
  const s = { total: calls.length, incoming: 0, outgoing: 0, missed: 0, answered: 0, voicemail: 0, rejected: 0, dur: 0, durCount: 0, callbacks: 0 };
  const uniq = new Set();
  calls.forEach((c) => {
    uniq.add(c.phoneNumber);
    if (c.callType === "Incoming") s.incoming++;
    if (c.callType === "Outgoing") s.outgoing++;
    if (c.callType === "Missed") s.missed++;
    if (c.callType === "Voicemail") s.voicemail++;
    if (c.callType === "Callback") s.callbacks++;
    if (["Answered", "Completed"].includes(c.status)) { s.answered++; s.dur += c.duration; s.durCount++; }
    if (c.status === "Rejected") s.rejected++;
    if (c.callbackStatus === "Pending") s.callbacks++;
  });
  s.unique = uniq.size;
  s.avgDur = s.durCount ? Math.round(s.dur / s.durCount) : 0;
  s.talkTime = s.dur;
  return s;
}

/*
 * Built on demand instead of at import: TICKETS is empty until the first load,
 * so a module-level constant here was permanently an empty directory. Callers
 * memoise it against the live tickets array.
 */
function buildCustomers() {
  return TICKETS.map((b, i) => {
  const n = 2 + (i % 4); // 2..5 tickets
  const history = [];
  for (let k = 0; k < n; k++) {
    if (k === 0) { history.push({ ...b, updated: HIST_UPDATED[0], resolvedOn: ["Resolved","Closed"].includes(b.status) ? "18 Jul 2026" : null }); continue; }
    const cat = TICKET_CATS[(i + k) % TICKET_CATS.length];
    const subjArr = SUBJ_BANK[cat] || ["Support request"];
    const status = HIST_STATUS[(i + k) % HIST_STATUS.length];
    const prio = ["Low", "Medium", "High", "Critical"][(i + k) % 4];
    history.push({
      ...b,
      id: Math.abs(b.id - k * 617 - i * 5),
      category: cat, subject: subjArr[k % subjArr.length], status, priority: prio,
      source: SOURCES[(i + k) % SOURCES.length], sla: ["On track", "At risk", "Breached"][(i + k) % 3],
      agent: AGENTS[(i + k) % AGENTS.length], dept: DEPTS[(i + k) % DEPTS.length],
      created: HIST_CREATED[(i + k) % HIST_CREATED.length], updated: HIST_UPDATED[(i + k) % HIST_UPDATED.length],
      createdSort: i * 10 + k, firstResp: "in 2 hours", resolution: "in a day",
      lastActivity: ["1 hr ago", "yesterday", "2 days ago"][k % 3],
      responseStatus: ["Awaiting reply", "Agent responded", "Customer replied"][(i + k) % 3],
      unresolved: !["Resolved", "Closed"].includes(status),
      resolvedOn: ["Resolved", "Closed"].includes(status) ? "1" + (k) + " Jul 2026" : null,
    });
  }
  const cnt = (f) => history.filter(f).length;
  return {
    /*
     * Defaults applied HERE rather than at every consumer.
     *
     * These fields were guaranteed by the mock generator and are frequently
     * null on real contacts (most people who email support give an address and
     * nothing else). Every screen that rendered one crashed. Guarding at the
     * source fixes the whole class instead of one page at a time -- `phone`
     * stays null on purpose, because the UI needs to know to HIDE the Call
     * button rather than print "—" into a tel: link.
     */
    cid: `CUS-${10480 + i * 13}`,
    name: b.name || (b.email ? String(b.email).split("@")[0] : "Unknown"),
    email: b.email || "",
    phone: b.phone || null,
    college: b.college || null,
    program: b.program || null,
    registered: !!b.registered,
    agent: b.agent || "Unassigned",
    mentor: b.mentor || null,
    history, total: history.length,
    open: cnt((t) => t.status === "Open" || t.status === "New"),
    closed: cnt((t) => t.status === "Closed"),
    pending: cnt((t) => t.status === "Pending"),
    resolved: cnt((t) => t.status === "Resolved"),
    // Math.max of an empty list is -Infinity, and an unknown priority maps to
    // undefined -> NaN, either of which breaks the "Highest Priority" sort.
    prioRank: history.length
      ? Math.max(...history.map((t) => ({ Critical: 5, Urgent: 5, High: 4, Medium: 3, Low: 2 }[t.priority] || 1)))
      : 0,
    activeStatus: history.length ? history[0].status : "New",
    lastTicketDate: ["Today", "Yesterday", "2 days ago", "1 week ago"][i % 4],
    lastActivity: ["5 min ago", "1 hr ago", "3 hr ago", "yesterday"][i % 4],
    lastActivitySort: i,
    regDate: ["12 Jan 2026", "03 Feb 2026", "19 Mar 2026", "28 Apr 2026", "07 May 2026"][i % 5],
    regSort: i % 5,
    lastLogin: ["2 hours ago", "yesterday", "3 days ago", "just now"][i % 4],
    firstTicket: ["10 Jan 2026", "01 Feb 2026", "15 Mar 2026", "22 Apr 2026"][i % 4],
    recentTicket: ["18 Jul 2026", "17 Jul 2026", "15 Jul 2026", "10 Jul 2026"][i % 4],
    avgResolution: ["4h 20m", "6h 10m", "1d 2h", "3h 45m"][i % 4],
    avgResponse: ["22m", "48m", "1h 05m", "35m"][i % 4],
    csat: [88, 92, 95, 79, 84][i % 5],
  };
  });
}

/* Everything above is exported so module order never matters. */
export {
  TICKETS,
  _callsSeed,
  applySavedStudentContext,
  buildCustomers,
  callStats,
  getCallsSeed,
  seedCalls,
  syncTicketStore,
};
