import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/internships/coupons.php';
const FH  = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk  = obj => new URLSearchParams(obj);

/* ─── shared styles ─── */
const inp = {
  width:'100%', padding:'8px 11px', border:'1.5px solid #e2e8f0', borderRadius:7,
  fontSize:12.5, fontFamily:'inherit', color:'#1e293b', outline:'none', boxSizing:'border-box',
};
const btnPri = {
  padding:'9px 20px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
  color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700,
  cursor:'pointer', fontFamily:'inherit',
};
const thS = {
  color:'#fff', fontSize:11, fontWeight:600, padding:'11px 12px',
  textAlign:'left', textTransform:'uppercase', letterSpacing:'.3px',
  borderRight:'1px solid rgba(255,255,255,.15)', whiteSpace:'nowrap',
};
const tdS = { padding:'9px 12px', borderBottom:'1px solid #f5f3ff', color:'#334155', fontSize:12, verticalAlign:'middle' };

/* ── blank form ── */
const blankForm = { code:'', discount_value:'', discount_type:'percentage', course_id:'', expiry_date:'', usage_limit:'', per_user_limit:'' };

/* ── generate random code ── */
const genCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length:8 }, () => chars[Math.floor(Math.random()*chars.length)]).join('');
};

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'#64748b',
        textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:800,
        maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'14px 20px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
          borderRadius:'14px 14px 0 0' }}>
          <span style={{ fontSize:14, fontWeight:700, color:'#fff' }}>{title}</span>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none',
            borderRadius:6, width:28, height:28, cursor:'pointer', color:'#fff', fontSize:18 }}>×</button>
        </div>
        <div style={{ padding:20 }}>{children}</div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
