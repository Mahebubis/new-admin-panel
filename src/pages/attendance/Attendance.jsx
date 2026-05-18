import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

/* API: https://cit3.internshipstudio.com/admin/react-api/api/attendance/attendance.php */
const API = '/api/attendance/attendance.php';

const thS = {
  color: '#fff', fontSize: 11, fontWeight: 600, padding: '11px 12px',
  textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px', whiteSpace: 'nowrap',
};
const tdS = { padding: '9px 12px', borderBottom: '1px solid #f5f3ff', color: '#334155', fontSize: 12, verticalAlign: 'middle' };
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const pctColor = (p) => (p >= 100 ? '#16a34a' : p >= 75 ? '#0369a1' : p >= 50 ? '#d97706' : '#dc2626');

/* ── group the flat days[] array into per-calendar-month grids ── */
function buildMonths(days) {
  const map = {};
  days.forEach(d => {
    const key = d.date.slice(0, 7);            // YYYY-MM
    (map[key] ||= {})[d.date] = d.status;
  });
  return Object.keys(map).sort().map(key => {
    const [y, m] = key.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, status: map[key][ds] || null });
    }
    return {
      key, label: first.toLocaleString('en-US', { month: 'long', year: 'numeric' }), cells,
    };
  });
}

/* ════════ CALENDAR MODAL ════════ */
function CalendarModal({ data, onClose }) {
  const months = useMemo(() => buildMonths(data.days || []), [data]);

  // start on the month that contains today, else the last month
  const todayKey = new Date().toISOString().slice(0, 7);
  const initial = Math.max(0, months.findIndex(m => m.key === todayKey));
  const [slide, setSlide] = useState(initial >= 0 ? initial : months.length - 1);

  const cur = months[slide];
  const cellBg = { present: '#22c55e', absent: '#ef4444', future: '#f1f5f9' };
  const cellFg = { present: '#fff', absent: '#fff', future: '#94a3b8' };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, width: 460, maxWidth: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,.3)', overflow: 'hidden',
      }}>
        {/* header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>📊 Attendance Tracker</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{data.name} · {data.email}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8,
            width: 30, height: 30, cursor: 'pointer', fontSize: 16, color: '#64748b' }}>×</button>
        </div>

        <div style={{ padding: 22 }}>
          {/* internship + % */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#eef2ff', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{data.internship_name || '—'}</div>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>Started on: {fmtDate(data.batch_start)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: pctColor(data.attendance_pct) }}>
                {data.attendance_pct}%
              </div>
              <div style={{ fontSize: 10.5, color: '#64748b' }}>Attendance</div>
            </div>
          </div>

          {/* stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
            {[
              ['Present', data.present, '#22c55e'],
              ['Absent',  data.absent,  '#ef4444'],
              ['Days',    data.duration_days, '#7c3aed'],
              ['Months',  data.duration_months, '#0369a1'],
            ].map(([k, v, c]) => (
              <div key={k} style={{ background: c, borderRadius: 10, padding: '12px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{v}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.9)', fontWeight: 600 }}>{k}</div>
              </div>
            ))}
          </div>

          {/* calendar */}
          {months.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: 24, fontSize: 13 }}>
              No batch / duration data for this user.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                  {data.duration_days}-Day Attendance Calendar
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0' }}>
                <button onClick={() => setSlide(s => Math.max(0, s - 1))} disabled={slide === 0}
                  style={navBtn(slide === 0)}>‹</button>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{cur.label}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Month {slide + 1} of {months.length}</div>
                </div>
                <button onClick={() => setSlide(s => Math.min(months.length - 1, s + 1))}
                  disabled={slide === months.length - 1} style={navBtn(slide === months.length - 1)}>›</button>
              </div>

              {/* dots */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 10 }}>
                {months.map((m, i) => (
                  <span key={m.key} onClick={() => setSlide(i)} style={{
                    width: i === slide ? 18 : 7, height: 7, borderRadius: 99, cursor: 'pointer',
                    background: i === slide ? '#4f46e5' : '#cbd5e1', transition: 'all .2s',
                  }} />
                ))}
              </div>

              {/* grid */}
              <div style={{ border: '1px solid #f1f5f9', borderRadius: 12, padding: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
                  {WEEK.map(w => (
                    <div key={w} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{w}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
                  {cur.cells.map((c, i) => c === null ? <div key={i} /> : (
                    <div key={i} style={{
                      aspectRatio: '1', borderRadius: 8, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      background: c.status ? cellBg[c.status] : 'transparent',
                      color: c.status ? cellFg[c.status] : '#cbd5e1',
                      fontSize: 12, fontWeight: 700,
                      border: c.status ? 'none' : '1px dashed #e2e8f0',
                    }}>
                      <span>{c.day}</span>
                      {c.status === 'present' && <span style={{ fontSize: 9 }}>✓</span>}
                      {c.status === 'absent'  && <span style={{ fontSize: 9 }}>✕</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* legend */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, margin: '12px 0' }}>
                {[['Present', '#22c55e'], ['Absent', '#ef4444'], ['Future', '#f1f5f9']].map(([l, c]) => (
                  <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b' }}>
                    <span style={{ width: 12, height: 12, borderRadius: 4, background: c,
                      border: l === 'Future' ? '1px solid #e2e8f0' : 'none' }} /> {l}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* duration + project submission */}
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10,
            padding: '12px 14px', fontSize: 12, color: '#065f46', lineHeight: 1.7 }}>
            <div>• Refund window: <strong>{data.duration_months} month{data.duration_months > 1 ? 's' : ''}</strong> of
              100% attendance from batch start.</div>
            <div>• Project submission starts from: <strong>{fmtDate(data.project_submission_date)}</strong>.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
const navBtn = (disabled) => ({
  width: 34, height: 34, borderRadius: '50%', border: 'none', fontSize: 18,
  background: disabled ? '#f1f5f9' : '#eef2ff', color: disabled ? '#cbd5e1' : '#4f46e5',
  cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700,
});

/* ════════ PAGE ════════ */
export default function Attendance() {
  const [rows,        setRows]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [searched,    setSearched]    = useState(false);
  const [calData,     setCalData]     = useState(null);
  const [calLoading,  setCalLoading]  = useState(false);

  const loadList = useCallback(() => {
    setLoading(true);
    api.get(`${API}?action=list`)
      .then(r => setRows(r.data?.data?.records || []))
      .catch(() => toast.error('Failed to load attendance'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  /* ── search by email / phone ── */
  const doSearch = () => {
    const q = searchInput.trim();
    if (!q) { setSearched(false); loadList(); return; }
    setLoading(true);
    api.get(`${API}?action=search&q=${encodeURIComponent(q)}`)
      .then(r => {
        const recs = r.data?.data?.records || [];
        setRows(recs);
        setSearched(true);
        if (recs.length === 0) toast.error('No user found');
      })
      .catch(() => toast.error('Search failed'))
      .finally(() => setLoading(false));
  };
  const clearSearch = () => { setSearchInput(''); setSearched(false); loadList(); };

  /* ── open the calendar for a user ── */
  const openCalendar = (user_id) => {
    setCalLoading(true);
    api.get(`${API}?action=calendar&user_id=${user_id}`)
      .then(r => {
        const c = r.data?.data?.calendar;
        if (c) setCalData(c);
        else toast.error('No calendar data');
      })
      .catch(() => toast.error('Failed to load calendar'))
      .finally(() => setCalLoading(false));
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .at-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .at-tr:hover td{background:#faf9ff!important;}
        @keyframes at_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="at-root" style={{
        display: 'flex', flexDirection: 'column', height: 'calc(100vh - 62px)',
        padding: 20, gap: 14, overflow: 'hidden', background: '#f5f3ff',
      }}>
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>📅 Attendance</div>
          <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>
            {searched ? 'Search results' : 'Recent 15 records'}: <strong style={{ color: '#4f46e5' }}>{rows.length}</strong>
          </span>
        </div>

        {/* SEARCH */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: 8,
            overflow: 'hidden', background: '#fff', flex: '0 0 320px' }}>
            <input value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search by email or phone..."
              style={{ border: 'none', padding: '8px 12px', fontSize: 12.5, flex: 1, outline: 'none', color: '#1e293b' }} />
            <button onClick={doSearch}
              style={{ background: '#4f46e5', color: '#fff', border: 'none', padding: '0 14px', cursor: 'pointer', fontSize: 12 }}>🔍</button>
            {searched && (
              <button onClick={clearSearch}
                style={{ background: '#f1f5f9', color: '#64748b', border: 'none', padding: '0 11px', cursor: 'pointer', fontSize: 14 }}>×</button>
            )}
          </div>

          {/* quick attendance icon for the first search match */}
          {searched && rows.length > 0 && (
            <button onClick={() => openCalendar(rows[0].user_id)} disabled={calLoading}
              title={`View calendar — ${rows[0].name}`}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                border: '1.5px solid #c4b5fd', borderRadius: 8, background: '#ede9fe',
                color: '#6d28d9', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              📅 See Attendance Calendar
            </button>
          )}
        </div>

        {/* TABLE */}
        <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 12,
          border: '1.5px solid #ede9fe', boxShadow: '0 1px 8px rgba(79,70,229,.05)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {['User ID', 'Name', 'Email', 'Phone', 'Batch Start', 'Paid Date',
                    'Internship', 'Attendance %', 'Action'].map(h => <th key={h} style={thS}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 48 }}>
                    <div style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid #ede9fe',
                      borderTop: '3px solid #4f46e5', borderRadius: '50%', animation: 'at_spin .7s linear infinite' }} />
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 }}>
                    No attendance records found
                  </td></tr>
                ) : rows.map((r, i) => (
                  <tr key={`${r.user_id}_${i}`} className="at-tr">
                    <td style={{ ...tdS, color: '#4f46e5', fontWeight: 600 }}>{r.user_id}</td>
                    <td style={{ ...tdS, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{r.name || '—'}</td>
                    <td style={{ ...tdS, color: '#4f46e5', fontSize: 11.5 }}>{r.email || '—'}</td>
                    <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{r.phone || '—'}</td>
                    <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{fmtDate(r.batch_start)}</td>
                    <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{fmtDate(r.paid_at)}</td>
                    <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{r.internship_name || '—'}</td>
                    <td style={tdS}>
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                        background: '#f1f5f9', color: pctColor(r.attendance_pct) }}>
                        {r.attendance_pct}%
                      </span>
                    </td>
                    <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                      <button onClick={() => openCalendar(r.user_id)} disabled={calLoading}
                        style={{ padding: '5px 11px', background: '#ede9fe', color: '#6d28d9',
                          border: '1.5px solid #ddd6fe', borderRadius: 6, fontSize: 11,
                          fontWeight: 600, cursor: 'pointer' }}>
                        📅 See Attendance Calendar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {calData && <CalendarModal data={calData} onClose={() => setCalData(null)} />}
    </>
  );
}
