import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/*
 * A read-only picture of the journey, with what each step actually did printed on it.
 *
 * WHY A DIAGRAM AND NOT THE TABLE
 * A table of steps tells you what every node did but not where anybody went. "Two thousand
 * reached the WhatsApp step and forty reached the email after it" only means something once you
 * can see that the email sits behind a wait and a False branch. The shape IS the explanation,
 * which is why the reference product's Node-wise tab is the canvas rather than a list.
 *
 * READ-ONLY BY CONSTRUCTION, not by disabling things. There is no drag, no port, no delete and
 * no config drawer in this file at all — the only interactions are pan, zoom and fit. A report
 * that could accidentally rewrite a live journey would be a genuinely dangerous screen, and the
 * safest way to guarantee it cannot is for the editing code to be absent rather than switched off.
 *
 * LAYOUT
 * Node coordinates come from the saved graph, so this is the author's own arrangement — the same
 * picture they drew in the builder, not a re-layout that would make a familiar journey
 * unrecognisable. Journeys saved before positions were stored fall back to a simple stacked
 * layout so they still render as something rather than a pile at the origin.
 */

const NODE_W = 246;
const NODE_H = 74;

const META = {
  trg_activity: { name: 'Activity', kind: 'Trigger' },
  trg_segment:  { name: 'Segment', kind: 'Trigger' },
  trg_list:     { name: 'List', kind: 'Trigger' },
  trg_business: { name: 'Business event', kind: 'Trigger' },
  act_wa:    { name: 'WhatsApp', kind: 'Message', channel: 'whatsapp' },
  act_email: { name: 'Email', kind: 'Message', channel: 'email' },
  act_sms:   { name: 'SMS', kind: 'Message', channel: 'sms' },
  act_push:  { name: 'App push', kind: 'Message', channel: 'push' },
  act_attr:   { name: 'Update attribute', kind: 'Action' },
  act_remove: { name: 'Remove from journey', kind: 'Action' },
  act_hook:   { name: 'Call a service', kind: 'Action' },
  act_exit:   { name: 'Exit journey', kind: 'Action' },
  cnd_attr:       { name: 'Check attribute', kind: 'Condition' },
  cnd_event:      { name: 'Has done event', kind: 'Condition' },
  cnd_reach:      { name: 'Reachable on', kind: 'Condition' },
  cnd_split:      { name: 'Split traffic', kind: 'Condition' },
  cnd_in_segment: { name: 'Is in segment', kind: 'Condition' },
  cnd_in_list:    { name: 'Is in list', kind: 'Condition' },
  flw_wait:  { name: 'Wait', kind: 'Wait' },
  flw_event: { name: 'Wait for event', kind: 'Wait' },
};

/* One tone per node kind, matching the builder's palette so a journey looks like itself here. */
const TONE = {
  Trigger:   { c: '#4c5bd4', bg: '#eef0ff' },
  Message:   { c: '#ff6a1f', bg: '#fff0e7' },
  Action:    { c: '#ff6a1f', bg: '#fff0e7' },
  Condition: { c: '#0d9488', bg: '#e4f6f3' },
  Wait:      { c: '#b07408', bg: '#fdf2dc' },
};

