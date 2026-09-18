import { useCallback, useEffect, useRef, useState } from 'react';
import { nf, ripple } from '../netcore/analytics/maShared';
import { ciq, errText, Ic, TYPE, Avatar, StudentChip, fmtPhone, fmtClock, fmtAgo, typeIcon } from './ciqShared';

/*
 * Live now — the calls happening this second.
 *
 * Nothing is requested until someone asks: "See live calls" fetches once, and the Refresh beside it
 * fetches again. No polling, no background traffic, no requests at all on a page nobody is watching.
 * The timers keep counting between fetches on the browser's own clock, so a card stays truthful
 * without costing a request per second.
 *
 * The call log only exists AFTER a call ends, so this reads a separate table the phones push to as
 * a call rings, connects and ends. One thing it deliberately does not invent: the number of an
 * OUTGOING call while it is still running. Only the default dialer is told that by Android, and the
 * call-log row is written at hang-up — so the card says so, and the number appears when it ends.
 */

const STATE_META = {
  // An incoming call that is still ringing — nobody has picked it up on this phone yet.
  ringing: { label: 'Ringing (incoming)', color: '#d97706', bg: '#fffbeb', verb: 'ringing' },
  connected: { label: 'On call', color: '#059669', bg: '#ecfdf5', verb: 'talking' },
  ended: { label: 'Call ended', color: '#64748b', bg: '#f1f5f9', verb: 'lasted' },
};
/*
 * An outgoing call that is still running is shown as "Calling", with no timer.
 *
 * Android tells an ordinary app one thing about an outgoing call — that the line is off hook — and
 * that covers dialling, ringing and talking alike. There is no signal for "they picked up". So a
 * counting timer here would be the time since DIALLING, dressed up as talk time. The card waits:
 * the moment the call ends the phone reads its real duration out of the call log and sends it, and
 * that is what this then shows.
 */
const CALLING_META = { label: 'Ringing (outgoing)', color: '#4f46e5', bg: '#eef2ff', verb: 'calling' };

/** Fetches only when asked. Returns everything the strip needs to explain itself. */
export function useLiveCalls() {
  const [data, setData] = useState({ live: [], students: {}, history: {} });
  const [error, setError] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const busy = useRef(false);
  // Who a number belongs to cannot change while a call is up, and matching it against `users` is
  // the costly part, so it is asked for once per new number rather than on every refresh.
  const ctxKey = useRef('');

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const rows = (await ciq('live')).live || [];
      const key = rows.map(r => r.number_norm).filter(Boolean).sort().join(',');
      const needsContext = !!key && key !== ctxKey.current;
      const d = needsContext ? await ciq('live', { with_context: 1 }) : null;
      if (needsContext) ctxKey.current = key;
      if (!key) ctxKey.current = '';

      setData(prev => ({
        live: d ? (d.live || rows) : rows,
        students: d?.has_context ? { ...prev.students, ...(d.students || {}) } : prev.students,
        history: d?.has_context ? { ...prev.history, ...(d.history || {}) } : prev.history,
      }));
      setFetchedAt(Date.now());
      setError(null);
    } catch (e) {
      setError(errText(e));
    } finally {
      busy.current = false;
      setLoading(false);
      setHasFetched(true);
    }
  }, []);

  return { ...data, error, fetchedAt, loading, hasFetched, refresh };
}

/** A once-a-second clock, kept in state so rendering stays pure. */
function useNow(ms = 1000) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Counts on from the server's figure, so it never disagrees with the server by more than a fetch. */
function LiveTimer({ baseSec, since, frozen, className }) {
  const now = useNow();
  const secs = (!frozen && now > 0 && since > 0)
    ? Math.max(0, Math.round(baseSec + (now - since) / 1000))
    : Math.max(0, Math.round(baseSec));
  return <span className={className}>{fmtClock(secs)}</span>;
}

