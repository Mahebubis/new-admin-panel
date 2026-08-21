// ===========================================================================
//  LmsDashboard.jsx — the LMS "home" tab.
//  Mirrors the Learnyst dashboard: headline stat cards, a segmented control
//  over a monthly bar chart, a top-courses table and a live activity rail.
// ===========================================================================
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  BookOpen, Users, GraduationCap, HelpCircle, PlayCircle, ClipboardList,
  IndianRupee, CheckCircle2, ArrowRight, Clock, Layers,
} from 'lucide-react';
import { LMS, money, duration, shortDate } from './lmsApi';
import { Loader, Empty, Pill } from './LmsStyles';

const SEGMENTS = [
  { key: 'enrollments', label: 'Enrollments' },
  { key: 'revenue', label: 'Revenue' },
];

function Stat({ label, value, icon, tone = 'green' }) {
  const tones = {
    green: { bg: 'var(--lms-green-soft)', fg: 'var(--lms-green-dark)' },
    blue: { bg: 'var(--lms-blue-soft)', fg: '#3538cd' },
    amber: { bg: 'var(--lms-amber-soft)', fg: 'var(--lms-amber-dark)' },
    grey: { bg: 'var(--lms-bg-soft)', fg: 'var(--lms-text-2)' },
  };
  const t = tones[tone] || tones.green;
  return (
    <div className="lms-stat">
      <div>
        <div className="lms-stat-label">{label}</div>
        <div className="lms-stat-value">{value}</div>
      </div>
      <div className="lms-stat-ico" style={{ background: t.bg, color: t.fg }}>{icon}</div>
    </div>
  );
}

