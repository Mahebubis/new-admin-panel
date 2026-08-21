// ===========================================================================
//  dashboard.js — where the learner comes from, and goes back to.
//
//  The portal has no sign-in of its own any more. A learner reaches it only
//  through the Skill Lab handoff on dashboard.internshipstudio.com, so both
//  "you are signed out" and "you pressed log out" end at the dashboard's
//  login rather than at a local screen.
//
//  Kept in one file so the URL is stated once. Overridable through
//  VITE_DASHBOARD_URL for local work, where the dashboard runs on a port.
// ===========================================================================

const RAW = (import.meta.env.VITE_DASHBOARD_URL || 'https://dashboard.internshipstudio.com')
  .replace(/\/+$/, '');

export const DASHBOARD_URL = RAW;
export const DASHBOARD_LOGIN_URL = `${RAW}/login`;

/**
 * Leave the SPA for the dashboard's login.
 *
 * `location.replace`, not `assign`: the page being left is one the learner
 * cannot use signed-out, so leaving it in history only gives the back button
 * somewhere useless to land — and on a bounce it would ping-pong.
 *
 * `from` is carried so the dashboard could send them back to the same lesson
 * after signing in. Harmless if it ignores the parameter.
 */
export function goToDashboardLogin(from = '') {
  const url = new URL(DASHBOARD_LOGIN_URL);
  if (from && from !== '/') url.searchParams.set('next', `learn:${from}`);
  window.location.replace(url.toString());
}
