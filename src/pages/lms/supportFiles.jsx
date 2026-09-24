// ===========================================================================
//  supportFiles.jsx — what the Support chat does with a file and with text.
//
//    fileKind()        one place that decides how a file is shown
//    Attachment        the thing inside a message bubble
//    FilePreview       the full-screen viewer an attachment opens into
//    Linkified         message text with every URL / email turned into a link
//
//  Preview strategy, per kind:
//    image           inline thumbnail, full size in the viewer
//    video / audio   the browser's own player (mkv plays where the codec is
//                    H.264/VP9 — Chrome and Edge do; a failure falls back to
//                    a download button instead of a black box)
//    pdf             the browser's PDF viewer in an iframe
//    office          Microsoft's Office Online viewer — it only needs a public
//                    URL, which S3 and the portal's uploads both are
//    csv / text      fetched and rendered here; S3/portal CORS can refuse the
//                    fetch, so the fallback is Google's document viewer
//    archive         cannot be opened in a browser — a card and a download
// ===========================================================================
import React, { useEffect, useMemo, useState } from 'react';
import { extOf, fileKind, fileSize } from './supportUtils';
import {
  X, Download, ExternalLink, FileText, FileSpreadsheet, FileVideo, FileAudio,
  FileArchive, File as FileIcon, Image as ImageIcon, Maximize2,
} from 'lucide-react';

const KIND_ICON = {
  image: ImageIcon, video: FileVideo, audio: FileAudio, pdf: FileText, sheet: FileSpreadsheet,
  office: FileSpreadsheet, text: FileText, archive: FileArchive, other: FileIcon,
};
const KIND_TONE = {
  image: '#7a5af8', video: '#ee46bc', audio: '#f79009', pdf: '#f04438', sheet: '#12b76a',
  office: '#2e90fa', text: '#667085', archive: '#b54708', other: '#667085',
};

export function KindIcon({ name, type, size = 18 }) {
  const k = fileKind(name, type);
  const I = KIND_ICON[k] || FileIcon;
  return <I size={size} color={KIND_TONE[k]} />;
}

/* ── links in text ─────────────────────────────────────────────────────── */
const LINK_RE = /((?:https?:\/\/|www\.)[^\s<>"']+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

/** Plain text → text + <a> nodes. Trailing punctuation stays outside the link. */
export function Linkified({ text, className = 'sp-link' }) {
  const parts = useMemo(() => {
    const out = [];
    const s = String(text || '');
    let last = 0;
    s.replace(LINK_RE, (m, _g, idx) => {
      let url = m;
      let tail = '';
      while (/[.,!?;:)\]}'"]$/.test(url)) { tail = url.slice(-1) + tail; url = url.slice(0, -1); }
      if (idx > last) out.push(s.slice(last, idx));
      const isMail = !/^(https?:\/\/|www\.)/i.test(url);
      const href = isMail ? `mailto:${url}` : (/^www\./i.test(url) ? `https://${url}` : url);
      out.push({ href, label: url });
      if (tail) out.push(tail);
      last = idx + m.length;
      return m;
    });
    if (last < s.length) out.push(s.slice(last));
    return out;
  }, [text]);

  return parts.map((p, i) => (typeof p === 'string'
    ? <React.Fragment key={i}>{p}</React.Fragment>
    : (
      <a key={i} className={className} href={p.href} target="_blank" rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}>
        {p.label}
      </a>
    )));
}

