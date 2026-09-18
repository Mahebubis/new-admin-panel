import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import SourceDrawer from './SourceDrawer';
import StatDrawer from './StatDrawer';
import {
  API, CSS, STREAMS, STREAM, METRIC, ZERO, sumMetrics, nf, compact, pctText, rate, inr,
  fmtBucket, fmtBucketLong, PRESETS, resolveRange, rangeParams, rangeKey, rangeLabel, DAY_START, DAY_END, todayYmd, CountUp, ripple, Skel, Empty, Donut,
  ChannelIcon, KindIcon, Pagination, providerColor, PROVIDERS, PROVIDER, providerParam, Popover,
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
const SOURCES  = [{ key: 'all', label: 'Campaigns + Journeys' }, { key: 'campaign', label: 'Campaigns', icon: 'campaign' }, { key: 'journey', label: 'Journeys', icon: 'journey' }, { key: 'support', label: 'Freshdesk (SMTP)', icon: 'support' }, { key: 'transactional', label: 'Refund & project emails', icon: 'transactional' }];
const KIND_TAG = { campaign: ['#f0f9ff', '#0369a1', 'campaign'], journey: ['#f5f3ff', '#6d28d9', 'journey'], support: ['#ecfeff', '#0e7490', 'freshdesk'], transactional: ['#f0fdfa', '#0f766e', 'refund / project'] };
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

function Funnel({ m, isWa, color, untracked }) {
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
          {untracked && ['Delivered', 'Opened', 'Clicked', 'Conversions'].includes(l)
            ? <span className="ma-nt" style={{ gridColumn: 'span 2', textAlign: 'right' }}>not tracked</span>
            : <>
              <span className="v">{nf(v)}</span>
              <span className="p">{i === 0 ? '' : pctText(v, i <= 2 ? m.attempted : m.sent)}</span>
            </>}
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
  const pFrom = params.get('from'); const pTo = params.get('to'); const pFt = params.get('ft'); const pTt = params.get('tt');
  const range = useMemo(() => resolveRange(preset, pFrom, pTo, pFt, pTt), [preset, pFrom, pTo, pFt, pTt]);
  const provParam = params.get('prov') || '';
  const provs = useMemo(() => provParam.split(',').filter(k => PROVIDER[k]), [provParam]);
  // Everything the overview request depends on — the cache and the refetch are keyed on it.
  const fKey = `${rangeKey(range)}|${provs.join(',')}`;

  const setParam = useCallback(patch => setParams(p => {
    const n = new URLSearchParams(p);
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === '') n.delete(k); else n.set(k, v); }
    return n;
  }, { replace: true }), [setParams]);

  const [data, setData] = useState(() => cache.get(fKey)?.data || null);
  const [failures, setFailures] = useState(() => cache.get(fKey)?.failures || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [metric, setMetric] = useState('sent');
  const [tableTab, setTableTab] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'sent', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [drawer, setDrawer] = useState(null);
  const [statDrawer, setStatDrawer] = useState(null);
  const [menu, setMenu] = useState(null);          // { id, el } — the open filter menu and its trigger
  const [provHover, setProvHover] = useState(null);  // hover card for a provider chip
  const [draft, setDraft] = useState(null);
  const [compactHead, setCompactHead] = useState(false);
  const reqId = useRef(0);
  const sentinel = useRef(null);

  /* The header collapses once the page has scrolled past its resting position. The sentinel sits
     just above the sticky block; when it leaves the viewport the block is stuck, so compact it. */
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setCompactHead(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const load = useCallback(async ({ force = false } = {}) => {
    const key = fKey;
    const hit = cache.get(key);
    if (hit && !force) { setData(hit.data); setFailures(hit.failures); }
    else if (!hit) { setData(null); setFailures(null); }
    const my = ++reqId.current;
    setBusy(true); setError(null);
    const p = { ...rangeParams(range), ...providerParam(provs), _t: Date.now() };
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
  }, [fKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); setPage(1); }, [load]);

  // Today's numbers move while you watch: refresh quietly every 60s while the tab is visible.
  useEffect(() => {
    if (range.to !== todayYmd()) return undefined;
    const t = setInterval(() => { if (!document.hidden) load(); }, 60000);
    return () => clearInterval(t);
  }, [range.to, load]);

  /* ── Slice by the Channel / Source filters ─────────────────────────── */
  const activeStreams = useMemo(() => STREAMS.filter(s =>
    (channel === 'all' || s.channel === channel) && (srcKind === 'all' || s.kind === srcKind)), [channel, srcKind]);
  const S = useMemo(() => data?.streams || {}, [data]);
  const totals = useMemo(() => sumMetrics(activeStreams.map(s => S[s.key] || ZERO)), [activeStreams, S]);
  const emailT = useMemo(() => sumMetrics(activeStreams.filter(s => s.channel === 'email').map(s => S[s.key] || ZERO)), [activeStreams, S]);
  const waT    = useMemo(() => sumMetrics(activeStreams.filter(s => s.channel === 'whatsapp').map(s => S[s.key] || ZERO)), [activeStreams, S]);
  const gran = data?.range?.granularity || (range.from === range.to ? 'hour' : 'day');
  const granWord = { minute: 'minute', hour: 'hour', day: 'day', month: 'month' }[gran];

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

  /* Per-provider numbers for the strip. They come back from the server WITHOUT the provider filter,
     so every provider keeps its count while one is selected — the strip is both the stats and the
     filter. Channel and Source still narrow them, so the chips agree with the tiles beside them. */
  const provStats = useMemo(() => {
    const keep = new Set(activeStreams.map(s => s.key));
    return PROVIDERS
      .filter(p => channel === 'all' || p.channel === channel)
      .map(p => ({ ...p, m: sumMetrics((data?.providers || []).filter(x => x.provider === p.key && keep.has(x.stream))) }));
  }, [data, channel, activeStreams]);

  const toggleProvider = k => {
    const next = provs.includes(k) ? provs.filter(x => x !== k) : [...provs, k];
    const patch = { prov: next.join(',') || null };
    // Picking a WhatsApp provider while the channel says Email would show nothing at all.
    if (channel !== 'all' && PROVIDER[k] && PROVIDER[k].channel !== channel && !provs.includes(k)) patch.channel = null;
    setParam(patch);
  };
  const setOnlyProviders = list => setParam({ prov: list.join(',') || null });

  const openMenu = (id, e) => {
    const el = e.currentTarget;
    setMenu(m => (m?.id === id ? null : { id, el }));
  };
  const closeMenu = useCallback(() => setMenu(null), []);

  const pickPreset = (k, e) => {
    if (k === 'custom') {
      setDraft({ from: range.from, to: range.to, ft: range.fromTime, tt: range.toTime });
      openMenu('custom', e);
      return;
    }
    setMenu(null);
    setParam({ range: k === 'today' ? null : k, from: null, to: null, ft: null, tt: null });
  };
  const applyCustom = () => {
    if (!draft?.from || !draft?.to) { toast.error('Pick both dates'); return; }
    const ft = draft.ft || DAY_START; const tt = draft.tt || DAY_END;
    if (`${draft.from} ${ft.length === 5 ? `${ft}:00` : ft}` > `${draft.to} ${tt.length === 5 ? `${tt}:59` : tt}`) { toast.error('The start is after the end'); return; }
    setParam({ range: 'custom', from: draft.from, to: draft.to, ft: ft === DAY_START ? null : ft, tt: tt === DAY_END ? null : tt });
    setMenu(null);
  };
  const toggleSort = key => setSort(s => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));

  const openSource = r => setDrawer(r);
  // From a person row inside the stat drawer: the same shape the campaigns table hands over.
  const openSourceFromPerson = r => setDrawer({
    key: `${r.stream}:${r.sid}`, stream: r.stream, kind: r.kind, channel: r.channel, id: r.sid, name: r.source_name, status: null,
  });

  const kpis = [
    { key: 'sent', label: 'Sent', value: totals.sent, sub: <><b>{pctText(totals.sent, totals.attempted)}</b> of {nf(totals.attempted)}</>, e: emailT.sent, w: waT.sent },
    { key: 'delivered', label: 'Delivered', value: totals.delivered, sub: <><b>{pctText(totals.delivered, totals.sent)}</b> of sent</>, e: emailT.delivered, w: waT.delivered },
    { key: 'opened', label: 'Opened / Read', value: totals.opened, sub: <><b>{pctText(totals.opened, totals.sent)}</b> of sent</>, e: emailT.opened, w: waT.opened },
    { key: 'clicked', label: 'Clicked', value: totals.clicked, sub: <><b>{pctText(totals.clicked, totals.sent)}</b> CTR</>, e: emailT.clicked, w: waT.clicked },
    { key: 'rejected', color: METRIC.failed.color, label: 'Rejected', value: totals.failed + totals.bounced, sub: <><b>{pctText(totals.failed + totals.bounced, totals.attempted)}</b> · {nf(totals.bounced)} bounced</>, e: emailT.failed + emailT.bounced, w: waT.failed + waT.bounced },
    { key: 'skipped', label: 'Skipped', value: totals.skipped, sub: <><b>{pctText(totals.skipped, totals.attempted)}</b> of attempts</>, e: emailT.skipped, w: waT.skipped },
    { key: 'conversions', label: 'Conversions', value: totals.conversions, sub: totals.revenue ? <><b>{inr(totals.revenue)}</b></> : <><b>{pctText(totals.conversions, totals.sent)}</b> of sent</>, e: emailT.conversions, w: waT.conversions },
  ];

  const channelText = { all: 'All', email: 'Email', whatsapp: 'WhatsApp' }[channel];
  const sourceText = { all: 'All', campaign: 'Campaigns', journey: 'Journeys', support: 'Freshdesk', transactional: 'Refund & project' }[srcKind];
  const providerText = !provs.length ? 'All' : provs.length === 1 ? PROVIDER[provs[0]].label : `${PROVIDER[provs[0]].label} +${provs.length - 1}`;
  const filtersOn = channel !== 'all' || srcKind !== 'all' || provs.length > 0;
  const caret = <svg className="car" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>;
  const tick = <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;

  return (
    <div className="ma">
      <style>{CSS}</style>

      <div className="ma-title" style={{ marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
          <h1 style={{ fontSize: 16 }}>Messaging analytics</h1>
          <span className="ma-updated">{rangeLabel(range)} · per {granWord}{data ? ` · updated ${data.generated_at.slice(11, 16)} · ${data.took_ms} ms` : ''}</span>
        </div>
        <span className="ma-updated">Tip: click any stat or provider</span>
      </div>

      <div ref={sentinel} style={{ height: 1 }} aria-hidden="true" />
      {/* ── Sticky: filters, stats, providers. Each collapses to a slim strip once scrolled. ── */}
      <div className="ma-sticky" data-compact={compactHead ? '1' : undefined}>
        <div className="ma-progress" data-on={busy ? '1' : undefined} />
        <div className="ma-filters">
          <div className="ma-seg" role="tablist" aria-label="Date range">
            {PRESETS.map(p => (
              <button key={p.key} role="tab" onPointerDown={ripple} data-on={preset === p.key ? '1' : undefined}
                      onClick={e => pickPreset(p.key, e)} aria-haspopup={p.key === 'custom' ? 'dialog' : undefined}>
                {p.key === 'custom' && <span className="ic">{Ic.cal}</span>}{p.key === 'custom' && preset === 'custom' ? rangeLabel(range) : p.label}
              </button>
            ))}
          </div>

          <button className="ma-dd ma-rip" onPointerDown={ripple} onClick={e => openMenu('channel', e)} aria-haspopup="listbox"
                  data-active={channel !== 'all' ? '1' : undefined} data-open={menu?.id === 'channel' ? '1' : undefined}>
            Channel <b>{channel !== 'all' && <ChannelIcon channel={channel} size={12} />}{channelText}</b>{caret}
          </button>
          <button className="ma-dd ma-rip" onPointerDown={ripple} onClick={e => openMenu('source', e)} aria-haspopup="listbox"
                  data-active={srcKind !== 'all' ? '1' : undefined} data-open={menu?.id === 'source' ? '1' : undefined}>
            Source <b>{srcKind !== 'all' && <KindIcon kind={srcKind} size={12} />}{sourceText}</b>{caret}
          </button>
          <button className="ma-dd ma-rip" onPointerDown={ripple} onClick={e => openMenu('provider', e)} aria-haspopup="listbox"
                  data-active={provs.length ? '1' : undefined} data-open={menu?.id === 'provider' ? '1' : undefined}>
            Provider <b>{provs.length === 1 && <i style={{ width: 8, height: 8, borderRadius: '50%', background: providerColor(provs[0]) }} />}{providerText}</b>{caret}
          </button>
          {filtersOn && (
            <button className="ma-dd ma-rip" onPointerDown={ripple} style={{ color: '#4f46e5', borderStyle: 'dashed' }}
                    onClick={() => { setParam({ channel: null, source: null, prov: null }); setTableTab('all'); }}>
              Reset
            </button>
          )}
          <button className="ma-iconbtn ma-rip" style={{ marginLeft: 'auto', width: compactHead ? 26 : 30, height: compactHead ? 26 : 30 }} onPointerDown={ripple}
                  onClick={() => load({ force: true })} disabled={busy} title="Refresh" aria-label="Refresh">
            {Ic.refresh(busy ? 'spin' : '')}
          </button>
        </div>

        <div className="ma-stats">
          {kpis.map(k => {
            const c = k.color || METRIC[k.key].color;
            return (
              <button key={k.key} className="ma-stat ma-rip" onPointerDown={ripple} style={{ '--c': c }}
                      onClick={() => setStatDrawer(k.key)} title={`See everyone behind ${k.label}`}>
                <span className="k">{k.label}</span>
                <span className="row">
                  <span className="v">{loadingFirst ? <Skel w={54} h={18} /> : <CountUp value={k.value} />}</span>
                  <span className="s">{loadingFirst ? '' : k.sub}</span>
                </span>
                {channel === 'all' && !loadingFirst && (
                  <span className="cs">
                    <em style={{ color: '#6366f1' }}><ChannelIcon channel="email" size={10} />{compact(k.e)}</em>
                    <em style={{ color: '#059669' }}><ChannelIcon channel="whatsapp" size={10} />{compact(k.w)}</em>
                  </span>
                )}
                <span className="go">{Ic.arrow}</span>
              </button>
            );
          })}
        </div>

        {/*
          Providers as a real table: one full-width row each, every figure in its own aligned column,
          email providers first then WhatsApp. Clicking a row filters the page to that provider.
          Scrolled, the table gives way to a single line of chips (name + sent).
        */}
        {(() => {
          const rows = provStats.filter(p => provs.includes(p.key) || p.m.attempted || p.m.conversions);
          const cell = (v, base, color, bad) => (
            <td>
              <span className="pv" style={bad && v ? { color: '#dc2626' } : undefined}>{nf(v)}</span>
              <span className="pp">{pctText(v, base)}</span>
              <span className="pb"><i style={{ width: `${Math.min(100, rate(v, base))}%`, background: color }} /></span>
            </td>
          );
          return (
            <div className="ma-provs" data-filtering={provs.length ? '1' : undefined} role="group" aria-label="Providers">
              <table className="ma-ptable">
                <thead>
                  <tr>
                    <th className="l">
                      By provider
                      {provs.length > 0 && <button className="ma-link" style={{ fontSize: 11, marginLeft: 10, textTransform: 'none', letterSpacing: 0 }} onClick={() => setOnlyProviders([])}>Show all</button>}
                    </th>
                    <th>Attempted</th>
                    <th>Sent</th>
                    <th className="l wide">Outcome</th>
                    <th>Delivered</th>
                    <th>Opened / Read</th>
                    <th>Clicked</th>
                    <th>Rejected</th>
                    <th>Skipped</th>
                    <th>Conv.</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p, i) => {
                    const m = p.m; const rej = m.failed + m.bounced;
                    const on = provs.includes(p.key);
                    const opened = Math.min(m.opened, m.sent);
                    const delivered = Math.max(0, Math.min(m.delivered, m.sent) - opened);
                    const noReceipt = Math.max(0, m.sent - Math.max(m.delivered, m.opened));
                    const base = Math.max(1, m.attempted);
                    const seg = (v, c, t) => (v > 0 ? <i style={{ width: `${(v / base) * 100}%`, background: c }} title={`${t}: ${nf(v)}`} /> : null);
                    const newGroup = i > 0 && rows[i - 1].channel !== p.channel;
                    return (
                      <tr key={p.key} className={newGroup ? 'grp' : undefined} style={{ '--c': providerColor(p.key) }} data-on={on ? '1' : undefined}
                          tabIndex={0} aria-pressed={on} onClick={() => toggleProvider(p.key)}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleProvider(p.key); } }}
                          title={on ? 'Click to remove this provider filter' : 'Click to filter the page to this provider'}>
                        <td className="l">
                          <span className="pn">
                            <span className="ck" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                            <span className="sw" />
                            <b>{p.label}</b>
                            <span className="ch" style={{ color: p.channel === 'whatsapp' ? '#059669' : '#6366f1' }}><ChannelIcon channel={p.channel} size={12} /></span>
                          </span>
                        </td>
                        <td><span className="pv">{nf(m.attempted)}</span></td>
                        <td><span className="pv big">{loadingFirst ? '…' : nf(m.sent)}</span><span className="pp">{pctText(m.sent, m.attempted)}</span></td>
                        <td className="l wide">
                          <span className="pbar">
                            {seg(opened, METRIC.opened.color, p.channel === 'whatsapp' ? 'Read' : 'Opened')}
                            {seg(delivered, METRIC.delivered.color, 'Delivered, not opened')}
                            {seg(noReceipt, '#c7d2fe', 'Sent, no receipt yet')}
                            {seg(rej, '#ef4444', 'Rejected')}
                            {seg(m.skipped, '#cbd5e1', 'Skipped')}
                          </span>
                        </td>
                        {p.untracked
                          ? <td colSpan={3} style={{ textAlign: 'center' }}><span className="ma-nt">SMTP from contact@ (Freshdesk + refund / project emails) — only sent / failed, no delivery, open or click tracking</span></td>
                          : <>
                            {cell(m.delivered, m.sent, METRIC.delivered.color)}
                            {cell(m.opened, m.sent, METRIC.opened.color)}
                            {cell(m.clicked, m.sent, METRIC.clicked.color)}
                          </>}
                        {cell(rej, m.attempted, '#ef4444', true)}
                        <td><span className="pv" style={m.skipped ? undefined : { color: '#cbd5e1' }}>{nf(m.skipped)}</span></td>
                        <td><span className="pv" style={m.conversions ? { color: '#047857' } : { color: '#cbd5e1' }}>{nf(m.conversions)}</span></td>
                      </tr>
                    );
                  })}
                  {data && !rows.length && <tr><td className="l" colSpan={10} style={{ color: '#94a3b8' }}>No provider activity in this range</td></tr>}
                </tbody>
              </table>
              <div className="ma-pchips">
                <span className="lbl">Providers</span>
                {rows.map(p => (
                  <button key={p.key} className="ma-pchip ma-rip" onPointerDown={ripple} style={{ '--c': providerColor(p.key) }}
                          data-on={provs.includes(p.key) ? '1' : undefined} onClick={() => toggleProvider(p.key)}>
                    <span className="sw" /><b>{p.label}</b><span>{nf(p.m.sent)} sent</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Menus (portalled, so the sticky header never clips them) ── */}
      {menu?.id === 'channel' && (
        <Popover anchor={menu.el} onClose={closeMenu} width={210}>
          {CHANNELS.map(c => (
            <button key={c.key} className="ma-opt" data-on={channel === c.key ? '1' : undefined}
                    onClick={() => { const patch = { channel: c.key === 'all' ? null : c.key }; if (c.key !== 'all') { const keep = provs.filter(k => PROVIDER[k].channel === c.key); if (keep.length !== provs.length) patch.prov = keep.join(',') || null; } setParam(patch); setMenu(null); }}>
              <span className="radio" />
              {c.key !== 'all' && <span style={{ color: c.key === 'whatsapp' ? '#059669' : '#4f46e5', display: 'inline-flex' }}><ChannelIcon channel={c.key} size={13} /></span>}
              {c.key === 'all' ? 'All channels' : c.label}
              <span className="cnt">{data ? nf(c.key === 'all' ? sumMetrics(STREAMS.filter(s => srcKind === 'all' || s.kind === srcKind).map(s => S[s.key] || ZERO)).sent : sumMetrics(STREAMS.filter(s => s.channel === c.key && (srcKind === 'all' || s.kind === srcKind)).map(s => S[s.key] || ZERO)).sent) : ''}</span>
            </button>
          ))}
        </Popover>
      )}
      {menu?.id === 'source' && (
        <Popover anchor={menu.el} onClose={closeMenu} width={220}>
          {SOURCES.map(c => (
            <button key={c.key} className="ma-opt" data-on={srcKind === c.key ? '1' : undefined}
                    onClick={() => { setParam({ source: c.key === 'all' ? null : c.key }); setTableTab('all'); setMenu(null); }}>
              <span className="radio" />
              {c.key !== 'all' && <span style={{ display: 'inline-flex', color: '#64748b' }}><KindIcon kind={c.key} size={13} /></span>}
              {c.key === 'all' ? 'Everything' : c.label}
              <span className="cnt">{data ? nf(sumMetrics(STREAMS.filter(s => (c.key === 'all' || s.kind === c.key) && (channel === 'all' || s.channel === channel)).map(s => S[s.key] || ZERO)).sent) : ''}</span>
            </button>
          ))}
        </Popover>
      )}
      {menu?.id === 'provider' && (
        <Popover anchor={menu.el} onClose={closeMenu} width={270}>
          {['email', 'whatsapp'].filter(ch => channel === 'all' || channel === ch).map(ch => (
            <div key={ch}>
              <div className="grp"><ChannelIcon channel={ch} size={11} />{ch === 'email' ? 'Email' : 'WhatsApp'}</div>
              {provStats.filter(p => p.channel === ch).map(p => (
                <button key={p.key} className="ma-opt" data-on={provs.includes(p.key) ? '1' : undefined} onClick={() => toggleProvider(p.key)}>
                  <span className="box">{provs.includes(p.key) && tick}</span>
                  <span className="dot" style={{ background: providerColor(p.key) }} />
                  {p.label}
                  <span className="cnt">{data ? `${nf(p.m.sent)} sent` : ''}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="foot">
            <button onClick={() => setOnlyProviders([])}>All providers</button>
            <button onClick={() => setMenu(null)}>Done</button>
          </div>
        </Popover>
      )}
      {menu?.id === 'custom' && draft && (
        <Popover anchor={menu.el} onClose={closeMenu} width={330} className="form">
          <h4>Custom date &amp; time</h4>
          <div className="times">
            <label>From date<input type="date" value={draft.from} max={todayYmd()} onChange={e => setDraft(d => ({ ...d, from: e.target.value }))} /></label>
            <label>From time<input type="time" step="1" value={draft.ft} onChange={e => setDraft(d => ({ ...d, ft: e.target.value || DAY_START }))} /></label>
            <label>To date<input type="date" value={draft.to} max={todayYmd()} min={draft.from} onChange={e => setDraft(d => ({ ...d, to: e.target.value }))} /></label>
            <label>To time<input type="time" step="1" value={draft.tt} onChange={e => setDraft(d => ({ ...d, tt: e.target.value || DAY_END }))} /></label>
          </div>
          <div className="hint">Whole day by default (00:00:00 – 23:59:59). Narrow the times for a window like 10:05 – 10:45.</div>
          <div className="row">
            <button className="ma-btn ma-rip" style={{ marginRight: 'auto' }} onPointerDown={ripple} onClick={() => setDraft(d => ({ ...d, ft: DAY_START, tt: DAY_END }))}>Whole day</button>
            <button className="ma-btn ma-rip" onPointerDown={ripple} onClick={() => setMenu(null)}>Cancel</button>
            <button className="ma-btn primary ma-rip" onPointerDown={ripple} onClick={applyCustom}>Apply</button>
          </div>
        </Popover>
      )}
      {provHover && createPortal(
        <div className="ma-portal">
          <div className="ma-provcard" style={{ left: Math.min(provHover.x, window.innerWidth - 250), top: provHover.y }}>
            <div className="ma-tip">
              <b>{provHover.p.label} · {rangeLabel(range)}</b>
              {[['attempted', 'Attempted'], ['sent', 'Sent'], ['delivered', 'Delivered'], ['opened', provHover.p.channel === 'whatsapp' ? 'Read' : 'Opened'], ['clicked', 'Clicked'], ['failed', 'Failed'], ['bounced', 'Bounced'], ['skipped', 'Skipped'], ['conversions', 'Conversions']]
                .filter(([k]) => k !== 'bounced' || provHover.p.channel === 'email')
                .map(([k, l]) => (
                  <div className="r" key={k}><i style={{ background: METRIC[k].color }} /><span>{l}</span>{nf(provHover.p.m[k])}
                    {!['attempted', 'sent', 'conversions'].includes(k) && <em style={{ fontStyle: 'normal', color: '#94a3b8', width: 44, textAlign: 'right' }}>{pctText(provHover.p.m[k], ['failed', 'bounced', 'skipped'].includes(k) ? provHover.p.m.attempted : provHover.p.m.sent)}</em>}
                  </div>
                ))}
              <div className="r tot"><span>{provs.includes(provHover.p.key) ? 'Click to remove filter' : 'Click to filter to this provider'}</span></div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {error && (
        <div className="ma-card" style={{ padding: 12, marginBottom: 14, borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c', display: 'flex', gap: 10, alignItems: 'center' }}>
          {Ic.alert}<span style={{ flex: 1 }}>{error}</span>
          <button className="ma-btn ma-rip" onPointerDown={ripple} onClick={() => load({ force: true })}>Try again</button>
        </div>
      )}

      {data && !hasAny && !busy && <div className="ma-card" style={{ marginBottom: 16 }}><Empty sub={`Nothing was sent ${preset === 'today' ? 'today yet' : 'in this range'}${channel !== 'all' || srcKind !== 'all' ? ' for these filters' : ''}. Try a wider date range.`} /></div>}

      {/* ── Trend + share of sends ──────────────────────────────── */}
      <div className="ma-grid ma-g-trend">
        <div className="ma-card">
          <div className="ma-card-h">
            <div><h3>{METRIC[metric].label} over time</h3><small>Per {granWord}, stacked by channel and source</small></div>
            <div className="ma-chips">
              {TREND_METRICS.map(k => (
                <button key={k} className="ma-chip ma-rip" onPointerDown={ripple} style={{ '--c': METRIC[k].color }} data-on={metric === k ? '1' : undefined} onClick={() => setMetric(k)}>
                  <i />{k === 'opened' ? 'Opened/Read' : METRIC[k].label}
                </button>
              ))}
            </div>
          </div>
          <div className="ma-card-b" style={{ height: 250 }}>
            {loadingFirst ? <Skel h={220} r={12} /> : (
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
                  <div><h3>{s.label}</h3><small>{loadingFirst ? '…' : `${nf(tabCounts[s.key] || 0)} ${s.kind === 'journey' ? 'journeys' : s.kind === 'support' ? 'agents' : s.kind === 'transactional' ? 'email types' : 'campaigns'} active in range`}</small></div>
                </div>
                <button className="ma-btn ma-rip" onPointerDown={ripple} style={{ height: 30, padding: '0 10px', fontSize: 12 }}
                        onClick={() => { setTableTab(s.key); document.getElementById('ma-sources')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                  View {Ic.arrow}
                </button>
              </div>
              <div className="ma-card-b">{loadingFirst ? <Skel h={170} r={10} /> : <Funnel m={m} isWa={s.channel === 'whatsapp'} untracked={s.untracked} color={s.kind === 'transactional' ? '#0f766e' : s.kind === 'support' ? '#0891b2' : s.channel === 'whatsapp' ? '#059669' : '#4f46e5'} />}</div>
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
                    <tr key={key} style={sub ? { background: '#fcfdff' } : (provs.includes(p.provider) ? { background: '#eef2ff' } : undefined)}
                        data-click={!sub && PROVIDER[p.provider] ? '1' : undefined}
                        onClick={!sub && PROVIDER[p.provider] ? () => toggleProvider(p.provider) : undefined}
                        title={!sub && PROVIDER[p.provider] ? (provs.includes(p.provider) ? 'Click to remove this provider filter' : 'Click to filter to this provider') : undefined}>
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
                            <span className="ma-tag" style={{ background: (KIND_TAG[r.kind] || KIND_TAG.campaign)[0], color: (KIND_TAG[r.kind] || KIND_TAG.campaign)[1] }}><KindIcon kind={r.kind} size={10} />{(KIND_TAG[r.kind] || KIND_TAG.campaign)[2]}</span>
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

      {statDrawer && (
        <StatDrawer metric={statDrawer} channel={channel} source={srcKind} range={range} totals={totals} providers={provs}
                    onClose={() => setStatDrawer(null)} onOpenSource={openSourceFromPerson} />
      )}
      {/* After the stat drawer, so a campaign opened from a person row stacks on top of it. */}
      {drawer && <SourceDrawer source={drawer} range={range} providers={provs} onClose={() => setDrawer(null)} />}
    </div>
  );
}
