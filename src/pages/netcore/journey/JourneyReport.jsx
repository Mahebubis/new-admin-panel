import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Pencil, MessageCircle, Mail } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import { getReport, setCap, stepPeople } from './journeyStore';
import JourneyDiagram from './JourneyDiagram';

/*
  Journey report — a read view opened from a live journey.

  Every number here now comes from the execution engine: journey-level KPIs from the
  journeys rollup columns, per-node engagement from journey_node_stats, waiting
  counts from the live journey_waits queue, and the suppression breakdown from
  journey_messages. Structure (channel mix, merges) is still derived from the graph
  because that is a property of the drawing, not of the run.
*/

const NODE_META = {
  trg_activity: { name: 'Activity', kind: 'Trigger' }, trg_segment: { name: 'Segment', kind: 'Trigger' }, trg_list: { name: 'List', kind: 'Trigger' }, trg_business: { name: 'Business event', kind: 'Trigger' },
  act_wa: { name: 'WhatsApp', kind: 'Message', channel: 'WhatsApp' }, act_email: { name: 'Email', kind: 'Message', channel: 'Email' }, act_sms: { name: 'SMS', kind: 'Message', channel: 'SMS' }, act_push: { name: 'App push', kind: 'Message', channel: 'App push' },
  act_attr: { name: 'Update attribute', kind: 'Action' }, act_remove: { name: 'Remove from journey', kind: 'Action' }, act_hook: { name: 'Call a service', kind: 'Action' }, act_exit: { name: 'Exit', kind: 'Action' },
  cnd_attr: { name: 'Check attribute', kind: 'Condition' }, cnd_event: { name: 'Has done event', kind: 'Condition' }, cnd_reach: { name: 'Reachable on', kind: 'Condition' }, cnd_split: { name: 'Split traffic', kind: 'Condition' }, cnd_in_segment: { name: 'Is in segment', kind: 'Condition' }, cnd_in_list: { name: 'Is in list', kind: 'Condition' },
  flw_wait: { name: 'Wait', kind: 'Flow' }, flw_event: { name: 'Wait for event', kind: 'Flow' },
};
const KIND_COLOR = { Trigger: '#4c5bd4', Message: '#ff6a1f', Action: '#ff6a1f', Condition: '#0d9488', Flow: '#b07408' };

/* Plain-English names for journey_messages.suppress_reason. */
const SUPPRESS_LABEL = {
  control_group:  'Held out (control group)',
  frequency_cap:  'Daily message cap reached',
  dnd_hold:       'Quiet hours',
  no_address:     'No email / phone on file',
  blocklisted:    'On the blocklist',
  unverified:     'Address does not exist (verification)',
  not_configured: 'No provider configured',
  already_messaged: 'Already messaged once by this journey',
  duplicate:      'Already sent (duplicate guard)',
};

/* Outcome as a shape, not just a word — a page of grey text hides the one red row. */
const STATUS_TONE = {
  sent:       ['#166534', '#dcfce7'],
  ok:         ['#166534', '#dcfce7'],
  suppressed: ['#b45309', '#fef3c7'],
  hold:       ['#b45309', '#fef3c7'],
  wait:       ['#1e40af', '#dbeafe'],
  queued:     ['#1e40af', '#dbeafe'],
  exit:       ['#475569', '#e2e8f0'],
  failed:     ['#b42318', '#fee2e2'],
  error:      ['#b42318', '#fee2e2'],
};
/*
 * The report's date range.
 *
 * "Did this journey work" and "did it work last week" are different questions, and a journey that
 * has been live for months answers the first one with numbers nobody can act on. Every preset is
 * anchored on TODAY and inclusive of it, because the question is always asked from now backwards.
 *
 * Days are plain local YYYY-MM-DD rather than timestamps: the server widens the first to 00:00:00
 * and the last to 23:59:59, so "Today" means all of today and not "up to the moment you clicked".
 */
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

const RANGE_PRESETS = [
  { key: 'all',   label: 'All time',      days: null },
  { key: 'today', label: 'Today',         days: 0 },
  // "Last day" in the sense the request used it: yesterday on its own, so a daily check reads one
  // completed day rather than a part-finished one.
  { key: 'yday',  label: 'Last day',      days: 'yesterday' },
  { key: '7d',    label: 'Last 7 days',   days: 6 },
  { key: '15d',   label: 'Last 15 days',  days: 14 },
  { key: '30d',   label: 'Last 30 days',  days: 29 },
  { key: 'custom', label: 'Custom',       days: 'custom' },
];

/** A preset key (plus the two custom boxes) resolved to the {from,to} the API takes, or null. */
function resolveRange(key, customFrom, customTo, fromTime = '', toTime = '') {
  if (key === 'custom') {
    if (!customFrom || !customTo) return null;
    // Times are sent only when they narrow the day; the whole day is the server's default.
    const ft = fromTime && fromTime !== '00:00:00' && fromTime !== '00:00' ? fromTime : '';
    const tt = toTime && toTime !== '23:59:59' && toTime !== '23:59' ? toTime : '';
    return { from: customFrom, to: customTo, fromTime: ft, toTime: tt };
  }
  const preset = RANGE_PRESETS.find(p => p.key === key);
  if (!preset || preset.days === null) return null;
  if (preset.days === 'yesterday') { const d = ymd(daysAgo(1)); return { from: d, to: d }; }
  return { from: ymd(daysAgo(preset.days)), to: ymd(new Date()) };
}

function StatusPill({ status }) {
  const [fg, bg] = STATUS_TONE[status] || ['#475569', '#e2e8f0'];
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999, background: bg, color: fg,
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', whiteSpace: 'nowrap',
    }}>{status}</span>
  );
}

const thr = { textAlign: 'left', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px' };

function LiftBlock({ label, entered, converted }) {
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}>{pct(converted, entered)}%</div>
      <div style={{ fontSize: 12, color: '#94a3b8' }}>{nUS(converted)} of {nUS(entered)}</div>
    </div>
  );
}
const nUS = v => Number(v || 0).toLocaleString('en-US');
const pct = (part, whole) => (!whole ? 0 : Math.round((Number(part) / Number(whole)) * 1000) / 10);

/*
  Channel identity, in one fixed order.

  Colour follows the CHANNEL, never its rank or its position in a filtered list, so hiding one
  channel never repaints the others. Indigo/green is the same validated pair the campaigns screen
  uses (worst adjacent ΔE 26.8 deutan, 15.2 tritan on a light surface), and the two dead channels
  keep distinct hues so a journey that still has an old SMS step reads correctly.
*/
const CHANNEL_ORDER = [
  { name: 'WhatsApp', color: '#00A37A' },
  { name: 'Email',    color: '#4f46e5' },
  { name: 'SMS',      color: '#b07408' },
  { name: 'App push', color: '#0d9488' },
];

/** Shared chart tooltip. The swatch carries identity; the text stays ink, never the series hue. */
function JrTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 9, padding: '9px 12px',
                  boxShadow: '0 8px 24px rgba(15,23,42,.14)', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>{label ?? payload[0]?.name}</div>
      {payload.map(p => (
        <div key={p.dataKey || p.name} style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#475569', marginTop: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.payload?.fill, display: 'block' }} />
          {p.name}
          <b style={{ marginLeft: 'auto', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
            {Number(p.value).toLocaleString('en-US')}
          </b>
        </div>
      ))}
    </div>
  );
}

