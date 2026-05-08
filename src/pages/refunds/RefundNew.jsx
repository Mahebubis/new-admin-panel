// import { useState, useEffect, useCallback, useRef } from 'react';
// import api from '../../api/axios';
// import toast from 'react-hot-toast';

// /* ─── constants ─── */
// const API = '/api/refunds/refund-new.php';

// const STATUS_BADGE = {
//   active:            { bg: '#f3f4f6', color: '#9ca3af', label: 'Active' },
//   under_review:      { bg: '#fff8e1', color: '#e65100', label: 'Claim Requested' },
//   refunded:          { bg: '#e8f5e9', color: '#2e7d32', label: 'Refunded' },
//   rejected:          { bg: '#ffebee', color: '#c62828', label: 'Rejected' },
//   completed:         { bg: '#e0f2f1', color: '#00695c', label: 'Completed' },
//   project_submitted: { bg: '#fff3e0', color: '#e65100', label: 'Project Submitted' },
//   project_approved:  { bg: '#e8f5e9', color: '#2e7d32', label: 'Project Approved' },
//   project_rejected:  { bg: '#ffebee', color: '#c62828', label: 'Project Rejected' },
// };

// const FUNNEL_STEPS = [
//   { key: 'registrations',   label: 'Registrations',   color: '#4f46e5', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
//   { key: 'exam_given',      label: 'Exam Given',      color: '#7c3aed', icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
//   { key: 'intent_yes',      label: 'Intent Yes',      color: '#047857', icon: 'M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z' },
//   { key: 'intent_no',       label: 'Intent No',       color: '#b91c1c', icon: 'M10 15V9a3 3 0 0 1 3-3l4 9v11H5.72a2 2 0 0 1-2-1.7l-1.38-9a2 2 0 0 1 2-2.3H10z' },
//   { key: 'result_viewed',   label: 'Result Viewed',   color: '#0369a1', icon: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z' },
//   { key: 'purchased',       label: 'Int. Purchased',  color: '#b45309', icon: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0' },
//   { key: 'refund_claimed',  label: 'Refund Claimed',  color: '#0f766e', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
// ];

// const DATE_PRESETS = [
//   { label: 'All', from: '', to: '' },
//   { label: 'Today', days: 0 },
//   { label: 'Yesterday', days: 1 },
//   { label: 'Last 7 Days', days: 7 },
//   { label: 'Last 30 Days', days: 30 },
// ];

// const STAT_CHIPS = [
//   { key: '',                  label: 'Total',             color: '#0d2137' },
//   { key: 'active',            label: 'Active',            color: '#9ca3af' },
//   { key: 'completed',         label: 'Completed',         color: '#00695c' },
//   { key: 'rejected',          label: 'Rejected',          color: '#c62828' },
//   { key: 'under_review',      label: 'Claim Req',         color: '#e65100' },
//   { key: 'refunded',          label: 'Refunded',          color: '#2e7d32' },
//   { key: 'project_submitted', label: 'Proj Sub',          color: '#e65100' },
//   { key: 'project_approved',  label: 'Proj Appr',         color: '#2e7d32' },
//   { key: 'project_rejected',  label: 'Proj Rej',          color: '#c62828' },
// ];

// /* ─── SVG icon helper ─── */
// const SvgIcon = ({ d, size = 14, color = 'currentColor', ...p }) => (
//   <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
//     stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
//     <path d={d} />
//   </svg>
// );

// /* ─── date helpers ─── */
// const toISODate = (d) => d.toISOString().split('T')[0];
// const fmtDate = (d) => {
//   if (!d) return '\u2014';
//   try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
//   catch { return d; }
// };

// /* ─── email templates ─── */
// const emailRefundConfirmed = (name, internship, paymentId, paidAt) =>
//   `<div style="font-family:'Segoe UI',sans-serif;background:#f0faf8;padding:16px;"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;"><div style="background:linear-gradient(135deg,#1e2d5a,#273a72);padding:18px 22px;text-align:center;"><h1 style="color:#fff;font-size:16px;font-weight:800;margin:0;">Refund Processed \u2705</h1></div><div style="padding:18px 22px;"><p>Dear <strong>${name}</strong>,</p><p>Your refund for <strong>${internship}</strong> has been processed.</p><table style="width:100%;margin:12px 0;border-collapse:collapse;"><tr><td style="font-size:11px;color:#64748b;padding:3px 0;">Payment ID</td><td style="font-size:11px;color:#0d9488;font-weight:700;font-family:monospace;">${paymentId}</td></tr><tr><td style="font-size:11px;color:#64748b;padding:3px 0;">Paid On</td><td style="font-size:11.5px;font-weight:600;">${paidAt}</td></tr></table><p style="background:#fef9c3;border-left:3px solid #d97706;padding:9px 12px;border-radius:0 7px 7px 0;font-size:11px;">Refund will be credited within <strong>5\u20137 business days</strong>.</p></div><div style="background:#f0faf8;border-top:1px solid #d4efeb;padding:12px 22px;text-align:center;font-size:10.5px;color:#64748b;">Warm regards, <strong>Internship Studio Team</strong></div></div></div>`;

// const emailProjectApproved = (name, internship) =>
//   `<div style="font-family:'Segoe UI',sans-serif;background:#f0faf8;padding:16px;"><div style="max-width:460px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;"><div style="background:linear-gradient(135deg,#1e2d5a,#273a72);padding:18px 22px;text-align:center;"><h1 style="color:#fff;font-size:16px;font-weight:800;margin:0 0 4px;">Project Approved! \ud83c\udf89</h1><p style="color:rgba(255,255,255,.6);font-size:11px;margin:0;">${internship}</p></div><div style="padding:18px 22px;"><p>Dear <strong>${name}</strong>,</p><p>Your project for <strong>${internship}</strong> has been <strong>approved</strong>. Claim your refund from the dashboard.</p><p>Refund will be credited within <strong>7\u201310 working days</strong>.</p><div style="text-align:center;margin-top:16px;"><a href="https://dashboard.internshipstudio.com" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:9px 22px;border-radius:8px;font-size:12.5px;font-weight:700;">Claim Your Refund \u2192</a></div></div><div style="background:#f0faf8;border-top:1px solid #d4efeb;padding:12px 22px;text-align:center;font-size:10.5px;color:#64748b;">Warm regards, <strong>Internship Studio Team</strong></div></div></div>`;

// const emailRejectDefault = (name, internship) =>
//   `Dear ${name},\n\nAfter reviewing your refund claim for ${internship}, we regret to inform you that we are unable to process it at this time.\n\nPlease contact support for more details.\n\nWarm regards,\nInternship Studio Team`;

// const emailDeclineDefault = (name, internship) =>
//   `Dear ${name},\n\nThank you for submitting your project for ${internship}.\nAfter review, your submission has not been approved. Please review and resubmit.\n\nWarm regards,\nInternship Studio Team`;

// /* ═══════════════════════════════════════════════════════════════════════════ */
// export default function RefundNew() {
//   /* ── state ── */
//   const [data, setData] = useState([]);
//   const [total, setTotal] = useState(0);
//   const [totalPages, setTotalPages] = useState(1);
//   const [stats, setStats] = useState({});
//   const [batches, setBatches] = useState([]);
//   const [funnel, setFunnel] = useState({});
//   const [page, setPage] = useState(1);
//   const [perPage, setPerPage] = useState(10);
//   const [search, setSearch] = useState('');
//   const [searchInput, setSearchInput] = useState('');
//   const [globalSearch, setGlobalSearch] = useState('');
//   const [globalSearchInput, setGlobalSearchInput] = useState('');
//   const [status, setStatus] = useState('');
//   const [batch, setBatch] = useState('');
//   const [funnelStep, setFunnelStep] = useState('');
//   const [dateFrom, setDateFrom] = useState('');
//   const [dateTo, setDateTo] = useState('');
//   const [datePreset, setDatePreset] = useState('All');
//   const [loading, setLoading] = useState(true);

//   /* modal states */
//   const [rejectModal, setRejectModal] = useState(null);
//   const [proofModal, setProofModal] = useState(null);
//   const [approveModal, setApproveModal] = useState(null);
//   const [declineModal, setDeclineModal] = useState(null);
//   const [proofViewer, setProofViewer] = useState(null);
//   const [actionLoading, setActionLoading] = useState(false);

//   const jumpRef = useRef(null);

//   /* ── fetch table data ── */
//   const fetchData = useCallback(async () => {
//     setLoading(true);
//     try {
//       const res = await api.get(API, {
//         params: { page, per_page: perPage, search, global_search: globalSearch, status, batch, funnel_step: funnelStep, date_from: dateFrom, date_to: dateTo }
//       });
//       if (res.data.success) {
//         const d = res.data.data;
//         setData(d.refunds || []);
//         setTotal(d.total || 0);
//         setTotalPages(d.total_pages || 1);
//         if (d.stats) setStats(d.stats);
//         if (d.batches) setBatches(d.batches);
//       }
//     } catch { /* interceptor */ }
//     finally { setLoading(false); }
//   }, [page, perPage, search, globalSearch, status, batch, funnelStep, dateFrom, dateTo]);

//   /* ── fetch funnel ── */
//   const fetchFunnel = useCallback(async () => {
//     try {
//       const res = await api.post(API, { action: 'fetch_funnel', date_from: dateFrom, date_to: dateTo, search: globalSearch });
//       if (res.data.success) setFunnel(res.data.data.funnel || {});
//     } catch { /* silent */ }
//   }, [dateFrom, dateTo, globalSearch]);

//   useEffect(() => { fetchData(); }, [fetchData]);
//   useEffect(() => { fetchFunnel(); }, [fetchFunnel]);

//   /* ── helpers ── */
//   const copyToClipboard = (txt) => { navigator.clipboard.writeText(txt); toast.success('Copied!'); };

//   const doSearch = () => { setSearch(searchInput); setPage(1); };
//   const doClear = () => { setSearchInput(''); setSearch(''); setStatus(''); setBatch(''); setPage(1); };
//   const doGlobalSearch = () => { setGlobalSearch(globalSearchInput); setPage(1); };

//   const applyDatePreset = (p) => {
//     setDatePreset(p.label);
//     if (p.label === 'All') { setDateFrom(''); setDateTo(''); }
//     else {
//       const now = new Date();
//       if (p.days === 0) { const d = toISODate(now); setDateFrom(d); setDateTo(d); }
//       else if (p.days === 1) { const y = new Date(now); y.setDate(y.getDate() - 1); const d = toISODate(y); setDateFrom(d); setDateTo(d); }
//       else { const s = new Date(now); s.setDate(s.getDate() - p.days + 1); setDateFrom(toISODate(s)); setDateTo(toISODate(now)); }
//     }
//     setPage(1);
//   };

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

//   const attColor = (v) => v >= 80 ? '#2e7d32' : v >= 50 ? '#e65100' : '#c62828';
//   const attBg = (v) => v >= 80 ? '#e8f5e9' : v >= 50 ? '#fff8e1' : '#ffebee';

//   /* ── CSV export ── */
//   const exportCSV = async () => {
//     toast.loading('Exporting...', { id: 'csv' });
//     try {
//       const res = await api.get(API, {
//         params: { page: 1, per_page: 100000, search, global_search: globalSearch, status, batch, funnel_step: funnelStep, date_from: dateFrom, date_to: dateTo }
//       });
//       const rows = res.data?.data?.refunds || [];
//       if (!rows.length) { toast.error('No data to export', { id: 'csv' }); return; }
//       const headers = ['#','Name','Email','Phone','Exam','Group','Intent','Internship','Duration','Batch','Paid At','Refund Status','Attendance','Project Status','File','Payment ID','Proof URL'];
//       const csv = [headers.join(','), ...rows.map((r, i) =>
//         [i + 1, `"${r.name}"`, r.email, r.contact, r.exam_given ? 'Yes' : 'No', r.group_joined ? 'Yes' : 'No', r.intent || '', `"${r.internship_name}"`, r.duration || '', `"${r.batch || ''}"`, r.paid_at || '', r.refund_claim_status || 'active', r.attendance || 0, r.project_status || '', r.file_link || '', r.payment_id || '', r.proof_url || ''].join(',')
//       )].join('\n');
//       const blob = new Blob([csv], { type: 'text/csv' });
//       const url = URL.createObjectURL(blob);
//       const a = document.createElement('a'); a.href = url; a.download = 'refund_new_export.csv'; a.click();
//       URL.revokeObjectURL(url);
//       toast.success('Exported!', { id: 'csv' });
//     } catch { toast.error('Export failed', { id: 'csv' }); }
//   };

