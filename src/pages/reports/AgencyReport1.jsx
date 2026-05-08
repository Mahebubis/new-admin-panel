import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

/* ─── API endpoints (all existing, no new PHP needed) ─── */
const BASE         = 'https://cit3.internshipstudio.com/admin/react-api';
const API_FILTERS  = `${BASE}/api/reports/get_filters.php`;
const API_ADSETS   = `${BASE}/api/reports/get_adset_items.php`;
const API_ADS      = `${BASE}/api/reports/get_ad_items.php`;
const API_BATCHES  = `${BASE}/api/reports/manage_batches.php`;
const API_SSE      = `${BASE}/api/reports/datewise_data_new.php`;
const API_UPLOAD   = `${BASE}/common/functions.php`;
const DL_BASE      = `${BASE}/download/download_data.php`;

/* ─── shared styles ─── */
const inpS = { padding:'8px 12px', border:'1.5px solid #e2e8f0', borderRadius:7,
  fontSize:12, fontFamily:'inherit', color:'#1e293b', outline:'none', background:'#fff' };
const selS = { ...{padding:'8px 12px', border:'1.5px solid #e2e8f0', borderRadius:7,
  fontSize:12, fontFamily:'inherit', color:'#1e293b', outline:'none', background:'#fff'}, cursor:'pointer' };
const btnP = (bg='linear-gradient(135deg,#4f46e5,#7c3aed)') => ({
  padding:'8px 16px', border:'none', borderRadius:8, fontSize:12, fontWeight:700,
  cursor:'pointer', color:'#fff', background:bg, whiteSpace:'nowrap' });
const thS = { color:'#fff', fontSize:10, fontWeight:700, padding:'9px 10px',
  textAlign:'left', textTransform:'uppercase', letterSpacing:'.3px',
  borderRight:'1px solid rgba(255,255,255,.15)', whiteSpace:'nowrap', position:'sticky', top:0, zIndex:2 };

/* ─── color helpers (chroma-style, no dependency) ─── */
function hexToRgb(hex) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return [r,g,b];
}
function rgbToHex(r,g,b){
  return '#'+[r,g,b].map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
}
function getColor(value, min, max) {
  if(min===max||isNaN(value)) return '#28a745';
  const pct = (value-min)/(max-min);
  // red → yellow → green scale (same as chroma scale in PHP)
  const low=[220,53,69], mid=[255,193,7], high=[40,167,69];
  let r,g,b;
  if(pct<0.5){ const t=pct/0.5; r=low[0]+(mid[0]-low[0])*t; g=low[1]+(mid[1]-low[1])*t; b=low[2]+(mid[2]-low[2])*t; }
  else { const t=(pct-0.5)/0.5; r=mid[0]+(high[0]-mid[0])*t; g=mid[1]+(high[1]-mid[1])*t; b=mid[2]+(high[2]-mid[2])*t; }
  return rgbToHex(r,g,b);
}
function luminance(hex) {
  const [r,g,b]=hexToRgb(hex).map(v=>{const s=v/255;return s<=0.03928?s/12.92:Math.pow((s+0.055)/1.055,2.4);});
  return 0.2126*r+0.7152*g+0.0722*b;
}
const textFor = (bg) => luminance(bg)>0.5?'#000000':'#ffffff';
const fmt = (v,d=2) => isNaN(parseFloat(v))||v===null?'-':parseFloat(v).toFixed(d);

/* ─── date helpers ─── */
const toISO  = (dd) => { const [d,m,y]=dd.split('/'); return `${y}-${m}-${d}`; };
const toDMY  = (iso) => { const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; };
const today  = () => { const d=new Date(); return toDMY(d.toISOString().split('T')[0]); };

