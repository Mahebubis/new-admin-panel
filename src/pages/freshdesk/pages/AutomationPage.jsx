/*
 * src/pages/freshdesk/pages/AutomationPage.jsx — canned responses, auto-closure
 * rules, forwarding and tag notifications.
 */
import { Activity, ArrowUpDown, Ban, BellRing, Bold, Check, CheckCheck, CheckCircle2, ChevronDown, Clock3, Code, Copy, Download, Eye, FileSpreadsheet, FileText, FolderInput, Forward, Heading1, Italic, Link2, List, ListOrdered, Mail, MailX, MessageSquareText, Palette, Pause, Pencil, Play, Plus, PlusCircle, RotateCcw, Search, Send, Sparkles, StickyNote, Tag as TagIcon, Timer, Trash2, TrendingUp, Underline, Upload, UserCheck as UserIcon, X, XCircle, Zap } from "lucide-react";
import { ChartTooltip, ConfirmDialog, EmptyState, RingLg, StatusChip, Switch, downloadBlob, exportCSV, exportExcel, loadXLSX, useClickAway, useToast } from "../fdShared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { messages as fdMessages } from "../fdApi";

const LOG_STYLE = {
  Success:{ bg:"var(--success-soft)", fg:"var(--success)", icon:CheckCircle2 },
  Failed:{ bg:"var(--danger-soft)", fg:"var(--danger)", icon:XCircle },
  Pending:{ bg:"var(--warning-soft)", fg:"var(--warning)", icon:Clock3 },
  Disabled:{ bg:"var(--surface-2)", fg:"var(--muted)", icon:Ban },
};

const CANNED_CATS = ["General Queries","Internship","Attendance","Certificates","Billing","Placement","Technical Support","Refunds","Account Issues"];

const CANNED_SEED = [
  { name:"Internship Start Confirmation", cat:"Internship", by:"Priya Nair", mod:"2 days ago", uses:142, active:true, body:"Hi {Customer Name}, your internship for ticket {Ticket ID} is confirmed to begin on the scheduled date. You'll receive your onboarding kit shortly. Welcome aboard!" },
  { name:"₹99 Refund Acknowledgement", cat:"Refunds", by:"Rahul Sethi", mod:"5 hours ago", uses:88, active:true, body:"Hi {Customer Name}, we've received your refund request for {Ticket Subject}. Your ₹99 will be credited within 5–7 business days." },
  { name:"Certificate Download Steps", cat:"Certificates", by:"Aisha Khan", mod:"1 week ago", uses:210, active:true, body:"Hi {Customer Name}, to download your certificate, go to Dashboard → Certificate Wallet → Download. Reach out if it isn't visible yet." },
  { name:"Attendance Correction Reply", cat:"Attendance", by:"Karan Mehta", mod:"3 days ago", uses:64, active:false, body:"Hi {Customer Name}, we've logged your attendance correction for {Ticket ID}. It will reflect within 24 hours." },
  { name:"Payment Failed – Retry Steps", cat:"Billing", by:"Sneha Rao", mod:"yesterday", uses:176, active:true, body:"Hi {Customer Name}, your payment didn't go through. Please retry from the Course Store using a different method. No amount was deducted." },
  { name:"Placement Eligibility Info", cat:"Placement", by:"Priya Nair", mod:"4 days ago", uses:53, active:true, body:"Hi {Customer Name}, placement eligibility requires course completion + a passing skill score. You're currently eligible for the next drive." },
];
const TAGS = ["Urgent","VIP","Refund","Attendance","Internship","Placement","Technical Issue","Escalated","Billing","Certificate"];
const MODULES = [
  { key:"canned", title:"Canned Responses", icon:MessageSquareText, color:"#5B5CEB", desc:"Create, organize and reuse predefined replies so agents respond in seconds.", active:true },
  { key:"closure", title:"Auto Email Closure", icon:MailX, color:"#0EA5E9", desc:"Automatically resolve or close tickets when emails match your keyword rules.", active:true },
  { key:"forward", title:"Email Forwarding", icon:Forward, color:"#F59E0B", desc:"Route incoming support emails to the right people or departments instantly.", active:true },
  { key:"notify", title:"Tagged Notifications", icon:BellRing, color:"#EC4899", desc:"Alert the right recipients the moment a ticket is tagged Urgent, VIP and more.", active:true },
];
const PLACEHOLDERS = ["{Customer Name}","{Ticket ID}","{Ticket Subject}","{Ticket Status}","{Assigned Agent}","{Resolution Time}"];

/* ---- automation state seeds ---- */
const RULE_TYPES = ["Canned Response", "Auto Close Ticket", "Email Forwarding", "Tagged Notification"];

const RULE_TRIGGERS = ["Ticket Created", "Ticket Updated", "Ticket Closed", "Email Received", "Status Changed", "Priority Changed", "Tag Added"];

const CANNED_CATS_FULL = ["General", "Internship", "Attendance", "Certificate", "Billing", "Placement", "Technical Support", "Refund", "Account Issues"];

let _uid = 5000;

const uid = () => ++_uid;
const _CANNED_MAP = { Internship: "Internship", Refunds: "Refund", Certificates: "Certificate", Attendance: "Attendance", Billing: "Billing", Placement: "Placement" };

const _CANNED_SHORTCUT = { Internship: "/intern", Refunds: "/refund", Certificates: "/cert", Attendance: "/attend", Billing: "/pay", Placement: "/placement" };

const CANNED_INIT = CANNED_SEED.map((r, i) => ({
  id: uid(), title: r.name, cat: _CANNED_MAP[r.cat] || "General", shortcut: _CANNED_SHORTCUT[r.cat] || "/reply",
  body: r.body, tags: [r.cat], by: r.by, status: r.active ? "Active" : "Inactive",
  created: ["10 Jul 2026", "12 Jul 2026", "05 Jul 2026", "14 Jul 2026", "16 Jul 2026", "08 Jul 2026"][i % 6],
  createdSort: i, updated: r.mod, uses: r.uses,
}));
const CANNED_TOKENS = [
  { key: "{Customer Name}", sample: "Nidhi" },
  { key: "{Ticket ID}", sample: "#336270" },
  { key: "{Agent Name}", sample: "Priya Nair" },
  { key: "{Company Name}", sample: "Internship Studio" },
  { key: "{Support Email}", sample: "contact@internshipstudio.com" },
  { key: "{Support Phone}", sample: "+91 90000 10000" },
];

function fillTokens(text = "") {
  let out = text;
  CANNED_TOKENS.forEach((t) => { out = out.split(t.key).join(t.sample); });
  return out;
}

