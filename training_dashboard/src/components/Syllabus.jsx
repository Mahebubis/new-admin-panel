// ===========================================================================
//  Syllabus.jsx — the right-hand rail of the player.
//
//  "Syllabus" heading with a search, the COURSE ANALYTICS row and its black
//  VIEW ANALYTICS button, the course progress bar, then the numbered sections.
//  A section opens to reveal its lessons; the one playing is highlighted and
//  the one after it is labelled "Up next", which is what makes the queue
//  visible without a second list.
//
//  A lesson the learner has already played carries a quiet dark-blue mark —
//  the title tints, the meta line reads "Watched 6:02 / 12:20", and a thin
//  line runs along the bottom of the row as far as they got. It is the same
//  cue MX Player puts under a half-watched video, and it answers the one
//  question a returning learner actually has: which of these was I in?
// ===========================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Attachment, CheckCircle, ChevronDown, ChevronUp, History, LessonIcon, Search } from './icons';
import './syllabus.css';

const pad2 = (n) => String(n).padStart(2, '0');

/* mm:ss, or h:mm:ss once there is an hour to show. */
const clock = (secs) => {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (v) => String(v).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
};

const typeLabel = (t) => ({
  video: 'Video', article: 'Article', pdf: 'PDF', quiz: 'Quiz', form: 'Assignment', live: 'Live',
}[t] || 'Lesson');

