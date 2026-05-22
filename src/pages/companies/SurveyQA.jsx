import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { StatCard, Pagination } from './TPODetails';

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/companies/enrollment_survey.php';
const post = d => fetch(API, { method: 'POST', body: new URLSearchParams(d) }).then(r => r.json());

/* ─── helpers ─── */
const esc = s => s ?? '';
const initials = name => (name || '?').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const fmtNum = n => (n || 0).toLocaleString('en-IN');

/* friendly question labels for the q1–q5 columns */
const Q_LABELS = {
  q1: 'Current Status',
  q2: 'Reason to Enroll',
  q3: 'Heard About Us',
  q4: 'Expected Outcome',
  q5: 'Expectations',
};

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
export default function EnrollmentSurvey() {
  const [stats, setStats] = useState(null);
  const [opts, setOpts] = useState({ q1: [], q2: [], q3: [], q4: [] });
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  /* filters */
  const [search, setSearch] = useState('');
  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState('');
  const [q3, setQ3] = useState('');
  const [q4, setQ4] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [perPage, setPerPage] = useState(25);

  const debounceRef = useRef(null);

  /* ── stats + filter options ── */
  const loadStats = useCallback(async () => {
    try {
      const res = await post({ action: 'get_stats' });
      if (res.success) setStats(res);
    } catch { /* silent */ }
  }, []);

  const loadOptions = useCallback(async () => {
    try {
      const res = await post({ action: 'get_filters' });
      if (res.success) setOpts({ q1: res.q1 || [], q2: res.q2 || [], q3: res.q3 || [], q4: res.q4 || [] });
    } catch { /* silent */ }
  }, []);

  /* ── build the active filter set ── */
  const buildFilters = (over = {}) => {
    const f = {
      search, q1, q2, q3, q4, date_from: dateFrom, date_to: dateTo, ...over,
    };
    const out = {};
    Object.entries(f).forEach(([k, v]) => { if (v !== '' && v != null) out[k] = v; });
    return out;
  };

  /* ── data ── */
  const loadData = useCallback(async (p, filters, pp) => {
    setLoading(true);
    try {
      const res = await post({ action: 'fetch_data', page: p, limit: pp, ...filters });
      if (!res.success) { toast.error(res.message || 'Failed to load'); return; }
      setData(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStats(); loadOptions(); }, [loadStats, loadOptions]);
  useEffect(() => { loadData(1, {}, 25); }, [loadData]);

  /* debounced search */
  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      loadData(1, buildFilters({ search: val }), perPage);
    }, 350);
  };

  /* a dropdown / date filter changed → reset to page 1 */
  const apply = (over) => {
    setPage(1);
    loadData(1, buildFilters(over), perPage);
  };
  const goToPage = (p) => {
    setPage(p);
    loadData(p, buildFilters(), perPage);
  };

  const clearFilters = () => {
    setSearch(''); setQ1(''); setQ2(''); setQ3(''); setQ4('');
    setDateFrom(''); setDateTo(''); setPerPage(25); setPage(1);
    loadData(1, {}, 25);
  };

  /* ── CSV export — pulls ALL filtered rows from the server, not just this page ── */
  const exportCSV = async () => {
    setExporting(true);
    const t = toast.loading('Preparing export…');
    try {
      const res = await post({ action: 'export', ...buildFilters() });
      if (!res.success) { toast.error(res.message || 'Export failed', { id: t }); return; }
      const rows = res.data || [];
      if (!rows.length) { toast.error('No records match the current filters', { id: t }); return; }

      const headers = ['ID', 'User ID', 'Name', 'Email', 'Phone',
        'Q1 ' + Q_LABELS.q1, 'Q2 ' + Q_LABELS.q2, 'Q3 ' + Q_LABELS.q3, 'Q3 Other',
        'Q4 ' + Q_LABELS.q4, 'Q5 ' + Q_LABELS.q5, 'Submitted At', 'Updated At'];
      const body = rows.map(r => [
        r.id, r.user_id, r.name || r.username || '', r.email || '', r.phone || '',
        r.q1_current_status || '', r.q2_enroll_reason || '',
        r.q3_hear_about || '', r.q3_hear_about_other || '',
        r.q4_worth_outcome || '', r.q5_expectations || '',
        r.created_at || '', r.updated_at || ''
      ]);
      const csv = [headers, ...body]
        .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
      a.download = `enrollment_survey_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`Exported ${rows.length.toLocaleString('en-IN')} record${rows.length > 1 ? 's' : ''}`, { id: t });
    } catch (e) {
      toast.error(e.message || 'Export failed', { id: t });
    } finally {
      setExporting(false);
    }
  };

  /* ── styles ── */
  const thS = {
    padding: '12px 14px', fontSize: 10.5, fontWeight: 700, color: '#fff',
    textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.05em',
    background: 'linear-gradient(135deg,#0d2137,#1a3a2e)', whiteSpace: 'nowrap',
    borderRight: '1px solid rgba(255,255,255,.1)', position: 'sticky', top: 0, zIndex: 3
  };
  const tdS = {
    padding: '11px 14px', fontSize: 12.5, color: '#1e293b',
    borderBottom: '1px solid #f0faf8', verticalAlign: 'top'
  };
  const inpS = {
    width: '100%', padding: '7px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
    fontSize: 12.5, fontFamily: 'inherit', outline: 'none', color: '#1e293b', background: '#f8fafc',
    transition: 'border .15s'
  };
  const labelS = {
    fontSize: 10.5, fontWeight: 700, color: '#6b8f8a', textTransform: 'uppercase',
    letterSpacing: '.05em', display: 'block', marginBottom: 5
  };

  /* a long-answer table cell — clamps to 2 lines, full text on hover */
  const LongCell = ({ text, color = '#1e293b', width = 240 }) => text
    ? <div title={text} style={{
        maxWidth: width, color, fontSize: 12,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', lineHeight: 1.45
      }}>{text}</div>
    : <span style={{ color: '#cbd5e1' }}>—</span>;

  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const filtersActive = search || q1 || q2 || q3 || q4 || dateFrom || dateTo;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        .esv-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .esv-inp:focus { border-color:#4f46e5!important; box-shadow:0 0 0 3px rgba(79,70,229,.1)!important; }
        .esv-tr:hover td { background:#f0fdf4!important; }
        @keyframes esv_spin { to { transform:rotate(360deg); } }
        .esv-spin { display:inline-block;width:32px;height:32px;border:3px solid #c4b5fd;border-top-color:#4f46e5;border-radius:50%;animation:esv_spin .7s linear infinite; }
        .esv-mono { font-family:'JetBrains Mono',monospace; font-size:11px; }
      `}</style>

      <div className="esv-root" style={{
        display: 'flex', flexDirection: 'column', padding: 20, gap: 14, background: '#f0faf8'
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>📋 Enrollment Survey — Q &amp; A</div>
              <div style={{ fontSize: 12.5, opacity: .65, marginTop: 4 }}>
                Responses collected from students during enrollment
              </div>
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
          <StatCard label="Total Responses" value={stats?.total} icon="📋" variant="indigo" />
          <StatCard label="Today" value={stats?.today} icon="📅" variant="green" />
          <StatCard label="Last 7 Days" value={stats?.this_week} icon="🗓️" variant="amber" />
          <StatCard label="This Month" value={stats?.this_month} icon="📈" variant="blue" />
        </div>

        {/* ── FILTER BAR ── */}
        <div style={{
          background: '#fff', border: '1.5px solid #d4efeb', borderRadius: 12,
          padding: '16px 18px', flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
          boxShadow: '0 1px 6px rgba(0,191,166,.06)'
        }}>
          {/* search */}
          <div style={{ flex: '1 1 220px' }}>
            <label style={labelS}>Search</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 13 }}>🔍</span>
              <input className="esv-inp" style={{ ...inpS, paddingLeft: 32 }}
                value={search} onChange={e => handleSearchChange(e.target.value)}
                placeholder="Name, email, phone, user ID..." />
            </div>
          </div>

          {/* Q1 */}
          <div style={{ minWidth: 160, maxWidth: 220, flex: '1 1 160px' }}>
            <label style={labelS}>{Q_LABELS.q1}</label>
            <select className="esv-inp" style={{ ...inpS, cursor: 'pointer', appearance: 'auto' }}
              value={q1} onChange={e => { setQ1(e.target.value); apply({ q1: e.target.value }); }}>
              <option value="">All</option>
              {opts.q1.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* Q3 */}
          <div style={{ minWidth: 160, maxWidth: 220, flex: '1 1 160px' }}>
            <label style={labelS}>{Q_LABELS.q3}</label>
            <select className="esv-inp" style={{ ...inpS, cursor: 'pointer', appearance: 'auto' }}
              value={q3} onChange={e => { setQ3(e.target.value); apply({ q3: e.target.value }); }}>
              <option value="">All</option>
              {opts.q3.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* Q2 */}
          <div style={{ minWidth: 160, maxWidth: 220, flex: '1 1 160px' }}>
            <label style={labelS}>{Q_LABELS.q2}</label>
            <select className="esv-inp" style={{ ...inpS, cursor: 'pointer', appearance: 'auto' }}
              value={q2} onChange={e => { setQ2(e.target.value); apply({ q2: e.target.value }); }}>
              <option value="">All</option>
              {opts.q2.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* Q4 */}
          <div style={{ minWidth: 160, maxWidth: 220, flex: '1 1 160px' }}>
            <label style={labelS}>{Q_LABELS.q4}</label>
            <select className="esv-inp" style={{ ...inpS, cursor: 'pointer', appearance: 'auto' }}
              value={q4} onChange={e => { setQ4(e.target.value); apply({ q4: e.target.value }); }}>
              <option value="">All</option>
              {opts.q4.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* date from */}
          <div style={{ minWidth: 140 }}>
            <label style={labelS}>From Date</label>
            <input type="date" className="esv-inp" style={{ ...inpS, cursor: 'pointer' }}
              value={dateFrom} max={dateTo || undefined}
              onChange={e => { setDateFrom(e.target.value); apply({ date_from: e.target.value }); }} />
          </div>

          {/* date to */}
          <div style={{ minWidth: 140 }}>
            <label style={labelS}>To Date</label>
            <input type="date" className="esv-inp" style={{ ...inpS, cursor: 'pointer' }}
              value={dateTo} min={dateFrom || undefined}
              onChange={e => { setDateTo(e.target.value); apply({ date_to: e.target.value }); }} />
          </div>

          {/* per page */}
          <div style={{ minWidth: 80 }}>
            <label style={labelS}>Rows</label>
            <select className="esv-inp" style={{ ...inpS, cursor: 'pointer', appearance: 'auto' }}
              value={perPage}
              onChange={e => { const v = +e.target.value; setPerPage(v); setPage(1); loadData(1, buildFilters(), v); }}>
              {[10, 25, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* clear */}
          <button onClick={clearFilters} disabled={!filtersActive}
            style={{
              padding: '7px 16px', border: '1.5px solid #d4efeb', borderRadius: 8,
              background: '#fff', color: '#6b8f8a', fontSize: 12.5, fontWeight: 600,
              cursor: filtersActive ? 'pointer' : 'not-allowed', opacity: filtersActive ? 1 : .5,
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5
            }}>
            ✕ Clear
          </button>
        </div>

        {/* ── TABLE ── */}
        <div style={{
          background: '#fff', border: '1.5px solid #d4efeb', borderRadius: 14,
          overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,191,166,.06)', flexShrink: 0
        }}>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 470px)', minHeight: 240 }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 1500 }}>
              <thead>
                <tr>
                  {['#', 'ID', 'User', `Q1 · ${Q_LABELS.q1}`, `Q2 · ${Q_LABELS.q2}`,
                    `Q3 · ${Q_LABELS.q3}`, `Q4 · ${Q_LABELS.q4}`, `Q5 · ${Q_LABELS.q5}`, 'Submitted'].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 48 }}>
                    <div className="esv-spin" style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 13, color: '#6b8f8a' }}>Loading responses...</div>
                  </td></tr>
                ) : !data.length ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 60, color: '#6b8f8a' }}>
                    <div style={{ fontSize: 44, marginBottom: 10, opacity: .3 }}>📋</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>No survey responses found</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Try adjusting your filters</div>
                  </td></tr>
                ) : data.map((row, idx) => {
                  const sn = (page - 1) * perPage + idx + 1;
                  const name = esc(row.name || row.username || 'Unknown');
                  return (
                    <tr key={row.id} className="esv-tr">
                      {/* # */}
                      <td style={{ ...tdS, color: '#94a3b8', fontSize: 12 }}>{sn}</td>

                      {/* ID */}
                      <td style={tdS}>
                        <span className="esv-mono" style={{
                          background: '#f0faf8', color: '#009e88',
                          padding: '2px 8px', borderRadius: 20, fontWeight: 500
                        }}>{row.id}</span>
                      </td>

                      {/* User */}
                      <td style={{ ...tdS, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%',
                            background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0
                          }}>{initials(name)}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.2 }}>{name}</div>
                            <div style={{ fontSize: 11, color: '#6b8f8a', marginTop: 1 }}>{esc(row.email) || '—'}</div>
                            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 1 }} className="esv-mono">
                              UID: {esc(row.user_id)}{row.phone ? ` · ${row.phone}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Q1 */}
                      <td style={tdS}><LongCell text={row.q1_current_status} width={170} /></td>

                      {/* Q2 */}
                      <td style={tdS}><LongCell text={row.q2_enroll_reason} width={260} /></td>

                      {/* Q3 */}
                      <td style={tdS}>
                        {row.q3_hear_about
                          ? <span style={{
                              background: '#ede9fe', color: '#5b21b6', padding: '3px 9px',
                              borderRadius: 6, fontSize: 11.5, fontWeight: 600, display: 'inline-block'
                            }}>{row.q3_hear_about}</span>
                          : <span style={{ color: '#cbd5e1' }}>—</span>}
                        {row.q3_hear_about_other && (
                          <div title={row.q3_hear_about_other} style={{
                            fontSize: 11, color: '#6b8f8a', marginTop: 4, fontStyle: 'italic',
                            maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }}>↳ {row.q3_hear_about_other}</div>
                        )}
                      </td>

                      {/* Q4 */}
                      <td style={tdS}><LongCell text={row.q4_worth_outcome} width={240} /></td>

                      {/* Q5 */}
                      <td style={tdS}><LongCell text={row.q5_expectations} color="#475569" width={280} /></td>

                      {/* Submitted */}
                      <td style={{ ...tdS, fontSize: 11.5, color: '#6b8f8a', whiteSpace: 'nowrap' }}
                        className="esv-mono">
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
                Showing <strong style={{ color: '#1a2e2b' }}>{from}–{to}</strong> of <strong style={{ color: '#4f46e5' }}>{fmtNum(total)}</strong> responses
              </>}
            </div>
            <Pagination page={page} totalPages={totalPages} onChange={goToPage} />
          </div>
        </div>

      </div>
    </>
  );
}
