import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/adminPanel/domain_management/domain_management.php';

/* ─── small shared bits ─── */
const Label = ({ c }) => (
  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5,
    textTransform:'uppercase', letterSpacing:'.05em' }}>{c}</label>
);
const Inp = ({ ...p }) => (
  <input {...p} style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0',
    borderRadius:8, fontSize:13, fontFamily:'inherit', color:'#1e293b', outline:'none', ...p.style }}
    onFocus={e=>e.target.style.borderColor='#4f46e5'}
    onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
);
const Sel = ({ children, ...p }) => (
  <select {...p} style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0',
    borderRadius:8, fontSize:13, fontFamily:'inherit', color:'#1e293b', outline:'none', background:'#fff', ...p.style }}
    onFocus={e=>e.target.style.borderColor='#4f46e5'}
    onBlur={e=>e.target.style.borderColor='#e2e8f0'}>
    {children}
  </select>
);
const FF = ({ label, children }) => <div style={{ marginBottom:14 }}><Label c={label}/>{children}</div>;
const Btn = ({ children, onClick, disabled, variant='primary', style={}, ...p }) => {
  const bg = {
    primary: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
    danger:  'linear-gradient(135deg,#dc2626,#b91c1c)',
    success: 'linear-gradient(135deg,#16a34a,#15803d)',
    green:   'linear-gradient(135deg,#10b981,#059669)',
    gray:    '#f1f5f9',
  };
  return (
    <button onClick={onClick} disabled={disabled} {...p}
      style={{ padding:'9px 18px', border:'none', borderRadius:9, fontSize:13, fontWeight:700,
        cursor:disabled?'not-allowed':'pointer', fontFamily:'inherit',
        background:bg[variant]||bg.primary, color:variant==='gray'?'#475569':'#fff',
        opacity:disabled?.6:1, display:'flex', alignItems:'center', gap:7, ...style }}>
      {children}
    </button>
  );
};

/* ─── Chip preview ─── */
const Chip = ({ label, variant }) => {
  const styles = {
    subdomain:  { bg:'#eff6ff', border:'#bfdbfe', color:'#1d4ed8' },
    skill:      { bg:'#fefce8', border:'#fde047', color:'#854d0e' },
    simulation: { bg:'#ecfeff', border:'#67e8f9', color:'#164e63' },
    job:        { bg:'#f0fdf4', border:'#86efac', color:'#166534' },
    more:       { bg:'#f8fafc', border:'#e2e8f0', color:'#64748b' },
  };
  const s = styles[variant] || styles.more;
  return (
    <span style={{ padding:'4px 10px', borderRadius:7, fontSize:11, fontWeight:600,
      background:s.bg, border:`1.5px solid ${s.border}`, color:s.color,
      maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
      {label}
    </span>
  );
};

/* ─── Section preview block inside card ─── */
function CardSection({ title, count, items, chipVariant }) {
  if (!items.length) return null;
  return (
    <div style={{ marginTop:14, paddingTop:14, borderTop:'1.5px solid #f5f3ff' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em' }}>{title}</span>
        <span style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff',
          padding:'2px 8px', borderRadius:10, fontSize:10, fontWeight:700 }}>{count}</span>
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
        {items.slice(0, 4).map((item, i) => <Chip key={i} label={item} variant={chipVariant}/>)}
        {count > 4 && <Chip label={`+${count-4} more`} variant="more"/>}
      </div>
    </div>
  );
}

/* ─── Confirm Modal ─── */
function ConfirmModal({ title, text, detail, onClose, onConfirm, loading }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'#fff', borderRadius:16, padding:28, width:'100%', maxWidth:420,
        boxShadow:'0 24px 70px rgba(0,0,0,.2)', textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:14 }}>⚠️</div>
        <div style={{ fontSize:16, fontWeight:800, color:'#1e293b', marginBottom:8 }}>{title}</div>
        <div style={{ fontSize:13, color:'#475569', lineHeight:1.7, marginBottom:8 }}>{text}</div>
        {detail && <div style={{ fontSize:12, color:'#ef4444', marginBottom:20 }}>{detail}</div>}
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          <Btn variant="gray" onClick={onClose}>Cancel</Btn>
          <Btn variant="danger" onClick={onConfirm} disabled={loading}>🗑️ Delete</Btn>
        </div>
      </div>
    </div>
  );
}

