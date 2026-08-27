// ===========================================================================
//  icons.jsx — the portal's icon set, inline.
//
//  Hand-rolled rather than pulled from a library: there are barely twenty of
//  them, they all share one 24-grid and one 1.8 stroke, and inlining means the
//  header renders on the first paint with no icon-font flash.
// ===========================================================================

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

const Icon = ({ children, size = 20, strokeWidth, ...rest }) => (
  <svg {...base} width={size} height={size} strokeWidth={strokeWidth ?? base.strokeWidth} {...rest}>
    {children}
  </svg>
);

export const Search   = (p) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></Icon>;
export const Moon     = (p) => <Icon {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></Icon>;
export const Sun      = (p) => <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>;
export const Bell     = (p) => <Icon {...p}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></Icon>;
export const ChevronDown  = (p) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>;
export const ChevronRight = (p) => <Icon {...p}><path d="m9 6 6 6-6 6" /></Icon>;
export const ChevronLeft  = (p) => <Icon {...p}><path d="m15 6-6 6 6 6" /></Icon>;
export const ChevronUp    = (p) => <Icon {...p}><path d="m6 15 6-6 6 6" /></Icon>;
export const ArrowRight   = (p) => <Icon {...p}><path d="M5 12h14M13 5l7 7-7 7" /></Icon>;
export const Bookmark = (p) => <Icon {...p}><path d="M6 4h12v17l-6-4.2L6 21Z" /></Icon>;
export const Expand   = (p) => <Icon {...p}><path d="M9 3H3v6M15 21h6v-6M21 9V3h-6M3 15v6h6" /></Icon>;
export const Kebab    = (p) => <Icon {...p}><circle cx="12" cy="5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" /></Icon>;
export const Check    = (p) => <Icon {...p}><path d="m4 12.5 5 5L20 6.5" /></Icon>;
export const CheckCircle = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="m8 12.2 2.6 2.6L16 9.4" /></Icon>;
export const SkipNext = (p) => <Icon {...p}><path d="M5 5v14l10-7Z" /><path d="M19 5v14" /></Icon>;
export const Video    = (p) => <Icon {...p}><rect x="2.5" y="6" width="13" height="12" rx="2.5" /><path d="m16.5 10.5 5-3v9l-5-3Z" /></Icon>;
export const Article  = (p) => <Icon {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M8 8h8M8 12h6" /></Icon>;
export const Quiz     = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.4" /><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none" /></Icon>;
export const Pdf      = (p) => <Icon {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5" /></Icon>;
export const Form     = (p) => <Icon {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></Icon>;
export const Play     = (p) => <Icon {...p}><path d="M7 4.5v15l12-7.5Z" /></Icon>;
export const Globe    = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z" /></Icon>;
export const Logout   = (p) => <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></Icon>;
export const Eye      = (p) => <Icon {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></Icon>;
export const EyeOff   = (p) => <Icon {...p}><path d="M10.6 6.2A9.9 9.9 0 0 1 12 5c6.4 0 10 7 10 7a17.7 17.7 0 0 1-3.4 4.3M6.4 6.7A17.6 17.6 0 0 0 2 12s3.6 7 10 7c1.7 0 3.2-.5 4.5-1.2" /><path d="m3 3 18 18" /></Icon>;
export const Attachment = (p) => <Icon {...p}><path d="M20 11.5 12.3 19a5 5 0 0 1-7-7l8-8a3.4 3.4 0 1 1 4.8 4.8l-7.9 7.9a1.8 1.8 0 1 1-2.5-2.5l7.2-7.2" /></Icon>;
export const Clock    = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 1.8" /></Icon>;
export const Grid     = (p) => <Icon {...p}><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" /></Icon>;
export const Star     = (p) => <Icon {...p}><path d="m12 3.5 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" /></Icon>;
export const Help     = (p) => <Icon {...p}><path d="M18.4 5.6a9 9 0 1 1-12.8 0 9 9 0 0 1 12.8 0Z" /><path d="M9.8 9.4a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .9-1 1.6" /><circle cx="12" cy="16.8" r=".9" fill="currentColor" stroke="none" /></Icon>;
export const User     = (p) => <Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 20.5a8 8 0 0 1 16 0" /></Icon>;
export const Book     = (p) => <Icon {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v14H6.5A2.5 2.5 0 0 0 4 19.5Z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></Icon>;
/* Coming-soon rows: the padlock on the row, the hourglass on the stage. */
export const Lock     = (p) => <Icon {...p}><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></Icon>;
export const Hourglass = (p) => <Icon {...p}><path d="M7 3h10M7 21h10" /><path d="M8 3v3.5c0 2 4 3.6 4 5.5s-4 3.5-4 5.5V21M16 3v3.5c0 2-4 3.6-4 5.5s4 3.5 4 5.5V21" /></Icon>;

/** The "nothing here" figure the learner site shows on every empty screen. */
export const EmptyFigure = ({ size = 170 }) => (
  <svg width={size} height={size * 0.95} viewBox="0 0 200 190" fill="none" aria-hidden="true">
    <ellipse cx="100" cy="172" rx="52" ry="9" fill="currentColor" opacity=".08" />
    <path d="M62 60c0-24 17-42 38-42s38 18 38 42-14 34-14 52H76c0-18-14-28-14-52Z" fill="currentColor" opacity=".10" />
    <rect x="76" y="112" width="48" height="58" rx="10" fill="currentColor" opacity=".22" />
    <circle cx="100" cy="58" r="26" fill="currentColor" opacity=".30" />
    <path d="M90 54h4M106 54h4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".6" />
    <path d="M92 68c4-3 12-3 16 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".6" />
  </svg>
);

/** Small type-to-icon helper used by the syllabus and the player. */
export function LessonIcon({ type, size = 17, ...rest }) {
  switch (type) {
    case 'article': return <Article size={size} {...rest} />;
    case 'pdf':     return <Pdf size={size} {...rest} />;
    case 'quiz':    return <Quiz size={size} {...rest} />;
    case 'form':    return <Form size={size} {...rest} />;
    default:        return <Video size={size} {...rest} />;
  }
}

/* ── the video player's own controls ──────────────────────────────────────
   Kept here with the rest so the player never pulls in an icon font, and so
   the whole set keeps one 24-grid and one stroke weight. The "5" in the two
   skip icons is real text rather than a path: it stays crisp at every size,
   and it is the number the button actually seeks by. */
export const Pause    = (p) => <Icon {...p}><path d="M9 4.5v15M15 4.5v15" strokeWidth="2.4" /></Icon>;
export const Back5    = (p) => (
  <Icon {...p}>
    <path d="M3.6 12a8.4 8.4 0 1 0 2.5-6" />
    <path d="M3 4v5h5" />
    <text x="12" y="15.6" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="currentColor" stroke="none">5</text>
  </Icon>
);
export const Fwd5     = (p) => (
  <Icon {...p}>
    <path d="M20.4 12a8.4 8.4 0 1 1-2.5-6" />
    <path d="M21 4v5h-5" />
    <text x="12" y="15.6" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="currentColor" stroke="none">5</text>
  </Icon>
);
export const Volume   = (p) => <Icon {...p}><path d="M4 9.5h3.2L12 5.5v13L7.2 14.5H4Z" /><path d="M15.8 9.4a3.6 3.6 0 0 1 0 5.2M18.4 6.8a7.3 7.3 0 0 1 0 10.4" /></Icon>;
export const VolumeX  = (p) => <Icon {...p}><path d="M4 9.5h3.2L12 5.5v13L7.2 14.5H4Z" /><path d="m16.5 9.5 5 5M21.5 9.5l-5 5" /></Icon>;
export const Compress = (p) => <Icon {...p}><path d="M9 3v6H3M15 21v-6h6M21 9h-6V3M3 15h6v6" /></Icon>;
/* The dot that marks a lesson the learner has already been inside. */
export const History  = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.2 1.9" /></Icon>;

/* ── documents, uploads and the support desk ─────────────────────────────── */
export const Download     = (p) => <Icon {...p}><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" /><path d="M4 20h16" /></Icon>;
export const ExternalLink = (p) => <Icon {...p}><path d="M14 4h6v6" /><path d="m20 4-9 9" /><path d="M18 14v5a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 19V7.8A1.8 1.8 0 0 1 5.8 6H11" /></Icon>;
export const Upload       = (p) => <Icon {...p}><path d="M12 16V4M7.5 8.5 12 4l4.5 4.5" /><path d="M4 20h16" /></Icon>;
export const Send         = (p) => <Icon {...p}><path d="M21 3 10.5 13.5" /><path d="M21 3 14.5 21l-4-7.5L3 9.5Z" /></Icon>;
export const Ticket       = (p) => <Icon {...p}><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v1.8a2 2 0 0 0 0 3.4v1.8A1.5 1.5 0 0 1 18.5 17h-13A1.5 1.5 0 0 1 4 15.5v-1.8a2 2 0 0 0 0-3.4Z" /><path d="M13 7v10" /></Icon>;
export const Trash        = (p) => <Icon {...p}><path d="M4 7h16M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7" /><path d="M6.5 7 7.4 19a1.8 1.8 0 0 0 1.8 1.7h5.6a1.8 1.8 0 0 0 1.8-1.7L17.5 7" /></Icon>;
export const Support      = (p) => <Icon {...p}><path d="M20.5 12.5a8.5 8.5 0 1 0-3.2 6.6L21 20l-1-3.4a8.4 8.4 0 0 0 .5-4.1Z" /><path d="M9.8 9.6a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .9-1 1.6" /><circle cx="12" cy="16.4" r=".85" fill="currentColor" stroke="none" /></Icon>;
