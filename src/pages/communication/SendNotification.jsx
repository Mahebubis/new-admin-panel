// import { useState, useEffect, useRef } from 'react';
// import api from '../../api/axios';
// import toast from 'react-hot-toast';

// const LOCAL_API = '/api/communication/communication.php';
// const FILTER_API = 'https://cit.internshipstudio.com/api/filtered_data_for_notification.php';
// const STORE_API = 'https://cit.internshipstudio.com/api/store_single_notification.php';
// const BATCH_API = 'https://cit.internshipstudio.com/api/send_notification_batch.php';
// const BATCH_SIZE = 1000;
// const FH = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
// const mk = obj => new URLSearchParams(obj);

// /* ─── shared styles ─── */
// const inp = {
//   width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
//   fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box',
// };
// const section = {
//   background: '#fff', borderRadius: 12, border: '1.5px solid #ede9fe',
//   boxShadow: '0 1px 8px rgba(79,70,229,.05)', padding: 18,
// };

// export default function SendNotification() {
//   const [citCount, setCitCount] = useState(0);
//   const [citSelected, setCitSelected] = useState([]); // selected version numbers
//   const [examGiven, setExamGiven] = useState(''); // ''|'yes'|'no'
//   const [payStatus, setPayStatus] = useState(''); // ''|'paid'|'unpaid'
//   const [citModal, setCitModal] = useState(false);
//   const [filtering, setFiltering] = useState(false);
//   const [recordCount, setRecordCount] = useState(null);
//   const [filteredUsers, setFilteredUsers] = useState([]);
//   const [title, setTitle] = useState('');
//   const [link, setLink] = useState('');
//   const [message, setMessage] = useState('');
//   const [attachment, setAttachment] = useState(null);
//   const [posting, setPosting] = useState(false);
//   const [progress, setProgress] = useState(0);
//   const fileRef = useRef(null);

//   /* ── load CIT version count from local API — same as PHP's SQL ── */
//   useEffect(() => {
//     api.post(LOCAL_API, mk({ action: 'get_cit_version_count' }), FH)
//       .then(res => { if (res.data.status === 'success') setCitCount(res.data.count || 0); })
//       .catch(() => { });
//   }, []);

//   /* ── toggle CIT checkbox ── */
//   const toggleCit = (v) => setCitSelected(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
//   const toggleAllCit = (checked) => setCitSelected(checked ? Array.from({ length: citCount }, (_, i) => i + 1) : []);

//   /* ── exam given change — disables payment status if "no" ── */
//   const handleExamChange = (val) => {
//     setExamGiven(val);
//     if (val !== 'yes') setPayStatus(''); // clear payment when exam is not yes
//   };

//   /* ── Apply Filters — same logic as PHP's submitNotificationFilters click ── */
//   const applyFilters = async () => {
//     if (citSelected.length === 0) { toast.error('Please select at least one CIT version'); return; }
//     setFiltering(true); setRecordCount(null); setFilteredUsers([]);

//     const payload = { versions: citSelected };
//     if (examGiven) payload.exam_given = examGiven;
//     if (examGiven === 'yes' && payStatus) payload.payment = payStatus;

//     try {
//       const res = await fetch(FILTER_API, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(payload),
//       });
//       const data = await res.json();
//       const users = Array.isArray(data) ? data : (data.data || []);
//       const count = typeof data.count === 'number' ? data.count : users.length;
//       setFilteredUsers(users);
//       setRecordCount(count);
//       toast.success(`${count} records found`);
//     } catch { toast.error('Failed to fetch notification data'); }
//     finally { setFiltering(false); }
//   };

//   /* ── Clear filters — same as PHP's clearNotificationFilters ── */
//   const clearFilters = () => {
//     setCitSelected([]); setExamGiven(''); setPayStatus('');
//     setRecordCount(null); setFilteredUsers([]); setProgress(0);
//   };

//   /* ── Post notifications — exact same batch logic as PHP ── */
//   const handlePost = async () => {
//     if (!title.trim()) { toast.error('Please enter a title'); return; }
//     if (!message.trim()) { toast.error('Please enter a message'); return; }
//     if (!filteredUsers.length) { toast.error('No filtered users. Apply filters first.'); return; }

