// ===========================================================================
//  LmsEnrollments.jsx — the "Enrollments" tab.
//
//  Who has access to which course, with live progress. Supports a single
//  enroll, a bulk enroll (pick a course, then either paste learner ids or pull
//  every buyer of an internship straight from internship_payment), plus
//  revoke / expiry edits.
// ===========================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Search, Plus, GraduationCap, ChevronLeft, ChevronRight, Trash2, Pencil, Users,
  SlidersHorizontal,
} from 'lucide-react';
import { LMS, money, shortDate } from './lmsApi';
import { Loader, Empty, Pill, Drawer, Confirm } from './LmsStyles';

const PAGE_SIZES = [30, 50, 100];

/* Where a row came from. 'lms' rows are the only ones this panel owns and can
   edit; the rest are read-only records of a purchase that happened elsewhere. */
const SOURCES = [
  { key: 'all',        label: 'Everything' },
  { key: 'lms',        label: 'LMS enrollments' },
  { key: 'internship', label: 'Internship payments' },
  { key: 'store',      label: '99 store orders' },
];

const KIND_LABEL = { lms: 'LMS', internship: 'Internship', store: '99 store', admin: 'Added by us' };
const KIND_TONE  = { lms: 'grey', internship: 'blue', store: 'green', admin: 'amber' };

/* status is deliberately absent: the endpoint defaults to completed
   purchases (and active LMS grants), and this screen never widens it. */
const emptyFilters = {
  source: 'all', access_type: '', provider: '',
  from: '', to: '', min_amount: '', sort: 'recent',
};

