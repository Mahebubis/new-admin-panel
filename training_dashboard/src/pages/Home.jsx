// ===========================================================================
//  Home.jsx — "/", the screen a learner lands on.
//
//  The gradient welcome banner, then "Continue Learning" holding the single
//  course they were last in, with "My Enrollments →" alongside it. When there
//  is nothing to continue, the empty figure takes the whole space, exactly as
//  the learner site does.
// ===========================================================================
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { EmptyState } from '../components/Layout';
import UpcomingBatches from '../components/UpcomingBatches';
import { ArrowRight } from '../components/icons';
import CourseRow from '../components/CourseRow';
import './courses.css';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.home()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const cont = data?.continue;

  return (
    <>
      <section className="banner">
        <div className="wrap">
          <p className="hi">Hi {user?.name?.split(' ')[0] || 'there'},</p>
          <h1 className="h1">Welcome to iStudio</h1>
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 44, paddingBottom: 24 }}>
        <div className="sec-head">
          <h2 className="h2">Continue Learning</h2>
          <Link to="/enrollments" className="sec-link">
            My Enrollments <ArrowRight size={17} />
          </Link>
        </div>

        {loading && (
          <div className="card" style={{ display: 'flex', gap: 20, padding: 20, marginTop: 24 }}>
            <div className="skeleton" style={{ width: 200, height: 124, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'grid', gap: 12, alignContent: 'center' }}>
              <div className="skeleton" style={{ height: 12, width: '12%' }} />
              <div className="skeleton" style={{ height: 18, width: '42%' }} />
              <div className="skeleton" style={{ height: 12, width: '24%' }} />
            </div>
          </div>
        )}

        {!loading && error && (
          <EmptyState
            title="We could not load your courses"
            message={error}
            action={<button className="btn btn-outline" onClick={() => window.location.reload()}>Try again</button>}
          />
        )}

        {/* The tall empty figure is only right when there is genuinely
            nothing. With batches waiting, it pushed the one thing worth
            reading — what they own and when it opens — below the fold, so
            that case gets a single line instead and the cards come straight
            after it. */}
        {!loading && !error && !cont && !(data?.upcoming?.length) && (
          <EmptyState
            title="Nothing to continue yet"
            message="Courses you buy show up here the moment they're ready. Head to your dashboard to pick one up."
          />
        )}

        {!loading && !error && !cont && !!data?.upcoming?.length && (
          <>
            <p className="upc-lede">
              Nothing has opened yet — here is everything you own and the day each batch begins.
            </p>
            <UpcomingBatches items={data.upcoming} title="Your batches" />
          </>
        )}

        {!loading && !error && cont && (
          <div style={{ marginTop: 24 }}>
            <CourseRow
              course={cont}
              onOpen={() => navigate(cont.slug ? `/course/${cont.slug}` : `/course/id/${cont.course_id}`)}
            />
          </div>
        )}
      </section>

      {/* ── what they can open RIGHT NOW ──────────────────────────────────
          The library comes before the batches. Everything here is playable
          today; "Starting soon" is a list of locked cards with dates on them,
          and with ten of those in the way the courses a learner could
          actually watch were pushed off the bottom of the screen. */}
      {!loading && !error && (data?.enrollments?.length || 0) > 1 && (
        <section className="wrap" style={{ paddingBottom: 10 }}>
          <div className="sec-head" style={{ marginTop: 22 }}>
            <h2 className="h2" style={{ fontSize: 21 }}>Also in your library</h2>
            <Link to="/enrollments" className="sec-link">
              See all <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid-cards">
            {data.enrollments
              .filter((c) => c.course_id !== cont?.course_id)
              .slice(0, 6)
              .map((c) => (
                <CourseCardMini key={c.course_id} course={c} />
              ))}
          </div>
        </section>
      )}

      {/* Only when there IS something to continue — otherwise it has
          already been rendered above, in the main section. */}
      {!loading && !error && !!cont && !!data?.upcoming?.length && (
        <section className="wrap" style={{ paddingBottom: 40 }}>
          <UpcomingBatches items={data.upcoming} />
        </section>
      )}
    </>
  );
}

function CourseCardMini({ course }) {
  const to = course.slug ? `/course/${course.slug}` : `/course/id/${course.course_id}`;
  return (
    <Link to={to} className="card card-hover mini">
      <div className="mini-thumb">
        {course.thumbnail_url
          ? <img src={course.thumbnail_url} alt="" loading="lazy" />
          : <span>{(course.title || '?').charAt(0)}</span>}
      </div>
      <div className="mini-body">
        <div className="mini-title">{course.title}</div>
        <div className="mini-meta">{course.lesson_count} Lessons</div>
        <div className="bar-row" style={{ marginTop: 12 }}>
          <div className="bar"><i style={{ width: `${course.progress}%` }} /></div>
          <span className="pct">{course.progress}%</span>
        </div>
      </div>
    </Link>
  );
}
