import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Helmet } from "react-helmet-async";

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/support/instant_exam_wa_links.php';
const POLL_MS = 5000;
const post = d => fetch(API, { method: 'POST', body: new URLSearchParams(d) }).then(r => r.json());

/* ─── copy helper ─── */
const copyLink = txt =>
    navigator.clipboard.writeText(txt).then(() => toast.success('Copied!')).catch(() => toast.error('Failed'));

/* ─── status badge ─── */
const StatusBadge = ({ status }) => {
    const cfg = {
        active: { bg: '#dcfce7', color: '#15803d', dot: '#22c55e', label: 'Active' },
        close: { bg: '#fee2e2', color: '#b91c1c', dot: '#ef4444', label: 'Closed' },
        inactive: { bg: '#fef9c3', color: '#854d0e', dot: '#f59e0b', label: 'Inactive' },
    };
    const c = cfg[status?.toLowerCase()] || { bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af', label: status };
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 11px',
            borderRadius: 99, fontSize: 11.5, fontWeight: 700, background: c.bg, color: c.color
        }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
            {c.label}
        </span>
    );
};

/* ─── field label ─── */
const Label = ({ children }) => (
    <div style={{
        fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
        letterSpacing: '.05em', marginBottom: 5
    }}>{children}</div>
);

/* ─── input / select ─── */
const Inp = ({ type = 'text', value, onChange, placeholder, disabled }) => (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        style={{
            width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
            fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#1e293b',
            background: disabled ? '#f8f9fa' : '#fff', transition: 'border .15s'
        }}
        onFocus={e => e.target.style.borderColor = '#4f46e5'}
        onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
);
const Sel = ({ value, onChange, options }) => (
    <select value={value} onChange={e => onChange(e.target.value)}
        style={{
            width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
            fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#1e293b',
            background: '#fff', cursor: 'pointer', appearance: 'auto'
        }}
        onFocus={e => e.target.style.borderColor = '#4f46e5'}
        onBlur={e => e.target.style.borderColor = '#e2e8f0'}>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
);

