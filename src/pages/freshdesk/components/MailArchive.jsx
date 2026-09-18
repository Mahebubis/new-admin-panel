/*
 * src/pages/freshdesk/components/MailArchive.jsx
 *
 * "How far back does contact@internshipstudio.com go, what is in this date
 * range, and can I have it as a sheet?"
 *
 * Three things in one card, because they are one question:
 *
 *   1. COVERAGE — the oldest and newest email the desk holds, the span between
 *      them, and a month-by-month bar chart. A first/last pair alone cannot
 *      show that the middle is empty; the chart can.
 *   2. THE GAP — when the archive is shallow, why. fd_sync.php baselines a
 *      fresh mailbox with SYNC_INITIAL_DAYS and then only ever walks forward,
 *      so mail older than the day the desk went live is still sitting in the
 *      mailbox and was never imported. That is a fact about the sync worker,
 *      not about the mailbox, and the operator has to be told which of the two
 *      they are looking at. "Scan mailbox" answers the other half over IMAP,
 *      counting per year and importing nothing.
 *   3. THE RANGE — pick two dates, see the count and the list, download it.
 *
 * Everything here reads /api/freshdesk/fd_export.php. Nothing is computed from
 * the client-side working set: that holds one page of tickets, and a total
 * derived from it would be a number that looks right and is wrong.
 */
import { AlertTriangle, CalendarDays, CheckCircle2, Database, Download, FileSpreadsheet, FileText, History, Inbox, Loader2, Mail, PauseCircle, RefreshCw, Search, Send, Server, StickyNote, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChartTooltip, EmptyState, Spinner, StatusBadge, exportExcel, useToast } from "../fdShared";
import { archive, backfill } from "../fdApi";

/* ------------------------------------------------------------------ dates */

/** Local YYYY-MM-DD. toISOString() would shift the day for anyone east of UTC,
    which is everyone using this desk. */
function ymd(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
}

