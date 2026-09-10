/*
 * src/pages/freshdesk/fdShared.jsx
 *
 * Primitives and cross-cutting plumbing every screen uses: the toast and desk
 * contexts, the small display components (badges, Spinner, Switch, EmptyState),
 * and the export helpers.
 *
 * The rule for what belongs here: it is used by more than one page and it has
 * no opinion about tickets. Anything ticket-shaped lives with its page.
 */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Inbox, Info, Loader2, Paperclip, X, XCircle } from "lucide-react";
import { prioColor, prioStyle, statusStyle } from "./fdConstants";
import { TICKETS } from "./fdStore";

/* SheetJS is not an npm dependency of this project — every other page that writes
   .xlsx (see pages/assessments/TotalAssessments.jsx) pulls it from the CDN on demand.
   The promise is cached, so the script is fetched at most once per page load. */
let sheetJsPromise = null;

function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!sheetJsPromise) {
    sheetJsPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload = () => resolve(window.XLSX);
      s.onerror = () => { sheetJsPromise = null; reject(new Error("Could not load SheetJS")); };
      document.head.appendChild(s);
    });
  }
  return sheetJsPromise;
}

function PrioBadge({ p }) { const s = prioStyle(p); return <span className="badge-pill" style={{background:s.bg,color:s.fg}}><span className="dotc" style={{background:s.fg}} />{p}</span>; }

function StatusBadge({ s }) { const c = statusStyle(s); return <span className="badge-pill" style={{background:c.bg,color:c.fg}}>{s}</span>; }

function useCounter(target, dur = 1100) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf, start;
    const step = (ts) => { if (!start) start = ts; const p = Math.min((ts - start) / dur, 1);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return n;
}

/* ============================================================================
   DASHBOARD INTERACTIVITY — toasts, data, services, modals, panels
   ========================================================================== */
function useClickAway(ref, cb) {
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) cb(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, cb]);
}

const ToastCtx = createContext(() => {});

const useToast = () => useContext(ToastCtx);

/*
 * Live desk API (tickets, mutations, sending, realtime status).
 *
 * A context rather than props because the components that need it -- the reply
 * composer, the settings screens, the connection banner -- sit five or six
 * levels down inside pages that have no other reason to know about the API.
 *
 * The default is a no-op shell rather than undefined so that any component
 * rendered outside the provider (a Storybook-style isolated render, or a page
 * reached before the root mounts) degrades to "no data" instead of throwing on
 * `desk.tickets.map`.
 */
const DeskCtx = createContext({
  tickets: [], counts: {}, agents: [], meta: {},
  loading: false, error: null,
  realtime: { transport: "offline", connected: false, error: null },
  soundOn: true, notifyOn: false,
  sendMessage: async () => { throw new Error("The helpdesk API is not connected."); },
  ensureAgents: async () => {}, ensureMeta: async () => {},
  liveOn: false, setLiveOn: () => {},
  updateTicket: async () => {}, bulkUpdate: async () => {},
  setSpam: async () => {}, setTrash: async () => {}, removeTickets: async () => {},
  mergeTickets: async () => {}, createTicket: async () => {}, markRead: async () => {},
  load: async () => {},
});

const useDesk = () => useContext(DeskCtx);

/**
 * Render children into <body>, outside every stacking context on the page.
 *
 * Anything that must float above the whole app -- drawers, modals, popovers --
 * belongs in one of these. Inside `.content` (position:relative;z-index:1) no
 * z-index value, however large, can paint above the workspace rail, because
 * z-index only competes within the nearest stacking context.
 */
