/*
 * src/pages/freshdesk/pages/CallerPage.jsx
 *
 * Telephony. NOTE: there is no phone system wired into this desk -- these calls
 * are generated from the real tickets so the screen is explorable. Everything
 * else in the helpdesk is live data; this one screen is not.
 */
import { BadgeCheck, Check, CheckCheck, CheckCircle2, Clock, Download, GraduationCap, Info, MessageSquare, PauseCircle, Phone, PhoneCall, PhoneForwarded, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, PlayCircle, Plus, Search, Sparkles, Ticket, User, Users, Voicemail as VoicemailIcon, X } from "lucide-react";
import { AGENT_POOL, CALL_TYPES, CALL_TYPE_META, STU_ENUMS, avColor, fmtDur, initials, stuDateDisplay, stuDomainLabel, stuPills } from "../fdConstants";
import { useEffect, useMemo, useState } from "react";
import { TICKETS, callStats, getCallsSeed } from "../fdStore";
import { EmptyState, useToast } from "../fdShared";
import { currentAgentProfile } from "../fdAgent";
import { agdRoleOf } from "./ReportsPage";
import { TicketModal } from "../components/Chrome";

const REG_DESIGNATIONS = ["Super Admin", "Admin", "Team Lead", "Support Executive", "Customer Support Executive", "Technical Support Engineer", "QA Executive", "Operations Executive"];

/* ============================================================================
   CALLER MODULE
   ========================================================================== */
const CALL_ICONS = { PhoneIncoming, PhoneOutgoing, PhoneMissed, Voicemail: VoicemailIcon, PhoneForwarded, PhoneCall };

function CallTypeBadge({ type, small }) {
  const m = CALL_TYPE_META[type] || CALL_TYPE_META.Incoming;
  const Ic = CALL_ICONS[m.icon] || PhoneCall;
  return <span className={`call-badge cb-${m.tone} ${small ? "sm" : ""}`}><Ic size={small ? 10 : 12} /> {type}</span>;
}

function callStatusTone(st) {
  return { Answered: "g", Completed: "g", Missed: "r", Rejected: "r", Voicemail: "o", Ringing: "b" }[st] || "x";
}

function CallerKpi({ icon: Ic, tone, label, value }) {
  return (
    <div className="agk">
      <span className={`agk-ic ic-${tone}`}><Ic size={14} /></span>
      <div className="agk-main"><b>{value}</b><span>{label}</span></div>
    </div>
  );
}

