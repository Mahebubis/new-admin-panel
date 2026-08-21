import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import FilterDrawer from './FilterDrawer';
import { resolvePreset, describePreset } from './filterPresets';
import DetailedReportModal from './DetailedReportModal';

/*
 * Campaigns — email and WhatsApp in one list.
 *
 * They used to be two screens, which meant nobody could answer "what went out last week?"
 * without opening both and merging by eye. The merge happens server-side now
 * (api/campaigns/all_campaigns.php) because interleaving two paginated lists in the browser
 * cannot produce a true newest-first order without fetching all of both.
 *
 * NA IS A REAL VALUE HERE
 * The channels do not measure the same things. WhatsApp has no bounce and no per-campaign
 * unsubscribe; email has no "undelivered" (an ESP reports a bounce instead) and no replies. The
 * API returns null for those and this table prints NA. Printing 0 would be the most misleading
 * thing on the page: a 0% bounce rate on WhatsApp reads as flawless deliverability rather than
 * as a column that does not apply to the channel.
 *
 * COLOR
 * Two channels, two fixed hues — indigo for email, green for WhatsApp — assigned to the ENTITY,
 * never to rank, so a filter that hides one channel never repaints the other. The pair is
 * validated (lightness band, chroma floor, CVD separation, contrast): worst adjacent ΔE 26.8
 * deutan / 15.2 tritan against a light surface.
 */

const API      = '/api/campaigns/all_campaigns.php';
const EMAIL_API = '/api/campaigns/campaigns.php';
const WA_API    = '/api/whatsapp/wa_campaigns.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

const CHANNEL = {
  email:    { label: 'Email',    color: '#4f46e5', soft: '#eef2ff', ink: '#3730a3' },
  whatsapp: { label: 'WhatsApp', color: '#00A37A', soft: '#e6f7f1', ink: '#046c52' },
};

const TABS = [
  { key: 'all', label: 'All' }, { key: 'draft', label: 'Drafts' }, { key: 'sent', label: 'Sent' },
  { key: 'scheduled', label: 'Scheduled' }, { key: 'suspended', label: 'Suspended' },
  { key: 'running', label: 'Running' }, { key: 'failed', label: 'Failed' },
];

const STATUS_BADGE = {
  draft:     { bg: '#f2f4f7', fg: '#475467' },
  scheduled: { bg: '#fef0c7', fg: '#b54708' },
  running:   { bg: '#d1e9ff', fg: '#175cd3' },
  sent:      { bg: '#dcfae6', fg: '#067647' },
  suspended: { bg: '#fee4e2', fg: '#b42318' },
  failed:    { bg: '#fee4e2', fg: '#b42318' },
};

/*
 * Every column, with the metric it divides by when the % toggle is on.
 * `rateOf: null` means the number has no meaningful denominator (Published, Sent) and stays a
 * count even in % mode — showing "100%" for Sent-of-Sent is noise pretending to be information.
 */
const COLUMNS = [
  { key: 'published',    label: 'Published',      rateOf: null },
  { key: 'sent',         label: 'Sent',           rateOf: 'published' },
  { key: 'delivered',    label: 'Delivered',      rateOf: 'sent' },
  { key: 'opened',       label: 'Opened / Read',  rateOf: 'delivered' },
  { key: 'clicked',      label: 'Clicked',        rateOf: 'delivered' },
  { key: 'conversions',  label: 'Conversions',    rateOf: 'sent' },
  { key: 'revenue',      label: 'Revenue',        rateOf: null },
  { key: 'not_sent',     label: 'Not sent',       rateOf: 'published' },
  { key: 'unsubscribed', label: 'Unsubscribed',   rateOf: 'delivered' },
  { key: 'bounce',       label: 'Bounce',         rateOf: 'sent' },
  { key: 'spam',         label: 'Spam',           rateOf: 'delivered' },
  { key: 'undelivered',  label: 'Undelivered',    rateOf: 'sent' },
  { key: 'replied',      label: 'Replied',        rateOf: 'delivered' },
];
const DEFAULT_COLS = ['published', 'sent', 'delivered', 'opened', 'clicked', 'conversions',
                      'not_sent', 'unsubscribed', 'bounce', 'undelivered'];

