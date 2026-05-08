import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const LIMIT = 15;

const STATUS_STYLE = {
  pending:  { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', dot: '#fb923c', label: 'Pending' },
  approved: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#22c55e', label: 'Approved' },
  rejected: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', dot: '#ef4444', label: 'Rejected' },
};

function Avatar({ name, photo }) {
  const initials = name?.charAt(0)?.toUpperCase() || '?';
  if (photo) return <img src={photo} alt={name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid #ede9fe' }} />;
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0, border: '2px solid #ede9fe' }}>
      {initials}
    </div>
  );
}

function AnswerTooltip({ answer1, answer2, children }) {
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const handleEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX });
    }
    setShow(true);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={ref}
      onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div style={{
          position: 'fixed', zIndex: 9999,
          top: pos.top, left: pos.left,
          background: '#1e293b', color: '#f8fafc',
          borderRadius: 10, padding: '12px 14px',
          width: 280, boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
          fontSize: 11.5, lineHeight: 1.6, pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#a5b4fc', marginBottom: 8 }}>Referral Answers</div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Question 1</div>
            <div style={{ color: '#e2e8f0' }}>{answer1 || <em style={{ color: '#475569' }}>No answer provided</em>}</div>
          </div>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Question 2</div>
            <div style={{ color: '#e2e8f0' }}>{answer2 || <em style={{ color: '#475569' }}>No answer provided</em>}</div>
          </div>
          {/* arrow */}
          <div style={{ position: 'absolute', top: -6, left: 18, width: 12, height: 12, background: '#1e293b', transform: 'rotate(45deg)', borderRadius: 2 }} />
        </div>
      )}
    </div>
  );
}

