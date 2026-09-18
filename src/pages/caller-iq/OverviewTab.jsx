import { useMemo, useState } from 'react';
import { BarChart, Bar, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { nf, compact, pctText, rate, fmtBucket, fmtBucketLong, ripple, Skel, Empty } from '../netcore/analytics/maShared';
import {
  TYPE, MAIN_TYPES, OUTCOMES, DURATION_BUCKETS, outcomeColor, fmtDur, fmtAgo, fmtPhone, simSourceText,
  SideDonut, Heatmap, Avatar, Ic,
} from './ciqShared';

/*
 * Overview — sized to land on one 1080p screen: trend + two pies, then heatmap + leaderboard +
 * callback queue. The third row (durations, SIMs, follow-up health) sits just below the fold.
 * Every mark is a way into the data: slices, bars, cells and rows all narrow the page or open
 * the thing behind them.
 */

const DUR_RANGES = [[0, 0], [1, 30], [31, 60], [61, 180], [181, 300], [301, 600], [601, '']];
const TREND = [['calls', 'Calls'], ['talk', 'Talk time'], ['rate', 'Connect rate']];

function Tip({ active, payload, label, gran, mode }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="ma-tip">
      <b>{fmtBucketLong(label, gran)}</b>
      {mode === 'calls' && <>
        {[...payload].reverse().map(p => <div className="r" key={p.dataKey}><i style={{ background: p.color }} /><span>{TYPE[p.dataKey.toUpperCase()]?.label || 'Other'}</span>{nf(p.value)}</div>)}
        <div className="r tot"><span>Total</span>{nf(row.total)}</div>
      </>}
      {mode === 'talk' && <div className="r"><i style={{ background: '#4f46e5' }} /><span>Talk time</span>{fmtDur(row.talk_sec)}</div>}
      {mode === 'rate' && <div className="r"><i style={{ background: '#059669' }} /><span>Connected</span>{nf(row.connected)} of {nf(row.total)} · {pctText(row.connected, row.total)}</div>}
    </div>
  );
}

function Card({ title, sub, right, children, style, bodyStyle }) {
  return (
    <div className="ma-card ciq-card-fill" style={style}>
      <div className="ma-card-h"><div><h3>{title}</h3>{sub && <small>{sub}</small>}</div>{right}</div>
      <div className="ma-card-b" style={bodyStyle}>{children}</div>
    </div>
  );
}

function Meter({ label, value, base, color, hint, onClick }) {
  const p = rate(value, base);
  return (
    <div className="ciq-bar" data-click={onClick ? '1' : undefined} onClick={onClick} title={hint} style={{ gridTemplateColumns: '128px minmax(0,1fr) 44px' }}>
      <span className="lb">{label}</span>
      <span className="tr"><span style={{ width: `${Math.min(100, p)}%`, background: color }} /></span>
      <span className="v">{base > 0 ? pctText(value, base) : '—'}</span>
    </div>
  );
}

