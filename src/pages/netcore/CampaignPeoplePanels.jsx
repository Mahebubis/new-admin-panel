import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Search, Download, ChevronLeft, ChevronRight, Users, MousePointerClick, Target, ListChecks } from 'lucide-react';

/*
 * Who clicked, and who converted — by name, for both channels.
 *
 * ── Why this is one component and not two ────────────────────────────────────
 * Email and WhatsApp answer these questions from completely different tables — email from
 * email_campaign_events joined to its recipients, WhatsApp from wa_link_clicks joined to its
 * own — but they answer the SAME question, and the person reading the answer does not care
 * which table it came from. Two components would drift: one would gain a search box, the other
 * an export, and the WhatsApp report would quietly become the worse one because it is opened
 * less often. So the shape is shared and only the endpoint differs.
 *
 * ── Unique by default ────────────────────────────────────────────────────────
 * Raw taps flatter the number. One person opening a message twice on a phone and once on a
 * laptop is three rows and one interested human, and "who clicked" is a question about humans.
 * The per-tap view is one toggle away for when the question is really "what did they do" — both
 * come from the same rows, so the two views can never disagree.
 *
 * ── The identity fallback ladder ─────────────────────────────────────────────
 * A WhatsApp tap frequently knows only a phone number: the link opens in the phone's browser,
 * usually logged out. The server joins back to the campaign's recipient row to recover a name,
 * but a forwarded message genuinely belongs to nobody in the audience — so the display falls
 * back name → email → phone → identity key rather than rendering an empty cell, and says
 * plainly when the person was not in this campaign's audience.
 */

const EMAIL_API = '/api/campaigns/campaigns.php';
const WA_API    = '/api/whatsapp/wa_campaigns.php';
const FORM      = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

const n0 = v => Number(v || 0).toLocaleString('en-IN');

