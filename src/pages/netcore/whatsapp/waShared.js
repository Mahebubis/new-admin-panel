/*
 * Constants, styling tokens and formatters for the WhatsApp campaign builder.
 *
 * Deliberately JSX-free and kept separate from WaUi.jsx (which holds the shared components):
 * mixing component and non-component exports in one file breaks Fast Refresh, which this
 * project's eslint config enforces.
 *
 * The visual language matches the existing /netcore email builder (Plus Jakarta Sans,
 * #1e3a8a primary, the same card/input/toggle shapes) so the two channels read as one
 * product — WhatsApp green appears only where the channel itself is being identified (chrome,
 * message bubbles, send buttons), never as a second primary.
 */

export const WA_API      = '/api/whatsapp/wa_campaigns.php';
export const WA_TPL_API  = '/api/whatsapp/wa_templates.php';
export const WA_SET_API  = '/api/whatsapp/wa_settings.php';
export const WA_INBOX_API = '/api/whatsapp/wa_inbox.php';
export const SEG_API     = '/api/netcore/segments.php';
export const LISTS_API   = '/api/lists/lists.php';
export const ATTR_API    = '/api/attributes/attributes.php';

export const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

/* The wa_settings.php version this build needs. public/react-api deploys separately from the
   React bundle, so the Settings page compares the two and says so when the backend is older —
   otherwise a field you filled in is silently ignored with no visible reason. Keep in step with
   WA_API_VERSION in whatsapp/lib/config.php. */
export const WA_EXPECTED_API_VERSION = 7;

export const WA = {
  green: '#25D366',
  greenDark: '#128C7E',
  greenInk: '#075E54',
  bubble: '#DCF8C6',
  chat: '#ECE5DD',
  primary: '#1e3a8a',
};

export const inp = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
  fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box',
};
export const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 };
export const card  = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 18 };

/* ── formatters ────────────────────────────────────────────────────────────────────── */

export const n0 = v => Number(v || 0).toLocaleString();

export function fmtDt(s) {
  if (!s) return 'NA';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d.getTime())) return s;
  const pad = n => String(n).padStart(2, '0');
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  return `${M} ${pad(d.getDate())}, ${d.getFullYear()} ${pad(d.getHours() % 12 || 12)}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

export function fmtDate(s) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d.getTime())) return s;
  const pad = n => String(n).padStart(2, '0');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()}`;
}

/* ── Live Chat formatters ───────────────────────────────────────────────────────────────
   The backend hands back MySQL DATETIME ('2026-08-06 14:32:11') in the server's timezone;
   `new Date('… …')` is invalid in Safari, hence the T-substitution everywhere below. */

