/*
 * src/pages/freshdesk/components/AttachmentPreview.jsx
 *
 * A lightbox for anything attached to a ticket.
 *
 * WHAT CAN ACTUALLY BE PREVIEWED, and why the rest cannot:
 *   images      <img>, with zoom + rotate.
 *   pdf         <iframe> — every target browser has a built-in viewer.
 *   text/csv    fetched and shown as text; CSV is rendered as a table.
 *   code        the same text viewer; a .sql or .json IS the message often
 *               enough to be worth reading without downloading it.
 *   audio/video the browser's own player — it can decode these natively, so
 *               refusing to preview them was simply wrong.
 *   zip         listed (names and sizes) with JSZip, loaded on demand.
 *   archive     rar/7z/tar/gz: named and offered for download -- no browser
 *               library reads them.
 *   sheets      .xlsx/.xls/.ods parsed with SheetJS, which the panel already
 *               loads on demand to WRITE exports. Multi-sheet workbooks get
 *               tabs.
 *   docx        converted to HTML in the browser with mammoth (on demand).
 *   doc/slides  .doc/.rtf/.odt/.ppt/.pptx through Microsoft's Office viewer,
 *               from the file's signed, time-limited link.
 *   other       sniffed: shown as text if it reads as text, else a Download.
 *
 * Every viewer fetches from the DOWNLOAD url (see useBytes) and every failure
 * ends in a message with a Download button -- never a blank or blocked frame.
 *
 * The whole gallery is navigable with arrow keys, because an agent looking at a
 * customer's five screenshots should not have to close and reopen four times.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  X, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw,
  FileText, FileSpreadsheet, File as FileIcon, Loader2,
  FileArchive, FileAudio, FileVideo, FileCode, Presentation, Image as ImageIcon,
} from "lucide-react";
import { fdUrl } from "../fdApi";
import { Portal, loadXLSX } from "../fdShared";

const IMAGE_RE = /^image\/(png|jpe?g|gif|webp|bmp|avif|svg\+xml)$/i;
const TEXT_RE  = /^(text\/(plain|csv|markdown)|application\/(json|xml))/i;

/*
 * What a file IS, decided by its MIME type first and its extension second.
 * Mail clients set the type inconsistently -- plenty send everything as
 * application/octet-stream -- so the extension has to be able to answer on
 * its own.
 */
const extOf = (name) => {
  const n = String(name || "").toLowerCase();
  return n.includes(".") ? n.split(".").pop() : "";
};