/* ─── Edit Domain Modal ─── */
function EditModal({ domain, onClose, onSave, loading }) {
  const [form, setForm] = useState({
    domain_name: domain.domain_name || '',
    description: domain.description || '',
    icon:        domain.icon || '',
    status:      domain.status || 'active',
  });
  const upd = k => e => setForm(p=>({...p,[k]:e.target.value}));
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:520, maxHeight:'92vh',
        overflowY:'auto', boxShadow:'0 24px 70px rgba(0,0,0,.22)' }}>
        <div style={{ padding:'16px 22px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
          borderRadius:'16px 16px 0 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:16, fontWeight:800, color:'#fff' }}>✏️ Edit Domain</span>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none', cursor:'pointer',
            color:'#fff', fontSize:18, borderRadius:6, padding:'2px 8px' }}>×</button>
        </div>
        <div style={{ padding:22 }}>
          <FF label="Domain Name *">
            <Inp value={form.domain_name} onChange={upd('domain_name')} placeholder="e.g. Web Development"/>
          </FF>
          <FF label="Description">
            <textarea value={form.description} onChange={upd('description')} rows={3}
              style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8,
                fontSize:13, fontFamily:'inherit', color:'#1e293b', outline:'none', resize:'vertical' }}
              onFocus={e=>e.target.style.borderColor='#4f46e5'}
              onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
          </FF>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <FF label="Icon (emoji)"><Inp value={form.icon} onChange={upd('icon')} placeholder="💻"/></FF>
            <FF label="Status">
              <Sel value={form.status} onChange={upd('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Sel>
            </FF>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:6 }}>
            <Btn variant="gray" onClick={onClose}>Cancel</Btn>
            <Btn onClick={()=>onSave(form)} disabled={loading || !form.domain_name.trim()}>
              💾 Save Changes
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Bulk Add Modal ─── */
const blankRow = () => ({ _key: Date.now()+Math.random(), domain_name:'', description:'', icon:'', status:'active' });

