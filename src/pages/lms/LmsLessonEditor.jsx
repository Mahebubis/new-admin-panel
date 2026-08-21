// ===========================================================================
//  LmsLessonEditor.jsx — the lesson workspace.
//
//  Three panes, switched by the sub-tabs under the title:
//    Content — the video (S3 upload or a Vimeo/YouTube URL) or the article body
//    Form    — the dynamic data-collection form shown to the learner for THIS
//              lesson (same builder shape as the Assignment Panel / Sim 2.2)
//    Settings— visibility, free preview, drip, duration, quiz binding
//
//  The Attachments rail on the right mirrors Learnyst's lesson page: upload a
//  file to S3 or attach an external link, each with its own label.
// ===========================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ChevronLeft, ChevronRight, RefreshCw, Plus, Trash2, Upload, Link2, Paperclip,
  PlayCircle, FileText, HelpCircle, ClipboardList, Settings2, Save, Eye,
  Type, AlignLeft, Hash, Calendar, ListFilter, ListChecks, CircleDot, CheckSquare,
  Image as ImageIcon, Film, FileSpreadsheet, Presentation, GripVertical, Pencil,
  ArrowUp, ArrowDown, Download, ExternalLink, X, AlertTriangle,
} from 'lucide-react';
import { LMS, duration, fileSize } from './lmsApi';
import { VideoPicker } from './LmsMedia';
import { Loader, Empty, Pill, Drawer, Modal, Confirm, Toggle } from './LmsStyles';

/* ── the form-field catalogue (mirrors the Assignment Panel builder) ── */
const FIELD_TYPES = {
  text:            { label: 'Short text',        icon: Type,            group: 'text' },
  textarea:        { label: 'Paragraph',         icon: AlignLeft,       group: 'text' },
  url:             { label: 'URL / Link',        icon: Link2,           group: 'text' },
  email:           { label: 'Email',             icon: Type,            group: 'text' },
  number:          { label: 'Number',            icon: Hash,            group: 'number' },
  date:            { label: 'Date',              icon: Calendar,        group: 'other' },
  dropdown_single: { label: 'Dropdown (single)', icon: ListFilter,      group: 'choice' },
  dropdown_multi:  { label: 'Dropdown (multi)',  icon: ListChecks,      group: 'choice' },
  radio:           { label: 'Radio (single)',    icon: CircleDot,       group: 'choice' },
  checkbox:        { label: 'Checkbox (multi)',  icon: CheckSquare,     group: 'choice' },
  rating:          { label: 'Rating (1–5)',      icon: CircleDot,       group: 'choice' },
  image:           { label: 'Image upload',      icon: ImageIcon,       group: 'file' },
  video:           { label: 'Video upload',      icon: Film,            group: 'file' },
  file_pdf:        { label: 'PDF upload',        icon: FileText,        group: 'file' },
  file_xlsx:       { label: 'Excel / CSV',       icon: FileSpreadsheet, group: 'file' },
  file_doc:        { label: 'Document',          icon: FileText,        group: 'file' },
  presentation:    { label: 'Presentation',      icon: Presentation,    group: 'file' },
  file_any:        { label: 'Any file',          icon: Paperclip,       group: 'file' },
};
const PALETTE = [
  { label: 'Text & input', types: ['text', 'textarea', 'url', 'email', 'number', 'date'] },
  { label: 'Choices',      types: ['dropdown_single', 'dropdown_multi', 'radio', 'checkbox', 'rating'] },
  { label: 'File upload',  types: ['image', 'video', 'file_pdf', 'file_xlsx', 'file_doc', 'presentation', 'file_any'] },
];
const FILE_GROUP = (t) => FIELD_TYPES[t]?.group === 'file';
const CHOICE_GROUP = (t) => FIELD_TYPES[t]?.group === 'choice';

/* Lesson kinds are a different vocabulary from form-field types — keep their
   labels separate so a "video" lesson doesn't read as "Video upload". */
const LESSON_TYPE_LABEL = {
  video: 'Video', article: 'Article', pdf: 'PDF',
  quiz: 'Quiz', form: 'Form', live: 'Live class',
};

const defaultsFor = (type) => ({
  field_type: type,
  label: FIELD_TYPES[type].label,
  placeholder: '',
  help_text: '',
  is_required: true,
  status: 'active',
  options: CHOICE_GROUP(type) && type !== 'rating'
    ? [{ value: 'option_1', label: 'Option 1' }, { value: 'option_2', label: 'Option 2' }]
    : [],
  accepted_extensions: '',
  max_file_size_mb: 25,
});

