// ===========================================================================
//  LmsLayout.jsx — the shell for the "LMS System" page.
//
//  Renders the Learnyst-style navigation as a RIGHT-hand rail (Dashboard,
//  Courses, Users, …) and the active tab's <Outlet />. Every tab carries its
//  OWN permission key (see lmsTabs.js), so a sub-admin can be given (say) only
//  Users + Enrollments without seeing Courses or Settings. The whole page is
//  additionally gated on `lms_system` in App.jsx.
//
//  The rail and the admin panel's left sidebar are mutually exclusive: opening
//  one collapses the other (see hooks/sidebarBus.js). Landing on /lms opens the
//  rail, which is why the left sidebar folds on entry.
// ===========================================================================
import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { Lock, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { announceExpanded, onExpanded, readRailOpen, writeRailOpen } from '../../hooks/sidebarBus';
import { useLmsStyles } from './lmsTheme';
import { LMS_TABS } from './lmsTabs';
import { Empty } from './LmsStyles';

/**
 * Per-tab permission wrapper. Unlike the route-level <PermissionGate>, this
 * keeps the user inside the LMS and just explains what they're missing —
 * bouncing them out to the admin dashboard mid-navigation is far more jarring.
 */
export function LmsGate({ perm, children }) {
  const { hasPermission, isSuperadmin } = useAuth();
  if (isSuperadmin || hasPermission(perm)) return children;

  const tab = LMS_TABS.find(t => t.perm === perm);
  return (
    <div className="lms-page">
      <Empty
        icon={<Lock size={24} />}
        title="You don't have access to this tab"
        message={`The "${tab?.label || perm}" tab needs the "${perm}" permission. Ask a Super Admin to grant it from Permissions → LMS.`}
      />
    </div>
  );
}

export default function LmsLayout() {
  useLmsStyles();
  const { hasPermission, isSuperadmin } = useAuth();
  const location = useLocation();
  const [railOpen, setRailOpen] = useState(readRailOpen);

  const tabs = useMemo(
    () => LMS_TABS.filter(t => isSuperadmin || hasPermission(t.perm)),
    [hasPermission, isSuperadmin]
  );

  /* Entering the LMS claims the screen: AdminLayout folds its sidebar in
     response. `railOpen` already starts from the saved preference via useState,
     so there is nothing to set here — only to announce. */
  useEffect(() => {
    if (readRailOpen()) announceExpanded('lms');
  }, []);

  /* …and the moment the admin sidebar is expanded again, the rail gives way. */
  useEffect(() => onExpanded(which => { if (which === 'admin') setRailOpen(false); }), []);

  const toggleRail = useCallback(() => {
    setRailOpen(prev => {
      const next = !prev;
      writeRailOpen(next);
      if (next) announceExpanded('lms');
      return next;
    });
  }, []);

  /* Landing on /lms without the dashboard permission: send them to the first
     tab they *can* open rather than showing an empty shell. */
  const onIndex = location.pathname === '/lms' || location.pathname === '/lms/';
  const canDashboard = isSuperadmin || hasPermission('lms_dashboard');
  if (onIndex && !canDashboard && tabs.length) {
    return <Navigate to={tabs[0].to} replace />;
  }

  const railWidth = railOpen ? 232 : 60;

  /* Page first, rail second: `.lms-root` is a flex row, so DOM order is visual
     order and the rail needs to come last to sit on the right. */
  return (
    <div className="lms-root" style={{ minHeight: '100vh', background: '#fff' }}>
      <div className="lms-rail-body">
        {tabs.length === 0 ? (
          <div className="lms-page">
            <Empty
              icon={<Lock size={24} />}
              title="No LMS tabs available"
              message="You have access to the LMS System page but none of its tabs. Ask a Super Admin to grant at least one LMS permission."
            />
          </div>
        ) : (
          <Outlet />
        )}
      </div>

      <aside className={`lms-rail${railOpen ? ' open' : ''}`} style={{ width: railWidth }}>
        <button
          type="button"
          className="lms-rail-toggle"
          onClick={toggleRail}
          title={railOpen ? 'Collapse LMS menu' : 'Expand LMS menu'}
          aria-expanded={railOpen}
        >
          {railOpen
            ? <><PanelRightClose size={15} /><span>Collapse menu</span></>
            : <PanelRightOpen size={15} />}
        </button>

        <nav className="lms-rail-nav">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <NavLink
                key={t.key}
                to={t.to}
                end={t.end}
                title={railOpen ? undefined : t.label}
                className={({ isActive }) => `lms-rail-item${isActive ? ' active' : ''}`}
              >
                <span className="lms-rail-ico"><Icon size={17} /></span>
                <span className="lms-rail-label">{t.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
