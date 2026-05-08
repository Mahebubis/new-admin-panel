import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Helmet } from "react-helmet-async";

const BRANCHES = [
  { value:'',             label:'Choose...' },
  { value:'civil',        label:'Civil' },
  { value:'chemical',     label:'Chemical' },
  { value:'cs',           label:'Computer Science' },
  { value:'it',           label:'Information Technology' },
  { value:'electrical',   label:'Electrical' },
  { value:'instrumentation', label:'Instrumentation' },
  { value:'electronics',  label:'Electronics' },
  { value:'enc',          label:'Electronics & Communication' },
  { value:'entc',         label:'Electronics & Telecommunication' },
  { value:'mechanical',   label:'Mechanical' },
  { value:'industrial',   label:'Industrial' },
  { value:'production',   label:'Production' },
  { value:'metallurgy',   label:'Metallurgy' },
  { value:'other',        label:'Other' },
];

const STEPS_FIELDS = [
  { key:'cit_registration',        label:'Registration' },
  { key:'cit_whatsapp_community',  label:'Whatsapp Community' },
  { key:'cit_exam_details',        label:'Exam Details' },
  { key:'cit_exam_result',         label:'Exam Result' },
  { key:'cit_internship_selection',label:'Internship Selection' },
  { key:'istudio_training_portal', label:'Training Portal' },
  { key:'istudio_project_submission', label:'Project Submission' },
  { key:'istudio_certificates',    label:'Certificates' },
  { key:'user_profile',            label:'Profile' },
  { key:'hiring_portal',           label:'Hiring Portal' },
];

/* ─── shared input style ─── */
const inp = {
  width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8,
  fontSize:12.5, fontFamily:'inherit', color:'#1e293b', outline:'none', boxSizing:'border-box',
};
const focusInp = { ...inp, border:'1.5px solid #4f46e5' };

function Field({ label, children, cyan }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:10.5, fontWeight:700, marginBottom:5,
        color: cyan ? '#0891b2' : '#64748b',
        textTransform:'uppercase', letterSpacing:'.4px' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <span style={{ fontSize:13, fontWeight:800, color:'#1e293b' }}>{title}</span>
        <div style={{ flex:1, height:1, background:'#ede9fe' }}/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px 20px' }}>
        {children}
      </div>
    </div>
  );
}