//   /* ── API actions ── */
//   const uploadProof = async (file) => {
//     const fd = new FormData();
//     fd.append('action', 'upload_proof');
//     fd.append('proof', file);
//     const res = await api.post(API, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
//     return res.data?.data?.url || '';
//   };

//   const sendEmail = async (to, subject, html) => {
//     await api.post(API, { action: 'send_email', to, subject, html });
//   };

//   const updateRefundClaim = async (user_id, internship_id, claimStatus, admin_notes, proof_url) => {
//     await api.post(API, { action: 'update_refund_claim', user_id, internship_id, status: claimStatus, admin_notes, proof_url });
//   };

//   const approveProjectApi = async (user_id, internship_id) => {
//     await api.post(API, { action: 'approve_project', user_id, internship_id });
//   };

//   const declineProjectApi = async (user_id, internship_id, reason) => {
//     await api.post(API, { action: 'decline_project', user_id, internship_id, reason });
//   };

//   /* ── Reject handler ── */
//   const handleReject = async (m) => {
//     if (!m.adminNotes?.trim()) { toast.error('Notes are required'); return; }
//     setActionLoading(true);
//     try {
//       await updateRefundClaim(m.user_id, m.internship_id, 'rejected', m.adminNotes, '');
//       if (!m.skipEmail) await sendEmail(m.email, m.emailSubject, m.emailBody);
//       toast.success('Refund claim rejected');
//       setRejectModal(null); fetchData(); fetchFunnel();
//     } catch { toast.error('Failed to reject'); }
//     finally { setActionLoading(false); }
//   };

//   /* ── Upload proof + confirm refund ── */
//   const handleUploadProof = async (m) => {
//     if (!m.file) { toast.error('Please select a file'); return; }
//     setActionLoading(true);
//     try {
//       const url = await uploadProof(m.file);
//       await updateRefundClaim(m.user_id, m.internship_id, 'refunded', '', url);
//       toast.success('Proof uploaded & refund confirmed');
//       setProofModal(null); fetchData(); fetchFunnel();
//     } catch { toast.error('Failed to upload proof'); }
//     finally { setActionLoading(false); }
//   };

//   /* ── Approve project ── */
//   const handleApproveProject = async (m) => {
//     setActionLoading(true);
//     try {
//       await approveProjectApi(m.user_id, m.internship_id);
//       if (!m.skipEmail) await sendEmail(m.email, `Project Approved \u2013 Internship Studio`, emailProjectApproved(m.name, m.internship_name));
//       toast.success('Project approved');
//       setApproveModal(null); fetchData(); fetchFunnel();
//     } catch { toast.error('Failed to approve project'); }
//     finally { setActionLoading(false); }
//   };

//   /* ── Decline project ── */
//   const handleDeclineProject = async (m) => {
//     if (!m.reason?.trim()) { toast.error('Reason is required'); return; }
//     setActionLoading(true);
//     try {
//       await declineProjectApi(m.user_id, m.internship_id, m.reason);
//       if (!m.skipEmail) await sendEmail(m.email, m.emailSubject, m.emailBody);
//       toast.success('Project declined');
//       setDeclineModal(null); fetchData(); fetchFunnel();
//     } catch { toast.error('Failed to decline project'); }
//     finally { setActionLoading(false); }
//   };

//   /* ── funnel helpers ── */
//   const funnelTotal = funnel.registrations || 1;
//   const funnelPct = (key) => funnelTotal ? Math.round(((funnel[key] || 0) / funnelTotal) * 100) : 0;
//   const dropOff = (i) => {
//     if (i === 0) return 0;
//     const prev = funnel[FUNNEL_STEPS[i - 1].key] || 0;
//     const cur = funnel[FUNNEL_STEPS[i].key] || 0;
//     if (!prev) return 0;
//     return Math.round(((prev - cur) / prev) * 100);
//   };

//   /* ── avatar color from name ── */
//   const avatarColor = (name) => {
//     const colors = ['#4f46e5','#7c3aed','#047857','#b91c1c','#0369a1','#b45309','#0f766e','#dc2626','#0d9488'];
//     let h = 0; for (let i = 0; i < (name||'').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
//     return colors[Math.abs(h) % colors.length];
//   };

//   /* ══════════════════════════════ RENDER ══════════════════════════════ */
//   return (
//     <>
//       <style>{`
// @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
// .rn-root{font-family:'Plus Jakarta Sans',sans-serif;min-height:100vh;background:#f4f6fb;}

// /* header */
// .rn-hero{background:linear-gradient(135deg,#1e2d5a,#273a72);padding:20px 24px 16px;color:#fff;}
// .rn-hero-top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;}
// .rn-hero h1{font-size:18px;font-weight:800;margin:0;display:flex;align-items:center;gap:8px;}
// .rn-hero-sub{font-size:10.5px;color:rgba(255,255,255,.55);margin-top:4px;letter-spacing:.2px;}
// .rn-export-btn{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;padding:6px 14px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;display:flex;align-items:center;gap:5px;}
// .rn-export-btn:hover{background:rgba(255,255,255,.22);}

// /* date bar */
// .rn-datebar{background:#fff;border-bottom:1.5px solid #e2e8f0;padding:8px 24px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
// .rn-seg{display:inline-flex;border:1.5px solid #e2e8f0;border-radius:8px;overflow:hidden;}
// .rn-seg button{padding:5px 12px;font-size:11px;font-weight:600;border:none;background:#fff;color:#64748b;cursor:pointer;font-family:inherit;transition:all .12s;border-right:1px solid #e2e8f0;}
// .rn-seg button:last-child{border-right:none;}
// .rn-seg button.active{background:#0d9488;color:#fff;}
// .rn-seg button:hover:not(.active){background:#f0fdf9;}
// .rn-datebar input[type=date]{padding:5px 8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:11px;font-family:inherit;color:#334155;outline:none;}
// .rn-datebar input[type=date]:focus{border-color:#0d9488;}
// .rn-global-search{flex:1;min-width:160px;max-width:280px;padding:5px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:11.5px;font-family:inherit;outline:none;color:#334155;}
// .rn-global-search:focus{border-color:#0d9488;}
// .rn-apply-btn{background:#0d9488;color:#fff;border:none;padding:5px 14px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;}
// .rn-apply-btn:hover{background:#0f766e;}

// /* funnel */
// .rn-funnel{padding:16px 24px;display:flex;align-items:stretch;gap:0;overflow-x:auto;}
// .rn-funnel-card{flex:1;min-width:110px;padding:12px 10px;border-radius:10px;text-align:center;cursor:pointer;transition:all .15s;border:2px solid transparent;position:relative;}
// .rn-funnel-card:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.08);}
// .rn-funnel-card.active{border-color:currentColor;box-shadow:0 4px 16px rgba(0,0,0,.12);}
// .rn-funnel-count{font-size:22px;font-weight:800;margin:4px 0 2px;}
// .rn-funnel-label{font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;opacity:.8;}
// .rn-funnel-pct{font-size:10px;font-weight:700;margin-top:4px;}
// .rn-funnel-bar{height:4px;border-radius:2px;margin-top:6px;background:rgba(255,255,255,.3);overflow:hidden;}
// .rn-funnel-bar-fill{height:100%;border-radius:2px;transition:width .4s;}
// .rn-funnel-arrow{display:flex;align-items:center;justify-content:center;min-width:36px;flex-shrink:0;}
// .rn-funnel-pill{font-size:9px;font-weight:700;padding:2px 6px;border-radius:10px;white-space:nowrap;}

// /* stat chips */
// .rn-chips{padding:8px 24px;display:flex;flex-wrap:wrap;gap:6px;background:#fff;border-bottom:1.5px solid #e2e8f0;}
// .rn-chip{padding:4px 12px;border-radius:20px;font-size:10.5px;font-weight:600;border:1.5px solid #e2e8f0;cursor:pointer;transition:all .15s;background:#fff;white-space:nowrap;display:flex;align-items:center;gap:4px;}
// .rn-chip:hover{border-color:#0d9488;}
// .rn-chip.active{background:#f0fdf9;border-color:#0d9488;color:#0d9488 !important;}

// /* filter bar */
// .rn-filters{padding:8px 24px;background:#fff;border-bottom:1.5px solid #e2e8f0;display:flex;flex-wrap:wrap;align-items:center;gap:8px;}
// .rn-search-box{display:flex;align-items:center;background:#f4f6fb;border:1.5px solid #e2e8f0;border-radius:8px;overflow:hidden;flex:1;max-width:300px;min-width:180px;}
// .rn-search-box input{flex:1;border:none;background:transparent;padding:6px 10px;font-size:12px;font-family:inherit;outline:none;color:#334155;}
// .rn-search-box input::placeholder{color:#94a3b8;}
// .rn-select{padding:6px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;font-family:inherit;outline:none;color:#334155;background:#f4f6fb;cursor:pointer;}
// .rn-btn{display:inline-flex;align-items:center;gap:4px;padding:6px 14px;border-radius:8px;font-size:11.5px;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:all .15s;white-space:nowrap;}
// .rn-btn:hover{opacity:.88;transform:translateY(-1px);}
// .rn-btn:disabled{opacity:.35;cursor:not-allowed;transform:none !important;}
// .rn-btn-teal{background:#0d9488;color:#fff;}
// .rn-btn-outline{background:#fff;border:1.5px solid #0d9488;color:#0d9488;}
// .rn-btn-red{background:#e53935;color:#fff;}
// .rn-btn-gray{background:#f3f4f6;color:#6b7280;border:1px solid #e2e8f0;}
// .rn-btn-sm{padding:3px 10px;font-size:10px;border-radius:5px;}
// .rn-btn-green{background:#059669;color:#fff;}
// .rn-btn-amber{background:#d97706;color:#fff;}

// /* table area */
// .rn-body{padding:12px 24px 24px;}
// .rn-card{background:#fff;border-radius:12px;border:1.5px solid #e2e8f0;box-shadow:0 1px 8px rgba(0,0,0,.04);overflow:hidden;}
// .rn-table-wrap{overflow:auto;max-height:calc(100vh - 420px);}
// .rn-table-wrap::-webkit-scrollbar{width:5px;height:5px;}
// .rn-table-wrap::-webkit-scrollbar-track{background:#f4f6fb;}
// .rn-table-wrap::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:10px;}
// table.rn-t{width:100%;border-collapse:collapse;table-layout:auto;min-width:1800px;}
// table.rn-t thead tr{background:#1e2d5a;}
// table.rn-t thead th{color:#fff;font-size:10px;font-weight:600;padding:10px 8px;white-space:nowrap;text-align:left;letter-spacing:.4px;text-transform:uppercase;border-right:1px solid rgba(255,255,255,.12);position:sticky;top:0;z-index:2;background:#1e2d5a;}
// table.rn-t thead th:last-child{border-right:none;}
// table.rn-t tbody tr{border-bottom:1px solid #f4f6fb;transition:background .12s;}
// table.rn-t tbody tr:hover{background:#f8fafc;}
// table.rn-t tbody tr.rn-highlight{background:#fffbeb;}
// table.rn-t td{font-size:11.5px;color:#334155;padding:8px 8px;vertical-align:middle;white-space:nowrap;border-right:1px solid #f4f6fb;}
// table.rn-t td:last-child{border-right:none;}
// table.rn-t .rn-sticky{position:sticky;right:0;z-index:1;background:inherit;}
// table.rn-t thead .rn-sticky{z-index:3;}
// .rn-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;white-space:nowrap;}
// .rn-att-wrap{display:flex;align-items:center;gap:6px;}
// .rn-att-bar{width:50px;height:5px;background:#e2e8f0;border-radius:3px;overflow:hidden;}
// .rn-att-fill{height:100%;border-radius:3px;}
// .rn-avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;}
// .rn-student-cell{display:flex;align-items:center;gap:8px;}
// .rn-student-name{font-weight:600;color:#1e293b;font-size:11.5px;}
// .rn-student-email{font-size:10px;color:#94a3b8;}
// .rn-copy-btn{background:none;border:none;cursor:pointer;color:#cbd5e1;padding:0 2px;transition:color .15s;display:inline-flex;align-items:center;}
// .rn-copy-btn:hover{color:#0d9488;}
// .rn-link{color:#0d9488;text-decoration:none;font-weight:600;font-size:10.5px;}
// .rn-link:hover{text-decoration:underline;}