function formatDateText(iso) {
  if(!iso||!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso||'';
  const dt=new Date(iso+'T12:00:00');
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
}

/* ─── columns metadata ─── */
const DATA_COLS = [
  'cost','registration_count','wa_count','exam_taken_count',
  'internship_purchase_once_count','internship_purchase_twice_count','revenue','roi',
];

/* ─── CIT version modal ─── */
function CITSelectModal({ citCount, onConfirm, onClose }) {
  const [sel, setSel] = useState(new Set(Array.from({length:citCount},(_,i)=>i+1)));
  const allSel = sel.size===citCount;
  const toggleAll = (c) => setSel(c?new Set(Array.from({length:citCount},(_,i)=>i+1)):new Set());
  const toggle = (v) => setSel(p=>{const n=new Set(p);n.has(v)?n.delete(v):n.add(v);return n;});
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:2000,
      display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:14,maxWidth:480,width:'100%',
        maxHeight:'80vh',display:'flex',flexDirection:'column',
        boxShadow:'0 20px 60px rgba(0,0,0,.25)',overflow:'hidden'}}>
        <div style={{padding:'14px 20px',background:'linear-gradient(135deg,#4f46e5,#7c3aed)'}}>
          <span style={{fontSize:14,fontWeight:700,color:'#fff'}}>📥 Select CIT Versions</span>
        </div>
        <div style={{padding:'16px 20px',overflowY:'auto',flex:1}}>
          <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,
            cursor:'pointer',padding:'7px 10px',background:'#f5f3ff',borderRadius:8}}>
            <input type="checkbox" checked={allSel} onChange={e=>toggleAll(e.target.checked)}
              style={{accentColor:'#4f46e5',width:14,height:14}}/>
            <span style={{fontSize:13,fontWeight:700,color:'#4f46e5'}}>Select All ({citCount})</span>
          </label>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:7}}>
            {Array.from({length:citCount},(_,i)=>i+1).map(v=>(
              <label key={v} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',
                padding:'6px 8px',borderRadius:7,fontSize:12,fontWeight:600,
                border:`1.5px solid ${sel.has(v)?'#c4b5fd':'#e2e8f0'}`,
                background:sel.has(v)?'#f5f3ff':'#fafafa',color:sel.has(v)?'#4f46e5':'#64748b'}}>
                <input type="checkbox" checked={sel.has(v)} onChange={()=>toggle(v)}
                  style={{accentColor:'#4f46e5',width:12,height:12}}/>
                CIT {v}
              </label>
            ))}
          </div>
        </div>
        <div style={{padding:'12px 20px',borderTop:'1.5px solid #f1f5f9',background:'#fafafa',
          display:'flex',justifyContent:'flex-end',gap:10}}>
          <button onClick={onClose} style={{...btnP('linear-gradient(135deg,#64748b,#475569)'),padding:'7px 16px'}}>Cancel</button>
          <button onClick={()=>{if(!sel.size){toast.error('Select at least one');return;} onConfirm([...sel]);}}
            style={btnP()}>⬇️ Download</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Manage CIT Batches modal ─── */
