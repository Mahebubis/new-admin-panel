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
 * An outgoing call in progress: "Outgoing call", counting from when it was DIALLED — and saying so.
 *
 * Android tells an app that is not the phone's own dialer exactly one thing about an outgoing
 * call: the line is off hook. That one state covers dialling, ringing at the other end and talking
 * alike — there is no "they picked up" signal for any such app, on any version. So this timer is
 * labelled "since dialled", never presented as talk time; the moment the call ends the phone reads
 * the real talk time out of the call log and the card switches to that (or to "Not answered").
 */
const OUTGOING_META = { label: 'Outgoing call', color: '#4f46e5', bg: '#eef2ff', verb: 'since dialled' };
const NOT_ANSWERED_META = { label: 'Not answered', color: '#b45309', bg: '#fffbeb', verb: 'rang for' };
const MISSED_META = { label: 'Missed', color: '#b91c1c', bg: '#fef2f2', verb: 'rang for' };

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
  const outgoingLive = isOut && row.state !== 'ended';
  const ended = row.state === 'ended';
  /* A finished call that never connected says so: the call log's talk time is 0. An incoming
     call that ended without ever being answered is a missed call. */
  const neverConnected = ended && (isOut ? row.talk_sec === 0 : !row.answered_at && !row.talk_sec);
  const meta = outgoingLive ? OUTGOING_META
    : neverConnected ? (isOut ? NOT_ANSWERED_META : MISSED_META)
      : (STATE_META[row.state] || STATE_META.connected);
  const type = isOut ? 'OUTGOING' : row.direction === 'incoming' ? 'INCOMING' : 'UNKNOWN';
  const t = TYPE[type] || TYPE.UNKNOWN;
  const hasNumber = !!row.number;
  const open = () => hasNumber && onOpenNumber({ number_norm: row.number_norm, number: row.number });

  /*
   * What the timer counts:
   *  - ringing (incoming)          → how long it has rung
   *  - on call (incoming)          → talk time, from the moment it was answered
   *  - outgoing, in progress       → since dialled (labelled so; see OUTGOING_META)
   *  - ended                       → the real talk time from the call log, once the phone sends it
   *  - ended without connecting    → how long it rang
   */
  const base = neverConnected ? row.elapsed_sec
    : (row.talk_sec != null && (row.state === 'connected' || ended)) ? row.talk_sec
      : row.elapsed_sec;

  return (
    <button className={`ciq-live-card ma-rip${hasNumber ? '' : ' no-click'}`} onPointerDown={ripple} onClick={open}
            data-state={row.state} data-stale={row.stale ? '1' : undefined}
            title={hasNumber ? 'Open this number’s history' : 'This phone has not shared the number yet — it arrives with the call log when the call ends'}>
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
                : <span>{isOut ? 'number arrives when it ends' : 'the network did not share it'}</span>}
            {outgoingLive && <span>· in progress</span>}
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
          <LiveTimer baseSec={base} since={since} frozen={ended} />
          <em title={outgoingLive ? 'Android does not tell apps when an outgoing call is answered, so this includes the ringing. The exact talk time replaces it when the call ends.' : undefined}>
            {meta.verb}
          </em>
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
  // Outgoing calls are counted on their own: Android never says when one was answered.
  const outgoing = active.filter(r => r.direction === 'outgoing').length;
  const talking = active.length - ringing - outgoing;
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
            outgoing > 0 ? `${nf(outgoing)} outgoing` : null,
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