export default function LmsEnrollments() {
  const [params, setParams] = useSearchParams();

  const [filters, setFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [opts, setOpts] = useState({ courses: [], providers: [] });

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [courseId, setCourseId] = useState(params.get('course_id') || '');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(30);

  const [courses, setCourses] = useState([]);
  const [learners, setLearners] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState({ course_id: '', user_id: '', access_type: 'paid', amount: 0, expiry_date: '' });
  const [bulk, setBulk] = useState({ course_id: '', internship: '', access_type: 'paid', amount: 0 });
  const [learnerQuery, setLearnerQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setSearch(q.trim()); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await LMS.listEnrollments({
        ...filters, course_id: courseId, q: search, limit, offset: page * limit,
      });
      setRows(d.enrollments || []);
      setTotal(d.total || 0);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters, courseId, search, limit, page]);

  const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(0); };
  const activeFilterCount = Object.entries(filters)
    .filter(([k, v]) => v !== '' && v !== emptyFilters[k]).length;

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    LMS.listCourses({ status: 'all' }).then(d => setCourses(d.courses || [])).catch(() => {});
    /* Gateways come from the same one-shot endpoint the Users filter bar uses. */
    LMS.learnerFilters().then(setOpts).catch(() => {});
  }, []);

  /* learner picker for the single-enroll drawer */
  useEffect(() => {
    if (!addOpen) return;
    const t = setTimeout(() => {
      LMS.listLearners({ scope: 'all', q: learnerQuery.trim(), limit: 20 })
        .then(d => setLearners(d.learners || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [addOpen, learnerQuery]);

  const enroll = async () => {
    if (!draft.course_id || !draft.user_id) return toast.error('Pick both a course and a learner');
    setSaving(true);
    try {
      await LMS.createEnrollment({ ...draft, amount: Number(draft.amount || 0) });
      toast.success('Learner enrolled');
      setAddOpen(false);
      setDraft({ course_id: '', user_id: '', access_type: 'paid', amount: 0, expiry_date: '' });
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const runBulk = async () => {
    if (!bulk.course_id) return toast.error('Pick a course');
    if (!bulk.internship.trim()) return toast.error('Enter the internship name to pull buyers from');
    setSaving(true);
    try {
      const d = await LMS.bulkEnroll({ ...bulk, amount: Number(bulk.amount || 0) });
      toast.success(`${d.enrolled} learner(s) enrolled`);
      setBulkOpen(false);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await LMS.updateEnrollment({
        id: editing.id,
        status: editing.status,
        access_type: editing.access_type,
        amount: Number(editing.amount || 0),
        expiry_date: editing.expiry_date || '',
      });
      toast.success('Enrollment updated');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const from = total === 0 ? 0 : page * limit + 1;
  const to = Math.min(total, (page + 1) * limit);

  return (
    <div className="lms-page">
      <div className="lms-page-head">
        <div>
          <h1 className="lms-h1">Learner Enrollments</h1>
          <p className="lms-sub">
          Completed purchases and active course grants — LMS enrollments, internship payments and
          ₹99-store orders in one list.
        </p>
        </div>
        <div className="lms-page-actions">
          <button className="lms-btn lms-btn-ghost" onClick={() => setBulkOpen(true)}>
            <Users size={16} /> Bulk enroll
          </button>
          <button className="lms-btn lms-btn-dark" onClick={() => setAddOpen(true)}>
            <Plus size={17} /> Enroll learner
          </button>
        </div>
      </div>

      <div className="lms-toolbar">
        <div className="lms-search">
          <Search size={16} />
          <input placeholder="Search by email or name" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="lms-segment">
          {SOURCES.map(sc => (
            <button key={sc.key} className={filters.source === sc.key ? 'active' : ''}
              onClick={() => setFilter('source', sc.key)}>
              {sc.label}
            </button>
          ))}
        </div>
        <select
          className="lms-select"
          style={{ width: 220 }}
          value={courseId}
          onChange={e => {
            setCourseId(e.target.value);
            setPage(0);
            const next = new URLSearchParams(params);
            if (e.target.value) next.set('course_id', e.target.value); else next.delete('course_id');
            setParams(next, { replace: true });
          }}
        >
          <option value="">All LMS courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <button
          className={`lms-btn ${showFilters || activeFilterCount ? 'lms-btn-ghost' : 'lms-btn-quiet'}`}
          onClick={() => setShowFilters(v => !v)}
        >
          <SlidersHorizontal size={15} /> Filters
          {activeFilterCount > 0 && <Pill tone="green">{activeFilterCount}</Pill>}
        </button>
        {activeFilterCount > 0 && (
          <button className="lms-btn lms-btn-quiet" onClick={() => { setFilters(emptyFilters); setPage(0); }}>
            Clear all
          </button>
        )}
      </div>

      {showFilters && (
        <div className="lms-card lms-card-pad" style={{ marginBottom: 20 }}>
          <div className="lms-filter-grid">
            <div className="lms-field" style={{ margin: 0 }}>
              <label className="lms-label">Access type</label>
              <select className="lms-select" value={filters.access_type}
                onChange={e => setFilter('access_type', e.target.value)}>
                <option value="">Any</option>
                <option value="paid">Paid</option>
                <option value="free">Free</option>
                <option value="trial">Trial</option>
              </select>
              <p className="lms-help">Purchases are always paid.</p>
            </div>

            <div className="lms-field" style={{ margin: 0 }}>
              <label className="lms-label">Payment gateway</label>
              <select className="lms-select" value={filters.provider}
                onChange={e => setFilter('provider', e.target.value)}>
                <option value="">Any gateway</option>
                {(opts.providers || []).map(pr => (
                  <option key={pr} value={pr}>{pr.charAt(0).toUpperCase() + pr.slice(1)}</option>
                ))}
              </select>
              <p className="lms-help">Narrows to ₹99-store orders.</p>
            </div>

            <div className="lms-field" style={{ margin: 0 }}>
              <label className="lms-label">Minimum amount</label>
              <input className="lms-input" type="number" min="0" placeholder="0"
                value={filters.min_amount} onChange={e => setFilter('min_amount', e.target.value)} />
            </div>

            <div className="lms-field" style={{ margin: 0 }}>
              <label className="lms-label">From date</label>
              <input className="lms-input" type="date" value={filters.from}
                onChange={e => setFilter('from', e.target.value)} />
            </div>

            <div className="lms-field" style={{ margin: 0 }}>
              <label className="lms-label">Until date</label>
              <input className="lms-input" type="date" value={filters.to}
                onChange={e => setFilter('to', e.target.value)} />
            </div>

            <div className="lms-field" style={{ margin: 0 }}>
              <label className="lms-label">Sort by</label>
              <select className="lms-select" value={filters.sort}
                onChange={e => setFilter('sort', e.target.value)}>
                <option value="recent">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="amount">Highest amount</option>
                <option value="name">Name (A–Z)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="lms-table-wrap">
        <div className="lms-pager">
          <span>{total.toLocaleString('en-IN')} enrollments</span>
          <span style={{ marginLeft: 'auto' }}>Rows per page</span>
          <select className="lms-select" style={{ width: 82, padding: '5px 10px' }}
            value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(0); }}>
            {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span>{from}–{to}</span>
          <button className="lms-icon-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft size={17} />
          </button>
          <button className="lms-icon-btn" disabled={to >= total} onClick={() => setPage(p => p + 1)}>
            <ChevronRight size={17} />
          </button>
        </div>

        {loading ? (
          <Loader inline />
        ) : rows.length === 0 ? (
          <Empty
            icon={<GraduationCap size={24} />}
            title="Nothing matches this view"
            message="Enroll a learner into a course, or clear the filters to see internship payments and ₹99-store orders too."
            action={<button className="lms-btn lms-btn-dark" onClick={() => setAddOpen(true)}><Plus size={16} /> Enroll learner</button>}
          />
        ) : (
          <div className="lms-table-scroll">
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Learner Details</th>
                  <th>Source</th>
                  <th>Course</th>
                  <th>Progress</th>
                  <th>Amount</th>
                  <th>Reference</th>
                  <th>Date</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  /* Keyed on ref (kind + id), because the three source tables
                     each have their own id sequence and would collide. */
                  <tr key={r.ref || r.id}>
                    <td>
                      <div className="lms-user-cell">
                        <div className="lms-avatar">{(r.name || r.email || '?').charAt(0)}</div>
                        <div>
                          <div className="lms-user-name">{r.name || '—'}</div>
                          <div className="lms-user-mail">{r.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Pill tone={KIND_TONE[r.kind] || 'grey'}>{KIND_LABEL[r.kind] || r.kind}</Pill>
                      <div style={{ fontSize: 11, color: 'var(--lms-text-3)', marginTop: 3, textTransform: 'capitalize' }}>
                        {r.access_type}{r.provider ? ` · ${r.provider}` : ''}
                      </div>
                    </td>
                    <td>
                      {r.course_title || '—'}
                      {r.batch && (
                        <div style={{ fontSize: 11, color: 'var(--lms-text-3)', marginTop: 3 }}>{r.batch}</div>
                      )}
                    </td>
                    <td>
                      {/* Only LMS rows have lessons to progress through — a
                          purchase record has nothing to show a bar for. */}
                      {r.kind === 'lms' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div className="lms-progress-bar"><i style={{ width: `${r.progress}%` }} /></div>
                          <span style={{ fontSize: 12, color: 'var(--lms-text-2)' }}>
                            {r.done_lessons}/{r.total_lessons}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--lms-text-3)' }}>—</span>
                      )}
                    </td>
                    <td>{money(r.amount)}</td>
                    <td style={{ fontSize: 11.5, color: 'var(--lms-text-2)', maxWidth: 190 }}>
                      {r.order_id
                        ? <span title={`${r.order_id}${r.payment_id ? ` · ${r.payment_id}` : ''}`}
                                style={{ wordBreak: 'break-all' }}>{r.order_id}</span>
                        : (r.expiry_date ? shortDate(r.expiry_date) : 'Lifetime')}
                    </td>
                    <td>{shortDate(r.enrolled_at)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {/* No status pill: the list is completed purchases and
                          active grants only, so every row would read the same. */}
                      <button className="lms-icon-btn"
                        title={r.editable ? 'Edit' : 'Purchase records are read-only here'}
                        disabled={!r.editable} onClick={() => setEditing({ ...r })}>
                        <Pencil size={15} />
                      </button>
                      <button
                        className="lms-icon-btn danger"
                        title={r.editable ? 'Remove enrollment' : 'Purchase records are read-only here'}
                        disabled={!r.editable}
                        onClick={() => setConfirm({
                          title: 'Remove this enrollment?',
                          message: `${r.name || r.email} will immediately lose access to "${r.course_title}". Their progress records stay intact.`,
                          run: async () => {
                            await LMS.deleteEnrollment(r.id);
                            toast.success('Enrollment removed');
                            setConfirm(null);
                            load();
                          },
                        })}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── single enroll ─────────────────────────────────────── */}
      <Drawer
        open={addOpen}
        title="Enroll a learner"
        subtitle="Grant course access to an existing account"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <button className="lms-btn lms-btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
            <button className="lms-btn lms-btn-dark" onClick={enroll} disabled={saving}>
              {saving ? 'Enrolling…' : 'Enroll'}
            </button>
          </>
        }
      >
        <div className="lms-field">
          <label className="lms-label">Course<span className="req">*</span></label>
          <select className="lms-select" value={draft.course_id}
            onChange={e => setDraft(d => ({ ...d, course_id: e.target.value }))}>
            <option value="">Select course</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>

        <div className="lms-field">
          <label className="lms-label">Find learner<span className="req">*</span></label>
          <input className="lms-input" placeholder="Search by email or name"
            value={learnerQuery} onChange={e => setLearnerQuery(e.target.value)} />
          <div style={{ maxHeight: 230, overflowY: 'auto', marginTop: 10, border: '1px solid var(--lms-border)', borderRadius: 8 }}>
            {learners.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12.5, color: 'var(--lms-text-3)', textAlign: 'center' }}>
                {learnerQuery ? 'No matches' : 'Start typing to search learners'}
              </div>
            ) : learners.map(l => {
              const on = String(draft.user_id) === String(l.user_id);
              return (
                <button
                  key={l.user_id}
                  onClick={() => setDraft(d => ({ ...d, user_id: l.user_id }))}
                  style={{
                    display: 'flex', width: '100%', gap: 10, alignItems: 'center', padding: '10px 12px',
                    borderBottom: '1px solid var(--lms-border)', textAlign: 'left',
                    background: on ? 'var(--lms-green-soft)' : 'transparent',
                  }}
                >
                  <div className="lms-avatar" style={{ width: 28, height: 28, fontSize: 12 }}>
                    {(l.name || l.email || '?').charAt(0)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{l.name || '—'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--lms-text-2)' }}>{l.email}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lms-row-3">
          <div className="lms-field">
            <label className="lms-label">Access type</label>
            <select className="lms-select" value={draft.access_type}
              onChange={e => setDraft(d => ({ ...d, access_type: e.target.value }))}>
              <option value="paid">Paid</option>
              <option value="free">Free</option>
              <option value="trial">Trial</option>
            </select>
          </div>
          <div className="lms-field">
            <label className="lms-label">Amount</label>
            <input className="lms-input" type="number" min="0" value={draft.amount}
              onChange={e => setDraft(d => ({ ...d, amount: e.target.value }))} />
          </div>
          <div className="lms-field">
            <label className="lms-label">Expiry</label>
            <input className="lms-input" type="date" value={draft.expiry_date}
              onChange={e => setDraft(d => ({ ...d, expiry_date: e.target.value }))} />
            <p className="lms-help">Blank uses the course's own validity window.</p>
          </div>
        </div>
      </Drawer>

      {/* ── bulk enroll from internship buyers ────────────────── */}
      <Drawer
        open={bulkOpen}
        title="Bulk enroll"
        subtitle="Pull every buyer of an internship into a course"
        onClose={() => setBulkOpen(false)}
        footer={
          <>
            <button className="lms-btn lms-btn-ghost" onClick={() => setBulkOpen(false)}>Cancel</button>
            <button className="lms-btn lms-btn-dark" onClick={runBulk} disabled={saving}>
              {saving ? 'Enrolling…' : 'Run bulk enroll'}
            </button>
          </>
        }
      >
        <div className="lms-field">
          <label className="lms-label">Course<span className="req">*</span></label>
          <select className="lms-select" value={bulk.course_id}
            onChange={e => setBulk(b => ({ ...b, course_id: e.target.value }))}>
            <option value="">Select course</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div className="lms-field">
          <label className="lms-label">Internship name<span className="req">*</span></label>
          <input className="lms-input" placeholder="e.g. Data Analytics"
            value={bulk.internship} onChange={e => setBulk(b => ({ ...b, internship: e.target.value }))} />
          <p className="lms-help">
            Must match the <code>internship</code> value in internship_payment exactly. Every distinct buyer of that
            internship gets enrolled; anyone already enrolled is left as-is.
          </p>
        </div>
        <div className="lms-row-2">
          <div className="lms-field">
            <label className="lms-label">Access type</label>
            <select className="lms-select" value={bulk.access_type}
              onChange={e => setBulk(b => ({ ...b, access_type: e.target.value }))}>
              <option value="paid">Paid</option>
              <option value="free">Free</option>
              <option value="trial">Trial</option>
            </select>
          </div>
          <div className="lms-field">
            <label className="lms-label">Amount per learner</label>
            <input className="lms-input" type="number" min="0" value={bulk.amount}
              onChange={e => setBulk(b => ({ ...b, amount: e.target.value }))} />
          </div>
        </div>
      </Drawer>

      {/* ── edit enrollment ───────────────────────────────────── */}
      <Drawer
        open={!!editing}
        title="Edit enrollment"
        subtitle={editing?.email}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button className="lms-btn lms-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button className="lms-btn lms-btn-dark" onClick={saveEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        {editing && (
          <>
            <div className="lms-row-2">
              <div className="lms-field">
                <label className="lms-label">Status</label>
                <select className="lms-select" value={editing.status}
                  onChange={e => setEditing(s => ({ ...s, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="revoked">Revoked</option>
                </select>
              </div>
              <div className="lms-field">
                <label className="lms-label">Access type</label>
                <select className="lms-select" value={editing.access_type}
                  onChange={e => setEditing(s => ({ ...s, access_type: e.target.value }))}>
                  <option value="paid">Paid</option>
                  <option value="free">Free</option>
                  <option value="trial">Trial</option>
                </select>
              </div>
            </div>
            <div className="lms-row-2">
              <div className="lms-field">
                <label className="lms-label">Amount</label>
                <input className="lms-input" type="number" min="0" value={editing.amount}
                  onChange={e => setEditing(s => ({ ...s, amount: e.target.value }))} />
              </div>
              <div className="lms-field">
                <label className="lms-label">Expiry date</label>
                <input className="lms-input" type="date" value={editing.expiry_date || ''}
                  onChange={e => setEditing(s => ({ ...s, expiry_date: e.target.value }))} />
              </div>
            </div>
          </>
        )}
      </Drawer>

      <Confirm
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Remove"
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.run()}
      />
    </div>
  );
}
