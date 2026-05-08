/* ═══════════════════════════════════════════════════════════
   SKILL ASSESSMENT MODULE
   Named exports:
     SkillSegments    → /skills               (segment dashboard)
     SkillSegmentSkills → /skills/:segmentId  (skills per segment)
     SkillEditSkill   → /skills/:segmentId/edit/:skillId (questions)
═══════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';

const API  = 'https://cit3.internshipstudio.com/admin/react-api/api/adminPanel/skills/skills_api.php';
const get  = p   => api.get(API, { params: p });
const post = data => api.post(API, new URLSearchParams({ ...data }));

/* ── shared ── */
const Label = ({ c }) => (
  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b',
    marginBottom:5, textTransform:'uppercase', letterSpacing:'.05em' }}>{c}</label>
);
const Inp = ({ ...p }) => (
  <input {...p} style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0',
    borderRadius:9, fontSize:13, fontFamily:'inherit', color:'#1e293b', outline:'none', ...p.style }}
    onFocus={e=>e.target.style.borderColor='#4f46e5'}
    onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
);
const Btn = ({ children, onClick, disabled, variant='primary', style={} }) => {
  const bg = { primary:'linear-gradient(135deg,#4f46e5,#7c3aed)',
    danger:'linear-gradient(135deg,#dc2626,#b91c1c)', gray:'#f1f5f9',
    amber:'linear-gradient(135deg,#f59e0b,#d97706)',
    success:'linear-gradient(135deg,#16a34a,#15803d)' };
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding:'8px 18px', border:'none', borderRadius:9, fontSize:13, fontWeight:700,
        cursor:disabled?'not-allowed':'pointer', fontFamily:'inherit',
        background:bg[variant]||bg.primary, color:variant==='gray'?'#475569':'#fff',
        opacity:disabled?.6:1, display:'flex', alignItems:'center', gap:7, ...style }}>
      {children}
    </button>
  );
};
const FF = ({ label, children }) => <div style={{ marginBottom:14 }}><Label c={label}/>{children}</div>;

