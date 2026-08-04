// ===========================================================================
//  AssignmentPanel.jsx
//  Dynamic "Assignment Panel" for the Internship section.
//
//  Flow:  Internships (is_full = 0 & show_internship = 1)
//           -> Assignments (title + rich HTML description)
//                -> Reference attachments (S3 files w/ label/desc/required)
//                -> Submission form builder (dynamic fields, like Sim 2.2)
//
//  Backend: assignments_api.php (single PHP file in internship-system/).
//  npm deps already in the project: react, react-hot-toast, lucide-react,
//  react-select, react-router-dom.
// ===========================================================================
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import toast from "react-hot-toast";
import Select from "react-select";
import { useSearchParams } from "react-router-dom";
import {
  ChevronRight, Plus, Pencil, Trash2, Layers, ListChecks, Settings2,
  GripVertical, X, Eye, MousePointerClick, FileStack, Paperclip,
  Type, AlignLeft, Hash, Calendar, Link2, Image as ImageIcon, Film,
  FileText, FileSpreadsheet, Presentation, ListFilter, CircleDot,
  CheckSquare, Upload, Bold, Italic, Underline, Strikethrough, List,
  ListOrdered, Eraser, Table, Highlighter, Baseline, ImagePlus, Download,
  FileArchive, Star, UploadCloud, ClipboardList, RefreshCw,
} from "lucide-react";

/* ===========================================================================
   CONFIG — point this at assignments_api.php (same base as the rest of the app)
   =========================================================================== */
const API_BASE = `${import.meta.env.VITE_API_URL || "https://cit3.internshipstudio.com/admin/react-api"}/api/internship-system/assignments_api.php`;

/* ===========================================================================
   API helpers (raw fetch, no credentials — route-level permission gate only)
   =========================================================================== */