const fmt = v => {
  if (!v) return '—';
  const d = new Date(String(v).replace(' ', 'T'));
  if (isNaN(d.getTime())) return String(v).slice(0, 16);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/** name → email → phone → identity key. Never an empty cell. */
function who(r) {
  const name = (r.name || '').trim();
  if (name) return name;
  if (r.email) return r.email;
  if (r.phone) return r.phone;
  const k = String(r.identity_key || '');
  return k.startsWith('visitor:') ? 'Anonymous visitor' : (k || '—');
}

/** The second line under the name — whichever identifiers are left over. */
function subtitle(r) {
  const name = (r.name || '').trim();
  const bits = [];
  if (name && r.email) bits.push(r.email);
  if (r.phone && (name || r.email)) bits.push(r.phone);
  return bits.join(' · ');
}

const CSS = `
.cp-card { background:#fff; border:1px solid #e4e7ec; border-radius:12px; padding:18px 20px;
  box-shadow:0 1px 2px rgba(16,24,40,.05); margin-top:16px; }
.cp-head { display:flex; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
.cp-head h3 { margin:0 0 3px; font-size:14.5px; font-weight:750; color:#101828;
  display:flex; align-items:center; gap:7px; }
.cp-head .sub { margin:0; font-size:12.5px; color:#667085; line-height:1.55; max-width:560px; }
.cp-tools { display:flex; align-items:center; gap:8px; margin-left:auto; flex-wrap:wrap; }
.cp-search { position:relative; }
.cp-search svg { position:absolute; left:9px; top:50%; transform:translateY(-50%); color:#98a2b3; }
.cp-search input { padding:7px 10px 7px 30px; border:1px solid #d0d5dd; border-radius:8px;
  font-size:12.5px; font-family:inherit; outline:none; width:190px;
  transition:border-color 160ms, box-shadow 160ms; }
.cp-search input:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,.14); }
.cp-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 12px; border-radius:8px;
  font-size:12.5px; font-weight:650; font-family:inherit; cursor:pointer;
  border:1px solid #d0d5dd; background:#fff; color:#344054; white-space:nowrap;
  transition:background 150ms, border-color 150ms, color 150ms; }
.cp-btn:hover:not(:disabled) { background:#f9fafb; border-color:#98a2b3; }
.cp-btn:disabled { opacity:.45; cursor:not-allowed; }
.cp-btn.on { background:#101828; border-color:#101828; color:#fff; }
.cp-tbl { width:100%; border-collapse:collapse; font-size:12.5px; }
.cp-tbl th { text-align:left; padding:8px 10px; font-size:10.5px; font-weight:700; color:#667085;
  text-transform:uppercase; letter-spacing:.04em; border-bottom:1px solid #e4e7ec; white-space:nowrap; }
.cp-tbl td { padding:10px; border-bottom:1px solid #f2f4f7; color:#344054; vertical-align:top; }
.cp-tbl tr:last-child td { border-bottom:0; }
.cp-tbl tr:hover td { background:#fcfcfd; }
.cp-who { font-weight:650; color:#101828; }
.cp-sub { font-size:11px; color:#98a2b3; margin-top:2px; }
.cp-num { font-variant-numeric:tabular-nums; white-space:nowrap; }
.cp-url { font-size:11px; color:#4f46e5; word-break:break-all; max-width:280px; display:inline-block; }
.cp-empty { padding:32px 12px; text-align:center; color:#667085; font-size:12.5px; line-height:1.6; }
.cp-foot { display:flex; align-items:center; gap:10px; margin-top:12px; }
.cp-foot .n { margin-left:auto; font-size:12px; color:#667085; }
`;

/**
 * @param {'clicks'|'conversions'} kind  which list this panel is
 * @param {'email'|'whatsapp'} channel
 */
function PeopleTable({ kind, channel, campaignId, goalEvent }) {
  const isWa = channel === 'whatsapp';
  const API  = isWa ? WA_API : EMAIL_API;
  const isClicks = kind === 'clicks';

  const [rows, setRows]   = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage]   = useState(1);
  const [unique, setUnique] = useState(true);
  /* Whether a click from this campaign could EVER have been identified — see the server's
     wa_campaign_click_is_identifiable(). Drives the explanation on an anonymous row. */
  const [identifiable, setIdentifiable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [qLive, setQLive] = useState('');
  const timer = useRef(null);

  // Debounced: the search runs on the server and this fires per keystroke otherwise.
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setQ(qLive); setPage(1); }, 350);
    return () => clearTimeout(timer.current);
  }, [qLive]);

  const load = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const body = new URLSearchParams({
        action: kind, id: campaignId, page, per_page: 25, search: q,
      });
      if (isClicks) body.set('unique', unique ? 1 : 0);
      const res = await api.post(API, body, FORM);
      if (res.data?.success) {
        const d = res.data.data;
        setRows(d.rows || []); setTotal(d.total || 0); setPages(d.pages || 1);
        if (d.identifiable !== undefined) setIdentifiable(!!d.identifiable);
      } else {
        /*
          A missing action means this panel is newer than the backend on the server — which is a
          real and frequent state here, because the API deploys separately from the React build.
          Said plainly rather than as a generic failure, so nobody goes looking for a data problem
          that is actually a deploy problem.
        */
        const msg = String(res.data?.message || '');
        setRows([]); setTotal(0);
        if (!/invalid action/i.test(msg)) toast.error(msg || `Could not load ${kind}`);
      }
    } catch (e) {
      const msg = e?.response?.data?.message;
      setRows([]); setTotal(0);
      if (!/invalid action/i.test(String(msg || ''))) toast.error(msg || `Could not load ${kind}`);
    } finally { setLoading(false); }
  }, [API, kind, campaignId, page, q, unique, isClicks]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    const qs = new URLSearchParams({
      action: kind, id: campaignId, search: q, export: 1,
    });
    if (isClicks) qs.set('unique', unique ? 1 : 0);
    window.open(`${API}?${qs}`, '_blank');
  };

  const Icon = isClicks ? MousePointerClick : Target;

  return (
    <div className="cp-card">
      <div className="cp-head">
        <div>
          <h3><Icon size={15} /> {isClicks ? 'Who clicked' : 'Who converted'}</h3>
          <p className="sub">
            {isClicks
              ? (unique
                  ? 'One row per person, newest first. Mail-scanner clicks are excluded — corporate filters fetch every link before delivery and would otherwise fill this list with people who never opened it.'
                  : 'Every individual tap, newest first.')
              : (goalEvent
                  ? <>Recipients who did <b>{goalEvent}</b> inside this campaign&rsquo;s attribution window.</>
                  : 'No goal was set on this campaign, so nothing can be attributed to it.')}
          </p>
        </div>
        <div className="cp-tools">
          <div className="cp-search">
            <Search size={13} />
            <input value={qLive} onChange={e => setQLive(e.target.value)}
                   placeholder={isWa ? 'Name, phone, email' : 'Name, email'} />
          </div>
          {isClicks && (
            <>
              <button className={`cp-btn${unique ? ' on' : ''}`}
                      onClick={() => { setUnique(true); setPage(1); }}>
                <Users size={13} /> People
              </button>
              <button className={`cp-btn${unique ? '' : ' on'}`}
                      onClick={() => { setUnique(false); setPage(1); }}>
                All taps
              </button>
            </>
          )}
          <button className="cp-btn" onClick={exportCsv} disabled={!total}>
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="cp-tbl">
          <thead>
            <tr>
              <th>{isClicks ? 'Person' : 'Recipient'}</th>
              {isClicks && unique && <th className="cp-num">Clicks</th>}
              {isClicks && !isWa && <th>Link</th>}
              {!isClicks && <th>Converted on</th>}
              <th className="cp-num">{isClicks ? 'Last click' : 'When'}</th>
            </tr>
          </thead>
          <tbody>
            {loading && !rows.length ? (
              <tr><td colSpan={4}><div className="cp-empty">Loading…</div></td></tr>
            ) : !rows.length ? (
              <tr><td colSpan={4}><div className="cp-empty">
                {isClicks
                  ? (q ? 'Nobody matches that search.'
                       : 'No clicks recorded yet. A tracked link has to be in the message for clicks to be attributable at all.')
                  : (goalEvent
                      ? (q ? 'Nobody matches that search.' : 'No conversions attributed yet.')
                      : 'Set a conversion goal on the campaign to track this.')}
              </div></td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.id || r.identity_key || r.user_id || i}>
                <td>
                  <div className="cp-who">{who(r)}</div>
                  {subtitle(r) && <div className="cp-sub">{subtitle(r)}</div>}
                  {isWa && isClicks && !(r.name || '').trim() && !r.recipient_id && (
                    <div className="cp-sub" style={{ color: '#b54708' }}>
                      {/* Two very different reasons produce an identical-looking row, and saying
                          the wrong one sends people hunting for a problem that isn't there.
                          When the campaign carried no per-recipient link at all, EVERY click is
                          anonymous by construction — nothing was forwarded and nothing is broken;
                          the message simply had nothing in it to identify anyone. Only when the
                          campaign COULD identify people is "forwarded" the likely explanation. */}
                      {identifiable
                        ? 'Not in this campaign\u2019s audience \u2014 forwarded, most likely'
                        : 'This campaign sent only the fixed template button, which is identical in every message \u2014 no click from it can name anybody'}
                    </div>
                  )}
                </td>
                {isClicks && unique && <td className="cp-num">{n0(r.taps || 1)}</td>}
                {isClicks && !isWa && (
                  <td><a className="cp-url" href={r.url || '#'} target="_blank" rel="noreferrer">{r.url || '—'}</a></td>
                )}
                {!isClicks && <td>{r.event_key || r.goal_event || goalEvent || '—'}</td>}
                <td className="cp-num">{fmt(r.clicked_at || r.converted_at || r.attributed_at || r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cp-foot">
        <button className="cp-btn" onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}><ChevronLeft size={13} /> Previous</button>
        <button className="cp-btn" onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page >= pages || loading}>Next <ChevronRight size={13} /></button>
        <span className="n">
          {n0(total)} {isClicks ? (unique ? 'person' : 'tap') : 'conversion'}{total === 1 ? '' : 's'}
          {pages > 1 ? ` · page ${page} of ${pages}` : ''}
        </span>
      </div>
    </div>
  );
}