// /* footer / pagination */
// .rn-footer{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-top:1.5px solid #e2e8f0;flex-wrap:wrap;gap:8px;}
// .rn-page-info{font-size:11px;color:#64748b;}
// .rn-pagination{display:flex;align-items:center;gap:3px;}
// .rn-pg-btn{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:26px;padding:0 6px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;background:#fff;color:#475569;font-family:inherit;transition:all .15s;}
// .rn-pg-btn:hover:not(:disabled){border-color:#0d9488;color:#0d9488;}
// .rn-pg-btn.active{background:#0d9488;border-color:#0d9488;color:#fff;}
// .rn-pg-btn:disabled{opacity:.35;cursor:not-allowed;}
// .rn-pg-jump{display:flex;align-items:center;gap:4px;}
// .rn-pg-jump input{width:55px;border:1.5px solid #e2e8f0;border-radius:6px;padding:3px 6px;font-size:11px;font-family:inherit;outline:none;text-align:center;color:#334155;}
// .rn-pg-jump input:focus{border-color:#0d9488;}
// .rn-pg-jump button{background:#0d9488;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;}

// /* loader */
// .rn-loader{position:fixed;inset:0;background:rgba(244,246,251,.75);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(2px);}
// .rn-spinner{width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#0d9488;border-radius:50%;animation:rn-spin .7s linear infinite;}
// @keyframes rn-spin{to{transform:rotate(360deg);}}
// .rn-no-data{text-align:center;padding:40px;color:#94a3b8;font-size:13px;}

// /* modal */
// .rn-modal-overlay{position:fixed;inset:0;background:rgba(30,45,90,.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(3px);}
// .rn-modal-box{background:#fff;border-radius:14px;width:100%;max-width:560px;box-shadow:0 20px 60px rgba(0,0,0,.18);overflow:hidden;max-height:90vh;display:flex;flex-direction:column;}
// .rn-modal-head{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1.5px solid #e2e8f0;background:#f8fafc;}
// .rn-modal-head h5{font-size:14px;font-weight:700;color:#1e2d5a;margin:0;}
// .rn-modal-close{background:none;border:none;cursor:pointer;color:#94a3b8;transition:color .15s;display:flex;align-items:center;}
// .rn-modal-close:hover{color:#1e2d5a;}
// .rn-modal-body{padding:20px;overflow-y:auto;flex:1;}
// .rn-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1.5px solid #e2e8f0;}
// .rn-field{margin-bottom:14px;}
// .rn-field label{display:block;font-size:11px;font-weight:600;color:#1e2d5a;margin-bottom:4px;}
// .rn-field input,.rn-field textarea,.rn-field select{width:100%;padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;font-family:inherit;outline:none;color:#334155;background:#f8fafc;box-sizing:border-box;}
// .rn-field input:focus,.rn-field textarea:focus{border-color:#0d9488;}
// .rn-field textarea{min-height:80px;resize:vertical;}
// .rn-checkbox{display:flex;align-items:center;gap:6px;font-size:12px;color:#334155;cursor:pointer;}
// .rn-checkbox input{width:14px;height:14px;accent-color:#0d9488;}
// .rn-email-preview{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-size:11px;color:#334155;line-height:1.6;max-height:180px;overflow-y:auto;margin-bottom:10px;}
// .rn-drop-zone{border:2px dashed #e2e8f0;border-radius:10px;padding:30px 20px;text-align:center;cursor:pointer;transition:all .15s;background:#f8fafc;}
// .rn-drop-zone:hover,.rn-drop-zone.drag{border-color:#0d9488;background:#f0fdf9;}
// .rn-drop-zone p{margin:6px 0 0;font-size:12px;color:#94a3b8;}
// .rn-file-preview{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-top:8px;font-size:11px;color:#334155;}
// .rn-proof-viewer{position:fixed;inset:0;background:rgba(30,45,90,.7);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);}
// .rn-proof-viewer img{max-width:90vw;max-height:85vh;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.3);}
// .rn-proof-close{position:absolute;top:20px;right:20px;background:rgba(255,255,255,.9);border:none;border-radius:50%;width:36px;height:36px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:700;color:#1e2d5a;}
//       `}</style>

//       {loading && <div className="rn-loader"><div className="rn-spinner" /></div>}

//       <div className="rn-root">

//         {/* ═══ HERO HEADER ═══ */}
//         <div className="rn-hero">
//           <div className="rn-hero-top">
//             <div>
//               <h1>
//                 <SvgIcon d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" size={20} color="#fff" />
//                 Refund Panel
//               </h1>
//               <div className="rn-hero-sub">Registration &rarr; Exam Given &rarr; Intent(Yes) &rarr; Intent(No) &rarr; Result Viewed &rarr; Internship Purchased &rarr; Refund Claimed</div>
//             </div>
//             <button className="rn-export-btn" onClick={exportCSV}>
//               <SvgIcon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" size={14} color="#fff" />
//               Export CSV
//             </button>
//           </div>
//         </div>

//         {/* ═══ DATE BAR ═══ */}
//         <div className="rn-datebar">
//           <div className="rn-seg">
//             {DATE_PRESETS.map(p => (
//               <button key={p.label} className={datePreset === p.label ? 'active' : ''} onClick={() => applyDatePreset(p)}>{p.label}</button>
//             ))}
//           </div>
//           <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setDatePreset(''); }} />
//           <span style={{ fontSize: 11, color: '#94a3b8' }}>to</span>
//           <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setDatePreset(''); }} />
//           <input className="rn-global-search" placeholder="Global search (email, ID, phone)..." value={globalSearchInput} onChange={e => setGlobalSearchInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && doGlobalSearch()} />
//           <button className="rn-apply-btn" onClick={doGlobalSearch}>Apply</button>
//         </div>

//         {/* ═══ FUNNEL ═══ */}
//         <div className="rn-funnel">
//           {FUNNEL_STEPS.map((step, i) => {
//             const count = funnel[step.key] || 0;
//             const pct = funnelPct(step.key);
//             const drop = dropOff(i);
//             const dropColor = drop >= 40 ? '#dc2626' : drop >= 10 ? '#d97706' : '#059669';
//             const dropBg = drop >= 40 ? '#fef2f2' : drop >= 10 ? '#fffbeb' : '#f0fdf9';
//             return (
//               <div key={step.key} style={{ display: 'flex', alignItems: 'stretch' }}>
//                 {i > 0 && (
//                   <div className="rn-funnel-arrow">
//                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
//                       <span style={{ color: '#cbd5e1', fontSize: 16 }}>&rarr;</span>
//                       <span className="rn-funnel-pill" style={{ background: dropBg, color: dropColor }}>-{drop}%</span>
//                     </div>
//                   </div>
//                 )}
//                 <div
//                   className={`rn-funnel-card${funnelStep === step.key ? ' active' : ''}`}
//                   style={{ background: step.color + '10', color: step.color }}
//                   onClick={() => { setFunnelStep(funnelStep === step.key ? '' : step.key); setPage(1); }}
//                 >
//                   <SvgIcon d={step.icon} size={18} color={step.color} />
//                   <div className="rn-funnel-count" style={{ color: step.color }}>{count.toLocaleString()}</div>
//                   <div className="rn-funnel-label">{step.label}</div>
//                   <div className="rn-funnel-pct">{pct}%</div>
//                   <div className="rn-funnel-bar" style={{ background: step.color + '22' }}>
//                     <div className="rn-funnel-bar-fill" style={{ width: `${pct}%`, background: step.color }} />
//                   </div>
//                 </div>
//               </div>
//             );
//           })}
//         </div>

//         {/* ═══ STATUS CHIPS ═══ */}
//         <div className="rn-chips">
//           {STAT_CHIPS.map(c => (
//             <div
//               key={c.key}
//               className={`rn-chip${status === c.key ? ' active' : ''}`}
//               style={{ color: c.color }}
//               onClick={() => { setStatus(status === c.key ? '' : c.key); setPage(1); }}
//             >
//               <span>{c.label}</span>
//               <span style={{ fontWeight: 800 }}>{stats[c.key || 'total'] || 0}</span>
//             </div>
//           ))}
//         </div>

//         {/* ═══ FILTER BAR ═══ */}
//         <div className="rn-filters">
//           <div className="rn-search-box">
//             <SvgIcon d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" size={14} color="#94a3b8" style={{ marginLeft: 8 }} />
//             <input placeholder="Search name, email, phone, internship, payment ID..." value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} />
//           </div>
//           <select className="rn-select" value={batch} onChange={e => { setBatch(e.target.value); setPage(1); }}>
//             <option value="">All Batches</option>
//             {batches.map(b => <option key={b} value={b}>{b}</option>)}
//           </select>
//           <select className="rn-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
//             <option value="">All Status</option>
//             <option value="active">Active</option>
//             <option value="completed">Completed</option>
//             <option value="rejected">Rejected</option>
//             <option value="under_review">Claim Requested</option>
//             <option value="refunded">Refunded</option>
//             <option value="project_submitted">Project Submitted</option>
//             <option value="project_approved">Project Approved</option>
//             <option value="project_rejected">Project Rejected</option>
//           </select>
//           <select className="rn-select" value={perPage} onChange={e => { setPerPage(+e.target.value); setPage(1); }}>
//             {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} rows</option>)}
//           </select>
//           <button className="rn-btn rn-btn-teal rn-btn-sm" onClick={doSearch}>Search</button>
//           <button className="rn-btn rn-btn-gray rn-btn-sm" onClick={doClear}>Clear</button>
//         </div>

//         {/* ═══ TABLE ═══ */}
//         <div className="rn-body">
//           <div className="rn-card">
//             <div className="rn-table-wrap">
//               <table className="rn-t">
//                 <thead>
//                   <tr>
//                     <th>#</th>
//                     <th>Student</th>
//                     <th>Phone</th>
//                     <th>Exam</th>
//                     <th>Group</th>
//                     <th>Intent</th>
//                     <th>Internship</th>
//                     <th>Duration</th>
//                     <th>Batch</th>
//                     <th>Paid At</th>
//                     <th>Refund Status</th>
//                     <th>Attendance</th>
//                     <th>Project Sub</th>
//                     <th>File</th>
//                     <th>Project Approved</th>
//                     <th>Payment</th>
//                     <th className="rn-sticky" style={{ right: 70 }}>Refund Action</th>
//                     <th className="rn-sticky" style={{ right: 0 }}>Project Action</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {data.length === 0 && !loading && (
//                     <tr><td colSpan={18} className="rn-no-data">No refund records found.</td></tr>
//                   )}
//                   {data.map((r, idx) => {
//                     const rs = r.refund_claim_status || 'active';
//                     const isHighlight = rs === 'under_review';
//                     const badge = STATUS_BADGE[rs] || STATUS_BADGE.active;
//                     const att = parseFloat(r.attendance) || 0;
//                     return (
//                       <tr key={`${r.user_id}-${r.internship_id}-${idx}`} className={isHighlight ? 'rn-highlight' : ''}>
//                         {/* # */}
//                         <td>{(page - 1) * perPage + idx + 1}</td>

//                         {/* Student */}
//                         <td>
//                           <div className="rn-student-cell">
//                             <div className="rn-avatar" style={{ background: avatarColor(r.name) }}>{(r.name || '?')[0].toUpperCase()}</div>
//                             <div>
//                               <div className="rn-student-name">{r.name}</div>
//                               <div className="rn-student-email">
//                                 {r.email}
//                                 <button className="rn-copy-btn" onClick={() => copyToClipboard(r.email)} title="Copy email">
//                                   <SvgIcon d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-4-4H8zM14 2v6h6" size={10} />
//                                 </button>
//                               </div>
//                             </div>
//                           </div>
//                         </td>

//                         {/* Phone */}
//                         <td>
//                           {r.contact || '\u2014'}
//                           {r.contact && <button className="rn-copy-btn" onClick={() => copyToClipboard(r.contact)} title="Copy"><SvgIcon d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-4-4H8zM14 2v6h6" size={10} /></button>}
//                         </td>

//                         {/* Exam */}
//                         <td>
//                           <span className="rn-badge" style={{ background: r.exam_given ? '#e8f5e9' : '#ffebee', color: r.exam_given ? '#2e7d32' : '#c62828' }}>
//                             {r.exam_given ? 'Yes' : 'No'}
//                           </span>
//                         </td>

//                         {/* Group */}
//                         <td>
//                           <span className="rn-badge" style={{ background: r.group_joined ? '#e8f5e9' : '#ffebee', color: r.group_joined ? '#2e7d32' : '#c62828' }}>
//                             {r.group_joined ? 'Yes' : 'No'}
//                           </span>
//                         </td>

//                         {/* Intent */}
//                         <td>
//                           {r.intent ? (
//                             <span className="rn-badge" style={{ background: r.intent === 'yes' ? '#e8f5e9' : '#ffebee', color: r.intent === 'yes' ? '#2e7d32' : '#c62828' }}>
//                               {r.intent === 'yes' ? 'Yes' : 'No'}
//                             </span>
//                           ) : '\u2014'}
//                         </td>

