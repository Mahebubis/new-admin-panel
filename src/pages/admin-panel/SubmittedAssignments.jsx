import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/adminPanel/submitted_assignments.php';
const post = d => api.post(API, new URLSearchParams(d));
const get  = p => api.get(API, { params: p });

/* ─── tiny shared bits ─── */
const Label = ({ c }) => (
  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b',
    marginBottom:5, textTransform:'uppercase', letterSpacing:'.05em' }}>{c}</label>
);
const Inp = ({ ...p }) => (
  <input {...p} style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0',
    borderRadius:9, fontSize:13, fontFamily:'inherit', color:'#1e293b', outline:'none',
    background:'#fff', ...p.style }}
    onFocus={e=>e.target.style.borderColor='#4f46e5'}
    onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
);
const Sel = ({ children, ...p }) => (
  <select {...p} style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0',
    borderRadius:9, fontSize:13, fontFamily:'inherit', color:'#1e293b', outline:'none',
    background:'#fff', opacity:p.disabled?.5:1, ...p.style }}
    onFocus={e=>e.target.style.borderColor='#4f46e5'}
    onBlur={e=>e.target.style.borderColor='#e2e8f0'}>
    {children}
  </select>
);
const Btn = ({ children, onClick, disabled, variant='primary', style={} }) => {
  const bgs = { primary:'linear-gradient(135deg,#4f46e5,#7c3aed)',
    danger:'linear-gradient(135deg,#dc2626,#b91c1c)',
    gray:'#f1f5f9', amber:'linear-gradient(135deg,#f59e0b,#d97706)',
    success:'linear-gradient(135deg,#16a34a,#15803d)' };
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding:'8px 16px', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700,
        cursor:disabled?'not-allowed':'pointer', fontFamily:'inherit',
        background:bgs[variant]||bgs.primary, color:variant==='gray'?'#475569':'#fff',
        opacity:disabled?.6:1, display:'flex', alignItems:'center', gap:6, ...style }}>
      {children}
    </button>
  );
};

/* ─── File Preview Modal ─── */
function FilePreviewModal({ url, onClose }) {
  const viewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'#fff', borderRadius:16, width:'95%', maxWidth:1000,
        height:'90vh', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 70px rgba(0,0,0,.3)' }}>
        {/* header */}
        <div style={{ padding:'13px 20px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
          borderRadius:'16px 16px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:14, fontWeight:700, color:'#fff' }}>📄 File Preview</span>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none',
            cursor:'pointer', color:'#fff', fontSize:18, borderRadius:6, padding:'2px 9px' }}>×</button>
        </div>
        {/* iframe */}
        <div style={{ flex:1, overflow:'hidden' }}>
          <iframe src={viewerUrl} title="File Preview"
            style={{ width:'100%', height:'100%', border:'none' }}/>
        </div>
        {/* footer: download */}
        <div style={{ padding:'12px 20px', borderTop:'1.5px solid #f5f3ff',
          display:'flex', justifyContent:'flex-end', gap:10 }}>
          <Btn variant="gray" onClick={onClose}>Close</Btn>
          <a href={url} download target="_blank" rel="noreferrer"
            style={{ padding:'8px 16px', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700,
              cursor:'pointer', fontFamily:'inherit', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
              color:'#fff', textDecoration:'none', display:'flex', alignItems:'center', gap:6 }}>
            ⬇️ Download File
          </a>
        </div>
      </div>
    </div>
  );
}

/* ─── Edit Modal ─── */
function EditModal({ row, onClose, onSave, loading }) {
  const [subtask, setSubtask] = useState(row.subtask_id || '');
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:440,
        boxShadow:'0 24px 70px rgba(0,0,0,.22)' }}>
        <div style={{ padding:'14px 20px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
          borderRadius:'16px 16px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#fff' }}>✏️ Edit Submission</span>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none',
            cursor:'pointer', color:'#fff', fontSize:18, borderRadius:6, padding:'2px 9px' }}>×</button>
        </div>
        <div style={{ padding:22 }}>
          <div style={{ fontSize:12.5, color:'#64748b', marginBottom:14 }}>
            Submission ID: <strong style={{ color:'#1e293b' }}>#{row.submission_id}</strong>
          </div>
          <div style={{ marginBottom:18 }}>
            <Label c="Subtask ID"/>
            <Inp value={subtask} onChange={e=>setSubtask(e.target.value)} placeholder="Enter subtask ID"/>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <Btn variant="gray" onClick={onClose}>Cancel</Btn>
            <Btn onClick={()=>onSave(row.submission_id, subtask)} disabled={loading}>💾 Save</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Delete Confirm Modal ─── */