/*
 * Activity log — one row per recipient, what channel it went out on, and what happened.
 *
 * ── Why the outcome is a chip and the reason is beside it ────────────────────
 * "Failed" on its own is the least useful word this screen can print: it names the outcome and
 * withholds the cause, and the cause is nearly always ONE thing repeated across every failed
 * row. So the provider's own text sits next to the chip rather than behind a click — 131042 with
 * Meta's sentence attached is a fix; "Failed" is a support ticket.
 *
 * ── Skipped is not failed ───────────────────────────────────────────────────
 * A recipient deduplicated out, opted out, or without a usable number never reached the
 * provider. Those are decisions this system made on purpose, and colouring them red alongside
 * genuine provider rejections makes a working campaign look broken.
 */
const OUTCOME = {
  read:      { bg: '#ecfdf5', fg: '#047857', bd: '#a7f3d0', label: 'Read' },
  clicked:   { bg: '#ecfdf5', fg: '#047857', bd: '#a7f3d0', label: 'Clicked' },
  opened:    { bg: '#eff6ff', fg: '#1d4ed8', bd: '#bfdbfe', label: 'Opened' },
  delivered: { bg: '#f0fdf4', fg: '#15803d', bd: '#bbf7d0', label: 'Delivered' },
  sent:      { bg: '#f8fafc', fg: '#475569', bd: '#e2e8f0', label: 'Sent' },
  pending:   { bg: '#fffbeb', fg: '#b45309', bd: '#fde68a', label: 'Pending' },
  processing:{ bg: '#fffbeb', fg: '#b45309', bd: '#fde68a', label: 'Sending' },
  skipped:   { bg: '#f8fafc', fg: '#94a3b8', bd: '#e2e8f0', label: 'Skipped' },
  bounced:   { bg: '#fef2f2', fg: '#b42318', bd: '#fecaca', label: 'Bounced' },
  failed:    { bg: '#fef2f2', fg: '#b42318', bd: '#fecaca', label: 'Failed' },
};

