// import { useState, useEffect, useCallback, useRef } from 'react';
// import api from '../../api/axios';
// import toast from 'react-hot-toast';

// /* ─── status badge map ─── */
// const STATUS_BADGE = {
//   active: { bg: '#f3f4f6', color: '#9ca3af', label: 'Active' },
//   under_review: { bg: '#fff8e1', color: '#e65100', label: 'Claim Requested' },
//   refunded: { bg: '#e8f5e9', color: '#2e7d32', label: 'Refunded' },
//   rejected: { bg: '#ffebee', color: '#c62828', label: 'Rejected' },
//   completed: { bg: '#e0f2f1', color: '#00695c', label: 'Completed' },
//   project_submitted: { bg: '#fff3e0', color: '#e65100', label: 'Project Submitted' },
//   project_approved: { bg: '#e8f5e9', color: '#2e7d32', label: 'Project Approved' },
//   project_rejected: { bg: '#ffebee', color: '#c62828', label: 'Project Rejected' },
// };

// const PROJECT_BADGE = {
//   pending: { bg: '#fff8e1', color: '#e65100', label: 'Pending' },
//   approved: { bg: '#e8f5e9', color: '#2e7d32', label: 'Approved' },
//   rejected: { bg: '#ffebee', color: '#c62828', label: 'Rejected' },
// };

// /* ─── inline SVG icon helper ─── */
// const SvgIcon = ({ d, size = 14, color = 'currentColor', ...p }) => (
//   <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
//     stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
//     <path d={d} />
//   </svg>
// );
// const ICONS = {
//   search: 'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
//   x: 'M18 6 6 18M6 6l12 12',
//   copy: 'M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-4-4H8zM14 2v6h6',
//   check: 'M20 6 9 17l-5-5',
//   upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
//   link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
//   file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
//   mail: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6',
// };

// export default function RefundList() {
//   /* ── state ── */
//   const [data, setData] = useState([]);
//   const [total, setTotal] = useState(0);
//   const [totalPages, setTotalPages] = useState(1);
//   const [stats, setStats] = useState({});
//   const [batches, setBatches] = useState([]);
//   const [page, setPage] = useState(1);
//   const [perPage, setPerPage] = useState(20);
//   const [searchInput, setSearchInput] = useState('');
//   const [search, setSearch] = useState('');
//   const [status, setStatus] = useState('');
//   const [batch, setBatch] = useState('');
//   const [loading, setLoading] = useState(true);
//   const jumpRef = useRef(null);

//   /* modal states */
//   const [confirmModal, setConfirmModal] = useState(null);
//   const [rejectModal, setRejectModal] = useState(null);
//   const [approveModal, setApproveModal] = useState(null);
//   const [declineModal, setDeclineModal] = useState(null);
//   const [proofModal, setProofModal] = useState(null);
//   const [actionLoading, setActionLoading] = useState(false);

//   /* ── fetch ── */
//   const fetchData = useCallback(async () => {
//     setLoading(true);
//     try {
//       const res = await api.get('/api/refunds/list.php', {
//         params: { page, per_page: perPage, search, status, batch }
//       });
//       if (res.data.success) {
//         const d = res.data.data;
//         setData(d.refunds || []);
//         setTotal(d.total || 0);
//         setTotalPages(d.total_pages || 1);
//         if (d.stats) setStats(d.stats);
//         if (d.batches) setBatches(d.batches);
//       }
//     } catch { /* handled by interceptor */ }
//     finally { setLoading(false); }
//   }, [page, perPage, search, status, batch]);

//   useEffect(() => { fetchData(); }, [fetchData]);

//   /* ── helpers ── */
//   const copyToClipboard = (txt) => { navigator.clipboard.writeText(txt); toast.success('Copied!'); };

//   const doSearch = () => { setSearch(searchInput); setPage(1); };
//   const doClear = () => { setSearchInput(''); setSearch(''); setStatus(''); setBatch(''); setPage(1); };

//   const jumpToPage = () => {
//     const v = parseInt(jumpRef.current?.value);
//     if (v >= 1 && v <= totalPages) setPage(v);
//     else toast.error('Invalid page number');
//   };

//   const pageNums = (() => {
//     if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
//     if (page <= 3) return [1, 2, 3, 4, 5];
//     if (page >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
//     return [page - 2, page - 1, page, page + 1, page + 2];
//   })();

//   const attColor = (v) => v >= 100 ? '#2e7d32' : v >= 50 ? '#e65100' : '#c62828';
//   const attBg = (v) => v >= 100 ? '#e8f5e9' : v >= 50 ? '#fff8e1' : '#ffebee';

//   const fmtDate = (d) => {
//     if (!d) return '—';
//     try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
//     catch { return d; }
//   };

//   /* ── API actions ── */
//   const uploadProof = async (file) => {
//     const fd = new FormData();
//     fd.append('action', 'upload_proof');
//     fd.append('proof', file);
//     const res = await api.post('/api/refunds/list.php', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
//     return res.data?.data?.url || '';
//   };

//   const sendEmail = async (to, subject, html) => {
//     await api.post('/api/refunds/list.php', { action: 'send_email', to, subject, html });
//   };

//   const updateRefundClaim = async (user_id, internship_id, claimStatus, admin_notes, proof_url) => {
//     await api.post('/api/refunds/list.php', {
//       action: 'update_refund_claim', user_id, internship_id,
//       status: claimStatus, admin_notes, proof_url
//     });
//   };

//   const approveProject = async (user_id, internship_id) => {
//     await api.post('/api/refunds/list.php', { action: 'approve_project', user_id, internship_id });
//   };

//   const declineProject = async (user_id, internship_id, reason) => {
//     await api.post('/api/refunds/list.php', { action: 'decline_project', user_id, internship_id, reason });
//   };

//   /* ── Confirm Refund handler ── */
//   const handleConfirmRefund = async (modal) => {
//     setActionLoading(true);
//     try {
//       let proofUrl = modal.proofUrl || '';
//       if (modal.proofFile) {
//         proofUrl = await uploadProof(modal.proofFile);
//       }
//       await updateRefundClaim(modal.user_id, modal.internship_id, 'refunded', modal.adminNotes, proofUrl);
//       if (!modal.skipEmail) {
//         await sendEmail(
//           modal.email,
//           'Your Refund Has Been Processed – Internship Studio',
//           `<p>Dear <strong>${modal.name}</strong>,</p>
//           <p>We are pleased to inform you that your refund for the internship <strong>${modal.internship_name}</strong> has been successfully processed.</p>
//           <p>The refund amount will be credited to your original payment method within 5-7 business days.</p>
//           ${proofUrl ? `<p>Proof of refund: <a href="${proofUrl}" target="_blank">View Proof</a></p>` : ''}
//           ${modal.adminNotes ? `<p><strong>Notes:</strong> ${modal.adminNotes}</p>` : ''}
//           <p>If you have any questions, please don't hesitate to reach out to us.</p>
//           <p>Best regards,<br/>Internship Studio Team</p>`
//         );
//       }
//       toast.success('Refund confirmed successfully');
//       setConfirmModal(null);
//       fetchData();
//     } catch { toast.error('Failed to confirm refund'); }
//     finally { setActionLoading(false); }
//   };

//   /* ── Reject Refund handler ── */
//   const handleRejectRefund = async (modal) => {
//     setActionLoading(true);
//     try {
//       await updateRefundClaim(modal.user_id, modal.internship_id, 'rejected', modal.adminNotes, '');
//       if (!modal.skipEmail) {
//         await sendEmail(modal.email, modal.emailSubject, modal.emailBody);
//       }
//       toast.success('Refund claim rejected');
//       setRejectModal(null);
//       fetchData();
//     } catch { toast.error('Failed to reject refund'); }
//     finally { setActionLoading(false); }
//   };

//   /* ── Approve Project handler ── */
//   const handleApproveProject = async (modal) => {
//     setActionLoading(true);
//     try {
//       await approveProject(modal.user_id, modal.internship_id);
//       if (!modal.skipEmail) {
//         await sendEmail(
//           modal.email,
//           'Your Project Has Been Approved – Internship Studio',
//           `<p>Dear <strong>${modal.name}</strong>,</p>
//           <p>Congratulations! Your project submission for the internship <strong>${modal.internship_name}</strong> has been approved.</p>
//           <p>You are now one step closer to completing your internship and becoming eligible for a refund.</p>
//           <p>Keep up the great work!</p>
//           <p>Best regards,<br/>Internship Studio Team</p>`
//         );
//       }
//       toast.success('Project approved successfully');
//       setApproveModal(null);
//       fetchData();
//     } catch { toast.error('Failed to approve project'); }
//     finally { setActionLoading(false); }
//   };

//   /* ── Decline Project handler ── */
//   const handleDeclineProject = async (modal) => {
//     setActionLoading(true);
//     try {
//       await declineProject(modal.user_id, modal.internship_id, modal.reason);
//       if (!modal.skipEmail) {
//         await sendEmail(modal.email, modal.emailSubject, modal.emailBody);
//       }
//       toast.success('Project declined');
//       setDeclineModal(null);
//       fetchData();
//     } catch { toast.error('Failed to decline project'); }
//     finally { setActionLoading(false); }
//   };

//   /* ── Upload Proof handler ── */
//   const handleUploadProof = async (modal) => {
//     if (!modal.file) { toast.error('Please select a file'); return; }
//     setActionLoading(true);
//     try {
//       const url = await uploadProof(modal.file);
//       await updateRefundClaim(modal.user_id, modal.internship_id, modal.currentStatus, modal.adminNotes || '', url);
//       toast.success('Proof uploaded successfully');
//       setProofModal(null);
//       fetchData();
//     } catch { toast.error('Failed to upload proof'); }
//     finally { setActionLoading(false); }
//   };

