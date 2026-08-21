// ===========================================================================
//  LmsReports.jsx — the "Reports" tab.
//  Two views: a course funnel across every course, and a per-learner progress
//  table for one course (lessons completed, watch time, last activity).
// ===========================================================================
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BarChart3, Download, Users, TrendingUp } from 'lucide-react';
import { LMS, money, duration, shortDate } from './lmsApi';
import { Loader, Empty } from './LmsStyles';

export default function LmsReports() {
  const [view, setView] = useState('funnel');
  const [loading, setLoading] = useState(true);
  const [funnel, setFunnel] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [progress, setProgress] = useState(null);

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
      </div>

      <div className="lms-toolbar">
        <div className="lms-segment">
          <button className={view === 'funnel' ? 'active' : ''} onClick={() => setView('funnel')}>Course funnel</button>
          <button className={view === 'progress' ? 'active' : ''} onClick={() => setView('progress')}>Learner progress</button>
        </div>
        {view === 'progress' && (
          <select className="lms-select" style={{ width: 280 }} value={courseId} onChange={e => setCourseId(e.target.value)}>
            <option value="">Select a course</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
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
    </div>
  );
}
