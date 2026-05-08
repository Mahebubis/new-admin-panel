import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const API = '/api/reports/batch_dates.php';
const FH  = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk  = obj => new URLSearchParams(obj);
const url = (action) => `${API}?action=${action}`;

/* ─── date helpers ─── */
const isoToOrdinal = (iso) => {
  if (!iso) return '';
  const dt = new Date(iso + 'T12:00:00');
  const d = dt.getDate(), m = dt.toLocaleString('default',{month:'long'}), y = dt.getFullYear();
  const sfx = d>3&&d<21?'th':d%10===1?'st':d%10===2?'nd':d%10===3?'rd':'th';
  return `${d}${sfx} ${m}, ${y}`;
};
// const ordinalToISO = (str) => {
//   if (!str) return '';
//   try {
//     const [day, mon, yr] = str.split(' ');
//     const n = parseInt(day.replace(/\D/g,''));
//     return new Date(`${mon.replace(',','')} ${n}, ${yr}`).toISOString().substring(0,10);
//   } catch { return ''; }
// };

const ordinalToISO = (str) => {
  if (!str) return '';
  try {
    const [day, mon, yr] = str.split(' ');
    const n = parseInt(day.replace(/\D/g,''));

    const months = {
      January: 0, February: 1, March: 2, April: 3,
      May: 4, June: 5, July: 6, August: 7,
      September: 8, October: 9, November: 10, December: 11
    };

    const mIndex = months[mon.replace(',', '')];

    // ✅ Use local date (NOT UTC conversion)
    const dt = new Date(yr, mIndex, n);

    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return '';
  }
};
const statusLabel = (s) => s==='empty'?'Available':s==='half'?'Filling Fast':'Batch Full';
const statusFromSeats = (rem, tot) => rem>=tot?'empty':rem===0?'full':rem<=tot*0.7?'half':'empty';

/* ─── shared input style ─── */
const inpS = { padding:'6px 10px', border:'1.5px solid #e2e8f0', borderRadius:7,
  fontSize:12, fontFamily:'inherit', color:'#1e293b', outline:'none', width:'100%' };

/* ─── Status badge ─── */
const StatusBadge = ({ s }) => {
  const cfg = { empty:['#dcfce7','#16a34a','Available'], half:['#fef9c3','#b45309','Filling Fast'], full:['#fee2e2','#dc2626','Batch Full'] };
  const [bg,color,lbl] = cfg[s] || cfg.empty;
  return <span style={{ padding:'3px 10px', background:bg, color, borderRadius:99, fontSize:10.5, fontWeight:700 }}>{lbl}</span>;
};

/* ─── Inline edit row for exam dates ─── */
function EditRow({ row, onSave, onCancel }) {
  const [f, setF] = useState({ date:ordinalToISO(row.date), status:row.status,
    total_seats:row.total_seats, remaining_seats:row.remaining_seats, is_special:row.is_special==1 });
  const s = (k,v) => setF(p=>({...p,[k]:v}));
  return (
    <tr style={{ background:'#f5f3ff' }}>
      <td style={tdS}><input type="date" style={inpS} value={f.date} onChange={e=>s('date',e.target.value)}/></td>
      <td style={tdS}>
        <select style={inpS} value={f.status} onChange={e=>s('status',e.target.value)}>
          {['empty','half','full'].map(v=><option key={v} value={v}>{statusLabel(v)}</option>)}
        </select>
      </td>
      <td style={tdS}><input type="number" style={inpS} value={f.total_seats} min="1" onChange={e=>s('total_seats',parseInt(e.target.value))}/></td>
      <td style={tdS}>
        <input type="range" min="0" max={f.total_seats} value={f.remaining_seats} style={{width:'80%'}}
          onChange={e=>{const v=parseInt(e.target.value);s('remaining_seats',v);s('status',statusFromSeats(v,f.total_seats));}}/>
        <strong style={{color:'#4f46e5',fontSize:12,marginLeft:6}}>{f.remaining_seats}</strong>
      </td>
      <td style={{...tdS, textAlign:'center'}}>
        <input type="checkbox" checked={f.is_special} onChange={e=>s('is_special',e.target.checked)}
          style={{accentColor:'#4f46e5',width:15,height:15}}/>
      </td>
      <td style={{...tdS, whiteSpace:'nowrap'}}>
        <button onClick={()=>onSave({...f, date:isoToOrdinal(f.date), is_special:f.is_special?1:0})}
          style={sBtn('#16a34a')}>✓</button>
        {' '}<button onClick={onCancel} style={sBtn('#dc2626')}>✕</button>
      </td>
    </tr>
  );
}

