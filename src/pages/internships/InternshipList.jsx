import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const API = '/api/internship-system/internship_list.php';
const FH = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk = obj => new URLSearchParams(obj);

/* ─── shared styles ─── */
const inputStyle = {
  width: '100%', padding: '8px 11px', border: '1.5px solid #e2e8f0', borderRadius: 7,
  fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box'
};
const selectStyle = { ...inputStyle, cursor: 'pointer' };
const btnPrimary = {
  padding: '9px 20px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit'
};
const tdS = { padding: '9px 12px', borderBottom: '1px solid #f5f3ff', color: '#334155', fontSize: 12, verticalAlign: 'middle' };

function Spinner() {
  return (
    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>
      <div style={{
        display: 'inline-block', width: 28, height: 28, border: '3px solid #ede9fe',
        borderTop: '3px solid #4f46e5', borderRadius: '50%', animation: 'il_spin .7s linear infinite'
      }} />
    </td></tr>
  );
}

function Field({ label, children, half }) {
  return (
    <div style={{ gridColumn: half ? 'span 1' : 'span 2', marginBottom: 4 }}>
      <label style={{
        display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748b',
        textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4
      }}>{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%',
        maxWidth: wide ? 780 : 560, maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,.25)'
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 22px', borderBottom: '1.5px solid #f1f5f9'
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{title}</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 22,
            cursor: 'pointer', color: '#94a3b8'
          }}>×</button>
        </div>
        <div style={{ padding: '18px 22px' }}>{children}</div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
