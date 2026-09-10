/*
 * src/pages/freshdesk/fdSound.js
 *
 * The new-mail chime, synthesised with the Web Audio API instead of shipped as
 * an .mp3.
 *
 * Why synthesised: an audio file has to be deployed, cached and reachable, and
 * a 404 on it fails SILENTLY -- the desk simply stops making noise and nobody
 * notices for a week. Two oscillators and a gain envelope have no such failure
 * mode, add nothing to the bundle, and can be re-tuned in one line.
 *
 * THE AUTOPLAY PROBLEM, and how this handles it:
 * Browsers refuse to start an AudioContext until the user has interacted with
 * the page. An agent who opens the desk and walks away has never clicked
 * anything, so the first chime would be silently swallowed -- exactly the case
 * the sound exists for. So:
 *   - the context is created lazily and resumed on the first real interaction
 *     (primeAudio, wired to pointerdown/keydown once);
 *   - if a chime is requested while still suspended, we fall back to the
 *     browser notification (which does not need the audio permission) and log
 *     it, rather than pretending it played;
 *   - unlocking is idempotent, so calling it on every click costs nothing.
 */

let ctx = null;
let unlocked = false;
let lastPlayedAt = 0;

/** Chime designs. Frequencies in Hz, times in seconds. */
const TONES = {
  // Rising two-note -- a new conversation has started.
  'new-ticket': [
    { freq: 660, start: 0.00, dur: 0.13, gain: 0.30, type: 'sine' },
    { freq: 880, start: 0.11, dur: 0.22, gain: 0.28, type: 'sine' },
  ],
  // Single soft note -- an existing thread moved.
  'new-reply': [
    { freq: 784, start: 0.00, dur: 0.18, gain: 0.24, type: 'sine' },
  ],
  // Low double-thud -- something needs attention.
  'alert': [
    { freq: 392, start: 0.00, dur: 0.14, gain: 0.30, type: 'triangle' },
    { freq: 392, start: 0.18, dur: 0.14, gain: 0.30, type: 'triangle' },
  ],
  // Descending -- a failure (send failed, mailbox unreachable).
  'error': [
    { freq: 440, start: 0.00, dur: 0.14, gain: 0.28, type: 'sawtooth' },
    { freq: 294, start: 0.13, dur: 0.24, gain: 0.24, type: 'sawtooth' },
  ],
};

function getCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  return ctx;
}

/**
 * Call from a real user gesture. Safe and cheap to call repeatedly -- after the
 * first success it returns immediately.
 */
export function primeAudio() {
  if (unlocked) return true;
  const c = getCtx();
  if (!c) return false;
  if (c.state === 'suspended') {
    // resume() returns a promise that can reject if this was not actually
    // called from a gesture; that is fine, we simply stay locked and try again
    // on the next one.
    c.resume().then(() => { unlocked = true; }).catch(() => {});
  } else {
    unlocked = true;
  }
  return unlocked;
}

export function isAudioUnlocked() {
  const c = ctx;
  return !!(c && c.state === 'running');
}

/**
 * Play one chime.
 * @returns true if it actually played, false if the browser blocked it.
 */
export function playChime(kind = 'new-reply', volume = 0.5) {
  const tones = TONES[kind] || TONES['new-reply'];
  const c = getCtx();
  if (!c) return false;

  if (c.state === 'suspended') {
    // Try once -- this succeeds when a gesture happened earlier in the session.
    c.resume().catch(() => {});
    if (c.state === 'suspended') return false;
  }

  /*
   * Rate limit. A sync that imports a backlog of 30 emails fires 30 events in
   * one burst; 30 overlapping chimes is not a notification, it is an alarm the
   * agent will mute permanently. One sound per 1.5s, and the visual toasts
   * still show every message.
   */
  const now = Date.now();
  if (now - lastPlayedAt < 1500) return true;
  lastPlayedAt = now;

  const vol = Math.max(0, Math.min(1, Number(volume) || 0.5));
  const t0 = c.currentTime;

  try {
    tones.forEach((tone) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = tone.type || 'sine';
      osc.frequency.setValueAtTime(tone.freq, t0 + tone.start);

      /*
       * The envelope is what stops it sounding like a fire alarm. A raw
       * oscillator switched on and off produces an audible click at both ends
       * (a discontinuity in the waveform); ramping the gain up over 12ms and
       * decaying it exponentially gives the soft bell shape instead.
       * exponentialRamp cannot reach exactly 0, hence the 0.0001 floor.
       */
      const start = t0 + tone.start;
      const end = start + tone.dur;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, tone.gain * vol), start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(start);
      osc.stop(end + 0.02);
      // Nodes are single-use; letting them go keeps the graph from growing.
      osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch { /* already gone */ } };
    });
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------- browser notices -- */

/**
 * Ask for desktop-notification permission. Must be called from a user gesture
 * in Chrome, so the UI wires it to an explicit "Enable notifications" control
 * rather than firing it on mount (which Chrome ignores and Firefox penalises).
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function notificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Show a desktop notification for a new message.
 *
 * `tag` collapses repeats: without it, five replies on the same ticket stack
 * five separate notifications on the agent's desktop. With it, the newest
 * replaces the previous one for that ticket.
 */
export function showNotification({ title, body, tag, onClick, icon }) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return null;
  // Pointless when the agent is already looking at the page -- the toast covers it.
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return null;
  try {
    const n = new Notification(title, {
      body: body || '',
      tag: tag || undefined,
      icon: icon || undefined,
      renotify: false,
      silent: true,   // the chime is ours; do not let the OS add a second one
    });
    if (onClick) {
      n.onclick = () => { try { window.focus(); } catch { /* popup blocked */ } onClick(); n.close(); };
    }
    // Some platforms leave notifications on screen indefinitely.
    setTimeout(() => { try { n.close(); } catch { /* already closed */ } }, 12000);
    return n;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ tab badge --- */

let originalTitle = null;
let blinkTimer = null;

/**
 * Put an unread count in the browser tab title, so an agent working in another
 * tab still sees that something arrived.
 */
export function setTabBadge(count) {
  if (typeof document === 'undefined') return;
  if (originalTitle === null) originalTitle = document.title.replace(/^\(\d+\)\s*/, '');
  document.title = count > 0 ? `(${count}) ${originalTitle}` : originalTitle;
}

/** Briefly flash the tab title -- catches the eye without being permanent. */
export function flashTab(text, times = 6) {
  if (typeof document === 'undefined') return;
  if (originalTitle === null) originalTitle = document.title.replace(/^\(\d+\)\s*/, '');
  if (blinkTimer) { clearInterval(blinkTimer); blinkTimer = null; }
  let n = 0;
  const base = document.title;
  blinkTimer = setInterval(() => {
    document.title = (n % 2 === 0) ? text : base;
    if (++n >= times * 2) {
      clearInterval(blinkTimer);
      blinkTimer = null;
      document.title = base;
    }
  }, 700);
}

export default {
  primeAudio, isAudioUnlocked, playChime,
  requestNotificationPermission, notificationPermission, showNotification,
  setTabBadge, flashTab,
};
