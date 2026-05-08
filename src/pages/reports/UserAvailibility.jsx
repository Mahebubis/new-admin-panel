import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/reports/user_availability.php';
const PER_PAGE = 60;

const apiFetch = (params) =>
    fetch(`${API}?${new URLSearchParams({ action: 'get_data', ...params })}`).then(r => r.json());

/* ─── helpers ─── */
const fmtINR = n => n ? '₹' + Number(n).toLocaleString('en-IN') : null;
const fmtDate = d => { try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } };

/* ─── badge ─── */
const Badge = ({ label, variant = 'gray', icon }) => {
    const cfg = {
        green: { bg: '#dcfce7', color: '#15803d' },
        blue: { bg: '#dbeafe', color: '#1d4ed8' },
        indigo: { bg: '#e0e7ff', color: '#4338ca' },
        purple: { bg: '#f3e8ff', color: '#7e22ce' },
        orange: { bg: '#ffedd5', color: '#c2410c' },
        gray: { bg: '#f3f4f6', color: '#374151' },
        violet: { bg: '#ede9fe', color: '#5b21b6' },
    };
    const c = cfg[variant] || cfg.gray;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px',
            borderRadius: 99, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color, whiteSpace: 'nowrap'
        }}>
            {icon && <span>{icon}</span>}{label}
        </span>
    );
};

