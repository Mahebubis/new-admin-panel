import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, RefreshCw, Send, XCircle, AlertTriangle, Moon, RotateCw, Clock, MailX } from 'lucide-react';
import { loadOutbox, releaseOutbox, cancelOutbox } from './journeyStore';

/*
 * Engage → Journeys → Outbox.
 *
 * ── What this screen is for ──────────────────────────────────────────────────
 * "The journey was supposed to run at 5:05, the server was down, it came back at 5:10 —
 * where did those people go?"
 *
 * They were never lost: every pause in a journey is a row with a due time, and the worker
 * picks up everything that is due the moment it runs again. But until this screen there
 * was nowhere to SEE that. The journey report showed it as healthy, because from its point
 * of view it was, and the only evidence that four hundred students were owed a message sat
 * in a log file on the server.
 *
 * So this is the queue, made visible, with the two actions that were missing: send it now
 * rather than at the top of the next minute, and drop it.
 *
 * ── Why the buckets are these buckets ────────────────────────────────────────
 * They are not severity levels, they are different problems with different answers:
 *
 *   Overdue    due, and the worker has not touched it. Something is wrong RIGHT NOW —
 *              usually the cron. Listed first and coloured, because it is the only bucket
 *              that means anything is broken.
 *   Quiet hours   held deliberately. Releases itself; here so the number is not a mystery.
 *   Retrying   a send that failed transiently and is backing off. Carries the provider's
 *              own error, which is normally the whole answer.
 *   Scheduled  ordinary delays. Not a problem — this is simply what the journey is going
 *              to do next, which nothing else on the panel shows.
 *   Failed     gave up. Terminal unless somebody retries it from here.
 *
 * The worker-lag figure in the header is what separates "the cron has stopped" (a big
 * overdue count and a lag measured in hours) from "the tick cannot keep up" (a big overdue
 * count and a lag of seconds). Those want completely different responses, and without the
 * number they look identical.
 */

const KINDS = [
  { key: 'all',      label: 'Everything', icon: null },
  { key: 'overdue',  label: 'Overdue',    icon: AlertTriangle, tone: 'bad',
    hint: 'Due, and the worker has not picked them up. Normally means the cron has stopped.' },
  { key: 'dnd_hold', label: 'Quiet hours', icon: Moon, tone: 'info',
    hint: 'Held by the DND schedule. They go out on their own when the window ends.' },
  { key: 'retry',    label: 'Retrying',   icon: RotateCw, tone: 'warn',
    hint: 'A send failed and is backing off. It will try again by itself.' },
  { key: 'delay',    label: 'Scheduled',  icon: Clock, tone: 'calm',
    hint: 'Ordinary waits and delays — what these journeys are going to do next.' },
  { key: 'failed',   label: 'Failed',     icon: MailX, tone: 'bad',
    hint: 'Out of attempts. Nothing more happens unless you retry them here.' },
];

const TONE = {
  bad:  { bg: '#fdeaea', fg: '#b42318', bd: '#f7cccc' },
  warn: { bg: '#fff0e0', fg: '#b54708', bd: '#fdd8b5' },
  info: { bg: '#eef2ff', fg: '#3538cd', bd: '#c7d7fe' },
  calm: { bg: '#f2f4f7', fg: '#475467', bd: '#e4e7ec' },
};

const PAGE = 50;

