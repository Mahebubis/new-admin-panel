// ===========================================================================
//  SupportFab.jsx — the support button that follows the learner everywhere.
//
//  Why it exists
//    Help used to live two taps deep: open the avatar menu, find Support. A
//    learner who is stuck on a lesson is exactly the person least willing to
//    go hunting through a profile menu, so the door is now on the screen at
//    all times.
//
//  Draggable, and it stays where it is put
//    Anywhere on the page is somewhere it could be in the way — over a quiz
//    option, over the player's controls, over the syllabus on a phone. So it
//    is dragged with a finger or a mouse and, on release, snaps to whichever
//    side of the screen is nearer, the way a chat head does. The side and the
//    height are remembered in localStorage, so it is still where the learner
//    left it on the next page and after a refresh.
//
//  Closing it
//    The × dismisses it for this page load ONLY — deliberately not persisted.
//    A learner who swats it away while reading gets it back on the next
//    refresh, rather than losing the support door for good and having to
//    discover a setting to bring it back.
//
//  Touch and mouse are one code path: pointer events with capture, a 6px
//  threshold that separates a drag from a tap, and `touch-action: none` so a
//  drag never scrolls the page underneath it.
// ===========================================================================
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Support } from './icons';
import './supportFab.css';

const KEY = 'istudio_support_fab';
const MARGIN = 16;          // the gap it keeps from the edges when it snaps
const DRAG_MIN = 6;         // px of movement before a tap counts as a drag

/* The button's size, and the breakpoint it changes at, are the two numbers
   supportFab.css also carries (--fab-size). They live here as well because
   the resting position is arithmetic, not layout — keep the pair in step. */
const PHONE = 720;
const sizeFor = (w) => (w <= PHONE ? 52 : 56);

/** Where it sits: which side, and how far down as a 0–1 fraction. */
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw) return null;
    const y = Number(raw.y);
    return {
      side: raw.side === 'left' ? 'left' : 'right',
      y: Number.isFinite(y) ? Math.min(1, Math.max(0, y)) : 0.78,
    };
  } catch {
    return null;                                  // corrupt entry, or private mode
  }
}

const save = (spot) => {
  try { localStorage.setItem(KEY, JSON.stringify(spot)); } catch { /* private mode */ }
};

export default function SupportFab() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  /* Sits low on the right by default — out of the header's way, and on the
     thumb's side of a phone. */
  const [spot, setSpot] = useState(() => load() || { side: 'right', y: 0.78 });
  const [gone, setGone] = useState(false);
  const [drag, setDrag] = useState(null);         // {x, y, dx, dy} while dragging
  const [moved, setMoved] = useState(false);

  /* The resting place is arithmetic on the viewport, so the viewport is state:
     a resize or a phone turning sideways would otherwise leave the button
     parked off the edge of the screen. */
  const [view, setView] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setView({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const size = sizeFor(view.w);
  const room = Math.max(1, view.h - size - MARGIN * 2);

  /* Always left/top in pixels, never `right` — the snap only animates if it
     transitions the same property the drag was moving. */
  const rest = {
    x: spot.side === 'left' ? MARGIN : Math.max(MARGIN, view.w - size - MARGIN),
    y: Math.round(MARGIN + spot.y * room),
  };
  const at = drag || rest;

  const onDown = (e) => {
    setDrag({ x: at.x, y: at.y, dx: e.clientX - at.x, dy: e.clientY - at.y });
    setMoved(false);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onMove = (e) => {
    if (!drag) return;
    const x = e.clientX - drag.dx;
    const y = e.clientY - drag.dy;
    if (Math.abs(x - drag.x) > DRAG_MIN || Math.abs(y - drag.y) > DRAG_MIN) setMoved(true);
    setDrag({
      ...drag,
      x: Math.min(view.w - size - 4, Math.max(4, x)),
      y: Math.min(view.h - size - 4, Math.max(4, y)),
    });
  };

  const onUp = (e) => {
    e.currentTarget?.releasePointerCapture?.(e.pointerId);
    if (!drag) return;
    setDrag(null);

    if (!moved) {                                 // a tap, not a drag
      navigate('/support');
      return;
    }

    /* Snap to the nearer side: the middle of the screen is no place to leave
       a button parked over the content. */
    const next = {
      side: drag.x + size / 2 < view.w / 2 ? 'left' : 'right',
      y: Math.min(1, Math.max(0, (drag.y - MARGIN) / room)),
    };
    setSpot(next);
    save(next);
  };

  /* Already on the desk: the button would only offer the page being read. */
  if (gone || pathname === '/support') return null;

  return createPortal(
    <div
      className={`fab fab-${spot.side}${drag ? ' fab-dragging' : ''}`}
      style={{ left: `${at.x}px`, top: `${at.y}px` }}
    >
      <button
        type="button"
        className="fab-btn"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => setDrag(null)}
        /* Pointer taps are answered in onUp, the only place that knows a drag
           from a tap. `detail === 0` is a click the keyboard raised, and that
           one still has to go somewhere. */
        onClick={(e) => { if (e.detail === 0) navigate('/support'); }}
        aria-label="Support — press to open, drag to move"
        title="Need help? Open Support"
      >
        <Support size={24} />
      </button>

      <span className="fab-label" aria-hidden="true">Need help?</span>

      {/* Dismisses it for this page load only — a refresh brings it back. */}
      <button
        type="button"
        className="fab-x"
        onClick={() => setGone(true)}
        aria-label="Hide the support button until the page is reloaded"
        title="Hide until reload"
      >
        ×
      </button>
    </div>,
    document.body,
  );
}
