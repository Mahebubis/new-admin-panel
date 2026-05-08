import { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/homepage/homepage.php';
const FH = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

/* ── tiny helpers ── */
const mkBody = obj => new URLSearchParams(obj);
const TABS = ['jobs', 'placements', 'internships', 'cit_dates'];
const TAB_LABELS = { jobs: 'Jobs', placements: 'Placements', internships: 'Internships', cit_dates: 'CIT Dates' };

function Spinner() {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{
                width: 32, height: 32, border: '3px solid #ede9fe', borderTop: '3px solid #4f46e5',
                borderRadius: '50%', animation: 'hp_spin 0.7s linear infinite'
            }} />
        </div>
    );
}

function Modal({ title, onClose, children }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
            <div style={{
                background: '#fff', borderRadius: 14, width: '100%', maxWidth: 640, maxHeight: '90vh',
                overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)'
            }}>
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '18px 24px', borderBottom: '1.5px solid #f1f5f9'
                }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{title}</span>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', fontSize: 24,
                        cursor: 'pointer', color: '#94a3b8', lineHeight: 1
                    }}>×</button>
                </div>
                <div style={{ padding: '20px 24px' }}>{children}</div>
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <label style={{
                display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b',
                textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5
            }}>{label}</label>
            {children}
        </div>
    );
}

const inputStyle = {
    width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color .15s'
};
const selectStyle = { ...inputStyle, cursor: 'pointer' };
const btnPrimary = {
    padding: '10px 24px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 4px 12px rgba(79,70,229,.3)'
};
const btnDanger = {
    padding: '5px 12px', background: '#fee2e2', color: '#dc2626', border: '1.5px solid #fecaca',
    borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
};
const btnEdit = {
    padding: '5px 12px', background: '#f0fdf4', color: '#16a34a', border: '1.5px solid #bbf7d0',
    borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginRight: 6
};

