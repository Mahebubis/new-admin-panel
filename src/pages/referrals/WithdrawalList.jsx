// import { useState, useEffect, useCallback, useRef } from 'react';
// import api from '../../api/axios';
// import toast from 'react-hot-toast';

// const LIMIT = 15;

// const STATUS_STYLE = {
//   pending:      { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', dot: '#fb923c', label: 'Pending' },
//   success:      { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#22c55e', label: 'Success' },
//   completed:    { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#22c55e', label: 'Completed' },
//   under_review: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6', label: 'Under Review' },
// };

// function Avatar({ name, photo }) {
//   const initials = name?.charAt(0)?.toUpperCase() || '?';
//   if (photo) return (
//     <img src={photo} alt={name}
//       style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid #ede9fe', flexShrink: 0 }} />
//   );
//   return (
//     <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0, border: '2px solid #ede9fe' }}>
//       {initials}
//     </div>
//   );
// }

// function ProofCell({ url, onClick }) {
//   if (!url) return <span style={{ color: '#cbd5e1', fontSize: 11 }}>No proof</span>;
//   return (
//     <div onClick={onClick} title="Click to view proof"
//       style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', border: '2px solid #c4b5fd', cursor: 'pointer', flexShrink: 0, transition: 'border-color .15s, transform .15s', display: 'inline-block' }}
//       onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.transform = 'scale(1.1)'; }}
//       onMouseLeave={e => { e.currentTarget.style.borderColor = '#c4b5fd'; e.currentTarget.style.transform = 'scale(1)'; }}>
//       <img src={url} alt="Proof"
//         style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
//         onError={e => {
//           // if image fails (e.g. PDF/non-image), show a doc icon fallback
//           e.currentTarget.style.display = 'none';
//           e.currentTarget.parentElement.innerHTML =
//             `<div style="width:34px;height:34px;border-radius:50%;background:#ede9fe;display:flex;align-items:center;justify-content:center;cursor:pointer">
//               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
//                 <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
//                 <polyline points="14 2 14 8 20 8"/>
//               </svg>
//             </div>`;
//           e.currentTarget.parentElement.onclick = onClick;
//         }}
//       />
//     </div>
//   );
// }

// function ProofModal({ url, onClose }) {
//   if (!url) return null;
//   const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(url);
//   return (
//     <div onClick={onClose}
//       style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
//       <div onClick={e => e.stopPropagation()}
//         style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', maxWidth: 520, width: '100%', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}>
//         {/* Modal header */}
//         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1.5px solid #f1f5f9', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
//           <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 7 }}>
//             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
//               <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
//             </svg>
//             Payment Proof
//           </span>
//           <div style={{ display: 'flex', gap: 8 }}>
//             <a href={url} target="_blank" rel="noopener"
//               style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 11, fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.3)' }}>
//               <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
//                 <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
//               </svg>
//               Open
//             </a>
//             <button onClick={onClose}
//               style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
//               ×
//             </button>
//           </div>
//         </div>
//         {/* Image / fallback */}
//         <div style={{ padding: 16, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
//           {isImage
//             ? <img src={url} alt="Payment proof"
//                 style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8, objectFit: 'contain', display: 'block' }} />
//             : <div style={{ textAlign: 'center', color: '#94a3b8' }}>
//                 <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
//                   <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
//                   <polyline points="14 2 14 8 20 8"/>
//                 </svg>
//                 <p style={{ fontSize: 12, marginBottom: 12 }}>This file cannot be previewed directly.</p>
//                 <a href={url} target="_blank" rel="noopener"
//                   style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#4f46e5', color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
//                   Open File
//                 </a>
//               </div>
//           }
//         </div>
//       </div>
//     </div>
//   );
// }

// export default function WithdrawalList() {
//   const [data,        setData]        = useState([]);
//   const [total,       setTotal]       = useState(0);
//   const [page,        setPage]        = useState(1);
//   const [search,      setSearch]      = useState('');
//   const [searchInput, setSearchInput] = useState('');
//   const [status,      setStatus]      = useState('');
//   const [startDate,   setStartDate]   = useState('');
//   const [endDate,     setEndDate]     = useState('');
//   const [loading,     setLoading]     = useState(true);
//   const [updating,    setUpdating]    = useState({});
//   const [proofModal,  setProofModal]  = useState(null);
//   const jumpRef = useRef(null);

//   const totalPages = Math.ceil(total / LIMIT) || 1;

//   const fetchData = useCallback(async () => {
//     setLoading(true);
//     try {
//       const res = await api.get('/api/referrals/withdrawals.php', {
//         params: { page, per_page: LIMIT, search, status, start_date: startDate, end_date: endDate }
//       });
//       if (res.data.success) {
//         setData(res.data.data.withdrawals || []);
//         setTotal(res.data.data.total || 0);
//       }
//     } catch {} finally { setLoading(false); }
//   }, [page, search, status, startDate, endDate]);

