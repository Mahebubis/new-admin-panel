import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../../api/axios';
import {
  API, STREAM, METRIC, nf, pctText, rate, inr, fmtBucket, fmtBucketLong, fmtDateTime, fmtDay,
  Skel, DotLoader, Empty, Donut, StatusPill, ChannelIcon, KindIcon, Pagination, ripple, CountUp, providerColor,
} from './maShared';

const PEOPLE_STATUSES = [
  { key: 'all', label: 'All' },
  { key: 'sent', label: 'Sent', metric: 'sent' },
  { key: 'delivered', label: 'Delivered', metric: 'delivered' },
  { key: 'not_delivered', label: 'No receipt yet', color: '#64748b' },
  { key: 'opened', label: 'Opened / Read', metric: 'opened' },
  { key: 'clicked', label: 'Clicked', metric: 'clicked' },
  { key: 'failed', label: 'Failed', metric: 'failed' },
  { key: 'bounced', label: 'Bounced', metric: 'bounced' },
  { key: 'skipped', label: 'Skipped', metric: 'skipped' },
];

/**
 * The people behind one number: every recipient of a campaign, or of ONE journey step, with the
 * furthest status they reached. Server-paginated; the status chips carry their own counts from the
 * same query, so a chip and the list it opens can never disagree.
 */
export function PeopleTable({ kind, channel, id, nodeId, range, initialStatus = 'all' }) {
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const seq = useRef(0);

  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [status, debounced, perPage]);

  useEffect(() => {
    const my = ++seq.current;
    setBusy(true);
    api.get(API, { params: { action: 'people', kind, channel, id, node_id: nodeId || '', status, search: debounced, page, per_page: perPage, from: range.from, to: range.to, _t: Date.now() } })
      .then(r => { if (my === seq.current && r.data?.success) setData(r.data.data); })
      .catch(() => {})
      .finally(() => { if (my === seq.current) setBusy(false); });
  }, [kind, channel, id, nodeId, status, debounced, page, perPage, range.from, range.to]);

  const counts = data?.counts || {};
  const isWa = channel === 'whatsapp';
  const visible = PEOPLE_STATUSES.filter(s => s.key === 'all' || s.key === status || (counts[s.key] || 0) > 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '12px 16px' }}>
        <div className="ma-chips" style={{ flex: '1 1 auto' }}>
          {visible.map(s => (
            <button key={s.key} className="ma-chip ma-rip" onPointerDown={ripple} data-on={status === s.key ? '1' : undefined}
                    style={{ '--c': s.metric ? METRIC[s.metric].color : (s.color || '#1e3a8a') }} onClick={() => setStatus(s.key)}>
              {s.key !== 'all' && <i />}{s.key === 'opened' && isWa ? 'Read' : s.label}
              <span className="cnt">{data ? nf(counts[s.key] || 0) : '…'}</span>
            </button>
          ))}
        </div>
        <div className="ma-search" style={{ maxWidth: 260 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={isWa ? 'Search name or phone' : 'Search name or email'} />
        </div>
      </div>
      <div className="ma-tablewrap" style={{ opacity: busy && data ? 0.55 : 1, transition: 'opacity .2s' }}>
        <table className="ma-table">
          <thead>
            <tr>
              <th className="l">Person</th>
              <th className="l">Status</th>
              <th>Sent</th>
              <th>Delivered</th>
              <th>{isWa ? 'Read' : 'Opened'}</th>
              <th>Clicked</th>
              <th className="l">Reason</th>
            </tr>
          </thead>
          <tbody>
            {!data && busy && Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 7 }).map((__, j) => <td key={j} className={j < 2 || j === 6 ? 'l' : ''}><Skel w={j === 0 ? 160 : 70} /></td>)}</tr>
            ))}
            {data && data.rows.map(r => (
              <tr key={r.id}>
                <td className="l">
                  <b style={{ fontWeight: 650, color: '#0f172a' }}>{r.name || '—'}</b>
                  <span className="sub">{r.contact || '—'}{r.user_id && r.user_id !== '0' ? ` · UID ${r.user_id}` : ''}</span>
                </td>
                <td className="l"><StatusPill status={r.status} /></td>
                <td>{busy ? <DotLoader /> : fmtDateTime(r.sent_at)}</td>
                <td>{busy ? <DotLoader /> : fmtDateTime(r.delivered_at)}</td>
                <td>{busy ? <DotLoader /> : fmtDateTime(r.opened_at)}</td>
                <td>{busy ? <DotLoader /> : fmtDateTime(r.clicked_at)}</td>
                <td className="l" style={{ maxWidth: 320, whiteSpace: 'normal', color: r.error ? '#b91c1c' : '#cbd5e1', fontSize: 12 }}>{r.error || '—'}</td>
              </tr>
            ))}
            {data && !data.rows.length && (
              <tr><td colSpan={7}><Empty title="No one here" sub="Nobody in this step matches that status or search." /></td></tr>
            )}
          </tbody>
        </table>
      </div>
      {data && <Pagination page={data.page} pages={data.pages} total={data.total} perPage={perPage} onPage={setPage} onPerPage={setPerPage} sizes={[10, 25, 50, 100]} />}
    </div>
  );
}