const asDate = s => {
  if (!s) return null;
  const d = new Date(String(s).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = n => String(n).padStart(2, '0');

/** Clock time under a chat bubble. */
export function fmtChatTime(s) {
  const d = asDate(s);
  if (!d) return '';
  return `${d.getHours() % 12 || 12}:${pad2(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** WhatsApp's own rule for the timestamp on a conversation row: time today, "Yesterday", then
 *  weekday inside the last week, then a date. */
export function fmtListTime(s) {
  const d = asDate(s);
  if (!d) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((startOfToday - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (days <= 0) return fmtChatTime(s);
  if (days === 1) return 'Yesterday';
  if (days < 7) return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
}

/** The sticky pill between days in the message list. */
export function fmtDayDivider(s) {
  const d = asDate(s);
  if (!d) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((startOfToday - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (days <= 0) return 'TODAY';
  if (days === 1) return 'YESTERDAY';
  return `${pad2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Calendar day key, used to decide where a divider goes. */
export function dayKey(s) {
  const d = asDate(s);
  return d ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : '';
}

/** "23h 41m left" — the remaining free-form window, which is the single most consequential
 *  number on this screen: at zero, nothing but an approved template will be delivered. */
export function fmtWindow(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  if (s <= 0) return 'closed';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

export function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '#';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/* Deterministic avatar colour so the same contact keeps the same swatch across reloads —
   a stable colour is a surprisingly strong scanning cue in a long list. */
const AVATAR_COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#14b8a6'];
export function avatarColor(seed) {
  const s = String(seed || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function fmtBytes(n) {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

/* Client-side preview of the same normalization the server applies (wa_normalize_phone() in
   whatsapp/lib/WaAudienceResolver.php) — used purely to show an admin what a number they typed
   will become. The server always re-normalizes; this never decides anything on its own. */
export function previewNormalizedPhone(raw, cc = '91') {
  const hadPlus = String(raw || '').trim().startsWith('+');
  let digits = String(raw || '').replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.length > 10 && digits.startsWith('0')) digits = digits.replace(/^0+/, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!hadPlus && digits.length === 10) digits = cc + digits;
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

/*
 * Shared CSS — dropped once per page via <style>.
 *
 * The button/card/dialog rules follow Material UI's own token values: 250ms on
 * cubic-bezier(0.4,0,0.2,1) (MUI's `short` duration + `easeInOut`), a 4% hover overlay
 * (palette.action.hoverOpacity), uppercase labels at 500 weight with 0.02857em tracking, and
 * the three variants — text, outlined, contained — carrying low, medium and high emphasis.
 *
 * Elevation follows Chakra's softer scale rather than Material's grey triple-shadow: in a dense
 * card grid, MUI's default elevation reads as muddy, while Chakra's stays crisp.
 *
 * These are CSS classes rather than inline styles because :hover, :active and :focus-visible
 * cannot be expressed inline — which is exactly what makes a button feel responsive.
 */
export const WA_CSS = `
  @keyframes nc_spin { to { transform: rotate(360deg); } }
  @keyframes wa_indeterminate { 0% { left: -40%; } 100% { left: 100%; } }
  @keyframes wa_backdrop_in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes wa_dialog_in { from { opacity: 0; transform: scale(.92) translateY(10px); } to { opacity: 1; transform: none; } }
  .wa *{ box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }

  /* ── Buttons ─────────────────────────────────────────────────────────────────────── */
  .wa-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    min-width: 64px; padding: 7px 16px; border-radius: 6px; border: 1px solid transparent;
    font-family: inherit; font-size: 12px; font-weight: 700; line-height: 1.75;
    letter-spacing: .02857em; text-transform: uppercase; white-space: nowrap; cursor: pointer;
    background: transparent; position: relative; user-select: none;
    transition: background-color 250ms cubic-bezier(.4,0,.2,1), box-shadow 250ms cubic-bezier(.4,0,.2,1), border-color 250ms cubic-bezier(.4,0,.2,1), color 250ms cubic-bezier(.4,0,.2,1);
  }
  .wa-btn:focus-visible { outline: 2px solid ${WA.primary}; outline-offset: 2px; }
  .wa-btn:disabled { opacity: .45; cursor: not-allowed; box-shadow: none; }
  .wa-btn-text { color: #64748b; }
  .wa-btn-text:hover:not(:disabled) { background: rgba(15,23,42,.04); color: #334155; }
  .wa-btn-outlined { color: ${WA.primary}; border-color: rgba(30,58,138,.5); }
  .wa-btn-outlined:hover:not(:disabled) { background: rgba(30,58,138,.04); border-color: ${WA.primary}; }
  .wa-btn-contained { color: #fff; background: ${WA.green}; box-shadow: 0 1px 2px rgba(16,24,40,.10), 0 1px 3px rgba(16,24,40,.08); }
  .wa-btn-contained:hover:not(:disabled) { background: ${WA.greenDark}; box-shadow: 0 4px 8px rgba(18,140,126,.24), 0 2px 4px rgba(16,24,40,.08); }
  .wa-btn-contained:active:not(:disabled) { box-shadow: 0 1px 2px rgba(16,24,40,.12); }
  .wa-btn-primary { color: #fff; background: ${WA.primary}; box-shadow: 0 1px 2px rgba(16,24,40,.10), 0 1px 3px rgba(16,24,40,.08); }
  .wa-btn-primary:hover:not(:disabled) { background: #1b3170; box-shadow: 0 4px 8px rgba(30,58,138,.24); }
  .wa-btn-sm { padding: 5px 12px; font-size: 11px; min-width: 0; }

  /* ── Cards ───────────────────────────────────────────────────────────────────────── */
  .wa-card {
    background: #fff; border: 1px solid #e9edf3; border-radius: 12px; overflow: hidden;
    display: flex; flex-direction: column;
    box-shadow: 0 1px 2px rgba(16,24,40,.04);
    transition: box-shadow 250ms cubic-bezier(.4,0,.2,1), border-color 250ms cubic-bezier(.4,0,.2,1), transform 250ms cubic-bezier(.4,0,.2,1);
  }
  .wa-card:hover { border-color: #d6dee9; box-shadow: 0 8px 16px -4px rgba(16,24,40,.10), 0 2px 6px -2px rgba(16,24,40,.06); transform: translateY(-2px); }
  .wa-card-actions { display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-top: 1px solid #f1f5f9; }

  /* Clamped so every card in a row is the same height regardless of body length. */
  .wa-clamp { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }

  /* ── Dialogs ─────────────────────────────────────────────────────────────────────── */
  .wa-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.5); z-index: 950; display: flex; align-items: center; justify-content: center; padding: 20px; animation: wa_backdrop_in 200ms cubic-bezier(.4,0,.2,1); }
  .wa-dialog { background: #fff; border-radius: 14px; box-shadow: 0 24px 48px -12px rgba(16,24,40,.28); animation: wa_dialog_in 220ms cubic-bezier(.16,1,.3,1); }
  .wa-tab { padding: 10px 4px; margin-right: 22px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap; background:none; border-top:none; border-left:none; border-right:none; font-family: inherit; }
  .wa-tab.active { color: ${WA.primary}; border-bottom-color: ${WA.primary}; }
  .wa-row:hover td { background: #f0fdf4; }
  .wa-dots { background: none; border: none; cursor: pointer; padding: 4px; color: #1e293b; border-radius: 6px; }
  .wa-dots:hover, .wa-dots.open { color: ${WA.primary}; background: #eef2ff; }
  .wa-progress-track { position: relative; height: 5px; border-radius: 999px; background: #e2e8f0; overflow: hidden; }
  .wa-progress-indeterminate { position: absolute; top: 0; left: -40%; height: 100%; width: 40%; background: ${WA.green}; border-radius: 999px; animation: wa_indeterminate 1.1s ease-in-out infinite; }
  .wa-card-hover { transition: box-shadow .15s, border-color .15s; }
  .wa-card-hover:hover { border-color: ${WA.greenDark}; box-shadow: 0 6px 18px rgba(18,140,126,.12); }
`;

/*
 * Live Chat — the three-pane inbox.
 *
 * Kept apart from WA_CSS because only one page uses it and it is large: WhatsApp Web's own
 * proportions (a fixed-width list, a fluid conversation, a fixed-width profile), WhatsApp's own
 * palette for the chat surface itself (#efeae2 wallpaper, #d9fdd3 outgoing, white incoming,
 * #53bdeb read ticks), and Material's motion tokens for everything that is panel chrome rather
 * than chat.
 *
 * The whole thing is `position:absolute; inset:0` inside a relative shell: a chat inbox must
 * never scroll the page — the list and the thread scroll independently, and the composer stays
 * pinned. Any layout built on page flow ends up with the composer below the fold.
 */
export const WA_INBOX_CSS = `
  @keyframes wa_msg_in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @keyframes wa_pulse  { 0%,100% { opacity: 1; } 50% { opacity: .35; } }

  .wa-inbox { position: absolute; inset: 0; display: grid; grid-template-columns: 340px minmax(0,1fr) 340px; background: #fff; }
  .wa-inbox-2col { grid-template-columns: 340px minmax(0,1fr); }
  @media (max-width: 1400px) { .wa-inbox { grid-template-columns: 300px minmax(0,1fr) 300px; } }
  @media (max-width: 1100px) { .wa-inbox { grid-template-columns: 280px minmax(0,1fr); } .wa-inbox .wa-profile { display: none; } }

  .wa-pane { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
  .wa-pane + .wa-pane { border-left: 1px solid #e2e8f0; }
  .wa-pane-head { flex-shrink: 0; padding: 10px 14px; border-bottom: 1px solid #e9edf3; background: #fff; }
  .wa-scroll { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }
  .wa-scroll::-webkit-scrollbar { width: 7px; }
  .wa-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
  .wa-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  .wa-scroll::-webkit-scrollbar-track { background: transparent; }

  /* ── conversation list ───────────────────────────────────────────────────────────────── */
  .wa-thread {
    display: flex; gap: 11px; padding: 10px 13px; cursor: pointer; align-items: center;
    border-bottom: 1px solid #f1f5f9; background: #fff; width: 100%; text-align: left;
    border-left: 3px solid transparent; border-top: none; border-right: none; font-family: inherit;
    transition: background-color 160ms cubic-bezier(.4,0,.2,1);
  }
  .wa-thread:hover { background: #f8fafc; }
  .wa-thread.active { background: #f0fdf4; border-left-color: ${WA.green}; }
  .wa-thread-name { font-size: 13px; font-weight: 600; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wa-thread.unread .wa-thread-name { font-weight: 800; }
  .wa-thread-prev { font-size: 11.5px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
  .wa-thread.unread .wa-thread-prev { color: #0f172a; font-weight: 600; }
  .wa-avatar { width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 14px; font-weight: 700; letter-spacing: .3px; }
  .wa-unread-dot { background: ${WA.green}; color: #fff; font-size: 10px; font-weight: 800; min-width: 19px; height: 19px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; padding: 0 5px; }

  /* Manual poll. The inbox checks every five minutes, so this is how you say "check now". */
  @keyframes wa-spin { to { transform: rotate(360deg); } }
  .wa-refresh-btn {
    width: 26px; height: 26px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid #e2e8f0; background: #fff; color: #64748b; cursor: pointer; flex-shrink: 0;
    transition: background 160ms cubic-bezier(.4,0,.2,1), color 160ms, border-color 160ms, transform 120ms;
  }
  .wa-refresh-btn:hover:not(:disabled) { background: #e8f8f0; color: ${WA.greenDark}; border-color: ${WA.green}; }
  .wa-refresh-btn:active:not(:disabled) { transform: scale(.92); }
  .wa-refresh-btn:focus-visible { outline: 2px solid ${WA.green}; outline-offset: 2px; }
  .wa-refresh-btn:disabled { opacity: .55; cursor: default; }

  /* ── chat surface ────────────────────────────────────────────────────────────────────── */
  /* WhatsApp's wallpaper: warm paper (#efeae2) under a faint dot grid. A flat colour reads as
     "unstyled panel"; the texture is what makes it read as a chat. */
  .wa-chat-bg {
    background-color: #efeae2;
    background-image: radial-gradient(circle at 1px 1px, rgba(15,23,42,.045) 1px, transparent 0);
    background-size: 22px 22px;
  }
  .wa-msg-row { display: flex; padding: 1px 0; animation: wa_msg_in 180ms cubic-bezier(.4,0,.2,1); }
  .wa-msg-row.out { justify-content: flex-end; }
  .wa-bubble {
    position: relative; max-width: min(65%, 560px); padding: 6px 9px 8px 9px; border-radius: 8px;
    font-size: 13.2px; line-height: 1.42; color: #111b21; word-break: break-word; white-space: pre-wrap;
    box-shadow: 0 1px .5px rgba(11,20,26,.13);
  }
  .wa-bubble.in  { background: #fff;    border-top-left-radius: 0; }
  .wa-bubble.out { background: #d9fdd3; border-top-right-radius: 0; }
  /* The little tail. Drawn with a border triangle rather than an image so it inherits the
     bubble colour and stays crisp at any zoom. */
  .wa-bubble.in::before, .wa-bubble.out::before {
    content: ''; position: absolute; top: 0; width: 0; height: 0; border-style: solid;
  }
  .wa-bubble.in::before  { left: -8px;  border-width: 0 9px 9px 0; border-color: transparent #fff transparent transparent; }
  .wa-bubble.out::before { right: -8px; border-width: 0 0 9px 9px; border-color: transparent transparent transparent #d9fdd3; }
  .wa-bubble-meta { display: flex; align-items: center; justify-content: flex-end; gap: 3px; font-size: 10.5px; color: #667781; margin-top: 2px; margin-left: 12px; float: right; position: relative; top: 4px; }
  .wa-day-pill { align-self: center; background: #fff; color: #54656f; font-size: 11px; font-weight: 600; padding: 5px 12px; border-radius: 8px; box-shadow: 0 1px .5px rgba(11,20,26,.13); margin: 12px auto; letter-spacing: .3px; }
  .wa-sys-pill { align-self: center; background: #ffeecd; color: #7a6a43; font-size: 11px; padding: 6px 13px; border-radius: 8px; margin: 8px auto; text-align: center; max-width: 70%; line-height: 1.5; }
  .wa-campaign-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 9.5px; font-weight: 800; letter-spacing: .3px; color: #128C7E; background: rgba(18,140,126,.1); padding: 2px 6px; border-radius: 4px; margin-bottom: 4px; text-transform: uppercase; }

  /* ── composer ────────────────────────────────────────────────────────────────────────── */
  .wa-composer { flex-shrink: 0; background: #f0f2f5; border-top: 1px solid #e2e8f0; padding: 8px 12px; }
  .wa-composer-input {
    flex: 1; min-width: 0; border: none; outline: none; resize: none; background: #fff;
    border-radius: 8px; padding: 10px 13px; font-family: inherit; font-size: 13.5px; color: #111b21;
    line-height: 1.45; max-height: 132px; box-shadow: 0 1px .5px rgba(11,20,26,.08);
  }
  .wa-icon-btn {
    display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px;
    border: none; background: transparent; border-radius: 50%; cursor: pointer; color: #54656f; flex-shrink: 0;
    transition: background-color 200ms cubic-bezier(.4,0,.2,1), color 200ms cubic-bezier(.4,0,.2,1);
  }
  .wa-icon-btn:hover:not(:disabled) { background: rgba(15,23,42,.06); color: #111b21; }
  .wa-icon-btn:disabled { opacity: .4; cursor: not-allowed; }
  .wa-send-btn {
    width: 40px; height: 40px; border-radius: 50%; border: none; background: ${WA.greenDark}; color: #fff;
    display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
    transition: background-color 200ms cubic-bezier(.4,0,.2,1), transform 120ms cubic-bezier(.4,0,.2,1), box-shadow 200ms;
    box-shadow: 0 1px 3px rgba(16,24,40,.16);
  }
  .wa-send-btn:hover:not(:disabled) { background: #0d7a6d; box-shadow: 0 3px 8px rgba(18,140,126,.32); }
  .wa-send-btn:active:not(:disabled) { transform: scale(.93); }
  .wa-send-btn:disabled { background: #b3c0c4; cursor: not-allowed; box-shadow: none; }

  /* ── right pane ──────────────────────────────────────────────────────────────────────── */
  .wa-profile-sec { border-bottom: 1px solid #eef2f6; }
  .wa-profile-sec > button {
    width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 12px 16px; background: none; border: none; cursor: pointer; font-family: inherit;
    font-size: 12px; font-weight: 700; color: #0f172a; text-align: left;
    transition: background-color 160ms cubic-bezier(.4,0,.2,1);
  }
  .wa-profile-sec > button:hover { background: #f8fafc; }
  .wa-kv { display: grid; grid-template-columns: 92px minmax(0,1fr); gap: 5px 10px; font-size: 11.5px; }
  .wa-kv dt { color: #94a3b8; font-weight: 600; }
  .wa-kv dd { color: #0f172a; margin: 0; font-weight: 600; word-break: break-word; }

  .wa-mini-card { border: 1px solid #e9edf3; border-radius: 9px; padding: 10px 11px; background: #fff; transition: border-color 200ms cubic-bezier(.4,0,.2,1), box-shadow 200ms cubic-bezier(.4,0,.2,1); }
  .wa-mini-card:hover { border-color: #cbd5e1; box-shadow: 0 2px 8px rgba(16,24,40,.06); }

  .wa-typing-dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #94a3b8; animation: wa_pulse 1.2s ease-in-out infinite; }
`;
