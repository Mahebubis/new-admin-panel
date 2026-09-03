// ===========================================================================
//  sidebarBus.js — keeps the admin panel's LEFT sidebar and a section's own
//  RIGHT rail mutually exclusive. Sections with a rail: LMS, Freshdesk.
//
//  Those screens are wide (course tables, the lesson editor, ticket lists and
//  reports), so only one of the two navigations may be expanded at a time:
//  opening one announces itself on this bus and the other one folds away. The
//  listeners live at different route levels (AdminLayout wraps <Outlet/>, the
//  section pages render inside it), so a plain module-level emitter is simpler
//  — and much less invasive — than threading a context through the layout tree.
// ===========================================================================

const listeners = new Set();

/** Broadcast which navigation just expanded: 'admin' | 'lms' | 'freshdesk'. */
export function announceExpanded(which) {
  listeners.forEach(fn => { try { fn(which); } catch { /* never break the UI */ } });
}

/** Subscribe; returns the unsubscribe function (use it in useEffect cleanup). */
export function onExpanded(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* Persisted preference for the LMS rail (the admin sidebar already stores its
   own under `sidebarCollapsed`). */
export const LMS_RAIL_KEY = 'lmsRailOpen';
export const readRailOpen = () => localStorage.getItem(LMS_RAIL_KEY) !== '0';
export const writeRailOpen = (open) => localStorage.setItem(LMS_RAIL_KEY, open ? '1' : '0');
