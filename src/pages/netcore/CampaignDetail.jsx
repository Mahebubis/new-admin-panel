import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import CampaignPreviewPanels from './CampaignPreviewPanels';
import DetailedReportModal from './DetailedReportModal';
import CampaignPeoplePanels from './CampaignPeoplePanels';

/*
 * One campaign, two tabs: Performance and Preview.
 *
 * Both channels land here. They report different things — WhatsApp has read receipts and no
 * bounces, email has bounces and no replies — so the tiles are built per channel rather than
 * forced into a shared shape with zeroes standing in for "not applicable".
 *
 * WHAT THE CHARTS ARE FOR
 *   funnel        the drop between each stage, which is the one view that shows WHERE a campaign
 *                 lost people rather than only that it did. Bars, not a pie: these are stages of
 *                 one population and the comparison is between adjacent magnitudes.
 *   engagement    the split of a whole (user vs bot opens, delivered vs bounced) — the one case a
 *                 ring is genuinely right, because the parts sum to a meaningful total.
 *   link table    which link earned the clicks. A table, not a chart: the labels are URLs and
 *                 the values are read individually rather than compared visually.
 */

const EMAIL_API = '/api/campaigns/campaigns.php';
const WA_API    = '/api/whatsapp/wa_campaigns.php';

const CHANNEL = {
  email:    { label: 'Email',    color: '#4f46e5', soft: '#eef2ff', ink: '#3730a3' },
  whatsapp: { label: 'WhatsApp', color: '#00A37A', soft: '#e6f7f1', ink: '#046c52' },
};

/* Funnel stage colours: one hue, light→dark, because these are stages of a magnitude and not
   separate identities. A categorical palette here would imply the stages are unrelated. */
const FUNNEL_RAMP = ['#c7d7fe', '#a4bcfd', '#8098f9', '#6172f3', '#444ce7'];
const FUNNEL_RAMP_WA = ['#bdf0dd', '#8ae0c4', '#4fcda5', '#1fb98a', '#00A37A'];

