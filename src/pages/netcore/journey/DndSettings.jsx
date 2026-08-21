import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

/*
 * Account-level Do Not Disturb.
 *
 * Two separate ideas share this screen, and keeping them straight is most of the design:
 *
 *   the schedule    the hours messages are HELD. Set once for the account so every new journey
 *                   inherits it instead of somebody re-typing 21:00–09:30 forty times.
 *
 *   enforce         a hard rule that overrides every journey's own switch. This is the only
 *                   control that lets anyone say "we definitely do not message students at 3am"
 *                   and mean it — without it the honest answer is "probably, unless one of forty
 *                   journeys has it turned off".
 *
 * THE PART EVERYONE READS BACKWARDS
 * The days you select are the days DND applies on, and the window you set is the period messages
 * are held BACK — not the period they are allowed out. Unselected days have no restriction at
 * all. The reference product labels this field "delivery window", which is exactly wrong, so the
 * wording here is deliberate and the live summary below spells out the consequence in plain
 * words rather than leaving it to be inferred from two dropdowns.
 *
 * Held messages are never dropped: a send that lands inside a window is parked and released when
 * the window ends (journey_dnd_hold_until → the 'hold' outcome in JourneyDispatch).
 */

const API  = '/api/journeys/journeys.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/* Only the zones an Indian-operating account plausibly runs on. A full 400-entry list is a
   worse control than five relevant ones, and the server validates whatever arrives anyway. */
const ZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'UTC'];

const blank = () => Array.from({ length: 7 }, (_, d) => ({ day: d, enabled: 0, from: '21:00', to: '09:30' }));