function Portal({ children }) {
  const [host] = useState(() => (typeof document === "undefined" ? null : document.createElement("div")));
  useEffect(() => {
    if (!host) return undefined;
    host.className = "fd-portal";
    /*
     * Mount inside .app, not on <body>.
     *
     * Every colour here is a CSS custom property declared on .app
     * (--surface, --border, --text...). A portal attached to <body> sits
     * OUTSIDE that scope, so var(--surface) resolves to nothing and the drawer
     * renders with a transparent background -- which is exactly how the rail
     * ended up visible straight through it.
     *
     * .app sets no position/z-index/transform, so it creates no stacking
     * context: mounting here still escapes .content's, which was the whole
     * point of the portal. Body is the fallback for a render outside the app.
     */
    const mount = document.querySelector(".app") || document.body;
    mount.appendChild(host);
    return () => { try { host.parentNode && host.parentNode.removeChild(host); } catch { /* already gone */ } };
  }, [host]);
  if (!host) return null;
  return createPortal(children, host);
}

function ToastHost({ toasts, dismiss }) {
  const MAP = {
    success: { c: "var(--success)", icon: CheckCircle2 },
    error: { c: "var(--danger)", icon: XCircle },
    info: { c: "var(--primary)", icon: Info },
    warning: { c: "var(--warning)", icon: AlertTriangle },
  };
  return (
    <div className="toast-host">
      {toasts.map((t) => { const m = MAP[t.type] || MAP.info; return (
        <div className="toast" key={t.id} style={{ borderLeftColor: m.c }}>
          <span className="tc" style={{ color: m.c }}><m.icon size={18} /></span>
          <div style={{ minWidth: 0 }}><div className="tt">{t.title}</div>{t.desc && <div className="td">{t.desc}</div>}</div>
          {/* An action turns a reversible operation's toast into its own undo,
              which is what lets the confirm dialog in front of it go away. */}
          {t.action && (
            <button className="t-act" onClick={() => { try { t.action.run(); } finally { dismiss(t.id); } }}>
              {t.action.label}
            </button>
          )}
          <button className="tx" onClick={() => dismiss(t.id)}><X size={15} /></button>
        </div>
      ); })}
    </div>
  );
}

/* ---- export / analytics services ---- */
function downloadBlob(data, filename, mime) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function buildExportRows() {
  return TICKETS.map((t) => ({
    "Ticket Number": t.id, "Customer Name": t.name, "Email": t.email, "Phone": t.phone,
    "Subject": t.subject, "Category": t.category, "Priority": t.priority, "Status": t.status,
    "Assigned Agent": t.agent, "Created": t.created,
    "Closed Date": ["Resolved","Closed"].includes(t.status) ? "18 Jul 2026" : "—",
    "Resolution Time": ["Resolved","Closed"].includes(t.status) ? "5h 24m" : "—",
    "SLA Status": t.sla, "Source": t.source, "Department": t.dept,
  }));
}

/* async because SheetJS is fetched on demand. Never rejects — callers fire and forget,
   so a failed CDN load returns false instead of surfacing an unhandled rejection. */
