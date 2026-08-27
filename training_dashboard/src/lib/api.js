// ===========================================================================
//  api.js — the one place this app talks to PHP.
//
//  Every endpoint answers { status: 'success', data, message } or
//  { status: 'error', message } (see public/api/_bootstrap.php), so unwrapping
//  is uniform: a rejected promise always carries a message worth showing.
//
//  Requests are same-origin in production (the api folder ships inside the
//  build), and cross-origin against the live API during `vite dev` — hence
//  credentials:'include', which is what keeps the PHP session cookie attached.
// ===========================================================================

const BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, signal, keepalive } = {}) {
  const opts = { method, credentials: 'include', cache: 'no-store', signal, keepalive };
  if (body instanceof FormData) {
    /* Multipart — the support desk's optional attachment. The Content-Type
       header is deliberately NOT set: the browser has to write it itself
       because only it knows the boundary string it generated. */
    opts.body = body;
  } else if (body !== undefined) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${BASE}/${path}`, opts);
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiError('We could not reach the server. Check your connection and try again.', 0);
  }

  let json = null;
  try { json = await res.json(); } catch { /* handled just below */ }

  if (!json) throw new ApiError('The server sent back something we could not read.', res.status);
  if (!res.ok || json.status === 'error') {
    /* A 401 anywhere means the PHP session is gone. The app must not keep
       rendering a signed-in shell over a signed-out server — one notification
       and AuthContext takes everyone back to the login screen. auth.php is
       exempt: its own failures are the caller's to display. */
    if (res.status === 401 && !path.startsWith('auth.php')) onUnauthorized?.();
    throw new ApiError(json.message || `Request failed (${res.status})`, res.status);
  }
  return json.data ?? {};
}

/* Set once, by AuthContext. */
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

/**
 * Two components mounting at once — or React 18's StrictMode running every
 * effect twice in development — used to put the same GET on the wire twice.
 * Callers that are already correct (each aborts via its own `alive` flag)
 * still paid for a duplicate round trip.
 *
 * A GET already in flight for the same URL is handed the SAME promise instead
 * of a second request. The entry is dropped the moment it settles, so this is
 * a de-duplicator, not a cache: the next call after it resolves really does
 * hit the server, and `cache: 'no-store'` still means fresh data.
 *
 * POSTs are never shared — two "submit" clicks are two intents.
 */
const inFlight = new Map();

const get = (path, opts) => {
  /* An aborting caller must not share, or its abort would cancel someone
     else's request too. */
  if (opts?.signal) return request(path, opts);

  const hit = inFlight.get(path);
  if (hit) return hit;

  const promise = request(path, opts).finally(() => inFlight.delete(path));
  inFlight.set(path, promise);
  return promise;
};

const post = (path, body, opts) => request(path, { ...opts, method: 'POST', body: body ?? {} });

export const api = {
  /* auth */
  session:      ()                 => get('auth.php?action=session'),
  login:        (email, password)  => post('auth.php?action=login', { email, password }),
  google:       (credential)       => post('auth.php?action=google', { credential }),
  handoff:      (id, sig)          => post('auth.php?action=handoff', { id, sig }),
  logout:       ()                 => post('auth.php?action=logout'),

  /* catalog */
  home:         ()                 => get('catalog.php?action=home'),
  enrollments:  ()                 => get('catalog.php?action=enrollments'),
  course:       (slug)             => get(`catalog.php?action=course&slug=${encodeURIComponent(slug)}`),
  courseById:   (id)               => get(`catalog.php?action=course&course_id=${Number(id) || 0}`),
  lesson:       (id)               => get(`catalog.php?action=lesson&id=${Number(id) || 0}`),
  analytics:    (courseId)         => get(`catalog.php?action=analytics&course_id=${Number(courseId) || 0}`),

  /* quizzes — questions come without their answers; grading is server-side */
  quiz:         (lessonId)         => get(`quiz.php?action=get&lesson_id=${Number(lessonId) || 0}`),
  quizSubmit:   (payload)          => post('quiz.php?action=submit', payload),
  quizAttempts: (quizId)           => get(`quiz.php?action=attempts&quiz_id=${Number(quizId) || 0}`),


  /* the learner's own notes + favourites */
  notes:        (courseId)         => get(`library.php?action=notes&course_id=${Number(courseId) || 0}`),
  addNote:      (payload)          => post('library.php?action=note_add', payload),
  deleteNote:   (id)               => post('library.php?action=note_delete', { id }),
  favourites:   ()                 => get('library.php?action=favourites'),
  toggleFav:    (course_id)        => post('library.php?action=fav_toggle', { course_id }),

  /* progress */
  /* `report` is the player's {seconds, duration, watched} — the playhead, the
     video's real length and the seconds genuinely watched since the last call.
     A bare number is still accepted so nothing older breaks. */
  savePosition: (lesson_id, report) => post('progress.php?action=position',
    typeof report === 'number'
      ? { lesson_id, seconds: report }
      : { lesson_id, seconds: report?.seconds || 0, duration: report?.duration || 0, watched: report?.watched || 0 }),
  markComplete: (lesson_id, done)    => post('progress.php?action=complete', { lesson_id, done }),

  /* the support desk — tickets the learner raises, answered by an admin in the
     LMS panel. create/reply take a FormData when a file is attached (the
     endpoint reads multipart and JSON alike), so they are not routed through
     `get`'s de-duplicator: two sends are two intents. */
  supportTopics:  ()        => get('support.php?action=topics'),
  supportList:    ()        => get('support.php?action=list'),
  supportTicket:  (id)      => request(`support.php?action=get&id=${Number(id) || 0}`),
  supportCreate:  (payload) => post('support.php?action=create', payload),
  supportReply:   (payload) => post('support.php?action=reply', payload),
  supportClose:   (ticket_id) => post('support.php?action=close', { ticket_id }),

  /* analytics — one batched call, see lib/tracking.js */
  trackFlush: (payload) => post('track.php?action=flush', payload, { keepalive: true }),
  /* sendBeacon needs the raw URL: it posts on its own, outside this wrapper. */
  flushUrl:   () => `${BASE}/track.php?action=flush`,
};

export { ApiError };
