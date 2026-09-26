// ===========================================================================
//  VideoPlayer.jsx — one component, every kind of video.
//
//    file     a direct MP4/WebM (the S3 uploads lms_api.php makes)
//    hls      an .m3u8 ladder, through hls.js where the browser needs it
//    bunny    the Bunny Stream embed (iframe.mediadelivery.net)
//    vimeo    the Vimeo embed
//    youtube  the privacy-preserving YouTube embed
//    iframe   anything else — shown, but not drivable
//
//  Bunny's SHARE page (player.mediadelivery.net/play/…) is rewritten to its
//  embed before anything else happens — see lib/videoSource.js. Left as it
//  was, it nested a second autoplaying player we could not reach.
//
//  One set of controls for all of them
//    Every drivable kind gets the same things: ±10 s, play/pause, a big
//    animated burst in the middle when playback starts or stops, a "+10"
//    flash on the side that was skipped, keyboard shortcuts, fullscreen that
//    keeps our controls on screen, and the end-of-lesson card via onEnded.
//
//    file/hls draw a full control bar of our own. The embeds keep their own
//    bar (it owns quality, captions and the scrubber) and get a floating
//    toolbar above it that only ever covers its own few pixels — nothing of
//    ours sits over the embed's surface, so a click on the video always
//    reaches the video.
//
//  Talking to an embed — and the bug this replaced
//    Bunny runs player.js. Its Receiver RE-EMITS `ready` every time it is sent
//    addEventListener('ready'). The old bridge answered `ready` by
//    subscribing again — including to `ready` — so the page and the iframe
//    played ping-pong as fast as the event loop allowed: ~1,450 messages a
//    second, measured on the live site, for as long as a Bunny lesson was
//    open. That was the laptop heating up. And on every lap it also sent
//    `play` when the lesson had been opened by a click, which is why pressing
//    pause "did nothing": the page un-paused it again a few milliseconds later.
//
//    Now: we never subscribe to `ready` (the embed announces it unprompted),
//    we handle it once per load, we subscribe once per load, and we only
//    listen to messages whose source IS our iframe. The bridge effect depends
//    on the iframe's URL alone, so the progress save every ten seconds —
//    which changes `startAt` — no longer tears it down and rebuilds it.
//
//  Progress
//    onProgress({ seconds, duration, watched }) — `watched` is summed from
//    small forward steps of the playhead only, so scrubbing and skipping
//    cannot inflate it. Reported every ten watched seconds, and immediately on
//    pause, on the tab being hidden and on the lesson closing.
// ===========================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Compress, Expand, Pause, Play, SkipBack, SkipFwd, Volume, VolumeX, Wrench,
} from './icons';
import { normalizeVideo } from '../lib/videoSource';
import './video.css';

/* hls.js is only pulled in when an .m3u8 actually needs it — Safari and iOS
   play HLS natively, so most sessions never download it at all. */
async function loadHls() {
  const mod = await import('hls.js');
  return mod.default ?? mod;
}

const IFRAME_KINDS = new Set(['vimeo', 'bunny', 'youtube', 'iframe']);

/* Report every ten seconds of real watching. */
const REPORT_EVERY = 10;
/* A gap larger than this between two playhead readings is a seek, a stall or
   a backgrounded tab — never someone watching. Covers 2x speed comfortably. */
const MAX_TICK_GAP = 2.5;
/* How far the skip buttons, the arrow keys and a double-tap jump. */
const SKIP = 10;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

/* player.js replies to a getter on the listener id it was handed. */
const PJS = { context: 'player.js', version: '0.0.11' };
const L_DURATION = 'istudio-duration';
const L_PAUSED = 'istudio-paused';
const PJS_EVENTS = ['play', 'pause', 'timeupdate', 'seeked', 'ended'];
/* Vimeo answers the modern names on some builds and the original ones on
   others; subscribing to both costs nothing and the aliases fold them. */