async function api(qs, body) {
  const opts = { method: body ? "POST" : "GET", cache: "no-store" };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}?${qs}&_=${Date.now()}`, opts);
  let json;
  try { json = await res.json(); }
  catch { throw new Error("Server returned an invalid response"); }
  if (!res.ok || json.status === "error") {
    throw new Error(json?.message || `Request failed (${res.status})`);
  }
  return json.data ?? json;
}
async function apiForm(qs, formData) {
  const res = await fetch(`${API_BASE}?${qs}&_=${Date.now()}`, {
    method: "POST", cache: "no-store", body: formData,
  });
  let json;
  try { json = await res.json(); }
  catch { throw new Error("Server returned an invalid response"); }
  if (!res.ok || json.status === "error") {
    throw new Error(json?.message || `Upload failed (${res.status})`);
  }
  return json.data ?? json;
}

const A = {
  listDomains: () => api("resource=domains"),
  listAssignments: (id) => api(`resource=assignments&action=list&internship_id=${id}`),
  createAssignment: (d) => api("resource=assignments&action=create", d),
  updateAssignment: (d) => api("resource=assignments&action=update", d),
  toggleAssignment: (id) => api("resource=assignments&action=toggle", { id }),
  deleteAssignment: (id) => api("resource=assignments&action=delete", { id }),
  reorderAssignments: (order) => api("resource=assignments&action=reorder", { order }),

  listAttachments: (aid) => api(`resource=attachments&action=list&assignment_id=${aid}`),
  createAttachment: (fd) => apiForm("resource=attachments&action=create", fd),
  /* swap the S3 file behind an existing attachment — same row id, new URL */
  reuploadAttachment: (fd) => apiForm("resource=attachments&action=reupload", fd),
  updateAttachment: (d) => api("resource=attachments&action=update", d),
  deleteAttachment: (id) => api("resource=attachments&action=delete", { id }),
  reorderAttachments: (order) => api("resource=attachments&action=reorder", { order }),

  listFields: (aid) => api(`resource=fields&action=list&assignment_id=${aid}`),
  createField: (d) => api("resource=fields&action=create", d),
  updateField: (d) => api("resource=fields&action=update", d),
  toggleField: (id) => api("resource=fields&action=toggle", { id }),
  deleteField: (id) => api("resource=fields&action=delete", { id }),
  reorderFields: (assignment_id, order) => api("resource=fields&action=reorder", { assignment_id, order }),

  uploadEditorImage: (fd) => apiForm("resource=editor&action=upload_image", fd),
};

/* ===========================================================================
   Field type catalogue (the submission form builder)
   =========================================================================== */
const TYPES = {
  text: { label: "Short text", icon: Type, group: "text" },
  textarea: { label: "Paragraph", icon: AlignLeft, group: "text" },
  url: { label: "URL / Link", icon: Link2, group: "text" },
  number: { label: "Number", icon: Hash, group: "number" },
  date: { label: "Date", icon: Calendar, group: "other" },
  dropdown_single: { label: "Dropdown (single)", icon: ListFilter, group: "choice" },
  dropdown_multi: { label: "Dropdown (multi)", icon: ListChecks, group: "choice" },
  radio: { label: "Radio (single)", icon: CircleDot, group: "choice" },
  checkbox: { label: "Checkbox (multi)", icon: CheckSquare, group: "choice" },
  image: { label: "Image upload", icon: ImageIcon, group: "file" },
  video: { label: "Video upload", icon: Film, group: "file" },
  file_pdf: { label: "PDF upload", icon: FileText, group: "file" },
  file_xlsx: { label: "Excel / CSV", icon: FileSpreadsheet, group: "file" },
  file_doc: { label: "Document", icon: FileText, group: "file" },
  presentation: { label: "Presentation", icon: Presentation, group: "file" },
  file_any: { label: "Any file", icon: Paperclip, group: "file" },
};
const PALETTE = [
  { label: "Text & input", types: ["text", "textarea", "url", "number", "date"] },
  { label: "Choices", types: ["dropdown_single", "dropdown_multi", "radio", "checkbox"] },
  { label: "File upload", types: ["image", "video", "file_pdf", "file_xlsx", "file_doc", "presentation", "file_any"] },
];
const FILE_TYPES = ["image", "video", "file_pdf", "file_xlsx", "file_doc", "file_any", "presentation"];
const groupOf = (t) => TYPES[t]?.group;
const slug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30);

function defaultsFor(type) {
  const base = {
    field_type: type, label: TYPES[type].label, placeholder: "", help_text: "",
    is_required: 1, status: "active", options: [],
    accepted_extensions: "", max_file_size_mb: 25,
  };
  if (groupOf(type) === "choice") {
    base.options = [
      { value: "option_1", label: "Option 1" },
      { value: "option_2", label: "Option 2" },
    ];
  }
  return base;
}
function toDraft(f) {
  return {
    id: f.id, field_type: f.field_type, label: f.label || "",
    placeholder: f.placeholder || "", help_text: f.help_text || "",
    is_required: !!f.is_required, status: f.status || "active",
    options: (f.options || []).map((o) => ({ value: o.value, label: o.label })),
    accepted_extensions: f.accepted_extensions || "", max_file_size_mb: f.max_file_size_mb || 25,
  };
}

/* attachment file-type icon mapping */
const ATT_ICON = {
  pdf: FileText, doc: FileText, excel: FileSpreadsheet, ppt: Presentation,
  video: Film, zip: FileArchive, image: ImageIcon, link: Link2, other: Paperclip,
};
const humanSize = (b) => {
  if (!b) return "";
  const u = ["B", "KB", "MB", "GB"]; let i = 0; let n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
};

const selectStyles = {
  control: (b, s) => ({
    ...b, minHeight: 40, background: "var(--asg-bg-soft)",
    borderColor: s.isFocused ? "var(--asg-accent)" : "var(--asg-border-2)",
    boxShadow: "none", borderRadius: 8, fontSize: 13,
  }),
  menu: (b) => ({ ...b, background: "var(--asg-bg-surface)", zIndex: 50, fontSize: 13 }),
  option: (b, s) => ({
    ...b, fontSize: 13,
    background: s.isSelected ? "var(--asg-accent)" : s.isFocused ? "var(--asg-accent-soft)" : "transparent",
    color: s.isSelected ? "#fff" : "var(--asg-text)",
  }),
  singleValue: (b) => ({ ...b, color: "var(--asg-text)" }),
  multiValue: (b) => ({ ...b, background: "var(--asg-accent-soft)" }),
  multiValueLabel: (b) => ({ ...b, color: "var(--asg-accent-text)" }),
  input: (b) => ({ ...b, color: "var(--asg-text)" }),
  placeholder: (b) => ({ ...b, color: "var(--asg-text-3)" }),
};

/* ===========================================================================
   Live-preview field renderer
   =========================================================================== */
function PreviewField({ field }) {
  const f = field;
  const [val, setVal] = useState(undefined);
  const t = f.field_type;

  let control = null;
  if (FILE_TYPES.includes(t)) {
    control = (
      <div className="asg-upload" style={{ cursor: "default" }}>
        <Upload size={16} /> Student uploads a {TYPES[t]?.label.toLowerCase() || "file"} here
      </div>
    );
  } else if (t === "text" || t === "url") {
    control = <input className="asg-input" placeholder={f.placeholder || ""}
      value={val || ""} onChange={(e) => setVal(e.target.value)} />;
  } else if (t === "textarea") {
    control = <textarea className="asg-textarea" placeholder={f.placeholder || ""}
      value={val || ""} onChange={(e) => setVal(e.target.value)} />;
  } else if (t === "number") {
    control = <input className="asg-input" type="number" placeholder={f.placeholder || ""}
      value={val ?? ""} onChange={(e) => setVal(e.target.value)} />;
  } else if (t === "date") {
    control = <input className="asg-input" type="date" value={val || ""}
      onChange={(e) => setVal(e.target.value)} />;
  } else if (t === "dropdown_single") {
    control = <Select styles={selectStyles} options={f.options}
      placeholder={f.placeholder || "Select..."} isClearable
      value={f.options.find((o) => o.value === val) || null}
      onChange={(o) => setVal(o ? o.value : "")} />;
  } else if (t === "dropdown_multi") {
    const arr = Array.isArray(val) ? val : [];
    control = <Select styles={selectStyles} options={f.options} isMulti
      placeholder={f.placeholder || "Select one or more..."}
      value={f.options.filter((o) => arr.includes(o.value))}
      onChange={(opts) => setVal((opts || []).map((o) => o.value))} />;
  } else if (t === "radio") {
    control = f.options.map((o) => (
      <label key={o.value} className={`asg-opt-row ${val === o.value ? "checked" : ""}`}>
        <input type="radio" checked={val === o.value} onChange={() => setVal(o.value)} />
        {o.label}
      </label>
    ));
  } else if (t === "checkbox") {
    const arr = Array.isArray(val) ? val : [];
    control = f.options.map((o) => {
      const c = arr.includes(o.value);
      return (
        <label key={o.value} className={`asg-opt-row ${c ? "checked" : ""}`}>
          <input type="checkbox" checked={c}
            onChange={() => setVal(c ? arr.filter((x) => x !== o.value) : [...arr, o.value])} />
          {o.label}
        </label>
      );
    });
  }

  return (
    <div className="asg-field">
      <label className="asg-field-label">
        {f.label || "Untitled field"}
        {f.is_required ? <span className="asg-field-req">*</span> : null}
      </label>
      {f.help_text && <p className="asg-field-help">{f.help_text}</p>}
      {control}
    </div>
  );
}

/* ===========================================================================
   Rich-text editor — full toolbar with font family/size, colors, highlight,
   lists, link, table, inline S3 image upload + click-to-resize.
   =========================================================================== */
const FONTS = [
  { label: "Default", value: "" },
  { label: "Sans (Arial)", value: "Arial, sans-serif" },
  { label: "Serif (Georgia)", value: "Georgia, serif" },
  { label: "Times", value: "'Times New Roman', serif" },
  { label: "Mono", value: "'Courier New', monospace" },
  { label: "Inter", value: "Inter, system-ui, sans-serif" },
  { label: "Poppins", value: "Poppins, sans-serif" },
];

function RteBtn({ icon: Ic, text, title, active, onAction }) {
  return (
    <button type="button" className={`asg-rte-btn ${active ? "active" : ""}`} title={title}
      onMouseDown={(e) => { e.preventDefault(); onAction(); }}>
      {Ic ? <Ic size={14} /> : <span style={{ fontWeight: 800, fontSize: 12 }}>{text}</span>}
    </button>
  );
}

function RichEditor({ value, onChange, placeholder }) {
  const ref = useRef(null);
  const fileRef = useRef(null);
  const savedRange = useRef(null);
  const sizeRef = useRef(3);
  const [imgSel, setImgSel] = useState(null); // currently-clicked <img>
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) {
      ref.current.innerHTML = value || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange(ref.current?.innerHTML || "");

  const saveSel = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };
  const restoreSel = () => {
    ref.current?.focus();
    const sel = window.getSelection();
    if (savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };
  const exec = (cmd, arg) => {
    ref.current?.focus();
    document.execCommand("styleWithCSS", false, true);
    document.execCommand(cmd, false, arg);
    emit();
  };
  const insertHtml = (html) => {
    restoreSel();
    document.execCommand("insertHTML", false, html);
    emit();
  };
  const applyColor = (cmd, color) => {
    restoreSel();
    document.execCommand("styleWithCSS", false, true);
    document.execCommand(cmd, false, color);
    emit();
  };
  const changeSize = (delta) => {
    sizeRef.current = Math.min(7, Math.max(1, sizeRef.current + delta));
    exec("fontSize", String(sizeRef.current));
  };

  const insertTable = () => {
    const rows = parseInt(window.prompt("Number of rows", "2") || "0", 10);
    const cols = parseInt(window.prompt("Number of columns", "2") || "0", 10);
    if (!rows || !cols || rows < 1 || cols < 1) return;
    const cell = '<td style="border:1px solid #cbd5e1;padding:6px 10px;min-width:60px;">&nbsp;</td>';
    let html = '<table style="border-collapse:collapse;width:100%;margin:8px 0;font-size:13px;">';
    for (let r = 0; r < rows; r++) html += "<tr>" + cell.repeat(cols) + "</tr>";
    html += "</table><p><br/></p>";
    insertHtml(html);
  };

  /* image: upload to S3, fall back to data-url if the upload endpoint fails */
  const uploadImage = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await A.uploadEditorImage(fd);
      insertHtml(`<img src="${res.url}" alt="" style="max-width:100%;border-radius:6px;" />`);
    } catch (e) {
      // graceful fallback so the admin never loses their image
      const dataUrl = await new Promise((r) => {
        const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file);
      });
      insertHtml(`<img src="${dataUrl}" alt="" style="max-width:100%;border-radius:6px;" />`);
      toast.error(`Image stored inline (upload failed: ${e.message})`);
    } finally { setUploading(false); }
  };
  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    if (file) await uploadImage(file);
    e.target.value = "";
  };
  const onPaste = async (e) => {
    const items = e.clipboardData?.items || [];
    for (const it of items) {
      if (it.type && it.type.startsWith("image/")) {
        e.preventDefault();
        saveSel();
        const file = it.getAsFile();
        if (file) await uploadImage(file);
        return;
      }
    }
  };

  /* click an image to select it for resizing */
  const onEditorClick = (e) => {
    if (e.target && e.target.tagName === "IMG") setImgSel(e.target);
    else setImgSel(null);
  };
  const resizeImg = (width) => {
    if (!imgSel) return;
    imgSel.style.width = width;
    imgSel.style.height = "auto";
    emit();
  };

  return (
    <div className="asg-rte">
      <div className="asg-rte-toolbar">
        <select className="asg-rte-font" title="Font family" defaultValue=""
          onMouseDown={saveSel}
          onChange={(e) => { restoreSel(); exec("fontName", e.target.value || "inherit"); }}>
          {FONTS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
        </select>
        <span className="asg-rte-sep" />
        <RteBtn icon={Bold} title="Bold" onAction={() => exec("bold")} />
        <RteBtn icon={Italic} title="Italic" onAction={() => exec("italic")} />
        <RteBtn icon={Underline} title="Underline" onAction={() => exec("underline")} />
        <RteBtn icon={Strikethrough} title="Strikethrough" onAction={() => exec("strikeThrough")} />
        <span className="asg-rte-sep" />
        <RteBtn text="A−" title="Decrease font size" onAction={() => changeSize(-1)} />
        <RteBtn text="A+" title="Increase font size" onAction={() => changeSize(1)} />
        <span className="asg-rte-sep" />
        <label className="asg-rte-color" title="Text color">
          <Baseline size={14} />
          <input type="color" defaultValue="#1f2235" onMouseDown={saveSel}
            onInput={(e) => applyColor("foreColor", e.target.value)} />
        </label>
        <label className="asg-rte-color" title="Highlight / background color">
          <Highlighter size={14} />
          <input type="color" defaultValue="#fff3a0" onMouseDown={saveSel}
            onInput={(e) => applyColor("hiliteColor", e.target.value)} />
        </label>
        <span className="asg-rte-sep" />
        <RteBtn icon={List} title="Bullet list" onAction={() => exec("insertUnorderedList")} />
        <RteBtn icon={ListOrdered} title="Numbered list" onAction={() => exec("insertOrderedList")} />
        <span className="asg-rte-sep" />
        <RteBtn icon={Link2} title="Link" onAction={() => {
          const url = window.prompt("Link URL");
          if (url) exec("createLink", url);
        }} />
        <RteBtn icon={ImagePlus} title="Insert image" onAction={() => { saveSel(); fileRef.current?.click(); }} />
        <RteBtn icon={Table} title="Insert table" onAction={insertTable} />
        <RteBtn icon={Eraser} title="Clear formatting" onAction={() => exec("removeFormat")} />
        {uploading && <span className="asg-rte-uploading">Uploading…</span>}
      </div>

      {imgSel && (
        <div className="asg-rte-imgbar">
          <ImageIcon size={13} /> <span>Resize image:</span>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => resizeImg("25%")}>25%</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => resizeImg("50%")}>50%</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => resizeImg("75%")}>75%</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => resizeImg("100%")}>100%</button>
          <button type="button" className="asg-rte-imgbar-x" onMouseDown={(e) => e.preventDefault()}
            onClick={() => setImgSel(null)}><X size={13} /></button>
        </div>
      )}

      <div
        ref={ref}
        className="asg-rte-area"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder || "Write a description..."}
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
        onClick={onEditorClick}
        onKeyUp={saveSel}
        onMouseUp={saveSel}
      />
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPickImage} />
    </div>
  );
}

/* ===========================================================================
   Field edit drawer (submission form builder)
   =========================================================================== */
function FieldEditDrawer({ field, onClose, onSaved }) {
  const [d, setD] = useState(() => toDraft(field));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
  const grp = groupOf(d.field_type);

  const addOption = () => {
    const n = d.options.length + 1;
    set("options", [...d.options, { value: `option_${n}`, label: `Option ${n}` }]);
  };
  const updOption = (i, k, v) => {
    const next = d.options.map((o, idx) => (idx === i ? { ...o, [k]: v } : o));
    if (k === "label" && next[i].value.startsWith("option_")) next[i].value = slug(v) || `option_${i + 1}`;
    set("options", next);
  };
  const delOption = (i) => set("options", d.options.filter((_, idx) => idx !== i));

  const previewField = useMemo(() => ({
    id: d.id, field_type: d.field_type, label: d.label || "Untitled field",
    placeholder: d.placeholder, help_text: d.help_text, is_required: d.is_required ? 1 : 0,
    options: d.options.map((o) => ({ value: o.value, label: o.label })),
  }), [d]);

  const save = async () => {
    if (!d.label.trim()) return toast.error("Field label is required");
    if (grp === "choice" && d.options.length < 2) return toast.error("Add at least 2 options");
    setSaving(true);
    try {
      await A.updateField({
        id: d.id, field_type: d.field_type, label: d.label, placeholder: d.placeholder,
        help_text: d.help_text, is_required: d.is_required ? 1 : 0, status: d.status,
        options: d.options.map((o) => ({ value: o.value, label: o.label })),
        accepted_extensions: d.accepted_extensions, max_file_size_mb: d.max_file_size_mb,
      });
      toast.success("Field saved");
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="asg-backdrop" onClick={onClose} />
      <aside className="asg-drawer">
        <div className="asg-drawer-head">
          <div>
            <div className="asg-drawer-eyebrow">Edit submission field</div>
            <div className="asg-drawer-title">{d.label || "Untitled field"}</div>
          </div>
          <button className="asg-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="asg-drawer-body">
          <div className="asg-field">
            <label className="asg-field-label">Field type</label>
            <select className="asg-select" value={d.field_type}
              onChange={(e) => set("field_type", e.target.value)}>
              {Object.entries(TYPES).map(([t, m]) => (
                <option key={t} value={t}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="asg-field">
            <label className="asg-field-label">Label / Question<span className="asg-field-req">*</span></label>
            <input className="asg-input" value={d.label} onChange={(e) => set("label", e.target.value)} />
          </div>
          <div className="asg-row-2">
            <div className="asg-field">
              <label className="asg-field-label">Placeholder text</label>
              <input className="asg-input" value={d.placeholder} onChange={(e) => set("placeholder", e.target.value)} />
            </div>
            <div className="asg-field">
              <label className="asg-field-label">Help text</label>
              <input className="asg-input" value={d.help_text} onChange={(e) => set("help_text", e.target.value)} />
            </div>
          </div>

          {grp === "choice" && (
            <div className="asg-field">
              <label className="asg-field-label">Options</label>
              <p className="asg-field-help">Add the choices students can pick from.</p>
              {d.options.map((o, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 7 }}>
                  <input className="asg-input" style={{ flex: 1 }} value={o.label} placeholder="Option label"
                    onChange={(e) => updOption(i, "label", e.target.value)} />
                  <input className="asg-input" style={{ width: 120 }} value={o.value} placeholder="value"
                    onChange={(e) => updOption(i, "value", e.target.value)} />
                  <button className="asg-btn asg-btn-danger asg-btn-sm" onClick={() => delOption(i)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button className="asg-btn asg-btn-ghost asg-btn-sm" onClick={addOption}>
                <Plus size={13} /> Add option
              </button>
            </div>
          )}

          {grp === "file" && (
            <div className="asg-row-2">
              <div className="asg-field">
                <label className="asg-field-label">Accepted extensions (csv)</label>
                <input className="asg-input" placeholder="pdf,docx,pptx" value={d.accepted_extensions}
                  onChange={(e) => set("accepted_extensions", e.target.value)} />
              </div>
              <div className="asg-field">
                <label className="asg-field-label">Max file size (MB)</label>
                <input className="asg-input" type="number" value={d.max_file_size_mb}
                  onChange={(e) => set("max_file_size_mb", e.target.value)} />
              </div>
            </div>
          )}

          <div className="asg-field" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label className="asg-switch-row">
              <span className={`asg-toggle ${d.is_required ? "on" : ""}`}
                onClick={() => set("is_required", !d.is_required)} />
              Mark as required
            </label>
            <label className="asg-switch-row">
              <span className={`asg-toggle ${d.status === "active" ? "on" : ""}`}
                onClick={() => set("status", d.status === "active" ? "inactive" : "active")} />
              Active (visible to students)
            </label>
          </div>

          <div className="asg-preview-box">
            <div className="asg-preview-head"><Eye size={13} /> Live preview</div>
            <PreviewField field={previewField} />
          </div>
        </div>

        <div className="asg-drawer-foot">
          <button className="asg-btn asg-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="asg-btn asg-btn-primary" disabled={saving} onClick={save}>
            {saving ? "Saving..." : "Save field"}
          </button>
        </div>
      </aside>
    </>
  );
}

/* ===========================================================================
   Submission form builder (palette + drag-and-drop flow)
   =========================================================================== */
function FormBuilder({ assignment }) {
  const [fields, setFields] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [overIdx, setOverIdx] = useState(null);
  const drag = useRef(null);
  const canvasRef = useRef(null);
  const prevLen = useRef(0);

  const load = useCallback(async () => {
    try { setFields((await A.listFields(assignment.id)).fields || []); }
    catch (e) { toast.error(e.message); setFields([]); }
  }, [assignment.id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (fields && prevLen.current > 0 && fields.length > prevLen.current) {
      const c = canvasRef.current;
      if (c) c.scrollTo({ top: c.scrollHeight, behavior: "smooth" });
    }
    prevLen.current = fields?.length || 0;
  }, [fields]);

  const addField = async (type, atIndex = null) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await A.createField({ assignment_id: assignment.id, ...defaultsFor(type) });
      if (atIndex !== null && fields) {
        const ids = fields.map((f) => f.id);
        ids.splice(atIndex, 0, res.id);
        await A.reorderFields(assignment.id, ids);
      }
      toast.success(`${TYPES[type].label} added`);
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const moveNode = async (from, to) => {
    if (from === to || from == null || to == null) return;
    const next = [...fields];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setFields(next);
    try { await A.reorderFields(assignment.id, next.map((f) => f.id)); }
    catch (e) { toast.error(e.message); load(); }
  };
  const removeField = async (f) => {
    if (!window.confirm(`Delete the field "${f.label}"?`)) return;
    try { await A.deleteField(f.id); toast.success("Field deleted"); await load(); }
    catch (e) { toast.error(e.message); }
  };
  const toggleField = async (f) => {
    try { await A.toggleField(f.id); await load(); }
    catch (e) { toast.error(e.message); }
  };

  const clearDrag = () => { drag.current = null; setDropActive(false); setOverIdx(null); };
  const onCanvasDrop = (e) => {
    e.preventDefault();
    if (drag.current?.kind === "palette") addField(drag.current.type);
    clearDrag();
  };

  if (fields === null) return <div className="asg-spinner" />;

  return (
    <div>
      <p className="asg-section-sub" style={{ marginTop: 4 }}>
        Drag a field type from the left onto the journey, or tap it to add a step.
        Each step is one field of the submission form students fill in this order.
      </p>
      <div className="asg-fb">
        <aside className="asg-fb-palette">
          <p className="asg-fb-palette-hint">Drag → drop onto the flow, or click to append a step.</p>
          {PALETTE.map((grp) => (
            <div key={grp.label}>
              <div className="asg-fb-pal-group">{grp.label}</div>
              <div className="asg-fb-pal-list">
                {grp.types.map((t) => {
                  const Icon = TYPES[t].icon;
                  return (
                    <button key={t} className="asg-fb-pal-item" draggable
                      onDragStart={() => { drag.current = { kind: "palette", type: t }; }}
                      onDragEnd={clearDrag}
                      onClick={() => addField(t)}>
                      <span className="asg-fb-pal-ico"><Icon size={15} /></span>
                      {TYPES[t].label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        <section
          ref={canvasRef}
          className={`asg-fb-canvas ${dropActive ? "drop-active" : ""}`}
          onDragOver={(e) => { e.preventDefault(); if (drag.current?.kind === "palette") setDropActive(true); }}
          onDragLeave={() => setDropActive(false)}
          onDrop={onCanvasDrop}
        >
          {fields.length === 0 ? (
            <div className="asg-fb-empty">
              <MousePointerClick size={34} />
              <h3>Build the submission form</h3>
              <p>Drag a field type here, or click one in the palette.</p>
            </div>
          ) : (
            <>
              <div className="asg-fb-flow">
                {fields.map((f, i) => {
                  const Icon = TYPES[f.field_type]?.icon || Type;
                  return (
                    <div key={f.id} className="asg-fb-step">
                      {overIdx === i && drag.current && <div className="asg-fb-drop-line" />}
                      <div className="asg-fb-badge">{i + 1}</div>
                      <div className={`asg-fb-node ${f.status === "inactive" ? "inactive" : ""}`}
                        draggable
                        onDragStart={() => { drag.current = { kind: "node", index: i }; }}
                        onDragEnd={clearDrag}
                        onDragOver={(e) => { e.preventDefault(); if (drag.current) setOverIdx(i); }}
                        onDrop={(e) => {
                          e.preventDefault(); e.stopPropagation();
                          const dd = drag.current;
                          if (dd?.kind === "node") moveNode(dd.index, i);
                          else if (dd?.kind === "palette") addField(dd.type, i);
                          clearDrag();
                        }}>
                        <span className="asg-fb-grip"><GripVertical size={16} /></span>
                        <span className="asg-fb-node-ico"><Icon size={17} /></span>
                        <div className="asg-fb-node-main" onClick={() => setEditing(f)}>
                          <div className="asg-fb-node-title">
                            {f.label}
                            {f.is_required ? <span className="asg-field-req">*</span> : null}
                          </div>
                          <div className="asg-fb-node-meta">
                            <span>{TYPES[f.field_type]?.label || f.field_type}</span>
                            {f.options?.length > 0 && <span>{f.options.length} option(s)</span>}
                            {f.is_required ? <span>required</span> : <span>optional</span>}
                            {f.status === "inactive" && <span>hidden</span>}
                          </div>
                        </div>
                        <div className="asg-fb-node-acts">
                          <button className="asg-btn asg-btn-ghost asg-btn-sm" onClick={() => setEditing(f)}>
                            <Pencil size={13} />
                          </button>
                          <button className="asg-btn asg-btn-ghost asg-btn-sm" onClick={() => toggleField(f)}>
                            {f.status === "active" ? "Hide" : "Show"}
                          </button>
                          <button className="asg-btn asg-btn-danger asg-btn-sm" onClick={() => removeField(f)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className={`asg-fb-add-end ${dropActive ? "drop-active" : ""}`}
                onDragOver={(e) => { e.preventDefault(); if (drag.current?.kind === "palette") setDropActive(true); }}
                onDrop={onCanvasDrop}>
                Drop a field here to add it at the end
              </div>
            </>
          )}
        </section>
      </div>

      {editing && (
        <FieldEditDrawer field={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

/* ===========================================================================
   Attachment manager — admin reference files (S3)
   =========================================================================== */
const BLANK_ATT = { title: "", description: "", placeholder: "", is_required: false, kind: "file", url: "" };

function AttachmentManager({ assignment }) {
  const [items, setItems] = useState(null);
  const [meta, setMeta] = useState(BLANK_ATT);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(null); // attachment being edited (meta only)
  const fileRef = useRef(null);
  const drag = useRef(null);
  const [overIdx, setOverIdx] = useState(null);
  /* re-upload (replace the file behind an existing row, keeping its id) */
  const reFileRef = useRef(null);
  const reTarget = useRef(null);
  const [replacingId, setReplacingId] = useState(null);

  const load = useCallback(async () => {
    try { setItems((await A.listAttachments(assignment.id)).attachments || []); }
    catch (e) { toast.error(e.message); setItems([]); }
  }, [assignment.id]);
  useEffect(() => { load(); }, [load]);

  const setMetaK = (k, v) => setMeta((p) => ({ ...p, [k]: v }));

  const upload = async () => {
    if (meta.kind === "link") {
      if (!meta.url.trim()) return toast.error("Enter a link URL");
    } else if (!file) {
      return toast.error("Choose a file to attach");
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("assignment_id", assignment.id);
      fd.append("kind", meta.kind);
      fd.append("title", meta.title);
      fd.append("description", meta.description);
      fd.append("placeholder", meta.placeholder);
      fd.append("is_required", meta.is_required ? "1" : "0");
      if (meta.kind === "link") fd.append("url", meta.url.trim());
      else fd.append("file", file);
      await A.createAttachment(fd);
      toast.success(meta.kind === "link" ? "Link added" : "Attachment uploaded");
      setMeta(BLANK_ATT); setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  const saveEdit = async () => {
    try {
      await A.updateAttachment({
        id: editing.id, title: editing.title || "", description: editing.description || "",
        placeholder: editing.placeholder || "", is_required: editing.is_required ? 1 : 0,
      });
      toast.success("Attachment updated");
      setEditing(null);
      await load();
    } catch (e) { toast.error(e.message); }
  };
  /* ---- re-upload -------------------------------------------------------
     Picks a replacement file for an EXISTING attachment. The row id, label,
     description, required flag and order all stay as they are — only the S3
     URL is refreshed — so every student submission linked to this id keeps
     working. The old URL is stored server-side and can be restored. */
  const pickReplacement = (it) => {
    reTarget.current = it;
    if (reFileRef.current) { reFileRef.current.value = ""; reFileRef.current.click(); }
  };
  const onReplacementChosen = async (e) => {
    const f = e.target.files?.[0];
    const it = reTarget.current;
    e.target.value = "";
    reTarget.current = null;
    if (!f || !it) return;
    const ok = window.confirm(
      `Replace the file behind "${it.title || it.file_name}"?\n\n` +
      `• "${f.name}" is uploaded to S3 and gets a fresh URL\n` +
      `• attachment id #${it.id} stays exactly the same\n` +
      `• the previous URL is saved so this can be reverted`
    );
    if (!ok) return;
    setReplacingId(it.id);
    try {
      const fd = new FormData();
      fd.append("id", it.id);
      fd.append("file", f);
      await A.reuploadAttachment(fd);
      toast.success("File replaced — new S3 URL saved on the same record");
      /* drawer copy would show the stale file name — close it */
      setEditing((p) => (p && p.id === it.id ? null : p));
      await load();
    } catch (err) { toast.error(err.message); }
    finally { setReplacingId(null); }
  };

  const remove = async (it) => {
    if (!window.confirm(`Remove "${it.title || it.file_name}"?`)) return;
    try { await A.deleteAttachment(it.id); toast.success("Attachment removed"); await load(); }
    catch (e) { toast.error(e.message); }
  };
  const moveItem = async (from, to) => {
    if (from == null || to == null || from === to || !items) return;
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setItems(next);
    try { await A.reorderAttachments(next.map((x) => x.id)); }
    catch (e) { toast.error(e.message); load(); }
  };

  return (
    <div>
      {/* upload card */}
      <div className="asg-card asg-att-upload">
        <div className="asg-card-title"><UploadCloud size={16} /> Add a reference attachment</div>
        <p className="asg-field-help" style={{ marginBottom: 14 }}>
          Upload any file — PPT, PDF, Excel, CSV, video, image, ZIP and more — or
          add an external link. Each item can carry its own label, description,
          placeholder and a required flag for students.
        </p>
        <div className="asg-kind-toggle">
          <button type="button" className={meta.kind === "file" ? "on" : ""}
            onClick={() => setMetaK("kind", "file")}><Upload size={14} /> Upload file</button>
          <button type="button" className={meta.kind === "link" ? "on" : ""}
            onClick={() => setMetaK("kind", "link")}><Link2 size={14} /> External link</button>
        </div>
        <div className="asg-row-2">
          <div className="asg-field">
            <label className="asg-field-label">Label / Title</label>
            <input className="asg-input" placeholder="e.g. Starter dataset"
              value={meta.title} onChange={(e) => setMetaK("title", e.target.value)} />
          </div>
          <div className="asg-field">
            <label className="asg-field-label">Placeholder hint</label>
            <input className="asg-input" placeholder="e.g. Download & use this template"
              value={meta.placeholder} onChange={(e) => setMetaK("placeholder", e.target.value)} />
          </div>
        </div>
        <div className="asg-field">
          <label className="asg-field-label">Description</label>
          <textarea className="asg-textarea" style={{ minHeight: 64 }} placeholder="What is this file for?"
            value={meta.description} onChange={(e) => setMetaK("description", e.target.value)} />
        </div>
        {meta.kind === "link" && (
          <div className="asg-field">
            <label className="asg-field-label">Link URL</label>
            <input className="asg-input" placeholder="https://… (Google Drive, dataset, doc, etc.)"
              value={meta.url} onChange={(e) => setMetaK("url", e.target.value)} />
          </div>
        )}
        <div className="asg-att-uprow">
          {meta.kind === "file" && (
            <>
              <button className="asg-btn asg-btn-ghost" onClick={() => fileRef.current?.click()}>
                <Paperclip size={14} /> {file ? "Change file" : "Choose file"}
              </button>
              {file && <span className="asg-att-chosen">{file.name} · {humanSize(file.size)}</span>}
            </>
          )}
          <label className="asg-switch-row" style={{ marginLeft: "auto" }}>
            <span className={`asg-toggle ${meta.is_required ? "on" : ""}`}
              onClick={() => setMetaK("is_required", !meta.is_required)} />
            Required
          </label>
          <button className="asg-btn asg-btn-primary"
            disabled={uploading || (meta.kind === "file" ? !file : !meta.url.trim())} onClick={upload}>
            {uploading ? "Saving..." : meta.kind === "link"
              ? <><Link2 size={14} /> Add link</>
              : <><Upload size={14} /> Upload</>}
          </button>
        </div>
        <input ref={fileRef} type="file" style={{ display: "none" }}
          onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </div>

      {/* list */}
      {items === null ? (
        <div className="asg-spinner" />
      ) : items.length === 0 ? (
        <div className="asg-empty">
          <FileStack size={32} />
          <h3>No attachments yet</h3>
          <p>Upload the first reference file for this assignment.</p>
        </div>
      ) : (
        <div className="asg-att-list">
          {items.map((it, i) => {
            const Icon = ATT_ICON[it.file_type] || Paperclip;
            return (
              <div key={it.id}>
                {overIdx === i && drag.current != null && drag.current !== i && (
                  <div className="asg-fb-drop-line" style={{ marginBottom: 8 }} />
                )}
                <div className="asg-att-item"
                  onDragOver={(e) => { e.preventDefault(); if (drag.current != null) setOverIdx(i); }}
                  onDrop={(e) => { e.preventDefault(); if (drag.current != null) moveItem(drag.current, i); drag.current = null; setOverIdx(null); }}>
                  <span className="asg-fb-grip" draggable title="Drag to reorder"
                    onDragStart={() => { drag.current = i; }}
                    onDragEnd={() => { drag.current = null; setOverIdx(null); }}>
                    <GripVertical size={16} />
                  </span>
                  <span className={`asg-att-ico t-${it.file_type}`}><Icon size={18} /></span>
                  <div className="asg-att-main">
                    <div className="asg-att-title">
                      {it.title || it.file_name}
                      {it.is_required ? <span className="asg-chip req"><Star size={10} /> required</span> : null}
                    </div>
                    {it.description && <div className="asg-att-desc">{it.description}</div>}
                    <div className="asg-att-meta">
                      <span className="asg-chip">{it.file_type}</span>
                      <span>{it.file_name}</span>
                      {it.file_size > 0 && <span>{humanSize(it.file_size)}</span>}
                    </div>
                  </div>
                  <div className="asg-att-acts">
                    <a className="asg-btn asg-btn-ghost asg-btn-sm" href={it.file_url} target="_blank" rel="noreferrer" title="Open / download">
                      <Download size={13} />
                    </a>
                    {it.kind !== "link" && (
                      <button className="asg-btn asg-btn-ghost asg-btn-sm asg-att-reup"
                        disabled={replacingId === it.id}
                        title="Re-upload — replace this file with a new S3 upload (record id stays the same)"
                        onClick={() => pickReplacement(it)}>
                        <RefreshCw size={13} className={replacingId === it.id ? "asg-rot" : ""} />
                        <span>{replacingId === it.id ? "Uploading…" : "Re-upload"}</span>
                      </button>
                    )}
                    <button className="asg-btn asg-btn-ghost asg-btn-sm" onClick={() => setEditing({ ...it })}>
                      <Pencil size={13} />
                    </button>
                    <button className="asg-btn asg-btn-danger asg-btn-sm" onClick={() => remove(it)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* hidden picker used by every row's "Re-upload" button */}
      <input ref={reFileRef} type="file" style={{ display: "none" }} onChange={onReplacementChosen} />

      {/* edit attachment meta drawer */}
      {editing && (
        <>
          <div className="asg-backdrop" onClick={() => setEditing(null)} />
          <aside className="asg-drawer">
            <div className="asg-drawer-head">
              <div>
                <div className="asg-drawer-eyebrow">Edit attachment</div>
                <div className="asg-drawer-title">{editing.title || editing.file_name}</div>
              </div>
              <button className="asg-close-btn" onClick={() => setEditing(null)}><X size={18} /></button>
            </div>
            <div className="asg-drawer-body">
              <div className="asg-field">
                <label className="asg-field-label">Label / Title</label>
                <input className="asg-input" value={editing.title || ""}
                  onChange={(e) => setEditing((p) => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="asg-field">
                <label className="asg-field-label">Placeholder hint</label>
                <input className="asg-input" value={editing.placeholder || ""}
                  onChange={(e) => setEditing((p) => ({ ...p, placeholder: e.target.value }))} />
              </div>
              <div className="asg-field">
                <label className="asg-field-label">Description</label>
                <textarea className="asg-textarea" value={editing.description || ""}
                  onChange={(e) => setEditing((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <label className="asg-switch-row">
                <span className={`asg-toggle ${editing.is_required ? "on" : ""}`}
                  onClick={() => setEditing((p) => ({ ...p, is_required: !p.is_required }))} />
                Mark as required
              </label>
              {editing.kind !== "link" && (
                <div className="asg-reup-box">
                  <div className="asg-reup-head"><RefreshCw size={14} /> Replace the uploaded file</div>
                  <p className="asg-field-help" style={{ margin: "6px 0 10px" }}>
                    Upload the file again to get a fresh S3 URL. Attachment id
                    <b> #{editing.id}</b> is not changed, so student submissions
                    attached to it are unaffected — and the old URL is kept for revert.
                  </p>
                  <div className="asg-att-meta" style={{ marginBottom: 10 }}>
                    <span className="asg-chip">current</span>
                    <span style={{ wordBreak: "break-all" }}>{editing.file_name}</span>
                  </div>
                  <button className="asg-btn asg-btn-ghost" disabled={replacingId === editing.id}
                    onClick={() => pickReplacement(editing)}>
                    <RefreshCw size={14} className={replacingId === editing.id ? "asg-rot" : ""} />
                    {replacingId === editing.id ? "Uploading…" : "Choose replacement file"}
                  </button>
                </div>
              )}
            </div>
            <div className="asg-drawer-foot">
              <button className="asg-btn asg-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="asg-btn asg-btn-primary" onClick={saveEdit}>Save changes</button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

/* ===========================================================================
   Assignment detail — meta editor + tabs (attachments / submission form)
   =========================================================================== */
function AssignmentDetail({ assignment, onBack, onChanged }) {
  const [tab, setTab] = useState("details");
  const [title, setTitle] = useState(assignment.title || "");
  const [description, setDescription] = useState(assignment.description || "");
  const [saving, setSaving] = useState(false);
  const dirty = title !== (assignment.title || "") || description !== (assignment.description || "");

  const save = async () => {
    if (!title.trim()) return toast.error("Title is required");
    setSaving(true);
    try {
      await A.updateAssignment({
        id: assignment.id, title, description, step_order: assignment.step_order || 1,
      });
      toast.success("Assignment saved");
      onChanged?.();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <button className="asg-link" onClick={onBack}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to assignments
      </button>

      <div className="asg-detail-head">
        <div>
          <div className="asg-eyebrow">Assignment</div>
          <h2 className="asg-detail-title">{assignment.title}</h2>
        </div>
      </div>

      <div className="asg-tabs">
        <button className={`asg-tab ${tab === "details" ? "active" : ""}`} onClick={() => setTab("details")}>
          <ClipboardList size={14} /> Details & attachments
        </button>
        <button className={`asg-tab ${tab === "form" ? "active" : ""}`} onClick={() => setTab("form")}>
          <Settings2 size={14} /> Submission form
        </button>
      </div>

      {tab === "details" ? (
        <div className="asg-fade">
          <div className="asg-card" style={{ marginBottom: 18 }}>
            <div className="asg-field">
              <label className="asg-field-label">Assignment title<span className="asg-field-req">*</span></label>
              <input className="asg-input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="asg-field" style={{ marginBottom: 8 }}>
              <label className="asg-field-label">Description</label>
              <RichEditor value={description} onChange={setDescription}
                placeholder="Describe the assignment — add images, tables, highlights, fonts…" />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="asg-btn asg-btn-primary" disabled={saving || !dirty} onClick={save}>
                {saving ? "Saving..." : dirty ? "Save changes" : "Saved"}
              </button>
            </div>
          </div>

          <div className="asg-section-head" style={{ marginBottom: 12 }}>
            <h3 className="asg-h3"><Paperclip size={15} /> Reference attachments</h3>
          </div>
          <AttachmentManager assignment={assignment} />
        </div>
      ) : (
        <div className="asg-fade">
          <FormBuilder assignment={assignment} />
        </div>
      )}
    </div>
  );
}

/* ===========================================================================
   New / edit assignment inline editor
   =========================================================================== */
function AssignmentCreate({ onSave, onCancel, saving }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  return (
    <div className="asg-card" style={{ marginBottom: 16 }}>
      <div className="asg-card-title"><Plus size={15} /> New assignment</div>
      <div className="asg-field">
        <label className="asg-field-label">Assignment title<span className="asg-field-req">*</span></label>
        <input className="asg-input" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Week 1 — Market research report" />
      </div>
      <div className="asg-field">
        <label className="asg-field-label">Description</label>
        <RichEditor value={description} onChange={setDescription}
          placeholder="Describe the assignment — add images, tables, highlights, fonts…" />
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="asg-btn asg-btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="asg-btn asg-btn-primary" disabled={saving || !title.trim()}
          onClick={() => onSave({ title, description })}>
          {saving ? "Saving..." : "Create assignment"}
        </button>
      </div>
    </div>
  );
}

/* ===========================================================================
   Main panel — domains -> assignments -> detail
   =========================================================================== */
function AssignmentApp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const domainId = searchParams.get("domain") || "";
  const assignmentId = searchParams.get("assignment") || "";

  const [domains, setDomains] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const drag = useRef(null);
  const [overIdx, setOverIdx] = useState(null);

  useEffect(() => {
    A.listDomains()
      .then((res) => setDomains(res.domains || []))
      .catch((e) => { toast.error(e.message); setDomains([]); });
  }, []);

  const loadAssignments = useCallback(async (id) => {
    if (!id) { setAssignments(null); return; }
    setLoadingList(true);
    try { setAssignments((await A.listAssignments(id)).assignments || []); }
    catch (e) { toast.error(e.message); setAssignments([]); }
    finally { setLoadingList(false); }
  }, []);

  useEffect(() => { setCreating(false); loadAssignments(domainId); }, [domainId, loadAssignments]);

  const domain = domains?.find((d) => String(d.internship_id) === domainId) || null;
  const current = assignments?.find((a) => String(a.id) === assignmentId) || null;

  const goDomains = () => setSearchParams({});
  const openDomain = (d) => setSearchParams({ domain: String(d.internship_id) });
  const openAssignment = (a) => setSearchParams({ domain: domainId, assignment: String(a.id) });
  const backToList = () => { setSearchParams({ domain: domainId }); loadAssignments(domainId); };

  const createAssignment = async ({ title, description }) => {
    setSaving(true);
    try {
      await A.createAssignment({ internship_id: domainId, title, description });
      toast.success("Assignment created");
      setCreating(false);
      await loadAssignments(domainId);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  const toggleAssignment = async (a) => {
    try { await A.toggleAssignment(a.id); await loadAssignments(domainId); }
    catch (e) { toast.error(e.message); }
  };
  const deleteAssignment = async (a) => {
    if (!window.confirm(`Delete "${a.title}" with all its attachments & form fields?`)) return;
    try { await A.deleteAssignment(a.id); toast.success("Assignment deleted"); await loadAssignments(domainId); }
    catch (e) { toast.error(e.message); }
  };
  const moveAssignment = async (from, to) => {
    if (from == null || to == null || from === to || !assignments) return;
    const next = [...assignments];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setAssignments(next);
    try { await A.reorderAssignments(next.map((a) => a.id)); }
    catch (e) { toast.error(e.message); loadAssignments(domainId); }
  };

  /* ---- ASSIGNMENT DETAIL ---- */
  if (domainId && assignmentId) {
    if (domains === null || assignments === null) return <div className="asg-spinner" />;
    if (current) {
      return <AssignmentDetail assignment={current} onBack={backToList}
        onChanged={() => loadAssignments(domainId)} />;
    }
    /* assignment gone — fall through to the list */
  }

  /* ---- DOMAINS GRID ---- */
  if (!domainId) {
    if (domains === null) return <div className="asg-spinner" />;
    const filtered = domains.filter((d) =>
      d.name.toLowerCase().includes(query.toLowerCase()) ||
      (d.short_name || "").toLowerCase().includes(query.toLowerCase()));
    return (
      <div>
        <div className="asg-hero">
          <div className="asg-hero-ico"><FileStack size={26} /></div>
          <div>
            <h2 className="asg-hero-title">Assignment Panel</h2>
            <p className="asg-hero-sub">
              Pick an internship to manage its assignments, reference files and dynamic submission forms.
            </p>
          </div>
        </div>
        <div className="asg-toolbar">
          <input className="asg-search" placeholder="Search internships…"
            value={query} onChange={(e) => setQuery(e.target.value)} />
          <span className="asg-count">{filtered.length} internship{filtered.length === 1 ? "" : "s"}</span>
        </div>
        {filtered.length === 0 ? (
          <div className="asg-empty"><Layers size={32} /><h3>No internships found</h3><p>Try a different search.</p></div>
        ) : (
          <div className="asg-grid asg-grid-domains">
            {filtered.map((d) => (
              <button key={d.internship_id} className="asg-domain-card" onClick={() => openDomain(d)}>
                <div className="asg-domain-icon"><Layers size={22} /></div>
                <div className="asg-domain-name">{d.name}</div>
                <div className="asg-domain-cat">{d.short_name}</div>
                <div className="asg-domain-foot">
                  <span><strong style={{ color: "var(--asg-text)" }}>{d.count}</strong> assignment{d.count === 1 ? "" : "s"}</span>
                  <span className="asg-link">Manage <ChevronRight size={13} /></span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ---- ASSIGNMENTS LIST for the selected domain ---- */
  if (domains === null) return <div className="asg-spinner" />;
  if (!domain) {
    return (
      <div>
        <button className="asg-link" onClick={goDomains}>
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> All internships
        </button>
        <div className="asg-empty"><Layers size={32} /><h3>Internship not found</h3>
          <p>This internship may have been hidden. Pick another one.</p></div>
      </div>
    );
  }

  return (
    <div>
      <button className="asg-link" onClick={goDomains}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> All internships
      </button>
      <div className="asg-section-head" style={{ marginTop: 10 }}>
        <h2 className="asg-h2">{domain.name} — assignments</h2>
        {!creating && (
          <button className="asg-btn asg-btn-primary asg-btn-sm" onClick={() => setCreating(true)}>
            <Plus size={14} /> New assignment
          </button>
        )}
      </div>

      {creating && (
        <AssignmentCreate onSave={createAssignment} onCancel={() => setCreating(false)} saving={saving} />
      )}

      {loadingList || assignments === null ? (
        <div className="asg-spinner" />
      ) : assignments.length === 0 && !creating ? (
        <div className="asg-empty">
          <ListChecks size={32} />
          <h3>No assignments yet</h3>
          <p>Create the first assignment for this internship.</p>
        </div>
      ) : (
        assignments.map((a, i) => (
          <div key={a.id}>
            {overIdx === i && drag.current != null && drag.current !== i && (
              <div className="asg-fb-drop-line" style={{ marginBottom: 8 }} />
            )}
            <div className="asg-task-card"
              onDragOver={(e) => { e.preventDefault(); if (drag.current != null) setOverIdx(i); }}
              onDrop={(e) => { e.preventDefault(); if (drag.current != null) moveAssignment(drag.current, i); drag.current = null; setOverIdx(null); }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 180 }}>
                  <span className="asg-fb-grip" draggable title="Drag to reorder" style={{ alignSelf: "center" }}
                    onDragStart={() => { drag.current = i; }}
                    onDragEnd={() => { drag.current = null; setOverIdx(null); }}>
                    <GripVertical size={16} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => openAssignment(a)}>
                    <div className="asg-step-title">{i + 1}. {a.title}</div>
                    <div className="asg-step-meta">
                      <span><Paperclip size={11} /> {a.attachment_count} attachment{a.attachment_count === 1 ? "" : "s"}</span>
                      <span><Settings2 size={11} /> {a.field_count} form field{a.field_count === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span className={`asg-pill ${a.status}`}>{a.status}</span>
                  <button className="asg-btn asg-btn-ghost asg-btn-sm" onClick={() => openAssignment(a)}>
                    <Settings2 size={13} /> Manage
                  </button>
                  <button className="asg-btn asg-btn-ghost asg-btn-sm" onClick={() => toggleAssignment(a)}>
                    {a.status === "active" ? "Disable" : "Enable"}
                  </button>
                  <button className="asg-btn asg-btn-danger asg-btn-sm" onClick={() => deleteAssignment(a)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ===========================================================================
   Scoped CSS — injected once
   =========================================================================== */
const ASG_CSS = `
.asg-root{--asg-bg-page:#f7f8fa;--asg-bg-surface:#fff;--asg-bg-soft:#f3f4f6;--asg-bg-softer:#fafafc;--asg-text:#1f2235;--asg-text-2:#5f6478;--asg-text-3:#9aa0b4;--asg-accent:#6366f1;--asg-accent-2:#a78bfa;--asg-accent-soft:#eef0ff;--asg-accent-text:#4f46e5;--asg-success:#10b981;--asg-success-soft:#ecfdf5;--asg-success-text:#047857;--asg-warning-soft:#fef3c7;--asg-warning-text:#b45309;--asg-danger:#ef4444;--asg-danger-soft:#fee2e2;--asg-danger-text:#b91c1c;--asg-info-soft:#e0f2fe;--asg-info-text:#0369a1;--asg-border:rgba(0,0,0,.07);--asg-border-2:rgba(0,0,0,.12);--asg-shadow-sm:0 1px 2px rgba(31,34,53,.05);--asg-shadow:0 2px 10px rgba(31,34,53,.08);--asg-shadow-lg:0 10px 30px rgba(31,34,53,.14);--asg-r-sm:8px;--asg-r:12px;--asg-r-lg:16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--asg-text);background:var(--asg-bg-page);}
.asg-root.asg-dark{--asg-bg-page:#0f1117;--asg-bg-surface:#181b24;--asg-bg-soft:#1f2330;--asg-bg-softer:#1a1d28;--asg-text:#e4e6ee;--asg-text-2:#a0a4b8;--asg-text-3:#6e7388;--asg-accent-soft:#2a2d4a;--asg-success-soft:#0a3328;--asg-danger-soft:#3a1818;--asg-border:rgba(255,255,255,.08);--asg-border-2:rgba(255,255,255,.16);}
.asg-root *,.asg-root *::before,.asg-root *::after{box-sizing:border-box;}
.asg-root button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit;padding:5px 10px;}
.asg-root input,.asg-root textarea,.asg-root select{font-family:inherit;}
.asg-page{padding:22px;}
.asg-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 0 14px;flex-wrap:wrap;}
.asg-h2{font-size:16px;font-weight:700;margin:0;}
.asg-h3{font-size:14px;font-weight:700;margin:0;display:inline-flex;align-items:center;gap:7px;}
.asg-section-sub{font-size:12.5px;color:var(--asg-text-2);margin:0 0 16px;line-height:1.55;}
.asg-eyebrow{font-size:10.5px;color:var(--asg-text-3);text-transform:uppercase;letter-spacing:.07em;font-weight:700;margin-bottom:3px;}
.asg-link{font-size:12.5px;color:var(--asg-accent-text);font-weight:600;display:inline-flex;align-items:center;gap:4px;}
.asg-link:hover{text-decoration:underline;}
.asg-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:13px;font-weight:600;padding:9px 16px;border-radius:var(--asg-r-sm);transition:opacity .15s,background .15s,transform .1s,box-shadow .15s;text-decoration:none;}
.asg-btn:active{transform:scale(.97);}
.asg-btn-primary{background:linear-gradient(135deg,var(--asg-accent-2),var(--asg-accent));color:#fff;box-shadow:0 4px 14px rgba(99,102,241,.32);}
.asg-btn-primary:hover{opacity:.94;box-shadow:0 6px 18px rgba(99,102,241,.4);}
.asg-btn-primary:disabled{opacity:.45;cursor:not-allowed;box-shadow:none;}
.asg-btn-ghost{background:var(--asg-bg-surface);border:1px solid var(--asg-border-2);color:var(--asg-text);}
.asg-btn-ghost:hover{background:var(--asg-bg-soft);}
.asg-btn-danger{background:var(--asg-danger-soft);color:var(--asg-danger-text);}
.asg-btn-danger:hover{filter:brightness(.97);}
.asg-btn-sm{padding:6px 11px;font-size:12px;}
.asg-card{background:var(--asg-bg-surface);border:1px solid var(--asg-border);border-radius:var(--asg-r);padding:18px;box-shadow:var(--asg-shadow-sm);}
.asg-card-title{font-size:13.5px;font-weight:700;display:flex;align-items:center;gap:8px;margin-bottom:6px;}
.asg-hero{display:flex;align-items:center;gap:16px;background:linear-gradient(120deg,var(--asg-accent-soft),var(--asg-bg-surface));border:1px solid var(--asg-border);border-radius:var(--asg-r-lg);padding:20px 22px;margin-bottom:18px;}
.asg-hero-ico{width:54px;height:54px;border-radius:14px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--asg-accent-2),var(--asg-accent));color:#fff;box-shadow:var(--asg-shadow);}
.asg-hero-title{font-size:19px;font-weight:800;margin:0;}
.asg-hero-sub{font-size:12.5px;color:var(--asg-text-2);margin:4px 0 0;max-width:560px;line-height:1.5;}
.asg-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;}
.asg-search{flex:1;min-width:200px;max-width:360px;padding:10px 14px;font-size:13px;border:1px solid var(--asg-border-2);border-radius:999px;background:var(--asg-bg-surface);color:var(--asg-text);outline:none;transition:border-color .15s,box-shadow .15s;}
.asg-search:focus{border-color:var(--asg-accent);box-shadow:0 0 0 3px var(--asg-accent-soft);}
.asg-count{font-size:12px;color:var(--asg-text-3);font-weight:600;}
.asg-grid{display:grid;gap:14px;}
.asg-grid-domains{grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px;padding:2px;}
.asg-domain-card{background:var(--asg-bg-surface);border:1px solid var(--asg-border-2);border-radius:var(--asg-r);padding:22px;text-align:left;width:100%;cursor:pointer;position:relative;overflow:hidden;box-shadow:var(--asg-shadow);transition:transform .16s cubic-bezier(.2,.7,.3,1),box-shadow .16s,border-color .16s;animation:asg-pop .28s ease both;}
.asg-domain-card:hover{transform:translateY(-4px);box-shadow:var(--asg-shadow-lg);border-color:var(--asg-accent);}
.asg-domain-card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--asg-accent-2),var(--asg-accent));transform:scaleX(0);transform-origin:left;transition:transform .2s;}
.asg-domain-card:hover::before{transform:scaleX(1);}
.asg-domain-icon{width:46px;height:46px;border-radius:var(--asg-r-sm);background:var(--asg-accent-soft);color:var(--asg-accent-text);display:flex;align-items:center;justify-content:center;margin-bottom:12px;}
.asg-domain-name{font-size:15px;font-weight:700;margin-bottom:3px;line-height:1.3;}
.asg-domain-cat{font-size:11.5px;color:var(--asg-text-3);text-transform:uppercase;letter-spacing:.04em;}
.asg-domain-foot{display:flex;align-items:center;justify-content:space-between;margin-top:16px;padding-top:12px;border-top:1px solid var(--asg-border);font-size:11.5px;color:var(--asg-text-2);}
.asg-task-card{background:var(--asg-bg-surface);border:1px solid var(--asg-border);border-radius:var(--asg-r);padding:16px 18px;margin-bottom:12px;width:100%;text-align:left;transition:border-color .14s,box-shadow .14s,transform .1s;animation:asg-pop .25s ease both;}
.asg-task-card:hover{border-color:var(--asg-border-2);box-shadow:var(--asg-shadow);}
.asg-step-title{font-size:14px;font-weight:700;}
.asg-step-meta{display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--asg-text-2);margin-top:8px;}
.asg-step-meta span{display:inline-flex;align-items:center;gap:5px;}
.asg-pill{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap;text-transform:capitalize;}
.asg-pill.active{background:var(--asg-success-soft);color:var(--asg-success-text);}
.asg-pill.inactive{background:var(--asg-bg-soft);color:var(--asg-text-3);}
.asg-field{margin-bottom:18px;}
.asg-field-label{font-size:13px;font-weight:700;margin-bottom:5px;display:block;}
.asg-field-req{color:var(--asg-danger);margin-left:3px;}
.asg-field-help{font-size:11.5px;color:var(--asg-text-3);margin:0 0 8px;line-height:1.5;}
.asg-input,.asg-textarea,.asg-select{width:100%;padding:10px 12px;font-size:13px;border:1px solid var(--asg-border-2);border-radius:var(--asg-r-sm);background:var(--asg-bg-soft);color:var(--asg-text);outline:none;transition:border-color .15s,background .15s,box-shadow .15s;}
.asg-input:focus,.asg-textarea:focus,.asg-select:focus{border-color:var(--asg-accent);background:var(--asg-bg-surface);box-shadow:0 0 0 3px var(--asg-accent-soft);}
.asg-textarea{resize:vertical;min-height:92px;line-height:1.55;}
.asg-upload{display:flex;align-items:center;gap:10px;padding:14px;border:1.5px dashed var(--asg-border-2);border-radius:var(--asg-r-sm);font-size:12.5px;color:var(--asg-text-2);background:var(--asg-bg-surface);}
.asg-opt-row{display:flex;align-items:center;gap:9px;padding:9px 11px;border:1px solid var(--asg-border);border-radius:var(--asg-r-sm);margin-bottom:7px;font-size:13px;cursor:pointer;background:var(--asg-bg-surface);}
.asg-opt-row.checked{border-color:var(--asg-accent);background:var(--asg-accent-soft);}
.asg-opt-row input{accent-color:var(--asg-accent);width:16px;height:16px;}
.asg-row-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.asg-switch-row{display:flex;align-items:center;gap:9px;font-size:13px;font-weight:600;cursor:pointer;}
.asg-empty{text-align:center;padding:54px 20px;color:var(--asg-text-3);}
.asg-empty h3{font-size:14.5px;color:var(--asg-text-2);margin:10px 0 3px;}
.asg-empty p{font-size:12.5px;margin:0;}
.asg-spinner{width:30px;height:30px;border-radius:50%;border:3px solid var(--asg-bg-soft);border-top-color:var(--asg-accent);animation:asg-spin .7s linear infinite;margin:50px auto;}
@keyframes asg-spin{to{transform:rotate(360deg);}}
@keyframes asg-pop{from{opacity:0;transform:translateY(7px);}to{opacity:1;transform:none;}}
.asg-fade{animation:asg-fade .22s ease both;}
@keyframes asg-fade{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}
.asg-toggle{width:38px;height:22px;border-radius:999px;background:var(--asg-bg-soft);position:relative;transition:background .15s;flex-shrink:0;border:1px solid var(--asg-border-2);}
.asg-toggle.on{background:var(--asg-accent);border-color:var(--asg-accent);}
.asg-toggle::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s;box-shadow:0 1px 2px rgba(0,0,0,.25);}
.asg-toggle.on::after{transform:translateX(16px);}
.asg-backdrop{position:fixed;inset:0;background:rgba(15,17,23,.55);z-index:1200;animation:asg-fadein .18s ease;}
@keyframes asg-fadein{from{opacity:0;}to{opacity:1;}}
.asg-drawer{position:fixed;top:0;right:0;bottom:0;width:min(620px,96vw);background:var(--asg-bg-surface);border-left:1px solid var(--asg-border);z-index:1201;display:flex;flex-direction:column;box-shadow:var(--asg-shadow-lg);animation:asg-slide .24s cubic-bezier(.2,.7,.3,1);}
@keyframes asg-slide{from{transform:translateX(40px);opacity:.4;}to{transform:none;opacity:1;}}
.asg-drawer-head{padding:18px 22px;border-bottom:1px solid var(--asg-border);display:flex;align-items:flex-start;justify-content:space-between;gap:14px;}
.asg-drawer-eyebrow{font-size:10.5px;color:var(--asg-text-3);text-transform:uppercase;letter-spacing:.07em;font-weight:700;margin-bottom:4px;}
.asg-drawer-title{font-size:17px;font-weight:700;line-height:1.3;}
.asg-drawer-body{padding:22px;overflow-y:auto;flex:1;}
.asg-drawer-foot{padding:14px 22px;border-top:1px solid var(--asg-border);display:flex;gap:10px;align-items:center;justify-content:flex-end;background:var(--asg-bg-surface);}
.asg-close-btn{width:32px;height:32px;border-radius:var(--asg-r-sm);flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--asg-bg-soft);color:var(--asg-text-2);}
.asg-close-btn:hover{background:var(--asg-bg-softer);color:var(--asg-text);}
.asg-preview-box{background:var(--asg-bg-soft);border-radius:10px;padding:14px;}
.asg-preview-head{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--asg-text-3);margin-bottom:10px;display:flex;align-items:center;gap:6px;}
/* rich text editor */
.asg-rte{border:1px solid var(--asg-border-2);border-radius:var(--asg-r-sm);background:var(--asg-bg-soft);overflow:hidden;}
.asg-rte:focus-within{border-color:var(--asg-accent);background:var(--asg-bg-surface);}
.asg-rte-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:2px;padding:6px;background:var(--asg-bg-surface);border-bottom:1px solid var(--asg-border);}
.asg-rte-font{height:28px;border:1px solid var(--asg-border);border-radius:6px;background:var(--asg-bg-soft);color:var(--asg-text);font-size:12px;padding:0 6px;cursor:pointer;}
.asg-rte-btn{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;padding:0 6px;border-radius:6px;background:transparent;color:var(--asg-text-2);cursor:pointer;}
.asg-rte-btn:hover,.asg-rte-btn.active{background:var(--asg-accent-soft);color:var(--asg-accent-text);}
.asg-rte-sep{width:1px;height:18px;margin:0 4px;background:var(--asg-border);}
.asg-rte-color{display:inline-flex;align-items:center;gap:3px;height:28px;padding:0 5px;border-radius:6px;color:var(--asg-text-2);cursor:pointer;}
.asg-rte-color:hover{background:var(--asg-accent-soft);color:var(--asg-accent-text);}
.asg-rte-color input[type=color]{width:20px;height:20px;padding:0;border:none;border-radius:4px;background:none;cursor:pointer;}
.asg-rte-color input[type=color]::-webkit-color-swatch{border:1px solid var(--asg-border-2);border-radius:4px;}
.asg-rte-color input[type=color]::-webkit-color-swatch-wrapper{padding:0;}
.asg-rte-uploading{font-size:11px;color:var(--asg-accent-text);font-weight:600;margin-left:6px;}
.asg-rte-imgbar{display:flex;align-items:center;gap:6px;padding:7px 10px;background:var(--asg-accent-soft);border-bottom:1px solid var(--asg-border);font-size:11.5px;font-weight:600;color:var(--asg-accent-text);}
.asg-rte-imgbar button{font-size:11px;font-weight:700;padding:3px 9px;border-radius:6px;background:var(--asg-bg-surface);border:1px solid var(--asg-border-2);color:var(--asg-text-2);}
.asg-rte-imgbar button:hover{border-color:var(--asg-accent);color:var(--asg-accent-text);}
.asg-rte-imgbar-x{margin-left:auto;}
.asg-rte-area{min-height:150px;max-height:420px;overflow-y:auto;padding:12px 14px;font-size:13px;line-height:1.6;color:var(--asg-text);outline:none;}
.asg-rte-area:empty:before{content:attr(data-placeholder);color:var(--asg-text-3);}
.asg-rte-area img{max-width:100%;height:auto;border-radius:6px;margin:4px 0;cursor:pointer;}
.asg-rte-area img:hover{outline:2px solid var(--asg-accent);outline-offset:2px;}
.asg-rte-area table{border-collapse:collapse;margin:8px 0;max-width:100%;}
.asg-rte-area td,.asg-rte-area th{border:1px solid var(--asg-border-2);padding:6px 10px;min-width:48px;vertical-align:top;}
.asg-rte-area th{background:var(--asg-bg-soft);font-weight:700;}
/* detail / tabs */
.asg-detail-head{margin:12px 0 6px;}
.asg-detail-title{font-size:18px;font-weight:800;margin:0;}
.asg-tabs{display:flex;gap:6px;border-bottom:1px solid var(--asg-border);margin:14px 0 18px;}
.asg-tab{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600;padding:10px 14px;border-radius:8px 8px 0 0;color:var(--asg-text-2);position:relative;transition:color .15s,background .15s;}
.asg-tab:hover{color:var(--asg-text);background:var(--asg-bg-soft);}
.asg-tab.active{color:var(--asg-accent-text);}
.asg-tab.active::after{content:"";position:absolute;left:10px;right:10px;bottom:-1px;height:2.5px;border-radius:2px;background:linear-gradient(90deg,var(--asg-accent-2),var(--asg-accent));}
/* attachments */
.asg-att-upload{margin-bottom:18px;}
.asg-kind-toggle{display:inline-flex;gap:2px;padding:3px;background:var(--asg-bg-soft);border:1px solid var(--asg-border-2);border-radius:10px;margin-bottom:14px;}
.asg-kind-toggle button{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;padding:7px 14px;border-radius:7px;color:var(--asg-text-2);transition:background .14s,color .14s;}
.asg-kind-toggle button.on{background:var(--asg-bg-surface);color:var(--asg-accent-text);box-shadow:var(--asg-shadow-sm);}
.asg-att-uprow{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
.asg-att-chosen{font-size:12px;color:var(--asg-text-2);font-weight:600;}
.asg-att-list{display:flex;flex-direction:column;gap:10px;}
.asg-att-item{display:flex;align-items:center;gap:12px;background:var(--asg-bg-surface);border:1px solid var(--asg-border);border-radius:var(--asg-r);padding:13px 15px;transition:border-color .14s,box-shadow .14s;animation:asg-pop .22s ease both;}
.asg-att-item:hover{border-color:var(--asg-border-2);box-shadow:var(--asg-shadow);}
.asg-att-ico{width:40px;height:40px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--asg-accent-soft);color:var(--asg-accent-text);}
.asg-att-ico.t-pdf{background:#fee2e2;color:#b91c1c;}
.asg-att-ico.t-excel{background:#dcfce7;color:#15803d;}
.asg-att-ico.t-ppt{background:#ffedd5;color:#c2410c;}
.asg-att-ico.t-video{background:#ede9fe;color:#6d28d9;}
.asg-att-ico.t-image{background:#e0f2fe;color:#0369a1;}
.asg-att-ico.t-zip{background:#fef9c3;color:#a16207;}
.asg-att-main{flex:1;min-width:0;}
.asg-att-title{font-size:13.5px;font-weight:700;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.asg-att-desc{font-size:12px;color:var(--asg-text-2);margin-top:3px;line-height:1.45;}
.asg-att-meta{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--asg-text-3);margin-top:6px;align-items:center;}
.asg-att-acts{display:flex;gap:5px;flex-shrink:0;align-items:center;}
/* re-upload (replace the S3 file, keep the record id) */
.asg-att-reup{gap:6px;}
.asg-att-reup span{font-size:11.5px;font-weight:600;}
.asg-att-reup:hover:not(:disabled){border-color:var(--asg-accent);color:var(--asg-accent-text);}
.asg-att-reup:disabled{opacity:.6;cursor:not-allowed;}
.asg-reup-box{margin-top:16px;padding:14px;border:1px dashed var(--asg-border-2);border-radius:var(--asg-r);background:var(--asg-bg-soft);}
.asg-reup-head{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:var(--asg-text);}
.asg-rot{animation:asg-spin .8s linear infinite;}
.asg-chip{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--asg-bg-soft);color:var(--asg-text-2);text-transform:uppercase;letter-spacing:.03em;}
.asg-chip.req{background:var(--asg-danger-soft);color:var(--asg-danger-text);}
/* form builder */
.asg-fb{display:grid;grid-template-columns:236px 1fr;gap:16px;align-items:start;}
.asg-fb-palette{background:var(--asg-bg-surface);border:1px solid var(--asg-border);border-radius:var(--asg-r);padding:12px;position:sticky;top:8px;}
.asg-fb-palette-hint{font-size:11px;color:var(--asg-text-3);margin:0 4px 10px;line-height:1.5;}
.asg-fb-pal-group{font-size:9.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--asg-text-3);padding:10px 4px 5px;}
.asg-fb-pal-item{display:flex;align-items:center;gap:9px;width:100%;padding:9px 10px;margin-bottom:5px;border-radius:var(--asg-r-sm);border:1px solid var(--asg-border);background:var(--asg-bg-soft);font-size:12px;font-weight:600;color:var(--asg-text-2);cursor:grab;text-align:left;transition:border-color .13s,background .13s,color .13s,transform .1s;}
.asg-fb-pal-item:hover{border-color:var(--asg-accent);color:var(--asg-accent-text);background:var(--asg-accent-soft);transform:translateX(2px);}
.asg-fb-pal-ico{width:26px;height:26px;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--asg-accent-soft);color:var(--asg-accent-text);}
.asg-fb-canvas{background:var(--asg-bg-softer);border:1px solid var(--asg-border);border-radius:var(--asg-r);padding:18px;min-height:320px;max-height:calc(100vh - 260px);overflow-y:auto;transition:background .15s,border-color .15s;}
.asg-fb-canvas.drop-active{border-color:var(--asg-accent);border-style:dashed;background:var(--asg-accent-soft);}
.asg-fb-empty{border:2px dashed var(--asg-border-2);border-radius:var(--asg-r);padding:48px 20px;text-align:center;color:var(--asg-text-3);}
.asg-fb-empty h3{font-size:14px;color:var(--asg-text-2);margin:10px 0 3px;}
.asg-fb-empty p{font-size:12px;margin:0;}
.asg-fb-flow{position:relative;padding-left:40px;}
.asg-fb-flow::before{content:"";position:absolute;left:17px;top:14px;bottom:26px;width:2px;background:repeating-linear-gradient(to bottom,var(--asg-accent) 0 6px,transparent 6px 12px);opacity:.5;}
.asg-fb-step{position:relative;margin-bottom:12px;}
.asg-fb-badge{position:absolute;left:-40px;top:16px;width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--asg-accent-2),var(--asg-accent));color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;z-index:1;box-shadow:var(--asg-shadow-sm);}
.asg-fb-node{background:var(--asg-bg-surface);border:1px solid var(--asg-border);border-radius:var(--asg-r);padding:13px 14px;display:flex;align-items:center;gap:11px;transition:border-color .13s,box-shadow .13s;}
.asg-fb-node:hover{border-color:var(--asg-border-2);box-shadow:var(--asg-shadow);}
.asg-fb-node.inactive{opacity:.55;}
.asg-fb-grip{color:var(--asg-text-3);cursor:grab;flex-shrink:0;display:flex;}
.asg-fb-node-ico{width:34px;height:34px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--asg-accent-soft);color:var(--asg-accent-text);}
.asg-fb-node-main{flex:1;min-width:0;cursor:pointer;}
.asg-fb-node-title{font-size:13px;font-weight:700;}
.asg-fb-node-meta{display:flex;gap:10px;flex-wrap:wrap;font-size:10.5px;color:var(--asg-text-3);margin-top:3px;}
.asg-fb-node-acts{display:flex;gap:5px;flex-shrink:0;}
.asg-fb-drop-line{height:2px;background:var(--asg-accent);border-radius:2px;margin:2px 0;box-shadow:0 0 6px var(--asg-accent);}
.asg-fb-add-end{position:sticky;bottom:0;z-index:2;margin-left:40px;margin-top:8px;border:1.5px dashed var(--asg-border-2);border-radius:var(--asg-r-sm);padding:11px;text-align:center;font-size:12px;color:var(--asg-text-3);background:var(--asg-bg-softer);}
.asg-fb-add-end.drop-active{border-color:var(--asg-accent);color:var(--asg-accent-text);background:var(--asg-accent-soft);}
@media (max-width:860px){.asg-fb{grid-template-columns:1fr;}.asg-fb-palette{position:static;}.asg-fb-pal-list{display:flex;gap:7px;overflow-x:auto;padding-bottom:4px;}.asg-fb-pal-list .asg-fb-pal-item{width:auto;white-space:nowrap;margin-bottom:0;flex-shrink:0;}.asg-fb-pal-group{display:none;}.asg-row-2{grid-template-columns:1fr;}.asg-drawer{width:100vw;}.asg-grid-domains{grid-template-columns:1fr;}}
`;

let cssDone = false;
function injectCss() {
  if (cssDone || typeof document === "undefined") return;
  cssDone = true;
  const el = document.createElement("style");
  el.id = "assignment-panel-css";
  el.textContent = ASG_CSS;
  document.head.appendChild(el);
}

/* ===========================================================================
   Default export
   =========================================================================== */
export default function AssignmentPanel({ dark = false }) {
  injectCss();
  return (
    <div className={`asg-root ${dark ? "asg-dark" : ""}`}>
      <div className="asg-page" style={{ minHeight: "100%" }}>
        <AssignmentApp />
      </div>
    </div>
  );
}
