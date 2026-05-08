import { useState, useRef } from 'react';
import toast from 'react-hot-toast';

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/reports/clarity_report.php';

const apiFetch = (params) =>
  fetch(`${API}?${new URLSearchParams(params)}`).then(r => r.json());

const fmtDate = (ts) => {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' }); }
  catch { return ts; }
};

export default function ClarityReport() {
  const [query,      setQuery]      = useState('');
  const [searchType, setSearchType] = useState('user_id');
  const [results,    setResults]    = useState(null); // null = not searched yet
  const [loading,    setLoading]    = useState(false);
  const inputRef = useRef(null);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) { toast.error('Please enter a search query'); inputRef.current?.focus(); return; }
    setLoading(true);
    try {
      const res = await apiFetch({ action:'search', query:query.trim(), search_type:searchType });
      if (!res.success) { toast.error(res.message || 'Search failed'); return; }
      setResults(res.results || []);
      if (res.count === 0) toast('No results found', { icon:'🔍' });
    } catch(e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const openProfile = (email) => {
  if (!email) {
    toast.error('No email found for this user');
    return;
  }

  window.open(
    `/search_result?q=${encodeURIComponent(email)}`,
    '_blank'
  );
};

  /* ── shared styles ── */
  const inpS = {
    padding:'9px 14px', border:'1.5px solid #e2e8f0', borderRadius:8,
    fontSize:13, fontFamily:'inherit', outline:'none', color:'#1e293b',
    background:'#fff', transition:'border .15s',
  };
  const thS = {
    padding:'11px 16px', fontSize:11, fontWeight:700, color:'#fff',
    textAlign:'left', textTransform:'uppercase', letterSpacing:'.5px',
    background:'linear-gradient(135deg,#4f46e5,#7c3aed)', whiteSpace:'nowrap',
    borderRight:'1px solid rgba(255,255,255,.12)',
  };
  const tdS = {
    padding:'12px 16px', fontSize:13, color:'#1e293b',
    borderBottom:'1px solid #f5f3ff', verticalAlign:'middle',
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .cr-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .cr-inp:focus { border-color:#4f46e5!important; box-shadow:0 0 0 3px rgba(79,70,229,.12)!important; }
        .cr-sel:focus { border-color:#4f46e5!important; box-shadow:0 0 0 3px rgba(79,70,229,.12)!important; }
        .cr-tr:hover td { background:#faf9ff!important; }
        .cr-link:hover { color:#4f46e5!important; text-decoration:underline; }
        @keyframes cr_spin { to { transform:rotate(360deg); } }
        .cr-spin { display:inline-block;width:16px;height:16px;border:2px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:cr_spin .7s linear infinite; }
      `}</style>

      <div className="cr-root" style={{
        display:'flex', flexDirection:'column', height:'calc(100vh - 62px)',
        padding:20, gap:14, overflow:'hidden', background:'#f5f3ff',
      }}>

        {/* ── HEADER ── */}
        <div style={{ flexShrink:0 }}>
          <div style={{ fontSize:17, fontWeight:800, color:'#1e293b' }}>🔍 Clarity Report</div>
          <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
            Search user sessions from <code style={{ background:'#ede9fe', padding:'1px 6px', borderRadius:4, color:'#4f46e5', fontSize:11 }}>user_clarity</code> table
          </div>
        </div>

        {/* ── SEARCH CARD ── */}
        <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #ede9fe',
          padding:'20px 22px', flexShrink:0, boxShadow:'0 1px 8px rgba(79,70,229,.06)' }}>
          <form onSubmit={handleSearch} style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>

            {/* search input */}
            <div style={{ flex:'1 1 260px' }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase',
                letterSpacing:'.5px', display:'block', marginBottom:6 }}>
                Search Query
              </label>
              <input
                ref={inputRef}
                className="cr-inp"
                style={{ ...inpS, width:'100%' }}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={searchType === 'user_id' ? 'Enter User ID...' : 'Enter Clarity ID...'}
                autoComplete="off"
              />
            </div>

            {/* search type */}
            <div style={{ minWidth:160 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase',
                letterSpacing:'.5px', display:'block', marginBottom:6 }}>
                Search By
              </label>
              <select
                className="cr-sel"
                style={{ ...inpS, width:'100%', cursor:'pointer', appearance:'auto' }}
                value={searchType}
                onChange={e => setSearchType(e.target.value)}
              >
                <option value="user_id">User ID</option>
                <option value="clarity_user_id">Clarity ID</option>
              </select>
            </div>

            {/* submit */}
            <button type="submit" disabled={loading}
              style={{ padding:'9px 24px', border:'none', borderRadius:8, fontSize:13, fontWeight:700,
                cursor:loading?'not-allowed':'pointer', color:'#fff', fontFamily:'inherit',
                background:'linear-gradient(135deg,#4f46e5,#7c3aed)', display:'flex',
                alignItems:'center', gap:8, opacity:loading?.7:1, whiteSpace:'nowrap',
                boxShadow:'0 2px 8px rgba(79,70,229,.3)' }}>
              {loading ? <><span className="cr-spin"/> Searching...</> : <>🔍 Search</>}
            </button>

            {/* clear */}
            {results !== null && (
              <button type="button"
                onClick={() => { setQuery(''); setResults(null); inputRef.current?.focus(); }}
                style={{ padding:'9px 16px', border:'1.5px solid #e2e8f0', borderRadius:8,
                  background:'#fff', color:'#64748b', fontSize:13, fontWeight:600,
                  cursor:'pointer', fontFamily:'inherit' }}>
                ✕ Clear
              </button>
            )}
          </form>
        </div>

        {/* ── RESULTS ── */}
        <div style={{ flex:1, minHeight:0, background:'#fff', borderRadius:14,
          border:'1.5px solid #ede9fe', display:'flex', flexDirection:'column',
          overflow:'hidden', boxShadow:'0 1px 8px rgba(79,70,229,.06)' }}>

          {/* results header */}
          {results !== null && (
            <div style={{ padding:'10px 18px', borderBottom:'1.5px solid #f5f3ff', flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#1e293b' }}>
                {results.length === 0
                  ? '❌ No results found'
                  : <>✅ Found <strong style={{ color:'#4f46e5' }}>{results.length}</strong> record{results.length !== 1 ? 's' : ''}</>}
              </div>
              <div style={{ fontSize:11.5, color:'#94a3b8' }}>
                Searched by: <strong style={{ color:'#64748b' }}>{searchType === 'user_id' ? 'User ID' : 'Clarity ID'}</strong> = <code style={{ background:'#f5f3ff', padding:'1px 6px', borderRadius:4, color:'#4f46e5' }}>{query}</code>
              </div>
            </div>
          )}

          <div style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
            {results === null ? (
              /* initial empty state */
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
                justifyContent:'center', height:'100%', gap:10, color:'#94a3b8' }}>
                <div style={{ fontSize:42 }}>🔎</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#64748b' }}>Search Clarity Records</div>
                <div style={{ fontSize:12.5, textAlign:'center', maxWidth:300 }}>
                  Enter a User ID or Clarity ID above to look up session records from the <code style={{ background:'#f5f3ff', color:'#4f46e5', padding:'1px 5px', borderRadius:4 }}>user_clarity</code> table
                </div>
              </div>
            ) : results.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
                justifyContent:'center', height:'100%', gap:10, color:'#94a3b8' }}>
                <div style={{ fontSize:42 }}>🚫</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#64748b' }}>No Records Found</div>
                <div style={{ fontSize:12.5 }}>No clarity data found for the given {searchType === 'user_id' ? 'User ID' : 'Clarity ID'}</div>
              </div>
            ) : (
              <table style={{ borderCollapse:'collapse', width:'100%', minWidth:600 }}>
                <thead>
                  <tr>
                    <th style={thS}>User ID</th>
                    <th style={thS}>Clarity ID</th>
                    <th style={{ ...thS, borderRight:'none' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr key={i} className="cr-tr">
                      <td style={tdS}>
                        <button
                          className="cr-link"
                          onClick={() => openProfile(row.email)}
                          title={row.email ? `Open profile for ${row.email}` : 'No email found'}
                          style={{ background:'none', border:'none', cursor:'pointer', padding:0,
                            fontSize:13, fontWeight:600, color:'#4f46e5', fontFamily:'inherit',
                            display:'inline-flex', alignItems:'center', gap:5 }}>
                          {row.user_id}
                          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ opacity:.6 }}>
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </button>
                        {row.email && (
                          <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{row.email}</div>
                        )}
                      </td>
                      <td style={tdS}>
                        <code style={{ background:'#f5f3ff', color:'#4f46e5', padding:'3px 8px',
                          borderRadius:5, fontSize:12, fontFamily:'monospace' }}>
                          {row.clarity_user_id}
                        </code>
                      </td>
                      <td style={{ ...tdS, color:'#64748b' }}>
                        <span style={{ fontSize:12.5 }}>{fmtDate(row.timestamp)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* table footer */}
          {results?.length > 0 && (
            <div style={{ padding:'8px 18px', borderTop:'1.5px solid #f5f3ff', flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:11.5, color:'#94a3b8' }}>
                {results.length} row{results.length !== 1 ? 's' : ''} · sorted by timestamp descending
              </div>
              <div style={{ fontSize:11.5, color:'#64748b' }}>
                💡 Click a User ID to open the full profile
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}