function DeleteModal({ row, onClose, onConfirm, loading }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'#fff', borderRadius:16, padding:28, width:'100%', maxWidth:420,
        textAlign:'center', boxShadow:'0 24px 70px rgba(0,0,0,.2)' }}>
        <div style={{ fontSize:44, marginBottom:14 }}>⚠️</div>
        <div style={{ fontSize:16, fontWeight:800, color:'#1e293b', marginBottom:8 }}>Delete Submission?</div>
        <div style={{ fontSize:13, color:'#475569', marginBottom:22 }}>
          Are you sure you want to delete submission <strong>#{row.submission_id}</strong>?<br/>
          <span style={{ color:'#ef4444', fontSize:12 }}>This action cannot be undone.</span>
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          <Btn variant="gray" onClick={onClose}>Cancel</Btn>
          <Btn variant="danger" onClick={()=>onConfirm(row.submission_id)} disabled={loading}>🗑️ Delete</Btn>
        </div>
      </div>
    </div>
  );
}

/* ─── Pagination ─── */
function Pagination({ page, total, limit, onChange }) {
  const pages = Math.ceil(total / limit) || 1;
  if (pages <= 1) return null;

  const visiblePages = () => {
    const arr = [];
    const start = Math.max(1, page - 2);
    const end   = Math.min(pages, page + 2);
    if (start > 1) arr.push(1, '...');
    for (let i = start; i <= end; i++) arr.push(i);
    if (end < pages) arr.push('...', pages);
    return arr;
  };

  const btnS = active => ({
    padding:'6px 11px', border:'1.5px solid', borderRadius:7, fontSize:12.5, fontWeight:700,
    cursor:'pointer', fontFamily:'inherit', transition:'all .15s',
    background: active ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#fff',
    color: active ? '#fff' : '#475569',
    borderColor: active ? '#4f46e5' : '#e2e8f0',
  });

  return (
    <div style={{ display:'flex', justifyContent:'flex-end', gap:6, marginTop:14, flexWrap:'wrap' }}>
      <button style={btnS(false)} disabled={page===1} onClick={()=>onChange(page-1)}>‹ Prev</button>
      {visiblePages().map((p,i)=>
        p==='...' ? <span key={i} style={{ padding:'6px 4px', color:'#94a3b8', fontSize:13 }}>…</span>
        : <button key={i} style={btnS(p===page)} onClick={()=>onChange(p)}>{p}</button>
      )}
      <button style={btnS(false)} disabled={page===pages} onClick={()=>onChange(page+1)}>Next ›</button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function SubmittedAssignments() {
  /* ── data state ── */
  const [rows,    setRows]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  /* ── filters ── */
  const [keyword,   setKeyword]   = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');
  const [page,      setPage]      = useState(1);
  const limit = 10;

  /* ── cascading dropdowns ── */
  const [domains,  setDomains]  = useState([]);
  const [paths,    setPaths]    = useState([]);
  const [courses,  setCourses]  = useState([]);
  const [domainId, setDomainId] = useState('');
  const [pathId,   setPathId]   = useState('');
  const [courseId, setCourseId] = useState('');

  /* ── modals ── */
  const [previewUrl, setPreviewUrl] = useState(null);
  const [editRow,    setEditRow]    = useState(null);
  const [deleteRow,  setDeleteRow]  = useState(null);

  /* ── load domains once ── */
  useEffect(() => {
    get({ action:'get_domains' }).then(r => {
      setDomains(r.data.data?.domains || []);
    }).catch(() => {});
  }, []);

  /* ── fetch submissions ── */
  const fetchData = useCallback(async (pg = page) => {
    setLoading(true);
    try {
      const res = await post({
        action:'fetch_submissions',
        limit, offset:(pg-1)*limit,
        keyword, start_date:startDate, end_date:endDate,
        domain_id:domainId, path_id:pathId, course_id:courseId,
      });
      setRows(res.data.data?.data || []);
      setTotal(res.data.data?.total || 0);
    } catch(e) { toast.error(e.response?.data?.message||'Failed'); }
    finally { setLoading(false); }
  }, [page, keyword, startDate, endDate, domainId, pathId, courseId]);

  useEffect(() => { fetchData(page); }, [page]);

  /* ── filter triggers (reset to page 1) ── */
  const triggerFetch = useCallback(() => {
    setPage(1); fetchData(1);
  }, [fetchData]);

  const handlePageChange = p => { setPage(p); fetchData(p); };

  /* ── domain change ── */
  const onDomainChange = val => {
    setDomainId(val); setPathId(''); setCourseId('');
    setPaths([]); setCourses([]);
    if (val) {
      const dom = domains.find(d=>String(d.domain_id)===val);
      setPaths(dom?.paths || []);
    }
    setPage(1);
  };

  /* ── path change ── */
  const onPathChange = val => {
    setPathId(val); setCourseId(''); setCourses([]);
    if (val) {
      const dom = domains.find(d=>String(d.domain_id)===domainId);
      const pth = dom?.paths.find(p=>String(p.path_id)===val);
      setCourses(pth?.courses || []);
    }
    setPage(1);
  };

  /* ── start date change ── */
  const onStartDate = val => {
    setStartDate(val);
    if (!val) setEndDate('');
    setPage(1);
  };

  /* ── clear all ── */
  const clearAll = () => {
    setKeyword(''); setStartDate(''); setEndDate('');
    setDomainId(''); setPathId(''); setCourseId('');
    setPaths([]); setCourses([]);
    setPage(1);
    setTimeout(() => fetchData(1), 0);
  };

  /* ── edit ── */
  const handleEdit = async (id, subtask) => {
    setSaving(true);
    try {
      await post({ action:'edit_submission', submission_id:id, subtask_id:subtask });
      toast.success('Updated');
      setEditRow(null);
      fetchData(page);
    } catch(e) { toast.error(e.response?.data?.message||'Failed'); }
    finally { setSaving(false); }
  };

  /* ── delete ── */
  const handleDelete = async id => {
    setSaving(true);
    try {
      await post({ action:'delete_submission', submission_id:id });
      toast.success('Deleted');
      setDeleteRow(null);
      fetchData(page);
    } catch(e) { toast.error(e.response?.data?.message||'Failed'); }
    finally { setSaving(false); }
  };

  const thS = {
    padding:'11px 14px', fontSize:11, fontWeight:700, color:'#fff', textAlign:'left',
    textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap',
    background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
    borderRight:'1px solid rgba(255,255,255,.15)', position:'sticky', top:0, zIndex:2,
  };
  const tdS = {
    padding:'11px 14px', fontSize:12.5, color:'#1e293b',
    borderBottom:'1px solid #f5f3ff', verticalAlign:'middle',
  };

  const inpS = {
    width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0',
    borderRadius:9, fontSize:13, fontFamily:'inherit', color:'#1e293b', outline:'none', background:'#fff',
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .sa-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .sa-tr:hover td { background:#faf9ff!important; }
        @keyframes sa_spin { to { transform:rotate(360deg); } }
        .sa-spin { display:inline-block;width:18px;height:18px;border:2.5px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:sa_spin .7s linear infinite; }
        .sa-inp:focus { border-color:#4f46e5!important; outline:none; }
      `}</style>

      <div className="sa-root" style={{ display:'flex', flexDirection:'column',
        minHeight:'calc(100vh - 62px)', background:'#f5f3ff', padding:20, gap:14, overflowY:'auto' }}>

        {/* ══ HEADER ══ */}
        <div style={{ background:'#fff', borderRadius:14, padding:'16px 22px',
          border:'1.5px solid #ede9fe', boxShadow:'0 1px 6px rgba(79,70,229,.07)',
          display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:'#1e293b' }}>
              📋 Assignment Submission Dashboard
            </div>
            <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
              Total: <strong style={{ color:'#4f46e5' }}>{total}</strong> submission{total!==1?'s':''}
            </div>
          </div>
          <button onClick={clearAll}
            style={{ padding:'8px 16px', border:'1.5px solid #e2e8f0', borderRadius:9,
              background:'#fff', color:'#64748b', fontSize:12.5, fontWeight:700,
              cursor:'pointer', fontFamily:'inherit' }}>
            🗙 Clear Filters
          </button>
        </div>

        {/* ══ FILTERS ══ */}
        <div style={{ background:'#fff', borderRadius:14, padding:'16px 22px',
          border:'1.5px solid #ede9fe', boxShadow:'0 1px 6px rgba(79,70,229,.07)' }}>
          {/* Row 1: cascading dropdowns */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:12 }}>
            <div>
              <Label c="Domain"/>
              <select className="sa-inp" value={domainId}
                onChange={e=>{ onDomainChange(e.target.value); }}
                onBlur={triggerFetch} style={inpS}>
                <option value="">All Domains</option>
                {domains.map(d=>(
                  <option key={d.domain_id} value={d.domain_id}>{d.domain_name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label c="Path"/>
              <select className="sa-inp" value={pathId} disabled={!paths.length}
                onChange={e=>{ onPathChange(e.target.value); }}
                onBlur={triggerFetch}
                style={{ ...inpS, opacity:!paths.length?.5:1 }}>
                <option value="">All Paths</option>
                {paths.map(p=>(
                  <option key={p.path_id} value={p.path_id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div>
              <Label c="Course"/>
              <select className="sa-inp" value={courseId} disabled={!courses.length}
                onChange={e=>{ setCourseId(e.target.value); setPage(1); }}
                onBlur={triggerFetch}
                style={{ ...inpS, opacity:!courses.length?.5:1 }}>
                <option value="">All Courses</option>
                {courses.map(c=>(
                  <option key={c.course_id} value={c.course_id}>{c.course_title}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: search + dates */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
            <div>
              <Label c="Search by Email"/>
              <input className="sa-inp" type="text" value={keyword} placeholder="Email address..."
                onChange={e=>setKeyword(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&triggerFetch()}
                onBlur={triggerFetch} style={inpS}/>
            </div>
            <div>
              <Label c="From Date"/>
              <input className="sa-inp" type="date" value={startDate}
                onChange={e=>onStartDate(e.target.value)}
                onBlur={triggerFetch} style={inpS}/>
            </div>
            <div>
              <Label c="To Date"/>
              <input className="sa-inp" type="date" value={endDate}
                disabled={!startDate} min={startDate}
                onChange={e=>setEndDate(e.target.value)}
                onBlur={triggerFetch}
                style={{ ...inpS, opacity:!startDate?.5:1 }}/>
            </div>
          </div>
        </div>

        {/* ══ TABLE ══ */}
        <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #ede9fe',
          overflow:'hidden', boxShadow:'0 1px 6px rgba(79,70,229,.07)', flex:1 }}>
          <div style={{ overflowX:'auto', overflowY:'auto', maxHeight:'calc(100vh - 370px)' }}>
            <table style={{ borderCollapse:'collapse', width:'100%', minWidth:900 }}>
              <thead>
                <tr>
                  {['ID','User','Email','Domain / Path / Course',
                    'Subtask ID','File','Submitted At','Actions'].map(h=>(
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign:'center', padding:50, color:'#94a3b8' }}>
                    <div className="sa-spin" style={{ width:26, height:26, margin:'0 auto 10px', display:'block' }}/>
                    <div style={{ fontSize:13 }}>Loading submissions...</div>
                  </td></tr>
                ) : !rows.length ? (
                  <tr><td colSpan={8} style={{ textAlign:'center', padding:50, color:'#94a3b8' }}>
                    <div style={{ fontSize:38, marginBottom:10 }}>📭</div>
                    <div style={{ fontSize:13, fontWeight:600 }}>No submissions found</div>
                  </td></tr>
                ) : rows.map(r => (
                  <tr key={r.submission_id} className="sa-tr">
                    <td style={{ ...tdS, color:'#94a3b8', fontSize:12 }}>#{r.submission_id}</td>
                    <td style={tdS}>
                      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                        {r.profile_image ? (
                          <img src={r.profile_image} alt={r.fname}
                            style={{ width:30, height:30, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}
                            onError={e=>{ e.target.style.display='none'; }}/>
                        ) : (
                          <div style={{ width:30, height:30, borderRadius:'50%', flexShrink:0,
                            background:'linear-gradient(135deg,#ede9fe,#c4b5fd)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:12, fontWeight:700, color:'#4f46e5' }}>
                            {(r.fname||'?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span style={{ fontWeight:600 }}>{r.fname} {r.lname}</span>
                      </div>
                    </td>
                    <td style={{ ...tdS, color:'#64748b', fontSize:12 }}>{r.email}</td>
                    <td style={{ ...tdS, maxWidth:220 }}>
                      <div style={{ fontSize:12 }}>
                        {r.domain_name && <div style={{ fontWeight:600, color:'#4f46e5', marginBottom:2 }}>{r.domain_name}</div>}
                        {r.path_title   && <div style={{ color:'#64748b' }}>📁 {r.path_title}</div>}
                        {r.course_title && <div style={{ color:'#94a3b8', fontSize:11 }}>📖 {r.course_title}</div>}
                        {!r.domain_name && <span style={{ color:'#cbd5e1', fontStyle:'italic' }}>—</span>}
                      </div>
                    </td>
                    <td style={tdS}>
                      <span style={{ background:'#f5f3ff', color:'#4f46e5', padding:'3px 8px',
                        borderRadius:6, fontSize:12, fontWeight:600 }}>
                        {r.subtask_id || '—'}
                      </span>
                    </td>
                    <td style={tdS}>
                      {r.file_url ? (
                        <button onClick={()=>setPreviewUrl(r.file_url)}
                          style={{ padding:'5px 13px', border:'1.5px solid #c4b5fd', borderRadius:7,
                            background:'#f5f3ff', color:'#4f46e5', fontSize:12, fontWeight:700,
                            cursor:'pointer', fontFamily:'inherit' }}>
                          👁 View
                        </button>
                      ) : <span style={{ color:'#cbd5e1', fontSize:12 }}>No file</span>}
                    </td>
                    <td style={{ ...tdS, fontSize:12, color:'#64748b', whiteSpace:'nowrap' }}>
                      {r.submitted_at ? new Date(r.submitted_at).toLocaleString('en-IN',
                        { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}
                    </td>
                    <td style={tdS}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>setEditRow(r)}
                          style={{ padding:'5px 11px', border:'none', borderRadius:7, fontSize:12,
                            fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                            background:'linear-gradient(135deg,#fef3c7,#fde68a)', color:'#92400e' }}>
                          ✏️
                        </button>
                        <button onClick={()=>setDeleteRow(r)}
                          style={{ padding:'5px 11px', border:'none', borderRadius:7, fontSize:12,
                            fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                            background:'linear-gradient(135deg,#fee2e2,#fecaca)', color:'#991b1b' }}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* pagination footer */}
          {!loading && total > limit && (
            <div style={{ padding:'10px 16px', borderTop:'1.5px solid #f5f3ff' }}>
              <Pagination page={page} total={total} limit={limit} onChange={handlePageChange}/>
            </div>
          )}
        </div>
      </div>

      {/* ══ MODALS ══ */}
      {previewUrl && <FilePreviewModal url={previewUrl} onClose={()=>setPreviewUrl(null)}/>}
      {editRow    && <EditModal    row={editRow}   onClose={()=>setEditRow(null)}   onSave={handleEdit}   loading={saving}/>}
      {deleteRow  && <DeleteModal  row={deleteRow} onClose={()=>setDeleteRow(null)} onConfirm={handleDelete} loading={saving}/>}
    </>
  );
}