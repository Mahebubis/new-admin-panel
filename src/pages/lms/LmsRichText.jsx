// ===========================================================================
//  LmsRichText.jsx — the rich-text editor + its matching renderer.
//
//  Self-hosted TinyMCE, served from public/tinymce. The cloud build is not an
//  option here: its key is domain-locked and the panel runs on several hosts
//  (localhost, cit3, the live admin), so a cloud editor shows a "this domain
//  is not registered" banner on most of them. The vendored GPL build has no
//  key and no domain check — see src/pages/blogs/AddBlog.jsx, which does the
//  same thing for blog posts.
//
//  <RichText>     the editor
//  <RichHtml>     renders what the editor produced, with the same typography
//
//  Every instance needs its OWN id: two editors on one screen (a quiz's
//  description and its instructions, say) would otherwise both bind to the
//  same textarea and the second would silently win.
// ===========================================================================
import React, { useEffect, useId, useRef, useState } from 'react';

const TINYMCE_SRC = '/tinymce/tinymce.min.js';

/* Loading the script twice gives two copies of the global and a race over who
   initialises first, so concurrent callers share one promise. */
let tinyPromise = null;
function loadTiny() {
  if (window.tinymce) return Promise.resolve(window.tinymce);
  if (tinyPromise) return tinyPromise;
  tinyPromise = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = TINYMCE_SRC;
    el.referrerPolicy = 'origin';
    el.onload = () => resolve(window.tinymce);
    el.onerror = () => { tinyPromise = null; reject(new Error('Could not load the editor')); };
    document.head.appendChild(el);
  });
  return tinyPromise;
}

export function RichText({ value = '', onChange, height = 260, placeholder = '', compact = false }) {
  /* useId gives a stable, collision-free id per mounted instance. */
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = `lms-rte-${uid}`;
  const editorRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let dead = false;

    loadTiny().then((tinymce) => {
      if (dead || !tinymce) return;
      /* A hot reload can leave the previous instance bound to this id. */
      tinymce.get(id)?.remove?.();

      tinymce.init({
        selector: `#${id}`,
        license_key: 'gpl',   // self-hosted GPL build — no cloud key
        base_url: '/tinymce',
        suffix: '.min',
        height,
        menubar: compact ? false : 'edit view format table',
        branding: false,
        resize: true,
        placeholder,
        plugins: [
          'lists advlist link image media table code codesample',
          'searchreplace visualblocks charmap emoticons fullscreen',
          'insertdatetime nonbreaking pagebreak anchor autolink',
          'directionality wordcount preview accordion quickbars help',
        ].join(' '),
        toolbar: compact
          ? 'bold italic underline | bullist numlist | link | removeformat code'
          : 'undo redo | blocks fontfamily fontsize | '
            + 'bold italic underline strikethrough | forecolor backcolor | '
            + 'alignleft aligncenter alignright alignjustify | '
            + 'bullist numlist outdent indent | blockquote hr | '
            + 'link image media table codesample | '
            + 'charmap emoticons | searchreplace visualblocks | '
            + 'removeformat preview fullscreen code help',
        /* The bubble toolbar on a selection, the way Notion-style editors do it. */
        quickbars_selection_toolbar: 'bold italic underline | quicklink h2 h3 blockquote',
        quickbars_insert_toolbar: false,
        contextmenu: 'link image table',
        font_size_formats: '11px 12px 13px 14px 16px 18px 24px 32px 48px',
        block_formats: 'Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; '
                     + 'Heading 4=h4; Preformatted=pre; Blockquote=blockquote',
        /* Pasting from Word/Docs otherwise drags in a wall of inline styles
           and mso- attributes that then render differently everywhere. */
        paste_as_text: false,
        paste_data_images: true,
        /* Images are stored inline as data URIs. The LMS has no editor upload
           endpoint, and a base64 thumbnail in a quiz description beats a
           broken <img> pointing at someone's local disk. */
        automatic_uploads: false,
        image_caption: true,
        link_default_target: '_blank',
        content_style:
          "body{font-family:'Poppins','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"
          + 'font-size:14px;line-height:1.7;color:#16191d;}'
          + 'blockquote{border-left:3px solid #12b76a;margin:1em 0;padding:.2em 1em;color:#5b6472;}'
          + 'pre{background:#f6f7f9;padding:12px;border-radius:8px;overflow:auto;}'
          + 'img{max-width:100%;height:auto;}'
          + 'table{border-collapse:collapse;}'
          + 'table td,table th{border:1px solid #e4e7ec;padding:6px 10px;}',
        setup: (editor) => {
          editorRef.current = editor;
          /* Write back on every meaningful edit, not only on blur — a dialog
             that saves while the editor still has focus would otherwise drop
             whatever was typed last. */
          const push = () => onChangeRef.current?.(editor.getContent());
          editor.on('change keyup undo redo SetContent ExecCommand', push);
        },
        init_instance_callback: (editor) => {
          if (value) editor.setContent(value);
        },
      }).catch(() => { if (!dead) setFailed(true); });
    }).catch(() => { if (!dead) setFailed(true); });

    return () => {
      dead = true;
      window.tinymce?.get?.(id)?.remove?.();
      editorRef.current = null;
    };
    /* Mount-only on purpose: re-initialising on every keystroke would fight
       the editor for control of its own content. Later `value` changes from
       outside are pushed in by the effect below instead. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Only sync inward when the two have genuinely diverged (loading a record
     into an open dialog). Setting content the editor already has moves the
     caret to the start mid-typing. */
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || !ed.initialized) return;
    if ((value || '') !== ed.getContent()) ed.setContent(value || '');
  }, [value]);

  if (failed) {
    return (
      <>
        <textarea
          className="lms-textarea"
          style={{ minHeight: height }}
          value={value}
          placeholder={placeholder}
          onChange={e => onChange?.(e.target.value)}
        />
        <p className="lms-help" style={{ color: 'var(--lms-amber-dark)' }}>
          The rich-text editor could not load — this is a plain text box for now.
        </p>
      </>
    );
  }

  return (
    <div className="lms-rte">
      <textarea id={id} defaultValue={value} />
    </div>
  );
}

/**
 * Renders editor output.
 *
 * The HTML comes from an authenticated admin through TinyMCE, which is the
 * same trust level as every other field on these screens, so it is rendered
 * as-is. Scripts are stripped anyway — TinyMCE's schema drops <script> and
 * on* attributes on the way in — and the strip below is a cheap second pass
 * for anything that reached the column by another route (a direct DB edit, an
 * import). It is NOT a substitute for sanitising untrusted input: if learner
 * submissions are ever rendered here, put a real sanitiser in front.
 */
export function RichHtml({ html, className = '', style }) {
  if (!html) return null;
  const clean = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  return (
    <div
      className={`lms-rich ${className}`.trim()}
      style={style}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

export default RichText;