//   useEffect(() => { fetchData(); }, [fetchData]);

//   const handleAction = async (id, newStatus) => {
//     setUpdating(prev => ({ ...prev, [id]: newStatus }));
//     try {
//       await api.post('/api/referrals/update-withdrawal.php', { id, payment_status: newStatus });
//       toast.success(`Withdrawal marked as ${newStatus.replace(/_/g, ' ')}`);
//       // real-time row update — no refetch
//       setData(prev => prev.map(r =>
//         (r.withdrawal_id === id || r.id === id) ? { ...r, payment_status: newStatus, status: newStatus } : r
//       ));
//     } catch {
//       toast.error('Failed to update status');
//     } finally {
//       setUpdating(prev => { const n = { ...prev }; delete n[id]; return n; });
//     }
//   };

//   const handleClear = () => {
//     setSearchInput(''); setSearch(''); setStatus('');
//     setStartDate(''); setEndDate(''); setPage(1);
//   };

//   const applySearch = () => { setSearch(searchInput); setPage(1); };

//   const jumpToPage = () => {
//     const v = parseInt(jumpRef.current?.value);
//     if (v >= 1 && v <= totalPages) setPage(v);
//     else toast.error('Invalid page number');
//   };

//   const pageNums = (() => {
//     if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
//     if (page <= 3)               return [1,2,3,4,5];
//     if (page >= totalPages - 2)  return [totalPages-4,totalPages-3,totalPages-2,totalPages-1,totalPages];
//     return [page-2,page-1,page,page+1,page+2];
//   })();

//   const getRowStatus = (row) => row.payment_status || row.status || 'pending';

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

//         .wd-root  { font-family: 'Plus Jakarta Sans', sans-serif; height: 100vh; display: flex; flex-direction: column; background: #f5f3ff; overflow: hidden; }

//         .wd-header { flex-shrink: 0; background: #fff; border-bottom: 1.5px solid #ede9fe; padding: 10px 20px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
//         .wd-title  { font-size: 15px; font-weight: 700; color: #1e293b; white-space: nowrap; display: flex; align-items: center; gap: 8px; }
//         .wd-total  { background: #ede9fe; color: #5b21b6; font-size: 10.5px; font-weight: 700; padding: 2px 9px; border-radius: 20px; }

//         .wd-input  { border: 1.5px solid #e2e8f0; border-radius: 7px; padding: 5px 10px; font-size: 11.5px; font-family: inherit; color: #1e293b; outline: none; background: #faf9ff; }
//         .wd-input:focus { border-color: #7c3aed; background: #fff; }
//         .wd-input-wide { width: 210px; }
//         .wd-select { border: 1.5px solid #e2e8f0; border-radius: 7px; padding: 5px 10px; font-size: 11.5px; font-family: inherit; color: #1e293b; outline: none; background: #faf9ff; cursor: pointer; }
//         .wd-select:focus { border-color: #7c3aed; }
//         .wd-date-sep { font-size: 11px; color: #94a3b8; font-weight: 600; }

//         .wd-btn-search { display: flex; align-items: center; gap: 5px; background: #4f46e5; color: #fff; border: none; border-radius: 7px; padding: 6px 14px; font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background .15s; }
//         .wd-btn-search:hover { background: #4338ca; }
//         .wd-btn-clear  { display: flex; align-items: center; gap: 5px; background: #f1f5f9; color: #475569; border: none; border-radius: 7px; padding: 6px 12px; font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background .15s; }
//         .wd-btn-clear:hover { background: #e2e8f0; }

//         .wd-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; padding: 12px 20px 12px; }
//         .wd-card { flex: 1; overflow: hidden; display: flex; flex-direction: column; background: #fff; border-radius: 12px; border: 1.5px solid #ede9fe; box-shadow: 0 1px 8px rgba(79,70,229,0.06); }
//         .wd-table-wrap { flex: 1; overflow: auto; }
//         .wd-table-wrap::-webkit-scrollbar { width: 5px; height: 5px; }
//         .wd-table-wrap::-webkit-scrollbar-track { background: #f5f3ff; }
//         .wd-table-wrap::-webkit-scrollbar-thumb { background: #c4b5fd; border-radius: 10px; }

//         table.wd-t { width: 100%; border-collapse: collapse; table-layout: fixed; }
//         table.wd-t thead tr { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); }
//         table.wd-t thead th { color: #fff; font-size: 10.5px; font-weight: 600; padding: 10px 12px; white-space: nowrap; text-align: left; letter-spacing: 0.4px; text-transform: uppercase; border-right: 1px solid rgba(255,255,255,0.18); overflow: hidden; text-overflow: ellipsis; }
//         table.wd-t thead th:last-child { border-right: none; }
//         table.wd-t tbody tr { border-bottom: 1px solid #f5f3ff; transition: background .12s; }
//         table.wd-t tbody tr:hover { background: #faf9ff; }
//         table.wd-t tbody tr:last-child { border-bottom: none; }
//         table.wd-t td { font-size: 12px; color: #334155; padding: 9px 12px; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-right: 1px solid #f5f3ff; }
//         table.wd-t td:last-child { border-right: none; }

