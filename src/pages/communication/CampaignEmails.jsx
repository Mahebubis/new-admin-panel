import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API   = '/api/communication/campaign_emails.php';
const FH    = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk    = obj => new URLSearchParams(obj);
const LIMIT = 10;

const thS = {
  color:'#fff', fontSize:11, fontWeight:600, padding:'11px 12px',
  textAlign:'left', textTransform:'uppercase', letterSpacing:'.3px',
  borderRight:'1px solid rgba(255,255,255,.15)', whiteSpace:'nowrap',
};
const tdS = { padding:'9px 12px', borderBottom:'1px solid #f5f3ff', color:'#334155', fontSize:12, verticalAlign:'middle' };
const selS = {
  padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8,
  fontSize:12.5, fontFamily:'inherit', color:'#1e293b', outline:'none',
  background:'#fff', cursor:'pointer', width:'100%',
};

export default function CampaignEmails() {
  const [internships, setInternships] = useState([]);
  const [batches,     setBatches]     = useState([]);
  const [rows,        setRows]        = useState([]);
  const [count,       setCount]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [sending,     setSending]     = useState({});

  /* filter state — same as PHP's currentState */
  const [type,       setType]       = useState('all_users');
  const [internship, setInternship] = useState('');
  const [batch,      setBatch]      = useState('');
  const [startDate,  setStartDate]  = useState('');
  const [endDate,    setEndDate]    = useState('');

  /* ── load internships + batches (same as PHP's page-load queries) ── */
  useEffect(() => {
    api.get(API)
      .then(res => {
        if (res.data.status === 'success') {
          setInternships(res.data.internships || []);
          setBatches(res.data.batches || []);
        }
      })
      .catch(() => {});
  }, []);

  /* ── fetch users — same as PHP's fetchData() ── */
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const offset = (page - 1) * LIMIT;
    const params = { action:'fetch_users_with_details', type, limit: LIMIT, offset };
    if (internship) params.internship = internship;
    if (batch)      params.batch      = batch;
    if (startDate)  params.start_date = startDate;
    if (endDate)    params.end_date   = endDate;

    api.post(API, mk(params), { ...FH, signal: controller.signal })
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
  }, [page, type, internship, batch, startDate, endDate]);

  /* ── date change with validation — same as PHP ── */
  const handleDateChange = (field, val) => {
    if (field === 'start') {
      if (val && endDate && val > endDate) { toast.error('Start Date should be less than End Date'); return; }
      setStartDate(val);
    } else {
      if (startDate && val && startDate > val) { toast.error('Start Date should be less than End Date'); return; }
      setEndDate(val);
    }
    setPage(1);
  };

  /* ── type change — show/hide internship+batch dropdowns ── */
  const handleTypeChange = (val) => {
    setType(val);
    if (val !== 'specific_internship_users') { setInternship(''); setBatch(''); }
    setPage(1);
  };

  /* ── send email — same as PHP's sendEmail() ── */
  const sendEmail = async (user_id) => {
    if (!window.confirm('Please confirm if you want to send the mail.')) return;
    setSending(p => ({ ...p, [user_id]: true }));
    try {
      const res = await api.post(API, mk({ action:'send_internship_reminder_email', user_id }), FH);
      if (res.data.status === 'success') {
        toast.success(res.data.message);
        // Update counter in place — avoids full reload
        setRows(p => p.map(r => r.user_id == user_id
          ? { ...r, internship_reminder_email: (parseInt(r.internship_reminder_email)||0) + 1 }
          : r));
      } else { toast.error(res.data.message || 'Failed'); }
    } catch { toast.error('Error'); }
    finally { setSending(p => ({ ...p, [user_id]: false })); }
  };

  /* ── download CSV — same as PHP's convertToCSV + downloadCSV ── */
  const downloadReport = () => {
    if (!rows.length) { toast.error('No data available to download!'); return; }
    const headers = ['Student Name','Email','Mobile No','Registered At'];
    const lines   = rows.map(r => [r.name, r.email, r.phone, r.registered_at].map(v => `"${v||''}"`).join(','));
    const csv     = [headers.join(','), ...lines].join('\r\n');
    const blob    = new Blob([csv], { type:'text/csv' });
    const a       = document.createElement('a');
    a.href        = URL.createObjectURL(blob);
    a.download    = 'CampaignEmailReport.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const totalPages = Math.ceil(count / LIMIT) || 1;
  const pageButtons = () => {
    const maxV = 5;
    let start  = Math.max(1, page - Math.floor(maxV/2));
    let end    = Math.min(totalPages, start + maxV - 1);
    if (end - start + 1 < maxV) start = Math.max(1, end - maxV + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const showInternshipOpts = type === 'specific_internship_users';

  /* ════════ RENDER ════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .ce-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .ce-tr:hover td{background:#faf9ff!important;}
        .ce-pg:hover:not(:disabled){background:#ede9fe!important;color:#4f46e5!important;}
        @keyframes ce_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="ce-root" style={{
        display:'flex', flexDirection:'column',
        height:'calc(100vh - 62px)',
        padding:20, gap:14, overflow:'hidden', background:'#f5f3ff',
      }}>

        {/* ── HEADER ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ fontSize:17, fontWeight:800, color:'#1e293b' }}>📨 Send Bulk Email</div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:12.5, color:'#64748b', fontWeight:600 }}>
              Count: <strong style={{ color:'#4f46e5' }}>{count}</strong>
            </span>
            <button onClick={downloadReport}
              style={{ padding:'8px 18px', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700,
                cursor:'pointer', color:'#fff', background:'linear-gradient(135deg,#16a34a,#15803d)' }}>
              ⬇️ Download Report
            </button>
          </div>
        </div>

        {/* ── FILTER CARD ── */}
        <div style={{ background:'#fff', borderRadius:12, border:'1.5px solid #ede9fe',
          boxShadow:'0 1px 8px rgba(79,70,229,.05)', padding:'14px 18px',
          display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 20px', flexShrink:0 }}>

          {/* User Type — same as PHP's user_options select */}
          <div>
            <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'#64748b',
              textTransform:'uppercase', letterSpacing:'.4px', marginBottom:5 }}>User Type</label>
            <select style={selS} value={type} onChange={e => handleTypeChange(e.target.value)}>
              <option value="all_users">All Users</option>
              <option value="specific_internship_users">Specific Internship Users</option>
            </select>
          </div>

          {/* Date range */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'#64748b',
                textTransform:'uppercase', letterSpacing:'.4px', marginBottom:5 }}>Start Date</label>
              <input type="date" value={startDate} onChange={e => handleDateChange('start', e.target.value)}
                style={{ ...selS, cursor:'pointer' }}/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'#64748b',
                textTransform:'uppercase', letterSpacing:'.4px', marginBottom:5 }}>End Date</label>
              <input type="date" value={endDate} onChange={e => handleDateChange('end', e.target.value)}
                style={{ ...selS, cursor:'pointer' }}/>
            </div>
          </div>

          {/* Internship + Batch — same as PHP: only visible when specific_internship_users ── */}
          {showInternshipOpts && (
            <>
              <div>
                <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'#64748b',
                  textTransform:'uppercase', letterSpacing:'.4px', marginBottom:5 }}>Internship</label>
                <select style={selS} value={internship} onChange={e => { setInternship(e.target.value); setPage(1); }}>
                  <option value="">All Internships</option>
                  {internships.map(i => (
                    <option key={i.id} value={i.internship_name}>{i.internship_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'#64748b',
                  textTransform:'uppercase', letterSpacing:'.4px', marginBottom:5 }}>Batch</label>
                <select style={selS} value={batch} onChange={e => { setBatch(e.target.value); setPage(1); }}>
                  <option value="">All Batches</option>
                  {batches.map((b, i) => (
                    <option key={i} value={b.id || b.date}>{b.date}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {/* ── TABLE CARD ── */}
        <div style={{ flex:1, minHeight:0, background:'#fff', borderRadius:12,
          border:'1.5px solid #ede9fe', boxShadow:'0 1px 8px rgba(79,70,229,.05)',
          display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead style={{ position:'sticky', top:0, zIndex:2 }}>
                <tr style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {['Student Name','Email','Mobile No','Reminder Emails','Registered At','Action'].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign:'center', padding:48 }}>
                    <div style={{ display:'inline-block', width:28, height:28, border:'3px solid #ede9fe',
                      borderTop:'3px solid #4f46e5', borderRadius:'50%', animation:'ce_spin .7s linear infinite' }}/>
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign:'center', color:'#94a3b8', padding:40, fontSize:13 }}>
                    No students found
                  </td></tr>
                ) : rows.map(row => (
                  <tr key={row.user_id} className="ce-tr">
                    <td style={{ ...tdS, fontWeight:600, color:'#1e293b' }}>{row.name}</td>
                    <td style={{ ...tdS, color:'#4f46e5', fontSize:11.5 }}>{row.email}</td>
                    <td style={tdS}>{row.phone || '—'}</td>
                    {/* internship_reminder_email — count of emails sent */}
                    <td style={tdS}>
                      <span style={{ padding:'2px 9px', borderRadius:99, fontSize:10.5, fontWeight:700,
                        background: row.internship_reminder_email > 0 ? '#dbeafe' : '#f1f5f9',
                        color:      row.internship_reminder_email > 0 ? '#1d4ed8' : '#64748b' }}>
                        {row.internship_reminder_email || 0}
                      </span>
                    </td>
                    <td style={{ ...tdS, fontSize:11.5 }}>{row.registered_at}</td>
                    <td style={tdS}>
                      <button
                        onClick={() => sendEmail(row.user_id)}
                        disabled={sending[row.user_id]}
                        style={{ padding:'5px 12px', borderRadius:6, fontSize:11, fontWeight:700,
                          border:'none', cursor: sending[row.user_id] ? 'not-allowed' : 'pointer',
                          background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff',
                          opacity: sending[row.user_id] ? .7 : 1 }}>
                        {sending[row.user_id] ? 'Sending...' : '📧 Send Email'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── PAGINATION ── */}
          {totalPages > 1 && (
            <div style={{ flexShrink:0, display:'flex', justifyContent:'flex-end', alignItems:'center',
              gap:4, padding:'8px 14px', borderTop:'1px solid #f5f3ff', background:'#fafafa' }}>
              <span style={{ fontSize:11.5, color:'#64748b', marginRight:6 }}>Page {page} of {totalPages}</span>
              {[['First',()=>setPage(1)],['Prev',()=>setPage(p=>p-1)]].map(([l,fn]) => (
                <button key={l} className="ce-pg" onClick={fn} disabled={page===1}
                  style={{ padding:'4px 10px', border:'1.5px solid #e2e8f0', borderRadius:6, background:'#fff',
                    fontSize:12, cursor:page===1?'not-allowed':'pointer', color:page===1?'#cbd5e1':'#334155' }}>{l}</button>
              ))}
              {pageButtons().map(pg => (
                <button key={pg} className="ce-pg" onClick={() => setPage(pg)}
                  style={{ padding:'4px 10px', border:'1.5px solid #e2e8f0', borderRadius:6,
                    background:pg===page?'linear-gradient(135deg,#4f46e5,#7c3aed)':'#fff',
                    color:pg===page?'#fff':'#334155', fontSize:12, cursor:'pointer',
                    fontWeight:pg===page?700:400 }}>{pg}</button>
              ))}
              {[['Next',()=>setPage(p=>p+1)],['Last',()=>setPage(totalPages)]].map(([l,fn]) => (
                <button key={l} className="ce-pg" onClick={fn} disabled={page===totalPages}
                  style={{ padding:'4px 10px', border:'1.5px solid #e2e8f0', borderRadius:6, background:'#fff',
                    fontSize:12, cursor:page===totalPages?'not-allowed':'pointer',
                    color:page===totalPages?'#cbd5e1':'#334155' }}>{l}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}