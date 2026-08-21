// ===========================================================================
//  CourseAnalytics.jsx — "/course/:slug/analytics".
//
//  Breadcrumbs, a Progress row of three donut cards (Lessons / Assignments /
//  Quizzes) each with its legend underneath, then the Quiz Analytics strip.
//
//  A donut reading "N/A" rather than "0%" is deliberate and matches the learner
//  site: a course with no assignments has no assignment progress to report, and
//  showing that as 0% would read as failure rather than absence.
// ===========================================================================
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { EmptyState, PageLoader } from '../components/Layout';
import './analytics.css';
import './courses.css';

const RADIUS = 74;
const CIRC = 2 * Math.PI * RADIUS;

function Donut({ percent }) {
  const known = typeof percent === 'number';
  const value = known ? Math.max(0, Math.min(100, percent)) : 0;

  return (
    <div className="donut">
      <svg viewBox="0 0 180 180" role="img" aria-label={known ? `${value} percent` : 'Not applicable'}>
        <circle cx="90" cy="90" r={RADIUS} className="donut-track" />
        {known && value > 0 && (
          <circle
            cx="90" cy="90" r={RADIUS}
            className="donut-value"
            strokeDasharray={`${(value / 100) * CIRC} ${CIRC}`}
            transform="rotate(-90 90 90)"
          />
        )}
      </svg>
      <span className="donut-label">{known ? `${value}%` : 'N/A'}</span>
    </div>
  );
}

function ProgressCard({ title, percent, rows }) {
  return (
    <div className="an-card">
      <h3 className="an-card-title">{title}</h3>
      <Donut percent={percent} />
      <div className="an-legend">
        {rows.map((r) => (
          <div key={r.label} className="an-legend-row">
            <span className={`an-dot ${r.tone}`} />
            <span className="an-legend-label">{r.label}</span>
            <span className="an-legend-value">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const hhmm = (secs) => {
  const s = Number(secs) || 0;
  if (!s) return '0m';
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};

export default function CourseAnalytics() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    /* The route carries the slug, but the analytics endpoint keys off the id —
       so the course is resolved first, which also enforces the enrolment check
       before any numbers are computed. */
    (async () => {
      try {
        const isId = /^\d+$/.test(String(slug));
        const course = isId ? await api.courseById(slug) : await api.course(slug);
        if (!alive) return;
        const d = await api.analytics(course.course.id);
        if (alive) setData(d);
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  if (loading) return <PageLoader label="Crunching your progress…" />;

  if (error) {
    return (
      <div className="wrap">
        <EmptyState
          title="We could not load your analytics"
          message={error}
          action={<Link to="/enrollments" className="btn btn-outline">Back to my enrollments</Link>}
        />
      </div>
    );
  }

  const q = data.quizzes;
  const scoreLabel = q.score === null || q.total_marks === null ? 'N/A' : String(Math.round(q.score));
  const outOf = q.total_marks ? Math.round(q.total_marks) : q.total * 5;

  return (
    <section className="wrap" style={{ paddingTop: 26, paddingBottom: 64 }}>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Store</Link>
        <span className="sep">/</span>
        <Link to={`/course/${data.course.slug || data.course.id}`} className="now">{data.course.title}</Link>
        <span className="sep">/</span>
        <span className="now">Course Analytics</span>
      </nav>

      <h1 className="h1" style={{ fontSize: 30, marginBottom: 26 }}>{data.course.title}</h1>

      <h2 className="an-section">Progress</h2>
      <div className="an-grid">
        <ProgressCard
          title="Lessons"
          percent={data.lessons.percent}
          rows={[
            { label: 'Total Video Lessons', value: data.lessons.total, tone: 'muted' },
            { label: 'Completed Video Lessons', value: data.lessons.done, tone: 'brand' },
          ]}
        />
        <ProgressCard
          title="Assignments"
          percent={data.assignments.percent}
          rows={[
            { label: 'Total Assignments Lessons', value: data.assignments.total, tone: 'muted' },
            { label: 'Completed Assignments Lessons', value: data.assignments.done, tone: 'brand' },
          ]}
        />
        <ProgressCard
          title="Quizzes"
          percent={data.quizzes.percent}
          rows={[
            { label: 'Total Quizzes Lessons', value: data.quizzes.total, tone: 'muted' },
            { label: 'Completed Quizzes Lessons', value: data.quizzes.done, tone: 'brand' },
          ]}
        />
      </div>

      <div className="an-head">
        <h2 className="an-section" style={{ margin: 0 }}>Quiz Analytics</h2>
        <button className="btn an-viewall" disabled={q.attempts === 0}>View All</button>
      </div>

      <div className="an-strip">
        <div className="an-strip-lead">
          <div className="an-strip-cap">Total Score</div>
          <div className="an-strip-big">{scoreLabel}</div>
          <div className="an-strip-sub">out of {outOf || '—'}</div>
        </div>

        <div className="an-strip-cells">
          <StripCell value={q.total} label="Quizzes" />
          <StripCell value={q.done || 'N/A'} label="Completed" />
          <StripCell value={q.accuracy === null ? 'N/A' : `${q.accuracy}%`} label="Accuracy" />
          <StripCell value={q.attempts ? q.attempts : 'N/A'} label="Attempts" />
          <StripCell value={hhmm(data.time_spent_secs)} label="Time Spent" />
        </div>
      </div>
    </section>
  );
}

function StripCell({ value, label }) {
  return (
    <div className="an-cell">
      <div className="an-cell-v">{value}</div>
      <div className="an-cell-l">{label}</div>
    </div>
  );
}
