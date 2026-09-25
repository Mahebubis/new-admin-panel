/*
 * KumoMTA — Overview dashboard.
 *
 * Everything an operator needs on one screen: throughput, the four ratios that
 * decide deliverability, per-IP health with today's warmup quota, bridge/API
 * health, mailbox-provider split, the live queue, open alerts and the SMTP
 * responses that are actually being returned right now.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  KumoStyles, kapi, usePolling, resolveRange, RangePicker, Card, StatTile, Btn, Pill, HealthPill,
  Meter, Empty, Skel, Spinner, T, HEALTH, nf, compact, pct, fmtDt, ago, rateTone,
  IconRefresh, IconServer, IconMail, IconOpen, IconClick, IconBounce, IconSpam, IconBolt,
  IconClock, IconAlert, IconCheck, IconGlobe, IconSend, IconEye, IconActivity,
} from './kumoShared';

const PROVIDER_COLORS = { gmail: '#ef4444', outlook: '#0ea5e9', yahoo: '#8b5cf6', apple: '#64748b', rediff: '#f59e0b', other: '#10b981' };

export default function KumoDashboard() {
  const nav = useNavigate();
  const [range, setRange] = useState(() => ({ id: '30d', ...resolveRange('30d') }));
  const [busy, setBusy] = useState('');

  const { data, loading, error, reload } = usePolling(
    () => kapi('dashboard', { from: range.from, to: range.to, bucket: range.bucket }),
    [range.from, range.to, range.bucket],
    60000
  );

  const o = data?.overview || {};
  const ips = data?.ips || [];
  const series = data?.series || [];
  const providers = data?.providers || [];
  const api = data?.api_health || {};
  const queue = data?.queue || {};
  const alerts = data?.alerts || [];
  const audience = data?.audience || {};

  const spark = useMemo(() => series.map((s) => s.sent), [series]);
  const healthCounts = useMemo(() => {
    const c = { green: 0, yellow: 0, red: 0, unknown: 0 };
    ips.forEach((i) => { c[i.health] = (c[i.health] || 0) + 1; });
    return c;
  }, [ips]);

  const run = async (action, label) => {
    setBusy(action);
    try {
      await kapi(action);
      toast.success(label);
      reload(true);
    } catch (e) { toast.error(e.message); }
    finally { setBusy(''); }
  };

  const chartData = useMemo(() => series.map((s) => ({
    label: String(s.bucket).slice(5).replace('T', ' '),
    Sent: s.sent, Delivered: s.delivered, Bounced: s.bounced, Deferred: s.deferred,
    Opens: s.opens, Clicks: s.clicks,
  })), [series]);

  return (
    <div className="km km-page">
      <KumoStyles />

      {/* ── header ─────────────────────────────────────────────────────── */}
      <div className="km-head">
        <div>
          <h1 className="km-h1">Sending overview</h1>
          <div className="km-sub">
            Live health of your own mail platform · {nf(ips.length)} IP{ips.length === 1 ? '' : 's'} ·
            {' '}server time {data?.server_time ? fmtDt(data.server_time) : '—'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <RangePicker value={range} onChange={(r) => setRange({ ...r, ...resolveRange(r.id, r.from, r.to) })} />
          <Btn variant="ghost" size="sm" loading={busy === 'health_run'} onClick={() => run('health_run', 'Health recalculated')} icon={<IconActivity size={14} />}>Re-score</Btn>
          <Btn variant="ghost" size="sm" loading={busy === 'api_probe'} onClick={() => run('api_probe', 'Bridge probed')} icon={<IconBolt size={14} />}>Probe bridge</Btn>
          <Btn size="sm" loading={loading} onClick={() => reload()} icon={<IconRefresh size={14} />}>Refresh</Btn>
        </div>
      </div>

      {error && (
        <Card style={{ marginBottom: 12, borderLeft: `4px solid ${T.red}` }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: T.red, fontWeight: 600, fontSize: 13 }}>
            <IconAlert size={16} /> {error}
          </div>
        </Card>
      )}

      {/* ── KPI row ────────────────────────────────────────────────────── */}
      <div className="km-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))', marginBottom: 16 }}>
        <StatTile label="Sent" value={o.sent} format={compact} tone="indigo" icon={<IconSend size={15} />} spark={spark} loading={loading}
          sub={`${nf(o.sent)} messages`} />
        <StatTile label="Delivered" value={o.delivery_rate} format={(v) => pct(v, 1)} tone="green" icon={<IconCheck size={15} />} loading={loading}
          sub={`${nf(o.delivered)} accepted`} />
        <StatTile label="Open rate" value={o.open_rate} format={(v) => pct(v, 1)} tone="cyan" icon={<IconOpen size={15} />} loading={loading}
          sub={`${nf(o.opens)} opens`} />
        <StatTile label="Click rate" value={o.click_rate} format={(v) => pct(v, 1)} tone="indigo" icon={<IconClick size={15} />} loading={loading}
          sub={`${nf(o.clicks)} clicks · CTOR ${pct(o.ctor, 1)}`} />
        <StatTile label="Bounce rate" value={o.bounce_rate} format={(v) => pct(v, 2)} tone={rateTone('bounce', o.bounce_rate) === 'green' ? 'green' : rateTone('bounce', o.bounce_rate) === 'yellow' ? 'amber' : 'red'}
          icon={<IconBounce size={15} />} loading={loading} sub={`${nf(o.bounced)} bounced`} />
        <StatTile label="Spam rate" value={o.complaint_rate} format={(v) => pct(v, 3)} tone={rateTone('complaint', o.complaint_rate) === 'green' ? 'green' : rateTone('complaint', o.complaint_rate) === 'yellow' ? 'amber' : 'red'}
          icon={<IconSpam size={15} />} loading={loading} sub={`${nf(o.complaints)} complaints · limit 0.1%`} />
        <StatTile label="Deferrals" value={o.deferral_rate} format={(v) => pct(v, 2)} tone={rateTone('deferral', o.deferral_rate) === 'green' ? 'green' : rateTone('deferral', o.deferral_rate) === 'yellow' ? 'amber' : 'red'}
          icon={<IconClock size={15} />} loading={loading} sub={`${nf(o.deferred)} retried`} />
        <StatTile label="Unsubscribes" value={o.unsub_rate} format={(v) => pct(v, 2)} tone="slate" icon={<IconMail size={15} />} loading={loading}
          sub={`${nf(o.unsubs)} opted out`} />
      </div>

      {/* ── main grid ──────────────────────────────────────────────────── */}
      <div className="km-grid" style={{ gridTemplateColumns: 'minmax(0, 2.1fr) minmax(0, 1fr)', alignItems: 'start' }}>
        {/* volume chart */}
        <Card style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h2 className="km-h2">Sending volume</h2>
              <div className="km-sub">Accepted vs bounced vs deferred, {range.bucket === 'hour' ? 'hour by hour' : 'day by day'}</div>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 11.5, fontWeight: 700, color: T.muted }}>
              <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: '#6366f1', marginRight: 5 }} />Sent</span>
              <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: '#10b981', marginRight: 5 }} />Delivered</span>
              <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: '#f59e0b', marginRight: 5 }} />Deferred</span>
              <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: '#ef4444', marginRight: 5 }} />Bounced</span>
            </div>
          </div>
          <div style={{ height: 286 }}>
            {loading && !series.length ? <Skel h={286} r={14} /> : chartData.length === 0 ? (
              <Empty title="No sends in this period" sub="Once a campaign goes out, volume and delivery appear here." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                  <defs>
                    {[['gSent', '#6366f1'], ['gDel', '#10b981'], ['gDef', '#f59e0b'], ['gBou', '#ef4444']].map(([id, c]) => (
                      <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={c} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 6" stroke="rgba(15,23,42,.08)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={22} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={compact} width={52} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(15,23,42,.08)', boxShadow: '0 18px 40px -20px rgba(15,23,42,.5)', fontSize: 12 }}
                    formatter={(v, n) => [nf(v), n]} />
                  <Area type="monotone" dataKey="Sent" stroke="#6366f1" strokeWidth={2.2} fill="url(#gSent)" />
                  <Area type="monotone" dataKey="Delivered" stroke="#10b981" strokeWidth={2} fill="url(#gDel)" />
                  <Area type="monotone" dataKey="Deferred" stroke="#f59e0b" strokeWidth={1.6} fill="url(#gDef)" />
                  <Area type="monotone" dataKey="Bounced" stroke="#ef4444" strokeWidth={1.6} fill="url(#gBou)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* right column: bridge + queue + warmup */}
        <div className="km-grid" style={{ gridTemplateColumns: '1fr' }}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h2 className="km-h2">Bridge &amp; API health</h2>
                <div className="km-sub">KumoMTA injection endpoint</div>
              </div>
              <Pill tone={api?.latest?.ok ? 'green' : 'red'} pulse={!api?.latest?.ok}>{api?.latest?.ok ? 'Online' : 'Offline'}</Pill>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
              {[
                ['Latency', api?.latest ? `${nf(api.latest.latency_ms)} ms` : '—'],
                ['Uptime 24h', api?.uptime_24h !== null && api?.uptime_24h !== undefined ? `${api.uptime_24h}%` : '—'],
                ['In queue', nf(api?.latest?.queue_size || 0)],
              ].map(([k, v]) => (
                <div key={k} style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(99,102,241,.06)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: T.faint }}>{k}</div>
                  <div style={{ marginTop: 4, fontSize: 15.5, fontWeight: 800, color: T.ink2 }}>{v}</div>
                </div>
              ))}
            </div>
            {api?.history?.length > 1 && (
              <div style={{ height: 58 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={api.history.map((h) => ({ ms: h.latency_ms, ok: h.ok }))} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <Tooltip cursor={{ fill: 'rgba(99,102,241,.06)' }} contentStyle={{ borderRadius: 10, fontSize: 11.5, border: '1px solid rgba(15,23,42,.08)' }}
                      formatter={(v) => [`${v} ms`, 'Latency']} labelFormatter={() => ''} />
                    <Bar dataKey="ms" radius={[4, 4, 0, 0]}>
                      {api.history.map((h, i) => <Cell key={i} fill={h.ok ? '#6366f1' : '#ef4444'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {api?.latest?.error && (
              <div style={{ marginTop: 10, fontSize: 11.5, color: T.red, background: 'rgba(239,68,68,.07)', padding: '8px 10px', borderRadius: 10 }}>
                {api.latest.error}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="km-h2" style={{ marginBottom: 12 }}>Queue right now</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                ['Waiting to send', queue.pending, 'indigo'],
                ['In flight', queue.processing, 'cyan'],
                ['Running campaigns', queue.running_campaigns, 'green'],
                ['Scheduled', queue.scheduled_campaigns, 'slate'],
              ].map(([label, v, tone]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, color: T.muted, fontWeight: 600 }}>{label}</span>
                  <Pill tone={tone}>{nf(v || 0)}</Pill>
                </div>
              ))}
              {queue.next_scheduled_at && (
                <div style={{ fontSize: 11.5, color: T.muted, borderTop: `1px solid ${T.line}`, paddingTop: 9 }}>
                  Next scheduled run {fmtDt(queue.next_scheduled_at)}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="km-h2" style={{ marginBottom: 10 }}>Audience</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
              {[
                ['Contacts', audience.contacts, 'indigo'],
                ['Sendable', audience.active, 'green'],
                ['Blocklisted', audience.blocklisted, 'red'],
                ['Lists', audience.lists, 'cyan'],
                ['Segments', audience.segments, 'slate'],
                ['Templates', audience.templates, 'slate'],
              ].map(([k, v, tone]) => (
                <div key={k} style={{ padding: '9px 11px', borderRadius: 11, background: 'rgba(15,23,42,.035)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: T.faint }}>{k}</div>
                  <div style={{ marginTop: 3, fontSize: 15, fontWeight: 800, color: T.ink2 }}>{compact(v || 0)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ── IP health strip ────────────────────────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 className="km-h2">IP health &amp; warmup</h2>
            <Pill tone="green">{healthCounts.green} healthy</Pill>
            {healthCounts.yellow > 0 && <Pill tone="yellow">{healthCounts.yellow} watch</Pill>}
            {healthCounts.red > 0 && <Pill tone="red" pulse>{healthCounts.red} critical</Pill>}
          </div>
          <Btn variant="ghost" size="sm" onClick={() => nav('/kumo/ips')} icon={<IconServer size={14} />}>Manage IPs</Btn>
        </div>

        {loading && !ips.length ? (
          <div className="km-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(224px, 1fr))' }}>
            {[0, 1, 2, 3, 4].map((i) => <Skel key={i} h={168} r={18} />)}
          </div>
        ) : ips.length === 0 ? (
          <Card><Empty title="No sending IPs yet" sub="Add the IPs you bought from OVH so campaigns have somewhere to send from."
            action={<Btn onClick={() => nav('/kumo/ips')}>Add your first IP</Btn>} /></Card>
        ) : (
          <div className="km-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(226px, 1fr))' }}>
            {ips.map((ip) => {
              const h = HEALTH[ip.health] || HEALTH.unknown;
              return (
                <Card key={ip.id} hover className="km-fade" style={{ background: h.bg, borderColor: h.ring, cursor: 'pointer' }}
                  onClick={() => nav(`/kumo/ips?open=${ip.id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: h.dot, boxShadow: `0 0 0 4px ${h.ring}`, flexShrink: 0 }} />
                        <span style={{ fontWeight: 800, fontSize: 14.5, color: T.ink, letterSpacing: '-.2px' }}>{ip.ip}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: h.text, fontWeight: 600, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ip.hostname || ip.tenant}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                      <HealthPill health={ip.health} />
                      {ip.status !== 'active' && <Pill tone="slate">{ip.status}</Pill>}
                    </div>
                  </div>

                  <div style={{ marginTop: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 700, color: h.text, marginBottom: 5 }}>
                      <span>Day {ip.warmup_day} · {nf(ip.today_sent)} / {nf(ip.today_cap)}</span>
                      <span>{ip.today_pct}%</span>
                    </div>
                    <Meter value={ip.today_sent} max={Math.max(1, ip.today_cap)}
                      tone={ip.health === 'red' ? 'red' : ip.health === 'yellow' ? 'amber' : 'green'} />
                  </div>

                  <div style={{ marginTop: 13, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7 }}>
                    {[
                      ['Deliv', pct(ip.delivery_rate, 1)],
                      ['Open', pct(ip.open_rate, 1)],
                      ['Bounce', pct(ip.bounce_rate, 2)],
                      ['Spam', pct(ip.complaint_rate, 3)],
                    ].map(([k, v]) => (
                      <div key={k} style={{ textAlign: 'center', padding: '6px 2px', borderRadius: 9, background: 'rgba(255,255,255,.55)' }}>
                        <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.3px', textTransform: 'uppercase', color: h.text, opacity: .75 }}>{k}</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: T.ink2, marginTop: 2 }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {(ip.blocklisted === 1 || ip.ptr_ok !== 1) && (
                    <div style={{ marginTop: 11, fontSize: 11, fontWeight: 700, color: T.red, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <IconAlert size={12} />
                      {ip.blocklisted === 1 ? `Blocklisted: ${ip.blocklist_note || 'see detail'}` : 'Reverse DNS mismatch'}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── bottom grid: providers · alerts · responses · campaigns ────── */}
      <div className="km-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', marginTop: 16 }}>
        <Card>
          <h2 className="km-h2" style={{ marginBottom: 10 }}>Mailbox providers</h2>
          {providers.length === 0 ? <Empty title="No data yet" sub="Provider split appears after the first campaign." /> : (
            <>
              <div style={{ height: 178 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={providers.map((p) => ({ name: p.provider, value: p.sent }))} dataKey="value" nameKey="name"
                      innerRadius={52} outerRadius={78} paddingAngle={3} stroke="none">
                      {providers.map((p, i) => <Cell key={i} fill={PROVIDER_COLORS[p.provider] || '#94a3b8'} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [nf(v), n]} contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid rgba(15,23,42,.08)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="km-tablewrap km-scroll" style={{ maxHeight: 186 }}>
                <table className="km-table">
                  <thead><tr><th>Provider</th><th style={{ textAlign: 'right' }}>Sent</th><th style={{ textAlign: 'right' }}>Deliv</th><th style={{ textAlign: 'right' }}>Open</th><th style={{ textAlign: 'right' }}>Bounce</th></tr></thead>
                  <tbody>
                    {providers.map((p) => (
                      <tr key={p.provider}>
                        <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700, textTransform: 'capitalize' }}>
                          <i style={{ width: 8, height: 8, borderRadius: 3, background: PROVIDER_COLORS[p.provider] || '#94a3b8' }} />{p.provider}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{compact(p.sent)}</td>
                        <td style={{ textAlign: 'right' }}>{pct(p.delivery_rate, 1)}</td>
                        <td style={{ textAlign: 'right' }}>{pct(p.open_rate, 1)}</td>
                        <td style={{ textAlign: 'right', color: p.bounce_rate >= 2 ? T.red : T.ink2 }}>{pct(p.bounce_rate, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h2 className="km-h2">Open alerts</h2>
            {alerts.length > 0 && (
              <Btn variant="ghost" size="sm" onClick={() => run('alert_ack', 'All alerts acknowledged')} loading={busy === 'alert_ack'}>Acknowledge all</Btn>
            )}
          </div>
          {alerts.length === 0 ? <Empty icon={<IconCheck size={20} />} title="All clear" sub="No open alerts — every IP is behaving." /> : (
            <div style={{ display: 'grid', gap: 9 }}>
              {alerts.map((a) => (
                <div key={a.id} style={{ padding: '10px 12px', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'flex-start',
                  background: a.level === 'critical' ? 'rgba(239,68,68,.07)' : a.level === 'warn' ? 'rgba(245,158,11,.08)' : 'rgba(99,102,241,.06)' }}>
                  <span style={{ marginTop: 2, color: a.level === 'critical' ? T.red : a.level === 'warn' ? T.amber : T.brand }}><IconAlert size={14} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.8, fontWeight: 700, color: T.ink2 }}>{a.title}</div>
                    {a.body && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3, lineHeight: 1.55 }}>{a.body}</div>}
                    <div style={{ fontSize: 10.5, color: T.faint, marginTop: 4, fontWeight: 600 }}>{ago(a.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="km-h2" style={{ marginBottom: 10 }}>What the mailbox providers are saying</h2>
          {(data?.responses || []).length === 0 ? <Empty title="No failures recorded" sub="Bounce, deferral and complaint responses will be grouped here." /> : (
            <div className="km-tablewrap km-scroll" style={{ maxHeight: 250 }}>
              <table className="km-table">
                <thead><tr><th>Type</th><th>Code</th><th>Response</th><th style={{ textAlign: 'right' }}>Count</th></tr></thead>
                <tbody>
                  {data.responses.map((r, i) => (
                    <tr key={i}>
                      <td><Pill tone={r.type === 'bounce' ? 'red' : r.type === 'complaint' ? 'yellow' : 'slate'}>{r.type}</Pill></td>
                      <td style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5 }}>{r.code || '—'}</td>
                      <td style={{ maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.message}>{r.message || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>{nf(r.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h2 className="km-h2">Recent campaigns</h2>
            <Btn variant="ghost" size="sm" onClick={() => nav('/kumo/campaigns')}>View all</Btn>
          </div>
          {(data?.campaigns || []).length === 0 ? (
            <Empty title="No campaigns yet" sub="Create one to start sending from your own IPs."
              action={<Btn onClick={() => nav('/kumo/campaigns?new=1')} icon={<IconSend size={14} />}>New campaign</Btn>} />
          ) : (
            <div style={{ display: 'grid', gap: 9 }}>
              {data.campaigns.map((c) => (
                <div key={c.id} onClick={() => nav(`/kumo/campaigns/${c.id}`)} className="km-card km-card--hover"
                  style={{ padding: '11px 13px', cursor: 'pointer', background: 'rgba(255,255,255,.65)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>
                        {nf(c.sent)} sent · {pct(c.open_rate, 1)} open · {pct(c.click_rate, 1)} click
                      </div>
                    </div>
                    <Pill tone={c.status === 'sent' ? 'green' : c.status === 'running' ? 'indigo' : c.status === 'failed' ? 'red' : 'slate'}
                      pulse={c.status === 'running'}>{c.status}</Pill>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div style={{ height: 20 }} />
    </div>
  );
}
