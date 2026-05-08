import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/internship-system/purchased_internship.php';
const FH  = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk  = obj => new URLSearchParams(obj);

/* ─── shared styles ─── */
const inp = {
  width:'100%', padding:'8px 11px', border:'1.5px solid #e2e8f0', borderRadius:7,
  fontSize:12.5, fontFamily:'inherit', color:'#1e293b', outline:'none', boxSizing:'border-box'
};
const sel = { ...inp, cursor:'pointer' };
const tdS = { padding:'9px 12px', borderBottom:'1px solid #f5f3ff', color:'#334155', fontSize:12, verticalAlign:'middle' };
const btnPri = {
  padding:'8px 18px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff',
  border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit'
};

function FL({ label, children, full }) {
  return (
    <div style={{ gridColumn: full ? '1/-1' : 'span 1', marginBottom:4 }}>
      <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'#64748b',
        textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth: wide?820:600,
        maxHeight:'92vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'15px 22px', borderBottom:'1.5px solid #f1f5f9',
          background:'linear-gradient(135deg,#4f46e5,#7c3aed)', borderRadius:'14px 14px 0 0' }}>
          <span style={{ fontSize:14, fontWeight:700, color:'#fff' }}>{title}</span>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none',
            borderRadius:6, width:28, height:28, cursor:'pointer', color:'#fff', fontSize:18, lineHeight:1 }}>×</button>
        </div>
        <div style={{ padding:'20px 22px' }}>{children}</div>
      </div>
    </div>
  );
}

