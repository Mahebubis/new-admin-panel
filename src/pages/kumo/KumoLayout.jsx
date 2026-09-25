/*
 * Kumo MTA sub-layout.
 *
 * Deliberately the SAME chrome as NetcoreLayout: a dark top row of sections, a
 * white sub-nav underneath, and a single scrolling main area. The negative
 * margin pulls it flush against the admin topbar so there is no gap, and both
 * nav rows sit outside the scroll container, so they stay put while the page
 * scrolls.
 */
import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { kapi } from './kumoShared';

const SECTIONS = {
  dashboard: { title: 'Dashboard', items: [
    { to: '/kumo', label: 'Overview', icon: 'home', end: true },
    { to: '/kumo/logs', label: 'Message logs', icon: 'logs' },
  ] },
  infra: { title: 'Infrastructure', items: [
    { to: '/kumo/ips', label: 'Sending IPs', icon: 'server' },
    { to: '/kumo/settings', label: 'Settings', icon: 'settings' },
  ] },
  audience: { title: 'Audience', items: [
    { to: '/kumo/contacts', label: 'All contacts', icon: 'contacts' },
    { to: '/kumo/segments', label: 'Segments', icon: 'segments' },
    { to: '/kumo/lists', label: 'Lists', icon: 'lists' },
    { to: '/kumo/blocklist', label: 'Blocklist', icon: 'blocklist' },
    { to: '/kumo/attributes', label: 'Attributes', icon: 'attributes' },
  ] },
  engage: { title: 'Engage', items: [
    { to: '/kumo/campaigns', label: 'Campaigns', icon: 'mail' },
  ] },
  content: { title: 'Content', items: [
    { to: '/kumo/templates', label: 'Email templates', icon: 'mailTemplate' },
  ] },
};

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };

const SUB_ICONS = {
  home:       <><path d="M3 10.5 12 3l9 7.5" {...S} /><path d="M5.5 9.5V20h13V9.5" {...S} /><path d="M9.5 20v-5.5h5V20" {...S} /></>,
  logs:       <><path d="M4 6h16M4 12h16M4 18h10" {...S} /></>,
  server:     <><rect x="3" y="4.5" width="18" height="6.5" rx="2" {...S} /><rect x="3" y="13" width="18" height="6.5" rx="2" {...S} /><path d="M7 7.8h.01M7 16.2h.01" {...S} /></>,
  settings:   <><circle cx="12" cy="12" r="3" {...S} /><path d="M19.2 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" {...S} /></>,
  contacts:   <><circle cx="9" cy="8" r="3.2" {...S} /><path d="M3 20a6 6 0 0 1 12 0" {...S} /><path d="M16.5 5.4a3.2 3.2 0 0 1 0 5.2M17 14.3A5.2 5.2 0 0 1 21 20" {...S} /></>,
  segments:   <><path d="M3.5 5h17l-6.6 7.6V20l-3.8-2.2v-5.2z" {...S} /></>,
  lists:      <><path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12" {...S} /><circle cx="4.3" cy="6.5" r="1.3" fill="currentColor" /><circle cx="4.3" cy="12" r="1.3" fill="currentColor" /><circle cx="4.3" cy="17.5" r="1.3" fill="currentColor" /></>,
  attributes: <><path d="M11 3.2H4.6a1.4 1.4 0 0 0-1.4 1.4V11a2 2 0 0 0 .6 1.4l7.6 7.6a1.4 1.4 0 0 0 2 0l6.4-6.4a1.4 1.4 0 0 0 0-2l-7.6-7.6A2 2 0 0 0 11 3.2z" {...S} /><circle cx="7.6" cy="7.6" r="1.35" fill="currentColor" /></>,
  blocklist:  <><circle cx="12" cy="12" r="8.4" {...S} /><path d="M6.1 6.1l11.8 11.8" {...S} /></>,
  mail:         <><rect x="2.8" y="5" width="18.4" height="14" rx="2.2" {...S} /><path d="m3.4 7 8.6 6 8.6-6" {...S} /></>,
  mailTemplate: <><rect x="2.8" y="4.6" width="18.4" height="14.8" rx="2.2" {...S} /><path d="M2.8 9.2h18.4" {...S} /><path d="M6.6 13h6.4M6.6 16h9.4" {...S} /></>,
};

const TOP_ICONS = {
  dashboard: <><rect x="3" y="3" width="7.5" height="8.5" rx="1.6" {...S} /><rect x="13.5" y="3" width="7.5" height="5" rx="1.6" {...S} /><rect x="13.5" y="10.5" width="7.5" height="10.5" rx="1.6" {...S} /><rect x="3" y="14" width="7.5" height="7" rx="1.6" {...S} /></>,
  infra:     SUB_ICONS.server,
  audience:  SUB_ICONS.contacts,
  engage:    <><path d="m21.5 2.5-8 19-3.2-7.8L2.5 10.5z" {...S} /></>,
  content:   SUB_ICONS.mailTemplate,
};