/** "12 Aug 2026, 4:21 pm" — what a support agent reads, not an ISO string. */
function prettyDateTime(s) {
  if (!s) return "—";
  const d = new Date(String(s).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function prettyDate(s) {
  if (!s) return "—";
  const d = new Date(String(s).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** 412 -> "1 year 1 month". The answer to "do we have a year of data?". */
function humanSpan(days) {
  const n = Number(days) || 0;
  if (n <= 0) return "—";
  if (n < 31) return `${n} day${n === 1 ? "" : "s"}`;
  const months = Math.floor(n / 30.44);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return `${years} year${years === 1 ? "" : "s"}${rem ? ` ${rem} month${rem === 1 ? "" : "s"}` : ""}`;
}

const nfmt = (n) => Number(n || 0).toLocaleString("en-IN");

/* --------------------------------------------------------------- presets */

const PRESETS = [
  { key: "7d",    label: "7 days",     range: () => ({ from: daysAgo(6),  to: ymd(new Date()) }) },
  { key: "30d",   label: "30 days",    range: () => ({ from: daysAgo(29), to: ymd(new Date()) }) },
  { key: "90d",   label: "90 days",    range: () => ({ from: daysAgo(89), to: ymd(new Date()) }) },
  { key: "month", label: "This month", range: () => { const d = new Date(); return { from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: ymd(d) }; } },
  { key: "year",  label: "This year",  range: () => { const d = new Date(); return { from: ymd(new Date(d.getFullYear(), 0, 1)), to: ymd(d) }; } },
  { key: "all",   label: "All time",   range: () => ({ from: "", to: "" }) },
];

const DIRECTIONS = [
  { key: "all",      label: "All",      icon: Mail },
  { key: "inbound",  label: "Received", icon: Inbox },
  { key: "outbound", label: "Sent",     icon: Send },
  { key: "note",     label: "Notes",    icon: StickyNote },
];

/* Client-side .xlsx is built from rows already in the tab, so it is bounded by
   what the tab can hold. CSV streams from PHP and has no such ceiling — above
   this the Excel button hands the job to the CSV route instead of quietly
   truncating the sheet. */
const XLSX_MAX_ROWS = 5000;
const XLSX_PAGE = 200;

/* ============================================================== coverage == */

function CoverageStrip({ cov }) {
  const m = cov.messages || {};
  const cells = [
    { k: "Oldest email",  v: prettyDate(m.first_at), icon: CalendarDays, tone: "#5B5CEB" },
    { k: "Newest email",  v: prettyDate(m.last_at),  icon: CalendarDays, tone: "#0EA5E9" },
    { k: "History span",  v: humanSpan(m.span_days), icon: Database,     tone: "#8B5CF6" },
    { k: "Emails stored", v: nfmt(m.total),          icon: Mail,         tone: "#10B981" },
    { k: "Unique senders",v: nfmt(m.senders),        icon: Users,        tone: "#F59E0B" },
    { k: "Tickets",       v: nfmt((cov.tickets || {}).total), icon: Inbox, tone: "#64748B" },
  ];
  return (
    <div className="mar-cov">
      {cells.map((c) => (
        <div className="mar-cov-cell" key={c.k}>
          <span className="ic" style={{ background: `${c.tone}18`, color: c.tone }}><c.icon size={15} /></span>
          <div>
            <div className="v">{c.v}</div>
            <div className="k">{c.k}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/*
 * The depth notice.
 *
 * Shown whenever the archive is shorter than a year, which is the question
 * people actually ask. It says what IS held, and — the part that matters — that
 * a short archive is a sync-window fact rather than an empty mailbox, with the
 * button that proves it either way.
 */
/* ============================================================== backfill == */

/*
 * Import the mail that is older than the desk.
 *
 * The shape of this control is dictated by what the job actually is: a two-year
 * mailbox cannot be imported inside one HTTP request, so the server hands out
 * one batch at a time and something has to keep asking. That something is this
 * component while the page is open, and cron otherwise — both drive the same
 * cursor and the server's lock means they can never double-import.
 *
 * Preview is a separate step on purpose. "This will import 19,511 messages" is
 * a number the operator should see before committing, not discover afterwards.
 */
function BackfillPanel({ oldest, onProgress }) {
  const push = useToast();
  const [state, setState] = useState(null);       // server-side progress
  const [until, setUntil] = useState("2025-01-01");
  const [preview, setPreview] = useState(null);
  /* Default ON. On this mailbox roughly seven messages in ten are our own mail
     server telling us a bulk send bounced; importing them costs the great
     majority of the disk and the runtime and archives nothing anyone will read.
     Turning it off is one click for someone who genuinely wants a byte-for-byte
     copy of the mailbox. */
  const [skipAuto, setSkipAuto] = useState(true);
  const [busy, setBusy] = useState("");           // "preview" | "start" | ""
  const [err, setErr] = useState(null);
  const [driving, setDriving] = useState(false);

  /* The drive loop must stop when the card unmounts, and must never run twice
     over itself — a second loop would just collide on the server's lock and
     burn IMAP sessions. */
  const alive = useRef(true);
  const looping = useRef(false);
  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(async () => {
    try {
      const res = await backfill.status();
      setState(res.backfill || null);
      return res.backfill || null;
    } catch (e) {
      if (!e.canceled) setErr(e.message);
      return null;
    }
  }, []);

  const drive = useCallback(async () => {
    if (looping.current) return;
    looping.current = true;
    setDriving(true);
    try {
      for (;;) {
        if (!alive.current) break;
        const res = await backfill.run();
        const bf = res.backfill || null;
        setState(bf);
        if (onProgress) onProgress(bf);
        if (!bf || bf.status !== "running") {
          if (bf && bf.status === "done") {
            push({ type: "success", title: "Import finished",
                   desc: `${Number(bf.imported || 0).toLocaleString("en-IN")} older emails imported.` });
          }
          break;
        }
        // A batch that imported nothing and is not done means the server is
        // spending its whole budget on duplicates; keep going, but do not spin.
        if (res.locked) break;
      }
    } catch (e) {
      if (!e.canceled) {
        setErr(e.message);
        push({ type: "error", title: "Import stopped", desc: e.message });
      }
    } finally {
      looping.current = false;
      if (alive.current) setDriving(false);
    }
  }, [onProgress, push]);

  /* On mount: if a run was already armed (started here earlier, or still being
     drained by cron), show it and keep driving it while this page is open. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const bf = await load();
      if (!cancelled && bf && bf.status === "running") drive();
    })();
    return () => { cancelled = true; };
  }, [load, drive]);

  const runPreview = async () => {
    setBusy("preview"); setErr(null); setPreview(null);
    try {
      setPreview(await backfill.preview(until, skipAuto));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  };

  const start = async () => {
    setBusy("start"); setErr(null);
    try {
      const res = await backfill.start(until, skipAuto);
      setState(res.backfill || null);
      push({ type: "success", title: "Import started", desc: res.message });
      if ((res.backfill || {}).status === "running") drive();
    } catch (e) {
      setErr(e.message);
      push({ type: "error", title: "Could not start", desc: e.message });
    } finally {
      setBusy("");
    }
  };

  const pause = async () => {
    alive.current = false;                 // stop the loop after the batch in flight
    try { await backfill.stop(); } catch { /* the status refresh below tells the truth */ }
    alive.current = true;
    setDriving(false);
    load();
  };

  const resume = async () => {
    setErr(null);
    try {
      const res = await backfill.resume();
      setState(res.backfill || null);
      if (!res.done) drive();
    } catch (e) { setErr(e.message); }
  };

  const running = state && state.status === "running";
  const done = state && state.status === "done";
  const paused = state && (state.status === "paused" || state.status === "error");

  return (
    <div className="mar-bf">
      <div className="mar-bf-head">
        <History size={14} /> <b>Import older mail</b>
        <span className="hint">Reads mail that arrived before this desk existed and files it as archived history.</span>
      </div>

      {!running && !done && (
        <div className="mar-bf-row">
          <label>
            <span>Import back to</span>
            <input type="date" value={until} max={ymd(new Date())}
                   onChange={(e) => { setUntil(e.target.value); setPreview(null); }} />
          </label>
          <button className="btn btn-soft btn-sm" onClick={runPreview} disabled={!!busy}>
            {busy === "preview" ? <Spinner /> : <Search size={13} />} Preview
          </button>
          <button className="btn btn-primary btn-sm" onClick={start} disabled={!!busy || !until}>
            {busy === "start" ? <Spinner /> : <Download size={13} />} Start import
          </button>
          {paused && (
            <button className="btn btn-soft btn-sm" onClick={resume}><RefreshCw size={13} /> Resume previous run</button>
          )}
        </div>
      )}

      {!running && !done && (
        <label className="mar-bf-skip">
          <input type="checkbox" checked={skipAuto}
                 onChange={(e) => { setSkipAuto(e.target.checked); setPreview(null); }} />
          <span>
            Skip delivery bounces and delay warnings
            <em>
              Mail from <code>mailer-daemon@</code> / <code>postmaster@</code>, and “Warning: message … delayed”,
              “Mail delivery failed”. On this mailbox that is about 7 messages in every 10.
            </em>
          </span>
        </label>
      )}

      {preview && !running && (
        <div className="mar-bf-prev">
          <b>{nfmt(preview.in_mailbox)}</b> message{preview.in_mailbox === 1 ? "" : "s"} in the mailbox since{" "}
          {prettyDate(preview.until)} · <b>{nfmt(preview.already_have)}</b> already imported ·{" "}
          <b className="hi">{nfmt(preview.to_import)}</b> would be imported now.

          {/* The number people arrive with is a Freshdesk ticket count, and it is
              always far smaller than this one. Saying so here is the difference
              between "the importer is broken" and "these count different things". */}
          <div className="mar-bf-note">
            This counts <b>individual emails</b>, not tickets. A Freshdesk export counts <b>conversations</b>,
            and one conversation is usually two or three emails — so a Freshdesk figure of, say, 1.8 lakh tickets
            and a mailbox figure of 4 lakh emails describe the same mail.
          </div>

          {preview.auto_count > 0 && (
            <div className="mar-bf-note">
              {skipAuto ? (
                <>Excluding <b>{nfmt(preview.auto_count)}</b> delivery bounces and delay warnings
                  ({Math.round((preview.auto_count / Math.max(1, preview.total_all)) * 100)}% of the range).
                  Untick the box above to import them too.</>
              ) : (
                <><b>{nfmt(preview.auto_count)}</b> of these
                  ({Math.round((preview.auto_count / Math.max(1, preview.total_all)) * 100)}%) are delivery bounces
                  and delay warnings. Ticking the box above drops them and leaves{" "}
                  <b>{nfmt(preview.total_real)}</b> real messages.</>
              )}
            </div>
          )}

          {preview.to_import > 0 && (
            <div className="mar-bf-warn">
              They are filed as <b>closed, archived</b> tickets dated when they were actually sent — they will not
              appear in the unresolved queue, no automation runs on them, and <b>no email is sent to anyone</b>.
            </div>
          )}
        </div>
      )}

      {(running || done || paused) && state && (
        <div className="mar-bf-prog">
          <div className="mar-bf-bar"><i style={{ width: `${state.percent || 0}%` }} /></div>
          <div className="mar-bf-stat">
            <span>
              {done ? "Finished — " : running ? "Importing… " : "Paused — "}
              <b>{nfmt(state.processed)}</b> of <b>{nfmt(state.total)}</b> scanned ·{" "}
              <b>{nfmt(state.imported)}</b> imported · <b>{nfmt(state.new_tickets)}</b> tickets created
              {state.errors > 0 && <> · <b className="bad">{nfmt(state.errors)}</b> failed</>}
            </span>
            <span className="acts">
              {running && <button className="btn btn-soft btn-sm" onClick={pause}><PauseCircle size={13} /> Pause</button>}
              {paused && <button className="btn btn-primary btn-sm" onClick={resume}><RefreshCw size={13} /> Resume</button>}
              {done && <button className="btn btn-soft btn-sm" onClick={() => { setState(null); setPreview(null); }}>Import another range</button>}
            </span>
          </div>
          {running && !driving && (
            <p className="mar-bf-foot">
              This tab is not driving the import right now — it continues in the background on the sync cron, or
              reopen this page to push it along.
            </p>
          )}
          {running && driving && (
            <p className="mar-bf-foot">
              Keep this page open to keep it moving. It also continues on the sync cron if you close it.
            </p>
          )}
          {state.error && <div className="mar-scan-err"><AlertTriangle size={13} /> {state.error}</div>}
        </div>
      )}

      {err && <div className="mar-scan-err"><AlertTriangle size={13} /> {err}</div>}

      {done && oldest && (
        <p className="mar-bf-foot">Oldest email on record is now <b>{prettyDate(oldest)}</b>. Hit Refresh above to recount.</p>
      )}
    </div>
  );
}

function DepthNotice({ cov, onScan, scanning, scan, scanError, onBackfillProgress }) {
  const m = cov.messages || {};
  const span = Number(m.span_days) || 0;
  const deep = span >= 365;

  return (
    <div className={`mar-note ${deep ? "ok" : "warn"}`}>
      <span className="ic">{deep ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}</span>
      <div className="bd">
        {deep ? (
          <p>
            This desk holds <b>{humanSpan(span)}</b> of history — {nfmt(m.total)} emails from{" "}
            <b>{prettyDate(m.first_at)}</b> to <b>{prettyDate(m.last_at)}</b>.
          </p>
        ) : (
          <p>
            This desk holds <b>{humanSpan(span)}</b> of history{m.first_at ? <> — the oldest email it has is from <b>{prettyDate(m.first_at)}</b></> : " — no email has been imported yet"}.
            {" "}That is <b>less than a year</b>. The mailbox itself may go back much further: the sync
            worker baselines a new mailbox with the last <b>{cov.initial_days} days</b> of mail and then only
            moves forward, so anything older than the day this desk went live was never imported.
          </p>
        )}
        <div className="mar-note-act">
          <button className="btn btn-soft btn-sm" onClick={onScan} disabled={scanning}>
            {scanning ? <Spinner /> : <Server size={13} />} {scanning ? "Reading the mailbox…" : "Check what the mailbox holds"}
          </button>
          <span className="hint">Counts messages on the mail server per year. Imports nothing.</span>
        </div>

        <BackfillPanel oldest={m.first_at} onProgress={onBackfillProgress} />

        {scanError && <div className="mar-scan-err"><AlertTriangle size={13} /> {scanError}</div>}

        {scan && (
          <div className="mar-scan">
            <div className="mar-scan-head">
              <b>{nfmt(scan.exists)}</b> message{scan.exists === 1 ? "" : "s"} in {scan.mailbox} · {scan.folder}
            </div>
            <div className="mar-scan-years">
              {scan.older && scan.older.total > 0 && (
                <span className="yb"><b>{nfmt(scan.older.total)}</b><i>before {scan.older.before}</i></span>
              )}
              {(scan.years || []).map((y) => (
                <span className="yb" key={y.year}><b>{nfmt(y.total)}</b><i>{y.year}</i></span>
              ))}
            </div>
            <p className="mar-scan-foot">
              Anything here that the desk has not imported is still in the mailbox, untouched. Importing it
              is a backfill of the sync worker — it is not something this screen does.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MonthChart({ months }) {
  const data = useMemo(() => (months || []).map((m) => ({ name: m.label, Emails: m.total, Received: m.inbound, Sent: m.outbound })), [months]);
  if (!data.length) return null;
  return (
    <div className="mar-chart">
      <ResponsiveContainer width="100%" height={168}>
        <BarChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={44} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--hover)" }} />
          <Bar dataKey="Received" stackId="a" fill="#5B5CEB" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Sent" stackId="a" fill="#10B981" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ================================================================ range == */

function MailArchive() {
  const push = useToast();

  /* Coverage — loaded once on mount; it is two indexed aggregates, not a poll. */
  const [cov, setCov] = useState(null);
  const [covErr, setCovErr] = useState(null);
  const [covLoading, setCovLoading] = useState(true);

  /* The IMAP scan is explicit only. */
  const [scan, setScan] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);

  /* The selection. `applied` is what the last request used, so the table and
     the counts always describe the same thing even while the inputs are being
     edited — a list that silently disagrees with the count above it is the
     bug this separation exists to prevent. */
  const [preset, setPreset] = useState("30d");
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(ymd(new Date()));
  const [direction, setDirection] = useState("all");
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState({ from: daysAgo(29), to: ymd(new Date()), direction: "all", search: "" });

  const [page, setPage] = useState(1);
  const [perPage] = useState(50);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState("");

  const loadCoverage = useCallback(async () => {
    setCovLoading(true);
    try {
      setCov(await archive.coverage());
      setCovErr(null);
    } catch (e) {
      if (!e.canceled) setCovErr(e.message);
    } finally {
      setCovLoading(false);
    }
  }, []);

  useEffect(() => { loadCoverage(); }, [loadCoverage]);

  /* One in-flight list request. Changing the page while the previous page is
     still arriving must not settle on the older response. */
  const reqSeq = useRef(0);

  const loadRange = useCallback(async (sel, pg) => {
    const seq = ++reqSeq.current;
    setLoading(true);
    try {
      const res = await archive.range({ ...sel, page: pg, perPage });
      if (seq !== reqSeq.current) return;
      setData(res);
      setError(null);
    } catch (e) {
      if (seq !== reqSeq.current || e.canceled) return;
      setError(e.message);
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [perPage]);

  useEffect(() => { loadRange(applied, page); }, [applied, page, loadRange]);

  /*
   * Recount once the backfill finishes.
   *
   * Held in a ref so the callback handed to BackfillPanel keeps a STABLE
   * identity: it feeds that component's drive loop through useCallback deps,
   * and a new function on every range change would restart the loop mid-import.
   */
  const refreshAfterBackfill = useRef(() => {});
  useEffect(() => {
    refreshAfterBackfill.current = () => { loadCoverage(); loadRange(applied, page); };
  }, [loadCoverage, loadRange, applied, page]);

  const onBackfillProgress = useCallback((bf) => {
    if (bf && bf.status === "done") refreshAfterBackfill.current();
  }, []);

  const pickPreset = (p) => {
    setPreset(p.key);
    const r = p.range();
    setFrom(r.from);
    setTo(r.to);
    setPage(1);
    setApplied({ from: r.from, to: r.to, direction, search });
  };

  const apply = () => {
    setPage(1);
    setApplied({ from, to, direction, search });
  };

  const pickDirection = (k) => {
    setDirection(k);
    setPage(1);
    setApplied((a) => ({ ...a, direction: k }));
  };

  const runScan = async () => {
    setScanning(true);
    setScanError(null);
    try {
      setScan(await archive.mailbox(6));
    } catch (e) {
      setScanError(e.message);
    } finally {
      setScanning(false);
    }
  };

  /* Downloads. The CSV is a plain navigation — the browser streams it to disk
     and PHP never holds the whole sheet in memory. */
  const downloadCsv = (format) => {
    const url = archive.csvUrl({ ...applied, format });
    window.location.href = url;
    push({ type: "success", title: "Preparing your file", desc: `The ${format === "tickets" ? "ticket" : "email"} sheet is downloading.` });
  };

  const downloadExcel = async () => {
    const total = data?.summary?.total || 0;
    if (total > XLSX_MAX_ROWS) {
      push({ type: "info", title: "Too large for .xlsx", desc: `${nfmt(total)} rows — downloading as CSV instead, which Excel opens directly.` });
      downloadCsv("emails");
      return;
    }
    setDownloading("xlsx");
    try {
      const rows = [];
      const pages = Math.max(1, Math.ceil(total / XLSX_PAGE));
      for (let p = 1; p <= pages; p++) {
        const res = await archive.range({ ...applied, page: p, perPage: XLSX_PAGE });
        (res.rows || []).forEach((r) => rows.push({
          Date: r.sent_at, Direction: r.direction, Type: r.type, Ticket: r.ticket_id,
          Subject: r.subject, "From Name": r.from_name, "From Email": r.from_email, To: r.to,
          "Ticket Status": r.status, Priority: r.priority, Category: r.category, Agent: r.agent,
          Delivery: r.delivery, Attachments: r.attachments, Preview: r.snippet,
        }));
      }
      if (!rows.length) {
        push({ type: "info", title: "Nothing to export", desc: "No emails fall in the selected range." });
        return;
      }
      const ok = await exportExcel(rows, `internshipstudio-emails-${applied.from || "start"}-to-${applied.to || ymd(new Date())}.xlsx`);
      push(ok
        ? { type: "success", title: "Export ready", desc: `${nfmt(rows.length)} emails written to the sheet.` }
        : { type: "error", title: "Export failed", desc: "The spreadsheet library could not be loaded. Use CSV instead." });
    } catch (e) {
      push({ type: "error", title: "Export failed", desc: e.message });
    } finally {
      setDownloading("");
    }
  };

  const s = data?.summary || {};
  const rows = data?.rows || [];
  const totalPages = data?.pages || 0;
  const firstRow = rows.length ? (page - 1) * perPage + 1 : 0;
  const lastRow = rows.length ? firstRow + rows.length - 1 : 0;

  const rangeLabel = applied.from || applied.to
    ? `${applied.from ? prettyDate(applied.from) : "the beginning"} → ${applied.to ? prettyDate(applied.to) : "today"}`
    : "all time";

  return (
    <div className="card fade mar" style={{ marginTop: 22, animationDelay: "280ms" }}>
      <div className="section-head" style={{ padding: "18px 20px 0", marginBottom: 14 }}>
        <div>
          <h3 className="card-title">
            <Database size={16} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--primary)" }} />
            Mail Archive & Export
          </h3>
          <p className="card-sub">
            Everything this desk has recorded from {cov?.mailbox || "contact@internshipstudio.com"} — pick a date range,
            see the count, download the sheet.
          </p>
        </div>
        <button className="btn btn-soft btn-sm" onClick={loadCoverage} disabled={covLoading}>
          {covLoading ? <Spinner /> : <RefreshCw size={13} />} Refresh
        </button>
      </div>

      <div className="mar-body">
        {covErr && (
          <div className="msg-error" style={{ marginBottom: 12 }}>
            <AlertTriangle size={14} /> Could not read the archive summary: {covErr}
          </div>
        )}

        {covLoading && !cov ? (
          <div className="mar-cov">
            {Array.from({ length: 6 }).map((_, i) => <div className="mar-cov-cell" key={i}><div className="sk sk-line" style={{ width: "100%", height: 34 }} /></div>)}
          </div>
        ) : cov ? (
          <>
            <CoverageStrip cov={cov} />
            <DepthNotice cov={cov} onScan={runScan} scanning={scanning} scan={scan} scanError={scanError}
                         onBackfillProgress={onBackfillProgress} />
            <MonthChart months={cov.months} />
          </>
        ) : null}

        {/* ------------------------------------------------- range controls */}
        <div className="mar-controls">
          <div className="filters">
            {PRESETS.map((p) => (
              <button key={p.key} className={preset === p.key ? "on" : ""} onClick={() => pickPreset(p)}>{p.label}</button>
            ))}
          </div>

          <div className="mar-dates">
            <label>
              <span>From</span>
              <input type="date" value={from} max={to || undefined}
                     onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }} />
            </label>
            <label>
              <span>To</span>
              <input type="date" value={to} min={from || undefined} max={ymd(new Date())}
                     onChange={(e) => { setTo(e.target.value); setPreset("custom"); }} />
            </label>
            <button className="btn btn-primary btn-sm" onClick={apply}>Apply</button>
          </div>
        </div>

        <div className="mar-controls">
          <div className="seg">
            {DIRECTIONS.map((d) => (
              <button key={d.key} className={direction === d.key ? "on" : ""} onClick={() => pickDirection(d.key)}>
                <d.icon size={13} /> {d.label}
              </button>
            ))}
          </div>

          <div className="mar-search">
            <Search size={14} />
            <input placeholder="Subject, sender name or email address…" value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter") apply(); }} />
          </div>

          <div className="mar-dl">
            <button className="btn btn-soft btn-sm" onClick={() => downloadCsv("emails")}>
              <FileText size={14} /> CSV — emails
            </button>
            <button className="btn btn-soft btn-sm" onClick={() => downloadCsv("tickets")}>
              <FileText size={14} /> CSV — tickets
            </button>
            <button className="btn btn-soft btn-sm" onClick={downloadExcel} disabled={downloading === "xlsx"}>
              {downloading === "xlsx" ? <Spinner /> : <FileSpreadsheet size={14} />} Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* --------------------------------------------------------- counts */}
        <div className="mar-counts">
          <div className="mar-count big">
            <b>{loading && !data ? "…" : nfmt(s.total)}</b>
            <span>emails in {rangeLabel}</span>
          </div>
          <div className="mar-count"><b>{nfmt(s.inbound)}</b><span>received</span></div>
          <div className="mar-count"><b>{nfmt(s.outbound)}</b><span>sent</span></div>
          <div className="mar-count"><b>{nfmt(s.notes)}</b><span>private notes</span></div>
          <div className="mar-count"><b>{nfmt(s.tickets)}</b><span>tickets touched</span></div>
          <div className="mar-count"><b>{nfmt(s.senders)}</b><span>unique senders</span></div>
          <div className="mar-count"><b>{nfmt(s.with_attachments)}</b><span>with attachments</span></div>
        </div>

        {error && (
          <div className="msg-error" style={{ marginBottom: 10 }}>
            <AlertTriangle size={14} /> {error}
            <button className="btn btn-soft btn-sm" onClick={() => loadRange(applied, page)}><RefreshCw size={13} /> Retry</button>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------- table */}
      {loading && !rows.length ? (
        <div className="mar-loading"><Loader2 size={18} className="spin" /> Reading the archive…</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Mail} title="No emails in this range"
                    desc={(cov?.messages?.first_at)
                      ? `The oldest email this desk holds is from ${prettyDate(cov.messages.first_at)}. Try a later range, or All time.`
                      : "Nothing has been imported from the mailbox yet."} />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 156 }}>Date</th>
                  <th style={{ width: 92 }}>Direction</th>
                  <th>From</th>
                  <th>Subject</th>
                  <th style={{ width: 88 }}>Ticket</th>
                  <th style={{ width: 104 }}>Status</th>
                  <th style={{ width: 60 }}>Files</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12.5 }}>{prettyDateTime(r.sent_at)}</td>
                    <td>
                      <span className={`mar-dir ${r.direction}`}>
                        {r.direction === "inbound" ? <Inbox size={11} /> : r.direction === "outbound" ? <Send size={11} /> : <StickyNote size={11} />}
                        {r.direction === "inbound" ? "Received" : r.direction === "outbound" ? "Sent" : "Note"}
                      </span>
                    </td>
                    <td>
                      <div className="mar-from">
                        <span className="nm">{r.from_name || r.from_email || "—"}</span>
                        <span className="em">{r.from_email}</span>
                      </div>
                    </td>
                    <td><div className="subj" title={r.subject}>{r.subject || "(no subject)"}</div></td>
                    <td style={{ fontWeight: 700, color: "var(--primary)" }}>#{r.ticket_id}</td>
                    <td>{r.status ? <StatusBadge s={r.status} /> : "—"}</td>
                    <td style={{ textAlign: "center", fontSize: 12.5 }}>{r.attachments || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pager" style={{ padding: "14px 20px 18px" }}>
            <div className="info">
              Showing {nfmt(firstRow)}–{nfmt(lastRow)} of {nfmt(s.total)} · page {page} of {nfmt(totalPages)}
              {loading && <> · <Loader2 size={12} className="spin" style={{ verticalAlign: "-2px" }} /></>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-soft btn-sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
              <button className="btn btn-soft btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next</button>
              <button className="btn btn-primary btn-sm" onClick={() => downloadCsv("emails")}>
                <Download size={14} /> Download all {nfmt(s.total)}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export { MailArchive };
export default MailArchive;
