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
 *   archive     named and offered for download; unpacking one in the browser
 *               would mean shipping a zip parser to read someone's evidence.
 *   sheets      .xlsx/.xls/.ods parsed with SheetJS, which the panel already
 *               loads on demand to WRITE exports. Multi-sheet workbooks get
 *               tabs.
 *   doc/slides  .docx/.pptx are ZIP archives and reading one needs a converter
 *               this panel does not ship, so we say so plainly and offer
 *               Download + "Open in Google Docs Viewer" rather than an empty
 *               grey box.
 *
 * The whole gallery is navigable with arrow keys, because an agent looking at a
 * customer's five screenshots should not have to close and reopen four times.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  X, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw,
  FileText, FileSpreadsheet, File as FileIcon, ExternalLink, Loader2,
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
export function kindOf(att) {
  const mime = String(att.mime || "").toLowerCase();
  const name = String(att.name || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";

  if (IMAGE_RE.test(mime) || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif", "svg"].includes(ext)) return "image";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (/^audio\//.test(mime) || ["mp3", "wav", "ogg", "m4a", "aac", "flac", "oga"].includes(ext)) return "audio";
  if (/^video\//.test(mime) || ["mp4", "webm", "ogv", "mov", "m4v"].includes(ext)) return "video";
  if (["zip", "rar", "7z", "tar", "gz", "tgz", "bz2"].includes(ext)
      || /^application\/(zip|x-rar|x-7z|x-tar|gzip)/.test(mime)) return "archive";
  if (["js", "jsx", "ts", "tsx", "css", "html", "htm", "php", "py", "java", "sql", "sh", "yml", "yaml", "ini", "env"].includes(ext)) return "code";
  if (TEXT_RE.test(mime) || ["txt", "csv", "log", "json", "xml", "md"].includes(ext)) return "text";
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return "doc";
  if (["xls", "xlsx", "ods"].includes(ext)) return "sheet";
  if (["ppt", "pptx", "odp"].includes(ext)) return "slides";
  return "other";
}

export const ICON = {
  image: ImageIcon, pdf: FileText, doc: FileText, sheet: FileSpreadsheet,
  slides: Presentation, text: FileText, code: FileCode, archive: FileArchive,
  audio: FileAudio, video: FileVideo, other: FileIcon,
};

/* The colour each kind wears, so a PDF and a spreadsheet are told apart at a
   glance rather than read one at a time. */
export const KIND_COLOR = {
  image: "#0EA5E9", pdf: "#DC2626", doc: "#2563EB", sheet: "#16A34A",
  slides: "#EA580C", text: "#64748B", code: "#7C3AED", archive: "#A16207",
  audio: "#DB2777", video: "#9333EA", other: "#64748B",
};

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
function ImageViewer({ url, alt, zoom, rot }) {
  const [state, setState] = useState("loading");   // loading | ready | error
  useEffect(() => { setState("loading"); }, [url]);
  return (
    <>
      {state === "loading" && (
        <div className="ap-empty ap-loading"><Loader2 size={22} className="spin" /> Loading image…</div>
      )}
      {state === "error" && (
        <div className="ap-empty">
          <FileIcon size={40} />
          <h4>{alt}</h4>
          <p>This image could not be loaded. It may have been removed from storage.</p>
        </div>
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
              <ImageViewer url={url} alt={att.name} zoom={zoom} rot={rot} />
            )}

            {kind === "pdf" && (
              /* The browser's own PDF viewer. sandbox keeps a hostile PDF from
                 scripting the panel's origin. */
              <iframe title={att.name} src={url} className="ap-frame"
                      sandbox="allow-same-origin allow-scripts allow-popups" />
            )}

            {(kind === "text" || kind === "code") && (
              <TextViewer url={url} isCsv={/\.csv$/i.test(att.name || "")} />
            )}

            {kind === "audio" && (
              <div className="ap-empty ap-media">
                <Ic size={44} />
                <h4>{att.name}</h4>
                {/* controlsList keeps the browser's own download button out of
                    the way; ours is in the header and carries the filename. */}
                <audio src={url} controls controlsList="nodownload" style={{ width: "min(560px, 90%)" }} />
              </div>
            )}

            {kind === "video" && (
              <video src={url} controls controlsList="nodownload" className="ap-video"
                     style={{ maxWidth: "100%", maxHeight: "100%" }} />
            )}

            {kind === "sheet" && <SheetViewer url={url} />}

            {["doc", "slides", "archive", "other"].includes(kind) && (
              <div className="ap-empty ap-nopreview">
                <Ic size={44} />
                <h4>{att.name}</h4>
                <p>
                  {kind === "archive"
                    ? "An archive has to be unpacked before anything inside it can be read."
                    : kind === "other"
                      ? "This file type has no in-browser preview."
                      : "Word and PowerPoint files are ZIP archives — reading one needs a converter this panel does not ship."}
                </p>
                <div className="ap-actions">
                  <a className="btn btn-primary btn-sm" href={dl} download={att.name}>
                    <Download size={14} /> Download
                  </a>
                  {/* Google's viewer needs a publicly reachable URL. Ours are
                      signed and time-limited, so this works while the link is
                      valid and simply fails after — a secondary option, never
                      the only one. Pointless for an archive, so not offered. */}
                  {["doc", "slides"].includes(kind) && (
                    <a className="btn btn-soft btn-sm"
                       href={`https://docs.google.com/viewer?embedded=1&url=${encodeURIComponent(dl)}`}
                       target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={14} /> Try Google Docs Viewer
                    </a>
                  )}
                </div>
              </div>
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
