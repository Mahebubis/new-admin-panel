import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import SourceDrawer from './SourceDrawer';
import {
  API, CSS, STREAMS, STREAM, METRICS, METRIC, ZERO, sumMetrics, nf, compact, pctText, rate, inr,
  fmtBucket, fmtBucketLong, fmtDay, PRESETS, resolveRange, todayYmd, CountUp, ripple, Skel, Empty, Donut,
  ChannelIcon, KindIcon, Pagination, providerColor,
} from './maShared';

/*
 * Messaging analytics — every email and WhatsApp message sent, by campaign or journey, by provider,
 * by day or hour.
 *
 * One request (action=overview) answers the whole page, so switching the Channel or Source filter,
 * the trend metric, a table tab or a sort is instant: all of it is sliced client-side from data
 * already in hand. Failure reasons come from a second request fired in parallel so they never hold
 * the headline numbers back. Each range is cached for the session, so flipping back to a range you
 * already opened paints immediately and refreshes quietly underneath.
 */

const CHANNELS = [{ key: 'all', label: 'All channels' }, { key: 'email', label: 'Email', icon: 'email' }, { key: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp' }];
const SOURCES  = [{ key: 'all', label: 'Campaigns + Journeys' }, { key: 'campaign', label: 'Campaigns', icon: 'campaign' }, { key: 'journey', label: 'Journeys', icon: 'journey' }];
const TREND_METRICS = ['sent', 'delivered', 'opened', 'clicked', 'failed', 'skipped', 'conversions'];
const cache = new Map();

const Ic = {
  refresh: cls => <svg className={cls} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" /><path d="M21 3v5h-5" /></svg>,
  cal: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M8 3v3M16 3v3" /></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>,
  arrow: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  alert: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" /></svg>,
};

function TrendTip({ active, payload, label, gran, metric }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((a, p) => a + Number(p.value || 0), 0);
  return (
    <div className="ma-tip">
      <b>{fmtBucketLong(label, gran)} · {METRIC[metric].label}</b>
      {[...payload].reverse().map(p => (
        <div className="r" key={p.dataKey}><i style={{ background: p.color }} /><span>{STREAM[p.dataKey.split('.')[0]]?.label}</span>{nf(p.value)}</div>
      ))}
      {payload.length > 1 && <div className="r tot"><span>Total</span>{nf(total)}</div>}
    </div>
  );
}

function Funnel({ m, isWa, color }) {
  const steps = [
    ['Attempted', m.attempted], ['Sent', m.sent], ['Delivered', m.delivered],
    [isWa ? 'Read' : 'Opened', m.opened], ['Clicked', m.clicked], ['Conversions', m.conversions],
  ];
  const max = Math.max(1, m.attempted, m.sent);
  return (
    <div className="ma-funnel">
      {steps.map(([l, v], i) => (
        <div className="ma-funnel-row" key={l}>
          <span className="lb">{l}</span>
          <span className="bar"><span style={{ width: `${Math.max(v ? 1.5 : 0, (v / max) * 100)}%`, background: color, opacity: 1 - i * 0.11 }} /></span>
          <span className="v">{nf(v)}</span>
          <span className="p">{i === 0 ? '' : pctText(v, i <= 2 ? m.attempted : m.sent)}</span>
        </div>
      ))}
      <div className="ma-funnel-row" style={{ marginTop: 2 }}>
        <span className="lb" style={{ color: '#dc2626' }}>Rejected</span>
        <span className="bar"><span style={{ width: `${((m.failed + m.bounced) / max) * 100}%`, background: '#ef4444' }} /></span>
        <span className="v" style={{ color: m.failed + m.bounced ? '#dc2626' : undefined }}>{nf(m.failed + m.bounced)}</span>
        <span className="p">{pctText(m.failed + m.bounced, m.attempted)}</span>
      </div>
    </div>
  );
}

const SORTABLE = [
  ['name', 'l', 'Campaign / Journey'], ['attempted', '', 'Attempted'], ['sent', '', 'Sent'], ['delivered', '', 'Delivered'],
  ['opened', '', 'Opened / Read'], ['clicked', '', 'Clicked'], ['failed', '', 'Rejected'], ['skipped', '', 'Skipped'], ['conversions', '', 'Conversions'],
];

export default function MessagingAnalytics() {
  const [params, setParams] = useSearchParams();
  const preset  = PRESETS.some(p => p.key === params.get('range')) ? params.get('range') : 'today';
  const channel = CHANNELS.some(c => c.key === params.get('channel')) ? params.get('channel') : 'all';
  const srcKind = SOURCES.some(c => c.key === params.get('source')) ? params.get('source') : 'all';
  const range = useMemo(() => resolveRange(preset, params.get('from'), params.get('to')), [preset, params]);

  const setParam = useCallback(patch => setParams(p => {
    const n = new URLSearchParams(p);
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === '') n.delete(k); else n.set(k, v); }
    return n;
  }, { replace: true }), [setParams]);

  const [data, setData] = useState(() => cache.get(`${range.from}|${range.to}`)?.data || null);
  const [failures, setFailures] = useState(() => cache.get(`${range.from}|${range.to}`)?.failures || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [metric, setMetric] = useState('sent');
  const [kpiFocus, setKpiFocus] = useState(null);
  const [tableTab, setTableTab] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'sent', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [drawer, setDrawer] = useState(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState({ from: range.from, to: range.to });
  const reqId = useRef(0);
  const popRef = useRef(null);

  const load = useCallback(async ({ force = false } = {}) => {
    const key = `${range.from}|${range.to}`;
    const hit = cache.get(key);
    if (hit && !force) { setData(hit.data); setFailures(hit.failures); }
    else if (!hit) { setData(null); setFailures(null); }
    const my = ++reqId.current;
    setBusy(true); setError(null);
    const p = { from: range.from, to: range.to, _t: Date.now() };
    const ov = api.get(API, { params: { ...p, action: 'overview' } });
    const fl = api.get(API, { params: { ...p, action: 'failures' } });
    fl.catch(() => {}); // a superseded range returns early below, before the .then is attached
    try {
      const r = await ov;
      if (my !== reqId.current) return;
      if (!r.data?.success) throw new Error(r.data?.message || 'Could not load analytics');
      setData(r.data.data);
      cache.set(key, { ...(cache.get(key) || {}), data: r.data.data });
      if (force) toast.success(`Refreshed in ${r.data.data.took_ms} ms`, { id: 'ma-refresh' });
    } catch (e) {
      if (my === reqId.current) { setError(e?.response?.data?.message || e.message || 'Could not load analytics'); }
    } finally { if (my === reqId.current) setBusy(false); }
    fl.then(r => {
      if (my !== reqId.current || !r.data?.success) return;
      setFailures(r.data.data.reasons);
      cache.set(key, { ...(cache.get(key) || {}), failures: r.data.data.reasons });
    }).catch(() => {});
  }, [range.from, range.to]);

  useEffect(() => { load(); setPage(1); }, [load]);

  // Today's numbers move while you watch: refresh quietly every 60s while the tab is visible.
  useEffect(() => {
    if (range.to !== todayYmd()) return undefined;
    const t = setInterval(() => { if (!document.hidden) load(); }, 60000);
    return () => clearInterval(t);
  }, [range.to, load]);

  useEffect(() => {
    if (!customOpen) return undefined;
    const h = e => { if (popRef.current && !popRef.current.contains(e.target)) setCustomOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [customOpen]);

  /* ── Slice by the Channel / Source filters ─────────────────────────── */
  const activeStreams = useMemo(() => STREAMS.filter(s =>
    (channel === 'all' || s.channel === channel) && (srcKind === 'all' || s.kind === srcKind)), [channel, srcKind]);
  const S = useMemo(() => data?.streams || {}, [data]);
  const totals = useMemo(() => sumMetrics(activeStreams.map(s => S[s.key] || ZERO)), [activeStreams, S]);
  const emailT = useMemo(() => sumMetrics(activeStreams.filter(s => s.channel === 'email').map(s => S[s.key] || ZERO)), [activeStreams, S]);
  const waT    = useMemo(() => sumMetrics(activeStreams.filter(s => s.channel === 'whatsapp').map(s => S[s.key] || ZERO)), [activeStreams, S]);
  const gran = data?.range?.granularity || (range.from === range.to ? 'hour' : 'day');

  const series = useMemo(() => (data?.series || []).map(row => {
    const o = { bucket: row.bucket };
    for (const s of activeStreams) o[s.key] = row[s.key]?.[metric] || 0;
    return o;
  }), [data, activeStreams, metric]);

  const providers = useMemo(() => {
    const keep = new Set(activeStreams.map(s => s.key));
    const merged = {};
    for (const p of data?.providers || []) {
      if (!keep.has(p.stream)) continue;
      const k = `${p.channel}|${p.provider}`;
      if (!merged[k]) merged[k] = { ...ZERO, channel: p.channel, provider: p.provider, label: p.label, streams: {} };
      for (const m of Object.keys(ZERO)) merged[k][m] += Number(p[m] || 0);
      merged[k].streams[p.stream] = p;
    }
    return Object.values(merged).sort((a, b) => b.attempted - a.attempted);
  }, [data, activeStreams]);

  const sources = useMemo(() => {
    const keep = new Set(activeStreams.map(s => s.key));
    const q = search.trim().toLowerCase();
    let rows = (data?.sources || []).filter(r => keep.has(r.stream) && (tableTab === 'all' || r.stream === tableTab)
      && (!q || r.name.toLowerCase().includes(q) || String(r.id) === q));
    const dir = sort.dir === 'asc' ? 1 : -1;
    const val = r => (sort.key === 'failed' ? r.failed + r.bounced : r[sort.key]);
    rows = [...rows].sort((a, b) => (sort.key === 'name' ? a.name.localeCompare(b.name) * dir : ((val(a) - val(b)) * dir) || (b.attempted - a.attempted)));
    return rows;
  }, [data, activeStreams, tableTab, search, sort]);
  const pages = Math.max(1, Math.ceil(sources.length / perPage));
  const pageRows = sources.slice((Math.min(page, pages) - 1) * perPage, Math.min(page, pages) * perPage);
  useEffect(() => { setPage(1); }, [channel, srcKind, tableTab, search, sort, perPage]);

  const tabCounts = useMemo(() => {
    const keep = new Set(activeStreams.map(s => s.key));
    const c = { all: 0 };
    for (const r of data?.sources || []) if (keep.has(r.stream)) { c.all++; c[r.stream] = (c[r.stream] || 0) + 1; }
    return c;
  }, [data, activeStreams]);

  const reasons = useMemo(() => {
    const keep = new Set(activeStreams.map(s => s.key));
    return (failures || []).filter(r => keep.has(r.stream));
  }, [failures, activeStreams]);
  const reasonMax = reasons.reduce((a, r) => Math.max(a, r.c), 1);

  const hasAny = totals.attempted > 0 || totals.conversions > 0;
  const loadingFirst = !data && busy;

  const pickPreset = k => {
    if (k === 'custom') { setDraft({ from: range.from, to: range.to }); setCustomOpen(o => !o); return; }
    setCustomOpen(false);
    setParam({ range: k === 'today' ? null : k, from: null, to: null });
  };
  const applyCustom = () => {
    if (!draft.from || !draft.to) { toast.error('Pick both dates'); return; }
    setParam({ range: 'custom', from: draft.from, to: draft.to });
    setCustomOpen(false);
  };
  const toggleSort = key => setSort(s => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));

  const openSource = r => setDrawer(r);

  const kpis = [
    { key: 'sent', label: 'Sent', value: totals.sent, sub: <><b>{pctText(totals.sent, totals.attempted)}</b> of {nf(totals.attempted)} attempted</>, e: emailT.sent, w: waT.sent },
    { key: 'delivered', label: 'Delivered', value: totals.delivered, sub: <><b>{pctText(totals.delivered, totals.sent)}</b> delivery rate</>, e: emailT.delivered, w: waT.delivered },
    { key: 'opened', label: 'Opened / Read', value: totals.opened, sub: <><b>{pctText(totals.opened, totals.sent)}</b> of sent</>, e: emailT.opened, w: waT.opened },
    { key: 'clicked', label: 'Clicked', value: totals.clicked, sub: <><b>{pctText(totals.clicked, totals.sent)}</b> CTR · <b>{pctText(totals.clicked, totals.opened)}</b> of opens</>, e: emailT.clicked, w: waT.clicked },
    { key: 'failed', label: 'Rejected', value: totals.failed + totals.bounced, sub: <><b>{pctText(totals.failed + totals.bounced, totals.attempted)}</b> · {nf(totals.failed)} failed · {nf(totals.bounced)} bounced</>, e: emailT.failed + emailT.bounced, w: waT.failed + waT.bounced },
    { key: 'skipped', label: 'Skipped', value: totals.skipped, sub: <>Suppressed, dedup or opt-out</>, e: emailT.skipped, w: waT.skipped },
    { key: 'conversions', label: 'Conversions', value: totals.conversions, sub: totals.revenue ? <><b>{inr(totals.revenue)}</b> journey revenue</> : <><b>{pctText(totals.conversions, totals.sent)}</b> of sent</>, e: emailT.conversions, w: waT.conversions },
  ];

  const rangeText = range.from === range.to ? fmtDay(range.from) : `${fmtDay(range.from)} – ${fmtDay(range.to)}`;

  return (
    <div className="ma">
      <style>{CSS}</style>
      <div className="ma-progress" data-on={busy ? '1' : undefined} />

      <div className="ma-head">
        <div>
          <h1>Messaging analytics</h1>
          <p>Every email and WhatsApp message — by campaign, journey, provider and {gran === 'hour' ? 'hour' : 'day'}.</p>
        </div>
        <div className="ma-head-r">
          {data && <span className="ma-updated">Updated {data.generated_at.slice(11, 16)} · {data.took_ms} ms</span>}
          <button className="ma-btn ma-rip" onPointerDown={ripple} onClick={() => load({ force: true })} disabled={busy}>
            {Ic.refresh(busy ? 'spin' : '')} Refresh
          </button>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <div className="ma-toolbar">
        <div className="ma-pop-wrap" ref={popRef}>
          <div className="ma-seg" role="tablist" aria-label="Date range">
            {PRESETS.map(p => (
              <button key={p.key} role="tab" onPointerDown={ripple} data-on={preset === p.key ? '1' : undefined} onClick={() => pickPreset(p.key)}>
                {p.key === 'custom' && <span className="ic">{Ic.cal}</span>}{p.label}
              </button>
            ))}
          </div>
          {customOpen && (
            <div className="ma-pop" role="dialog" aria-label="Custom date range">
              <h4>Custom range</h4>
              <label>From<input type="date" value={draft.from} max={todayYmd()} onChange={e => setDraft(d => ({ ...d, from: e.target.value }))} /></label>
              <label>To<input type="date" value={draft.to} max={todayYmd()} min={draft.from} onChange={e => setDraft(d => ({ ...d, to: e.target.value }))} /></label>
              <div className="row">
                <button className="ma-btn ma-rip" onPointerDown={ripple} onClick={() => setCustomOpen(false)}>Cancel</button>
                <button className="ma-btn primary ma-rip" onPointerDown={ripple} onClick={applyCustom}>Apply</button>
              </div>
            </div>
          )}
        </div>
        <span className="ma-divider" />
        <div className="ma-seg" aria-label="Channel">
          {CHANNELS.map(c => (
            <button key={c.key} onPointerDown={ripple} data-on={channel === c.key ? '1' : undefined} onClick={() => setParam({ channel: c.key === 'all' ? null : c.key })}>
              {c.icon && <span className="ic" style={{ color: c.key === 'whatsapp' ? '#059669' : '#4f46e5' }}><ChannelIcon channel={c.icon} size={13} /></span>}{c.label}
            </button>
          ))}
        </div>
        <div className="ma-seg" aria-label="Source">
          {SOURCES.map(c => (
            <button key={c.key} onPointerDown={ripple} data-on={srcKind === c.key ? '1' : undefined} onClick={() => { setParam({ source: c.key === 'all' ? null : c.key }); setTableTab('all'); }}>
              {c.icon && <span className="ic"><KindIcon kind={c.icon} /></span>}{c.label}
            </button>
          ))}
        </div>
        <span className="ma-rangechip">{Ic.cal} <b>{rangeText}</b> · {gran === 'hour' ? 'hourly' : 'daily'}</span>
      </div>

      {error && (
        <div className="ma-card" style={{ padding: 16, marginBottom: 16, borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c', display: 'flex', gap: 10, alignItems: 'center' }}>
          {Ic.alert}<span style={{ flex: 1 }}>{error}</span>
          <button className="ma-btn ma-rip" onPointerDown={ripple} onClick={() => load({ force: true })}>Try again</button>
        </div>
      )}

      {/* ── KPI tiles ───────────────────────────────────────────── */}
      <div className="ma-kpis">
        {kpis.map((k, i) => {
          const c = METRIC[k.key].color;
          const tot = k.e + k.w;
          return (
            <button key={k.key} className="ma-card ma-kpi ma-rip ma-fade" onPointerDown={ripple} style={{ '--c': c, animationDelay: `${i * 35}ms` }}
                    data-on={kpiFocus === k.key ? '1' : undefined}
                    onClick={() => { const next = kpiFocus === k.key ? null : k.key; setKpiFocus(next); if (TREND_METRICS.includes(k.key)) setMetric(next ? k.key : 'sent'); }}
                    title="Show this metric in the trend chart">
              <span className="t"><i />{k.label}</span>
              <span className="n">{loadingFirst ? <Skel w={90} h={26} /> : <CountUp value={k.value} />}</span>
              <span className="r">{loadingFirst ? <Skel w={120} h={10} /> : k.sub}</span>
              {channel === 'all' && (
                <>
                  <span className="split">
                    <span style={{ width: `${rate(k.e, tot)}%`, background: '#4f46e5' }} />
                    <span style={{ width: `${rate(k.w, tot)}%`, background: '#059669' }} />
                  </span>
                  <span className="split-l">
                    <em><ChannelIcon channel="email" size={11} />{compact(k.e)}</em>
                    <em>{compact(k.w)}<ChannelIcon channel="whatsapp" size={11} /></em>
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {data && !hasAny && !busy && <div className="ma-card" style={{ marginBottom: 16 }}><Empty sub={`Nothing was sent ${preset === 'today' ? 'today yet' : 'in this range'}${channel !== 'all' || srcKind !== 'all' ? ' for these filters' : ''}. Try a wider date range.`} /></div>}

      {/* ── Trend + share of sends ──────────────────────────────── */}
      <div className="ma-grid ma-g-trend">
        <div className="ma-card">
          <div className="ma-card-h">
            <div><h3>{METRIC[metric].label} over time</h3><small>{gran === 'hour' ? 'Per hour' : 'Per day'}, stacked by channel and source</small></div>
            <div className="ma-chips">
              {TREND_METRICS.map(k => (
                <button key={k} className="ma-chip ma-rip" onPointerDown={ripple} style={{ '--c': METRIC[k].color }} data-on={metric === k ? '1' : undefined} onClick={() => setMetric(k)}>
                  <i />{k === 'opened' ? 'Opened/Read' : METRIC[k].label}
                </button>
              ))}
            </div>
          </div>
          <div className="ma-card-b" style={{ height: 300 }}>
            {loadingFirst ? <Skel h={260} r={12} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>{STREAMS.map(s => (
                    <linearGradient key={s.key} id={`mag-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={0.55} /><stop offset="100%" stopColor={s.color} stopOpacity={0.06} />
                    </linearGradient>))}
                  </defs>
                  <CartesianGrid stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="bucket" tickFormatter={b => fmtBucket(b, gran)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={16} />
                  <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={46} />
                  <Tooltip content={<TrendTip gran={gran} metric={metric} />} cursor={{ stroke: '#c7d2fe', strokeWidth: 1.5 }} />
                  {activeStreams.map(s => (
                    <Area key={s.key} type="monotone" dataKey={s.key} stackId="1" stroke={s.color} strokeWidth={2} fill={`url(#mag-${s.key})`} animationDuration={650} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '0 18px 16px', fontSize: 12, color: '#64748b' }}>
            {activeStreams.map(s => (
              <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <i style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />{s.label}
                <b style={{ color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{nf(S[s.key]?.[metric] || 0)}</b>
              </span>
            ))}
          </div>
        </div>
        <div className="ma-card">
          <div className="ma-card-h"><div><h3>Where sends came from</h3><small>Sent messages by channel and source</small></div></div>
          <div className="ma-card-b">
            {loadingFirst ? <Skel h={300} r={12} /> : (
              <Donut centerLabel="Sent" data={activeStreams.map(s => ({ label: s.label, value: S[s.key]?.sent || 0, color: s.color }))} emptyText="Nothing sent in this range" />
            )}
          </div>
        </div>
      </div>

      {/* ── Outcome + providers ─────────────────────────────────── */}
      <div className="ma-grid ma-g-3">
        <div className="ma-card">
          <div className="ma-card-h"><div><h3>Outcome of every attempt</h3><small>The furthest each message got</small></div></div>
          <div className="ma-card-b">
            {loadingFirst ? <Skel h={300} r={12} /> : (
              <Donut centerLabel="Attempted" emptyText="No attempts in this range" data={[
                { label: 'Opened / Read', value: Math.min(totals.opened, totals.sent), color: METRIC.opened.color },
                { label: 'Delivered, not opened', value: Math.max(0, totals.delivered - totals.opened), color: METRIC.delivered.color },
                { label: 'Sent, no receipt yet', value: Math.max(0, totals.sent - Math.max(totals.delivered, totals.opened)), color: METRIC.sent.color },
                { label: 'Failed', value: totals.failed, color: METRIC.failed.color },
                { label: 'Bounced', value: totals.bounced, color: METRIC.bounced.color },
                { label: 'Skipped', value: totals.skipped, color: METRIC.skipped.color },
              ]} />
            )}
          </div>
        </div>
        {['email', 'whatsapp'].map(ch => (
          <div className="ma-card" key={ch} style={{ opacity: channel !== 'all' && channel !== ch ? 0.45 : 1, transition: 'opacity .25s' }}>
            <div className="ma-card-h">
              <div><h3>{ch === 'email' ? 'Email' : 'WhatsApp'} by provider</h3><small>Attempted messages per sending provider</small></div>
              <span style={{ color: ch === 'email' ? '#4f46e5' : '#059669' }}><ChannelIcon channel={ch} size={18} /></span>
            </div>
            <div className="ma-card-b">
              {loadingFirst ? <Skel h={300} r={12} /> : (
                <Donut centerLabel="Attempted" emptyText={`No ${ch === 'email' ? 'email' : 'WhatsApp'} in this range`}
                       data={providers.filter(p => p.channel === ch).map(p => ({ label: p.label, value: p.attempted, color: providerColor(p.provider) }))} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Funnels per stream ──────────────────────────────────── */}
      <div className="ma-grid ma-g-4">
        {activeStreams.map((s, i) => {
          const m = S[s.key] || ZERO;
          return (
            <div className="ma-card ma-fade" key={s.key} style={{ animationDelay: `${i * 50}ms` }}>
              <div className="ma-card-h">
                <div className="ma-stream-h">
                  <span className="ma-stream-ic" style={{ background: `${s.color}26`, color: s.channel === 'whatsapp' ? '#047857' : '#4338ca' }}><ChannelIcon channel={s.channel} size={16} /></span>
                  <div><h3>{s.label}</h3><small>{loadingFirst ? '…' : `${nf(tabCounts[s.key] || 0)} ${s.kind === 'journey' ? 'journeys' : 'campaigns'} active in range`}</small></div>
                </div>
                <button className="ma-btn ma-rip" onPointerDown={ripple} style={{ height: 30, padding: '0 10px', fontSize: 12 }}
                        onClick={() => { setTableTab(s.key); document.getElementById('ma-sources')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                  View {Ic.arrow}
                </button>
              </div>
              <div className="ma-card-b">{loadingFirst ? <Skel h={170} r={10} /> : <Funnel m={m} isWa={s.channel === 'whatsapp'} color={s.channel === 'whatsapp' ? '#059669' : '#4f46e5'} />}</div>
            </div>
          );
        })}
      </div>

      {/* ── Provider table ─────────────────────────────────────── */}
      <div className="ma-grid ma-g-trend">
        <div className="ma-card" style={{ overflow: 'hidden' }}>
          <div className="ma-card-h"><div><h3>Provider performance</h3><small>Each provider split by campaigns and journeys</small></div></div>
          <div className="ma-tablewrap" style={{ marginTop: 12 }}>
            <table className="ma-table">
              <thead><tr><th className="l">Provider</th><th>Attempted</th><th>Sent</th><th>Delivered</th><th>Opened / Read</th><th>Clicked</th><th>Rejected</th><th>Skipped</th><th>Conv.</th></tr></thead>
              <tbody>
                {loadingFirst && Array.from({ length: 3 }).map((_, i) => <tr key={i}>{Array.from({ length: 9 }).map((__, j) => <td key={j} className={j ? '' : 'l'}><Skel w={j ? 50 : 130} /></td>)}</tr>)}
                {!loadingFirst && !providers.length && <tr><td colSpan={9}><Empty title="No provider activity" /></td></tr>}
                {providers.flatMap(p => {
                  const parts = Object.values(p.streams);
                  const row = (m, key, label, sub) => (
                    <tr key={key} style={sub ? { background: '#fcfdff' } : undefined}>
                      <td className="l" style={sub ? { paddingLeft: 34, fontSize: 12, color: '#64748b' } : undefined}>
                        {sub ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><KindIcon kind={STREAM[m.stream].kind} size={12} />{label}</span> : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                            <i style={{ width: 10, height: 10, borderRadius: 3, background: providerColor(p.provider) }} />
                            <b style={{ color: '#0f172a', fontWeight: 700 }}>{label}</b>
                            <span style={{ color: p.channel === 'whatsapp' ? '#059669' : '#4f46e5', display: 'inline-flex' }}><ChannelIcon channel={p.channel} size={12} /></span>
                          </span>
                        )}
                      </td>
                      <td>{nf(m.attempted)}</td>
                      <td>{nf(m.sent)}</td>
                      <td className={m.delivered ? '' : 'zero'}>{nf(m.delivered)}<span className="sub">{pctText(m.delivered, m.sent)}</span></td>
                      <td className={m.opened ? '' : 'zero'}>{nf(m.opened)}<span className="sub">{pctText(m.opened, m.sent)}</span></td>
                      <td className={m.clicked ? '' : 'zero'}>{nf(m.clicked)}<span className="sub">{pctText(m.clicked, m.sent)}</span></td>
                      <td className={m.failed + m.bounced ? 'bad' : 'zero'}>{nf(m.failed + m.bounced)}<span className="sub">{pctText(m.failed + m.bounced, m.attempted)}</span></td>
                      <td className={m.skipped ? '' : 'zero'}>{nf(m.skipped)}</td>
                      <td className={m.conversions ? '' : 'zero'}>{nf(m.conversions)}</td>
                    </tr>
                  );
                  return [row(p, p.channel + p.provider, p.label, false), ...(parts.length > 1 ? parts.map(x => row(x, `${p.channel}${p.provider}${x.stream}`, STREAM[x.stream].label, true)) : [])];
                })}
              </tbody>
            </table>
          </div>
          {providers.some(p => p.provider === 'ses' && p.sent > 20 && !p.delivered) && (
            <div className="ma-note" style={{ margin: '0 18px 16px' }}>Amazon SES shows 0 delivered: SES only sends delivery receipts when a configuration set with an event destination is attached. Opens and clicks are tracked by us and still count.</div>
          )}
        </div>
        <div className="ma-card" style={{ overflow: 'hidden' }}>
          <div className="ma-card-h"><div><h3>WhatsApp sender numbers</h3><small>Campaign sends per business number</small></div></div>
          <div className="ma-card-b">
            {loadingFirst ? <Skel h={200} r={10} /> : !(data?.senders || []).length ? <Empty title="No WhatsApp campaign sends" sub="Journey sends are shown per step in each journey." /> : (
              <div style={{ height: Math.max(160, data.senders.length * 58) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.senders.map(s => ({ name: s.number, sub: s.label, delivered: s.delivered, notDelivered: Math.max(0, s.sent - s.delivered), failed: s.failed }))} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }} barSize={16}>
                    <CartesianGrid stroke="#eef2f7" horizontal={false} />
                    <XAxis type="number" tickFormatter={compact} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={112} tick={{ fontSize: 11.5, fill: '#334155' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} content={({ active, payload, label }) => active && payload?.length ? (
                      <div className="ma-tip"><b>{label} · {payload[0].payload.sub}</b>
                        {payload.map(p => <div className="r" key={p.dataKey}><i style={{ background: p.color }} /><span>{{ delivered: 'Delivered', notDelivered: 'Sent, no receipt', failed: 'Failed' }[p.dataKey]}</span>{nf(p.value)}</div>)}
                      </div>) : null} />
                    <Bar dataKey="delivered" stackId="a" fill="#0ea5e9" radius={[4, 0, 0, 4]} animationDuration={650} />
                    <Bar dataKey="notDelivered" stackId="a" fill="#a5b4fc" animationDuration={650} />
                    <Bar dataKey="failed" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} animationDuration={650} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Campaigns & journeys ───────────────────────────────── */}
      <div className="ma-card" id="ma-sources" style={{ overflow: 'hidden', marginBottom: 16, scrollMarginTop: 80 }}>
        <div className="ma-card-h" style={{ paddingBottom: 12 }}>
          <div><h3>Campaigns &amp; journeys</h3><small>Click any row for its trend, steps and the people behind every number</small></div>
          <div className="ma-search">{Ic.search}<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or ID" /></div>
        </div>
        <div style={{ padding: '0 18px 12px' }} className="ma-chips">
          {[{ key: 'all', label: 'All', color: '#1e3a8a' }, ...activeStreams].map(s => (
            <button key={s.key} className="ma-chip ma-rip" onPointerDown={ripple} style={{ '--c': s.color }} data-on={tableTab === s.key ? '1' : undefined} onClick={() => setTableTab(s.key)}>
              {s.key !== 'all' && <i />}{s.label}<span className="cnt">{nf(tabCounts[s.key] || 0)}</span>
            </button>
          ))}
        </div>
        <div className="ma-tablewrap" style={{ borderTop: '1px solid #eef2f7' }}>
          <table className="ma-table">
            <thead>
              <tr>
                {SORTABLE.map(([k, cls, l]) => (
                  <th key={k} className={cls} data-sort data-active={sort.key === k ? '1' : undefined} onClick={() => toggleSort(k)} aria-sort={sort.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {l}<span className="arr" style={{ transform: sort.key === k && sort.dir === 'asc' ? 'rotate(180deg)' : undefined }}>▾</span>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {loadingFirst && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 10 }).map((__, j) => <td key={j} className={j ? '' : 'l'}>{j ? <Skel w={46} /> : <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Skel w={30} h={30} r={9} /><span><Skel w={180} /><br /><Skel w={90} h={9} /></span></span>}</td>)}</tr>
              ))}
              {!loadingFirst && !pageRows.length && <tr><td colSpan={10}><Empty title={search ? 'No match' : 'Nothing sent in this range'} sub={search ? 'Try another name or ID.' : 'Pick a wider date range.'} /></td></tr>}
              {pageRows.map(r => {
                const st = STREAM[r.stream];
                const isWa = r.channel === 'whatsapp';
                const rej = r.failed + r.bounced;
                const rateCell = (v, base, color) => (
                  <span className="rate">
                    <span>{nf(v)} <span style={{ color: '#94a3b8', fontSize: 11 }}>{pctText(v, base)}</span></span>
                    <span className="mini"><span style={{ width: `${Math.min(100, rate(v, base))}%`, background: color }} /></span>
                  </span>
                );
                return (
                  <tr key={r.key} data-click tabIndex={0} onClick={() => openSource(r)} onKeyDown={e => { if (e.key === 'Enter') openSource(r); }}>
                    <td className="l">
                      <div className="ma-name">
                        <span className="ic" style={{ background: `${st.color}26`, color: isWa ? '#047857' : '#4338ca' }}><ChannelIcon channel={r.channel} /></span>
                        <div style={{ minWidth: 0 }}>
                          <b title={r.name}>{r.name}</b>
                          <div className="meta">
                            <span className="ma-tag" style={{ background: r.kind === 'journey' ? '#f5f3ff' : '#f0f9ff', color: r.kind === 'journey' ? '#6d28d9' : '#0369a1' }}><KindIcon kind={r.kind} size={10} />{r.kind}</span>
                            <span>ID {r.id}</span>
                            {r.providers.length > 0 && <span title={r.providers.join(', ')}>· {r.providers.filter(p => !p.startsWith('Not sent')).join(', ') || '—'}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={r.attempted ? '' : 'zero'}>{nf(r.attempted)}</td>
                    <td>{rateCell(r.sent, r.attempted, '#6366f1')}</td>
                    <td>{rateCell(r.delivered, r.sent, '#0ea5e9')}</td>
                    <td>{rateCell(r.opened, r.sent, '#8b5cf6')}</td>
                    <td>{rateCell(r.clicked, r.sent, '#f59e0b')}</td>
                    <td className={rej ? 'bad' : 'zero'}>{nf(rej)}{rej > 0 && <span className="sub">{pctText(rej, r.attempted)}</span>}</td>
                    <td className={r.skipped ? '' : 'zero'}>{nf(r.skipped)}</td>
                    <td className={r.conversions ? '' : 'zero'} style={r.conversions ? { color: '#047857', fontWeight: 700 } : undefined}>{nf(r.conversions)}{r.revenue > 0 && <span className="sub">{inr(r.revenue)}</span>}</td>
                    <td style={{ width: 28 }}><span className="ma-go">{Ic.arrow}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={Math.min(page, pages)} pages={pages} total={sources.length} perPage={perPage} onPage={setPage} onPerPage={setPerPage} sizes={[10, 25, 50]} />
      </div>

      {/* ── Failure reasons ─────────────────────────────────────── */}
      <div className="ma-card">
        <div className="ma-card-h"><div><h3>Why messages were rejected or skipped</h3><small>Top reasons in this range, by provider</small></div></div>
        <div className="ma-card-b">
          {!failures ? Array.from({ length: 4 }).map((_, i) => <Skel key={i} h={40} r={8} style={{ display: 'block', marginBottom: 10 }} />)
            : !reasons.length ? <Empty title="No rejections" sub="Every attempt in this range went out." />
            : (
              <div className="ma-reasons">
                {reasons.slice(0, 15).map((r, i) => {
                  const st = STREAM[r.stream];
                  return (
                    <div className="ma-reason ma-fade" key={i} style={{ animationDelay: `${i * 25}ms` }}>
                      <span className="txt">{r.reason}</span>
                      <span className="c" style={{ color: r.skipped ? '#475569' : '#dc2626' }}>{nf(r.c)}</span>
                      <div className="meta">
                        <span className="ma-tag" style={{ background: `${st.color}26`, color: r.channel === 'whatsapp' ? '#047857' : '#4338ca' }}><ChannelIcon channel={r.channel} size={10} />{st.short}</span>
                        <span className="ma-tag" style={{ background: '#f1f5f9', color: '#475569' }}>{r.provider_label}</span>
                        <span className="bar"><span style={{ width: `${(r.c / reasonMax) * 100}%`, background: r.skipped ? '#94a3b8' : '#ef4444' }} /></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>

      {drawer && <SourceDrawer source={drawer} range={range} onClose={() => setDrawer(null)} />}
    </div>
  );
}
