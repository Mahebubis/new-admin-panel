import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Helmet } from "react-helmet-async";

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/settings/delete_incomplete_exam.php';
const post = d => fetch(API, { method: 'POST', body: new URLSearchParams(d) }).then(r => r.json());

/* ─── confirm modal ─── */
function ConfirmModal({ count, onConfirm, onCancel, deleting }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}
            onClick={e => e.target === e.currentTarget && !deleting && onCancel()}>
            <div style={{
                background: '#fff', borderRadius: 16, padding: '28px 30px', width: 420,
                maxWidth: '92vw', boxShadow: '0 24px 70px rgba(0,0,0,.2)', textAlign: 'center'
            }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>
                    Confirm Deletion
                </div>
                <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7, marginBottom: 8 }}>
                    Are you sure you want to delete
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#dc2626', marginBottom: 8 }}>
                    {count} record{count !== 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.6, marginBottom: 22 }}>
                    from <code style={{
                        background: '#fef2f2', color: '#dc2626', padding: '2px 6px',
                        borderRadius: 5, fontSize: 11.5
                    }}>cit_exam_login</code>?
                    <br />This action <strong style={{ color: '#dc2626' }}>cannot be undone.</strong>
                </div>
                <div style={{
                    background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 9,
                    padding: '10px 14px', marginBottom: 22, fontSize: 12, color: '#92400e', textAlign: 'left'
                }}>
                    🔍 These are users who <strong>ended their exam</strong> but have no exam data or result records.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={onCancel} disabled={deleting}
                        style={{
                            flex: 1, padding: 11, border: '1.5px solid #e2e8f0', borderRadius: 9,
                            background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600,
                            cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit'
                        }}>
                        Cancel
                    </button>
                    <button onClick={onConfirm} disabled={deleting}
                        style={{
                            flex: 1, padding: 11, border: 'none', borderRadius: 9, fontSize: 13,
                            fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', color: '#fff',
                            fontFamily: 'inherit', opacity: deleting ? .7 : 1,
                            background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7
                        }}>
                        {deleting
                            ? <><span style={{
                                display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)',
                                borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite'
                            }} /> Deleting...</>
                            : '🗑️ Yes, Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
