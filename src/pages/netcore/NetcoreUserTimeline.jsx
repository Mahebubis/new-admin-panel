import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/axios';

const API = '/api/netcore/user_timeline.php';

const EVENT_LABELS = {
  register: 'Register',
  signin: 'Signin',
  exam_success: 'Exam Success',
  course_purchase: 'Course Purchase',
  payment_success: 'Payment Success',
  preferred_domain: 'Preferred Domain',
  visited_iap: 'Visited IAP',
  result_view: 'Result View',
  placement_community_link: 'Placement Community Link',
  instantexam_reminder: 'Instantexam Reminder',
  course_edit: 'Course Edit',
  register_company: 'Register Company',
  company_signin: 'Company Signin',
  company_vacancy_post: 'Company Vacancy Post',
  mark_attendance: 'Mark Attendance',
  came_on_dashboard: 'Came on Dashboard',
  link_assigned: 'Link Assigned',
  exam_reminder: 'Exam Reminder',
  project_submission_reminder: 'Project Submission Reminder',
  one_day_before_batch_start: 'One Day Before Batch Start',
  batch_end_reminder: 'Batch End Reminder',
};

/* small dotted circle */
function CircleLoader() {
  const dots = 12, radius = 22;
  return (
    <div style={{ position: 'relative', width: 60, height: 60 }}>
      {Array.from({ length: dots }).map((_, i) => {
        const a = (i / dots) * 2 * Math.PI;
        const x = 30 + radius * Math.cos(a) - 4;
        const y = 30 + radius * Math.sin(a) - 4;
        return (
          <span key={i} style={{
            position: 'absolute', left: x, top: y, width: 8, height: 8, borderRadius: '50%',
            background: '#1e3a8a',
            animation: 'nc_tl_dot 1.2s linear infinite',
            animationDelay: `${(-i / dots) * 1.2}s`, opacity: 0.15,
          }} />
        );
      })}
    </div>
  );
}

