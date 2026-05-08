import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

const API_DATA    = 'https://cit3.internshipstudio.com/admin/react-api/api/reports/datewise_data.php';
const API_BATCHES = 'https://cit3.internshipstudio.com/admin/react-api/api/reports/manage_batches.php';
const DL_BASE     = '/download/download_data.php';

/* ─── helpers ─── */
const toISO = (s) => s; // already YYYY-MM-DD from <input type=date>
const today = () => new Date().toISOString().split('T')[0];
const lastWeek = () => { const d = new Date(); d.setDate(d.getDate()-7); return d.toISOString().split('T')[0]; };

function formatDate(iso) {
  if (!iso) return '';
  const dt = new Date(iso + 'T12:00:00');
  return `${dt.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()]} ${dt.getFullYear()}`;
}

function dateRange(start, end) {
  const dates = [], cur = new Date(start + 'T12:00:00'), fin = new Date(end + 'T12:00:00');
  while (cur <= fin) { dates.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate()+1); }
  return dates;
}

/* ROI → HSL color (red=0 → green=max) same as PHP JS */
function roiColor(roi, maxRoi) {
  if (!roi || !maxRoi) return '#e5e7eb';
  const ratio = Math.min(Math.max(roi / maxRoi, 0), 1);
  return `hsl(${Math.round(120 * ratio)}, 100%, 90%)`;
}
function lumCheck(hsl) {
  const hue = parseInt(hsl.match(/\d+/)?.[0]||'0');
  return hue > 60 ? '#1e293b' : '#7f1d1d';
}

const fmt = (n) => isNaN(+n) ? '0' : (+n).toFixed(2);
const fmtINR = (n) => `₹${(+n||0).toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:0})}`;

/* ─── shared styles ─── */
const inpS = { padding:'7px 11px', border:'1.5px solid #e2e8f0', borderRadius:7,
  fontSize:12, fontFamily:'inherit', color:'#1e293b', outline:'none', background:'#fff' };
const selS = { ...inpS, cursor:'pointer' };
const btnS = (bg='linear-gradient(135deg,#4f46e5,#7c3aed)') => ({
  padding:'8px 16px', border:'none', borderRadius:8, fontSize:12, fontWeight:700,
  cursor:'pointer', color:'#fff', background:bg, whiteSpace:'nowrap' });

/* ─── Date cell ─── */
function DateCell({ d, maxRoi }) {
  const bg = roiColor(d.roi, maxRoi);
  const tc = lumCheck(bg);
  return (
    <td style={{ padding:'8px 10px', background:bg, borderBottom:'1px solid rgba(255,255,255,.3)',
      borderRight:'1px solid #e2e8f0', minWidth:110, verticalAlign:'top' }}>
      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        {[
          ['Cost', fmtINR(d.cost)],
          ['Rev',  fmtINR(d.revenue)],
          ['Leads',d.leads],
          ['CPL',  fmt(d.cpl)],
          ['ROI',  fmt(d.roi)],
        ].map(([lbl,val])=>(
          <div key={lbl} style={{ display:'flex', justifyContent:'space-between', gap:6 }}>
            <span style={{ fontSize:10, fontWeight:700, color:tc, opacity:.7 }}>{lbl}</span>
            <span style={{ fontSize:10.5, fontWeight:600, color:tc }}>{val}</span>
          </div>
        ))}
      </div>
    </td>
  );
}

/* ─── Summary cell (avg/total) ─── */
function SummaryCell({ totalCost, totalRevenue, totalLeads }) {
  const roi = totalCost > 0 ? totalRevenue / totalCost : 0;
  const cpl = totalLeads > 0 ? totalCost / totalLeads : 0;
  return (
    <td style={{ padding:'8px 10px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0',
      borderRight:'1px solid #e2e8f0', minWidth:120, verticalAlign:'top' }}>
      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        {[['Cost',fmtINR(totalCost)],['Rev',fmtINR(totalRevenue)],['Leads',totalLeads],
          ['CPL',fmt(cpl)],['ROI',fmt(roi)]].map(([l,v])=>(
          <div key={l} style={{ display:'flex', justifyContent:'space-between', gap:6 }}>
            <span style={{ fontSize:10, fontWeight:700, color:'#64748b' }}>{l}</span>
            <span style={{ fontSize:10.5, fontWeight:600, color:'#1e293b' }}>{v}</span>
          </div>
        ))}
      </div>
    </td>
  );
}