const n0 = v => (v == null ? 'NA' : Number(v).toLocaleString('en-IN'));
const fmtDt = s => {
  if (!s) return 'NA';
  const d = new Date(String(s).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(s);
  const p = n => String(n).padStart(2, '0');
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  return `${M} ${p(d.getDate())}, ${d.getFullYear()} ${p(d.getHours() % 12 || 12)}:${p(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
};
const fmtDay = s => {
  const d = new Date(String(s).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? String(s)
    : `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const CSS = `
.cu { padding:20px 24px 40px; height:100%; overflow-y:auto; box-sizing:border-box; }
.cu-h { display:flex; align-items:flex-start; gap:14px; margin-bottom:18px; flex-wrap:wrap; }
.cu-h h1 { font-size:22px; font-weight:750; color:#101828; margin:0 0 3px; }
.cu-h p  { font-size:13px; color:#667085; margin:0; }

.cu-icon-btn { width:38px; height:38px; display:grid; place-items:center; border-radius:9px;
  border:1px solid #d0d5dd; background:#fff; color:#475467; cursor:pointer; position:relative;
  transition:all 170ms cubic-bezier(.4,0,.2,1); }
.cu-icon-btn:hover { background:#f9fafb; border-color:#98a2b3; color:#101828; transform:translateY(-1px); }
.cu-icon-btn:active { transform:translateY(0) scale(.96); }
.cu-icon-btn:focus-visible { outline:2px solid #4f46e5; outline-offset:2px; }
.cu-icon-btn[aria-pressed="true"] { background:#4f46e5; border-color:#4f46e5; color:#fff; }
.cu-icon-btn .badge { position:absolute; top:-5px; right:-5px; min-width:17px; height:17px; padding:0 4px;
  border-radius:999px; background:#4f46e5; color:#fff; font-size:10px; font-weight:800;
  display:grid; place-items:center; box-shadow:0 0 0 2px #fff; }

.cu-btn { display:inline-flex; align-items:center; gap:8px; padding:10px 17px; border-radius:9px;
  font-size:13.5px; font-weight:650; font-family:inherit; cursor:pointer; border:1px solid transparent;
  transition:background 170ms cubic-bezier(.4,0,.2,1), box-shadow 170ms, transform 90ms, border-color 170ms; }
.cu-btn:active { transform:translateY(1px); }
.cu-btn:focus-visible { outline:2px solid #4f46e5; outline-offset:2px; }
.cu-btn-solid { background:#4f46e5; color:#fff; box-shadow:0 1px 2px rgba(16,24,40,.06); }
.cu-btn-solid:hover { background:#4338ca; box-shadow:0 6px 16px rgba(79,70,229,.32); }

.cu-seg { display:inline-flex; border:1px solid #d0d5dd; border-radius:9px; overflow:hidden; background:#fff; }
.cu-seg button { padding:0 13px; height:38px; border:0; background:none; font-family:inherit; font-size:12.5px;
  font-weight:700; color:#667085; cursor:pointer; transition:background 150ms, color 150ms; }
.cu-seg button + button { border-left:1px solid #e4e7ec; }
.cu-seg button:hover { background:#f9fafb; color:#101828; }
.cu-seg button[aria-pressed="true"] { background:#4f46e5; color:#fff; }

/* tabs */
.cu-tabs { display:flex; gap:2px; border-bottom:1px solid #e4e7ec; margin:6px 0 16px; overflow-x:auto; }
.cu-tab { position:relative; padding:11px 15px; border:0; background:none; cursor:pointer; white-space:nowrap;
  font-family:inherit; font-size:13.5px; font-weight:650; color:#667085; border-radius:8px 8px 0 0;
  transition:color 160ms cubic-bezier(.4,0,.2,1), background 160ms; }
.cu-tab:hover { color:#344054; background:#f9fafb; }
.cu-tab:focus-visible { outline:2px solid #4f46e5; outline-offset:-2px; }
.cu-tab[aria-selected="true"] { color:#4f46e5; }
.cu-tab::after { content:''; position:absolute; left:9px; right:9px; bottom:-1px; height:2px; border-radius:2px 2px 0 0;
  background:currentColor; transform:scaleX(0); transition:transform 200ms cubic-bezier(.4,0,.2,1); }
.cu-tab[aria-selected="true"]::after { transform:scaleX(1); }

/* search */
.cu-search { position:relative; flex:1 1 280px; max-width:400px; }
.cu-search input { width:100%; box-sizing:border-box; padding:10px 12px 10px 36px; border:1px solid #d0d5dd;
  border-radius:9px; font-size:13px; font-family:inherit; color:#101828; background:#fff; outline:none;
  transition:border-color 170ms cubic-bezier(.4,0,.2,1), box-shadow 170ms; }
.cu-search input:hover { border-color:#98a2b3; }
.cu-search input:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,.14); }
.cu-search svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#98a2b3; }

/* applied-filter pills */
.cu-applied { display:flex; gap:7px; flex-wrap:wrap; margin-bottom:13px; }
.cu-pill { display:inline-flex; align-items:center; gap:6px; padding:4px 6px 4px 11px; border-radius:999px;
  background:#eef2ff; border:1px solid #c7d7fe; color:#3730a3; font-size:11.5px; font-weight:650; }
.cu-pill button { width:17px; height:17px; display:grid; place-items:center; border:0; border-radius:50%;
  background:rgba(55,48,163,.12); color:#3730a3; cursor:pointer; transition:background 150ms; }
.cu-pill button:hover { background:rgba(55,48,163,.26); }

/* table */
.cu-card { background:#fff; border:1px solid #e4e7ec; border-radius:12px; overflow:hidden;
  box-shadow:0 1px 2px rgba(16,24,40,.05); }
.cu-scroll { overflow-x:auto; }
.cu-tbl { width:100%; border-collapse:separate; border-spacing:0; min-width:1180px; }
.cu-tbl th { text-align:right; font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase;
  color:#667085; padding:12px 14px; background:#f9fafb; border-bottom:1px solid #e4e7ec; white-space:nowrap; }
.cu-tbl th.l, .cu-tbl td.l { text-align:left; }
.cu-tbl td { padding:14px; font-size:13px; color:#344054; border-bottom:1px solid #f2f4f7;
  text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
.cu-tbl tbody tr { transition:background 130ms cubic-bezier(.4,0,.2,1); cursor:pointer; }
.cu-tbl tbody tr:hover { background:#f9fafb; }
.cu-tbl tbody tr:last-child td { border-bottom:0; }
/* A row that has just been created here. It slides in and its tint fades out over two seconds —
   long enough to answer "where did my copy go?", short enough not to become a permanent label.
   Indigo, the email hue, is reused deliberately: this is a state, not a fourth entity colour. */
.cu-fresh > td { animation:cu-fresh 2s cubic-bezier(.4,0,.2,1) forwards; }
.cu-fresh > td.sticky { animation:cu-fresh-sticky 2s cubic-bezier(.4,0,.2,1) forwards; }
@keyframes cu-fresh { from { background:#eef2ff; } to { background:transparent; } }
@keyframes cu-fresh-sticky { from { background:#eef2ff; } to { background:#fff; } }
.cu-spin { width:11px; height:11px; border-radius:50%; border:1.6px solid #d0d5dd; border-top-color:#4f46e5;
  animation:cu-rot .7s linear infinite; }
@keyframes cu-rot { to { transform:rotate(360deg); } }
@media (prefers-reduced-motion:reduce) {
  .cu-fresh > td, .cu-fresh > td.sticky, .cu-spin { animation:none; }
}
/* The name column is sticky so a wide metric table stays readable while scrolling sideways —
   without it you scroll to Bounce and can no longer tell whose bounce it is. */
.cu-tbl th.sticky, .cu-tbl td.sticky { position:sticky; left:0; z-index:2; background:#fff; }
.cu-tbl th.sticky { background:#f9fafb; z-index:3; }
.cu-tbl tbody tr:hover td.sticky { background:#f9fafb; }
.cu-tbl td.sticky::after, .cu-tbl th.sticky::after { content:''; position:absolute; top:0; right:0; bottom:0;
  width:1px; background:#eaecf0; }

.cu-name { font-weight:650; color:#101828; display:block; margin-bottom:3px;
  max-width:290px; overflow:hidden; text-overflow:ellipsis; }
.cu-sub { font-size:11px; color:#98a2b3; font-variant-numeric:tabular-nums; }
.cu-na { color:#c8cdd7; }

.cu-ch { display:inline-flex; align-items:center; gap:7px; padding:4px 10px 4px 7px; border-radius:999px;
  font-size:11.5px; font-weight:700; white-space:nowrap; }
.cu-badge { display:inline-flex; padding:3px 9px; border-radius:999px; font-size:10.5px; font-weight:800;
  letter-spacing:.03em; text-transform:uppercase; }

.cu-tags { display:inline-flex; gap:4px; margin-left:7px; vertical-align:middle; }
.cu-tag { font-size:10px; font-weight:650; color:#667085; background:#f2f4f7; border-radius:4px; padding:1px 6px; }

.cu-foot { display:flex; align-items:center; gap:12px; padding:13px 16px; border-top:1px solid #f2f4f7;
  background:#fcfcfd; flex-wrap:wrap; }
.cu-page { display:flex; gap:4px; margin-left:auto; }
.cu-page button { min-width:32px; height:32px; padding:0 9px; border-radius:7px; border:1px solid #d0d5dd;
  background:#fff; color:#475467; font-size:12.5px; font-weight:650; font-family:inherit; cursor:pointer;
  transition:all 150ms cubic-bezier(.4,0,.2,1); }
.cu-page button:hover:not(:disabled) { background:#f9fafb; border-color:#98a2b3; }
.cu-page button:disabled { opacity:.4; cursor:default; }
.cu-page button[aria-current="true"] { background:#4f46e5; border-color:#4f46e5; color:#fff; }

.cu-empty { padding:64px 24px; text-align:center; color:#667085; }
.cu-empty b { display:block; font-size:15.5px; font-weight:700; color:#344054; margin-bottom:6px; }

/* stat tiles */
.cu-tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px; margin-bottom:18px; }
.cu-tile { background:#fff; border:1px solid #e4e7ec; border-radius:11px; padding:14px 16px;
  box-shadow:0 1px 2px rgba(16,24,40,.05); transition:border-color 170ms, box-shadow 170ms, transform 170ms; }
.cu-tile:hover { border-color:#c7d7fe; box-shadow:0 6px 18px rgba(16,24,40,.08); transform:translateY(-2px); }
.cu-tile .k { font-size:11.5px; font-weight:650; color:#667085; margin-bottom:6px; }
.cu-tile .v { font-size:23px; font-weight:750; color:#101828; font-variant-numeric:tabular-nums; letter-spacing:-.01em; }
.cu-tile .split { display:flex; gap:11px; margin-top:8px; font-size:10.5px; color:#667085; flex-wrap:wrap; }
.cu-tile .split i { font-style:normal; display:inline-flex; align-items:center; gap:4px; }
.cu-tile .split i::before { content:''; width:7px; height:7px; border-radius:2px; background:var(--c); }

/* charts */
.cu-charts { display:grid; grid-template-columns:1.85fr 1fr; gap:14px; margin-bottom:18px; }
@media (max-width:1180px) { .cu-charts { grid-template-columns:1fr; } }
.cu-chart { background:#fff; border:1px solid #e4e7ec; border-radius:12px; padding:16px 18px 10px;
  box-shadow:0 1px 2px rgba(16,24,40,.05); }
.cu-chart h3 { font-size:13.5px; font-weight:700; color:#101828; margin:0 0 2px; }
.cu-chart p { font-size:11.5px; color:#98a2b3; margin:0 0 14px; line-height:1.5; }
.cu-tip { background:#fff; border:1px solid #e4e7ec; border-radius:9px; padding:9px 12px;
  box-shadow:0 8px 24px rgba(16,24,40,.12); font-size:12px; }
.cu-tip .t { font-weight:700; color:#101828; margin-bottom:5px; }
.cu-tip .r { display:flex; align-items:center; gap:7px; color:#475467; margin-top:2px; }
.cu-tip .r i { width:8px; height:8px; border-radius:2px; display:block; }
.cu-tip .r b { margin-left:auto; color:#101828; font-variant-numeric:tabular-nums; }

.cu-metricbar { display:flex; gap:5px; flex-wrap:wrap; margin-bottom:12px; }
.cu-metricbar button { padding:5px 11px; border-radius:999px; border:1px solid #e4e7ec; background:#fff;
  color:#667085; font-family:inherit; font-size:11.5px; font-weight:650; cursor:pointer;
  transition:all 160ms cubic-bezier(.4,0,.2,1); }
.cu-metricbar button:hover { border-color:#98a2b3; background:#f9fafb; }
.cu-metricbar button[aria-pressed="true"] { background:#101828; border-color:#101828; color:#fff; }

/* column chooser */
.cu-cols { position:absolute; top:46px; right:0; z-index:20; width:230px; background:#fff;
  border:1px solid #e4e7ec; border-radius:11px; box-shadow:0 16px 40px rgba(16,24,40,.16); padding:8px;
  animation:cu-pop 160ms cubic-bezier(.4,0,.2,1); }
@keyframes cu-pop { from { opacity:0; transform:translateY(-6px) scale(.98); } to { opacity:1; transform:none; } }
.cu-cols label { display:flex; align-items:center; gap:9px; padding:7px 9px; border-radius:7px;
  font-size:12.5px; color:#344054; cursor:pointer; transition:background 130ms; }
.cu-cols label:hover { background:#f9fafb; }
.cu-cols input { accent-color:#4f46e5; cursor:pointer; }

/* Used both as an absolute popover (the toolbar's Create menu) and as a fixed, portalled one
   (the row actions, which set position/left/top inline). Everything except placement is shared. */
.cu-menu { position:absolute; z-index:25; background:#fff; border:1px solid #e4e7ec; border-radius:10px;
  box-shadow:0 16px 40px rgba(16,24,40,.16); padding:6px; min-width:206px;
  animation:cu-pop 150ms cubic-bezier(.4,0,.2,1); }
.cu-menu button { display:flex; align-items:center; gap:9px; width:100%; padding:9px 11px; border:0;
  background:none; border-radius:7px; font-family:inherit; font-size:13px; color:#344054; cursor:pointer;
  text-align:left; transition:background 130ms; }
.cu-menu button:hover { background:#f4f4ff; color:#3730a3; }
/*
   The portalled variant carries its placement in an inline transform (translateY(-100%) when it
   has flipped above the trigger). cu-pop animates transform to none, which would wipe that out at
   the end of the animation and drop the menu back over the row — so this one fades only.
*/
.cu-menu.fixed { animation:cu-fade 140ms cubic-bezier(.4,0,.2,1); }
@keyframes cu-fade { from { opacity:0 } to { opacity:1 } }
.cu-menu button.danger { color:#b42318; }
.cu-menu button.danger:hover { background:#fef3f2; color:#912018; }
.cu-menu button svg { flex:none; opacity:.7; }

/* Channel prefix — a tinted square holding the channel mark, sized to sit on the name's baseline. */
.cu-chicon { width:26px; height:26px; border-radius:7px; display:grid; place-items:center; flex:none; }

/* The name is the only navigation target in the row. Styled as a link, built as a button so it
   is keyboard-reachable and announced correctly. */
.cu-namebtn { border:0; flex:1; min-width:0; background:none; padding:0; font-family:inherit; font-size:13px; font-weight:650;
  color:#101828; cursor:pointer; text-align:left; max-width:290px; overflow:hidden; text-overflow:ellipsis;
  white-space:nowrap; border-bottom:1px solid transparent;
  transition:color 150ms cubic-bezier(.4,0,.2,1), border-color 150ms; }
.cu-namebtn:hover { color:#4f46e5; border-bottom-color:#a5b4fc; }
.cu-namebtn:focus-visible { outline:2px solid #4f46e5; outline-offset:2px; border-radius:3px; }

/*
   The actions trigger stays quiet until it is wanted: sixty rows each showing a permanent ⋮ is a
   column of noise for a control almost nobody uses on almost every row.

   Faded, not removed. opacity keeps it in the layout, so nothing shifts sideways when a row is
   hovered, and keeps it in the tab order — :focus-visible reveals it for keyboard users, and
   data-open keeps it visible while its own menu is up.
*/
.cu-dots { opacity:0;
  transition:opacity 140ms cubic-bezier(.4,0,.2,1), background 170ms, border-color 170ms, color 170ms, transform 90ms; }
.cu-tbl tbody tr:hover .cu-dots,
.cu-dots:focus-visible,
.cu-dots[data-open] { opacity:1; }
.cu-dots[data-open] { background:#eef2ff; border-color:#a5b4fc; color:#3730a3; }
/* A coarse pointer has no hover at all, so the control would be permanently invisible there. */
@media (hover: none) { .cu-dots { opacity:1; } }
`;

const Ico = {
  search: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>,
  filter: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18M6 12h12M10 19h4" /></svg>,
  down:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 11l5 5 5-5M4 21h16" /></svg>,
  gear:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  chart:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m7 14 3.5-4 3 3L20 6" /></svg>,
  plus:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
  x:      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>,
  dots:   <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="12" cy="19" r="1.9" /></svg>,
  eye:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>,
  pencil: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>,
  copy:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
  trash:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>,
  mail:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2.8" y="5" width="18.4" height="14" rx="2.2" /><path d="m3.4 7 8.6 6 8.6-6" /></svg>,
  wa:     <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.48-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.8h-.02a9.8 9.8 0 0 1-4.99-1.37l-.36-.21-3.71.97.99-3.62-.23-.37a9.79 9.79 0 0 1-1.5-5.22c0-5.41 4.4-9.81 9.82-9.81a9.75 9.75 0 0 1 6.94 2.88 9.74 9.74 0 0 1 2.87 6.94c0 5.41-4.4 9.81-9.81 9.81M20.52 3.45A11.66 11.66 0 0 0 12.05 0C5.6 0 .35 5.25.35 11.7c0 2.06.54 4.08 1.56 5.85L.25 24l6.59-1.73a11.66 11.66 0 0 0 5.2 1.24h.01c6.45 0 11.7-5.25 11.7-11.7 0-3.13-1.22-6.07-3.43-8.28" /></svg>,
};

/** Shared tooltip. Series colour appears as a swatch; the text stays ink, never the series hue. */
function ChartTip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="cu-tip">
      <div className="t">{label}</div>
      {payload.map(p => (
        <div className="r" key={p.dataKey || p.name}>
          <i style={{ background: p.color || p.payload?.fill }} />
          {p.name}<b>{Number(p.value).toLocaleString('en-IN')}{suffix}</b>
        </div>
      ))}
    </div>
  );
}