const Icon = ({ name, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>{SUB_ICONS[name] || TOP_ICONS[name]}</svg>
);

/* Which top section the current URL belongs to. */
function sectionOf(pathname) {
  if (pathname.startsWith('/kumo/ips') || pathname.startsWith('/kumo/settings')) return 'infra';
  if (pathname.startsWith('/kumo/contacts') || pathname.startsWith('/kumo/segments')
      || pathname.startsWith('/kumo/lists') || pathname.startsWith('/kumo/blocklist') || pathname.startsWith('/kumo/attributes')) return 'audience';
  if (pathname.startsWith('/kumo/campaigns')) return 'engage';
  if (pathname.startsWith('/kumo/templates')) return 'content';
  return 'dashboard';
}

export default function KumoLayout() {
  const loc = useLocation();
  const current = sectionOf(loc.pathname);
  const sub = SECTIONS[current];

  const [status, setStatus] = useState({ ok: null, red: 0, alerts: 0 });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const d = await kapi('dashboard');
        if (!alive) return;
        setStatus({
          ok: !!d?.api_health?.latest?.ok,
          red: (d?.ips || []).filter((i) => i.health === 'red').length,
          alerts: (d?.alerts || []).length,
        });
      } catch { /* the page shows its own error */ }
    };
    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 60000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <>
      <style>{`
        /* Flush against the admin chrome — the negative margin cancels AdminLayout's
           content padding so the navy bar touches the topbar with no gap. */
        .km-shell2 { display:flex; flex-direction:column; background:#f1f0ff; height:calc(100vh - 94px); margin:-16px -20px; }

        .km-nav-top { display:flex; align-items:center; gap:4px; background:#1e3a8a; padding:0 16px;
          flex-shrink:0; height:44px; box-shadow:0 1px 3px rgba(0,0,0,.15); }
        .km-nav-top a { display:inline-flex; align-items:center; gap:8px; padding:0 16px; height:44px;
          color:rgba(255,255,255,.75); text-decoration:none; font-size:13px; font-weight:600;
          border-bottom:3px solid transparent; transition:color .15s; box-sizing:border-box; }
        .km-nav-top a:hover { color:#fff; }
        .km-nav-top a.active { color:#fff; border-bottom-color:#f59e0b; background:rgba(255,255,255,.06); }
        .km-nav-status { margin-left:auto; display:flex; align-items:center; gap:8px; }
        .km-chip { display:inline-flex; align-items:center; gap:6px; height:24px; padding:0 10px; border-radius:999px;
          font-size:11.5px; font-weight:700; letter-spacing:.2px; }
        .km-chip i { width:7px; height:7px; border-radius:50%; display:inline-block; }

        .km-nav-sub { display:flex; align-items:center; gap:4px; flex-shrink:0; background:#fff; padding:0 20px;
          height:42px; border-bottom:1px solid #e2e8f0; overflow-x:auto; scrollbar-width:none; }
        .km-nav-sub::-webkit-scrollbar { display:none; }
        .km-nav-sub-title { font-size:13px; font-weight:700; color:#0f172a; padding-right:18px;
          border-right:1px solid #e2e8f0; margin-right:12px; white-space:nowrap; }
        .km-nav-sub a { padding:0 13px; height:42px; display:inline-flex; align-items:center; gap:7px; color:#475569;
          font-size:12.5px; font-weight:500; text-decoration:none; border-bottom:2px solid transparent;
          box-sizing:border-box; white-space:nowrap; }
        .km-nav-sub a svg { flex-shrink:0; opacity:.62; transition:opacity .15s; }
        .km-nav-sub a:hover { color:#1e3a8a; }
        .km-nav-sub a:hover svg { opacity:.9; }
        .km-nav-sub a.active { color:#1e3a8a; font-weight:600; border-bottom-color:#1e3a8a; }
        .km-nav-sub a.active svg { opacity:1; }

        .km-main { flex:1; min-height:0; overflow:auto; }
      `}</style>

      <div className="km-shell2">
        <nav className="km-nav-top">
          <NavLink to="/kumo" className={() => (current === 'dashboard' ? 'active' : '')}>
            <Icon name="dashboard" /><span>Dashboard</span>
          </NavLink>
          <NavLink to="/kumo/ips" className={() => (current === 'infra' ? 'active' : '')}>
            <Icon name="infra" /><span>Infrastructure</span>
          </NavLink>
          <NavLink to="/kumo/contacts" className={() => (current === 'audience' ? 'active' : '')}>
            <Icon name="audience" /><span>Audience</span>
          </NavLink>
          <NavLink to="/kumo/campaigns" className={() => (current === 'engage' ? 'active' : '')}>
            <Icon name="engage" /><span>Engage</span>
          </NavLink>
          <NavLink to="/kumo/templates" className={() => (current === 'content' ? 'active' : '')}>
            <Icon name="content" /><span>Content</span>
          </NavLink>

          <div className="km-nav-status">
            {status.red > 0 && (
              <span className="km-chip" style={{ background: 'rgba(239,68,68,.22)', color: '#fecaca' }}>
                <i style={{ background: '#ef4444' }} />{status.red} IP{status.red > 1 ? 's' : ''} critical
              </span>
            )}
            {status.alerts > 0 && (
              <span className="km-chip" style={{ background: 'rgba(245,158,11,.22)', color: '#fde68a' }}>
                <i style={{ background: '#f59e0b' }} />{status.alerts}
              </span>
            )}
            <span className="km-chip" style={{
              background: status.ok ? 'rgba(16,185,129,.22)' : 'rgba(239,68,68,.22)',
              color: status.ok ? '#a7f3d0' : '#fecaca' }}>
              <i style={{ background: status.ok ? '#10b981' : '#ef4444' }} />
              {status.ok === null ? 'Checking…' : status.ok ? 'Bridge up' : 'Bridge down'}
            </span>
          </div>
        </nav>

        <div className="km-nav-sub">
          <span className="km-nav-sub-title">{sub.title}</span>
          {sub.items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end}>
              <Icon name={it.icon} size={15} />{it.label}
            </NavLink>
          ))}
        </div>

        <div className="km-main">
          <Outlet />
        </div>
      </div>
    </>
  );
}
