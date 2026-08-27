/*
  journeyStore — the seam between the Journey UI and the server.

  This used to persist to localStorage. It now talks to
  react-api/api/journeys/journeys.php, which runs the real execution engine
  (entries, waits, sends, conversions) against the live database.

  Every export is now ASYNC. The function names and return shapes are unchanged
  from the localStorage version, so components only had to learn to await —
  nothing about what they render moved.

  Failure policy: a read that fails returns an empty/neutral value and shows one
  toast, because a dead network must not blank the screen with an exception. A
  WRITE that fails re-throws after toasting — the caller has to know the save did
  not happen, and silently swallowing that is how people lose an afternoon of
  canvas work.
*/

import api from '../../../api/axios';
import toast from 'react-hot-toast';

const EP = '/api/journeys/journeys.php';

/* ── plumbing ─────────────────────────────────────────────────────────────── */

function unwrap(res) {
  const body = res?.data;
  if (body && body.success === false) throw new Error(body.error || 'Request failed');
  return body?.data;
}

function explain(err) {
  const d = err?.response?.data;
  if (d?.error) return d.error;
  if (err?.response?.status === 403) return 'You do not have permission for the Journeys feature.';
  if (err?.response?.status === 404) return 'The journeys API is not deployed on the server yet.';
  return err?.message || 'Something went wrong.';
}

async function read(params, fallback) {
  try {
    // `_` busts any intermediate cache. The server sends no-store, but a proxy or a
    // service worker between us and it would otherwise be free to replay a listing
    // taken before the row was deleted.
    return unwrap(await api.get(EP, { params: { ...params, _: Date.now() } }));
  } catch (err) {
    toast.error(explain(err));
    return fallback;
  }
}

async function write(params, body) {
  try {
    return unwrap(await api.post(EP, body || {}, { params }));
  } catch (err) {
    const msg = explain(err);
    toast.error(msg);
    // Validation refusals carry the problem list — hand it to the caller intact so
    // the builder can show "3 things to fix" instead of a generic failure.
    const e = new Error(msg);
    e.problems = err?.response?.data?.problems || [];
    e.warnings = err?.response?.data?.warnings || [];
    throw e;
  }
}

