import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import WaPhonePreview from './WaPhonePreview';
import { WA_API, FORM, WA, WA_CSS, fmtDt, n0 } from './waShared';
import { Badge, Spinner, WhatsAppIcon, Notice } from './WaUi';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' }, { key: 'sent', label: 'Sent' }, { key: 'delivered', label: 'Delivered' },
  { key: 'read', label: 'Read' }, { key: 'failed', label: 'Failed' }, { key: 'pending', label: 'Pending' },
];

const RECIPIENT_STATUS = {
  pending:    { bg: '#f1f5f9', fg: '#64748b', label: 'Pending' },
  processing: { bg: '#dbeafe', fg: '#1d4ed8', label: 'Sending' },
  sent:       { bg: '#e0f2fe', fg: '#0369a1', label: 'Sent' },
  delivered:  { bg: '#dcfce7', fg: '#15803d', label: 'Delivered' },
  read:       { bg: '#d1fae5', fg: '#047857', label: 'Read' },
  failed:     { bg: '#fee2e2', fg: '#dc2626', label: 'Failed' },
  skipped:    { bg: '#fef3c7', fg: '#b45309', label: 'Skipped' },
};

function Tile({ label, value, sub, tone = 'default', hintTitle }) {
  const tones = {
    default: { fg: '#0f172a', bg: '#fff', border: '#e2e8f0' },
    good:    { fg: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
    bad:     { fg: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
    info:    { fg: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  };
  const t = tones[tone];
  return (
    <div title={hintTitle} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8', letterSpacing: '.4px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: t.fg, marginTop: 4, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function WaCampaignReport() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [recipients, setRecipients] = useState([]);
  const [recStatus, setRecStatus] = useState('all');
  const [recSearch, setRecSearch] = useState('');
  const [recPage, setRecPage] = useState(1);
  const [recPages, setRecPages] = useState(1);
  const [recTotal, setRecTotal] = useState(0);
  const [recLoading, setRecLoading] = useState(false);

  const [convRows, setConvRows] = useState([]);
  const [convTotal, setConvTotal] = useState(0);
  const [convPage, setConvPage] = useState(1);
  const [convPages, setConvPages] = useState(1);
  const [convLoading, setConvLoading] = useState(false);
  const [convMode, setConvMode] = useState(null);
  const [convError, setConvError] = useState('');
  const [convSearch, setConvSearch] = useState('');
  // { loading, data, userId } while a person's full detail is open; null when closed.
  const [detail, setDetail] = useState(null);

  const [clkRows, setClkRows] = useState([]);
  const [clkTotal, setClkTotal] = useState(0);
  const [clkPage, setClkPage] = useState(1);
  const [clkPages, setClkPages] = useState(1);
  const [clkLoading, setClkLoading] = useState(false);
  const [clkUnique, setClkUnique] = useState(true);
  const [clkSearch, setClkSearch] = useState('');

  const loadReport = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.post(WA_API, new URLSearchParams({ action: 'report', id }), FORM);
      if (res.data.success) setData(res.data.data);
      else toast.error(res.data.message || 'Could not load the report');
    } catch { toast.error('Network error'); }
    finally { if (!silent) setLoading(false); }
  };

  const loadRecipients = async (p = 1, st = recStatus, s = recSearch) => {
    setRecLoading(true);
    try {
      const body = new URLSearchParams({ action: 'recipients', id, page: p, per_page: 25, status: st, search: s });
      const res = await api.post(WA_API, body, FORM);
      if (res.data.success) {
        const d = res.data.data;
        setRecipients(d.recipients || []); setRecPage(d.page); setRecPages(d.pages); setRecTotal(d.total);
      }
    } finally { setRecLoading(false); }
  };

  /*
   * The people behind the Converted number.
   *
   * Loaded separately from the report because it is the expensive half — the count joins the
   * goal's own event table, and on signin_log that is a large one. Keeping it out of the report
   * call means the tiles still appear instantly on a campaign with a heavy goal.
   */
  const loadConversions = async (p = 1, s = convSearch) => {
    setConvLoading(true);
    try {
      const body = new URLSearchParams({ action: 'conversions', id, page: p, per_page: 25, search: s });
      const res = await api.post(WA_API, body, FORM);
      if (res.data.success) {
        const d = res.data.data;
        setConvRows(d.rows || []); setConvPage(d.page || 1); setConvPages(d.pages || 1);
        setConvTotal(d.total || 0); setConvMode(d.mode || null); setConvError(d.error || '');
      }
    } catch { /* the panel shows its own empty state; a toast here would fire on every poll */ }
    finally { setConvLoading(false); }
  };

  const openDetail = async (userId) => {
    if (!userId) return;
    setDetail({ loading: true, data: null, userId });
    try {
      const body = new URLSearchParams({ action: 'conversion_detail', id, user_id: userId });
      const res = await api.post(WA_API, body, FORM);
      if (res.data.success) setDetail({ loading: false, data: res.data.data, userId });
      else { toast.error(res.data.message || 'Could not load the detail'); setDetail(null); }
    } catch { toast.error('Network error'); setDetail(null); }
  };

  /*
   * The raw click log. Every tap when unique is off, one line per person when it's on — the same
   * rows, asked a different question, so the list can't disagree with the Clicked tile.
   */
  const loadClicks = async (p = 1, uniq = clkUnique, s = clkSearch) => {
    setClkLoading(true);
    try {
      const body = new URLSearchParams({
        action: 'clicks', id, page: p, per_page: 25, unique: uniq ? 1 : 0, search: s,
      });
      const res = await api.post(WA_API, body, FORM);
      if (res.data.success) {
        const d = res.data.data;
        setClkRows(d.rows || []); setClkPage(d.page || 1); setClkPages(d.pages || 1); setClkTotal(d.total || 0);
      }
    } catch { /* the panel has its own empty state */ }
    finally { setClkLoading(false); }
  };

  useEffect(() => { loadReport(); }, [id]); // eslint-disable-line
  useEffect(() => { loadRecipients(1, recStatus, recSearch); }, [id, recStatus]); // eslint-disable-line
  useEffect(() => { loadConversions(1, ''); }, [id]); // eslint-disable-line
  useEffect(() => { loadClicks(1, clkUnique, clkSearch); }, [id, clkUnique]); // eslint-disable-line

  // While the campaign is still running, refresh quietly so the numbers advance on their own.
  const isRunning = data?.campaign?.status === 'running';
  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => { loadReport({ silent: true }); loadRecipients(recPage, recStatus, recSearch); }, 8000);
    return () => clearInterval(t);
  }, [isRunning, recPage, recStatus, recSearch]); // eslint-disable-line

  if (loading || !data) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><Spinner /></div>;
  }

  const c = data.campaign;
  const sent = Number(c.sent_count) || 0;
  const delivered = Number(c.delivered_count) || 0;
  const read = Number(c.read_count) || 0;
  const failed = Number(c.failed_count) || 0;
  const total = Number(c.total_recipients) || 0;
  const pct = (n, d) => (d > 0 ? `${Math.round((n / d) * 100)}% of sent` : '—');
  const vars = c.variables || {};

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#f8fafc', minHeight: '100vh' }}>
      <style>{WA_CSS}</style>

      <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 26px', borderBottom: '1px solid #e2e8f0', background: '#fff', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <button onClick={() => nav('/netcore/whatsapp')}
            style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#334155', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: WA.green, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <WhatsAppIcon size={18} color="#fff" />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
              <Badge status={c.status} />
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              ID {c.id} · {c.template_name || 'free text'}
              {c.business_number ? ` · from ${c.business_number}` : ''}
              {' · '}{c.started_at ? `started ${fmtDt(c.started_at)}` : 'not started'}
            </div>
          </div>
        </div>
        <button onClick={() => { loadReport(); loadRecipients(recPage); }}
          style={{ padding: '9px 16px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#475569', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
          Refresh
        </button>
      </div>

      <div style={{ padding: '24px 26px 80px', display: 'flex', gap: 24, alignItems: 'flex-start', maxWidth: 1300, margin: '0 auto' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 20 }}>
            <Tile label="Audience" value={n0(total)} sub="after deduplication" />
            <Tile label="Sent" value={n0(sent)} sub="accepted by provider" tone="info"
              hintTitle="The provider accepted the message. It is not proof it reached a phone." />
            <Tile label="Delivered" value={n0(delivered)} sub={pct(delivered, sent)} tone="good" />
            <Tile label="Read" value={n0(read)} sub={pct(read, sent)} tone="good" />
            {/* People, matching every other tile. Total taps is the sub-label rather than the
                headline — one person tapping five times is one person who clicked. */}
            <Tile label="Clicked" value={n0(c.clicked_users)}
                  sub={`${n0(c.click_count)} tap${Number(c.click_count) === 1 ? '' : 's'} in total`} />
            {/* Only rendered when a goal exists — a "0" here on a campaign that was never
                measuring anything reads as a failed campaign rather than an unset option. */}
            {c.goal_event_name && (
              <Tile label="Converted" value={n0(c.conversion_count)} sub={`did "${c.goal_event_name}"`} tone="good"
                hintTitle={`People who did "${c.goal_event_name}" within ${c.goal_window_days || 2} day(s) of clicking through this campaign. Counted once per person however many times they did it — open the Conversions list below to see who.`} />
            )}
            <Tile label="Failed" value={n0(failed)} sub={pct(failed, sent)} tone={failed > 0 ? 'bad' : 'default'} />
            {Number(c.dedup_enabled) === 1 && (
              <Tile label="Deduped" value={n0(c.skipped_dedup_count)} sub={`messaged within ${c.dedup_window_hours}h`} />
            )}
          </div>

          {sent > 0 && delivered === 0 && (
            <Notice tone="warn" style={{ marginBottom: 20 }} title="Delivered is 0 — two possible reasons">
              Either the delivery webhook isn't registered in the Netcore panel yet (in which case messages
              may well be arriving and we simply aren't being told), or the messages were accepted and then
              dropped — which happens when the template isn't one Meta approved, or a free-text message
              went to someone outside the 24-hour service window.
              <div style={{ marginTop: 6 }}>
                <button onClick={() => nav('/netcore/whatsapp/settings')}
                  style={{ border: 'none', background: 'none', color: '#1e3a8a', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}>
                  Check the webhook setup →
                </button>
              </div>
            </Notice>
          )}

          {(data.failure_groups || []).length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Why messages failed</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 14 }}>
                The provider's own rejection text, grouped — one bad template name produces thousands of identical failures.
              </div>
              {data.failure_groups.map((g, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '9px 0', borderBottom: i < data.failure_groups.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <span style={{ fontSize: 12, color: '#475569', minWidth: 0 }}>{g.error_message}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#dc2626', whiteSpace: 'nowrap' }}>{n0(g.c)}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Click log ─────────────────────────────────────────────────────────────────
              Every tap is stored; this shows them either raw or collapsed to one line per
              person. A deduplicated tile is only believable if the rows behind it can be read,
              which is the whole reason the log exists rather than a counter. */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '16px 20px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                    Clicks <span style={{ color: '#94a3b8', fontWeight: 600 }}>({n0(clkTotal)})</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                    {clkUnique
                      ? 'One line per person — matched on phone number, then email.'
                      : 'Every tap, newest first — including repeats from the same person.'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
                    {[[true, 'Unique people'], [false, 'Every tap']].map(([v, lbl]) => (
                      <button key={String(v)} onClick={() => { setClkUnique(v); setClkPage(1); }}
                        style={{ border: 'none', background: clkUnique === v ? '#fff' : 'transparent', boxShadow: clkUnique === v ? '0 1px 2px rgba(15,23,42,.1)' : 'none', borderRadius: 6, padding: '5px 11px', fontSize: 11, fontWeight: 700, color: clkUnique === v ? WA.primary : '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <input value={clkSearch}
                    onChange={e => setClkSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') loadClicks(1, clkUnique, clkSearch); }}
                    placeholder="Search phone or email…"
                    style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', minWidth: 190, outline: 'none' }} />
                </div>
              </div>
            </div>

            {clkLoading ? (
              <div style={{ padding: 30, textAlign: 'center' }}><Spinner /></div>
            ) : clkRows.length === 0 ? (
              <div style={{ padding: 26, textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>
                No clicks recorded yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Who', 'Phone', clkUnique ? 'Taps' : 'Device', clkUnique ? 'First tap' : '', 'Last tap'].map((h, i) => (
                        <th key={i} style={{ textAlign: 'left', padding: '10px 20px', fontSize: 10.5, fontWeight: 800, color: '#94a3b8', letterSpacing: '.4px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clkRows.map((r, i) => {
                      // An identity_key starting "visitor:" or "anon:" means the tap arrived
                      // logged out and no phone or email was knowable at the time. Saying so
                      // beats printing a random string as if it identified somebody.
                      const anon = /^(visitor|anon):/.test(String(r.identity_key || ''));
                      return (
                        <tr key={r.id || r.identity_key || i}>
                          <td style={{ padding: '11px 20px', borderBottom: '1px solid #f1f5f9' }}>
                            {anon ? (
                              <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not signed in</span>
                            ) : (
                              <div>
                                <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.email || r.identity_key}</div>
                                {r.user_id && <div style={{ fontSize: 11, color: '#94a3b8' }}>user #{r.user_id}</div>}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '11px 20px', borderBottom: '1px solid #f1f5f9', color: '#475569', whiteSpace: 'nowrap' }}>
                            {r.phone ? `+${r.phone}` : '—'}
                          </td>
                          <td style={{ padding: '11px 20px', borderBottom: '1px solid #f1f5f9', color: '#475569', whiteSpace: 'nowrap' }}>
                            {clkUnique ? n0(r.taps) : (r.ip || '—')}
                          </td>
                          {clkUnique && (
                            <td style={{ padding: '11px 20px', borderBottom: '1px solid #f1f5f9', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                              {r.first_clicked_at ? fmtDt(r.first_clicked_at) : '—'}
                            </td>
                          )}
                          {!clkUnique && <td style={{ borderBottom: '1px solid #f1f5f9' }} />}
                          <td style={{ padding: '11px 20px', borderBottom: '1px solid #f1f5f9', color: '#475569', whiteSpace: 'nowrap' }}>
                            {r.clicked_at ? fmtDt(r.clicked_at) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {clkPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '12px 20px', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 11.5, color: '#94a3b8' }}>Page {clkPage} of {clkPages}</span>
                <button disabled={clkPage <= 1} onClick={() => loadClicks(clkPage - 1, clkUnique, clkSearch)}
                  style={{ padding: '6px 12px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 7, fontSize: 11.5, fontWeight: 700, color: clkPage <= 1 ? '#cbd5e1' : '#475569', cursor: clkPage <= 1 ? 'default' : 'pointer', fontFamily: 'inherit' }}>Prev</button>
                <button disabled={clkPage >= clkPages} onClick={() => loadClicks(clkPage + 1, clkUnique, clkSearch)}
                  style={{ padding: '6px 12px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 7, fontSize: 11.5, fontWeight: 700, color: clkPage >= clkPages ? '#cbd5e1' : '#475569', cursor: clkPage >= clkPages ? 'default' : 'pointer', fontFamily: 'inherit' }}>Next</button>
              </div>
            )}
          </div>

          {/* ── Conversions ───────────────────────────────────────────────────────────────
              The list behind the Converted tile. Same wa_conversion_list_sql() definition the
              count uses, so the number and the names can never disagree. Only rendered when a
              goal exists — there is nothing to list otherwise. */}
          {c.goal_event_name && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '16px 20px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                      Conversions <span style={{ color: '#94a3b8', fontWeight: 600 }}>({n0(convTotal)})</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                      People who did <b>{c.goal_event_name}</b> within {c.goal_window_days || 2} day
                      {Number(c.goal_window_days || 2) === 1 ? '' : 's'}
                      {convMode === 'live'
                        ? ' of clicking through this campaign — attributed at the moment the goal fired.'
                        : ' of this campaign, matched on the goal’s own records.'}
                      {' '}Counted once per person however many times they did it.
                    </div>
                  </div>
                  <input value={convSearch}
                    onChange={e => setConvSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') loadConversions(1, convSearch); }}
                    placeholder="Search name, email, phone…"
                    style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', minWidth: 220, outline: 'none' }} />
                </div>
              </div>

              {convError && (
                <div style={{ margin: '0 20px 14px', padding: '9px 11px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 11.5, color: '#991b1b' }}>
                  Could not measure conversions: {convError}
                </div>
              )}

              {convLoading ? (
                <div style={{ padding: 30, textAlign: 'center' }}><Spinner /></div>
              ) : convRows.length === 0 ? (
                <div style={{ padding: 26, textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>
                  Nobody has converted yet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Person', 'Phone', 'Clicked', 'Converted', ''].map((h, i) => (
                          <th key={i} style={{ textAlign: i === 4 ? 'right' : 'left', padding: '10px 20px', fontSize: 10.5, fontWeight: 800, color: '#94a3b8', letterSpacing: '.4px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {convRows.map((r, i) => (
                        <tr key={r.user_id || i}>
                          <td style={{ padding: '11px 20px', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.name?.trim() || '—'}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.email || `user #${r.user_id}`}</div>
                          </td>
                          <td style={{ padding: '11px 20px', borderBottom: '1px solid #f1f5f9', color: '#475569', whiteSpace: 'nowrap' }}>{r.phone || '—'}</td>
                          <td style={{ padding: '11px 20px', borderBottom: '1px solid #f1f5f9', color: '#475569', whiteSpace: 'nowrap' }}>
                            {r.clicked_at || r.first_clicked_at ? fmtDt(r.clicked_at || r.first_clicked_at) : '—'}
                          </td>
                          <td style={{ padding: '11px 20px', borderBottom: '1px solid #f1f5f9', color: '#15803d', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {r.converted_at ? fmtDt(r.converted_at) : '—'}
                          </td>
                          <td style={{ padding: '11px 20px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                            <button onClick={() => openDetail(r.user_id)}
                              style={{ border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 7, padding: '5px 11px', fontSize: 11, fontWeight: 700, color: WA.primary, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                              Complete detail
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {convPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '12px 20px', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 11.5, color: '#94a3b8' }}>Page {convPage} of {convPages}</span>
                  <button disabled={convPage <= 1} onClick={() => loadConversions(convPage - 1, convSearch)}
                    style={{ padding: '6px 12px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 7, fontSize: 11.5, fontWeight: 700, color: convPage <= 1 ? '#cbd5e1' : '#475569', cursor: convPage <= 1 ? 'default' : 'pointer', fontFamily: 'inherit' }}>Prev</button>
                  <button disabled={convPage >= convPages} onClick={() => loadConversions(convPage + 1, convSearch)}
                    style={{ padding: '6px 12px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 7, fontSize: 11.5, fontWeight: 700, color: convPage >= convPages ? '#cbd5e1' : '#475569', cursor: convPage >= convPages ? 'default' : 'pointer', fontFamily: 'inherit' }}>Next</button>
                </div>
              )}
            </div>
          )}

          {/* ── Recipients ────────────────────────────────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Recipients</div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{n0(recTotal)} in this view</div>
                </div>
                <input value={recSearch} onChange={e => setRecSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadRecipients(1, recStatus, recSearch)}
                  placeholder="Search number, name or email…"
                  style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', outline: 'none', width: 240 }} />
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
                {STATUS_FILTERS.map(f => (
                  <button key={f.key} className={`wa-tab${recStatus === f.key ? ' active' : ''}`} onClick={() => setRecStatus(f.key)}>
                    {f.label}{f.key !== 'all' ? ` (${n0(data.recipient_status_counts?.[f.key] ?? 0)})` : ''}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ maxHeight: 460, overflow: 'auto', position: 'relative' }}>
              {recLoading && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.8)', zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={26} /></div>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2 }}>
                  <tr>
                    {['Number', 'Contact', 'Status', 'Sent', 'Delivered', 'Detail'].map(h => (
                      <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recipients.length === 0 && !recLoading ? (
                    <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                      {total === 0 ? 'The audience has not been resolved yet — recipients appear once the worker picks this campaign up.' : 'No recipients match this filter.'}
                    </td></tr>
                  ) : recipients.map(r => {
                    const s = RECIPIENT_STATUS[r.status] || RECIPIENT_STATUS.pending;
                    return (
                      <tr key={r.id} className="wa-row">
                        <td style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap' }}>+{r.phone}</td>
                        <td style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>
                          {[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}
                          {r.email && <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{r.email}</div>}
                        </td>
                        <td style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ background: s.bg, color: s.fg, fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>{s.label}</span>
                        </td>
                        <td style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', color: '#94a3b8', whiteSpace: 'nowrap' }}>{r.sent_at ? fmtDt(r.sent_at) : '—'}</td>
                        <td style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', color: '#94a3b8', whiteSpace: 'nowrap' }}>{r.delivered_at ? fmtDt(r.delivered_at) : '—'}</td>
                        <td style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', color: r.error_message ? '#dc2626' : '#94a3b8', maxWidth: 260 }}>
                          {r.error_message || (r.wa_message_id ? <span style={{ fontSize: 10.5 }}>{r.wa_message_id}</span> : '—')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {recPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid #f1f5f9' }}>
                <button disabled={recPage <= 1} onClick={() => loadRecipients(recPage - 1)}
                  style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: recPage <= 1 ? 'not-allowed' : 'pointer', opacity: recPage <= 1 ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Prev</button>
                <span style={{ fontSize: 12, color: '#475569', alignSelf: 'center' }}>Page {recPage} of {recPages}</span>
                <button disabled={recPage >= recPages} onClick={() => loadRecipients(recPage + 1)}
                  style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: recPage >= recPages ? 'not-allowed' : 'pointer', opacity: recPage >= recPages ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Next</button>
              </div>
            )}
          </div>
        </div>

        {/* ── Side rail ─────────────────────────────────────────────────────────────── */}
        <div style={{ width: 330, flexShrink: 0 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>What was sent</div>
            <WaPhonePreview
              headerType={c.message_type === 'template' ? c.header_type : 'none'}
              headerText={c.header_text}
              headerValues={vars.header || []}
              bodyText={c.body_text}
              bodyValues={vars.body || []}
              footerText={c.message_type === 'template' ? c.footer_text : ''}
              buttons={c.message_type === 'template' ? c.buttons : []}
              plainText={c.message_type === 'text' ? c.text_content : null}
              height={420}
            />
          </div>

          {(data.test_sends || []).length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Test sends</div>
              {data.test_sends.map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, padding: '6px 0', borderBottom: i < data.test_sends.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <span style={{ color: '#334155', fontWeight: 600 }}>+{t.phone}</span>
                  <span style={{ color: t.status === 'failed' ? '#dc2626' : '#15803d', textAlign: 'right' }}>
                    {t.status === 'failed' ? (t.error_message || 'Failed') : t.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {(data.events || []).length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Recent activity</div>
              {data.events.map((e, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, padding: '6px 0', borderBottom: i < data.events.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <span style={{ color: '#475569' }}>
                    <b style={{ color: '#0f172a' }}>{e.event_type}</b> · +{e.phone}
                  </span>
                  <span style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmtDt(e.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── One person's complete detail, scoped to THIS campaign ────────────────────────
          Every query behind it is filtered by campaign_id as well as by the person: the same
          user can be in several campaigns, and showing their whole history beside one
          campaign's number is how a report starts claiming credit it hasn't earned. */}
      {detail && (
        <div onClick={() => setDetail(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 16px', overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 640, boxShadow: '0 20px 60px rgba(15,23,42,.25)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                  {detail.data?.user?.name?.trim() || `User #${detail.userId}`}
                </div>
                <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
                  {detail.data?.user?.email || '—'} · in campaign #{c.id} only
                </div>
              </div>
              <button onClick={() => setDetail(null)}
                style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: '#475569', fontSize: 15, lineHeight: 1, fontFamily: 'inherit' }}>×</button>
            </div>

            {detail.loading ? (
              <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
            ) : (
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* What this campaign actually did to them */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '.4px', textTransform: 'uppercase', marginBottom: 8 }}>
                    This campaign’s message
                  </div>
                  {detail.data?.recipient ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 18px', fontSize: 12 }}>
                      {[
                        ['Phone', detail.data.recipient.phone ? `+${detail.data.recipient.phone}` : '—'],
                        ['Status', detail.data.recipient.status || '—'],
                        ['Sent', detail.data.recipient.sent_at ? fmtDt(detail.data.recipient.sent_at) : '—'],
                        ['Delivered', detail.data.recipient.delivered_at ? fmtDt(detail.data.recipient.delivered_at) : '—'],
                        ['Read', detail.data.recipient.read_at ? fmtDt(detail.data.recipient.read_at) : '—'],
                        ['First click', detail.data.recipient.first_clicked_at ? fmtDt(detail.data.recipient.first_clicked_at) : 'not recorded'],
                        ['Taps', n0(detail.data.recipient.click_count)],
                        ['Failure', detail.data.recipient.error_message || '—'],
                      ].map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, borderBottom: '1px solid #f1f5f9', paddingBottom: 5 }}>
                          <span style={{ color: '#94a3b8' }}>{k}</span>
                          <span style={{ color: '#0f172a', fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Real and worth saying plainly: the conversion was attributed by cookie, but
                       no row in this campaign's recipient list matches them — usually a number
                       stored differently from the one on their account. */
                    <div style={{ fontSize: 12, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '9px 11px' }}>
                      No recipient row in this campaign matches this person — the conversion was
                      attributed from their click, but their phone or email didn’t match the audience list.
                    </div>
                  )}
                </div>

                {/* Every goal firing, not just the one that counted */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '.4px', textTransform: 'uppercase', marginBottom: 8 }}>
                    Goal events ({(detail.data?.attributions || []).length})
                  </div>
                  {(detail.data?.attributions || []).length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      No attribution rows — this conversion was matched against the goal’s own records
                      rather than a tracked click.
                    </div>
                  ) : (
                    <>
                      {detail.data.attributions.map((a, i) => (
                        <div key={a.id || i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ color: '#0f172a', fontWeight: 600 }}>{a.event_key}</span>
                          <span style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>
                            {a.clicked_at ? `clicked ${fmtDt(a.clicked_at)} · ` : ''}{fmtDt(a.attributed_at)}
                          </span>
                        </div>
                      ))}
                      {detail.data.attributions.length > 1 && (
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 7 }}>
                          {detail.data.attributions.length} firings, counted as <b>one</b> conversion.
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* The campaign's own timeline for them */}
                {(detail.data?.events || []).length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '.4px', textTransform: 'uppercase', marginBottom: 8 }}>
                      Activity in this campaign
                    </div>
                    {detail.data.events.map((e, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#475569' }}>
                          <b style={{ color: '#0f172a' }}>{e.event_type}</b>{e.detail ? ` · ${e.detail}` : ''}
                        </span>
                        <span style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmtDt(e.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
