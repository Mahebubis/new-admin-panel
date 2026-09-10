// ===========================================================================
//  ResetNotice.jsx — the "your progress may have been reset" announcement.
//
//  Video progress was lost for the learners who were already on the portal, and
//  the only way to put it right is for each of them to re-tick the sessions
//  they have watched. That is a real ask, so the notice is not a toast in a
//  corner: it drops in over the page, dims everything behind it and cannot be
//  clicked away by accident — the button is the only way out.
//
//  Who sees it
//    Only a learner whose batch began BEFORE the cutoff, decided by the server
//    (`user.reset_notice`; see learn_batch_before in _bootstrap.php). Someone
//    starting on the 1st of September has no history to have lost.
//
//  How often
//    Once, per learner, per browser. It is an announcement, not a warning: a
//    modal that reappears on every page load stops being read by the second
//    time it is dismissed. The acknowledgement is keyed by user id so a shared
//    computer still shows it to the next person.
// ===========================================================================
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { Check, Hourglass } from './icons';
import './resetNotice.css';

const KEY = 'istudio_reset_notice_seen';

const seenBy = (id) => {
  try {
    return (JSON.parse(localStorage.getItem(KEY) || '[]') || []).includes(id);
  } catch {
    return false;
  }
};

const markSeen = (id) => {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    const next = Array.isArray(list) ? list : [];
    if (!next.includes(id)) next.push(id);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* private mode — it will simply be shown again */ }
};

export default function ResetNotice() {
  const { user } = useAuth();
  const id = user?.user_id || 0;
  const wanted = !!user?.reset_notice;

  const [open, setOpen] = useState(false);

  /* Held back a beat on purpose: dropping the panel in on the same frame the
     page paints reads as a flash of something broken, and the learner has not
     had time to see what it landed on top of. */
  useEffect(() => {
    if (!wanted || !id || seenBy(id)) return undefined;
    const t = setTimeout(() => setOpen(true), 550);
    return () => clearTimeout(t);
  }, [wanted, id]);

  useEffect(() => {
    if (!open) return undefined;
    const { body } = document;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
    };
  }, [open]);

  if (!open) return null;

  const close = () => { markSeen(id); setOpen(false); };

  return createPortal(
    /* No backdrop-click and no Escape: every other overlay in the portal
       closes on both, and here that is exactly the reflex that would dismiss
       this before it was read. */
    <div className="rn" role="alertdialog" aria-modal="true" aria-labelledby="rn-title">
      <div className="rn-panel">
        <span className="rn-flag">Important</span>

        <div className="rn-head">
          <span className="rn-ico"><Hourglass size={22} /></span>
          <h2 className="rn-title" id="rn-title">Your video progress may have been reset</h2>
        </div>

        <p className="rn-body">
          We request you to click on the <b>“Mark as Complete”</b> button for each session you
          have already watched, so that your progress is updated correctly.
        </p>

        <p className="rn-how">
          You will find it on every lesson — open the lesson, then use
          <b> ⋮ → Mark As Complete</b>, or let a video finish and choose
          <b> Mark as complete and next</b>.
        </p>

        <button type="button" className="rn-go" onClick={close} autoFocus>
          <Check size={17} /> Got it — I will update my sessions
        </button>
      </div>
    </div>,
    document.body,
  );
}
