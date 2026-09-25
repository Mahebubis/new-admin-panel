/*
 * Kumo — Campaigns.
 *
 * The Netcore campaigns screen, kept deliberately identical in shape and
 * behaviour: the same toolbar (analytics switch, # / % toggle, column chooser,
 * CSV, Create), the same status tab strip with live counts, the same wide
 * metric table with a sticky name column and a portalled row menu, the same
 * optimistic duplicate/delete and the same quiet 10-second poll while anything
 * is still sending.
 *
 * Email only — there is no second channel on our own MTA — so the channel
 * column is gone and the indigo channel hue is simply the page accent.
 *
 * Everything reads and writes through kapi() → /api/kumo/kumo.php.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import toast from 'react-hot-toast';
import { kapi } from './kumoShared';

const ACCENT = { color: '#4f46e5', soft: '#eef2ff', ink: '#3730a3' };

const TABS = [
  { key: 'all', label: 'All' }, { key: 'draft', label: 'Drafts' }, { key: 'scheduled', label: 'Scheduled' },
  { key: 'running', label: 'Running' }, { key: 'paused', label: 'Paused' },
  { key: 'sent', label: 'Sent' }, { key: 'failed', label: 'Failed' },
];

const STATUS_BADGE = {
  draft:     { bg: '#f2f4f7', fg: '#475467' },
  scheduled: { bg: '#fef0c7', fg: '#b54708' },
  running:   { bg: '#d1e9ff', fg: '#175cd3' },
  paused:    { bg: '#fee4e2', fg: '#b42318' },
  sent:      { bg: '#dcfae6', fg: '#067647' },
  failed:    { bg: '#fee4e2', fg: '#b42318' },
};

/*
 * Every column, with the metric it divides by when the % toggle is on, and — where the API
 * already computes it — the rate field to trust instead of dividing here. The server's rate is
 * the one the report page prints, and two screens disagreeing about the same campaign's open
 * rate is worse than either number being slightly coarse.
 * `rateOf: null` means the number has no meaningful denominator and stays a count in % mode.
 */
const COLUMNS = [
  { key: 'total_recipients', label: 'Recipients',    rateOf: null },
  { key: 'sent',             label: 'Sent',          rateOf: 'total_recipients' },
  { key: 'delivered',        label: 'Delivered',     rateOf: 'sent',       rateField: 'delivery_rate' },
  { key: 'opens',            label: 'Opens',         rateOf: 'delivered' },
  { key: 'unique_opens',     label: 'Unique opens',  rateOf: 'delivered',  rateField: 'open_rate' },
  { key: 'clicks',           label: 'Clicks',        rateOf: 'delivered' },
  { key: 'unique_clicks',    label: 'Unique clicks', rateOf: 'delivered',  rateField: 'click_rate' },
  { key: 'bounced',          label: 'Bounced',       rateOf: 'sent',       rateField: 'bounce_rate' },
  { key: 'complaints',       label: 'Spam',          rateOf: 'delivered',  rateField: 'complaint_rate' },
  { key: 'unsubs',           label: 'Unsubscribed',  rateOf: 'delivered' },
];
const DEFAULT_COLS = ['total_recipients', 'sent', 'delivered', 'unique_opens', 'unique_clicks',
                      'bounced', 'complaints', 'unsubs'];

const METRIC_KEYS = ['total_recipients', 'sent', 'delivered', 'opens', 'unique_opens', 'clicks',
                     'unique_clicks', 'bounced', 'complaints', 'unsubs'];

