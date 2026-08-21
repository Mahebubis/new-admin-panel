// ===========================================================================
//  LmsCourses.jsx — the "Courses" tab (Learnyst Products → Courses).
//
//  Card grid + counter strip + a create drawer that matches Learnyst's
//  Create Course screen (title / price / free toggle / content-security radio
//  cards), plus a full settings drawer for an existing course.
// ===========================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Plus, Search, MoreVertical, BookOpen, Clock, Lock, Unlock, Trash2,
  Copy, Settings2, Eye, EyeOff, RotateCcw, ImagePlus, Layers, Users, Grid3x3,
  Info, Check, X,
} from 'lucide-react';
import { LMS, money, duration } from './lmsApi';
import { ThumbnailPicker } from './LmsMedia';
import { Loader, Empty, Pill, Drawer, Confirm } from './LmsStyles';
import LmsCombobox from './LmsCombobox';
import { useOutsideClose } from './lmsTheme';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Draft' },
  { key: 'trashed', label: 'Trash' },
];

const emptyCourse = {
  title: '', subtitle: '', description: '', category: '', instructor: '',
  internship_name: '',
  price: '', sale_price: '', is_free: false, validity_days: 365,
  encryption: 'unencrypted', status: 'draft', seo_title: '', seo_description: '',
};

/* ── the ⓘ capability card ───────────────────────────────────
   Every flag here is read from real data — none of them are decorative. The
   ones that read "not built yet" are honest: this LMS has no discussion board
   or mobile-only selling, and showing a hopeful tick for either would make the
   card lie about what a learner actually gets. */
function courseFlags(course, settings) {
  const price = course.is_free ? 0 : (course.sale_price > 0 ? course.sale_price : course.price);
  return [
    { label: 'Content Dripping', on: !!course.drip_sections,
      why: course.drip_sections
        ? course.drip_sections + ' section(s) unlock on a delay'
        : 'No section has a drip delay set' },
    { label: 'Notes', on: true, why: 'Learners can take notes on any lesson' },
    { label: 'Certificate', on: settings.certificate_enabled === '1',
      why: settings.certificate_enabled === '1'
        ? 'Issued at ' + (settings.certificate_pass_percent || 0) + '% completion'
        : 'Turn it on in LMS → Settings' },
    { label: 'Quizzes', on: !!course.quiz_lesson_count,
      why: course.quiz_lesson_count
        ? course.quiz_lesson_count + ' quiz lesson(s)'
        : 'No quiz lesson in this course' },
    { label: 'Assignments', on: !!course.form_count,
      why: course.form_count ? course.form_count + ' lesson(s) collect a form' : 'No lesson collects a form' },
    { label: 'Sell Independently', on: price > 0,
      why: price > 0 ? 'Priced at ' + money(price) : 'Free — nothing to sell' },
    { label: 'Encrypted', on: course.encryption === 'encrypted',
      why: course.encryption === 'encrypted' ? 'Video is served encrypted' : 'Video is served unencrypted' },
    { label: 'Time limited', on: Number(course.validity_days) > 0,
      why: Number(course.validity_days) > 0
        ? 'Access ends ' + course.validity_days + ' days after enrolling'
        : 'Lifetime access' },
    { label: 'Discussion', on: false, why: 'Not built yet' },
    { label: 'Enroll on signup', on: false, why: 'Not built yet' },
  ];
}

