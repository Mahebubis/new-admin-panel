import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Pencil, MessageCircle, Mail } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import { getReport, setCap } from './journeyStore';
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
.jr-tabs{display:flex;gap:2px;border-bottom:1px solid #e2e8f0;margin-bottom:20px}
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
`;

/*
  Channel wise — one row per MESSAGE STEP, which is how anyone actually asks the question.

  "Which channel is working" sounds like it wants two rows, WhatsApp and email. In practice a
  journey sends several messages per channel and they perform nothing like each other, so two
  rows average away the only thing worth seeing. The per-channel totals are still here, as a
  summary strip above the table.

  NA rather than 0 wherever the channel does not report a metric — the same rule the campaign
  list follows, and for the same reason: a zero reads as a measurement.
*/
function ChannelWise({ report, j, derived }) {
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
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
  const setTab = t => setParams(t === 'overall' ? {} : { tab: t }, { replace: true });

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const r = await getReport(id);
      if (alive) { setReport(r); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [id]);

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
      <div className="jr-tabs" role="tablist" aria-label="Report view">
        {[['overall', 'Overall'], ['channel', 'Channel wise'], ['node', 'Node wise']].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className="jr-tab"
                  onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

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

      {tab === "channel" && <ChannelWise report={report} j={j} derived={derived} />}

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
