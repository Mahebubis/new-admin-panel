// ===========================================================================
//  VideoPlayer.jsx — one component, four kinds of video.
//
//  Admins add lessons from whatever source they have, so the player must cope
//  with all of them without the learner ever seeing the difference:
//
//    file    a direct MP4/WebM — typically the S3 uploads lms_api.php makes
//    hls     an .m3u8 ladder (Bunny's CDN pull zone, or any HLS origin)
//    vimeo   the Vimeo iframe embed
//    bunny   the Bunny Stream iframe embed (iframe.mediadelivery.net)
//    youtube the privacy-preserving YouTube embed
//
//  The backend decides which of those a stored URL is (see learn_video_source()
//  in catalog.php) so the sniffing lives in exactly one place.
//
//  Controls
//    `file` and `hls` play in a real <video> with OUR control bar rather than
//    the browser's. That is not decoration: the browser's bar brought its own
//    fullscreen button, which sat directly under the stage's one and read as
//    two fullscreen buttons fighting over the same corner. One bar means one
//    fullscreen button, and it makes room for the two controls a lecture
//    actually needs — back five seconds and forward five seconds, for the
//    sentence you did not quite catch.
//
//    Fullscreen belongs to the player wrapper, so the bar stays over the video
//    inside it. On a phone, entering fullscreen also asks the screen to turn
//    landscape (the Screen Orientation API) — a 16:9 lecture in a portrait
//    letterbox is a third of the pixels it should be. Browsers that refuse the
//    lock simply keep the fullscreen; iOS Safari has no element fullscreen
//    worth using here, so it gets the video element's own native one, which
//    rotates by itself anyway.
//
//  Playback position
//    Position and completion come straight off the element for the two native
//    kinds. The iframe embeds are cross-origin, so we speak their postMessage
//    protocols instead — Vimeo and Bunny both implement the player.js shape,
//    which is why one bridge covers both. YouTube's iframe API needs their
//    loader script, so YouTube lessons report no position; they still complete
//    from the player's own "Mark as complete".
//
//  What gets reported, and why it is three numbers
//    onProgress({ seconds, duration, watched }) — the player owns the
//    throttling, because it is the only thing that knows the difference
//    between time passing and time WATCHED:
//
//      seconds   where the playhead is now → what Resume seeks back to
//      duration  the real length of the video, measured rather than typed in
//                by an admin (lms_lessons.duration_secs is usually 0)
//      watched   seconds genuinely played since the last report, summed from
//                the gaps between timeupdate ticks. A scrub from 0:10 to 9:50
//                produces one big gap, which is rejected — so this cannot be
//                inflated by dragging the scrubber, and neither can the two
//                skip buttons.
//
//    A report goes out every ten watched seconds, and immediately on pause, on
//    the tab being hidden, and when the lesson changes or the page goes away —
//    the last of those is what stops a learner losing their place by simply
//    closing the tab.
//
//  Loading
//    Nothing is ever shown as a blank black box: a spinner sits over the stage
//    until the source actually reports itself ready, and a failed source gets a
//    real message with a retry rather than silence.
// ===========================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { Back5, Compress, Expand, Fwd5, Pause, Play, Volume, VolumeX } from './icons';
import './video.css';

/* hls.js is only pulled in when an .m3u8 actually needs it — Safari and iOS
   play HLS natively, so most sessions never download it at all. */
async function loadHls() {
  const mod = await import('hls.js');
  return mod.default ?? mod;
}

const IFRAME_KINDS = new Set(['vimeo', 'bunny', 'youtube', 'iframe']);

/* Report every ten seconds of real watching. Small enough that a crash costs
   the learner nothing they would notice, large enough that a 40-minute lesson
   is ~240 writes rather than ten thousand. */
const REPORT_EVERY = 10;

/* A gap larger than this between two timeupdate ticks is a seek, a stall or a
   backgrounded tab — never someone watching. 2s covers 4x playback speed. */
const MAX_TICK_GAP = 2.5;

/* How far the two skip buttons jump. Named because the arrow keys use it too,
   and because it is the number printed on the icons. */
const SKIP = 5;

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

