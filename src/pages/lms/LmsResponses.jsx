// ===========================================================================
//  LmsResponses.jsx — the "Form Responses" tab.
//  Everything learners submitted through the per-lesson data-collection forms,
//  filterable by course/lesson and exportable to CSV.
// ===========================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ClipboardList, Download, ChevronLeft, ChevronRight, Trash2, Eye, ExternalLink,
} from 'lucide-react';
import { LMS, shortDate } from './lmsApi';
import { Loader, Empty, Drawer, Confirm } from './LmsStyles';

const PAGE_SIZES = [50, 100, 200];

/** Renders one submitted value — links stay clickable, arrays get joined. */
function Value({ value }) {
  if (value == null || value === '') return <span style={{ color: 'var(--lms-text-3)' }}>—</span>;
  if (Array.isArray(value)) return <>{value.join(', ')}</>;
  const s = String(value);
  if (/^https?:\/\//i.test(s)) {
    return (
      <a href={s} target="_blank" rel="noreferrer"
        style={{ color: 'var(--lms-green-dark)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {s.length > 44 ? s.slice(0, 44) + '…' : s} <ExternalLink size={12} />
      </a>
    );
  }
  return <>{s}</>;
}

export default function LmsResponses() {
  const [params, setParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(50);
  const [courseId, setCourseId] = useState(params.get('course_id') || '');
  const [lessonId, setLessonId] = useState(params.get('lesson_id') || '');

  const [courses, setCourses] = useState([]);
  const [detail, setDetail] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await LMS.listResponses({
        course_id: courseId, lesson_id: lessonId, limit, offset: page * limit,
      });
      setRows(d.responses || []);
      setTotal(d.total || 0);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonId, limit, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    LMS.listCourses({ status: 'all' }).then(d => setCourses(d.courses || [])).catch(() => {});
  }, []);

  /* every distinct payload key across the page becomes a column */
  const columns = useMemo(() => {
    const keys = new Set();
    rows.forEach(r => Object.keys(r.payload || {}).forEach(k => keys.add(k)));
    return [...keys].slice(0, 6);
  }, [rows]);

  const exportCsv = () => {
    if (!rows.length) return toast.error('Nothing to export');
    const allKeys = new Set();
    rows.forEach(r => Object.keys(r.payload || {}).forEach(k => allKeys.add(k)));
    const keys = [...allKeys];
    const head = ['Name', 'Email', 'Course', 'Lesson', 'Submitted', ...keys];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [head.map(esc).join(',')];
    rows.forEach(r => {
      lines.push([
        r.name, r.email, r.course_title, r.lesson_title, r.created_at,
        ...keys.map(k => {
          const v = r.payload?.[k];
          return Array.isArray(v) ? v.join(' | ') : v;
        }),
      ].map(esc).join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lms-form-responses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} responses`);
  };

  const setFilter = (key, value, setter) => {
    setter(value);
    setPage(0);
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const from = total === 0 ? 0 : page * limit + 1;
  const to = Math.min(total, (page + 1) * limit);

  return (
    <div className="lms-page">
      <div className="lms-page-head">
        <div>
          <h1 className="lms-h1">Form Responses</h1>
          <p className="lms-sub">Everything learners submitted through your per-lesson forms</p>
        </div>
        <button className="lms-btn lms-btn-ghost" onClick={exportCsv} disabled={!rows.length}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="lms-toolbar">
        <select className="lms-select" style={{ width: 260 }} value={courseId}
          onChange={e => setFilter('course_id', e.target.value, setCourseId)}>
          <option value="">All courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        {lessonId && (
          <button className="lms-btn lms-btn-quiet" onClick={() => setFilter('lesson_id', '', setLessonId)}>
            Clear lesson filter (#{lessonId})
          </button>
        )}
      </div>

      <div className="lms-table-wrap">
        <div className="lms-pager">
          <span>{total.toLocaleString('en-IN')} responses</span>
          <span style={{ marginLeft: 'auto' }}>Rows per page</span>
          <select className="lms-select" style={{ width: 82, padding: '5px 10px' }}
            value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(0); }}>
            {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span>{from}–{to}</span>
          <button className="lms-icon-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft size={17} />
          </button>
          <button className="lms-icon-btn" disabled={to >= total} onClick={() => setPage(p => p + 1)}>
            <ChevronRight size={17} />
          </button>
        </div>

        {loading ? (
          <Loader inline />
        ) : rows.length === 0 ? (
          <Empty
            icon={<ClipboardList size={24} />}
            title="No responses yet"
            message="Add form fields to a lesson from the course builder — answers land here as learners submit them."
          />
        ) : (
          <div className="lms-table-scroll">
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>Course</th>
                  <th>Lesson</th>
                  {columns.map(c => <th key={c}>{c}</th>)}
                  <th>Submitted</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div className="lms-user-cell">
                        <div className="lms-avatar">{(r.name || r.email || '?').charAt(0)}</div>
                        <div>
                          <div className="lms-user-name">{r.name || '—'}</div>
                          <div className="lms-user-mail">{r.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{r.course_title || '—'}</td>
                    <td>{r.lesson_title || '—'}</td>
                    {columns.map(c => (
                      <td key={c} style={{ maxWidth: 220, fontSize: 12.5 }}>
                        <Value value={r.payload?.[c]} />
                      </td>
                    ))}
                    <td>{shortDate(r.created_at)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="lms-icon-btn" title="View full response" onClick={() => setDetail(r)}>
                        <Eye size={16} />
                      </button>
                      <button
                        className="lms-icon-btn danger"
                        title="Delete response"
                        onClick={() => setConfirm({
                          message: `Delete the response submitted by ${r.name || r.email} on "${r.lesson_title}"? This cannot be undone.`,
                          run: async () => {
                            await LMS.deleteResponse(r.id);
                            toast.success('Response deleted');
                            setConfirm(null);
                            load();
                          },
                        })}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Drawer
        open={!!detail}
        title="Response detail"
        subtitle={detail ? `${detail.name || detail.email} — ${detail.lesson_title}` : ''}
        onClose={() => setDetail(null)}
      >
        {detail && Object.entries(detail.payload || {}).map(([k, v]) => (
          <div className="lms-field" key={k}>
            <label className="lms-label">{k}</label>
            <div style={{
              padding: '10px 13px', background: 'var(--lms-bg-page)', borderRadius: 8,
              fontSize: 13, lineHeight: 1.6, wordBreak: 'break-word',
            }}>
              <Value value={v} />
            </div>
          </div>
        ))}
        {detail && Object.keys(detail.payload || {}).length === 0 && (
          <p className="lms-help">This response has no stored fields.</p>
        )}
      </Drawer>

      <Confirm
        open={!!confirm}
        title="Delete response?"
        message={confirm?.message}
        confirmLabel="Delete"
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.run()}
      />
    </div>
  );
}
