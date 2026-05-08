import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Briefcase, Headphones, FileText } from "lucide-react";

const API = '/api/students/search_result.php';
const FH = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk = obj => new URLSearchParams(obj);

/* ─── badge helper ─── */
function Badge({ color, children }) {
    const map = {
        success: { bg: '#dcfce7', color: '#16a34a' },
        danger: { bg: '#fee2e2', color: '#dc2626' },
        warning: { bg: '#fef9c3', color: '#854d0e' },
        blue: { bg: '#dbeafe', color: '#2563eb' },
        purple: { bg: '#ede9fe', color: '#7c3aed' },
        gray: { bg: '#f1f5f9', color: '#64748b' },
        green: { bg: '#dcfce7', color: '#16a34a' },
    };
    const s = map[color] || map.gray;
    return (
        <span style={{
            padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
            background: s.bg, color: s.color, display: 'inline-block'
        }}>
            {children}
        </span>
    );
}

/* ─── copy button ─── */
function Copy({ text }) {
    return (
        <button onClick={() => { navigator.clipboard.writeText(text); toast.success('Copied!'); }}
            style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
                fontSize: 11, padding: '0 3px', verticalAlign: 'middle'
            }}>
            ⧉
        </button>
    );
}

/* ─── section card ─── */
function Section({ icon, iconColor, title, badge, children, footer }) {
    return (
        <div style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 14px', borderBottom: '1px solid #f1f5f9', flexShrink: 0
            }}>
                <h4 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {/* <span style={{ fontSize: 13 }}>{icon}</span> */}
                    <span style={{ display: 'flex', alignItems: 'center' }}>
    {icon}
</span>
                    {title}
                </h4>
                {badge}
            </div>
            <div style={{ padding: '8px 14px', overflowY: 'auto', flex: 1 }}>{children}</div>
            {footer && <div style={{ padding: '0 14px 8px', flexShrink: 0 }}>{footer}</div>}
        </div>
    );
}

/* ─── mini table ─── */
function MiniTable({ headers, rows }) {
    if (!rows.length) return (
        <div style={{ textAlign: 'center', padding: 16, color: '#94a3b8', fontSize: 12 }}>No data</div>
    );
    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead>
                <tr>
                    {headers.map(h => (
                        <th key={h} style={{
                            background: '#f8fafc', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                            color: '#64748b', padding: '5px 8px', textAlign: 'left', letterSpacing: '.04em'
                        }}>{h}</th>
                    ))}
                </tr>
            </thead>
            <tbody>{rows}</tbody>
        </table>
    );
}

/* ─── modal ─── */
function Modal({ title, onClose, children }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
            <div style={{
                background: '#fff', borderRadius: 14, width: '100%', maxWidth: 900,
                maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 60px rgba(0,0,0,.2)'
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px', borderBottom: '1px solid #e2e8f0', flexShrink: 0
                }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{title}</span>
                    <button onClick={onClose} style={{
                        width: 30, height: 30, borderRadius: 8, background: '#f1f5f9',
                        border: 'none', cursor: 'pointer', fontSize: 16, color: '#64748b', display: 'flex',
                        alignItems: 'center', justifyContent: 'center'
                    }}>×</button>
                </div>
                <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>{children}</div>
            </div>
        </div>
    );
}

const tdS = { padding: '5px 8px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', verticalAlign: 'middle' };