const LIMIT = 10;

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
export default function PurchasedInternships() {
  const [rows,         setRows]         = useState([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [page,         setPage]         = useState(1);
  const [search,       setSearch]       = useState('');
  const [searchInput,  setSearchInput]  = useState('');
  const [modal,        setModal]        = useState(null);
  const [internships,  setInternships]  = useState([]);
  const [batches,      setBatches]      = useState([]);

  /* ── fetch helpers ── */
  const fetchDropdowns = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        api.post(API, mk({ action:'fetch_internship_list' }), FH),
        api.post(API, mk({ action:'fetch_exam_dates'      }), FH),
      ]);
      if (r1.data.status === 'success') setInternships(r1.data.data || []);
      if (r2.data.status === 'success') setBatches(r2.data.data || []);
    } catch { /* dropdown fetch failure is non-critical */ }
  }, []);

  const fetchData = useCallback(async (pg = 1, kw = '') => {
    setLoading(true);
    try {
      const offset = (pg - 1) * LIMIT;
      let res;
      if (kw.trim()) {
        res = await api.post(API, mk({ action:'fetch_by_keyword', keyword: kw }), FH);
        if (res.data.status === 'success') {
          setRows(res.data.data || []);
          setTotal(res.data.data?.length || 0);
        }
      } else {
        res = await api.post(API, mk({ action:'fetch_all', limit: LIMIT, offset }), FH);
        if (res.data.status === 'success') {
          setRows(res.data.data || []);
          setTotal(res.data.total || 0);
        }
      }
    } catch { /* swallow — table will show empty state */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(page, search); fetchDropdowns(); }, [page, search, fetchData, fetchDropdowns]);

  const reload = () => fetchData(page, search);

  /* ── search ── */
  const doSearch = () => { setPage(1); setSearch(searchInput); };
  const clearSearch = () => { setSearchInput(''); setSearch(''); setPage(1); };

  /* ── delete ── */
  const handleDelete = async (payment_id) => {
    if (!window.confirm('Delete this internship record? This cannot be undone.')) return;
    try {
      const res = await api.post(API, mk({ action:'delete_internship', payment_id }), FH);
      if (res.data.status === 'success') { toast.success('Deleted successfully'); reload(); }
      else toast.error(res.data.message || 'Failed');
    } catch { toast.error('Error'); }
  };

  /* ── provide certificate ── */
  const handleCertificate = async (user_id, internship_id) => {
    if (!window.confirm('Provide certificate to this student?')) return;
    try {
      const res = await api.post(API, mk({ action:'provide_certificate', user_id, internship_id }), FH);
      if (res.data.status === 'success') { toast.success(res.data.message); reload(); }
      else toast.error(res.data.message || 'Failed');
    } catch { toast.error('Error'); }
  };

  /* ── copy to clipboard ── */
  const copy = (text) => { navigator.clipboard.writeText(text); toast.success('Copied!'); };

  /* ── pagination ── */
  const totalPages = Math.ceil(total / LIMIT);

  const closeModal    = () => setModal(null);
  const closeAndReload = () => { setModal(null); reload(); };

  /* ════════ RENDER ════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .pi-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .pi-tr:hover td{background:#faf9ff!important;}
        .pi-inp:focus{border-color:#4f46e5!important;box-shadow:0 0 0 3px rgba(79,70,229,.08)!important;}
        .pi-pg-btn:hover{background:#ede9fe!important;color:#4f46e5!important;}
      `}</style>

      <div className="pi-root" style={{ background:'#f5f3ff', minHeight:'100vh', padding:24 }}>

        {/* header */}
        <div style={{ fontSize:18, fontWeight:800, color:'#1e293b', marginBottom:18,
          display:'flex', alignItems:'center', gap:10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth={2.5}>
            <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
          </svg>
          Purchased Internships
        </div>

        {/* toolbar */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          flexWrap:'wrap', gap:12, marginBottom:16 }}>

          {/* search */}
          <div style={{ display:'flex', gap:0, border:'1.5px solid #e2e8f0', borderRadius:8,
            overflow:'hidden', background:'#fff', flex:'0 0 340px' }}>
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search by name, email, phone..."
              style={{ border:'none', padding:'9px 12px', fontSize:12.5, flex:1,
                outline:'none', fontFamily:'inherit', color:'#1e293b' }}/>
            <button onClick={doSearch}
              style={{ background:'#4f46e5', color:'#fff', border:'none', padding:'0 14px', cursor:'pointer', fontSize:13 }}>
              🔍
            </button>
            <button onClick={clearSearch}
              style={{ background:'#f1f5f9', color:'#64748b', border:'none',
                padding:'0 12px', cursor:'pointer', fontSize:13 }}>×</button>
          </div>

          {/* right buttons */}
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:12.5, color:'#64748b', fontWeight:600 }}>
              Total: <strong style={{ color:'#4f46e5' }}>{total}</strong>
            </span>
            <button style={{ ...btnPri, background:'linear-gradient(135deg,#16a34a,#15803d)' }}
              onClick={() => setModal({ type:'allocate' })}>
              📋 Allocate Internship By Uploading CSV
            </button>
            <button style={btnPri} onClick={() => setModal({ type:'add' })}>+ Add Internship</button>
            <button style={{ ...btnPri, background:'linear-gradient(135deg,#0891b2,#0e7490)' }}
              onClick={() => setModal({ type:'bulk' })}>📤 Bulk Upload</button>
          </div>
        </div>

        {/* table */}
        <div style={{ background:'#fff', borderRadius:12, border:'1.5px solid #ede9fe',
          boxShadow:'0 1px 8px rgba(79,70,229,.05)', overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {['#','Name','Email','Mobile','Internship','Batch','Days','Amount','Plan','Payment ID','Paid At','Action'].map(h => (
                    <th key={h} style={{ color:'#fff', fontSize:11, fontWeight:600, padding:'11px 12px',
                      textAlign:'left', textTransform:'uppercase', letterSpacing:'.3px',
                      borderRight:'1px solid rgba(255,255,255,.15)', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12} style={{ textAlign:'center', padding:40 }}>
                    <div style={{ display:'inline-block', width:28, height:28, border:'3px solid #ede9fe',
                      borderTop:'3px solid #4f46e5', borderRadius:'50%',
                      animation:'pi_spin .7s linear infinite' }}/>
                    <style>{`@keyframes pi_spin{to{transform:rotate(360deg)}}`}</style>
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={12} style={{ textAlign:'center', color:'#94a3b8', padding:36, fontSize:13 }}>
                    No records found
                  </td></tr>
                ) : rows.map((r, i) => (
                  <tr key={r.payment_id || i} className="pi-tr">
                    <td style={tdS}>{(page - 1) * LIMIT + i + 1}</td>
                    <td style={{ ...tdS, fontWeight:600, color:'#1e293b', minWidth:120 }}>{r.name}</td>
                    <td style={{ ...tdS, minWidth:160 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <span style={{ fontSize:11.5 }}>{r.email}</span>
                        <button onClick={() => copy(r.email)}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:11, padding:2 }}>⧉</button>
                      </div>
                    </td>
                    <td style={{ ...tdS, minWidth:120 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <span style={{ fontSize:11.5 }}>{r.phone}</span>
                        <button onClick={() => copy(r.phone)}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:11, padding:2 }}>⧉</button>
                      </div>
                    </td>
                    <td style={{ ...tdS, color:'#4f46e5', fontWeight:600, minWidth:140 }}>{r.internship_name}</td>
                    <td style={{ ...tdS, minWidth:100 }}>{r.batch}</td>
                    <td style={tdS}>{r.total_duration}</td>
                    <td style={tdS}>₹{r.charge_amount || '—'}</td>
                    <td style={tdS}>
                      <span style={{ padding:'2px 9px', borderRadius:99, fontSize:10.5, fontWeight:700,
                        background: r.internship_level?.toLowerCase() === 'gold' ? '#fef3c7' : '#f1f5f9',
                        color: r.internship_level?.toLowerCase() === 'gold' ? '#b45309' : '#475569' }}>
                        {r.internship_level || 'Silver'}
                      </span>
                    </td>
                    <td style={{ ...tdS, fontSize:11, color:'#64748b' }}>{r.payment_id}</td>
                    <td style={{ ...tdS, fontSize:11, whiteSpace:'nowrap' }}>{r.paid_at}</td>
                    <td style={{ ...tdS, whiteSpace:'nowrap', minWidth:200 }}>
                      <button
                        style={{ padding:'4px 10px', background:'#fef3c7', color:'#b45309',
                          border:'1.5px solid #fde68a', borderRadius:5, fontSize:10.5,
                          fontWeight:600, cursor:'pointer', marginRight:4 }}
                        onClick={() => setModal({ type:'edit', data: r })}>
                        Edit
                      </button>
                      <button
                        style={{ padding:'4px 10px', background:'#fee2e2', color:'#dc2626',
                          border:'1.5px solid #fecaca', borderRadius:5, fontSize:10.5,
                          fontWeight:600, cursor:'pointer', marginRight:4 }}
                        onClick={() => handleDelete(r.payment_id)}>
                        Delete
                      </button>
                      <button
                        disabled={!!r.project_status}
                        style={{ padding:'4px 10px',
                          background: r.project_status ? '#f1f5f9' : '#e0f2fe',
                          color: r.project_status ? '#94a3b8' : '#0369a1',
                          border: `1.5px solid ${r.project_status ? '#e2e8f0' : '#bae6fd'}`,
                          borderRadius:5, fontSize:10.5, fontWeight:600,
                          cursor: r.project_status ? 'not-allowed' : 'pointer' }}
                        onClick={() => !r.project_status && handleCertificate(r.user_id, r.internship_id)}>
                        {r.project_status ? 'Cert ✓' : 'Certificate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* pagination */}
        {!search && totalPages > 1 && (
          <div style={{ display:'flex', justifyContent:'flex-end', gap:6, marginTop:14, flexWrap:'wrap' }}>
            <button className="pi-pg-btn"
              disabled={page === 1}
              onClick={() => setPage(1)}
              style={{ padding:'5px 10px', border:'1.5px solid #e2e8f0', borderRadius:6,
                background:'#fff', fontSize:12, cursor: page===1?'not-allowed':'pointer',
                color: page===1?'#cbd5e1':'#334155' }}>First</button>
            <button className="pi-pg-btn"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              style={{ padding:'5px 10px', border:'1.5px solid #e2e8f0', borderRadius:6,
                background:'#fff', fontSize:12, cursor: page===1?'not-allowed':'pointer',
                color: page===1?'#cbd5e1':'#334155' }}>Prev</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pg = page <= 3 ? i + 1 : page - 2 + i;
              if (pg > totalPages) return null;
              return (
                <button key={pg} className="pi-pg-btn"
                  onClick={() => setPage(pg)}
                  style={{ padding:'5px 12px', border:'1.5px solid #e2e8f0', borderRadius:6,
                    background: pg===page ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#fff',
                    color: pg===page ? '#fff' : '#334155', fontSize:12, cursor:'pointer',
                    fontWeight: pg===page ? 700 : 400 }}>{pg}</button>
              );
            })}
            <button className="pi-pg-btn"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              style={{ padding:'5px 10px', border:'1.5px solid #e2e8f0', borderRadius:6,
                background:'#fff', fontSize:12, cursor: page===totalPages?'not-allowed':'pointer',
                color: page===totalPages?'#cbd5e1':'#334155' }}>Next</button>
            <button className="pi-pg-btn"
              disabled={page === totalPages}
              onClick={() => setPage(totalPages)}
              style={{ padding:'5px 10px', border:'1.5px solid #e2e8f0', borderRadius:6,
                background:'#fff', fontSize:12, cursor: page===totalPages?'not-allowed':'pointer',
                color: page===totalPages?'#cbd5e1':'#334155' }}>Last</button>
          </div>
        )}
      </div>

      {/* modals */}
      {modal?.type === 'add'      && <AddModal      internships={internships} batches={batches} onCancel={closeModal} onSaved={closeAndReload}/>}
      {modal?.type === 'edit'     && <EditModal     data={modal.data} internships={internships} batches={batches} onCancel={closeModal} onSaved={closeAndReload}/>}
      {modal?.type === 'bulk'     && <BulkModal     internships={internships} batches={batches} onCancel={closeModal} onSaved={closeAndReload}/>}
      {modal?.type === 'allocate' && <AllocateCSVModal onCancel={closeModal} onSaved={closeAndReload}/>}
    </>
  );
}

/* ════════════════════════════════════════
   ADD MODAL
════════════════════════════════════════ */
function AddModal({ internships, batches, onCancel, onSaved }) {
  const [userSearch,  setUserSearch]  = useState('');
  const [userList,    setUserList]    = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searching,   setSearching]   = useState(false);
  const [searched,    setSearched]    = useState(false);
  const [form, setForm] = useState({
    internship:'', batch:'', payment_id:'', total_duration:'35', internship_level:'Silver'
  });
  const [saving, setSaving] = useState(false);

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  /* manual search — only fires when button clicked / Enter pressed */
  const handleSearch = async () => {
    const kw = userSearch.trim();
    if (kw.length < 3) { toast.error('Type at least 3 characters'); return; }
    setSearching(true);
    setUserList([]);
    setSearched(false);
    try {
      const res = await api.post(API, mk({ action:'fetch_user_by_keyword', keyword: kw }), FH);
      if (res.data.status === 'success') {
        const list = res.data.data || [];
        setUserList(list);
        setSearched(true);
        if (list.length === 0) toast.error('No users found');
      } else {
        toast.error(res.data.message || 'Search failed');
      }
    } catch { toast.error('Search error'); } finally { setSearching(false); }
  };

  const selectUser = (user) => {
    setSelectedUser(user);
    setUserSearch(user.email + ' / ' + user.phone);
    setUserList([]);
    setSearched(false);
  };

  const submit = async () => {
    if (!selectedUser) { toast.error('Select a user first'); return; }
    if (!form.internship) { toast.error('Select internship'); return; }
    if (!form.batch)      { toast.error('Select batch'); return; }
    setSaving(true);
    try {
      const sep = form.batch.lastIndexOf('|');
      const batch  = sep >= 0 ? form.batch.slice(0, sep) : form.batch;
      const refund = sep >= 0 ? form.batch.slice(sep + 1) : 'no';
      const res = await api.post(API, mk({
        action: 'add_internship',
        user_id: selectedUser.user_id,
        ...form,
        batch,
        refund,
      }), FH);
      if (res.data.status === 'success') { toast.success('Internship added'); onSaved(); }
      else toast.error(res.data.message || 'Failed');
    } catch { toast.error('Error'); } finally { setSaving(false); }
  };

  return (
    <Modal title="Add Internship" onCancel={onCancel} onClose={onCancel}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 16px' }}>

        <FL label="Search User" full>
          <div style={{ position:'relative' }}>
            <div style={{ display:'flex', gap:6 }}>
              <input className="pi-inp" style={{ ...inp, flex:1 }} value={userSearch}
                onChange={e => { setUserSearch(e.target.value); setSearched(false); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                placeholder="Type email or phone (min 3 chars), then click Search"/>
              <button type="button" onClick={handleSearch} disabled={searching || userSearch.trim().length < 3}
                style={{ padding:'8px 18px',
                  background: searching || userSearch.trim().length < 3
                    ? '#cbd5e1' : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                  color:'#fff', border:'none', borderRadius:7, fontSize:12, fontWeight:700,
                  cursor: searching || userSearch.trim().length < 3 ? 'not-allowed' : 'pointer',
                  whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5 }}>
                {searching ? '…' : '🔍 Search'}
              </button>
            </div>
            {userList.length > 0 && (
              <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff',
                border:'1.5px solid #e2e8f0', borderRadius:8, zIndex:10, boxShadow:'0 4px 20px rgba(0,0,0,.12)',
                maxHeight:200, overflowY:'auto', marginTop:4 }}>
                {userList.map(u => (
                  <div key={u.user_id} onClick={() => selectUser(u)}
                    style={{ padding:'9px 12px', cursor:'pointer', fontSize:12.5, color:'#334155',
                      borderBottom:'1px solid #f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.background='#f5f3ff'}
                    onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                    <strong>{u.name}</strong> — {u.email} / {u.phone}
                  </div>
                ))}
              </div>
            )}
            {searched && userList.length === 0 && !searching && (
              <div style={{ marginTop:6, padding:'6px 10px', background:'#fef2f2', borderRadius:6,
                fontSize:11.5, color:'#dc2626', fontWeight:600 }}>
                No users found for "{userSearch}"
              </div>
            )}
          </div>
          {selectedUser && (
            <div style={{ marginTop:6, padding:'6px 10px', background:'#f0fdf4', borderRadius:6,
              fontSize:11.5, color:'#16a34a', fontWeight:600 }}>
              ✓ Selected: {selectedUser.name} (ID: {selectedUser.user_id})
            </div>
          )}
        </FL>

        <FL label="Internship Name">
          <select className="pi-inp" style={sel} value={form.internship} onChange={set('internship')}>
            <option value="">Choose...</option>
            {internships.map(i => <option key={i.id} value={i.internship_name}>{i.internship_name}</option>)}
          </select>
        </FL>

        <FL label="Batch">
          <select className="pi-inp" style={sel} value={form.batch} onChange={set('batch')}>
            <option value="">Choose...</option>
            {batches.map(b => {
              const v = `${b.date}|${b.refund === 'yes' ? 'yes' : 'no'}`;
              return <option key={v} value={v}>{b.date}{b.refund === 'yes' ? ' (refund)' : ''}</option>;
            })}
          </select>
        </FL>

        <FL label="Payment ID">
          <input className="pi-inp" style={inp} value={form.payment_id}
            onChange={set('payment_id')} placeholder="e.g. pay_xxx"/>
        </FL>

        <FL label="Total Duration (days)">
          <input className="pi-inp" style={inp} type="number" value={form.total_duration}
            onChange={set('total_duration')}/>
          <small style={{ fontSize:10.5, color:'#dc2626', marginTop:3, display:'block' }}>
            Add 5 days extra. e.g. 3 months = 90+5 = 95
          </small>
        </FL>

        <FL label="Internship Plan">
          <select className="pi-inp" style={sel} value={form.internship_level} onChange={set('internship_level')}>
            <option value="Silver">Silver</option>
            <option value="Gold">Gold</option>
          </select>
        </FL>
      </div>

      <Btns onCancel={onCancel} onSave={submit} saving={saving} label="Add Internship"/>
    </Modal>
  );
}

/* ════════════════════════════════════════
   EDIT MODAL
════════════════════════════════════════ */
function EditModal({ data, internships, batches, onCancel, onSaved }) {
  const dataRefund = data.refund === 'yes' ? 'yes' : 'no';
  const matchedBatch = batches.find(b => b.date === data.batch && (b.refund === 'yes' ? 'yes' : 'no') === dataRefund);
  const isCustomBatch = batches.length > 0 && !matchedBatch;
  const [form, setForm] = useState({
    internship:          data.internship_name || '',
    batch:               isCustomBatch ? 'custom' : (data.batch ? `${data.batch}|${dataRefund}` : ''),
    custom_batch_date:   isCustomBatch ? data.batch : '',
    new_payment_id:      data.payment_id || '',
    batch_freeze:        data.batch_freeze ?? 0,
    total_duration:      data.total_duration || '35',
    internship_level:    data.internship_level || 'Silver',
    upgraded_payment_id: data.upgraded_payment_id || '',
  });
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    setSaving(true);
    try {
      let batch, refund;
      if (form.batch === 'custom') {
        batch = form.custom_batch_date;
        refund = 'no';
      } else {
        const sep = form.batch.lastIndexOf('|');
        batch  = sep >= 0 ? form.batch.slice(0, sep) : form.batch;
        refund = sep >= 0 ? form.batch.slice(sep + 1) : 'no';
      }
      const res = await api.post(API, mk({
        action: 'update_internship',
        payment_id: data.payment_id,
        internship: form.internship,
        batch,
        refund,
        new_payment_id: form.new_payment_id,
        batch_freeze: form.batch_freeze,
        total_duration: form.total_duration,
        internship_level: form.internship_level,
        upgraded_payment_id: form.upgraded_payment_id,
      }), FH);
      if (res.data.status === 'success') { toast.success('Updated successfully'); onSaved(); }
      else toast.error(res.data.message || 'Failed');
    } catch { toast.error('Error'); } finally { setSaving(false); }
  };

  return (
    <Modal title="Edit Internship Details" onClose={onCancel} wide>
      {/* student name (read-only) */}
      <div style={{ padding:'9px 12px', background:'#f8fafc', borderRadius:8,
        fontSize:13, fontWeight:600, color:'#1e293b', marginBottom:16,
        border:'1.5px solid #e2e8f0' }}>
        👤 {data.name}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 16px' }}>

        <FL label="Internship Name">
          <select className="pi-inp" style={sel} value={form.internship} onChange={set('internship')}>
            <option value="">Choose...</option>
            {internships.map(i => <option key={i.id} value={i.internship_name}>{i.internship_name}</option>)}
          </select>
        </FL>

        <FL label="Batch">
          <select className="pi-inp" style={sel} value={form.batch} onChange={set('batch')}>
            <option value="">Choose...</option>
            {batches.map(b => {
              const v = `${b.date}|${b.refund === 'yes' ? 'yes' : 'no'}`;
              return <option key={v} value={v}>{b.date}{b.refund === 'yes' ? ' (refund)' : ''}</option>;
            })}
            <option value="custom">Custom Date</option>
          </select>
          {form.batch === 'custom' && (
            <input className="pi-inp" style={{ ...inp, marginTop:6 }}
              value={form.custom_batch_date} onChange={set('custom_batch_date')}
              placeholder="Enter custom date (e.g. 2024-05-01)"/>
          )}
        </FL>

        <FL label="Payment ID">
          <input className="pi-inp" style={inp} value={form.new_payment_id}
            onChange={set('new_payment_id')}/>
        </FL>

        <FL label="Batch Freeze">
          <select className="pi-inp" style={sel} value={form.batch_freeze} onChange={set('batch_freeze')}>
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </FL>

        <FL label="Total Duration (days)">
          <input className="pi-inp" style={inp} type="number"
            value={form.total_duration} onChange={set('total_duration')}/>
          <small style={{ fontSize:10.5, color:'#dc2626', marginTop:3, display:'block' }}>
            Add 5 days extra. e.g. 3 months = 90+5 = 95
          </small>
        </FL>

        <FL label="Internship Plan">
          <select className="pi-inp" style={sel} value={form.internship_level} onChange={set('internship_level')}>
            <option value="Silver">Silver</option>
            <option value="Gold">Gold</option>
          </select>
        </FL>

        <FL label="Upgraded Payment ID" full>
          <input className="pi-inp" style={inp} value={form.upgraded_payment_id}
            onChange={set('upgraded_payment_id')} placeholder="Leave blank if no upgrade"/>
          <small style={{ fontSize:10.5, color:'#dc2626', marginTop:3, display:'block' }}>
            If no payment id, leave blank
          </small>
        </FL>
      </div>

      <Btns onCancel={onCancel} onSave={submit} saving={saving} label="Update Internship"/>
    </Modal>
  );
}

/* ════════════════════════════════════════
   BULK UPLOAD MODAL
════════════════════════════════════════ */
function BulkModal({ internships, batches, onCancel }) {
  const [file,         setFile]         = useState(null);
  const [paymentType,  setPaymentType]  = useState('razorpay');
  const [uploading,    setUploading]    = useState(false);
  const [previewRows,  setPreviewRows]  = useState([]);
  const [addingId,     setAddingId]     = useState(null);

  const uploadFile = async () => {
    if (!file) { toast.error('Select a CSV file first'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('action', 'upload_bulk_data');
      fd.append('file', file);
      fd.append('payment_type', paymentType);

      const res = await api.post(API, fd, { headers: { 'Content-Type': undefined } });
      if (res.data.success) {
        setPreviewRows(res.data.data || []);
        toast.success(`${res.data.data?.length || 0} rows loaded`);
      } else {
        toast.error(res.data.message || 'Upload failed');
      }
    } catch { toast.error('Error processing file'); } finally { setUploading(false); }
  };

  const addInternship = async (row, internship, batch, plan) => {
    setAddingId(row.payment_id);
    try {
      const res = await api.post(API, mk({
        action: 'add_internship',
        user_id: row.user_id,
        internship,
        batch,
        payment_id: row.payment_id,
        total_duration: '35',
        internship_level: plan,
      }), FH);
      if (res.data.status === 'success') {
        toast.success('Added');
        setPreviewRows(p => p.filter(r => r.payment_id !== row.payment_id));
      } else toast.error(res.data.message || 'Failed');
    } catch { toast.error('Error'); } finally { setAddingId(null); }
  };

  return (
    <Modal title="Bulk Upload Internships" onClose={onCancel} wide>
      {previewRows.length === 0 ? (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 16px', marginBottom:16 }}>
            <FL label="Upload CSV File" full>
              <input type="file" style={inp} accept=".csv"
                onChange={e => setFile(e.target.files[0])}/>
            </FL>
            <FL label="Payment Type">
              <select style={sel} value={paymentType} onChange={e => setPaymentType(e.target.value)}>
                <option value="razorpay">Razorpay</option>
                <option value="phonepe">PhonePe</option>
                <option value="hdfc_smartgateway">HDFC SmartGateway</option>
              </select>
              {paymentType === 'phonepe' && (
                <small style={{ color:'#dc2626', fontSize:10.5, marginTop:3, display:'block' }}>
                  Upload Transaction Report sheet
                </small>
              )}
              {paymentType === 'hdfc_smartgateway' && (
                <small style={{ color:'#dc2626', fontSize:10.5, marginTop:3, display:'block' }}>
                  Sheet must have: customer_id, order_id, description, amount, payment_status columns
                </small>
              )}
            </FL>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={onCancel} style={{ padding:'9px 18px', border:'1.5px solid #e2e8f0',
              background:'#f8fafc', color:'#475569', borderRadius:8, fontSize:12.5,
              fontWeight:600, cursor:'pointer' }}>Cancel</button>
            <button style={btnPri} onClick={uploadFile} disabled={uploading}>
              {uploading ? 'Processing...' : 'Upload & Parse'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom:12, fontSize:13, fontWeight:600, color:'#1e293b' }}>
            {previewRows.length} records loaded — click "Add" to process each row
          </div>
          <div style={{ overflowX:'auto', maxHeight:440 }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {['Email','Payment ID','Amount','Description','Paid At','Action'].map(h => (
                    <th key={h} style={{ color:'#fff', fontSize:11, fontWeight:600,
                      padding:'9px 12px', textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <BulkRow key={i} row={row} internships={internships} batches={batches}
                    adding={addingId === row.payment_id}
                    onAdd={(internship, batch, plan) => addInternship(row, internship, batch, plan)}/>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
            <button onClick={onCancel} style={{ ...btnPri, background:'#64748b' }}>Close</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function BulkRow({ row, internships, batches, adding, onAdd }) {
  const parts   = (row.internship || '').split('|');
  const defInt  = parts[0] || '';
  const defBatch = parts[1] || '';
  const [selInt,   setSelInt]   = useState(defInt || (internships[0]?.internship_name || ''));
  const [selBatch, setSelBatch] = useState(defBatch || (batches[0]?.date || ''));
  const [plan,     setPlan]     = useState(parseFloat(row.amount) === 1980 ? 'Gold' : 'Silver');

  return (
    <tr style={{ borderBottom:'1px solid #f5f3ff' }}>
      <td style={{ ...tdS, fontSize:11 }}>{row.email}</td>
      <td style={{ ...tdS, fontSize:11 }}>{row.payment_id}</td>
      <td style={{ ...tdS, fontSize:11 }}>₹{row.amount}</td>
      <td style={{ ...tdS, fontSize:11 }}>{defInt}</td>
      <td style={{ ...tdS, fontSize:11 }}>{row.paid_at}</td>
      <td style={{ ...tdS, minWidth:280 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <select value={selInt} onChange={e => setSelInt(e.target.value)}
            style={{ ...sel, fontSize:11, padding:'4px 8px' }}>
            <option value="">Select internship</option>
            {internships.map(i => <option key={i.id} value={i.internship_name}>{i.internship_name}</option>)}
          </select>
          <select value={selBatch} onChange={e => setSelBatch(e.target.value)}
            style={{ ...sel, fontSize:11, padding:'4px 8px' }}>
            <option value="">Select batch</option>
            {batches.map(b => <option key={b.date} value={b.date}>{b.date}{b.refund === 'yes' ? ' (refund)' : ''}</option>)}
          </select>
          <select value={plan} onChange={e => setPlan(e.target.value)}
            style={{ ...sel, fontSize:11, padding:'4px 8px' }}>
            <option value="Silver">Silver</option>
            <option value="Gold">Gold</option>
          </select>
          <button disabled={adding} onClick={() => onAdd(selInt, selBatch, plan)}
            style={{ padding:'5px 10px', background:'#ede9fe', color:'#6d28d9',
              border:'1.5px solid #ddd6fe', borderRadius:6, fontSize:11,
              fontWeight:700, cursor: adding ? 'wait' : 'pointer' }}>
            {adding ? 'Adding...' : 'Add Internship'}
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ── shared save/cancel buttons ── */
function Btns({ onCancel, onSave, saving, label }) {
  return (
    <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:20,
      borderTop:'1.5px solid #f1f5f9', paddingTop:16 }}>
      <button onClick={onCancel} style={{ padding:'9px 18px', border:'1.5px solid #e2e8f0',
        background:'#f8fafc', color:'#475569', borderRadius:8, fontSize:12.5,
        fontWeight:600, cursor:'pointer' }}>Cancel</button>
      <button style={btnPri} onClick={onSave} disabled={saving}>
        {saving ? 'Saving...' : label}
      </button>
    </div>
  );
}

/* ════════════════════════════════════════
   ALLOCATE INTERNSHIP BY CSV
   Step 1: upload + sample download
   Step 2: parsed → preview → start
   Step 3: progress bar while batches run
   Step 4: summary + errors
════════════════════════════════════════ */
const ALLOCATE_BATCH_SIZE = 15;

function parseCSV(text) {
  // strip UTF-8 BOM (U+FEFF) if present, then split lines
  const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const lines = clean.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };

  const splitLine = (line) => {
    const out = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    out.push(cur);
    return out;
  };

  const headers = splitLine(lines[0]).map(h => h.trim().toLowerCase());
  const rows = lines.slice(1).map(line => {
    const cols = splitLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (cols[i] ?? '').trim(); });
    return obj;
  });
  return { headers, rows };
}

function AllocateCSVModal({ onCancel, onSaved }) {
  const [file,        setFile]        = useState(null);
  const [rows,        setRows]        = useState([]);
  const [parseError,  setParseError]  = useState('');
  const [step,        setStep]        = useState('upload');   // upload | preview | running | done
  const [done,        setDone]        = useState(0);
  const [success,     setSuccess]     = useState(0);
  const [failed,      setFailed]      = useState(0);
  const [errors,      setErrors]      = useState([]);
  const [currentEmail, setCurrentEmail] = useState('');
  const cancelRef = useRef(false);

  const total = rows.length;
  const progress = total ? Math.round((done / total) * 100) : 0;

  const downloadSample = () => {
    const csv = [
      'Email,Batch,Amount,Internship Name,Duration',
      'student@gmail.com,"14th May, 2026",590,Machine Learning Internship,35',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'allocate-internship-sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFile = (e) => {
    setParseError('');
    const f = e.target.files[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a .csv file');
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { headers, rows } = parseCSV(ev.target.result);
        const required = ['email', 'batch', 'amount', 'internship name', 'duration'];
        const missing = required.filter(r => !headers.includes(r));
        if (missing.length > 0) {
          setParseError('CSV is missing columns: ' + missing.join(', '));
          setRows([]);
          return;
        }
        const valid = rows.filter(r => r.email && (r['internship name'] || r['internship_name']));
        if (valid.length === 0) {
          setParseError('No valid rows found in CSV (need at least Email and Internship Name)');
          return;
        }
        setRows(valid);
        setStep('preview');
      } catch (err) {
        setParseError('Failed to parse CSV: ' + err.message);
      }
    };
    reader.readAsText(f);
  };

  const startAllocation = async () => {
    setStep('running');
    setDone(0);
    setSuccess(0);
    setFailed(0);
    setErrors([]);
    cancelRef.current = false;

    let s = 0, f = 0;
    const errBuf = [];

    for (let i = 0; i < rows.length; i += ALLOCATE_BATCH_SIZE) {
      if (cancelRef.current) break;
      const batch = rows.slice(i, i + ALLOCATE_BATCH_SIZE);
      setCurrentEmail(batch[0]?.email || '');

      try {
        const res = await api.post(API, mk({
          action: 'allocate_internships_csv',
          rows: JSON.stringify(batch),
        }), FH);

        if (res.data?.status === 'success' && Array.isArray(res.data.results)) {
          res.data.results.forEach(r => {
            if (r.status === 'success') s++;
            else { f++; errBuf.push({ email: r.email, message: r.message }); }
          });
        } else {
          batch.forEach(row => {
            f++;
            errBuf.push({ email: row.email, message: res.data?.message || 'Batch failed' });
          });
        }
      } catch {
        batch.forEach(row => {
          f++;
          errBuf.push({ email: row.email, message: 'Network error' });
        });
      }

      const newDone = Math.min(i + ALLOCATE_BATCH_SIZE, rows.length);
      setDone(newDone);
      setSuccess(s);
      setFailed(f);
      setErrors([...errBuf]);
    }

    setStep('done');
    if (s > 0) toast.success(`Allocated ${s} of ${rows.length} successfully`);
    if (f > 0) toast.error(`${f} row(s) failed — see details`);
  };

  const handleClose = () => {
    if (step === 'running') {
      if (!window.confirm('Allocation in progress. Cancel and close?')) return;
      cancelRef.current = true;
    }
    if (step === 'done' && success > 0) onSaved();
    else onCancel();
  };

  return (
    <Modal title="Allocate Internships via CSV" onClose={handleClose} wide>
      <style>{`
        @keyframes pi_progressShine {
          0% { background-position: 0 0; }
          100% { background-position: 40px 0; }
        }
        @keyframes pi_pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>

      {/* ── STEP 1 ── upload */}
      {step === 'upload' && (
        <>
          <div style={{ background:'#f0fdf4', border:'1.5px solid #bbf7d0', borderRadius:10,
            padding:'14px 16px', marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#15803d', marginBottom:6 }}>
              📋 How it works
            </div>
            <ul style={{ fontSize:11.5, color:'#166534', margin:0, paddingLeft:18, lineHeight:1.7 }}>
              <li>Download the sample CSV to see the required column format</li>
              <li>CSV must contain: <strong>Email, Batch, Amount, Internship Name, Duration</strong></li>
              <li>Each email is matched to an existing user in the system</li>
              <li>If an "initiated" payment exists, its status updates to "success"; otherwise a new record is created</li>
              <li>Rows are processed in batches of {ALLOCATE_BATCH_SIZE} for speed</li>
            </ul>
          </div>

          <div style={{ display:'flex', gap:12, marginBottom:16 }}>
            <button onClick={downloadSample}
              style={{ padding:'10px 18px', border:'1.5px solid #c7d2fe',
                background:'#eef2ff', color:'#4338ca', borderRadius:8, fontSize:12.5,
                fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
              ⬇ Download Sample CSV
            </button>
          </div>

          <FL label="Upload CSV File" full>
            <input type="file" accept=".csv" onChange={handleFile}
              style={{ ...inp, padding:'10px 11px', cursor:'pointer' }}/>
            {parseError && (
              <div style={{ marginTop:8, padding:'8px 11px', background:'#fef2f2',
                border:'1.5px solid #fecaca', borderRadius:6, fontSize:12, color:'#dc2626' }}>
                ⚠ {parseError}
              </div>
            )}
          </FL>

          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:20,
            borderTop:'1.5px solid #f1f5f9', paddingTop:16 }}>
            <button onClick={onCancel} style={{ padding:'9px 18px', border:'1.5px solid #e2e8f0',
              background:'#f8fafc', color:'#475569', borderRadius:8, fontSize:12.5,
              fontWeight:600, cursor:'pointer' }}>Cancel</button>
          </div>
        </>
      )}

      {/* ── STEP 2 ── preview / start */}
      {step === 'preview' && (
        <>
          <div style={{ background:'linear-gradient(135deg,#f5f3ff,#ede9fe)', borderRadius:10,
            padding:'14px 18px', marginBottom:14, display:'flex', alignItems:'center',
            justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:11.5, color:'#6d28d9', fontWeight:700, textTransform:'uppercase', letterSpacing:'.4px' }}>
                File loaded
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:'#1e293b', marginTop:3 }}>
                {file?.name}
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:11.5, color:'#6d28d9', fontWeight:700, textTransform:'uppercase', letterSpacing:'.4px' }}>
                Rows
              </div>
              <div style={{ fontSize:22, fontWeight:800, color:'#4f46e5' }}>{rows.length}</div>
            </div>
          </div>

          <div style={{ fontSize:12, fontWeight:700, color:'#475569', marginBottom:8 }}>
            Preview (first 5 rows)
          </div>
          <div style={{ overflowX:'auto', border:'1.5px solid #e2e8f0', borderRadius:8, marginBottom:14 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11.5 }}>
              <thead>
                <tr style={{ background:'#f8fafc' }}>
                  {['Email','Batch','Amount','Internship Name','Duration'].map(h => (
                    <th key={h} style={{ padding:'8px 10px', textAlign:'left',
                      color:'#475569', fontWeight:700, borderBottom:'1.5px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
                    <td style={{ padding:'7px 10px', color:'#334155' }}>{r.email}</td>
                    <td style={{ padding:'7px 10px', color:'#334155' }}>{r.batch}</td>
                    <td style={{ padding:'7px 10px', color:'#334155' }}>₹{r.amount}</td>
                    <td style={{ padding:'7px 10px', color:'#4f46e5', fontWeight:600 }}>
                      {r['internship name'] || r['internship_name']}
                    </td>
                    <td style={{ padding:'7px 10px', color:'#334155' }}>{r.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 5 && (
              <div style={{ padding:'8px 12px', fontSize:11, color:'#94a3b8',
                background:'#f8fafc', borderTop:'1px solid #f1f5f9' }}>
                + {rows.length - 5} more row(s)
              </div>
            )}
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', gap:10,
            borderTop:'1.5px solid #f1f5f9', paddingTop:16 }}>
            <button onClick={() => { setStep('upload'); setFile(null); setRows([]); }}
              style={{ padding:'9px 18px', border:'1.5px solid #e2e8f0',
                background:'#f8fafc', color:'#475569', borderRadius:8, fontSize:12.5,
                fontWeight:600, cursor:'pointer' }}>← Back</button>
            <button onClick={startAllocation}
              style={{ ...btnPri, background:'linear-gradient(135deg,#16a34a,#15803d)',
                padding:'10px 24px', fontSize:13 }}>
              ▶ Start Allocation ({rows.length} rows)
            </button>
          </div>
        </>
      )}

      {/* ── STEP 3 ── running */}
      {step === 'running' && (
        <>
          <div style={{ textAlign:'center', marginBottom:24, marginTop:8 }}>
            <div style={{ fontSize:40, fontWeight:800, color:'#4f46e5', lineHeight:1 }}>
              {progress}%
            </div>
            <div style={{ fontSize:13, color:'#64748b', marginTop:6, fontWeight:600 }}>
              Allocating internships…
            </div>
            {currentEmail && (
              <div style={{ fontSize:11.5, color:'#94a3b8', marginTop:4,
                animation:'pi_pulse 1.4s ease-in-out infinite' }}>
                Processing: {currentEmail}
              </div>
            )}
          </div>

          {/* progress bar */}
          <div style={{ width:'100%', height:24, background:'#ede9fe', borderRadius:99,
            overflow:'hidden', marginBottom:18, position:'relative',
            boxShadow:'inset 0 2px 4px rgba(0,0,0,.06)' }}>
            <div style={{
              width: `${progress}%`,
              height:'100%',
              background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
              backgroundImage: `linear-gradient(135deg,
                rgba(255,255,255,.18) 25%, transparent 25%,
                transparent 50%, rgba(255,255,255,.18) 50%,
                rgba(255,255,255,.18) 75%, transparent 75%, transparent),
                linear-gradient(135deg,#4f46e5,#7c3aed)`,
              backgroundSize: '40px 40px, 100% 100%',
              transition: 'width .4s ease-out',
              animation: 'pi_progressShine 1s linear infinite',
              boxShadow: '0 0 12px rgba(124,58,237,.4)',
            }}/>
          </div>

          {/* counters */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:14 }}>
            <StatBox label="Processed" value={`${done} / ${total}`} color="#4f46e5" bg="#eef2ff"/>
            <StatBox label="Success"   value={success} color="#16a34a" bg="#f0fdf4"/>
            <StatBox label="Failed"    value={failed}  color="#dc2626" bg="#fef2f2"/>
          </div>

          <div style={{ fontSize:11, color:'#94a3b8', textAlign:'center', marginTop:8 }}>
            Processing in batches of {ALLOCATE_BATCH_SIZE} — please don't close this window.
          </div>
        </>
      )}

      {/* ── STEP 4 ── done */}
      {step === 'done' && (
        <>
          <div style={{ textAlign:'center', marginBottom:20, marginTop:8 }}>
            <div style={{ fontSize:48, marginBottom:6 }}>
              {failed === 0 ? '✅' : (success === 0 ? '❌' : '⚠️')}
            </div>
            <div style={{ fontSize:18, fontWeight:800, color:'#1e293b' }}>
              Allocation Complete
            </div>
            <div style={{ fontSize:13, color:'#64748b', marginTop:4 }}>
              Processed {done} of {total} rows
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
            <StatBox label="Total"   value={total}   color="#475569" bg="#f8fafc"/>
            <StatBox label="Success" value={success} color="#16a34a" bg="#f0fdf4"/>
            <StatBox label="Failed"  value={failed}  color="#dc2626" bg="#fef2f2"/>
          </div>

          {errors.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#dc2626', marginBottom:6 }}>
                Failed Rows ({errors.length})
              </div>
              <div style={{ maxHeight:220, overflowY:'auto', border:'1.5px solid #fecaca',
                borderRadius:8, background:'#fffafa' }}>
                {errors.map((e, i) => (
                  <div key={i} style={{ padding:'7px 12px', fontSize:11.5,
                    borderBottom: i === errors.length - 1 ? 'none' : '1px solid #fee2e2',
                    display:'flex', justifyContent:'space-between', gap:10 }}>
                    <span style={{ color:'#1e293b', fontWeight:600 }}>{e.email}</span>
                    <span style={{ color:'#dc2626' }}>{e.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display:'flex', justifyContent:'flex-end', gap:10,
            borderTop:'1.5px solid #f1f5f9', paddingTop:16 }}>
            <button onClick={handleClose} style={btnPri}>Close & Refresh</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function StatBox({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
      <div style={{ fontSize:10.5, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'.4px' }}>
        {label}
      </div>
      <div style={{ fontSize:20, fontWeight:800, color, marginTop:4 }}>{value}</div>
    </div>
  );
}