function BatchModal({ onClose }) {
  const [batches,  setBatches]  = useState([]);
  const [form,     setForm]     = useState({ batch_no:'', start_date:'', end_date:'' });
  const [saving,   setSaving]   = useState(false);

  const load = useCallback(() => {
    fetch(`${API_BATCHES}?action=get`)
      .then(r=>r.json()).then(r=>{ if(r.success) setBatches(r.data||[]); }).catch(()=>{});
  }, []);

  useEffect(()=>{ load(); },[load]);

  const addBatch = async () => {
    if(!form.batch_no||!form.start_date||!form.end_date){toast.error('Fill all fields');return;}
    setSaving(true);
    try {
      const fd=new FormData(); Object.entries({action:'add',...form}).forEach(([k,v])=>fd.append(k,v));
      const r=await fetch(API_BATCHES,{method:'POST',body:fd});
      const d=await r.json();
      if(d.success){toast.success('Batch added');load();setForm({batch_no:'',start_date:'',end_date:''});}
      else toast.error(d.message||'Failed');
    } catch{toast.error('Error');} finally{setSaving(false);}
  };

  const delBatch = async (id) => {
    if(!window.confirm('Delete this batch?')) return;
    const fd=new FormData(); fd.append('action','delete'); fd.append('batch_id',id);
    const r=await fetch(API_BATCHES,{method:'POST',body:fd});
    const d=await r.json();
    if(d.success){toast.success('Deleted');load();} else toast.error(d.message||'Failed');
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:2000,
      display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:14,maxWidth:640,width:'100%',
        maxHeight:'85vh',display:'flex',flexDirection:'column',
        boxShadow:'0 20px 60px rgba(0,0,0,.25)',overflow:'hidden'}}>
        <div style={{padding:'14px 20px',background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
          display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:14,fontWeight:700,color:'#fff'}}>⚙️ Manage CIT Versions</span>
          <button onClick={onClose} style={{background:'rgba(255,255,255,.2)',border:'none',
            borderRadius:6,width:28,height:28,cursor:'pointer',color:'#fff',fontSize:18}}>×</button>
        </div>
        <div style={{padding:20,overflowY:'auto',flex:1}}>
          {/* Add form */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr auto',gap:10,
            marginBottom:18,padding:'14px 16px',background:'#f5f3ff',borderRadius:10,
            border:'1.5px solid #ede9fe'}}>
            <input style={inpS} placeholder="Batch No." value={form.batch_no}
              onChange={e=>setForm(p=>({...p,batch_no:e.target.value}))}/>
            <input style={inpS} type="date" value={form.start_date}
              onChange={e=>setForm(p=>({...p,start_date:e.target.value}))}/>
            <input style={inpS} type="date" value={form.end_date}
              onChange={e=>setForm(p=>({...p,end_date:e.target.value}))}/>
            <button onClick={addBatch} disabled={saving} style={btnP('linear-gradient(135deg,#16a34a,#15803d)')}>
              {saving?'Adding...':'+ Add'}
            </button>
          </div>
          {/* Batches table */}
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)'}}>
              {['CIT Version','Start Date','End Date','Actions'].map(h=>(
                <th key={h} style={thS}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {batches.length===0 ? (
                <tr><td colSpan={4} style={{textAlign:'center',padding:24,color:'#94a3b8',fontSize:12}}>No batches</td></tr>
              ) : batches.map(b=>(
                <tr key={b.id} style={{borderBottom:'1px solid #f5f3ff'}}>
                  <td style={{padding:'9px 10px',fontSize:12,fontWeight:600,color:'#4f46e5'}}>CIT {b.batch_no}</td>
                  <td style={{padding:'9px 10px',fontSize:12}}>{b.start_date}</td>
                  <td style={{padding:'9px 10px',fontSize:12}}>{b.end_date}</td>
                  <td style={{padding:'9px 10px'}}>
                    <button onClick={()=>delBatch(b.id)}
                      style={{...btnP('linear-gradient(135deg,#dc2626,#b91c1c)'),padding:'4px 10px',fontSize:11}}>
                      🗑 Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════
   MAIN COMPONENT
═════════════════════════════════ */
export default function AgencyReport1() {
  /* ── state ── */
  const [citCount,   setCitCount]   = useState(0);
  const [batches,    setBatches]    = useState([]); // for batch dropdown
  const [campaigns,  setCampaigns]  = useState([]);
  const [adsets,     setAdsets]     = useState([]);
  const [ads,        setAds]        = useState([]);

  const [selBatch,   setSelBatch]   = useState('');
  const [startDate,  setStartDate]  = useState(today());
  const [endDate,    setEndDate]    = useState(today());
  const [campaign,   setCampaign]   = useState('');
  const [adset,      setAdset]      = useState('');
  const [ad,         setAd]         = useState('');

  const [dataRows,   setDataRows]   = useState([]);
  const [summaryRows,setSummaryRows]= useState([]);
  const [minMax,     setMinMax]     = useState({});
  const [rowCount,   setRowCount]   = useState(0);
  const [streaming,  setStreaming]  = useState(false);
  const [loading,    setLoading]    = useState(false);

  const [csvFile,    setCsvFile]    = useState(null);
  const [uploading,  setUploading]  = useState(false);

  const [modal,      setModal]      = useState(null); // 'cit' | 'batches'

  const sseRef = useRef(null);
  const bufRef = useRef([]);

  /* ── load cit count + batches on mount ── */
  useEffect(()=>{
    fetch('/api/reporting/reports.php')
      .then(r=>r.json()).then(d=>{ if(d.status==='success') setCitCount(d.cit_count||0); }).catch(()=>{});
    fetch(`${API_BATCHES}?action=get`)
      .then(r=>r.json()).then(d=>{ if(d.success) setBatches(d.data||[]); }).catch(()=>{});
  },[]);

  /* ── load campaigns when dates change ── */
  const loadCampaigns = useCallback((sd, ed) => {
    if(!sd||!ed) return;
    const iso_s=toISO(sd), iso_e=toISO(ed);
    fetch(`${API_FILTERS}?start_date=${iso_s}&end_date=${iso_e}`)
      .then(r=>r.json())
      .then(d=>{ setCampaigns(d.campaigns||[]); setAdsets([]); setAds([]); setCampaign(''); setAdset(''); setAd(''); })
      .catch(()=>{});
  },[]);

  useEffect(()=>{ loadCampaigns(startDate, endDate); },[startDate, endDate]);

  /* ── load adsets when campaign changes ── */
  const loadAdsets = useCallback((camp, sd, ed) => {
    if(!camp||!sd||!ed){setAdsets([]);setAds([]);return;}
    const iso_s=toISO(sd), iso_e=toISO(ed);
    fetch(`${API_ADSETS}?campaign=${encodeURIComponent(camp)}&start_date=${iso_s}&end_date=${iso_e}`)
      .then(r=>r.json()).then(d=>{ setAdsets(d.adsets||[]); setAds([]); setAdset(''); setAd(''); }).catch(()=>{});
  },[]);

  useEffect(()=>{ loadAdsets(campaign, startDate, endDate); },[campaign]);

  /* ── load ads when adset changes ── */
  const loadAds = useCallback((camp, ads_, sd, ed) => {
    if(!camp||!ads_||!sd||!ed){setAds([]);return;}
    const iso_s=toISO(sd), iso_e=toISO(ed);
    fetch(`${API_ADS}?campaign=${encodeURIComponent(camp)}&adset=${encodeURIComponent(ads_)}&start_date=${iso_s}&end_date=${iso_e}`)
      .then(r=>r.json()).then(d=>{ setAds(d.ads||[]); setAd(''); }).catch(()=>{});
  },[]);

  useEffect(()=>{ loadAds(campaign, adset, startDate, endDate); },[adset]);

  /* ── batch select → fill dates ── */
  const handleBatchSelect = (id) => {
    setSelBatch(id);
    if(!id) return;
    const b = batches.find(x=>x.id==id);
    if(b){ setStartDate(toDMY(b.start_date)); setEndDate(toDMY(b.end_date)); }
  };

  /* ── min/max calculation ── */
  function calcMinMax(rows) {
    const mm = {};
    DATA_COLS.forEach(c=>{ mm[c]={min:Infinity,max:-Infinity}; });
    rows.forEach(r=>{ DATA_COLS.forEach(c=>{ const v=parseFloat(r[c]); if(!isNaN(v)){ if(v<mm[c].min)mm[c].min=v; if(v>mm[c].max)mm[c].max=v; } }); });
    return mm;
  }

  /* ── SSE fetch data ── */
  const fetchData = useCallback(() => {
    if(sseRef.current){ sseRef.current.close(); sseRef.current=null; }
    bufRef.current=[];
    setDataRows([]); setSummaryRows([]); setMinMax({}); setRowCount(0);
    setStreaming(true); setLoading(true);

    const iso_s=toISO(startDate), iso_e=toISO(endDate);
    const qs=`start_date=${iso_s}&end_date=${iso_e}&campaign=${encodeURIComponent(campaign)}&adset=${encodeURIComponent(adset)}&ad=${encodeURIComponent(ad)}`;
    const es = new EventSource(`${API_SSE}?${qs}`);
    sseRef.current = es;

    es.onmessage = (evt) => {
      const d = JSON.parse(evt.data);
      if(d.complete) {
        es.close(); sseRef.current=null;
        // Process buffer
        const rows   = bufRef.current.filter(x=>x.type==='data').map(x=>x.data);
        const avgs   = bufRef.current.find(x=>x.type==='average')?.data||null;
        const tots   = bufRef.current.find(x=>x.type==='total')?.data||null;
        const mm     = calcMinMax(rows);
        const summary=[];
        if(avgs){ summary.push({...avgs, date:'Average', _bold:true}); }
        if(tots){ summary.push({...tots, date:'Total',   _bold:true}); }
        setDataRows(rows); setSummaryRows(summary); setMinMax(mm); setRowCount(rows.length);
        setStreaming(false); setLoading(false);
      } else if(d.averages) {
        bufRef.current.push({type:'average', data:{...d.averages, campaign:'', adset:'', ad:''}});
      } else if(d.totals) {
        bufRef.current.push({type:'total', data:{...d.totals, campaign:'', adset:'', ad:''}});
      } else {
        const date = Object.keys(d)[0];
        bufRef.current.push({type:'data', data:{...d[date], date,
          campaign:decodeURIComponent(campaign),
          adset:decodeURIComponent(adset),
          ad:decodeURIComponent(ad)}});
      }
    };
    es.onerror = () => {
      es.close(); sseRef.current=null;
      toast.error('Failed to fetch data'); setStreaming(false); setLoading(false);
    };
  }, [startDate, endDate, campaign, adset, ad]);

  useEffect(()=>{ fetchData(); return ()=>{ if(sseRef.current) sseRef.current.close(); }; },[]);

  /* ── CSV upload ── */
  const uploadCsv = async () => {
    if(!csvFile){ toast.error('Select a CSV file first'); return; }
    setUploading(true);
    try {
      const fd=new FormData(); fd.append('action','handle_fb_ads_cost_new'); fd.append('csv_file',csvFile);
      const r=await fetch(API_UPLOAD,{method:'POST',body:fd});
      const d=await r.json();
      if(d.success){ toast.success(d.message); fetchData(); }
      else toast.error(d.message||'Upload failed');
    } catch{ toast.error('Upload error'); } finally{ setUploading(false); }
  };

  /* ── Excel export with colors ── */
  const downloadExcel = async () => {
    if(!dataRows.length){ toast.error('No data to export'); return; }
    const loadExcelJS = () => new Promise(resolve=>{
      if(window.ExcelJS){resolve(window.ExcelJS);return;}
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js';
      s.onload=()=>resolve(window.ExcelJS); document.head.appendChild(s);
    });
    const loadFS = () => new Promise(resolve=>{
      if(window.saveAs){resolve();return;}
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js';
      s.onload=resolve; document.head.appendChild(s);
    });
    await Promise.all([loadExcelJS(), loadFS()]);
    const EX = window.ExcelJS;
    const wb = new EX.Workbook();
    const ws = wb.addWorksheet('Datewise Data');
    const headers = ['Date','Campaign','Adset','Ad','Meta Spent',
      'Registration Count','Registration Cost (₹)',
      'WhatsApp Count','WA % of Reg','WA Cost (₹)',
      'Exam Taken Count','Exam % of Reg','Exam Cost (₹)',
      'Purchase Once Count','Once % of Reg','Once Cost (₹)',
      'Purchase Twice Count','Twice % of Reg','Twice Cost (₹)',
      'Revenue','ROI'];
    const hRow = ws.addRow(headers);
    hRow.eachCell(c=>{ c.font={bold:true}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF4F46E5'}}; c.font={bold:true,color:{argb:'FFFFFFFF'}}; });

    const fields = ['date','campaign','adset','ad','cost',
      'registration_count','registration_cost','wa_count','whatsapp_joined_percentage','whatsapp_joined_cost',
      'exam_taken_count','exam_taken_percentage','exam_taken_cost',
      'internship_purchase_once_count','internship_purchase_once_percentage','internship_purchase_once_cost',
      'internship_purchase_twice_count','internship_purchase_twice_percentage','internship_purchase_twice_cost',
      'revenue','roi'];

    [...dataRows, ...summaryRows].forEach(row=>{
      const vals = fields.map(f=>{
        if(f==='date') return row._bold?row.date:formatDateText(row.date)||row.date;
        const v=parseFloat(row[f]); return isNaN(v)?row[f]||'-':parseFloat(v.toFixed(2));
      });
      const xRow = ws.addRow(vals);
      if(!row._bold) {
        fields.forEach((f,i)=>{
          if(minMax[f]&&minMax[f].min!==Infinity){
            const bg=getColor(parseFloat(row[f]),minMax[f].min,minMax[f].max).slice(1).toUpperCase();
            const tc=luminance('#'+bg)>0.5?'00000000':'00FFFFFF';
            xRow.getCell(i+1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+bg}};
            xRow.getCell(i+1).font={color:{argb:'FF'+tc.slice(2)}};
          }
        });
      } else {
        xRow.eachCell(c=>{ c.font={bold:true}; });
      }
    });
    ws.columns.forEach(c=>{ c.width=16; });
    const buf = await wb.xlsx.writeBuffer();
    window.saveAs(new Blob([buf]),'Datewise_Data_Report.xlsx');
    toast.success('Excel exported!');
  };

  /* ── colored cell renderer ── */
  const ColorCell = ({ value, field, bold }) => {
    const v = parseFloat(value);
    if(bold||!minMax[field]||isNaN(v)) return <td style={{padding:'7px 9px',fontSize:11,fontWeight:bold?700:400,borderBottom:'1px solid #f5f3ff',whiteSpace:'nowrap'}}>{value}</td>;
    const bg = getColor(v, minMax[field].min, minMax[field].max);
    return <td style={{padding:'7px 9px',fontSize:11,background:bg,color:textFor(bg),fontWeight:400,borderBottom:'1px solid #f5f3ff',whiteSpace:'nowrap'}}>{value}</td>;
  };

  /* ── table row renderer ── */
  const TableRow = ({ row, bold=false }) => (
    <tr>
      <td style={{padding:'7px 9px',fontSize:11,fontWeight:bold?700:400,whiteSpace:'nowrap',borderBottom:'1px solid #f5f3ff',color:'#1e293b'}}>
        {bold?row.date:formatDateText(row.date)||row.date}
      </td>
      <td style={{padding:'7px 9px',fontSize:11,borderBottom:'1px solid #f5f3ff',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.campaign||''}</td>
      <td style={{padding:'7px 9px',fontSize:11,borderBottom:'1px solid #f5f3ff',maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.adset||''}</td>
      <td style={{padding:'7px 9px',fontSize:11,borderBottom:'1px solid #f5f3ff',maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.ad||''}</td>
      <ColorCell value={fmt(row.cost)} field="cost" bold={bold}/>
      <ColorCell value={`${fmt(row.registration_count)} (₹${fmt(row.registration_cost)})`} field="registration_count" bold={bold}/>
      <ColorCell value={`${fmt(row.wa_count)} (${fmt(row.whatsapp_joined_percentage)}%) (₹${fmt(row.whatsapp_joined_cost)})`} field="wa_count" bold={bold}/>
      <ColorCell value={`${fmt(row.exam_taken_count)} (${fmt(row.exam_taken_percentage)}%) (₹${fmt(row.exam_taken_cost)})`} field="exam_taken_count" bold={bold}/>
      <ColorCell value={`${fmt(row.internship_purchase_once_count)} (${fmt(row.internship_purchase_once_percentage)}%) (₹${fmt(row.internship_purchase_once_cost)})`} field="internship_purchase_once_count" bold={bold}/>
      <ColorCell value={`${fmt(row.internship_purchase_twice_count)} (${fmt(row.internship_purchase_twice_percentage)}%) (₹${fmt(row.internship_purchase_twice_cost)})`} field="internship_purchase_twice_count" bold={bold}/>
      <ColorCell value={`₹${fmt(row.revenue)}`} field="revenue" bold={bold}/>
      <ColorCell value={fmt(row.roi)} field="roi" bold={bold}/>
    </tr>
  );

  /* ════════ RENDER ════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .dw-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .dw-tr:hover td{background-color:rgba(0,0,0,.04)!important;}
        @keyframes dw_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="dw-root" style={{
        display:'flex', flexDirection:'column',
        height:'calc(100vh - 62px)',
        padding:20, gap:12, overflow:'hidden', background:'#f5f3ff',
      }}>

        {/* ── HEADER ── */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{fontSize:17,fontWeight:800,color:'#1e293b'}}>📊 Datewise Data</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <a href="/assets/files/amount_spent_new.csv" download
              style={{...btnP('linear-gradient(135deg,#0891b2,#0e7490)'),textDecoration:'none',fontSize:11.5}}>📥 Sample CSV</a>
            <button onClick={()=>setModal('batches')} style={btnP()}>⚙️ Manage CIT Version</button>
            <button onClick={()=>setModal('cit')} style={btnP('linear-gradient(135deg,#64748b,#475569)')}>⬇️ User Data</button>
          </div>
        </div>

        {/* ── FILTER BAR ── */}
        <div style={{background:'#fff',borderRadius:12,border:'1.5px solid #ede9fe',
          padding:'14px 16px',flexShrink:0,display:'flex',flexDirection:'column',gap:10}}>
          {/* Row 1: batch, dates, fetch */}
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
            <select style={{...selS,minWidth:160}} value={selBatch} onChange={e=>handleBatchSelect(e.target.value)}>
              <option value="">Select CIT Version...</option>
              {batches.map(b=><option key={b.id} value={b.id}>CIT {b.batch_no}</option>)}
            </select>
            <input type="text" style={{...inpS,width:130}} placeholder="DD/MM/YYYY" value={startDate}
              onChange={e=>setStartDate(e.target.value)}/>
            <input type="text" style={{...inpS,width:130}} placeholder="DD/MM/YYYY" value={endDate}
              onChange={e=>setEndDate(e.target.value)}/>
            <button onClick={fetchData} disabled={streaming} style={{...btnP(),opacity:streaming?.7:1}}>
              {streaming?'Fetching...':'🔍 Fetch Data'}
            </button>
            <div style={{display:'flex',gap:8,marginLeft:'auto',alignItems:'center'}}>
              <input type="file" accept=".csv" onChange={e=>setCsvFile(e.target.files[0])}
                style={{...inpS,padding:'6px 10px',fontSize:11.5,width:180}}/>
              <button onClick={uploadCsv} disabled={uploading} style={btnP('linear-gradient(135deg,#16a34a,#15803d)')}>
                {uploading?'Uploading...':'⬆️ Upload CSV'}
              </button>
            </div>
          </div>
          {/* Row 2: cascading filters */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
            {[
              [campaigns,'Campaign',campaign,v=>{setCampaign(v);setAdset('');setAd('');}],
              [adsets,'Adset',adset,v=>{setAdset(v);setAd('');}],
              [ads,'Ad',ad,setAd],
            ].map(([opts,lbl,val,fn])=>(
              <select key={lbl} style={selS} value={val} onChange={e=>fn(e.target.value)}>
                <option value="">Select {lbl}</option>
                {opts.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            ))}
          </div>
        </div>

        {/* ── COUNT + ACTIONS ── */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <span style={{fontSize:12.5,color:'#64748b',fontWeight:600}}>
            Count: <strong style={{color:'#4f46e5'}}>{rowCount}</strong>
            {streaming && <span style={{marginLeft:10,fontSize:11,color:'#f59e0b',fontWeight:700}}>⏳ Streaming...</span>}
          </span>
          <button onClick={downloadExcel} disabled={!dataRows.length}
            style={{...btnP('linear-gradient(135deg,#16a34a,#15803d)'),opacity:dataRows.length?1:.5}}>
            📊 Download Excel
          </button>
        </div>

        {/* ── TABLE ── */}
        <div style={{flex:1,minHeight:0,background:'#fff',borderRadius:12,
          border:'1.5px solid #ede9fe',boxShadow:'0 1px 8px rgba(79,70,229,.05)',
          display:'flex',flexDirection:'column',overflow:'hidden'}}>

          {/* Color legend */}
          <div style={{padding:'6px 14px',background:'#fafafa',borderBottom:'1px solid #f1f5f9',
            display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
            <span style={{fontSize:10.5,color:'#64748b',fontWeight:600}}>Legend:</span>
            <div style={{width:160,height:14,borderRadius:4,
              background:'linear-gradient(to right,#dc3545,#ffc107,#28a745)'}}/>
            <span style={{fontSize:10.5,color:'#64748b'}}>Low → Medium → High</span>
          </div>

          <div style={{flex:1,overflowY:'auto',overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:1200}}>
              <thead>
                <tr style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)'}}>
                  {['Date','Campaign','Adset','Ad','Meta Spent',
                    'Registration (₹)','WhatsApp (% Reg)(₹)',
                    'Exam Taken (% Reg)(₹)','Purchase Once (% Reg)(₹)',
                    'Purchase Twice (% Reg)(₹)','Revenue','ROI'].map(h=>(
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && !dataRows.length ? (
                  <tr><td colSpan={12} style={{textAlign:'center',padding:48}}>
                    <div style={{display:'inline-block',width:28,height:28,border:'3px solid #ede9fe',
                      borderTop:'3px solid #4f46e5',borderRadius:'50%',animation:'dw_spin .7s linear infinite'}}/>
                    <div style={{marginTop:10,fontSize:12,color:'#64748b'}}>Fetching data via stream...</div>
                  </td></tr>
                ) : dataRows.length===0 && !loading ? (
                  <tr><td colSpan={12} style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:13}}>
                    Select filters and click Fetch Data
                  </td></tr>
                ) : (
                  <>
                    {dataRows.map((row,i)=><TableRow key={i} row={row}/>)}
                    {summaryRows.map((row,i)=><TableRow key={`s${i}`} row={row} bold/>)}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── CIT VERSION SELECTOR MODAL ── */}
      {modal==='cit' && citCount>0 && (
        <CITSelectModal citCount={citCount}
          onConfirm={(ids)=>{
            window.open(`${DL_BASE}?type=simplified_complete_data_agency&versions=${ids.join(',')}`, '_blank');
            setModal(null);
          }}
          onClose={()=>setModal(null)}/>
      )}

      {/* ── MANAGE BATCHES MODAL ── */}
      {modal==='batches' && <BatchModal onClose={()=>{ setModal(null);
        fetch(`${API_BATCHES}?action=get`).then(r=>r.json()).then(d=>{ if(d.success) setBatches(d.data||[]); }).catch(()=>{});
      }}/>}
    </>
  );
}