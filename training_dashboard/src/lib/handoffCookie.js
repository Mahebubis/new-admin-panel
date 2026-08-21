// ===========================================================================
//  handoffCookie.js — the one-day pass from the dashboard's Skill Lab.
//
//  The flow, end to end:
//    1. Learner presses "Go to learning portal" on dashboard.internshipstudio.com.
//    2. That mints a row in lms_portal_handoffs and sends the browser here as
//         /?sso=<id>&sig=<signature>
//    3. We exchange it for a portal session AND park the id in a cookie that
//       expires at local midnight.
//    4. On any later load — a refresh, a new tab — the cookie is replayed, so
//       the learner stays signed in for the rest of the day without going back
//       to the dashboard.
//    5. Tomorrow the cookie is gone and the server would reject the id anyway
//       (auth.php compares the row's created_at to today), so they are signed
//       out. Two independent checks, deliberately: a cookie can be edited, the
//       row's date cannot.
// ===========================================================================

const NAME = 'istudio_learn_pass';

/** Midnight tonight, local time — the moment the pass stops being valid. */
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export function readPass() {
  const hit = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${NAME}=`));
  if (!hit) return null;

  try {
    const raw = decodeURIComponent(hit.slice(NAME.length + 1));
    const val = JSON.parse(raw);
    if (!val?.id || !val?.sig || !val?.day) return null;
    /* Belt and braces: a cookie that somehow survived past its day is ignored
       here rather than being sent to the server. */
    if (val.day !== todayKey()) return null;
    return val;
  } catch {
    return null;
  }
}

export function writePass(id, sig) {
  if (!id || !sig) return;
  const value = encodeURIComponent(JSON.stringify({ id, sig, day: todayKey() }));
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${NAME}=${value}; Expires=${endOfToday().toUTCString()}; Path=/; SameSite=Lax${secure}`;
}

export function clearPass() {
  document.cookie = `${NAME}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax`;
}

/** Local calendar day, not UTC — "the same day" means the learner's day. */
export function todayKey() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Pulls ?sso=&sig= off the URL and scrubs them so the pass is not shareable
    from the address bar or captured in a bookmark. */
export function takePassFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('sso');
  const sig = params.get('sig');
  if (!id || !sig) return null;

  /* A "resume where you left off" link names the lesson too. The lesson id
     is scrubbed along with the pass so a shared URL cannot carry someone
     else's position — the player picks the resume point up from the
     learner's own lms_progress row once the lesson is open. */
  const course = params.get('course');
  const lesson = params.get('lesson');
  params.delete('sso');
  params.delete('sig');
  params.delete('course');
  params.delete('lesson');
  const qs = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));

  return { id: Number(id), sig, courseId: Number(course) || 0, lessonId: Number(lesson) || 0 };
}