export default function HomePage() {
    const [tab, setTab] = useState('jobs');
    const [jobs, setJobs] = useState([]);
    const [placements, setPlacements] = useState([]);
    const [internships, setInternships] = useState([]);
    const [citDates, setCitDates] = useState([]);
    const [loading, setLoading] = useState({});
    const [modal, setModal] = useState(null); // { type, data? }

    /* ── loaders ── */
    const load = async (section) => {
        setLoading(p => ({ ...p, [section]: true }));
        try {
            const res = await api.post(API, mkBody({ action: `fetch_${section}` }), FH);
            if (res.data.status === 'success') {
                if (section === 'jobs') setJobs(res.data.data || []);
                if (section === 'placements') setPlacements(res.data.data || []);
                if (section === 'internships') setInternships(res.data.data || []);
                if (section === 'cit_dates') setCitDates(res.data.data || []);
            }
        } catch { } finally { setLoading(p => ({ ...p, [section]: false })); }
    };

    useEffect(() => { load(tab); }, [tab]); // eslint-disable-line

    const reload = () => load(tab);

    /* ── delete ── */
    const del = async (section, id) => {
        if (!window.confirm('Delete this record?')) return;
        try {
            const res = await api.post(API, mkBody({ action: `delete_${section.replace(/s$/, '').replace('_date', '_date')}`, id }), FH);
            if (res.data.status === 'success') { toast.success('Deleted'); reload(); }
            else toast.error(res.data.message || 'Failed');
        } catch { toast.error('Error'); }
    };

    // const closeModal = () => { setModal(null); reload(); };
    const closeModal = () => setModal(null);
    const closeModalAndReload = () => { setModal(null); reload(); };

    /* ════════════ RENDER ════════════ */
    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .hp-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        @keyframes hp_spin{to{transform:rotate(360deg);}}
        .hp-tab:hover{color:#4f46e5;}
        .hp-tr:hover td{background:#faf9ff!important;}
        .hp-inp:focus{border-color:#4f46e5!important;box-shadow:0 0 0 3px rgba(79,70,229,.08)!important;}
        .hp-btn-pri:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(79,70,229,.4)!important;}
      `}</style>

            <div className="hp-root" style={{ background: '#f5f3ff', minHeight: '100vh', padding: 24 }}>

                {/* header */}
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    Homepage Management
                </div>

                {/* tab bar */}
                <div style={{
                    display: 'flex', borderBottom: '2px solid #ede9fe', marginBottom: 22, background: '#fff',
                    borderRadius: '10px 10px 0 0', padding: '0 8px', boxShadow: '0 1px 4px rgba(79,70,229,.06)'
                }}>
                    {TABS.map(t => (
                        <div key={t} className="hp-tab"
                            onClick={() => setTab(t)}
                            style={{
                                padding: '12px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                                color: tab === t ? '#4f46e5' : '#64748b',
                                borderBottom: `2.5px solid ${tab === t ? '#4f46e5' : 'transparent'}`,
                                marginBottom: -2, transition: 'all .15s'
                            }}>
                            {TAB_LABELS[t]}
                        </div>
                    ))}
                </div>

                {/* content card */}
                <div style={{
                    background: '#fff', borderRadius: '0 0 12px 12px', border: '1.5px solid #ede9fe',
                    padding: 20, boxShadow: '0 1px 8px rgba(79,70,229,.05)'
                }}>

                    {/* ══ JOBS TAB ══ */}
                    {tab === 'jobs' && (
                        <section>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Job List</span>
                                <button className="hp-btn-pri" style={btnPrimary} onClick={() => setModal({ type: 'job' })}>+ Add Job</button>
                            </div>
                            {loading.jobs ? <Spinner /> : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                                                {['#', 'Title', 'Company', 'Location', 'Stipend', 'Type', 'Status', 'Action'].map(h => (
                                                    <th key={h} style={{
                                                        color: '#fff', fontSize: 11, fontWeight: 600, padding: '10px 12px',
                                                        textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px',
                                                        borderRight: '1px solid rgba(255,255,255,.15)'
                                                    }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {jobs.length === 0
                                                ? <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: 32, fontSize: 13 }}>No records found</td></tr>
                                                : jobs.map((j, i) => (
                                                    <tr key={j.id} className="hp-tr">
                                                        <td style={tdS}>{i + 1}</td>
                                                        <td style={{ ...tdS, color: '#4f46e5', fontWeight: 600 }}>
                                                            {j.companyLogo && <img src={j.companyLogo} alt="" style={{ width: 24, height: 24, objectFit: 'contain', borderRadius: 4, marginRight: 8, verticalAlign: 'middle' }} />}
                                                            {j.title}
                                                        </td>
                                                        <td style={tdS}>{j.company}</td>
                                                        <td style={tdS}>{j.location}</td>
                                                        <td style={tdS}>{j.stipend || '—'}</td>
                                                        <td style={tdS}>{j.type}</td>
                                                        <td style={tdS}>
                                                            <span style={{
                                                                padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                                                                background: j.status === 'live' ? '#dcfce7' : '#fee2e2',
                                                                color: j.status === 'live' ? '#16a34a' : '#dc2626'
                                                            }}>
                                                                {j.status}
                                                            </span>
                                                        </td>
                                                        <td style={tdS}>
                                                            <button style={btnEdit} onClick={() => setModal({ type: 'job', data: j })}>Edit</button>
                                                            <button style={btnDanger} onClick={() => del('jobs', j.id)}>Delete</button>
                                                        </td>
                                                    </tr>
                                                ))
                                            }
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    )}

                    {/* ══ PLACEMENTS TAB ══ */}
                    {tab === 'placements' && (
                        <section>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Placement List</span>
                                <button className="hp-btn-pri" style={btnPrimary} onClick={() => setModal({ type: 'placement' })}>+ Add Placement</button>
                            </div>
                            {loading.placements ? <Spinner /> : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                                                {['#', 'Name', 'Company', 'Role', 'Stipend', 'Status', 'Action'].map(h => (
                                                    <th key={h} style={{
                                                        color: '#fff', fontSize: 11, fontWeight: 600, padding: '10px 12px',
                                                        textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px',
                                                        borderRight: '1px solid rgba(255,255,255,.15)'
                                                    }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {placements.length === 0
                                                ? <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: 32, fontSize: 13 }}>No records found</td></tr>
                                                : placements.map((p, i) => (
                                                    <tr key={p.id} className="hp-tr">
                                                        <td style={tdS}>{i + 1}</td>
                                                        <td style={{ ...tdS, color: '#4f46e5', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            {p.image && <img src={p.image} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: '50%' }} />}
                                                            {p.name}
                                                        </td>
                                                        <td style={tdS}>{p.company}</td>
                                                        <td style={tdS}>{p.role}</td>
                                                        <td style={tdS}>{p.stipend || '—'}</td>
                                                        <td style={tdS}>
                                                            <span style={{
                                                                padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                                                                background: '#ede9fe', color: '#6d28d9'
                                                            }}>{p.internshipStatus}</span>
                                                        </td>
                                                        <td style={tdS}>
                                                            <button style={btnEdit} onClick={() => setModal({ type: 'placement', data: p })}>Edit</button>
                                                            <button style={btnDanger} onClick={() => del('placements', p.id)}>Delete</button>
                                                        </td>
                                                    </tr>
                                                ))
                                            }
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    )}

                    {/* ══ INTERNSHIPS TAB ══ */}
                    {tab === 'internships' && (
                        <section>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Internship List</span>
                                <button className="hp-btn-pri" style={btnPrimary} onClick={() => setModal({ type: 'internship' })}>+ Add Internship</button>
                            </div>
                            {loading.internships ? <Spinner /> : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                                                {['#', 'Image', 'Title', 'Category', 'Price', 'Action'].map(h => (
                                                    <th key={h} style={{
                                                        color: '#fff', fontSize: 11, fontWeight: 600, padding: '10px 12px',
                                                        textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px',
                                                        borderRight: '1px solid rgba(255,255,255,.15)'
                                                    }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {internships.length === 0
                                                ? <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: 32, fontSize: 13 }}>No records found</td></tr>
                                                : internships.map((n, i) => (
                                                    <tr key={n.id} className="hp-tr">
                                                        <td style={tdS}>{i + 1}</td>
                                                        <td style={tdS}>
                                                            {n.image
                                                                ? <img src={n.image} alt="" style={{ width: 48, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                                                                : <span style={{ color: '#94a3b8', fontSize: 11 }}>No image</span>
                                                            }
                                                        </td>
                                                        <td style={{ ...tdS, color: '#4f46e5', fontWeight: 600 }}>{n.title}</td>
                                                        <td style={tdS}>{n.category}</td>
                                                        <td style={tdS}>₹{n.price}</td>
                                                        <td style={tdS}>
                                                            <button style={btnEdit} onClick={() => setModal({ type: 'internship', data: n })}>Edit</button>
                                                            <button style={btnDanger} onClick={() => del('internships', n.id)}>Delete</button>
                                                        </td>
                                                    </tr>
                                                ))
                                            }
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    )}

                    {/* ══ CIT DATES TAB ══ */}
                    {tab === 'cit_dates' && (
                        <section>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>CIT Date List</span>
                                <button className="hp-btn-pri" style={btnPrimary} onClick={() => setModal({ type: 'cit_date' })}>+ Add CIT Date</button>
                            </div>
                            {loading.cit_dates ? <Spinner /> : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                                                {['#', 'CIT Date', 'Created At', 'Action'].map(h => (
                                                    <th key={h} style={{
                                                        color: '#fff', fontSize: 11, fontWeight: 600, padding: '10px 12px',
                                                        textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px',
                                                        borderRight: '1px solid rgba(255,255,255,.15)'
                                                    }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {citDates.length === 0
                                                ? <tr><td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: 32, fontSize: 13 }}>No records found</td></tr>
                                                : citDates.map((c, i) => (
                                                    <tr key={c.id} className="hp-tr">
                                                        <td style={tdS}>{i + 1}</td>
                                                        <td style={{ ...tdS, color: '#4f46e5', fontWeight: 600 }}>{c.cit_date}</td>
                                                        <td style={tdS}>{c.created_at}</td>
                                                        <td style={tdS}>
                                                            <button style={btnEdit} onClick={() => setModal({ type: 'cit_date', data: c })}>Edit</button>
                                                            <button style={btnDanger} onClick={() => del('cit_dates', c.id)}>Delete</button>
                                                        </td>
                                                    </tr>
                                                ))
                                            }
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </div>

            {/* ══ MODALS ══ */}
            {/* {modal?.type === 'job' && <JobModal data={modal.data} onClose={closeModal} />}
            {modal?.type === 'placement' && <PlacementModal data={modal.data} onClose={closeModal} />}
            {modal?.type === 'internship' && <InternshipModal data={modal.data} onClose={closeModal} />}
            {modal?.type === 'cit_date' && <CITDateModal data={modal.data} onClose={closeModal} />} */}
            {modal?.type === 'job' && <JobModal data={modal.data} onClose={closeModalAndReload} onCancel={closeModal} />}
            {modal?.type === 'placement' && <PlacementModal data={modal.data} onClose={closeModalAndReload} onCancel={closeModal} />}
            {modal?.type === 'internship' && <InternshipModal data={modal.data} onClose={closeModalAndReload} onCancel={closeModal} />}
            {modal?.type === 'cit_date' && <CITDateModal data={modal.data} onClose={closeModalAndReload} onCancel={closeModal} />}
        </>
    );
}

/* ─── table cell style ─── */
const tdS = { padding: '10px 12px', borderBottom: '1px solid #f5f3ff', color: '#334155', fontSize: 13 };

/* ════════════════════════════════
   JOB MODAL
════════════════════════════════ */
function JobModal({ data, onClose, onCancel }) {
    const isEdit = !!data;
    const [form, setForm] = useState({
        title: data?.title || '', company: data?.company || '', location: data?.location || '',
        stipend: data?.stipend || '', type: data?.type || '', postedDate: data?.postedDate || '',
        status: data?.status || 'live', applicationLink: data?.applicationLink || '',
    });
    const [file, setFile] = useState(null);
    const [saving, setSaving] = useState(false);

    const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

    const submit = async () => {
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('action', isEdit ? 'update_job' : 'save_job');
            if (isEdit) fd.append('job_id', data.id);
            Object.entries(form).forEach(([k, v]) => fd.append(k, v));
            if (file) fd.append('companyLogo', file);

            const res = await api.post(API, fd, { headers: { 'Content-Type': undefined } });
            if (res.data.status === 'success') { toast.success(isEdit ? 'Job updated' : 'Job created'); onClose(); }
            else toast.error(res.data.message || 'Failed');
        } catch { toast.error('Error'); } finally { setSaving(false); }
    };

    return (
        <Modal title={isEdit ? 'Edit Job' : 'Add Job'} onClose={onCancel}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Title"><input className="hp-inp" style={inputStyle} value={form.title} onChange={set('title')} placeholder="Job Title" /></Field>
                <Field label="Company"><input className="hp-inp" style={inputStyle} value={form.company} onChange={set('company')} placeholder="Company Name" /></Field>
                <Field label="Location"><input className="hp-inp" style={inputStyle} value={form.location} onChange={set('location')} placeholder="Location" /></Field>
                <Field label="Stipend"><input className="hp-inp" style={inputStyle} value={form.stipend} onChange={set('stipend')} placeholder="Stipend (optional)" /></Field>
                <Field label="Job Type"><input className="hp-inp" style={inputStyle} value={form.type} onChange={set('type')} placeholder="e.g. Full-Time" /></Field>
                <Field label="Posted Date"><input className="hp-inp" style={inputStyle} type="date" value={form.postedDate} onChange={set('postedDate')} /></Field>
                <Field label="Status">
                    <select className="hp-inp" style={selectStyle} value={form.status} onChange={set('status')}>
                        <option value="live">Live</option>
                        <option value="closed">Closed</option>
                    </select>
                </Field>
                <Field label="Application Link"><input className="hp-inp" style={inputStyle} type="url" value={form.applicationLink} onChange={set('applicationLink')} placeholder="https://..." /></Field>
                <div style={{ gridColumn: '1/-1' }}>
                    <Field label={isEdit ? 'New Company Logo (leave blank to keep)' : 'Company Logo'}>
                        {isEdit && data.companyLogo && <img src={data.companyLogo} alt="" style={{ width: 60, height: 40, objectFit: 'contain', marginBottom: 6, display: 'block', borderRadius: 4, border: '1px solid #e2e8f0' }} />}
                        <input type="file" style={inputStyle} accept="image/*" onChange={e => setFile(e.target.files[0])} />
                    </Field>
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button onClick={onCancel} style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#475569', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button className="hp-btn-pri" style={btnPrimary} onClick={submit} disabled={saving}>
                    {saving ? 'Saving...' : (isEdit ? 'Update Job' : 'Save Job')}
                </button>
            </div>
        </Modal>
    );
}

/* ════════════════════════════════
   PLACEMENT MODAL
════════════════════════════════ */
function PlacementModal({ data, onClose, onCancel }) {
    const isEdit = !!data;
    const skillsStr = Array.isArray(data?.skills) ? data.skills.join(', ') : (data?.skills || '');
    const [form, setForm] = useState({
        name: data?.name || '', company: data?.company || '', role: data?.role || '',
        stipend: data?.stipend || '', linkedinUrl: data?.linkedinUrl || '',
        internshipStudioUrl: data?.internshipStudioUrl || '', placementDate: data?.placementDate || '',
        location: data?.location || '', internshipStatus: data?.internshipStatus || 'internship',
        skills: skillsStr,
    });
    const [file, setFile] = useState(null);
    const [saving, setSaving] = useState(false);

    const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

    const submit = async () => {
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('action', isEdit ? 'update_placement' : 'save_placement');
            if (isEdit) fd.append('placement_id', data.id);
            Object.entries(form).forEach(([k, v]) => fd.append(k, v));
            if (file) fd.append('image', file);

            const res = await api.post(API, fd, { headers: { 'Content-Type': undefined } });
            if (res.data.status === 'success') { toast.success(isEdit ? 'Placement updated' : 'Placement created'); onClose(); }
            else toast.error(res.data.message || 'Failed');
        } catch { toast.error('Error'); } finally { setSaving(false); }
    };

    return (
        <Modal title={isEdit ? 'Edit Placement' : 'Add Placement'} onClose={onCancel}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Name"><input className="hp-inp" style={inputStyle} value={form.name} onChange={set('name')} placeholder="Student Name" /></Field>
                <Field label="Company"><input className="hp-inp" style={inputStyle} value={form.company} onChange={set('company')} placeholder="Company Name" /></Field>
                <Field label="Role"><input className="hp-inp" style={inputStyle} value={form.role} onChange={set('role')} placeholder="Role / Designation" /></Field>
                <Field label="Stipend"><input className="hp-inp" style={inputStyle} value={form.stipend} onChange={set('stipend')} placeholder="Stipend" /></Field>
                <Field label="Location"><input className="hp-inp" style={inputStyle} value={form.location} onChange={set('location')} placeholder="Location" /></Field>
                <Field label="Placement Date"><input className="hp-inp" style={inputStyle} type="date" value={form.placementDate} onChange={set('placementDate')} /></Field>
                <Field label="Internship Status">
                    <select className="hp-inp" style={selectStyle} value={form.internshipStatus} onChange={set('internshipStatus')}>
                        <option value="internship">Internship</option>
                        <option value="internship + PPO">Internship + PPO</option>
                        <option value="Full-Time">Full Time</option>
                    </select>
                </Field>
                <Field label="LinkedIn URL"><input className="hp-inp" style={inputStyle} type="url" value={form.linkedinUrl} onChange={set('linkedinUrl')} placeholder="https://linkedin.com/in/..." /></Field>
                <div style={{ gridColumn: '1/-1' }}>
                    <Field label="Internship Studio URL"><input className="hp-inp" style={inputStyle} type="url" value={form.internshipStudioUrl} onChange={set('internshipStudioUrl')} placeholder="https://..." /></Field>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                    <Field label="Skills (comma-separated)"><input className="hp-inp" style={inputStyle} value={form.skills} onChange={set('skills')} placeholder="React, Node.js, Python" /></Field>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                    <Field label={isEdit ? 'New Profile Image (leave blank to keep)' : 'Profile Image'}>
                        {isEdit && data.image && <img src={data.image} alt="" style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: '50%', marginBottom: 6, display: 'block' }} />}
                        <input type="file" style={inputStyle} accept="image/*" onChange={e => setFile(e.target.files[0])} />
                    </Field>
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button onClick={onCancel} style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#475569', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button className="hp-btn-pri" style={btnPrimary} onClick={submit} disabled={saving}>
                    {saving ? 'Saving...' : (isEdit ? 'Update Placement' : 'Save Placement')}
                </button>
            </div>
        </Modal>
    );
}

/* ════════════════════════════════
   INTERNSHIP MODAL
════════════════════════════════ */
function InternshipModal({ data, onClose, onCancel }) {
    const isEdit = !!data;
    const [form, setForm] = useState({ title: data?.title || '', price: data?.price || '', category: data?.category || '' });
    const [file, setFile] = useState(null);
    const [saving, setSaving] = useState(false);

    const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

    const submit = async () => {
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('action', isEdit ? 'update_internship' : 'save_internship');
            if (isEdit) fd.append('internship_id', data.id);
            Object.entries(form).forEach(([k, v]) => fd.append(k, v));
            if (file) fd.append('image', file);

            const res = await api.post(API, fd, { headers: { 'Content-Type': undefined } });
            if (res.data.status === 'success') { toast.success(isEdit ? 'Internship updated' : 'Internship created'); onClose(); }
            else toast.error(res.data.message || 'Failed');
        } catch { toast.error('Error'); } finally { setSaving(false); }
    };

    return (
        <Modal title={isEdit ? 'Edit Internship' : 'Add Internship'} onClose={onCancel}>
            <Field label="Title"><input className="hp-inp" style={inputStyle} value={form.title} onChange={set('title')} placeholder="Internship Title" /></Field>
            <Field label="Category">
                <select className="hp-inp" style={selectStyle} value={form.category} onChange={set('category')}>
                    <option value="">Select Category</option>
                    <option value="tech">Tech</option>
                    <option value="data">Data</option>
                    <option value="management">Management</option>
                    <option value="design">Design</option>
                    <option value="other">Other</option>
                </select>
            </Field>
            <Field label="Price (₹)"><input className="hp-inp" style={inputStyle} type="number" value={form.price} onChange={set('price')} placeholder="0" /></Field>
            <Field label={isEdit ? 'New Thumbnail (leave blank to keep)' : 'Thumbnail'}>
                {isEdit && data.image && <img src={data.image} alt="" style={{ width: 80, height: 56, objectFit: 'cover', borderRadius: 6, marginBottom: 6, display: 'block' }} />}
                <input type="file" style={inputStyle} accept="image/*" onChange={e => setFile(e.target.files[0])} />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button onClick={onCancel} style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#475569', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button className="hp-btn-pri" style={btnPrimary} onClick={submit} disabled={saving}>
                    {saving ? 'Saving...' : (isEdit ? 'Update Internship' : 'Save Internship')}
                </button>
            </div>
        </Modal>
    );
}

/* ════════════════════════════════
   CIT DATE MODAL
════════════════════════════════ */
function CITDateModal({ data, onClose, onCancel }) {
    const isEdit = !!data;
    const [citDate, setCitDate] = useState(data?.cit_date || '');
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!citDate) { toast.error('Please select a date'); return; }
        setSaving(true);
        try {
            const body = mkBody({ action: isEdit ? 'update_cit_date' : 'save_cit_date', cit_date: citDate, ...(isEdit ? { cit_id: data.id } : {}) });
            const res = await api.post(API, body, FH);
            if (res.data.status === 'success') { toast.success(isEdit ? 'Date updated' : 'Date saved'); onClose(); }
            else toast.error(res.data.message || 'Failed');
        } catch { toast.error('Error'); } finally { setSaving(false); }
    };

    return (
        <Modal title={isEdit ? 'Edit CIT Date' : 'Add CIT Date'} onClose={onCancel}>
            <Field label="CIT Date">
                <input className="hp-inp" style={inputStyle} type="date" value={citDate} onChange={e => setCitDate(e.target.value)} />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button onClick={onCancel} style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#475569', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button className="hp-btn-pri" style={btnPrimary} onClick={submit} disabled={saving}>
                    {saving ? 'Saving...' : (isEdit ? 'Update Date' : 'Save Date')}
                </button>
            </div>
        </Modal>
    );
}