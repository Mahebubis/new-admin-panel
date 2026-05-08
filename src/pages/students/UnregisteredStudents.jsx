import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Helmet } from "react-helmet-async";

export default function UnregisteredStudents() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registered, setRegistered] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/students/unregistered.php', { params: { per_page: 500 } });
      if (res.data.success) setData(res.data.data.students || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const registerStudent = async (userId) => {
    try {
      await api.post('/api/students/register.php', { user_id: userId });
      toast.success('Student registered successfully');
      setRegistered(prev => ({ ...prev, [userId]: true }));
    } catch { toast.error('Something went wrong'); }
  };

  return (
    <>
    <Helmet>
        <title>Unregistered Students | Admin Panel</title>
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .unreg-wrap { font-family: 'Plus Jakarta Sans', sans-serif; padding: 20px; background: #f1f5f9; min-height: 100vh; }
        .unreg-card { background: #fff; border-radius: 12px; border: 1.5px solid #e2e8f0; box-shadow: 0 2px 12px rgba(0,0,0,0.05); overflow: hidden; }
        .unreg-card-header { padding: 14px 20px; border-bottom: 1.5px solid #e2e8f0; display: flex; align-items: center; gap: 8px; }
        .unreg-card-title { font-size: 14px; font-weight: 700; color: #1e293b; }
        .unreg-count { background: #ede9fe; color: #5b21b6; font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 20px; }
        table.unreg-t { width: 100%; border-collapse: collapse; table-layout: fixed; }
        table.unreg-t thead tr { background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); }
        table.unreg-t thead th {
          color: #fff; font-size: 11.5px; font-weight: 600; padding: 11px 16px;
          text-align: left; letter-spacing: 0.3px; text-transform: uppercase;
          border-right: 1px solid rgba(255,255,255,0.15);
        }
        table.unreg-t thead th:last-child { border-right: none; text-align: center; }
        table.unreg-t tbody tr { border-bottom: 1px solid #f1f5f9; transition: background .12s; }
        table.unreg-t tbody tr:last-child { border-bottom: none; }
        table.unreg-t tbody tr:hover { background: #f5f3ff; }
        table.unreg-t td {
          font-size: 13px; color: #334155; padding: 11px 16px;
          vertical-align: middle;
          border-right: 1px solid #f1f5f9;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        table.unreg-t td:last-child { border-right: none; text-align: center; }
        .col-sno    { width: 60px; }
        .col-name   { width: 220px; }
        .col-email  { width: auto; }
        .col-date   { width: 160px; }
        .col-action { width: 120px; }
        .reg-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 14px; font-size: 11.5px; font-weight: 600; border-radius: 6px; border: none; cursor: pointer; font-family: inherit; transition: all .15s; background: #4f46e5; color: #fff; }
        .reg-btn:hover:not(:disabled) { background: #4338ca; transform: translateY(-1px); box-shadow: 0 3px 8px rgba(79,70,229,0.3); }
        .reg-btn:disabled { background: #d1fae5; color: #065f46; cursor: default; }
        .no-data { text-align: center; padding: 48px; color: #94a3b8; font-size: 13px; }
        .sno-cell { color: #94a3b8; font-weight: 600; font-size: 12px; }
        .name-cell { font-weight: 600; color: #1e293b; }
        .email-cell { color: #4f46e5; }
        .date-cell { color: #64748b; font-size: 12px; }
        .loader { position: fixed; inset: 0; background: rgba(241,245,249,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(2px); }
        .spinner { width: 34px; height: 34px; border: 3px solid #e0e7ff; border-top-color: #4f46e5; border-radius: 50%; animation: spin .7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {loading && (
        <div className="loader"><div className="spinner" /></div>
      )}

      <div className="unreg-wrap">
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', textAlign: 'center', marginBottom: 4 }}>
            Unregistered Students
          </p>
          <hr style={{ borderColor: '#e2e8f0' }} />
        </div>

        <div className="unreg-card">
          <div className="unreg-card-header">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
            </svg>
            <span className="unreg-card-title">Unregistered Students</span>
            {!loading && <span className="unreg-count">{data.length} pending</span>}
          </div>

          <table className="unreg-t">
            <colgroup>
              <col className="col-sno" />
              <col className="col-name" />
              <col className="col-email" />
              <col className="col-date" />
              <col className="col-action" />
            </colgroup>
            <thead>
              <tr>
                <th>#</th>
                <th>Student Name</th>
                <th>Email Address</th>
                <th>Registered At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {!loading && data.length === 0 && (
                <tr>
                  <td colSpan={5} className="no-data">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }}>
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                    </svg>
                    All students are registered
                  </td>
                </tr>
              )}
              {data.map((student, idx) => (
                <tr key={student.user_id}>
                  <td className="sno-cell">{idx + 1}</td>
                  <td className="name-cell">{student.name}</td>
                  <td className="email-cell">{student.email}</td>
                  <td className="date-cell">{student.registered_at}</td>
                  <td>
                    <button
                      className="reg-btn"
                      onClick={() => registerStudent(student.user_id)}
                      disabled={!!registered[student.user_id]}>
                      {registered[student.user_id]
                        ? <>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                            Done
                          </>
                        : <>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6" /></svg>
                            Register
                          </>
                      }
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}