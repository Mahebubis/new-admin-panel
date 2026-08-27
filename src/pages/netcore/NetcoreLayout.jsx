import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';

/* ── Netcore sub-layout: top navbar + section sub-navbar + outlet ── */

const SECTIONS = {
  dashboard: { title: 'Dashboards', items: [{ to: '/netcore/behaviour', label: 'Home', icon: 'home' }] },
  users:     { title: 'Audience',   items: [
    { to: '/netcore/contacts',   label: 'All contacts', icon: 'contacts' },
    { to: '/netcore/segments',   label: 'Segments',     icon: 'segments' },
    { to: '/netcore/lists',      label: 'Lists',        icon: 'lists' },
    { to: '/netcore/blocklist',  label: 'Blocklist',    icon: 'blocklist' },
    { to: '/netcore/attributes', label: 'Attributes',   icon: 'attributes' },
  ] },
  /* One Campaigns entry, not one per channel: email and WhatsApp are two ways of sending the
     same thing, and splitting them meant nobody could see what actually went out this week
     without opening both. The merged list carries a Channel column instead. */
  engage:    { title: 'Engage',     items: [
    { to: '/netcore/campaigns',      label: 'Campaigns',          icon: 'mail' },
    { to: '/netcore/whatsapp/inbox', label: 'WhatsApp live chat', icon: 'chat' },
    { to: '/netcore/journeys',       label: 'Journeys',           icon: 'journey' },
    /* The engine queue. Under Engage rather than Settings because it is operational —
       you open it when something has not gone out, which is a sending question rather
       than a configuration one. */
    { to: '/netcore/journeys/outbox', label: 'Outbox',             icon: 'outbox' },
  ] },
  content:   { title: 'Content',    items: [
    { to: '/netcore/templates',          label: 'Email templates',    icon: 'mailTemplate' },
    { to: '/netcore/whatsapp/templates', label: 'WhatsApp templates', icon: 'chatTemplate' },
  ] },
  /*
     Settings had no entry anywhere. Both provider pages existed and were reachable only by
     typing the URL, which is the same as not existing — hence a section of its own rather than
     a gear tucked into another screen's toolbar.

     Both pages now render INSIDE this outlet rather than full-screen, so the sub-nav stays put
     while moving between them. WaSettings was written as a 100vh page and was changed to 100%
     to suit — full height of the outlet, not of the window.
  */
  settings:  { title: 'Settings',   items: [
    { to: '/netcore/settings',          label: 'Email settings',    icon: 'mail' },
    { to: '/netcore/whatsapp/settings', label: 'WhatsApp settings', icon: 'whatsapp' },
    { to: '/netcore/domains',           label: 'Email domains',     icon: 'domain' },
    { to: '/netcore/journeys/dnd',      label: 'Quiet hours',       icon: 'moon' },
  ] },
};

/*
 * Sub-navigation icons.
 *
 * Drawn from one 24-grid at one stroke weight so the row reads as a set rather than as clip art —
 * the point is to be scannable at a glance, and mismatched weights make a row of icons noisier
 * than no icons at all.
 *
 * The two WhatsApp entries are the deliberate exception: the real logo, filled. It is the single
 * most recognisable mark on the page, and a generic speech bubble would throw away exactly the
 * instant recognition these icons exist to provide. Both still take their colour from
 * currentColor, so they highlight with everything else.
 */
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };

