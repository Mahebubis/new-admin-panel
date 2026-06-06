// ===========================================================================
//  ProblemStatements.jsx
//  Internships → Problem Statement
//
//  • Lists every internship domain (internship_list where is_full = 0) as a card
//  • Open a domain → attach one or more "problem statement" files
//      - choose a file type, then upload a file (mandatory)
//      - optional title
//      - optional rich-HTML description (full editor: colours, bold, table,
//        image upload, lists, links, alignment …)
//  • Files are stored on AWS S3 by problem_statements_api.php; the URL is saved.
//
//  Professional, sober design — slate neutrals + a single indigo accent,
//  Lucide icons (no emoji).
// ===========================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Helmet } from 'react-helmet-async';
import {
  ArrowLeft, Search, Plus, Pencil, Trash2, X, Eye, Upload, ExternalLink,
  FileText, FileSpreadsheet, Presentation, Film, Paperclip, AlignJustify,
  FileArchive, Image as ImageIcon, ChevronRight, FolderOpen, Inbox, Loader,
  CheckCircle, Save, RefreshCw, Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, FileSearch, List, ListOrdered, Link2,
  Table as TableIcon, Highlighter, Baseline, Eraser, Undo, Redo, Heading, Quote,
  Database, Link as LinkIcon, FileUp,
} from 'lucide-react';

/* ── API base — same host as the rest of the panel, internship-system folder ── */
const API = `${import.meta.env.VITE_API_URL || 'https://cit3.internshipstudio.com/admin/react-api'}/api/internship-system/problem_statements_api.php`;

async function call(qs, body, isForm) {
  const opts = { method: body ? 'POST' : 'GET', cache: 'no-store' };
  if (body) {
    if (isForm) { opts.body = body; }
    else { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body); }
  }
  const res = await fetch(`${API}?${qs}&_=${Date.now()}`, opts);
  let json;
  try { json = await res.json(); } catch { throw new Error('Server returned an invalid response'); }
  if (!res.ok || json.status === 'error') throw new Error(json?.message || `Request failed (${res.status})`);
  return json.data ?? json;
}
const Api = {
  domains:   ()          => call('action=domains'),
  list:      (id)        => call(`action=list&internship_id=${id}`),
  create:    (form)      => call('action=create', form, true),
  update:    (d)         => call('action=update', d),
  remove:    (id)        => call('action=delete', { id }),
  uploadImg: (form)      => call('action=upload_image', form, true),
  itemAddFile: (form)    => call('action=item_add', form, true),   // multipart
  itemAddLink: (d)       => call('action=item_add', d),            // json
  itemRemove: (id)       => call('action=item_delete', { id }),
};

/* ── lightweight client cache (stale-while-revalidate) so revisits are instant ── */
const DOMAINS_CACHE_KEY = 'ps_domains_cache_v1';
const stmtCache = new Map();   // internship_id -> statements[] (per session)
const readDomainsCache = () => {
  try { const c = sessionStorage.getItem(DOMAINS_CACHE_KEY); return c ? JSON.parse(c) : null; }
  catch { return null; }
};
const writeDomainsCache = (list) => {
  try { sessionStorage.setItem(DOMAINS_CACHE_KEY, JSON.stringify(list)); } catch { /* quota — ignore */ }
};

/* ── colour palette (sober, professional) ── */
const C = {
  ink: '#0f172a', body: '#334155', muted: '#64748b', faint: '#94a3b8',
  line: '#e2e8f0', line2: '#f1f5f9', bg: '#f8fafc', card: '#ffffff',
  accent: '#4f46e5', accentSoft: '#eef2ff', accentLine: '#c7d2fe',
  danger: '#dc2626', dangerSoft: '#fef2f2', dangerLine: '#fecaca',
  ok: '#16a34a', okSoft: '#f0fdf4',
};

/* ── file-type catalogue ── */
const FILE_TYPES = [
  { key: 'pdf',   label: 'PDF Document',     icon: FileText,        accept: '.pdf',                          hue: '#dc2626' },
  { key: 'image', label: 'Image',            icon: ImageIcon,       accept: 'image/*',                       hue: '#0891b2' },
  { key: 'doc',   label: 'Word Document',    icon: FileText,        accept: '.doc,.docx',                    hue: '#2563eb' },
  { key: 'excel', label: 'Excel / CSV',      icon: FileSpreadsheet, accept: '.xls,.xlsx,.csv',               hue: '#16a34a' },
  { key: 'ppt',   label: 'Presentation',     icon: Presentation,    accept: '.ppt,.pptx',                    hue: '#ea580c' },
  { key: 'video', label: 'Video',            icon: Film,            accept: 'video/*',                       hue: '#7c3aed' },
  { key: 'zip',   label: 'Archive (ZIP)',    icon: FileArchive,     accept: '.zip,.rar,.7z,.tar,.gz',        hue: '#a16207' },
  { key: 'other', label: 'Any file',         icon: Paperclip,       accept: '*',                             hue: '#64748b' },
];
const typeMeta = (k) => FILE_TYPES.find(t => t.key === k) || FILE_TYPES[FILE_TYPES.length - 1];

const fmtSize = (b) => {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};
const fmtDate = (d) => d ? new Date(d.replace(' ', 'T')).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
}) : '';

