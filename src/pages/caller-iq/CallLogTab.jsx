import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { nf, ripple, Skel, Empty, Pagination } from '../netcore/analytics/maShared';
import {
  ciq, errText, TYPE, TypeBadge, OutcomePill, Avatar, Ic, fmtPhone, fmtWhen, fmtAgo, fmtDur, fmtClock, telHref, waHref,
  simText, simSourceText, tagOriginText, StudentChip, typeIcon, directionWord, endedBy,
  ciqCached, ciqMatchNumbers,
} from './ciqShared';
import { useAuth } from '../../hooks/useAuth';

/*
 * The call log. Server-sorted and paginated; which numbers belong to a registered student is looked
 * up in a second request after the rows paint, so a slow `users` scan never holds the table back.
 */

const COLS = [
  ['type', 'l', 'Type'], ['number', 'l', 'Number'], ['agent', 'l', 'Agent'], ['time', 'l', 'When'],
  ['duration', '', 'Duration'], ['outcome', 'l', 'Outcome'], [null, 'l', 'Follow-up'],
];

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function CallLogTab({ rangeBody, filters, fKey, deviceById, reloadTick, onOpenNumber }) {
  const { hasPermission } = useAuth();
  const canSearch = !!hasPermission?.('all_students');
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState({ key: 'time', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [students, setStudents] = useState({});
  const [exporting, setExporting] = useState(false);
  const req = useRef(0);

  useEffect(() => { setPage(1); }, [fKey, sort, perPage]);

  const load = useCallback(async () => {
    const my = ++req.current;
    setBusy(true); setError(null);
    try {
      const d = await ciqCached('calls', { range: rangeBody, filters, sort: sort.key, dir: sort.dir, page, per_page: perPage });
      if (my !== req.current) return;
      setRows(d.rows); setTotal(d.total);
      const nums = [...new Set(d.rows.map(r => r.number_norm).filter(n => n && n.length >= 10))];
      if (nums.length) ciqMatchNumbers(nums).then(m => { if (my === req.current) setStudents(s => ({ ...s, ...m })); }).catch(() => {});
    } catch (e) { if (my === req.current) setError(errText(e)); } finally { if (my === req.current) setBusy(false); }
  }, [fKey, sort, page, perPage]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load, reloadTick]);

  const toggleSort = k => setSort(s => (s.key === k ? { key: k, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key: k, dir: ['number', 'agent', 'outcome', 'type'].includes(k) ? 'asc' : 'desc' }));
  const agentLabel = id => deviceById[id]?.label || (id ? `Phone ${id.slice(0, 6)}` : 'Unidentified phone');

  const exportCsv = async () => {
    setExporting(true);
    try {
      const d = await ciq('calls', { range: rangeBody, filters, sort: sort.key, dir: sort.dir, export: 1 });
      const head = ['Call time', 'Type', 'Number', 'Duration (sec)', 'Duration', 'Agent', 'Team', 'SIM', 'Carrier', 'SIM matched by',
        'Outcome', 'Tagged from', 'Notes', 'Synced at'];
      const lines = [head.join(',')].concat(d.rows.map(r => [
        r.call_at, TYPE[r.call_type]?.label || r.call_type, r.number, r.duration_sec, fmtClock(r.duration_sec), agentLabel(r.device_id),
        deviceById[r.device_id]?.team || '', simText(r), r.carrier, simSourceText(r.sim_source).label,
        r.outcome || '', tagOriginText(r), r.notes || '', r.last_synced_at,
      ].map(csvCell).join(',')));
      // Leading BOM so Excel opens the file as UTF-8.
      const blob = new Blob([String.fromCharCode(0xfeff), lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `caller-iq-calls-${rangeBody.from}-to-${rangeBody.to}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast.success(`Exported ${nf(d.rows.length)} calls${d.total > d.rows.length ? ` (first ${nf(d.rows.length)} of ${nf(d.total)})` : ''}`);
    } catch (e) { toast.error(errText(e)); } finally { setExporting(false); }
  };

  const pages = Math.max(1, Math.ceil(total / perPage));
  const first = rows === null;

  return (
    <div className="ma-card ciq-tablecard">
      <div className="ma-card-h" style={{ paddingBottom: 10 }}>
        <div>
          <h3>Call log</h3>
          <small>{first ? 'Loading…' : `${nf(total)} calls · click a row for the number's full history, or an outcome to tag it`}</small>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {busy && !first && <span className="ma-dots"><i /><i /><i /></span>}
          <button className="ma-btn sm ma-rip" onPointerDown={ripple} onClick={exportCsv} disabled={exporting || !total}>
            {Ic.download}{exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>
      {error && <div className="ma-note" style={{ margin: '0 14px 10px', background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }}>{error}</div>}
      <div className="ma-tablewrap" style={{ borderTop: '1px solid #eef2f7' }}>
        <table className="ma-table">
          <thead>
            <tr>
              {COLS.map(([k, cls, l]) => (
                <th key={l} className={cls} data-sort={k ? '1' : undefined} data-active={sort.key === k ? '1' : undefined} onClick={k ? () => toggleSort(k) : undefined}
                    aria-sort={sort.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {l}{k && <span className="arr" style={{ transform: sort.key === k && sort.dir === 'asc' ? 'rotate(180deg)' : undefined }}>▾</span>}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody style={{ opacity: busy && !first ? 0.6 : 1, transition: 'opacity .2s' }}>
            {first && Array.from({ length: 10 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 8 }).map((__, j) => <td key={j} className="l"><Skel w={[70, 140, 120, 110, 50, 90, 80, 40][j]} /></td>)}</tr>
            ))}
            {!first && !rows.length && <tr><td colSpan={8}><Empty title="No calls match" sub="Widen the date range or clear a filter." /></td></tr>}
            {!first && rows.map(r => {
              const agent = agentLabel(r.device_id);
              const stu = students[r.number_norm];
              const missed = r.call_type === 'MISSED' || r.call_type === 'REJECTED';
              const type = TYPE[r.call_type] || TYPE.UNKNOWN;
              const dir = directionWord(r.call_type);
              const ended = endedBy(r);
              const open = extra => onOpenNumber({ number_norm: r.number_norm, number: r.number, focusId: r.id, ...extra });
              return (
                <tr key={r.id} data-click tabIndex={0} onClick={() => open()} onKeyDown={e => { if (e.key === 'Enter') open(); }}>
                  <td className="l">
                    <TypeBadge type={r.call_type} />
                    {/* Who ended it, where Android records that — a rejected call was declined on
                        the counselor's phone, a missed one was rung off by the caller. */}
                    {ended && <span className="sub ciq-endedby" data-by={ended.by} title={ended.long}>{ended.short}</span>}
                  </td>
                  <td className="l">
                    <div className="ciq-num">
                      <b>
                        <span className="ciq-dir" style={{ background: type.bg, color: type.fg }} title={`${dir === 'to' ? 'Called out to' : 'Received from'} this number`}>
                          {typeIcon(r.call_type, 11)}
                        </span>
                        <span className="ciq-dir-word">{dir}</span>
                        {fmtPhone(r.number)}
                      </b>
                      <div className="meta">
                        {stu && <StudentChip student={stu} number={r.number_norm} canSearch={canSearch} />}
                        {r.number_calls > 1 && <span title="Calls with this number, all time">{nf(r.number_calls)} calls</span>}
                        {r.number_calls === 1 && <span style={{ color: '#6366f1' }}>first call</span>}
                      </div>
                    </div>
                  </td>
                  <td className="l">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={agent} size={26} />
                      <span><b style={{ fontWeight: 600, color: '#0f172a' }}>{agent}</b>
                        <span className="sub" style={r.sim_slot ? undefined : { color: '#b45309' }}
                              title={`${simText(r)}${r.carrier ? ` · ${r.carrier}` : ''} — ${simSourceText(r.sim_source).hint}`}>
                          {simText(r)}{r.carrier ? ` · ${r.carrier}` : ''}
                        </span></span>
                    </span>
                  </td>
                  <td className="l" title={r.call_at}>{fmtWhen(r.call_at)}<span className="sub">{fmtAgo(r.call_at)}</span></td>
                  <td>
                    {r.duration_sec > 0 ? (
                      <span className="ciq-dur"><span>{fmtClock(r.duration_sec)}</span>
                        <span className="mini"><span style={{ width: `${Math.min(100, (r.duration_sec / 600) * 100)}%` }} /></span></span>
                    ) : r.ring_sec > 0 ? (
                      /* A missed call that rang — its ringing, never shown as talk time. */
                      <span className="zero" title="How long it rang. Nobody spoke, so it counts as 0 talk time.">rang {fmtClock(r.ring_sec)}</span>
                    ) : <span className="zero">—</span>}
                  </td>
                  <td className="l" onClick={e => e.stopPropagation()}>
                    <OutcomePill outcome={r.outcome} onClick={() => open({ edit: true })} />
                    {r.outcome && <span className="sub">{tagOriginText(r)}</span>}
                  </td>
                  <td className="l">
                    {missed && r.number_norm ? (r.returned_at
                      ? <span className="ciq-ok" title={r.returned_at}>{Ic.tick} Returned in {fmtDur((new Date(r.returned_at.replace(' ', 'T')) - new Date(r.call_at.replace(' ', 'T'))) / 1000)}</span>
                      : <span className="ciq-pend">{Ic.clock} Callback pending</span>)
                      : r.outcome ? <span className="sub" style={{ marginTop: 0 }}>{r.notes ? 'Has notes' : ''}</span> : <span className="zero">—</span>}
                  </td>
                  <td style={{ width: 96 }} onClick={e => e.stopPropagation()}>
                    <span className="ciq-rowacts">
                      <a className="ciq-act ma-rip" onPointerDown={ripple} href={telHref(r.number)} title="Call">{Ic.phone(13)}</a>
                      {r.number_norm && <a className="ciq-act wa ma-rip" onPointerDown={ripple} href={waHref(r.number_norm)} target="_blank" rel="noreferrer" title="WhatsApp">{Ic.wa}</a>}
                      <button className="ciq-act ma-rip" onPointerDown={ripple} onClick={() => open()} title="Open history">{Ic.arrow}</button>
                    </span>
                  </td>
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
