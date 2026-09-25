/*
 * KumoMTA — Message log explorer.
 *
 * Every individual message the platform has handled, filterable by recipient,
 * campaign, sending IP and outcome. Clicking a row opens the full delivery
 * history for that message — the raw event stream KumoMTA reported back.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  KumoStyles, kapi, usePolling, useDebounced, Card, StatTile, Btn, Pill, Empty, Skel, Spinner, Drawer,
  SearchInput, Pagination, T, nf, fmtDt, ago,
  IconRefresh, IconMail, IconCheck, IconBounce, IconOpen, IconClick, IconAlert, IconSend,
  IconClock, IconSpam, IconCopy, IconEye,
} from './kumoShared';

/* ── local layout rules ─────────────────────────────────────────────────── */
const LOG_CSS = `
.km-log-filters { display:flex; gap:9px; align-items:center; flex-wrap:wrap; }
.km-log-filters .km-select { width:auto; min-width:150px; max-width:100%; }
.km-log-row { cursor:pointer; }
.km-log-mono { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:11.6px; }
.km-log-trunc { max-width:230px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; }
.km-log-tl { position:relative; padding-left:34px; }
.km-log-tl::before { content:''; position:absolute; left:13px; top:6px; bottom:6px; width:2px; border-radius:2px;
  background:linear-gradient(180deg, rgba(99,102,241,.35), rgba(99,102,241,.06)); }
.km-log-tlrow { position:relative; padding:0 0 16px 0; }
.km-log-tldot { position:absolute; left:-34px; top:0; width:28px; height:28px; border-radius:10px; display:grid;
  place-items:center; color:#fff; box-shadow:0 8px 18px -10px rgba(15,23,42,.8); }
@media (max-width: 720px) {
  .km-log-filters .km-select { min-width:0; flex:1 1 140px; }
  .km-log-trunc { max-width:150px; }
}
`;

const STATUSES = [
  { id: '', label: 'All outcomes' },
  { id: 'queued', label: 'Queued' },
  { id: 'sent', label: 'Sent' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'deferred', label: 'Deferred' },
  { id: 'bounced', label: 'Bounced' },
  { id: 'failed', label: 'Failed' },
  { id: 'skipped', label: 'Skipped' },
];

const STATUS_TONE = {
  delivered: 'green',
  sent: 'indigo',
  queued: 'slate',
  deferred: 'yellow',
  bounced: 'red',
  failed: 'red',
  skipped: 'slate',
};

const EVENT_META = {
  reception: { label: 'Accepted for delivery', color: '#6366f1', Icon: IconSend },
  delivery: { label: 'Delivered', color: '#10b981', Icon: IconCheck },
  deferred: { label: 'Deferred — will retry', color: '#f59e0b', Icon: IconClock },
  bounce: { label: 'Bounced', color: '#ef4444', Icon: IconBounce },
  complaint: { label: 'Spam complaint', color: '#b45309', Icon: IconSpam },
  open: { label: 'Opened', color: '#06b6d4', Icon: IconOpen },
  click: { label: 'Clicked', color: '#8b5cf6', Icon: IconClick },
  unsub: { label: 'Unsubscribed', color: '#64748b', Icon: IconMail },
};
const eventMeta = (type) => EVENT_META[String(type || '').toLowerCase()]
  || { label: type || 'Event', color: '#94a3b8', Icon: IconActivityDot };

