// ===========================================================================
//  App.jsx — routes, the signed-in guard, and page-level analytics.
// ===========================================================================
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { startTracking, stopTracking, trackPage } from './lib/tracking';
import Layout, { PageLoader } from './components/Layout';
import { DASHBOARD_LOGIN_URL, goToDashboardLogin } from './lib/dashboard';
/* ── the portal's own auth screens — PARKED, NOT DELETED ──────────────────
   Sign-in now happens on dashboard.internshipstudio.com and the learner
   arrives here through the Skill Lab handoff, so the portal no longer owns a
   login of its own. The pages and their routes are commented out rather than
   removed: everything still compiles the moment they are uncommented, which
   is the whole point of keeping them.

   To bring them back: uncomment these two imports, the <Public> component,
   and the three routes near the bottom of this file.

import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
──────────────────────────────────────────────────────────────────────────── */
import Home from './pages/Home';
import Enrollments from './pages/Enrollments';
import Course from './pages/Course';
import CourseAnalytics from './pages/CourseAnalytics';
import Support from './pages/Support';
import {
  About, Account, Explore, Favourites, ForgotPassword,
  Newsfeed, NotFound, Notifications,
} from './pages/Misc';

/**
 * Nothing inside the portal renders until we know who is asking.
 *
 * A signed-out visitor is sent to the dashboard's login, not to a local one.
 * This is a full page navigation rather than a <Navigate>, because the target
 * is a different origin — react-router cannot route to it.
 */
function Guard({ children }) {
  const { user, booting } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!booting && !user) goToDashboardLogin(location.pathname);
  }, [booting, user, location.pathname]);

  if (booting) return <PageLoader label="Signing you in…" />;
  if (!user) return <PageLoader label="Taking you to your dashboard…" />;
  return children;
}

/* Paired with the parked SignIn/SignUp routes below — uncomment together.

function Public({ children }) {
  const { user, booting } = useAuth();
  if (booting) return <PageLoader />;
  if (user) return <Navigate to="/" replace />;
  return children;
}
*/

/** A bookmarked /signin still has to end somewhere sensible. */
function DashboardRedirect() {
  useEffect(() => { goToDashboardLogin(); }, []);
  return <PageLoader label={`Redirecting to ${DASHBOARD_LOGIN_URL.replace(/^https?:\/\//, '')}…`} />;
}

export default function App() {
  const { user, booting, landing, takeLanding } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  /* Start counting the visit only once a learner is actually behind the door —
     tracking anonymous hits on the login screen would inflate everything. */
  useEffect(() => {
    if (user) startTracking();
    else stopTracking();
  }, [user]);

  /* The Course screen reports its own page views, because it needs to attribute
     time to the lesson rather than the route. */
  useEffect(() => {
    if (!user) return;
    if (location.pathname.startsWith('/course/') && !location.pathname.endsWith('/analytics')) return;
    trackPage({ path: location.pathname, title: document.title });
  }, [user, location.pathname]);

  /* A handoff can name a course; honour it once, on the first render after
     the pass is exchanged. */
  useEffect(() => {
    if (!user || booting || !landing?.courseId) return;
    const target = takeLanding();
    if (!target?.courseId) return;
    /* Course.jsx already reads ?lesson= and the player already seeks to the
       learner's saved watched_secs, so naming the lesson is all "resume"
       needs — there is no separate seek to perform here. */
    const to = `/course/id/${target.courseId}`
      + (target.lessonId ? `?lesson=${target.lessonId}` : '');
    navigate(to, { replace: true });
  }, [user, booting, landing, takeLanding, navigate]);

  return (
    <Routes>
      {/* Parked with the imports at the top of this file — uncomment together.

      <Route path="/signin"          element={<Public><SignIn /></Public>} />
      <Route path="/signup"          element={<Public><SignUp /></Public>} />
      <Route path="/forgot-password" element={<Public><ForgotPassword /></Public>} />
      */}

      {/* Anyone landing on an old auth link goes where sign-in actually lives. */}
      <Route path="/signin"          element={<DashboardRedirect />} />
      <Route path="/signup"          element={<DashboardRedirect />} />
      <Route path="/forgot-password" element={<DashboardRedirect />} />
      <Route path="/explore"         element={<Explore />} />

      <Route element={<Guard><Layout /></Guard>}>
        <Route path="/"                             element={<Home />} />
        <Route path="/enrollments"                  element={<Enrollments />} />
        <Route path="/course/:slug"                 element={<Course />} />
        <Route path="/course/id/:id"                element={<Course />} />
        <Route path="/course/:slug/analytics"       element={<CourseAnalytics />} />
        <Route path="/notifications"                element={<Notifications />} />
        <Route path="/newsfeed"                     element={<Newsfeed />} />
        <Route path="/favourites"                   element={<Favourites />} />
        <Route path="/account"                      element={<Account />} />
        <Route path="/support"                      element={<Support />} />
        {/* The old read-only "write to alerts@…" page. Anything bookmarked or
            linked lands on the real desk instead of a 404. */}
        <Route path="/helpdesk"                     element={<Navigate to="/support" replace />} />
        <Route path="/about"                        element={<About />} />
        <Route path="*"                             element={<NotFound />} />
      </Route>
    </Routes>
  );
}
