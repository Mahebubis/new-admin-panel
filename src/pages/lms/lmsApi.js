// ===========================================================================
//  lmsApi.js — thin wrapper around react-api/api/lms/lms_api.php
//
//  Same raw-fetch contract as the internship-system panels (AssignmentPanel /
//  ProblemStatements): { status: 'success', data } | { status: 'error', message }.
//  Route-level permission gating happens in React; the PHP endpoint is open to
//  the admin origin exactly like assignments_api.php.
// ===========================================================================

const API_BASE = `${import.meta.env.VITE_API_URL || 'https://cit3.internshipstudio.com/admin/react-api'}/api/lms/lms_api.php`;

async function unwrap(res) {
  let json;
  try { json = await res.json(); }
  catch { throw new Error('Server returned an invalid response'); }
  if (!res.ok || json.status === 'error') {
    throw new Error(json?.message || `Request failed (${res.status})`);
  }
  /* The endpoint returns { status, message, data } with the human-readable
     message OUTSIDE data, so callers that only get data would lose it.
     Carried across as _message — underscored so it can never collide with
     a real `message` field in a payload. */
  const out = json.data ?? json;
  if (json.message && out && typeof out === 'object' && !Array.isArray(out)) {
    out._message = json.message;
  }
  return out;
}

/** GET when `body` is omitted, JSON POST when it isn't. */
export async function api(qs, body) {
  const opts = { method: body ? 'POST' : 'GET', cache: 'no-store' };
  if (body) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  return unwrap(await fetch(`${API_BASE}?${qs}&_=${Date.now()}`, opts));
}

/** multipart POST — file uploads (thumbnails, videos, attachments, CSV). */
export async function apiForm(qs, formData) {
  return unwrap(await fetch(`${API_BASE}?${qs}&_=${Date.now()}`, {
    method: 'POST', cache: 'no-store', body: formData,
  }));
}

const qp = (o = {}) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

