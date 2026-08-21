// ===========================================================================
//  QuizStage.jsx — taking a quiz, in the same slot the video player occupies.
//
//  Three states: an intro card (rules + past attempts), the questions, and the
//  result. They are one component because they share the same attempt — going
//  "back" from the result has to mean "start a fresh attempt", not "resume".
//
//  Correct answers are never in this file's data until after a submit, and
//  even then only if the quiz's show_answers rule allows it. Grading happens
//  on the server; nothing here decides right from wrong.
// ===========================================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import Lightbox from './Lightbox';
import './quiz.css';

const CHOICE = ['single', 'multi', 'truefalse'];

/**
 * The admin builder stores options as { value, label } — value is a stable id
 * like "opt_1" or "true", label is what the learner reads — and lms_quiz_questions.correct
 * holds VALUES, not labels. So the answer we send back must be the value, while
 * the text on screen must be the label. Rendering the raw option was what blanked
 * the page: React cannot take {value,label} as a child, and every key collapsed
 * to "[object Object]".
 *
 * Plain strings are still accepted, because a bulk-imported question can carry
 * them, and there both halves are the same string.
 */
const asOptions = (opts) => (opts || []).map((o, i) => (
  o && typeof o === 'object'
    ? {
        value: String(o.value ?? o.label ?? i),
        label: String(o.label ?? o.value ?? ''),
        image: String(o.image ?? ''),
      }
    : { value: String(o), label: String(o), image: '' }
));

/** value -> label, for showing the right answer after a submit. */
const labelOf = (opts, value) => {
  const hit = asOptions(opts).find((o) => o.value === String(value));
  return hit ? hit.label : String(value);
};