function BulkAddModal({ onClose, onSave, loading }) {
  const [rows, setRows] = useState([blankRow(), blankRow(), blankRow()]);
  const upd = (i, k) => e => setRows(prev => prev.map((r,idx)=>idx===i?{...r,[k]:e.target.value}:r));
  const remove = i => setRows(prev=>prev.filter((_,idx)=>idx!==i));
  const addRow = () => setRows(prev=>[...prev, blankRow()]);

  const handleSave = () => {
    const filled = rows.filter(r=>r.domain_name.trim());
    if (!filled.length) { toast.error('Add at least one domain name'); return; }
    const invalid = filled.find(r=>!r.domain_name.trim());
    if (invalid) { toast.error('Domain name is required for each row'); return; }
    onSave(filled);
  };

  const inpS = { width:'100%', padding:'8px 11px', border:'1.5px solid #e2e8f0', borderRadius:7,
    fontSize:12.5, fontFamily:'inherit', color:'#1e293b', outline:'none' };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:820,
        maxHeight:'92vh', overflowY:'auto', boxShadow:'0 24px 70px rgba(0,0,0,.22)' }}>
        {/* sticky header */}
        <div style={{ padding:'16px 22px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
          borderRadius:'16px 16px 0 0', display:'flex', alignItems:'center',
          justifyContent:'space-between', position:'sticky', top:0, zIndex:10 }}>
          <span style={{ fontSize:16, fontWeight:800, color:'#fff' }}>📦 Add Multiple Domains</span>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none', cursor:'pointer',
            color:'#fff', fontSize:18, borderRadius:6, padding:'2px 8px' }}>×</button>
        </div>

        <div style={{ padding:22 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {rows.map((row, i) => (
              <div key={row._key} style={{ background:'linear-gradient(135deg,#f8fafc,#f1f5f9)',
                borderRadius:12, padding:16, border:'1.5px solid #e2e8f0', position:'relative' }}>
                {/* row header */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <span style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff',
                    padding:'5px 13px', borderRadius:7, fontSize:12, fontWeight:700 }}>#{i+1}</span>
                  {rows.length > 1 && (
                    <button onClick={()=>remove(i)}
                      style={{ background:'#dc2626', color:'#fff', border:'none', padding:'5px 11px',
                        borderRadius:6, fontSize:11.5, fontWeight:700, cursor:'pointer' }}>× Remove</button>
                  )}
                </div>
                {/* row fields */}
                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:10, marginBottom:10 }}>
                  <div>
                    <Label c="Domain Name *"/>
                    <input style={inpS} value={row.domain_name} onChange={upd(i,'domain_name')}
                      placeholder="e.g. Web Development"
                      onFocus={e=>e.target.style.borderColor='#4f46e5'}
                      onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
                  </div>
                  <div>
                    <Label c="Status"/>
                    <select style={{...inpS,background:'#fff'}} value={row.status} onChange={upd(i,'status')}
                      onFocus={e=>e.target.style.borderColor='#4f46e5'}
                      onBlur={e=>e.target.style.borderColor='#e2e8f0'}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'3fr 1fr', gap:10 }}>
                  <div>
                    <Label c="Description"/>
                    <textarea style={{...inpS,resize:'none',height:56}} value={row.description}
                      onChange={upd(i,'description')} placeholder="Brief description..."
                      onFocus={e=>e.target.style.borderColor='#4f46e5'}
                      onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
                  </div>
                  <div>
                    <Label c="Icon (emoji)"/>
                    <input style={inpS} value={row.icon} onChange={upd(i,'icon')} placeholder="💻"
                      onFocus={e=>e.target.style.borderColor='#4f46e5'}
                      onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* sticky bottom actions */}
          <div style={{ display:'flex', gap:10, marginTop:18, flexWrap:'wrap' }}>
            <Btn variant="gray" onClick={addRow} style={{ flex:1 }}>
              ➕ Add Another Domain
            </Btn>
            <Btn variant="success" onClick={handleSave} disabled={loading} style={{ flex:1 }}>
              {loading ? '⏳ Saving...' : '💾 Save All Domains'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DOMAIN CARD
═══════════════════════════════════════════════════════════ */
function DomainCard({ domain, subdomains, skills, simulations, jobs, selected, onSelect, onEdit, onDelete, onOpen }) {
  const subdNames = subdomains.map(s=>s.subdomain_name);
  const skillNames = skills.map(s=>s.skill_name);
  const simTitles = simulations.map(s=>s.title);
  const jobTitles = jobs.map(j=>j.job_title);

  return (
    <div style={{ background:'#fff', borderRadius:16, padding:20, border:`2px solid ${selected?'#4f46e5':'#ede9fe'}`,
      transition:'all .25s', boxShadow: selected?'0 0 0 4px rgba(79,70,229,.12)':'0 4px 18px rgba(79,70,229,.07)',
      position:'relative' }}
      onMouseEnter={e=>{if(!selected)e.currentTarget.style.boxShadow='0 12px 32px rgba(79,70,229,.14)';e.currentTarget.style.transform='translateY(-3px)';}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow=selected?'0 0 0 4px rgba(79,70,229,.12)':'0 4px 18px rgba(79,70,229,.07)';e.currentTarget.style.transform='translateY(0)';}}>

      {/* checkbox */}
      <input type="checkbox" checked={selected} onChange={e=>onSelect(domain.id, e.target.checked)}
        style={{ position:'absolute', top:16, left:16, width:19, height:19, cursor:'pointer', accentColor:'#4f46e5' }}/>

      {/* header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start',
        paddingLeft:30, marginBottom:10 }}>
        <div>
          <h3 style={{ fontSize:17, fontWeight:800, color:'#1e293b', marginBottom:3, lineHeight:1.3 }}>
            {domain.icon && <span style={{ marginRight:7 }}>{domain.icon}</span>}
            {domain.domain_name}
          </h3>
          <span style={{ fontSize:10.5, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em' }}>Domain</span>
        </div>
        <span style={{ padding:'5px 12px', borderRadius:20, fontSize:10.5, fontWeight:700,
          textTransform:'uppercase', letterSpacing:'.04em',
          background: domain.status==='active' ? 'linear-gradient(135deg,#d1fae5,#a7f3d0)' : 'linear-gradient(135deg,#fee2e2,#fecaca)',
          color: domain.status==='active' ? '#065f46' : '#991b1b' }}>
          {domain.status}
        </span>
      </div>

      {/* description */}
      <p style={{ fontSize:12.5, color:'#64748b', lineHeight:1.65, margin:'0 0 4px',
        display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
        {domain.description || 'No description available'}
      </p>

      {/* sections */}
      <CardSection title="Subdomains"  count={subdomains.length}  items={subdNames}  chipVariant="subdomain"/>
      <CardSection title="Skills"      count={skills.length}      items={skillNames} chipVariant="skill"/>
      <CardSection title="Simulations" count={simulations.length} items={simTitles}  chipVariant="simulation"/>
      <CardSection title="Jobs"        count={jobs.length}        items={jobTitles}  chipVariant="job"/>

      {/* actions */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.2fr 1fr', gap:8, marginTop:18 }}>
        <button onClick={()=>onEdit(domain)}
          style={{ padding:'9px 6px', borderRadius:9, border:'none', cursor:'pointer', fontSize:12.5,
            fontWeight:700, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff',
            display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
          ✏️ Rename
        </button>
        <button onClick={()=>onOpen(domain.id)}
          style={{ padding:'9px 6px', borderRadius:9, border:'none', cursor:'pointer', fontSize:12.5,
            fontWeight:700, background:'linear-gradient(135deg,#10b981,#059669)', color:'#fff',
            display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
          📂 Open
        </button>
        <button onClick={()=>onDelete(domain)}
          style={{ padding:'9px 6px', borderRadius:9, border:'none', cursor:'pointer', fontSize:12.5,
            fontWeight:700, background:'linear-gradient(135deg,#fee2e2,#fecaca)', color:'#991b1b',
            display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
          🗑️ Delete
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function DomainManagement() {
  const navigate = useNavigate();
  const [data,     setData]     = useState({ domains:[], subdomains:[], skills:[], simulations:[], jobs:[] });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [selected, setSelected] = useState(new Set()); // Set of domain ids
  const [modal,    setModal]    = useState(null);       // null | 'bulk_add' | 'edit' | 'delete_single' | 'delete_bulk'
  const [editTgt,  setEditTgt]  = useState(null);
  const [delTgt,   setDelTgt]   = useState(null);

  /* ── load all ── */
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`${API}?action=get_all`);
      setData(r.data.data || { domains:[], subdomains:[], skills:[], simulations:[], jobs:[] });
    } catch(e) { toast.error(e.response?.data?.message||'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ── selection ── */
  const toggleSelect = (id, checked) => {
    setSelected(prev => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };
  const toggleAll = checked => {
    setSelected(checked ? new Set(data.domains.map(d=>d.id)) : new Set());
  };

  /* ── bulk save domains ── */
  const handleBulkSave = async rows => {
    setSaving(true);
    try {
      const fd = new URLSearchParams({ action:'bulk_save_domains', items:JSON.stringify(rows) });
      const r  = await api.post(API, fd);
      toast.success(r.data.message||'Saved');
      setModal(null);
      loadAll();
    } catch(e) { toast.error(e.response?.data?.message||'Failed'); }
    finally { setSaving(false); }
  };

  /* ── update single domain ── */
  const handleEditSave = async form => {
    setSaving(true);
    try {
      const fd = new URLSearchParams({ action:'update_domain', id:editTgt.id, ...form });
      const r  = await api.post(API, fd);
      toast.success(r.data.message||'Updated');
      setModal(null); setEditTgt(null);
      loadAll();
    } catch(e) { toast.error(e.response?.data?.message||'Failed'); }
    finally { setSaving(false); }
  };

  /* ── delete single ── */
  const handleDeleteSingle = async () => {
    setSaving(true);
    try {
      const fd = new URLSearchParams({ action:'bulk_delete', type:'domain', ids:JSON.stringify([delTgt.id]) });
      const r  = await api.post(API, fd);
      toast.success(r.data.message||'Deleted');
      setModal(null); setDelTgt(null);
      loadAll();
    } catch(e) { toast.error(e.response?.data?.message||'Failed'); }
    finally { setSaving(false); }
  };

  /* ── bulk delete ── */
  const handleBulkDelete = async () => {
    setSaving(true);
    try {
      const fd = new URLSearchParams({ action:'bulk_delete', type:'domain', ids:JSON.stringify([...selected]) });
      const r  = await api.post(API, fd);
      toast.success(r.data.message||'Deleted');
      setModal(null); setSelected(new Set());
      loadAll();
    } catch(e) { toast.error(e.response?.data?.message||'Failed'); }
    finally { setSaving(false); }
  };

  /* ── derived stats ── */
  const stats = {
    total:    data.domains.length,
    active:   data.domains.filter(d=>d.status==='active').length,
    inactive: data.domains.filter(d=>d.status!=='active').length,
    subs:     data.subdomains.length,
    skills:   data.skills.length,
  };

  /* ── derive per-domain counts ── */
  const getDomainData = domain => {
    const subdomains  = data.subdomains.filter(s=>s.domain_id==domain.id);
    const subIds      = subdomains.map(s=>s.id).map(Number);
    const skills      = data.skills.filter(sk=>subIds.includes(+sk.subdomain_id));
    const simulations = data.simulations.filter(s=>subIds.includes(+s.subdomain_id));
    const jobs        = data.jobs.filter(j=>subIds.includes(+j.subdomain_id));
    return { subdomains, skills, simulations, jobs };
  };

  const selCount = selected.size;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .dm-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        @keyframes dm_spin { to { transform:rotate(360deg); } }
        .dm-spin { display:inline-block;width:20px;height:20px;border:2.5px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:dm_spin .7s linear infinite; }
      `}</style>

      <div className="dm-root" style={{ minHeight:'calc(100vh - 62px)', background:'#f5f3ff',
        overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:16 }}>

        {/* ══ HEADER ══ */}
        <div style={{ background:'#fff', borderRadius:16, padding:'20px 26px',
          boxShadow:'0 4px 20px rgba(79,70,229,.08)', border:'1.5px solid #ede9fe',
          display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:50, height:50, borderRadius:13,
              background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
              🎓
            </div>
            <div>
              <h1 style={{ fontSize:20, fontWeight:800, color:'#1e293b', margin:0 }}>Domain Management</h1>
              <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>Manage all internship domains</div>
            </div>
          </div>
          {/* stats */}
          <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
            {[
              { label:'Total Domains', val:stats.total },
              { label:'Active',        val:stats.active,   color:'#16a34a' },
              { label:'Subdomains',    val:stats.subs },
              { label:'Skills',        val:stats.skills },
            ].map(s=>(
              <div key={s.label} style={{ textAlign:'center' }}>
                <div style={{ fontSize:26, fontWeight:800,
                  background: s.color||'linear-gradient(135deg,#4f46e5,#7c3aed)',
                  WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                  backgroundClip:'text', color:s.color||undefined }}>
                  {loading ? '…' : s.val}
                </div>
                <div style={{ fontSize:10, color:'#94a3b8', fontWeight:700,
                  textTransform:'uppercase', letterSpacing:'.05em', marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ ACTION BAR ══ */}
        <div style={{ background:'#fff', borderRadius:14, padding:'13px 20px',
          boxShadow:'0 2px 10px rgba(79,70,229,.06)', border:'1.5px solid #ede9fe',
          display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
          {/* selection info + select all */}
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <label style={{ display:'flex', alignItems:'center', gap:7, fontSize:13, fontWeight:600, color:'#475569', cursor:'pointer' }}>
              <input type="checkbox" checked={selCount===data.domains.length&&data.domains.length>0}
                onChange={e=>toggleAll(e.target.checked)}
                style={{ width:17, height:17, accentColor:'#4f46e5', cursor:'pointer' }}/>
              Select All
            </label>
            {selCount>0&&(
              <span style={{ background:'#4f46e5', color:'#fff', padding:'4px 11px',
                borderRadius:20, fontSize:12, fontWeight:700 }}>{selCount} selected</span>
            )}
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {selCount>0&&(
              <Btn variant="danger" onClick={()=>setModal('delete_bulk')}>
                🗑️ Delete Selected ({selCount})
              </Btn>
            )}
            <Btn onClick={()=>setModal('bulk_add')}>
              ➕ Add Multiple Domains
            </Btn>
          </div>
        </div>

        {/* ══ DOMAINS GRID ══ */}
        {loading ? (
          <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>
            <span className="dm-spin" style={{ width:32, height:32, borderWidth:3.5, display:'inline-block' }}/>
            <div style={{ marginTop:14, fontSize:13 }}>Loading domains...</div>
          </div>
        ) : !data.domains.length ? (
          <div style={{ background:'#fff', borderRadius:16, padding:'70px 20px',
            textAlign:'center', border:'1.5px solid #ede9fe', boxShadow:'0 4px 18px rgba(79,70,229,.06)' }}>
            <div style={{ fontSize:60, marginBottom:16, opacity:.3 }}>📦</div>
            <div style={{ fontSize:17, color:'#64748b', fontWeight:700, marginBottom:8 }}>No domains found</div>
            <div style={{ fontSize:13, color:'#94a3b8' }}>Click "Add Multiple Domains" to get started</div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(360px,1fr))', gap:16 }}>
            {data.domains.map(domain => {
              const { subdomains, skills, simulations, jobs } = getDomainData(domain);
              return (
                <DomainCard key={domain.id} domain={domain}
                  subdomains={subdomains} skills={skills} simulations={simulations} jobs={jobs}
                  selected={selected.has(domain.id)}
                  onSelect={toggleSelect}
                  onEdit={d=>{ setEditTgt(d); setModal('edit'); }}
                  onDelete={d=>{ setDelTgt(d); setModal('delete_single'); }}
                  onOpen={id=>navigate(`/domains/${id}`)}/>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ MODALS ══ */}

      {modal==='bulk_add'&&(
        <BulkAddModal onClose={()=>setModal(null)} onSave={handleBulkSave} loading={saving}/>
      )}

      {modal==='edit'&&editTgt&&(
        <EditModal domain={editTgt} onClose={()=>{setModal(null);setEditTgt(null);}} onSave={handleEditSave} loading={saving}/>
      )}

      {modal==='delete_single'&&delTgt&&(
        <ConfirmModal
          title="Delete this domain?"
          text={<>Are you sure you want to delete <strong>{delTgt.domain_name}</strong>?</>}
          detail="This will also delete all associated subdomains, skills, simulations, and jobs!"
          onClose={()=>{setModal(null);setDelTgt(null);}}
          onConfirm={handleDeleteSingle}
          loading={saving}/>
      )}

      {modal==='delete_bulk'&&(
        <ConfirmModal
          title={`Delete ${selCount} domain(s)?`}
          text={`You are about to delete ${selCount} domain(s) and all their content.`}
          detail="This action cannot be undone."
          onClose={()=>setModal(null)}
          onConfirm={handleBulkDelete}
          loading={saving}/>
      )}
    </>
  );
}