export function kindOf(att) {
  const mime = String(att.mime || "").toLowerCase();
  const ext = extOf(att.name);

  if (IMAGE_RE.test(mime) || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif", "svg", "ico", "heic", "heif", "tif", "tiff"].includes(ext)) return "image";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (/^audio\//.test(mime) || ["mp3", "wav", "ogg", "m4a", "aac", "flac", "oga", "opus", "weba", "amr", "wma", "aiff"].includes(ext)) return "audio";
  if (/^video\//.test(mime) || ["mp4", "m4v", "webm", "ogv", "mov", "mkv", "3gp", "3g2", "avi", "wmv", "flv", "mpeg", "mpg", "ts", "mts"].includes(ext)) return "video";
  if (ext === "zip" || /^application\/(x-)?zip/.test(mime)) return "zip";
  if (["rar", "7z", "tar", "gz", "tgz", "bz2", "xz"].includes(ext)
      || /^application\/(x-rar|x-7z|x-tar|gzip)/.test(mime)) return "archive";
  if (["js", "jsx", "ts", "tsx", "css", "html", "htm", "php", "py", "java", "sql", "sh", "yml", "yaml", "ini", "env"].includes(ext)) return "code";
  if (TEXT_RE.test(mime) || ["txt", "csv", "tsv", "log", "json", "xml", "md"].includes(ext)) return "text";
  if (ext === "docx") return "docx";
  if (["doc", "odt", "rtf"].includes(ext)) return "doc";
  if (["xls", "xlsx", "xlsm", "ods"].includes(ext)) return "sheet";
  if (["ppt", "pptx", "pps", "ppsx", "odp"].includes(ext)) return "slides";
  return "other";
}

export const ICON = {
  image: ImageIcon, pdf: FileText, doc: FileText, docx: FileText, sheet: FileSpreadsheet,
  slides: Presentation, text: FileText, code: FileCode, archive: FileArchive, zip: FileArchive,
  audio: FileAudio, video: FileVideo, other: FileIcon,
};

/* The colour each kind wears, so a PDF and a spreadsheet are told apart at a
   glance rather than read one at a time. */
export const KIND_COLOR = {
  image: "#0EA5E9", pdf: "#DC2626", doc: "#2563EB", docx: "#2563EB", sheet: "#16A34A",
  slides: "#EA580C", text: "#64748B", code: "#7C3AED", archive: "#A16207", zip: "#A16207",
  audio: "#DB2777", video: "#9333EA", other: "#64748B",
};

/* A library from the CDN, fetched the first time a file needs it -- the same
   way SheetJS already is, so none of these weigh on the bundle. */
const scriptPromises = {};
function loadScript(src, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  if (!scriptPromises[src]) {
    scriptPromises[src] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => (window[globalName] ? resolve(window[globalName]) : reject(new Error(`${globalName} did not load`)));
      s.onerror = () => { delete scriptPromises[src]; reject(new Error(`Could not load ${globalName}`)); };
      document.head.appendChild(s);
    });
  }
  return scriptPromises[src];
}
const loadMammoth = () => loadScript("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js", "mammoth");
const loadJSZip = () => loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js", "JSZip");

/*
 * The file's bytes, from the DOWNLOAD url.
 *
 * Not the view url: for a file in S3 that one redirects to the bucket, and a
 * script can only read the answer if the bucket allows this origin -- which it
 * need not. The download action streams the bytes through our own API, which
 * sends CORS for the panel, so this works wherever the file is stored.
 */
function useBytes(url) {
  const [state, setState] = useState({ loading: true, buf: null, error: null });
  useEffect(() => {
    let alive = true;
    setState({ loading: true, buf: null, error: null });
    fetch(url, { credentials: "omit" })
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((buf) => alive && setState({ loading: false, buf, error: null }))
      .catch((e) => alive && setState({ loading: false, buf: null, error: e.message || "Could not fetch the file" }));
    return () => { alive = false; };
  }, [url]);
  return state;
}

const Spin = ({ label }) => <div className="ap-empty"><Loader2 size={20} className="spin" /> {label}</div>;

/* What the viewer says when a file genuinely cannot be shown in a browser --
   always with the way out, never an empty grey box. */
function NoPreview({ Ic, name, why, dl, children }) {
  return (
    <div className="ap-empty ap-nopreview">
      <Ic size={44} />
      <h4>{name}</h4>
      <p>{why}</p>
      <div className="ap-actions">
        <a className="btn btn-primary btn-sm" href={dl} download={name}><Download size={14} /> Download</a>
        {children}
      </div>
    </div>
  );
}

/*
 * PDF: the fetched bytes as a blob, shown by the browser's own viewer.
 *
 * The old frame pointed at the file with a sandbox attribute -- and Chrome's
 * PDF viewer refuses to run inside a sandboxed frame, which is the "This page
 * has been blocked by Chrome" agents saw. The blob is typed application/pdf
 * whatever the file claims, so nothing in it can run as a page of the panel.
 * If the bytes cannot be fetched, the file itself is framed, still without a
 * sandbox (it is another origin, so it cannot reach the panel anyway).
 */
