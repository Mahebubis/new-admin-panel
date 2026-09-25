/*
 * KumoMTA — Campaign report.
 *
 * What actually happened after the send button: the eight headline ratios, the
 * delivery/open/click/bounce curve over time, how each sending IP and each
 * mailbox provider behaved, the raw SMTP responses we got back, and a
 * per-recipient explorer for when someone asks "did Rahul get it?".
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  KumoStyles, kapi, usePolling, useDebounced, Card, StatTile, Btn, Pill, Meter, Empty, Skel,
  Tabs, SearchInput, Pagination, T, nf, compact, pct, fmtDt, ago, rateTone,
  IconRefresh, IconEdit, IconCopy, IconPause, IconPlay, IconAlert, IconSend, IconCheck, IconOpen,
  IconClick, IconBounce, IconSpam, IconMail, IconUsers, IconServer, IconGlobe, IconEye,
} from './kumoShared';

const STATUS_TONE = { draft: 'slate', scheduled: 'cyan', running: 'indigo', paused: 'yellow', sent: 'green', failed: 'red' };

const SERIES_META = {
  send: ['Sent', '#8b5cf6'], sent: ['Sent', '#8b5cf6'],
  delivery: ['Delivered', '#10b981'], delivered: ['Delivered', '#10b981'],
  open: ['Opens', '#06b6d4'], opens: ['Opens', '#06b6d4'],
  click: ['Clicks', '#6366f1'], clicks: ['Clicks', '#6366f1'],
  bounce: ['Bounces', '#ef4444'], bounced: ['Bounces', '#ef4444'],
  complaint: ['Spam', '#f59e0b'], unsub: ['Unsubs', '#94a3b8'], deferral: ['Deferrals', '#f97316'],
};
const metaFor = (type) => SERIES_META[String(type || '').toLowerCase()] || [String(type || 'Other'), '#94a3b8'];

const ROW_TONE = {
  delivered: 'green', sent: 'indigo', opened: 'cyan', clicked: 'cyan',
  bounced: 'red', failed: 'red', skipped: 'slate', pending: 'slate', queued: 'slate',
};

const PAGE_CSS = `
.kmr-charts { display:grid; grid-template-columns:minmax(0,1.6fr) minmax(0,1fr); gap:16px; align-items:start; }
.kmr-tables { display:grid; grid-template-columns:repeat(auto-fit,minmax(282px,1fr)); gap:16px; }
@media (max-width: 1040px) { .kmr-charts { grid-template-columns:minmax(0,1fr); } }
.kmr-mono { font-family:ui-monospace, Menlo, Consolas, monospace; font-size:11.5px; }
.kmr-trunc { max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
`;

export default function KumoCampaignReport() {
  const nav = useNavigate();
  const { id } = useParams();
  const [pollMs, setPollMs] = useState(0);
  const [busy, setBusy] = useState('');

  const { data, loading, error, reload } = usePolling(
    () => kapi('campaign_report', { id }), [id], pollMs
  );

  const c = data?.campaign || {};
  const byIp = data?.by_ip || [];
  const byProvider = data?.by_provider || [];
  const timeline = data?.timeline || [];
  const responses = data?.responses || [];

  useEffect(() => { setPollMs(c.status === 'running' ? 20000 : 0); }, [c.status]);

  /* ── recipients explorer ────────────────────────────────────────────── */
  const [rStatus, setRStatus] = useState('all');
  const [rSearch, setRSearch] = useState('');
  const dRSearch = useDebounced(rSearch, 350);
  const [rPage, setRPage] = useState(1);
  const [rPer, setRPer] = useState(25);

  const rec = usePolling(
    () => kapi('campaign_recipients', {
      id, page: rPage, per_page: rPer, status: rStatus === 'all' ? '' : rStatus, search: dRSearch,
    }),
    [id, rPage, rPer, rStatus, dRSearch],
    0
  );
  const rows = rec.data?.rows || [];
  const rTotal = Number(rec.data?.total || 0);

  /* ── derived numbers ────────────────────────────────────────────────── */
  const m = useMemo(() => {
    const sent = Number(c.sent || 0);
    const delivered = Number(c.delivered || 0);
    const base = delivered || sent || 0;
    const uOpen = Number(c.unique_opens || 0);
    const uClick = Number(c.unique_clicks || 0);
    return {
      sent, delivered,
      openRate: base > 0 ? (uOpen / base) * 100 : Number(c.open_rate || 0),
      clickRate: base > 0 ? (uClick / base) * 100 : Number(c.click_rate || 0),
      deliveryRate: Number(c.delivery_rate ?? (sent > 0 ? (delivered / sent) * 100 : 0)),
      bounceRate: Number(c.bounce_rate || 0),
      complaintRate: Number(c.complaint_rate || 0),
    };
  }, [c]);

  const { chartRows, seriesKeys } = useMemo(() => {
    const map = new Map();
    const keys = [];
    timeline.forEach((t) => {
      const [label, color] = metaFor(t.type);
      if (!keys.some((k) => k.key === label)) keys.push({ key: label, color });
      const bucket = String(t.bucket || '');
      if (!map.has(bucket)) map.set(bucket, { label: bucket.slice(5).replace('T', ' ') });
      const row = map.get(bucket);
      row[label] = (row[label] || 0) + Number(t.count || 0);
    });
    const list = Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, v]) => v);
    list.forEach((row) => keys.forEach((k) => { if (row[k.key] === undefined) row[k.key] = 0; }));
    return { chartRows: list, seriesKeys: keys };
  }, [timeline]);

  const ipChart = useMemo(() => byIp.map((r) => ({
    label: r.ip || r.tenant || `#${r.ip_id}`,
    Sent: Number(r.sent || 0), Delivered: Number(r.delivered || 0), Bounced: Number(r.bounced || 0),
  })), [byIp]);

  const act = async (action, label) => {
    setBusy(action);
    try {
      const d = await kapi(action, { id });
      toast.success(label);
      if (action === 'campaign_duplicate' && d?.id) nav(`/kumo/campaigns/${d.id}/edit`);
      else reload(true);
    } catch (e) { toast.error(e.message || 'Action failed'); }
    finally { setBusy(''); }
  };

  const totalRec = Number(c.total_recipients || 0);
  const progress = totalRec > 0 ? Math.min(100, (m.sent / totalRec) * 100) : 0;

  if (loading && !data) {
    return (
      <div className="km km-page">
        <KumoStyles />
        <Skel h={70} r={16} style={{ marginBottom: 16 }} />
        <div className="km-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(148px,1fr))', marginBottom: 16 }}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skel key={i} h={104} r={18} />)}
        </div>
        <Skel h={320} r={18} />
      </div>
    );
  }

  return (
    <div className="km">
      <KumoStyles />
      <style>{PAGE_CSS}</style>

      {/* ── header ─────────────────────────────────────────────────────── */}
      <div className="km-head">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="km-h1" style={{ wordBreak: 'break-word' }}>{c.name || `Campaign #${id}`}</h1>
            <Pill tone={STATUS_TONE[c.status] || 'slate'} pulse={c.status === 'running'}>{c.status || 'unknown'}</Pill>
          </div>
          <div className="km-sub">
            {c.subject ? `“${c.subject}” · ` : ''}
            {c.completed_at ? `finished ${fmtDt(c.completed_at)}`
              : c.started_at ? `started ${ago(c.started_at)}`
                : c.scheduled_at ? `scheduled ${fmtDt(c.scheduled_at)}`
                  : `created ${fmtDt(c.created_at)}`}
            {c.status === 'running' ? ' · live, refreshing every 20s' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant="ghost" size="sm" onClick={() => nav('/kumo/campaigns')}>All campaigns</Btn>
          {c.status === 'running' && (
            <Btn variant="ghost" size="sm" loading={busy === 'campaign_pause'} onClick={() => act('campaign_pause', 'Campaign paused')} icon={<IconPause size={14} />}>Pause</Btn>
          )}
          {c.status === 'paused' && (
            <Btn variant="success" size="sm" loading={busy === 'campaign_resume'} onClick={() => act('campaign_resume', 'Campaign resumed')} icon={<IconPlay size={14} />}>Resume</Btn>
          )}
          <Btn variant="ghost" size="sm" loading={busy === 'campaign_duplicate'} onClick={() => act('campaign_duplicate', 'Campaign duplicated')} icon={<IconCopy size={14} />}>Duplicate</Btn>
          {(c.status === 'draft' || c.status === 'scheduled' || c.status === 'paused' || c.status === 'failed') && (
            <Btn variant="ghost" size="sm" onClick={() => nav(`/kumo/campaigns/${id}/edit`)} icon={<IconEdit size={14} />}>Edit</Btn>
          )}
          <Btn size="sm" loading={loading} onClick={() => { reload(); rec.reload(); }} icon={<IconRefresh size={14} />}>Refresh</Btn>
        </div>
      </div>

      {error && (
        <Card style={{ marginBottom: 12, borderLeft: `4px solid ${T.red}` }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: T.red, fontWeight: 600, fontSize: 13 }}>
            <IconAlert size={16} /> {error}
          </div>
        </Card>
      )}

      {(c.status === 'running' || c.status === 'paused') && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 9 }}>
            <h2 className="km-h2">{c.status === 'paused' ? 'Paused mid-flight' : 'Sending in progress'}</h2>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink2 }}>
              {nf(m.sent)} of {nf(totalRec)} · {progress.toFixed(1)}%
            </span>
          </div>
          <Meter value={m.sent} max={Math.max(1, totalRec)} tone={c.status === 'paused' ? 'amber' : 'indigo'} height={10} />
        </Card>
      )}

      {/* ── KPI row ────────────────────────────────────────────────────── */}
      <div className="km-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))', marginBottom: 16 }}>
        <StatTile label="Recipients" value={totalRec} format={compact} tone="slate" icon={<IconUsers size={15} />} sub={`${nf(totalRec)} targeted`} />
        <StatTile label="Sent" value={m.sent} format={compact} tone="indigo" icon={<IconSend size={15} />} sub={`${nf(c.unsubs || 0)} unsubscribed`} />
        <StatTile label="Delivered" value={m.deliveryRate} format={(v) => pct(v, 1)} tone="green" icon={<IconCheck size={15} />} sub={`${nf(m.delivered)} accepted`} />
        <StatTile label="Unique opens" value={m.openRate} format={(v) => pct(v, 1)} tone="cyan" icon={<IconOpen size={15} />} sub={`${nf(c.unique_opens || 0)} people · ${nf(c.opens || 0)} total`} />
        <StatTile label="Unique clicks" value={m.clickRate} format={(v) => pct(v, 1)} tone="indigo" icon={<IconClick size={15} />} sub={`${nf(c.unique_clicks || 0)} people · ${nf(c.clicks || 0)} total`} />
        <StatTile label="Bounce rate" value={m.bounceRate} format={(v) => pct(v, 2)} icon={<IconBounce size={15} />}
          tone={rateTone('bounce', m.bounceRate) === 'green' ? 'green' : rateTone('bounce', m.bounceRate) === 'yellow' ? 'amber' : 'red'}
          sub={`${nf(c.bounced || 0)} bounced`} />
        <StatTile label="Spam rate" value={m.complaintRate} format={(v) => pct(v, 3)} icon={<IconSpam size={15} />}
          tone={rateTone('complaint', m.complaintRate) === 'green' ? 'green' : rateTone('complaint', m.complaintRate) === 'yellow' ? 'amber' : 'red'}
          sub={`${nf(c.complaints || 0)} complaints · limit 0.1%`} />
        <StatTile label="Unsubscribes" value={Number(c.unsubs || 0)} tone="slate" icon={<IconMail size={15} />}
          sub={m.delivered > 0 ? `${pct((Number(c.unsubs || 0) / m.delivered) * 100, 2)} of delivered` : '—'} />
      </div>

      {/* ── charts ─────────────────────────────────────────────────────── */}
      <div className="kmr-charts" style={{ marginBottom: 16 }}>
        <Card style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <div>
              <h2 className="km-h2">Engagement over time</h2>
              <div className="km-sub">Deliveries, opens, clicks and bounces as they landed</div>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11.5, fontWeight: 700, color: T.muted, flexWrap: 'wrap' }}>
              {seriesKeys.map((s) => (
                <span key={s.key}>
                  <i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: s.color, marginRight: 5 }} />{s.key}
                </span>
              ))}
            </div>
          </div>
          <div style={{ height: 300 }}>
            {chartRows.length === 0 ? (
              <Empty title="No activity recorded yet" sub="The curve fills in as KumoMTA reports deliveries and the tracker records opens." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartRows} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                  <defs>
                    {seriesKeys.map((s) => (
                      <linearGradient key={s.key} id={`kmrg${s.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 6" stroke="rgba(15,23,42,.08)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={22} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={compact} width={52} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(15,23,42,.08)', boxShadow: '0 18px 40px -20px rgba(15,23,42,.5)', fontSize: 12 }}
                    formatter={(v, n) => [nf(v), n]} />
                  {seriesKeys.map((s) => (
                    <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2.1} fill={`url(#kmrg${s.key})`} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card style={{ minWidth: 0 }}>
          <div style={{ marginBottom: 10 }}>
            <h2 className="km-h2">Per sending IP</h2>
            <div className="km-sub">Sent vs delivered vs bounced on each address</div>
          </div>
          <div style={{ height: 300 }}>
            {ipChart.length === 0 ? (
              <Empty icon={<IconServer size={20} />} title="No IP breakdown yet" sub="Appears once the first message leaves the queue." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ipChart} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 6" stroke="rgba(15,23,42,.08)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={0} angle={-12} textAnchor="end" height={46} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={compact} width={52} />
                  <Tooltip cursor={{ fill: 'rgba(99,102,241,.06)' }} formatter={(v, n) => [nf(v), n]}
                    contentStyle={{ borderRadius: 12, border: '1px solid rgba(15,23,42,.08)', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11.5, fontWeight: 700 }} />
                  <Bar dataKey="Sent" fill="#6366f1" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="Delivered" fill="#10b981" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="Bounced" fill="#ef4444" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* ── provider + responses ───────────────────────────────────────── */}
      <div className="kmr-tables" style={{ marginBottom: 16 }}>
        <Card>
          <h2 className="km-h2" style={{ marginBottom: 10 }}>Mailbox providers</h2>
          {byProvider.length === 0 ? (
            <Empty icon={<IconGlobe size={20} />} title="No provider data" sub="Gmail, Outlook and the rest appear here once delivery events arrive." />
          ) : (
            <div className="km-tablewrap km-scroll" style={{ maxHeight: 300 }}>
              <table className="km-table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th style={{ textAlign: 'right' }}>Sent</th>
                    <th style={{ textAlign: 'right' }}>Delivered</th>
                    <th style={{ textAlign: 'right' }}>Opened</th>
                    <th style={{ textAlign: 'right' }}>Clicked</th>
                    <th style={{ textAlign: 'right' }}>Bounced</th>
                  </tr>
                </thead>
                <tbody>
                  {byProvider.map((p, i) => {
                    const s = Number(p.sent || 0);
                    const br = s > 0 ? (Number(p.bounced || 0) / s) * 100 : 0;
                    return (
                      <tr key={`${p.provider}-${i}`}>
                        <td style={{ fontWeight: 700, textTransform: 'capitalize' }}>{p.provider || 'other'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{nf(p.sent)}</td>
                        <td style={{ textAlign: 'right' }}>{nf(p.delivered)}</td>
                        <td style={{ textAlign: 'right' }}>{nf(p.opened)}</td>
                        <td style={{ textAlign: 'right' }}>{nf(p.clicked)}</td>
                        <td style={{ textAlign: 'right', color: br >= 2 ? T.red : T.ink2, fontWeight: br >= 2 ? 800 : 600 }}>{nf(p.bounced)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="km-h2" style={{ marginBottom: 10 }}>What the providers replied</h2>
          {responses.length === 0 ? (
            <Empty icon={<IconCheck size={20} />} title="No failure responses" sub="Every message this campaign sent was accepted." />
          ) : (
            <div className="km-tablewrap km-scroll" style={{ maxHeight: 300 }}>
              <table className="km-table">
                <thead><tr><th>Type</th><th>Code</th><th>Response</th><th style={{ textAlign: 'right' }}>Count</th></tr></thead>
                <tbody>
                  {responses.map((r, i) => (
                    <tr key={i}>
                      <td><Pill tone={r.type === 'bounce' ? 'red' : r.type === 'complaint' ? 'yellow' : 'slate'}>{r.type}</Pill></td>
                      <td className="kmr-mono">{r.code || '—'}</td>
                      <td className="kmr-trunc" title={r.message}>{r.message || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>{nf(r.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ── recipients explorer ────────────────────────────────────────── */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <h2 className="km-h2">Recipients</h2>
            <div className="km-sub">{nf(rTotal)} row{rTotal === 1 ? '' : 's'} matching the current filter</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <SearchInput value={rSearch} onChange={(v) => { setRSearch(v); setRPage(1); }} placeholder="Search an email…" width={220} />
            <Btn variant="ghost" size="sm" loading={rec.loading} onClick={() => rec.reload()} icon={<IconRefresh size={14} />}>Reload</Btn>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <Tabs size="sm" value={rStatus} onChange={(v) => { setRStatus(v); setRPage(1); }}
            tabs={[
              { id: 'all', label: 'All' }, { id: 'sent', label: 'Sent' }, { id: 'delivered', label: 'Delivered' },
              { id: 'bounced', label: 'Bounced' }, { id: 'failed', label: 'Failed' }, { id: 'skipped', label: 'Skipped' },
            ]} />
        </div>

        {rec.error && (
          <div style={{ marginBottom: 12, fontSize: 12.5, fontWeight: 600, color: T.red, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconAlert size={14} /> {rec.error}
          </div>
        )}

        {rec.loading && !rows.length ? (
          <div style={{ display: 'grid', gap: 8 }}>{[0, 1, 2, 3, 4, 5].map((i) => <Skel key={i} h={38} r={10} />)}</div>
        ) : rows.length === 0 ? (
          <Empty icon={<IconEye size={20} />} title="No recipients in this view"
            sub={dRSearch ? 'No address matches that search — try a partial domain instead.' : 'Switch the status filter, or wait for the send to start producing rows.'} />
        ) : (
          <div className="km-tablewrap km-scroll" style={{ maxHeight: 620 }}>
            <table className="km-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Route</th>
                  <th style={{ textAlign: 'right' }}>Opens</th>
                  <th style={{ textAlign: 'right' }}>Clicks</th>
                  <th>Timeline</th>
                  <th>Response</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 700 }} className="kmr-trunc" title={r.email}>{r.email}</td>
                    <td>
                      <Pill tone={ROW_TONE[String(r.status || '').toLowerCase()] || 'slate'}>{r.status || '—'}</Pill>
                      {r.bounce_type && <div style={{ fontSize: 10.5, color: T.faint, fontWeight: 700, marginTop: 3 }}>{r.bounce_type}</div>}
                    </td>
                    <td style={{ fontSize: 11.5, color: T.muted, fontWeight: 600 }}>
                      <div style={{ textTransform: 'capitalize' }}>{r.provider || '—'}</div>
                      <div className="kmr-mono" style={{ color: T.faint }}>{r.ip_addr || '—'}</div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: Number(r.open_count || 0) > 0 ? T.green : T.faint }}>{nf(r.open_count)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: Number(r.click_count || 0) > 0 ? T.brand : T.faint }}>{nf(r.click_count)}</td>
                    <td style={{ fontSize: 11, color: T.muted, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {r.sent_at && <div>Sent {fmtDt(r.sent_at)}</div>}
                      {r.delivered_at && <div style={{ color: T.green }}>Delivered {fmtDt(r.delivered_at)}</div>}
                      {r.bounced_at && <div style={{ color: T.red }}>Bounced {fmtDt(r.bounced_at)}</div>}
                      {r.opened_at && <div style={{ color: T.cyan }}>Opened {fmtDt(r.opened_at)}</div>}
                      {r.clicked_at && <div style={{ color: T.brand }}>Clicked {fmtDt(r.clicked_at)}</div>}
                      {!r.sent_at && !r.delivered_at && !r.bounced_at && <div>—</div>}
                    </td>
                    <td className="kmr-trunc" title={r.error || ''}>
                      <span className="kmr-mono" style={{ color: T.faint, marginRight: 6 }}>{r.smtp_code || ''}</span>
                      <span style={{ fontSize: 11.5, color: r.error ? T.red : T.faint }}>{r.error || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={rPage} perPage={rPer} total={rTotal}
          onPage={setRPage} onPerPage={(v) => { setRPer(v); setRPage(1); }} />
      </Card>

      <div style={{ height: 24 }} />
    </div>
  );
}