function CourseFlags({ course, settings }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClose(ref, () => setOpen(false), open);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        className="lms-icon-btn"
        title="What this course supports"
        onClick={(e) => { e.preventDefault(); setOpen(o => !o); }}
      >
        <Info size={16} />
      </button>
      {open && (
        <div className="lms-flags">
          {courseFlags(course, settings).map(f => (
            <div className={`lms-flag${f.on ? ' on' : ''}`} key={f.label} title={f.why}>
              {f.on ? <Check size={14} /> : <X size={14} />}
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── per-card ⋯ menu ─────────────────────────────────────────── */
function CardMenu({ course, onPublish, onDuplicate, onTrash, onRestore, onDelete, onSettings }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClose(ref, () => setOpen(false), open);

  const trashed = course.status === 'trashed';
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="lms-icon-btn" onClick={(e) => { e.preventDefault(); setOpen(o => !o); }} aria-label="Course actions">
        <MoreVertical size={17} />
      </button>
      {open && (
        <div className="lms-menu" onClick={() => setOpen(false)}>
          {trashed ? (
            <>
              <button onClick={() => onRestore(course)}><RotateCcw size={15} /> Restore course</button>
              <div className="lms-menu-sep" />
              <button className="danger" onClick={() => onDelete(course)}><Trash2 size={15} /> Delete permanently</button>
            </>
          ) : (
            <>
              <button onClick={() => onSettings(course)}><Settings2 size={15} /> Course settings</button>
              <button onClick={() => onPublish(course)}>
                {course.status === 'published' ? <><EyeOff size={15} /> Unpublish</> : <><Eye size={15} /> Publish</>}
              </button>
              <button onClick={() => onDuplicate(course)}><Copy size={15} /> Duplicate</button>
              <div className="lms-menu-sep" />
              <button className="danger" onClick={() => onTrash(course)}><Trash2 size={15} /> Move to trash</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function LmsCourses() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  /* Internships + ₹99 courses, for the "what does this course belong to?"
     picker. Same one-shot endpoint the Users filter bar uses. */
  const [catalogue, setCatalogue] = useState([]);
  /* School-wide settings, only for the certificate flag on the info card. */
  const [settings, setSettings] = useState({});
  const [counts, setCounts] = useState({});
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(params.get('new') === '1');
  const [draft, setDraft] = useState(emptyCourse);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(null);   // full course being edited
  const [confirm, setConfirm] = useState(null);   // { title, message, label, run }

  const [thumbBusy, setThumbBusy] = useState(false);

  /* debounce the search box so we aren't querying on every keystroke */
  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await LMS.listCourses({ status, q: search });
      setCourses(d.courses || []);
      setCounts(d.counts || {});
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    LMS.learnerFilters().then(d => setCatalogue(d.catalogue || [])).catch(() => {});
    LMS.getSettings().then(d => setSettings(d.settings || {})).catch(() => {});
  }, []);

  /* Consume the deep-links other screens send us — ?new=1 opens the create
     drawer, ?settings=<id> opens that course's settings (the builder's
     Settings button) — then strip the param so a refresh doesn't re-open it. */
  useEffect(() => {
    const settingsId = params.get('settings');
    if (params.get('new') !== '1' && !settingsId) return;

    if (settingsId) {
      LMS.getCourse(settingsId)
        .then(d => setEditing({ ...d.course, is_free: !!Number(d.course.is_free) }))
        .catch(e => toast.error(e.message));
    }
    const next = new URLSearchParams(params);
    next.delete('new');
    next.delete('settings');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Title, Category and the internship link all carry the SAME product name.
     They are filled together from one pick rather than typed three times,
     because the card's title is what an admin recognises the course by, and
     the internship link is what learn_sync_entitlements() matches a purchase
     against — if those two drift apart by so much as a hyphen, buyers of the
     internship silently never get the course. Category follows along so the
     grouping matches too.

     Each field stays editable afterwards: the pick is a starting point, not a
     lock. Only internship_name is enforced on save. */
  const pickProduct = (name, set) => set(d => ({
    ...d,
    title: name,
    category: name,
    internship_name: name,
  }));

  const createCourse = async () => {
    if (!draft.title.trim()) return toast.error('Course title is required');
    if (!draft.internship_name?.trim()) {
      return toast.error('Pick the internship or ₹99 course this belongs to — buyers are matched on it');
    }
    setSaving(true);
    try {
      const d = await LMS.createCourse({
        ...draft,
        price: draft.is_free ? 0 : Number(draft.price || 0),
        sale_price: Number(draft.sale_price || 0),
        is_free: draft.is_free ? 1 : 0,
      });
      toast.success('Course created');
      setCreateOpen(false);
      setDraft(emptyCourse);
      navigate(`/lms/courses/${d.id}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    if (!editing?.title?.trim()) return toast.error('Course title is required');
    if (!editing?.internship_name?.trim()) {
      return toast.error('Pick the internship or ₹99 course this belongs to — buyers are matched on it');
    }
    setSaving(true);
    try {
      const res = await LMS.updateCourse({
        ...editing,
        price: editing.is_free ? 0 : Number(editing.price || 0),
        sale_price: Number(editing.sale_price || 0),
        is_free: editing.is_free ? 1 : 0,
        validity_days: Number(editing.validity_days || 0),
        /* Only when the admin actually asked. validity_days on its own decides
           what a NEW enrolment gets; this is what reaches back and re-dates
           the learners who are already on the course — see the note beside the
           checkbox. */
        apply_validity_to_enrollments: editing.apply_validity ? 1 : 0,
      });
      toast.success(res?.enrollments_updated
        ? `Course updated · ${res.enrollments_updated} learner${res.enrollments_updated === 1 ? '' : 's'} re-dated`
        : 'Course updated');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const act = (fn, msg) => async (course) => {
    try {
      await fn(course.id);
      toast.success(msg);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onPublish = async (course) => {
    const next = course.status === 'published' ? 'unpublished' : 'published';
    try {
      await LMS.publishCourse(course.id, next);
      toast.success(next === 'published' ? 'Course published' : 'Course unpublished');
      load();
    } catch (e) { toast.error(e.message); }
  };

  /**
   * Push one image to S3 for `course` and report the resulting URL back.
   * <ThumbnailPicker> has already confirmed the upload with the admin, so
   * this just does the work.
   */
  const uploadThumbFor = async (course, file, onDone) => {
    if (!course?.id || !file) return;
    setThumbBusy(true);
    const t = toast.loading('Uploading thumbnail…');
    try {
      const fd = new FormData();
      fd.append('id', course.id);
      fd.append('file', file);
      const d = await LMS.uploadThumbnail(fd);
      onDone?.(d?.url || d?.thumbnail_url || '');
      toast.success('Thumbnail updated', { id: t });
      load();
    } catch (err) {
      toast.error(err.message, { id: t });
    } finally {
      setThumbBusy(false);
    }
  };
  const counters = useMemo(() => ([
    { label: 'Total Courses', value: counts.total ?? 0,     icon: <Grid3x3 size={18} /> },
    { label: 'Published',     value: counts.published ?? 0, icon: <Eye size={18} /> },
    { label: 'Draft',         value: counts.draft ?? 0,     icon: <Layers size={18} /> },
    { label: 'Trashed',       value: counts.trashed ?? 0,   icon: <Trash2 size={18} /> },
  ]), [counts]);

  return (
    <div className="lms-page">

      <div className="lms-page-head">
        <div>
          <h1 className="lms-h1">Courses</h1>
          <p className="lms-sub">Welcome to your course dashboard</p>
        </div>
        <button className="lms-btn lms-btn-dark" onClick={() => { setDraft(emptyCourse); setCreateOpen(true); }}>
          <Plus size={17} /> Create
        </button>
      </div>

      <div className="lms-toolbar">
        <div className="lms-search">
          <Search size={16} />
          <input placeholder="Search by title" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="lms-segment">
          {STATUS_FILTERS.map(f => (
            <button key={f.key} className={status === f.key ? 'active' : ''} onClick={() => setStatus(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lms-counters">
        {counters.map(c => (
          <div className="lms-counter" key={c.label}>
            <div>
              <div className="lms-counter-label">{c.label}</div>
              <div className="lms-counter-value">{c.value}</div>
            </div>
            <span style={{ color: 'var(--lms-text-3)' }}>{c.icon}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <Loader />
      ) : courses.length === 0 ? (
        <Empty
          icon={<BookOpen size={24} />}
          title={search ? 'No courses match that search' : 'No courses yet'}
          message={
            search
              ? 'Try a different title or clear the search box.'
              : 'Create your first course, then add modules and video lessons inside it.'
          }
          action={!search && (
            <button className="lms-btn lms-btn-dark" onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> Create course
            </button>
          )}
        />
      ) : (
        <div className="lms-course-grid">
          {courses.map(c => (
            <div className="lms-course-card" key={c.id}>
              <Link to={c.status === 'trashed' ? '#' : `/lms/courses/${c.id}`}
                onClick={e => c.status === 'trashed' && e.preventDefault()}>
                <div className="lms-course-thumb">
                  {c.thumbnail_url
                    ? <img src={c.thumbnail_url} alt={c.title} />
                    : <div className="lms-course-thumb-ph">{c.title}</div>}
                  <span className="lms-validity">
                    <Clock size={11} />
                    {Number(c.validity_days) > 0 ? `${c.validity_days} Days` : 'Lifetime'}
                  </span>
                </div>
              </Link>

              <div className="lms-course-body">
                <Link to={c.status === 'trashed' ? '#' : `/lms/courses/${c.id}`}
                  onClick={e => c.status === 'trashed' && e.preventDefault()}>
                  <div className="lms-course-title">{c.title}</div>
                </Link>
                <div className="lms-course-meta">
                  {c.lesson_count} Lesson{c.lesson_count === 1 ? '' : 's'} • {duration(c.total_secs)}
                </div>
                <div className="lms-course-price">
                  {c.is_free ? 'Free' : money(c.sale_price > 0 ? c.sale_price : c.price)}
                  {!c.is_free && c.sale_price > 0 && c.sale_price < c.price && (
                    <span style={{ fontSize: 12.5, color: 'var(--lms-text-3)', textDecoration: 'line-through', marginLeft: 8 }}>
                      {money(c.price)}
                    </span>
                  )}
                </div>

                <div className="lms-course-foot">
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Pill tone={
                      c.status === 'published' ? 'green' : c.status === 'trashed' ? 'red' : 'grey'
                    }>
                      {c.status === 'published' ? 'Published' : c.status === 'trashed' ? 'Trashed' : 'Unpublished'}
                    </Pill>
                    <Pill tone="grey">
                      {c.encryption === 'encrypted' ? <><Lock size={11} /> Encrypted</> : <><Unlock size={11} /> Unencrypted</>}
                    </Pill>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <CourseFlags course={c} settings={settings} />
                    {c.status !== 'trashed' && (
                      <button
                        className="lms-icon-btn"
                        title="Change thumbnail"
                        onClick={async () => {
                          try {
                            const d = await LMS.getCourse(c.id);
                            setEditing({ ...d.course, is_free: !!Number(d.course.is_free) });
                          } catch (e) { toast.error(e.message); }
                        }}
                      >
                        <ImagePlus size={16} />
                      </button>
                    )}
                    <CardMenu
                      course={c}
                      onSettings={async (co) => {
                        try {
                          const d = await LMS.getCourse(co.id);
                          setEditing({ ...d.course, is_free: !!Number(d.course.is_free) });
                        } catch (e) { toast.error(e.message); }
                      }}
                      onPublish={onPublish}
                      onDuplicate={act(LMS.duplicateCourse, 'Course duplicated')}
                      onRestore={act(LMS.restoreCourse, 'Course restored')}
                      onTrash={(co) => setConfirm({
                        title: 'Move course to trash?',
                        message: `"${co.title}" will be hidden from learners. You can restore it from the Trash filter at any time.`,
                        label: 'Move to trash',
                        run: async () => { await LMS.trashCourse(co.id); toast.success('Moved to trash'); setConfirm(null); load(); },
                      })}
                      onDelete={(co) => setConfirm({
                        title: 'Delete course permanently?',
                        message: `"${co.title}", all its modules, lessons, attachments, form responses and enrollments will be deleted. This cannot be undone.`,
                        label: 'Delete permanently',
                        run: async () => { await LMS.deleteCourse(co.id); toast.success('Course deleted'); setConfirm(null); load(); },
                      })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--lms-text-3)' }}>
                  <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    <Layers size={12} /> {c.section_count} sections
                  </span>
                  <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    <Users size={12} /> {c.enroll_count} enrolled
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── create drawer ─────────────────────────────────────── */}
      <Drawer
        open={createOpen}
        title="Create Course"
        subtitle="Start creating a new course"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button className="lms-btn lms-btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="lms-btn lms-btn-dark" onClick={createCourse} disabled={saving}>
              {saving ? 'Creating…' : 'Create'}
            </button>
          </>
        }
      >
        <div className="lms-field">
          <label className="lms-label">Title<span className="req">*</span></label>
          <LmsCombobox
            options={catalogue}
            value={draft.title}
            onChange={v => pickProduct(v, setDraft)}
            placeholder="Pick the internship or ₹99 course"
            searchPlaceholder="Search internships and courses…"
            emptyLabel="Nothing matches — keep typing to use it anyway"
            allowCustom
          />
          <p className="lms-help">
            Picking one fills Category and the internship link with the same name, so the card
            reads exactly as it does in <b>internship_list</b> and buyers match on it.
          </p>
        </div>

        <div className="lms-field">
          <label className="lms-label">Price</label>
          <input
            className="lms-input"
            type="number"
            min="0"
            placeholder="₹ Price"
            disabled={draft.is_free}
            value={draft.price}
            onChange={e => setDraft(d => ({ ...d, price: e.target.value }))}
          />
          <label className="lms-check" style={{ marginTop: 12 }}>
            <input
              type="checkbox"
              checked={draft.is_free}
              onChange={e => setDraft(d => ({ ...d, is_free: e.target.checked }))}
            />
            Make this a free course
          </label>
        </div>

        <div className="lms-field">
          <label className="lms-label">Content Security</label>
          <label className={`lms-radio-card${draft.encryption === 'encrypted' ? ' on' : ''}`}>
            <input
              type="radio"
              checked={draft.encryption === 'encrypted'}
              onChange={() => setDraft(d => ({ ...d, encryption: 'encrypted' }))}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                Encryption <Pill tone="amber">Recommended</Pill>
              </div>
              <p className="lms-help">
                Secure content will be encrypted using the DRM system and will be protected against piracy.
              </p>
            </div>
          </label>
          <label className={`lms-radio-card${draft.encryption === 'unencrypted' ? ' on' : ''}`}>
            <input
              type="radio"
              checked={draft.encryption === 'unencrypted'}
              onChange={() => setDraft(d => ({ ...d, encryption: 'unencrypted' }))}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>No Encryption</div>
              <p className="lms-help">
                Content will not be encrypted. Unsecure content can be easily downloaded and pirated.
              </p>
            </div>
          </label>
        </div>

        <div className="lms-row-2">
          <div className="lms-field">
            <label className="lms-label">Validity (days)</label>
            <input
              className="lms-input" type="number" min="0"
              disabled={Number(draft.validity_days) === 0}
              placeholder={Number(draft.validity_days) === 0 ? 'Never expires' : ''}
              value={Number(draft.validity_days) === 0 ? '' : draft.validity_days}
              onChange={e => setDraft(d => ({ ...d, validity_days: e.target.value }))}
            />
            {/* 0 is the stored value for lifetime access — see the same
                checkbox in the course editor. */}
            <label className="lms-check" style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={Number(draft.validity_days) === 0}
                onChange={e => setDraft(d => ({ ...d, validity_days: e.target.checked ? 0 : 365 }))}
              />
              Never expires
            </label>
          </div>
          <div className="lms-field">
            <label className="lms-label">Category</label>
            <input
              className="lms-input" placeholder="e.g. Software Testing"
              value={draft.category}
              onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}
            />
          </div>
        </div>

        <div className="lms-field">
          <label className="lms-label">
            Internship / course this belongs to<span className="req">*</span>
          </label>
          <LmsCombobox
            options={catalogue}
            value={draft.internship_name}
            onChange={v => setDraft(d => ({ ...d, internship_name: v }))}
            placeholder="Pick an internship or a ₹99 course"
            searchPlaceholder="Search internships and courses…"
            emptyLabel="Nothing matches — keep typing to add it anyway"
            allowCustom
          />
          <p className="lms-help">
            All {catalogue.length || ''} internships plus the ₹99 courses. Selling something that is
            in neither list? Type the name and pick the &ldquo;Use …&rdquo; row.
          </p>
        </div>
      </Drawer>

      {/* ── settings drawer ───────────────────────────────────── */}
      <Drawer
        open={!!editing}
        title="Course Settings"
        subtitle={editing?.title}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button className="lms-btn lms-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button className="lms-btn lms-btn-dark" onClick={saveSettings} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </>
        }
      >
        {editing && (
          <>
            <div className="lms-field">
              <label className="lms-label">Thumbnail</label>
              <ThumbnailPicker
                url={editing.thumbnail_url || ''}
                busy={thumbBusy}
                onUrlChange={u => setEditing(st => ({ ...st, thumbnail_url: u }))}
                onUpload={file => uploadThumbFor(editing, file, u => setEditing(st => ({ ...st, thumbnail_url: u })))}
              />
              <p className="lms-help">
                An uploaded image goes to S3 immediately. A pasted URL is saved when you press
                {' '}<b>Save changes</b>.
              </p>
            </div>
            <div className="lms-field">
              <label className="lms-label">Title<span className="req">*</span></label>
              <LmsCombobox
                options={catalogue}
                value={editing.title}
                onChange={v => pickProduct(v, setEditing)}
                placeholder="Pick the internship or ₹99 course"
                searchPlaceholder="Search internships and courses…"
                allowCustom
              />
              <p className="lms-help">
                Also fills Category and the internship link below with the same name.
              </p>
            </div>
            <div className="lms-field">
              <label className="lms-label">Subtitle</label>
              <input className="lms-input" value={editing.subtitle || ''}
                onChange={e => setEditing(s => ({ ...s, subtitle: e.target.value }))} />
            </div>
            <div className="lms-field">
              <label className="lms-label">Description</label>
              <textarea className="lms-textarea" value={editing.description || ''}
                onChange={e => setEditing(s => ({ ...s, description: e.target.value }))} />
            </div>
            <div className="lms-row-2">
              <div className="lms-field">
                <label className="lms-label">Category</label>
                <input className="lms-input" value={editing.category || ''}
                  onChange={e => setEditing(s => ({ ...s, category: e.target.value }))} />
              </div>
              <div className="lms-field">
                <label className="lms-label">Instructor</label>
                <input className="lms-input" value={editing.instructor || ''}
                  onChange={e => setEditing(s => ({ ...s, instructor: e.target.value }))} />
              </div>
            </div>
            <div className="lms-field">
              <label className="lms-label">
                Internship / course this belongs to<span className="req">*</span>
              </label>
              <LmsCombobox
                options={catalogue}
                value={editing.internship_name || ''}
                onChange={v => setEditing(s => ({ ...s, internship_name: v }))}
                placeholder="Pick an internship or a ₹99 course"
                searchPlaceholder="Search internships and courses…"
                allowCustom
              />
            </div>
            <div className="lms-row-3">
              <div className="lms-field">
                <label className="lms-label">Price</label>
                <input className="lms-input" type="number" min="0" disabled={editing.is_free}
                  value={editing.price ?? ''}
                  onChange={e => setEditing(s => ({ ...s, price: e.target.value }))} />
              </div>
              <div className="lms-field">
                <label className="lms-label">Sale price</label>
                <input className="lms-input" type="number" min="0" disabled={editing.is_free}
                  value={editing.sale_price ?? ''}
                  onChange={e => setEditing(s => ({ ...s, sale_price: e.target.value }))} />
              </div>
              <div className="lms-field">
                <label className="lms-label">Validity (days)</label>
                <input className="lms-input" type="number" min="0"
                  disabled={Number(editing.validity_days) === 0}
                  placeholder={Number(editing.validity_days) === 0 ? 'Never expires' : ''}
                  value={Number(editing.validity_days) === 0 ? '' : (editing.validity_days ?? 365)}
                  onChange={e => setEditing(s => ({ ...s, validity_days: e.target.value }))} />
              </div>
            </div>

            {/* ── lifetime access ──────────────────────────────────────────
                0 days has always meant "no expiry date" everywhere this is
                read (lms_enroll, the portal's access check, the Skill Lab
                card) — it was just never sayable without knowing that. */}
            <label className="lms-check" style={{ marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={Number(editing.validity_days) === 0}
                onChange={e => setEditing(s => ({
                  ...s,
                  validity_days: e.target.checked ? 0 : 365,
                  /* Turning it off should not silently re-date everyone. */
                  apply_validity: e.target.checked ? s.apply_validity : false,
                }))}
              />
              This course never expires (lifetime access)
            </label>

            {/* Validity only stamps NEW enrolments, so without this a course
                switched to lifetime still has every existing learner counting
                down to the date they were originally given. */}
            <label className="lms-check" style={{ marginBottom: 18, paddingLeft: 24 }}>
              <input type="checkbox" checked={!!editing.apply_validity}
                onChange={e => setEditing(s => ({ ...s, apply_validity: e.target.checked }))} />
              Apply to learners already enrolled
              <span className="lms-help" style={{ display: 'block', marginTop: 2 }}>
                {Number(editing.validity_days) === 0
                  ? 'Clears the expiry date on every active enrolment in this course.'
                  : `Re-dates every active enrolment to ${editing.validity_days || 0} days from the day that learner enrolled.`}
              </span>
            </label>

            <label className="lms-check" style={{ marginBottom: 18 }}>
              <input type="checkbox" checked={!!editing.is_free}
                onChange={e => setEditing(s => ({ ...s, is_free: e.target.checked }))} />
              Make this a free course
            </label>

            <div className="lms-row-2">
              <div className="lms-field">
                <label className="lms-label">Content security</label>
                <select className="lms-select" value={editing.encryption}
                  onChange={e => setEditing(s => ({ ...s, encryption: e.target.value }))}>
                  <option value="unencrypted">No Encryption</option>
                  <option value="encrypted">Encryption (DRM)</option>
                </select>
              </div>
              <div className="lms-field">
                <label className="lms-label">Status</label>
                <select className="lms-select" value={editing.status}
                  onChange={e => setEditing(s => ({ ...s, status: e.target.value }))}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="unpublished">Unpublished</option>
                </select>
              </div>
            </div>

            <div className="lms-divider" />
            <h3 className="lms-h3" style={{ marginBottom: 14 }}>SEO</h3>
            <div className="lms-field">
              <label className="lms-label">SEO title</label>
              <input className="lms-input" value={editing.seo_title || ''}
                onChange={e => setEditing(s => ({ ...s, seo_title: e.target.value }))} />
            </div>
            <div className="lms-field">
              <label className="lms-label">SEO description</label>
              <textarea className="lms-textarea" style={{ minHeight: 70 }} value={editing.seo_description || ''}
                onChange={e => setEditing(s => ({ ...s, seo_description: e.target.value }))} />
            </div>
          </>
        )}
      </Drawer>

      <Confirm
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.label}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.run()}
      />
    </div>
  );
}
