// ===========================================================================
//  device.js — what browser, what version, what machine, and whether it is a
//  real browser at all.
//
//  Three consumers:
//    • the in-app warning  — Instagram / WhatsApp / Facebook / LinkedIn open
//                            links in a stripped-down WebView where the video
//                            iframes misbehave (no pause, no fullscreen, no
//                            resume). The portal tells the learner so.
//    • the troubleshooter  — shows the learner their own browser + version and
//                            copies it into a report.
//    • the visit log       — track.php stores it per visit, so the admin
//                            Reports screen can answer "which browser, which
//                            version do the playback complaints come from?"
//
//  The user-agent string is parsed synchronously so the answer is available on
//  the first render. Chromium browsers also expose User-Agent Client Hints,
//  which carry the REAL platform version (a Windows 11 machine still says
//  "Windows NT 10.0" in its UA string) and the full browser version; that is
//  fetched once, asynchronously, and merged in.
// ===========================================================================

/* In-app browsers, most specific first. Each is a WebView inside a social or
   messaging app — none of them is a browser a learner chose. */
const IN_APP = [
  ['Instagram', /Instagram/i],
  ['Facebook', /FBAN|FBAV|FB_IAB|FBIOS|FB4A/i],
  ['Messenger', /MessengerForiOS|MessengerLite|Orca-Android/i],
  ['WhatsApp', /WhatsApp/i],
  ['LinkedIn', /LinkedInApp/i],
  ['Snapchat', /Snapchat/i],
  ['Telegram', /Telegram/i],
  ['X (Twitter)', /Twitter(?:Android)?\b/i],
  ['Pinterest', /Pinterest/i],
  ['Line', /\bLine\//i],
  ['WeChat', /MicroMessenger/i],
  ['Gmail', /GSA\/.*Gmail|com\.google\.android\.gm/i],
  ['Google app', /\bGSA\//i],
  ['TikTok', /musical_ly|Bytedance|TikTok/i],
  ['Truecaller', /Truecaller/i],
];

function parseUa(ua) {
  const out = {
    browser: 'Unknown', browserVersion: '', engine: '',
    os: 'Unknown', osVersion: '', device: 'desktop',
  };
  let m;

  /* ── browser — order matters: every Chromium fork also says "Chrome" ── */
  if ((m = ua.match(/Edg(?:e|A|iOS)?\/([\d.]+)/))) { out.browser = 'Edge'; out.browserVersion = m[1]; }
  else if ((m = ua.match(/OPR\/([\d.]+)/)) || (m = ua.match(/Opera\/([\d.]+)/))) { out.browser = 'Opera'; out.browserVersion = m[1]; }
  else if ((m = ua.match(/SamsungBrowser\/([\d.]+)/))) { out.browser = 'Samsung Internet'; out.browserVersion = m[1]; }
  else if ((m = ua.match(/UCBrowser\/([\d.]+)/))) { out.browser = 'UC Browser'; out.browserVersion = m[1]; }
  else if ((m = ua.match(/YaBrowser\/([\d.]+)/))) { out.browser = 'Yandex'; out.browserVersion = m[1]; }
  else if ((m = ua.match(/Vivaldi\/([\d.]+)/))) { out.browser = 'Vivaldi'; out.browserVersion = m[1]; }
  else if ((m = ua.match(/(?:Firefox|FxiOS)\/([\d.]+)/))) { out.browser = 'Firefox'; out.browserVersion = m[1]; }
  else if ((m = ua.match(/CriOS\/([\d.]+)/))) { out.browser = 'Chrome'; out.browserVersion = m[1]; }
  else if ((m = ua.match(/Chrome\/([\d.]+)/))) { out.browser = /; wv\)/.test(ua) ? 'Android WebView' : 'Chrome'; out.browserVersion = m[1]; }
  else if (/Safari\//.test(ua) && (m = ua.match(/Version\/([\d.]+)/))) { out.browser = 'Safari'; out.browserVersion = m[1]; }
  else if (/AppleWebKit/.test(ua) && /Mobile\//.test(ua)) { out.browser = 'iOS WebView'; }

  if (/Gecko\/\d/.test(ua) && /Firefox/.test(ua)) out.engine = 'Gecko';
  else if (/Chrome\/|CriOS|Edg/.test(ua)) out.engine = 'Blink';
  else if (/AppleWebKit/.test(ua)) out.engine = 'WebKit';

  /* ── operating system ── */
  if ((m = ua.match(/Windows NT ([\d.]+)/))) {
    out.os = 'Windows';
    out.osVersion = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' }[m[1]] || m[1];
  } else if ((m = ua.match(/Android ([\d.]+)/))) { out.os = 'Android'; out.osVersion = m[1]; }
  else if ((m = ua.match(/(?:iPhone|iPad|iPod).*?OS ([\d_]+)/))) { out.os = 'iOS'; out.osVersion = m[1].replace(/_/g, '.'); }
  else if ((m = ua.match(/Mac OS X ([\d_.]+)/))) { out.os = 'macOS'; out.osVersion = m[1].replace(/_/g, '.'); }
  else if (/CrOS/.test(ua)) out.os = 'ChromeOS';
  else if (/Linux/.test(ua)) out.os = 'Linux';

  /* ── form factor ── */
  if (/iPad|Tablet|Tab\b/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) out.device = 'tablet';
  else if (/Mobi|iPhone|iPod|Android/.test(ua)) out.device = 'mobile';

  /* iPadOS 13+ claims to be a Mac. A Mac with a touch screen is an iPad. */
  if (out.os === 'macOS' && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1) {
    out.os = 'iPadOS';
    out.device = 'tablet';
  }
  return out;
}

/** Which app's WebView this is, or '' for a real browser. */
function inAppName(ua) {
  for (const [name, re] of IN_APP) if (re.test(ua)) return name;
  /* Android WebView without a named app, and an iOS WebKit view with no
     "Safari/" token — both are somebody's app, we just cannot say whose. */
  if (/; wv\)/.test(ua)) return 'an app';
  if (/(iPhone|iPad|iPod)/.test(ua) && /AppleWebKit/.test(ua) && !/Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)) return 'an app';
  return '';
}

let cached = null;

/** Synchronous best answer, available on the first render. */
export function deviceInfo() {
  if (cached) return cached;
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const ua = String(nav.userAgent || '');
  const parsed = parseUa(ua);
  const scr = typeof screen !== 'undefined' ? screen : {};
  const conn = nav.connection || {};

  cached = {
    ...parsed,
    inApp: inAppName(ua),
    ua,
    model: '',
    language: nav.language || '',
    timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } })(),
    screen: scr.width ? `${scr.width}x${scr.height}` : '',
    viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '',
    dpr: typeof window !== 'undefined' ? Number(window.devicePixelRatio || 1) : 1,
    cores: Number(nav.hardwareConcurrency || 0),
    memory: Number(nav.deviceMemory || 0),          // GB, Chromium only
    network: conn.effectiveType || '',
    downlink: Number(conn.downlink || 0),
    saveData: !!conn.saveData,
    touch: Number(nav.maxTouchPoints || 0) > 0,
    cookies: nav.cookieEnabled !== false,
  };
  return cached;
}

