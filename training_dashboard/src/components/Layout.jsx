// ===========================================================================
//  Layout.jsx — header + page + footer, plus the shared empty/loading pieces
//  every screen reaches for.
// ===========================================================================
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import SupportFab from './SupportFab';
import { EmptyFigure } from './icons';

export default function Layout({ bare = false }) {
  return (
    <div className="shell">
      <Header />
      <main className="shell-main">
        <Outlet />
      </main>
      {!bare && <Footer />}
      {/* Every signed-in screen hangs off this layout, so one mount here is
          the support door on all of them. */}
      <SupportFab />
    </div>
  );
}

/** The illustration-plus-message block the learner site uses on every dead end. */
export function EmptyState({ title, message, action }) {
  return (
    <div className="empty" style={{ color: 'var(--text-3)' }}>
      <EmptyFigure />
      <h3 style={{ color: 'var(--text)' }}>{title}</h3>
      {message && <p>{message}</p>}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}

/** Full-page boot spinner — only shown while the session is being resolved. */
export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="empty" style={{ minHeight: '60vh', justifyContent: 'center' }}>
      <div className="spinner spinner-dark" />
      <p style={{ marginTop: 16 }}>{label}</p>
    </div>
  );
}

/** Card-shaped placeholders, so a slow network shows structure instead of a void. */
export function CardSkeletons({ count = 3 }) {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card" style={{ display: 'flex', gap: 18, padding: 18 }}>
          <div className="skeleton" style={{ width: 176, height: 108, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'grid', gap: 10, alignContent: 'center' }}>
            <div className="skeleton" style={{ height: 15, width: '38%' }} />
            <div className="skeleton" style={{ height: 12, width: '58%' }} />
            <div className="skeleton" style={{ height: 4, width: '100%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