/* ═══════════════════════════════════════════════════════════════════════════
   Spinner
═══════════════════════════════════════════════════════════════════════════ */
const Spin = ({ size = 16, color = C.accent }) => (
  <Loader size={size} color={color} style={{ animation: 'ps-spin .8s linear infinite' }} />
);

/* ═══════════════════════════════════════════════════════════════════════════
   Colour picker (text / highlight) — professional dropdown swatches
═══════════════════════════════════════════════════════════════════════════ */
const TEXT_COLORS = ['#0f172a','#475569','#dc2626','#ea580c','#d97706','#16a34a','#0891b2','#2563eb','#4f46e5','#7c3aed','#db2777','#ffffff'];
const BG_COLORS   = ['transparent','#fef9c3','#dcfce7','#dbeafe','#ede9fe','#fee2e2','#ffedd5','#fce7f3','#e0f2fe','#f1f5f9'];

function ColorMenu({ Icon, title, colors, onPick }) {
  const SwatchIcon = Icon;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button title={title} type="button"
        onMouseDown={(e) => { e.preventDefault(); setOpen(p => !p); }}
        style={tbBtn(false)}>
        <SwatchIcon size={15} />
      </button>
      {open && (
        <div onMouseDown={(e) => e.preventDefault()}
          style={{ position: 'absolute', top: 'calc(100% + 5px)', left: 0, zIndex: 50,
            background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, padding: 9,
            boxShadow: '0 10px 34px rgba(15,23,42,.16)', display: 'grid',
            gridTemplateColumns: 'repeat(6,1fr)', gap: 6, width: 168 }}>
          {colors.map(col => (
            <button key={col} type="button" title={col}
              onClick={() => { onPick(col); setOpen(false); }}
              style={{ width: 20, height: 20, borderRadius: 5, cursor: 'pointer', padding: 0,
                background: col === 'transparent'
                  ? 'repeating-conic-gradient(#cbd5e1 0% 25%, #fff 0% 50%) 0 0/9px 9px' : col,
                border: `1px solid ${col === '#ffffff' ? C.line : 'rgba(15,23,42,.12)'}` }} />
          ))}
          <label title="Custom colour"
            style={{ width: 20, height: 20, borderRadius: 5, cursor: 'pointer', border: `1px solid ${C.line}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg,
              fontSize: 13, color: C.muted, position: 'relative', overflow: 'hidden' }}>
            +
            <input type="color" style={{ opacity: 0, position: 'absolute', width: 0, height: 0 }}
              onChange={(e) => { onPick(e.target.value); setOpen(false); }} />
          </label>
        </div>
      )}
    </div>
  );
}

/* toolbar button style */
const tbBtn = (active) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 30, height: 30, borderRadius: 7, cursor: 'pointer', flexShrink: 0,
  border: `1px solid ${active ? C.accentLine : C.line}`,
  background: active ? C.accentSoft : '#fff',
  color: active ? C.accent : C.body, padding: 0, transition: 'all .12s',
});
const tbDivider = () => (<span style={{ width: 1, height: 22, background: C.line, margin: '0 3px', flexShrink: 0 }} />);

/* ═══════════════════════════════════════════════════════════════════════════
   RichEditor — full-featured, professional toolbar
   exposes { getHTML() } via onReady; accepts initialHTML
═══════════════════════════════════════════════════════════════════════════ */
function RichEditor({ onReady, initialHTML = '', minHeight = 220 }) {
  const ref = useRef(null);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (ref.current && initialHTML) ref.current.innerHTML = initialHTML;
    onReady?.({ getHTML: () => ref.current?.innerHTML || '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (cmd, val = null) => { ref.current?.focus(); document.execCommand(cmd, false, val); };

  const insertTable = () => {
    const rows = parseInt(prompt('Number of rows?', '3') || '0', 10);
    const cols = parseInt(prompt('Number of columns?', '3') || '0', 10);
    if (!rows || !cols || rows > 50 || cols > 20) return;
    let html = '<table class="ps-tbl"><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) html += r === 0 ? '<th><br></th>' : '<td><br></td>';
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    exec('insertHTML', html);
  };

  const insertLink = () => {
    const url = prompt('Enter URL (https://…):');
    if (url) exec('createLink', url);
  };

  /* paste image → inline base64 */
  const onPaste = useCallback((e) => {
    const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    const file = item.getAsFile();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => exec('insertHTML',
      `<img src="${ev.target.result}" style="max-width:100%;border-radius:8px;margin:6px 0;display:block;" />`);
    reader.readAsDataURL(file);
  }, []);

  /* attach image → S3 */
  const onAttach = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('action', 'upload_image');
      fd.append('image', file);
      const r = await Api.uploadImg(fd);
      ref.current?.focus();
      exec('insertHTML', `<img src="${r.url}" style="max-width:100%;border-radius:8px;margin:6px 0;display:block;" />`);
      toast.success('Image inserted');
    } catch (err) { toast.error(err.message || 'Image upload failed'); }
    finally { setUploading(false); }
  };

  const TB = ({ title, onClick, children }) => (
    <button type="button" title={title} onMouseDown={(e) => { e.preventDefault(); onClick(); }} style={tbBtn(false)}>
      {children}
    </button>
  );

  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      {/* toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center',
        padding: '8px 10px', borderBottom: `1px solid ${C.line2}`, background: C.bg }}>
        <TB title="Bold" onClick={() => exec('bold')}><Bold size={15} /></TB>
        <TB title="Italic" onClick={() => exec('italic')}><Italic size={15} /></TB>
        <TB title="Underline" onClick={() => exec('underline')}><Underline size={15} /></TB>
        <TB title="Strikethrough" onClick={() => exec('strikeThrough')}><Strikethrough size={15} /></TB>
        {tbDivider()}
        <ColorMenu Icon={Baseline} title="Text colour" colors={TEXT_COLORS} onPick={(c) => exec('foreColor', c)} />
        <ColorMenu Icon={Highlighter} title="Highlight colour" colors={BG_COLORS}
          onPick={(c) => exec('hiliteColor', c)} />
        {tbDivider()}
        <TB title="Heading" onClick={() => exec('formatBlock', 'h2')}><Heading size={15} /></TB>
        <TB title="Normal text" onClick={() => exec('formatBlock', 'p')}><span style={{ fontSize: 12, fontWeight: 700 }}>¶</span></TB>
        <TB title="Quote" onClick={() => exec('formatBlock', 'blockquote')}><Quote size={15} /></TB>
        {tbDivider()}
        <TB title="Align left" onClick={() => exec('justifyLeft')}><AlignLeft size={15} /></TB>
        <TB title="Align centre" onClick={() => exec('justifyCenter')}><AlignCenter size={15} /></TB>
        <TB title="Align right" onClick={() => exec('justifyRight')}><AlignRight size={15} /></TB>
        <TB title="Justify" onClick={() => exec('justifyFull')}><AlignJustify size={15} /></TB>
        {tbDivider()}
        <TB title="Bullet list" onClick={() => exec('insertUnorderedList')}><List size={15} /></TB>
        <TB title="Numbered list" onClick={() => exec('insertOrderedList')}><ListOrdered size={15} /></TB>
        {tbDivider()}
        <TB title="Insert table" onClick={insertTable}><TableIcon size={15} /></TB>
        <TB title="Insert link" onClick={insertLink}><Link2 size={15} /></TB>
        <TB title="Clear formatting" onClick={() => exec('removeFormat')}><Eraser size={15} /></TB>
        <TB title="Undo" onClick={() => exec('undo')}><Undo size={15} /></TB>
        <TB title="Redo" onClick={() => exec('redo')}><Redo size={15} /></TB>
        <span style={{ flex: 1 }} />
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onAttach} />
        <button type="button" disabled={uploading} onMouseDown={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px',
            borderRadius: 8, border: `1px solid ${C.accentLine}`, background: C.accentSoft, color: C.accent,
            fontSize: 12.5, fontWeight: 600, cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? .6 : 1 }}>
          {uploading ? <Spin size={14} /> : <ImageIcon size={14} />} Insert image
        </button>
      </div>

      {/* editable area */}
      <div ref={ref} contentEditable suppressContentEditableWarning onPaste={onPaste}
        data-ph="Write the problem statement description here (optional)…"
        style={{ padding: '16px 18px', outline: 'none', minHeight, maxHeight: 360, overflowY: 'auto',
          fontSize: 14, lineHeight: 1.8, color: C.body }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   File viewer — preview the uploaded file in a popup (no forced download)
═══════════════════════════════════════════════════════════════════════════ */
const extOf = (row) => {
  const src = (row.file_name || row.file_url || '').split('?')[0];
  const m = src.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : '';
};
const previewKind = (row) => {
  const mime = (row.mime_type || '').toLowerCase();
  const ext = extOf(row);
  if (mime.startsWith('image/') || ['jpg','jpeg','png','gif','webp','svg','bmp','avif'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('video/') || ['mp4','webm','ogg','mov','m4v'].includes(ext)) return 'video';
  if (['doc','docx','xls','xlsx','csv','ppt','pptx'].includes(ext)) return 'office';
  return 'other';
};

function FileViewer({ row, onClose }) {
  const kind = previewKind(row);
  const url = row.file_url;
  const gview = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;

  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  let body;
  if (kind === 'image') {
    body = (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 18, background: '#0f172a' }}>
        <img src={url} alt={row.file_name || ''}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
      </div>
    );
  } else if (kind === 'pdf') {
    body = <iframe title="preview" src={url} style={{ flex: 1, minHeight: 0, width: '100%', border: 'none' }} />;
  } else if (kind === 'video') {
    body = (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 18, background: '#0f172a' }}>
        <video src={url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
      </div>
    );
  } else if (kind === 'office') {
    body = <iframe title="preview" src={gview} style={{ flex: 1, minHeight: 0, width: '100%', border: 'none' }} />;
  } else {
    body = (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 12, color: C.faint, padding: 40, textAlign: 'center' }}>
        <FileSearch size={46} color={C.line} />
        <div style={{ fontSize: 14.5, fontWeight: 700, color: C.body }}>Preview not available for this file type</div>
        <div style={{ fontSize: 13 }}>Open it in a new tab to view the contents.</div>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...primaryBtn, textDecoration: 'none', marginTop: 4 }}>
          <ExternalLink size={15} /> Open in new tab
        </a>
      </div>
    );
  }

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 960, height: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(15,23,42,.32)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
          borderBottom: `1px solid ${C.line}` }}>
          <FileSearch size={18} color={C.accent} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, color: C.ink,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {row.title || row.file_name || 'File preview'}
          </div>
          <a href={url} target="_blank" rel="noopener noreferrer" title="Open in new tab"
            style={{ ...iconBtn, textDecoration: 'none' }}><ExternalLink size={16} /></a>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        {body}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Add / Edit modal
═══════════════════════════════════════════════════════════════════════════ */
let _draftSeq = 1;
const newDraft = (kind = 'file') => ({ tempId: `d${_draftSeq++}`, persisted: false, kind, label: '', file: null, url: '' });

/* one editable draft row (file or link) inside the modal */
function DraftRow({ item, isDataset, onChange, onRemove }) {
  const fileRef = useRef(null);
  const set = (k, v) => onChange({ ...item, [k]: v });
  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) { toast.error('File must be under 50MB'); return; }
    set('file', f);
  };
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 11, padding: 12, background: C.bg,
      display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* kind toggle */}
        <div style={{ display: 'inline-flex', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 9, padding: 2 }}>
          <button type="button" onClick={() => set('kind', 'file')}
            style={kindTab(item.kind === 'file')}><FileUp size={13} /> Upload</button>
          <button type="button" onClick={() => set('kind', 'link')}
            style={kindTab(item.kind === 'link')}><LinkIcon size={13} /> Link</button>
        </div>
        <input value={item.label} onChange={(e) => set('label', e.target.value)}
          placeholder={isDataset ? 'Dataset label (e.g. Sales 2024)' : 'Label (optional)'}
          style={{ ...inputS, height: 36, flex: 1 }} onFocus={focusBorder} onBlur={blurBorder} />
        <button type="button" onClick={onRemove} style={iconBtn} title="Remove"><X size={16} /></button>
      </div>
      {item.kind === 'link' ? (
        <input value={item.url} onChange={(e) => set('url', e.target.value)}
          placeholder="https://… (Google Drive, dataset URL, etc.)"
          style={{ ...inputS, height: 38 }} onFocus={focusBorder} onBlur={blurBorder} />
      ) : (
        <>
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={pick} />
          {!item.file ? (
            <button type="button" onClick={() => fileRef.current?.click()}
              style={{ width: '100%', padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                border: `1.5px dashed ${C.accentLine}`, background: '#fff', color: C.muted,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Upload size={16} color={C.accent} />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.body }}>Choose a file</span>
              <span style={{ fontSize: 11, color: C.faint }}>· any type · max 50MB</span>
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 10, border: `1px solid ${C.accentLine}`, background: '#fff' }}>
              <Paperclip size={15} color={C.accent} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: C.ink,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.file.name}</div>
              <span style={{ fontSize: 11.5, color: C.muted }}>{fmtSize(item.file.size)}</span>
              <button type="button" onClick={() => fileRef.current?.click()} style={{ ...ghostBtn, height: 28 }}>Change</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* a persisted (already-saved) item shown in edit mode with a remove button */
function SavedItemRow({ item, onRemove }) {
  const isLink = item.kind === 'link';
  const meta = typeMeta(item.file_type);
  const Ic = isLink ? LinkIcon : meta.icon;
  const name = item.label || item.file_name || item.url || 'Item';
  const href = isLink ? item.url : item.file_url;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px',
      border: `1px solid ${C.line}`, borderRadius: 10, background: '#fff' }}>
      <span style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: C.bg, color: isLink ? C.accent : meta.hue }}>
        <Ic size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ fontSize: 11, color: C.faint }}>{isLink ? 'Link' : (meta.label + (item.file_size ? ` · ${fmtSize(item.file_size)}` : ''))}</div>
      </div>
      <a href={href} target="_blank" rel="noopener noreferrer" title="Open"
        style={{ ...iconBtn, textDecoration: 'none' }}><ExternalLink size={15} /></a>
      <button type="button" onClick={onRemove} style={iconBtnDanger} title="Remove"><Trash2 size={15} /></button>
    </div>
  );
}

function StatementModal({ domain, editing, onClose, onSaved }) {
  const isEdit = !!editing;
  const [title, setTitle] = useState(editing?.title || '');
  const [saving, setSaving] = useState(false);
  const editorApi = useRef(null);

  const split = (cat) => (editing?.items || []).filter(it => (it.category || 'resource') === cat)
    .map(it => ({ ...it, persisted: true }));
  const [resources, setResources] = useState(() => isEdit ? split('resource') : []);
  const [datasets, setDatasets]   = useState(() => isEdit ? split('dataset') : []);

  const upd = (setList) => (tempId, next) => setList(list => list.map(x => (x.tempId === tempId || x.id === tempId) ? next : x));
  const addDraft = (setList) => () => setList(list => [...list, newDraft()]);

  /* remove: persisted → delete on server now; draft → drop locally */
  const removeItem = (setList) => async (item) => {
    if (item.persisted) {
      try { await Api.itemRemove(item.id); toast.success('Removed'); }
      catch (e) { return toast.error(e.message || 'Remove failed'); }
    }
    setList(list => list.filter(x => (x.tempId || x.id) !== (item.tempId || item.id)));
  };

  const persistDraft = async (statementId, category, d) => {
    if (d.kind === 'link') {
      if (!d.url.trim()) throw new Error('A link is missing its URL');
      await Api.itemAddLink({ statement_id: statementId, category, kind: 'link', label: d.label.trim(), url: d.url.trim() });
    } else {
      if (!d.file) throw new Error('An upload item is missing its file');
      const fd = new FormData();
      fd.append('action', 'item_add');
      fd.append('statement_id', statementId);
      fd.append('category', category);
      fd.append('kind', 'file');
      fd.append('label', d.label.trim());
      fd.append('file', d.file);
      await Api.itemAddFile(fd);
    }
  };

  const save = async () => {
    const description = editorApi.current?.getHTML?.() || '';
    const newResources = resources.filter(x => !x.persisted);
    const newDatasets   = datasets.filter(x => !x.persisted);

    // validate drafts up front so nothing is half-saved
    for (const d of [...newResources, ...newDatasets]) {
      if (d.kind === 'link' && !d.url.trim()) return toast.error('Fill the URL for every link, or remove it');
      if (d.kind === 'file' && !d.file)        return toast.error('Choose a file for every upload, or remove it');
    }

    setSaving(true);
    try {
      let statementId = editing?.id;
      if (isEdit) {
        await Api.update({ id: statementId, title: title.trim(), description });
      } else {
        const fd = new FormData();
        fd.append('action', 'create');
        fd.append('internship_id', domain.internship_id);
        fd.append('title', title.trim());
        fd.append('description', description);
        const res = await Api.create(fd);
        statementId = res.id;
      }
      for (const d of newResources) await persistDraft(statementId, 'resource', d);
      for (const d of newDatasets)   await persistDraft(statementId, 'dataset', d);
      toast.success(isEdit ? 'Saved' : 'Problem statement added');
      onSaved();
    } catch (e) { toast.error(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  /* plain render function (NOT a component) so draft inputs keep focus across re-renders */
  const section = ({ icon, title: secTitle, hint, list, setList, isDataset }) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.body, textTransform: 'uppercase', letterSpacing: '.04em' }}>{secTitle}</span>
        <span style={{ fontSize: 11, color: C.faint }}>{hint}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {list.map(it => it.persisted
          ? <SavedItemRow key={it.id} item={it} onRemove={() => removeItem(setList)(it)} />
          : <DraftRow key={it.tempId} item={it} isDataset={isDataset}
              onChange={(next) => upd(setList)(it.tempId, next)} onRemove={() => removeItem(setList)(it)} />)}
        <button type="button" onClick={addDraft(setList)}
          style={{ ...ghostBtn, height: 38, alignSelf: 'flex-start', borderStyle: 'dashed', borderColor: C.accentLine, color: C.accent }}>
          <Plus size={15} /> Add {isDataset ? 'dataset' : 'file or link'}
        </button>
      </div>
    </div>
  );

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 760, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(15,23,42,.28)' }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: `1px solid ${C.line}` }}>
          <div>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: C.ink }}>
              {isEdit ? 'Edit problem statement' : 'New problem statement'}
            </div>
            <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{domain.name}</div>
          </div>
          <button onClick={onClose} disabled={saving} style={iconBtn}><X size={18} /></button>
        </div>

        {/* body */}
        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* title */}
          <Field label="Title" optional>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Week 1 — Market research brief"
              style={inputS} onFocus={focusBorder} onBlur={blurBorder} />
          </Field>

          {/* description */}
          <Field label="Description" optional>
            <RichEditor onReady={(a) => (editorApi.current = a)} initialHTML={editing?.description || ''} />
          </Field>

          {/* resources — multiple files / links */}
          {section({ icon: <Paperclip size={15} color={C.accent} />, title: 'Files & links', isDataset: false,
            hint: 'add as many uploads or links as you need',
            list: resources, setList: setResources })}

          {/* datasets — labelled files / links */}
          {section({ icon: <Database size={15} color={C.accent} />, title: 'Datasets', isDataset: true,
            hint: 'labelled data files or links',
            list: datasets, setList: setDatasets })}
        </div>

        {/* footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px',
          borderTop: `1px solid ${C.line}` }}>
          <button onClick={onClose} disabled={saving} style={ghostBtn}>Cancel</button>
          <button onClick={save} disabled={saving} style={primaryBtn}>
            {saving ? <Spin size={15} color="#fff" /> : <Save size={15} />}
            {isEdit ? 'Save changes' : 'Add problem statement'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* kind-toggle tab style */
const kindTab = (active) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px', borderRadius: 7,
  border: 'none', background: active ? C.accent : 'transparent', color: active ? '#fff' : C.muted,
  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
});

/* ═══════════════════════════════════════════════════════════════════════════
   Domain detail — list of problem statements for one domain
═══════════════════════════════════════════════════════════════════════════ */
function DomainDetail({ domain, onBack, onCountChange }) {
  const id = domain.internship_id;
  const [rows, setRows] = useState(() => stmtCache.get(id) || []);
  const [loading, setLoading] = useState(() => !stmtCache.has(id)); // cached → instant
  const [modal, setModal] = useState(null);   // { editing? }
  const [confirmDel, setConfirmDel] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const d = await Api.list(id);
      const list = d.statements || [];
      setRows(list);
      stmtCache.set(id, list);
      onCountChange?.(id, list.length);
    } catch (e) { if (!silent) toast.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [id, onCountChange]);

  // first paint uses the cache; always revalidate in the background
  useEffect(() => { load(stmtCache.has(id)); }, [load, id]);

  const del = async () => {
    setDeleting(true);
    try {
      await Api.remove(confirmDel.id);
      toast.success('Deleted');
      setConfirmDel(null);
      load(true);
    } catch (e) { toast.error(e.message || 'Delete failed'); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      {/* breadcrumb / header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ ...ghostBtn, height: 38 }}>
          <ArrowLeft size={16} /> All domains
        </button>
        <DomainLogo domain={domain} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>{domain.name}</div>
          <div style={{ fontSize: 12.5, color: C.faint }}>
            {rows.length} problem statement{rows.length === 1 ? '' : 's'} attached
          </div>
        </div>
        <button onClick={() => setModal({})} style={primaryBtn}>
          <Plus size={16} /> Add problem statement
        </button>
      </div>

      {/* list */}
      {loading ? (
        <div style={emptyWrap}><Spin size={26} /><div style={{ marginTop: 12 }}>Loading…</div></div>
      ) : !rows.length ? (
        <div style={emptyWrap}>
          <Inbox size={42} color={C.line} />
          <div style={{ fontSize: 15, fontWeight: 700, color: C.body, marginTop: 12 }}>No problem statements yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Click “Add problem statement” to upload the first file.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(r => <StatementRow key={r.id} row={r}
            onEdit={() => setModal({ editing: r })}
            onDelete={() => setConfirmDel(r)} />)}
        </div>
      )}

      {modal && (
        <StatementModal domain={domain} editing={modal.editing}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(true); }} />
      )}

      {confirmDel && (
        <ConfirmDelete name={confirmDel.title || confirmDel.file_name || 'this problem statement'}
          busy={deleting} onCancel={() => setConfirmDel(null)} onConfirm={del} />
      )}
    </div>
  );
}

/* one resource/dataset line within a statement */
function ItemLine({ item, onView }) {
  const isLink = item.kind === 'link';
  const meta = typeMeta(item.file_type);
  const Ic = isLink ? LinkIcon : meta.icon;
  const name = item.label || item.file_name || item.url || 'Item';
  const sub = isLink ? 'Link' : (meta.label + (item.file_size ? ` · ${fmtSize(item.file_size)}` : ''));
  const inner = (
    <>
      <span style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: '#fff', color: isLink ? C.accent : meta.hue,
        border: `1px solid ${C.line}` }}>
        <Ic size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ fontSize: 11, color: C.faint }}>{sub}</div>
      </div>
      {isLink ? <ExternalLink size={15} color={C.faint} /> : <Eye size={15} color={C.accent} />}
    </>
  );
  const baseStyle = { display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px',
    border: `1px solid ${C.line}`, borderRadius: 10, background: C.bg, textDecoration: 'none', cursor: 'pointer' };
  return isLink
    ? <a href={item.url} target="_blank" rel="noopener noreferrer" style={baseStyle}>{inner}</a>
    : <div style={baseStyle} onClick={() => onView(item)}>{inner}</div>;
}

/* single statement row — header + grouped resources & datasets + description */
function StatementRow({ row, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const hasDesc = row.description && row.description.replace(/<[^>]+>/g, '').trim().length > 0;

  const items = row.items || [];
  /* legacy single file stored on the parent → show as a resource */
  const legacy = row.file_url
    ? [{ id: `legacy-${row.id}`, kind: 'file', category: 'resource', label: row.file_name,
         file_url: row.file_url, file_name: row.file_name, file_type: row.file_type,
         file_size: row.file_size, mime_type: row.mime_type }]
    : [];
  const resources = [...legacy, ...items.filter(i => (i.category || 'resource') === 'resource')];
  const datasets  = items.filter(i => i.category === 'dataset');
  const total = resources.length + datasets.length;

  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
        <span style={{ width: 44, height: 44, borderRadius: 11, flexShrink: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center', background: C.accentSoft, color: C.accent }}>
          <FileText size={20} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {row.title || 'Untitled problem statement'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
            {resources.length > 0 && <span style={chip}>{resources.length} file{resources.length === 1 ? '' : 's'}/link{resources.length === 1 ? '' : 's'}</span>}
            {datasets.length > 0 && <span style={{ ...chip, background: C.accentSoft, color: C.accent }}>{datasets.length} dataset{datasets.length === 1 ? '' : 's'}</span>}
            <span style={{ fontSize: 11.5, color: C.faint }}>{fmtDate(row.created_at)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          {(total > 0 || hasDesc) && (
            <button title={open ? 'Collapse' : 'Expand'} onClick={() => setOpen(o => !o)}
              style={iconBtnSubtle(open)}><ChevronRight size={16}
                style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} /></button>
          )}
          <button title="Edit" onClick={onEdit} style={iconBtnSubtle(false)}><Pencil size={16} /></button>
          <button title="Delete" onClick={onDelete} style={iconBtnDanger}><Trash2 size={16} /></button>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${C.line2}`, padding: '14px 18px', background: C.bg,
          display: 'flex', flexDirection: 'column', gap: 14 }}>
          {hasDesc && (
            <div className="ps-rich" style={{ fontSize: 13.5, lineHeight: 1.8, color: C.body }}
              dangerouslySetInnerHTML={{ __html: row.description }} />
          )}
          {resources.length > 0 && (
            <div>
              <div style={subHead}><Paperclip size={13} /> Files & links</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {resources.map(it => <ItemLine key={it.id} item={it} onView={setViewItem} />)}
              </div>
            </div>
          )}
          {datasets.length > 0 && (
            <div>
              <div style={subHead}><Database size={13} /> Datasets</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {datasets.map(it => <ItemLine key={it.id} item={it} onView={setViewItem} />)}
              </div>
            </div>
          )}
          {total === 0 && !hasDesc && (
            <div style={{ fontSize: 12.5, color: C.faint }}>No files, links or datasets yet — use Edit to add some.</div>
          )}
        </div>
      )}

      {viewItem && <FileViewer row={viewItem} onClose={() => setViewItem(null)} />}
    </div>
  );
}
const subHead = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700,
  color: C.muted, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 };

