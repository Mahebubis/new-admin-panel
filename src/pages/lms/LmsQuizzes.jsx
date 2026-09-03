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
  Upload, FileSpreadsheet, Check, AlertCircle, Loader2, X,
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

/* ── batch create: one quiz per spreadsheet ─────────────────────────────────
   EACH QUIZ IS NAMED AFTER ITS OWN FILE. Pick four sheets with ctrl-click and
   the four quizzes come out carrying the sheet names, character for character:

     Module 1 — HTML.xlsx  ->  Module 1 — HTML
     Module 2 — CSS.xlsx   ->  Module 2 — CSS

   Only the extension is dropped; nothing is renumbered, re-cased or trimmed of
   anything else, because the file names ARE the question banks' names and they
   are what the admin will look for in the quiz list afterwards. The title box
   above is only used when a single quiz is created with no file at all. */
const stripExt = (name) => String(name).replace(/\.[^.]+$/, '').trim();
const fileTitle = (file, base) => stripExt(file?.name || '') || base || 'Untitled quiz';

/* Question banks are named with bare numbers ("Section Quiz 2", "...10"), and
   a plain string sort puts 10 immediately after 1. */
const byName = (a, b) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

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

  /* Batch create. `files` is what was picked, `batch` is the per-file outcome
     and stays null until a run starts — both are indexed by position, so the
     preview rows and the progress rows are literally the same rows. */
  const [files, setFiles] = useState([]);
  const [batch, setBatch] = useState(null);
  const fileInput = useRef(null);

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

  /* The drawer's settings as the endpoint wants them. Shared by the single
     save and by every quiz in a batch, so a batch cannot drift from what the
     form says it will do. */
  const quizPayload = () => ({
    ...draft,
    course_id: draft.course_id ? Number(draft.course_id) : 0,
    shuffle_questions: draft.shuffle_questions ? 1 : 0,
    shuffle_options: draft.shuffle_options ? 1 : 0,
    negative_marking: draft.negative_marking ? 1 : 0,
    show_result: draft.show_result ? 1 : 0,
    is_graded: draft.is_graded ? 1 : 0,
  });

  const addFiles = (picked) => {
    const next = [...files];
    for (const f of picked) {
      /* The same sheet picked twice across two trips to the file dialog would
         quietly create two identical quizzes. */
      if (!next.some(x => x.name === f.name && x.size === f.size)) next.push(f);
    }
    setFiles(next.sort(byName));
    /* Cleared so re-picking a file that was just removed still fires onChange —
       the browser does not re-fire for an unchanged value. */
    if (fileInput.current) fileInput.current.value = '';
  };

  const removeFile = (i) => setFiles(fs => fs.filter((_, n) => n !== i));

  const closeDraft = () => {
    if (saving) return;              // a run in flight is writing quizzes
    setDraft(null);
    setFiles([]);
    setBatch(null);
  };

  /* One file at a time, and each file is PARSED BEFORE its quiz is created: a
     sheet the importer cannot read then leaves no empty quiz behind to clean
     up. Sequential rather than parallel — fourteen files is forty-two requests,
     and the shared host would rather have them queued than all at once. A file
     that fails does not stop the ones after it; its row carries the reason. */
  const runBatch = async () => {
    const base = draft.title.trim();
    const rows = files.map(f => ({
      file: f.name, title: fileTitle(f, base), state: 'wait', note: '',
    }));
    setBatch(rows);
    setSaving(true);

    const settings = quizPayload();
    let made = 0;

    for (let i = 0; i < files.length; i++) {
      const set = (patch) => setBatch(b => b.map((r, n) => (n === i ? { ...r, ...patch } : r)));
      set({ state: 'busy', note: 'Reading the file…' });
      try {
        const fd = new FormData();
        fd.append('file', files[i]);
        const parsed = await LMS.importParseQuestions(fd);
        const list = parsed?.questions || [];
        if (!list.length) throw new Error('No questions could be read from this file');

        set({ note: `Creating the quiz — ${list.length} question${list.length === 1 ? '' : 's'}…` });
        const created = await LMS.createQuiz({ ...settings, title: rows[i].title });
        const res = await LMS.importRunQuestions(Number(created.id), list);

        made++;
        const bad = (res.failed || []).length;
        set({
          state: 'done',
          note: `${res.added} question${res.added === 1 ? '' : 's'} imported`
            + (bad ? ` · ${bad} row${bad === 1 ? '' : 's'} skipped` : ''),
        });
      } catch (e) {
        set({ state: 'bad', note: e.message });
      }
    }

    setSaving(false);
    load();
    /* The drawer deliberately stays open on the finished rows: with a dozen
       files, "which one failed" is the only thing worth reading afterwards. */
    if (made === files.length) toast.success(`${made} ${made === 1 ? 'quiz' : 'quizzes'} created`);
    else toast.error(`${made} of ${files.length} created — see the list in the drawer`);
  };

  const save = async () => {
    /* With files picked the titles come from the file names, so the box above
       is allowed to be empty — it is only the name of a hand-built quiz. */
    if (!draft.id && files.length) return runBatch();
    if (!draft.title.trim()) return toast.error('Quiz title is required');
    setSaving(true);
    try {
      const payload = quizPayload();
      if (draft.id) {
        await LMS.updateQuiz(payload);
        toast.success('Quiz updated');
        setDraft(null); setFiles([]); setBatch(null);
        load();
      } else {
        const d = await LMS.createQuiz(payload);
        toast.success('Quiz created');
        setDraft(null); setFiles([]); setBatch(null);
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
        onClose={closeDraft}
        footer={
          /* Once a batch has finished there is nothing left to cancel and
             nothing left to submit — only the report to read and dismiss. */
          batch && !saving ? (
            <button className="lms-btn lms-btn-dark" onClick={closeDraft}>Done</button>
          ) : (
            <>
              <button className="lms-btn lms-btn-ghost" onClick={closeDraft} disabled={saving}>Cancel</button>
              <button className="lms-btn lms-btn-dark" onClick={save} disabled={saving}>
                {saving
                  ? batch
                    ? `Creating ${batch.filter(r => r.state === 'done' || r.state === 'bad').length} of ${batch.length}…`
                    : 'Saving…'
                  : draft?.id
                    ? 'Save changes'
                    : files.length > 1
                      ? `Create ${files.length} quizzes`
                      : 'Create quiz'}
              </button>
            </>
          )
        }
      >
        {draft && (
          <>
            <div className="lms-field">
              <label className="lms-label">
                Quiz title{!(!draft.id && files.length) && <span className="req">*</span>}
              </label>
              <input className="lms-input" autoFocus placeholder="e.g. Module 1 — Python Basics"
                value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
              {!draft.id && files.length > 0 && (
                <p className="lms-help">
                  Not used — each quiz below is named after its own file. Remove the files to
                  create one quiz with this title instead.
                </p>
              )}
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

            {/* Batch create. Only on the create path — an existing quiz already
                has the per-quiz importer in the quiz builder, and "add files"
                there would be a different action with a different meaning. */}
            {!draft.id && (
              <div className="lms-field">
                <label className="lms-label">Question files</label>
                <input ref={fileInput} type="file" accept=".csv,.xlsx,.xlsm" multiple hidden
                  onChange={e => addFiles(Array.from(e.target.files || []))} />
                <button className="lms-btn lms-btn-ghost" type="button" disabled={saving}
                  onClick={() => fileInput.current?.click()}>
                  <Upload size={15} /> {files.length ? 'Add more files' : 'Choose files'}
                </button>
                <p className="lms-help">
                  Optional — one spreadsheet per quiz. Pick as many as you like (ctrl-click):
                  every file becomes its own quiz <b>named exactly after the file</b> (without
                  the .xlsx / .csv), and all of them get the rules, course and status set here.
                  Leave this empty to create a single quiz and add questions by hand.
                </p>

                {(batch || files).length > 0 && (
                  <div className="lms-batch" style={{ marginTop: 12 }}>
                    {(batch || files.map(f => ({
                      file: f.name,
                      title: fileTitle(f, draft.title.trim()),
                      state: 'wait',
                      note: '',
                    }))).map((r, i) => (
                      <div className={`lms-batch-row ${r.state}`} key={r.file + i}>
                        <span className="lms-batch-n">{i + 1}</span>
                        {r.state === 'busy' ? <Loader2 size={15} className="lms-batch-spin" />
                          : r.state === 'done' ? <Check size={15} color="var(--lms-green-dark)" />
                          : r.state === 'bad' ? <AlertCircle size={15} color="var(--lms-red-dark)" />
                          : <FileSpreadsheet size={15} color="var(--lms-text-3)" />}
                        <div className="lms-batch-main">
                          <div className="lms-batch-title">{r.title}</div>
                          <div className="lms-batch-note" title={r.note || r.file}>{r.note || r.file}</div>
                        </div>
                        {!batch && (
                          <button className="lms-icon-btn" type="button"
                            onClick={() => removeFile(i)} aria-label={`Remove ${r.file}`}>
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