//                         {/* Internship */}
//                         <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.internship_name}>{r.internship_name || '\u2014'}</td>

//                         {/* Duration */}
//                         <td>{r.duration || '\u2014'}</td>

//                         {/* Batch */}
//                         <td>{r.batch || '\u2014'}</td>

//                         {/* Paid At */}
//                         <td>{fmtDate(r.paid_at)}</td>

//                         {/* Refund Status */}
//                         <td>
//                           <span className="rn-badge" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
//                         </td>

//                         {/* Attendance */}
//                         <td>
//                           <div className="rn-att-wrap">
//                             <span style={{ fontWeight: 700, color: attColor(att), fontSize: 11 }}>{att}%</span>
//                             <div className="rn-att-bar">
//                               <div className="rn-att-fill" style={{ width: `${Math.min(att, 100)}%`, background: attColor(att) }} />
//                             </div>
//                           </div>
//                         </td>

//                         {/* Project Submitted */}
//                         <td>
//                           {r.project_status ? (
//                             <div>
//                               <span className="rn-badge" style={{
//                                 background: r.project_status === 'approved' ? '#e8f5e9' : r.project_status === 'rejected' ? '#ffebee' : '#fff3e0',
//                                 color: r.project_status === 'approved' ? '#2e7d32' : r.project_status === 'rejected' ? '#c62828' : '#e65100'
//                               }}>
//                                 {r.project_status.charAt(0).toUpperCase() + r.project_status.slice(1)}
//                               </span>
//                               {r.project_submitted_date && <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>{fmtDate(r.project_submitted_date)}</div>}
//                             </div>
//                           ) : '\u2014'}
//                         </td>

//                         {/* File */}
//                         <td>
//                           {r.file_link ? (
//                             <a href={r.file_link} target="_blank" rel="noreferrer" className="rn-link">
//                               <SvgIcon d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" size={12} /> View
//                             </a>
//                           ) : '\u2014'}
//                         </td>

//                         {/* Project Approved */}
//                         <td>
//                           {r.project_status === 'approved' ? (
//                             <div>
//                               <span className="rn-badge" style={{ background: '#e8f5e9', color: '#2e7d32' }}>Approved</span>
//                               {r.project_approved_date && <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>{fmtDate(r.project_approved_date)}</div>}
//                             </div>
//                           ) : '\u2014'}
//                         </td>

//                         {/* Payment */}
//                         <td>
//                           <div>
//                             <div style={{ fontSize: 10, color: '#64748b' }}>{fmtDate(r.paid_at)}</div>
//                             {r.payment_id && <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#0d9488' }}>{r.payment_id}</div>}
//                             {r.proof_url && (
//                               <button className="rn-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }} onClick={() => setProofViewer(r.proof_url)}>
//                                 View Proof
//                               </button>
//                             )}
//                           </div>
//                         </td>

//                         {/* Refund Action (sticky) */}
//                         <td className="rn-sticky" style={{ right: 70, background: isHighlight ? '#fffbeb' : '#fff' }}>
//                           {rs === 'under_review' && (
//                             <div style={{ display: 'flex', gap: 4 }}>
//                               <button className="rn-btn rn-btn-green rn-btn-sm" onClick={() => setProofModal({ user_id: r.user_id, internship_id: r.internship_id, name: r.name, email: r.email, internship_name: r.internship_name, payment_id: r.payment_id, paid_at: r.paid_at, file: null, preview: null })}>
//                                 Confirm
//                               </button>
//                               <button className="rn-btn rn-btn-red rn-btn-sm" onClick={() => setRejectModal({ user_id: r.user_id, internship_id: r.internship_id, name: r.name, email: r.email, internship_name: r.internship_name, adminNotes: '', emailSubject: `Refund Claim Update \u2013 Internship Studio`, emailBody: emailRejectDefault(r.name, r.internship_name), skipEmail: false })}>
//                                 Reject
//                               </button>
//                             </div>
//                           )}
//                           {rs === 'refunded' && <span className="rn-badge" style={{ background: '#e8f5e9', color: '#2e7d32' }}>Done</span>}
//                           {rs === 'rejected' && <span className="rn-badge" style={{ background: '#ffebee', color: '#c62828' }}>Rejected</span>}
//                           {!['under_review', 'refunded', 'rejected'].includes(rs) && <span style={{ color: '#94a3b8', fontSize: 10 }}>\u2014</span>}
//                         </td>

//                         {/* Project Action (sticky) */}
//                         <td className="rn-sticky" style={{ right: 0, background: isHighlight ? '#fffbeb' : '#fff' }}>
//                           {r.project_status === 'pending' && (
//                             <div style={{ display: 'flex', gap: 4 }}>
//                               <button className="rn-btn rn-btn-green rn-btn-sm" onClick={() => setApproveModal({ user_id: r.user_id, internship_id: r.internship_id, name: r.name, email: r.email, internship_name: r.internship_name, skipEmail: false })}>
//                                 Approve
//                               </button>
//                               <button className="rn-btn rn-btn-red rn-btn-sm" onClick={() => setDeclineModal({ user_id: r.user_id, internship_id: r.internship_id, name: r.name, email: r.email, internship_name: r.internship_name, reason: '', emailSubject: `Project Submission Update \u2013 Internship Studio`, emailBody: emailDeclineDefault(r.name, r.internship_name), skipEmail: false })}>
//                                 Decline
//                               </button>
//                             </div>
//                           )}
//                           {r.project_status === 'approved' && <span className="rn-badge" style={{ background: '#e8f5e9', color: '#2e7d32' }}>Approved</span>}
//                           {r.project_status === 'rejected' && <span className="rn-badge" style={{ background: '#ffebee', color: '#c62828' }}>Declined</span>}
//                           {!r.project_status && <span style={{ color: '#94a3b8', fontSize: 10 }}>\u2014</span>}
//                         </td>
//                       </tr>
//                     );
//                   })}
//                 </tbody>
//               </table>
//             </div>

//             {/* Footer / Pagination */}
//             <div className="rn-footer">
//               <div className="rn-page-info">Showing {data.length ? (page - 1) * perPage + 1 : 0}\u2013{Math.min(page * perPage, total)} of {total}</div>
//               <div className="rn-pagination">
//                 <button className="rn-pg-btn" disabled={page <= 1} onClick={() => setPage(1)}>&laquo;</button>
//                 <button className="rn-pg-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>&lsaquo;</button>
//                 {pageNums.map(n => (
//                   <button key={n} className={`rn-pg-btn${n === page ? ' active' : ''}`} onClick={() => setPage(n)}>{n}</button>
//                 ))}
//                 <button className="rn-pg-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>&rsaquo;</button>
//                 <button className="rn-pg-btn" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>&raquo;</button>
//                 <div className="rn-pg-jump">
//                   <input ref={jumpRef} type="number" min={1} max={totalPages} placeholder="Go to" onKeyDown={e => e.key === 'Enter' && jumpToPage()} />
//                   <button onClick={jumpToPage}>Go</button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* ═══════════════════════ MODALS ═══════════════════════ */}

//       {/* ── Reject Modal ── */}
//       {rejectModal && (
//         <div className="rn-modal-overlay" onClick={() => !actionLoading && setRejectModal(null)}>
//           <div className="rn-modal-box" onClick={e => e.stopPropagation()}>
//             <div className="rn-modal-head">
//               <h5>Reject Refund Claim</h5>
//               <button className="rn-modal-close" onClick={() => setRejectModal(null)}><SvgIcon d="M18 6 6 18M6 6l12 12" size={18} /></button>
//             </div>
//             <div className="rn-modal-body">
//               <div className="rn-field">
//                 <label>Admin Notes (required)</label>
//                 <textarea value={rejectModal.adminNotes} onChange={e => setRejectModal({ ...rejectModal, adminNotes: e.target.value })} placeholder="Reason for rejection..." />
//               </div>
//               <div className="rn-field">
//                 <label>To</label>
//                 <input value={rejectModal.email} readOnly style={{ background: '#f1f5f9' }} />
//               </div>
//               <div className="rn-field">
//                 <label>Subject</label>
//                 <input value={rejectModal.emailSubject} onChange={e => setRejectModal({ ...rejectModal, emailSubject: e.target.value })} />
//               </div>
//               <div className="rn-field">
//                 <label>Email Body</label>
//                 <textarea value={rejectModal.emailBody} onChange={e => setRejectModal({ ...rejectModal, emailBody: e.target.value })} style={{ minHeight: 120 }} />
//               </div>
//               <label className="rn-checkbox">
//                 <input type="checkbox" checked={rejectModal.skipEmail} onChange={e => setRejectModal({ ...rejectModal, skipEmail: e.target.checked })} />
//                 Skip sending email
//               </label>
//             </div>
//             <div className="rn-modal-foot">
//               <button className="rn-btn rn-btn-gray" onClick={() => setRejectModal(null)} disabled={actionLoading}>Cancel</button>
//               <button className="rn-btn rn-btn-red" onClick={() => handleReject(rejectModal)} disabled={actionLoading}>
//                 {actionLoading ? 'Processing...' : 'Reject'}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── Upload Proof / Confirm Modal ── */}
//       {proofModal && (
//         <div className="rn-modal-overlay" onClick={() => !actionLoading && setProofModal(null)}>
//           <div className="rn-modal-box" onClick={e => e.stopPropagation()}>
//             <div className="rn-modal-head">
//               <h5>Upload Proof & Confirm Refund</h5>
//               <button className="rn-modal-close" onClick={() => setProofModal(null)}><SvgIcon d="M18 6 6 18M6 6l12 12" size={18} /></button>
//             </div>
//             <div className="rn-modal-body">
//               <div
//                 className={`rn-drop-zone${proofModal.dragOver ? ' drag' : ''}`}
//                 onDragOver={e => { e.preventDefault(); setProofModal({ ...proofModal, dragOver: true }); }}
//                 onDragLeave={() => setProofModal({ ...proofModal, dragOver: false })}
//                 onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setProofModal({ ...proofModal, file: f, preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null, dragOver: false }); }}
//                 onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,.pdf'; inp.onchange = e => { const f = e.target.files[0]; if (f) setProofModal({ ...proofModal, file: f, preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null }); }; inp.click(); }}
//               >
//                 <SvgIcon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" size={28} color="#94a3b8" />
//                 <p>Drop file here or click to browse</p>
//               </div>
//               {proofModal.file && (
//                 <div className="rn-file-preview">
//                   {proofModal.preview ? (
//                     <img src={proofModal.preview} alt="preview" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
//                   ) : (
//                     <SvgIcon d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" size={24} color="#e65100" />
//                   )}
//                   <span>{proofModal.file.name}</span>
//                   <button className="rn-copy-btn" onClick={() => setProofModal({ ...proofModal, file: null, preview: null })}>
//                     <SvgIcon d="M18 6 6 18M6 6l12 12" size={14} color="#c62828" />
//                   </button>
//                 </div>
//               )}
//             </div>
//             <div className="rn-modal-foot">
//               <button className="rn-btn rn-btn-gray" onClick={() => setProofModal(null)} disabled={actionLoading}>Cancel</button>
//               <button className="rn-btn rn-btn-teal" onClick={() => handleUploadProof(proofModal)} disabled={actionLoading || !proofModal.file}>
//                 {actionLoading ? 'Uploading...' : 'Upload & Continue'}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── Project Approve Modal ── */}
//       {approveModal && (
//         <div className="rn-modal-overlay" onClick={() => !actionLoading && setApproveModal(null)}>
//           <div className="rn-modal-box" onClick={e => e.stopPropagation()}>
//             <div className="rn-modal-head">
//               <h5>Approve Project</h5>
//               <button className="rn-modal-close" onClick={() => setApproveModal(null)}><SvgIcon d="M18 6 6 18M6 6l12 12" size={18} /></button>
//             </div>
//             <div className="rn-modal-body">
//               <div className="rn-field">
//                 <label>To</label>
//                 <input value={approveModal.email} readOnly style={{ background: '#f1f5f9' }} />
//               </div>
//               <div className="rn-field">
//                 <label>Subject</label>
//                 <input value={`Project Approved \u2013 Internship Studio`} readOnly style={{ background: '#f1f5f9' }} />
//               </div>
//               <div className="rn-field">
//                 <label>Email Preview</label>
//                 <div className="rn-email-preview" dangerouslySetInnerHTML={{ __html: emailProjectApproved(approveModal.name, approveModal.internship_name) }} />
//               </div>
//               <label className="rn-checkbox">
//                 <input type="checkbox" checked={approveModal.skipEmail} onChange={e => setApproveModal({ ...approveModal, skipEmail: e.target.checked })} />
//                 Skip sending email
//               </label>
//             </div>
//             <div className="rn-modal-foot">
//               <button className="rn-btn rn-btn-gray" onClick={() => setApproveModal(null)} disabled={actionLoading}>Cancel</button>
//               <button className="rn-btn rn-btn-green" onClick={() => handleApproveProject(approveModal)} disabled={actionLoading}>
//                 {actionLoading ? 'Processing...' : 'Approve'}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── Project Decline Modal ── */}
//       {declineModal && (
//         <div className="rn-modal-overlay" onClick={() => !actionLoading && setDeclineModal(null)}>
//           <div className="rn-modal-box" onClick={e => e.stopPropagation()}>
//             <div className="rn-modal-head">
//               <h5>Decline Project</h5>
//               <button className="rn-modal-close" onClick={() => setDeclineModal(null)}><SvgIcon d="M18 6 6 18M6 6l12 12" size={18} /></button>
//             </div>
//             <div className="rn-modal-body">
//               <div className="rn-field">
//                 <label>Reason (required)</label>
//                 <textarea value={declineModal.reason} onChange={e => setDeclineModal({ ...declineModal, reason: e.target.value })} placeholder="Reason for declining..." />
//               </div>
//               <div className="rn-field">
//                 <label>To</label>
//                 <input value={declineModal.email} readOnly style={{ background: '#f1f5f9' }} />
//               </div>
//               <div className="rn-field">
//                 <label>Subject</label>
//                 <input value={declineModal.emailSubject} onChange={e => setDeclineModal({ ...declineModal, emailSubject: e.target.value })} />
//               </div>
//               <div className="rn-field">
//                 <label>Email Body</label>
//                 <textarea value={declineModal.emailBody} onChange={e => setDeclineModal({ ...declineModal, emailBody: e.target.value })} style={{ minHeight: 120 }} />
//               </div>
//               <label className="rn-checkbox">
//                 <input type="checkbox" checked={declineModal.skipEmail} onChange={e => setDeclineModal({ ...declineModal, skipEmail: e.target.checked })} />
//                 Skip sending email
//               </label>
//             </div>
//             <div className="rn-modal-foot">
//               <button className="rn-btn rn-btn-gray" onClick={() => setDeclineModal(null)} disabled={actionLoading}>Cancel</button>
//               <button className="rn-btn rn-btn-red" onClick={() => handleDeclineProject(declineModal)} disabled={actionLoading}>
//                 {actionLoading ? 'Processing...' : 'Decline'}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── Proof Viewer ── */}
//       {proofViewer && (
//         <div className="rn-proof-viewer" onClick={() => setProofViewer(null)}>
//           <button className="rn-proof-close" onClick={() => setProofViewer(null)}>X</button>
//           {proofViewer.endsWith('.pdf') ? (
//             <iframe src={proofViewer} title="Proof" style={{ width: '80vw', height: '85vh', border: 'none', borderRadius: 12 }} />
//           ) : (
//             <img src={proofViewer} alt="Proof" onClick={e => e.stopPropagation()} />
//           )}
//         </div>
//       )}
//     </>
//   );
// }




