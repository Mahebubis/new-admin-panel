// ===========================================================================
//  LmsCourseBuilder.jsx — the course content builder.
//
//  This is the screen the whole LMS is built around: open a course card and you
//  get its modules (sections); expand a module and you get its lessons; add a
//  lesson and you land in the lesson editor where the video, attachments and
//  the per-lesson data-collection form live.
//
//  Layout follows Learnyst's /contents/content-builder page 1:1 — numbered
//  section rows, the stats strip (hidden / lessons / quizzes / duration), the
//  green "Add lesson" bar inside each expanded module and the "Add Section"
//  bar at the bottom.
// ===========================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ChevronLeft, ChevronDown, ChevronUp, Plus, MoreVertical, Settings2, Search,
  PlayCircle, FileText, HelpCircle, Radio, ClipboardList, EyeOff, Paperclip,
  Trash2, ArrowDownToLine, ArrowUpToLine, ArrowDown, ArrowUp, Pencil, Link2,
  BookOpen, Clock, Layers, ArrowRightLeft, GripVertical, AlertTriangle,
  Info, CheckCircle2, XCircle, PowerOff, Hourglass,
} from 'lucide-react';
import { LMS, duration, rememberLesson, recallLesson } from './lmsApi';
import { Loader, Empty, Pill, Drawer, Modal, Confirm, Toggle } from './LmsStyles';
import { useOutsideClose } from './lmsTheme';

const LESSON_TYPES = [
  { key: 'video',   label: 'Video',   icon: PlayCircle,    hint: 'Upload or link a lecture video' },
  { key: 'article', label: 'Article', icon: FileText,      hint: 'A rich-text note or reading' },
  { key: 'pdf',     label: 'PDF',     icon: Paperclip,     hint: 'A downloadable document' },
  { key: 'quiz',    label: 'Quiz',    icon: HelpCircle,    hint: 'Attach a quiz from the Quizzes tab' },
  { key: 'form',    label: 'Form',    icon: ClipboardList, hint: 'Collect data from the learner' },
  { key: 'live',    label: 'Live',    icon: Radio,         hint: 'A scheduled live class link' },
];

const typeIcon = (t) => (LESSON_TYPES.find(x => x.key === t)?.icon) || PlayCircle;

/* ── ⋯ menu on a lesson row ──────────────────────────────────── */
function LessonMenu({
  lesson, sections, onMove, onAddNext, onBottom, onTrash, onCopyUrl,
  onRename, onFlipComingSoon,
}) {
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClose(ref, () => { setOpen(false); setMoveOpen(false); }, open);

  const comingSoon = !!Number(lesson.is_coming_soon);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="lms-icon-btn" onClick={() => setOpen(o => !o)} aria-label="Lesson actions">
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="lms-menu">
          <button onClick={() => { setOpen(false); onRename(lesson); }}>
            <Pencil size={15} /> Rename lesson
          </button>
          <button onClick={() => { setOpen(false); onFlipComingSoon(lesson); }}>
            <Hourglass size={15} /> {comingSoon ? 'Clear coming soon' : 'Mark coming soon'}
          </button>
          <div className="lms-menu-sep" />
          <button onClick={() => setMoveOpen(m => !m)}>
            <ArrowRightLeft size={15} /> Move To Another Section
          </button>
          {moveOpen && (
            <div className="lms-submenu">
              <div className="lms-submenu-label">Move it to</div>
              {sections.filter(s => s.id !== lesson.section_id).map(s => (
                <button key={s.id}
                  onClick={() => { setOpen(false); setMoveOpen(false); onMove(lesson, s.id); }}>
                  {s.title}
                </button>
              ))}
              {sections.length < 2 && (
                <div className="lms-submenu-empty">
                  There is only one section right now. Create a second one and this lesson
                  can be moved into it.
                </div>
              )}
            </div>
          )}
          <button onClick={() => { setOpen(false); onCopyUrl(lesson); }}><Link2 size={15} /> Copy URL</button>
          <button onClick={() => { setOpen(false); onAddNext(lesson); }}><Plus size={15} /> Add Next Lesson</button>
          <button onClick={() => { setOpen(false); onBottom(lesson); }}><ArrowDownToLine size={15} /> Move To Bottom</button>
          <div className="lms-menu-sep" />
          <button className="danger" onClick={() => { setOpen(false); onTrash(lesson); }}>
            <Trash2 size={15} /> Move To Trash
          </button>
        </div>
      )}
    </div>
  );
}

/* ── ⋯ menu on a section row ─────────────────────────────────── */
function SectionMenu({ section, onEdit, onDelete, onFlipComingSoon }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClose(ref, () => setOpen(false), open);

  const comingSoon = !!Number(section.is_coming_soon);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="lms-icon-btn" onClick={e => { e.stopPropagation(); setOpen(o => !o); }} aria-label="Section actions">
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="lms-menu" onClick={e => e.stopPropagation()}>
          <button onClick={() => { setOpen(false); onEdit(section); }}><Pencil size={15} /> Rename section</button>
          <button onClick={() => { setOpen(false); onFlipComingSoon(section); }}>
            <Hourglass size={15} /> {comingSoon ? 'Clear coming soon' : 'Mark coming soon'}
          </button>
          <div className="lms-menu-sep" />
          <button className="danger" onClick={() => { setOpen(false); onDelete(section); }}>
            <Trash2 size={15} /> Delete section
          </button>
        </div>
      )}
    </div>
  );
}

