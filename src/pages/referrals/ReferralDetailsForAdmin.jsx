import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_URL = 'https://dashboard.internshipstudio.com/api/referral_details_for_admin.php';

const TXN_STATUS = {
  success:      { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#22c55e', label: 'Success' },
  completed:    { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#22c55e', label: 'Completed' },
  under_review: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6', label: 'Under Review' },
  pending:      { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', dot: '#fb923c', label: 'Pending' },
};

function Avatar({ name, photo, size = 36 }) {
  const init = (name || '?').charAt(0).toUpperCase();
  if (photo) return <img src={photo} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid #ede9fe', flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: size * 0.35, fontWeight: 700, flexShrink: 0, border: '2px solid #ede9fe' }}>
      {init}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{ background: '#faf9ff', border: '1.5px solid #ede9fe', borderRadius: 10, padding: '12px 16px', minWidth: 150 }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent || '#4f46e5' }}>{value}</div>
    </div>
  );
}

function ProofThumb({ url }) {
  const [modal, setModal] = useState(false);
  if (!url) return <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>;
  return (
    <>
      <div onClick={() => setModal(true)} style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', border: '2px solid #c4b5fd', cursor: 'pointer', display: 'inline-block' }}>
        <img src={url} alt="proof" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => { e.currentTarget.style.display = 'none'; }} />
      </div>
      {modal && (
        <div onClick={() => setModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', maxWidth: 500, width: '90%', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Payment Proof</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={url} target="_blank" rel="noopener" style={{ fontSize: 11, color: '#fff', opacity: .85 }}>Open ↗</a>
                <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18 }}>×</button>
              </div>
            </div>
            <div style={{ background: '#0f172a', padding: 16, display: 'flex', justifyContent: 'center' }}>
              <img src={url} alt="proof" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8 }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ReferralDetailsForAdmin() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const userId     = params.get('user_id');
  const [loading,  setLoading]  = useState(true);
  const [detail,   setDetail]   = useState(null);
  const [error,    setError]    = useState('');

  useEffect(() => {
    if (!userId) { setError('No user_id provided'); setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: parseInt(userId) }),
        });
        const data = await res.json();
        if (data.status !== 'success') throw new Error(data.message || 'Failed');
        setDetail(data);
      } catch (e) {
        setError(e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f5f3ff' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #ede9fe', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'rdspin .7s linear infinite' }} />
      <style>{`@keyframes rdspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f5f3ff', gap: 12 }}>
      <div style={{ fontSize: 13, color: '#b91c1c' }}>{error}</div>
      <button onClick={() => navigate(-1)} style={{ padding: '7px 16px', borderRadius: 8, background: '#4f46e5', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer' }}>← Go Back</button>
    </div>
  );

  const user = detail?.user || {};
  const fullName = `${user.fname || ''} ${user.lname || ''}`.trim() || '—';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .rd-root { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f3ff; min-height: 100vh; padding: 20px; }
        .rd-section { background: #fff; border-radius: 12px; border: 1.5px solid #ede9fe; box-shadow: 0 1px 8px rgba(79,70,229,0.06); margin-bottom: 18px; overflow: hidden; }
        .rd-section-head { padding: 12px 18px; border-bottom: 1.5px solid #f5f3ff; display: flex; align-items: center; gap: 8px; }
        .rd-section-title { font-size: 13px; font-weight: 700; color: #1e293b; }
        .rd-section-body { padding: 16px 18px; }
        table.rd-t { width: 100%; border-collapse: collapse; table-layout: auto; }
        table.rd-t thead tr { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); }
        table.rd-t thead th { color: #fff; font-size: 10.5px; font-weight: 600; padding: 10px 12px; text-align: left; letter-spacing: 0.4px; text-transform: uppercase; border-right: 1px solid rgba(255,255,255,0.18); white-space: nowrap; }
        table.rd-t thead th:last-child { border-right: none; }
        table.rd-t tbody tr { border-bottom: 1px solid #f5f3ff; transition: background .12s; }
        table.rd-t tbody tr:hover { background: #faf9ff; }
        table.rd-t tbody tr:last-child { border-bottom: none; }
        table.rd-t td { font-size: 12px; color: #334155; padding: 9px 12px; vertical-align: middle; border-right: 1px solid #f5f3ff; white-space: nowrap; }
        table.rd-t td:last-child { border-right: none; }
        .pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 20px; font-size: 10.5px; font-weight: 600; border: 1px solid; white-space: nowrap; }
      `}</style>

      <div className="rd-root">

        {/* Back + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => navigate(-1)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: '#ede9fe', color: '#5b21b6', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Back
          </button>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>Referral Detail</h1>
        </div>

        {/* User header card */}
        <div style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', borderRadius: 14, padding: '18px 22px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name={fullName} photo={user.photo} size={56} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{fullName}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{user.email || '—'}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>User #{userId}</div>
          </div>
          {detail?.referral_link && (
            <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Referral Link</span>
              <button onClick={() => { navigator.clipboard.writeText(detail.referral_link); toast.success('Link copied!'); }}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <StatCard label="Total Referrals" value={detail?.total_referral_count ?? 0} accent="#4f46e5" />
          <StatCard label="Wallet Balance" value={`₹${Number(detail?.wallet_balance ?? 0).toLocaleString('en-IN')}`} accent="#15803d" />
          <StatCard label="Approved At" value={detail?.approved_at ? detail.approved_at.slice(0, 10) : '—'} accent="#92400e" />
          <StatCard label="Transactions" value={detail?.transactions?.length ?? 0} accent="#5b21b6" />
        </div>

        {/* Referred Candidates */}
        <div className="rd-section">
          <div className="rd-section-head">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="rd-section-title">Referred Candidates</span>
            <span style={{ marginLeft: 'auto', background: '#ede9fe', color: '#5b21b6', fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>
              {detail?.referred_user?.length ?? 0}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rd-t">
              <thead>
                <tr>
                  {['User ID','Profile','Email','Registered At','Purchase','Purchase Date'].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {(detail?.referred_user || []).length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#94a3b8', fontSize: 12 }}>No referred users</td></tr>
                )}
                {(detail?.referred_user || []).map(u => (
                  <tr key={u.user_id}>
                    <td style={{ color: '#94a3b8', fontWeight: 600 }}>{u.user_id}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={u.name} photo={u.photo} size={28} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 12 }}>{u.name || '—'}</div>
                          <div style={{ fontSize: 10.5, color: '#94a3b8' }}>#{u.user_id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: '#4f46e5' }}>{u.email || '—'}</td>
                    <td style={{ color: '#64748b', fontSize: 11 }}>{u.registered_at || '—'}</td>
                    <td>
                      <span className="pill" style={u.is_purchased === 'yes'
                        ? { background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }
                        : { background: '#fff7ed', color: '#c2410c', borderColor: '#fed7aa' }}>
                        <svg width="5" height="5" viewBox="0 0 6 6"><circle cx="3" cy="3" r="3" fill="currentColor"/></svg>
                        {u.is_purchased === 'yes' ? 'Purchased' : 'Not Yet'}
                      </span>
                    </td>
                    <td style={{ color: '#64748b', fontSize: 11 }}>{u.purchase_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transactions */}
        <div className="rd-section">
          <div className="rd-section-head">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <span className="rd-section-title">Transactions</span>
            <span style={{ marginLeft: 'auto', background: '#ede9fe', color: '#5b21b6', fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>
              {detail?.transactions?.length ?? 0}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rd-t">
              <thead>
                <tr>
                  {['ID','Type','Amount','Status','Date','From','Proof'].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {(detail?.transactions || []).length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#94a3b8', fontSize: 12 }}>No transactions</td></tr>
                )}
                {(detail?.transactions || []).map(txn => {
                  const st = TXN_STATUS[txn.status] || TXN_STATUS.pending;
                  const fromUser = txn.from_user;
                  return (
                    <tr key={txn.transaction_id}>
                      <td style={{ color: '#94a3b8', fontWeight: 600 }}>{txn.transaction_id}</td>
                      <td>
                        <span className="pill" style={txn.type === 'credit'
                          ? { background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }
                          : { background: '#ede9fe', color: '#5b21b6', borderColor: '#c4b5fd' }}>
                          {txn.type === 'credit' ? '↓ Credit' : '↑ Withdrawal'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>
                        ₹{Number(txn.amount).toLocaleString('en-IN')}
                      </td>
                      <td>
                        {txn.status ? (
                          <span className="pill" style={{ background: st.bg, color: st.color, borderColor: st.border }}>
                            <svg width="5" height="5" viewBox="0 0 6 6"><circle cx="3" cy="3" r="3" fill={st.dot}/></svg>
                            {st.label}
                          </span>
                        ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ color: '#64748b', fontSize: 11 }}>{txn.created_at}</td>
                      <td>
                        {typeof fromUser === 'object' && fromUser !== null
                          ? <span style={{ color: '#94a3b8', fontSize: 11 }}>User #{fromUser.user_id}</span>
                          : typeof fromUser === 'string'
                            ? <span style={{ color: '#4f46e5', fontSize: 12 }}>{fromUser}</span>
                            : <span style={{ color: '#cbd5e1' }}>—</span>
                        }
                      </td>
                      <td><ProofThumb url={txn.transaction_screenshot} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  );
}