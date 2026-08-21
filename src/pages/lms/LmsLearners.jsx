// ===========================================================================
//  LmsLearners.jsx — the "Users" tab (Learnyst → Users → Learners).
//
//  The learner pool IS the platform's existing `users` table. By default we
//  show everyone who already bought an internship (internship_payment) or who
//  is enrolled in an LMS course; the source switch widens that to every
//  registered user.
//
//  "+ Add" registers a genuinely new user (same insert as the public
//  registration API) and optionally enrolls them in a course in the same step.
//  "More → Import Learners" opens the CSV wizard.
// ===========================================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Search, Plus, ChevronDown, Users, Upload, History, Send, Eye, SlidersHorizontal,
  ChevronLeft, ChevronRight, CheckCircle2, GraduationCap, ClipboardList,
} from 'lucide-react';
import { LMS, shortDate } from './lmsApi';
import { Loader, Empty, Pill, Drawer, Modal } from './LmsStyles';
import LmsCombobox from './LmsCombobox';
import { useOutsideClose } from './lmsTheme';
import LmsImportLearners from './LmsImportLearners';

/* The population to show. These map 1:1 onto the API's `source` param;
   the wording is the admin's, not the schema's — "99 courses" is the
   ₹99 store, "Added by us" is anything this panel created. */
const SOURCES = [
  { key: 'all',        label: 'Everyone' },
  { key: 'store',      label: '99 courses' },
  { key: 'internship', label: 'Internship courses' },
  { key: 'admin',      label: 'Added by us' },
  { key: 'lms',        label: 'LMS enrolled' },
  { key: 'registered', label: 'All registered' },
];

const PAGE_SIZES = [30, 50, 100];

const SOURCE_LABEL = {
  internship: 'Internship', store: '99 course', admin: 'Added by us', lms: 'LMS',
};
const SOURCE_TONE = {
  internship: 'blue', store: 'green', admin: 'amber', lms: 'grey',
};

/* Everything the filter bar can narrow by. Kept as one object so
   "Clear all" is a single assignment and the loader has one dependency. */
const emptyFilters = {
  source: 'all', internship: '', course_id: '', pay_status: '', provider: '',
  account: '', active: '', from: '', to: '', sort: 'recent',
};

/* 123@istudio is the shared default the team hands out; the admin can
   overwrite it per learner before saving. */
export const DEFAULT_LEARNER_PASSWORD = '123@istudio';

const emptyLearner = {
  email: '', name: '', phone: '', state: '',
  password: DEFAULT_LEARNER_PASSWORD,
  create_account: true,
  course_name: '', batch: '', amount: 0, order_status: 'success',
  course_id: '', access_type: 'trial', expiry_date: '',
};