const CSS = `
.ob { padding: 20px 24px 40px; height: 100%; overflow-y: auto; }
.ob h1 { font-size: 20px; font-weight: 750; color: #101828; margin: 0 0 4px; }
.ob .sub { font-size: 13px; color: #667085; margin: 0 0 18px; max-width: 720px; line-height: 1.6; }

.ob-bar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:14px; }
.ob-search { position:relative; flex:1; min-width:220px; max-width:340px; }
.ob-search svg { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:#98a2b3; }
.ob-search input { width:100%; box-sizing:border-box; padding:8px 10px 8px 32px; border:1px solid #d0d5dd;
  border-radius:8px; font-size:13px; font-family:inherit; color:#101828; outline:none;
  transition:border-color 160ms, box-shadow 160ms; }
.ob-search input:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,.14); }
.ob-sel { padding:8px 11px; border:1px solid #d0d5dd; border-radius:8px; font-size:13px; font-family:inherit;
  color:#101828; background:#fff; outline:none; cursor:pointer; max-width:240px; }
.ob-sel:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,.14); }

.ob-btn { display:inline-flex; align-items:center; gap:7px; padding:8px 14px; border-radius:8px; font-size:13px;
  font-weight:650; font-family:inherit; cursor:pointer; border:1px solid transparent; white-space:nowrap;
  transition:background 160ms, box-shadow 160ms, transform 90ms, border-color 160ms, color 160ms; }
.ob-btn:active:not(:disabled) { transform:translateY(1px); }
.ob-btn:disabled { opacity:.45; cursor:not-allowed; }
.ob-btn-solid { background:#4f46e5; color:#fff; }
.ob-btn-solid:hover:not(:disabled) { background:#4338ca; box-shadow:0 4px 12px rgba(79,70,229,.28); }
.ob-btn-ghost { background:#fff; color:#344054; border-color:#d0d5dd; }
.ob-btn-ghost:hover:not(:disabled) { background:#f9fafb; border-color:#98a2b3; }
.ob-btn-danger { background:#fff; color:#b42318; border-color:#f7cccc; }
.ob-btn-danger:hover:not(:disabled) { background:#fef3f2; }

.ob-tabs { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; }
.ob-tab { display:inline-flex; align-items:center; gap:7px; padding:7px 13px; border-radius:999px;
  border:1px solid #e4e7ec; background:#fff; font-family:inherit; font-size:12.5px; font-weight:600;
  color:#475467; cursor:pointer; transition:all 160ms; }
.ob-tab:hover { border-color:#98a2b3; }
.ob-tab[aria-pressed="true"] { background:#101828; border-color:#101828; color:#fff; }
.ob-tab b { font-variant-numeric:tabular-nums; }

.ob-lag { display:flex; align-items:center; gap:9px; padding:11px 14px; border-radius:10px; font-size:12.5px;
  line-height:1.6; margin-bottom:14px; }
.ob-lag svg { flex:none; }

.ob-tblwrap { background:#fff; border:1px solid #e4e7ec; border-radius:12px; overflow:auto;
  box-shadow:0 1px 2px rgba(16,24,40,.05); }
.ob-tbl { width:100%; border-collapse:collapse; font-size:12.5px; min-width:900px; }
.ob-tbl th { text-align:left; padding:10px 12px; font-size:11px; font-weight:700; color:#667085;
  text-transform:uppercase; letter-spacing:.04em; background:#f9fafb; border-bottom:1px solid #e4e7ec;
  white-space:nowrap; position:sticky; top:0; z-index:1; }
.ob-tbl td { padding:11px 12px; border-bottom:1px solid #f2f4f7; color:#344054; vertical-align:top; }
.ob-tbl tr:last-child td { border-bottom:0; }
.ob-tbl tr:hover td { background:#fcfcfd; }
.ob-chip { display:inline-block; padding:2px 9px; border-radius:999px; font-size:11px; font-weight:700;
  border:1px solid; white-space:nowrap; }
.ob-mono { font-variant-numeric:tabular-nums; white-space:nowrap; }
.ob-err { color:#b42318; font-size:11.5px; line-height:1.5; margin-top:3px; max-width:340px; }
.ob-empty { padding:56px 20px; text-align:center; color:#667085; font-size:13px; }
.ob-foot { display:flex; align-items:center; gap:12px; margin-top:14px; flex-wrap:wrap; }
.ob-foot .n { font-size:12.5px; color:#667085; margin-left:auto; }
`;

const nUS = v => Number(v || 0).toLocaleString('en-US');

/** "in 4 min" / "12 min late" — a relative figure, because the absolute timestamp is
 *  right beside it and the question here is always "how far off is this". */
function relative(due) {
  if (!due) return '';
  const t = new Date(String(due).replace(' ', 'T')).getTime();
  if (isNaN(t)) return '';
  const s = Math.round((t - Date.now()) / 1000);
  const mag = Math.abs(s);
  const unit = mag < 90 ? [Math.round(mag), 'sec']
    : mag < 5400 ? [Math.round(mag / 60), 'min']
      : mag < 172800 ? [Math.round(mag / 3600), 'hr'] : [Math.round(mag / 86400), 'day'];
  const n = `${unit[0]} ${unit[1]}${unit[0] === 1 ? '' : 's'}`;
  return s >= 0 ? `in ${n}` : `${n} late`;
}

function fmtWhen(v) {
  if (!v) return '—';
  return String(v).replace('T', ' ').slice(0, 16);
}