/* ── an attachment inside a bubble ─────────────────────────────────────── */
export function Attachment({ m, onPreview, onMediaLoad }) {
  const kind = fileKind(m.file_name, m.file_type);
  const [broken, setBroken] = useState(false);
  const label = m.file_name || 'Attachment';

  if (kind === 'image' && !broken) {
    return (
      <button type="button" className="sp-att-img" onClick={() => onPreview(m)} title={`Preview ${label}`}>
        <img src={m.file_url} alt={label} onLoad={onMediaLoad} onError={() => setBroken(true)} />
        <span className="sp-att-zoom"><Maximize2 size={14} /></span>
      </button>
    );
  }

  if ((kind === 'video' || kind === 'audio') && !broken) {
    return (
      <div className="sp-att-media">
        {kind === 'video' ? (
          <video src={m.file_url} controls preload="metadata" onLoadedMetadata={onMediaLoad}
            onError={() => setBroken(true)} />
        ) : (
          <audio src={m.file_url} controls preload="metadata" onError={() => setBroken(true)} />
        )}
        <div className="sp-att-media-bar">
          <KindIcon name={m.file_name} type={m.file_type} size={14} />
          <span className="sp-att-name">{label}</span>
          {m.file_size > 0 && <span className="sp-att-size">{fileSize(m.file_size)}</span>}
          <a href={m.file_url} target="_blank" rel="noreferrer" download title="Download"><Download size={14} /></a>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-att-card">
      <span className="sp-att-ico"><KindIcon name={m.file_name} type={m.file_type} size={20} /></span>
      <div className="sp-att-meta">
        <span className="sp-att-name" title={label}>{label}</span>
        <span className="sp-att-size">
          {(extOf(label) || kind).toUpperCase()}{m.file_size > 0 ? ` · ${fileSize(m.file_size)}` : ''}
          {broken && ' · cannot play here'}
        </span>
      </div>
      {kind !== 'archive' && kind !== 'other' && (
        <button type="button" className="sp-att-act" onClick={() => onPreview(m)}>Preview</button>
      )}
      <a className="sp-att-act" href={m.file_url} target="_blank" rel="noreferrer" download title="Download">
        <Download size={14} />
      </a>
    </div>
  );
}

/* ── CSV / text, rendered here ─────────────────────────────────────────── */
function parseCsv(text, sep) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
    if (rows.length >= 500) break;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function TextPreview({ url, kind, name }) {
  const [state, setState] = useState({ loading: true, text: '', failed: false });
  useEffect(() => {
    let alive = true;
    fetch(url, { cache: 'no-store' })
      .then(r => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then(t => alive && setState({ loading: false, text: t, failed: false }))
      .catch(() => alive && setState({ loading: false, text: '', failed: true }));
    return () => { alive = false; };
  }, [url]);

  if (state.loading) return <div className="sp-pv-note">Loading preview…</div>;
  /* The host refused a cross-origin read — let Google fetch it instead. */
  if (state.failed) {
    return <iframe className="sp-pv-frame" title={name}
      src={`https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`} />;
  }
  if (kind === 'sheet') {
    const rows = parseCsv(state.text, extOf(name) === 'tsv' ? '\t' : ',');
    const [head, ...body] = rows;
    return (
      <div className="sp-pv-table-wrap">
        <table className="sp-pv-table">
          {head && <thead><tr><th>#</th>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>}
          <tbody>
            {body.map((r, i) => (
              <tr key={i}><td>{i + 1}</td>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
        {rows.length >= 500 && <div className="sp-pv-note">Showing the first 500 rows — download for the rest.</div>}
      </div>
    );
  }
  return <pre className="sp-pv-text">{state.text.slice(0, 200000)}</pre>;
}

/* ── the full-screen viewer ────────────────────────────────────────────── */
export function FilePreview({ file, onClose }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!file) return undefined;
    /* Capture phase + stopPropagation so Escape closes the viewer, not the
       chat panel underneath it. */
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [file, onClose]);

  if (!file) return null;
  const url = file.file_url;
  const name = file.file_name || 'Attachment';
  const kind = fileKind(name, file.file_type);

  let body;
  if (failed || kind === 'archive' || kind === 'other') {
    body = (
      <div className="sp-pv-empty">
        <KindIcon name={name} type={file.file_type} size={46} />
        <strong>{name}</strong>
        <span>
          {failed
            ? 'This browser cannot play this file. Download it to open it.'
            : 'This file type cannot be previewed in the browser. Download it to open it.'}
        </span>
        <a className="lms-btn lms-btn-green" href={url} target="_blank" rel="noreferrer" download>
          <Download size={15} /> Download{file.file_size > 0 ? ` (${fileSize(file.file_size)})` : ''}
        </a>
      </div>
    );
  } else if (kind === 'image') {
    body = <img className="sp-pv-img" src={url} alt={name} onError={() => setFailed(true)} />;
  } else if (kind === 'video') {
    body = <video className="sp-pv-video" src={url} controls autoPlay onError={() => setFailed(true)} />;
  } else if (kind === 'audio') {
    body = <audio src={url} controls autoPlay onError={() => setFailed(true)} style={{ width: 'min(520px, 90%)' }} />;
  } else if (kind === 'pdf') {
    body = <iframe className="sp-pv-frame" title={name} src={url} />;
  } else if (kind === 'office') {
    body = <iframe className="sp-pv-frame" title={name}
      src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`} />;
  } else {
    body = <TextPreview url={url} kind={kind} name={name} />;
  }

  return (
    <div className="sp-pv" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="sp-pv-bar" onClick={e => e.stopPropagation()}>
        <KindIcon name={name} type={file.file_type} size={18} />
        <span className="sp-pv-name" title={name}>{name}</span>
        {file.file_size > 0 && <span className="sp-pv-size">{fileSize(file.file_size)}</span>}
        <a className="sp-pv-btn" href={url} target="_blank" rel="noreferrer" title="Open in a new tab">
          <ExternalLink size={16} />
        </a>
        <a className="sp-pv-btn" href={url} target="_blank" rel="noreferrer" download title="Download">
          <Download size={16} />
        </a>
        <button type="button" className="sp-pv-btn" onClick={onClose} title="Close (Esc)"><X size={18} /></button>
      </div>
      <div className="sp-pv-stage" onClick={e => e.stopPropagation()}>{body}</div>
    </div>
  );
}