/* mm:ss, or h:mm:ss once there is an hour to show. */
function clock(secs) {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (v) => String(v).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

const isTouchScreen = () =>
  typeof window !== 'undefined'
  && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);

export default function VideoPlayer({
  video,              // { kind, src, embed } from the API
  poster,
  startAt = 0,        // seconds to resume from
  onProgress,         // ({seconds, duration, watched}) — already throttled here
  onEnded,
  title,
}) {
  const kind = video?.kind || 'none';
  const native = kind === 'file' || kind === 'hls';
  const [state, setState] = useState('loading');   // loading | ready | error
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const frameRef = useRef(null);
  const hlsRef = useRef(null);
  const seeded = useRef(false);

  /* Everything the control bar draws. None of it is authoritative — the
     <video> element is — these are only the latest readings of it. */
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [len, setLen] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [rateOpen, setRateOpen] = useState(false);
  const [fs, setFs] = useState(false);
  const [uiOn, setUiOn] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [nudge, setNudge] = useState('');      // the "+5s" / "−5s" flash
  const [resumed, setResumed] = useState(0);   // "Resumed from 6:02", briefly

  /* The watch bookkeeping. `accum` is unsent watched seconds, `tick` the
     previous playhead reading, `pos`/`dur` the last known position and length
     — kept in refs so the flush paths can read them without a re-render. */
  const accum = useRef(0);
  const tick = useRef(null);
  const pos = useRef(0);
  const dur = useRef(0);
  const sentPos = useRef(-1);

  /* A new lesson is a new everything. Reset during render so the spinner is up
     on the very first paint of the new source, instead of flashing the previous
     lesson's finished frame for one tick. */
  const sourceKey = `${kind}|${video?.src || ''}|${video?.embed || ''}`;
  const [seenKey, setSeenKey] = useState(sourceKey);
  if (seenKey !== sourceKey) {
    setSeenKey(sourceKey);
    setState(kind === 'none' ? 'error' : 'loading');
    setPlaying(false);
    setCur(0);
    setLen(0);
    setBuffered(0);
    setRateOpen(false);
    setUiOn(true);
    setResumed(0);
  }

  /* The bookkeeping refs belong to the source, not to the render, so they are
     cleared in an effect — refs must not be written during render. */
  useEffect(() => {
    seeded.current = false;
    accum.current = 0;
    tick.current = null;
    pos.current = 0;
    dur.current = 0;
    sentPos.current = -1;
  }, [sourceKey]);

  /** Hand the accumulated watching to the caller. `force` also sends a report
      that carries no new watched time — used when the lesson is closing and
      the position alone is still worth saving. */
  const flush = useCallback((force = false) => {
    const add = Math.floor(accum.current);
    if (!force && add < REPORT_EVERY) return;

    const seconds = Math.max(0, Math.floor(pos.current || 0));
    if (add <= 0 && seconds === sentPos.current) return;   // nothing new to say

    accum.current -= add;                                  // keep the remainder
    sentPos.current = seconds;

    const duration = Number.isFinite(dur.current) ? Math.floor(dur.current) : 0;
    onProgress?.({ seconds, duration: duration > 0 ? duration : 0, watched: add });
  }, [onProgress]);

  /** One playhead reading, wherever it came from. */
  const advance = useCallback((seconds, duration) => {
    const t = Number(seconds);
    if (!Number.isFinite(t) || t < 0) return;

    if (Number.isFinite(duration) && duration > 0) dur.current = duration;

    const prev = tick.current;
    if (prev !== null) {
      const gap = t - prev;
      /* Forward, and by a plausible amount: that is watching. Anything else is
         a seek or a stall and adds nothing to the watched total. */
      if (gap > 0 && gap <= MAX_TICK_GAP) accum.current += gap;
    }
    tick.current = t;
    pos.current = t;

    flush(false);
  }, [flush]);

  /* Pause, tab-hidden and unmount are the three moments a learner's position
     is most likely to be lost, so all three flush immediately. The cleanup
     closes over THIS lesson's onProgress, which is what makes a lesson switch
     save against the lesson being left rather than the one being opened. */
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush(true); };
    const onLeave = () => flush(true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onLeave);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onLeave);
      flush(true);
    };
  }, [flush, sourceKey]);

  /* ── the control bar comes and goes ──────────────────────────────────────
     Visible while paused, while the pointer is moving, and for a moment after;
     hidden once a playing video is being left alone, so nothing sits over the
     picture. The speed menu pins it open — a menu that vanished mid-choice
     would be unusable. */
  const hideAt = useRef(null);
  /* The hide timer fires long after the render that opened the speed menu, so
     it reads the menu's state through a ref rather than closing over it. */
  const keepOpen = useRef(false);
  useEffect(() => { keepOpen.current = rateOpen; }, [rateOpen]);

  const bumpUi = useCallback(() => {
    setUiOn(true);
    clearTimeout(hideAt.current);
    hideAt.current = setTimeout(() => {
      const el = videoRef.current;
      if (el && !el.paused && !keepOpen.current) setUiOn(false);
    }, 2800);
  }, []);

  useEffect(() => () => clearTimeout(hideAt.current), []);

  /* ── native <video>: MP4/WebM directly, .m3u8 through hls.js ─────────── */
  useEffect(() => {
    if (!native) return;
    const el = videoRef.current;
    if (!el || !video?.src) return;

    let cancelled = false;
    let hls = null;

    const attach = async () => {
      if (kind === 'file') { el.src = video.src; return; }

      /* Safari/iOS ship HLS in the element; everyone else needs hls.js. */
      if (el.canPlayType('application/vnd.apple.mpegurl')) { el.src = video.src; return; }

      try {
        const Hls = await loadHls();
        if (cancelled) return;
        if (!Hls.isSupported()) { setState('error'); return; }
        hls = new Hls({ enableWorker: true, lowLatencyMode: false });
        hlsRef.current = hls;
        hls.loadSource(video.src);
        hls.attachMedia(el);
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data?.fatal && !cancelled) setState('error');
        });
      } catch {
        if (!cancelled) setState('error');
      }
    };
    attach();

    return () => {
      cancelled = true;
      if (hls) { hls.destroy(); hlsRef.current = null; }
      el.removeAttribute('src');
      el.load();
    };
  }, [native, kind, video?.src]);

  /* ── the player.js bridge Vimeo and Bunny both speak ─────────────────── */
  useEffect(() => {
    if (kind !== 'vimeo' && kind !== 'bunny') return;

    const frame = frameRef.current;
    if (!frame) return;

    const post = (payload) => {
      try { frame.contentWindow?.postMessage(JSON.stringify(payload), '*'); } catch { /* not ready yet */ }
    };

    const subscribe = () => {
      post({ method: 'addEventListener', value: 'ready' });
      post({ method: 'addEventListener', value: 'timeupdate' });
      post({ method: 'addEventListener', value: 'ended' });
      post({ method: 'addEventListener', value: 'play' });
      post({ method: 'addEventListener', value: 'pause' });
      /* Neither embed volunteers the length, and without it there is no
         percentage and no auto-complete. */
      post({ method: 'getDuration' });
    };

    const onMessage = (e) => {
      /* Only the two embed hosts are trusted; anything else on the page that
         posts a message is ignored outright. */
      if (!/(^https:\/\/player\.vimeo\.com)|(^https:\/\/iframe\.mediadelivery\.net)/.test(e.origin)) return;

      let data = e.data;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return; } }
      if (!data || typeof data !== 'object') return;

      const evt = data.event || data.method;

      if (evt === 'getDuration') {
        const d = Number(data.value ?? data.data);
        if (Number.isFinite(d) && d > 0) dur.current = d;
        return;
      }
      if (evt === 'ready') {
        setState('ready');
        subscribe();
        if (!seeded.current && startAt > 5) {
          seeded.current = true;
          post({ method: 'setCurrentTime', value: startAt });
        }
        return;
      }
      if (evt === 'play') setState('ready');
      if (evt === 'pause') { flush(true); return; }
      if (evt === 'timeupdate') {
        const secs = data.data?.seconds ?? data.data?.currentTime ?? data.seconds;
        const length = data.data?.duration ?? data.duration;
        if (typeof secs === 'number') advance(secs, Number(length));
        return;
      }
      if (evt === 'ended' || evt === 'finish') { flush(true); onEnded?.(); }
    };

    window.addEventListener('message', onMessage);
    /* Some builds are listening before they announce themselves, so nudge once
       on load as well as waiting for the ready event. */
    const t = setTimeout(subscribe, 800);
    return () => { window.removeEventListener('message', onMessage); clearTimeout(t); };
  }, [kind, video?.embed, startAt, advance, flush, onEnded]);

  /* ── fullscreen, and the phone turning with it ───────────────────────── */
  useEffect(() => {
    const sync = () => {
      const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setFs(on);
      /* Leaving fullscreen must hand the rotation back, or the rest of the
         portal is stuck sideways for the rest of the session. */
      if (!on) { try { window.screen?.orientation?.unlock?.(); } catch { /* unsupported */ } }
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const box = wrapRef.current;
    const el = videoRef.current;
    bumpUi();

    if (document.fullscreenElement || document.webkitFullscreenElement) {
      try { window.screen?.orientation?.unlock?.(); } catch { /* unsupported */ }
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      return;
    }

    /* iOS Safari has no element fullscreen worth using: the video element's
       own one is the only thing that fills the screen there, and it rotates on
       its own. Everywhere else the WRAPPER goes fullscreen, so our bar — and
       with it the two skip buttons — stays over the picture. */
    if (box?.requestFullscreen) {
      try { await box.requestFullscreen({ navigationUI: 'hide' }); }
      catch { try { await box.requestFullscreen(); } catch { /* refused */ } }
    } else if (box?.webkitRequestFullscreen) {
      box.webkitRequestFullscreen();
    } else if (el?.webkitEnterFullscreen) {
      el.webkitEnterFullscreen();
      return;
    }

    /* A phone held upright shows a 16:9 lecture at a third of the pixels it
       could. Ask for landscape; desktops and iOS refuse, which is harmless. */
    if (isTouchScreen()) {
      try { await window.screen?.orientation?.lock?.('landscape'); } catch { /* refused */ }
    }
  }, [bumpUi]);

  /* ── the controls themselves ─────────────────────────────────────────── */
  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {/* autoplay policy */});
    else el.pause();
    bumpUi();
  }, [bumpUi]);

  const flashAt = useRef(null);
  const seekBy = useCallback((delta) => {
    const el = videoRef.current;
    if (!el) return;
    const end = Number.isFinite(el.duration) && el.duration > 0 ? el.duration - 0.25 : Infinity;
    el.currentTime = Math.max(0, Math.min(end, el.currentTime + delta));
    setCur(el.currentTime);
    setNudge(delta > 0 ? `+${delta}s` : `−${Math.abs(delta)}s`);
    clearTimeout(flashAt.current);
    flashAt.current = setTimeout(() => setNudge(''), 600);
    bumpUi();
  }, [bumpUi]);

  useEffect(() => () => clearTimeout(flashAt.current), []);

  const seekTo = (secs) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = secs;
    setCur(secs);
    bumpUi();
  };

  const setVolume = (v) => {
    const el = videoRef.current;
    if (!el) return;
    el.volume = v;
    el.muted = v === 0;
    bumpUi();
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    if (!el.muted && el.volume === 0) el.volume = 0.6;
    bumpUi();
  };

  const pickRate = (r) => {
    const el = videoRef.current;
    if (el) el.playbackRate = r;
    setRate(r);
    setRateOpen(false);
    bumpUi();
  };

  /* Every shortcut a learner reaches for on a lecture: space to stop, arrows
     to go back over the line they missed, f for fullscreen, m for mute. */
  const onKeyDown = (e) => {
    if (!native) return;
    /* The two sliders own every key while they have focus, and a focused
       button already answers space with its own click — pressing space on the
       pause button must not also toggle play a second time. */
    if (e.target instanceof HTMLInputElement) return;
    if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return;
    const hit = (fn) => { e.preventDefault(); fn(); };
    switch (e.key) {
      case ' ': case 'k':            return hit(togglePlay);
      case 'ArrowLeft': case 'j':    return hit(() => seekBy(-SKIP));
      case 'ArrowRight': case 'l':   return hit(() => seekBy(SKIP));
      case 'f':                      return hit(toggleFullscreen);
      case 'm':                      return hit(toggleMute);
      case 'ArrowUp':                return hit(() => setVolume(Math.min(1, vol + 0.1)));
      case 'ArrowDown':              return hit(() => setVolume(Math.max(0, vol - 0.1)));
      default:                       return undefined;
    }
  };

  /* ── nothing to play ─────────────────────────────────────────────────── */
  if (kind === 'none') {
    return (
      <div className="vp vp-empty">
        <p>This lesson has no video attached yet.</p>
      </div>
    );
  }

  const retry = () => {
    setState('loading');
    if (frameRef.current) frameRef.current.src = frameRef.current.src;   // eslint-disable-line no-self-assign
    if (videoRef.current) videoRef.current.load();
  };

  const pct = len > 0 ? (cur / len) * 100 : 0;
  const bufPct = len > 0 ? Math.min(100, (buffered / len) * 100) : 0;

  return (
    <div
      ref={wrapRef}
      className={[
        'vp', `vp-${kind}`,
        native ? 'vp-native' : '',
        fs ? 'vp-fs' : '',
        native && !uiOn ? 'vp-idle' : '',
      ].filter(Boolean).join(' ')}
      onPointerMove={native ? bumpUi : undefined}
      onPointerLeave={native ? () => { if (playing && !rateOpen) setUiOn(false); } : undefined}
      onKeyDown={native ? onKeyDown : undefined}
      tabIndex={native ? 0 : undefined}
    >
      {title && <div className="vp-title">{title}</div>}

      {IFRAME_KINDS.has(kind) ? (
        <iframe
          ref={frameRef}
          className="vp-frame"
          src={video.embed || video.src}
          title={title || 'Lesson video'}
          loading="eager"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          onLoad={() => setState('ready')}
          onError={() => setState('error')}
        />
      ) : (
        <video
          ref={videoRef}
          className="vp-video"
          poster={poster || undefined}
          playsInline
          preload="metadata"
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => {
            /* On a phone the first tap means "show me the controls" — playing
               or pausing on a stray touch is the classic way to lose a place. */
            if (isTouchScreen() && !uiOn) { bumpUi(); return; }
            togglePlay();
          }}
          onDoubleClick={() => { if (!isTouchScreen()) toggleFullscreen(); }}
          onLoadedMetadata={(e) => {
            setState('ready');
            const el = e.currentTarget;
            if (Number.isFinite(el.duration) && el.duration > 0) {
              dur.current = el.duration;
              setLen(el.duration);
            }
            setVol(el.volume);
            setMuted(el.muted);
            /* Resume where they stopped, but never within the last 15 seconds —
               dropping someone straight onto the end credits is worse than
               restarting the tail. */
            if (!seeded.current && startAt > 5 && startAt < el.duration - 15) {
              seeded.current = true;
              el.currentTime = startAt;
              tick.current = startAt;
              pos.current = startAt;
              setCur(startAt);
              /* Say so, briefly. A video that opens three minutes in with no
                 explanation reads as a bug rather than as a courtesy. */
              setResumed(startAt);
              setTimeout(() => setResumed(0), 4200);
            }
          }}
          onCanPlay={() => { setState('ready'); setWaiting(false); }}
          onWaiting={() => setWaiting(true)}
          onPlaying={() => { setWaiting(false); setPlaying(true); }}
          onPlay={() => { setPlaying(true); bumpUi(); }}
          onDurationChange={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) { dur.current = d; setLen(d); }
          }}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            setCur(el.currentTime);
            try {
              const b = el.buffered;
              if (b.length) setBuffered(b.end(b.length - 1));
            } catch { /* nothing buffered yet */ }
            advance(el.currentTime, el.duration);
          }}
          /* A seek breaks the tick chain: without this the jump would be
             measured against the pre-seek reading on the next tick. */
          onSeeking={(e) => { tick.current = e.currentTarget.currentTime; }}
          onVolumeChange={(e) => { setVol(e.currentTarget.volume); setMuted(e.currentTarget.muted); }}
          onRateChange={(e) => setRate(e.currentTarget.playbackRate)}
          onPause={() => { setPlaying(false); setUiOn(true); flush(true); }}
          onEnded={(e) => {
            pos.current = e.currentTarget.currentTime;
            setPlaying(false);
            setUiOn(true);
            flush(true);
            onEnded?.();
          }}
          onError={() => setState('error')}
        />
      )}

      {/* ── our one control bar ──────────────────────────────────────────
          Only once the source is really playable: a bar reading 0:00 / 0:00
          over a spinner is furniture, not a control. */}
      {native && state === 'ready' && (
        <>
          {!playing && (
            <button type="button" className="vp-big" onClick={togglePlay} aria-label="Play">
              <Play size={34} fill="currentColor" stroke="none" />
            </button>
          )}

          {nudge && <div className="vp-nudge" aria-hidden="true">{nudge}</div>}

          {resumed > 0 && (
            <div className="vp-resumed" role="status">Resumed from {clock(resumed)}</div>
          )}

          <div className="vp-ctl">
            <div className="vp-seek">
              <div className="vp-seek-track">
                <i className="vp-seek-buf" style={{ width: `${bufPct}%` }} />
                <i className="vp-seek-fill" style={{ width: `${pct}%` }} />
                <i className="vp-seek-knob" style={{ left: `${pct}%` }} />
              </div>
              <input
                type="range"
                className="vp-seek-input"
                min={0}
                max={len || 0}
                step="any"
                value={Math.min(cur, len || 0)}
                onChange={(e) => seekTo(Number(e.target.value))}
                aria-label="Seek"
                aria-valuetext={`${clock(cur)} of ${clock(len)}`}
              />
            </div>

            <div className="vp-row">
              <button type="button" className="vp-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
                {playing ? <Pause size={21} /> : <Play size={21} fill="currentColor" stroke="none" />}
              </button>

              <button
                type="button"
                className="vp-btn"
                onClick={() => seekBy(-SKIP)}
                aria-label="Back 5 seconds"
                title="Back 5 seconds"
              >
                <Back5 size={21} />
              </button>
              <button
                type="button"
                className="vp-btn"
                onClick={() => seekBy(SKIP)}
                aria-label="Forward 5 seconds"
                title="Forward 5 seconds"
              >
                <Fwd5 size={21} />
              </button>

              <span className="vp-time">{clock(cur)} <em>/</em> {clock(len)}</span>

              <span className="vp-gap" />

              <div className="vp-vol">
                <button type="button" className="vp-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
                  {muted || vol === 0 ? <VolumeX size={20} /> : <Volume size={20} />}
                </button>
                <input
                  type="range"
                  className="vp-vol-input"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : vol}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  aria-label="Volume"
                />
              </div>

              <div className="vp-rate-wrap">
                <button
                  type="button"
                  className="vp-btn vp-rate-btn"
                  onClick={() => { setRateOpen((o) => !o); bumpUi(); }}
                  aria-haspopup="menu"
                  aria-expanded={rateOpen}
                  aria-label="Playback speed"
                >
                  {rate}x
                </button>
                {rateOpen && (
                  <div className="vp-rate" role="menu">
                    {SPEEDS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        role="menuitemradio"
                        aria-checked={r === rate}
                        className={r === rate ? 'on' : ''}
                        onClick={() => pickRate(r)}
                      >
                        {r === 1 ? 'Normal' : `${r}x`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="vp-btn"
                onClick={toggleFullscreen}
                aria-label={fs ? 'Exit fullscreen' : 'Fullscreen'}
                title={fs ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {fs ? <Compress size={20} /> : <Expand size={20} />}
              </button>
            </div>
          </div>
        </>
      )}

      {state === 'loading' && (
        <div className="vp-overlay" role="status" aria-live="polite">
          <div className="spinner" />
          <span>Loading video…</span>
        </div>
      )}

      {/* Buffering is not loading: the picture is already there, so only the
          spinner comes back, with nothing written over the frame. */}
      {state === 'ready' && waiting && (
        <div className="vp-overlay vp-overlay-bare" role="status" aria-live="polite">
          <div className="spinner" />
        </div>
      )}

      {state === 'error' && (
        <div className="vp-overlay vp-overlay-solid" role="alert">
          <p className="vp-error-title">This video would not load</p>
          <p className="vp-error-sub">It may be a network hiccup, or the source may have moved.</p>
          <button type="button" className="btn btn-outline vp-retry" onClick={retry}>Try again</button>
        </div>
      )}
    </div>
  );
}
