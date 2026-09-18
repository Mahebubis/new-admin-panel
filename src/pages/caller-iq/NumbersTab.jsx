import { useCallback, useEffect, useRef, useState } from 'react';
import { nf, ripple, Skel, Empty, Pagination } from '../netcore/analytics/maShared';
import { ciqCached, ciqMatchNumbers, errText, TYPE, OutcomePill, Avatar, Ic, typeIcon, fmtPhone, fmtAgo, fmtDur, StudentChip } from './ciqShared';
import { useAuth } from '../../hooks/useAuth';

/*
 * One row per person (phone number). The question this answers is "who are we talking to, how
 * often, and is anyone still waiting on us" — the call log answers "what happened when".
 */

const COLS = [
  ['number', 'l', 'Number'], ['total', '', 'Calls'], ['outgoing', '', 'Out'], ['incoming', '', 'In'], ['missed', '', 'Missed'],
  ['talk', '', 'Talk time'], ['agents', '', 'Agents'], ['last', 'l', 'Last contact'], [null, 'l', 'Latest outcome'],
];
const MIN_CALLS = [[0, 'Everyone'], [2, '2+ calls'], [3, '3+ calls'], [5, '5+ calls'], [10, '10+ calls']];

export default function NumbersTab({ rangeBody, filters, fKey, deviceById, reloadTick, onOpenNumber }) {
  const { hasPermission } = useAuth();
  const canSearch = !!hasPermission?.('all_students');
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState({ key: 'last', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [minCalls, setMinCalls] = useState(0);
  const [students, setStudents] = useState({});
  const req = useRef(0);

  useEffect(() => { setPage(1); }, [fKey, sort, perPage, minCalls]);

  const load = useCallback(async () => {
    const my = ++req.current;
    setBusy(true); setError(null);
    try {
      const d = await ciqCached('numbers', { range: rangeBody, filters, sort: sort.key, dir: sort.dir, page, per_page: perPage, min_calls: minCalls });
      if (my !== req.current) return;
      setRows(d.rows); setTotal(d.total);
      const nums = d.rows.map(r => r.number_norm).filter(n => n.length >= 10);
      if (nums.length) ciqMatchNumbers(nums).then(m => { if (my === req.current) setStudents(s => ({ ...s, ...m })); }).catch(() => {});
    } catch (e) { if (my === req.current) setError(errText(e)); } finally { if (my === req.current) setBusy(false); }
  }, [fKey, sort, page, perPage, minCalls]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load, reloadTick]);

  const toggleSort = k => setSort(s => (s.key === k ? { key: k, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key: k, dir: k === 'number' ? 'asc' : 'desc' }));
  const pages = Math.max(1, Math.ceil(total / perPage));
  const first = rows === null;

  return (
    <div className="ma-card ciq-tablecard">
      <div className="ma-card-h" style={{ paddingBottom: 10 }}>
        <div>
          <h3>Numbers</h3>
          <small>{first ? 'Loading…' : `${nf(total)} people contacted in this range · click a row for every call with them`}</small>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {busy && !first && <span className="ma-dots"><i /><i /><i /></span>}
          <div className="ma-chips">
            {MIN_CALLS.map(([k, l]) => (
              <button key={k} className="ma-chip ma-rip" onPointerDown={ripple} style={{ '--c': '#4f46e5' }} data-on={minCalls === k ? '1' : undefined} onClick={() => setMinCalls(k)}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      {error && <div className="ma-note" style={{ margin: '0 14px 10px', background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }}>{error}</div>}
      <div className="ma-tablewrap" style={{ borderTop: '1px solid #eef2f7' }}>
        <table className="ma-table">
          <thead>
            <tr>
              {COLS.map(([k, cls, l]) => (
                <th key={l} className={cls} data-sort={k ? '1' : undefined} data-active={sort.key === k ? '1' : undefined} onClick={k ? () => toggleSort(k) : undefined}>
                  {l}{k && <span className="arr" style={{ transform: sort.key === k && sort.dir === 'asc' ? 'rotate(180deg)' : undefined }}>▾</span>}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody style={{ opacity: busy && !first ? 0.6 : 1, transition: 'opacity .2s' }}>
            {first && Array.from({ length: 10 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 10 }).map((__, j) => <td key={j} className={j === 0 || j === 7 ? 'l' : ''}><Skel w={j === 0 ? 150 : 44} /></td>)}</tr>
            ))}
            {!first && !rows.length && <tr><td colSpan={10}><Empty title="No numbers match" sub="Widen the date range or lower the minimum calls." /></td></tr>}
            {!first && rows.map(r => {
              const stu = students[r.number_norm];
              const dev = deviceById[r.last_device];
              const lt = TYPE[r.last_type] || TYPE.UNKNOWN;
              const open = () => onOpenNumber({ number_norm: r.number_norm, number: r.number });
              return (
                <tr key={r.number_norm} data-click tabIndex={0} onClick={open} onKeyDown={e => { if (e.key === 'Enter') open(); }}>
                  <td className="l">
                    <div className="ciq-num">
                      <b>{fmtPhone(r.number)}</b>
                      <div className="meta">
                        {stu ? <StudentChip student={stu} number={r.number_norm} canSearch={canSearch} /> : <span>since {fmtAgo(r.first_at)}</span>}
                        {r.pending && <span className="ciq-pend" style={{ height: 17 }}>callback pending</span>}
                      </div>
                    </div>
                  </td>
                  <td><b style={{ color: '#0f172a' }}>{nf(r.total)}</b><span className="sub">{nf(r.connected)} connected</span></td>
                  <td className={r.outgoing ? '' : 'zero'}>{nf(r.outgoing)}</td>
                  <td className={r.incoming ? '' : 'zero'}>{nf(r.incoming)}</td>
                  <td className={r.missed ? 'bad' : 'zero'}>{nf(r.missed)}</td>
                  <td className={r.talk_sec ? '' : 'zero'}>{fmtDur(r.talk_sec)}</td>
                  <td className={r.agents > 1 ? '' : 'zero'} title={r.agents > 1 ? 'Spoke with more than one agent' : undefined}>{nf(r.agents)}</td>
                  <td className="l">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ color: lt.fg, display: 'inline-flex' }} title={lt.label}>{typeIcon(r.last_type, 13)}</span>
                      <span>{fmtAgo(r.last_at)}<span className="sub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Avatar name={dev?.label || 'Unidentified'} size={14} />{dev?.label || 'Unidentified phone'}</span></span>
                    </span>
                  </td>
                  <td className="l"><OutcomePill outcome={r.last_outcome || null} /></td>
                  <td style={{ width: 30 }}><span className="ma-go">{Ic.arrow}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={Math.min(page, pages)} pages={pages} total={total} perPage={perPage} onPage={setPage} onPerPage={setPerPage} sizes={[25, 50, 100, 200]} />
    </div>
  );
}