//   /* ── stat chips config ── */
//   const chips = [
//     { key: '', label: 'Total', count: stats.total || 0, color: '#0d2137' },
//     { key: 'active', label: 'Active', count: stats.active || 0, color: '#9ca3af' },
//     { key: 'completed', label: 'Completed', count: stats.completed || 0, color: '#00695c' },
//     { key: 'under_review', label: 'Claim Requested', count: stats.under_review || 0, color: '#e65100' },
//     { key: 'refunded', label: 'Refunded', count: stats.refunded || 0, color: '#2e7d32' },
//     { key: 'rejected', label: 'Rejected', count: stats.rejected || 0, color: '#c62828' },
//     { key: 'project_submitted', label: 'Project Submitted', count: stats.project_submitted || 0, color: '#e65100' },
//     { key: 'project_approved', label: 'Project Approved', count: stats.project_approved || 0, color: '#2e7d32' },
//     { key: 'project_rejected', label: 'Project Rejected', count: stats.project_rejected || 0, color: '#c62828' },
//   ];

//   /* ══════════════════════════════ RENDER ══════════════════════════════ */
//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
//         .rf-root{font-family:'Plus Jakarta Sans',sans-serif;height:100vh;display:flex;flex-direction:column;background:#f0faf8;overflow:hidden;}
// .rf-header{flex-shrink:0;background:#fff;border-bottom:1.5px solid #d4efeb;padding:8px 20px;}
// .rf-header-top{display:flex;align-items:center;gap:12px;margin-bottom:6px;flex-wrap:wrap;}
// .rf-chips{display:flex;flex-wrap:wrap;gap:5px;}
// .rf-chip{padding:3px 10px;border-radius:20px;font-size:10px;font-weight:600;border:1.5px solid #e2e8f0;cursor:pointer;transition:all .15s;background:#fff;white-space:nowrap;}
// .rf-filters{flex-shrink:0;background:#fff;border-bottom:1.5px solid #d4efeb;padding:6px 20px;display:flex;flex-wrap:wrap;align-items:center;gap:6px;}
//         .rf-header{flex-shrink:0;background:#fff;border-bottom:1.5px solid #d4efeb;padding:12px 20px;}
//         .rf-header-top{display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap;}
//         .rf-title{font-size:16px;font-weight:700;color:#0d2137;letter-spacing:-0.3px;}
//         .rf-subtitle{font-size:11px;color:#6b8f8a;margin-left:4px;}
//         .rf-chips{display:flex;flex-wrap:wrap;gap:6px;}
//         .rf-chip{padding:4px 12px;border-radius:20px;font-size:10.5px;font-weight:600;border:1.5px solid #e2e8f0;cursor:pointer;transition:all .15s;background:#fff;white-space:nowrap;}
//         .rf-chip:hover{border-color:#00bfa6;}
//         .rf-chip.active{background:#00bfa6;border-color:#00bfa6;color:#fff !important;}
//         .rf-filters{flex-shrink:0;background:#fff;border-bottom:1.5px solid #d4efeb;padding:8px 20px;display:flex;flex-wrap:wrap;align-items:center;gap:8px;}
//         .rf-search-box{display:flex;align-items:center;background:#f0faf8;border:1.5px solid #d4efeb;border-radius:8px;overflow:hidden;flex:1;max-width:300px;min-width:200px;}
//         .rf-search-box input{flex:1;border:none;background:transparent;padding:6px 10px;font-size:12px;font-family:inherit;outline:none;color:#1a2e2b;}
//         .rf-search-box input::placeholder{color:#6b8f8a;}
//         .rf-select{padding:6px 10px;border:1.5px solid #d4efeb;border-radius:8px;font-size:12px;font-family:inherit;outline:none;color:#1a2e2b;background:#f0faf8;cursor:pointer;}
//         .rf-btn{display:inline-flex;align-items:center;gap:4px;padding:6px 14px;border-radius:8px;font-size:11.5px;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:all .15s;white-space:nowrap;}
//         .rf-btn:hover{opacity:.88;transform:translateY(-1px);}
//         .rf-btn-teal{background:#00bfa6;color:#fff;}
//         .rf-btn-outline{background:#fff;border:1.5px solid #00bfa6;color:#00bfa6;}
//         .rf-btn-red{background:#e53935;color:#fff;}
//         .rf-btn-gray{background:#f3f4f6;color:#6b7280;border:1px solid #e2e8f0;}
//         .rf-btn-sm{padding:3px 10px;font-size:10px;border-radius:5px;}
//         .rf-body{flex:1;overflow:hidden;display:flex;flex-direction:column;padding:12px 20px 0;}
//         .rf-card{flex:1;overflow:hidden;display:flex;flex-direction:column;background:#fff;border-radius:12px;border:1.5px solid #d4efeb;box-shadow:0 1px 8px rgba(0,0,0,0.04);}
//         .rf-table-wrap{flex:1;overflow:auto;}
//         .rf-table-wrap::-webkit-scrollbar{width:5px;height:5px;}
//         .rf-table-wrap::-webkit-scrollbar-track{background:#f0faf8;}
//         .rf-table-wrap::-webkit-scrollbar-thumb{background:#a7d8d0;border-radius:10px;}
//         table.rf-t{width:100%;border-collapse:collapse;table-layout:auto;min-width:1400px;}
//         table.rf-t thead tr{background:#0d2137;}
//         table.rf-t thead th{color:#fff;font-size:10px;font-weight:600;padding:10px 8px;white-space:nowrap;text-align:left;letter-spacing:0.4px;text-transform:uppercase;border-right:1px solid rgba(255,255,255,0.12);}
//         table.rf-t thead th:last-child{border-right:none;}
//         table.rf-t tbody tr{border-bottom:1px solid #f0faf8;transition:background .12s;}
//         table.rf-t tbody tr:hover{background:#f0faf8;}
//         table.rf-t tbody tr.rf-highlight{background:#fffde7;}
//         table.rf-t td{font-size:11.5px;color:#334155;padding:8px 8px;vertical-align:middle;white-space:nowrap;border-right:1px solid #f0faf8;}
//         table.rf-t td:last-child{border-right:none;}
//         .rf-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;white-space:nowrap;}
//         .rf-att-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:10.5px;font-weight:700;}
//         .rf-copy-btn{background:none;border:none;cursor:pointer;color:#a7d8d0;padding:0 2px;transition:color .15s;display:inline-flex;align-items:center;}
//         .rf-copy-btn:hover{color:#00bfa6;}
//         .rf-footer{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-top:1.5px solid #f0faf8;background:#fafffe;border-radius:0 0 12px 12px;flex-wrap:wrap;gap:8px;}
//         .rf-page-info{font-size:11px;color:#6b8f8a;}
//         .rf-pagination{display:flex;align-items:center;gap:3px;}
//         .rf-pg-btn{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:26px;padding:0 6px;border:1.5px solid #d4efeb;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;background:#fff;color:#475569;font-family:inherit;transition:all .15s;}
//         .rf-pg-btn:hover:not(:disabled){border-color:#00bfa6;color:#00bfa6;}
//         .rf-pg-btn.active{background:#00bfa6;border-color:#00bfa6;color:#fff;}
//         .rf-pg-btn:disabled{opacity:.35;cursor:not-allowed;}
//         .rf-pg-jump{display:flex;align-items:center;gap:4px;}
//         .rf-pg-jump input{width:55px;border:1.5px solid #d4efeb;border-radius:6px;padding:3px 6px;font-size:11px;font-family:inherit;outline:none;text-align:center;color:#1a2e2b;}
//         .rf-pg-jump input:focus{border-color:#00bfa6;}
//         .rf-pg-jump button{background:#00bfa6;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;}
//         .rf-loader{position:fixed;inset:0;background:rgba(240,250,248,0.75);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(2px);}
//         .rf-spinner{width:36px;height:36px;border:3px solid #d4efeb;border-top-color:#00bfa6;border-radius:50%;animation:rf-spin .7s linear infinite;}
//         @keyframes rf-spin{to{transform:rotate(360deg);}}

//         /* modal */
//         .rf-modal-overlay{position:fixed;inset:0;background:rgba(13,33,55,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(3px);}
//         .rf-modal-box{background:#fff;border-radius:14px;width:100%;max-width:540px;box-shadow:0 20px 60px rgba(0,0,0,0.18);overflow:hidden;max-height:90vh;display:flex;flex-direction:column;}
//         .rf-modal-head{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1.5px solid #f0faf8;background:#fafffe;}
//         .rf-modal-head h5{font-size:14px;font-weight:700;color:#0d2137;margin:0;}
//         .rf-modal-close{background:none;border:none;cursor:pointer;color:#6b8f8a;transition:color .15s;display:flex;align-items:center;}
//         .rf-modal-close:hover{color:#0d2137;}
//         .rf-modal-body{padding:20px;overflow-y:auto;flex:1;}
//         .rf-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1.5px solid #f0faf8;}
//         .rf-field{margin-bottom:14px;}
//         .rf-field label{display:block;font-size:11px;font-weight:600;color:#0d2137;margin-bottom:4px;}
//         .rf-field input,.rf-field textarea,.rf-field select{width:100%;padding:8px 10px;border:1.5px solid #d4efeb;border-radius:8px;font-size:12px;font-family:inherit;outline:none;color:#1a2e2b;background:#f0faf8;box-sizing:border-box;}
//         .rf-field input:focus,.rf-field textarea:focus{border-color:#00bfa6;}
//         .rf-field textarea{min-height:80px;resize:vertical;}
//         .rf-checkbox{display:flex;align-items:center;gap:6px;font-size:12px;color:#1a2e2b;cursor:pointer;}
//         .rf-checkbox input{width:14px;height:14px;accent-color:#00bfa6;}
//         .rf-email-preview{background:#f0faf8;border:1px solid #d4efeb;border-radius:8px;padding:12px;font-size:11px;color:#1a2e2b;line-height:1.6;max-height:160px;overflow-y:auto;margin-bottom:10px;}
//         .rf-drop-zone{border:2px dashed #d4efeb;border-radius:10px;padding:30px 20px;text-align:center;cursor:pointer;transition:all .15s;background:#fafffe;}
//         .rf-drop-zone:hover,.rf-drop-zone.drag{border-color:#00bfa6;background:#e0f7f4;}
//         .rf-drop-zone p{margin:6px 0 0;font-size:12px;color:#6b8f8a;}
//         .rf-file-preview{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f0faf8;border:1px solid #d4efeb;border-radius:8px;margin-top:8px;font-size:11px;color:#1a2e2b;}
//         .rf-no-data{text-align:center;padding:40px;color:#a7d8d0;font-size:13px;}
//         .rf-btn:disabled{opacity:.35;cursor:not-allowed;transform:none !important;}
//       `}</style>

