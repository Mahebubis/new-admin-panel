import { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/faqs/faqs.php';
const FH  = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk  = obj => new URLSearchParams(obj);

const inp = {
  width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8,
  fontSize:12.5, fontFamily:'inherit', color:'#1e293b', outline:'none', boxSizing:'border-box',
};
const thS = {
  color:'#fff', fontSize:11, fontWeight:600, padding:'11px 12px',
  textAlign:'left', textTransform:'uppercase', letterSpacing:'.3px',
  borderRight:'1px solid rgba(255,255,255,.15)', whiteSpace:'nowrap',
};
const tdS  = { padding:'9px 12px', borderBottom:'1px solid #f5f3ff', color:'#334155', fontSize:12, verticalAlign:'top' };
const btnP = { padding:'9px 20px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
  color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' };

function Modal({ title, onClose, children, maxWidth = 640 }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth,
        maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ padding:'14px 20px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
          borderRadius:'14px 14px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:14, fontWeight:700, color:'#fff' }}>{title}</span>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none',
            borderRadius:6, width:28, height:28, cursor:'pointer', color:'#fff', fontSize:18, lineHeight:1 }}>x</button>
        </div>
        <div style={{ padding:22 }}>{children}</div>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'#64748b',
    textTransform:'uppercase', letterSpacing:'.4px', marginBottom:5 }}>{children}</label>;
}

