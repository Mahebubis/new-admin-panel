import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
  LineChart, Line,
} from 'recharts';
import toast from 'react-hot-toast';

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/reports/analytics_dashboard.php';
const post = d => fetch(API,{method:'POST',body:new URLSearchParams(d)}).then(r=>r.json());

/* ─── helpers ─── */
const fmtINR = n => '₹'+Math.round(+n||0).toLocaleString('en-IN');
const fmtNum = n => (+n||0).toLocaleString('en-IN');
const fmtDec = (n,d=2) => (+n||0).toFixed(d);

const getGoal = name => {
  const n = name.toLowerCase();
  if (n.includes('adv') || n.includes('_a')) return 'register';
  if (n.includes('_p') || n.includes('_c') || n.includes('_b') || n.includes('_d') || n.includes('_e')) return 'purchase';
  return 'unknown';
};

const isoDate = d => d.toISOString().split('T')[0];
const addDays  = n => { const d=new Date(); d.setDate(d.getDate()+n); return isoDate(d); };
const todayStr = () => isoDate(new Date());

/* ─── KPI Card ─── */
function KpiCard({ label, value, icon, grad, sub }) {
  return (
    <div style={{
      background:'#fff', borderRadius:20, padding:'24px 26px',
      boxShadow:'0 8px 32px rgba(0,0,0,.12)', position:'relative',
      overflow:'hidden', transition:'all .3s',
    }}
    onMouseEnter={e=>e.currentTarget.style.transform='translateY(-5px)'}
    onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:700,color:'#718096',textTransform:'uppercase',letterSpacing:'.8px'}}>{label}</div>
        <div style={{width:52,height:52,borderRadius:16,background:grad,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,boxShadow:'0 4px 16px rgba(0,0,0,.12)'}}>
          {icon}
        </div>
      </div>
      <div style={{fontSize:34,fontWeight:900,background:'linear-gradient(135deg,#2d3748,#4a5568)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',letterSpacing:'-1.5px',marginBottom:8}}>
        {value}
      </div>
      <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,fontWeight:600,padding:'5px 10px',borderRadius:9,background:'#e0e7ff',color:'#4c51bf'}}>
        {sub}
      </span>
    </div>
  );
}

/* ─── MetricRow ─── */
function MetricRow({ label, value }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',background:'#f7fafc',borderRadius:13,marginBottom:10,transition:'all .2s',cursor:'default'}}
      onMouseEnter={e=>{e.currentTarget.style.background='#edf2f7';e.currentTarget.style.transform='translateX(5px)';}}
      onMouseLeave={e=>{e.currentTarget.style.background='#f7fafc';e.currentTarget.style.transform='translateX(0)';}}>
      <span style={{fontSize:13,fontWeight:600,color:'#4a5568'}}>{label}</span>
      <span style={{fontSize:17,fontWeight:800,color:'#2d3748'}}>{value}</span>
    </div>
  );
}