//     setPosting(true); setProgress(0);

//     try {
//       /* Step 1: store_single_notification.php — get batch ID + attachment URL */
//       const storeFd = new FormData();
//       storeFd.append('payment', filteredUsers[0]?.payment || '');
//       storeFd.append('exam_given', filteredUsers[0]?.exam_given || '');
//       storeFd.append('title', title);
//       storeFd.append('message', message);
//       storeFd.append('redirection_link', link);
//       if (attachment) storeFd.append('attachment', attachment);

//       const storeRes = await fetch(STORE_API, { method: 'POST', body: storeFd });
//       const storeData = await storeRes.json();

//       if (!storeData.success) {
//         toast.error('Failed to record notification batch: ' + (storeData.message || ''));
//         setPosting(false); return;
//       }

//       const notificationBatchId = storeData.id;
//       const attached_url = storeData.attachment_url;
//       const total = filteredUsers.length;

//       /* Step 2: send_notification_batch.php — batches of 1000 same as PHP ── */
//       for (let i = 0; i < total; i += BATCH_SIZE) {
//         const batch = filteredUsers.slice(i, i + BATCH_SIZE);

//         const batchFd = new FormData();
//         batchFd.append('batch', JSON.stringify(batch));
//         batchFd.append('notification_id', notificationBatchId);
//         batchFd.append('attachment_url', attached_url);
//         batchFd.append('title', title);
//         batchFd.append('message', message);
//         batchFd.append('redirection_link', link);

//         const batchRes = await fetch(BATCH_API, { method: 'POST', body: batchFd });
//         const batchData = await batchRes.json();

//         if (batchData.success) {
//           const pct = Math.min(Math.round(((i + BATCH_SIZE) / total) * 100), 100);
//           setProgress(pct);
//         } else {
//           console.error('Batch error:', batchData.message);
//         }
//       }

//       toast.success('All notifications posted!');
//       setProgress(100);
//     } catch (err) {
//       toast.error('Error posting notifications');
//       console.error(err);
//     } finally { setPosting(false); }
//   };

//   const canPost = filteredUsers.length > 0 && !posting;

//   /* ════════ RENDER ════════ */
//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         .sn-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
//         .sn-radio{accent-color:#4f46e5;width:15px;height:15px;cursor:pointer;}
//         .sn-cb{accent-color:#4f46e5;width:14px;height:14px;cursor:pointer;}
//         progress.sn-bar{width:100%;height:14px;border-radius:99px;overflow:hidden;appearance:none;}
//         progress.sn-bar::-webkit-progress-bar{background:#ede9fe;border-radius:99px;}
//         progress.sn-bar::-webkit-progress-value{background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:99px;transition:width .3s;}
//         progress.sn-bar::-moz-progress-bar{background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:99px;}
//         .sn-inp:focus{border-color:#4f46e5!important;box-shadow:0 0 0 3px rgba(79,70,229,.08)!important;}
//         @keyframes sn_spin{to{transform:rotate(360deg)}}
//       `}</style>

//       <div className="sn-root" style={{
//         display: 'flex', flexDirection: 'column',
//         height: 'calc(100vh - 62px)',
//         padding: 20, gap: 14, overflow: 'hidden', background: '#f5f3ff',
//       }}>
//         {/* ── HEADER ── */}
//         <div style={{ flexShrink: 0, fontSize: 17, fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
//           🔔 Send Notifications
//         </div>

//         {/* ── MAIN 2-COL LAYOUT ── */}
//         <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, overflow: 'hidden' }}>

//           {/* ══════ LEFT — FILTERS ══════ */}
//           <div style={{ ...section, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
//             <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>Filters</div>

//             {/* CIT Version picker */}
//             <div>
//               <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>
//                 CIT Versions
//               </div>
//               <button onClick={() => setCitModal(true)}
//                 style={{
//                   padding: '8px 16px', border: '1.5px solid #c4b5fd', background: '#ede9fe',
//                   color: '#4f46e5', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer'
//                 }}>
//                 📋 Select CIT Versions {citSelected.length > 0 && `(${citSelected.length} selected)`}
//               </button>
//             </div>