let richPromise = null;

/**
 * The synchronous answer, refined with Client Hints where the browser has
 * them. Never rejects — a browser without the API simply gets the UA parse.
 */
export function deviceInfoRich() {
  if (richPromise) return richPromise;
  const base = deviceInfo();
  const uad = typeof navigator !== 'undefined' ? navigator.userAgentData : null;
  if (!uad?.getHighEntropyValues) {
    richPromise = Promise.resolve(base);
    return richPromise;
  }
  richPromise = uad.getHighEntropyValues(['platformVersion', 'fullVersionList', 'model'])
    .then((hi) => {
      const next = { ...base };
      /* Windows 11 reports platformVersion 13+; 10 reports 1–12. */
      if (base.os === 'Windows' && hi.platformVersion) {
        const major = parseInt(hi.platformVersion, 10);
        next.osVersion = major >= 13 ? '11' : '10';
      } else if (hi.platformVersion && (base.os === 'Android' || base.os === 'macOS')) {
        next.osVersion = hi.platformVersion;
      }
      if (hi.model) next.model = String(hi.model).slice(0, 60);
      /* The brand list carries the exact build — "Google Chrome 140.0.7339.128". */
      const want = { Chrome: /Google Chrome/, Edge: /Microsoft Edge/, Opera: /Opera/ }[base.browser];
      const hit = want && (hi.fullVersionList || []).find((b) => want.test(b.brand));
      if (hit?.version) next.browserVersion = hit.version;
      cached = next;
      return next;
    })
    .catch(() => base);
  return richPromise;
}

/** "Chrome 140 · Windows 11 · desktop" — short enough for a chip. */
export function deviceLabel(d = deviceInfo()) {
  const major = String(d.browserVersion || '').split('.')[0];
  const os = [d.os, d.osVersion].filter(Boolean).join(' ');
  return [
    [d.browser, major].filter(Boolean).join(' '),
    os,
    d.device,
  ].filter(Boolean).join(' · ');
}

/** A plain-text block a learner can paste into a support ticket. */
export function deviceReport(d = deviceInfo()) {
  return [
    `Browser: ${d.browser} ${d.browserVersion}`.trim(),
    `Engine: ${d.engine || '—'}`,
    `System: ${d.os} ${d.osVersion}`.trim(),
    `Device: ${d.device}${d.model ? ` (${d.model})` : ''}`,
    d.inApp ? `Opened inside: ${d.inApp}` : 'Opened inside: a normal browser',
    `Screen: ${d.screen} @${d.dpr}x · window ${d.viewport}`,
    `CPU cores: ${d.cores || '—'} · Memory: ${d.memory ? `${d.memory} GB` : '—'}`,
    `Network: ${d.network || '—'}${d.downlink ? ` (~${d.downlink} Mbps)` : ''}${d.saveData ? ' · data saver on' : ''}`,
    `Language: ${d.language} · Time zone: ${d.timezone}`,
    `User agent: ${d.ua}`,
  ].join('\n');
}

/** The compact object the server stores. */
export function devicePayload(d = deviceInfo()) {
  return {
    browser: d.browser,
    browser_version: d.browserVersion,
    engine: d.engine,
    os: d.os,
    os_version: d.osVersion,
    device: d.device,
    model: d.model,
    in_app: d.inApp,
    screen: d.screen,
    viewport: d.viewport,
    dpr: d.dpr,
    cores: d.cores,
    memory: d.memory,
    network: d.network,
    downlink: d.downlink,
    language: d.language,
    timezone: d.timezone,
    touch: d.touch,
  };
}

/**
 * A link that re-opens this page in the phone's real browser.
 *   Android — an intent: URL hands it to Chrome (or the default browser).
 *   iOS     — there is no programmatic way out of a WebView; the learner has
 *             to use the app's own "Open in Safari" menu, so '' is returned
 *             and the UI shows instructions instead.
 */
export function openInBrowserHref(url = typeof window !== 'undefined' ? window.location.href : '') {
  const d = deviceInfo();
  if (d.os !== 'Android' || !url) return '';
  try {
    const u = new URL(url);
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};end`;
  } catch {
    return '';
  }
}