//       {loading && <div className="rf-loader"><div className="rf-spinner" /></div>}

//       <div className="rf-root">
//         {/* ═══ HEADER ═══ */}
//         <div className="rf-header">
//           <div className="rf-header-top">
//             <span className="rf-title">Refund Claims Manager</span>
//             <span className="rf-subtitle">Manage refund eligibility, project approvals, and claim processing</span>
//           </div>
//           <div className="rf-chips">
//             {chips.map(chip => (
//               <button key={chip.label} className={`rf-chip${status === chip.key ? ' active' : ''}`}
//                 style={status !== chip.key ? { color: chip.color, borderColor: '#e2e8f0' } : {}}
//                 onClick={() => { setStatus(chip.key); setPage(1); }}>
//                 {chip.label}: {chip.count}
//               </button>
//             ))}
//           </div>
//         </div>

//         {/* ═══ FILTERS ═══ */}
//         <div className="rf-filters">
//           <div className="rf-search-box">
//             <SvgIcon d={ICONS.search} size={13} color="#6b8f8a" style={{ marginLeft: 8, flexShrink: 0 }} />
//             <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
//               onKeyDown={e => e.key === 'Enter' && doSearch()}
//               placeholder="Search name, email, phone, internship, payment ID..." />
//           </div>
//           <select className="rf-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
//             <option value="">All Status</option>
//             {Object.entries(STATUS_BADGE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
//           </select>
//           <select className="rf-select" value={batch} onChange={e => { setBatch(e.target.value); setPage(1); }}>
//             <option value="">All Batches</option>
//             {batches.map(b => <option key={b} value={b}>{b}</option>)}
//           </select>
//           <select className="rf-select" value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}>
//             {[5, 10, 25, 50].map(n => <option key={n} value={n}>{n} per page</option>)}
//           </select>
//           <button className="rf-btn rf-btn-teal" onClick={doSearch}>Search</button>
//           <button className="rf-btn rf-btn-outline" onClick={doClear}>Clear</button>
//         </div>

