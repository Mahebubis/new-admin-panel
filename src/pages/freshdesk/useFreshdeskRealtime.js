/*
 * src/pages/freshdesk/useFreshdeskRealtime.js
 *
 * Live updates for the desk: new email appears in the list, the chime plays and
 * a toast shows -- with no page refresh.
 *
 * TWO TRANSPORTS, ONE EVENT STREAM
 * --------------------------------
 * The backend writes every event to fd_activity and gives each an incrementing
 * id. Pusher delivers those events over a websocket; the poller reads the same
 * rows over HTTP. Both hand the caller identical event objects, so nothing
 * downstream knows or cares which one is running.
 *
 * The cursor is what makes this correct rather than merely frequent. It is the
 * id of the last event this client has processed, so:
 *   - reconnecting after a dropped socket replays exactly what was missed;
 *   - a laptop waking from sleep catches up in one request;
 *   - an event that arrives over BOTH transports is applied once, because the
 *     second copy has a cursor we have already seen.
 *
 * COST MODEL — read this before adding a timer.
 * ---------------------------------------------
 * An open panel makes NO repeating requests to our server. Specifically:
 *
 *   - The mailbox is synced by CRON ONLY. This hook never calls fd_sync.php on
 *     a timer. It used to, once a minute, and fd_sync.php opens an IMAP
 *     connection and can run for 10+ seconds -- so five open tabs meant five
 *     IMAP sessions a minute against a shared cPanel mailbox, forever.
 *
 *   - With Pusher configured, updates arrive over the websocket. That costs our
 *     server nothing at all: Pusher pushes, we do not poll.
 *
 *   - Without Pusher, live updates are OPT-IN. The agent turns "Live" on in the
 *     rail and the poller runs; it is off by default and off again on reload.
 *     Polling hits fd_realtime.php?action=poll, which is a couple of indexed
 *     SELECTs -- cheap, but not free, and not something to do unasked.
 *
 * Everything else happens on an explicit action: opening the page, opening a
 * ticket, or pressing Refresh.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { realtime as realtimeApi, sync as syncApi } from './fdApi';
import { playChime, primeAudio, showNotification, setTabBadge, flashTab } from './fdSound';

const PUSHER_CDN = 'https://js.pusher.com/8.4.0/pusher.min.js';

/** Load pusher-js from the CDN, once, and only if we are actually going to use it. */
let pusherScriptPromise = null;
function loadPusherScript() {
  if (window.Pusher) return Promise.resolve(window.Pusher);
  if (pusherScriptPromise) return pusherScriptPromise;
  pusherScriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PUSHER_CDN;
    s.async = true;
    s.onload = () => (window.Pusher ? resolve(window.Pusher) : reject(new Error('pusher.min.js loaded but window.Pusher is missing')));
    s.onerror = () => {
      // Reset so a later attempt (after the network comes back) can retry.
      pusherScriptPromise = null;
      reject(new Error('Could not load pusher-js from the CDN'));
    };
    document.head.appendChild(s);
  });
  return pusherScriptPromise;
}

/**
 * @param {object} opts
 *   onEvent(evt)        every event, already de-duplicated and in order
 *   onNewMessage(evt)   convenience: only new-ticket / new-message
 *   onCounts(counts)    sidebar badge numbers, whenever the server sends them
 *   enabled             set false to stop everything (e.g. panel not mounted)
 *   soundEnabled        agent preference
 *   notificationsEnabled
 */