function CannedModal({ open, initial, onClose, onSave }) {
  const push = useToast();
  const blank = { title: "", cat: "General", shortcut: "", body: "", tags: [], by: "Admin", status: "Active" };
  const [f, setF] = useState(blank);
  const [tag, setTag] = useState("");
  const [showTokens, setShowTokens] = useState(false);
  const bodyRef = useRef(null);
  useEffect(() => { if (open) { setF(initial ? { ...initial } : blank); setTag(""); setShowTokens(false); } }, [open, initial]);
  if (!open) return null;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const addTag = (e) => { if (e.key === "Enter" && tag.trim()) { e.preventDefault(); setF((x) => ({ ...x, tags: x.tags.includes(tag.trim()) ? x.tags : [...x.tags, tag.trim()] })); setTag(""); } };
  const insertToken = (token) => {
    const ta = bodyRef.current;
    if (!ta) { set("body", (f.body || "") + token); return; }
    const start = ta.selectionStart ?? f.body.length;
    const end = ta.selectionEnd ?? f.body.length;
    const next = f.body.slice(0, start) + token + f.body.slice(end);
    set("body", next);
    setTimeout(() => { ta.focus(); const p = start + token.length; ta.setSelectionRange(p, p); }, 0);
  };
  const save = (publish) => {
    if (!f.title.trim() || !f.body.trim()) { push({ type: "error", title: "Missing details", desc: "Title and response content are required." }); return; }
    if (f.shortcut && !f.shortcut.startsWith("/")) { push({ type: "error", title: "Invalid shortcut", desc: "Shortcut must begin with '/'." }); return; }
    onSave({ ...f, status: publish ? "Active" : f.status }, !!initial);
  };
  const RTE = [Bold, Italic, Underline, Heading1, List, ListOrdered, Link2, Code];
  const chars = (f.body || "").length;
  const words = (f.body || "").trim() ? (f.body || "").trim().split(/\s+/).length : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB", width: 32, height: 32 }}><MessageSquareText size={16} /></span>{initial ? "Edit Response" : "New Canned Response"}</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <div className="fld"><label>Response Title *</label><input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Internship Start Confirmation" /></div>
          <div className="grid2">
            <div className="fld"><label>Category</label><select value={f.cat} onChange={(e) => set("cat", e.target.value)}>{CANNED_CATS_FULL.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="fld"><label>Shortcut Keyword</label><input value={f.shortcut} onChange={(e) => set("shortcut", e.target.value)} placeholder="/intern" />
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Type this in a reply to insert the response instantly.</div>
            </div>
          </div>

          <div className="fld">
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span>Response Content *</span>
              <button type="button" className="btn btn-ghost btn-sm" style={{ height: 26, padding: "0 9px", fontSize: 11.5 }} onClick={() => setShowTokens((x) => !x)}>
                <Code size={12} /> {showTokens ? "Hide" : "Insert"} placeholders <ChevronDown size={12} style={{ transform: showTokens ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
              </button>
            </label>
            {showTokens && (
              <div style={{ padding: 10, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Click to insert into the response. They'll fill with real values when sent.</div>
                <div className="chips">
                  {CANNED_TOKENS.map((t) => <button key={t.key} type="button" className="fchip" onClick={() => insertToken(t.key)}><Code size={11} /> {t.key}</button>)}
                </div>
              </div>
            )}
            <div className="rte" style={{ border: "1px solid var(--border)", borderRadius: "10px 10px 0 0", borderBottom: 0 }}>{RTE.map((Ic, i) => <button key={i} type="button"><Ic size={16} /></button>)}</div>
            <textarea ref={bodyRef} style={{ borderRadius: "0 0 10px 10px", minHeight: 140 }} value={f.body} onChange={(e) => set("body", e.target.value)} placeholder="Write the response… use {Customer Name}, {Ticket ID} placeholders." />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
              <span>{words} words · {chars} characters</span>
              {f.body && f.body.match(/\{[^}]+\}/g) && <span><Sparkles size={11} style={{ verticalAlign: "-2px" }} /> {f.body.match(/\{[^}]+\}/g).length} placeholder{f.body.match(/\{[^}]+\}/g).length > 1 ? "s" : ""}</span>}
            </div>
          </div>

          <div className="fld"><label>Tags</label><input value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={addTag} placeholder="Type a tag and press Enter" />
            <div className="tagbox">{f.tags.map((t) => <span className="tg" key={t}><TagIcon size={11} /> {t}<button onClick={() => set("tags", f.tags.filter((x) => x !== t))}><X size={11} /></button></span>)}</div>
          </div>
          <div className="grid2">
            <div className="fld"><label>Created By</label><input value={f.by} onChange={(e) => set("by", e.target.value)} /></div>
            <div className="fld"><label>Status</label><select value={f.status} onChange={(e) => set("status", e.target.value)}><option>Active</option><option>Inactive</option></select></div>
          </div>
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-ghost btn-sm" onClick={() => save(false)}><Check size={15} /> Save</button><button className="btn btn-primary btn-sm" onClick={() => save(true)}><Send size={15} /> Save &amp; Publish</button></div>
      </div>
    </div>
  );
}

function CannedPreviewModal({ resp, onClose }) {
  const [rendered, setRendered] = useState(true);
  if (!resp) return null;
  const shown = rendered ? fillTokens(resp.body) : resp.body;
  const hasTokens = /\{[^}]+\}/.test(resp.body || "");
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#0EA5E918", color: "#0EA5E9", width: 32, height: 32 }}><Eye size={16} /></span>Response Preview</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span className="fchip" style={{ cursor: "default" }}>{resp.cat}</span>
            {resp.shortcut && <span className="fchip" style={{ cursor: "default" }}><Code size={11} /> {resp.shortcut}</span>}
            <StatusChip active={resp.status === "Active"} />
            {hasTokens && (
              <div style={{ marginLeft: "auto", display: "flex", gap: 4, padding: 3, borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <button className={`fchip ${rendered ? "on" : ""}`} style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setRendered(true)}>Rendered</button>
                <button className={`fchip ${!rendered ? "on" : ""}`} style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setRendered(false)}>Raw</button>
              </div>
            )}
          </div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{resp.title}</div>
          <div style={{ padding: 14, borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: 13.5, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{shown}</div>
          {resp.tags && resp.tags.length > 0 && <div className="chips">{resp.tags.map((t) => <span className="fchip" key={t} style={{ cursor: "default" }}><TagIcon size={11} /> {t}</span>)}</div>}
          <div style={{ fontSize: 12, color: "var(--muted)" }}>By {resp.by} · used {resp.uses || 0} times · updated {resp.updated || "—"}</div>
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Close</button><button className="btn btn-primary btn-sm" onClick={onClose}><Send size={15} /> Insert into reply</button></div>
      </div>
    </div>
  );
}

function ImportDialog({ open, onClose, onImport }) {
  const push = useToast();
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState("");
  const ref = useRef(null);
  useEffect(() => { if (!open) { setRows(null); setFileName(""); } }, [open]);
  if (!open) return null;
  const parse = (file) => {
    if (!file) return;
    setFileName(file.name);
    const ext = file.name.split(".").pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let data = [];
        if (ext === "json") { const j = JSON.parse(e.target.result); data = Array.isArray(j) ? j : (j.responses || []); }
        else {
          const XLSX = await loadXLSX();
          const wb = XLSX.read(e.target.result, { type: "array" });
          data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        }
        const norm = data.map((r) => ({ title: r.title || r.Title || r["Response Title"] || "", cat: r.cat || r.Category || "General", shortcut: r.shortcut || r.Shortcut || "/reply", body: r.body || r.Response || r["Response Content"] || r.Body || "", by: r.by || r["Created By"] || "Import", status: r.status || r.Status || "Active" }));
        setRows(norm);
      } catch (err) { push({ type: "error", title: "Could not read file", desc: "Check the format (.xlsx, .csv, .json) and try again." }); }
    };
    if (ext === "json") reader.readAsText(file); else reader.readAsArrayBuffer(file);
  };
  const valid = rows ? rows.filter((r) => r.title && r.body) : [];
  const invalid = rows ? rows.length - valid.length : 0;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#10B98118", color: "#10B981", width: 32, height: 32 }}><Upload size={16} /></span>Import Responses</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <div className="dropzone" onClick={() => ref.current?.click()}><Upload size={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />{fileName || "Click to choose an Excel, CSV or JSON file"}
            <input ref={ref} type="file" accept=".xlsx,.csv,.json" hidden onChange={(e) => parse(e.target.files[0])} /></div>
          {rows && (<>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, textAlign: "center" }}>
              <div className="an-kpi"><div className="v">{rows.length}</div><div className="l">Total records</div></div>
              <div className="an-kpi"><div className="v" style={{ color: "var(--success)" }}>{valid.length}</div><div className="l">Valid</div></div>
              <div className="an-kpi"><div className="v" style={{ color: "var(--danger)" }}>{invalid}</div><div className="l">Invalid</div></div>
            </div>
            <div style={{ maxHeight: 180, overflow: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
              <table style={{ minWidth: 0 }}><thead><tr><th>Title</th><th>Category</th><th>Valid</th></tr></thead>
                <tbody>{rows.slice(0, 20).map((r, i) => (<tr key={i}><td style={{ fontWeight: 600 }}>{r.title || <i style={{ color: "var(--danger)" }}>missing</i>}</td><td style={{ fontSize: 12.5 }}>{r.cat}</td><td>{r.title && r.body ? <Check size={15} color="var(--success)" /> : <X size={15} color="var(--danger)" />}</td></tr>))}</tbody>
              </table>
            </div>
          </>)}
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-ghost btn-sm" disabled={!valid.length} onClick={() => { onImport(valid); onClose(); }}>Skip Invalid ({valid.length})</button>
          <button className="btn btn-primary btn-sm" disabled={!rows || !rows.filter((r) => r.title).length} onClick={() => { onImport(rows.filter((r) => r.title)); onClose(); }}><Check size={15} /> Import All</button>
        </div>
      </div>
    </div>
  );
}
function RuleViewModal({ rule, onClose }) {
  if (!rule) return null;
  const rows = [["Type", rule.type], ["Trigger", rule.trigger], ["Conditions", condsText(rule)],
                ["Action", actsText(rule)], ["Status", rule.active ? "Active" : "Inactive"],
                ["Times run", String(rule.runs ?? 0)], ["Last run", rule.lastRun || "never"],
                ["Created", rule.created]];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB", width: 32, height: 32 }}><Zap size={16} /></span>{rule.name}</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          {rule.desc && <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{rule.desc}</p>}
          <div>{rows.map(([k, v]) => (<div className="kv" key={k} style={{ borderBottom: "1px solid var(--border)" }}><span className="k">{k}</span><span className="v">{v}</span></div>))}</div>
        </div>
        <div className="modal-foot"><button className="btn btn-primary btn-sm" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

function AutomationRulesTable({ rules, log, onEdit, onView, onToggle, onDuplicate, onDelete }) {
  const push = useToast();
  const [confirm, setConfirm] = useState(null);
  const typeColor = { "Canned Response": "#5B5CEB", "Auto Close Ticket": "#0EA5E9", "Email Forwarding": "#F59E0B", "Tagged Notification": "#EC4899" };
  return (
    <div className="card panel">
      <div className="panel-head"><div className="panel-title"><span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB" }}><Zap size={19} /></span>Automation Rules <span className="count-badge" style={{ marginLeft: 4 }}>{rules.length}</span></div></div>
      {rules.length ? (
        <div className="table-wrap"><table style={{ minWidth: 980 }}>
          <thead><tr><th>Name</th><th>Type</th><th>Trigger</th><th>Conditions</th><th>Action</th><th>Status</th><th>Created</th><th>Modified</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
          <tbody>{rules.map((r) => (<tr key={r.id}>
            <td className="rname">{r.name}</td>
            <td><span className="badge-pill" style={{ background: `${typeColor[r.type]}16`, color: typeColor[r.type] }}>{r.type}</span></td>
            <td style={{ fontSize: 12.5 }}>{r.trigger}</td>
            <td style={{ maxWidth: 200, fontSize: 12, color: "var(--muted)" }}>{condsText(r)}</td>
            <td style={{ maxWidth: 180, fontSize: 12, color: "var(--muted)" }}>{actsText(r)}</td>
            <td><Switch on={r.active} onChange={(v) => onToggle && onToggle(r, v)} /></td>
            <td style={{ fontSize: 12, color: "var(--muted)" }}>{r.created}</td>
            <td style={{ fontSize: 12, color: "var(--muted)" }}>{r.modified}</td>
            <td><div className="row-act" style={{ justifyContent: "flex-end" }}>
              <button title="View" onClick={() => onView(r)}><Eye size={15} /></button>
              <button title="Edit" onClick={() => onEdit(r)}><Pencil size={15} /></button>
              <button title="Duplicate" onClick={() => onDuplicate && onDuplicate(r)}><Copy size={15} /></button>
              <button className="danger" title="Delete" onClick={() => setConfirm(r)}><Trash2 size={15} /></button>
            </div></td>
          </tr>))}</tbody>
        </table></div>
      ) : <EmptyState icon={Zap} title="No automations yet" desc="Create your first automation rule to start saving your team time." />}
      <ConfirmDialog open={!!confirm} danger title="Delete automation" message={confirm ? `Delete “${confirm.name}”? This can't be undone.` : ""} confirmLabel="Delete"
        onConfirm={() => onDelete && onDelete(confirm)}
        onClose={() => setConfirm(null)} />
    </div>
  );
}

function ActivityLog({ logs }) {
  const [q, setQ] = useState(""); const [mod, setMod] = useState("All");
  const push = useToast();
  const mods = ["All", "Automation", "Canned Responses", "Modules"];
  const rows = logs.filter((l) => (mod === "All" || l.module === mod) && (l.action + l.user + l.module).toLowerCase().includes(q.toLowerCase()));
  const stStyle = { Success: { bg: "var(--success-soft)", fg: "var(--success)" }, Info: { bg: "var(--primary-soft)", fg: "var(--primary)" }, Warning: { bg: "var(--warning-soft)", fg: "var(--warning)" }, Failed: { bg: "var(--danger-soft)", fg: "var(--danger)" } };
  const exportLog = () => { try { exportCSV(logs.map((l) => ({ Timestamp: l.when, User: l.user, Action: l.action, Module: l.module, Status: l.status })), "automation-activity-log.csv"); push({ type: "success", title: "Activity log exported" }); } catch (e) { push({ type: "error", title: "Export failed" }); } };
  return (
    <div className="card panel">
      <div className="panel-head"><div className="panel-title"><span className="pic" style={{ background: "#8B5CF618", color: "#8B5CF6" }}><Activity size={19} /></span>Activity Log</div><button className="btn btn-soft btn-sm" onClick={exportLog}><Download size={15} /> Export</button></div>
      <div className="toolbar2"><div className="searchbox" style={{ maxWidth: 240, flex: "initial", width: 240 }}><Search size={16} /><input placeholder="Search activity…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="chips">{mods.map((m) => <button key={m} className={`fchip ${mod === m ? "on" : ""}`} onClick={() => setMod(m)}>{m}</button>)}</div></div>
      {rows.length ? (
        <div className="table-wrap"><table style={{ minWidth: 720 }}>
          <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Module</th><th>Status</th></tr></thead>
          <tbody>{rows.map((l) => { const st = stStyle[l.status] || stStyle.Info; return (<tr key={l.id}>
            <td style={{ fontSize: 12.5, color: "var(--muted)", whiteSpace: "nowrap" }}>{l.when}</td>
            <td style={{ fontSize: 12.5, fontWeight: 600 }}>{l.user}</td>
            <td style={{ fontSize: 12.5 }}>{l.action}</td>
            <td style={{ fontSize: 12.5, color: "var(--muted)" }}>{l.module}</td>
            <td><span className="badge-pill" style={{ background: st.bg, color: st.fg }}>{l.status}</span></td>
          </tr>); })}</tbody>
        </table></div>
      ) : <EmptyState icon={Activity} title="No activity" desc="Nothing matches your search or filter." />}
    </div>
  );
}

function CannedResponses({ canned, setCanned, log, onImport, onExport }) {
  const push = useToast();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [status, setStatus] = useState("All");
  const [by, setBy] = useState("All");
  const [from, setFrom] = useState("");
  const [sort, setSort] = useState("Updated Date");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [expOpen, setExpOpen] = useState(false);
  const expRef = useRef(null);
  useClickAway(expRef, () => setExpOpen(false));
  const authors = ["All", ...Array.from(new Set(canned.map((r) => r.by)))];

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    let r = canned.filter((x) =>
      (cat === "All" || x.cat === cat) && (status === "All" || x.status === status) && (by === "All" || x.by === by) &&
      (!term || [x.title, x.cat, x.shortcut, x.by].join(" ").toLowerCase().includes(term)));
    const cmp = {
      "Response Title": (a, b) => a.title.localeCompare(b.title),
      "Category": (a, b) => a.cat.localeCompare(b.cat),
      "Created Date": (a, b) => a.createdSort - b.createdSort,
      "Updated Date": (a, b) => a.createdSort - b.createdSort,
      "Usage Count": (a, b) => b.uses - a.uses,
    }[sort];
    return [...r].sort(cmp);
  }, [canned, q, cat, status, by, sort]);

  const save = (data, isEdit) => {
    if (isEdit) { setCanned((cs) => cs.map((x) => x.id === data.id ? { ...x, ...data, updated: "just now" } : x)); log(`Edited canned response “${data.title}”`, "Canned Responses"); push({ type: "success", title: "Response updated", desc: data.title }); }
    else { setCanned((cs) => [{ ...data, id: uid(), uses: 0, created: "just now", createdSort: cs.length, updated: "just now" }, ...cs]); log(`Added canned response “${data.title}”`, "Canned Responses"); push({ type: "success", title: "Response added", desc: data.title }); }
    setModal(false); setEditing(null);
  };
  const del = (r) => { setCanned((cs) => cs.filter((x) => x.id !== r.id)); log(`Deleted canned response “${r.title}”`, "Canned Responses", "Warning"); push({ type: "success", title: "Response deleted" }); };
  const dup = (r) => { setCanned((cs) => [{ ...r, id: uid(), title: "Copy of " + r.title, uses: 0, created: "just now", createdSort: cs.length, updated: "just now" }, ...cs]); log(`Duplicated canned response “${r.title}”`, "Canned Responses"); push({ type: "success", title: "Response duplicated" }); };
  const use = (r) => { setCanned((cs) => cs.map((x) => x.id === r.id ? { ...x, uses: x.uses + 1 } : x)); push({ type: "info", title: "Response applied", desc: `“${r.title}” inserted · usage +1` }); };
  const resetFilters = () => { setQ(""); setCat("All"); setStatus("All"); setBy("All"); setFrom(""); };

  return (
    <div className="card panel">
      <div className="panel-head">
        <div className="panel-title"><span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB" }}><MessageSquareText size={19} /></span>Canned Responses <span className="count-badge" style={{ marginLeft: 4 }}>{canned.length}</span></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-soft btn-sm" onClick={onImport}><Upload size={14} /> Import</button>
          <div className="dd-wrap" ref={expRef}>
            <button className="btn btn-soft btn-sm" onClick={() => setExpOpen((o) => !o)}><Download size={14} /> Export <ChevronDown size={13} /></button>
            {expOpen && (<div className="menu menu-top right" style={{ minWidth: 150 }}>
              <button className="mi" onClick={() => { onExport("xlsx", rows); setExpOpen(false); }}><span className="mic" style={{ background: "#10B98118", color: "#10B981" }}><FileSpreadsheet size={14} /></span> Excel</button>
              <button className="mi" onClick={() => { onExport("csv", rows); setExpOpen(false); }}><span className="mic" style={{ background: "#0EA5E918", color: "#0EA5E9" }}><FileText size={14} /></span> CSV</button>
              <button className="mi" onClick={() => { onExport("json", rows); setExpOpen(false); }}><span className="mic" style={{ background: "#5B5CEB18", color: "#5B5CEB" }}><Code size={14} /></span> JSON</button>
            </div>)}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setModal(true); }}><PlusCircle size={15} /> New Response</button>
        </div>
      </div>
      <div className="toolbar2" style={{ gap: 8 }}>
        <div className="searchbox" style={{ maxWidth: 220, flex: "initial", width: 220 }}><Search size={16} /><input placeholder="Search title, shortcut, author…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="fchip" style={{ padding: "7px 10px" }} value={status} onChange={(e) => setStatus(e.target.value)}><option>All</option><option>Active</option><option>Inactive</option></select>
        <select className="fchip" style={{ padding: "7px 10px" }} value={by} onChange={(e) => setBy(e.target.value)}>{authors.map((a) => <option key={a}>{a}</option>)}</select>
        <input type="date" className="fchip" style={{ padding: "6px 10px" }} value={from} onChange={(e) => setFrom(e.target.value)} />
        <div className="dd-wrap" style={{ marginLeft: "auto" }}><CannedSort value={sort} onChange={setSort} /></div>
        <button className="btn btn-ghost btn-sm" onClick={resetFilters}><RotateCcw size={14} /> Reset</button>
      </div>
      <div className="chips" style={{ padding: "0 20px 14px" }}>
        <button className={`fchip ${cat === "All" ? "on" : ""}`} onClick={() => setCat("All")}>All</button>
        {CANNED_CATS_FULL.map((c) => <button key={c} className={`fchip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      {rows.length ? (
        <div className="table-wrap"><table style={{ minWidth: 820 }}>
          <thead><tr><th>Response Title</th><th>Category</th><th>Shortcut</th><th>Usage</th><th>Created By</th><th>Updated</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
          <tbody>{rows.map((r) => (<tr key={r.id}>
            <td className="rname">{r.title}</td>
            <td><span className="fchip" style={{ cursor: "default" }}>{r.cat}</span></td>
            <td><span className="chip">{r.shortcut}</span></td>
            <td style={{ fontWeight: 700 }}>{r.uses}</td>
            <td style={{ fontSize: 12.5 }}>{r.by}</td>
            <td style={{ fontSize: 12, color: "var(--muted)" }}>{r.updated}</td>
            <td><StatusChip active={r.status === "Active"} /></td>
            <td><div className="row-act" style={{ justifyContent: "flex-end" }}>
              <button title="Apply (usage +1)" onClick={() => use(r)}><Send size={15} /></button>
              <button title="Preview" onClick={() => setPreview(r)}><Eye size={15} /></button>
              <button title="Edit" onClick={() => { setEditing(r); setModal(true); }}><Pencil size={15} /></button>
              <button title="Duplicate" onClick={() => dup(r)}><Copy size={15} /></button>
              <button className="danger" title="Delete" onClick={() => setConfirm(r)}><Trash2 size={15} /></button>
            </div></td>
          </tr>))}</tbody>
        </table></div>
      ) : <EmptyState icon={MessageSquareText} title="No canned responses" desc="Nothing matches your filters. Create one or adjust your search." action="New Response" onAction={() => { setEditing(null); setModal(true); }} />}

      <CannedModal open={modal} initial={editing} onClose={() => { setModal(false); setEditing(null); }} onSave={save} />
      <CannedPreviewModal resp={preview} onClose={() => setPreview(null)} />
      <ConfirmDialog open={!!confirm} danger title="Delete response" message={confirm ? `Delete “${confirm.title}”? This can't be undone.` : ""} confirmLabel="Delete" onConfirm={() => del(confirm)} onClose={() => setConfirm(null)} />
    </div>
  );
}

function CannedSort({ value, onChange }) {
  const [open, setOpen] = useState(false); const ref = useRef(null);
  useClickAway(ref, () => setOpen(false));
  const opts = ["Response Title", "Category", "Created Date", "Updated Date", "Usage Count"];
  return (
    <div className="dd-wrap" ref={ref}>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}><ArrowUpDown size={14} /> {value} <ChevronDown size={13} /></button>
      {open && <div className="menu menu-top right" style={{ minWidth: 170 }}>{opts.map((o) => <button key={o} className="mi" style={{ padding: "8px 11px" }} onClick={() => { onChange(o); setOpen(false); }}>{o}{value === o && <CheckCheck size={14} style={{ marginLeft: "auto" }} />}</button>)}</div>}
    </div>
  );
}