const Modal = ({ title, onClose, children, wide }) => (
  <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex',
    alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
    onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:wide?680:480,
      maxHeight:'92vh', overflowY:'auto', boxShadow:'0 24px 70px rgba(0,0,0,.22)' }}>
      <div style={{ padding:'14px 20px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
        borderRadius:'16px 16px 0 0', display:'flex', justifyContent:'space-between',
        alignItems:'center', position:'sticky', top:0, zIndex:2 }}>
        <span style={{ fontSize:15, fontWeight:800, color:'#fff' }}>{title}</span>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none',
          cursor:'pointer', color:'#fff', fontSize:18, borderRadius:6, padding:'2px 9px' }}>×</button>
      </div>
      <div style={{ padding:20 }}>{children}</div>
    </div>
  </div>
);
const Confirm = ({ title, text, detail, onClose, onConfirm, loading }) => (
  <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex',
    alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}
    onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{ background:'#fff', borderRadius:16, padding:28, maxWidth:420, width:'100%',
      textAlign:'center', boxShadow:'0 24px 70px rgba(0,0,0,.2)' }}>
      <div style={{ fontSize:44, marginBottom:12 }}>⚠️</div>
      <div style={{ fontSize:16, fontWeight:800, color:'#1e293b', marginBottom:8 }}>{title}</div>
      <div style={{ fontSize:13, color:'#475569', marginBottom:8 }}>{text}</div>
      {detail && <div style={{ fontSize:12, color:'#ef4444', marginBottom:20 }}>{detail}</div>}
      <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
        <Btn variant="gray" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" onClick={onConfirm} disabled={loading}>🗑️ Delete</Btn>
      </div>
    </div>
  </div>
);
const PageShell = ({ children }) => (
  <div style={{ display:'flex', flexDirection:'column', minHeight:'calc(100vh - 62px)',
    background:'#f5f3ff', padding:20, gap:14, overflowY:'auto' }}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    .sa-root*{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
    @keyframes sp{to{transform:rotate(360deg)}}
    .sp{display:inline-block;width:18px;height:18px;border:2.5px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:sp .7s linear infinite}`}</style>
    <div className="sa-root">{children}</div>
  </div>
);
const Spinner = ({ size=20 }) => (
  <span className="sp" style={{ width:size, height:size, display:'inline-block' }}/>
);
const SubHeader = ({ segmentName, skillName }) => (
  <div style={{ fontSize:12.5, color:'#94a3b8', display:'flex', gap:6, alignItems:'center', marginBottom:4 }}>
    <Link to="/skills" style={{ color:'#4f46e5', fontWeight:600, textDecoration:'none' }}>Segments</Link>
    {segmentName && <>
      <span>/</span>
      {skillName
        ? <Link to={`/skills/${segmentName._id||''}`} style={{ color:'#4f46e5', fontWeight:600, textDecoration:'none' }}>{segmentName.name}</Link>
        : <span style={{ color:'#1e293b', fontWeight:700 }}>{segmentName.name||segmentName}</span>}
    </>}
    {skillName && <>
      <span>/</span>
      <span style={{ color:'#1e293b', fontWeight:700 }}>{skillName}</span>
    </>}
  </div>
);

/* ═══════════════════════════════════════════════════════════
   1. SKILL SEGMENTS DASHBOARD (index.php)
   Tables: skill_assessment_segments, skill_assessment_skills, skill_assessment_questions
═══════════════════════════════════════════════════════════ */
export function SkillSegments() {
  const [segments, setSegments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [modal,    setModal]    = useState(null); // 'add'|'edit'|'delete'
  const [editData, setEditData] = useState(null);
  const [delTgt,   setDelTgt]   = useState(null);
  const blank = { name:'', description:'' };
  const [form, setForm] = useState(blank);
  const upd = k => e => setForm(p=>({...p,[k]:e.target.value}));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await get({ action:'get_segments' });
      setSegments(r.data.data?.segments || []);
    } catch{ toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totals = segments.reduce((a,s)=>({
    segs:a.segs+1, skills:a.skills+(+s.skills_count||0)
  }), { segs:0, skills:0 });

  const doSave = async isEdit => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      if (isEdit) await post({ action:'edit_segment', id:editData.id, ...form });
      else await post({ action:'add_segment', ...form });
      toast.success(isEdit?'Updated':'Segment added');
      setModal(null); setForm(blank); setEditData(null); load();
    } catch{ toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    setSaving(true);
    try {
      await post({ action:'delete_segment', id:delTgt.id });
      toast.success('Deleted'); setModal(null); setDelTgt(null); load();
    } catch{ toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const inpS = { width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0',
    borderRadius:9, fontSize:13, fontFamily:'inherit', color:'#1e293b', outline:'none' };

  return (
    <PageShell>
      {/* header */}
      <div style={{ background:'#fff', borderRadius:14, padding:'16px 22px',
        border:'1.5px solid #ede9fe', boxShadow:'0 1px 6px rgba(79,70,229,.07)',
        display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:'#1e293b' }}>🧩 Skill Assessment Segments</div>
          <div style={{ fontSize:12.5, color:'#64748b', marginTop:2 }}>Manage assessment segments</div>
        </div>
        <Btn onClick={()=>{ setForm(blank); setModal('add'); }}>➕ Add Segment</Btn>
      </div>

      {/* stat chips */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12 }}>
        {[
          { label:'Total Segments', val:totals.segs,   bg:'#dbeafe', color:'#1d4ed8' },
          { label:'Total Skills',   val:totals.skills, bg:'#dcfce7', color:'#15803d' },
        ].map(s=>(
          <div key={s.label} style={{ background:'#fff', borderRadius:12, border:'1.5px solid #ede9fe',
            padding:'14px 18px', boxShadow:'0 1px 5px rgba(79,70,229,.06)' }}>
            <div style={{ fontSize:26, fontWeight:800, color:s.color }}>{loading?'…':s.val}</div>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b',
              textTransform:'uppercase', letterSpacing:'.05em', marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* grid */}
      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>
          <Spinner size={28}/><div style={{ marginTop:12, fontSize:13 }}>Loading...</div>
        </div>
      ) : !segments.length ? (
        <div style={{ background:'#fff', borderRadius:14, padding:60, textAlign:'center',
          border:'1.5px solid #ede9fe', color:'#94a3b8' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🧩</div>
          <div style={{ fontSize:14, fontWeight:600 }}>No segments yet</div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
          {segments.map(seg => (
            <div key={seg.id} style={{ background:'#fff', borderRadius:14, border:'1.5px solid #ede9fe',
              padding:20, boxShadow:'0 1px 6px rgba(79,70,229,.07)',
              transition:'box-shadow .2s, transform .2s' }}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 8px 24px rgba(79,70,229,.14)';e.currentTarget.style.transform='translateY(-2px)';}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 1px 6px rgba(79,70,229,.07)';e.currentTarget.style.transform='translateY(0)';}}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                <div style={{ fontSize:16, fontWeight:800, color:'#1e293b' }}>{seg.name}</div>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={()=>{setEditData(seg);setForm({name:seg.name,description:seg.description||''});setModal('edit');}}
                    style={{ background:'none',border:'none',cursor:'pointer',fontSize:15,color:'#f59e0b' }}>✏️</button>
                  <button onClick={()=>{setDelTgt(seg);setModal('delete');}}
                    style={{ background:'none',border:'none',cursor:'pointer',fontSize:15,color:'#ef4444' }}>🗑️</button>
                </div>
              </div>
              {seg.description && <p style={{ fontSize:12.5, color:'#64748b', marginBottom:14, lineHeight:1.6 }}>{seg.description}</p>}
              <div style={{ display:'flex', gap:10 }}>
                <div style={{ flex:1, background:'#f5f3ff', borderRadius:9, padding:'10px 14px', textAlign:'center' }}>
                  <div style={{ fontSize:20, fontWeight:800, color:'#4f46e5' }}>{seg.skills_count}</div>
                  <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>Skills</div>
                </div>
                <Link to={`/skills/${seg.id}`}
                  style={{ flex:1, background:'#ede9fe', borderRadius:9, padding:'10px 14px',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'#4f46e5', fontSize:13, fontWeight:700, textDecoration:'none',
                    transition:'background .15s' }}
                  onMouseEnter={e=>e.target.style.background='#ddd6fe'}
                  onMouseLeave={e=>e.target.style.background='#ede9fe'}>
                  Manage Skills →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* modals */}
      {(modal==='add'||modal==='edit')&&(
        <Modal title={modal==='add'?'➕ Add Segment':'✏️ Edit Segment'} onClose={()=>setModal(null)}>
          <FF label="Segment Name *"><Inp value={form.name} onChange={upd('name')}/></FF>
          <FF label="Description">
            <textarea value={form.description} onChange={upd('description')} rows={4}
              style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0',
                borderRadius:9, fontSize:13, fontFamily:'inherit', resize:'vertical', outline:'none' }}
              onFocus={e=>e.target.style.borderColor='#4f46e5'}
              onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
          </FF>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <Btn variant="gray" onClick={()=>setModal(null)}>Cancel</Btn>
            <Btn variant={modal==='edit'?'amber':'primary'} onClick={()=>doSave(modal==='edit')} disabled={saving}>
              💾 {modal==='edit'?'Update':'Add'}
            </Btn>
          </div>
        </Modal>
      )}
      {modal==='delete'&&delTgt&&(
        <Confirm title="Delete Segment?" text={<>Delete <strong>{delTgt.name}</strong>?</>}
          detail="This cannot be undone." onClose={()=>setModal(null)} onConfirm={doDelete} loading={saving}/>
      )}
    </PageShell>
  );
}

/* ═══════════════════════════════════════════════════════════
   2. SEGMENT SKILLS  (segment_skills.php)
   Tables: skill_assessment_skills, user_skill_requests
═══════════════════════════════════════════════════════════ */
export function SkillSegmentSkills() {
  const { segmentId } = useParams();
  const navigate = useNavigate();
  const [skills,   setSkills]   = useState([]);
  const [segment,  setSegment]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [modal,    setModal]    = useState(null);
  const [delTgt,   setDelTgt]   = useState(null);
  const [form,     setForm]     = useState({ name:'', description:'' });
  const upd = k => e => setForm(p=>({...p,[k]:e.target.value}));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await get({ action:'get_skills', segment_id:segmentId });
      setSkills(r.data.data?.skills || []);
      setSegment(r.data.data?.segment || null);
    } catch{ toast.error('Failed'); }
    finally { setLoading(false); }
  }, [segmentId]);

  useEffect(() => { load(); }, [load]);

  const doAdd = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      await post({ action:'add_skill', segment_id:segmentId, ...form });
      toast.success('Skill added'); setModal(null); setForm({ name:'', description:'' }); load();
    } catch{ toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    setSaving(true);
    try {
      await post({ action:'delete_skill', skill_id:delTgt.id, segment_id:segmentId });
      toast.success('Deleted'); setModal(null); setDelTgt(null); load();
    } catch{ toast.error('Failed'); }
    finally { setSaving(false); }
  };

  return (
    <PageShell>
      {/* header */}
      <div style={{ background:'#fff', borderRadius:14, padding:'16px 22px',
        border:'1.5px solid #ede9fe', boxShadow:'0 1px 6px rgba(79,70,229,.07)' }}>
        <div style={{ fontSize:12.5, color:'#94a3b8', display:'flex', gap:6, marginBottom:6 }}>
          <Link to="/skills" style={{ color:'#4f46e5', fontWeight:600, textDecoration:'none' }}>Segments</Link>
          <span>/</span>
          <span style={{ color:'#1e293b', fontWeight:700 }}>{segment?.name||'...'}</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:'#1e293b' }}>
              {segment?.name || '...'} — Skills
            </div>
            <div style={{ fontSize:12.5, color:'#64748b', marginTop:2 }}>Manage skills for this segment</div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <Btn variant="gray" onClick={()=>navigate('/skills')}>← Back to Segments</Btn>
            <Btn onClick={()=>{ setForm({ name:'', description:'' }); setModal('add'); }}>➕ Add Skill</Btn>
          </div>
        </div>
      </div>

      {/* grid */}
      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}><Spinner size={28}/></div>
      ) : !skills.length ? (
        <div style={{ background:'#fff', borderRadius:14, padding:60, textAlign:'center',
          border:'1.5px solid #ede9fe', color:'#94a3b8' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🔧</div>
          <div style={{ fontSize:13, fontWeight:600 }}>No skills yet</div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
          {skills.map(sk => (
            <div key={sk.id} style={{ background:'#fff', borderRadius:14, border:'1.5px solid #ede9fe',
              padding:20, boxShadow:'0 1px 6px rgba(79,70,229,.07)',
              transition:'box-shadow .2s, transform .2s' }}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 8px 24px rgba(79,70,229,.14)';e.currentTarget.style.transform='translateY(-2px)';}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 1px 6px rgba(79,70,229,.07)';e.currentTarget.style.transform='translateY(0)';}}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div style={{ fontSize:15, fontWeight:700, color:'#1e293b' }}>{sk.name}</div>
                <div style={{ display:'flex', gap:6 }}>
                  <Link to={`/skills/${segmentId}/edit/${sk.id}`}
                    style={{ fontSize:15, color:'#f59e0b', textDecoration:'none' }}>✏️</Link>
                  <button onClick={()=>{setDelTgt(sk);setModal('delete');}}
                    style={{ background:'none',border:'none',cursor:'pointer',fontSize:15,color:'#ef4444' }}>🗑️</button>
                </div>
              </div>
              {sk.description && <p style={{ fontSize:12.5, color:'#64748b', marginBottom:12, lineHeight:1.6 }}>{sk.description}</p>}
              <div style={{ background:'#f5f3ff', borderRadius:9, padding:'10px 14px', textAlign:'center' }}>
                <div style={{ fontSize:11, color:'#64748b' }}>Requests</div>
                <div style={{ fontSize:20, fontWeight:800, color:'#4f46e5' }}>{sk.request_count}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal==='add'&&(
        <Modal title="🔧 Add Skill" onClose={()=>setModal(null)}>
          <FF label="Skill Name *"><Inp value={form.name} onChange={upd('name')}/></FF>
          <FF label="Description">
            <textarea value={form.description} onChange={upd('description')} rows={4}
              style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0',
                borderRadius:9, fontSize:13, fontFamily:'inherit', resize:'vertical', outline:'none' }}
              onFocus={e=>e.target.style.borderColor='#4f46e5'}
              onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
          </FF>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <Btn variant="gray" onClick={()=>setModal(null)}>Cancel</Btn>
            <Btn onClick={doAdd} disabled={saving}>💾 Add Skill</Btn>
          </div>
        </Modal>
      )}
      {modal==='delete'&&delTgt&&(
        <Confirm title="Delete Skill?" text={<>Delete <strong>{delTgt.name}</strong>?</>}
          detail="This cannot be undone." onClose={()=>setModal(null)} onConfirm={doDelete} loading={saving}/>
      )}
    </PageShell>
  );
}

/* ═══════════════════════════════════════════════════════════
   3. EDIT SKILL  (edit_skill.php)
   Tables: skill_assessment_questions, skill_assessment_options,
           expected_output, skill_assessment_levels
═══════════════════════════════════════════════════════════ */

/* ── dynamic option rows ── */
function OptionRows({ items, onChange, label, nameSuffix }) {
  const remove = i => onChange(items.filter((_,idx)=>idx!==i));
  const upd    = (i, v) => onChange(items.map((it,idx)=>idx===i?{...it,text:v}:it));
  const setCorrect = i => onChange(items.map((it,idx)=>({...it, correct:idx===i})));
  return (
    <div>
      <Label c={label}/>
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
        {items.map((it,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type="text" value={it.text} onChange={e=>upd(i,e.target.value)}
              placeholder={`Option ${i+1}`}
              style={{ flex:1, padding:'7px 11px', border:'1.5px solid #e2e8f0',
                borderRadius:8, fontSize:12.5, fontFamily:'inherit', outline:'none' }}
              onFocus={e=>e.target.style.borderColor='#4f46e5'}
              onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
            <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#64748b', cursor:'pointer' }}>
              <input type="radio" name={nameSuffix} checked={!!it.correct}
                onChange={()=>setCorrect(i)} style={{ accentColor:'#4f46e5' }}/>
              ✓
            </label>
            <button onClick={()=>remove(i)}
              style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:16, padding:2 }}>×</button>
          </div>
        ))}
      </div>
      <button onClick={()=>onChange([...items,{text:'',correct:false}])}
        style={{ padding:'5px 12px', border:'1.5px solid #e2e8f0', borderRadius:7,
          background:'#f8fafc', color:'#475569', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
        + Add Option
      </button>
    </div>
  );
}
function TextRows({ items, onChange, label, placeholder }) {
  const remove = i => onChange(items.filter((_,idx)=>idx!==i));
  const upd    = (i, v) => onChange(items.map((it,idx)=>idx===i?v:it));
  return (
    <div>
      <Label c={label}/>
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
        {items.map((it,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type="text" value={it} onChange={e=>upd(i,e.target.value)} placeholder={placeholder}
              style={{ flex:1, padding:'7px 11px', border:'1.5px solid #e2e8f0',
                borderRadius:8, fontSize:12.5, fontFamily:'inherit', outline:'none' }}
              onFocus={e=>e.target.style.borderColor='#4f46e5'}
              onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
            <button onClick={()=>remove(i)}
              style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:16, padding:2 }}>×</button>
          </div>
        ))}
      </div>
      <button onClick={()=>onChange([...items,''])}
        style={{ padding:'5px 12px', border:'1.5px solid #e2e8f0', borderRadius:7,
          background:'#f8fafc', color:'#475569', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
        + Add {label.replace(/\*/g,'').trim()}
      </button>
    </div>
  );
}

/* ── question form inside modal ── */
const blankQ = () => ({
  qType:'MCQ', levelId:'', qText:'',
  options:[{text:'',correct:true},{text:'',correct:false}],
  inputs:[''], outputs:[''],
});

function QuestionForm({ levels, form, onChange, onSave, onClose, saving, isEdit }) {
  const setF = (k, v) => onChange({ ...form, [k]:v });
  return (
    <>
      <FF label="Question Type">
        <select value={form.qType} onChange={e=>setF('qType',e.target.value)}
          style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0',
            borderRadius:9, fontSize:13, fontFamily:'inherit', outline:'none', background:'#fff' }}>
          <option value="MCQ">MCQ</option>
          <option value="CODING">CODING</option>
        </select>
      </FF>
      <FF label="Level">
        <select value={form.levelId} onChange={e=>setF('levelId',e.target.value)}
          style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0',
            borderRadius:9, fontSize:13, fontFamily:'inherit', outline:'none', background:'#fff' }}>
          <option value="">Select level</option>
          {levels.map(lv=><option key={lv.id} value={lv.id}>{lv.name}</option>)}
        </select>
      </FF>
      <FF label="Question Text *">
        <textarea value={form.qText} onChange={e=>setF('qText',e.target.value)} rows={3}
          style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0',
            borderRadius:9, fontSize:13, fontFamily:'inherit', resize:'vertical', outline:'none' }}
          onFocus={e=>e.target.style.borderColor='#4f46e5'}
          onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
      </FF>
      {form.qType === 'MCQ' ? (
        <OptionRows items={form.options} onChange={v=>setF('options',v)}
          label="MCQ Options (● = correct)" nameSuffix={`correct_${isEdit?'edit':'add'}`}/>
      ) : (
        <>
          <div style={{ marginBottom:14 }}>
            <TextRows items={form.inputs}  onChange={v=>setF('inputs',v)}
              label="Coding Inputs" placeholder="Input value"/>
          </div>
          <TextRows items={form.outputs} onChange={v=>setF('outputs',v)}
            label="Expected Outputs" placeholder="Expected output"/>
        </>
      )}
      <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:18 }}>
        <Btn variant="gray" onClick={onClose}>Cancel</Btn>
        <Btn variant={isEdit?'amber':'success'} onClick={onSave} disabled={saving}>
          {saving ? <><Spinner/> Saving...</> : `💾 ${isEdit?'Update':'Add'} Question`}
        </Btn>
      </div>
    </>
  );
}

export function SkillEditSkill() {
  const { segmentId, skillId } = useParams();
  const navigate  = useNavigate();
  const fileRef   = useRef(null);

  const [skill,      setSkill]      = useState(null);
  const [levels,     setLevels]     = useState([]);
  const [questions,  setQuestions]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [skillName,  setSkillName]  = useState('');
  const [modal,      setModal]      = useState(null); // 'add'|'edit'|'delete'
  const [qForm,      setQForm]      = useState(blankQ());
  const [editQ,      setEditQ]      = useState(null); // question being edited
  const [delQ,       setDelQ]       = useState(null);
  const [uploadMsg,  setUploadMsg]  = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sk, lvl, qs] = await Promise.all([
        get({ action:'get_skill', skill_id:skillId }),
        get({ action:'get_levels' }),
        get({ action:'get_questions', skill_id:skillId }),
      ]);
      const s = sk.data.data?.skill;
      setSkill(s); setSkillName(s?.name||'');
      setLevels(lvl.data.data?.levels || []);
      setQuestions(qs.data.data?.questions || []);
    } catch{ toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [skillId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ── update skill name ── */
  const saveSkillName = async () => {
    if (!skillName.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      await post({ action:'update_skill', skill_id:skillId, name:skillName });
      toast.success('Skill name updated');
    } catch{ toast.error('Failed'); }
    finally { setSaving(false); }
  };

  /* ── add question ── */
  const doAddQ = async () => {
    if (!qForm.qText.trim()) { toast.error('Question text required'); return; }
    setSaving(true);
    try {
      const opts    = qForm.options.map(o=>o.text);
      const corrIdx = qForm.options.findIndex(o=>o.correct);
      await post({
        action:'add_question', skill_id:skillId, level_id:qForm.levelId,
        question_text:qForm.qText, question_type:qForm.qType,
        correct_index:corrIdx>=0?corrIdx:0,
        options:JSON.stringify(opts),
        inputs:JSON.stringify(qForm.inputs),
        outputs:JSON.stringify(qForm.outputs),
      });
      toast.success('Question added'); setModal(null); setQForm(blankQ()); loadAll();
    } catch{ toast.error('Failed'); }
    finally { setSaving(false); }
  };

  /* ── edit question ── */
  const openEditQ = q => {
    const opts = q.options.map((text, i) => ({ text, correct: i===+q.correct_answer_index }));
    setQForm({
      qType:q.question_type||'MCQ', levelId:String(q.level_id||''),
      qText:q.question_text, options:opts.length?opts:[{text:'',correct:true}],
      inputs:q.options.length&&q.question_type==='CODING'?q.options:[''],
      outputs:q.outputs.length?q.outputs:[''],
    });
    setEditQ(q); setModal('edit');
  };

  const doEditQ = async () => {
    if (!qForm.qText.trim()) { toast.error('Question text required'); return; }
    setSaving(true);
    try {
      const opts    = qForm.options.map(o=>o.text);
      const corrIdx = qForm.options.findIndex(o=>o.correct);
      await post({
        action:'edit_question', question_id:editQ.id, skill_id:skillId,
        level_id:qForm.levelId, question_text:qForm.qText, question_type:qForm.qType,
        correct_index:corrIdx>=0?corrIdx:0,
        options:JSON.stringify(opts),
        inputs:JSON.stringify(qForm.qType==='CODING'?qForm.inputs:opts),
        outputs:JSON.stringify(qForm.outputs),
      });
      toast.success('Updated'); setModal(null); setEditQ(null); setQForm(blankQ()); loadAll();
    } catch{ toast.error('Failed'); }
    finally { setSaving(false); }
  };

  /* ── delete question ── */
  const doDeleteQ = async () => {
    setSaving(true);
    try {
      await post({ action:'delete_question', question_id:delQ.id, skill_id:skillId });
      toast.success('Deleted'); setModal(null); setDelQ(null); loadAll();
    } catch{ toast.error('Failed'); }
    finally { setSaving(false); }
  };

  /* ── excel upload ── */
  const handleExcelUpload = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('action', 'upload_excel');
    fd.append('skill_id', skillId);
    fd.append('excel_file', file);
    setSaving(true); setUploadMsg('');
    try {
      const r = await api.post(API, fd, { headers:{ 'Content-Type':'multipart/form-data' } });
      setUploadMsg(r.data.message || 'Uploaded');
      toast.success(r.data.message||'Uploaded');
      loadAll();
    } catch(err) {
      const msg = err.response?.data?.message || 'Upload failed';
      setUploadMsg(msg); toast.error(msg);
    } finally { setSaving(false); e.target.value=''; }
  };

  const thS = { padding:'10px 14px', fontSize:10.5, fontWeight:700, color:'#fff', textAlign:'left',
    background:'linear-gradient(135deg,#4f46e5,#7c3aed)', borderRight:'1px solid rgba(255,255,255,.15)',
    position:'sticky', top:0, zIndex:2, whiteSpace:'nowrap' };
  const tdS = { padding:'11px 14px', fontSize:12.5, color:'#1e293b', borderBottom:'1px solid #f5f3ff', verticalAlign:'top' };

  return (
    <PageShell>
      {/* breadcrumb header */}
      <div style={{ background:'#fff', borderRadius:14, padding:'16px 22px',
        border:'1.5px solid #ede9fe', boxShadow:'0 1px 6px rgba(79,70,229,.07)' }}>
        <div style={{ fontSize:12.5, color:'#94a3b8', display:'flex', gap:6, marginBottom:6 }}>
          <Link to="/skills" style={{ color:'#4f46e5', fontWeight:600, textDecoration:'none' }}>Segments</Link>
          <span>/</span>
          <Link to={`/skills/${segmentId}`} style={{ color:'#4f46e5', fontWeight:600, textDecoration:'none' }}>
            {skill?.segment_name||'Segment'}
          </Link>
          <span>/</span>
          <span style={{ color:'#1e293b', fontWeight:700 }}>Edit Skill</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:'#1e293b' }}>✏️ Edit Skill</div>
            {skill?.segment_name && <div style={{ fontSize:12.5, color:'#64748b', marginTop:2 }}>
              Segment: <strong>{skill.segment_name}</strong>
            </div>}
          </div>
          <Btn variant="gray" onClick={()=>navigate(`/skills/${segmentId}`)}>← Back to Segment</Btn>
        </div>
      </div>

      {/* skill name form */}
      <div style={{ background:'#fff', borderRadius:14, padding:'18px 22px',
        border:'1.5px solid #ede9fe', boxShadow:'0 1px 6px rgba(79,70,229,.07)' }}>
        <Label c="Skill Name"/>
        <div style={{ display:'flex', gap:12 }}>
          <Inp value={skillName} onChange={e=>setSkillName(e.target.value)}
            placeholder="Skill name" style={{ flex:1 }}/>
          <Btn onClick={saveSkillName} disabled={saving}>💾 Save Changes</Btn>
        </div>
      </div>

      {/* upload message */}
      {uploadMsg && (
        <div style={{ background:'#fefce8', border:'1.5px solid #fde047', borderRadius:10,
          padding:'10px 16px', fontSize:13, color:'#854d0e' }}>
          {uploadMsg}
        </div>
      )}

      {/* questions panel */}
      <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #ede9fe',
        overflow:'hidden', boxShadow:'0 1px 6px rgba(79,70,229,.07)' }}>
        {/* questions header */}
        <div style={{ padding:'14px 20px', borderBottom:'1.5px solid #f5f3ff',
          display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
          <div style={{ fontSize:15, fontWeight:800, color:'#1e293b' }}>📝 Questions (MCQ / CODING)</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {/* download template */}
            <a href="/api/mcq_template.xlsx" download
              style={{ padding:'7px 14px', border:'1.5px solid #c4b5fd', borderRadius:8,
                background:'#f5f3ff', color:'#4f46e5', fontSize:12.5, fontWeight:700, textDecoration:'none' }}>
              ⬇️ Download Template
            </a>
            {/* upload excel */}
            <button onClick={()=>fileRef.current?.click()} disabled={saving}
              style={{ padding:'7px 14px', border:'1.5px solid #e2e8f0', borderRadius:8,
                background:'#f8fafc', color:'#475569', fontSize:12.5, fontWeight:700,
                cursor:'pointer', fontFamily:'inherit' }}>
              📤 Upload Excel
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }}
              onChange={handleExcelUpload}/>
            {/* add question */}
            <Btn variant="success" onClick={()=>{ setQForm(blankQ()); setModal('add'); }}>
              ➕ Add Question
            </Btn>
          </div>
        </div>

        {/* questions table */}
        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}><Spinner/></div>
        ) : !questions.length ? (
          <div style={{ textAlign:'center', padding:40, color:'#94a3b8', fontSize:13 }}>No questions found</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ borderCollapse:'collapse', width:'100%', minWidth:700 }}>
              <thead><tr>
                {['ID','Level','Type','Question','Options / Inputs','Actions'].map(h=>(
                  <th key={h} style={thS}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {questions.map(q => (
                  <tr key={q.id} style={{ borderBottom:'1px solid #f5f3ff' }}>
                    <td style={{ ...tdS, color:'#94a3b8', fontSize:12 }}>#{q.id}</td>
                    <td style={tdS}><span style={{ background:'#ede9fe', color:'#4f46e5', padding:'2px 8px', borderRadius:6, fontSize:11.5, fontWeight:600 }}>{q.level_name||'—'}</span></td>
                    <td style={tdS}><span style={{ background: q.question_type==='CODING'?'#dbeafe':'#dcfce7', color:q.question_type==='CODING'?'#1d4ed8':'#15803d', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:700 }}>{q.question_type||'MCQ'}</span></td>
                    <td style={{ ...tdS, maxWidth:220 }}>{q.question_text}</td>
                    <td style={{ ...tdS, maxWidth:220 }}>
                      {q.question_type === 'CODING' ? (
                        <div style={{ fontSize:12 }}>
                          <div style={{ fontWeight:700, color:'#1d4ed8', marginBottom:4 }}>Inputs:</div>
                          {q.options.map((o,i)=><div key={i} style={{ color:'#475569' }}>• {o}</div>)}
                          <div style={{ fontWeight:700, color:'#7c3aed', margin:'8px 0 4px' }}>Expected:</div>
                          {q.outputs.map((o,i)=><div key={i} style={{ color:'#475569' }}>→ {o}</div>)}
                        </div>
                      ) : (
                        <div style={{ fontSize:12 }}>
                          {q.options.map((o,i)=>(
                            <div key={i} style={{ color: i===+q.correct_answer_index?'#16a34a':'#475569',
                              fontWeight: i===+q.correct_answer_index?700:400 }}>
                              {i===+q.correct_answer_index?'✓ ':'• '}{o}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={tdS}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>openEditQ(q)}
                          style={{ background:'none',border:'none',cursor:'pointer',fontSize:15,color:'#f59e0b' }}>✏️</button>
                        <button onClick={()=>{setDelQ(q);setModal('delete');}}
                          style={{ background:'none',border:'none',cursor:'pointer',fontSize:15,color:'#ef4444' }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Question Modal */}
      {modal==='add'&&(
        <Modal title="➕ Add Question" onClose={()=>setModal(null)} wide>
          <QuestionForm levels={levels} form={qForm} onChange={setQForm}
            onSave={doAddQ} onClose={()=>setModal(null)} saving={saving} isEdit={false}/>
        </Modal>
      )}
      {/* Edit Question Modal */}
      {modal==='edit'&&editQ&&(
        <Modal title="✏️ Edit Question" onClose={()=>{setModal(null);setEditQ(null);}} wide>
          <QuestionForm levels={levels} form={qForm} onChange={setQForm}
            onSave={doEditQ} onClose={()=>{setModal(null);setEditQ(null);}} saving={saving} isEdit={true}/>
        </Modal>
      )}
      {/* Delete Question */}
      {modal==='delete'&&delQ&&(
        <Confirm title="Delete Question?" text={<>Delete question <strong>#{delQ.id}</strong>?</>}
          detail="Options and outputs will also be removed."
          onClose={()=>setModal(null)} onConfirm={doDeleteQ} loading={saving}/>
      )}
    </PageShell>
  );
}