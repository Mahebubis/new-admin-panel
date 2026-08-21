// ===========================================================================
//  LmsStyles.jsx — the small UI primitives every LMS screen reuses.
//  The design tokens themselves live in lmsTheme.js.
// ===========================================================================
import React, { useEffect, useRef, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

/** The Learnyst loading screen — three bouncing dots + "Loading… / Please wait". */
export function Loader({ inline = false, title = 'Loading...', sub = 'Please wait' }) {
  return (
    <div className={`lms-loading${inline ? ' inline' : ''}`}>
      <div className="lms-dots"><i /><i /><i /></div>
      <div className="lms-loading-title">{title}</div>
      <div className="lms-loading-sub">{sub}</div>
    </div>
  );
}

export function Pill({ tone = 'grey', children }) {
  return <span className={`lms-pill ${tone}`}>{children}</span>;
}

export function Empty({ icon, title, message, action }) {
  return (
    <div className="lms-empty">
      {icon && <div className="lms-empty-ico">{icon}</div>}
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function Toggle({ on, onChange, disabled }) {
  return (
    <button
      type="button"
      className={`lms-toggle${on ? ' on' : ''}`}
      disabled={disabled}
      aria-pressed={!!on}
      onClick={() => !disabled && onChange(!on)}
    />
  );
}

/* How many overlays are currently holding the page still. Counted rather than
   set/unset, because a Confirm opened on top of a Drawer would otherwise
   release the lock on ITS close and hand the wheel back to the page while the
   drawer underneath is still up. */
let scrollLocks = 0;

/**
 * Freezes the page behind an overlay and closes it on Escape. Without the
 * freeze the wheel scrolls the page under the dialog once the dialog's own
 * body reaches its end, which reads as "the popup won't scroll".
 */
function useOverlay(open, onClose) {
  /* Callers pass an inline arrow for onClose, so its identity changes on every
     render. Reading it through a ref keeps the effect keyed on "open" alone —
     otherwise the lock would be released and re-taken on each render, and the
     page's scrollbar would flicker in and out underneath the dialog. */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') closeRef.current?.(); };
    document.addEventListener('keydown', h);

    const { body } = document;
    if (scrollLocks === 0) {
      // Compensate for the scrollbar we're about to remove so the page
      // underneath doesn't visibly jump sideways as the dialog opens.
      const gap = window.innerWidth - document.documentElement.clientWidth;
      body.dataset.lmsScroll = body.style.overflow;
      body.dataset.lmsPad = body.style.paddingRight;
      body.style.overflow = 'hidden';
      if (gap > 0) body.style.paddingRight = `${gap}px`;
    }
    scrollLocks++;

    return () => {
      document.removeEventListener('keydown', h);
      scrollLocks--;
      if (scrollLocks === 0) {
        body.style.overflow = body.dataset.lmsScroll || '';
        body.style.paddingRight = body.dataset.lmsPad || '';
        delete body.dataset.lmsScroll;
        delete body.dataset.lmsPad;
      }
    };
  }, [open]);
}

/** Right-hand slide-over used by every create/edit form in the LMS. */
export function Drawer({ open, title, subtitle, onClose, children, footer, width }) {
  useOverlay(open, onClose);

  if (!open) return null;
  return (
    <>
      <div className="lms-backdrop" onClick={onClose} />
      <aside className="lms-drawer" style={width ? { width } : undefined} role="dialog" aria-modal="true">
        <div className="lms-drawer-head">
          <div>
            <div className="lms-drawer-title">{title}</div>
            {subtitle && <div className="lms-drawer-sub">{subtitle}</div>}
          </div>
          <button className="lms-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="lms-drawer-body">{children}</div>
        {footer && <div className="lms-drawer-foot">{footer}</div>}
      </aside>
    </>
  );
}

export function Modal({ open, title, onClose, children, footer, width }) {
  useOverlay(open, onClose);

  if (!open) return null;
  return (
    <>
      <div className="lms-backdrop" onClick={onClose} />
      <div className="lms-modal" style={width ? { width } : undefined} role="dialog" aria-modal="true">
        <div className="lms-drawer-head">
          <div className="lms-drawer-title">{title}</div>
          <button className="lms-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="lms-drawer-body">{children}</div>
        {footer && <div className="lms-drawer-foot">{footer}</div>}
      </div>
    </>
  );
}

/**
 * Destructive-action confirm. `danger` swaps the primary button to red — used
 * for every delete so nothing in the LMS is removed on a single stray click.
 */
export function Confirm({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel, danger = true }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setBusy(false); }, [open]);
  if (!open) return null;

  return (
    <Modal
      open
      title={title}
      onClose={onCancel}
      width={440}
      footer={
        <>
          <button className="lms-btn lms-btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            className={`lms-btn ${danger ? 'lms-btn-red' : 'lms-btn-dark'}`}
            disabled={busy}
            onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 14 }}>
        {danger && (
          <div style={{
            width: 40, height: 40, borderRadius: 999, flexShrink: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'var(--lms-red-soft)', color: 'var(--lms-red-dark)',
          }}>
            <AlertTriangle size={19} />
          </div>
        )}
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: 'var(--lms-text-2)' }}>{message}</p>
      </div>
    </Modal>
  );
}