export default function SearchResult() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const query = params.get('q') || '';

    const [loading, setLoading] = useState(true);
    const [multiple, setMultiple] = useState([]);
    const [user, setUser] = useState(null);
    const [internships, setInternships] = useState([]);
    const [exam, setExam] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [payments, setPayments] = useState([]);
    const [hasRefund, setHasRefund] = useState(false);
    const [modal, setModal] = useState(null); // { title, type }

    useEffect(() => {
        if (!query) return;
        let cancelled = false;

        setLoading(true);
        setMultiple([]); setUser(null);
        setInternships([]); setExam(null); setTickets([]); setPayments([]);

        api.post(API, mk({ action: 'search', query }), FH)
            .then(res => {
                if (cancelled) return;
                const d = res.data;
                if (!d.success) { toast.error(d.message || 'Not found'); return; }
                if (d.multiple) { setMultiple(d.users); return; }
                setUser(d.user);
                setInternships(d.internships || []);
                setExam(d.exam);
                setTickets(d.tickets || []);
                setPayments(d.payments || []);
                setHasRefund(d.has_refund || false);
            })
            .catch(() => { if (!cancelled) toast.error('Server error'); })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [query]);

    /* ── derived ── */
    const regDate = user?.registered_at ? new Date(user.registered_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
    const isRegistered = !!user?.applyforexam;
    const hasExam = !!exam;
    const internCount = internships.length;
    const latestInternDate = internCount > 0 ? new Date(internships[0].paid_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <div style={{
                width: 36, height: 36, border: '3px solid #ede9fe', borderTop: '3px solid #4f46e5',
                borderRadius: '50%', animation: 'spin .7s linear infinite'
            }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    /* ── multiple users selection ── */
    if (multiple.length > 0) return (
        <div style={{ background: '#f5f3ff', minHeight: '100vh', padding: 24 }}>
            <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #ede9fe', padding: 24, maxWidth: 500 }}>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>
                    Multiple accounts found — select one:
                </h4>
                {multiple.map(u => (
                    <div key={u.user_id}
                        onClick={() => navigate(`/search_result?q=${encodeURIComponent(u.email)}`)}
                        style={{
                            padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, marginBottom: 8,
                            cursor: 'pointer', fontSize: 13, color: '#1e293b', fontWeight: 500
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        <strong>#{u.user_id}</strong> — {u.email} / {u.phone}
                    </div>
                ))}
            </div>
        </div>
    );

    if (!user) return (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>User not found for "{query}"</div>
    );

    const fullName = `${user.fname || ''} ${user.lname || ''}`.trim() || user.name || 'Unknown';

    /* ── funnel steps ── */
    const funnelSteps = [
        { label: 'Registered', icon: '✓', done: isRegistered, val: isRegistered ? regDate : 'No' },
        { label: 'Exam', icon: '📝', done: hasExam, val: hasExam ? (exam?.rank ? 'Result Published' : 'Pending') : 'Not Given' },
        { label: 'Internship', icon: '💼', done: internCount > 0, val: internCount > 0 ? `${internCount} purchased` : 'None', sub: latestInternDate },
        { label: 'Tickets', icon: '🎧', done: tickets.length > 0, warn: tickets.length > 0, val: `${tickets.length} total` },
        { label: 'Payments', icon: '🧾', done: payments.length > 0, val: `${payments.length} records` },
    ];

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .sr-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .sr-viewmore{width:100%;padding:5px 14px;background:#eef2ff;color:#4f46e5;border:none;
          border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;}
        .sr-viewmore:hover{background:#e0e7ff;}
        @keyframes sr_spin{to{transform:rotate(360deg)}}
      `}</style>

            <div className="sr-root" style={{
                display: 'flex', flexDirection: 'column', gap: 10,
                padding: '12px 16px', height: 'calc(100vh - 62px)', overflow: 'hidden'
            }}>

                {/* ── FUNNEL ── */}
                <div style={{
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                    padding: '12px 20px', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', flexShrink: 0
                }}>
                    {funnelSteps.map((s, i) => (
                        <div key={s.label} style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            flex: 1, position: 'relative'
                        }}>
                            {i < funnelSteps.length - 1 && (
                                <span style={{ position: 'absolute', right: -12, top: '30%', color: '#94a3b8', fontSize: 16 }}>→</span>
                            )}
                            <div style={{
                                width: 36, height: 36, borderRadius: '50%', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', fontSize: 14, marginBottom: 4,
                                background: s.done ? '#dcfce7' : '#f1f5f9',
                                color: s.done ? '#16a34a' : '#94a3b8'
                            }}>
                                <span style={{ fontSize: 15 }}>{s.icon}</span>
                            </div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', marginTop: 1 }}>{s.val}</div>
                            {s.sub && <div style={{ fontSize: 10, color: '#94a3b8' }}>{s.sub}</div>}
                        </div>
                    ))}
                </div>

                {/* ── TOP ROW: user card + exam ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flexShrink: 0 }}>

                    {/* USER CARD */}
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div>
                                <p style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#0f172a' }}>{fullName}</p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                    <Badge color="gray">#{user.user_id}</Badge>
                                    <Badge color="blue">{user.role == 1 ? 'Admin' : user.role == 4 ? 'Student' : user.role == 3 ? 'CA' : 'User'}</Badge>
                                    <Badge color={isRegistered ? 'success' : 'danger'}>{isRegistered ? 'Registered' : 'Not Registered'}</Badge>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px',
                                        borderRadius: 99, fontSize: 11, fontWeight: 600,
                                        background: user.wa_community_added ? '#dcfce7' : '#fee2e2',
                                        color: user.wa_community_added ? '#16a34a' : '#dc2626'
                                    }}>
                                        💬{user.wa_community_added ? ' WA Added' : ' WA Not Added'}
                                    </span>
                                </div>
                            </div>
                            <Link to={`/students/edit/${user.user_id}`}><p style={{
                                padding: '5px 14px', borderRadius: 7, background: '#fef9c3', color: '#854d0e',
                                fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'inline-flex',
                                alignItems: 'center', gap: 5
                            }}>
                                ✏️ Edit
                            </p>
                            </Link>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12, color: '#475569' }}>
                            <div><strong style={{ color: '#0f172a' }}>Email</strong><br />
                                {user.email} <Copy text={user.email} />
                            </div>
                            <div><strong style={{ color: '#0f172a' }}>Phone</strong><br />
                                {user.phone || 'N/A'}{user.phone && <Copy text={user.phone} />}
                            </div>
                            {/* <div><strong style={{ color: '#0f172a' }}>Location</strong><br />
                                {[user.state, user.country].filter(Boolean).join(', ') || 'N/A'}
                            </div> */}
                            {user.state && (
  <div>
    <strong style={{ color: '#0f172a' }}>Location</strong><br />
    {[user.state, user.country].filter(Boolean).join(', ')}
  </div>
)}
                            <div><strong style={{ color: '#0f172a' }}>CIT Version</strong><br />
                                {user.cit_version_name || '-'}
                            </div>
                            <div><strong style={{ color: '#0f172a' }}>Registered At</strong><br />{regDate}</div>
                            <div><strong style={{ color: '#0f172a' }}>Instant Exam</strong><br />
                                <span style={{ color: user.instant_exam ? '#16a34a' : '#94a3b8' }}>
                                    {user.instant_exam ? 'On' : 'Off'}
                                </span>
                            </div>
                            <div><strong style={{ color: '#0f172a' }}>Refund Program</strong><br />
                                <span style={{ color: (user.is_from_refund === 'yes' || user.is_from_refund == 1) ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                                    {(user.is_from_refund === 'yes' || user.is_from_refund == 1) ? 'Yes' : 'No'}
                                </span>
                            </div>
                            <div><strong style={{ color: '#0f172a' }}>Refund (Exam Date)</strong><br />
                                <span style={{ color: hasRefund ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                                    {hasRefund ? 'Yes' : 'No'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* EXAM CARD */}
                    <Section icon="📝" iconColor="#4f46e5" title="Exam Data"
                        badge={<Badge color={hasExam ? (exam?.rank ? 'success' : 'warning') : 'gray'}>
                            {hasExam ? (exam?.rank ? 'Result Published' : 'Pending') : 'Not Given'}
                        </Badge>}>
                        {user.exam_password && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc',
                                borderRadius: 7, padding: '6px 10px', marginBottom: 8, fontSize: 12
                            }}>
                                <strong>Password:</strong>
                                <code style={{ background: '#e0e7ff', color: '#4f46e5', padding: '1px 6px', borderRadius: 4 }}>
                                    {user.exam_password}
                                </code>
                                <Copy text={user.exam_password} />
                            </div>
                        )}
                        {hasExam ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                {[
                                    { val: exam.rightans ?? '-', lbl: 'Correct', color: '#22c55e' },
                                    { val: exam.wrongans ?? '-', lbl: 'Wrong', color: '#ef4444' },
                                    { val: exam.rank ?? 'N/A', lbl: 'Rank', color: '#0f172a' },
                                    { val: exam.exam_taken_date ? new Date(exam.exam_taken_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A', lbl: 'Date', color: '#0f172a', small: true },
                                ].map(b => (
                                    <div key={b.lbl} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                                        <div style={{ fontSize: b.small ? 13 : 20, fontWeight: 800, color: b.color }}>{b.val}</div>
                                        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{b.lbl}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: 16, color: '#94a3b8', fontSize: 12 }}>
                                <span style={{ fontSize: 20, display: 'block', marginBottom: 6 }}>🚫</span>
                                User has not given exam yet
                            </div>
                        )}
                    </Section>
                </div>

                {/* ── BOTTOM SECTIONS ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: 1, minHeight: 0 }}>

                    {/* INTERNSHIPS */}
                    <Section icon={<Briefcase size={16} />} iconColor="#f59e0b" title="Internship Data"
                        badge={<Badge color="blue">{internCount} total</Badge>}
                        footer={internCount > 2 && (
                            <button className="sr-viewmore" onClick={() => setModal({ title: `All ${internCount} Internships`, type: 'internships' })}>
                                View All {internCount} Internships
                            </button>
                        )}>
                        {internCount === 0 ? (
                            <div style={{ textAlign: 'center', padding: 16, color: '#94a3b8', fontSize: 12 }}>No internships purchased</div>
                        ) : (
                            <MiniTable headers={['Internship', 'Batch', 'Duration', 'Plan', 'Project', 'Action']}
                                rows={internships.slice(0, 2).map((r, i) => (
                                    <tr key={i}>
                                        <td style={{ ...tdS, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                            title={r.internship}>{r.internship?.length > 18 ? r.internship.slice(0, 18) + '…' : r.internship}</td>
                                        <td style={tdS}>{r.batch || 'N/A'}</td>
                                        <td style={tdS}>{r.total_duration ? `${r.total_duration} days` : '-'}</td>
                                        <td style={tdS}>{r.internship_level || '-'}</td>
                                        <td style={tdS}><Badge color={r.project_status === 'approved' ? 'success' : r.project_status === 'rejected' ? 'danger' : r.project_status ? 'warning' : 'gray'}>
                                            {r.project_status ? r.project_status.charAt(0).toUpperCase() + r.project_status.slice(1) : 'Pending'}
                                        </Badge></td>
                                        <td style={tdS}><a href={`/admin/edit_internship.php?payment_id=${encodeURIComponent(r.payment_id)}`}
                                            target="_blank" style={{ color: '#4f46e5', fontSize: 11, fontWeight: 600 }}>Edit</a></td>
                                    </tr>
                                ))}
                            />
                        )}
                    </Section>

                    {/* TICKETS */}
                    <Section icon={<Headphones size={16} />} iconColor="#8b5cf6" title="Support Tickets"
                        badge={<Badge color="purple">{tickets.length} total</Badge>}
                        footer={tickets.length > 2 && (
                            <button className="sr-viewmore" onClick={() => setModal({ title: `All ${tickets.length} Tickets`, type: 'tickets' })}>
                                View All {tickets.length} Tickets
                            </button>
                        )}>
                        {tickets.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 16, color: '#94a3b8', fontSize: 12 }}>No tickets raised</div>
                        ) : (
                            <MiniTable headers={['ID', 'Subject', 'Status', 'Date', '']}
                                rows={tickets.slice(0, 2).map((t, i) => (
                                    <tr key={i}>
                                        <td style={tdS}>{t.ticket_id}</td>
                                        <td style={{ ...tdS, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                            title={t.subject}>{t.subject?.length > 22 ? t.subject.slice(0, 22) + '…' : t.subject || 'No Subject'}</td>
                                        <td style={tdS}><Badge color={t.status === 'open' ? 'blue' : t.status === 'closed' ? 'gray' : 'warning'}>{t.status}</Badge></td>
                                        <td style={{ ...tdS, fontSize: 11 }}>{new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                                        <td style={tdS}><a href={`/admin/view_ticket.php?ticket_id=${t.ticket_id}`}
                                            target="_blank" style={{ color: '#4f46e5', fontSize: 11, fontWeight: 600 }}>View</a></td>
                                    </tr>
                                ))}
                            />
                        )}
                    </Section>

                    {/* PAYMENTS — full width */}
                    <div style={{ gridColumn: '1/-1' }}>
                        <Section icon={<FileText size={16} />} iconColor="#10b981" title="Payment History"
                            badge={<Badge color="success">{payments.length} records</Badge>}
                            footer={payments.length > 2 && (
                                <button className="sr-viewmore" onClick={() => setModal({ title: `All ${payments.length} Payments`, type: 'payments' })}>
                                    View All {payments.length} Payments
                                </button>
                            )}>
                            {payments.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 16, color: '#94a3b8', fontSize: 12 }}>No payment history</div>
                            ) : (
                                <MiniTable headers={['Payment ID', 'Internship', 'Batch', 'Duration', 'Plan', 'Amount', 'Status', 'Paid At']}
                                    rows={payments.slice(0, 2).map((p, i) => (
                                        <tr key={i}>
                                            <td style={{ ...tdS, fontSize: 10, color: '#94a3b8' }}>{(p.payment_id || 'N/A').slice(0, 14)}…</td>
                                            <td style={{ ...tdS, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.internship || '-'}</td>
                                            <td style={tdS}>{p.batch || '-'}</td>
                                            <td style={tdS}>{p.total_duration ? `${p.total_duration} days` : '-'}</td>
<td style={tdS}>{p.internship_level || '-'}</td>
                                            <td style={tdS}><strong>₹{p.amount || '0'}</strong></td>
                                            <td style={tdS}><Badge color={p.status === 'success' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'}>{p.status || 'pending'}</Badge></td>
                                            <td style={{ ...tdS, fontSize: 11 }}>{p.paid_at || '-'}</td>
                                        </tr>
                                    ))}
                                />
                            )}
                        </Section>
                    </div>
                </div>
            </div>

            {/* ── MODAL ── */}
            {modal && (
                <Modal title={modal.title} onClose={() => setModal(null)}>
                    {modal.type === 'internships' && (
                        <MiniTable headers={['Internship', 'Batch', 'Duration', 'Plan', 'Paid At', 'Project', 'Action']}
                            rows={internships.map((r, i) => (
                                <tr key={i}>
                                    <td style={tdS}>{r.internship}</td>
                                    <td style={tdS}>{r.batch || 'N/A'}</td>
                                    <td style={tdS}>{r.total_duration} days</td>
                                    <td style={tdS}>{r.internship_level || '-'}</td>
                                    <td style={{ ...tdS, fontSize: 11 }}>{r.paid_at}</td>
                                    <td style={tdS}><Badge color={r.project_status === 'approved' ? 'success' : r.project_status === 'rejected' ? 'danger' : r.project_status ? 'warning' : 'gray'}>
                                        {r.project_status || 'Pending'}
                                    </Badge></td>
                                    <td style={tdS}><a href={`/admin/edit_internship.php?payment_id=${encodeURIComponent(r.payment_id)}`}
                                        target="_blank" style={{ color: '#4f46e5', fontSize: 11, fontWeight: 600 }}>Edit</a></td>
                                </tr>
                            ))}
                        />
                    )}
                    {modal.type === 'tickets' && (
                        <MiniTable headers={['ID', 'Subject', 'Status', 'Created At', '']}
                            rows={tickets.map((t, i) => (
                                <tr key={i}>
                                    <td style={tdS}>{t.ticket_id}</td>
                                    <td style={tdS}>{t.subject || 'No Subject'}</td>
                                    <td style={tdS}><Badge color={t.status === 'open' ? 'blue' : t.status === 'closed' ? 'gray' : 'warning'}>{t.status}</Badge></td>
                                    <td style={{ ...tdS, fontSize: 11 }}>{new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                    <td style={tdS}><a href={`/admin/view_ticket.php?ticket_id=${t.ticket_id}`}
                                        target="_blank" style={{ color: '#4f46e5', fontSize: 11, fontWeight: 600 }}>View</a></td>
                                </tr>
                            ))}
                        />
                    )}
                    {modal.type === 'payments' && (
                        <MiniTable headers={['Payment ID', 'Internship', 'Batch', 'Plan', 'Amount', 'Status', 'Paid At']}
                            rows={payments.map((p, i) => (
                                <tr key={i}>
                                    <td style={{ ...tdS, fontSize: 10, color: '#94a3b8' }}>{p.payment_id || 'N/A'}</td>
                                    <td style={tdS}>{p.internship || '-'}</td>
                                    <td style={tdS}>{p.batch || '-'}</td>
                                    <td style={tdS}>{p.internship_level || '-'}</td>
                                    <td style={tdS}><strong>₹{p.amount || '0'}</strong></td>
                                    <td style={tdS}><Badge color={p.status === 'success' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'}>{p.status || 'pending'}</Badge></td>
                                    <td style={{ ...tdS, fontSize: 11 }}>{p.paid_at || '-'}</td>
                                </tr>
                            ))}
                        />
                    )}
                </Modal>
            )}
        </>
    );
}