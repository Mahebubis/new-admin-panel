// ===========================================================================
//  CourseFeedback.jsx — "How would you rate this course?"
//
//  Three steps, each saved as it is finished, so a learner who stops after the
//  stars still leaves a rating:
//
//    1. stars      five big stars, the label under them following the hover
//                  ("Amazing, above expectations!")
//    2. why        the stars again (still editable) and a free-text reason
//    3. more       six quick Yes / No / Not sure questions — optional, Skip
//    4. thanks
//
//  Two ways in: the "Rate course" button in the course bar, and a small
//  snackbar that slides up after the learner completes a lesson. The snackbar
//  never covers the video and never opens the dialog by itself — a review
//  nobody asked to write is noise.
//
//  Saved through public/api/feedback.php; the admin reads it on
//  LMS → Reports → Course feedback.
// ===========================================================================
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api';
import { CheckCircle, ChevronLeft, Star } from './icons';
import './courseFeedback.css';

const FALLBACK_LABELS = {
  1: 'Awful, not what I expected at all',
  2: 'Poor, pretty disappointed',
  3: 'Average, could be better',
  4: 'Good, what I expected',
  5: 'Amazing, above expectations!',
};
const ANSWERS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
];

/** Five stars. `onPick` makes them a control; without it they are a display. */
export function Stars({ value = 0, hover = 0, onHover, onPick, size = 40 }) {
  const shown = hover || value;
  return (
    <div
      className={`fb-stars${onPick ? ' is-input' : ''}`}
      role={onPick ? 'radiogroup' : 'img'}
      aria-label={onPick ? 'Rating' : `${value} out of 5 stars`}
      onMouseLeave={() => onHover?.(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= shown;
        const star = <Star size={size} fill={on ? 'currentColor' : 'none'} strokeWidth={1.6} />;
        if (!onPick) return <span key={n} className={`fb-star${on ? ' on' : ''}`}>{star}</span>;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            className={`fb-star${on ? ' on' : ''}${value === n ? ' picked' : ''}`}
            style={{ '--i': n }}
            onMouseEnter={() => onHover?.(n)}
            onFocus={() => onHover?.(n)}
            onClick={() => onPick(n)}
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}

export default function CourseFeedback({
  open, onClose, course, existing, onSaved, progress = 0, lessonId = 0,
  initialRating = 0,   // a star already picked on the snackbar
}) {
  const [step, setStep] = useState('stars');   // stars | why | more | thanks
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState('');
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState({ questions: [], labels: FALLBACK_LABELS });

  /* Every opening starts from what was saved before, so "edit my rating"
     shows the old answers rather than a blank form. */
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setRating(initialRating || existing?.rating || 0);
      setReview(existing?.review || '');
      setAnswers(existing?.answers && typeof existing.answers === 'object' ? existing.answers : {});
      setStep(initialRating || existing?.rating ? 'why' : 'stars');
      setError('');
      setHover(0);
    }
  }

  useEffect(() => {
    if (!open || !course?.id) return;
    let alive = true;
    api.feedback(course.id)
      .then((d) => alive && setMeta({ questions: d.questions || [], labels: d.labels || FALLBACK_LABELS }))
      .catch(() => {/* the fallback labels cover it */});
    return () => { alive = false; };
  }, [open, course?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const label = useMemo(() => {
    const n = hover || rating;
    return n ? (meta.labels?.[n] || FALLBACK_LABELS[n]) : 'Select a rating';
  }, [hover, rating, meta.labels]);

  if (!open) return null;

  const save = async (payload, next) => {
    setSaving(true);
    setError('');
    try {
      const d = await api.saveFeedback({ course_id: course.id, progress, lesson_id: lessonId, ...payload });
      onSaved?.(d.feedback);
      setStep(next);
    } catch (e) {
      setError(e.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const pickStar = (n) => {
    setRating(n);
    /* Straight on to "why" — the same beat as picking a star on Udemy. */
    if (step === 'stars') setTimeout(() => setStep('why'), 260);
  };

  const questions = meta.questions.length ? meta.questions : [];

  return createPortal(
    <div className="fb" role="dialog" aria-modal="true" aria-label="Rate this course" onClick={onClose}>
      <div className={`fb-panel fb-step-${step}`} onClick={(e) => e.stopPropagation()}>
        <div className="fb-top">
          {(step === 'why' || step === 'more') ? (
            <button type="button" className="fb-back" onClick={() => setStep(step === 'more' ? 'why' : 'stars')}>
              <ChevronLeft size={16} /> Back
            </button>
          ) : <span />}
          <button type="button" className="fb-x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div key={step} className="fb-body">
          {step === 'stars' && (
            <>
              <p className="fb-kicker">{course?.title}</p>
              <h2 className="fb-title">How would you rate this course?</h2>
              <p className="fb-label">{label}</p>
              <Stars value={rating} hover={hover} onHover={setHover} onPick={pickStar} size={46} />
              <div className="fb-foot fb-foot-center">
                <button type="button" className="fb-btn fb-btn-text" onClick={onClose}>Not now</button>
              </div>
            </>
          )}

          {step === 'why' && (
            <>
              <h2 className="fb-title">Why did you leave this rating?</h2>
              <p className="fb-label">{label}</p>
              <Stars value={rating} hover={hover} onHover={setHover} onPick={setRating} size={38} />
              <textarea
                className="fb-input"
                rows={5}
                maxLength={3000}
                autoFocus
                placeholder="Tell us about your own personal experience taking this course. Was it a good match for you?"
                value={review}
                onChange={(e) => setReview(e.target.value)}
              />
              <div className="fb-foot">
                {error && <span className="fb-err">{error}</span>}
                <button
                  type="button"
                  className="fb-btn fb-btn-primary"
                  disabled={!rating || saving}
                  onClick={() => save({ rating, review }, 'more')}
                >
                  {saving ? 'Saving…' : 'Save and Continue'}
                </button>
              </div>
            </>
          )}

          {step === 'more' && (
            <>
              <h2 className="fb-title">Please tell us more <span>(optional)</span></h2>
              <div className="fb-qs">
                {questions.map((q) => (
                  <div key={q.key} className="fb-q">
                    <span className="fb-q-text">{q.text}</span>
                    <div className="fb-seg" role="radiogroup" aria-label={q.text}>
                      {ANSWERS.map((a) => (
                        <button
                          key={a.value}
                          type="button"
                          role="radio"
                          aria-checked={answers[q.key] === a.value}
                          className={`fb-seg-btn${answers[q.key] === a.value ? ' on' : ''}`}
                          onClick={() => setAnswers((x) => ({ ...x, [q.key]: x[q.key] === a.value ? undefined : a.value }))}
                        >
                          {answers[q.key] === a.value && <CheckCircle size={14} />}
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="fb-foot">
                {error && <span className="fb-err">{error}</span>}
                <button type="button" className="fb-btn fb-btn-text" onClick={() => setStep('thanks')}>Skip</button>
                <button
                  type="button"
                  className="fb-btn fb-btn-primary"
                  disabled={saving}
                  onClick={() => {
                    const clean = Object.fromEntries(Object.entries(answers).filter(([, v]) => v));
                    save({ answers: clean }, 'thanks');
                  }}
                >
                  {saving ? 'Saving…' : 'Save and Continue'}
                </button>
              </div>
            </>
          )}

          {step === 'thanks' && (
            <div className="fb-thanks">
              <span className="fb-thanks-badge"><CheckCircle size={46} /></span>
              <h2 className="fb-title">Thank you!</h2>
              <p className="fb-thanks-sub">
                Your feedback goes straight to the team that builds this course.
              </p>
              <Stars value={rating} size={26} />
              <div className="fb-foot fb-foot-center">
                <button type="button" className="fb-btn fb-btn-primary" onClick={onClose}>Back to the course</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The prompt: a Material snackbar that slides up after a lesson is
 * completed. Picking a star opens the dialog on step two with it chosen.
 */
export function FeedbackPrompt({ course, onRate, onDismiss }) {
  const [hover, setHover] = useState(0);
  return createPortal(
    <div className="fb-snack" role="complementary" aria-label="Rate this course">
      <div className="fb-snack-text">
        <b>Enjoying {course?.title || 'this course'}?</b>
        <span>{hover ? FALLBACK_LABELS[hover] : 'Tap a star to rate it — it takes ten seconds.'}</span>
      </div>
      <Stars value={0} hover={hover} onHover={setHover} onPick={onRate} size={26} />
      <button type="button" className="fb-snack-x" onClick={onDismiss} aria-label="Not now">×</button>
    </div>,
    document.body,
  );
}
