// ===========================================================================
//  PlayerHelp.jsx — "Video not playing?" — the troubleshooter.
//
//  Opened from the wrench on the player, from the chip that appears on a
//  video that is slow or silent, and from the note under the stage.
//
//  In order of how often each one is the answer:
//    1. reload the player in place (keeps the position)
//    2. the portal is open inside an app's WebView — say which, and how out
//    3. an old browser — say which version they have
//    4. an extension wrapping the player (the "Download this video" overlay
//       seen on learners' screenshots is exactly this)
//    5. network, other tabs, hardware acceleration, a private window
//
//  "Report this problem" writes one row to the issue log with the lesson, the
//  player's own state and the full device details, so the admin Reports
//  screen can say which browsers and versions the complaints come from.
// ===========================================================================
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  CheckCircle, Copy, ExternalLink, Globe, Info, Monitor, Refresh, Warning, Wrench,
} from './icons';
import { deviceInfo, deviceInfoRich, deviceLabel, deviceReport, openInBrowserHref } from '../lib/device';
import { standaloneUrl } from '../lib/videoSource';
import './playerHelp.css';

/* The oldest versions the embeds are known to behave on. Older still plays
   most of the time — this is a nudge, not a gate. */
const MIN_MAJOR = { Chrome: 110, Edge: 110, Firefox: 110, Opera: 95, Safari: 15, 'Samsung Internet': 20 };

function browserVerdict(d) {
  if (d.inApp) return { ok: false, text: `Opened inside ${d.inApp} — not a full browser` };
  const min = MIN_MAJOR[d.browser];
  const major = parseInt(d.browserVersion, 10) || 0;
  if (!min) return { ok: false, text: `${d.browser} is not a browser we test on` };
  if (major && major < min) return { ok: false, text: `${d.browser} ${major} is out of date — please update` };
  return { ok: true, text: `${d.browser} ${major || ''} — supported`.trim() };
}