export default function JourneyOutbox() {
  const [kind, setKind] = useState('overdue');
  const [journeyId, setJourneyId] = useState(0);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState({ rows: [], total: 0, pages: 1, summary: {}, journeys: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState(() => new Set());

  // The search box filters on the server, so it is debounced rather than fired per keystroke.
  const [qLive, setQLive] = useState('');
  const qTimer = useRef(null);
  useEffect(() => {
    clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => { setQ(qLive); setPage(1); }, 350);
    return () => clearTimeout(qTimer.current);
  }, [qLive]);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await loadOutbox({ kind, journeyId, q, page, perPage: PAGE });
    setData(d || { rows: [], total: 0, pages: 1, summary: {}, journeys: [] });
    // A selection that survived a reload would let someone release rows they can no longer
    // see, which is exactly the sort of thing that turns a quiet fix into an incident.
    setPicked(new Set());
    setLoading(false);
  }, [kind, journeyId, q, page]);

  useEffect(() => { load(); }, [load]);

  /*
   * Poll while the tab is open. This screen is watched during an outage, and a queue that
   * only changes when you press a button is worse than no queue at all — you cannot tell
   * a worker that is catching up from one that is still down. Paused when the tab is
   * hidden so a forgotten tab is not a standing query every fifteen seconds.
   */
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden && !busy) load(); }, 15000);
    return () => clearInterval(t);
  }, [load, busy]);

  const summary = data.summary || {};
  const rows = data.rows || [];

  const allPicked = rows.length > 0 && rows.every(r => picked.has(r.id));
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(rows.map(r => r.id)));
  const toggle = id => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const doRelease = async (all = false) => {
    const ids = [...picked];
    if (!all && !ids.length) { toast.error('Select something first'); return; }
    setBusy(true);
    try {
      const res = await releaseOutbox(ids, { all, kind, journeyId });
      const n = (res?.released || 0) + (res?.requeued || 0);
      toast.success(n
        ? `${nUS(n)} queued to go out now — the worker was kicked, give it a few seconds`
        : 'Nothing was due to release');
      await load();
    } catch { /* journeyStore has already toasted the reason */ } finally { setBusy(false); }
  };

  const doCancel = async () => {
    const ids = [...picked].filter(id => String(id).startsWith('w'));
    if (!ids.length) { toast.error('Select at least one waiting row — a failed send cannot be cancelled, only retried'); return; }
    if (!window.confirm(
      `Skip ${ids.length} step${ids.length === 1 ? '' : 's'}?\n\n`
      + 'These students stay in their journeys and carry on from the next step. '
      + 'The message they were waiting for is not sent.')) return;
    setBusy(true);
    try {
      const res = await cancelOutbox(ids);
      toast.success(`${nUS(res?.cancelled || 0)} step${res?.cancelled === 1 ? '' : 's'} skipped`);
      await load();
    } catch { /* already toasted */ } finally { setBusy(false); }
  };

  /* The worker-lag banner. See the file header for why this number is the one that matters. */
  const lag = summary.worker_lag_seconds;
  const lagNote = useMemo(() => {
    if (lag === null || lag === undefined) {
      return { tone: 'calm', text: 'No journey has ticked yet, so there is nothing to measure. Publish a journey to start the worker.' };
    }
    if (lag > 900) {
      return { tone: 'bad', text: `The worker last ran ${Math.round(lag / 60)} minutes ago. The cron on the server has almost certainly stopped — everything below is waiting on it. Send now still works, and kicks the worker directly.` };
    }
    if (lag > 180) {
      return { tone: 'warn', text: `The worker last ran ${Math.round(lag / 60)} minutes ago. It should tick every minute; a gap this size usually means a long tick or a missed cron.` };
    }
    return { tone: 'info', text: `The worker last ran ${lag < 70 ? 'less than a minute' : `${Math.round(lag / 60)} minutes`} ago and is keeping up.` };
  }, [lag]);

  const kindMeta = KINDS.find(k => k.key === kind) || KINDS[0];

  return (
    <div className="ob">
      <style>{CSS}</style>

      <h1>Outbox</h1>
      <p className="sub">
        Everything the journey engine still owes and has not delivered — steps that fell due while the
        worker was down, messages held by quiet hours, sends backing off after a failure, and the
        ordinary delays that are simply not due yet. Nothing here is lost: it goes out on its own when
        its time comes. This is where you see it, and where you make it happen now.
      </p>

      <div className={`ob-lag`} style={{
        background: TONE[lagNote.tone].bg, border: `1px solid ${TONE[lagNote.tone].bd}`, color: TONE[lagNote.tone].fg,
      }}>
        <Clock size={15} />
        <div>
          {lagNote.text}
          {summary.next_release
            ? <> Next release due <b>{fmtWhen(summary.next_release)}</b>.</>
            : null}
        </div>
      </div>

      <div className="ob-tabs">
        {KINDS.map(k => {
          const n = k.key === 'all' ? summary.total : summary[k.key];
          const Ico = k.icon;
          return (
            <button key={k.key} className="ob-tab" aria-pressed={kind === k.key} title={k.hint || ''}
                    onClick={() => { setKind(k.key); setPage(1); }}>
              {Ico ? <Ico size={13} /> : null}
              {k.label}
              <b>{n === undefined ? '' : nUS(n)}</b>
            </button>
          );
        })}
      </div>

      {kindMeta.hint && (
        <p style={{ fontSize: 12.5, color: '#667085', margin: '0 0 12px', lineHeight: 1.6, maxWidth: 720 }}>
          {kindMeta.hint}
        </p>
      )}

      <div className="ob-bar">
        <div className="ob-search">
          <Search size={14} />
          <input value={qLive} onChange={e => setQLive(e.target.value)}
                 placeholder="Search by email, phone or name" />
        </div>

        <select className="ob-sel" value={journeyId}
                onChange={e => { setJourneyId(Number(e.target.value)); setPage(1); }}>
          <option value={0}>All journeys</option>
          {(data.journeys || []).map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
        </select>

        <button className="ob-btn ob-btn-ghost" onClick={load} disabled={loading || busy}>
          <RefreshCw size={14} /> Refresh
        </button>

        <div style={{ flex: 1 }} />

        <button className="ob-btn ob-btn-solid" onClick={() => doRelease(false)} disabled={busy || !picked.size}>
          <Send size={14} /> Send {picked.size ? `${picked.size} ` : ''}now
        </button>
        <button className="ob-btn ob-btn-ghost" onClick={() => doRelease(true)}
                disabled={busy || !rows.length}
                title="Release every row in this bucket, not just the ones on this page">
          Send all {kindMeta.label.toLowerCase()}
        </button>
        <button className="ob-btn ob-btn-danger" onClick={doCancel} disabled={busy || !picked.size}>
          <XCircle size={14} /> Skip
        </button>
      </div>

      <div className="ob-tblwrap">
        <table className="ob-tbl">
          <thead>
            <tr>
              <th style={{ width: 34 }}>
                <input type="checkbox" checked={allPicked} onChange={toggleAll}
                       aria-label="Select every row on this page" disabled={!rows.length} />
              </th>
              <th>Status</th>
              <th>Student</th>
              <th>Journey</th>
              <th>Step</th>
              <th>Due</th>
              <th style={{ textAlign: 'right' }}>When</th>
            </tr>
          </thead>
          <tbody>
            {loading && !rows.length ? (
              <tr><td colSpan={7}><div className="ob-empty">Loading…</div></td></tr>
            ) : !rows.length ? (
              <tr><td colSpan={7}><div className="ob-empty">
                {kind === 'overdue'
                  ? 'Nothing is overdue. The engine is keeping up with everything it has been given.'
                  : 'Nothing here.'}
              </div></td></tr>
            ) : rows.map(r => {
              const meta = KINDS.find(k => k.key === r.kind) || KINDS[0];
              const tone = TONE[meta.tone || 'calm'];
              return (
                <tr key={r.id}>
                  <td><input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)}
                             aria-label={`Select ${r.to || r.id}`} /></td>
                  <td>
                    <span className="ob-chip" style={{ background: tone.bg, color: tone.fg, borderColor: tone.bd }}>
                      {meta.label}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#101828' }}>{r.name || r.to || '—'}</div>
                    {r.name && r.to ? <div style={{ color: '#667085', fontSize: 11.5 }}>{r.to}</div> : null}
                  </td>
                  <td style={{ maxWidth: 200 }}>{r.journey}</td>
                  <td style={{ maxWidth: 260 }}>
                    {r.step}
                    {r.error ? <div className="ob-err">{r.error}</div> : null}
                  </td>
                  <td className="ob-mono">{fmtWhen(r.due_at)}</td>
                  <td className="ob-mono" style={{
                    textAlign: 'right',
                    color: r.overdue > 120 ? '#b42318' : '#667085',
                    fontWeight: r.overdue > 120 ? 650 : 400,
                  }}>
                    {relative(r.due_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ob-foot">
        <button className="ob-btn ob-btn-ghost" onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}>Previous</button>
        <button className="ob-btn ob-btn-ghost" onClick={() => setPage(p => Math.min(data.pages || 1, p + 1))}
                disabled={page >= (data.pages || 1) || loading}>Next</button>
        <span className="n">
          {nUS(data.total)} row{data.total === 1 ? '' : 's'} · page {page} of {data.pages || 1}
        </span>
      </div>
    </div>
  );
}
