// ===========================================================================
//  Misc.jsx — the small screens the header and footer link to.
//
//  Notifications, Newsfeed, Favourites, Account, Helpdesk, About, Explore, and
//  the 404. They share one shape, so they share one file rather than eight
//  near-identical ones.
// ===========================================================================
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { EmptyState } from '../components/Layout';
import { Article } from '../components/icons';
import './courses.css';
import './auth.css';

/* ── notifications ─────────────────────────────────────────────────────── */
export function Notifications() {
  return (
    <section className="wrap" style={{ paddingTop: 40, paddingBottom: 60, minHeight: '58vh' }}>
      <EmptyState title="No Notifications available" />
    </section>
  );
}

/* ── newsfeed ──────────────────────────────────────────────────────────── */
export function Newsfeed() {
  return (
    <section className="wrap" style={{ paddingTop: 34, paddingBottom: 60 }}>
      <div className="sec-head">
        <h1 className="h1" style={{ fontSize: 32 }}>Newsfeed</h1>
      </div>

      <div style={{ display: 'flex', gap: 26, marginTop: 30, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 92, textAlign: 'center', color: 'var(--link)' }}>
          <Article size={34} />
          <div style={{ fontSize: 13, marginTop: 6, color: 'var(--text-2)' }}>Article</div>
        </div>
        <div style={{ flex: 1, minWidth: 280 }}>
          <EmptyState
            title="Nothing to explore"
            message="Currently there is nothing to explore, Please come back later."
          />
        </div>
      </div>
    </section>
  );
}

