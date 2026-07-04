import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/examinations/cit_versions.php';
const PV_API = '/api/examinations/result_publish_version.php';   // per-version publish/revert
const FH = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk = obj => new URLSearchParams(obj);

const PACKET = 500;   // students per network packet

/* ─── shared styles ─── */
const thS = {
  color: '#fff', fontSize: 11, fontWeight: 600, padding: '10px 11px',
  textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px',
  borderRight: '1px solid rgba(255,255,255,.15)', whiteSpace: 'nowrap',
};
const tdS = { padding: '8px 11px', borderBottom: '1px solid #f5f3ff', fontSize: 11.5, color: '#334155', verticalAlign: 'middle' };
const inp = {
  padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 11.5,
  fontFamily: 'inherit', color: '#1e293b', outline: 'none', width: '100%', boxSizing: 'border-box'
};
const btnBase = { padding: '4px 10px', borderRadius: 5, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', marginRight: 4 };

/* ─── empty form shapes ─── */
const emptyNew = { cit_name: '', start: '', end: '', exam_start: '', exam_end: '', result: '', certificate: '', Initial: '' };
const emptyOld = { exam_name: '', from_date: '', to_date: '', result_date: '', certificate_date: '', exam_start_date: '', exam_end_date: '', wa_community_initials: '' };

/* numeric part of "CIT 168" -> 168 */
const citNum = (name) => {
  const m = String(name || '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
};

/* ─── confirm modal ─── */
function Confirm({ msg, onOk, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, maxWidth: 400, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden'
      }}>
        <div style={{ padding: '13px 18px', background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>⚠️ Confirm Delete</span>
        </div>
        <div style={{ padding: '18px 20px' }}>
          <p style={{ fontSize: 13, color: '#334155', marginBottom: 18, lineHeight: 1.5 }}>{msg}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={onCancel} style={{
              padding: '8px 16px', border: '1.5px solid #e2e8f0',
              background: '#f8fafc', color: '#475569', borderRadius: 8, fontSize: 12, cursor: 'pointer'
            }}>Cancel</button>
            <button onClick={onOk} style={{
              padding: '8px 18px', border: 'none', borderRadius: 8,
              background: 'linear-gradient(135deg,#dc2626,#b91c1c)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer'
            }}>
              Yes, Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Add/Edit modal (shared for both tables) ─── */
function VersionModal({ title, fields, form, onChange, onSave, onClose, saving }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 720,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)'
      }}>
        <div style={{
          padding: '13px 18px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, zIndex: 5, borderRadius: '14px 14px 0 0'
        }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{title}</span>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,.2)', border: 'none',
            borderRadius: 6, width: 26, height: 26, cursor: 'pointer', color: '#fff', fontSize: 17
          }}>×</button>
        </div>
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 18px' }}>
          {fields.map(f => (
            <div key={f.key}>
              <label style={{
                display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748b',
                textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4
              }}>{f.label}</label>
              <input style={inp} type={f.type || 'text'} value={form[f.key] || ''}
                onChange={e => onChange(f.key, e.target.value)} placeholder={f.label} />
            </div>
          ))}
        </div>
        <div style={{
          padding: '12px 20px', borderTop: '1.5px solid #f1f5f9',
          display: 'flex', justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, background: '#fff'
        }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', border: '1.5px solid #e2e8f0',
            background: '#f8fafc', color: '#475569', borderRadius: 8, fontSize: 12, cursor: 'pointer'
          }}>Close</button>
          <button onClick={onSave} disabled={saving} style={{
            padding: '8px 22px', border: 'none',
            borderRadius: 8, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff',
            fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1
          }}>
            {saving ? 'Saving...' : '💾 Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Publish / Revert progress modal ─── */
function ProgressModal({ job, onClose, onPublishSkipped }) {
  const isRevert = job.kind === 'revert';
  const accent = isRevert ? '#dc2626' : '#16a34a';
  const grad = isRevert ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : 'linear-gradient(135deg,#16a34a,#15803d)';
  const pct = Math.min(100, Math.round(job.percent));
  const done = job.done;
  const canClose = done || job.error || !job.running;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 460,
        boxShadow: '0 20px 60px rgba(0,0,0,.3)', overflow: 'hidden'
      }}>
        <div style={{
          padding: '13px 18px', background: grad,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>
            {isRevert ? '↩️ Reverting' : '🚀 Publishing'} {job.cit_version}
          </span>
          {canClose && (
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,.2)', border: 'none',
              borderRadius: 6, width: 26, height: 26, cursor: 'pointer', color: '#fff', fontSize: 17
            }}>×</button>
          )}
        </div>

        <div style={{ padding: 20 }}>
          {/* progress bar */}
          <div style={{ height: 16, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              width: `${pct}%`, height: '100%', background: grad,
              transition: 'width .25s ease', borderRadius: 99
            }} />
          </div>
          <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 16, textAlign: 'right' }}>
            {pct}% &nbsp;·&nbsp; {job.processed.toLocaleString()} / {job.total.toLocaleString()}
          </div>

          {/* counters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                {isRevert ? 'Reverted' : 'Published'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: accent }}>{job.added.toLocaleString()}</div>
            </div>
            <div style={{ flex: 1, background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Skipped</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{job.skipped.toLocaleString()}</div>
            </div>
          </div>

          {/* already-published note (skip runs) */}
          {job.isSkip && job.already > 0 && (
            <div style={{
              background: '#eef2ff', border: '1.5px solid #c7d2fe', color: '#4338ca',
              padding: '8px 12px', borderRadius: 6, fontSize: 11.5, marginBottom: 12
            }}>
              ℹ️ {job.already.toLocaleString()} student{job.already === 1 ? ' was' : 's were'} already published — left unchanged.
            </div>
          )}

          {/* status line */}
          {job.error ? (
            <div style={{
              background: '#fef2f2', borderLeft: '4px solid #dc2626', color: '#991b1b',
              padding: '10px 14px', borderRadius: 6, fontSize: 12
            }}>{job.error}</div>
          ) : done ? (
            <div style={{
              background: '#f0fdf4', borderLeft: '4px solid #16a34a', color: '#15803d',
              padding: '10px 14px', borderRadius: 6, fontSize: 12
            }}>
              ✔ {isRevert ? 'Revert complete.' : 'Publish complete.'}
              {!isRevert && job.skipped > 0 && ' Some rows were skipped — you can publish them again.'}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 12 }}>
              <span style={{
                display: 'inline-block', width: 14, height: 14, border: '2px solid #e2e8f0',
                borderTop: `2px solid ${accent}`, borderRadius: '50%', animation: 'cv_spin .7s linear infinite'
              }} />
              Processing… please keep this window open.
            </div>
          )}

          {/* actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            {done && !isRevert && job.skipped > 0 && (
              <button onClick={onPublishSkipped} disabled={job.running}
                style={{
                  padding: '8px 16px', border: 'none', borderRadius: 8, background: '#4f46e5',
                  color: '#fff', fontSize: 12, fontWeight: 700, cursor: job.running ? 'not-allowed' : 'pointer',
                  opacity: job.running ? .6 : 1
                }}>
                {job.running ? 'Working…' : `Publish ${job.skipped} skipped`}
              </button>
            )}
            {canClose && (
              <button onClick={onClose} style={{
                padding: '8px 18px', border: '1.5px solid #e2e8f0',
                background: '#f8fafc', color: '#475569', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer'
              }}>
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── field definitions ─── */
const NEW_FIELDS = [
  { key: 'cit_name', label: 'CIT Name', type: 'text' },
  { key: 'start', label: 'Start', type: 'date' },
  { key: 'end', label: 'End', type: 'date' },
  { key: 'exam_start', label: 'Exam Start', type: 'date' },
  { key: 'exam_end', label: 'Exam End', type: 'date' },
  { key: 'result', label: 'Result Date', type: 'date' },
  { key: 'certificate', label: 'Certificate', type: 'date' },
  { key: 'Initial', label: 'Initial', type: 'text' },
];
const OLD_FIELDS = [
  { key: 'exam_name', label: 'Exam Name', type: 'text' },
  { key: 'from_date', label: 'From Date', type: 'date' },
  { key: 'to_date', label: 'To Date', type: 'date' },
  { key: 'result_date', label: 'Result Date', type: 'date' },
  { key: 'certificate_date', label: 'Certificate Date', type: 'date' },
  { key: 'exam_start_date', label: 'Exam Start Date', type: 'date' },
  { key: 'exam_end_date', label: 'Exam End Date', type: 'date' },
  { key: 'wa_community_initials', label: 'WA Community Initials', type: 'text' },
];

/* ════════ MAIN COMPONENT ════════ */
export default function CITVersions() {
  const [oldRows, setOldRows] = useState([]);
  const [statuses, setStatuses] = useState({});   // { "CIT 168": {total,published,skipped,batch_id,is_published} }
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);  // { type:'new'|'old', mode:'add'|'edit', id }
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);  // { id, type:'new'|'old' }
  const [job, setJob] = useState(null);  // publish/revert progress job

  /* ── fetch versions + per-version publish status ── */
  const loadStatuses = () =>
    api.post(PV_API, mk({ action: 'all_status' }), FH)
      .then(r => { if (r.data.status === 'success') setStatuses(r.data.data || {}); })
      .catch(() => { });

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      api.get(API).then(res => {
        if (res.data.status === 'success') {
          setOldRows(res.data.old || []);
        }
      }).catch(() => toast.error('Failed to load')),
      loadStatuses(),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  /* ── open modals ── */
  const openAdd = (type) => {
    setForm(type === 'new' ? { ...emptyNew } : { ...emptyOld });
    setModal({ type, mode: 'add' });
  };
  const openEdit = (type, row) => {
    setForm({ ...row });
    setModal({ type, mode: 'edit', id: row.id });
  };

  /* ── save (add or update) ── */
  const handleSave = async () => {
    const isNew = modal.type === 'new';
    const isEdit = modal.mode === 'edit';
    const action = isNew
      ? (isEdit ? 'update_cit_version2' : 'add_cit_version2')
      : (isEdit ? 'update_cit_version' : 'add_cit_version');

    setSaving(true);
    try {
      const res = await api.post(API, mk({ action, ...form }), FH);
      if (res.data.status === 'success') {
        toast.success(res.data.message); setModal(null); fetchAll();
      } else { toast.error(res.data.message || 'Failed'); }
    } catch { toast.error('Error'); }
    finally { setSaving(false); }
  };

  /* ── delete ── */
  const execDelete = async () => {
    const { id, type } = confirm;
    const action = type === 'new' ? 'delete_cit_version2' : 'delete_cit_version';
    setConfirm(null);
    try {
      const res = await api.post(API, mk({ action, id }), FH);
      if (res.data.status === 'success') {
        toast.success(res.data.message);
        // refetch: deleting the latest resets the previous row's to_date + current version
        fetchAll();
      } else { toast.error(res.data.message || 'Failed'); }
    } catch { toast.error('Error'); }
  };

  /* ── download report ── */
  const downloadNew = (row) =>
    window.open(`/download/download_data.php?type=simplified_complete_data_new&cit_ids=${row.id}`, '_blank');
  const downloadOld = (row) =>
    window.open(`/download/download_data.php?type=simplified_complete_data&version=${row.exam_name}`, '_blank');

  const fieldChange = (k, v) => setForm(p => ({ ...p, [k]: v }));

  /* ══════════ PUBLISH (batched loop, 500/packet) ══════════ */
  const startPublish = async (cit_version) => {
    setJob({
      kind: 'publish', cit_version, total: 0, processed: 0, added: 0, skipped: 0,
      percent: 0, done: false, running: true, error: null, batch_id: 0
    });
    let batch_id = 0, offset = 0, total = 0, added = 0, skipped = 0;
    try {
      // first packet establishes total; keep going until done
      // (do-while so a version with <500 users still runs one packet)
      while (true) {
        const r = await api.post(PV_API,
          mk({ action: 'publish_batch', cit_version, offset, limit: PACKET, round: 1, batch_id }),
          { ...FH, timeout: 120000 });
        if (r.data.status !== 'success') throw new Error(r.data.message || 'Publish failed');
        const d = r.data.data;
        batch_id = d.batch_id; total = d.total;
        added += d.added; skipped += d.skipped;
        const processed = Math.min(total, offset + d.processed);
        setJob(j => ({
          ...j, batch_id, total, processed, added, skipped,
          percent: total ? (processed / total * 100) : 100, done: d.done
        }));
        if (d.done) break;
        offset = d.next_offset;
      }
      // real-time: flip the row to the Published badge immediately
      setStatuses(prev => ({
        ...prev,
        [cit_version]: {
          ...(prev[cit_version] || {}), total, published: added,
          skipped: Math.max(0, total - added), is_published: true, batch_id
        }
      }));
      setJob(j => ({ ...j, running: false, done: true }));
      toast.success(`${cit_version} published (${added} added, ${skipped} skipped)`);
    } catch (e) {
      setJob(j => ({ ...j, running: false, error: e.message || 'Publish failed' }));
    } finally {
      loadStatuses();
    }
  };

  /* ── publish only the skipped users of the current in-modal job ── */
  const publishSkipped = async () => {
    if (!job?.batch_id) return;
    setJob(j => ({ ...j, running: true, error: null, isSkip: true }));
    try {
      const r = await api.post(PV_API,
        mk({ action: 'publish_skipped', cit_version: job.cit_version, batch_id: job.batch_id, round: 1 }),
        { ...FH, timeout: 180000 });
      if (r.data.status !== 'success') throw new Error(r.data.message || 'Failed');
      const d = r.data.data;
      setJob(j => ({
        ...j, running: false, added: j.added + d.added, skipped: d.skipped,
        already: d.already_published || 0,
        processed: d.published, total: d.total, percent: d.total ? (d.published / d.total * 100) : 100
      }));
      toast.success(`Published ${d.added} more (${d.already_published || 0} already published, ${d.skipped} still skipped)`);
    } catch (e) {
      setJob(j => ({ ...j, running: false, error: e.message || 'Failed' }));
    } finally {
      loadStatuses();
    }
  };

  /* ── publish the skipped users of an ALREADY-published row (uses its existing batch) ── */
  const startSkipped = async (cit_version, batch_id) => {
    const st = statuses[cit_version] || {};
    setJob({
      kind: 'publish', isSkip: true, cit_version, batch_id, total: st.total || 0, processed: st.published || 0,
      added: 0, skipped: st.skipped || 0, already: 0, done: false, running: true, error: null,
      percent: st.total ? (st.published / st.total * 100) : 0
    });
    try {
      const r = await api.post(PV_API,
        mk({ action: 'publish_skipped', cit_version, batch_id, round: 1 }),
        { ...FH, timeout: 180000 });
      if (r.data.status !== 'success') throw new Error(r.data.message || 'Failed');
      const d = r.data.data;
      // real-time: update the row's published / skipped counts
      setStatuses(prev => ({
        ...prev,
        [cit_version]: {
          ...(prev[cit_version] || {}), total: d.total, published: d.published,
          skipped: d.skipped, is_published: d.published > 0, batch_id
        }
      }));
      setJob(j => ({
        ...j, running: false, done: true, added: d.added, skipped: d.skipped,
        already: d.already_published || 0,
        processed: d.published, total: d.total, percent: d.total ? (d.published / d.total * 100) : 100
      }));
      toast.success(`Published ${d.added} more (${d.already_published || 0} already published, ${d.skipped} still skipped)`);
    } catch (e) {
      setJob(j => ({ ...j, running: false, error: e.message || 'Failed' }));
    } finally {
      loadStatuses();
    }
  };

  /* ══════════ REVERT (guard check, then batched delete) ══════════ */
  const startRevert = async (cit_version) => {
    setJob({
      kind: 'revert', cit_version, total: 0, processed: 0, added: 0, skipped: 0,
      percent: 0, done: false, running: true, error: null, batch_id: 0
    });
    try {
      const chk = await api.post(PV_API, mk({ action: 'revert_check', cit_version }), FH);
      if (chk.data.status !== 'success') throw new Error(chk.data.message || 'Check failed');
      const c = chk.data.data;
      if (c.blocker) throw new Error(`Delete/revert ${c.blocker} first — a newer version is still published.`);
      if (!c.can_revert || !c.batch_id) throw new Error('Nothing to revert for this version.');

      const total = c.published;
      let reverted = 0;
      setJob(j => ({ ...j, batch_id: c.batch_id, total }));

      while (true) {
        const r = await api.post(PV_API,
          mk({ action: 'revert_batch', cit_version, limit: PACKET }),
          { ...FH, timeout: 120000 });
        if (r.data.status !== 'success') throw new Error(r.data.message || 'Revert failed');
        const d = r.data.data;
        reverted += d.reverted;
        const processed = Math.min(total, reverted);
        setJob(j => ({
          ...j, added: reverted, processed,
          percent: total ? (processed / total * 100) : 100, done: d.done
        }));
        if (d.done) break;
        if (d.reverted === 0) break;   // safety: nothing deleted this round
      }
      // real-time: flip the row back to unpublished immediately
      setStatuses(prev => ({
        ...prev,
        [cit_version]: { ...(prev[cit_version] || {}), published: 0, skipped: 0, is_published: false, batch_id: 0 }
      }));
      setJob(j => ({ ...j, running: false, done: true, percent: 100 }));
      toast.success(`${cit_version} reverted (${reverted} rows removed)`);
    } catch (e) {
      setJob(j => ({ ...j, running: false, error: e.message || 'Revert failed' }));
    } finally {
      loadStatuses();
    }
  };

  /* ── decide latest + next-to-publish among OLD rows ── */
  const oldNums = oldRows.map(r => citNum(r.exam_name));
  const latestNum = oldNums.length ? Math.max(...oldNums) : 0;
  // newest non-latest version that is NOT yet published
  const nextNum = oldRows.reduce((acc, r) => {
    const n = citNum(r.exam_name);
    if (n === latestNum) return acc;
    if (statuses[r.exam_name]?.is_published) return acc;
    return Math.max(acc, n);
  }, 0);
  // only the newest PUBLISHED version can be reverted (sequential, newest→oldest)
  const revertableNum = oldRows.reduce((acc, r) => {
    const n = citNum(r.exam_name);
    if (n === latestNum) return acc;
    if (!statuses[r.exam_name]?.is_published) return acc;
    return Math.max(acc, n);
  }, 0);

  /* ── render the ACTION cell for an OLD row ── */
  const renderOldActions = (row) => {
    const num = citNum(row.exam_name);
    const st = statuses[row.exam_name];

    // 1) latest version -> keep Edit / Delete / Report
    if (num === latestNum) {
      return (
        <>
          <button onClick={() => openEdit('old', row)}
            style={{ ...btnBase, background: '#fef9c3', color: '#b45309', border: '1.5px solid #fde68a' }}>✏️ Edit</button>
          <button onClick={() => setConfirm({ id: row.id, type: 'old' })}
            style={{ ...btnBase, background: '#fee2e2', color: '#dc2626', border: '1.5px solid #fecaca' }}>🗑 Delete</button>
          <button onClick={() => downloadOld(row)}
            style={{ ...btnBase, background: '#dcfce7', color: '#16a34a', border: '1.5px solid #bbf7d0', marginRight: 0 }}>⬇️ Report</button>
        </>
      );
    }

    // 2) already published -> Published badge (+counts). Skip count on ALL rows;
    //    Revert only on the newest-published row (sequential revert order).
    if (st?.is_published) {
      const skipped = st.skipped || 0;
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
            background: '#dcfce7', color: '#15803d', border: '1.5px solid #bbf7d0', borderRadius: 99,
            fontSize: 10.5, fontWeight: 700
          }}>
            ✅ Published
            <span style={{ background: '#16a34a', color: '#fff', borderRadius: 99, padding: '0 6px' }}>{st.published.toLocaleString()}</span>
          </span>
          {skipped > 0 ? (
            <button title="Publish the skipped students"
              onClick={() => startSkipped(row.exam_name, st.batch_id)}
              style={{ ...btnBase, marginRight: 0, background: '#eef2ff', color: '#4f46e5', border: '1.5px solid #c7d2fe' }}>
              ⏭ {skipped.toLocaleString()} skipped
            </button>
          ) : (
            <span title="No skipped students"
              style={{
                ...btnBase, marginRight: 0, cursor: 'default', background: '#f1f5f9',
                color: '#94a3b8', border: '1.5px solid #e2e8f0'
              }}>
              ⏭ 0 skipped
            </span>
          )}
          {num === revertableNum && (
            <button onClick={() => startRevert(row.exam_name)}
              style={{ ...btnBase, marginRight: 0, background: '#fee2e2', color: '#dc2626', border: '1.5px solid #fecaca' }}>
              ↩️ Revert
            </button>
          )}
        </span>
      );
    }

    // 3) the single next-to-publish version -> Publish Result
    if (num === nextNum) {
      return (
        <button onClick={() => startPublish(row.exam_name)}
          style={{
            ...btnBase, marginRight: 0, padding: '5px 14px', color: '#fff',
            background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none'
          }}>
          🚀 Publish Result
        </button>
      );
    }

    // 4) everything else -> no action
    return <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>;
  };

  /* ── table renderer ── */
  const renderTable = (rows, cols, type, addLabel, dataKeys) => (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1.5px solid #ede9fe',
      boxShadow: '0 1px 8px rgba(79,70,229,.05)', overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1.5px solid #ede9fe'
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>
          {type === 'new' ? '🆕 CIT Versions (New)' : '📁 CIT Versions (Old)'}
        </span>
        <button onClick={() => openAdd(type)}
          style={{
            padding: '7px 16px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', color: '#fff', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)'
          }}>
          + {addLabel}
        </button>
      </div>
      <div style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            <tr style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
              {[...cols, 'Action'].map(h => <th key={h} style={thS}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={cols.length + 1} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>
                Loading...
              </td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={cols.length + 1} style={{ textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: 12.5 }}>
                No versions found
              </td></tr>
            ) : rows.map(row => (
              <tr key={row.id} style={{ cursor: 'default' }}
                onMouseEnter={e => [...e.currentTarget.cells].forEach(c => c.style.background = '#faf9ff')}
                onMouseLeave={e => [...e.currentTarget.cells].forEach(c => c.style.background = '')}>
                {/* {dataKeys.map(k => {
                  const v = row[k];
                  const isTs = k === 'from_date' || k === 'to_date';
                  return (
                    <td key={k} style={tdS}>
                      {v || (isTs
                        ? <span style={{ color:'#cbd5e1', fontStyle:'italic' }}>null</span>
                        : '—')}
                    </td>
                  );
                })} */}
                {dataKeys.map(k => {
                  let v = row[k];
                  const isTs = k === 'from_date' || k === 'to_date';

                  if (isTs && v) {
                    const [date, time] = v.split(' ');

                    v =
                      time && time !== '00:00:00'
                        ? (
                          <>
                            {date}
                            <br />
                            {time}
                          </>
                        )
                        : date;
                  }

                  return (
                    <td key={k} style={tdS}>
                      {v || (
                        isTs
                          ? <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>null</span>
                          : '—'
                      )}
                    </td>
                  );
                })}
                <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                  {type === 'new' ? (
                    <>
                      <button onClick={() => openEdit('new', row)}
                        style={{ ...btnBase, background: '#fef9c3', color: '#b45309', border: '1.5px solid #fde68a' }}>✏️ Edit</button>
                      <button onClick={() => setConfirm({ id: row.id, type: 'new' })}
                        style={{ ...btnBase, background: '#fee2e2', color: '#dc2626', border: '1.5px solid #fecaca' }}>🗑 Delete</button>
                      <button onClick={() => downloadNew(row)}
                        style={{ ...btnBase, background: '#dcfce7', color: '#16a34a', border: '1.5px solid #bbf7d0', marginRight: 0 }}>⬇️ Report</button>
                    </>
                  ) : renderOldActions(row)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ════════ RENDER ════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .cv-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        @keyframes cv_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="cv-root" style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100vh - 62px)',
        padding: 20, gap: 14, overflow: 'hidden', background: '#f5f3ff',
      }}>

        {/* ── HEADER ── */}
        {/* <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ fontSize:17, fontWeight:800, color:'#1e293b' }}>🎓 CIT Versions</div>
          <button onClick={() => window.open('/admin/seed_result_new.php', '_blank')}
            style={{ padding:'8px 18px', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700,
              cursor:'pointer', color:'#fff', background:'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
            🚀 Publish Result
          </button>
        </div> */}

        {/* ── TWO TABLES ── */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {renderTable(oldRows,
            ['Exam Name', 'From Date', 'To Date', 'Result Date', 'Certificate Date', 'Exam Start', 'Exam End', 'WA Initials'],
            'old', 'Add CIT Version (Old)',
            ['exam_name', 'from_date', 'to_date', 'result_date', 'certificate_date', 'exam_start_date', 'exam_end_date', 'wa_community_initials']
          )}
        </div>
      </div>

      {/* ── ADD / EDIT MODAL ── */}
      {modal && (
        <VersionModal
          title={`${modal.mode === 'edit' ? '✏️ Edit' : '➕ Add'} ${modal.type === 'new' ? 'CIT Version (New)' : 'CIT Version (Old)'}`}
          fields={modal.type === 'new' ? NEW_FIELDS : OLD_FIELDS}
          form={form}
          onChange={fieldChange}
          onSave={handleSave}
          onClose={() => setModal(null)}
          saving={saving}
        />
      )}

      {/* ── CONFIRM DELETE MODAL ── */}
      {confirm && (
        <Confirm
          msg={`Are you sure you want to delete this CIT version? This cannot be undone.`}
          onOk={execDelete}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* ── PUBLISH / REVERT PROGRESS MODAL ── */}
      {job && (
        <ProgressModal
          job={job}
          onClose={() => setJob(null)}
          onPublishSkipped={publishSkipped}
        />
      )}
    </>
  );
}
