import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/communication/wa_community.php';
const FH = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk = obj => new URLSearchParams(obj);
const LIMIT = 10;

const thS = {
  color: '#fff', fontSize: 11, fontWeight: 600, padding: '11px 12px',
  textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px',
  borderRight: '1px solid rgba(255,255,255,.15)', whiteSpace: 'nowrap',
};
const tdS = { padding: '9px 12px', borderBottom: '1px solid #f5f3ff', color: '#334155', fontSize: 12, verticalAlign: 'middle' };

export default function WhatsAppCommunity() {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState({}); // { [user_id]: true }

  /* ── fetch — same as PHP fetchData() ── */
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const offset = (page - 1) * LIMIT;
    const params = { action: 'fetch_whatsapp_joined_status', limit: LIMIT, offset };
    if (search) params.keyword = search;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    // api.post(API, mk(params), { ...FH, signal: controller.signal })
    api.post(API, mk(params), { ...FH, signal: controller.signal, timeout: 90000 })
      .then(res => {
        if (res.data.status === 'success') {
          setRows(res.data.data || []);
          setCount(res.data.count || 0);
        } else {
          toast.error(res.data.message || 'Failed to load');
        }
      })
      .catch(err => { if (err?.name !== 'CanceledError' && err?.name !== 'AbortError') toast.error('Failed to load'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [page, search, startDate, endDate]);

  /* ── send email — same as PHP sendEmail() + send_wa_community_email action ── */
  const sendEmail = async (user_id) => {
    if (!window.confirm('Please confirm if you want to send the mail.')) return;
    setSending(p => ({ ...p, [user_id]: true }));
    try {
      const res = await api.post(API, mk({ action: 'send_wa_community_email', user_id }), FH);
      if (res.data.status === 'success') {
        toast.success(res.data.message);
        // Update row in place — same as PHP's fetchData() call after success
        setRows(p => p.map(r => r.user_id == user_id ? { ...r, community_email_sent: 1 } : r));
      } else {
        toast.error(res.data.message || 'Failed');
      }
    } catch { toast.error('Error'); }
    finally { setSending(p => ({ ...p, [user_id]: false })); }
  };

  /* ── date validation — same as PHP's JS check ── */
  const handleDateChange = (type, val) => {
    if (type === 'start') {
      setStartDate(val);
      if (val && endDate && val > endDate) {
        toast.error('Start Date should be less than End Date');
        return;
      }
    } else {
      setEndDate(val);
      if (startDate && val && startDate > val) {
        toast.error('Start Date should be less than End Date');
        return;
      }
    }
    setPage(1);
  };

  const doSearch = () => { setSearch(searchInput); setPage(1); };
  const clearAll = () => { setSearchInput(''); setSearch(''); setStartDate(''); setEndDate(''); setPage(1); };
  const totalPages = Math.ceil(count / LIMIT) || 1;

  /* ── page window ── */
  const pageButtons = () => {
    const maxV = 5;
    let start = Math.max(1, page - Math.floor(maxV / 2));
    let end = Math.min(totalPages, start + maxV - 1);
    if (end - start + 1 < maxV) start = Math.max(1, end - maxV + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  /* ════════ RENDER ════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .wc-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .wc-tr:hover td{background:#faf9ff!important;}
        .wc-pg:hover:not(:disabled){background:#ede9fe!important;color:#4f46e5!important;border-color:#c4b5fd!important;}
        .wc-inp:focus{border-color:#4f46e5!important;box-shadow:0 0 0 3px rgba(79,70,229,.08)!important;}
        @keyframes wc_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="wc-root" style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100vh - 62px)',
        padding: 20, gap: 14, overflow: 'hidden', background: '#f5f3ff',
      }}>

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>💬 Student WhatsApp Data</div>
          <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>
            Count: <strong style={{ color: '#4f46e5' }}>{count}</strong>
          </span>
        </div>

        {/* ── TOOLBAR ── */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          {/* search */}
          <div style={{
            display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: 8,
            overflow: 'hidden', background: '#fff', flex: '0 0 280px'
          }}>
            <input className="wc-inp"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search by email..."
              style={{
                border: 'none', padding: '8px 12px', fontSize: 12.5, flex: 1,
                outline: 'none', fontFamily: 'inherit', color: '#1e293b'
              }} />
            <button onClick={doSearch}
              style={{
                background: '#4f46e5', color: '#fff', border: 'none',
                padding: '0 13px', cursor: 'pointer', fontSize: 12
              }}>🔍</button>
            <button onClick={clearAll}
              style={{
                background: '#f1f5f9', color: '#64748b', border: 'none',
                padding: '0 10px', cursor: 'pointer', fontSize: 14
              }}>×</button>
          </div>

          {/* date filters — same as PHP's flatpicker inputs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.3px' }}>
              Start
            </label>
            <input type="date" value={startDate}
              onChange={e => handleDateChange('start', e.target.value)}
              style={{
                padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8,
                fontSize: 12, fontFamily: 'inherit', color: '#1e293b', outline: 'none',
                background: '#fff', cursor: 'pointer'
              }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.3px' }}>
              End
            </label>
            <input type="date" value={endDate}
              onChange={e => handleDateChange('end', e.target.value)}
              style={{
                padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8,
                fontSize: 12, fontFamily: 'inherit', color: '#1e293b', outline: 'none',
                background: '#fff', cursor: 'pointer'
              }} />
          </div>
        </div>

        {/* ── TABLE CARD ── */}
        <div style={{
          flex: 1, minHeight: 0, background: '#fff', borderRadius: 12,
          border: '1.5px solid #ede9fe', boxShadow: '0 1px 8px rgba(79,70,229,.05)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>

          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {['Student Name', 'Email', 'Mobile No', 'Registered At', 'Community', 'Email Sent?', 'Action'].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48 }}>
                    <div style={{
                      display: 'inline-block', width: 28, height: 28, border: '3px solid #ede9fe',
                      borderTop: '3px solid #4f46e5', borderRadius: '50%', animation: 'wc_spin .7s linear infinite'
                    }} />
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 }}>
                    No data found
                  </td></tr>
                ) : rows.map(row => (
                  <tr key={row.user_id} className="wc-tr">
                    <td style={{ ...tdS, fontWeight: 600, color: '#1e293b' }}>{row.name}</td>
                    <td style={{ ...tdS, color: '#4f46e5', fontSize: 11.5 }}>{row.email}</td>
                    <td style={tdS}>{row.phone || '—'}</td>
                    <td style={{ ...tdS, fontSize: 11.5 }}>{row.registered_at}</td>
                    {/* joined_wa_communtity — note original typo preserved */}
                    <td style={tdS}>
                      {row.joined_wa_communtity
                        ? <span style={{
                          padding: '2px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
                          background: '#dcfce7', color: '#16a34a'
                        }}>{row.joined_wa_communtity}</span>
                        : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    {/* community_email_sent — same as PHP: 0 → red No, 1 → green Yes */}
                    <td style={tdS}>
                      {row.community_email_sent == 1
                        ? <span style={{
                          padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
                          background: '#dcfce7', color: '#16a34a'
                        }}>Yes</span>
                        : <span style={{
                          padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
                          background: '#fee2e2', color: '#dc2626'
                        }}>No</span>}
                    </td>
                    {/* Send Email — disabled if already sent, same as PHP's disabled attribute */}
                    <td style={tdS}>
                      <button
                        disabled={row.community_email_sent == 1 || sending[row.user_id]}
                        onClick={() => sendEmail(row.user_id)}
                        style={{
                          padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                          border: 'none', cursor: row.community_email_sent == 1 ? 'not-allowed' : 'pointer',
                          background: row.community_email_sent == 1 ? '#e2e8f0' : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                          color: row.community_email_sent == 1 ? '#94a3b8' : '#fff',
                          opacity: sending[row.user_id] ? .7 : 1
                        }}>
                        {sending[row.user_id] ? 'Sending...' : 'Send Email'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── PAGINATION — pinned to bottom ── */}
          {totalPages > 1 && (
            <div style={{
              flexShrink: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
              gap: 4, padding: '8px 14px', borderTop: '1px solid #f5f3ff',
              background: '#fafafa', flexWrap: 'wrap'
            }}>
              <span style={{ fontSize: 11.5, color: '#64748b', marginRight: 6 }}>
                Page {page} of {totalPages}
              </span>
              <button className="wc-pg" onClick={() => setPage(1)} disabled={page === 1}
                style={{
                  padding: '4px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                  background: '#fff', fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer',
                  color: page === 1 ? '#cbd5e1' : '#334155'
                }}>First</button>
              <button className="wc-pg" onClick={() => setPage(p => p - 1)} disabled={page === 1}
                style={{
                  padding: '4px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                  background: '#fff', fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer',
                  color: page === 1 ? '#cbd5e1' : '#334155'
                }}>Prev</button>
              {pageButtons().map(pg => (
                <button key={pg} className="wc-pg" onClick={() => setPage(pg)}
                  style={{
                    padding: '4px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                    background: pg === page ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#fff',
                    color: pg === page ? '#fff' : '#334155', fontSize: 12, cursor: 'pointer',
                    fontWeight: pg === page ? 700 : 400
                  }}>{pg}</button>
              ))}
              <button className="wc-pg" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
                style={{
                  padding: '4px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                  background: '#fff', fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  color: page === totalPages ? '#cbd5e1' : '#334155'
                }}>Next</button>
              <button className="wc-pg" onClick={() => setPage(totalPages)} disabled={page === totalPages}
                style={{
                  padding: '4px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                  background: '#fff', fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  color: page === totalPages ? '#cbd5e1' : '#334155'
                }}>Last</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}