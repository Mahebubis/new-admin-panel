import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API   = '/api/internships/free_internships.php';
const FH    = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk    = obj => new URLSearchParams(obj);
const LIMIT = 10;

const thS = {
  color:'#fff', fontSize:11, fontWeight:600, padding:'11px 12px',
  textAlign:'left', textTransform:'uppercase', letterSpacing:'.3px',
  borderRight:'1px solid rgba(255,255,255,.15)', whiteSpace:'nowrap',
};
const tdS = { padding:'9px 12px', borderBottom:'1px solid #f5f3ff', color:'#334155', fontSize:12, verticalAlign:'middle' };

export default function FreeInternships() {
  const [rows,        setRows]        = useState([]);
  const [count,       setCount]       = useState(0);
  const [stats,       setStats]       = useState({ total:0, pending:0, accepted:0, rejected:0 });
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filter,      setFilter]      = useState('none'); // none|pending|rejected|accepted
  const [loading,     setLoading]     = useState(true);
  const [acting,      setActing]      = useState({}); // { [id]: 'accept'|'reject' }

  /* ── fetch stats on mount — same as PHP's page-load view_free_internship_status() ── */
  useEffect(() => {
    api.get(API).then(res => {
      if (res.data.status === 'success') setStats(res.data);
    }).catch(() => {});
  }, []);

  /* ── fetch data — same as PHP's fetchData() ── */
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const offset = (page - 1) * LIMIT;
    const params = { action:'fetch_free_internship_applicants', limit: LIMIT, offset };
    if (search)            params.keyword = search;
    if (filter !== 'none') params.status  = filter;

    api.post(API, mk(params), { ...FH, signal: controller.signal })
      .then(res => {
        if (res.data.status === 'success') {
          setRows(res.data.data || []);
          setCount(res.data.count || 0);
        }
      })
      .catch(err => { if (err?.name !== 'CanceledError' && err?.name !== 'AbortError') toast.error('Failed to load'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [page, search, filter]);

  /* ── accept — same as PHP's acceptFreeInternshipApplication() ── */
  const acceptApp = async (id, user_id) => {
    setActing(p => ({ ...p, [id]: 'accept' }));
    try {
      const res = await api.post(API, mk({ action:'accept_free_internship_application', id, user_id }), FH);
      if (res.data.status === 'success') {
        toast.success(res.data.message);
        setRows(p => p.map(r => r.id == id ? { ...r, status:'accepted' } : r));
        setStats(p => ({ ...p, accepted: p.accepted+1, pending: Math.max(0,p.pending-1) }));
      } else { toast.error(res.data.message || 'Failed'); }
    } catch { toast.error('Error'); }
    finally { setActing(p => ({ ...p, [id]: null })); }
  };

  /* ── reject — same as PHP's rejectFreeInternshipApplication() ── */
  const rejectApp = async (id, user_id) => {
    if (!window.confirm('You want to reject this application!')) return;
    setActing(p => ({ ...p, [id]: 'reject' }));
    try {
      const res = await api.post(API, mk({ action:'reject_free_internship_application', id, user_id }), FH);
      if (res.data.status === 'success') {
        toast.success(res.data.message);
        setRows(p => p.map(r => r.id == id ? { ...r, status:'rejected' } : r));
        setStats(p => ({ ...p, rejected: p.rejected+1, pending: Math.max(0,p.pending-1) }));
      } else { toast.error(res.data.message || 'Failed'); }
    } catch { toast.error('Error'); }
    finally { setActing(p => ({ ...p, [id]: null })); }
  };

  const doSearch    = () => { setSearch(searchInput); setPage(1); };
  const clearSearch = () => { setSearchInput(''); setSearch(''); setPage(1); };

  const totalPages  = Math.ceil(count / LIMIT) || 1;
  const pageButtons = () => {
    const maxV = 5;
    let start  = Math.max(1, page - Math.floor(maxV/2));
    let end    = Math.min(totalPages, start + maxV - 1);
    if (end - start + 1 < maxV) start = Math.max(1, end - maxV + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  /* ── rank badge — same as PHP: rank <= 50 → Qualified, else Not Qualified ── */
  const RankBadge = ({ rank }) => rank == null ? <span style={{ color:'#94a3b8' }}>—</span> : (
    <span style={{ padding:'2px 9px', borderRadius:99, fontSize:10.5, fontWeight:700,
      background: rank <= 50 ? '#dcfce7' : '#fee2e2',
      color:      rank <= 50 ? '#16a34a' : '#dc2626' }}>
      {rank} {rank <= 50 ? '✓ Qualified' : '✗ Not Qualified'}
    </span>
  );

  /* ── status badge — same as PHP ── */
  const StatusBadge = ({ status }) => {
    const cfg = {
      pending:  { bg:'#dbeafe', color:'#1d4ed8', label:'Pending' },
      accepted: { bg:'#dcfce7', color:'#16a34a', label:'Accepted' },
      rejected: { bg:'#fee2e2', color:'#dc2626', label:'Rejected' },
    };
    const c = cfg[status] || cfg.pending;
    return <span style={{ padding:'2px 9px', borderRadius:99, fontSize:10.5, fontWeight:700,
      background:c.bg, color:c.color }}>{c.label}</span>;
  };

  /* ════════ RENDER ════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .fi-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .fi-tr:hover td{background:#faf9ff!important;}
        .fi-pg:hover:not(:disabled){background:#ede9fe!important;color:#4f46e5!important;}
        @keyframes fi_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="fi-root" style={{
        display:'flex', flexDirection:'column',
        height:'calc(100vh - 62px)',
        padding:20, gap:14, overflow:'hidden', background:'#f5f3ff',
      }}>

        {/* ── HEADER ── */}
        <div style={{ fontSize:17, fontWeight:800, color:'#1e293b', flexShrink:0 }}>
          🎓 Free Internship Applications
        </div>

        {/* ── STATS CARDS — same 4 as PHP ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, flexShrink:0 }}>
          {[
            { label:'Total',    val: stats.total,    bg:'#ede9fe', color:'#4f46e5' },
            { label:'Pending',  val: stats.pending,  bg:'#dbeafe', color:'#1d4ed8' },
            { label:'Accepted', val: stats.accepted, bg:'#dcfce7', color:'#16a34a' },
            { label:'Rejected', val: stats.rejected, bg:'#fee2e2', color:'#dc2626' },
          ].map(s => (
            <div key={s.label} style={{ background:'#fff', borderRadius:10, border:'1.5px solid #ede9fe',
              padding:'12px 16px', display:'flex', flexDirection:'column', gap:4 }}>
              <span style={{ fontSize:10.5, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.4px' }}>
                {s.label}
              </span>
              <span style={{ fontSize:22, fontWeight:800, color: s.color }}>{s.val}</span>
            </div>
          ))}
        </div>

        {/* ── TOOLBAR ── */}
        <div style={{ display:'flex', gap:10, alignItems:'center', flexShrink:0, flexWrap:'wrap' }}>
          <div style={{ display:'flex', border:'1.5px solid #e2e8f0', borderRadius:8,
            overflow:'hidden', background:'#fff', flex:'0 0 260px' }}>
            <input value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search by email..."
              style={{ border:'none', padding:'8px 12px', fontSize:12.5, flex:1,
                outline:'none', fontFamily:'inherit', color:'#1e293b' }}/>
            <button onClick={doSearch}
              style={{ background:'#4f46e5', color:'#fff', border:'none', padding:'0 12px', cursor:'pointer', fontSize:12 }}>🔍</button>
            <button onClick={clearSearch}
              style={{ background:'#f1f5f9', color:'#64748b', border:'none', padding:'0 10px', cursor:'pointer', fontSize:14 }}>×</button>
          </div>

          {/* Filter by status — same as PHP's filterByStatus select */}
          <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}
            style={{ padding:'8px 12px', border:'1.5px solid #e2e8f0', borderRadius:8,
              fontSize:12.5, fontFamily:'inherit', color:'#1e293b', background:'#fff',
              outline:'none', cursor:'pointer' }}>
            <option value="none">All Status</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* ── TABLE CARD ── */}
        <div style={{ flex:1, minHeight:0, background:'#fff', borderRadius:12,
          border:'1.5px solid #ede9fe', boxShadow:'0 1px 8px rgba(79,70,229,.05)',
          display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead style={{ position:'sticky', top:0, zIndex:2 }}>
                <tr style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {['Name','Email','Internship','Batch','Rank','Applied At','Status','Action'].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign:'center', padding:48 }}>
                    <div style={{ display:'inline-block', width:28, height:28, border:'3px solid #ede9fe',
                      borderTop:'3px solid #4f46e5', borderRadius:'50%', animation:'fi_spin .7s linear infinite' }}/>
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign:'center', color:'#94a3b8', padding:40, fontSize:13 }}>
                    No applications found
                  </td></tr>
                ) : rows.map(row => (
                  <tr key={row.id} className="fi-tr">
                    <td style={{ ...tdS, fontWeight:600, color:'#1e293b' }}>{row.name}</td>
                    <td style={{ ...tdS, color:'#4f46e5', fontSize:11.5 }}>{row.email}</td>
                    <td style={{ ...tdS, fontSize:11.5 }}>{row.internship_name || '—'}</td>
                    <td style={{ ...tdS, fontSize:11.5 }}>{row.batch || '—'}</td>
                    <td style={tdS}><RankBadge rank={row.rank}/></td>
                    <td style={{ ...tdS, fontSize:11, whiteSpace:'nowrap' }}>{row.applied_at}</td>
                    <td style={tdS}><StatusBadge status={row.status}/></td>
                    <td style={{ ...tdS, whiteSpace:'nowrap' }}>
                      {/* same conditional button logic as PHP's renderData() */}
                      {row.status === 'pending' && (
                        <>
                          <button onClick={() => acceptApp(row.id, row.user_id)}
                            disabled={!!acting[row.id]}
                            style={{ padding:'5px 10px', background:'#dcfce7', color:'#16a34a',
                              border:'1.5px solid #bbf7d0', borderRadius:6, fontSize:11,
                              fontWeight:600, cursor:'pointer', marginRight:4,
                              opacity: acting[row.id] ? .6 : 1 }}>
                            {acting[row.id]==='accept' ? '...' : '✓ Accept'}
                          </button>
                          <button onClick={() => rejectApp(row.id, row.user_id)}
                            disabled={!!acting[row.id]}
                            style={{ padding:'5px 10px', background:'#fee2e2', color:'#dc2626',
                              border:'1.5px solid #fecaca', borderRadius:6, fontSize:11,
                              fontWeight:600, cursor:'pointer',
                              opacity: acting[row.id] ? .6 : 1 }}>
                            {acting[row.id]==='reject' ? '...' : '✗ Reject'}
                          </button>
                        </>
                      )}
                      {/* rejected → can still accept, same as PHP */}
                      {row.status === 'rejected' && (
                        <button onClick={() => acceptApp(row.id, row.user_id)}
                          disabled={!!acting[row.id]}
                          style={{ padding:'5px 10px', background:'#dbeafe', color:'#1d4ed8',
                            border:'1.5px solid #bfdbfe', borderRadius:6, fontSize:11,
                            fontWeight:600, cursor:'pointer', opacity: acting[row.id] ? .6 : 1 }}>
                          {acting[row.id]==='accept' ? '...' : '↩ Accept'}
                        </button>
                      )}
                      {row.status === 'accepted' && (
                        <span style={{ color:'#94a3b8', fontSize:11 }}>—</span>
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
                <button key={l} className="fi-pg" onClick={fn} disabled={page===1}
                  style={{ padding:'4px 10px', border:'1.5px solid #e2e8f0', borderRadius:6,
                    background:'#fff', fontSize:12, cursor:page===1?'not-allowed':'pointer',
                    color:page===1?'#cbd5e1':'#334155' }}>{l}</button>
              ))}
              {pageButtons().map(pg => (
                <button key={pg} className="fi-pg" onClick={() => setPage(pg)}
                  style={{ padding:'4px 10px', border:'1.5px solid #e2e8f0', borderRadius:6,
                    background:pg===page?'linear-gradient(135deg,#4f46e5,#7c3aed)':'#fff',
                    color:pg===page?'#fff':'#334155', fontSize:12, cursor:'pointer',
                    fontWeight:pg===page?700:400 }}>{pg}</button>
              ))}
              {[['Next',()=>setPage(p=>p+1)],['Last',()=>setPage(totalPages)]].map(([l,fn]) => (
                <button key={l} className="fi-pg" onClick={fn} disabled={page===totalPages}
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