const SUB_ICONS = {
  home:       <><path d="M3 10.5 12 3l9 7.5" {...S} /><path d="M5.5 9.5V20h13V9.5" {...S} /><path d="M9.5 20v-5.5h5V20" {...S} /></>,
  contacts:   <><circle cx="9" cy="8" r="3.2" {...S} /><path d="M3 20a6 6 0 0 1 12 0" {...S} /><path d="M16.5 5.4a3.2 3.2 0 0 1 0 5.2M17 14.3A5.2 5.2 0 0 1 21 20" {...S} /></>,
  // A funnel: a segment is a rule that narrows the audience, which is what the shape says.
  segments:   <><path d="M3.5 5h17l-6.6 7.6V20l-3.8-2.2v-5.2z" {...S} /></>,
  lists:      <><path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12" {...S} /><circle cx="4.3" cy="6.5" r="1.3" fill="currentColor" /><circle cx="4.3" cy="12" r="1.3" fill="currentColor" /><circle cx="4.3" cy="17.5" r="1.3" fill="currentColor" /></>,
  blocklist:  <><circle cx="12" cy="12" r="8.4" {...S} /><path d="M6.1 6.1l11.8 11.8" {...S} /></>,
  attributes: <><path d="M11 3.2H4.6a1.4 1.4 0 0 0-1.4 1.4V11a2 2 0 0 0 .6 1.4l7.6 7.6a1.4 1.4 0 0 0 2 0l6.4-6.4a1.4 1.4 0 0 0 0-2l-7.6-7.6A2 2 0 0 0 11 3.2z" {...S} /><circle cx="7.6" cy="7.6" r="1.35" fill="currentColor" /></>,
  // A plain envelope for campaigns; the same envelope with ruled lines for templates, so the two
  // email entries are related at a glance but never mistaken for one another.
  mail:         <><rect x="2.8" y="5" width="18.4" height="14" rx="2.2" {...S} /><path d="m3.4 7 8.6 6 8.6-6" {...S} /></>,
  mailTemplate: <><rect x="2.8" y="4.6" width="18.4" height="14.8" rx="2.2" {...S} /><path d="M2.8 9.2h18.4" {...S} /><path d="M6.6 13h6.4M6.6 16h9.4" {...S} /></>,
  // The WhatsApp logo, filled — see the note above. Live chat gets a bubble with a typing
  // ellipsis, templates a bubble with ruled lines: same family, different job.
  whatsapp:   <><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.48-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.8h-.02a9.8 9.8 0 0 1-4.99-1.37l-.36-.21-3.71.97.99-3.62-.23-.37a9.79 9.79 0 0 1-1.5-5.22c0-5.41 4.4-9.81 9.82-9.81a9.75 9.75 0 0 1 6.94 2.88 9.74 9.74 0 0 1 2.87 6.94c0 5.41-4.4 9.81-9.81 9.81M20.52 3.45A11.66 11.66 0 0 0 12.05 0C5.6 0 .35 5.25.35 11.7c0 2.06.54 4.08 1.56 5.85L.25 24l6.59-1.73a11.66 11.66 0 0 0 5.2 1.24h.01c6.45 0 11.7-5.25 11.7-11.7 0-3.13-1.22-6.07-3.43-8.28" /></>,
  chat:         <><path d="M20.6 15.4a2 2 0 0 1-2 2H8.4l-4 3.2V5.6a2 2 0 0 1 2-2h12.2a2 2 0 0 1 2 2z" {...S} /><path d="M9 10.5h.01M12.3 10.5h.01M15.6 10.5h.01" {...S} strokeWidth={2.6} /></>,
  chatTemplate: <><path d="M20.6 15.4a2 2 0 0 1-2 2H8.4l-4 3.2V5.6a2 2 0 0 1 2-2h12.2a2 2 0 0 1 2 2z" {...S} /><path d="M8 8.4h9M8 12h6" {...S} /></>,
  // A globe with a meridian: a sending domain, not a website page.
  domain:       <><circle cx="12" cy="12" r="8.6" {...S} /><path d="M3.4 12h17.2M12 3.4c2.3 2.4 3.4 5.4 3.4 8.6s-1.1 6.2-3.4 8.6c-2.3-2.4-3.4-5.4-3.4-8.6S9.7 5.8 12 3.4z" {...S} /></>,
  // A crescent, not a clock: this is about the hours we stay quiet, not about scheduling.
  moon:         <><path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a8.6 8.6 0 1 0 10.7 10.7z" {...S} /></>,
  // A branch: a journey is one entry splitting into paths, which is the whole idea of it.
  journey:      <><circle cx="6" cy="5.5" r="2.4" {...S} /><circle cx="6" cy="18.5" r="2.4" {...S} /><circle cx="18" cy="12" r="2.4" {...S} /><path d="M6 7.9v8.2" {...S} /><path d="M8.4 5.9h4.2a3 3 0 0 1 3 3v.9" {...S} /></>,
  // An outbox tray: an envelope in a tray, because that is exactly what this is — messages
  // sitting in a queue waiting to leave, not a clock and not a warning.
  outbox:       <><path d="M3.4 13.2h4.1l1.5 2.6h6l1.5-2.6h4.1" {...S} /><path d="M3.4 13.2 6.2 5.4A2 2 0 0 1 8.1 4h7.8a2 2 0 0 1 1.9 1.4l2.8 7.8v4.4a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2z" {...S} /></>,
};

