// ===========================================================================
//  Course.jsx — "/course/:slug", the player.
//
//  Two columns, as on the learner site:
//    left   the dark video stage with the lesson name over it, the floating
//           bookmark / kebab controls in its top corner, and the ABOUT ·
//           RECENTLY ADDED · BOOKMARKS tabs beneath it. Fullscreen belongs to
//           the player's own bar — see VideoPlayer.jsx
//    right  the Syllabus rail: course analytics, the progress ring, then every
//           section as an accordion of lessons, with the current one highlighted
//           and the next one queued
//
//  Progress
//    Position is sent at most once every 10 seconds (the player reports far
//    more often than that). When a video runs out, a card drops into the stage
//    offering "Mark as completed & play next" — completion is the learner's
//    call, not a side effect of a tab left playing to itself. "Mark As
//    Complete" in the kebab does the same thing by hand, which is also the only
//    route for the iframe providers that cannot tell us a video finished.
//
//  Autoplay
//    Any lesson opened by a CLICK starts on its own; the first lesson of a
//    page load may not, because a browser will not play unmuted audio before
//    the page has had a user gesture. See VideoPlayer's `autoPlay`.
// ===========================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { markActive, trackPage } from '../lib/tracking';
import VideoPlayer from '../components/VideoPlayer';
import QuizStage from '../components/QuizStage';
import DocStage from '../components/DocStage';
import Syllabus from '../components/Syllabus';
import { EmptyState, PageLoader } from '../components/Layout';
import { Bookmark, Check, CheckCircle, ChevronLeft, Hourglass, Kebab, Replay, SkipNext } from '../components/icons';
import './course.css';

const TABS = [
  { key: 'about',  label: 'About' },
  { key: 'recent', label: 'Recently Added' },
  { key: 'notes',  label: 'Bookmarks' },
];

/* Seconds the end-of-lesson card waits before it ticks the lesson off and
   starts the next one. Long enough to be caught by someone who wants to
   rewatch, short enough that a learner going through a course back to back is
   not asked to confirm every single video. */
const AUTO_NEXT = 5;

/* Lessons added in the last week feed the "Recently Added" tab. The API does
   not send created_at per lesson, so this is derived from the order the course
   returns — see the note in that tab's body. */
