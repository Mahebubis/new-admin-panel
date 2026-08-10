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

  useEffect(() => { loadReport(); }, [id]); // eslint-disable-line
  useEffect(() => { loadRecipients(1, recStatus, recSearch); }, [id, recStatus]); // eslint-disable-line

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
            <Tile label="Clicked" value={n0(c.click_count)} sub="quick-reply taps" />
            {/* Only rendered when a goal exists — a "0" here on a campaign that was never
                measuring anything reads as a failed campaign rather than an unset option. */}
            {c.goal_event_name && (
              <Tile label="Converted" value={n0(c.conversion_count)} sub={`did "${c.goal_event_name}"`} tone="good"
                hintTitle={`Recipients who did "${c.goal_event_name}" within ${c.goal_window_days || 2} day(s) of receiving this message. Counted by exposure, not by clicks — WhatsApp template links can't be tracked per recipient.`} />
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
    </div>
  );
}
