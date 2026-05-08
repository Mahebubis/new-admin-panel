import { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API      = '/api/examinations/exam_panel_for_admin.php';
const url  = (action) => `${API}?action=${action}`; // pass action in URL — reliable with FormData
const IMG_BASE = 'https://cit.internshipstudio.com/assets/exam/';
const TYPES    = ['Logical Reasoning','Quantitative Aptitude','Data Interpretation'];

/* ─── helpers ─── */
const typeBg = (t) => t==='Logical Reasoning' ? '#06b6d4' : t==='Quantitative Aptitude' ? '#8b5cf6' : '#f59e0b';
const emptyOpt = () => ({ text:'', is_correct:0 });

/* ─── shared label ─── */
const Lbl = ({ children, required }) => (
  <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'#64748b',
    textTransform:'uppercase', letterSpacing:'.4px', marginBottom:5 }}>
    {required && <span style={{ color:'#dc2626', marginRight:3 }}>*</span>}{children}
  </label>
);

const inp = {
  width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8,
  fontSize:12.5, fontFamily:'inherit', color:'#1e293b', outline:'none', boxSizing:'border-box',
};
const thS = { color:'#fff', fontSize:10.5, fontWeight:700, padding:'11px 12px',
  textAlign:'left', textTransform:'uppercase', letterSpacing:'.3px', whiteSpace:'nowrap',
  borderRight:'1px solid rgba(255,255,255,.15)' };
const tdS = { padding:'10px 12px', borderBottom:'1px solid #f5f3ff', fontSize:12, verticalAlign:'top' };

/* ─── Options editor (used in all 3 forms) ─── */
function OptionsEditor({ options, onChange }) {
  const add = () => onChange([...options, emptyOpt()]);
  const del = (i) => onChange(options.filter((_,idx)=>idx!==i));
  const set = (i,k,v) => onChange(options.map((o,idx)=>idx===i?{...o,[k]:v}:o));
  return (
    <div>
      {options.map((opt,i) => (
        <div key={i} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center' }}>
          <input style={{ ...inp, flex:1 }} placeholder={`Option ${String.fromCharCode(65+i)}`}
            value={opt.text} onChange={e=>set(i,'text',e.target.value)}/>
          <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600,
            color:'#16a34a', cursor:'pointer', whiteSpace:'nowrap' }}>
            <input type="checkbox" checked={opt.is_correct==1}
              onChange={e=>set(i,'is_correct',e.target.checked?1:0)}
              style={{ accentColor:'#16a34a', width:14, height:14 }}/>
            Correct
          </label>
          {options.length > 2 && (
            <button onClick={()=>del(i)} style={{ padding:'4px 9px', background:'#fee2e2',
              color:'#dc2626', border:'1.5px solid #fecaca', borderRadius:6, cursor:'pointer',
              fontSize:12, fontWeight:700 }}>×</button>
          )}
        </div>
      ))}
      <button onClick={add} style={{ width:'100%', padding:'8px', background:'#dcfce7',
        color:'#16a34a', border:'1.5px solid #bbf7d0', borderRadius:8, cursor:'pointer',
        fontSize:12, fontWeight:700, marginTop:4 }}>+ Add Option</button>
    </div>
  );
}

/* ─── Modal wrapper ─── */
function Modal({ title, wide, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16, overflowY:'auto' }}>
      <div style={{ background:'#fff', borderRadius:16, width:'100%',
        maxWidth: wide ? 860 : 640,
        maxHeight:'92vh', overflowY:'auto',
        boxShadow:'0 20px 60px rgba(0,0,0,.3)', flexShrink:0 }}>
        <div style={{ padding:'14px 20px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
          borderRadius:'16px 16px 0 0', display:'flex', justifyContent:'space-between',
          alignItems:'center', position:'sticky', top:0, zIndex:5 }}>
          <span style={{ fontSize:14, fontWeight:800, color:'#fff' }}>{title}</span>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none',
            borderRadius:6, width:28, height:28, cursor:'pointer', color:'#fff', fontSize:18 }}>×</button>
        </div>
        <div style={{ padding:22 }}>{children}</div>
      </div>
    </div>
  );
}

