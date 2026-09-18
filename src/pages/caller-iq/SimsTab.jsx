import { useCallback, useEffect, useRef, useState } from 'react';
import { nf, ripple, Skel, Empty } from '../netcore/analytics/maShared';
import { ciqCached, errText, Ic, Avatar, fmtDur, fmtPhone, fmtAgo } from './ciqShared';

/*
 * The SIM register — which line is paid for, and until when.
 *
 * Android exposes NOTHING about a prepaid balance or a plan's validity: there is no API for it on
 * any version, because carriers keep it behind USSD codes, their own apps and SMS. So the SIMs
 * themselves are discovered from the calls (phone, slot, carrier, and the SIM's own number where
 * the network wrote one), and the plan — what was paid, when, how long it runs — is recorded by
 * whoever tops it up. What the dashboard adds is the part a person cannot do: watch every SIM in
 * the fleet at once and say which ones are about to go dead.
 */

const STATUS = {
  expired: { label: 'Expired', color: '#b91c1c', bg: '#fef2f2', dot: '#ef4444' },
  soon: { label: 'Expiring', color: '#b45309', bg: '#fffbeb', dot: '#f59e0b' },
  active: { label: 'Active', color: '#047857', bg: '#ecfdf5', dot: '#10b981' },
  unknown: { label: 'Not recorded', color: '#64748b', bg: '#f1f5f9', dot: '#cbd5e1' },
};

const fmtDate = d => {
  if (!d) return '—';
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
};

const daysText = s => {
  if (s.days_left === null || s.days_left === undefined) return 'no date recorded';
  if (s.days_left < 0) return `lapsed ${Math.abs(s.days_left)} day${Math.abs(s.days_left) === 1 ? '' : 's'} ago`;
  if (s.days_left === 0) return 'runs out today';
  return `${s.days_left} day${s.days_left === 1 ? '' : 's'} left`;
};

