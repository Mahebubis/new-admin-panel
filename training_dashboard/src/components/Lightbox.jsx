// ===========================================================================
//  Lightbox.jsx — tap an image, see it big.
//
//  Used by the quiz stage for question and option images, which are often
//  diagrams or code screenshots that are unreadable at option size.
//
//  Sized to 95% of the viewport HEIGHT, per the design ask, with width free to
//  follow the aspect ratio — a tall screenshot then fills the screen instead of
//  being letterboxed inside a fixed box. On a phone the constraint flips to
//  width, because a portrait viewport makes 95vh taller than the image can ever
//  usefully be.
// ===========================================================================
import React, { useEffect } from 'react';
import './lightbox.css';

export default function Lightbox({ src, alt = '', onClose }) {
  useEffect(() => {
    if (!src) return undefined;

    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);

    /* Freeze the page behind it, and pay back the scrollbar width so the
       content underneath does not jump sideways as the overlay opens. */
    const { body } = document;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;

    return () => {
      document.removeEventListener('keydown', onKey);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
    };
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div className="lb" role="dialog" aria-modal="true" onClick={onClose}>
      <button type="button" className="lb-x" onClick={onClose} aria-label="Close">×</button>
      {/* stopPropagation so clicking the picture itself does not dismiss it —
          only the backdrop around it does. */}
      <img className="lb-img" src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
