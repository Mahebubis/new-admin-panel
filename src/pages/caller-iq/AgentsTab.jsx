import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nf, pctText, ripple, Skel, Empty } from '../netcore/analytics/maShared';
import { ciqCached, errText, TYPE, Avatar, StatusDot, Sparkline, Delta, Ic, fmtDur, fmtAgo } from './ciqShared';

/*
 * Every phone that has ever synced, including ones with no calls in this range — an agent who
 * went quiet is exactly what this tab should surface, so they sort last rather than disappear.
 */

const SORTS = [['total', 'Most calls'], ['talk', 'Most talk time'], ['rate', 'Best connect rate'], ['pending', 'Most pending callbacks'], ['name', 'Name']];

export default function AgentsTab({ rangeBody, filters, fKey, reloadTick, onOpenAgent, onEdit, onSetup }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState('total');
  const [showHidden, setShowHidden] = useState(false);
  const req = useRef(0);

  const load = useCallback(async () => {
    const my = ++req.current;
    setBusy(true); setError(null);
    try {
      // The Agent filter narrows the other tabs; here every phone is listed, so drop it.
      const d = await ciqCached('agents', { range: rangeBody, filters: { ...filters, devices: [] } });
      if (my === req.current) setData(d);
    } catch (e) { if (my === req.current) setError(errText(e)); } finally { if (my === req.current) setBusy(false); }
  }, [fKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load, reloadTick]);

  const agents = useMemo(() => {
    const list = (data?.agents || []).filter(a => showHidden || !Number(a.is_hidden));
    const v = a => {
      const s = a.stats || {};
      switch (sort) {
        case 'talk': return s.talk_sec || 0;
        case 'rate': return s.total ? s.connected / s.total : -1;
        case 'pending': return a.pending_callbacks;
        default: return s.total || 0;
      }
    };
    return [...list].sort((a, b) => (sort === 'name' ? a.label.localeCompare(b.label) : v(b) - v(a) || a.label.localeCompare(b.label)));
  }, [data, sort, showHidden]);

  const popupOff = (data?.agents || []).filter(a => Number(a.popup_ok) === 0 && !Number(a.is_hidden));
  const hiddenCount = (data?.agents || []).filter(a => Number(a.is_hidden)).length;
  const online = (data?.agents || []).filter(a => a.status === 'online' && !Number(a.is_hidden)).length;
  const unidentified = (data?.agents || []).find(a => a.device_id === '' && a.stats?.total);

  return (
    <>
      <div className="ma-card" style={{ padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13 }}>
          <b>{nf(agents.length)}</b> <span style={{ color: '#64748b' }}>{agents.length === 1 ? 'phone' : 'phones'}</span>
          <span style={{ color: '#cbd5e1', margin: '0 8px' }}>|</span>
          <span className="ciq-status" data-s="online"><i />{nf(online)} synced in the last 3 hours</span>
        </div>
        {busy && data && <span className="ma-dots"><i /><i /><i /></span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="ma-seg" style={{ background: '#f1f5f9' }}>
            {SORTS.map(([k, l]) => <button key={k} onPointerDown={ripple} data-on={sort === k ? '1' : undefined} onClick={() => setSort(k)}>{l}</button>)}
          </div>
          {hiddenCount > 0 && (
            <button className="ma-btn sm ma-rip" onPointerDown={ripple} onClick={() => setShowHidden(h => !h)}>{showHidden ? 'Hide' : 'Show'} {hiddenCount} hidden</button>
          )}
          <button className="ma-btn sm primary ma-rip" onPointerDown={ripple} onClick={onSetup}>{Ic.phone(13)} Connect a phone</button>
        </div>
      </div>

      {unidentified && (
        <div className="ma-note" style={{ marginBottom: 12 }}>
          {Ic.alert}
          <span><b>{nf(unidentified.stats.total)} calls</b> in this range came from phones on the original app build, which does not send a handset ID, so they are grouped as “Unidentified phone” and their SIM cannot be identified. Install app v1.3 on those phones to split them per agent and per SIM.</span>
        </div>
      )}
      {popupOff.length > 0 && (
        <div className="ma-note" style={{ marginBottom: 12 }}>
          {Ic.alert}
          <span>
            <b>{popupOff.map(a => a.label).join(', ')}</b> {popupOff.length === 1 ? 'cannot' : 'cannot'} show the post-call popup, so
            {popupOff.length === 1 ? ' that counselor' : ' those counselors'} will not be tagging calls from the phone.
            Open CallIQ on the phone and finish <b>Post-Call Popup Setup</b> (“Display over other apps”, plus the phone maker's own pop-up and autostart switches).
          </span>
        </div>
      )}
      {error && <div className="ma-note" style={{ marginBottom: 12, background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }}>{error}</div>}

      {!data && !error && <div className="ciq-agents">{Array.from({ length: 6 }).map((_, i) => <Skel key={i} h={196} r={16} />)}</div>}
      {data && !agents.length && (
        <div className="ma-card"><Empty title="No phones connected yet" sub="Use “Connect a phone” to point the Caller IQ app at this panel." /></div>
      )}

      <div className="ciq-agents">
        {agents.map((a, i) => {
          const s = a.stats || { total: 0, outgoing: 0, incoming: 0, missed: 0, rejected: 0, talk_sec: 0, connected: 0 };
          return (
            <div key={a.device_id || '__none__'} className="ma-card ciq-agent ma-fade ma-rip" role="button" tabIndex={0} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                 data-hidden={Number(a.is_hidden) ? '1' : undefined} onPointerDown={ripple}
                 onClick={() => onOpenAgent(a)} onKeyDown={e => { if (e.key === 'Enter') onOpenAgent(a); }}>
              <button className="ciq-act ciq-edit" title="Edit agent" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onEdit(a); }}>{Ic.edit}</button>
              <div className="ciq-agent-h">
                <Avatar name={a.label} size={40} />
                <div style={{ minWidth: 0, flex: 1, paddingRight: 30 }}>
                  <b>{a.label}</b>
                  <small>{[a.team, a.agent_name && a.device_model, a.app_version && `v${a.app_version}`].filter(Boolean).join(' · ') || (a.device_id ? 'Name this agent →' : 'Original app build')}</small>
                  {/* A phone that cannot show the post-call popup quietly stops tagging anything,
                      so it is called out here rather than being noticed weeks later. */}
                  {Number(a.popup_ok) === 0 && (
                    <span className="ciq-pend" style={{ marginTop: 4 }} title="This phone reports that the post-call popup is off or not allowed. Open the app on that phone → Post-Call Popup Setup.">
                      {Ic.alert} Popup off
                    </span>
                  )}
                </div>
              </div>
              <div className="ciq-agent-kpis">
                <div><span>Calls</span><b>{nf(s.total)}</b></div>
                <div><span>Talk</span><b>{fmtDur(s.talk_sec)}</b></div>
                <div><span>Connect</span><b>{s.total ? pctText(s.connected, s.total) : '—'}</b></div>
                <div title="Missed calls nobody has returned"><span>Pending</span><b style={{ color: a.pending_callbacks ? '#b91c1c' : undefined }}>{nf(a.pending_callbacks)}</b></div>
              </div>
              <div className="ciq-stack" style={{ width: '100%', height: 6, marginBottom: 8 }} title={`${s.outgoing} out · ${s.incoming} in · ${s.missed + s.rejected} missed`}>
                {s.total ? [['outgoing', 'OUTGOING'], ['incoming', 'INCOMING'], ['missed', 'MISSED'], ['rejected', 'REJECTED']].map(([k, t]) => s[k] > 0 &&
                  <i key={k} style={{ width: `${(s[k] / s.total) * 100}%`, background: TYPE[t].color }} />) : null}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
                <div className="ciq-agent-f" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
                  <StatusDot status={a.status} />
                  <span>{s.total ? `last call ${fmtAgo(s.last_call_at)}` : `synced ${fmtAgo(a.last_seen_at)}`}</span>
                  <span>vs before: <Delta cur={s.total} prev={a.prev?.total || 0} /></span>
                </div>
                <Sparkline data={a.spark} color={s.total ? '#4f46e5' : '#cbd5e1'} width={120} height={38} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
