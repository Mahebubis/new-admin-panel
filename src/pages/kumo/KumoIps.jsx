/*
 * KumoMTA — Sending IPs.
 *
 * The flagship management screen for the egress pool: every IP we own, its
 * health score, where it is in the warmup plan, how much of today's quota is
 * spent, and whether anything out there has listed it. A sortable table by
 * default, cards for a glance, and a deep-dive drawer per IP with
 * performance, warmup, health history and deliverability.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  KumoStyles, kapi, usePolling, resolveRange, RangePicker, Card, StatTile, Btn, Pill, HealthPill,
  Meter, Empty, Skel, Modal, Drawer, Confirm, Toggle, Tabs, SearchInput, RowMenu,
  T, HEALTH, nf, compact, pct, fmtDt, fmtDate, ago, rateTone,
  IconRefresh, IconPlus, IconServer, IconShield, IconActivity, IconFlame, IconAlert, IconCheck,
  IconPause, IconPlay, IconTrash, IconEdit, IconEye, IconGlobe, IconSend, IconClock,
  IconOpen, IconClick, IconBounce, IconSpam, IconMail,
} from './kumoShared';

/* ── constants ──────────────────────────────────────────────────────────── */
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HOSTNAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
const TENANT = /^[a-z0-9_-]+$/i;
const PROVIDER_COLORS = { gmail: '#ef4444', outlook: '#0ea5e9', yahoo: '#8b5cf6', apple: '#64748b', rediff: '#f59e0b', other: '#10b981' };
const HEALTH_RANK = { red: 0, yellow: 1, unknown: 2, green: 3 };
const DEFAULT_PAUSE_REASON = 'Paused manually from the admin panel';
const BLANK = {
  id: null, ip: '', hostname: '', tenant: '', label: '', warmup_enabled: true, manual_cap: '', sort_order: '',
  /* Purchase identity. The label is derived from these three: 1-5-3 means
     batch 1 · 5 IPs bought together · this is the 3rd of them. */
  batch_no: '1', batch_size: '5', batch_index: '', purchased_at: '',
};

/** 1-5-3 — batch · how many were bought in it · position inside that batch. */
const batchLabel = (b, s, i) => `${Number(b) || 1}-${Number(s) || 0}-${Number(i) || 0}`;

const ipKey = (ip) => String(ip || '').split('.').reduce((a, b) => a * 256 + (Number(b) || 0), 0);
const tileTone = (kind, v) => ({ green: 'green', yellow: 'amber', red: 'red', slate: 'slate' }[rateTone(kind, v)] || 'slate');
const meterTone = (h) => (h === 'red' ? 'red' : h === 'yellow' ? 'amber' : 'green');
const bucketLabel = (b) => String(b || '').slice(5).replace('T', ' ');
const asList = (v) => (Array.isArray(v) ? v : v ? String(v).split(/\s*[;|]\s*/).filter(Boolean) : []);

const rate = (num, den) => (den > 0 ? (Number(num || 0) / Number(den)) * 100 : 0);
function sumSeries(series = []) {
  const t = { sent: 0, delivered: 0, deferred: 0, bounced: 0, complaints: 0, opens: 0, clicks: 0, unsubs: 0 };
  series.forEach((s) => Object.keys(t).forEach((k) => { t[k] += Number(s[k] || 0); }));
  return {
    ...t,
    delivery_rate: rate(t.delivered, t.sent), bounce_rate: rate(t.bounced, t.sent),
    deferral_rate: rate(t.deferred, t.sent), complaint_rate: rate(t.complaints, t.delivered || t.sent),
    open_rate: rate(t.opens, t.delivered || t.sent), click_rate: rate(t.clicks, t.delivered || t.sent),
    unsub_rate: rate(t.unsubs, t.delivered || t.sent),
  };
}

/* ── tiny local bits ────────────────────────────────────────────────────── */
function Field({ label, hint, error, children }) {
  return (
    <div className="km-field">
      <label className="km-label">{label}</label>
      {children}
      {error
        ? <div style={{ marginTop: 5, fontSize: 11.5, fontWeight: 600, color: T.red }}>{error}</div>
        : hint ? <div style={{ marginTop: 5, fontSize: 11.5, color: T.muted, lineHeight: 1.5 }}>{hint}</div> : null}
    </div>
  );
}

function Dot({ health, size = 9 }) {
  const h = HEALTH[health] || HEALTH.unknown;
  return <span style={{ width: size, height: size, borderRadius: '50%', background: h.dot, boxShadow: `0 0 0 4px ${h.ring}`, flexShrink: 0, display: 'inline-block' }} />;
}

function Ratio({ k, v, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '6px 2px', borderRadius: 9, background: 'rgba(255,255,255,.58)', minWidth: 0 }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.3px', textTransform: 'uppercase', color: color || T.faint, opacity: .8 }}>{k}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: T.ink2, marginTop: 2 }}>{v}</div>
    </div>
  );
}

function SectionTitle({ children, sub, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
      <div><h2 className="km-h2">{children}</h2>{sub && <div className="km-sub">{sub}</div>}</div>
      {right}
    </div>
  );
}

const CHART_TOOLTIP = { borderRadius: 12, border: '1px solid rgba(15,23,42,.08)', boxShadow: '0 18px 40px -20px rgba(15,23,42,.5)', fontSize: 12 };