/* ==========================================================================
   THE THREE MODULE SCREENS
   ==========================================================================
   Auto-closure, forwarding and tagged notifications were three tables of
   seeded rows: editing did nothing, toggling changed a local boolean, and a
   refresh put the invented rows back. They are now three views of the one
   fd_automations table the engine actually reads, filtered by the rule's
   "kind". Everything on them -- the switch, the pencil, the copy, the bin --
   goes to the server.

   Each panel builds a structured rule. The engine never receives a sentence
   it has to interpret; the prose in the Conditions column is rendered FROM
   the structure, not parsed back into it.
   ========================================================================== */

const COND_FIELDS = [
  { k: "subject", label: "Email Subject" },
  { k: "description", label: "Email Body" },
  { k: "subject_or_description", label: "Subject or Body" },
  { k: "from_email", label: "Sender Email" },
  { k: "from_name", label: "Sender Name" },
  { k: "category", label: "Ticket Category" },
  { k: "status", label: "Ticket Status" },
  { k: "priority", label: "Priority" },
  { k: "agent", label: "Assigned Agent" },
  { k: "tags", label: "Tags" },
];

const COND_OPS = [
  { k: "contains", label: "contains" },
  { k: "not_contains", label: "does not contain" },
  { k: "is", label: "is exactly" },
  { k: "is_not", label: "is not" },
  { k: "starts_with", label: "starts with" },
  { k: "ends_with", label: "ends with" },
  { k: "any_of", label: "is any of" },
  { k: "is_empty", label: "is empty" },
  { k: "is_not_empty", label: "is not empty" },
];