export default function LmsDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [segment, setSegment] = useState('enrollments');

  useEffect(() => {
    let alive = true;
    LMS.dashboard()
      .then(d => { if (alive) setData(d); })
      .catch(e => toast.error(e.message))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const s = data?.stats || {};
  const chartData = useMemo(
    () => (data?.series || []).map(r => ({
      month: r.month,
      Enrollments: r.count,
      Revenue: Math.round(r.amount),
    })),
    [data]
  );
  const chartTotal = useMemo(() => {
    if (!data?.series) return 0;
    return data.series.reduce((a, r) => a + (segment === 'revenue' ? r.amount : r.count), 0);
  }, [data, segment]);

  if (loading) return <Loader />;

  return (
    <div className="lms-page">
      <div className="lms-page-head">
        <div>
          <h1 className="lms-h1">Welcome to your LMS</h1>
          <p className="lms-sub">
            Everything you publish here — courses, modules, video lessons, forms and quizzes —
            is what your learners see inside their course player.
          </p>
        </div>
        <div className="lms-page-actions">
          <Link to="/lms/courses" className="lms-btn lms-btn-ghost">
            <BookOpen size={16} /> Manage courses
          </Link>
          <Link to="/lms/courses?new=1" className="lms-btn lms-btn-dark">
            Create course
          </Link>
        </div>
      </div>

      <div className="lms-stat-strip">
        <Stat label="Total Courses"  value={s.courses ?? 0}                   icon={<BookOpen size={18} />} />
        <Stat label="Total Lessons"  value={s.lessons ?? 0}                   icon={<PlayCircle size={18} />} tone="blue" />
        <Stat label="Enrolled Learners" value={s.learners ?? 0}               icon={<Users size={18} />} />
        <Stat label="Course Revenue" value={money(s.revenue)}                 icon={<IndianRupee size={18} />} tone="amber" />
      </div>

      <div className="lms-stat-strip">
        <Stat label="Published"        value={s.published ?? 0}   icon={<CheckCircle2 size={18} />} />
        <Stat label="Draft / Unlisted" value={s.draft ?? 0}       icon={<Layers size={18} />}        tone="grey" />
        <Stat label="Quizzes"          value={s.quizzes ?? 0}     icon={<HelpCircle size={18} />}    tone="blue" />
        <Stat label="Form Responses"   value={s.responses ?? 0}   icon={<ClipboardList size={18} />} tone="grey" />
      </div>

      {/* ── monthly chart ─────────────────────────────────────── */}
      <div className="lms-card lms-card-pad" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <h2 className="lms-h2">Monthly {segment === 'revenue' ? 'Revenue' : 'Enrollments'}</h2>
            <p className="lms-sub">
              Last 12 months — total{' '}
              <strong style={{ color: 'var(--lms-text)' }}>
                {segment === 'revenue' ? money(chartTotal) : chartTotal.toLocaleString('en-IN')}
              </strong>
            </p>
          </div>
          <div className="lms-segment">
            {SEGMENTS.map(seg => (
              <button
                key={seg.key}
                className={segment === seg.key ? 'active' : ''}
                onClick={() => setSegment(seg.key)}
              >
                {seg.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11.5, fill: '#98a1ae' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11.5, fill: '#98a1ae' }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(18,183,106,.06)' }}
                contentStyle={{
                  border: '1px solid #e4e7ec', borderRadius: 8, fontSize: 12.5,
                  boxShadow: '0 4px 12px rgba(16,24,40,.1)', fontFamily: 'inherit',
                }}
                formatter={(v) => (segment === 'revenue' ? money(v) : v)}
              />
              <Legend wrapperStyle={{ fontSize: 12.5, paddingTop: 8 }} />
              <Bar
                dataKey={segment === 'revenue' ? 'Revenue' : 'Enrollments'}
                fill="#12b76a"
                radius={[4, 4, 0, 0]}
                maxBarSize={38}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 22, alignItems: 'start' }}>
        {/* ── top courses ────────────────────────────────────── */}
        <div className="lms-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px' }}>
            <h2 className="lms-h2">Top 5 Courses</h2>
            <Link to="/lms/courses" className="lms-btn lms-btn-ghost lms-btn-sm">View All</Link>
          </div>
          {(data?.top_courses || []).length === 0 ? (
            <Empty
              icon={<BookOpen size={22} />}
              title="No courses yet"
              message="Create your first course and it will show up here once learners start enrolling."
            />
          ) : (
            <div className="lms-table-scroll">
              <table className="lms-table" style={{ minWidth: 480 }}>
                <thead>
                  <tr><th>Title</th><th>Enrollments</th><th>Revenue</th></tr>
                </thead>
                <tbody>
                  {data.top_courses.map(c => (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/lms/courses/${c.id}`} style={{ fontWeight: 500 }}>{c.title}</Link>
                      </td>
                      <td>{c.enrolls}</td>
                      <td>{money(c.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── activity rail ──────────────────────────────────── */}
        <div className="lms-card">
          <div style={{ padding: '18px 22px 6px' }}>
            <h2 className="lms-h2">Recent Enrollments</h2>
            <p className="lms-sub">Latest {(data?.recent || []).length} learners</p>
          </div>
          {(data?.recent || []).length === 0 ? (
            <Empty icon={<Users size={22} />} title="Nothing yet" message="Enrollments will appear here." />
          ) : (
            <div style={{ padding: '4px 12px 14px' }}>
              {data.recent.map(r => (
                <div key={r.id} style={{
                  display: 'flex', gap: 11, alignItems: 'center', padding: '11px 10px',
                  borderBottom: '1px solid var(--lms-border)',
                }}>
                  <div className="lms-avatar">{(r.name || r.email || '?').charAt(0)}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="lms-user-name" style={{ fontSize: 13 }}>{r.name || r.email}</div>
                    <div className="lms-user-mail" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.course_title || 'Course removed'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <Pill tone={r.access_type === 'paid' ? 'green' : 'grey'}>{r.access_type}</Pill>
                    <div style={{ fontSize: 11, color: 'var(--lms-text-3)', marginTop: 4 }}>{shortDate(r.enrolled_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── footer summary strip ─────────────────────────────── */}
      <div className="lms-stat-strip" style={{ marginTop: 24 }}>
        <Stat label="Sections / Modules" value={s.sections ?? 0}          icon={<Layers size={18} />}      tone="grey" />
        <Stat label="Total Video Time"   value={duration(s.video_seconds)} icon={<Clock size={18} />}      tone="blue" />
        <Stat label="Quiz Attempts"      value={s.attempts ?? 0}          icon={<HelpCircle size={18} />} tone="amber" />
        <Stat label="Lessons Completed"  value={s.completions ?? 0}       icon={<CheckCircle2 size={18} />} />
      </div>

      <div style={{ marginTop: 26, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link to="/lms/learners" className="lms-btn lms-btn-ghost">
          <Users size={16} /> Manage users <ArrowRight size={15} />
        </Link>
        <Link to="/lms/quizzes" className="lms-btn lms-btn-ghost">
          <HelpCircle size={16} /> Build a quiz <ArrowRight size={15} />
        </Link>
        <Link to="/lms/reports" className="lms-btn lms-btn-ghost">
          <GraduationCap size={16} /> Progress reports <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
