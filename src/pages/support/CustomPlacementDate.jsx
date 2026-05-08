import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Helmet } from "react-helmet-async";

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/support/custom_placement_dates.php';
const POLL_MS = 5000;
const post = d => fetch(API, { method: 'POST', body: new URLSearchParams(d) }).then(r => r.json());

/* ─── parse dates JSON safely ─── */
const parseDates = s => { try { const d = JSON.parse(s); return Array.isArray(d) ? d : []; } catch { return []; } };

/* ─── format date for display ─── */
const fmtDate = d => {
    if (!d) return '—';
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
};

/* ─── status badge ─── */
const StatusBadge = ({ status }) => {
    const isActive = status === 'active';
    return (
        <span style={{
            padding: '4px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, color: '#fff',
            background: isActive
                ? 'linear-gradient(135deg,#16a34a,#15803d)'
                : 'linear-gradient(135deg,#dc2626,#b91c1c)'
        }}>
            {isActive ? '✅ Active' : '🔴 Closed'}
        </span>
    );
};

/* ─── single date input row ─── */
const DateRow = ({ value, onChange, onRemove, canRemove }) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input type="date" value={value} onChange={e => onChange(e.target.value)}
            style={{
                flex: 1, padding: '8px 11px', border: '1.5px solid #e2e8f0', borderRadius: 8,
                fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#1e293b',
                transition: 'border .15s'
            }}
            onFocus={e => e.target.style.borderColor = '#4f46e5'}
            onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
        {canRemove && (
            <button onClick={onRemove}
                style={{
                    width: 30, height: 30, border: 'none', borderRadius: 7, background: '#fee2e2',
                    color: '#dc2626', fontSize: 16, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700
                }}>
                ×
            </button>
        )}
    </div>
);