function fmtClock(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function QuizStage({ lesson, onPassed }) {
  /* Which image the lightbox is showing, '' = closed. */
  const [zoom, setZoom] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('intro');      // intro | taking | done
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);              // seconds remaining, 0 = untimed
  const submitRef = useRef(null);

  const load = useCallback(async () => {
    setError(''); setData(null);
    try {
      setData(await api.quiz(lesson.id));
    } catch (e) {
      setError(e.message);
    }
  }, [lesson.id]);

  useEffect(() => {
    setPhase('intro'); setAnswers({}); setResult(null);
    load();
  }, [load]);

  const submit = useCallback(async (auto = false) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api.quizSubmit({ lesson_id: lesson.id, answers });
      setResult({ ...r, auto });
      setPhase('done');
      if (r.passed) onPassed?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [answers, busy, lesson.id, onPassed]);

  /* The timer reads submit through a ref so the countdown effect does not
     restart every time an answer changes. */
  submitRef.current = submit;

  useEffect(() => {
    if (phase !== 'taking' || left <= 0) return undefined;
    const t = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) { submitRef.current?.(true); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, left]);

  const start = () => {
    const mins = data?.quiz?.duration_mins || 0;
    setLeft(mins > 0 ? mins * 60 : 0);
    setAnswers({});
    setPhase('taking');
  };

  const pick = (q, value) => {
    setAnswers((prev) => {
      if (q.type === 'multi') {
        const cur = Array.isArray(prev[q.id]) ? prev[q.id] : [];
        return {
          ...prev,
          [q.id]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
        };
      }
      return { ...prev, [q.id]: value };
    });
  };

  if (error) {
    return (
      <div className="quiz-stage">
        <div className="quiz-card quiz-empty">
          <h3>This quiz is not available</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="quiz-stage"><div className="quiz-card quiz-empty"><p>Loading the quiz…</p></div></div>;
  }

  const { quiz, questions } = data;

  /* ── intro ─────────────────────────────────────────────────────────── */
  if (phase === 'intro') {
    return (
      <div className="quiz-stage">
        <div className="quiz-card">
          <span className="quiz-chip">Quiz</span>
          <h2 className="quiz-title">{quiz.title}</h2>
          {quiz.description && (
            <div className="quiz-rich" dangerouslySetInnerHTML={{ __html: quiz.description }} />
          )}

          <div className="quiz-rules">
            <div><b>{questions.length}</b><span>Question{questions.length === 1 ? '' : 's'}</span></div>
            <div><b>{quiz.total_marks}</b><span>Total marks</span></div>
            <div><b>{quiz.pass_percentage}%</b><span>To pass</span></div>
            <div>
              <b>{quiz.duration_mins > 0 ? `${quiz.duration_mins} min` : 'Untimed'}</b>
              <span>Duration</span>
            </div>
            <div>
              <b>{quiz.max_attempts > 0 ? `${quiz.attempts_left} left` : 'Unlimited'}</b>
              <span>Attempts</span>
            </div>
          </div>

          {!!quiz.negative && (
            <p className="quiz-warn">
              Negative marking is on — a wrong answer costs a quarter of that question&apos;s marks.
              Leaving one blank costs nothing.
            </p>
          )}

          {quiz.instructions && (
            <div className="quiz-instructions">
              <h4>Before you start</h4>
              <div className="quiz-rich" dangerouslySetInnerHTML={{ __html: quiz.instructions }} />
            </div>
          )}

          {quiz.can_attempt ? (
            <button className="quiz-btn primary" onClick={start} disabled={!questions.length}>
              {questions.length ? 'Start quiz' : 'No questions have been added yet'}
            </button>
          ) : (
            <p className="quiz-warn">
              You have used all {quiz.max_attempts} attempts for this quiz.
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ── result ────────────────────────────────────────────────────────── */
  if (phase === 'done' && result) {
    const byId = Object.fromEntries((result.breakdown || []).map((b) => [b.question_id, b]));
    return (
      <div className="quiz-stage">
        <div className="quiz-card">
          <div className={`quiz-verdict ${result.passed ? 'pass' : 'fail'}`}>
            <div className="quiz-score">{Math.round(result.percentage)}%</div>
            <div>
              <h2>{result.passed ? 'Passed' : 'Not passed'}</h2>
              <p>
                {result.score} of {result.total_marks} marks · pass mark {result.pass_mark}%
                {result.auto && ' · time ran out'}
              </p>
            </div>
          </div>

          {/* Only rendered when the quiz's show_answers rule let the server
              send a breakdown at all. */}
          {!!(result.breakdown || []).length && (
            <div className="quiz-review">
              {questions.map((q, i) => {
                const b = byId[q.id];
                const right = result.answers?.[q.id] || [];
                return (
                  <div key={q.id} className={`quiz-review-row ${b?.correct ? 'ok' : 'no'}`}>
                    <span className="n">{i + 1}</span>
                    <div>
                      <div className="q" dangerouslySetInnerHTML={{ __html: q.question }} />
                      {!b?.correct && !!right.length && (
                        /* correct holds option VALUES; a learner has never
                           seen "opt_2", so map each one back to its label. */
                        <div className="a">
                          Correct answer:{' '}
                          <b>{right.map((v) => labelOf(q.options, v)).join(', ')}</b>
                        </div>
                      )}
                    </div>
                    <span className="m">{b?.correct ? `+${b.marks}` : b?.marks || 0}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="quiz-actions">
            {quiz.max_attempts === 0 || quiz.attempts_used + 1 < quiz.max_attempts ? (
              <button className="quiz-btn primary" onClick={() => { load(); setPhase('intro'); }}>
                Try again
              </button>
            ) : (
              <p className="quiz-warn" style={{ margin: 0 }}>That was your last attempt.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── taking ────────────────────────────────────────────────────────── */
  const answered = questions.filter((q) => {
    const a = answers[q.id];
    return Array.isArray(a) ? a.length > 0 : a !== undefined && a !== '';
  }).length;

  return (
    <div className="quiz-stage">
      <div className="quiz-card">
        <div className="quiz-bar">
          <span>{answered} of {questions.length} answered</span>
          {left > 0 && <span className={`quiz-clock ${left <= 30 ? 'low' : ''}`}>{fmtClock(left)}</span>}
        </div>
        <div className="quiz-progress"><i style={{ width: `${(answered / questions.length) * 100}%` }} /></div>

        {questions.map((q, i) => (
          <div className="quiz-q" key={q.id}>
            <div className="quiz-q-head">
              <span className="n">{i + 1}</span>
              <div className="q" dangerouslySetInnerHTML={{ __html: q.question }} />
              <span className="marks">{q.marks} mark{q.marks === 1 ? '' : 's'}</span>
            </div>
            {q.image && (
              <button type="button" className="quiz-q-img" onClick={() => setZoom(q.image)}
                title="Tap to enlarge">
                <img src={q.image} alt="" />
              </button>
            )}

            {CHOICE.includes(q.type) ? (
              <div className="quiz-opts">
                {asOptions(q.options).map((opt) => {
                  const picked = q.type === 'multi'
                    ? (answers[q.id] || []).includes(opt.value)
                    : answers[q.id] === opt.value;
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      className={`quiz-opt ${picked ? 'on' : ''}`}
                      onClick={() => pick(q, opt.value)}
                    >
                      <span className={`box ${q.type === 'multi' ? 'sq' : ''}`} />
                      {opt.image && (
                        /* A span, not a nested <button>: the option itself is
                           already a button and nesting one inside it is invalid
                           HTML that React will not render predictably. */
                        <span
                          role="button"
                          tabIndex={-1}
                          className="quiz-opt-img"
                          title="Tap to enlarge"
                          onClick={(ev) => { ev.stopPropagation(); setZoom(opt.image); }}
                        >
                          <img src={opt.image} alt="" />
                        </span>
                      )}
                      {opt.label && <span className="quiz-opt-text">{opt.label}</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                className="quiz-input"
                placeholder="Type your answer"
                value={answers[q.id] || ''}
                onChange={(e) => pick(q, e.target.value)}
              />
            )}
          </div>
        ))}

        <div className="quiz-actions">
          <button className="quiz-btn primary" onClick={() => submit(false)} disabled={busy}>
            {busy ? 'Submitting…' : 'Submit quiz'}
          </button>
          {answered < questions.length && (
            <span className="quiz-note">
              {questions.length - answered} unanswered — they score zero.
            </span>
          )}
        </div>
      </div>

      <Lightbox src={zoom} onClose={() => setZoom('')} />
    </div>
  );
}
