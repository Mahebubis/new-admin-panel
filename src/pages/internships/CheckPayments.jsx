// import { useState, useEffect, useCallback } from 'react';
// import api from '../../api/axios';
// import DataTable from '../../components/DataTable';
// import toast from 'react-hot-toast';

// export default function CheckPayments() {
//   const [data, setData] = useState([]);
//   const [total, setTotal] = useState(0);
//   const [page, setPage] = useState(1);
//   const [search, setSearch] = useState('');
//   const [loading, setLoading] = useState(true);
//   const perPage = 20;

//   const fetchData = useCallback(async () => {
//     setLoading(true);
//     try {
//       const res = await api.get('/api/internships/payments.php', { params: { page, per_page: perPage, search } });
//       if (res.data.success) {
//         setData(res.data.data.payments || []);
//         setTotal(res.data.data.total || 0);
//       }
//     } catch {} finally { setLoading(false); }
//   }, [page, search]);

//   useEffect(() => { fetchData(); }, [fetchData]);

//   const handleAssign = async (payment) => {
//     const internship = prompt('Enter internship name to assign:');
//     if (!internship) return;
//     try {
//       await api.post('/api/internships/assign-payment.php', {
//         user_id: payment.user_id, payment_id: payment.gateway_txn,
//         internship, amount: payment.amount
//       });
//       toast.success('Internship assigned');
//       fetchData();
//     } catch {}
//   };

//   const columns = [
//     { header: 'ID', render: (r) => <span className="text-gray-400">{r.payment_id}</span> },
//     { header: 'Student', key: 'student_name' },
//     { header: 'Email', key: 'email' },
//     { header: 'Internship', key: 'internship' },
//     { header: 'Amount', render: (r) => <span className="font-semibold text-green-600">₹{r.amount}</span> },
//     { header: 'Gateway', key: 'gateway' },
//     { header: 'Status', render: (r) => (
//       <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
//         r.status === 'captured' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
//     )},
//     { header: 'Txn ID', render: (r) => <span className="font-mono text-[10px]">{r.gateway_txn}</span> },
//     { header: 'Date', key: 'paid_at' },
//   ];

//   return (
//     <div className="space-y-4">
//       <h1 className="text-xl font-bold text-gray-800">Check Payments</h1>
//       <DataTable columns={columns} data={data} total={total} page={page} perPage={perPage}
//         onPageChange={setPage} onSearch={(q) => { setSearch(q); setPage(1); }}
//         searchPlaceholder="Search by name, email, txn..." loading={loading}
//         actions={(r) => (
//           <button onClick={() => handleAssign(r)}
//             className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-semibold hover:bg-indigo-100">Assign</button>
//         )}
//       />
//     </div>
//   );
// }











import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/internships/payments.php';
const LIMIT = 20;

const thS = {
  color: '#fff', fontSize: 11, fontWeight: 600, padding: '11px 12px',
  textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px',
  borderRight: '1px solid rgba(255,255,255,.15)', whiteSpace: 'nowrap',
};
const tdS = {
  padding: '8px 12px', borderBottom: '1px solid #f5f3ff',
  color: '#334155', fontSize: 12, verticalAlign: 'middle',
};