const TAB_CSS = `
.jr-tabbar{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap;
  border-bottom:1px solid #e2e8f0;margin-bottom:16px;padding-bottom:7px}
.jr-tabs{display:flex;gap:2px;border-bottom:1px solid #e2e8f0;margin-bottom:20px}
.jr-tabbar .jr-tabs{border-bottom:0;margin-bottom:-8px}
.jr-tab{position:relative;padding:10px 16px;border:0;background:none;cursor:pointer;font-family:inherit;
  font-size:13.5px;font-weight:600;color:#64748b;border-radius:8px 8px 0 0;
  transition:color .16s cubic-bezier(.4,0,.2,1),background .16s}
.jr-tab:hover{color:#334155;background:#f8fafc}
.jr-tab:focus-visible{outline:2px solid #1e3a8a;outline-offset:-2px}
.jr-tab[aria-selected="true"]{color:#1e3a8a}
.jr-tab::after{content:'';position:absolute;left:10px;right:10px;bottom:-1px;height:2px;border-radius:2px 2px 0 0;
  background:currentColor;transform:scaleX(0);transition:transform .2s cubic-bezier(.4,0,.2,1)}
.jr-tab[aria-selected="true"]::after{transform:scaleX(1)}

.jr-ch{width:100%;border-collapse:collapse;font-size:13;min-width:900px}
.jr-ch th{text-align:right;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.4px;
  padding:10px 12px;border-bottom:1px solid #e2e8f0;white-space:nowrap}
.jr-ch th.l,.jr-ch td.l{text-align:left}
.jr-ch td{padding:13px 12px;border-bottom:1px solid #f1f5f9;text-align:right;
  font-variant-numeric:tabular-nums;color:#334155;white-space:nowrap}
.jr-ch tbody tr{transition:background .13s cubic-bezier(.4,0,.2,1)}
.jr-ch tbody tr:hover{background:#fafbff}
.jr-ch tbody tr:last-child td{border-bottom:0}
.jr-ch .msg{display:flex;align-items:center;gap:9px}
.jr-ch .msg .ic{width:26px;height:26px;border-radius:7px;display:grid;place-items:center;flex:none}
.jr-ch .msg b{font-weight:650;color:#0f172a}
.jr-ch .msg small{display:block;font-size:11px;color:#94a3b8;font-weight:400}
.jr-na{color:#cbd5e1}

/* The detail drawer. Bottom to top, because the row it belongs to is in a table the reader is
   already looking down — coming up from under it reads as "this row, expanded", where a panel
   sliding in from the side reads as a different screen. */
@keyframes jrSheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes jrFadeIn{from{opacity:0}to{opacity:1}}
.jr-sheet-back{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:1200;
  animation:jrFadeIn .22s cubic-bezier(.4,0,.2,1) both}
.jr-sheet{position:fixed;inset:0;z-index:1201;display:flex;flex-direction:column;background:#f6f7fb;
  animation:jrSheetUp .34s cubic-bezier(.22,1,.36,1) both;will-change:transform}
/* Respecting a reduced-motion preference is not decoration: a full-screen slide is exactly the
   kind of movement that triggers nausea for people who have asked the OS to stop it. */
@media (prefers-reduced-motion:reduce){
  .jr-sheet{animation:jrFadeIn .01s both}
  .jr-sheet-back{animation:none}
}
.jr-sheet-head{flex:none;background:#fff;border-bottom:1px solid #e2e8f0;padding:16px 22px}
.jr-sheet-body{flex:1;min-height:0;overflow:auto;padding:18px 22px 40px}
.jr-pill{padding:7px 13px;border-radius:999px;font-size:12.5px;font-weight:650;cursor:pointer;
  font-family:inherit;border:1px solid #e2e8f0;background:#fff;color:#64748b;white-space:nowrap;
  transition:background .14s,color .14s,border-color .14s}
.jr-pill:hover{background:#f8fafc;color:#334155}
.jr-pill[aria-selected="true"]{background:#eef2ff;border-color:#4f46e5;color:#1e3a8a}
.jr-pill[disabled]{opacity:.45;cursor:not-allowed}
.jr-who{width:100%;border-collapse:collapse;font-size:13px;min-width:760px}
.jr-who th{text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.4px;
  padding:10px 12px;border-bottom:1px solid #e2e8f0;white-space:nowrap;background:#fff;
  position:sticky;top:0;z-index:1}
.jr-who td{padding:12px;border-bottom:1px solid #f1f5f9;color:#334155;vertical-align:top}
.jr-who tbody tr:hover{background:#fafbff}
.jr-detail-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:7px;
  border:1px solid #dbe1ea;background:#fff;color:#1e3a8a;font-size:11.5px;font-weight:700;
  cursor:pointer;font-family:inherit;white-space:nowrap;transition:background .14s,border-color .14s}
.jr-detail-btn:hover{background:#eef2ff;border-color:#a5b4fc}
`;

/*
  The buckets the drawer can show, in the order they happen.

  Named for what the reader asked — "who opened this" — rather than for the column they come from,
  and kept in one list so the tab, its count and the table's columns cannot disagree about what
  the tab means.
*/
const PEOPLE_BUCKETS = [
  { key: 'sent',      label: 'Sent' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'opened',    label: 'Opened / read' },
  { key: 'clicked',   label: 'Clicked' },
  { key: 'converted', label: 'Converted' },
  { key: 'not_sent',  label: 'Not sent' },
  // Its own tab rather than folded into "Not sent": an address that does not exist is a data
  // problem, while everything else in that bucket is the journey deliberately holding back.
  { key: 'unverified', label: 'Invalid address' },
  { key: 'failed',    label: 'Rejected' },
];

/*
  A timestamp exactly as every other table on this report prints it, or an em dash.

  Deliberately NOT reformatted into the browser's locale: these come back as the server's own
  'YYYY-MM-DD HH:MM:SS' and the message log, the activity log and the engaged list all show them
  that way. Rendering the same instant in two different shapes on one screen is how somebody ends
  up believing they are two different events.
*/
const whenText = (v) => (v ? String(v) : '—');