function LiveCard({ row, student, history, since, onOpenNumber }) {
  const isOut = row.direction === 'outgoing';
  const dialling = isOut && row.state !== 'ended';
  const meta = dialling ? CALLING_META : (STATE_META[row.state] || STATE_META.connected);
  const type = isOut ? 'OUTGOING' : row.direction === 'incoming' ? 'INCOMING' : 'UNKNOWN';
  const t = TYPE[type] || TYPE.UNKNOWN;
  const hasNumber = !!row.number;
  const open = () => hasNumber && onOpenNumber({ number_norm: row.number_norm, number: row.number });

  /*
   * Ringing counts the ring. A call being talked on — and a finished one — counts the talk time,
   * never the time since it was dialled: for an outgoing call those differ by however long it rang,
   * which is exactly the mistake this card is here to avoid. An outgoing call still in progress
   * counts nothing at all; see CALLING_META.
   */
  const base = (row.talk_sec != null && (row.state === 'connected' || row.state === 'ended'))
    ? row.talk_sec
    : row.elapsed_sec;

  return (
    <button className={`ciq-live-card ma-rip${hasNumber ? '' : ' no-click'}`} onPointerDown={ripple} onClick={open}
            data-state={row.state} data-stale={row.stale ? '1' : undefined} data-dialling={dialling ? '1' : undefined}
            title={hasNumber ? 'Open this number’s history' : 'Android only gives an outgoing call’s number once it ends'}>
      <span className="ciq-live-state" style={{ background: meta.bg, color: meta.color }}>
        <i />{meta.label}
      </span>

      <div className="ciq-live-main">
        <span className="ciq-live-dir" style={{ background: t.bg, color: t.fg }}>{typeIcon(type, 12)}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <b className="ciq-live-num">
            {hasNumber ? fmtPhone(row.number) : isOut ? 'Outgoing call' : 'Number withheld'}
          </b>
          <div className="ciq-live-meta">
            {student
              ? <StudentChip student={student} number={row.number_norm} style={{ maxWidth: 150 }} />
              : hasNumber
                ? <span>{history?.calls > 1 ? `${nf(history.calls)} earlier calls` : 'First call'}</span>
                : <span>{isOut ? 'number appears when it ends' : 'the network did not share it'}</span>}
            {dialling && hasNumber && <span>· waiting for an answer</span>}
          </div>
        </div>
      </div>

      <div className="ciq-live-foot">
        {/* Which way the call is going, and whose phone is on the other end of it: "from Rahul" is
            a call Rahul placed, "to Rahul" is one ringing on Rahul's phone. */}
        <span className="who" title={isOut ? `Dialled from ${row.label}` : `Ringing on ${row.label}`}>
          <Avatar name={row.label} size={18} />
          <em className="dirword">{isOut ? 'from' : 'to'}</em>{row.label}
        </span>
        <span className="sim">{row.sim_slot ? row.sim_label || `SIM ${row.sim_slot}` : 'Unknown SIM'}{row.carrier ? ` · ${row.carrier}` : ''}</span>
        <span className="time">
          {dialling
            ? <span className="ciq-live-dialing" aria-label="calling"><i /><i /><i /></span>
            : <LiveTimer baseSec={base} since={since} frozen={row.state === 'ended'} />}
          <em>{meta.verb}</em>
        </span>
      </div>

      {history?.last_outcome && <span className="ciq-live-tag">last: {history.last_outcome}</span>}
      {row.stale && <span className="ciq-live-stale" title="This phone has not checked in for a few minutes — it may have lost signal">no update {fmtAgo(row.updated_at)}</span>}
    </button>
  );
}

export default function LiveCallsBar({ onOpenNumber }) {
  const { live, students, history, error, fetchedAt, loading, hasFetched, refresh } = useLiveCalls();
  const now = useNow(5000);
  const active = live.filter(r => r.state !== 'ended');
  const ringing = active.filter(r => r.state === 'ringing').length;
  // An outgoing call in progress is "calling" until it ends — Android never says it was answered.
  const calling = active.filter(r => r.direction === 'outgoing').length;
  const talking = active.length - ringing - calling;
  const checkedAgo = fetchedAt && now ? Math.max(0, Math.round((now - fetchedAt) / 1000)) : 0;

  return (
    <div className="ciq-live" data-empty={live.length ? undefined : '1'}>
      <div className="ciq-live-head">
        <span className="ciq-live-dot" data-on={active.length ? '1' : undefined} data-err={error ? '1' : undefined} />
        <b>Live now</b>

        <span className="ciq-live-sum">
          {!hasFetched && !loading && 'Calls in progress, on request'}
          {loading && 'Checking…'}
          {hasFetched && !loading && error && `Could not check — ${error}`}
          {hasFetched && !loading && !error && active.length === 0 && 'No calls in progress'}
          {hasFetched && !loading && !error && [
            ringing > 0 ? `${nf(ringing)} ringing in` : null,
            calling > 0 ? `${nf(calling)} ringing out` : null,
            talking > 0 ? `${nf(talking)} on call` : null,
          ].filter(Boolean).join(' · ')}
        </span>

        <span className="ciq-live-actions">
          {hasFetched && !loading && fetchedAt > 0 && (
            <span className="ciq-live-hint">checked {checkedAgo < 5 ? 'just now' : `${checkedAgo}s ago`}</span>
          )}
          <button className="ciq-live-cta ma-rip" onPointerDown={ripple} onClick={refresh} disabled={loading}
                  title="Fetch the calls happening right now">
            {hasFetched ? Ic.refresh(loading ? 'spin' : '') : Ic.phone(13)}
            {hasFetched ? (loading ? 'Checking…' : 'Refresh') : 'See live calls'}
          </button>
        </span>
      </div>

      {!!live.length && (
        <div className="ciq-live-row">
          {live.map(r => (
            <LiveCard key={r.device_id} row={r} since={fetchedAt} onOpenNumber={onOpenNumber}
                      student={students[r.number_norm]} history={history[r.number_norm]} />
          ))}
        </div>
      )}
    </div>
  );
}
