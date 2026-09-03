import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/internship-system/starter_kit_payments.php';
const FH  = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk  = obj => new URLSearchParams(obj);

const tdS = { padding:'9px 12px', borderBottom:'1px solid #f5f3ff', color:'#334155', fontSize:12, verticalAlign:'middle' };

/* status → api value (ninety_nine_store_orders.status enum) */
const STATUS_TABS = [
  { key:'success',   label:'Payment Success', hint:'status = success' },
  { key:'initiated', label:'Add to Cart',     hint:'status = initiated' },
  { key:'failed',    label:'Failed',          hint:'status = failed' },
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

/* every ₹99 store course is priced the same — the add-order form multiplies
   this by the number of courses picked, and the admin can still override it */
const UNIT_PRICE = 99;

/* Reference formats copied from the genuine rows so a hand-added order is not
   obviously different at a glance:
     order_id   skit_1787550062065          (prefix + epoch ms)
     payment_id 6309112827                  (Cashfree — plain numeric)
                pay_S1kQ9dLm2xT4Vb          (Razorpay — pay_ + 14 alnum) */
const genOrderId = () => 'skit_' + Date.now();
const genPaymentId = (provider) => {
  if (provider === 'razorpay') {
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 14; i++) s += A[Math.floor(Math.random() * A.length)];
    return 'pay_' + s;
  }
  return String(Math.floor(1e9 + Math.random() * 9e9)); // 10-digit Cashfree-style id
};

