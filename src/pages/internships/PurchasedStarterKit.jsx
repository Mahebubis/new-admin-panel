import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/internship-system/starter_kit_payments.php';
const FH  = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk  = obj => new URLSearchParams(obj);

const tdS = { padding:'9px 12px', borderBottom:'1px solid #f5f3ff', color:'#334155', fontSize:12, verticalAlign:'middle' };

/* status → api value */
const STATUS_TABS = [
  { key:'success',   label:'Payment Success', hint:'status = success' },
  { key:'initiated', label:'Add to Cart',     hint:'status = initiated' },
];

const RANGES = [
  { key:'today',     label:'Today' },
  { key:'yesterday', label:'Yesterday' },
  { key:'last7',     label:'Last 7 Days' },
  { key:'all',       label:'All Time' },
  { key:'custom',    label:'Custom Range' },
];

const PROVIDERS = [
  { key:'all',      label:'All Providers' },
  { key:'cashfree', label:'Cashfree' },
  { key:'razorpay', label:'Razorpay' },
];

const PER_PAGE_OPTIONS = [20, 50, 100, 200];

const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function PurchasedStarterKit() {
  const [status,   setStatus]   = useState('success');
  const [range,    setRange]    = useState('today');
  const [start,    setStart]    = useState('');
  const [end,      setEnd]      = useState('');
  const [provider, setProvider] = useState('all');
  const [downloading, setDownloading] = useState(false);

  const [rows,     setRows]     = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [perPage,  setPerPage]  = useState(20);
  const [loading,  setLoading]  = useState(true);

  const [stats,    setStats]    = useState({ success_count:0, initiated_count:0, success_amount:0, initiated_amount:0 });
  const [statsLoading, setStatsLoading] = useState(true);

  /* custom range needs both dates before it fires */
  const rangeReady = range !== 'custom' || (start && end);

  const rangeParams = useCallback(() => {
    const p = { range, provider };
    if (range === 'custom') { p.start = start; p.end = end; }
    return p;
  }, [range, start, end, provider]);

  /* ── stats ── */
  const fetchStats = useCallback(async () => {
    if (!rangeReady) return;
    setStatsLoading(true);
    try {
      const res = await api.post(API, mk({ action:'fetch_stats', ...rangeParams() }), FH);
      if (res.data.status === 'success') setStats(res.data.data);
    } catch { /* keep old stats on failure */ } finally { setStatsLoading(false); }
  }, [rangeReady, rangeParams]);

  /* ── list ── */
  const fetchList = useCallback(async () => {
    if (!rangeReady) return;
    setLoading(true);
    try {
      const res = await api.post(API, mk({
        action:'fetch_list', status, page, per_page: perPage, ...rangeParams(),
      }), FH);
      if (res.data.status === 'success') {
        setRows(res.data.data.rows || []);
        setTotal(res.data.data.total || 0);
      } else {
        setRows([]); setTotal(0);
      }
    } catch { setRows([]); setTotal(0); } finally { setLoading(false); }
  }, [rangeReady, status, page, perPage, rangeParams]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchList(); }, [fetchList]);

  /* reset to page 1 whenever a filter changes */
  const changeStatus   = (s) => { setStatus(s); setPage(1); };
  const changeRange    = (r) => { setRange(r); setPage(1); };
  const changePerPage  = (n) => { setPerPage(n); setPage(1); };
  const changeProvider = (p) => { setProvider(p); setPage(1); };

  const copy = (text) => { if (!text) return; navigator.clipboard.writeText(text); toast.success('Copied!'); };

  /* ── download Excel for the selected date range (+ provider, current status tab) ── */
  const downloadExcel = async () => {
    if (!rangeReady) { toast.error('Pick both custom dates first'); return; }
    setDownloading(true);
    try {
      const res = await api.post(API, mk({
        action:'export', status, ...rangeParams(),
      }), FH);
      if (res.data.status !== 'success') { toast.error(res.data.message || 'Export failed'); return; }
      const data = res.data.data.rows || [];
      if (!data.length) { toast.error('No records to export for this filter'); return; }

      // Load SheetJS on demand (same CDN as the rest of the panel)
      if (!window.XLSX) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      const sheet = data.map((r, i) => ({
        '#':          i + 1,
        'Name':       r.name    || '',
        'Email':      r.email   || '',
        'Mobile':     r.phone   || '',
        'Payment ID': r.payment_id || '',
        'Order ID':   r.order_id   || '',
        'Provider':   r.provider   || '',
        'Amount':     Number(r.amount || 0),
        'Status':     r.status  || '',
        'Paid Date':  r.paid_at || '',
      }));
      const ws = window.XLSX.utils.json_to_sheet(sheet);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Starter Kit');

      const rangeTag = range === 'custom' ? `${start}_to_${end}` : range;
      window.XLSX.writeFile(wb, `starter_kit_${status}_${provider}_${rangeTag}.xlsx`);
      toast.success(`Exported ${data.length} record(s)`);
    } catch { toast.error('Excel export failed'); }
    finally { setDownloading(false); }
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const activeCount = status === 'success' ? stats.success_count : stats.initiated_count;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .sk-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .sk-tr:hover td{background:#faf9ff!important;}
        .sk-pg-btn:hover:not(:disabled){background:#ede9fe!important;color:#4f46e5!important;}
        @keyframes sk_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="sk-root" style={{ background:'#f5f3ff', minHeight:'100vh', padding:24 }}>

        {/* header */}
        <div style={{ fontSize:18, fontWeight:800, color:'#1e293b', marginBottom:18,
          display:'flex', alignItems:'center', gap:10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth={2.5}>
            <path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          Purchased Starter Kit
        </div>

        {/* ── date-range filter ── */}
        <div style={{ background:'#fff', borderRadius:12, border:'1.5px solid #ede9fe', padding:'14px 16px',
          marginBottom:16, boxShadow:'0 1px 8px rgba(79,70,229,.05)' }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase',
              letterSpacing:'.4px', marginRight:4 }}>Date Range</span>
            {RANGES.map(r => (
              <button key={r.key} onClick={() => changeRange(r.key)}
                style={{ padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer',
                  border: range===r.key ? 'none' : '1.5px solid #e2e8f0', fontFamily:'inherit',
                  background: range===r.key ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#fff',
                  color: range===r.key ? '#fff' : '#475569' }}>
                {r.label}
              </button>
            ))}

            {range === 'custom' && (
              <div style={{ display:'flex', gap:8, alignItems:'center', marginLeft:4 }}>
                <input type="date" value={start} max={end || undefined}
                  onChange={e => { setStart(e.target.value); setPage(1); }}
                  style={{ padding:'6px 10px', border:'1.5px solid #e2e8f0', borderRadius:7,
                    fontSize:12, fontFamily:'inherit', color:'#1e293b', outline:'none' }}/>
                <span style={{ color:'#94a3b8', fontSize:12 }}>to</span>
                <input type="date" value={end} min={start || undefined}
                  onChange={e => { setEnd(e.target.value); setPage(1); }}
                  style={{ padding:'6px 10px', border:'1.5px solid #e2e8f0', borderRadius:7,
                    fontSize:12, fontFamily:'inherit', color:'#1e293b', outline:'none' }}/>
                {!rangeReady && (
                  <span style={{ fontSize:11, color:'#dc2626', fontWeight:600 }}>Pick both dates</span>
                )}
              </div>
            )}
          </div>

          {/* provider filter */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center', marginTop:12,
            paddingTop:12, borderTop:'1px solid #f1f5f9' }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase',
              letterSpacing:'.4px', marginRight:4 }}>Provider</span>
            {PROVIDERS.map(p => (
              <button key={p.key} onClick={() => changeProvider(p.key)}
                style={{ padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer',
                  border: provider===p.key ? 'none' : '1.5px solid #e2e8f0', fontFamily:'inherit',
                  background: provider===p.key ? 'linear-gradient(135deg,#0891b2,#0e7490)' : '#fff',
                  color: provider===p.key ? '#fff' : '#475569' }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── stat cards ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14, marginBottom:16 }}>
          <StatCard label="Payment Success" value={statsLoading ? '…' : stats.success_count}
            sub={statsLoading ? '' : inr(stats.success_amount) + ' collected'}
            active={status==='success'} color="#16a34a" bg="#f0fdf4"
            onClick={() => changeStatus('success')}/>
          <StatCard label="Add to Cart (Initiated)" value={statsLoading ? '…' : stats.initiated_count}
            sub={statsLoading ? '' : inr(stats.initiated_amount) + ' pending'}
            active={status==='initiated'} color="#d97706" bg="#fffbeb"
            onClick={() => changeStatus('initiated')}/>
        </div>

        {/* ── status tabs (redundant with cards, but explicit) ── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          flexWrap:'wrap', gap:12, marginBottom:14 }}>
          <div style={{ display:'flex', gap:0, border:'1.5px solid #e2e8f0', borderRadius:9, overflow:'hidden', background:'#fff' }}>
            {STATUS_TABS.map(t => (
              <button key={t.key} onClick={() => changeStatus(t.key)}
                title={t.hint}
                style={{ padding:'9px 20px', border:'none', fontSize:12.5, fontWeight:700, cursor:'pointer',
                  fontFamily:'inherit',
                  background: status===t.key ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#fff',
                  color: status===t.key ? '#fff' : '#64748b' }}>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:12.5, color:'#64748b', fontWeight:600 }}>
              Total: <strong style={{ color:'#4f46e5' }}>{total}</strong>
            </span>
            <label style={{ fontSize:12, color:'#64748b', fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
              Per page
              <select value={perPage} onChange={e => changePerPage(Number(e.target.value))}
                style={{ padding:'6px 10px', border:'1.5px solid #e2e8f0', borderRadius:7, fontSize:12,
                  fontFamily:'inherit', color:'#1e293b', cursor:'pointer', outline:'none' }}>
                {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button onClick={downloadExcel} disabled={downloading || !rangeReady}
              style={{ padding:'8px 16px', borderRadius:8, border:'none', fontSize:12, fontWeight:700,
                fontFamily:'inherit', display:'flex', alignItems:'center', gap:6,
                cursor: (downloading || !rangeReady) ? 'not-allowed' : 'pointer',
                background: (downloading || !rangeReady) ? '#cbd5e1' : 'linear-gradient(135deg,#16a34a,#15803d)',
                color:'#fff' }}>
              {downloading ? 'Exporting…' : '⬇ Download Excel'}
            </button>
          </div>
        </div>

        {/* ── table ── */}
        <div style={{ background:'#fff', borderRadius:12, border:'1.5px solid #ede9fe',
          boxShadow:'0 1px 8px rgba(79,70,229,.05)', overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {['#','Name','Email','Mobile','Payment ID','Order ID','Provider','Amount','Status','Paid Date'].map(h => (
                    <th key={h} style={{ color:'#fff', fontSize:11, fontWeight:600, padding:'11px 12px',
                      textAlign:'left', textTransform:'uppercase', letterSpacing:'.3px',
                      borderRight:'1px solid rgba(255,255,255,.15)', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} style={{ textAlign:'center', padding:40 }}>
                    <div style={{ display:'inline-block', width:28, height:28, border:'3px solid #ede9fe',
                      borderTop:'3px solid #4f46e5', borderRadius:'50%', animation:'sk_spin .7s linear infinite' }}/>
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign:'center', color:'#94a3b8', padding:36, fontSize:13 }}>
                    No records found for this filter
                  </td></tr>
                ) : rows.map((r, i) => (
                  <tr key={r.id} className="sk-tr">
                    <td style={tdS}>{(page - 1) * perPage + i + 1}</td>
                    <td style={{ ...tdS, fontWeight:600, color:'#1e293b', minWidth:130 }}>{r.name || '—'}</td>
                    <td style={{ ...tdS, minWidth:170 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <span style={{ fontSize:11.5 }}>{r.email || '—'}</span>
                        {r.email && <button onClick={() => copy(r.email)}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:11, padding:2 }}>⧉</button>}
                      </div>
                    </td>
                    <td style={{ ...tdS, minWidth:110, fontSize:11.5 }}>{r.phone || '—'}</td>
                    <td style={{ ...tdS, fontSize:11, minWidth:120 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <span>{r.payment_id || '—'}</span>
                        {r.payment_id && <button onClick={() => copy(r.payment_id)}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:11, padding:2 }}>⧉</button>}
                      </div>
                    </td>
                    <td style={{ ...tdS, fontSize:11, minWidth:150 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <span>{r.order_id || '—'}</span>
                        {r.order_id && <button onClick={() => copy(r.order_id)}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:11, padding:2 }}>⧉</button>}
                      </div>
                    </td>
                    <td style={{ ...tdS, fontSize:11, textTransform:'capitalize' }}>{r.provider || '—'}</td>
                    <td style={{ ...tdS, fontWeight:700, color:'#1e293b' }}>{inr(r.amount)}</td>
                    <td style={tdS}>
                      <span style={{ padding:'2px 9px', borderRadius:99, fontSize:10.5, fontWeight:700,
                        background: r.status==='success' ? '#dcfce7' : '#fef3c7',
                        color: r.status==='success' ? '#15803d' : '#b45309' }}>
                        {r.status==='success' ? 'Success' : 'Initiated'}
                      </span>
                    </td>
                    <td style={{ ...tdS, fontSize:11, whiteSpace:'nowrap' }}>{r.paid_at || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── pagination ── */}
        {totalPages > 1 && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:6,
            marginTop:14, flexWrap:'wrap' }}>
            <span style={{ fontSize:12, color:'#64748b' }}>
              Page {page} of {totalPages} — showing {rows.length} of {total}
            </span>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <PgBtn disabled={page===1} onClick={() => setPage(1)}>First</PgBtn>
              <PgBtn disabled={page===1} onClick={() => setPage(p => p-1)}>Prev</PgBtn>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pg = page <= 3 ? i + 1 : page - 2 + i;
                if (pg > totalPages) return null;
                return (
                  <button key={pg} className="sk-pg-btn" onClick={() => setPage(pg)}
                    style={{ padding:'5px 12px', border:'1.5px solid #e2e8f0', borderRadius:6,
                      background: pg===page ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#fff',
                      color: pg===page ? '#fff' : '#334155', fontSize:12, cursor:'pointer',
                      fontWeight: pg===page ? 700 : 400, fontFamily:'inherit' }}>{pg}</button>
                );
              })}
              <PgBtn disabled={page===totalPages} onClick={() => setPage(p => p+1)}>Next</PgBtn>
              <PgBtn disabled={page===totalPages} onClick={() => setPage(totalPages)}>Last</PgBtn>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({ label, value, sub, active, color, bg, onClick }) {
  return (
    <div onClick={onClick}
      style={{ background: active ? bg : '#fff', borderRadius:12, padding:'16px 18px', cursor:'pointer',
        border: `2px solid ${active ? color : '#ede9fe'}`, transition:'all .15s',
        boxShadow:'0 1px 8px rgba(79,70,229,.05)' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.4px' }}>
        {label}
      </div>
      <div style={{ fontSize:28, fontWeight:800, color, marginTop:6, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:'#94a3b8', marginTop:6, fontWeight:600 }}>{sub}</div>}
    </div>
  );
}

function PgBtn({ disabled, onClick, children }) {
  return (
    <button className="sk-pg-btn" disabled={disabled} onClick={onClick}
      style={{ padding:'5px 10px', border:'1.5px solid #e2e8f0', borderRadius:6, background:'#fff',
        fontSize:12, cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? '#cbd5e1' : '#334155', fontFamily:'inherit' }}>
      {children}
    </button>
  );
}