export default function SimsTab({ rangeBody, filters, fKey, reloadTick, onEdit }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const req = useRef(0);

  const load = useCallback(async () => {
    const my = ++req.current;
    setBusy(true); setError(null);
    try {
      const d = await ciqCached('sims', { range: rangeBody, filters });
      if (my === req.current) setData(d);
    } catch (e) { if (my === req.current) setError(errText(e)); } finally { if (my === req.current) setBusy(false); }
  }, [fKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load, reloadTick]);

  const sims = data?.sims || [];
  const c = data?.counts || {};

  return (
    <>
      <div className="ma-card" style={{ padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13 }}>
          <b>{nf(c.total || 0)}</b> <span style={{ color: '#64748b' }}>SIM{c.total === 1 ? '' : 's'} in use</span>
        </div>
        <div className="ciq-simcounts">
          {[['expired', c.expired], ['soon', c.soon], ['active', c.active], ['unknown', c.unknown]].map(([k, n]) => (
            n > 0 ? (
              <span key={k} className="ciq-simcount" style={{ background: STATUS[k].bg, color: STATUS[k].color }}>
                <i style={{ background: STATUS[k].dot }} />{nf(n)} {STATUS[k].label.toLowerCase()}
              </span>
            ) : null
          ))}
        </div>
        {busy && data && <span className="ma-dots"><i /><i /><i /></span>}
        <span className="ma-updated" style={{ marginLeft: 'auto' }}>
          Recharge details are recorded here — Android does not report a prepaid balance to any app
        </span>
      </div>

      {sims.some(s => s.credit_suspect) && (
        <div className="ma-note" style={{ marginBottom: 12 }}>
          {Ic.alert}
          <span>
            <b>{sims.filter(s => s.credit_suspect).map(s => `SIM ${s.slot} on ${s.agent}`).join(', ')}</b> tried outgoing calls in the
            last three days and connected none of them. That is how a prepaid SIM behaves once it runs out of credit — worth checking
            before blaming the counselor.
          </span>
        </div>
      )}
      {error && <div className="ma-note" style={{ marginBottom: 12, background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }}>{error}</div>}

      <div className="ma-card ciq-tablecard">
        <div className="ma-card-h" style={{ paddingBottom: 10 }}>
          <div>
            <h3>SIM recharge register</h3>
            <small>{data ? 'Soonest to lapse first · click a row to record a recharge' : 'Loading…'}</small>
          </div>
        </div>
        <div className="ma-tablewrap" style={{ borderTop: '1px solid #eef2f7' }}>
          <table className="ma-table">
            <thead>
              <tr>
                <th className="l">SIM</th>
                <th className="l">Phone</th>
                <th className="l">Plan</th>
                <th>Amount</th>
                <th className="l">Recharged</th>
                <th className="l">Valid till</th>
                <th className="l">Status</th>
                <th>Calls</th>
                <th>Talk</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!data && !error && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 10 }).map((__, j) => <td key={j} className={j < 6 ? 'l' : ''}><Skel w={j === 0 ? 120 : 60} /></td>)}</tr>
              ))}
              {data && !sims.length && (
                <tr><td colSpan={10}>
                  <Empty title="No SIMs seen yet" sub="A SIM appears here as soon as a call is made or received on it." />
                </td></tr>
              )}
              {sims.map(s => {
                const st = STATUS[s.status] || STATUS.unknown;
                return (
                  <tr key={`${s.device_id}|${s.slot}`} data-click tabIndex={0}
                      onClick={() => onEdit(s)} onKeyDown={e => { if (e.key === 'Enter') onEdit(s); }}>
                    <td className="l">
                      <div className="ciq-num">
                        <b>SIM {s.slot}{s.carrier ? ` · ${s.carrier}` : ''}</b>
                        <div className="meta">{s.msisdn ? fmtPhone(s.msisdn) : 'number not on the card'}</div>
                      </div>
                    </td>
                    <td className="l">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                        <Avatar name={s.agent} size={22} />
                        <span>{s.agent}{s.team && <span className="sub">{s.team}</span>}</span>
                      </span>
                    </td>
                    <td className="l">
                      {s.plan_name || <span className="zero">not recorded</span>}
                      {/* The operator's raw words, kept even when no date could be read out of
                          them — a person understands "Validity 25-Sep-26" instantly. */}
                      {!!s.auto_text && <span className="sub ciq-optext" title={s.auto_text}>“{s.auto_text}”</span>}
                    </td>
                    <td className={s.amount || s.auto_balance ? '' : 'zero'}>
                      {s.amount ? `₹${nf(Math.round(s.amount))}` : s.auto_balance ? `₹${s.auto_balance}` : '—'}
                      {!s.amount && !!s.auto_balance && <span className="sub">balance</span>}
                    </td>
                    <td className="l">{fmtDate(s.recharged_on)}</td>
                    <td className="l">
                      {fmtDate(s.effective_valid_till)}
                      {s.effective_valid_till && <span className="sub">{daysText(s)}</span>}
                      {/* Where the date came from: typed in, or read back from the carrier itself. */}
                      {s.valid_source === 'operator' && (
                        <span className="sub ciq-fromop" title={s.auto_text || 'Read from the operator’s own reply'}>
                          from {s.carrier || 'the operator'}
                          {s.auto_checked_at ? ` · ${fmtAgo(s.auto_checked_at)}` : ''}
                        </span>
                      )}
                    </td>
                    <td className="l">
                      <span className="ciq-simstatus" style={{ background: st.bg, color: st.color }}>
                        <i style={{ background: st.dot }} />{st.label}
                      </span>
                      {/* Read from the calls, not from the network: a SIM whose outgoing calls all
                          end at zero seconds is behaving exactly like one out of credit. */}
                      {s.credit_suspect && (
                        <span className="sub ciq-endedby" data-by="us"
                              title={`${s.out_tried} outgoing calls in the last 3 days, not one connected. A prepaid SIM out of credit behaves exactly like this — worth checking the recharge.`}>
                          {nf(s.out_tried)} calls, none connected
                        </span>
                      )}
                    </td>
                    <td className={s.calls ? '' : 'zero'}>{nf(s.calls)}</td>
                    <td className={s.talk_sec ? '' : 'zero'}>
                      {fmtDur(s.talk_sec)}
                      {s.last_call_at && <span className="sub">{fmtAgo(s.last_call_at)}</span>}
                    </td>
                    <td style={{ width: 90 }} onClick={e => e.stopPropagation()}>
                      <button className="ma-btn sm ma-rip" onPointerDown={ripple} onClick={() => onEdit(s)}>
                        {Ic.edit} {s.valid_till ? 'Update' : 'Record'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
