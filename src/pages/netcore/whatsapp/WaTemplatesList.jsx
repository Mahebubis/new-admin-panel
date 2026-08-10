import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import WaMessageCard from './WaMessageCard';
import WaTemplateImportModal from './WaTemplateImportModal';
import { WA_TPL_API, FORM, WA, WA_CSS, fmtDate, n0 } from './waShared';
import { Spinner, WhatsAppIcon, ApprovalBadge, CategoryChip, Notice } from './WaUi';

const STATUS_TABS = [{ key: 'active', label: 'Active' }, { key: 'archived', label: 'Archived' }];
const CATEGORIES = [
  { key: '', label: 'All categories' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'utility', label: 'Utility' },
  { key: 'authentication', label: 'Authentication' },
];
const APPROVALS = [
  { key: '', label: 'All' },
  { key: 'approved', label: 'Approved', tone: 'good' },
  { key: 'pending', label: 'Pending', tone: 'warn' },
  { key: 'rejected', label: 'Rejected', tone: 'bad' },
  { key: 'unknown', label: 'Unknown' },
];

/* One filter pill, used by both the category and approval rows so they stay visually identical. */
function Chip({ on, tone, onClick, children }) {
  const tones = {
    good: { fg: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
    warn: { fg: '#b45309', bg: '#fffbeb', border: '#fde68a' },
    bad:  { fg: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  };
  const t = on ? (tones[tone] || { fg: WA.primary, bg: '#eef2ff', border: WA.primary }) : null;
  return (
    <button type="button" onClick={onClick}
      style={{
        padding: '6px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
        fontFamily: 'inherit', whiteSpace: 'nowrap',
        border: `1.5px solid ${t ? t.border : '#e2e8f0'}`,
        background: t ? t.bg : '#fff',
        color: t ? t.fg : '#64748b',
      }}>
      {children}
    </button>
  );
}

export default function WaTemplatesList() {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [approval, setApproval] = useState('');
  const [approvalCounts, setApprovalCounts] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [checkingId, setCheckingId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const fetchPage = async (p = 1, s = search, st = status, cat = category, ap = approval) => {
    setLoading(true);
    try {
      const body = new URLSearchParams({ action: 'list', page: p, per_page: 24, search: s, status: st, category: cat, approval: ap });
      const res = await api.post(WA_TPL_API, body, FORM);
      if (res.data.success) {
        const d = res.data.data;
        setRows(d.templates || []); setPage(d.page); setPages(d.pages); setTotal(d.total);
        setApprovalCounts(d.approval_counts || {});
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchPage(1, search, status, category, approval); }, [status, category, approval]); // eslint-disable-line

  /* Re-checks one template with Meta. Offered per card because the useful question with 130+
     templates is "did THIS one get approved yet", not "re-read all of them". */
  const checkStatus = async (id) => {
    setCheckingId(id);
    try {
      const res = await api.post(WA_TPL_API, new URLSearchParams({ action: 'refresh_status', id }), FORM);
      if (res.data.success) {
        const next = res.data.data.approval_status;
        const why  = res.data.data.rejected_message || '';
        /* A rejection with no reason is the one status an admin can do nothing with, so Meta's
           own explanation is shown as a persistent error rather than a passing success toast. */
        if (next === 'rejected' && why) toast.error(`Rejected — ${why}`, { duration: 20000 });
        else toast.success(`Status: ${next}`);
        setRows(rs => rs.map(r => (r.id === id
          ? { ...r, approval_status: next, rejected_message: why }
          : r)));
      } else toast.error(res.data.message || 'Could not check', { duration: 10000 });
    } catch (e) { toast.error(e?.response?.data?.message || 'Could not check', { duration: 10000 }); }
    finally { setCheckingId(null); }
  };

  const runAction = async (action, id) => {
    const t = toast.loading('Working…');
    try {
      const res = await api.post(WA_TPL_API, new URLSearchParams({ action, id }), FORM);
      if (res.data.success) { toast.success('Done', { id: t }); fetchPage(page); }
      else toast.error(res.data.message || 'Failed', { id: t });
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error', { id: t }); }
  };

  const sync = async () => {
    setSyncing(true);
    const t = toast.loading('Reading your templates from WhatsApp…');
    try {
      const res = await api.post(WA_TPL_API, new URLSearchParams({ action: 'sync' }), FORM);
      if (res.data.success) {
        const d = res.data.data;
        toast.success(`${d.found} found · ${d.imported} imported, ${d.updated} updated`, { id: t });
        fetchPage(1, search, status, category);
      } else toast.error(res.data.message || 'Sync failed', { id: t, duration: 12000 });
    } catch (e) { toast.error(e?.response?.data?.message || 'Sync failed', { id: t, duration: 12000 }); }
    finally { setSyncing(false); }
  };

  return (
    <>
      <style>{WA_CSS}</style>
      <div className="wa" style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexShrink: 0, gap: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ width: 40, height: 40, borderRadius: 10, background: WA.green, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <WhatsAppIcon size={22} color="#fff" />
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
                WhatsApp templates <span style={{ fontWeight: 600, color: '#64748b', fontSize: 15 }}>({n0(total)})</span>
              </h2>
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>
                Reusable message templates for your WhatsApp campaigns
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchPage(1, search)}
              placeholder="Search templates…"
              style={{ padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', width: 200 }} />
            <button className="wa-btn wa-btn-text" onClick={() => setImportOpen(true)}
              title="Fallback: paste an export instead of syncing">
              Paste import
            </button>
            <button className="wa-btn wa-btn-outlined" onClick={sync} disabled={syncing}
              title="Read the live template list from your WhatsApp Business Account">
              {syncing ? 'Syncing…' : 'Sync from WhatsApp'}
            </button>
            <button className="wa-btn wa-btn-contained" onClick={() => nav('/netcore/whatsapp/templates/new')}>
              + Create template
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
          <div style={{ display: 'flex' }}>
            {STATUS_TABS.map(t => (
              <button key={t.key} className={`wa-tab${status === t.key ? ' active' : ''}`} onClick={() => setStatus(t.key)}>{t.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', paddingBottom: 8, flexWrap: 'wrap' }}>
            {CATEGORIES.map(c => (
              <Chip key={c.key} on={category === c.key} onClick={() => setCategory(c.key)}>{c.label}</Chip>
            ))}
          </div>
        </div>

        {/* Approval is the filter that decides whether a template can be sent at all, so it gets
            its own row with live counts rather than hiding among the category chips. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 16px', flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '.4px', marginRight: 2 }}>APPROVAL</span>
          {APPROVALS.map(a => (
            <Chip key={a.key} on={approval === a.key} tone={a.tone} onClick={() => setApproval(a.key)}>
              {a.label}
              <span style={{ opacity: .65, marginLeft: 5 }}>
                {n0(a.key === '' ? approvalCounts.all : approvalCounts[a.key])}
              </span>
            </Chip>
          ))}
          {Number(approvalCounts.approved) > 0 && (
            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>
              Only approved templates can actually be delivered.
            </span>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {loading && rows.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220 }}><Spinner /></div>
          ) : rows.length === 0 ? (
            <div style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 8 }}>No templates here yet</div>
              <Notice tone="info" style={{ textAlign: 'left' }}>
                A WhatsApp template must be approved by Meta before it can be sent. Press
                <b> Sync from WhatsApp</b> to read the live list — name, body, buttons and the real approval
                status — straight from your WhatsApp Business Account. It needs a Meta access token, which
                you add once under Settings → Template sync (Netcore's messaging API has no template
                endpoint, and Meta is the authority on approvals anyway).
              </Notice>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18, paddingBottom: 24, alignItems: 'start' }}>
              {rows.map(t => {
                // Sample values make the card show a realistic message instead of raw {{1}} tokens.
                const samples = Array.isArray(t.sample_values?.body) ? t.sample_values.body : [];
                return (
                  <article key={t.id} className="wa-card">
                    {/* Title → attributes → message → actions. Identity first because with 130+
                        templates you scan for a name, not for a picture. */}
                    <div style={{ padding: '14px 16px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-.01em' }}>
                          {t.display_name || t.name}
                        </h3>
                        <ApprovalBadge status={t.approval_status} />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 7 }}>
                        <CategoryChip category={t.category} />
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{t.language}</span>
                        {t.body_variable_count > 0 && (
                          <span style={{ fontSize: 11, color: '#1e3a8a', fontWeight: 600 }}>
                            {t.body_variable_count} variable{t.body_variable_count > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ padding: '12px 16px 14px', flex: 1 }}>
                      <WaMessageCard
                        headerType={t.header_type}
                        headerText={t.header_text}
                        headerValues={Array.isArray(t.sample_values?.header) ? t.sample_values.header : []}
                        bodyText={t.body_text}
                        bodyValues={samples}
                        footerText={t.footer_text}
                        buttons={t.buttons || []}
                      />

                      {/* Only APPROVED templates deliver, so the other states say what to do
                          rather than just showing a badge. */}
                      {t.approval_status !== 'approved' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginTop: 10, fontSize: 11, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '7px 10px', lineHeight: 1.5 }}>
                          {/* Meta's own reason once we have it — "rejected" alone gives an admin
                              nothing to change, and the reason is the entire point of pressing
                              Check on a rejected template. */}
                          <span>
                            {t.approval_status === 'rejected'
                              ? (t.rejected_message || 'Meta rejected this — press Check to see why.')
                              : 'Waiting on Meta.'}
                          </span>
                          {t.meta_template_id && (
                            <button className="wa-btn wa-btn-text wa-btn-sm" onClick={() => checkStatus(t.id)}
                              disabled={checkingId === t.id} style={{ color: '#b45309' }}>
                              {checkingId === t.id ? 'Checking' : 'Check'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="wa-card-actions">
                      <span style={{ fontSize: 10, color: '#cbd5e1', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 4 }}>
                        {fmtDate(t.updated_at)}
                      </span>
                      {status === 'active' ? (
                        <>
                          <button className="wa-btn wa-btn-text wa-btn-sm" title="Hide from the campaign picker"
                            onClick={() => setConfirm({ id: t.id, action: 'archive', label: `archive "${t.name}"` })}>
                            Archive
                          </button>
                          <button className="wa-btn wa-btn-outlined wa-btn-sm"
                            onClick={() => nav(`/netcore/whatsapp/templates/${t.id}`)}>
                            Edit
                          </button>
                          <button className="wa-btn wa-btn-contained wa-btn-sm"
                            onClick={() => nav(`/netcore/whatsapp/new?template_id=${t.id}`)}
                            disabled={t.approval_status !== 'approved'}
                            title={t.approval_status === 'approved' ? 'Start a campaign with this template' : 'Only approved templates can be sent'}>
                            Use
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="wa-btn wa-btn-text wa-btn-sm" style={{ color: '#dc2626' }}
                            onClick={() => setConfirm({ id: t.id, action: 'delete', label: `permanently delete "${t.name}"` })}>
                            Delete
                          </button>
                          <button className="wa-btn wa-btn-primary wa-btn-sm" onClick={() => runAction('restore', t.id)}>
                            Restore
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14, flexShrink: 0 }}>
            <button disabled={page <= 1} onClick={() => fetchPage(page - 1)}
              style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Prev</button>
            <span style={{ fontSize: 12.5, color: '#475569', alignSelf: 'center' }}>Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => fetchPage(page + 1)}
              style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: page >= pages ? 'not-allowed' : 'pointer', opacity: page >= pages ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Next</button>
          </div>
        )}
      </div>

      {importOpen && (
        <WaTemplateImportModal
          onClose={() => setImportOpen(false)}
          onImported={() => fetchPage(1, search, status, category)}
        />
      )}

      {confirm && (
        <div className="wa-backdrop" onClick={() => setConfirm(null)}>
          <div className="wa-dialog" style={{ padding: 26, width: 420, fontFamily: "'Plus Jakarta Sans',sans-serif" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
              {confirm.action === 'delete' ? 'Delete this template?' : 'Archive this template?'}
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
              You're about to {confirm.label}. Campaigns already built with it keep their own snapshot, so
              nothing scheduled or sent is affected.
            </div>

            {/* Delete now reaches Meta as well, and that is not reversible from here — a template
                removed from the WABA has to be re-created and re-approved. Said before the click,
                not discovered after it. */}
            {confirm.action === 'delete' && (
              <Notice tone="danger" style={{ marginBottom: 20 }}>
                This also <b>deletes it from Meta</b>, freeing the name so you can create it again.
                Meta removes every language version, and it cannot be undone — the template would
                have to be re-submitted for approval.
              </Notice>
            )}

            {/* Delete lives on the Archived tab, which is not obvious from here. Saying so turns a
                dead end into a two-step path. */}
            {confirm.action === 'archive' && (
              <Notice tone="info" style={{ marginBottom: 20 }}>
                To remove it permanently — including from Meta — open the <b>Archived</b> tab afterwards
                and press <b>Delete</b> there.
              </Notice>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="wa-btn wa-btn-text" onClick={() => setConfirm(null)}>Cancel</button>
              <button className={`wa-btn ${confirm.action === 'delete' ? 'wa-btn-contained' : 'wa-btn-primary'}`}
                style={confirm.action === 'delete' ? { background: '#dc2626' } : undefined}
                onClick={() => { runAction(confirm.action, confirm.id); setConfirm(null); }}>
                {confirm.action === 'delete' ? 'Delete' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