/* ── display helpers (unchanged — the list and report still format locally) ── */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  let h = dt.getHours();
  const ap = h < 12 ? 'am' : 'pm';
  h = h % 12 || 12;
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${MONTHS[dt.getMonth()]} ${String(dt.getDate()).padStart(2, '0')}, ${dt.getFullYear()} ${String(h).padStart(2, '0')}:${mm} ${ap}`;
}

/* ── CRUD ─────────────────────────────────────────────────────────────────── */

export async function listJourneys(params = {}) {
  const d = await read({ action: 'list', per_page: 200, ...params }, { rows: [], total: 0, counts: {} });
  return d?.rows || [];
}

export async function getJourney(id) {
  if (!id || id === 'new') return null;
  return await read({ action: 'get', id }, null);
}

export async function createJourney(details = {}) {
  return await write({ action: 'save' }, {
    name: (details.name || '').trim() || 'Untitled journey',
    tags: Array.isArray(details.tags) ? details.tags.slice(0, 5) : [],
    startAt: details.startAt || '',
    endType: details.endType || 'never',
    endAt: details.endAt || '',
    graph: details.graph || { nodes: {}, edges: {} },
    settings: details.settings || null,
  });
}

export async function updateJourney(id, patch) {
  return await write({ action: 'save', id }, patch);
}

/* Persist the canvas: graph, settings, name in one shot. */
export async function saveGraph(id, { nodes, edges, settings, name }) {
  return await write({ action: 'graph', id }, { nodes: nodes || {}, edges: edges || {}, settings, name });
}

/*
  Status transitions. Publishing (ongoing/scheduled) is validated SERVER-side and
  can be refused — the thrown error carries .problems, which is the point: the
  client validator is advice, the server one is the gate.
*/
export async function setStatus(id, status) {
  return await write({ action: 'status', id }, { status });
}

export async function duplicateJourney(id) {
  return await write({ action: 'duplicate', id });
}

export async function removeJourney(id) {
  await write({ action: 'delete', id });
  return true;
}

export async function addVersion(id, payload = {}) {
  return await write({ action: 'add_version', id }, payload);
}

export async function listVersions(id) {
  if (!id) return [];
  return (await read({ action: 'versions', id }, [])) || [];
}

/* ── engine-facing reads ──────────────────────────────────────────────────── */

/** Real dropdown data — events, segments, lists, templates, senders, attributes. */
export async function loadOptions() {
  return await read({ action: 'options' }, null);
}

/** Server-side validation without publishing. */
export async function validateGraph(id, graph, settings) {
  try {
    return unwrap(await api.post(EP, { graph, settings }, { params: { action: 'validate', id } }));
  } catch {
    return null;   // the client validator still ran; this is a bonus, not a blocker
  }
}

/** KPIs, node stats, waiting counts, suppression breakdown, control-vs-treated lift. */
export async function getReport(id) {
  return await read({ action: 'report', id }, null);
}

/** Who is in the journey right now, which node, and when they are due to leave. */
export async function listEntries(id, params = {}) {
  return await read({ action: 'entries', id, ...params }, { rows: [], total: 0 });
}

/** One student's complete history — the "I never got the WhatsApp" answer. */
export async function traceStudent(id, { userId, email }) {
  return await read({ action: 'trace', id, user_id: userId, email }, { entries: [] });
}

/** Fire one node at a test recipient. Bypasses DND and the frequency cap. */
export async function sendTest(id, nodeId, to) {
  return await write({ action: 'test', id }, { node_id: nodeId, to });
}

/** Run the engine now instead of waiting for the next cron minute. */
export async function runNow(id) {
  return await write({ action: 'run', id });
}

/** Schema / cron / provider status — what the Health panel shows. */
export async function health() {
  return await read({ action: 'health' }, null);
}

/**
 * The template exactly as it will be sent — read from the same row the dispatcher
 * uses, so the preview cannot drift from the real send.
 */
export async function previewTemplate(id, kind, ref, subject) {
  return await read({ action: 'preview', id, kind, ref, subject }, null);
}

/**
 * Attachments go to S3 and the descriptor comes BACK to us — the builder writes it
 * into the step's config and saves the graph. Keeping the graph single-writer is
 * what stops the next autosave from wiping a server-side edit.
 */
export async function uploadAttachment(id, file, usedBytes = 0) {
  const form = new FormData();
  form.append('file', file);
  form.append('existing_bytes', String(usedBytes));
  try {
    const res = await api.post(EP, form, {
      params: { action: 'upload_attachment', id },
      // Let the browser set the multipart boundary; the axios default JSON header
      // would otherwise make PHP see an empty $_FILES.
      headers: { 'Content-Type': undefined },
    });
    return unwrap(res);
  } catch (err) {
    const msg = explain(err);
    toast.error(msg);
    throw new Error(msg);
  }
}

export async function deleteAttachment(s3Key) {
  return await write({ action: 'delete_attachment' }, { s3_key: s3Key });
}

/** Turn the daily message cap on or off without opening the canvas. */
export async function setCap(id, enabled) {
  return await write({ action: 'set_cap', id }, { enabled: enabled ? 1 : 0 });
}

/** Fire a business event (normally your backend cron does this, not the panel). */
export async function fireBusinessEvent(eventName, payload = {}) {
  return await write({ action: 'business_event' }, { event_name: eventName, payload });
}

/**
 * Evaluate one condition step against one real student.
 *
 * Read-only on the server: nothing is written, nobody enters the journey, no message
 * goes out. `subject` is an email address or a numeric user id — the builder does not
 * make people choose which, because they know who they mean and not which column it
 * lives in.
 *
 * Returns { branch, detail, rules[], student, step } — the per-rule breakdown is the
 * whole point; a bare True/False is exactly the answer that was already unavailable.
 */
export async function testCondition(id, nodeId, subject) {
  const s = String(subject || '').trim();
  const body = /^\d+$/.test(s) ? { node_id: nodeId, user_id: s } : { node_id: nodeId, email: s };
  return await write({ action: 'condition_test', id }, body);
}

/* ── Outbox ────────────────────────────────────────────────────────────────
   Everything the engine still owes: overdue steps a stopped worker never picked
   up, messages held by quiet hours, sends backing off after a transient failure,
   ordinary delays, and sends that gave up. See api/journeys/lib/JourneyOutbox.php.
──────────────────────────────────────────────────────────────────────────── */

export async function loadOutbox({ kind = 'all', journeyId = 0, q = '', page = 1, perPage = 50 } = {}) {
  return await read(
    { action: 'outbox', kind, journey_id: journeyId || 0, q, page, per_page: perPage },
    { rows: [], total: 0, page: 1, pages: 1, summary: {}, journeys: [], kind },
  );
}

/** Pull the selected rows forward to now and kick the worker. `ids` empty + `all` set
 *  releases the whole current bucket, capped server-side. */
export async function releaseOutbox(ids, { all = false, kind = 'overdue', journeyId = 0 } = {}) {
  return await write({ action: 'outbox_release' },
    all ? { all: 1, kind, journey_id: journeyId || 0 } : { ids: JSON.stringify(ids) });
}

/** Skip these steps. The students continue down the step's normal onward path —
 *  cancelling a message is not the same as removing the person from the journey. */
export async function cancelOutbox(ids, note = '') {
  return await write({ action: 'outbox_cancel' }, { ids: JSON.stringify(ids), note });
}