function IconActivityDot({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

/** Timestamp shown relatively, with the exact value on hover. */
function TimeCell({ value }) {
  if (!value) return <span style={{ color: T.faint }}>—</span>;
  return <span title={fmtDt(value)} style={{ whiteSpace: 'nowrap' }}>{ago(value)}</span>;
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch (e) { /* fall through to the legacy path */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e) { return false; }
}

export default function KumoLogs() {
  const [search, setSearch] = useState('');
  const q = useDebounced(search, 400);
  const [campaignId, setCampaignId] = useState('');
  const [ipId, setIpId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  const [campaigns, setCampaigns] = useState([]);
  const [ips, setIps] = useState([]);

  const [row, setRow] = useState(null);
  const [events, setEvents] = useState([]);
  const [evLoading, setEvLoading] = useState(false);
  const [evError, setEvError] = useState('');

  /* filter dropdown sources — loaded once */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, i] = await Promise.all([
          kapi('campaigns_list', { per_page: 100 }).catch(() => ({ campaigns: [] })),
          kapi('ips_list', {}).catch(() => ({ ips: [] })),
        ]);
        if (!alive) return;
        setCampaigns(c?.campaigns || []);
        setIps(i?.ips || []);
      } catch (e) { /* filters simply stay empty */ }
    })();
    return () => { alive = false; };
  }, []);

  /* reset to page 1 whenever a filter changes */
  useEffect(() => { setPage(1); }, [q, campaignId, ipId, status, perPage]);

  const { data, loading, error, reload } = usePolling(
    () => kapi('message_log', {
      page, per_page: perPage, search: q, campaign_id: campaignId, ip_id: ipId, status,
    }),
    [page, perPage, q, campaignId, ipId, status],
  );

  const rows = data?.rows || [];
  const total = Number(data?.total || 0);

  const tiles = useMemo(() => {
    const t = { shown: rows.length, delivered: 0, bounced: 0, opened: 0, clicked: 0 };
    rows.forEach((r) => {
      const s = String(r.status || '').toLowerCase();
      if (s === 'delivered' || r.delivered_at) t.delivered += 1;
      if (s === 'bounced' || r.bounced_at) t.bounced += 1;
      if (Number(r.open_count || 0) > 0 || r.opened_at) t.opened += 1;
      if (Number(r.click_count || 0) > 0 || r.clicked_at) t.clicked += 1;
    });
    return t;
  }, [rows]);

  const openRow = useCallback(async (r) => {
    setRow(r);
    setEvents([]);
    setEvError('');
    setEvLoading(true);
    try {
      const d = await kapi('message_events', { recipient_id: r.id, rid: r.id });
      setEvents(d?.events || []);
    } catch (e) {
      setEvError(e.message || 'Could not load the delivery history');
    } finally {
      setEvLoading(false);
    }
  }, []);

  const clearFilters = () => { setSearch(''); setCampaignId(''); setIpId(''); setStatus(''); };
  const filtered = !!(q || campaignId || ipId || status);

  const copyDetails = async () => {
    if (!row) return;
    const lines = [
      `Message #${row.id}`,
      `Recipient : ${row.email || '—'}`,
      `Campaign  : ${row.campaign || '—'}`,
      `Sending IP: ${row.ip_addr || '—'}`,
      `Provider  : ${row.provider || '—'}`,
      `Status    : ${row.status || '—'}${row.smtp_code ? ` (SMTP ${row.smtp_code})` : ''}`,
      row.bounce_type ? `Bounce    : ${row.bounce_type}` : null,
      row.error ? `Error     : ${row.error}` : null,
      `Sent      : ${row.sent_at ? fmtDt(row.sent_at) : '—'}`,
      `Delivered : ${row.delivered_at ? fmtDt(row.delivered_at) : '—'}`,
      `Bounced   : ${row.bounced_at ? fmtDt(row.bounced_at) : '—'}`,
      `Opens     : ${nf(row.open_count || 0)}${row.opened_at ? ` (first ${fmtDt(row.opened_at)})` : ''}`,
      `Clicks    : ${nf(row.click_count || 0)}${row.clicked_at ? ` (first ${fmtDt(row.clicked_at)})` : ''}`,
      '',
      `Events (${events.length}):`,
      ...events.map((ev) => {
        const bits = [fmtDt(ev.created_at), String(ev.type || '').toUpperCase()];
        if (ev.provider) bits.push(ev.provider);
        if (ev.code) bits.push(`code ${ev.code}`);
        if (ev.response) bits.push(String(ev.response).replace(/\s+/g, ' ').trim());
        if (ev.url) bits.push(`url ${ev.url}`);
        if (ev.ip_address) bits.push(`ip ${ev.ip_address}`);
        if (ev.user_agent) bits.push(`ua ${ev.user_agent}`);
        return `  - ${bits.join(' · ')}`;
      }),
    ].filter((l) => l !== null);
    const ok = await copyText(lines.join('\n'));
    if (ok) toast.success('Delivery details copied'); else toast.error('Clipboard blocked by the browser');
  };

  return (
    <div className="km km-page">
      <KumoStyles />
      <style>{LOG_CSS}</style>

      <div className="km-head">
        <div>
          <h1 className="km-h1">Message log</h1>
          <div className="km-sub">
            Every individual send, with the exact SMTP response that came back
            {total ? ` · ${nf(total)} messages match` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {filtered && <Btn variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Btn>}
          <Btn size="sm" loading={loading} onClick={() => reload()} icon={<IconRefresh size={14} />}>Refresh</Btn>
        </div>
      </div>

      {/* ── filters ───────────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 16 }}>
        <div className="km-log-filters">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by email…" width={230} />
          <select className="km-select" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">All campaigns</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="km-select" value={ipId} onChange={(e) => setIpId(e.target.value)}>
            <option value="">All sending IPs</option>
            {ips.map((i) => <option key={i.id} value={i.id}>{i.ip}{i.tenant ? ` · ${i.tenant}` : ''}</option>)}
          </select>
          <select className="km-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s.id || 'all'} value={s.id}>{s.label}</option>)}
          </select>
          {loading && rows.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.muted, fontWeight: 600 }}>
              <Spinner size={14} /> Updating…
            </span>
          )}
        </div>
      </Card>

      {error && (
        <Card style={{ marginBottom: 12, borderLeft: `4px solid ${T.red}` }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: T.red, fontWeight: 600, fontSize: 13 }}>
            <IconAlert size={16} /> {error}
          </div>
        </Card>
      )}

      {/* ── tiles for the loaded page ─────────────────────────────────── */}
      <div className="km-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginBottom: 16 }}>
        <StatTile label="Rows shown" value={tiles.shown} tone="indigo" icon={<IconMail size={15} />} loading={loading}
          sub={total ? `of ${nf(total)} matching` : 'on this page'} />
        <StatTile label="Delivered" value={tiles.delivered} tone="green" icon={<IconCheck size={15} />} loading={loading}
          sub="accepted by the mailbox" />
        <StatTile label="Bounced" value={tiles.bounced} tone="red" icon={<IconBounce size={15} />} loading={loading}
          sub="rejected or undeliverable" />
        <StatTile label="Opened" value={tiles.opened} tone="cyan" icon={<IconOpen size={15} />} loading={loading}
          sub="at least one open" />
        <StatTile label="Clicked" value={tiles.clicked} tone="amber" icon={<IconClick size={15} />} loading={loading}
          sub="at least one click" />
      </div>

      {/* ── table ─────────────────────────────────────────────────────── */}
      <Card pad={false} style={{ overflow: 'hidden' }}>
        {loading && rows.length === 0 ? (
          <div style={{ padding: 18, display: 'grid', gap: 10 }}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skel key={i} h={34} r={10} />)}
          </div>
        ) : rows.length === 0 ? (
          <Empty
            icon={<IconMail size={22} />}
            title={filtered ? 'No messages match these filters' : 'No messages logged yet'}
            sub={filtered
              ? 'Try widening the search, or clear the campaign, IP and outcome filters.'
              : 'As soon as a campaign starts sending, every recipient shows up here with its delivery outcome.'}
            action={filtered ? <Btn variant="ghost" onClick={clearFilters}>Clear filters</Btn> : undefined}
          />
        ) : (
          <div className="km-tablewrap km-scroll">
            <table className="km-table">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Campaign</th>
                  <th>IP</th>
                  <th>Provider</th>
                  <th>Status</th>
                  <th>SMTP</th>
                  <th style={{ textAlign: 'right' }}>Opens</th>
                  <th style={{ textAlign: 'right' }}>Clicks</th>
                  <th>Sent</th>
                  <th>Delivered</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = String(r.status || '').toLowerCase();
                  return (
                    <tr key={r.id} className="km-log-row km-fade" onClick={() => openRow(r)}
                      title="Open the full delivery history">
                      <td>
                        <div style={{ fontWeight: 700, color: T.ink2 }}>
                          <span className="km-log-trunc" title={r.email}>{r.email || '—'}</span>
                        </div>
                        {r.error && (
                          <span className="km-log-trunc" title={r.error}
                            style={{ fontSize: 11, color: T.red, marginTop: 2 }}>{r.error}</span>
                        )}
                      </td>
                      <td><span className="km-log-trunc" title={r.campaign} style={{ maxWidth: 170 }}>{r.campaign || '—'}</span></td>
                      <td className="km-log-mono">{r.ip_addr || '—'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{r.provider || '—'}</td>
                      <td>
                        <Pill tone={STATUS_TONE[s] || 'slate'} pulse={s === 'deferred'}>{r.status || 'unknown'}</Pill>
                        {r.bounce_type && (
                          <div style={{ fontSize: 10.5, color: T.muted, fontWeight: 700, marginTop: 3, textTransform: 'capitalize' }}>
                            {r.bounce_type}
                          </div>
                        )}
                      </td>
                      <td className="km-log-mono" style={{ color: r.smtp_code && String(r.smtp_code)[0] === '5' ? T.red : T.ink2 }}>
                        {r.smtp_code || '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: Number(r.open_count) ? T.ink2 : T.faint }}
                        title={r.opened_at ? `First open ${fmtDt(r.opened_at)}` : ''}>
                        {nf(r.open_count || 0)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: Number(r.click_count) ? T.ink2 : T.faint }}
                        title={r.clicked_at ? `First click ${fmtDt(r.clicked_at)}` : ''}>
                        {nf(r.click_count || 0)}
                      </td>
                      <td><TimeCell value={r.sent_at} /></td>
                      <td><TimeCell value={r.delivered_at || r.bounced_at} /></td>
                      <td>
                        <Btn variant="ghost" size="sm" aria-label="Open delivery history"
                          onClick={(e) => { e.stopPropagation(); openRow(r); }} icon={<IconEye size={13} />} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Pagination page={page} perPage={perPage} total={total} onPage={setPage} onPerPage={setPerPage} />

      {/* ── delivery history drawer ───────────────────────────────────── */}
      <Drawer
        open={!!row}
        onClose={() => setRow(null)}
        width={720}
        title={row?.email || 'Delivery history'}
        subtitle={row ? `Message #${row.id}${row.campaign ? ` · ${row.campaign}` : ''}` : ''}
        footer={(
          <>
            <Btn variant="ghost" onClick={copyDetails} icon={<IconCopy size={13} />}>Copy details</Btn>
            <Btn onClick={() => setRow(null)}>Close</Btn>
          </>
        )}
      >
        {row && (
          <>
            {/* summary grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 10, marginBottom: 16 }}>
              {[
                ['Status', <Pill key="s" tone={STATUS_TONE[String(row.status || '').toLowerCase()] || 'slate'}>{row.status || 'unknown'}</Pill>],
                ['SMTP code', <span key="c" className="km-log-mono" style={{ fontWeight: 800 }}>{row.smtp_code || '—'}</span>],
                ['Sending IP', <span key="i" className="km-log-mono">{row.ip_addr || '—'}</span>],
                ['Provider', <span key="p" style={{ textTransform: 'capitalize', fontWeight: 700 }}>{row.provider || '—'}</span>],
                ['Opens', <span key="o" style={{ fontWeight: 800 }}>{nf(row.open_count || 0)}</span>],
                ['Clicks', <span key="k" style={{ fontWeight: 800 }}>{nf(row.click_count || 0)}</span>],
              ].map(([k, v]) => (
                <div key={k} style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(99,102,241,.06)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: T.faint }}>{k}</div>
                  <div style={{ marginTop: 5 }}>{v}</div>
                </div>
              ))}
            </div>

            {row.error && (
              <div style={{
                marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(239,68,68,.07)',
                color: T.red, fontSize: 12, lineHeight: 1.6, wordBreak: 'break-word',
              }}>
                <strong>Last error</strong><div style={{ marginTop: 3 }}>{row.error}</div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <h3 className="km-h2">Delivery timeline</h3>
              {!evLoading && events.length > 0 && <Pill tone="indigo">{events.length} events</Pill>}
            </div>

            {evLoading ? (
              <div style={{ display: 'grid', gap: 12 }}>
                {[0, 1, 2, 3].map((i) => <Skel key={i} h={58} r={12} />)}
              </div>
            ) : evError ? (
              <div style={{ display: 'flex', gap: 9, alignItems: 'center', color: T.red, fontSize: 12.5, fontWeight: 600 }}>
                <IconAlert size={15} /> {evError}
              </div>
            ) : events.length === 0 ? (
              <Empty title="No events recorded" sub="KumoMTA has not reported anything for this message yet. Events arrive through the log hook within a few seconds of each attempt." />
            ) : (
              <div className="km-log-tl">
                {events.map((ev) => {
                  const m = eventMeta(ev.type);
                  const { Icon } = m;
                  return (
                    <div key={ev.id || `${ev.type}-${ev.created_at}`} className="km-log-tlrow km-fade">
                      <span className="km-log-tldot" style={{ background: `linear-gradient(135deg, ${m.color}, ${m.color}cc)` }}>
                        <Icon size={14} />
                      </span>
                      <div className="km-card" style={{ padding: '11px 13px', background: 'rgba(255,255,255,.72)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12.8, fontWeight: 800, color: m.color }}>{m.label}</span>
                          <span title={fmtDt(ev.created_at)} style={{ fontSize: 11, color: T.faint, fontWeight: 700 }}>
                            {ago(ev.created_at)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 7 }}>
                          {ev.provider && <Pill tone="slate">{ev.provider}</Pill>}
                          {ev.code && (
                            <span className="km-pill km-log-mono" style={{ background: 'rgba(99,102,241,.12)', color: '#4338ca' }}>
                              {ev.code}
                            </span>
                          )}
                        </div>
                        {ev.response && (
                          <div className="km-log-mono" style={{
                            marginTop: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(15,23,42,.04)',
                            color: T.ink2, lineHeight: 1.6, wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                          }}>{ev.response}</div>
                        )}
                        {ev.url && (
                          <div style={{ marginTop: 7, fontSize: 11.5, wordBreak: 'break-all' }}>
                            <span style={{ color: T.faint, fontWeight: 700 }}>URL </span>
                            <a href={ev.url} target="_blank" rel="noreferrer" style={{ color: T.brand }}>{ev.url}</a>
                          </div>
                        )}
                        {(ev.ip_address || ev.user_agent) && (
                          <div style={{ marginTop: 7, fontSize: 11, color: T.muted, lineHeight: 1.6, wordBreak: 'break-word' }}>
                            {ev.ip_address && <div><strong style={{ color: T.faint }}>IP</strong> {ev.ip_address}</div>}
                            {ev.user_agent && <div title={ev.user_agent}><strong style={{ color: T.faint }}>UA</strong> {ev.user_agent}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Drawer>

      <div style={{ height: 20 }} />
    </div>
  );
}
