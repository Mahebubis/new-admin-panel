import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API   = '/api/examinations/exam_results.php';
const FH    = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk    = obj => new URLSearchParams(obj);
const LIMIT = 20;

const thS = {
  color:'#fff', fontSize:11, fontWeight:600, padding:'11px 12px',
  textAlign:'left', textTransform:'uppercase', letterSpacing:'.3px',
  borderRight:'1px solid rgba(255,255,255,.15)', whiteSpace:'nowrap',
};
const tdS = { padding:'9px 12px', borderBottom:'1px solid #f5f3ff', color:'#334155', fontSize:12, verticalAlign:'middle' };

export default function ExamResults() {
  const [rows,        setRows]        = useState([]);
  const [allData,     setAllData]     = useState([]);
  const [totalCount,  setTotalCount]  = useState(0);
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [loading,     setLoading]     = useState(true);
  const [actionLoad,  setActionLoad]  = useState({});

  /* ── fetch — same as PHP's fetchData() ── */
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const offset = (page - 1) * LIMIT;
    const params = { action:'fetch_exam_results', limit: LIMIT, offset };
    if (search)    params.keyword    = search;
    if (startDate) params.start_date = startDate;
    if (endDate)   params.end_date   = endDate;

    api.post(API, mk(params), { ...FH, signal: controller.signal })
      .then(res => {
        if (res.data.status === 'success') {
          const d = res.data.data;
          setRows(d.limited || []);
          setAllData(d.all || []);
          setTotalCount(d.total_count || 0);
        } else {
          toast.error(res.data.message || 'Failed to load');
        }
      })
      .catch(err => { if (err?.name !== 'CanceledError' && err?.name !== 'AbortError') toast.error('Failed to load'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [page, search, startDate, endDate]);

  /* ── date validation — same as PHP's parseDateString check ── */
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

  /* ── delete result — same as PHP's deleteResult() ── */
  const deleteResult = async (user_id, rightans) => {
    if (!window.confirm('Please confirm the result deletion.')) return;
    const key = `del_${user_id}`;
    setActionLoad(p => ({ ...p, [key]: true }));
    try {
      const res = await api.post(API, mk({ action:'delete_student_result', user_id, rightans }), FH);
      if (res.data.status === 'success') {
        toast.success(res.data.message);
        setRows(p => p.filter(r => !(r.user_id == user_id && r.rightans == rightans)));
        setTotalCount(p => p - 1);
      } else { toast.error(res.data.message || 'Failed'); }
    } catch { toast.error('Error'); }
    finally { setActionLoad(p => ({ ...p, [key]: false })); }
  };

  /* ── add result — same as PHP's addResult() ── */
  const addResult = async (row) => {
    if (!window.confirm('Please confirm to publish the result.')) return;
    const key = `add_${row.user_id}`;
    setActionLoad(p => ({ ...p, [key]: true }));
    try {
      const res = await api.post(API, mk({
        action: 'add_student_result',
        user_id: row.user_id, rightans: row.rightans,
        wrongans: row.wrongans, total: row.total,
        exam_taken_date: row.exam_taken_date,
      }), FH);
      if (res.data.status === 'success') {
        toast.success(res.data.message);
        // Reload data
        setPage(p => p);
      } else { toast.error(res.data.message || 'Failed'); }
    } catch { toast.error('Error'); }
    finally { setActionLoad(p => ({ ...p, [key]: false })); }
  };

  /* ── download CSV — same as PHP's convertToCSV + downloadCSV ── */
  const downloadReport = () => {
    if (!allData.length) { toast.error('No data available to download!'); return; }
    const headers = 'User ID,Student Name,Email,Phone,Rank,Total Marks,Right Answer,Wrong Answer,Skipped Questions,Exam Date';
    const lines   = allData.map(r =>
      [r.user_id, r.user_name, r.user_email, r.phone || '', r.rank || '', r.total || '',
       r.rightans || '', r.wrongans || '', r.skipq || '', r.exam_taken_date || ''].join(',')
    );
    const csv  = [headers, ...lines].join('\r\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'ExamGivenReport.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doSearch = () => { setSearch(searchInput); setPage(1); };
  const clearSearch = () => { setSearchInput(''); setSearch(''); setPage(1); };

  const totalPages  = Math.ceil(totalCount / LIMIT) || 1;
  const pageButtons = () => {
    const maxV = 5;
    let start  = Math.max(1, page - Math.floor(maxV/2));
    let end    = Math.min(totalPages, start + maxV - 1);
    if (end - start + 1 < maxV) start = Math.max(1, end - maxV + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  /* ════════ RENDER ════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .er-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .er-tr:hover td{background:#faf9ff!important;}
        .er-pg:hover:not(:disabled){background:#ede9fe!important;color:#4f46e5!important;}
        @keyframes er_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="er-root" style={{
        display:'flex', flexDirection:'column',
        height:'calc(100vh - 62px)',
        padding:20, gap:14, overflow:'hidden', background:'#f5f3ff',
      }}>

        {/* ── HEADER ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ fontSize:17, fontWeight:800, color:'#1e293b' }}>📊 Exam Results</div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:12.5, color:'#64748b', fontWeight:600 }}>
              Count: <strong style={{ color:'#4f46e5' }}>{totalCount}</strong>
            </span>
            <button onClick={downloadReport}
              style={{ padding:'8px 18px', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700,
                cursor:'pointer', color:'#fff', background:'linear-gradient(135deg,#16a34a,#15803d)' }}>
              ⬇️ Download Report
            </button>
          </div>
        </div>

        {/* ── TOOLBAR ── */}
        <div style={{ display:'flex', gap:10, alignItems:'center', flexShrink:0, flexWrap:'wrap' }}>
          {/* search */}
          <div style={{ display:'flex', border:'1.5px solid #e2e8f0', borderRadius:8,
            overflow:'hidden', background:'#fff', flex:'0 0 280px' }}>
            <input value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search by email..."
              style={{ border:'none', padding:'8px 12px', fontSize:12.5, flex:1,
                outline:'none', fontFamily:'inherit', color:'#1e293b' }}/>
            <button onClick={doSearch}
              style={{ background:'#4f46e5', color:'#fff', border:'none', padding:'0 13px', cursor:'pointer', fontSize:12 }}>🔍</button>
            <button onClick={clearSearch}
              style={{ background:'#f1f5f9', color:'#64748b', border:'none', padding:'0 10px', cursor:'pointer', fontSize:14 }}>×</button>
          </div>

          {/* date filters */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <label style={{ fontSize:11, fontWeight:600, color:'#64748b', textTransform:'uppercase' }}>Start</label>
            <input type="date" value={startDate} onChange={e => handleDateChange('start', e.target.value)}
              style={{ padding:'8px 10px', border:'1.5px solid #e2e8f0', borderRadius:8,
                fontSize:12, fontFamily:'inherit', color:'#1e293b', outline:'none',
                background:'#fff', cursor:'pointer' }}/>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <label style={{ fontSize:11, fontWeight:600, color:'#64748b', textTransform:'uppercase' }}>End</label>
            <input type="date" value={endDate} onChange={e => handleDateChange('end', e.target.value)}
              style={{ padding:'8px 10px', border:'1.5px solid #e2e8f0', borderRadius:8,
                fontSize:12, fontFamily:'inherit', color:'#1e293b', outline:'none',
                background:'#fff', cursor:'pointer' }}/>
          </div>
        </div>

        {/* ── TABLE CARD ── */}
        <div style={{ flex:1, minHeight:0, background:'#fff', borderRadius:12,
          border:'1.5px solid #ede9fe', boxShadow:'0 1px 8px rgba(79,70,229,.05)',
          display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead style={{ position:'sticky', top:0, zIndex:2 }}>
                <tr style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {['User ID','Student Name','Email','Rank','Total','Right','Wrong','Exam Date','Action'].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ textAlign:'center', padding:48 }}>
                    <div style={{ display:'inline-block', width:28, height:28, border:'3px solid #ede9fe',
                      borderTop:'3px solid #4f46e5', borderRadius:'50%', animation:'er_spin .7s linear infinite' }}/>
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign:'center', color:'#94a3b8', padding:40, fontSize:13 }}>
                    No exam results found
                  </td></tr>
                ) : rows.map((row, i) => (
                  <tr key={`${row.user_id}_${i}`} className="er-tr">
                    <td style={{ ...tdS, color:'#4f46e5', fontWeight:600, fontSize:11.5 }}>{row.user_id}</td>
                    <td style={{ ...tdS, fontWeight:600, color:'#1e293b', whiteSpace:'nowrap' }}>{row.user_name}</td>
                    <td style={{ ...tdS, fontSize:11.5, color:'#4f46e5' }}>{row.user_email}</td>
                    <td style={tdS}>
                      {row.rank
                        ? <span style={{ padding:'2px 9px', borderRadius:99, fontSize:10.5, fontWeight:700,
                            background:'#ede9fe', color:'#4f46e5' }}>#{row.rank}</span>
                        : <span style={{ color:'#94a3b8', fontSize:11 }}>—</span>}
                    </td>
                    <td style={{ ...tdS, fontWeight:700,
                      color: parseInt(row.total) >= 60 ? '#16a34a' : '#dc2626' }}>
                      {row.total || '—'}
                    </td>
                    <td style={{ ...tdS, color:'#16a34a', fontWeight:600 }}>{row.rightans}</td>
                    <td style={{ ...tdS, color:'#dc2626', fontWeight:600 }}>{row.wrongans}</td>
                    <td style={{ ...tdS, fontSize:11.5, whiteSpace:'nowrap' }}>{row.exam_taken_date}</td>
                    <td style={{ ...tdS, whiteSpace:'nowrap' }}>
                      {/* Delete — same as PHP's deleteResult button */}
                      <button
                        onClick={() => deleteResult(row.user_id, row.rightans)}
                        disabled={actionLoad[`del_${row.user_id}`]}
                        style={{ padding:'5px 10px', background:'#fee2e2', color:'#dc2626',
                          border:'1.5px solid #fecaca', borderRadius:6, fontSize:11,
                          fontWeight:600, cursor:'pointer', marginRight: row.rank ? 0 : 5,
                          opacity: actionLoad[`del_${row.user_id}`] ? .6 : 1 }}>
                        {actionLoad[`del_${row.user_id}`] ? '...' : '🗑 Delete'}
                      </button>
                      {/* Add Result — same as PHP: only shown when rank is null */}
                      {!row.rank && (
                        <button
                          onClick={() => addResult(row)}
                          disabled={actionLoad[`add_${row.user_id}`]}
                          style={{ padding:'5px 10px', background:'#e0f2fe', color:'#0369a1',
                            border:'1.5px solid #bae6fd', borderRadius:6, fontSize:11,
                            fontWeight:600, cursor:'pointer',
                            opacity: actionLoad[`add_${row.user_id}`] ? .6 : 1 }}>
                          {actionLoad[`add_${row.user_id}`] ? '...' : '➕ Add Result'}
                        </button>
                      )}
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
                <button key={l} className="er-pg" onClick={fn} disabled={page===1}
                  style={{ padding:'4px 10px', border:'1.5px solid #e2e8f0', borderRadius:6,
                    background:'#fff', fontSize:12, cursor:page===1?'not-allowed':'pointer',
                    color:page===1?'#cbd5e1':'#334155' }}>{l}</button>
              ))}
              {pageButtons().map(pg => (
                <button key={pg} className="er-pg" onClick={() => setPage(pg)}
                  style={{ padding:'4px 10px', border:'1.5px solid #e2e8f0', borderRadius:6,
                    background:pg===page?'linear-gradient(135deg,#4f46e5,#7c3aed)':'#fff',
                    color:pg===page?'#fff':'#334155', fontSize:12, cursor:'pointer',
                    fontWeight:pg===page?700:400 }}>{pg}</button>
              ))}
              {[['Next',()=>setPage(p=>p+1)],['Last',()=>setPage(totalPages)]].map(([l,fn]) => (
                <button key={l} className="er-pg" onClick={fn} disabled={page===totalPages}
                  style={{ padding:'4px 10px', border:'1.5px solid #e2e8f0', borderRadius:6,
                    background:'#fff', fontSize:12, cursor:page===totalPages?'not-allowed':'pointer',
                    color:page===totalPages?'#cbd5e1':'#334155' }}>{l}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}