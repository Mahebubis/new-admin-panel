/**
 * Shared "are you sure?" modal — replaces native window.confirm() everywhere in this
 * feature with a styled, animated popup. Centered card, fade+pop-in animation, an
 * icon that colors itself by `tone` (danger = red trash, warn = amber alert).
 */
export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  tone = 'danger', busy = false, onConfirm, onCancel,
}) {
  if (!open) return null;
  const colors = tone === 'warn'
    ? { bg: '#fef3c7', stroke: '#d97706', btn: '#d97706' }
    : { bg: '#fee2e2', stroke: '#dc2626', btn: '#dc2626' };

  return (
    <div
      onClick={() => !busy && onCancel()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'nc_confirm_fade_in .15s ease' }}
    >
      <style>{`
        @keyframes nc_confirm_fade_in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nc_confirm_pop_in { from { opacity: 0; transform: scale(.94) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, padding: '26px 26px 22px', width: 380, maxWidth: '90vw', boxShadow: '0 24px 60px rgba(15,23,42,.28)', animation: 'nc_confirm_pop_in .18s cubic-bezier(.16,1,.3,1)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          {tone === 'warn' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.stroke} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.stroke} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
            </svg>
          )}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.55, marginBottom: 22 }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            disabled={busy}
            onClick={onCancel}
            style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#334155', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
          >
            {cancelLabel}
          </button>
          <button
            disabled={busy}
            onClick={onConfirm}
            style={{ padding: '9px 18px', border: 'none', background: colors.btn, color: '#fff', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? .75 : 1, fontFamily: 'inherit' }}
          >
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