const VIMEO_EVENTS = ['play', 'pause', 'timeupdate', 'playProgress', 'seeked', 'seek', 'ended', 'finish'];
const VIMEO_ALIAS = { playProgress: 'timeupdate', finish: 'ended', seek: 'seeked' };

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
  video: rawVideo,     // { kind, src, embed } from the API
  poster,
  startAt = 0,         // seconds to resume from
  onProgress,          // ({seconds, duration, watched}) — already throttled here
  onEnded,
  title,
  autoPlay = false,    // start on its own once the source is playable
  replayToken = 0,     // bumped by "Revise This Lesson" — back to 0:00 and play
  reloadToken = 0,     // bumped by the troubleshooter — reload, keep the place
  onHelp,              // opens the troubleshooter
  onIssue,             // ({type, detail}) — a playback problem worth logging
  onDiag,              // ({kind, state, connected}) — for the troubleshooter
}) {
  const video = useMemo(() => normalizeVideo(rawVideo), [rawVideo]);
  const kind = video?.kind || 'none';
  const native = kind === 'file' || kind === 'hls';
  /* Only these answer postMessage. A bare `iframe` is someone else's player
     on an unknown protocol — buttons that silently do nothing are worse
     than no buttons. */
  const drivable = kind === 'vimeo' || kind === 'bunny' || kind === 'youtube';

  const [state, setState] = useState('loading');   // loading | ready | error
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const frameRef = useRef(null);
  const hlsRef = useRef(null);
  const seeded = useRef(false);

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
  const [resumed, setResumed] = useState(0);        // "Resumed from 6:02", briefly
  const [blocked, setBlocked] = useState(false);    // autoplay refused by the browser
  const [connected, setConnected] = useState(false); // the embed has answered us
  const [slow, setSlow] = useState(false);           // still not playable after a while
  const [frameNonce, setFrameNonce] = useState(0);   // remounts the iframe on reload
  /* The two animations: the burst in the middle, the "+10" on a side. Each
     carries an id so pressing twice restarts the animation. */
  const [burst, setBurst] = useState(null);         // { type: 'play'|'pause', id }
  const [skipFx, setSkipFx] = useState(null);       // { dir: -1|1, total, id }

  /* The latest props, for callbacks that must stay stable. Written in an
     effect (refs are not written during render). */
  const latest = useRef({});
  useEffect(() => {
    latest.current = { startAt, autoPlay, onProgress, onEnded, onIssue, onDiag };
  });

  /* Mirrors of state the event handlers need synchronously. */
  const playingRef = useRef(false);
  const setPlayingNow = useCallback((v) => { playingRef.current = v; setPlaying(v); }, []);
  const uiOnRef = useRef(true);
  useEffect(() => { uiOnRef.current = uiOn; }, [uiOn]);

  /* Autoplay is attempted once per source; without the latch every `canplay`
     would call play() again and fight a learner who had paused. */
  const autoTried = useRef(false);

  /* Watch bookkeeping, per source. */
  const accum = useRef(0);
  const tick = useRef(null);
  const pos = useRef(0);
  const dur = useRef(0);
  const sentPos = useRef(-1);
  const endedFired = useRef(false);
  const resumeOverride = useRef(null);   // the troubleshooter's reload keeps the place
  const lastCmdAt = useRef(0);           // when WE last asked the embed to play/pause
  const pausedAt = useRef(0);
  const lastTickAt = useRef(0);
  const reported = useRef(new Set());    // issue types already logged for this source

  /* A new lesson is a new everything. Reset during render so the spinner is
     up on the very first paint of the new source. */
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
    setBlocked(false);
    setConnected(false);
    setSlow(false);
    setBurst(null);
    setSkipFx(null);
  }

  useEffect(() => {
    seeded.current = false;
    autoTried.current = false;
    endedFired.current = false;
    accum.current = 0;
    tick.current = null;
    pos.current = 0;
    dur.current = 0;
    sentPos.current = -1;
    playingRef.current = false;
    resumeOverride.current = null;
    reported.current = new Set();
  }, [sourceKey]);

  /** Where to resume: a troubleshooter reload beats the saved position. */
  const seekTarget = () => (resumeOverride.current ?? latest.current.startAt ?? 0);

  const report = useCallback((type, detail = '') => {
    if (reported.current.has(type)) return;
    reported.current.add(type);
    latest.current.onIssue?.({ type, detail });
  }, []);

  /* ── the two animations ──────────────────────────────────────────────── */
  const burstAt = useRef(null);
  const showBurst = useCallback((type) => {
    setBurst({ type, id: Date.now() + Math.random() });
    clearTimeout(burstAt.current);
    burstAt.current = setTimeout(() => setBurst(null), 720);
  }, []);

  /* Taps in quick succession add up — three presses of +10 read "+30", the
     way every streaming app does it. */
  const skipRun = useRef({ dir: 0, total: 0, at: 0 });
  const skipAt = useRef(null);
  const showSkip = useCallback((delta) => {
    const now = Date.now();
    const dir = Math.sign(delta);
    const r = skipRun.current;
    const total = r.dir === dir && now - r.at < 900 ? r.total + Math.abs(delta) : Math.abs(delta);
    skipRun.current = { dir, total, at: now };
    setSkipFx({ dir, total, id: now });
    clearTimeout(skipAt.current);
    skipAt.current = setTimeout(() => setSkipFx(null), 800);
  }, []);

  useEffect(() => () => { clearTimeout(burstAt.current); clearTimeout(skipAt.current); }, []);

  /* ── progress ───────────────────────────────────────────────────────── */
  const flush = useCallback((force = false) => {
    const add = Math.floor(accum.current);
    if (!force && add < REPORT_EVERY) return;
    const seconds = Math.max(0, Math.floor(pos.current || 0));
    if (add <= 0 && seconds === sentPos.current) return;
    accum.current -= add;
    sentPos.current = seconds;
    const duration = Number.isFinite(dur.current) ? Math.floor(dur.current) : 0;
    latest.current.onProgress?.({ seconds, duration: duration > 0 ? duration : 0, watched: add });
  }, []);

  /** "That finished" — exactly once per pass through the video. */
  const fireEnded = useCallback(() => {
    if (endedFired.current) return;
    endedFired.current = true;
    flush(true);
    latest.current.onEnded?.();
  }, [flush]);

  /* Some embeds never send `ended` (a post-roll card, a stall on the last
     second). The playhead is allowed to settle it. */
  const maybeEnded = useCallback((secs, length) => {
    if (!Number.isFinite(length) || length <= 0 || !Number.isFinite(secs)) return;
    if (secs < length - 5) { endedFired.current = false; return; }
    if (secs < length - 1.25) return;
    fireEnded();
  }, [fireEnded]);

  /** One playhead reading, wherever it came from. */
  const advance = useCallback((seconds, duration) => {
    const t = Number(seconds);
    if (!Number.isFinite(t) || t < 0) return;
    if (Number.isFinite(duration) && duration > 0) dur.current = duration;
    const prev = tick.current;
    if (prev !== null) {
      const gap = t - prev;
      if (gap > 0 && gap <= MAX_TICK_GAP) accum.current += gap;
    }
    tick.current = t;
    pos.current = t;
    flush(false);
  }, [flush]);

  /* Pause, tab-hidden and unmount are when a position is most likely lost. */
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

  /* The readout only needs whole seconds; re-rendering the player on every
     sub-second tick is work for nothing. */
  const showTime = useCallback((t) => {
    setCur((c) => (Math.floor(c) === Math.floor(t) ? c : t));
  }, []);

  /* ── control-bar auto-hide (native only) ─────────────────────────────── */
  const hideAt = useRef(null);
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

  const tryAutoPlay = useCallback(() => {
    if (!latest.current.autoPlay || autoTried.current) return;
    const el = videoRef.current;
    if (!el || !el.paused) return;
    autoTried.current = true;
    const p = el.play();
    if (p?.catch) p.catch(() => setBlocked(true));
  }, []);

  /* ── the iframe URL ──────────────────────────────────────────────────── */
  const frameSrc = useMemo(() => {
    const base = video?.embed || video?.src || '';
    if (!base) return '';
    try {
      const u = new URL(base, window.location.href);
      if (kind === 'bunny') {
        u.searchParams.set('autoplay', autoPlay ? 'true' : 'false');
        u.searchParams.set('preload', 'true');
      } else if (kind === 'vimeo') {
        if (autoPlay) u.searchParams.set('autoplay', '1');
      } else if (kind === 'youtube') {
        u.searchParams.set('enablejsapi', '1');
        u.searchParams.set('origin', window.location.origin);
        if (autoPlay) u.searchParams.set('autoplay', '1');
      }
      return u.toString();
    } catch {
      return base;
    }
  }, [kind, video?.embed, video?.src, autoPlay]);

  /* ── the command channel to an embed ─────────────────────────────────── */
  const bridge = useRef(null);   // (method, value, listener) => void, per iframe load
  const resubscribe = useRef(null);

  const sendCmd = useCallback((cmd, value) => {
    if (kind === 'youtube') {
      const win = frameRef.current?.contentWindow;
      const fn = { play: 'playVideo', pause: 'pauseVideo', setCurrentTime: 'seekTo' }[cmd];
      if (!win || !fn) return;
      try {
        win.postMessage(JSON.stringify({ event: 'command', func: fn, args: fn === 'seekTo' ? [value, true] : [] }), '*');
      } catch { /* not ready yet */ }
      return;
    }
    if (cmd === 'getPaused') bridge.current?.('getPaused', undefined, L_PAUSED);
    else bridge.current?.(cmd, value);
  }, [kind]);

  /* ── the Bunny / Vimeo bridge ────────────────────────────────────────── */
  useEffect(() => {
    if (kind !== 'bunny' && kind !== 'vimeo') return undefined;
    const frame = frameRef.current;
    if (!frame) return undefined;
    const bunny = kind === 'bunny';

    let readySeen = false;
    let heard = false;     // any event at all has come back since loading
    const timers = [];

    const send = (method, value, listener) => {
      const win = frame.contentWindow;
      if (!win) return;
      const msg = bunny ? { ...PJS, method } : { method };
      if (value !== undefined) msg.value = value;
      if (bunny && listener) msg.listener = listener;
      try { win.postMessage(JSON.stringify(msg), '*'); } catch { /* frame navigating */ }
    };
    bridge.current = send;
    resubscribe.current = () => subscribe();

    /* NEVER 'ready' — that is the event whose re-emission started the old
       loop, and the embed announces it unprompted anyway.

       Bunny can announce `ready` more than once per load: some builds create
       a second player.js Receiver after the first has already answered, and
       that one starts with no listeners — commands still work, but no events
       come back. So every `ready` re-subscribes. It cannot loop (we never
       subscribe to `ready`), and it is still rate-limited and capped, in case
       a future embed misbehaves in some other way. */
    let subs = 0;
    let lastSub = 0;
    let pendingSub = null;
    const subscribe = () => {
      if (subs >= 6) return;
      const wait = lastSub + 1200 - Date.now();
      if (wait > 0) {
        if (!pendingSub) pendingSub = setTimeout(() => { pendingSub = null; subscribe(); }, wait);
        return;
      }
      subs += 1;
      lastSub = Date.now();
      (bunny ? PJS_EVENTS : VIMEO_EVENTS).forEach((evt) => send('addEventListener', evt, evt));
      send('getDuration', undefined, L_DURATION);
      send('getPaused', undefined, L_PAUSED);
    };

    const seedIfDue = () => {
      if (seeded.current) return;
      const at = Number(seekTarget()) || 0;
      if (at <= 5) { seeded.current = true; return; }
      /* The length has to be known first: seeking past the end restarts the
         video, and landing on the last seconds is worse than the tail. */
      if (!(dur.current > 0)) return;
      seeded.current = true;
      if (at >= dur.current - 15) return;
      lastCmdAt.current = Date.now();
      send('setCurrentTime', at);
      tick.current = at;
      pos.current = at;
      setCur(at);
      setResumed(at);
      timers.push(setTimeout(() => setResumed(0), 4200));
    };

    const noteDuration = (v) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return;
      dur.current = n;
      setLen((l) => (Math.abs(l - n) < 0.5 ? l : n));
      seedIfDue();
    };

    const onReady = () => {
      if (readySeen) { subscribe(); return; }
      readySeen = true;
      /* Subscribed, but nothing back yet? Try again — a receiver rebuilt
         behind our back is the usual reason. Harmless if the video is simply
         sitting paused. */
      [2500, 6000].forEach((ms) => timers.push(setTimeout(() => { if (!heard) subscribe(); }, ms)));
      setConnected(true);
      setState('ready');
      subscribe();
      /* The URL parameter usually has this covered already. */
      if (latest.current.autoPlay) { lastCmdAt.current = Date.now(); send('play'); }
    };

    /* A frame announced from the playing state, rather than an event WE caused,
       still gets the burst — a click on the embed's own surface looks the same
       as a click on ours. The first play of a source is autoplay, not a click. */
    const noteState = (isPlaying) => {
      const was = playingRef.current;
      if (was === isPlaying) return;
      setPlayingNow(isPlaying);
      if (!isPlaying) pausedAt.current = Date.now();
      if (Date.now() - lastCmdAt.current > 700 && pos.current > 0.5) showBurst(isPlaying ? 'play' : 'pause');
    };

    const onMessage = (e) => {
      if (e.source !== frame.contentWindow) return;
      let d = e.data;
      if (typeof d === 'string') {
        if (d.charAt(0) !== '{') return;
        try { d = JSON.parse(d); } catch { return; }
      }
      if (!d || typeof d !== 'object') return;
      /* Bunny also speaks its own "bunnystream" channel; we do not use it. */
      if (d.channel === 'bunnystream') return;

      /* Vimeo still reports under its original names — playProgress, finish,
         seek — whichever name it was subscribed under. */
      const raw = d.event || d.method;
      const evt = VIMEO_ALIAS[raw] || raw;
      if (evt === 'play' || evt === 'pause' || evt === 'timeupdate' || evt === 'seeked' || evt === 'ended') heard = true;
      const v = d.value !== undefined ? d.value : d.data;
      const body = v && typeof v === 'object' ? v : {};

      switch (evt) {
        case 'ready':
          onReady();
          return;
        case 'getDuration':
        case L_DURATION:
          noteDuration(v);
          return;
        case 'getPaused':
        case L_PAUSED:
          if (typeof v === 'boolean') noteState(!v);
          return;
        case 'play':
          if (!readySeen) onReady();
          setWaiting(false);
          noteState(true);
          return;
        case 'pause':
          noteState(false);
          flush(true);
          return;
        case 'seeked': {
          const s = Number(body.seconds ?? body.currentTime);
          if (Number.isFinite(s)) { tick.current = s; pos.current = s; showTime(s); }
          return;
        }
        case 'timeupdate': {
          if (!readySeen) onReady();
          if (Number(body.duration) > 0) noteDuration(body.duration);
          const s = Number(body.seconds ?? body.currentTime);
          if (!Number.isFinite(s)) return;
          const prev = pos.current;
          lastTickAt.current = Date.now();
          /* Moving forward with no `play` heard: it is playing. (A pause
             sends one trailing tick, hence the grace period.) */
          if (!playingRef.current && s > prev + 0.05 && s - prev < 3 && Date.now() - pausedAt.current > 1200) {
            noteState(true);
          }
          showTime(s);
          advance(s, dur.current);
          maybeEnded(s, dur.current);
          return;
        }
        case 'ended':
        case 'finish':
          noteState(false);
          fireEnded();
          return;
        default:
      }
    };

    window.addEventListener('message', onMessage);

    /* The embed's unprompted `ready` can land before this listener existed (a
       cached frame). If nothing has arrived a moment after load, subscribe
       anyway — player.js answers subscriptions whether or not we saw ready. */
    const onLoad = () => {
      timers.push(setTimeout(() => { if (!readySeen) subscribe(); }, 1500));
      timers.push(setTimeout(() => { if (!readySeen) send('getPaused', undefined, L_PAUSED); }, 3500));
    };
    frame.addEventListener('load', onLoad);
    /* …and for a frame that finished loading before this effect ran. */
    timers.push(setTimeout(() => { if (!readySeen) subscribe(); }, 4000));
    /* A paused video sends no timeupdate, so the length — which Resume needs —
       is asked for again once the metadata has had time to arrive. */
    [2000, 5000, 9000].forEach((ms) => timers.push(setTimeout(() => {
      if (!(dur.current > 0)) send('getDuration', undefined, L_DURATION);
    }, ms)));

    return () => {
      window.removeEventListener('message', onMessage);
      frame.removeEventListener('load', onLoad);
      timers.forEach(clearTimeout);
      clearTimeout(pendingSub);
      if (bridge.current === send) { bridge.current = null; resubscribe.current = null; }
    };
    // Deliberately keyed on the frame alone — see the header.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, frameSrc, frameNonce]);

  /* A playing embed that goes quiet has usually been paused by something we
     did not hear. Ask, rather than show a pause button over a stopped video. */
  useEffect(() => {
    if (kind !== 'bunny' && kind !== 'vimeo') return undefined;
    if (!playing) return undefined;
    const id = setInterval(() => {
      /* Silent while we think it plays: ask, and re-attach our listeners in
         case the embed rebuilt its receiver without telling us. */
      if (Date.now() - lastTickAt.current > 2500) { sendCmd('getPaused'); resubscribe.current?.(); }
    }, 2500);
    return () => clearInterval(id);
  }, [kind, playing, sendCmd]);

  /* ── YouTube ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (kind !== 'youtube') return undefined;
    const frame = frameRef.current;
    if (!frame) return undefined;

    const listen = () => {
      try {
        frame.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
      } catch { /* not ready yet */ }
    };

    const onMessage = (e) => {
      if (e.source !== frame.contentWindow) return;
      let data = e.data;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return; } }
      const info = data?.info;
      if (!info || typeof info !== 'object') return;
      setConnected(true);

      const length = Number(info.duration);
      if (Number.isFinite(length) && length > 0) { dur.current = length; setLen(length); }

      const secs = Number(info.currentTime);
      if (Number.isFinite(secs)) {
        showTime(secs);
        advance(secs, dur.current);
        maybeEnded(secs, dur.current);
        const at = Number(seekTarget()) || 0;
        if (!seeded.current && at > 5 && dur.current > 0 && at < dur.current - 15) {
          seeded.current = true;
          sendCmd('setCurrentTime', at);
        }
      }

      /* -1 unstarted · 0 ended · 1 playing · 2 paused · 3 buffering */
      if (info.playerState === 1) { setState('ready'); setPlayingNow(true); setWaiting(false); }
      else if (info.playerState === 2) { setPlayingNow(false); flush(true); }
      else if (info.playerState === 3) setWaiting(true);
      else if (info.playerState === 0) { setPlayingNow(false); fireEnded(); }
    };

    window.addEventListener('message', onMessage);
    const a = setTimeout(listen, 400);
    const b = setTimeout(listen, 1800);
    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(a);
      clearTimeout(b);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, frameSrc, frameNonce]);

  /* ── native <video>: the reconciler ──────────────────────────────────────
     Media events can go missing (a warm cache firing `canplay` before we
     listen, a downloader extension re-wrapping the element, bfcache). The
     element is polled and always wins, so a desync lasts 400ms, not a lesson.
     It doubles as a floor under progress reporting. */
  const armed = useRef(false);
  useEffect(() => { armed.current = false; }, [sourceKey]);

  useEffect(() => {
    if (!native) return undefined;
    const since = Date.now();
    const sync = () => {
      const el = videoRef.current;
      if (!el || !armed.current) return;
      const enough = el.readyState >= 2 || (el.readyState >= 1 && Date.now() - since > 7000);
      if (enough && !el.error) { setState('ready'); tryAutoPlay(); }
      if (el.readyState >= 3) setWaiting(false);
      const live = !el.paused && !el.ended;
      if (playingRef.current !== live) setPlayingNow(live);
      if (!live) setUiOn(true);
      if (Number.isFinite(el.duration) && el.duration > 0) {
        dur.current = el.duration;
        setLen((l) => (Math.abs(l - el.duration) < 0.01 ? l : el.duration));
      }
      showTime(el.currentTime);
      setVol((v) => (v === el.volume ? v : el.volume));
      setMuted((m) => (m === el.muted ? m : el.muted));
      setRate((r) => (r === el.playbackRate ? r : el.playbackRate));
      if (live) advance(el.currentTime, el.duration);
    };
    sync();
    const id = setInterval(sync, 400);
    return () => clearInterval(id);
  }, [native, sourceKey, advance, tryAutoPlay, setPlayingNow, showTime]);

  /* ── native <video>: attach the source ───────────────────────────────── */
  useEffect(() => {
    if (!native) return undefined;
    const el = videoRef.current;
    if (!el || !video?.src) return undefined;
    let cancelled = false;
    let hls = null;

    const attach = async () => {
      if (kind === 'file') { el.src = video.src; armed.current = true; return; }
      if (el.canPlayType('application/vnd.apple.mpegurl')) { el.src = video.src; armed.current = true; return; }
      try {
        const Hls = await loadHls();
        if (cancelled) return;
        if (!Hls.isSupported()) { setState('error'); return; }
        hls = new Hls({ enableWorker: true, lowLatencyMode: false });
        hlsRef.current = hls;
        hls.loadSource(video.src);
        hls.attachMedia(el);
        armed.current = true;
        hls.on(Hls.Events.ERROR, (_e, data) => { if (data?.fatal && !cancelled) setState('error'); });
      } catch {
        if (!cancelled) setState('error');
      }
    };
    attach();

    return () => {
      cancelled = true;
      armed.current = false;
      if (hls) { hls.destroy(); hlsRef.current = null; }
      el.removeAttribute('src');
      el.load();
    };
  }, [native, kind, video?.src, frameNonce]);

  /* Embeds have no readyState to poll: their `load` clears the spinner, with
     an eight-second floor for a frame served from cache before we listened. */
  useEffect(() => {
    if (!IFRAME_KINDS.has(kind)) return undefined;
    const t = setTimeout(() => setState((s) => (s === 'loading' ? 'ready' : s)), 8000);
    return () => clearTimeout(t);
  }, [kind, sourceKey, frameNonce]);

  /* ── noticing trouble ────────────────────────────────────────────────────
     Twelve seconds without a playable source, or a drivable embed that never
     answered, is worth a "Having trouble?" on the stage — and a row in the
     issue log, so the admin can see which browsers it happens on. */
  useEffect(() => {
    if (kind === 'none') return undefined;
    const t = setTimeout(() => {
      const el = videoRef.current;
      const stuck = native ? !el || el.readyState < 2 : false;
      if (stuck) { setSlow(true); report('slow_load', 'native source not playable after 12s'); }
    }, 12000);
    return () => clearTimeout(t);
  }, [kind, native, sourceKey, frameNonce, report]);

  useEffect(() => {
    if (!drivable) return undefined;
    const t = setTimeout(() => {
      if (!connected) { setSlow(true); report('no_bridge', `${kind} embed did not answer within 12s`); }
    }, 12000);
    return () => clearTimeout(t);
  }, [drivable, kind, connected, sourceKey, frameNonce, report]);

  useEffect(() => {
    if (state === 'error') report('load_error', `${kind} source failed to load`);
  }, [state, kind, report]);


  useEffect(() => {
    latest.current.onDiag?.({ kind, state, connected, drivable, src: video?.embed || video?.src || '' });
  }, [kind, state, connected, drivable, video?.embed, video?.src]);

  /* ── "Revise This Lesson" ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!replayToken) return;
    seeded.current = true;
    tick.current = 0;
    pos.current = 0;
    sentPos.current = -1;
    lastCmdAt.current = Date.now();
    if (native) {
      const el = videoRef.current;
      if (el) { el.currentTime = 0; el.play().catch(() => setBlocked(true)); }
    } else if (drivable) {
      sendCmd('setCurrentTime', 0);
      sendCmd('play');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayToken]);

  /* ── the troubleshooter's "Reload video" — same place, fresh player ──── */
  const [seenReload, setSeenReload] = useState(reloadToken);
  if (seenReload !== reloadToken) {
    setSeenReload(reloadToken);
    setPlaying(false);
    setConnected(false);
    setSlow(false);
    setState('loading');
    setFrameNonce((n) => n + 1);
  }
  useEffect(() => {
    if (!reloadToken) return;
    flush(true);
    resumeOverride.current = pos.current > 5 ? pos.current : null;
    seeded.current = false;
    autoTried.current = false;
    tick.current = null;
    playingRef.current = false;
    reported.current = new Set();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  /* ── fullscreen, and the phone turning with it ───────────────────────── */
  useEffect(() => {
    const sync = () => {
      const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setFs(on && (document.fullscreenElement || document.webkitFullscreenElement) === wrapRef.current);
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
    /* The WRAPPER goes fullscreen, so our controls stay over the picture. iOS
       Safari has no element fullscreen worth using: the video's own is it. */
    if (box?.requestFullscreen) {
      try { await box.requestFullscreen({ navigationUI: 'hide' }); }
      catch { try { await box.requestFullscreen(); } catch { /* refused */ } }
    } else if (box?.webkitRequestFullscreen) {
      box.webkitRequestFullscreen();
    } else if (el?.webkitEnterFullscreen) {
      el.webkitEnterFullscreen();
      return;
    }
    if (isTouchScreen()) {
      try { await window.screen?.orientation?.lock?.('landscape'); } catch { /* refused */ }
    }
  }, [bumpUi]);

  /* ── the controls ────────────────────────────────────────────────────── */
  const togglePlay = useCallback(() => {
    lastCmdAt.current = Date.now();
    if (!native) {
      if (!drivable) return;
      const want = !playingRef.current;
      sendCmd(want ? 'play' : 'pause');
      setPlayingNow(want);
      if (!want) { pausedAt.current = Date.now(); flush(true); }
      showBurst(want ? 'play' : 'pause');
      /* Confirm with the embed rather than trust the guess — if it refused
         (autoplay policy, still booting) the button corrects itself. */
      if (kind !== 'youtube') setTimeout(() => sendCmd('getPaused'), 900);
      return;
    }
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {/* autoplay policy */});
      showBurst('play');
    } else {
      el.pause();
      showBurst('pause');
    }
    bumpUi();
  }, [native, drivable, kind, sendCmd, setPlayingNow, flush, showBurst, bumpUi]);

  const seekBy = useCallback((delta) => {
    showSkip(delta);
    if (!native) {
      if (!drivable) return;
      const end = dur.current > 0 ? dur.current - 0.5 : Infinity;
      const to = Math.max(0, Math.min(end, (pos.current || 0) + delta));
      sendCmd('setCurrentTime', to);
      /* Writing tick too is what stops the jump being banked as watched. */
      pos.current = to;
      tick.current = to;
      setCur(to);
      return;
    }
    const el = videoRef.current;
    if (!el) return;
    const end = Number.isFinite(el.duration) && el.duration > 0 ? el.duration - 0.25 : Infinity;
    el.currentTime = Math.max(0, Math.min(end, el.currentTime + delta));
    setCur(el.currentTime);
    bumpUi();
  }, [native, drivable, sendCmd, showSkip, bumpUi]);

  const seekTo = (secs) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = secs;
    setCur(secs);
    bumpUi();
  };

  const setVolume = useCallback((v) => {
    const el = videoRef.current;
    if (!el) return;
    el.volume = v;
    el.muted = v === 0;
    bumpUi();
  }, [bumpUi]);

  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    if (!el.muted && el.volume === 0) el.volume = 0.6;
    bumpUi();
  }, [bumpUi]);

  const pickRate = (r) => {
    const el = videoRef.current;
    if (el) el.playbackRate = r;
    setRate(r);
    setRateOpen(false);
    bumpUi();
  };

  /* ── keyboard: space/k, ←/j, →/l, f, m, ↑/↓ ─────────────────────────────
     Listened for on the document, so the shortcuts work without first
     clicking the player — but never while the learner is typing, and never
     stealing Enter/space from a focused button. */
  const keys = useRef({});
  useEffect(() => {
    keys.current = { togglePlay, seekBy, toggleFullscreen, toggleMute, setVolume, vol, native, drivable };
  });
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
      const inPlayer = !!wrapRef.current?.contains(t);
      if (!inPlayer && t !== document.body && t !== document.documentElement) return;
      if ((tag === 'BUTTON' || tag === 'A') && (e.key === ' ' || e.key === 'Enter')) return;
      /* A dialog open over the page owns the keyboard. */
      if (document.querySelector('[aria-modal="true"]')) return;

      const k = keys.current;
      if (!k.native && !k.drivable) return;
      const hit = (fn) => { e.preventDefault(); fn(); };
      switch (e.key) {
        case ' ': case 'k': case 'K':            return hit(k.togglePlay);
        case 'ArrowLeft': case 'j': case 'J':    return hit(() => k.seekBy(-SKIP));
        case 'ArrowRight': case 'l': case 'L':   return hit(() => k.seekBy(SKIP));
        case 'f': case 'F':                      return hit(k.toggleFullscreen);
        case 'm': case 'M':                      return k.native ? hit(k.toggleMute) : undefined;
        case 'ArrowUp':   return inPlayer && k.native ? hit(() => k.setVolume(Math.min(1, k.vol + 0.1))) : undefined;
        case 'ArrowDown': return inPlayer && k.native ? hit(() => k.setVolume(Math.max(0, k.vol - 0.1))) : undefined;
        default: return undefined;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* ── touch on the native stage ───────────────────────────────────────────
     One tap shows the controls (or plays/pauses once they are showing); a
     double tap on the left or right third skips ten seconds, and further taps
     on that side while the "+10" is still up keep adding. */
  const lastTap = useRef({ at: 0, x: 0.5 });
  const tapTimer = useRef(null);
  useEffect(() => () => clearTimeout(tapTimer.current), []);

  const onStageTap = (e) => {
    if (!isTouchScreen()) { togglePlay(); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.width ? (e.clientX - rect.left) / rect.width : 0.5;
    const now = Date.now();
    const side = x < 0.38 ? -1 : x > 0.62 ? 1 : 0;

    /* Still inside a skip run on this side: every tap counts. */
    if (side && skipRun.current.dir === side && now - skipRun.current.at < 800) {
      clearTimeout(tapTimer.current);
      seekBy(side * SKIP);
      return;
    }
    if (now - lastTap.current.at < 300 && side && Math.abs(x - lastTap.current.x) < 0.25) {
      clearTimeout(tapTimer.current);
      lastTap.current = { at: 0, x };
      seekBy(side * SKIP);
      return;
    }
    lastTap.current = { at: now, x };
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      if (!uiOnRef.current) bumpUi(); else togglePlay();
    }, 260);
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
    setFrameNonce((n) => n + 1);
    if (videoRef.current) videoRef.current.load();
  };

  const pct = len > 0 ? (cur / len) * 100 : 0;
  const bufPct = len > 0 ? Math.min(100, (buffered / len) * 100) : 0;

  /* The two animations, shared by every kind. pointer-events: none — they
     are feedback, never a target. */
  const effects = (
    <>
      {burst && (
        <div key={burst.id} className={`vp-burst vp-burst-${burst.type}`} aria-hidden="true">
          <span className="vp-burst-ring" />
          <span className="vp-burst-core">
            {burst.type === 'play'
              ? <Play size={44} fill="currentColor" stroke="none" />
              : <Pause size={44} strokeWidth={2.6} />}
          </span>
        </div>
      )}
      {skipFx && (
        <div key={skipFx.id} className={`vp-skipfx ${skipFx.dir < 0 ? 'is-back' : 'is-fwd'}`} aria-hidden="true">
          <span className="vp-skipfx-wave" />
          <span className="vp-skipfx-body">
            <span className="vp-skipfx-arrows"><i /><i /><i /></span>
            <span className="vp-skipfx-n">{skipFx.dir < 0 ? '−' : '+'}{skipFx.total}</span>
            <span className="vp-skipfx-l">seconds</span>
          </span>
        </div>
      )}
      {resumed > 0 && (
        <div className="vp-resumed" role="status">Resumed from {clock(resumed)}</div>
      )}
    </>
  );

  return (
    <div
      ref={wrapRef}
      className={[
        'vp', `vp-${kind}`,
        native ? 'vp-native' : 'vp-embed',
        fs ? 'vp-fs' : '',
        playing ? 'is-playing' : 'is-paused',
        native && !uiOn ? 'vp-idle' : '',
      ].filter(Boolean).join(' ')}
      onPointerMove={native ? bumpUi : undefined}
      onPointerLeave={native ? () => { if (playing && !rateOpen) setUiOn(false); } : undefined}
      tabIndex={-1}
    >
      {title && <div className="vp-title">{title}</div>}

      {IFRAME_KINDS.has(kind) ? (
        <>
          <iframe
            key={`${frameSrc}#${frameNonce}`}
            ref={frameRef}
            className="vp-frame"
            src={frameSrc}
            title={title || 'Lesson video'}
            loading="eager"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setState('ready')}
            onError={() => setState('error')}
          />

          {/* ── our toolbar, above the embed's own bar ──────────────────────
              A pill, not a layer: it covers only its own pixels, so every
              click anywhere else on the video still reaches the video. */}
          {drivable && state !== 'error' && (
            <div className="vp-dock" role="toolbar" aria-label="Video controls">
              <button type="button" className="vp-dock-btn" onClick={() => seekBy(-SKIP)}
                aria-label={`Back ${SKIP} seconds`} title={`Back ${SKIP} seconds (←)`}>
                <SkipBack n={SKIP} size={22} />
              </button>
              <button type="button" className="vp-dock-btn vp-dock-play" onClick={togglePlay}
                aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause (space)' : 'Play (space)'}>
                <span className={`vp-morph${playing ? ' is-on' : ''}`}>
                  <Play className="vp-morph-play" size={22} fill="currentColor" stroke="none" />
                  <Pause className="vp-morph-pause" size={22} strokeWidth={2.6} />
                </span>
              </button>
              <button type="button" className="vp-dock-btn" onClick={() => seekBy(SKIP)}
                aria-label={`Forward ${SKIP} seconds`} title={`Forward ${SKIP} seconds (→)`}>
                <SkipFwd n={SKIP} size={22} />
              </button>
              {len > 0 && (
                <span className="vp-dock-time">{clock(cur)}<em>/</em>{clock(len)}</span>
              )}
              <span className="vp-dock-sep" />
              <button type="button" className="vp-dock-btn vp-dock-sm" onClick={toggleFullscreen}
                aria-label={fs ? 'Exit fullscreen' : 'Fullscreen'} title={fs ? 'Exit fullscreen (f)' : 'Fullscreen (f)'}>
                {fs ? <Compress size={18} /> : <Expand size={18} />}
              </button>
              {onHelp && (
                <button type="button" className="vp-dock-btn vp-dock-sm" onClick={onHelp}
                  aria-label="Video not working? Troubleshoot" title="Video not working? Troubleshoot">
                  <Wrench size={17} />
                </button>
              )}
            </div>
          )}
          {effects}
        </>
      ) : (
        <video
          ref={videoRef}
          className="vp-video"
          poster={poster || undefined}
          playsInline
          preload="auto"
          onContextMenu={(e) => e.preventDefault()}
          onClick={onStageTap}
          onDoubleClick={() => { if (!isTouchScreen()) toggleFullscreen(); }}
          onLoadedMetadata={(e) => {
            const el = e.currentTarget;
            if (Number.isFinite(el.duration) && el.duration > 0) { dur.current = el.duration; setLen(el.duration); }
            setVol(el.volume);
            setMuted(el.muted);
            const at = Number(seekTarget()) || 0;
            if (!seeded.current && at > 5 && at < el.duration - 15) {
              seeded.current = true;
              el.currentTime = at;
              tick.current = at;
              pos.current = at;
              setCur(at);
              setResumed(at);
              setTimeout(() => setResumed(0), 4200);
            }
          }}
          onLoadedData={() => { setState('ready'); setWaiting(false); setSlow(false); tryAutoPlay(); }}
          onCanPlay={() => { setState('ready'); setWaiting(false); setSlow(false); tryAutoPlay(); }}
          onWaiting={() => setWaiting(true)}
          onStalled={() => { if (!videoRef.current?.paused) setWaiting(true); }}
          onPlaying={() => { setWaiting(false); setPlayingNow(true); setState('ready'); }}
          onPlay={() => { setPlayingNow(true); setBlocked(false); bumpUi(); }}
          onDurationChange={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) { dur.current = d; setLen(d); }
          }}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            showTime(el.currentTime);
            try {
              const b = el.buffered;
              if (b.length) {
                const end = b.end(b.length - 1);
                setBuffered((x) => (Math.abs(x - end) < 1 ? x : end));
              }
            } catch { /* nothing buffered yet */ }
            advance(el.currentTime, el.duration);
          }}
          onSeeking={(e) => { tick.current = e.currentTarget.currentTime; }}
          onVolumeChange={(e) => { setVol(e.currentTarget.volume); setMuted(e.currentTarget.muted); }}
          onRateChange={(e) => setRate(e.currentTarget.playbackRate)}
          onPause={() => { setPlayingNow(false); setUiOn(true); flush(true); }}
          onEnded={(e) => {
            pos.current = e.currentTarget.currentTime;
            setPlayingNow(false);
            setUiOn(true);
            fireEnded();
          }}
          /* Tearing a source down raises an error of its own; only one raised
             while a source is attached counts. */
          onError={() => { if (armed.current) setState('error'); }}
        />
      )}

      {/* ── our control bar (file / hls) ──────────────────────────────────── */}
      {native && state === 'ready' && (
        <>
          {!playing && (
            <>
              <button type="button" className="vp-big" onClick={togglePlay} aria-label="Play">
                <Play size={34} fill="currentColor" stroke="none" />
              </button>
              {blocked && <div className="vp-blocked">Tap play to start — your browser blocked autoplay</div>}
            </>
          )}
          {effects}

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
                <span className={`vp-morph${playing ? ' is-on' : ''}`}>
                  <Play className="vp-morph-play" size={21} fill="currentColor" stroke="none" />
                  <Pause className="vp-morph-pause" size={21} strokeWidth={2.6} />
                </span>
              </button>
              <button type="button" className="vp-btn" onClick={() => seekBy(-SKIP)}
                aria-label={`Back ${SKIP} seconds`} title={`Back ${SKIP} seconds (←)`}>
                <SkipBack n={SKIP} size={22} />
              </button>
              <button type="button" className="vp-btn" onClick={() => seekBy(SKIP)}
                aria-label={`Forward ${SKIP} seconds`} title={`Forward ${SKIP} seconds (→)`}>
                <SkipFwd n={SKIP} size={22} />
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
                      <button key={r} type="button" role="menuitemradio" aria-checked={r === rate}
                        className={r === rate ? 'on' : ''} onClick={() => pickRate(r)}>
                        {r === 1 ? 'Normal' : `${r}x`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {onHelp && (
                <button type="button" className="vp-btn" onClick={onHelp}
                  aria-label="Video not working? Troubleshoot" title="Video not working? Troubleshoot">
                  <Wrench size={18} />
                </button>
              )}
              <button type="button" className="vp-btn" onClick={toggleFullscreen}
                aria-label={fs ? 'Exit fullscreen' : 'Fullscreen'} title={fs ? 'Exit fullscreen (f)' : 'Fullscreen (f)'}>
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

      {state === 'ready' && waiting && (
        <div className="vp-overlay vp-overlay-bare" role="status" aria-live="polite">
          <div className="spinner" />
        </div>
      )}

      {/* Slow or unanswered: say so, and offer the way out. */}
      {slow && !(drivable && connected) && state !== 'error' && onHelp && (
        <button type="button" className="vp-trouble" onClick={onHelp}>
          <Wrench size={15} /> Video not playing? Fix it
        </button>
      )}

      {state === 'error' && (
        <div className="vp-overlay vp-overlay-solid" role="alert">
          <p className="vp-error-title">This video would not load</p>
          <p className="vp-error-sub">It may be a network hiccup, or the source may have moved.</p>
          <div className="vp-error-acts">
            <button type="button" className="btn btn-outline vp-retry" onClick={retry}>Try again</button>
            {onHelp && (
              <button type="button" className="btn btn-outline vp-retry" onClick={onHelp}>Troubleshoot</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
