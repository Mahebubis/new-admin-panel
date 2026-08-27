// ===========================================================================
//  DocStage.jsx — the stage for every lesson that is NOT a video.
//
//  What it replaces
//    A PDF/article/assignment lesson used to fall through to a dark 420px slab
//    that read "This lesson has no content yet." — even when the lesson had
//    eight PDFs hanging off it, which the learner could only reach by
//    scrolling past the stage into the About tab. On a phone that slab is
//    sticky under the header, so it filled the screen with black and there was
//    nothing to dismiss it with.
//
//  What it does instead
//    Everything attached to the lesson is a document, and documents are shown
//    HERE, where the video would be:
//
//      pdf      rendered inline in the browser's own viewer
//      image    rendered inline
//      anything else / a link   a card with Open and Download
//
//    More than one attachment becomes a row of tabs across the top, so a
//    lesson like "Resume Templates" (eight PDFs) is browsed without leaving
//    the player. Rich-text article bodies render above the files.
//
//  Light, not dark
//    The video stage is near-black because video is. A document is a page of
//    text: it gets the page's own surface, which is also what makes it legible
//    in the portal's light theme instead of a white PDF glowing out of a black
//    box.
//
//  Collapsing
//    On a phone the stage is position:sticky under the header (see
//    course.css), so whatever height it has is height the learner cannot
//    scroll away. The header carries a real Hide control that folds it to a
//    single bar — the missing "close" from the bug report — and the body is
//    capped at a fraction of the viewport so it can never own the whole
//    screen in the first place.
// ===========================================================================
import { useMemo, useState } from 'react';
import { Attachment, ChevronDown, ChevronUp, Download, ExternalLink, Pdf } from './icons';
import './docstage.css';

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'];