/*
  WHO IS BEHIND ONE STEP'S NUMBERS.

  Every figure on the Channel-wise table stands for a list of real people, and the number on its
  own is not actionable: you follow up the student who clicked and you check the number of the one
  the message never reached. This is that list, opened from the row it belongs to.

  Full screen rather than a side panel because the useful view is wide — name, email, phone and
  three timestamps — and a 420px drawer would have shown two of those six.
*/
function StepPeopleSheet({ journeyId, step, range, convGoal, onClose }) {
  const [bucket, setBucket] = useState('clicked');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Escape closes, and the page underneath must not scroll while a full-screen sheet is over it —
  // without the lock the background slides away under the reader's fingers on a trackpad.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  useEffect(() => { setPage(1); }, [bucket]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const d = await stepPeople(journeyId, step.id, { bucket, page, perPage: 50, range });
      if (alive) { setData(d); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [journeyId, step.id, bucket, page, range?.from, range?.to, range?.fromTime, range?.toTime]); // eslint-disable-line

  const counts = data?.counts || {};
  const rows = data?.rows || [];
  const total = data?.total || 0;
  const pages = Math.max(1, Math.ceil(total / (data?.perPage || 50)));

  return (
    <>
      <div className="jr-sheet-back" onClick={onClose} />
      <div className="jr-sheet" role="dialog" aria-modal="true" aria-label={`Who for ${step.name}`}>
        <div className="jr-sheet-head">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase' }}>
                {step.channel} · {step.id}
              </div>
              <h2 style={{ margin: '3px 0 0', fontSize: 19, fontWeight: 700, color: '#0f172a' }}>{step.name}</h2>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                {range ? <>Measured over <b>{range.fromTime || range.toTime ? `${range.from} ${range.fromTime || '00:00:00'} to ${range.to} ${range.toTime || '23:59:59'}` : (range.from === range.to ? range.from : `${range.from} to ${range.to}`)}</b>.</> : 'All time.'}
                {' '}Same window as the table behind this.
              </div>
            </div>
            <button type="button" onClick={onClose}
              style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 9, padding: '8px 14px',
                       fontSize: 12.5, fontWeight: 700, color: '#334155', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
              Close
            </button>
          </div>

          <div style={{ display: 'flex', gap: 7, marginTop: 14, flexWrap: 'wrap' }}>
            {PEOPLE_BUCKETS.map(b => {
              // Converted is meaningless without a goal on the journey, and a tab reading "0"
              // there would be read as "nobody converted" rather than "nothing is being measured".
              if (b.key === 'converted' && !convGoal) return null;
              const n = counts[b.key];
              return (
                <button key={b.key} type="button" className="jr-pill" aria-selected={bucket === b.key}
                        disabled={n === 0} onClick={() => setBucket(b.key)}>
                  {b.label}{n === undefined ? '' : ` · ${nUS(n)}`}
                </button>
              );
            })}
          </div>
        </div>

        <div className="jr-sheet-body">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Loading…</div>
          ) : !rows.length ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              Nobody in this group for the window shown.
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="jr-who">
                  <thead>
                    <tr>
                      <th>Student</th><th>Email</th><th>Phone</th>
                      <th>Delivered</th><th>Opened / read</th><th>Clicked</th>
                      {bucket === 'converted' && <th>Converted</th>}
                      {(bucket === 'failed' || bucket === 'not_sent' || bucket === 'unverified') && <th>Why</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p, i) => (
                      <tr key={i}>
                        <td>
                          <b style={{ color: '#0f172a' }}>{p.name || (p.userId ? `User #${p.userId}` : 'Unknown')}</b>
                          {p.isControl && (
                            <span style={{ marginLeft: 7, fontSize: 10, fontWeight: 800, color: '#7c3aed',
                                           background: '#f5f3ff', borderRadius: 4, padding: '1px 5px' }}>CONTROL</span>
                          )}
                        </td>
                        <td style={{ color: '#475569' }}>{p.email || '—'}</td>
                        <td style={{ color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{p.phone || p.to || '—'}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', color: p.deliveredAt ? '#334155' : '#cbd5e1' }}>{whenText(p.deliveredAt)}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', color: p.openedAt ? '#334155' : '#cbd5e1' }}>{whenText(p.openedAt)}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', color: p.clickedAt ? '#15803d' : '#cbd5e1', fontWeight: p.clickedAt ? 650 : 400 }}>
                          {whenText(p.clickedAt)}
                          {p.clicks > 1 && <span style={{ color: '#94a3b8', fontWeight: 400 }}> · {p.clicks} taps</span>}
                        </td>
                        {bucket === 'converted' && (
                          <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {whenText(p.convertedAt)}
                            {p.eventKey && <span style={{ color: '#94a3b8' }}> · {p.eventKey}</span>}
                          </td>
                        )}
                        {(bucket === 'failed' || bucket === 'not_sent' || bucket === 'unverified') && (
                          <td style={{ color: '#b91c1c', whiteSpace: 'normal', maxWidth: 380 }}>{p.error || p.reason || '—'}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16 }}>
              <button type="button" className="jr-pill" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <span style={{ fontSize: 12.5, color: '#64748b' }}>Page {page} of {pages} · {nUS(total)} people</span>
              <button type="button" className="jr-pill" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/*
  Channel wise — one row per MESSAGE STEP, which is how anyone actually asks the question.

  "Which channel is working" sounds like it wants two rows, WhatsApp and email. In practice a
  journey sends several messages per channel and they perform nothing like each other, so two
  rows average away the only thing worth seeing. The per-channel totals are still here, as a
  summary strip above the table.

  NA rather than 0 wherever the channel does not report a metric — the same rule the campaign
  list follows, and for the same reason: a zero reads as a measurement.
*/
function ChannelWise({ report, j, derived, journeyId, range }) {
  const [openStep, setOpenStep] = useState(null);
  // The report returns node stats keyed by node id under `nodes` (see journeys.php action=report).
  const stats = report?.nodes || {};
  const CH = {
    WhatsApp: { color: '#00A37A', soft: '#e6f7f1' },
    Email:    { color: '#4f46e5', soft: '#eef2ff' },
    SMS:      { color: '#b07408', soft: '#fdf2dc' },
    'App push': { color: '#0d9488', soft: '#e4f6f3' },
  };

  const rows = (derived?.nodes || [])
    .map(n => ({ n, meta: NODE_META[n.key] || {} }))
    .filter(x => x.meta.kind === 'Message')
    .map(({ n, meta }) => {
      const st = stats[n.id] || {};
      return {
        id: n.id,
        channel: meta.channel || 'Other',
        // The template is what a person recognises; the step id is what the canvas shows.
        name: n.cfg?.template || n.cfg?.title || meta.name,
        sent: Number(st.sent || 0),
        delivered: Number(st.delivered || 0),
        opened: Number(st.opened || 0),
        clicked: Number(st.clicked || 0),
        conversions: Number(st.conversions || 0),
        suppressed: Number(st.suppressed || 0),
      };
    })
    .sort((a, b) => b.sent - a.sent);

  const byChannel = {};
  rows.forEach(r => {
    const c = (byChannel[r.channel] ||= { sent: 0, delivered: 0, opened: 0, clicked: 0, conversions: 0, steps: 0 });
    c.steps++; c.sent += r.sent; c.delivered += r.delivered;
    c.opened += r.opened; c.clicked += r.clicked; c.conversions += r.conversions;
  });

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, Object.keys(byChannel).length)}, 1fr)`, gap: 12, marginBottom: 18 }}>
        {Object.entries(byChannel).map(([ch, c]) => {
          const tone = CH[ch] || { color: '#64748b', soft: '#f1f5f9' };
          return (
            <div key={ch} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: tone.color }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{ch}</span>
                <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>{c.steps} step{c.steps > 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {[['Sent', c.sent], ['Delivered', c.delivered], ['Opened', c.opened], ['Clicked', c.clicked]].map(([l, v]) => (
                  <div key={l}>
                    <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600 }}>{l}</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{nUS(v)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Section title="Messages" note="One row per message step. Rates are a share of that step's own sends, never the journey's total.">
        {!rows.length ? <Empty>This journey has no message steps.</Empty> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="jr-ch">
              <thead>
                <tr>
                  <th className="l">Message name</th>
                  <th>Sent</th><th>Not sent</th><th>Delivered</th>
                  <th>Opened / read</th><th>Clicked</th><th>Conversions</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const tone = CH[r.channel] || { color: '#64748b', soft: '#f1f5f9' };
                  return (
                    <tr key={r.id}>
                      <td className="l">
                        <span className="msg">
                          <span className="ic" style={{ background: tone.soft, color: tone.color }}>
                            {r.channel === 'WhatsApp' ? <MessageCircle size={14} /> : <Mail size={14} />}
                          </span>
                          <span><b>{r.name}</b><small>{r.channel} · {r.id}</small></span>
                        </span>
                      </td>
                      <td>{nUS(r.sent)}</td>
                      <td>{r.suppressed ? nUS(r.suppressed) : 0}</td>
                      <td>{nUS(r.delivered)}</td>
                      <td>{nUS(r.opened)} <span style={{ color: '#94a3b8' }}>· {pct(r.opened, r.delivered)}%</span></td>
                      <td>{nUS(r.clicked)} <span style={{ color: '#94a3b8' }}>· {pct(r.clicked, r.delivered)}%</span></td>
                      <td>{j.convGoal ? nUS(r.conversions) : <span className="jr-na">NA</span>}</td>
                      <td>
                        {/* The row's numbers each stand for a list of people; this opens it. */}
                        <button type="button" className="jr-detail-btn" onClick={() => setOpenStep(r)}>
                          See full detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {openStep && (
        <StepPeopleSheet journeyId={journeyId} step={openStep} range={range}
                         convGoal={!!j.convGoal} onClose={() => setOpenStep(null)} />
      )}
    </>
  );
}

export default function JourneyReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const j = report?.journey || null;

  const tabParam = params.get('tab');
  const tab = tabParam === 'channel' || tabParam === 'node' ? tabParam : 'overall';

  const rangeParam = params.get('range');
  const rangeKey = RANGE_PRESETS.some(p => p.key === rangeParam) ? rangeParam : 'all';
  const customFrom = params.get('from') || '';
  const customTo = params.get('to') || '';
  const customFromTime = params.get('ft') || '00:00:00';
  const customToTime = params.get('tt') || '23:59:59';
  const range = resolveRange(rangeKey, customFrom, customTo, customFromTime, customToTime);

  /*
   * The view AND the window both live in the URL, so a particular report can be linked to and
   * survives a reload. They are written through one helper because setParams replaces the whole
   * query string — changing the tab used to wipe the date range with it.
   */
  const writeParams = (next) => {
    const merged = { tab, range: rangeKey, from: customFrom, to: customTo, ft: params.get('ft') || '', tt: params.get('tt') || '', ...next };
    const out = {};
    if (merged.tab && merged.tab !== 'overall') out.tab = merged.tab;
    if (merged.range && merged.range !== 'all') out.range = merged.range;
    if (merged.range === 'custom') {
      if (merged.from) out.from = merged.from; if (merged.to) out.to = merged.to;
      if (merged.ft && merged.ft !== '00:00:00') out.ft = merged.ft;
      if (merged.tt && merged.tt !== '23:59:59') out.tt = merged.tt;
    }
    setParams(out, { replace: true });
  };
  const setTab = t => writeParams({ tab: t });

  /*
   * The custom range is edited as a DRAFT. Every keystroke in a date or time box used to be written
   * straight to the URL, and each write refetched the report — so picking "15 Sep 10:05 → 16 Sep
   * 10:45" fired four half-finished requests (and "Custom" with one box empty fell back to all
   * time). Now nothing is fetched until Apply.
   */
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState({ from: '', to: '', ft: '00:00:00', tt: '23:59:59' });
  const openCustom = () => {
    setDraft({ from: customFrom, to: customTo, ft: customFromTime, tt: customToTime });
    setCustomOpen(true);
  };
  const applyCustom = () => {
    if (!draft.from || !draft.to) { toast.error('Pick both dates'); return; }
    const norm = (t, end) => (t && t.length === 5 ? `${t}:${end ? '59' : '00'}` : (t || (end ? '23:59:59' : '00:00:00')));
    const ft = norm(draft.ft, false); const tt = norm(draft.tt, true);
    if (`${draft.from} ${ft}` > `${draft.to} ${tt}`) { toast.error('The start is after the end'); return; }
    writeParams({ range: 'custom', from: draft.from, to: draft.to, ft, tt });
    setCustomOpen(false);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const r = await getReport(id, range);
      if (alive) { setReport(r); setLoading(false); }
    })();
    return () => { alive = false; };
    // Re-fetched on the resolved days, not on the preset key: "Custom" with only one box filled in
    // resolves to null and must not throw away the numbers already on screen.
  }, [id, range?.from, range?.to, range?.fromTime, range?.toTime]); // eslint-disable-line

  const derived = useMemo(() => {
    if (!j) return null;
    const nodes = Object.values(j.graph?.nodes || {});
    const edges = Object.values(j.graph?.edges || {});
    const channels = {};
    let messages = 0, conditions = 0, actions = 0, triggers = 0;
    nodes.forEach(n => {
      const m = NODE_META[n.key] || { kind: 'Action' };
      if (m.kind === 'Trigger') triggers++;
      else if (m.kind === 'Message') { messages++; channels[m.channel] = (channels[m.channel] || 0) + 1; }
      else if (m.kind === 'Condition') conditions++;
      else actions++;
    });
    const merges = nodes.filter(n => edges.filter(e => e.to === n.id).length > 1).length;
    return { nodes, edges, channels, messages, conditions, actions, triggers, merges };
  }, [j]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading report…</div>;
  }
  if (!j) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
        Journey not found. <button onClick={() => navigate('/netcore/journeys')} style={link}>Back to journeys</button>
      </div>
    );
  }

  const funnel = [
    // "Messages sent", not "Sent" — the funnel counts messages, and a student can
    // appear in it more than once.
    { label: 'Messages sent', v: j.sent, color: '#1e3a8a' },
    { label: 'Delivered', v: j.delivered, color: '#2563eb' },
    { label: 'Opened / Read', v: j.opened, color: '#0d9488' },
    { label: 'Clicked', v: j.clicked, color: '#7c3aed' },
    { label: 'Conversions', v: j.conversions, color: '#15803d' },
  ];
  const maxV = Math.max(1, ...funnel.map(f => Number(f.v) || 0));

  /*
    Taps on the tracked link that carry no identity yet — logged out, and on a link that is
    identical in every message, so there is nothing in the tap itself to name them. Counted as
    ROWS, not as people: WhatsApp's in-app browser starts with empty storage on every open, so
    each tap brings a brand-new visitor key and "distinct visitors" would read one person's
    twelve taps as twelve people. See the note in journey_rollup_node_stats().
  */
  const anonTaps = (report?.taps || []).filter(t => !t.userId && !t.phone).length;

  /* Why the trigger has or has not matched anybody — see journey_trigger_state(). */
  const ts = report?.triggerState || null;

  /*
    Per-channel totals, folded up from the per-node stats already loaded.

    Built here rather than asked for separately so the charts, the Channel-wise table and the
    node table can never disagree — they are three renderings of one array. Only channels that
    actually appear in the graph get a series: an empty SMS bar on every journey would be a
    permanent reminder of a channel this server cannot send on.
  */
  const channelTotals = CHANNEL_ORDER
    .map(({ name, color }) => {
      const t = { name, color, sent: 0, delivered: 0, opened: 0, clicked: 0, steps: 0 };
      (derived?.nodes || []).forEach(n => {
        const meta = NODE_META[n.key];
        if (meta?.kind !== 'Message' || meta.channel !== name) return;
        const st = report?.nodes?.[n.id] || {};
        t.steps++;
        t.sent += Number(st.sent || 0);
        t.delivered += Number(st.delivered || 0);
        t.opened += Number(st.opened || 0);
        t.clicked += Number(st.clicked || 0);
      });
      return t;
    })
    .filter(t => t.steps > 0);

  /* Pivoted to one row per stage, one key per channel — the shape a grouped bar chart wants. */
  const channelStages = ['Sent', 'Delivered', 'Opened / read', 'Clicked'].map((stage, i) => {
    const key = ['sent', 'delivered', 'opened', 'clicked'][i];
    const row = { stage };
    channelTotals.forEach(c => { row[c.name] = c[key]; });
    return row;
  });

  return (
    <div style={{ padding: '20px 24px 48px', maxWidth: 1120, margin: '0 auto' }}>
      <style>{TAB_CSS}</style>
      {/* header */}
      <button onClick={() => navigate('/netcore/journeys')} style={{ ...link, display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}><ArrowLeft size={15} /> Journeys</button>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 21, fontWeight: 700, color: '#0f172a', margin: 0 }}>{j.name}</h1>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.4px', color: '#475569', background: '#eef1f6', border: '1px solid #dbe1ea', padding: '2px 8px', borderRadius: 5 }}>{String(j.status).toUpperCase()}</span>
          </div>
          <p style={{ margin: '5px 0 0', fontSize: 12.5, color: '#94a3b8' }}>ID - {j.id} · {j.dates || '—'}</p>
        </div>
        <button onClick={() => navigate(`/netcore/journeys/${j.id}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid #e2e8f0', background: '#fff', color: '#334155', padding: '9px 15px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}><Pencil size={15} /> Edit journey</button>
      </div>

      {/*
        Three views of the same run, because they answer three different questions and stacking
        them made a page nobody scrolled to the bottom of:

          Overall      did this journey work — totals, funnel, conversions, lift
          Channel wise which channel is carrying it — one row per message step, WhatsApp vs email
          Node wise    where students actually go — every step, what it did, who is stuck in it

        The tab is in the URL so a particular view can be linked to and survives a reload.
      */}
      <div className="jr-tabbar">
        <div className="jr-tabs" role="tablist" aria-label="Report view">
          {[['overall', 'Overall'], ['channel', 'Channel wise'], ['node', 'Node wise']].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className="jr-tab"
                    onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>

        {/*
          Beside the tabs rather than inside one of them: every view below reads the same window,
          so a range chosen on Overall is still in force after switching to Channel wise. Splitting
          it per tab would have meant the two views could quietly disagree about the period.
        */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {RANGE_PRESETS.map(p => (
            <button key={p.key} type="button"
              onClick={() => { if (p.key === 'custom') { openCustom(); return; } setCustomOpen(false); writeParams({ range: p.key }); }}
              style={{
                padding: '6px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
                border: (p.key === 'custom' ? (rangeKey === 'custom' || customOpen) : rangeKey === p.key && !customOpen) ? '1px solid #4f46e5' : '1px solid #e2e8f0',
                background: (p.key === 'custom' ? (rangeKey === 'custom' || customOpen) : rangeKey === p.key && !customOpen) ? '#eef2ff' : '#fff',
                color: (p.key === 'custom' ? (rangeKey === 'custom' || customOpen) : rangeKey === p.key && !customOpen) ? '#1e3a8a' : '#64748b',
              }}>{p.key === 'custom' && rangeKey === 'custom' && range && !customOpen
                ? `Custom: ${range.from} ${customFromTime.slice(0, 5)} → ${range.to} ${customToTime.slice(0, 5)}`
                : p.label}</button>
          ))}
          {customOpen && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <input type="date" value={draft.from} max={draft.to || undefined} aria-label="From date"
                onChange={e => setDraft(d => ({ ...d, from: e.target.value }))} style={{ padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', color: '#334155' }} />
              {/* Time of day on each end, defaulting to the whole day (00:00:00 → 23:59:59). */}
              <input type="time" step="1" value={draft.ft} aria-label="From time"
                onChange={e => setDraft(d => ({ ...d, ft: e.target.value || '00:00:00' }))} style={{ padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', color: '#334155' }} />
              <span style={{ fontSize: 12, color: '#94a3b8' }}>to</span>
              <input type="date" value={draft.to} min={draft.from || undefined} aria-label="To date"
                onChange={e => setDraft(d => ({ ...d, to: e.target.value }))} style={{ padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', color: '#334155' }} />
              <input type="time" step="1" value={draft.tt} aria-label="To time"
                onChange={e => setDraft(d => ({ ...d, tt: e.target.value || '23:59:59' }))} style={{ padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', color: '#334155' }} />
              <button type="button" onClick={applyCustom}
                style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid #1e3a8a', background: '#1e3a8a', color: '#fff' }}>
                Apply
              </button>
              <button type="button" onClick={() => setCustomOpen(false)}
                style={{ padding: '6px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b' }}>
                Cancel
              </button>
            </span>
          )}
        </div>
      </div>

      {/*
        Said out loud, because every number on the page is a share of it. A funnel measured over
        seven days next to a journey that has run for three months is unreadable otherwise — and
        the commonest reading of a small number is "it stopped working", not "you narrowed it".
      */}
      {range && (
        <div style={{ margin: '0 0 18px', fontSize: 12, color: '#64748b' }}>
          Showing <b style={{ color: '#334155' }}>{range.fromTime || range.toTime
            ? `${range.from} ${range.fromTime || '00:00:00'} to ${range.to} ${range.toTime || '23:59:59'}`
            : (range.from === range.to ? range.from : `${range.from} to ${range.to}`)}</b>.
          Messages count by when they were sent, conversions by when the goal fired.
        </div>
      )}
      {customOpen && (
        <div style={{ margin: '0 0 18px', fontSize: 12, color: '#b45309' }}>
          Pick the dates and times, then press Apply — the numbers below still show {range ? 'the previous range' : 'all time'} until then.
        </div>
      )}

      {/* KPI cards.
          Students and Messages are separate tiles on purpose: one student can pass
          through several message steps, so "3 students, 4 messages" is normal and
          used to read as a bug. Every rate below is a share of MESSAGES. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { l: 'Students', v: j.entered, sub: `${nUS(j.active || 0)} still in the journey` },
          /*
            "5 messages to 4 students" spelled out on the tile. A journey with three
            message steps sends more messages than it has students whenever anyone
            passes through two of them — which reads as a counting error every time it
            is not said out loud.
          */
          {
            l: 'Messages sent', v: j.sent,
            sub: [
              j.recipients ? `to ${nUS(j.recipients)} student${j.recipients === 1 ? '' : 's'}` : null,
              j.suppressed ? `${nUS(j.suppressed)} held back` : null,
              // Said on the tile as well as in the strip above: a reader who scrolls straight to
              // the numbers must not be able to miss that some sends never landed.
              j.failed ? `${nUS(j.failed)} rejected` : null,
            ].filter(Boolean).join(' · ') || undefined,
          },
          { l: 'Delivered', v: j.delivered, r: pct(j.delivered, j.sent) },
          { l: 'Opened / Read', v: j.opened, r: pct(j.opened, j.sent) },
          /*
            Clicked counts PEOPLE we can name. A tap on a static tracked link names nobody
            until that person signs in, so a report could show 0 while taps were plainly
            arriving — which reads as broken tracking rather than as "not identified yet".
            The unnamed ones are shown beside it, as taps, never folded into the number.
          */
          {
            l: 'Clicked', v: j.clicked, r: pct(j.clicked, j.sent),
            sub: anonTaps > 0 ? `+${nUS(anonTaps)} tap${anonTaps === 1 ? '' : 's'} not identified yet` : undefined,
          },
          { l: 'Conversions', v: j.conversions, r: pct(j.conversions, j.entered) },
          { l: 'Revenue', v: j.revenue, money: 1 },
        ].map(k => (
          <div key={k.l} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>{k.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{k.money ? '₹' + nUS(k.v) : nUS(k.v)}</div>
            {k.r !== undefined && <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
              {k.r}% of {k.l === 'Conversions' ? 'students' : 'messages'}</div>}
            {k.sub && <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/*
          Nothing in a journey happens without a tick.

          Entries, delays and every "wait N minutes" connector are resolved by the cron
          worker; if it stops, the journey does not fail — it freezes, mid-sequence, with
          the first message already delivered. That is indistinguishable from a broken
          delay from the outside, so a live journey the worker has not touched in five
          minutes says so.
      */}
      {/*
          THE PROVIDER REFUSED THESE — the loudest thing on the page when it happens.

          A journey whose every message WhatsApp declined used to look exactly like one that never
          ran: every tile zero and no explanation anywhere above the message log. The two need
          completely different responses, so the count and the reasons are stated here, before any
          of the numbers they explain.

          The reason is Meta's own text, verbatim and with its code, because that code is what an
          admin searches for and what support asks for. 131049 is a per-person marketing cap and
          the journey is working; 131026 means the number cannot receive WhatsApp at all.
      */}
      {(report.failures || []).length > 0 && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
          padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#991b1b',
        }}>
          <b>
            {nUS(j.failed || (report.failures || []).reduce((n, f) => n + f.count, 0))} message
            {(j.failed || 0) === 1 ? ' was' : 's were'} rejected by the provider after this journey handed
            {(j.failed || 0) === 1 ? ' it' : ' them'} over.
          </b>
          <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {report.failures.map((f, i) => (
              <div key={i} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{nUS(f.count)}×</span>{' '}
                <span style={{ color: '#7f1d1d' }}>{f.reason}</span>
                {f.channel ? <span style={{ color: '#b91c1c', opacity: .75 }}> · {f.channel}</span> : null}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, color: '#b91c1c' }}>
            Rejected sends are not counted as sent, which is why the tiles below can read zero while the
            message log shows every attempt.
          </div>
        </div>
      )}

      {j.status === 'ongoing' && (j.workerAge === null || j.workerAge > 300) && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
          padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#92400e',
        }}>
          <b>The journey worker {j.workerAge === null ? 'has never run' : `last ran ${Math.round(j.workerAge / 60)} minute${Math.round(j.workerAge / 60) === 1 ? '' : 's'} ago`}.</b>{' '}
          Waits and delays only fire when it ticks, so anything scheduled after a message is stuck until it does.
          It should run every minute:{' '}
          <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>
            * * * * * /usr/bin/php /path/to/react-api/api/journeys/journey-worker.php
          </code>
        </div>
      )}

      {/*
          The canvas is not always what is running.

          A deployed journey executes the version pinned when it was published, so a step
          added afterwards — the WhatsApp three minutes after the email, say — exists on
          screen and nowhere else. Every number below is then measured against a graph the
          engine has never seen, which is unreadable unless it is said here.
      */}
      {j.graphDirty && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
          padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#991b1b',
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 320 }}>
            <b>The canvas has changes that are not live.</b>{' '}
            Students are running{j.liveVersion ? ` version ${j.liveVersion}` : ' the version'} pinned when this
            journey was last published — steps and delays you have edited or added since then are not being
            executed. Open the builder and press <b>Update live journey</b> to deploy them.
          </div>
          <button
            onClick={() => navigate(`/netcore/journeys/${j.id}`)}
            style={{
              border: '1px solid #fecaca', background: '#fff', color: '#991b1b', padding: '8px 14px',
              borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>Open the builder</button>
        </div>
      )}

      {/* The cap counts across EVERY journey, so the thing that used up the allowance is
          usually a different journey entirely. That makes it the hardest suppression to
          diagnose from the outside — hence a direct way out rather than a pointer to a
          setting three clicks away. */}
      {report?.suppressions?.frequency_cap > 0 && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
          padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#92400e',
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 320 }}>
            <b>{nUS(report.suppressions.frequency_cap)} message{report.suppressions.frequency_cap > 1 ? 's were' : ' was'} held back by the daily cap.</b>{' '}
            The cap counts messages from <b>every</b> journey, not just this one — so another journey
            that messaged these students earlier today used up their allowance.
          </div>
          <button
            onClick={async () => {
              await setCap(id, false);
              toast.success('Daily cap turned off. Republish or wait for the next step to send.');
              setReport(await getReport(id));
            }}
            style={{
              border: '1px solid #d97706', background: '#fff', color: '#b45309', cursor: 'pointer',
              borderRadius: 8, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
            }}>
            Turn off the daily cap
          </button>
        </div>
      )}

      {/* A goal is required before conversions can be counted at all — without it the
          engine has no event to attribute and the column stays at zero regardless of
          how well the journey performs. */}
      {!j.convGoal && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
          padding: '11px 14px', marginBottom: 20, fontSize: 13, color: '#92400e',
        }}>
          <b>No conversion goal is set</b>, so Conversions and Revenue will stay at zero.
          Open <b>Edit journey → Journey settings → Conversion goal</b>, pick the event that
          counts as success, and republish. The goal locks once the journey is live.
        </div>
      )}

      {/*
        The banner that turns a screen of zeroes into a sentence.

        A journey that enrolled nobody looks exactly like a broken one, and the usual cause is
        not a bug: a trigger only counts engagement that happens AFTER publishing, so opens from
        before that are invisible to it. Shown on every tab, because whichever one you land on
        the question is the same.
      */}
      {/*
        Duplicate-trigger warning.

        Each journey's own report is entirely correct here — one entry, one send — so the
        duplication is invisible on this screen and only shows up on the student's phone. Naming
        the twins is the only way the panel can explain "why did I get this twice".
      */}
      {ts?.twins?.length > 0 && (
        <div style={{
          display: 'flex', gap: 11, padding: '13px 15px', borderRadius: 10, marginBottom: 16,
          background: '#fffaeb', border: '1px solid #fedf89', color: '#93370d',
          fontSize: 12.5, lineHeight: 1.65,
        }}>
          <span style={{ flex: 'none', marginTop: 1 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
          </span>
          <div>
            <b>{ts.twins.length} other live journey{ts.twins.length > 1 ? 's have' : ' has'} the same trigger.</b>{' '}
            {ts.twins.map((t, i) => (
              <span key={t.id}>
                {i > 0 && ', '}
                <button onClick={() => navigate(`/netcore/journeys/${t.id}/report`)}
                        style={{ ...link, fontSize: 12.5 }}>{t.name} (#{t.id})</button>
              </span>
            ))}
            . They enrol the same students off the same event, so each one sends its own message —
            a student receives {ts.twins.length + 1} copies, seconds apart. Stop the ones you are not
            using, or turn on the daily message cap in Journey settings, which counts across every journey.
          </div>
        </div>
      )}

      {ts && ts.entered === 0 && (
        <div style={{
          display: 'flex', gap: 11, padding: '13px 15px', borderRadius: 10, marginBottom: 16,
          background: ts.everPolled ? '#f5f8ff' : '#fffaeb',
          border: `1px solid ${ts.everPolled ? '#d1e0ff' : '#fedf89'}`,
          color: ts.everPolled ? '#1849a9' : '#93370d', fontSize: 12.5, lineHeight: 1.65,
        }}>
          <span style={{ flex: 'none', marginTop: 1 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
          </span>
          <div>
            {!ts.everPolled ? (
              <>
                <b>The engine has not checked this journey&apos;s trigger yet.</b> Nothing can enter
                until it does. If this journey is ongoing and this persists, the cron worker
                (journey-worker.php) is not running.
              </>
            ) : (
              <>
                <b>Nobody has entered this journey yet.</b> The trigger has run
                {ts.cursors?.[0]?.lastRunAt ? <> (last checked {String(ts.cursors[0].lastRunAt).replace('T', ' ')})</> : null}
                {' '}but matched nobody.
                {ts.deployedAt && (
                  <> It only counts activity from <b>{String(ts.deployedAt).replace('T', ' ')}</b> onwards —
                  anything that happened before you published is invisible to it.</>
                )}
                {' '}For an engagement trigger, set <b>Include engagement from before publishing</b> on the
                trigger step, then republish to pick up opens and clicks that already happened.
              </>
            )}
          </div>
        </div>
      )}

      {tab === "overall" && (<>
      {/*
        The two charts the Overall view is actually for: which channel carried the sending, and
        how each channel performed at every stage. Both are built from the per-node stats already
        loaded, folded up by channel — there is no separate endpoint, and no separate truth.
      */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 16 }}>
        <Section title="Channel performance" note="Every message step in this journey, folded up by channel.">
          {!channelTotals.length ? <Empty>No messaging steps in this journey.</Empty> : (
            <ResponsiveContainer width="100%" height={236}>
              <BarChart data={channelStages} margin={{ top: 6, right: 10, left: -16, bottom: 0 }} barGap={3}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="stage" tick={{ fontSize: 11.5, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={50}
                       tickFormatter={v => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                <Tooltip content={<JrTip />} cursor={{ fill: 'rgba(15,23,42,.04)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11.5, paddingTop: 4 }} />
                {/* One bar per channel present, in a fixed order — a filter that removes a
                    channel must never repaint the survivors. 4px rounded data-ends on the baseline. */}
                {channelTotals.map(c => (
                  <Bar key={c.name} dataKey={c.name} fill={c.color} radius={[4, 4, 0, 0]} maxBarSize={26} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Messages sent by channel" note="Share of everything this journey sent.">
          {!channelTotals.length ? <Empty>Nothing sent yet.</Empty> : (
            <>
              <ResponsiveContainer width="100%" height={176}>
                <PieChart>
                  <Pie data={channelTotals.filter(c => c.sent > 0)} dataKey="sent" nameKey="name"
                       innerRadius={44} outerRadius={70} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                    {channelTotals.filter(c => c.sent > 0).map(c => <Cell key={c.name} fill={c.color} />)}
                  </Pie>
                  <Tooltip content={<JrTip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Direct labels rather than a legend box: with two or three channels the numbers
                  matter as much as the split, and a legend alone would not carry them. */}
              <div style={{ marginTop: 6 }}>
                {channelTotals.map(c => (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color }} />
                    <span style={{ fontSize: 12.5, color: '#334155' }}>{c.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                      {nUS(c.sent)}
                    </span>
                    <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 44, textAlign: 'right' }}>
                      {pct(c.sent, j.sent)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>
      </div>

      {/* funnel */}
      <Section title="Engagement funnel" note="Journey-level totals from stored reporting.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {funnel.map(f => {
            const w = Math.max(2, Math.round(((Number(f.v) || 0) / maxV) * 100));
            return (
              <div key={f.label} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 150px', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12.5, color: '#334155', fontWeight: 500 }}>{f.label}</span>
                <div style={{ background: '#f1f5f9', borderRadius: 6, height: 22, overflow: 'hidden' }}>
                  <div style={{ width: `${w}%`, height: '100%', background: f.color, borderRadius: 6, transition: 'width .4s' }} />
                </div>
                <span style={{ fontSize: 12.5, color: '#0f172a', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                  {nUS(f.v)} <span style={{ color: '#94a3b8' }}>· {pct(f.v, j.sent)}%</span>
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* channel mix */}
        <Section title="Channel mix" note="From the journey graph.">
          {Object.keys(derived.channels).length === 0
            ? <Empty>No messaging steps in this journey.</Empty>
            : Object.entries(derived.channels).map(([ch, n]) => (
              <div key={ch} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 13, color: '#334155' }}>{ch}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{n} step{n > 1 ? 's' : ''}</span>
              </div>
            ))}
        </Section>
        {/* structure */}
        <Section title="Structure" note="From the journey graph.">
          {[['Total steps', derived.nodes.length], ['Triggers', derived.triggers], ['Messages', derived.messages], ['Conditions', derived.conditions], ['Other actions', derived.actions], ['Connections', derived.edges.length], ['Merges', derived.merges]].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 13, color: '#334155' }}>{l}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
            </div>
          ))}
        </Section>
      </div>

      </>)}

      {tab === "channel" && <ChannelWise report={report} j={j} derived={derived} journeyId={id} range={range} />}

      {tab === "node" && (<>
      {/* The journey as it was drawn, with what each step actually did printed on it. A table of
          steps says what every node did but not where anybody went; the shape is the explanation. */}
      <Section title="Journey flow" note="Your own layout, read-only. Drag to pan, and use the controls to zoom or fit.">
        <JourneyDiagram graph={j.graph} stats={report?.nodes || {}} waiting={report?.waiting || {}}
                        journeyEntered={j.entered} />
      </Section>

      {/* node table */}
      <Section title="Steps" note="Entered, sent, opened and clicked come from journey_node_stats; Waiting is the live queue.">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 860 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                <th style={thc}>Step</th><th style={thc}>Type</th><th style={thc}>Channel</th>
                <th style={{ ...thc, textAlign: 'right' }}>Paths</th>
                <th style={{ ...thc, textAlign: 'right' }}>Entered</th>
                <th style={{ ...thc, textAlign: 'right' }}>Sent</th>
                <th style={{ ...thc, textAlign: 'right' }}>Opened</th>
                <th style={{ ...thc, textAlign: 'right' }}>Clicked</th>
                <th style={{ ...thc, textAlign: 'right' }}>Held back</th>
                <th style={{ ...thc, textAlign: 'right' }}>Waiting</th>
              </tr>
            </thead>
            <tbody>
              {derived.nodes.length === 0 && <tr><td colSpan={10} style={{ padding: '28px 12px', textAlign: 'center', color: '#94a3b8' }}>This journey has no steps yet.</td></tr>}
              {derived.nodes.map(n => {
                const m = NODE_META[n.key] || { name: n.key, kind: 'Action' };
                const outs = derived.edges.filter(e => e.from === n.id).length;
                const s = report?.nodes?.[n.id] || {};
                const waiting = report?.waiting?.[n.id] || 0;
                // A step with students waiting on it and no outgoing path is the classic
                // stuck-users defect — the validator blocks it at publish, but an older
                // journey published before that rule existed shows up here in red.
                const stuck = waiting > 0 && outs === 0;
                const num = v => (v ? nUS(v) : <span style={{ color: '#cbd5e1' }}>—</span>);
                return (
                  <tr key={n.id} style={{ borderTop: '1px solid #f1f5f9', background: stuck ? '#fff7f6' : undefined }}>
                    <td style={{ ...tdc, fontWeight: 600, color: '#0f172a' }}>{n.cfg?.__label || m.name}</td>
                    <td style={tdc}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 7, height: 7, borderRadius: 2, background: KIND_COLOR[m.kind] || '#94a3b8' }} />{m.kind}</span></td>
                    <td style={{ ...tdc, color: '#64748b' }}>{m.channel || '—'}</td>
                    <td style={{ ...tdc, textAlign: 'right', color: '#334155' }}>{outs}</td>
                    <td style={{ ...tdc, textAlign: 'right', color: '#0f172a', fontWeight: 600 }}>{num(s.entered)}</td>
                    <td style={{ ...tdc, textAlign: 'right' }}>{num(s.sent)}</td>
                    <td style={{ ...tdc, textAlign: 'right' }}>{num(s.opened)}</td>
                    <td style={{ ...tdc, textAlign: 'right' }}>{num(s.clicked)}</td>
                    <td style={{ ...tdc, textAlign: 'right', color: s.suppressed ? '#b45309' : undefined }}>{num(s.suppressed)}</td>
                    <td style={{ ...tdc, textAlign: 'right', color: stuck ? '#b42318' : '#334155', fontWeight: stuck ? 700 : 400 }}>
                      {num(waiting)}{stuck ? ' ⚠' : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Why messages were withheld. Netcore drops these silently; every one here has a reason. */}
      {report?.suppressions && Object.keys(report.suppressions).length > 0 && (
        <Section title="Messages held back" note="Every message the engine chose not to send, and why. Students were not removed from the journey.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {Object.entries(report.suppressions).map(([reason, count]) => (
              <div key={reason} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', minWidth: 150 }}>
                <div style={{ fontSize: 19, fontWeight: 700, color: '#0f172a' }}>{nUS(count)}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{SUPPRESS_LABEL[reason] || reason}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── What the engine actually did, step by step ──────────────────────
          The first place to look when a journey "isn't working". Counters that
          are all zero tell you nothing; this tells you which step each student
          reached, which branch they took, and exactly why a message was not sent. */}
      {/* Who engaged — the follow-up list. A click count says the journey worked;
          this says who to call. */}
      {(report?.engaged || []).length > 0 && (
        <Section title="Who opened and clicked" note="Students who read or tapped a message from this journey, most recent first.">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 820 }}>
              <thead><tr style={thr}>
                <th style={thc}>Student</th><th style={thc}>Email</th><th style={thc}>Phone</th>
                <th style={thc}>Channel</th><th style={thc}>Delivered</th>
                <th style={thc}>Opened / Read</th><th style={thc}>Clicked</th>
              </tr></thead>
              <tbody>
                {report.engaged.map((e, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f1f5f9', background: e.clickedAt ? '#f6fdf9' : undefined }}>
                    <td style={{ ...tdc, fontWeight: 600 }}>{e.name || `User #${e.userId}`}</td>
                    <td style={{ ...tdc, color: '#475569' }}>{e.email || '—'}</td>
                    <td style={{ ...tdc, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{e.phone || '—'}</td>
                    <td style={{ ...tdc, color: '#64748b' }}>{e.channel}</td>
                    <td style={{ ...tdc, color: '#64748b', whiteSpace: 'nowrap' }}>{e.deliveredAt || '—'}</td>
                    <td style={{ ...tdc, color: '#64748b', whiteSpace: 'nowrap' }}>{e.openedAt || '—'}</td>
                    <td style={{ ...tdc, whiteSpace: 'nowrap', color: e.clickedAt ? '#15803d' : '#cbd5e1', fontWeight: e.clickedAt ? 600 : 400 }}>
                      {e.clickedAt ? `${e.clickedAt}${e.clicks > 1 ? ` (${e.clicks}×)` : ''}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Every WhatsApp tap, one row each. The Clicked tile counts distinct people, so without
          this a repeat tapper cannot tell "counted once, correctly" from "not counted at all". */}
      {(report?.taps || []).length > 0 && (
        <Section
          title="WhatsApp link taps"
          note={`${report.taps.length} tap${report.taps.length === 1 ? '' : 's'} from ${report.tapPeople || 0} ${(report.tapPeople || 0) === 1 ? 'person' : 'people'} — Clicked counts people, this counts every tap.`}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 620 }}>
              <thead><tr style={thr}>
                <th style={thc}>When</th><th style={thc}>Who</th>
                <th style={thc}>Phone</th><th style={thc}>Link</th>
              </tr></thead>
              <tbody>
                {report.taps.map((t, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ ...tdc, whiteSpace: 'nowrap', color: '#64748b' }}>{t.at}</td>
                    <td style={{ ...tdc, fontWeight: t.userId ? 600 : 400, color: t.userId ? '#0f172a' : '#94a3b8' }}>
                      {t.who}
                    </td>
                    <td style={{ ...tdc, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{t.phone || '—'}</td>
                    <td style={{ ...tdc, color: '#64748b' }}>#{t.linkId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section title="Message log" note="Every send the engine attempted, including the ones it deliberately withheld — newest first.">
        {(report?.messages || []).length === 0 ? (
          <div style={{ padding: '20px 2px', color: '#94a3b8', fontSize: 13 }}>
            No message step has been reached yet. Check the activity log below to see where students are.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760 }}>
              <thead><tr style={thr}>
                <th style={thc}>When</th><th style={thc}>Student</th><th style={thc}>Channel</th>
                <th style={thc}>Outcome</th><th style={thc}>Why</th>
              </tr></thead>
              <tbody>
                {report.messages.map((m, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ ...tdc, whiteSpace: 'nowrap', color: '#64748b' }}>{m.at}</td>
                    <td style={{ ...tdc, fontWeight: 600 }}>{m.to || '—'}</td>
                    <td style={{ ...tdc, color: '#64748b' }}>{m.channel}</td>
                    <td style={tdc}><StatusPill status={m.status} /></td>
                    <td style={{ ...tdc, color: '#475569' }}>
                      {m.error || SUPPRESS_LABEL[m.reason] || m.reason || (m.status === 'sent' ? m.provider || '' : '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Activity log" note="Each student's path through the canvas — which step, which branch, and what happened there.">
        {(report?.steps || []).length === 0 ? (
          <div style={{ padding: '20px 2px', color: '#94a3b8', fontSize: 13 }}>
            Nothing has run yet. If this journey is ongoing, check that the cron worker is running.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 460, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 820 }}>
              <thead><tr style={thr}>
                <th style={thc}>When</th><th style={thc}>Student</th><th style={thc}>Step</th>
                <th style={thc}>Took</th><th style={thc}>Result</th><th style={thc}>Detail</th>
              </tr></thead>
              <tbody>
                {report.steps.map((s, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ ...tdc, whiteSpace: 'nowrap', color: '#64748b' }}>{s.at}</td>
                    <td style={{ ...tdc, fontWeight: 600 }}>
                      {s.who}{s.isControl && <span style={{ marginLeft: 6, fontSize: 11, color: '#b45309' }}>held out</span>}
                    </td>
                    <td style={tdc}>{(NODE_META[s.nodeKey] || {}).name || s.nodeKey}</td>
                    <td style={{ ...tdc, color: '#334155' }}>{s.branch || '—'}</td>
                    <td style={tdc}><StatusPill status={s.outcome} /></td>
                    <td style={{ ...tdc, color: '#475569' }}>{s.detail || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      </>)}

      {tab === "overall" && (<>
      {/* The number that justifies the whole system. */}
      {report?.lift?.control_entered > 0 && (
        <Section title="Incremental lift" note="Held-out students walk the journey but receive nothing. The gap between the two rates is what this journey actually caused.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22 }}>
            <LiftBlock label="Treated" entered={report.lift.treated_entered} converted={report.lift.treated_converted} />
            <LiftBlock label="Held out" entered={report.lift.control_entered} converted={report.lift.control_converted} />
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', color: '#64748b' }}>Lift</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#15803d' }}>
                {(pct(report.lift.treated_converted, report.lift.treated_entered)
                  - pct(report.lift.control_converted, report.lift.control_entered)).toFixed(1)} pts
              </div>
            </div>
          </div>
        </Section>
      )}
      </>)}
    </div>
  );
}

function Section({ title, note, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{title}</h2>
        {note && <span style={{ fontSize: 11, color: '#94a3b8' }}>{note}</span>}
      </div>
      {children}
    </div>
  );
}
function Empty({ children }) { return <div style={{ padding: '18px 0', textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>{children}</div>; }

const link = { border: 0, background: 'none', color: '#1e3a8a', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 };
const thc = { padding: '10px 12px', fontWeight: 700 };
const tdc = { padding: '11px 12px' };
