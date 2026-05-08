import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Helmet } from "react-helmet-async";

const TYPE_PILLS = [
  { label: 'All', value: '', cls: 'bg-indigo-600 text-white' },
  { label: 'Normal Login', value: 'normal_login', cls: 'bg-blue-100 text-blue-800' },
  { label: 'Google Login', value: 'google_login', cls: 'bg-pink-100 text-pink-800' },
  { label: 'Apple Login', value: 'apple_login', cls: 'bg-gray-100 text-gray-700' },
  { label: 'Normal Register', value: 'normal_register', cls: 'bg-green-100 text-green-800' },
  { label: 'Google Register', value: 'google_register', cls: 'bg-yellow-100 text-yellow-800' },
  { label: 'Apple Register', value: 'apple_register', cls: 'bg-purple-100 text-purple-800' },
];

const TYPE_BADGE = {
  normal_login: { bg: '#dbeafe', color: '#1d4ed8' },
  google_login: { bg: '#fce7f3', color: '#be185d' },
  apple_login: { bg: '#f1f5f9', color: '#334155' },
  normal_register: { bg: '#dcfce7', color: '#15803d' },
  google_register: { bg: '#fef9c3', color: '#854d0e' },
  apple_register: { bg: '#ede9fe', color: '#6d28d9' },
};

export default function StudentsWithIP() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [ipFilter, setIpFilter] = useState('');
  const [uidFilter, setUidFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, per_page: perPage };
      if (ipFilter) params.ip = ipFilter;
      if (uidFilter) params.uid = uidFilter;
      if (typeFilter) params.type = typeFilter;
      const res = await api.get('/api/students/ip-log.php', { params });
      if (res.data.success) { setData(res.data.data.rows || []); setTotal(res.data.data.total || 0); }
    } catch {} finally { setLoading(false); }
  }, [page, perPage, ipFilter, uidFilter, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.ceil(total / perPage) || 1;
  const startRow = (page - 1) * perPage + 1;
  const endRow = Math.min(page * perPage, total);

  const copyIP = (ip) => { navigator.clipboard.writeText(ip); toast.success('IP copied'); };

  return (
    <>
    <Helmet>
        <title>Students With IP | Admin Panel</title>
      </Helmet>
    <div className="animate-fade-in">
      <h4 className="text-lg font-bold text-gray-800 mb-3">Students With IP</h4>

      {/* Type pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {TYPE_PILLS.map(pill => (
          <button key={pill.value} onClick={() => { setTypeFilter(pill.value); setPage(1); }}
            className={`px-3 py-1 text-[11px] font-semibold rounded-full transition ${
              typeFilter === pill.value ? 'bg-indigo-600 text-white' : pill.cls + ' opacity-70 hover:opacity-100'}`}>
            {pill.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">IP Address</label>
          <input value={ipFilter} onChange={e => setIpFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border rounded-md w-36 outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">User ID</label>
          <input value={uidFilter} onChange={e => setUidFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border rounded-md w-24 outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Type</label>
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 text-xs border rounded-md outline-none focus:border-indigo-500">
            <option value="">All Types</option>
            {TYPE_PILLS.slice(1).map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <button onClick={() => { setPage(1); fetchData(); }}
          className="px-3 py-1.5 text-xs font-semibold rounded-md text-white" style={{ background: '#4f46e5' }}>Search</button>
        <button onClick={() => { setIpFilter(''); setUidFilter(''); setTypeFilter(''); setPage(1); }}
          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-gray-100 text-gray-600">Clear</button>
        <div className="ml-auto">
          <select value={perPage} onChange={e => { setPerPage(parseInt(e.target.value)); setPage(1); }}
            className="px-2 py-1.5 text-xs border rounded-md">
            {[5,10,25,50,100].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['User ID','User','IP Address','Type','Domain','Accessed At'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400"><i className="fas fa-spinner fa-spin mr-2"></i>Loading...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No records found</td></tr>
            ) : data.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50">
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: '#f1f5f9', color: '#475569' }}>{row.user_id}</span>
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-800">{row.name}</div>
                  <div className="text-[10px] text-gray-400">{row.email}</div>
                </td>
                <td className="px-3 py-2">
                  <span onClick={() => copyIP(row.ip_address)} className="px-2 py-0.5 rounded font-mono text-[10px] cursor-pointer hover:text-indigo-600"
                    style={{ background: '#f1f5f9' }}>{row.ip_address}</span>
                </td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={TYPE_BADGE[row.type] || { background: '#f1f5f9', color: '#64748b' }}>
                    {row.type?.replace(/_/g, ' ') || '-'}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-500">{row.domain || '-'}</td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{row.accessed_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
        <span>Page {page} of {totalPages}</span>
        <span>Showing {startRow}–{endRow} of {total}</span>
      </div>
      {totalPages > 1 && (
        <nav className="flex justify-center gap-0.5 mt-2">
          <button onClick={() => setPage(1)} disabled={page<=1} className="px-2 py-1 text-xs border rounded disabled:opacity-40"><i className="fas fa-angles-left"></i></button>
          <button onClick={() => setPage(page-1)} disabled={page<=1} className="px-2 py-1 text-xs border rounded disabled:opacity-40"><i className="fas fa-angle-left"></i></button>
          {Array.from({length: Math.min(5, totalPages)}, (_,i) => { let p; if(totalPages<=5) p=i+1; else if(page<=3) p=i+1; else if(page>=totalPages-2) p=totalPages-4+i; else p=page-2+i; return (
            <button key={p} onClick={() => setPage(p)} className={`px-2.5 py-1 text-xs border rounded ${p===page?'text-white border-indigo-600':'hover:bg-gray-50'}`}
              style={p===page?{background:'#4f46e5'}:{}}>{p}</button>
          ); })}
          <button onClick={() => setPage(page+1)} disabled={page>=totalPages} className="px-2 py-1 text-xs border rounded disabled:opacity-40"><i className="fas fa-angle-right"></i></button>
          <button onClick={() => setPage(totalPages)} disabled={page>=totalPages} className="px-2 py-1 text-xs border rounded disabled:opacity-40"><i className="fas fa-angles-right"></i></button>
        </nav>
      )}
    </div>
    </>
  );
}
