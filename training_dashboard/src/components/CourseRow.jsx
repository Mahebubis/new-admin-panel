// ===========================================================================
//  CourseRow.jsx — the wide horizontal course card.
//
//  Used by "Continue Learning" and by every row of My Enrollments: thumbnail
//  left, then the kicker ("Course"), the title, the state chip, the lesson
//  count and expiry line, and the thin progress bar with its percentage on the
//  right — the same anatomy on both screens, so a learner reads one shape.
// ===========================================================================
import { History } from './icons';
import './courseRow.css';

const fmtDate = (d) =>
  d ? new Date(String(d).replace(' ', 'T')).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) : '';

/* "today" / "yesterday" / "4 days ago", then a plain date once it is far
   enough back that counting days stops meaning anything. Fed by last_activity,
   which catalog.php reads as MAX(lms_progress.updated_at) for the course. */
function sinceLabel(stamp) {
  if (!stamp) return '';
  const then = new Date(String(stamp).replace(' ', 'T'));
  if (Number.isNaN(then.getTime())) return '';

  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(then)) / 86400000);

  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  return `on ${fmtDate(stamp)}`;
}

/* Coming soon outranks Purchased. A learner looking at this row wants to know
   whether there is anything to watch before they want to know how they paid
   for it — and "Purchased" on a course with nothing in it reads as a fault. */
const chipFor = (course) => {
  if (course.expired) return { cls: 'chip-expired', text: 'Expired' };
  if (course.coming_soon) return { cls: 'chip-soon', text: 'Coming soon' };
  if (course.access_type === 'free') return { cls: 'chip-free', text: 'Free' };
  return { cls: 'chip-purchased', text: 'Purchased' };
};

export default function CourseRow({ course, onOpen }) {
  const chip = chipFor(course);
  const soon = !!course.coming_soon;
  const expiryLabel = course.expired ? 'Expired On' : 'Expires On';
  /* Something was played here at some point, so this is not a course they are
     about to start — it is one they are in the middle of, and saying so is
     what turns a list of purchases back into a place they were. */
  /* Nothing to be in the middle of. */
  const since = course.expired || soon ? '' : sinceLabel(course.last_activity);

  return (
    <article
      className={`crow${course.expired ? ' is-expired' : ''}${soon ? ' is-soon' : ''}${since ? ' is-seen' : ''}`}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(); } }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${course.title}`}
    >
      <div className="crow-thumb">
        {course.thumbnail_url
          ? (
            <>
              {/* Decorative: the same file again, blurred, purely to fill the
                  letterbox the contained image leaves. Hidden from a11y. */}
              <img className="crow-thumb-blur" src={course.thumbnail_url} alt="" aria-hidden="true" loading="lazy" />
              <img className="crow-thumb-img" src={course.thumbnail_url} alt="" loading="lazy" />
            </>
          )
          : <span className="crow-thumb-fallback">{(course.title || '?').charAt(0).toUpperCase()}</span>}
      </div>

      <div className="crow-body">
        <div className="crow-kicker">Course</div>
        <h3 className="crow-title">{course.title}</h3>

        <div className="crow-chips">
          <span className={`chip ${chip.cls}`}>{chip.text}</span>
        </div>

        <div className="crow-meta">
          {/* A coming-soon course has no counts worth printing — every one of
              them would be 0 — so the line carries the admin's note instead,
              which is the only place a real date can come from. */}
          {soon ? (
            <span className="crow-soon">
              {course.coming_soon_note || 'We are still recording this course'}
            </span>
          ) : (
            <>
              <span>{course.lesson_count} Lesson{course.lesson_count === 1 ? '' : 's'}</span>
              {course.quiz_count > 0 && <span>{course.quiz_count} Test{course.quiz_count === 1 ? '' : 's'}</span>}
              {/* No expiry date means the course was set to lifetime access in
                  the admin panel (validity 0). Saying so is worth more than
                  saying nothing — it answers "how long do I have this for?". */}
              {course.expiry_date
                ? <span>{expiryLabel} : {fmtDate(course.expiry_date)}</span>
                : <span>Lifetime access</span>}
            </>
          )}
        </div>

        {course.description && (
          <p className="crow-desc">{stripTags(course.description)}</p>
        )}

        {since && (
          <div className="crow-seen">
            <History size={14} />
            {course.progress >= 100
              ? <>You finished this — last opened {since}</>
              : <>You were watching this {since} · <b>pick up where you left off</b></>}
          </div>
        )}

        <div className="bar-row crow-bar">
          <div className="bar"><i style={{ width: `${course.progress || 0}%` }} /></div>
          <span className="pct">{course.progress || 0}%</span>
        </div>
      </div>
    </article>
  );
}

/* Course descriptions come out of the admin's rich-text editor, so the row
   shows the words without the markup. */
function stripTags(html) {
  const text = String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}