/* ─── Sticky cell ─── */
const stickyTd = (left, minW=180) => ({
  position:'sticky', left, background:'#fff', zIndex:3,
  padding:'10px 12px', borderBottom:'1px solid #f5f3ff',
  borderRight:'1px solid #e2e8f0', minWidth:minW, maxWidth:minW,
  verticalAlign:'top', boxShadow:'2px 0 4px rgba(0,0,0,.04)',
});

/* ═══════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════ */
export default function AgencyReport2() {
  const [batches,    setBatches]    = useState([]);
  const [citVersions,setCitVersions]= useState([]); // same as batches

  const [startDate,  setStartDate]  = useState('2024-12-02');
  const [endDate,    setEndDate]    = useState('2024-12-08');
  const [selBatch,   setSelBatch]   = useState('');

  const [rawData,    setRawData]    = useState([]);
  const [counts,     setCounts]     = useState({});
  const [loading,    setLoading]    = useState(false);

  const [campFilter, setCampFilter] = useState('');
  const [adsetFilter,setAdsetFilter]= useState('');
  const [adFilter,   setAdFilter]   = useState('');

  /* expanded state: { [campaignId]: 'adsets'|'ads'|null } */
  const [expanded,   setExpanded]   = useState({});
  /* expandData: { [campaignId]: [{date,campaign,adset,ad,cost,revenue,leads,...}] } */
  const [expandData, setExpandData] = useState({});

  const [maxRoi,     setMaxRoi]     = useState(1);

  /* ── load batches ── */
  useEffect(()=>{
    fetch(`${API_BATCHES}?action=get`)
      .then(r=>r.json()).then(d=>{ if(d.success){ setBatches(d.data||[]); setCitVersions(d.data||[]); } }).catch(()=>{});
  },[]);

  /* ── main fetch ── */
  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true); setExpanded({}); setExpandData({});
    try {
      const p = new URLSearchParams({ start_date:startDate, end_date:endDate });
      if (campFilter)  p.append('campaign', campFilter);
      if (adsetFilter) p.append('adset',    adsetFilter);
      if (adFilter)    p.append('ad',       adFilter);
      const r = await fetch(`${API_DATA}?${p}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setRawData(d.data||[]);
      setCounts(d.counts||{});
      // compute global max ROI
      let mx=0; (d.data||[]).forEach(row=>{ const r=row.cost>0?row.revenue/row.cost:0; if(r>mx)mx=r; });
      setMaxRoi(mx||1);
    } catch(e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [startDate, endDate, campFilter, adsetFilter, adFilter]);

  useEffect(()=>{ fetchData(); },[fetchData]);

  /* ── expand adsets or ads ── */
  const loadExpand = useCallback(async (campaignId, campaign, type) => {
    // collapse if same
    if (expanded[campaignId] === type) { setExpanded(p=>({...p,[campaignId]:null})); return; }
    try {
      const p = new URLSearchParams({ start_date:startDate, end_date:endDate, campaign, expand:'ads' });
      const r = await fetch(`${API_DATA}?${p}`);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setExpandData(p=>({...p, [campaignId]: d.data||[]}));
      setExpanded(p=>({...p, [campaignId]: type}));
    } catch(e) { toast.error(e.message||'Failed'); }
  }, [startDate, endDate]);

  /* ── batch select ── */
  const handleBatch = (id) => {
    setSelBatch(id);
    const b = batches.find(x=>x.id==id);
    if (b) { setStartDate(b.start_date); setEndDate(b.end_date); }
  };

  /* ── derived: all dates, campaigns ── */
  const allDates = startDate && endDate ? dateRange(startDate, endDate) : [];

  /* group rawData by campaign */
  const campaignMap = {};
  rawData.forEach(row => {
    const camp = row.campaign || '-';
    if (!campaignMap[camp]) campaignMap[camp] = {};
    const key = row.date;
    if (!campaignMap[camp][key]) campaignMap[camp][key] = {cost:0,revenue:0,leads:0};
    campaignMap[camp][key].cost    += row.cost;
    campaignMap[camp][key].revenue += row.revenue;
    campaignMap[camp][key].leads   += row.leads;
  });

  const campaigns = Object.keys(campaignMap);

  /* unique filter options */
  const allCampaigns = [...new Set(rawData.map(r=>r.campaign).filter(Boolean))];
  const allAdsets    = [...new Set(rawData.map(r=>r.adset).filter(Boolean))];
  const allAds       = [...new Set(rawData.map(r=>r.ad).filter(Boolean))];

  /* CIT version for date → label */
  const citForDate = (date) => {
    for (const v of citVersions) {
      if (date >= v.start_date && date <= v.end_date) return `CIT ${v.batch_no}`;
    }
    return '';
  };

  /* Group consecutive dates with same CIT version for header row */
  const citGroups = () => {
    const grps = [];
    let cur = null;
    allDates.forEach(d => {
      const v = citForDate(d);
      if (!cur || cur.label !== v) { cur = { label:v, count:1 }; grps.push(cur); }
      else cur.count++;
    });
    return grps;
  };

  /* ── Excel export ── */
  const exportXlsx = () => {
    const table = document.getElementById('da-export-table');
    if (!table) { toast.error('No data'); return; }
    const loadXLSX = () => new Promise(resolve => {
      if (window.XLSX) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js';
      s.onload = resolve; document.head.appendChild(s);
    });
    loadXLSX().then(() => {
      const wb = window.XLSX.utils.book_new();
      const ws = window.XLSX.utils.table_to_sheet(table);
      window.XLSX.utils.book_append_sheet(wb, ws, 'Analytics');
      window.XLSX.writeFile(wb, 'Detailed_Analytics.xlsx');
      toast.success('Downloaded!');
    });
  };

  const thBase = { color:'#fff', fontSize:10, fontWeight:700, padding:'9px 11px',
    textAlign:'center', textTransform:'uppercase', letterSpacing:'.3px',
    borderRight:'1px solid rgba(255,255,255,.15)', whiteSpace:'nowrap' };
  const stickyTh = (left, minW=180) => ({
    ...thBase, position:'sticky', left, zIndex:5, textAlign:'left',
    background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
    boxShadow:'2px 0 4px rgba(0,0,0,.1)', minWidth:minW,
  });

  /* ════════════════ RENDER ════════════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .da-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .da-tr:hover td{filter:brightness(.96);}
        .da-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;
          background:#f5f3ff;color:#4f46e5;border:1.5px solid #c4b5fd;border-radius:6px;
          font-size:10.5px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .15s;}
        .da-btn:hover{background:#ede9fe;}
        .da-btn:disabled{opacity:.5;cursor:not-allowed;}
        @keyframes da_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="da-root" style={{
        display:'flex', flexDirection:'column', height:'calc(100vh - 62px)',
        padding:20, gap:12, overflow:'hidden', background:'#f5f3ff',
      }}>

        {/* ── HEADER ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ fontSize:17, fontWeight:800, color:'#1e293b' }}>📈 Detailed Analytics</div>
          <button onClick={exportXlsx} style={btnS()}>⬇️ Download Report</button>
        </div>

        {/* ── CONTROLS ── */}
        <div style={{ background:'#fff', borderRadius:12, border:'1.5px solid #ede9fe',
          padding:'13px 16px', flexShrink:0, display:'flex', flexDirection:'column', gap:10 }}>

          {/* Row 1: batch + dates */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <label style={{ fontSize:10.5, fontWeight:700, color:'#64748b', textTransform:'uppercase' }}>CIT Version</label>
              <select style={{ ...selS, minWidth:160 }} value={selBatch} onChange={e=>handleBatch(e.target.value)}>
                <option value="">Select CIT Version...</option>
                {batches.map(b=><option key={b.id} value={b.id}>CIT {b.batch_no}</option>)}
              </select>
            </div>
            {[['Start Date', startDate, setStartDate], ['End Date', endDate, setEndDate]].map(([lbl,val,fn])=>(
              <div key={lbl} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                <label style={{ fontSize:10.5, fontWeight:700, color:'#64748b', textTransform:'uppercase' }}>📅 {lbl}</label>
                <input type="date" style={inpS} value={val} onChange={e=>fn(e.target.value)}/>
              </div>
            ))}
          </div>

          {/* Row 2: filters */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            {[
              ['Campaign', allCampaigns, campFilter,  setCampFilter],
              ['AdSet',    allAdsets,    adsetFilter, setAdsetFilter],
              ['Ad',       allAds,       adFilter,    setAdFilter],
            ].map(([lbl,opts,val,fn])=>(
              <div key={lbl}>
                <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748b',
                  textTransform:'uppercase', marginBottom:4 }}>🔽 {lbl}</label>
                <select style={selS} value={val} onChange={e=>fn(e.target.value)}>
                  <option value="">All {lbl}s</option>
                  {opts.map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* ── ROI LEGEND ── */}
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <span style={{ fontSize:11, fontWeight:700, color:'#64748b' }}>ROI Scale:</span>
          <div style={{ width:160, height:12, borderRadius:99,
            background:'linear-gradient(to right,hsl(0,100%,90%),hsl(60,100%,90%),hsl(120,100%,90%))' }}/>
          <span style={{ fontSize:10.5, color:'#94a3b8' }}>Low → High</span>
          <span style={{ fontSize:10.5, color:'#64748b', marginLeft:10 }}>
            Max ROI in view: <strong style={{ color:'#4f46e5' }}>{fmt(maxRoi)}</strong>
          </span>
        </div>

        {/* ── TABLE ── */}
        <div style={{ flex:1, minHeight:0, background:'#fff', borderRadius:12,
          border:'1.5px solid #ede9fe', overflow:'auto',
          boxShadow:'0 1px 8px rgba(79,70,229,.05)' }}>

          {loading ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:60, gap:12, color:'#94a3b8' }}>
              <div style={{ width:28, height:28, border:'3px solid #ede9fe', borderTop:'3px solid #4f46e5',
                borderRadius:'50%', animation:'da_spin .7s linear infinite' }}/>
              Loading analytics...
            </div>
          ) : rawData.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'#94a3b8', fontSize:13 }}>
              No data for selected range
            </div>
          ) : (
            <table id="da-export-table" style={{ borderCollapse:'separate', borderSpacing:0,
              minWidth: 200*3 + allDates.length*120 + 260 }}>
              <thead>
                {/* Row 1: sticky cols + CIT version groups */}
                <tr style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  <th style={{ ...stickyTh(0), minWidth:200 }} rowSpan={2}>Campaign</th>
                  <th style={{ ...stickyTh(200), minWidth:200 }} rowSpan={2}>AdSet</th>
                  <th style={{ ...stickyTh(400), minWidth:200 }} rowSpan={2}>Ad</th>
                  {citGroups().map((g,i)=>(
                    <th key={i} colSpan={g.count} style={{ ...thBase,
                      background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
                      borderBottom:'1.5px solid rgba(255,255,255,.2)' }}>
                      {g.label||' '}
                    </th>
                  ))}
                  <th style={{ ...thBase, background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }} rowSpan={2}>Average</th>
                  <th style={{ ...thBase, background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }} rowSpan={2}>Total</th>
                </tr>
                {/* Row 2: individual dates */}
                <tr style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {allDates.map(d=>(
                    <th key={d} style={{ ...thBase, fontSize:9.5, background:'rgba(79,70,229,.85)',
                      position:'sticky', top:38, zIndex:1, minWidth:110 }}>
                      {formatDate(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map(camp => {
                  const campId = camp.replace(/[^a-z0-9]/gi,'_');
                  const dateMap = campaignMap[camp];
                  let totCost=0, totRev=0, totLeads=0;
                  allDates.forEach(d=>{ const x=dateMap[d]||{}; totCost+=x.cost||0; totRev+=x.revenue||0; totLeads+=x.leads||0; });
                  const campMaxRoi = Math.max(...allDates.map(d=>{ const x=dateMap[d]||{}; return x.cost>0?x.revenue/x.cost:0; }), 0);

                  const cnt = counts[camp] || {};

                  return [
                    /* ─── Campaign row ─── */
                    <tr key={camp} className="da-tr" data-campaign={campId}>
                      {/* Campaign col */}
                      <td style={{ ...stickyTd(0), background:'#fff' }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'#1e293b', marginBottom:6 }}>
                          {camp !== '-' ? camp : '—'}
                        </div>
                        {camp !== '-' && (
                          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                            {(cnt.adset_count||0) > 0 && (
                              <button className="da-btn"
                                onClick={()=>loadExpand(campId, camp, 'adsets')}>
                                {expanded[campId]==='adsets'?'▼':'▶'} AdSets ({cnt.adset_count})
                              </button>
                            )}
                            {(cnt.ad_count||0) > 0 && (
                              <button className="da-btn"
                                onClick={()=>loadExpand(campId, camp, 'ads')}>
                                {expanded[campId]==='ads'?'▼':'▶'} Ads ({cnt.ad_count})
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={stickyTd(200)}><span style={{ color:'#94a3b8', fontSize:11 }}>—</span></td>
                      <td style={stickyTd(400)}><span style={{ color:'#94a3b8', fontSize:11 }}>—</span></td>
                      {allDates.map(d=>{
                        const x = dateMap[d] || {cost:0,revenue:0,leads:0};
                        const roi = x.cost>0 ? x.revenue/x.cost : 0;
                        return <DateCell key={d} d={{ ...x, roi, cpl: x.leads>0?x.cost/x.leads:0 }} maxRoi={campMaxRoi}/>;
                      })}
                      {/* avg */}
                      <SummaryCell totalCost={totCost/Math.max(allDates.length,1)}
                        totalRevenue={totRev/Math.max(allDates.length,1)}
                        totalLeads={Math.round(totLeads/Math.max(allDates.length,1))}/>
                      {/* total */}
                      <SummaryCell totalCost={totCost} totalRevenue={totRev} totalLeads={totLeads}/>
                    </tr>,

                    /* ─── Expanded rows ─── */
                    ...(expanded[campId] && expandData[campId] ? (() => {
                      const type = expanded[campId]; // 'adsets' or 'ads'
                      const eData = expandData[campId];

                      /* Group by adset or adset+ad */
                      const grp = {};
                      eData.forEach(row => {
                        const k = type==='adsets' ? row.adset : `${row.adset}|||${row.ad}`;
                        if (!k) return;
                        if (!grp[k]) grp[k] = { adset:row.adset, ad:type==='ads'?row.ad:'', dates:{} };
                        const dd = grp[k].dates;
                        if (!dd[row.date]) dd[row.date] = {cost:0,revenue:0,leads:0};
                        dd[row.date].cost    += row.cost;
                        dd[row.date].revenue += row.revenue;
                        dd[row.date].leads   += row.leads;
                      });

                      return Object.entries(grp).map(([k, g]) => {
                        let ec=0, er=0, el=0;
                        const eMx = Math.max(...allDates.map(d=>{ const x=g.dates[d]||{}; return x.cost>0?x.revenue/x.cost:0; }),0);
                        allDates.forEach(d=>{ const x=g.dates[d]||{}; ec+=x.cost||0; er+=x.revenue||0; el+=x.leads||0; });
                        return (
                          <tr key={k} style={{ background:'#faf9ff' }} className="da-tr">
                            <td style={{ ...stickyTd(0), background:'#faf9ff' }}>
                              <span style={{ color:'#94a3b8', fontSize:11 }}>—</span>
                            </td>
                            <td style={{ ...stickyTd(200), background:'#faf9ff', fontSize:11, color:'#334155', fontWeight:600 }}>
                              {g.adset||'—'}
                            </td>
                            <td style={{ ...stickyTd(400), background:'#faf9ff', fontSize:11, color:'#334155' }}>
                              {g.ad||'—'}
                            </td>
                            {allDates.map(d=>{
                              const x = g.dates[d]||{cost:0,revenue:0,leads:0};
                              const roi = x.cost>0?x.revenue/x.cost:0;
                              return <DateCell key={d} d={{...x,roi,cpl:x.leads>0?x.cost/x.leads:0}} maxRoi={eMx}/>;
                            })}
                            <SummaryCell totalCost={ec/Math.max(allDates.length,1)}
                              totalRevenue={er/Math.max(allDates.length,1)}
                              totalLeads={Math.round(el/Math.max(allDates.length,1))}/>
                            <SummaryCell totalCost={ec} totalRevenue={er} totalLeads={el}/>
                          </tr>
                        );
                      });
                    })() : [])
                  ];
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}