/* ─── Image modal ─── */
function ImgModal({ src, onClose }) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:2000,
      display:'flex', alignItems:'center', justifyContent:'center', cursor:'zoom-out' }}>
      <img src={src} alt="" style={{ maxWidth:'90vw', maxHeight:'90vh', borderRadius:12,
        boxShadow:'0 25px 60px rgba(0,0,0,.6)', objectFit:'contain' }}
        onClick={e=>e.stopPropagation()}/>
    </div>
  );
}

/* ═════════════════════════════════════
   SINGLE QUESTION FORM
════════════════════════════════════= */
const initForm = { exam_id:'', question_type:TYPES[0], question_text:'', options:[emptyOpt(),emptyOpt(),emptyOpt(),emptyOpt()] };

function QuestionForm({ form, onChange, exams, imgPreview, onImgChange, existingImg }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 16px' }}>
        <div>
          <Lbl required>Exam</Lbl>
          <select style={{ ...inp, cursor:'pointer' }} value={form.exam_id}
            onChange={e=>onChange('exam_id',e.target.value)}>
            <option value="">Select Exam</option>
            {exams.map(e=><option key={e.exam_id} value={e.exam_id}>{e.exam_name}</option>)}
          </select>
        </div>
        <div>
          <Lbl required>Question Type</Lbl>
          <select style={{ ...inp, cursor:'pointer' }} value={form.question_type}
            onChange={e=>onChange('question_type',e.target.value)}>
            {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div>
        <Lbl required>Question Text</Lbl>
        <textarea style={{ ...inp, minHeight:90, resize:'vertical' }} value={form.question_text}
          onChange={e=>onChange('question_text',e.target.value)} placeholder="Enter question text..."/>
      </div>
      <div>
        <Lbl>Question Image (optional)</Lbl>
        {existingImg && (
          <div style={{ marginBottom:8 }}>
            <img src={`${IMG_BASE}${existingImg}`} alt=""
              style={{ maxWidth:120, borderRadius:8, border:'2px solid #e2e8f0' }}/>
            <div style={{ fontSize:11, color:'#64748b', marginTop:4 }}>Upload new to replace</div>
          </div>
        )}
        <input type="file" accept="image/*" onChange={onImgChange}
          style={{ ...inp, padding:'7px 10px', cursor:'pointer', fontSize:12 }}/>
        {imgPreview && (
          <img src={imgPreview} alt="" style={{ marginTop:8, maxWidth:120,
            borderRadius:8, border:'2px solid #e2e8f0' }}/>
        )}
      </div>
      <div>
        <Lbl required>Options</Lbl>
        <OptionsEditor options={form.options}
          onChange={opts=>onChange('options',opts)}/>
      </div>
    </div>
  );
}

