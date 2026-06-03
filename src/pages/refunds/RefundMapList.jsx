import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const ENDPOINT = '/api/refunds/refund_map.php';

/* ─── funnel stages (shared by table columns + drill-down popup) ─── */
const STAGES = [
  { key: 'registered',             label: 'Registered Students',   short: 'Registered',   icon: '🎫', color: '#4338ca', bg: '#eef2ff' },
  { key: 'attendance_qualified',   label: 'Attendance Qualified',  short: 'Attendance ✓', icon: '📅', color: '#0369a1', bg: '#e0f2fe' },
  { key: 'project_submitted',      label: 'Project Submitted',     short: 'Submitted',    icon: '📤', color: '#7c3aed', bg: '#f3e8ff' },
  { key: 'project_approved',       label: 'Project Approved',      short: 'Approved',     icon: '✅', color: '#b45309', bg: '#fef3c7' },
  { key: 'refund_claim_requested', label: 'Refund Claim Requested',short: 'Claim Req.',   icon: '🙋', color: '#be185d', bg: '#fce7f3' },
  { key: 'refund_done',            label: 'Refund Done',           short: 'Refunded',     icon: '💸', color: '#15803d', bg: '#dcfce7' },
];
const STAGE_BY_KEY = Object.fromEntries(STAGES.map(s => [s.key, s]));

/* ─── helpers ─── */
const fmtNum = n => (Number(n) || 0).toLocaleString('en-IN');
const initials = name => (name || '?').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const fmtDate = s => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const csvCell = c => `"${String(c ?? '').replace(/"/g, '""')}"`;
const downloadCSV = (headers, body, name) => {
  const csv = [headers, ...body].map(r => r.map(csvCell).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};
const pctColor = p => (p >= 100 ? '#16a34a' : p >= 75 ? '#0369a1' : p >= 50 ? '#d97706' : '#dc2626');

/* ─── group a flat days[] array into per-calendar-month grids ─── */
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function buildMonths(days) {
  const map = {};
  days.forEach(d => { const k = d.date.slice(0, 7); (map[k] ||= {})[d.date] = d.status; });
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
    return { key, label: first.toLocaleString('en-US', { month: 'long', year: 'numeric' }), cells };
  });
}

/* ─── shared styles ─── */
const inpS = {
  width: '100%', padding: '7px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
  fontSize: 12.5, fontFamily: 'inherit', outline: 'none', color: '#1e293b', background: '#f8fafc',
};
const labelS = {
  fontSize: 10.5, fontWeight: 700, color: '#6b8f8a', textTransform: 'uppercase',
  letterSpacing: '.05em', display: 'block', marginBottom: 5,
};

/* ─── pagination ─── */
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
  else {
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }
  const bS = (active, disabled) => ({
    minWidth: 30, height: 30, border: `1.5px solid ${active ? '#4f46e5' : '#e2e8f0'}`,
    borderRadius: 7, fontSize: 12, fontWeight: active ? 700 : 500,
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
    background: active ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#fff',
    color: active ? '#fff' : '#475569', opacity: disabled ? .4 : 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 7px',
  });
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      <button style={bS(false, page <= 1)} disabled={page <= 1} onClick={() => onChange(page - 1)}>‹</button>
      {pages.map((p, i) => p === '…'
        ? <button key={`e${i}`} style={bS(false, true)} disabled>…</button>
        : <button key={p} style={bS(p === page, false)} onClick={() => onChange(p)}>{p}</button>)}
      <button style={bS(false, page >= totalPages)} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>›</button>
    </div>
  );
}

