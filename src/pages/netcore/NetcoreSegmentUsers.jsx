import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';

const API = '/api/netcore/segments.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const PER_PAGE_OPTS = [10, 25, 50, 100];

const ALL_COLS = [
  { key: 'email',         label: 'EMAIL (Primary key)' },
  { key: 'mobile',        label: 'MOBILE' },
  { key: 'first_name',    label: 'FIRST_NAME' },
  { key: 'last_name',     label: 'LAST_NAME' },
  { key: 'state',         label: 'STATE' },
  { key: 'country',       label: 'COUNTRY' },
  { key: 'register_date', label: 'REGISTER_DATE' },
];

function Spinner({ size = 32 }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', border: '3px solid #c4b5fd', borderTopColor: '#4f46e5', animation: 'nc_spin 0.85s linear infinite' }} />;
}

function IconBtn({ title, active, onClick, children }) {
  return (
    <button title={title} onClick={onClick}
      style={{ width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${active ? '#1e3a8a' : '#e2e8f0'}`, background: active ? '#eff6ff' : '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: active ? '#1e3a8a' : '#475569', transition: 'all .15s' }}>
      {children}
    </button>
  );
}

export default function NetcoreSegmentUsers() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const channel = search.get('channel') || '';

  const [name, setName]       = useState('');
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [pages, setPages]     = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [searchVal, setSearchVal]     = useState('');
  const [appliedSearch, setApplied]   = useState('');
  const [colsVisible, setColsVisible] = useState(() => Object.fromEntries(ALL_COLS.map(c => [c.key, true])));
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef  = useRef(null);
  const searchInputRef = useRef(null);

  const fetchPage = async (p = 1, pp = perPage, s = appliedSearch) => {
    setLoading(true);
    try {
      const body = new URLSearchParams({ action: 'users', id, page: p, per_page: pp, channel, search: s });
      const res = await api.post(API, body, FORM);
      if (res.data.status === 'success') {
        setName(res.data.name || '');
        setRows(res.data.users || []);
        setTotal(res.data.total || 0);
        setPage(res.data.page);
        setPages(res.data.pages);
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchPage(1, perPage, ''); }, [id, channel]); // eslint-disable-line

  /* close col menu on outside click */
  useEffect(() => {
    if (!colMenuOpen) return;
    const h = e => { if (colMenuRef.current && !colMenuRef.current.contains(e.target)) setColMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [colMenuOpen]);

  const onSearchKey = e => {
    if (e.key === 'Enter') { setApplied(searchVal); fetchPage(1, perPage, searchVal); }
    if (e.key === 'Escape') { setSearchOpen(false); if (appliedSearch) { setSearchVal(''); setApplied(''); fetchPage(1, perPage, ''); } }
  };
  const toggleSearch = () => {
    setSearchOpen(o => {
      const next = !o;
      if (next) setTimeout(() => searchInputRef.current?.focus(), 50);
      else if (appliedSearch) { setSearchVal(''); setApplied(''); fetchPage(1, perPage, ''); }
      return next;
    });
  };

  const channelLabel = { '': 'Identified', email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp' }[channel] || 'Identified';

  return (
    <>
      <style>{`
        @keyframes nc_spin { to { transform: rotate(360deg); } }
        .nc-su *{ box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .nc-su-row:hover td { background: #f5f3ff; }
        .nc-su-truncate { max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      `}</style>

      <div className="nc-su" style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* breadcrumb / title */}
        <div style={{ flexShrink: 0, marginBottom: 14 }}>
          <Link to="/netcore/segments"
            style={{ color: '#1e3a8a', textDecoration: 'none', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
            Segments
          </Link>
          <h2 style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
            {name} <span style={{ color: '#64748b', fontWeight: 600 }}>(User Count: {total.toLocaleString()})</span>
          </h2>
        </div>

        {/* tab + toolbar */}
        <div style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,.05)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ padding: '6px 4px', borderBottom: '2px solid #1e3a8a', color: '#1e3a8a', fontSize: 13, fontWeight: 600, marginBottom: -1 }}>
              {channelLabel} <span style={{ color: '#94a3b8', fontWeight: 500, marginLeft: 4 }}>({total.toLocaleString()})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <IconBtn title="Refresh" onClick={() => fetchPage(page, perPage, appliedSearch)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
              </IconBtn>
              {searchOpen ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #1e3a8a', borderRadius: 8, background: '#fff', padding: '0 8px 0 10px', height: 34 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input ref={searchInputRef} value={searchVal} onChange={e => setSearchVal(e.target.value)} onKeyDown={onSearchKey} placeholder="Search and press Enter…"
                    style={{ border: 'none', outline: 'none', fontSize: 12.5, fontFamily: 'inherit', width: 220, background: 'transparent' }} />
                  <button onClick={toggleSearch} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, lineHeight: 1, padding: 2 }}>×</button>
                </div>
              ) : (
                <IconBtn title="Search" active={!!appliedSearch} onClick={toggleSearch}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                </IconBtn>
              )}
              <IconBtn title="Download CSV" onClick={async () => {
                try {
                  const res = await api.get(API, { params: { action: 'users_csv', id, channel }, responseType: 'blob' });
                  const cd = res.headers?.['content-disposition'] || '';
                  const m  = /filename="?([^";]+)"?/.exec(cd);
                  const fname = m ? m[1] : `segment_${id}.csv`;
                  const url = URL.createObjectURL(res.data);
                  const a = document.createElement('a');
                  a.href = url; a.download = fname;
                  document.body.appendChild(a); a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } catch { /* no-op */ }
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              </IconBtn>
              {/* column show/hide */}
              <div ref={colMenuRef} style={{ position: 'relative' }}>
                <IconBtn title="Show / hide columns" active={colMenuOpen} onClick={() => setColMenuOpen(o => !o)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                </IconBtn>
                {colMenuOpen && (
                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: '#fff', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', border: '1px solid #e2e8f0', zIndex: 20, padding: 8, width: 220 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '.4px', textTransform: 'uppercase', padding: '4px 8px 8px' }}>Show columns</div>
                    {ALL_COLS.map(c => (
                      <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', fontSize: 13, color: '#334155', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!colsVisible[c.key]}
                          onChange={e => setColsVisible(v => ({ ...v, [c.key]: e.target.checked }))} />
                        {c.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* table */}
        <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.05)', overflow: 'hidden', position: 'relative' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.85)', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spinner />
            </div>
          )}
          <div style={{ height: '100%', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2 }}>
                <tr>
                  {ALL_COLS.filter(c => colsVisible[c.key]).map(c => (
                    <th key={c.key}
                      style={{ padding: '12px 14px', textAlign: 'left', color: '#475569', fontWeight: 600, fontSize: 11, letterSpacing: '.4px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading
                  ? <tr><td colSpan={ALL_COLS.filter(c => colsVisible[c.key]).length} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No users</td></tr>
                  : rows.map((r, i) => (
                    <tr key={`${r.user_id}-${i}`} className="nc-su-row">
                      {ALL_COLS.filter(c => colsVisible[c.key]).map((c, ci) => (
                        <td key={c.key} style={{ padding: '11px 14px', borderBottom: '1px solid #f1f5f9', color: ci === 0 ? '#2563eb' : '#334155' }}>
                          {ci === 0
                            ? <Link to={`/netcore/contacts/${encodeURIComponent(r.email)}?uid=${r.user_id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{r[c.key] || 'NA'}</Link>
                            : <div className="nc-su-truncate" title={r[c.key] || ''}>{r[c.key] || 'NA'}</div>}
                        </td>
                      ))}
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 13, color: '#475569', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Per page:</span>
            <select value={perPage} onChange={e => { const n = parseInt(e.target.value, 10); setPerPage(n); fetchPage(1, n, appliedSearch); }}
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
    </>
  );
}