/* ---- live incoming call popup ---- */
function IncomingCallPopup({ call, onClose, onAccept, onReject, onCreateTicket }) {
  const [sec, setSec] = useState(0);
  useEffect(() => { const t = setInterval(() => setSec((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const ctx = call.ticket?.studentContext;
  return (
    <div className=" incm-wrap">
      <div className="incm">
        <div className="incm-top">
          <span className="incm-pulse"><PhoneIncoming size={18} /></span>
          <div><b>Incoming Call</b><span>{fmtDur(sec)} · ringing…</span></div>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="incm-num">{call.phoneNumber}</div>
        {call.customerId ? (<>
          <div className="incm-name">{call.customerName} <BadgeCheck size={15} color="var(--success)" /></div>
          <div className="incm-reg">✓ Registered Student</div>
          {ctx && (
            <div className="incm-ctx">
              <span className="stu-tag t-b sm">{stuDomainLabel(ctx.domain)}</span>
              <span className="stu-tag t-b sm">Batch: {stuDateDisplay(ctx.startDate)}</span>
              <span className={`stu-tag t-${(STU_ENUMS.enrollmentStatus[ctx.enrollmentStatus]||["","x"])[1]} sm`}>{(STU_ENUMS.enrollmentStatus[ctx.enrollmentStatus]||["—"])[0]}</span>
            </div>
          )}
          <div className="incm-mini">
            <span>Tickets <b>{call.ticket?.totalTickets ?? 4}</b></span>
            <span>Prev calls <b>{call.prevCalls ?? 6}</b></span>
            <span>Missed <b>{call.missedCount ?? 1}</b></span>
          </div>
        </>) : (<>
          <div className="incm-name">Unknown Caller</div>
          <div className="incm-reg unk">No student record found</div>
        </>)}
        <div className="incm-actions">
          <button className="btn btn-primary btn-sm" onClick={onAccept}><Phone size={14} /> Accept</button>
          <button className="btn btn-soft btn-sm incm-reject" onClick={onReject}><PhoneOff size={14} /> Reject</button>
          <button className="btn btn-ghost btn-sm" onClick={onCreateTicket}><Plus size={13} /> Create Ticket</button>
        </div>
      </div>
    </div>
  );
}

/* ---- caller profile drawer ---- */
function CallerProfile({ phone, calls, onClose, onOpenTicket, onCallback }) {
  const mine = calls.filter((c) => c.phoneNumber === phone);
  const first = mine[0] || {};
  const known = !!first.customerId;
  const ticket = TICKETS.find((t) => t.id === first.customerId);
  const ctx = ticket?.studentContext;
  const st = callStats(mine);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal caller-prof" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="panel-title" style={{ fontSize: 15 }}>
            <span className="wa" style={{ background: avColor(first.customerName || "U"), width: 34, height: 34 }}>{initials(first.customerName || "U")}</span>
            {first.customerName || "Unknown Caller"}
          </div>
          <button className="icon-btn" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="modal-body">
          {known && ctx ? (
            <div className="cp-stu" style={{ border: 0, padding: 0, marginBottom: 14 }}>
              <div className="cp-stu-head"><span className="cp-stu-title"><GraduationCap size={13} /> Student Information</span><span className="ai-ready"><Sparkles size={10} /> AI Context Ready</span></div>
              {stuPills(ctx).map((p) => (
                <div key={p.key} className="cp-stu-row"><span className="k">{{registrationStatus:"Registration",domain:"Domain",examStatus:"Exam",startDate:"Start Date",projectStatus:"Project",refundEligibility:"Refund",batch:"Batch",enrollmentStatus:"Enrollment"}[p.key]}</span><span className={`v tv-${p.tone}`}>{!!p.check && <Check size={10} strokeWidth={3.2} />}{p.text.replace(/^(Start|Project|Batch|Status): /, "")}</span></div>
              ))}
              <div className="cp-stu-row"><span className="k">Phone</span><span className="v">{phone}</span></div>
              <div className="cp-stu-row"><span className="k">Email</span><span className="v">{first.email}</span></div>
            </div>
          ) : <div className="signin-info" style={{ marginBottom: 14 }}><Info size={14} /> Unknown number — not linked to any student record.</div>}

          <div className="caller-stats">
            {[["Total", st.total], ["Incoming", st.incoming], ["Outgoing", st.outgoing], ["Missed", st.missed], ["Voicemails", st.voicemail]].map(([k, v]) => (
              <div key={k}><b>{v}</b><span>{k}</span></div>
            ))}
          </div>

          <div className="section-head" style={{ marginTop: 6 }}><h3 className="card-title" style={{ fontSize: 13 }}>Call Timeline</h3></div>
          <div className="caller-timeline">
            {mine.map((c) => (
              <div key={c.callId} className="ctl-row">
                <span className={`ctl-dot d-${callStatusTone(c.status)}`} />
                <div className="ctl-main">
                  <b>{c.callType} — {c.status}</b>
                  <span>{c.day} · {c.time}{c.duration ? ` · Duration ${fmtDur(c.duration)}` : ""}{c.agent !== "—" ? ` · ${c.agent}` : ""}</span>
                </div>
                {c.recordingUrl && <button className="icon-btn" title="Play recording"><PlayCircle size={16} /></button>}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-soft btn-sm" onClick={() => onCallback(first)}><PhoneForwarded size={13} /> Call Back</button>
          {known && ticket && <button className="btn btn-ghost btn-sm" onClick={() => { onOpenTicket(ticket); onClose(); }}><Ticket size={13} /> Open Ticket</button>}
        </div>
      </div>
    </div>
  );
}

/* ---- voicemail card ---- */
function VoicemailCard({ call, onCreateTicket, onProfile }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="vm-card">
      <div className="vm-head">
        <span className="vm-ic"><VoicemailIcon size={15} /></span>
        <div className="vm-info"><b>{call.customerName}</b><span>Missed call — {call.day} {call.time}</span></div>
        <span className="badge-xs" style={{ background: "var(--warning-soft)", color: "#B45309" }}>{fmtDur(call.duration)}</span>
      </div>
      <button className="vm-play" onClick={() => setPlaying((x) => !x)}>
        {playing ? <PauseCircle size={20} /> : <PlayCircle size={20} />}
        <span className="vm-wave">{Array.from({ length: 22 }).map((_, i) => <i key={i} className={playing ? "on" : ""} style={{ height: `${20 + (i * 37) % 70}%`, animationDelay: `${i * 0.05}s` }} />)}</span>
        <span className="vm-time">{fmtDur(call.duration)}</span>
      </button>
      {call.transcription && (
        <div className="vm-transcript"><span className="vm-tl"><Sparkles size={11} /> Transcription</span>{call.transcription}</div>
      )}
      <div className="vm-actions">
        <button className="btn btn-primary btn-sm" onClick={() => onCreateTicket(call)}><Plus size={12} /> Create Ticket</button>
        <button className="btn btn-ghost btn-sm" onClick={() => onProfile(call.phoneNumber)}><User size={12} /> Profile</button>
      </div>
    </div>
  );
}

function CallerPage({ tickets, onOpenTicket }) {
  const push = useToast();
  const me = currentAgentProfile();
  const roleClass = agdRoleOf(me);
  const [tab, setTab] = useState("dashboard"); // dashboard | history | missed | voicemail | mycalls
  const [calls, setCalls] = useState(() => getCallsSeed());
  const [profilePhone, setProfilePhone] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const [newTicket, setNewTicket] = useState(false);
  // filters
  const [fType, setFType] = useState("All");
  const [fStatus, setFStatus] = useState("All");
  const [fAgent, setFAgent] = useState("All");
  const [fDur, setFDur] = useState("All");
  const [q, setQ] = useState("");

  // demo: simulate an incoming call
  const simulate = () => {
    const pool = TICKETS.slice(0, 12);
    if (!pool.length) { push({ type: "info", title: "No tickets yet", desc: "Simulating a call needs at least one real ticket." }); return; }
    const known = pool[Math.floor(Math.random() * pool.length)];
    setIncoming({
      phoneNumber: known.phone, customerId: known.id, customerName: known.name, email: known.email,
      ticket: known, prevCalls: 3 + (known.id % 9), missedCount: known.id % 3,
    });
  };
  const acceptCall = () => { push({ type: "success", title: "Call connected", desc: incoming.customerName }); setIncoming(null); };
  const rejectCall = () => {
    if (incoming.customerId) {
      setCalls((cs) => [{ callId: `CALL-${Date.now()}`, phoneNumber: incoming.phoneNumber, customerId: incoming.customerId, customerName: incoming.customerName, email: incoming.email, agent: "—", agentId: null, callType: "Missed", status: "Missed", day: "Today", time: "just now", duration: 0, recordingUrl: null, voicemailUrl: null, transcription: null, ticketId: null, notes: "", callbackStatus: "Pending", ai: {}, createdAt: Date.now() }, ...cs]);
      push({ type: "info", title: "Missed call logged", desc: "Callback task created." });
    }
    setIncoming(null);
  };

  const stats = useMemo(() => callStats(calls), [calls]);
  const durBucket = (d) => d < 60 ? "u1" : d < 300 ? "1-5" : d < 900 ? "5-15" : "15+";
  const filtered = useMemo(() => calls.filter((c) => {
    if (fType !== "All" && c.callType !== fType) return false;
    if (fStatus !== "All" && c.status !== fStatus) return false;
    if (fAgent !== "All" && c.agent !== fAgent) return false;
    if (fDur !== "All" && durBucket(c.duration) !== fDur) return false;
    if (q.trim()) { const s2 = q.toLowerCase(); if (!(c.customerName.toLowerCase().includes(s2) || c.phoneNumber.includes(q) || (c.email || "").toLowerCase().includes(s2) || c.callId.toLowerCase().includes(s2))) return false; }
    return true;
  }), [calls, fType, fStatus, fAgent, fDur, q]);

  const missed = calls.filter((c) => c.callType === "Missed" || c.status === "Missed");
  const missedByPhone = useMemo(() => {
    const map = {};
    missed.forEach((c) => { (map[c.phoneNumber] = map[c.phoneNumber] || { ...c, attempts: 0, list: [] }); map[c.phoneNumber].attempts++; map[c.phoneNumber].list.push(c); });
    return Object.values(map).sort((a, b) => b.attempts - a.attempts);
  }, [calls]);
  const voicemails = calls.filter((c) => c.callType === "Voicemail");
  const myCalls = calls.filter((c) => c.agent === me.name);
  const myStats = callStats(myCalls);

  const createTicketFromCall = (c) => { setNewTicket(true); push({ type: "success", title: "Ticket draft from call", desc: `${c.customerName} · ${c.phoneNumber}` }); };
  const setCallback = (phone, status) => { setCalls((cs) => cs.map((c) => c.phoneNumber === phone && (c.callType === "Missed" || c.status === "Missed") ? { ...c, callbackStatus: status } : c)); push({ type: "success", title: `Callback marked ${status}` }); };

  const exportCSV = () => {
    const rows = [["Call ID", "Date", "Time", "Caller", "Phone", "Type", "Status", "Agent", "Duration"], ...filtered.map((c) => [c.callId, c.day, c.time, c.customerName, c.phoneNumber, c.callType, c.status, c.agent, fmtDur(c.duration)])];
    const csv = rows.map((r) => r.map((x) => `"${x}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv); a.download = "helphive-calls.csv"; a.click();
    push({ type: "success", title: "Call report exported", desc: `${filtered.length} calls · CSV` });
  };

  const TABS = [["dashboard", "Dashboard", PhoneCall], ["history", "Call History", Clock], ["missed", "Missed & Callbacks", PhoneMissed], ["voicemail", "Voicemail", VoicemailIcon], ["mycalls", "My Calls", User]];

  return (
    <div className="route caller">
      <div className="caller-topbar">
        <div className="caller-tabs">
          {TABS.map(([k, lbl, Ic]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              <Ic size={14} /> {lbl}
              {k === "missed" && missedByPhone.length > 0 && <span className="tab-ct">{missedByPhone.length}</span>}
              {k === "voicemail" && voicemails.length > 0 && <span className="tab-ct">{voicemails.length}</span>}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm caller-sim" onClick={simulate}><PhoneIncoming size={13} /> Simulate Incoming Call</button>
      </div>

      {/* DASHBOARD */}
      {tab === "dashboard" && (<>
        <div className="agk-row caller-kpis">
          <CallerKpi icon={PhoneCall} tone="b" label="Total Calls" value={stats.total} />
          <CallerKpi icon={PhoneIncoming} tone="g" label="Incoming" value={stats.incoming} />
          <CallerKpi icon={PhoneOutgoing} tone="b" label="Outgoing" value={stats.outgoing} />
          <CallerKpi icon={PhoneMissed} tone="r" label="Missed" value={stats.missed} />
          <CallerKpi icon={CheckCheck} tone="g" label="Answered" value={stats.answered} />
          <CallerKpi icon={VoicemailIcon} tone="o" label="Voicemails" value={stats.voicemail} />
          <CallerKpi icon={Clock} tone="b" label="Avg Duration" value={fmtDur(stats.avgDur)} />
          <CallerKpi icon={Users} tone="b" label="Unique Callers" value={stats.unique} />
        </div>
        <div className="caller-dash-row">
          <div className="card card-pad" style={{ flex: 2, minWidth: 0 }}>
            <div className="section-head"><h3 className="card-title"><Clock size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--primary)" }} />Recent Calls</h3><button className="agd-link" onClick={() => setTab("history")}>View Call History →</button></div>
            {calls.slice(0, 7).map((c) => (
              <div key={c.callId} className="call-row" onClick={() => setProfilePhone(c.phoneNumber)}>
                <CallTypeBadge type={c.callType} small />
                <span className="call-name">{c.customerName}</span>
                <span className="call-phone">{c.phoneNumber}</span>
                <span className={`badge-xs st-${callStatusTone(c.status)}`}>{c.status}</span>
                <span className="call-dur">{fmtDur(c.duration)}</span>
                <span className="call-time">{c.day} {c.time}</span>
              </div>
            ))}
          </div>
          <div className="card card-pad" style={{ flex: 1, minWidth: 220 }}>
            <div className="section-head"><h3 className="card-title" style={{ color: "var(--danger)" }}><PhoneMissed size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Needs Callback</h3></div>
            {missedByPhone.slice(0, 5).map((m) => (
              <div key={m.phoneNumber} className="mc-mini" onClick={() => setProfilePhone(m.phoneNumber)}>
                <div><b>{m.customerName}</b><span>{m.attempts} missed · {m.list[0].time}</span></div>
                {m.attempts >= 3 && <span className="badge-xs" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>High</span>}
              </div>
            ))}
            {missedByPhone.length === 0 && <div className="agd-empty"><CheckCircle2 size={16} /> No pending callbacks.</div>}
          </div>
        </div>
      </>)}

      {/* HISTORY */}
      {tab === "history" && (<>
        <div className="card card-pad caller-filters">
          <div className="cf-search"><Search size={15} /><input placeholder="Search name, number, email or call ID…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select value={fType} onChange={(e) => setFType(e.target.value)}><option>All</option>{CALL_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option>All</option>{["Answered", "Completed", "Missed", "Rejected", "Voicemail"].map((t) => <option key={t}>{t}</option>)}</select>
          <select value={fAgent} onChange={(e) => setFAgent(e.target.value)}><option>All</option>{AGENT_POOL.map((a) => <option key={a}>{a}</option>)}</select>
          <select value={fDur} onChange={(e) => setFDur(e.target.value)}><option value="All">Any duration</option><option value="u1">Under 1 min</option><option value="1-5">1–5 min</option><option value="5-15">5–15 min</option><option value="15+">15 min+</option></select>
          <button className="btn btn-soft btn-sm" onClick={exportCSV}><Download size={13} /> Export</button>
        </div>
        <div className="card card-pad">
          <div className="table-wrap"><table>
            <thead><tr><th>Time</th><th>Caller</th><th>Phone</th><th>Type</th><th>Agent</th><th>Duration</th><th>Status</th><th>Rec</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
            <tbody>{filtered.slice(0, 40).map((c) => (
              <tr key={c.callId} style={{ cursor: "pointer" }} onClick={() => setProfilePhone(c.phoneNumber)}>
                <td style={{ whiteSpace: "nowrap", fontSize: 12 }}><b>{c.time}</b><div style={{ color: "var(--faint)", fontSize: 11 }}>{c.day}</div></td>
                <td style={{ fontWeight: 600, fontSize: 12.5 }}>{c.customerName}</td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{c.phoneNumber}</td>
                <td><CallTypeBadge type={c.callType} small /></td>
                <td style={{ fontSize: 12.5 }}>{c.agent}</td>
                <td style={{ fontSize: 12.5, fontWeight: 600 }}>{fmtDur(c.duration)}</td>
                <td><span className={`badge-xs st-${callStatusTone(c.status)}`}>{c.status}</span></td>
                <td>{c.recordingUrl ? <PlayCircle size={16} color="var(--primary)" /> : <span style={{ color: "var(--faint)" }}>—</span>}</td>
                <td onClick={(e) => e.stopPropagation()}><div className="row-act" style={{ justifyContent: "flex-end" }}>
                  <button title="Call back"><PhoneForwarded size={14} /></button>
                  <button title="Create ticket" onClick={() => createTicketFromCall(c)}><Plus size={14} /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
          {filtered.length === 0 && <EmptyState icon={PhoneCall} title="No calls match" desc="Try adjusting the filters above." />}
        </div>
      </>)}

      {/* MISSED & CALLBACKS */}
      {tab === "missed" && (
        <div className="caller-missed">
          {missedByPhone.length ? missedByPhone.map((m) => (
            <div key={m.phoneNumber} className="card card-pad mc-card">
              <div className="mc-l">
                <span className="wa" style={{ background: avColor(m.customerName) }}>{initials(m.customerName)}</span>
                <div>
                  <b>{m.customerName}</b>
                  <span className="mc-num">{m.phoneNumber}</span>
                  <div className="mc-meta">
                    <span className={m.attempts >= 3 ? "mc-hi" : ""}>{m.attempts} missed call{m.attempts !== 1 ? "s" : ""}{m.attempts >= 3 && " — High Priority"}</span>
                    <span>· Last: {m.list[0].time}</span>
                    {m.customerId && <span>· Assigned: Support Queue</span>}
                  </div>
                </div>
              </div>
              <div className="mc-r">
                <select value={m.list[0].callbackStatus || "Pending"} onChange={(e) => setCallback(m.phoneNumber, e.target.value)} className="mc-cbstatus">
                  {["Pending", "Completed", "Unreachable", "Rescheduled"].map((x) => <option key={x}>{x}</option>)}
                </select>
                <button className="btn btn-primary btn-sm"><PhoneForwarded size={13} /> Call Back</button>
                <button className="btn btn-soft btn-sm" onClick={() => createTicketFromCall(m)}><Plus size={12} /> Ticket</button>
                <button className="btn btn-ghost btn-sm"><MessageSquare size={12} /> Message</button>
              </div>
            </div>
          )) : <EmptyState icon={CheckCircle2} title="No missed calls" desc="Every caller has been handled." />}
        </div>
      )}

      {/* VOICEMAIL */}
      {tab === "voicemail" && (
        <div className="caller-vms">
          {voicemails.length ? voicemails.map((c) => <VoicemailCard key={c.callId} call={c} onCreateTicket={createTicketFromCall} onProfile={setProfilePhone} />) : <EmptyState icon={VoicemailIcon} title="No voicemails" desc="New voice messages will appear here." />}
        </div>
      )}

      {/* MY CALLS */}
      {tab === "mycalls" && (<>
        <div className="agk-row caller-kpis">
          <CallerKpi icon={CheckCheck} tone="g" label="Answered" value={myStats.answered} />
          <CallerKpi icon={PhoneOutgoing} tone="b" label="Outgoing" value={myStats.outgoing} />
          <CallerKpi icon={PhoneMissed} tone="r" label="Missed" value={myStats.missed} />
          <CallerKpi icon={Clock} tone="b" label="Talk Time" value={`${Math.floor(myStats.talkTime / 3600)}h ${Math.round((myStats.talkTime % 3600) / 60)}m`} />
          <CallerKpi icon={VoicemailIcon} tone="o" label="Voicemails" value={myStats.voicemail} />
          <CallerKpi icon={PhoneForwarded} tone="b" label="Callbacks" value={myStats.callbacks} />
        </div>
        <div className="card card-pad">
          <div className="section-head"><h3 className="card-title"><User size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--primary)" }} />My Recent Calls</h3></div>
          {myCalls.length ? myCalls.slice(0, 12).map((c) => (
            <div key={c.callId} className="call-row" onClick={() => setProfilePhone(c.phoneNumber)}>
              <CallTypeBadge type={c.callType} small />
              <span className="call-name">{c.customerName}</span>
              <span className="call-phone">{c.phoneNumber}</span>
              <span className={`badge-xs st-${callStatusTone(c.status)}`}>{c.status}</span>
              <span className="call-dur">{fmtDur(c.duration)}</span>
              <span className="call-time">{c.day} {c.time}</span>
            </div>
          )) : <EmptyState icon={User} title="No calls handled yet" desc="Calls you answer or place will appear here." />}
        </div>
      </>)}

      {profilePhone && <CallerProfile phone={profilePhone} calls={calls} onClose={() => setProfilePhone(null)} onOpenTicket={onOpenTicket} onCallback={() => push({ type: "info", title: "Dialing…" })} />}
      {incoming && <IncomingCallPopup call={incoming} onClose={() => setIncoming(null)} onAccept={acceptCall} onReject={rejectCall} onCreateTicket={() => { setNewTicket(true); setIncoming(null); }} />}
      <TicketModal open={newTicket} onClose={() => setNewTicket(false)} />
    </div>
  );
}

export {
  CALL_ICONS,
  CallTypeBadge,
  CallerKpi,
  CallerPage,
  CallerProfile,
  IncomingCallPopup,
  REG_DESIGNATIONS,
  VoicemailCard,
  callStatusTone,
};