/* ── favourites ────────────────────────────────────────────────────────── */
export function Favourites() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(0);

  /* Optimistic: the card disappears immediately and only comes back if the
     server refuses. Waiting for a round trip to remove a bookmark reads as a
     broken button. */
  const remove = async (courseId) => {
    setBusy(courseId);
    const before = rows;
    setRows((r) => r.filter((c) => c.course_id !== courseId));
    try {
      await api.toggleFav(courseId);
    } catch {
      setRows(before);
    } finally {
      setBusy(0);
    }
  };

  useEffect(() => {
    let alive = true;
    api.favourites()
      .then((d) => alive && setRows(d.favourites || []))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  return (
    <>
      <section className="page-banner"><div className="wrap"><h1 className="h1">Favourites</h1></div></section>
      <section className="wrap" style={{ paddingTop: 26, paddingBottom: 60, minHeight: '40vh' }}>
        {loading && <div className="skeleton" style={{ height: 120 }} />}

        {!loading && rows.length === 0 && (
          <EmptyState
            title="No favourites yet"
            message="Tap “Add to favourites” inside a course and it will wait for you here."
            action={<Link to="/enrollments" className="btn btn-outline">Browse my courses</Link>}
          />
        )}

        {!loading && rows.length > 0 && (
          <div className="grid-cards">
            {rows.map((c) => (
              /* The card is a Link, so the remove control cannot be nested
                 inside it as a real button — it sits alongside, positioned
                 over the corner, and stops the click from navigating. */
              <div key={c.course_id} className="fav-cell">
                <Link to={`/course/${c.slug || c.course_id}`} className="card card-hover mini">
                  <div className="mini-thumb">
                    {c.thumbnail_url ? <img src={c.thumbnail_url} alt="" loading="lazy" />
                      : <span>{(c.title || '?').charAt(0)}</span>}
                  </div>
                  <div className="mini-body">
                    <div className="mini-title">{c.title}</div>
                    <div className="mini-meta">{c.lesson_count} Lessons</div>
                  </div>
                </Link>
                <button
                  type="button"
                  className="fav-remove"
                  title="Remove from favourites"
                  aria-label={`Remove ${c.title} from favourites`}
                  disabled={busy === c.course_id}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(c.course_id); }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/* ── account ───────────────────────────────────────────────────────────── */
export function Account() {
  const { user, method } = useAuth();

  const how = {
    password: 'Email and password',
    google: 'Google',
    store: '₹99 store password',
    handoff: 'Opened from your dashboard',
  }[method] || '—';

  return (
    <>
      <section className="page-banner"><div className="wrap"><h1 className="h1">Account</h1></div></section>
      <section className="wrap wrap-narrow" style={{ paddingTop: 30, paddingBottom: 60 }}>
        <div className="card" style={{ padding: 26 }}>
          <Field label="Name" value={user?.name} />
          <Field label="Email" value={user?.email} />
          {user?.phone && <Field label="Phone" value={user.phone} />}
          <Field label="Signed in with" value={how} last />
        </div>

        <p className="tiny" style={{ marginTop: 18 }}>
          Your name, email and password are shared with your Internship Studio dashboard —
          change them there and they change here too.
        </p>
      </section>
    </>
  );
}

function Field({ label, value, last }) {
  return (
    <div style={{
      display: 'flex', gap: 18, padding: '14px 0', flexWrap: 'wrap',
      borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <div style={{ minWidth: 160, fontSize: 13, color: 'var(--text-2)' }}>{label}</div>
      <div style={{ fontSize: 14.5, fontWeight: 500 }}>{value || '—'}</div>
    </div>
  );
}

/* ── helpdesk / about ──────────────────────────────────────────────────── */
export function Helpdesk() {
  return (
    <section className="wrap wrap-narrow" style={{ paddingTop: 46, paddingBottom: 60 }}>
      <h1 className="h1" style={{ fontSize: 30 }}>Helpdesk</h1>
      <p className="muted" style={{ marginTop: 12, fontSize: 15, lineHeight: 1.75 }}>
        Something not playing, or a course missing from your library? Write to{' '}
        <a href="mailto:alerts@internshipstudio.com" style={{ color: 'var(--brand)', textDecoration: 'underline' }}>
          alerts@internshipstudio.com
        </a>{' '}
        with the email you bought with, and we'll sort it out.
      </p>
    </section>
  );
}

export function About() {
  return (
    <section className="wrap wrap-narrow" style={{ paddingTop: 46, paddingBottom: 60 }}>
      <h1 className="h1" style={{ fontSize: 30 }}>About iStudio</h1>
      <p className="muted" style={{ marginTop: 12, fontSize: 15, lineHeight: 1.75 }}>
        iStudio is Internship Studio's learning portal — the place your purchased
        training actually plays: lessons, attachments, quizzes and your progress
        across all of them.
      </p>
    </section>
  );
}

/* ── explore (signed out) ──────────────────────────────────────────────── */
export function Explore() {
  return (
    <div className="auth">
      <div className="auth-card fade-up">
        <div className="auth-logo"><span>i</span>Studio</div>
        <h1 className="auth-title" style={{ fontSize: 26 }}>Welcome to iStudio</h1>
        <p className="muted" style={{ marginTop: 10, fontSize: 15 }}>No course available to enroll</p>
        <div style={{ marginTop: 30, display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link to="/signin" className="btn btn-outline">Sign in</Link>
          <Link to="/signup" className="btn btn-brand">Sign up</Link>
        </div>
      </div>
    </div>
  );
}

/* ── 404 ───────────────────────────────────────────────────────────────── */
export function NotFound() {
  return (
    <section className="wrap" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <EmptyState
        title="That page does not exist"
        message="The link may be old, or the course may have moved."
        action={<Link to="/" className="btn btn-outline">Back to home</Link>}
      />
    </section>
  );
}

/* ── forgot password ───────────────────────────────────────────────────── */
export function ForgotPassword() {
  return (
    <div className="auth">
      <div className="auth-card fade-up">
        <div className="auth-logo"><span>i</span>Studio</div>
        <h1 className="auth-title" style={{ fontSize: 27 }}>Forgot your password?</h1>
        <p className="muted" style={{ marginTop: 12, fontSize: 15, lineHeight: 1.7 }}>
          Your portal password is your Internship Studio dashboard password, so reset it there —
          it will work here straight away.
        </p>
        <a
          className="btn btn-brand btn-block btn-lg"
          style={{ marginTop: 26 }}
          href="https://dashboard.internshipstudio.com/forgot-password"
        >
          Reset it on the dashboard
        </a>
        <p className="auth-explore" style={{ marginTop: 26 }}>
          Remembered it? <Link to="/signin">SIGN IN</Link>
        </p>
      </div>
    </div>
  );
}