const SubIcon = ({ name }) => {
  const paths = SUB_ICONS[name];
  if (!paths) return null;
  return <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">{paths}</svg>;
};

function activeSection(p) {
  /* Checked FIRST. /netcore/journeys/dnd and /netcore/whatsapp/settings both begin with a prefix
     that the broader tests below would otherwise claim for Engage. */
  if (p.startsWith('/netcore/settings') || p.startsWith('/netcore/domains')
      || p.startsWith('/netcore/journeys/dnd') || p.startsWith('/netcore/whatsapp/settings')) return 'settings';
  if (p.startsWith('/netcore/contacts') || p.startsWith('/netcore/segments') || p.startsWith('/netcore/lists') || p.startsWith('/netcore/blocklist') || p.startsWith('/netcore/attributes')) return 'users';
  // Checked before the plain /netcore/whatsapp prefix below, so the templates gallery lands in
  // Content alongside its email counterpart rather than under Engage.
  if (p.startsWith('/netcore/whatsapp/templates')) return 'content';
  // if (p.startsWith('/netcore/campaigns') || p.startsWith('/netcore/whatsapp')) return 'engage';
  if (p.startsWith('/netcore/campaigns') || p.startsWith('/netcore/whatsapp') || p.startsWith('/netcore/journeys')) return 'engage'
  if (p.startsWith('/netcore/templates')) return 'content';
  return 'dashboard';
}

/* Top-nav icons. Module scope, not inside the component: a component declared during render
   is a brand-new type on every render, so React unmounts and remounts it each time. */
const Icon = ({ name }) => {
  if (name === 'dashboard')
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
  if (name === 'engage')
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-8-8 18-2-8-8-2z" /></svg>;
  if (name === 'content')
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v5" /></svg>;
  if (name === 'settings')
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
};

export default function NetcoreLayout() {
  const loc = useLocation();
  if (loc.pathname === '/netcore' || loc.pathname === '/netcore/') return <Navigate to="/netcore/behaviour" replace />;
  const current = activeSection(loc.pathname);
  const section = SECTIONS[current];



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
          padding: 0 13px; height: 42px; display: inline-flex; align-items: center; gap: 7px;
          color: #475569; font-size: 12.5px; font-weight: 500; text-decoration: none;
          border-bottom: 2px solid transparent; box-sizing: border-box;
        }
        /* The icon sits back a shade from the label so the row scans as words with markers
           beside them, not as a strip of icons competing with the text. It closes that gap on
           hover and on the active tab, which is what makes the current section obvious. */
        .nc-nav-sub a svg { flex-shrink: 0; opacity: .62; transition: opacity .15s; }
        .nc-nav-sub a:hover { color: #1e3a8a; }
        .nc-nav-sub a:hover svg { opacity: .9; }
        .nc-nav-sub a.active { color: #1e3a8a; font-weight: 600; border-bottom-color: #1e3a8a; }
        .nc-nav-sub a.active svg { opacity: 1; }

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
          {/* This row is hardcoded rather than generated from SECTIONS, which is why adding a
              settings section alone left it invisible — the pages existed and nothing linked to
              them, which is the same as not existing. */}
          <NavLink to="/netcore/settings" className={current === 'settings' ? 'active' : ''}>
            <Icon name="settings" /><span>Settings</span>
          </NavLink>
        </nav>

        <nav className="nc-nav-sub">
          <span className="nc-nav-sub-title">{section.title}</span>
          {/* `end` on every item: without it "/netcore/whatsapp" would also light up while
              you're on "/netcore/whatsapp/templates". */}
          {section.items.map(it => (
            <NavLink key={it.to} to={it.to} end>
              <SubIcon name={it.icon} /><span>{it.label}</span>
            </NavLink>
          ))}
        </nav>

        <main className="nc-main"><Outlet /></main>
      </div>
    </>
  );
}