//             {/* Exam Given */}
//             <div>
//               <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>
//                 Exam Given
//               </div>
//               <div style={{ display: 'flex', gap: 20 }}>
//                 {['yes', 'no'].map(v => (
//                   <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: '#334155' }}>
//                     <input type="radio" className="sn-radio" name="examGiven" value={v}
//                       checked={examGiven === v} onChange={() => handleExamChange(v)} />
//                     {v.charAt(0).toUpperCase() + v.slice(1)}
//                   </label>
//                 ))}
//               </div>
//             </div>

//             {/* Payment Status — only active when exam = yes */}
//             <div style={{ opacity: examGiven === 'yes' ? 1 : .4, transition: 'opacity .2s' }}>
//               <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>
//                 Payment Status
//               </div>
//               <div style={{ display: 'flex', gap: 20 }}>
//                 {['paid', 'unpaid'].map(v => (
//                   <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: examGiven === 'yes' ? 'pointer' : 'not-allowed', fontSize: 12.5, fontWeight: 600, color: '#334155' }}>
//                     <input type="radio" className="sn-radio" name="payStatus" value={v}
//                       checked={payStatus === v} disabled={examGiven !== 'yes'}
//                       onChange={() => setPayStatus(v)} />
//                     {v.charAt(0).toUpperCase() + v.slice(1)}
//                   </label>
//                 ))}
//               </div>
//             </div>

//             {/* Buttons */}
//             <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto', paddingTop: 12, borderTop: '1.5px solid #f1f5f9' }}>
//               <button onClick={applyFilters} disabled={filtering}
//                 style={{
//                   padding: '9px 20px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
//                   color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
//                   cursor: filtering ? 'not-allowed' : 'pointer', opacity: filtering ? .7 : 1,
//                   display: 'flex', alignItems: 'center', gap: 7
//                 }}>
//                 {filtering ? (
//                   <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'sn_spin .7s linear infinite' }} />Fetching...</>
//                 ) : '🔍 Apply Filters'}
//               </button>
//               <button onClick={clearFilters}
//                 style={{
//                   padding: '9px 16px', border: '1.5px solid #e2e8f0', background: '#f8fafc',
//                   color: '#475569', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer'
//                 }}>
//                 ✕ Clear
//               </button>
//               {recordCount !== null && (
//                 <span style={{
//                   fontSize: 12.5, fontWeight: 700, color: '#4f46e5',
//                   background: '#ede9fe', padding: '6px 12px', borderRadius: 8
//                 }}>
//                   {recordCount} records
//                 </span>
//               )}
//             </div>
//           </div>

//           {/* ══════ RIGHT — MESSAGE ══════ */}
//           <div style={{ ...section, display: 'flex', flexDirection: 'column', gap: 13, overflowY: 'auto' }}>
//             <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>Message</div>

//             <div>
//               <label style={{
//                 display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748b',
//                 textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5
//               }}>Title *</label>
//               <input className="sn-inp" style={inp} value={title}
//                 onChange={e => setTitle(e.target.value)} placeholder="Enter notification title" />
//             </div>

//             <div>
//               <label style={{
//                 display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748b',
//                 textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5
//               }}>Redirection Link</label>
//               <input className="sn-inp" style={inp} value={link}
//                 onChange={e => setLink(e.target.value)} placeholder="Enter URL to redirect (optional)" />
//             </div>

//             <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
//               <label style={{
//                 display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748b',
//                 textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5
//               }}>Message *</label>
//               <textarea className="sn-inp" style={{ ...inp, resize: 'none', flex: 1, minHeight: 120 }}
//                 value={message} onChange={e => setMessage(e.target.value)}
//                 placeholder="Type your notification here..." />
//             </div>

//             <div>
//               <label style={{
//                 display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748b',
//                 textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5
//               }}>Attachment (Image)</label>
//               <input ref={fileRef} type="file" accept="image/*"
//                 onChange={e => setAttachment(e.target.files[0])}
//                 style={{ ...inp, padding: '7px 10px', cursor: 'pointer', fontSize: 12 }} />
//               {attachment && (
//                 <div style={{ marginTop: 5, fontSize: 11.5, color: '#16a34a', fontWeight: 600 }}>
//                   ✓ {attachment.name}
//                 </div>
//               )}
//             </div>

