import { useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/internship-system/allocate_internships.php';

/* ─── shared styles ─── */
const btnPri = {
  padding:'9px 22px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
  color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700,
  cursor:'pointer', fontFamily:'inherit'
};
const inp = {
  width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8,
  fontSize:12.5, fontFamily:'inherit', color:'#1e293b', outline:'none', boxSizing:'border-box'
};
const sel = { ...inp, cursor:'pointer' };
const thS = {
  color:'#fff', fontSize:11, fontWeight:600, padding:'11px 12px',
  textAlign:'left', textTransform:'uppercase', letterSpacing:'.3px',
  borderRight:'1px solid rgba(255,255,255,.15)', whiteSpace:'nowrap'
};
const tdS = {
  padding:'9px 12px', borderBottom:'1px solid #f5f3ff',
  color:'#334155', fontSize:12, verticalAlign:'middle'
};

/* ─── step states ─── */
const STEP = { UPLOAD: 'upload', PREVIEW: 'preview', DONE: 'done' };

export default function AllocateInternships() {
  const [step,        setStep]        = useState(STEP.UPLOAD);
  const [file,        setFile]        = useState(null);
  const [payType,     setPayType]     = useState('razorpay');
  const [uploading,   setUploading]   = useState(false);
  const [allocating,  setAllocating]  = useState(false);
  const [activeTab,   setActiveTab]   = useState('non_matched');
  const [preview,     setPreview]     = useState({ matched:[], non_matched:[], matched_cnt:0, pending_cnt:0 });
  const [result,      setResult]      = useState(null);   // { inserted, skipped }

  /* ── upload & parse CSV ── */
  const uploadFile = async () => {
    if (!file) { toast.error('Please select a CSV file'); return; }
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'csv') { toast.error('Please upload a CSV file only'); return; }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file',         file);
      fd.append('payment_type', payType);
      fd.append('action',       'upload_bulk_data_filtered');

      const res = await api.post(API, fd, { headers: { 'Content-Type': undefined } });

      if (!res.data.success) {
        toast.error(res.data.message || 'Upload failed');
        return;
      }

      setPreview(res.data);
      setStep(STEP.PREVIEW);
      toast.success(`File processed — ${res.data.pending_cnt} pending, ${res.data.matched_cnt} already matched`);
    } catch (e) {
      toast.error('Server error during upload');
    } finally {
      setUploading(false);
    }
  };

  /* ── allocate all non-matched ── */
  const allocateAll = async () => {
    if (preview.pending_cnt === 0) { toast.error('No pending records to allocate'); return; }
    setAllocating(true);
    try {
      const res = await api.post(API,
        new URLSearchParams({ action: 'allocate_bulk_internships' }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      if (res.data.success) {
        setResult({ inserted: res.data.inserted, skipped: res.data.skipped });
        setStep(STEP.DONE);
      } else {
        toast.error(res.data.message || 'Allocation failed');
      }
    } catch (e) {
      toast.error('Server error during allocation');
    } finally {
      setAllocating(false);
    }
  };

  const reset = () => {
    setStep(STEP.UPLOAD);
    setFile(null);
    setPreview({ matched:[], non_matched:[], matched_cnt:0, pending_cnt:0 });
    setResult(null);
    setActiveTab('non_matched');
  };

  /* ════════════════════════════
     RENDER
  ════════════════════════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .ai-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .ai-tab-btn{padding:9px 20px;border:none;background:none;cursor:pointer;
          font-family:inherit;font-size:12.5px;font-weight:600;color:#64748b;
          border-bottom:2.5px solid transparent;transition:all .2s;}
        .ai-tab-btn.active{color:#4f46e5;border-bottom-color:#4f46e5;}
        .ai-tab-btn:hover{color:#4f46e5;}
        .ai-tr:hover td{background:#faf9ff!important;}
        @keyframes ai_spin{to{transform:rotate(360deg)}}
        @keyframes ai_prog{0%{width:0%}100%{width:100%}}
      `}</style>

      <div className="ai-root" style={{ background:'#f5f3ff', minHeight:'100vh', padding:24 }}>

        {/* page title */}
        <div style={{ fontSize:18, fontWeight:800, color:'#1e293b',
          display:'flex', alignItems:'center', gap:10, marginBottom:22 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth={2.5}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Allocate Internships (Bulk)
        </div>

        {/* ── STEP 1: UPLOAD ── */}
        {step === STEP.UPLOAD && (
          <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #ede9fe',
            boxShadow:'0 1px 8px rgba(79,70,229,.06)', overflow:'hidden' }}>
            <div style={{ padding:'14px 22px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
              fontSize:13, fontWeight:700, color:'#fff' }}>
              Upload CSV File
            </div>
            <div style={{ padding:24 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>

                <div>
                  <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'#64748b',
                    textTransform:'uppercase', letterSpacing:'.4px', marginBottom:5 }}>
                    Upload CSV File
                  </label>
                  <input type="file" accept=".csv" style={inp}
                    onChange={e => setFile(e.target.files[0])}/>
                  <small style={{ fontSize:10.5, color:'#94a3b8', marginTop:4, display:'block' }}>
                    Only .csv files supported
                  </small>
                </div>

                <div>
                  <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'#64748b',
                    textTransform:'uppercase', letterSpacing:'.4px', marginBottom:5 }}>
                    Payment Type
                  </label>
                  <select style={sel} value={payType} onChange={e => setPayType(e.target.value)}>
                    <option value="razorpay">Razorpay</option>
                    <option value="phonepe">PhonePe</option>
                    <option value="hdfc_smartgateway">HDFC SmartGateway</option>
                  </select>
                  {payType === 'phonepe' && (
                    <small style={{ fontSize:10.5, color:'#dc2626', marginTop:4, display:'block' }}>
                      Upload the Transaction Report sheet
                    </small>
                  )}
                  {payType === 'hdfc_smartgateway' && (
                    <small style={{ fontSize:10.5, color:'#dc2626', marginTop:4, display:'block' }}>
                      Sheet must have: customer_id, order_id, description, amount, payment_status columns
                    </small>
                  )}
                </div>
              </div>

              <div style={{ textAlign:'center' }}>
                <button style={{ ...btnPri, padding:'11px 40px', fontSize:13 }}
                  onClick={uploadFile} disabled={uploading}>
                  {uploading ? (
                    <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,.4)',
                        borderTop:'2px solid #fff', borderRadius:'50%',
                        animation:'ai_spin .7s linear infinite', display:'inline-block' }}/>
                      Processing...
                    </span>
                  ) : '📤 Upload & Parse File'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: PREVIEW TABS ── */}
        {step === STEP.PREVIEW && (
          <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #ede9fe',
            boxShadow:'0 1px 8px rgba(79,70,229,.06)', overflow:'hidden' }}>

            {/* header bar */}
            <div style={{ padding:'14px 22px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
              display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>File Parsed Successfully</span>
              <div style={{ display:'flex', gap:12 }}>
                <span style={{ padding:'4px 14px', background:'rgba(255,255,255,.2)',
                  borderRadius:99, fontSize:12, color:'#fff', fontWeight:600 }}>
                  🟡 Pending: {preview.pending_cnt}
                </span>
                <span style={{ padding:'4px 14px', background:'rgba(255,255,255,.2)',
                  borderRadius:99, fontSize:12, color:'#fff', fontWeight:600 }}>
                  ✅ Matched: {preview.matched_cnt}
                </span>
              </div>
            </div>

            {/* tabs */}
            <div style={{ borderBottom:'1.5px solid #f1f5f9', padding:'0 22px',
              display:'flex', gap:4, background:'#fafafa' }}>
              <button className={`ai-tab-btn${activeTab === 'non_matched' ? ' active' : ''}`}
                onClick={() => setActiveTab('non_matched')}>
                Non-Matched ({preview.pending_cnt})
              </button>
              <button className={`ai-tab-btn${activeTab === 'matched' ? ' active' : ''}`}
                onClick={() => setActiveTab('matched')}>
                Matched ({preview.matched_cnt})
              </button>
            </div>

            {/* allocate button — only on non-matched tab */}
            {activeTab === 'non_matched' && (
              <div style={{ padding:'14px 22px', borderBottom:'1.5px solid #f1f5f9',
                display:'flex', alignItems:'center', gap:14 }}>
                <button
                  style={{ ...btnPri, background:'linear-gradient(135deg,#16a34a,#15803d)',
                    opacity: allocating ? .7 : 1 }}
                  onClick={allocateAll}
                  disabled={allocating || preview.pending_cnt === 0}>
                  {allocating ? (
                    <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ width:14, height:14, border:'2px solid rgba(255,255,255,.4)',
                        borderTop:'2px solid #fff', borderRadius:'50%',
                        animation:'ai_spin .7s linear infinite', display:'inline-block' }}/>
                      Allocating...
                    </span>
                  ) : '✅ Allocate Internship To All'}
                </button>
                {allocating && (
                  <div style={{ flex:1, height:10, background:'#ede9fe', borderRadius:99, overflow:'hidden' }}>
                    <div style={{ height:'100%', background:'linear-gradient(90deg,#4f46e5,#7c3aed)',
                      borderRadius:99, animation:'ai_prog 2s ease-in-out infinite' }}/>
                  </div>
                )}
                <button onClick={reset}
                  style={{ padding:'8px 16px', border:'1.5px solid #e2e8f0', background:'#f8fafc',
                    color:'#64748b', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  ↩ Upload New File
                </button>
              </div>
            )}

            {/* table */}
            <div style={{ overflowX:'auto', maxHeight:500, overflowY:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead style={{ position:'sticky', top:0, zIndex:2 }}>
                  <tr style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                    {['User ID','Email','Payment ID','Amount','Internship','Paid At'].map(h => (
                      <th key={h} style={thS}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeTab === 'non_matched' && (
                    preview.non_matched.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign:'center', color:'#94a3b8', padding:32 }}>
                        No non-matched records
                      </td></tr>
                    ) : preview.non_matched.map((r, i) => (
                      <tr key={i} className="ai-tr">
                        <td style={tdS}>{r.user_id}</td>
                        <td style={{ ...tdS, color:'#4f46e5' }}>{r.email}</td>
                        <td style={{ ...tdS, fontSize:11, color:'#64748b' }}>{r.payment_id}</td>
                        <td style={tdS}>₹{r.amount}</td>
                        <td style={{ ...tdS, fontWeight:600 }}>{r.internship}</td>
                        <td style={{ ...tdS, fontSize:11 }}>{r.paid_at}</td>
                      </tr>
                    ))
                  )}
                  {activeTab === 'matched' && (
                    preview.matched.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign:'center', color:'#94a3b8', padding:32 }}>
                        No matched records
                      </td></tr>
                    ) : preview.matched.map((r, i) => (
                      <tr key={i} className="ai-tr" style={{ opacity:.7 }}>
                        <td style={tdS}>{r.user_id}</td>
                        <td style={{ ...tdS, color:'#64748b' }}>{r.email}</td>
                        <td style={{ ...tdS, fontSize:11, color:'#94a3b8' }}>{r.payment_id}</td>
                        <td style={tdS}>₹{r.amount}</td>
                        <td style={{ ...tdS, fontWeight:600 }}>{r.internship}</td>
                        <td style={{ ...tdS, fontSize:11 }}>{r.paid_at}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── STEP 3: DONE ── */}
        {step === STEP.DONE && result && (
          <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #ede9fe',
            boxShadow:'0 1px 8px rgba(79,70,229,.06)', padding:40, textAlign:'center' }}>
            <div style={{ fontSize:52, marginBottom:12 }}>🎉</div>
            <div style={{ fontSize:20, fontWeight:800, color:'#1e293b', marginBottom:6 }}>
              Allocation Complete
            </div>
            <div style={{ fontSize:13, color:'#64748b', marginBottom:28 }}>
              Internships have been allocated successfully
            </div>
            <div style={{ display:'inline-flex', gap:24, marginBottom:32 }}>
              <div style={{ padding:'18px 32px', background:'#f0fdf4', borderRadius:12,
                border:'1.5px solid #bbf7d0', textAlign:'center' }}>
                <div style={{ fontSize:28, fontWeight:800, color:'#16a34a' }}>{result.inserted}</div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:3 }}>Inserted</div>
              </div>
              <div style={{ padding:'18px 32px', background:'#fff7ed', borderRadius:12,
                border:'1.5px solid #fed7aa', textAlign:'center' }}>
                <div style={{ fontSize:28, fontWeight:800, color:'#ea580c' }}>{result.skipped}</div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:3 }}>Skipped</div>
              </div>
            </div>
            <div>
              <button style={btnPri} onClick={reset}>
                ↩ Upload Another File
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}