//         {/* ═══ TABLE ═══ */}
//         <div className="rf-body">
//           <div className="rf-card">
//             <div className="rf-table-wrap">
//               <table className="rf-t">
//                 <thead>
//                   <tr>
//                     {['#', 'Student', 'Contact', 'Internship', 'Duration', 'Batch', 'Paid At', 'Attendance',
//                       'Project', 'Claim Status', 'Payment ID', 'Refund Action', 'Project Action'].map(h => (
//                         <th key={h}>{h}</th>
//                       ))}
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {!loading && data.length === 0 ? (
//                     <tr><td colSpan={13} className="rf-no-data">No refund records found</td></tr>
//                   ) : data.map((row, i) => {
//                     const claimBadge = row.refund_claim_status
//                       ? STATUS_BADGE[row.refund_claim_status] || STATUS_BADGE.active
//                       : STATUS_BADGE.active;
//                     const projBadge = row.project_status ? PROJECT_BADGE[row.project_status] : null;
//                     const isHighlight = row.refund_claim_status === 'under_review';
//                     const att = parseFloat(row.attendance) || 0;

//                     return (
//                       <tr key={`${row.user_id}-${row.internship_id}-${i}`} className={isHighlight ? 'rf-highlight' : ''}>
//                         {/* # */}
//                         <td style={{ color: '#6b8f8a', fontSize: 10 }}>{(page - 1) * perPage + i + 1}</td>

//                         {/* Student */}
//                         <td>
//                           <div style={{ fontWeight: 600, color: '#0d2137', fontSize: 12 }}>{row.name}</div>
//                           <div style={{ fontSize: 10, color: '#6b8f8a' }}>{row.email}</div>
//                         </td>

//                         {/* Contact */}
//                         <td style={{ fontSize: 11, color: '#475569' }}>{row.contact || '—'}</td>

//                         {/* Internship */}
//                         <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.internship_name || '—'}</td>

//                         {/* Duration */}
//                         <td>{row.duration || '—'}</td>

//                         {/* Batch */}
//                         <td style={{ fontSize: 10.5 }}>{row.batch || '—'}</td>

//                         {/* Paid At */}
//                         <td style={{ fontSize: 10.5 }}>{fmtDate(row.paid_at)}</td>

//                         {/* Attendance */}
//                         <td>
//                           <span className="rf-att-badge" style={{ background: attBg(att), color: attColor(att) }}>
//                             {att}%
//                           </span>
//                         </td>

//                         {/* Project */}
//                         <td>
//                           {projBadge ? (
//                             <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
//                               <span className="rf-badge" style={{ background: projBadge.bg, color: projBadge.color }}>
//                                 {projBadge.label}
//                               </span>
//                               {row.file_link && (
//                                 <a href={row.file_link} target="_blank" rel="noopener noreferrer"
//                                   title="View submission" style={{ color: '#00bfa6', display: 'inline-flex' }}>
//                                   <SvgIcon d={ICONS.link} size={12} />
//                                 </a>
//                               )}
//                             </span>
//                           ) : <span style={{ color: '#9ca3af', fontSize: 10 }}>—</span>}
//                         </td>

//                         {/* Claim Status */}
//                         <td>
//                           <span className="rf-badge" style={{ background: claimBadge.bg, color: claimBadge.color }}>
//                             {row.refund_claim_status
//                               ? (STATUS_BADGE[row.refund_claim_status]?.label || row.refund_claim_status)
//                               : 'Active'}
//                           </span>
//                         </td>

//                         {/* Payment ID */}
//                         <td>
//                           {row.payment_id ? (
//                             <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
//                               <span style={{ fontSize: 10, color: '#0d2137', fontWeight: 500 }}>{row.payment_id}</span>
//                               <button className="rf-copy-btn" onClick={() => copyToClipboard(row.payment_id)} title="Copy">
//                                 <SvgIcon d={ICONS.copy} size={11} />
//                               </button>
//                             </span>
//                           ) : <span style={{ color: '#9ca3af', fontSize: 10 }}>N/A</span>}
//                         </td>

//                         {/* Refund Action */}
//                         <td>
//                           {row.refund_claim_status === 'refunded' ? (
//                             <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
//                               <span className="rf-badge" style={{ background: '#e8f5e9', color: '#2e7d32' }}>
//                                 ✓ Refunded
//                               </span>
//                               {(row.proof_url || row.proof) && (
//                                 <a href={row.proof_url || row.proof} target="_blank" rel="noopener"
//                                   className="rf-btn rf-btn-sm rf-btn-gray" style={{ textDecoration: 'none', marginTop: 2 }}>
//                                   <SvgIcon d={ICONS.file} size={10} /> Proof
//                                 </a>
//                               )}
//                             </div>
//                           ) : row.refund_claim_status === 'rejected' ? (
//                             <span className="rf-badge" style={{ background: '#ffebee', color: '#c62828' }}>✕ Rejected</span>
//                           ) : (
//                             <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
//                               <button
//                                 className="rf-btn rf-btn-teal rf-btn-sm"
//                                 disabled={row.refund_claim_status !== 'under_review'}
//                                 onClick={() => row.refund_claim_status === 'under_review' && setConfirmModal({
//                                   user_id: row.user_id, internship_id: row.internship_id,
//                                   name: row.name, email: row.email, internship_name: row.internship_name,
//                                   adminNotes: row.admin_notes || '', proofUrl: '', proofFile: null, skipEmail: false
//                                 })}>
//                                 Confirm Refund
//                               </button>
//                               <button
//                                 className="rf-btn rf-btn-red rf-btn-sm"
//                                 disabled={row.refund_claim_status !== 'under_review'}
//                                 onClick={() => row.refund_claim_status === 'under_review' && setRejectModal({
//                                   user_id: row.user_id, internship_id: row.internship_id,
//                                   name: row.name, email: row.email, internship_name: row.internship_name,
//                                   adminNotes: '', skipEmail: false,
//                                   emailSubject: `Refund Claim Update – Internship Studio`,
//                                   emailBody: `<p>Dear <strong>${row.name}</strong>,</p><p>After careful review, we regret to inform you that your refund claim for <strong>${row.internship_name}</strong> could not be approved at this time.</p><p><strong>Reason:</strong> </p><p>Best regards,<br/>Internship Studio Team</p>`
//                                 })}>
//                                 Reject
//                               </button>
//                             </div>
//                           )}
//                         </td>

//                         {/* Project Action */}
//                         <td>
//                           {row.project_status === 'approved' ? (
//                             <span className="rf-badge" style={{ background: '#e8f5e9', color: '#2e7d32' }}>✓ Approved</span>
//                           ) : row.project_status === 'rejected' ? (
//                             <span className="rf-badge" style={{ background: '#ffebee', color: '#c62828' }}>✕ Rejected</span>
//                           ) : (
//                             <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
//                               <button
//                                 className="rf-btn rf-btn-teal rf-btn-sm"
//                                 disabled={row.project_status !== 'pending'}
//                                 onClick={() => row.project_status === 'pending' && setApproveModal({
//                                   user_id: row.user_id, internship_id: row.internship_id,
//                                   name: row.name, email: row.email, internship_name: row.internship_name,
//                                   skipEmail: false
//                                 })}>
//                                 Approve
//                               </button>
//                               <button
//                                 className="rf-btn rf-btn-red rf-btn-sm"
//                                 disabled={row.project_status !== 'pending'}
//                                 onClick={() => row.project_status === 'pending' && setDeclineModal({
//                                   user_id: row.user_id, internship_id: row.internship_id,
//                                   name: row.name, email: row.email, internship_name: row.internship_name,
//                                   reason: '', skipEmail: false,
//                                   emailSubject: `Project Submission Update – Internship Studio`,
//                                   emailBody: `<p>Dear <strong>${row.name}</strong>,</p><p>Your project for <strong>${row.internship_name}</strong> has been declined.</p><p><strong>Reason:</strong> </p><p>Best regards,<br/>Internship Studio Team</p>`
//                                 })}>
//                                 Decline
//                               </button>
//                             </div>
//                           )}
//                         </td>
//                       </tr>
//                     );
//                   })}
//                 </tbody>
//               </table>
//             </div>

//             {/* ═══ PAGINATION ═══ */}
//             <div className="rf-footer">
//               <span className="rf-page-info">
//                 {total > 0 ? `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} of ${total}` : '0 results'}
//               </span>
//               <div className="rf-pagination">
//                 <button className="rf-pg-btn" disabled={page <= 1} onClick={() => setPage(1)}>First</button>
//                 <button className="rf-pg-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
//                 {pageNums.map(p => (
//                   <button key={p} className={`rf-pg-btn${p === page ? ' active' : ''}`}
//                     onClick={() => setPage(p)}>{p}</button>
//                 ))}
//                 <button className="rf-pg-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
//                 <button className="rf-pg-btn" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last</button>
//                 <div className="rf-pg-jump">
//                   <input ref={jumpRef} type="number" min={1} max={totalPages} placeholder="Go to"
//                     onKeyDown={e => e.key === 'Enter' && jumpToPage()} />
//                   <button onClick={jumpToPage}>Go</button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* ══════════════════════ MODALS ══════════════════════ */}

//       {/* ── Confirm Refund Modal ── */}
//       {confirmModal && (
//         <div className="rf-modal-overlay" onClick={() => !actionLoading && setConfirmModal(null)}>
//           <div className="rf-modal-box" onClick={e => e.stopPropagation()}>
//             <div className="rf-modal-head">
//               <h5>Confirm Refund</h5>
//               <button className="rf-modal-close" onClick={() => !actionLoading && setConfirmModal(null)}>
//                 <SvgIcon d={ICONS.x} size={16} />
//               </button>
//             </div>
//             <div className="rf-modal-body">
//               <p style={{ fontSize: 12, color: '#0d2137', margin: '0 0 12px' }}>
//                 Confirm refund for <strong>{confirmModal.name}</strong> — <em>{confirmModal.internship_name}</em>
//               </p>

//               <div className="rf-field">
//                 <label>Email Preview</label>
//                 <div className="rf-email-preview">
//                   <strong>To:</strong> {confirmModal.email}<br />
//                   <strong>Subject:</strong> Your Refund Has Been Processed – Internship Studio<br /><br />
//                   Dear {confirmModal.name},<br /><br />
//                   Your refund for the internship <strong>{confirmModal.internship_name}</strong> has been successfully processed.
//                   The refund amount will be credited to your original payment method within 5-7 business days.
//                 </div>
//               </div>

//               <label className="rf-checkbox" style={{ marginBottom: 12 }}>
//                 <input type="checkbox" checked={confirmModal.skipEmail}
//                   onChange={e => setConfirmModal(m => ({ ...m, skipEmail: e.target.checked }))} />
//                 Skip sending email notification
//               </label>

//               <div className="rf-field">
//                 <label>Admin Notes</label>
//                 <textarea value={confirmModal.adminNotes} placeholder="Optional notes about this refund..."
//                   onChange={e => setConfirmModal(m => ({ ...m, adminNotes: e.target.value }))} />
//               </div>

//               <div className="rf-field">
//                 <label>Proof of Refund (optional)</label>
//                 <div className="rf-drop-zone" onClick={() => document.getElementById('rf-proof-input')?.click()}
//                   onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag'); }}
//                   onDragLeave={e => e.currentTarget.classList.remove('drag')}
//                   onDrop={e => {
//                     e.preventDefault(); e.currentTarget.classList.remove('drag');
//                     const f = e.dataTransfer.files[0]; if (f) setConfirmModal(m => ({ ...m, proofFile: f }));
//                   }}>
//                   <SvgIcon d={ICONS.upload} size={20} color="#00bfa6" />
//                   <p>Click or drag file to upload proof</p>
//                   <input id="rf-proof-input" type="file" style={{ display: 'none' }} accept="image/*,.pdf"
//                     onChange={e => { const f = e.target.files[0]; if (f) setConfirmModal(m => ({ ...m, proofFile: f })); }} />
//                 </div>
//                 {confirmModal.proofFile && (
//                   <div className="rf-file-preview">
//                     <SvgIcon d={ICONS.file} size={14} color="#00bfa6" />
//                     <span style={{ flex: 1 }}>{confirmModal.proofFile.name}</span>
//                     <button className="rf-modal-close" onClick={() => setConfirmModal(m => ({ ...m, proofFile: null }))}>
//                       <SvgIcon d={ICONS.x} size={12} />
//                     </button>
//                   </div>
//                 )}
//               </div>
//             </div>
//             <div className="rf-modal-foot">
//               <button className="rf-btn rf-btn-outline" onClick={() => setConfirmModal(null)} disabled={actionLoading}>Cancel</button>
//               <button className="rf-btn rf-btn-teal" onClick={() => handleConfirmRefund(confirmModal)} disabled={actionLoading}>
//                 {actionLoading ? 'Processing...' : 'Confirm Refund'}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── Reject Refund Modal ── */}
//       {rejectModal && (
//         <div className="rf-modal-overlay" onClick={() => !actionLoading && setRejectModal(null)}>
//           <div className="rf-modal-box" onClick={e => e.stopPropagation()}>
//             <div className="rf-modal-head">
//               <h5>Reject Refund Claim</h5>
//               <button className="rf-modal-close" onClick={() => !actionLoading && setRejectModal(null)}>
//                 <SvgIcon d={ICONS.x} size={16} />
//               </button>
//             </div>
//             <div className="rf-modal-body">
//               <p style={{ fontSize: 12, color: '#0d2137', margin: '0 0 12px' }}>
//                 Reject refund claim for <strong>{rejectModal.name}</strong> — <em>{rejectModal.internship_name}</em>
//               </p>

//               <div className="rf-field">
//                 <label>Rejection Notes</label>
//                 <textarea value={rejectModal.adminNotes} placeholder="Reason for rejection..."
//                   onChange={e => setRejectModal(m => ({ ...m, adminNotes: e.target.value }))} />
//               </div>

//               <label className="rf-checkbox" style={{ marginBottom: 12 }}>
//                 <input type="checkbox" checked={rejectModal.skipEmail}
//                   onChange={e => setRejectModal(m => ({ ...m, skipEmail: e.target.checked }))} />
//                 Skip sending email notification
//               </label>

//               {!rejectModal.skipEmail && (
//                 <>
//                   <div className="rf-field">
//                     <label>Email Subject</label>
//                     <input value={rejectModal.emailSubject}
//                       onChange={e => setRejectModal(m => ({ ...m, emailSubject: e.target.value }))} />
//                   </div>
//                   <div className="rf-field">
//                     <label>Email Body (HTML)</label>
//                     <textarea value={rejectModal.emailBody} style={{ minHeight: 120 }}
//                       onChange={e => setRejectModal(m => ({ ...m, emailBody: e.target.value }))} />
//                   </div>
//                 </>
//               )}
//             </div>
//             <div className="rf-modal-foot">
//               <button className="rf-btn rf-btn-outline" onClick={() => setRejectModal(null)} disabled={actionLoading}>Cancel</button>
//               <button className="rf-btn rf-btn-red" onClick={() => handleRejectRefund(rejectModal)} disabled={actionLoading}>
//                 {actionLoading ? 'Processing...' : 'Reject Claim'}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── Approve Project Modal ── */}
//       {approveModal && (
//         <div className="rf-modal-overlay" onClick={() => !actionLoading && setApproveModal(null)}>
//           <div className="rf-modal-box" onClick={e => e.stopPropagation()}>
//             <div className="rf-modal-head">
//               <h5>Approve Project</h5>
//               <button className="rf-modal-close" onClick={() => !actionLoading && setApproveModal(null)}>
//                 <SvgIcon d={ICONS.x} size={16} />
//               </button>
//             </div>
//             <div className="rf-modal-body">
//               <p style={{ fontSize: 12, color: '#0d2137', margin: '0 0 12px' }}>
//                 Approve project submission for <strong>{approveModal.name}</strong> — <em>{approveModal.internship_name}</em>
//               </p>

//               <div className="rf-field">
//                 <label>Email Preview</label>
//                 <div className="rf-email-preview">
//                   <strong>To:</strong> {approveModal.email}<br />
//                   <strong>Subject:</strong> Your Project Has Been Approved – Internship Studio<br /><br />
//                   Dear {approveModal.name},<br /><br />
//                   Congratulations! Your project submission for the internship <strong>{approveModal.internship_name}</strong> has been approved.
//                   You are now one step closer to completing your internship and becoming eligible for a refund.
//                 </div>
//               </div>

//               <label className="rf-checkbox">
//                 <input type="checkbox" checked={approveModal.skipEmail}
//                   onChange={e => setApproveModal(m => ({ ...m, skipEmail: e.target.checked }))} />
//                 Skip sending email notification
//               </label>
//             </div>
//             <div className="rf-modal-foot">
//               <button className="rf-btn rf-btn-outline" onClick={() => setApproveModal(null)} disabled={actionLoading}>Cancel</button>
//               <button className="rf-btn rf-btn-teal" onClick={() => handleApproveProject(approveModal)} disabled={actionLoading}>
//                 {actionLoading ? 'Processing...' : 'Approve Project'}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── Decline Project Modal ── */}
//       {declineModal && (
//         <div className="rf-modal-overlay" onClick={() => !actionLoading && setDeclineModal(null)}>
//           <div className="rf-modal-box" onClick={e => e.stopPropagation()}>
//             <div className="rf-modal-head">
//               <h5>Decline Project</h5>
//               <button className="rf-modal-close" onClick={() => !actionLoading && setDeclineModal(null)}>
//                 <SvgIcon d={ICONS.x} size={16} />
//               </button>
//             </div>
//             <div className="rf-modal-body">
//               <p style={{ fontSize: 12, color: '#0d2137', margin: '0 0 12px' }}>
//                 Decline project submission for <strong>{declineModal.name}</strong> — <em>{declineModal.internship_name}</em>
//               </p>

//               <div className="rf-field">
//                 <label>Decline Reason</label>
//                 <textarea value={declineModal.reason} placeholder="Reason for declining the project..."
//                   onChange={e => setDeclineModal(m => ({ ...m, reason: e.target.value }))} />
//               </div>

//               <label className="rf-checkbox" style={{ marginBottom: 12 }}>
//                 <input type="checkbox" checked={declineModal.skipEmail}
//                   onChange={e => setDeclineModal(m => ({ ...m, skipEmail: e.target.checked }))} />
//                 Skip sending email notification
//               </label>

//               {!declineModal.skipEmail && (
//                 <>
//                   <div className="rf-field">
//                     <label>Email Subject</label>
//                     <input value={declineModal.emailSubject}
//                       onChange={e => setDeclineModal(m => ({ ...m, emailSubject: e.target.value }))} />
//                   </div>
//                   <div className="rf-field">
//                     <label>Email Body (HTML)</label>
//                     <textarea value={declineModal.emailBody} style={{ minHeight: 120 }}
//                       onChange={e => setDeclineModal(m => ({ ...m, emailBody: e.target.value }))} />
//                   </div>
//                 </>
//               )}
//             </div>
//             <div className="rf-modal-foot">
//               <button className="rf-btn rf-btn-outline" onClick={() => setDeclineModal(null)} disabled={actionLoading}>Cancel</button>
//               <button className="rf-btn rf-btn-red" onClick={() => handleDeclineProject(declineModal)} disabled={actionLoading}>
//                 {actionLoading ? 'Processing...' : 'Decline Project'}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── Upload Proof Modal ── */}
//       {proofModal && (
//         <div className="rf-modal-overlay" onClick={() => !actionLoading && setProofModal(null)}>
//           <div className="rf-modal-box" onClick={e => e.stopPropagation()}>
//             <div className="rf-modal-head">
//               <h5>Upload Refund Proof</h5>
//               <button className="rf-modal-close" onClick={() => !actionLoading && setProofModal(null)}>
//                 <SvgIcon d={ICONS.x} size={16} />
//               </button>
//             </div>
//             <div className="rf-modal-body">
//               <div className="rf-drop-zone" onClick={() => document.getElementById('rf-proof-upload-input')?.click()}
//                 onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag'); }}
//                 onDragLeave={e => e.currentTarget.classList.remove('drag')}
//                 onDrop={e => {
//                   e.preventDefault(); e.currentTarget.classList.remove('drag');
//                   const f = e.dataTransfer.files[0]; if (f) setProofModal(m => ({ ...m, file: f }));
//                 }}>
//                 <SvgIcon d={ICONS.upload} size={24} color="#00bfa6" />
//                 <p>Click or drag file to upload proof of refund</p>
//                 <p style={{ fontSize: 10, color: '#9ca3af' }}>Supports images and PDF files</p>
//                 <input id="rf-proof-upload-input" type="file" style={{ display: 'none' }} accept="image/*,.pdf"
//                   onChange={e => { const f = e.target.files[0]; if (f) setProofModal(m => ({ ...m, file: f })); }} />
//               </div>
//               {proofModal.file && (
//                 <div className="rf-file-preview">
//                   <SvgIcon d={ICONS.file} size={14} color="#00bfa6" />
//                   <span style={{ flex: 1 }}>{proofModal.file.name}</span>
//                   <span style={{ fontSize: 10, color: '#6b8f8a' }}>{(proofModal.file.size / 1024).toFixed(1)} KB</span>
//                   <button className="rf-modal-close" onClick={() => setProofModal(m => ({ ...m, file: null }))}>
//                     <SvgIcon d={ICONS.x} size={12} />
//                   </button>
//                 </div>
//               )}
//             </div>
//             <div className="rf-modal-foot">
//               <button className="rf-btn rf-btn-outline" onClick={() => setProofModal(null)} disabled={actionLoading}>Cancel</button>
//               <button className="rf-btn rf-btn-teal" onClick={() => handleUploadProof(proofModal)} disabled={actionLoading}>
//                 {actionLoading ? 'Uploading...' : 'Upload Proof'}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }



import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

/* ─── status maps ─── */
const CLAIM_STYLE = {
  active:            { bg: '#f1f5f9', color: '#64748b',  border: '#e2e8f0', dot: '#94a3b8',  label: 'Active' },
  under_review:      { bg: '#fff7ed', color: '#c2410c',  border: '#fed7aa', dot: '#fb923c',  label: 'Claim Requested' },
  refunded:          { bg: '#f0fdf4', color: '#15803d',  border: '#bbf7d0', dot: '#22c55e',  label: 'Refunded' },
  rejected:          { bg: '#fef2f2', color: '#b91c1c',  border: '#fecaca', dot: '#ef4444',  label: 'Rejected' },
  completed:         { bg: '#ede9fe', color: '#5b21b6',  border: '#c4b5fd', dot: '#8b5cf6',  label: 'Completed' },
  project_submitted: { bg: '#fef3c7', color: '#92400e',  border: '#fde68a', dot: '#f59e0b',  label: 'Proj Submitted' },
  project_approved:  { bg: '#f0fdf4', color: '#15803d',  border: '#bbf7d0', dot: '#22c55e',  label: 'Proj Approved' },
  project_rejected:  { bg: '#fef2f2', color: '#b91c1c',  border: '#fecaca', dot: '#ef4444',  label: 'Proj Rejected' },
};
const PROJ_STYLE = {
  pending:  { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', dot: '#fb923c', label: 'Pending' },
  approved: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#22c55e', label: 'Approved' },
  rejected: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', dot: '#ef4444', label: 'Rejected' },
};

const Ico = ({ d, size = 13, color = 'currentColor', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d={d} />
  </svg>
);
const P = {
  search: 'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
  x:      'M18 6 6 18M6 6l12 12',
  copy:   'M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-4-4H8zM14 2v6h6',
  file:   'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  link:   'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  mail:   'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6',
  check:  'M20 6 9 17l-5-5',
  eye:    'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  down:   'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
};

/* ── Proof circle thumbnail + popup ── */
function ProofAvatar({ url }) {
  const [open, setOpen] = useState(false);
  if (!url) return <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>;
  const clean = String(url).trim();
  /* only hosted http(s) links can be opened; file:// / local paths cannot */
  const viewable = /^https?:\/\//i.test(clean);
  const isImg = viewable && /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(clean);
  const badMsg = `Not viewable — this is a local/invalid path, not a hosted link:\n${clean}\n\nIt is a file on someone's own computer and cannot be opened from here.`;
  return (
    <>
      <div onClick={() => setOpen(true)} title={viewable ? 'View proof' : badMsg}
        style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${viewable ? '#c4b5fd' : '#fca5a5'}`, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: viewable ? '#ede9fe' : '#fee2e2', transition: 'transform .15s, border-color .15s', flexShrink: 0 }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.12)'; e.currentTarget.style.borderColor = viewable ? '#7c3aed' : '#ef4444'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';    e.currentTarget.style.borderColor = viewable ? '#c4b5fd' : '#fca5a5'; }}>
        {isImg
          ? <img src={clean} alt="proof" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <Ico d={P.file} size={14} color={viewable ? '#7c3aed' : '#dc2626'} />}
      </div>
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.75)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', width: '90vw', maxWidth: '90vw', height: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 70px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Ico d={P.eye} size={13} color="#fff" /> Payment Proof
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {viewable && (
                  <a href={clean} target="_blank" rel="noopener"
                    style={{ fontSize: 11, color: '#fff', opacity: .85, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', textDecoration: 'none' }}>
                    Open ↗
                  </a>
                )}
                <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            </div>
            <div style={{ background: '#0f172a', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, overflow: 'auto' }}>
              {isImg ? (
                <img src={clean} alt="Payment proof" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 10, objectFit: 'contain', display: 'block' }} />
              ) : viewable ? (
                <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                  <Ico d={P.file} size={48} color="#6366f1" style={{ marginBottom: 12 }} />
                  <p style={{ fontSize: 12 }}>Cannot preview this file type.</p>
                  <a href={clean} target="_blank" rel="noopener"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, background: '#4f46e5', color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none', marginTop: 10 }}>
                    Open File
                  </a>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#94a3b8', maxWidth: 560 }}>
                  <Ico d={P.file} size={48} color="#ef4444" style={{ marginBottom: 12 }} />
                  <p style={{ fontSize: 14, color: '#fca5a5', fontWeight: 700 }}>This file cannot be opened</p>
                  <p style={{ fontSize: 12, marginTop: 8, wordBreak: 'break-all', color: '#cbd5e1' }}>{clean}</p>
                  <p style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.7 }}>
                    It is a local file path (<code>file://</code>) on someone's own computer — not a hosted link.
                    No website can open it. Ask the student to upload the file and submit a public URL
                    (Google Drive, GitHub, Netlify, etc.).
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Action Buttons ── */
function RefundActions({ row, onConfirm, onReject }) {
  const st = row.refund_claim_status;
  if (st === 'refunded') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontSize: 10.5, fontWeight: 700 }}>
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
      Refunded
    </span>
  );
  if (st === 'rejected') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontSize: 10.5, fontWeight: 700 }}>
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      Rejected
    </span>
  );
  const active = st === 'under_review';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button onClick={() => active && onConfirm(row)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: active ? 'pointer' : 'not-allowed', border: 'none', fontFamily: 'inherit', transition: 'all .15s', background: active ? '#dcfce7' : '#f1f5f9', color: active ? '#15803d' : '#94a3b8', opacity: active ? 1 : 0.6 }}
        onMouseEnter={e => active && (e.currentTarget.style.background = '#16a34a', e.currentTarget.style.color = '#fff')}
        onMouseLeave={e => active && (e.currentTarget.style.background = '#dcfce7', e.currentTarget.style.color = '#15803d')}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        Confirm Refund
      </button>
      <button onClick={() => active && onReject(row)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: active ? 'pointer' : 'not-allowed', border: 'none', fontFamily: 'inherit', transition: 'all .15s', background: active ? '#fee2e2' : '#f1f5f9', color: active ? '#b91c1c' : '#94a3b8', opacity: active ? 1 : 0.6 }}
        onMouseEnter={e => active && (e.currentTarget.style.background = '#dc2626', e.currentTarget.style.color = '#fff')}
        onMouseLeave={e => active && (e.currentTarget.style.background = '#fee2e2', e.currentTarget.style.color = '#b91c1c')}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        Reject
      </button>
    </div>
  );
}

function ProjectActions({ row, onApprove, onDecline }) {
  const st = row.project_status;
  if (st === 'approved') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontSize: 10.5, fontWeight: 700 }}>
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
      Approved
    </span>
  );
  if (st === 'rejected') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontSize: 10.5, fontWeight: 700 }}>
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      Rejected
    </span>
  );
  const active = st === 'pending';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button onClick={() => active && onApprove(row)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: active ? 'pointer' : 'not-allowed', border: 'none', fontFamily: 'inherit', transition: 'all .15s', background: active ? '#ede9fe' : '#f1f5f9', color: active ? '#5b21b6' : '#94a3b8', opacity: active ? 1 : 0.6 }}
        onMouseEnter={e => active && (e.currentTarget.style.background = '#4f46e5', e.currentTarget.style.color = '#fff')}
        onMouseLeave={e => active && (e.currentTarget.style.background = '#ede9fe', e.currentTarget.style.color = '#5b21b6')}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        Approve
      </button>
      <button onClick={() => active && onDecline(row)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: active ? 'pointer' : 'not-allowed', border: 'none', fontFamily: 'inherit', transition: 'all .15s', background: active ? '#fee2e2' : '#f1f5f9', color: active ? '#b91c1c' : '#94a3b8', opacity: active ? 1 : 0.6 }}
        onMouseEnter={e => active && (e.currentTarget.style.background = '#dc2626', e.currentTarget.style.color = '#fff')}
        onMouseLeave={e => active && (e.currentTarget.style.background = '#fee2e2', e.currentTarget.style.color = '#b91c1c')}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        Decline
      </button>
    </div>
  );
}

/* ── Modal wrapper ── */
function Modal({ title, onClose, children, footer, loading }) {
  return (
    <div onClick={() => !loading && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, boxShadow: '0 25px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 18px', borderBottom: '1.5px solid #f5f3ff', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1.5px solid #f5f3ff' }}>{footer}</div>}
      </div>
    </div>
  );
}

const Btn = ({ label, color = 'indigo', onClick, loading, disabled }) => {
  const C = {
    indigo: ['#4f46e5','#4338ca'],
    red:    ['#dc2626','#b91c1c'],
    gray:   ['#f1f5f9','#e2e8f0'],
  };
  const [bg, hbg] = C[color];
  const [hover, setHover] = useState(false);
  const isGray = color === 'gray';
  return (
    <button onClick={onClick} disabled={disabled || loading}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: disabled || loading ? 'not-allowed' : 'pointer', border: 'none', fontFamily: 'inherit', background: hover ? hbg : bg, color: isGray ? '#475569' : '#fff', opacity: disabled ? .5 : 1, transition: 'all .15s' }}>
      {loading ? 'Processing…' : label}
    </button>
  );
};

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 13 }}>
    <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#4f46e5', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
    {children}
  </div>
);

const inputStyle = { width: '100%', padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', outline: 'none', color: '#1e293b', background: '#faf9ff', boxSizing: 'border-box' };

const LIMIT = 20;

export default function RefundList() {
  const [data,         setData]         = useState([]);
  const [total,        setTotal]        = useState(0);
  const [totalPages,   setTotalPages]   = useState(1);
  const [stats,        setStats]        = useState({});
  const [batches,      setBatches]      = useState([]);
  const [page,         setPage]         = useState(1);
  const [perPage,      setPerPage]      = useState(LIMIT);
  const [searchInput,  setSearchInput]  = useState('');
  const [search,       setSearch]       = useState('');
  const [status,       setStatus]       = useState('');
  const [batch,        setBatch]        = useState('');
  const [loading,      setLoading]      = useState(true);
  const [actionLoading,setActionLoading]= useState(false);
  const jumpRef = useRef(null);

  /* modals */
  const [confirmModal,  setConfirmModal]  = useState(null);
  const [rejectModal,   setRejectModal]   = useState(null);
  const [approveModal,  setApproveModal]  = useState(null);
  const [declineModal,  setDeclineModal]  = useState(null);

  /* ── fetch ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/refunds/list.php', {
        params: { page, per_page: perPage, search, status, batch }
      });
      if (res.data.success) {
        const d = res.data.data;
        setData(d.refunds || []);
        setTotal(d.total || 0);
        setTotalPages(d.total_pages || 1);
        if (d.stats)   setStats(d.stats);
        if (d.batches) setBatches(d.batches);
      }
    } catch {} finally { setLoading(false); }
  }, [page, perPage, search, status, batch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── real-time row patch ── */
  const patchRow = (user_id, internship_id, patch) => {
    setData(prev => prev.map(r =>
      r.user_id === user_id && r.internship_id === internship_id ? { ...r, ...patch } : r
    ));
  };

  /* ── API calls ── */
  const callApi = async (body) => api.post('/api/refunds/list.php', body);

  const handleConfirmRefund = async (m) => {
    setActionLoading(true);
    try {
      let proofUrl = m.proofUrl || '';
      if (m.proofFile) {
        const fd = new FormData(); fd.append('action','upload_proof'); fd.append('proof', m.proofFile);
        const r = await api.post('/api/refunds/list.php', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        proofUrl = r.data?.data?.url || '';
      }
      await callApi({ action:'update_refund_claim', user_id:m.user_id, internship_id:m.internship_id, status:'refunded', admin_notes:m.adminNotes, proof_url:proofUrl });
      patchRow(m.user_id, m.internship_id, { refund_claim_status:'refunded', proof_url:proofUrl });
      toast.success('Refund confirmed');
      setConfirmModal(null);
    } catch { toast.error('Failed to confirm refund'); }
    finally { setActionLoading(false); }
  };

  const handleRejectRefund = async (m) => {
    setActionLoading(true);
    try {
      await callApi({ action:'update_refund_claim', user_id:m.user_id, internship_id:m.internship_id, status:'rejected', admin_notes:m.adminNotes });
      patchRow(m.user_id, m.internship_id, { refund_claim_status:'rejected' });
      toast.success('Claim rejected');
      setRejectModal(null);
    } catch { toast.error('Failed to reject'); }
    finally { setActionLoading(false); }
  };

  const handleApproveProject = async (m) => {
    setActionLoading(true);
    try {
      await callApi({ action:'approve_project', user_id:m.user_id, internship_id:m.internship_id });
      patchRow(m.user_id, m.internship_id, { project_status:'approved' });
      toast.success('Project approved');
      setApproveModal(null);
    } catch { toast.error('Failed to approve'); }
    finally { setActionLoading(false); }
  };

  const handleDeclineProject = async (m) => {
    setActionLoading(true);
    try {
      await callApi({ action:'decline_project', user_id:m.user_id, internship_id:m.internship_id, reason:m.reason });
      patchRow(m.user_id, m.internship_id, { project_status:'rejected' });
      toast.success('Project declined');
      setDeclineModal(null);
    } catch { toast.error('Failed to decline'); }
    finally { setActionLoading(false); }
  };

  const doSearch  = () => { setSearch(searchInput); setPage(1); };
  const doClear   = () => { setSearchInput(''); setSearch(''); setStatus(''); setBatch(''); setPage(1); };
  const jumpToPage = () => {
    const v = parseInt(jumpRef.current?.value);
    if (v >= 1 && v <= totalPages) setPage(v); else toast.error('Invalid page');
  };

  const fmtDate = d => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }); } catch { return d; } };
  const attColor = v => v >= 100 ? '#15803d' : v >= 50 ? '#c2410c' : '#b91c1c';
  const attBg    = v => v >= 100 ? '#f0fdf4' : v >= 50 ? '#fff7ed' : '#fef2f2';

  const pageNums = (() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3)               return [1,2,3,4,5];
    if (page >= totalPages - 2)  return [totalPages-4,totalPages-3,totalPages-2,totalPages-1,totalPages];
    return [page-2,page-1,page,page+1,page+2];
  })();

  const chips = [
    { key:'',                  label:'Total',           count: stats.total || 0,              accent:'#4f46e5' },
    { key:'active',            label:'Active',          count: stats.active || 0,             accent:'#64748b' },
    { key:'completed',         label:'Completed',       count: stats.completed || 0,          accent:'#7c3aed' },
    { key:'under_review',      label:'Claim Requested', count: stats.under_review || 0,       accent:'#c2410c' },
    { key:'refunded',          label:'Refunded',        count: stats.refunded || 0,           accent:'#15803d' },
    { key:'rejected',          label:'Rejected',        count: stats.rejected || 0,           accent:'#b91c1c' },
    { key:'project_submitted', label:'Proj Submitted',  count: stats.project_submitted || 0,  accent:'#92400e' },
    { key:'project_approved',  label:'Proj Approved',   count: stats.project_approved || 0,   accent:'#15803d' },
    { key:'project_rejected',  label:'Proj Rejected',   count: stats.project_rejected || 0,   accent:'#b91c1c' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .rl-root{font-family:'Plus Jakarta Sans',sans-serif;height:100vh;display:flex;flex-direction:column;background:#f5f3ff;overflow:hidden;}
        .rl-hd{flex-shrink:0;background:#fff;border-bottom:1.5px solid #ede9fe;padding:8px 18px;}
        .rl-hd-top{display:flex;align-items:center;gap:10px;margin-bottom:7px;}
        .rl-title{font-size:14px;font-weight:700;color:#1e293b;}
        .rl-sub{font-size:10.5px;color:#94a3b8;}
        .rl-chips{display:flex;flex-wrap:wrap;gap:5px;}
        .rl-chip{padding:3px 10px;border-radius:20px;font-size:10px;font-weight:600;border:1.5px solid #e2e8f0;cursor:pointer;transition:all .15s;background:#fff;white-space:nowrap;}
        .rl-chip.active{color:#fff !important;border-color:transparent !important;}
        .rl-filters{flex-shrink:0;background:#fff;border-bottom:1.5px solid #ede9fe;padding:6px 18px;display:flex;flex-wrap:wrap;align-items:center;gap:7px;}
        .rl-search{display:flex;align-items:center;background:#faf9ff;border:1.5px solid #e2e8f0;border-radius:8px;overflow:hidden;flex:1;max-width:320px;min-width:200px;}
        .rl-search input{flex:1;border:none;background:transparent;padding:5px 9px;font-size:11.5px;font-family:inherit;outline:none;color:#1e293b;}
        .rl-search input::placeholder{color:#94a3b8;}
        .rl-search button{background:none;border:none;cursor:pointer;padding:0 8px;color:#94a3b8;display:flex;align-items:center;transition:color .15s;}
        .rl-search button:hover{color:#4f46e5;}
        .rl-sel{padding:5px 9px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:11.5px;font-family:inherit;outline:none;color:#1e293b;background:#faf9ff;cursor:pointer;}
        .rl-btn-p{display:inline-flex;align-items:center;gap:4px;padding:5px 13px;border-radius:8px;font-size:11.5px;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:all .15s;background:#4f46e5;color:#fff;}
        .rl-btn-p:hover{background:#4338ca;}
        .rl-btn-o{display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border-radius:8px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;background:#f1f5f9;color:#475569;border:1.5px solid #e2e8f0;}
        .rl-btn-o:hover{background:#e2e8f0;}
        .rl-body{flex:1;overflow:hidden;display:flex;flex-direction:column;padding:10px 18px 10px;}
        .rl-card{flex:1;overflow:hidden;display:flex;flex-direction:column;background:#fff;border-radius:12px;border:1.5px solid #ede9fe;box-shadow:0 1px 8px rgba(79,70,229,0.06);}
        .rl-tw{flex:1;overflow:auto;}
        .rl-tw::-webkit-scrollbar{width:5px;height:5px;}
        .rl-tw::-webkit-scrollbar-track{background:#f5f3ff;}
        .rl-tw::-webkit-scrollbar-thumb{background:#c4b5fd;border-radius:10px;}
        table.rl-t{width:100%;border-collapse:collapse;table-layout:auto;min-width:1300px;}
        table.rl-t thead tr{background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);}
        table.rl-t thead th{color:#fff;font-size:10px;font-weight:600;padding:9px 10px;white-space:nowrap;text-align:left;letter-spacing:.4px;text-transform:uppercase;border-right:1px solid rgba(255,255,255,0.15);}
        table.rl-t thead th:last-child{border-right:none;}
        table.rl-t tbody tr{border-bottom:1px solid #f5f3ff;transition:background .12s;}
        table.rl-t tbody tr:hover{background:#faf9ff;}
        table.rl-t tbody tr.hl{background:#fff7ed;}
        table.rl-t td{font-size:11.5px;color:#334155;padding:8px 10px;vertical-align:middle;white-space:nowrap;border-right:1px solid #f5f3ff;}
        table.rl-t td:last-child{border-right:none;}
        .pill{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;white-space:nowrap;border:1px solid;}
        .copy-btn{background:none;border:none;cursor:pointer;color:#c4b5fd;padding:0 2px;transition:color .15s;display:inline-flex;align-items:center;}
        .copy-btn:hover{color:#7c3aed;}
        .rl-footer{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:7px 14px;border-top:1.5px solid #f5f3ff;background:#faf9ff;border-radius:0 0 12px 12px;}
        .rl-pi{font-size:11px;color:#94a3b8;}
        .rl-pg{display:flex;align-items:center;gap:3px;}
        .pgb{display:inline-flex;align-items:center;justify-content:center;min-width:27px;height:25px;padding:0 5px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;background:#fff;color:#475569;font-family:inherit;transition:all .15s;}
        .pgb:hover:not(:disabled){border-color:#4f46e5;color:#4f46e5;}
        .pgb.active{background:#4f46e5;border-color:#4f46e5;color:#fff;}
        .pgb:disabled{opacity:.35;cursor:not-allowed;}
        .pgj{display:flex;align-items:center;gap:4px;}
        .pgj input{width:55px;border:1.5px solid #e2e8f0;border-radius:6px;padding:3px 5px;font-size:11px;font-family:inherit;outline:none;text-align:center;}
        .pgj input:focus{border-color:#4f46e5;}
        .pgj button{background:#4f46e5;color:#fff;border:none;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;}
        .rl-loader{position:fixed;inset:0;background:rgba(245,243,255,0.75);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(2px);}
        .rl-spin{width:36px;height:36px;border:3px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:rlspin .7s linear infinite;}
        @keyframes rlspin{to{transform:rotate(360deg);}}
        .no-data{text-align:center;padding:36px;color:#94a3b8;font-size:12px;}
        .mini-sp{width:11px;height:11px;border:2px solid rgba(0,0,0,.12);border-top-color:currentColor;border-radius:50%;animation:rlspin .5s linear infinite;display:inline-block;}
      `}</style>

      {loading && <div className="rl-loader"><div className="rl-spin" /></div>}

      <div className="rl-root">
        {/* ── HEADER ── */}
        <div className="rl-hd">
          <div className="rl-hd-top">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            <span className="rl-title">Refund Claims Manager</span>
            <span className="rl-sub">Manage refund eligibility, project approvals & claim processing</span>
          </div>
          <div className="rl-chips">
            {chips.map(c => (
              <button key={c.key}
                className={`rl-chip${status === c.key ? ' active' : ''}`}
                style={status === c.key
                  ? { background: c.accent, color: '#fff' }
                  : { color: c.accent }}
                onClick={() => { setStatus(c.key); setPage(1); }}>
                {c.label}: {(c.count || 0).toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* ── FILTERS ── */}
        <div className="rl-filters">
          <div className="rl-search">
            <Ico d={P.search} size={12} color="#94a3b8" style={{ marginLeft: 8, flexShrink: 0 }} />
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search name, email, phone, internship, payment ID…" />
            {searchInput && <button onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}><Ico d={P.x} size={12} /></button>}
          </div>
          <select className="rl-sel" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            {Object.entries(CLAIM_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="rl-sel" value={batch} onChange={e => { setBatch(e.target.value); setPage(1); }}>
            <option value="">All Batches</option>
            {batches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select className="rl-sel" value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}>
            {[10, 20, 25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
          <button className="rl-btn-p" onClick={doSearch}><Ico d={P.search} size={12} /> Search</button>
          <button className="rl-btn-o" onClick={doClear}><Ico d={P.x} size={12} /> Clear</button>
        </div>

        {/* ── TABLE ── */}
        <div className="rl-body">
          <div className="rl-card">
            <div className="rl-tw">
              <table className="rl-t">
                <thead>
                  <tr>
                    {['#','Student','Contact','Internship','Duration','Batch','Paid At','Attendance','Project','Claim Status','Payment Info','Proof','Refund Action','Project Action'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!loading && data.length === 0 && (
                    <tr><td colSpan={14} className="no-data">No refund records found</td></tr>
                  )}
                  {data.map((row, i) => {
                    const claimSt = row.refund_claim_status || 'active';
                    const cs = CLAIM_STYLE[claimSt] || CLAIM_STYLE.active;
                    const ps = row.project_status ? PROJ_STYLE[row.project_status] : null;
                    const att = parseFloat(row.attendance) || 0;
                    const isHL = claimSt === 'under_review';

                    return (
                      <tr key={`${row.user_id}-${row.internship_id}`} className={isHL ? 'hl' : ''}>
                        {/* # */}
                        <td style={{ color: '#94a3b8', fontSize: 10, textAlign: 'center' }}>
                          {(page - 1) * perPage + i + 1}
                          {isHL && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fb923c', margin: '3px auto 0', animation: 'rlspin 1s linear infinite', border: '1px solid #fed7aa' }} />}
                        </td>

                        {/* Student */}
                        <td>
                          <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 12 }}>{row.name}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>{row.email}</div>
                        </td>

                        {/* Contact */}
                        <td style={{ fontSize: 11, color: '#475569' }}>{row.contact || '—'}</td>

                        {/* Internship */}
                        <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600, color: '#1e293b', fontSize: 11.5 }}>
                          {row.internship_name || '—'}
                        </td>

                        {/* Duration */}
                        <td style={{ fontSize: 11 }}>{row.duration || '—'}</td>

                        {/* Batch */}
                        <td style={{ fontSize: 11 }}>{row.batch || '—'}</td>

                        {/* Paid At */}
                        <td style={{ fontSize: 11, color: '#64748b' }}>{fmtDate(row.paid_at)}</td>

                        {/* Attendance */}
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: attBg(att), color: attColor(att) }}>
                            {att}%
                          </span>
                        </td>

                        {/* Project */}
                        <td>
                          {ps ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span className="pill" style={{ background: ps.bg, color: ps.color, borderColor: ps.border }}>
                                <svg width="5" height="5" viewBox="0 0 6 6"><circle cx="3" cy="3" r="3" fill={ps.dot}/></svg>
                                {ps.label}
                              </span>
                              {row.file_link && (
                                /^https?:\/\//i.test(String(row.file_link).trim()) ? (
                                  <a href={String(row.file_link).trim()} target="_blank" rel="noopener" title="View file"
                                    style={{ color: '#4f46e5', display: 'inline-flex' }}>
                                    <Ico d={P.link} size={12} />
                                  </a>
                                ) : (
                                  <span
                                    title={`Not viewable — the student submitted a local/invalid path instead of a hosted link:\n${row.file_link}\n\nThis is a file on someone's own computer and cannot be opened from here. Ask the student to re-submit a public link (Google Drive, GitHub, Netlify, etc.).`}
                                    style={{ color: '#ef4444', display: 'inline-flex', cursor: 'help' }}>
                                    <Ico d={P.link} size={12} />
                                  </span>
                                )
                              )}
                            </div>
                          ) : <span style={{ color: '#cbd5e1', fontSize: 10 }}>—</span>}
                        </td>

                        {/* Claim Status */}
                        <td>
                          <span className="pill" style={{ background: cs.bg, color: cs.color, borderColor: cs.border }}>
                            <svg width="5" height="5" viewBox="0 0 6 6"><circle cx="3" cy="3" r="3" fill={cs.dot}/></svg>
                            {cs.label}
                          </span>
                        </td>

                        {/* Payment Info — green date above payment ID */}
                        <td>
                          {row.paid_at && (
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#15803d', marginBottom: 2 }}>
                              {fmtDate(row.paid_at)}
                            </div>
                          )}
                          {row.payment_id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <span style={{ fontSize: 10, color: '#1e293b', fontFamily: 'monospace', fontWeight: 600 }}>{row.payment_id}</span>
                              <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(row.payment_id); toast.success('Copied!'); }}>
                                <Ico d={P.copy} size={11} />
                              </button>
                            </div>
                          ) : <span style={{ color: '#cbd5e1', fontSize: 10 }}>—</span>}
                        </td>

                        {/* Proof */}
                        <td><ProofAvatar url={row.proof_url || row.proof} /></td>

                        {/* Refund Action */}
                        <td>
                          <RefundActions row={row}
                            onConfirm={r => setConfirmModal({ user_id:r.user_id, internship_id:r.internship_id, name:r.name, email:r.email, internship_name:r.internship_name, adminNotes:'', proofUrl:'', proofFile:null, skipEmail:false })}
                            onReject={r => setRejectModal({ user_id:r.user_id, internship_id:r.internship_id, name:r.name, email:r.email, internship_name:r.internship_name, adminNotes:'', skipEmail:false, emailSubject:`Refund Claim Update – Internship Studio`, emailBody:'' })}
                          />
                        </td>

                        {/* Project Action */}
                        <td>
                          <ProjectActions row={row}
                            onApprove={r => setApproveModal({ user_id:r.user_id, internship_id:r.internship_id, name:r.name, email:r.email, internship_name:r.internship_name, skipEmail:false })}
                            onDecline={r => setDeclineModal({ user_id:r.user_id, internship_id:r.internship_id, name:r.name, email:r.email, internship_name:r.internship_name, reason:'', skipEmail:false })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── FOOTER ── */}
            <div className="rl-footer">
              <span className="rl-pi">
                {total > 0 ? `${(page-1)*perPage+1}–${Math.min(page*perPage,total)} of ${total.toLocaleString()}` : '0 results'}
              </span>
              <div className="rl-pg">
                <button className="pgb" disabled={page<=1} onClick={() => setPage(1)}>«</button>
                <button className="pgb" disabled={page<=1} onClick={() => setPage(p => Math.max(1,p-1))}>‹</button>
                {pageNums.map(p => <button key={p} className={`pgb${p===page?' active':''}`} onClick={() => setPage(p)}>{p}</button>)}
                <button className="pgb" disabled={page>=totalPages} onClick={() => setPage(p => Math.min(totalPages,p+1))}>›</button>
                <button className="pgb" disabled={page>=totalPages} onClick={() => setPage(totalPages)}>»</button>
              </div>
              <div className="pgj">
                <input ref={jumpRef} type="number" min={1} max={totalPages} placeholder="Page"
                  onKeyDown={e => e.key==='Enter' && jumpToPage()} />
                <button onClick={jumpToPage}>Go</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ MODALS ══ */}

      {/* Confirm Refund */}
      {confirmModal && (
        <Modal title="Confirm Refund" onClose={() => !actionLoading && setConfirmModal(null)} loading={actionLoading}
          footer={<>
            <Btn label="Cancel" color="gray" onClick={() => setConfirmModal(null)} disabled={actionLoading} />
            <Btn label="Confirm Refund" onClick={() => handleConfirmRefund(confirmModal)} loading={actionLoading} />
          </>}>
          <p style={{ fontSize: 12, color: '#475569', margin: '0 0 14px', padding: '8px 12px', background: '#f5f3ff', borderRadius: 8, borderLeft: '3px solid #4f46e5' }}>
            <strong>{confirmModal.name}</strong> — {confirmModal.internship_name}
          </p>
          <Field label="Admin Notes">
            <textarea value={confirmModal.adminNotes} style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
              placeholder="Optional notes about this refund…"
              onChange={e => setConfirmModal(m => ({ ...m, adminNotes: e.target.value }))} />
          </Field>
          <Field label="Upload Proof (optional)">
            <input type="file" accept="image/*,.pdf" style={{ ...inputStyle, cursor: 'pointer' }}
              onChange={e => setConfirmModal(m => ({ ...m, proofFile: e.target.files[0] || null }))} />
            {confirmModal.proofFile && <div style={{ fontSize: 11, color: '#4f46e5', marginTop: 4 }}>📎 {confirmModal.proofFile.name}</div>}
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={confirmModal.skipEmail} onChange={e => setConfirmModal(m => ({ ...m, skipEmail: e.target.checked }))} style={{ accentColor: '#4f46e5' }} />
            Skip email notification to student
          </label>
        </Modal>
      )}

      {/* Reject Refund */}
      {rejectModal && (
        <Modal title="Reject Refund Claim" onClose={() => !actionLoading && setRejectModal(null)} loading={actionLoading}
          footer={<>
            <Btn label="Cancel" color="gray" onClick={() => setRejectModal(null)} disabled={actionLoading} />
            <Btn label="Reject Claim" color="red" onClick={() => handleRejectRefund(rejectModal)} loading={actionLoading} />
          </>}>
          <p style={{ fontSize: 12, color: '#475569', margin: '0 0 14px', padding: '8px 12px', background: '#fef2f2', borderRadius: 8, borderLeft: '3px solid #dc2626' }}>
            <strong>{rejectModal.name}</strong> — {rejectModal.internship_name}
          </p>
          <Field label="Rejection Notes *">
            <textarea value={rejectModal.adminNotes} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
              placeholder="Required: reason for rejection…"
              onChange={e => setRejectModal(m => ({ ...m, adminNotes: e.target.value }))} />
          </Field>
          <Field label="Email Subject">
            <input value={rejectModal.emailSubject} style={inputStyle}
              onChange={e => setRejectModal(m => ({ ...m, emailSubject: e.target.value }))} />
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={rejectModal.skipEmail} onChange={e => setRejectModal(m => ({ ...m, skipEmail: e.target.checked }))} style={{ accentColor: '#4f46e5' }} />
            Skip email notification
          </label>
        </Modal>
      )}

      {/* Approve Project */}
      {approveModal && (
        <Modal title="Approve Project" onClose={() => !actionLoading && setApproveModal(null)} loading={actionLoading}
          footer={<>
            <Btn label="Cancel" color="gray" onClick={() => setApproveModal(null)} disabled={actionLoading} />
            <Btn label="Approve Project" onClick={() => handleApproveProject(approveModal)} loading={actionLoading} />
          </>}>
          <p style={{ fontSize: 12, color: '#475569', margin: '0 0 14px', padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, borderLeft: '3px solid #16a34a' }}>
            Approving project for <strong>{approveModal.name}</strong> — {approveModal.internship_name}
          </p>
          <div style={{ background: '#f5f3ff', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: '#475569', lineHeight: 1.7 }}>
            The student will be notified that their project has been approved and they can now claim their refund.
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#475569', cursor: 'pointer', marginTop: 14 }}>
            <input type="checkbox" checked={approveModal.skipEmail} onChange={e => setApproveModal(m => ({ ...m, skipEmail: e.target.checked }))} style={{ accentColor: '#4f46e5' }} />
            Skip email notification
          </label>
        </Modal>
      )}

      {/* Decline Project */}
      {declineModal && (
        <Modal title="Decline Project" onClose={() => !actionLoading && setDeclineModal(null)} loading={actionLoading}
          footer={<>
            <Btn label="Cancel" color="gray" onClick={() => setDeclineModal(null)} disabled={actionLoading} />
            <Btn label="Decline Project" color="red" onClick={() => handleDeclineProject(declineModal)} loading={actionLoading} />
          </>}>
          <p style={{ fontSize: 12, color: '#475569', margin: '0 0 14px', padding: '8px 12px', background: '#fef2f2', borderRadius: 8, borderLeft: '3px solid #dc2626' }}>
            Declining project for <strong>{declineModal.name}</strong> — {declineModal.internship_name}
          </p>
          <Field label="Reason for Decline *">
            <textarea value={declineModal.reason} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
              placeholder="Required: explain why the project is being declined…"
              onChange={e => setDeclineModal(m => ({ ...m, reason: e.target.value }))} />
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={declineModal.skipEmail} onChange={e => setDeclineModal(m => ({ ...m, skipEmail: e.target.checked }))} style={{ accentColor: '#4f46e5' }} />
            Skip email notification
          </label>
        </Modal>
      )}
    </>
  );
}