function PdfViewer({ fetchUrl, directUrl, name }) {
  const { loading, buf, error } = useBytes(fetchUrl);
  const [blobUrl, setBlobUrl] = useState(null);
  useEffect(() => {
    if (!buf) return undefined;
    const u = URL.createObjectURL(new Blob([buf], { type: "application/pdf" }));
    setBlobUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [buf]);
  if (loading) return <Spin label="Opening the PDF…" />;
  if (error || !blobUrl) return <iframe title={name} src={directUrl} className="ap-frame" />;
  return <iframe title={name} src={blobUrl} className="ap-frame" />;
}

/*
 * Audio and video in the browser's own player, with its controls.
 *
 * Browsers decode MP4/H.264, WebM, Ogg, MP3, AAC, WAV and usually MOV and MKV.
 * They cannot play AVI, WMV, FLV and friends at all -- no setting changes
 * that -- so when the player reports it cannot decode the file, that is said
 * plainly with the download beside it, rather than leaving a dead player.
 */
function MediaViewer({ kind, url, dl, name, Ic }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  if (failed) {
    return <NoPreview Ic={Ic} name={name} dl={dl}
      why={`This .${extOf(name) || "file"} format cannot be played in a web browser. Download it to play it in a media player such as VLC.`} />;
  }
  if (kind === "audio") {
    return (
      <div className="ap-empty ap-media">
        <Ic size={44} />
        <h4>{name}</h4>
        {/* controlsList keeps the browser's own download button out of the
            way; ours is in the header and carries the filename. */}
        <audio key={url} src={url} controls preload="metadata" controlsList="nodownload"
               style={{ width: "min(560px, 90%)" }} onError={() => setFailed(true)} />
      </div>
    );
  }
  return (
    <video key={url} src={url} controls playsInline preload="metadata" controlsList="nodownload"
           className="ap-video" style={{ maxWidth: "100%", maxHeight: "100%" }} onError={() => setFailed(true)} />
  );
}

/* .docx, converted to HTML in the browser with mammoth -- the file never
   leaves the panel. Pictures inside come through as data: URIs. */
function DocxViewer({ fetchUrl, fallback }) {
  const { loading, buf, error } = useBytes(fetchUrl);
  const [out, setOut] = useState({ html: null, error: null });
  useEffect(() => {
    if (!buf) return undefined;
    let alive = true;
    loadMammoth()
      .then((m) => m.convertToHtml({ arrayBuffer: buf }))
      .then((res) => {
        if (!alive) return;
        // mammoth writes plain markup, but the file is a stranger's: no
        // scripts, no handlers, no script URLs survive into the panel.
        const safe = String(res.value || "")
          .replace(/<\s*(script|style|iframe|object|embed)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
          .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
          .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, "$1=$2#$2");
        setOut({ html: safe, error: null });
      })
      .catch((e) => alive && setOut({ html: null, error: e.message }));
    return () => { alive = false; };
  }, [buf]);
  if (loading || (!out.html && !out.error && !error)) return <Spin label="Opening the document…" />;
  if (error || out.error) return fallback;
  return (
    <div className="ap-doc-wrap">
      {out.html ? <div className="ap-doc" dangerouslySetInnerHTML={{ __html: out.html }} />
                : <div className="ap-empty">This document has no text to show.</div>}
    </div>
  );
}

/*
 * Old Word, RTF, OpenDocument and PowerPoint: Microsoft's Office viewer.
 * There is no browser library that renders these faithfully. The viewer reads
 * the file from its signed link, which expires on its own, and the Download
 * button is always beside it.
 */
function OfficeViewer({ publicUrl, name }) {
  return (
    <div className="ap-office">
      <iframe title={name} className="ap-frame"
              src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicUrl)}`} />
      <div className="ap-note">Shown with Microsoft's Office viewer from this file's time-limited link.</div>
    </div>
  );
}

/* A .zip, listed: what is inside and how big, without unpacking anything. */
function ZipViewer({ fetchUrl, fallback }) {
  const { loading, buf, error } = useBytes(fetchUrl);
  const [out, setOut] = useState({ rows: null, error: null });
  useEffect(() => {
    if (!buf) return undefined;
    let alive = true;
    loadJSZip()
      .then((Z) => Z.loadAsync(buf))
      .then((zip) => {
        const rows = [];
        zip.forEach((path, entry) => rows.push({
          path, dir: entry.dir,
          size: entry._data && entry._data.uncompressedSize != null ? entry._data.uncompressedSize : null,
        }));
        if (alive) setOut({ rows, error: null });
      })
      .catch((e) => alive && setOut({ rows: null, error: e.message }));
    return () => { alive = false; };
  }, [buf]);
  if (loading || (!out.rows && !out.error && !error)) return <Spin label="Reading the archive…" />;
  if (error || out.error) return fallback;
  const files = out.rows.filter((r) => !r.dir);
  return (
    <div className="ap-table-wrap">
      <div className="ap-note" style={{ marginTop: 0 }}>{files.length} file{files.length === 1 ? "" : "s"} in this archive</div>
      <table className="ap-table">
        <thead><tr><th>Name</th><th style={{ textAlign: "right" }}>Size</th></tr></thead>
        <tbody>{files.slice(0, 1000).map((r) => (
          <tr key={r.path}><td>{r.path}</td><td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{r.size == null ? "—" : humanSize(r.size)}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
const humanSize = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

/*
 * An unknown type: look before giving up. Plenty of "unknown" files are text
 * with an odd extension (.conf, .srt, .ics, .vcf) -- if the first bytes read
 * as text, show them; otherwise say what the file is and offer the download.
 */
function SniffViewer({ fetchUrl, fallback }) {
  const { loading, buf, error } = useBytes(fetchUrl);
  if (loading) return <Spin label="Opening…" />;
  if (error || !buf) return fallback;
  const head = new Uint8Array(buf.slice(0, 4096));
  let ctrl = 0;
  for (const b of head) { if (b === 0) { ctrl = head.length; break; } if (b < 9 || (b > 13 && b < 32)) ctrl++; }
  if (!head.length || ctrl > head.length * 0.02) return fallback;
  const text = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, 500000));
  return <pre className="ap-text">{text}</pre>;
}

/** Render a CSV as a real table — far easier to read than raw commas. */
function CsvTable({ raw }) {
  const rows = raw.split(/\r?\n/).filter(Boolean).slice(0, 500).map((line) => {
    // Handles quoted cells containing commas, which naive split(",") mangles.
    const out = []; let cur = ""; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === "," && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  });
  if (!rows.length) return <div className="ap-empty">Empty file.</div>;
  const [head, ...body] = rows;
  return (
    <div className="ap-table-wrap">
      <table className="ap-table">
        <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>{body.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
      {rows.length >= 500 && <div className="ap-note">Showing the first 500 rows — download for the rest.</div>}
    </div>
  );
}

/**
 * A real .xlsx / .xls / .ods viewer.
 *
 * SheetJS is fetched from a CDN the first time one is opened, so nothing is
 * added to the bundle for a file type most tickets never carry. A workbook
 * with several sheets gets a row of tabs; a huge one is capped, because the
 * point is to read the thing, not to reimplement Excel.
 */
function SheetViewer({ url }) {
  const [state, setState] = useState({ loading: true, sheets: [], error: null });
  const [active, setActive] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ loading: true, sheets: [], error: null });
    setActive(0);
    (async () => {
      try {
        const [XLSX, buf] = await Promise.all([
          loadXLSX(),
          fetch(url, { credentials: "omit" }).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.arrayBuffer();
          }),
        ]);
        if (!alive) return;
        const wb = XLSX.read(buf, { type: "array" });
        const sheets = wb.SheetNames.map((name) => ({
          name,
          // header:1 keeps it as rows of cells; the first row is a header only
          // by convention, and a spreadsheet is often not shaped that way.
          rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false, defval: "" })
                     .slice(0, 500),
        }));
        setState({ loading: false, sheets, error: null });
      } catch (e) {
        if (alive) setState({ loading: false, sheets: [], error: e.message });
      }
    })();
    return () => { alive = false; };
  }, [url]);

  if (state.loading) return <div className="ap-empty"><Loader2 size={20} className="spin" /> Opening the spreadsheet…</div>;
  if (state.error) return <div className="ap-empty">Could not read this spreadsheet: {state.error}</div>;
  if (!state.sheets.length) return <div className="ap-empty">This workbook has no sheets.</div>;

  const sheet = state.sheets[active] || state.sheets[0];
  const rows = sheet.rows || [];
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);

  return (
    <div className="ap-table-wrap">
      {state.sheets.length > 1 && (
        <div className="ap-sheets">
          {state.sheets.map((sh, i) => (
            <button key={sh.name} className={`ap-sheet ${i === active ? "on" : ""}`} onClick={() => setActive(i)}>
              {sh.name}
            </button>))}
        </div>
      )}
      {rows.length === 0 ? <div className="ap-empty">This sheet is empty.</div> : (
        <table className="ap-table">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {Array.from({ length: width }).map((_, j) => (
                  i === 0 ? <th key={j}>{r[j] ?? ""}</th> : <td key={j}>{r[j] ?? ""}</td>
                ))}
              </tr>))}
          </tbody>
        </table>
      )}
      {rows.length >= 500 && <div className="ap-note">Showing the first 500 rows — download for the rest.</div>}
    </div>
  );
}

/**
 * An image that says what it is doing.
 *
 * A large screenshot over a slow connection left the viewer blank with no
 * indication anything was happening, which reads as broken.
 */
function ImageViewer({ url, dl, alt, zoom, rot }) {
  const [state, setState] = useState("loading");   // loading | ready | error
  useEffect(() => { setState("loading"); }, [url]);
  return (
    <>
      {state === "loading" && (
        <div className="ap-empty ap-loading"><Loader2 size={22} className="spin" /> Loading image…</div>
      )}
      {state === "error" && (
        /* HEIC (iPhone photos) and TIFF are real images most browsers cannot
           draw -- saying "removed from storage" for those was wrong. */
        <NoPreview Ic={FileIcon} name={alt} dl={dl}
          why={["heic", "heif", "tif", "tiff"].includes(extOf(alt))
            ? "This image format cannot be shown in the browser. Download it to open it."
            : "This image could not be loaded. It may have been removed from storage."} />
      )}
      <img src={url} alt={alt} className="ap-img"
           style={{ transform: `scale(${zoom}) rotate(${rot}deg)`, display: state === "ready" ? "" : "none" }}
           onLoad={() => setState("ready")} onError={() => setState("error")} />
    </>
  );
}

function TextViewer({ url, isCsv }) {
  const [state, setState] = useState({ loading: true, text: "", error: null });

  useEffect(() => {
    let alive = true;
    setState({ loading: true, text: "", error: null });
    fetch(url, { credentials: "omit" })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      // A 40MB log would lock the tab; the rest is a download away.
      .then((t) => alive && setState({ loading: false, text: t.slice(0, 500000), error: null }))
      .catch((e) => alive && setState({ loading: false, text: "", error: e.message }));
    return () => { alive = false; };
  }, [url]);

  if (state.loading) return <div className="ap-empty"><Loader2 size={20} className="spin" /> Loading…</div>;
  if (state.error) return <div className="ap-empty">Could not read this file: {state.error}</div>;
  return isCsv ? <CsvTable raw={state.text} /> : <pre className="ap-text">{state.text}</pre>;
}

export default function AttachmentPreview({ attachments = [], startIndex = 0, onClose }) {
  const [i, setI] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const closeRef = useRef(null);

  /*
   * No filtering here any more. Hiding inline images was right when the only
   * caller was the ticket's Attachments tab, where a signature logo is noise.
   * But a picture pasted into a message body is now openable from the body
   * itself, and that caller passes exactly the one attachment it means -- so
   * filtering it out left the viewer with nothing to show. What belongs in the
   * gallery is the caller's decision.
   */
  const list = attachments;
  const att = list[i];

  const go = useCallback((d) => {
    setI((v) => (v + d + list.length) % list.length);
    setZoom(1); setRot(0);
  }, [list.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    // The page behind must not scroll while a full-screen viewer is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [go, onClose]);

  if (!att) return null;

  const kind = kindOf(att);
  const url = fdUrl(att.viewUrl || att.url);
  const dl = fdUrl(att.url || att.viewUrl);
  const Ic = ICON[kind] || FileIcon;

  return (
    <Portal>
      <div className="ap-overlay" onClick={onClose}>
        <div className="ap-shell" onClick={(e) => e.stopPropagation()}>

          <div className="ap-head">
            <span className="ap-title" title={att.name}>
              <Ic size={15} /> {att.name}
              {att.sizeText && <span className="ap-size">{att.sizeText}</span>}
            </span>

            <span className="ap-tools">
              {kind === "image" && (
                <>
                  <button className="icon-btn" title="Zoom out" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}><ZoomOut size={16} /></button>
                  <span className="ap-zoom">{Math.round(zoom * 100)}%</span>
                  <button className="icon-btn" title="Zoom in" onClick={() => setZoom((z) => Math.min(5, z + 0.25))}><ZoomIn size={16} /></button>
                  <button className="icon-btn" title="Rotate" onClick={() => setRot((r) => (r + 90) % 360)}><RotateCw size={16} /></button>
                </>
              )}
              <a className="btn btn-soft btn-sm" href={dl} download={att.name} target="_blank" rel="noopener noreferrer">
                <Download size={14} /> Download
              </a>
              <button ref={closeRef} className="icon-btn" title="Close (Esc)" onClick={onClose}><X size={17} /></button>
            </span>
          </div>

          <div className="ap-body">
            {list.length > 1 && (
              <button className="ap-nav left" title="Previous (←)" onClick={() => go(-1)}><ChevronLeft size={22} /></button>
            )}

            {kind === "image" && (
              <ImageViewer url={url} dl={dl} alt={att.name} zoom={zoom} rot={rot} />
            )}

            {kind === "pdf" && <PdfViewer fetchUrl={dl} directUrl={url} name={att.name} />}

            {(kind === "text" || kind === "code") && (
              <TextViewer url={dl} isCsv={/.csv$/i.test(att.name || "")} />
            )}

            {(kind === "audio" || kind === "video") && (
              <MediaViewer kind={kind} url={url} dl={dl} name={att.name} Ic={Ic} />
            )}

            {kind === "sheet" && <SheetViewer url={dl} />}

            {kind === "docx" && (
              <DocxViewer fetchUrl={dl} fallback={<OfficeViewer publicUrl={dl} name={att.name} />} />
            )}

            {(kind === "doc" || kind === "slides") && <OfficeViewer publicUrl={dl} name={att.name} />}

            {kind === "zip" && (
              <ZipViewer fetchUrl={dl} fallback={<NoPreview Ic={Ic} name={att.name} dl={dl} why="This archive could not be read. It may be damaged or password-protected." />} />
            )}

            {kind === "archive" && (
              <NoPreview Ic={Ic} name={att.name} dl={dl}
                why={`A .${extOf(att.name)} archive cannot be opened in a browser (only .zip can). Download it to unpack it.`} />
            )}

            {kind === "other" && (
              <SniffViewer fetchUrl={dl} fallback={
                <NoPreview Ic={Ic} name={att.name} dl={dl}
                  why={`${extOf(att.name) ? "A ." + extOf(att.name) : "This"} file has no in-browser preview.`} />
              } />
            )}

            {list.length > 1 && (
              <button className="ap-nav right" title="Next (→)" onClick={() => go(1)}><ChevronRight size={22} /></button>
            )}
          </div>

          {list.length > 1 && (
            <div className="ap-strip">
              {list.map((a, n) => (
                <button key={a.id} className={`ap-thumb ${n === i ? "on" : ""}`}
                        title={a.name} onClick={() => { setI(n); setZoom(1); setRot(0); }}>
                  {kindOf(a) === "image"
                    ? <img src={fdUrl(a.viewUrl || a.url)} alt="" />
                    : <span className="ap-thumb-ic" style={{ color: KIND_COLOR[kindOf(a)] }}>
                        {(a.name || "?").split(".").pop().slice(0, 4)}
                      </span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
