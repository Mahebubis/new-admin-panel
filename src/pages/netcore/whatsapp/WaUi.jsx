import { WA } from './waShared';

/*
 * The small shared components of the WhatsApp builder: toggles, badges, the channel icon and
 * the inline notice used for the "why isn't this delivering" guidance that this integration
 * genuinely needs surfaced (missing API key, unapproved template, the 24-hour window).
 *
 * Components live here and plain constants/formatters live in waShared.js — the split keeps
 * Fast Refresh working, which this project's eslint config enforces.
 */

export const Toggle = ({ on, onClick, disabled }) => (
  <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled}
    style={{ width: 38, height: 21, borderRadius: 999, border: 'none', background: on ? WA.green : '#cbd5e1', position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0, opacity: disabled ? .5 : 1, padding: 0 }}>
    <span style={{ position: 'absolute', top: 2, left: on ? 19 : 2, width: 17, height: 17, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
  </button>
);

export const Radio = ({ on, disabled }) => (
  <span style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${on ? WA.primary : '#cbd5e1'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: disabled ? .5 : 1 }}>
    {on && <span style={{ width: 8, height: 8, borderRadius: '50%', background: WA.primary }} />}
  </span>
);

export function Spinner({ size = 32 }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', border: '3px solid #c4b5fd', borderTopColor: '#4f46e5', animation: 'nc_spin 0.85s linear infinite' }} />;
}

export const WhatsAppIcon = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.48-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.8h-.02a9.8 9.8 0 0 1-4.99-1.37l-.36-.21-3.71.97.99-3.62-.23-.37a9.79 9.79 0 0 1-1.5-5.22c0-5.41 4.4-9.81 9.82-9.81a9.75 9.75 0 0 1 6.94 2.88 9.74 9.74 0 0 1 2.87 6.94c0 5.41-4.4 9.81-9.81 9.81M20.52 3.45A11.66 11.66 0 0 0 12.05 0C5.6 0 .35 5.25.35 11.7c0 2.06.54 4.08 1.56 5.85L.25 24l6.59-1.73a11.66 11.66 0 0 0 5.2 1.24h.01c6.45 0 11.7-5.25 11.7-11.7 0-3.13-1.22-6.07-3.43-8.28" />
  </svg>
);

const CAMPAIGN_BADGE = {
  draft:     { bg: '#ede9fe', fg: '#6d28d9', label: 'DRAFT' },
  scheduled: { bg: '#fef3c7', fg: '#b45309', label: 'SCHEDULED' },
  running:   { bg: '#dbeafe', fg: '#1d4ed8', label: 'RUNNING' },
  sent:      { bg: '#dcfce7', fg: '#15803d', label: 'SENT' },
  suspended: { bg: '#fed7aa', fg: '#c2410c', label: 'SUSPENDED' },
  failed:    { bg: '#fee2e2', fg: '#dc2626', label: 'FAILED' },
};

export function Badge({ status }) {
  const b = CAMPAIGN_BADGE[status] || CAMPAIGN_BADGE.draft;
  return <span style={{ background: b.bg, color: b.fg, fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999, letterSpacing: '.4px', whiteSpace: 'nowrap' }}>{b.label}</span>;
}

const APPROVAL_BADGE = {
  approved: { bg: '#dcfce7', fg: '#15803d', label: 'APPROVED' },
  pending:  { bg: '#fef3c7', fg: '#b45309', label: 'PENDING' },
  rejected: { bg: '#fee2e2', fg: '#dc2626', label: 'REJECTED' },
  unknown:  { bg: '#f1f5f9', fg: '#64748b', label: 'UNKNOWN' },
};

export function ApprovalBadge({ status }) {
  const b = APPROVAL_BADGE[status] || APPROVAL_BADGE.unknown;
  return (
    <span title={status === 'approved'
      ? 'Meta has approved this template — it can be sent to anyone'
      : 'WhatsApp only delivers approved templates outside the 24-hour service window'}
      style={{ background: b.bg, color: b.fg, fontSize: 9.5, fontWeight: 800, padding: '3px 8px', borderRadius: 999, letterSpacing: '.3px', whiteSpace: 'nowrap' }}>
      {b.label}
    </span>
  );
}

const CATEGORY_COLORS = {
  marketing:      { bg: '#fce7f3', fg: '#be185d' },
  utility:        { bg: '#e0f2fe', fg: '#0369a1' },
  authentication: { bg: '#ede9fe', fg: '#6d28d9' },
};

export function CategoryChip({ category }) {
  const c = CATEGORY_COLORS[category] || CATEGORY_COLORS.utility;
  return <span style={{ background: c.bg, color: c.fg, fontSize: 9.5, fontWeight: 800, padding: '3px 8px', borderRadius: 5, letterSpacing: '.3px', textTransform: 'uppercase' }}>{category}</span>;
}

export function Notice({ tone = 'info', title, children, style }) {
  const tones = {
    info:    { bg: '#eff6ff', border: '#bfdbfe', fg: '#1d4ed8' },
    warn:    { bg: '#fff7ed', border: '#fed7aa', fg: '#c2410c' },
    danger:  { bg: '#fef2f2', border: '#fecaca', fg: '#dc2626' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', fg: '#15803d' },
  };
  const t = tones[tone] || tones.info;
  return (
    <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: '11px 14px', ...style }}>
      {title && <div style={{ fontSize: 12, fontWeight: 800, color: t.fg, marginBottom: children ? 4 : 0 }}>{title}</div>}
      {children && <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.55 }}>{children}</div>}
    </div>
  );
}
