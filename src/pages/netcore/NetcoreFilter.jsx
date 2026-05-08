import { useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Filter, Download } from 'lucide-react';

export default function NetcoreFilter() {
  const [event, setEvent] = useState('register');
  const [payloadKey, setPayloadKey] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const payloadKeys = {
    register: ['country', 'mobile', 'state', 'email', 'referral', 'express', 'instantexam'],
    signin: ['email'],
    exam_success: ['status', 'result_score'],
    course_purchase: ['amount', 'internship_name', 'batch_date', 'coupon_applied'],
    payment_success: ['paid_amount', 'coupon_applied_success', 'order_id', 'paid_internship_name'],
    preferred_domain: ['preferred_domain'],
  };

  const handleFilter = async () => {
    if (!payloadKey) { toast.error('Select a payload key'); return; }
    setLoading(true);
    try {
      const res = await api.get('/api/netcore/filter.php', {
        params: { event, payload_key: payloadKey, from_date: fromDate, to_date: toDate }
      });
      if (res.data.success) setResults(res.data.data.results || []);
    } catch {} finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-800">Netcore Filter</h1>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Event Type</label>
            <select value={event} onChange={e => { setEvent(e.target.value); setPayloadKey(''); }}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg">
              {Object.keys(payloadKeys).map(k => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Payload Key</label>
            <select value={payloadKey} onChange={e => setPayloadKey(e.target.value)}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg">
              <option value="">Select...</option>
              {(payloadKeys[event] || []).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="px-3 py-2 text-xs border rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="px-3 py-2 text-xs border rounded-lg" />
          </div>
          <button onClick={handleFilter} disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" /> {loading ? 'Filtering...' : 'Apply Filter'}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Value</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Count</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Percentage</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {results.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium">{r.value || '(empty)'}</td>
                  <td className="px-4 py-3">{r.count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${r.percentage || 0}%` }} />
                      </div>
                      <span className="text-gray-500">{r.percentage || 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
