import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { nf, ripple, Skel, Empty } from '../netcore/analytics/maShared';
import { useAuth } from '../../hooks/useAuth';
import {
  ciq, ciqCached, errText, Drawer, Ic, TYPE, OUTCOMES, TypeBadge, OutcomePill, Avatar, outcomeColor, typeIcon,
  fmtPhone, fmtWhen, fmtAgo, fmtDur, fmtClock, telHref, waHref, simText, simSourceText, tagOriginText, StudentChip, endedBy,
} from './ciqShared';

/*
 * One phone number, every call with it, across every agent, all time — regardless of the page's
 * date range. This is the screen a counselor opens before calling someone back: who spoke to them
 * last, for how long, and what was agreed.
 */

function OutcomeEditor({ call, options, onSaved, onCancel }) {
  const [outcome, setOutcome] = useState(call.outcome || '');
  const [custom, setCustom] = useState('');
  const [notes, setNotes] = useState(call.notes || '');
  const [busy, setBusy] = useState(false);
  const list = [...OUTCOMES.map(o => o.key), ...options.filter(o => !OUTCOMES.some(x => x.key === o))];

  const save = async () => {
    setBusy(true);
    try {
      const res = await ciq('set_outcome', { id: call.id, outcome: custom.trim() || outcome, notes });
      toast.success(res.outcome ? `Tagged “${res.outcome}”` : 'Outcome cleared');
      onSaved(res);
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  return (
    <div className="ma-fade" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #e2e8f0' }}>
      <div className="ciq-outcome-grid">
        {list.map(o => (
          <button key={o} type="button" className="ciq-outcome-opt ma-rip" onPointerDown={ripple} style={{ '--c': outcomeColor(o) }}
                  data-on={outcome === o && !custom ? '1' : undefined} onClick={() => { setOutcome(outcome === o ? '' : o); setCustom(''); }}>
            <i />{o}
          </button>
        ))}
      </div>
      <div className="ciq-row2">
        <label className="ciq-field"><span>Or a custom tag</span>
          <input className="ciq-input" maxLength={60} value={custom} onChange={e => setCustom(e.target.value)} placeholder="e.g. Wants EMI option" /></label>
        <div />
      </div>
      <label className="ciq-field"><span>Notes</span>
        <textarea className="ciq-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="What was discussed, next step, best time to call…" /></label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {call.outcome && <button className="ma-btn sm ma-rip" style={{ marginRight: 'auto', color: '#b91c1c' }} onPointerDown={ripple} disabled={busy}
                                 onClick={() => { setOutcome(''); setCustom(''); }}>Clear tag</button>}
        <button className="ma-btn sm ma-rip" onPointerDown={ripple} onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="ma-btn sm primary ma-rip" onPointerDown={ripple} onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}

export default function NumberDrawer({ target, deviceById, outcomeOptions = [], onClose, onChanged }) {
  const { hasPermission } = useAuth();
  // The global search page and the student profile both sit behind `all_students`.
  const canSearch = !!hasPermission?.('all_students');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(target.focusId && target.edit ? target.focusId : null);
  const [typeFilter, setTypeFilter] = useState('all');

  // The drawer is keyed on its target, so one fetch per mount is enough.
  useEffect(() => {
    let live = true;
    ciqCached('number_detail', { number_norm: target.number_norm || '', number: target.number || '' })
      .then(d => { if (live) setData(d); })
      .catch(e => { if (live) setError(errText(e)); });
    return () => { live = false; };
  }, [target.number_norm, target.number]);

  useEffect(() => {
    if (!data || !target.focusId) return;
    requestAnimationFrame(() => document.getElementById(`ciq-call-${target.focusId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }, [data, target.focusId]);

  const s = data?.stats || {};
  const calls = (data?.calls || []).filter(c => typeFilter === 'all' || (typeFilter === 'MISSED' ? ['MISSED', 'REJECTED'].includes(c.call_type) : c.call_type === typeFilter));
  const agentName = id => deviceById[id]?.label || (id ? `Phone ${id.slice(0, 6)}` : 'Unidentified phone');
  const shown = fmtPhone(target.number || data?.calls?.[0]?.number || target.number_norm);
  const copy = async () => { try { await navigator.clipboard.writeText(target.number || target.number_norm); toast.success('Number copied'); } catch { toast.error('Copy blocked by the browser'); } };

  const onSaved = res => {
    setData(d => ({ ...d, calls: d.calls.map(c => (c.id === res.id ? { ...c, ...res } : c)) }));
    setEditing(null);
    onChanged?.();
  };

  return (
    <Drawer
      onClose={onClose}
      width={860}
      header={
        <div className="ciq-hero">
          <span className="ciq-hero-ic">{Ic.phone(20)}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2>{shown}</h2>
            <div className="sub">
              {data ? (
                <>
                  {/* Opens the panel's global search in a new tab — the same search as the navbar,
                      by the email `users` holds for a matched student, else by the number. */}
                  <StudentChip student={data.student} number={target.number_norm || target.number} canSearch={canSearch} />
                  {data.student && canSearch && (
                    <Link className="ciq-student" style={{ background: '#eef2ff', color: '#4338ca' }}
                          to={`/students/view/${data.student.user_id}`} target="_blank" title="Open this student's profile">
                      {Ic.arrow} Profile
                    </Link>
                  )}
                </>
              ) : <Skel w={160} h={12} />}
              {data?.pending_calls > 0 && <span className="ciq-pend">{Ic.alert} Callback pending</span>}
              {s.last_at && <span>· last contact {fmtAgo(s.last_at)}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
            <a className="ciq-act ma-rip" onPointerDown={ripple} href={telHref(target.number || target.number_norm)} title="Call">{Ic.phone(14)}</a>
            {target.number_norm && <a className="ciq-act wa ma-rip" onPointerDown={ripple} href={waHref(target.number_norm)} target="_blank" rel="noreferrer" title="Open in WhatsApp">{Ic.wa}</a>}
            <button className="ciq-act ma-rip" onPointerDown={ripple} onClick={copy} title="Copy number">{Ic.copy}</button>
          </div>
        </div>
      }
    >
      {error && <div className="ma-note" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c', marginBottom: 12 }}>{error}</div>}

      <div className="ciq-mini-stats">
        {[
          ['Total calls', nf(s.total)], ['Outgoing', nf(s.outgoing)], ['Incoming', nf(s.incoming)],
          ['Missed', nf((s.missed || 0) + (s.rejected || 0))], ['Talk time', fmtDur(s.talk_sec)], ['Agents', nf(s.agents)],
        ].map(([l, v]) => <div key={l}><span>{l}</span><b>{data ? v : <Skel w={40} h={16} />}</b></div>)}
      </div>
      {s.first_at && (
        <p style={{ margin: '-4px 0 12px', fontSize: 12, color: '#64748b' }}>
          First contact {fmtWhen(s.first_at)} · connected {nf(s.connected)} of {nf(s.total)} calls · longest {fmtClock(s.longest_sec)}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 750 }}>Call history</h3>
        <div className="ma-chips" style={{ marginLeft: 'auto' }}>
          {[['all', 'All', '#1e3a8a'], ['OUTGOING', 'Outgoing', TYPE.OUTGOING.color], ['INCOMING', 'Incoming', TYPE.INCOMING.color], ['MISSED', 'Missed', TYPE.MISSED.color]].map(([k, l, c]) => (
            <button key={k} className="ma-chip ma-rip" onPointerDown={ripple} style={{ '--c': c }} data-on={typeFilter === k ? '1' : undefined} onClick={() => setTypeFilter(k)}>
              {k !== 'all' && <i />}{l}
            </button>
          ))}
        </div>
      </div>

      {!data && !error && Array.from({ length: 4 }).map((_, i) => <Skel key={i} h={64} r={12} style={{ display: 'block', marginBottom: 10 }} />)}
      {data && !calls.length && <Empty title="No calls" sub="Nothing matches this type." />}

      <ul className="ciq-tl">
        {calls.map((c, i) => {
          const t = TYPE[c.call_type] || TYPE.UNKNOWN;
          const agent = agentName(c.device_id);
          return (
            <li key={c.id} id={`ciq-call-${c.id}`} className="ma-fade" style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
              <span className="dot" style={{ background: t.bg, color: t.fg }}>{typeIcon(c.call_type, 14)}</span>
              <div className="body" data-sel={target.focusId === c.id ? '1' : undefined}>
                <div className="row1">
                  <TypeBadge type={c.call_type} />
                  <b style={{ fontVariantNumeric: 'tabular-nums' }}>{c.duration_sec > 0 ? fmtClock(c.duration_sec) : 'Not connected'}</b>
                  {endedBy(c) && <span className="ciq-endedby" data-by={endedBy(c).by} title={endedBy(c).long}>{endedBy(c).short}</span>}
                  <span className="when" title={c.call_at}>{fmtWhen(c.call_at)}</span>
                </div>
                <div className="row2">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Avatar name={agent} size={18} />{agent}</span>
                  <span style={c.sim_slot ? undefined : { color: '#b45309' }} title={simSourceText(c.sim_source).hint}>
                    · {simText(c)}{c.carrier ? ` · ${c.carrier}` : ''}
                  </span>
                  <span style={{ marginLeft: 'auto' }}>
                    <OutcomePill outcome={c.outcome} onClick={() => setEditing(editing === c.id ? null : c.id)} />
                  </span>
                </div>
                {c.notes && editing !== c.id && <div className="note">{c.notes}</div>}
                {c.outcome && c.outcome_source && editing !== c.id && (
                  <div style={{ marginTop: 5, fontSize: 10.5, color: '#94a3b8', textAlign: 'right' }}>
                    tagged via {tagOriginText(c).toLowerCase()}{c.outcome_at ? ` · ${fmtAgo(c.outcome_at)}` : ''}
                  </div>
                )}
                {editing === c.id && <OutcomeEditor call={c} options={outcomeOptions} onSaved={onSaved} onCancel={() => setEditing(null)} />}
              </div>
            </li>
          );
        })}
      </ul>
      {data?.calls?.length >= 300 && <p style={{ fontSize: 11.5, color: '#94a3b8', textAlign: 'center' }}>Showing the latest 300 calls.</p>}
    </Drawer>
  );
}
