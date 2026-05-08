import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function BulkEmail() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [userOption, setUserOption] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/communication/bulk-email-users.php', { params: { page, per_page: limit, type: userOption, start_date: startDate, end_date: endDate } });
      if (res.data.success) { setData(res.data.data.users || []); setTotal(res.data.data.total || 0); }
    } catch {} finally { setLoading(false); }
  }, [page, userOption, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sendEmail = async (userId) => {
    if (!confirm('Send internship reminder email?')) return;
    try { await api.post('/api/communication/send-reminder-email.php', { user_id: userId }); toast.success('Email sent'); fetchData(); } catch {}
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="animate-fade-in">
      <h4 className="text-lg font-bold text-gray-800 mb-3">Send Bulk Email</h4>
      <div className="bg-white rounded-lg border p-3 mb-3 flex flex-wrap items-end gap-2">
        <div><label className="block text-xs font-semibold text-gray-600 mb-1">User Options</label>
          <select value={userOption} onChange={e => { setUserOption(e.target.value); setPage(1); }} className="px-3 py-1.5 text-xs border rounded-md">
            <option value="all">All Users</option><option value="specific_internship">Specific Internship Users</option>
          </select></div>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-2 py-1.5 text-xs border rounded-md" />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-2 py-1.5 text-xs border rounded-md" />
      </div>
      <p className="text-xs text-gray-500 mb-2">Count: {total}</p>
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr style={{ background: '#f38f2b' }} className="text-white">
            {['Student Name','Email','Mobile No','Internship Reminder Email','Registered At','Action'].map(h => <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400"><i className="fas fa-spinner fa-spin mr-2"></i>Loading...</td></tr>
            : data.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No data</td></tr>
            : data.map(r => (
              <tr key={r.user_id} className="hover:bg-gray-50/50">
                <td className="px-3 py-2 font-medium text-gray-800">{r.name}</td>
                <td className="px-3 py-2 text-gray-600">{r.email}</td>
                <td className="px-3 py-2 text-gray-600">{r.phone || '-'}</td>
                <td className="px-3 py-2">{r.reminder_sent ? <span className="text-green-600 font-bold">Sent</span> : <span className="text-red-500">Not Sent</span>}</td>
                <td className="px-3 py-2 text-gray-500">{r.registered_at}</td>
                <td className="px-3 py-2"><button onClick={() => sendEmail(r.user_id)} className="px-2 py-1 text-[10px] rounded bg-blue-600 text-white cursor-pointer">Send Email</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