/* ─── Add / Edit Modal ─── */
function DatesModal({ mode, initial, onClose, onSave }) {
    const [dateList, setDateList] = useState(
        initial?.dates?.length ? initial.dates : ['']
    );
    const [status, setStatus] = useState(initial?.status || 'active');
    const [saving, setSaving] = useState(false);

    const addDate = () => setDateList(p => [...p, '']);
    const updateDate = (i, v) => setDateList(p => p.map((d, idx) => idx === i ? v : d));
    const removeDate = (i) => setDateList(p => p.filter((_, idx) => idx !== i));

    const handleSave = async () => {
        const cleaned = dateList.filter(d => d.trim());
        if (!cleaned.length) { toast.error('Add at least one date'); return; }
        setSaving(true);
        await onSave({ dates: JSON.stringify(cleaned), status });
        setSaving(false);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{
                background: '#fff', borderRadius: 16, width: 460, maxWidth: '94vw',
                maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 24px 70px rgba(0,0,0,.2)', overflow: 'hidden'
            }}>

                {/* header */}
                <div style={{
                    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                    padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexShrink: 0
                }}>
                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>
                        {mode === 'add' ? '➕ Add Custom Dates' : '✏️ Edit Custom Dates'}
                    </div>
                    <button onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 7,
                            width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 16,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>×</button>
                </div>

                {/* body */}
                <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>

                    {/* Date inputs */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{
                            fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
                            letterSpacing: '.05em', marginBottom: 8
                        }}>
                            📅 Dates ({dateList.filter(d => d).length} selected)
                        </div>
                        {dateList.map((d, i) => (
                            <DateRow key={i} value={d}
                                onChange={v => updateDate(i, v)}
                                onRemove={() => removeDate(i)}
                                canRemove={dateList.length > 1} />
                        ))}
                        <button onClick={addDate}
                            style={{
                                padding: '7px 14px', border: '1.5px dashed #c4b5fd', borderRadius: 8,
                                background: '#f8f5ff', color: '#4f46e5', fontSize: 12.5, fontWeight: 700,
                                cursor: 'pointer', fontFamily: 'inherit', marginTop: 4,
                                display: 'flex', alignItems: 'center', gap: 6
                            }}>
                            ＋ Add Another Date
                        </button>
                    </div>

                    {/* Status */}
                    <div>
                        <div style={{
                            fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
                            letterSpacing: '.05em', marginBottom: 6
                        }}>Status</div>
                        <select value={status} onChange={e => setStatus(e.target.value)}
                            style={{
                                width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
                                fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#1e293b',
                                background: '#fff', cursor: 'pointer', appearance: 'auto'
                            }}
                            onFocus={e => e.target.style.borderColor = '#4f46e5'}
                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}>
                            <option value="active">Active</option>
                            <option value="close">Close</option>
                        </select>
                    </div>
                </div>

                {/* footer */}
                <div style={{
                    padding: '0 22px 20px', display: 'flex', justifyContent: 'flex-end',
                    gap: 10, flexShrink: 0
                }}>
                    <button onClick={onClose}
                        style={{
                            padding: '9px 18px', border: '1.5px solid #e2e8f0', borderRadius: 8,
                            background: '#fff', color: '#475569', fontSize: 12.5, fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'inherit'
                        }}>Cancel</button>
                    <button onClick={handleSave} disabled={saving}
                        style={{
                            padding: '9px 24px', border: 'none', borderRadius: 8, fontSize: 12.5,
                            fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', color: '#fff',
                            fontFamily: 'inherit', opacity: saving ? .7 : 1,
                            background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                            display: 'flex', alignItems: 'center', gap: 7
                        }}>
                        {saving ? '⏳ Saving...' : '💾 Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── confirm delete modal ─── */
function DeleteModal({ row, onClose, onConfirm }) {
    const [loading, setLoading] = useState(false);
    const dates = parseDates(row.dates);
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{
                background: '#fff', borderRadius: 14, padding: '24px 26px', width: 390,
                maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,.2)', textAlign: 'center'
            }}>
                <div style={{ fontSize: 38, marginBottom: 12 }}>🗑️</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Delete Record #{row.id}?</div>
                <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 6 }}>
                    This will remove the following dates:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 18 }}>
                    {dates.map((d, i) => (
                        <span key={i} style={{
                            background: '#f5f3ff', color: '#4f46e5', padding: '3px 10px',
                            borderRadius: 7, fontSize: 12, fontWeight: 600
                        }}>{fmtDate(d)}</span>
                    ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                    <button onClick={onClose}
                        style={{
                            padding: '8px 18px', border: '1.5px solid #e2e8f0', borderRadius: 8,
                            background: '#fff', color: '#475569', fontSize: 12.5, fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'inherit'
                        }}>Cancel</button>
                    <button disabled={loading}
                        onClick={async () => { setLoading(true); await onConfirm(row.id); setLoading(false); onClose(); }}
                        style={{
                            padding: '8px 20px', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                            cursor: loading ? 'not-allowed' : 'pointer', color: '#fff', fontFamily: 'inherit',
                            background: 'linear-gradient(135deg,#dc2626,#b91c1c)', opacity: loading ? .7 : 1
                        }}>
                        {loading ? '⏳...' : '🗑️ Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
export default function CustomPlacementDates() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // null | { mode:'add'|'edit', row? }
    const [delRow, setDelRow] = useState(null);
    const [lastSync, setLastSync] = useState(null);
    const [live, setLive] = useState(true);
    const pollRef = useRef(null);

    /* ── fetch ── */
    const fetchRows = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await post({ action: 'fetch_all' });
            if (res.success) { setRows(res.data || []); setLastSync(new Date()); }
        } catch (e) { if (!silent) toast.error(e.message); }
        finally { if (!silent) setLoading(false); }
    }, []);

    useEffect(() => { fetchRows(); }, [fetchRows]);

    /* ── real-time polling ── */
    useEffect(() => {
        clearInterval(pollRef.current);
        if (live) pollRef.current = setInterval(() => fetchRows(true), POLL_MS);
        return () => clearInterval(pollRef.current);
    }, [live, fetchRows]);

    /* ── add ── */
    const handleAdd = async ({ dates, status }) => {
        const res = await post({ action: 'add', dates, status });
        if (res.success) { toast.success(res.message); setModal(null); fetchRows(); }
        else toast.error(res.message || 'Failed');
    };

    /* ── update ── */
    const handleUpdate = async ({ dates, status }) => {
        const res = await post({ action: 'update', id: modal.row.id, dates, status });
        if (res.success) { toast.success(res.message); setModal(null); fetchRows(); }
        else toast.error(res.message || 'Failed');
    };

    /* ── delete ── */
    const handleDelete = async (id) => {
        const res = await post({ action: 'delete', id });
        if (res.success) toast.success(res.message);
        else toast.error(res.message || 'Failed');
        fetchRows();
    };

    /* ─── counts ─── */
    const activeCount = rows.filter(r => r.status === 'active').length;
    const closedCount = rows.filter(r => r.status === 'close').length;

    const thS = {
        padding: '11px 14px', fontSize: 10.5, fontWeight: 700, color: '#fff',
        textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap',
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
        <title>Custom Placement Date | Admin Panel</title>
      </Helmet>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .cpd-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .cpd-tr:hover td { background:#faf9ff!important; }
        @keyframes cpd_spin { to { transform:rotate(360deg); } }
        .cpd-spin { display:inline-block;width:18px;height:18px;border:2.5px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:cpd_spin .7s linear infinite; }
        @keyframes cpd_pulse { 0%,100%{opacity:1}50%{opacity:.5} }
        .live-dot { display:inline-block;width:7px;height:7px;border-radius:50%;background:#22c55e;animation:cpd_pulse 2s infinite; }
      `}</style>

            <div className="cpd-root" style={{
                display: 'flex', flexDirection: 'column',
                height: 'calc(100vh - 62px)', padding: 20, gap: 14, overflow: 'hidden', background: '#f5f3ff'
            }}>

                {/* ── HEADER ── */}
                <div style={{
                    flexShrink: 0, display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', flexWrap: 'wrap', gap: 10
                }}>
                    <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>📅 Custom Dates for Placement Link</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            Set and manage custom date windows for placement link visibility
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {/* live pill */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                            background: '#fff', borderRadius: 8, border: '1.5px solid #e2e8f0',
                            fontSize: 12, fontWeight: 600, color: '#64748b'
                        }}>
                            {live && <span className="live-dot" />}
                            <span style={{ color: live ? '#15803d' : '#64748b' }}>
                                {live ? `Live (${POLL_MS / 1000}s)` : 'Paused'}
                            </span>
                            <button onClick={() => setLive(p => !p)}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    fontSize: 11, color: '#4f46e5', fontWeight: 700, marginLeft: 2
                                }}>
                                {live ? 'Pause' : 'Resume'}
                            </button>
                        </div>
                        {lastSync && (
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>
                                🕐 {lastSync.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                        )}
                        <button onClick={() => fetchRows()}
                            style={{
                                padding: '7px 13px', border: '1.5px solid #e2e8f0', borderRadius: 8,
                                background: '#fff', color: '#64748b', fontSize: 12.5, fontWeight: 600,
                                cursor: 'pointer', fontFamily: 'inherit'
                            }}>🔄</button>
                        <button onClick={() => setModal({ mode: 'add' })}
                            style={{
                                padding: '8px 18px', border: 'none', borderRadius: 8, fontSize: 13,
                                fontWeight: 700, cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
                                background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                                display: 'flex', alignItems: 'center', gap: 7
                            }}>
                            ➕ Add Dates
                        </button>
                    </div>
                </div>

                {/* ── STAT CHIPS ── */}
                <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Active', value: activeCount, bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' },
                        { label: 'Closed', value: closedCount, bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
                        { label: 'Total', value: rows.length, bg: '#ede9fe', color: '#4f46e5', border: '#c4b5fd' },
                    ].map(s => (
                        <div key={s.label} style={{
                            background: s.bg, border: `1.5px solid ${s.border}`,
                            borderRadius: 10, padding: '9px 18px', display: 'flex', alignItems: 'center', gap: 9
                        }}>
                            <span style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</span>
                            <span style={{
                                fontSize: 11, fontWeight: 700, color: s.color,
                                textTransform: 'uppercase', letterSpacing: '.04em'
                            }}>{s.label}</span>
                        </div>
                    ))}
                </div>

                {/* ── TABLE CARD ── */}
                <div style={{
                    flex: 1, minHeight: 0, background: '#fff', borderRadius: 14,
                    border: '1.5px solid #ede9fe', display: 'flex', flexDirection: 'column',
                    overflow: 'hidden', boxShadow: '0 1px 8px rgba(79,70,229,.07)'
                }}>

                    {/* live banner */}
                    <div style={{
                        padding: '7px 16px', background: '#f0fdf4', borderBottom: '1.5px solid #bbf7d0',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5,
                            color: '#15803d', fontWeight: 500
                        }}>
                            {loading
                                ? <><span className="cpd-spin" /> Loading...</>
                                : <><span className="live-dot" /> {rows.length} records — auto-refreshing every {POLL_MS / 1000}s</>}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                            Table: <code style={{
                                background: '#f5f3ff', padding: '1px 5px', borderRadius: 4,
                                color: '#4f46e5', fontSize: 10.5
                            }}>set_custom_date_for_placement_link</code>
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 800 }}>
                            <thead>
                                <tr>
                                    {['ID', 'Dates', 'Status', 'Created At', 'Updated At', 'Action'].map(h => (
                                        <th key={h} style={thS}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {!rows.length && !loading ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 50, color: '#94a3b8' }}>
                                        <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>No records found</div>
                                        <div style={{ fontSize: 12, marginTop: 4 }}>Click "Add Dates" to create one</div>
                                    </td></tr>
                                ) : rows.map(row => {
                                    const dates = parseDates(row.dates);
                                    const isActive = row.status === 'active';
                                    return (
                                        <tr key={row.id} className="cpd-tr"
                                            style={{ background: isActive ? 'rgba(34,197,94,.04)' : 'transparent' }}>

                                            {/* ID */}
                                            <td style={{ ...tdS, fontFamily: 'monospace', color: '#6b7280', fontSize: 12 }}>
                                                #{row.id}
                                            </td>

                                            {/* Dates — chips */}
                                            <td style={{ ...tdS, maxWidth: 360 }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                    {dates.length ? dates.map((d, i) => (
                                                        <span key={i} style={{
                                                            background: '#f5f3ff', color: '#4f46e5',
                                                            padding: '3px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                                                            whiteSpace: 'nowrap'
                                                        }}>
                                                            📅 {fmtDate(d)}
                                                        </span>
                                                    )) : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>}
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td style={tdS}><StatusBadge status={row.status} /></td>

                                            {/* Created At */}
                                            <td style={{ ...tdS, fontSize: 11.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                                {row.created_at}
                                            </td>

                                            {/* Updated At */}
                                            <td style={{ ...tdS, fontSize: 11.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                                {row.updated_at}
                                            </td>

                                            {/* Action */}
                                            <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'flex', gap: 7 }}>
                                                    <button
                                                        onClick={() => setModal({ mode: 'edit', row })}
                                                        style={{
                                                            padding: '5px 13px', border: 'none', borderRadius: 7,
                                                            fontSize: 11.5, fontWeight: 700, cursor: 'pointer', color: '#fff',
                                                            fontFamily: 'inherit',
                                                            background: 'linear-gradient(135deg,#0ea5e9,#0284c7)'
                                                        }}>
                                                        ✏️ Edit
                                                    </button>
                                                    <button onClick={() => setDelRow(row)}
                                                        style={{
                                                            padding: '5px 12px', border: 'none', borderRadius: 7,
                                                            fontSize: 11.5, fontWeight: 700, cursor: 'pointer', color: '#fff',
                                                            fontFamily: 'inherit',
                                                            background: 'linear-gradient(135deg,#dc2626,#b91c1c)'
                                                        }}>
                                                        🗑️ Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── MODALS ── */}
            {modal?.mode === 'add' && (
                <DatesModal mode="add" initial={null}
                    onClose={() => setModal(null)} onSave={handleAdd} />
            )}
            {modal?.mode === 'edit' && (
                <DatesModal mode="edit"
                    initial={{ dates: parseDates(modal.row.dates), status: modal.row.status }}
                    onClose={() => setModal(null)} onSave={handleUpdate} />
            )}
            {delRow && (
                <DeleteModal row={delRow}
                    onClose={() => setDelRow(null)} onConfirm={handleDelete} />
            )}
        </>
    );
}