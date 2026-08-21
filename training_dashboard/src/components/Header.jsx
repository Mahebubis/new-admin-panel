// ===========================================================================
//  Header.jsx — the bar on every signed-in screen.
//
//  Logo · search · DARK/LIGHT · Newsfeed · notifications · avatar menu, in that
//  order, mirroring the learner site. The avatar menu is the only stateful
//  piece: it closes on outside click, on Escape, and on navigation.
// ===========================================================================
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { goToDashboardLogin } from '../lib/dashboard';
import { useTheme } from '../context/ThemeContext';
import { Bell, Book, Help, Logout, Moon, Search, Star, Sun, User } from './icons';
import './header.css';

const MENU = [
  { to: '/account',     label: 'Account',        icon: User },
  { to: '/enrollments', label: 'My Enrollments', icon: Book },
  { to: '/favourites',  label: 'Favourites',     icon: Star },
  { to: '/helpdesk',    label: 'Helpdesk',       icon: Help },
];

export default function Header() {
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [seenPath, setSeenPath] = useState(location.pathname);
  const menuRef = useRef(null);

  /* Navigating closes the menu. Adjusting during render rather than in an
     effect avoids the extra frame where the menu is still open over the new
     page — see react.dev, "adjusting state when a prop changes". */
  if (seenPath !== location.pathname) {
    setSeenPath(location.pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const submitSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/enrollments?q=${encodeURIComponent(q)}` : '/enrollments');
  };

  return (
    <header className="hdr">
      <div className="wrap hdr-inner">
        <Link to="/" className="hdr-logo" aria-label="iStudio home">
          <span className="hdr-logo-i">i</span>Studio
        </Link>

        <form className="hdr-search" onSubmit={submitSearch} role="search">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search your courses"
          />
        </form>

        <button
          type="button"
          className="hdr-theme"
          onClick={toggle}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
          <span>{isDark ? 'LIGHT' : 'DARK'}</span>
        </button>

        <nav className="hdr-right">
          <Link to="/newsfeed" className="hdr-link">Newsfeed</Link>

          <Link to="/notifications" className="hdr-icon" aria-label="Notifications">
            <Bell size={20} />
          </Link>

          <div className="hdr-avatar-wrap" ref={menuRef}>
            <button
              type="button"
              className="hdr-avatar"
              onClick={() => setOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="Your account"
            >
              {user?.photo
                ? <img src={user.photo} alt="" />
                : <span>{user?.initial || 'L'}</span>}
            </button>

            {open && (
              <div className="hdr-menu" role="menu">
                <div className="hdr-menu-head">
                  <div className="hdr-menu-name">{user?.name}</div>
                  <div className="hdr-menu-mail">{user?.email}</div>
                </div>
                {MENU.map(({ to, label, icon: I }) => (
                  <Link key={to} to={to} className="hdr-menu-item" role="menuitem">
                    <I size={17} /> {label}
                  </Link>
                ))}
                <button
                  type="button"
                  className="hdr-menu-item danger"
                  role="menuitem"
                  onClick={async () => {
                    await logout();
                    /* Sign-in lives on the dashboard now, so logging out
                       leaves this origin entirely. */
                    goToDashboardLogin();
                  }}
                >
                  <Logout size={17} /> Sign out
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