function QuillEditor({ editorId, initialContent, onReady }) {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const init = () => {
      if (!window.Quill) return;
      const el = document.getElementById(editorId);
      if (!el) return;
      el.innerHTML = '';

      const q = new window.Quill('#' + editorId, {
        theme: 'snow',
        placeholder: 'Type your answer here... (Paste images with Ctrl+V)',
        modules: {
          toolbar: [
            [{ header: [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            [{ color: [] }, { background: [] }],
            ['link', 'image'],
            ['clean'],
          ],
        },
      });

      if (initialContent) q.root.innerHTML = initialContent;

      q.root.addEventListener('paste', (e) => {
        if (!e.clipboardData?.items) return;
        for (const item of e.clipboardData.items) {
          if (item.type.indexOf('image') !== -1) {
            e.preventDefault();
            const blob = item.getAsFile();
            const reader = new FileReader();
            const range = q.getSelection(true);
            q.insertText(range.index, 'Loading image...');
            reader.onload = (ev) => {
              q.deleteText(range.index, 16);
              q.insertEmbed(range.index, 'image', ev.target.result);
              q.setSelection(range.index + 1);
              toast.success('Image pasted!');
            };
            reader.onerror = () => { q.deleteText(range.index, 16); toast.error('Paste failed'); };
            reader.readAsDataURL(blob);
            break;
          }
        }
      });

      onReady(q);
    };

    if (window.Quill) { setTimeout(init, 50); return; }
    if (!document.getElementById('quill-css')) {
      const link = document.createElement('link');
      link.id = 'quill-css'; link.rel = 'stylesheet';
      link.href = 'https://cdn.quilljs.com/1.3.6/quill.snow.css';
      document.head.appendChild(link);
    }
    const s = document.createElement('script');
    s.src = 'https://cdn.quilljs.com/1.3.6/quill.js';
    s.onload = () => setTimeout(init, 50);
    document.head.appendChild(s);
  }, []);

  return (
    <div style={{ border:'1.5px solid #e2e8f0', borderRadius:8, overflow:'hidden' }}>
      <div id={editorId} style={{ minHeight:240, fontFamily:'inherit', fontSize:13 }}/>
    </div>
  );
}

const BLANK_FAQ = { faq_id:'', category_id:'', question:'', answer:'', display_order:'0', is_active:1, keywords:[] };
const BLANK_CAT = { category_name:'', category_description:'', display_order:'0' };

export default function ManageFaqs() {
  const [faqs,       setFaqs]       = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState(new Set());
  const [modal,      setModal]      = useState(null);
  const [form,       setForm]       = useState(BLANK_FAQ);
  const [catForm,    setCatForm]    = useState(BLANK_CAT);
  const [kwInput,    setKwInput]    = useState('');
  const [saving,     setSaving]     = useState(false);
  const quillRef = useRef(null);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      api.post(API, mk({ action:'get_all_faqs' }), FH),
      api.post(API, mk({ action:'get_categories' }), FH),
    ]).then(([r1, r2]) => {
      if (r1.data.status === 'success') setFaqs(r1.data.data || []);
      if (r2.data.status === 'success') setCategories(r2.data.data || []);
    }).catch(() => toast.error('Failed to load'))
    .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const totalViews = faqs.reduce((s, f) => s + parseInt(f.view_count || 0), 0);

  const toggleAll = (checked) => setSelected(checked ? new Set(faqs.map(f => f.faq_id)) : new Set());
  const toggleOne = (id) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const openAdd = () => { quillRef.current = null; setForm(BLANK_FAQ); setKwInput(''); setModal('add'); };
  const openEdit = (faq) => {
    quillRef.current = null;
    setForm({ faq_id: faq.faq_id, category_id: faq.category_id, question: faq.question,
      answer: faq.answer || '', display_order: faq.display_order || '0',
      is_active: faq.is_active, keywords: faq.keywords_array || [] });
    setKwInput(''); setModal('edit');
  };

  const saveFaq = async () => {
    if (!form.category_id) { toast.error('Please select a category'); return; }
    if (!form.question.trim()) { toast.error('Question is required'); return; }
    const answerHtml = quillRef.current?.root?.innerHTML || '';
    if (!answerHtml || answerHtml.trim() === '<p><br></p>' || !answerHtml.trim()) {
      toast.error('Please enter an answer'); return;
    }
    setSaving(true);
    try {
      const isEdit = modal === 'edit';
      const payload = { action: isEdit ? 'update_faq' : 'add_faq',
        category_id: form.category_id, question: form.question, answer: answerHtml,
        display_order: form.display_order, is_active: form.is_active,
        keywords: JSON.stringify(form.keywords || []) };
      if (isEdit) payload.faq_id = form.faq_id;
      const res = await api.post(API, mk(payload), FH);
      if (res.data.status === 'success') { toast.success(res.data.message); setModal(null); fetchAll(); }
      else toast.error(res.data.message || 'Failed');
    } catch { toast.error('Server error'); } finally { setSaving(false); }
  };

  const deleteFaqs = async (ids) => {
    if (!window.confirm('Delete ' + ids.length + ' FAQ(s)?')) return;
    try {
      const res = await api.post(API, mk({ action:'delete_faqs', ids: JSON.stringify(ids) }), FH);
      if (res.data.status === 'success') { toast.success(res.data.message); setSelected(new Set()); fetchAll(); }
      else toast.error(res.data.message || 'Failed');
    } catch { toast.error('Error'); }
  };

  const toggleActive = async (faq) => {
    try { await api.post(API, mk({ action:'toggle_active', faq_id: faq.faq_id, is_active: faq.is_active == 1 ? 0 : 1 }), FH); fetchAll(); } catch {}
  };

  const saveCategory = async () => {
    if (!catForm.category_name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const res = await api.post(API, mk({ action:'add_category', ...catForm }), FH);
      if (res.data.status === 'success') { toast.success(res.data.message); setModal(null); fetchAll(); }
      else toast.error(res.data.message || 'Failed');
    } catch { toast.error('Error'); } finally { setSaving(false); }
  };

  const addKw = (e) => {
    if (e.key !== 'Enter') return; e.preventDefault();
    const kw = kwInput.trim();
    if (kw && !(form.keywords || []).includes(kw)) setForm(p => ({ ...p, keywords: [...(p.keywords||[]), kw] }));
    setKwInput('');
  };
  const removeKw = (kw) => setForm(p => ({ ...p, keywords: (p.keywords||[]).filter(k => k !== kw) }));
  const stripHtml = (html) => { const d = document.createElement('div'); d.innerHTML = html; return (d.textContent || d.innerText || '').trim(); };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .fq-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .fq-tr:hover td{background:#faf9ff!important;}
        .ql-toolbar{border-radius:8px 8px 0 0!important;background:#f8fafc!important;border:none!important;border-bottom:1px solid #e2e8f0!important;}
        .ql-container{border-radius:0 0 8px 8px!important;border:none!important;font-size:13px!important;}
        .ql-editor.ql-blank::before{font-style:normal!important;color:#94a3b8!important;}
        @keyframes fq_spin{to{transform:rotate(360deg)}}
      `}</style>
      <div className="fq-root" style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 62px)',
        padding:20, gap:12, overflow:'hidden', background:'#f5f3ff' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ fontSize:17, fontWeight:800, color:'#1e293b' }}>FAQ Management</div>
          <div style={{ display:'flex', gap:10 }}>
            {selected.size > 0 && (
              <button style={{ ...btnP, background:'linear-gradient(135deg,#dc2626,#b91c1c)' }}
                onClick={() => deleteFaqs([...selected])}>Delete ({selected.size})</button>
            )}
            <button style={{ ...btnP, background:'linear-gradient(135deg,#16a34a,#15803d)' }}
              onClick={() => { setCatForm(BLANK_CAT); setModal('category'); }}>+ Category</button>
            <button style={btnP} onClick={openAdd}>+ Add FAQ</button>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, flexShrink:0 }}>
          {[
            { label:'Total FAQs',  val: faqs.length,                 bg:'#ede9fe', color:'#4f46e5' },
            { label:'Categories',  val: categories.length,           bg:'#dbeafe', color:'#1d4ed8' },
            { label:'Total Views', val: totalViews.toLocaleString(), bg:'#dcfce7', color:'#16a34a' },
          ].map(s => (
            <div key={s.label} style={{ background:s.bg, borderRadius:10, padding:'12px 16px', border:'1.5px solid ' + s.color + '22' }}>
              <div style={{ fontSize:24, fontWeight:800, color:s.color }}>{s.val}</div>
              <div style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ flex:1, minHeight:0, background:'#fff', borderRadius:12, border:'1.5px solid #ede9fe',
          boxShadow:'0 1px 8px rgba(79,70,229,.05)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead style={{ position:'sticky', top:0, zIndex:2 }}>
                <tr style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  <th style={{ ...thS, width:44, textAlign:'center' }}>
                    <input type="checkbox" onChange={e => toggleAll(e.target.checked)} style={{ accentColor:'#fff', width:14, height:14 }}/>
                  </th>
                  {['#','Category','Question & Answer','Keywords','Stats','Status','Actions'].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign:'center', padding:48 }}>
                    <div style={{ display:'inline-block', width:28, height:28, border:'3px solid #ede9fe', borderTop:'3px solid #4f46e5', borderRadius:'50%', animation:'fq_spin .7s linear infinite' }}/>
                  </td></tr>
                ) : faqs.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign:'center', color:'#94a3b8', padding:48, fontSize:13 }}>No FAQs found. Click + Add FAQ to create one.</td></tr>
                ) : faqs.map((faq, i) => (
                  <tr key={faq.faq_id} className="fq-tr">
                    <td style={{ ...tdS, textAlign:'center' }}>
                      <input type="checkbox" checked={selected.has(faq.faq_id)} onChange={() => toggleOne(faq.faq_id)} style={{ accentColor:'#4f46e5', width:14, height:14 }}/>
                    </td>
                    <td style={tdS}>
                      <span style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', padding:'3px 10px', borderRadius:8, fontSize:11, fontWeight:700 }}>{faqs.length - i}</span>
                    </td>
                    <td style={tdS}>
                      <span style={{ background:'rgba(79,70,229,.1)', color:'#4f46e5', padding:'3px 9px', borderRadius:6, fontSize:11, fontWeight:600 }}>
                        {faq.category_name}
                      </span>
                    </td>
                    <td style={{ ...tdS, minWidth:260 }}>
                      <div style={{ fontWeight:600, color:'#1e293b', marginBottom:3, fontSize:12.5 }}>{faq.question}</div>
                      <div style={{ fontSize:11, color:'#64748b', lineHeight:1.4 }}>
                        {stripHtml(faq.answer || '').slice(0, 100)}{stripHtml(faq.answer||'').length > 100 ? '...' : ''}
                      </div>
                    </td>
                    <td style={{ ...tdS, minWidth:140 }}>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        {(faq.keywords_array || []).length > 0
                          ? faq.keywords_array.map(kw => (
                              <span key={kw} style={{ background:'rgba(79,70,229,.08)', color:'#4f46e5', padding:'2px 7px', borderRadius:5, fontSize:10.5, fontWeight:600 }}>{kw}</span>
                            ))
                          : <span style={{ color:'#94a3b8', fontSize:11 }}>-</span>}
                      </div>
                    </td>
                    <td style={{ ...tdS, fontSize:11, color:'#64748b', whiteSpace:'nowrap' }}>
                      <div>{faq.view_count || 0} views</div>
                      <div style={{ marginTop:2 }}>{faq.helpful_count || 0} helpful</div>
                    </td>
                    <td style={tdS}>
                      <div onClick={() => toggleActive(faq)}
                        style={{ width:44, height:24, borderRadius:99, cursor:'pointer', position:'relative',
                          transition:'background .2s', background: faq.is_active == 1 ? '#4f46e5' : '#e2e8f0' }}>
                        <div style={{ position:'absolute', top:3, width:18, height:18, borderRadius:'50%',
                          background:'#fff', transition:'left .2s', left: faq.is_active == 1 ? 22 : 4 }}/>
                      </div>
                    </td>
                    <td style={{ ...tdS, whiteSpace:'nowrap' }}>
                      <button onClick={() => openEdit(faq)}
                        style={{ padding:'5px 11px', background:'#fef9c3', color:'#b45309', border:'1.5px solid #fde68a', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', marginRight:5 }}>Edit</button>
                      <button onClick={() => deleteFaqs([faq.faq_id])}
                        style={{ padding:'5px 11px', background:'#fee2e2', color:'#dc2626', border:'1.5px solid #fecaca', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <Modal title={modal === 'edit' ? 'Edit FAQ' : 'Add New FAQ'} onClose={() => setModal(null)} maxWidth={700}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <Label>Category *</Label>
              <select style={{ ...inp, cursor:'pointer' }} value={form.category_id}
                onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}>
                <option value="">Select Category</option>
                {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
              </select>
            </div>
            <div>
              <Label>Question *</Label>
              <textarea style={{ ...inp, resize:'vertical', minHeight:72 }} value={form.question}
                onChange={e => setForm(p => ({ ...p, question: e.target.value }))}/>
            </div>
            <div>
              <Label>Answer * (Paste images with Ctrl+V)</Label>
              <QuillEditor key={modal + '-' + form.faq_id} editorId="fq-quill-editor"
                initialContent={modal === 'edit' ? form.answer : ''} onReady={q => { quillRef.current = q; }}/>
            </div>
            <div>
              <Label>Keywords (Press Enter to add)</Label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, padding:'8px 10px',
                border:'1.5px solid #e2e8f0', borderRadius:8, minHeight:44, cursor:'text' }}
                onClick={() => document.getElementById('fq-kw-inp')?.focus()}>
                {(form.keywords || []).map(kw => (
                  <span key={kw} style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff',
                    padding:'3px 10px', borderRadius:7, fontSize:11, fontWeight:600, display:'flex', alignItems:'center', gap:5 }}>
                    {kw}
                    <span style={{ cursor:'pointer', fontSize:15 }} onClick={() => removeKw(kw)}>x</span>
                  </span>
                ))}
                <input id="fq-kw-inp" value={kwInput} onChange={e => setKwInput(e.target.value)}
                  onKeyDown={addKw} placeholder="Type and press Enter..."
                  style={{ border:'none', outline:'none', fontSize:12.5, flex:1, minWidth:120, fontFamily:'inherit' }}/>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <Label>Display Order</Label>
                <input style={inp} type="number" value={form.display_order}
                  onChange={e => setForm(p => ({ ...p, display_order: e.target.value }))}/>
              </div>
              <div>
                <Label>Status</Label>
                <label style={{ display:'flex', alignItems:'center', gap:10, marginTop:8, cursor:'pointer' }}>
                  <div onClick={() => setForm(p => ({ ...p, is_active: p.is_active ? 0 : 1 }))}
                    style={{ width:44, height:24, borderRadius:99, cursor:'pointer', position:'relative',
                      transition:'background .2s', background: form.is_active ? '#4f46e5' : '#e2e8f0' }}>
                    <div style={{ position:'absolute', top:3, width:18, height:18, borderRadius:'50%',
                      background:'#fff', transition:'left .2s', left: form.is_active ? 22 : 4 }}/>
                  </div>
                  <span style={{ fontSize:12.5, color:'#334155', fontWeight:600 }}>{form.is_active ? 'Active' : 'Inactive'}</span>
                </label>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:18, borderTop:'1.5px solid #f1f5f9', paddingTop:14 }}>
            <button onClick={() => setModal(null)}
              style={{ padding:'9px 18px', border:'1.5px solid #e2e8f0', background:'#f8fafc', color:'#475569', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>Cancel</button>
            <button style={btnP} onClick={saveFaq} disabled={saving}>{saving ? 'Saving...' : modal === 'edit' ? 'Update FAQ' : 'Save FAQ'}</button>
          </div>
        </Modal>
      )}

      {modal === 'category' && (
        <Modal title="Add New Category" onClose={() => setModal(null)} maxWidth={500}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div><Label>Category Name *</Label>
              <input style={inp} value={catForm.category_name} onChange={e => setCatForm(p => ({ ...p, category_name: e.target.value }))} placeholder="e.g. General Questions"/>
            </div>
            <div><Label>Description</Label>
              <textarea style={{ ...inp, resize:'vertical', minHeight:72 }} value={catForm.category_description}
                onChange={e => setCatForm(p => ({ ...p, category_description: e.target.value }))}/>
            </div>
            <div><Label>Display Order</Label>
              <input style={inp} type="number" value={catForm.display_order} onChange={e => setCatForm(p => ({ ...p, display_order: e.target.value }))}/>
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:18, borderTop:'1.5px solid #f1f5f9', paddingTop:14 }}>
            <button onClick={() => setModal(null)}
              style={{ padding:'9px 18px', border:'1.5px solid #e2e8f0', background:'#f8fafc', color:'#475569', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>Cancel</button>
            <button style={{ ...btnP, background:'linear-gradient(135deg,#16a34a,#15803d)' }}
              onClick={saveCategory} disabled={saving}>{saving ? 'Saving...' : 'Save Category'}</button>
          </div>
        </Modal>
      )}
    </>
  );
}