/* ─── searchable dropdown — type to filter a long option list ─── */
function SearchableSelect({ value, options, onChange, placeholder = 'Select…', allLabel = 'All' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQ(''); } };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = q ? options.filter(o => o.toLowerCase().includes(q.toLowerCase())) : options;
  const pick = v => { onChange(v); setOpen(false); setQ(''); };
  const optS = active => ({
    padding: '8px 12px', fontSize: 12.5, cursor: 'pointer',
    background: active ? '#eef2ff' : '#fff', color: active ? '#4338ca' : '#1e293b',
    fontWeight: active ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  });

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="rml-inp" onClick={() => setOpen(o => !o)}
        style={{ ...inpS, cursor: 'pointer', textAlign: 'left', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: value ? '#1e293b' : '#94a3b8' }}>{value || placeholder}</span>
        <span style={{ color: '#94a3b8', fontSize: 9, flexShrink: 0 }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 60,
          background: '#fff', border: '1.5px solid #d4efeb', borderRadius: 8,
          boxShadow: '0 10px 28px rgba(13,33,55,.16)', overflow: 'hidden',
        }}>
          <div style={{ padding: 6, borderBottom: '1px solid #eef2f1' }}>
            <input autoFocus className="rml-inp" value={q} onChange={e => setQ(e.target.value)}
              placeholder="Type to search…" style={{ ...inpS, padding: '6px 10px' }} />
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            <div className="rml-opt" onClick={() => pick('')} style={optS(!value)}>{allLabel}</div>
            {filtered.length === 0
              ? <div style={{ padding: '10px 12px', fontSize: 12, color: '#94a3b8' }}>No matches</div>
              : filtered.map(o => (
                  <div key={o} className="rml-opt" onClick={() => pick(o)} style={optS(o === value)} title={o}>{o}</div>
                ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   ATTENDANCE CALENDAR — one student
════════════════════════════════════════ */
function CalendarModal({ data, onClose }) {
  const months = useMemo(() => buildMonths(data.days || []), [data]);
  const todayKey = new Date().toISOString().slice(0, 7);
  const initial = months.findIndex(m => m.key === todayKey);
  const [slide, setSlide] = useState(initial >= 0 ? initial : Math.max(0, months.length - 1));
  const cur = months[slide];

  const cellBg = { present: '#22c55e', absent: '#ef4444', future: '#f1f5f9' };
  const cellFg = { present: '#fff', absent: '#fff', future: '#94a3b8' };
  const navBtn = disabled => ({
    width: 32, height: 32, borderRadius: '50%', border: 'none', fontSize: 17,
    background: disabled ? '#f1f5f9' : '#eef2ff', color: disabled ? '#cbd5e1' : '#4f46e5',
    cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700,
  });

  return (
    <div onMouseDown={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.62)', zIndex: 1100,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto',
    }}>
      <div onMouseDown={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, width: 470, maxWidth: '100%',
        boxShadow: '0 24px 70px rgba(0,0,0,.4)', overflow: 'hidden',
      }}>
        {/* header */}
        <div style={{
          background: 'linear-gradient(135deg,#0d2137,#164a3e)', padding: '18px 22px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>📊 Attendance Calendar</div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.65)', marginTop: 3 }}>
              {data.name} · {data.email}
            </div>
          </div>
          <button onClick={onClose} style={{
            border: 'none', background: 'rgba(255,255,255,.15)', borderRadius: 8,
            width: 30, height: 30, cursor: 'pointer', fontSize: 16, color: '#fff', flexShrink: 0,
          }}>×</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* internship + % */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#eef2ff', borderRadius: 12, padding: '13px 15px', marginBottom: 14, gap: 10,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>{data.internship_name || '—'}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                {data.batch} · {fmtDate(data.batch_start)} → {fmtDate(data.batch_end)}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: pctColor(data.attendance_pct) }}>
                {data.attendance_pct}%
              </div>
              <div style={{ fontSize: 10, color: '#64748b' }}>
                {data.present_days}/{data.elapsed_days} days
              </div>
            </div>
          </div>

          {/* month nav */}
          {!cur ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: 13 }}>
              No calendar data
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <button style={navBtn(slide <= 0)} disabled={slide <= 0} onClick={() => setSlide(s => s - 1)}>‹</button>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>{cur.label}</div>
                <button style={navBtn(slide >= months.length - 1)} disabled={slide >= months.length - 1}
                  onClick={() => setSlide(s => s + 1)}>›</button>
              </div>

              {/* weekday row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
                {WEEK.map(w => (
                  <div key={w} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{w}</div>
                ))}
              </div>

              {/* day cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
                {cur.cells.map((c, i) => c === null ? <div key={i} /> : (
                  <div key={i} style={{
                    aspectRatio: '1', borderRadius: 8, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                    background: c.status ? cellBg[c.status] : 'transparent',
                    color: c.status ? cellFg[c.status] : '#cbd5e1',
                    border: c.status ? 'none' : '1px dashed #e2e8f0',
                  }}>
                    <span>{c.day}</span>
                    {c.status === 'present' && <span style={{ fontSize: 9 }}>✓</span>}
                    {c.status === 'absent' && <span style={{ fontSize: 9 }}>✕</span>}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* legend */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 14 }}>
            {[['Present', '#22c55e'], ['Absent', '#ef4444'], ['Future', '#f1f5f9']].map(([l, c]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b' }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: c, border: l === 'Future' ? '1px solid #e2e8f0' : 'none' }} />
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   DRILL-DOWN POPUP — records at batch + stage
════════════════════════════════════════ */
function StageModal({ batch, stage, duration, onClose }) {
  const cfg = STAGE_BY_KEY[stage];
  /* compact label for the active duration filter (matches the cell chip) */
  const durLabel = duration ? (duration % 30 === 0 ? `${duration / 30}M` : `${Math.max(1, Math.round(duration / 7))}W`) : '';
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [internships, setInternships] = useState([]);
  const [search, setSearch] = useState('');
  const [internship, setInternship] = useState('');
  const [calData, setCalData] = useState(null);
  const [calBusy, setCalBusy] = useState(0);
  const debounceRef = useRef(null);
  const PER_PAGE = 10;

  const load = useCallback((p, s, intn) => {
    setLoading(true);
    api.get(ENDPOINT, { params: {
      action: 'stage_records', batch, stage, page: p, per_page: PER_PAGE,
      search: s || '', internship: intn || '', duration: duration || '',
    } })
      .then(r => {
        const d = r.data?.data || {};
        if (!r.data?.success) { toast.error(r.data?.message || 'Failed'); return; }
        setRows(d.rows || []);
        setTotal(d.total || 0);
        setTotalPages(d.total_pages || 1);
        if (d.internships) setInternships(d.internships);
      })
      .catch(() => toast.error('Failed to load records'))
      .finally(() => setLoading(false));
  }, [batch, stage, duration]);

  useEffect(() => { load(1, '', ''); }, [load]);

  const onSearch = val => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); load(1, val, internship); }, 350);
  };
  const onInternship = val => { setInternship(val); setPage(1); load(1, search, val); };
  const goto = p => { setPage(p); load(p, search, internship); };

  /* open the day-by-day attendance calendar for one student */
  const openCalendar = (userId) => {
    setCalBusy(userId);
    api.get(ENDPOINT, { params: { action: 'attendance_calendar', user_id: userId, batch } })
      .then(r => {
        if (r.data?.success && r.data.data?.calendar) setCalData(r.data.data.calendar);
        else toast.error(r.data?.message || 'No calendar data');
      })
      .catch(() => toast.error('Failed to load calendar'))
      .finally(() => setCalBusy(0));
  };

  const exportCSV = async () => {
    setExporting(true);
    const t = toast.loading('Preparing export…');
    try {
      const r = await api.get(ENDPOINT, { params: {
        action: 'export_stage', batch, stage, search: search || '', internship: internship || '', duration: duration || '',
      } });
      if (!r.data?.success) { toast.error(r.data?.message || 'Export failed', { id: t }); return; }
      const all = r.data.data?.rows || [];
      if (!all.length) { toast.error('No records to export', { id: t }); return; }
      downloadCSV(
        ['#', 'User ID', 'Name', 'Email', 'Phone', 'Internship', 'Duration (days)', 'Batch', 'Batch End',
          'Paid At', 'Attendance Present', 'Attendance Expected', 'Attendance %', 'Marked Today'],
        all.map((x, i) => [i + 1, x.user_id, x.name, x.email, x.phone, x.internship_name,
          x.duration_days, x.batch, x.batch_end, x.paid_at, x.att_present, x.att_expected,
          x.att_pct + '%', x.marked_today == 1 ? 'Yes' : 'No']),
        `${stage}_${batch}_${new Date().toISOString().slice(0, 10)}.csv`.replace(/[^\w.-]+/g, '_'),
      );
      toast.success(`Exported ${all.length.toLocaleString('en-IN')} record${all.length > 1 ? 's' : ''}`, { id: t });
    } catch { toast.error('Export failed', { id: t }); }
    finally { setExporting(false); }
  };

  const thS = {
    padding: '10px 12px', fontSize: 10.5, fontWeight: 700, color: '#fff', textAlign: 'left',
    textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap',
    background: 'linear-gradient(135deg,#0d2137,#1a3a2e)', position: 'sticky', top: 0, zIndex: 3,
  };
  const tdS = { padding: '10px 12px', fontSize: 12, color: '#1e293b', borderBottom: '1px solid #f0faf8', verticalAlign: 'middle' };
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);

  return (
    <>
    <div onMouseDown={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onMouseDown={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, width: 1080, maxWidth: '100%', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,.35)',
      }}>
        {/* header */}
        <div style={{
          background: 'linear-gradient(135deg,#0d2137,#164a3e)', padding: '18px 22px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{cfg?.icon}</span> {cfg?.label}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 3 }}>
              Batch: <strong style={{ color: '#fff' }}>{batch}</strong>
              {durLabel && <> · Duration: <strong style={{ color: '#fff' }}>{durLabel}</strong></>}
              {' · '}{fmtNum(total)} record{total === 1 ? '' : 's'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={exportCSV} disabled={exporting} style={{
              padding: '8px 14px', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 8,
              background: 'rgba(255,255,255,.1)', color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: exporting ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: exporting ? .6 : 1,
            }}>{exporting ? '⏳ Exporting…' : '⬇️ Export All'}</button>
            <button onClick={onClose} style={{
              border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', borderRadius: 8,
              width: 34, height: 34, cursor: 'pointer', fontSize: 18, flexShrink: 0,
            }}>×</button>
          </div>
        </div>

        {/* filters */}
        <div style={{
          display: 'flex', gap: 12, padding: '14px 22px', flexShrink: 0, alignItems: 'flex-end',
          borderBottom: '1px solid #eef2f1', flexWrap: 'wrap',
        }}>
          <div style={{ flex: '1 1 240px' }}>
            <label style={labelS}>Search</label>
            <input style={inpS} value={search} onChange={e => onSearch(e.target.value)}
              placeholder="Name, email, phone, user ID…" />
          </div>
          <div style={{ minWidth: 200, flex: '1 1 200px' }}>
            <label style={labelS}>Internship</label>
            <select style={{ ...inpS, cursor: 'pointer' }} value={internship} onChange={e => onInternship(e.target.value)}>
              <option value="">All Internships</option>
              {internships.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>

        {/* table */}
        <div style={{ overflow: 'auto', flex: 1, minHeight: 200 }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 1060 }}>
            <thead>
              <tr>
                {['#', 'Student', 'Phone', 'Internship', 'Duration', 'Batch Start', 'Batch End', 'Attendance (till date)'].map(h =>
                  <th key={h} style={thS}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: '#6b8f8a', fontSize: 13 }}>Loading…</td></tr>
              ) : !rows.length ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 54, color: '#6b8f8a' }}>
                  <div style={{ fontSize: 38, opacity: .3 }}>📭</div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>No records found</div>
                </td></tr>
              ) : rows.map((r, i) => (
                <tr key={`${r.user_id}-${i}`}>
                  <td style={{ ...tdS, color: '#94a3b8' }}>{(page - 1) * PER_PAGE + i + 1}</td>
                  <td style={tdS}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                      }}>{initials(r.name)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 12.5 }}>{r.name || 'Unknown'}</div>
                        <div style={{ fontSize: 11, color: '#6b8f8a' }}>{r.email || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={tdS}>{r.phone || '—'}</td>
                  <td style={{ ...tdS, maxWidth: 200 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={r.internship_name}>{r.internship_name || '—'}</div>
                  </td>
                  <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                    <span style={{
                      background: '#eef2ff', color: '#4338ca', fontWeight: 700, fontSize: 11,
                      padding: '3px 8px', borderRadius: 6,
                    }}>{r.duration_days ? `${r.duration_days} days` : '—'}</span>
                  </td>
                  <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                    <span style={{
                      background: '#ecfdf5', color: '#15803d', fontWeight: 700, fontSize: 11,
                      padding: '3px 8px', borderRadius: 6,
                    }}>{fmtDate(r.batch_start)}</span>
                  </td>
                  <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                    <span style={{
                      background: '#fff7ed', color: '#c2410c', fontWeight: 700, fontSize: 11,
                      padding: '3px 8px', borderRadius: 6,
                    }}>{fmtDate(r.batch_end)}</span>
                  </td>
                  <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>
                        <span style={{ fontWeight: 700, color: pctColor(r.att_pct) }}>
                          {r.att_present}/{r.att_expected}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: 11 }}> days · {r.att_pct}%</span>
                        {r.marked_today == 1 && (
                          <span style={{
                            marginLeft: 6, background: '#dcfce7', color: '#15803d', fontSize: 9.5,
                            fontWeight: 700, padding: '2px 6px', borderRadius: 20,
                          }}>TODAY ✓</span>
                        )}
                      </span>
                      <button onClick={() => openCalendar(r.user_id)} disabled={calBusy === r.user_id}
                        title="View attendance calendar"
                        style={{
                          border: '1.5px solid #c7d2fe', borderRadius: 7, background: '#eef2ff',
                          color: '#4338ca', fontSize: 11, fontWeight: 700, padding: '4px 9px',
                          cursor: calBusy === r.user_id ? 'wait' : 'pointer', fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                        }}>
                        {calBusy === r.user_id ? '⏳' : '📅'} Calendar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* footer / pagination */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 22px', borderTop: '1px solid #eef2f1', background: '#f8fafc',
          flexShrink: 0, flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ fontSize: 12, color: '#6b8f8a' }}>
            {total === 0 ? 'No records' : <>Showing <strong>{from}–{to}</strong> of <strong style={{ color: '#4f46e5' }}>{fmtNum(total)}</strong></>}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={goto} />
        </div>
      </div>
    </div>

    {calData && <CalendarModal data={calData} onClose={() => setCalData(null)} />}
    </>
  );
}