const CSS = `
.dnd { max-width: 860px; }
.dnd-card { background:#fff; border:1px solid #e4e7ec; border-radius:12px; padding:20px 22px; margin-bottom:16px;
  box-shadow:0 1px 2px rgba(16,24,40,.05); }
.dnd-card h2 { font-size:14.5px; font-weight:750; color:#101828; margin:0 0 4px; }
.dnd-card p  { font-size:12.5px; color:#667085; margin:0 0 16px; line-height:1.6; max-width:640px; }
.dnd-head { display:flex; align-items:flex-start; gap:16px; }
.dnd-head > div:first-child { flex:1; min-width:0; }

/* Switch — the one control on this page that changes what students receive, so it gets a real
   affordance rather than a checkbox. */
.dnd-sw { position:relative; width:42px; height:24px; border-radius:999px; border:0; padding:0; flex:none;
  background:#d0d5dd; cursor:pointer; transition:background 200ms cubic-bezier(.4,0,.2,1); }
.dnd-sw::after { content:''; position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%;
  background:#fff; box-shadow:0 1px 3px rgba(16,24,40,.25);
  transition:transform 220ms cubic-bezier(.4,0,.2,1); }
.dnd-sw[aria-checked="true"] { background:#4f46e5; }
.dnd-sw[aria-checked="true"]::after { transform:translateX(18px); }
.dnd-sw:hover:not(:disabled) { filter:brightness(.95); }
.dnd-sw:focus-visible { outline:2px solid #4f46e5; outline-offset:3px; }
.dnd-sw:disabled { opacity:.45; cursor:not-allowed; }

.dnd-days { display:flex; gap:8px; margin-bottom:18px; flex-wrap:wrap; }
.dnd-day { width:40px; height:40px; border-radius:50%; border:1.5px solid #d0d5dd; background:#fff;
  color:#667085; font-family:inherit; font-size:13px; font-weight:700; cursor:pointer;
  transition:all 170ms cubic-bezier(.4,0,.2,1); }
.dnd-day:hover { border-color:#98a2b3; background:#f9fafb; transform:translateY(-1px); }
.dnd-day:active { transform:translateY(0) scale(.94); }
.dnd-day:focus-visible { outline:2px solid #4f46e5; outline-offset:2px; }
.dnd-day[aria-pressed="true"] { background:#4f46e5; border-color:#4f46e5; color:#fff;
  box-shadow:0 3px 8px rgba(79,70,229,.28); }

.dnd-row { display:grid; grid-template-columns:110px 1fr auto 1fr; align-items:center; gap:10px;
  padding:9px 0; border-top:1px solid #f2f4f7; transition:opacity 180ms; }
.dnd-row:first-of-type { border-top:0; }
.dnd-row.off { opacity:.4; }
.dnd-row label { font-size:13px; font-weight:600; color:#344054; }
.dnd-row .sep { font-size:12px; color:#98a2b3; }
.dnd-time { padding:7px 10px; border:1px solid #d0d5dd; border-radius:8px; font-size:13px; font-family:inherit;
  color:#101828; background:#fff; outline:none; width:100%; box-sizing:border-box;
  transition:border-color 160ms cubic-bezier(.4,0,.2,1), box-shadow 160ms cubic-bezier(.4,0,.2,1); }
.dnd-time:hover:not(:disabled) { border-color:#98a2b3; }
.dnd-time:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,.14); }
.dnd-time:disabled { background:#f9fafb; cursor:not-allowed; }

.dnd-btn { display:inline-flex; align-items:center; gap:7px; padding:9px 16px; border-radius:8px;
  font-size:13px; font-weight:650; font-family:inherit; cursor:pointer; border:1px solid transparent;
  transition:background 160ms cubic-bezier(.4,0,.2,1), box-shadow 160ms, transform 90ms, border-color 160ms, color 160ms; }
.dnd-btn:active:not(:disabled) { transform:translateY(1px); }
.dnd-btn:focus-visible { outline:2px solid #4f46e5; outline-offset:2px; }
.dnd-btn:disabled { opacity:.5; cursor:not-allowed; }
.dnd-btn-solid { background:#4f46e5; color:#fff; box-shadow:0 1px 2px rgba(16,24,40,.06); }
.dnd-btn-solid:hover:not(:disabled) { background:#4338ca; box-shadow:0 4px 12px rgba(79,70,229,.3); }
.dnd-btn-ghost { background:#fff; color:#344054; border-color:#d0d5dd; }
.dnd-btn-ghost:hover:not(:disabled) { background:#f9fafb; border-color:#98a2b3; }
.dnd-link { background:none; border:0; padding:0; color:#4f46e5; font-family:inherit; font-size:12.5px;
  font-weight:650; cursor:pointer; text-decoration:underline; text-underline-offset:3px; }
.dnd-link:hover { color:#4338ca; }
.dnd-link:disabled { opacity:.45; cursor:not-allowed; text-decoration:none; }

.dnd-note { display:flex; gap:9px; padding:11px 13px; border-radius:9px; font-size:12.5px; line-height:1.6; }
.dnd-note svg { flex:none; margin-top:1px; }
.dnd-note-info { background:#f5f8ff; border:1px solid #d1e0ff; color:#1849a9; }
.dnd-note-warn { background:#fffaeb; border:1px solid #fedf89; color:#93370d; }

.dnd-summary { background:#f9fafb; border:1px solid #e4e7ec; border-radius:10px; padding:13px 15px;
  font-size:12.5px; color:#344054; line-height:1.7; }
.dnd-summary b { color:#101828; font-variant-numeric:tabular-nums; }

.dnd-bar { position:sticky; bottom:0; display:flex; align-items:center; gap:12px; padding:14px 0 4px;
  background:linear-gradient(to top, #f7f8fc 70%, transparent); }
.dnd-sel { padding:8px 11px; border:1px solid #d0d5dd; border-radius:8px; font-size:13px; font-family:inherit;
  color:#101828; background:#fff; outline:none; cursor:pointer;
  transition:border-color 160ms cubic-bezier(.4,0,.2,1), box-shadow 160ms; }
.dnd-sel:hover { border-color:#98a2b3; }
.dnd-sel:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,.14); }
`;

const InfoIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
  </svg>
);
const WarnIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

/** "21:00 to 09:30 (overnight)" — the overnight tag is the whole reason this is spelled out. */
const describeWindow = row =>
  `${row.from} to ${row.to}${row.to <= row.from ? ' (carries into the next day)' : ''}`;

