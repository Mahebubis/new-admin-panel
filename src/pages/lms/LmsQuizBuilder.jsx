// ===========================================================================
//  LmsQuizBuilder.jsx — question bank for one quiz.
//
//  Question types: single choice, multiple choice, true/false, fill in the
//  blank, short answer and paragraph. Choice questions carry per-option
//  correctness, per-question marks / negative marks, a difficulty tag and an
//  explanation the learner sees after submitting.
//
//  Three tabs: Questions (the bank), Attempts (who took it, what they scored)
//  and Analysis (per-question accuracy across every attempt).
// ===========================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ChevronLeft, Plus, Pencil, Trash2, ArrowUp, ArrowDown, HelpCircle, Target,
  Clock, Percent, FileUp, CheckCircle2, XCircle, BarChart3, Users, Eye,
  FileSpreadsheet, Download, AlertTriangle, RotateCcw,
} from 'lucide-react';
import { LMS, shortDate } from './lmsApi';
import LmsImageField from './LmsImageField';
import { Loader, Empty, Pill, Drawer, Modal, Confirm, Toggle } from './LmsStyles';

/* Imported banks carry markup in the question — <p><b>Which of these…</b></p>.
   The learner's quiz renders that as HTML, so the builder has to as well or
   the two disagree about what the question looks like. Option labels are
   flattened to plain text at import time and stay plain here. */
function QuestionText({ html, ...rest }) {
  return <span {...rest} dangerouslySetInnerHTML={{ __html: String(html ?? '') }} />;
}

const Q_TYPES = [
  { key: 'single',    label: 'Single choice',    hint: 'Exactly one correct option' },
  { key: 'multi',     label: 'Multiple choice',  hint: 'Two or more correct options' },
  { key: 'truefalse', label: 'True / False',     hint: 'A two-option shortcut' },
  { key: 'fill',      label: 'Fill in the blank',hint: 'Learner types the missing word' },
  { key: 'short',     label: 'Short answer',     hint: 'One-line free text — graded manually' },
  { key: 'paragraph', label: 'Paragraph',        hint: 'Long free text — graded manually' },
];
const CHOICE = ['single', 'multi', 'truefalse'];
const TEXT_ANSWER = ['fill', 'short', 'paragraph'];

const blankQuestion = (type = 'single') => ({
  question_type: type,
  question: '',
  explanation: '',
  marks: 1,
  negative_marks: 0,
  difficulty: 'medium',
  status: 'active',
  image_url: '',
  /* An option is { value, label, image? }. value is the stable id stored in
     `correct`; label is the text; image is an optional S3 URL. The image key
     rides along inside the existing options JSON, so no migration is needed. */
  options: type === 'truefalse'
    ? [{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }]
    : CHOICE.includes(type)
      ? [{ value: 'opt_1', label: '' }, { value: 'opt_2', label: '' }]
      : [],
  correct: [],
});