const n0 = v => (v == null ? 'NA' : Number(v).toLocaleString('en-IN'));
const rate = (v, base) => (!base || v == null ? null : `${((v / base) * 100).toFixed(2)}%`);
const fmtDt = s => {
  if (!s) return null;
  const d = new Date(String(s).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(s);
  const p = n => String(n).padStart(2, '0');
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  return `${M} ${p(d.getDate())}, ${d.getFullYear()} ${p(d.getHours() % 12 || 12)}:${p(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
};

const CSS = `
.cd { height:100%; overflow-y:auto; background:#f9fafb; }
.cd-head { background:#fff; border-bottom:1px solid #e4e7ec; padding:16px 24px 0; position:sticky; top:0; z-index:5; }
.cd-top { display:flex; align-items:flex-start; gap:13px; }
.cd-back { width:34px; height:34px; display:grid; place-items:center; border:1px solid #e4e7ec; background:#fff;
  border-radius:9px; color:#475467; cursor:pointer; flex:none; transition:all 160ms cubic-bezier(.4,0,.2,1); }
.cd-back:hover { background:#f9fafb; border-color:#98a2b3; color:#101828; transform:translateX(-1px); }
.cd-ic { width:38px; height:38px; border-radius:10px; display:grid; place-items:center; flex:none; }
.cd-top h1 { font-size:18px; font-weight:750; color:#101828; margin:0 0 4px; line-height:1.3; }
.cd-meta { font-size:11.5px; color:#98a2b3; display:flex; gap:9px; align-items:center; flex-wrap:wrap; }
.cd-chip { display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:999px;
  font-size:11px; font-weight:700; }

.cd-tabs { display:flex; gap:2px; margin-top:14px; }
.cd-tab { position:relative; padding:11px 16px; border:0; background:none; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:650; color:#667085; border-radius:8px 8px 0 0;
  transition:color 160ms cubic-bezier(.4,0,.2,1), background 160ms; }
.cd-tab:hover { color:#344054; background:#f9fafb; }
.cd-tab:focus-visible { outline:2px solid #4f46e5; outline-offset:-2px; }
.cd-tab[aria-selected="true"] { color:#4f46e5; }
.cd-tab::after { content:''; position:absolute; left:10px; right:10px; bottom:0; height:2px; border-radius:2px 2px 0 0;
  background:currentColor; transform:scaleX(0); transition:transform 200ms cubic-bezier(.4,0,.2,1); }
.cd-tab[aria-selected="true"]::after { transform:scaleX(1); }

.cd-body { padding:20px 24px 40px; animation:cd-fade 220ms cubic-bezier(.4,0,.2,1); }
@keyframes cd-fade { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }

.cd-strip { background:#fff; border:1px solid #e4e7ec; border-radius:12px; display:grid;
  grid-template-columns:repeat(auto-fit, minmax(122px,1fr)); gap:1px; overflow:hidden; margin-bottom:16px;
  box-shadow:0 1px 2px rgba(16,24,40,.05); }
.cd-stat { background:#fff; padding:14px 16px; }
.cd-stat .k { font-size:11px; color:#667085; font-weight:650; margin-bottom:5px; }
.cd-stat .v { font-size:21px; font-weight:750; color:#101828; font-variant-numeric:tabular-nums; letter-spacing:-.01em; }
.cd-stat .p { font-size:11px; color:#98a2b3; font-variant-numeric:tabular-nums; margin-top:2px; }
.cd-stat.na .v { color:#c8cdd7; font-size:16px; }

.cd-grid { display:grid; grid-template-columns:1.6fr 1fr; gap:14px; align-items:start; }
@media (max-width:1080px) { .cd-grid { grid-template-columns:1fr; } }
.cd-card { background:#fff; border:1px solid #e4e7ec; border-radius:12px; padding:16px 18px;
  box-shadow:0 1px 2px rgba(16,24,40,.05); margin-bottom:14px; }
.cd-card h3 { font-size:13.5px; font-weight:700; color:#101828; margin:0 0 2px; }
.cd-card p.sub { font-size:11.5px; color:#98a2b3; margin:0 0 14px; line-height:1.5; }

.cd-tip { background:#fff; border:1px solid #e4e7ec; border-radius:9px; padding:9px 12px;
  box-shadow:0 8px 24px rgba(16,24,40,.12); font-size:12px; }
.cd-tip .t { font-weight:700; color:#101828; margin-bottom:5px; }
.cd-tip .r { display:flex; align-items:center; gap:7px; color:#475467; margin-top:2px; }
.cd-tip .r i { width:8px; height:8px; border-radius:2px; display:block; }
.cd-tip .r b { margin-left:auto; color:#101828; font-variant-numeric:tabular-nums; }

.cd-tbl { width:100%; border-collapse:collapse; }
.cd-tbl th { text-align:left; font-size:10.5px; font-weight:700; letter-spacing:.04em; text-transform:uppercase;
  color:#667085; padding:9px 10px; border-bottom:1px solid #eaecf0; }
.cd-tbl th.r, .cd-tbl td.r { text-align:right; }
.cd-tbl td { padding:11px 10px; font-size:12.5px; color:#344054; border-bottom:1px solid #f2f4f7;
  font-variant-numeric:tabular-nums; }
.cd-tbl tr:last-child td { border-bottom:0; }
.cd-link { max-width:330px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#3538cd; }

.cd-btn { display:inline-flex; align-items:center; gap:7px; padding:9px 16px; border-radius:8px; font-size:13px;
  font-weight:650; font-family:inherit; cursor:pointer; border:1px solid transparent;
  transition:background 160ms cubic-bezier(.4,0,.2,1), box-shadow 160ms, transform 90ms, border-color 160ms; }
.cd-btn:active { transform:translateY(1px); }
.cd-btn-solid { background:#4f46e5; color:#fff; }
.cd-btn-solid:hover { background:#4338ca; box-shadow:0 5px 14px rgba(79,70,229,.3); }
.cd-btn-ghost { background:#fff; color:#344054; border-color:#d0d5dd; }
.cd-btn-ghost:hover { background:#f9fafb; border-color:#98a2b3; }
.cd-empty { padding:40px 16px; text-align:center; color:#98a2b3; font-size:12.5px; }
`;

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="cd-tip">
      <div className="t">{label ?? payload[0]?.name}</div>
      {payload.map(p => (
        <div className="r" key={p.dataKey || p.name}>
          <i style={{ background: p.color || p.payload?.fill }} />
          {p.name}<b>{Number(p.value).toLocaleString('en-IN')}</b>
        </div>
      ))}
    </div>
  );
}

export default function CampaignDetail() {
  const { channel, id } = useParams();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const isWa = channel === 'whatsapp';
  const accent = CHANNEL[isWa ? 'whatsapp' : 'email'];

  const tab = params.get('tab') === 'preview' ? 'preview' : 'performance';
  const setTab = t => setParams(t === 'performance' ? {} : { tab: t }, { replace: true });

  const [camp, setCamp]     = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dlOpen, setDlOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = isWa ? WA_API : EMAIL_API;
      const [g, r] = await Promise.all([
        api.get(url, { params: { action: 'get', id } }),
        api.get(url, { params: { action: 'report', id, per_page: 25 } }),
      ]);
      if (g.data?.success) setCamp(g.data.data.campaign);
      if (r.data?.success) setReport(r.data.data);
      if (!g.data?.success && !r.data?.success) toast.error('Could not load the campaign');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not load the campaign');
    } finally { setLoading(false); }
  }, [isWa, id]);

  useEffect(() => { load(); }, [load]);

  const c = report?.campaign || camp;

  /* Per-channel tiles. NA where the channel does not report the metric — a 0 there would read
     as a real measurement, which is exactly the wrong impression. */
  const tiles = useMemo(() => {
    if (!c) return [];
    const published = Number(c.total_recipients || 0);
    const sent = Number(c.sent_count || 0);
    const delivered = Number(c.delivered_count || 0);
    if (isWa) {
      const read = Number(c.read_count || 0);
      return [
        { k: 'Published', v: published },
        { k: 'Sent', v: sent, p: rate(sent, published) },
        { k: 'Delivered', v: delivered, p: rate(delivered, sent) },
        { k: 'Read', v: read, p: rate(read, delivered) },
        { k: 'Clicked', v: Number(c.clicked_users ?? c.click_count ?? 0), p: rate(c.clicked_users ?? c.click_count, delivered) },
        { k: 'Replied', v: Number(c.reply_count || 0), p: rate(c.reply_count, delivered) },
        { k: 'Failed', v: Number(c.failed_count || 0), p: rate(c.failed_count, sent) },
        { k: 'Conversions', v: Number(c.conversion_count || 0), p: rate(c.conversion_count, sent) },
      ];
    }
    const uOpen = Number(c.unique_open_count || 0);
    const uClick = Number(c.unique_click_count || 0);
    return [
      { k: 'Published', v: published },
      { k: 'Sent', v: sent, p: rate(sent, published) },
      { k: 'Delivered', v: delivered, p: rate(delivered, sent) },
      { k: 'Total opens', v: Number(c.open_count || 0), p: rate(c.open_count, delivered) },
      { k: 'Unique opens', v: uOpen, p: rate(uOpen, delivered) },
      { k: 'Unique clicks', v: uClick, p: rate(uClick, delivered) },
      // Click-to-open: of the people who opened it, how many clicked. The single most useful
      // email number, and the one a plain click rate hides behind deliverability.
      { k: 'CTOR', v: uOpen ? Number(((uClick / uOpen) * 100).toFixed(2)) : 0, suffix: '%' },
      { k: 'Bounce', v: Number(c.bounce_count || 0), p: rate(c.bounce_count, sent) },
      { k: 'Unsubscribed', v: Number(c.unsubscribe_count || 0), p: rate(c.unsubscribe_count, delivered) },
      { k: 'Conversions', v: Number(c.conversion_count || 0), p: rate(c.conversion_count, sent) },
    ];
  }, [c, isWa]);

  const funnel = useMemo(() => {
    if (!c) return [];
    const ramp = isWa ? FUNNEL_RAMP_WA : FUNNEL_RAMP;
    const stages = isWa
      ? [['Published', c.total_recipients], ['Sent', c.sent_count], ['Delivered', c.delivered_count],
         ['Read', c.read_count], ['Clicked', c.clicked_users ?? c.click_count]]
      : [['Published', c.total_recipients], ['Sent', c.sent_count], ['Delivered', c.delivered_count],
         ['Opened', c.unique_open_count], ['Clicked', c.unique_click_count]];
    return stages.map(([name, v], i) => ({ name, value: Number(v || 0), fill: ramp[i] }));
  }, [c, isWa]);

  const ring = useMemo(() => {
    if (!c) return [];
    if (isWa) {
      const delivered = Number(c.delivered_count || 0);
      const failed = Number(c.failed_count || 0);
      const pending = Math.max(0, Number(c.sent_count || 0) - delivered - failed);
      return [
        { name: 'Delivered', value: delivered, fill: '#00A37A' },
        { name: 'Failed', value: failed, fill: '#d92d20' },
        { name: 'Awaiting receipt', value: pending, fill: '#d0d5dd' },
      ].filter(d => d.value > 0);
    }
    const bot = Number(c.bot_open_count || 0);
    const human = Math.max(0, Number(c.open_count || 0) - bot);
    const unopened = Math.max(0, Number(c.delivered_count || 0) - Number(c.unique_open_count || 0));
    return [
      { name: 'Opened by a person', value: human, fill: '#4f46e5' },
      { name: 'Machine prefetch', value: bot, fill: '#a4bcfd' },
      { name: 'Not opened', value: unopened, fill: '#e4e7ec' },
    ].filter(d => d.value > 0);
  }, [c, isWa]);

  /* Link performance, derived from the report's click events. Aggregated here rather than asking
     for another endpoint — the feed is already loaded and the click set is small. */
  const links = useMemo(() => {
    const evs = (report?.events || []).filter(e => e.event_type === 'click' && e.url);
    const by = {};
    evs.forEach(e => { by[e.url] = (by[e.url] || 0) + 1; });
    const rows = Object.entries(by).map(([url, clicks]) => ({ url, clicks }))
      .sort((a, b) => b.clicks - a.clicks);
    const total = rows.reduce((s, r) => s + r.clicks, 0);
    return { rows, total };
  }, [report]);

  if (loading && !c) {
    return <div className="cd"><style>{CSS}</style><div className="cd-empty" style={{ padding: 90 }}>Loading campaign…</div></div>;
  }
  if (!c) {
    return <div className="cd"><style>{CSS}</style><div className="cd-empty" style={{ padding: 90 }}>Campaign not found.</div></div>;
  }

  const sentOn = c.completed_at || c.started_at || c.scheduled_at || c.created_at;

  return (
    <div className="cd">
      <style>{CSS}</style>

      <div className="cd-head">
        <div className="cd-top">
          <button className="cd-back" onClick={() => nav('/netcore/campaigns')} aria-label="Back to campaigns">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <div className="cd-ic" style={{ background: accent.soft, color: accent.color }}>
            {isWa
              ? <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M12.05 21.8h-.02a9.8 9.8 0 0 1-4.99-1.37l-.36-.21-3.71.97.99-3.62-.23-.37a9.79 9.79 0 0 1-1.5-5.22c0-5.41 4.4-9.81 9.82-9.81a9.75 9.75 0 0 1 6.94 2.88 9.74 9.74 0 0 1 2.87 6.94c0 5.41-4.4 9.81-9.81 9.81M20.52 3.45A11.66 11.66 0 0 0 12.05 0C5.6 0 .35 5.25.35 11.7c0 2.06.54 4.08 1.56 5.85L.25 24l6.59-1.73a11.66 11.66 0 0 0 5.2 1.24h.01c6.45 0 11.7-5.25 11.7-11.7 0-3.13-1.22-6.07-3.43-8.28" /></svg>
              : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2.8" y="5" width="18.4" height="14" rx="2.2" /><path d="m3.4 7 8.6 6 8.6-6" /></svg>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{c.name}</h1>
            <div className="cd-meta">
              <span className="cd-chip" style={{ background: accent.soft, color: accent.ink }}>{accent.label}</span>
              <span style={{ textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.04em' }}>{c.status}</span>
              <span>ID {c.id}</span>
              {sentOn && <span>· Sent {fmtDt(sentOn)}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            <button className="cd-btn cd-btn-ghost" onClick={() => setDlOpen(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 11l5 5 5-5M4 21h16" /></svg>
              Detailed report
            </button>
            {c.status === 'draft' && (
              <button className="cd-btn cd-btn-solid"
                      onClick={() => nav(isWa ? `/netcore/whatsapp/${c.id}` : `/netcore/campaigns/${c.id}`)}>
                Edit campaign
              </button>
            )}
          </div>
        </div>

        <div className="cd-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'performance'} className="cd-tab" onClick={() => setTab('performance')}>Performance</button>
          <button role="tab" aria-selected={tab === 'preview'} className="cd-tab" onClick={() => setTab('preview')}>Preview</button>
        </div>
      </div>

      <div className="cd-body" key={tab}>
        {tab === 'performance' ? (
          <>
            <div className="cd-strip">
              {tiles.map(t => (
                <div className={`cd-stat${t.v == null ? ' na' : ''}`} key={t.k}>
                  <div className="k">{t.k}</div>
                  <div className="v">{t.v == null ? 'NA' : n0(t.v)}{t.suffix || ''}</div>
                  {t.p && <div className="p">{t.p}</div>}
                </div>
              ))}
            </div>

            <div className="cd-grid">
              <div>
                <div className="cd-card">
                  <h3>Delivery funnel</h3>
                  <p className="sub">
                    Where the campaign lost people. Each bar is the stage total, so the gap between
                    two neighbours is the drop at that step.
                  </p>
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={funnel} margin={{ top: 6, right: 12, left: -14, bottom: 0 }}>
                      <CartesianGrid stroke="#f2f4f7" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11.5, fill: '#98a2b3' }} axisLine={{ stroke: '#eaecf0' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#98a2b3' }} axisLine={false} tickLine={false} width={54}
                             tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                      <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(16,24,40,.04)' }} />
                      {/* 4px rounded data-ends anchored to the baseline; a 2px surface gap keeps
                          adjacent bars from reading as one shape. */}
                      <Bar dataKey="value" name="Recipients" radius={[4, 4, 0, 0]} maxBarSize={54}>
                        {funnel.map(d => <Cell key={d.name} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {!isWa && (
                  <div className="cd-card">
                    <h3>Link performance</h3>
                    <p className="sub">
                      {links.total > 0
                        ? `${links.rows.length} link${links.rows.length === 1 ? '' : 's'} clicked · ${n0(links.total)} clicks in the loaded activity`
                        : 'No clicks recorded yet.'}
                    </p>
                    {links.rows.length ? (
                      <table className="cd-tbl">
                        <thead><tr><th>Link</th><th className="r">Clicks</th><th className="r">Share</th></tr></thead>
                        <tbody>
                          {links.rows.slice(0, 12).map(l => (
                            <tr key={l.url}>
                              <td><div className="cd-link" title={l.url}>{l.url}</div></td>
                              <td className="r">{n0(l.clicks)}</td>
                              <td className="r" style={{ color: '#667085' }}>{((l.clicks / links.total) * 100).toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <div className="cd-empty">Nothing to show yet.</div>}
                  </div>
                )}
              </div>

              <div>
                <div className="cd-card">
                  <h3>{isWa ? 'Delivery outcome' : 'Open quality'}</h3>
                  <p className="sub">
                    {isWa
                      ? 'Of everything the provider accepted, what actually reached a handset.'
                      : 'Apple and Gmail prefetch images, so some opens are machines. Only the human share is worth reading as interest.'}
                  </p>
                  {ring.length ? (
                    <ResponsiveContainer width="100%" height={222}>
                      <PieChart>
                        <Pie data={ring} dataKey="value" nameKey="name" innerRadius={48} outerRadius={74}
                             paddingAngle={2} stroke="#fff" strokeWidth={2}>
                          {ring.map(d => <Cell key={d.name} fill={d.fill} />)}
                        </Pie>
                        <Tooltip content={<ChartTip />} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 11.5 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div className="cd-empty">No delivery data yet.</div>}
                </div>

                <div className="cd-card">
                  <h3>Conversion goal</h3>
                  {c.goal_event_name ? (
                    <>
                      <p className="sub">Attributed to this campaign within its conversion window.</p>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                        <span style={{ fontSize: 30, fontWeight: 750, color: '#101828', fontVariantNumeric: 'tabular-nums' }}>
                          {n0(c.conversion_count || 0)}
                        </span>
                        <span style={{ fontSize: 12.5, color: '#667085' }}>
                          on <b style={{ color: '#344054' }}>{c.goal_event_name}</b>
                          {c.goal_window_days ? ` · ${c.goal_window_days}-day window` : ''}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="sub" style={{ margin: 0 }}>
                      No goal was set on this campaign, so nothing is attributed to it. Conversions
                      stay at zero whatever recipients go on to do.
                    </p>
                  )}
                </div>

                {report?.failed_recipients?.length > 0 && (
                  <div className="cd-card">
                    <h3>Recent failures</h3>
                    <p className="sub">What the provider actually said, most recent first.</p>
                    <table className="cd-tbl">
                      <thead><tr><th>{isWa ? 'Phone' : 'Email'}</th><th>Reason</th></tr></thead>
                      <tbody>
                        {report.failed_recipients.slice(0, 8).map((f, i) => (
                          <tr key={i}>
                            <td>{f.email || f.phone}</td>
                            <td style={{ color: '#b42318', fontSize: 11.5 }}>{f.error_message || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* The numbers above, opened up into the people behind them: what happened to every
                recipient (with the provider's reason on anything that failed), who clicked, and
                who converted. Below the charts because the charts answer "how did it do" and
                these answer "who" — which is the follow-up, not the opening question. */}
            <CampaignPeoplePanels
              channel={isWa ? 'whatsapp' : 'email'}
              campaignId={c.id}
              goalEvent={c.goal_event_name}
              senderNumber={isWa ? c.business_number : null}
            />
          </>
        ) : (
          <CampaignPreviewPanels
            channel={isWa ? 'whatsapp' : 'email'}
            row={{
              id: c.id, name: c.name, channel: isWa ? 'whatsapp' : 'email', status: c.status,
              published: Number(c.total_recipients || 0), sent: Number(c.sent_count || 0),
              delivered: Number(c.delivered_count || 0),
              opened: Number(isWa ? c.read_count : c.unique_open_count) || 0,
              clicked: Number(isWa ? (c.clicked_users ?? c.click_count) : c.unique_click_count) || 0,
              conversions: Number(c.conversion_count || 0),
              bounce: isWa ? null : Number(c.bounce_count || 0),
              unsubscribed: isWa ? null : Number(c.unsubscribe_count || 0),
              undelivered: isWa ? Number(c.failed_count || 0) : null,
              replied: isWa ? Number(c.reply_count || 0) : null,
              goal_event_name: c.goal_event_name, provider: c.esp_transport || c.send_provider,
              tag_list: String(c.tags || '').split(',').map(s => s.trim()).filter(Boolean),
            }}
            full={c}
            loading={false}
          />
        )}
      </div>

      {dlOpen && (
        <DetailedReportModal
          campaign={{ id: c.id, name: c.name, channel: isWa ? 'whatsapp' : 'email' }}
          onClose={() => setDlOpen(false)}
        />
      )}
    </div>
  );
}