//         .c-id    { width: 60px; }
//         .c-prof  { width: 185px; }
//         .c-upi   { width: 175px; }
//         .c-amt   { width: 80px; }
//         .c-stat  { width: 110px; }
//         .c-proof { width: 80px; }
//         .c-act   { width: 205px; }
//         .c-email { width: 190px; }
//         .c-date  { width: 145px; }

//         .st-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 20px; font-size: 10.5px; font-weight: 600; border-width: 1px; border-style: solid; white-space: nowrap; }
//         .upi-tag  { display: inline-block; padding: 2px 8px; border-radius: 5px; background: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 500; border: 1px solid #bfdbfe; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         .amt-val  { font-size: 13px; font-weight: 700; color: #15803d; }

//         /* action buttons */
//         .act-btn { display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: 6px; font-size: 10.5px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; transition: all .15s; white-space: nowrap; }
//         .act-btn:hover:not(:disabled) { transform: translateY(-1px); opacity: .88; }
//         .act-btn:disabled { opacity: .45; cursor: not-allowed; transform: none; }
//         .btn-complete { background: #dcfce7; color: #15803d; }
//         .btn-complete:hover:not(:disabled) { background: #16a34a; color: #fff; }
//         .btn-pending  { background: #fff7ed; color: #c2410c; }
//         .btn-pending:hover:not(:disabled)  { background: #ea580c; color: #fff; }
//         .btn-review   { background: #eff6ff; color: #1d4ed8; }
//         .btn-review:hover:not(:disabled)   { background: #2563eb; color: #fff; }

//         /* footer */
//         .wd-footer { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; border-top: 1.5px solid #f5f3ff; background: #faf9ff; border-radius: 0 0 12px 12px; }
//         .wd-page-info { font-size: 11px; color: #94a3b8; }
//         .wd-pagination { display: flex; align-items: center; gap: 3px; }
//         .pg-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 26px; padding: 0 6px; border: 1.5px solid #e2e8f0; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; background: #fff; color: #475569; font-family: inherit; transition: all .15s; }
//         .pg-btn:hover:not(:disabled) { border-color: #4f46e5; color: #4f46e5; }
//         .pg-btn.active { background: #4f46e5; border-color: #4f46e5; color: #fff; }
//         .pg-btn:disabled { opacity: .35; cursor: not-allowed; }
//         .pg-jump { display: flex; align-items: center; gap: 4px; }
//         .pg-jump input { width: 60px; border: 1.5px solid #e2e8f0; border-radius: 6px; padding: 3px 6px; font-size: 11px; font-family: inherit; outline: none; text-align: center; color: #1e293b; }
//         .pg-jump input:focus { border-color: #4f46e5; }
//         .pg-jump button { background: #4f46e5; color: #fff; border: none; border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; }

//         .wd-loader  { position: fixed; inset: 0; background: rgba(245,243,255,0.75); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(2px); }
//         .wd-spinner { width: 36px; height: 36px; border: 3px solid #ede9fe; border-top-color: #4f46e5; border-radius: 50%; animation: wdspin .7s linear infinite; }
//         @keyframes wdspin { to { transform: rotate(360deg); } }
//         .mini-spin { width: 11px; height: 11px; border: 2px solid rgba(0,0,0,0.15); border-top-color: currentColor; border-radius: 50%; animation: wdspin .5s linear infinite; display: inline-block; flex-shrink: 0; }
//         .no-data { text-align: center; padding: 40px; color: #94a3b8; font-size: 13px; }
//       `}</style>

//       {loading && <div className="wd-loader"><div className="wd-spinner" /></div>}

//       <div className="wd-root">

//         {/* ── HEADER ── */}
//         <div className="wd-header">
//           <div className="wd-title">
//             <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
//               <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
//             </svg>
//             Manage Withdrawals
//             {!loading && <span className="wd-total">{total.toLocaleString()}</span>}
//           </div>

//           <input className="wd-input wd-input-wide" value={searchInput}
//             onChange={e => setSearchInput(e.target.value)}
//             onKeyDown={e => e.key === 'Enter' && applySearch()}
//             placeholder="Search ID / name / email / UPI" />

//           <select className="wd-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
//             <option value="">All Status</option>
//             <option value="pending">Pending</option>
//             <option value="success">Success</option>
//             <option value="under_review">Under Review</option>
//           </select>

