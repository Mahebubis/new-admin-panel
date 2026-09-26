// ===========================================================================
//  InAppNotice.jsx — the red bar across the top of every page when the portal
//  has been opened inside an app (Instagram, WhatsApp, Facebook, LinkedIn…).
//
//  Those WebViews are where "the video will not pause" and "my progress
//  vanished" come from, and the learner has no way of knowing they are not in
//  a real browser. Dismissable for the session; it comes back on a fresh
//  visit, because the problem does too.
// ===========================================================================
import { useState } from 'react';
import { Warning } from './icons';
import { deviceInfo, openInBrowserHref } from '../lib/device';
import './playerHelp.css';

const KEY = 'istudio_inapp_dismissed';

export default function InAppNotice() {
  const app = deviceInfo().inApp;
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
  });
  const [copied, setCopied] = useState(false);

  if (!app || hidden) return null;

  const intent = openInBrowserHref();
  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); } catch { /* shown below */ }
  };
  const dismiss = () => {
    try { sessionStorage.setItem(KEY, '1'); } catch { /* private mode */ }
    setHidden(true);
  };

  return (
    <div className="inapp" role="alert">
      <Warning size={20} />
      <div className="inapp-text">
        <b>You are inside {app}, not a browser.</b> Videos may not play, pause or save your progress here.
        {' '}
        {intent
          ? 'Open the portal in Chrome for the full experience.'
          : 'Use the app’s ⋯ menu → “Open in browser” (or “Open in Safari”).'}
      </div>
      <div className="inapp-acts">
        {intent && <a className="inapp-btn" href={intent}>Open in browser</a>}
        <button type="button" className="inapp-btn ghost" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
      </div>
      <button type="button" className="inapp-x" onClick={dismiss} aria-label="Dismiss">×</button>
    </div>
  );
}
