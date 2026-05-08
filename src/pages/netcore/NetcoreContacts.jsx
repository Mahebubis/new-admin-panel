import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';

const API = '/api/netcore/contacts.php';
const PER_PAGE = 50; /* recent-only, no pagination */

const COLS = [
  { key: 'email',              label: 'EMAIL (Primary key)' },
  { key: 'mobile',             label: 'MOBILE' },
  { key: 'first_name',         label: 'FIRST_NAME' },
  { key: 'last_name',          label: 'LAST_NAME' },
  { key: 'state',              label: 'STATE' },
  { key: 'country',            label: 'COUNTRY' },
  { key: 'profile_completion', label: 'PROFILE_COMPLETION' },
  { key: 'wa_join',            label: 'WA_JOIN' },
  { key: 'register_date',      label: 'REGISTER_DATE' },
  { key: 'link',               label: 'LINK' },
  { key: 'exam_start_date',    label: 'EXAM_START_DATE' },
  { key: 'pc_link',            label: 'PC_LINK' },
];

function Spinner({ size = 32 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      border: `3px solid #c4b5fd`, borderTopColor: '#4f46e5',
      animation: 'nc_spin 0.85s linear infinite'
    }} />
  );
}

/* small reusable icon button */
function IconBtn({ title, active, onClick, children }) {
  return (
    <button title={title} onClick={onClick}
      style={{
        width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${active ? '#4f46e5' : '#e2e8f0'}`,
        background: active ? '#eef2ff' : '#fff', cursor: 'pointer', display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', color: active ? '#4f46e5' : '#475569',
        transition: 'all .15s'
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f8fafc'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = '#fff'; }}>
      {children}
    </button>
  );
}

export default function NetcoreContacts() {
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [searchOpen, setSearchOpen]       = useState(false);
  const searchInputRef = useRef(null);

  const fetchRows = async (s = '') => {
    setLoading(true);
    try {
      const res = await api.get(API, { params: { action: 'list', page: 1, per_page: PER_PAGE, search: s } });
      if (res.data.status === 'success') {
        setRows(res.data.contacts || []);
        setTotal(res.data.total || 0);
      }
    } catch (e) { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchRows(''); /* initial recent */ }, []); // eslint-disable-line

  const onSearchKey = e => {
    if (e.key === 'Enter') {
      setAppliedSearch(search);
      fetchRows(search.trim());
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
      if (appliedSearch) { setSearch(''); setAppliedSearch(''); fetchRows(''); }
    }
  };

  const toggleSearch = () => {
    setSearchOpen(o => {
      const next = !o;
      if (next) setTimeout(() => searchInputRef.current?.focus(), 50);
      else if (appliedSearch) { setSearch(''); setAppliedSearch(''); fetchRows(''); }
      return next;
    });
  };

  return (
    <>
      <style>{`
        @keyframes nc_spin { to { transform: rotate(360deg); } }
        .nc-c-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .nc-c-row:hover td { background: #f5f3ff; }
        .nc-c-email { color: #2563eb; cursor: pointer; }
        .nc-c-email:hover { text-decoration: underline; }
        .nc-c-truncate { max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      `}</style>

      <div className="nc-c-root" style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* header card */}
        <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                All contacts <span style={{ color: '#64748b', fontWeight: 600 }}>({total.toLocaleString()})</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </h2>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Find and view individual customer profiles</div>
            </div>
          </div>

          {/* tab + toolbar row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ padding: '10px 4px', borderBottom: '2px solid #4f46e5', color: '#4f46e5', fontSize: 13, fontWeight: 600, marginBottom: -1 }}>
                Identified <span style={{ color: '#94a3b8', fontWeight: 500, marginLeft: 4 }}>({total.toLocaleString()})</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {/* refresh */}
              <IconBtn title="Refresh" onClick={() => fetchRows(appliedSearch)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </IconBtn>

              {/* search input (collapses to icon) */}
              {searchOpen ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #4f46e5', borderRadius: 8, background: '#fff', padding: '0 8px 0 10px', height: 34 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input ref={searchInputRef} type="text"
                    value={search} onChange={e => setSearch(e.target.value)} onKeyDown={onSearchKey}
                    placeholder="Search and press Enter…"
                    style={{ border: 'none', outline: 'none', fontSize: 12.5, fontFamily: 'inherit', width: 220, background: 'transparent' }} />
                  <button onClick={toggleSearch}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, lineHeight: 1, padding: 2 }}>×</button>
                </div>
              ) : (
                <IconBtn title="Search" active={!!appliedSearch} onClick={toggleSearch}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </IconBtn>
              )}

              {/* download */}
              <IconBtn title="Download">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </IconBtn>

              {/* settings */}
              <IconBtn title="Settings">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </IconBtn>

              {/* filter */}
              <IconBtn title="Filter">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
              </IconBtn>
            </div>
          </div>
        </div>

        {/* table card — fills remaining height, scrolls inside */}
        <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.05)', flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
              <Spinner />
            </div>
          )}
          <div style={{ height: '100%', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2 }}>
                <tr>
                  {COLS.map(c => (
                    <th key={c.key}
                      style={{ padding: '12px 14px', textAlign: 'left', color: '#475569', fontWeight: 600, fontSize: 11, letterSpacing: '.4px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading
                  ? <tr><td colSpan={COLS.length} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No contacts found</td></tr>
                  : rows.map((r, i) => (
                    <tr key={`${r.user_id}-${i}`} className="nc-c-row">
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #f1f5f9' }}>
                        <Link to={`/netcore/contacts/${encodeURIComponent(r.email)}?uid=${r.user_id}`} className="nc-c-email">
                          {r.email}
                        </Link>
                      </td>
                      {COLS.slice(1).map(c => (
                        <td key={c.key} style={{ padding: '11px 14px', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                          <div className="nc-c-truncate" title={r[c.key] || ''}>{r[c.key]}</div>
                        </td>
                      ))}
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