/* ─── Inline edit for special ─── */
function EditSpRow({ row, onSave, onCancel }) {
  const [f, setF] = useState({ date:ordinalToISO(row.date), status:row.status,
    total_seats:row.total_seats, remaining_seats:row.remaining_seats });
  const s = (k,v) => setF(p=>({...p,[k]:v}));
  return (
    <tr style={{ background:'#fff5f5' }}>
      <td style={tdS}><input type="date" style={inpS} value={f.date} onChange={e=>s('date',e.target.value)}/></td>
      <td style={tdS}>
        <select style={inpS} value={f.status} onChange={e=>s('status',e.target.value)}>
          {['empty','half','full'].map(v=><option key={v} value={v}>{statusLabel(v)}</option>)}
        </select>
      </td>
      <td style={tdS}><input type="number" style={inpS} value={f.total_seats} min="1" onChange={e=>s('total_seats',parseInt(e.target.value))}/></td>
      <td style={tdS}><input type="number" style={inpS} value={f.remaining_seats} min="0" onChange={e=>s('remaining_seats',parseInt(e.target.value))}/></td>
      <td style={{...tdS, whiteSpace:'nowrap'}}>
        <button onClick={()=>onSave({...f, date:isoToOrdinal(f.date)})} style={sBtn('#16a34a')}>✓</button>
        {' '}<button onClick={onCancel} style={sBtn('#dc2626')}>✕</button>
      </td>
    </tr>
  );
}

/* ─── small button helper ─── */
const sBtn = (color) => ({ padding:'4px 10px', background:color, border:'none', borderRadius:6,
  color:'#fff', fontSize:11.5, fontWeight:700, cursor:'pointer' });

/* ─── shared table head ─── */
const thS = { color:'#fff', fontSize:10.5, fontWeight:700, padding:'10px 14px',
  textAlign:'left', textTransform:'uppercase', letterSpacing:'.4px', whiteSpace:'nowrap',
  borderRight:'1px solid rgba(255,255,255,.15)' };
const tdS = { padding:'10px 14px', borderBottom:'1px solid #f1f0fe', fontSize:12.5, verticalAlign:'middle' };

/* ─── Section wrapper ─── */
const Section = ({ icon, title, headerBg, borderColor, children }) => (
  <div style={{ borderRadius:14, overflow:'visible', border:`1.5px solid ${borderColor}`,
    boxShadow:'0 2px 12px rgba(79,70,229,.07)' }}>
    <div style={{ padding:'12px 18px', background:headerBg, display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ fontSize:16 }}>{icon}</span>
      <span style={{ fontSize:13.5, fontWeight:800, color:'#fff' }}>{title}</span>
    </div>
    <div style={{ background:'#fff' }}>{children}</div>
  </div>
);

