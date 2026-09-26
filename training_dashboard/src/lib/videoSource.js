// ===========================================================================
//  videoSource.js — the last word on what kind of player a lesson gets.
//
//  catalog.php's learn_video_source() already classifies every stored URL.
//  This is the client's copy of the one rule that matters most, so a lesson
//  still plays properly against a backend that has not been redeployed:
//
//    https://player.mediadelivery.net/play/LIB/GUID
//
//  is Bunny's SHARE PAGE, not its player. It is a whole HTML document whose
//  only content is a second iframe — /embed/LIB/GUID?autoplay=true — so
//  loading it in our stage nests two documents, forces autoplay, and puts the
//  real player one frame further away than postMessage can reach. The result
//  was ~450 lessons with no working pause from our controls, no progress, no
//  resume, and no end-of-lesson completion. Rewritten to the embed itself, it
//  is an ordinary Bunny lesson again.
// ===========================================================================

const BUNNY = /^https?:\/\/(?:player|iframe)\.mediadelivery\.net\/(?:play|embed)\/(\d+)\/([0-9a-f-]{16,})/i;

/** The Bunny library + video id pair, or null. */
export function bunnyIds(url = '') {
  const m = String(url).match(BUNNY);
  return m ? { lib: m[1], id: m[2] } : null;
}

/**
 * The lesson's video with every Bunny URL pointed at the embeddable player.
 * Returns the SAME object when nothing needs changing, so memoised consumers
 * do not see a new identity on every render.
 */
export function normalizeVideo(video) {
  if (!video || !video.kind) return video;
  if (video.kind === 'vimeo') return withVimeoHash(video);
  const url = video.embed || video.src || '';
  const ids = bunnyIds(url);
  if (!ids) return video;

  /* Already the canonical embed, already typed as bunny: nothing to do. */
  const canonical = `https://iframe.mediadelivery.net/embed/${ids.lib}/${ids.id}`;
  if (video.kind === 'bunny' && String(video.embed || '').startsWith(canonical)) return video;

  return {
    ...video,
    kind: 'bunny',
    embed: `${canonical}?autoplay=false&preload=true`,
  };
}

/**
 * An UNLISTED Vimeo video only plays with its privacy hash — without it the
 * player answers 401 and the learner sees "Sorry, this video does not exist".
 * Admins paste Vimeo's own embed code, which carries the hash as ?h=… (and
 * HTML-escaped, as &amp;h=…); the backend used to read it only from the
 * /ID/HASH link form, so those lessons went out without it.
 */
function withVimeoHash(video) {
  const embed = String(video.embed || '');
  if (/[?&]h=[0-9a-z]+/i.test(embed)) return video;
  const src = String(video.src || '').replace(/&amp;/g, '&');
  const m = src.match(/[?&]h=([0-9a-z]+)/i) || src.match(/vimeo\.com\/(?:video\/)?\d+\/([0-9a-z]{6,})/i);
  if (!m || !embed) return video;
  return { ...video, embed: `${embed}${embed.includes('?') ? '&' : '?'}h=${m[1]}` };
}

/** Where "Open the video in a new tab" should go for each kind. */
export function standaloneUrl(video) {
  if (!video) return '';
  const ids = bunnyIds(video.embed || video.src);
  if (ids) return `https://iframe.mediadelivery.net/play/${ids.lib}/${ids.id}`;
  if (video.kind === 'vimeo') {
    const m = String(video.embed || video.src).match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    return m ? `https://vimeo.com/${m[1]}` : video.src;
  }
  if (video.kind === 'youtube') {
    const m = String(video.embed || video.src).match(/(?:embed\/|v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    return m ? `https://www.youtube.com/watch?v=${m[1]}` : video.src;
  }
  return video.src || video.embed || '';
}