export default function OverviewTab({ data, loading, deviceById, filters, onFilter, onOpenNumber, onOpenAgent }) {
  const [trend, setTrend] = useState('calls');
  const T = data?.totals || {};
  const gran = data?.range?.granularity || 'day';
  const first = loading && !data;

  const series = useMemo(() => (data?.series || []).map(r => ({
    ...r, talk_min: Math.round((r.talk_sec / 60) * 10) / 10, rate: r.total ? Math.round((r.connected / r.total) * 1000) / 10 : null,
  })), [data]);

  const agents = useMemo(() => (data?.agents || []).map(a => ({ ...a, dev: deviceById[a.device_id] || { device_id: a.device_id, label: a.device_id ? `Phone ${a.device_id.slice(0, 6)}` : 'Unidentified phone' } })), [data, deviceById]);
  const maxAgent = Math.max(1, ...agents.map(a => a.total));
  const durations = DURATION_BUCKETS.map((l, k) => ({ l, k, n: (data?.durations || []).find(d => d.k === k)?.n || 0 }));
  const maxDur = Math.max(1, ...durations.map(d => d.n));
  const sims = data?.sims || [];
  const maxSim = Math.max(1, ...sims.map(s => s.total));
  const answeredIn = T.incoming || 0;
  const inboundAll = answeredIn + (T.missed || 0) + (T.rejected || 0);
  const tag = data?.tagging || {};
  const tagged = T.tagged || 0;
  // Everything except tags typed here in the panel counts as "the counselor tagged it themselves".
  const onPhone = (tag.via_popup || 0) + (tag.via_notification || 0) + (tag.via_app || 0) + (tag.via_legacy || 0);

  const typeRows = [...MAIN_TYPES.map(t => ({ key: t.key, label: t.label, value: T[t.key.toLowerCase()] || 0, color: t.color })),
    { key: 'OTHER', label: 'Blocked / other', value: T.other || 0, color: '#94a3b8' }];
  const outcomeRows = (data?.outcomes || []).map(o => ({ key: o.o || '__none__', label: o.o || 'Untagged', value: o.n, color: outcomeColor(o.o) }))
    .sort((a, b) => (a.key === '__none__') - (b.key === '__none__') || OUTCOMES.findIndex(x => x.key === a.key) - OUTCOMES.findIndex(x => x.key === b.key));

  if (data && !T.total && !loading) {
    return (
      <div className="ma-card" style={{ padding: 10 }}>
        <Empty title={data.meta?.all_calls ? 'No calls match this range and filters' : 'No calls have synced yet'}
               sub={data.meta?.all_calls ? 'Widen the date range or clear a filter.' : 'Connect a counselor’s phone to start collecting calls.'} />
      </div>
    );
  }

  return (
    <>
      <div className="ciq-grid ciq-r1">
        <Card title="Call volume" sub={`Per ${gran} · ${trend === 'calls' ? 'stacked by call type' : trend === 'talk' ? 'minutes on connected calls' : 'share of calls that connected'}`}
              right={<div className="ma-chips">{TREND.map(([k, l]) => (
                <button key={k} className="ma-chip ma-rip" onPointerDown={ripple} data-on={trend === k ? '1' : undefined} onClick={() => setTrend(k)} style={{ '--c': '#4f46e5' }}>{l}</button>
              ))}</div>}
              bodyStyle={{ height: 222, paddingTop: 6 }}>
          {first ? <Skel h={200} r={10} /> : (
            <ResponsiveContainer width="100%" height="100%">
              {trend === 'calls' ? (
                <BarChart data={series} margin={{ top: 6, right: 4, left: -14, bottom: 0 }} barCategoryGap="22%">
                  <CartesianGrid stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="b" tickFormatter={b => fmtBucket(b, gran === 'week' ? 'day' : gran)} tick={{ fontSize: 10.5, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={14} />
                  <YAxis tickFormatter={compact} tick={{ fontSize: 10.5, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
                  <Tooltip content={<Tip gran={gran === 'week' ? 'day' : gran} mode="calls" />} cursor={{ fill: '#f1f5ff' }} />
                  {['outgoing', 'incoming', 'missed', 'rejected'].map(k => (
                    <Bar key={k} dataKey={k} stackId="t" fill={TYPE[k.toUpperCase()].color} stroke="#fff" strokeWidth={1} maxBarSize={34} animationDuration={600} />
                  ))}
                  <Bar dataKey="other" stackId="t" fill="#cbd5e1" stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={34} animationDuration={600} />
                </BarChart>
              ) : trend === 'talk' ? (
                <AreaChart data={series} margin={{ top: 6, right: 4, left: -14, bottom: 0 }}>
                  <defs><linearGradient id="ciq-talk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4f46e5" stopOpacity={0.35} /><stop offset="1" stopColor="#4f46e5" stopOpacity={0.03} /></linearGradient></defs>
                  <CartesianGrid stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="b" tickFormatter={b => fmtBucket(b, gran === 'week' ? 'day' : gran)} tick={{ fontSize: 10.5, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={14} />
                  <YAxis tickFormatter={v => `${compact(v)}m`} tick={{ fontSize: 10.5, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<Tip gran={gran === 'week' ? 'day' : gran} mode="talk" />} cursor={{ stroke: '#c7d2fe', strokeWidth: 1.5 }} />
                  <Area type="monotone" dataKey="talk_min" stroke="#4f46e5" strokeWidth={2} fill="url(#ciq-talk)" animationDuration={600} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              ) : (
                <LineChart data={series} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="b" tickFormatter={b => fmtBucket(b, gran === 'week' ? 'day' : gran)} tick={{ fontSize: 10.5, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={14} />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10.5, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<Tip gran={gran === 'week' ? 'day' : gran} mode="rate" />} cursor={{ stroke: '#a7f3d0', strokeWidth: 1.5 }} />
                  <Line type="monotone" dataKey="rate" stroke="#059669" strokeWidth={2} dot={series.length < 40 ? { r: 3, fill: '#059669', stroke: '#fff', strokeWidth: 1.5 } : false} connectNulls animationDuration={600} />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Call types" sub="Click a slice to filter">
          {first ? <Skel h={160} r={10} /> : (
            <SideDonut data={typeRows} centerLabel="Calls" emptyText="No calls"
                       active={filters.types.length === 1 ? filters.types[0] : null}
                       onPick={r => onFilter({ types: r.key === 'OTHER' ? ['BLOCKED', 'VOICEMAIL', 'UNKNOWN'] : r.key === filters.types[0] && filters.types.length === 1 ? [] : [r.key] })} />
          )}
        </Card>

        <Card title="Call outcomes" sub={`${pctText(T.tagged, T.total)} of calls tagged`}>
          {first ? <Skel h={160} r={10} /> : (
            <SideDonut data={outcomeRows} centerLabel="Calls" emptyText="No outcomes yet"
                       active={filters.outcomes.length === 1 ? filters.outcomes[0] : null}
                       onPick={r => onFilter({ outcomes: filters.outcomes.length === 1 && filters.outcomes[0] === r.key ? [] : [r.key] })} />
          )}
        </Card>
      </div>

      <div className="ciq-grid ciq-r2">
        <Card title="Busiest hours" sub="Calls by weekday and hour · click a cell to see those calls">
          {first ? <Skel h={190} r={10} /> : <Heatmap cells={data?.heatmap} onPick={(d, h) => onFilter({ weekdays: [d], hour_from: h, hour_to: h }, 'calls')} />}
        </Card>

        <Card title="Agent leaderboard" sub="Click an agent for their full report" bodyStyle={{ paddingTop: 8 }}
              right={<span className="ma-updated">{nf(agents.length)} {agents.length === 1 ? 'phone' : 'phones'}</span>}>
          {first ? <Skel h={190} r={10} /> : !agents.length ? <Empty title="No agents in range" /> : (
            <div className="ciq-scroll" style={{ maxHeight: 214 }}>
              <table className="ciq-lb">
                <thead><tr><th className="l">Agent</th><th>Calls</th><th>Mix</th><th>Connect</th><th>Talk</th><th>Avg</th></tr></thead>
                <tbody>
                  {agents.map((a, i) => (
                    <tr key={a.device_id} onClick={() => onOpenAgent(a.dev)} title={`${a.outgoing} out · ${a.incoming} in · ${a.missed + a.rejected} missed`}>
                      <td className="l">
                        <span className="who">
                          <span style={{ width: 14, color: '#94a3b8', fontSize: 10.5, textAlign: 'right' }}>{i + 1}</span>
                          <Avatar name={a.dev.label} size={24} /><b>{a.dev.label}</b>
                        </span>
                      </td>
                      <td>
                        <b style={{ color: '#0f172a' }}>{nf(a.total)}</b>
                        <span className="ciq-stack" style={{ width: 54, height: 3, marginTop: 3 }}><i style={{ width: `${(a.total / maxAgent) * 100}%`, background: '#4f46e5' }} /></span>
                      </td>
                      <td>
                        <span className="ciq-stack">
                          {[['outgoing', 'OUTGOING'], ['incoming', 'INCOMING'], ['missed', 'MISSED'], ['rejected', 'REJECTED']].map(([k, t]) => a[k] > 0 &&
                            <i key={k} style={{ width: `${(a[k] / a.total) * 100}%`, background: TYPE[t].color }} />)}
                        </span>
                      </td>
                      <td>{pctText(a.connected, a.total)}</td>
                      <td>{fmtDur(a.talk_sec)}</td>
                      <td>{a.connected ? fmtDur(a.talk_sec / a.connected) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Callback queue" sub={T.returned_calls ? `Missed calls returned in ${fmtDur(T.avg_return_sec)} on average` : 'Missed & rejected calls nobody has returned'}
              right={T.pending_numbers > 0 && (
                <button className="ma-btn sm ma-rip" onPointerDown={ripple} onClick={() => onFilter({ callback: 'pending' }, 'calls')}>
                  <span className="ciq-pend" style={{ height: 18 }}>{nf(T.pending_numbers)}</span> View all
                </button>
              )}
              bodyStyle={{ paddingTop: 6 }}>
          {first ? <Skel h={190} r={10} /> : !(data?.queue || []).length ? (
            <div style={{ height: 200, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
              <div><div style={{ width: 44, height: 44, borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'grid', placeItems: 'center', margin: '0 auto 8px' }}>{Ic.tick}</div>
                <b style={{ fontSize: 13 }}>All caught up</b><div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Every missed call has been returned.</div></div>
            </div>
          ) : (
            <div className="ciq-list ciq-scroll" style={{ maxHeight: 214 }}>
              {data.queue.map(q => {
                const dev = deviceById[q.last_device];
                return (
                  <button key={q.number_norm} className="ciq-li ma-rip" onPointerDown={ripple} onClick={() => onOpenNumber({ number_norm: q.number_norm, number: q.number })}>
                    <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: '#fef2f2', color: '#dc2626' }}>{Ic.MISSED(14)}</span>
                    <span style={{ minWidth: 0 }}>
                      <b>{fmtPhone(q.number)}</b>
                      <small>{q.attempts > 1 ? `${q.attempts} missed · ` : ''}{dev?.label || 'Unidentified phone'}</small>
                    </span>
                    <span className="end">{fmtAgo(q.last_at)}<small>waiting</small></span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="ciq-grid ciq-r3">
        <Card title="Call duration" sub="Click a band to see those calls">
          {first ? <Skel h={150} r={10} /> : (
            <div className="ciq-bars">
              {durations.map(d => (
                <div key={d.k} className="ciq-bar" data-click="1" onClick={() => onFilter({ min_dur: DUR_RANGES[d.k][0], max_dur: DUR_RANGES[d.k][1] }, 'calls')}>
                  <span className="lb">{d.l}</span>
                  <span className="tr"><span style={{ width: `${(d.n / maxDur) * 100}%`, background: d.k === 0 ? '#cbd5e1' : '#4f46e5', opacity: d.k === 0 ? 1 : 0.45 + d.k * 0.09 }} /></span>
                  <span className="v">{nf(d.n)}</span>
                  <span className="p">{pctText(d.n, T.total)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Follow-up health" sub="How well calls are being handled">
          {first ? <Skel h={150} r={10} /> : (
            <div className="ciq-bars">
              <Meter label="Outgoing connected" value={T.out_connected} base={T.outgoing} color="#4f46e5" hint="Outgoing calls that were picked up" onClick={() => onFilter({ types: ['OUTGOING'], connected: 'yes' }, 'calls')} />
              <Meter label="Incoming answered" value={answeredIn} base={inboundAll} color="#059669" hint="Incoming ÷ (incoming + missed + rejected)" onClick={() => onFilter({ types: ['INCOMING'] }, 'calls')} />
              <Meter label="Missed called back" value={T.returned_calls} base={T.missed_calls} color="#0891b2" hint="Missed calls someone later returned" onClick={() => onFilter({ callback: 'returned' }, 'calls')} />
              <Meter label="Connected & tagged" value={T.tagged} base={T.total} color="#7c3aed" hint="Calls with an outcome tag" onClick={() => onFilter({ outcomes: ['__none__'], connected: 'yes' }, 'calls')} />
              {tagged > 0 && (
                <Meter label="Tagged on the phone" value={onPhone} base={tagged} color="#0891b2"
                       hint="Tagged from the post-call popup or the app, rather than here in the panel" />
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                <span>Longest call <b style={{ color: '#0f172a' }}>{fmtDur(T.longest_sec)}</b></span>
                <span>Pending callbacks <b style={{ color: T.pending_numbers ? '#b91c1c' : '#0f172a' }}>{nf(T.pending_numbers)}</b></span>
              </div>
              {tagged > 0 && (
                <div style={{ fontSize: 11.5, color: '#64748b' }}>
                  Tagged <b style={{ color: '#0f172a' }}>{fmtDur(tag.avg_tag_sec)}</b> after the call on average
                  {tag.tagged_fast > 0 && <> · <b style={{ color: '#0f172a' }}>{pctText(tag.tagged_fast, tagged)}</b> within 5 minutes</>}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card title="By SIM" sub="Which line the calls used">
          {first ? <Skel h={150} r={10} /> : !sims.length ? <Empty title="No calls" /> : (
            <div className="ciq-bars">
              {sims.map(s => (
                <div key={s.slot} className="ciq-bar" data-click="1" onClick={() => onFilter({ sims: [s.slot] })} style={{ gridTemplateColumns: '120px minmax(0,1fr) 52px 40px' }}
                     title={`${nf(s.outgoing)} out · ${nf(s.incoming)} in · ${nf(s.missed)} missed · ${fmtDur(s.talk_sec)} talk`}>
                  <span className="lb" style={s.slot ? undefined : { color: '#b45309' }}>
                    {s.label || (s.slot ? `SIM ${s.slot}` : 'Unknown SIM')}{s.carrier ? ` · ${s.carrier}` : ''}
                  </span>
                  <span className="tr"><span style={{ width: `${(s.total / maxSim) * 100}%`, background: s.slot === 2 ? '#0891b2' : s.slot === 1 ? '#4f46e5' : '#f59e0b' }} /></span>
                  <span className="v">{nf(s.total)}</span>
                  <span className="p">{pctText(s.total, T.total)}</span>
                </div>
              ))}

              {/* How the SIM was identified. Anything but "not identified" is a real match, so this
                  line answers "can I trust the split above?" without opening a single call. */}
              {!!(data?.sim_sources || []).length && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #eef2f7' }}>
                  <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', color: '#94a3b8', fontWeight: 750, marginBottom: 6 }}>How the SIM was identified</div>
                  <div className="ma-chips">
                    {data.sim_sources.map(s => {
                      const meta = simSourceText(s.src);
                      return (
                        <span key={s.src} className="ma-chip" style={{ cursor: 'default', '--c': meta.good ? '#059669' : '#f59e0b' }} title={meta.hint} data-on="1">
                          <i />{meta.label}<span className="cnt">{nf(s.n)}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              {T.sim_unknown > 0 && (
                <p style={{ margin: '8px 0 0', fontSize: 11, color: '#b45309' }}>
                  {nf(T.sim_unknown)} {T.sim_unknown === 1 ? 'call' : 'calls'} could not be matched to a SIM. Phones on an app build before v1.3
                  report only the raw SIM account id; update them and the slot is resolved exactly.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
