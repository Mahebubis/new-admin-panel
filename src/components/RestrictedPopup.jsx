import { useEffect } from 'react';

/**
 * RestrictedPopup — shown when user tries to access a page or feature
 * they don't have permission for. Matches admin-panel indigo/violet theme.
 *
 * Props:
 *   open       : boolean
 *   onClose    : () => void    (Go back / dismiss)
 *   onHome     : () => void    (optional; Navigate to dashboard)
 *   title      : string        (default: "Access Restricted")
 *   message    : string        (default sensible copy)
 *   permission : string        (optional; shown as a small chip)
 */
export default function RestrictedPopup({
  open,
  onClose,
  onHome,
  title = 'Access Restricted',
  message = "You don't have permission to view this section. Please contact a super admin to request access.",
  permission,
}) {
  // ESC to close
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'rp-fade 160ms ease-out',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes rp-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes rp-pop  { from { opacity: 0; transform: translateY(8px) scale(.96) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes rp-pulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.06) } }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[420px] rounded-[20px] overflow-hidden bg-white"
        style={{
          boxShadow: '0 25px 60px -15px rgba(79,70,229,0.35), 0 12px 28px rgba(0,0,0,0.12)',
          border: '1.5px solid #e2e8f0',
          animation: 'rp-pop 220ms cubic-bezier(.16,1,.3,1)',
        }}
      >
        {/* Gradient header */}
        <div
          className="relative px-6 pt-7 pb-5"
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 55%, #7c3aed 100%)',
          }}
        >
          {/* decorative circles */}
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20"
            style={{ background: '#a78bfa', transform: 'translate(30%,-40%)' }} />
          <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full opacity-15"
            style={{ background: '#c4b5fd', transform: 'translate(-30%,40%)' }} />

          {/* close button */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition"
            style={{
              background: 'rgba(255,255,255,0.18)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.3)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
          >
            <i className="fas fa-times" />
          </button>

          {/* lock icon */}
          <div className="relative flex justify-center">
            <div
              className="w-20 h-20 rounded-[22px] flex items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.18)',
                border: '2px solid rgba(255,255,255,0.4)',
                animation: 'rp-pulse 2.4s ease-in-out infinite',
              }}
            >
              <i className="fas fa-lock text-white" style={{ fontSize: 30 }} />
            </div>
          </div>

          <h3
            className="text-center mt-4 text-white"
            style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}
          >
            {title}
          </h3>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p
            className="text-center"
            style={{ fontSize: 13.5, lineHeight: 1.6, color: '#475569' }}
          >
            {message}
          </p>

          {permission && (
            <div className="flex justify-center mt-4">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{
                  background: 'rgba(99,102,241,0.1)',
                  color: '#4f46e5',
                  fontSize: 11.5,
                  fontWeight: 600,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              >
                <i className="fas fa-key text-[10px]" />
                {permission}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2.5 mt-6">
            {onHome && (
              <button
                onClick={onHome}
                className="flex-1 h-11 rounded-xl font-semibold transition"
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  fontSize: 13,
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#e2e8f0')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#f1f5f9')}
              >
                <i className="fas fa-home mr-2" />
                Go to Dashboard
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-xl font-semibold text-white transition"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                fontSize: 13,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(79,70,229,0.35)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.07)')}
              onMouseLeave={(e) => (e.currentTarget.style.filter = 'brightness(1)')}
            >
              <i className="fas fa-arrow-left mr-2" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}