/* ═════════════════════════════════════
   MAIN COMPONENT
═════════════════════════════════════ */
export default function BatchDates() {
  const [dates,        setDates]        = useState([]);
  const [special,      setSpecial]      = useState([]);
  const [citNew,       setCitNew]       = useState([]);
  const [citOld,       setCitOld]       = useState([]);
  const [pivot,        setPivot]        = useState([]);
  const [origPivot,    setOrigPivot]    = useState([]);
  const [citState,     setCitState]     = useState({});
  const [origCit,      setOrigCit]      = useState({});
  const [refund,       setRefund]       = useState({ from:'', to:'' });
  const [editId,       setEditId]       = useState(null);
  const [editSpId,     setEditSpId]     = useState(null);
  const [saving,       setSaving]       = useState('');
  const [loading,      setLoading]      = useState(true);

  const fetchAll = useCallback(() => {
    setLoading(true);
    api.get(API).then(res => {
      if (res.data.status !== 'success') return;
      setDates(res.data.dates || []);
      setSpecial(res.data.special || []);
      setCitNew(res.data.cit_new || []);
      const olds = res.data.cit_old || [];
      setCitOld(olds);
      const [from='',to=''] = (res.data.refund_range||'').split('|');
      setRefund({ from, to });
      const cs = {}; olds.forEach(c=>{ cs[c.id]={special:c.special==1,normal:c.normal==1}; });
      setCitState(cs); setOrigCit(JSON.parse(JSON.stringify(cs)));
    }).catch(()=>toast.error('Failed to load')).finally(()=>setLoading(false));
  }, []);

  const fetchPivot = useCallback(() => {
    api.post(url('fetch_new_cit_relationships'), mk({action:'fetch_new_cit_relationships'}), FH)
      .then(res=>{ const d=Array.isArray(res.data)?res.data:[]; setPivot(d); setOrigPivot(JSON.parse(JSON.stringify(d))); })
      .catch(()=>{});
  }, []);

  useEffect(()=>{ fetchAll(); fetchPivot(); },[fetchAll,fetchPivot]);

  /* ── sort dates ── */
  const sortedDates = [...dates].sort((a,b) => {
    try { return new Date(ordinalToISO(a.date))-new Date(ordinalToISO(b.date)); } catch { return 0; }
  });
  const currentDates  = sortedDates.filter(d=>d.show_date==1);
  const previousDates = sortedDates.filter(d=>d.show_date==0);
  const activeSpecial = special.filter(d=>d.show_date==1);

  /* ── pivot helpers ── */
  const isPivotSel = (dId,cId) => pivot.some(r=>r.exam_date_id==dId&&r.cit_version_id==cId&&r.selected==1);
  const togglePivot = (dId,cId,checked) => setPivot(p=>{
    const ex=p.find(r=>r.exam_date_id==dId&&r.cit_version_id==cId);
    if(ex) return p.map(r=>r.exam_date_id==dId&&r.cit_version_id==cId?{...r,selected:checked?1:0}:r);
    return [...p,{exam_date_id:dId,cit_version_id:cId,selected:checked?1:0}];
  });
  const citShows = (isSpecial,cId) => { const c=citState[cId]; return c?(isSpecial?c.special:c.normal):false; };

  /* ── post helper ── */
  const post = async (actionName, params) => {
    setSaving(actionName);
    try {
      const res = await api.post(url(actionName), mk({action:actionName,...params}), FH);
      if (res.data.status==='success') { toast.success(res.data.message||'Done'); return res.data; }
      else { toast.error(res.data.message||'Failed'); return null; }
    } catch { toast.error('Error'); return null; }
    finally { setSaving(''); }
  };

  /* ── ADD DATE — real-time row insert ── */
  const addDate = async () => {
    const data = await post('add_exam_date', {is_special:0});
    if (data?.row) {
      setDates(p => [...p, data.row]); // instantly add new row
    }
  };

  const addSpecial = async () => {
    const data = await post('add_special_exam_date', {});
    if (data?.row) {
      setSpecial(p => [...p, data.row]); // instantly add new row
    }
  };

  /* ── DISABLE DATE — real-time row removal ── */
  const disableDate = async (id) => {
    if (!window.confirm('Disable this date?')) return;
    // Optimistic: remove immediately
    setDates(p => p.filter(d => d.id != id));
    const data = await post('disable_exam_date', {id});
    if (!data) {
      // Revert on failure
      fetchAll();
    }
  };

  /* ── DISABLE SPECIAL — real-time removal ── */
  const disableSp = async (id) => {
    if (!window.confirm('Disable this special batch?')) return;
    setSpecial(p => p.filter(d => d.id != id)); // remove instantly
    const data = await post('disable_special_exam_date', {id});
    if (!data) fetchAll();
  };

  /* ── DELETE PREVIOUS — real-time removal ── */
  const deleteDate = async (id) => {
    if (!window.confirm('Delete this date?')) return;
    setDates(p => p.filter(d => d.id != id)); // remove instantly
    const data = await post('delete_exam_date', {id});
    if (!data) fetchAll();
  };

  /* ── SAVE EDIT — real-time update ── */
  const saveEdit = async (id, form) => {
    const data = await post('update_exam_date', {id,...form});
    if (data) {
      setDates(p => p.map(d => d.id==id ? {...d,...form} : d));
      setEditId(null);
    }
  };

  const saveEditSp = async (id, form) => {
    const data = await post('update_special_exam_date', {id,...form});
    if (data) {
      setSpecial(p => p.map(d => d.id==id ? {...d,...form} : d));
      setEditSpId(null);
    }
  };

  /* ── Refund range ── */
  const saveRefund = async () => {
    if (!refund.from||!refund.to) { toast.error('Select both dates'); return; }
    await post('update_refund_program_range', {from_date:refund.from,to_date:refund.to});
  };

  /* ── CIT old ── */
  const saveCITOld = async () => {
    const updates = Object.entries(citState).map(([id,v])=>({id,special:v.special?1:0,normal:v.normal?1:0}));
    const data = await post('update_cit_special_normal', {updates:JSON.stringify(updates)});
    if (data) setOrigCit(JSON.parse(JSON.stringify(citState)));
  };

  /* ── New CIT pivot ── */
  const saveNewCIT = async () => {
    const updates = [];
    currentDates.forEach(d=>citNew.forEach(c=>updates.push({exam_date_id:d.id,cit_version_id:c.id,selected:isPivotSel(d.id,c.id)?1:0})));
    const data = await post('save_new_cit_relationships', {updates:JSON.stringify(updates)});
    if (data) fetchPivot();
  };

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:10,color:'#94a3b8',fontFamily:'Plus Jakarta Sans,sans-serif'}}>
      <div style={{width:28,height:28,border:'3px solid #ede9fe',borderTop:'3px solid #4f46e5',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      Loading...
    </div>
  );

  const PivotBtn = ({label, onClick, grad, disabled}) => (
    <button onClick={onClick} disabled={disabled||saving===label}
      style={{padding:'8px 18px',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:disabled?'not-allowed':'pointer',
        color:'#fff',background:grad,opacity:disabled||saving===label?.7:1}}>
      {saving===label?'Saving...':label}
    </button>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .bd2-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .bd2-tr:hover td{background:#f9f8ff!important;}
        .bd2-sp-tr:hover td{background:#fff9f9!important;}
        .bd2-prev-tr:hover td{background:#f8fafc!important;}
        @keyframes bd2_row_in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        .bd2-new-row td{animation:bd2_row_in .3s ease-out both;}
      `}</style>

      <div className="bd2-root" style={{
        display:'flex', flexDirection:'column',
        height:'calc(100vh - 62px)',
        padding:20, gap:14, overflowY:'auto', background:'#f5f3ff',
      }}>

        {/* ── HEADER ── */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
          position:'sticky',top:0,zIndex:10,background:'#f5f3ff',paddingBottom:4,marginBottom:-4}}>
          <div style={{fontSize:17,fontWeight:800,color:'#1e293b'}}>📅 Batch Dates</div>
          <div style={{display:'flex',gap:10}}>
            <Link to="/internships"><p
              style={{padding:'8px 16px',background:'#fef9c3',color:'#b45309',border:'1.5px solid #fde68a',
                borderRadius:8,fontSize:12,fontWeight:700,textDecoration:'none'}}>View Internship List</p></Link>
            <button onClick={addSpecial} disabled={saving==='add_special_exam_date'}
              style={{padding:'8px 18px',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',
                color:'#fff',background:'linear-gradient(135deg,#dc2626,#b91c1c)'}}>
              + Add Refund Batch
            </button>
            <button onClick={addDate} disabled={saving==='add_exam_date'}
              style={{padding:'8px 20px',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',
                color:'#fff',background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
                boxShadow:'0 4px 14px rgba(79,70,229,.3)'}}>
              {saving==='add_exam_date'?'Adding...':'+ Add Batch Date'}
            </button>
          </div>
        </div>

        {/* ── SECTIONS ── */}
        <div style={{display:'flex',flexDirection:'column',gap:16,paddingBottom:20}}>

          {/* ── REFUND RANGE ── */}
          <div style={{background:'#fff',borderRadius:12,border:'1.5px solid #fde68a',padding:'14px 20px',
            display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
            <span style={{fontSize:13,fontWeight:700,color:'#b45309'}}>Show Refund Program In Between</span>
            <input type="date" value={refund.from} onChange={e=>setRefund(p=>({...p,from:e.target.value}))}
              style={{...inpS,width:'auto',flex:1,minWidth:140}}/>
            <span style={{color:'#94a3b8',fontWeight:600,fontSize:12}}>to</span>
            <input type="date" value={refund.to} onChange={e=>setRefund(p=>({...p,to:e.target.value}))}
              style={{...inpS,width:'auto',flex:1,minWidth:140}}/>
            <button onClick={saveRefund} disabled={saving==='update_refund_program_range'}
              style={{padding:'8px 18px',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',
                color:'#fff',background:'linear-gradient(135deg,#16a34a,#15803d)',whiteSpace:'nowrap'}}>
              Update
            </button>
          </div>

          {/* ── REFUND BATCH DATES ── */}
          <Section icon="🔴" title="Refund Program Batch Dates"
            headerBg="linear-gradient(135deg,#dc2626,#b91c1c)" borderColor="#fecaca">
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:'#fef2f2'}}>
                {['Date','Status','Total Seats','Remaining Seats','Action'].map(h=>(
                  <th key={h} style={{...thS,color:'#dc2626',borderRight:'1px solid #fecaca'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {activeSpecial.length===0 && (
                  <tr><td colSpan={5} style={{textAlign:'center',padding:24,color:'#94a3b8',fontSize:12.5}}>No refund batch dates</td></tr>
                )}
                {activeSpecial.map(d => editSpId===d.id ? (
                  <EditSpRow key={d.id} row={d} onSave={form=>saveEditSp(d.id,form)} onCancel={()=>setEditSpId(null)}/>
                ) : (
                  <tr key={d.id} className="bd2-sp-tr">
                    <td style={{...tdS,color:'#dc2626',fontWeight:700}}>{d.date}</td>
                    <td style={tdS}><StatusBadge s={d.status}/></td>
                    <td style={tdS}>{d.total_seats}</td>
                    <td style={tdS}>{d.remaining_seats}</td>
                    <td style={{...tdS,whiteSpace:'nowrap'}}>
                      <button onClick={()=>setEditSpId(d.id)}
                        style={{...sBtn('#b45309'),marginRight:6}}>✏️ Edit</button>
                      <button onClick={()=>disableSp(d.id)}
                        style={sBtn('#dc2626')}>Disable</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* ── CURRENT DATES ── */}
          <Section icon="📆" title="Current Batch Dates"
            headerBg="linear-gradient(135deg,#4f46e5,#7c3aed)" borderColor="#c4b5fd">
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)'}}>
                {['Date','Status','Total Seats','Remaining Seats','Special','Action'].map(h=>(
                  <th key={h} style={thS}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {currentDates.length===0 && (
                  <tr><td colSpan={6} style={{textAlign:'center',padding:24,color:'#94a3b8',fontSize:12.5}}>No current dates</td></tr>
                )}
                {currentDates.map(d => editId===d.id ? (
                  <EditRow key={d.id} row={d} onSave={form=>saveEdit(d.id,form)} onCancel={()=>setEditId(null)}/>
                ) : (
                  <tr key={d.id} className="bd2-tr">
                    <td style={{...tdS,fontWeight:700,color:d.is_special==1?'#dc2626':'#1e293b'}}>{d.date}</td>
                    <td style={tdS}><StatusBadge s={d.status}/></td>
                    <td style={{...tdS,fontWeight:600}}>{d.total_seats}</td>
                    <td style={tdS}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{flex:1,height:6,background:'#e2e8f0',borderRadius:99,overflow:'hidden'}}>
                          <div style={{height:'100%',borderRadius:99,width:`${Math.round((d.remaining_seats/d.total_seats)*100)}%`,
                            background:d.remaining_seats/d.total_seats>0.5?'#16a34a':d.remaining_seats>0?'#f59e0b':'#dc2626'}}/>
                        </div>
                        <span style={{fontSize:11.5,fontWeight:700,color:'#334155',minWidth:20}}>{d.remaining_seats}</span>
                      </div>
                    </td>
                    <td style={{...tdS,textAlign:'center'}}>
                      {d.is_special==1
                        ? <span style={{padding:'2px 8px',background:'#fee2e2',color:'#dc2626',borderRadius:99,fontSize:10,fontWeight:700}}>Special</span>
                        : <span style={{color:'#94a3b8',fontSize:11.5}}>No</span>}
                    </td>
                    <td style={{...tdS,whiteSpace:'nowrap'}}>
                      <button onClick={()=>setEditId(d.id)}
                        style={{...sBtn('#b45309'),marginRight:6}}>✏️ Edit</button>
                      <button onClick={()=>disableDate(d.id)}
                        style={sBtn('#dc2626')}>Disable</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* ── NEW CIT PIVOT ── */}
          <Section icon="🆕" title="New CIT Dates Overview"
            headerBg="linear-gradient(135deg,#0891b2,#0e7490)" borderColor="#a5f3fc">
            <div style={{overflowX:'auto',maxHeight:340}}>
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:citNew.length*130+180}}>
                <thead style={{position:'sticky',top:0,zIndex:2}}>
                  <tr style={{background:'linear-gradient(135deg,#0891b2,#0e7490)'}}>
                    <th style={{...thS,minWidth:160}}>Batch Date</th>
                    {citNew.map(c=><th key={c.id} style={{...thS,textAlign:'center',minWidth:120}}>{c.cit_name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {currentDates.map(d=>(
                    <tr key={d.id} className="bd2-tr">
                      <td style={{...tdS,fontWeight:600,color:d.is_special==1?'#dc2626':'#1e293b'}}>{d.date}</td>
                      {citNew.map(c=>(
                        <td key={c.id} style={{...tdS,textAlign:'center'}}>
                          <input type="checkbox" checked={isPivotSel(d.id,c.id)}
                            onChange={e=>togglePivot(d.id,c.id,e.target.checked)}
                            style={{accentColor:'#0891b2',width:15,height:15,cursor:'pointer'}}/>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,padding:'10px 16px',borderTop:'1px solid #cffafe',background:'#f0fdfe'}}>
              <PivotBtn label="Cancel" onClick={()=>setPivot(JSON.parse(JSON.stringify(origPivot)))} grad="linear-gradient(135deg,#64748b,#475569)"/>
              <PivotBtn label="💾 Save" onClick={saveNewCIT} grad="linear-gradient(135deg,#0891b2,#0e7490)"/>
            </div>
          </Section>

          {/* ── CIT OLD OVERVIEW ── */}
          <Section icon="📋" title="CIT Dates Overview"
            headerBg="linear-gradient(135deg,#7c3aed,#6d28d9)" borderColor="#ddd6fe">
            <div style={{overflowX:'auto',maxHeight:380}}>
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:citOld.length*160+160}}>
                <thead style={{position:'sticky',top:0,zIndex:2}}>
                  <tr style={{background:'linear-gradient(135deg,#7c3aed,#6d28d9)'}}>
                    <th style={{...thS,minWidth:160}}>Date</th>
                    {citOld.map(c=>(
                      <th key={c.id} style={{...thS,textAlign:'center',minWidth:160}}>
                        <div style={{display:'flex',justifyContent:'center',gap:10,marginBottom:4}}>
                          {['special','normal'].map(t=>(
                            <label key={t} style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer',fontSize:10,fontWeight:600}}>
                              <input type="checkbox"
                                checked={citState[c.id]?.[t]||false}
                                onChange={e=>setCitState(p=>({...p,[c.id]:{...p[c.id],[t]:e.target.checked}}))}
                                style={{accentColor:'#e9d5ff',width:12,height:12}}/>
                              {t.charAt(0).toUpperCase()+t.slice(1)}
                            </label>
                          ))}
                        </div>
                        <div style={{fontSize:10.5}}>{c.exam_name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentDates.map(d=>(
                    <tr key={d.id} className="bd2-tr">
                      <td style={{...tdS,fontWeight:600,color:d.is_special==1?'#dc2626':'#1e293b'}}>{d.date}</td>
                      {citOld.map(c=>(
                        <td key={c.id} style={{...tdS,textAlign:'center',fontSize:16}}>
                          {citShows(d.is_special==1,c.id)
                            ? <span style={{color:'#16a34a',fontWeight:700}}>✓</span>
                            : <span style={{color:'#e2e8f0',fontWeight:700}}>✗</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,padding:'10px 16px',borderTop:'1px solid #ede9fe',background:'#faf9ff'}}>
              <PivotBtn label="Cancel" onClick={()=>{setCitState(JSON.parse(JSON.stringify(origCit)));toast('Reverted');}} grad="linear-gradient(135deg,#64748b,#475569)"/>
              <PivotBtn label="💾 Save" onClick={saveCITOld} grad="linear-gradient(135deg,#7c3aed,#6d28d9)"/>
            </div>
          </Section>

          {/* ── PREVIOUS DATES ── */}
          <Section icon="🗓" title="Previous Dates"
            headerBg="linear-gradient(135deg,#64748b,#475569)" borderColor="#e2e8f0">
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:'#f8fafc'}}>
                <th style={{...thS,color:'#475569',borderRight:'1px solid #e2e8f0'}}>Date</th>
                <th style={{...thS,color:'#475569'}}>Action</th>
              </tr></thead>
              <tbody>
                {previousDates.length===0 && (
                  <tr><td colSpan={2} style={{textAlign:'center',padding:20,color:'#94a3b8',fontSize:12}}>No previous dates</td></tr>
                )}
                {previousDates.map(d=>(
                  <tr key={d.id} className="bd2-prev-tr">
                    <td style={{...tdS,color:d.is_special==1?'#dc2626':'#64748b'}}>{d.date}</td>
                    <td style={tdS}>
                      <button onClick={()=>deleteDate(d.id)} style={sBtn('#dc2626')}>🗑 Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

        </div>
      </div>
    </>
  );
}