/** The extension, lower-cased, from a URL that may carry a query string. */
function extOf(url = '') {
  const clean = String(url).split(/[?#]/)[0];
  const dot = clean.lastIndexOf('.');
  return dot === -1 ? '' : clean.slice(dot + 1).toLowerCase();
}

function kindOf(doc) {
  const ext = extOf(doc.url);
  const type = String(doc.file_type || '').toLowerCase();
  if (ext === 'pdf' || type.includes('pdf')) return 'pdf';
  if (IMAGE_EXT.includes(ext) || type.startsWith('image/')) return 'image';
  if (doc.kind === 'link') return 'link';
  return 'file';
}

/** "2.4 MB" — bytes are what the API sends and nobody reads bytes. */
function size(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** A name worth showing on a tab: the admin's title, else the file name. */
function labelOf(doc, i) {
  const raw = doc.title || doc.file_name || '';
  if (!raw) return `File ${i + 1}`;
  /* Uploaded names carry the uniquifier the uploader added
     ("Resume_Template_1_lyst1760531826956.pdf") — the learner did not choose
     it and it buries the part they read. */
  return String(raw).replace(/_lyst\d+(?=\.[a-z0-9]+$)/i, '').replace(/\.[a-z0-9]+$/i, '');
}

export default function DocStage({ lesson }) {
  const [open, setOpen] = useState(true);
  const [at, setAt] = useState(0);

  /* A PDF lesson stores its file in video_url (the admin form reuses that
     field), so it is a document like any other and goes first in the list. */
  const docs = useMemo(() => {
    const list = [];
    if (lesson?.type === 'pdf' && lesson?.video?.src) {
      list.push({ id: 'primary', title: lesson.title, url: lesson.video.src, kind: 'file' });
    }
    (lesson?.attachments || []).forEach((a) => {
      if (!a?.url) return;
      if (list.some((d) => d.url === a.url)) return;      // the same file twice
      list.push(a);
    });
    return list;
  }, [lesson]);

  /* A new lesson starts at its first document rather than at whatever index
     the previous lesson happened to be on. */
  const [seenId, setSeenId] = useState(lesson?.id || 0);
  if (seenId !== (lesson?.id || 0)) {
    setSeenId(lesson?.id || 0);
    setAt(0);
    setOpen(true);
  }

  const doc = docs[Math.min(at, docs.length - 1)] || null;
  const kind = doc ? kindOf(doc) : null;
  const html = lesson?.content || '';

  const empty = !doc && !html;

  return (
    <div className={`doc${open ? '' : ' doc-closed'}`}>
      <div className="doc-bar">
        <span className="doc-ico">{lesson?.type === 'pdf' ? <Pdf size={18} /> : <Attachment size={18} />}</span>
        <div className="doc-heading">
          <div className="doc-title">{lesson?.title || 'Lesson'}</div>
          <div className="doc-sub">
            {docs.length > 0
              ? `${docs.length} ${docs.length === 1 ? 'file' : 'files'}${size(doc?.file_size) ? ` · ${size(doc.file_size)}` : ''}`
              : (html ? 'Reading' : 'No files attached')}
          </div>
        </div>

        {doc && (
          <div className="doc-acts">
            <a className="doc-act" href={doc.url} target="_blank" rel="noreferrer" title="Open in a new tab">
              <ExternalLink size={16} /><span>Open</span>
            </a>
            {/* `download` is a hint the browser honours for same-origin files
                and ignores for S3 — either way the file opens, which is the
                outcome that matters. */}
            <a className="doc-act" href={doc.url} download target="_blank" rel="noreferrer" title="Download">
              <Download size={16} /><span>Download</span>
            </a>
          </div>
        )}

        {/* The control the sticky mobile stage had no way of offering. */}
        <button
          type="button"
          className="doc-fold"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? 'Hide this lesson panel' : 'Show this lesson panel'}
        >
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          <span>{open ? 'Hide' : 'Show'}</span>
        </button>
      </div>

      {open && (
        <div className="doc-body">
          {docs.length > 1 && (
            <div className="doc-tabs" role="tablist">
              {docs.map((d, i) => (
                <button
                  key={d.id ?? i}
                  role="tab"
                  aria-selected={i === at}
                  className={`doc-tab${i === at ? ' on' : ''}`}
                  onClick={() => setAt(i)}
                  title={d.title || d.file_name}
                >
                  {labelOf(d, i)}
                </button>
              ))}
            </div>
          )}

          {html && (
            <div className="doc-rich rich" dangerouslySetInnerHTML={{ __html: html }} />
          )}

          {kind === 'pdf' && (
            /* An <iframe> rather than <object>: iOS Safari renders only the
               first page of an embedded PDF, and the frame at least scrolls.
               The fallback link below it is what a browser with no viewer at
               all falls back to. */
            <div className="doc-frame-wrap">
              <iframe
                key={doc.url}
                className="doc-frame"
                src={`${doc.url}#view=FitH`}
                title={labelOf(doc, at)}
              />
              <p className="doc-fallback">
                Can’t see the document?{' '}
                <a href={doc.url} target="_blank" rel="noreferrer">Open it in a new tab</a>.
              </p>
            </div>
          )}

          {kind === 'image' && (
            <div className="doc-image-wrap">
              <img className="doc-image" src={doc.url} alt={labelOf(doc, at)} />
            </div>
          )}

          {(kind === 'file' || kind === 'link') && (
            <div className="doc-card">
              <span className="doc-card-ico"><Attachment size={22} /></span>
              <div className="doc-card-text">
                <div className="doc-card-name">{doc.title || doc.file_name || doc.url}</div>
                <div className="doc-card-sub">
                  {kind === 'link' ? 'External link' : `${(extOf(doc.url) || 'file').toUpperCase()} file`}
                  {size(doc.file_size) ? ` · ${size(doc.file_size)}` : ''}
                </div>
              </div>
              <a className="btn btn-dark doc-card-btn" href={doc.url} target="_blank" rel="noreferrer">
                {kind === 'link' ? 'Open link' : 'Open file'}
              </a>
            </div>
          )}

          {empty && (
            <div className="doc-empty">
              <Attachment size={26} />
              <p>Nothing has been attached to this lesson yet.</p>
              <span>Your instructor adds notes and files here — check back, or move on to the next lesson.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