export default function LmsQuizBuilder() {
  const { quizId } = useParams();
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [tab, setTab] = useState('questions');

  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  /* The spreadsheet route. `parsed` is the server's read of the file, held
     here between the two steps — nothing is written until Import is pressed. */
  const [bulkTab, setBulkTab] = useState('file');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const fileInput = useRef(null);

  const [attempts, setAttempts] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [attemptDetail, setAttemptDetail] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await LMS.getQuiz(quizId);
      setQuiz(d.quiz);
      setQuestions(d.questions || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useEffect(() => {
    if (tab === 'attempts') {
      LMS.listAttempts({ quiz_id: quizId, limit: 200 })
        .then(d => setAttempts(d.attempts || []))
        .catch(e => toast.error(e.message));
    }
    if (tab === 'analysis') {
      LMS.quizReport(quizId)
        .then(setAnalysis)
        .catch(e => toast.error(e.message));
    }
  }, [tab, quizId]);

  const totalMarks = useMemo(
    () => questions.filter(q => q.status === 'active').reduce((a, q) => a + Number(q.marks || 0), 0),
    [questions]
  );

  const changeType = (type) => setDraft(d => {
    const next = { ...d, question_type: type, correct: [] };
    if (type === 'truefalse') {
      next.options = [{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }];
    } else if (CHOICE.includes(type)) {
      next.options = d.options?.length ? d.options : [{ value: 'opt_1', label: '' }, { value: 'opt_2', label: '' }];
    } else {
      next.options = [];
    }
    return next;
  });

  const toggleCorrect = (value) => setDraft(d => {
    if (d.question_type === 'multi') {
      const has = d.correct.includes(value);
      return { ...d, correct: has ? d.correct.filter(v => v !== value) : [...d.correct, value] };
    }
    return { ...d, correct: [value] };
  });

  const saveQuestion = async () => {
    if (!draft.question.trim()) return toast.error('Question text is required');
    if (CHOICE.includes(draft.question_type)) {
      /* An image-only option is legitimate — "pick the right diagram" has
         no text at all — so an option counts as filled if it has either. */
      const filled = draft.options.filter(o => o.label.trim() || o.image);
      if (filled.length < 2) return toast.error('Add at least two options');
      if (draft.correct.length === 0) return toast.error('Mark at least one correct option');
    }
    if (TEXT_ANSWER.includes(draft.question_type) && draft.question_type === 'fill' && !draft.correct.length) {
      return toast.error('Enter the accepted answer for the blank');
    }

    setSaving(true);
    try {
      const payload = {
        ...draft,
        quiz_id: Number(quizId),
        marks: Number(draft.marks || 1),
        negative_marks: Number(draft.negative_marks || 0),
        options: draft.options.filter(o => o.label.trim() || o.image),
      };
      if (draft.id) await LMS.updateQuestion(payload);
      else await LMS.createQuestion(payload);
      toast.success(draft.id ? 'Question updated' : 'Question added');
      setDraft(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const move = async (index, dir) => {
    const next = [...questions];
    const t = index + dir;
    if (t < 0 || t >= next.length) return;
    [next[index], next[t]] = [next[t], next[index]];
    setQuestions(next);
    try { await LMS.reorderQuestions(next.map(q => q.id)); }
    catch (e) { toast.error(e.message); load(); }
  };

  /* ── spreadsheet import ────────────────────────────────────────────────
     Step 1. The file goes up, comes back parsed, and nothing is saved: the
     admin gets to see what the columns were read as before any of it lands in
     the bank. A mis-read CorrectOption column would silently mark the wrong
     answer right, which is the one mistake here that is invisible afterwards. */
  const pickFile = async (file) => {
    if (!file) return;
    setParsing(true);
    setParsed(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('quiz_id', String(quizId));
      const d = await LMS.importParseQuestions(fd);
      setParsed(d);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setParsing(false);
      /* cleared so re-picking the SAME file after a failure still fires
         onChange — the browser does not re-fire for an unchanged value */
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  /* Step 2. */
  const runFileImport = async () => {
    if (!parsed?.questions?.length) return;
    setSaving(true);
    try {
      const d = await LMS.importRunQuestions(Number(quizId), parsed.questions);
      toast.success(d._message || `${d.added} question(s) imported`);
      if ((d.failed || []).length) toast.error(`${d.failed.length} could not be saved`);
      closeBulk();
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const closeBulk = () => {
    setBulkOpen(false);
    setParsed(null);
    setBulkText('');
  };

  /* The column names this importer looks for, as a file they can open in
     Excel and fill in — cheaper than documenting the format in a paragraph
     nobody reads. Two sample rows show a single-answer and a two-answer
     question, which is the only part of the format that is not obvious. */
  const downloadTemplate = () => {
    const rows = [
      ['SerialNo', 'SectionName', 'PositiveMarks', 'NegativeMarks', 'Level',
       'Question', 'QuestionType', 'CorrectOption', 'Option1', 'Option2', 'Option3', 'Option4'],
      ['1', 'Section 1', '1', '0', 'EASY',
       'What does CPU stand for?', 'MULTI_CHOICE', '2',
       'Central Power Unit', 'Central Processing Unit', 'Computer Personal Unit', 'Control Panel Unit'],
      ['2', 'Section 1', '2', '0', 'MEDIUM',
       'Which of these are Python data types?', 'MULTI_CHOICE', '1,3',
       'list', 'schema', 'dict', 'table'],
    ];
    /* Quote every cell and double any quote inside it — question text is full
       of commas, and one unquoted comma shifts every column after it. */
    const csv = rows
      .map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(','))
      .join('\r\n');
    /* The BOM is what makes Excel open a UTF-8 CSV as UTF-8 rather than as
       the system codepage — without it every non-ASCII character is mojibake. */
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quiz-questions-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const runBulk = async () => {
    if (!bulkText.trim()) return toast.error('Paste at least one question line');
    setSaving(true);
    try {
      const d = await LMS.bulkCreateQuestions({ quiz_id: Number(quizId), text: bulkText });
      toast.success(`${d.added} question(s) imported`);
      if ((d.skipped || []).length) {
        toast.error(`${d.skipped.length} line(s) skipped — check the format`);
      }
      closeBulk();
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;
  if (!quiz) {
    return (
      <div className="lms-page">
        <Empty
          icon={<HelpCircle size={24} />}
          title="Quiz not found"
          message="It may have been deleted."
          action={<Link to="/lms/quizzes" className="lms-btn lms-btn-dark">Back to quizzes</Link>}
        />
      </div>
    );
  }

  return (
    <div className="lms-page">
      <div className="lms-breadcrumb">
        <Link to="/lms/quizzes" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <ChevronLeft size={15} /> Quizzes
        </Link>
      </div>

      <div className="lms-page-head" style={{ alignItems: 'center' }}>
        <div>
          <div className="lms-chip-row" style={{ marginBottom: 10 }}>
            <Pill tone={quiz.status === 'published' ? 'green' : 'amber'}>
              {quiz.status === 'published' ? 'Published' : 'Draft'}
            </Pill>
            {!!Number(quiz.negative_marking) && <Pill tone="red">Negative marking</Pill>}
            {!Number(quiz.is_graded) && <Pill tone="grey">Ungraded</Pill>}
          </div>
          <h1 className="lms-h1">{quiz.title}</h1>
          <div className="lms-builder-stats" style={{ marginTop: 10 }}>
            <span><HelpCircle size={15} /> {questions.length} questions</span>
            <span><Target size={15} /> {totalMarks} marks</span>
            <span><Clock size={15} /> {quiz.duration_mins ? `${quiz.duration_mins} mins` : 'Untimed'}</span>
            <span><Percent size={15} /> Pass at {quiz.pass_percentage}%</span>
          </div>
        </div>
        <div className="lms-page-actions">
          <button className="lms-btn lms-btn-ghost" onClick={() => setBulkOpen(true)}>
            <FileUp size={16} /> Bulk import
          </button>
          <button className="lms-btn lms-btn-dark" onClick={() => setDraft(blankQuestion())}>
            <Plus size={17} /> Add question
          </button>
        </div>
      </div>

      <div className="lms-segment" style={{ marginBottom: 22 }}>
        {[
          { k: 'questions', l: `Questions (${questions.length})` },
          { k: 'attempts', l: 'Attempts' },
          { k: 'analysis', l: 'Analysis' },
        ].map(t => (
          <button key={t.k} className={tab === t.k ? 'active' : ''} onClick={() => setTab(t.k)}>{t.l}</button>
        ))}
      </div>

      {/* ═══ QUESTIONS ═══ */}
      {tab === 'questions' && (
        questions.length === 0 ? (
          <Empty
            icon={<HelpCircle size={24} />}
            title="No questions yet"
            message="Add questions one by one, or paste a whole block with Bulk import."
            action={<button className="lms-btn lms-btn-dark" onClick={() => setDraft(blankQuestion())}><Plus size={16} /> Add question</button>}
          />
        ) : (
          questions.map((qq, i) => (
            <div className="lms-card lms-card-pad" key={qq.id}
              style={{ marginBottom: 12, opacity: qq.status === 'inactive' ? 0.6 : 1 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0, fontSize: 12.5, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--lms-bg-soft)', color: 'var(--lms-text-2)',
                }}>{i + 1}</span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <QuestionText className="lms-q-text" html={qq.question} style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, lineHeight: 1.5, display: 'block' }} />

                  {CHOICE.includes(qq.question_type) && (
                    <div style={{ display: 'grid', gap: 5, marginBottom: 10 }}>
                      {(qq.options || []).map(o => {
                        const right = (qq.correct || []).includes(o.value);
                        return (
                          <div key={o.value} style={{
                            display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5,
                            color: right ? 'var(--lms-green-dark)' : 'var(--lms-text-2)',
                            fontWeight: right ? 500 : 400,
                          }}>
                            {right ? <CheckCircle2 size={14} /> : <XCircle size={14} color="var(--lms-text-3)" />}
                            {o.label}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {qq.question_type === 'fill' && (qq.correct || []).length > 0 && (
                    <div style={{ fontSize: 12.5, color: 'var(--lms-green-dark)', marginBottom: 10 }}>
                      Accepted answer: {(qq.correct || []).join(', ')}
                    </div>
                  )}
                  {qq.explanation && (
                    <div style={{
                      fontSize: 12.5, color: 'var(--lms-text-2)', padding: 10, borderRadius: 7,
                      background: 'var(--lms-bg-page)', lineHeight: 1.6, marginBottom: 10,
                    }}>
                      <strong>Explanation:</strong> {qq.explanation}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Pill tone="blue">{Q_TYPES.find(t => t.key === qq.question_type)?.label || qq.question_type}</Pill>
                    <Pill tone="grey">{qq.marks} mark{qq.marks === 1 ? '' : 's'}</Pill>
                    {Number(qq.negative_marks) > 0 && <Pill tone="red">−{qq.negative_marks}</Pill>}
                    <Pill tone={qq.difficulty === 'hard' ? 'red' : qq.difficulty === 'easy' ? 'green' : 'amber'}>
                      {qq.difficulty}
                    </Pill>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button className="lms-icon-btn" disabled={i === 0} onClick={() => move(i, -1)} title="Move up">
                    <ArrowUp size={15} />
                  </button>
                  <button className="lms-icon-btn" disabled={i === questions.length - 1} onClick={() => move(i, 1)} title="Move down">
                    <ArrowDown size={15} />
                  </button>
                  <button className="lms-icon-btn" title="Edit" onClick={() => setDraft({ ...qq })}>
                    <Pencil size={15} />
                  </button>
                  <button
                    className="lms-icon-btn danger"
                    title="Delete"
                    onClick={() => setConfirm({
                      title: 'Delete this question?',
                      message: 'It will be removed from the quiz. Past attempt records keep their stored answers.',
                      run: async () => {
                        await LMS.deleteQuestion(qq.id);
                        toast.success('Question deleted');
                        setConfirm(null);
                        load();
                      },
                    })}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )
      )}

      {/* ═══ ATTEMPTS ═══ */}
      {tab === 'attempts' && (
        attempts.length === 0 ? (
          <Empty icon={<Users size={24} />} title="No attempts yet"
            message="Once learners take this quiz, every attempt shows up here with its score." />
        ) : (
          <div className="lms-table-wrap">
            <div className="lms-table-scroll">
              <table className="lms-table">
                <thead>
                  <tr><th>Learner</th><th>Score</th><th>Percentage</th><th>Result</th><th>Submitted</th><th /></tr>
                </thead>
                <tbody>
                  {attempts.map(a => (
                    <tr key={a.id}>
                      <td>
                        <div className="lms-user-cell">
                          <div className="lms-avatar">{(a.name || a.email || '?').charAt(0)}</div>
                          <div>
                            <div className="lms-user-name">{a.name || '—'}</div>
                            <div className="lms-user-mail">{a.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{a.score} / {a.total_marks}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div className="lms-progress-bar"><i style={{ width: `${Math.min(100, a.percentage)}%` }} /></div>
                          <span style={{ fontSize: 12 }}>{a.percentage}%</span>
                        </div>
                      </td>
                      <td><Pill tone={a.passed ? 'green' : 'red'}>{a.passed ? 'Passed' : 'Failed'}</Pill></td>
                      <td>{shortDate(a.submitted_at)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="lms-icon-btn" title="View answers"
                          onClick={async () => {
                            try {
                              const d = await LMS.getAttempt(a.id);
                              setAttemptDetail(d.attempt);
                            } catch (e) { toast.error(e.message); }
                          }}>
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ═══ ANALYSIS ═══ */}
      {tab === 'analysis' && (
        !analysis ? <Loader inline /> : (
          <>
            <div className="lms-stat-strip">
              {[
                { l: 'Attempts', v: analysis.summary?.attempts ?? 0 },
                { l: 'Average score', v: `${Math.round(analysis.summary?.avg_pct ?? 0)}%` },
                { l: 'Highest', v: `${Math.round(analysis.summary?.max_pct ?? 0)}%` },
                { l: 'Passed', v: analysis.summary?.passed ?? 0 },
              ].map(s => (
                <div className="lms-stat" key={s.l}>
                  <div>
                    <div className="lms-stat-label">{s.l}</div>
                    <div className="lms-stat-value">{s.v}</div>
                  </div>
                  <div className="lms-stat-ico"><BarChart3 size={18} /></div>
                </div>
              ))}
            </div>

            {(analysis.questions || []).length === 0 ? (
              <Empty icon={<BarChart3 size={24} />} title="Nothing to analyse yet"
                message="Per-question accuracy appears once learners start submitting." />
            ) : (
              <div className="lms-table-wrap">
                <div className="lms-table-scroll">
                  <table className="lms-table">
                    <thead><tr><th>#</th><th>Question</th><th>Correct</th><th>Wrong</th><th>Accuracy</th></tr></thead>
                    <tbody>
                      {analysis.questions.map((qq, i) => {
                        const tot = qq.right + qq.wrong;
                        const acc = tot ? Math.round(qq.right * 100 / tot) : 0;
                        return (
                          <tr key={qq.id}>
                            <td>{i + 1}</td>
                            <td style={{ maxWidth: 420 }}>{qq.question}</td>
                            <td>{qq.right}</td>
                            <td>{qq.wrong}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                <div className="lms-progress-bar"><i style={{ width: `${acc}%` }} /></div>
                                <span style={{ fontSize: 12 }}>{acc}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )
      )}

      {/* ── question editor ───────────────────────────────────── */}
      <Drawer
        open={!!draft}
        title={draft?.id ? 'Edit question' : 'Add question'}
        subtitle={draft ? Q_TYPES.find(t => t.key === draft.question_type)?.hint : ''}
        onClose={() => setDraft(null)}
        footer={
          <>
            <button className="lms-btn lms-btn-ghost" onClick={() => setDraft(null)}>Cancel</button>
            <button className="lms-btn lms-btn-dark" onClick={saveQuestion} disabled={saving}>
              {saving ? 'Saving…' : 'Save question'}
            </button>
          </>
        }
      >
        {draft && (
          <>
            <div className="lms-field">
              <label className="lms-label">Question type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {Q_TYPES.map(t => {
                  const on = draft.question_type === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => changeType(t.key)}
                      style={{
                        padding: '10px 12px', borderRadius: 8, textAlign: 'left', fontSize: 12.5,
                        border: `1px solid ${on ? 'var(--lms-green)' : 'var(--lms-border-2)'}`,
                        background: on ? 'var(--lms-green-soft)' : '#fff',
                        fontWeight: on ? 600 : 400,
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lms-field">
              <label className="lms-label">Question<span className="req">*</span></label>
              <textarea className="lms-textarea" style={{ minHeight: 90 }} autoFocus
                placeholder="What is the output of print(2 ** 3)?"
                value={draft.question} onChange={e => setDraft(d => ({ ...d, question: e.target.value }))} />
            </div>

            <div className="lms-field">
              <label className="lms-label">Question image</label>
              <LmsImageField
                value={draft.image_url}
                onChange={url => setDraft(d => ({ ...d, image_url: url }))}
                label="Upload image"
              />
              <p className="lms-help">
                Uploaded to S3. Learners can tap it to open it full-size.
              </p>
            </div>

            {CHOICE.includes(draft.question_type) && (
              <div className="lms-field">
                <label className="lms-label">
                  Options — tick the correct {draft.question_type === 'multi' ? 'ones' : 'one'}
                </label>
                {draft.options.map((o, i) => {
                  const right = draft.correct.includes(o.value);
                  return (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <button
                        onClick={() => toggleCorrect(o.value)}
                        title={right ? 'Correct answer' : 'Mark as correct'}
                        style={{
                          width: 34, height: 34, borderRadius: 7, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: right ? 'var(--lms-green-soft)' : 'var(--lms-bg-soft)',
                          color: right ? 'var(--lms-green-dark)' : 'var(--lms-text-3)',
                        }}
                      >
                        <CheckCircle2 size={17} />
                      </button>
                      <input
                        className="lms-input"
                        placeholder={`Option ${i + 1}`}
                        readOnly={draft.question_type === 'truefalse'}
                        value={o.label}
                        onChange={e => setDraft(d => {
                          const opts = [...d.options];
                          /* Spread, not a fresh literal: rebuilding the object
                             from value+label alone silently dropped the image
                             the moment anyone edited the text. */
                          opts[i] = { ...o, label: e.target.value };
                          return { ...d, options: opts };
                        })}
                      />
                      {draft.question_type !== 'truefalse' && (
                        <LmsImageField
                          compact
                          label={`Image for option ${i + 1}`}
                          value={o.image || ''}
                          onChange={url => setDraft(d => {
                            const opts = [...d.options];
                            opts[i] = { ...o, image: url };
                            return { ...d, options: opts };
                          })}
                        />
                      )}
                      {draft.question_type !== 'truefalse' && (
                        <button
                          className="lms-icon-btn danger"
                          disabled={draft.options.length <= 2}
                          onClick={() => setDraft(d => ({
                            ...d,
                            options: d.options.filter((_, x) => x !== i),
                            correct: d.correct.filter(v => v !== o.value),
                          }))}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  );
                })}
                {draft.question_type !== 'truefalse' && (
                  <button
                    className="lms-btn lms-btn-ghost lms-btn-sm"
                    onClick={() => setDraft(d => ({
                      ...d,
                      options: [...d.options, { value: `opt_${d.options.length + 1}_${Date.now().toString(36)}`, label: '' }],
                    }))}
                  >
                    <Plus size={15} /> Add option
                  </button>
                )}
              </div>
            )}

            {draft.question_type === 'fill' && (
              <div className="lms-field">
                <label className="lms-label">Accepted answers</label>
                <input
                  className="lms-input"
                  placeholder="Comma-separated, e.g. 8, eight"
                  value={(draft.correct || []).join(', ')}
                  onChange={e => setDraft(d => ({
                    ...d,
                    correct: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                  }))}
                />
                <p className="lms-help">Matching is case-insensitive. Any listed answer counts as correct.</p>
              </div>
            )}

            {(draft.question_type === 'short' || draft.question_type === 'paragraph') && (
              <div style={{
                padding: 12, background: 'var(--lms-amber-soft)', color: 'var(--lms-amber-dark)',
                borderRadius: 8, fontSize: 12.5, marginBottom: 18, lineHeight: 1.6,
              }}>
                Free-text answers are stored with the attempt and graded manually — they don't count towards the
                auto-calculated score.
              </div>
            )}

            <div className="lms-row-3">
              <div className="lms-field">
                <label className="lms-label">Marks</label>
                <input className="lms-input" type="number" min="0" step="0.5" value={draft.marks}
                  onChange={e => setDraft(d => ({ ...d, marks: e.target.value }))} />
              </div>
              <div className="lms-field">
                <label className="lms-label">Negative marks</label>
                <input className="lms-input" type="number" min="0" step="0.25" value={draft.negative_marks}
                  onChange={e => setDraft(d => ({ ...d, negative_marks: e.target.value }))} />
              </div>
              <div className="lms-field">
                <label className="lms-label">Difficulty</label>
                <select className="lms-select" value={draft.difficulty}
                  onChange={e => setDraft(d => ({ ...d, difficulty: e.target.value }))}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            <div className="lms-field">
              <label className="lms-label">Explanation</label>
              <textarea className="lms-textarea" style={{ minHeight: 70 }}
                placeholder="Shown to the learner after they submit"
                value={draft.explanation} onChange={e => setDraft(d => ({ ...d, explanation: e.target.value }))} />
            </div>

            <div className="lms-toggle-row">
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>Active</div>
              <Toggle on={draft.status === 'active'}
                onChange={v => setDraft(d => ({ ...d, status: v ? 'active' : 'inactive' }))} />
            </div>
          </>
        )}
      </Drawer>

      {/* ── bulk import ───────────────────────────────────────── */}
      <Modal
        open={bulkOpen}
        title="Import questions"
        onClose={closeBulk}
        width={760}
        footer={
          <>
            <button className="lms-btn lms-btn-ghost" onClick={closeBulk}>Cancel</button>
            {bulkTab === 'file' ? (
              <button
                className="lms-btn lms-btn-dark"
                onClick={runFileImport}
                disabled={saving || !parsed?.questions?.length}
              >
                {saving
                  ? 'Importing…'
                  : parsed?.questions?.length
                    ? `Import ${parsed.questions.length} question${parsed.questions.length === 1 ? '' : 's'}`
                    : 'Import questions'}
              </button>
            ) : (
              <button className="lms-btn lms-btn-dark" onClick={runBulk} disabled={saving}>
                {saving ? 'Importing…' : 'Import questions'}
              </button>
            )}
          </>
        }
      >
        <div className="lms-segment" style={{ marginBottom: 18 }}>
          <button className={bulkTab === 'file' ? 'active' : ''} onClick={() => setBulkTab('file')}>
            Excel / CSV file
          </button>
          <button className={bulkTab === 'text' ? 'active' : ''} onClick={() => setBulkTab('text')}>
            Paste as text
          </button>
        </div>

        {bulkTab === 'file' ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--lms-text-2)', lineHeight: 1.7, margin: '0 0 14px' }}>
              Upload the question bank straight out of Excel. The header row is matched by name, so
              the column order does not matter and anything extra is ignored.
            </p>

            <div className="lms-import-cols">
              {[
                ['Question', 'required · HTML is kept'],
                ['CorrectOption', 'required · 2, or B, or 1,3 for multi'],
                ['Option1…OptionN', 'required · at least two'],
                ['PositiveMarks', 'defaults to 1'],
                ['NegativeMarks', 'ignored · always 0'],
                ['Level', 'EASY / MEDIUM / HARD'],
                ['QuestionType', 'optional'],
                ['Explanation', 'optional'],
              ].map(([name, note]) => (
                <div className="lms-import-col" key={name}>
                  <b>{name}</b>
                  <span>{note}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '16px 0 4px' }}>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                style={{ display: 'none' }}
                onChange={e => pickFile(e.target.files?.[0])}
              />
              <button
                className="lms-btn lms-btn-dark"
                onClick={() => fileInput.current?.click()}
                disabled={parsing}
              >
                <FileSpreadsheet size={16} /> {parsing ? 'Reading…' : parsed ? 'Choose another file' : 'Choose a file'}
              </button>
              <button className="lms-btn lms-btn-ghost" onClick={downloadTemplate}>
                <Download size={16} /> Download template
              </button>
              {parsed && (
                <button className="lms-btn lms-btn-quiet" onClick={() => setParsed(null)}>
                  <RotateCcw size={15} /> Clear
                </button>
              )}
            </div>

            {parsed && (
              <>
                <div className="lms-import-summary">
                  <span className="ok"><CheckCircle2 size={15} /> {parsed.questions.length} ready</span>
                  {(parsed.skipped || []).length > 0 && (
                    <span className="bad"><XCircle size={15} /> {parsed.skipped.length} skipped</span>
                  )}
                  <span className="muted">{parsed.file_name}</span>
                </div>

                {(parsed.warnings || []).map((w, i) => (
                  <div className="lms-warn" style={{ marginTop: 12 }} key={i}>
                    <AlertTriangle size={16} className="lms-warn-ico" />
                    <div className="lms-warn-body">{w}</div>
                  </div>
                ))}

                {(parsed.skipped || []).length > 0 && (
                  <div className="lms-warn" style={{ marginTop: 12, alignItems: 'flex-start' }}>
                    <XCircle size={16} className="lms-warn-ico" />
                    <div className="lms-warn-body" style={{ flex: 1 }}>
                      <b>These rows will not be imported</b>
                      <ul style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.75 }}>
                        {parsed.skipped.slice(0, 8).map((w, i) => <li key={i}>{w}</li>)}
                        {parsed.skipped.length > 8 && <li>…and {parsed.skipped.length - 8} more</li>}
                      </ul>
                    </div>
                  </div>
                )}

                {/* The whole point of the preview: the correct answer is shown
                    ticked, so a mis-read CorrectOption column is caught here
                    rather than by a learner scoring 0 on a question they got
                    right. Ten is enough to spot a systematic mis-read. */}
                <h3 className="lms-h3" style={{ margin: '20px 0 10px' }}>
                  Check the answers before importing
                </h3>
                <div className="lms-import-preview">
                  {parsed.questions.slice(0, 10).map((q, i) => (
                    <div className="lms-import-q" key={i}>
                      <div className="lms-import-q-head">
                        <span className="n">{i + 1}</span>
                        <QuestionText html={q.question} style={{ flex: 1, minWidth: 0, fontSize: 13.5 }} />
                        <Pill tone="grey">{q.marks} mark{Number(q.marks) === 1 ? '' : 's'}</Pill>
                        {Number(q.negative_marks) > 0 && <Pill tone="red">−{q.negative_marks}</Pill>}
                        <Pill tone={q.difficulty === 'hard' ? 'amber' : q.difficulty === 'easy' ? 'green' : 'grey'}>
                          {q.difficulty}
                        </Pill>
                      </div>
                      <div className="lms-import-opts">
                        {(q.options || []).map(o => {
                          const right = (q.correct || []).includes(o.value);
                          return (
                            <div className={`lms-import-opt${right ? ' right' : ''}`} key={o.value}>
                              {right ? <CheckCircle2 size={13} /> : <span className="dot" />}
                              <span style={{ minWidth: 0 }}>{o.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {parsed.questions.length > 10 && (
                    <p className="lms-help" style={{ margin: '4px 0 0' }}>
                      …and {parsed.questions.length - 10} more, which will be imported too.
                    </p>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--lms-text-2)', lineHeight: 1.7, marginTop: 0 }}>
              One question per line: the question text, then each option, separated by <code>|</code>.
              Put a <code>*</code> at the end of every correct option. Two or more starred options make it a
              multiple-choice question automatically.
            </p>
            <pre style={{
              fontSize: 11.5, fontFamily: 'JetBrains Mono, monospace', background: 'var(--lms-bg-page)',
              padding: 12, borderRadius: 8, overflowX: 'auto', lineHeight: 1.7,
            }}>
{`What does CPU stand for? | Central Processing Unit* | Computer Power Unit | Control Panel Unit
Which are Python types? | list* | dict* | table | schema`}
            </pre>
            <div className="lms-field" style={{ marginTop: 16 }}>
              <label className="lms-label">Paste your questions</label>
              <textarea
                className="lms-textarea"
                style={{ minHeight: 190, fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5 }}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
              />
            </div>
          </>
        )}
      </Modal>

      {/* ── attempt answers ───────────────────────────────────── */}
      <Drawer
        open={!!attemptDetail}
        title="Attempt detail"
        subtitle={attemptDetail ? `${attemptDetail.name || attemptDetail.email} — ${attemptDetail.percentage}%` : ''}
        onClose={() => setAttemptDetail(null)}
      >
        {attemptDetail && (
          questions.map((qq, i) => {
            const given = attemptDetail.answers?.[qq.id] ?? attemptDetail.answers?.[String(qq.id)];
            const givenArr = Array.isArray(given) ? given : given != null ? [given] : [];
            const label = (v) => (qq.options || []).find(o => o.value === v)?.label ?? String(v);
            const right = JSON.stringify([...givenArr].sort()) === JSON.stringify([...(qq.correct || [])].sort());
            return (
              <div key={qq.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--lms-border)' }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 8 }}>{i + 1}. {qq.question}</div>
                <div style={{ fontSize: 12.5, color: 'var(--lms-text-2)' }}>
                  Answered: {givenArr.length ? givenArr.map(label).join(', ') : <em>not attempted</em>}
                </div>
                <div style={{ marginTop: 6 }}>
                  <Pill tone={right ? 'green' : givenArr.length ? 'red' : 'grey'}>
                    {right ? 'Correct' : givenArr.length ? 'Incorrect' : 'Skipped'}
                  </Pill>
                </div>
              </div>
            );
          })
        )}
      </Drawer>

      <Confirm
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Delete"
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.run()}
      />
    </div>
  );
}