export default function DndSettings() {
  const [enabled, setEnabled]   = useState(false);
  const [enforce, setEnforce]   = useState(false);
  const [tz, setTz]             = useState('Asia/Kolkata');
  const [rows, setRows]         = useState(blank());
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [savedAt, setSavedAt]   = useState(null);
  const [dirty, setDirty]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(API, { params: { action: 'dnd_account_get' } });
      if (res.data?.success) {
        const d = res.data.data;
        setEnabled(!!d.enabled);
        setEnforce(!!d.enforce_all);
        setTz(d.timezone || 'Asia/Kolkata');
        // Server returns only the days it has; fill the rest so all seven rows always render.
        const base = blank();
        (d.config || []).forEach(r => { if (r.day >= 0 && r.day < 7) base[r.day] = { ...base[r.day], ...r }; });
        setRows(base);
        setSavedAt(d.updated_at || null);
        setDirty(false);
      } else toast.error(res.data?.error || 'Could not load the DND schedule');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not load the DND schedule');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const mutate = fn => { setRows(prev => { const next = prev.map(r => ({ ...r })); fn(next); return next; }); setDirty(true); };
  const toggleDay = d => mutate(n => { n[d].enabled = n[d].enabled ? 0 : 1; });
  const setTime   = (d, k, v) => mutate(n => { n[d][k] = v; });

  const firstOn = rows.findIndex(r => r.enabled);
  const copyAll = () => {
    if (firstOn < 0) return;
    const src = rows[firstOn];
    mutate(n => n.forEach(r => { if (r.enabled) { r.from = src.from; r.to = src.to; } }));
    toast.success(`${DAYS[firstOn]}'s window copied to every selected day`);
  };

  const activeDays = useMemo(() => rows.filter(r => r.enabled), [rows]);
  const canSave = !loading && (!enabled || activeDays.length > 0);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.post(API, new URLSearchParams({
        action: 'dnd_account_save',
        enabled: enabled ? '1' : '0',
        enforce_all: enforce ? '1' : '0',
        timezone: tz,
        config: JSON.stringify(rows),
      }), FORM);
      if (res.data?.success) {
        const n = res.data.data?.enforced_journeys || 0;
        toast.success(enforce && n
          ? `Saved — now enforced on ${n} live journey${n === 1 ? '' : 's'}`
          : 'Quiet hours saved');
        setDirty(false);
        load();
      } else toast.error(res.data?.error || 'Could not save');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not save');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ padding: '20px 24px 40px', overflowY: 'auto', height: '100%' }}>
      <style>{CSS}</style>
      <div className="dnd">
        <h1 style={{ fontSize: 20, fontWeight: 750, color: '#101828', margin: '0 0 4px' }}>Do not disturb</h1>
        <p style={{ fontSize: 13, color: '#667085', margin: '0 0 20px', maxWidth: 660, lineHeight: 1.6 }}>
          Hours when journey messages are held back. Nothing is thrown away — a message that reaches
          a send step inside a quiet window waits there and goes out the moment the window ends.
        </p>

        {/* ── the schedule ─────────────────────────────────────────────────────────────── */}
        <div className="dnd-card">
          <div className="dnd-head">
            <div>
              <h2>Account quiet hours</h2>
              <p>
                Every new journey starts from this schedule. Pick the days it applies on, then set the
                window on each — <b>the window is the time messages are held</b>, so 21:00 to 09:30 blocks
                the night. Days you leave unselected have no restriction at all.
              </p>
            </div>
            <button className="dnd-sw" role="switch" aria-checked={enabled} aria-label="Enable account quiet hours"
                    disabled={loading} onClick={() => { setEnabled(v => !v); setDirty(true); }} />
          </div>

          <div className="dnd-days">
            {LETTERS.map((l, d) => (
              <button key={d} className="dnd-day" aria-pressed={!!rows[d].enabled}
                      title={DAYS[d]} aria-label={DAYS[d]}
                      disabled={loading} onClick={() => toggleDay(d)}>{l}</button>
            ))}
          </div>

          {DAYS.map((name, d) => (
            <div key={d} className={`dnd-row${rows[d].enabled ? '' : ' off'}`}>
              <label htmlFor={`dnd-from-${d}`}>{name}</label>
              <input id={`dnd-from-${d}`} className="dnd-time" type="time" value={rows[d].from}
                     disabled={!rows[d].enabled || loading} onChange={e => setTime(d, 'from', e.target.value)} />
              <span className="sep">to</span>
              <input className="dnd-time" type="time" value={rows[d].to} aria-label={`${name} window end`}
                     disabled={!rows[d].enabled || loading} onChange={e => setTime(d, 'to', e.target.value)} />
            </div>
          ))}

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
            <button className="dnd-link" onClick={copyAll} disabled={firstOn < 0 || loading}>
              Copy {firstOn >= 0 ? `${DAYS[firstOn]}'s` : 'the first'} window to all selected days
            </button>
            <span style={{ fontSize: 12, color: '#98a2b3' }}>
              To block a whole day, select it and set 00:01 to 23:59.
            </span>
          </div>
        </div>

        {/* ── enforcement ──────────────────────────────────────────────────────────────── */}
        <div className="dnd-card">
          <div className="dnd-head">
            <div>
              <h2>Enforce on every journey</h2>
              <p>
                Apply this schedule to all journeys, overriding whatever each one has set. Leave it off
                and the schedule is only a default that a journey can turn off for itself — which is
                what you want for genuinely time-critical journeys like exam-window reminders and
                results-live alerts, where a held message defeats the purpose.
              </p>
            </div>
            <button className="dnd-sw" role="switch" aria-checked={enforce} aria-label="Enforce on every journey"
                    disabled={loading || !enabled} onClick={() => { setEnforce(v => !v); setDirty(true); }} />
          </div>

          {!enabled && (
            <div className="dnd-note dnd-note-info">
              <InfoIcon /><div>Turn the schedule on above before it can be enforced.</div>
            </div>
          )}
          {enforce && (
            <div className="dnd-note dnd-note-warn">
              <WarnIcon />
              <div>
                While this is on, a journey cannot opt out — including one marked to ignore quiet hours.
                Split urgency instead of loosening the schedule: keep nurture and promotional journeys
                under it, and if something genuinely must go out at any hour, turn this off and manage
                quiet hours per journey.
              </div>
            </div>
          )}
        </div>

        {/* ── what this actually does ──────────────────────────────────────────────────── */}
        <div className="dnd-card">
          <h2 style={{ marginBottom: 12 }}>What this blocks</h2>
          <div className="dnd-summary">
            {!enabled || !activeDays.length ? (
              <>Nothing is held right now — messages go out at any hour.</>
            ) : (
              <>
                Journey messages are held on{' '}
                {activeDays.map((r, i) => (
                  <span key={r.day}>
                    {i > 0 && (i === activeDays.length - 1 ? ' and ' : ', ')}
                    <b>{DAYS[r.day]}</b> from <b>{describeWindow(r)}</b>
                  </span>
                ))}
                . All times read against <b>{tz}</b>.
                {' '}They are released as soon as the window ends, so a send triggered on a blocked
                Saturday night goes out when the next open window begins.
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <label htmlFor="dnd-tz" style={{ fontSize: 12.5, fontWeight: 650, color: '#344054' }}>Timezone</label>
            <select id="dnd-tz" className="dnd-sel" value={tz}
                    onChange={e => { setTz(e.target.value); setDirty(true); }} disabled={loading}>
              {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
              {!ZONES.includes(tz) && <option value={tz}>{tz}</option>}
            </select>
            <span style={{ fontSize: 11.5, color: '#98a2b3', maxWidth: 420, lineHeight: 1.5 }}>
              Windows are evaluated against this clock. Set it wrong and every window is offset by the
              difference — the most common way a DND schedule silently does the wrong thing.
            </span>
          </div>
        </div>

        <div className="dnd-bar">
          <button className="dnd-btn dnd-btn-solid" onClick={save} disabled={saving || !canSave || !dirty}>
            {saving ? 'Saving…' : 'Save quiet hours'}
          </button>
          <button className="dnd-btn dnd-btn-ghost" onClick={load} disabled={saving || loading || !dirty}>
            Discard changes
          </button>
          <span style={{ fontSize: 12, color: '#98a2b3', marginLeft: 'auto' }}>
            {dirty ? 'Unsaved changes'
                   : savedAt ? `Last saved ${String(savedAt).replace('T', ' ').slice(0, 16)}`
                   : 'Never configured'}
          </span>
        </div>
      </div>
    </div>
  );
}
