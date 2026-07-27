import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';

/* ── Netcore sub-layout: top navbar + section sub-navbar + outlet ── */

const SECTIONS = {
  dashboard: { title: 'Dashboards', items: [{ to: '/netcore/behaviour', label: 'Home' }] },
  users:     { title: 'Audience',   items: [
    { to: '/netcore/contacts', label: 'All contacts' },
    { to: '/netcore/segments',   label: 'Segments' },
    { to: '/netcore/lists',      label: 'Lists' },
    { to: '/netcore/blocklist',  label: 'Blocklist' },
    { to: '/netcore/attributes', label: 'Attributes' },
  ] },
  engage:    { title: 'Engage',     items: [
    { to: '/netcore/campaigns', label: 'Campaigns' },
  ] },
  content:   { title: 'Content',    items: [
    { to: '/netcore/templates', label: 'Template' },
  ] },
};

function activeSection(p) {
  if (p.startsWith('/netcore/contacts') || p.startsWith('/netcore/segments') || p.startsWith('/netcore/lists') || p.startsWith('/netcore/blocklist') || p.startsWith('/netcore/attributes')) return 'users';
  if (p.startsWith('/netcore/campaigns')) return 'engage';
  if (p.startsWith('/netcore/templates')) return 'content';
  return 'dashboard';
}

export default function NetcoreLayout() {
  const loc = useLocation();
  if (loc.pathname === '/netcore' || loc.pathname === '/netcore/') return <Navigate to="/netcore/behaviour" replace />;
  const current = activeSection(loc.pathname);
  const section = SECTIONS[current];

  const Icon = ({ name }) => {
    if (name === 'dashboard')
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
    if (name === 'engage')
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-8-8 18-2-8-8-2z" /></svg>;
    if (name === 'content')
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v5" /></svg>;
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  };

  return (
    <>
      <style>{`
        .nc-shell { display: flex; flex-direction: column; background: #f1f0ff; height: calc(100vh - 94px); margin: -16px -20px; }
        .nc-nav-top {
          display: flex; align-items: center; gap: 4px;
          background: #1e3a8a; padding: 0 16px; flex-shrink: 0; height: 44px;
          box-shadow: 0 1px 3px rgba(0,0,0,.15);
        }
        .nc-nav-top a {
          display: inline-flex; align-items: center; gap: 8px; padding: 0 16px; height: 44px;
          color: rgba(255,255,255,.75); text-decoration: none; font-size: 13px; font-weight: 600;
          border-bottom: 3px solid transparent; transition: color .15s; box-sizing: border-box;
        }
        .nc-nav-top a:hover { color: #fff; }
        .nc-nav-top a.active { color: #fff; border-bottom-color: #f59e0b; background: rgba(255,255,255,.06); }

        .nc-nav-sub {
          display: flex; align-items: center; gap: 4px; flex-shrink: 0;
          background: #fff; padding: 0 20px; height: 42px;
          border-bottom: 1px solid #e2e8f0;
        }
        .nc-nav-sub-title { font-size: 13px; font-weight: 700; color: #0f172a; padding-right: 18px; border-right: 1px solid #e2e8f0; margin-right: 12px; }
        .nc-nav-sub a {
          padding: 0 14px; height: 42px; display: inline-flex; align-items: center;
          color: #475569; font-size: 12.5px; font-weight: 500; text-decoration: none;
          border-bottom: 2px solid transparent; box-sizing: border-box;
        }
        .nc-nav-sub a:hover { color: #1e3a8a; }
        .nc-nav-sub a.active { color: #1e3a8a; font-weight: 600; border-bottom-color: #1e3a8a; }

        .nc-main { flex: 1; min-height: 0; overflow: auto; }
      `}</style>

      <div className="nc-shell">
        <nav className="nc-nav-top">
          <NavLink to="/netcore/behaviour" className={current === 'dashboard' ? 'active' : ''}>
            <Icon name="dashboard" /><span>Dashboards</span>
          </NavLink>
          <NavLink to="/netcore/contacts" className={current === 'users' ? 'active' : ''}>
            <Icon name="users" /><span>Audience</span>
          </NavLink>
          <NavLink to="/netcore/campaigns" className={current === 'engage' ? 'active' : ''}>
            <Icon name="engage" /><span>Engage</span>
          </NavLink>
          <NavLink to="/netcore/templates" className={current === 'content' ? 'active' : ''}>
            <Icon name="content" /><span>Content</span>
          </NavLink>
        </nav>

        <nav className="nc-nav-sub">
          <span className="nc-nav-sub-title">{section.title}</span>
          {section.items.map(it => (
            <NavLink key={it.to} to={it.to}
              end={it.to === '/netcore/contacts' || it.to === '/netcore/segments' || it.to === '/netcore/lists' || it.to === '/netcore/blocklist' || it.to === '/netcore/attributes' || it.to === '/netcore/campaigns' || it.to === '/netcore/templates'}>
              {it.label}
            </NavLink>
          ))}
        </nav>

        <main className="nc-main"><Outlet /></main>
      </div>
    </>
  );
}
