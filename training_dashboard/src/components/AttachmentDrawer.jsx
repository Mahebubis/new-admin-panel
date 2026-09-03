// ===========================================================================
//  AttachmentDrawer.jsx — the "Download Attachments" sheet.
//
//  The syllabus rail already tells a learner which lessons carry files, but
//  the "Attachment" chip under a lesson title was decoration: the only way to
//  actually reach a PDF was to open the lesson and hunt for it on the stage.
//  Tapping the chip now drops this sheet in from the top of the screen with
//  every file on that lesson listed, each with its own Download.
//
//  It comes from the TOP on purpose. The rail sits on the right on desktop
//  and under the video on a phone, so a bottom sheet would cover the row that
//  was just tapped on one of them; the top edge is the one place that reads
//  the same on both.
//
//  Downloading
//    <a download> is only honoured for same-origin files — lesson files live
//    on S3 / the Learnyst CDN, where the browser ignores the attribute and
//    opens the file in a tab instead. So the file is fetched into a blob
//    first and saved from there, which does produce a real download under the
//    right name; only when the CDN refuses the cross-origin read do we fall
//    back to the plain link.
// ===========================================================================
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Attachment, Download, ExternalLink, Pdf } from './icons';
import './attachmentDrawer.css';

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'];

const extOf = (url = '') => {
  const bare = String(url).split(/[?#]/)[0];
  const dot = bare.lastIndexOf('.');
  return dot === -1 ? '' : bare.slice(dot + 1).toLowerCase();
};

/** "2.4 MB" — the API sends bytes and nobody reads bytes. */
function size(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/* Uploaded names carry the uploader's uniquifier ("M7L3_lyst5116.pptx") —
   the learner did not choose it and it buries the part they read. */
const tidy = (name) => String(name).replace(/_lyst\d+(?=\.[a-z0-9]+$)/i, '');

/** What the row shows, and what the saved file is called. */
function nameOf(doc, i) {
  const raw = doc.file_name || doc.title || '';
  if (raw) return tidy(raw);
  const tail = decodeURIComponent(String(doc.url || '').split(/[?#]/)[0].split('/').pop() || '');
  return tidy(tail) || `File ${i + 1}`;
}

export default function AttachmentDrawer({ lesson, onClose }) {
  const [busy, setBusy] = useState(() => new Set());

  useEffect(() => {
    if (!lesson) return undefined;

    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);

    /* Freeze the page behind it, paying back the scrollbar width so nothing
       jumps sideways as the sheet opens. */
    const { body } = document;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;

    return () => {
      document.removeEventListener('keydown', onKey);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
    };
  }, [lesson, onClose]);

  if (!lesson) return null;

  const files = (lesson.attachments || []).filter((a) => a?.url);
  const count = files.length;

  const mark = (id, on) => setBusy((prev) => {
    const n = new Set(prev);
    if (on) n.add(id); else n.delete(id);
    return n;
  });

  const hit = (href, name) => {
    const a = document.createElement('a');
    a.href = href;
    if (name) a.download = name;
    a.rel = 'noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const save = async (doc, i) => {
    const key = doc.id ?? doc.url;
    const name = nameOf(doc, i);
    mark(key, true);
    try {
      const res = await fetch(doc.url, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      hit(href, name);
      setTimeout(() => URL.revokeObjectURL(href), 10000);
    } catch {
      /* The CDN sends no CORS header. The bare link still gets the learner
         the file — the browser saves it, or opens it in a tab by type. */
      hit(doc.url, name);
    } finally {
      mark(key, false);
    }
  };

  /* One at a time and spaced out: a browser drops a burst of programmatic
     downloads fired from a single click. */
  const saveAll = async () => {
    for (let i = 0; i < files.length; i += 1) {
      await save(files[i], i);
      await new Promise((r) => { setTimeout(r, 400); });
    }
  };

  /* Portalled to <body>, and it has to be. The rail this is rendered from is
     `position: sticky`, which makes it a stacking context of its own — so a
     z-index of 4200 in here was still only 4200 *inside the rail*, and the
     stage's own floating controls (bookmark, kebab; z-index 6, but anchored
     to the page) and the sticky header painted straight through the sheet.
     At the top of <body> there is nothing left to lose to. */
  return createPortal(
    <div
      className="att"
      role="dialog"
      aria-modal="true"
      aria-label="Download attachments"
      onClick={onClose}
    >
      {/* stopPropagation so a click inside the sheet does not dismiss it —
          only the backdrop around it does. */}
      <div className="att-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="att-x" onClick={onClose} aria-label="Close">×</button>

        <div className="att-head">
          <h3 className="att-title">Download Attachments</h3>
          <p className="att-sub">
            {lesson.title}
            {count > 0 && <> — {count} attachment{count === 1 ? '' : 's'}</>}
          </p>
        </div>

        {count === 0 ? (
          <p className="att-none">Nothing has been attached to this lesson.</p>
        ) : (
          <div className="att-list">
            {files.map((doc, i) => {
              const key = doc.id ?? doc.url;
              const ext = extOf(doc.url);
              const name = nameOf(doc, i);
              const working = busy.has(key);
              const meta = [ext ? ext.toUpperCase() : '', size(doc.file_size)].filter(Boolean).join(' · ');
              return (
                <div className="att-row" key={key}>
                  <span className="att-ico">
                    {ext === 'pdf' || IMAGE_EXT.includes(ext)
                      ? <Pdf size={18} />
                      : <Attachment size={18} />}
                  </span>

                  <span className="att-name">
                    <span className="att-file">{name}</span>
                    {meta && <em className="att-meta">{meta}</em>}
                  </span>

                  <a
                    className="att-open"
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    title="Open in a new tab"
                    aria-label={`Open ${name} in a new tab`}
                  >
                    <ExternalLink size={15} />
                  </a>

                  <button
                    type="button"
                    className="att-dl"
                    onClick={() => save(doc, i)}
                    disabled={working}
                  >
                    <Download size={17} />
                    <span>{working ? 'Downloading…' : 'Download'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {count > 1 && (
          <div className="att-foot">
            <button type="button" className="att-all" onClick={saveAll} disabled={busy.size > 0}>
              <Download size={16} /> Download all {count} files
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
