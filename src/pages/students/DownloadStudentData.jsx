import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../api/axios';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Helmet } from 'react-helmet-async';

const LIMIT = 20;
const API   = 'https://cit3.internshipstudio.com/admin/react-api/api/students/download.php';

/* ── tiny pill badge ── */
const Pill = ({ v, type }) => {
  const styles = {
    yes:  { background:'#d1fae5', color:'#065f46' },
    no:   { background:'#fee2e2', color:'#991b1b' },
    num:  { background:'#ede9fe', color:'#5b21b6' },
    gray: { background:'#f1f5f9', color:'#64748b' },
    blue: { background:'#dbeafe', color:'#1e40af' },
    amber:{ background:'#fef3c7', color:'#92400e' },
  };
  const s = styles[type] || styles.gray;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px',
      borderRadius:20, fontSize:10.5, fontWeight:600, whiteSpace:'nowrap', ...s }}>
      {v}
    </span>
  );
};

/* ── derive badge type from value ── */
const yesNo = v => <Pill v={v} type={v==='Yes'?'yes':'no'}/>;
const numBadge = v => <Pill v={v??0} type={parseInt(v)>0?'num':'gray'}/>;
const pushBadge = v => {
  if (!v || v==='Unavailable') return <Pill v="Unavailable" type="gray"/>;
  if (v==='Denied') return <Pill v="Denied" type="no"/>;
  return <Pill v="Allowed" type="yes"/>;
};
const dash = v => v ? v : <span style={{ color:'#cbd5e1' }}>—</span>;

