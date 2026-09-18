import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { nf, compact, pctText, fmtBucket, fmtBucketLong, ripple, Skel, rangeLabel } from '../netcore/analytics/maShared';
import {
  errText, Drawer, TYPE, MAIN_TYPES, outcomeColor, fmtDur, fmtAgo, fmtPhone,
  SideDonut, Heatmap, Avatar, StatusDot, Delta, Ic,
  ciqCached,
} from './ciqShared';

/*
 * One agent's report. It is the overview request with this phone added to the page's filters, so
 * every figure here is the leaderboard row it was opened from, broken down.
 */

export default function AgentDrawer({ device, range, rangeBody, filters, onClose, onEdit, onOpenNumber, onShowCalls }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const id = device.device_id === '' ? '__none__' : device.device_id;

  useEffect(() => {
    let live = true;
    ciqCached('overview', { range: rangeBody, filters: { ...filters, devices: [id] } })
      .then(d => { if (live) setData(d); })
      .catch(e => { if (live) setError(errText(e)); });
    return () => { live = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const T = data?.totals || {}; const P = data?.prev || {};
  const gran = data?.range?.granularity === 'week' ? 'day' : data?.range?.granularity || 'day';
  const tiles = [
    ['Calls', nf(T.total), <Delta key="d" cur={T.total} prev={P.total} />],
    ['Outgoing', nf(T.outgoing), <span key="s">{pctText(T.out_connected, T.outgoing)} connected</span>],
    ['Incoming', nf(T.incoming), <span key="s">{nf(T.unique_numbers)} people</span>],
    ['Missed', nf((T.missed || 0) + (T.rejected || 0)), <Delta key="d" cur={(T.missed || 0) + (T.rejected || 0)} prev={(P.missed || 0) + (P.rejected || 0)} invert />],
    ['Talk time', fmtDur(T.talk_sec), <Delta key="d" cur={T.talk_sec} prev={P.talk_sec} />],
    ['Avg call', T.connected ? fmtDur(T.talk_sec / T.connected) : '—', <span key="s">{pctText(T.tagged, T.total)} tagged</span>],
  ];

  return (
    <Drawer
      onClose={onClose}
      width={900}
      header={
        <div className="ciq-hero">
          <Avatar name={device.label} size={46} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{device.label}</h2>
            <div className="sub">
              <StatusDot status={device.status} />
              {device.team && <span className="ma-tag" style={{ background: '#eef2ff', color: '#4338ca' }}>{device.team}</span>}
              <span>{device.device_model || (device.device_id ? 'Android phone' : 'Original app build')}{device.app_version ? ` · v${device.app_version}` : ''}</span>
              <span>· synced {fmtAgo(device.last_seen_at)}</span>
            </div>
          </div>
          <button className="ma-btn sm ma-rip" onPointerDown={ripple} onClick={() => onEdit(device)}>{Ic.edit} Edit</button>
          <button className="ma-btn sm primary ma-rip" onPointerDown={ripple} onClick={() => onShowCalls(id)}>Call log {Ic.arrow}</button>
        </div>
      }
    >
      {error && <div className="ma-note" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c', marginBottom: 12 }}>{error}</div>}
      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b' }}>{rangeLabel(range)} · compared with the same length of time before it</p>

      <div className="ciq-mini-stats">
        {tiles.map(([l, v, s]) => (
          <div key={l}><span>{l}</span><b>{data ? v : <Skel w={46} h={16} />}</b><div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data ? s : ''}</div></div>
        ))}
      </div>

      <div className="ma-card" style={{ marginBottom: 12 }}>
        <div className="ma-card-h"><div><h3>Calls per {gran}</h3><small>Stacked by call type</small></div>
          <div style={{ display: 'flex', gap: 10, fontSize: 11.5, color: '#64748b' }}>
            {MAIN_TYPES.map(t => <span key={t.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: t.color }} />{t.label}</span>)}
          </div>
        </div>
        <div className="ma-card-b" style={{ height: 200 }}>
          {!data ? <Skel h={180} r={10} /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.series} margin={{ top: 6, right: 4, left: -14, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="b" tickFormatter={b => fmtBucket(b, gran)} tick={{ fontSize: 10.5, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={14} />
                <YAxis tickFormatter={compact} tick={{ fontSize: 10.5, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
                <Tooltip cursor={{ fill: '#f1f5ff' }} content={({ active, payload, label }) => (active && payload?.length ? (
                  <div className="ma-tip"><b>{fmtBucketLong(label, gran)}</b>
                    {[...payload].reverse().map(p => <div className="r" key={p.dataKey}><i style={{ background: p.color }} /><span>{TYPE[p.dataKey.toUpperCase()].label}</span>{nf(p.value)}</div>)}
                    <div className="r tot"><span>Talk time</span>{fmtDur(payload[0].payload.talk_sec)}</div>
                  </div>) : null)} />
                {['outgoing', 'incoming', 'missed', 'rejected'].map((k, i) => (
                  <Bar key={k} dataKey={k} stackId="a" fill={TYPE[k.toUpperCase()].color} stroke="#fff" strokeWidth={1} maxBarSize={30} radius={i === 3 ? [4, 4, 0, 0] : 0} animationDuration={600} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="ma-grid ma-g-2" style={{ gap: 12, marginBottom: 12 }}>
        <div className="ma-card"><div className="ma-card-h"><div><h3>Call types</h3></div></div>
          <div className="ma-card-b">{!data ? <Skel h={150} r={10} /> : (
            <SideDonut size={130} centerLabel="Calls" data={[...MAIN_TYPES.map(t => ({ key: t.key, label: t.label, value: T[t.key.toLowerCase()] || 0, color: t.color })), { key: 'o', label: 'Other', value: T.other || 0, color: '#94a3b8' }]} />
          )}</div>
        </div>
        <div className="ma-card"><div className="ma-card-h"><div><h3>Outcomes</h3></div></div>
          <div className="ma-card-b">{!data ? <Skel h={150} r={10} /> : (
            <SideDonut size={130} centerLabel="Calls" emptyText="No outcomes tagged" data={data.outcomes.map(o => ({ key: o.o || '__none__', label: o.o || 'Untagged', value: o.n, color: outcomeColor(o.o) }))} />
          )}</div>
        </div>
      </div>

      <div className="ma-grid ma-g-2" style={{ gap: 12 }}>
        <div className="ma-card"><div className="ma-card-h"><div><h3>When they call</h3><small>Weekday × hour</small></div></div>
          <div className="ma-card-b">{!data ? <Skel h={170} r={10} /> : <Heatmap cells={data.heatmap} />}</div>
        </div>
        <div className="ma-card"><div className="ma-card-h"><div><h3>Waiting on a callback</h3><small>{nf(T.pending_numbers)} {T.pending_numbers === 1 ? 'person' : 'people'} missed on this phone</small></div></div>
          <div className="ma-card-b">
            {!data ? <Skel h={170} r={10} /> : !data.queue.length ? <div style={{ height: 150, display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: 12.5 }}>All caught up</div> : (
              <div className="ciq-list ciq-scroll" style={{ maxHeight: 190 }}>
                {data.queue.map(q => (
                  <button key={q.number_norm} className="ciq-li ma-rip" onPointerDown={ripple} onClick={() => onOpenNumber({ number_norm: q.number_norm, number: q.number })}>
                    <span style={{ color: '#dc2626', display: 'inline-flex' }}>{Ic.MISSED(14)}</span>
                    <span style={{ minWidth: 0 }}><b>{fmtPhone(q.number)}</b><small>{q.attempts} missed</small></span>
                    <span className="end">{fmtAgo(q.last_at)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
