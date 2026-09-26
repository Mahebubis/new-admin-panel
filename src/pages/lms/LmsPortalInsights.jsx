// ===========================================================================
//  LmsPortalInsights.jsx — two Reports views about the learning portal
//  (training.internshipstudio.com) that the other reports cannot answer:
//
//    DeviceReport    which browser / version / OS / device each visit came
//                    from, the learner's IP, whether it was inside an app
//                    (Instagram, WhatsApp…), and every playback problem —
//                    noticed by the player itself or reported by the learner
//                    from the "Video not playing?" troubleshooter. The point:
//                    when videos misbehave, see which browser and version it
//                    clusters on.
//
//    FeedbackReport  the learner's course review — stars, why, and the six
//                    Yes / No / Not sure questions — per course and overall.
//
//  Both read react-api/api/lms/lms_api.php (resource=reports, actions
//  portal_devices / course_feedback) and take the same from/to date filter.
// ===========================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle, Download, Globe, Monitor, Smartphone, Star, Users, MessageSquare, ChevronRight,
} from 'lucide-react';
import { LMS, duration } from './lmsApi';
import { Loader, Empty, Pill, Drawer } from './LmsStyles';

const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

const PRESETS = [
  { label: 'Today', from: () => iso(new Date()) },
  { label: '7 days', from: () => daysAgo(6) },
  { label: '30 days', from: () => daysAgo(29) },
  { label: '90 days', from: () => daysAgo(89) },
  { label: '1 year', from: () => daysAgo(364) },
];

const stamp = (d) => (d
  ? new Date(String(d).replace(' ', 'T')).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  : '—');

const ISSUE_LABEL = {
  learner_report: 'Reported by learner',
  load_error: 'Video failed to load',
  slow_load: 'Stuck loading',
  no_bridge: 'Player not responding',
};

function csv(rows, name) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('Exported');
}

/** From / to pickers plus one-click presets. */
export function DateRange({ from, to, onChange }) {
  const today = iso(new Date());
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <input type="date" className="lms-input" style={{ width: 150 }} value={from} max={to}
        onChange={(e) => onChange(e.target.value || from, to)} aria-label="From date" />
      <span style={{ color: 'var(--lms-text-2)', fontSize: 13 }}>to</span>
      <input type="date" className="lms-input" style={{ width: 150 }} value={to} min={from} max={today}
        onChange={(e) => onChange(from, e.target.value || to)} aria-label="To date" />
      <div className="lms-segment" style={{ marginLeft: 4 }}>
        {PRESETS.map((p) => {
          const f = p.from();
          return (
            <button key={p.label} className={from === f && to === today ? 'active' : ''} onClick={() => onChange(f, today)}>
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, icon, tone }) {
  return (
    <div className="lms-stat">
      <div>
        <div className="lms-stat-label">{label}</div>
        <div className="lms-stat-value" style={tone ? { color: tone } : undefined}>{value}</div>
      </div>
      <div className="lms-stat-ico">{icon}</div>
    </div>
  );
}

/** A share bar: the visit share, with the problem rate beside it. */
function Share({ part, whole }) {
  const pct = whole ? Math.round((part * 100) / whole) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 130 }}>
      <div className="lms-progress-bar"><i style={{ width: `${Math.min(100, pct)}%` }} /></div>
      <span style={{ fontSize: 12 }}>{pct}%</span>
    </div>
  );
}

function IssueRate({ issues, visits }) {
  if (!issues) return <span style={{ color: 'var(--lms-text-2)' }}>0</span>;
  const rate = visits ? Math.round((issues * 100) / visits) : 100;
  return <Pill tone={rate >= 10 ? 'red' : rate >= 3 ? 'amber' : 'grey'}>{issues} · {visits ? `${rate}%` : 'no visits'}</Pill>;
}

