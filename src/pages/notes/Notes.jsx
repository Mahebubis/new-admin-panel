import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/notes/notes.php';

const fmt = d => new Date(d).toLocaleString('en-IN', {
  day:'2-digit', month:'short', year:'numeric',
  hour:'2-digit', minute:'2-digit', hour12:true,
});

/* ─── Role badge ─── */
const RoleBadge = ({ role }) => {
  const s = {
    'Super Admin':{ bg:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#fff' },
    'Admin':      { bg:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff' },
    'Staff':      { bg:'#f1f5f9', color:'#64748b' },
  }[role] || { bg:'#f1f5f9', color:'#64748b' };
  return (
    <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700,
      background:s.bg, color:s.color }}>
      {role}
    </span>
  );
};

/* ─── Image lightbox ─── */
function Lightbox({ url, onClose }) {
  useEffect(() => {
    const handler = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.9)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:9000,
      cursor:'zoom-out', padding:24 }}>
      <img src={url} alt="" onClick={e=>e.stopPropagation()}
        style={{ maxWidth:'90vw', maxHeight:'90vh', borderRadius:10,
          boxShadow:'0 40px 100px rgba(0,0,0,.6)', cursor:'default' }}/>
      <button onClick={onClose} style={{ position:'absolute', top:18, right:18,
        background:'rgba(255,255,255,.12)', border:'none', color:'#fff', width:38, height:38,
        borderRadius:'50%', cursor:'pointer', fontSize:20, display:'flex',
        alignItems:'center', justifyContent:'center' }}>×</button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   RICH EDITOR — full-featured toolbar
   • Font family, font size +/−
   • Text colour, background/highlight colour
   • Bold, Italic, Underline, Strikethrough
   • H1 H2 H3 Normal
   • Align L / C / R / Justify
   • Bullet list, Numbered list, Indent, Outdent
   • Link, Clear formatting, Divider
   • Paste image → base64 inline
   • Attach image → S3 upload
═══════════════════════════════════════════════════════════ */

const FONTS = [
  'Plus Jakarta Sans','Arial','Georgia','Courier New',
  'Trebuchet MS','Verdana','Times New Roman','Comic Sans MS',
];

const TEXT_COLORS = [
  '#000000','#1e293b','#dc2626','#ea580c','#d97706',
  '#16a34a','#0891b2','#4f46e5','#7c3aed','#db2777',
  '#ffffff','#94a3b8','#f87171','#fb923c','#fbbf24',
  '#4ade80','#22d3ee','#818cf8','#c084fc','#f472b6',
];

const BG_COLORS = [
  'transparent','#fef9c3','#dcfce7','#dbeafe','#f5f3ff',
  '#fee2e2','#ffedd5','#fce7f3','#ecfeff','#f0fdf4',
  '#fef3c7','#d1fae5','#bfdbfe','#ede9fe','#fecaca',
];

/* ── tiny colour swatch ── */
const Swatch = ({ color, onClick, title, active }) => (
  <div onClick={onClick} title={title}
    style={{ width:18, height:18, borderRadius:4, cursor:'pointer', flexShrink:0,
      background: color==='transparent'
        ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0/8px 8px'
        : color,
      border: active ? '2px solid #4f46e5' : '1.5px solid rgba(0,0,0,.15)',
      transition:'transform .1s',
    }}
    onMouseEnter={e=>e.target.style.transform='scale(1.25)'}
    onMouseLeave={e=>e.target.style.transform='scale(1)'}
  />
);

/* ── colour picker dropdown ── */
function ColorPicker({ label, colors, onPick, currentColor, icon }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button title={label}
        onMouseDown={e => { e.preventDefault(); setOpen(p=>!p); }}
        style={{ padding:'4px 7px', border:'1.5px solid #e2e8f0', borderRadius:7,
          background:'#fff', cursor:'pointer', display:'flex', flexDirection:'column',
          alignItems:'center', gap:2, lineHeight:1 }}>
        <span style={{ fontSize:13 }}>{icon}</span>
        <div style={{ width:16, height:3, borderRadius:2,
          background: currentColor === 'transparent' ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0/6px 6px' : currentColor,
          border:'1px solid rgba(0,0,0,.1)' }}/>
      </button>
      {open && (
        <div onMouseDown={e=>e.preventDefault()}
          style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:100,
            background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:10,
            padding:10, boxShadow:'0 8px 30px rgba(0,0,0,.15)',
            display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:4, width:120 }}>
          {colors.map(c => (
            <Swatch key={c} color={c} title={c}
              active={currentColor===c}
              onClick={()=>{ onPick(c); setOpen(false); }}/>
          ))}
          {/* native colour input for custom pick */}
          <label title="Custom colour" style={{ width:18, height:18, borderRadius:4, cursor:'pointer',
            border:'1.5px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:11, background:'#f8fafc', overflow:'hidden' }}>
            +
            <input type="color" style={{ opacity:0, position:'absolute', width:0, height:0 }}
              onChange={e=>{ onPick(e.target.value); setOpen(false); }}/>
          </label>
        </div>
      )}
    </div>
  );
}

