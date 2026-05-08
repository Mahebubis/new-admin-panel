/* ═══════════════════════════════════════════════════════════
   SHARED UTILITIES for all Roadmap sub-pages
═══════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/adminPanel/roadmap/roadmap_api.php';
const get = params => api.get(API, { params });
const post = data => api.post(API, new URLSearchParams(data));

/* ── shared small components ── */
const Label = ({ c }) => <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>{c}</label>;
const Inp = props => <input {...props} style={{ width: '100%', padding: '8px 11px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: '#1e293b', outline: 'none', ...props.style }} />;
const FF = ({ label, children, style = {} }) => <div style={{ marginBottom: 14, ...style }}><Label c={label} />{children}</div>;
const SkillBadge = ({ s }) => <span style={{ background: '#f5f3ff', color: '#4f46e5', padding: '3px 9px', borderRadius: 99, fontSize: 11.5, fontWeight: 600 }}>{s}</span>;

const Btn = ({ children, onClick, disabled, variant = 'primary', type = 'button', ...p }) => {
    const bg = { primary: 'linear-gradient(135deg,#4f46e5,#7c3aed)', danger: 'linear-gradient(135deg,#dc2626,#b91c1c)', success: 'linear-gradient(135deg,#16a34a,#15803d)', gray: '#f1f5f9', amber: 'linear-gradient(135deg,#f59e0b,#d97706)' };
    return <button type={type} onClick={onClick} disabled={disabled} {...p}
        style={{
            padding: '7px 16px', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            background: bg[variant] || bg.primary, color: variant === 'gray' ? '#475569' : '#fff', opacity: disabled ? .6 : 1, ...p.style
        }}>{children}</button>;
};

const Modal = ({ title, onClose, children, wide }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
        onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: wide ? 680 : 460, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,.2)' }}>
            <div style={{ padding: '15px 20px', borderBottom: '1.5px solid #f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>{title}</div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94a3b8' }}>×</button>
            </div>
            <div style={{ padding: 20 }}>{children}</div>
        </div>
    </div>
);

const ConfirmModal = ({ title, text, onClose, onConfirm, loading }) => (
    <Modal title={title} onClose={onClose}>
        <div style={{ fontSize: 13, color: '#475569', marginBottom: 18 }}>{text}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="gray" onClick={onClose}>Cancel</Btn>
            <Btn variant="danger" onClick={onConfirm} disabled={loading}>🗑️ Delete</Btn>
        </div>
    </Modal>
);

const Breadcrumb = ({ domain, page }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, marginBottom: 4 }}>
        <Link to="/roadmap" style={{ color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}>Domains</Link>
        <span style={{ color: '#94a3b8' }}>/</span>
        <span style={{ fontWeight: 700, color: '#1e293b' }}>{domain?.name || '...'}</span>
        <span style={{ color: '#94a3b8' }}>/</span>
        <span style={{ color: '#64748b' }}>{page}</span>
    </div>
);

function SubPageHeader({ domain, title, desc, onAdd, addLabel }) {
    return (
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #ede9fe', padding: '16px 20px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, boxShadow: '0 1px 5px rgba(79,70,229,.06)' }}>
            <div>
                <Breadcrumb domain={domain} page={title} />
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{title}</div>
                {desc && <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>{desc}</div>}
            </div>
            <Btn onClick={onAdd} style={{ padding: '9px 18px' }}>{addLabel}</Btn>
        </div>
    );
}

function useSubPage(domainId, fetchFn) {
    const [domain, setDomain] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const [dr, ir] = await Promise.all([
                get({ action: 'get_domains' }),
                fetchFn(domainId),
            ]);
            const doms = dr.data.data?.domains || [];
            setDomain(doms.find(d => d.domain_id == domainId) || null);
            setItems(ir);
        } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setLoading(false); }
    }, [domainId, fetchFn]);

    useEffect(() => { reload(); }, [reload]);
    return { domain, items, loading, reload };
}

