// ===========================================================================
//  Enrollments.jsx — "/enrollments", the My Enrollments screen.
//
//  Peach page banner, STORE / MY ENROLLMENTS crumbs, an "All (n)" heading with
//  a Filter By Type select on the right, then one divider-separated row per
//  course — active first, expired after.
// ===========================================================================
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import CourseRow from '../components/CourseRow';
import UpcomingBatches from '../components/UpcomingBatches';
import { CardSkeletons, EmptyState } from '../components/Layout';
import './courses.css';

const FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'active',    label: 'Active' },
  { key: 'expired',   label: 'Expired' },
  { key: 'completed', label: 'Completed' },
];

export default function Enrollments() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  /* Paid for, but the batch has not opened yet — see UpcomingBatches. */
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const filter = params.get('type') || 'all';
  const query = (params.get('q') || '').toLowerCase().trim();

  useEffect(() => {
    let alive = true;
    api.enrollments()
      .then((d) => {
        if (!alive) return;
        setRows(d.enrollments || []);
        setUpcoming(d.upcoming || []);
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const shown = useMemo(() => {
    let list = rows;
    if (filter === 'active')    list = list.filter((c) => !c.expired);
    if (filter === 'expired')   list = list.filter((c) => c.expired);
    if (filter === 'completed') list = list.filter((c) => c.progress >= 100);
    if (query) {
      list = list.filter((c) =>
        `${c.title} ${c.category || ''} ${c.instructor || ''}`.toLowerCase().includes(query));
    }
    return list;
  }, [rows, filter, query]);

  const setFilter = (type) => {
    const next = new URLSearchParams(params);
    if (type === 'all') next.delete('type'); else next.set('type', type);
    setParams(next, { replace: true });
  };

  return (
    <>
      <section className="page-banner">
        <div className="wrap"><h1 className="h1">My Enrollments</h1></div>
      </section>

      <section className="wrap" style={{ paddingTop: 24, paddingBottom: 60 }}>
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/">Store</Link>
          <span className="sep">/</span>
          <span className="now">My Enrollments</span>
        </nav>

        <div className="list-head">
          <div className="list-count">
            <h2>{FILTERS.find((f) => f.key === filter)?.label || 'All'}</h2>
            <span className="n">{loading ? '–' : shown.length}</span>
          </div>

          <select
            className="select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter by type"
          >
            {FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.key === 'all' ? 'Filter By Type' : f.label}
              </option>
            ))}
          </select>
        </div>

        {query && (
          <p className="tiny" style={{ marginBottom: 12 }}>
            Showing results for “{query}” — <button className="btn-ghost" style={{ textDecoration: 'underline' }}
              onClick={() => { const n = new URLSearchParams(params); n.delete('q'); setParams(n, { replace: true }); }}>
              clear
            </button>
          </p>
        )}

        {loading && <CardSkeletons count={4} />}

        {!loading && error && (
          <EmptyState
            title="We could not load your enrollments"
            message={error}
            action={<button className="btn btn-outline" onClick={() => window.location.reload()}>Try again</button>}
          />
        )}

        {/* An empty list is not the same as "you own nothing" once a batch
            is merely waiting to start, so the message changes rather than
            telling someone with six paid internships they have none. */}
        {!loading && !error && shown.length === 0 && !(rows.length === 0 && upcoming.length > 0) && (
          <EmptyState
            title={rows.length ? 'Nothing matches that filter' : 'No enrollments yet'}
            message={rows.length
              ? 'Try a different filter, or clear the search to see everything you own.'
              : 'Courses you buy appear here as soon as they are published.'}
            action={rows.length
              ? <button className="btn btn-outline" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Show all</button>
              : null}
          />
        )}

        {!loading && !error && shown.length > 0 && (
          <div className="list-rows">
            {shown.map((c) => (
              <CourseRow
                key={c.course_id}
                course={c}
                onOpen={() => navigate(c.slug ? `/course/${c.slug}` : `/course/id/${c.course_id}`)}
              />
            ))}
          </div>
        )}

        {!loading && !error && (
          <UpcomingBatches items={upcoming} title="Your upcoming batches" />
        )}
      </section>
    </>
  );
}