const CSS = `
.jd-wrap { position:relative; background:
  radial-gradient(circle at 1px 1px, #dfe3f0 1px, transparent 0) 0 0/22px 22px, #f7f8fc;
  border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; height:620px; cursor:grab;
  user-select:none; -webkit-user-select:none; }
.jd-wrap.pan { cursor:grabbing; }
.jd-world { position:absolute; top:0; left:0; transform-origin:0 0; }
.jd-edges { position:absolute; top:0; left:0; overflow:visible; pointer-events:none; transform-origin:0 0; }

.jd-node { position:absolute; width:${NODE_W}px; background:#fff; border:1.5px solid #e3e6f3;
  border-radius:12px; box-shadow:0 1px 2px rgba(19,22,50,.06), 0 1px 3px rgba(19,22,50,.05);
  display:flex; overflow:hidden; }
.jd-node .side { width:42px; flex:none; display:grid; place-items:center; border-right:1px solid #eceef8; }
.jd-node .body { flex:1; padding:9px 11px; min-width:0; }
.jd-node .kind { font-size:9.5px; letter-spacing:.1em; text-transform:uppercase; color:#9ba0c0; font-weight:700; }
.jd-node .ttl { font-size:13.5px; font-weight:650; color:#131632; margin-top:1px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.jd-node .sub { font-size:11px; color:#767ca3; margin-top:2px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.jd-node .stats { display:flex; gap:9px; margin-top:5px; flex-wrap:wrap; }
.jd-node .stats i { font-style:normal; display:inline-flex; align-items:center; gap:4px;
  font-size:10.5px; font-weight:650; color:#475467; font-variant-numeric:tabular-nums; }
.jd-node .stats i svg { opacity:.55; }
.jd-node .count { flex:none; display:flex; flex-direction:column; justify-content:center; align-items:center;
  padding:0 10px; border-left:1px solid #eceef8; background:#fbfbff; }
.jd-node .count b { font-size:12.5px; font-weight:750; color:#131632; font-variant-numeric:tabular-nums; }
.jd-node .count u { text-decoration:none; font-size:8.5px; letter-spacing:.08em; text-transform:uppercase; color:#9ba0c0; }
/* Students parked on this step right now — amber, because a number that keeps climbing here is
   the first sign of a journey stuck behind a wait. */
.jd-node .count s { text-decoration:none; font-size:9px; font-weight:700; color:#b07408; margin-top:2px; white-space:nowrap; }

.jd-blabel { position:absolute; transform:translate(-50%,-50%); background:#fff; border:1px solid #e3e6f3;
  border-radius:6px; padding:1px 7px; font-size:9.5px; font-weight:700; color:#767ca3; white-space:nowrap; }
.jd-blabel.t { color:#0d9488; border-color:#bfe6e0; }
.jd-blabel.f { color:#c74300; border-color:#f6d3bf; }

.jd-hud { position:absolute; right:14px; top:14px; display:flex; flex-direction:column; gap:6px; z-index:5; }
.jd-hud button { width:32px; height:30px; display:grid; place-items:center; background:#fff;
  border:1px solid #e2e8f0; color:#475467; cursor:pointer; transition:background .15s,color .15s; }
.jd-hud button:first-child { border-radius:9px 9px 0 0; }
.jd-hud button:last-child { border-radius:0 0 9px 9px; }
.jd-hud button:not(:first-child) { border-top:0; }
.jd-hud button:hover { background:#f4f4ff; color:#1e3a8a; }
.jd-hud .solo { border-radius:9px; border-top:1px solid #e2e8f0; }

.jd-legend { position:absolute; left:14px; bottom:14px; display:flex; gap:6px; flex-wrap:wrap; z-index:5; }
.jd-legend span { display:inline-flex; align-items:center; gap:6px; background:#fff; border:1px solid #e2e8f0;
  border-radius:20px; padding:4px 10px; font-size:11px; color:#475467; }
.jd-legend i { width:7px; height:7px; border-radius:2px; display:block; }

.jd-empty { position:absolute; inset:0; display:grid; place-items:center; color:#94a3b8; font-size:13px; }
`;

const I = {
  sent:      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4z" /></svg>,
  opened:    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>,
  clicked:   <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 11 3 9 2-5 5-2z" /><path d="M4 4l4 1M4 10h4M10 4l-1 4" /></svg>,
};

const nUS = v => Number(v || 0).toLocaleString('en-US');