async function exportExcel(rows, filename) {
  try {
    const XLSX = await loadXLSX();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0] || {}).map((k) => ({ wch: Math.max(12, k.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tickets");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(out, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return true;
  } catch {
    return false;
  }
}

function exportCSV(rows, filename) {
  const cols = Object.keys(rows[0] || {});
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  downloadBlob("\uFEFF" + csv, filename, "text/csv;charset=utf-8");
}

function exportPDF(title, columns, rows) {
  const head = columns.map((c) => `<th>${c}</th>`).join("");
  const body = rows.map((r) => `<tr>${columns.map((c) => `<td>${r[c] ?? ""}</td>`).join("")}</tr>`).join("");
  const html = `<!doctype html><html><head><title>${title}</title><meta charset="utf-8"/>
    <style>body{font-family:Inter,Arial,sans-serif;color:#1A1D29;padding:28px}
    h1{font-size:20px;margin:0 0 4px}.sub{color:#6B7280;font-size:12px;margin-bottom:18px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#5B5CEB;color:#fff;text-align:left;padding:7px 8px}
    td{padding:6px 8px;border-bottom:1px solid #E9EBF2}
    tr:nth-child(even) td{background:#F8F9FC}</style></head>
    <body>${(()=>{try{const l=localStorage.getItem("hh-logo");return l?`<img src="${l}" style="height:40px;margin-bottom:10px;border-radius:8px"/>`:""}catch(e){return ""}})()}<h1>${title}</h1><div class="sub">HelpHive · Internship Studio · Generated ${new Date().toLocaleString("en-IN")}</div>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    <script>window.onload=()=>{window.print();}</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html); w.document.close(); return true;
}

function computeAnalytics() {
  const total = TICKETS.length;
  const cnt = (f) => TICKETS.filter(f).length;
  const grp = (key) => {
    const m = {}; TICKETS.forEach((t) => { m[t[key]] = (m[t[key]] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  };
  const resolved = cnt((t) => t.status === "Resolved");
  const closed = cnt((t) => t.status === "Closed");
  return {
    total, open: cnt((t) => t.status === "Open"), closed, resolved,
    pending: cnt((t) => t.status === "Pending"),
    overdue: cnt((t) => t.status === "Overdue" || t.sla === "Breached"),
    isNew: cnt((t) => t.status === "New"),
    resolutionRate: Math.round(((resolved + closed) / total) * 100),
    slaCompliance: Math.round((cnt((t) => t.sla === "On track") / total) * 100),
    csat: 94, avgResp: "1h 08m", avgRes: "5h 24m",
    today: 6, week: 14, month: total,
    byCategory: grp("category").sort((a, b) => b.value - a.value),
    byPriority: ["Critical","High","Medium","Low"].map((p) => ({ name: p, value: cnt((t) => t.priority === p), color: prioColor[p] })),
    byAgent: grp("agent").sort((a, b) => b.value - a.value),
  };
}

function Spinner({ size = 16 }) { return <Loader2 size={size} className="spin" />; }

/** "1.4 MB" — used by the composer's attachment chips before the server replies. */
function humanBytes(b) {
  const n = Number(b) || 0;
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
  if (n < 1073741824) return (n / 1048576).toFixed(1) + " MB";
  return (n / 1073741824).toFixed(2) + " GB";
}

function EmptyState({ icon: Ic = Inbox, title, desc, action, onAction }) {
  return (
    <div className="empty">
      <span className="eic"><Ic size={26} /></span>
      <h4>{title}</h4>{desc && <p>{desc}</p>}
      {action && <button className="btn btn-primary btn-sm" onClick={onAction}>{action}</button>}
    </div>
  );
}

function AttachField({ files, setFiles }) {
  const ref = useRef(null);
  return (
    <div className="fld">
      <label>Attachments</label>
      <div className="dropzone" onClick={() => ref.current?.click()}>
        <Paperclip size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} /> Click to attach files
        <input ref={ref} type="file" multiple hidden onChange={(e) => setFiles([...files, ...Array.from(e.target.files).map((f) => f.name)])} />
      </div>
      {files.length > 0 && <div>{files.map((f, i) => (<span className="file-pill" key={i}>{f}<button onClick={() => setFiles(files.filter((_, j) => j !== i))}><X size={12} /></button></span>))}</div>}
    </div>
  );
}

/* TopNavbar removed -- the right-hand rail (see Sidebar) now owns search, New,
   activity, notifications, theme and back navigation. */

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (<div className="tooltip-card"><div className="tt-lab">{label}</div>
    {payload.map((p) => (<div className="tt-row" key={p.dataKey}><span className="dotc" style={{background:p.color,width:8,height:8}} />
      <span style={{color:"var(--muted)"}}>{p.dataKey||p.name}</span><b style={{marginLeft:"auto"}}>{p.value}</b></div>))}</div>);
}

function Ring({ pct, color }) {
  const r = 40, c = 2*Math.PI*r; const [off, setOff] = useState(c);
  useEffect(() => { const t = setTimeout(() => setOff(c - pct/100*c), 120); return () => clearTimeout(t); }, [pct, c]);
  return (<svg width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="9" /><circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 48 48)" style={{transition:"stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)"}} /></svg>);
}

/* ============================================================================
   AUTOMATION CENTER
   ========================================================================== */
function Switch({ on, onChange }) { return <button className={`switch ${on ? "on" : ""}`} onClick={(e)=>{e.stopPropagation();onChange(!on);}}><i /></button>; }

function StatusChip({ active, label }) {
  const t = label || (active ? "Active" : "Inactive");
  return active
    ? <span className="status-chip" style={{background:"var(--success-soft)",color:"var(--success)"}}><span className="dotc" style={{background:"var(--success)"}} />{t}</span>
    : <span className="status-chip" style={{background:"var(--surface-2)",color:"var(--muted)"}}><span className="dotc" style={{background:"var(--faint)"}} />{t}</span>;
}

function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", danger, onConfirm, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: danger ? "var(--danger-soft)" : "var(--primary-soft)", color: danger ? "var(--danger)" : "var(--primary)", width: 32, height: 32 }}><AlertTriangle size={16} /></span>{title}</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body"><p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6 }}>{message}</p></div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-sm" style={{ background: danger ? "var(--danger)" : "var(--primary)", color: "#fff" }} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button></div>
      </div>
    </div>
  );
}

function RingLg({ pct, color }) {
  const r=44, c=2*Math.PI*r; const [off,setOff]=useState(c);
  useEffect(()=>{ const t=setTimeout(()=>setOff(c-pct/100*c),150); return ()=>clearTimeout(t); },[pct,c]);
  return (<svg width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="11" /><circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 60 60)" style={{transition:"stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)"}} /></svg>);
}

async function kvSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
  try { if (window.storage) await window.storage.set(key, value); } catch (e) {}
}

function kvGetSync(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

/* ============================================================================
   PREMIUM EXPERIENCE LAYER — confetti, insights, palette, assistant
   ========================================================================== */
function fireConfetti() {
  try {
    const host = document.createElement("div");
    host.className = "confetti-host";
    const colors = ["#5B5CEB", "#0EA5E9", "#22C55E", "#F59E0B", "#EF4444", "#EC4899", "#8B5CF6"];
    for (let i = 0; i < 28; i++) {
      const p = document.createElement("i");
      p.style.left = 45 + Math.random() * 10 + "%";
      p.style.background = colors[i % colors.length];
      p.style.setProperty("--dx", (Math.random() * 2 - 1) * 240 + "px");
      p.style.setProperty("--dy", -(120 + Math.random() * 260) + "px");
      p.style.setProperty("--rz", Math.random() * 720 - 360 + "deg");
      p.style.animationDelay = Math.random() * 0.12 + "s";
      host.appendChild(p);
    }
    document.body.appendChild(host);
    setTimeout(() => host.remove(), 1700);
  } catch (e) {}
}

/* Everything above is exported so module order never matters. */
async function kvDelete(key) {
  try { localStorage.removeItem(key); } catch (e) {}
  try { if (window.storage) await window.storage.delete(key); } catch (e) {}
}

async function kvGetAsync(key) {
  try { if (window.storage) { const r = await window.storage.get(key); return r ? r.value : null; } } catch (e) {}
  return null;
}

export {
  kvDelete,
  kvGetAsync,
  AttachField,
  ChartTooltip,
  ConfirmDialog,
  DeskCtx,
  EmptyState,
  Portal,
  PrioBadge,
  Ring,
  RingLg,
  Spinner,
  StatusBadge,
  StatusChip,
  Switch,
  ToastCtx,
  ToastHost,
  buildExportRows,
  computeAnalytics,
  downloadBlob,
  exportCSV,
  exportExcel,
  exportPDF,
  fireConfetti,
  humanBytes,
  kvGetSync,
  kvSet,
  loadXLSX,
  sheetJsPromise,
  useClickAway,
  useCounter,
  useDesk,
  useToast,
};