export default function Course() {
  const { slug, id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState(Number(params.get('lesson')) || 0);
  const [tab, setTab] = useState('about');
  const [menuOpen, setMenuOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [fav, setFav] = useState(false);
  const [toast, setToast] = useState('');
  /* The card that drops in when a video finishes. Held here rather than in the
     player because the choices it offers — complete, and move on — are
     course-level facts the player knows nothing about.
     `left` is the auto-advance clock; `replayToken` is bumped to send the
     player back to 0:00 for another watch. */
  const [finished, setFinished] = useState(false);
  const [left, setLeft] = useState(AUTO_NEXT);
  const [replayToken, setReplayToken] = useState(0);
  /* Autoplay is earned: the first lesson of a page load is whatever the link
     asked for and the browser may refuse to start it unprompted, but every
     lesson opened by CLICKING (the syllabus, Up next, "play next") follows a
     real user gesture and starts on its own. */
  const [autoPlay, setAutoPlay] = useState(false);

  const stageRef = useRef(null);
  /* The lesson we have already warned about a failed save on — see onProgress. */
  const warnedFor = useRef(0);

  /* ── load the course ─────────────────────────────────────────────────── */
  /* Navigating between two courses without unmounting has to show the loader
     again, so the reset happens during render keyed on the route. */
  const routeKey = slug || `id:${id}`;
  const [seenRoute, setSeenRoute] = useState(routeKey);
  if (seenRoute !== routeKey) {
    setSeenRoute(routeKey);
    setLoading(true);
    setError('');
    setData(null);
  }

  useEffect(() => {
    let alive = true;
    (slug ? api.course(slug) : api.courseById(id))
      .then((d) => {
        if (!alive) return;
        setData(d);
        if (!d.expired) {
          /* Where to open, in order of authority:
               1. ?lesson= — an explicit link, including the dashboard's
                  "Resume" handoff, which names the lesson it means
               2. the server's resume pick: the lesson this learner was last
                  on. Opening lesson one of section one every time was the
                  single most-reported annoyance with this screen
               3. the first unfinished lesson, for a course never opened */
          const wanted = Number(params.get('lesson')) || 0;
          /* Coming-soon lessons are in d.lessons — the rail renders them —
             but they are not somewhere to open a course ON. An explicit
             ?lesson= still wins: someone following a link to a locked lesson
             should get the "coming soon" panel, not be silently redirected. */
          const open = d.lessons?.filter((l) => !l.coming_soon) || [];
          const pick = d.lessons?.find((l) => l.id === wanted)
            || open.find((l) => l.id === (d.resume?.lesson_id || 0))
            || open.find((l) => l.status !== 'completed')
            || open[0]
            /* Every lesson is coming soon. Landing on the first one anyway is
               what puts the coming-soon panel on the stage; picking nothing
               left activeId at 0, which fell through to an empty video
               player captioned "no video attached". */
            || d.lessons?.[0];
          setActiveId(pick?.id || 0);
        }
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, id]);

  const course = data?.course;
  /* Memoised so the `|| []` fallback does not hand every downstream memo a new
     array identity on each render. */
  const lessons = useMemo(() => data?.lessons || [], [data?.lessons]);
  const active = useMemo(() => lessons.find((l) => l.id === activeId) || null, [lessons, activeId]);

  /* ── the order the learner actually sees ──────────────────────────────────
     "Next" has to mean the next row down the syllabus, so it is read off the
     SECTIONS rather than off the flat list. The two used to disagree:
     lms_lessons.sort_order restarts inside every module, so a flat list sorted
     by it alone interleaved them and finishing module 1 lesson 1 jumped
     straight into module 2. catalog.php now sorts by module first — this is
     the belt to that braces, and it costs one pass over a list of at most a
     few hundred rows.

     The objects come from `lessons`, not from the section copies, so the rest
     of the screen keeps reading one set of statuses. */
  const ordered = useMemo(() => {
    const secs = data?.sections || [];
    if (!secs.length) return lessons;

    const byId = new Map(lessons.map((l) => [l.id, l]));
    const out = [];
    const seen = new Set();
    secs.forEach((s) => (s.lessons || []).forEach((row) => {
      const item = byId.get(row.id);
      if (item && !seen.has(row.id)) { seen.add(row.id); out.push(item); }
    }));
    /* A lesson whose module was deleted or deactivated still belongs to the
       course; it goes last rather than disappearing out of the queue. */
    lessons.forEach((l) => { if (!seen.has(l.id)) out.push(l); });
    return out;
  }, [data?.sections, lessons]);

  const activeIndex = useMemo(() => ordered.findIndex((l) => l.id === activeId), [ordered, activeId]);
  /* The next lesson they can actually watch — "Up next" pointing at a locked
     row, and "Mark complete & play next" walking into one, both dead-end. */
  const next = useMemo(
    () => (activeIndex >= 0 ? ordered.slice(activeIndex + 1).find((l) => !l.coming_soon) || null : null),
    [ordered, activeIndex]
  );

  /**
   * Does this lesson belong on the document stage rather than in the player?
   *
   * The obvious cases are the types that are documents by definition. The one
   * worth spelling out is the last clause: a lesson typed `video` whose video
   * was never attached, but which HAS files. That combination used to render a
   * black player captioned "no video attached" while eight PDFs sat out of
   * sight below the fold — the exact complaint DocStage exists to answer, so
   * the type field is not allowed to be the only thing that decides.
   */
  const docStage = useMemo(() => {
    if (!active) return false;
    if (['article', 'pdf', 'form'].includes(active.type)) return true;
    const playable = active.video && active.video.kind && active.video.kind !== 'none';
    return !playable && ((active.attachments?.length || 0) > 0 || !!active.content);
  }, [active]);

  /* ── notes for the Bookmarks tab ─────────────────────────────────────── */
  useEffect(() => {
    if (!course?.id) return;
    let alive = true;
    api.notes(course.id)
      .then((d) => alive && setNotes(d.notes || []))
      .catch(() => {/* the tab shows its empty state */});
    return () => { alive = false; };
  }, [course?.id]);

  /* ── analytics: a lesson change is a page view ───────────────────────── */
  useEffect(() => {
    if (!course?.id) return;
    trackPage({
      path: `/course/${course.slug || course.id}`,
      title: active ? `${course.title} — ${active.title}` : course.title,
      courseId: course.id,
      lessonId: active?.id || 0,
    });
  }, [course, active]);

  /* Keep ?lesson= in step so a refresh — or a shared link — reopens here. */
  useEffect(() => {
    if (!activeId) return;
    const n = new URLSearchParams(params);
    n.set('lesson', String(activeId));
    setParams(n, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  }, []);

  /* ── progress ──────────────────────────────────────────────────────────
     The player decides WHEN to report (every ten watched seconds, and on
     pause / tab-hidden / lesson change), because only it can tell watching
     apart from scrubbing. This just writes what it is handed and keeps the
     local copy of the lesson in step, so the syllabus tick and the "12:30 of
     41:02" line move without refetching the course. */
  /* Keyed on activeId — a number — and NOT on the `active` object. The object
     is rebuilt every time a heartbeat comes back, and a new identity here
     would re-run the player's flush effect on each response: its cleanup would
     fire another save, which would come back and re-run it again. */
  const onProgress = useCallback((report) => {
    const lessonId = activeId;
    if (!lessonId) return;
    /* Watching a video is engagement even with no clicks or scrolling, so it
       keeps the analytics idle timer alive. */
    markActive();

    api.savePosition(lessonId, report)
      .then((d) => {
        if (!d) return;
        setData((prev) => {
          if (!prev) return prev;
          const patch = (l) => (l.id === lessonId
            ? {
              ...l,
              status: d.status || l.status,
              watched_secs: d.watched_secs ?? l.watched_secs,
              resume_secs: d.last_position_secs ?? l.resume_secs,
              watch_secs: d.watch_time_secs ?? l.watch_secs,
              duration: l.duration || d.duration_secs || 0,
            }
            : l);
          return {
            ...prev,
            /* Only sent when the server just auto-completed the lesson. */
            progress: d.progress || prev.progress,
            lessons: prev.lessons.map(patch),
            sections: prev.sections.map((s) => ({ ...s, lessons: s.lessons.map(patch) })),
          };
        });
      })
      .catch((e) => {
        /* A dropped heartbeat is not worth interrupting a video for — but a
           heartbeat the SERVER refused is, and it used to be swallowed in the
           same breath. That is how a learner ended up watching a whole course
           whose progress was never being written and only finding out days
           later. Said once per lesson: a message that repeats every ten
           seconds over a video is its own kind of broken.

           `status 0` is the offline case, which is genuinely not worth a
           toast — the next heartbeat carries the same position anyway. */
        if (!e?.status || warnedFor.current === lessonId) return;
        warnedFor.current = lessonId;
        flash('Your progress is not being saved. Please reload the page.');
      });
  }, [activeId, flash]);

  const [saving, setSaving] = useState(false);

  const setComplete = useCallback(async (done) => {
    if (!active?.id) return;
    setSaving(true);
    try {
      const d = await api.markComplete(active.id, done);
      setData((prev) => prev && {
        ...prev,
        progress: d.progress,
        lessons: prev.lessons.map((l) => (l.id === active.id ? { ...l, status: d.status } : l)),
        sections: prev.sections.map((s) => ({
          ...s,
          lessons: s.lessons.map((l) => (l.id === active.id ? { ...l, status: d.status } : l)),
        })),
      });
      /* The server reports the status it actually stored, so a write it
         refused cannot leave a tick on screen. */
      flash(d.status === 'completed' ? 'Marked as complete' : 'Marked as not complete');
    } catch (e) {
      flash(e.message);
    } finally {
      setSaving(false);
    }
  }, [active, flash]);

  /** Open a lesson the learner asked for by clicking. */
  const openLesson = useCallback((lessonId) => {
    if (!lessonId) return;
    setFinished(false);
    setAutoPlay(true);          // a click is the gesture autoplay needs
    setActiveId(lessonId);
  }, []);

  const goNext = useCallback(() => {
    if (!next) { flash('This is the last lesson in the course'); return; }
    openLesson(next.id);
    stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [next, flash, openLesson]);

  /* The video ran out. Nothing is recorded yet — the card asks. Auto-completing
     silently was wrong in both directions: it ticked lessons off for someone
     who had walked away from a playing tab, and it gave a learner who really
     had finished no obvious way onward except hunting the syllabus. */
  const onEnded = useCallback(() => { setFinished(true); setLeft(AUTO_NEXT); }, []);

  /** "Mark as completed & play next" — both halves, in that order. */
  const completeAndNext = useCallback(async () => {
    setFinished(false);
    if (active?.status !== 'completed') await setComplete(true);
    if (next) {
      openLesson(next.id);
      stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      flash('That was the last lesson — course complete!');
    }
  }, [active, next, setComplete, openLesson, flash]);

  /** "Revise This Lesson" — the same video, from the top, nothing recorded. */
  const revise = useCallback(() => {
    setFinished(false);
    setReplayToken((n) => n + 1);
  }, []);

  /* ── the five-second clock on the end-of-lesson card ──────────────────────
     A learner working through a course back to back should not have to
     confirm every video, so doing nothing is an answer: the lesson is ticked
     off and the next one starts. Anything they DO press cancels it, which is
     what makes the automatic path safe to have at all. */
  useEffect(() => {
    if (!finished) return undefined;
    const id = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [finished]);

  /* Latched: `completeAndNext` awaits the network, and the tick that takes
     `left` below zero would otherwise fire it a second time underneath. */
  const advanced = useRef(false);
  useEffect(() => { if (!finished) advanced.current = false; }, [finished]);
  useEffect(() => {
    if (!finished || left > 0 || advanced.current) return;
    advanced.current = true;
    completeAndNext();
  }, [finished, left, completeAndNext]);

  const toggleFav = async () => {
    if (!course?.id) return;
    try {
      const d = await api.toggleFav(course.id);
      setFav(d.favourite);
      flash(d.favourite ? 'Added to favourites' : 'Removed from favourites');
    } catch (e) { flash(e.message); }
  };

  const addNote = async () => {
    const note = noteDraft.trim();
    if (!note || savingNote || !course?.id) return;
    setSavingNote(true);
    try {
      const d = await api.addNote({ course_id: course.id, lesson_id: active?.id || 0, note });
      setNotes((n) => [{ ...d, lesson_title: active?.title }, ...n]);
      setNoteDraft('');
    } catch (e) { flash(e.message); }
    setSavingNote(false);
  };

  const removeNote = async (noteId) => {
    setNotes((n) => n.filter((x) => x.id !== noteId));
    api.deleteNote(noteId).catch(() => {});
  };

  /* ── states before the player ────────────────────────────────────────── */
  if (loading) return <PageLoader label="Opening your course…" />;

  if (error) {
    return (
      <div className="wrap">
        <EmptyState
          title="We could not open this course"
          message={error}
          action={<Link to="/enrollments" className="btn btn-outline">Back to my enrollments</Link>}
        />
      </div>
    );
  }

  if (data?.expired) {
    return (
      <div className="wrap">
        <EmptyState
          title="Your access to this course has ended"
          message={`${course?.title || 'This course'} expired on ${course?.expiry_date || 'its expiry date'}. Renew it from your dashboard to pick up where you left off.`}
          action={<Link to="/enrollments" className="btn btn-outline">Back to my enrollments</Link>}
        />
      </div>
    );
  }

  return (
    <div className="course">
      {/* ── left: stage + tabs ─────────────────────────────────────────── */}
      <div className="course-main">
        <div className="course-top">
          <button className="course-back" onClick={() => navigate('/enrollments')} aria-label="Back to my enrollments">
            <ChevronLeft size={20} />
          </button>
          <h1 className="course-name">{course?.title}</h1>

          <button className={`course-fav${fav ? ' on' : ''}`} onClick={toggleFav}>
            <Bookmark size={18} />
            {fav ? 'IN FAVOURITES' : 'ADD TO FAVOURITES'}
          </button>
        </div>

        <div className="course-stage" ref={stageRef}>
          {/* The stage used to fall through to the video player for every
              type that was not article or pdf, so a quiz lesson showed an
              empty player reading "This lesson has no video attached yet."
              Each type now gets the surface it actually needs. */}
          {/* Locked before anything else: a coming-soon lesson has whatever
              type it will eventually be, and falling through to the quiz or
              video branch would show an empty player for content that does
              not exist yet. */}
          {active?.coming_soon ? (
            <div className="stage-soon">
              <span className="stage-soon-ico"><Hourglass size={34} /></span>
              <h2 className="stage-soon-title">Coming soon</h2>
              <p className="stage-soon-note">
                {active.coming_soon_note
                  || 'This lesson is still being put together. It will open here as soon as it is ready.'}
              </p>
              {next && (
                <button type="button" className="stage-soon-go" onClick={goNext}>
                  Continue with &ldquo;{next.title}&rdquo;
                </button>
              )}
            </div>
          ) : active?.type === 'quiz' ? (
            <QuizStage lesson={active} onPassed={() => setComplete(true)} />
          ) : docStage ? (
            /* PDFs, images and every attachment render right here now, in the
               space the video would occupy — see DocStage.jsx. */
            <DocStage lesson={active} />
          ) : (
            <VideoPlayer
              video={active?.video}
              title={active?.title}
              poster={course?.thumbnail_url}
              /* The playhead, not the furthest point reached: someone who
                 scrubbed back to re-watch a step wants that step again. */
              startAt={active?.resume_secs || active?.watched_secs || 0}
              autoPlay={autoPlay}
              replayToken={replayToken}
              onProgress={onProgress}
              onEnded={onEnded}
            />
          )}

          {/* ── the end-of-lesson card ──────────────────────────────────
              Over the frozen last frame the moment the video runs out, with
              a five-second ring draining around a replay button.

              Doing nothing is a real answer, and the common one: the lesson
              is ticked off and the next starts, which is what someone working
              through a course back to back wants and what they used to have
              to click twice for on every single video. Pressing the ring
              plays this lesson again from 0:00 and records nothing new;
              pressing the button does the automatic thing immediately; the ×
              in the corner cancels the clock for someone who wants to sit
              here and read. */}
          {finished && (
            <div className="stage-done" role="dialog" aria-label="Lesson finished">
              {/* The way out of the clock for someone who wants to sit on this
                  lesson and read the notes under it. Anchored to the stage, not
                  to the card, so it stays in the corner at every size. */}
              <button
                type="button"
                className="stage-done-x"
                onClick={() => setFinished(false)}
                aria-label="Stay on this lesson"
              >
                ×
              </button>

              <div className="stage-done-card">
                {/* The ring IS the timer: it empties over five seconds, and
                    pressing it plays the lesson again from the top. */}
                <button
                  type="button"
                  className="stage-done-ring"
                  onClick={revise}
                  aria-label="Revise this lesson — play it again from the start"
                >
                  <svg className="stage-done-ring-svg" viewBox="0 0 100 100" aria-hidden="true">
                    <circle className="stage-done-ring-bg" cx="50" cy="50" r="45" />
                    <circle className="stage-done-ring-fill" cx="50" cy="50" r="45" />
                  </svg>
                  <span className="stage-done-ring-ico"><Replay size={30} /></span>
                </button>

                <div className="stage-done-title">Revise This Lesson</div>

                <button type="button" className="stage-done-go" onClick={completeAndNext}>
                  <Check size={17} />
                  {next ? 'Mark as complete and next' : 'Mark as complete'}
                </button>

                <p className="stage-done-count" role="status" aria-live="polite">
                  {next
                    ? <>Up next — <b>{next.title}</b> in {Math.max(0, left)}s</>
                    : <>Marking this course complete in {Math.max(0, left)}s</>}
                </p>
              </div>
            </div>
          )}

          {/* Bookmark and the kebab, and nothing else over the picture.
              Fullscreen used to live here too, directly over the player's own
              fullscreen button — two of them in one corner. It now belongs to
              the player, which is the thing that can also turn a phone
              landscape when it opens. These sit at the TOP of the stage so
              they clear the control bar underneath.

              Completion is not here either: the end-of-lesson card asks at the
              one moment the answer is obvious, and the kebab keeps the manual
              route for a lesson somebody wants to tick off without sitting
              through it. */}
          <div className="stage-controls">
            <button className="stage-btn" onClick={toggleFav} aria-label="Bookmark this course">
              <Bookmark size={19} />
            </button>
            <div className="stage-menu-wrap">
              <button
                className="stage-btn"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Lesson options"
              >
                <Kebab size={19} />
              </button>

              {menuOpen && (
                <>
                  <div className="stage-menu-scrim" onClick={() => setMenuOpen(false)} />
                  <div className="stage-menu" role="menu">
                    <button role="menuitem" onClick={() => { setMenuOpen(false); goNext(); }}>
                      <SkipNext size={18} /> Next Lesson
                    </button>
                    <button
                      role="menuitem"
                      disabled={saving}
                      onClick={() => { setMenuOpen(false); setComplete(active?.status !== 'completed'); }}
                    >
                      {active?.status === 'completed' ? <CheckCircle size={18} /> : <Check size={18} />}
                      {active?.status === 'completed' ? 'Mark As Incomplete' : 'Mark As Complete'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="course-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={`course-tab${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="course-panel">
          {tab === 'about' && <AboutTab course={course} lesson={active} progress={data?.progress} />}
          {tab === 'recent' && <RecentTab />}
          {tab === 'notes' && (
            <NotesTab
              notes={notes}
              draft={noteDraft}
              setDraft={setNoteDraft}
              onAdd={addNote}
              onRemove={removeNote}
              saving={savingNote}
            />
          )}
        </div>
      </div>

      {/* ── right: syllabus ────────────────────────────────────────────── */}
      <Syllabus
        course={course}
        sections={data?.sections || []}
        progress={data?.progress}
        activeId={activeId}
        nextId={next?.id || 0}
        onPick={openLesson}
      />

      {toast && <div className="course-toast" role="status">{toast}</div>}
    </div>
  );
}

/* mm:ss, or h:mm:ss once there is an hour to show. */
function clock(secs) {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (v) => String(v).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/* ── the ABOUT tab ─────────────────────────────────────────────────────── */
function AboutTab({ course, lesson, progress }) {
  /* Where they are in THIS video, which is the number a learner coming back
     actually looks for. Only shown once the length is known — a lesson whose
     duration nobody ever measured would otherwise read "6:02 of 0:00". */
  const spot = lesson?.duration > 0
    ? `${clock(lesson.resume_secs || lesson.watched_secs || 0)} of ${clock(lesson.duration)}`
    : null;

  return (
    <div className="panel-pad fade-up">
      <div className="about-stats">
        <Stat label="Lessons" value={progress?.total ?? 0} />
        <Stat label="Completed" value={progress?.completed ?? 0} />
        <Stat label="Progress" value={`${progress?.percent ?? 0}%`} />
        {progress?.watch_secs > 0 && (
          <Stat label="Time watched" value={clock(progress.watch_secs)} />
        )}
      </div>

      {lesson?.title && (
        <>
          <h3 className="panel-h">{lesson.title}</h3>
          {spot && (
            <p className="about-spot">
              You are at <b>{spot}</b>
              {lesson.status === 'completed' && <span className="about-done"> · completed</span>}
            </p>
          )}
          {lesson.attachments?.length > 0 && (
            <div className="about-files">
              {lesson.attachments.map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="about-file">
                  {a.title || a.file_name || 'Attachment'}
                </a>
              ))}
            </div>
          )}
        </>
      )}

      {course?.description ? (
        <div className="rich" dangerouslySetInnerHTML={{ __html: course.description }} />
      ) : (
        <p className="muted" style={{ marginTop: 12 }}>No description has been added for this course yet.</p>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="about-stat">
      <div className="about-stat-v">{value}</div>
      <div className="about-stat-l">{label}</div>
    </div>
  );
}

/* ── the RECENTLY ADDED tab ────────────────────────────────────────────── */
function RecentTab() {
  return (
    <div className="panel-pad fade-up">
      <div className="panel-head">
        <h3 className="panel-h">New Lesson <span className="panel-n">00</span></h3>
      </div>
      <p className="muted" style={{ marginTop: 2 }}>View all the lessons added in past 7 days</p>
      <EmptyState
        title="No Recent Lessons"
        message="No lessons have been added in the past 7 days"
      />
    </div>
  );
}

/* ── the BOOKMARKS tab ─────────────────────────────────────────────────── */
function NotesTab({ notes, draft, setDraft, onAdd, onRemove, saving }) {
  const count = String(notes.length).padStart(2, '0');
  return (
    <div className="panel-pad fade-up">
      <div className="panel-head">
        <h3 className="panel-h">Lesson Bookmarks <span className="panel-n">{count}</span></h3>
      </div>

      <textarea
        className="note-input"
        rows={4}
        placeholder="Add a note here"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label="Add a note"
      />
      <button
        className={`btn note-add${draft.trim() ? ' ready' : ''}`}
        onClick={onAdd}
        disabled={!draft.trim() || saving}
      >
        {saving ? 'ADDING…' : 'ADD NOTE'}
      </button>

      {notes.length === 0 ? (
        <EmptyState title="No Bookmark Available" message="There is no Bookmark available to read" />
      ) : (
        <ul className="note-list">
          {notes.map((n) => (
            <li key={n.id} className="note">
              <div>
                {n.lesson_title && <div className="note-lesson">{n.lesson_title}</div>}
                <p className="note-text">{n.note}</p>
                <div className="note-date">
                  {new Date(String(n.created_at).replace(' ', 'T')).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              </div>
              <button className="note-del" onClick={() => onRemove(n.id)} aria-label="Delete note">Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