/* ─── user card ─── */
function UserCard({ row }) {
    const initials = (row.user_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return (
        <div style={{
            background: '#fff', borderRadius: 14, border: '1.5px solid #ede9fe',
            boxShadow: '0 1px 8px rgba(79,70,229,.07)', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', transition: 'box-shadow .2s, transform .2s'
        }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(79,70,229,.14)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 8px rgba(79,70,229,.07)'; e.currentTarget.style.transform = 'none'; }}>

            {/* card body */}
            <div style={{ padding: '18px 18px 14px' }}>
                {/* user header */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                    <div style={{
                        width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800,
                        color: '#fff', flexShrink: 0
                    }}>
                        {initials}
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{
                            fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 2,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                            {row.user_name || '—'}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            ✉️ {row.user_email || '—'}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 1 }}>
                            📞 {row.user_phone || '—'}
                        </div>
                        {row.username && (
                            <a href={`https://internshipstudio.com/profile/${row.username}`} target="_blank" rel="noreferrer"
                                style={{
                                    fontSize: 11.5, color: '#4f46e5', fontWeight: 600, display: 'inline-flex', alignItems: 'center',
                                    gap: 3, marginTop: 3, textDecoration: 'none'
                                }}>
                                🔗 View Profile
                                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                            </a>
                        )}
                    </div>
                </div>

                <div style={{ borderTop: '1.5px solid #f5f3ff', paddingTop: 12 }}>
                    {/* job type + relocation */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        <Badge label={row.job_type === 'internship' ? '💼 Internship' : '🏢 Job'}
                            variant={row.job_type === 'internship' ? 'green' : 'blue'} />
                        <Badge label={row.willing_to_relocate ? '✈️ Can Relocate' : '📍 No Relocation'}
                            variant={row.willing_to_relocate ? 'indigo' : 'gray'} />
                    </div>

                    {/* availability */}
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span>📅</span>
                        <span>Available: <strong style={{ color: '#1e293b' }}>{row.available_from}</strong>
                            {row.specific_date && <span style={{ color: '#94a3b8' }}> ({fmtDate(row.specific_date)})</span>}
                        </span>
                    </div>
                    {row.available_till && (
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span>⏳</span>
                            <span>Duration: <strong style={{ color: '#1e293b' }}>{row.available_till} days</strong></span>
                        </div>
                    )}

                    {/* cities */}
                    {row.cities_array?.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                            <div style={{
                                fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase',
                                letterSpacing: '.5px', marginBottom: 5
                            }}>📍 Preferred Locations</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {row.cities_array.filter(Boolean).map((c, i) => (
                                    <Badge key={i} label={c} variant="gray" icon="📌" />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* work mode */}
                    {row.location_types_array?.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                            <div style={{
                                fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase',
                                letterSpacing: '.5px', marginBottom: 5
                            }}>💻 Work Mode</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {row.location_types_array.filter(Boolean).map((t, i) => (
                                    <Badge key={i} label={t === 'remote' ? '🌐 Remote' : '🏢 Onsite'} variant={t === 'remote' ? 'violet' : 'orange'} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* compensation */}
                    {(row.stipend_amount || row.expected_ctc) && (
                        <div style={{ background: '#f5f3ff', borderRadius: 8, padding: '8px 12px' }}>
                            <div style={{
                                fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase',
                                letterSpacing: '.5px', marginBottom: 4
                            }}>💰 Compensation</div>
                            {row.stipend_amount && (
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b' }}>
                                    Stipend: {fmtINR(row.stipend_amount)}
                                </div>
                            )}
                            {row.expected_ctc && (
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b', marginTop: 2 }}>
                                    Expected CTC: {fmtINR(row.expected_ctc)}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* card footer */}
            <div style={{
                marginTop: 'auto', padding: '8px 18px', background: '#faf9ff',
                borderTop: '1.5px solid #f5f3ff', fontSize: 11.5, color: '#94a3b8'
            }}>
                🕐 Created {fmtDate(row.created_at)}
            </div>
        </div>
    );
}

/* ─── pagination ─── */
function Pagination({ page, totalPages, onChange }) {
    if (totalPages <= 1) return null;

    const pages = [];
    const range = 2;
    for (let i = Math.max(1, page - range); i <= Math.min(totalPages, page + range); i++) pages.push(i);

    const btnS = (active) => ({
        padding: '6px 12px', border: `1.5px solid ${active ? '#4f46e5' : '#e2e8f0'}`,
        borderRadius: 7, fontSize: 12.5, fontWeight: active ? 700 : 500,
        background: active ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#fff',
        color: active ? '#fff' : '#475569', cursor: 'pointer', fontFamily: 'inherit',
    });

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5, flexWrap: 'wrap', paddingTop: 4 }}>
            <button style={btnS(false)} disabled={page <= 1} onClick={() => onChange(page - 1)}
                style={{ ...btnS(false), opacity: page <= 1 ? .4 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>
                ← Prev
            </button>
            {page > range + 1 && <>
                <button style={btnS(false)} onClick={() => onChange(1)}>1</button>
                {page > range + 2 && <span style={{ color: '#94a3b8', padding: '0 4px' }}>…</span>}
            </>}
            {pages.map(p => (
                <button key={p} style={btnS(p === page)} onClick={() => onChange(p)}>{p}</button>
            ))}
            {page < totalPages - range && <>
                {page < totalPages - range - 1 && <span style={{ color: '#94a3b8', padding: '0 4px' }}>…</span>}
                <button style={btnS(false)} onClick={() => onChange(totalPages)}>{totalPages}</button>
            </>}
            <button style={btnS(false)} disabled={page >= totalPages} onClick={() => onChange(page + 1)}
                style={{ ...btnS(false), opacity: page >= totalPages ? .4 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}>
                Next →
            </button>
        </div>
    );
}

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
export default function UserAvailability() {
    const [filters, setFilters] = useState({ job_type: '', available_from: '', location_type: '', city: '', search: '' });
    const [applied, setApplied] = useState({});
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);

    const fetchData = useCallback(async (f = applied, p = page) => {
        setLoading(true);
        try {
            const params = { page: p, per_page: PER_PAGE };
            Object.entries(f).forEach(([k, v]) => { if (v) params[k] = v; });
            const res = await apiFetch(params);
            if (!res.success) { toast.error(res.message || 'Failed'); return; }
            setData(res.data || []);
            setTotal(res.total || 0);
            setTotalPages(res.total_pages || 1);
        } catch (e) { toast.error(e.message); }
        finally { setLoading(false); }
    }, [applied, page]);

    useEffect(() => { fetchData(applied, page); }, [applied, page]);

    const handleApply = (e) => {
        e.preventDefault();
        setPage(1);
        setApplied({ ...filters });
    };
    const handleReset = () => {
        const empty = { job_type: '', available_from: '', location_type: '', city: '', search: '' };
        setFilters(empty); setApplied({}); setPage(1);
    };
    const handlePageChange = (p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };

    const from = (page - 1) * PER_PAGE + 1;
    const to = Math.min(page * PER_PAGE, total);

    const inpS = {
        width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
        fontSize: 12.5, fontFamily: 'inherit', outline: 'none', color: '#1e293b', background: '#fff',
        transition: 'border .15s'
    };
    const labS = {
        fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
        letterSpacing: '.5px', display: 'block', marginBottom: 5
    };

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .ua-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .ua-inp:focus { border-color:#4f46e5!important; box-shadow:0 0 0 3px rgba(79,70,229,.1)!important; }
        @keyframes ua_spin { to { transform:rotate(360deg); } }
        .ua-spin { display:inline-block;width:18px;height:18px;border:2.5px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:ua_spin .7s linear infinite; }
        @keyframes ua_fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .ua-card-grid > * { animation: ua_fadein .22s ease both; }
      `}</style>

            <div className="ua-root" style={{
                display: 'flex', flexDirection: 'column',
                minHeight: 'calc(100vh - 62px)', padding: 20, gap: 14, background: '#f5f3ff'
            }}>

                {/* ── HEADER ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>👥 User Availability</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Browse and filter users by availability, job type and location</div>
                    </div>
                    {/* stat pill */}
                    <div style={{
                        padding: '8px 18px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                        borderRadius: 99, color: '#fff', fontSize: 13, fontWeight: 700,
                        boxShadow: '0 2px 8px rgba(79,70,229,.35)'
                    }}>
                        {loading ? '...' : total.toLocaleString('en-IN')} Users
                    </div>
                </div>

                {/* ── FILTERS CARD ── */}
                <div style={{
                    background: '#fff', borderRadius: 14, border: '1.5px solid #ede9fe',
                    padding: '18px 20px', flexShrink: 0, boxShadow: '0 1px 8px rgba(79,70,229,.06)'
                }}>
                    <form onSubmit={handleApply}>
                        {/* filter controls grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 14 }}>

                            {/* search */}
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={labS}>🔍 Search Name / Email / Phone</label>
                                <input className="ua-inp" style={inpS} value={filters.search}
                                    onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
                                    placeholder="Search users..." />
                            </div>

                            {/* job type */}
                            <div>
                                <label style={labS}>💼 Job Type</label>
                                <select className="ua-inp" style={{ ...inpS, cursor: 'pointer', appearance: 'auto' }}
                                    value={filters.job_type} onChange={e => setFilters(p => ({ ...p, job_type: e.target.value }))}>
                                    <option value="">All Types</option>
                                    <option value="internship">Internship</option>
                                    <option value="job">Job</option>
                                </select>
                            </div>

                            {/* available from */}
                            <div>
                                <label style={labS}>📅 Available From</label>
                                <select className="ua-inp" style={{ ...inpS, cursor: 'pointer', appearance: 'auto' }}
                                    value={filters.available_from} onChange={e => setFilters(p => ({ ...p, available_from: e.target.value }))}>
                                    <option value="">All Availability</option>
                                    <option value="now">Now</option>
                                    <option value="15days">15 Days</option>
                                    <option value="1month">1 Month</option>
                                    <option value="specific">Specific Date</option>
                                </select>
                            </div>

                            {/* location type */}
                            <div>
                                <label style={labS}>💻 Work Mode</label>
                                <select className="ua-inp" style={{ ...inpS, cursor: 'pointer', appearance: 'auto' }}
                                    value={filters.location_type} onChange={e => setFilters(p => ({ ...p, location_type: e.target.value }))}>
                                    <option value="">All Modes</option>
                                    <option value="remote">Remote</option>
                                    <option value="onsite">Onsite</option>
                                </select>
                            </div>

                            {/* city */}
                            <div>
                                <label style={labS}>📍 City</label>
                                <input className="ua-inp" style={inpS} value={filters.city}
                                    onChange={e => setFilters(p => ({ ...p, city: e.target.value }))}
                                    placeholder="Filter by city..." />
                            </div>
                        </div>

                        {/* actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button type="button" onClick={handleReset}
                                style={{
                                    padding: '8px 18px', border: '1.5px solid #e2e8f0', borderRadius: 8,
                                    background: '#fff', color: '#64748b', fontSize: 12.5, fontWeight: 600,
                                    cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6
                                }}>
                                🔄 Reset
                            </button>
                            <button type="submit"
                                style={{
                                    padding: '8px 22px', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                                    cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
                                    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                                    display: 'flex', alignItems: 'center', gap: 7,
                                    boxShadow: '0 2px 8px rgba(79,70,229,.3)'
                                }}>
                                🔍 Apply Filters
                            </button>
                        </div>
                    </form>
                </div>

                {/* ── RESULTS BAR ── */}
                {total > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 500 }}>
                            Showing <strong style={{ color: '#1e293b' }}>{from}–{to}</strong> of <strong style={{ color: '#4f46e5' }}>{total.toLocaleString('en-IN')}</strong> results
                        </div>
                        {loading && <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#64748b' }}>
                            <span className="ua-spin" /> Loading...
                        </div>}
                    </div>
                )}

                {/* ── CARD GRID ── */}
                {loading && !data.length ? (
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flex: 1, gap: 10, color: '#94a3b8', fontSize: 13
                    }}>
                        <span className="ua-spin" style={{ width: 28, height: 28, borderWidth: 3 }} />
                        Loading user availability data...
                    </div>
                ) : !data.length && !loading ? (
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', flex: 1, gap: 10, color: '#94a3b8'
                    }}>
                        <div style={{ fontSize: 44 }}>🧑‍💼</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#64748b' }}>No Users Found</div>
                        <div style={{ fontSize: 12.5 }}>Try adjusting your filters</div>
                    </div>
                ) : (
                    <div className="ua-card-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill,minmax(310px,1fr))',
                        gap: 14,
                    }}>
                        {data.map(row => <UserCard key={row.id} row={row} />)}
                    </div>
                )}

                {/* ── PAGINATION ── */}
                {totalPages > 1 && (
                    <div style={{ paddingTop: 8, paddingBottom: 8 }}>
                        <Pagination page={page} totalPages={totalPages} onChange={handlePageChange} />
                    </div>
                )}

            </div>
        </>
    );
}