export default function useFreshdeskRealtime({
  onEvent,
  onNewMessage,
  onCounts,
  enabled = true,
  soundEnabled = true,
  notificationsEnabled = true,
  /*
   * Opt-in background polling, for installs with no Pusher credentials.
   * Default OFF: an idle panel must not generate traffic on its own. When
   * Pusher IS configured this is ignored -- the websocket already delivers
   * events and costs our server nothing.
   */
  livePolling = false,
} = {}) {
  const [state, setState] = useState({
    connected: false,
    // 'pusher'     websocket connected, server pushes, we never poll
    // 'polling'    the agent switched Live on and there is no Pusher
    // 'manual'     no background requests at all -- the default
    // 'connecting' | 'offline'
    transport: 'connecting',
    lastEventAt: null,
    error: null,
    mailbox: null,
    unread: 0,
  });

  const cursorRef = useRef(0);
  const seenRef = useRef(new Set());
  const pusherRef = useRef(null);
  const pollTimer = useRef(null);
  const mountedRef = useRef(true);
  const configRef = useRef(null);
  const inFlight = useRef(false);
  const backoffRef = useRef(0);
  // Read inside the boot effect, which must not re-run when the toggle flips.
  const livePollingRef = useRef(livePolling);
  useEffect(() => { livePollingRef.current = livePolling; }, [livePolling]);

  /*
   * Handlers are held in refs and read through them.
   *
   * The callbacks a caller passes are usually inline arrow functions, so they
   * are a NEW value on every render. If the effect below depended on them, it
   * would tear down and rebuild the websocket on every keystroke in the search
   * box. Refs let the effect depend only on `enabled` while still calling the
   * latest handler.
   */
  const handlers = useRef({ onEvent, onNewMessage, onCounts, soundEnabled, notificationsEnabled });
  useEffect(() => {
    handlers.current = { onEvent, onNewMessage, onCounts, soundEnabled, notificationsEnabled };
  }, [onEvent, onNewMessage, onCounts, soundEnabled, notificationsEnabled]);

  /** Apply one event exactly once, whichever transport delivered it. */
  const dispatch = useCallback((evt) => {
    if (!evt) return;
    const key = evt.cursor || `${evt.event}:${evt.ticket_id}:${evt.message_id}:${evt.at}`;
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);
    // The set is a de-dup window, not a log; cap it so a long session cannot
    // grow it without bound.
    if (seenRef.current.size > 2000) {
      seenRef.current = new Set(Array.from(seenRef.current).slice(-500));
    }
    if (evt.cursor && evt.cursor > cursorRef.current) cursorRef.current = evt.cursor;

    setState((s) => ({ ...s, lastEventAt: Date.now() }));

    const data = evt.data || evt;
    const isNewMail = evt.event === 'new-ticket' || evt.event === 'new-message' || evt.event === 'test-event';

    if (isNewMail) {
      const cfg = configRef.current;
      const volume = cfg?.sound?.volume ?? 0.5;

      if (handlers.current.soundEnabled && data.notify) {
        playChime(data.sound || 'new-reply', volume);
      }
      if (handlers.current.notificationsEnabled && data.notify) {
        showNotification({
          title: evt.event === 'new-ticket'
            ? `New ticket from ${data.from_name || 'a customer'}`
            : `Reply from ${data.from_name || 'a customer'}`,
          body: `${data.subject || ''}\n${data.preview || ''}`.trim(),
          tag: `fd-ticket-${data.ticket_id}`,
          onClick: () => handlers.current.onNewMessage?.(evt),
        });
        flashTab('New email');
      }
      handlers.current.onNewMessage?.(evt);
    }

    handlers.current.onEvent?.(evt);
  }, []);

  /* ------------------------------------------------------------ polling -- */

  const pollOnce = useCallback(async () => {
    // Overlapping polls double every event and, on a slow link, queue up
    // faster than they drain.
    if (inFlight.current || !mountedRef.current) return;
    inFlight.current = true;
    try {
      const res = await realtimeApi.poll(cursorRef.current);
      if (!mountedRef.current) return;
      backoffRef.current = 0;

      if (res.primed) {
        // First poll of the session: adopt the server's high-water mark so we
        // do not replay (and chime for) the entire history.
        cursorRef.current = res.cursor || 0;
      } else {
        (res.events || []).forEach(dispatch);
        if (res.cursor) cursorRef.current = Math.max(cursorRef.current, res.cursor);
      }

      if (res.counts) {
        handlers.current.onCounts?.(res.counts);
        setState((s) => ({ ...s, unread: res.counts.unread ?? s.unread }));
        setTabBadge(res.counts.unread || 0);
      }
      setState((s) => (s.error ? { ...s, error: null, connected: true } : (s.connected ? s : { ...s, connected: true })));
    } catch (err) {
      if (err?.canceled || !mountedRef.current) return;
      /*
       * Back off on failure instead of hammering a server that is already
       * struggling: 1x, 2x, 4x... capped at 8x the base interval. Resets to
       * normal on the first success.
       */
      backoffRef.current = Math.min(backoffRef.current + 1, 3);
      setState((s) => ({ ...s, connected: false, error: err.message }));
    } finally {
      inFlight.current = false;
    }
  }, [dispatch]);

  const schedulePoll = useCallback((baseMs) => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    const factor = Math.pow(2, backoffRef.current);
    // A hidden tab does not need 8-second updates; browsers throttle timers
    // there anyway, and this makes the throttling deliberate rather than
    // whatever the browser decides.
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    const delay = Math.min(baseMs * factor * (hidden ? 4 : 1), 120000);
    pollTimer.current = setTimeout(async () => {
      await pollOnce();
      if (mountedRef.current) schedulePoll(baseMs);
    }, delay);
  }, [pollOnce]);

  /* ------------------------------------------------------------- pusher -- */

  const connectPusher = useCallback(async (cfg) => {
    const P = await loadPusherScript();

    const pusher = new P(cfg.pusher.key, {
      cluster: cfg.pusher.cluster,
      forceTLS: cfg.pusher.tls !== false,
      // Private channel: pusher-js POSTs socket_id + channel_name here and the
      // server signs the grant. The JWT rides along on the Authorization header
      // so the endpoint can check the agent's permission first.
      channelAuthorization: {
        endpoint: realtimeApi.authEndpoint(),
        transport: 'ajax',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      },
      enabledTransports: ['ws', 'wss'],
      activityTimeout: 30000,
      pongTimeout: 10000,
    });

    pusher.connection.bind('connected', () => {
      if (!mountedRef.current) return;
      setState((s) => ({ ...s, connected: true, transport: 'pusher', error: null }));
      /*
       * Catch up over HTTP the moment the socket comes up.
       *
       * Anything that happened while the socket was down was never delivered --
       * Pusher does not buffer for absent subscribers. Without this one poll,
       * every email received during a reconnect is silently lost to this tab
       * until something else triggers a refresh.
       */
      pollOnce();
    });

    pusher.connection.bind('unavailable', () => {
      if (!mountedRef.current) return;
      setState((s) => ({ ...s, connected: false, transport: 'polling', error: 'Realtime connection unavailable -- falling back to polling.' }));
    });

    pusher.connection.bind('failed', () => {
      if (!mountedRef.current) return;
      setState((s) => ({ ...s, connected: false, transport: 'polling', error: 'Websockets are blocked on this network -- using polling instead.' }));
    });

    pusher.connection.bind('error', (err) => {
      // 4001/4004 = bad app key or over quota: retrying will never help, so
      // stop pretending and let the poller carry the desk.
      const code = err?.error?.data?.code;
      if (code === 4001 || code === 4004 || code === 4100) {
        try { pusher.disconnect(); } catch { /* already gone */ }
        setState((s) => ({ ...s, transport: 'polling', error: 'Pusher rejected the credentials -- check Settings > Realtime. Polling is active.' }));
      }
    });

    const channel = pusher.subscribe(cfg.pusher.channel);
    channel.bind('pusher:subscription_error', (status) => {
      setState((s) => ({ ...s, transport: 'polling', error: `Could not subscribe (${status?.status || 'error'}). Polling is active.` }));
    });

    // One handler per event name; every one funnels into the same dispatch.
    ['new-ticket', 'new-message', 'message-sent', 'ticket-updated', 'tickets-bulk-updated',
     'note-added', 'sla-breach', 'mailbox-down', 'test-event', 'tickets-spam', 'tickets-trash',
     'tickets-deleted', 'tickets-merged', 'contact-blocked', 'contact-unblocked'].forEach((name) => {
      channel.bind(name, (data) => {
        dispatch({
          cursor: data?.cursor || 0,
          event: name,
          ticket_id: data?.ticket_id ?? null,
          message_id: data?.message_id ?? null,
          at: data?.at || new Date().toISOString(),
          data: data || {},
        });
      });
    });

    pusherRef.current = pusher;
    return pusher;
  }, [dispatch, pollOnce]);

  /* --------------------------------------------------------------- boot -- */

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return undefined;

    let cancelled = false;

    (async () => {
      let cfg;
      try {
        cfg = await realtimeApi.config();
        if (cancelled || !mountedRef.current) return;
        configRef.current = cfg;
        cursorRef.current = cfg.cursor || 0;
        setState((s) => ({ ...s, mailbox: cfg.mailbox || null }));
      } catch (err) {
        if (cancelled) return;
        // No config means no realtime at all -- say so rather than silently
        // showing a desk that never updates.
        setState((s) => ({ ...s, transport: 'offline', connected: false, error: err.message }));
        return;
      }

      /*
       * Pusher is the preferred transport precisely because it is free for us:
       * the server publishes when something happens and the browser listens.
       * No timers, no repeating requests.
       */
      if (cfg.pusher?.enabled) {
        try {
          await connectPusher(cfg);
        } catch (err) {
          if (!cancelled && mountedRef.current) {
            setState((s) => ({ ...s, transport: 'manual', error: `Realtime unavailable (${err.message}).` }));
          }
        }
      } else {
        // No Pusher credentials yet. The desk is fully usable; updates arrive
        // when the agent opens a screen or presses Refresh. Turning "Live" on
        // in the rail starts the poller (see the livePolling effect below).
        setState((s) => ({ ...s, transport: livePollingRef.current ? 'polling' : 'manual', connected: true }));
      }

      /*
       * ONE catch-up request on mount, to establish the cursor. Without it the
       * first event to arrive would look like the whole backlog. This is a
       * single call tied to opening the page -- not a repeating timer.
       */
      if (!cancelled && mountedRef.current) pollOnce();
    })();

    // Audio has to be unlocked by a real gesture before any chime can play.
    const onPrime = () => primeAudio();
    // Unlock audio on the first interaction anywhere -- browsers refuse to play
    // a sound until the user has interacted with the page at least once.
    window.addEventListener('pointerdown', onPrime, { once: true });
    window.addEventListener('keydown', onPrime, { once: true });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      window.removeEventListener('pointerdown', onPrime);
      window.removeEventListener('keydown', onPrime);
      if (pollTimer.current) clearTimeout(pollTimer.current);
      if (pusherRef.current) {
        try { pusherRef.current.disconnect(); } catch { /* already disconnected */ }
        pusherRef.current = null;
      }
      setTabBadge(0);
    };
    // Deliberately only `enabled`: see the handlers-ref note above. Adding the
    // callbacks here would rebuild the websocket on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  /* ------------------------------------------------- opt-in live polling -- */
  /*
   * Runs ONLY while the agent has "Live" switched on and Pusher is not already
   * delivering events. Turning it off clears the timer immediately, so the
   * panel goes back to making no repeating requests at all.
   *
   * Deliberately a separate effect from the boot one: flipping this toggle must
   * not tear down and rebuild the websocket.
   */
  useEffect(() => {
    if (!enabled) return undefined;

    const usingPusher = state.transport === 'pusher';
    const shouldPoll = livePolling && !usingPusher;

    if (!shouldPoll) {
      if (pollTimer.current) { clearTimeout(pollTimer.current); pollTimer.current = null; }
      setState((s) => (s.transport === 'polling' ? { ...s, transport: 'manual' } : s));
      return undefined;
    }

    const base = (configRef.current && configRef.current.poll_interval_ms) || 8000;
    /*
     * Returning the SAME object when nothing changed is load-bearing, not a
     * micro-optimisation: this effect depends on state.transport and also sets
     * it, so handing back a fresh {...s} every run would re-render, re-run the
     * effect, and spin forever.
     */
    setState((s) => (s.transport === 'polling' && s.connected
      ? s
      : { ...s, transport: 'polling', connected: true }));
    pollOnce();
    schedulePoll(base);

    /* While live, a tab returning to the foreground catches up at once rather
       than waiting out the interval it was throttled to in the background. */
    const onVisible = () => { if (document.visibilityState === 'visible') pollOnce(); };
    const onOnline = () => { backoffRef.current = 0; pollOnce(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      if (pollTimer.current) { clearTimeout(pollTimer.current); pollTimer.current = null; }
    };
  }, [enabled, livePolling, state.transport, pollOnce, schedulePoll]);

  /** Force an immediate catch-up (the Refresh button). */
  const refresh = useCallback(async () => {
    backoffRef.current = 0;
    await pollOnce();
  }, [pollOnce]);

  /** Ask the server to check the mailbox right now, then catch up. */
  const syncNow = useCallback(async () => {
    const res = await syncApi.now();
    await pollOnce();
    return res;
  }, [pollOnce]);

  return { ...state, refresh, syncNow, cursor: cursorRef.current };
}