export default function CheckPayments() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const params = new URLSearchParams({ page, per_page: LIMIT });
    if (search) params.set('search', search);

    api.get(`${API}?${params}`, { signal: controller.signal })
      .then(res => {
        if (res.data.success) {
          setRows(res.data.data.payments || []);
          setTotal(res.data.data.total || 0);
        }
      })
      .catch(err => { if (err?.name !== 'CanceledError' && err?.name !== 'AbortError') toast.error('Failed to load'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [page, search]);

  const doSearch = () => { setPage(1); setSearch(searchInput); };
  const clearSearch = () => { setSearchInput(''); setSearch(''); setPage(1); };
  const totalPages = Math.ceil(total / LIMIT);

  const handleAssign = async (row) => {
    const internship = window.prompt('Enter internship name to assign:');
    if (!internship) return;
    try {
      await api.post('/api/internships/assign-payment.php', {
        user_id: row.user_id, payment_id: row.gateway_txn,
        internship, amount: row.amount,
      });
      toast.success('Internship assigned');
      setPage(p => p); // trigger refetch
    } catch { toast.error('Failed to assign'); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .cp-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .cp-tr:hover td{background:#faf9ff!important;}
        .cp-pg:hover{background:#ede9fe!important;color:#4f46e5!important;}
        @keyframes cp_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="cp-root" style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100vh - 62px)', /* full height minus navbar */
        padding: 20, gap: 14, overflow: 'hidden',
        background: '#f5f3ff',
      }}>

        {/* ── header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
            💳 Check Payments
          </div>
          <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>
            Total: <strong style={{ color: '#4f46e5' }}>{total}</strong>
          </span>
        </div>

        {/* ── toolbar ── */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          <div style={{
            display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: 8,
            overflow: 'hidden', background: '#fff', flex: '0 0 340px'
          }}>
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search by name, email, txn ID..."
              style={{
                border: 'none', padding: '8px 12px', fontSize: 12.5, flex: 1,
                outline: 'none', fontFamily: 'inherit', color: '#1e293b'
              }}
            />
            <button onClick={doSearch}
              style={{ background: '#4f46e5', color: '#fff', border: 'none', padding: '0 13px', cursor: 'pointer', fontSize: 12 }}>
              🔍
            </button>
            <button onClick={clearSearch}
              style={{ background: '#f1f5f9', color: '#64748b', border: 'none', padding: '0 10px', cursor: 'pointer', fontSize: 14 }}>
              ×
            </button>
          </div>
        </div>

        {/* ── table — flex:1 fills remaining space ── */}
        <div style={{
          flex: 1, minHeight: 0, background: '#fff', borderRadius: 12,
          border: '1.5px solid #ede9fe', boxShadow: '0 1px 8px rgba(79,70,229,.05)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>

          {/* scrollable table body */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 60 }} />{/* # */}
                <col style={{ width: 140 }} />{/* Student */}
                <col style={{ width: 180 }} />{/* Email */}
                <col style={{ width: 160 }} />{/* Internship */}
                <col style={{ width: 80 }} />{/* Amount */}
                <col style={{ width: 90 }} />{/* Status */}
                <col style={{ width: 160 }} />{/* Txn ID */}
                <col style={{ width: 90 }} />{/* Date */}
                <col style={{ width: 80 }} />{/* Action */}
              </colgroup>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {['#', 'Student', 'Email', 'Internship', 'Amount', 'Status', 'Txn ID', 'Date', 'Action'].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 48 }}>
                    <div style={{
                      display: 'inline-block', width: 28, height: 28,
                      border: '3px solid #ede9fe', borderTop: '3px solid #4f46e5',
                      borderRadius: '50%', animation: 'cp_spin .7s linear infinite'
                    }} />
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: '#94a3b8', padding: 36, fontSize: 13 }}>
                    No payments found
                  </td></tr>
                ) : rows.map((r, i) => (
                  <tr key={r.payment_id || i} className="cp-tr">
                    <td style={{ ...tdS, color: '#94a3b8', fontSize: 11 }}>{(page - 1) * LIMIT + i + 1}</td>
                    <td style={{ ...tdS, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.student_name}
                    </td>
                    <td style={{ ...tdS, fontSize: 11.5, color: '#4f46e5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.email}
                    </td>
                    <td style={{ ...tdS, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.internship || <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ ...tdS, fontWeight: 700, color: '#16a34a' }}>₹{r.amount}</td>
                    <td style={tdS}>
                      <span style={{
                        padding: '3px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
                        background: r.status === 'success' || r.status === 'captured' ? '#dcfce7' : '#f1f5f9',
                        color: r.status === 'success' || r.status === 'captured' ? '#16a34a' : '#64748b',
                      }}>
                        {r.status || 'pending'}
                      </span>
                    </td>
                    <td style={{ ...tdS, fontSize: 10, color: '#64748b', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.gateway_txn || '—'}
                    </td>
                    <td style={{ ...tdS, fontSize: 11, whiteSpace: 'nowrap' }}>{r.paid_at || '—'}</td>
                    <td style={tdS}>
                      <button onClick={() => handleAssign(r)}
                        style={{
                          padding: '5px 10px', background: '#ede9fe', color: '#4f46e5',
                          border: '1.5px solid #c4b5fd', borderRadius: 6, fontSize: 11,
                          fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
                        }}>
                        Assign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* pagination — pinned to bottom of card */}
          {totalPages > 1 && (
            <div style={{
              flexShrink: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
              gap: 5, padding: '8px 14px', borderTop: '1px solid #f5f3ff', background: '#fafafa'
            }}>
              <span style={{ fontSize: 11.5, color: '#64748b', marginRight: 6 }}>
                Page {page} of {totalPages}
              </span>
              {[
                { label: '«', action: () => setPage(1), disabled: page === 1 },
                { label: '‹', action: () => setPage(p => p - 1), disabled: page === 1 },
              ].map(b => (
                <button key={b.label} className="cp-pg" disabled={b.disabled} onClick={b.action}
                  style={{
                    padding: '4px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                    background: '#fff', fontSize: 13, cursor: b.disabled ? 'not-allowed' : 'pointer',
                    color: b.disabled ? '#cbd5e1' : '#334155'
                  }}>{b.label}</button>
              ))}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = page <= 3 ? i + 1 : page - 2 + i;
                if (pg > totalPages) return null;
                return (
                  <button key={pg} className="cp-pg" onClick={() => setPage(pg)}
                    style={{
                      padding: '4px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                      background: pg === page ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#fff',
                      color: pg === page ? '#fff' : '#334155', fontSize: 12, cursor: 'pointer',
                      fontWeight: pg === page ? 700 : 400
                    }}>{pg}</button>
                );
              })}
              {[
                { label: '›', action: () => setPage(p => p + 1), disabled: page === totalPages },
                { label: '»', action: () => setPage(totalPages), disabled: page === totalPages },
              ].map(b => (
                <button key={b.label} className="cp-pg" disabled={b.disabled} onClick={b.action}
                  style={{
                    padding: '4px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
                    background: '#fff', fontSize: 13, cursor: b.disabled ? 'not-allowed' : 'pointer',
                    color: b.disabled ? '#cbd5e1' : '#334155'
                  }}>{b.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}