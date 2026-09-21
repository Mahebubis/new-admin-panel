/*
 * What is wrong with a phone, most serious first — read from the setup report the phone sends
 * (checkin.php, app v1.4+).
 *
 * The rule throughout: "unknown" is never shown as "off". A phone on an older build simply cannot
 * report its setup, and saying its popup is off (the old behaviour) sent people chasing a switch
 * that was already on. Such a phone is told to update instead.
 */

const HOUR = 3600 * 1000;

/** Phone-clock epoch milliseconds → "12m ago". */
export function agoMs(ms) {
  const n = Number(ms) || 0;
  if (!n) return 'never';
  const sec = Math.max(0, (Date.now() - n) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

const spanText = ms => (ms >= 48 * HOUR ? `${Math.round(ms / (24 * HOUR))} days` : `${Math.round(ms / HOUR)} h`);

export const osText = a => [
  a.manufacturer && a.manufacturer.charAt(0).toUpperCase() + a.manufacturer.slice(1),
  a.os_release && `Android ${a.os_release}`,
].filter(Boolean).join(' · ');

/**
 * @returns {{ level: 'bad'|'warn'|'info', key: string, title: string, detail: string }[]}
 */
export function phoneIssues(a) {
  const out = [];
  const h = a.health;
  const ver = a.app_version ? `v${a.app_version}` : 'the original build';

  if (a.outdated) {
    out.push({
      level: 'bad', key: 'update',
      title: `Update the app — ${ver} is behind v${a.latest_version}`,
      detail: `Install v${a.latest_version} on this phone. Older builds miss calls on some phones and cannot report their setup.`,
    });
  }

  if (!h) {
    out.push(a.outdated
      ? { level: 'info', key: 'noreport', title: 'Setup not reported', detail: `${ver} cannot tell the panel which switches are on. Once it is updated, this card lists them exactly.` }
      : { level: 'warn', key: 'noreport', title: 'Setup not reported yet', detail: 'Open CallIQ on the phone once — it reports its setup the moment it opens.' });
    // An older build that did say "off" on its last upload is still worth passing on.
    if (a.popup_state === 'off') {
      out.push({ level: 'bad', key: 'popup', title: 'Post-call popup off', detail: 'Reported by the phone with its last call. Open CallIQ → Allow all permissions.' });
    }
    return out;
  }

  for (const s of h.steps || []) {
    if (!s.required) continue;
    if (s.status === 'todo') {
      out.push({ level: 'bad', key: s.key, title: `${s.title} is off`, detail: s.how });
    } else if (s.status === 'unknown') {
      out.push({ level: 'warn', key: s.key, title: `${s.title} — not confirmed`, detail: `This phone cannot report this switch. ${s.how} Then tap “Yes, it's on” in CallIQ.` });
    }
  }

  if (h.popup_enabled === false) {
    out.push({ level: 'warn', key: 'popup_disabled', title: 'Popup switched off in the app', detail: 'Turn “Post-call popup” back on in CallIQ → Settings.' });
  }

  /* v1.5+: is CallIQ kept alive between calls? Without it, Android freezes or kills the app and
     live calls stop reaching the panel. (Absent on older builds — never guessed at.) */
  if (h.monitor_enabled === false) {
    out.push({ level: 'warn', key: 'monitor_off', title: 'Background tracking switched off', detail: 'Live calls from this phone will be patchy. Turn on “Keep CallIQ running” in CallIQ → Phone setup.' });
  } else if (h.monitor === false) {
    out.push({ level: 'warn', key: 'monitor', title: 'Not being kept running', detail: 'Open CallIQ once on this phone. Tracking starts and stays on from then, including after a restart.' });
  }

  /* v1.5+: a dual-SIM phone whose calls cannot be placed on a SIM says so, with what its call log
     actually holds — enough to diagnose it without the phone in hand. */
  if ((Number(h.sims) || 0) >= 2 && h.sim_method === 'unknown') {
    let seen = '';
    try {
      const u = JSON.parse(h.sim_unresolved || '{}');
      if (u.account) seen = ` Its call log stores the SIM as “${u.account}”${u.oem && u.oem.replace(/,/g, '') ? ` (maker columns: ${u.oem})` : ''}.`;
    } catch { /* not JSON — nothing to add */ }
    out.push({ level: 'warn', key: 'sim', title: 'Cannot tell SIM 1 from SIM 2', detail: `Calls from this phone show “Unknown SIM”.${seen} Share this line with whoever maintains CallIQ.` });
  }

  if (h.sync_error) {
    const waiting = Number(h.pending_uploads) || 0;
    out.push({
      level: 'bad', key: 'sync', title: 'Calls are not uploading',
      detail: `${h.sync_error}${waiting ? ` — ${waiting} call${waiting === 1 ? '' : 's'} waiting on the phone` : ''}. They upload by themselves once this is fixed.`,
    });
  }

  /* The honest test of Autostart and battery: did CallIQ actually run by itself? Both times are
     the phone's own clock, so no timezone or clock drift can fake this. The catch-up runs every
     15 minutes; allowing 6 hours covers deep sleep overnight without crying wolf. */
  const sent = Number(h.sent_at) || 0;
  const bg = Number(h.bg_run_at) || 0;
  if (sent) {
    if (bg && sent - bg > 6 * HOUR) {
      out.push({ level: 'warn', key: 'bg', title: `Not running in the background (${spanText(sent - bg)})`, detail: 'The phone stops CallIQ when it is out of sight, so calls upload late. Allow Autostart and set Battery to Unrestricted.' });
    } else if (!bg && a.first_seen_at && Date.now() - new Date(String(a.first_seen_at).replace(' ', 'T')).getTime() > 6 * HOUR) {
      out.push({ level: 'warn', key: 'bg', title: 'Has never run in the background', detail: 'Allow Autostart and set Battery to Unrestricted, then open CallIQ once.' });
    }
  }

  return out;
}

/** How the phone placed its last call on a SIM, in words (SimResolver.kt's `source`). */
export const SIM_METHOD_TEXT = {
  exact: 'Exact — read from the phone', telecom: 'Exact — read from the phone', account: 'Exact — read from the phone',
  label: 'Matched by SIM name', live: 'From the live call', learned: 'Remembered from earlier calls',
  oem: 'From the maker’s call-log column', subid: 'From the call log', iccid: 'From the call log', slot: 'From the call log',
  single: 'Only one SIM in the phone', unknown: 'Cannot tell',
};

/** One chip for the card: the single most useful thing to say. */
export function setupChip(a, issues = phoneIssues(a)) {
  const bad = issues.filter(i => i.level === 'bad');
  const warn = issues.filter(i => i.level === 'warn');
  if (a.outdated) return { tone: 'bad', text: `Update to v${a.latest_version}` };
  if (!a.health) return { tone: 'muted', text: 'Setup not reported' };
  if (bad.length) return { tone: 'bad', text: bad.length === 1 ? bad[0].title : `${bad.length} problems` };
  if (warn.length) return { tone: 'warn', text: warn.length === 1 ? warn[0].title : `${warn.length} to check` };
  return { tone: 'ok', text: 'Setup complete' };
}