/* ════════════════════════════════════════
   MAIN PAGE — Refund Funnel Map
════════════════════════════════════════ */
export default function RefundMapList() {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);
  const [batches, setBatches] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  /* filters */
  const [search, setSearch] = useState('');
  const [batch, setBatch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [perPage, setPerPage] = useState(20);
  const [sortBy, setSortBy] = useState(null);   // null = default funnel-depth order
  const [sortDir, setSortDir] = useState('asc');

  const [modal, setModal] = useState(null); // { batch, stage }
  const debounceRef = useRef(null);
  const filterRef = useRef(null);
  const [stickyTop, setStickyTop] = useState(146); // navbar (62) + filter bar height

  const load = useCallback((p, f) => {
    setLoading(true);
    api.get(ENDPOINT, { params: { action: 'funnel', page: p, per_page: f.perPage, ...f.params } })
      .then(r => {
        const d = r.data?.data || {};
        if (!r.data?.success) { toast.error(r.data?.message || 'Failed'); return; }
        setRows(d.rows || []);
        setTotal(d.total || 0);
        setTotalPages(d.total_pages || 1);
        setTotals(d.totals || null);
        if (d.batches) setBatches(d.batches);
      })
      .catch(() => toast.error('Failed to load funnel'))
      .finally(() => setLoading(false));
  }, []);

  const filterParams = (over = {}) => {
    const f = {
      search, batch, date_from: dateFrom, date_to: dateTo,
      sort: sortBy || '', dir: sortBy ? sortDir : '', ...over,
    };
    const out = {};
    Object.entries(f).forEach(([k, v]) => { if (v) out[k] = v; });
    return out;
  };

  useEffect(() => { load(1, { perPage: 20, params: {} }); }, [load]);

  /* keep the table header parked right below the sticky filter bar */
  useLayoutEffect(() => {
    const el = filterRef.current;
    if (!el) return;
    const measure = () => setStickyTop(62 + el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  const onSearch = val => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1); load(1, { perPage, params: filterParams({ search: val }) });
    }, 350);
  };
  const apply = over => { setPage(1); load(1, { perPage, params: filterParams(over) }); };
  const goto = p => { setPage(p); load(p, { perPage, params: filterParams() }); };
  const clearFilters = () => {
    setSearch(''); setBatch(''); setDateFrom(''); setDateTo(''); setPerPage(20);
    setSortBy(null); setSortDir('asc'); setPage(1);
    load(1, { perPage: 20, params: {} });
  };

  /* column-header sort — click toggles asc ⇄ desc on that column */
  const handleSort = (key) => {
    const dir = (sortBy === key && sortDir === 'asc') ? 'desc' : 'asc';
    setSortBy(key); setSortDir(dir); setPage(1);
    load(1, { perPage, params: filterParams({ sort: key, dir }) });
  };
  const sortArrow = (key) => sortBy !== key
    ? <span style={{ opacity: .3, fontSize: 9, marginLeft: 3 }}>⇅</span>
    : <span style={{ fontSize: 9, marginLeft: 3 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>;

  const exportCSV = async () => {
    setExporting(true);
    const t = toast.loading('Preparing export…');
    try {
      const r = await api.get(ENDPOINT, { params: { action: 'export_funnel', ...filterParams() } });
      if (!r.data?.success) { toast.error(r.data?.message || 'Export failed', { id: t }); return; }
      const all = r.data.data?.rows || [];
      if (!all.length) { toast.error('No data to export', { id: t }); return; }
      downloadCSV(
        ['Batch', 'Batch Start', ...STAGES.map(s => s.label)],
        all.map(g => [g.batch, g.batch_start, ...STAGES.map(s => g[s.key])]),
        `refund_funnel_map_${new Date().toISOString().slice(0, 10)}.csv`,
      );
      toast.success(`Exported ${all.length.toLocaleString('en-IN')} batch row${all.length > 1 ? 's' : ''}`, { id: t });
    } catch { toast.error('Export failed', { id: t }); }
    finally { setExporting(false); }
  };

  const filtersActive = search || batch || dateFrom || dateTo || sortBy;
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const thS = {
    padding: '12px 14px', fontSize: 10.5, fontWeight: 700, color: '#fff', textTransform: 'uppercase',
    letterSpacing: '.05em', whiteSpace: 'normal', background: 'linear-gradient(135deg,#0d2137,#1a3a2e)',
    position: 'sticky', top: stickyTop, zIndex: 20, borderRight: '1px solid rgba(255,255,255,.08)',
  };
  const tdS = { padding: '10px 14px', fontSize: 12.5, color: '#1e293b', borderBottom: '1px solid #f0faf8', verticalAlign: 'middle' };

  /* Per-duration breakdown for a stage cell. Accepts either:
     - row.durations[stageKey] = { "30": 12, "60": 5, ... }  OR
     - row[`${stageKey}_by_duration`] = [{ duration:30, count:12 }, ...]
     Returns a sorted [{ d, c }] array (only positive counts) or null. */
  const durationBreakdown = (row, key) => {
    const src = (row.durations && row.durations[key]) ?? row[`${key}_by_duration`];
    if (!src) return null;
    let arr;
    if (Array.isArray(src)) {
      arr = src.map(x => ({ d: +(x.duration ?? x.d ?? x.days ?? 0), c: +(x.count ?? x.c ?? 0) }));
    } else {
      arr = Object.entries(src).map(([d, c]) => ({ d: +d, c: +c }));
    }
    arr = arr.filter(x => x.c > 0 && x.d > 0).sort((a, b) => a.d - b.d);
    return arr.length ? arr : null;
  };

  /* duration-days → compact label: multiples of 30 as months (30→1M, 90→3M),
     anything shorter as weeks (15→2W, 7→1W). */
  const fmtDur = (d) => (d % 30 === 0 ? `${d / 30}M` : `${Math.max(1, Math.round(d / 7))}W`);

  /* clickable funnel count cell */
  const CountCell = ({ row, st }) => {
    const n = row[st.key] || 0;
    if (!n) return <td style={{ ...tdS, textAlign: 'center', color: '#cbd5e1', fontWeight: 600 }}>0</td>;
    const bd = durationBreakdown(row, st.key);
    return (
      <td style={{ ...tdS, textAlign: 'center', padding: '8px 10px' }}>
        <button onClick={() => setModal({ batch: row.batch, stage: st.key })}
          title={`View ${st.label} — ${row.batch}`}
          style={{
            minWidth: 56, padding: '6px 12px', border: `1.5px solid ${st.color}33`, borderRadius: 8,
            background: st.bg, color: st.color, fontSize: 13, fontWeight: 800, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'transform .12s, box-shadow .12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${st.color}33`; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
          {fmtNum(n)}
        </button>
        {/* duration split — count (bigger) stacked over the duration number (tiny) */}
        {bd && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center', marginTop: 5 }}
            title={bd.map(x => `${fmtDur(x.d)}: ${x.c}`).join('  ·  ')}>
            {bd.map(({ d, c }) => (
              <button key={d} type="button"
                onClick={() => setModal({ batch: row.batch, stage: st.key, duration: d })}
                title={`View ${st.label} — ${row.batch} · ${fmtDur(d)}`}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1,
                  padding: '2px 4px', borderRadius: 5, background: '#fff', cursor: 'pointer',
                  border: `1px solid ${st.color}22`, minWidth: 18, fontFamily: 'inherit',
                  transition: 'background .12s, border-color .12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = st.bg; e.currentTarget.style.borderColor = `${st.color}55`; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = `${st.color}22`; }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: st.color }}>{fmtNum(c)}</span>
                <span style={{ fontSize: 7.5, fontWeight: 600, color: '#94a3b8', marginTop: 1 }}>{fmtDur(d)}</span>
              </button>
            ))}
          </div>
        )}
      </td>
    );
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        .rml-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .rml-inp:focus{border-color:#4f46e5!important;box-shadow:0 0 0 3px rgba(79,70,229,.1)!important;}
        .rml-tr:hover td{background:#f0fdf4!important;}
        .rml-opt:hover{background:#f0faf8!important;}
        @keyframes rml_spin{to{transform:rotate(360deg)}}
        .rml-spin{display:inline-block;width:30px;height:30px;border:3px solid #c4b5fd;border-top-color:#4f46e5;border-radius:50%;animation:rml_spin .7s linear infinite;}
      `}</style>

      <div className="rml-root" style={{ display: 'flex', flexDirection: 'column', padding: 20, gap: 14, background: '#f0faf8' }}>

        {/* ── HEADER STRIP — title row, then all funnels on their own row ── */}
        <div style={{
          background: 'linear-gradient(135deg,#0d2137 0%,#164a3e 100%)', borderRadius: 10,
          padding: '12px 16px', color: '#fff', display: 'flex', flexDirection: 'column',
          gap: 11, flexShrink: 0,
        }}>
          {/* Row 1 — title + export */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🪙</span>
              <span style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap' }}>Refund Funnel Map</span>
            </div>
            <button onClick={exportCSV} disabled={exporting} style={{
              padding: '6px 13px', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 7,
              background: 'rgba(255,255,255,.1)', color: '#fff', fontSize: 11.5, fontWeight: 600,
              cursor: exporting ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: exporting ? .6 : 1,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>{exporting ? '⏳ Exporting…' : '⬇️ Export All (CSV)'}</button>
          </div>

          {/* divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,.1)' }} />

          {/* Row 2 — all funnel stages in one row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 6 }}>
            {STAGES.map((s, i) => (
              <div key={s.key} style={{
                flex: '1 1 0', minWidth: 130,
                display: 'flex', alignItems: 'flex-start', gap: 8, padding: '2px 12px',
                borderLeft: i ? '1px solid rgba(255,255,255,.13)' : 'none',
              }}>
                <span style={{ fontSize: 14, marginTop: 1 }}>{s.icon}</span>
                <div style={{ lineHeight: 1.05, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{totals ? fmtNum(totals[s.key]) : '—'}</div>
                  <div style={{
                    fontSize: 8.5, fontWeight: 700, color: 'rgba(255,255,255,.55)',
                    textTransform: 'uppercase', letterSpacing: '.03em', whiteSpace: 'nowrap',
                  }}>{s.short}</div>
                  {/* duration split of this total — count stacked over its label */}
                  {(() => {
                    const bd = totals?.durations ? durationBreakdown({ durations: totals.durations }, s.key) : null;
                    if (!bd) return null;
                    return (
                      <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}
                        title={bd.map(x => `${fmtDur(x.d)}: ${x.c}`).join('  ·  ')}>
                        {bd.map(({ d, c }) => (
                          <span key={d} style={{
                            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                            lineHeight: 1.1, background: 'rgba(255,255,255,.1)',
                            border: '1px solid rgba(255,255,255,.14)', borderRadius: 5,
                            padding: '2px 6px', minWidth: 26,
                          }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#fff' }}>{fmtNum(c)}</span>
                            <span style={{
                              fontSize: 7.5, fontWeight: 700, color: 'rgba(255,255,255,.55)',
                              letterSpacing: '.02em', marginTop: 1,
                            }}>{fmtDur(d)}</span>
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── STICKY TOOLBAR: filter bar + table ── */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>

          {/* ── FILTER BAR (sticks below the top navbar on scroll) ── */}
          <div ref={filterRef} style={{
            background: '#fff', border: '1.5px solid #d4efeb', borderBottom: 'none',
            borderRadius: '12px 12px 0 0', padding: '14px 18px',
            display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
            position: 'sticky', top: 62, zIndex: 30, boxShadow: '0 4px 10px rgba(13,33,55,.05)',
          }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={labelS}>Search Batch</label>
              <input className="rml-inp" style={inpS} value={search}
                onChange={e => onSearch(e.target.value)} placeholder="Batch name…" />
            </div>
            <div style={{ minWidth: 210, flex: '1 1 210px' }}>
              <label style={labelS}>Batch</label>
              <SearchableSelect value={batch} options={batches}
                placeholder="All Batches" allLabel="All Batches"
                onChange={v => { setBatch(v); apply({ batch: v }); }} />
            </div>
            <div style={{ minWidth: 140 }}>
              <label style={labelS}>Start From</label>
              <input type="date" className="rml-inp" style={{ ...inpS, cursor: 'pointer' }} value={dateFrom}
                max={dateTo || undefined}
                onChange={e => { setDateFrom(e.target.value); apply({ date_from: e.target.value }); }} />
            </div>
            <div style={{ minWidth: 140 }}>
              <label style={labelS}>Start To</label>
              <input type="date" className="rml-inp" style={{ ...inpS, cursor: 'pointer' }} value={dateTo}
                min={dateFrom || undefined}
                onChange={e => { setDateTo(e.target.value); apply({ date_to: e.target.value }); }} />
            </div>
            <div style={{ minWidth: 80 }}>
              <label style={labelS}>Rows</label>
              <select className="rml-inp" style={{ ...inpS, cursor: 'pointer' }} value={perPage}
                onChange={e => { const v = +e.target.value; setPerPage(v); setPage(1); load(1, { perPage: v, params: filterParams() }); }}>
                {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <button onClick={clearFilters} disabled={!filtersActive} style={{
              padding: '7px 16px', border: '1.5px solid #d4efeb', borderRadius: 8, background: '#fff',
              color: '#6b8f8a', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
              cursor: filtersActive ? 'pointer' : 'not-allowed', opacity: filtersActive ? 1 : .5,
            }}>✕ Clear</button>
          </div>

          {/* ── TABLE ── */}
          <div style={{
            background: '#fff', border: '1.5px solid #d4efeb', borderRadius: '0 0 14px 14px',
            boxShadow: '0 1px 6px rgba(0,191,166,.06)',
          }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...thS, textAlign: 'left' }}>#</th>
                  <th style={{ ...thS, textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('batch')}>Batch{sortArrow('batch')}</th>
                  {STAGES.map(s => (
                    <th key={s.key} style={{ ...thS, textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort(s.key)}>{s.label}{sortArrow(s.key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48 }}>
                    <div className="rml-spin" style={{ margin: '0 auto 10px' }} />
                    <div style={{ fontSize: 13, color: '#6b8f8a' }}>Computing funnel…</div>
                  </td></tr>
                ) : !rows.length ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 60, color: '#6b8f8a' }}>
                    <div style={{ fontSize: 44, opacity: .3 }}>🪙</div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginTop: 8 }}>No refund-eligible batches found</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Try adjusting your filters</div>
                  </td></tr>
                ) : rows.map((row, idx) => (
                  <tr key={row.batch} className="rml-tr">
                    <td style={{ ...tdS, color: '#94a3b8', fontSize: 12 }}>{(page - 1) * perPage + idx + 1}</td>
                    <td style={tdS}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{row.batch}</div>
                      <div style={{ fontSize: 11, color: '#6b8f8a', marginTop: 1, fontFamily: 'JetBrains Mono,monospace' }}>
                        Starts {fmtDate(row.batch_start)}
                      </div>
                    </td>
                    {STAGES.map(s => <CountCell key={s.key} row={row} st={s} />)}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* pagination */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px',
              borderTop: '1px solid #d4efeb', background: '#f0faf8', flexWrap: 'wrap', gap: 10,
              borderRadius: '0 0 13px 13px',
            }}>
              <div style={{ fontSize: 12, color: '#6b8f8a' }}>
                {total === 0 ? 'No batches' : <>Showing <strong style={{ color: '#1a2e2b' }}>{from}–{to}</strong> of <strong style={{ color: '#4f46e5' }}>{fmtNum(total)}</strong> batches</>}
              </div>
              <Pagination page={page} totalPages={totalPages} onChange={goto} />
            </div>
          </div>
        </div>
      </div>

      {modal && <StageModal batch={modal.batch} stage={modal.stage} duration={modal.duration} onClose={() => setModal(null)} />}
    </>
  );
}
