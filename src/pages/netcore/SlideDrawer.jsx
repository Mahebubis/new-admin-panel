import { useEffect } from 'react';

/* Reusable right-side slide-in drawer — CSS transform transition + backdrop.
   Matches the panel look used throughout the Netcore screenshots. */
export default function SlideDrawer({ open, onClose, width = 560, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <style>{`
        .nc-drawer-backdrop {
          position: fixed; inset: 0; background: rgba(15,23,42,.45); z-index: 900;
          opacity: 0; pointer-events: none; transition: opacity .22s ease;
        }
        .nc-drawer-backdrop.open { opacity: 1; pointer-events: auto; }
        .nc-drawer-panel {
          position: fixed; top: 0; right: 0; bottom: 0; width: ${width}px; max-width: 92vw;
          background: #fff; z-index: 901; box-shadow: -8px 0 32px rgba(0,0,0,.18);
          transform: translateX(100%); transition: transform .26s cubic-bezier(.4,0,.2,1);
          display: flex; flex-direction: column; font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .nc-drawer-panel.open { transform: translateX(0); }
      `}</style>
      <div className={`nc-drawer-backdrop${open ? ' open' : ''}`} onClick={onClose} />
      <div className={`nc-drawer-panel${open ? ' open' : ''}`}>
        {children}
      </div>
    </>
  );
}
