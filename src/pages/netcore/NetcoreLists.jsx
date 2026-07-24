import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import CreateListModal from './CreateListModal';

const API = '/api/lists/lists.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const PER_PAGE_OPTS = [10, 25, 50, 100];

function fmtDt(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  if (isNaN(d.getTime())) return s;
  const pad = n => String(n).padStart(2, '0');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()} ${pad(d.getHours() % 12 || 12)}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

function Spinner({ size = 32 }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', border: '3px solid #c4b5fd', borderTopColor: '#4f46e5', animation: 'nc_spin 0.85s linear infinite' }} />;
}

export default function NetcoreLists() {
  const nav = useNavigate();
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [pages, setPages]     = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch]               = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [searchOpen, setSearchOpen]       = useState(false);
  const searchInputRef = useRef(null);

  const [menuFor, setMenuFor] = useState(null);
  const menuRef = useRef(null);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchPage = async (p = page, pp = perPage, s = appliedSearch) => {
    setLoading(true); setMenuFor(null);
    try {
      const body = new URLSearchParams({ action: 'list', page: p, per_page: pp, search: s });
      const res = await api.post(API, body, FORM);
      if (res.data.success) {
        setRows(res.data.data.lists || []);
        setTotal(res.data.data.total || 0);
        setPage(res.data.data.page); setPages(res.data.data.pages); setPerPage(res.data.data.per_page);
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchPage(1, perPage, ''); }, []); // eslint-disable-line

  useEffect(() => {
    if (!menuFor) return;
    const onDown = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuFor(null); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuFor]);

  const doDelete = async (id) => {
    setMenuFor(null);
    if (!window.confirm('Delete this list? Contacts already imported into it will not be deleted, only the list grouping.')) return;
    const t = toast.loading('Deleting…');
    try {
      const res = await api.post(API, new URLSearchParams({ action: 'delete', id }), FORM);
      if (res.data.success) { toast.success('Deleted', { id: t }); fetchPage(); }
      else toast.error(res.data.message || 'Failed', { id: t });
    } catch { toast.error('Network error', { id: t }); }
  };

  const doDownload = async (id, name) => {
    setMenuFor(null);
    const t = toast.loading('Preparing download…');
    try {
      const res = await api.get(API, { params: { action: 'download', id }, responseType: 'blob' });
      const cd = res.headers?.['content-disposition'] || '';
      const m  = /filename="?([^";]+)"?/.exec(cd);
      const fname = m ? m[1] : `${name || 'list'}.csv`;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = fname;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Downloaded', { id: t });
    } catch { toast.error('Download failed', { id: t }); }
  };

  const onSearchKey = e => {
    if (e.key === 'Enter') { setAppliedSearch(search); fetchPage(1, perPage, search); }
    else if (e.key === 'Escape') { setSearchOpen(false); if (appliedSearch) { setSearch(''); setAppliedSearch(''); fetchPage(1, perPage, ''); } }
  };
  const toggleSearch = () => {
    setSearchOpen(o => {
      const next = !o;
      if (next) setTimeout(() => searchInputRef.current?.focus(), 50);
      else if (appliedSearch) { setSearch(''); setAppliedSearch(''); fetchPage(1, perPage, ''); }
      return next;
    });
  };

  return (
    <>
      <style>{`
        @keyframes nc_spin { to { transform: rotate(360deg); } }
        .nc-lst *{ box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .nc-lst-row .nc-lst-dots { opacity: 1; background: none; border: none; cursor: pointer; padding: 4px; color: #1e293b; transition: color .15s; }
        .nc-lst-row .nc-lst-dots:hover { color: #1e3a8a; }
        .nc-lst-dots.menu-open { color: #1e3a8a; }
        .nc-lst-row:hover td { background: #f5f3ff; }
      `}</style>

      <div className="nc-lst" style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
              Lists <span style={{ fontWeight: 600, color: '#64748b' }}>({total.toLocaleString()})</span>
            </h2>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
              Import and manage static contact lists from a CSV file — a different kind of audience from Segments (which are rule-based).
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button title="Refresh" onClick={() => fetchPage()}
                style={{ width: 36, height: 36, border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, cursor: 'pointer', color: '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
              </button>
              {searchOpen ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #1e3a8a', borderRadius: 8, background: '#fff', padding: '0 8px 0 10px', height: 36 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input ref={searchInputRef} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={onSearchKey}
                    placeholder="Search lists and press Enter…"
                    style={{ border: 'none', outline: 'none', fontSize: 12.5, fontFamily: 'inherit', width: 240, background: 'transparent' }} />
                  <button onClick={toggleSearch} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, lineHeight: 1, padding: 2 }}>×</button>
                </div>
              ) : (
                <button title="Search" onClick={toggleSearch}
                  style={{ width: 36, height: 36, border: `1.5px solid ${appliedSearch ? '#1e3a8a' : '#e2e8f0'}`, background: appliedSearch ? '#eff6ff' : '#fff', borderRadius: 8, cursor: 'pointer', color: appliedSearch ? '#1e3a8a' : '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                </button>
              )}
              <Link to="/netcore/lists/logs"
                style={{ padding: '9px 16px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#1e3a8a', borderRadius: 6, fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Contact logs
              </Link>
              <button onClick={() => setCreateOpen(true)}
                style={{ padding: '10px 20px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: '.4px', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                + Create List
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.05)', overflow: 'hidden', position: 'relative' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.85)', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spinner />
            </div>
          )}
          <div style={{ height: '100%', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2 }}>
                <tr>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>List info</th>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Created on</th>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Last updated</th>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Contact count</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading
                  ? <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>{appliedSearch ? `No lists matching "${appliedSearch}".` : 'No lists yet. Click "Create List" to import your first contacts.'}</td></tr>
                  : rows.map(r => (
                      <tr key={r.id} className="nc-lst-row">
                        <td style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ width: 30, height: 30, borderRadius: 8, background: '#dcfce7', color: '#15803d', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <span style={{ color: '#0f172a', fontWeight: 600, fontSize: 13 }}>{r.name}</span>
                              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>ID - {r.id}</div>
                            </div>
                            <div style={{ position: 'relative', marginLeft: 'auto' }}>
                              <button className={`nc-lst-dots${menuFor === r.id ? ' menu-open' : ''}`}
                                onClick={e => { e.stopPropagation(); setMenuFor(menuFor === r.id ? null : r.id); }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                  <circle cx="12" cy="5"  r="2.2" />
                                  <circle cx="12" cy="12" r="2.2" />
                                  <circle cx="12" cy="19" r="2.2" />
                                </svg>
                              </button>
                              {menuFor === r.id && (
                                <div ref={menuRef}
                                  style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: '#fff', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', border: '1px solid #e2e8f0', zIndex: 50, width: 200, padding: 6 }}>
                                  {[
                                    { label: 'View contacts',   icon: '👁', action: () => { setMenuFor(null); nav(`/netcore/lists/${r.id}/contacts`); } },
                                    { label: 'Import contacts', icon: '⬆', action: () => { setMenuFor(null); nav(`/netcore/lists/${r.id}/import`); } },
                                    { label: 'Download',        icon: '⤓', action: () => doDownload(r.id, r.name) },
                                    { label: 'Delete',          icon: '🗑', action: () => doDelete(r.id), danger: true },
                                  ].map(opt => (
                                    <button key={opt.label} onClick={opt.action}
                                      style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: opt.danger ? '#dc2626' : '#334155', textAlign: 'left', borderRadius: 6 }}
                                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                      <span>{opt.label}</span>
                                      <span style={{ color: '#94a3b8', fontSize: 14 }}>{opt.icon}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{fmtDt(r.created_at)}</td>
                        <td style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{fmtDt(r.updated_at)}</td>
                        <td style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                          <Link to={`/netcore/lists/${r.id}/contacts`} style={{ color: '#1e3a8a', fontWeight: 600, textDecoration: 'none' }}>
                            {Number(r.contact_count || 0).toLocaleString()}
                          </Link>
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
            <select value={perPage}
              onChange={e => { const n = parseInt(e.target.value, 10); fetchPage(1, n, appliedSearch); }}
              style={{ padding: '6px 10px', border: '1.5px solid #c4b5fd', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none', background: '#fff', cursor: 'pointer' }}>
              {PER_PAGE_OPTS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Page {page} of {pages || 1}</span>
            <button disabled={page <= 1 || loading} onClick={() => fetchPage(page - 1, perPage, appliedSearch)}
              style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Prev</button>
            <button disabled={page >= pages || loading} onClick={() => fetchPage(page + 1, perPage, appliedSearch)}
              style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: page >= pages ? 'not-allowed' : 'pointer', opacity: page >= pages ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Next</button>
          </div>
        </div>
      </div>

      {createOpen && (
        <CreateListModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => { setCreateOpen(false); nav(`/netcore/lists/${id}/import`); }}
        />
      )}
    </>
  );
}