export default function Syllabus({ course, sections, progress, activeId, nextId, onPick }) {
  const [open, setOpen] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const searchRef = useRef(null);

  /* Whichever section holds the current lesson opens itself — a learner should
     never have to hunt for where they are. Done during render (not in an
     effect) so the section is already open on the first paint after a lesson
     change, with `seenId` making it idempotent. */
  const [seenId, setSeenId] = useState(0);
  if (seenId !== activeId) {
    setSeenId(activeId);
    const holder = sections.find((s) => s.lessons.some((l) => l.id === activeId));
    if (holder && !open.has(holder.id)) setOpen((prev) => new Set(prev).add(holder.id));
  }

  useEffect(() => { if (searching) searchRef.current?.focus(); }, [searching]);

  /* ── put the lesson being played in view ──────────────────────────────────
     Opening the section is not enough on a long course: section 4 of 9 can
     still be a screen and a half below the fold, so the learner lands on a
     rail that looks like it starts at section 1. The rail is scrolled so the
     current section's header sits at the top of it.

     Only inside the rail — scrollIntoView() on its own would drag the whole
     page down past the video, which is exactly what the sticky stage is there
     to prevent. On mobile the rail has no scrollbar of its own (see
     course.css), and then this is a no-op, which is correct: the syllabus is
     below the video there and moving it would fight the reader. */
  const listRef = useRef(null);
  const scrolledTo = useRef(0);
  useEffect(() => {
    if (!activeId || query) return;
    if (scrolledTo.current === activeId) return;

    const list = listRef.current;
    const row = list?.querySelector(`[data-lesson-id="${activeId}"]`);
    if (!list || !row) return;
    if (list.scrollHeight <= list.clientHeight + 4) return;   // nothing to scroll

    scrolledTo.current = activeId;
    const section = row.closest('.syl-sec') || row;
    /* One frame late: the section this lesson lives in may have opened in the
       same commit, and its lessons need to exist before the offset is right. */
    const t = setTimeout(() => {
      const top = section.offsetTop - list.offsetTop;
      list.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, 60);
    return () => clearTimeout(t);
  }, [activeId, query, sections]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((s) => ({ ...s, lessons: s.lessons.filter((l) => l.title.toLowerCase().includes(q)) }))
      .filter((s) => s.lessons.length > 0);
  }, [sections, query]);

  const toggle = (id) => setOpen((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  return (
    <aside className="syl">
      <div className="syl-head">
        <h2 className="syl-title">Syllabus</h2>
        {searching ? (
          <input
            ref={searchRef}
            className="syl-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => { if (!query) setSearching(false); }}
            placeholder="Search lessons"
            aria-label="Search lessons"
          />
        ) : (
          <button className="syl-icon" onClick={() => setSearching(true)} aria-label="Search lessons">
            <Search size={21} />
          </button>
        )}
      </div>

      <div className="syl-analytics">
        <span>COURSE ANALYTICS</span>
        <Link to={`/course/${course?.slug || course?.id}/analytics`} className="btn btn-dark syl-analytics-btn">
          VIEW ANALYTICS
        </Link>
      </div>

      <div className="syl-progress">
        <div className="bar"><i style={{ width: `${progress?.percent || 0}%` }} /></div>
        <span className="pct">{progress?.percent || 0}%</span>
      </div>

      <div className="syl-list" ref={listRef}>
        {filtered.length === 0 && (
          <p className="syl-none">No lessons match “{query}”.</p>
        )}

        {filtered.map((section, i) => {
          const isOpen = open.has(section.id) || !!query;
          const done = section.lessons.filter((l) => l.status === 'completed').length;

          return (
            <div key={section.id} className={`syl-sec${isOpen ? ' open' : ''}`}>
              <button className="syl-sec-head" onClick={() => toggle(section.id)} aria-expanded={isOpen}>
                <span className="syl-sec-no">{pad2(i + 1)}</span>
                <span className="syl-sec-text">
                  <span className="syl-sec-title">{section.title}</span>
                  <span className="syl-sec-meta">
                    {section.lesson_count} Lesson{section.lesson_count === 1 ? '' : 's'}
                    {section.quiz_count > 0 && ` • ${section.quiz_count} Test${section.quiz_count === 1 ? '' : 's'}`}
                    {section.attachment_count > 0 && ` • ${section.attachment_count} Attachment${section.attachment_count === 1 ? '' : 's'}`}
                    {done > 0 && ` • ${done} done`}
                  </span>
                </span>
                {isOpen ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
              </button>

              {isOpen && (
                <div className="syl-lessons">
                  {section.lessons.map((l) => {
                    const isActive = l.id === activeId;
                    const isNext = l.id === nextId;
                    const done = l.status === 'completed';
                    /* Been inside this one before. The playhead is the honest
                       measure — someone who scrubbed back to re-watch a step
                       is still mid-lesson — but an older row may only have the
                       furthest point, so the larger of the two stands in. */
                    const at = Math.max(Number(l.resume_secs) || 0, Number(l.watched_secs) || 0);
                    const seen = !done && at > 5;
                    const seenPct = seen && l.duration > 0
                      ? Math.max(3, Math.min(100, Math.round((at * 100) / l.duration)))
                      : 0;
                    return (
                      <button
                        key={l.id}
                        data-lesson-id={l.id}
                        className={[
                          'syl-lesson',
                          isActive ? 'active' : '',
                          done ? 'done' : '',
                          seen ? 'seen' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => onPick(l.id)}
                        aria-current={isActive ? 'true' : undefined}
                      >
                        <span className="syl-lesson-ico">
                          {done
                            ? <CheckCircle size={18} />
                            : <LessonIcon type={l.type} size={18} />}
                        </span>

                        <span className="syl-lesson-body">
                          <span className="syl-lesson-title">{l.title}</span>
                          <span className="syl-lesson-meta">
                            {typeLabel(l.type)}
                            {/* Part-watched and not finished: the rail is the
                                only place a learner can see, at a glance,
                                which video they are in the middle of — the
                                same job the red line under an MX Player
                                thumbnail does. */}
                            {seen && (
                              <> • <em className="syl-left">
                                <History size={12} />
                                {l.duration > 0
                                  ? `Watched ${clock(at)} / ${clock(l.duration)}`
                                  : `Watched ${clock(at)}`}
                              </em></>
                            )}
                            {l.attachments?.length > 0 && (
                              <> • <em className="syl-att"><Attachment size={13} /> Attachment</em></>
                            )}
                          </span>
                        </span>

                        {isNext
                          ? <span className="syl-upnext">Up next</span>
                          : (seen && !isActive) && <span className="syl-upnext syl-seen-tag">Continue</span>}

                        {/* The line along the bottom of the row: how far into
                            this lesson they got, without a number to read. */}
                        {seenPct > 0 && (
                          <i className="syl-seen-bar" style={{ width: `${seenPct}%` }} aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