const toDraft = (f) => ({
  id: f.id,
  field_type: f.field_type,
  label: f.label || '',
  placeholder: f.placeholder || '',
  help_text: f.help_text || '',
  is_required: !!f.is_required,
  status: f.status || 'active',
  options: (f.options || []).map(o => ({ value: o.value, label: o.label })),
  accepted_extensions: f.accepted_extensions || '',
  max_file_size_mb: f.max_file_size_mb || 25,
});

/* ── what the learner will actually see ── */
function FieldPreview({ field }) {
  const t = field.field_type;
  let control;

  if (FILE_GROUP(t)) {
    control = (
      <div className="lms-dropzone" style={{ padding: '18px 16px', cursor: 'default' }}>
        <Upload size={17} color="var(--lms-text-3)" />
        <div className="t">Learner uploads {FIELD_TYPES[t].label.toLowerCase()} here</div>
        {field.accepted_extensions && <div className="s">Allowed: {field.accepted_extensions}</div>}
        <div className="s">Max {field.max_file_size_mb || 25} MB</div>
      </div>
    );
  } else if (t === 'textarea') {
    control = <textarea className="lms-textarea" placeholder={field.placeholder} readOnly />;
  } else if (t === 'dropdown_single' || t === 'dropdown_multi') {
    control = (
      <select className="lms-select" multiple={t === 'dropdown_multi'} defaultValue="">
        {t === 'dropdown_single' && <option value="">{field.placeholder || 'Select an option'}</option>}
        {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  } else if (t === 'radio' || t === 'checkbox') {
    control = (
      <div>
        {field.options.map(o => (
          <label key={o.value} className="lms-check" style={{ display: 'flex', padding: '7px 0' }}>
            <input type={t === 'radio' ? 'radio' : 'checkbox'} readOnly name={`prev_${field.id || 'new'}`} />
            {o.label}
          </label>
        ))}
      </div>
    );
  } else if (t === 'rating') {
    control = (
      <div style={{ display: 'flex', gap: 8 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <span key={n} style={{
            width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center',
            justifyContent: 'center', border: '1px solid var(--lms-border-2)', fontSize: 13,
          }}>{n}</span>
        ))}
      </div>
    );
  } else {
    const inputType = t === 'number' ? 'number' : t === 'date' ? 'date' : t === 'email' ? 'email' : 'text';
    control = <input className="lms-input" type={inputType} placeholder={field.placeholder} readOnly />;
  }

  return (
    <div className="lms-field">
      <label className="lms-label">
        {field.label}{field.is_required && <span className="req">*</span>}
      </label>
      {field.help_text && <p className="lms-help" style={{ margin: '0 0 8px' }}>{field.help_text}</p>}
      {control}
    </div>
  );
}

export default function LmsLessonEditor() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [lesson, setLesson] = useState(null);
  const [siblings, setSiblings] = useState([]);
  const [pane, setPane] = useState('content');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [attachments, setAttachments] = useState([]);
  /* Every quiz in the school, for the "which quiz?" picker on a quiz lesson.
     Loaded once — the list is small and does not change while editing. */
  const [quizzes, setQuizzes] = useState([]);
  const [fields, setFields] = useState([]);
  const [fieldDraft, setFieldDraft] = useState(null);
  const [linkDraft, setLinkDraft] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [uploading, setUploading] = useState(false);

  const fileInput = useRef(null);

  const load = useCallback(async () => {
    try {
      const [d, a, f] = await Promise.all([
        LMS.getLesson(lessonId),
        LMS.listAttachments(lessonId),
        LMS.listFields(lessonId),
      ]);
      setLesson(d.lesson);
      setSiblings(d.siblings || []);
      setAttachments(a.attachments || []);
      setFields(f.fields || []);
      setDirty(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useEffect(() => {
    LMS.listQuizzes({ status: 'all' })
      .then(d => setQuizzes((d.quizzes || []).map(q => ({
        id: Number(q.id),
        title: q.title,
        status: q.status,
        question_count: Number(q.question_count || 0),
      }))))
      .catch(() => { /* the picker just stays empty */ });
  }, []);

  const position = useMemo(() => {
    const i = siblings.findIndex(s => String(s.id) === String(lessonId));
    return { index: i, total: siblings.length, prev: siblings[i - 1], next: siblings[i + 1] };
  }, [siblings, lessonId]);

  const patch = (p) => { setLesson(l => ({ ...l, ...p })); setDirty(true); };

  const save = async (extra = {}) => {
    setSaving(true);
    try {
      await LMS.updateLesson({
        id: Number(lessonId),
        title: lesson.title,
        content: lesson.content || '',
        video_url: lesson.video_url || '',
        video_provider: lesson.video_provider || 'url',
        lesson_type: lesson.lesson_type,
        duration_secs: lesson.duration_secs || 0,
        quiz_id: lesson.quiz_id || 0,
        drip_days: lesson.drip_days || 0,
        is_free_preview: lesson.is_free_preview ? 1 : 0,
        is_hidden: lesson.is_hidden ? 1 : 0,
        status: lesson.status,
        ...extra,
      });
      toast.success('Lesson saved');
      setDirty(false);
      if (extra.status) setLesson(l => ({ ...l, status: extra.status }));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── uploads ── */
  /* Called by <VideoPicker> with the chosen File, after it has confirmed the
     upload with the admin. */
  const uploadVideo = async (file) => {
    if (!file) return;
    setUploading(true);
    const t = toast.loading('Uploading video to S3…');
    try {
      const fd = new FormData();
      fd.append('id', lessonId);
      fd.append('file', file);
      fd.append('duration_secs', lesson.duration_secs || 0);
      const d = await LMS.uploadVideo(fd);
      setLesson(l => ({ ...l, video_url: d.url, video_provider: 's3' }));
      toast.success('Video uploaded', { id: t });
    } catch (err) {
      toast.error(err.message, { id: t });
    } finally {
      setUploading(false);
    }
  };

  const uploadAttachment = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const t = toast.loading('Uploading attachment…');
    try {
      const fd = new FormData();
      fd.append('lesson_id', lessonId);
      fd.append('kind', 'file');
      fd.append('title', file.name);
      fd.append('file', file);
      await LMS.createAttachment(fd);
      toast.success('Attachment added', { id: t });
      const a = await LMS.listAttachments(lessonId);
      setAttachments(a.attachments || []);
    } catch (err) {
      toast.error(err.message, { id: t });
    }
  };

  const addLink = async () => {
    if (!linkDraft?.file_url?.trim()) return toast.error('Enter a URL');
    try {
      const fd = new FormData();
      fd.append('lesson_id', lessonId);
      fd.append('kind', 'link');
      fd.append('title', linkDraft.title || linkDraft.file_url);
      fd.append('description', linkDraft.description || '');
      fd.append('file_url', linkDraft.file_url);
      await LMS.createAttachment(fd);
      toast.success('Link added');
      setLinkDraft(null);
      const a = await LMS.listAttachments(lessonId);
      setAttachments(a.attachments || []);
    } catch (e) { toast.error(e.message); }
  };

  /* ── form-field CRUD ── */
  const saveField = async () => {
    if (!fieldDraft?.label?.trim()) return toast.error('Field label is required');
    if (CHOICE_GROUP(fieldDraft.field_type) && fieldDraft.field_type !== 'rating'
        && fieldDraft.options.filter(o => o.label.trim()).length < 2) {
      return toast.error('Add at least two options');
    }
    setSaving(true);
    try {
      const payload = {
        ...fieldDraft,
        lesson_id: Number(lessonId),
        is_required: fieldDraft.is_required ? 1 : 0,
        options: fieldDraft.options.filter(o => o.label.trim()),
      };
      if (fieldDraft.id) await LMS.updateField(payload);
      else await LMS.createField(payload);
      toast.success(fieldDraft.id ? 'Field updated' : 'Field added');
      setFieldDraft(null);
      const f = await LMS.listFields(lessonId);
      setFields(f.fields || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const moveField = async (index, dir) => {
    const next = [...fields];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next);
    try { await LMS.reorderFields(next.map(f => f.id)); }
    catch (e) { toast.error(e.message); load(); }
  };

  if (loading) return <Loader />;
  if (!lesson) {
    return (
      <div className="lms-page">
        <Empty
          icon={<FileText size={24} />}
          title="Lesson not found"
          message="It may have been deleted from the course outline."
          action={<Link to={`/lms/courses/${courseId}`} className="lms-btn lms-btn-dark">Back to course</Link>}
        />
      </div>
    );
  }

  return (
    <>
      {/* ── lesson top bar ─────────────────────────────────────── */}
      <div className="lms-topbar">
        <Link to={`/lms/courses/${courseId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 500 }}>
          <ChevronLeft size={17} /> {lesson.course_title} • {lesson.section_title}
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {position.total > 0 && (
            <span style={{ fontSize: 13.5, color: 'var(--lms-text-2)' }}>
              {position.index + 1} / {position.total} Lesson
            </span>
          )}
          <button className="lms-btn lms-btn-ghost lms-btn-sm" onClick={load}>
            <RefreshCw size={15} /> Reload
          </button>
          <button
            className="lms-icon-btn"
            disabled={!position.prev}
            title="Previous lesson"
            onClick={() => position.prev && navigate(`/lms/courses/${courseId}/lessons/${position.prev.id}`)}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            className="lms-icon-btn"
            disabled={!position.next}
            title="Next lesson"
            onClick={() => position.next && navigate(`/lms/courses/${courseId}/lessons/${position.next.id}`)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <div className="lms-page">
        {/* ── title + actions ──────────────────────────────────── */}
        <div className="lms-page-head" style={{ alignItems: 'center', marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="lms-chip-row" style={{ marginBottom: 10 }}>
              <Pill tone={lesson.is_free_preview ? 'green' : 'grey'}>{lesson.is_free_preview ? 'Free preview' : 'Paid'}</Pill>
              <Pill tone="blue">{LESSON_TYPE_LABEL[lesson.lesson_type] || lesson.lesson_type}</Pill>
              <Pill tone={lesson.status === 'published' ? 'green' : 'amber'}>
                {lesson.status === 'published' ? 'Published' : 'Draft'}
              </Pill>
              {!!lesson.is_hidden && <Pill tone="grey">Hidden</Pill>}
            </div>
            <input
              value={lesson.title}
              onChange={e => patch({ title: e.target.value })}
              className="lms-h1"
              style={{ border: 'none', outline: 'none', width: '100%', background: 'transparent', padding: 0 }}
              aria-label="Lesson title"
            />
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="lms-btn lms-btn-ghost" onClick={() => save()} disabled={saving}>
              <Save size={16} /> {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              className="lms-btn lms-btn-green"
              onClick={() => save({ status: lesson.status === 'published' ? 'draft' : 'published' })}
              disabled={saving}
            >
              <Eye size={16} /> {lesson.status === 'published' ? 'Unpublish' : 'Publish'}
            </button>
            <button
              className="lms-btn lms-btn-red"
              onClick={() => setConfirm({
                title: 'Move lesson to trash?',
                message: `"${lesson.title}" will be deleted with its video, attachments, form fields and collected responses.`,
                label: 'Move To Trash',
                run: async () => {
                  await LMS.deleteLesson(lessonId);
                  toast.success('Lesson deleted');
                  navigate(`/lms/courses/${courseId}`);
                },
              })}
            >
              <Trash2 size={16} /> Move To Trash
            </button>
          </div>
        </div>

        {dirty && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 18,
            background: 'var(--lms-amber-soft)', color: 'var(--lms-amber-dark)',
            borderRadius: 8, fontSize: 13,
          }}>
            You have unsaved changes on this lesson.
            <button className="lms-btn lms-btn-sm lms-btn-dark" onClick={() => save()}>Save now</button>
          </div>
        )}

        {/* ── pane switcher ────────────────────────────────────── */}
        <div className="lms-segment" style={{ marginBottom: 22 }}>
          {[
            { k: 'content', l: 'Content' },
            { k: 'form', l: `Form${fields.length ? ` (${fields.length})` : ''}` },
            { k: 'settings', l: 'Settings' },
          ].map(t => (
            <button key={t.k} className={pane === t.k ? 'active' : ''} onClick={() => setPane(t.k)}>{t.l}</button>
          ))}
        </div>

        {/* ═══════════ CONTENT PANE ═══════════ */}
        {pane === 'content' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(260px,1fr)', gap: 22, alignItems: 'start' }}>
            <div className="lms-card lms-card-pad">
              {(lesson.lesson_type === 'video' || lesson.lesson_type === 'live') && (
                <>
                  <h3 className="lms-h3" style={{ marginBottom: 4 }}>
                    {lesson.video_url ? 'Video attached' : 'Add a video'}
                  </h3>
                  <p className="lms-help" style={{ margin: '0 0 14px' }}>
                    Upload the file to S3, or embed one you already host on Vimeo or Bunny Stream.
                  </p>

                  <VideoPicker
                    url={lesson.video_url}
                    provider={lesson.video_provider}
                    uploading={uploading}
                    onChange={patch}
                    onUpload={uploadVideo}
                  />

                  <div className="lms-field" style={{ marginTop: 16, maxWidth: 260 }}>
                    <label className="lms-label">Duration (seconds)</label>
                    <input
                      className="lms-input" type="number" min="0"
                      value={lesson.duration_secs || 0}
                      onChange={e => patch({ duration_secs: Number(e.target.value) })}
                    />
                    <p className="lms-help">Shows as {duration(lesson.duration_secs)} in the course outline.</p>
                  </div>
                </>
              )}

              {lesson.lesson_type === 'quiz' && (
                <>
                  <h3 className="lms-h3" style={{ marginBottom: 14 }}>Attached quiz</h3>

                  {/* A quiz lesson with quiz_id = 0 looks finished in the
                      builder and dead-ends the learner with "No quiz has been
                      attached to this lesson yet". It used to be a bare number
                      box, so the id had to be found somewhere else and typed
                      in — which is exactly how it ends up left at 0. */}
                  {!lesson.quiz_id && (
                    <div className="lms-warn" style={{ marginBottom: 14 }}>
                      <AlertTriangle size={16} className="lms-warn-ico" />
                      <div className="lms-warn-body">
                        <b>No quiz is attached yet</b>
                        Learners opening this lesson see an error instead of questions. Pick one below.
                      </div>
                    </div>
                  )}

                  <div className="lms-field">
                    <label className="lms-label">Quiz<span className="req">*</span></label>
                    <select
                      className="lms-select"
                      value={lesson.quiz_id || 0}
                      onChange={e => patch({ quiz_id: Number(e.target.value) })}
                    >
                      <option value={0}>Select a quiz…</option>
                      {quizzes.map(q => (
                        <option key={q.id} value={q.id}>
                          {q.title}
                          {q.status !== 'published' ? ' — draft' : ''}
                          {' · '}{q.question_count} question{q.question_count === 1 ? '' : 's'}
                        </option>
                      ))}
                    </select>
                    <p className="lms-help">
                      Only <b>published</b> quizzes with questions reach a learner. Build them in
                      the <Link to="/lms/quizzes" style={{ color: 'var(--lms-green-dark)', fontWeight: 500 }}>Quizzes</Link> tab.
                    </p>
                  </div>

                  {(() => {
                    const q = quizzes.find(x => x.id === Number(lesson.quiz_id));
                    if (!q) return null;
                    if (q.status !== 'published') {
                      return (
                        <div className="lms-warn">
                          <AlertTriangle size={16} className="lms-warn-ico" />
                          <div className="lms-warn-body">
                            <b>&ldquo;{q.title}&rdquo; is still a draft</b>
                            Publish it from the Quizzes tab or learners cannot open it.
                          </div>
                        </div>
                      );
                    }
                    if (!q.question_count) {
                      return (
                        <div className="lms-warn">
                          <AlertTriangle size={16} className="lms-warn-ico" />
                          <div className="lms-warn-body">
                            <b>&ldquo;{q.title}&rdquo; has no questions</b>
                            Add some from the Quizzes tab, or the lesson opens empty.
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </>
              )}

              {(lesson.lesson_type === 'article' || lesson.lesson_type === 'pdf' || lesson.lesson_type === 'form'
                || lesson.lesson_type === 'video' || lesson.lesson_type === 'live') && (
                <>
                  <h3 className="lms-h3" style={{ margin: '22px 0 12px' }}>
                    {lesson.lesson_type === 'article' ? 'Article body' : 'Lesson notes'}
                  </h3>
                  <textarea
                    className="lms-textarea"
                    style={{ minHeight: 220 }}
                    placeholder="Write the lesson text the learner reads under the video…"
                    value={lesson.content || ''}
                    onChange={e => patch({ content: e.target.value })}
                  />
                  <p className="lms-help">
                    {(lesson.content || '').trim().split(/\s+/).filter(Boolean).length} words •{' '}
                    {(lesson.content || '').length} chars
                  </p>
                </>
              )}
            </div>

            {/* ── attachments rail ────────────────────────────── */}
            <div className="lms-card lms-card-pad">
              <input ref={fileInput} type="file" hidden onChange={uploadAttachment} />
              <h3 className="lms-h3">Attachments</h3>
              <p className="lms-help" style={{ margin: '4px 0 16px' }}>Add attachments like docs, pdf or links</p>

              {attachments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--lms-text-3)' }}>
                  <Paperclip size={30} />
                  <div style={{ fontSize: 13, marginTop: 10 }}>Add Attachments</div>
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  {attachments.map((a, i) => (
                    <div key={a.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0',
                      borderBottom: '1px solid var(--lms-border)',
                    }}>
                      <span style={{ fontSize: 12, color: 'var(--lms-text-3)', minWidth: 18 }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {a.kind === 'link' ? <ExternalLink size={15} color="var(--lms-text-2)" /> : <Paperclip size={15} color="var(--lms-text-2)" />}
                      <a href={a.file_url} target="_blank" rel="noreferrer"
                        style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={a.title || a.file_name}>
                        {a.title || a.file_name}
                      </a>
                      {a.file_size > 0 && (
                        <span style={{ fontSize: 11, color: 'var(--lms-text-3)' }}>{fileSize(a.file_size)}</span>
                      )}
                      <button
                        className="lms-icon-btn danger"
                        title="Remove"
                        onClick={() => setConfirm({
                          title: 'Remove attachment?',
                          message: `"${a.title || a.file_name}" will be removed from this lesson${a.kind === 'file' ? ' and deleted from S3' : ''}.`,
                          label: 'Remove',
                          run: async () => {
                            await LMS.deleteAttachment(a.id);
                            toast.success('Attachment removed');
                            setConfirm(null);
                            const r = await LMS.listAttachments(lessonId);
                            setAttachments(r.attachments || []);
                          },
                        })}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="lms-btn lms-btn-ghost lms-btn-sm" style={{ flex: 1 }}
                  onClick={() => setLinkDraft({ title: '', file_url: '', description: '' })}>
                  <Plus size={15} /> Add link
                </button>
                <button className="lms-btn lms-btn-ghost lms-btn-sm" style={{ flex: 1 }}
                  onClick={() => fileInput.current?.click()}>
                  <Download size={15} /> Browse
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ FORM PANE ═══════════ */}
        {pane === 'form' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) minmax(280px,1fr)', gap: 22, alignItems: 'start' }}>
            <div>
              <div className="lms-card lms-card-pad" style={{ marginBottom: 18 }}>
                <h3 className="lms-h3">Data collection form</h3>
                <p className="lms-help" style={{ margin: '6px 0 0' }}>
                  Anything you add here is rendered under this lesson on the learner's side. Their answers land in
                  the <Link to={`/lms/responses?lesson_id=${lessonId}`} style={{ color: 'var(--lms-green-dark)', fontWeight: 500 }}>Form Responses</Link> tab.
                </p>
              </div>

              {fields.length === 0 ? (
                <Empty
                  icon={<ClipboardList size={24} />}
                  title="No form fields on this lesson"
                  message="Pick a field type from the palette on the right to start building the form."
                />
              ) : (
                fields.map((f, i) => {
                  const Icon = FIELD_TYPES[f.field_type]?.icon || Type;
                  return (
                    <div className="lms-card lms-card-pad" key={f.id}
                      style={{ marginBottom: 12, opacity: f.status === 'inactive' ? 0.6 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <GripVertical size={16} color="var(--lms-text-3)" />
                        <span style={{
                          width: 32, height: 32, borderRadius: 7, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', background: 'var(--lms-green-soft)', color: 'var(--lms-green-dark)',
                        }}>
                          <Icon size={16} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                            {f.label}{!!f.is_required && <span style={{ color: 'var(--lms-red)' }}> *</span>}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--lms-text-3)' }}>
                            {FIELD_TYPES[f.field_type]?.label || f.field_type}
                            {CHOICE_GROUP(f.field_type) && f.options?.length ? ` • ${f.options.length} options` : ''}
                            {FILE_GROUP(f.field_type) ? ` • max ${f.max_file_size_mb} MB` : ''}
                            {f.response_count ? ` • ${f.response_count} responses` : ''}
                          </div>
                        </div>
                        <Pill tone={f.status === 'active' ? 'green' : 'grey'}>{f.status}</Pill>
                        <button className="lms-icon-btn" title="Move up" disabled={i === 0} onClick={() => moveField(i, -1)}>
                          <ArrowUp size={15} />
                        </button>
                        <button className="lms-icon-btn" title="Move down" disabled={i === fields.length - 1} onClick={() => moveField(i, 1)}>
                          <ArrowDown size={15} />
                        </button>
                        <button className="lms-icon-btn" title="Edit" onClick={() => setFieldDraft(toDraft(f))}>
                          <Pencil size={15} />
                        </button>
                        <button
                          className="lms-icon-btn danger"
                          title="Delete field"
                          onClick={() => setConfirm({
                            title: 'Delete this field?',
                            message: `"${f.label}" will be removed from the form. Answers already collected for it stay in the responses table.`,
                            label: 'Delete field',
                            run: async () => {
                              await LMS.deleteField(f.id);
                              toast.success('Field removed');
                              setConfirm(null);
                              const r = await LMS.listFields(lessonId);
                              setFields(r.fields || []);
                            },
                          })}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* palette + live preview */}
            <div>
              <div className="lms-card lms-card-pad" style={{ marginBottom: 18 }}>
                <h3 className="lms-h3" style={{ marginBottom: 14 }}>Add a field</h3>
                {PALETTE.map(g => (
                  <div key={g.label} style={{ marginBottom: 16 }}>
                    <div style={{
                      fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase',
                      color: 'var(--lms-text-3)', marginBottom: 8,
                    }}>{g.label}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                      {g.types.map(t => {
                        const Icon = FIELD_TYPES[t].icon;
                        return (
                          <button
                            key={t}
                            onClick={() => setFieldDraft(defaultsFor(t))}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 10px',
                              border: '1px solid var(--lms-border)', borderRadius: 7, fontSize: 12,
                              background: '#fff', textAlign: 'left',
                            }}
                          >
                            <Icon size={14} color="var(--lms-text-2)" />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {FIELD_TYPES[t].label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {fields.length > 0 && (
                <div className="lms-card lms-card-pad">
                  <div style={{
                    fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase',
                    color: 'var(--lms-text-3)', marginBottom: 14,
                  }}>
                    Learner preview
                  </div>
                  {fields.filter(f => f.status === 'active').map(f => <FieldPreview key={f.id} field={f} />)}
                  <button className="lms-btn lms-btn-green" style={{ width: '100%' }} disabled>Submit</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════ SETTINGS PANE ═══════════ */}
        {pane === 'settings' && (
          <div className="lms-card lms-card-pad" style={{ maxWidth: 640 }}>
            <h3 className="lms-h3" style={{ marginBottom: 6 }}>Lesson settings</h3>
            <p className="lms-help" style={{ margin: '0 0 8px' }}>Controls how and when this lesson reaches the learner.</p>

            <div className="lms-toggle-row">
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>Free preview</div>
                <div style={{ fontSize: 12, color: 'var(--lms-text-2)' }}>Visible to anyone, even before purchase.</div>
              </div>
              <Toggle on={!!lesson.is_free_preview} onChange={v => patch({ is_free_preview: v })} />
            </div>

            <div className="lms-toggle-row">
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>Hide from outline</div>
                <div style={{ fontSize: 12, color: 'var(--lms-text-2)' }}>Keeps the lesson in the course but hidden from learners.</div>
              </div>
              <Toggle on={!!lesson.is_hidden} onChange={v => patch({ is_hidden: v })} />
            </div>

            <div className="lms-row-2" style={{ marginTop: 20 }}>
              <div className="lms-field">
                <label className="lms-label">Lesson type</label>
                <select className="lms-select" value={lesson.lesson_type}
                  onChange={e => patch({ lesson_type: e.target.value })}>
                  <option value="video">Video</option>
                  <option value="article">Article</option>
                  <option value="pdf">PDF</option>
                  <option value="quiz">Quiz</option>
                  <option value="form">Form</option>
                  <option value="live">Live class</option>
                </select>
              </div>
              <div className="lms-field">
                <label className="lms-label">Drip after (days)</label>
                <input className="lms-input" type="number" min="0" value={lesson.drip_days || 0}
                  onChange={e => patch({ drip_days: Number(e.target.value) })} />
              </div>
            </div>

            <button className="lms-btn lms-btn-dark" onClick={() => save()} disabled={saving}>
              <Save size={16} /> {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        )}
      </div>

      {/* ── field editor drawer ────────────────────────────────── */}
      <Drawer
        open={!!fieldDraft}
        title={fieldDraft?.id ? 'Edit field' : 'Add field'}
        subtitle={fieldDraft ? FIELD_TYPES[fieldDraft.field_type]?.label : ''}
        onClose={() => setFieldDraft(null)}
        footer={
          <>
            <button className="lms-btn lms-btn-ghost" onClick={() => setFieldDraft(null)}>Cancel</button>
            <button className="lms-btn lms-btn-dark" onClick={saveField} disabled={saving}>
              {saving ? 'Saving…' : 'Save field'}
            </button>
          </>
        }
      >
        {fieldDraft && (
          <>
            <div className="lms-field">
              <label className="lms-label">Label<span className="req">*</span></label>
              <input className="lms-input" autoFocus value={fieldDraft.label}
                onChange={e => setFieldDraft(d => ({ ...d, label: e.target.value }))} />
            </div>

            {!FILE_GROUP(fieldDraft.field_type) && !CHOICE_GROUP(fieldDraft.field_type) && (
              <div className="lms-field">
                <label className="lms-label">Placeholder</label>
                <input className="lms-input" value={fieldDraft.placeholder}
                  onChange={e => setFieldDraft(d => ({ ...d, placeholder: e.target.value }))} />
              </div>
            )}

            <div className="lms-field">
              <label className="lms-label">Help text</label>
              <input className="lms-input" placeholder="Shown in small grey text under the label"
                value={fieldDraft.help_text}
                onChange={e => setFieldDraft(d => ({ ...d, help_text: e.target.value }))} />
            </div>

            {CHOICE_GROUP(fieldDraft.field_type) && fieldDraft.field_type !== 'rating' && (
              <div className="lms-field">
                <label className="lms-label">Options</label>
                {fieldDraft.options.map((o, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                      className="lms-input"
                      value={o.label}
                      placeholder={`Option ${i + 1}`}
                      onChange={e => setFieldDraft(d => {
                        const opts = [...d.options];
                        opts[i] = {
                          label: e.target.value,
                          value: e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || `option_${i + 1}`,
                        };
                        return { ...d, options: opts };
                      })}
                    />
                    <button
                      className="lms-icon-btn danger"
                      disabled={fieldDraft.options.length <= 2}
                      onClick={() => setFieldDraft(d => ({ ...d, options: d.options.filter((_, x) => x !== i) }))}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  className="lms-btn lms-btn-ghost lms-btn-sm"
                  onClick={() => setFieldDraft(d => ({
                    ...d,
                    options: [...d.options, { value: `option_${d.options.length + 1}`, label: `Option ${d.options.length + 1}` }],
                  }))}
                >
                  <Plus size={15} /> Add option
                </button>
              </div>
            )}

            {FILE_GROUP(fieldDraft.field_type) && (
              <div className="lms-row-2">
                <div className="lms-field">
                  <label className="lms-label">Accepted extensions</label>
                  <input className="lms-input" placeholder=".pdf,.docx"
                    value={fieldDraft.accepted_extensions}
                    onChange={e => setFieldDraft(d => ({ ...d, accepted_extensions: e.target.value }))} />
                </div>
                <div className="lms-field">
                  <label className="lms-label">Max size (MB)</label>
                  <input className="lms-input" type="number" min="1"
                    value={fieldDraft.max_file_size_mb}
                    onChange={e => setFieldDraft(d => ({ ...d, max_file_size_mb: Number(e.target.value) }))} />
                </div>
              </div>
            )}

            <div className="lms-toggle-row">
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>Required</div>
              <Toggle on={fieldDraft.is_required} onChange={v => setFieldDraft(d => ({ ...d, is_required: v }))} />
            </div>
            <div className="lms-toggle-row">
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>Active</div>
              <Toggle
                on={fieldDraft.status === 'active'}
                onChange={v => setFieldDraft(d => ({ ...d, status: v ? 'active' : 'inactive' }))}
              />
            </div>

            <div className="lms-divider" />
            <div style={{
              fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase',
              color: 'var(--lms-text-3)', marginBottom: 12,
            }}>
              Preview
            </div>
            <div style={{ background: 'var(--lms-bg-page)', borderRadius: 10, padding: 16 }}>
              <FieldPreview field={fieldDraft} />
            </div>
          </>
        )}
      </Drawer>

      {/* ── add link modal ─────────────────────────────────────── */}
      <Modal
        open={!!linkDraft}
        title="Add link"
        onClose={() => setLinkDraft(null)}
        width={460}
        footer={
          <>
            <button className="lms-btn lms-btn-ghost" onClick={() => setLinkDraft(null)}>Cancel</button>
            <button className="lms-btn lms-btn-dark" onClick={addLink}>Add link</button>
          </>
        }
      >
        {linkDraft && (
          <>
            <div className="lms-field">
              <label className="lms-label">URL<span className="req">*</span></label>
              <input className="lms-input" autoFocus placeholder="https://…"
                value={linkDraft.file_url}
                onChange={e => setLinkDraft(d => ({ ...d, file_url: e.target.value }))} />
            </div>
            <div className="lms-field">
              <label className="lms-label">Label</label>
              <input className="lms-input" placeholder="What the learner sees"
                value={linkDraft.title}
                onChange={e => setLinkDraft(d => ({ ...d, title: e.target.value }))} />
            </div>
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
    </>
  );
}
