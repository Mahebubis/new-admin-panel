import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import api from '../../api/axios';
import toast from 'react-hot-toast';

/* ─── Endpoints ──────────────────────────────────────────────
   Single backend file handles: metadata (?action=meta),
   downloads (?type=...), and student reminder (?action=student_reminder).
   ────────────────────────────────────────────────────────── */
const META_API   = '/api/reports/reports.php?action=meta';
const EXAM_VER_API = '/api/reports/reports.php?action=exam_versions';
const DL_BASE    = (import.meta.env.VITE_API_URL || 'https://cit3.internshipstudio.com/admin/react-api')
                 + '/api/reports/reports.php';
const COMPANY_DL = 'https://portal.internshipstudio.com/api/generate_companies_excel.php';

/* Build a download URL with auth-token attached (browsers can't set headers on <a> downloads). */
const dlUrl = (params) => {
  const t = localStorage.getItem('token');
  const q = new URLSearchParams(params);
  if (t) q.set('token', t);
  return `${DL_BASE}?${q.toString()}`;
};

/* ─── CIT version selector modal ───────────────────────────── */
function CITModal({ title, items, onConfirm, onClose }) {
  const [sel, setSel] = useState(new Set(items.map(i => i.id)));
  const allSel = sel.size === items.length;
  const toggleAll = (c) => setSel(c ? new Set(items.map(i => i.id)) : new Set());
  const toggle = (id) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="rep-modal-ovl" onClick={onClose}>
      <div className="rep-modal" onClick={e => e.stopPropagation()}>
        <div className="rep-modal-head">
          <span>📥 {title}</span>
          <button className="rep-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="rep-modal-body">
          <p className="rep-modal-sub">Select CIT versions to include in the export:</p>

          <label className="rep-chk-all">
            <input type="checkbox" checked={allSel} onChange={e => toggleAll(e.target.checked)} />
            <span>Select All ({items.length})</span>
          </label>

          <div className="rep-chk-grid">
            {items.map(it => (
              <label key={it.id} className={`rep-chk-pill ${sel.has(it.id) ? 'on' : ''}`}>
                <input type="checkbox" checked={sel.has(it.id)} onChange={() => toggle(it.id)} />
                {it.label}
              </label>
            ))}
          </div>
        </div>
        <div className="rep-modal-foot">
          <button className="rep-btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="rep-btn-primary"
            onClick={() => {
              if (!sel.size) { toast.error('Select at least one version'); return; }
              onConfirm([...sel]);
            }}
          >
            ⬇️ Download
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Batch picker modal ───────────────────────────────────── */
function BatchModal({ batches, onConfirm, onClose }) {
  const [sel, setSel] = useState(
    batches[0]?.refund === 'yes' ? batches[0].date + '||refund' : (batches[0]?.date || '')
  );
  return (
    <div className="rep-modal-ovl" onClick={onClose}>
      <div className="rep-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="rep-modal-head">
          <span>📅 Select Batch</span>
          <button className="rep-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="rep-modal-body">
          <select className="rep-select" value={sel} onChange={e => setSel(e.target.value)}>
            {batches.map((b, i) => (
              <option key={i} value={b.refund === 'yes' ? b.date + '||refund' : b.date}>
                {b.date}{b.refund === 'yes' ? ' (refund batch)' : ''}
              </option>
            ))}
          </select>
          <p className="rep-note">
            For manual month: <code>{`${DL_BASE}?type=learnyst_internship_sheet&batch=July`}</code>
          </p>
        </div>
        <div className="rep-modal-foot">
          <button className="rep-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="rep-btn-primary" onClick={() => onConfirm(sel)}>⬇️ Download</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Exam Data (Version & Date wise) modal ─────────────────── */
function ExamDataModal({ versions, loading, onConfirm, onClose }) {
  const [mode, setMode] = useState('version');           // 'version' | 'date'
  const [sel, setSel]   = useState(new Set());           // selected cit_version strings
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');

  const allSel = versions.length > 0 && sel.size === versions.length;
  const toggleAll = (c) => setSel(c ? new Set(versions.map(v => v.cit_version)) : new Set());
  const toggle = (v) => setSel(p => { const n = new Set(p); n.has(v) ? n.delete(v) : n.add(v); return n; });

  const submit = () => {
    if (mode === 'version') {
      if (!sel.size) { toast.error('Select at least one version'); return; }
      onConfirm({ mode, versions: [...sel] });
    } else {
      if (!from && !to) { toast.error('Pick a from and/or to date'); return; }
      if (from && to && from > to) { toast.error('"From" date must be before "To" date'); return; }
      onConfirm({ mode, from, to });
    }
  };

  const tabBtn = (key, label) => (
    <button
      type="button"
      onClick={() => setMode(key)}
      style={{
        flex: 1, padding: '9px 12px', border: 'none', cursor: 'pointer',
        fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
        background: mode === key ? '#fff' : 'transparent',
        color: mode === key ? '#b45309' : '#94a3b8',
        borderBottom: mode === key ? '2px solid #f59e0b' : '2px solid transparent',
      }}
    >{label}</button>
  );

  return (
    <div className="rep-modal-ovl" onClick={onClose}>
      <div className="rep-modal" onClick={e => e.stopPropagation()}>
        <div className="rep-modal-head" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
          <span>📝 Exam Data — Version &amp; Date Wise</span>
          <button className="rep-modal-close" onClick={onClose}>×</button>
        </div>

        {/* mode tabs */}
        <div style={{ display: 'flex', borderBottom: '1.5px solid #f1f5f9', background: '#fafafa' }}>
          {tabBtn('version', '📦 By Version')}
          {tabBtn('date', '📅 By Date')}
        </div>

        <div className="rep-modal-body">
          {mode === 'version' ? (
            loading ? (
              <div className="rep-loader" style={{ padding: '40px 20px', minHeight: 0 }}>
                <div className="rep-spinner" /> Loading versions...
              </div>
            ) : versions.length === 0 ? (
              <p className="rep-modal-sub">No CIT versions found in exam results.</p>
            ) : (
              <>
                <p className="rep-modal-sub">
                  Select CIT version(s). <b>Days</b> = distinct calendar dates students sat that
                  version's exam (not the raw first→last span).
                </p>

                <label className="rep-chk-all" style={{ background: '#fff7ed', color: '#b45309' }}>
                  <input type="checkbox" checked={allSel} onChange={e => toggleAll(e.target.checked)}
                    style={{ accentColor: '#f59e0b' }} />
                  <span>Select All ({versions.length})</span>
                </label>

                <div className="rep-chk-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  {versions.map(v => (
                    <label key={v.cit_version}
                      className={`rep-chk-pill ${sel.has(v.cit_version) ? 'on' : ''}`}
                      style={sel.has(v.cit_version)
                        ? { background: '#fff7ed', borderColor: '#fcd34d', color: '#b45309' } : {}}>
                      <input type="checkbox" checked={sel.has(v.cit_version)}
                        onChange={() => toggle(v.cit_version)} style={{ accentColor: '#f59e0b' }} />
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <b style={{ fontSize: 12 }}>{v.cit_version}</b>
                        <span style={{ fontSize: 10, fontWeight: 500, color: '#94a3b8' }}>
                          {v.attempts.toLocaleString()} attempts · {v.exam_days} day{v.exam_days === 1 ? '' : 's'}
                        </span>
                        <span style={{ fontSize: 9.5, fontWeight: 500, color: '#cbd5e1' }}>
                          {v.first_day} → {v.last_day}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )
          ) : (
            <>
              <p className="rep-modal-sub">
                Export every exam attempt whose date falls in this range (across all versions).
                Leave one side empty for an open-ended range.
              </p>
              <div className="rep-date-row">
                <div className="rep-date-grp">
                  <label>From:</label>
                  <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
                </div>
                <div className="rep-date-grp">
                  <label>To:</label>
                  <input type="date" value={to} onChange={e => setTo(e.target.value)} />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="rep-modal-foot">
          <button className="rep-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="rep-btn-primary"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 4px 14px rgba(245,158,11,.35)' }}
            onClick={submit}>
            ⬇️ Download CSV
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Section card — distinct accent + icon + description ──── */
const ACCENTS = {
  indigo: { from: '#4f46e5', to: '#7c3aed', tint: '#f5f3ff', border: '#e0e7ff', text: '#4338ca' },
  cyan:   { from: '#06b6d4', to: '#0891b2', tint: '#ecfeff', border: '#cffafe', text: '#0e7490' },
  green:  { from: '#10b981', to: '#059669', tint: '#ecfdf5', border: '#d1fae5', text: '#047857' },
  amber:  { from: '#f59e0b', to: '#d97706', tint: '#fffbeb', border: '#fde68a', text: '#b45309' },
  violet: { from: '#a855f7', to: '#7c3aed', tint: '#faf5ff', border: '#e9d5ff', text: '#7e22ce' },
  slate:  { from: '#64748b', to: '#475569', tint: '#f8fafc', border: '#e2e8f0', text: '#334155' },
  rose:   { from: '#f43f5e', to: '#e11d48', tint: '#fff1f2', border: '#fecdd3', text: '#be123c' },
};

function Section({ icon, title, description, accent = 'indigo', count, children }) {
  const c = ACCENTS[accent] || ACCENTS.indigo;
  return (
    <div className="rep-section" style={{ borderColor: c.border }}>
      {/* coloured top strip */}
      <div className="rep-strip" style={{ background: `linear-gradient(90deg, ${c.from}, ${c.to})` }} />

      {/* header row */}
      <div className="rep-section-head" style={{ background: c.tint }}>
        <div className="rep-section-icon" style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}>
          {icon}
        </div>
        <div className="rep-section-text">
          <div className="rep-section-title" style={{ color: c.text }}>
            {title}
            {count != null && (
              <span className="rep-count-badge" style={{ background: c.from, color: '#fff' }}>
                {count} {count === 1 ? 'export' : 'exports'}
              </span>
            )}
          </div>
          {description && <div className="rep-section-desc">{description}</div>}
        </div>
      </div>

      {/* body — buttons */}
      <div className="rep-section-body">{children}</div>
    </div>
  );
}

/* ─── Download button (anchor or button) ──────────────────── */
const DLBtn = ({ href, onClick, children, accent = 'indigo' }) => {
  const c = ACCENTS[accent];
  const cls = 'rep-dl-btn';
  const style = { '--btn-h-bg': c.tint, '--btn-h-bd': c.border, '--btn-h-fg': c.text };
  return href
    ? <a className={cls} href={href} target="_blank" rel="noopener noreferrer" style={style}>⬇️ {children}</a>
    : <button className={cls} type="button" onClick={onClick} style={style}>⬇️ {children}</button>;
};

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════ */
export default function AllReports() {
  const [citNew,   setCitNew]   = useState([]);
  const [citCount, setCitCount] = useState(0);
  const [batches,  setBatches]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null);
  const [companyDates, setCompanyDates] = useState({ from: '', to: '' });
  const [examVersions, setExamVersions] = useState([]);
  const [examVerLoading, setExamVerLoading] = useState(false);
  const [examVerLoaded, setExamVerLoaded] = useState(false);

  useEffect(() => {
    api.get(META_API)
      .then(res => {
        if (res.data.status === 'success') {
          setCitNew(res.data.cit_new || []);
          setCitCount(parseInt(res.data.cit_count || 0));
          setBatches(res.data.batch_dates || []);
        } else {
          toast.error(res.data.message || 'Failed to load report data');
        }
      })
      .catch(() => toast.error('Failed to load report data'))
      .finally(() => setLoading(false));
  }, []);

  /* Old-CIT items (numeric 1..citCount) */
  const oldItems = useMemo(
    () => Array.from({ length: citCount }, (_, i) => ({ id: i + 1, label: `CIT ${i + 1}` })),
    [citCount]
  );

  /* ── handlers ── */
  const downloadOld = (slug) => setModal({ kind: 'old', slug });
  const downloadNew = (slug) => setModal({ kind: 'new', slug });

  const confirmOld = (ids) => {
    const { slug } = modal; setModal(null);
    const v = ids.join(',');
    const params = slug === 'profile_completion_report'
      ? { type: 'user_profile_completion', versions: v }
      : { type: slug, versions: v };
    window.open(dlUrl(params), '_blank');
  };

  const confirmNew = (ids) => {
    const { slug } = modal; setModal(null);
    const v = ids.join(',');
    const params = slug === 'profile_completion_report_new'
      ? { type: 'user_profile_completion', cit_ids: v }
      : { type: slug, cit_ids: v };
    window.open(dlUrl(params), '_blank');
  };

  const confirmBatch = (val) => {
    setModal(null);
    let batch = val, refund = 'no';
    if (val.includes('||refund')) { [batch] = val.split('||'); refund = 'yes'; }
    window.open(dlUrl({ type: 'learnyst_internship_sheet', batch, refund }), '_blank');
  };

  /* Exam Data (version & date wise) — lazy-load versions on first open */
  const openExamData = () => {
    setModal({ kind: 'exam_vd' });
    if (!examVerLoaded && !examVerLoading) {
      setExamVerLoading(true);
      api.get(EXAM_VER_API)
        .then(res => {
          if (res.data.status === 'success') setExamVersions(res.data.versions || []);
          else toast.error(res.data.message || 'Failed to load exam versions');
        })
        .catch(() => toast.error('Failed to load exam versions'))
        .finally(() => { setExamVerLoading(false); setExamVerLoaded(true); });
    }
  };

  const confirmExamData = ({ mode, versions, from, to }) => {
    setModal(null);
    const params = { type: 'exam_version_date' };
    if (mode === 'version') params.versions = versions.join(',');
    else { if (from) params.from = from; if (to) params.to = to; }
    window.open(dlUrl(params), '_blank');
  };

  const downloadCompany = () => {
    if (!companyDates.from || !companyDates.to) {
      toast.error('Please pick start and end date'); return;
    }
    window.open(`${COMPANY_DL}?start_date=${companyDates.from}&end_date=${companyDates.to}`, '_blank');
  };

  /* ════════ RENDER ════════ */
  return (
    <>
      <Helmet><title>All Reports | Admin Panel</title></Helmet>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .rep-root, .rep-root * { box-sizing: border-box; font-family: 'Plus Jakarta Sans', sans-serif; }

        /* shell — flows inside admin <main>; no inner scroll/viewport, page scrolls the browser */
        .rep-root {
          margin: -16px -20px;            /* cancel admin <main> padding so our header is full-width */
          background: #f1f5f9;
          min-height: calc(100vh - 62px);
          display: flex; flex-direction: column;
        }
        .rep-header {
          background: #fff; border-bottom: 1.5px solid #e2e8f0;
          padding: 14px 24px; display: flex; align-items: center; gap: 16px;
          box-shadow: 0 1px 0 rgba(0,0,0,0.02);
          position: sticky; top: 62px; z-index: 10;
        }
        .rep-title {
          font-size: 16px; font-weight: 700; color: #0f172a; letter-spacing: -0.3px;
          display: flex; align-items: center; gap: 10px;
        }
        .rep-title-ic {
          width: 32px; height: 32px; border-radius: 9px;
          display: inline-flex; align-items: center; justify-content: center;
          color: #fff; font-size: 16px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          box-shadow: 0 4px 14px rgba(79,70,229,.35);
        }
        .rep-sub { font-size: 12px; color: #94a3b8; font-weight: 500; }
        .rep-stats { display: flex; gap: 8px; margin-left: auto; }
        .rep-stat-pill {
          display: flex; flex-direction: column; padding: 6px 14px;
          background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
          min-width: 110px; text-align: center;
        }
        .rep-stat-pill-lbl { font-size: 9.5px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .rep-stat-pill-val { font-size: 14px; font-weight: 700; color: #4f46e5; }

        /* body — natural flow */
        .rep-body {
          padding: 20px 24px 28px;
          display: flex; flex-direction: column; gap: 16px;
        }

        /* section card */
        .rep-section {
          background: #fff; border-radius: 14px; border: 1.5px solid #e2e8f0;
          overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          transition: transform .15s, box-shadow .15s;
        }
        .rep-section:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(15,23,42,.06);
        }
        .rep-strip { height: 4px; }
        .rep-section-head {
          padding: 14px 18px; display: flex; align-items: center; gap: 14px;
          border-bottom: 1.5px solid rgba(15,23,42,0.04);
        }
        .rep-section-icon {
          width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 18px; color: #fff; box-shadow: 0 4px 12px rgba(15,23,42,.12);
        }
        .rep-section-text { flex: 1; min-width: 0; }
        .rep-section-title {
          font-size: 14px; font-weight: 800; letter-spacing: -0.2px;
          display: flex; align-items: center; gap: 10px; line-height: 1.2;
        }
        .rep-count-badge {
          font-size: 9.5px; font-weight: 700; padding: 2px 8px;
          border-radius: 10px; letter-spacing: 0.3px; text-transform: uppercase;
        }
        .rep-section-desc {
          font-size: 11.5px; color: #64748b; margin-top: 3px; font-weight: 500;
        }

        .rep-section-body {
          padding: 16px 18px; display: flex; flex-wrap: wrap; gap: 10px;
          align-items: center; background: #fff;
        }

        /* download button */
        .rep-dl-btn {
          padding: 9px 14px; background: #fff; border: 1.5px solid #e2e8f0;
          border-radius: 9px; font-size: 12px; font-weight: 600; color: #1e293b;
          text-decoration: none; cursor: pointer; white-space: nowrap;
          display: inline-flex; align-items: center; gap: 7px;
          transition: all .15s; font-family: inherit; line-height: 1;
        }
        .rep-dl-btn:hover {
          background: var(--btn-h-bg, #ede9fe);
          color: var(--btn-h-fg, #4f46e5);
          border-color: var(--btn-h-bd, #c4b5fd);
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(15,23,42,.06);
        }

        /* date row (company) */
        .rep-date-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; width: 100%; }
        .rep-date-grp { display: flex; align-items: center; gap: 7px; }
        .rep-date-grp label { font-size: 11.5px; font-weight: 600; color: #64748b; }
        .rep-date-grp input {
          padding: 7px 10px; border: 1.5px solid #e2e8f0; border-radius: 8px;
          font-size: 12px; color: #1e293b; outline: none; font-family: inherit;
          background: #fff; transition: border-color .15s;
        }
        .rep-date-grp input:focus { border-color: #4f46e5; }

        /* modal */
        .rep-modal-ovl {
          position: fixed; inset: 0; background: rgba(15,23,42,0.5);
          z-index: 9999; display: flex; align-items: center; justify-content: center;
          padding: 16px; backdrop-filter: blur(4px);
        }
        .rep-modal {
          background: #fff; border-radius: 16px; width: 100%; max-width: 540px;
          max-height: 80vh; overflow: hidden; display: flex; flex-direction: column;
          box-shadow: 0 24px 64px rgba(0,0,0,0.3);
        }
        .rep-modal-head {
          padding: 14px 20px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: #fff; font-size: 14px; font-weight: 700;
          display: flex; justify-content: space-between; align-items: center;
        }
        .rep-modal-close {
          background: rgba(255,255,255,0.2); border: none; color: #fff;
          width: 28px; height: 28px; border-radius: 7px; font-size: 18px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
        }
        .rep-modal-close:hover { background: rgba(255,255,255,0.35); }
        .rep-modal-body { padding: 18px 20px; overflow-y: auto; flex: 1; }
        .rep-modal-sub  { font-size: 12.5px; color: #64748b; margin-bottom: 12px; }
        .rep-modal-foot {
          display: flex; justify-content: flex-end; gap: 8px;
          padding: 12px 18px; border-top: 1.5px solid #f1f5f9; background: #fafafa;
        }
        .rep-btn-cancel {
          padding: 8px 16px; border: 1.5px solid #e2e8f0; background: #fff;
          color: #475569; border-radius: 8px; font-size: 12.5px; font-weight: 600;
          cursor: pointer; font-family: inherit;
        }
        .rep-btn-cancel:hover { background: #f1f5f9; }
        .rep-btn-primary {
          padding: 8px 18px; border: none; border-radius: 8px; color: #fff;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit;
          box-shadow: 0 4px 14px rgba(79,70,229,.35);
        }
        .rep-btn-primary:hover { opacity: .92; }

        /* CIT version pills */
        .rep-chk-all {
          display: flex; align-items: center; gap: 8px; cursor: pointer;
          padding: 9px 12px; background: #ede9fe; color: #4f46e5;
          border-radius: 8px; font-size: 12.5px; font-weight: 700;
          margin-bottom: 12px; user-select: none;
        }
        .rep-chk-all input { accent-color: #4f46e5; width: 14px; height: 14px; }
        .rep-chk-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
          max-height: 280px; overflow-y: auto; padding-right: 4px;
        }
        .rep-chk-grid::-webkit-scrollbar { width: 5px; }
        .rep-chk-grid::-webkit-scrollbar-track { background: #f1f5f9; }
        .rep-chk-grid::-webkit-scrollbar-thumb { background: #c7d2fe; border-radius: 5px; }
        .rep-chk-pill {
          display: flex; align-items: center; gap: 7px; cursor: pointer;
          padding: 8px 10px; border-radius: 8px; font-size: 12px; font-weight: 600;
          color: #64748b; background: #f8fafc; border: 1.5px solid #e2e8f0;
          user-select: none; transition: all .15s;
        }
        .rep-chk-pill input { accent-color: #4f46e5; width: 13px; height: 13px; }
        .rep-chk-pill.on {
          background: #f5f3ff; border-color: #c4b5fd; color: #4f46e5;
        }

        /* select & note */
        .rep-select {
          width: 100%; padding: 10px 12px; border: 1.5px solid #e2e8f0;
          border-radius: 8px; font-size: 13px; color: #1e293b; outline: none;
          font-family: inherit; background: #fff;
        }
        .rep-select:focus { border-color: #4f46e5; }
        .rep-note {
          font-size: 11px; color: #94a3b8; margin-top: 10px;
          padding: 8px 10px; background: #f8fafc; border-radius: 6px; word-break: break-all;
        }
        .rep-note code { color: #4f46e5; font-family: monospace; font-size: 10.5px; }

        /* loader */
        .rep-loader {
          display: flex; align-items: center; justify-content: center;
          gap: 10px; color: #64748b; font-size: 13px; font-weight: 500;
          padding: 80px 20px; min-height: 200px;
        }
        .rep-spinner {
          width: 28px; height: 28px; border: 3px solid #ede9fe;
          border-top-color: #4f46e5; border-radius: 50%;
          animation: rep-spin .7s linear infinite;
        }
        @keyframes rep-spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .rep-chk-grid { grid-template-columns: repeat(2, 1fr); }
          .rep-section-body { padding: 14px; }
          .rep-body { padding: 14px; }
          .rep-stats { display: none; }
        }
      `}</style>

      <div className="rep-root">
        {/* HEADER */}
        <div className="rep-header">
          <span className="rep-title">
            <span className="rep-title-ic">📊</span>
            <div>
              All Reports
              <div className="rep-sub">Download segmented data, exports & batch sheets</div>
            </div>
          </span>

          <div className="rep-stats">
            <div className="rep-stat-pill">
              <span className="rep-stat-pill-lbl">CIT Versions</span>
              <span className="rep-stat-pill-val">{citCount}</span>
            </div>
            <div className="rep-stat-pill">
              <span className="rep-stat-pill-lbl">CIT (New)</span>
              <span className="rep-stat-pill-val">{citNew.length}</span>
            </div>
            <div className="rep-stat-pill">
              <span className="rep-stat-pill-lbl">Batches</span>
              <span className="rep-stat-pill-val">{batches.length}</span>
            </div>
          </div>
        </div>

        {/* BODY */}
        {loading ? (
          <div className="rep-loader">
            <div className="rep-spinner" />
            Loading report config...
          </div>
        ) : (
          <div className="rep-body">

            {/* Global Data — Old CIT versions */}
            <Section
              icon="📦"
              title="Global Data"
              description="Full user dump filtered by legacy CIT version (numeric)"
              accent="indigo"
              count={3}
            >
              {/* <DLBtn accent="indigo" onClick={() => downloadOld('complete_data')}>Complete User Data</DLBtn> */}
              <DLBtn accent="indigo" onClick={() => downloadOld('simplified_complete_data')}>Simplified User Data</DLBtn>
              <DLBtn accent="indigo" onClick={() => downloadOld('profile_completion_report')}>Profile Completion Data</DLBtn>
            </Section>

            {/* Global Data (New) */}
            {/* <Section
              icon="🆕"
              title="Global Data (New)"
              description="Same exports filtered by cit_id from the new cit_version table"
              accent="cyan"
              count={3}
            >
              <DLBtn accent="cyan" onClick={() => downloadNew('complete_data_new')}>Complete User Data (New)</DLBtn>
              <DLBtn accent="cyan" onClick={() => downloadNew('simplified_complete_data_new')}>Simplified User Data (New)</DLBtn>
              <DLBtn accent="cyan" onClick={() => downloadNew('profile_completion_report_new')}>Profile Completion Data (New)</DLBtn>
            </Section> */}

            {/* Student Data */}
            <Section
              icon="👨‍🎓"
              title="Student Data"
              description="All-student exports, segmented by payment / activation status"
              accent="green"
              count={7}
            >
              <DLBtn accent="green" href={dlUrl({ type: 'all_students' })}>All Student Data</DLBtn>
              {/* <DLBtn accent="green" href={dlUrl({ type: 'all_students', status: 'paid' })}>Paid Student Data</DLBtn>
              <DLBtn accent="green" href={dlUrl({ type: 'all_students', status: 'unpaid' })}>Unpaid Student Data</DLBtn>
              <DLBtn accent="green" href={dlUrl({ type: 'dropoff_mobile' })}>Dropoff Mobile No.</DLBtn>
              <DLBtn accent="green" href={dlUrl({ type: 'deactivated_students' })}>Deactivated User Data</DLBtn>
              <DLBtn accent="green" href={dlUrl({ type: 'student_applications' })}>Download Student Applications</DLBtn>
              <DLBtn accent="green" href={dlUrl({ action: 'student_reminder' })}>Student Reminder</DLBtn> */}
            </Section>

            {/* Exam Data */}
            <Section
              icon="📝"
              title="Exam Data"
              description="Exam credentials and result sheets across both DBs"
              accent="amber"
              count={3}
            >
              <DLBtn accent="amber" href={dlUrl({ type: 'user_exam_credentials' })}>Exam Credentials</DLBtn>
              <DLBtn accent="amber" href={dlUrl({ type: 'user_exam_result' })}>Exam Result</DLBtn>
              <DLBtn accent="amber" onClick={openExamData}>Download Exam Data Version &amp; Date Wise</DLBtn>
            </Section>

            {/* Internship Data */}
            <Section
              icon="🎓"
              title="Internship Data"
              description="Purchases, internship sheets and Learnyst LMS export"
              accent="violet"
              count={3}
            >
              <DLBtn accent="violet" href={dlUrl({ type: 'user_purchased_internships' })}>Student Purchased Internships</DLBtn>
              <DLBtn accent="violet" href={dlUrl({ type: 'student_internship_sheet' })}>Student Internship Sheet</DLBtn>
              <DLBtn accent="violet" onClick={() => setModal({ kind: 'batch' })}>Export Learnyst Sheet By Date</DLBtn>
            </Section>

            {/* Misc Data */}
            <Section
              icon="🗂️"
              title="Misc Data"
              description="IP logs, GST sheet and dropped-off lead exports"
              accent="slate"
              count={3}
            >
              <DLBtn accent="slate" href={dlUrl({ type: 'user_ip_data' })}>User IP</DLBtn>
              <DLBtn accent="slate" href={dlUrl({ type: 'gst_data' })}>GST Data Sheet</DLBtn>
              <DLBtn accent="slate" href={dlUrl({ type: 'autofill_reg_data' })}>Autofill Registration Data</DLBtn>
            </Section>

            {/* Company Report */}
            {/* <Section
              icon="🏢"
              title="Company Report"
              description="Date-ranged employer activity export (registrations, postings, hires)"
              accent="rose"
              count={1}
            >
              <div className="rep-date-row">
                <div className="rep-date-grp">
                  <label>Start:</label>
                  <input
                    type="date"
                    value={companyDates.from}
                    onChange={e => setCompanyDates(p => ({ ...p, from: e.target.value }))}
                  />
                </div>
                <div className="rep-date-grp">
                  <label>End:</label>
                  <input
                    type="date"
                    value={companyDates.to}
                    onChange={e => setCompanyDates(p => ({ ...p, to: e.target.value }))}
                  />
                </div>
                <DLBtn accent="rose" onClick={downloadCompany}>Download Company Report</DLBtn>
              </div>
            </Section> */}
          </div>
        )}
      </div>

      {/* MODALS */}
      {modal?.kind === 'old' && (
        <CITModal
          title="Select CIT Versions"
          items={oldItems}
          onConfirm={confirmOld}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === 'new' && (
        <CITModal
          title="Select CIT Versions (New)"
          items={citNew.map(c => ({ id: c.id, label: c.cit_name }))}
          onConfirm={confirmNew}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === 'exam_vd' && (
        <ExamDataModal
          versions={examVersions}
          loading={examVerLoading}
          onConfirm={confirmExamData}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === 'batch' && batches.length > 0 && (
        <BatchModal batches={batches} onConfirm={confirmBatch} onClose={() => setModal(null)} />
      )}

      {modal?.kind === 'batch' && batches.length === 0 && (
        toast.error('No batch dates available') || setModal(null)
      )}
    </>
  );
}
