import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';

const API = '/api/campaigns/campaigns.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

function Spinner() {
  return <span style={{ display: 'inline-block', width: 32, height: 32, borderRadius: '50%', border: '3px solid #c4b5fd', borderTopColor: '#4f46e5', animation: 'nc_spin 0.85s linear infinite' }} />;
}
function fmtDt(s) {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d.getTime())) return s;
  const pad = n => String(n).padStart(2, '0');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()} ${pad(d.getHours() % 12 || 12)}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}
const n0 = v => Number(v || 0).toLocaleString();
const pct = (part, whole) => whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—';

const EVT_LABEL = { open: 'Opened', click: 'Clicked', bounce: 'Bounced', unsubscribe: 'Unsubscribed', dropped: 'Dropped', deferred: 'Deferred', spamreport: 'Marked as spam' };
const EVT_COLOR = { open: '#1d4ed8', click: '#15803d', bounce: '#dc2626', unsubscribe: '#c2410c', dropped: '#dc2626', deferred: '#b45309', spamreport: '#dc2626' };

function DetailBlock({ title, rows }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9', marginBottom: 8 }}>{title}</div>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px 16px' }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ fontSize: 11.5, minWidth: 0 }}>
            <span style={{ color: '#94a3b8' }}>{k}: </span>
            <span style={{ color: '#334155', fontWeight: 600, wordBreak: 'break-word' }}>{v === null || v === undefined || v === '' ? '—' : String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, color = '#1e3a8a' }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px', flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const EVENT_LABEL = {
  register: 'Register', signin: 'Signin', exam_success: 'Exam Success',
  course_purchase: 'Course Purchase', payment_success: 'Payment Success',
  result_view: 'Result View',
};
const prettyKey = k => String(k).replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase());

