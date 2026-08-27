// ===========================================================================
//  LmsReports.jsx — the "Reports" tab.
//
//  Three views:
//    course funnel     every course, enrolled → started → completed
//    learner progress  one course, how far each enrolled learner has got
//    portal access     who actually OPENED training.internshipstudio.com, how
//                      long they stayed, and which course that time went to
//
//  The third one answers a question the first two structurally cannot.
//  Enrollment is not access: the funnel counts rows in lms_enrollments, and a
//  learner enrolled in four courses who has never signed in looks identical to
//  one who logs in nightly. Portal access reads the learner portal's own
//  tracking tables instead (lms_learner_visits / lms_learner_page_views, both
//  written by training_dashboard/public/api/track.php), so "6 students have
//  opened the new training dashboard" is a number this screen can state.
// ===========================================================================
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BarChart3, Download, Users, TrendingUp, Clock, MousePointerClick, UserX, ChevronRight,
} from 'lucide-react';
import { LMS, money, duration, shortDate } from './lmsApi';
import { Loader, Empty } from './LmsStyles';

/* All time first: the portal is new, so the lifetime figure is the headline
   number for now and the windows are the follow-up question. */
const RANGES = [
  { value: 0, label: 'All time' },
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

/** "24 Aug 2026, 10:51" — a visit needs its time, unlike an enrollment date. */
const stamp = (d) => (d
  ? new Date(String(d).replace(' ', 'T')).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  : '—');

export default function LmsReports() {
  const [view, setView] = useState('funnel');
  const [loading, setLoading] = useState(true);
  const [funnel, setFunnel] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [progress, setProgress] = useState(null);

  /* portal access */
  const [access, setAccess] = useState(null);
  const [days, setDays] = useState(0);
  const [openRow, setOpenRow] = useState(0);   // the student whose courses are expanded

  useEffect(() => {
    LMS.listCourses({ status: 'all' }).then(d => setCourses(d.courses || [])).catch(() => {});
  }, []);

  const loadFunnel = useCallback(async () => {
    setLoading(true);
    try {
      const d = await LMS.courseFunnel();
      setFunnel(d.rows || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (view === 'funnel') loadFunnel(); }, [view, loadFunnel]);

  useEffect(() => {
    if (view !== 'progress' || !courseId) { setProgress(null); return; }
    setLoading(true);
    LMS.progressReport(courseId)
      .then(setProgress)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [view, courseId]);

  useEffect(() => {
    if (view !== 'access') return;
    let alive = true;
    setLoading(true);
    LMS.portalAccess(days)
      .then(d => { if (alive) { setAccess(d); setOpenRow(0); } })
      .catch(e => toast.error(e.message))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [view, days]);

  const exportProgress = () => {
    if (!progress?.rows?.length) return toast.error('Nothing to export');
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Name', 'Email', 'Lessons completed', 'Total lessons', 'Progress %', 'Watch time (s)', 'Last active']
      .map(esc).join(',')];
    progress.rows.forEach(r => {
      lines.push([r.name, r.email, r.done, progress.total_lessons, r.progress, r.watched, r.last_active]
        .map(esc).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lms-progress-course-${courseId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported');
  };

  /* One row per student per course, plus a row for the students whose time is
     not attributed to any course — a spreadsheet is where these numbers get
     forwarded, so the breakdown is flattened rather than nested. */
  const exportAccess = () => {
    if (!access?.students?.length) return toast.error('Nothing to export');
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Name', 'Email', 'Course', 'Time on course', 'Seconds', 'Lessons opened',
      'Visits', 'Page views', 'Total time on portal', 'First seen', 'Last seen']
      .map(esc).join(',')];
    access.students.forEach(s => {
      const base = [s.name, s.email];
      const tail = [s.visits, s.page_views, duration(s.seconds), stamp(s.first_seen), stamp(s.last_seen)];
      if (!s.courses.length) {
        lines.push([...base, '(no course screens)', '', 0, 0, ...tail].map(esc).join(','));
        return;
      }
      s.courses.forEach(c => {
        lines.push([...base, c.title, duration(c.seconds), c.seconds, c.lessons, ...tail].map(esc).join(','));
      });
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lms-portal-access-${days || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported');
  };

  const sum = access?.summary || {};

  return (
    <div className="lms-page">
      <div className="lms-page-head">
        <div>
          <h1 className="lms-h1">Reports</h1>
          <p className="lms-sub">How your courses are performing and how far each learner has got</p>
        </div>
        {view === 'progress' && progress && (
          <button className="lms-btn lms-btn-ghost" onClick={exportProgress}>
            <Download size={16} /> Export CSV
          </button>
        )}
        {view === 'access' && access?.students?.length > 0 && (
          <button className="lms-btn lms-btn-ghost" onClick={exportAccess}>
            <Download size={16} /> Export CSV
          </button>
        )}
      </div>

      <div className="lms-toolbar">
        <div className="lms-segment">
          <button className={view === 'funnel' ? 'active' : ''} onClick={() => setView('funnel')}>Course funnel</button>
          <button className={view === 'progress' ? 'active' : ''} onClick={() => setView('progress')}>Learner progress</button>
          <button className={view === 'access' ? 'active' : ''} onClick={() => setView('access')}>Portal access</button>
        </div>
        {view === 'progress' && (
          <select className="lms-select" style={{ width: 280 }} value={courseId} onChange={e => setCourseId(e.target.value)}>
            <option value="">Select a course</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        )}
        {view === 'access' && (
          <select className="lms-select" style={{ width: 190 }} value={days}
            onChange={e => setDays(Number(e.target.value))}>
            {RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        )}
      </div>

      {/* ═══ FUNNEL ═══ */}
      {view === 'funnel' && (
        loading ? <Loader /> : funnel.length === 0 ? (
          <Empty icon={<BarChart3 size={24} />} title="No course data yet"
            message="Create a course and enroll learners — the funnel fills in from there." />
        ) : (
          <div className="lms-table-wrap">
            <div className="lms-table-scroll">
              <table className="lms-table">
                <thead>
                  <tr>
                    <th>Course</th><th>Lessons</th><th>Enrolled</th><th>Started</th>
                    <th>Lesson completions</th><th>Completion rate</th><th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {funnel.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 500 }}>{r.title}</td>
                      <td>{r.lessons}</td>
                      <td>{r.enrolled}</td>
                      <td>{r.started}</td>
                      <td>{r.completions}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div className="lms-progress-bar"><i style={{ width: `${Math.min(100, r.completion_rate)}%` }} /></div>
                          <span style={{ fontSize: 12 }}>{r.completion_rate}%</span>
                        </div>
                      </td>
                      <td>{money(r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ═══ PROGRESS ═══ */}
      {view === 'progress' && (
        !courseId ? (
          <Empty icon={<TrendingUp size={24} />} title="Pick a course"
            message="Choose a course above to see how far each enrolled learner has got." />
        ) : loading ? <Loader /> : !progress?.rows?.length ? (
          <Empty icon={<Users size={24} />} title="No learners enrolled"
            message="Enroll learners into this course to start tracking their progress." />
        ) : (
          <>
            <div className="lms-stat-strip">
              <div className="lms-stat">
                <div>
                  <div className="lms-stat-label">Enrolled learners</div>
                  <div className="lms-stat-value">{progress.rows.length}</div>
                </div>
                <div className="lms-stat-ico"><Users size={18} /></div>
              </div>
              <div className="lms-stat">
                <div>
                  <div className="lms-stat-label">Lessons in course</div>
                  <div className="lms-stat-value">{progress.total_lessons}</div>
                </div>
                <div className="lms-stat-ico"><BarChart3 size={18} /></div>
              </div>
              <div className="lms-stat">
                <div>
                  <div className="lms-stat-label">Average progress</div>
                  <div className="lms-stat-value">
                    {Math.round(progress.rows.reduce((a, r) => a + r.progress, 0) / progress.rows.length)}%
                  </div>
                </div>
                <div className="lms-stat-ico"><TrendingUp size={18} /></div>
              </div>
              <div className="lms-stat">
                <div>
                  <div className="lms-stat-label">Finished the course</div>
                  <div className="lms-stat-value">{progress.rows.filter(r => r.progress >= 100).length}</div>
                </div>
                <div className="lms-stat-ico"><TrendingUp size={18} /></div>
              </div>
            </div>

            <div className="lms-table-wrap">
              <div className="lms-table-scroll">
                <table className="lms-table">
                  <thead>
                    <tr><th>Learner</th><th>Completed</th><th>Progress</th><th>Watch time</th><th>Last active</th></tr>
                  </thead>
                  <tbody>
                    {progress.rows.map(r => (
                      <tr key={r.user_id}>
                        <td>
                          <div className="lms-user-cell">
                            <div className="lms-avatar">{(r.name || r.email || '?').charAt(0)}</div>
                            <div>
                              <div className="lms-user-name">{r.name || '—'}</div>
                              <div className="lms-user-mail">{r.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>{r.done} / {progress.total_lessons}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <div className="lms-progress-bar"><i style={{ width: `${Math.min(100, r.progress)}%` }} /></div>
                            <span style={{ fontSize: 12 }}>{r.progress}%</span>
                          </div>
                        </td>
                        <td>{duration(r.watched)}</td>
                        <td>{r.last_active ? shortDate(r.last_active) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}

      {/* ═══ PORTAL ACCESS ═══ */}
      {view === 'access' && (
        loading ? <Loader /> : access?.tracked === false ? (
          <Empty icon={<Clock size={24} />} title="No tracking data yet"
            message="The learning portal records its own visits. Those tables appear the first time a learner opens training.internshipstudio.com — once someone signs in, this fills in on its own." />
        ) : !access?.students?.length ? (
          <Empty icon={<UserX size={24} />} title="Nobody has opened the portal in this window"
            message="Widen the date range above. Enrolling a learner does not create a visit — they have to sign in to training.internshipstudio.com for their time to be recorded." />
        ) : (
          <>
            <div className="lms-stat-strip">
              <div className="lms-stat">
                <div>
                  <div className="lms-stat-label">Students who opened it</div>
                  <div className="lms-stat-value">{sum.students}</div>
                </div>
                <div className="lms-stat-ico"><Users size={18} /></div>
              </div>
              <div className="lms-stat">
                <div>
                  <div className="lms-stat-label">Total time on the portal</div>
                  <div className="lms-stat-value" style={{ fontSize: 21 }}>{duration(sum.seconds)}</div>
                </div>
                <div className="lms-stat-ico"><Clock size={18} /></div>
              </div>
              <div className="lms-stat">
                <div>
                  <div className="lms-stat-label">Average per student</div>
                  <div className="lms-stat-value" style={{ fontSize: 21 }}>{duration(sum.avg_seconds)}</div>
                </div>
                <div className="lms-stat-ico"><TrendingUp size={18} /></div>
              </div>
              <div className="lms-stat">
                <div>
                  <div className="lms-stat-label">Active in the last 7 days</div>
                  <div className="lms-stat-value">{sum.active_7d}</div>
                </div>
                <div className="lms-stat-ico"><MousePointerClick size={18} /></div>
              </div>
              {/* The gap the funnel cannot show: enrolled, never arrived. */}
              <div className="lms-stat">
                <div>
                  <div className="lms-stat-label">Enrolled, never signed in</div>
                  <div className="lms-stat-value">{sum.never_accessed}</div>
                </div>
                <div className="lms-stat-ico"><UserX size={18} /></div>
              </div>
            </div>

            <p className="lms-sub" style={{ margin: '4px 0 18px' }}>
              {sum.visits} visit{sum.visits === 1 ? '' : 's'} · {sum.page_views} screens opened
              {sum.logins !== undefined && <> · {sum.logins} sign-in{sum.logins === 1 ? '' : 's'}</>}
              {sum.handoff_clicks ? <> · {sum.handoff_landed} of {sum.handoff_clicks} Skill Lab clicks landed</> : null}
              {sum.last_seen && <> · last activity {stamp(sum.last_seen)}</>}
            </p>

            {/* ── time per course, across everyone ── */}
            <h2 className="lms-h3" style={{ margin: '0 0 10px' }}>Time spent on each course</h2>
            {!access.courses.length ? (
              <Empty icon={<BarChart3 size={22} />} title="No course screens opened yet"
                message="Students have signed in, but nobody has opened a course lesson in this window." />
            ) : (
              <div className="lms-table-wrap" style={{ marginBottom: 26 }}>
                <div className="lms-table-scroll">
                  <table className="lms-table">
                    <thead>
                      <tr>
                        <th>Course</th><th>Students who opened it</th><th>Reach of enrolled</th>
                        <th>Total time</th><th>Average each</th><th>Last opened</th>
                      </tr>
                    </thead>
                    <tbody>
                      {access.courses.map(c => (
                        <tr key={c.course_id}>
                          <td style={{ fontWeight: 500 }}>{c.title}</td>
                          <td>{c.students}{c.enrolled ? ` of ${c.enrolled}` : ''}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                              <div className="lms-progress-bar"><i style={{ width: `${Math.min(100, c.reach)}%` }} /></div>
                              <span style={{ fontSize: 12 }}>{c.reach}%</span>
                            </div>
                          </td>
                          <td>{duration(c.seconds)}</td>
                          <td>{duration(c.avg_seconds)}</td>
                          <td>{c.last_seen ? stamp(c.last_seen) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── one row per student, expandable into their per-course split ── */}
            <h2 className="lms-h3" style={{ margin: '0 0 10px' }}>Students who accessed the portal</h2>
            <div className="lms-table-wrap">
              <div className="lms-table-scroll">
                <table className="lms-table">
                  <thead>
                    <tr>
                      <th style={{ width: 34 }} />
                      <th>Student</th><th>Visits</th><th>Screens</th>
                      <th>Time on portal</th><th>Of that, in courses</th>
                      <th>First seen</th><th>Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {access.students.map(s => {
                      const open = openRow === s.user_id;
                      return (
                        <React.Fragment key={s.user_id}>
                          <tr
                            onClick={() => setOpenRow(open ? 0 : s.user_id)}
                            style={{ cursor: s.courses.length ? 'pointer' : 'default' }}
                            title={s.courses.length ? 'Show the per-course breakdown' : 'No course screens for this student'}
                          >
                            <td>
                              {s.courses.length > 0 && (
                                <ChevronRight size={15} style={{
                                  transform: open ? 'rotate(90deg)' : 'none',
                                  transition: 'transform .15s ease',
                                }} />
                              )}
                            </td>
                            <td>
                              <div className="lms-user-cell">
                                <div className="lms-avatar">{(s.name || s.email || '?').charAt(0)}</div>
                                <div>
                                  <div className="lms-user-name">{s.name || '—'}</div>
                                  <div className="lms-user-mail">{s.email || `user #${s.user_id}`}</div>
                                </div>
                              </div>
                            </td>
                            <td>{s.visits}</td>
                            <td>{s.page_views}</td>
                            <td style={{ fontWeight: 500 }}>{duration(s.seconds)}</td>
                            <td>{duration(s.course_secs)}</td>
                            <td>{stamp(s.first_seen)}</td>
                            <td>{stamp(s.last_seen)}</td>
                          </tr>

                          {open && s.courses.map(c => (
                            <tr key={`${s.user_id}-${c.course_id}`} style={{ background: 'var(--lms-bg-soft)' }}>
                              <td />
                              <td style={{ paddingLeft: 26, fontSize: 13 }}>{c.title}</td>
                              <td colSpan={2} style={{ fontSize: 12.5, color: 'var(--lms-text-2)' }}>
                                {c.lessons} lesson{c.lessons === 1 ? '' : 's'} opened
                              </td>
                              <td style={{ fontWeight: 500 }}>{duration(c.seconds)}</td>
                              <td />
                              <td colSpan={2} style={{ fontSize: 12.5, color: 'var(--lms-text-2)' }}>
                                last opened {stamp(c.last_seen)}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Time on the shell — home, enrollments, the search screen — is
                real time the learner spent in the portal but belongs to no
                course, so it is stated rather than folded into a course total. */}
            {sum.other_seconds > 0 && (
              <p className="lms-sub" style={{ marginTop: 12 }}>
                A further {duration(sum.other_seconds)} was spent outside any course — the home,
                enrollments and search screens.
              </p>
            )}
          </>
        )
      )}
    </div>
  );
}