const thS = {
    padding: '10px 14px', fontSize: 10.5, fontWeight: 700, color: '#fff', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.5px',
    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', borderRight: '1px solid rgba(255,255,255,.15)', position: 'sticky', top: 0, zIndex: 2, whiteSpace: 'nowrap'
};
const tdS = { padding: '11px 14px', fontSize: 12.5, color: '#1e293b', borderBottom: '1px solid #f5f3ff', verticalAlign: 'middle' };

const PageShell = ({ loading, children, emptyIcon, emptyText }) => (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 62px)', background: '#f5f3ff', padding: 20, overflowY: 'auto' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}@keyframes spin{to{transform:rotate(360deg)}}.sp{display:inline-block;width:18px;height:18px;border:2.5px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:spin .7s linear infinite}`}</style>
        {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
                <div className="sp" style={{ width: 28, height: 28, borderWidth: 3, margin: '0 auto 12px' }} />
                <div style={{ fontSize: 13 }}>Loading...</div>
            </div>
        ) : children}
    </div>
);

/* ═══════════════════════════════════════════════════════════
   COMPANIES PAGE
═══════════════════════════════════════════════════════════ */
export function CareerRoadmapCompanies() {
    const { domain_id } = useParams();
    const did = +domain_id;
    const { domain, items: companies, loading, reload } = useSubPage(did,
        useCallback(async (id) => { const r = await get({ action: 'get_companies', domain_id: id }); return r.data.data?.companies || []; }, [])
    );
    const [modal, setModal] = useState(null);
    const [editData, setEditData] = useState(null);
    const [delRow, setDelRow] = useState(null);
    const [form, setForm] = useState({ company_name: '', logo: '' });
    const [saving, setSaving] = useState(false);
    const upd = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

    const doAdd = async () => {
        if (!form.company_name.trim()) { toast.error('Company name required'); return; }
        setSaving(true);
        try { await post({ action: 'add_company', domain_id: did, ...form }); toast.success('Company added'); setModal(null); setForm({ company_name: '', logo: '' }); reload(); }
        catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };
    const doEdit = async () => {
        setSaving(true);
        try { await post({ action: 'edit_company', id: editData.company_id, company_name: editData.company_name, logo: editData.logo || '' }); toast.success('Updated'); setModal(null); reload(); }
        catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };
    const doDelete = async () => {
        setSaving(true);
        try { await post({ action: 'delete_company', id: delRow.company_id }); toast.success('Deleted'); setModal(null); setDelRow(null); reload(); }
        catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };

    return (
        <PageShell loading={loading}>
            <SubPageHeader domain={domain} title="Companies" desc={`Manage companies in ${domain?.name || ''}`} addLabel="+ Add Company" onAdd={() => { setForm({ company_name: '', logo: '' }); setModal('add'); }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
                {companies.map(c => (
                    <div key={c.company_id} style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #ede9fe', padding: 18, boxShadow: '0 1px 5px rgba(79,70,229,.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {c.logo && <img src={c.logo} alt={c.company_name} style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6 }} />}
                                <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{c.company_name}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => { setEditData({ ...c }); setModal('edit'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#f59e0b' }}>✏️</button>
                                <button onClick={() => { setDelRow(c); setModal('delete'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#ef4444' }}>🗑️</button>
                            </div>
                        </div>
                    </div>
                ))}
                {!companies.length && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>No companies yet</div>}
            </div>
            {modal === 'add' && <Modal title="🏢 Add Company" onClose={() => setModal(null)}><FF label="Company Name *"><Inp value={form.company_name} onChange={upd('company_name')} /></FF><FF label="Logo URL"><Inp value={form.logo} onChange={upd('logo')} /></FF><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><Btn variant="gray" onClick={() => setModal(null)}>Cancel</Btn><Btn onClick={doAdd} disabled={saving}>💾 Add</Btn></div></Modal>}
            {modal === 'edit' && editData && <Modal title="✏️ Edit Company" onClose={() => setModal(null)}><FF label="Company Name *"><Inp value={editData.company_name} onChange={e => setEditData(p => ({ ...p, company_name: e.target.value }))} /></FF><FF label="Logo URL"><Inp value={editData.logo || ''} onChange={e => setEditData(p => ({ ...p, logo: e.target.value }))} /></FF><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><Btn variant="gray" onClick={() => setModal(null)}>Cancel</Btn><Btn variant="amber" onClick={doEdit} disabled={saving}>💾 Update</Btn></div></Modal>}
            {modal === 'delete' && delRow && <ConfirmModal title="🗑️ Delete Company" text={<>Delete <strong>{delRow.company_name}</strong>? This cannot be undone.</>} onClose={() => setModal(null)} onConfirm={doDelete} loading={saving} />}
        </PageShell>
    );
}

/* ═══════════════════════════════════════════════════════════
   INTERNSHIPS PAGE
═══════════════════════════════════════════════════════════ */
export function CareerRoadmapInternships() {
    const { domain_id } = useParams();
    const did = +domain_id;
    const { domain, items: internships, loading, reload } = useSubPage(did,
        useCallback(async (id) => { const r = await get({ action: 'get_internships', domain_id: id }); return r.data.data?.internships || []; }, [])
    );
    const blank = { company: '', logo: '', title: '', description: '', fullDescription: '', skills: '' };
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState(blank);
    const [delRow, setDelRow] = useState(null);
    const [saving, setSaving] = useState(false);
    const upd = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

    const doSave = async (isEdit) => {
        if (!form.company?.trim() || !form.title?.trim()) { toast.error('Company & title required'); return; }
        setSaving(true);
        try {
            if (isEdit) await post({ action: 'edit_internship', id: form.internship_id, ...form });
            else await post({ action: 'add_internship', domain_id: did, ...form });
            toast.success(isEdit ? 'Updated' : 'Added'); setModal(null); setForm(blank); reload();
        } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };
    const doDelete = async () => {
        setSaving(true);
        try { await post({ action: 'delete_internship', id: delRow.internship_id }); toast.success('Deleted'); setModal(null); setDelRow(null); reload(); }
        catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };

    const isEdit = form.internship_id != null;

    return (
        <PageShell loading={loading}>
            <SubPageHeader domain={domain} title="Internships" desc={`Manage internships in ${domain?.name || ''}`} addLabel="+ Add Internship" onAdd={() => { setForm(blank); setModal('form'); }} />
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #ede9fe', overflow: 'hidden', boxShadow: '0 1px 5px rgba(79,70,229,.06)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 700 }}>
                        <thead><tr>
                            {['Company', 'Title', 'Skills', 'Actions'].map(h => <th key={h} style={thS}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                            {!internships.length ? (<tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>No internships yet</td></tr>)
                                : internships.map(i => (
                                    <tr key={i.internship_id}>
                                        <td style={tdS}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                {i.logo && <img src={i.logo} alt={i.company} style={{ width: 26, height: 26, objectFit: 'contain', borderRadius: 4 }} />}
                                                <span style={{ fontWeight: 600 }}>{i.company}</span>
                                            </div>
                                        </td>
                                        <td style={tdS}>{i.title}</td>
                                        <td style={{ ...tdS, maxWidth: 220 }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                {(i.skills || '').split(', ').filter(Boolean).slice(0, 4).map(s => <SkillBadge key={s} s={s} />)}
                                                {(i.skills || '').split(', ').filter(Boolean).length > 4 && <span style={{ fontSize: 11, color: '#94a3b8' }}>+{(i.skills || '').split(', ').length - 4}</span>}
                                            </div>
                                        </td>
                                        <td style={tdS}>
                                            <div style={{ display: 'flex', gap: 7 }}>
                                                <button onClick={() => { setForm({ ...i, skills: i.skills || '' }); setModal('form'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#f59e0b' }}>✏️</button>
                                                <button onClick={() => { setDelRow(i); setModal('delete'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#ef4444' }}>🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {modal === 'form' && (
                <Modal title={isEdit ? '✏️ Edit Internship' : '💼 Add Internship'} onClose={() => setModal(null)} wide>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <FF label="Company *"><Inp value={form.company} onChange={upd('company')} /></FF>
                        <FF label="Logo URL"><Inp value={form.logo} onChange={upd('logo')} /></FF>
                    </div>
                    <FF label="Title *"><Inp value={form.title} onChange={upd('title')} /></FF>
                    <FF label="Brief Description *"><textarea value={form.description} onChange={upd('description')} rows={2}
                        style={{ width: '100%', padding: '8px 11px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} /></FF>
                    <FF label="Full Description *"><textarea value={form.fullDescription} onChange={upd('fullDescription')} rows={4}
                        style={{ width: '100%', padding: '8px 11px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} /></FF>
                    <FF label="Skills (comma-separated)"><Inp value={form.skills} onChange={upd('skills')} placeholder="Python, SQL, Analysis" /></FF>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <Btn variant="gray" onClick={() => setModal(null)}>Cancel</Btn>
                        <Btn variant={isEdit ? 'amber' : 'primary'} onClick={() => doSave(isEdit)} disabled={saving}>💾 {isEdit ? 'Update' : 'Add'}</Btn>
                    </div>
                </Modal>
            )}
            {modal === 'delete' && delRow && <ConfirmModal title="🗑️ Delete Internship" text={<>Delete <strong>{delRow.title}</strong>?</>} onClose={() => setModal(null)} onConfirm={doDelete} loading={saving} />}
        </PageShell>
    );
}

/* ═══════════════════════════════════════════════════════════
   ROLES PAGE
═══════════════════════════════════════════════════════════ */
export function CareerRoadmapRoles() {
    const { domain_id } = useParams();
    const did = +domain_id;
    const { domain, items: roles, loading, reload } = useSubPage(did,
        useCallback(async (id) => { const r = await get({ action: 'get_roles', domain_id: id }); return r.data.data?.roles || []; }, [])
    );
    const blank = { title: '', skills: '', year: '', salary: '', projectedSalary: '' };
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState(blank);
    const [salaryForm, setSalaryForm] = useState({ role_id: '', year: '', salary: '', projectedSalary: '' });
    const [viewRole, setViewRole] = useState(null); // {role, details}
    const [delRow, setDelRow] = useState(null);
    const [saving, setSaving] = useState(false);
    const upd = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

    const doSave = async isEdit => {
        if (!form.title?.trim()) { toast.error('Title required'); return; }
        setSaving(true);
        try {
            if (isEdit) await post({ action: 'edit_role', id: form.role_id, title: form.title, skills: form.skills || '' });
            else await post({ action: 'add_role', domain_id: did, ...form });
            toast.success(isEdit ? 'Updated' : 'Added'); setModal(null); setForm(blank); reload();
        } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };

    const doAddSalary = async () => {
        if (!salaryForm.year || !salaryForm.salary) { toast.error('Year & salary required'); return; }
        setSaving(true);
        try { await post({ action: 'add_salary', ...salaryForm }); toast.success('Salary saved'); setModal(null); setSalaryForm({ role_id: '', year: '', salary: '', projectedSalary: '' }); reload(); }
        catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };

    const doDelete = async () => {
        setSaving(true);
        try { await post({ action: 'delete_role', id: delRow.role_id }); toast.success('Deleted'); setModal(null); setDelRow(null); reload(); }
        catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };

    const openView = async role => {
        try { const r = await get({ action: 'get_role_details', role_id: role.role_id }); setViewRole({ role, details: r.data.data }); setModal('view'); }
        catch { toast.error('Failed to load details'); }
    };

    const isEdit = form.role_id != null;

    return (
        <PageShell loading={loading}>
            <SubPageHeader domain={domain} title="Roles" desc={`Manage roles in ${domain?.name || ''}`} addLabel="+ Add Role" onAdd={() => { setForm(blank); setModal('form'); }} />
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #ede9fe', overflow: 'hidden', boxShadow: '0 1px 5px rgba(79,70,229,.06)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
                        <thead><tr>
                            {['Role Title', 'Skills', 'Current Salary', 'Projected Salary', 'Actions'].map(h => <th key={h} style={thS}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                            {!roles.length ? (<tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>No roles yet</td></tr>)
                                : roles.map(r => (
                                    <tr key={r.role_id}>
                                        <td style={{ ...tdS, fontWeight: 600 }}>{r.title}</td>
                                        <td style={{ ...tdS, maxWidth: 200 }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                {(r.skills || '').split(', ').filter(Boolean).slice(0, 3).map(s => <SkillBadge key={s} s={s} />)}
                                                {(r.skills || '').split(', ').filter(Boolean).length > 3 && <span style={{ fontSize: 11, color: '#94a3b8' }}>+more</span>}
                                            </div>
                                        </td>
                                        <td style={tdS}>
                                            {r.current_salary ? <><div style={{ fontWeight: 600 }}>${Number(r.current_salary).toLocaleString()}</div><div style={{ fontSize: 11, color: '#94a3b8' }}>Year {r.salary_year}</div></> : '—'}
                                        </td>
                                        <td style={tdS}>{r.projected_salary ? `$${Number(r.projected_salary).toLocaleString()}` : '—'}</td>
                                        <td style={tdS}>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button onClick={() => openView(r)} title="View Details" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#3b82f6' }}>👁</button>
                                                <button onClick={() => { setSalaryForm({ role_id: r.role_id, year: '', salary: '', projectedSalary: '' }); setModal('salary'); }} title="Add Salary" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#22c55e' }}>💰</button>
                                                <button onClick={() => { setForm({ role_id: r.role_id, title: r.title, skills: r.skills || '' }); setModal('form'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#f59e0b' }}>✏️</button>
                                                <button onClick={() => { setDelRow(r); setModal('delete'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#ef4444' }}>🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Role Modal */}
            {modal === 'form' && (
                <Modal title={isEdit ? '✏️ Edit Role' : '👔 Add Role'} onClose={() => setModal(null)} wide>
                    <FF label="Title *"><Inp value={form.title} onChange={upd('title')} /></FF>
                    <FF label="Skills (comma-separated)"><Inp value={form.skills} onChange={upd('skills')} placeholder="Leadership, SQL, Communication" /></FF>
                    {!isEdit && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                        <FF label="Year"><Inp type="number" value={form.year} onChange={upd('year')} min="2000" max="2100" /></FF>
                        <FF label="Current Salary"><Inp type="number" value={form.salary} onChange={upd('salary')} min="0" step="1000" /></FF>
                        <FF label="Projected Salary"><Inp type="number" value={form.projectedSalary} onChange={upd('projectedSalary')} min="0" step="1000" /></FF>
                    </div>}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <Btn variant="gray" onClick={() => setModal(null)}>Cancel</Btn>
                        <Btn variant={isEdit ? 'amber' : 'primary'} onClick={() => doSave(isEdit)} disabled={saving}>💾 {isEdit ? 'Update' : 'Add'}</Btn>
                    </div>
                </Modal>
            )}

            {/* Add Salary Modal */}
            {modal === 'salary' && (
                <Modal title="💰 Add Salary Data" onClose={() => setModal(null)}>
                    <FF label="Year *"><Inp type="number" value={salaryForm.year} onChange={e => setSalaryForm(p => ({ ...p, year: e.target.value }))} min="2000" max="2100" /></FF>
                    <FF label="Current Salary *"><Inp type="number" value={salaryForm.salary} onChange={e => setSalaryForm(p => ({ ...p, salary: e.target.value }))} min="0" step="1000" /></FF>
                    <FF label="Projected Salary"><Inp type="number" value={salaryForm.projectedSalary} onChange={e => setSalaryForm(p => ({ ...p, projectedSalary: e.target.value }))} min="0" step="1000" /></FF>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <Btn variant="gray" onClick={() => setModal(null)}>Cancel</Btn>
                        <Btn variant="success" onClick={doAddSalary} disabled={saving}>💾 Save Salary</Btn>
                    </div>
                </Modal>
            )}

            {/* View Role Details Modal */}
            {modal === 'view' && viewRole && (
                <Modal title={`👁 ${viewRole.role.title}`} onClose={() => setModal(null)} wide>
                    <div style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Required Skills</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {viewRole.details.skills.length
                                ? viewRole.details.skills.map(s => <SkillBadge key={s} s={s} />)
                                : <span style={{ fontSize: 12.5, color: '#94a3b8', fontStyle: 'italic' }}>No skills specified</span>}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Salary History</div>
                        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                            <thead><tr>
                                {['Year', 'Salary', 'Projected'].map(h => <th key={h} style={{ ...thS, fontSize: 11 }}>{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {!viewRole.details.salaries.length
                                    ? <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 12.5, fontStyle: 'italic' }}>No salary data</td></tr>
                                    : viewRole.details.salaries.map((s, i) => (
                                        <tr key={i}>
                                            <td style={tdS}>{s.year}</td>
                                            <td style={tdS}>${Number(s.salary).toLocaleString()}</td>
                                            <td style={tdS}>{s.projectedSalary ? `$${Number(s.projectedSalary).toLocaleString()}` : '—'}</td>
                                        </tr>
                                    ))
                                }
                            </tbody>
                        </table>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                        <Btn variant="gray" onClick={() => setModal(null)}>Close</Btn>
                    </div>
                </Modal>
            )}

            {modal === 'delete' && delRow && <ConfirmModal title="🗑️ Delete Role" text={<><p>Delete <strong>{delRow.title}</strong>?</p><p style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>This removes all skills and salary data too.</p></>} onClose={() => setModal(null)} onConfirm={doDelete} loading={saving} />}
        </PageShell>
    );
}

/* ═══════════════════════════════════════════════════════════
   TRAININGS PAGE
═══════════════════════════════════════════════════════════ */
export function CareerRoadmapTrainings() {
    const { domain_id } = useParams();
    const did = +domain_id;
    const { domain, items: trainings, loading, reload } = useSubPage(did,
        useCallback(async (id) => { const r = await get({ action: 'get_trainings', domain_id: id }); return r.data.data?.trainings || []; }, [])
    );
    const blank = { title: '', icon: '', completion: '0' };
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState(blank);
    const [delRow, setDelRow] = useState(null);
    const [saving, setSaving] = useState(false);
    const upd = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

    const doSave = async isEdit => {
        if (!form.title?.trim()) { toast.error('Title required'); return; }
        setSaving(true);
        try {
            if (isEdit) await post({ action: 'edit_training', id: form.training_id, title: form.title, icon: form.icon || '', completion: form.completion || 0 });
            else await post({ action: 'add_training', domain_id: did, ...form });
            toast.success(isEdit ? 'Updated' : 'Added'); setModal(null); setForm(blank); reload();
        } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };
    const doDelete = async () => {
        setSaving(true);
        try { await post({ action: 'delete_training', id: delRow.training_id }); toast.success('Deleted'); setModal(null); setDelRow(null); reload(); }
        catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };
    const isEdit = form.training_id != null;

    return (
        <PageShell loading={loading}>
            <SubPageHeader domain={domain} title="Training Programs" desc={`Manage trainings in ${domain?.name || ''}`} addLabel="+ Add Training" onAdd={() => { setForm(blank); setModal('form'); }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
                {!trainings.length && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>No trainings yet</div>}
                {trainings.map(t => (
                    <div key={t.training_id} style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #ede9fe', padding: 18, boxShadow: '0 1px 5px rgba(79,70,229,.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {t.icon && <span style={{ fontSize: 24 }}>{t.icon}</span>}
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{t.title}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => { setForm({ ...t }); setModal('form'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#f59e0b' }}>✏️</button>
                                <button onClick={() => { setDelRow(t); setModal('delete'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#ef4444' }}>🗑️</button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 5 }}>
                            <span>Completion Rate</span><span style={{ fontWeight: 700, color: '#1e293b' }}>{t.completion}%</span>
                        </div>
                        <div style={{ background: '#f1f5f9', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                            <div style={{ background: 'linear-gradient(90deg,#4f46e5,#7c3aed)', height: '100%', width: `${t.completion}%`, borderRadius: 99, transition: 'width .4s' }} />
                        </div>
                    </div>
                ))}
            </div>

            {modal === 'form' && (
                <Modal title={isEdit ? '✏️ Edit Training' : '📚 Add Training'} onClose={() => setModal(null)}>
                    <FF label="Title *"><Inp value={form.title} onChange={upd('title')} /></FF>
                    <FF label="Icon (emoji)"><Inp value={form.icon} onChange={upd('icon')} placeholder="📚" /></FF>
                    <FF label="Completion Rate (%)"><Inp type="number" value={form.completion} onChange={upd('completion')} min="0" max="100" /></FF>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <Btn variant="gray" onClick={() => setModal(null)}>Cancel</Btn>
                        <Btn variant={isEdit ? 'amber' : 'primary'} onClick={() => doSave(isEdit)} disabled={saving}>💾 {isEdit ? 'Update' : 'Add'}</Btn>
                    </div>
                </Modal>
            )}
            {modal === 'delete' && delRow && <ConfirmModal title="🗑️ Delete Training" text={<>Delete <strong>{delRow.title}</strong>? This cannot be undone.</>} onClose={() => setModal(null)} onConfirm={doDelete} loading={saving} />}
        </PageShell>
    );
}

/* ═══════════════════════════════════════════════════════════
   SKILLS PAGE
═══════════════════════════════════════════════════════════ */
export function CareerRoadmapSkills() {
    const { domain_id } = useParams();
    const did = +domain_id;
    const { domain, items: skills, loading, reload } = useSubPage(did,
        useCallback(async (id) => { const r = await get({ action: 'get_skills', domain_id: id }); return r.data.data?.skills || []; }, [])
    );
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState({ skill: '' });
    const [editData, setEditData] = useState(null);
    const [delRow, setDelRow] = useState(null);
    const [viewRow, setViewRow] = useState(null);
    const [saving, setSaving] = useState(false);

    const doAdd = async () => {
        if (!form.skill.trim()) { toast.error('Skill required'); return; }
        setSaving(true);
        try { await post({ action: 'add_skill', domain_id: did, skill: form.skill }); toast.success('Added'); setModal(null); setForm({ skill: '' }); reload(); }
        catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };
    const doEdit = async () => {
        if (!editData.skill.trim()) { toast.error('Skill required'); return; }
        setSaving(true);
        try { await post({ action: 'edit_skill', id: editData.skill_id, skill: editData.skill, old_skill: editData._old }); toast.success('Updated'); setModal(null); reload(); }
        catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };
    const doDelete = async () => {
        setSaving(true);
        try { await post({ action: 'delete_skill', id: delRow.skill_id, skill: delRow.skill }); toast.success('Deleted'); setModal(null); setDelRow(null); reload(); }
        catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };

    return (
        <PageShell loading={loading}>
            <SubPageHeader domain={domain} title="Skills Catalog" desc={`Manage skills in ${domain?.name || ''}`} addLabel="+ Add Skill" onAdd={() => { setForm({ skill: '' }); setModal('add'); }} />
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #ede9fe', overflow: 'hidden', boxShadow: '0 1px 5px rgba(79,70,229,.06)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600 }}>
                        <thead><tr>
                            {['Skill', 'Used in Roles', 'Used in Internships', 'Actions'].map(h => <th key={h} style={thS}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                            {!skills.length ? (<tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>No skills yet</td></tr>)
                                : skills.map(s => (
                                    <tr key={s.skill_id}>
                                        <td style={{ ...tdS, fontWeight: 600 }}><SkillBadge s={s.skill} /></td>
                                        <td style={tdS}><span style={{ fontWeight: 600, color: '#4f46e5' }}>{s.roles_count}</span> roles</td>
                                        <td style={tdS}><span style={{ fontWeight: 600, color: '#4f46e5' }}>{s.internships_count}</span> internships</td>
                                        <td style={tdS}>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button onClick={() => { setViewRow(s); setModal('view'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#3b82f6' }}>👁</button>
                                                <button onClick={() => { setEditData({ ...s, _old: s.skill }); setModal('edit'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#f59e0b' }}>✏️</button>
                                                <button onClick={() => { setDelRow(s); setModal('delete'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#ef4444' }}>🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {modal === 'add' && <Modal title="🔧 Add Skill" onClose={() => setModal(null)}><FF label="Skill Name *"><Inp value={form.skill} onChange={e => setForm({ skill: e.target.value })} /></FF><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><Btn variant="gray" onClick={() => setModal(null)}>Cancel</Btn><Btn onClick={doAdd} disabled={saving}>💾 Add</Btn></div></Modal>}

            {modal === 'edit' && editData && <Modal title="✏️ Edit Skill" onClose={() => setModal(null)}>
                <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 8, padding: '9px 13px', marginBottom: 14, fontSize: 12.5, color: '#92400e' }}>
                    ⚠️ This will update the skill name across all roles and internships.
                </div>
                <FF label="Skill Name *"><Inp value={editData.skill} onChange={e => setEditData(p => ({ ...p, skill: e.target.value }))} /></FF>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><Btn variant="gray" onClick={() => setModal(null)}>Cancel</Btn><Btn variant="amber" onClick={doEdit} disabled={saving}>💾 Update</Btn></div>
            </Modal>}

            {modal === 'view' && viewRow && <Modal title={`👁 "${viewRow.skill}" Usage`} onClose={() => setModal(null)}>
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Used in Roles ({viewRow.roles_count})</div>
                    {viewRow.role_titles ? viewRow.role_titles.split(',').map(t => <div key={t} style={{ padding: '4px 0', fontSize: 13, borderBottom: '1px solid #f5f3ff' }}>{t.trim()}</div>)
                        : <div style={{ fontSize: 12.5, color: '#94a3b8', fontStyle: 'italic' }}>No roles</div>}
                </div>
                <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Used in Internships ({viewRow.internships_count})</div>
                    {viewRow.internship_titles ? viewRow.internship_titles.split(',').map(t => <div key={t} style={{ padding: '4px 0', fontSize: 13, borderBottom: '1px solid #f5f3ff' }}>{t.trim()}</div>)
                        : <div style={{ fontSize: 12.5, color: '#94a3b8', fontStyle: 'italic' }}>No internships</div>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><Btn variant="gray" onClick={() => setModal(null)}>Close</Btn></div>
            </Modal>}

            {modal === 'delete' && delRow && <ConfirmModal title="🗑️ Delete Skill"
                text={<><p>Delete <strong>{delRow.skill}</strong>?</p><p style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>This removes it from all roles and internships.</p></>}
                onClose={() => setModal(null)} onConfirm={doDelete} loading={saving} />}
        </PageShell>
    );
}