import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/refunds/refund-new.php';

/* ─── constants ─── */
const CLAIM_STYLE = {
  active: { bg: '#f1f5f9', color: '#64748b', dot: '#94a3b8', label: 'Active' },
  under_review: { bg: '#fff7ed', color: '#c2410c', dot: '#fb923c', label: 'Claim Requested' },
  refunded: { bg: '#f0fdf4', color: '#15803d', dot: '#22c55e', label: 'Refunded' },
  rejected: { bg: '#fef2f2', color: '#b91c1c', dot: '#ef4444', label: 'Rejected' },
  completed: { bg: '#ede9fe', color: '#5b21b6', dot: '#8b5cf6', label: 'Completed' },
  project_submitted: { bg: '#fef3c7', color: '#92400e', dot: '#f59e0b', label: 'Proj Submitted' },
  project_approved: { bg: '#f0fdf4', color: '#15803d', dot: '#22c55e', label: 'Proj Approved' },
  project_rejected: { bg: '#fef2f2', color: '#b91c1c', dot: '#ef4444', label: 'Proj Rejected' },
};

const FUNNEL = [
  { key: 'registrations', label: 'Registrations', color: '#4f46e5' },
  { key: 'exam_given', label: 'Exam Given', color: '#7c3aed' },
  { key: 'intent_yes', label: 'Intent Yes', color: '#047857' },
  { key: 'intent_no', label: 'Intent No', color: '#b91c1c' },
  { key: 'result_viewed', label: 'Result Viewed', color: '#0369a1' },
  { key: 'purchased', label: 'Int. Purchased', color: '#b45309' },
  { key: 'refund_claimed', label: 'Refund Claimed', color: '#0f766e' },
];

const DATE_PRESETS = ['All', 'Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days'];

const STAT_CHIPS = [
  { key: '', label: 'Total', accent: '#4f46e5' },
  { key: 'active', label: 'Active', accent: '#64748b' },
  { key: 'completed', label: 'Completed', accent: '#5b21b6' },
  { key: 'under_review', label: 'Claim Req', accent: '#c2410c' },
  { key: 'refunded', label: 'Refunded', accent: '#15803d' },
  { key: 'rejected', label: 'Rejected', accent: '#b91c1c' },
  { key: 'project_submitted', label: 'Proj Sub', accent: '#92400e' },
  { key: 'project_approved', label: 'Proj Appr', accent: '#15803d' },
  { key: 'project_rejected', label: 'Proj Rej', accent: '#b91c1c' },
];

const toISO = d => d.toISOString().split('T')[0];
const fmtD = d => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } };
const attC = v => v >= 80 ? '#15803d' : v >= 50 ? '#c2410c' : '#b91c1c';
const attB = v => v >= 80 ? '#f0fdf4' : v >= 50 ? '#fff7ed' : '#fef2f2';

/* ── email templates ── */
const tplRefund = (name, internship, pid, paid) =>
  `<p>Dear <strong>${name}</strong>,</p><p>Your refund for <strong>${internship}</strong> has been processed.</p><table style="width:100%;border-collapse:collapse;margin:12px 0;"><tr><td style="font-size:11px;color:#94a3b8;padding:3px 0;width:50%">Payment ID</td><td style="font-size:11px;color:#4f46e5;font-weight:700;font-family:monospace">${pid}</td></tr><tr><td style="font-size:11px;color:#94a3b8;padding:3px 0">Paid On</td><td style="font-size:11.5px;font-weight:600">${paid}</td></tr></table><p style="background:#fef3c7;border-left:3px solid #f59e0b;padding:9px 12px;border-radius:0 7px 7px 0;font-size:11px;">Refund will be credited within <strong>5–7 business days</strong>.</p>`;

const tplProjAppr = (name, internship) =>
  `<p>Dear <strong>${name}</strong>,</p><p>Congratulations! Your project for <strong>${internship}</strong> has been <strong>approved</strong>.</p><p>Please login to your dashboard to claim your refund. The refund will be credited within <strong>7–10 working days</strong>.</p>`;

/* ── Icon ── */
const I = ({ d, size = 13, color = 'currentColor', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d={d} />
  </svg>
);
const IC = {
  search: 'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
  x: 'M18 6 6 18M6 6l12 12',
  copy: 'M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-4-4H8zM14 2v6h6',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  down: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  check: 'M20 6 9 17l-5-5',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
};

/* ── Proof popup ── */
function ProofPop({ url }) {
  const [open, setOpen] = useState(false);
  if (!url) return <span style={{ color: '#cbd5e1', fontSize: 10 }}>—</span>;
  const isImg = /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);
  return (
    <>
      <div onClick={() => setOpen(true)}
        style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', border: '2px solid #c4b5fd', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ede9fe', transition: 'transform .15s,border-color .15s' }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.12)'; e.currentTarget.style.borderColor = '#7c3aed'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = '#c4b5fd'; }}>
        {isImg ? <img src={url} alt="proof" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <I d={IC.file} size={13} color="#7c3aed" />}
      </div>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', width: '90vw', height: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 70px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 7 }}><I d={IC.eye} size={13} color="#fff" /> Payment Proof</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={url} target="_blank" rel="noopener" style={{ fontSize: 11, color: '#fff', opacity: .85, padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.3)', textDecoration: 'none' }}>Open ↗</a>
                <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            </div>
            <div style={{ flex: 1, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 20 }}>
              {isImg ? <img src={url} alt="proof" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 10, objectFit: 'contain' }} />
                : <div style={{ textAlign: 'center', color: '#94a3b8' }}><I d={IC.file} size={48} color="#6366f1" style={{ marginBottom: 12 }} /><p style={{ fontSize: 12 }}>Cannot preview this file.</p><a href={url} target="_blank" rel="noopener" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, background: '#4f46e5', color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none', marginTop: 10 }}>Open File</a></div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Modal wrapper ── */
function Modal({ title, onClose, loading, children, footer }) {
  return (
    <div onClick={() => !loading && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, boxShadow: '0 25px 60px rgba(0,0,0,.2)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 18px', borderBottom: '1.5px solid #f5f3ff', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1.5px solid #f5f3ff' }}>{footer}</div>}
      </div>
    </div>
  );
}

const inp = { width: '100%', padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', outline: 'none', color: '#1e293b', background: '#faf9ff', boxSizing: 'border-box' };
const Fld = ({ label, children }) => <div style={{ marginBottom: 13 }}><label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#4f46e5', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>{children}</div>;
const Btn = ({ label, color = 'indigo', onClick, loading, disabled, sm }) => {
  const bg = color === 'red' ? ['#dc2626', '#b91c1c'] : color === 'green' ? ['#16a34a', '#15803d'] : color === 'gray' ? ['#f1f5f9', '#e2e8f0'] : ['#4f46e5', '#4338ca'];
  const [hov, setH] = useState(false);
  return <button onClick={onClick} disabled={disabled || loading} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
    style={{ padding: sm ? '4px 10px' : '7px 16px', borderRadius: sm ? 5 : 8, fontSize: sm ? 10.5 : 12, fontWeight: 600, cursor: disabled || loading ? 'not-allowed' : 'pointer', border: 'none', fontFamily: 'inherit', background: hov ? bg[1] : bg[0], color: color === 'gray' ? '#475569' : '#fff', opacity: disabled ? .5 : 1, transition: 'all .15s', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    {loading ? 'Processing…' : label}
  </button>;
};

/* ── Action badge / buttons ── */
function RefundAction({ row, onConfirm, onReject }) {
  const st = row.refund_claim_status || 'active';
  if (st === 'refunded') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontSize: 10.5, fontWeight: 700 }}><I d={IC.check} size={9} />Refunded</span>;
  if (st === 'rejected') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontSize: 10.5, fontWeight: 700 }}>✕ Rejected</span>;
  const on = st === 'under_review';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button onClick={() => on && onConfirm(row)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: on ? 'pointer' : 'not-allowed', border: 'none', fontFamily: 'inherit', background: on ? '#dcfce7' : '#f1f5f9', color: on ? '#15803d' : '#94a3b8', opacity: on ? 1 : .5, transition: 'all .15s' }} onMouseEnter={e => on && (e.currentTarget.style.background = '#16a34a', e.currentTarget.style.color = '#fff')} onMouseLeave={e => on && (e.currentTarget.style.background = '#dcfce7', e.currentTarget.style.color = '#15803d')}>
        <I d={IC.check} size={9} />Confirm Refund
      </button>
      <button onClick={() => on && onReject(row)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: on ? 'pointer' : 'not-allowed', border: 'none', fontFamily: 'inherit', background: on ? '#fee2e2' : '#f1f5f9', color: on ? '#b91c1c' : '#94a3b8', opacity: on ? 1 : .5, transition: 'all .15s' }} onMouseEnter={e => on && (e.currentTarget.style.background = '#dc2626', e.currentTarget.style.color = '#fff')} onMouseLeave={e => on && (e.currentTarget.style.background = '#fee2e2', e.currentTarget.style.color = '#b91c1c')}>
        ✕ Reject
      </button>
    </div>
  );
}