/* ══════════════════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════════════════ */
export default function KumoIps() {
  const [sp, setSp] = useSearchParams();
  const openId = sp.get('open') || '';

  const [range, setRange] = useState(() => ({ id: '30d', ...resolveRange('30d') }));
  const [view, setView] = useState('table');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: 'ip', dir: 'asc' });
  const [busy, setBusy] = useState('');

  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pauseRow, setPauseRow] = useState(null);
  const [pauseReason, setPauseReason] = useState(DEFAULT_PAUSE_REASON);
  const [retireRow, setRetireRow] = useState(null);
  const [acting, setActing] = useState(false);

  const [tab, setTab] = useState('perf');

  const { data, loading, error, reload } = usePolling(
    () => kapi('ips_list', { from: range.from, to: range.to }),
    [range.from, range.to],
    60000
  );
  const ips = useMemo(() => data?.ips || [], [data]);

  const { data: detail, loading: detailLoading, reload: reloadDetail } = usePolling(
    () => (openId ? kapi('ip_detail', { id: openId, from: range.from, to: range.to, bucket: range.bucket }) : Promise.resolve(null)),
    [openId, range.from, range.to, range.bucket],
    0
  );

  useEffect(() => { setTab('perf'); }, [openId]);

  /* ── navigation helpers ─────────────────────────────────────────────── */
  const openDetail = (id) => { const n = new URLSearchParams(sp); n.set('open', String(id)); setSp(n); };
  const closeDetail = () => { const n = new URLSearchParams(sp); n.delete('open'); setSp(n, { replace: true }); };

  /* ── toolbar actions ────────────────────────────────────────────────── */
  const runAction = async (action, okMsg) => {
    setBusy(action);
    try { await kapi(action); toast.success(okMsg); await reload(true); if (openId) reloadDetail(true); }
    catch (e) { toast.error(e.message || 'That did not work'); }
    finally { setBusy(''); }
  };

  /* ── add / edit ─────────────────────────────────────────────────────── */
  const openAdd = () => {
    /* Continue the newest batch: same batch number, next position — so adding
       the 6th IP of a 5-IP batch nudges you to start batch 2 instead. */
    const lastBatch = ips.reduce((m, r) => Math.max(m, Number(r.batch_no) || 1), 1);
    const inBatch = ips.filter((r) => (Number(r.batch_no) || 1) === lastBatch);
    const size = Number(inBatch[0]?.batch_size) || inBatch.length || 5;
    const full = inBatch.length >= size;
    const batchNo = full ? lastBatch + 1 : lastBatch;
    const index = full ? 1 : inBatch.length + 1;
    setForm({
      ...BLANK,
      sort_order: String((ips.length + 1) * 10),
      batch_no: String(batchNo),
      batch_size: String(full ? 5 : size),
      batch_index: String(index),
      purchased_at: new Date().toISOString().slice(0, 10),
      tenant: `ip${ips.length + 1}`,
    });
    setErrors({}); setFormOpen(true);
  };
  const openEdit = (row) => {
    setForm({
      id: row.id, ip: row.ip || '', hostname: row.hostname || '', tenant: row.tenant || '', label: row.label || '',
      warmup_enabled: Number(row.warmup_enabled) === 1,
      manual_cap: row.manual_cap === null || row.manual_cap === undefined || row.manual_cap === '' ? '' : String(row.manual_cap),
      sort_order: row.sort_order === null || row.sort_order === undefined ? '' : String(row.sort_order),
      batch_no: String(row.batch_no ?? 1),
      batch_size: String(row.batch_size ?? ''),
      batch_index: String(row.batch_index ?? ''),
      purchased_at: row.purchased_at ? String(row.purchased_at).slice(0, 10) : '',
    });
    setErrors({}); setFormOpen(true);
  };

  const validate = () => {
    const e = {};
    const ip = form.ip.trim(); const host = form.hostname.trim(); const tenant = form.tenant.trim();
    if (!ip) e.ip = 'An IP address is required';
    else if (!IPV4.test(ip)) e.ip = 'That is not a valid IPv4 address (e.g. 51.79.24.10)';
    else if (ips.some((r) => r.ip === ip && r.id !== form.id)) e.ip = 'This IP is already in the pool';
    if (!host) e.hostname = 'A hostname is required — the PTR record must match it';
    else if (!HOSTNAME.test(host)) e.hostname = 'Use a fully-qualified hostname, e.g. mail1.nitrocampus.com';
    if (!tenant) e.tenant = 'A tenant is required';
    else if (!TENANT.test(tenant)) e.tenant = 'Letters, numbers, dash and underscore only (e.g. ip1)';
    if (form.manual_cap !== '' && (!/^\d+$/.test(form.manual_cap) || Number(form.manual_cap) < 1)) e.manual_cap = 'Whole number of messages, or leave blank';
    if (form.sort_order !== '' && !/^-?\d+$/.test(form.sort_order)) e.sort_order = 'Whole number only';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) { toast.error('Fix the highlighted fields first'); return; }
    setSaving(true);
    try {
      await kapi('ip_save', {
        id: form.id || '', ip: form.ip.trim(), hostname: form.hostname.trim(), tenant: form.tenant.trim(),
        /* Blank label = let the server derive it from the batch numbers. */
        label: form.label.trim(), warmup_enabled: form.warmup_enabled ? 1 : 0,
        manual_cap: form.manual_cap === '' ? '' : Number(form.manual_cap),
        sort_order: form.sort_order === '' ? 0 : Number(form.sort_order),
        batch_no: form.batch_no === '' ? 1 : Number(form.batch_no),
        batch_size: form.batch_size === '' ? 0 : Number(form.batch_size),
        batch_index: form.batch_index === '' ? 0 : Number(form.batch_index),
        purchased_at: form.purchased_at || '',
      });
      toast.success(form.id ? `${form.ip} updated` : `${form.ip} added to the pool`);
      setFormOpen(false);
      await reload(true);
    } catch (e) { toast.error(e.message || 'Could not save this IP'); }
    finally { setSaving(false); }
  };

  /* ── lifecycle actions ──────────────────────────────────────────────── */
  const doPause = async () => {
    if (!pauseReason.trim()) { toast.error('A reason is required so the team knows why'); return; }
    setActing(true);
    try {
      await kapi('ip_pause', { id: pauseRow.id, reason: pauseReason.trim() });
      toast.success(`${pauseRow.ip} paused`);
      setPauseRow(null); setPauseReason(DEFAULT_PAUSE_REASON);
      await reload(true);
    } catch (e) { toast.error(e.message || 'Could not pause this IP'); }
    finally { setActing(false); }
  };

  const doResume = async (row) => {
    try { await kapi('ip_resume', { id: row.id }); toast.success(`${row.ip} resumed`); await reload(true); }
    catch (e) { toast.error(e.message || 'Could not resume this IP'); }
  };

  const doRetire = async () => {
    setActing(true);
    try {
      await kapi('ip_retire', { id: retireRow.id });
      toast.success(`${retireRow.ip} retired`);
      if (String(retireRow.id) === String(openId)) closeDetail();
      setRetireRow(null);
      await reload(true);
    } catch (e) { toast.error(e.message || 'Could not retire this IP'); }
    finally { setActing(false); }
  };

  const menuFor = (row) => [
    { label: 'Open detail', icon: <IconEye size={14} />, onClick: () => openDetail(row.id) },
    { label: 'Edit', icon: <IconEdit size={14} />, onClick: () => openEdit(row) },
    row.status === 'paused'
      ? { label: 'Resume sending', icon: <IconPlay size={14} />, onClick: () => doResume(row) }
      : row.status === 'active' ? { label: 'Pause sending', icon: <IconPause size={14} />, onClick: () => { setPauseReason(DEFAULT_PAUSE_REASON); setPauseRow(row); } } : null,
    row.status !== 'retired' ? { label: 'Retire IP', icon: <IconTrash size={14} />, tone: 'danger', onClick: () => setRetireRow(row) } : null,
  ];

  /* ── derived ────────────────────────────────────────────────────────── */
  const summary = useMemo(() => {
    const c = { green: 0, yellow: 0, red: 0, unknown: 0 };
    let cap = 0, sentToday = 0, sent = 0, delivered = 0, active = 0;
    ips.forEach((i) => {
      c[i.health] = (c[i.health] || 0) + 1;
      cap += Number(i.today_cap || 0); sentToday += Number(i.today_sent || 0);
      sent += Number(i.sent || 0); delivered += Number(i.delivered || 0);
      if (i.status === 'active') active += 1;
    });
    return { ...c, cap, sentToday, sent, delivered, active, deliveryRate: rate(delivered, sent) };
  }, [ips]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? ips.filter((r) => [r.ip, r.hostname, r.tenant, r.label, r.status].some((v) => String(v || '').toLowerCase().includes(needle)))
      : ips.slice();
    const dir = sort.dir === 'asc' ? 1 : -1;
    const val = (r) => {
      switch (sort.key) {
        case 'ip': return ipKey(r.ip);
        case 'tenant': return String(r.tenant || '').toLowerCase();
        case 'health': return HEALTH_RANK[r.health] ?? 9;
        case 'status': return String(r.status || '');
        case 'warmup_day': return Number(r.warmup_day || 0);
        case 'today': return Number(r.today_pct || 0);
        case 'last_send_at': return new Date(String(r.last_send_at || '').replace(' ', 'T')).getTime() || 0;
        default: return Number(r[sort.key] || 0);
      }
    };
    return filtered.sort((a, b) => {
      const x = val(a), y = val(b);
      if (x < y) return -1 * dir;
      if (x > y) return 1 * dir;
      return ipKey(a.ip) - ipKey(b.ip);
    });
  }, [ips, q, sort]);

  const toggleSort = (key) => setSort((s) => (s.key === key
    ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: (key === 'ip' || key === 'tenant' || key === 'status') ? 'asc' : 'desc' }));

  const drawerRow = useMemo(() => ips.find((r) => String(r.id) === String(openId)) || null, [ips, openId]);

  const COLS = [
    { key: 'ip', label: 'IP' }, { key: 'tenant', label: 'Tenant' }, { key: 'health', label: 'Health' },
    { key: 'status', label: 'Status' }, { key: 'warmup_day', label: 'Day', right: true },
    { key: 'today', label: 'Today', right: true }, { key: 'sent', label: 'Sent', right: true },
    { key: 'delivery_rate', label: 'Deliv %', right: true }, { key: 'open_rate', label: 'Open %', right: true },
    { key: 'bounce_rate', label: 'Bounce %', right: true }, { key: 'complaint_rate', label: 'Spam %', right: true },
    { key: 'last_send_at', label: 'Last send' },
  ];

  /* ══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="km km-page">
      <KumoStyles />

      {/* ── header ───────────────────────────────────────────────────── */}
      <div className="km-head">
        <div>
          <h1 className="km-h1">Sending IPs</h1>
          <div className="km-sub">
            {nf(ips.length)} IP{ips.length === 1 ? '' : 's'} in the pool · {nf(summary.active)} active ·
            {' '}warmup caps refresh every morning · auto-refreshing every 60s
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <RangePicker value={range} onChange={(r) => setRange({ ...r, ...resolveRange(r.id, r.from, r.to) })} />
          <Btn variant="ghost" size="sm" loading={busy === 'ip_check'} onClick={() => runAction('ip_check', 'Blocklist + reverse-DNS probes finished')} icon={<IconShield size={14} />}>Check blocklists</Btn>
          <Btn variant="ghost" size="sm" loading={busy === 'health_run'} onClick={() => runAction('health_run', 'Health re-scored')} icon={<IconActivity size={14} />}>Re-score health</Btn>
          <Btn variant="ghost" size="sm" loading={busy === 'warmup_run'} onClick={() => runAction('warmup_run', "Today's warmup caps refreshed")} icon={<IconFlame size={14} />}>Refresh warmup</Btn>
          <Btn variant="ghost" size="sm" loading={loading} onClick={() => reload()} icon={<IconRefresh size={14} />}>Refresh</Btn>
          <Btn size="sm" onClick={openAdd} icon={<IconPlus size={14} />}>Add IP</Btn>
        </div>
      </div>

      {error && (
        <Card style={{ marginBottom: 12, borderLeft: `4px solid ${T.red}` }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: T.red, fontWeight: 600, fontSize: 13 }}>
            <IconAlert size={16} /> {error}
          </div>
        </Card>
      )}

      {/* ── summary strip ────────────────────────────────────────────── */}
      <div className="km-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(149px, 1fr))', marginBottom: 16 }}>
        <StatTile label="IPs in pool" value={ips.length} tone="indigo" icon={<IconServer size={15} />} loading={loading} sub={`${nf(summary.active)} sending now`} />
        <StatTile label="Healthy" value={summary.green} tone="green" icon={<IconCheck size={15} />} loading={loading} sub="green scorecard" />
        <StatTile label="Watch" value={summary.yellow} tone="amber" icon={<IconAlert size={15} />} loading={loading} sub="one ratio drifting" />
        <StatTile label="Critical" value={summary.red} tone="red" icon={<IconSpam size={15} />} loading={loading} sub={summary.unknown ? `${nf(summary.unknown)} with no data` : 'needs attention'} />
        <Card className="km-fade" pad={false} style={{ padding: '12px 14px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span className="km-h3" style={{ fontSize: 11 }}>Today vs cap</span>
            <span style={{ width: 30, height: 30, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#f59e0b22,#ea580c22)', color: '#f59e0b', flexShrink: 0 }}><IconFlame size={15} /></span>
          </div>
          <div style={{ marginTop: 8, fontSize: 21, fontWeight: 800, letterSpacing: '-.5px', color: T.ink2, lineHeight: 1.15 }}>
            {loading ? <Skel w={90} h={22} /> : <>{compact(summary.sentToday)}<span style={{ color: T.faint, fontWeight: 700, fontSize: 15 }}> / {compact(summary.cap)}</span></>}
          </div>
          <div style={{ marginTop: 9 }}>
            <Meter value={summary.sentToday} max={Math.max(1, summary.cap)} tone={summary.cap && summary.sentToday / summary.cap > 0.95 ? 'amber' : 'indigo'} />
          </div>
          <div style={{ marginTop: 6, fontSize: 11.5, color: T.muted, fontWeight: 600 }}>
            {summary.cap > 0 ? `${pct(rate(summary.sentToday, summary.cap), 1)} of today's quota used` : 'No quota assigned yet'}
          </div>
        </Card>
        <StatTile label="Delivery rate" value={summary.deliveryRate} format={(v) => pct(v, 2)} tone={tileTone('delivery', summary.deliveryRate)}
          icon={<IconSend size={15} />} loading={loading} sub={`${compact(summary.delivered)} of ${compact(summary.sent)} accepted`} />
      </div>

      {/* ── view toolbar ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <Tabs value={view} onChange={setView} size="sm" tabs={[
          { id: 'table', label: 'Table', icon: <IconActivity size={14} />, count: rows.length },
          { id: 'cards', label: 'Cards', icon: <IconServer size={14} /> },
        ]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search IP, host, tenant…" width={240} />
      </div>

      {/* ── body ─────────────────────────────────────────────────────── */}
      {loading && !ips.length ? (
        <div className="km-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(241px, 1fr))' }}>
          {[0, 1, 2, 3, 4, 5].map((i) => <Skel key={i} h={210} r={18} />)}
        </div>
      ) : ips.length === 0 ? (
        <Card>
          <Empty icon={<IconServer size={22} />} title="No sending IPs yet"
            sub="Add the IPs you bought from OVH — each one needs a hostname with a matching PTR record and a KumoMTA pool name so campaigns know where to inject."
            action={<Btn onClick={openAdd} icon={<IconPlus size={14} />}>Add your first IP</Btn>} />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <Empty title="Nothing matches that search" sub={`No IP, hostname or tenant contains “${q}”.`}
            action={<Btn variant="ghost" onClick={() => setQ('')}>Clear search</Btn>} />
        </Card>
      ) : view === 'cards' ? (
        <div className="km-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(241px, 1fr))' }}>
          {rows.map((row) => {
            const h = HEALTH[row.health] || HEALTH.unknown;
            return (
              <Card key={row.id} hover className="km-fade" style={{ background: h.bg, borderColor: h.ring, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => openDetail(row.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Dot health={row.health} />
                      <span style={{ fontWeight: 800, fontSize: 15, color: T.ink, letterSpacing: '-.2px' }}>{row.ip}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: h.text, fontWeight: 600, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={`${row.hostname || ''} · ${row.tenant || ''}`}>
                      {row.hostname || '—'} · pool {row.tenant || '—'}
                    </div>
                    {row.label && <div style={{ fontSize: 11, color: T.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flexShrink: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                      <HealthPill health={row.health} />
                      <Pill tone={row.status === 'active' ? 'green' : row.status === 'paused' ? 'yellow' : 'slate'}>{row.status}</Pill>
                    </div>
                    <RowMenu items={menuFor(row)} />
                  </div>
                </div>

                <div style={{ marginTop: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 700, color: h.text, marginBottom: 5, gap: 8 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {Number(row.warmup_enabled) === 1 ? `Warmup day ${nf(row.warmup_day)}` : 'Warmup off'} · {nf(row.today_sent)} / {nf(row.today_cap)}
                    </span>
                    <span style={{ flexShrink: 0 }}>{pct(row.today_pct, 0)}</span>
                  </div>
                  <Meter value={row.today_sent} max={Math.max(1, row.today_cap)} tone={meterTone(row.health)} />
                  <div style={{ marginTop: 5, fontSize: 10.5, color: T.muted, fontWeight: 600 }}>
                    {nf(row.today_remaining)} left today{row.manual_cap ? ' · manual cap' : ''} · last send {ago(row.last_send_at)}
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(58px, 1fr))', gap: 7 }}>
                  <Ratio k="Deliv" v={pct(row.delivery_rate, 1)} color={h.text} />
                  <Ratio k="Open" v={pct(row.open_rate, 1)} color={h.text} />
                  <Ratio k="Bounce" v={pct(row.bounce_rate, 2)} color={h.text} />
                  <Ratio k="Spam" v={pct(row.complaint_rate, 3)} color={h.text} />
                </div>

                {(Number(row.blocklisted) === 1 || Number(row.ptr_ok) !== 1 || row.status === 'paused' || (row.health !== 'green' && row.health_reason)) && (
                  <div style={{ marginTop: 11, display: 'grid', gap: 5 }}>
                    {Number(row.blocklisted) === 1 && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.red, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <IconAlert size={12} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Blocklisted: {row.blocklist_note || 'see detail'}</span>
                      </div>
                    )}
                    {Number(row.ptr_ok) !== 1 && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.amber, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <IconGlobe size={12} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>PTR mismatch{row.ptr_value ? ` → ${row.ptr_value}` : ''}</span>
                      </div>
                    )}
                    {row.status === 'paused' && row.paused_reason && (
                      <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <IconPause size={12} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.paused_reason}{row.paused_by ? ` — ${row.paused_by}` : ''}</span>
                      </div>
                    )}
                    {row.health !== 'green' && row.health_reason && (
                      <div style={{ fontSize: 11, color: h.text, fontWeight: 600, lineHeight: 1.5 }}>{row.health_reason}</div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card pad={false} style={{ padding: 6 }}>
          <div className="km-tablewrap km-scroll" style={{ maxHeight: '64vh' }}>
            <table className="km-table">
              <thead>
                <tr>
                  {COLS.map((c) => (
                    <th key={c.key} onClick={() => toggleSort(c.key)}
                      style={{ cursor: 'pointer', textAlign: c.right ? 'right' : 'left', userSelect: 'none', color: sort.key === c.key ? T.brand : undefined }}>
                      {c.label}{sort.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                  <th style={{ textAlign: 'right' }}>&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(row.id)}>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, whiteSpace: 'nowrap' }}>
                        <Dot health={row.health} size={8} />{row.ip}
                      </span>
                      <div style={{ fontSize: 10.5, color: T.faint, marginTop: 2 }}>{row.hostname || '—'}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {row.tenant || '—'}
                      {row.label && <div style={{ fontSize: 10.5, color: T.faint, marginTop: 2 }}>{row.label}</div>}
                    </td>
                    <td><HealthPill health={row.health} /></td>
                    <td><Pill tone={row.status === 'active' ? 'green' : row.status === 'paused' ? 'yellow' : 'slate'}>{row.status}</Pill></td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{Number(row.warmup_enabled) === 1 ? nf(row.warmup_day) : '—'}</td>
                    <td style={{ textAlign: 'right', minWidth: 120 }}>
                      <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{nf(row.today_sent)} / {nf(row.today_cap)}</div>
                      <div style={{ marginTop: 4 }}><Meter value={row.today_sent} max={Math.max(1, row.today_cap)} tone={meterTone(row.health)} height={5} /></div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{compact(row.sent)}</td>
                    <td style={{ textAlign: 'right', color: rateTone('delivery', row.delivery_rate) === 'red' ? T.red : T.ink2 }}>{pct(row.delivery_rate, 1)}</td>
                    <td style={{ textAlign: 'right' }}>{pct(row.open_rate, 1)}</td>
                    <td style={{ textAlign: 'right', color: rateTone('bounce', row.bounce_rate) === 'red' ? T.red : T.ink2 }}>{pct(row.bounce_rate, 2)}</td>
                    <td style={{ textAlign: 'right', color: rateTone('complaint', row.complaint_rate) === 'red' ? T.red : T.ink2 }}>{pct(row.complaint_rate, 3)}</td>
                    <td style={{ whiteSpace: 'nowrap', color: T.muted }}>{ago(row.last_send_at)}</td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}><RowMenu items={menuFor(row)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div style={{ height: 20 }} />

      {/* ── add / edit modal ─────────────────────────────────────────── */}
      <Modal open={formOpen} onClose={() => !saving && setFormOpen(false)} width={600}
        title={form.id ? `Edit ${form.ip || 'IP'}` : 'Add a sending IP'}
        subtitle={form.id
          ? 'Changes apply to the next send — messages already queued keep their current settings.'
          : 'The IP must already be routed to the KumoMTA box and have its PTR record published.'}
        footer={<>
          <Btn variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Btn>
          <Btn loading={saving} onClick={save} icon={<IconCheck size={14} />}>{form.id ? 'Save changes' : 'Add IP'}</Btn>
        </>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(191px, 1fr))', gap: '0 16px' }}>
          <Field label="IP address" error={errors.ip} hint="IPv4 only — the address KumoMTA binds to when sending.">
            <input className="km-input" value={form.ip} placeholder="51.79.24.10" inputMode="numeric"
              onChange={(e) => setForm((f) => ({ ...f, ip: e.target.value }))} />
          </Field>
          <Field label="Hostname (HELO / PTR)" error={errors.hostname} hint="e.g. mail1.nitrocampus.com — must match the reverse DNS.">
            <input className="km-input" value={form.hostname} placeholder="mail1.nitrocampus.com"
              onChange={(e) => setForm((f) => ({ ...f, hostname: e.target.value }))} />
          </Field>
          <Field label="Tenant" error={errors.tenant} hint="Must match the KumoMTA pool name exactly, e.g. ip1.">
            <input className="km-input" value={form.tenant} placeholder="ip1"
              onChange={(e) => setForm((f) => ({ ...f, tenant: e.target.value }))} />
          </Field>
          <Field label="Label" hint="Leave blank to use the batch name below.">
            <input className="km-input" value={form.label}
              placeholder={batchLabel(form.batch_no, form.batch_size, form.batch_index)}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
          </Field>
          <Field label="Daily cap override" error={errors.manual_cap} hint="Leave blank to follow the warmup plan.">
            <input className="km-input" value={form.manual_cap} placeholder="Follow warmup plan" inputMode="numeric"
              onChange={(e) => setForm((f) => ({ ...f, manual_cap: e.target.value }))} />
          </Field>
          <Field label="Sort order" error={errors.sort_order} hint="Lower numbers appear first in lists and rotation.">
            <input className="km-input" value={form.sort_order} placeholder="10" inputMode="numeric"
              onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} />
          </Field>
        </div>
        {/* Purchase batch — how you recognise which IPs were bought together. */}
        <div style={{ marginTop: 2, marginBottom: 12, padding: '11px 13px', borderRadius: 13, background: 'rgba(6,182,212,.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9, flexWrap: 'wrap' }}>
            <span className="km-h3">Purchase batch</span>
            <Pill tone="cyan">Name: {batchLabel(form.batch_no, form.batch_size, form.batch_index)}</Pill>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(126px, 1fr))', gap: '0 12px' }}>
            <Field label="Batch no." hint="1 = your first purchase.">
              <input className="km-input" value={form.batch_no} inputMode="numeric" placeholder="1"
                onChange={(e) => setForm((f) => ({ ...f, batch_no: e.target.value }))} />
            </Field>
            <Field label="IPs in batch" hint="How many you bought together.">
              <input className="km-input" value={form.batch_size} inputMode="numeric" placeholder="5"
                onChange={(e) => setForm((f) => ({ ...f, batch_size: e.target.value }))} />
            </Field>
            <Field label="This IP is #" hint="Position inside that batch.">
              <input className="km-input" value={form.batch_index} inputMode="numeric" placeholder="1"
                onChange={(e) => setForm((f) => ({ ...f, batch_index: e.target.value }))} />
            </Field>
            <Field label="Bought on" hint="Date of the OVH order.">
              <input type="date" className="km-input" value={form.purchased_at}
                onChange={(e) => setForm((f) => ({ ...f, purchased_at: e.target.value }))} />
            </Field>
          </div>
        </div>

        <div style={{ marginTop: 4, padding: '12px 14px', borderRadius: 13, background: 'rgba(99,102,241,.06)' }}>
          <Toggle checked={form.warmup_enabled} onChange={(v) => setForm((f) => ({ ...f, warmup_enabled: v }))}
            label="Follow the warmup schedule"
            hint="Ramps the daily cap automatically from day 1. Turn this off only for an IP that is already fully warm." />
        </div>
      </Modal>

      {/* ── pause modal ──────────────────────────────────────────────── */}
      <Modal open={!!pauseRow} onClose={() => !acting && setPauseRow(null)} width={480}
        title={pauseRow ? `Pause ${pauseRow.ip}` : 'Pause IP'}
        subtitle="Campaigns stop selecting this IP until it is resumed. Messages already bound to it still go out."
        footer={<>
          <Btn variant="ghost" onClick={() => setPauseRow(null)} disabled={acting}>Cancel</Btn>
          <Btn variant="danger" loading={acting} onClick={doPause} icon={<IconPause size={14} />}>Pause sending</Btn>
        </>}>
        <Field label="Reason (required)" hint="Stored on the IP so the next operator knows why it is out of rotation.">
          <textarea className="km-textarea" rows={3} value={pauseReason} onChange={(e) => setPauseReason(e.target.value)} />
        </Field>
      </Modal>

      {/* ── retire confirm ───────────────────────────────────────────── */}
      <Confirm open={!!retireRow} onCancel={() => setRetireRow(null)} onConfirm={doRetire} busy={acting}
        title={retireRow ? `Retire ${retireRow.ip}?` : 'Retire IP'} confirmLabel="Retire IP"
        message="Retiring takes the IP out of rotation permanently and resets its warmup progress. Historical stats are kept. Use Pause instead if this is temporary." />

      {/* ── detail drawer ────────────────────────────────────────────── */}
      <IpDrawer open={!!openId} onClose={closeDetail} row={drawerRow} detail={detail} loading={detailLoading}
        range={range} onReload={() => reloadDetail()} onEdit={() => drawerRow && openEdit(drawerRow)} tab={tab} setTab={setTab} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   DETAIL DRAWER
   ══════════════════════════════════════════════════════════════════════════ */
function IpDrawer({ open, onClose, row, detail, loading, range, onReload, onEdit, tab, setTab }) {
  const ip = detail?.ip || row || {};
  const series = detail?.series || [];
  const providers = detail?.providers || [];
  const health = detail?.health || [];
  const blocklists = detail?.blocklists || [];
  const daily = detail?.daily || [];
  const responses = detail?.responses || [];

  const totals = useMemo(() => sumSeries(series), [series]);
  const chart = useMemo(() => series.map((s) => ({
    label: bucketLabel(s.bucket), Sent: Number(s.sent || 0), Delivered: Number(s.delivered || 0),
    Deferred: Number(s.deferred || 0), Bounced: Number(s.bounced || 0),
  })), [series]);
  const warmChart = useMemo(() => daily.slice(-30).map((d) => ({
    label: String(d.day || '').slice(5), Cap: Number(d.cap || 0), Sent: Number(d.sent || 0),
  })), [daily]);

  const h = HEALTH[ip.health] || HEALTH.unknown;
  const listed = blocklists.filter((b) => Number(b.listed) === 1).length;

  return (
    <Drawer open={open} onClose={onClose} width={880}
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}><Dot health={ip.health} />{ip.ip || 'IP detail'}</span>}
      subtitle={ip.ip ? `${ip.hostname || 'no hostname'} · pool ${ip.tenant || '—'} · ${fmtDate(range.from)} → ${fmtDate(range.to)}` : 'Loading…'}
      footer={<>
        <Btn variant="ghost" size="sm" onClick={onReload} loading={loading} icon={<IconRefresh size={14} />}>Refresh</Btn>
        {row && <Btn size="sm" onClick={onEdit} icon={<IconEdit size={14} />}>Edit IP</Btn>}
      </>}>
      {!open ? null : loading && !detail ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <Skel h={72} r={14} /><Skel h={260} r={14} /><Skel h={180} r={14} />
        </div>
      ) : (
        <>
          {/* status strip */}
          <div className="km-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 14 }}>
            {[
              ['Status', <Pill key="s" tone={ip.status === 'active' ? 'green' : ip.status === 'paused' ? 'yellow' : 'slate'}>{ip.status || '—'}</Pill>],
              ['Health', <HealthPill key="h" health={ip.health} />],
              ['Blocklists', <Pill key="b" tone={listed ? 'red' : 'green'}>{listed ? `${listed} listed` : 'Clean'}</Pill>],
              ['Reverse DNS', <Pill key="p" tone={Number(ip.ptr_ok) === 1 ? 'green' : 'red'}>{Number(ip.ptr_ok) === 1 ? 'Matches' : 'Mismatch'}</Pill>],
            ].map(([k, v]) => (
              <div key={k} style={{ padding: '11px 13px', borderRadius: 13, background: 'rgba(15,23,42,.035)', minWidth: 0 }}>
                <div className="km-h3" style={{ fontSize: 10.5, marginBottom: 6 }}>{k}</div>{v}
              </div>
            ))}
          </div>

          {ip.health !== 'green' && ip.health_reason && (
            <div style={{ marginBottom: 14, padding: '11px 13px', borderRadius: 13, background: h.bg, border: `1px solid ${h.ring}`, color: h.text, fontSize: 12.5, fontWeight: 600, lineHeight: 1.6 }}>
              {ip.health_reason}
              {ip.last_health_at && <div style={{ fontSize: 11, opacity: .75, marginTop: 4 }}>Scored {fmtDt(ip.last_health_at)}</div>}
            </div>
          )}
          {ip.status === 'paused' && (
            <div style={{ marginBottom: 14, padding: '11px 13px', borderRadius: 13, background: 'rgba(245,158,11,.1)', color: '#92400e', fontSize: 12.5, fontWeight: 600, lineHeight: 1.6 }}>
              Paused {ip.paused_at ? fmtDt(ip.paused_at) : ''}{ip.paused_by ? ` by ${ip.paused_by}` : ''} — {ip.paused_reason || 'no reason recorded'}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <Tabs value={tab} onChange={setTab} size="sm" tabs={[
              { id: 'perf', label: 'Performance', icon: <IconActivity size={14} /> },
              { id: 'warm', label: 'Warmup', icon: <IconFlame size={14} /> },
              { id: 'health', label: 'Health history', icon: <IconClock size={14} />, count: health.length || undefined },
              { id: 'deliv', label: 'Deliverability', icon: <IconShield size={14} />, count: listed || undefined },
            ]} />
          </div>

          {/* ── PERFORMANCE ─────────────────────────────────────────── */}
          {tab === 'perf' && (
            <div className="km-fade">
              <div className="km-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', marginBottom: 14 }}>
                {[
                  ['Sent', compact(totals.sent), 'slate', <IconSend key="i" size={13} />],
                  ['Delivery', pct(totals.delivery_rate, 1), tileTone('delivery', totals.delivery_rate), <IconCheck key="i" size={13} />],
                  ['Opens', pct(totals.open_rate, 1), tileTone('open', totals.open_rate), <IconOpen key="i" size={13} />],
                  ['Clicks', pct(totals.click_rate, 2), tileTone('click', totals.click_rate), <IconClick key="i" size={13} />],
                  ['Bounce', pct(totals.bounce_rate, 2), tileTone('bounce', totals.bounce_rate), <IconBounce key="i" size={13} />],
                  ['Deferral', pct(totals.deferral_rate, 2), tileTone('deferral', totals.deferral_rate), <IconClock key="i" size={13} />],
                  ['Spam', pct(totals.complaint_rate, 3), tileTone('complaint', totals.complaint_rate), <IconSpam key="i" size={13} />],
                  ['Unsubs', pct(totals.unsub_rate, 2), 'slate', <IconMail key="i" size={13} />],
                ].map(([k, v, tone, icon]) => {
                  const c = { green: '#10b981', amber: '#f59e0b', red: '#ef4444', slate: '#64748b' }[tone] || '#64748b';
                  return (
                    <div key={k} style={{ padding: '10px 12px', borderRadius: 13, background: `${c}12`, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 800, letterSpacing: '.3px', textTransform: 'uppercase', color: c }}>{icon}{k}</div>
                      <div style={{ marginTop: 5, fontSize: 15.5, fontWeight: 800, color: T.ink2 }}>{v}</div>
                    </div>
                  );
                })}
              </div>

              <Card style={{ marginBottom: 14 }}>
                <SectionTitle sub={`Accepted vs failed, ${range.bucket === 'hour' ? 'hour by hour' : 'day by day'}`}>Volume &amp; outcome</SectionTitle>
                <div style={{ height: 260 }}>
                  {chart.length === 0 ? (
                    <Empty title="No sends in this period" sub="Pick a wider date range, or this IP has not been used yet." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chart} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                        <defs>
                          {[['dSent', '#6366f1'], ['dDel', '#10b981'], ['dDef', '#f59e0b'], ['dBou', '#ef4444']].map(([id, c]) => (
                            <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={c} stopOpacity={0.34} />
                              <stop offset="100%" stopColor={c} stopOpacity={0} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 6" stroke="rgba(15,23,42,.08)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={22} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={compact} width={52} />
                        <Tooltip contentStyle={CHART_TOOLTIP} formatter={(v, n) => [nf(v), n]} />
                        <Area type="monotone" dataKey="Sent" stroke="#6366f1" strokeWidth={2.2} fill="url(#dSent)" />
                        <Area type="monotone" dataKey="Delivered" stroke="#10b981" strokeWidth={2} fill="url(#dDel)" />
                        <Area type="monotone" dataKey="Deferred" stroke="#f59e0b" strokeWidth={1.6} fill="url(#dDef)" />
                        <Area type="monotone" dataKey="Bounced" stroke="#ef4444" strokeWidth={1.6} fill="url(#dBou)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>

              <Card>
                <SectionTitle sub="Where this IP's mail actually lands">Mailbox providers</SectionTitle>
                {providers.length === 0 ? <Empty title="No provider data yet" sub="The split appears once this IP has delivered mail." /> : (
                  <div className="km-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(199px, 1fr))', alignItems: 'center' }}>
                    <div style={{ height: 190, minWidth: 0 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={providers.map((p) => ({ name: p.provider, value: Number(p.sent || 0) }))} dataKey="value" nameKey="name"
                            innerRadius={52} outerRadius={80} paddingAngle={3} stroke="none">
                            {providers.map((p, i) => <Cell key={i} fill={PROVIDER_COLORS[p.provider] || '#94a3b8'} />)}
                          </Pie>
                          <Tooltip contentStyle={CHART_TOOLTIP} formatter={(v, n) => [nf(v), n]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="km-tablewrap km-scroll" style={{ maxHeight: 200, minWidth: 0 }}>
                      <table className="km-table">
                        <thead><tr><th>Provider</th><th style={{ textAlign: 'right' }}>Sent</th><th style={{ textAlign: 'right' }}>Deliv</th><th style={{ textAlign: 'right' }}>Bounce</th></tr></thead>
                        <tbody>
                          {providers.map((p) => (
                            <tr key={p.provider}>
                              <td>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700, textTransform: 'capitalize' }}>
                                  <i style={{ width: 8, height: 8, borderRadius: 3, background: PROVIDER_COLORS[p.provider] || '#94a3b8' }} />{p.provider}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{compact(p.sent)}</td>
                              <td style={{ textAlign: 'right' }}>{pct(p.delivery_rate, 1)}</td>
                              <td style={{ textAlign: 'right', color: rateTone('bounce', p.bounce_rate) === 'red' ? T.red : T.ink2 }}>{pct(p.bounce_rate, 2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ── WARMUP ──────────────────────────────────────────────── */}
          {tab === 'warm' && (
            <div className="km-fade">
              <div className="km-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 14 }}>
                {[
                  ['Warmup', Number(ip.warmup_enabled) === 1 ? 'Enabled' : 'Disabled'],
                  ['Day', Number(ip.warmup_enabled) === 1 ? nf(ip.warmup_day) : '—'],
                  ['Started', ip.warmup_started_at ? fmtDate(ip.warmup_started_at) : '—'],
                  ['Cap today', `${nf(ip.today_sent)} / ${nf(ip.today_cap)}`],
                  ['Manual cap', ip.manual_cap ? nf(ip.manual_cap) : 'Plan-driven'],
                  ['Good hours', ip.good_hours || 'Any'],
                ].map(([k, v]) => (
                  <div key={k} style={{ padding: '10px 12px', borderRadius: 13, background: 'rgba(99,102,241,.06)', minWidth: 0 }}>
                    <div className="km-h3" style={{ fontSize: 10.5 }}>{k}</div>
                    <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, color: T.ink2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</div>
                  </div>
                ))}
              </div>

              <Card style={{ marginBottom: 14 }}>
                <SectionTitle sub="How close each day ran to its allowance">Cap vs sent</SectionTitle>
                <div style={{ height: 250 }}>
                  {warmChart.length === 0 ? (
                    <Empty icon={<IconFlame size={20} />} title="No warmup history yet" sub="Run “Refresh warmup” from the toolbar to generate today's cap for this IP." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={warmChart} margin={{ top: 6, right: 6, left: -18, bottom: 0 }} barGap={2}>
                        <CartesianGrid strokeDasharray="3 6" stroke="rgba(15,23,42,.08)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={16} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={compact} width={52} />
                        <Tooltip cursor={{ fill: 'rgba(99,102,241,.06)' }} contentStyle={CHART_TOOLTIP} formatter={(v, n) => [nf(v), n]} />
                        <Bar dataKey="Cap" fill="rgba(99,102,241,.28)" radius={[5, 5, 0, 0]} />
                        <Bar dataKey="Sent" fill="#6366f1" radius={[5, 5, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>

              {daily.length > 0 && (
                <Card pad={false} style={{ padding: 6 }}>
                  <div className="km-tablewrap km-scroll" style={{ maxHeight: 320 }}>
                    <table className="km-table">
                      <thead>
                        <tr>
                          <th>Day</th><th style={{ textAlign: 'right' }}>Warmup day</th><th style={{ textAlign: 'right' }}>Cap</th>
                          <th style={{ textAlign: 'right' }}>Sent</th><th style={{ minWidth: 130 }}>Usage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {daily.slice(-30).slice().reverse().map((d) => {
                          const used = rate(d.sent, d.cap);
                          return (
                            <tr key={d.day}>
                              <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtDate(d.day)}</td>
                              <td style={{ textAlign: 'right' }}>{d.warmup_day ? nf(d.warmup_day) : '—'}</td>
                              <td style={{ textAlign: 'right' }}>{nf(d.cap)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{nf(d.sent)}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ flex: 1, minWidth: 60 }}>
                                    <Meter value={d.sent} max={Math.max(1, d.cap)} tone={used > 100 ? 'red' : used > 95 ? 'amber' : 'indigo'} height={6} />
                                  </div>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, width: 40, textAlign: 'right' }}>{pct(used, 0)}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ── HEALTH HISTORY ──────────────────────────────────────── */}
          {tab === 'health' && (
            <div className="km-fade">
              {health.length === 0 ? (
                <Card><Empty icon={<IconActivity size={20} />} title="No health checks recorded" sub="Run “Re-score health” from the toolbar to take the first reading." /></Card>
              ) : (
                <div style={{ position: 'relative', paddingLeft: 22 }}>
                  <div style={{ position: 'absolute', left: 6, top: 6, bottom: 6, width: 2, borderRadius: 2, background: 'linear-gradient(180deg, rgba(99,102,241,.35), rgba(99,102,241,.05))' }} />
                  <div style={{ display: 'grid', gap: 10 }}>
                    {health.map((e, i) => {
                      const c = HEALTH[e.color] || HEALTH.unknown;
                      const reasons = asList(e.reasons);
                      return (
                        <div key={i} className="km-card" style={{ padding: '12px 14px', background: 'rgba(255,255,255,.72)', borderLeft: `3px solid ${c.dot}`, position: 'relative' }}>
                          <span style={{ position: 'absolute', left: -21, top: 17, width: 10, height: 10, borderRadius: '50%', background: c.dot, boxShadow: `0 0 0 4px ${c.ring}` }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                              <HealthPill health={e.color} pulse={false} />
                              <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink2 }}>{fmtDt(e.checked_at)}</span>
                            </div>
                            <span style={{ fontSize: 11.5, color: T.muted, fontWeight: 600 }}>{nf(e.sent_24h)} sent in 24h · {ago(e.checked_at)}</span>
                          </div>
                          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(84px, 1fr))', gap: 7 }}>
                            <Ratio k="Deliv" v={pct(e.delivery_rate, 1)} color={c.text} />
                            <Ratio k="Bounce" v={pct(e.bounce_rate, 2)} color={c.text} />
                            <Ratio k="Defer" v={pct(e.deferral_rate, 2)} color={c.text} />
                            <Ratio k="Spam" v={pct(e.complaint_rate, 3)} color={c.text} />
                          </div>
                          {reasons.length > 0 && (
                            <ul style={{ margin: '10px 0 0', paddingLeft: 17, fontSize: 11.8, color: T.muted, lineHeight: 1.7 }}>
                              {reasons.map((r, j) => <li key={j}>{r}</li>)}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── DELIVERABILITY ──────────────────────────────────────── */}
          {tab === 'deliv' && (
            <div className="km-fade" style={{ display: 'grid', gap: 14 }}>
              <Card>
                <SectionTitle sub={`${nf(blocklists.length)} zone${blocklists.length === 1 ? '' : 's'} probed`}
                  right={<Pill tone={listed ? 'red' : 'green'} pulse={listed > 0}>{listed ? `${listed} listing${listed === 1 ? '' : 's'}` : 'All clean'}</Pill>}>
                  Blocklists
                </SectionTitle>
                {blocklists.length === 0 ? (
                  <Empty icon={<IconShield size={20} />} title="Never probed" sub="Run “Check blocklists” from the toolbar to query every DNSBL for this IP." />
                ) : (
                  <div className="km-tablewrap km-scroll" style={{ maxHeight: 280 }}>
                    <table className="km-table">
                      <thead><tr><th>Zone</th><th>Result</th><th>Response</th><th>Checked</th></tr></thead>
                      <tbody>
                        {blocklists.map((b, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 700, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5 }}>{b.zone}</td>
                            <td><Pill tone={Number(b.listed) === 1 ? 'red' : 'green'}>{Number(b.listed) === 1 ? 'Listed' : 'Clean'}</Pill></td>
                            <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.response}>{b.response || '—'}</td>
                            <td style={{ whiteSpace: 'nowrap', color: T.muted }}>{ago(b.checked_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {ip.blocklist_note && (
                  <div style={{ marginTop: 10, padding: '9px 11px', borderRadius: 11, background: 'rgba(239,68,68,.07)', color: T.red, fontSize: 11.8, fontWeight: 600, lineHeight: 1.6 }}>
                    {ip.blocklist_note}
                  </div>
                )}
              </Card>

              <Card>
                <SectionTitle sub="The PTR record must resolve back to the HELO hostname, or Gmail and Outlook throttle the IP"
                  right={<Pill tone={Number(ip.ptr_ok) === 1 ? 'green' : 'red'}>{Number(ip.ptr_ok) === 1 ? 'Matching' : 'Mismatch'}</Pill>}>
                  Reverse DNS
                </SectionTitle>
                <div className="km-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(174px, 1fr))' }}>
                  {[['Configured hostname', ip.hostname || '—'], ['PTR resolves to', ip.ptr_value || 'no PTR published']].map(([k, v]) => (
                    <div key={k} style={{ padding: '11px 13px', borderRadius: 13, background: 'rgba(15,23,42,.035)', minWidth: 0 }}>
                      <div className="km-h3" style={{ fontSize: 10.5 }}>{k}</div>
                      <div style={{ marginTop: 5, fontSize: 12.8, fontWeight: 700, color: T.ink2, fontFamily: 'ui-monospace, Menlo, monospace', wordBreak: 'break-all' }}>{v}</div>
                    </div>
                  ))}
                </div>
                {Number(ip.ptr_ok) !== 1 && (
                  <div style={{ marginTop: 11, padding: '9px 11px', borderRadius: 11, background: 'rgba(245,158,11,.1)', color: '#92400e', fontSize: 11.8, fontWeight: 600, lineHeight: 1.6 }}>
                    Ask OVH to set the reverse DNS for {ip.ip || 'this IP'} to {ip.hostname || 'the configured hostname'}, and make sure that hostname has a forward A record pointing back.
                  </div>
                )}
                {ip.last_health_at && <div style={{ marginTop: 9, fontSize: 11, color: T.faint, fontWeight: 600 }}>Last probed {fmtDt(ip.last_health_at)}</div>}
              </Card>

              <Card>
                <SectionTitle sub="Grouped bounce, deferral and complaint responses in this range">What the providers replied</SectionTitle>
                {responses.length === 0 ? (
                  <Empty icon={<IconCheck size={20} />} title="No failure responses" sub="Every message this IP sent was accepted in this period." />
                ) : (
                  <div className="km-tablewrap km-scroll" style={{ maxHeight: 320 }}>
                    <table className="km-table">
                      <thead><tr><th>Type</th><th>Code</th><th>Response</th><th style={{ textAlign: 'right' }}>Count</th></tr></thead>
                      <tbody>
                        {responses.map((r, i) => (
                          <tr key={i}>
                            <td><Pill tone={r.type === 'bounce' ? 'red' : r.type === 'complaint' ? 'yellow' : 'slate'}>{r.type}</Pill></td>
                            <td style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5 }}>{r.code || '—'}</td>
                            <td style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.message}>{r.message || '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>{nf(r.count)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
