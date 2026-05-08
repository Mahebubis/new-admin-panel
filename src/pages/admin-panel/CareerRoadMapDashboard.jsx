import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';

/* ─── shared helpers ─── */
const fmtN = n => (n ?? 0).toLocaleString('en-IN');
const Label = ({ c }) => <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>{c}</label>;
const Inp = ({ ...p }) => <input {...p} style={{ width: '100%', padding: '8px 11px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: '#1e293b', outline: 'none', ...p.style }} />;
const Btn = ({ children, onClick, disabled, variant = 'primary', type = 'button', ...p }) => {
    const bg = { primary: 'linear-gradient(135deg,#4f46e5,#7c3aed)', danger: 'linear-gradient(135deg,#dc2626,#b91c1c)', success: 'linear-gradient(135deg,#16a34a,#15803d)', gray: '#f1f5f9' };
    return <button type={type} onClick={onClick} disabled={disabled} {...p}
        style={{
            padding: '8px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            background: bg[variant], color: variant === 'gray' ? '#475569' : '#fff', opacity: disabled ? .6 : 1, ...p.style
        }}>{children}</button>;
};

/* ─── Modal wrapper ─── */
const Modal = ({ title, onClose, children, wide }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
        onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: wide ? 680 : 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,.2)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1.5px solid #f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>{title}</div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94a3b8', padding: 4 }}>×</button>
            </div>
            <div style={{ padding: '20px' }}>{children}</div>
        </div>
    </div>
);

/* ─── Domain Selector (multi-click, matches PHP custom selector) ─── */
const DomainSelector = ({ domains, selected, onChange }) => (
    <div>
        <Label c="Select Domains" />
        <div style={{ border: '2px solid #e2e8f0', borderRadius: 12, padding: 10, background: '#f8fafc', maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {domains.map(d => {
                const isSelected = selected.includes(d.domain_id);
                return (
                    <div key={d.domain_id} onClick={() => onChange(isSelected ? selected.filter(x => x !== d.domain_id) : [...selected, d.domain_id])}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderRadius: 8, cursor: 'pointer',
                            border: `2px solid ${isSelected ? '#059669' : 'transparent'}`, transition: 'all .2s',
                            background: isSelected ? 'linear-gradient(135deg,#10b981,#059669)' : '#fff',
                            color: isSelected ? '#fff' : '#1e293b', boxShadow: isSelected ? '0 4px 12px rgba(16,185,129,.3)' : '0 1px 3px rgba(0,0,0,.08)'
                        }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</span>
                        <span style={{ opacity: isSelected ? 1 : 0, fontSize: 14 }}>✓</span>
                    </div>
                );
            })}
        </div>
        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>Click to select/deselect • {selected.length} selected</div>
    </div>
);

/* ─── FormField ─── */
const FF = ({ label, children }) => (
    <div style={{ marginBottom: 14 }}>
        <Label c={label} />{children}
    </div>
);

/* ─── DomainCard ─── */
function DomainCard({ domain, onEdit, onDelete }) {
    const stats = [
        { label: 'Companies', count: domain.companies_count },
        { label: 'Internships', count: domain.internships_count },
        { label: 'Roles', count: domain.roles_count },
        { label: 'Trainings', count: domain.trainings_count },
        { label: 'Skills', count: domain.skills_count },
    ];
    const links = [
        { label: 'Companies', path: `/roadmap/${domain.domain_id}/companies` },
        { label: 'Internships', path: `/roadmap/${domain.domain_id}/internships` },
        { label: 'Roles', path: `/roadmap/${domain.domain_id}/roles` },
        { label: 'Trainings', path: `/roadmap/${domain.domain_id}/trainings` },
        { label: 'Skills', path: `/roadmap/${domain.domain_id}/skills` },
    ];
    return (
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #ede9fe', padding: 20, boxShadow: '0 1px 6px rgba(79,70,229,.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {domain.logo && <img src={domain.logo} alt={domain.name} style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6 }} />}
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{domain.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => onEdit(domain)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#f59e0b' }}>✏️</button>
                    <button onClick={() => onDelete(domain)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#ef4444' }}>🗑️</button>
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
                {stats.map(s => (
                    <div key={s.label} style={{ background: '#f5f3ff', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#4f46e5' }}>{s.count}</div>
                    </div>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 4 }}>
                {links.map(l => (
                    <Link key={l.label} to={l.path} style={{ color: '#4f46e5', fontSize: 12, fontWeight: 600, padding: '3px 0', textDecoration: 'none' }}>
                        → {l.label}
                    </Link>
                ))}
            </div>
        </div>
    );
}

/* ════════════════════════════════════
   DASHBOARD
════════════════════════════════════ */
export default function CareerRoadmapDashboard() {
    const [domains, setDomains] = useState([]);
    const [allItems, setAllItems] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // 'add_domain'|'edit_domain'|'delete_domain'|'add_company'|etc
    const [editData, setEditData] = useState(null);
    const [delTarget, setDelTarget] = useState(null);
    const [saving, setSaving] = useState(false);

    /* bulk assign state */
    const [bulkDomains, setBulkDomains] = useState([]);
    const [bulkInternships, setBulkInternships] = useState([]);
    const [bulkCompanies, setBulkCompanies] = useState([]);
    const [bulkRoles, setBulkRoles] = useState([]);
    const [bulkTrainings, setBulkTrainings] = useState([]);
    const [bulkSkills, setBulkSkills] = useState([]);

    const loadDomains = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('https://cit3.internshipstudio.com/admin/react-api/api/adminPanel/roadmap/roadmap_api.php?action=get_domains');
            setDomains(r.data.data?.domains || []);
        } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setLoading(false); }
    }, []);

    const loadAllItems = useCallback(async () => {
        try {
            const r = await api.get('https://cit3.internshipstudio.com/admin/react-api/api/adminPanel/roadmap/roadmap_api.php?action=get_all_items');
            setAllItems(r.data.data);
        } catch { }
    }, []);

    useEffect(() => { loadDomains(); loadAllItems(); }, [loadDomains, loadAllItems]);

    /* ── add domain ── */
    const [form, setForm] = useState({ name: '', logo: '' });
    const upd = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

    const handleAddDomain = async () => {
        if (!form.name.trim()) { toast.error('Name required'); return; }
        setSaving(true);
        try {
            const fd = new URLSearchParams({ action: 'add_domain', name: form.name, logo: form.logo });
            await api.post('https://cit3.internshipstudio.com/admin/react-api/api/adminPanel/roadmap/roadmap_api.php', fd);
            toast.success('Domain added'); setModal(null); setForm({ name: '', logo: '' }); loadDomains();
        } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };

    const handleEditDomain = async () => {
        if (!editData.name.trim()) { toast.error('Name required'); return; }
        setSaving(true);
        try {
            const fd = new URLSearchParams({ action: 'edit_domain', id: editData.domain_id, name: editData.name, logo: editData.logo || '' });
            await api.post('https://cit3.internshipstudio.com/admin/react-api/api/adminPanel/roadmap/roadmap_api.php', fd);
            toast.success('Domain updated'); setModal(null); loadDomains();
        } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };

    const handleDeleteDomain = async () => {
        setSaving(true);
        try {
            const fd = new URLSearchParams({ action: 'delete_domain', id: delTarget.domain_id });
            await api.post('https://cit3.internshipstudio.com/admin/react-api/api/adminPanel/roadmap/roadmap_api.php', fd);
            toast.success('Domain deleted'); setModal(null); setDelTarget(null); loadDomains();
        } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };

    /* ── bulk assign ── */
    const handleBulkAssign = async () => {
        if (!bulkDomains.length) { toast.error('Select at least one target domain'); return; }
        setSaving(true);
        try {
            const fd = new URLSearchParams({
                action: 'bulk_assign',
                to_domains: JSON.stringify(bulkDomains),
                internships: JSON.stringify(bulkInternships),
                companies: JSON.stringify(bulkCompanies),
                roles: JSON.stringify(bulkRoles),
                trainings: JSON.stringify(bulkTrainings),
                skills: JSON.stringify(bulkSkills),
            });
            await api.post('https://cit3.internshipstudio.com/admin/react-api/api/adminPanel/roadmap/roadmap_api.php', fd);
            toast.success('Items assigned successfully');
            setBulkDomains([]); setBulkInternships([]); setBulkCompanies([]);
            setBulkRoles([]); setBulkTrainings([]); setBulkSkills([]);
            loadDomains();
        } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };

    /* ── totals ── */
    const totals = domains.reduce((a, d) => ({
        domains: a.domains + 1, companies: a.companies + (+d.companies_count || 0),
        internships: a.internships + (+d.internships_count || 0), roles: a.roles + (+d.roles_count || 0),
        trainings: a.trainings + (+d.trainings_count || 0),
    }), { domains: 0, companies: 0, internships: 0, roles: 0, trainings: 0 });

    const statCards = [
        { label: 'Domains', val: totals.domains, bg: '#dbeafe', color: '#1d4ed8' },
        { label: 'Companies', val: totals.companies, bg: '#dcfce7', color: '#15803d' },
        { label: 'Internships', val: totals.internships, bg: '#fef9c3', color: '#854d0e' },
        { label: 'Roles', val: totals.roles, bg: '#f5f3ff', color: '#4f46e5' },
        { label: 'Trainings', val: totals.trainings, bg: '#fce7f3', color: '#9d174d' },
    ];

    /* ── quick-add forms for non-domain items ── */
    const [qForm, setQForm] = useState({});
    const qUpd = k => e => setQForm(p => ({ ...p, [k]: e.target.value }));

    const handleQuickAdd = async (action, fields) => {
        setSaving(true);
        try {
            const fd = new URLSearchParams({ action, ...fields });
            await api.post('https://cit3.internshipstudio.com/admin/react-api/api/adminPanel/roadmap/roadmap_api.php', fd);
            toast.success('Added successfully'); setModal(null); setQForm({}); loadDomains(); loadAllItems();
        } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };

    const [selDomains, setSelDomains] = useState([]);

    const inpS = { width: '100%', padding: '8px 11px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: '#1e293b', outline: 'none' };

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .rm-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        @keyframes rm_spin { to { transform:rotate(360deg); } }
        .rm-spin { display:inline-block;width:16px;height:16px;border:2px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:rm_spin .7s linear infinite; }
        .rm-chk:checked { accent-color:#4f46e5; }
      `}</style>

            <div className="rm-root" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 62px)', background: '#f5f3ff', overflowY: 'auto', padding: 20, gap: 16 }}>

                {/* ── HEADER ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>🗺️ Career Roadmap Dashboard</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Manage career domains and their associated data</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {[
                            { label: '+ Domain', modal: 'add_domain' },
                            { label: '+ Company', modal: 'add_company' },
                            { label: '+ Internship', modal: 'add_internship' },
                            { label: '+ Role', modal: 'add_role' },
                            { label: '+ Training', modal: 'add_training' },
                            { label: '+ Skill', modal: 'add_skill' },
                        ].map(b => (
                            <button key={b.modal} onClick={() => { setSelDomains([]); setQForm({}); setModal(b.modal); }}
                                style={{
                                    padding: '7px 14px', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                                    color: '#fff', fontFamily: 'inherit', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)'
                                }}>
                                {b.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── STAT CHIPS ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
                    {statCards.map(s => (
                        <div key={s.label} style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #ede9fe', padding: '14px 16px', boxShadow: '0 1px 5px rgba(79,70,229,.06)' }}>
                            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{fmtN(s.val)}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 4 }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* ── BULK ASSIGN ── */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #ede9fe', padding: 20, boxShadow: '0 1px 6px rgba(79,70,229,.07)' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', marginBottom: 14 }}>📦 Bulk-Assign Items to Domains</div>
                    <div style={{ marginBottom: 14 }}>
                        <DomainSelector domains={domains} selected={bulkDomains} onChange={setBulkDomains} />
                    </div>
                    {allItems && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12, marginBottom: 16 }}>
                            {[
                                { label: 'Internships', items: allItems.internships, idKey: 'internship_id', nameKey: 'title', state: bulkInternships, setState: setBulkInternships },
                                { label: 'Companies', items: allItems.companies, idKey: 'company_id', nameKey: 'company_name', state: bulkCompanies, setState: setBulkCompanies },
                                { label: 'Roles', items: allItems.roles, idKey: 'role_id', nameKey: 'title', state: bulkRoles, setState: setBulkRoles },
                                { label: 'Trainings', items: allItems.trainings, idKey: 'training_id', nameKey: 'title', state: bulkTrainings, setState: setBulkTrainings },
                                { label: 'Skills', items: allItems.skills_all, idKey: 'skill_id', nameKey: 'skill', state: bulkSkills, setState: setBulkSkills },
                            ].map(({ label, items, idKey, nameKey, state, setState }) => (
                                <div key={label}>
                                    <Label c={`${label} (${items.length})`} />
                                    <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '8px', maxHeight: 160, overflowY: 'auto', background: '#fafafe' }}>
                                        {!items.length ? <div style={{ fontSize: 12, color: '#94a3b8', padding: 6 }}>No {label.toLowerCase()} available</div>
                                            : items.map(it => (
                                                <label key={it[idKey]} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 2px', cursor: 'pointer', fontSize: 12.5 }}>
                                                    <input type="checkbox" className="rm-chk" checked={state.includes(it[idKey])}
                                                        onChange={e => setState(prev => e.target.checked ? [...prev, it[idKey]] : prev.filter(x => x !== it[idKey]))} />
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it[nameKey]}>{it[nameKey]}</span>
                                                </label>
                                            ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <Btn variant="success" onClick={handleBulkAssign} disabled={saving}>
                            {saving ? <><span className="rm-spin" /> Assigning...</> : '✓ Assign Selected Items'}
                        </Btn>
                        <Btn variant="gray" onClick={() => { setBulkDomains([]); setBulkInternships([]); setBulkCompanies([]); setBulkRoles([]); setBulkTrainings([]); setBulkSkills([]); }}>
                            Clear All
                        </Btn>
                    </div>
                </div>

                {/* ── DOMAINS GRID ── */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 50, color: '#94a3b8' }}>
                        <span className="rm-spin" style={{ width: 24, height: 24, borderWidth: 3, display: 'inline-block' }} /><br />
                        <div style={{ marginTop: 10, fontSize: 13 }}>Loading domains...</div>
                    </div>
                ) : !domains.length ? (
                    <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
                        <div style={{ fontSize: 40, marginBottom: 10 }}>🗺️</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>No domains yet. Create one to get started.</div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
                        {domains.map(d => (
                            <DomainCard key={d.domain_id} domain={d}
                                onEdit={d => { setEditData({ ...d }); setModal('edit_domain'); }}
                                onDelete={d => { setDelTarget(d); setModal('delete_domain'); }} />
                        ))}
                    </div>
                )}
            </div>

            {/* ══════════ MODALS ══════════ */}

            {/* Add Domain */}
            {modal === 'add_domain' && (
                <Modal title="➕ Add Domain" onClose={() => setModal(null)}>
                    <FF label="Name *"><Inp value={form.name} onChange={upd('name')} placeholder="e.g. Web Development" /></FF>
                    <FF label="Logo URL"><Inp value={form.logo} onChange={upd('logo')} placeholder="https://..." /></FF>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                        <Btn variant="gray" onClick={() => setModal(null)}>Cancel</Btn>
                        <Btn onClick={handleAddDomain} disabled={saving}>💾 Add Domain</Btn>
                    </div>
                </Modal>
            )}

            {/* Edit Domain */}
            {modal === 'edit_domain' && editData && (
                <Modal title="✏️ Edit Domain" onClose={() => setModal(null)}>
                    <FF label="Name *"><Inp value={editData.name} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} /></FF>
                    <FF label="Logo URL"><Inp value={editData.logo || ''} onChange={e => setEditData(p => ({ ...p, logo: e.target.value }))} /></FF>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                        <Btn variant="gray" onClick={() => setModal(null)}>Cancel</Btn>
                        <Btn onClick={handleEditDomain} disabled={saving}>💾 Update Domain</Btn>
                    </div>
                </Modal>
            )}

            {/* Delete Domain */}
            {modal === 'delete_domain' && delTarget && (
                <Modal title="🗑️ Delete Domain" onClose={() => setModal(null)}>
                    <div style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>
                        Are you sure you want to delete <strong>{delTarget.name}</strong>?<br />
                        <span style={{ color: '#ef4444', fontSize: 12 }}>This will also delete all associated companies, internships, roles, trainings, and skills.</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <Btn variant="gray" onClick={() => setModal(null)}>Cancel</Btn>
                        <Btn variant="danger" onClick={handleDeleteDomain} disabled={saving}>🗑️ Delete Domain</Btn>
                    </div>
                </Modal>
            )}

            {/* Add Company (quick add from dashboard — with domain multi-select) */}
            {modal === 'add_company' && (
                <Modal title="🏢 Add Company" onClose={() => setModal(null)}>
                    <DomainSelector domains={domains} selected={selDomains} onChange={setSelDomains} />
                    <div style={{ height: 12 }} />
                    <FF label="Company Name *"><Inp value={qForm.company_name || ''} onChange={qUpd('company_name')} /></FF>
                    <FF label="Logo URL"><Inp value={qForm.logo || ''} onChange={qUpd('logo')} placeholder="https://..." /></FF>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                        <Btn variant="gray" onClick={() => setModal(null)}>Cancel</Btn>
                        <Btn disabled={saving} onClick={async () => {
                            if (!selDomains.length || !qForm.company_name?.trim()) { toast.error('Select domain & enter name'); return; }
                            setSaving(true);
                            for (const did of selDomains) {
                                try { await api.post('https://cit3.internshipstudio.com/admin/react-api/api/adminPanel/roadmap/roadmap_api.php', new URLSearchParams({ action: 'add_company', domain_id: did, company_name: qForm.company_name, logo: qForm.logo || '' })); } catch { }
                            }
                            toast.success('Company added'); setModal(null); setQForm({}); loadDomains(); loadAllItems(); setSaving(false);
                        }}>💾 Add</Btn>
                    </div>
                </Modal>
            )}

            {/* Add Internship */}
            {modal === 'add_internship' && (
                <Modal title="💼 Add Internship" onClose={() => setModal(null)} wide>
                    <DomainSelector domains={domains} selected={selDomains} onChange={setSelDomains} />
                    <div style={{ height: 12 }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <FF label="Company *"><Inp value={qForm.company || ''} onChange={qUpd('company')} /></FF>
                        <FF label="Logo URL"><Inp value={qForm.logo || ''} onChange={qUpd('logo')} placeholder="https://..." /></FF>
                    </div>
                    <FF label="Title *"><Inp value={qForm.title || ''} onChange={qUpd('title')} /></FF>
                    <FF label="Brief Description *"><textarea value={qForm.description || ''} onChange={qUpd('description')} rows={2}
                        style={{ width: '100%', padding: '8px 11px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} /></FF>
                    <FF label="Full Description *"><textarea value={qForm.fullDescription || ''} onChange={qUpd('fullDescription')} rows={4}
                        style={{ width: '100%', padding: '8px 11px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} /></FF>
                    <FF label="Skills (comma-separated)"><Inp value={qForm.skills || ''} onChange={qUpd('skills')} placeholder="Python, SQL" /></FF>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                        <Btn variant="gray" onClick={() => setModal(null)}>Cancel</Btn>
                        <Btn disabled={saving} onClick={async () => {
                            if (!selDomains.length || !qForm.company?.trim() || !qForm.title?.trim()) { toast.error('Select domain, company & title'); return; }
                            setSaving(true);
                            for (const did of selDomains) {
                                try { await api.post('https://cit3.internshipstudio.com/admin/react-api/api/adminPanel/roadmap/roadmap_api.php', new URLSearchParams({ action: 'add_internship', domain_id: did, ...qForm })); } catch { }
                            }
                            toast.success('Internship added'); setModal(null); setQForm({}); loadDomains(); loadAllItems(); setSaving(false);
                        }}>💾 Add</Btn>
                    </div>
                </Modal>
            )}

            {/* Add Role */}
            {modal === 'add_role' && (
                <Modal title="👔 Add Role" onClose={() => setModal(null)} wide>
                    <DomainSelector domains={domains} selected={selDomains} onChange={setSelDomains} />
                    <div style={{ height: 12 }} />
                    <FF label="Title *"><Inp value={qForm.title || ''} onChange={qUpd('title')} /></FF>
                    <FF label="Skills (comma-separated)"><Inp value={qForm.skills || ''} onChange={qUpd('skills')} placeholder="Leadership, SQL" /></FF>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                        <FF label="Year"><Inp type="number" value={qForm.year || ''} onChange={qUpd('year')} min="2000" max="2100" /></FF>
                        <FF label="Current Salary"><Inp type="number" value={qForm.salary || ''} onChange={qUpd('salary')} min="0" step="1000" /></FF>
                        <FF label="Projected Salary"><Inp type="number" value={qForm.projectedSalary || ''} onChange={qUpd('projectedSalary')} min="0" step="1000" /></FF>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                        <Btn variant="gray" onClick={() => setModal(null)}>Cancel</Btn>
                        <Btn disabled={saving} onClick={async () => {
                            if (!selDomains.length || !qForm.title?.trim()) { toast.error('Select domain & enter title'); return; }
                            setSaving(true);
                            for (const did of selDomains) {
                                try { await api.post('https://cit3.internshipstudio.com/admin/react-api/api/adminPanel/roadmap/roadmap_api.php', new URLSearchParams({ action: 'add_role', domain_id: did, ...qForm })); } catch { }
                            }
                            toast.success('Role added'); setModal(null); setQForm({}); loadDomains(); loadAllItems(); setSaving(false);
                        }}>💾 Add</Btn>
                    </div>
                </Modal>
            )}

            {/* Add Training */}
            {modal === 'add_training' && (
                <Modal title="📚 Add Training" onClose={() => setModal(null)}>
                    <DomainSelector domains={domains} selected={selDomains} onChange={setSelDomains} />
                    <div style={{ height: 12 }} />
                    <FF label="Title *"><Inp value={qForm.title || ''} onChange={qUpd('title')} /></FF>
                    <FF label="Icon (emoji)"><Inp value={qForm.icon || ''} onChange={qUpd('icon')} placeholder="📚" /></FF>
                    <FF label="Completion Rate (%)"><Inp type="number" value={qForm.completion || '0'} onChange={qUpd('completion')} min="0" max="100" /></FF>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                        <Btn variant="gray" onClick={() => setModal(null)}>Cancel</Btn>
                        <Btn disabled={saving} onClick={async () => {
                            if (!selDomains.length || !qForm.title?.trim()) { toast.error('Select domain & enter title'); return; }
                            setSaving(true);
                            for (const did of selDomains) {
                                try { await api.post('https://cit3.internshipstudio.com/admin/react-api/api/adminPanel/roadmap/roadmap_api.php', new URLSearchParams({ action: 'add_training', domain_id: did, ...qForm, completion: qForm.completion || 0 })); } catch { }
                            }
                            toast.success('Training added'); setModal(null); setQForm({}); loadDomains(); loadAllItems(); setSaving(false);
                        }}>💾 Add</Btn>
                    </div>
                </Modal>
            )}

            {/* Add Skill */}
            {modal === 'add_skill' && (
                <Modal title="🔧 Add Skill" onClose={() => setModal(null)}>
                    <DomainSelector domains={domains} selected={selDomains} onChange={setSelDomains} />
                    <div style={{ height: 12 }} />
                    <FF label="Skill Name *"><Inp value={qForm.skill || ''} onChange={qUpd('skill')} /></FF>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                        <Btn variant="gray" onClick={() => setModal(null)}>Cancel</Btn>
                        <Btn disabled={saving} onClick={async () => {
                            if (!selDomains.length || !qForm.skill?.trim()) { toast.error('Select domain & enter skill'); return; }
                            setSaving(true);
                            for (const did of selDomains) {
                                try { await api.post('https://cit3.internshipstudio.com/admin/react-api/api/adminPanel/roadmap/roadmap_api.php', new URLSearchParams({ action: 'add_skill', domain_id: did, skill: qForm.skill })); } catch { }
                            }
                            toast.success('Skill added'); setModal(null); setQForm({}); loadDomains(); loadAllItems(); setSaving(false);
                        }}>💾 Add</Btn>
                    </div>
                </Modal>
            )}
        </>
    );
}