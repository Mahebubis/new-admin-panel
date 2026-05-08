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
  search: 'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
  x: 'M18 6 6 18M6 6l12 12',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  lock: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4',
  login: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 0-2 2h-4M10 17l5-5-5-5M15 12H3',
  copy: 'M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-4-4H8zM14 2v6h6',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  check: 'M20 6 9 17l-5-5',
  chevronL: 'M15 18l-6-6 6-6',
  chevronR: 'M9 18l6-6-6-6',
  google: 'M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 1 1 0-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0 0 12.545 3C7.021 3 2.543 7.477 2.543 13s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z',
  power: 'M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
};

const GoogleIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const LIMIT = 20;

export default function AllStudents() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [registered, setRegistered] = useState(0);
  const [page, setPage] = useState(1);
  const [searchMode, setSearchMode] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const navigate = useNavigate();
  const jumpRef = useRef(null);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  /* ── fetch ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/students/list.php', { params: { page, per_page: LIMIT } });
      if (res.data.success) {
        setData(res.data.data.students || []);
        setTotal(res.data.data.total || 0);
        setRegistered(res.data.data.registered || 0);
        setSearchMode(false);
      }
    } catch { } finally { setLoading(false); }
  }, [page]);

  const fetchSearch = async (kw) => {
    if (!kw.trim()) { fetchData(); return; }
    setLoading(true);
    try {
      const res = await api.get('/api/students/list.php', { params: { search: kw } });
      if (res.data.success) {
        setData(res.data.data.students || []);
        setSearchMode(true);
      }
    } catch { } finally { setLoading(false); }
  };

  // useEffect(() => { if (!searchMode) fetchData(); }, [fetchData]);
  const hasFetched = useRef(false);
  useEffect(() => {
    if (!searchMode) fetchData();
    hasFetched.current = true;
  }, [page]); // depend on page only, not fetchData

  /* ── actions ── */
  const deleteStudent = async (id) => { if (!confirm('Delete this student? This cannot be undone.')) return; setLoading(true); try { await api.post('/api/students/action.php', { action: 'delete', user_id: id }); setData(p => p.filter(s => s.user_id != id)); toast.success('Student deleted'); } catch { toast.error('Something went wrong'); } finally { setLoading(false); } };
  const deactivateStudent = async (id) => { if (!confirm('Deactivate this user?')) return; try { await api.post('/api/students/action.php', { action: 'deactivate', user_id: id }); toast.success('User deactivated'); fetchData(); } catch { } };
  const activateStudent = async (id) => { if (!confirm('Activate this user?')) return; try { await api.post('/api/students/action.php', { action: 'activate', user_id: id }); toast.success('User activated'); fetchData(); } catch { } };
  const changePassword = async (id) => { if (!confirm("Change this user's password?")) return; try { await api.post('/api/students/action.php', { action: 'change_password', user_id: id }); toast.success('Password changed'); } catch { } };
  const copyToClipboard = (txt) => { navigator.clipboard.writeText(txt); toast.success('Copied!'); };
  const jumpToPage = () => { const v = parseInt(jumpRef.current?.value); if (v >= 1 && v <= totalPages) setPage(v); else toast.error('Invalid page number'); };

  /* ── upload ── */
  const uploadRef = useRef(null);
  const handleUpload = () => {
    const file = uploadRef.current?.files?.[0];
    if (!file) { toast.error('Please select a file'); return; }
    const fd = new FormData();
    fd.append('file', file); fd.append('action', 'upload_student_file');
    api.post('/api/students/upload.php', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(() => { toast.success('Upload successful'); setShowUpload(false); fetchData(); })
      .catch(() => toast.error('Upload failed'));
  };

  /* ── page range ── */
  const pageNums = (() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3) return [1, 2, 3, 4, 5];
    if (page >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [page - 2, page - 1, page, page + 1, page + 2];
  })();

  return (
    <>
    <Helmet>
        <title>All Students | Admin Panel</title>
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .as-root { font-family: 'Plus Jakarta Sans', sans-serif; height: 100vh; display: flex; flex-direction: column; background: #f1f5f9; overflow: hidden; }
        .as-header { flex-shrink: 0; background: #fff; border-bottom: 1.5px solid #e2e8f0; padding: 10px 20px; display: flex; align-items: center; gap: 16px; }
        .as-title { font-size: 15px; font-weight: 700; color: #1e293b; letter-spacing: -0.3px; white-space: nowrap; }
        .as-stat { display: flex; flex-direction: column; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 12px; min-width: 140px; }
        .as-stat-label { font-size: 9.5px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .as-stat-val { font-size: 14px; font-weight: 700; color: #1e293b; }
        .as-stat-val.blue  { color: #4f46e5; }
        .as-stat-val.green { color: #10b981; }
        .as-stat-val.amber { color: #f59e0b; }
        .as-search { display: flex; align-items: center; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; overflow: hidden; flex: 1; max-width: 280px; }
        .as-search input { flex: 1; border: none; background: transparent; padding: 6px 10px; font-size: 12.5px; font-family: inherit; outline: none; color: #1e293b; }
        .as-search input::placeholder { color: #94a3b8; }
        .as-search button { background: none; border: none; cursor: pointer; padding: 0 8px; color: #94a3b8; display: flex; align-items: center; transition: color .15s; }
        .as-search button:hover { color: #4f46e5; }
        .as-btn-import { display: flex; align-items: center; gap: 6px; background: #4f46e5; color: #fff; border: none; border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; white-space: nowrap; transition: background .15s; }
        .as-btn-import:hover { background: #4338ca; }
        .as-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; padding: 12px 20px 0; gap: 0; }
        .as-card { flex: 1; overflow: hidden; display: flex; flex-direction: column; background: #fff; border-radius: 12px; border: 1.5px solid #e2e8f0; box-shadow: 0 1px 8px rgba(0,0,0,0.04); }
        .as-table-wrap { flex: 1; overflow: auto; }
        .as-table-wrap::-webkit-scrollbar { width: 5px; height: 5px; }
        .as-table-wrap::-webkit-scrollbar-track { background: #f1f5f9; }
        .as-table-wrap::-webkit-scrollbar-thumb { background: #c7d2fe; border-radius: 10px; }
        table.as-t { width: 100%; border-collapse: collapse; table-layout: fixed; }
        table.as-t thead tr { background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); }
        table.as-t thead th { color: #fff; font-size: 10.5px; font-weight: 600; padding: 10px 8px; white-space: nowrap; text-align: left; letter-spacing: 0.4px; text-transform: uppercase; border-right: 1px solid rgba(255,255,255,0.18); overflow: hidden; text-overflow: ellipsis; }
        table.as-t thead th:last-child { border-right: none; }
        table.as-t tbody tr { border-bottom: 1px solid #f1f5f9; transition: background .12s; }
        table.as-t tbody tr:hover { background: #f5f3ff; }
        table.as-t tbody tr:last-child { border-bottom: none; }
        table.as-t td { font-size: 12px; color: #334155; padding: 8px 8px; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-right: 1px solid #f1f5f9; }
        table.as-t td:last-child { border-right: none; }
        .as-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 20px; font-size: 10.5px; font-weight: 600; white-space: nowrap; }
        .badge-active   { background: #d1fae5; color: #065f46; }
        .badge-inactive { background: #fee2e2; color: #991b1b; }
        .badge-google-yes { background: #fff3e0; color: #b45309; border: 1px solid #fed7aa; }
        .badge-google-no  { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
        .badge-yes { background: #ede9fe; color: #5b21b6; }
        .badge-no  { background: #f1f5f9; color: #94a3b8; }
        .as-action-btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; transition: opacity .15s, transform .1s; white-space: nowrap; }
        .as-action-btn:hover { opacity: .85; transform: translateY(-1px); }
        .as-action-cell { display: flex; gap: 5px; flex-wrap: nowrap; align-items: center; }
        .btn-edit    { background: #e0f2fe; color: #0369a1; }
        .btn-deact   { background: #fef3c7; color: #92400e; }
        .btn-act     { background: #d1fae5; color: #065f46; }
        .btn-del     { background: #fee2e2; color: #991b1b; }
        .btn-login   { background: #ede9fe; color: #5b21b6; }
        .btn-pwd     { background: #f1f5f9; color: #475569; }
        .copy-btn { background: none; border: none; cursor: pointer; color: #c7d2fe; padding: 0 2px; transition: color .15s; }
        .copy-btn:hover { color: #4f46e5; }
        .as-footer { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; border-top: 1.5px solid #f1f5f9; background: #fafafa; border-radius: 0 0 12px 12px; }
        .as-page-info { font-size: 11px; color: #94a3b8; }
        .as-pagination { display: flex; align-items: center; gap: 3px; }
        .pg-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 26px; padding: 0 6px; border: 1.5px solid #e2e8f0; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; background: #fff; color: #475569; font-family: inherit; transition: all .15s; }
        .pg-btn:hover:not(:disabled) { border-color: #4f46e5; color: #4f46e5; }
        .pg-btn.active { background: #4f46e5; border-color: #4f46e5; color: #fff; }
        .pg-btn:disabled { opacity: .35; cursor: not-allowed; }
        .pg-jump { display: flex; align-items: center; gap: 4px; }
        .pg-jump input { width: 60px; border: 1.5px solid #e2e8f0; border-radius: 6px; padding: 3px 6px; font-size: 11px; font-family: inherit; outline: none; text-align: center; color: #1e293b; }
        .pg-jump input:focus { border-color: #4f46e5; }
        .pg-jump button { background: #4f46e5; color: #fff; border: none; border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .loader { position: fixed; inset: 0; background: rgba(241,245,249,0.75); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(2px); }
        .spinner { width: 36px; height: 36px; border: 3px solid #e0e7ff; border-top-color: #4f46e5; border-radius: 50%; animation: spin .7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.45); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(3px); }
        .modal-box { background: #fff; border-radius: 14px; width: 100%; max-width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); overflow: hidden; }
        .modal-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1.5px solid #f1f5f9; }
        .modal-head h5 { font-size: 13px; font-weight: 700; color: #1e293b; }
        .modal-close { background: none; border: none; cursor: pointer; color: #94a3b8; transition: color .15s; display: flex; align-items: center; }
        .modal-close:hover { color: #1e293b; }
        .modal-body { padding: 18px; }
        .modal-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1.5px solid #f1f5f9; }
        .modal-foot button { padding: 7px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; transition: opacity .15s; }
        .modal-foot button:hover { opacity: .85; }
        .no-data { text-align: center; padding: 40px; color: #cbd5e1; font-size: 13px; }
        .col-id    { width: 70px; }
        .col-name  { width: 140px; }
        .col-email { width: 200px; }
        .col-phone { width: 130px; }
        .col-state { width: 110px; }
        .col-ctry  { width: 90px; }
        .col-reg   { width: 140px; }
        .col-stat  { width: 100px; }
        .col-act   { width: 230px; }
        .col-adm   { width: 200px; }
      `}</style>

      {loading && (
        <div className="loader">
          <div className="spinner" />
        </div>
      )}

      <div className="as-root">
        {/* ── HEADER ── */}
        <div className="as-header">
          <span className="as-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: -2 }}>
              <path d={Icons.users} />
            </svg>
            All Students
          </span>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="as-stat">
              <span className="as-stat-label">Total</span>
              <span className="as-stat-val blue">{total.toLocaleString()}</span>
            </div>
            <div className="as-stat">
              <span className="as-stat-label">Registered</span>
              <span className="as-stat-val green">{registered.toLocaleString()}</span>
            </div>
            <div className="as-stat">
              <span className="as-stat-label">Unregistered</span>
              <span className="as-stat-val amber">{(total - registered).toLocaleString()}</span>
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {/* Search */}
          <div className="as-search">
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

          {/* Import */}
          <button className="as-btn-import" onClick={() => setShowUpload(true)}>
            <Icon d={Icons.upload} size={13} />
            Import CSV
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="as-body" style={{ paddingBottom: 12 }}>
          <div className="as-card">
            <div className="as-table-wrap">
              <table className="as-t">
                <colgroup>
                  <col className="col-id" /><col className="col-name" /><col className="col-email" />
                  <col className="col-phone" /><col className="col-state" /><col className="col-ctry" />
                  <col className="col-reg" /><col className="col-stat" />
                  <col className="col-act" /><col className="col-adm" />
                </colgroup>
                <thead>
                  <tr>
                    {['ID', 'Name', 'Email', 'Mobile', 'State', 'Country', 'Registered At', 'Status', 'Actions', 'Admin'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!loading && data.length === 0 && (
                    <tr><td colSpan={10} className="no-data">
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
                          <button className="copy-btn" onClick={() => copyToClipboard(el.email)} title="Copy email">
                            <Icon d={Icons.copy} size={11} />
                          </button>
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {el.phone}
                          <button className="copy-btn" onClick={() => copyToClipboard(el.phone)} title="Copy phone">
                            <Icon d={Icons.copy} size={11} />
                          </button>
                        </span>
                      </td>
                      <td>{el.state}</td>
                      <td>{el.country}</td>
                      <td style={{ color: '#64748b', fontSize: 11 }}>{el.registered_at}</td>
                      <td>
                        <span className={`as-badge ${el.active == 1 ? 'badge-active' : 'badge-inactive'}`}>
                          <svg width="6" height="6" viewBox="0 0 6 6" style={{ flexShrink: 0 }}>
                            <circle cx="3" cy="3" r="3" fill="currentColor" />
                          </svg>
                          {el.active == 1 ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="as-action-cell">
                          <button className="as-action-btn btn-edit" onClick={() => navigate(`/students/edit/${el.user_id}`)} title="Edit student">
                            <Icon d={Icons.edit} size={11} /> Edit
                          </button>
                          <button
                            className={`as-action-btn ${el.active == 1 ? 'btn-deact' : 'btn-act'}`}
                            onClick={() => el.active == 1 ? deactivateStudent(el.user_id) : activateStudent(el.user_id)}
                            title={el.active == 1 ? 'Deactivate student' : 'Activate student'}>
                            <Icon d={Icons.power} size={11} />
                            {el.active == 1 ? 'Deactivate' : 'Activate'}
                          </button>
                          <button className="as-action-btn btn-del" onClick={() => deleteStudent(el.user_id)} title="Delete student">
                            <Icon d={Icons.trash} size={11} /> Delete
                          </button>
                        </div>
                      </td>
                      <td>
                        <div className="as-action-cell">
                          <a href={`https://dashboard.internshipstudio.com/login?risky_login=${el.user_id}`}
                            target="_blank" rel="noopener"
                            className="as-action-btn btn-login" style={{ textDecoration: 'none' }}
                            title="Log in as student">
                            <Icon d={Icons.login} size={11} /> Log In
                          </a>
                          <button className="as-action-btn btn-pwd" onClick={() => changePassword(el.user_id)} title="Change password">
                            <Icon d={Icons.lock} size={11} /> Password
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
              <div className="as-footer">
                <span className="as-page-info">
                  Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                  &nbsp;&middot;&nbsp;{total.toLocaleString()} total records
                </span>

                <div className="as-pagination">
                  <button className="pg-btn" onClick={() => setPage(1)} disabled={page <= 1} title="First">«</button>
                  <button className="pg-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} title="Prev">‹</button>
                  {pageNums.map(p => (
                    <button key={p} className={`pg-btn${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                  ))}
                  <button className="pg-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} title="Next">›</button>
                  <button className="pg-btn" onClick={() => setPage(totalPages)} disabled={page >= totalPages} title="Last">»</button>
                </div>

                <div className="pg-jump">
                  <input ref={jumpRef} type="number" min={1} max={totalPages} placeholder="Page"
                    onKeyDown={e => e.key === 'Enter' && jumpToPage()} />
                  <button onClick={jumpToPage}>Go</button>
                </div>
              </div>
            )}
            {searchMode && (
              <div className="as-footer">
                <span className="as-page-info">Showing <strong>{data.length}</strong> search results</span>
                <button className="as-action-btn btn-act" onClick={() => { setSearchInput(''); setSearchMode(false); fetchData(); }}>
                  Clear search
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── UPLOAD MODAL ── */}
      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h5>
                <Icon d={Icons.upload} size={13} color="#4f46e5" style={{ marginRight: 6, verticalAlign: -2 }} />
                Import Bulk Student Data
              </h5>
              <button className="modal-close" onClick={() => setShowUpload(false)}>
                <Icon d={Icons.x} size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                Upload a CSV file to bulk-import students.{' '}
                <a href="https://docs.google.com/spreadsheets/d/1mqydzF0C-O9in4qnZPP4N_tURLQUfYi0ESuNVlUAie4/edit?usp=sharing"
                  target="_blank" rel="noopener" style={{ color: '#4f46e5', fontWeight: 600 }}>
                  Download CSV template
                </a>
              </p>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Select CSV File
              </label>
              <input ref={uploadRef} type="file" accept=".csv"
                style={{ width: '100%', fontSize: 12, border: '1.5px dashed #c7d2fe', borderRadius: 8, padding: '10px 12px', background: '#f8f7ff', cursor: 'pointer' }} />
            </div>
            <div className="modal-foot">
              <button onClick={() => setShowUpload(false)} style={{ background: '#f1f5f9', color: '#475569' }}>Cancel</button>
              <button onClick={handleUpload} style={{ background: '#4f46e5', color: '#fff' }}>
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}