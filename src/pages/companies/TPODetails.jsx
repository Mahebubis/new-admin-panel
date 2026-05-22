import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/companies/college_details.php';
const post = d => fetch(API, { method: 'POST', body: new URLSearchParams(d) }).then(r => r.json());

/* ─── helpers ─── */
const esc = s => s ?? '';
const initials = name => (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
const fmtNum = n => (n || 0).toLocaleString('en-IN');

const YEAR_OPTIONS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Postgraduate'];

/* ─── Stat Card ─── */
export function StatCard({ label, value, icon, variant = 'indigo' }) {
  const cfg = {
    indigo: { bg: '#ede9fe', color: '#4f46e5', border: '#c4b5fd', dot: '#4f46e5' },
    amber: { bg: '#fef3c7', color: '#b45309', border: '#fde68a', dot: '#f59e0b' },
    blue: { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' },
    green: { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0', dot: '#22c55e' },
  };
  const c = cfg[variant];
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: `1.5px solid ${c.border}`,
      padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16,
      boxShadow: '0 1px 6px rgba(79,70,229,.07)', position: 'relative', overflow: 'hidden',
      transition: 'transform .18s, box-shadow .18s'
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(79,70,229,.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 6px rgba(79,70,229,.07)'; }}>
      {/* left accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        background: c.dot, borderRadius: '4px 0 0 4px'
      }} />
      <div style={{
        width: 50, height: 50, borderRadius: 12, background: c.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>
          {value === null ? '—' : fmtNum(value)}
        </div>
        <div style={{
          fontSize: 11, color: '#64748b', fontWeight: 600, marginTop: 4,
          textTransform: 'uppercase', letterSpacing: '.04em'
        }}>{label}</div>
      </div>
    </div>
  );
}

/* ─── InCollege badge ─── */
const InCollegeBadge = ({ val }) => val == 1
  ? <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 11px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>✅ Yes</span>
  : <span style={{ background: '#fff7ed', color: '#c2410c', padding: '3px 11px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>✗ No</span>;

/* ─── pagination ─── */
export function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }
  const bS = (active, disabled) => ({
    minWidth: 32, height: 32, border: `1.5px solid ${active ? '#4f46e5' : '#e2e8f0'}`,
    borderRadius: 7, fontSize: 12, fontWeight: active ? 700 : 500,
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
    background: active ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#fff',
    color: active ? '#fff' : '#475569', opacity: disabled ? .4 : 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px',
  });
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      <button style={bS(false, page <= 1)} disabled={page <= 1} onClick={() => onChange(page - 1)}>‹</button>
      {pages.map((p, i) => p === '...'
        ? <button key={`e${i}`} style={bS(false, true)} disabled>…</button>
        : <button key={p} style={bS(p === page, false)} onClick={() => onChange(p)}>{p}</button>
      )}
      <button style={bS(false, page >= totalPages)} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>›</button>
    </div>
  );
}

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
export default function UserCollegeDetails() {
  const [stats, setStats] = useState(null);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  /* filters */
  const [search, setSearch] = useState('');
  const [inCollege, setInCollege] = useState('');
  const [year, setYear] = useState('');
  const [perPage, setPerPage] = useState(25);

  const debounceRef = useRef(null);

  /* ── stats ── */
  const loadStats = useCallback(async () => {
    try {
      const res = await post({ action: 'get_stats' });
      if (res.success) setStats(res);
    } catch (e) { }
  }, []);

  /* ── data ── */
  const loadData = useCallback(async (p = page, s = search, ic = inCollege, yr = year, pp = perPage) => {
    setLoading(true);
    try {
      const params = { action: 'fetch_data', page: p, limit: pp };
      if (s) params.search = s;
      if (ic !== '') params.is_in_college = ic;
      if (yr) params.current_year = yr;
      const res = await post(params);
      if (!res.success) { toast.error(res.message || 'Failed'); return; }
      setData(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [page, search, inCollege, year, perPage]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadData(page, search, inCollege, year, perPage); }, [page]);

  /* debounce search */
  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1); loadData(1, val, inCollege, year, perPage);
    }, 350);
  };

  const applyFilters = (ic = inCollege, yr = year, pp = perPage) => {
    setPage(1); loadData(1, search, ic, yr, pp);
  };
  const clearFilters = () => {
    setSearch(''); setInCollege(''); setYear(''); setPerPage(25);
    setPage(1); loadData(1, '', '', '', 25);
  };

  /* ── CSV export — pulls ALL filtered rows from the server, not just this page ── */
  const exportCSV = async () => {
    setExporting(true);
    const t = toast.loading('Preparing export…');
    try {
      const params = { action: 'export' };
      if (search) params.search = search;
      if (inCollege !== '') params.is_in_college = inCollege;
      if (year) params.current_year = year;
      const res = await post(params);
      if (!res.success) { toast.error(res.message || 'Export failed', { id: t }); return; }
      const rows = res.data || [];
      if (!rows.length) { toast.error('No records match the current filters', { id: t }); return; }

      const headers = ['ID', 'User ID', 'Name', 'Email', 'Phone', 'In College', 'College Name',
        'Current Year', 'TPO Name', 'TPO Email', 'TPO Phone', 'HOD Name', 'HOD Email', 'HOD Phone', 'Created At'];
      const body = rows.map(r => [
        r.id, r.user_id, r.name || r.username || '', r.email || '', r.phone || '',
        r.is_in_college == 1 ? 'Yes' : 'No',
        r.college_name || '', r.current_year || '',
        r.tpo_name || '', r.tpo_email || '', r.tpo_phone || '',
        r.hod_name || '', r.hod_email || '', r.hod_phone || '',
        r.created_at || ''
      ]);
      const csv = [headers, ...body]
        .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
      a.download = `tpo_hod_details_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`Exported ${rows.length.toLocaleString('en-IN')} record${rows.length > 1 ? 's' : ''}`, { id: t });
    } catch (e) {
      toast.error(e.message || 'Export failed', { id: t });
    } finally {
      setExporting(false);
    }
  };

  const thS = {
    padding: '12px 14px', fontSize: 10.5, fontWeight: 700, color: '#fff',
    textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.05em',
    background: 'linear-gradient(135deg,#0d2137,#1a3a2e)', whiteSpace: 'nowrap',
    borderRight: '1px solid rgba(255,255,255,.1)', position: 'sticky', top: 0, zIndex: 2
  };
  const tdS = {
    padding: '11px 14px', fontSize: 12.5, color: '#1e293b',
    borderBottom: '1px solid #f0faf8', verticalAlign: 'middle'
  };
  const inpS = {
    width: '100%', padding: '7px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
    fontSize: 12.5, fontFamily: 'inherit', outline: 'none', color: '#1e293b', background: '#f8fafc',
    transition: 'border .15s'
  };

  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        .ucd-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .ucd-inp:focus { border-color:#4f46e5!important; box-shadow:0 0 0 3px rgba(79,70,229,.1)!important; }
        .ucd-tr:hover td { background:#f0fdf4!important; }
        @keyframes ucd_spin { to { transform:rotate(360deg); } }
        .ucd-spin { display:inline-block;width:32px;height:32px;border:3px solid #c4b5fd;border-top-color:#4f46e5;border-radius:50%;animation:ucd_spin .7s linear infinite; }
        .mono { font-family:'JetBrains Mono',monospace; font-size:11px; }
      `}</style>

      <div className="ucd-root" style={{
        display: 'flex', flexDirection: 'column',
        minHeight: 'calc(100vh - 62px)', padding: 20, gap: 14, background: '#f0faf8', overflowY: 'auto'
      }}>

        {/* ── PAGE HEADER ── */}
        <div style={{
          background: 'linear-gradient(135deg,#0d2137 0%,#164a3e 100%)',
          borderRadius: 16, padding: '24px 28px', color: '#fff', position: 'relative', overflow: 'hidden', flexShrink: 0
        }}>
          <div style={{
            position: 'absolute', top: -40, right: -40, width: 200, height: 200,
            background: 'rgba(79,70,229,.12)', borderRadius: '50%'
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>🎓 User College Details</div>
              <div style={{ fontSize: 12.5, opacity: .65, marginTop: 4 }}>Manage and filter user college registration data</div>
            </div>
            <button onClick={exportCSV} disabled={exporting}
              style={{
                padding: '8px 16px', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 8,
                background: 'rgba(255,255,255,.1)', color: '#fff', fontSize: 12.5, fontWeight: 600,
                cursor: exporting ? 'wait' : 'pointer', fontFamily: 'inherit', display: 'flex',
                alignItems: 'center', gap: 6, backdropFilter: 'blur(6px)', opacity: exporting ? .6 : 1
              }}>
              {exporting ? '⏳ Exporting…' : '⬇️ Export All (CSV)'}
            </button>
          </div>
        </div>

        {/* ── STATS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, flexShrink: 0 }}>
          <StatCard label="Total Records" value={stats?.total} icon="👥" variant="indigo" />
          <StatCard label="In College" value={stats?.in_college} icon="🎓" variant="indigo" />
          <StatCard label="With College Name" value={stats?.with_college_name} icon="🏫" variant="amber" />
          <StatCard label="With TPO Info" value={stats?.with_tpo} icon="👔" variant="blue" />
        </div>

        {/* ── FILTER BAR ── */}
        <div style={{
          background: '#fff', border: '1.5px solid #d4efeb', borderRadius: 12,
          padding: '16px 18px', flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
          boxShadow: '0 1px 6px rgba(0,191,166,.06)'
        }}>

          {/* search */}
          <div style={{ flex: '1 1 220px' }}>
            <label style={{
              fontSize: 10.5, fontWeight: 700, color: '#6b8f8a', textTransform: 'uppercase',
              letterSpacing: '.05em', display: 'block', marginBottom: 5
            }}>Search</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: '#94a3b8', fontSize: 13
              }}>🔍</span>
              <input className="ucd-inp" style={{ ...inpS, paddingLeft: 32, minWidth: 220 }}
                value={search} onChange={e => handleSearchChange(e.target.value)}
                placeholder="Name, email, college, TPO..." />
            </div>
          </div>

          {/* in college */}
          <div style={{ minWidth: 120 }}>
            <label style={{
              fontSize: 10.5, fontWeight: 700, color: '#6b8f8a', textTransform: 'uppercase',
              letterSpacing: '.05em', display: 'block', marginBottom: 5
            }}>In College</label>
            <select className="ucd-inp" style={{ ...inpS, cursor: 'pointer', appearance: 'auto' }}
              value={inCollege}
              onChange={e => { setInCollege(e.target.value); applyFilters(e.target.value, year, perPage); }}>
              <option value="">All</option>
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </div>

          {/* current year */}
          <div style={{ minWidth: 140 }}>
            <label style={{
              fontSize: 10.5, fontWeight: 700, color: '#6b8f8a', textTransform: 'uppercase',
              letterSpacing: '.05em', display: 'block', marginBottom: 5
            }}>Current Year</label>
            <select className="ucd-inp" style={{ ...inpS, cursor: 'pointer', appearance: 'auto' }}
              value={year}
              onChange={e => { setYear(e.target.value); applyFilters(inCollege, e.target.value, perPage); }}>
              <option value="">All Years</option>
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* per page */}
          <div style={{ minWidth: 80 }}>
            <label style={{
              fontSize: 10.5, fontWeight: 700, color: '#6b8f8a', textTransform: 'uppercase',
              letterSpacing: '.05em', display: 'block', marginBottom: 5
            }}>Rows</label>
            <select className="ucd-inp" style={{ ...inpS, cursor: 'pointer', appearance: 'auto' }}
              value={perPage}
              onChange={e => { const v = +e.target.value; setPerPage(v); applyFilters(inCollege, year, v); }}>
              {[10, 25, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* clear */}
          <button onClick={clearFilters}
            style={{
              padding: '7px 16px', border: '1.5px solid #d4efeb', borderRadius: 8,
              background: '#fff', color: '#6b8f8a', fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5
            }}>
            ✕ Clear
          </button>
        </div>

        {/* ── TABLE ── */}
        <div style={{
          background: '#fff', border: '1.5px solid #d4efeb', borderRadius: 14,
          overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,191,166,.06)', flexShrink: 0
        }}>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 430px)', minHeight: 240 }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 1200 }}>
              <thead>
                <tr>
                  {['#', 'ID', 'User', 'In College', 'College Details', 'TPO Info', 'HOD Info', 'Created At'].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48 }}>
                    <div className="ucd-spin" style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 13, color: '#6b8f8a' }}>Loading data...</div>
                  </td></tr>
                ) : !data.length ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 60, color: '#6b8f8a' }}>
                    <div style={{ fontSize: 44, marginBottom: 10, opacity: .3 }}>🎓</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>No records found</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Try adjusting your filters</div>
                  </td></tr>
                ) : data.map((row, idx) => {
                  const sn = (page - 1) * perPage + idx + 1;
                  const name = esc(row.name || row.username || 'Unknown');
                  const abbr = initials(name);
                  return (
                    <tr key={row.id} className="ucd-tr">
                      {/* # */}
                      <td style={{ ...tdS, color: '#94a3b8', fontSize: 12 }}>{sn}</td>

                      {/* ID */}
                      <td style={tdS}>
                        <span className="mono" style={{
                          background: '#f0faf8', color: '#009e88',
                          padding: '2px 8px', borderRadius: 20, fontWeight: 500
                        }}>
                          {row.id}
                        </span>
                      </td>

                      {/* User */}
                      <td style={tdS}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%',
                            background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0
                          }}>
                            {abbr}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.2 }}>{name}</div>
                            <div style={{ fontSize: 11, color: '#6b8f8a', marginTop: 1 }}>{esc(row.email) || '—'}</div>
                          </div>
                        </div>
                      </td>

                      {/* In College */}
                      <td style={tdS}><InCollegeBadge val={row.is_in_college} /></td>

                      {/* College Details */}
                      <td style={{ ...tdS, maxWidth: 180 }}>
                        <div style={{
                          fontWeight: 600, fontSize: 12.5, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 165
                        }}
                          title={row.college_name || undefined}>
                          {row.college_name || <span style={{ color: '#94a3b8' }}>—</span>}
                        </div>
                        {row.current_year && (
                          <div style={{ fontSize: 11, color: '#6b8f8a', marginTop: 2 }}>{row.current_year}</div>
                        )}
                      </td>

                      {/* TPO Info */}
                      <td style={{ ...tdS, fontSize: 12, lineHeight: 1.6 }}>
                        {row.tpo_name && <div style={{ fontWeight: 600 }}>{esc(row.tpo_name)}</div>}
                        {row.tpo_email && <div style={{ color: '#6b8f8a', fontSize: 11 }}>✉ {esc(row.tpo_email)}</div>}
                        {row.tpo_phone && <div style={{ color: '#6b8f8a', fontSize: 11 }}>📞 {esc(row.tpo_phone)}</div>}
                        {!row.tpo_name && !row.tpo_email && !row.tpo_phone &&
                          <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>}
                      </td>

                      {/* HOD Info */}
                      <td style={{ ...tdS, fontSize: 12, lineHeight: 1.6 }}>
                        {row.hod_name && <div style={{ fontWeight: 600 }}>{esc(row.hod_name)}</div>}
                        {row.hod_email && <div style={{ color: '#6b8f8a', fontSize: 11 }}>✉ {esc(row.hod_email)}</div>}
                        {!row.hod_name && !row.hod_email &&
                          <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>}
                      </td>

                      {/* Created At */}
                      <td style={{ ...tdS, fontSize: 11.5, color: '#6b8f8a', fontFamily: 'JetBrains Mono,monospace' }}>
                        {esc(row.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── PAGINATION BAR ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 18px', borderTop: '1px solid #d4efeb', background: '#f0faf8',
            flexWrap: 'wrap', gap: 10
          }}>
            <div style={{ fontSize: 12, color: '#6b8f8a' }}>
              {total === 0 ? 'No records' : <>
                Showing <strong style={{ color: '#1a2e2b' }}>{from}–{to}</strong> of <strong style={{ color: '#4f46e5' }}>{fmtNum(total)}</strong> records
              </>}
            </div>
            <Pagination page={page} totalPages={totalPages}
              onChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          </div>
        </div>

      </div>
    </>
  );
}