const WA_FILTERS = [
  { k: 'all', l: 'All' }, { k: 'read', l: 'Read' }, { k: 'delivered', l: 'Delivered' },
  { k: 'sent', l: 'Sent' }, { k: 'failed', l: 'Failed' }, { k: 'skipped', l: 'Skipped' },
];
const EMAIL_FILTERS = [
  { k: 'all', l: 'All' }, { k: 'clicked', l: 'Clicked' }, { k: 'opened', l: 'Opened' },
  { k: 'sent', l: 'Sent' }, { k: 'bounced', l: 'Bounced' }, { k: 'failed', l: 'Failed' },
];

function ActivityLog({ channel, campaignId, senderNumber }) {
  const isWa = channel === 'whatsapp';
  const API  = isWa ? WA_API : EMAIL_API;

  const [rows, setRows]   = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage]   = useState(1);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [qLive, setQLive] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setQ(qLive); setPage(1); }, 350);
    return () => clearTimeout(timer.current);
  }, [qLive]);

  const load = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const body = new URLSearchParams({
        action: 'recipients', id: campaignId, page, per_page: 25, status, search: q,
      });
      const res = await api.post(API, body, FORM);
      if (res.data?.success) {
        const d = res.data.data;
        setRows(d.recipients || d.rows || []); setTotal(d.total || 0); setPages(d.pages || 1);
      } else {
        const msg = String(res.data?.message || '');
        setRows([]); setTotal(0);
        if (!/invalid action/i.test(msg)) toast.error(msg || 'Could not load the activity log');
      }
    } catch (e) {
      const msg = e?.response?.data?.message;
      setRows([]); setTotal(0);
      if (!/invalid action/i.test(String(msg || ''))) toast.error(msg || 'Could not load the activity log');
    } finally { setLoading(false); }
  }, [API, campaignId, page, status, q]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    const qs = new URLSearchParams({ action: 'recipients', id: campaignId, status, search: q, export: 1 });
    window.open(`${API}?${qs}`, '_blank');
  };

  /*
    The furthest stage the recipient reached, which is a different question from what the send
    status column holds. WhatsApp keeps engagement IN the status enum (sent → delivered → read),
    email keeps it in separate timestamps and the server derives a `stage` — so this trusts the
    server's answer where it has one and falls back to the raw status.
  */
  const outcomeOf = r => {
    if (r.stage) return r.stage;
    if (isWa && r.skip_reason) return 'skipped';
    return r.status || 'sent';
  };

  /* The reason column. A failure shows the provider's text; a skip shows our own. */
  const reasonOf = r => {
    if (r.error_message) {
      return r.error_code ? `${r.error_code}: ${r.error_message}` : r.error_message;
    }
    if (r.skip_reason) return r.skip_reason;
    if (r.bounce_type) return `${r.bounce_type} bounce`;
    return '';
  };

  const filters = isWa ? WA_FILTERS : EMAIL_FILTERS;

  return (
    <div className="cp-card">
      <div className="cp-head">
        <div>
          <h3><ListChecks size={15} /> Activity log</h3>
          <p className="sub">
            Every recipient, the channel it went out on, and what happened to it. Failures carry the
            provider&rsquo;s own reason — that text is usually the fix.
          </p>
        </div>
        <div className="cp-tools">
          <div className="cp-search">
            <Search size={13} />
            <input value={qLive} onChange={e => setQLive(e.target.value)}
                   placeholder={isWa ? 'Name, phone, reason' : 'Name, email, reason'} />
          </div>
          <button className="cp-btn" onClick={exportCsv} disabled={!total}>
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {filters.map(f => (
          <button key={f.k} className={`cp-btn${status === f.k ? ' on' : ''}`}
                  style={{ padding: '5px 11px', fontSize: 11.5 }}
                  onClick={() => { setStatus(f.k); setPage(1); }}>
            {f.l}
          </button>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="cp-tbl">
          <thead>
            <tr>
              <th>Recipient</th>
              <th>Channel</th>
              <th>Outcome</th>
              <th>Reason</th>
              <th className="cp-num">When</th>
            </tr>
          </thead>
          <tbody>
            {loading && !rows.length ? (
              <tr><td colSpan={5}><div className="cp-empty">Loading…</div></td></tr>
            ) : !rows.length ? (
              <tr><td colSpan={5}><div className="cp-empty">
                {q || status !== 'all' ? 'Nothing matches that filter.' : 'No recipients yet.'}
              </div></td></tr>
            ) : rows.map(r => {
              const oc = outcomeOf(r);
              const t = OUTCOME[oc] || OUTCOME.sent;
              const reason = reasonOf(r);
              return (
                <tr key={r.id}>
                  <td>
                    <div className="cp-who">{who(r)}</div>
                    {subtitle(r) && <div className="cp-sub">{subtitle(r)}</div>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 600, color: '#344054' }}>{isWa ? 'WhatsApp' : 'Email'}</span>
                    {/* Which number it went out FROM. On a multi-number account this is the first
                        thing to check when one campaign delivers and another does not. */}
                    {isWa && senderNumber && <div className="cp-sub">{senderNumber}</div>}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '2px 9px', borderRadius: 999,
                      fontSize: 10.5, fontWeight: 800, whiteSpace: 'nowrap',
                      background: t.bg, color: t.fg, border: `1px solid ${t.bd}`,
                    }}>{t.label}</span>
                  </td>
                  <td style={{ maxWidth: 340 }}>
                    {reason
                      ? <span style={{ color: r.error_message ? '#b42318' : '#667085', fontSize: 11.5, lineHeight: 1.45 }}>
                          {reason}
                        </span>
                      : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td className="cp-num">
                    {fmt(r.read_at || r.first_clicked_at || r.opened_at || r.delivered_at
                         || r.failed_at || r.bounced_at || r.sent_at || r.last_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="cp-foot">
        <button className="cp-btn" onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}><ChevronLeft size={13} /> Previous</button>
        <button className="cp-btn" onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page >= pages || loading}>Next <ChevronRight size={13} /></button>
        <span className="n">
          {n0(total)} recipient{total === 1 ? '' : 's'}{pages > 1 ? ` · page ${page} of ${pages}` : ''}
        </span>
      </div>
    </div>
  );
}

/**
 * The three lists that turn the report's numbers into people.
 *
 * Order is deliberate: the activity log first, because "what happened to everyone" is the
 * question asked when something looks wrong, and clicks/conversions are the questions asked
 * when it went right.
 */
export default function CampaignPeoplePanels({ channel, campaignId, goalEvent, senderNumber }) {
  return (
    <>
      <style>{CSS}</style>
      <ActivityLog channel={channel} campaignId={campaignId} senderNumber={senderNumber} />
      <PeopleTable kind="clicks" channel={channel} campaignId={campaignId} goalEvent={goalEvent} />
      <PeopleTable kind="conversions" channel={channel} campaignId={campaignId} goalEvent={goalEvent} />
    </>
  );
}