export default function ReferralList() {
  const [data,        setData]        = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status,      setStatus]      = useState('');
  const [fromDate,    setFromDate]    = useState('');
  const [toDate,      setToDate]      = useState('');
  const [loading,     setLoading]     = useState(true);
  const [updating,    setUpdating]    = useState({});
  const jumpRef = useRef(null);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/referrals/list.php', {
        params: { page, per_page: LIMIT, search, status, from_date: fromDate, to_date: toDate }
      });
      if (res.data.success) {
        setData(res.data.data.referrals || []);
        setTotal(res.data.data.total || 0);
      }
    } catch {} finally { setLoading(false); }
  }, [page, search, status, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatus = async (id, newStatus) => {
    setUpdating(prev => ({ ...prev, [id]: newStatus }));
    try {
      await api.post('/api/referrals/update-status.php', { user_id: id, status: newStatus });
      toast.success(`Referral ${newStatus} successfully`);
      // real-time update row — no re-fetch needed
      setData(prev => prev.map(r =>
        (r.user_id === id || r.referral_id === id) ? { ...r, status: newStatus } : r
      ));
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(prev => { const n = { ...prev }; delete n[id]; return n; });
    }
  };

  const handleClear = () => {
    setSearchInput(''); setSearch(''); setStatus('');
    setFromDate(''); setToDate(''); setPage(1);
  };

  const applySearch = () => { setSearch(searchInput); setPage(1); };

  const jumpToPage = () => {
    const v = parseInt(jumpRef.current?.value);
    if (v >= 1 && v <= totalPages) setPage(v);
    else toast.error('Invalid page number');
  };

  const pageNums = (() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3)               return [1,2,3,4,5];
    if (page >= totalPages - 2)  return [totalPages-4,totalPages-3,totalPages-2,totalPages-1,totalPages];
    return [page-2,page-1,page,page+1,page+2];
  })();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

        .rf-root  { font-family: 'Plus Jakarta Sans', sans-serif; height: 100vh; display: flex; flex-direction: column; background: #f5f3ff; overflow: hidden; }

        /* header */
        .rf-header { flex-shrink: 0; background: #fff; border-bottom: 1.5px solid #ede9fe; padding: 10px 20px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .rf-title  { font-size: 15px; font-weight: 700; color: #1e293b; white-space: nowrap; display: flex; align-items: center; gap: 8px; }
        .rf-total  { background: #ede9fe; color: #5b21b6; font-size: 10.5px; font-weight: 700; padding: 2px 9px; border-radius: 20px; }

        /* filter inputs */
        .rf-input  { border: 1.5px solid #e2e8f0; border-radius: 7px; padding: 5px 10px; font-size: 11.5px; font-family: inherit; color: #1e293b; outline: none; background: #faf9ff; }
        .rf-input:focus { border-color: #7c3aed; background: #fff; }
        .rf-select { border: 1.5px solid #e2e8f0; border-radius: 7px; padding: 5px 10px; font-size: 11.5px; font-family: inherit; color: #1e293b; outline: none; background: #faf9ff; cursor: pointer; }
        .rf-select:focus { border-color: #7c3aed; }
        .rf-date-sep { font-size: 11px; color: #94a3b8; font-weight: 600; }

        .rf-btn-search { display: flex; align-items: center; gap: 5px; background: #4f46e5; color: #fff; border: none; border-radius: 7px; padding: 6px 14px; font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background .15s; }
        .rf-btn-search:hover { background: #4338ca; }
        .rf-btn-clear  { display: flex; align-items: center; gap: 5px; background: #f1f5f9; color: #475569; border: none; border-radius: 7px; padding: 6px 12px; font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background .15s; }
        .rf-btn-clear:hover { background: #e2e8f0; }

        /* body */
        .rf-body  { flex: 1; overflow: hidden; display: flex; flex-direction: column; padding: 12px 20px 12px; }
        .rf-card  { flex: 1; overflow: hidden; display: flex; flex-direction: column; background: #fff; border-radius: 12px; border: 1.5px solid #ede9fe; box-shadow: 0 1px 8px rgba(79,70,229,0.06); }
        .rf-table-wrap { flex: 1; overflow: auto; }
        .rf-table-wrap::-webkit-scrollbar { width: 5px; height: 5px; }
        .rf-table-wrap::-webkit-scrollbar-track { background: #f5f3ff; }
        .rf-table-wrap::-webkit-scrollbar-thumb { background: #c4b5fd; border-radius: 10px; }

        /* table */
        table.rf-t { width: 100%; border-collapse: collapse; table-layout: fixed; }
        table.rf-t thead tr { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); }
        table.rf-t thead th { color: #fff; font-size: 10.5px; font-weight: 600; padding: 10px 12px; white-space: nowrap; text-align: left; letter-spacing: 0.4px; text-transform: uppercase; border-right: 1px solid rgba(255,255,255,0.18); overflow: hidden; text-overflow: ellipsis; }
        table.rf-t thead th:last-child { border-right: none; }
        table.rf-t tbody tr { border-bottom: 1px solid #f5f3ff; transition: background .12s; }
        table.rf-t tbody tr:hover { background: #faf9ff; }
        table.rf-t tbody tr:last-child { border-bottom: none; }
        table.rf-t td { font-size: 12px; color: #334155; padding: 9px 12px; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-right: 1px solid #f5f3ff; }
        table.rf-t td:last-child { border-right: none; }

        /* col widths */
        .c-uid  { width: 80px; }
        .c-prof { width: 200px; }
        .c-mail { width: 200px; }
        .c-stat { width: 105px; }
        .c-ans  { width: 120px; }
        .c-act  { width: 155px; }
        .c-date { width: 145px; }

        /* status badge */
        .st-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 20px; font-size: 10.5px; font-weight: 600; border-width: 1px; border-style: solid; white-space: nowrap; }

        /* answer tooltip btn */
        .ans-btn { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; border: 1.5px dashed #c4b5fd; background: #faf9ff; color: #5b21b6; transition: all .15s; font-family: inherit; }
        .ans-btn:hover { background: #ede9fe; border-color: #7c3aed; }

        /* action btns */
        .act-approve { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; font-size: 10.5px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; background: #dcfce7; color: #15803d; transition: all .15s; }
        .act-approve:hover:not(:disabled) { background: #16a34a; color: #fff; }
        .act-reject  { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; font-size: 10.5px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; background: #fee2e2; color: #b91c1c; transition: all .15s; }
        .act-reject:hover:not(:disabled)  { background: #dc2626; color: #fff; }
        .act-approve:disabled, .act-reject:disabled { opacity: .5; cursor: not-allowed; }

        /* footer */
        .rf-footer { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; border-top: 1.5px solid #f5f3ff; background: #faf9ff; border-radius: 0 0 12px 12px; }
        .rf-page-info { font-size: 11px; color: #94a3b8; }
        .rf-pagination { display: flex; align-items: center; gap: 3px; }
        .pg-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 26px; padding: 0 6px; border: 1.5px solid #e2e8f0; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; background: #fff; color: #475569; font-family: inherit; transition: all .15s; }
        .pg-btn:hover:not(:disabled) { border-color: #4f46e5; color: #4f46e5; }
        .pg-btn.active { background: #4f46e5; border-color: #4f46e5; color: #fff; }
        .pg-btn:disabled { opacity: .35; cursor: not-allowed; }
        .pg-jump { display: flex; align-items: center; gap: 4px; }
        .pg-jump input { width: 60px; border: 1.5px solid #e2e8f0; border-radius: 6px; padding: 3px 6px; font-size: 11px; font-family: inherit; outline: none; text-align: center; color: #1e293b; }
        .pg-jump input:focus { border-color: #4f46e5; }
        .pg-jump button { background: #4f46e5; color: #fff; border: none; border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; }

        /* loader */
        .rf-loader  { position: fixed; inset: 0; background: rgba(245,243,255,0.75); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(2px); }
        .rf-spinner { width: 36px; height: 36px; border: 3px solid #ede9fe; border-top-color: #4f46e5; border-radius: 50%; animation: rfspin .7s linear infinite; }
        @keyframes rfspin { to { transform: rotate(360deg); } }
        .no-data { text-align: center; padding: 40px; color: #94a3b8; font-size: 13px; }

        /* spinning mini loader for updating */
        .mini-spin { width: 12px; height: 12px; border: 2px solid #e0e7ff; border-top-color: #4f46e5; border-radius: 50%; animation: rfspin .5s linear infinite; display: inline-block; }
      `}</style>

      {loading && <div className="rf-loader"><div className="rf-spinner" /></div>}

      <div className="rf-root">

        {/* ── HEADER ── */}
        <div className="rf-header">
          <div className="rf-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
            </svg>
            Referral Requests
            {!loading && <span className="rf-total">{total.toLocaleString()}</span>}
          </div>

          {/* search */}
          <input className="rf-input" style={{ width: 180 }} value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applySearch()}
            placeholder="Search name / email" />

          {/* status filter */}
          <select className="rf-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* date range */}
          <input type="date" className="rf-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          <span className="rf-date-sep">to</span>
          <input type="date" className="rf-input" value={toDate} onChange={e => setToDate(e.target.value)} />

          <button className="rf-btn-search" onClick={applySearch}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            Search
          </button>
          <button className="rf-btn-clear" onClick={handleClear}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            Clear
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="rf-body">
          <div className="rf-card">
            <div className="rf-table-wrap">
              <table className="rf-t">
                <colgroup>
                  <col className="c-uid" /><col className="c-prof" /><col className="c-mail" />
                  <col className="c-stat" /><col className="c-ans" /><col className="c-act" />
                  <col className="c-date" />
                </colgroup>
                <thead>
                  <tr>
                    {['User ID','Profile','Email','Status','Answers','Action','Requested At'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!loading && data.length === 0 && (
                    <tr><td colSpan={7} className="no-data">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 8px' }}>
                        <path d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                      </svg>
                      No referrals found
                    </td></tr>
                  )}
                  {data.map(row => {
                    const id    = row.user_id || row.referral_id;
                    const badge = STATUS_STYLE[row.status] || STATUS_STYLE.pending;
                    const busy  = updating[id];

                    return (
                      <tr key={id}>
                        <td style={{ color: '#94a3b8', fontWeight: 600 }}>{id}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <Avatar name={row.referrer_name} photo={row.photo} />
                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.referrer_name}</div>
                              <div style={{ fontSize: 10.5, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.referrer_email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: '#4f46e5' }}>{row.referrer_email}</td>
                        <td>
                          <span className="st-badge" style={{ background: badge.bg, color: badge.color, borderColor: badge.border }}>
                            <svg width="6" height="6" viewBox="0 0 6 6"><circle cx="3" cy="3" r="3" fill={badge.dot} /></svg>
                            {badge.label}
                          </span>
                        </td>
                        <td>
                          <AnswerTooltip answer1={row.answer1} answer2={row.answer2}>
                            <button className="ans-btn">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
                              </svg>
                              See Answers
                            </button>
                          </AnswerTooltip>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button className="act-approve"
                              disabled={!!busy || row.status === 'approved'}
                              onClick={() => handleStatus(id, 'approved')}>
                              {busy === 'approved'
                                ? <span className="mini-spin" />
                                : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                              }
                              Approve
                            </button>
                            <button className="act-reject"
                              disabled={!!busy || row.status === 'rejected'}
                              onClick={() => handleStatus(id, 'rejected')}>
                              {busy === 'rejected'
                                ? <span className="mini-spin" style={{ borderTopColor: '#dc2626' }} />
                                : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                              }
                              Reject
                            </button>
                          </div>
                        </td>
                        <td style={{ color: '#64748b', fontSize: 11 }}>{row.joined_at}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── FOOTER ── */}
            <div className="rf-footer">
              <span className="rf-page-info">
                Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                &nbsp;&middot;&nbsp;{total.toLocaleString()} total referrals
              </span>
              <div className="rf-pagination">
                <button className="pg-btn" onClick={() => setPage(1)} disabled={page <= 1}>«</button>
                <button className="pg-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>‹</button>
                {pageNums.map(p => (
                  <button key={p} className={`pg-btn${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                ))}
                <button className="pg-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>›</button>
                <button className="pg-btn" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>»</button>
              </div>
              <div className="pg-jump">
                <input ref={jumpRef} type="number" min={1} max={totalPages} placeholder="Page"
                  onKeyDown={e => e.key === 'Enter' && jumpToPage()} />
                <button onClick={jumpToPage}>Go</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}