export default function DeleteIncompleteExam() {
    const [users, setUsers] = useState([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [confirm, setConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleted, setDeleted] = useState(null);   // { affected_rows, message }
    const [search, setSearch] = useState('');

    /* ── load ── */
    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await post({ action: 'get_users' });
            if (res.success) { setUsers(res.users || []); setCount(res.count || 0); }
            else toast.error(res.message || 'Failed to load');
        } catch (e) { toast.error(e.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadUsers(); }, [loadUsers]);

    /* ── delete ── */
    const handleDelete = async () => {
        setDeleting(true);
        try {
            const res = await post({ action: 'delete_users' });
            setConfirm(false);
            if (res.success) {
                setDeleted(res);
                toast.success(res.message);
                setUsers([]);
                setCount(0);
            } else toast.error(res.message || 'Delete failed');
        } catch (e) { toast.error(e.message); }
        finally { setDeleting(false); }
    };

    /* ── filtered users ── */
    const filtered = search.trim()
        ? users.filter(u =>
            (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(search.toLowerCase()))
        : users;

    const thS = {
        padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#fff', textAlign: 'left',
        textTransform: 'uppercase', letterSpacing: '.5px',
        background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
        borderRight: '1px solid rgba(255,255,255,.15)', position: 'sticky', top: 0, zIndex: 2,
    };
    const tdS = {
        padding: '11px 14px', fontSize: 12.5, color: '#1e293b',
        borderBottom: '1px solid #f5f3ff', verticalAlign: 'middle',
    };

    return (
        <>
        <Helmet>
        <title>Delete Incomplete Exam | Admin Panel</title>
      </Helmet>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .die-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .die-tr:hover td { background:#faf9ff!important; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .die-spin { display:inline-block;width:18px;height:18px;border:2.5px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:spin .7s linear infinite; }
      `}</style>

            <div className="die-root" style={{
                display: 'flex', flexDirection: 'column',
                height: 'calc(100vh - 62px)', padding: 20, gap: 14, overflow: 'hidden', background: '#f5f3ff'
            }}>

                {/* ── HEADER ── */}
                <div style={{
                    flexShrink: 0, display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', flexWrap: 'wrap', gap: 10
                }}>
                    <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>
                            🗑️ Delete Incomplete Exam Users
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            Users who ended their exam but have no data or result records
                        </div>
                    </div>
                    <button onClick={loadUsers} disabled={loading}
                        style={{
                            padding: '7px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8,
                            background: '#fff', color: '#64748b', fontSize: 12.5, fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'inherit'
                        }}>🔄 Refresh</button>
                </div>

                {/* ── SUCCESS STATE ── */}
                {deleted && (
                    <div style={{
                        background: '#dcfce7', border: '1.5px solid #86efac', borderRadius: 12,
                        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
                        flexShrink: 0, boxShadow: '0 1px 6px rgba(22,163,74,.1)'
                    }}>
                        <span style={{ fontSize: 36 }}>✅</span>
                        <div>
                            <div style={{ fontWeight: 800, color: '#15803d', fontSize: 14 }}>Deletion Complete</div>
                            <div style={{ fontSize: 13, color: '#166534', marginTop: 2 }}>{deleted.message}</div>
                        </div>
                        <button onClick={() => { setDeleted(null); loadUsers(); }}
                            style={{
                                marginLeft: 'auto', padding: '7px 14px', border: '1.5px solid #86efac',
                                borderRadius: 8, background: '#fff', color: '#15803d', fontSize: 12.5,
                                fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit'
                            }}>
                            Check Again
                        </button>
                    </div>
                )}

                {/* ── INFO + STATS ROW ── */}
                {!deleted && (
                    <div style={{ display: 'flex', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
                        {/* count chip */}
                        <div style={{
                            background: count > 0 ? '#fee2e2' : '#dcfce7',
                            border: `1.5px solid ${count > 0 ? '#fca5a5' : '#86efac'}`,
                            borderRadius: 12, padding: '14px 20px',
                            display: 'flex', alignItems: 'center', gap: 12
                        }}>
                            <span style={{ fontSize: 32 }}>{count > 0 ? '⚠️' : '✅'}</span>
                            <div>
                                <div style={{ fontSize: 26, fontWeight: 800, color: count > 0 ? '#dc2626' : '#15803d' }}>
                                    {loading ? '…' : count}
                                </div>
                                <div style={{
                                    fontSize: 11, fontWeight: 700, color: count > 0 ? '#dc2626' : '#15803d',
                                    textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2
                                }}>
                                    {count > 0 ? 'Users to Delete' : 'No users found'}
                                </div>
                            </div>
                        </div>

                        {/* SQL info */}
                        <div style={{
                            background: '#fff', border: '1.5px solid #ede9fe', borderRadius: 12,
                            padding: '14px 18px', flex: 1, boxShadow: '0 1px 6px rgba(79,70,229,.06)'
                        }}>
                            <div style={{
                                fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
                                letterSpacing: '.05em', marginBottom: 8
                            }}>Query Criteria</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {[
                                    { icon: '✅', text: 'end_exam IS NOT NULL (exam was ended)' },
                                    { icon: '❌', text: 'No row in cit_exam_data (no answers saved)' },
                                    { icon: '❌', text: 'No row in cit_results (no result generated)' },
                                ].map((c, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        fontSize: 12, color: '#475569'
                                    }}>
                                        <span>{c.icon}</span>{c.text}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* delete button */}
                        {count > 0 && !loading && (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <button onClick={() => setConfirm(true)}
                                    style={{
                                        padding: '14px 24px', border: 'none', borderRadius: 12, fontSize: 14,
                                        fontWeight: 800, cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
                                        background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
                                        boxShadow: '0 4px 14px rgba(220,38,38,.3)',
                                        display: 'flex', alignItems: 'center', gap: 9
                                    }}>
                                    🗑️ Delete {count} User{count !== 1 ? 's' : ''}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── TABLE ── */}
                {!deleted && (
                    <div style={{
                        flex: 1, minHeight: 0, background: '#fff', borderRadius: 14,
                        border: '1.5px solid #ede9fe', display: 'flex', flexDirection: 'column',
                        overflow: 'hidden', boxShadow: '0 1px 8px rgba(79,70,229,.07)'
                    }}>

                        {/* search bar */}
                        <div style={{
                            padding: '10px 14px', borderBottom: '1.5px solid #f5f3ff',
                            display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0
                        }}>
                            <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
                                <span style={{
                                    position: 'absolute', left: 10, top: '50%',
                                    transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 14
                                }}>🔍</span>
                                <input value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Search by name or email..."
                                    style={{
                                        width: '100%', padding: '7px 12px 7px 32px', border: '1.5px solid #e2e8f0',
                                        borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none',
                                        color: '#1e293b', background: '#fafafe'
                                    }}
                                    onFocus={e => e.target.style.borderColor = '#4f46e5'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                                {search && (
                                    <button onClick={() => setSearch('')}
                                        style={{
                                            position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: '#94a3b8', fontSize: 16
                                        }}>×</button>
                                )}
                            </div>
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>
                                {loading ? <span className="die-spin" /> : <>
                                    Showing <strong style={{ color: '#1e293b' }}>{filtered.length}</strong> of <strong style={{ color: '#dc2626' }}>{count}</strong>
                                </>}
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 400 }}>
                                <thead>
                                    <tr>
                                        <th style={thS}>#</th>
                                        <th style={thS}>Name</th>
                                        <th style={thS}>Email</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={3} style={{ textAlign: 'center', padding: 50, color: '#94a3b8' }}>
                                            <div className="die-spin" style={{ width: 26, height: 26, margin: '0 auto 12px' }} />
                                            <div style={{ fontSize: 13 }}>Loading users...</div>
                                        </td></tr>
                                    ) : !filtered.length ? (
                                        <tr><td colSpan={3} style={{ textAlign: 'center', padding: 50, color: '#94a3b8' }}>
                                            <div style={{ fontSize: 38, marginBottom: 10 }}>
                                                {count === 0 ? '🎉' : '🔍'}
                                            </div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>
                                                {count === 0
                                                    ? 'No incomplete exam users found!'
                                                    : `No results for "${search}"`}
                                            </div>
                                            {count === 0 && (
                                                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                                                    All exam logins have corresponding data and results.
                                                </div>
                                            )}
                                        </td></tr>
                                    ) : filtered.map((u, idx) => (
                                        <tr key={idx} className="die-tr">
                                            <td style={{ ...tdS, color: '#94a3b8', fontSize: 12, width: 50 }}>{idx + 1}</td>
                                            <td style={tdS}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                                    <div style={{
                                                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                                                        background: 'linear-gradient(135deg,#fee2e2,#fca5a5)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: 12, fontWeight: 700, color: '#dc2626'
                                                    }}>
                                                        {(u.name || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <span style={{ fontWeight: 600 }}>{u.name || '—'}</span>
                                                </div>
                                            </td>
                                            <td style={{ ...tdS, color: '#64748b', fontSize: 12.5 }}>{u.email || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* footer */}
                        {count > 0 && !loading && (
                            <div style={{
                                padding: '9px 16px', borderTop: '1.5px solid #f5f3ff', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: '#fef2f2', flexWrap: 'wrap', gap: 8
                            }}>
                                <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    ⚠️ {count} record{count !== 1 ? 's' : ''} will be permanently deleted from <code style={{ background: '#fee2e2', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>cit_exam_login</code>
                                </div>
                                <button onClick={() => setConfirm(true)}
                                    style={{
                                        padding: '7px 16px', border: 'none', borderRadius: 8, fontSize: 12.5,
                                        fontWeight: 700, cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
                                        background: 'linear-gradient(135deg,#dc2626,#b91c1c)'
                                    }}>
                                    🗑️ Delete All
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── CONFIRM MODAL ── */}
            {confirm && (
                <ConfirmModal
                    count={count}
                    deleting={deleting}
                    onConfirm={handleDelete}
                    onCancel={() => !deleting && setConfirm(false)} />
            )}
        </>
    );
}