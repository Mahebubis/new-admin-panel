import { useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Upload, Search, CheckCircle, XCircle } from 'lucide-react';
import { Helmet } from "react-helmet-async";

export default function RegistrationChecker() {
  const [file, setFile] = useState(null);
  const [gateway, setGateway] = useState('razorpay');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) { toast.error('Please select a CSV file'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('gateway', gateway);
      const res = await api.post('/api/students/registration-checker.php', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setResults(res.data.data.results || []);
        toast.success(`Found ${res.data.data.results?.length || 0} records`);
      }
    } catch {} finally { setLoading(false); }
  };

  const handleApprove = async (userId, paymentId) => {
    try {
      await api.post('/api/students/approve-payment.php', { user_id: userId, payment_id: paymentId });
      toast.success('Payment approved');
      setResults(prev => prev.filter(r => r.payment_id !== paymentId));
    } catch {}
  };

  return (
    <><Helmet>
        <title>Regsitration Checker | Admin Panel</title>
      </Helmet>
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-800">Registration Checker</h1>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Gateway</label>
            <select value={gateway} onChange={e => setGateway(e.target.value)}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg">
              <option value="razorpay">Razorpay</option>
              <option value="instamojo">Instamojo</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">CSV File</label>
            <input type="file" accept=".csv" onChange={e => setFile(e.target.files[0])}
              className="text-xs file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100" />
          </div>
          <button onClick={handleUpload} disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" /> {loading ? 'Processing...' : 'Check Registration'}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Payment ID</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Amount</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Purpose</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Reason</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {results.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">{r.email}</td>
                  <td className="px-4 py-3 font-mono">{r.payment_id}</td>
                  <td className="px-4 py-3">₹{r.payment_amount}</td>
                  <td className="px-4 py-3">{r.purpose}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      r.status === 'registered' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{r.reason}</td>
                  <td className="px-4 py-3">
                    {r.status !== 'registered' && r.user_id && (
                      <button onClick={() => handleApprove(r.user_id, r.payment_id)}
                        className="px-2 py-1 bg-green-50 text-green-600 rounded text-[10px] font-semibold hover:bg-green-100">
                        Approve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </>
  );
}