//           <input type="date" className="wd-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
//           <span className="wd-date-sep">to</span>
//           <input type="date" className="wd-input" value={endDate} onChange={e => setEndDate(e.target.value)} />

//           <button className="wd-btn-search" onClick={applySearch}>
//             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
//               <path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
//             </svg>
//             Search
//           </button>
//           <button className="wd-btn-clear" onClick={handleClear}>
//             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
//               <path d="M18 6 6 18M6 6l12 12" />
//             </svg>
//             Clear
//           </button>
//         </div>

//         {/* ── BODY ── */}
//         <div className="wd-body">
//           <div className="wd-card">
//             <div className="wd-table-wrap">
//               <table className="wd-t">
//                 <colgroup>
//                   <col className="c-id" /><col className="c-prof" /><col className="c-upi" />
//                   <col className="c-amt" /><col className="c-stat" /><col className="c-proof" />
//                   <col className="c-act" /><col className="c-email" /><col className="c-date" />
//                 </colgroup>
//                 <thead>
//                   <tr>
//                     {['ID','Profile','UPI ID','Amount','Status','Proof','Action','Email','Requested At'].map(h => (
//                       <th key={h}>{h}</th>
//                     ))}
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {!loading && data.length === 0 && (
//                     <tr><td colSpan={9} className="no-data">
//                       <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 8px' }}>
//                         <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
//                       </svg>
//                       No withdrawals found
//                     </td></tr>
//                   )}
//                   {data.map(row => {
//                     const id     = row.withdrawal_id || row.id;
//                     const st     = getRowStatus(row);
//                     const badge  = STATUS_STYLE[st] || STATUS_STYLE.pending;
//                     const busy   = updating[id];

//                     return (
//                       <tr key={id}>
//                         <td style={{ color: '#94a3b8', fontWeight: 600 }}>{id}</td>

//                         {/* Profile */}
//                         <td>
//                           <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
//                             <Avatar name={row.name || row.student_name} photo={row.photo} />
//                             <div style={{ overflow: 'hidden' }}>
//                               <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
//                                 {row.name || row.student_name}
//                               </div>
//                               <div style={{ fontSize: 10.5, color: '#94a3b8' }}>User #{row.user_id || id}</div>
//                             </div>
//                           </div>
//                         </td>

//                         {/* UPI */}
//                         <td>
//                           {row.upi_id
//                             ? <span className="upi-tag" title={row.upi_id}>{row.upi_id}</span>
//                             : <span style={{ color: '#cbd5e1' }}>—</span>}
//                         </td>

//                         {/* Amount */}
//                         <td>
//                           <span className="amt-val">
//                             ₹{Number(row.payment_amount ?? row.amount ?? 0).toLocaleString('en-IN')}
//                           </span>
//                         </td>

//                         {/* Status badge */}
//                         <td>
//                           <span className="st-badge" style={{ background: badge.bg, color: badge.color, borderColor: badge.border }}>
//                             <svg width="6" height="6" viewBox="0 0 6 6"><circle cx="3" cy="3" r="3" fill={badge.dot} /></svg>
//                             {badge.label}
//                           </span>
//                         </td>

//                         {/* Proof */}
//                         <td><ProofCell url={row.transaction_screenshot || row.proof} onClick={() => setProofModal(row.transaction_screenshot || row.proof)} /></td>

//                         {/* Actions */}
//                         <td>
//                           <div style={{ display: 'flex', gap: 4 }}>
//                             <button className="act-btn btn-complete"
//                               disabled={!!busy || st === 'success' || st === 'completed'}
//                               onClick={() => handleAction(id, 'success')}>
//                               {busy === 'success' || busy === 'completed'
//                                 ? <span className="mini-spin" />
//                                 : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
//                               Completed
//                             </button>
//                             <button className="act-btn btn-pending"
//                               disabled={!!busy || st === 'pending'}
//                               onClick={() => handleAction(id, 'pending')}>
//                               {busy === 'pending'
//                                 ? <span className="mini-spin" />
//                                 : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v10l4 4" /><circle cx="12" cy="12" r="10" /></svg>}
//                               Pending
//                             </button>
//                             <button className="act-btn btn-review"
//                               disabled={!!busy || st === 'under_review'}
//                               onClick={() => handleAction(id, 'under_review')}>
//                               {busy === 'under_review'
//                                 ? <span className="mini-spin" />
//                                 : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
//                               Review
//                             </button>
//                           </div>
//                         </td>

//                         {/* Email */}
//                         <td style={{ color: '#4f46e5' }}>{row.email}</td>

//                         {/* Date */}
//                         <td style={{ color: '#64748b', fontSize: 11 }}>{row.requested_at}</td>
//                       </tr>
//                     );
//                   })}
//                 </tbody>
//               </table>
//             </div>

//             {/* ── FOOTER ── */}
//             <div className="wd-footer">
//               <span className="wd-page-info">
//                 Page <strong>{page}</strong> of <strong>{totalPages}</strong>
//                 &nbsp;&middot;&nbsp;{total.toLocaleString()} total records
//               </span>
//               <div className="wd-pagination">
//                 <button className="pg-btn" onClick={() => setPage(1)} disabled={page <= 1}>«</button>
//                 <button className="pg-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>‹</button>
//                 {pageNums.map(p => (
//                   <button key={p} className={`pg-btn${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
//                 ))}
//                 <button className="pg-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>›</button>
//                 <button className="pg-btn" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>»</button>
//               </div>
//               <div className="pg-jump">
//                 <input ref={jumpRef} type="number" min={1} max={totalPages} placeholder="Page"
//                   onKeyDown={e => e.key === 'Enter' && jumpToPage()} />
//                 <button onClick={jumpToPage}>Go</button>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>

//       <ProofModal url={proofModal} onClose={() => setProofModal(null)} />
//     </>
//   );
// }








import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const LIMIT = 15;

const STATUS_STYLE = {
  pending:      { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', dot: '#fb923c', label: 'Pending' },
  success:      { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#22c55e', label: 'Success' },
  completed:    { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#22c55e', label: 'Completed' },
  under_review: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6', label: 'Under Review' },
};

function Avatar({ name, photo }) {
  const initials = name?.charAt(0)?.toUpperCase() || '?';
  if (photo) return (
    <img src={photo} alt={name}
      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid #ede9fe', flexShrink: 0 }} />
  );
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0, border: '2px solid #ede9fe' }}>
      {initials}
    </div>
  );
}

function ProofCell({ url, onClick }) {
  if (!url) return <span style={{ color: '#cbd5e1', fontSize: 11 }}>No proof</span>;
  return (
    <div onClick={onClick} title="Click to view proof"
      style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', border: '2px solid #c4b5fd', cursor: 'pointer', flexShrink: 0, transition: 'border-color .15s, transform .15s', display: 'inline-block' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.transform = 'scale(1.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#c4b5fd'; e.currentTarget.style.transform = 'scale(1)'; }}>
      <img src={url} alt="Proof"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={e => {
          // if image fails (e.g. PDF/non-image), show a doc icon fallback
          e.currentTarget.style.display = 'none';
          e.currentTarget.parentElement.innerHTML =
            `<div style="width:34px;height:34px;border-radius:50%;background:#ede9fe;display:flex;align-items:center;justify-content:center;cursor:pointer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>`;
          e.currentTarget.parentElement.onclick = onClick;
        }}
      />
    </div>
  );
}

function ProofModal({ url, onClose }) {
  if (!url) return null;
  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(url);
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', maxWidth: 520, width: '100%', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}>
        {/* Modal header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1.5px solid #f1f5f9', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
            </svg>
            Payment Proof
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={url} target="_blank" rel="noopener"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 11, fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.3)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
              </svg>
              Open
            </a>
            <button onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
              ×
            </button>
          </div>
        </div>
        {/* Image / fallback */}
        <div style={{ padding: 16, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          {isImage
            ? <img src={url} alt="Payment proof"
                style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8, objectFit: 'contain', display: 'block' }} />
            : <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <p style={{ fontSize: 12, marginBottom: 12 }}>This file cannot be previewed directly.</p>
                <a href={url} target="_blank" rel="noopener"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#4f46e5', color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                  Open File
                </a>
              </div>
          }
        </div>
      </div>
    </div>
  );
}

export default function WithdrawalList() {
  const [data,        setData]        = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status,      setStatus]      = useState('');
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [loading,     setLoading]     = useState(true);
  const [updating,    setUpdating]    = useState({});
  const [proofModal,  setProofModal]  = useState(null);
  const [upiModal,    setUpiModal]    = useState(null);
  const navigate = useNavigate();
  const jumpRef = useRef(null);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/referrals/withdrawals.php', {
        params: { page, per_page: LIMIT, search, status, start_date: startDate, end_date: endDate }
      });
      if (res.data.success) {
        setData(res.data.data.withdrawals || []);
        setTotal(res.data.data.total || 0);
      }
    } catch {} finally { setLoading(false); }
  }, [page, search, status, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (id, newStatus) => {
    setUpdating(prev => ({ ...prev, [id]: newStatus }));
    try {
      await api.post('/api/referrals/update-withdrawal.php', { id, payment_status: newStatus });
      toast.success(`Withdrawal marked as ${newStatus.replace(/_/g, ' ')}`);
      // real-time row update — no refetch
      setData(prev => prev.map(r =>
        (r.withdrawal_id === id || r.id === id) ? { ...r, payment_status: newStatus, status: newStatus } : r
      ));
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(prev => { const n = { ...prev }; delete n[id]; return n; });
    }
  };

  const handleClear = () => {
    setSearchInput(''); setSearch(''); setStatus('');
    setStartDate(''); setEndDate(''); setPage(1);
  };

  const applySearch = () => { setSearch(searchInput); setPage(1); };

  const jumpToPage = () => {
    const v = parseInt(jumpRef.current?.value);
    if (v >= 1 && v <= totalPages) setPage(v);
    else toast.error('Invalid page number');
  };

  const pageNums = (() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3)               return [1,2,3,4,5];
    if (page >= totalPages - 2)  return [totalPages-4,totalPages-3,totalPages-2,totalPages-1,totalPages];
    return [page-2,page-1,page,page+1,page+2];
  })();

  const getRowStatus = (row) => row.payment_status || row.status || 'pending';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

        .wd-root  { font-family: 'Plus Jakarta Sans', sans-serif; height: 100vh; display: flex; flex-direction: column; background: #f5f3ff; overflow: hidden; }

        .wd-header { flex-shrink: 0; background: #fff; border-bottom: 1.5px solid #ede9fe; padding: 10px 20px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .wd-title  { font-size: 15px; font-weight: 700; color: #1e293b; white-space: nowrap; display: flex; align-items: center; gap: 8px; }
        .wd-total  { background: #ede9fe; color: #5b21b6; font-size: 10.5px; font-weight: 700; padding: 2px 9px; border-radius: 20px; }

        .wd-input  { border: 1.5px solid #e2e8f0; border-radius: 7px; padding: 5px 10px; font-size: 11.5px; font-family: inherit; color: #1e293b; outline: none; background: #faf9ff; }
        .wd-input:focus { border-color: #7c3aed; background: #fff; }
        .wd-input-wide { width: 210px; }
        .wd-select { border: 1.5px solid #e2e8f0; border-radius: 7px; padding: 5px 10px; font-size: 11.5px; font-family: inherit; color: #1e293b; outline: none; background: #faf9ff; cursor: pointer; }
        .wd-select:focus { border-color: #7c3aed; }
        .wd-date-sep { font-size: 11px; color: #94a3b8; font-weight: 600; }

        .wd-btn-search { display: flex; align-items: center; gap: 5px; background: #4f46e5; color: #fff; border: none; border-radius: 7px; padding: 6px 14px; font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background .15s; }
        .wd-btn-search:hover { background: #4338ca; }
        .wd-btn-clear  { display: flex; align-items: center; gap: 5px; background: #f1f5f9; color: #475569; border: none; border-radius: 7px; padding: 6px 12px; font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background .15s; }
        .wd-btn-clear:hover { background: #e2e8f0; }

        .wd-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; padding: 12px 20px 12px; }
        .wd-card { flex: 1; overflow: hidden; display: flex; flex-direction: column; background: #fff; border-radius: 12px; border: 1.5px solid #ede9fe; box-shadow: 0 1px 8px rgba(79,70,229,0.06); }
        .wd-table-wrap { flex: 1; overflow: auto; }
        .wd-table-wrap::-webkit-scrollbar { width: 5px; height: 5px; }
        .wd-table-wrap::-webkit-scrollbar-track { background: #f5f3ff; }
        .wd-table-wrap::-webkit-scrollbar-thumb { background: #c4b5fd; border-radius: 10px; }

        table.wd-t { width: 100%; border-collapse: collapse; table-layout: fixed; }
        table.wd-t thead tr { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); }
        table.wd-t thead th { color: #fff; font-size: 10.5px; font-weight: 600; padding: 10px 12px; white-space: nowrap; text-align: left; letter-spacing: 0.4px; text-transform: uppercase; border-right: 1px solid rgba(255,255,255,0.18); overflow: hidden; text-overflow: ellipsis; }
        table.wd-t thead th:last-child { border-right: none; }
        table.wd-t tbody tr { border-bottom: 1px solid #f5f3ff; transition: background .12s; }
        table.wd-t tbody tr:hover { background: #faf9ff; }
        table.wd-t tbody tr:last-child { border-bottom: none; }
        table.wd-t td { font-size: 12px; color: #334155; padding: 9px 12px; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-right: 1px solid #f5f3ff; }
        table.wd-t td:last-child { border-right: none; }

        .c-id    { width: 60px; }
        .c-prof  { width: 185px; }
        .c-upi   { width: 175px; }
        .c-amt   { width: 80px; }
        .c-stat  { width: 110px; }
        .c-proof { width: 80px; }
        .c-act   { width: 205px; }
        .c-email { width: 190px; }
        .c-date  { width: 145px; }

        .st-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 20px; font-size: 10.5px; font-weight: 600; border-width: 1px; border-style: solid; white-space: nowrap; }
        .upi-tag  { display: inline-block; padding: 2px 8px; border-radius: 5px; background: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 500; border: 1px solid #bfdbfe; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .amt-val  { font-size: 13px; font-weight: 700; color: #15803d; }

        /* action buttons */
        .act-btn { display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: 6px; font-size: 10.5px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; transition: all .15s; white-space: nowrap; }
        .act-btn:hover:not(:disabled) { transform: translateY(-1px); opacity: .88; }
        .act-btn:disabled { opacity: .45; cursor: not-allowed; transform: none; }
        .btn-complete { background: #dcfce7; color: #15803d; }
        .btn-complete:hover:not(:disabled) { background: #16a34a; color: #fff; }
        .btn-pending  { background: #fff7ed; color: #c2410c; }
        .btn-pending:hover:not(:disabled)  { background: #ea580c; color: #fff; }
        .btn-review   { background: #eff6ff; color: #1d4ed8; }
        .btn-review:hover:not(:disabled)   { background: #2563eb; color: #fff; }

        /* footer */
        .wd-footer { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; border-top: 1.5px solid #f5f3ff; background: #faf9ff; border-radius: 0 0 12px 12px; }
        .wd-page-info { font-size: 11px; color: #94a3b8; }
        .wd-pagination { display: flex; align-items: center; gap: 3px; }
        .pg-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 26px; padding: 0 6px; border: 1.5px solid #e2e8f0; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; background: #fff; color: #475569; font-family: inherit; transition: all .15s; }
        .pg-btn:hover:not(:disabled) { border-color: #4f46e5; color: #4f46e5; }
        .pg-btn.active { background: #4f46e5; border-color: #4f46e5; color: #fff; }
        .pg-btn:disabled { opacity: .35; cursor: not-allowed; }
        .pg-jump { display: flex; align-items: center; gap: 4px; }
        .pg-jump input { width: 60px; border: 1.5px solid #e2e8f0; border-radius: 6px; padding: 3px 6px; font-size: 11px; font-family: inherit; outline: none; text-align: center; color: #1e293b; }
        .pg-jump input:focus { border-color: #4f46e5; }
        .pg-jump button { background: #4f46e5; color: #fff; border: none; border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; }

        .wd-loader  { position: fixed; inset: 0; background: rgba(245,243,255,0.75); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(2px); }
        .wd-spinner { width: 36px; height: 36px; border: 3px solid #ede9fe; border-top-color: #4f46e5; border-radius: 50%; animation: wdspin .7s linear infinite; }
        @keyframes wdspin { to { transform: rotate(360deg); } }
        .mini-spin { width: 11px; height: 11px; border: 2px solid rgba(0,0,0,0.15); border-top-color: currentColor; border-radius: 50%; animation: wdspin .5s linear infinite; display: inline-block; flex-shrink: 0; }
        .no-data { text-align: center; padding: 40px; color: #94a3b8; font-size: 13px; }
      `}</style>

      {loading && <div className="wd-loader"><div className="wd-spinner" /></div>}

      <div className="wd-root">

        {/* ── HEADER ── */}
        <div className="wd-header">
          <div className="wd-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            Manage Withdrawals
            {!loading && <span className="wd-total">{total.toLocaleString()}</span>}
          </div>

          <input className="wd-input wd-input-wide" value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applySearch()}
            placeholder="Search ID / name / email / UPI" />

          <select className="wd-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="success">Success</option>
            <option value="under_review">Under Review</option>
          </select>

          <input type="date" className="wd-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <span className="wd-date-sep">to</span>
          <input type="date" className="wd-input" value={endDate} onChange={e => setEndDate(e.target.value)} />

          <button className="wd-btn-search" onClick={applySearch}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            Search
          </button>
          <button className="wd-btn-clear" onClick={handleClear}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            Clear
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="wd-body">
          <div className="wd-card">
            <div className="wd-table-wrap">
              <table className="wd-t">
                <colgroup>
                  <col className="c-id" /><col className="c-prof" /><col className="c-upi" />
                  <col className="c-amt" /><col className="c-stat" /><col className="c-proof" />
                  <col className="c-act" /><col className="c-email" /><col className="c-date" />
                </colgroup>
                <thead>
                  <tr>
                    {['ID','Profile','UPI ID','Amount','Status','Proof','Action','Email','Requested At'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!loading && data.length === 0 && (
                    <tr><td colSpan={9} className="no-data">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 8px' }}>
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                      No withdrawals found
                    </td></tr>
                  )}
                  {data.map(row => {
                    const id     = row.withdrawal_id || row.id;
                    const st     = getRowStatus(row);
                    const badge  = STATUS_STYLE[st] || STATUS_STYLE.pending;
                    const busy   = updating[id];

                    return (
                      <tr key={id}
                        onClick={() => navigate(`/referral-detail-for-admin?user_id=${row.user_id || id}`)}
                        style={{ cursor: 'pointer' }}>
                        <td style={{ color: '#94a3b8', fontWeight: 600 }}>{id}</td>

                        {/* Profile */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <Avatar name={row.name || row.student_name} photo={row.photo} />
                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {row.name || row.student_name}
                              </div>
                              <div style={{ fontSize: 10.5, color: '#94a3b8' }}>User #{row.user_id || id}</div>
                            </div>
                          </div>
                        </td>

                        {/* UPI — click shows popup, copy icon copies */}
                        <td onClick={e => e.stopPropagation()}>
                          {row.upi_id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span className="upi-tag"
                                title="Click to view UPI"
                                onClick={() => setUpiModal(row.upi_id)}
                                style={{ cursor: 'pointer', maxWidth: 130 }}>
                                {row.upi_id}
                              </span>
                              <button
                                title="Copy UPI"
                                onClick={() => { navigator.clipboard.writeText(row.upi_id); toast.success('UPI copied!'); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4b5fd', padding: 2, display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'color .15s' }}
                                onMouseEnter={e => e.currentTarget.style.color = '#7c3aed'}
                                onMouseLeave={e => e.currentTarget.style.color = '#c4b5fd'}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                </svg>
                              </button>
                            </div>
                          ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>

                        {/* Amount */}
                        <td>
                          <span className="amt-val">
                            ₹{Number(row.payment_amount ?? row.amount ?? 0).toLocaleString('en-IN')}
                          </span>
                        </td>

                        {/* Status badge */}
                        <td>
                          <span className="st-badge" style={{ background: badge.bg, color: badge.color, borderColor: badge.border }}>
                            <svg width="6" height="6" viewBox="0 0 6 6"><circle cx="3" cy="3" r="3" fill={badge.dot} /></svg>
                            {badge.label}
                          </span>
                        </td>

                        {/* Proof */}
                        <td onClick={e => e.stopPropagation()}>
                          <ProofCell url={row.transaction_screenshot || row.proof} onClick={() => setProofModal(row.transaction_screenshot || row.proof)} />
                        </td>

                        {/* Actions */}
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {(st === 'success' || st === 'completed') ? (
                              /* Already completed — show only the disabled completed badge */
                              <button className="act-btn btn-complete" disabled
                                style={{ opacity: 1, cursor: 'default', background: '#dcfce7', color: '#15803d', paddingLeft: 10, paddingRight: 10 }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                                Completed
                              </button>
                            ) : (
                              <>
                                <button className="act-btn btn-complete"
                                  disabled={!!busy}
                                  onClick={() => handleAction(id, 'success')}>
                                  {busy === 'success' || busy === 'completed'
                                    ? <span className="mini-spin" />
                                    : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                                  Completed
                                </button>
                                <button className="act-btn btn-pending"
                                  disabled={!!busy || st === 'pending'}
                                  onClick={() => handleAction(id, 'pending')}>
                                  {busy === 'pending'
                                    ? <span className="mini-spin" />
                                    : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v10l4 4" /><circle cx="12" cy="12" r="10" /></svg>}
                                  Pending
                                </button>
                                <button className="act-btn btn-review"
                                  disabled={!!busy || st === 'under_review'}
                                  onClick={() => handleAction(id, 'under_review')}>
                                  {busy === 'under_review'
                                    ? <span className="mini-spin" />
                                    : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                                  Review
                                </button>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Email */}
                        <td style={{ color: '#4f46e5' }}>{row.email}</td>

                        {/* Date */}
                        <td style={{ color: '#64748b', fontSize: 11 }}>{row.requested_at}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── FOOTER ── */}
            <div className="wd-footer">
              <span className="wd-page-info">
                Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                &nbsp;&middot;&nbsp;{total.toLocaleString()} total records
              </span>
              <div className="wd-pagination">
                <button className="pg-btn" onClick={() => setPage(1)} disabled={page <= 1}>«</button>
                <button className="pg-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>‹</button>
                {pageNums.map(p => (
                  <button key={p} className={`pg-btn${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                ))}
                <button className="pg-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>›</button>
                <button className="pg-btn" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>»</button>
              </div>
              <div className="pg-jump">
                <input ref={jumpRef} type="number" min={1} max={totalPages} placeholder="Page"
                  onKeyDown={e => e.key === 'Enter' && jumpToPage()} />
                <button onClick={jumpToPage}>Go</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProofModal url={proofModal} onClose={() => setProofModal(null)} />

      {/* UPI Popup */}
      {upiModal && (
        <div onClick={() => setUpiModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', maxWidth: 420, width: '90%', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
            </div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>UPI ID</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', wordBreak: 'break-all', marginBottom: 20, letterSpacing: '-0.3px' }}>{upiModal}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => { navigator.clipboard.writeText(upiModal); toast.success('UPI copied!'); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, background: '#4f46e5', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy UPI
              </button>
              <button onClick={() => setUpiModal(null)}
                style={{ padding: '8px 20px', borderRadius: 8, background: '#f1f5f9', color: '#475569', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}