// ===========================================================================
//  LmsQuizzes.jsx — the "Quizzes" tab.
//  Card list of every quiz with its question count, total marks, attempt count
//  and average score, plus create / duplicate / publish / delete.
// ===========================================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Plus, Search, HelpCircle, MoreVertical, Copy, Trash2, Eye, EyeOff,
  Clock, Target, Users, Percent, Pencil,
} from 'lucide-react';
import { LMS } from './lmsApi';
import { Loader, Empty, Pill, Drawer, Confirm, Toggle } from './LmsStyles';
import { RichText, RichHtml } from './LmsRichText';
import { useOutsideClose } from './lmsTheme';

const emptyQuiz = {
  title: '', description: '', instructions: '', course_id: '',
  duration_mins: 0, pass_percentage: 40, max_attempts: 0,
  shuffle_questions: false, shuffle_options: false,
  show_answers: 'after_submit', negative_marking: false,
  show_result: true, is_graded: true, status: 'draft',
};

function QuizMenu({ quiz, onToggle, onDuplicate, onDelete, onEdit }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClose(ref, () => setOpen(false), open);
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="lms-icon-btn" onClick={() => setOpen(o => !o)} aria-label="Quiz actions">
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="lms-menu" onClick={() => setOpen(false)}>
          <button onClick={() => onEdit(quiz)}><Pencil size={15} /> Quiz settings</button>
          <button onClick={() => onToggle(quiz)}>
            {quiz.status === 'published' ? <><EyeOff size={15} /> Unpublish</> : <><Eye size={15} /> Publish</>}
          </button>
          <button onClick={() => onDuplicate(quiz)}><Copy size={15} /> Duplicate</button>
          <div className="lms-menu-sep" />
          <button className="danger" onClick={() => onDelete(quiz)}><Trash2 size={15} /> Delete quiz</button>
        </div>
      )}
    </div>
  );
}

