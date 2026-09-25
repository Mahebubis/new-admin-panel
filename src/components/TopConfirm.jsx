/*
 * TopConfirm — a confirmation sheet that drops in from the top of the window.
 *
 * Replaces window.confirm() for actions that deserve a sentence of explanation:
 * the browser dialog cannot be styled, blocks the whole tab, and looks like a
 * security warning rather than part of the product.
 *
 * Usage:
 *   const [ask, setAsk] = useState(null);
 *   <TopConfirm
 *     open={!!ask}
 *     title="Copy this list into Kumo MTA?"
 *     message="A new Kumo list is created with these contacts. This list is not changed."
 *     confirmLabel="Copy to Kumo"
 *     tone="brand"                 // brand | danger | warn
 *     busy={busy}
 *     onConfirm={() => run(ask)}
 *     onCancel={() => setAsk(null)}
 *   />
 *
 * Escape cancels, the backdrop cancels, Enter confirms, and focus moves to the
 * confirm button so the keyboard path works without a mouse.
 */
import { useEffect, useRef } from 'react';

const TONES = {
  brand:  { ring: 'rgba(99,102,241,.35)',  grad: 'linear-gradient(135deg,#4f46e5,#7c3aed)', soft: 'rgba(99,102,241,.12)',  fg: '#4338ca' },
  danger: { ring: 'rgba(239,68,68,.32)',   grad: 'linear-gradient(135deg,#ef4444,#b91c1c)', soft: 'rgba(239,68,68,.12)',   fg: '#b91c1c' },
  warn:   { ring: 'rgba(245,158,11,.32)',  grad: 'linear-gradient(135deg,#f59e0b,#d97706)', soft: 'rgba(245,158,11,.14)',  fg: '#b45309' },
};

const ICONS = {
  brand:  <path d="m21.5 2.5-8 19-3.2-7.8L2.5 10.5z" />,
  danger: <><path d="M10.3 3.2 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  warn:   <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></>,
};

export default function TopConfirm({
  open, title, message, detail,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  tone = 'brand', busy = false, onConfirm, onCancel,
}) {
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel?.();
      if (e.key === 'Enter' && !busy) { e.preventDefault(); onConfirm?.(); }
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => btnRef.current?.focus(), 0);
    return () => { document.removeEventListener('keydown', onKey); clearTimeout(t); };
  }, [open, busy, onCancel, onConfirm]);

  if (!open) return null;
  const t = TONES[tone] || TONES.brand;

  return (
    <>
      <style>{`
        @keyframes tc_backdrop { from { opacity: 0 } to { opacity: 1 } }
        /* Slight overshoot on the way in — it reads as a physical sheet dropping
           into place rather than a box being switched on. */
        @keyframes tc_drop {
          from { transform: translate(-50%, -18px); opacity: 0 }
          to   { transform: translate(-50%, 0);     opacity: 1 }
        }
        @keyframes tc_sheen { from { transform: translateX(-120%) } to { transform: translateX(320%) } }
        .tc-backdrop { position: fixed; inset: 0; z-index: 4000; background: rgba(15,23,42,.38);
          animation: tc_backdrop .12s linear both; will-change: opacity; }
        .tc-sheet { position: fixed; top: 24px; left: 50%; z-index: 4001; width: min(560px, calc(100vw - 32px));
          border-radius: 18px; overflow: hidden; background: #fff; border: 1px solid rgba(255,255,255,.9);
          box-shadow: 0 30px 70px -28px rgba(15,23,42,.65), 0 2px 6px rgba(15,23,42,.08);
          animation: tc_drop .16s cubic-bezier(.2,.8,.3,1) both; will-change: transform, opacity;
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif; }
        .tc-bar { position: relative; height: 4px; overflow: hidden; }
        .tc-bar::after { content: ''; position: absolute; inset: 0; width: 34%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent);
          animation: tc_sheen .9s ease-out 1 both; }
        .tc-btn { border: 0; cursor: pointer; padding: 9px 16px; border-radius: 11px;
          font: 700 13px/1 'Plus Jakarta Sans', sans-serif; transition: transform .16s, filter .16s, background .16s; }
        .tc-btn:active { transform: translateY(1px) scale(.99); }
        .tc-btn:disabled { opacity: .6; cursor: not-allowed; }
        .tc-btn--ghost { background: #fff; color: #475569; border: 1px solid #e2e8f0; }
        .tc-btn--ghost:hover { background: #f8fafc; }
        .tc-btn--go:hover { filter: brightness(1.07); }
        .tc-btn:focus-visible { outline: 3px solid rgba(99,102,241,.45); outline-offset: 2px; }
        @keyframes tc_spin { to { transform: rotate(360deg) } }
        .tc-spin { animation: tc_spin .9s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .tc-sheet { animation: tc_backdrop .2s ease both; }
          .tc-bar::after { animation: none; }
        }
      `}</style>

      <div className="tc-backdrop" onClick={() => !busy && onCancel?.()} />

      <div className="tc-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="tc-bar" style={{ background: t.grad }} />
        <div style={{ display: 'flex', gap: 14, padding: '18px 20px 6px' }}>
          <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 13, display: 'grid', placeItems: 'center',
            background: t.soft, color: t.fg, boxShadow: `0 0 0 4px ${t.ring}` }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[tone] || ICONS.brand}</svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-.2px' }}>{title}</h3>
            {message && <p style={{ margin: '6px 0 0', fontSize: 13.2, lineHeight: 1.6, color: '#64748b' }}>{message}</p>}
            {detail && (
              <div style={{ marginTop: 10, padding: '9px 11px', borderRadius: 10, background: '#f8fafc',
                border: '1px solid #eef2f7', fontSize: 12.2, color: '#475569', lineHeight: 1.55 }}>{detail}</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, padding: '14px 20px 18px' }}>
          <button className="tc-btn tc-btn--ghost" onClick={() => onCancel?.()} disabled={busy}>{cancelLabel}</button>
          <button ref={btnRef} className="tc-btn tc-btn--go" onClick={() => onConfirm?.()} disabled={busy}
            style={{ background: t.grad, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: `0 10px 22px -12px ${t.ring}` }}>
            {busy && (
              <svg className="tc-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,.35)" strokeWidth="3" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