export default function LmsCourseBuilder() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  const [granting, setGranting] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkEmail, setCheckEmail] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [checking, setChecking] = useState(false);

  const runAccessCheck = async () => {
    const email = checkEmail.trim();
    if (!email) return toast.error('Enter the email the learner signs in with');
    setChecking(true);
    setCheckResult(null);
    try { setCheckResult(await LMS.accessCheck(Number(courseId), email)); }
    catch (e) { toast.error(e.message); }
    finally { setChecking(false); }
  };

  /* Publishing and enrolling are separate switches, and a course needs BOTH
     before a learner sees it — see the courses "get" action for the full list
     of conditions the learner portal checks. These two put each one right on
     the banner that reports it missing. */
  const publishCourse = async () => {
    try {
      await LMS.publishCourse(Number(courseId), 'published');
      toast.success('Course published');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const grantToBuyers = async () => {
    if (!course?.internship_name) return;
    setGranting(true);
    try {
      const d = await LMS.bulkEnroll({
        course_id: Number(courseId),
        internship: course.internship_name,
        access_type: 'paid',
      });
      toast.success(d._message || 'Access granted');
      load();
    } catch (e) { toast.error(e.message); }
    finally { setGranting(false); }
  };
  const [sections, setSections] = useState([]);
  const [openIds, setOpenIds] = useState([]);
  /* The lesson this admin last opened from here — its module is expanded on
     the way back in and its row is marked, so returning from the editor lands
     on the row you left instead of the top of module 1. */
  const [currentLesson, setCurrentLesson] = useState(0);
  const currentRef = useRef(null);
  const firstLoad = useRef(true);
  const scrollPending = useRef(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  const [sectionDraft, setSectionDraft] = useState(null);   // { id?, title, description, drip_days }
  const [lessonDraft, setLessonDraft] = useState(null);     // { section_id, title, lesson_type, after? }
  const [renameDraft, setRenameDraft] = useState(null);     // { id, title } — inline lesson rename
  const [sweep, setSweep] = useState(null);                 // course-wide on/off confirm
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  useOutsideClose(moreRef, () => setMoreOpen(false), moreOpen);

  const load = useCallback(async () => {
    try {
      const d = await LMS.listSections(courseId);
      setCourse(d.course);
      const secs = d.sections || [];
      setSections(secs);

      if (firstLoad.current) {
        firstLoad.current = false;
        /* Coming back from a lesson? Open the module that lesson lives in and
           mark it. The lesson is looked up in the freshly loaded outline
           rather than trusting the stored section id, so a lesson that was
           moved to another module — or deleted — falls back cleanly. */
        const last = recallLesson(courseId);
        const host = last && secs.find(sec => (sec.lessons || [])
          .some(l => Number(l.id) === Number(last.lessonId)));
        if (host) {
          setOpenIds([host.id]);
          setCurrentLesson(Number(last.lessonId));
          scrollPending.current = true;
        } else {
          /* keep the first module open on a fresh load, like Learnyst does */
          setOpenIds(secs[0] ? [secs[0].id] : []);
        }
      } else {
        setOpenIds(prev => (prev.length ? prev : (secs[0] ? [secs[0].id] : [])));
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    firstLoad.current = true;
    setCurrentLesson(0);
  }, [courseId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  /* Expanding the module is only half of it — on a long outline the row can
     still be a screen below the fold. Scrolled after paint (the row does not
     exist until the module renders open) and only for the row restored from
     storage, never on an ordinary re-render. */
  useEffect(() => {
    if (!currentLesson || !scrollPending.current) return undefined;
    const t = setTimeout(() => {
      scrollPending.current = false;
      currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    return () => clearTimeout(t);
  }, [currentLesson, sections]);

  const stats = useMemo(() => {
    let lessons = 0, quizzes = 0, hidden = 0, secs = 0;
    for (const s of sections) {
      for (const l of s.lessons || []) {
        if (l.lesson_type === 'quiz') quizzes++; else lessons++;
        if (l.is_hidden) hidden++;
        secs += l.duration_secs || 0;
      }
    }
    return { lessons, quizzes, hidden, secs };
  }, [sections]);

  const visibleSections = useMemo(() => {
    if (!search.trim()) return sections;
    const q = search.trim().toLowerCase();
    return sections
      .map(s => ({ ...s, lessons: (s.lessons || []).filter(l => l.title.toLowerCase().includes(q)) }))
      .filter(s => s.lessons.length > 0 || s.title.toLowerCase().includes(q));
  }, [sections, search]);

  const toggleSection = (id) =>
    setOpenIds(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));

  /* ── section CRUD ── */
  const saveSection = async () => {
    if (!sectionDraft?.title?.trim()) return toast.error('Section title is required');
    setSaving(true);
    try {
      if (sectionDraft.id) {
        await LMS.updateSection(sectionDraft);
        toast.success('Section updated');
      } else {
        const d = await LMS.createSection({ ...sectionDraft, course_id: Number(courseId) });
        toast.success('Section added');
        setOpenIds(ids => [...ids, d.id]);
      }
      setSectionDraft(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── drag to reorder ───────────────────────────────────────────────
     Native HTML5 drag and drop, no library. Two independent drags run here:
     a section against the other sections, and a lesson against the lessons of
     the SAME section — dragging a lesson across sections is what the ⋮ menu's
     "Move To Another Section" is for, because a cross-list drop needs a target
     the collapsed section cannot offer.

     The list is only rewritten on drop. Reordering the array on every
     dragover (the other common approach) makes the row jump out from under
     the cursor mid-drag. */
  /* The payload lives in a REF, not state. dragover has to call
     preventDefault() on every event or the browser never allows the drop —
     and a handler closed over a stale render's state reads null, skips the
     preventDefault, and the drop silently never fires. A ref is always
     current no matter which render the live DOM handler came from.

     "over" stays state because it only drives the highlight. */
  const dragRef = useRef(null);             // { kind:'section'|'lesson', id, sectionId? }
  const [over, setOver] = useState(null);
  /* Which row is currently allowed to start a drag. draggable sits on the ROW
     (a drag started on a child span is unreliable across browsers) but is only
     switched on while the pointer is held on that row's grip, so selecting
     text or clicking the title never turns into a drag. */
  const [grip, setGrip] = useState(null);   // 'section:12' | 'lesson:34'

  const reorder = (arr, fromId, toId) => {
    const from = arr.findIndex(x => x.id === fromId);
    const to   = arr.findIndex(x => x.id === toId);
    if (from < 0 || to < 0 || from === to) return null;
    const next = [...arr];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };

  const dropSection = async (targetId) => {
    const d = dragRef.current;
    dragRef.current = null; setGrip(null); setOver(null);
    if (!d || d.kind !== 'section') return;
    const next = reorder(sections, d.id, targetId);
    if (!next) return;
    setSections(next);
    try { await LMS.reorderSections(next.map(x => x.id)); }
    catch (e) { toast.error(e.message); load(); }
  };

  const dropLesson = async (sectionId, targetId) => {
    const d = dragRef.current;
    dragRef.current = null; setGrip(null); setOver(null);
    if (!d || d.kind !== 'lesson' || d.sectionId !== sectionId) return;
    const section = sections.find(x => x.id === sectionId);
    const next = reorder(section?.lessons || [], d.id, targetId);
    if (!next) return;
    setSections(prev => prev.map(x => (x.id === sectionId ? { ...x, lessons: next } : x)));
    try { await LMS.reorderLessons(next.map(x => x.id)); }
    catch (e) { toast.error(e.message); load(); }
  };

  const moveSection = async (index, dir) => {
    const next = [...sections];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next);
    try { await LMS.reorderSections(next.map(s => s.id)); }
    catch (e) { toast.error(e.message); load(); }
  };

  const moveSectionEdge = async (index, toTop) => {
    const next = [...sections];
    const [item] = next.splice(index, 1);
    if (toTop) next.unshift(item); else next.push(item);
    setSections(next);
    try { await LMS.reorderSections(next.map(s => s.id)); }
    catch (e) { toast.error(e.message); load(); }
  };

  /* ── lesson CRUD ── */
  /* ── the two switches ──────────────────────────────────────────────────
     Written straight into local state and only then sent, because a full
     load() to move one pill re-fetches every lesson of every module and the
     outline visibly jumps. The optimistic value is rolled back on failure. */
  const patchSection = (id, p) =>
    setSections(prev => prev.map(sec => (sec.id === id ? { ...sec, ...p } : sec)));

  const patchLesson = (id, p) =>
    setSections(prev => prev.map(sec => ({
      ...sec,
      lessons: (sec.lessons || []).map(l => (l.id === id ? { ...l, ...p } : l)),
    })));

  const flipSection = async (sec, field) => {
    const was  = Number(sec[field] ?? 0);
    const next = was ? 0 : 1;
    patchSection(sec.id, { [field]: next });
    try {
      await LMS.toggleSectionComingSoon(sec.id, next);
      toast.success(next ? 'Module marked coming soon' : 'Coming-soon cleared');
    } catch (e) {
      toast.error(e.message);
      patchSection(sec.id, { [field]: was });
    }
  };

  const flipLesson = async (lesson, field) => {
    const was  = Number(lesson[field] ?? 0);
    const next = was ? 0 : 1;
    patchLesson(lesson.id, { [field]: next });
    try {
      await LMS.toggleLessonComingSoon(lesson.id, next);
      toast.success(next ? 'Lesson marked coming soon' : 'Coming-soon cleared');
    } catch (e) {
      toast.error(e.message);
      patchLesson(lesson.id, { [field]: was });
    }
  };

  /* Course-wide, so this one DOES reload — it rewrites every row. */
  const runSweep = async () => {
    if (!sweep) return;
    try {
      await LMS.setAllComingSoon(Number(courseId), sweep.value);
      toast.success(sweep.done);
      setSweep(null);
      load();
    } catch (e) { toast.error(e.message); }
  };

  /* The whole course marked coming soon — one flag, cascading at read time
     over every module and lesson. Optimistic like the row toggles. */
  const flipCourseComingSoon = async () => {
    const was  = Number(course.is_coming_soon ?? 0);
    const next = was ? 0 : 1;
    setCourse(c => ({ ...c, is_coming_soon: next }));
    try {
      await LMS.toggleCourseComingSoon(Number(courseId), next);
      toast.success(next ? 'Whole course marked coming soon' : 'Coming-soon cleared');
      /* Reloaded because every module and lesson row inherits this — their
         badges are computed server-side and would otherwise stay stale. */
      load();
    } catch (e) {
      toast.error(e.message);
      setCourse(c => ({ ...c, is_coming_soon: was }));
    }
  };

  /* ── the routing switch ────────────────────────────────────────────────
     One per course, and the only place it exists. It was per-module and
     per-lesson for a day: that was a level too far down, because
     user_dashboard routes a buyer at a course, so three hundred toggles were
     expressing one decision.

     It also carries EVERY LESSON's published state with it — on publishes them
     all, off puts them all back to draft — so the outline is reloaded after
     the call rather than patched: every lesson badge on screen just changed. */
  const [switching, setSwitching] = useState(false);
  const toggleCourseEnabled = async () => {
    const was  = Number(course.is_enabled ?? 1);
    const next = was ? 0 : 1;
    setSwitching(true);
    setCourse(c => ({ ...c, is_enabled: next }));
    try {
      const d = await LMS.toggleCourseEnabled(Number(courseId), next);
      const n = Number(d?.lessons_touched ?? 0);
      const lessons = n ? ` — ${n} lesson${n === 1 ? '' : 's'} ${next ? 'published' : 'unpublished'}` : '';
      toast.success((next ? 'Course switched on' : 'Course switched off') + lessons);
      load();
    } catch (e) {
      toast.error(e.message);
      setCourse(c => ({ ...c, is_enabled: was }));
    } finally { setSwitching(false); }
  };

  const renameLesson = async () => {
    const title = (renameDraft?.title || '').trim();
    if (!title) return toast.error('Lesson title is required');
    setSaving(true);
    try {
      await LMS.renameLesson(renameDraft.id, title);
      patchLesson(renameDraft.id, { title });
      toast.success('Lesson renamed');
      setRenameDraft(null);
    } catch (e) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  const createLesson = async () => {
    if (!lessonDraft?.title?.trim()) return toast.error('Lesson title is required');
    setSaving(true);
    try {
      const d = await LMS.createLesson({
        course_id: Number(courseId),
        section_id: lessonDraft.section_id,
        title: lessonDraft.title,
        lesson_type: lessonDraft.lesson_type,
      });
      toast.success('Lesson added');
      setLessonDraft(null);
      rememberLesson(courseId, d.id, lessonDraft.section_id);
      navigate(`/lms/courses/${courseId}/lessons/${d.id}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const moveLessonToBottom = async (lesson) => {
    const sec = sections.find(s => s.id === lesson.section_id);
    if (!sec) return;
    const rest = sec.lessons.filter(l => l.id !== lesson.id);
    const order = [...rest.map(l => l.id), lesson.id];
    try {
      await LMS.reorderLessons(order);
      toast.success('Moved to bottom');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const moveLessonToSection = async (lesson, sectionId) => {
    try {
      await LMS.moveLesson(lesson.id, sectionId);
      toast.success('Lesson moved');
      setOpenIds(ids => (ids.includes(sectionId) ? ids : [...ids, sectionId]));
      load();
    } catch (e) { toast.error(e.message); }
  };

  const copyLessonUrl = async (lesson) => {
    const url = `${window.location.origin}/lms/courses/${courseId}/lessons/${lesson.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lesson URL copied');
    } catch {
      toast.error('Could not access the clipboard — copy it from the address bar instead');
    }
  };

  if (loading) return <Loader />;
  if (!course) {
    return (
      <div className="lms-page">
        <Empty
          icon={<BookOpen size={24} />}
          title="Course not found"
          message="It may have been deleted. Go back to the course list and pick another one."
          action={<Link to="/lms/courses" className="lms-btn lms-btn-dark">Back to courses</Link>}
        />
      </div>
    );
  }

  return (
    <div className="lms-page">
      <div className="lms-breadcrumb">
        <Link to="/lms/courses" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <ChevronLeft size={15} /> Back
        </Link>
      </div>

      {/* ── what is stopping learners from seeing this ─────────── */}
      {(course.status !== 'published' || !course.enrolled_count || !course.visible_lessons) && (
        <div className="lms-warn" style={{ marginBottom: 20, alignItems: 'flex-start' }}>
          <AlertTriangle size={17} className="lms-warn-ico" />
          <div className="lms-warn-body" style={{ flex: 1 }}>
            <b>Learners cannot see this course yet</b>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.8 }}>
              {course.status !== 'published' && (
                <li>
                  The course is <b>unpublished</b>. The learner portal only lists published courses.
                </li>
              )}
              {!course.visible_lessons && (
                <li>
                  No lesson is <b>published and visible</b>. Draft or hidden lessons never reach a learner.
                </li>
              )}
              {!course.enrolled_count && (
                <li>
                  <b>Nobody is enrolled.</b> Buying the internship does not enroll anyone here — the
                  internship system and the LMS are separate, so access has to be granted.
                </li>
              )}
            </ul>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {course.status !== 'published' && (
                <button className="lms-btn lms-btn-sm lms-btn-dark" onClick={publishCourse}>
                  Publish now
                </button>
              )}
              {!course.enrolled_count && course.internship_name && course.buyers_of > 0 && (
                <button className="lms-btn lms-btn-sm lms-btn-green" onClick={grantToBuyers} disabled={granting}>
                  {granting
                    ? 'Granting…'
                    : `Grant access to ${course.buyers_of.toLocaleString('en-IN')} buyer${course.buyers_of === 1 ? '' : 's'} of "${course.internship_name}"`}
                </button>
              )}
              {!course.enrolled_count && (
                <Link to={`/lms/enrollments?course_id=${courseId}`} className="lms-btn lms-btn-sm lms-btn-ghost">
                  Enroll someone manually
                </Link>
              )}
              {!course.internship_name && (
                <Link to={`/lms/courses?settings=${courseId}`} className="lms-btn lms-btn-sm lms-btn-ghost">
                  Link an internship
                </Link>
              )}
              <button className="lms-btn lms-btn-sm lms-btn-quiet" onClick={() => setCheckOpen(true)}>
                Check a learner's access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── course header ─────────────────────────────────────── */}
      <div className="lms-page-head" style={{ alignItems: 'center' }}>
        <div>
          <div className="lms-chip-row" style={{ marginBottom: 10 }}>
            <Pill tone={course.status === 'published' ? 'green' : 'grey'}>
              {course.status === 'published' ? 'Published' : 'Unpublished'}
            </Pill>
            <Pill tone="grey">{course.encryption === 'encrypted' ? 'Encrypted' : 'Unencrypted'}</Pill>
            {!Number(course.is_enabled ?? 1) && <Pill tone="red"><PowerOff size={11} /> Switched off</Pill>}
            {!!Number(course.is_coming_soon) && <Pill tone="blue"><Hourglass size={11} /> Whole course coming soon</Pill>}
          </div>
          <h1 className="lms-h1">{course.title}</h1>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* The user_dashboard routing switch. Sits on the header rather than
              in the More menu because it is a state, not an action — its
              position has to say which way it is set without being opened. */}
          <div className="lms-course-switch">
            <div>
              <div className="lms-course-switch-label">
                {Number(course.is_enabled ?? 1) ? 'Switched on' : 'Switched off'}
              </div>
              <div className="lms-course-switch-hint">for user_dashboard</div>
            </div>
            <Toggle
              on={!!Number(course.is_enabled ?? 1)}
              disabled={switching}
              onChange={toggleCourseEnabled}
            />
          </div>
          <div style={{ position: 'relative' }} ref={moreRef}>
            <button className="lms-btn lms-btn-ghost" onClick={() => setMoreOpen(o => !o)}>
              More <ChevronDown size={15} />
            </button>
            {moreOpen && (
              <div className="lms-menu" onClick={() => setMoreOpen(false)}>
                <button onClick={() => setCheckOpen(true)}>
                  <Search size={15} /> Check a learner's access
                </button>
                <button onClick={() => setOpenIds(sections.map(s => s.id))}>
                  <Layers size={15} /> Expand all sections
                </button>
                <button onClick={() => setOpenIds([])}>
                  <Layers size={15} /> Collapse all
                </button>
                <div className="lms-menu-sep" />
                {/* Every module AND every lesson at once. Confirmed rather
                    than fired on the click: it rewrites the whole course. */}
                {/* One flag on the course, cascading to everything inside it.
                    The two sweeps below are the other tool: they stamp each
                    module and lesson individually, which is what you want when
                    most of a live course is being re-recorded and a few parts
                    are not — but they overwrite per-module state and clearing
                    them cannot put it back. */}
                <button onClick={() => flipCourseComingSoon()}>
                  <Hourglass size={15} />
                  {Number(course.is_coming_soon)
                    ? 'Clear coming soon on the course'
                    : 'Mark whole course coming soon'}
                </button>
                <div className="lms-menu-sep" />
                <button onClick={() => setSweep({
                  kind: 'coming_soon', value: true,
                  title: 'Mark the whole course coming soon?',
                  message: 'Every module and lesson is badged "Coming soon" in the training portal and none of them will open. Clear it the same way.',
                  label: 'Mark coming soon',
                  done: 'Marked coming soon',
                })}>
                  <Hourglass size={15} /> Mark everything coming soon
                </button>
                <button onClick={() => setSweep({
                  kind: 'coming_soon', value: false,
                  title: 'Clear coming soon everywhere?',
                  message: 'The "Coming soon" badge is removed from every module and lesson in this course, and they open normally again.',
                  label: 'Clear coming soon',
                  done: 'Coming-soon cleared',
                })}>
                  <CheckCircle2 size={15} /> Clear coming soon everywhere
                </button>
                <div className="lms-menu-sep" />
                <button onClick={() => navigate(`/lms/responses?course_id=${courseId}`)}>
                  <ClipboardList size={15} /> View form responses
                </button>
                <button onClick={() => navigate(`/lms/enrollments?course_id=${courseId}`)}>
                  <BookOpen size={15} /> Course enrollments
                </button>
              </div>
            )}
          </div>
          <Link to={`/lms/courses?settings=${courseId}`} className="lms-btn lms-btn-ghost">
            <Settings2 size={16} /> Settings
          </Link>
        </div>
      </div>

      {/* ── search + stats strip ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', marginBottom: 22 }}>
        <div className="lms-page-actions">
          <div className="lms-search" style={{ minWidth: 240 }}>
            <Search size={16} />
            <input
              placeholder="Search lessons"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setSearch(query)}
            />
          </div>
          <button className="lms-btn lms-btn-ghost" onClick={() => setSearch(query)}>Search</button>
          {search && (
            <button className="lms-btn lms-btn-quiet" onClick={() => { setQuery(''); setSearch(''); }}>Clear</button>
          )}
        </div>

        <div className="lms-builder-stats">
          <span><EyeOff size={15} /> {stats.hidden} Hidden Lesson{stats.hidden === 1 ? '' : 's'}</span>
          <span><BookOpen size={15} /> {stats.lessons} Lesson{stats.lessons === 1 ? '' : 's'}</span>
          <span><HelpCircle size={15} /> {stats.quizzes} Quiz{stats.quizzes === 1 ? '' : 'zes'}</span>
          <span><Clock size={15} /> {duration(stats.secs)}</span>
        </div>
      </div>

      {/* ── sections ──────────────────────────────────────────── */}
      {visibleSections.length === 0 ? (
        <Empty
          icon={<Layers size={24} />}
          title={search ? 'No lessons match that search' : 'This course has no sections yet'}
          message={
            search
              ? 'Try a different keyword, or clear the search to see the full outline.'
              : 'Add your first section — for example "Module 1" — then add video lessons inside it.'
          }
          action={!search && (
            <button className="lms-btn lms-btn-dark"
              onClick={() => setSectionDraft({ title: '', description: '', drip_days: 0 })}>
              <Plus size={16} /> Add Section
            </button>
          )}
        />
      ) : (
        visibleSections.map((s, idx) => {
          const isOpen = openIds.includes(s.id);
          const lessons = s.lessons || [];
          const quizCount = lessons.filter(l => l.lesson_type === 'quiz').length;
          const lessonCount = lessons.length - quizCount;

          return (
            <div
              className={`lms-section-row${over?.kind === 'section' && over.id === s.id ? ' drop-target' : ''}`}
              key={s.id}
              draggable={grip === `section:${s.id}`}
              onDragStart={(e) => {
                e.stopPropagation();
                /* Firefox refuses to start a drag with an empty dataTransfer. */
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(s.id));
                dragRef.current = { kind: 'section', id: s.id };
              }}
              onDragEnd={() => { dragRef.current = null; setGrip(null); setOver(null); }}
              onDragOver={(e) => {
                const d = dragRef.current;
                if (d?.kind !== 'section') return;
                e.preventDefault();            // without this the drop never fires
                if (over?.id !== s.id) setOver({ kind: 'section', id: s.id });
              }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dropSection(s.id); }}
            >
              <div className="lms-section-head" onClick={() => toggleSection(s.id)}>
                <span
                  className="lms-drag-handle"
                  title="Drag to reorder this section"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={() => setGrip(`section:${s.id}`)}
                  onMouseUp={() => setGrip(null)}
                >
                  <GripVertical size={16} />
                </span>
                {isOpen ? <ChevronUp size={17} color="var(--lms-text-2)" /> : <ChevronDown size={17} color="var(--lms-text-2)" />}
                <span className="lms-section-num">{idx + 1}</span>
                <span className="lms-section-title">{s.title}</span>
                {!!Number(s.soon_effective ?? s.is_coming_soon) && (
                  <Pill tone={Number(s.soon_inherited) ? 'grey' : 'blue'}>
                    <Hourglass size={11} />
                    {Number(s.soon_inherited) ? 'Coming soon (course)' : 'Coming soon'}
                  </Pill>
                )}
                <span className="lms-section-meta">
                  {lessonCount} Lesson{lessonCount === 1 ? '' : 's'} • {quizCount} Quiz{quizCount === 1 ? '' : 'zes'}
                </span>
                <div className="lms-section-actions" onClick={e => e.stopPropagation()}>
                  {idx > 0 && (
                    <>
                      <button className="lms-icon-btn" title="Move up" onClick={() => moveSection(idx, -1)}><ArrowUp size={15} /></button>
                      <button className="lms-icon-btn" title="Move to top" onClick={() => moveSectionEdge(idx, true)}><ArrowUpToLine size={15} /></button>
                    </>
                  )}
                  {idx < visibleSections.length - 1 && (
                    <>
                      <button className="lms-icon-btn" title="Move down" onClick={() => moveSection(idx, 1)}><ArrowDown size={15} /></button>
                      <button className="lms-icon-btn" title="Move to bottom" onClick={() => moveSectionEdge(idx, false)}><ArrowDownToLine size={15} /></button>
                    </>
                  )}
                  <SectionMenu
                    section={s}
                    onFlipComingSoon={(sec) => flipSection(sec, 'is_coming_soon')}
                    onEdit={(sec) => setSectionDraft({
                      id: sec.id, title: sec.title, description: sec.description || '', drip_days: sec.drip_days || 0,
                      is_coming_soon: Number(sec.is_coming_soon ?? 0),
                      coming_soon_note: sec.coming_soon_note || '',
                    })}
                    onDelete={(sec) => setConfirm({
                      title: 'Delete this section?',
                      message: `"${sec.title}" and its ${(sec.lessons || []).length} lesson(s), including their videos, attachments and form fields, will be deleted permanently.`,
                      label: 'Delete section',
                      run: async () => {
                        await LMS.deleteSection(sec.id);
                        toast.success('Section deleted');
                        setConfirm(null);
                        load();
                      },
                    })}
                  />
                </div>
              </div>

              {isOpen && (
                <div className="lms-lesson-list">
                  {lessons.map((l, li) => {
                    const Icon = typeIcon(l.lesson_type);
                    const isCurrent = currentLesson === Number(l.id);
                    return (
                      <div
                        ref={isCurrent ? currentRef : null}
                        className={
                          'lms-lesson-row'
                          + (over?.kind === 'lesson' && over.id === l.id ? ' drop-target' : '')
                          + (isCurrent ? ' is-current' : '')
                        }
                        key={l.id}
                        draggable={grip === `lesson:${l.id}`}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', String(l.id));
                          dragRef.current = { kind: 'lesson', id: l.id, sectionId: s.id };
                        }}
                        onDragEnd={() => { dragRef.current = null; setGrip(null); setOver(null); }}
                        onDragOver={(e) => {
                          /* Only within the same section — see the drag note above. */
                          const d = dragRef.current;
                          if (d?.kind !== 'lesson' || d.sectionId !== s.id) return;
                          e.preventDefault();
                          if (over?.id !== l.id) setOver({ kind: 'lesson', id: l.id });
                        }}
                        /* stopPropagation, or the drop also bubbles to the
                           section row and fights over the same gesture. */
                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dropLesson(s.id, l.id); }}
                      >
                        <span
                          className="lms-drag-handle"
                          title="Drag to reorder within this section"
                          onMouseDown={() => setGrip(`lesson:${l.id}`)}
                          onMouseUp={() => setGrip(null)}
                        >
                          <GripVertical size={15} />
                        </span>
                        <span className="lms-lesson-num">{li + 1}</span>
                        <span className="lms-lesson-ico"><Icon size={17} /></span>
                        <span
                          className="lms-lesson-title"
                          onClick={() => {
                            /* Recorded before navigating, not after coming
                               back, so the browser Back button restores the
                               same row as the in-page back link. */
                            rememberLesson(courseId, l.id, s.id);
                            setCurrentLesson(Number(l.id));
                            navigate(`/lms/courses/${courseId}/lessons/${l.id}`);
                          }}
                        >
                          {l.title}
                        </span>
                        {/* A quiz lesson with nothing attached looks
                            complete here but dead-ends the learner, so it
                            is called out on the row itself. */}
                        {l.lesson_type === 'quiz' && !l.quiz_id && (
                          <Pill tone="amber">No quiz attached</Pill>
                        )}
                        {!!Number(l.soon_effective ?? l.is_coming_soon) && (
                          <Pill tone={Number(l.soon_inherited) ? 'grey' : 'blue'}>
                            <Hourglass size={11} />
                            {Number(l.soon_inherited) ? 'Coming soon (inherited)' : 'Coming soon'}
                          </Pill>
                        )}
                        {!!l.is_hidden && <Pill tone="grey"><EyeOff size={11} /> Hidden</Pill>}
                        {l.status === 'published' && <Pill tone="green">Published</Pill>}
                        {l.field_count > 0 && (
                          <span className="lms-lesson-chip" title="Form fields on this lesson">
                            <ClipboardList size={12} /> {l.field_count}
                          </span>
                        )}
                        {l.attachment_count > 0 && (
                          <span className="lms-lesson-chip" title="Attachments">
                            <Paperclip size={12} /> {l.attachment_count}
                          </span>
                        )}
                        <LessonMenu
                          lesson={l}
                          sections={sections}
                          onRename={(ls) => setRenameDraft({ id: ls.id, title: ls.title })}
                          onFlipComingSoon={(ls) => flipLesson(ls, 'is_coming_soon')}
                          onMove={moveLessonToSection}
                          onAddNext={(ls) => setLessonDraft({ section_id: ls.section_id, title: '', lesson_type: 'video' })}
                          onBottom={moveLessonToBottom}
                          onCopyUrl={copyLessonUrl}
                          onTrash={(ls) => setConfirm({
                            title: 'Move lesson to trash?',
                            message: `"${ls.title}" will be deleted along with its video, attachments, form fields and any responses collected on it.`,
                            label: 'Delete lesson',
                            run: async () => {
                              await LMS.deleteLesson(ls.id);
                              toast.success('Lesson deleted');
                              setConfirm(null);
                              load();
                            },
                          })}
                        />
                      </div>
                    );
                  })}

                  <button
                    className="lms-add-lesson"
                    onClick={() => setLessonDraft({ section_id: s.id, title: '', lesson_type: 'video' })}
                  >
                    <Plus size={16} /> Add lesson
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}

      {visibleSections.length > 0 && (
        <button className="lms-add-section" onClick={() => setSectionDraft({ title: '', description: '', drip_days: 0 })}>
          <Plus size={17} /> Add Section
        </button>
      )}

      {/* ── add / rename section ──────────────────────────────── */}
      <Drawer
        open={!!sectionDraft}
        title={sectionDraft?.id ? 'Edit Section' : 'Add Section'}
        subtitle={sectionDraft?.id ? 'Rename or re-describe this section' : 'Add a new section'}
        onClose={() => setSectionDraft(null)}
        footer={
          <>
            <button className="lms-btn lms-btn-ghost" onClick={() => setSectionDraft(null)}>Cancel</button>
            <button className="lms-btn lms-btn-dark" onClick={saveSection} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        {sectionDraft && (
          <>
            <div className="lms-field">
              <label className="lms-label">
                Section Title<span className="req">*</span>
                <span className="lms-char-count">{sectionDraft.title.length}/60</span>
              </label>
              <input
                className="lms-input"
                maxLength={60}
                autoFocus
                placeholder={`Section ${sections.length + 1}`}
                value={sectionDraft.title}
                onChange={e => setSectionDraft(d => ({ ...d, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && saveSection()}
              />
            </div>
            <div className="lms-field">
              <label className="lms-label">Description</label>
              <textarea
                className="lms-textarea" style={{ minHeight: 80 }}
                placeholder="What this module covers (optional)"
                value={sectionDraft.description}
                onChange={e => setSectionDraft(d => ({ ...d, description: e.target.value }))}
              />
            </div>
            <div className="lms-field">
              <label className="lms-label">Drip after (days)</label>
              <input
                className="lms-input" type="number" min="0"
                value={sectionDraft.drip_days}
                onChange={e => setSectionDraft(d => ({ ...d, drip_days: e.target.value }))}
              />
              <p className="lms-help">
                0 unlocks the section immediately. Any other value keeps it locked for that many days after enrollment.
              </p>
            </div>

            {/* Only when editing: a module being created is on and not coming
                soon, and two switches in the create form is noise. */}
            {sectionDraft.id && (
              <>
                <div className="lms-divider" />

                <div className="lms-toggle-row">
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>Coming soon</div>
                    <p className="lms-help" style={{ margin: '3px 0 0' }}>
                      The module stays in the learner's syllabus with a &ldquo;Coming soon&rdquo;
                      badge, and nothing inside it opens.
                    </p>
                  </div>
                  <Toggle
                    on={!!Number(sectionDraft.is_coming_soon)}
                    onChange={v => setSectionDraft(d => ({ ...d, is_coming_soon: v ? 1 : 0 }))}
                  />
                </div>

                {!!Number(sectionDraft.is_coming_soon) && (
                  <div className="lms-field">
                    <label className="lms-label">Coming-soon note</label>
                    <input
                      className="lms-input"
                      maxLength={120}
                      placeholder="e.g. Unlocks 15 September"
                      value={sectionDraft.coming_soon_note || ''}
                      onChange={e => setSectionDraft(d => ({ ...d, coming_soon_note: e.target.value }))}
                    />
                    <p className="lms-help">
                      Shown under the badge in the training portal. Leave it empty for a plain
                      &ldquo;Coming soon&rdquo;.
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Drawer>

      {/* ── rename a lesson ───────────────────────────────────── */}
      {/* Its own modal rather than opening the whole lesson editor: renaming
          is the one edit that is always a five-second job, and a round trip
          through the editor to change three words is what made people leave
          "Untitled lesson" rows lying around. */}
      <Modal
        open={!!renameDraft}
        title="Rename lesson"
        width={460}
        onClose={() => setRenameDraft(null)}
        footer={
          <>
            <button className="lms-btn lms-btn-ghost" onClick={() => setRenameDraft(null)}>Cancel</button>
            <button className="lms-btn lms-btn-dark" onClick={renameLesson} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        {renameDraft && (
          <div className="lms-field" style={{ marginBottom: 0 }}>
            <label className="lms-label">Lesson title<span className="req">*</span></label>
            <input
              className="lms-input"
              autoFocus
              maxLength={255}
              value={renameDraft.title}
              onChange={e => setRenameDraft(d => ({ ...d, title: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && renameLesson()}
            />
          </div>
        )}
      </Modal>

      {/* ── course-wide on / off / coming soon ────────────────── */}
      <Confirm
        open={!!sweep}
        title={sweep?.title}
        message={sweep?.message}
        confirmLabel={sweep?.label}
        danger={false}
        onCancel={() => setSweep(null)}
        onConfirm={runSweep}
      />

      {/* ── add lesson ────────────────────────────────────────── */}
      <Modal
        open={!!lessonDraft}
        title="Add Lesson"
        onClose={() => setLessonDraft(null)}
        footer={
          <>
            <button className="lms-btn lms-btn-ghost" onClick={() => setLessonDraft(null)}>Cancel</button>
            <button className="lms-btn lms-btn-dark" onClick={createLesson} disabled={saving}>
              {saving ? 'Adding…' : 'Add lesson'}
            </button>
          </>
        }
      >
        {lessonDraft && (
          <>
            <div className="lms-field">
              <label className="lms-label">Lesson title<span className="req">*</span></label>
              <input
                className="lms-input"
                autoFocus
                placeholder="e.g. Lesson 1 : Introduction to DevOps"
                value={lessonDraft.title}
                onChange={e => setLessonDraft(d => ({ ...d, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && createLesson()}
              />
            </div>
            <div className="lms-field">
              <label className="lms-label">Lesson type</label>
              <div className="lms-type-grid">
                {LESSON_TYPES.map(t => {
                  const Icon = t.icon;
                  const on = lessonDraft.lesson_type === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      aria-pressed={on}
                      className={`lms-type-card${on ? ' on' : ''}`}
                      onClick={() => setLessonDraft(d => ({ ...d, lesson_type: t.key }))}
                    >
                      <span className="i"><Icon size={17} /></span>
                      <span className="t">{t.label}</span>
                      <span className="s">{t.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* ── why can this learner not see the course? ───────────── */}
      <Modal
        open={checkOpen}
        title="Check a learner's access"
        width={520}
        onClose={() => { setCheckOpen(false); setCheckResult(null); }}
        footer={
          <>
            <button className="lms-btn lms-btn-ghost" onClick={() => { setCheckOpen(false); setCheckResult(null); }}>
              Close
            </button>
            <button className="lms-btn lms-btn-dark" onClick={runAccessCheck} disabled={checking}>
              {checking ? 'Checking…' : 'Check'}
            </button>
          </>
        }
      >
        <div className="lms-field">
          <label className="lms-label">Learner email</label>
          <input
            className="lms-input"
            autoFocus
            placeholder="The email they sign in to the training portal with"
            value={checkEmail}
            onChange={e => setCheckEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runAccessCheck()}
          />
          <p className="lms-help">
            Runs the learner portal's own access rules against this account, one condition at a time.
          </p>
        </div>

        {checkResult && (
          <>
            <div className={`lms-warn`} style={{ marginBottom: 14 }}>
              <div className="lms-warn-body">
                <b style={{ color: checkResult.can_see ? 'var(--lms-green-dark)' : 'var(--lms-red-dark)' }}>
                  {checkResult.can_see
                    ? 'This learner can see the course'
                    : `Blocked by: ${checkResult.blocking.join(', ')}`}
                </b>
                {checkResult.user
                  ? `${checkResult.user.name || checkResult.email} · user_id ${checkResult.user.user_id}`
                  : 'No account found for that email'}
              </div>
            </div>

            {checkResult.checks.map(c => (
              <div key={c.key} className={`lms-flag${c.ok ? ' on' : ''}`} style={{ alignItems: 'flex-start' }}>
                {c.info ? <Info size={14} /> : (c.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />)}
                <span>
                  <b style={{ display: 'block', color: 'var(--lms-text)' }}>{c.label}</b>
                  <span style={{ fontSize: 12, color: 'var(--lms-text-2)' }}>{c.detail}</span>
                </span>
              </div>
            ))}
          </>
        )}
      </Modal>

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
