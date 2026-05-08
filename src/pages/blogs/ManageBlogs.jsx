// import { useState, useEffect, useCallback } from 'react';
// import { useNavigate } from 'react-router-dom';
// import api from '../../api/axios';
// import toast from 'react-hot-toast';

// export default function ManageBlogs() {
//   const [data, setData] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const navigate = useNavigate();

//   const fetchData = useCallback(async () => {
//     setLoading(true);
//     try {
//       const res = await api.get('/api/blogs/list.php');
//       if (res.data.success) setData(res.data.data.blogs || []);
//     } catch {} finally { setLoading(false); }
//   }, []);

//   useEffect(() => { fetchData(); }, [fetchData]);

//   const handleDelete = async (id) => {
//     if (!confirm('Delete this post?')) return;
//     try {
//       await api.delete('/api/blogs/delete.php', { data: { id } });
//       toast.success('Blog deleted successfully!');
//       fetchData();
//     } catch {}
//   };

//   return (
//     <div className="animate-fade-in">
//       <div className="flex items-center justify-between mb-3">
//         <h4 className="text-lg font-bold text-gray-800">Manage Blogs</h4>
//         <button onClick={() => navigate('/blogs/add')}
//           className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 cursor-pointer">
//           + Add Post
//         </button>
//       </div>

//       <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
//         <table className="w-full text-xs">
//           <thead>
//             <tr style={{ background: '#f38f2b' }} className="text-white">
//               {['Title','Category','Status','Published','Author','Action'].map(h => (
//                 <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
//               ))}
//             </tr>
//           </thead>
//           <tbody className="divide-y divide-gray-100">
//             {loading ? (
//               <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400"><i className="fas fa-spinner fa-spin mr-2"></i>Loading...</td></tr>
//             ) : data.length === 0 ? (
//               <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No blogs found</td></tr>
//             ) : data.map(row => (
//               <tr key={row.blog_id} className="hover:bg-gray-50/50">
//                 <td className="px-4 py-2.5 font-medium text-gray-800">{row.title}</td>
//                 <td className="px-4 py-2.5 text-gray-600">{row.category || '-'}</td>
//                 <td className="px-4 py-2.5">{row.status}</td>
//                 <td className="px-4 py-2.5 text-gray-500">{row.published_at || row.created_at || '-'}</td>
//                 <td className="px-4 py-2.5 text-gray-500">{row.author || 'Admin'}</td>
//                 <td className="px-4 py-2.5 whitespace-nowrap">
//                   <button onClick={() => navigate(`/blogs/edit/${row.blog_id}`)}
//                     className="px-2.5 py-1 text-[10px] rounded bg-amber-500 text-white hover:bg-amber-600 cursor-pointer mr-1">Edit</button>
//                   <button onClick={() => handleDelete(row.blog_id)}
//                     className="px-2.5 py-1 text-[10px] rounded bg-red-500 text-white hover:bg-red-600 cursor-pointer">Delete</button>
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// }


import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const BLOG_API = 'https://dashboard.internshipstudio.com/api/post_blogs.php';

const thS = {
  color:'#fff', fontSize:11, fontWeight:600, padding:'11px 14px',
  textAlign:'left', textTransform:'uppercase', letterSpacing:'.3px',
  borderRight:'1px solid rgba(255,255,255,.15)', whiteSpace:'nowrap',
};
const tdS = { padding:'10px 14px', borderBottom:'1px solid #f5f3ff', color:'#334155', fontSize:12.5, verticalAlign:'middle' };

export default function ManageBlogs() {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = () => {
    setLoading(true);
    fetch(`${BLOG_API}?action=get_data`)
      .then(r => r.json())
      .then(d => { if (d.status === 'success') setRows(d.data || []); })
      .catch(() => toast.error('Failed to load blogs'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      const res  = await fetch(`${BLOG_API}?id=${id}`, { method:'DELETE' });
      const json = await res.json();
      if (json.status === 'success') { toast.success('✅ Blog deleted successfully!'); fetchData(); }
      else toast.error(json.message || 'Delete failed');
    } catch { toast.error('Network error'); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .mb-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .mb-tr:hover td{background:#faf9ff!important;}
        @keyframes mb_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="mb-root" style={{
        display:'flex', flexDirection:'column',
        height:'calc(100vh - 62px)',
        padding:20, gap:14, overflow:'hidden',
        background:'#f5f3ff',
      }}>

        {/* ── header ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ fontSize:17, fontWeight:800, color:'#1e293b', display:'flex', alignItems:'center', gap:10 }}>
            📝 Blog Posts
          </div>
          <button
            onClick={() => navigate('/blogs/add')}
            style={{ padding:'9px 22px', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700,
              cursor:'pointer', color:'#fff', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
              boxShadow:'0 4px 14px rgba(79,70,229,.3)' }}>
            + Add Post
          </button>
        </div>

        {/* ── table card ── */}
        <div style={{ flex:1, minHeight:0, background:'#fff', borderRadius:12,
          border:'1.5px solid #ede9fe', boxShadow:'0 1px 8px rgba(79,70,229,.05)',
          display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead style={{ position:'sticky', top:0, zIndex:2 }}>
                <tr style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {['Title','Category','Status','Published','Author','Action'].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign:'center', padding:48 }}>
                    <div style={{ display:'inline-block', width:28, height:28, border:'3px solid #ede9fe',
                      borderTop:'3px solid #4f46e5', borderRadius:'50%', animation:'mb_spin .7s linear infinite' }}/>
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign:'center', color:'#94a3b8', padding:40, fontSize:13 }}>
                    No blog posts found
                  </td></tr>
                ) : rows.map(p => (
                  <tr key={p.id} className="mb-tr">
                    <td style={{ ...tdS, fontWeight:600, color:'#1e293b', maxWidth:260,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                      title={p.title}>{p.title}</td>
                    <td style={tdS}>
                      {p.category
                        ? <span style={{ padding:'2px 9px', borderRadius:99, fontSize:10.5, fontWeight:700,
                            background:'#dbeafe', color:'#1d4ed8' }}>{p.category}</span>
                        : <span style={{ color:'#94a3b8' }}>—</span>}
                    </td>
                    <td style={tdS}>
                      <span style={{ padding:'2px 9px', borderRadius:99, fontSize:10.5, fontWeight:700,
                        background: p.status === 'published' ? '#dcfce7' : '#fef9c3',
                        color:      p.status === 'published' ? '#16a34a' : '#b45309' }}>
                        {p.status || 'draft'}
                      </span>
                    </td>
                    <td style={{ ...tdS, fontSize:11.5, color:'#64748b' }}>{p.published_at || '—'}</td>
                    <td style={{ ...tdS, fontSize:11.5 }}>{p.author || 'Admin'}</td>
                    <td style={{ ...tdS, whiteSpace:'nowrap' }}>
                      <button onClick={() => navigate(`/blogs/edit/${p.id}`)}
                        style={{ padding:'5px 12px', background:'#fef9c3', color:'#b45309',
                          border:'1.5px solid #fde68a', borderRadius:6, fontSize:11,
                          fontWeight:600, cursor:'pointer', marginRight:6 }}>
                        ✏️ Edit
                      </button>
                      <button onClick={() => handleDelete(p.id)}
                        style={{ padding:'5px 12px', background:'#fee2e2', color:'#dc2626',
                          border:'1.5px solid #fecaca', borderRadius:6, fontSize:11,
                          fontWeight:600, cursor:'pointer' }}>
                        🗑 Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}