export default function InternshipList() {
  const [list, setList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { type:'add'|'edit', data? }
  const [dragging, setDragging] = useState(null);
  const dragOver = useRef(null);

  /* ── fetch list ── */
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.post(API, mk({ action: 'fetch_list' }), FH);
      if (res.data.status === 'success') setList(res.data.data || []);
    } catch { } finally { setLoading(false); }
  }, []);

  /* ── fetch categories for modal ── */
  const fetchCats = useCallback(async () => {
    try {
      const res = await api.post(API, mk({ action: 'fetch_categories' }), FH);
      if (res.data.status === 'success') setCategories(res.data.data || []);
    } catch { }
  }, []);

  useEffect(() => { fetchList(); fetchCats(); }, [fetchList, fetchCats]);

  /* ── delete ── */
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete internship "${name}"? This cannot be undone.`)) return;
    try {
      const res = await api.post(API, mk({ action: 'delete_internship', internship_id: id }), FH);
      if (res.data.status === 'success') { toast.success('Internship deleted'); fetchList(); }
      else toast.error(res.data.message || 'Failed to delete');
    } catch { toast.error('Error'); }
  };

  /* ── toggle show/hide slider ── */
  const [toggling, setToggling] = useState(null); // id being saved
  const toggleShow = async (row) => {
    const newVal = row.is_show == 1 ? 0 : 1;
    setToggling(row.id);
    // optimistic update
    setList(prev => prev.map(r => r.id === row.id ? { ...r, is_show: newVal } : r));
    try {
      const res = await api.post(API, mk({ action: 'toggle_show', internship_id: row.id, value: newVal }), FH);
      if (res.data.status === 'success') {
        toast.success(newVal ? 'Shown' : 'Hidden');
      } else {
        toast.error(res.data.message || 'Failed to update');
        setList(prev => prev.map(r => r.id === row.id ? { ...r, is_show: row.is_show } : r)); // revert
      }
    } catch {
      toast.error('Error updating');
      setList(prev => prev.map(r => r.id === row.id ? { ...r, is_show: row.is_show } : r)); // revert
    } finally {
      setToggling(null);
    }
  };

  /* ── drag & drop priority ── */
  const onDragStart = (e, index) => {
    setDragging(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e, index) => {
    e.preventDefault();
    dragOver.current = index;
  };
  const onDrop = async () => {
    if (dragging === null || dragOver.current === null || dragging === dragOver.current) {
      setDragging(null); return;
    }
    const updated = [...list];
    const [moved] = updated.splice(dragging, 1);
    updated.splice(dragOver.current, 0, moved);

    // reassign priorities
    const minP = Math.min(...updated.map(r => parseInt(r.priority) || 0));
    const newList = updated.map((r, i) => ({ ...r, priority: minP + i }));
    setList(newList);
    setDragging(null);
    dragOver.current = null;

    try {
      const priorities = newList.map(r => ({ id: r.id, priority: r.priority }));
      const res = await api.post(API, mk({ action: 'update_priorities', priorities: JSON.stringify(priorities) }), FH);
      if (res.data.status === 'success') toast.success('Priority updated');
      else toast.error('Failed to save order');
    } catch { toast.error('Error saving order'); }
  };

  const closeModal = () => setModal(null);
  const closeAndReload = () => { setModal(null); fetchList(); };

  /* ════════ RENDER ════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .il-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        @keyframes il_spin{to{transform:rotate(360deg)}}
        .il-tr:hover td{background:#faf9ff!important;}
        .il-tr.dragging{opacity:.4;}
        .il-inp:focus{border-color:#4f46e5!important;box-shadow:0 0 0 3px rgba(79,70,229,.08)!important;}
        .il-switch{position:relative;display:inline-block;width:40px;height:22px;cursor:pointer;vertical-align:middle;}
        .il-switch input{opacity:0;width:0;height:0;}
        .il-slider{position:absolute;inset:0;background:#cbd5e1;border-radius:99px;transition:.25s;}
        .il-slider:before{content:'';position:absolute;height:16px;width:16px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.25s;box-shadow:0 1px 3px rgba(0,0,0,.2);}
        .il-switch input:checked + .il-slider{background:linear-gradient(135deg,#4f46e5,#7c3aed);}
        .il-switch input:checked + .il-slider:before{transform:translateX(18px);}
        .il-switch input:disabled + .il-slider{opacity:.5;cursor:not-allowed;}
      `}</style>

      <div className="il-root" style={{ background: '#f5f3ff', minHeight: '100vh', padding: 24 }}>

        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth={2.5}>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            Internship List
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ ...btnPrimary, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
              onClick={() => setModal({ type: 'add' })}>
              + Add Internship
            </button>
            <Link to="/reports/batch-dates"><p
              style={{ ...btnPrimary, background: 'linear-gradient(135deg,#d97706,#b45309)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              View Batch Dates
            </p></Link>
            <a href="/admin/available_batches.php" target="_blank"
              style={{ ...btnPrimary, background: 'linear-gradient(135deg,#d97706,#b45309)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              Batch Config
            </a>
          </div>
        </div>

        {/* hint */}
        <div style={{
          fontSize: 11.5, color: '#7c3aed', marginBottom: 10, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={2}>
            <path d="M12 5v14M5 12l7-7 7 7" />
          </svg>
          Drag rows up/down to reorder priority
        </div>

        {/* table card */}
        <div style={{
          background: '#fff', borderRadius: 12, border: '1.5px solid #ede9fe',
          boxShadow: '0 1px 8px rgba(79,70,229,.06)', overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto', maxHeight: 620, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 70 }} /><col style={{ width: 80 }} /><col style={{ width: 200 }} />
                <col style={{ width: 130 }} /><col style={{ width: 160 }} /><col style={{ width: 100 }} />
                <col style={{ width: 100 }} /><col style={{ width: 90 }} /><col style={{ width: 100 }} /><col style={{ width: 180 }} />
              </colgroup>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {['Priority', 'Image', 'Full Name', 'Short Name', 'Learnyst Name', 'Visibility', 'Best Seller', 'Syllabus', 'Show/Hide', 'Action'].map(h => (
                    <th key={h} style={{
                      color: '#fff', fontSize: 11, fontWeight: 600, padding: '11px 12px',
                      textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px',
                      borderRight: '1px solid rgba(255,255,255,.15)', whiteSpace: 'nowrap'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? <Spinner /> : list.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', color: '#94a3b8', padding: 36, fontSize: 13 }}>No internships found</td></tr>
                ) : list.map((row, idx) => (
                  <tr key={row.id}
                    className={`il-tr${dragging === idx ? ' dragging' : ''}`}
                    draggable
                    onDragStart={e => onDragStart(e, idx)}
                    onDragOver={e => onDragOver(e, idx)}
                    onDrop={onDrop}
                    onDragEnd={() => setDragging(null)}
                    style={{ cursor: 'grab' }}>
                    <td style={tdS}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2}>
                          <circle cx="9" cy="6" r="1" fill="#94a3b8" /><circle cx="15" cy="6" r="1" fill="#94a3b8" />
                          <circle cx="9" cy="12" r="1" fill="#94a3b8" /><circle cx="15" cy="12" r="1" fill="#94a3b8" />
                          <circle cx="9" cy="18" r="1" fill="#94a3b8" /><circle cx="15" cy="18" r="1" fill="#94a3b8" />
                        </svg>
                        <span style={{ fontWeight: 600, color: '#4f46e5' }}>{row.priority}</span>
                      </div>
                    </td>
                    <td style={tdS}>
                      <img
                        src={`https://cit2.internshipstudio.com/assets/img/istudio/icons/${row.short_name}.webp`}
                        alt={row.internship_name}
                        style={{
                          width: 44, height: 32, objectFit: 'contain', borderRadius: 4,
                          background: '#f8fafc', padding: 2, border: '1px solid #e2e8f0'
                        }}
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    </td>
                    <td style={{ ...tdS, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.internship_name}
                    </td>
                    <td style={{ ...tdS, color: '#6d28d9', fontWeight: 500 }}>{row.short_name}</td>
                    <td style={{ ...tdS, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.learnyst_name || '—'}
                    </td>
                    <td style={tdS}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
                        background: row.show_internship == 1 ? '#dcfce7' : '#fef3c7',
                        color: row.show_internship == 1 ? '#16a34a' : '#b45309'
                      }}>
                        {row.show_internship == 1 ? 'Visible' : 'Hidden'}
                      </span>
                    </td>
                    <td style={tdS}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
                        background: row.best_seller == 1 ? '#ede9fe' : '#f1f5f9',
                        color: row.best_seller == 1 ? '#6d28d9' : '#64748b'
                      }}>
                        {row.best_seller == 1 ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td style={{ ...tdS, fontSize: 16, textAlign: 'center' }}>
                      {row.pdf_exists ? '✅' : '❌'}
                    </td>
                    <td style={{ ...tdS, textAlign: 'center' }}
                      draggable={false}
                      onDragStart={e => { e.preventDefault(); e.stopPropagation(); }}>
                      <label className="il-switch" title={row.is_show == 1 ? 'Showing — click to hide' : 'Hidden — click to show'}>
                        <input
                          type="checkbox"
                          checked={row.is_show == 1}
                          disabled={toggling === row.id}
                          onChange={() => toggleShow(row)}
                        />
                        <span className="il-slider" />
                      </label>
                    </td>
                    <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                      <button
                        style={{
                          padding: '5px 12px', background: '#fef3c7', color: '#b45309',
                          border: '1.5px solid #fde68a', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', marginRight: 6
                        }}
                        onClick={() => setModal({ type: 'edit', data: row })}>
                        Edit
                      </button>
                      <button
                        style={{
                          padding: '5px 12px', background: '#fee2e2', color: '#dc2626',
                          border: '1.5px solid #fecaca', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer'
                        }}
                        onClick={() => handleDelete(row.id, row.internship_name)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* count */}
        {!loading && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8', textAlign: 'right' }}>
            {list.length} internship{list.length !== 1 ? 's' : ''} total
          </div>
        )}
      </div>

      {/* modals */}
      {modal?.type === 'add' && (
        <InternshipFormModal
          title="Add Internship"
          categories={categories}
          onCancel={closeModal}
          onSaved={closeAndReload}
        />
      )}
      {modal?.type === 'edit' && (
        <InternshipFormModal
          title="Edit Internship"
          initial={modal.data}
          categories={categories}
          onCancel={closeModal}
          onSaved={closeAndReload}
        />
      )}
    </>
  );
}

/* ════════════════════════════════════════
   ADD / EDIT MODAL (shared form)
════════════════════════════════════════ */
function InternshipFormModal({ title, initial, categories, onCancel, onSaved }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    internship_name: initial?.internship_name || '',
    short_name: initial?.short_name || '',
    learnyst_name: initial?.learnyst_name || '',
    show_internship: initial?.show_internship ?? 1,
    has_gold: initial?.has_gold ?? 0,
    best_seller: initial?.best_seller ?? 0,
    is_full: initial?.is_full ?? 0,
    gold_community_link: initial?.gold_community_link || '',
    basic_community_link: initial?.basic_community_link || '',
    cat_id: initial?.cat_id || '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [syllabusFile, setSyllabusFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    if (!form.internship_name.trim()) { toast.error('Full name is required'); return; }
    if (!form.short_name.trim()) { toast.error('Short name is required'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('action', isEdit ? 'update_internship' : 'save_internship');
      if (isEdit) fd.append('internship_id', initial.id);
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (imageFile) fd.append('change_image', imageFile);
      if (syllabusFile) fd.append('change_syllabus', syllabusFile);

      const res = await api.post(API, fd, { headers: { 'Content-Type': undefined } });
      if (res.data.status === 'success') {
        toast.success(isEdit ? 'Internship updated' : 'Internship created');
        onSaved();
      } else {
        toast.error(res.data.message || 'Failed');
      }
    } catch { toast.error('Server error'); } finally { setSaving(false); }
  };

  return (
    <Modal title={title} onClose={onCancel} wide>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>

        <Field label="Full Name" half>
          <input className="il-inp" style={inputStyle} value={form.internship_name}
            onChange={set('internship_name')} placeholder="e.g. Web Development Internship" />
        </Field>

        <Field label="Short Name" half>
          <input className="il-inp" style={inputStyle} value={form.short_name}
            onChange={set('short_name')} placeholder="e.g. web_dev" />
        </Field>

        <Field label="Learnyst Name" half>
          <input className="il-inp" style={inputStyle} value={form.learnyst_name}
            onChange={set('learnyst_name')} placeholder="Learnyst platform name" />
        </Field>

        <Field label="Category" half>
          <select className="il-inp" style={selectStyle} value={form.cat_id} onChange={set('cat_id')}>
            <option value="">Select Category</option>
            {categories.map(c => (
              <option key={c.cat_id} value={c.cat_id}>{c.cat_name}</option>
            ))}
          </select>
        </Field>

        <Field label="Internship Visibility" half>
          <select className="il-inp" style={selectStyle} value={form.show_internship} onChange={set('show_internship')}>
            <option value="1">Show</option>
            <option value="0">Hide</option>
          </select>
        </Field>

        <Field label="Best Seller" half>
          <select className="il-inp" style={selectStyle} value={form.best_seller} onChange={set('best_seller')}>
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </Field>

        <Field label="Has Gold?" half>
          <select className="il-inp" style={selectStyle} value={form.has_gold} onChange={set('has_gold')}>
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </Field>

        <Field label="Domain Full" half>
          <select className="il-inp" style={selectStyle} value={form.is_full} onChange={set('is_full')}>
            <option value="0">Unfull</option>
            <option value="1">Full</option>
          </select>
        </Field>

        <Field label="Gold Whatsapp Link">
          <input className="il-inp" style={inputStyle} value={form.gold_community_link}
            onChange={set('gold_community_link')} placeholder="https://chat.whatsapp.com/..." />
        </Field>

        <Field label="Basic Whatsapp Community Link">
          <input className="il-inp" style={inputStyle} value={form.basic_community_link}
            onChange={set('basic_community_link')} placeholder="https://chat.whatsapp.com/..." />
        </Field>

        <Field label={isEdit ? 'Change Image (.webp)' : 'Image (.webp)'} half>
          {isEdit && initial.short_name && (
            <img
              src={`https://cit2.internshipstudio.com/assets/img/istudio/icons/${initial.short_name}.webp`}
              alt="" style={{
                width: 50, height: 36, objectFit: 'contain', display: 'block',
                marginBottom: 6, borderRadius: 4, border: '1px solid #e2e8f0'
              }}
              onError={e => e.target.style.display = 'none'}
            />
          )}
          <input type="file" style={inputStyle} accept="image/*"
            onChange={e => setImageFile(e.target.files[0])} />
        </Field>

        <Field label={isEdit ? 'Change Syllabus PDF' : 'Syllabus PDF'} half>
          <input type="file" style={inputStyle} accept=".pdf"
            onChange={e => setSyllabusFile(e.target.files[0])} />
          {isEdit && (
            <a href={`https://cit2.internshipstudio.com/assets/documents/syllabus/${initial.short_name}.pdf`}
              target="_blank" rel="noreferrer"
              style={{ fontSize: 11, color: '#4f46e5', marginTop: 4, display: 'block' }}>
              View current PDF ↗
            </a>
          )}
        </Field>

      </div>

      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20,
        borderTop: '1.5px solid #f1f5f9', paddingTop: 16
      }}>
        <button onClick={onCancel} style={{
          padding: '9px 18px', border: '1.5px solid #e2e8f0',
          background: '#f8fafc', color: '#475569', borderRadius: 8, fontSize: 12.5,
          fontWeight: 600, cursor: 'pointer'
        }}>Cancel</button>
        <button style={btnPrimary} onClick={submit} disabled={saving}>
          {saving ? 'Saving...' : (isEdit ? 'Update Internship' : 'Save Internship')}
        </button>
      </div>
    </Modal>
  );
}