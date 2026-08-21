// ===========================================================================
//  tracking.js — portal usage analytics, client half.
//
//  What it answers, per learner: how many times they came back, how long each
//  visit lasted, which screens they were on, and how much of that time went to
//  a particular course or lesson.
//
//  Design — buffer locally, send rarely:
//
//    • There is NO per-tick network call. Time is derived from timestamps at
//      flush time, so an idle tab does nothing at all.
//    • Screens accumulate into an in-memory Map keyed by path+course+lesson.
//      Ten lesson switches in a minute are still ONE request carrying ten
//      segments, not ten requests.
//    • A flush happens on a 60s timer, when the tab is hidden, and on pagehide.
//      The last two use sendBeacon, which survives the page going away —
//      `fetch` at that point is routinely cancelled.
//    • Time stops accruing two minutes after the last sign of life, so a tab
//      left open overnight does not report eight hours of study. Video playback
//      counts as life (the player calls markActive), not just clicks.
//
//    That is one request per minute of real use, versus four before, and zero
//    while nothing is happening.
//
//  Everything here is best effort: analytics must never break a lesson.
// ===========================================================================
import { api } from './api';

const KEY = 'istudio_visit_key';
const FLUSH_MS = 60000;    // how often buffered time is handed over
const IDLE_MS = 120000;    // silence after which we stop counting

function visitKey() {
  let k = sessionStorage.getItem(KEY);
  if (!k) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    k = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(KEY, k);
  }
  return k;
}

let started = false;
let timer = null;
let sentEntry = false;

/** Screens awaiting delivery: key -> { path, title, course_id, lesson_id, seconds, views } */
const buffer = new Map();

let current = null;        // the screen being timed
let segmentStart = 0;      // when the current screen started accruing
let lastActivity = 0;      // last interaction or playback tick

const now = () => Date.now();
const keyOf = (s) => `${s.path}|${s.course_id}|${s.lesson_id}`;

/** Any sign the learner is still there. Cheap enough to call often. */
export function markActive() {
  lastActivity = now();
}

/**
 * Move the time since `segmentStart` into the buffer, and reset the clock.
 * Capped at IDLE_MS past the last activity, which is what stops an abandoned
 * tab donating hours.
 */
function accumulate() {
  if (!current || !segmentStart) return;

  const cutoff = Math.min(now(), lastActivity + IDLE_MS);
  const seconds = Math.max(0, Math.round((cutoff - segmentStart) / 1000));
  segmentStart = now();
  if (seconds <= 0) return;

  const k = keyOf(current);
  const row = buffer.get(k);
  if (row) row.seconds += seconds;
  else buffer.set(k, { ...current, seconds, views: 0 });
}

/**
 * Hand everything buffered to the server.
 * @param {boolean} beacon use sendBeacon — required when the page is going away.
 */
function flush(beacon = false) {
  if (!started) return;
  accumulate();
  if (!buffer.size && sentEntry) return;

  const payload = {
    visit_key: visitKey(),
    segments: Array.from(buffer.values()),
  };
  /* The first flush of a tab also opens the visit row. */
  if (!sentEntry) {
    payload.entry = {
      path: window.location.pathname,
      referrer: document.referrer || '',
    };
    sentEntry = true;
  }
  buffer.clear();

  if (beacon && navigator.sendBeacon) {
    /* text/plain keeps it a simple request — no preflight, and PHP reads it
       from php://input exactly the same way. */
    const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain;charset=UTF-8' });
    navigator.sendBeacon(api.flushUrl(), blob);
    return;
  }

  api.trackFlush(payload).catch((e) => {
    /* A 401 means the session is gone; retrying every minute would just be
       noise at a server that will keep refusing. */
    if (e?.status === 401) stopTracking();
  });
}

const onActivity = () => markActive();

const onVisibility = () => {
  if (document.visibilityState === 'hidden') {
    accumulate();
    flush(true);
    segmentStart = 0;          // stop the clock while backgrounded
  } else {
    markActive();
    segmentStart = now();      // and restart it on return
  }
};

const onPageHide = () => flush(true);

/** Called once, right after the learner is known to be signed in. */
export function startTracking() {
  if (started) return;
  started = true;
  sentEntry = false;
  lastActivity = now();
  segmentStart = now();

  timer = setInterval(() => flush(false), FLUSH_MS);

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pointerdown', onActivity, { passive: true });
  window.addEventListener('keydown', onActivity, { passive: true });
  window.addEventListener('scroll', onActivity, { passive: true });
}

export function stopTracking() {
  if (!started) return;
  clearInterval(timer);
  timer = null;
  started = false;
  buffer.clear();
  current = null;
  segmentStart = 0;

  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('pagehide', onPageHide);
  window.removeEventListener('pointerdown', onActivity);
  window.removeEventListener('keydown', onActivity);
  window.removeEventListener('scroll', onActivity);
}

/**
 * Called on every route change, and whenever the lesson inside a course
 * changes. No network call of its own — it closes the previous segment and
 * opens a new one, and the next flush carries both.
 */
export function trackPage({ path, title = '', courseId = 0, lessonId = 0 }) {
  const next = { path, title, course_id: courseId, lesson_id: lessonId };

  /* React runs effects twice in StrictMode, and the player re-reports whenever
     the course object identity changes — neither is a real navigation, so the
     same screen never opens a second segment. */
  if (current && keyOf(current) === keyOf(next)) return;

  accumulate();
  current = next;
  markActive();
  if (!segmentStart) segmentStart = now();

  /* Count the view now; the seconds catch up at flush time. */
  const k = keyOf(next);
  const row = buffer.get(k);
  if (row) row.views += 1;
  else buffer.set(k, { ...next, seconds: 0, views: 1 });
}