const n0 = v => (v == null ? 'NA' : Number(v).toLocaleString('en-IN'));
const fmtDt = s => {
  if (!s) return 'NA';
  const d = new Date(String(s).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(s);
  const p = n => String(n).padStart(2, '0');
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  return `${M} ${p(d.getDate())}, ${d.getFullYear()} ${p(d.getHours() % 12 || 12)}:${p(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
};
const dayKey = s => {
  const d = new Date(String(s || '').replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return null;
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const fmtDay = s => {
  const d = new Date(String(s).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? String(s)
    : `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
/* When the campaign went out — the first of these that exists. */
const sentOn = r => r.started_at || r.completed_at || r.scheduled_at || r.created_at || null;

const CSS = `
.kmc { padding:20px 24px 40px; height:100%; overflow-y:auto; box-sizing:border-box;
  font-family:'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif; }
.kmc-h { display:flex; align-items:flex-start; gap:14px; margin-bottom:18px; flex-wrap:wrap; }
.kmc-h h1 { font-size:22px; font-weight:750; color:#101828; margin:0 0 3px; }
.kmc-h p  { font-size:13px; color:#667085; margin:0; }

.kmc-icon-btn { width:38px; height:38px; display:grid; place-items:center; border-radius:9px;
  border:1px solid #d0d5dd; background:#fff; color:#475467; cursor:pointer; position:relative;
  transition:all 170ms cubic-bezier(.4,0,.2,1); }
.kmc-icon-btn:hover { background:#f9fafb; border-color:#98a2b3; color:#101828; transform:translateY(-1px); }
.kmc-icon-btn:active { transform:translateY(0) scale(.96); }
.kmc-icon-btn:focus-visible { outline:2px solid #4f46e5; outline-offset:2px; }
.kmc-icon-btn[aria-pressed="true"] { background:#4f46e5; border-color:#4f46e5; color:#fff; }

.kmc-btn { display:inline-flex; align-items:center; gap:8px; padding:10px 17px; border-radius:9px;
  font-size:13.5px; font-weight:650; font-family:inherit; cursor:pointer; border:1px solid transparent;
  transition:background 170ms cubic-bezier(.4,0,.2,1), box-shadow 170ms, transform 90ms, border-color 170ms; }
.kmc-btn:active { transform:translateY(1px); }
.kmc-btn:focus-visible { outline:2px solid #4f46e5; outline-offset:2px; }
.kmc-btn-solid { background:#4f46e5; color:#fff; box-shadow:0 1px 2px rgba(16,24,40,.06); }
.kmc-btn-solid:hover { background:#4338ca; box-shadow:0 6px 16px rgba(79,70,229,.32); }

.kmc-seg { display:inline-flex; border:1px solid #d0d5dd; border-radius:9px; overflow:hidden; background:#fff; }
.kmc-seg button { padding:0 13px; height:38px; border:0; background:none; font-family:inherit; font-size:12.5px;
  font-weight:700; color:#667085; cursor:pointer; transition:background 150ms, color 150ms; }
.kmc-seg button + button { border-left:1px solid #e4e7ec; }
.kmc-seg button:hover { background:#f9fafb; color:#101828; }
.kmc-seg button[aria-pressed="true"] { background:#4f46e5; color:#fff; }

/* tabs */
.kmc-tabs { display:flex; gap:2px; border-bottom:1px solid #e4e7ec; margin:6px 0 16px; overflow-x:auto; }
.kmc-tab { position:relative; padding:11px 15px; border:0; background:none; cursor:pointer; white-space:nowrap;
  font-family:inherit; font-size:13.5px; font-weight:650; color:#667085; border-radius:8px 8px 0 0;
  transition:color 160ms cubic-bezier(.4,0,.2,1), background 160ms; }
.kmc-tab:hover { color:#344054; background:#f9fafb; }
.kmc-tab:focus-visible { outline:2px solid #4f46e5; outline-offset:-2px; }
.kmc-tab[aria-selected="true"] { color:#4f46e5; }
.kmc-tab::after { content:''; position:absolute; left:9px; right:9px; bottom:-1px; height:2px; border-radius:2px 2px 0 0;
  background:currentColor; transform:scaleX(0); transition:transform 200ms cubic-bezier(.4,0,.2,1); }
.kmc-tab[aria-selected="true"]::after { transform:scaleX(1); }

/* search */
.kmc-search { position:relative; flex:1 1 280px; max-width:400px; }
.kmc-search input { width:100%; box-sizing:border-box; padding:10px 12px 10px 36px; border:1px solid #d0d5dd;
  border-radius:9px; font-size:13px; font-family:inherit; color:#101828; background:#fff; outline:none;
  transition:border-color 170ms cubic-bezier(.4,0,.2,1), box-shadow 170ms; }
.kmc-search input:hover { border-color:#98a2b3; }
.kmc-search input:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,.14); }
.kmc-search svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#98a2b3; }

/* table */
.kmc-card { background:#fff; border:1px solid #e4e7ec; border-radius:12px; overflow:hidden;
  box-shadow:0 1px 2px rgba(16,24,40,.05); }
.kmc-scroll { overflow-x:auto; }
.kmc-tbl { width:100%; border-collapse:separate; border-spacing:0; min-width:1120px; }
.kmc-tbl th { text-align:right; font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase;
  color:#667085; padding:12px 14px; background:#f9fafb; border-bottom:1px solid #e4e7ec; white-space:nowrap; }
.kmc-tbl th.l, .kmc-tbl td.l { text-align:left; }
.kmc-tbl td { padding:14px; font-size:13px; color:#344054; border-bottom:1px solid #f2f4f7;
  text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
.kmc-tbl tbody tr { transition:background 130ms cubic-bezier(.4,0,.2,1); }
.kmc-tbl tbody tr:hover { background:#f9fafb; }
.kmc-tbl tbody tr:last-child td { border-bottom:0; }
/* A row that has just been created here. It slides in and its tint fades out over two seconds —
   long enough to answer "where did my copy go?", short enough not to become a permanent label. */
.kmc-fresh > td { animation:kmc-fresh 2s cubic-bezier(.4,0,.2,1) forwards; }
.kmc-fresh > td.sticky { animation:kmc-fresh-sticky 2s cubic-bezier(.4,0,.2,1) forwards; }
@keyframes kmc-fresh { from { background:#eef2ff; } to { background:transparent; } }
@keyframes kmc-fresh-sticky { from { background:#eef2ff; } to { background:#fff; } }
.kmc-spin { width:11px; height:11px; border-radius:50%; border:1.6px solid #d0d5dd; border-top-color:#4f46e5;
  animation:kmc-rot .7s linear infinite; }
@keyframes kmc-rot { to { transform:rotate(360deg); } }
@media (prefers-reduced-motion:reduce) {
  .kmc-fresh > td, .kmc-fresh > td.sticky, .kmc-spin { animation:none; }
}
/* The name column is sticky so a wide metric table stays readable while scrolling sideways —
   without it you scroll to Bounced and can no longer tell whose bounce it is. */
.kmc-tbl th.sticky, .kmc-tbl td.sticky { position:sticky; left:0; z-index:2; background:#fff; }
.kmc-tbl th.sticky { background:#f9fafb; z-index:3; }
.kmc-tbl th.sticky, .kmc-tbl td.sticky { width:330px; min-width:330px; max-width:330px; box-sizing:border-box; }
.kmc-tbl tbody tr:hover td.sticky { background:#f9fafb; }
.kmc-tbl td.sticky::after, .kmc-tbl th.sticky::after { content:''; position:absolute; top:0; right:0; bottom:0;
  width:1px; background:#eaecf0; }

.kmc-sub { font-size:11px; color:#98a2b3; font-variant-numeric:tabular-nums; }
.kmc-na { color:#c8cdd7; }
.kmc-badge { display:inline-flex; padding:3px 9px; border-radius:999px; font-size:10.5px; font-weight:800;
  letter-spacing:.03em; text-transform:uppercase; }

.kmc-foot { display:flex; align-items:center; gap:12px; padding:13px 16px; border-top:1px solid #f2f4f7;
  background:#fcfcfd; flex-wrap:wrap; }
.kmc-page { display:flex; gap:4px; margin-left:auto; }
.kmc-page button { min-width:32px; height:32px; padding:0 9px; border-radius:7px; border:1px solid #d0d5dd;
  background:#fff; color:#475467; font-size:12.5px; font-weight:650; font-family:inherit; cursor:pointer;
  transition:all 150ms cubic-bezier(.4,0,.2,1); }
.kmc-page button:hover:not(:disabled) { background:#f9fafb; border-color:#98a2b3; }
.kmc-page button:disabled { opacity:.4; cursor:default; }

.kmc-empty { padding:64px 24px; text-align:center; color:#667085; }
.kmc-empty b { display:block; font-size:15.5px; font-weight:700; color:#344054; margin-bottom:6px; }

/* stat tiles */
.kmc-tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px; margin-bottom:18px; }
.kmc-tile { background:#fff; border:1px solid #e4e7ec; border-radius:11px; padding:14px 16px;
  box-shadow:0 1px 2px rgba(16,24,40,.05); transition:border-color 170ms, box-shadow 170ms, transform 170ms; }
.kmc-tile:hover { border-color:#c7d7fe; box-shadow:0 6px 18px rgba(16,24,40,.08); transform:translateY(-2px); }
.kmc-tile .k { font-size:11.5px; font-weight:650; color:#667085; margin-bottom:6px; }
.kmc-tile .v { font-size:23px; font-weight:750; color:#101828; font-variant-numeric:tabular-nums; letter-spacing:-.01em; }
.kmc-tile .s { margin-top:8px; font-size:10.5px; color:#667085; }

/* charts */
.kmc-charts { display:grid; grid-template-columns:1.85fr 1fr; gap:14px; margin-bottom:18px; }
@media (max-width:1180px) { .kmc-charts { grid-template-columns:1fr; } }
.kmc-chart { background:#fff; border:1px solid #e4e7ec; border-radius:12px; padding:16px 18px 10px;
  box-shadow:0 1px 2px rgba(16,24,40,.05); }
.kmc-chart h3 { font-size:13.5px; font-weight:700; color:#101828; margin:0 0 2px; }
.kmc-chart p { font-size:11.5px; color:#98a2b3; margin:0 0 14px; line-height:1.5; }
.kmc-tip { background:#fff; border:1px solid #e4e7ec; border-radius:9px; padding:9px 12px;
  box-shadow:0 8px 24px rgba(16,24,40,.12); font-size:12px; }
.kmc-tip .t { font-weight:700; color:#101828; margin-bottom:5px; }
.kmc-tip .r { display:flex; align-items:center; gap:7px; color:#475467; margin-top:2px; }
.kmc-tip .r i { width:8px; height:8px; border-radius:2px; display:block; }
.kmc-tip .r b { margin-left:auto; color:#101828; font-variant-numeric:tabular-nums; }

.kmc-metricbar { display:flex; gap:5px; flex-wrap:wrap; margin-bottom:12px; }
.kmc-metricbar button { padding:5px 11px; border-radius:999px; border:1px solid #e4e7ec; background:#fff;
  color:#667085; font-family:inherit; font-size:11.5px; font-weight:650; cursor:pointer;
  transition:all 160ms cubic-bezier(.4,0,.2,1); }
.kmc-metricbar button:hover { border-color:#98a2b3; background:#f9fafb; }
.kmc-metricbar button[aria-pressed="true"] { background:#101828; border-color:#101828; color:#fff; }

/* column chooser */
.kmc-cols { position:absolute; top:46px; right:0; z-index:20; width:230px; background:#fff;
  border:1px solid #e4e7ec; border-radius:11px; box-shadow:0 16px 40px rgba(16,24,40,.16); padding:8px;
  animation:kmc-pop 160ms cubic-bezier(.4,0,.2,1); max-height:340px; overflow:auto; }
@keyframes kmc-pop { from { opacity:0; transform:translateY(-6px) scale(.98); } to { opacity:1; transform:none; } }
.kmc-cols label { display:flex; align-items:center; gap:9px; padding:7px 9px; border-radius:7px;
  font-size:12.5px; color:#344054; cursor:pointer; transition:background 130ms; }
.kmc-cols label:hover { background:#f9fafb; }
.kmc-cols input { accent-color:#4f46e5; cursor:pointer; }

/* Portalled row menu — fixed placement is set inline. */
.kmc-menu { position:absolute; z-index:25; background:#fff; border:1px solid #e4e7ec; border-radius:10px;
  box-shadow:0 16px 40px rgba(16,24,40,.16); padding:6px; min-width:206px;
  animation:kmc-pop 150ms cubic-bezier(.4,0,.2,1); }
.kmc-menu button { display:flex; align-items:center; gap:9px; width:100%; padding:9px 11px; border:0;
  background:none; border-radius:7px; font-family:inherit; font-size:13px; color:#344054; cursor:pointer;
  text-align:left; transition:background 130ms; }
.kmc-menu button:hover { background:#f4f4ff; color:#3730a3; }
/* cu-pop animates transform to none, which would wipe out an inline translateY(-100%) at the end
   of the animation and drop a flipped menu back over the row — so this one fades only. */
.kmc-menu.fixed { animation:kmc-fade 140ms cubic-bezier(.4,0,.2,1); }
@keyframes kmc-fade { from { opacity:0 } to { opacity:1 } }
.kmc-menu button.danger { color:#b42318; }
.kmc-menu button.danger:hover { background:#fef3f2; color:#912018; }
.kmc-menu button svg { flex:none; opacity:.7; }

.kmc-chicon { width:26px; height:26px; border-radius:7px; display:grid; place-items:center; flex:none; }

/* The name is the only navigation target in the row. Styled as a link, built as a button so it
   is keyboard-reachable and announced correctly. */
.kmc-namebtn { border:0; flex:1; min-width:0; background:none; padding:0; font-family:inherit; font-size:13px; font-weight:650;
  color:#101828; cursor:pointer; text-align:left; overflow:hidden; text-overflow:ellipsis;
  white-space:nowrap; border-bottom:1px solid transparent;
  transition:color 150ms cubic-bezier(.4,0,.2,1), border-color 150ms; }
.kmc-namebtn:hover { color:#4f46e5; border-bottom-color:#a5b4fc; }
.kmc-namebtn:focus-visible { outline:2px solid #4f46e5; outline-offset:2px; border-radius:3px; }

/* The actions trigger stays quiet until it is wanted: sixty rows each showing a permanent dots
   button is a column of noise for a control almost nobody uses on almost every row. Faded, not
   removed, so nothing shifts sideways on hover and it stays in the tab order. */
.kmc-dots { opacity:0;
  transition:opacity 140ms cubic-bezier(.4,0,.2,1), background 170ms, border-color 170ms, color 170ms, transform 90ms; }
.kmc-tbl tbody tr:hover .kmc-dots, .kmc-dots:focus-visible, .kmc-dots[data-open] { opacity:1; }
.kmc-dots[data-open] { background:#eef2ff; border-color:#a5b4fc; color:#3730a3; }
@media (hover: none) { .kmc-dots { opacity:1; } }

.kmc-refresh { opacity:0; transition:opacity 140ms cubic-bezier(.4,0,.2,1), background 170ms, border-color 170ms, color 170ms, transform 90ms; }
.kmc-tbl tbody tr:hover .kmc-refresh, .kmc-refresh:focus-visible, .kmc-refresh[data-state] { opacity:1; }
.kmc-refresh[data-state="busy"] { color:#4f46e5; border-color:#c7d2fe; background:#eef2ff; cursor:progress; }
.kmc-refresh[data-state="busy"] svg { animation:kmc-rot .8s linear infinite; }
.kmc-refresh[data-state="done"] { color:#067647; border-color:#abefc6; background:#ecfdf3; }
@media (hover: none) { .kmc-refresh { opacity:1; } }
@media (prefers-reduced-motion: reduce) { .kmc-refresh[data-state="busy"] svg { animation:none; } }

/* Horizontal 3-dot loader shown in every data cell of a row while that row is refreshing. */
.kmc-dot-load{display:inline-flex;gap:4px;align-items:center;vertical-align:middle}
.kmc-dot-load span{width:6px;height:6px;border-radius:50%;background:#4f46e5;animation:kmc_dot_pulse 1.2s infinite ease-in-out}
.kmc-dot-load span:nth-child(2){animation-delay:.15s}
.kmc-dot-load span:nth-child(3){animation-delay:.30s}
@keyframes kmc_dot_pulse{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.kmc-dot-load span{animation:none;opacity:.6}}
`;

const Ico = {
  search: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>,
  down:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 11l5 5 5-5M4 21h16" /></svg>,
  gear:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  chart:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m7 14 3.5-4 3 3L20 6" /></svg>,
  plus:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
  dots:   <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="12" cy="19" r="1.9" /></svg>,
  eye:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>,
  pencil: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>,
  copy:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
  trash:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>,
  pause:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 4v16M15 4v16" /></svg>,
  play:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 3.5v17l14-8.5z" /></svg>,
  refresh: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" /><path d="M21 3v5h-5" /></svg>,
  tick:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>,
  mail:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2.8" y="5" width="18.4" height="14" rx="2.2" /><path d="m3.4 7 8.6 6 8.6-6" /></svg>,
};

/** Shared tooltip. Series colour appears as a swatch; the text stays ink, never the series hue. */
function ChartTip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="kmc-tip">
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

const DotLoad = () => <span className="kmc-dot-load" role="status" aria-label="Refreshing"><span /><span /><span /></span>;

export default function KumoCampaigns() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();

  const [rows, setRows]     = useState([]);
  const [counts, setCounts] = useState({});
  const [total, setTotal]   = useState(0);
  const [pages, setPages]   = useState(1);
  /* `loading` is first-load only — the skeleton. A refetch triggered by a filter, a poll or a
     duplicate keeps the current rows on screen and flags itself with `busy` instead, because
     emptying the table for 400ms on every refresh is most of what makes a screen feel jumpy. */
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);

  /*
   * Optimistic state, and the reason it exists.
   *
   * A duplicate or a delete is a write the user just watched themselves make, so the row must
   * appear or vanish on the same frame — not one network round-trip later. `pinned` holds rows
   * created here that the server hasn't handed back yet; `tombstones` holds rows deleted here
   * that a stale response might still be carrying. Both are reconciled away by the merge below
   * the moment the server agrees, so neither can drift into a permanent lie.
   */
  const [pinned, setPinned]         = useState([]);
  const [tombstones, setTombstones] = useState([]);
  /* Which rows still deserve the "just created" tint. A ref, not state, because it must be
     readable inside load() without making load() re-run every time it changes. */
  const freshRef = useRef(new Set());

  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch]   = useState('');
  const [debounced, setDebounced] = useState('');
  const [sort, setSort]       = useState('recent');
  const [pct, setPct]         = useState(false);
  const [showCharts, setShowCharts] = useState(() => localStorage.getItem('km_campaign_charts') === '1');
  const [metric, setMetric]   = useState('sent');

  const [colsOpen, setColsOpen] = useState(false);
  const [cols, setCols] = useState(() => {
    try { return JSON.parse(localStorage.getItem('km_campaign_cols')) || DEFAULT_COLS; }
    catch { return DEFAULT_COLS; }
  });
  useEffect(() => { localStorage.setItem('km_campaign_cols', JSON.stringify(cols)); }, [cols]);

  const [menuFor, setMenuFor] = useState(null);
  const [rowRefresh, setRowRefresh] = useState({}); // id -> 'busy' | 'done'

  const status = params.get('status') || 'all';

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // Close the transient popovers on any outside click — two of these open at once looks broken.
  useEffect(() => {
    const onDown = e => { if (!e.target.closest?.('[data-pop]')) { setColsOpen(false); setMenuFor(null); } };
    const onKey = e => { if (e.key === 'Escape') { setColsOpen(false); setMenuFor(null); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  /* A row menu is anchored to a screen position, so it must not be left floating over a table
     that has scrolled out from under it. Closed rather than repositioned: the trigger it belongs
     to has usually moved off screen by then. */
  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [menuFor]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setBusy(true); else setLoading(true);
    try {
      const d = await kapi('campaigns_list', {
        page, per_page: perPage, search: debounced, status: status === 'all' ? '' : status,
      });
      const list = d?.campaigns || [];
      // The tint follows the campaign, not the placeholder — so a copy that was pinned a moment
      // ago and has now arrived from the server doesn't lose its highlight mid-animation.
      setRows(list.map(c => (freshRef.current.has(String(c.id)) ? { ...c, _fresh: true } : c)));
      setCounts(d?.counts || {});
      const t = Number(d?.total || 0);
      setTotal(t);
      setPages(Math.max(1, Math.ceil(t / (perPage || 25))));
      /* Reconcile the optimistic state against what the server actually returned: a pin whose
         row has arrived is no longer needed, and a tombstone whose row is gone has done its job. */
      const present = new Set(list.map(c => String(c.id)));
      setPinned(p => p.filter(x => !present.has(String(x.id))));
      setTombstones(tomb => tomb.filter(k => present.has(k)));
    } catch (e) {
      toast.error(e.message || 'Could not load campaigns');
    } finally { setLoading(false); setBusy(false); }
  }, [page, perPage, debounced, status]);

  /* The first load shows the skeleton; every later one caused by a filter/page change is silent,
     so the table updates in place instead of blinking empty and back. */
  const first = useRef(true);
  useEffect(() => {
    load({ silent: !first.current });
    first.current = false;
  }, [load]);

  /* One row's refresh. There is no single-campaign stats call on the list API, so this reruns the
     same quiet list fetch the poll uses — the table updates in place, never blanks — and the row's
     icon shows spin → tick so the click is visibly answered. */
  const refreshRow = async id => {
    const key = String(id);
    if (rowRefresh[key] === 'busy') return;
    setRowRefresh(m => ({ ...m, [key]: 'busy' }));
    const started = Date.now();
    await load({ silent: true });
    await new Promise(r => setTimeout(r, Math.max(0, 450 - (Date.now() - started))));
    setRowRefresh(m => ({ ...m, [key]: 'done' }));
    setTimeout(() => setRowRefresh(m => { const n = { ...m }; if (n[key] === 'done') delete n[key]; return n; }), 1200);
  };

  const setStatus = s => { setParams(s === 'all' ? {} : { status: s }, { replace: true }); setPage(1); };

  /* Move the tab counts by hand for a write we just made, so the numbers in the tab strip agree
     with the table on the same frame. The next fetch overwrites them with the server's truth. */
  const bumpCounts = (st, delta) => {
    setCounts(c => ({ ...c, [st]: Math.max(0, (c[st] ?? 0) + delta) }));
    setTotal(t => Math.max(0, t + delta));
  };

  const openCampaign = r => nav(`/kumo/campaigns/${r.id}`);

  const remove = async r => {
    if (!window.confirm(`Delete "${r.name}"? This cannot be undone.`)) return;
    const key = String(r.id);
    try {
      await kapi('campaign_delete', { id: r.id });
      toast.success('Campaign deleted');
      // Gone from the screen now, not after the refetch — and the tombstone keeps it gone even
      // if the refetch is answered from a cache that still has it.
      setTombstones(t => (t.includes(key) ? t : [...t, key]));
      setPinned(p => p.filter(x => String(x.id) !== key));
      bumpCounts(r.status, -1);
      load({ silent: true });
    } catch (e) { toast.error(e.message || 'Could not delete'); }
  };

  /*
   * Pause / Resume.
   *
   * Worth being precise about what pausing does: it flips the campaign out of 'running', so the
   * sender stops CLAIMING new recipients on its next round. Messages already handed to the MTA
   * are gone and cannot be recalled, and delivery receipts for them keep arriving afterwards — a
   * paused campaign's Delivered count still moves. Resume picks up exactly where it stopped.
   */
  const CAN_PAUSE = ['scheduled', 'running'];

  const setRunState = async (r, act) => {
    const key = String(r.id);
    const next = act === 'campaign_pause'
      ? 'paused'
      : (r.schedule_type === 'later' && r.scheduled_at && new Date(String(r.scheduled_at).replace(' ', 'T')) > new Date() ? 'scheduled' : 'running');
    try {
      await kapi(act, { id: r.id });
      toast.success(act === 'campaign_pause'
        ? 'Campaign paused — no new recipients will be picked up'
        : 'Campaign resumed');
      // Reflect it on the row now rather than after the refetch, so the status pill and the tab
      // counts agree on the same frame.
      setRows(rs => rs.map(x => (String(x.id) === key ? { ...x, status: next } : x)));
      setPinned(p => p.map(x => (String(x.id) === key ? { ...x, status: next } : x)));
      bumpCounts(r.status, -1);
      bumpCounts(next, 1);
      load({ silent: true });
    } catch (e) { toast.error(e.message || `Could not ${act === 'campaign_pause' ? 'pause' : 'resume'} this campaign`); }
  };

  const duplicate = async r => {
    try {
      const d = await kapi('campaign_duplicate', { id: r.id });
      toast.success('Campaign duplicated as a draft');
      /* The copy goes on screen immediately, built from the row it was copied from plus the id
         the server just returned. Every metric is zeroed — a fresh draft has sent nothing. */
      if (d?.id) {
        const key = String(d.id);
        freshRef.current.add(key);
        setTimeout(() => freshRef.current.delete(key), 6000);
        const zero = {};
        METRIC_KEYS.forEach(k => { if (r[k] != null) zero[k] = 0; });
        ['delivery_rate', 'open_rate', 'click_rate', 'bounce_rate', 'complaint_rate'].forEach(k => { if (r[k] != null) zero[k] = 0; });
        setPinned(p => [{
          ...r, ...zero,
          id: d.id,
          name: d.name || `${r.name} (Copy)`,
          status: 'draft',
          scheduled_at: null, started_at: null, completed_at: null,
          created_at: d.created_at || new Date().toISOString().slice(0, 19).replace('T', ' '),
          _fresh: true,
        }, ...p.filter(x => String(x.id) !== key)]);
        bumpCounts('draft', +1);
      }
      load({ silent: true });
    } catch (e) { toast.error(e.message || 'Could not duplicate'); }
  };

  /*
   * What the table actually renders: the server's page, minus anything deleted here, plus any
   * just-created copy the server hasn't caught up with — and only where such a copy belongs. A
   * fresh draft has no business appearing under the Sent tab or on page 3, so a pin that doesn't
   * fit the current view simply waits.
   */
  const viewRows = useMemo(() => {
    const dead = new Set(tombstones);
    const serverRows = rows.filter(r => !dead.has(String(r.id)));
    const seen = new Set(serverRows.map(r => String(r.id)));

    const pinnable = page === 1 && (status === 'all' || status === 'draft');
    const base = pinnable
      ? [
          ...pinned.filter(p => !seen.has(String(p.id)) && !dead.has(String(p.id))
            && (!debounced || String(p.name).toLowerCase().includes(debounced.toLowerCase()) || String(p.id) === debounced)),
          ...serverRows,
        ]
      : serverRows;

    /* Sorting is over the page that is on screen, which is what the control can honestly promise:
       the API paginates newest-first server-side and takes no sort parameter. */
    if (sort === 'recent') return base;
    const out = [...base];
    const num = k => (a, b) => Number(b[k] || 0) - Number(a[k] || 0);
    const time = r => new Date(String(sentOn(r) || '').replace(' ', 'T')).getTime() || 0;
    if (sort === 'oldest') out.sort((a, b) => time(a) - time(b));
    else if (sort === 'name') out.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    else if (sort === 'sent') out.sort(num('sent'));
    else if (sort === 'opened') out.sort(num('unique_opens'));
    else if (sort === 'clicked') out.sort(num('unique_clicks'));
    else if (sort === 'bounced') out.sort(num('bounced'));
    return out;
  }, [rows, pinned, tombstones, page, status, debounced, sort]);

  /*
   * While something is sending, the numbers on this screen are stale the second they render — the
   * sender is writing sent/delivered counts every few seconds. Poll, but only while there is
   * actually a running or scheduled campaign to watch, and only silently. Paused while the tab is
   * hidden, so a forgotten tab isn't hitting the API all afternoon.
   */
  const hasLiveWork = (counts.running ?? 0) > 0 || (counts.scheduled ?? 0) > 0;
  useEffect(() => {
    if (!hasLiveWork) return;
    const t = setInterval(() => { if (!document.hidden) load({ silent: true }); }, 10000);
    return () => clearInterval(t);
  }, [hasLiveWork, load]);

  const visibleCols = COLUMNS.filter(c => cols.includes(c.key));

  /** A cell: a rate when % mode is on and the column has a base, a count otherwise. */
  const cell = (r, c) => {
    const v = r[c.key];
    if (v == null) return <span className="kmc-na">NA</span>;
    if (!pct || !c.rateOf) return n0(v);
    // Prefer the rate the API already computed — the report page prints the same one.
    if (c.rateField && r[c.rateField] != null) return `${Number(r[c.rateField]).toFixed(1)}%`;
    const base = Number(r[c.rateOf] || 0);
    if (!base) return <span className="kmc-na">—</span>;
    return `${((v / base) * 100).toFixed(1)}%`;
  };

  /* Totals and charts describe the campaigns currently on screen — the list API answers one page
     at a time and there is no separate summary call, so saying anything wider would be a guess. */
  const totals = useMemo(() => {
    const sum = k => viewRows.reduce((s, r) => s + Number(r[k] || 0), 0);
    return {
      sent: sum('sent'), delivered: sum('delivered'), opens: sum('unique_opens'),
      clicks: sum('unique_clicks'), bounced: sum('bounced'), complaints: sum('complaints'),
      recipients: sum('total_recipients'),
    };
  }, [viewRows]);

  const series = useMemo(() => {
    const byDay = new Map();
    viewRows.forEach(r => {
      const d = dayKey(sentOn(r));
      if (!d) return;
      const cur = byDay.get(d) || { date: d, sent: 0, delivered: 0, opens: 0, clicks: 0 };
      cur.sent += Number(r.sent || 0);
      cur.delivered += Number(r.delivered || 0);
      cur.opens += Number(r.unique_opens || 0);
      cur.clicks += Number(r.unique_clicks || 0);
      byDay.set(d, cur);
    });
    return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-45);
  }, [viewRows]);

  const donut = useMemo(() => ([
    { name: 'Delivered', value: totals.delivered, fill: '#12b76a' },
    { name: 'Bounced', value: totals.bounced, fill: '#f04438' },
    { name: 'Spam', value: totals.complaints, fill: '#f79009' },
  ].filter(d => d.value > 0)), [totals]);

  const exportCsv = () => {
    const head = ['ID', 'Name', 'Status', 'Sent on', ...visibleCols.map(c => c.label)];
    const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const lines = [head.map(esc).join(',')];
    viewRows.forEach(r => {
      lines.push([
        r.id, r.name, r.status, fmtDt(sentOn(r)),
        ...visibleCols.map(c => (r[c.key] == null ? 'NA' : r[c.key])),
      ].map(esc).join(','));
    });
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `kumo-campaigns-${status}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="kmc">
      <style>{CSS}</style>

      <div className="kmc-h">
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1>Campaigns</h1>
          <p>Every email that has been — or is about to be — sent from our own IPs, newest first.</p>
        </div>

        {/* One switch for the whole analytics band — tiles and charts together. They answer the
            same question at two levels of detail, so showing one without the other is a half
            answer, and most visits to this page are to find a campaign, not to read totals.
            Off by default; the choice is remembered. */}
        <button className="kmc-icon-btn"
                onClick={() => setShowCharts(s => { localStorage.setItem('km_campaign_charts', s ? '0' : '1'); return !s; })}
                aria-pressed={showCharts} title={showCharts ? 'Hide totals and charts' : 'Show totals and charts'}>
          {Ico.chart}
        </button>

        <div className="kmc-seg" role="group" aria-label="Show counts or rates">
          <button aria-pressed={!pct} onClick={() => setPct(false)} title="Show absolute counts">#</button>
          <button aria-pressed={pct} onClick={() => setPct(true)} title="Show rates">%</button>
        </div>

        <div style={{ position: 'relative' }} data-pop>
          <button className="kmc-icon-btn" onClick={() => setColsOpen(o => !o)} title="Choose columns">{Ico.gear}</button>
          {colsOpen && (
            <div className="kmc-cols">
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

        <button className="kmc-icon-btn" onClick={exportCsv} title="Download this list as CSV">{Ico.down}</button>

        <button className="kmc-btn kmc-btn-solid" onClick={() => nav('/kumo/campaigns/new')}>
          {Ico.plus} Create campaign
        </button>
      </div>

      {/* ── tiles ───────────────────────────────────────────────────────────────────────── */}
      {showCharts && (
        <div className="kmc-tiles">
          {[
            { k: 'Recipients', v: totals.recipients },
            { k: 'Sent', v: totals.sent },
            { k: 'Delivered', v: totals.delivered, s: totals.sent ? `${((totals.delivered / totals.sent) * 100).toFixed(1)}% of sent` : null },
            { k: 'Unique opens', v: totals.opens, s: totals.delivered ? `${((totals.opens / totals.delivered) * 100).toFixed(1)}% of delivered` : null },
            { k: 'Unique clicks', v: totals.clicks, s: totals.delivered ? `${((totals.clicks / totals.delivered) * 100).toFixed(1)}% of delivered` : null },
          ].map(tile => (
            <div className="kmc-tile" key={tile.k}>
              <div className="k">{tile.k}</div>
              <div className="v">{n0(tile.v)}</div>
              {tile.s && <div className="s">{tile.s}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ── charts ──────────────────────────────────────────────────────────────────────── */}
      {showCharts && (
        <div className="kmc-charts">
          <div className="kmc-chart">
            <h3>Performance trend</h3>
            <p>By the day each campaign went out, across the campaigns on this page. Engagement that arrives later is counted on the send&apos;s day.</p>
            <div className="kmc-metricbar">
              {[['sent', 'Sent'], ['delivered', 'Delivered'], ['opens', 'Unique opens'], ['clicks', 'Unique clicks']].map(([m, lbl]) => (
                <button key={m} aria-pressed={metric === m} onClick={() => setMetric(m)}>{lbl}</button>
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
                <Line type="monotone" dataKey={metric} name="Email" stroke={ACCENT.color}
                      strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="kmc-chart">
            <h3>What happened to the mail</h3>
            <p>Delivered against the two outcomes that cost reputation, across the campaigns on this page.</p>
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="name" innerRadius={44} outerRadius={70}
                     paddingAngle={2} stroke="#fff" strokeWidth={2}>
                  {donut.map(d => <Cell key={d.name} fill={d.fill} />)}
                </Pie>
                <Tooltip content={<ChartTip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11.5 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ borderTop: '1px solid #f2f4f7', marginTop: 4, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#667085' }}>
              <span>Bounce rate</span>
              <b style={{ color: '#101828' }}>{totals.sent ? `${((totals.bounced / totals.sent) * 100).toFixed(2)}%` : '—'}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#667085', paddingBottom: 8 }}>
              <span>Complaint rate</span>
              <b style={{ color: '#101828' }}>{totals.delivered ? `${((totals.complaints / totals.delivered) * 100).toFixed(3)}%` : '—'}</b>
            </div>
          </div>
        </div>
      )}

      {/* ── tabs ────────────────────────────────────────────────────────────────────────── */}
      <div className="kmc-tabs" role="tablist">
        {TABS.map(tb => (
          <button key={tb.key} role="tab" aria-selected={status === tb.key}
                  className="kmc-tab" onClick={() => setStatus(tb.key)}>
            {tb.label} ({tb.key === 'all'
              ? (['draft', 'scheduled', 'running', 'paused', 'sent', 'failed'].reduce((s, k) => s + Number(counts[k] || 0), 0) || total)
              : (counts[tb.key] ?? 0)})
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 13, flexWrap: 'wrap' }}>
        <div className="kmc-search">
          {Ico.search}
          <input value={search} onChange={e => setSearch(e.target.value)}
                 placeholder="Search by campaign name or ID" />
        </div>
        <select className="kmc-btn" style={{ background: '#fff', border: '1px solid #d0d5dd', color: '#344054' }}
                value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort by"
                title="Sorts the campaigns on this page — the API paginates newest-first">
          <option value="recent">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A–Z</option>
          <option value="sent">Most sent</option>
          <option value="opened">Most opened</option>
          <option value="clicked">Most clicked</option>
          <option value="bounced">Most bounced</option>
        </select>
        {/* The count keeps its place while a silent refresh runs — a small spinner beside a number
            that is still true reads as "checking", where swapping it for "Loading…" reads as "the
            screen threw everything away again". */}
        <span style={{ fontSize: 12.5, color: '#667085', fontWeight: 600, marginLeft: 'auto',
                       display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          {busy && <span className="kmc-spin" aria-hidden="true" />}
          {loading ? 'Loading…' : `${total.toLocaleString('en-IN')} campaigns`}
        </span>
      </div>

      {/* ── table ───────────────────────────────────────────────────────────────────────── */}
      <div className="kmc-card">
        <div className="kmc-scroll">
          <table className="kmc-tbl">
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
                const key = String(r.id);
                const rowBusy = rowRefresh[key] === 'busy';
                return (
                  /* The row is NOT clickable. A whole-row target makes every stray click a
                     navigation — including one meant for the menu — so only the name is a link. */
                  <tr key={key} style={{ cursor: 'default' }} className={r._fresh ? 'kmc-fresh' : undefined}>
                    <td className="l sticky">
                      {/* Name row: the mail mark, the name itself, and the actions menu pinned to
                          the right of the same column. Keeping the menu here rather than at the
                          far end of a 1100px-wide metric table means it is never scrolled out of
                          reach — the name column is sticky, the last column is not. */}
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="kmc-chicon" style={{ background: ACCENT.soft, color: ACCENT.color }}
                              title="Email" aria-label="Email">
                          {Ico.mail}
                        </span>
                        <button className="kmc-namebtn" title={r.name} onClick={() => openCampaign(r)}>
                          {r.name}
                        </button>

                        {/*
                          The menu itself is rendered through a portal (below the table) rather
                          than here. Each sticky cell is its own stacking context, so a menu living
                          inside row 1's cell can never paint above row 2's. Only the trigger stays
                          in the row. data-pop so the global outside-click handler ignores a press
                          on the trigger itself — without it, mousedown closed the menu and the
                          click that followed reopened it, and the button could never toggle shut.
                        */}
                        <button className="kmc-icon-btn kmc-dots" data-pop
                                style={{ width: 28, height: 28, marginLeft: 'auto' }}
                                title="Actions" aria-haspopup="menu"
                                aria-expanded={menuFor?.key === key}
                                aria-label={`Actions for ${r.name}`}
                                data-open={menuFor?.key === key ? '1' : undefined}
                                onClick={e => {
                                  if (menuFor?.key === key) { setMenuFor(null); return; }
                                  const bb = e.currentTarget.getBoundingClientRect();
                                  // Five items at ~36px plus padding. Flip above the button when
                                  // the row is near the bottom of the window.
                                  const h = (r.status === 'draft' ? 5 : 4) * 36 + 12;
                                  const below = bb.bottom + h < window.innerHeight - 8;
                                  setMenuFor({ key, row: r, x: bb.left, y: below ? bb.bottom + 6 : bb.top - 6, below });
                                }}>
                          {Ico.dots}
                        </button>
                        <button className="kmc-icon-btn kmc-refresh"
                                style={{ width: 28, height: 28 }}
                                title={rowRefresh[key] === 'busy' ? 'Refreshing…' : rowRefresh[key] === 'done' ? 'Up to date' : 'Refresh stats'}
                                aria-label={`Refresh stats for ${r.name}`}
                                aria-busy={rowRefresh[key] === 'busy'}
                                data-state={rowRefresh[key]}
                                onClick={() => refreshRow(r.id)}>
                          {rowRefresh[key] === 'done' ? Ico.tick : Ico.refresh}
                        </button>
                      </span>

                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, paddingLeft: 34 }}>
                        <span className="kmc-sub">ID · {r.id}</span>
                        <span className="kmc-badge" style={{ background: b.bg, color: b.fg }}>{r.status}</span>
                      </span>
                    </td>
                    <td className="l" style={{ color: '#667085' }}>{rowBusy ? <DotLoad /> : fmtDt(sentOn(r))}</td>
                    {visibleCols.map(c => <td key={c.key}>{rowBusy ? <DotLoad /> : cell(r, c)}</td>)}
                  </tr>
                );
              })}
              {!loading && !viewRows.length && (
                <tr><td colSpan={visibleCols.length + 2}>
                  <div className="kmc-empty">
                    <b>{debounced ? 'Nothing matches that search' : 'No campaigns yet'}</b>
                    {debounced
                      ? 'Try a different name or ID, or clear the search.'
                      : 'Create a campaign to get started.'}
                  </div>
                </td></tr>
              )}
              {loading && !viewRows.length && (
                <tr><td colSpan={visibleCols.length + 2}><div className="kmc-empty">Loading campaigns…</div></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="kmc-foot">
          <label style={{ fontSize: 12.5, color: '#667085' }}>
            Per page{' '}
            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
                    style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d0d5dd', fontFamily: 'inherit', fontSize: 12.5 }}>
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <span style={{ fontSize: 12.5, color: '#98a2b3' }}>Page {page} of {pages}</span>
          <div className="kmc-page">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}>Next</button>
          </div>
        </div>
      </div>

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
          <div className="kmc-menu fixed" role="menu" data-pop
               style={{
                 position: 'fixed', left: menuFor.x, top: menuFor.y, zIndex: 1901,
                 transform: menuFor.below ? 'none' : 'translateY(-100%)',
               }}>
            <button role="menuitem" onClick={() => { setMenuFor(null); openCampaign(menuFor.row); }}>
              {Ico.eye} View report
            </button>
            <button role="menuitem" onClick={() => { const r = menuFor.row; setMenuFor(null); nav(`/kumo/campaigns/${r.id}/edit`); }}>
              {Ico.pencil} {menuFor.row.status === 'draft' ? 'Edit' : 'Open in editor'}
            </button>
            <button role="menuitem" onClick={() => { const r = menuFor.row; setMenuFor(null); duplicate(r); }}>
              {Ico.copy} Duplicate
            </button>
            {/* Pause is only meaningful while there are recipients still waiting to be claimed. A
                campaign that has already finished has nothing left to stop. */}
            {CAN_PAUSE.includes(menuFor.row.status) && (
              <button role="menuitem" onClick={() => { const r = menuFor.row; setMenuFor(null); setRunState(r, 'campaign_pause'); }}>
                {Ico.pause} Pause sending
              </button>
            )}
            {menuFor.row.status === 'paused' && (
              <button role="menuitem" onClick={() => { const r = menuFor.row; setMenuFor(null); setRunState(r, 'campaign_resume'); }}>
                {Ico.play} Resume sending
              </button>
            )}
            {/* Delete is offered for drafts only. A sent campaign is a record of something that
                reached real people; removing it silently rewrites every total built from it. */}
            {menuFor.row.status === 'draft' && (
              <button role="menuitem" className="danger" onClick={() => { const r = menuFor.row; setMenuFor(null); remove(r); }}>
                {Ico.trash} Delete
              </button>
            )}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