/* "is empty" has nothing to compare against, so its value box is hidden. */
const opTakesValue = (op) => op !== "is_empty" && op !== "is_not_empty";

const labelOfField = (k) => (COND_FIELDS.find((f) => f.k === k) || { label: k }).label;
const labelOfOp = (k) => (COND_OPS.find((o) => o.k === k) || { label: String(k).replace(/_/g, " ") }).label;

/** One condition, in words. */
function condText(c) {
  const head = `${labelOfField(c.field)} ${labelOfOp(c.op)}`;
  return opTakesValue(c.op) ? `${head} "${c.value ?? ""}"` : head;
}

/** A rule's whole condition set, joined by the way it actually combines them. */
function condsText(rule) {
  const cs = rule.conditions || [];
  if (!cs.length) return "Every ticket";
  return cs.map(condText).join(rule.matchType === "any" ? " OR " : " AND ");
}

const blankCond = (field = "subject") => ({ field, op: "contains", value: "" });

/* The trigger a rule listens on, in the words the rest of the screen uses. */
const TRIGGERS = [
  { k: "ticket_created", label: "Email Received" },
  { k: "ticket_updated", label: "Ticket Updated" },
  { k: "tag_added", label: "Tag Added" },
];

/** The shared condition-row editor. */
function ConditionBuilder({ conds, setConds, match, setMatch }) {
  const patch = (i, p) => setConds((cs) => cs.map((c, j) => (j === i ? { ...c, ...p } : c)));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Match conditions</label>
        <div className="andor">
          <button className={match === "all" ? "on" : ""} onClick={() => setMatch("all")}>AND</button>
          <button className={match === "any" ? "on" : ""} onClick={() => setMatch("any")}>OR</button>
        </div>
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
          {match === "all" ? "every condition must hold" : "any one condition is enough"}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {conds.map((c, i) => (
          <div className="builder-row" key={i}>
            <select value={c.field} onChange={(e) => patch(i, { field: e.target.value })}>
              {COND_FIELDS.map((f) => <option key={f.k} value={f.k}>{f.label}</option>)}
            </select>
            <select value={c.op} onChange={(e) => patch(i, { op: e.target.value })}>
              {COND_OPS.map((o) => <option key={o.k} value={o.k}>{o.label}</option>)}
            </select>
            {opTakesValue(c.op) && (
              <input style={{ flex: 1, minWidth: 160 }}
                     placeholder={c.op === "any_of" ? "keywords, comma separated" : "value"}
                     value={c.value} onChange={(e) => patch(i, { value: e.target.value })} />
            )}
            {conds.length > 1 && (
              <button className="row-act" style={{ border: 0, background: "transparent" }}
                      onClick={() => setConds((cs) => cs.filter((_, j) => j !== i))}>
                <Trash2 size={16} color="var(--danger)" />
              </button>
            )}
          </div>
        ))}
      </div>
      <button className="btn btn-soft btn-sm" style={{ marginTop: 10 }}
              onClick={() => setConds((cs) => [...cs, blankCond("description")])}>
        <Plus size={14} /> Add condition
      </button>
    </div>
  );
}

/** The row of buttons every rule table repeats. */
function RuleRowActions({ r, onTest, onEdit, onDuplicate, onDelete }) {
  const [ask, setAsk] = useState(null);
  /* The dialog is a sibling of the button row, not a child: .row-act is a
     flex container and the overlay has no business being one of its items. */
  return (
    <>
      <div className="row-act" style={{ justifyContent: "flex-end" }}>
        {onTest && <button title="Dry run against the latest ticket" onClick={() => onTest(r)}><Play size={15} /></button>}
        <button title="Edit" onClick={() => onEdit(r)}><Pencil size={15} /></button>
        <button title="Duplicate" onClick={() => onDuplicate(r)}><Copy size={15} /></button>
        <button className="danger" title="Delete" onClick={() => setAsk(r)}><Trash2 size={15} /></button>
      </div>
      <ConfirmDialog open={!!ask} danger title="Delete automation" confirmLabel="Delete"
        message={ask ? `Delete "${ask.name}"? Tickets it has already acted on are not changed.` : ""}
        onConfirm={() => onDelete(ask)} onClose={() => setAsk(null)} />
    </>
  );
}