/* ════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════= */
export default function QuestionBank() {
  const [questions,   setQuestions]   = useState([]);
  const [exams,       setExams]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(new Set());
  const [imgView,     setImgView]     = useState(null);
  const [deleting,    setDeleting]    = useState(false);

  // Add modal
  const [addOpen,     setAddOpen]     = useState(false);
  const [addForm,     setAddForm]     = useState(initForm);
  const [addImg,      setAddImg]      = useState(null);
  const [addImgPrev,  setAddImgPrev]  = useState(null);
  const [addSaving,   setAddSaving]   = useState(false);

  // Edit modal
  const [editOpen,    setEditOpen]    = useState(false);
  const [editForm,    setEditForm]    = useState(initForm);
  const [editImg,     setEditImg]     = useState(null);
  const [editImgPrev, setEditImgPrev] = useState(null);
  const [editSaving,  setEditSaving]  = useState(false);

  // Bulk modal
  const [bulkOpen,    setBulkOpen]    = useState(false);
  const [bulkItems,   setBulkItems]   = useState([]);
  const [bulkImgs,    setBulkImgs]    = useState({});
  const [bulkSaving,  setBulkSaving]  = useState(false);

  /* ── fetch ── */
  const fetchAll = () => {
    setLoading(true);
    const fd = new FormData(); fd.append('action','get_all_questions');
    api.post(url('get_all_questions'), fd).then(r=>{if(r.data.status==='success')setQuestions(r.data.data||[])})
      .catch(()=>toast.error('Failed to load questions'))
      .finally(()=>setLoading(false));
  };

  useEffect(()=>{
    const fd = new FormData(); fd.append('action','get_exams');
    api.post(url('get_exams'), fd).then(r=>{if(r.data.status==='success')setExams(r.data.data||[])}).catch(()=>{});
    fetchAll();
  },[]);

  /* ── selection ── */
  const toggleAll = (c) => setSelected(c ? new Set(questions.map(q=>q.question_id)) : new Set());
  const toggleOne = (id) => setSelected(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const allChecked = questions.length>0 && selected.size===questions.length;

  /* ── delete ── */
  const doDelete = async (ids) => {
    if (!window.confirm(`Delete ${ids.length} question(s) and all their options?`)) return;
    setDeleting(true);
    try {
      const fd=new FormData(); fd.append('action','delete_questions'); fd.append('ids',JSON.stringify(ids));
      const r=await api.post(url('delete_questions'),fd);
      if(r.data.status==='success'){toast.success(r.data.message);setSelected(new Set());fetchAll();}
      else toast.error(r.data.message);
    } catch{toast.error('Error');}
    finally{setDeleting(false);}
  };

  /* ── ADD ── */
  const openAdd = () => { setAddForm(initForm); setAddImg(null); setAddImgPrev(null); setAddOpen(true); };
  const handleAddImg = (e) => {
    const f=e.target.files[0]; if(!f) return; setAddImg(f);
    const reader=new FileReader(); reader.onload=ev=>setAddImgPrev(ev.target.result); reader.readAsDataURL(f);
  };
  const saveAdd = async () => {
    if(!addForm.exam_id||!addForm.question_text){toast.error('Exam and question text are required');return;}
    if(addForm.options.length<2){toast.error('Add at least 2 options');return;}
    if(!addForm.options.some(o=>o.is_correct)){toast.error('Mark at least one option as correct');return;}
    setAddSaving(true);
    try {
      const fd=new FormData();
      fd.append('action','add_question');
      fd.append('exam_id',addForm.exam_id);
      fd.append('question_text',addForm.question_text);
      fd.append('question_type',addForm.question_type);
      fd.append('options',JSON.stringify(addForm.options.filter(o=>o.text)));
      if(addImg) fd.append('question_image',addImg);
      const r=await api.post(url('add_question'),fd);
      if(r.data.status==='success'){toast.success(r.data.message);setAddOpen(false);fetchAll();}
      else toast.error(r.data.message);
    } catch{toast.error('Error');}
    finally{setAddSaving(false);}
  };

  /* ── EDIT ── */
  const openEdit = (q) => {
    setEditForm({
      question_id:q.question_id, exam_id:q.exam_id,
      question_type:q.question_type, question_text:q.question_text,
      existing_image:q.question_image||'',
      options:(q.options||[]).map(o=>({text:o.option_text,is_correct:parseInt(o.is_correct)})),
    });
    setEditImg(null); setEditImgPrev(null); setEditOpen(true);
  };
  const handleEditImg = (e) => {
    const f=e.target.files[0]; if(!f) return; setEditImg(f);
    const reader=new FileReader(); reader.onload=ev=>setEditImgPrev(ev.target.result); reader.readAsDataURL(f);
  };
  const saveEdit = async () => {
    if(!editForm.question_text){toast.error('Question text required');return;}
    if(editForm.options.length<2){toast.error('Add at least 2 options');return;}
    if(!editForm.options.some(o=>o.is_correct)){toast.error('Mark at least one option as correct');return;}
    setEditSaving(true);
    try {
      const fd=new FormData();
      fd.append('action','update_question');
      fd.append('question_id',editForm.question_id);
      fd.append('exam_id',editForm.exam_id);
      fd.append('question_text',editForm.question_text);
      fd.append('question_type',editForm.question_type);
      fd.append('existing_image',editForm.existing_image||'');
      fd.append('options',JSON.stringify(editForm.options.filter(o=>o.text)));
      if(editImg) fd.append('question_image',editImg);
      const r=await api.post(url('update_question'),fd);
      if(r.data.status==='success'){toast.success(r.data.message);setEditOpen(false);fetchAll();}
      else toast.error(r.data.message);
    } catch{toast.error('Error');}
    finally{setEditSaving(false);}
  };

  /* ── BULK ADD ── */
  const newBulkItem = () => ({ exam_id:'', question_type:TYPES[0], question_text:'', options:[emptyOpt(),emptyOpt(),emptyOpt(),emptyOpt()] });
  const openBulk = () => { setBulkItems([newBulkItem(),newBulkItem(),newBulkItem()]); setBulkImgs({}); setBulkOpen(true); };
  const addBulkItem = () => setBulkItems(p=>[...p,newBulkItem()]);
  const removeBulkItem = (i) => setBulkItems(p=>p.filter((_,idx)=>idx!==i));
  const setBulkField = (i,k,v) => setBulkItems(p=>p.map((it,idx)=>idx===i?{...it,[k]:v}:it));
  const handleBulkImg = (i,f) => { if(!f) return; setBulkImgs(p=>({...p,[i]:f})); };

  const saveBulk = async () => {
    let err=false;
    for(const it of bulkItems){
      if(!it.exam_id||!it.question_text||it.options.length<2||!it.options.some(o=>o.is_correct)){err=true;break;}
    }
    if(err){toast.error('Ensure all questions have exam, text, ≥2 options, and one correct answer');return;}
    if(!bulkItems.length){toast.error('Add at least one question');return;}
    setBulkSaving(true);
    try {
      const fd=new FormData();
      fd.append('action','bulk_add_questions');
      // NOTE: url() used so action is in URL param
      fd.append('items',JSON.stringify(bulkItems.map(it=>({
        exam_id:it.exam_id, question_text:it.question_text,
        question_type:it.question_type,
        options:it.options.filter(o=>o.text),
      }))));
      Object.entries(bulkImgs).forEach(([i,f])=>fd.append(`bulk_images[${i}]`,f));
      const r=await api.post(url('bulk_add_questions'),fd);
      if(r.data.status==='success'){toast.success(r.data.message);setBulkOpen(false);fetchAll();}
      else toast.error(r.data.message);
    } catch{toast.error('Error');}
    finally{setBulkSaving(false);}
  };

  /* ════════ RENDER ════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .qb-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .qb-tr:hover td{background:#faf9ff!important;}
        @keyframes qb_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="qb-root" style={{
        display:'flex', flexDirection:'column',
        height:'calc(100vh - 62px)',
        padding:20, gap:14, overflow:'hidden', background:'#f5f3ff',
      }}>

        {/* ── HEADER ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ fontSize:17, fontWeight:800, color:'#1e293b' }}>
            ❓ Question Bank
            {!loading && <span style={{ marginLeft:10, fontSize:12.5, fontWeight:600,
              color:'#4f46e5', background:'#ede9fe', padding:'2px 10px', borderRadius:99 }}>
              {questions.length} questions
            </span>}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            {selected.size > 0 && (
              <button onClick={()=>doDelete([...selected])} disabled={deleting}
                style={{ padding:'8px 16px', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700,
                  cursor:'pointer', color:'#fff', background:'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                🗑 Delete Selected ({selected.size})
              </button>
            )}
            <button onClick={openBulk}
              style={{ padding:'8px 16px', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700,
                cursor:'pointer', color:'#fff', background:'linear-gradient(135deg,#16a34a,#15803d)' }}>
              ➕ Add Multiple
            </button>
            <button onClick={openAdd}
              style={{ padding:'8px 20px', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700,
                cursor:'pointer', color:'#fff', background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
              ➕ Add Question
            </button>
          </div>
        </div>

        {/* ── TABLE ── */}
        <div style={{ flex:1, minHeight:0, background:'#fff', borderRadius:12,
          border:'1.5px solid #ede9fe', boxShadow:'0 1px 8px rgba(79,70,229,.05)',
          display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead style={{ position:'sticky', top:0, zIndex:2 }}>
                <tr style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  <th style={{ ...thS, width:44, textAlign:'center' }}>
                    <input type="checkbox" checked={allChecked}
                      onChange={e=>toggleAll(e.target.checked)}
                      style={{ accentColor:'#fff', width:14, height:14 }}/>
                  </th>
                  {['#','Exam','Type','Question','Options','Action'].map(h=>(
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign:'center', padding:48 }}>
                    <div style={{ display:'inline-block', width:28, height:28, border:'3px solid #ede9fe',
                      borderTop:'3px solid #4f46e5', borderRadius:'50%', animation:'qb_spin .7s linear infinite' }}/>
                  </td></tr>
                ) : questions.length===0 ? (
                  <tr><td colSpan={7} style={{ textAlign:'center', padding:48, color:'#94a3b8', fontSize:13 }}>
                    📝 No questions found. Click "Add Question" to get started.
                  </td></tr>
                ) : questions.map((q,i) => (
                  <tr key={q.question_id} className="qb-tr">
                    <td style={{ ...tdS, textAlign:'center' }}>
                      <input type="checkbox" checked={selected.has(q.question_id)}
                        onChange={()=>toggleOne(q.question_id)}
                        style={{ accentColor:'#4f46e5', width:14, height:14 }}/>
                    </td>
                    <td style={{ ...tdS, textAlign:'center' }}>
                      <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700,
                        background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff' }}>
                        {questions.length-i}
                      </span>
                    </td>
                    <td style={{ ...tdS, maxWidth:150 }}>
                      {q.exam_name
                        ? <span style={{ padding:'3px 9px', background:'#ede9fe', color:'#4f46e5',
                            borderRadius:6, fontSize:11, fontWeight:600 }}>{q.exam_name}</span>
                        : <span style={{ color:'#94a3b8', fontSize:11 }}>No exam</span>}
                    </td>
                    <td style={tdS}>
                      <span style={{ padding:'3px 10px', borderRadius:8, fontSize:10.5, fontWeight:700,
                        color:'#fff', background:typeBg(q.question_type) }}>
                        {q.question_type}
                      </span>
                    </td>
                    <td style={{ ...tdS, maxWidth:320, minWidth:200 }}>
                      <div style={{ fontSize:12.5, fontWeight:500, color:'#1e293b', lineHeight:1.5, marginBottom:6 }}>
                        {q.question_text}
                      </div>
                      {q.question_image && (
                        <img src={`${IMG_BASE}${q.question_image}`} alt=""
                          onClick={()=>setImgView(`${IMG_BASE}${q.question_image}`)}
                          style={{ maxWidth:140, maxHeight:90, borderRadius:8, border:'2px solid #e2e8f0',
                            cursor:'zoom-in', objectFit:'contain', marginTop:4 }}/>
                      )}
                    </td>
                    <td style={{ ...tdS, minWidth:280 }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                        {(q.options||[]).map((opt,oi)=>(
                          <div key={oi} style={{ display:'flex', gap:8, alignItems:'flex-start',
                            padding:'5px 9px', borderRadius:7,
                            background: opt.is_correct==1 ? 'rgba(22,163,74,.1)' : '#f8fafc',
                            border: `1.5px solid ${opt.is_correct==1 ? '#16a34a' : '#e2e8f0'}` }}>
                            <span style={{ width:20, height:20, borderRadius:'50%', flexShrink:0,
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:10, fontWeight:700,
                              background: opt.is_correct==1 ? '#16a34a' : '#e2e8f0',
                              color: opt.is_correct==1 ? '#fff' : '#64748b' }}>
                              {opt.is_correct==1 ? '✓' : String.fromCharCode(65+oi)}
                            </span>
                            <span style={{ fontSize:11.5, color:'#334155', lineHeight:1.4 }}>{opt.option_text}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td style={{ ...tdS, whiteSpace:'nowrap' }}>
                      <button onClick={()=>openEdit(q)}
                        style={{ padding:'5px 11px', background:'#ede9fe', color:'#4f46e5',
                          border:'1.5px solid #c4b5fd', borderRadius:6, fontSize:11,
                          fontWeight:600, cursor:'pointer', marginRight:5 }}>✏️ Edit</button>
                      <button onClick={()=>doDelete([q.question_id])}
                        style={{ padding:'5px 11px', background:'#fee2e2', color:'#dc2626',
                          border:'1.5px solid #fecaca', borderRadius:6, fontSize:11,
                          fontWeight:600, cursor:'pointer' }}>🗑 Del</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ══ ADD MODAL ══ */}
      {addOpen && (
        <Modal title="➕ Add New Question" onClose={()=>setAddOpen(false)}>
          <QuestionForm form={addForm} exams={exams}
            onChange={(k,v)=>setAddForm(p=>({...p,[k]:v}))}
            imgPreview={addImgPrev} onImgChange={handleAddImg}/>
          <button onClick={saveAdd} disabled={addSaving}
            style={{ width:'100%', marginTop:18, padding:'11px', border:'none', borderRadius:8,
              background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', fontSize:13,
              fontWeight:700, cursor:addSaving?'not-allowed':'pointer', opacity:addSaving?.7:1 }}>
            {addSaving?'Saving...':'💾 Save Question'}
          </button>
        </Modal>
      )}

      {/* ══ EDIT MODAL ══ */}
      {editOpen && (
        <Modal title="✏️ Edit Question" onClose={()=>setEditOpen(false)}>
          <QuestionForm form={editForm} exams={exams}
            onChange={(k,v)=>setEditForm(p=>({...p,[k]:v}))}
            imgPreview={editImgPrev} onImgChange={handleEditImg}
            existingImg={editForm.existing_image}/>
          <button onClick={saveEdit} disabled={editSaving}
            style={{ width:'100%', marginTop:18, padding:'11px', border:'none', borderRadius:8,
              background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', fontSize:13,
              fontWeight:700, cursor:editSaving?'not-allowed':'pointer', opacity:editSaving?.7:1 }}>
            {editSaving?'Updating...':'💾 Update Question'}
          </button>
        </Modal>
      )}

      {/* ══ BULK ADD MODAL ══ */}
      {bulkOpen && (
        <Modal title="➕ Add Multiple Questions" wide onClose={()=>setBulkOpen(false)}>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {bulkItems.map((item,i) => (
              <div key={i} style={{ background:'#f5f3ff', borderRadius:12, border:'1.5px solid #ede9fe', padding:18, position:'relative' }}>
                <div style={{ position:'absolute', top:-10, left:16, background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
                  color:'#fff', fontSize:11.5, fontWeight:800, padding:'3px 12px', borderRadius:99 }}>#{i+1}</div>
                {bulkItems.length > 1 && (
                  <button onClick={()=>removeBulkItem(i)}
                    style={{ position:'absolute', top:12, right:12, padding:'3px 10px',
                      background:'#fee2e2', color:'#dc2626', border:'1.5px solid #fecaca',
                      borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>× Remove</button>
                )}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 14px', marginTop:10 }}>
                  <div>
                    <Lbl required>Exam</Lbl>
                    <select style={{ ...inp, cursor:'pointer' }} value={item.exam_id}
                      onChange={e=>setBulkField(i,'exam_id',e.target.value)}>
                      <option value="">Select Exam</option>
                      {exams.map(e=><option key={e.exam_id} value={e.exam_id}>{e.exam_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <Lbl required>Type</Lbl>
                    <select style={{ ...inp, cursor:'pointer' }} value={item.question_type}
                      onChange={e=>setBulkField(i,'question_type',e.target.value)}>
                      {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginTop:10 }}>
                  <Lbl required>Question Text</Lbl>
                  <textarea style={{ ...inp, minHeight:70, resize:'vertical' }} value={item.question_text}
                    onChange={e=>setBulkField(i,'question_text',e.target.value)} placeholder="Enter question..."/>
                </div>
                <div style={{ marginTop:10 }}>
                  <Lbl>Image (optional)</Lbl>
                  <input type="file" accept="image/*"
                    onChange={e=>handleBulkImg(i,e.target.files[0])}
                    style={{ ...inp, padding:'7px 10px', cursor:'pointer', fontSize:11.5 }}/>
                </div>
                <div style={{ marginTop:10 }}>
                  <Lbl required>Options</Lbl>
                  <OptionsEditor options={item.options}
                    onChange={opts=>setBulkField(i,'options',opts)}/>
                </div>
              </div>
            ))}
            <button onClick={addBulkItem}
              style={{ padding:'10px', border:'1.5px dashed #c4b5fd', background:'#faf9ff',
                color:'#4f46e5', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700 }}>
              ➕ Add Another Question
            </button>
            <button onClick={saveBulk} disabled={bulkSaving}
              style={{ padding:'11px', border:'none', borderRadius:8, fontSize:13, fontWeight:700,
                background:'linear-gradient(135deg,#16a34a,#15803d)', color:'#fff',
                cursor:bulkSaving?'not-allowed':'pointer', opacity:bulkSaving?.7:1 }}>
              {bulkSaving?'Saving...':'💾 Save All Questions'}
            </button>
          </div>
        </Modal>
      )}

      {/* ══ IMAGE VIEWER ══ */}
      {imgView && <ImgModal src={imgView} onClose={()=>setImgView(null)}/>}
    </>
  );
}