export default function LmsQuizzes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('');

  const [draft, setDraft] = useState(null);   // create / edit drawer state
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await LMS.listQuizzes({ q: search, course_id: courseId });
      setQuizzes(d.quizzes || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, courseId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    LMS.listCourses({ status: 'all' }).then(d => setCourses(d.courses || [])).catch(() => {});
  }, []);

  const save = async () => {
    if (!draft.title.trim()) return toast.error('Quiz title is required');
    setSaving(true);
    try {
      const payload = {
        ...draft,
        course_id: draft.course_id ? Number(draft.course_id) : 0,
        shuffle_questions: draft.shuffle_questions ? 1 : 0,
        shuffle_options: draft.shuffle_options ? 1 : 0,
        negative_marking: draft.negative_marking ? 1 : 0,
        show_result: draft.show_result ? 1 : 0,
        is_graded: draft.is_graded ? 1 : 0,
      };
      if (draft.id) {
        await LMS.updateQuiz(payload);
        toast.success('Quiz updated');
        setDraft(null);
        load();
      } else {
        const d = await LMS.createQuiz(payload);
        toast.success('Quiz created');
        setDraft(null);
        navigate(`/lms/quizzes/${d.id}`);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="lms-page">
      <div className="lms-page-head">
        <div>
          <h1 className="lms-h1">Quizzes</h1>
          <p className="lms-sub">
            Build graded assessments, attach them to any lesson, and track every attempt.
          </p>
        </div>
        <button className="lms-btn lms-btn-dark" onClick={() => setDraft({ ...emptyQuiz })}>
          <Plus size={17} /> Create quiz
        </button>
      </div>

      <div className="lms-toolbar">
        <div className="lms-search">
          <Search size={16} />
          <input placeholder="Search quizzes" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="lms-select" style={{ width: 250 }} value={courseId} onChange={e => setCourseId(e.target.value)}>
          <option value="">All courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>

      {loading ? (
        <Loader />
      ) : quizzes.length === 0 ? (
        <Empty
          icon={<HelpCircle size={24} />}
          title={search ? 'No quizzes match that search' : 'No quizzes yet'}
          message="Create a quiz, add questions to it, then bind it to a lesson from the course builder."
          action={<button className="lms-btn lms-btn-dark" onClick={() => setDraft({ ...emptyQuiz })}><Plus size={16} /> Create quiz</button>}
        />
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {quizzes.map(qz => (
            <div className="lms-card lms-card-pad" key={qz.id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <Link to={`/lms/quizzes/${qz.id}`} style={{ fontSize: 15.5, fontWeight: 600 }}>{qz.title}</Link>
                    <Pill tone={qz.status === 'published' ? 'green' : 'amber'}>
                      {qz.status === 'published' ? 'Published' : 'Draft'}
                    </Pill>
                    {qz.course_title && <Pill tone="grey">{qz.course_title}</Pill>}
                    {!!Number(qz.negative_marking) && <Pill tone="red">Negative marking</Pill>}
                  </div>
                  {qz.description && (
                    /* The description is editor HTML now, so printing it as a
                       string would show the tags. Clamped on the card because
                       a long one would push the stats out of sight. */
                    <RichHtml
                      html={qz.description}
                      className="clamp"
                      style={{ fontSize: 13, color: 'var(--lms-text-2)', margin: '0 0 12px' }}
                    />
                  )}
                  <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--lms-text-2)' }}>
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <HelpCircle size={14} /> {qz.question_count} question{qz.question_count === 1 ? '' : 's'}
                    </span>
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <Target size={14} /> {qz.total_marks} marks
                    </span>
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <Clock size={14} /> {qz.duration_mins ? `${qz.duration_mins} mins` : 'No time limit'}
                    </span>
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <Percent size={14} /> Pass at {qz.pass_percentage}%
                    </span>
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <Users size={14} /> {qz.attempt_count} attempts · avg {qz.avg_score}%
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Link to={`/lms/quizzes/${qz.id}`} className="lms-btn lms-btn-ghost lms-btn-sm">
                    Manage questions
                  </Link>
                  <QuizMenu
                    quiz={qz}
                    onEdit={(z) => setDraft({
                      ...z,
                      shuffle_questions: !!Number(z.shuffle_questions),
                      shuffle_options: !!Number(z.shuffle_options),
                      negative_marking: !!Number(z.negative_marking),
                      show_result: !!Number(z.show_result),
                      is_graded: !!Number(z.is_graded),
                    })}
                    onToggle={async (z) => {
                      try { await LMS.toggleQuiz(z.id); toast.success('Status changed'); load(); }
                      catch (e) { toast.error(e.message); }
                    }}
                    onDuplicate={async (z) => {
                      try { await LMS.duplicateQuiz(z.id); toast.success('Quiz duplicated'); load(); }
                      catch (e) { toast.error(e.message); }
                    }}
                    onDelete={(z) => setConfirm({
                      title: 'Delete this quiz?',
                      message: `"${z.title}", its ${z.question_count} question(s) and all ${z.attempt_count} attempt record(s) will be deleted. Lessons pointing at it are unbound.`,
                      run: async () => {
                        await LMS.deleteQuiz(z.id);
                        toast.success('Quiz deleted');
                        setConfirm(null);
                        load();
                      },
                    })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── create / edit quiz ────────────────────────────────── */}
      <Drawer
        open={!!draft}
        title={draft?.id ? 'Quiz settings' : 'Create quiz'}
        subtitle={draft?.id ? draft.title : 'Set the rules once — they apply to every attempt'}
        onClose={() => setDraft(null)}
        footer={
          <>
            <button className="lms-btn lms-btn-ghost" onClick={() => setDraft(null)}>Cancel</button>
            <button className="lms-btn lms-btn-dark" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : draft?.id ? 'Save changes' : 'Create quiz'}
            </button>
          </>
        }
      >
        {draft && (
          <>
            <div className="lms-field">
              <label className="lms-label">Quiz title<span className="req">*</span></label>
              <input className="lms-input" autoFocus placeholder="e.g. Module 1 — Python Basics"
                value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
            </div>
            <div className="lms-field">
              <label className="lms-label">Description</label>
              <RichText
                value={draft.description}
                onChange={v => setDraft(d => ({ ...d, description: v }))}
                height={240}
                placeholder="What this quiz covers…"
              />
            </div>
            <div className="lms-field">
              <label className="lms-label">Instructions shown before the attempt</label>
              <RichText
                value={draft.instructions}
                onChange={v => setDraft(d => ({ ...d, instructions: v }))}
                height={200}
                compact
                placeholder="Read every question carefully. You cannot go back once submitted…"
              />
            </div>
            <div className="lms-field">
              <label className="lms-label">Course</label>
              <select className="lms-select" value={draft.course_id || ''}
                onChange={e => setDraft(d => ({ ...d, course_id: e.target.value }))}>
                <option value="">Standalone (not tied to a course)</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>

            <div className="lms-divider" />
            <h3 className="lms-h3" style={{ marginBottom: 14 }}>Rules</h3>

            <div className="lms-row-3">
              <div className="lms-field">
                <label className="lms-label">Duration (mins)</label>
                <input className="lms-input" type="number" min="0" value={draft.duration_mins}
                  onChange={e => setDraft(d => ({ ...d, duration_mins: e.target.value }))} />
                <p className="lms-help">0 = untimed</p>
              </div>
              <div className="lms-field">
                <label className="lms-label">Pass %</label>
                <input className="lms-input" type="number" min="0" max="100" value={draft.pass_percentage}
                  onChange={e => setDraft(d => ({ ...d, pass_percentage: e.target.value }))} />
              </div>
              <div className="lms-field">
                <label className="lms-label">Max attempts</label>
                <input className="lms-input" type="number" min="0" value={draft.max_attempts}
                  onChange={e => setDraft(d => ({ ...d, max_attempts: e.target.value }))} />
                <p className="lms-help">0 = unlimited</p>
              </div>
            </div>

            <div className="lms-field">
              <label className="lms-label">Show correct answers</label>
              <select className="lms-select" value={draft.show_answers}
                onChange={e => setDraft(d => ({ ...d, show_answers: e.target.value }))}>
                <option value="never">Never</option>
                <option value="after_submit">Right after submitting</option>
                <option value="after_pass">Only once the learner passes</option>
              </select>
            </div>

            {[
              ['shuffle_questions', 'Shuffle questions', 'Every attempt gets a different question order.'],
              ['shuffle_options', 'Shuffle options', 'Randomises the choices inside each question.'],
              ['negative_marking', 'Negative marking', 'Deduct the per-question negative marks for wrong answers.'],
              ['show_result', 'Show score to learner', 'Turn off for surveys and ungraded checks.'],
              ['is_graded', 'Counts towards course grade', 'Ungraded quizzes are practice only.'],
            ].map(([key, label, help]) => (
              <div className="lms-toggle-row" key={key}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--lms-text-2)' }}>{help}</div>
                </div>
                <Toggle on={!!draft[key]} onChange={v => setDraft(d => ({ ...d, [key]: v }))} />
              </div>
            ))}

            <div className="lms-field" style={{ marginTop: 20 }}>
              <label className="lms-label">Status</label>
              <select className="lms-select" value={draft.status}
                onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </>
        )}
      </Drawer>

      <Confirm
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Delete quiz"
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.run()}
      />
    </div>
  );
}
