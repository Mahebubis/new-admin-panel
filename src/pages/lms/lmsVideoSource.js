// ===========================================================================
//  lmsVideoSource.js — what kind of video URL is this?
//
//  Mirrors learn_video_source() in the learner portal's catalog.php, so the
//  preview an admin sees in the lesson editor is the player a learner will
//  actually get. Keep the two in step: if one learns a new provider, so must
//  the other.
// ===========================================================================

/**
 * Is this a full URL pointing at some OTHER site?
 *
 * Anything that isn't gets no <iframe>. A relative path — or a stray value
 * like "null" or an empty string — resolves against the admin panel’s own
 * address, so the preview would load THIS app inside itself: the sidebar,
 * the topbar and the whole control panel, rendered inside the video box.
 */
function isForeignHttpUrl(u) {
  if (typeof window === 'undefined') return /^https?:\/\//i.test(u);
  try {
    const parsed = new URL(u, window.location.href);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return parsed.origin !== window.location.origin;
  } catch {
    return false;
  }
}

export function detectVideo(url = '') {
  const u = String(url).trim();
  if (!u) return { kind: 'none', embed: '' };

  let m = u.match(/(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/i);
  if (m) {
    /* Unlisted Vimeo links carry a hash after the id: vimeo.com/ID/HASH */
    const hash = u.match(/vimeo\.com\/(?:video\/)?\d+\/([0-9a-z]+)/i);
    return {
      kind: 'vimeo',
      embed: `https://player.vimeo.com/video/${m[1]}?title=0&byline=0&portrait=0&dnt=1${hash ? `&h=${hash[1]}` : ''}`,
    };
  }

  m = u.match(/iframe\.mediadelivery\.net\/(?:embed|play)\/(\d+)\/([0-9a-f-]+)/i);
  if (m) return { kind: 'bunny', embed: `https://iframe.mediadelivery.net/embed/${m[1]}/${m[2]}?preload=true` };

  m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/i);
  if (m) return { kind: 'youtube', embed: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0` };

  if (/\.m3u8(\?|$)/i.test(u)) return { kind: 'hls', embed: '' };
  if (/\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(u) || /amazonaws\.com\//i.test(u)) {
    return { kind: 'file', embed: '' };
  }

  /* Everything left over is only safe to drop into an <iframe> if it lives on
     another site — see isForeignHttpUrl above for what happens otherwise.
     'unknown' means "the link is kept, we just won't pretend to play it". */
  if (!isForeignHttpUrl(u)) return { kind: 'unknown', embed: '' };
  return { kind: 'iframe', embed: u };
}

/**
 * People paste the whole `<iframe …>` snippet far more often than a bare src,
 * so pull the URL out rather than making them edit it by hand.
 */
export function unwrapIframe(value) {
  const m = String(value).match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  return m ? m[1] : value;
}
