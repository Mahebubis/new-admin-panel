// ===========================================================================
//  SimAdminPanelSingle.jsx
//  SINGLE-FILE admin panel for the Internship Simulation.
//  Drop this one file into your React admin project and render it.
//
//  Usage:
//      import SimAdminPanelSingle from "./SimAdminPanelSingle";
//      ...
//      <SimAdminPanelSingle dark={isDarkMode} />
//      // also mount <Toaster/> from react-hot-toast once in your app
//
//  npm dependencies: react, react-hot-toast, lucide-react, react-select
//
//  Backend: talks to sim_admin_api.php (single PHP file). Set SIM_ADMIN_API
//  below to wherever you host it.
// ===========================================================================
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import toast from "react-hot-toast";
import Select from "react-select";
import { useSearchParams } from "react-router-dom";
import {
  ChevronRight, Plus, Pencil, Trash2, Layers, ListChecks, Settings2,
  GripVertical, X, Eye, MousePointerClick,
  Type, AlignLeft, Hash, Calendar, Link2, Image as ImageIcon, Film,
  FileText, FileSpreadsheet, Presentation, Paperclip, ListFilter,
  CircleDot, CheckSquare, Upload, Bold, Italic, Underline, List,
  ListOrdered, Eraser, Table, Highlighter, Baseline, ImagePlus,
} from "lucide-react";

/* ===========================================================================
   CONFIG — point this at your sim_admin_api.php
   Uses the same backend base as the rest of the admin panel (src/api/axios.js).
   =========================================================================== */
const SIM_ADMIN_API = `${import.meta.env.VITE_API_URL || "https://cit3.internshipstudio.com/admin/react-api"}/api/internship-system/sim_admin_api.php`;

/* ===========================================================================
   API helpers
   =========================================================================== */