export default function PlayerHelp({ open, onClose, onReload, video, diag, onReport }) {
  const [dev, setDev] = useState(deviceInfo);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState('');        // '' | 'sending' | 'done' | error text
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => { deviceInfoRich().then(setDev); }, []);

  /* A fresh form every time it opens. */
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) { setSent(''); setNote(''); setCopied(false); }
  }

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const verdict = browserVerdict(dev);
  const external = standaloneUrl(video);
  const intent = openInBrowserHref();
  const bridgeOk = diag?.drivable ? diag.connected : null;

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement('textarea');
      t.value = text;
      document.body.appendChild(t);
      t.select();
      try { document.execCommand('copy'); } catch { /* nothing more to try */ }
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const send = async () => {
    setSent('sending');
    try {
      await onReport?.(note.trim());
      setSent('done');
    } catch (e) {
      setSent(e?.message || 'Could not send the report. Please try again.');
    }
  };

  return createPortal(
    <div className="ph" role="dialog" aria-modal="true" aria-labelledby="ph-title" onClick={onClose}>
      <div className="ph-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ph-x" onClick={onClose} aria-label="Close">×</button>

        <div className="ph-head">
          <span className="ph-head-ico"><Wrench size={22} /></span>
          <div>
            <h2 id="ph-title" className="ph-title">Video not playing properly?</h2>
            <p className="ph-sub">Try these in order — the first one fixes most problems.</p>
          </div>
        </div>

        {dev.inApp && (
          <div className="ph-alert">
            <Warning size={20} />
            <div>
              <b>You have opened the portal inside {dev.inApp}.</b>
              <p>
                App browsers cannot pause, resume or go fullscreen reliably, and your progress may not save.
                {intent
                  ? ' Open it in Chrome instead:'
                  : ' Tap the ⋯ or share menu in the app and choose “Open in browser” (or “Open in Safari”).'}
              </p>
              <div className="ph-alert-acts">
                {intent && <a className="ph-btn ph-btn-primary" href={intent}><Globe size={16} /> Open in browser</a>}
                <button type="button" className="ph-btn" onClick={() => copy(window.location.href)}>
                  <Copy size={16} /> {copied ? 'Link copied' : 'Copy link'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="ph-quick">
          <button type="button" className="ph-card" onClick={() => { onReload?.(); onClose(); }}>
            <span className="ph-card-ico"><Refresh size={20} /></span>
            <span className="ph-card-t">Reload the video</span>
            <span className="ph-card-s">Restarts the player where you left off</span>
          </button>
          <button type="button" className="ph-card" onClick={() => window.location.reload()}>
            <span className="ph-card-ico"><Refresh size={20} /></span>
            <span className="ph-card-t">Reload the page</span>
            <span className="ph-card-s">Or press Ctrl + Shift + R for a clean reload</span>
          </button>
          {external && (
            <a className="ph-card" href={external} target="_blank" rel="noreferrer">
              <span className="ph-card-ico"><ExternalLink size={20} /></span>
              <span className="ph-card-t">Open video in a new tab</span>
              <span className="ph-card-s">Plays on its own page — mark it complete here after</span>
            </a>
          )}
        </div>

        <h3 className="ph-h">Check these</h3>
        <ul className="ph-list">
          <li className={verdict.ok ? 'ok' : 'bad'}>
            <span className="ph-dot">{verdict.ok ? <CheckCircle size={18} /> : <Warning size={18} />}</span>
            <div>
              <b>Use an up-to-date browser</b> — Chrome, Edge, Firefox or Safari.
              <em>You are on: {verdict.text}</em>
            </div>
          </li>
          <li className={dev.inApp ? 'bad' : 'ok'}>
            <span className="ph-dot">{dev.inApp ? <Warning size={18} /> : <CheckCircle size={18} />}</span>
            <div>
              <b>Do not open the portal inside an app</b> — Instagram, WhatsApp, Facebook, LinkedIn,
              Telegram or Gmail open links in a limited browser where videos do not pause or play properly.
              Open <b>training.internshipstudio.com</b> directly in your browser.
            </div>
          </li>
          <li>
            <span className="ph-dot"><Info size={18} /></span>
            <div>
              <b>Turn off video-downloader and ad-blocker extensions</b> for this site. Extensions that add
              a “Download this video” button sit on top of the player and stop play / pause from working.
            </div>
          </li>
          {bridgeOk !== null && (
            <li className={bridgeOk ? 'ok' : 'bad'}>
              <span className="ph-dot">{bridgeOk ? <CheckCircle size={18} /> : <Warning size={18} />}</span>
              <div>
                <b>Player connection</b>
                <em>{bridgeOk
                  ? 'Connected — the play, pause and ±10s buttons are working.'
                  : 'The video player is not answering. Reload the video, or try a private window.'}</em>
              </div>
            </li>
          )}
          <li>
            <span className="ph-dot"><Info size={18} /></span>
            <div>
              <b>Check your internet</b> — HD video needs about 3 Mbps.
              {dev.network && <em>Your connection looks like {dev.network.toUpperCase()}{dev.downlink ? ` (~${dev.downlink} Mbps)` : ''}.</em>}
            </div>
          </li>
          <li>
            <span className="ph-dot"><Monitor size={18} /></span>
            <div>
              <b>Laptop getting hot or slow?</b> Close other video tabs, keep it plugged in, and make sure
              <i> hardware acceleration</i> is on (Chrome → Settings → System). Lowering the video quality
              from the ⚙ in the player also helps.
            </div>
          </li>
          <li>
            <span className="ph-dot"><Info size={18} /></span>
            <div>
              <b>Try a private / incognito window</b> — it turns off extensions and old cache, which tells you
              quickly whether one of them is the cause.
            </div>
          </li>
        </ul>

        <div className="ph-device">
          <div className="ph-device-row">
            <span><Monitor size={16} /> {deviceLabel(dev)}{dev.inApp ? ` · in ${dev.inApp}` : ''}</span>
            <span className="ph-device-acts">
              <button type="button" className="ph-link" onClick={() => setShowDetails((s) => !s)}>
                {showDetails ? 'Hide details' : 'Show details'}
              </button>
              <button type="button" className="ph-link" onClick={() => copy(deviceReport(dev))}>
                <Copy size={14} /> {copied ? 'Copied' : 'Copy'}
              </button>
            </span>
          </div>
          {showDetails && <pre className="ph-pre">{deviceReport(dev)}</pre>}
        </div>

        <h3 className="ph-h">Still not working?</h3>
        {sent === 'done' ? (
          <div className="ph-sent">
            <CheckCircle size={20} />
            <div>
              <b>Thanks — reported.</b> Your browser details went with it, so the team can see exactly
              what happened. For a reply, <Link to="/support" onClick={onClose}>open a support ticket</Link>.
            </div>
          </div>
        ) : (
          <div className="ph-report">
            <textarea
              className="ph-input"
              rows={3}
              maxLength={1000}
              placeholder="What happened? e.g. “The video will not pause”, “Stuck on loading”, “No sound”"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="ph-report-acts">
              {sent && sent !== 'sending' && <span className="ph-err">{sent}</span>}
              <Link to="/support" className="ph-btn" onClick={onClose}>Open a support ticket</Link>
              <button type="button" className="ph-btn ph-btn-primary" onClick={send} disabled={sent === 'sending'}>
                {sent === 'sending' ? 'Sending…' : 'Report this problem'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
