import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/lists/lists.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const PER_PAGE_OPTS = [10, 25, 50, 100];

function Spinner() {
  return <span style={{ display: 'inline-block', width: 32, height: 32, borderRadius: '50%', border: '3px solid #c4b5fd', borderTopColor: '#4f46e5', animation: 'nc_spin 0.85s linear infinite' }} />;
}

export default function NetcoreListContacts({ basePath = '/netcore/lists', idOverride, importPath, titleOverride } = {}) {
  const { id: idParam } = useParams();
  const id = idOverride || idParam;
  const nav = useNavigate();
  const [listName, setListName] = useState('');
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [pages, setPages]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [applied, setApplied] = useState('');
  const searchInputRef = useRef(null);
  // Guards against React StrictMode's dev-only double-invoke of effects (mounts twice on
  // purpose in development to catch non-idempotent effects) — without this, every page load
  // would fire each of these requests twice in dev. Keyed by id (not just a plain boolean) so
  // a genuine id change — navigating from one list/blocklist to another — still refetches.
  const fetchedNameForId = useRef(null);
  const fetchedMembersForId = useRef(null);

  useEffect(() => {
    if (fetchedNameForId.current === id) return;
    fetchedNameForId.current = id;
    (async () => {
      try {
        const res = await api.post(API, new URLSearchParams({ action: 'get', id }), FORM);
        if (res.data.success) setListName(res.data.data.list.name);
      } catch { /* non-critical */ }
    })();
  }, [id]);

  const fetchPage = async (p = page, pp = perPage, s = applied) => {
    setLoading(true);
    try {
      const res = await api.post(API, new URLSearchParams({ action: 'members', id, page: p, per_page: pp, search: s }), FORM);
      if (res.data.success) {
        setRows(res.data.data.members || []);
        setTotal(res.data.data.total || 0);
        setPage(res.data.data.page); setPages(res.data.data.pages); setPerPage(res.data.data.per_page);
      }
    } finally { setLoading(false); }
  };
  useEffect(() => {
    if (fetchedMembersForId.current === id) return;
    fetchedMembersForId.current = id;
    fetchPage(1, perPage, '');
  }, [id]); // eslint-disable-line

  const onSearchKey = e => {
    if (e.key === 'Enter') { setApplied(search); fetchPage(1, perPage, search); }
  };

  const removeContact = async (contactId) => {
    if (!window.confirm('Remove this contact from the list?')) return;
    const t = toast.loading('Removing…');
    try {
      const res = await api.post(API, new URLSearchParams({ action: 'remove_member', list_id: id, contact_id: contactId }), FORM);
      if (res.data.success) { toast.success('Removed', { id: t }); fetchPage(); }
      else toast.error(res.data.message || 'Failed', { id: t });
    } catch { toast.error('Network error', { id: t }); }
  };

  const COLS = ['Email', 'First name', 'Last name', 'Phone', 'State', 'Country', 'City', 'Added on', ''];

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`@keyframes nc_spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexShrink: 0 }}>
        <button onClick={() => nav(basePath)} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#0f172a' }}>{titleOverride || listName || 'List'} <span style={{ fontWeight: 600, color: '#64748b' }}>({total.toLocaleString()})</span></div>
          <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Contacts in this list</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <input ref={searchInputRef} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={onSearchKey}
            placeholder="Search email / name and press Enter…"
            style={{ padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', width: 260 }} />
          {importPath && (
            <button onClick={() => nav(importPath)} style={{ padding: '9px 16px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Import contacts
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.05)', overflow: 'hidden', position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.85)', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spinner />
          </div>
        )}
        <div style={{ height: '100%', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2 }}>
              <tr>
                {COLS.map(c => <th key={c} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading
                ? <tr><td colSpan={COLS.length} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>{applied ? `No contacts matching "${applied}".` : 'No contacts in this list yet — import a CSV to add some.'}</td></tr>
                : rows.map(r => (
                    <tr key={r.id}>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#1e3a8a', fontWeight: 600 }}>{r.email}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>{r.first_name || '—'}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>{r.last_name || '—'}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>{r.phone || '—'}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>{r.state || '—'}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>{r.country || '—'}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>{r.city || '—'}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#94a3b8' }}>{r.added_at}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9' }}>
                        <button onClick={() => removeContact(r.id)} title="Remove from list"
                          style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Remove</button>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 13, color: '#475569', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Per page:</span>
          <select value={perPage} onChange={e => fetchPage(1, parseInt(e.target.value, 10), applied)}
            style={{ padding: '6px 10px', border: '1.5px solid #c4b5fd', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none', background: '#fff', cursor: 'pointer' }}>
            {PER_PAGE_OPTS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Page {page} of {pages || 1}</span>
          <button disabled={page <= 1 || loading} onClick={() => fetchPage(page - 1, perPage, applied)}
            style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Prev</button>
          <button disabled={page >= pages || loading} onClick={() => fetchPage(page + 1, perPage, applied)}
            style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: page >= pages ? 'not-allowed' : 'pointer', opacity: page >= pages ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Next</button>
        </div>
      </div>
    </div>
  );
}
