import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const BLOG_API  = 'https://dashboard.internshipstudio.com/api/post_blogs.php';
const TINYMCE_KEY = '7hiyhzodceu5a2ryvye4726d6r51qdwkt67osjnafjqs9vrf';

const CATEGORIES = [
  'Latest Articles', 'Internship Tips', 'Resume Writing Tips',
  'Job Search Tips', 'Interview Guide', 'Career Advice', 'Hiring Tips',
];

/* ─── shared input style ─── */
const inp = {
  width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8,
  fontSize:13, fontFamily:'inherit', color:'#1e293b', outline:'none', boxSizing:'border-box',
  transition:'border-color .15s',
};

function Label({ children }) {
  return (
    <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'#64748b',
      textTransform:'uppercase', letterSpacing:'.4px', marginBottom:5 }}>
      {children}
    </label>
  );
}

export default function AddBlog() {
  const navigate    = useNavigate();
  const editorRef   = useRef(null);
  const [editorReady, setEditorReady] = useState(false);
  const [saving,    setSaving]  = useState(false);
  const [focused,   setFocused] = useState('');
  const [form, setForm] = useState({
    title: '', category: '', status: 'published', image: null,
  });

  /* ── load TinyMCE from CDN ── */
  useEffect(() => {
    if (window.tinymce?.get?.('tinymce-editor')) {
      window.tinymce.get('tinymce-editor').remove();
    }
    if (window.tinymce) { setTimeout(initEditor, 50); return; }
    const script = document.createElement('script');
    script.src = `https://cdn.tiny.cloud/1/${TINYMCE_KEY}/tinymce/7/tinymce.min.js`;
    script.referrerPolicy = 'origin';
    script.onload = () => setTimeout(initEditor, 50);
    document.head.appendChild(script);
    return () => { window.tinymce?.get?.('tinymce-editor')?.remove?.(); };
  }, []);

  const initEditor = () => {
    if (!window.tinymce) return;
    window.tinymce.init({
      selector: '#tinymce-editor',
      plugins: 'lists advlist link image table code emoticons fullscreen',
      menubar: false,
      height: '100%',
      branding: false,
      resize: false,
      toolbar:
        'undo redo | formatselect fontsizeselect fontselect | ' +
        'bold italic underline | forecolor backcolor | ' +
        'alignleft aligncenter alignright alignjustify | ' +
        'bullist numlist outdent indent | link image table | code emoticons fullscreen',
      style_formats: [
        { title:'Paragraph', format:'p' },
        { title:'Heading 1', format:'h1' }, { title:'Heading 2', format:'h2' },
        { title:'Heading 3', format:'h3' }, { title:'Heading 4', format:'h4' },
      ],
      fontsize_formats: '8pt 10pt 12pt 14pt 16pt 18pt 24pt 36pt 48pt 60pt 72pt',
      font_formats:
        'Arial=arial,helvetica,sans-serif;' +
        'Courier New=courier new,courier,monospace;' +
        'Georgia=georgia,palatino,serif;' +
        'Tahoma=tahoma,arial,helvetica,sans-serif;' +
        'Times New Roman=times new roman,times,serif;' +
        'Verdana=verdana,geneva,sans-serif;' +
        'Roboto=roboto,sans-serif',
      setup: (editor) => {
        editorRef.current = editor;
        editor.on('init', () => setEditorReady(true));
      },
    });
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.category)     { toast.error('Please select a category'); return; }

    /* ── get TinyMCE content ── */
    const content = editorRef.current?.getContent() || '';
    if (!content.trim()) { toast.error('Content is required'); return; }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('action',   'add');
      fd.append('title',    form.title);
      fd.append('category', form.category);
      fd.append('content',  content);
      fd.append('status',   form.status);
      if (form.image) fd.append('image', form.image);

      const res = await fetch(BLOG_API, { method:'POST', body: fd });
      const data = await res.json();

      if (data.status === 'success') {
        toast.success('✅ Blog posted successfully!');
        /* reset form */
        setForm({ title:'', category:'', status:'published', image:null });
        editorRef.current?.setContent('');
        setTimeout(() => navigate('/blogs'), 500);
      } else {
        toast.error(data.message || 'Error posting blog');
      }
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  const getInp = (k) => ({
    ...inp,
    ...(focused === k ? { borderColor:'#4f46e5', boxShadow:'0 0 0 3px rgba(79,70,229,.08)' } : {}),
    onFocus: () => setFocused(k),
    onBlur:  () => setFocused(''),
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .ab-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        /* override TinyMCE iframe height to fill parent */
        .tox-tinymce{height:100%!important;border-radius:8px!important;border:1.5px solid #e2e8f0!important;}
        .tox-tinymce:focus-within{border-color:#4f46e5!important;box-shadow:0 0 0 3px rgba(79,70,229,.08)!important;}
      `}</style>

      <div className="ab-root" style={{
        display:'flex', flexDirection:'column',
        height:'calc(100vh - 62px)',
        padding:20, gap:14, overflow:'hidden',
        background:'#f5f3ff',
      }}>

        {/* ── header ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={() => navigate('/blogs')}
              style={{ width:34, height:34, borderRadius:8, background:'#fff',
                border:'1.5px solid #e2e8f0', cursor:'pointer', display:'flex',
                alignItems:'center', justifyContent:'center', color:'#64748b', fontSize:14 }}>
              ←
            </button>
            <div style={{ fontSize:17, fontWeight:800, color:'#1e293b' }}>Add New Blog Post</div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => navigate('/blogs')}
              style={{ padding:'9px 20px', border:'1.5px solid #e2e8f0', background:'#fff',
                color:'#475569', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving}
              style={{ padding:'9px 24px', border:'none', borderRadius:8, fontSize:12.5,
                fontWeight:700, cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? .7 : 1, color:'#fff',
                background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
                boxShadow:'0 4px 14px rgba(79,70,229,.3)' }}>
              {saving ? 'Saving...' : '💾 Save Post'}
            </button>
          </div>
        </div>

        {/* ── main layout: left fields + right editor ── */}
        <div style={{ flex:1, minHeight:0, display:'grid', gridTemplateColumns:'320px 1fr', gap:14 }}>

          {/* ── LEFT: meta fields ── */}
          <div style={{ background:'#fff', borderRadius:12, border:'1.5px solid #ede9fe',
            boxShadow:'0 1px 8px rgba(79,70,229,.05)', padding:20,
            display:'flex', flexDirection:'column', gap:14, overflowY:'auto' }}>

            <div>
              <Label>Title *</Label>
              <input style={getInp('title')} value={form.title}
                onChange={e => set('title', e.target.value)} placeholder="Blog post title"/>
            </div>

            <div>
              <Label>Category *</Label>
              <select style={{ ...getInp('category'), cursor:'pointer' }}
                value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="">Select Category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <Label>Featured Image</Label>
              <input type="file" accept="image/*"
                style={{ ...inp, padding:'7px 10px', cursor:'pointer', fontSize:12 }}
                onChange={e => set('image', e.target.files[0])}/>
              {form.image && (
                <div style={{ marginTop:8, fontSize:11.5, color:'#16a34a', fontWeight:600 }}>
                  ✓ {form.image.name}
                </div>
              )}
            </div>

            <div>
              <Label>Status</Label>
              <select style={{ ...getInp('status'), cursor:'pointer' }}
                value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>

            {/* status preview pill */}
            <div style={{ padding:'10px 14px', borderRadius:9, border:'1.5px solid #ede9fe',
              background:'#f5f3ff', marginTop:'auto' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase',
                letterSpacing:'.4px', marginBottom:8 }}>Preview</div>
              <div style={{ fontSize:13, fontWeight:700, color:'#1e293b', marginBottom:4,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {form.title || 'Untitled Post'}
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {form.category && (
                  <span style={{ padding:'2px 9px', borderRadius:99, fontSize:10.5, fontWeight:700,
                    background:'#dbeafe', color:'#1d4ed8' }}>{form.category}</span>
                )}
                <span style={{ padding:'2px 9px', borderRadius:99, fontSize:10.5, fontWeight:700,
                  background: form.status === 'published' ? '#dcfce7' : '#fef9c3',
                  color:      form.status === 'published' ? '#16a34a' : '#b45309' }}>
                  {form.status === 'published' ? 'Published' : 'Draft'}
                </span>
              </div>
            </div>
          </div>

          {/* ── RIGHT: TinyMCE editor ── */}
          <div style={{ background:'#fff', borderRadius:12, border:'1.5px solid #ede9fe',
            boxShadow:'0 1px 8px rgba(79,70,229,.05)', padding:16,
            display:'flex', flexDirection:'column', minHeight:0 }}>
            <Label>Content *</Label>
            {!editorReady && (
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
                color:'#94a3b8', fontSize:13, gap:8 }}>
                <div style={{ width:20, height:20, border:'2px solid #ede9fe',
                  borderTop:'2px solid #4f46e5', borderRadius:'50%',
                  animation:'ab_spin .7s linear infinite' }}/>
                <style>{`@keyframes ab_spin{to{transform:rotate(360deg)}}`}</style>
                Loading editor...
              </div>
            )}
            <div style={{ flex:1, minHeight:0, display: editorReady ? 'block' : 'none' }}>
              <textarea id="tinymce-editor" style={{ visibility:'hidden', height:0 }}/>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}