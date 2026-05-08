import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/examinations/cit_versions.php';
const FH  = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk  = obj => new URLSearchParams(obj);

/* ─── shared styles ─── */
const thS = {
  color:'#fff', fontSize:11, fontWeight:600, padding:'10px 11px',
  textAlign:'left', textTransform:'uppercase', letterSpacing:'.3px',
  borderRight:'1px solid rgba(255,255,255,.15)', whiteSpace:'nowrap',
};
const tdS  = { padding:'8px 11px', borderBottom:'1px solid #f5f3ff', fontSize:11.5, color:'#334155', verticalAlign:'middle' };
const inp  = { padding:'7px 10px', border:'1.5px solid #e2e8f0', borderRadius:6, fontSize:11.5,
  fontFamily:'inherit', color:'#1e293b', outline:'none', width:'100%', boxSizing:'border-box' };

/* ─── empty form shapes ─── */
const emptyNew = { cit_name:'', start:'', end:'', exam_start:'', exam_end:'', result:'', certificate:'', Initial:'' };
const emptyOld = { exam_name:'', from_date:'', to_date:'', result_date:'', certificate_date:'', exam_start_date:'', exam_end_date:'', wa_community_initials:'' };

/* ─── confirm modal ─── */
function Confirm({ msg, onOk, onCancel }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:14, maxWidth:400, width:'100%',
        boxShadow:'0 20px 60px rgba(0,0,0,.25)', overflow:'hidden' }}>
        <div style={{ padding:'13px 18px', background:'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
          <span style={{ fontSize:13.5, fontWeight:700, color:'#fff' }}>⚠️ Confirm Delete</span>
        </div>
        <div style={{ padding:'18px 20px' }}>
          <p style={{ fontSize:13, color:'#334155', marginBottom:18, lineHeight:1.5 }}>{msg}</p>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={onCancel} style={{ padding:'8px 16px', border:'1.5px solid #e2e8f0',
              background:'#f8fafc', color:'#475569', borderRadius:8, fontSize:12, cursor:'pointer' }}>Cancel</button>
            <button onClick={onOk} style={{ padding:'8px 18px', border:'none', borderRadius:8,
              background:'linear-gradient(135deg,#dc2626,#b91c1c)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              Yes, Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Add/Edit modal (shared for both tables) ─── */
function VersionModal({ title, fields, form, onChange, onSave, onClose, saving }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:720,
        maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ padding:'13px 18px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
          display:'flex', justifyContent:'space-between', alignItems:'center',
          position:'sticky', top:0, zIndex:5, borderRadius:'14px 14px 0 0' }}>
          <span style={{ fontSize:13.5, fontWeight:700, color:'#fff' }}>{title}</span>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none',
            borderRadius:6, width:26, height:26, cursor:'pointer', color:'#fff', fontSize:17 }}>×</button>
        </div>
        <div style={{ padding:20, display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 18px' }}>
          {fields.map(f => (
            <div key={f.key}>
              <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'#64748b',
                textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>{f.label}</label>
              <input style={inp} type={f.type||'text'} value={form[f.key]||''}
                onChange={e => onChange(f.key, e.target.value)} placeholder={f.label}/>
            </div>
          ))}
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1.5px solid #f1f5f9',
          display:'flex', justifyContent:'flex-end', gap:10, position:'sticky', bottom:0, background:'#fff' }}>
          <button onClick={onClose} style={{ padding:'8px 16px', border:'1.5px solid #e2e8f0',
            background:'#f8fafc', color:'#475569', borderRadius:8, fontSize:12, cursor:'pointer' }}>Close</button>
          <button onClick={onSave} disabled={saving} style={{ padding:'8px 22px', border:'none',
            borderRadius:8, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff',
            fontSize:12, fontWeight:700, cursor: saving?'not-allowed':'pointer', opacity: saving?.7:1 }}>
            {saving ? 'Saving...' : '💾 Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── field definitions ─── */
const NEW_FIELDS = [
  { key:'cit_name',    label:'CIT Name',    type:'text' },
  { key:'start',       label:'Start',       type:'date' },
  { key:'end',         label:'End',         type:'date' },
  { key:'exam_start',  label:'Exam Start',  type:'date' },
  { key:'exam_end',    label:'Exam End',    type:'date' },
  { key:'result',      label:'Result Date', type:'date' },
  { key:'certificate', label:'Certificate', type:'date' },
  { key:'Initial',     label:'Initial',     type:'text' },
];
const OLD_FIELDS = [
  { key:'exam_name',             label:'Exam Name',         type:'text' },
  { key:'from_date',             label:'From Date',         type:'date' },
  { key:'to_date',               label:'To Date',           type:'date' },
  { key:'result_date',           label:'Result Date',       type:'date' },
  { key:'certificate_date',      label:'Certificate Date',  type:'date' },
  { key:'exam_start_date',       label:'Exam Start Date',   type:'date' },
  { key:'exam_end_date',         label:'Exam End Date',     type:'date' },
  { key:'wa_community_initials', label:'WA Community Initials', type:'text' },
];

/* ════════ MAIN COMPONENT ════════ */
export default function CITVersions() {
  const [newRows,   setNewRows]   = useState([]);
  const [oldRows,   setOldRows]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null);  // { type:'new'|'old', mode:'add'|'edit', id }
  const [form,      setForm]      = useState({});
  const [saving,    setSaving]    = useState(false);
  const [confirm,   setConfirm]   = useState(null);  // { id, type:'new'|'old' }

  /* ── fetch both tables ── */
  const fetchAll = () => {
    setLoading(true);
    api.get(API)
      .then(res => {
        if (res.data.status === 'success') {
          setNewRows(res.data.new || []);
          setOldRows(res.data.old || []);
        }
      })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  /* ── open modals ── */
  const openAdd = (type) => {
    setForm(type === 'new' ? { ...emptyNew } : { ...emptyOld });
    setModal({ type, mode:'add' });
  };
  const openEdit = (type, row) => {
    setForm({ ...row });
    setModal({ type, mode:'edit', id: row.id });
  };

  /* ── save (add or update) — same action names as PHP ── */
  const handleSave = async () => {
    const isNew  = modal.type === 'new';
    const isEdit = modal.mode === 'edit';
    const action = isNew
      ? (isEdit ? 'update_cit_version2' : 'add_cit_version2')
      : (isEdit ? 'update_cit_version'  : 'add_cit_version');

    setSaving(true);
    try {
      const res = await api.post(API, mk({ action, ...form }), FH);
      if (res.data.status === 'success') {
        toast.success(res.data.message); setModal(null); fetchAll();
      } else { toast.error(res.data.message || 'Failed'); }
    } catch { toast.error('Error'); }
    finally { setSaving(false); }
  };

  /* ── delete ── */
  const execDelete = async () => {
    const { id, type } = confirm;
    const action = type === 'new' ? 'delete_cit_version2' : 'delete_cit_version';
    setConfirm(null);
    try {
      const res = await api.post(API, mk({ action, id }), FH);
      if (res.data.status === 'success') {
        toast.success(res.data.message);
        type === 'new'
          ? setNewRows(p => p.filter(r => r.id != id))
          : setOldRows(p => p.filter(r => r.id != id));
      } else { toast.error(res.data.message || 'Failed'); }
    } catch { toast.error('Error'); }
  };

  /* ── download report — same URLs as PHP ── */
  const downloadNew = (row) =>
    window.open(`/download/download_data.php?type=simplified_complete_data_new&cit_ids=${row.id}`, '_blank');
  const downloadOld = (row) =>
    window.open(`/download/download_data.php?type=simplified_complete_data&version=${row.exam_name}`, '_blank');

  const fieldChange = (k, v) => setForm(p => ({ ...p, [k]: v }));

  /* ── table renderer ── */
  const renderTable = (rows, cols, type, onEdit, onDelete, onDownload, addLabel) => (
    <div style={{ background:'#fff', borderRadius:12, border:'1.5px solid #ede9fe',
      boxShadow:'0 1px 8px rgba(79,70,229,.05)', overflow:'hidden' }}>
      {/* table header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 14px', borderBottom:'1.5px solid #ede9fe' }}>
        <span style={{ fontSize:13, fontWeight:800, color:'#1e293b' }}>
          {type === 'new' ? '🆕 CIT Versions (New)' : '📁 CIT Versions (Old)'}
        </span>
        <button onClick={() => openAdd(type)}
          style={{ padding:'7px 16px', border:'none', borderRadius:8, fontSize:12, fontWeight:700,
            cursor:'pointer', color:'#fff', background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
          + {addLabel}
        </button>
      </div>
      <div style={{ overflowX:'auto', maxHeight:340, overflowY:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead style={{ position:'sticky', top:0, zIndex:2 }}>
            <tr style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
              {[...cols, 'Action'].map(h => <th key={h} style={thS}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={cols.length+1} style={{ textAlign:'center', padding:30, color:'#94a3b8' }}>
                Loading...
              </td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={cols.length+1} style={{ textAlign:'center', padding:30, color:'#94a3b8', fontSize:12.5 }}>
                No versions found
              </td></tr>
            ) : rows.map(row => (
              <tr key={row.id} style={{ cursor:'default' }}
                onMouseEnter={e => [...e.currentTarget.cells].forEach(c=>c.style.background='#faf9ff')}
                onMouseLeave={e => [...e.currentTarget.cells].forEach(c=>c.style.background='')}>
                {Object.keys(type==='new' ? emptyNew : emptyOld).map(k => (
                  <td key={k} style={tdS}>{row[k] || '—'}</td>
                ))}
                <td style={{ ...tdS, whiteSpace:'nowrap' }}>
                  <button onClick={() => openEdit(type, row)}
                    style={{ padding:'4px 10px', background:'#fef9c3', color:'#b45309',
                      border:'1.5px solid #fde68a', borderRadius:5, fontSize:10.5, fontWeight:600,
                      cursor:'pointer', marginRight:4 }}>✏️ Edit</button>
                  <button onClick={() => setConfirm({ id: row.id, type })}
                    style={{ padding:'4px 10px', background:'#fee2e2', color:'#dc2626',
                      border:'1.5px solid #fecaca', borderRadius:5, fontSize:10.5, fontWeight:600,
                      cursor:'pointer', marginRight:4 }}>🗑 Delete</button>
                  <button onClick={() => type==='new' ? downloadNew(row) : downloadOld(row)}
                    style={{ padding:'4px 10px', background:'#dcfce7', color:'#16a34a',
                      border:'1.5px solid #bbf7d0', borderRadius:5, fontSize:10.5, fontWeight:600,
                      cursor:'pointer' }}>⬇️ Report</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ════════ RENDER ════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .cv-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        @keyframes cv_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="cv-root" style={{
        display:'flex', flexDirection:'column',
        height:'calc(100vh - 62px)',
        padding:20, gap:14, overflow:'hidden', background:'#f5f3ff',
      }}>

        {/* ── HEADER ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ fontSize:17, fontWeight:800, color:'#1e293b' }}>🎓 CIT Versions</div>
          {/* Publish Result — same as PHP's window.location.href='/admin/seed_result_new.php' */}
          <button onClick={() => window.open('/admin/seed_result_new.php', '_blank')}
            style={{ padding:'8px 18px', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700,
              cursor:'pointer', color:'#fff', background:'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
            🚀 Publish Result
          </button>
        </div>

        {/* ── TWO TABLES (scrollable area) ── */}
        <div style={{ flex:1, minHeight:0, overflowY:'auto', display:'flex', flexDirection:'column', gap:16 }}>
          {renderTable(newRows,
            ['CIT Name','Start','End','Exam Start','Exam End','Result','Certificate','Initial'],
            'new', openEdit, setConfirm, downloadNew, 'Add CIT Version'
          )}
          {renderTable(oldRows,
            ['Exam Name','From Date','To Date','Result Date','Certificate Date','Exam Start','Exam End','WA Initials'],
            'old', openEdit, setConfirm, downloadOld, 'Add CIT Version (Old)'
          )}
        </div>
      </div>

      {/* ── ADD / EDIT MODAL ── */}
      {modal && (
        <VersionModal
          title={`${modal.mode === 'edit' ? '✏️ Edit' : '➕ Add'} ${modal.type === 'new' ? 'CIT Version (New)' : 'CIT Version (Old)'}`}
          fields={modal.type === 'new' ? NEW_FIELDS : OLD_FIELDS}
          form={form}
          onChange={fieldChange}
          onSave={handleSave}
          onClose={() => setModal(null)}
          saving={saving}
        />
      )}

      {/* ── CONFIRM DELETE MODAL ── */}
      {confirm && (
        <Confirm
          msg={`Are you sure you want to delete this CIT version? This cannot be undone.`}
          onOk={execDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}