/* ═══════════════════════════ devices & issues ═══════════════════════════ */
export function DeviceReport() {
  const [range, setRange] = useState({ from: daysAgo(29), to: iso(new Date()) });
  /* The data remembers which query it answers, so "loading" is simply a
     mismatch — no state to flip at the start of the fetch. */
  const key = `${range.from}|${range.to}`;
  const [got, setGot] = useState({ key: '', data: null });
  const data = got.data;
  const loading = got.key !== key;
  const [tab, setTab] = useState('overview');   // overview | visits | issues
  const [q, setQ] = useState('');
  const [issue, setIssue] = useState(null);     // the row open in the drawer

  useEffect(() => {
    let alive = true;
    LMS.portalDevices(range.from, range.to)
      .then((d) => alive && setGot({ key, data: d }))
      .catch((e) => { toast.error(e.message); if (alive) setGot({ key, data: null }); });
    return () => { alive = false; };
  }, [range, key]);

  const match = useCallback((r) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [r.name, r.email, r.ip, r.browser, r.os, r.in_app, r.course, r.lesson, r.type]
      .some((v) => String(v || '').toLowerCase().includes(s));
  }, [q]);

  const visits = useMemo(() => (data?.visits || []).filter(match), [data, match]);
  const issues = useMemo(() => (data?.issues || []).filter(match), [data, match]);
  const sum = data?.summary || {};

  const exportNow = () => {
    if (tab === 'issues') {
      csv([['When', 'Student', 'Email', 'Course', 'Lesson', 'Problem', 'Source', 'Learner note', 'Detail',
        'Video kind', 'Browser', 'Version', 'OS', 'OS version', 'Device', 'In app', 'IP', 'User agent'],
      ...issues.map((r) => [r.created_at, r.name, r.email, r.course, r.lesson, ISSUE_LABEL[r.type] || r.type, r.source,
        r.note, r.detail, r.video_kind, r.browser, r.browser_version, r.os, r.os_version, r.device, r.in_app, r.ip, r.user_agent])],
      `portal-issues-${range.from}-${range.to}.csv`);
    } else {
      csv([['Started', 'Student', 'Email', 'IP', 'Browser', 'Version', 'OS', 'OS version', 'Device', 'In app',
        'Screen', 'Time on portal (s)', 'Screens', 'User agent'],
      ...visits.map((r) => [r.started_at, r.name, r.email, r.ip, r.browser, r.browser_version, r.os, r.os_version,
        r.device, r.in_app, r.screen, r.seconds, r.page_views, r.user_agent])],
      `portal-visits-${range.from}-${range.to}.csv`);
    }
  };

  return (
    <>
      <div className="lms-toolbar" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <DateRange from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />
        <button className="lms-btn lms-btn-ghost" onClick={exportNow} disabled={!data}>
          <Download size={16} /> Export {tab === 'issues' ? 'issues' : 'visits'}
        </button>
      </div>

      {loading ? <Loader /> : !data?.tracked ? (
        <Empty icon={<Monitor size={24} />} title="No portal data yet"
          message="Visits appear once learners sign in to training.internshipstudio.com with the updated portal." />
      ) : (
        <>
          <div className="lms-stat-strip">
            <Stat label="Visits" value={sum.visits} icon={<Globe size={18} />} />
            <Stat label="Students" value={sum.students} icon={<Users size={18} />} />
            <Stat label="Unique IPs" value={sum.unique_ips} icon={<Monitor size={18} />} />
            <Stat label="Opened inside an app" value={sum.in_app_visits} icon={<Smartphone size={18} />}
              tone={sum.in_app_visits ? 'var(--lms-red-dark)' : undefined} />
            <Stat label="Playback problems" value={sum.issues} icon={<AlertTriangle size={18} />}
              tone={sum.issues ? 'var(--lms-red-dark)' : undefined} />
          </div>
          {sum.capped && (
            <p className="lms-sub" style={{ marginTop: -6 }}>Showing the newest 20,000 visits — narrow the dates for exact totals.</p>
          )}

          <div className="lms-toolbar" style={{ gap: 10 }}>
            <div className="lms-segment">
              <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Browsers & devices</button>
              <button className={tab === 'visits' ? 'active' : ''} onClick={() => setTab('visits')}>Visits ({data.visits.length})</button>
              <button className={tab === 'issues' ? 'active' : ''} onClick={() => setTab('issues')}>Problems ({data.issues.length})</button>
            </div>
            {tab !== 'overview' && (
              <input className="lms-input" style={{ width: 260 }} placeholder="Search name, email, IP, browser…"
                value={q} onChange={(e) => setQ(e.target.value)} />
            )}
          </div>

          {tab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 18 }}>
              <Breakdown title="Browser & version" rows={data.browsers} total={sum.visits}
                name={(r) => `${r.browser}${r.version ? ` ${r.version}` : ''}`} />
              <Breakdown title="Operating system" rows={data.systems} total={sum.visits}
                name={(r) => `${r.os}${r.version ? ` ${r.version}` : ''}`} />
              <Breakdown title="Device" rows={data.devices} total={sum.visits}
                name={(r) => String(r.device).replace(/^./, (c) => c.toUpperCase())} />
              <Breakdown title="Opened inside an app" rows={data.apps} total={sum.visits}
                name={(r) => r.app}
                empty="Nobody opened the portal inside an app in this window." />
              {data.issue_types.length > 0 && (
                <div className="lms-table-wrap">
                  <div className="lms-table-scroll">
                    <table className="lms-table">
                      <thead><tr><th>Problem</th><th>Times</th></tr></thead>
                      <tbody>
                        {data.issue_types.map((t) => (
                          <tr key={t.type}><td style={{ fontWeight: 500 }}>{ISSUE_LABEL[t.type] || t.type}</td><td>{t.count}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'visits' && (
            !visits.length ? <Empty icon={<Globe size={22} />} title="No visits match" message="Try a wider date range or clear the search." /> : (
              <div className="lms-table-wrap">
                <div className="lms-table-scroll">
                  <table className="lms-table">
                    <thead>
                      <tr><th>Student</th><th>Browser</th><th>System</th><th>Device</th><th>IP address</th><th>Time</th><th>Started</th></tr>
                    </thead>
                    <tbody>
                      {visits.map((r) => (
                        <tr key={r.id} title={r.user_agent || ''}>
                          <td>
                            <div className="lms-user-cell">
                              <div className="lms-avatar">{(r.name || r.email || '?').charAt(0)}</div>
                              <div>
                                <div className="lms-user-name">{r.name || '—'}</div>
                                <div className="lms-user-mail">{r.email || `user #${r.user_id}`}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{r.browser} {r.browser_version}</div>
                            {r.in_app && <Pill tone="red">inside {r.in_app}</Pill>}
                          </td>
                          <td>{r.os} {r.os_version}</td>
                          <td>{r.device}{r.screen ? <div style={{ fontSize: 12, color: 'var(--lms-text-2)' }}>{r.screen}</div> : null}</td>
                          <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>{r.ip || '—'}</td>
                          <td>{duration(r.seconds)}</td>
                          <td>{stamp(r.started_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {tab === 'issues' && (
            !issues.length ? <Empty icon={<AlertTriangle size={22} />} title="No playback problems" message="Nothing was reported or detected in this window." /> : (
              <div className="lms-table-wrap">
                <div className="lms-table-scroll">
                  <table className="lms-table">
                    <thead>
                      <tr><th>When</th><th>Student</th><th>Problem</th><th>Lesson</th><th>Browser</th><th>System</th><th>IP</th><th /></tr>
                    </thead>
                    <tbody>
                      {issues.map((r) => (
                        <tr key={r.id} onClick={() => setIssue(r)} style={{ cursor: 'pointer' }}>
                          <td style={{ whiteSpace: 'nowrap' }}>{stamp(r.created_at)}</td>
                          <td>
                            <div className="lms-user-name">{r.name || '—'}</div>
                            <div className="lms-user-mail">{r.email}</div>
                          </td>
                          <td>
                            <Pill tone={r.source === 'learner' ? 'amber' : 'grey'}>{ISSUE_LABEL[r.type] || r.type}</Pill>
                            {r.note && <div style={{ fontSize: 12.5, marginTop: 4, maxWidth: 260 }}>“{r.note}”</div>}
                          </td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{r.lesson || '—'}</div>
                            <div className="lms-user-mail">{r.course}</div>
                          </td>
                          <td>{r.browser} {r.browser_version}{r.in_app && <div><Pill tone="red">inside {r.in_app}</Pill></div>}</td>
                          <td>{r.os} {r.os_version} · {r.device}</td>
                          <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>{r.ip}</td>
                          <td><ChevronRight size={15} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </>
      )}

      <Drawer open={!!issue} onClose={() => setIssue(null)} title={ISSUE_LABEL[issue?.type] || issue?.type || ''}
        subtitle={issue ? `${issue.name || issue.email || ''} · ${stamp(issue.created_at)}` : ''} width={520}>
        {issue && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13.5 }}>
            {issue.note && <div className="lms-card lms-card-pad"><b>Learner wrote:</b><p style={{ margin: '6px 0 0' }}>{issue.note}</p></div>}
            <Field k="Course / lesson" v={`${issue.course || '—'} → ${issue.lesson || '—'}`} />
            <Field k="Detail" v={issue.detail} />
            <Field k="Player" v={`${issue.video_kind || '—'} · ${issue.player_state || '—'}`} />
            <Field k="Video URL" v={issue.video_url} mono />
            <Field k="Browser" v={`${issue.browser} ${issue.browser_version}`} />
            <Field k="System" v={`${issue.os} ${issue.os_version} · ${issue.device}`} />
            <Field k="Inside an app" v={issue.in_app || 'No — a normal browser'} />
            <Field k="IP address" v={issue.ip} mono />
            {Object.entries(issue.device_json || {}).length > 0 && (
              <Field k="Device details" mono v={Object.entries(issue.device_json).map(([a, b]) => `${a}: ${b}`).join('\n')} />
            )}
            <Field k="User agent" v={issue.user_agent} mono />
          </div>
        )}
      </Drawer>
    </>
  );
}

function Field({ k, v, mono }) {
  return (
    <div>
      <div className="lms-label" style={{ marginBottom: 3 }}>{k}</div>
      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', ...(mono ? { fontFamily: 'ui-monospace, monospace', fontSize: 12.5 } : {}) }}>
        {v || '—'}
      </div>
    </div>
  );
}

function Breakdown({ title, rows, total, name, empty }) {
  return (
    <div className="lms-table-wrap">
      <div className="lms-table-scroll">
        <table className="lms-table">
          <thead><tr><th>{title}</th><th>Visits</th><th>Share</th><th>Students</th><th>Problems</th></tr></thead>
          <tbody>
            {!rows.length ? (
              <tr><td colSpan={5} style={{ color: 'var(--lms-text-2)' }}>{empty || 'No data in this window.'}</td></tr>
            ) : rows.slice(0, 25).map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{name(r)}</td>
                <td>{r.visits}</td>
                <td><Share part={r.visits} whole={total} /></td>
                <td>{r.students}</td>
                <td><IssueRate issues={r.issues} visits={r.visits} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════ course feedback ════════════════════════════ */
const StarRow = ({ n, size = 14 }) => (
  <span style={{ display: 'inline-flex', gap: 1, color: '#f5a623' }} aria-label={`${n} of 5`}>
    {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} fill={i <= Math.round(n) ? 'currentColor' : 'none'} />)}
  </span>
);

export function FeedbackReport({ courses = [] }) {
  const [range, setRange] = useState({ from: daysAgo(89), to: iso(new Date()) });
  const [courseId, setCourseId] = useState('');
  const key = `${range.from}|${range.to}|${courseId}`;
  const [got, setGot] = useState({ key: '', data: null });
  const data = got.data;
  const loading = got.key !== key;
  const [stars, setStars] = useState(0);        // filter the reviews list by rating

  useEffect(() => {
    let alive = true;
    LMS.courseFeedback({ from: range.from, to: range.to, course_id: courseId || 0 })
      .then((d) => alive && setGot({ key, data: d }))
      .catch((e) => { toast.error(e.message); if (alive) setGot({ key, data: null }); });
    return () => { alive = false; };
  }, [range, courseId, key]);

  const sum = data?.summary || { count: 0, average: 0, distribution: {} };
  const rows = (data?.rows || []).filter((r) => !stars || r.rating === stars);
  const maxDist = Math.max(1, ...Object.values(sum.distribution || {}));
  const qLabel = { yes: 'Yes', no: 'No', not_sure: 'Not sure' };

  const exportNow = () => {
    const keys = (data?.questions || []).map((q) => q.key);
    csv([['Updated', 'Student', 'Email', 'Course', 'Rating', 'Review', 'Progress %', ...(data?.questions || []).map((q) => q.text)],
      ...rows.map((r) => [r.updated_at || r.created_at, r.name, r.email, r.course, r.rating, r.review, r.progress,
        ...keys.map((k) => qLabel[r.answers?.[k]] || '')])],
    `course-feedback-${range.from}-${range.to}.csv`);
  };

  return (
    <>
      <div className="lms-toolbar" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <DateRange from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />
          <select className="lms-select" style={{ width: 240 }} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">All courses</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <button className="lms-btn lms-btn-ghost" onClick={exportNow} disabled={!rows.length}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      {loading ? <Loader /> : !data?.tracked || !sum.count ? (
        <Empty icon={<MessageSquare size={24} />} title="No feedback in this window"
          message="Learners are asked to rate a course after completing a couple of lessons, and can rate any time from the course page." />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: 18, marginBottom: 20 }}>
            <div className="lms-card lms-card-pad" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1, color: '#b4690e' }}>{Number(sum.average).toFixed(1)}</div>
              <div style={{ margin: '8px 0 4px' }}><StarRow n={sum.average} size={20} /></div>
              <div className="lms-sub">{sum.count} review{sum.count === 1 ? '' : 's'}</div>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <button key={n} type="button" onClick={() => setStars(stars === n ? 0 : n)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 0, cursor: 'pointer', padding: 0, opacity: stars && stars !== n ? 0.45 : 1 }}
                    title={`Show ${n}-star reviews`}>
                    <div className="lms-progress-bar" style={{ flex: 1 }}>
                      <i style={{ width: `${((sum.distribution?.[n] || 0) * 100) / maxDist}%`, background: '#f5a623' }} />
                    </div>
                    <StarRow n={n} size={12} />
                    <span style={{ fontSize: 12, width: 26, textAlign: 'right' }}>{sum.distribution?.[n] || 0}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="lms-table-wrap">
              <div className="lms-table-scroll">
                <table className="lms-table">
                  <thead><tr><th>Question</th><th>Yes</th><th>No</th><th>Not sure</th><th style={{ width: 170 }}>Yes share</th></tr></thead>
                  <tbody>
                    {data.questions.map((q) => {
                      const tot = q.yes + q.no + q.not_sure;
                      return (
                        <tr key={q.key}>
                          <td style={{ fontWeight: 500 }}>{q.text}</td>
                          <td>{q.yes}</td><td>{q.no}</td><td>{q.not_sure}</td>
                          <td>{tot ? <Share part={q.yes} whole={tot} /> : <span className="lms-sub">no answers</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {!courseId && data.courses.length > 1 && (
            <div className="lms-table-wrap" style={{ marginBottom: 20 }}>
              <div className="lms-table-scroll">
                <table className="lms-table">
                  <thead><tr><th>Course</th><th>Reviews</th><th>Average</th><th>5★</th><th>4★</th><th>3★</th><th>2★</th><th>1★</th></tr></thead>
                  <tbody>
                    {data.courses.map((c) => (
                      <tr key={c.course_id} style={{ cursor: 'pointer' }} onClick={() => setCourseId(String(c.course_id))}>
                        <td style={{ fontWeight: 500 }}>{c.title}</td>
                        <td>{c.count}</td>
                        <td><b>{Number(c.average).toFixed(1)}</b> <StarRow n={c.average} size={12} /></td>
                        {[5, 4, 3, 2, 1].map((n) => <td key={n}>{c.distribution?.[n] || 0}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <h2 className="lms-h3" style={{ margin: '0 0 10px' }}>
            Reviews {stars ? `· ${stars} star${stars === 1 ? '' : 's'}` : ''} ({rows.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map((r) => (
              <div key={r.id} className="lms-card lms-card-pad">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div className="lms-user-cell">
                    <div className="lms-avatar">{(r.name || r.email || '?').charAt(0)}</div>
                    <div>
                      <div className="lms-user-name">{r.name || '—'}</div>
                      <div className="lms-user-mail">{r.email} · {r.course}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <StarRow n={r.rating} size={16} />
                    <div className="lms-user-mail">{stamp(r.updated_at || r.created_at)} · {r.progress}% through</div>
                  </div>
                </div>
                {r.review && <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.55 }}>{r.review}</p>}
                {Object.keys(r.answers || {}).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {data.questions.filter((q) => r.answers[q.key]).map((q) => (
                      <Pill key={q.key} tone={r.answers[q.key] === 'yes' ? 'green' : r.answers[q.key] === 'no' ? 'red' : 'grey'}>
                        {q.text.replace(/\?$/, '')}: {qLabel[r.answers[q.key]]}
                      </Pill>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}