export default function CampaignsUnified() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();

  const [rows, setRows]       = useState([]);
  const [counts, setCounts]   = useState({});
  const [byChannel, setByChannel] = useState({ email: 0, whatsapp: 0 });
  const [total, setTotal]     = useState(0);
  const [pages, setPages]     = useState(1);
  /* `loading` is now first-load only — the skeleton. A refetch triggered by a filter, a poll or a
     duplicate keeps the current rows on screen and flags itself with `busy` instead, because
     emptying the table for 400ms on every refresh is most of what made this screen feel jumpy. */
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);

  /*
   * Optimistic state, and the reason it exists.
   *
   * A duplicate or a delete is a write the user just watched themselves make, so the row must
   * appear or vanish on the same frame — not one network round-trip later, and definitely not
   * only once some cache upstream decides to expire. `pinned` holds rows created here that the
   * server hasn't handed back yet; `tombstones` holds rows deleted here that a stale response
   * might still be carrying. Both are reconciled away by the merge below the moment the server
   * agrees, so neither can drift into a permanent lie.
   */
  const [pinned, setPinned]         = useState([]);
  const [tombstones, setTombstones] = useState([]);
  /* Which rows still deserve the "just created" tint. A ref, not state, because it must be
     readable inside load() without making load() re-run every time it changes. */
  const freshRef = useRef(new Set());

  const [summary, setSummary] = useState(null);
  const [series, setSeries]   = useState([]);
  const [allTags, setAllTags] = useState([]);

  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch]   = useState('');
  const [debounced, setDebounced] = useState('');
  const [sort, setSort]       = useState('recent');
  const [pct, setPct]         = useState(false);
  const [showCharts, setShowCharts] = useState(() => localStorage.getItem('nc_campaign_charts') === '1');
  const [metric, setMetric]   = useState('sent');

  const [colsOpen, setColsOpen] = useState(false);
  const [cols, setCols] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nc_campaign_cols')) || DEFAULT_COLS; }
    catch { return DEFAULT_COLS; }
  });
  useEffect(() => { localStorage.setItem('nc_campaign_cols', JSON.stringify(cols)); }, [cols]);

  const [createOpen, setCreateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const [reportFor, setReportFor] = useState(null);

  const status = params.get('status') || 'all';
  const [filters, setFilters] = useState({ channel: [], tags: [], duration: '', from: '', to: '' });

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // Close the transient popovers on any outside click — two of these open at once looks broken.
  const rootRef = useRef(null);
  useEffect(() => {
    const onDown = e => {
      if (!e.target.closest?.('[data-pop]')) { setColsOpen(false); setCreateOpen(false); setMenuFor(null); }
    };
    const onKey = e => {
      if (e.key !== 'Escape') return;
      setColsOpen(false); setCreateOpen(false); setMenuFor(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  /* A row menu is anchored to a screen position, so it must not be left floating over a table
     that has scrolled out from under it. Closed rather than repositioned: the trigger it belongs
     to has usually moved off screen by then. */
  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menuFor]);

  const query = useMemo(() => ({
    status,
    search: debounced,
    channel: filters.channel.length === 1 ? filters.channel[0] : 'all',
    tags: (filters.tags || []).join(','),
    from: filters.from || '',
    to: filters.to || '',
    sort,
  }), [status, debounced, filters, sort]);

  /*
   * A fetch that can be quiet.
   *
   * `silent` keeps the table exactly as it is while the request is in flight — used by every
   * refetch that isn't the very first one. `_t` is a cache-buster: the API sends no-store now,
   * but a browser or CDN that already cached a list response before this shipped would keep
   * replaying it, and a unique query string is the one thing no cache can match.
   */
  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setBusy(true); else setLoading(true);
    const bust = { _t: Date.now() };
    try {
      const [list, sum, trend] = await Promise.all([
        api.get(API, { params: { ...query, ...bust, action: 'list', page, per_page: perPage } }),
        api.get(API, { params: { ...query, ...bust, action: 'summary' } }),
        api.get(API, { params: { ...query, ...bust, action: 'trend', granularity: 'day' } }),
      ]);
      if (list.data?.success) {
        const d = list.data.data;
        // The tint follows the campaign, not the placeholder — so a copy that was pinned a moment
        // ago and has now arrived from the server doesn't lose its highlight mid-animation.
        setRows((d.campaigns || []).map(c =>
          (freshRef.current.has(`${c.channel}-${c.id}`) ? { ...c, _fresh: true } : c)));
        setCounts(d.counts || {});
        setByChannel(d.by_channel || { email: 0, whatsapp: 0 });
        setTotal(d.total || 0);
        setPages(d.pages || 1);
        /* Reconcile the optimistic state against what the server actually returned: a pin whose
           row has arrived is no longer needed, and a tombstone whose row is gone has done its
           job. Anything still outstanding stays, so a slow or cached response can neither swallow
           the copy just made nor resurrect the campaign just deleted. */
        const present = new Set((d.campaigns || []).map(c => `${c.channel}-${c.id}`));
        setPinned(p => p.filter(x => !present.has(`${x.channel}-${x.id}`)));
        setTombstones(t => t.filter(k => present.has(k)));
      } else toast.error(list.data?.message || 'Could not load campaigns');
      if (sum.data?.success)   setSummary(sum.data.data);
      // Only the tail is charted: a two-year x-axis of daily points is unreadable, and the
      // question this chart answers is always about recent sending.
      if (trend.data?.success) setSeries((trend.data.data.series || []).slice(-45));
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not load campaigns');
    } finally { setLoading(false); setBusy(false); }
  }, [query, page, perPage]);

  /* The first load shows the skeleton; every later one caused by a filter/sort/page change is
     silent, so the table updates in place instead of blinking empty and back. */
  const first = useRef(true);
  useEffect(() => {
    load({ silent: !first.current });
    first.current = false;
  }, [load]);

  useEffect(() => {
    api.get(API, { params: { action: 'tags' } })
      .then(r => { if (r.data?.success) setAllTags(r.data.data.tags || []); })
      .catch(() => { /* the tag filter degrades to empty; nothing else depends on it */ });
  }, []);

  const setStatus = s => { setParams(s === 'all' ? {} : { status: s }, { replace: true }); setPage(1); };

  const applyFilters = next => {
    // A preset is stored as its id but sent as concrete dates, so the server never has to know
    // what "last 30 days" means and the two can't drift apart.
    const r = next.duration === 'custom'
      ? { from: next.from || '', to: next.to || '' }
      : resolvePreset(next.duration);
    setFilters({ ...next, from: r.from, to: r.to });
    setPage(1);
  };

  const filterFields = useMemo(() => [
    { key: 'duration', label: 'Duration', kind: 'daterange' },
    { key: 'channel', label: 'Channel', kind: 'chips', options: [
        { id: 'email',    label: 'Email',    color: CHANNEL.email.color,    count: byChannel.email },
        { id: 'whatsapp', label: 'WhatsApp', color: CHANNEL.whatsapp.color, count: byChannel.whatsapp },
      ] },
    { key: 'tags', label: 'Tags', kind: 'chips',
      options: allTags.map(t => ({ id: t, label: t })),
      emptyText: 'No campaign has been tagged yet' },
  ], [allTags, byChannel]);

  const activePills = useMemo(() => {
    const out = [];
    if (filters.duration) {
      out.push({ k: 'duration', label: describePreset(filters.duration, filters.from, filters.to) });
    }
    (filters.channel || []).forEach(c => out.push({ k: 'channel', v: c, label: CHANNEL[c]?.label || c }));
    (filters.tags || []).forEach(t => out.push({ k: 'tags', v: t, label: `#${t}` }));
    return out;
  }, [filters]);

  const dropPill = p => {
    if (p.k === 'duration') setFilters(f => ({ ...f, duration: '', from: '', to: '' }));
    else setFilters(f => ({ ...f, [p.k]: (f[p.k] || []).filter(x => x !== p.v) }));
    setPage(1);
  };

  const exportCsv = () => {
    const qs = new URLSearchParams({ ...query, action: 'export' }).toString();
    // A plain navigation, not fetch+blob: the browser's own download handles the auth cookie and
    // the Content-Disposition filename without holding a 5,000-row CSV in memory first.
    window.open(`${API}?${qs}`, '_blank');
  };

  /* Move the tab counts by hand for a write we just made, so the numbers in the tab strip agree
     with the table on the same frame. The next fetch overwrites them with the server's truth. */
  const bumpCounts = (st, delta, channel) => {
    setCounts(c => ({ ...c, all: Math.max(0, (c.all ?? 0) + delta), [st]: Math.max(0, (c[st] ?? 0) + delta) }));
    setTotal(t => Math.max(0, t + delta));
    if (channel) setByChannel(b => ({ ...b, [channel]: Math.max(0, (b[channel] ?? 0) + delta) }));
  };

  const remove = async (r, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${r.name}"? This cannot be undone.`)) return;
    const url = r.channel === 'whatsapp' ? WA_API : EMAIL_API;
    const key = `${r.channel}-${r.id}`;
    try {
      const res = await api.post(url, new URLSearchParams({ action: 'delete', id: String(r.id) }), FORM);
      if (res.data?.success) {
        toast.success('Campaign deleted');
        // Gone from the screen now, not after the refetch — and the tombstone keeps it gone even
        // if the refetch is answered from a cache that still has it.
        setTombstones(t => (t.includes(key) ? t : [...t, key]));
        setPinned(p => p.filter(x => `${x.channel}-${x.id}` !== key));
        bumpCounts(r.status, -1, r.channel);
        load({ silent: true });
      } else toast.error(res.data?.message || 'Could not delete');
    } catch (err) { toast.error(err?.response?.data?.message || 'Could not delete'); }
  };

  /* Both channels open the same detail screen — Performance and Preview as tabs — including
     drafts, which have a preview worth reading even with no results yet. */
  const openCampaign = r => nav(`/netcore/campaigns/${r.channel}/${r.id}`);

  const duplicate = async r => {
    const url = r.channel === 'whatsapp' ? WA_API : EMAIL_API;
    try {
      const res = await api.post(url, new URLSearchParams({ action: 'duplicate', id: String(r.id) }), FORM);
      if (!res.data?.success) { toast.error(res.data?.message || 'Could not duplicate'); return; }
      toast.success('Campaign duplicated as a draft');

      /*
       * The copy goes on screen immediately, built from the row it was copied from plus the id
       * and name the server just returned. Every metric is zeroed — a fresh draft has sent
       * nothing — but NULL stays NULL, because null here means "this channel does not measure
       * that" and printing 0 for a WhatsApp bounce rate is the one lie this table must not tell.
       */
      const d = res.data.data || {};
      if (d.id) {
        const key = `${r.channel}-${d.id}`;
        freshRef.current.add(key);
        setTimeout(() => freshRef.current.delete(key), 6000);
        const zero = {};
        for (const c of COLUMNS) if (r[c.key] != null) zero[c.key] = 0;
        setPinned(p => [{
          ...r, ...zero,
          id: d.id,
          name: d.name || `${r.name} (Copy)`,
          status: 'draft',
          last_error: null,
          sent_on: d.created_at || null,
          scheduled_at: null, started_at: null, completed_at: null,
          created_at: d.created_at || null,
          _fresh: true,
        }, ...p.filter(x => !(x.channel === r.channel && x.id === d.id))]);
        bumpCounts('draft', +1, r.channel);
      }
      load({ silent: true });
    } catch (e) { toast.error(e?.response?.data?.message || 'Could not duplicate'); }
  };

  /*
   * What the table actually renders: the server's page, minus anything deleted here, plus any
   * just-created copy the server hasn't caught up with — and only where such a copy belongs.
   * A fresh draft has no business appearing under the Sent tab, inside a date range that ended
   * yesterday, or on page 3, so a pin that doesn't fit the current view simply waits.
   */
  const viewRows = useMemo(() => {
    const dead = new Set(tombstones);
    const serverRows = rows.filter(r => !dead.has(`${r.channel}-${r.id}`));
    const seen = new Set(serverRows.map(r => `${r.channel}-${r.id}`));

    const pinnable = page === 1
      && (status === 'all' || status === 'draft')
      && !filters.from && !filters.to && !(filters.tags || []).length;
    if (!pinnable) return serverRows;

    const q = debounced.toLowerCase();
    const show = pinned.filter(p =>
      !seen.has(`${p.channel}-${p.id}`)
      && !dead.has(`${p.channel}-${p.id}`)
      && (filters.channel.length !== 1 || filters.channel[0] === p.channel)
      && (!q || p.name.toLowerCase().includes(q) || String(p.id) === q));
    return [...show, ...serverRows];
  }, [rows, pinned, tombstones, page, status, filters, debounced]);

  /*
   * While something is sending, the numbers on this screen are stale the second they render — the
   * worker is writing sent/delivered counts every few seconds. Poll, but only while there is
   * actually a running or scheduled campaign to watch, and only silently: a list that quietly
   * fills in is the point, a list that flashes a skeleton every ten seconds is worse than static.
   * Paused while the tab is hidden, so a forgotten tab isn't hitting the API all afternoon.
   */
  const hasLiveWork = (counts.running ?? 0) > 0 || (counts.scheduled ?? 0) > 0;
  useEffect(() => {
    if (!hasLiveWork) return;
    const t = setInterval(() => {
      if (!document.hidden) load({ silent: true });
    }, 10000);
    return () => clearInterval(t);
  }, [hasLiveWork, load]);

  const visibleCols = COLUMNS.filter(c => cols.includes(c.key));

  /** A cell: NA when the channel doesn't measure it, a rate when % mode is on and it has a base. */
  const cell = (r, c) => {
    const v = r[c.key];
    if (v == null) return <span className="cu-na">NA</span>;
    if (!pct || !c.rateOf) return n0(v);
    const base = Number(r[c.rateOf] || 0);
    if (!base) return <span className="cu-na">—</span>;
    return `${((v / base) * 100).toFixed(1)}%`;
  };

  const donut = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.by_channel || {})
      .map(([ch, v]) => ({ name: CHANNEL[ch]?.label || ch, value: v.sent, fill: CHANNEL[ch]?.color }))
      .filter(d => d.value > 0);
  }, [summary]);

  /*
   * Where results came from. Three grouped bars rather than one stacked bar per metric: the
   * question is "which channel drove this", which is a comparison between two magnitudes, and a
   * stack makes the second segment impossible to compare because it doesn't share a baseline.
   */
  const attribution = useMemo(() => {
    if (!summary) return [];
    const bc = summary.by_channel || {};
    return [
      { metric: 'Opened / Read', email: bc.email?.opened || 0,      whatsapp: bc.whatsapp?.opened || 0 },
      { metric: 'Clicked',       email: bc.email?.clicked || 0,     whatsapp: bc.whatsapp?.clicked || 0 },
      { metric: 'Conversions',   email: bc.email?.conversions || 0, whatsapp: bc.whatsapp?.conversions || 0 },
    ];
  }, [summary]);

  const t = summary?.totals;

  return (
    <div className="cu" ref={rootRef}>
      <style>{CSS}</style>

      <div className="cu-h">
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1>Campaigns</h1>
          <p>Every email and WhatsApp campaign, newest first.</p>
        </div>

        {/* One switch for the whole analytics band — tiles and charts together. They answer the
            same question at two levels of detail, so showing one without the other is a half
            answer, and most visits to this page are to find a campaign, not to read totals.
            Off by default; the choice is remembered. */}
        <button className="cu-icon-btn"
                onClick={() => setShowCharts(s => { localStorage.setItem('nc_campaign_charts', s ? '0' : '1'); return !s; })}
                aria-pressed={showCharts} title={showCharts ? 'Hide totals and charts' : 'Show totals and charts'}>
          {Ico.chart}
        </button>

        <div className="cu-seg" role="group" aria-label="Show counts or rates">
          <button aria-pressed={!pct} onClick={() => setPct(false)} title="Show absolute counts">#</button>
          <button aria-pressed={pct} onClick={() => setPct(true)} title="Show rates">%</button>
        </div>

        <div style={{ position: 'relative' }} data-pop>
          <button className="cu-icon-btn" onClick={() => setColsOpen(o => !o)} title="Choose columns">{Ico.gear}</button>
          {colsOpen && (
            <div className="cu-cols">
              {COLUMNS.map(c => (
                <label key={c.key}>
                  <input type="checkbox" checked={cols.includes(c.key)}
                         onChange={() => setCols(v => v.includes(c.key) ? v.filter(x => x !== c.key) : [...v, c.key])} />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>

        <button className="cu-icon-btn" onClick={exportCsv} title="Download this list as CSV">{Ico.down}</button>

        <button className="cu-icon-btn" onClick={() => setFilterOpen(true)} title="Filters">
          {Ico.filter}
          {activePills.length > 0 && <span className="badge">{activePills.length}</span>}
        </button>

        <div style={{ position: 'relative' }} data-pop>
          <button className="cu-btn cu-btn-solid" onClick={() => setCreateOpen(o => !o)}>
            {Ico.plus} Create
          </button>
          {createOpen && (
            <div className="cu-menu" style={{ right: 0, top: 46 }}>
              <button onClick={() => nav('/netcore/campaigns/new')}>
                <span style={{ color: CHANNEL.email.color, display: 'flex' }}>{Ico.mail}</span> Email campaign
              </button>
              <button onClick={() => nav('/netcore/whatsapp/new')}>
                <span style={{ color: CHANNEL.whatsapp.color, display: 'flex' }}>{Ico.wa}</span> WhatsApp campaign
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── tiles ───────────────────────────────────────────────────────────────────────── */}
      {showCharts && t && (
        <div className="cu-tiles">
          {[
            { k: 'Sent', v: t.sent, e: summary.by_channel.email?.sent, w: summary.by_channel.whatsapp?.sent },
            { k: 'Delivered', v: t.delivered, e: summary.by_channel.email?.delivered, w: summary.by_channel.whatsapp?.delivered },
            { k: 'Opened / Read', v: t.opened, e: summary.by_channel.email?.opened, w: summary.by_channel.whatsapp?.opened },
            { k: 'Clicked', v: t.clicked, e: summary.by_channel.email?.clicked, w: summary.by_channel.whatsapp?.clicked },
            { k: 'Conversions', v: t.conversions, e: summary.by_channel.email?.conversions, w: summary.by_channel.whatsapp?.conversions },
          ].map(tile => (
            <div className="cu-tile" key={tile.k}>
              <div className="k">{tile.k}</div>
              <div className="v">{n0(tile.v)}</div>
              {/* The split is the answer to "which channel did this come from" at a glance — the
                  same question the attribution chart answers in full. */}
              <div className="split">
                <i style={{ '--c': CHANNEL.email.color }}>{n0(tile.e || 0)}</i>
                <i style={{ '--c': CHANNEL.whatsapp.color }}>{n0(tile.w || 0)}</i>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── charts ──────────────────────────────────────────────────────────────────────── */}
      {showCharts && (
        <div className="cu-charts">
          <div className="cu-chart">
            <h3>Performance trend</h3>
            <p>By the day each campaign went out. Engagement that arrives later is counted on the send&apos;s day.</p>
            <div className="cu-metricbar">
              {['sent', 'delivered', 'opened', 'clicked', 'conversions'].map(m => (
                <button key={m} aria-pressed={metric === m} onClick={() => setMetric(m)}>
                  {COLUMNS.find(c => c.key === m)?.label || m}
                </button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={244}>
              <LineChart data={series} margin={{ top: 4, right: 10, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#f2f4f7" vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 11, fill: '#98a2b3' }}
                       axisLine={{ stroke: '#eaecf0' }} tickLine={false} minTickGap={22} />
                <YAxis tick={{ fontSize: 11, fill: '#98a2b3' }} axisLine={false} tickLine={false}
                       width={54} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip content={<ChartTip />} labelFormatter={fmtDay} cursor={{ stroke: '#d0d5dd', strokeWidth: 1 }} />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: 11.5, paddingTop: 6 }} />
                <Line type="monotone" dataKey={`email_${metric}`} name="Email" stroke={CHANNEL.email.color}
                      strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                <Line type="monotone" dataKey={`whatsapp_${metric}`} name="WhatsApp" stroke={CHANNEL.whatsapp.color}
                      strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="cu-chart">
            <h3>Where results came from</h3>
            <p>Opens, clicks and conversions by channel across the filtered set.</p>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={attribution} margin={{ top: 4, right: 8, left: -18, bottom: 0 }} barGap={3}>
                <CartesianGrid stroke="#f2f4f7" vertical={false} />
                <XAxis dataKey="metric" tick={{ fontSize: 10.5, fill: '#98a2b3' }} axisLine={{ stroke: '#eaecf0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10.5, fill: '#98a2b3' }} axisLine={false} tickLine={false} width={46}
                       tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(16,24,40,.04)' }} />
                {/* 2px surface gap between adjacent bars, and rounded data-ends anchored to the baseline. */}
                <Bar dataKey="email" name="Email" fill={CHANNEL.email.color} radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="whatsapp" name="WhatsApp" fill={CHANNEL.whatsapp.color} radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>

            <div style={{ borderTop: '1px solid #f2f4f7', marginTop: 10, paddingTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#344054', marginBottom: 4 }}>Sent by channel</div>
              <ResponsiveContainer width="100%" height={132}>
                <PieChart>
                  <Pie data={donut} dataKey="value" nameKey="name" innerRadius={34} outerRadius={54}
                       paddingAngle={2} stroke="#fff" strokeWidth={2}>
                    {donut.map(d => <Cell key={d.name} fill={d.fill} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11.5 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── tabs ────────────────────────────────────────────────────────────────────────── */}
      <div className="cu-tabs" role="tablist">
        {TABS.map(tb => (
          <button key={tb.key} role="tab" aria-selected={status === tb.key}
                  className="cu-tab" onClick={() => setStatus(tb.key)}>
            {tb.label} ({counts[tb.key] ?? 0})
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 13, flexWrap: 'wrap' }}>
        <div className="cu-search">
          {Ico.search}
          <input value={search} onChange={e => setSearch(e.target.value)}
                 placeholder="Search by campaign name or ID" />
        </div>
        <select className="cu-btn" style={{ background: '#fff', border: '1px solid #d0d5dd', color: '#344054' }}
                value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} aria-label="Sort by">
          <option value="recent">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A–Z</option>
          <option value="sent">Most sent</option>
          <option value="opened">Most opened</option>
          <option value="clicked">Most clicked</option>
          <option value="converted">Most conversions</option>
        </select>
        {/* The count keeps its place while a silent refresh runs — a small spinner beside a number
            that is still true reads as "checking", where swapping it for "Loading…" reads as "the
            screen threw everything away again". */}
        <span style={{ fontSize: 12.5, color: '#667085', fontWeight: 600, marginLeft: 'auto',
                       display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          {busy && <span className="cu-spin" aria-hidden="true" />}
          {loading ? 'Loading…' : `${total.toLocaleString('en-IN')} campaigns`}
        </span>
      </div>

      {activePills.length > 0 && (
        <div className="cu-applied">
          {activePills.map((p, i) => (
            <span className="cu-pill" key={`${p.k}-${p.v || i}`}>
              {p.label}
              <button onClick={() => dropPill(p)} aria-label={`Remove ${p.label} filter`}>{Ico.x}</button>
            </span>
          ))}
        </div>
      )}

      {/* ── table ───────────────────────────────────────────────────────────────────────── */}
      <div className="cu-card">
        <div className="cu-scroll">
          <table className="cu-tbl">
            <thead>
              <tr>
                <th className="l sticky">Campaign name</th>
                <th className="l">Sent on</th>
                {visibleCols.map(c => <th key={c.key}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {viewRows.map(r => {
                const b = STATUS_BADGE[r.status] || STATUS_BADGE.draft;
                const ch = CHANNEL[r.channel] || CHANNEL.email;
                return (
                  /* The row is NOT clickable. A whole-row target makes every stray click a
                     navigation — including one meant for the menu — so only the name is a link. */
                  <tr key={`${r.channel}-${r.id}`} style={{ cursor: 'default' }}
                      className={r._fresh ? 'cu-fresh' : undefined}>
                    <td className="l sticky">
                      {/* Name row: channel mark, the name itself, and the actions menu pinned to
                          the right of the same column. Keeping the menu here rather than at the
                          far end of a 1200px-wide metric table means it is never scrolled out of
                          reach — the name column is sticky, the last column is not. */}
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* The channel as a prefix rather than its own column: it is an attribute
                            of the campaign's identity, so it belongs beside the name where the eye
                            already is — and it buys back a column of horizontal space. */}
                        <span className="cu-chicon" style={{ background: ch.soft, color: ch.color }}
                              title={ch.label} aria-label={ch.label}>
                          {r.channel === 'whatsapp' ? Ico.wa : Ico.mail}
                        </span>
                        <button className="cu-namebtn" title={r.name} onClick={() => openCampaign(r)}>
                          {r.name}
                        </button>

                        {/*
                          The menu itself is rendered through a portal (below the table) rather
                          than here. Each sticky cell is its own stacking context, so a menu
                          living inside row 1's cell can never paint above row 2's — which is
                          exactly what was happening. Only the trigger stays in the row.
                        */}
                        {/* data-pop so the global outside-click handler ignores a press on the
                            trigger itself — without it, mousedown closed the menu and the click
                            that followed reopened it, and the button could never toggle shut. */}
                        <button className="cu-icon-btn cu-dots" data-pop
                                style={{ width: 28, height: 28, marginLeft: 'auto' }}
                                title="Actions" aria-haspopup="menu"
                                aria-expanded={menuFor?.key === `${r.channel}-${r.id}`}
                                aria-label={`Actions for ${r.name}`}
                                data-open={menuFor?.key === `${r.channel}-${r.id}` ? '1' : undefined}
                                onClick={e => {
                                  const key = `${r.channel}-${r.id}`;
                                  if (menuFor?.key === key) { setMenuFor(null); return; }
                                  const b = e.currentTarget.getBoundingClientRect();
                                  // Five items at ~36px plus padding. Flip above the button when
                                  // the row is near the bottom of the window.
                                  const h = (r.status === 'draft' ? 5 : 4) * 36 + 12;
                                  const below = b.bottom + h < window.innerHeight - 8;
                                  setMenuFor({ key, row: r, x: b.left, y: below ? b.bottom + 6 : b.top - 6, below });
                                }}>
                          {Ico.dots}
                        </button>
                      </span>

                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, paddingLeft: 34 }}>
                        <span className="cu-sub">ID · {r.id}</span>
                        <span className="cu-badge" style={{ background: b.bg, color: b.fg }}>{r.status}</span>
                        {r.tag_list?.length > 0 && (
                          <span className="cu-tags">{r.tag_list.slice(0, 2).map(tg => <span className="cu-tag" key={tg}>{tg}</span>)}</span>
                        )}
                      </span>
                      {/* Why it stopped, when the cause is the sending account rather than any one
                          recipient — an unregistered number, a locked WABA, a token that cannot use
                          the number. Without this the row says FAILED and the only explanation lives
                          in a per-recipient error whose text names the recipient's phone, which is
                          the one number that is definitely not at fault. */}
                      {r.last_error && (
                        <span style={{
                          display: 'block', marginTop: 5, marginLeft: 34, padding: '6px 9px',
                          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7,
                          color: '#b42318', fontSize: 11.5, lineHeight: 1.45, maxWidth: 560,
                        }}>{r.last_error}</span>
                      )}
                    </td>
                    <td className="l" style={{ color: '#667085' }}>{fmtDt(r.sent_on)}</td>
                    {visibleCols.map(c => <td key={c.key}>{cell(r, c)}</td>)}
                  </tr>
                );
              })}
              {!loading && !viewRows.length && (
                <tr><td colSpan={visibleCols.length + 2}>
                  <div className="cu-empty">
                    <b>{debounced || activePills.length ? 'Nothing matches those filters' : 'No campaigns yet'}</b>
                    {debounced || activePills.length
                      ? 'Try widening the date range or clearing a filter.'
                      : 'Create an email or WhatsApp campaign to get started.'}
                  </div>
                </td></tr>
              )}
              {loading && !viewRows.length && (
                <tr><td colSpan={visibleCols.length + 2}><div className="cu-empty">Loading campaigns…</div></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="cu-foot">
          <label style={{ fontSize: 12.5, color: '#667085' }}>
            Per page{' '}
            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
                    style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d0d5dd', fontFamily: 'inherit', fontSize: 12.5 }}>
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <span style={{ fontSize: 12.5, color: '#98a2b3' }}>Page {page} of {pages}</span>
          <div className="cu-page">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}>Next</button>
          </div>
        </div>
      </div>

      <FilterDrawer
        open={filterOpen} onClose={() => setFilterOpen(false)}
        fields={filterFields} value={filters} onApply={applyFilters}
      />

      {/*
        Row actions, portalled to document.body and positioned against the trigger's screen
        rectangle. Anchored this way for two reasons: the table scrolls horizontally, which makes
        CSS clip the vertical axis as well, and every sticky cell is its own stacking context —
        either one on its own is enough to slice the menu in half.
      */}
      {menuFor && createPortal(
        <>
          {/* A transparent full-screen layer, so the next click anywhere closes the menu without
              also activating whatever was underneath it. */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 1900 }} onClick={() => setMenuFor(null)} />
          <div className="cu-menu fixed" role="menu" data-pop
               style={{
                 position: 'fixed', left: menuFor.x, top: menuFor.y, zIndex: 1901,
                 transform: menuFor.below ? 'none' : 'translateY(-100%)',
               }}>
            <button role="menuitem" onClick={() => { setMenuFor(null); openCampaign(menuFor.row); }}>
              {Ico.eye} View report
            </button>
            <button role="menuitem" onClick={() => {
              setMenuFor(null);
              nav(menuFor.row.channel === 'whatsapp' ? `/netcore/whatsapp/${menuFor.row.id}` : `/netcore/campaigns/${menuFor.row.id}`);
            }}>
              {Ico.pencil} {menuFor.row.status === 'draft' ? 'Edit' : 'Open in editor'}
            </button>
            <button role="menuitem" onClick={() => { const r = menuFor.row; setMenuFor(null); duplicate(r); }}>
              {Ico.copy} Duplicate
            </button>
            <button role="menuitem" onClick={() => { const r = menuFor.row; setMenuFor(null); setReportFor(r); }}>
              {Ico.down} Download detailed report
            </button>
            {/* Delete is offered for drafts only. A sent campaign is a record of something that
                reached real people; removing it silently rewrites every total built from it. */}
            {menuFor.row.status === 'draft' && (
              <button role="menuitem" className="danger"
                      onClick={e => { const r = menuFor.row; setMenuFor(null); remove(r, e); }}>
                {Ico.trash} Delete
              </button>
            )}
          </div>
        </>,
        document.body,
      )}

      {reportFor && (
        <DetailedReportModal
          campaign={{ id: reportFor.id, name: reportFor.name, channel: reportFor.channel }}
          onClose={() => setReportFor(null)}
        />
      )}
    </div>
  );
}