/* <input type="datetime-local"> wants local wall-clock, not an ISO Z string */
const nowLocal = () => {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const COLUMNS = ['#','Name','Email','Mobile','State','Courses','Batch','Payment ID','Order ID','Provider','Amount','Status','Date'];

const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const STATUS_PILL = {
  success:   { label:'Success',   bg:'#dcfce7', color:'#15803d' },
  initiated: { label:'Initiated', bg:'#fef3c7', color:'#b45309' },
  failed:    { label:'Failed',    bg:'#fee2e2', color:'#b91c1c' },
};

/* the API always returns `courses` as an array of {name, slug, price};
   this stays defensive in case an older payload comes back as a raw string */
const courseList = (r) => {
  if (Array.isArray(r.courses) && r.courses.length) return r.courses;
  if (typeof r.courses === 'string' && r.courses.trim()) {
    try {
      const d = JSON.parse(r.courses);
      if (Array.isArray(d)) return d.map(c => (typeof c === 'string' ? { name:c } : c));
    } catch { /* fall through to the single-course shape */ }
  }
  return r.course_name || r.course_slug ? [{ name: r.course_name, slug: r.course_slug }] : [];
};

export default function PurchasedStarterKit() {
  const [status,   setStatus]   = useState('success');
  const [range,    setRange]    = useState('today');
  const [start,    setStart]    = useState('');
  const [end,      setEnd]      = useState('');
  const [provider, setProvider] = useState('all');
  const [downloading, setDownloading] = useState(false);
  const [showAdd,  setShowAdd]  = useState(false);

  const [rows,     setRows]     = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [perPage,  setPerPage]  = useState(20);
  const [loading,  setLoading]  = useState(true);

  const [stats,    setStats]    = useState({
    success_count:0, initiated_count:0, failed_count:0,
    success_amount:0, initiated_amount:0, failed_amount:0,
    success_courses:0, initiated_courses:0, failed_courses:0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  /* search — `q` is the input draft, `committedQ` is what was actually searched */
  const [q,          setQ]          = useState('');
  const [committedQ, setCommittedQ] = useState('');
  const searching = committedQ !== '';

  /* custom range needs both dates before it fires — unless a search is running,
     which spans every date anyway */
  const rangeReady = searching || range !== 'custom' || (start && end);

  /* A search covers ALL dates: looking someone up by email/mobile while the
     page sits on "Today" would otherwise return nothing for an older order. */
  const rangeParams = useCallback(() => {
    if (searching) return { range: 'all', provider, q: committedQ };
    const p = { range, provider };
    if (range === 'custom') { p.start = start; p.end = end; }
    return p;
  }, [searching, committedQ, range, start, end, provider]);

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

  const runSearch   = () => { setCommittedQ(q.trim()); setPage(1); };
  const clearSearch = () => { setQ(''); setCommittedQ(''); setPage(1); };

  const copy = (text) => { if (!text) return; navigator.clipboard.writeText(text); toast.success('Copied!'); };

  /* ── download Excel for the selected date range (+ provider, current status tab).
        Sheet 1 = one row per order, Sheet 2 = one row per course in that order. ── */
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

      const orders = data.map((r, i) => {
        const cs = courseList(r);
        return {
          '#':            i + 1,
          'Name':         r.name    || '',
          'Email':        r.email   || '',
          'Mobile':       r.phone   || r.phone_number || '',
          'State':        r.state   || '',
          'Courses':      cs.map(c => c.name || c.slug).join(', '),
          'Course Count': Number(r.course_count || cs.length || 0),
          'Batch':        r.batch      || '',
          'Payment ID':   r.payment_id || '',
          'Order ID':     r.order_id   || '',
          'Provider':     r.provider   || '',
          'Amount':       Number(r.amount || 0),
          'Status':       r.status  || '',
          'Date':         r.paid_at || '',
        };
      });

      /* course-wise sheet — a buyer with 3 courses becomes 3 rows */
      const courses = [];
      data.forEach((r, i) => {
        courseList(r).forEach(c => {
          courses.push({
            'Order #':     i + 1,
            'Name':        r.name  || '',
            'Email':       r.email || '',
            'Mobile':      r.phone || r.phone_number || '',
            'State':       r.state || '',
            'Course Name': c.name  || '',
            'Course Slug': c.slug  || '',
            'Price':       c.price == null ? '' : Number(c.price),
            'Batch':       r.batch      || '',
            'Order ID':    r.order_id   || '',
            'Payment ID':  r.payment_id || '',
            'Provider':    r.provider   || '',
            'Status':      r.status     || '',
            'Date':        r.paid_at    || '',
          });
        });
      });

      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(orders),  'Orders');
      window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(courses), 'Course-wise');

      const rangeTag = searching ? 'search' : range === 'custom' ? `${start}_to_${end}` : range;
      window.XLSX.writeFile(wb, `starter_kit_${status}_${provider}_${rangeTag}.xlsx`);
      toast.success(`Exported ${orders.length} order(s) / ${courses.length} course(s)`);
    } catch { toast.error('Excel export failed'); }
    finally { setDownloading(false); }
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

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
              <button key={r.key} onClick={() => changeRange(r.key)} disabled={searching}
                title={searching ? 'Clear the search to filter by date again' : undefined}
                style={{ padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:700,
                  cursor: searching ? 'not-allowed' : 'pointer', opacity: searching ? .45 : 1,
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

          {/* ── search by email / mobile — spans every date, so an old order is
                found even while the page sits on "Today" ── */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center', marginTop:12,
            paddingTop:12, borderTop:'1px solid #f1f5f9' }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase',
              letterSpacing:'.4px', marginRight:4 }}>Search</span>

            <div style={{ display:'flex', border:'1.5px solid #e2e8f0', borderRadius:8,
              overflow:'hidden', background:'#fff', width:340, maxWidth:'100%' }}>
              <input value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
                placeholder="Email or mobile number…"
                style={{ border:'none', padding:'7px 12px', fontSize:12.5, flex:1,
                  outline:'none', color:'#1e293b', fontFamily:'inherit' }}/>
              {q && (
                <button onClick={clearSearch} title="Clear"
                  style={{ background:'#f8fafc', color:'#94a3b8', border:'none', padding:'0 10px',
                    cursor:'pointer', fontSize:15, fontFamily:'inherit' }}>×</button>
              )}
              <button onClick={runSearch}
                style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', border:'none',
                  padding:'0 16px', cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit' }}>
                Search
              </button>
            </div>

            {searching && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 11px',
                borderRadius:99, background:'#ede9fe', color:'#6d28d9', fontSize:11.5, fontWeight:700 }}>
                Searching all dates for “{committedQ}”
                <button onClick={clearSearch}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'#6d28d9',
                    fontSize:14, padding:0, lineHeight:1, fontFamily:'inherit' }}>×</button>
              </span>
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

        {/* ── stat cards — count = orders, sub-line also carries courses sold ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14, marginBottom:16 }}>
          <StatCard label="Payment Success" value={statsLoading ? '…' : stats.success_count}
            sub={statsLoading ? '' : `${inr(stats.success_amount)} collected`}
            sub2={statsLoading ? '' : `${stats.success_courses || 0} course(s) sold`}
            active={status==='success'} color="#16a34a" bg="#f0fdf4"
            onClick={() => changeStatus('success')}/>
          <StatCard label="Add to Cart (Initiated)" value={statsLoading ? '…' : stats.initiated_count}
            sub={statsLoading ? '' : `${inr(stats.initiated_amount)} pending`}
            sub2={statsLoading ? '' : `${stats.initiated_courses || 0} course(s) in cart`}
            active={status==='initiated'} color="#d97706" bg="#fffbeb"
            onClick={() => changeStatus('initiated')}/>
          <StatCard label="Failed" value={statsLoading ? '…' : stats.failed_count}
            sub={statsLoading ? '' : `${inr(stats.failed_amount)} lost`}
            sub2={statsLoading ? '' : `${stats.failed_courses || 0} course(s)`}
            active={status==='failed'} color="#dc2626" bg="#fef2f2"
            onClick={() => changeStatus('failed')}/>
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
            <button onClick={() => setShowAdd(true)}
              style={{ padding:'8px 16px', borderRadius:8, border:'none', fontSize:12, fontWeight:700,
                fontFamily:'inherit', display:'flex', alignItems:'center', gap:6, cursor:'pointer',
                background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff' }}>
              ＋ Add Order
            </button>
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
                  {COLUMNS.map(h => (
                    <th key={h} style={{ color:'#fff', fontSize:11, fontWeight:600, padding:'11px 12px',
                      textAlign:'left', textTransform:'uppercase', letterSpacing:'.3px',
                      borderRight:'1px solid rgba(255,255,255,.15)', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={COLUMNS.length} style={{ textAlign:'center', padding:40 }}>
                    <div style={{ display:'inline-block', width:28, height:28, border:'3px solid #ede9fe',
                      borderTop:'3px solid #4f46e5', borderRadius:'50%', animation:'sk_spin .7s linear infinite' }}/>
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={COLUMNS.length} style={{ textAlign:'center', color:'#94a3b8', padding:36, fontSize:13 }}>
                    {searching ? (
                      <>
                        No <strong>{STATUS_TABS.find(t => t.key === status)?.label}</strong> order for “{committedQ}”.
                        <div style={{ fontSize:12, marginTop:4 }}>Check the other tabs above — the counts show where it landed.</div>
                      </>
                    ) : 'No records found for this filter'}
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
                    <td style={{ ...tdS, minWidth:110, fontSize:11.5 }}>{r.phone || r.phone_number || '—'}</td>
                    <td style={{ ...tdS, fontSize:11.5, minWidth:100 }}>{r.state || '—'}</td>
                    <td style={{ ...tdS, minWidth:230 }}><CoursesCell row={r}/></td>
                    <td style={{ ...tdS, fontSize:11.5, whiteSpace:'nowrap' }}>{r.batch || '—'}</td>
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
                      {(() => {
                        const p = STATUS_PILL[r.status] || { label: r.status || '—', bg:'#f1f5f9', color:'#475569' };
                        return (
                          <span style={{ padding:'2px 9px', borderRadius:99, fontSize:10.5, fontWeight:700,
                            background:p.bg, color:p.color }}>{p.label}</span>
                        );
                      })()}
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

        {showAdd && (
          <AddOrderModal
            onClose={() => setShowAdd(false)}
            onCreated={() => { setShowAdd(false); setPage(1); fetchStats(); fetchList(); }}
          />
        )}
      </div>
    </>
  );
}

/* ───────────────────────── Add Order popup ─────────────────────────
   An admin-entered ₹99 store purchase. The email is the key: it pre-fills the
   name and phone from the learner's account (falling back to their own last
   store order), and it is what the LMS matches a purchase on later.
   order_id / payment_id are minted here, the amount defaults to ₹99 per
   course, and the picked date-time is written to BOTH created_at and
   updated_at so the row lands in the range being reconciled. */
function AddOrderModal({ onClose, onCreated }) {
  const [email,     setEmail]     = useState('');
  const [first,     setFirst]     = useState('');
  const [last,      setLast]      = useState('');
  const [phone,     setPhone]     = useState('');
  const [picked,    setPicked]    = useState([]);          // course slugs
  const [amount,    setAmount]    = useState(String(UNIT_PRICE));
  const [amtTouched, setAmtTouched] = useState(false);
  const [status,    setStatus]    = useState('success');
  const [prov,      setProv]      = useState('cashfree');
  const [orderId,   setOrderId]   = useState(genOrderId);
  const [payId,     setPayId]     = useState(() => genPaymentId('cashfree'));
  const [when,      setWhen]      = useState(nowLocal);

  const [courses,  setCourses]  = useState([]);
  const [cLoading, setCLoading] = useState(true);
  const [looking,  setLooking]  = useState(false);
  const [lookMsg,  setLookMsg]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');

  /* the catalogue comes from the store's own orders, so it stays right even
     if a fifth course is added later */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.post(API, mk({ action:'fetch_courses' }), FH);
        if (alive && res.data.status === 'success') setCourses(res.data.data.courses || []);
      } catch { /* the form still works — the list just stays empty */ }
      finally { if (alive) setCLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  /* ₹99 × courses until the admin types their own figure */
  useEffect(() => {
    if (!amtTouched) setAmount(String(picked.length * UNIT_PRICE || UNIT_PRICE));
  }, [picked, amtTouched]);

  /* a Razorpay id looks nothing like a Cashfree one — re-mint on switch */
  const changeProvider = (p) => { setProv(p); setPayId(genPaymentId(p)); };

  const toggleCourse = (slug) =>
    setPicked(p => p.includes(slug) ? p.filter(s => s !== slug) : [...p, slug]);

  const lookup = async () => {
    const e = email.trim().toLowerCase();
    if (!e) { setLookMsg(''); return; }
    setLooking(true); setLookMsg('');
    try {
      const res = await api.post(API, mk({ action:'lookup_email', email:e }), FH);
      if (res.data.status !== 'success') { setLookMsg(res.data.message || 'Lookup failed'); return; }
      const d = res.data.data;
      if (!d.found) { setLookMsg('No account or past order for this email — type the details manually'); return; }
      if (d.first_name) setFirst(d.first_name);
      if (d.last_name)  setLast(d.last_name);
      if (d.phone)      setPhone(d.phone);
      setLookMsg(
        (d.from === 'account' ? 'Filled from their account' : 'Filled from their last store order')
        + (d.orders ? ` · ${d.orders} existing order(s)` : '')
      );
    } catch (ex) { setLookMsg(ex?.response?.data?.message || 'Lookup failed'); }
    finally { setLooking(false); }
  };

  const submit = async () => {
    const e = email.trim().toLowerCase();
    const digits = phone.replace(/\D/g, '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return setErr('Enter a valid email address');
    if (!first.trim())      return setErr('First name is required');
    if (!last.trim())       return setErr('Last name is required');
    if (digits.length < 10) return setErr('Enter a valid phone number (at least 10 digits)');
    if (!picked.length)     return setErr('Select at least one course');
    if (!(Number(amount) > 0)) return setErr('Enter a valid amount');
    if (!orderId.trim())    return setErr('Order ID is required');
    if (!payId.trim())      return setErr('Payment ID is required');
    if (!when)              return setErr('Pick the purchase date & time');
    setErr('');

    const cart = picked.map(slug => {
      const c = courses.find(x => x.slug === slug) || { slug, name: slug };
      return { slug: c.slug, name: c.name, price: UNIT_PRICE };
    });

    setSaving(true);
    try {
      const res = await api.post(API, mk({
        action:'create_order',
        email: e,
        first_name: first.trim(),
        last_name:  last.trim(),
        phone,
        courses: JSON.stringify(cart),
        amount,
        status,
        provider: prov,
        order_id: orderId.trim(),
        payment_id: payId.trim(),
        created_at: when,
      }), FH);
      if (res.data.status === 'success') {
        toast.success(res.data.message || 'Order added');
        onCreated();
      } else {
        setErr(res.data.message || 'Could not add the order');
      }
    } catch (ex) {
      setErr(ex?.response?.data?.message || 'Could not add the order');
    } finally { setSaving(false); }
  };

  return (
    <div onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.45)', zIndex:1000,
        display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'40px 16px', overflowY:'auto' }}>
      <div onClick={ev => ev.stopPropagation()}
        style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:680,
          boxShadow:'0 20px 60px rgba(15,23,42,.25)', overflow:'hidden' }}>

        {/* header */}
        <div style={{ padding:'16px 20px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
          display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ color:'#fff', fontSize:15, fontWeight:800 }}>Add Starter Kit Order</div>
          <button onClick={onClose}
            style={{ background:'rgba(255,255,255,.18)', border:'none', color:'#fff', width:26, height:26,
              borderRadius:7, cursor:'pointer', fontSize:14, lineHeight:1, fontFamily:'inherit' }}>✕</button>
        </div>

        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>

          {/* email + lookup */}
          <Field label="Email" required
            hint={lookMsg || 'The name and phone are pulled from this email'}
            hintColor={lookMsg && !lookMsg.startsWith('Filled') ? '#b45309' : '#16a34a'}>
            <div style={{ display:'flex', gap:8 }}>
              <input type="email" value={email} autoFocus
                onChange={ev => { setEmail(ev.target.value); setLookMsg(''); }}
                onBlur={lookup}
                placeholder="student@gmail.com" style={inpS}/>
              <button onClick={lookup} disabled={looking || !email.trim()}
                style={{ padding:'0 16px', borderRadius:8, border:'none', fontSize:12, fontWeight:700,
                  fontFamily:'inherit', whiteSpace:'nowrap',
                  cursor: (looking || !email.trim()) ? 'not-allowed' : 'pointer',
                  background: (looking || !email.trim()) ? '#cbd5e1' : 'linear-gradient(135deg,#0891b2,#0e7490)',
                  color:'#fff' }}>
                {looking ? 'Fetching…' : 'Fetch'}
              </button>
            </div>
          </Field>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="First Name" required>
              <input value={first} onChange={ev => setFirst(ev.target.value)} placeholder="First name" style={inpS}/>
            </Field>
            <Field label="Last Name" required>
              <input value={last} onChange={ev => setLast(ev.target.value)} placeholder="Last name" style={inpS}/>
            </Field>
          </div>

          <Field label="Mobile Number" required>
            <input value={phone} onChange={ev => setPhone(ev.target.value)} placeholder="9876543210" style={inpS}/>
          </Field>

          {/* courses */}
          <Field label={`Courses (₹${UNIT_PRICE} each)`} required
            hint={picked.length ? `${picked.length} course(s) selected` : 'Pick one or more'}>
            {cLoading ? (
              <div style={{ fontSize:12, color:'#94a3b8' }}>Loading courses…</div>
            ) : !courses.length ? (
              <div style={{ fontSize:12, color:'#b45309' }}>No courses found in the store</div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:8 }}>
                {courses.map(c => {
                  const on = picked.includes(c.slug);
                  return (
                    <label key={c.slug}
                      style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:9,
                        cursor:'pointer', fontSize:12, fontWeight:600,
                        border: `1.5px solid ${on ? '#4f46e5' : '#e2e8f0'}`,
                        background: on ? '#f5f3ff' : '#fff', color: on ? '#4338ca' : '#334155' }}>
                      <input type="checkbox" checked={on} onChange={() => toggleCourse(c.slug)}
                        style={{ accentColor:'#4f46e5', width:15, height:15, cursor:'pointer' }}/>
                      <span style={{ lineHeight:1.3 }}>
                        {c.name}
                        <span style={{ display:'block', fontSize:10.5, color:'#94a3b8', fontWeight:500 }}>{c.slug}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </Field>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <Field label="Amount (₹)" required hint={amtTouched ? 'Edited by hand' : 'Auto: ₹99 × courses'}>
              <input type="number" min="1" step="1" value={amount}
                onChange={ev => { setAmount(ev.target.value); setAmtTouched(true); }} style={inpS}/>
            </Field>
            <Field label="Status" required>
              <select value={status} onChange={ev => setStatus(ev.target.value)} style={inpS}>
                <option value="success">Success</option>
                <option value="initiated">Add to Cart (Initiated)</option>
                <option value="failed">Failed</option>
              </select>
            </Field>
            <Field label="Provider" required>
              <select value={prov} onChange={ev => changeProvider(ev.target.value)} style={inpS}>
                <option value="cashfree">Cashfree</option>
                <option value="razorpay">Razorpay</option>
              </select>
            </Field>
          </div>

          {/* generated references */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Order ID" required hint="Auto-generated">
              <div style={{ display:'flex', gap:6 }}>
                <input value={orderId} onChange={ev => setOrderId(ev.target.value)} style={inpS}/>
                <RegenBtn onClick={() => setOrderId(genOrderId())}/>
              </div>
            </Field>
            <Field label="Payment ID" required hint="Auto-generated">
              <div style={{ display:'flex', gap:6 }}>
                <input value={payId} onChange={ev => setPayId(ev.target.value)} style={inpS}/>
                <RegenBtn onClick={() => setPayId(genPaymentId(prov))}/>
              </div>
            </Field>
          </div>

          <Field label="Purchase Date & Time" required
            hint="Written to both created_at and updated_at — not the current time">
            <input type="datetime-local" value={when} onChange={ev => setWhen(ev.target.value)} style={inpS}/>
          </Field>

          {err && (
            <div style={{ background:'#fef2f2', border:'1.5px solid #fecaca', color:'#b91c1c',
              borderRadius:9, padding:'9px 12px', fontSize:12, fontWeight:600 }}>{err}</div>
          )}
        </div>

        {/* footer */}
        <div style={{ padding:'14px 20px', borderTop:'1px solid #f1f5f9', display:'flex',
          justifyContent:'flex-end', gap:10, background:'#fafafa' }}>
          <button onClick={onClose} disabled={saving}
            style={{ padding:'9px 18px', borderRadius:8, border:'1.5px solid #e2e8f0', background:'#fff',
              fontSize:12.5, fontWeight:700, color:'#475569', fontFamily:'inherit',
              cursor: saving ? 'not-allowed' : 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={saving}
            style={{ padding:'9px 22px', borderRadius:8, border:'none', fontSize:12.5, fontWeight:700,
              fontFamily:'inherit', color:'#fff', cursor: saving ? 'not-allowed' : 'pointer',
              background: saving ? '#cbd5e1' : 'linear-gradient(135deg,#16a34a,#15803d)' }}>
            {saving ? 'Saving…' : 'Add Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inpS = {
  width:'100%', padding:'9px 11px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:12.5,
  fontFamily:'inherit', color:'#1e293b', outline:'none', background:'#fff',
};

function Field({ label, required, hint, hintColor, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <label style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.4px' }}>
        {label}{required && <span style={{ color:'#dc2626', marginLeft:3 }}>*</span>}
      </label>
      {children}
      {hint && <span style={{ fontSize:10.5, color: hintColor || '#94a3b8', fontWeight:600 }}>{hint}</span>}
    </div>
  );
}

function RegenBtn({ onClick }) {
  return (
    <button onClick={onClick} title="Generate a new one"
      style={{ padding:'0 12px', border:'1.5px solid #e2e8f0', borderRadius:8, background:'#fff',
        cursor:'pointer', fontSize:13, color:'#4f46e5', fontFamily:'inherit' }}>↻</button>
  );
}

/* One order can hold several courses — show the first one and fold the rest
   behind "+N More..", which expands the full list in place. */
function CoursesCell({ row }) {
  const [open, setOpen] = useState(false);
  const list = courseList(row);

  if (!list.length) return <span style={{ color:'#94a3b8' }}>—</span>;

  const shown  = open ? list : list.slice(0, 1);
  const hidden = list.length - shown.length;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
      {shown.map((c, i) => (
        <div key={(c.slug || c.name || '') + i} style={{ fontSize:11.5, color:'#334155', lineHeight:1.35 }}>
          {open && <span style={{ color:'#c4b5fd', marginRight:4 }}>•</span>}
          {c.name || c.slug || '—'}
          {c.price != null && c.price !== '' && (
            <span style={{ color:'#94a3b8', marginLeft:5 }}>{inr(c.price)}</span>
          )}
        </div>
      ))}
      {hidden > 0 && (
        <button onClick={() => setOpen(true)}
          style={{ alignSelf:'flex-start', background:'none', border:'none', padding:0, cursor:'pointer',
            fontSize:11, fontWeight:700, color:'#4f46e5', fontFamily:'inherit' }}>
          +{hidden} More..
        </button>
      )}
      {open && list.length > 1 && (
        <button onClick={() => setOpen(false)}
          style={{ alignSelf:'flex-start', background:'none', border:'none', padding:0, cursor:'pointer',
            fontSize:11, fontWeight:700, color:'#94a3b8', fontFamily:'inherit' }}>
          show less
        </button>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, sub2, active, color, bg, onClick }) {
  return (
    <div onClick={onClick}
      style={{ background: active ? bg : '#fff', borderRadius:12, padding:'16px 18px', cursor:'pointer',
        border: `2px solid ${active ? color : '#ede9fe'}`, transition:'all .15s',
        boxShadow:'0 1px 8px rgba(79,70,229,.05)' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.4px' }}>
        {label}
      </div>
      <div style={{ fontSize:28, fontWeight:800, color, marginTop:6, lineHeight:1 }}>{value}</div>
      {sub  && <div style={{ fontSize:12, color:'#94a3b8', marginTop:6, fontWeight:600 }}>{sub}</div>}
      {sub2 && <div style={{ fontSize:11, color:'#cbd5e1', marginTop:2, fontWeight:600 }}>{sub2}</div>}
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
