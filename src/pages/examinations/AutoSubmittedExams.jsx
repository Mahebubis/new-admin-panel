import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API   = '/api/examinations/auto_submitted.php';
const FH    = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk    = obj => new URLSearchParams(obj);
const LIMIT = 10;

const thS = {
  color:'#fff', fontSize:11, fontWeight:600, padding:'11px 12px',
  textAlign:'left', textTransform:'uppercase', letterSpacing:'.3px',
  borderRight:'1px solid rgba(255,255,255,.15)', whiteSpace:'nowrap',
};
const tdS = { padding:'9px 12px', borderBottom:'1px solid #f5f3ff', color:'#334155', fontSize:12, verticalAlign:'middle' };

/* confirm modal */
function ConfirmModal({ msg, onOk, onCancel }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:14, maxWidth:420, width:'100%',
        boxShadow:'0 20px 60px rgba(0,0,0,.25)', overflow:'hidden' }}>
        <div style={{ padding:'13px 18px', background:'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
          <span style={{ fontSize:14, fontWeight:700, color:'#fff' }}>⚠️ Confirm Reset</span>
        </div>
        <div style={{ padding:'18px 22px' }}>
          <p style={{ fontSize:13, color:'#334155', marginBottom:18, lineHeight:1.55 }}>{msg}</p>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={onCancel}
              style={{ padding:'8px 16px', border:'1.5px solid #e2e8f0', background:'#f8fafc',
                color:'#475569', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>Cancel</button>
            <button onClick={onOk}
              style={{ padding:'8px 22px', border:'none', borderRadius:8, fontSize:12.5,
                fontWeight:700, cursor:'pointer', color:'#fff',
                background:'linear-gradient(135deg,#dc2626,#b91c1c)' }}>Yes, Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AutoSubmittedExams() {
  const [rows,        setRows]        = useState([]);
  const [allData,     setAllData]     = useState([]);
  const [count,       setCount]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(new Set());
  const [confirm,     setConfirm]     = useState(null); // { ids:[], msg:'' }
  const [resetting,   setResetting]   = useState(false);

  /* ── fetch — same as PHP's fetchData() ── */
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const offset = (page - 1) * LIMIT;
    const params = { action:'fetch_auto_submitted_exams', limit: LIMIT, offset };
    if (search)    params.keyword    = search;
    if (startDate) params.start_date = startDate;
    if (endDate)   params.end_date   = endDate;

    api.post(API, mk(params), { ...FH, signal: controller.signal })
      .then(res => {
        if (res.data.status === 'success') {
          const d = res.data.data;
          setRows(d.limited || []);
          setAllData(d.all   || []);
          setCount(d.total_count || 0);
          setSelected(new Set()); // reset selection on data change
        } else {
          toast.error(res.data.message || 'Failed to load');
        }
      })
      .catch(err => { if (err?.name !== 'CanceledError' && err?.name !== 'AbortError') toast.error('Failed to load'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [page, search, startDate, endDate]);

  /* ── date validation ── */
  const handleDateChange = (field, val) => {
    if (field==='start') {
      if (val && endDate && val > endDate) { toast.error('Start Date should be less than End Date'); return; }
      setStartDate(val);
    } else {
      if (startDate && val && startDate > val) { toast.error('Start Date should be less than End Date'); return; }
      setEndDate(val);
    }
    setPage(1);
  };

  /* ── selection — same as PHP's row-checkbox + selectAll ── */
  const toggleAll = (c) => setSelected(c ? new Set(rows.map(r => r.user_id)) : new Set());
  const toggleOne = (id) => setSelected(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });
  const allChecked = rows.length > 0 && rows.every(r => selected.has(r.user_id));

  /* ── execute reset ── */
  const execReset = async () => {
    const { ids } = confirm;
    setConfirm(null);
    setResetting(true);
    try {
      const isSingle = ids.length === 1;
      const action   = isSingle ? 'delete_auto_submitted_exam' : 'bulk_delete_auto_submitted_exams';
      const params   = isSingle
        ? mk({ action, user_id: ids[0] })
        : mk({ action, user_ids: JSON.stringify(ids) });
      const res = await api.post(API, params, FH);
      if (res.data.status === 'success') {
        toast.success(res.data.message);
        setSelected(new Set());
        // Remove reset rows in place — same as PHP's fetchData() reload
        setRows(p => p.filter(r => !ids.includes(r.user_id)));
        setCount(p => p - ids.length);
      } else {
        toast.error(res.data.message || 'Reset failed');
      }
    } catch { toast.error('Error'); }
    finally { setResetting(false); }
  };

  /* ── download CSV — same as PHP's convertToCSV + downloadCSV ── */
  const downloadReport = () => {
    if (!allData.length) { toast.error('No data available to download!'); return; }
    const headers = 'User ID,Name,Email,Exam Start,Exam End,Duration (sec)';
    const lines   = allData.map(r =>
      [r.user_id, r.name, r.email, r.start_exam, r.end_exam, r.duration_sec].join(',')
    );
    const csv  = [headers, ...lines].join('\r\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'AutoSubmittedExams.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doSearch    = () => { setSearch(searchInput); setPage(1); };
  const clearSearch = () => { setSearchInput(''); setSearch(''); setStartDate(''); setEndDate(''); setPage(1); };

  const totalPages  = Math.ceil(count / LIMIT) || 1;
  const pageButtons = () => {
    const maxV = 5;
    let start  = Math.max(1, page - Math.floor(maxV/2));
    let end    = Math.min(totalPages, start + maxV - 1);
    if (end - start + 1 < maxV) start = Math.max(1, end - maxV + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  /* ── duration badge — red if very short ── */
  const DurBadge = ({ sec }) => {
    const v = parseInt(sec);
    return <span style={{ padding:'2px 9px', borderRadius:99, fontSize:10.5, fontWeight:700,
      background: v < 30 ? '#fee2e2' : '#fef9c3',
      color: v < 30 ? '#dc2626' : '#b45309' }}>{v}s</span>;
  };

  /* ════════ RENDER ════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .as-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .as-tr:hover td{background:#faf9ff!important;}
        .as-pg:hover:not(:disabled){background:#ede9fe!important;color:#4f46e5!important;}
        @keyframes as_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="as-root" style={{
        display:'flex', flexDirection:'column',
        height:'calc(100vh - 62px)',
        padding:20, gap:14, overflow:'hidden', background:'#f5f3ff',
      }}>

        {/* ── HEADER ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:'#1e293b' }}>🐛 Auto-Submitted Exams</div>
            <div style={{ fontSize:11.5, color:'#64748b', marginTop:2 }}>
              Users whose exam was auto-submitted in under 60 seconds due to a frontend bug (no result stored)
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:12.5, color:'#64748b', fontWeight:600 }}>
              Count: <strong style={{ color:'#4f46e5' }}>{count}</strong>
            </span>
            <button onClick={downloadReport}
              style={{ padding:'8px 16px', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700,
                cursor:'pointer', color:'#fff', background:'linear-gradient(135deg,#16a34a,#15803d)' }}>
              ⬇️ Download CSV
            </button>
          </div>
        </div>

        {/* ── TOOLBAR ── */}
        <div style={{ display:'flex', gap:10, alignItems:'center', flexShrink:0, flexWrap:'wrap' }}>
          {/* search */}
          <div style={{ display:'flex', border:'1.5px solid #e2e8f0', borderRadius:8,
            overflow:'hidden', background:'#fff', flex:'0 0 280px' }}>
            <input value={searchInput}
              onChange={e=>setSearchInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&doSearch()}
              placeholder="Search by name or email..."
              style={{ border:'none', padding:'8px 12px', fontSize:12.5, flex:1,
                outline:'none', fontFamily:'inherit', color:'#1e293b' }}/>
            <button onClick={doSearch}
              style={{ background:'#4f46e5', color:'#fff', border:'none', padding:'0 12px', cursor:'pointer', fontSize:12 }}>🔍</button>
            <button onClick={clearSearch}
              style={{ background:'#f1f5f9', color:'#64748b', border:'none', padding:'0 10px', cursor:'pointer', fontSize:14 }}>×</button>
          </div>

          {/* date filters */}
          {[['Start',startDate,'start'],['End',endDate,'end']].map(([lbl,val,field])=>(
            <div key={lbl} style={{ display:'flex', alignItems:'center', gap:7 }}>
              <label style={{ fontSize:11, fontWeight:600, color:'#64748b', textTransform:'uppercase' }}>{lbl}</label>
              <input type="date" value={val} onChange={e=>handleDateChange(field,e.target.value)}
                style={{ padding:'8px 10px', border:'1.5px solid #e2e8f0', borderRadius:8,
                  fontSize:12, fontFamily:'inherit', color:'#1e293b', outline:'none',
                  background:'#fff', cursor:'pointer' }}/>
            </div>
          ))}
        </div>

        {/* ── BULK ACTION BAR — same as PHP's bulk-bar ── */}
        {selected.size > 0 && (
          <div style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between',
            background:'#fefce8', border:'1.5px solid #fde68a', borderRadius:10, padding:'10px 16px' }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#92400e' }}>
              <strong style={{ color:'#b45309' }}>{selected.size}</strong> user(s) selected
            </span>
            <button
              onClick={() => setConfirm({
                ids:[...selected],
                msg:`Reset ${selected.size} user(s)? This will delete their exam login and data so they can retake the exam.`
              })}
              disabled={resetting}
              style={{ padding:'7px 16px', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700,
                cursor:'pointer', color:'#fff', background:'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
              🔄 Reset Selected ({selected.size})
            </button>
          </div>
        )}

        {/* ── TABLE CARD ── */}
        <div style={{ flex:1, minHeight:0, background:'#fff', borderRadius:12,
          border:'1.5px solid #ede9fe', boxShadow:'0 1px 8px rgba(79,70,229,.05)',
          display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead style={{ position:'sticky', top:0, zIndex:2 }}>
                <tr style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  <th style={{ ...thS, width:44, textAlign:'center' }}>
                    <input type="checkbox" checked={allChecked}
                      onChange={e=>toggleAll(e.target.checked)}
                      style={{ accentColor:'#fff', width:14, height:14 }}/>
                  </th>
                  {['User ID','Name','Email','Exam Start','Exam End','Duration','Action'].map(h=>(
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign:'center', padding:48 }}>
                    <div style={{ display:'inline-block', width:28, height:28, border:'3px solid #ede9fe',
                      borderTop:'3px solid #4f46e5', borderRadius:'50%', animation:'as_spin .7s linear infinite' }}/>
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign:'center', color:'#94a3b8', padding:40, fontSize:13 }}>
                    No auto-submitted exams found
                  </td></tr>
                ) : rows.map(row => (
                  <tr key={row.user_id} className="as-tr">
                    <td style={{ ...tdS, textAlign:'center' }}>
                      <input type="checkbox" checked={selected.has(row.user_id)}
                        onChange={()=>toggleOne(row.user_id)}
                        style={{ accentColor:'#4f46e5', width:14, height:14 }}/>
                    </td>
                    <td style={{ ...tdS, color:'#4f46e5', fontWeight:600, fontSize:11.5 }}>{row.user_id}</td>
                    <td style={{ ...tdS, fontWeight:600, color:'#1e293b' }}>{row.name}</td>
                    <td style={{ ...tdS, fontSize:11.5 }}>{row.email}</td>
                    <td style={{ ...tdS, fontSize:11, whiteSpace:'nowrap' }}>{row.start_exam}</td>
                    <td style={{ ...tdS, fontSize:11, whiteSpace:'nowrap' }}>{row.end_exam}</td>
                    <td style={tdS}><DurBadge sec={row.duration_sec}/></td>
                    <td style={tdS}>
                      {/* Reset button — same as PHP's resetUser() ── */}
                      <button
                        onClick={() => setConfirm({
                          ids:[row.user_id],
                          msg:`Reset this user's exam? This will delete their exam login and data so they can retake the exam.`
                        })}
                        style={{ padding:'5px 11px', background:'#fee2e2', color:'#dc2626',
                          border:'1.5px solid #fecaca', borderRadius:6, fontSize:11,
                          fontWeight:700, cursor:'pointer' }}>
                        🔄 Reset
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
              {[['First',()=>setPage(1)],['Prev',()=>setPage(p=>p-1)]].map(([l,fn])=>(
                <button key={l} className="as-pg" onClick={fn} disabled={page===1}
                  style={{ padding:'4px 10px', border:'1.5px solid #e2e8f0', borderRadius:6,
                    background:'#fff', fontSize:12, cursor:page===1?'not-allowed':'pointer',
                    color:page===1?'#cbd5e1':'#334155' }}>{l}</button>
              ))}
              {pageButtons().map(pg=>(
                <button key={pg} className="as-pg" onClick={()=>setPage(pg)}
                  style={{ padding:'4px 10px', border:'1.5px solid #e2e8f0', borderRadius:6,
                    background:pg===page?'linear-gradient(135deg,#4f46e5,#7c3aed)':'#fff',
                    color:pg===page?'#fff':'#334155', fontSize:12, cursor:'pointer',
                    fontWeight:pg===page?700:400 }}>{pg}</button>
              ))}
              {[['Next',()=>setPage(p=>p+1)],['Last',()=>setPage(totalPages)]].map(([l,fn])=>(
                <button key={l} className="as-pg" onClick={fn} disabled={page===totalPages}
                  style={{ padding:'4px 10px', border:'1.5px solid #e2e8f0', borderRadius:6,
                    background:'#fff', fontSize:12, cursor:page===totalPages?'not-allowed':'pointer',
                    color:page===totalPages?'#cbd5e1':'#334155' }}>{l}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CONFIRM MODAL ── */}
      {confirm && <ConfirmModal msg={confirm.msg} onOk={execReset} onCancel={()=>setConfirm(null)}/>}
    </>
  );
}