function ProjectAction({ row, onApprove, onDecline }) {
  const st = row.project_status;
  if (st === 'approved') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontSize: 10.5, fontWeight: 700 }}><I d={IC.check} size={9} />Approved</span>;
  if (st === 'rejected') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontSize: 10.5, fontWeight: 700 }}>✕ Declined</span>;
  const on = st === 'pending';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button onClick={() => on && onApprove(row)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: on ? 'pointer' : 'not-allowed', border: 'none', fontFamily: 'inherit', background: on ? '#ede9fe' : '#f1f5f9', color: on ? '#5b21b6' : '#94a3b8', opacity: on ? 1 : .5, transition: 'all .15s' }} onMouseEnter={e => on && (e.currentTarget.style.background = '#4f46e5', e.currentTarget.style.color = '#fff')} onMouseLeave={e => on && (e.currentTarget.style.background = '#ede9fe', e.currentTarget.style.color = '#5b21b6')}>
        <I d={IC.check} size={9} />Approve
      </button>
      <button onClick={() => on && onDecline(row)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: on ? 'pointer' : 'not-allowed', border: 'none', fontFamily: 'inherit', background: on ? '#fee2e2' : '#f1f5f9', color: on ? '#b91c1c' : '#94a3b8', opacity: on ? 1 : .5, transition: 'all .15s' }} onMouseEnter={e => on && (e.currentTarget.style.background = '#dc2626', e.currentTarget.style.color = '#fff')} onMouseLeave={e => on && (e.currentTarget.style.background = '#fee2e2', e.currentTarget.style.color = '#b91c1c')}>
        ✕ Decline
      </button>
    </div>
  );
}

const avatarColor = name => { const c = ['#4f46e5', '#7c3aed', '#047857', '#b91c1c', '#0369a1', '#b45309', '#0f766e']; let h = 0; for (let i = 0; i < (name || '').length; i++)h = name.charCodeAt(i) + ((h << 5) - h); return c[Math.abs(h) % c.length]; };

