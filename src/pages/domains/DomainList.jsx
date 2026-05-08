import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function DomainList() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const perPage = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/domains/list.php', { params: { page, per_page: perPage, search } });
      if (res.data.success) {
        setData(res.data.data.domains || []);
        setTotal(res.data.data.total || 0);
      }
    } catch {} finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this domain?')) return;
    try {
      await api.delete('/api/domains/delete.php', { data: { id } });
      toast.success('Domain deleted');
      fetchData();
    } catch {}
  };

  const columns = [
    { header: 'ID', render: (r) => <span className="text-gray-400">{r.id}</span> },
    { header: 'Domain Name', render: (r) => <span className="font-medium text-gray-800">{r.domain_name}</span> },
    { header: 'Category', key: 'category' },
    { header: 'Status', render: (r) => (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
        r.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        {r.status}
      </span>
    )},
    { header: 'Created', key: 'created_at' },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-800">Manage Domains</h1>
      <DataTable columns={columns} data={data} total={total} page={page} perPage={perPage}
        onPageChange={setPage} onSearch={(q) => { setSearch(q); setPage(1); }}
        searchPlaceholder="Search domains..." loading={loading}
        actions={(r) => (
          <button onClick={() => handleDelete(r.id)}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      />
    </div>
  );
}