/* An empty table should say why it is empty rather than show nothing. */
function NoRules({ what }) {
  return (
    <tr><td colSpan={9} style={{ padding: "34px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
      No {what} yet. Use the button above to create one.
    </td></tr>
  );
}

/* ------------------------------------------------------- auto closure ---- */

/*
 * The actions this builder offers are exactly the ones the engine implements.
 * Each carries how to turn the agent's input into the action the engine reads,
 * and how to read one back when the rule is opened for editing.
 */
const CLOSE_ACTS = [
  { k: "close",    label: "Close Ticket",       icon: MailX,        build: () => ({ type: "set_status", value: "Closed" }),
    match: (a) => a.type === "set_status" && a.value === "Closed" },
  { k: "resolve",  label: "Mark as Resolved",   icon: CheckCircle2, build: () => ({ type: "set_status", value: "Resolved" }),
    match: (a) => a.type === "set_status" && a.value === "Resolved" },
  { k: "priority", label: "Set Priority",       icon: ArrowUpDown,  input: "select", opts: ["Low", "Medium", "High", "Urgent"],
    build: (v) => ({ type: "set_priority", value: v || "Medium" }), match: (a) => a.type === "set_priority" },
  { k: "tag",      label: "Add Tag",            icon: TagIcon,      input: "text", ph: "Spam, Auto-closed",
    build: (v) => ({ type: "add_tag", value: v }), match: (a) => a.type === "add_tag" },
  { k: "category", label: "Assign Category",    icon: FolderInput,  input: "text", ph: "Billing",
    build: (v) => ({ type: "set_category", value: v }), match: (a) => a.type === "set_category" },
  { k: "agent",    label: "Assign Agent",       icon: UserIcon,     input: "text", ph: "Agent's full name",
    build: (v) => ({ type: "assign_agent", value: v }), match: (a) => a.type === "assign_agent" },
  { k: "notify",   label: "Notify by Email",    icon: BellRing,     input: "text", ph: "ops@istudio.in",
    build: (v) => ({ type: "notify", value: v }), match: (a) => a.type === "notify" },
  { k: "canned",   label: "Send Canned Reply",  icon: Send,         input: "text", ph: "Canned response name",
    build: (v) => ({ type: "send_canned", value: v }), match: (a) => a.type === "send_canned" },
];

/** Server actions -> the builder's { key: value } selection. */
function actsToState(actions) {
  const out = {};
  (actions || []).forEach((a) => {
    const spec = CLOSE_ACTS.find((c) => c.match(a));
    if (spec) out[spec.k] = spec.input ? String(a.value ?? "") : true;
  });
  return out;
}

/** One action, in words, for the table's Action column. */
function actText(a) {
  switch (a.type) {
    case "set_status":   return a.value === "Resolved" ? "Mark as Resolved" : "Close Ticket";
    case "set_priority": return `Priority → ${a.value}`;
    case "add_tag":      return `Tag "${a.value}"`;
    case "set_category": return `Category → ${a.value}`;
    case "assign_agent": return `Assign ${a.value}`;
    case "forward":      return `Forward to ${a.value}`;
    case "notify":       return `Notify ${a.value}`;
    case "send_canned":  return `Send "${a.value}"`;
    default:             return a.type;
  }
}
const actsText = (r) => ((r.actions || []).map(actText).join(" + ") || "—");

function AutoClosureRules({ rules, openFor, onSave, onToggle, onDuplicate, onDelete, onTest }) {
  const push = useToast();
  const rows = rules.filter((r) => r.kind === "closure");

  const [editing, setEditing] = useState(null);      // null | the rule | "new"
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("ticket_created");
  const [match, setMatch] = useState("all");
  const [conds, setConds] = useState([blankCond()]);
  const [acts, setActs] = useState({ close: true });

  const startNew = () => {
    setEditing("new"); setName(""); setTrigger("ticket_created");
    setMatch("all"); setConds([blankCond()]); setActs({ resolve: true });
  };
  const startEdit = (r) => {
    setEditing(r); setName(r.name); setTrigger(r.event || "ticket_created");
    setMatch(r.matchType || "all");
    setConds((r.conditions || []).length ? r.conditions.map((c) => ({ ...c })) : [blankCond()]);
    setActs(actsToState(r.actions));
  };
  const close = () => setEditing(null);

  /* The master table's pencil and the header's Create button both ask this
     panel to open. The nonce is what makes asking twice for the same rule
     work -- without it the second click would change nothing. */
  useEffect(() => {
    if (!openFor || openFor.kind !== "closure") return;
    if (openFor.id) {
      const r = rules.find((x) => x.id === openFor.id);
      if (r) startEdit(r);
    } else {
      startNew();
    }
  }, [openFor]);   // eslint-disable-line react-hooks/exhaustive-deps


  const toggleAct = (k) => setActs((a) => {
    const next = { ...a };
    if (k in next) delete next[k];
    else next[k] = (CLOSE_ACTS.find((c) => c.k === k) || {}).input ? "" : true;
    return next;
  });

  const save = async () => {
    if (!name.trim()) { push({ type: "error", title: "Give the rule a name" }); return; }
    const actions = CLOSE_ACTS.filter((c) => c.k in acts).map((c) => c.build(acts[c.k]));
    if (!actions.length) { push({ type: "error", title: "Pick at least one action" }); return; }
    const ok = await onSave({
      id: editing === "new" ? 0 : editing.id,
      name: name.trim(), event: trigger, kind: "closure", match_type: match,
      conditions: conds.filter((c) => !opTakesValue(c.op) || String(c.value).trim() !== ""),
      actions, is_active: editing === "new" ? true : editing.active,
    }, editing === "new" ? "Rule created" : "Rule updated");
    if (ok) close();
  };

  return (
    <div className="card panel">
      <div className="panel-head">
        <div className="panel-title"><span className="pic" style={{ background: "#0EA5E918", color: "#0EA5E9" }}><MailX size={19} /></span>Automatic Email Closure by Keywords</div>
        <button className="btn btn-primary btn-sm" onClick={() => (editing ? close() : startNew())}>
          {editing ? <><X size={15} /> Cancel</> : <><PlusCircle size={15} /> New Rule</>}
        </button>
      </div>

      {editing && (
        <div style={{ padding: 20, borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 16, background: "var(--surface-2)" }}>
          <div className="grid2">
            <div className="fld"><label>Rule Name</label><input placeholder="e.g. Auto-close survey replies" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="fld"><label>Run when</label>
              <select value={trigger} onChange={(e) => setTrigger(e.target.value)}>
                {TRIGGERS.map((t) => <option key={t.k} value={t.k}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <ConditionBuilder conds={conds} setConds={setConds} match={match} setMatch={setMatch} />

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 10 }}>Actions to perform</label>
            <div className="chips">
              {CLOSE_ACTS.map((a) => (
                <button key={a.k} className={`fchip ${a.k in acts ? "on" : ""}`} onClick={() => toggleAct(a.k)}>
                  <a.icon size={13} /> {a.label}
                </button>
              ))}
            </div>
            {/* An action that needs a value gets its own box, so "Add Tag" cannot
                be saved as a tag with no name. */}
            {CLOSE_ACTS.filter((a) => a.k in acts && a.input).map((a) => (
              <div className="fld" key={a.k} style={{ maxWidth: 340, marginTop: 12 }}>
                <label>{a.label}</label>
                {a.input === "select"
                  ? <select value={acts[a.k] || a.opts[1]} onChange={(e) => setActs((s) => ({ ...s, [a.k]: e.target.value }))}>
                      {a.opts.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  : <input placeholder={a.ph} value={acts[a.k] || ""} onChange={(e) => setActs((s) => ({ ...s, [a.k]: e.target.value }))} />}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={save}><Check size={15} /> {editing === "new" ? "Save Rule" : "Save Changes"}</button>
            <button className="btn btn-soft btn-sm" onClick={close}>Discard</button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table><thead><tr><th>Rule Name</th><th>Conditions</th><th>Action</th><th>Status</th><th>Last Run</th><th>Triggers</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
          <tbody>
            {rows.length === 0 ? <NoRules what="closure rules" /> : rows.map((r) => (
              <tr key={r.id}>
                <td className="rname">{r.name}</td>
                <td style={{ maxWidth: 260, fontSize: 12.5, color: "var(--muted)" }}>{condsText(r)}</td>
                <td><span className="fchip" style={{ cursor: "default" }}>{actsText(r)}</span></td>
                <td><Switch on={r.active} onChange={(v) => onToggle(r, v)} /></td>
                <td style={{ color: "var(--muted)", fontSize: 12.5 }}>{r.lastRun || "never"}</td>
                <td style={{ fontWeight: 700 }}>{r.runs}</td>
                <td><RuleRowActions r={r} onTest={onTest} onEdit={startEdit} onDuplicate={onDuplicate} onDelete={onDelete} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- forwarding ---- */

function EmailForwarding({ rules, openFor, onSave, onToggle, onDuplicate, onDelete, onTest }) {
  const push = useToast();
  const rows = rules.filter((r) => r.kind === "forward");
  const [open, setOpen] = useState(null);            // null | "new" | the rule
  const empty = { name: "", trigger: "ticket_created", match: "all", dest: "", cc: "", bcc: "", note: "" };
  const [form, setForm] = useState(empty);
  const [conds, setConds] = useState([blankCond("category")]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const startNew = () => { setOpen("new"); setForm(empty); setConds([{ field: "category", op: "is", value: "" }]); };
  const startEdit = (r) => {
    const a = (r.actions || []).find((x) => x.type === "forward") || {};
    setOpen(r);
    setForm({ name: r.name, trigger: r.event || "ticket_created", match: r.matchType || "all",
              dest: a.value || "", cc: a.cc || "", bcc: a.bcc || "", note: a.note || "" });
    setConds((r.conditions || []).length ? r.conditions.map((c) => ({ ...c })) : [blankCond("category")]);
  };


  /* The master table's pencil and the header's Create button both ask this
     panel to open. The nonce is what makes asking twice for the same rule
     work -- without it the second click would change nothing. */
  useEffect(() => {
    if (!openFor || openFor.kind !== "forward") return;
    if (openFor.id) {
      const r = rules.find((x) => x.id === openFor.id);
      if (r) startEdit(r);
    } else {
      startNew();
    }
  }, [openFor]);   // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!form.name.trim()) { push({ type: "error", title: "Give the rule a name" }); return; }
    if (!form.dest.trim()) { push({ type: "error", title: "Add a destination address" }); return; }
    const ok = await onSave({
      id: open === "new" ? 0 : open.id,
      name: form.name.trim(), event: form.trigger, kind: "forward", match_type: form.match,
      conditions: conds.filter((c) => !opTakesValue(c.op) || String(c.value).trim() !== ""),
      actions: [{ type: "forward", value: form.dest.trim(), cc: form.cc.trim(), bcc: form.bcc.trim(), note: form.note.trim() }],
      is_active: open === "new" ? true : open.active,
    }, open === "new" ? "Forwarding rule created" : "Forwarding rule updated");
    if (ok) setOpen(null);
  };

  const destOf = (r) => {
    const a = (r.actions || []).find((x) => x.type === "forward");
    return a ? a.value : "—";
  };

  return (
    <div className="card panel">
      <div className="panel-head">
        <div className="panel-title"><span className="pic" style={{ background: "#F59E0B18", color: "#F59E0B" }}><Forward size={19} /></span>Email Forwarding Automation</div>
        <button className="btn btn-primary btn-sm" onClick={startNew}><PlusCircle size={15} /> New Forwarding Rule</button>
      </div>
      <div className="table-wrap">
        <table><thead><tr><th>Rule Name</th><th>Destination</th><th>Condition</th><th>Status</th><th>Last Triggered</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
          <tbody>
            {rows.length === 0 ? <NoRules what="forwarding rules" /> : rows.map((r) => (
              <tr key={r.id}>
                <td className="rname">{r.name}</td>
                <td><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}><Mail size={14} color="var(--muted)" /> {destOf(r)}</span></td>
                <td><span className="fchip" style={{ cursor: "default" }}>{condsText(r)}</span></td>
                <td><Switch on={r.active} onChange={(v) => onToggle(r, v)} /></td>
                <td style={{ color: "var(--muted)", fontSize: 12.5 }}>{r.lastRun || "never"}</td>
                <td><RuleRowActions r={r} onTest={onTest} onEdit={startEdit} onDuplicate={onDuplicate} onDelete={onDelete} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#F59E0B18", color: "#F59E0B", width: 32, height: 32 }}><Forward size={16} /></span>{open === "new" ? "New Forwarding Rule" : "Edit Forwarding Rule"}</div>
              <button className="icon-btn" onClick={() => setOpen(null)}><X size={17} /></button>
            </div>
            <div className="modal-body">
              <div className="grid2">
                <div className="fld"><label>Rule Name</label><input placeholder="e.g. Refunds → Finance team" value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
                <div className="fld"><label>Run when</label>
                  <select value={form.trigger} onChange={(e) => set("trigger", e.target.value)}>
                    {TRIGGERS.map((t) => <option key={t.k} value={t.k}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <ConditionBuilder conds={conds} setConds={setConds} match={form.match} setMatch={(v) => set("match", v)} />
              <div className="fld"><label>Destination Email(s)</label><input placeholder="finance@istudio.in, ops@istudio.in" value={form.dest} onChange={(e) => set("dest", e.target.value)} /></div>
              <div className="grid2">
                <div className="fld"><label>CC</label><input placeholder="cc@istudio.in" value={form.cc} onChange={(e) => set("cc", e.target.value)} /></div>
                <div className="fld"><label>BCC</label><input placeholder="bcc@istudio.in" value={form.bcc} onChange={(e) => set("bcc", e.target.value)} /></div>
              </div>
              <div className="fld"><label>Covering note (optional)</label>
                <textarea placeholder="Left empty, the forward says which rule sent it. Merge tags work here." value={form.note} onChange={(e) => set("note", e.target.value)} />
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>The original conversation is always quoted underneath.</p>
            </div>
            <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={() => setOpen(null)}>Cancel</button><button className="btn btn-primary btn-sm" onClick={save}><Check size={15} /> {open === "new" ? "Create Rule" : "Save Changes"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------ tagged notifications --- */

function TaggedNotifications({ rules, openFor, onSave, onToggle, onDuplicate, onDelete, onTest }) {
  const push = useToast();
  const rows = rules.filter((r) => r.kind === "notify");
  const [open, setOpen] = useState(null);
  const DEFAULT_TPL = "Ticket {Ticket ID} from {Customer Name} was tagged.\nSubject: {Ticket Subject}\nStatus: {Status} · Priority: {Priority}";
  const empty = { name: "", tag: "Urgent", recip: "", tpl: DEFAULT_TPL };
  const [form, setForm] = useState(empty);
  const taRef = useRef(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const startNew = () => { setOpen("new"); setForm(empty); };
  const startEdit = (r) => {
    const a = (r.actions || []).find((x) => x.type === "notify") || {};
    const tagCond = (r.conditions || []).find((c) => c.field === "tags") || {};
    setOpen(r);
    setForm({ name: r.name, tag: tagCond.value || "Urgent", recip: a.value || "", tpl: a.template || DEFAULT_TPL });
  };

  const insert = (token) => { set("tpl", `${form.tpl} ${token}`); taRef.current?.focus(); };

  /* The master table's pencil and the header's Create button both ask this
     panel to open. The nonce is what makes asking twice for the same rule
     work -- without it the second click would change nothing. */
  useEffect(() => {
    if (!openFor || openFor.kind !== "notify") return;
    if (openFor.id) {
      const r = rules.find((x) => x.id === openFor.id);
      if (r) startEdit(r);
    } else {
      startNew();
    }
  }, [openFor]);   // eslint-disable-line react-hooks/exhaustive-deps


  const save = async () => {
    if (!form.recip.trim()) { push({ type: "error", title: "Add at least one recipient" }); return; }
    const ok = await onSave({
      id: open === "new" ? 0 : open.id,
      name: form.name.trim() || `${form.tag} tag alert`,
      // A tagged notification is, definitionally, "when this tag appears".
      event: "tag_added", kind: "notify", match_type: "all",
      conditions: [{ field: "tags", op: "contains", value: form.tag }],
      actions: [{ type: "notify", value: form.recip.trim(), template: form.tpl }],
      is_active: open === "new" ? true : open.active,
    }, open === "new" ? "Notification created" : "Notification updated");
    if (ok) setOpen(null);
  };

  const tagOf = (r) => ((r.conditions || []).find((c) => c.field === "tags") || {}).value || "—";
  const recipOf = (r) => ((r.actions || []).find((x) => x.type === "notify") || {}).value || "—";

  return (
    <div className="card panel">
      <div className="panel-head">
        <div className="panel-title"><span className="pic" style={{ background: "#EC489918", color: "#EC4899" }}><BellRing size={19} /></span>Tagged Email Notifications</div>
        <button className="btn btn-primary btn-sm" onClick={startNew}><PlusCircle size={15} /> New Notification</button>
      </div>
      <div className="table-wrap">
        <table><thead><tr><th>Tag</th><th>Recipients</th><th>Rule</th><th>Status</th><th>Last Sent</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
          <tbody>
            {rows.length === 0 ? <NoRules what="tag notifications" /> : rows.map((r) => (
              <tr key={r.id}>
                <td><span className="fchip on" style={{ cursor: "default" }}><TagIcon size={12} /> {tagOf(r)}</span></td>
                <td style={{ fontSize: 12.5 }}>{recipOf(r)}</td>
                <td className="rname">{r.name}</td>
                <td><Switch on={r.active} onChange={(v) => onToggle(r, v)} /></td>
                <td style={{ color: "var(--muted)", fontSize: 12.5 }}>{r.lastRun || "never"}</td>
                <td><RuleRowActions r={r} onTest={onTest} onEdit={startEdit} onDuplicate={onDuplicate} onDelete={onDelete} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#EC489918", color: "#EC4899", width: 32, height: 32 }}><BellRing size={16} /></span>{open === "new" ? "New Tagged Notification" : "Edit Notification"}</div>
              <button className="icon-btn" onClick={() => setOpen(null)}><X size={17} /></button>
            </div>
            <div className="modal-body">
              <div className="fld"><label>Rule Name</label><input placeholder={`${form.tag} tag alert`} value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 10 }}>Trigger tag</label>
                <div className="chips">{TAGS.map((t) => <button key={t} className={`fchip ${form.tag === t ? "on" : ""}`} onClick={() => set("tag", t)}>{t}</button>)}</div>
              </div>
              <div className="fld"><label>Recipients (comma separated)</label><input placeholder="ops@istudio.in, lead@istudio.in" value={form.recip} onChange={(e) => set("recip", e.target.value)} /></div>
              <div className="fld"><label>Notification Template</label>
                <div className="chips" style={{ marginBottom: 8 }}>{PLACEHOLDERS.map((p) => <button key={p} className="token" onClick={() => insert(p)}><Plus size={11} /> {p}</button>)}</div>
                <textarea ref={taRef} value={form.tpl} onChange={(e) => set("tpl", e.target.value)} />
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                Sent to your own team as a plain email. It is not added to the customer's ticket.
              </p>
            </div>
            <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={() => setOpen(null)}>Cancel</button><button className="btn btn-primary btn-sm" onClick={save}><Check size={15} /> {open === "new" ? "Create Notification" : "Save Changes"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
/*
 * Every number here is counted by the server from fd_automations and
 * fd_automation_log. There is nothing to show before a rule has run, so a
 * fresh desk reads zero rather than borrowing someone else's figures.
 */
function AutomationAnalytics({ stats, days, onDays }) {
  const k = (stats && stats.kpis) || {};
  const week = (stats && stats.week) || [];
  const dist = ((stats && stats.dist) || []).filter((d) => d.value > 0);
  const totalRules = dist.reduce((a, d) => a + d.value, 0);
  const rate = Number(k.successRate) || 0;

  const cards = [
    { lab: "Total Automation Rules", val: k.totalRules ?? 0, color: "#5B5CEB", icon: Zap },
    { lab: "Active Rules", val: k.activeRules ?? 0, color: "#10B981", icon: Play },
    { lab: "Disabled Rules", val: k.disabledRules ?? 0, color: "#F59E0B", icon: Pause },
    { lab: "Emails Forwarded Today", val: k.forwardedToday ?? 0, color: "#0EA5E9", icon: Forward },
    { lab: "Tickets Auto Closed", val: k.ticketsClosed ?? 0, color: "#8B5CF6", icon: MailX },
    { lab: "Notifications Sent", val: k.notificationsSent ?? 0, color: "#EC4899", icon: BellRing },
    { lab: "Canned Replies Sent", val: k.cannedSent ?? 0, color: "#10B981", icon: MessageSquareText },
    { lab: "Rule Runs", val: k.runs ?? 0, color: "#5B5CEB", icon: TrendingUp },
  ];

  return (
    <div className="panel">
      <div className="section-head">
        <div><h3 className="card-title" style={{ fontSize: 17 }}>Automation Analytics</h3><p className="card-sub">Performance and impact across all automation rules</p></div>
        <button className="btn btn-soft btn-sm" onClick={() => onDays(days === 30 ? 7 : days === 7 ? 90 : 30)}>Last {days} days</button>
      </div>
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        {cards.map((c) => (<div className="card kpi" key={c.lab}><div className="ic" style={{ background: `${c.color}18`, color: c.color }}><c.icon size={22} /></div><div><div className="val">{c.val}</div><div className="lab">{c.lab}</div></div></div>))}
      </div>
      <div className="analytics-grid">
        <div className="card card-pad">
          <h4 className="card-title" style={{ marginBottom: 4 }}>Automations Triggered</h4><p className="card-sub" style={{ marginBottom: 12 }}>Rule runs over the past week</p>
          <div style={{ height: 220 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={week} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="t" tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--hover)" }} />
            <Bar dataKey="runs" name="Rule runs" fill="#5B5CEB" radius={[7, 7, 0, 0]} maxBarSize={34} />
          </BarChart></ResponsiveContainer></div>
        </div>
        <div className="card card-pad">
          <h4 className="card-title" style={{ marginBottom: 4 }}>Success Rate</h4><p className="card-sub" style={{ marginBottom: 12 }}>Runs where the rule actually applied something</p>
          <div className="ring-wrap"><RingLg pct={rate} color="#10B981" /><b style={{ color: "#10B981" }}>{rate}%</b></div>
          <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 14, fontSize: 12.5 }}>
            <span style={{ color: "var(--muted)" }}><b style={{ color: "var(--success)" }}>{k.succeeded ?? 0}</b> applied</span>
            <span style={{ color: "var(--muted)" }}><b style={{ color: "var(--danger)" }}>{k.failed ?? 0}</b> skipped</span>
          </div>
        </div>
        <div className="card card-pad">
          <h4 className="card-title" style={{ marginBottom: 4 }}>Rule Distribution</h4><p className="card-sub" style={{ marginBottom: 8 }}>By type · {totalRules} rules</p>
          {totalRules === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "24px 0" }}>No rules yet.</p>
          ) : (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 130, height: 130, position: "relative", flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={dist} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2} stroke="none">{dist.map((d) => <Cell key={d.name} fill={d.color} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart></ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}><div style={{ fontSize: 20, fontWeight: 800 }}>{totalRules}</div></div>
              </div>
              <div style={{ flex: 1 }}>{dist.map((d) => (<div className="dist-row" key={d.name}><span className="dotc" style={{ background: d.color, width: 9, height: 9 }} /><span className="nm">{d.name}</span><span className="ct">{d.value}</span></div>))}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* The trigger and headline-action labels the tables show. */
const LABEL_OF_EVENT = { ticket_created: "Email Received", ticket_updated: "Ticket Updated",
                         tag_added: "Tag Added" };

const TYPE_OF_ACTION = { set_status: "Auto Close Ticket", forward: "Email Forwarding",
                         notify: "Tagged Notification", send_canned: "Canned Response",
                         set_priority: "Auto Close Ticket", assign_agent: "Auto Close Ticket",
                         add_tag: "Tagged Notification", set_category: "Auto Close Ticket" };

/* Which module screen a rule belongs to, if the server has not said. */
const KIND_OF_ACTION = { forward: "forward", notify: "notify", send_canned: "canned" };

/** Server row -> what this screen renders. The structure is kept intact. */
function shapeRule(r) {
  const actions = Array.isArray(r.actions) ? r.actions : [];
  const conditions = Array.isArray(r.conditions) ? r.conditions : [];
  const first = actions[0] || {};
  return {
    id: r.id,
    name: r.name,
    desc: r.description || "",
    event: r.event || "ticket_created",
    kind: r.kind || KIND_OF_ACTION[first.type] || "closure",
    matchType: r.match_type === "any" ? "any" : "all",
    conditions,
    actions,
    type: TYPE_OF_ACTION[first.type] || "Auto Close Ticket",
    trigger: LABEL_OF_EVENT[r.event] || "Ticket Created",
    priority: "Medium",
    active: Number(r.is_active) === 1,
    runs: Number(r.runs) || 0,
    lastRun: r.lastRunAgo || "",
    created: r.created_at ? String(r.created_at).slice(0, 10) : "",
    modified: r.updatedAgo || r.lastRunAgo || "",
    raw: r,
  };
}

/*
 * The canned-response library lives in Settings, where it is backed by
 * fd_canned_responses and its folders. This card says so rather than offering a
 * second, non-persisting copy of it.
 */
function CannedPointer({ go }) {
  return (
    <div className="card panel">
      <div className="panel-head">
        <div className="panel-title">
          <span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB" }}><MessageSquareText size={19} /></span>
          Canned Responses
        </div>
      </div>
      <div style={{ padding: "18px 20px 22px" }}>
        <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.65, maxWidth: 620 }}>
          The library is managed in <b>Settings → Canned Responses</b>: folders, the rich-text
          editor, short codes, and which responses agents can reach with <code>/c</code>.
          The switch above only controls whether automations are allowed to send them.
        </p>
        <button className="btn btn-primary btn-sm" onClick={() => go && go("settings/canned")}>
          <MessageSquareText size={15} /> Open canned responses
        </button>
      </div>
    </div>
  );
}

function AutomationPage({ onTheme, go, section, onSection }) {
  const push = useToast();
  const [modules, setModules] = useState(MODULES);
  /* Which module is open, from the URL when there is one. */
  const [selFallback, setSelFallback] = useState("closure");
  const sel = MODULES.some((m) => m.key === section) ? section : selFallback;
  const setSel = (k) => { setSelFallback(k); if (onSection) onSection(k); };
  const [q, setQ] = useState("");
  const [rules, setRules] = useState([]);
  const [canned, setCanned] = useState(CANNED_INIT);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [days, setDays] = useState(30);
  /* Which panel should open its builder, and on which rule. */
  const [openFor, setOpenFor] = useState(null);

  /* Send the editor to the module the rule belongs to. A forwarding rule is
     edited on the forwarding screen; there is nowhere else it makes sense. */
  const editIn = (kind, id = 0) => { setSel(kind); setOpenFor({ kind, id, n: Date.now() }); };

  /*
   * Load the rules, the module switches and the run log together.
   * One place, so a save can simply call it again rather than each handler
   * patching local state and hoping it matches the server.
   */
  const reload = useCallback(async () => {
    try {
      const [a, l, st] = await Promise.all([
        fdMessages.automations(),
        fdMessages.automationLog(40).catch(() => ({ log: [] })),
        fdMessages.automationStats(days).catch(() => null),
      ]);
      if (st) setStats(st);
      setRules((a.rules || []).map(shapeRule));
      const m = a.modules || {};
      setModules((ms) => ms.map((x) => ({
        ...x,
        active: x.key === "canned" ? m.canned !== false
              : x.key === "closure" ? m.auto_close !== false
              : x.key === "forward" ? m.forwarding !== false
              : m.tagged_notif !== false,
      })));
      setLogs((l.log || []).map((r) => ({
        id: r.id,
        when: r.ago,
        user: r.rule_name || "Automation",
        action: (r.applied || []).length
          ? `${r.rule_name}: ${(r.applied || []).join(", ")} on #${r.ticket_id}`
          : `${r.rule_name}: nothing applied on #${r.ticket_id}${(r.skipped || []).length ? " (" + r.skipped.join("; ") + ")" : ""}`,
        module: "Automation",
        status: (r.applied || []).length ? "Success" : "Info",
      })));
    } catch (err) {
      push({ type: "error", title: "Could not load automations", desc: err.message });
    }
  }, [push, days]);
  useEffect(() => { reload(); }, [reload]);
  const [viewRule, setViewRule] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 600); return () => clearTimeout(t); }, []);

  const log = (action, module, status = "Success") => setLogs((l) => [{ id: uid(), when: "just now", user: "Admin", action, module, status }, ...l]);
  /*
   * A module switch gates the corresponding ACTION inside the engine. A rule
   * can stay enabled while its action type is off globally; the run log then
   * records "forwarding module off" rather than silently doing nothing.
   */
  const MOD_SETTING = { canned: "canned", closure: "auto_close", forward: "forwarding", notify: "tagged_notif" };
  const toggleMod = async (key, v) => {
    setModules((ms) => ms.map((m) => (m.key === key ? { ...m, active: v } : m)));   // optimistic
    try {
      await fdMessages.automationModules({ [MOD_SETTING[key]]: v });
      push({ type: "success", title: `${v ? "Enabled" : "Disabled"} ${key}` });
    } catch (err) {
      setModules((ms) => ms.map((m) => (m.key === key ? { ...m, active: !v } : m)));  // roll back
      push({ type: "error", title: "Could not save that switch", desc: err.message });
    }
  };
  const activeCount = modules.filter((m) => m.active).length;
  const shown = modules.filter((m) => (m.title + m.desc).toLowerCase().includes(q.toLowerCase()));

  /*
   * The dialog collects prose ("Subject contains X", "Forward to a@b.com").
   * Rules are structured, so the prose is parsed into one condition and one
   * action here -- the engine never sees a sentence it has to interpret.
   */
  /* Enable / disable one rule. Optimistic, rolled back on failure. */
  const toggleRule = async (r, v) => {
    setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, active: v } : x)));
    try {
      await fdMessages.automationToggle(r.id, v);
    } catch (err) {
      setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, active: !v } : x)));
      push({ type: "error", title: "Could not change that rule", desc: err.message });
    }
  };

  /* Duplicating saves a real copy -- the point is to edit it, which needs an id. */
  const duplicateRule = async (r) => {
    const raw = r.raw || {};
    try {
      await fdMessages.automationSave({
        id: 0,
        name: "Copy of " + r.name,
        description: raw.description || "",
        event: raw.event || "ticket_created",
        conditions: raw.conditions || [],
        actions: raw.actions || [],
        is_active: false,          // a copy starts off, so it cannot act unreviewed
      });
      push({ type: "success", title: "Automation duplicated", desc: "The copy is disabled until you enable it." });
      await reload();
    } catch (err) {
      push({ type: "error", title: "Could not duplicate", desc: err.message });
    }
  };

  const deleteRule = async (r) => {
    try {
      await fdMessages.automationDelete(r.id);
      push({ type: "success", title: "Automation deleted" });
      await reload();
    } catch (err) {
      push({ type: "error", title: "Could not delete", desc: err.message });
    }
  };

  /*
   * The panels build a finished rule, so this just posts it. It returns a
   * boolean rather than throwing, because the caller's job is only to decide
   * whether to close its form.
   */
  const saveRaw = async (payload, okTitle) => {
    try {
      await fdMessages.automationSave(payload);
      push({ type: "success", title: okTitle || "Saved", desc: payload.name });
      await reload();
      return true;
    } catch (err) {
      push({ type: "error", title: "Could not save that rule", desc: err.message });
      return false;
    }
  };

  /*
   * Dry run: does this rule match the newest ticket, and what would it do?
   * Nothing is sent and nothing is logged -- this is how you check a rule
   * before turning it loose on the mailbox.
   */
  const testRule = async (r) => {
    try {
      const res = await fdMessages.automationTest({ rule_id: r.id });
      const hit = (res.results || [])[0];
      const on = res.ticket ? `#${res.ticket.id}` : "the latest ticket";
      if (!hit) { push({ type: "error", title: "Rule not found" }); return; }
      if (hit.matches) {
        push({ type: "success", title: `Matches ${on}`,
               desc: (hit.actions || []).map(actText).join(" + ") || "no actions" });
      } else {
        push({ type: "info", title: `Does not match ${on}`,
               desc: "Its conditions do not hold for that ticket." });
      }
    } catch (err) {
      push({ type: "error", title: "Could not test that rule", desc: err.message });
    }
  };  const importCanned = (rows) => {
    setCanned((cs) => [...rows.map((r, i) => ({ id: uid(), title: r.title, cat: r.cat, shortcut: r.shortcut, body: r.body, tags: [], by: r.by, status: r.status === "Inactive" ? "Inactive" : "Active", created: "just now", createdSort: cs.length + i, updated: "just now", uses: 0 })), ...cs]);
    log(`Imported ${rows.length} canned responses`, "Canned Responses"); push({ type: "success", title: "Import complete", desc: `${rows.length} responses added.` });
  };
  const exportCanned = (kind, rows) => {
    try {
      const data = (rows || canned).map((r) => ({ "Response Title": r.title, "Category": r.cat, "Shortcut": r.shortcut, "Status": r.status, "Created By": r.by, "Created Date": r.created, "Last Updated": r.updated }));
      if (kind === "xlsx") exportExcel(data, "canned-responses.xlsx");
      else if (kind === "csv") exportCSV(data, "canned-responses.csv");
      else downloadBlob(JSON.stringify(data, null, 2), "canned-responses.json", "application/json");
      log(`Exported ${data.length} canned responses (${kind.toUpperCase()})`, "Canned Responses"); push({ type: "success", title: "Export ready", desc: `canned-responses.${kind} downloaded.` });
    } catch (e) { push({ type: "error", title: "Export failed" }); }
  };

  return (
    <div className="content route">
      <div className="auto-head fade">
        <div><h1><Zap size={26} color="var(--primary)" /> Automation Center <span className="badge-live"><span className="dotc" style={{ background: "var(--success)" }} /> {activeCount} active</span></h1><p>Automate repetitive support tasks and improve agent productivity.</p></div>
        <div className="head-actions">
          <div className="searchbox" style={{ maxWidth: 220, width: 220, flex: "initial" }}><Search size={16} /><input placeholder="Search modules…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={() => editIn(sel === "canned" ? "closure" : sel)}><PlusCircle size={16} /> Create Automation</button>
          <button className="btn btn-ghost" onClick={() => setImportOpen(true)}><Upload size={16} /> Import</button>
          <button className="btn btn-ghost" onClick={() => exportCanned("xlsx")}><Download size={16} /> Export</button>
          <button className="btn btn-ghost" onClick={onTheme}><Palette size={16} /> Customize Theme</button>
        </div>
      </div>

      <div className="mod-grid">
        {shown.map((m, i) => (
          <div key={m.key} className={`card mod ${sel === m.key ? "sel" : ""}`} style={{ animationDelay: `${i * 70}ms` }} onClick={() => setSel(m.key)}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}><div className="ic" style={{ background: `${m.color}18`, color: m.color }}><m.icon size={22} /></div><Switch on={m.active} onChange={(v) => toggleMod(m.key, v)} /></div>
            <div><h4>{m.title}</h4></div><p>{m.desc}</p>
            <div className="mod-foot"><StatusChip active={m.active} /><span style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: 4 }}>Manage <ChevronDown size={13} style={{ transform: "rotate(-90deg)" }} /></span></div>
          </div>
        ))}
      </div>

      {loading ? <div className="card sk-card" style={{ height: 220 }}><div className="sk" style={{ height: 40, width: "40%" }} /><div className="sk" style={{ flex: 1 }} /></div> : (
        sel === "canned" ? <CannedPointer go={go} />
          : sel === "closure" ? <AutoClosureRules rules={rules} openFor={openFor} onSave={saveRaw} onToggle={toggleRule} onDuplicate={duplicateRule} onDelete={deleteRule} onTest={testRule} />
          : sel === "forward" ? <EmailForwarding rules={rules} openFor={openFor} onSave={saveRaw} onToggle={toggleRule} onDuplicate={duplicateRule} onDelete={deleteRule} onTest={testRule} />
          : <TaggedNotifications rules={rules} openFor={openFor} onSave={saveRaw} onToggle={toggleRule} onDuplicate={duplicateRule} onDelete={deleteRule} onTest={testRule} />
      )}

      <AutomationRulesTable rules={rules} log={log} onToggle={toggleRule} onDuplicate={duplicateRule} onDelete={deleteRule} onEdit={(r) => editIn(r.kind, r.id)} onView={setViewRule} />
      <ActivityLog logs={logs} />
      <AutomationAnalytics stats={stats} days={days} onDays={setDays} />

      <RuleViewModal rule={viewRule} onClose={() => setViewRule(null)} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={importCanned} />
    </div>
  );
}

export {
  ActivityLog,
  AutoClosureRules,
  AutomationAnalytics,
  AutomationPage,
  AutomationRulesTable,
  CANNED_CATS,
  CANNED_CATS_FULL,
  CANNED_INIT,
  CANNED_SEED,
  CANNED_TOKENS,
  CannedModal,
  CannedPreviewModal,
  CannedResponses,
  CannedSort,
  EmailForwarding,
  ImportDialog,
  LOG_STYLE,
  MODULES,
  PLACEHOLDERS,
  RULE_TRIGGERS,
  RULE_TYPES,
  RuleViewModal,
  TAGS,
  TaggedNotifications,
  _CANNED_MAP,
  _CANNED_SHORTCUT,
  _uid,
  fillTokens,
  uid,
};
