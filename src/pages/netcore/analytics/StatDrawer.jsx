import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import {
  API, STREAMS, STREAM, METRIC, nf, inr, fmtDateTime, rangeParams, rangeLabel, providerParam, PROVIDER,
  Skel, DotLoader, Empty, StatusPill, ChannelIcon, KindIcon, Pagination, ripple,
} from './maShared';

/* The tiles a drawer can switch between, in the order they sit on the page. */
export const STAT_TABS = [
  { key: 'attempted',   label: 'Attempted',     color: METRIC.attempted.color },
  { key: 'sent',        label: 'Sent',          color: METRIC.sent.color },
  { key: 'delivered',   label: 'Delivered',     color: METRIC.delivered.color },
  { key: 'opened',      label: 'Opened / Read', color: METRIC.opened.color },
  { key: 'clicked',     label: 'Clicked',       color: METRIC.clicked.color },
  { key: 'rejected',    label: 'Rejected',      color: METRIC.failed.color },
  { key: 'skipped',     label: 'Skipped',       color: METRIC.skipped.color },
  { key: 'conversions', label: 'Conversions',   color: METRIC.conversions.color },
];
const TAB = Object.fromEntries(STAT_TABS.map(t => [t.key, t]));

const copy = text => {
  navigator.clipboard?.writeText(text).then(() => toast.success('Copied'), () => {});
};

