import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Helmet } from "react-helmet-async";

const BLOG_API = 'https://dashboard.internshipstudio.com/api/post_blogs.php';
/* Self-hosted TinyMCE (served from public/tinymce). No cloud API key → no
   domain-approval lock, so the editor stays editable on production too. */
const TINYMCE_SRC = '/tinymce/tinymce.min.js';

const CATEGORIES = [
  'Latest Articles', 'Internship Tips', 'Resume Writing Tips',
  'Job Search Tips', 'Interview Guide', 'Career Advice', 'Hiring Tips',
];

const inp = {
  width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
  fontSize: 13, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box',
};

function Label({ children }) {
  return (
    <label style={{
      display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748b',
      textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5
    }}>
      {children}
    </label>
  );
}

export default function EditBlog() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editorRef = useRef(null);

  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [focused, setFocused] = useState('');
  const [form, setForm] = useState({
    title: '', category: '', status: 'published', image: null,
  });
  const [existingImage, setExistingImage] = useState('');

  /* ── step 1: fetch blog data ── */
  useEffect(() => {
    fetch(`${BLOG_API}?action=get_one&id=${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.status === 'success') {
          const post = d.post; // get_one returns { status, post: {...} }
          if (post) {
            setForm({
              title: post.title || '',
              category: post.category || '',
              status: post.status || 'published',
              image: null,
              content: post.content || '',
            });
            // API returns image_url
            setExistingImage(post.image_url || post.image || post.thumbnail || '');
          } else {
            toast.error('Blog post not found');
            navigate('/blogs');
          }
        }
      })
      .catch(() => toast.error('Failed to load blog'))
      .finally(() => setFetching(false));
  }, [id]);

  /* ── step 2: init TinyMCE AFTER blog data is ready AND textarea is in DOM ── */
  useEffect(() => {
    if (fetching) return; // don't init until data ready + textarea is mounted

    const doInit = () => {
      // Clean up any existing instance on this id
      if (window.tinymce?.get?.('tinymce-editor-edit')) {
        window.tinymce.get('tinymce-editor-edit').remove();
      }

      window.tinymce.init({
        selector: '#tinymce-editor-edit',
        license_key: 'gpl',        // self-hosted (GPL) build — no cloud key needed
        base_url: '/tinymce',      // resolve skins/plugins/themes from the vendored copy
        suffix: '.min',            // load the .min.js / .min.css assets we shipped
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
          { title: 'Paragraph', format: 'p' },
          { title: 'Heading 1', format: 'h1' },
          { title: 'Heading 2', format: 'h2' },
          { title: 'Heading 3', format: 'h3' },
          { title: 'Heading 4', format: 'h4' },
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
          editor.on('init', () => {
            // Read directly from form ref to avoid stale closure
            const textarea = document.getElementById('tinymce-editor-edit');
            const content = textarea?.dataset?.content || '';
            editor.setContent(content);
          });
        },
      });
    };

    if (window.tinymce) {
      // Script already loaded — wait one tick for textarea to render
      setTimeout(doInit, 100);
    } else {
      // Load TinyMCE script first
      const script = document.createElement('script');
      script.src = TINYMCE_SRC;
      script.referrerPolicy = 'origin';
      script.onload = () => setTimeout(doInit, 100);
      document.head.appendChild(script);
    }

    return () => {
      window.tinymce?.get?.('tinymce-editor-edit')?.remove?.();
    };
  }, [fetching]); // only re-runs when fetching changes to false

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.category) { toast.error('Please select a category'); return; }
    const content = editorRef.current?.getContent() || '';
    if (!content.trim()) { toast.error('Content is required'); return; }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('action', 'update');
      fd.append('id', id);
      fd.append('title', form.title);
      fd.append('category', form.category);
      fd.append('content', content);
      fd.append('status', form.status);
      if (form.image) fd.append('image', form.image);

      const res = await fetch(BLOG_API, { method: 'POST', body: fd });
      const data = await res.json();

      if (data.status === 'success') {
        toast.success('✅ Blog updated successfully!');
        setTimeout(() => navigate('/blogs'), 500);
      } else {
        toast.error(data.message || 'Error updating blog');
      }
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  const getInp = (k) => ({
    ...inp,
    ...(focused === k ? { borderColor: '#4f46e5', boxShadow: '0 0 0 3px rgba(79,70,229,.08)' } : {}),
    onFocus: () => setFocused(k),
    onBlur: () => setFocused(''),
  });

  if (fetching) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: 'calc(100vh - 62px)', gap: 10, color: '#94a3b8',
      fontFamily: 'Plus Jakarta Sans,sans-serif'
    }}>
      <div style={{
        width: 28, height: 28, border: '3px solid #ede9fe',
        borderTop: '3px solid #4f46e5', borderRadius: '50%',
        animation: 'eb_spin .7s linear infinite'
      }} />
      <style>{`@keyframes eb_spin{to{transform:rotate(360deg)}}`}</style>
      Loading post...
    </div>
  );

  return (
    <>
    <Helmet>
        <title>Edit Blog | Admin Panel</title>
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .eb-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .tox-tinymce{height:100%!important;border-radius:8px!important;border:1.5px solid #e2e8f0!important;}
        .tox-tinymce:focus-within{border-color:#4f46e5!important;box-shadow:0 0 0 3px rgba(79,70,229,.08)!important;}
        @keyframes eb_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="eb-root" style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100vh - 62px)',
        padding: 20, gap: 14, overflow: 'hidden',
        background: '#f5f3ff',
      }}>
        {/* ── header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('/blogs')}
              style={{
                width: 34, height: 34, borderRadius: 8, background: '#fff',
                border: '1.5px solid #e2e8f0', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 14
              }}>
              ←
            </button>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>Edit Blog Post</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8' }}>ID: {id}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigate('/blogs')}
              style={{
                padding: '9px 20px', border: '1.5px solid #e2e8f0', background: '#fff',
                color: '#475569', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer'
              }}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving}
              style={{
                padding: '9px 24px', border: 'none', borderRadius: 8, fontSize: 12.5,
                fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? .7 : 1, color: '#fff',
                background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                boxShadow: '0 4px 14px rgba(79,70,229,.3)'
              }}>
              {saving ? 'Saving...' : '💾 Update Post'}
            </button>
          </div>
        </div>

        {/* ── 2-column layout ── */}
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14 }}>

          {/* LEFT: meta fields */}
          <div style={{
            background: '#fff', borderRadius: 12, border: '1.5px solid #ede9fe',
            boxShadow: '0 1px 8px rgba(79,70,229,.05)', padding: 20,
            display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto'
          }}>

            <div>
              <Label>Title *</Label>
              <input style={getInp('title')} value={form.title}
                onChange={e => set('title', e.target.value)} placeholder="Blog post title" />
            </div>

            <div>
              <Label>Category *</Label>
              <select style={{ ...getInp('category'), cursor: 'pointer' }}
                value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="">Select Category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <Label>Change Featured Image</Label>
              <input type="file" accept="image/*"
                style={{ ...inp, padding: '7px 10px', cursor: 'pointer', fontSize: 12 }}
                onChange={e => set('image', e.target.files[0])} />
              {form.image ? (
                <div style={{ marginTop: 6, fontSize: 11.5, color: '#16a34a', fontWeight: 600 }}>
                  ✓ {form.image.name}
                </div>
              ) : existingImage ? (
                <div style={{ marginTop: 8 }}>
                  <img src={existingImage} alt="Current"
                    style={{
                      width: '100%', maxHeight: 120, objectFit: 'cover',
                      borderRadius: 8, border: '1.5px solid #e2e8f0'
                    }}
                    onError={e => { e.target.style.display = 'none'; }} />
                  <div style={{ marginTop: 4, fontSize: 10.5, color: '#94a3b8' }}>
                    Current image — upload new to replace
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>
                  Leave blank to keep existing image
                </div>
              )}
            </div>

            <div>
              <Label>Status</Label>
              <select style={{ ...getInp('status'), cursor: 'pointer' }}
                value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>

            {/* preview pill */}
            <div style={{
              padding: '10px 14px', borderRadius: 9, border: '1.5px solid #ede9fe',
              background: '#f5f3ff', marginTop: 'auto'
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#64748b',
                textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8
              }}>Preview</div>
              <div style={{
                fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 4,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {form.title || 'Untitled Post'}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {form.category && (
                  <span style={{
                    padding: '2px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
                    background: '#dbeafe', color: '#1d4ed8'
                  }}>{form.category}</span>
                )}
                <span style={{
                  padding: '2px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
                  background: form.status === 'published' ? '#dcfce7' : '#fef9c3',
                  color: form.status === 'published' ? '#16a34a' : '#b45309'
                }}>
                  {form.status === 'published' ? 'Published' : 'Draft'}
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: TinyMCE editor */}
          <div style={{
            background: '#fff', borderRadius: 12, border: '1.5px solid #ede9fe',
            boxShadow: '0 1px 8px rgba(79,70,229,.05)', padding: 16,
            display: 'flex', flexDirection: 'column', minHeight: 0
          }}>
            <Label>Content *</Label>
            {/*
              KEY FIX: textarea is always visible (not hidden).
              We store content in data-content so TinyMCE's init
              callback can read it without closure issues.
            */}
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <textarea
                id="tinymce-editor-edit"
                data-content={form.content || ''}
                defaultValue={form.content || ''}
                style={{
                  width: '100%', height: '100%', border: '1.5px solid #e2e8f0',
                  borderRadius: 8, padding: 10, fontSize: 13, fontFamily: 'inherit',
                  resize: 'none', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}