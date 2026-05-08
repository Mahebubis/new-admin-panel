import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const API = 'https://dashboard.internshipstudio.com/api/total_assessments.php';
const PER_PAGE = 10;

const thS = {
  color:'#fff', fontSize:11, fontWeight:600, padding:'11px 12px',
  textAlign:'left', textTransform:'uppercase', letterSpacing:'.3px',
  borderRight:'1px solid rgba(255,255,255,.15)', whiteSpace:'nowrap',
};
const tdS = { padding:'9px 12px', borderBottom:'1px solid #f5f3ff', color:'#334155', fontSize:12, verticalAlign:'middle' };

export default function TotalAssessments() {
  const [skills,       setSkills]       = useState([]);
  const [subskills,    setSubskills]    = useState([]);
  const [segmentId,    setSegmentId]    = useState('');
  const [skillId,      setSkillId]      = useState('');
  const [data,         setData]         = useState([]);
  const [page,         setPage]         = useState(1);
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [loadingSubs,   setLoadingSubs]   = useState(false);
  const [loadingData,   setLoadingData]   = useState(false);
  const [downloading,   setDownloading]   = useState(false);

  /* ── load skill segments on mount — same as PHP's loadSkills() ── */
  useEffect(() => {
    fetch(`${API}?action=get_skills`)
      .then(r => r.json())
      .then(d => setSkills(Array.isArray(d) ? d : []))
      .catch(() => toast.error('Failed to load skills'))
      .finally(() => setLoadingSkills(false));
  }, []);

  /* ── load subskills when segment changes — same as PHP's skills.onchange ── */
  const handleSegmentChange = async (val) => {
    setSegmentId(val); setSkillId(''); setSubskills([]); setData([]);
    if (!val) return;
    setLoadingSubs(true);
    try {
      const res = await fetch(`${API}?action=get_subskills&segment_id=${val}`);
      const d   = await res.json();
      setSubskills(Array.isArray(d) ? d : []);
    } catch { toast.error('Failed to load subskills'); }
    finally { setLoadingSubs(false); }
  };

  /* ── load students when subskill changes — same as PHP's subskills.onchange ── */
  const handleSubskillChange = async (val) => {
    setSkillId(val); setData([]); setPage(1);
    if (!val || !segmentId) return;
    setLoadingData(true);
    try {
      const res = await fetch(`${API}?action=get_students&segment_id=${segmentId}&skill_id=${val}`);
      const d   = await res.json();
      // PHP returns plain array; React wrapper may wrap in { data: [] }
      setData(Array.isArray(d) ? d : (d?.data || []));
    } catch { toast.error('Failed to load students'); }
    finally { setLoadingData(false); }
  };

  /* ── pagination ── */
  const totalPages = Math.ceil(data.length / PER_PAGE);
  const paged      = data.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  /* ── page buttons — same smart window as PHP ── */
  const pageButtons = () => {
    const maxV  = 5;
    let start   = Math.max(1, page - Math.floor(maxV / 2));
    let end     = Math.min(totalPages, start + maxV - 1);
    if (end - start + 1 < maxV) start = Math.max(1, end - maxV + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  /* ── download Excel (same as PHP — uses SheetJS) ── */
  const downloadExcel = async () => {
    if (!data.length) { toast.error('No data to export!'); return; }
    setDownloading(true);
    try {
      // Load SheetJS on demand
      if (!window.XLSX) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src  = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const rows = data.map(r => ({
        'Full Name':   (r.fname || r.full_name || '') + (r.lname ? ' ' + r.lname : ''),
        'Email':       r.email       || '',
        'Phone':       r.phone       || '',
        'Percentile':  r.percentile  ?? '',
        'Date':        r.date        || '',
        'Segment':     r.segment_name || '',
        'Skill':       r.skill_name   || '',
      }));
      const ws = window.XLSX.utils.json_to_sheet(rows);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Students');
      window.XLSX.writeFile(wb, 'skill_assessment_report.xlsx');
    } catch { toast.error('Excel export failed'); }
    finally { setDownloading(false); }
  };

  /* ── get full name — PHP uses fname + lname ── */
  const fullName = (r) => r.full_name || `${r.fname || ''} ${r.lname || ''}`.trim() || '—';

  /* ════════ RENDER ════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .ta-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .ta-tr:hover td{background:#faf9ff!important;}
        .ta-sel{appearance:auto;cursor:pointer;}
        .ta-pg:hover:not(:disabled){background:#ede9fe!important;color:#4f46e5!important;border-color:#c4b5fd!important;}
        @keyframes ta_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="ta-root" style={{
        display:'flex', flexDirection:'column',
        height:'calc(100vh - 62px)',
        padding:20, gap:14, overflow:'hidden', background:'#f5f3ff',
      }}>

        {/* ── HEADER ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ fontSize:17, fontWeight:800, color:'#1e293b' }}>📊 Skill Assessment Reports</div>
          {data.length > 0 && (
            <button onClick={downloadExcel} disabled={downloading}
              style={{ padding:'9px 20px', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700,
                cursor: downloading ? 'not-allowed' : 'pointer', opacity: downloading ? .7 : 1,
                color:'#fff', background:'linear-gradient(135deg,#16a34a,#15803d)',
                boxShadow:'0 4px 14px rgba(22,163,74,.3)',
                display:'flex', alignItems:'center', gap:7 }}>
              {downloading ? (
                <>
                  <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,.4)',
                    borderTop:'2px solid #fff', borderRadius:'50%', animation:'ta_spin .7s linear infinite' }}/>
                  Preparing...
                </>
              ) : '⬇️ Download Excel'}
            </button>
          )}
        </div>

        {/* ── FILTERS CARD ── */}
        <div style={{ background:'#fff', borderRadius:12, border:'1.5px solid #ede9fe',
          boxShadow:'0 1px 8px rgba(79,70,229,.05)', padding:'16px 20px',
          display:'flex', alignItems:'flex-end', gap:16, flexShrink:0, flexWrap:'wrap' }}>

          {/* Skill Segment */}
          <div>
            <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'#64748b',
              textTransform:'uppercase', letterSpacing:'.4px', marginBottom:5 }}>
              Skill Segment
            </label>
            <select className="ta-sel"
              value={segmentId} onChange={e => handleSegmentChange(e.target.value)}
              disabled={loadingSkills}
              style={{ padding:'9px 28px 9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8,
                fontSize:12.5, fontFamily:'inherit', color:'#1e293b', outline:'none',
                background:'#fff', minWidth:220 }}>
              <option value="">-- Select Skill Segment --</option>
              {skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {loadingSkills && (
              <span style={{ fontSize:10.5, color:'#94a3b8', marginLeft:6 }}>Loading...</span>
            )}
          </div>

          {/* Subskill */}
          <div>
            <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'#64748b',
              textTransform:'uppercase', letterSpacing:'.4px', marginBottom:5 }}>
              Subskill
            </label>
            <select className="ta-sel"
              value={skillId} onChange={e => handleSubskillChange(e.target.value)}
              disabled={!segmentId || loadingSubs}
              style={{ padding:'9px 28px 9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8,
                fontSize:12.5, fontFamily:'inherit', color:'#1e293b', outline:'none',
                background: (!segmentId || loadingSubs) ? '#f8fafc' : '#fff', minWidth:220,
                opacity: (!segmentId) ? .5 : 1 }}>
              <option value="">-- Select Subskill --</option>
              {subskills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {loadingSubs && (
              <span style={{ fontSize:10.5, color:'#94a3b8', marginLeft:6 }}>Loading...</span>
            )}
          </div>

          {/* Record count badge */}
          {data.length > 0 && (
            <div style={{ marginLeft:'auto', padding:'8px 16px', background:'#ede9fe',
              borderRadius:8, fontSize:12.5, fontWeight:700, color:'#4f46e5' }}>
              Total Records: {data.length}
            </div>
          )}
        </div>

        {/* ── TABLE CARD — fills remaining space ── */}
        <div style={{ flex:1, minHeight:0, background:'#fff', borderRadius:12,
          border:'1.5px solid #ede9fe', boxShadow:'0 1px 8px rgba(79,70,229,.05)',
          display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* scrollable table */}
          <div style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead style={{ position:'sticky', top:0, zIndex:2 }}>
                <tr style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {['Full Name','Email','Phone','Percentile','Date','Segment','Skill'].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingData ? (
                  <tr><td colSpan={7} style={{ textAlign:'center', padding:48 }}>
                    <div style={{ display:'inline-block', width:28, height:28, border:'3px solid #ede9fe',
                      borderTop:'3px solid #4f46e5', borderRadius:'50%', animation:'ta_spin .7s linear infinite' }}/>
                    <div style={{ marginTop:10, color:'#94a3b8', fontSize:13 }}>Loading...</div>
                  </td></tr>
                ) : paged.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign:'center', color:'#94a3b8', padding:48, fontSize:13 }}>
                    {skillId ? 'No records found' : 'Select a skill segment and subskill to load students'}
                  </td></tr>
                ) : paged.map((r, i) => (
                  <tr key={i} className="ta-tr">
                    <td style={{ ...tdS, fontWeight:600, color:'#1e293b' }}>{fullName(r)}</td>
                    <td style={{ ...tdS, color:'#4f46e5', fontSize:11.5 }}>{r.email}</td>
                    <td style={tdS}>{r.phone || '—'}</td>
                    <td style={tdS}>
                      <span style={{ padding:'2px 9px', borderRadius:99, fontSize:11, fontWeight:700,
                        background: parseFloat(r.percentile) >= 75 ? '#dcfce7' : parseFloat(r.percentile) >= 50 ? '#fef9c3' : '#fee2e2',
                        color:      parseFloat(r.percentile) >= 75 ? '#16a34a' : parseFloat(r.percentile) >= 50 ? '#b45309' : '#dc2626' }}>
                        {r.percentile}%
                      </span>
                    </td>
                    <td style={{ ...tdS, fontSize:11.5 }}>{r.date || '—'}</td>
                    <td style={{ ...tdS, fontSize:11.5 }}>{r.segment_name || '—'}</td>
                    <td style={{ ...tdS, fontSize:11.5 }}>{r.skill_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* pagination — pinned to bottom ── */}
          {totalPages > 1 && (
            <div style={{ flexShrink:0, display:'flex', justifyContent:'center', alignItems:'center',
              gap:4, padding:'8px 14px', borderTop:'1px solid #f5f3ff', background:'#fafafa', flexWrap:'wrap' }}>

              <button className="ta-pg" onClick={() => setPage(1)} disabled={page === 1}
                style={{ padding:'4px 10px', border:'1.5px solid #e2e8f0', borderRadius:6, background:'#fff',
                  fontSize:12, cursor: page===1?'not-allowed':'pointer', color: page===1?'#cbd5e1':'#334155' }}>
                First
              </button>
              <button className="ta-pg" onClick={() => setPage(p => p-1)} disabled={page === 1}
                style={{ padding:'4px 10px', border:'1.5px solid #e2e8f0', borderRadius:6, background:'#fff',
                  fontSize:12, cursor: page===1?'not-allowed':'pointer', color: page===1?'#cbd5e1':'#334155' }}>
                Prev
              </button>

              {pageButtons().map(pg => (
                <button key={pg} className="ta-pg" onClick={() => setPage(pg)}
                  style={{ padding:'4px 10px', border:'1.5px solid #e2e8f0', borderRadius:6,
                    background: pg === page ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#fff',
                    color: pg === page ? '#fff' : '#334155', fontSize:12, cursor:'pointer',
                    fontWeight: pg === page ? 700 : 400 }}>
                  {pg}
                </button>
              ))}

              <button className="ta-pg" onClick={() => setPage(p => p+1)} disabled={page === totalPages}
                style={{ padding:'4px 10px', border:'1.5px solid #e2e8f0', borderRadius:6, background:'#fff',
                  fontSize:12, cursor: page===totalPages?'not-allowed':'pointer', color: page===totalPages?'#cbd5e1':'#334155' }}>
                Next
              </button>
              <button className="ta-pg" onClick={() => setPage(totalPages)} disabled={page === totalPages}
                style={{ padding:'4px 10px', border:'1.5px solid #e2e8f0', borderRadius:6, background:'#fff',
                  fontSize:12, cursor: page===totalPages?'not-allowed':'pointer', color: page===totalPages?'#cbd5e1':'#334155' }}>
                Last
              </button>

              <span style={{ fontSize:11.5, color:'#64748b', marginLeft:6 }}>
                Page {page} of {totalPages}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}