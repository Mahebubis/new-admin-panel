import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Helmet } from "react-helmet-async";

/* ─── tiny icon helpers (inline SVGs, no extra deps) ─── */
const Icon = ({ d, size = 14, color = 'currentColor', ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d={d} />
  </svg>
);
const Icons = {
  search:   'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
  x:        'M18 6 6 18M6 6l12 12',
  edit:     'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  trash:    'M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  lock:     'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4',
  login:    'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 0-2 2h-4M10 17l5-5-5-5M15 12H3',
  copy:     'M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-4-4H8zM14 2v6h6',
  users:    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  power:    'M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10',
  chevronL: 'M15 18l-6-6 6-6',
  chevronR: 'M9 18l6-6-6-6',
};

const GoogleIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const LIMIT = 20;

const pageCache = new Map();

export default function IITStudents() {
  const [data,        setData]        = useState([]);
  const [total,       setTotal]       = useState(0);
  const [registered,  setRegistered]  = useState(0);
  const [page,        setPage]        = useState(1);
  const [searchMode,  setSearchMode]  = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [loading,     setLoading]     = useState(true);
  const navigate = useNavigate();
  const jumpRef  = useRef(null);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  /* ── fetch ── */
  const fetchData = useCallback(async () => {
    const cached = pageCache.get(page);
    if (cached) {
      setData(cached.students);
      setTotal(cached.total);
      setRegistered(cached.registered);
      setSearchMode(false);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const res = await api.get('/api/students/iit-list.php', { params: { page, per_page: LIMIT } });
      if (res.data.success) {
        const d = res.data.data;
        setData(d.students || []);
        setTotal(d.total || 0);
        setRegistered(d.registered || 0);
        setSearchMode(false);
        pageCache.set(page, { students: d.students || [], total: d.total || 0, registered: d.registered || 0 });
      }
    } catch {} finally { setLoading(false); }
  }, [page]);

  const fetchSearch = async (kw) => {
    if (!kw.trim()) { fetchData(); return; }
    setLoading(true);
    try {
      const res = await api.get('/api/students/iit-list.php', { params: { search: kw } });
      if (res.data.success) {
        setData(res.data.data.students || []);
        setSearchMode(true);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { if (!searchMode) fetchData(); }, [fetchData]);

  /* ── actions ── */
  const deleteStudent     = async (id) => { if (!confirm('Delete this student? This cannot be undone.')) return; setLoading(true); try { await api.post('/api/students/action.php', { action: 'delete', user_id: id }); setData(p => p.filter(s => s.user_id != id)); pageCache.clear(); toast.success('Student deleted'); } catch { toast.error('Something went wrong'); } finally { setLoading(false); } };
  const deactivateStudent = async (id) => { if (!confirm('Deactivate this user?')) return; try { await api.post('/api/students/action.php', { action: 'deactivate', user_id: id }); pageCache.clear(); toast.success('User deactivated'); fetchData(); } catch {} };
  const activateStudent   = async (id) => { if (!confirm('Activate this user?'))   return; try { await api.post('/api/students/action.php', { action: 'activate',   user_id: id }); pageCache.clear(); toast.success('User activated');   fetchData(); } catch {} };
  const changePassword    = async (id) => { if (!confirm("Change this user's password?")) return; try { await api.post('/api/students/action.php', { action: 'change_password', user_id: id }); toast.success('Password changed'); } catch {} };
  const copyToClipboard   = (txt) => { navigator.clipboard.writeText(txt); toast.success('Copied!'); };
  const jumpToPage        = () => { const v = parseInt(jumpRef.current?.value); if (v >= 1 && v <= totalPages) setPage(v); else toast.error('Invalid page number'); };

  /* ── page range ── */
  const pageNums = (() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3)              return [1,2,3,4,5];
    if (page >= totalPages - 2) return [totalPages-4,totalPages-3,totalPages-2,totalPages-1,totalPages];
    return [page-2,page-1,page,page+1,page+2];
  })();

  return (
    <>
    <Helmet>
        <title>IIT Students | Admin Panel</title>
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .iit-root { font-family: 'Plus Jakarta Sans', sans-serif; height: 100vh; display: flex; flex-direction: column; background: #f1f5f9; overflow: hidden; }
        .iit-header { flex-shrink: 0; background: #fff; border-bottom: 1.5px solid #e2e8f0; padding: 10px 20px; display: flex; align-items: center; gap: 16px; }
        .iit-title { font-size: 15px; font-weight: 700; color: #1e293b; letter-spacing: -0.3px; white-space: nowrap; }
        .iit-stat { display: flex; flex-direction: column; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 12px; min-width: 140px; }
        .iit-stat-label { font-size: 9.5px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .iit-stat-val { font-size: 14px; font-weight: 700; color: #1e293b; }
        .iit-stat-val.blue  { color: #4f46e5; }
        .iit-stat-val.green { color: #10b981; }
        .iit-stat-val.amber { color: #f59e0b; }
        .iit-search { display: flex; align-items: center; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; overflow: hidden; flex: 1; max-width: 280px; }
        .iit-search input { flex: 1; border: none; background: transparent; padding: 6px 10px; font-size: 12.5px; font-family: inherit; outline: none; color: #1e293b; }
        .iit-search input::placeholder { color: #94a3b8; }
        .iit-search button { background: none; border: none; cursor: pointer; padding: 0 8px; color: #94a3b8; display: flex; align-items: center; transition: color .15s; }
        .iit-search button:hover { color: #4f46e5; }
        .iit-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; padding: 12px 20px 0; gap: 0; }
        .iit-card { flex: 1; overflow: hidden; display: flex; flex-direction: column; background: #fff; border-radius: 12px; border: 1.5px solid #e2e8f0; box-shadow: 0 1px 8px rgba(0,0,0,0.04); }
        .iit-table-wrap { flex: 1; overflow: auto; }
        .iit-table-wrap::-webkit-scrollbar { width: 5px; height: 5px; }
        .iit-table-wrap::-webkit-scrollbar-track { background: #f1f5f9; }
        .iit-table-wrap::-webkit-scrollbar-thumb { background: #c7d2fe; border-radius: 10px; }
        table.iit-t { width: 100%; border-collapse: collapse; table-layout: fixed; }
        table.iit-t thead tr { background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); }
        table.iit-t thead th { color: #fff; font-size: 10.5px; font-weight: 600; padding: 10px 8px; white-space: nowrap; text-align: left; letter-spacing: 0.4px; text-transform: uppercase; border: none; overflow: hidden; text-overflow: ellipsis; }
        table.iit-t thead th:first-child { border-radius: 0; }
        table.iit-t tbody tr { border-bottom: 1px solid #f1f5f9; transition: background .12s; }
        table.iit-t tbody tr:hover { background: #f5f3ff; }
        table.iit-t tbody tr:last-child { border-bottom: none; }
        table.iit-t td { font-size: 12px; color: #334155; padding: 8px 8px; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .iit-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 20px; font-size: 10.5px; font-weight: 600; white-space: nowrap; }
        .iit-badge-active   { background: #d1fae5; color: #065f46; }
        .iit-badge-inactive { background: #fee2e2; color: #991b1b; }
        .iit-badge-google-yes { background: #fff3e0; color: #b45309; border: 1px solid #fed7aa; }
        .iit-badge-google-no  { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
        .iit-badge-yes { background: #ede9fe; color: #5b21b6; }
        .iit-badge-no  { background: #f1f5f9; color: #94a3b8; }
        .iit-action-btn { display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; border-radius: 5px; font-size: 10.5px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; transition: opacity .15s, transform .1s; white-space: nowrap; }
        .iit-action-btn:hover { opacity: .85; transform: translateY(-1px); }
        .iit-btn-edit    { background: #e0f2fe; color: #0369a1; }
        .iit-btn-deact   { background: #fef3c7; color: #92400e; }
        .iit-btn-act     { background: #d1fae5; color: #065f46; }
        .iit-btn-del     { background: #fee2e2; color: #991b1b; }
        .iit-btn-login   { background: #ede9fe; color: #5b21b6; }
        .iit-btn-pwd     { background: #f1f5f9; color: #475569; }
        .iit-copy-btn { background: none; border: none; cursor: pointer; color: #c7d2fe; padding: 0 2px; transition: color .15s; }
        .iit-copy-btn:hover { color: #4f46e5; }
        .iit-footer { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; border-top: 1.5px solid #f1f5f9; background: #fafafa; border-radius: 0 0 12px 12px; }
        .iit-page-info { font-size: 11px; color: #94a3b8; }
        .iit-pagination { display: flex; align-items: center; gap: 3px; }
        .iit-pg-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 26px; padding: 0 6px; border: 1.5px solid #e2e8f0; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; background: #fff; color: #475569; font-family: inherit; transition: all .15s; }
        .iit-pg-btn:hover:not(:disabled) { border-color: #4f46e5; color: #4f46e5; }
        .iit-pg-btn.active { background: #4f46e5; border-color: #4f46e5; color: #fff; }
        .iit-pg-btn:disabled { opacity: .35; cursor: not-allowed; }
        .iit-pg-jump { display: flex; align-items: center; gap: 4px; }
        .iit-pg-jump input { width: 60px; border: 1.5px solid #e2e8f0; border-radius: 6px; padding: 3px 6px; font-size: 11px; font-family: inherit; outline: none; text-align: center; color: #1e293b; }
        .iit-pg-jump input:focus { border-color: #4f46e5; }
        .iit-pg-jump button { background: #4f46e5; color: #fff; border: none; border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .iit-loader { position: fixed; inset: 0; background: rgba(241,245,249,0.75); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(2px); }
        .iit-spinner { width: 36px; height: 36px; border: 3px solid #e0e7ff; border-top-color: #4f46e5; border-radius: 50%; animation: iit-spin .7s linear infinite; }
        @keyframes iit-spin { to { transform: rotate(360deg); } }
        .iit-no-data { text-align: center; padding: 40px; color: #cbd5e1; font-size: 13px; }
        .iit-col-id      { width: 70px; }
        .iit-col-name    { width: 130px; }
        .iit-col-email   { width: 180px; }
        .iit-col-phone   { width: 120px; }
        .iit-col-college { width: 150px; }
        .iit-col-state   { width: 100px; }
        .iit-col-ctry    { width: 70px; }
        .iit-col-reg     { width: 120px; }
        .iit-col-iexam   { width: 70px; }
        .iit-col-ires    { width: 70px; }
        .iit-col-apply   { width: 65px; }
        .iit-col-gg      { width: 80px; }
        .iit-col-stat    { width: 90px; }
        .iit-col-act     { width: 165px; }
        .iit-col-adm     { width: 175px; }
      `}</style>

      {loading && (
        <div className="iit-loader">
          <div className="iit-spinner" />
        </div>
      )}

      <div className="iit-root">
        {/* ── HEADER ── */}
        <div className="iit-header">
          <span className="iit-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: -2 }}>
              <path d={Icons.users} />
            </svg>
            IIT Students
          </span>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="iit-stat">
              <span className="iit-stat-label">Total</span>
              <span className="iit-stat-val blue">{total.toLocaleString()}</span>
            </div>
            <div className="iit-stat">
              <span className="iit-stat-label">Registered</span>
              <span className="iit-stat-val green">{registered.toLocaleString()}</span>
            </div>
            <div className="iit-stat">
              <span className="iit-stat-label">Unregistered</span>
              <span className="iit-stat-val amber">{(total - registered).toLocaleString()}</span>
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {/* Search */}
          <div className="iit-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8, flexShrink: 0 }}>
              <path d={Icons.search} />
            </svg>
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchSearch(searchInput)}
              placeholder="Search by name, email, phone, ID…"
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); setSearchMode(false); fetchData(); }} title="Clear">
                <Icon d={Icons.x} size={12} />
              </button>
            )}
            <button onClick={() => fetchSearch(searchInput)} title="Search" style={{ paddingRight: 8 }}>
              <Icon d={Icons.search} size={13} />
            </button>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="iit-body" style={{ paddingBottom: 12 }}>
          <div className="iit-card">
            <div className="iit-table-wrap">
              <table className="iit-t">
                <colgroup>
                  <col className="iit-col-id" /><col className="iit-col-name" /><col className="iit-col-email" />
                  <col className="iit-col-phone" /><col className="iit-col-college" /><col className="iit-col-state" />
                  <col className="iit-col-ctry" /><col className="iit-col-reg" /><col className="iit-col-iexam" />
                  <col className="iit-col-ires" /><col className="iit-col-apply" /><col className="iit-col-gg" />
                  <col className="iit-col-stat" /><col className="iit-col-act" /><col className="iit-col-adm" />
                </colgroup>
                <thead>
                  <tr>
                    {['ID','Name','Email','Mobile','College','State','Country','Registered At','I-Exam','I-Result','Applied','Google','Status','Actions','Admin'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!loading && data.length === 0 && (
                    <tr><td colSpan={15} className="iit-no-data">
                      <Icon d={Icons.users} size={28} color="#e2e8f0" /><br />No records found
                    </td></tr>
                  )}
                  {data.map(el => (
                    <tr key={el.user_id}>
                      <td style={{ color: '#94a3b8', fontWeight: 600 }}>{el.user_id}</td>
                      <td style={{ fontWeight: 600, color: '#1e293b' }}>{el.name}</td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{el.email}</span>
                          <button className="iit-copy-btn" onClick={() => copyToClipboard(el.email)} title="Copy email">
                            <Icon d={Icons.copy} size={11} />
                          </button>
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {el.phone}
                          <button className="iit-copy-btn" onClick={() => copyToClipboard(el.phone)} title="Copy phone">
                            <Icon d={Icons.copy} size={11} />
                          </button>
                        </span>
                      </td>
                      <td style={{ color: '#6366f1', fontWeight: 600, fontSize: 11 }}>{el.college_name}</td>
                      <td>{el.state}</td>
                      <td>{el.country}</td>
                      <td style={{ color: '#64748b', fontSize: 11 }}>{el.registered_at}</td>
                      <td>
                        <span className={`iit-badge ${el.instant_exam === 'on' ? 'iit-badge-yes' : 'iit-badge-no'}`}>
                          {el.instant_exam === 'on' ? 'ON' : 'OFF'}
                        </span>
                      </td>
                      <td>
                        <span className={`iit-badge ${el.instant_result === 'on' ? 'iit-badge-yes' : 'iit-badge-no'}`}>
                          {el.instant_result === 'on' ? 'ON' : 'OFF'}
                        </span>
                      </td>
                      <td>
                        <span className={`iit-badge ${el.applyforexam == 1 ? 'iit-badge-yes' : 'iit-badge-no'}`}>
                          {el.applyforexam == 1 ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td>
                        {el.is_signup_by_google == 1
                          ? <span className="iit-badge iit-badge-google-yes"><GoogleIcon /> Google</span>
                          : <span className="iit-badge iit-badge-google-no">Manual</span>
                        }
                      </td>
                      <td>
                        <span className={`iit-badge ${el.active == 1 ? 'iit-badge-active' : 'iit-badge-inactive'}`}>
                          <svg width="6" height="6" viewBox="0 0 6 6" style={{ flexShrink: 0 }}>
                            <circle cx="3" cy="3" r="3" fill="currentColor" />
                          </svg>
                          {el.active == 1 ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 3 }}>
                          <button className="iit-action-btn iit-btn-edit" onClick={() => navigate(`/students/edit/${el.user_id}`)}>
                            <Icon d={Icons.edit} size={10} /> Edit
                          </button>
                          <button
                            className={`iit-action-btn ${el.active == 1 ? 'iit-btn-deact' : 'iit-btn-act'}`}
                            onClick={() => el.active == 1 ? deactivateStudent(el.user_id) : activateStudent(el.user_id)}>
                            <Icon d={Icons.power} size={10} />
                            {el.active == 1 ? 'Deactivate' : 'Activate'}
                          </button>
                          <button className="iit-action-btn iit-btn-del" onClick={() => deleteStudent(el.user_id)}>
                            <Icon d={Icons.trash} size={10} /> Del
                          </button>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 3 }}>
                          <a href={`https://dashboard.internshipstudio.com/login?risky_login=${el.user_id}`}
                            target="_blank" rel="noopener"
                            className="iit-action-btn iit-btn-login" style={{ textDecoration: 'none' }}>
                            <Icon d={Icons.login} size={10} /> Log In
                          </a>
                          <button className="iit-action-btn iit-btn-pwd" onClick={() => changePassword(el.user_id)}>
                            <Icon d={Icons.lock} size={10} /> Pwd
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── FOOTER / PAGINATION ── */}
            {!searchMode && (
              <div className="iit-footer">
                <span className="iit-page-info">
                  Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                  &nbsp;&middot;&nbsp;{total.toLocaleString()} total records
                </span>

                <div className="iit-pagination">
                  <button className="iit-pg-btn" onClick={() => setPage(1)} disabled={page <= 1} title="First">«</button>
                  <button className="iit-pg-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} title="Prev">‹</button>
                  {pageNums.map(p => (
                    <button key={p} className={`iit-pg-btn${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                  ))}
                  <button className="iit-pg-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} title="Next">›</button>
                  <button className="iit-pg-btn" onClick={() => setPage(totalPages)} disabled={page >= totalPages} title="Last">»</button>
                </div>

                <div className="iit-pg-jump">
                  <input ref={jumpRef} type="number" min={1} max={totalPages} placeholder="Page"
                    onKeyDown={e => e.key === 'Enter' && jumpToPage()} />
                  <button onClick={jumpToPage}>Go</button>
                </div>
              </div>
            )}
            {searchMode && (
              <div className="iit-footer">
                <span className="iit-page-info">Showing <strong>{data.length}</strong> search results</span>
                <button className="iit-action-btn iit-btn-act" onClick={() => { setSearchInput(''); setSearchMode(false); fetchData(); }}>
                  Clear search
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