/* Quote every field — emails and names routinely contain commas. */
function toCsv(rows, columns) {
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [
    columns.map(c => cell(c.label)).join(','),
    ...rows.map(r => columns.map(c => cell(r[c.key])).join(',')),
  ].join('\r\n');
}
function downloadCsv(filename, csv) {
  // BOM so Excel opens UTF-8 names correctly rather than as mojibake.
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function CampaignReport() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [bounced, setBounced] = useState(null);
  const [bouncedPage, setBouncedPage] = useState(1);
  const [devices, setDevices] = useState(null);
  const [conv, setConv] = useState(null);
  const [convPage, setConvPage] = useState(1);
  const [convSearch, setConvSearch] = useState('');
  const [convSearchInput, setConvSearchInput] = useState('');
  const [convLoading, setConvLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.post(API, new URLSearchParams({ action: 'report', id, page: p, per_page: 20 }), FORM);
      if (res.data.success) { setData(res.data.data); setPage(p); }
    } finally { setLoading(false); }
  };
  const loadBounced = async (p = 1) => {
    const res = await api.post(API, new URLSearchParams({ action: 'bounced_recipients', id, page: p, per_page: 20 }), FORM);
    if (res.data.success) { setBounced(res.data.data); setBouncedPage(p); }
  };
  const loadDevices = async () => {
    const res = await api.post(API, new URLSearchParams({ action: 'device_breakdown', id }), FORM);
    if (res.data.success) setDevices(res.data.data.devices);
  };
  const loadConversions = async (p = 1, search = convSearch) => {
    setConvLoading(true);
    try {
      const res = await api.post(API, new URLSearchParams({ action: 'conversions', id, page: p, per_page: 20, search }), FORM);
      if (res.data.success) { setConv(res.data.data); setConvPage(p); }
    } finally { setConvLoading(false); }
  };
  useEffect(() => { load(1); loadBounced(1); loadDevices(); const t = setInterval(() => { load(page); loadBounced(bouncedPage); loadDevices(); }, 15000); return () => clearInterval(t); }, [id]); // eslint-disable-line
  useEffect(() => { loadConversions(1, convSearch); }, [id, convSearch]); // eslint-disable-line

  const exportConversions = async () => {
    setExporting(true);
    try {
      const res = await api.post(API, new URLSearchParams({ action: 'conversions', id, search: convSearch, export: 1 }), FORM);
      if (!res.data.success) return;
      const d = res.data.data;
      const goal = EVENT_LABEL[d.goal_event_name] || d.goal_event_name || '';
      const rows = (d.rows || []).map(r => ({ ...r, goal, campaign: d.campaign_name }));
      downloadCsv(
        `campaign-${id}-conversions${convSearch ? '-filtered' : ''}.csv`,
        toCsv(rows, [
          { key: 'user_id', label: 'User ID' }, { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' },
          { key: 'medium', label: 'Medium' }, { key: 'clicked_at', label: 'Clicked At' },
          { key: 'converted_at', label: 'Converted At' },
          { key: 'goal', label: 'Goal Event' }, { key: 'campaign', label: 'Campaign' },
        ]),
      );
    } finally { setExporting(false); }
  };

  const openDetail = async (userId) => {
    setDetail({ loading: true }); setDetailLoading(true);
    try {
      const res = await api.post(API, new URLSearchParams({ action: 'conversion_detail', id, user_id: userId }), FORM);
      setDetail(res.data.success ? res.data.data : null);
    } finally { setDetailLoading(false); }
  };

  if (loading && !data) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><Spinner /></div>;
  if (!data) return null;
  const c = data.campaign;
  const rc = data.recipient_status_counts;

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", padding: 26, maxWidth: 1100, margin: '0 auto' }}>
      <style>{`@keyframes nc_spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <button onClick={() => nav('/netcore/campaigns')} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#0f172a' }}>{c.name}</div>
          <div style={{ fontSize: 11.5, color: '#94a3b8' }}>ID {c.id} · {c.status.toUpperCase()} · Refreshes every 15s</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 22 }}>
        <StatTile label="Total recipients" value={n0(c.total_recipients)} />
        <StatTile label="Sent" value={n0(c.sent_count)} sub={pct(c.sent_count, c.total_recipients)} />
        <StatTile label="Delivered" value={n0(c.delivered_count)} sub={pct(c.delivered_count, c.total_recipients)} color="#15803d" />
        <StatTile label="Opened" value={n0(c.unique_open_count)} sub={`${pct(c.unique_open_count, c.delivered_count)} · ${n0(c.open_count)} total opens`} color="#1d4ed8" />
        <StatTile label="Clicked" value={n0(c.unique_click_count)} sub={`${pct(c.unique_click_count, c.delivered_count)} · ${n0(c.click_count)} total clicks`} color="#15803d" />
        <StatTile label="Bounced" value={n0(c.bounce_count)} sub={`Hard: ${n0(c.hard_bounce_count)} · Soft: ${n0(c.soft_bounce_count)}`} color="#dc2626" />
        <StatTile label="Unsubscribed" value={n0(c.unsubscribe_count)} color="#c2410c" />
        {c.goal_event_name && <StatTile label="Conversions" value={n0(c.conversion_count)} sub={`${pct(c.conversion_count, c.total_recipients)} · click-attributed`} color="#7c3aed" />}
      </div>

      {devices && (devices.mobile + devices.tablet + devices.desktop + devices.unknown) > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#94a3b8', alignSelf: 'center' }}>Clicked from:</span>
          {[['mobile', '#1d4ed8'], ['desktop', '#15803d'], ['tablet', '#b45309'], ['unknown', '#94a3b8']].map(([k, color]) => (
            devices[k] > 0 && (
              <span key={k} style={{ fontSize: 11.5, fontWeight: 700, color, background: color + '18', padding: '6px 12px', borderRadius: 999 }}>
                {k[0].toUpperCase() + k.slice(1)}: {n0(devices[k])}
              </span>
            )
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
        {[['pending', '#94a3b8'], ['processing', '#1d4ed8'], ['sent', '#15803d'], ['failed', '#dc2626'], ['bounced', '#c2410c']].map(([k, color]) => (
          <span key={k} style={{ fontSize: 11.5, fontWeight: 700, color, background: color + '18', padding: '6px 12px', borderRadius: 999 }}>
            {k[0].toUpperCase() + k.slice(1)}: {n0(rc[k])}
          </span>
        ))}
      </div>

      {(data.failed_recipients || []).length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 12, overflow: 'hidden', marginBottom: 22 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #fecaca', background: '#fef2f2', fontSize: 13.5, fontWeight: 700, color: '#dc2626' }}>
            Failed sends — what the provider actually said <span style={{ color: '#94a3b8', fontWeight: 500 }}>(most recent {data.failed_recipients.length})</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 600 }}>Recipient</th>
                <th style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 600 }}>Attempts</th>
                <th style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 600 }}>Error from provider</th>
              </tr>
            </thead>
            <tbody>
              {data.failed_recipients.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', color: '#334155', whiteSpace: 'nowrap' }}>{r.email}</td>
                  <td style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', color: '#64748b' }}>{r.attempts}</td>
                  <td style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', color: '#dc2626', fontFamily: 'monospace', fontSize: 11.5 }}>{r.error_message || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bounced && bounced.recipients.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 12, overflow: 'hidden', marginBottom: 22 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #fecaca', background: '#fef2f2', fontSize: 13.5, fontWeight: 700, color: '#dc2626' }}>
            Bounced recipients <span style={{ color: '#94a3b8', fontWeight: 500 }}>({n0(bounced.total)} total)</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 600 }}>Recipient</th>
                <th style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 600 }}>Type</th>
                <th style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 600 }}>Bounced at</th>
              </tr>
            </thead>
            <tbody>
              {bounced.recipients.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', color: '#334155', whiteSpace: 'nowrap' }}>{r.email}</td>
                  <td style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                      color: r.bounce_type === 'soft' ? '#b45309' : '#dc2626',
                      background: r.bounce_type === 'soft' ? '#fef3c7' : '#fee2e2',
                    }}>{r.bounce_type === 'soft' ? 'SOFT' : 'HARD'}</span>
                  </td>
                  <td style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDt(r.bounced_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {bounced.pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 18px', borderTop: '1px solid #fecaca' }}>
              <button disabled={bouncedPage <= 1} onClick={() => loadBounced(bouncedPage - 1)} style={{ padding: '5px 12px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: bouncedPage <= 1 ? 'not-allowed' : 'pointer', opacity: bouncedPage <= 1 ? .4 : 1, fontSize: 12 }}>Prev</button>
              <span style={{ fontSize: 12.5, color: '#475569', alignSelf: 'center' }}>Page {bouncedPage} of {bounced.pages}</span>
              <button disabled={bouncedPage >= bounced.pages} onClick={() => loadBounced(bouncedPage + 1)} style={{ padding: '5px 12px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: bouncedPage >= bounced.pages ? 'not-allowed' : 'pointer', opacity: bouncedPage >= bounced.pages ? .4 : 1, fontSize: 12 }}>Next</button>
            </div>
          )}
        </div>
      )}

      {c.goal_event_name && (
        <div style={{ background: '#fff', border: '1px solid #ddd6fe', borderRadius: 12, overflow: 'hidden', marginBottom: 22 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #ede9fe', background: '#faf5ff', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#6d28d9', flex: 1, minWidth: 200 }}>
              Converted users · {EVENT_LABEL[c.goal_event_name] || c.goal_event_name}
              {conv && <span style={{ color: '#a78bfa', fontWeight: 500 }}> ({n0(conv.total)} {convSearch ? 'matching' : 'total'})</span>}
            </div>
            <form onSubmit={e => { e.preventDefault(); setConvSearch(convSearchInput.trim()); }} style={{ display: 'flex', gap: 6 }}>
              <input
                value={convSearchInput} onChange={e => setConvSearchInput(e.target.value)}
                placeholder="Search name, email, phone"
                style={{ padding: '6px 11px', border: '1.5px solid #ddd6fe', borderRadius: 7, fontSize: 12.5, width: 200, outline: 'none', fontFamily: 'inherit' }}
              />
              <button type="submit" style={{ padding: '6px 13px', border: 'none', borderRadius: 7, background: '#7c3aed', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Search</button>
              {convSearch && (
                <button type="button" onClick={() => { setConvSearchInput(''); setConvSearch(''); }} style={{ padding: '6px 11px', border: '1.5px solid #e2e8f0', borderRadius: 7, background: '#fff', color: '#64748b', fontSize: 12.5, cursor: 'pointer' }}>Clear</button>
              )}
            </form>
            <button
              onClick={exportConversions}
              disabled={exporting || !conv || conv.total === 0}
              style={{ padding: '6px 13px', border: '1.5px solid #7c3aed', borderRadius: 7, background: '#fff', color: '#7c3aed', fontWeight: 600, fontSize: 12.5, cursor: (exporting || !conv?.total) ? 'not-allowed' : 'pointer', opacity: (exporting || !conv?.total) ? .5 : 1 }}
            >{exporting ? 'Preparing…' : 'Download CSV'}</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 720 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Name', 'Email', 'Phone', 'Medium', 'Clicked at', 'Converted at', ''].map((h, i) => (
                    <th key={i} style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {convLoading && !conv ? (
                  <tr><td colSpan={7} style={{ padding: 28, textAlign: 'center', color: '#94a3b8' }}>Loading…</td></tr>
                ) : !conv || conv.rows.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 28, textAlign: 'center', color: '#94a3b8' }}>
                    {convSearch ? 'No converted user matches that search.' : 'No conversions recorded yet for this goal.'}
                  </td></tr>
                ) : conv.rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.name || '—'}</td>
                    <td style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', color: '#334155' }}>{r.email || '—'}</td>
                    <td style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', color: '#64748b', whiteSpace: 'nowrap' }}>{r.phone || '—'}</td>
                    <td style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, color: '#6d28d9', background: '#ede9fe' }}>{(r.medium || 'email').toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDt(r.clicked_at)}</td>
                    <td style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', color: '#15803d', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtDt(r.converted_at)}</td>
                    <td style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9' }}>
                      <button onClick={() => openDetail(r.user_id)} style={{ padding: '5px 12px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', color: '#6d28d9', fontWeight: 600, fontSize: 11.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>View detail</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {conv && conv.pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 18px', borderTop: '1px solid #ede9fe' }}>
              <button disabled={convPage <= 1} onClick={() => loadConversions(convPage - 1)} style={{ padding: '5px 12px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: convPage <= 1 ? 'not-allowed' : 'pointer', opacity: convPage <= 1 ? .4 : 1, fontSize: 12 }}>Prev</button>
              <span style={{ fontSize: 12.5, color: '#475569', alignSelf: 'center' }}>Page {convPage} of {conv.pages}</span>
              <button disabled={convPage >= conv.pages} onClick={() => loadConversions(convPage + 1)} style={{ padding: '5px 12px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: convPage >= conv.pages ? 'not-allowed' : 'pointer', opacity: convPage >= conv.pages ? .4 : 1, fontSize: 12 }}>Next</button>
            </div>
          )}
        </div>
      )}

      {detail && (
        <div
          onClick={() => setDetail(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 'min(720px, 100%)', maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 18px 48px rgba(15,23,42,.25)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, background: '#fff', borderRadius: '14px 14px 0 0' }}>
              <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                {detailLoading ? 'Loading…' : (detail.user ? `${detail.user.fname || ''} ${detail.user.lname || ''}`.trim() || detail.user.email : 'User detail')}
                {!detailLoading && detail.goal_event_name && (
                  <div style={{ fontSize: 11.5, fontWeight: 500, color: '#94a3b8', marginTop: 2 }}>
                    Converted on {EVENT_LABEL[detail.goal_event_name] || detail.goal_event_name}
                  </div>
                )}
              </div>
              <button onClick={() => setDetail(null)} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: '#334155', fontSize: 16, lineHeight: 1 }}>×</button>
            </div>

            {detailLoading ? (
              <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
            ) : (
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
                {detail.user && (
                  <DetailBlock title="Profile" rows={[
                    ['User ID', detail.user.user_id], ['Email', detail.user.email], ['Phone', detail.user.phone],
                    ['City', detail.user.city], ['State', detail.user.state], ['Country', detail.user.country],
                    ['Registered at', fmtDt(detail.user.registered_at)],
                  ]} />
                )}
                {detail.recipient && (
                  <DetailBlock title="This campaign" rows={[
                    ['Sent to', detail.recipient.email], ['Status', detail.recipient.status],
                    ['Sent at', fmtDt(detail.recipient.sent_at)],
                    ['First opened', fmtDt(detail.recipient.opened_at)],
                    ['First clicked', fmtDt(detail.recipient.first_clicked_at)],
                    ['Opens / Clicks', `${n0(detail.recipient.open_count)} / ${n0(detail.recipient.click_count)}`],
                  ]} />
                )}
                {detail.attribution && (
                  <DetailBlock title="Attribution" rows={[
                    ['Medium', detail.attribution.medium], ['Clicked at', fmtDt(detail.attribution.clicked_at)],
                    ['Attributed at', fmtDt(detail.attribution.attributed_at)],
                  ]} />
                )}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9', marginBottom: 8 }}>
                    Goal event records {detail.events?.length > 0 && <span style={{ color: '#a78bfa', fontWeight: 500 }}>({detail.events.length})</span>}
                  </div>
                  {!detail.events || detail.events.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: '#94a3b8' }}>No underlying records found for this event.</div>
                  ) : detail.events.map((ev, i) => (
                    <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', marginBottom: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px 16px' }}>
                      {Object.entries(ev).map(([k, v]) => (
                        <div key={k} style={{ fontSize: 11.5, minWidth: 0 }}>
                          <span style={{ color: '#94a3b8' }}>{prettyKey(k)}: </span>
                          <span style={{ color: '#334155', fontWeight: 600, wordBreak: 'break-word' }}>{v === null || v === '' ? '—' : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>
          Recent activity {data.events_total > 0 && <span style={{ color: '#94a3b8', fontWeight: 500 }}>({n0(data.events_total)} events)</span>}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 600 }}>Event</th>
              <th style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 600 }}>Recipient</th>
              <th style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 600 }}>Link</th>
              <th style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 600 }}>When</th>
            </tr>
          </thead>
          <tbody>
            {data.events.length === 0
              ? <tr><td colSpan={4} style={{ padding: 28, textAlign: 'center', color: '#94a3b8' }}>No tracking events yet.</td></tr>
              : data.events.map((e, i) => (
                <tr key={i}>
                  <td style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ color: EVT_COLOR[e.event_type] || '#334155', fontWeight: 700 }}>{EVT_LABEL[e.event_type] || e.event_type}</span>
                  </td>
                  <td style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', color: '#334155' }}>{e.email}</td>
                  <td style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', color: '#64748b', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.url || '—'}</td>
                  <td style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDt(e.created_at)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {data.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button disabled={page <= 1} onClick={() => load(page - 1)} style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? .4 : 1, fontSize: 12 }}>Prev</button>
          <span style={{ fontSize: 12.5, color: '#475569', alignSelf: 'center' }}>Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => load(page + 1)} style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: page >= data.pages ? 'not-allowed' : 'pointer', opacity: page >= data.pages ? .4 : 1, fontSize: 12 }}>Next</button>
        </div>
      )}
    </div>
  );
}