/* ─── Custom Tooltip ─── */
const ChartTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:10,padding:'10px 14px',boxShadow:'0 4px 16px rgba(0,0,0,.1)',fontSize:12}}>
      {label && <div style={{fontWeight:700,color:'#2d3748',marginBottom:5}}>{label}</div>}
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color,fontWeight:600}}>
          {p.name}: {currency?fmtINR(p.value):fmtNum(p.value)}
        </div>
      ))}
    </div>
  );
};

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
export default function AnalyticsDashboard() {
  const [citVersions,  setCitVersions]  = useState([]);
  const [selectedCit,  setSelectedCit]  = useState('');
  const [fromDate,     setFromDate]     = useState(addDays(-6));
  const [toDate,       setToDate]       = useState(todayStr());
  const [goalFilter,   setGoalFilter]   = useState('all');
  const [data,         setData]         = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [showToken,    setShowToken]    = useState(false);
  const [newToken,     setNewToken]     = useState('');
  const [alert,        setAlert]        = useState(null);

  const showAlert = (msg, type='error') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 5000);
  };

  /* ── load CIT versions ── */
  useEffect(() => {
    post({ action:'get_cit_versions' })
      .then(d => {
        if (d.success && d.versions.length) {
          setCitVersions(d.versions);
          setSelectedCit(d.versions[0]);
          return post({ action:'get_date_range', cit_version:d.versions[0] });
        }
      })
      .then(d => {
        if (d?.success) { setFromDate(d.from_date); setToDate(d.to_date); }
      })
      .catch(() => {});
  }, []);

  const handleCit = (v) => {
    setSelectedCit(v);
    if (!v) return;
    post({ action:'get_date_range', cit_version:v })
      .then(d => { if (d.success) { setFromDate(d.from_date); setToDate(d.to_date); } })
      .catch(() => {});
  };

  /* ── load data ── */
  const loadData = useCallback(async () => {
    if (!fromDate || !toDate) { showAlert('Please select date range'); return; }
    setLoading(true); setData([]);
    try {
      const res = await post({
        action:      'fetch_analytics',
        from_date:   fromDate,
        to_date:     toDate,
        goal_filter: goalFilter,
        per_page:    2000,
      });
      if (res.token_expired) { setTokenExpired(true); setShowToken(true); setLoading(false); return; }
      if (!res.success) { showAlert(res.message||'Error loading data'); setLoading(false); return; }
      const rows = res.data || [];
      setData(rows);
      if (rows.length === 0) showAlert('No campaigns found for the selected filters', 'success');
      else showAlert(`Successfully loaded ${rows.length} campaigns`, 'success');
    } catch(e) { showAlert(e.message); }
    finally { setLoading(false); }
  }, [fromDate, toDate, goalFilter]);

  const updateToken = async () => {
    const res = await post({ action:'update_meta_token', token:newToken });
    if (res.success) { toast.success('Token updated!'); setTokenExpired(false); setShowToken(false); setNewToken(''); }
    else showAlert(res.message||'Failed');
  };

  /* ── derived metrics ── */
  const totals = useMemo(() => {
    const t={campaigns:0,spend:0,clicks:0,registrations:0,purchases:0,revenue:0,exams:0};
    data.forEach(r=>{t.campaigns++;t.spend+=+r.spend||0;t.clicks+=+r.clicks||0;t.registrations+=+r.registrations||0;t.purchases+=+r.internship_count||0;t.revenue+=+r.revenue||0;t.exams+=+r.exam_count||0;});
    return {...t, roi:t.spend>0?t.revenue/t.spend:0};
  },[data]);

  /* ── goal totals ── */
  const byGoal = useMemo(() => {
    const r={campaigns:0,spend:0,reg:0,exams:0,purchases:0,revenue:0};
    const p={campaigns:0,spend:0,reg:0,exams:0,purchases:0,revenue:0};
    data.forEach(row=>{
      const g=row.goal==='register'?r:row.goal==='purchase'?p:null;
      if(!g)return;
      g.campaigns++;g.spend+=+row.spend||0;g.reg+=+row.registrations||0;
      g.exams+=+row.exam_count||0;g.purchases+=+row.internship_count||0;g.revenue+=+row.revenue||0;
    });
    return {register:r,purchase:p};
  },[data]);

  /* ── chart data ── */
  const chartSpendRevenue = [
    { name:'Total Spend',   value:totals.spend },
    { name:'Total Revenue', value:totals.revenue },
  ];
  const chartRegPurchase = [
    { name:'Complete Registration', value:totals.registrations },
    { name:'Purchase',              value:totals.purchases },
  ];
  const chartDoughnut = [
    { name:'Registration Revenue', value: byGoal.register.revenue || 0 },
    { name:'Purchase Revenue',     value: byGoal.purchase.revenue || 0 },
  ];
  const chartROI = [
    { name:'Complete Registration', roi: byGoal.register.spend>0?+(byGoal.register.revenue/byGoal.register.spend).toFixed(3):0 },
    { name:'Purchase',              roi: byGoal.purchase.spend>0?+(byGoal.purchase.revenue/byGoal.purchase.spend).toFixed(3):0 },
  ];

  const PIE_COLORS = ['#667eea','#f5576c'];
  const BAR_COLORS1 = ['rgba(102,126,234,.9)','rgba(0,184,148,.9)'];
  const BAR_COLORS2 = ['rgba(102,126,234,.9)','rgba(245,87,108,.9)'];

  /* ── shared card style ── */
  const card = { background:'#fff', borderRadius:24, padding:'28px 30px', boxShadow:'0 8px 32px rgba(0,0,0,.12)' };
  const inpS = { width:'100%', padding:'12px 16px', border:'2px solid #e2e8f0', borderRadius:13, fontSize:13, fontFamily:'inherit', fontWeight:500, background:'#f7fafc', outline:'none', transition:'border .2s,background .2s' };
  const btnPrimary = { padding:'12px 26px', borderRadius:13, fontSize:13, fontWeight:700, cursor:'pointer', border:'none', display:'inline-flex', alignItems:'center', gap:8, fontFamily:'inherit', background:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)', color:'#fff', boxShadow:'0 4px 16px rgba(102,126,234,.3)', transition:'all .25s' };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap');
        .ad-root * { box-sizing:border-box; font-family:'Poppins',sans-serif; }
        .ad-inp:focus { border-color:#667eea!important; background:#fff!important; box-shadow:0 0 0 4px rgba(102,126,234,.1)!important; }
        .ad-btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(102,126,234,.45)!important; }
        .ad-btn-secondary:hover { border-color:#667eea!important; background:#f7fafc!important; }
        .ad-tr:hover td { background:#f7fafc!important; }
        @keyframes ad_spin { to { transform:rotate(360deg); } }
        .ad-spin { display:inline-block;width:60px;height:60px;border:5px solid #e2e8f0;border-top-color:#667eea;border-radius:50%;animation:ad_spin .8s linear infinite; }
      `}</style>

      <div className="ad-root" style={{
        background:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
        paddingBottom:60,
      }}>

        {/* Loading overlay */}
        {loading && (
          <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(255,255,255,.95)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,backdropFilter:'blur(8px)'}}>
            <div className="ad-spin"/>
          </div>
        )}

        {/* ══ TOP HEADER ══ */}
        <div style={{background:'rgba(255,255,255,.98)',backdropFilter:'blur(20px)',boxShadow:'0 4px 30px rgba(0,0,0,.1)'}}>
          <div style={{maxWidth:1600,margin:'0 auto',padding:'18px 28px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:16}}>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{width:54,height:54,background:'linear-gradient(135deg,#667eea,#764ba2)',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,boxShadow:'0 8px 24px rgba(102,126,234,.4)'}}>🎯</div>
              <div>
                <h1 style={{fontSize:24,fontWeight:800,background:'linear-gradient(135deg,#667eea,#764ba2)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',margin:0,letterSpacing:'-.5px'}}>
                  Meta Ads Analytics Dashboard
                </h1>
                <p style={{fontSize:12,color:'#718096',fontWeight:500,margin:0}}>Complete Campaign Performance Analytics</p>
              </div>
            </div>
            <div style={{display:'flex',gap:12}}>
              <button onClick={loadData} style={btnPrimary} className="ad-btn-primary">
                🔄 Refresh Data
              </button>
              <button onClick={()=>{/* export handled below */document.getElementById('ad-export-btn').click();}}
                style={{...btnPrimary,background:'#fff',color:'#667eea',border:'2px solid #e2e8f0',boxShadow:'none'}} className="ad-btn-secondary">
                📊 Export Excel
              </button>
              <button id="ad-export-btn" style={{display:'none'}} onClick={()=>{
                if(!data.length){showAlert('No data');return;}
                const h=['campaign_name','goal','delivery_status','spend','clicks','impressions','registrations','cost_per_registration','exam_count','internship_count','revenue','roi','roas'];
                let csv=h.join(',')+'\n';
                data.forEach(r=>{csv+=h.map(k=>`"${(r[k]??'').toString().replace(/"/g,'""')}"`).join(',')+'\n';});
                const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
                a.download='analytics_'+new Date().toISOString().split('T')[0]+'.csv';a.click();
              }}/>
            </div>
          </div>
        </div>

        <div style={{maxWidth:1600,margin:'0 auto',padding:'28px 28px'}}>

          {/* ── Token box ── */}
          {showToken && (
            <div style={{display:'flex',alignItems:'center',gap:12,padding:'18px 22px',background:'#fff3cd',border:'2px solid #ffc107',borderRadius:16,marginBottom:20}}>
              <span style={{fontSize:22}}>⚠️</span>
              <input value={newToken} onChange={e=>setNewToken(e.target.value)} placeholder="Enter new Meta Access Token"
                style={{flex:1,padding:'10px 16px',border:'2px solid #ffc107',borderRadius:10,fontSize:13,fontFamily:'inherit',outline:'none'}}/>
              <button onClick={updateToken} style={btnPrimary} className="ad-btn-primary">✔ Update Token</button>
            </div>
          )}

          {/* ── Alert ── */}
          {alert && (
            <div style={{padding:'14px 18px',borderRadius:13,marginBottom:18,display:'flex',alignItems:'center',gap:10,fontSize:13,fontWeight:600,
              background:alert.type==='success'?'#d1fae5':'#fee2e2',
              border:`2px solid ${alert.type==='success'?'#6ee7b7':'#fca5a5'}`,
              color:alert.type==='success'?'#047857':'#dc2626'}}>
              {alert.type==='success'?'✅':'❌'} {alert.msg}
            </div>
          )}

          {/* ══ FILTERS ══ */}
          <div style={{...card,marginBottom:28}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16,marginBottom:18}}>
              {[
                { label:'📅 CIT Version', el:
                  <select className="ad-inp" style={inpS} value={selectedCit} onChange={e=>handleCit(e.target.value)}>
                    <option value="">Select...</option>
                    {citVersions.map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                },
                { label:'📅 From Date', el:
                  <input type="date" className="ad-inp" style={inpS} value={fromDate} onChange={e=>setFromDate(e.target.value)}/>
                },
                { label:'📅 To Date', el:
                  <input type="date" className="ad-inp" style={inpS} value={toDate} onChange={e=>setToDate(e.target.value)}/>
                },
                { label:'🎯 Campaign Goal', el:
                  <select className="ad-inp" style={inpS} value={goalFilter} onChange={e=>setGoalFilter(e.target.value)}>
                    <option value="all">All Goals</option>
                    <option value="register">Registration</option>
                    <option value="purchase">Purchase</option>
                  </select>
                },
              ].map(({label,el})=>(
                <div key={label}>
                  <label style={{display:'block',fontSize:11,fontWeight:700,color:'#4a5568',marginBottom:7,textTransform:'uppercase',letterSpacing:'.5px'}}>{label}</label>
                  {el}
                </div>
              ))}
            </div>
            <div>
              <button onClick={loadData} style={btnPrimary} className="ad-btn-primary">▶ Load Data</button>
            </div>
          </div>

          {/* ══ KPI CARDS ══ */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:18,marginBottom:28}}>
            <KpiCard label="Total Campaigns" value={fmtNum(totals.campaigns)} icon="📣"
              grad="linear-gradient(135deg,#667eea,#764ba2)" sub="📈 Active"/>
            <KpiCard label="Total Spend" value={fmtINR(totals.spend)} icon="💰"
              grad="linear-gradient(135deg,#ffeaa7,#fdcb6e)" sub="💼 Investment"/>
            <KpiCard label="Registrations" value={fmtNum(totals.registrations)} icon="👥"
              grad="linear-gradient(135deg,#a29bfe,#6c5ce7)" sub="⬆ Sign-ups"/>
            <KpiCard label="Total Revenue" value={fmtINR(totals.revenue)} icon="💸"
              grad="linear-gradient(135deg,#55efc4,#00b894)" sub="⬆ Earnings"/>
            <KpiCard label="ROI" value={fmtDec(totals.roi)+'x'} icon="📊"
              grad="linear-gradient(135deg,#fd79a8,#e84393)" sub="🏆 Return"/>
            <KpiCard label="Purchases" value={fmtNum(totals.purchases)} icon="🛒"
              grad="linear-gradient(135deg,#74b9ff,#0984e3)" sub="✔ Conversions"/>
          </div>

          {/* ══ CHARTS ══ */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:22,marginBottom:28}}>

            {/* Chart 1: Spend vs Revenue */}
            <div style={card}>
              <div style={{fontSize:15,fontWeight:700,color:'#2d3748',marginBottom:18,display:'flex',alignItems:'center',gap:8}}>
                <span style={{color:'#667eea'}}>📊</span> Spend vs Revenue
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartSpendRevenue} barCategoryGap="35%">
                  <XAxis dataKey="name" tick={{fontSize:12,fontFamily:'Poppins',fontWeight:600}} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={v=>'₹'+(v/1000).toFixed(0)+'K'} tick={{fontSize:11,fontFamily:'Poppins'}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<ChartTooltip currency/>}/>
                  <Bar dataKey="value" radius={[10,10,0,0]} name="Amount">
                    {chartSpendRevenue.map((_,i)=><Cell key={i} fill={BAR_COLORS1[i]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 2: Registrations vs Purchases */}
            <div style={card}>
              <div style={{fontSize:15,fontWeight:700,color:'#2d3748',marginBottom:18,display:'flex',alignItems:'center',gap:8}}>
                <span style={{color:'#f5576c'}}>📈</span> Registrations vs Purchases
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartRegPurchase} barCategoryGap="35%">
                  <XAxis dataKey="name" tick={{fontSize:12,fontFamily:'Poppins',fontWeight:600}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:11,fontFamily:'Poppins'}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<ChartTooltip/>}/>
                  <Bar dataKey="value" radius={[10,10,0,0]} name="Count">
                    {chartRegPurchase.map((_,i)=><Cell key={i} fill={BAR_COLORS2[i]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 3: Campaign Performance Doughnut */}
            <div style={card}>
              <div style={{fontSize:15,fontWeight:700,color:'#2d3748',marginBottom:18,display:'flex',alignItems:'center',gap:8}}>
                <span style={{color:'#00b894'}}>🍩</span> Campaign Performance
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={chartDoughnut} dataKey="value" cx="50%" cy="50%" innerRadius={80} outerRadius={130} paddingAngle={4}>
                    {chartDoughnut.map((_,i)=><Cell key={i} fill={PIE_COLORS[i]}/>)}
                  </Pie>
                  <Tooltip formatter={v=>fmtINR(v)}/>
                  <Legend iconType="circle" wrapperStyle={{fontFamily:'Poppins',fontSize:12,fontWeight:600}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 4: ROI by Goal */}
            <div style={card}>
              <div style={{fontSize:15,fontWeight:700,color:'#2d3748',marginBottom:18,display:'flex',alignItems:'center',gap:8}}>
                <span style={{color:'#fdcb6e'}}>📉</span> ROI Trend by Goal
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartROI}>
                  <XAxis dataKey="name" tick={{fontSize:12,fontFamily:'Poppins',fontWeight:600}} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={v=>v.toFixed(2)+'x'} tick={{fontSize:11,fontFamily:'Poppins'}} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={v=>v.toFixed(2)+'x'}/>
                  <Line type="monotone" dataKey="roi" stroke="#667eea" strokeWidth={4} dot={{r:8,fill:'#667eea'}}
                    activeDot={{r:10}} name="ROI"/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ══ COMPARISON CARDS ══ */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:22,marginBottom:28}}>
            {[
              { key:'register', title:'Registration', sub:'User acquisition campaigns', icon:'👤',
                grad:'linear-gradient(135deg,#667eea,#764ba2)', d:byGoal.register },
              { key:'purchase', title:'Purchase', sub:'Conversion campaigns', icon:'🛍️',
                grad:'linear-gradient(135deg,#f093fb,#f5576c)', d:byGoal.purchase },
            ].map(({ key, title, sub, icon, grad, d }) => (
              <div key={key} style={{...card,position:'relative',paddingTop:32,overflow:'hidden'}}>
                {/* top accent bar */}
                <div style={{position:'absolute',top:0,left:0,right:0,height:6,background:grad}}/>
                {/* header */}
                <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:22,paddingBottom:18,borderBottom:'2px solid #f7fafc'}}>
                  <div style={{width:68,height:68,borderRadius:20,background:grad,display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,boxShadow:'0 8px 24px rgba(0,0,0,.15)'}}>{icon}</div>
                  <div>
                    <div style={{fontSize:22,fontWeight:800,color:'#2d3748'}}>{title}</div>
                    <div style={{fontSize:12,color:'#718096',fontWeight:500}}>{sub}</div>
                  </div>
                </div>
                <MetricRow label="Total Campaigns" value={fmtNum(d.campaigns)}/>
                <MetricRow label="Total Spend"     value={fmtINR(d.spend)}/>
                <MetricRow label="Registrations"   value={fmtNum(d.reg)}/>
                <MetricRow label="Exams Taken"     value={fmtNum(d.exams)}/>
                <MetricRow label="Purchases"       value={fmtNum(d.purchases)}/>
                <MetricRow label="Revenue"         value={fmtINR(d.revenue)}/>
                {/* ROI highlight */}
                <div style={{background:grad,padding:'20px 24px',borderRadius:17,marginTop:16,textAlign:'center'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,.9)',textTransform:'uppercase',letterSpacing:1,marginBottom:7}}>Return on Investment</div>
                  <div style={{fontSize:40,fontWeight:900,color:'#fff',letterSpacing:'-1px'}}>
                    {d.spend>0?fmtDec(d.revenue/d.spend):'0.00'}x
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ══ CAMPAIGN TABLE ══ */}
          <div style={card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22,flexWrap:'wrap',gap:12}}>
              <div>
                <div style={{fontSize:19,fontWeight:800,color:'#2d3748'}}>📋 Campaign Performance Table</div>
                <div style={{fontSize:12,color:'#718096',marginTop:3}}>Detailed metrics breakdown by campaign</div>
              </div>
              <div style={{fontSize:12,fontWeight:600,color:'#718096'}}>
                {data.length} campaigns
              </div>
            </div>
            <div style={{overflowX:'auto',borderRadius:16,border:'2px solid #f7fafc'}}>
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:1200}}>
                <thead>
                  <tr style={{background:'linear-gradient(135deg,#667eea,#764ba2)'}}>
                    {['Campaign Name','Goal','Status','Spend','Clicks','Impressions','Registrations','Cost/Reg','Exams','Purchases','Revenue','ROI','ROAS'].map(h=>(
                      <th key={h} style={{padding:'16px 18px',textAlign:'left',fontSize:11,fontWeight:800,color:'#fff',textTransform:'uppercase',letterSpacing:'.8px',whiteSpace:'nowrap'}}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!data.length ? (
                    <tr><td colSpan={13} style={{textAlign:'center',padding:50,color:'#718096'}}>
                      <div style={{fontSize:44,marginBottom:12,opacity:.25}}>📊</div>
                      <div style={{fontSize:14,fontWeight:600}}>Select filters and click "Load Data"</div>
                    </td></tr>
                  ) : data.map((row,i) => {
                    const roi = +row.roi||0;
                    const goalColor = row.goal==='register'?{bg:'#e0e7ff',c:'#4c51bf'}:row.goal==='purchase'?{bg:'#fce7f3',c:'#db2777'}:{bg:'#f3f4f6',c:'#6b7280'};
                    const statusColor = row.delivery_status==='ACTIVE'?{bg:'#d1fae5',c:'#047857'}:row.delivery_status==='PAUSED'?{bg:'#fee2e2',c:'#dc2626'}:{bg:'#f3f4f6',c:'#6b7280'};
                    const badge = (text,clr) => <span style={{display:'inline-block',padding:'5px 12px',borderRadius:9,fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'.4px',background:clr.bg,color:clr.c}}>{text}</span>;
                    const tdS = {padding:'16px 18px',fontSize:13,borderBottom:'1px solid #f7fafc',fontWeight:500};
                    return (
                      <tr key={i} className="ad-tr" style={{background:i%2===0?'#fff':'#fafbff'}}>
                        <td style={{...tdS,fontWeight:700,maxWidth:280}} title={row.campaign_name}>
                          <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:260}}>{row.campaign_name}</div>
                        </td>
                        <td style={tdS}>{badge(row.goal==='register'?'📱 Register':row.goal==='purchase'?'🛒 Purchase':'❓ Unknown', goalColor)}</td>
                        <td style={tdS}>{badge(row.delivery_status||'—', statusColor)}</td>
                        <td style={{...tdS,fontWeight:700}}>{fmtINR(row.spend)}</td>
                        <td style={tdS}>{fmtNum(row.clicks)}</td>
                        <td style={tdS}>{fmtNum(row.impressions)}</td>
                        <td style={tdS}>{fmtNum(row.registrations)}</td>
                        <td style={tdS}>{row.cost_per_registration?fmtINR(row.cost_per_registration):'—'}</td>
                        <td style={tdS}>{fmtNum(row.exam_count)}</td>
                        <td style={tdS}>{fmtNum(row.internship_count)}</td>
                        <td style={{...tdS,fontWeight:700,color:'#00b894'}}>{fmtINR(row.revenue)}</td>
                        <td style={{...tdS,fontWeight:900,color:roi>=1?'#00b894':'#e74c3c'}}>{fmtDec(roi)}x</td>
                        <td style={{...tdS,fontWeight:700}}>{fmtDec(row.roas)}x</td>
                      </tr>
                    );
                  })}
                </tbody>
                {data.length > 0 && (
                  <tfoot>
                    <tr style={{background:'#eef1f5'}}>
                      <td colSpan={3} style={{padding:'14px 18px',fontWeight:800,fontSize:13,borderTop:'2px solid #cbd5e0'}}>TOTALS</td>
                      <td style={{padding:'14px 18px',fontWeight:700,fontSize:13,borderTop:'2px solid #cbd5e0'}}>{fmtINR(totals.spend)}</td>
                      <td style={{padding:'14px 18px',fontWeight:700,fontSize:13,borderTop:'2px solid #cbd5e0'}}>{fmtNum(totals.clicks)}</td>
                      <td style={{padding:'14px 18px',fontWeight:700,fontSize:13,borderTop:'2px solid #cbd5e0'}}>—</td>
                      <td style={{padding:'14px 18px',fontWeight:700,fontSize:13,borderTop:'2px solid #cbd5e0'}}>{fmtNum(totals.registrations)}</td>
                      <td style={{padding:'14px 18px',fontWeight:700,fontSize:13,borderTop:'2px solid #cbd5e0'}}>{totals.registrations>0?fmtINR(totals.spend/totals.registrations):'—'}</td>
                      <td style={{padding:'14px 18px',fontWeight:700,fontSize:13,borderTop:'2px solid #cbd5e0'}}>{fmtNum(totals.exams)}</td>
                      <td style={{padding:'14px 18px',fontWeight:700,fontSize:13,borderTop:'2px solid #cbd5e0'}}>{fmtNum(totals.purchases)}</td>
                      <td style={{padding:'14px 18px',fontWeight:700,fontSize:13,borderTop:'2px solid #cbd5e0',color:'#00b894'}}>{fmtINR(totals.revenue)}</td>
                      <td style={{padding:'14px 18px',fontWeight:900,fontSize:13,borderTop:'2px solid #cbd5e0',color:totals.roi>=1?'#00b894':'#e74c3c'}}>{fmtDec(totals.roi)}x</td>
                      <td style={{padding:'14px 18px',fontWeight:700,fontSize:13,borderTop:'2px solid #cbd5e0'}}>{fmtDec(totals.roi)}x</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}