//             {/* Post button */}
//             <button onClick={handlePost} disabled={!canPost}
//               style={{
//                 padding: '10px 24px', background: canPost ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#e2e8f0',
//                 color: canPost ? '#fff' : '#94a3b8', border: 'none', borderRadius: 8, fontSize: 13,
//                 fontWeight: 700, cursor: canPost ? 'pointer' : 'not-allowed',
//                 display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start'
//               }}>
//               {posting ? (
//                 <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'sn_spin .7s linear infinite' }} />Posting...</>
//               ) : '📤 Post Notification'}
//             </button>

//             {/* Progress bar */}
//             <div>
//               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11.5, fontWeight: 700, color: '#64748b' }}>
//                 <span>Posting Progress</span>
//                 <span style={{ color: '#4f46e5' }}>{progress}%</span>
//               </div>
//               <progress className="sn-bar" value={progress} max={100} />
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* ══════ CIT VERSIONS MODAL ══════ */}
//       {citModal && (
//         <div style={{
//           position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
//           display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
//         }}>
//           <div style={{
//             background: '#fff', borderRadius: 14, width: '100%', maxWidth: 600,
//             maxHeight: '75vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.25)',
//             display: 'flex', flexDirection: 'column'
//           }}>

//             <div style={{
//               padding: '14px 20px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
//               borderRadius: '14px 14px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
//             }}>
//               <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>📋 Select CIT Versions</span>
//               <button onClick={() => setCitModal(false)}
//                 style={{
//                   background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 6,
//                   width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 18
//                 }}>×</button>
//             </div>

//             <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
//               {/* Select all */}
//               <label style={{
//                 display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
//                 fontSize: 12.5, fontWeight: 700, color: '#4f46e5', cursor: 'pointer'
//               }}>
//                 <input type="checkbox" className="sn-cb"
//                   checked={citSelected.length === citCount && citCount > 0}
//                   onChange={e => toggleAllCit(e.target.checked)} />
//                 Select All ({citCount} versions)
//               </label>
//               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px 12px' }}>
//                 {Array.from({ length: citCount }, (_, i) => i + 1).map(v => (
//                   <label key={v}
//                     style={{
//                       display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
//                       padding: '7px 10px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
//                       border: `1.5px solid ${citSelected.includes(v) ? '#c4b5fd' : '#e2e8f0'}`,
//                       background: citSelected.includes(v) ? '#f5f3ff' : '#f8fafc',
//                       color: citSelected.includes(v) ? '#4f46e5' : '#64748b',
//                       userSelect: 'none', transition: 'all .15s'
//                     }}>
//                     <input type="checkbox" className="sn-cb" checked={citSelected.includes(v)}
//                       onChange={() => toggleCit(v)} />
//                     CIT {v}
//                   </label>
//                 ))}
//               </div>
//             </div>

//             <div style={{
//               padding: '12px 20px', borderTop: '1.5px solid #f1f5f9',
//               display: 'flex', justifyContent: 'flex-end', gap: 10
//             }}>
//               <button onClick={() => setCitModal(false)}
//                 style={{
//                   padding: '9px 20px', border: '1.5px solid #e2e8f0', background: '#f8fafc',
//                   color: '#475569', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer'
//                 }}>
//                 Close
//               </button>
//               <button onClick={() => setCitModal(false)}
//                 style={{
//                   padding: '9px 24px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
//                   color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer'
//                 }}>
//                 ✓ Apply ({citSelected.length})
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }






import { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const LOCAL_API  = '/api/communication/communication.php';
const FILTER_API = 'https://cit.internshipstudio.com/api/filtered_data_for_notification.php';
const STORE_API  = 'https://cit.internshipstudio.com/api/store_single_notification.php';
const BATCH_API  = 'https://cit.internshipstudio.com/api/send_notification_batch.php';
const BATCH_SIZE = 1000;
const FH = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk = obj => new URLSearchParams(obj);

/* ─── shared styles ─── */
const inp = {
  width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8,
  fontSize:12.5, fontFamily:'inherit', color:'#1e293b', outline:'none', boxSizing:'border-box',
};
const section = {
  background:'#fff', borderRadius:12, border:'1.5px solid #ede9fe',
  boxShadow:'0 1px 8px rgba(79,70,229,.05)', padding:18,
};


/* ─── Quill editor for notification message ─── */
function MsgQuillEditor({ onReady }) {
  useEffect(() => {
    const doInit = () => {
      if (!window.Quill) return;
      // Remove old instance first
      if (window.Quill.find && window.Quill.find(document.getElementById('sn-msg-editor'))) return;
      const el = document.getElementById('sn-msg-editor');
      if (!el) return;
      const q = new window.Quill('#sn-msg-editor', {
        theme: 'snow',
        placeholder: 'Type your notification message here...',
        modules: {
          toolbar: [
            [{ header:[1,2,3,false] }],
            ['bold','italic','underline','strike'],
            [{ list:'ordered' },{ list:'bullet' }],
            [{ color:[] },{ background:[] }],
            ['link'],
            ['clean'],
          ],
        },
      });
      onReady(q);
    };
    if (window.Quill) { setTimeout(doInit, 80); return; }
    if (!document.getElementById('quill-css')) {
      const lnk = document.createElement('link');
      lnk.id = 'quill-css'; lnk.rel = 'stylesheet';
      lnk.href = 'https://cdn.quilljs.com/1.3.6/quill.snow.css';
      document.head.appendChild(lnk);
    }
    if (!window._quillLoading) {
      window._quillLoading = true;
      const s = document.createElement('script');
      s.src = 'https://cdn.quilljs.com/1.3.6/quill.js';
      s.onload = () => { window._quillLoading = false; setTimeout(doInit, 80); };
      document.head.appendChild(s);
    } else {
      const wait = setInterval(() => { if (window.Quill) { clearInterval(wait); setTimeout(doInit, 80); } }, 100);
    }
  }, []);
  return (
    <div style={{ border:'1.5px solid #e2e8f0', borderRadius:8, overflow:'hidden' }}>
      <div id="sn-msg-editor" style={{ minHeight:200, fontFamily:'inherit', fontSize:13 }}/>
    </div>
  );
}

export default function SendNotification() {
  const [citCount,     setCitCount]     = useState(0);
  const [citSelected,  setCitSelected]  = useState([]); // selected version numbers
  const [examGiven,    setExamGiven]    = useState(''); // ''|'yes'|'no'
  const [payStatus,    setPayStatus]    = useState(''); // ''|'paid'|'unpaid'
  const [citModal,     setCitModal]     = useState(false);
  const [filtering,    setFiltering]    = useState(false);
  const [recordCount,  setRecordCount]  = useState(null);
  const [filteredUsers,setFilteredUsers]= useState([]);
  const [title,        setTitle]        = useState('');
  const [link,         setLink]         = useState('');
  const [message,      setMessage]      = useState('');
  const [attachment,   setAttachment]   = useState(null);
  const [posting,      setPosting]      = useState(false);
  const [progress,     setProgress]     = useState(0);
  const fileRef    = useRef(null);
  const msgQuillRef = useRef(null); // Quill instance for message

  /* ── load CIT version count from local API — same as PHP's SQL ── */
  useEffect(() => {
    api.post(LOCAL_API, mk({ action:'get_cit_version_count' }), FH)
      .then(res => { if (res.data.status === 'success') setCitCount(res.data.count || 0); })
      .catch(() => {});
  }, []);

  /* ── toggle CIT checkbox ── */
  const toggleCit = (v) => setCitSelected(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const toggleAllCit = (checked) => setCitSelected(checked ? Array.from({length:citCount}, (_,i) => i+1) : []);

  /* ── exam given change — disables payment status if "no" ── */
  const handleExamChange = (val) => {
    setExamGiven(val);
    if (val !== 'yes') setPayStatus(''); // clear payment when exam is not yes
  };

  /* ── Apply Filters — same logic as PHP's submitNotificationFilters click ── */
  const applyFilters = async () => {
    if (citSelected.length === 0) { toast.error('Please select at least one CIT version'); return; }
    setFiltering(true); setRecordCount(null); setFilteredUsers([]);

    const payload = { versions: citSelected };
    if (examGiven) payload.exam_given = examGiven;
    if (examGiven === 'yes' && payStatus) payload.payment = payStatus;

    try {
      const res  = await fetch(FILTER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const users = Array.isArray(data) ? data : (data.data || []);
      const count = typeof data.count === 'number' ? data.count : users.length;
      setFilteredUsers(users);
      setRecordCount(count);
      toast.success(`${count} records found`);
    } catch { toast.error('Failed to fetch notification data'); }
    finally { setFiltering(false); }
  };

  /* ── Clear filters — same as PHP's clearNotificationFilters ── */
  const clearFilters = () => {
    setCitSelected([]); setExamGiven(''); setPayStatus('');
    setRecordCount(null); setFilteredUsers([]); setProgress(0);
  };

  /* ── Post notifications — exact same batch logic as PHP ── */
  const handlePost = async () => {
    if (!title.trim())   { toast.error('Please enter a title'); return; }
    const msgHtml = msgQuillRef.current?.root?.innerHTML || '';
    const msgText = msgQuillRef.current?.getText?.()?.trim() || '';
    if (!msgText) { toast.error('Please enter a message'); return; }
    if (!filteredUsers.length) { toast.error('No filtered users. Apply filters first.'); return; }

    setPosting(true); setProgress(0);

    try {
      /* Step 1: store_single_notification.php — get batch ID + attachment URL */
      const storeFd = new FormData();
      storeFd.append('payment',    filteredUsers[0]?.payment    || '');
      storeFd.append('exam_given', filteredUsers[0]?.exam_given || '');
      storeFd.append('title',       title);
      storeFd.append('message',     msgHtml);
      storeFd.append('redirection_link', link);
      if (attachment) storeFd.append('attachment', attachment);

      const storeRes  = await fetch(STORE_API, { method:'POST', body: storeFd });
      const storeData = await storeRes.json();

      if (!storeData.success) {
        toast.error('Failed to record notification batch: ' + (storeData.message || ''));
        setPosting(false); return;
      }

      const notificationBatchId = storeData.id;
      const attached_url        = storeData.attachment_url;
      const total               = filteredUsers.length;

      /* Step 2: send_notification_batch.php — batches of 1000 same as PHP ── */
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = filteredUsers.slice(i, i + BATCH_SIZE);

        const batchFd = new FormData();
        batchFd.append('batch',            JSON.stringify(batch));
        batchFd.append('notification_id',  notificationBatchId);
        batchFd.append('attachment_url',   attached_url);
        batchFd.append('title',            title);
        batchFd.append('message',          msgHtml);
        batchFd.append('redirection_link', link);

        const batchRes  = await fetch(BATCH_API, { method:'POST', body: batchFd });
        const batchData = await batchRes.json();

        if (batchData.success) {
          const pct = Math.min(Math.round(((i + BATCH_SIZE) / total) * 100), 100);
          setProgress(pct);
        } else {
          console.error('Batch error:', batchData.message);
        }
      }

      toast.success('All notifications posted!');
      setProgress(100);
    } catch (err) {
      toast.error('Error posting notifications');
      console.error(err);
    } finally { setPosting(false); }
  };

  const canPost = filteredUsers.length > 0 && !posting;

  /* ════════ RENDER ════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .sn-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .sn-radio{accent-color:#4f46e5;width:15px;height:15px;cursor:pointer;}
        .sn-cb{accent-color:#4f46e5;width:14px;height:14px;cursor:pointer;}
        progress.sn-bar{width:100%;height:14px;border-radius:99px;overflow:hidden;appearance:none;}
        progress.sn-bar::-webkit-progress-bar{background:#ede9fe;border-radius:99px;}
        progress.sn-bar::-webkit-progress-value{background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:99px;transition:width .3s;}
        progress.sn-bar::-moz-progress-bar{background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:99px;}
        .sn-inp:focus{border-color:#4f46e5!important;box-shadow:0 0 0 3px rgba(79,70,229,.08)!important;}
        .ql-toolbar{border-radius:8px 8px 0 0!important;background:#f8fafc!important;border:none!important;border-bottom:1px solid #e2e8f0!important;}
        .ql-container{border-radius:0 0 8px 8px!important;border:none!important;font-size:13px!important;}
        .ql-editor.ql-blank::before{font-style:normal!important;color:#94a3b8!important;}
        @keyframes sn_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="sn-root" style={{
        display:'flex', flexDirection:'column',
        height:'calc(100vh - 62px)',
        padding:20, gap:14, overflow:'hidden', background:'#f5f3ff',
      }}>
        {/* ── HEADER ── */}
        <div style={{ flexShrink:0, fontSize:17, fontWeight:800, color:'#1e293b', display:'flex', alignItems:'center', gap:10 }}>
          🔔 Send Notifications
        </div>

        {/* ── MAIN 2-COL LAYOUT ── */}
        <div style={{ flex:1, minHeight:0, display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, overflow:'hidden' }}>

          {/* ══════ LEFT — FILTERS ══════ */}
          <div style={{ ...section, display:'flex', flexDirection:'column', gap:16, overflowY:'auto' }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#1e293b' }}>Filters</div>

            {/* CIT Version picker */}
            <div>
              <div style={{ fontSize:10.5, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:8 }}>
                CIT Versions
              </div>
              <button onClick={() => setCitModal(true)}
                style={{ padding:'8px 16px', border:'1.5px solid #c4b5fd', background:'#ede9fe',
                  color:'#4f46e5', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer' }}>
                📋 Select CIT Versions {citSelected.length > 0 && `(${citSelected.length} selected)`}
              </button>
            </div>

            {/* Exam Given */}
            <div>
              <div style={{ fontSize:10.5, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:8 }}>
                Exam Given
              </div>
              <div style={{ display:'flex', gap:20 }}>
                {['yes','no'].map(v => (
                  <label key={v} style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', fontSize:12.5, fontWeight:600, color:'#334155' }}>
                    <input type="radio" className="sn-radio" name="examGiven" value={v}
                      checked={examGiven === v} onChange={() => handleExamChange(v)}/>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            {/* Payment Status — only active when exam = yes */}
            <div style={{ opacity: examGiven === 'yes' ? 1 : .4, transition:'opacity .2s' }}>
              <div style={{ fontSize:10.5, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:8 }}>
                Payment Status
              </div>
              <div style={{ display:'flex', gap:20 }}>
                {['paid','unpaid'].map(v => (
                  <label key={v} style={{ display:'flex', alignItems:'center', gap:7, cursor: examGiven==='yes'?'pointer':'not-allowed', fontSize:12.5, fontWeight:600, color:'#334155' }}>
                    <input type="radio" className="sn-radio" name="payStatus" value={v}
                      checked={payStatus === v} disabled={examGiven !== 'yes'}
                      onChange={() => setPayStatus(v)}/>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:'auto', paddingTop:12, borderTop:'1.5px solid #f1f5f9' }}>
              <button onClick={applyFilters} disabled={filtering}
                style={{ padding:'9px 20px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
                  color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700,
                  cursor: filtering?'not-allowed':'pointer', opacity: filtering?.7:1,
                  display:'flex', alignItems:'center', gap:7 }}>
                {filtering ? (
                  <><div style={{ width:14,height:14,border:'2px solid rgba(255,255,255,.4)',borderTop:'2px solid #fff',borderRadius:'50%',animation:'sn_spin .7s linear infinite' }}/>Fetching...</>
                ) : '🔍 Apply Filters'}
              </button>
              <button onClick={clearFilters}
                style={{ padding:'9px 16px', border:'1.5px solid #e2e8f0', background:'#f8fafc',
                  color:'#475569', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>
                ✕ Clear
              </button>
              {recordCount !== null && (
                <span style={{ fontSize:12.5, fontWeight:700, color:'#4f46e5',
                  background:'#ede9fe', padding:'6px 12px', borderRadius:8 }}>
                  {recordCount} records
                </span>
              )}
            </div>
          </div>

          {/* ══════ RIGHT — MESSAGE ══════ */}
          <div style={{ ...section, display:'flex', flexDirection:'column', gap:13, overflowY:'auto' }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#1e293b' }}>Message</div>

            <div>
              <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'#64748b',
                textTransform:'uppercase', letterSpacing:'.4px', marginBottom:5 }}>Title *</label>
              <input className="sn-inp" style={inp} value={title}
                onChange={e => setTitle(e.target.value)} placeholder="Enter notification title"/>
            </div>

            <div>
              <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'#64748b',
                textTransform:'uppercase', letterSpacing:'.4px', marginBottom:5 }}>Redirection Link</label>
              <input className="sn-inp" style={inp} value={link}
                onChange={e => setLink(e.target.value)} placeholder="Enter URL to redirect (optional)"/>
            </div>

            <div>
              <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'#64748b',
                textTransform:'uppercase', letterSpacing:'.4px', marginBottom:5 }}>Message *</label>
              <MsgQuillEditor onReady={q => { msgQuillRef.current = q; }}/>
            </div>

            <div>
              <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'#64748b',
                textTransform:'uppercase', letterSpacing:'.4px', marginBottom:5 }}>Attachment (Image)</label>
              <input ref={fileRef} type="file" accept="image/*"
                onChange={e => setAttachment(e.target.files[0])}
                style={{ ...inp, padding:'7px 10px', cursor:'pointer', fontSize:12 }}/>
              {attachment && (
                <div style={{ marginTop:5, fontSize:11.5, color:'#16a34a', fontWeight:600 }}>
                  ✓ {attachment.name}
                </div>
              )}
            </div>

            {/* Post button */}
            <button onClick={handlePost} disabled={!canPost}
              style={{ padding:'10px 24px', background: canPost ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#e2e8f0',
                color: canPost ? '#fff' : '#94a3b8', border:'none', borderRadius:8, fontSize:13,
                fontWeight:700, cursor: canPost?'pointer':'not-allowed',
                display:'flex', alignItems:'center', gap:8, alignSelf:'flex-start' }}>
              {posting ? (
                <><div style={{ width:16,height:16,border:'2px solid rgba(255,255,255,.4)',borderTop:'2px solid #fff',borderRadius:'50%',animation:'sn_spin .7s linear infinite' }}/>Posting...</>
              ) : '📤 Post Notification'}
            </button>

            {/* Progress bar */}
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:11.5, fontWeight:700, color:'#64748b' }}>
                <span>Posting Progress</span>
                <span style={{ color:'#4f46e5' }}>{progress}%</span>
              </div>
              <progress className="sn-bar" value={progress} max={100}/>
            </div>
          </div>
        </div>
      </div>

      {/* ══════ CIT VERSIONS MODAL ══════ */}
      {citModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:1000,
          display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:600,
            maxHeight:'75vh', overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.25)',
            display:'flex', flexDirection:'column' }}>

            <div style={{ padding:'14px 20px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
              borderRadius:'14px 14px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:14, fontWeight:700, color:'#fff' }}>📋 Select CIT Versions</span>
              <button onClick={() => setCitModal(false)}
                style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:6,
                  width:28, height:28, cursor:'pointer', color:'#fff', fontSize:18 }}>×</button>
            </div>

            <div style={{ padding:20, overflowY:'auto', flex:1 }}>
              {/* Select all */}
              <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14,
                fontSize:12.5, fontWeight:700, color:'#4f46e5', cursor:'pointer' }}>
                <input type="checkbox" className="sn-cb"
                  checked={citSelected.length === citCount && citCount > 0}
                  onChange={e => toggleAllCit(e.target.checked)}/>
                Select All ({citCount} versions)
              </label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'10px 12px' }}>
                {Array.from({ length: citCount }, (_, i) => i + 1).map(v => (
                  <label key={v}
                    style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer',
                      padding:'7px 10px', borderRadius:8, fontSize:12.5, fontWeight:600,
                      border:`1.5px solid ${citSelected.includes(v) ? '#c4b5fd' : '#e2e8f0'}`,
                      background: citSelected.includes(v) ? '#f5f3ff' : '#f8fafc',
                      color: citSelected.includes(v) ? '#4f46e5' : '#64748b',
                      userSelect:'none', transition:'all .15s' }}>
                    <input type="checkbox" className="sn-cb" checked={citSelected.includes(v)}
                      onChange={() => toggleCit(v)}/>
                    CIT {v}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ padding:'12px 20px', borderTop:'1.5px solid #f1f5f9',
              display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button onClick={() => setCitModal(false)}
                style={{ padding:'9px 20px', border:'1.5px solid #e2e8f0', background:'#f8fafc',
                  color:'#475569', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>
                Close
              </button>
              <button onClick={() => setCitModal(false)}
                style={{ padding:'9px 24px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
                  color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer' }}>
                ✓ Apply ({citSelected.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}