function TrendTip({ active, payload, label, gran }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="ma-tip">
      <b>{fmtBucketLong(label, gran)}</b>
      {payload.map(p => (
        <div className="r" key={p.dataKey}><i style={{ background: p.color }} /><span>{METRIC[p.dataKey]?.label || p.dataKey}</span>{nf(p.value)}</div>
      ))}
    </div>
  );
}

const TREND_KEYS = ['sent', 'delivered', 'opened', 'clicked', 'failed'];

export default function SourceDrawer({ source, range, onClose }) {
  const [closing, setClosing] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState(source.kind === 'journey' ? 'steps' : 'overview');
  const [open, setOpen] = useState(null); // node_id of the expanded step
  const [stepStatus, setStepStatus] = useState('all');

  const close = useCallback(() => { setClosing(true); setTimeout(onClose, 230); }, [onClose]);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [close]);

  useEffect(() => {
    setData(null); setErr(null);
    api.get(API, { params: { action: 'source', kind: source.kind, channel: source.channel, id: source.id, from: range.from, to: range.to, _t: Date.now() } })
      .then(r => { if (r.data?.success) { setData(r.data.data); const st = r.data.data.steps || []; if (st.length === 1) setOpen(st[0].node_id); } else setErr(r.data?.message || 'Could not load'); })
      .catch(e => setErr(e?.response?.data?.message || 'Could not load'));
  }, [source.kind, source.channel, source.id, range.from, range.to]);

  const st = STREAM[source.stream];
  const isWa = source.channel === 'whatsapp';
  const t = data?.totals;
  const gran = data?.range?.granularity || 'day';
  const tabs = source.kind === 'journey'
    ? [['steps', `Steps${data ? ` (${data.steps.length})` : ''}`], ['overview', 'Overview'], ['people', 'All recipients']]
    : [['overview', 'Overview'], ['people', 'Recipients']];

  const openStep = (nodeId, status = 'all') => { setStepStatus(status); setOpen(o => (o === nodeId && status === 'all' ? null : nodeId)); };

  return createPortal(
    <div className="ma-portal">
      <div className="ma-scrim" data-closing={closing ? '1' : undefined} onClick={close} />
      <aside className="ma-drawer" role="dialog" aria-modal="true" aria-label={source.name} data-closing={closing ? '1' : undefined}>
        <div className="ma-drawer-h">
          <div className="ma-name" style={{ maxWidth: 'none', flex: 1, alignItems: 'flex-start' }}>
            <span className="ic" style={{ width: 42, height: 42, borderRadius: 12, background: `${st.color}22`, color: isWa ? '#047857' : '#4338ca' }}>
              <ChannelIcon channel={source.channel} size={19} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2>{source.name}</h2>
              <div className="meta" style={{ fontSize: 12, marginTop: 5, flexWrap: 'wrap' }}>
                <span className="ma-tag" style={{ background: `${st.color}22`, color: isWa ? '#047857' : '#4338ca' }}><KindIcon kind={source.kind} size={11} />{st.short}</span>
                <span>ID {source.id}</span>
                {source.status && <span className="ma-tag" style={{ background: '#f1f5f9', color: '#475569' }}>{source.status}</span>}
                <span>· {fmtDay(range.from)}{range.to !== range.from ? ` – ${fmtDay(range.to)}` : ''}</span>
                {data?.took_ms != null && <span>· {data.took_ms} ms</span>}
              </div>
            </div>
          </div>
          <button className="ma-x" onClick={close} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ background: '#fff', padding: '0 22px', borderBottom: '1px solid #e2e8f0' }}>
          <div className="ma-tabs" role="tablist">
            {tabs.map(([k, l]) => <button key={k} role="tab" className="ma-rip" onPointerDown={ripple} data-on={tab === k ? '1' : undefined} onClick={() => setTab(k)}>{l}</button>)}
          </div>
        </div>

        <div className="ma-drawer-b">
          {err && <div className="ma-note">{err}</div>}

          {/* KPI strip, shared by every tab */}
          <div className="ma-kpis" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {['attempted', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'skipped', 'conversions'].map(k => (
              <div key={k} className="ma-card ma-kpi" style={{ '--c': METRIC[k].color, cursor: 'default', padding: '12px 14px' }}>
                <span className="t"><i />{k === 'opened' && isWa ? 'Read' : METRIC[k].label}</span>
                <span className="n" style={{ fontSize: 21 }}>{t ? <CountUp value={t[k]} /> : <Skel w={60} h={22} />}</span>
                <span className="r">{t ? (
                  k === 'sent' ? `${pctText(t.sent, t.attempted)} of attempted`
                  : ['delivered', 'failed', 'skipped'].includes(k) ? `${pctText(t[k], k === 'delivered' ? t.sent : t.attempted)}`
                  : ['opened', 'clicked'].includes(k) ? `${pctText(t[k], t.sent)} of sent`
                  : k === 'conversions' ? (t.revenue ? inr(t.revenue) : `${pctText(t.conversions, t.sent)} of sent`) : ' '
                ) : <Skel w={70} h={10} />}</span>
              </div>
            ))}
          </div>

          {tab === 'overview' && (
            <>
              <div className="ma-grid ma-g-trend">
                <div className="ma-card">
                  <div className="ma-card-h"><div><h3>Over time</h3><small>{gran === 'hour' ? 'Hourly' : 'Daily'} · message cohort</small></div></div>
                  <div className="ma-card-b" style={{ height: 260 }}>
                    {!data ? <Skel h={220} r={12} /> : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.series} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                          <defs>{TREND_KEYS.map(k => (
                            <linearGradient key={k} id={`sdg-${k}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={METRIC[k].color} stopOpacity={0.28} /><stop offset="100%" stopColor={METRIC[k].color} stopOpacity={0} />
                            </linearGradient>))}
                          </defs>
                          <CartesianGrid stroke="#eef2f7" vertical={false} />
                          <XAxis dataKey="bucket" tickFormatter={b => fmtBucket(b, gran)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={18} />
                          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={48} />
                          <Tooltip content={<TrendTip gran={gran} />} cursor={{ stroke: '#c7d2fe', strokeWidth: 1.5 }} />
                          {TREND_KEYS.map(k => <Area key={k} type="monotone" dataKey={k} stroke={METRIC[k].color} strokeWidth={2} fill={`url(#sdg-${k})`} animationDuration={700} />)}
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
                <div className="ma-card">
                  <div className="ma-card-h"><div><h3>Outcome</h3><small>What happened to every attempt</small></div></div>
                  <div className="ma-card-b">
                    {!t ? <Skel h={220} r={110} w={220} style={{ margin: '0 auto', display: 'block' }} /> : (
                      <Donut centerLabel="Attempted" data={[
                        { label: isWa ? 'Read' : 'Opened', value: Math.min(t.opened, t.sent), color: METRIC.opened.color },
                        { label: 'Delivered, not opened', value: Math.max(0, t.delivered - t.opened), color: METRIC.delivered.color },
                        { label: 'Sent, no receipt', value: Math.max(0, t.sent - Math.max(t.delivered, t.opened)), color: METRIC.sent.color },
                        { label: 'Failed', value: t.failed, color: METRIC.failed.color },
                        { label: 'Bounced', value: t.bounced, color: METRIC.bounced.color },
                        { label: 'Skipped', value: t.skipped, color: METRIC.skipped.color },
                      ]} />
                    )}
                  </div>
                </div>
              </div>
              {data && data.providers.length > 0 && (
                <div className="ma-card">
                  <div className="ma-card-h"><div><h3>By provider{isWa ? ' & sender' : ''}</h3></div></div>
                  <div className="ma-tablewrap" style={{ marginTop: 10 }}>
                    <table className="ma-table">
                      <thead><tr><th className="l">Provider</th><th>Attempted</th><th>Sent</th><th>Delivered</th><th>{isWa ? 'Read' : 'Opened'}</th><th>Clicked</th><th>Failed</th><th>Skipped</th></tr></thead>
                      <tbody>{data.providers.map(p => (
                        <tr key={p.label}>
                          <td className="l"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: providerColor(p.label.split(' ')[0]) }} />{p.label}</span></td>
                          <td>{nf(p.attempted)}</td><td>{nf(p.sent)}</td>
                          <td>{nf(p.delivered)}<span className="sub">{pctText(p.delivered, p.sent)}</span></td>
                          <td>{nf(p.opened)}<span className="sub">{pctText(p.opened, p.sent)}</span></td>
                          <td>{nf(p.clicked)}<span className="sub">{pctText(p.clicked, p.sent)}</span></td>
                          <td className={p.failed ? 'bad' : 'zero'}>{nf(p.failed)}</td>
                          <td className={p.skipped ? '' : 'zero'}>{nf(p.skipped)}</td>
                        </tr>))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'steps' && (
            <>
              {!data && Array.from({ length: 3 }).map((_, i) => <Skel key={i} h={62} r={14} style={{ display: 'block', marginBottom: 10 }} />)}
              {data && !data.steps.length && <div className="ma-card"><Empty title="No step sent anything in this range" sub="Pick a wider date range to see this journey's steps." /></div>}
              {data && data.steps.map((s, i) => {
                const isOpen = open === s.node_id;
                return (
                  <div key={s.node_id} className="ma-step ma-fade" data-open={isOpen ? '1' : undefined} style={{ animationDelay: `${i * 40}ms` }}>
                    <button className="ma-step-h ma-rip" onPointerDown={ripple} onClick={() => openStep(s.node_id)} aria-expanded={isOpen}>
                      <span className="ma-step-n">{i + 1}</span>
                      <span className="ma-step-t">
                        <b title={s.label}>{s.label}</b>
                        <span>Node {s.node_id} · {fmtDateTime(s.first_at)}{s.last_at !== s.first_at ? ` → ${fmtDateTime(s.last_at)}` : ''}</span>
                      </span>
                      <span className="ma-step-stats">
                        {[['sent', 'Sent'], ['delivered', 'Deliv.'], ['opened', isWa ? 'Read' : 'Opened'], ['clicked', 'Clicked'], ['failed', 'Failed'], ['conversions', 'Conv.']].map(([k, l]) => (
                          <div key={k} title={`${nf(s[k])} ${l}`}>
                            <b style={{ color: k === 'failed' && s.failed ? '#dc2626' : s[k] ? METRIC[k].color : '#cbd5e1' }}>{nf(s[k])}</b>
                            <span>{l}</span>
                          </div>
                        ))}
                        <svg className="ma-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                      </span>
                    </button>
                    {isOpen && (
                      <div className="ma-step-body">
                        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', padding: '14px 16px 0', fontSize: 12, color: '#64748b' }}>
                          <span>Attempted <b style={{ color: '#0f172a' }}>{nf(s.attempted)}</b></span>
                          <span>Delivery rate <b style={{ color: '#0f172a' }}>{pctText(s.delivered, s.sent)}</b></span>
                          <span>{isWa ? 'Read' : 'Open'} rate <b style={{ color: '#0f172a' }}>{pctText(s.opened, s.sent)}</b></span>
                          <span>Click rate <b style={{ color: '#0f172a' }}>{pctText(s.clicked, s.sent)}</b></span>
                          <span>Failure rate <b style={{ color: s.failed ? '#dc2626' : '#0f172a' }}>{pctText(s.failed, s.attempted)}</b></span>
                          {s.skipped > 0 && <span>Suppressed <b style={{ color: '#0f172a' }}>{nf(s.skipped)}</b></span>}
                          {s.revenue > 0 && <span>Revenue <b style={{ color: '#047857' }}>{inr(s.revenue)}</b></span>}
                        </div>
                        <PeopleTable key={`${s.node_id}:${stepStatus}`} kind="journey" channel={source.channel} id={source.id} nodeId={s.node_id} range={range} initialStatus={stepStatus} />
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {tab === 'people' && (
            <div className="ma-card" style={{ overflow: 'hidden' }}>
              <PeopleTable kind={source.kind} channel={source.channel} id={source.id} range={range} />
            </div>
          )}

          {t && rate(t.delivered, t.sent) === 0 && t.sent > 20 && !isWa && (
            <div className="ma-note" style={{ marginTop: 14 }}>
              No delivery receipts for these emails. Amazon SES only reports delivery when a configuration set with an event destination is attached, so Delivered stays 0 while opens and clicks still count.
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