/** The visible summary line under a node's title — enough to recognise the step, never its config. */
function subtitleFor(node) {
  const c = node.cfg || {};
  switch (node.key) {
    case 'act_wa': case 'act_email': return c.template || '';
    case 'act_push':      return c.title || '';
    case 'trg_activity': {
      if (c.type === 'Contact activity') {
        if (c.contactActivity === 'Contact is added to contact master') return 'Contact added';
        if (c.contactActivity === 'Contact is added to List') {
          return c.contactList === 'Specific List' ? `Added to ${c.contactListRef || '…'}` : 'Added to any list';
        }
        if (c.contactActivity === 'Contact is updated') {
          return c.contactAttrScope === 'Specific attribute'
            ? `${c.contactAttr || '…'} updated` : 'Contact updated';
        }
        return 'Contact activity';
      }
      return c.type && c.type !== 'App / web activity' ? `${c.type} · ${c.status || ''}` : (c.event || '');
    }
    case 'trg_segment':   return c.segment || '';
    case 'trg_list':      return c.list || '';
    case 'trg_business':  return c.event || '';
    case 'flw_wait':      return c.mode === 'A fixed period' ? `${c.amount || 1} ${c.unit || 'hours'}` : (c.time || c.dow || '');
    case 'flw_event':     return c.event || (c.status ? `${c.type || ''} · ${c.status}` : '');
    case 'cnd_split':     return (c.variants || []).map(v => `${v.pct}%`).join(' / ');
    case 'act_attr':      return c.attr ? `${c.attr} = ${c.value || '…'}` : '';
    case 'act_exit':      return c.reason || '';
    default: return '';
  }
}