async function api(qs, body) {
  // No credentials: the backend has no session auth and the API sends
  // Access-Control-Allow-Origin: * (a wildcard is invalid with credentials).
  // cache:"no-store" + a cache-buster defeat the .htaccess 30s JSON cache so
  // every list reflects the latest state in real time.
  const opts = { method: body ? "POST" : "GET", cache: "no-store" };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${SIM_ADMIN_API}?${qs}&_=${Date.now()}`, opts);
  let json;
  try { json = await res.json(); }
  catch { throw new Error("Server returned an invalid response"); }
  if (!res.ok || json.status === "error") {
    throw new Error(json?.message || `Request failed (${res.status})`);
  }
  return json.data ?? json;
}
const A = {
  listDomains: () => api("resource=domains"),
  listTasks: (id) => api(`resource=tasks&action=list&internship_id=${id}`),
  createTask: (d) => api("resource=tasks&action=create", d),
  updateTask: (d) => api("resource=tasks&action=update", d),
  toggleTask: (id) => api("resource=tasks&action=toggle", { id }),
  deleteTask: (id) => api("resource=tasks&action=delete", { id }),
  reorderTasks: (order) => api("resource=tasks&action=reorder", { order }),
  listFields: (taskId) => api(`resource=fields&action=list&task_id=${taskId}`),
  createField: (d) => api("resource=fields&action=create", d),
  updateField: (d) => api("resource=fields&action=update", d),
  toggleField: (id) => api("resource=fields&action=toggle", { id }),
  deleteField: (id) => api("resource=fields&action=delete", { id }),
  reorderFields: (task_id, order) => api("resource=fields&action=reorder", { task_id, order }),
};

/* ===========================================================================
   Field type catalogue
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
const SINGLE_CHOICE = ["dropdown_single", "radio"];
const groupOf = (t) => TYPES[t]?.group;
const slug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30);

function defaultsFor(type) {
  const base = {
    field_type: type, label: TYPES[type].label, placeholder: "", help_text: "",
    is_required: 1, weight: 1, status: "active",
    options: [], correct_answers: [], keywords: [],
    keyword_match_mode: "any", min_keywords: 1,
    number_min: "", number_max: "", number_correct: "",
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
  const correct = f.correct_answers || [];
  return {
    id: f.id, field_type: f.field_type, label: f.label || "",
    placeholder: f.placeholder || "", help_text: f.help_text || "",
    is_required: !!f.is_required, weight: f.weight || 1, status: f.status || "active",
    options: (f.options || []).map((o) => ({
      value: o.value, label: o.label, correct: correct.includes(o.value),
    })),
    keywords: f.keywords || [], keyword_match_mode: f.keyword_match_mode || "any",
    min_keywords: f.min_keywords || 1,
    number_min: f.number_min ?? "", number_max: f.number_max ?? "",
    number_correct: f.number_correct ?? "",
    accepted_extensions: f.accepted_extensions || "", max_file_size_mb: f.max_file_size_mb || 25,
  };
}

const selectStyles = {
  control: (b, s) => ({
    ...b, minHeight: 40, background: "var(--sim-bg-soft)",
    borderColor: s.isFocused ? "var(--sim-accent)" : "var(--sim-border-2)",
    boxShadow: "none", borderRadius: 8, fontSize: 13,
  }),
  menu: (b) => ({ ...b, background: "var(--sim-bg-surface)", zIndex: 50, fontSize: 13 }),
  option: (b, s) => ({
    ...b, fontSize: 13,
    background: s.isSelected ? "var(--sim-accent)" : s.isFocused ? "var(--sim-accent-soft)" : "transparent",
    color: s.isSelected ? "#fff" : "var(--sim-text)",
  }),
  singleValue: (b) => ({ ...b, color: "var(--sim-text)" }),
  multiValue: (b) => ({ ...b, background: "var(--sim-accent-soft)" }),
  multiValueLabel: (b) => ({ ...b, color: "var(--sim-accent-text)" }),
  input: (b) => ({ ...b, color: "var(--sim-text)" }),
  placeholder: (b) => ({ ...b, color: "var(--sim-text-3)" }),
};

/* ===========================================================================
   Live-preview field renderer (used inside the field editor)
   =========================================================================== */
function PreviewField({ field }) {
  const f = field;
  const [val, setVal] = useState(undefined);
  const t = f.field_type;

  let control = null;
  if (FILE_TYPES.includes(t)) {
    control = (
      <div className="sim-upload" style={{ cursor: "default" }}>
        <Upload size={16} /> Student uploads a {TYPES[t]?.label.toLowerCase() || "file"} here
      </div>
    );
  } else if (t === "text" || t === "url") {
    control = <input className="sim-input" placeholder={f.placeholder || ""}
      value={val || ""} onChange={(e) => setVal(e.target.value)} />;
  } else if (t === "textarea") {
    control = <textarea className="sim-textarea" placeholder={f.placeholder || ""}
      value={val || ""} onChange={(e) => setVal(e.target.value)} />;
  } else if (t === "number") {
    control = <input className="sim-input" type="number" placeholder={f.placeholder || ""}
      value={val ?? ""} onChange={(e) => setVal(e.target.value)} />;
  } else if (t === "date") {
    control = <input className="sim-input" type="date" value={val || ""}
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
      <label key={o.value} className={`sim-opt-row ${val === o.value ? "checked" : ""}`}>
        <input type="radio" checked={val === o.value} onChange={() => setVal(o.value)} />
        {o.label}
      </label>
    ));
  } else if (t === "checkbox") {
    const arr = Array.isArray(val) ? val : [];
    control = f.options.map((o) => {
      const c = arr.includes(o.value);
      return (
        <label key={o.value} className={`sim-opt-row ${c ? "checked" : ""}`}>
          <input type="checkbox" checked={c}
            onChange={() => setVal(c ? arr.filter((x) => x !== o.value) : [...arr, o.value])} />
          {o.label}
        </label>
      );
    });
  }

  return (
    <div className="sim-field">
      <label className="sim-field-label">
        {f.label || "Untitled field"}
        {f.is_required ? <span className="sim-field-req">*</span> : null}
      </label>
      {f.help_text && <p className="sim-field-help">{f.help_text}</p>}
      {control}
    </div>
  );
}

/* ===========================================================================
   Mini rich-text editor (for task description)
   =========================================================================== */
function RteBtn({ icon: Ic, text, title, onAction }) {
  return (
    <button type="button" className="sim-rte-btn" title={title}
      onMouseDown={(e) => { e.preventDefault(); onAction(); }}>
      {Ic ? <Ic size={14} /> : <span style={{ fontWeight: 800 }}>{text}</span>}
    </button>
  );
}

function MiniRichText({ value, onChange, placeholder }) {
  const ref = useRef(null);
  const fileRef = useRef(null);
  const savedRange = useRef(null);
  const sizeRef = useRef(3); // execCommand fontSize 1..7

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) {
      ref.current.innerHTML = value || "";
    }
  }, []);

  const emit = () => onChange(ref.current?.innerHTML || "");

  /* selection is lost while OS dialogs (color picker / file picker) are open,
     so we snapshot the caret/selection and restore it before inserting. */
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

  const fileToDataUrl = (file) =>
    new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.readAsDataURL(file);
    });
  const insertImageFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = await fileToDataUrl(file);
    insertHtml(`<img src="${url}" alt="" style="max-width:100%;border-radius:6px;" />`);
  };
  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    if (file) await insertImageFile(file);
    e.target.value = "";
  };

  /* paste a screenshot / copied image straight into the editor */
  const onPaste = async (e) => {
    const items = e.clipboardData?.items || [];
    for (const it of items) {
      if (it.type && it.type.startsWith("image/")) {
        e.preventDefault();
        saveSel();
        const file = it.getAsFile();
        if (file) await insertImageFile(file);
        return;
      }
    }
    // not an image — let the browser paste normally
  };

  return (
    <div className="sim-rte">
      <div className="sim-rte-toolbar">
        <RteBtn icon={Bold} title="Bold" onAction={() => exec("bold")} />
        <RteBtn icon={Italic} title="Italic" onAction={() => exec("italic")} />
        <RteBtn icon={Underline} title="Underline" onAction={() => exec("underline")} />
        <span className="sim-rte-sep" />
        <RteBtn text="A−" title="Decrease font size" onAction={() => changeSize(-1)} />
        <RteBtn text="A+" title="Increase font size" onAction={() => changeSize(1)} />
        <span className="sim-rte-sep" />
        <label className="sim-rte-color" title="Text color">
          <Baseline size={14} />
          <input type="color" defaultValue="#1f2235" onMouseDown={saveSel}
            onInput={(e) => applyColor("foreColor", e.target.value)} />
        </label>
        <label className="sim-rte-color" title="Highlight color">
          <Highlighter size={14} />
          <input type="color" defaultValue="#fff3a0" onMouseDown={saveSel}
            onInput={(e) => applyColor("hiliteColor", e.target.value)} />
        </label>
        <span className="sim-rte-sep" />
        <RteBtn icon={List} title="Bullet list" onAction={() => exec("insertUnorderedList")} />
        <RteBtn icon={ListOrdered} title="Numbered list" onAction={() => exec("insertOrderedList")} />
        <span className="sim-rte-sep" />
        <RteBtn icon={Link2} title="Link" onAction={() => {
          const url = window.prompt("Link URL");
          if (url) exec("createLink", url);
        }} />
        <RteBtn icon={ImagePlus} title="Insert image" onAction={() => {
          saveSel();
          fileRef.current?.click();
        }} />
        <RteBtn icon={Table} title="Insert table" onAction={insertTable} />
        <RteBtn icon={Eraser} title="Clear formatting" onAction={() => exec("removeFormat")} />
      </div>
      <div
        ref={ref}
        className="sim-rte-area"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder || "Write a description..."}
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
        onKeyUp={saveSel}
        onMouseUp={saveSel}
      />
      <input ref={fileRef} type="file" accept="image/*"
        style={{ display: "none" }} onChange={onPickImage} />
    </div>
  );
}

/* ===========================================================================
   Field edit drawer
   =========================================================================== */
function FieldEditDrawer({ field, onClose, onSaved }) {
  const [d, setD] = useState(() => toDraft(field));
  const [kw, setKw] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
  const grp = groupOf(d.field_type);

  const addOption = () => {
    const n = d.options.length + 1;
    set("options", [...d.options, { value: `option_${n}`, label: `Option ${n}`, correct: false }]);
  };
  const updOption = (i, k, v) => {
    const next = d.options.map((o, idx) => (idx === i ? { ...o, [k]: v } : o));
    if (k === "label" && next[i].value.startsWith("option_")) next[i].value = slug(v) || `option_${i + 1}`;
    set("options", next);
  };
  const markCorrect = (i) => {
    const single = SINGLE_CHOICE.includes(d.field_type);
    set("options", d.options.map((o, idx) => ({
      ...o, correct: single ? idx === i : (idx === i ? !o.correct : o.correct),
    })));
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
        help_text: d.help_text, is_required: d.is_required ? 1 : 0,
        weight: d.weight, status: d.status,
        options: d.options.map((o) => ({ value: o.value, label: o.label })),
        correct_answers: d.options.filter((o) => o.correct).map((o) => o.value),
        keywords: d.keywords, keyword_match_mode: d.keyword_match_mode, min_keywords: d.min_keywords,
        number_min: d.number_min, number_max: d.number_max, number_correct: d.number_correct,
        accepted_extensions: d.accepted_extensions, max_file_size_mb: d.max_file_size_mb,
      });
      toast.success("Field saved");
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="sim-backdrop" onClick={onClose} />
      <aside className="sim-drawer">
        <div className="sim-drawer-head">
          <div>
            <div className="sim-drawer-eyebrow">Edit field</div>
            <div className="sim-drawer-title">{d.label || "Untitled field"}</div>
          </div>
          <button className="sim-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="sim-drawer-body">
          <div className="sim-field">
            <label className="sim-field-label">Field type</label>
            <select className="sim-select" value={d.field_type}
              onChange={(e) => set("field_type", e.target.value)}>
              {Object.entries(TYPES).map(([t, m]) => (
                <option key={t} value={t}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="sim-field">
            <label className="sim-field-label">Label / Question<span className="sim-field-req">*</span></label>
            <input className="sim-input" value={d.label} onChange={(e) => set("label", e.target.value)} />
          </div>
          <div className="sim-row-2">
            <div className="sim-field">
              <label className="sim-field-label">Placeholder</label>
              <input className="sim-input" value={d.placeholder} onChange={(e) => set("placeholder", e.target.value)} />
            </div>
            <div className="sim-field">
              <label className="sim-field-label">Help text</label>
              <input className="sim-input" value={d.help_text} onChange={(e) => set("help_text", e.target.value)} />
            </div>
          </div>

          {grp === "text" && (
            <div className="sim-field">
              <label className="sim-field-label">Evaluation keywords</label>
              <p className="sim-field-help">Submission auto-passes when keywords match. Press Enter to add.</p>
              <input className="sim-input" placeholder="Type a keyword and press Enter" value={kw}
                onChange={(e) => setKw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && kw.trim()) {
                    e.preventDefault();
                    set("keywords", [...new Set([...d.keywords, kw.trim()])]);
                    setKw("");
                  }
                }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {d.keywords.map((k) => (
                  <span key={k} className="sim-pill in_progress" style={{ paddingRight: 4 }}>
                    {k}
                    <button onClick={() => set("keywords", d.keywords.filter((x) => x !== k))}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="sim-row-2" style={{ marginTop: 12 }}>
                <div>
                  <label className="sim-field-label">Match mode</label>
                  <select className="sim-select" value={d.keyword_match_mode}
                    onChange={(e) => set("keyword_match_mode", e.target.value)}>
                    <option value="any">Any (min count)</option>
                    <option value="all">All keywords</option>
                  </select>
                </div>
                <div>
                  <label className="sim-field-label">Min keywords to match</label>
                  <input className="sim-input" type="number" min="1" value={d.min_keywords}
                    onChange={(e) => set("min_keywords", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {grp === "number" && (
            <div className="sim-field">
              <label className="sim-field-label">Number validation</label>
              <p className="sim-field-help">Set a min/max range, or an exact correct value.</p>
              <div className="sim-row-2">
                <div>
                  <label className="sim-field-label">Min</label>
                  <input className="sim-input" type="number" value={d.number_min}
                    onChange={(e) => set("number_min", e.target.value)} />
                </div>
                <div>
                  <label className="sim-field-label">Max</label>
                  <input className="sim-input" type="number" value={d.number_max}
                    onChange={(e) => set("number_max", e.target.value)} />
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label className="sim-field-label">Exact correct value (optional)</label>
                <input className="sim-input" type="number" value={d.number_correct}
                  onChange={(e) => set("number_correct", e.target.value)} />
              </div>
            </div>
          )}

          {grp === "choice" && (
            <div className="sim-field">
              <label className="sim-field-label">Options & correct answer(s)</label>
              <p className="sim-field-help">
                {SINGLE_CHOICE.includes(d.field_type)
                  ? "Tick the one correct option."
                  : "Tick every correct option (more than one allowed)."}
              </p>
              {d.options.map((o, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 7 }}>
                  <button className={`sim-btn sim-btn-sm ${o.correct ? "sim-btn-primary" : "sim-btn-ghost"}`}
                    onClick={() => markCorrect(i)}>
                    {o.correct ? "Correct" : "Mark"}
                  </button>
                  <input className="sim-input" style={{ flex: 1 }} value={o.label} placeholder="Option label"
                    onChange={(e) => updOption(i, "label", e.target.value)} />
                  <input className="sim-input" style={{ width: 120 }} value={o.value} placeholder="value"
                    onChange={(e) => updOption(i, "value", e.target.value)} />
                  <button className="sim-btn sim-btn-danger sim-btn-sm" onClick={() => delOption(i)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button className="sim-btn sim-btn-ghost sim-btn-sm" onClick={addOption}>
                <Plus size={13} /> Add option
              </button>
            </div>
          )}

          {grp === "file" && (
            <div className="sim-row-2">
              <div className="sim-field">
                <label className="sim-field-label">Accepted extensions (csv)</label>
                <input className="sim-input" placeholder="pdf,docx" value={d.accepted_extensions}
                  onChange={(e) => set("accepted_extensions", e.target.value)} />
              </div>
              <div className="sim-field">
                <label className="sim-field-label">Max file size (MB)</label>
                <input className="sim-input" type="number" value={d.max_file_size_mb}
                  onChange={(e) => set("max_file_size_mb", e.target.value)} />
              </div>
            </div>
          )}

          <div className="sim-row-2">
            <div className="sim-field">
              <label className="sim-field-label">Scoring weight</label>
              <input className="sim-input" type="number" min="1" value={d.weight}
                onChange={(e) => set("weight", e.target.value)} />
            </div>
            <div className="sim-field" style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 4 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, cursor: "pointer" }}>
                <span className={`sim-toggle ${d.is_required ? "on" : ""}`}
                  onClick={() => set("is_required", !d.is_required)} />
                Required field
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, cursor: "pointer" }}>
                <span className={`sim-toggle ${d.status === "active" ? "on" : ""}`}
                  onClick={() => set("status", d.status === "active" ? "inactive" : "active")} />
                Active (visible to students)
              </label>
            </div>
          </div>

          <div style={{ background: "var(--sim-bg-soft)", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--sim-text-3)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <Eye size={13} /> Live preview
            </div>
            <PreviewField field={previewField} />
          </div>
        </div>

        <div className="sim-drawer-foot">
          <button className="sim-btn sim-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="sim-btn sim-btn-primary" disabled={saving} onClick={save}>
            {saving ? "Saving..." : "Save field"}
          </button>
        </div>
      </aside>
    </>
  );
}

/* ===========================================================================
   Form builder — palette + drag-and-drop journey flow
   =========================================================================== */
function TaskFormBuilder({ task, onBack }) {
  const [fields, setFields] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [overIdx, setOverIdx] = useState(null);
  const drag = useRef(null);
  const canvasRef = useRef(null);
  const prevLen = useRef(0);

  const load = useCallback(async () => {
    try { setFields((await A.listFields(task.id)).fields || []); }
    catch (e) { toast.error(e.message); setFields([]); }
  }, [task.id]);
  useEffect(() => { load(); }, [load]);

  /* when a field is added, scroll the canvas to the bottom so the new step
     and the "drop here" zone come into view */
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
      const res = await A.createField({ task_id: task.id, ...defaultsFor(type) });
      if (atIndex !== null && fields) {
        const ids = fields.map((f) => f.id);
        ids.splice(atIndex, 0, res.id);
        await A.reorderFields(task.id, ids);
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
    try { await A.reorderFields(task.id, next.map((f) => f.id)); }
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

  if (fields === null) return <div className="sim-spinner" />;

  return (
    <div>
      <button className="sim-link" onClick={onBack}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to tasks
      </button>
      <div className="sim-section-head" style={{ marginTop: 10 }}>
        <h2>Form builder — {task.title}</h2>
      </div>
      <p className="sim-section-sub">
        Drag a field type from the left onto the journey, or tap it to add a step.
        Each step is one form field, auto-evaluated to students in this order.
      </p>

      <div className="sim-fb">
        <aside className="sim-fb-palette">
          <p className="sim-fb-palette-hint">Drag → drop onto the flow, or click to append a step.</p>
          {PALETTE.map((grp) => (
            <div key={grp.label}>
              <div className="sim-fb-pal-group">{grp.label}</div>
              <div className="sim-fb-pal-list">
                {grp.types.map((t) => {
                  const Icon = TYPES[t].icon;
                  return (
                    <button key={t} className="sim-fb-pal-item" draggable
                      onDragStart={() => { drag.current = { kind: "palette", type: t }; }}
                      onDragEnd={clearDrag}
                      onClick={() => addField(t)}>
                      <span className="sim-fb-pal-ico"><Icon size={15} /></span>
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
          className={`sim-fb-canvas ${dropActive ? "drop-active" : ""}`}
          onDragOver={(e) => { e.preventDefault(); if (drag.current?.kind === "palette") setDropActive(true); }}
          onDragLeave={() => setDropActive(false)}
          onDrop={onCanvasDrop}
        >
          {fields.length === 0 ? (
            <div className="sim-fb-empty">
              <MousePointerClick size={34} />
              <h3>Start the journey</h3>
              <p>Drag a field type here, or click one in the palette.</p>
            </div>
          ) : (
            <>
              <div className="sim-fb-flow">
                {fields.map((f, i) => {
                  const Icon = TYPES[f.field_type]?.icon || Type;
                  return (
                    <div key={f.id} className="sim-fb-step">
                      {overIdx === i && drag.current && <div className="sim-fb-drop-line" />}
                      <div className="sim-fb-badge">{i + 1}</div>
                      <div className={`sim-fb-node ${f.status === "inactive" ? "inactive" : ""}`}
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
                        <span className="sim-fb-grip"><GripVertical size={16} /></span>
                        <span className="sim-fb-node-ico"><Icon size={17} /></span>
                        <div className="sim-fb-node-main" onClick={() => setEditing(f)}>
                          <div className="sim-fb-node-title">
                            {f.label}
                            {f.is_required ? <span className="sim-field-req">*</span> : null}
                          </div>
                          <div className="sim-fb-node-meta">
                            <span>{TYPES[f.field_type]?.label || f.field_type}</span>
                            <span>weight {f.weight}</span>
                            {f.keywords?.length > 0 && <span>{f.keywords.length} keyword(s)</span>}
                            {f.options?.length > 0 && <span>{f.options.length} option(s)</span>}
                            {f.status === "inactive" && <span>hidden</span>}
                          </div>
                        </div>
                        <div className="sim-fb-node-acts">
                          <button className="sim-btn sim-btn-ghost sim-btn-sm" onClick={() => setEditing(f)}>
                            <Pencil size={13} />
                          </button>
                          <button className="sim-btn sim-btn-ghost sim-btn-sm" onClick={() => toggleField(f)}>
                            {f.status === "active" ? "Hide" : "Show"}
                          </button>
                          <button className="sim-btn sim-btn-danger sim-btn-sm" onClick={() => removeField(f)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className={`sim-fb-add-end ${dropActive ? "drop-active" : ""}`}
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
   Task editor
   =========================================================================== */
const BLANK_TASK = { title: "", description: "", estimated_time: "", points: 50, step_order: 0 };
function TaskEditor({ initial, onSave, onCancel, saving }) {
  const [t, setT] = useState(initial || BLANK_TASK);
  const set = (k, v) => setT((p) => ({ ...p, [k]: v }));
  return (
    <div className="sim-card" style={{ marginBottom: 16 }}>
      <div className="sim-field">
        <label className="sim-field-label">Task title<span className="sim-field-req">*</span></label>
        <input className="sim-input" value={t.title} onChange={(e) => set("title", e.target.value)} />
      </div>
      <div className="sim-field">
        <label className="sim-field-label">Description</label>
        <MiniRichText value={t.description || ""} onChange={(html) => set("description", html)} />
      </div>
      <div className="sim-row-2">
        <div className="sim-field">
          <label className="sim-field-label">Estimated time</label>
          <input className="sim-input" placeholder="e.g. 1 day" value={t.estimated_time || ""}
            onChange={(e) => set("estimated_time", e.target.value)} />
        </div>
        <div className="sim-field">
          <label className="sim-field-label">Points</label>
          <input className="sim-input" type="number" value={t.points}
            onChange={(e) => set("points", e.target.value)} />
        </div>
      </div>
      <div className="sim-field">
        <label className="sim-field-label">Step order (0 = auto / append)</label>
        <input className="sim-input" type="number" value={t.step_order}
          onChange={(e) => set("step_order", e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="sim-btn sim-btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="sim-btn sim-btn-primary" disabled={saving || !t.title.trim()}
          onClick={() => onSave(t)}>
          {saving ? "Saving..." : "Save task"}
        </button>
      </div>
    </div>
  );
}

/* ===========================================================================
   Admin panel — domains → tasks → form builder
   =========================================================================== */
function SimAdminPanel() {
  /* navigation state lives in the URL, so a refresh keeps you in place:
       (none)                        -> domains list
       ?domain=ID                    -> that domain's tasks
       ?domain=ID&task=TID           -> that task's form builder            */
  const [searchParams, setSearchParams] = useSearchParams();
  const domainId = searchParams.get("domain") || "";
  const taskId   = searchParams.get("task") || "";

  const [domains, setDomains] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const taskDrag = useRef(null);
  const [taskOverIdx, setTaskOverIdx] = useState(null);

  /* domains — loaded once */
  useEffect(() => {
    A.listDomains()
      .then((res) => setDomains(res.all || []))
      .catch((e) => { toast.error(e.message); setDomains([]); });
  }, []);

  const loadTasks = useCallback(async (id) => {
    if (!id) { setTasks(null); return; }
    setLoadingTasks(true);
    try { setTasks((await A.listTasks(id)).tasks || []); }
    catch (e) { toast.error(e.message); setTasks([]); }
    finally { setLoadingTasks(false); }
  }, []);

  /* (re)load tasks whenever the domain in the URL changes (incl. on refresh) */
  useEffect(() => {
    setEditing(null);
    loadTasks(domainId);
  }, [domainId, loadTasks]);

  const domain      = domains?.find((d) => String(d.internship_id) === domainId) || null;
  const builderTask = tasks?.find((t) => String(t.id) === taskId) || null;

  /* URL-based navigation */
  const goDomains   = () => setSearchParams({});
  const openDomain  = (d) => setSearchParams({ domain: String(d.internship_id) });
  const openBuilder = (t) => setSearchParams({ domain: domainId, task: String(t.id) });
  const backToTasks = () => { setSearchParams({ domain: domainId }); loadTasks(domainId); };

  const saveTask = async (t) => {
    setSaving(true);
    try {
      if (editing === "new") {
        await A.createTask({ ...t, internship_id: domainId });
        toast.success("Task created");
      } else {
        await A.updateTask({ ...t, id: editing.id });
        toast.success("Task updated");
      }
      setEditing(null);
      await loadTasks(domainId);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  const toggleTask = async (t) => {
    try { await A.toggleTask(t.id); await loadTasks(domainId); }
    catch (e) { toast.error(e.message); }
  };
  const deleteTask = async (t) => {
    if (!window.confirm(`Delete "${t.title}" and all its form fields & submissions?`)) return;
    try { await A.deleteTask(t.id); toast.success("Task deleted"); await loadTasks(domainId); }
    catch (e) { toast.error(e.message); }
  };
  /* drag-to-reorder task steps — optimistic, then persisted */
  const moveTask = async (from, to) => {
    if (from == null || to == null || from === to || !tasks) return;
    const next = [...tasks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setTasks(next);
    try { await A.reorderTasks(next.map((t) => t.id)); }
    catch (e) { toast.error(e.message); loadTasks(domainId); }
  };

  /* ---- FORM BUILDER (deep-linked: ?domain=ID&task=TID) ---- */
  if (domainId && taskId) {
    if (domains === null || tasks === null) return <div className="sim-spinner" />;
    if (builderTask) {
      return <TaskFormBuilder task={builderTask} onBack={backToTasks} />;
    }
    /* task id no longer exists — fall through to the domain's task list */
  }

  /* ---- DOMAINS LIST ---- */
  if (!domainId) {
    if (domains === null) return <div className="sim-spinner" />;
    return (
      <div>
        <div className="sim-section-head"><h2>Choose a domain</h2></div>
        <p className="sim-section-sub">
          Pick a domain to manage its simulation tasks and build dynamic submission forms.
        </p>
        <div className="sim-grid sim-grid-domains">
          {domains.map((d) => (
            <button key={d.internship_id} className="sim-domain-card" onClick={() => openDomain(d)}>
              <div className="sim-domain-icon"><Layers size={22} /></div>
              <div className="sim-domain-name">{d.name}</div>
              <div className="sim-domain-cat">{d.category}</div>
              <div className="sim-domain-foot">
                <span><strong style={{ color: "var(--sim-text)" }}>{d.task_count}</strong> tasks</span>
                <span className="sim-link">Manage <ChevronRight size={13} /></span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ---- TASKS for the selected domain ---- */
  if (domains === null) return <div className="sim-spinner" />;
  if (!domain) {
    return (
      <div>
        <button className="sim-link" onClick={goDomains}>
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> All domains
        </button>
        <div className="sim-empty">
          <Layers size={32} />
          <h3>Domain not found</h3>
          <p>This domain may have been removed. Pick another one.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {editing !== null ? (
        <button className="sim-link" title="Back to tasks" onClick={() => setEditing(null)}>
          <ChevronRight size={16} style={{ transform: "rotate(180deg)" }} />
        </button>
      ) : (
        <button className="sim-link" onClick={goDomains}>
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> All domains
        </button>
      )}
      <div className="sim-section-head" style={{ marginTop: 10 }}>
        <h2>{domain.name} — tasks</h2>
        {editing === null && (
          <button className="sim-btn sim-btn-primary sim-btn-sm" onClick={() => setEditing("new")}>
            <Plus size={14} /> New task
          </button>
        )}
      </div>

      {editing === "new" && (
        <TaskEditor onSave={saveTask} onCancel={() => setEditing(null)} saving={saving} />
      )}

      {loadingTasks || tasks === null ? (
        <div className="sim-spinner" />
      ) : tasks.length === 0 && editing === null ? (
        <div className="sim-empty">
          <ListChecks size={32} />
          <h3>No tasks yet</h3>
          <p>Create the first task for this domain.</p>
        </div>
      ) : (
        tasks.map((t, i) =>
          editing && editing !== "new" && editing.id === t.id ? (
            <TaskEditor key={t.id} initial={t} onSave={saveTask}
              onCancel={() => setEditing(null)} saving={saving} />
          ) : (
            <div key={t.id}>
              {taskOverIdx === i && taskDrag.current != null && taskDrag.current !== i && (
                <div className="sim-fb-drop-line" style={{ marginBottom: 8 }} />
              )}
              <div className="sim-task-card"
                onDragOver={(e) => { e.preventDefault(); if (taskDrag.current != null) setTaskOverIdx(i); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (taskDrag.current != null) moveTask(taskDrag.current, i);
                  taskDrag.current = null; setTaskOverIdx(null);
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 180 }}>
                    <span className="sim-fb-grip" draggable title="Drag to reorder"
                      style={{ alignSelf: "center" }}
                      onDragStart={() => { taskDrag.current = i; }}
                      onDragEnd={() => { taskDrag.current = null; setTaskOverIdx(null); }}>
                      <GripVertical size={16} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="sim-step-title">Step {i + 1} · {t.title}</div>
                      <div className="sim-step-meta">
                        <span>{t.field_count} form field{t.field_count === 1 ? "" : "s"}</span>
                        <span>{t.points} pts</span>
                        {t.estimated_time && <span>{t.estimated_time}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span className={`sim-pill ${t.status}`}>{t.status}</span>
                    <button className="sim-btn sim-btn-ghost sim-btn-sm"
                      onClick={() => openBuilder(t)}>
                      <Settings2 size={13} /> Form builder
                    </button>
                    <button className="sim-btn sim-btn-ghost sim-btn-sm" onClick={() => setEditing(t)}>
                      <Pencil size={13} />
                    </button>
                    <button className="sim-btn sim-btn-ghost sim-btn-sm" onClick={() => toggleTask(t)}>
                      {t.status === "active" ? "Disable" : "Enable"}
                    </button>
                    <button className="sim-btn sim-btn-danger sim-btn-sm" onClick={() => deleteTask(t)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        )
      )}
    </div>
  );
}

/* ===========================================================================
   Scoped CSS — injected once
   =========================================================================== */
const SIM_CSS = `
.sim-root{--sim-bg-page:#f7f8fa;--sim-bg-surface:#fff;--sim-bg-soft:#f3f4f6;--sim-bg-softer:#fafafc;--sim-text:#1f2235;--sim-text-2:#5f6478;--sim-text-3:#9aa0b4;--sim-accent:#6366f1;--sim-accent-2:#a78bfa;--sim-accent-soft:#eef0ff;--sim-accent-text:#4f46e5;--sim-success:#10b981;--sim-success-soft:#ecfdf5;--sim-success-text:#047857;--sim-warning:#f59e0b;--sim-warning-soft:#fef3c7;--sim-warning-text:#b45309;--sim-danger:#ef4444;--sim-danger-soft:#fee2e2;--sim-danger-text:#b91c1c;--sim-info:#0ea5e9;--sim-info-soft:#e0f2fe;--sim-info-text:#0369a1;--sim-border:rgba(0,0,0,.07);--sim-border-2:rgba(0,0,0,.12);--sim-shadow-sm:0 1px 2px rgba(31,34,53,.05);--sim-shadow:0 2px 10px rgba(31,34,53,.08);--sim-shadow-lg:0 10px 30px rgba(31,34,53,.14);--sim-r-sm:8px;--sim-r:12px;--sim-r-lg:16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--sim-text);background:var(--sim-bg-page);}
.sim-root.sim-dark{--sim-bg-page:#0f1117;--sim-bg-surface:#181b24;--sim-bg-soft:#1f2330;--sim-bg-softer:#1a1d28;--sim-text:#e4e6ee;--sim-text-2:#a0a4b8;--sim-text-3:#6e7388;--sim-accent-soft:#2a2d4a;--sim-success-soft:#0a3328;--sim-warning-soft:#3a2a0c;--sim-danger-soft:#3a1818;--sim-border:rgba(255,255,255,.08);--sim-border-2:rgba(255,255,255,.16);}
.sim-root *,.sim-root *::before,.sim-root *::after{box-sizing:border-box;}
.sim-root button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit;padding:5px 10px;}
.sim-root input,.sim-root textarea,.sim-root select{font-family:inherit;}
.sim-page{padding:22px;}
.sim-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 0 14px;flex-wrap:wrap;}
.sim-section-head h2{font-size:16px;font-weight:700;margin:0;}
.sim-section-sub{font-size:12.5px;color:var(--sim-text-2);margin:0 0 16px;}
.sim-link{font-size:12.5px;color:var(--sim-accent-text);font-weight:600;display:inline-flex;align-items:center;gap:4px;}
.sim-link:hover{text-decoration:underline;}
.sim-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:13px;font-weight:600;padding:9px 16px;border-radius:var(--sim-r-sm);transition:opacity .15s,background .15s,transform .1s;}
.sim-btn:active{transform:scale(.98);}
.sim-btn-primary{background:linear-gradient(135deg,var(--sim-accent-2),var(--sim-accent));color:#fff;}
.sim-btn-primary:hover{opacity:.92;}
.sim-btn-primary:disabled{opacity:.45;cursor:not-allowed;}
.sim-btn-ghost{background:var(--sim-bg-surface);border:1px solid var(--sim-border-2);color:var(--sim-text);}
.sim-btn-ghost:hover{background:var(--sim-bg-soft);}
.sim-btn-danger{background:var(--sim-danger-soft);color:var(--sim-danger-text);}
.sim-btn-sm{padding:6px 11px;font-size:12px;}
.sim-card{background:var(--sim-bg-surface);border:1px solid var(--sim-border);border-radius:var(--sim-r);padding:18px;}
.sim-grid{display:grid;gap:14px;}
.sim-grid-domains{grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:26px;padding:10px;}
.sim-domain-card{background:var(--sim-bg-surface);border:1px solid var(--sim-border-2);border-radius:var(--sim-r);padding:24px;text-align:left;width:100%;cursor:pointer;position:relative;overflow:hidden;box-shadow:var(--sim-shadow);transition:transform .15s,box-shadow .15s,border-color .15s;}
.sim-domain-card:hover{transform:translateY(-4px);box-shadow:var(--sim-shadow-lg);border-color:var(--sim-accent);}
.sim-domain-card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:var(--sim-accent);opacity:0;transition:opacity .15s;}
.sim-domain-card:hover::before{opacity:1;}
.sim-domain-icon{width:46px;height:46px;border-radius:var(--sim-r-sm);background:var(--sim-accent-soft);color:var(--sim-accent-text);display:flex;align-items:center;justify-content:center;margin-bottom:12px;}
.sim-domain-name{font-size:15px;font-weight:700;margin-bottom:3px;}
.sim-domain-cat{font-size:11.5px;color:var(--sim-text-3);}
.sim-domain-foot{display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding-top:12px;border-top:1px solid var(--sim-border);font-size:11.5px;color:var(--sim-text-2);}
.sim-task-card{background:var(--sim-bg-surface);border:1px solid var(--sim-border);border-radius:var(--sim-r);padding:16px 18px;margin-bottom:12px;width:100%;text-align:left;}
.sim-step-title{font-size:14px;font-weight:700;}
.sim-step-meta{display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--sim-text-2);margin-top:8px;}
.sim-pill{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap;text-transform:capitalize;}
.sim-pill.in_progress{background:var(--sim-warning-soft);color:var(--sim-warning-text);}
.sim-pill.active{background:var(--sim-success-soft);color:var(--sim-success-text);}
.sim-pill.inactive{background:var(--sim-bg-soft);color:var(--sim-text-3);}
.sim-field{margin-bottom:20px;}
.sim-field-label{font-size:13px;font-weight:700;margin-bottom:4px;display:block;}
.sim-field-req{color:var(--sim-danger);margin-left:3px;}
.sim-field-help{font-size:11.5px;color:var(--sim-text-3);margin:0 0 8px;line-height:1.5;}
.sim-input,.sim-textarea,.sim-select{width:100%;padding:10px 12px;font-size:13px;border:1px solid var(--sim-border-2);border-radius:var(--sim-r-sm);background:var(--sim-bg-soft);color:var(--sim-text);outline:none;transition:border-color .15s,background .15s;}
.sim-input:focus,.sim-textarea:focus,.sim-select:focus{border-color:var(--sim-accent);background:var(--sim-bg-surface);}
.sim-textarea{resize:vertical;min-height:92px;line-height:1.55;}
.sim-upload{display:flex;align-items:center;gap:10px;padding:14px;border:1.5px dashed var(--sim-border-2);border-radius:var(--sim-r-sm);font-size:12.5px;color:var(--sim-text-2);background:var(--sim-bg-surface);}
.sim-opt-row{display:flex;align-items:center;gap:9px;padding:9px 11px;border:1px solid var(--sim-border);border-radius:var(--sim-r-sm);margin-bottom:7px;font-size:13px;cursor:pointer;background:var(--sim-bg-surface);}
.sim-opt-row.checked{border-color:var(--sim-accent);background:var(--sim-accent-soft);}
.sim-opt-row input{accent-color:var(--sim-accent);width:16px;height:16px;}
.sim-row-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.sim-empty{text-align:center;padding:54px 20px;color:var(--sim-text-3);}
.sim-empty h3{font-size:14.5px;color:var(--sim-text-2);margin:10px 0 3px;}
.sim-empty p{font-size:12.5px;margin:0;}
.sim-spinner{width:30px;height:30px;border-radius:50%;border:3px solid var(--sim-bg-soft);border-top-color:var(--sim-accent);animation:sim-spin .7s linear infinite;margin:50px auto;}
@keyframes sim-spin{to{transform:rotate(360deg);}}
.sim-toggle{width:38px;height:22px;border-radius:999px;background:var(--sim-bg-soft);position:relative;transition:background .15s;flex-shrink:0;border:1px solid var(--sim-border-2);}
.sim-toggle.on{background:var(--sim-accent);border-color:var(--sim-accent);}
.sim-toggle::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s;}
.sim-toggle.on::after{transform:translateX(16px);}
.sim-backdrop{position:fixed;inset:0;background:rgba(15,17,23,.55);z-index:1200;}
.sim-drawer{position:fixed;top:0;right:0;bottom:0;width:min(620px,96vw);background:var(--sim-bg-surface);border-left:1px solid var(--sim-border);z-index:1201;display:flex;flex-direction:column;box-shadow:var(--sim-shadow-lg);}
.sim-drawer-head{padding:18px 22px;border-bottom:1px solid var(--sim-border);display:flex;align-items:flex-start;justify-content:space-between;gap:14px;}
.sim-drawer-eyebrow{font-size:10.5px;color:var(--sim-text-3);text-transform:uppercase;letter-spacing:.07em;font-weight:700;margin-bottom:4px;}
.sim-drawer-title{font-size:17px;font-weight:700;line-height:1.3;}
.sim-drawer-body{padding:22px;overflow-y:auto;flex:1;}
.sim-drawer-foot{padding:14px 22px;border-top:1px solid var(--sim-border);display:flex;gap:10px;align-items:center;justify-content:flex-end;background:var(--sim-bg-surface);}
.sim-close-btn{width:32px;height:32px;border-radius:var(--sim-r-sm);flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--sim-bg-soft);color:var(--sim-text-2);}
.sim-close-btn:hover{background:var(--sim-bg-softer);color:var(--sim-text);}
.sim-rte{border:1px solid var(--sim-border-2);border-radius:var(--sim-r-sm);background:var(--sim-bg-soft);overflow:hidden;}
.sim-rte:focus-within{border-color:var(--sim-accent);background:var(--sim-bg-surface);}
.sim-rte-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:2px;padding:6px;background:var(--sim-bg-surface);border-bottom:1px solid var(--sim-border);}
.sim-rte-btn{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;padding:0 6px;border-radius:6px;background:transparent;color:var(--sim-text-2);cursor:pointer;}
.sim-rte-btn:hover{background:var(--sim-accent-soft);color:var(--sim-accent-text);}
.sim-rte-sep{width:1px;height:18px;margin:0 4px;background:var(--sim-border);}
.sim-rte-area{min-height:140px;max-height:380px;overflow-y:auto;padding:12px 14px;font-size:13px;line-height:1.6;color:var(--sim-text);outline:none;}
.sim-rte-area:empty:before{content:attr(data-placeholder);color:var(--sim-text-3);}
.sim-rte-area img{max-width:100%;height:auto;border-radius:6px;margin:4px 0;}
.sim-rte-area table{border-collapse:collapse;margin:8px 0;max-width:100%;}
.sim-rte-area td,.sim-rte-area th{border:1px solid var(--sim-border-2);padding:6px 10px;min-width:48px;vertical-align:top;}
.sim-rte-area th{background:var(--sim-bg-soft);font-weight:700;}
.sim-rte-color{display:inline-flex;align-items:center;gap:3px;height:28px;padding:0 5px;border-radius:6px;color:var(--sim-text-2);cursor:pointer;}
.sim-rte-color:hover{background:var(--sim-accent-soft);color:var(--sim-accent-text);}
.sim-rte-color input[type=color]{width:20px;height:20px;padding:0;border:none;border-radius:4px;background:none;cursor:pointer;}
.sim-rte-color input[type=color]::-webkit-color-swatch{border:1px solid var(--sim-border-2);border-radius:4px;}
.sim-rte-color input[type=color]::-webkit-color-swatch-wrapper{padding:0;}
.sim-fb{display:grid;grid-template-columns:236px 1fr;gap:16px;align-items:start;}
.sim-fb-palette{background:var(--sim-bg-surface);border:1px solid var(--sim-border);border-radius:var(--sim-r);padding:12px;position:sticky;top:8px;}
.sim-fb-palette-hint{font-size:11px;color:var(--sim-text-3);margin:0 4px 10px;line-height:1.5;}
.sim-fb-pal-group{font-size:9.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--sim-text-3);padding:10px 4px 5px;}
.sim-fb-pal-item{display:flex;align-items:center;gap:9px;width:100%;padding:9px 10px;margin-bottom:5px;border-radius:var(--sim-r-sm);border:1px solid var(--sim-border);background:var(--sim-bg-soft);font-size:12px;font-weight:600;color:var(--sim-text-2);cursor:grab;text-align:left;transition:border-color .13s,background .13s,color .13s;}
.sim-fb-pal-item:hover{border-color:var(--sim-accent);color:var(--sim-accent-text);background:var(--sim-accent-soft);}
.sim-fb-pal-ico{width:26px;height:26px;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--sim-accent-soft);color:var(--sim-accent-text);}
.sim-fb-canvas{background:var(--sim-bg-softer);border:1px solid var(--sim-border);border-radius:var(--sim-r);padding:18px;min-height:320px;max-height:calc(100vh - 240px);overflow-y:auto;transition:background .15s,border-color .15s;}
.sim-fb-canvas.drop-active{border-color:var(--sim-accent);border-style:dashed;background:var(--sim-accent-soft);}
.sim-fb-empty{border:2px dashed var(--sim-border-2);border-radius:var(--sim-r);padding:48px 20px;text-align:center;color:var(--sim-text-3);}
.sim-fb-empty h3{font-size:14px;color:var(--sim-text-2);margin:10px 0 3px;}
.sim-fb-empty p{font-size:12px;margin:0;}
.sim-fb-flow{position:relative;padding-left:40px;}
.sim-fb-flow::before{content:"";position:absolute;left:17px;top:14px;bottom:26px;width:2px;background:repeating-linear-gradient(to bottom,var(--sim-accent) 0 6px,transparent 6px 12px);opacity:.5;}
.sim-fb-step{position:relative;margin-bottom:12px;}
.sim-fb-badge{position:absolute;left:-40px;top:16px;width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--sim-accent-2),var(--sim-accent));color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;z-index:1;box-shadow:var(--sim-shadow-sm);}
.sim-fb-node{background:var(--sim-bg-surface);border:1px solid var(--sim-border);border-radius:var(--sim-r);padding:13px 14px;display:flex;align-items:center;gap:11px;transition:border-color .13s,box-shadow .13s;}
.sim-fb-node:hover{border-color:var(--sim-border-2);box-shadow:var(--sim-shadow);}
.sim-fb-node.inactive{opacity:.55;}
.sim-fb-node.dragover{border-color:var(--sim-accent);border-style:dashed;}
.sim-fb-grip{color:var(--sim-text-3);cursor:grab;flex-shrink:0;display:flex;}
.sim-fb-node-ico{width:34px;height:34px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--sim-accent-soft);color:var(--sim-accent-text);}
.sim-fb-node-main{flex:1;min-width:0;cursor:pointer;}
.sim-fb-node-title{font-size:13px;font-weight:700;}
.sim-fb-node-meta{display:flex;gap:10px;flex-wrap:wrap;font-size:10.5px;color:var(--sim-text-3);margin-top:3px;}
.sim-fb-node-acts{display:flex;gap:5px;flex-shrink:0;}
.sim-fb-drop-line{height:2px;background:var(--sim-accent);border-radius:2px;margin:2px 0;box-shadow:0 0 6px var(--sim-accent);}
.sim-fb-add-end{position:sticky;bottom:0;z-index:2;margin-left:40px;margin-top:8px;border:1.5px dashed var(--sim-border-2);border-radius:var(--sim-r-sm);padding:11px;text-align:center;font-size:12px;color:var(--sim-text-3);background:var(--sim-bg-softer);}
.sim-fb-add-end.drop-active{border-color:var(--sim-accent);color:var(--sim-accent-text);background:var(--sim-accent-soft);}
@media (max-width:860px){.sim-fb{grid-template-columns:1fr;}.sim-fb-palette{position:static;}.sim-fb-pal-list{display:flex;gap:7px;overflow-x:auto;padding-bottom:4px;}.sim-fb-pal-list .sim-fb-pal-item{width:auto;white-space:nowrap;margin-bottom:0;flex-shrink:0;}.sim-fb-pal-group{display:none;}.sim-row-2{grid-template-columns:1fr;}.sim-drawer{width:100vw;}.sim-grid-domains{grid-template-columns:1fr;}}
`;

let cssDone = false;
function injectCss() {
  if (cssDone || typeof document === "undefined") return;
  cssDone = true;
  const el = document.createElement("style");
  el.id = "sim-admin-panel-css";
  el.textContent = SIM_CSS;
  document.head.appendChild(el);
}

/* ===========================================================================
   Default export — standalone wrapper
   =========================================================================== */
export default function SimAdminPanelSingle({ dark = false }) {
  injectCss();
  return (
    <div className={`sim-root ${dark ? "sim-dark" : ""}`}>
      <div className="sim-page" style={{ minHeight: "100%" }}>
        <SimAdminPanel />
      </div>
    </div>
  );
}