export default function ManageCoupons() {
  const [coupons,     setCoupons]     = useState([]);
  const [internships, setInternships] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(null); // null | 'add' | 'edit' | 'users'
  const [form,        setForm]        = useState(blankForm);
  const [saving,      setSaving]      = useState(false);
  const [usersModal,  setUsersModal]  = useState({ coupon:null, users:[], loading:false });

  /* ── fetch all coupons ── */
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api.post(API, mk({ action:'fetch_coupons' }), { ...FH, signal: controller.signal })
      .then(res => {
        if (res.data.status === 'success') {
          setCoupons(res.data.coupons || []);
          setInternships(res.data.internships || []);
        }
      })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const reload = () => {
    setLoading(true);
    api.post(API, mk({ action:'fetch_coupons' }), FH)
      .then(res => {
        if (res.data.status === 'success') {
          setCoupons(res.data.coupons || []);
          setInternships(res.data.internships || []);
        }
      })
      .finally(() => setLoading(false));
  };

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  /* ── add coupon ── */
  const openAdd = () => {
    setForm(blankForm);
    setModal('add');
  };

  /* ── edit coupon ── */
  const openEdit = (c) => {
    setForm({
      coupon_id:      c.id,
      code:           c.code,
      discount_value: c.discount_value,
      discount_type:  c.discount_type,
      course_id:      c.course_id || '',
      expiry_date:    c.expiry_date || '',
      usage_limit:    c.usage_limit ?? '',
      per_user_limit: c.per_user_limit ?? '',
    });
    setModal('edit');
  };

  /* ── save (add or edit) ── */
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        action: modal === 'edit' ? 'edit_coupon' : 'add_coupon',
        ...form,
        code: (form.code || '').toUpperCase(),
      };
      const res = await api.post(API, mk(payload), FH);
      if (res.data.status === 'success') {
        toast.success(modal === 'edit' ? 'Coupon updated!' : 'Coupon added!');
        setModal(null);
        reload();
      } else {
        toast.error(res.data.message || 'Failed');
      }
    } catch { toast.error('Server error'); }
    finally { setSaving(false); }
  };

  /* ── delete coupon ── */
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this coupon?')) return;
    try {
      const res = await api.post(API, mk({ action:'delete_coupon', coupon_id: id }), FH);
      if (res.data.status === 'success') { toast.success('Coupon deleted!'); reload(); }
      else toast.error(res.data.message || 'Failed');
    } catch { toast.error('Error'); }
  };

  /* ── view users ── */
  const viewUsers = async (coupon) => {
    setUsersModal({ coupon, users:[], loading:true });
    setModal('users');
    try {
      const res = await api.post(API, mk({ action:'view_users', coupon_id: coupon.id }), FH);
      if (res.data.status === 'success') {
        setUsersModal(p => ({ ...p, users: res.data.users || [], loading:false }));
      } else {
        setUsersModal(p => ({ ...p, loading:false }));
      }
    } catch { setUsersModal(p => ({ ...p, loading:false })); }
  };

  /* ── internship name lookup ── */
  const getInternshipName = (course_id) => {
    if (!course_id) return 'All Courses';
    const found = internships.find(i => i.id == course_id);
    return found ? found.internship_name : 'All Courses';
  };

  /* ════════ RENDER ════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .mc-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .mc-tr:hover td{background:#faf9ff!important;}
        .mc-inp:focus{border-color:#4f46e5!important;box-shadow:0 0 0 3px rgba(79,70,229,.08)!important;}
        @keyframes mc_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="mc-root" style={{
        display:'flex', flexDirection:'column',
        height:'calc(100vh - 62px)',
        padding:20, gap:14, overflow:'hidden',
        background:'#f5f3ff',
      }}>

        {/* ── header ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ fontSize:17, fontWeight:800, color:'#1e293b', display:'flex', alignItems:'center', gap:10 }}>
            🏷️ Manage Coupons
          </div>
          <button style={btnPri} onClick={openAdd}>+ Add New Coupon</button>
        </div>

        {/* ── table card ── */}
        <div style={{ flex:1, minHeight:0, background:'#fff', borderRadius:12,
          border:'1.5px solid #ede9fe', boxShadow:'0 1px 8px rgba(79,70,229,.05)',
          display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
              <colgroup>
                <col style={{ width:50  }}/>{/* ID */}
                <col style={{ width:110 }}/>{/* Code */}
                <col style={{ width:80  }}/>{/* Discount */}
                <col style={{ width:90  }}/>{/* Type */}
                <col style={{ width:150 }}/>{/* Course */}
                <col style={{ width:100 }}/>{/* Expiry */}
                <col style={{ width:90  }}/>{/* Usage Limit */}
                <col style={{ width:100 }}/>{/* Per User */}
                <col style={{ width:60  }}/>{/* Used */}
                <col style={{ width:180 }}/>{/* Actions */}
              </colgroup>
              <thead style={{ position:'sticky', top:0, zIndex:2 }}>
                <tr style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {['ID','Code','Discount','Type','Course','Expiry','Usage Limit','Per User','Used','Actions'].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} style={{ textAlign:'center', padding:48 }}>
                    <div style={{ display:'inline-block', width:28, height:28, border:'3px solid #ede9fe',
                      borderTop:'3px solid #4f46e5', borderRadius:'50%', animation:'mc_spin .7s linear infinite' }}/>
                  </td></tr>
                ) : coupons.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign:'center', color:'#94a3b8', padding:36, fontSize:13 }}>
                    No coupons found
                  </td></tr>
                ) : coupons.map(c => (
                  <tr key={c.id} className="mc-tr">
                    <td style={{ ...tdS, color:'#94a3b8', fontSize:11 }}>{c.id}</td>
                    <td style={tdS}>
                      <span style={{ fontFamily:'monospace', fontWeight:700, color:'#4f46e5',
                        background:'#ede9fe', padding:'2px 8px', borderRadius:6, fontSize:12 }}>
                        {c.code}
                      </span>
                    </td>
                    <td style={{ ...tdS, fontWeight:700, color:'#16a34a' }}>{c.discount_value}</td>
                    <td style={tdS}>
                      <span style={{ padding:'2px 9px', borderRadius:99, fontSize:10.5, fontWeight:700,
                        background: c.discount_type === 'percentage' ? '#dbeafe' : '#fef9c3',
                        color:      c.discount_type === 'percentage' ? '#1d4ed8' : '#b45309' }}>
                        {c.discount_type === 'percentage' ? 'Percentage' : 'Flat'}
                      </span>
                    </td>
                    <td style={{ ...tdS, fontSize:11.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {getInternshipName(c.course_id)}
                    </td>
                    <td style={{ ...tdS, fontSize:11 }}>{c.expiry_date || <span style={{ color:'#94a3b8' }}>No Expiry</span>}</td>
                    <td style={tdS}>{c.usage_limit != null ? c.usage_limit : <span style={{ color:'#94a3b8' }}>Unlimited</span>}</td>
                    <td style={tdS}>{c.per_user_limit != null ? c.per_user_limit : <span style={{ color:'#94a3b8' }}>Unlimited</span>}</td>
                    <td style={{ ...tdS, fontWeight:700, color:'#4f46e5' }}>{c.usage_count || 0}</td>
                    <td style={{ ...tdS, whiteSpace:'nowrap' }}>
                      <button onClick={() => openEdit(c)}
                        style={{ padding:'4px 10px', background:'#fef9c3', color:'#b45309',
                          border:'1.5px solid #fde68a', borderRadius:6, fontSize:11,
                          fontWeight:600, cursor:'pointer', marginRight:5 }}>
                        ✏️ Edit
                      </button>
                      <button onClick={() => handleDelete(c.id)}
                        style={{ padding:'4px 10px', background:'#fee2e2', color:'#dc2626',
                          border:'1.5px solid #fecaca', borderRadius:6, fontSize:11,
                          fontWeight:600, cursor:'pointer', marginRight:5 }}>
                        🗑 Delete
                      </button>
                      <button onClick={() => viewUsers(c)}
                        style={{ padding:'4px 10px', background:'#dcfce7', color:'#16a34a',
                          border:'1.5px solid #bbf7d0', borderRadius:6, fontSize:11,
                          fontWeight:600, cursor:'pointer' }}>
                        👥 Users
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── ADD / EDIT MODAL ── */}
      {(modal === 'add' || modal === 'edit') && (
        <Modal title={modal === 'edit' ? 'Edit Coupon' : 'Add New Coupon'} onClose={() => setModal(null)}>
          <form onSubmit={handleSave}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 16px', marginBottom:16 }}>

              <Field label="Coupon Code">
                <div style={{ display:'flex', gap:6 }}>
                  <input className="mc-inp" style={{ ...inp, flex:1, textTransform:'uppercase' }}
                    value={form.code} onChange={e => setForm(p=>({...p, code: e.target.value.toUpperCase()}))}
                    placeholder="e.g. SAVE20" required/>
                  <button type="button" onClick={() => setForm(p=>({...p, code: genCode()}))}
                    style={{ padding:'8px 12px', border:'1.5px solid #e2e8f0', borderRadius:7,
                      background:'#f8fafc', cursor:'pointer', fontSize:13 }} title="Generate random">
                    🔀
                  </button>
                </div>
              </Field>

              <Field label="Discount Value">
                <input className="mc-inp" style={inp} type="number" step="0.01"
                  value={form.discount_value} onChange={set('discount_value')} required/>
              </Field>

              <Field label="Discount Type">
                <select className="mc-inp" style={{ ...inp, cursor:'pointer' }}
                  value={form.discount_type} onChange={set('discount_type')}>
                  <option value="percentage">Percentage</option>
                  <option value="flat">Flat Amount</option>
                </select>
              </Field>

              <Field label="Course (optional)">
                <select className="mc-inp" style={{ ...inp, cursor:'pointer' }}
                  value={form.course_id} onChange={set('course_id')}>
                  <option value="">All Courses</option>
                  {internships.map(i => (
                    <option key={i.id} value={i.id}>{i.internship_name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Expiry Date (optional)">
                <input className="mc-inp" style={inp} type="date"
                  value={form.expiry_date} onChange={set('expiry_date')}/>
              </Field>

              <Field label="Usage Limit (blank = unlimited)">
                <input className="mc-inp" style={inp} type="number"
                  value={form.usage_limit} onChange={set('usage_limit')} placeholder="e.g. 100"/>
              </Field>

              <div style={{ gridColumn:'1/-1' }}>
                <Field label="Per User Limit (blank = unlimited)">
                  <input className="mc-inp" style={inp} type="number"
                    value={form.per_user_limit} onChange={set('per_user_limit')} placeholder="e.g. 1"/>
                </Field>
              </div>
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end', gap:10,
              borderTop:'1.5px solid #f1f5f9', paddingTop:14 }}>
              <button type="button" onClick={() => setModal(null)}
                style={{ padding:'9px 18px', border:'1.5px solid #e2e8f0', background:'#f8fafc',
                  color:'#475569', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>
                Cancel
              </button>
              <button type="submit" style={btnPri} disabled={saving}>
                {saving ? 'Saving...' : modal === 'edit' ? 'Update Coupon' : 'Add Coupon'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── VIEW USERS MODAL ── */}
      {modal === 'users' && usersModal.coupon && (
        <Modal title={`Users who used: ${usersModal.coupon.code}`} onClose={() => setModal(null)}>
          {usersModal.loading ? (
            <div style={{ textAlign:'center', padding:32 }}>
              <div style={{ display:'inline-block', width:28, height:28, border:'3px solid #ede9fe',
                borderTop:'3px solid #4f46e5', borderRadius:'50%', animation:'mc_spin .7s linear infinite' }}/>
            </div>
          ) : usersModal.users.length === 0 ? (
            <div style={{ textAlign:'center', color:'#94a3b8', padding:32, fontSize:13 }}>
              No usage records found for this coupon.
            </div>
          ) : (
            <>
              <div style={{ overflowX:'auto', maxHeight:400, overflowY:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                      {['User ID','Username','Email','Usage Date'].map(h => (
                        <th key={h} style={thS}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usersModal.users.map((u, i) => (
                      <tr key={i} className="mc-tr">
                        <td style={tdS}>{u.user_id}</td>
                        <td style={{ ...tdS, fontWeight:600, color:'#1e293b' }}>{u.username}</td>
                        <td style={{ ...tdS, color:'#4f46e5', fontSize:11.5 }}>{u.email}</td>
                        <td style={{ ...tdS, fontSize:11 }}>
                          {new Date(u.usage_date).toLocaleDateString('en-GB',
                            { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop:12, fontSize:12, color:'#64748b', fontWeight:600 }}>
                Total Records: {usersModal.users.length}
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}