export default function LmsLearners() {
  const [params] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [learners, setLearners] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [opts, setOpts] = useState({ internships: [], courses: [], providers: [], store_courses: [] });
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(30);

  const [courses, setCourses] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState(emptyLearner);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);      // { email, password }

  const [importOpen, setImportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [detail, setDetail] = useState(null);

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  useOutsideClose(moreRef, () => setMoreOpen(false), moreOpen);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(q.trim()); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await LMS.listLearners({
        ...filters,
        q: search,
        limit,
        offset: page * limit,
        course_id: filters.course_id || params.get('course_id') || '',
      });
      setLearners(d.learners || []);
      setTotal(d.total || 0);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters, search, limit, page, params]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    LMS.listCourses({ status: 'all' })
      .then(d => setCourses(d.courses || []))
      .catch(() => { /* the picker just stays empty */ });

    /* One request for every dropdown in the filter bar. Deriving these
       DISTINCTs inside the list query would repeat them on every
       keystroke of the search box for no gain. */
    LMS.learnerFilters()
      .then(setOpts)
      .catch(() => { /* filters degrade to free text */ });
  }, []);

  const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(0); };
  const activeFilterCount = Object.entries(filters)
    .filter(([k, v]) => v !== '' && v !== emptyFilters[k]).length;

  const addLearner = async () => {
    if (!draft.email.trim()) return toast.error('Learner email is required');
    if (!draft.name.trim()) return toast.error('Learner full name is required');
    setSaving(true);
    try {
      const d = await LMS.createLearner({
        ...draft,
        create_account: draft.create_account ? '1' : '0',
        course_id: draft.course_id ? Number(draft.course_id) : 0,
        amount: Number(draft.amount || 0),
      });
      setAddOpen(false);
      /* Only show the password panel when an account was actually made —
         there is nothing to sign in with otherwise. */
      if (d.password) {
        setCreated({ email: draft.email, password: d.password });
      }
      toast.success(d._message || 'Saved');
      setDraft(emptyLearner);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async () => {
    setHistoryOpen(true);
    try {
      const d = await LMS.importHistory();
      setHistory(d.imports || []);
    } catch (e) { toast.error(e.message); }
  };

  const openDetail = async (userId) => {
    setDetail({ loading: true });
    try {
      const d = await LMS.getLearner(userId);
      setDetail({ ...d, loading: false });
    } catch (e) {
      toast.error(e.message);
      setDetail(null);
    }
  };

  const from = total === 0 ? 0 : page * limit + 1;
  const to = Math.min(total, (page + 1) * limit);

  return (
    <div className="lms-page">
      <div className="lms-page-head">
        <div>
          <h1 className="lms-h1">All Learners</h1>
          <p className="lms-sub">
            Every unique person who <b>paid</b> for an internship or a ₹99 course, was enrolled in an
            LMS course, or was added from this panel — shown once, however many of those apply.
          </p>
        </div>

        <div className="lms-page-actions">
          <div style={{ position: 'relative' }} ref={moreRef}>
            <button className="lms-btn lms-btn-ghost" onClick={() => setMoreOpen(o => !o)}>
              More <ChevronDown size={15} />
            </button>
            {moreOpen && (
              <div className="lms-menu" onClick={() => setMoreOpen(false)}>
                <button onClick={() => setImportOpen(true)}><Upload size={15} /> Import Learners</button>
                <button onClick={openHistory}><History size={15} /> Import History</button>
                <div className="lms-menu-sep" />
                <Link to="/lms/enrollments"><button><GraduationCap size={15} /> Manage enrollments</button></Link>
              </div>
            )}
          </div>
          <button className="lms-btn lms-btn-dark" onClick={() => { setDraft(emptyLearner); setAddOpen(true); }}>
            <Plus size={17} /> Add
          </button>
        </div>
      </div>

      <div className="lms-toolbar">
        <div className="lms-search">
          <Search size={16} />
          <input placeholder="Search by email, name or phone" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="lms-segment">
          {SOURCES.map(s => (
            <button key={s.key} className={filters.source === s.key ? 'active' : ''}
              onClick={() => setFilter('source', s.key)}>
              {s.label}
            </button>
          ))}
        </div>
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
              <label className="lms-label">Internship bought</label>
              <LmsCombobox
                options={opts.internships || []}
                value={filters.internship}
                onChange={v => setFilter('internship', v)}
                placeholder="Any internship"
                searchPlaceholder="Search internships…"
                emptyLabel="No internship by that name"
              />
            </div>

            <div className="lms-field" style={{ margin: 0 }}>
              <label className="lms-label">Enrolled in LMS course</label>
              <select className="lms-select" value={filters.course_id}
                onChange={e => setFilter('course_id', e.target.value)}>
                <option value="">Any course</option>
                {(opts.courses || []).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>

            <div className="lms-field" style={{ margin: 0 }}>
              <label className="lms-label">Payment status</label>
              <select className="lms-select" value={filters.pay_status}
                onChange={e => setFilter('pay_status', e.target.value)}>
                <option value="">Paid only (default)</option>
                <option value="initiated">Started but never paid</option>
                <option value="failed">Failed</option>
                <option value="any">Everyone, paid or not</option>
              </select>
              <p className="lms-help">
                Abandoned checkouts are hidden by default — there are far more of them than real buyers.
              </p>
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
              <p className="lms-help">Only ₹99-store orders record a gateway.</p>
            </div>

            <div className="lms-field" style={{ margin: 0 }}>
              <label className="lms-label">Has a login account</label>
              <select className="lms-select" value={filters.account}
                onChange={e => setFilter('account', e.target.value)}>
                <option value="">Doesn't matter</option>
                <option value="yes">Yes — can sign in</option>
                <option value="no">No — email only</option>
              </select>
            </div>

            <div className="lms-field" style={{ margin: 0 }}>
              <label className="lms-label">Account status</label>
              <select className="lms-select" value={filters.active}
                onChange={e => setFilter('active', e.target.value)}>
                <option value="">Any</option>
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>

            <div className="lms-field" style={{ margin: 0 }}>
              <label className="lms-label">Bought from</label>
              <input className="lms-input" type="date" value={filters.from}
                onChange={e => setFilter('from', e.target.value)} />
            </div>

            <div className="lms-field" style={{ margin: 0 }}>
              <label className="lms-label">Bought until</label>
              <input className="lms-input" type="date" value={filters.to}
                onChange={e => setFilter('to', e.target.value)} />
            </div>

            <div className="lms-field" style={{ margin: 0 }}>
              <label className="lms-label">Sort by</label>
              <select className="lms-select" value={filters.sort}
                onChange={e => setFilter('sort', e.target.value)}>
                <option value="recent">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name">Name (A–Z)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="lms-table-wrap">
        <div className="lms-pager">
          <span>{total.toLocaleString('en-IN')} learners</span>
          <span style={{ marginLeft: 'auto' }}>Rows per page</span>
          <select
            className="lms-select" style={{ width: 82, padding: '5px 10px' }}
            value={limit}
            onChange={e => { setLimit(Number(e.target.value)); setPage(0); }}
          >
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
        ) : learners.length === 0 ? (
          <Empty
            icon={<Users size={24} />}
            title={search ? 'No learners match that search' : 'No learners in this view'}
            message={
              search
                ? 'Try another email or name, or switch to "Everyone" and clear the filters.'
                : 'Add a learner manually, or import a CSV from the More menu.'
            }
          />
        ) : (
          <div className="lms-table-scroll">
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Learner Details</th>
                  <th>Came from</th>
                  <th>Internships</th>
                  <th>99 courses</th>
                  <th>LMS Courses</th>
                  <th>Lessons Done</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {learners.map(l => (
                  /* Keyed on ident, not user_id: a store-only buyer has no
                     user_id, so every one of them would collide on key={0}. */
                  <tr key={l.ident}>
                    <td>
                      <div className="lms-user-cell">
                        <div className="lms-avatar">{(l.name || l.email || '?').charAt(0)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div className="lms-user-name">{l.name || l.fname || '—'}</div>
                          <div className="lms-user-mail">{l.email}</div>
                          {l.phone && <div className="lms-user-mail">{l.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(l.sources || []).map(src => (
                          <Pill key={src} tone={SOURCE_TONE[src] || 'grey'}>{SOURCE_LABEL[src] || src}</Pill>
                        ))}
                        {!(l.sources || []).length && <span style={{ color: 'var(--lms-text-3)' }}>—</span>}
                      </div>
                    </td>
                    <td style={{ maxWidth: 200, fontSize: 12.5, color: 'var(--lms-text-2)' }}>
                      {l.internships
                        ? <span title={l.internships}>{String(l.internships).slice(0, 40)}{String(l.internships).length > 40 ? '…' : ''}</span>
                        : '—'}
                    </td>
                    <td style={{ maxWidth: 200, fontSize: 12.5, color: 'var(--lms-text-2)' }}>
                      {l.store_orders
                        ? <span title={l.store_courses || ''}>
                            {l.store_orders} · {String(l.store_courses || '').slice(0, 28)}
                            {String(l.store_courses || '').length > 28 ? '…' : ''}
                          </span>
                        : '—'}
                    </td>
                    <td>{l.lms_courses}</td>
                    <td>{l.lessons_done}</td>
                    <td>
                      {l.has_account
                        ? <Pill tone={Number(l.active) ? 'green' : 'grey'}>{Number(l.active) ? 'Active' : 'Inactive'}</Pill>
                        : <Pill tone="amber">No account</Pill>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="lms-icon-btn" title={l.has_account ? 'View learner' : 'No account to open'}
                        disabled={!l.has_account} onClick={() => openDetail(l.user_id)}>
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── add learner ───────────────────────────────────────── */}
      <Drawer
        open={addOpen}
        title="Add new learner"
        subtitle="Records the purchase, and optionally registers a login account"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <button className="lms-btn lms-btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
            <button className="lms-btn lms-btn-dark" onClick={addLearner} disabled={saving}>
              {saving ? 'Saving…' : 'Add new learner'}
            </button>
          </>
        }
      >
        <div className="lms-field">
          <label className="lms-label">Learner Email<span className="req">**</span></label>
          <input className="lms-input" type="email" autoFocus placeholder="Enter Learner email"
            value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} />
          <p className="lms-help">
            Already registered? We reuse that account instead of creating a duplicate.
          </p>
        </div>
        <div className="lms-field">
          <label className="lms-label">Learner Full Name<span className="req">**</span></label>
          <input className="lms-input" placeholder="Enter Learner Full Name"
            value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
        </div>
        <div className="lms-row-2">
          <div className="lms-field">
            <label className="lms-label">Phone</label>
            <input className="lms-input" placeholder="10-digit mobile"
              value={draft.phone} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))} />
          </div>
          <div className="lms-field">
            <label className="lms-label">State</label>
            <input className="lms-input" placeholder="e.g. Maharashtra"
              value={draft.state} onChange={e => setDraft(d => ({ ...d, state: e.target.value }))} />
          </div>
        </div>

        <div className="lms-field">
          <label className="lms-check">
            <input type="checkbox" checked={draft.create_account}
              onChange={e => setDraft(d => ({ ...d, create_account: e.target.checked }))} />
            Create a login account for this learner
          </label>
          <p className="lms-help">
            {draft.create_account
              ? 'They get a real account and can sign in to the learning portal.'
              : 'The purchase is recorded against the email only — no login, and the order carries no user id until they register themselves.'}
          </p>
        </div>

        {draft.create_account && (
          <div className="lms-field">
            <label className="lms-label">Password</label>
            <input className="lms-input"
              value={draft.password}
              onChange={e => setDraft(d => ({ ...d, password: e.target.value }))} />
            <p className="lms-help">
              Pre-filled with the standard password. Clear it to auto-generate a random one instead.
            </p>
          </div>
        )}

        <div className="lms-divider" />
        <h3 className="lms-h3" style={{ marginBottom: 4 }}>Purchase record</h3>
        <p className="lms-help" style={{ margin: '0 0 14px' }}>
          Saved to the ₹99 store's order table with a <b>training_…</b> order and payment id, and the
          gateway that is live in settings — so it shows up wherever a real purchase would.
        </p>

        <div className="lms-field">
          <label className="lms-label">What did they buy?</label>
          <LmsCombobox
            options={opts.catalogue || []}
            value={draft.course_name}
            onChange={v => setDraft(d => ({ ...d, course_name: v }))}
            placeholder="Pick an internship or a ₹99 course"
            searchPlaceholder="Search internships and courses…"
            emptyLabel="Nothing matches — keep typing to add it anyway"
            allowCustom
          />
          <p className="lms-help">
            Every internship plus the ₹99 courses. Not listed? Type the name and pick the
            &ldquo;Use …&rdquo; row to enter it as-is.
          </p>
        </div>

        <div className="lms-row-3">
          <div className="lms-field">
            <label className="lms-label">Batch</label>
            <input className="lms-input" list="lms-store-batches" placeholder="e.g. 01 September"
              value={draft.batch} onChange={e => setDraft(d => ({ ...d, batch: e.target.value }))} />
            <datalist id="lms-store-batches">
              {(opts.batches || []).map(b => <option key={b} value={b} />)}
            </datalist>
          </div>
          <div className="lms-field">
            <label className="lms-label">Amount paid</label>
            <input className="lms-input" type="number" min="0" step="0.01"
              value={draft.amount} onChange={e => setDraft(d => ({ ...d, amount: e.target.value }))} />
          </div>
          <div className="lms-field">
            <label className="lms-label">Order status</label>
            <select className="lms-select" value={draft.order_status}
              onChange={e => setDraft(d => ({ ...d, order_status: e.target.value }))}>
              <option value="success">Success</option>
              <option value="initiated">Initiated</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <div className="lms-divider" />
        <h3 className="lms-h3" style={{ marginBottom: 4 }}>LMS enrollment (optional)</h3>
        <p className="lms-help" style={{ margin: '0 0 14px' }}>
          {draft.create_account
            ? 'Also grant access to one of your LMS courses right away.'
            : 'Needs a login account — tick the box above to enable this.'}
        </p>

        <div className="lms-field">
          <label className="lms-label">LMS course</label>
          <select className="lms-select" value={draft.course_id} disabled={!draft.create_account}
            onChange={e => setDraft(d => ({ ...d, course_id: e.target.value }))}>
            <option value="">Don't enroll</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div className="lms-row-2">
          <div className="lms-field">
            <label className="lms-label">Access type</label>
            <select className="lms-select" value={draft.access_type} disabled={!draft.course_id}
              onChange={e => setDraft(d => ({ ...d, access_type: e.target.value }))}>
              <option value="trial">Trial</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div className="lms-field">
            <label className="lms-label">Expiry</label>
            <input className="lms-input" type="date" disabled={!draft.course_id}
              value={draft.expiry_date} onChange={e => setDraft(d => ({ ...d, expiry_date: e.target.value }))} />
          </div>
        </div>
      </Drawer>

      {/* ── credentials of the account we just made ───────────── */}
      <Modal
        open={!!created}
        title="Learner registered"
        onClose={() => setCreated(null)}
        width={440}
        footer={<button className="lms-btn lms-btn-dark" onClick={() => setCreated(null)}>Done</button>}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: 13, marginBottom: 16,
          background: 'var(--lms-green-soft)', color: 'var(--lms-green-dark)', borderRadius: 8, fontSize: 13,
        }}>
          <CheckCircle2 size={17} /> Account created on the platform.
        </div>
        <div className="lms-field">
          <label className="lms-label">Email</label>
          <input className="lms-input" readOnly value={created?.email || ''} />
        </div>
        <div className="lms-field">
          <label className="lms-label">Temporary password</label>
          <input className="lms-input" readOnly value={created?.password || ''} />
          <p className="lms-help">Share this with the learner — it's the only time it's shown.</p>
        </div>
      </Modal>

      {/* ── import history ────────────────────────────────────── */}
      <Drawer
        open={historyOpen}
        title="Import History"
        subtitle="Every learner CSV run, newest first"
        onClose={() => setHistoryOpen(false)}
      >
        {history.length === 0 ? (
          <Empty icon={<History size={22} />} title="No imports yet" message="Import a CSV and the run shows up here." />
        ) : (
          history.map(h => (
            <div key={h.id} className="lms-card lms-card-pad" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                <strong style={{ fontSize: 13.5 }}>{h.file_name}</strong>
                <span style={{ fontSize: 12, color: 'var(--lms-text-3)' }}>{shortDate(h.created_at)}</span>
              </div>
              {h.course_title && (
                <div style={{ fontSize: 12.5, color: 'var(--lms-text-2)', marginBottom: 8 }}>
                  Enrolled into <strong>{h.course_title}</strong>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Pill tone="grey">{h.total_rows} rows</Pill>
                <Pill tone="green">{h.created_rows} new</Pill>
                <Pill tone="blue">{h.existing_rows} existing</Pill>
                <Pill tone="green">{h.enrolled_rows} enrolled</Pill>
                {Number(h.failed_rows) > 0 && <Pill tone="red">{h.failed_rows} failed</Pill>}
              </div>
              {(h.errors || []).length > 0 && (
                <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--lms-red-dark)', lineHeight: 1.7 }}>
                  {h.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          ))
        )}
      </Drawer>

      {/* ── learner detail ────────────────────────────────────── */}
      <Drawer
        open={!!detail}
        title={detail?.learner ? (detail.learner.name || detail.learner.email) : 'Learner'}
        subtitle={detail?.learner?.email}
        onClose={() => setDetail(null)}
      >
        {detail?.loading ? (
          <Loader inline />
        ) : detail?.learner ? (
          <>
            <div className="lms-row-2" style={{ marginBottom: 20 }}>
              <div className="lms-counter">
                <div>
                  <div className="lms-counter-label">Registered</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{shortDate(detail.learner.created_at)}</div>
                </div>
              </div>
              <div className="lms-counter">
                <div>
                  <div className="lms-counter-label">Phone</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{detail.learner.phone || '—'}</div>
                </div>
              </div>
            </div>

            <h3 className="lms-h3" style={{ marginBottom: 12 }}>
              <GraduationCap size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
              LMS enrollments ({detail.enrollments.length})
            </h3>
            {detail.enrollments.length === 0
              ? <p className="lms-help" style={{ marginBottom: 22 }}>Not enrolled in any LMS course yet.</p>
              : detail.enrollments.map(e => (
                <div key={e.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                  padding: '10px 0', borderBottom: '1px solid var(--lms-border)',
                }}>
                  <span style={{ fontSize: 13 }}>{e.course_title || 'Removed course'}</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Pill tone={e.status === 'active' ? 'green' : 'grey'}>{e.status}</Pill>
                    <span style={{ fontSize: 11.5, color: 'var(--lms-text-3)' }}>{shortDate(e.enrolled_at)}</span>
                  </div>
                </div>
              ))}

            <h3 className="lms-h3" style={{ margin: '24px 0 12px' }}>
              <ClipboardList size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
              Internship purchases ({detail.purchases.length})
            </h3>
            {detail.purchases.length === 0
              ? <p className="lms-help" style={{ marginBottom: 22 }}>No internship purchases on record.</p>
              : detail.purchases.slice(0, 10).map((p, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', gap: 10,
                  padding: '10px 0', borderBottom: '1px solid var(--lms-border)', fontSize: 13,
                }}>
                  <span>{p.internship}</span>
                  <span style={{ color: 'var(--lms-text-3)', fontSize: 11.5 }}>
                    {p.batch ? `${p.batch} • ` : ''}{shortDate(p.paid_at)}
                  </span>
                </div>
              ))}

            <h3 className="lms-h3" style={{ margin: '24px 0 12px' }}>Quiz attempts ({detail.attempts.length})</h3>
            {detail.attempts.length === 0
              ? <p className="lms-help">No quiz attempts yet.</p>
              : detail.attempts.map(a => (
                <div key={a.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                  padding: '10px 0', borderBottom: '1px solid var(--lms-border)', fontSize: 13,
                }}>
                  <span>{a.quiz_title || 'Deleted quiz'}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>{a.score}/{a.total_marks}</span>
                    <Pill tone={Number(a.passed) ? 'green' : 'red'}>{Number(a.passed) ? 'Passed' : 'Failed'}</Pill>
                  </div>
                </div>
              ))}
          </>
        ) : null}
      </Drawer>

      <LmsImportLearners
        open={importOpen}
        onClose={() => setImportOpen(false)}
        courses={courses}
        onDone={load}
      />
    </div>
  );
}
