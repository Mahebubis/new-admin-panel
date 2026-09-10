/*
 * src/pages/freshdesk/components/CannedManager.jsx
 *
 * Canned responses, managed the way Freshdesk manages them: folders down the
 * left, the responses in the selected folder on the right, and an editor for
 * one response.
 *
 * WHY FOLDERS
 * The old model was a free-text `category` on each response, which cannot be
 * renamed, counted, or emptied -- and with fifty-odd responses in one bucket a
 * flat list is not something you can find anything in. Folders are a real
 * table now, and deleting one unfiles its responses rather than destroying
 * them (see canned_folder_delete).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft, Folder, FolderPlus, MessageSquareText, Pencil, Plus, Search, Trash2, X,
} from "lucide-react";
import { messages as fdMessages } from "../fdApi";
import { ConfirmDialog, EmptyState, Spinner, useToast } from "../fdShared";
import RichEditor from "./RichEditor";

/* The pseudo-folder for responses that belong to none. It is not a row in the
   table -- it is "folder_id IS NULL" given a name so it can be clicked. */
const UNFILED = { id: 0, name: "Unfiled", count: 0 };

export default function CannedManager() {
  const push = useToast();
  const [data, setData] = useState({ responses: [], folders: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [folderId, setFolderId] = useState(null);   // null = All responses
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);     // response object | "new" | null
  const [folderEdit, setFolderEdit] = useState(null); // {id,name} | "new" | null
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fdMessages.canned(true);
      setData({ responses: r.responses || [], folders: r.folders || [] });
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const unfiledCount = useMemo(
    () => data.responses.filter((r) => !r.folder_id).length,
    [data.responses]
  );

  const folders = useMemo(() => {
    const list = data.folders.map((f) => ({ ...f, id: Number(f.id), count: Number(f.count) || 0 }));
    return unfiledCount > 0 ? [...list, { ...UNFILED, count: unfiledCount }] : list;
  }, [data.folders, unfiledCount]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.responses.filter((r) => {
      if (folderId !== null) {
        const rid = Number(r.folder_id) || 0;
        if (rid !== folderId) return false;
      }
      if (!needle) return true;
      return `${r.name} ${r.shortcut || ""} ${r.body || ""}`.toLowerCase().includes(needle);
    });
  }, [data.responses, folderId, q]);

  /* ---------------------------------------------------------------- saves */

  const saveFolder = async (name, id) => {
    setBusy(true);
    try {
      await fdMessages.cannedFolderSave(id ? { id, name } : { name });
      push({ type: "success", title: id ? "Folder renamed" : "Folder created" });
      setFolderEdit(null);
      await load();
    } catch (err) {
      push({ type: "error", title: "Could not save the folder", desc: err.message });
    } finally { setBusy(false); }
  };

  const removeFolder = (f) => setConfirm({
    title: `Delete "${f.name}"?`,
    msg: f.count > 0
      ? `Its ${f.count} response${f.count === 1 ? "" : "s"} will move to Unfiled — nothing is deleted.`
      : "The folder is empty.",
    label: "Delete folder",
    run: async () => {
      try {
        const r = await fdMessages.cannedFolderDelete(f.id);
        push({ type: "success", title: r.message || "Folder deleted" });
        if (folderId === f.id) setFolderId(null);
        await load();
      } catch (err) {
        push({ type: "error", title: "Could not delete the folder", desc: err.message });
      }
    },
  });

  const removeResponse = (r) => setConfirm({
    title: `Delete "${r.name}"?`,
    msg: "This canned response will be gone for good.",
    label: "Delete",
    danger: true,
    run: async () => {
      try {
        await fdMessages.cannedDelete(r.id);
        push({ type: "success", title: "Response deleted" });
        await load();
      } catch (err) {
        push({ type: "error", title: "Could not delete it", desc: err.message });
      }
    },
  });

  /* ---------------------------------------------------------------- views */

  if (editing) {
    return (
      <ResponseEditor
        response={editing === "new" ? null : editing}
        folders={data.folders}
        defaultFolderId={folderId && folderId > 0 ? folderId : 0}
        onCancel={() => setEditing(null)}
        onSaved={async () => { setEditing(null); await load(); }}
      />
    );
  }

  return (
    <div className="cr">
      <div className="cr-bar">
        <div className="searchbox" style={{ maxWidth: 300 }}>
          <Search size={15} />
          <input placeholder="Search responses…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-soft btn-sm" onClick={() => setFolderEdit("new")}>
            <FolderPlus size={15} /> New folder
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>
            <Plus size={15} /> New canned response
          </button>
        </div>
      </div>

      {error && <div className="msg-error" style={{ marginBottom: 12 }}>Could not load: {error}</div>}

      <div className="cr-split">
        {/* ---- folders ---- */}
        <div className="cr-folders">
          <div className="cr-lab">Folders</div>
          <button className={`cr-folder ${folderId === null ? "on" : ""}`} onClick={() => setFolderId(null)}>
            <MessageSquareText size={15} />
            <span className="nm">All responses</span>
            <span className="ct">{data.responses.length}</span>
          </button>
          {folders.map((f) => (
            <div key={f.id} className={`cr-folder ${folderId === f.id ? "on" : ""}`}
                 onClick={() => setFolderId(f.id)}>
              <Folder size={15} />
              <span className="nm">{f.name}</span>
              <span className="ct">{f.count}</span>
              {/* Unfiled is a query, not a row -- it cannot be renamed or deleted. */}
              {f.id > 0 && (
                <span className="cr-facts">
                  <button title="Rename" onClick={(e) => { e.stopPropagation(); setFolderEdit(f); }}>
                    <Pencil size={12} />
                  </button>
                  <button title="Delete" onClick={(e) => { e.stopPropagation(); removeFolder(f); }}>
                    <Trash2 size={12} />
                  </button>
                </span>
              )}
            </div>
          ))}
          {folders.length === 0 && !loading && (
            <div className="cr-none">No folders yet.</div>
          )}
        </div>

        {/* ---- responses ---- */}
        <div className="cr-list">
          {loading ? (
            <div className="cr-none"><Spinner size={14} /> Loading canned responses…</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={MessageSquareText} title="Nothing here yet"
                        desc={q.trim() ? `No response matches “${q}”.` : "Create one with the button above."} />
          ) : rows.map((r) => (
            <div key={r.id} className="cr-row" onClick={() => setEditing(r)}>
              <div className="cr-row-main">
                <div className="cr-nm">
                  {r.name}
                  {Number(r.is_active) === 0 && <span className="cr-off">Inactive</span>}
                </div>
                <div className="cr-body">
                  {String(r.body || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140)}
                </div>
              </div>
              <div className="cr-row-meta">
                {r.shortcut ? <code className="cr-code">{r.shortcut}</code> : <span className="cr-dash">--</span>}
                <span className="cr-uses">{Number(r.uses) || 0} uses</span>
              </div>
              <div className="cr-facts">
                <button title="Edit" onClick={(e) => { e.stopPropagation(); setEditing(r); }}><Pencil size={13} /></button>
                <button title="Delete" onClick={(e) => { e.stopPropagation(); removeResponse(r); }}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {folderEdit && (
        <FolderDialog
          folder={folderEdit === "new" ? null : folderEdit}
          busy={busy}
          onClose={() => setFolderEdit(null)}
          onSave={saveFolder}
        />
      )}

      <ConfirmDialog open={!!confirm} danger={confirm?.danger} title={confirm?.title || ""}
                     message={confirm?.msg || ""} confirmLabel={confirm?.label || "Confirm"}
                     onConfirm={() => confirm?.run()} onClose={() => setConfirm(null)} />
    </div>
  );
}

/* ---- new / rename folder ---- */
function FolderDialog({ folder, busy, onClose, onSave }) {
  const [name, setName] = useState(folder ? folder.name : "");
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="panel-title" style={{ fontSize: 15 }}>
            <span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB", width: 32, height: 32 }}>
              <FolderPlus size={16} />
            </span>
            {folder ? "Rename folder" : "New folder"}
          </div>
          <button className="icon-btn" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="modal-body">
          <div className="fld">
            <label>Folder name</label>
            <input autoFocus value={name} placeholder="e.g. Refunds"
                   onChange={(e) => setName(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onSave(name.trim(), folder?.id); }} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" disabled={!name.trim() || busy}
                  onClick={() => onSave(name.trim(), folder?.id)}>
            {busy ? <><Spinner /> Saving…</> : folder ? "Rename" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- create / edit one response ---- */
function ResponseEditor({ response, folders, defaultFolderId, onCancel, onSaved }) {
  const push = useToast();
  const [name, setName] = useState(response?.name || "");
  const [shortcut, setShortcut] = useState(response?.shortcut || "");
  const [body, setBody] = useState(response?.body || "");
  const [folderId, setFolderId] = useState(Number(response?.folder_id) || defaultFolderId || 0);
  const [active, setActive] = useState(response ? Number(response.is_active) === 1 : true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { push({ type: "error", title: "A title is required" }); return; }
    if (!String(body).replace(/<[^>]*>/g, "").trim()) { push({ type: "error", title: "The message is empty" }); return; }
    setSaving(true);
    try {
      await fdMessages.cannedSave({
        id: response?.id || 0,
        name: name.trim(),
        shortcut: shortcut.trim(),
        body,
        folder_id: folderId,
        is_active: active,
        // Kept in step with the folder so anything still reading the old
        // free-text column sees the same answer.
        category: (folders.find((f) => Number(f.id) === folderId) || {}).name || "",
      });
      push({ type: "success", title: response ? "Response updated" : "Response created" });
      onSaved();
    } catch (err) {
      push({ type: "error", title: "Could not save", desc: err.message });
    } finally { setSaving(false); }
  };

  return (
    <div className="cr">
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }} onClick={onCancel}>
        <ChevronLeft size={15} /> Back to canned responses
      </button>

      <div className="fld">
        <label>Response title <span style={{ color: "var(--danger)" }}>*</span></label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Refund policy" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="fld">
          <label>Folder</label>
          <select value={folderId} onChange={(e) => setFolderId(Number(e.target.value))}>
            <option value={0}>Unfiled</option>
            {folders.map((f) => <option key={f.id} value={Number(f.id)}>{f.name}</option>)}
          </select>
        </div>
        <div className="fld">
          <label>Short code <span style={{ color: "var(--faint)", fontWeight: 500 }}>(optional)</span></label>
          <input value={shortcut} onChange={(e) => setShortcut(e.target.value)} placeholder="e.g. refund" />
        </div>
      </div>

      <div className="fld">
        <label>Message <span style={{ color: "var(--danger)" }}>*</span></label>
        <div className="cr-editor">
          <RichEditor
            value={body}
            onChange={setBody}
            resetKey={`canned:${response?.id || "new"}`}
            minHeight={220}
            placeholder="Type the reply agents will insert…"
          />
        </div>
        <small style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 6, display: "block" }}>
          Placeholders: <code>{"{Customer Name}"}</code> · <code>{"{Ticket ID}"}</code> · <code>{"{Ticket Subject}"}</code>
        </small>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, cursor: "pointer", marginTop: 4 }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Available to agents
      </label>

      <div style={{ display: "flex", gap: 9, marginTop: 18 }}>
        <button className="btn btn-primary" disabled={saving} onClick={save}>
          {saving ? <><Spinner /> Saving…</> : response ? "Save changes" : "Create"}
        </button>
        <button className="btn btn-soft" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