/** Everything known about one message, laid out as a timeline plus the facts behind it. */
function Detail({ r, onOpenSource }) {
  const isWa = r.channel === 'whatsapp';
  const failed = ['failed', 'bounced'].includes(r.status);
  const steps = r.status === 'converted' && !r.sent_at
    ? [
      ['Clicked', r.clicked_at, METRIC.clicked.color],
      ['Converted', r.converted_at, METRIC.conversions.color, r.conv_event],
    ]
    : [
      ['Queued', r.queued_at, '#94a3b8'],
      ['Sent', r.sent_at, METRIC.sent.color],
      ['Delivered', r.delivered_at, METRIC.delivered.color],
      [isWa ? 'Read' : 'Opened', r.opened_at, METRIC.opened.color, r.opens > 1 ? `${r.opens} opens` : ''],
      ['Clicked', r.clicked_at, METRIC.clicked.color, r.clicks > 1 ? `${r.clicks} clicks` : ''],
      ...(failed || r.status === 'skipped' ? [[r.status === 'bounced' ? 'Bounced' : r.status === 'skipped' ? 'Skipped' : 'Failed', r.failed_at || r.at, r.status === 'skipped' ? '#94a3b8' : '#ef4444']] : []),
      ...(r.converted_at ? [['Converted', r.converted_at, METRIC.conversions.color, r.conv_event]] : []),
    ];
  return (
    <div className="ma-detail">
      <div>
        <h5>Timeline</h5>
        <ul className="ma-tl">
          {steps.map(([label, at, color, note]) => (
            <li key={label} data-off={at ? undefined : '1'}>
              <i style={{ background: color }} />
              <b>{label}</b>
              <span>{at ? fmtDateTime(at) : '—'}{note ? ` · ${note}` : ''}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h5>Details</h5>
        <dl className="ma-kv">
          <dt>{r.kind === 'journey' ? 'Journey' : r.kind === 'support' ? 'Sent by' : r.kind === 'transactional' ? 'Email type' : 'Campaign'}</dt>
          <dd>
            <button className="ma-link" onClick={() => onOpenSource(r)}>{r.source_name}</button>
            <span style={{ color: '#94a3b8' }}> · ID {r.sid}</span>
          </dd>
          {r.step && r.kind === 'support' && <><dt>Ticket</dt><dd>{r.step}</dd></>}
          {r.step && r.kind === 'transactional' && <><dt>Sent from</dt><dd>{r.step} · contact@internshipstudio.com (SMTP)</dd></>}
          {r.step && !['support', 'transactional'].includes(r.kind) && <><dt>Step</dt><dd>{r.step} <span style={{ color: '#94a3b8' }}>({r.node_id})</span></dd></>}
          {r.kind === 'support' && <><dt>From</dt><dd>contact@internshipstudio.com (SMTP)</dd></>}
          <dt>Channel</dt><dd>{STREAM[r.stream].label}</dd>
          <dt>Provider</dt><dd>{r.provider_label || '—'}</dd>
          {r.subject && <><dt>{isWa ? 'Template' : 'Subject'}</dt><dd>{r.subject}</dd></>}
          <dt>{isWa ? 'Phone' : 'Email'}</dt><dd>{r.contact || '—'}</dd>
          {r.user_id && r.user_id !== '0' && <><dt>User ID</dt><dd>{r.user_id}</dd></>}
          {r.message_id && (
            <><dt>Message ID</dt>
              <dd><code>{r.message_id}</code> <button className="ma-link" style={{ fontSize: 11.5 }} onClick={() => copy(r.message_id)}>Copy</button></dd></>
          )}
          {r.conv_event && <><dt>Goal event</dt><dd>{r.conv_event}{r.revenue > 0 ? ` · ${inr(r.revenue)}` : ''}</dd></>}
          {r.error && <><dt>Reason</dt><dd style={{ color: '#b91c1c' }}>{r.error}</dd></>}
        </dl>
      </div>
    </div>
  );
}

/**
 * The people behind one stat tile, across every campaign and journey the page's filters allow.
 * The metric can be switched inside the drawer, the list narrowed to one channel/source, searched,
 * and paged; each row expands into its full delivery timeline.
 */
export default function StatDrawer({ metric: initialMetric, channel, source, range, totals, providers = [], onClose, onOpenSource }) {
  const [closing, setClosing] = useState(false);
  const [metric, setMetric] = useState(initialMetric);
  const [stream, setStream] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(null);
  const seq = useRef(0);

  const close = useCallback(() => { setClosing(true); setTimeout(onClose, 230); }, [onClose]);
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [close]);

  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); setOpen(null); }, [metric, stream, debounced, perPage]);
  useEffect(() => { setStream(''); }, [metric]);

  useEffect(() => {
    const my = ++seq.current;
    setBusy(true);
    api.get(API, { params: {
      action: 'people_all', metric, channel, source, stream, search: debounced, page, per_page: perPage,
      ...rangeParams(range), ...providerParam(providers), _t: Date.now(),
    } })
      .then(r => { if (my === seq.current && r.data?.success) setData(r.data.data); })
      .catch(() => {})
      .finally(() => { if (my === seq.current) setBusy(false); });
  }, [metric, channel, source, stream, debounced, page, perPage, range, providers]);

  const t = TAB[metric];
  const counts = data?.counts || {};
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const streamsShown = STREAMS.filter(s => s.key in counts);
  const filterText = [
    channel === 'all' ? 'Email + WhatsApp' : channel === 'email' ? 'Email' : 'WhatsApp',
    { all: 'every source', campaign: 'campaigns', journey: 'journeys', support: 'Freshdesk (SMTP)', transactional: 'refund & project emails' }[source] || source,
    ...(providers.length ? [providers.map(k => PROVIDER[k]?.label || k).join(', ')] : []),
  ].join(' · ');
  const tileValue = k => (totals ? (k === 'rejected' ? totals.failed + totals.bounced : totals[k]) : null);

  return createPortal(
    <div className="ma-portal">
      <div className="ma-scrim" data-closing={closing ? '1' : undefined} onClick={close} />
      <aside className="ma-drawer" role="dialog" aria-modal="true" aria-label={`${t.label} — people`} data-closing={closing ? '1' : undefined}>
        <div className="ma-drawer-h" style={{ flexDirection: 'column', gap: 0, paddingBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%' }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: `${t.color}1f`, color: t.color, flex: 'none' }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16.5 5.4a3.2 3.2 0 0 1 0 5.2M17 14.3A5.2 5.2 0 0 1 21 20" /></svg>
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2>{t.label} <span style={{ color: '#94a3b8', fontWeight: 600 }}>· {data ? nf(allCount) : '…'} {metric === 'conversions' ? 'conversions' : 'messages'}</span></h2>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                {rangeLabel(range)} · {filterText}{data?.took_ms != null ? ` · ${data.took_ms} ms` : ''}
              </div>
            </div>
            <button className="ma-x" onClick={close} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="ma-mtabs" role="tablist" aria-label="Metric">
            {STAT_TABS.map(x => (
              <button key={x.key} role="tab" className="ma-chip ma-rip" onPointerDown={ripple} style={{ '--c': x.color }}
                      data-on={metric === x.key ? '1' : undefined} onClick={() => setMetric(x.key)}>
                <i />{x.label}{tileValue(x.key) != null && <span className="cnt">{nf(tileValue(x.key))}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="ma-drawer-b" style={{ paddingTop: 14 }}>
          <div className="ma-card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '12px 14px' }}>
              <div className="ma-chips" style={{ flex: '1 1 auto' }}>
                <button className="ma-chip ma-rip" onPointerDown={ripple} style={{ '--c': '#1e3a8a' }} data-on={!stream ? '1' : undefined} onClick={() => setStream('')}>
                  All<span className="cnt">{data ? nf(allCount) : '…'}</span>
                </button>
                {streamsShown.map(s => (
                  <button key={s.key} className="ma-chip ma-rip" onPointerDown={ripple} style={{ '--c': s.color }} data-on={stream === s.key ? '1' : undefined} onClick={() => setStream(s.key)}>
                    <i />{s.label}<span className="cnt">{nf(counts[s.key])}</span>
                  </button>
                ))}
              </div>
              <div className="ma-search" style={{ maxWidth: 280 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, email, phone or campaign" />
              </div>
            </div>

            <div className="ma-tablewrap" style={{ borderTop: '1px solid #eef2f7' }}>
              <table className="ma-table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }} />
                    <th className="l">Person</th>
                    <th className="l">Campaign / Journey</th>
                    <th className="l">Status</th>
                    <th className="l">Provider</th>
                    <th>{metric === 'conversions' ? 'Converted' : 'When'}</th>
                  </tr>
                </thead>
                <tbody>
                  {!data && busy && Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}><td /><td className="l"><Skel w={150} /><br /><Skel w={110} h={9} /></td><td className="l"><Skel w={170} /></td><td className="l"><Skel w={70} h={18} r={9} /></td><td className="l"><Skel w={80} /></td><td><Skel w={90} /></td></tr>
                  ))}
                  {data && data.rows.map(r => {
                    const key = `${r.stream}:${r.rid}`;
                    const isOpen = open === key;
                    const st = STREAM[r.stream];
                    return (
                      <Fragment key={key}>
                        <tr data-click data-open={isOpen ? '1' : undefined} className={isOpen ? 'ma-row-open' : undefined} tabIndex={0}
                            onClick={() => setOpen(isOpen ? null : key)} onKeyDown={e => { if (e.key === 'Enter') setOpen(isOpen ? null : key); }}
                            aria-expanded={isOpen}>
                          <td style={{ paddingRight: 0 }}>
                            <span className="ma-caret"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg></span>
                          </td>
                          <td className="l">
                            <b style={{ fontWeight: 650, color: '#0f172a' }}>{r.name || '—'}</b>
                            <span className="sub">{r.contact || '—'}</span>
                          </td>
                          <td className="l" style={{ maxWidth: 300 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                              <span style={{ color: r.channel === 'whatsapp' ? '#059669' : '#4f46e5', display: 'inline-flex', flex: 'none' }}><ChannelIcon channel={r.channel} size={13} /></span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: '#334155' }} title={r.source_name}>{r.source_name}</span>
                            </span>
                            <span className="sub" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <KindIcon kind={r.kind} size={10} />{st.short}{r.step ? ` · ${r.step}` : ''}
                            </span>
                          </td>
                          <td className="l"><StatusPill status={r.status} /></td>
                          <td className="l" style={{ color: '#64748b' }}>{busy ? <DotLoader /> : (r.provider_label || '—')}</td>
                          <td>{busy ? <DotLoader /> : fmtDateTime(r.at)}</td>
                        </tr>
                        {isOpen && (
                          <tr><td colSpan={6} style={{ padding: 0 }}><Detail r={r} onOpenSource={onOpenSource} /></td></tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {data && !data.rows.length && !busy && (
                    <tr><td colSpan={6}><Empty title="No one here" sub={debounced ? 'Nobody matches that search.' : 'Nothing for this stat in the selected range and filters.'} /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {data && <Pagination page={data.page} pages={data.pages} total={data.total} perPage={perPage} onPage={p => { setPage(p); setOpen(null); }} onPerPage={setPerPage} sizes={[25, 50, 100]} />}
          </div>
          {metric === 'conversions' && (
            <div className="ma-note" style={{ marginTop: 12, background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
              Conversions are dated by when the goal event happened, not by when the message was sent — so a conversion today can come from a message sent earlier.
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