function RichEditor({ onChange, disabled }) {
  const editorRef  = useRef(null);
  const fileRef    = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [fontSize,  setFontSize]  = useState(14);
  const [fontFamily,setFontFamily]= useState('Plus Jakarta Sans');
  const [textColor, setTextColor] = useState('#1e293b');
  const [bgColor,   setBgColor]   = useState('transparent');
  const s3Keys = useRef([]);

  useEffect(() => {
    onChange({ getHTML: ()=>editorRef.current?.innerHTML||'', getS3Keys:()=>s3Keys.current });
  }, [onChange]);

  const exec = (cmd, val=null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
  };

  /* font size: wrap selection in span */
  const applyFontSize = (sz) => {
    setFontSize(sz);
    exec('fontSize', 7); // placeholder
    /* execCommand fontSize is limited; use span wrap instead */
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) { editorRef.current.style.fontSize = sz + 'px'; return; }
    const span = document.createElement('span');
    span.style.fontSize = sz + 'px';
    try { range.surroundContents(span); } catch {}
  };

  /* text colour */
  const applyTextColor = (c) => {
    setTextColor(c);
    editorRef.current?.focus();
    exec('foreColor', c);
  };

  /* bg / highlight colour */
  const applyBgColor = (c) => {
    setBgColor(c);
    editorRef.current?.focus();
    if (c === 'transparent') exec('hiliteColor', 'transparent');
    else exec('hiliteColor', c);
  };

  /* paste image → base64 */
  const onPaste = useCallback(e => {
    const items   = Array.from(e.clipboardData?.items || []);
    const imgItem = items.find(it => it.type.startsWith('image/'));
    if (!imgItem) return;
    e.preventDefault();
    const file = imgItem.getAsFile();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      exec('insertHTML', `<img src="${ev.target.result}" style="max-width:100%;border-radius:8px;margin:6px 0;display:block;" />`);
    };
    reader.readAsDataURL(file);
  }, []);

  /* attach image → S3 */
  const onFileAttach = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('action', 'upload_image');
      fd.append('image', file);
      const r = await api.post(API, fd, { headers:{ 'Content-Type':'multipart/form-data' } });
      const { url, key, original_name, file_size, mime_type } = r.data.data;
      s3Keys.current.push({ url, key, original_name, file_size, mime_type });
      editorRef.current?.focus();
      exec('insertHTML', `<img src="${url}" style="max-width:100%;border-radius:8px;margin:6px 0;display:block;" />`);
      toast.success('Image uploaded & inserted');
    } catch(err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally { setUploading(false); }
  };

  /* toolbar divider */
  const Div = () => (
    <div style={{ width:1, height:24, background:'#e2e8f0', margin:'0 3px', flexShrink:0 }}/>
  );

  /* toolbar button */
  const TB = ({ title, onClick, children, active=false, style={} }) => (
    <button title={title} onMouseDown={e=>{e.preventDefault();onClick();}}
      style={{ padding:'4px 8px', border:`1.5px solid ${active?'#4f46e5':'#e2e8f0'}`,
        borderRadius:7, background:active?'#ede9fe':'#fff',
        color:active?'#4f46e5':'#334155', fontSize:13, fontWeight:700,
        cursor:'pointer', fontFamily:'inherit', lineHeight:1.2,
        transition:'all .12s', display:'flex', alignItems:'center', gap:4,
        flexShrink:0, ...style }}>
      {children}
    </button>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0,
      border:'1.5px solid #e2e8f0', borderRadius:14, overflow:'hidden',
      background:'#fff', boxShadow:'0 1px 6px rgba(79,70,229,.06)' }}>

      {/* ══ TOOLBAR ROW 1: font + size + colours ══ */}
      <div style={{ padding:'7px 10px', borderBottom:'1px solid #f1f5f9', background:'#fafafe',
        display:'flex', flexWrap:'wrap', gap:5, alignItems:'center', flexShrink:0 }}>

        {/* Font family */}
        <select value={fontFamily}
          onMouseDown={e=>e.stopPropagation()}
          onChange={e=>{
            setFontFamily(e.target.value);
            editorRef.current?.focus();
            exec('fontName', e.target.value);
          }}
          style={{ padding:'4px 8px', border:'1.5px solid #e2e8f0', borderRadius:7,
            fontSize:12.5, fontFamily:'inherit', color:'#334155', background:'#fff',
            cursor:'pointer', maxWidth:160, outline:'none' }}>
          {FONTS.map(f=><option key={f} value={f} style={{fontFamily:f}}>{f}</option>)}
        </select>

        <Div/>

        {/* Font size */}
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <TB title="Decrease font size" onClick={()=>applyFontSize(Math.max(8, fontSize-1))}>A−</TB>
          <div style={{ width:36, textAlign:'center', fontSize:12.5, fontWeight:700,
            color:'#334155', background:'#f8fafc', border:'1.5px solid #e2e8f0',
            borderRadius:6, padding:'4px 0' }}>{fontSize}</div>
          <TB title="Increase font size" onClick={()=>applyFontSize(Math.min(72, fontSize+1))}>A+</TB>
        </div>

        <Div/>

        {/* Text colour */}
        <ColorPicker icon="A" label="Text colour"
          colors={TEXT_COLORS} currentColor={textColor} onPick={applyTextColor}/>

        {/* Background / highlight colour */}
        <ColorPicker icon="🖍" label="Highlight colour"
          colors={BG_COLORS} currentColor={bgColor} onPick={applyBgColor}/>

        <Div/>

        {/* Quick font size presets */}
        {[12,14,16,20,24].map(sz => (
          <TB key={sz} title={`${sz}px`} active={fontSize===sz}
            onClick={()=>applyFontSize(sz)}
            style={{ fontSize:10, padding:'3px 6px' }}>
            {sz}
          </TB>
        ))}
      </div>

      {/* ══ TOOLBAR ROW 2: formatting + align + lists ══ */}
      <div style={{ padding:'6px 10px', borderBottom:'1.5px solid #f5f3ff', background:'#f8fafc',
        display:'flex', flexWrap:'wrap', gap:5, alignItems:'center', flexShrink:0 }}>

        {/* text style */}
        <TB title="Bold (Ctrl+B)"        onClick={()=>exec('bold')}><b>B</b></TB>
        <TB title="Italic (Ctrl+I)"      onClick={()=>exec('italic')}><i style={{fontStyle:'italic'}}>I</i></TB>
        <TB title="Underline (Ctrl+U)"   onClick={()=>exec('underline')}><u>U</u></TB>
        <TB title="Strikethrough"        onClick={()=>exec('strikeThrough')}><s>S</s></TB>
        <TB title="Superscript"          onClick={()=>exec('superscript')}>X²</TB>
        <TB title="Subscript"            onClick={()=>exec('subscript')}>X₂</TB>

        <Div/>

        {/* heading */}
        <TB title="Heading 1"   onClick={()=>exec('formatBlock','h1')}>H1</TB>
        <TB title="Heading 2"   onClick={()=>exec('formatBlock','h2')}>H2</TB>
        <TB title="Heading 3"   onClick={()=>exec('formatBlock','h3')}>H3</TB>
        <TB title="Normal text" onClick={()=>exec('formatBlock','p')}>¶</TB>
        <TB title="Blockquote"  onClick={()=>exec('formatBlock','blockquote')}>❝</TB>

        <Div/>

        {/* align */}
        <TB title="Align left"    onClick={()=>exec('justifyLeft')}>⬅</TB>
        <TB title="Align centre"  onClick={()=>exec('justifyCenter')}>⬛</TB>
        <TB title="Align right"   onClick={()=>exec('justifyRight')}>➡</TB>
        <TB title="Justify"       onClick={()=>exec('justifyFull')}>☰</TB>

        <Div/>

        {/* lists + indent */}
        <TB title="Bullet list"    onClick={()=>exec('insertUnorderedList')}>• —</TB>
        <TB title="Numbered list"  onClick={()=>exec('insertOrderedList')}>1 —</TB>
        <TB title="Indent"         onClick={()=>exec('indent')}>→|</TB>
        <TB title="Outdent"        onClick={()=>exec('outdent')}>|←</TB>

        <Div/>

        {/* utilities */}
        <TB title="Insert link" onClick={()=>{
          const url=prompt('Enter URL (e.g. https://example.com):');
          if(url) exec('createLink', url);
        }}>🔗</TB>
        <TB title="Divider line" onClick={()=>exec('insertHorizontalRule')}>──</TB>
        <TB title="Clear formatting" onClick={()=>exec('removeFormat')}>✕A</TB>
        <TB title="Undo (Ctrl+Z)"  onClick={()=>exec('undo')}>↩</TB>
        <TB title="Redo (Ctrl+Y)"  onClick={()=>exec('redo')}>↪</TB>

        <div style={{ flex:1 }}/>

        {/* attach image */}
        <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }}
          onChange={onFileAttach}/>
        <button disabled={uploading||disabled} onClick={()=>fileRef.current?.click()}
          onMouseDown={e=>e.preventDefault()}
          style={{ padding:'6px 14px', border:'none', borderRadius:8, fontSize:12.5,
            fontWeight:700, cursor:uploading?'not-allowed':'pointer', fontFamily:'inherit',
            background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff',
            display:'flex', alignItems:'center', gap:6, opacity:uploading?.6:1 }}>
          {uploading?'⏳ Uploading...':'🖼️ Attach Image'}
        </button>
        <span style={{ fontSize:11, color:'#94a3b8', whiteSpace:'nowrap' }}>
          Ctrl+V to paste
        </span>
      </div>

      {/* ══ EDITOR AREA ══ */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onPaste={onPaste}
        data-placeholder="Start writing your note here...&#10;&#10;• Ctrl+V to paste a screenshot directly&#10;• Use toolbar to format text, change colours, adjust font"
        style={{ flex:1, padding:'18px 22px', outline:'none', overflowY:'auto',
          fontSize:fontSize+'px', lineHeight:1.85, color:'#1e293b',
          fontFamily:fontFamily+', sans-serif', minHeight:200 }}
        onInput={()=>{
          onChange({ getHTML:()=>editorRef.current?.innerHTML||'', getS3Keys:()=>s3Keys.current });
        }}
      />

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
          white-space: pre-line;
        }
        [contenteditable] img { max-width:100%; border-radius:8px; cursor:zoom-in; }
        [contenteditable] h1  { font-size:1.8em; font-weight:800; margin:16px 0 8px; color:#1e293b; }
        [contenteditable] h2  { font-size:1.4em; font-weight:800; margin:14px 0 6px; color:#1e293b; }
        [contenteditable] h3  { font-size:1.15em; font-weight:700; margin:10px 0 4px; color:#334155; }
        [contenteditable] ul,
        [contenteditable] ol  { padding-left:22px; margin:6px 0; }
        [contenteditable] li  { margin:3px 0; }
        [contenteditable] hr  { border:none; border-top:2px solid #ede9fe; margin:14px 0; }
        [contenteditable] a   { color:#4f46e5; }
        [contenteditable] blockquote { border-left:4px solid #4f46e5; margin:10px 0; padding:8px 14px; background:#f5f3ff; border-radius:0 8px 8px 0; color:#475569; font-style:italic; }
        [contenteditable] sup { font-size:0.7em; vertical-align:super; }
        [contenteditable] sub { font-size:0.7em; vertical-align:sub; }
      `}</style>
    </div>
  );
}

/* ─── Collapsible Note Row ─── */
function NoteRow({ note, onDelete, onEdit, isSA, currentUid }) {
  const [open,    setOpen]    = useState(false);
  const [lightbox,setLightbox]= useState(null);
  const canAct = isSA || note.user_id == currentUid;
  const viewRef = useRef(null);

  /* click img in HTML → lightbox */
  useEffect(() => {
    if (!open) return;
    const el = viewRef.current;
    if (!el) return;
    const h = e => { if (e.target.tagName === 'IMG') setLightbox(e.target.src); };
    el.addEventListener('click', h);
    return () => el.removeEventListener('click', h);
  }, [open]);

  /* plain-text snippet from HTML for collapsed preview */
  const snippet = note.content.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().slice(0,80);

  return (
    <div style={{ background:'#fff', borderRadius:12, border:`1.5px solid ${open?'#c4b5fd':'#ede9fe'}`,
      overflow:'hidden', flexShrink:0, transition:'border-color .2s, box-shadow .2s',
      boxShadow: open ? '0 4px 20px rgba(79,70,229,.1)' : '0 1px 4px rgba(79,70,229,.05)' }}>

      {/* ── collapsed row ── */}
      <div onClick={()=>setOpen(p=>!p)}
        style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
          cursor:'pointer', userSelect:'none' }}>

        {/* chevron */}
        <div style={{ fontSize:12, color:'#94a3b8', flexShrink:0, width:16, textAlign:'center',
          transition:'transform .2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </div>

        {/* avatar */}
        <div style={{ width:32, height:32, borderRadius:'50%', flexShrink:0, overflow:'hidden',
          background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:13, fontWeight:800, color:'#fff' }}>
          {note.photo
            ? <img src={note.photo} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}
                onError={e=>e.target.style.display='none'}/>
            : (note.name||'?').charAt(0).toUpperCase()}
        </div>

        {/* meta: name + role + time */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, minWidth:0 }}>
          <span style={{ fontSize:13, fontWeight:700, color:'#1e293b', whiteSpace:'nowrap' }}>
            {note.name||'—'}
          </span>
          <RoleBadge role={note.user_role}/>
          <span style={{ fontSize:11, color:'#94a3b8', whiteSpace:'nowrap' }}>
            {fmt(note.created_at)}
          </span>
        </div>

        {/* title + snippet */}
        <div style={{ flex:1, minWidth:0, overflow:'hidden' }}>
          {note.title
            ? <span style={{ fontSize:13.5, fontWeight:700, color:'#334155',
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'block' }}>
                {note.title}
              </span>
            : <span style={{ fontSize:12.5, color:'#94a3b8', whiteSpace:'nowrap',
                overflow:'hidden', textOverflow:'ellipsis', display:'block',
                fontStyle: snippet ? 'normal' : 'italic' }}>
                {snippet || '(no text)'}
                {note.content.replace(/<[^>]+>/g,'').trim().length > 80 && '…'}
              </span>
          }
        </div>

        {/* attachment count badge */}
        {note.attachments?.length > 0 && (
          <span style={{ background:'#f5f3ff', color:'#4f46e5', borderRadius:99, fontSize:11,
            fontWeight:700, padding:'2px 8px', flexShrink:0 }}>
            📎 {note.attachments.length}
          </span>
        )}

        {/* actions — stop propagation so click doesn't toggle */}
        {canAct && (
          <div onClick={e=>e.stopPropagation()} style={{ display:'flex', gap:6, flexShrink:0 }}>
            <button onClick={()=>onEdit(note)}
              style={{ padding:'4px 11px', border:'1.5px solid #c4b5fd', borderRadius:7,
                background:'#f5f3ff', color:'#4f46e5', fontSize:12, fontWeight:700,
                cursor:'pointer', fontFamily:'inherit' }}>
              ✏️ Edit
            </button>
            <button onClick={()=>onDelete(note.id)}
              style={{ padding:'4px 11px', border:'1.5px solid #fecaca', borderRadius:7,
                background:'#fef2f2', color:'#dc2626', fontSize:12, fontWeight:700,
                cursor:'pointer', fontFamily:'inherit' }}>
              🗑️
            </button>
          </div>
        )}
      </div>

      {/* ── expanded content ── */}
      {open && (
        <div style={{ borderTop:'1.5px solid #f5f3ff', padding:'18px 20px 20px',
          maxHeight:'60vh', overflowY:'auto' }}>

          {/* full title if exists */}
          {note.title && (
            <div style={{ fontSize:17, fontWeight:800, color:'#1e293b', marginBottom:14 }}>
              {note.title}
            </div>
          )}

          {/* HTML content */}
          <div ref={viewRef}
            style={{ fontSize:14, lineHeight:1.85, color:'#334155', wordBreak:'break-word' }}
            dangerouslySetInnerHTML={{ __html: note.content }}/>

          {/* S3 attachments */}
          {note.attachments?.length > 0 && (
            <div style={{ marginTop:16, paddingTop:14, borderTop:'1.5px solid #f5f3ff' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8',
                textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                📎 Attached Images
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {note.attachments.map(att => (
                  <img key={att.id} src={att.file_url} alt={att.original_name}
                    onClick={()=>setLightbox(att.file_url)}
                    style={{ width:80, height:80, borderRadius:9, objectFit:'cover',
                      border:'1.5px solid #ede9fe', cursor:'zoom-in', transition:'transform .15s' }}
                    onMouseEnter={e=>e.target.style.transform='scale(1.07)'}
                    onMouseLeave={e=>e.target.style.transform='scale(1)'}/>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {lightbox && <Lightbox url={lightbox} onClose={()=>setLightbox(null)}/>}
    </div>
  );
}

/* ─── Edit Note Modal ─── */
function EditModal({ note, onClose, onSave, saving }) {
  const [title,   setTitle]   = useState(note.title || '');
  const editorApi = useRef(null);
  const editorRef = useRef(null);

  /* pre-fill editor with existing content */
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = note.content || '';
  }, [note.content]);

  const handleSave = () => {
    const html = editorRef.current?.innerHTML || '';
    onSave({ id: note.id, title: title.trim(), content: html });
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:1200, padding:16 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:900,
        height:'85vh', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 80px rgba(0,0,0,.25)' }}>

        {/* header */}
        <div style={{ padding:'14px 20px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
          borderRadius:'16px 16px 0 0', display:'flex', alignItems:'center',
          justifyContent:'space-between', flexShrink:0 }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#fff' }}>✏️ Edit Note</span>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none',
            cursor:'pointer', color:'#fff', fontSize:18, width:32, height:32, borderRadius:'50%',
            display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>

        {/* title input */}
        <div style={{ padding:'14px 20px 0', flexShrink:0 }}>
          <input value={title} onChange={e=>setTitle(e.target.value)}
            placeholder="Title (optional)..."
            style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #e2e8f0',
              borderRadius:10, fontSize:15, fontWeight:600, fontFamily:'inherit',
              color:'#1e293b', outline:'none' }}
            onFocus={e=>e.target.style.borderColor='#4f46e5'}
            onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
        </div>

        {/* simple editable area (no full toolbar for edit — keeps it fast) */}
        <div style={{ flex:1, margin:'12px 20px', border:'1.5px solid #e2e8f0',
          borderRadius:12, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'6px 12px', background:'#fafafe',
            borderBottom:'1px solid #f1f5f9', display:'flex', gap:5, flexWrap:'wrap', flexShrink:0 }}>
            {[
              ['Bold',         ()=>document.execCommand('bold')],
              ['Italic',       ()=>document.execCommand('italic')],
              ['Underline',    ()=>document.execCommand('underline')],
              ['• List',       ()=>document.execCommand('insertUnorderedList')],
              ['1. List',      ()=>document.execCommand('insertOrderedList')],
              ['Clear fmt',    ()=>document.execCommand('removeFormat')],
            ].map(([lbl, fn]) => (
              <button key={lbl} onMouseDown={e=>{e.preventDefault();editorRef.current?.focus();fn();}}
                style={{ padding:'3px 9px', border:'1.5px solid #e2e8f0', borderRadius:6,
                  background:'#fff', color:'#334155', fontSize:12, fontWeight:700,
                  cursor:'pointer', fontFamily:'inherit' }}>
                {lbl}
              </button>
            ))}
          </div>
          <div ref={editorRef} contentEditable suppressContentEditableWarning
            style={{ flex:1, padding:'16px', outline:'none', overflowY:'auto',
              fontSize:14, lineHeight:1.8, color:'#1e293b', fontFamily:'inherit' }}/>
        </div>

        {/* footer */}
        <div style={{ padding:'12px 20px', borderTop:'1.5px solid #f5f3ff',
          display:'flex', justifyContent:'flex-end', gap:10, flexShrink:0 }}>
          <button onClick={onClose}
            style={{ padding:'9px 20px', border:'1.5px solid #e2e8f0', borderRadius:9,
              background:'#fff', color:'#475569', fontSize:13, fontWeight:700,
              cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding:'9px 24px', border:'none', borderRadius:9, fontSize:13,
              fontWeight:700, cursor:saving?'not-allowed':'pointer', fontFamily:'inherit',
              background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff',
              opacity:saving?.6:1, display:'flex', alignItems:'center', gap:7 }}>
            {saving ? <><span className="sp"/> Saving...</> : '💾 Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN NOTES PAGE
═══════════════════════════════════════════════════════════ */
export default function Notes() {
  const [tab,          setTab]          = useState('see');
  const [title,        setTitle]        = useState('');
  const [saving,       setSaving]       = useState(false);
  const [notes,        setNotes]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [currentUid,   setCurrentUid]   = useState(null);
  const [isSA,         setIsSA]         = useState(false);
  const [confirmDel,   setConfirmDel]   = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [editNote,     setEditNote]     = useState(null);  // note being edited
  const [editSaving,   setEditSaving]   = useState(false);
  const editorApi = useRef(null);
  const pageRef   = useRef(null);
  const [pageH,   setPageH] = useState('70vh');

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      setCurrentUid(u.user_id || null);
      setIsSA((u.permissions || []).includes('__superadmin__'));
    } catch{}
  }, []);

  /* size the page to exactly fill the space below it — measured, not guessed,
     so it works regardless of header / layout padding */
  useEffect(() => {
    const recalc = () => {
      if (!pageRef.current) return;
      const top = pageRef.current.getBoundingClientRect().top;
      setPageH(`${Math.max(360, window.innerHeight - top - 16)}px`);
    };
    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, []);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.post(API, new URLSearchParams({ action:'get_notes' }));
      setNotes(r.data.data?.notes || []);
    } catch(e) { toast.error(e.response?.data?.message || 'Failed to load notes'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (tab === 'see') loadNotes(); }, [tab, loadNotes]);

  /* ── save new note ── */
  const handleSave = async () => {
    const html    = editorApi.current?.getHTML() || '';
    const s3Keys  = editorApi.current?.getS3Keys() || [];
    const textOnly = html.replace(/<[^>]+>/g, '').trim();
    const hasImg   = /<img/i.test(html);
    if (!textOnly && !hasImg) { toast.error('Please write something or paste an image'); return; }
    setSaving(true);
    try {
      await api.post(API, new URLSearchParams({
        action:'add_note', title:title.trim(), content:html, s3_keys:JSON.stringify(s3Keys),
      }));
      toast.success('Note saved! 📝');
      setTitle('');
      const edEl = document.querySelector('[contenteditable]');
      if (edEl) edEl.innerHTML = '';
      if (editorApi.current) editorApi.current.getS3Keys = ()=>[];
      setTab('see');
    } catch(e) { toast.error(e.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  /* ── delete note ── */
  const handleDelete = async id => {
    setDeleting(true);
    try {
      await api.post(API, new URLSearchParams({ action:'delete_note', note_id:id }));
      toast.success('Note deleted');
      setNotes(p => p.filter(n => n.id !== id));
      setConfirmDel(null);
    } catch(e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setDeleting(false); }
  };

  /* ── edit note save ── */
  const handleEditSave = async ({ id, title: newTitle, content: newContent }) => {
    setEditSaving(true);
    try {
      await api.post(API, new URLSearchParams({
        action:'edit_note', note_id:id, title:newTitle, content:newContent,
      }));
      toast.success('Note updated');
      setNotes(p => p.map(n => n.id===id ? {...n, title:newTitle, content:newContent} : n));
      setEditNote(null);
    } catch(e) { toast.error(e.response?.data?.message || 'Failed to update'); }
    finally { setEditSaving(false); }
  };

  const tabS = active => ({
    flex:1, padding:'11px 0', border:'none', background:'none',
    fontFamily:'inherit', fontSize:14, fontWeight:700, cursor:'pointer',
    color: active ? '#4f46e5' : '#94a3b8',
    borderBottom: `2.5px solid ${active ? '#4f46e5' : 'transparent'}`,
    transition:'all .15s',
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .notes-pg * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        @keyframes sp { to { transform:rotate(360deg); } }
        .sp { display:inline-block;width:16px;height:16px;border:2px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:sp .7s linear infinite; }
      `}</style>

      <div className="notes-pg" ref={pageRef} style={{ display:'flex', flexDirection:'column',
        minHeight:pageH,
        background:'#f5f3ff', overflow:'visible', borderRadius:12 }}>

        {/* ── Header ── */}
        <div style={{ background:'#fff', borderBottom:'1.5px solid #ede9fe',
          padding:'14px 24px', flexShrink:0,
          display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:'#1e293b' }}>📝 Team Notes</div>
            <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>Shared with all admin panel users</div>
          </div>
          {tab==='see' && (
            <button onClick={loadNotes} disabled={loading}
              style={{ padding:'7px 14px', border:'1.5px solid #e2e8f0', borderRadius:9,
                background:'#fff', color:'#64748b', fontSize:12.5, fontWeight:700,
                cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
              {loading ? <span className="sp"/> : '🔄'} Refresh
            </button>
          )}
        </div>

        {/* ── Tabs ── */}
        <div style={{ background:'#fff', display:'flex', padding:'0 24px',
          borderBottom:'1.5px solid #ede9fe', flexShrink:0 }}>
            <button style={tabS(tab==='see')} onClick={()=>setTab('see')}>
            👁 See All Notes{notes.length>0&&tab==='see'?` (${notes.length})`:''}
          </button>
          <button style={tabS(tab==='add')} onClick={()=>setTab('add')}>✏️ Add Note</button>
        </div>

        {/* ══ ADD NOTE TAB ══ */}
        {tab==='add' && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', padding:20, gap:12 }}>
            <input value={title} onChange={e=>setTitle(e.target.value)}
              placeholder="Title (optional)..."
              style={{ width:'100%', padding:'11px 16px', border:'1.5px solid #e2e8f0',
                borderRadius:12, fontSize:15, fontWeight:600, fontFamily:'inherit',
                color:'#1e293b', outline:'none', flexShrink:0 }}
              onFocus={e=>e.target.style.borderColor='#4f46e5'}
              onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
            <RichEditor onChange={api_ => { editorApi.current = api_; }} disabled={saving}/>
            <div style={{ display:'flex', justifyContent:'flex-end', flexShrink:0 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ padding:'11px 32px', border:'none', borderRadius:11, fontSize:14,
                  fontWeight:800, cursor:saving?'not-allowed':'pointer', color:'#fff',
                  fontFamily:'inherit', opacity:saving?.6:1,
                  background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
                  boxShadow:'0 4px 16px rgba(79,70,229,.35)',
                  display:'flex', alignItems:'center', gap:8 }}>
                {saving ? <><span className="sp"/> Saving...</> : '💾 Save Note'}
              </button>
            </div>
          </div>
        )}

        {/* ══ SEE NOTES TAB — full-width collapsible list ══ */}
        {tab==='see' && (
          <div style={{ flex:1, minHeight:0, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:8 }}>
            {loading ? (
              <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>
                <span className="sp" style={{ width:28,height:28,borderWidth:3,display:'inline-block' }}/>
                <div style={{ marginTop:14, fontSize:13 }}>Loading notes...</div>
              </div>
            ) : !notes.length ? (
              <div style={{ textAlign:'center', padding:80, color:'#94a3b8' }}>
                <div style={{ fontSize:56, marginBottom:16 }}>📭</div>
                <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>No notes yet</div>
                <div style={{ fontSize:13 }}>Switch to Add Note to write the first one.</div>
              </div>
            ) : notes.map(note => (
              <NoteRow key={note.id} note={note} isSA={isSA} currentUid={currentUid}
                onDelete={id=>setConfirmDel(id)}
                onEdit={n=>setEditNote(n)}/>
            ))}
          </div>
        )}
      </div>

      {/* ── Edit modal ── */}
      {editNote && (
        <EditModal note={editNote} saving={editSaving}
          onClose={()=>setEditNote(null)}
          onSave={handleEditSave}/>
      )}

      {/* ── Delete confirm modal ── */}
      {confirmDel && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
          onClick={e=>e.target===e.currentTarget&&setConfirmDel(null)}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, maxWidth:400,
            width:'100%', textAlign:'center', boxShadow:'0 24px 70px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize:44, marginBottom:12 }}>🗑️</div>
            <div style={{ fontSize:16, fontWeight:800, color:'#1e293b', marginBottom:8 }}>Delete this note?</div>
            <div style={{ fontSize:13, color:'#64748b', marginBottom:24 }}>
              This cannot be undone. All content and attachments will be removed.
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={()=>setConfirmDel(null)}
                style={{ padding:'10px 22px', border:'1.5px solid #e2e8f0', borderRadius:9,
                  background:'#fff', color:'#475569', fontSize:13, fontWeight:700,
                  cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button onClick={()=>handleDelete(confirmDel)} disabled={deleting}
                style={{ padding:'10px 22px', border:'none', borderRadius:9, fontSize:13,
                  fontWeight:700, cursor:deleting?'not-allowed':'pointer', fontFamily:'inherit',
                  background:'linear-gradient(135deg,#dc2626,#b91c1c)', color:'#fff',
                  opacity:deleting?.6:1, display:'flex', alignItems:'center', gap:7 }}>
                {deleting ? <><span className="sp"/> Deleting...</> : '🗑️ Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}