/* device icon — matches screenshot: monitor for desktop, phone for mobile */
function DeviceIcon({ device }) {
  const isMobile = (device || '').toLowerCase() === 'mobile';
  if (isMobile) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="7" y="2" width="10" height="20" rx="2" /><line x1="11" y1="18" x2="13" y2="18" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function fmtDt(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  if (isNaN(d.getTime())) return s;
  /* "2026-05-05 09:18:34" style — matches screenshot */
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function NetcoreUserTimeline() {
  const { email } = useParams();
  const [search]  = useSearchParams();
  const location  = useLocation();
  const navigate  = useNavigate();

  /* Back target: respect the page that linked us here (e.g. Behaviour Users tab)
     and fall back to the contacts list when no caller state was passed. */
  const backTo    = location.state?.backTo    || '/netcore/contacts';
  const backLabel = location.state?.backLabel || 'Profile details';
  const userId    = search.get('uid');

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [device, setDevice]   = useState(null);
  const [events, setEvents]   = useState([]);
  const [error, setError]     = useState('');

  const [popOpen, setPopOpen]       = useState(false);
  const [popLoading, setPopLoading] = useState(false);
  const [popData, setPopData]       = useState(null);
  const [popMeta, setPopMeta]       = useState(null);
  const popClickRef = useRef(null);

  /* timeline filters / sort */
  const [q, setQ]           = useState('');
  const [fromD, setFromD]   = useState('');
  const [toD, setToD]       = useState('');
  const [sortDir, setSortDir] = useState('desc');

  const filteredEvents = (() => {
    const qLower = q.trim().toLowerCase();
    const fromTs = fromD ? new Date(fromD + 'T00:00:00').getTime() : null;
    const toTs   = toD   ? new Date(toD   + 'T23:59:59').getTime() : null;

    const list = events.filter(e => {
      if (qLower) {
        const lbl = (EVENT_LABELS[e.event] || e.event || '').toLowerCase();
        if (!lbl.includes(qLower) && !(e.event || '').toLowerCase().includes(qLower)) return false;
      }
      if (fromTs || toTs) {
        const t = new Date((e.timestamp || '').replace(' ', 'T')).getTime();
        if (isNaN(t)) return false;
        if (fromTs && t < fromTs) return false;
        if (toTs   && t > toTs)   return false;
      }
      return true;
    });

    list.sort((a, b) => {
      const ta = new Date((a.timestamp || '').replace(' ', 'T')).getTime() || 0;
      const tb = new Date((b.timestamp || '').replace(' ', 'T')).getTime() || 0;
      return sortDir === 'asc' ? ta - tb : tb - ta;
    });

    return list;
  })();

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    const params = userId ? { action: 'timeline', user_id: userId } : { action: 'timeline', email };
    api.get(API, { params }).then(res => {
      if (cancelled) return;
      if (res.data.status === 'success') {
        setProfile(res.data.profile);
        setDevice(res.data.device);
        setEvents(res.data.events || []);
      } else {
        setError(res.data.message || 'Failed to load timeline');
      }
    }).catch(() => { if (!cancelled) setError('Network error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [email, userId]);

  /* close popup on outside click */
  useEffect(() => {
    if (!popOpen) return;
    const onDown = e => { if (popClickRef.current && !popClickRef.current.contains(e.target)) setPopOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [popOpen]);

  const openEvent = async (ev) => {
    setPopMeta({ event: ev.event, label: EVENT_LABELS[ev.event] || ev.event, ts: ev.timestamp });
    setPopData(null);
    setPopOpen(true);
    setPopLoading(true);
    try {
      const res = await api.get(API, { params: { action: 'event_detail', event: ev.event, user_id: ev.user_id, ts: ev.timestamp } });
      if (res.data.status === 'success') setPopData(res.data.data);
      else setPopData({ error: res.data.message || 'Not found' });
    } catch { setPopData({ error: 'Network error' }); }
    finally { setPopLoading(false); }
  };

  const initials = (() => {
    const n = profile?.fname || profile?.email || '?';
    return n.slice(0, 1).toUpperCase();
  })();

  const fullName = [profile?.fname, profile?.lname].filter(Boolean).join(' ') || 'NA';

  return (
    <>
      <style>{`
        @keyframes nc_tl_dot { 0% { opacity: .15; } 25% { opacity: 1; } 100% { opacity: .15; } }
        @keyframes nc_tl_fadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .nc-tl-page *{ box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .nc-tl-row { animation: nc_tl_fadein .25s ease both; transition: background .15s; }
        .nc-tl-row:hover { background: #f5f3ff !important; cursor: pointer; }
        .nc-tl-event-link { color: #1e3a8a; font-weight: 600; font-size: 13px; text-decoration: none; }
        .nc-tl-event-link:hover { text-decoration: underline; }
        .nc-tl-desc { color: #94a3b8; font-size: 11.5px; margin-top: 3px; }
        .nc-tl-desc b { color: #475569; font-weight: 600; }
      `}</style>

      <div className="nc-tl-page" style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        padding: 20, gap: 14, overflow: 'hidden', /* page itself doesn't scroll */
      }}>

        {/* breadcrumb */}
        <div style={{ flexShrink: 0 }}>
          <Link to={backTo} style={{ color: '#1e3a8a', textDecoration: 'none', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
            {backLabel}
          </Link>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <CircleLoader />
            <div style={{ fontSize: 13, color: '#64748b' }}>Loading timeline…</div>
          </div>
        ) : error ? (
          <div style={{ padding: 24, color: '#dc2626', fontSize: 13 }}>{error}</div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14 }}>

            {/* left: profile card */}
            <aside style={{
              flex: '0 0 260px', background: '#fff', borderRadius: 10, padding: 22,
              boxShadow: '0 1px 3px rgba(0,0,0,.05)', height: 'fit-content', alignSelf: 'flex-start'
            }}>
              {/* avatar */}
              <div style={{
                width: 90, height: 90, borderRadius: '50%', margin: '0 auto 14px',
                background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#1e3a8a', fontSize: 30, fontWeight: 700, overflow: 'hidden'
              }}>
                {profile?.photo ? (
                  <img src={profile.photo} alt={fullName}
                       style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                       onError={e => { e.target.style.display = 'none'; e.target.parentNode.textContent = initials; }} />
                ) : initials}
              </div>
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 14 }}>
                User NC - {profile?.user_id || userId}
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14, fontSize: 13, color: '#334155' }}>
                <Row label="Email"  value={profile?.email || '—'} />
                <Row label="Phone"  value={profile?.phone || 'NA'} />
                <Row label="Name"   value={fullName} />
                <Row label="Joined" value={profile?.registered_at ? fmtDt(profile.registered_at) : '—'} />
              </div>
            </aside>

            {/* right: timeline card — only this scrolls */}
            <section style={{
              flex: 1, minWidth: 0, background: '#fff', borderRadius: 10,
              boxShadow: '0 1px 3px rgba(0,0,0,.05)', display: 'flex', flexDirection: 'column', minHeight: 0
            }}>
              {/* header */}
              <div style={{ padding: '14px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Timeline
                  <span style={{ color: '#64748b', fontWeight: 500, fontSize: 12 }}>
                    ({filteredEvents.length}{filteredEvents.length !== events.length ? ` of ${events.length}` : ''} events)
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {/* search */}
                  <div style={{ position: 'relative' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
                      style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      type="text" value={q} onChange={e => setQ(e.target.value)}
                      placeholder="Search event…"
                      style={{ padding: '6px 10px 6px 28px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12.5, outline: 'none', width: 170, fontFamily: 'inherit' }}
                    />
                  </div>

                  {/* date range */}
                  <input
                    type="date" value={fromD} onChange={e => setFromD(e.target.value)}
                    title="From date"
                    style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12.5, color: '#334155', fontFamily: 'inherit' }}
                  />
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>→</span>
                  <input
                    type="date" value={toD} onChange={e => setToD(e.target.value)}
                    title="To date"
                    style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12.5, color: '#334155', fontFamily: 'inherit' }}
                  />

                  {/* sort toggle */}
                  <button
                    onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                    title={sortDir === 'desc' ? 'Newest first (click for oldest first)' : 'Oldest first (click for newest first)'}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#334155', fontFamily: 'inherit', fontWeight: 600 }}>
                    {sortDir === 'desc' ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h13M3 12h9M3 18h5M17 8v13M17 21l-4-4M17 21l4-4"/>
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h5M3 12h9M3 18h13M17 16V3M17 3l-4 4M17 3l4 4"/>
                      </svg>
                    )}
                    {sortDir === 'desc' ? 'Newest' : 'Oldest'}
                  </button>

                  {(q || fromD || toD) && (
                    <button
                      onClick={() => { setQ(''); setFromD(''); setToD(''); }}
                      title="Clear filters"
                      style={{ padding: '6px 10px', border: '1px solid #fecaca', borderRadius: 6, background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}>
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* column header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 100px 80px 180px',
                padding: '12px 22px', borderBottom: '1px solid #f1f5f9', flexShrink: 0,
                fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '.4px', textTransform: 'uppercase'
              }}>
                <div>Event info</div>
                <div>Platform</div>
                <div>Device</div>
                <div>Received on</div>
              </div>

              {/* scrollable rows */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {filteredEvents.length === 0
                  ? <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                      {events.length === 0 ? 'No events' : 'No events match the filters'}
                    </div>
                  : filteredEvents.map((e, i) => {
                    const label = EVENT_LABELS[e.event] || e.event;
                    const lower = label.toLowerCase();
                    return (
                      <div key={`${e.event}-${e.timestamp}-${i}`} className="nc-tl-row"
                        onClick={() => openEvent(e)}
                        style={{
                          display: 'grid', gridTemplateColumns: '1fr 100px 80px 180px',
                          padding: '14px 22px', borderBottom: '1px solid #f1f5f9', alignItems: 'center', gap: 8
                        }}>
                        {/* event info */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
                          <span style={{
                            width: 32, height: 32, borderRadius: 8, background: '#dbeafe',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            color: '#1e3a8a'
                          }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                            </svg>
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <span className="nc-tl-event-link">{label}</span>
                            <div className="nc-tl-desc">
                              #. <b>{lower}</b> activity was done on {fmtDt(e.timestamp)}
                            </div>
                          </div>
                        </div>
                        {/* platform — empty placeholder */}
                        <div></div>
                        {/* device */}
                        <div><DeviceIcon device={device} /></div>
                        {/* received on */}
                        <div style={{ color: '#475569', fontSize: 12.5 }}>{fmtDt(e.timestamp)}</div>
                      </div>
                    );
                  })
                }
              </div>
            </section>
          </div>
        )}

        {/* event-detail popup */}
        {popOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div ref={popClickRef}
              style={{ background: '#fff', borderRadius: 12, width: 'min(640px, 100%)', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Activity details</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {popMeta?.label} · {fmtDt(popMeta?.ts)}
                  </div>
                </div>
                <button onClick={() => setPopOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#94a3b8', lineHeight: 1 }}>×</button>
              </div>
              <div>
                {popLoading ? (
                  <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
                    <CircleLoader />
                  </div>
                ) : popData?.error ? (
                  <div style={{ padding: 24, color: '#dc2626', fontSize: 13 }}>{popData.error}</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#475569' }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid #e2e8f0' }}>Parameter</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid #e2e8f0' }}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(popData || {}).map(([k, v]) => (
                        <tr key={k}>
                          <td style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', color: '#334155', whiteSpace: 'nowrap' }}>{k}</td>
                          <td style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', wordBreak: 'break-all' }}>
                            {v === null || v === '' ? <span style={{ color: '#94a3b8' }}>NA</span> : String(v)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', fontSize: 12.5 }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ color: '#0f172a', fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}