export default function JourneyDiagram({ graph, stats = {}, waiting = {}, journeyEntered = null }) {
  const wrapRef = useRef(null);
  const [view, setView] = useState({ x: 40, y: 30, k: 1 });
  const [panning, setPanning] = useState(false);
  const drag = useRef(null);

  const { nodes, edges } = useMemo(() => {
    const ns = Object.values(graph?.nodes || {});
    const es = Object.values(graph?.edges || {});
    /*
     * Graphs saved before node positions were stored have every node at (0,0), which renders as
     * one illegible pile. Detected rather than assumed — a real journey can legitimately have a
     * node at the origin, but not all of them.
     */
    const positioned = ns.some(n => Number(n.x) || Number(n.y));
    const laid = positioned ? ns : ns.map((n, i) => ({ ...n, x: 60, y: 40 + i * (NODE_H + 60) }));
    return { nodes: laid, edges: es };
  }, [graph]);

  const byId = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);

  const bounds = useMemo(() => {
    if (!nodes.length) return { minX: 0, minY: 0, maxX: 800, maxY: 500 };
    const xs = nodes.map(n => Number(n.x) || 0);
    const ys = nodes.map(n => Number(n.y) || 0);
    return {
      minX: Math.min(...xs), minY: Math.min(...ys),
      maxX: Math.max(...xs) + NODE_W, maxY: Math.max(...ys) + NODE_H,
    };
  }, [nodes]);

  /** Scale and centre the whole graph inside the viewport. */
  const fit = useCallback(() => {
    const el = wrapRef.current;
    if (!el || !nodes.length) return;
    const pad = 46;
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    // Never zoom past 1: a three-node journey blown up to fill 600px looks broken, not helpful.
    const k = Math.min(1, (el.clientWidth - pad * 2) / Math.max(1, w), (el.clientHeight - pad * 2) / Math.max(1, h));
    setView({
      k,
      x: (el.clientWidth - w * k) / 2 - bounds.minX * k,
      y: (el.clientHeight - h * k) / 2 - bounds.minY * k,
    });
  }, [bounds, nodes.length]);

  useEffect(() => { fit(); }, [fit]);

  const onDown = e => {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
    setPanning(true);
  };
  useEffect(() => {
    if (!panning) return;
    const move = e => {
      const d = drag.current;
      if (!d) return;
      setView(v => ({ ...v, x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) }));
    };
    const up = () => { drag.current = null; setPanning(false); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [panning]);

  const zoom = dir => setView(v => ({ ...v, k: Math.min(1.6, Math.max(0.25, v.k * (dir > 0 ? 1.18 : 1 / 1.18))) }));

  /*
   * Orthogonal connectors: down out of the source, across, then down into the target — the same
   * routing the builder draws, so an edge lands where the author expects it to. A straight line
   * between centres would cross unrelated nodes on any journey with a branch.
   */
  const paths = useMemo(() => edges.map(e => {
    const a = byId[e.from], b = byId[e.to];
    if (!a || !b) return null;
    const x1 = (Number(a.x) || 0) + NODE_W / 2, y1 = (Number(a.y) || 0) + NODE_H;
    const x2 = (Number(b.x) || 0) + NODE_W / 2, y2 = (Number(b.y) || 0);
    const mid = y1 + Math.max(24, (y2 - y1) / 2);
    const d = Math.abs(x1 - x2) < 2
      ? `M${x1},${y1} L${x2},${y2}`
      : `M${x1},${y1} L${x1},${mid} L${x2},${mid} L${x2},${y2}`;
    const trueish = ['True', 'Yes', 'Happened', 'Sent', 'Done', 'Called', 'A'].includes(e.branch);
    const falseish = ['False', 'Timed out', 'Failed', 'Unreachable'].includes(e.branch);
    return { id: e.id, d, label: e.branch, lx: x1, ly: y1 + 16, cls: trueish ? 't' : falseish ? 'f' : '' };
  }).filter(Boolean), [edges, byId]);

  return (
    <div className={`jd-wrap${panning ? ' pan' : ''}`} ref={wrapRef} onMouseDown={onDown}>
      <style>{CSS}</style>

      {!nodes.length && <div className="jd-empty">This journey has no steps yet.</div>}

      <svg className="jd-edges" width="100%" height="100%"
           style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        <defs>
          <marker id="jd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 z" fill="#aab0cc" />
          </marker>
        </defs>
        {paths.map(p => (
          <path key={p.id} d={p.d} fill="none" stroke="#aab0cc" strokeWidth={1.7}
                strokeLinejoin="round" markerEnd="url(#jd-arrow)" />
        ))}
      </svg>

      <div className="jd-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        {paths.filter(p => p.label).map(p => (
          <div key={`l-${p.id}`} className={`jd-blabel ${p.cls}`} style={{ left: p.lx, top: p.ly }}>{p.label}</div>
        ))}

        {nodes.map(n => {
          const m = META[n.key] || { name: n.key, kind: 'Action' };
          const tone = TONE[m.kind] || TONE.Action;
          const st = stats[n.id] || {};
          const wait = waiting[n.id] || 0;
          const isMsg = m.kind === 'Message';
          const sub = subtitleFor(n);
          return (
            <div key={n.id} className="jd-node"
                 style={{ left: Number(n.x) || 0, top: Number(n.y) || 0, borderColor: tone.bg }}>
              <div className="side" style={{ background: tone.bg, color: tone.c }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: tone.c, display: 'block' }} />
              </div>
              <div className="body">
                <div className="kind">{m.kind}</div>
                <div className="ttl">{m.name}</div>
                {sub && <div className="sub" title={sub}>{sub}</div>}
                {isMsg && (
                  <div className="stats">
                    <i title="Sent">{I.sent}{nUS(st.sent)}</i>
                    <i title="Opened / read">{I.opened}{nUS(st.opened)}</i>
                    <i title="Clicked">{I.clicked}{nUS(st.clicked)}</i>
                  </div>
                )}
              </div>
              {/*
                A trigger has no journey_node_stats row of its own — nobody "reaches" the step
                that put them in the journey. Showing 0 there read as "the trigger matched
                nobody" even on a journey with people in it, which is the opposite of the truth,
                so a trigger shows the journey's own entry count and calls it Entered.
              */}
              <div className="count">
                <b>{m.kind === 'Trigger' && journeyEntered != null ? nUS(journeyEntered) : nUS(st.entered)}</b>
                <u>{m.kind === 'Trigger' ? 'entered' : 'reached'}</u>
                {wait > 0 && <s>{nUS(wait)} waiting</s>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="jd-hud">
        <button onClick={() => zoom(1)} title="Zoom in" aria-label="Zoom in">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <button onClick={() => zoom(-1)} title="Zoom out" aria-label="Zoom out">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M5 12h14" /></svg>
        </button>
        <button onClick={fit} title="Fit to screen" aria-label="Fit to screen">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V4h5M21 9V4h-5M3 15v5h5M21 15v5h-5" /></svg>
        </button>
      </div>

      <div className="jd-legend">
        {Object.entries(TONE).filter(([k]) => k !== 'Action').map(([k, t]) => (
          <span key={k}><i style={{ background: t.c }} />{k}</span>
        ))}
        <span style={{ color: '#94a3b8' }}>Drag to pan · read-only</span>
      </div>
    </div>
  );
}