/* ─── Add / Edit Modal ─── */
function LinkModal({ mode, initial, onClose, onSave }) {
    const [form, setForm] = useState(
        initial || { whatsapp_link: '', status: 'active', cit_version: '' }
    );
    const [saving, setSaving] = useState(false);

    const upd = k => v => setForm(p => ({ ...p, [k]: v }));

    const handleSave = async () => {
        if (!form.whatsapp_link.trim()) { toast.error('WhatsApp link is required'); return; }
        setSaving(true);
        await onSave(form);
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
                boxShadow: '0 24px 70px rgba(0,0,0,.2)', overflow: 'hidden'
            }}>

                {/* modal header */}
                <div style={{
                    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                    padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>
                        {mode === 'add' ? '➕ Add New Link' : '✏️ Edit Link'}
                    </div>
                    <button onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 7,
                            width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 16,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>×</button>
                </div>

                {/* modal body */}
                <div style={{ padding: '22px 22px 18px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* WhatsApp Link */}
                        <div>
                            <Label>WhatsApp Link *</Label>
                            <Inp value={form.whatsapp_link} onChange={upd('whatsapp_link')}
                                placeholder="https://chat.whatsapp.com/..." />
                        </div>
                        {/* Status */}
                        <div>
                            <Label>Status</Label>
                            <Sel value={form.status} onChange={upd('status')}
                                options={[
                                    { v: 'active', l: 'Active' },
                                    { v: 'close', l: 'Closed' },
                                    // { v:'inactive', l:'Inactive' },  // commented out same as PHP
                                ]} />
                        </div>
                        {/* CIT Version */}
                        <div>
                            <Label>CIT Version</Label>
                            <Inp value={form.cit_version} onChange={upd('cit_version')}
                                placeholder="e.g. v1.0 or 2025.10" />
                        </div>
                    </div>
                </div>

                {/* modal footer */}
                <div style={{ padding: '0 22px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
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
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{
                background: '#fff', borderRadius: 14, padding: '24px 26px', width: 380,
                maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,.2)', textAlign: 'center'
            }}>
                <div style={{ fontSize: 38, marginBottom: 12 }}>🗑️</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Delete Link?</div>
                <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 20 }}>
                    This will permanently remove link ID <strong>#{row.id}</strong>. This cannot be undone.
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
export default function InstantExamWALinks() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);  // null | { mode:'add'|'edit', row?:obj }
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
    // useEffect(() => {
    //     clearInterval(pollRef.current);
    //     if (live) pollRef.current = setInterval(() => fetchRows(true), POLL_MS);
    //     return () => clearInterval(pollRef.current);
    // }, [live, fetchRows]);

    /* ── add ── */
    const handleAdd = async (form) => {
        const res = await post({ action: 'add', ...form });
        if (res.success) { toast.success(res.message); setModal(null); fetchRows(); }
        else toast.error(res.message || 'Failed');
    };

    /* ── update ── */
    const handleUpdate = async (form) => {
        const res = await post({ action: 'update', id: modal.row.id, ...form });
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

    /* ─── table styles ─── */
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

    /* ─── status summary ─── */
    const counts = rows.reduce((a, r) => {
        const k = r.status || 'inactive'; a[k] = (a[k] || 0) + 1; return a;
    }, {});

    return (
        <>
        <Helmet>
        <title>Instant Exam WA Link | Admin Panel</title>
      </Helmet>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .iew-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .iew-tr:hover td { background:#faf9ff!important; }
        @keyframes iew_spin { to { transform:rotate(360deg); } }
        .iew-spin { display:inline-block;width:18px;height:18px;border:2.5px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:iew_spin .7s linear infinite; }
        @keyframes iew_pulse { 0%,100%{opacity:1}50%{opacity:.5} }
        .live-dot { display:inline-block;width:7px;height:7px;border-radius:50%;background:#22c55e;animation:iew_pulse 2s infinite; }
      `}</style>

            <div className="iew-root" style={{
                display: 'flex', flexDirection: 'column',
                height: 'calc(100vh - 62px)', padding: 20, gap: 14, overflow: 'hidden', background: '#f5f3ff'
            }}>

                {/* ── HEADER ── */}
                <div style={{
                    flexShrink: 0, display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', flexWrap: 'wrap', gap: 10
                }}>
                    <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>📲 Instant Exam WhatsApp Links</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            Manage WhatsApp group links for instant exam candidates
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {/* live badge */}
                        {/* <div style={{
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
                        )} */}
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
                            ➕ Add New Link
                        </button>
                    </div>
                </div>

                {/* ── STAT CHIPS ── */}
                <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
                    {[
                        { key: 'active', label: 'Active', bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' },
                        { key: 'close', label: 'Closed', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
                        { key: 'inactive', label: 'Inactive', bg: '#fef9c3', color: '#854d0e', border: '#fde68a' },
                    ].map(s => (
                        <div key={s.key} style={{
                            background: s.bg, border: `1.5px solid ${s.border}`,
                            borderRadius: 10, padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 8
                        }}>
                            <span style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{counts[s.key] || 0}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</span>
                        </div>
                    ))}
                    <div style={{
                        background: '#ede9fe', border: '1.5px solid #c4b5fd',
                        borderRadius: 10, padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 8
                    }}>
                        <span style={{ fontSize: 20, fontWeight: 800, color: '#4f46e5' }}>{rows.length}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '.04em' }}>Total</span>
                    </div>
                </div>

                {/* ── TABLE CARD ── */}
                <div style={{
                    flex: 1, minHeight: 0, background: '#fff', borderRadius: 14,
                    border: '1.5px solid #ede9fe', display: 'flex', flexDirection: 'column',
                    overflow: 'hidden', boxShadow: '0 1px 8px rgba(79,70,229,.07)'
                }}>

                    {/* live bar */}
                    <div style={{
                        padding: '7px 16px', background: '#f0fdf4', borderBottom: '1.5px solid #bbf7d0',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
                    }}>
                        {/* <div style={{
                            display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5,
                            color: '#15803d', fontWeight: 500
                        }}>
                            {loading
                                ? <><span className="iew-spin" /> Loading...</>
                                : <><span className="live-dot" /> {rows.length} links — auto-refreshing every {POLL_MS / 1000}s</>}
                        </div> */}
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>Active rows highlighted</div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
                            <thead>
                                <tr>
                                    {['ID', 'WhatsApp Link', 'Status', 'CIT Version', 'Created At', 'Updated At', 'Action'].map(h => (
                                        <th key={h} style={thS}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {!rows.length && !loading ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 50, color: '#94a3b8' }}>
                                        <div style={{ fontSize: 40, marginBottom: 10 }}>📲</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>No links found</div>
                                        <div style={{ fontSize: 12, marginTop: 4 }}>Click "+ Add New Link" to create one</div>
                                    </td></tr>
                                ) : rows.map(row => {
                                    const isActive = row.status === 'active';
                                    return (
                                        <tr key={row.id} className="iew-tr"
                                            style={{ background: isActive ? 'rgba(34,197,94,.04)' : 'transparent' }}>

                                            {/* ID */}
                                            <td style={{ ...tdS, fontFamily: 'monospace', color: '#6b7280', fontSize: 12 }}>
                                                {row.id}
                                            </td>

                                            {/* Link */}
                                            <td style={{ ...tdS, maxWidth: 280 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                    <a href={row.whatsapp_link} target="_blank" rel="noreferrer"
                                                        style={{
                                                            color: '#4f46e5', fontSize: 12, overflow: 'hidden',
                                                            textOverflow: 'ellipsis', maxWidth: 230, display: 'block',
                                                            whiteSpace: 'nowrap'
                                                        }}>
                                                        {row.whatsapp_link}
                                                    </a>
                                                    <button onClick={() => copyLink(row.whatsapp_link)}
                                                        style={{
                                                            background: 'none', border: 'none', cursor: 'pointer',
                                                            color: '#94a3b8', fontSize: 13, padding: 2, flexShrink: 0
                                                        }}>📋</button>
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td style={tdS}><StatusBadge status={row.status} /></td>

                                            {/* CIT Version */}
                                            <td style={tdS}>
                                                {row.cit_version
                                                    ? <span style={{
                                                        background: '#ede9fe', color: '#4f46e5', padding: '2px 9px',
                                                        borderRadius: 99, fontSize: 11.5, fontWeight: 700
                                                    }}>{row.cit_version}</span>
                                                    : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>}
                                            </td>

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
                                                    <button onClick={() => setModal({ mode: 'edit', row })}
                                                        style={{
                                                            padding: '5px 12px', border: 'none', borderRadius: 7,
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

                    {/* footer */}
                    <div style={{
                        padding: '8px 16px', borderTop: '1.5px solid #f5f3ff', flexShrink: 0,
                        fontSize: 11.5, color: '#94a3b8', display: 'flex', justifyContent: 'space-between'
                    }}>
                        <span>Table: <code style={{
                            background: '#f5f3ff', padding: '1px 5px',
                            borderRadius: 4, color: '#4f46e5', fontSize: 11
                        }}>instant_exam_whatsapp_link</code></span>
                        <span>{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>
            </div>

            {/* ── MODALS ── */}
            {modal?.mode === 'add' && (
                <LinkModal mode="add" initial={null}
                    onClose={() => setModal(null)} onSave={handleAdd} />
            )}
            {modal?.mode === 'edit' && (
                <LinkModal mode="edit"
                    initial={{ whatsapp_link: modal.row.whatsapp_link, status: modal.row.status, cit_version: modal.row.cit_version || '' }}
                    onClose={() => setModal(null)} onSave={handleUpdate} />
            )}
            {delRow && (
                <DeleteModal row={delRow}
                    onClose={() => setDelRow(null)} onConfirm={handleDelete} />
            )}
        </>
    );
}