export default function SimplifiedCompleteData() {
  const [data,        setData]        = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [loading,     setLoading]     = useState(true);
  const [downloading, setDownloading] = useState(false);
  const jumpRef = useRef(null);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  /* ──────────────────────────────────────────────────────────────
     fetchData
     ─ accepts an AbortSignal so the effect cleanup can cancel
       the in-flight request when:
         (a) React 18 StrictMode runs the effect twice in dev, or
         (b) the user changes filters / page before the prior call returns.
     ─ this is what eliminates the duplicate XHR you saw in DevTools.
     ────────────────────────────────────────────────────────────── */
  const fetchData = useCallback(async (signal) => {
    setLoading(true);
    try {
      const res = await api.get(API, {
        params: { action:'fetch_data', page, per_page:LIMIT,
                  keyword:search, start_date:startDate, end_date:endDate },
        signal,
      });
      if (res.data.success) {
        setData(res.data.data?.students || []);
        setTotal(res.data.data?.total   || 0);
      }
    } catch (e) {
      // silently swallow cancellations (StrictMode + filter-change races)
      if (axios.isCancel(e) || e.name === 'CanceledError' || e.name === 'AbortError') return;
      toast.error('Failed to load');
    } finally {
      // only stop loading if the request wasn't aborted
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, search, startDate, endDate]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();   // <- kills the duplicate / stale call
  }, [fetchData]);

  const applyFilters = () => { setPage(1); setSearch(searchInput); };

  /* ── CSV download — keep prior request behaviour, plus a guard so the
        button cannot be clicked twice while a download is in flight ── */
  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    const t = toast.loading('Preparing CSV…');
    try {
      const res = await api.get(API, {
        params: { action:'download_csv', keyword:search, start_date:startDate, end_date:endDate },
        responseType: 'blob',
        timeout: 0,                      // long export should never time out
      });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `simplified_data_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click(); link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('CSV download started', { id: t });
    } catch {
      toast.error('Download failed', { id: t });
    } finally {
      setDownloading(false);
    }
  };

  const jumpToPage = () => {
    const v = parseInt(jumpRef.current?.value);
    if (v >= 1 && v <= totalPages) setPage(v);
    else toast.error('Invalid page number');
  };

  /* page number window */
  const pageNums = (() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3)              return [1,2,3,4,5];
    if (page >= totalPages - 2) return [totalPages-4,totalPages-3,totalPages-2,totalPages-1,totalPages];
    return [page-2,page-1,page,page+1,page+2];
  })();

  /* all 23 column definitions */
  const COLS = [
    { key:'user_id',          label:'ID',           w:65 },
    { key:'fname',            label:'Fname',        w:100 },
    { key:'lname',            label:'Lname',        w:100 },
    { key:'name',             label:'Name',         w:140 },
    { key:'email',            label:'Email',        w:200 },
    { key:'phone',            label:'Phone',        w:120 },
    { key:'state',            label:'State',        w:110 },
    { key:'gender',           label:'Gender',       w:75 },
    { key:'has_given_exam',   label:'Exam Given',   w:90 },
    { key:'internship_count', label:'Internships',  w:90 },
    { key:'wa_community_added',label:'WA Community',w:110 },
    { key:'batch',            label:'Batch',        w:90 },
    { key:'country',          label:'Country',      w:90 },
    { key:'medium',           label:'Medium',       w:100 },
    { key:'campaign',         label:'Campaign',     w:120 },
    { key:'adset',            label:'Adset',        w:110 },
    { key:'ad',               label:'Ad',           w:110 },
    { key:'push_notification',label:'Push Notif.',  w:100 },
    { key:'exam_qualified',   label:'Exam Qual.',   w:90 },
    { key:'survey_answer',    label:'Survey Ans.',  w:130 },
    { key:'old_login_date',   label:'Old Login',    w:100 },
    { key:'registered_at',    label:'Registered',   w:120 },
    { key:'current_exam_date',label:'Exam Date',    w:100 },
  ];

  const renderCell = (key, row) => {
    const v = row[key];
    switch (key) {
      case 'user_id':
        return <td key={key} style={{ color:'#94a3b8', fontWeight:700, width:65 }}>{v}</td>;
      case 'name':
        return <td key={key} style={{ fontWeight:700, color:'#1e293b', width:140 }}>{v}</td>;
      case 'email':
        return <td key={key} style={{ color:'#4f46e5', width:200 }}>{v}</td>;
      case 'has_given_exam':
      case 'exam_qualified':
        return <td key={key} style={{ width:90 }}>{yesNo(v)}</td>;
      case 'internship_count':
        return <td key={key} style={{ width:90 }}>{numBadge(v)}</td>;
      case 'push_notification':
        return <td key={key} style={{ width:100 }}>{pushBadge(v)}</td>;
      case 'gender':
        return <td key={key} style={{ width:75 }}>{v ? <Pill v={v} type="gray"/> : <span style={{color:'#cbd5e1'}}>—</span>}</td>;
      case 'wa_community_added':
        return <td key={key} style={{ width:110 }}>{v ? <Pill v={v} type="blue"/> : <span style={{color:'#cbd5e1'}}>—</span>}</td>;
      case 'batch':
        return <td key={key} style={{ width:90 }}>{v && v!=='-' ? <Pill v={v} type="amber"/> : <span style={{color:'#cbd5e1'}}>—</span>}</td>;
      case 'registered_at':
        return <td key={key} style={{ color:'#64748b', fontSize:11, width:120 }}>{v||'—'}</td>;
      default:
        return <td key={key} style={{ width: COLS.find(c=>c.key===key)?.w||100 }}>{dash(v)}</td>;
    }
  };

  return (
    <>
      <Helmet><title>Simplified Complete Data | Admin Panel</title></Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .sd-root  { font-family:'Plus Jakarta Sans',sans-serif; height:100vh; display:flex; flex-direction:column; background:#f1f5f9; overflow:hidden; }
        .sd-header{ flex-shrink:0; background:#fff; border-bottom:1.5px solid #e2e8f0; padding:10px 20px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
        .sd-title { font-size:15px; font-weight:700; color:#1e293b; letter-spacing:-.3px; white-space:nowrap; display:flex; align-items:center; gap:7px; }
        .sd-total { background:#ede9fe; color:#5b21b6; font-size:10.5px; font-weight:700; padding:2px 9px; border-radius:20px; white-space:nowrap; }
        .sd-filters{ display:flex; align-items:flex-end; gap:10px; flex-wrap:wrap; }
        .sd-fg    { display:flex; flex-direction:column; gap:3px; }
        .sd-flabel{ font-size:9.5px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:.4px; }
        .sd-date  { border:1.5px solid #e2e8f0; border-radius:7px; padding:5px 10px; font-size:11.5px; font-family:inherit; color:#1e293b; outline:none; background:#f8fafc; }
        .sd-date:focus{ border-color:#4f46e5; background:#fff; }
        .sd-apply { display:flex; align-items:center; gap:5px; background:#4f46e5; color:#fff; border:none; border-radius:7px; padding:6px 14px; font-size:11.5px; font-weight:600; cursor:pointer; font-family:inherit; white-space:nowrap; }
        .sd-apply:hover{ background:#4338ca; }
        .sd-clear { background:#f8fafc; color:#64748b; border:1.5px solid #e2e8f0; border-radius:7px; padding:6px 12px; font-size:11.5px; font-weight:600; cursor:pointer; font-family:inherit; white-space:nowrap; }
        .sd-clear:hover{ background:#f1f5f9; }
        .sd-search{ display:flex; align-items:center; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:8px; overflow:hidden; }
        .sd-search input{ flex:1; border:none; background:transparent; padding:6px 10px; font-size:12px; font-family:inherit; outline:none; color:#1e293b; width:200px; }
        .sd-search input::placeholder{ color:#94a3b8; }
        .sd-sb    { background:#4f46e5; border:none; padding:0 12px; color:#fff; cursor:pointer; display:flex; align-items:center; height:100%; }
        .sd-sb:hover{ background:#4338ca; }
        .sd-clr   { background:none; border:none; cursor:pointer; padding:0 8px; color:#94a3b8; display:flex; align-items:center; }
        .sd-clr:hover{ color:#4f46e5; }
        .sd-csv   { display:flex; align-items:center; gap:6px; background:#10b981; color:#fff; border:none; border-radius:8px; padding:7px 14px; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; white-space:nowrap; margin-left:auto; }
        .sd-csv:hover{ background:#059669; }
        .sd-csv:disabled{ opacity:.6; cursor:not-allowed; }
        .sd-body  { flex:1; overflow:hidden; display:flex; flex-direction:column; padding:12px 20px; }
        .sd-card  { flex:1; overflow:hidden; display:flex; flex-direction:column; background:#fff; border-radius:12px; border:1.5px solid #e2e8f0; box-shadow:0 1px 8px rgba(0,0,0,.04); }
        .sd-wrap  { flex:1; overflow:auto; }
        .sd-wrap::-webkit-scrollbar{ width:5px; height:5px; }
        .sd-wrap::-webkit-scrollbar-track{ background:#f1f5f9; }
        .sd-wrap::-webkit-scrollbar-thumb{ background:#c7d2fe; border-radius:10px; }
        table.sd-t{ width:100%; border-collapse:collapse; table-layout:fixed; }
        table.sd-t thead tr{ background:linear-gradient(135deg,#4f46e5 0%,#6366f1 100%); }
        table.sd-t thead th{ color:#fff; font-size:10.5px; font-weight:600; padding:10px; white-space:nowrap; text-align:left; letter-spacing:.4px; text-transform:uppercase; border-right:1px solid rgba(255,255,255,.18); overflow:hidden; text-overflow:ellipsis; position:sticky; top:0; z-index:2; }
        table.sd-t thead th:last-child{ border-right:none; }
        table.sd-t tbody tr{ border-bottom:1px solid #f1f5f9; transition:background .12s; }
        table.sd-t tbody tr:hover{ background:#f5f3ff; }
        table.sd-t tbody tr:last-child{ border-bottom:none; }
        table.sd-t td{ font-size:12px; color:#334155; padding:8px 10px; vertical-align:middle; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; border-right:1px solid #f1f5f9; }
        table.sd-t td:last-child{ border-right:none; }
        .sd-footer{ flex-shrink:0; display:flex; align-items:center; justify-content:space-between; padding:8px 16px; border-top:1.5px solid #f1f5f9; background:#fafafa; border-radius:0 0 12px 12px; }
        .sd-pinfo { font-size:11px; color:#94a3b8; }
        .sd-pages { display:flex; align-items:center; gap:3px; }
        .pg       { display:inline-flex; align-items:center; justify-content:center; min-width:28px; height:26px; padding:0 6px; border:1.5px solid #e2e8f0; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer; background:#fff; color:#475569; font-family:inherit; transition:all .15s; }
        .pg:hover:not(:disabled){ border-color:#4f46e5; color:#4f46e5; }
        .pg.act   { background:#4f46e5; border-color:#4f46e5; color:#fff; }
        .pg:disabled{ opacity:.35; cursor:not-allowed; }
        .pj       { display:flex; align-items:center; gap:4px; }
        .pj input { width:60px; border:1.5px solid #e2e8f0; border-radius:6px; padding:3px 6px; font-size:11px; font-family:inherit; outline:none; text-align:center; color:#1e293b; }
        .pj input:focus{ border-color:#4f46e5; }
        .pj button{ background:#4f46e5; color:#fff; border:none; border-radius:6px; padding:4px 10px; font-size:11px; font-weight:600; cursor:pointer; font-family:inherit; }
        .sd-loader{ position:fixed; inset:0; background:rgba(241,245,249,.75); display:flex; align-items:center; justify-content:center; z-index:9999; backdrop-filter:blur(2px); }
        .sd-spin  { width:36px; height:36px; border:3px solid #e0e7ff; border-top-color:#4f46e5; border-radius:50%; animation:sdspin .7s linear infinite; }
        @keyframes sdspin{ to{transform:rotate(360deg);} }
        .sd-empty { text-align:center; padding:50px; color:#94a3b8; font-size:13px; }
      `}</style>

      {loading && <div className="sd-loader"><div className="sd-spin"/></div>}

      <div className="sd-root">

        {/* ── HEADER ── */}
        <div className="sd-header">

          {/* Title */}
          <div className="sd-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>
            </svg>
            Simplified Complete Data
            {!loading && <span className="sd-total">{total.toLocaleString()} records</span>}
          </div>

          {/* Date filters */}
          <div className="sd-filters">
            <div className="sd-fg">
              <span className="sd-flabel">Start Date</span>
              <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="sd-date"/>
            </div>
            <div className="sd-fg">
              <span className="sd-flabel">End Date</span>
              <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="sd-date"/>
            </div>
            <button className="sd-apply" onClick={applyFilters}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 3H2l8 9.46V19l4 2V12.46z"/>
              </svg>
              Apply
            </button>
            <button className="sd-clear" onClick={()=>{
              setSearchInput(''); setSearch(''); setStartDate(''); setEndDate(''); setPage(1);
            }}>Clear</button>
          </div>

          {/* Search */}
          <div className="sd-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft:8, flexShrink:0 }}>
              <path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
            </svg>
            <input value={searchInput} placeholder="Search by email…"
              onChange={e=>setSearchInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&applyFilters()}/>
            {searchInput && (
              <button className="sd-clr" onClick={()=>{setSearchInput('');setSearch('');setPage(1);}}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
            <button className="sd-sb" onClick={applyFilters}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
              </svg>
            </button>
          </div>

          {/* Download CSV */}
          <button className="sd-csv" onClick={handleDownload} disabled={downloading}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            {downloading ? 'Preparing…' : 'Download CSV'}
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="sd-body">
          <div className="sd-card">
            <div className="sd-wrap">
              <table className="sd-t">
                <colgroup>
                  {COLS.map(c=><col key={c.key} style={{ width:c.w }}/>)}
                </colgroup>
                <thead>
                  <tr>{COLS.map(c=><th key={c.key}>{c.label}</th>)}</tr>
                </thead>
                <tbody>
                  {!loading && !data.length && (
                    <tr><td colSpan={COLS.length} className="sd-empty">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0"
                        strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
                        style={{ display:'block', margin:'0 auto 8px' }}>
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>
                      </svg>
                      No records found
                    </td></tr>
                  )}
                  {data.map(row => (
                    <tr key={row.user_id}>
                      {COLS.map(c => renderCell(c.key, row))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── FOOTER ── */}
            <div className="sd-footer">
              <span className="sd-pinfo">
                Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                &nbsp;·&nbsp;{total.toLocaleString()} records
              </span>

              <div className="sd-pages">
                <button className="pg" onClick={()=>setPage(1)} disabled={page<=1}>«</button>
                <button className="pg" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}>‹</button>
                {pageNums.map(p=>(
                  <button key={p} className={`pg${p===page?' act':''}`} onClick={()=>setPage(p)}>{p}</button>
                ))}
                <button className="pg" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages}>›</button>
                <button className="pg" onClick={()=>setPage(totalPages)} disabled={page>=totalPages}>»</button>
              </div>

              <div className="pj">
                <input ref={jumpRef} type="number" min={1} max={totalPages} placeholder="Page"
                  onKeyDown={e=>e.key==='Enter'&&jumpToPage()}/>
                <button onClick={jumpToPage}>Go</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}