export const LMS = {
  /* filter option lists for the Users + Enrollments bars — fetched once
     per page load, not per keystroke */
  learnerFilters: () => api('resource=learners&action=filters'),

  /* dashboard */
  dashboard: () => api('resource=dashboard'),

  /* courses */
  listCourses: (o) => api(`resource=courses&action=list&${qp(o)}`),
  getCourse: (id) => api(`resource=courses&action=get&id=${id}`),
  createCourse: (d) => api('resource=courses&action=create', d),
  updateCourse: (d) => api('resource=courses&action=update', d),
  publishCourse: (id, status) => api('resource=courses&action=publish', { id, status }),
  /* "why can't this learner see the course?" — mirrors the learner portal's
     own access query, one condition at a time */
  accessCheck: (id, email) => api(`resource=courses&action=access_check&id=${id}&email=${encodeURIComponent(email)}`),
  trashCourse: (id) => api('resource=courses&action=trash', { id }),
  restoreCourse: (id) => api('resource=courses&action=restore', { id }),
  duplicateCourse: (id) => api('resource=courses&action=duplicate', { id }),
  deleteCourse: (id) => api('resource=courses&action=delete', { id }),
  reorderCourses: (order) => api('resource=courses&action=reorder', { order }),
  uploadThumbnail: (fd) => apiForm('resource=courses&action=thumbnail', fd),

  /* sections (modules) */
  listSections: (courseId) => api(`resource=sections&action=list&course_id=${courseId}`),
  createSection: (d) => api('resource=sections&action=create', d),
  updateSection: (d) => api('resource=sections&action=update', d),
  deleteSection: (id) => api('resource=sections&action=delete', { id }),
  reorderSections: (order) => api('resource=sections&action=reorder', { order }),

  /* lessons */
  getLesson: (id) => api(`resource=lessons&action=get&id=${id}`),
  createLesson: (d) => api('resource=lessons&action=create', d),
  updateLesson: (d) => api('resource=lessons&action=update', d),
  deleteLesson: (id) => api('resource=lessons&action=delete', { id }),
  reorderLessons: (order) => api('resource=lessons&action=reorder', { order }),
  moveLesson: (id, section_id) => api('resource=lessons&action=move', { id, section_id }),
  toggleLessonHidden: (id) => api('resource=lessons&action=toggle_hidden', { id }),
  uploadVideo: (fd) => apiForm('resource=lessons&action=upload_video', fd),

  /* lesson attachments */
  listAttachments: (lessonId) => api(`resource=attachments&action=list&lesson_id=${lessonId}`),
  createAttachment: (fd) => apiForm('resource=attachments&action=create', fd),
  updateAttachment: (d) => api('resource=attachments&action=update', d),
  deleteAttachment: (id) => api('resource=attachments&action=delete', { id }),

  /* per-lesson dynamic form builder */
  listFields: (lessonId) => api(`resource=fields&action=list&lesson_id=${lessonId}`),
  createField: (d) => api('resource=fields&action=create', d),
  updateField: (d) => api('resource=fields&action=update', d),
  toggleField: (id) => api('resource=fields&action=toggle', { id }),
  deleteField: (id) => api('resource=fields&action=delete', { id }),
  reorderFields: (order) => api('resource=fields&action=reorder', { order }),

  /* form responses */
  listResponses: (o) => api(`resource=responses&action=list&${qp(o)}`),
  deleteResponse: (id) => api('resource=responses&action=delete', { id }),

  /* quizzes */
  listQuizzes: (o) => api(`resource=quizzes&action=list&${qp(o)}`),
  getQuiz: (id) => api(`resource=quizzes&action=get&id=${id}`),
  createQuiz: (d) => api('resource=quizzes&action=create', d),
  updateQuiz: (d) => api('resource=quizzes&action=update', d),
  toggleQuiz: (id) => api('resource=quizzes&action=toggle', { id }),
  duplicateQuiz: (id) => api('resource=quizzes&action=duplicate', { id }),
  deleteQuiz: (id) => api('resource=quizzes&action=delete', { id }),

  /* quiz questions */
  createQuestion: (d) => api('resource=questions&action=create', d),
  updateQuestion: (d) => api('resource=questions&action=update', d),
  deleteQuestion: (id) => api('resource=questions&action=delete', { id }),
  reorderQuestions: (order) => api('resource=questions&action=reorder', { order }),
  bulkCreateQuestions: (d) => api('resource=questions&action=bulk_create', d),

  /* attempts */
  listAttempts: (o) => api(`resource=attempts&action=list&${qp(o)}`),
  getAttempt: (id) => api(`resource=attempts&action=get&id=${id}`),
  deleteAttempt: (id) => api('resource=attempts&action=delete', { id }),

  /* learners */
  listLearners: (o) => api(`resource=learners&action=list&${qp(o)}`),
  getLearner: (userId) => api(`resource=learners&action=get&user_id=${userId}`),
  createLearner: (d) => api('resource=learners&action=create', d),
  importPreview: (fd) => apiForm('resource=learners&action=import_preview', fd),
  importRun: (d) => api('resource=learners&action=import_run', d),
  importHistory: () => api('resource=learners&action=import_history'),

  /* enrollments */
  listEnrollments: (o) => api(`resource=enrollments&action=list&${qp(o)}`),
  createEnrollment: (d) => api('resource=enrollments&action=create', d),
  bulkEnroll: (d) => api('resource=enrollments&action=bulk_create', d),
  updateEnrollment: (d) => api('resource=enrollments&action=update', d),
  deleteEnrollment: (id) => api('resource=enrollments&action=delete', { id }),

  /* reports */
  progressReport: (courseId) => api(`resource=reports&action=progress&course_id=${courseId}`),
  quizReport: (quizId) => api(`resource=reports&action=quiz&quiz_id=${quizId}`),
  courseFunnel: () => api('resource=reports&action=course_funnel'),

  /* settings + editor */
  getSettings: () => api('resource=settings&action=get'),
  saveSettings: (settings) => api('resource=settings&action=save', { settings }),
  setStorePassword: (password) => api('resource=settings&action=set_store_password', { password }),
  uploadEditorImage: (fd) => apiForm('resource=editor&action=upload_image', fd),
};

/* ── formatting helpers shared by every LMS screen ── */
export const money = (n) =>
  '₹ ' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export const duration = (secs) => {
  const s = Number(secs) || 0;
  if (!s) return '0 mins';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const bits = [];
  if (h) bits.push(`${h} hr${h > 1 ? 's' : ''}`);
  if (m) bits.push(`${m} min${m > 1 ? 's' : ''}`);
  if (!h && r) bits.push(`${r} sec${r > 1 ? 's' : ''}`);
  return bits.join(' ') || '0 mins';
};

export const fileSize = (b) => {
  if (!b) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let n = Number(b);
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
};

export const shortDate = (d) =>
  d ? new Date(String(d).replace(' ', 'T')).toLocaleDateString('en-IN',
    { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