/* ══════════════════════════════ MAIN ══════════════════════════════ */
export default function RefundNew() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({});
  const [batches, setBatches] = useState([]);
  const [funnel, setFunnel] = useState({});
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalInput, setGlobalInput] = useState('');
  const [status, setStatus] = useState('');
  const [batch, setBatch] = useState('');
  const [funnelStep, setFunnelStep] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [datePreset, setDatePreset] = useState('All');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  /* modals */
  const [rejectModal, setRejectModal] = useState(null);
  const [proofModal, setProofModal] = useState(null);
  const [approveModal, setApproveModal] = useState(null);
  const [declineModal, setDeclineModal] = useState(null);

  const jumpRef = useRef(null);

  /* ── fetch list ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(API, { params: { page, per_page: perPage, search, global_search: globalSearch, status, batch, funnel_step: funnelStep, date_from: dateFrom, date_to: dateTo } });
      if (res.data.success) {
        const d = res.data.data;
        setData(d.refunds || []); setTotal(d.total || 0); setTotalPages(d.total_pages || 1);
        if (d.stats) setStats(d.stats);
        if (d.batches) setBatches(d.batches);
      }
    } catch { } finally { setLoading(false); }
  }, [page, perPage, search, globalSearch, status, batch, funnelStep, dateFrom, dateTo]);

  /* ── fetch funnel ── */
  const fetchFunnel = useCallback(async () => {
    try { const res = await api.post(API, { action: 'fetch_funnel', date_from: dateFrom, date_to: dateTo, search: globalSearch }); if (res.data.success) setFunnel(res.data.data.funnel || {}); } catch { }
  }, [dateFrom, dateTo, globalSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchFunnel(); }, [fetchFunnel]);

  /* ── real-time row patch ── */
  const patchRow = (uid, iid, patch) => setData(prev => prev.map(r => r.user_id === uid && r.internship_id === iid ? { ...r, ...patch } : r));

  /* ── date preset ── */
  const applyPreset = label => {
    setDatePreset(label);
    if (label === 'All') { setDateFrom(''); setDateTo(''); }
    else {
      const now = new Date();
      if (label === 'Today') { const d = toISO(now); setDateFrom(d); setDateTo(d); }
      else if (label === 'Yesterday') { const y = new Date(now); y.setDate(y.getDate() - 1); const d = toISO(y); setDateFrom(d); setDateTo(d); }
      else { const days = label === 'Last 7 Days' ? 7 : 30; const s = new Date(now); s.setDate(s.getDate() - days + 1); setDateFrom(toISO(s)); setDateTo(toISO(now)); }
    }
    setPage(1);
  };

  /* ── CSV export ── */
  const exportCSV = async () => {
    toast.loading('Exporting…', { id: 'csv' });
    try {
      const res = await api.get(API, { params: { page: 1, per_page: 100000, search, global_search: globalSearch, status, batch, funnel_step: funnelStep, date_from: dateFrom, date_to: dateTo } });
      const rows = res.data?.data?.refunds || [];
      if (!rows.length) { toast.error('No data', { id: 'csv' }); return; }
      const H = ['#', 'Name', 'Email', 'Phone', 'Exam', 'Group', 'Intent', 'Internship', 'Duration', 'Batch', 'Paid At', 'Refund Status', 'Attendance', 'Project', 'File', 'Payment ID'];
      const csv = [H.join(','), ...rows.map((r, i) => [i + 1, `"${r.name}"`, r.email, r.contact, r.exam_given ? 'Yes' : 'No', r.group_joined ? 'Yes' : 'No', r.intent || '', `"${r.internship_name}"`, r.duration || '', `"${r.batch || ''}"`, r.paid_at || '', r.refund_claim_status || 'active', r.attendance || 0, r.project_status || '', r.file_link || '', r.payment_id || ''].join(','))].join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'refund_export.csv'; a.click();
      toast.success(`Exported ${rows.length} rows`, { id: 'csv' });
    } catch { toast.error('Export failed', { id: 'csv' }); }
  };

  /* ── action handlers ── */
  const callPost = async body => api.post(API, body);

  const handleConfirmRefund = async m => {
    setActionLoading(true);
    try {
      let url = m.proofUrl || '';
      if (m.file) {
        const fd = new FormData(); fd.append('action', 'upload_proof'); fd.append('proof', m.file);
        const r = await api.post(API, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        url = r.data?.data?.url || '';
      }
      await callPost({ action: 'update_refund_claim', user_id: m.user_id, internship_id: m.internship_id, status: 'refunded', admin_notes: '', proof_url: url });
      if (!m.skipEmail) await callPost({ action: 'send_email', to: m.email, subject: `Your Refund Has Been Processed – Internship Studio`, html: tplRefund(m.name, m.internship_name, m.payment_id, fmtD(m.paid_at)) });
      patchRow(m.user_id, m.internship_id, { refund_claim_status: 'refunded', proof_url: url });
      toast.success('Refund confirmed'); setProofModal(null);
    } catch { toast.error('Failed'); } finally { setActionLoading(false); }
  };

  const handleReject = async m => {
    if (!m.adminNotes?.trim()) { toast.error('Notes required'); return; }
    setActionLoading(true);
    try {
      await callPost({ action: 'update_refund_claim', user_id: m.user_id, internship_id: m.internship_id, status: 'rejected', admin_notes: m.adminNotes, proof_url: '' });
      if (!m.skipEmail) await callPost({ action: 'send_email', to: m.email, subject: m.emailSubject, html: m.emailBody });
      patchRow(m.user_id, m.internship_id, { refund_claim_status: 'rejected' });
      toast.success('Claim rejected'); setRejectModal(null);
    } catch { toast.error('Failed'); } finally { setActionLoading(false); }
  };

  const handleApproveProject = async m => {
    setActionLoading(true);
    try {
      await callPost({ action: 'approve_project', user_id: m.user_id, internship_id: m.internship_id });
      if (!m.skipEmail) await callPost({ action: 'send_email', to: m.email, subject: `Project Approved – Internship Studio`, html: tplProjAppr(m.name, m.internship_name) });
      patchRow(m.user_id, m.internship_id, { project_status: 'approved' });
      toast.success('Project approved'); setApproveModal(null);
    } catch { toast.error('Failed'); } finally { setActionLoading(false); }
  };

  const handleDeclineProject = async m => {
    if (!m.reason?.trim()) { toast.error('Reason required'); return; }
    setActionLoading(true);
    try {
      await callPost({ action: 'decline_project', user_id: m.user_id, internship_id: m.internship_id, reason: m.reason });
      if (!m.skipEmail) await callPost({ action: 'send_email', to: m.email, subject: m.emailSubject, html: m.emailBody });
      patchRow(m.user_id, m.internship_id, { project_status: 'rejected' });
      toast.success('Project declined'); setDeclineModal(null);
    } catch { toast.error('Failed'); } finally { setActionLoading(false); }
  };

  const pageNums = (() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3) return [1, 2, 3, 4, 5];
    if (page >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [page - 2, page - 1, page, page + 1, page + 2];
  })();

  const fPct = key => (funnel.registrations ? Math.round(((funnel[key] || 0) / funnel.registrations) * 100) : 0);
  const dropOff = i => {
    if (i === 0) return 0;
    const prev = funnel[FUNNEL[i - 1].key] || 0; const cur = funnel[FUNNEL[i].key] || 0;
    if (!prev) return 0; return Math.round(((prev - cur) / prev) * 100);
  };

  /* ══════════════ RENDER ══════════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .rn2-root{font-family:'Plus Jakarta Sans',sans-serif;min-height:100vh;background:#f5f3ff;display:flex;flex-direction:column;}

        /* hero */
        .rn2-hero{background:linear-gradient(135deg,#3730a3,#4f46e5);padding:14px 20px;color:#fff;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;flex-shrink:0;}
        .rn2-hero h1{font-size:16px;font-weight:800;margin:0;display:flex;align-items:center;gap:8px;}
        .rn2-hero-sub{font-size:10px;color:rgba(255,255,255,.55);margin-top:3px;}
        .rn2-export{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);color:#fff;padding:6px 13px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:5px;transition:all .15s;}
        .rn2-export:hover{background:rgba(255,255,255,.25);}

        /* date bar */
        .rn2-datebar{background:#fff;border-bottom:1.5px solid #ede9fe;padding:7px 20px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex-shrink:0;}
        .rn2-seg{display:inline-flex;border:1.5px solid #ede9fe;border-radius:8px;overflow:hidden;}
        .rn2-seg button{padding:4px 11px;font-size:10.5px;font-weight:600;border:none;background:#fff;color:#64748b;cursor:pointer;font-family:inherit;transition:all .12s;border-right:1px solid #ede9fe;}
        .rn2-seg button:last-child{border-right:none;}
        .rn2-seg button.act{background:#4f46e5;color:#fff;}
        .rn2-seg button:hover:not(.act){background:#f5f3ff;}
        .rn2-datebar input[type=date]{padding:4px 8px;border:1.5px solid #ede9fe;border-radius:8px;font-size:11px;font-family:inherit;color:#334155;outline:none;}
        .rn2-datebar input[type=date]:focus{border-color:#4f46e5;}
        .rn2-gsearch{flex:1;min-width:160px;max-width:260px;padding:4px 9px;border:1.5px solid #ede9fe;border-radius:8px;font-size:11.5px;font-family:inherit;outline:none;color:#334155;}
        .rn2-gsearch:focus{border-color:#4f46e5;}
        .rn2-apply{background:#4f46e5;color:#fff;border:none;padding:5px 13px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;}
        .rn2-apply:hover{background:#4338ca;}

        /* funnel — 100% width, flex, equal columns */
        .rn2-funnel{background:#fff;border-bottom:1.5px solid #ede9fe;padding:10px 20px;display:flex;align-items:stretch;width:100%;box-sizing:border-box;flex-shrink:0;}
        .rn2-fcol{flex:1;min-width:0;padding:10px 6px;border-radius:10px;text-align:center;cursor:pointer;transition:all .15s;border:2px solid transparent;position:relative;}
        .rn2-fcol:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.08);}
        .rn2-fcol.factive{border-color:currentColor;box-shadow:0 4px 16px rgba(0,0,0,.12);}
        .rn2-fcount{font-size:clamp(14px,2vw,22px);font-weight:800;margin:3px 0 1px;}
        .rn2-flabel{font-size:clamp(8px,0.9vw,10px);font-weight:600;text-transform:uppercase;letter-spacing:.4px;opacity:.8;}
        .rn2-fpct{font-size:clamp(8px,0.85vw,10px);font-weight:700;margin-top:3px;}
        .rn2-fbar{height:3px;border-radius:2px;margin-top:5px;background:rgba(255,255,255,.3);overflow:hidden;}
        .rn2-fbarfill{height:100%;border-radius:2px;transition:width .4s;}
        .rn2-farrow{display:flex;align-items:center;justify-content:center;width:28px;flex-shrink:0;}
        .rn2-fdrop{font-size:9px;font-weight:700;padding:1px 5px;border-radius:10px;white-space:nowrap;}

        /* chips */
        .rn2-chips{background:#fff;border-bottom:1.5px solid #ede9fe;padding:7px 20px;display:flex;flex-wrap:wrap;gap:5px;flex-shrink:0;}
        .rn2-chip{padding:3px 10px;border-radius:20px;font-size:10px;font-weight:600;border:1.5px solid #e2e8f0;cursor:pointer;transition:all .15s;background:#fff;white-space:nowrap;display:flex;align-items:center;gap:4px;}
        .rn2-chip:hover{border-color:#4f46e5;}
        .rn2-chip.chact{background:#f5f3ff;border-color:#4f46e5;color:#4f46e5 !important;}

        /* filters */
        .rn2-filters{background:#fff;border-bottom:1.5px solid #ede9fe;padding:6px 20px;display:flex;flex-wrap:wrap;align-items:center;gap:7px;flex-shrink:0;}
        .rn2-searchbox{display:flex;align-items:center;background:#faf9ff;border:1.5px solid #e2e8f0;border-radius:8px;overflow:hidden;flex:1;max-width:300px;min-width:180px;}
        .rn2-searchbox input{flex:1;border:none;background:transparent;padding:5px 9px;font-size:11.5px;font-family:inherit;outline:none;color:#334155;}
        .rn2-sel{padding:5px 9px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:11.5px;font-family:inherit;outline:none;color:#334155;background:#faf9ff;cursor:pointer;}
        .rn2-bp{display:inline-flex;align-items:center;gap:4px;padding:5px 13px;border-radius:8px;font-size:11.5px;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:all .15s;white-space:nowrap;background:#4f46e5;color:#fff;}
        .rn2-bp:hover{background:#4338ca;}
        .rn2-bo{display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border-radius:8px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;background:#f1f5f9;color:#475569;border:1.5px solid #e2e8f0;}
        .rn2-bo:hover{background:#e2e8f0;}

        /* body */
        .rn2-body{flex:1;overflow:hidden;display:flex;flex-direction:column;padding:10px 20px 10px;}
        .rn2-card{flex:1;overflow:hidden;display:flex;flex-direction:column;background:#fff;border-radius:12px;border:1.5px solid #ede9fe;box-shadow:0 1px 8px rgba(79,70,229,.06);}
        .rn2-tw{flex:1;overflow:auto;}
        .rn2-tw::-webkit-scrollbar{width:5px;height:5px;}
        .rn2-tw::-webkit-scrollbar-track{background:#f5f3ff;}
        .rn2-tw::-webkit-scrollbar-thumb{background:#c4b5fd;border-radius:10px;}
        table.rn2-t{width:100%;border-collapse:collapse;table-layout:auto;min-width:1600px;}
        table.rn2-t thead tr{background:linear-gradient(135deg,#4f46e5,#7c3aed);}
        table.rn2-t thead th{color:#fff;font-size:9.5px;font-weight:600;padding:9px 8px;white-space:nowrap;text-align:left;letter-spacing:.4px;text-transform:uppercase;border-right:1px solid rgba(255,255,255,.15);position:sticky;top:0;z-index:2;}
        table.rn2-t thead th:last-child{border-right:none;}
        table.rn2-t tbody tr{border-bottom:1px solid #f5f3ff;transition:background .12s;}
        table.rn2-t tbody tr:hover{background:#faf9ff;}
        table.rn2-t tbody tr.hl{background:#fff7ed;}
        table.rn2-t td{font-size:11px;color:#334155;padding:7px 8px;vertical-align:middle;white-space:nowrap;border-right:1px solid #f5f3ff;}
        table.rn2-t td:last-child{border-right:none;}
        table.rn2-t .sticky{position:sticky;z-index:1;background:#fff;}
table.rn2-t thead .sticky{z-index:3;background:#5b21b6;}
table.rn2-t tbody tr.hl .sticky{background:#fff7ed;}
table.rn2-t tbody tr:hover .sticky{background:#faf9ff;}
.sticky-ra{right:155px;min-width:155px;box-shadow:-3px 0 6px rgba(79,70,229,0.08);}
.sticky-pa{right:0;min-width:155px;}
        .pill{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:20px;font-size:9.5px;font-weight:600;white-space:nowrap;}
        .copy-btn{background:none;border:none;cursor:pointer;color:#c4b5fd;padding:0 2px;transition:color .15s;display:inline-flex;align-items:center;}
        .copy-btn:hover{color:#7c3aed;}
        .av{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0;}

        /* footer */
        .rn2-footer{display:flex;align-items:center;justify-content:space-between;padding:7px 14px;border-top:1.5px solid #f5f3ff;background:#faf9ff;border-radius:0 0 12px 12px;flex-wrap:wrap;gap:6px;}
        .rn2-pi{font-size:11px;color:#94a3b8;}
        .rn2-pg{display:flex;align-items:center;gap:3px;}
        .pgb{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:24px;padding:0 5px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:10.5px;font-weight:600;cursor:pointer;background:#fff;color:#475569;font-family:inherit;transition:all .15s;}
        .pgb:hover:not(:disabled){border-color:#4f46e5;color:#4f46e5;}
        .pgb.active{background:#4f46e5;border-color:#4f46e5;color:#fff;}
        .pgb:disabled{opacity:.35;cursor:not-allowed;}
        .pgj{display:flex;align-items:center;gap:4px;}
        .pgj input{width:52px;border:1.5px solid #e2e8f0;border-radius:6px;padding:3px 5px;font-size:10.5px;font-family:inherit;outline:none;text-align:center;}
        .pgj input:focus{border-color:#4f46e5;}
        .pgj button{background:#4f46e5;color:#fff;border:none;border-radius:6px;padding:3px 9px;font-size:10.5px;font-weight:600;cursor:pointer;font-family:inherit;}

        /* loader */
        .rn2-loader{position:fixed;inset:0;background:rgba(245,243,255,.75);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(2px);}
        .rn2-spin{width:36px;height:36px;border:3px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:rn2spin .7s linear infinite;}
        @keyframes rn2spin{to{transform:rotate(360deg);}}
        .no-data{text-align:center;padding:36px;color:#94a3b8;font-size:12px;}
      `}</style>

      {loading && <div className="rn2-loader"><div className="rn2-spin" /></div>}

      <div className="rn2-root" style={{ height: '100vh', overflow: 'hidden' }}>

        {/* HERO */}
        <div className="rn2-hero">
          <div>
            <h1><I d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" size={18} color="#fff" />Refund Panel</h1>
            <div className="rn2-hero-sub">Registrations → Exam Given → Intent(Yes/No) → Result Viewed → Purchased → Refund Claimed</div>
          </div>
          <button className="rn2-export" onClick={exportCSV}><I d={IC.down} size={13} color="#fff" />Export CSV</button>
        </div>

        {/* DATE BAR */}
        <div className="rn2-datebar">
          <div className="rn2-seg">
            {DATE_PRESETS.map(p => <button key={p} className={datePreset === p ? 'act' : ''} onClick={() => applyPreset(p)}>{p}</button>)}
          </div>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setDatePreset(''); }} />
          <span style={{ fontSize: 11, color: '#94a3b8' }}>to</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setDatePreset(''); }} />
          <input className="rn2-gsearch" placeholder="Global search (email, ID, phone)…" value={globalInput} onChange={e => setGlobalInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (setGlobalSearch(globalInput), setPage(1))} />
          <button className="rn2-apply" onClick={() => { setGlobalSearch(globalInput); setPage(1); }}>Apply</button>
        </div>

        {/* FUNNEL — 100% width */}
        <div className="rn2-funnel">
          {FUNNEL.map((step, i) => {
            const cnt = funnel[step.key] || 0;
            const pct = fPct(step.key);
            const drop = dropOff(i);
            const dc = drop >= 40 ? '#dc2626' : drop >= 10 ? '#d97706' : '#059669';
            const db = drop >= 40 ? '#fef2f2' : drop >= 10 ? '#fffbeb' : '#f0fdf9';
            return (
              <div key={step.key} style={{ display: 'flex', alignItems: 'stretch', flex: i === 0 ? '1' : 'auto', minWidth: 0 }}>
                {i > 0 && (
                  <div className="rn2-farrow">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <span style={{ color: '#c4b5fd', fontSize: 14 }}>→</span>
                      <span className="rn2-fdrop" style={{ background: db, color: dc }}>-{drop}%</span>
                    </div>
                  </div>
                )}
                <div className={`rn2-fcol${funnelStep === step.key ? ' factive' : ''}`}
                  style={{ background: step.color + '12', color: step.color, flex: 1, minWidth: 0 }}
                  onClick={() => { setFunnelStep(funnelStep === step.key ? '' : step.key); setPage(1); }}>
                  <div className="rn2-fcount" style={{ color: step.color }}>{cnt.toLocaleString()}</div>
                  <div className="rn2-flabel">{step.label}</div>
                  <div className="rn2-fpct">{pct}%</div>
                  <div className="rn2-fbar" style={{ background: step.color + '22' }}>
                    <div className="rn2-fbarfill" style={{ width: `${pct}%`, background: step.color }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* STATUS CHIPS */}
        <div className="rn2-chips">
          {STAT_CHIPS.map(c => (
            <div key={c.key} className={`rn2-chip${status === c.key ? ' chact' : ''}`} style={{ color: c.accent }} onClick={() => { setStatus(status === c.key ? '' : c.key); setPage(1); }}>
              <span>{c.label}</span>
              <strong>{(stats[c.key || 'total']) || 0}</strong>
            </div>
          ))}
        </div>

        {/* FILTERS */}
        <div className="rn2-filters">
          <div className="rn2-searchbox">
            <I d={IC.search} size={12} color="#94a3b8" style={{ marginLeft: 8, flexShrink: 0 }} />
            <input placeholder="Search name, email, phone, internship, payment ID…" value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (setSearch(searchInput), setPage(1))} />
            {searchInput && <button className="copy-btn" style={{ paddingRight: 6 }} onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}><I d={IC.x} size={11} /></button>}
          </div>
          <select className="rn2-sel" value={batch} onChange={e => { setBatch(e.target.value); setPage(1); }}>
            <option value="">All Batches</option>
            {batches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select className="rn2-sel" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            {Object.entries(CLAIM_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="rn2-sel" value={perPage} onChange={e => { setPerPage(+e.target.value); setPage(1); }}>
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} rows</option>)}
          </select>
          <button className="rn2-bp" onClick={() => { setSearch(searchInput); setPage(1); }}><I d={IC.search} size={12} />Search</button>
          <button className="rn2-bo" onClick={() => { setSearchInput(''); setSearch(''); setStatus(''); setBatch(''); setPage(1); }}><I d={IC.x} size={12} />Clear</button>
        </div>

        {/* TABLE */}
        <div className="rn2-body">
          <div className="rn2-card">
            <div className="rn2-tw">
              <table className="rn2-t">
                <thead>
                  <tr>
                    {['#', 'Student', 'Phone', 'Exam', 'Group', 'Intent', 'Internship', 'Duration', 'Batch', 'Paid At', 'Refund Status', 'Attendance', 'Project Sub', 'File', 'Proj Approved', 'Payment Info', 'Proof'].map(h => <th key={h}>{h}</th>)}
                    <th className="sticky sticky-ra" style={{ right: 120 }}>Refund Action</th>
                    <th className="sticky sticky-pa" style={{ right: 0 }}>Project Action</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && data.length === 0 && <tr><td colSpan={19} className="no-data">No refund records found</td></tr>}
                  {data.map((r, i) => {
                    const cs = CLAIM_STYLE[r.refund_claim_status || 'active'] || CLAIM_STYLE.active;
                    const ps = r.project_status ? { pending: { bg: '#fff7ed', color: '#c2410c', dot: '#fb923c', label: 'Pending' }, approved: { bg: '#f0fdf4', color: '#15803d', dot: '#22c55e', label: 'Approved' }, rejected: { bg: '#fef2f2', color: '#b91c1c', dot: '#ef4444', label: 'Rejected' } }[r.project_status] : null;
                    const att = parseFloat(r.attendance) || 0;
                    const isHL = r.refund_claim_status === 'under_review';
                    return (
                      <tr key={`${r.user_id}-${r.internship_id}`} className={isHL ? 'hl' : ''}>
                        <td style={{ color: '#94a3b8', fontSize: 10, textAlign: 'center' }}>{(page - 1) * perPage + i + 1}</td>

                        {/* Student */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div className="av" style={{ background: avatarColor(r.name) }}>{(r.name || '?')[0].toUpperCase()}</div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 11.5 }}>{r.name}</div>
                              <div style={{ fontSize: 9.5, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>
                                {r.email}
                                <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(r.email); toast.success('Copied!'); }}>
                                  <I d={IC.copy} size={10} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={{ fontSize: 11 }}>{r.contact || '—'}{r.contact && <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(r.contact); toast.success('Copied!'); }}><I d={IC.copy} size={10} /></button>}</td>

                        {/* Exam */}
                        <td><span className="pill" style={{ background: r.exam_given ? '#f0fdf4' : '#fef2f2', color: r.exam_given ? '#15803d' : '#b91c1c' }}>{r.exam_given ? 'Yes' : 'No'}</span></td>

                        {/* Group */}
                        <td><span className="pill" style={{ background: r.group_joined ? '#f0fdf4' : '#fef2f2', color: r.group_joined ? '#15803d' : '#b91c1c' }}>{r.group_joined ? 'Yes' : 'No'}</span></td>

                        {/* Intent */}
                        <td>{r.intent ? <span className="pill" style={{ background: r.intent === 'yes' ? '#f0fdf4' : '#fef2f2', color: r.intent === 'yes' ? '#15803d' : '#b91c1c' }}>{r.intent === 'yes' ? 'Yes' : 'No'}</span> : '—'}</td>

                        {/* Internship */}
                        <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }} title={r.internship_name}>{r.internship_name || '—'}</td>
                        <td style={{ fontSize: 10.5 }}>{r.duration || '—'}</td>
                        <td style={{ fontSize: 10.5 }}>{r.batch || '—'}</td>
                        <td style={{ fontSize: 10.5, color: '#64748b' }}>{fmtD(r.paid_at)}</td>

                        {/* Claim Status */}
                        <td>
                          <span className="pill" style={{ background: cs.bg, color: cs.color }}>
                            <svg width="5" height="5" viewBox="0 0 6 6"><circle cx="3" cy="3" r="3" fill={cs.dot} /></svg>
                            {cs.label}
                          </span>
                        </td>

                        {/* Attendance */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontWeight: 700, color: attC(att), fontSize: 11 }}>{att}%</span>
                            <div style={{ width: 44, height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(att, 100)}%`, height: '100%', background: attC(att), borderRadius: 2 }} />
                            </div>
                          </div>
                        </td>

                        {/* Project Sub */}
                        <td>
                          {ps ? (<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span className="pill" style={{ background: ps.bg, color: ps.color }}><svg width="5" height="5" viewBox="0 0 6 6"><circle cx="3" cy="3" r="3" fill={ps.dot} /></svg>{ps.label}</span>
                            {r.project_submitted_date && <span style={{ fontSize: 9, color: '#94a3b8' }}>{fmtD(r.project_submitted_date)}</span>}
                          </div>) : '—'}
                        </td>

                        {/* File */}
                        <td>{r.file_link ? <a href={r.file_link} target="_blank" rel="noreferrer" style={{ color: '#4f46e5', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}><I d={IC.link} size={11} />View</a> : '—'}</td>

                        {/* Project Approved */}
                        <td>{r.project_status === 'approved' ? (<div><span className="pill" style={{ background: '#f0fdf4', color: '#15803d' }}>✓ Approved</span>{r.project_approved_date && <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>{fmtD(r.project_approved_date)}</div>}</div>) : '—'}</td>

                        {/* Payment Info */}
                        <td>
                          <div style={{ fontSize: 9.5, fontWeight: 600, color: '#15803d' }}>{fmtD(r.paid_at)}</div>
                          {r.payment_id && <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#1e293b' }}>{r.payment_id}</span>
                            <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(r.payment_id); toast.success('Copied!'); }}><I d={IC.copy} size={10} /></button>
                          </div>}
                        </td>

                        {/* Proof */}
                        <td><ProofPop url={r.proof_url} /></td>

                        {/* Refund Action sticky */}
                        <td className="sticky sticky-ra" style={{ right: 120 }}>
                          <RefundAction row={r}
                            onConfirm={row => setProofModal({ user_id: row.user_id, internship_id: row.internship_id, name: row.name, email: row.email, internship_name: row.internship_name, payment_id: row.payment_id, paid_at: row.paid_at, file: null, preview: null, skipEmail: false })}
                            onReject={row => setRejectModal({ user_id: row.user_id, internship_id: row.internship_id, name: row.name, email: row.email, internship_name: row.internship_name, adminNotes: '', emailSubject: `Refund Claim Update – Internship Studio`, emailBody: `Dear ${row.name},\n\nAfter reviewing your refund claim for ${row.internship_name}, we regret to inform you that we are unable to process it at this time.\n\nWarm regards,\nInternship Studio Team`, skipEmail: false })}
                          />
                        </td>

                        {/* Project Action sticky */}
                        <td className="sticky sticky-pa" style={{ right: 0 }}>
                          <ProjectAction row={r}
                            onApprove={row => setApproveModal({ user_id: row.user_id, internship_id: row.internship_id, name: row.name, email: row.email, internship_name: row.internship_name, skipEmail: false })}
                            onDecline={row => setDeclineModal({ user_id: row.user_id, internship_id: row.internship_id, name: row.name, email: row.email, internship_name: row.internship_name, reason: '', emailSubject: `Project Submission Update – Internship Studio`, emailBody: `Dear ${row.name},\n\nThank you for submitting your project for ${row.internship_name}. After review, your submission was not approved.\n\nWarm regards,\nInternship Studio Team`, skipEmail: false })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* FOOTER */}
            <div className="rn2-footer">
              <span className="rn2-pi">{total > 0 ? `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} of ${total.toLocaleString()}` : '0 results'}</span>
              <div className="rn2-pg">
                <button className="pgb" disabled={page <= 1} onClick={() => setPage(1)}>«</button>
                <button className="pgb" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</button>
                {pageNums.map(p => <button key={p} className={`pgb${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>)}
                <button className="pgb" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>›</button>
                <button className="pgb" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>»</button>
              </div>
              <div className="pgj">
                <input ref={jumpRef} type="number" min={1} max={totalPages} placeholder="Page" onKeyDown={e => e.key === 'Enter' && (v => { if (v >= 1 && v <= totalPages) setPage(v); else toast.error('Invalid page'); })(parseInt(jumpRef.current?.value))} />
                <button onClick={() => { const v = parseInt(jumpRef.current?.value); if (v >= 1 && v <= totalPages) setPage(v); else toast.error('Invalid page'); }}>Go</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ MODALS ══ */}

      {/* Upload Proof + Confirm */}
      {proofModal && (
        <Modal title="Upload Proof & Confirm Refund" onClose={() => !actionLoading && setProofModal(null)} loading={actionLoading}
          footer={<><Btn label="Cancel" color="gray" onClick={() => setProofModal(null)} disabled={actionLoading} /><Btn label={actionLoading ? 'Processing…' : 'Confirm Refund'} onClick={() => handleConfirmRefund(proofModal)} loading={actionLoading} disabled={!proofModal.file} /></>}>
          <p style={{ fontSize: 12, color: '#475569', margin: '0 0 14px', padding: '8px 12px', background: '#f5f3ff', borderRadius: 8, borderLeft: '3px solid #4f46e5' }}>
            <strong>{proofModal.name}</strong> — {proofModal.internship_name}
          </p>
          <Fld label="Upload Refund Proof">
            <div onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*,.pdf'; i.onchange = e => { const f = e.target.files[0]; if (f) setProofModal({ ...proofModal, file: f, preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null }); }; i.click(); }}
              style={{ border: '2px dashed #c4b5fd', borderRadius: 10, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', transition: 'all .15s', background: '#faf9ff' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.background = '#f5f3ff'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#c4b5fd'; e.currentTarget.style.background = '#faf9ff'; }}>
              <I d={IC.upload} size={24} color="#7c3aed" />
              <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#94a3b8' }}>Click to upload proof (image or PDF)</p>
            </div>
            {proofModal.file && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 8, marginTop: 8, fontSize: 11, color: '#334155' }}>
                {proofModal.preview ? <img src={proofModal.preview} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} /> : <I d={IC.file} size={22} color="#7c3aed" />}
                <span style={{ flex: 1 }}>{proofModal.file.name}</span>
                <button className="copy-btn" style={{ color: '#ef4444' }} onClick={() => setProofModal({ ...proofModal, file: null, preview: null })}><I d={IC.x} size={13} /></button>
              </div>
            )}
          </Fld>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={proofModal.skipEmail} onChange={e => setProofModal({ ...proofModal, skipEmail: e.target.checked })} style={{ accentColor: '#4f46e5' }} /> Skip email notification
          </label>
        </Modal>
      )}

      {/* Reject */}
      {rejectModal && (
        <Modal title="Reject Refund Claim" onClose={() => !actionLoading && setRejectModal(null)} loading={actionLoading}
          footer={<><Btn label="Cancel" color="gray" onClick={() => setRejectModal(null)} disabled={actionLoading} /><Btn label="Reject Claim" color="red" onClick={() => handleReject(rejectModal)} loading={actionLoading} /></>}>
          <p style={{ fontSize: 12, color: '#475569', margin: '0 0 14px', padding: '8px 12px', background: '#fef2f2', borderRadius: 8, borderLeft: '3px solid #dc2626' }}>
            <strong>{rejectModal.name}</strong> — {rejectModal.internship_name}
          </p>
          <Fld label="Rejection Notes *">
            <textarea value={rejectModal.adminNotes} style={{ ...inp, minHeight: 70, resize: 'vertical' }} placeholder="Required: reason for rejection…" onChange={e => setRejectModal({ ...rejectModal, adminNotes: e.target.value })} />
          </Fld>
          <Fld label="Email Subject">
            <input value={rejectModal.emailSubject} style={inp} onChange={e => setRejectModal({ ...rejectModal, emailSubject: e.target.value })} />
          </Fld>
          <Fld label="Email Body">
            <textarea value={rejectModal.emailBody} style={{ ...inp, minHeight: 100, resize: 'vertical' }} onChange={e => setRejectModal({ ...rejectModal, emailBody: e.target.value })} />
          </Fld>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={rejectModal.skipEmail} onChange={e => setRejectModal({ ...rejectModal, skipEmail: e.target.checked })} style={{ accentColor: '#4f46e5' }} /> Skip email notification
          </label>
        </Modal>
      )}

      {/* Approve Project */}
      {approveModal && (
        <Modal title="Approve Project" onClose={() => !actionLoading && setApproveModal(null)} loading={actionLoading}
          footer={<><Btn label="Cancel" color="gray" onClick={() => setApproveModal(null)} disabled={actionLoading} /><Btn label="Approve Project" color="green" onClick={() => handleApproveProject(approveModal)} loading={actionLoading} /></>}>
          <p style={{ fontSize: 12, color: '#475569', margin: '0 0 14px', padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, borderLeft: '3px solid #16a34a' }}>
            Approving project for <strong>{approveModal.name}</strong> — {approveModal.internship_name}
          </p>
          <div style={{ background: '#f5f3ff', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: '#475569', lineHeight: 1.7 }}>
            The student will be notified that their project is approved and they can now claim their refund. Refund will be credited within 7–10 working days.
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#475569', cursor: 'pointer', marginTop: 14 }}>
            <input type="checkbox" checked={approveModal.skipEmail} onChange={e => setApproveModal({ ...approveModal, skipEmail: e.target.checked })} style={{ accentColor: '#4f46e5' }} /> Skip email notification
          </label>
        </Modal>
      )}

      {/* Decline Project */}
      {declineModal && (
        <Modal title="Decline Project" onClose={() => !actionLoading && setDeclineModal(null)} loading={actionLoading}
          footer={<><Btn label="Cancel" color="gray" onClick={() => setDeclineModal(null)} disabled={actionLoading} /><Btn label="Decline Project" color="red" onClick={() => handleDeclineProject(declineModal)} loading={actionLoading} /></>}>
          <p style={{ fontSize: 12, color: '#475569', margin: '0 0 14px', padding: '8px 12px', background: '#fef2f2', borderRadius: 8, borderLeft: '3px solid #dc2626' }}>
            Declining project for <strong>{declineModal.name}</strong> — {declineModal.internship_name}
          </p>
          <Fld label="Reason *">
            <textarea value={declineModal.reason} style={{ ...inp, minHeight: 70, resize: 'vertical' }} placeholder="Required: reason for declining…" onChange={e => setDeclineModal({ ...declineModal, reason: e.target.value })} />
          </Fld>
          <Fld label="Email Subject">
            <input value={declineModal.emailSubject} style={inp} onChange={e => setDeclineModal({ ...declineModal, emailSubject: e.target.value })} />
          </Fld>
          <Fld label="Email Body">
            <textarea value={declineModal.emailBody} style={{ ...inp, minHeight: 100, resize: 'vertical' }} onChange={e => setDeclineModal({ ...declineModal, emailBody: e.target.value })} />
          </Fld>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={declineModal.skipEmail} onChange={e => setDeclineModal({ ...declineModal, skipEmail: e.target.checked })} style={{ accentColor: '#4f46e5' }} /> Skip email notification
          </label>
        </Modal>
      )}
    </>
  );
}