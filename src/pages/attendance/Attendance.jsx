import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

/* API: https://cit3.internshipstudio.com/admin/react-api/api/attendance/attendance.php */
const API = '/api/attendance/attendance.php';
const CLICKS_API = '/api/attendance/attendance_clicks.php';

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
      cells.push({ day: d, date: ds, status: map[key][ds] || null });
    }
    return {
      key, label: first.toLocaleString('en-US', { month: 'long', year: 'numeric' }), cells,
    };
  });
}

/* ════════ DAY CONFIRM MODAL ════════
   Opens when a calendar day is clicked. Asks the API what already exists for
   that user+date in user_login_activity and attendance_log, then warns before
   applying (insert the missing rows, skip the ones already there) or removing
   (delete both rows). Nothing is written until "Yes" is pressed. */
function ConfirmDayModal({ payment_id, date, onClose, onDone }) {
  const [day,     setDay]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    let alive = true;
    api.get(API, { params: { action: 'day', payment_id, date } })
      .then(r => { if (alive) setDay(r.data?.data?.day || null); })
      .catch(e => {
        if (!alive) return;
        toast.error(e.response?.data?.message || 'Could not read this day');
        onClose();
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [payment_id, date, onClose]);

  const mode = day?.is_present ? 'remove' : 'apply';

  const confirm = () => {
    setSaving(true);
    api.post(`${API}?action=toggle`, { payment_id, date, mode })
      .then(r => {
        toast.success(r.data?.message || 'Done');
        onDone();
        onClose();
      })
      .catch(e => toast.error(e.response?.data?.message || 'Could not update attendance'))
      .finally(() => setSaving(false));
  };

  const rowS = { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '5px 0' };
  const tag = (ok) => (
    <span style={{ fontWeight: 700, color: ok ? '#15803d' : '#94a3b8' }}>
      {ok ? 'Record found' : 'No record'}
    </span>
  );

  return (
    /* stopPropagation everywhere — this modal renders inside the calendar
       overlay, whose own onClick would otherwise close the calendar too */
    <div onClick={e => { e.stopPropagation(); if (!saving) onClose(); }} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, width: 420, maxWidth: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,.35)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px',
          background: loading ? '#f8fafc' : mode === 'remove' ? '#fef2f2' : '#f0fdf4',
          borderBottom: '1px solid #f1f5f9',
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>
            {loading ? '⏳ Checking this date…'
              : mode === 'remove' ? '⚠️ Remove attendance?' : '⚠️ Apply attendance?'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{fmtDate(date)}</div>
        </div>

        <div style={{ padding: 20 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 18 }}>
              <div style={{ display: 'inline-block', width: 24, height: 24, border: '3px solid #ede9fe',
                borderTop: '3px solid #4f46e5', borderRadius: '50%', animation: 'at_spin .7s linear infinite' }} />
            </div>
          ) : !day ? (
            <div style={{ fontSize: 12.5, color: '#94a3b8' }}>No data for this date.</div>
          ) : (
            <>
              <div style={{ fontSize: 12.5, color: '#334155', marginBottom: 12 }}>
                <strong>{day.name}</strong> · {day.email}
              </div>

              <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, padding: '8px 12px', marginBottom: 12 }}>
                <div style={rowS}><span style={{ color: '#64748b' }}>user_login_activity</span>{tag(day.has_login)}</div>
                <div style={rowS}><span style={{ color: '#64748b' }}>attendance_log</span>{tag(day.has_attendance)}</div>
                <div style={{ ...rowS, borderTop: '1px dashed #e2e8f0', marginTop: 4, paddingTop: 8 }}>
                  <span style={{ color: '#64748b' }}>Current status</span>
                  <span style={{ fontWeight: 800, color: day.is_present ? '#16a34a' : '#dc2626' }}>
                    {day.is_present ? 'Present' : 'Absent'}
                  </span>
                </div>
              </div>

              <div style={{
                background: mode === 'remove' ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${mode === 'remove' ? '#fecaca' : '#bbf7d0'}`,
                borderRadius: 10, padding: '11px 13px', fontSize: 12,
                color: mode === 'remove' ? '#991b1b' : '#166534', lineHeight: 1.7,
              }}>
                {mode === 'remove' ? (
                  <>
                    <div style={{ fontWeight: 700, marginBottom: 3 }}>This will DELETE the records below:</div>
                    {day.has_attendance && <div>• attendance_log row for {date}</div>}
                    {day.has_login && <div>• user_login_activity row for {date}</div>}
                    <div style={{ marginTop: 4 }}>The day will turn <strong>Absent</strong>. This cannot be undone.</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 700, marginBottom: 3 }}>This will INSERT:</div>
                    <div>• user_login_activity — {day.has_login ? 'skipped (already exists)' : `login_date = ${date}`}</div>
                    <div>• attendance_log — {day.has_attendance
                      ? 'skipped (already exists)'
                      : `attendance_date = ${date}, marked_at = ${date}, default note`}</div>
                    <div style={{ marginTop: 4 }}>The day will turn <strong>Present</strong>.</div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end',
          padding: '12px 20px', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
          <button onClick={onClose} disabled={saving} style={{
            padding: '8px 16px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#fff',
            color: '#475569', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}>Cancel</button>
          <button onClick={confirm} disabled={loading || saving || !day} style={{
            padding: '8px 18px', border: 'none', borderRadius: 8,
            background: loading || saving || !day ? '#cbd5e1' : mode === 'remove' ? '#dc2626' : '#16a34a',
            color: '#fff', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
            cursor: loading || saving || !day ? 'not-allowed' : 'pointer',
          }}>
            {saving ? 'Working…' : mode === 'remove' ? 'Yes, remove it' : 'Yes, apply it'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════ CALENDAR MODAL ════════ */
function CalendarModal({ data, onClose, onChanged }) {
  const months = useMemo(() => buildMonths(data.days || []), [data]);
  const [pendingDate, setPendingDate] = useState(null);
  const closeConfirm = useCallback(() => setPendingDate(null), []);

  /* only past/today days inside the batch window can be edited */
  const onCellClick = (c) => {
    if (!c.status) return;
    if (c.status === 'future') { toast.error('Attendance cannot be set for a future date'); return; }
    setPendingDate(c.date);
  };

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
                  {cur.cells.map((c, i) => {
                    if (c === null) return <div key={i} />;
                    const editable = c.status === 'present' || c.status === 'absent';
                    return (
                      <div key={i} className={editable ? 'at-day' : undefined}
                        onClick={editable ? () => onCellClick(c) : undefined}
                        title={editable
                          ? `${fmtDate(c.date)} — click to ${c.status === 'present' ? 'remove' : 'apply'} attendance`
                          : undefined}
                        style={{
                          aspectRatio: '1', borderRadius: 8, display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          background: c.status ? cellBg[c.status] : 'transparent',
                          color: c.status ? cellFg[c.status] : '#cbd5e1',
                          fontSize: 12, fontWeight: 700,
                          border: c.status ? 'none' : '1px dashed #e2e8f0',
                          cursor: editable ? 'pointer' : 'default',
                          transition: 'transform .12s, box-shadow .12s',
                        }}>
                        <span>{c.day}</span>
                        {c.status === 'present' && <span style={{ fontSize: 9 }}>✓</span>}
                        {c.status === 'absent'  && <span style={{ fontSize: 9 }}>✕</span>}
                      </div>
                    );
                  })}
                </div>
                <div style={{ textAlign: 'center', fontSize: 10.5, color: '#94a3b8', marginTop: 8 }}>
                  Click any past day to apply or remove its attendance
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

      {pendingDate && (
        <ConfirmDayModal
          payment_id={data.payment_id}
          date={pendingDate}
          onClose={closeConfirm}
          onDone={onChanged}
        />
      )}
    </div>
  );
}
const navBtn = (disabled) => ({
  width: 34, height: 34, borderRadius: '50%', border: 'none', fontSize: 18,
  background: disabled ? '#f1f5f9' : '#eef2ff', color: disabled ? '#cbd5e1' : '#4f46e5',
  cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700,
});

/* ════════ CLICK-LOG VIEW ════════ */
const fmtDateTime = (d, t) => `${fmtDate(d)}${t ? ' · ' + t : ''}`;

function ResultBadge({ value }) {
  const ok = String(value).toUpperCase() === 'SUCCESS';
  return (
    <span style={{
      padding: '3px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
      background: ok ? '#dcfce7' : '#fee2e2', color: ok ? '#15803d' : '#dc2626',
    }}>{value || '—'}</span>
  );
}

function ClickLog() {
  /* draft filters (the inputs) */
  const [q, setQ] = useState('');
  const [dateMode, setDateMode] = useState('all');   // all | single | range
  const [date, setDate] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [outcome, setOutcome] = useState('all');     // all | success | failed

  /* committed filters (what was actually searched) */
  const [committed, setCommitted] = useState({ q: '', dateMode: 'all', date: '', from: '', to: '', outcome: 'all' });
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;

  const [data, setData] = useState({ records: [], total: 0, shown_total: 0, total_pages: 1, truncated: false, source: '' });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  /* map a committed-filter object to the query params the API expects */
  const buildParams = useCallback((c) => {
    const p = { outcome: c.outcome, phase: 'result' };
    if (c.q.trim()) p.q = c.q.trim();
    if (c.dateMode === 'single' && c.date) p.date = c.date;
    if (c.dateMode === 'range') { if (c.from) p.date_from = c.from; if (c.to) p.date_to = c.to; }
    return p;
  }, []);

  const fetchPage = useCallback((c, p) => {
    setLoading(true);
    api.get(CLICKS_API, { params: { action: 'search', ...buildParams(c), page: p, per_page: PER_PAGE } })
      .then(r => {
        const d = r.data?.data;
        if (!d) { toast.error(r.data?.message || 'Failed to load log'); return; }
        setData(d);
      })
      .catch(() => toast.error('Failed to load click log'))
      .finally(() => setLoading(false));
  }, [buildParams]);

  useEffect(() => { fetchPage(committed, page); }, [committed, page, fetchPage]);

  const runSearch = () => {
    if (dateMode === 'range' && from && to && from > to) { toast.error('“From” date is after “To” date'); return; }
    setPage(1);
    setCommitted({ q, dateMode, date, from, to, outcome });
  };
  const resetSearch = () => {
    setQ(''); setDateMode('all'); setDate(''); setFrom(''); setTo(''); setOutcome('all');
    setPage(1);
    setCommitted({ q: '', dateMode: 'all', date: '', from: '', to: '', outcome: 'all' });
  };

  const exportCSV = async () => {
    setExporting(true);
    const t = toast.loading('Preparing CSV…');
    try {
      const res = await api.get(CLICKS_API, { params: { action: 'export', ...buildParams(committed) }, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_clicks_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded', { id: t });
    } catch { toast.error('Export failed', { id: t }); }
    finally { setExporting(false); }
  };

  const inp = { border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, outline: 'none', color: '#1e293b', background: '#fff', fontFamily: 'inherit' };
  const totalPages = data.total_pages || 1;

  return (
    <>
      {/* FILTER BAR */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
        <div>
          <label style={lblS}>Email / User ID / Name</label>
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && runSearch()}
            placeholder="e.g. a@b.com or 3268725" style={{ ...inp, width: 250 }} />
        </div>

        <div>
          <label style={lblS}>Date</label>
          <select value={dateMode} onChange={e => setDateMode(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
            <option value="all">All dates</option>
            <option value="single">Single date</option>
            <option value="range">Date range</option>
          </select>
        </div>
        {dateMode === 'single' && (
          <div><label style={lblS}>On</label><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} /></div>
        )}
        {dateMode === 'range' && (
          <>
            <div><label style={lblS}>From</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inp} /></div>
            <div><label style={lblS}>To</label><input type="date" value={to} onChange={e => setTo(e.target.value)} style={inp} /></div>
          </>
        )}

        <div>
          <label style={lblS}>Outcome</label>
          <select value={outcome} onChange={e => setOutcome(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <button onClick={runSearch} style={{ ...inp, background: '#4f46e5', color: '#fff', fontWeight: 700, cursor: 'pointer', border: 'none' }}>🔍 Search</button>
        <button onClick={resetSearch} style={{ ...inp, background: '#f1f5f9', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>Reset</button>
        <button onClick={exportCSV} disabled={exporting}
          style={{ ...inp, background: '#ecfdf5', color: '#15803d', border: '1.5px solid #a7f3d0', fontWeight: 700, cursor: exporting ? 'wait' : 'pointer' }}>
          {exporting ? '⏳ Exporting…' : '⬇️ Export CSV'}
        </button>
      </div>

      {/* count line */}
      <div style={{ fontSize: 12, color: '#64748b', flexShrink: 0 }}>
        <strong style={{ color: '#4f46e5' }}>{data.total?.toLocaleString('en-IN')}</strong> matching record{data.total === 1 ? '' : 's'}
        {data.truncated && (
          <span style={{ color: '#b45309', marginLeft: 8 }}>
            · showing newest {data.cap?.toLocaleString('en-IN')} — narrow the filter to page through older ones
          </span>
        )}
      </div>

      {/* TABLE */}
      <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 12, border: '1.5px solid #ede9fe',
        boxShadow: '0 1px 8px rgba(79,70,229,.05)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                {['Date / Time', 'User ID', 'Name', 'Email', 'Internship ID', 'Outcome', 'Note', 'Chars', 'IP', 'Device'].map(h => <th key={h} style={thS}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 48 }}>
                  <div style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid #ede9fe', borderTop: '3px solid #4f46e5', borderRadius: '50%', animation: 'at_spin .7s linear infinite' }} />
                </td></tr>
              ) : data.records.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 }}>No matching log records</td></tr>
              ) : data.records.map((r, i) => (
                <tr key={`${r.click_id}_${i}`} className="at-tr">
                  <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{fmtDateTime(r.date, r.time)}</td>
                  <td style={{ ...tdS, color: '#4f46e5', fontWeight: 600 }}>{r.uid || '—'}</td>
                  <td style={{ ...tdS, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{r.name || '—'}</td>
                  <td style={{ ...tdS, color: '#4f46e5', fontSize: 11.5 }}>{r.email || '—'}</td>
                  <td style={tdS}>{r.iid || '—'}</td>
                  <td style={tdS}><ResultBadge value={r.result} /></td>
                  <td style={{ ...tdS, maxWidth: 280 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.note}>{r.note || '—'}</div>
                    {r.api_msg && String(r.result).toUpperCase() !== 'SUCCESS' && (
                      <div style={{ fontSize: 10.5, color: '#dc2626' }} title={r.api_msg}>{r.api_msg}</div>
                    )}
                  </td>
                  <td style={tdS}>{r.note_len || '0'}</td>
                  <td style={{ ...tdS, whiteSpace: 'nowrap', fontSize: 11.5 }}>{r.ip || '—'}</td>
                  <td style={{ ...tdS, maxWidth: 220 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }} title={r.ua}>{r.ua || '—'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={pgBtn(page <= 1)}>‹ Prev</button>
            <span style={{ fontSize: 12, color: '#64748b' }}>Page <strong>{page}</strong> of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={pgBtn(page >= totalPages)}>Next ›</button>
          </div>
        )}
      </div>

      {data.source && (
        <div style={{ fontSize: 10.5, color: '#cbd5e1', flexShrink: 0 }}>log: {data.source}</div>
      )}
    </>
  );
}
const lblS = { display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 4 };
const pgBtn = (disabled) => ({
  padding: '6px 12px', borderRadius: 7, border: '1.5px solid #e2e8f0', fontSize: 12, fontWeight: 600,
  background: disabled ? '#f8fafc' : '#fff', color: disabled ? '#cbd5e1' : '#4f46e5', cursor: disabled ? 'not-allowed' : 'pointer',
});

/* ════════ PAGE ════════ */
export default function Attendance() {
  const [tab, setTab] = useState('tracker');   // tracker | clicks
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

  /* ── open the calendar for one internship payment ── */
  const openCalendar = (payment_id) => {
    setCalLoading(true);
    api.get(`${API}?action=calendar&payment_id=${payment_id}`)
      .then(r => {
        const c = r.data?.data?.calendar;
        if (c) setCalData(c);
        else toast.error('No calendar data');
      })
      .catch(() => toast.error('Failed to load calendar'))
      .finally(() => setCalLoading(false));
  };

  /* ── after a day was applied / removed: repull the calendar + the % column ── */
  const refreshCalendar = () => {
    const pid = calData?.payment_id;
    if (!pid) return;
    api.get(`${API}?action=calendar&payment_id=${pid}`)
      .then(r => {
        const c = r.data?.data?.calendar;
        if (c) setCalData(c);
      })
      .catch(() => toast.error('Could not refresh the calendar'));
    if (searched) doSearch(); else loadList();
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .at-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .at-tr:hover td{background:#faf9ff!important;}
        .at-day:hover{transform:scale(1.09);box-shadow:0 3px 10px rgba(15,23,42,.28);}
        @keyframes at_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="at-root" style={{
        display: 'flex', flexDirection: 'column', height: 'calc(100vh - 62px)',
        padding: 20, gap: 14, overflow: 'hidden', background: '#f5f3ff',
      }}>
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>📅 Attendance</div>
          {tab === 'tracker' && (
            <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>
              {searched ? 'Search results' : 'Recent 15 records'}: <strong style={{ color: '#4f46e5' }}>{rows.length}</strong>
            </span>
          )}
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, borderBottom: '1.5px solid #ede9fe' }}>
          {[['tracker', '📊 Attendance Tracker'], ['clicks', '🧾 Click Log']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
              padding: '8px 14px', fontSize: 12.5, fontWeight: 700,
              color: tab === key ? '#4f46e5' : '#94a3b8',
              borderBottom: tab === key ? '2.5px solid #4f46e5' : '2.5px solid transparent', marginBottom: -1.5,
            }}>{label}</button>
          ))}
        </div>

        {tab === 'clicks' && <ClickLog />}

        {/* SEARCH */}
        {tab === 'tracker' && (<>
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
            <button onClick={() => openCalendar(rows[0].payment_id)} disabled={calLoading}
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
                  {['User ID', 'Name', 'Email', 'Phone', 'Batch Start',
                    'Internship', 'Attendance %', 'Action'].map(h => <th key={h} style={thS}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48 }}>
                    <div style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid #ede9fe',
                      borderTop: '3px solid #4f46e5', borderRadius: '50%', animation: 'at_spin .7s linear infinite' }} />
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 }}>
                    No attendance records found
                  </td></tr>
                ) : rows.map((r, i) => (
                  <tr key={`${r.payment_id}_${i}`} className="at-tr">
                    <td style={{ ...tdS, color: '#4f46e5', fontWeight: 600 }}>{r.user_id}</td>
                    <td style={{ ...tdS, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{r.name || '—'}</td>
                    <td style={{ ...tdS, color: '#4f46e5', fontSize: 11.5 }}>{r.email || '—'}</td>
                    <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{r.phone || '—'}</td>
                    <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{fmtDate(r.batch_start)}</td>
                    <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{r.internship_name || '—'}</td>
                    <td style={tdS}>
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                        background: '#f1f5f9', color: pctColor(r.attendance_pct) }}>
                        {r.attendance_pct}%
                      </span>
                    </td>
                    <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                      <button onClick={() => openCalendar(r.payment_id)} disabled={calLoading}
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
        </>)}
      </div>

      {calData && (
        <CalendarModal data={calData} onClose={() => setCalData(null)} onChanged={refreshCalendar} />
      )}
    </>
  );
}