export default function EditStudent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form,    setForm]    = useState({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [focused, setFocused] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get(`/api/students/view.php?id=${id}`)
      .then(res => { if (!cancelled && res.data.success) setForm(res.data.data.student || {}); })
      .catch(() => toast.error('Failed to load student'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const getInp = (key) => ({
    ...inp,
    ...(focused === key ? { borderColor:'#4f46e5', boxShadow:'0 0 0 3px rgba(79,70,229,.08)' } : {}),
    onFocus: () => setFocused(key),
    onBlur:  () => setFocused(''),
  });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/api/students/update.php', { ...form, user_id: parseInt(id) });
      if (res.data.success) {
        toast.success('User updated successfully');
        navigate(-1);
      } else {
        toast.error(res.data.message || 'Update failed');
      }
    } catch { toast.error('Server error'); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, gap:10, color:'#94a3b8' }}>
      <div style={{ width:24, height:24, border:'3px solid #ede9fe', borderTop:'3px solid #4f46e5',
        borderRadius:'50%', animation:'spin .7s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      Loading...
    </div>
  );

  const isCA = form.role == '2' || form.role == '3';

  return (
    <>
    <Helmet>
        <title>Edit Students | Admin Panel</title>
      </Helmet>
    <div style={{ background:'#f5f3ff', minHeight:'100vh', padding:24 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .eu-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        select.eu-sel { appearance:auto; }
      `}</style>

      <div className="eu-root">

        {/* header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:22 }}>
          <button onClick={() => navigate(-1)}
            style={{ width:34, height:34, borderRadius:8, background:'#fff', border:'1.5px solid #e2e8f0',
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              color:'#64748b', fontSize:14 }}>
            ←
          </button>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:'#1e293b' }}>Edit Student</div>
            <div style={{ fontSize:11.5, color:'#94a3b8' }}>#{id} · {form.name || form.email}</div>
          </div>
        </div>

        <form onSubmit={handleSave}>
          <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #ede9fe',
            boxShadow:'0 1px 8px rgba(79,70,229,.06)', padding:28 }}>

            {/* ── YOUR DETAILS ── */}
            <Section title="Your Details">
              <Field label="First Name">
                <input style={getInp('fname')} value={form.fname||''} onChange={e => set('fname', e.target.value)}/>
              </Field>
              <Field label="Last Name">
                <input style={getInp('lname')} value={form.lname||''} onChange={e => set('lname', e.target.value)}/>
              </Field>
              <Field label="Full Name">
                <input style={getInp('name')} value={form.name||''} onChange={e => set('name', e.target.value)}/>
              </Field>
              <Field label="Gender">
                <div style={{ display:'flex', gap:20, marginTop:6 }}>
                  {['male','female','other'].map(g => (
                    <label key={g} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5, cursor:'pointer', color:'#334155' }}>
                      <input type="radio" name="gender" value={g} checked={form.gender===g}
                        onChange={() => set('gender', g)}
                        style={{ accentColor:'#4f46e5', width:14, height:14 }}/>
                      {g.charAt(0).toUpperCase()+g.slice(1)}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Change Password">
                <input style={getInp('password')} type="text" value={form.password||''}
                  onChange={e => set('password', e.target.value)} placeholder="Leave blank to keep current"/>
              </Field>
            </Section>

            <div style={{ height:1, background:'#f1f5f9', margin:'4px 0 24px' }}/>

            {/* ── CONTACT DETAILS ── */}
            <Section title="Contact Details">
              <Field label="Email">
                <input style={getInp('email')} type="email" value={form.email||''}
                  onChange={e => set('email', e.target.value)}/>
              </Field>
              <Field label="Exam Panel Email" cyan>
                <input style={{ ...getInp('exam_email'), borderColor: focused==='exam_email' ? '#0891b2' : '#bae6fd', color:'#0891b2', background:'#f0f9ff' }}
                  type="email" value={form.exam_email||''} onChange={e => set('exam_email', e.target.value)}/>
              </Field>
              <Field label="Mobile Number">
                <input style={getInp('phone')} value={form.phone||''} maxLength={10}
                  onChange={e => set('phone', e.target.value)}/>
              </Field>
              {isCA && (
                <Field label="Whatsapp Number">
                  <input style={getInp('whatsapp')} value={form.whatsapp||''} maxLength={10}
                    onChange={e => set('whatsapp', e.target.value)}/>
                </Field>
              )}
              <Field label="City">
                <input style={getInp('city')} value={form.city||''} onChange={e => set('city', e.target.value)}/>
              </Field>
              <Field label="State">
                <input style={getInp('state')} value={form.state||''} onChange={e => set('state', e.target.value)}/>
              </Field>
              <Field label="Pin Code">
                <input style={getInp('pincode')} value={form.pincode||''} maxLength={6}
                  onChange={e => set('pincode', e.target.value)}/>
              </Field>
            </Section>

            <div style={{ height:1, background:'#f1f5f9', margin:'4px 0 24px' }}/>

            {/* ── COLLEGE DETAILS ── */}
            <Section title="College Details">
              <Field label="College Name">
                <input style={getInp('college_name')} value={form.college_name||''}
                  onChange={e => set('college_name', e.target.value)}/>
              </Field>
              <Field label="Program">
                <select className="eu-sel" style={getInp('program')} value={form.program||''}
                  onChange={e => set('program', e.target.value)}>
                  <option value="">Choose...</option>
                  <option value="ug">UG</option>
                  <option value="pg">PG</option>
                </select>
              </Field>
              <Field label="Year">
                <select className="eu-sel" style={getInp('year')} value={form.year||''}
                  onChange={e => set('year', e.target.value)}>
                  <option value="">Choose...</option>
                  <option value="fy">First Year</option>
                  <option value="sy">Second Year</option>
                  <option value="ty">Third Year</option>
                  <option value="ly">Final Year</option>
                </select>
              </Field>
              <Field label="Branch">
                <select className="eu-sel" style={getInp('branch')} value={form.branch||''}
                  onChange={e => set('branch', e.target.value)}>
                  {BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
                {form.branch === 'other' && (
                  <input style={{ ...getInp('other_branch'), marginTop:8 }} value={form.other_branch||''}
                    placeholder="Specify branch" onChange={e => set('other_branch', e.target.value)}/>
                )}
              </Field>
            </Section>

            <div style={{ height:1, background:'#f1f5f9', margin:'4px 0 24px' }}/>

            {/* ── USER STEPS ── */}
            <div style={{ marginBottom:28 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                <span style={{ fontSize:13, fontWeight:800, color:'#1e293b' }}>User Steps</span>
                <div style={{ flex:1, height:1, background:'#ede9fe' }}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:'10px 12px' }}>
                {STEPS_FIELDS.map(({ key, label }) => {
                  const checked = form[key] === '1' || form[key] === 1;
                  return (
                    <label key={key}
                      style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer',
                        padding:'8px 12px', borderRadius:8, fontSize:12, fontWeight:600,
                        border:`1.5px solid ${checked ? '#c4b5fd' : '#e2e8f0'}`,
                        background: checked ? '#f5f3ff' : '#f8fafc',
                        color: checked ? '#4f46e5' : '#64748b',
                        transition:'all .15s', userSelect:'none' }}>
                      <input type="checkbox" checked={checked}
                        onChange={e => set(key, e.target.checked ? '1' : '0')}
                        style={{ accentColor:'#4f46e5', width:14, height:14 }}/>
                      {label}
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ height:1, background:'#f1f5f9', margin:'4px 0 24px' }}/>

            {/* ── MISC SETTINGS ── */}
            <Section title="Misc Settings">
              <Field label="Role">
                <select className="eu-sel" style={getInp('role')} value={form.role||''}
                  onChange={e => set('role', e.target.value)}>
                  <option value="">Choose...</option>
                  <option value="2">Campus Ambassador</option>
                  <option value="3" disabled>Campus Coordinator</option>
                  <option value="4">Student</option>
                </select>
              </Field>
              <Field label="Apply For Exam">
                <select className="eu-sel" style={getInp('applyforexam')} value={form.applyforexam??''}
                  onChange={e => set('applyforexam', e.target.value)}>
                  <option value="">Choose...</option>
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </Field>
              <Field label="Active">
                <select className="eu-sel" style={getInp('active')} value={form.active??''}
                  onChange={e => set('active', e.target.value)}>
                  <option value="">Choose...</option>
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </Field>
              <Field label="Test Account">
                <select className="eu-sel" style={getInp('is_test_account')} value={form.is_test_account??''}
                  onChange={e => set('is_test_account', e.target.value)}>
                  <option value="">Choose...</option>
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </Field>
              <Field label="Payment Status">
                <select className="eu-sel" style={getInp('payment_status')} value={form.payment_status||''}
                  onChange={e => set('payment_status', e.target.value)}>
                  <option value="">Choose...</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </Field>
              <Field label="Payment ID">
                <input style={getInp('payment_id')} value={form.payment_id||''}
                  onChange={e => set('payment_id', e.target.value)}/>
              </Field>
              <Field label="Used Ref ID by Student">
                <input style={getInp('used_ref_id')} value={form.used_ref_id||''}
                  onChange={e => set('used_ref_id', e.target.value)}/>
              </Field>
              <Field label="Current Exam Date">
                <input style={getInp('current_exam_date')} value={form.current_exam_date||''}
                  onChange={e => set('current_exam_date', e.target.value)}/>
              </Field>
            </Section>

            {/* ── CA / CC SETTINGS (only if role is 2 or 3) ── */}
            {isCA && (
              <>
                <div style={{ height:1, background:'#f1f5f9', margin:'4px 0 24px' }}/>
                <Section title="CA / CC Settings">
                  <Field label="CA Referral ID">
                    <input style={getInp('ca_ref_id')} value={form.ca_ref_id||''}
                      onChange={e => set('ca_ref_id', e.target.value)}/>
                  </Field>
                  <Field label="CC Referral ID">
                    <input style={getInp('cc_ref_id')} value={form.cc_ref_id||''}
                      onChange={e => set('cc_ref_id', e.target.value)}/>
                  </Field>
                  <Field label="Used Ref ID by CA">
                    <input style={getInp('used_ref_id_by_ca')} value={form.used_ref_id_by_ca||''}
                      onChange={e => set('used_ref_id_by_ca', e.target.value)}/>
                  </Field>
                  <Field label="Certificate">
                    <select className="eu-sel" style={getInp('certificate')} value={form.certificate||''}
                      onChange={e => set('certificate', e.target.value)}>
                      <option value="">Choose...</option>
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </Field>
                </Section>
              </>
            )}

            {/* ── SUBMIT ── */}
            <div style={{ display:'flex', justifyContent:'center', paddingTop:8, gap:12 }}>
              <button type="button" onClick={() => navigate(-1)}
                style={{ padding:'11px 28px', border:'1.5px solid #e2e8f0', background:'#f8fafc',
                  color:'#475569', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={saving}
                style={{ padding:'11px 36px', border:'none', borderRadius:9, fontSize:13, fontWeight:700,
                  cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1, color:'#fff',
                  background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
                  boxShadow:'0 4px 14px rgba(79,70,229,.3)' }}>
                {saving ? 'Updating...' : 'Update Profile'}
              </button>
            </div>

          </div>
        </form>
      </div>
    </div>
    </>
  );
}