/* domain logo with graceful fallback */
function DomainLogo({ domain, size = 48 }) {
  const [err, setErr] = useState(false);
  const src = `https://cit2.internshipstudio.com/assets/img/istudio/icons/${domain.short_name}.webp`;
  if (err || !domain.short_name) {
    return (
      <span style={{ width: size, height: size, borderRadius: 12, flexShrink: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: C.accentSoft, color: C.accent,
        fontSize: size * 0.4, fontWeight: 700 }}>
        {(domain.name || '?').charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <img src={src} alt="" onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: 12, objectFit: 'cover', flexShrink: 0,
        border: `1px solid ${C.line}`, background: '#fff' }} />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════════ */
export default function ProblemStatements() {
  const { internshipId } = useParams();   // domain id from the URL (refresh-safe)
  const navigate = useNavigate();
  const cached = readDomainsCache();
  const [domains, setDomains] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);  // cached → render instantly
  const [q, setQ] = useState('');
  const hadCache = useRef(!!cached);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const d = await Api.domains();
      const list = d.domains || [];
      setDomains(list);
      writeDomainsCache(list);
    } catch (e) { if (!silent) toast.error(e.message || 'Failed to load domains'); }
    finally { setLoading(false); }
  }, []);

  // first paint uses the cache; always revalidate in the background
  useEffect(() => { load(hadCache.current); }, [load]);

  const onCountChange = useCallback((id, count) => {
    setDomains(prev => {
      const next = prev.map(d => d.internship_id === id ? { ...d, count } : d);
      writeDomainsCache(next);
      return next;
    });
  }, []);

  /* selected domain is derived purely from the URL — survives refresh */
  const openDomain  = (d) => navigate(`/internships/problem-statements/${d.internship_id}`);
  const closeDomain = () => navigate('/internships/problem-statements');
  const active = internshipId
    ? domains.find(d => String(d.internship_id) === String(internshipId)) || null
    : null;
  const notFound = !!internshipId && !loading && !active;

  const filtered = domains.filter(d =>
    !q.trim() || (d.name || '').toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <Helmet><title>Problem Statements | Admin Panel</title></Helmet>
      <style>{psStyles}</style>

      <div className="ps-root" style={{ background: C.bg, minHeight: 'calc(100vh - 94px)',
        borderRadius: 14, padding: '20px 22px' }}>

        {/* page header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: C.accentSoft, color: C.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FolderOpen size={22} />
          </span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: C.ink }}>Problem Statements</div>
            <div style={{ fontSize: 13, color: C.faint, marginTop: 2 }}>
              Attach problem-statement files to each internship domain
            </div>
          </div>
          {!internshipId && (
            <button onClick={() => load(false)} disabled={loading} style={{ ...ghostBtn, height: 38 }}>
              {loading ? <Spin size={15} /> : <RefreshCw size={15} />} Refresh
            </button>
          )}
        </div>

        {internshipId ? (
          active ? (
            <DomainDetail domain={active} onBack={closeDomain} onCountChange={onCountChange} />
          ) : notFound ? (
            <div style={emptyWrap}>
              <Inbox size={42} color={C.line} />
              <div style={{ fontSize: 15, fontWeight: 700, color: C.body, marginTop: 12 }}>Domain not found</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>It may have been removed or is no longer open.</div>
              <button onClick={closeDomain} style={{ ...ghostBtn, height: 38, margin: '16px auto 0' }}>
                <ArrowLeft size={16} /> Back to all domains
              </button>
            </div>
          ) : (
            <div style={emptyWrap}><Spin size={26} /><div style={{ marginTop: 12 }}>Loading domain…</div></div>
          )
        ) : (
          <>
            {/* search */}
            <div style={{ position: 'relative', maxWidth: 360, marginBottom: 18 }}>
              <Search size={16} color={C.faint}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search domains…"
                style={{ width: '100%', height: 40, padding: '0 14px 0 38px', borderRadius: 10,
                  border: `1px solid ${C.line}`, background: '#fff', fontSize: 13.5, color: C.ink, outline: 'none' }}
                onFocus={focusBorder} onBlur={blurBorder} />
            </div>

            {loading ? (
              <div style={emptyWrap}><Spin size={26} /><div style={{ marginTop: 12 }}>Loading domains…</div></div>
            ) : !filtered.length ? (
              <div style={emptyWrap}>
                <Inbox size={42} color={C.line} />
                <div style={{ fontSize: 15, fontWeight: 700, color: C.body, marginTop: 12 }}>
                  {q ? 'No domains match your search' : 'No domains found'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                {filtered.map(d => (
                  <button key={d.internship_id} onClick={() => openDomain(d)} className="ps-domain-card"
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, textAlign: 'left',
                      borderRadius: 14, border: `1px solid ${C.line}`, background: '#fff', cursor: 'pointer' }}>
                    <DomainLogo domain={d} size={48} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        {d.count > 0 ? (
                          <span style={{ ...chip, background: C.accentSoft, color: C.accent,
                            display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={12} /> {d.count} attached
                          </span>
                        ) : (
                          <span style={{ ...chip }}>None yet</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={18} color={C.faint} style={{ flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   small presentational helpers + shared styles
═══════════════════════════════════════════════════════════════════════════ */
function Field({ label, optional, required, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.body, textTransform: 'uppercase',
          letterSpacing: '.04em' }}>{label}</span>
        {required && <span style={{ fontSize: 10.5, fontWeight: 700, color: C.danger,
          background: C.dangerSoft, padding: '1px 7px', borderRadius: 20 }}>Required</span>}
        {optional && <span style={{ fontSize: 10.5, fontWeight: 600, color: C.faint,
          background: C.line2, padding: '1px 7px', borderRadius: 20 }}>Optional</span>}
      </div>
      {children}
    </div>
  );
}

function ConfirmDelete({ name, busy, onCancel, onConfirm }) {
  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 26, maxWidth: 410, width: '100%',
        textAlign: 'center', boxShadow: '0 24px 70px rgba(15,23,42,.25)' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.dangerSoft, margin: '0 auto 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Trash2 size={24} color={C.danger} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Delete this entry?</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 22 }}>
          “{name}” will be removed. This cannot be undone.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={onCancel} disabled={busy} style={ghostBtn}>Cancel</button>
          <button onClick={onConfirm} disabled={busy} style={dangerBtn}>
            {busy ? <Spin size={15} color="#fff" /> : <Trash2 size={15} />} Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* shared inline styles */
const inputS = { width: '100%', height: 42, padding: '0 14px', borderRadius: 10,
  border: `1px solid ${C.line}`, background: '#fff', fontSize: 14, color: C.ink, outline: 'none', fontFamily: 'inherit' };
const focusBorder = (e) => { e.target.style.borderColor = C.accent; e.target.style.boxShadow = `0 0 0 3px ${C.accentSoft}`; };
const blurBorder  = (e) => { e.target.style.borderColor = C.line; e.target.style.boxShadow = 'none'; };

const primaryBtn = { display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 18px',
  borderRadius: 10, border: 'none', background: C.accent, color: '#fff', fontSize: 13.5, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit' };
const ghostBtn = { display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, padding: '0 15px',
  borderRadius: 10, border: `1px solid ${C.line}`, background: '#fff', color: C.body, fontSize: 13,
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const dangerBtn = { display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, padding: '0 18px',
  borderRadius: 10, border: 'none', background: C.danger, color: '#fff', fontSize: 13.5, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit' };
const iconBtn = { width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.line}`, background: '#fff',
  color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 };
const iconBtnSubtle = (active) => ({ width: 34, height: 34, borderRadius: 9,
  border: `1px solid ${active ? C.accentLine : C.line}`, background: active ? C.accentSoft : '#fff',
  color: active ? C.accent : C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', flexShrink: 0 });
const iconBtnDanger = { width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.dangerLine}`,
  background: C.dangerSoft, color: C.danger, display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', flexShrink: 0 };
const chip = { fontSize: 11, fontWeight: 600, color: C.muted, background: C.line2,
  padding: '2px 9px', borderRadius: 20 };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16 };
const emptyWrap = { textAlign: 'center', padding: '70px 20px', color: C.faint };

const psStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  .ps-root, .ps-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',system-ui,sans-serif; }
  @keyframes ps-spin { to { transform:rotate(360deg); } }
  .ps-domain-card { transition:border-color .15s, box-shadow .15s, transform .15s; }
  .ps-domain-card:hover { border-color:#c7d2fe; box-shadow:0 6px 20px rgba(79,70,229,.10); transform:translateY(-2px); }
  [contenteditable][data-ph]:empty:before { content:attr(data-ph); color:#94a3b8; pointer-events:none; }
  [contenteditable] h2 { font-size:1.3em; font-weight:700; margin:12px 0 6px; color:#0f172a; }
  [contenteditable] blockquote, .ps-rich blockquote { border-left:3px solid #4f46e5; margin:10px 0; padding:6px 14px; background:#eef2ff; border-radius:0 8px 8px 0; color:#475569; }
  [contenteditable] a, .ps-rich a { color:#4f46e5; }
  [contenteditable] ul, [contenteditable] ol, .ps-rich ul, .ps-rich ol { padding-left:22px; margin:6px 0; }
  [contenteditable] img, .ps-rich img { max-width:100%; border-radius:8px; }
  .ps-tbl, .ps-rich table { border-collapse:collapse; width:100%; margin:8px 0; }
  .ps-tbl th, .ps-tbl td, .ps-rich th, .ps-rich td { border:1px solid #cbd5e1; padding:6px 9px; font-size:13px; }
  .ps-tbl th, .ps-rich th { background:#f1f5f9; font-weight:700; text-align:left; }
`;
