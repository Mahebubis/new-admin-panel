import { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';

/*
  Full-screen bottom sheet: every ad one student came through, from api/students/ad_visits.php.
  Matching rules live in api/lib/AdJourney.php — "Same browser" is reliable, "Same network" is a hint.
*/

const SOURCE_COLORS = {
  facebook: '#1877f2', fb: '#1877f2', instagram: '#d62976', ig: '#d62976', meta: '#0668e1',
  google: '#ea4335', youtube: '#ff0000', linkedin: '#0a66c2', whatsapp: '#25d366', email: '#7c3aed',
};
const sourceColor = (s) => SOURCE_COLORS[String(s || '').toLowerCase()] || '#64748b';

const CONFIDENCE = {
  high:   { label: 'High confidence',   bg: '#dcfce7', fg: '#166534' },
  medium: { label: 'Medium confidence', bg: '#fef9c3', fg: '#854d0e' },
  low:    { label: 'Low confidence',    bg: '#fee2e2', fg: '#991b1b' },
};

const CONTEXT_LABELS = {
  normal_register: 'Signup', google_register: 'Google signup', apple_register: 'Apple signup',
  mobile_register: 'Mobile signup', referral_register: 'Referral signup',
  google_login: 'Google login', apple_login: 'Apple login', password_login: 'Password login',
};

function fmt(ts) {
  if (!ts) return '—';
  const d = new Date(ts.replace(' ', 'T'));
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* "3 days before signup" — how the ad sits relative to registration. */
function relToSignup(ts, reg) {
  if (!ts || !reg) return '';
  const diff = new Date(reg.replace(' ', 'T')) - new Date(ts.replace(' ', 'T'));
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const span = mins < 60 ? `${mins} min` : mins < 1440 ? `${Math.round(mins / 60)} hr` : `${Math.round(mins / 1440)} days`;
  return diff >= 0 ? `${span} before signup` : `${span} after signup`;
}

const Svg = ({ children, size = 16, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" {...p}>{children}</svg>
);

export default function AdJourneyDrawer({ student, onClose }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [when, setWhen] = useState('all');   // all | before | after
  const [match, setMatch] = useState('all'); // all | device | ip
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    requestAnimationFrame(() => setOpen(true));
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    api.get('/api/students/ad_visits.php', { params: { action: 'user', user_id: student.user_id } })
      .then((res) => {
        if (cancelled) return;
        if (res.data.success) setData(res.data.data);
        else setError(res.data.message || 'Could not load ad visits');
      })
      .catch(() => { if (!cancelled) setError('Could not load ad visits'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [student.user_id]);

  const close = () => { setOpen(false); setTimeout(onClose, 380); };

  const reg = data?.user?.registered_at;
  const visits = useMemo(() => (data?.visits || []).filter((v) =>
    (when === 'all' || (when === 'before' ? v.before_register === true : v.before_register === false)) &&
    (match === 'all' || v.match_type === match)
  ), [data, when, match]);

  /* Where the "Signed up" marker goes in the list. */
  const signupIndex = reg ? visits.findIndex((v) => v.visited_at > reg) : -1;
  const s = data?.stats;
  const sourceTotal = s ? Object.values(s.sources || {}).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <style>{`
        .ajd-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.5); z-index: 10000; opacity: 0; transition: opacity .25s ease; backdrop-filter: blur(2px); }
        .ajd-backdrop.open { opacity: 1; }
        .ajd-sheet { position: fixed; left: 0; right: 0; bottom: 0; top: 8vh; z-index: 10001; background: #f8fafc; display: flex; flex-direction: column;
          border-radius: 18px 18px 0 0; overflow: hidden; box-shadow: 0 -12px 40px rgba(15,23,42,.18);
          transform: translateY(100%); transition: transform .38s cubic-bezier(.32,.72,0,1); font-family: 'Plus Jakarta Sans', sans-serif; }
        .ajd-sheet.open { transform: translateY(0); }
        .ajd-sheet * { box-sizing: border-box; }
        .ajd-head { flex-shrink: 0; background: #fff; border-bottom: 1px solid #e2e8f0; padding: 20px 28px 14px; display: flex; align-items: center; gap: 16px; }
        .ajd-grip { position: absolute; top: 6px; left: 50%; transform: translateX(-50%); width: 44px; height: 4px; border-radius: 4px; background: #cbd5e1; }
        .ajd-avatar { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; flex-shrink: 0; }
        .ajd-close { margin-left: auto; width: 36px; height: 36px; border-radius: 10px; border: 1px solid #e2e8f0; background: #fff; color: #475569; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .15s; }
        .ajd-close:hover { background: #f1f5f9; color: #0f172a; }
        .ajd-body { flex: 1; overflow-y: auto; padding: 24px 28px 40px; }
        .ajd-wrap { max-width: 1280px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
        .ajd-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
        .ajd-stat { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; }
        .ajd-stat-l { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: .5px; }
        .ajd-stat-v { font-size: 24px; font-weight: 700; color: #0f172a; margin-top: 4px; line-height: 1.1; }
        .ajd-stat-s { font-size: 11.5px; color: #94a3b8; margin-top: 4px; }
        .ajd-stat-t { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 6px; line-height: 1.35; word-break: break-word; }
        .ajd-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; }
        .ajd-card-h { padding: 14px 18px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .ajd-card-t { font-size: 14px; font-weight: 700; color: #0f172a; }
        .ajd-seg { display: inline-flex; background: #f1f5f9; border-radius: 8px; padding: 3px; }
        .ajd-seg button { border: none; background: transparent; padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; color: #64748b; cursor: pointer; font-family: inherit; }
        .ajd-seg button.on { background: #fff; color: #4f46e5; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
        .ajd-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr); gap: 20px; align-items: start; }
        @media (max-width: 1000px) { .ajd-grid { grid-template-columns: 1fr; } }
        .ajd-tl { padding: 8px 18px 18px; }
        .ajd-item { position: relative; padding-left: 34px; padding-top: 14px; }
        .ajd-item::before { content: ''; position: absolute; left: 11px; top: 0; bottom: -14px; width: 2px; background: #e2e8f0; }
        .ajd-item:last-child::before { bottom: auto; height: 30px; }
        .ajd-dot { position: absolute; left: 4px; top: 26px; width: 16px; height: 16px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 0 1px #e2e8f0; }
        .ajd-visit { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; cursor: pointer; transition: border-color .15s, box-shadow .15s; background: #fff; }
        .ajd-visit:hover { border-color: #c7d2fe; box-shadow: 0 2px 10px rgba(79,70,229,.08); }
        .ajd-visit.after { background: #fcfcfd; }
        .ajd-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .ajd-label { font-size: 13.5px; font-weight: 700; color: #0f172a; word-break: break-word; }
        .ajd-chip { display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; }
        .ajd-meta { font-size: 12px; color: #64748b; margin-top: 6px; display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
        .ajd-kv { display: grid; grid-template-columns: 140px 1fr; gap: 6px 12px; margin-top: 12px; padding-top: 12px; border-top: 1px dashed #e2e8f0; font-size: 12px; }
        .ajd-kv dt { color: #64748b; }
        .ajd-kv dd { margin: 0; color: #0f172a; word-break: break-all; }
        .ajd-signup { position: relative; padding: 16px 0 2px 34px; }
        .ajd-signup::before { content: ''; position: absolute; left: 11px; top: 0; bottom: -14px; width: 2px; background: #e2e8f0; }
        .ajd-signup-pill { display: inline-flex; align-items: center; gap: 8px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; border-radius: 999px; padding: 5px 12px; font-size: 12px; font-weight: 700; }
        .ajd-signup-dot { position: absolute; left: 2px; top: 18px; width: 20px; height: 20px; border-radius: 50%; background: #10b981; color: #fff; display: flex; align-items: center; justify-content: center; border: 3px solid #fff; box-shadow: 0 0 0 1px #a7f3d0; }
        .ajd-bar { display: flex; height: 8px; border-radius: 6px; overflow: hidden; background: #f1f5f9; }
        .ajd-net { padding: 12px 18px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
        .ajd-net:last-child { border-bottom: none; }
        .ajd-note { font-size: 12px; color: #475569; line-height: 1.6; padding: 14px 18px; }
        .ajd-note b { color: #0f172a; }
        .ajd-empty { padding: 48px 20px; text-align: center; color: #94a3b8; font-size: 13px; }
        .ajd-skel { background: linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size: 200% 100%; animation: ajd-sh 1.2s infinite; border-radius: 10px; }
        @keyframes ajd-sh { to { background-position: -200% 0; } }
        @media (max-width: 640px) { .ajd-head, .ajd-body { padding-left: 16px; padding-right: 16px; } .ajd-kv { grid-template-columns: 1fr; } }
      `}</style>

      <div className={`ajd-backdrop${open ? ' open' : ''}`} onClick={close} />
      <div className={`ajd-sheet${open ? ' open' : ''}`} role="dialog" aria-modal="true" aria-label="Ad journey">
        <div className="ajd-head" style={{ position: 'relative' }}>
          <span className="ajd-grip" />
          <div className="ajd-avatar">{(student.name || '?').trim().slice(0, 1).toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Ad journey · {student.name || 'Student'}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>#{student.user_id}</span>
              <span>{student.email}</span>
              {student.phone && <span>{student.phone}</span>}
              {reg && <span>Signed up {fmt(reg)}</span>}
            </div>
          </div>
          <button className="ajd-close" onClick={close} title="Close (Esc)">
            <Svg size={18}><path d="M18 6 6 18M6 6l12 12" /></Svg>
          </button>
        </div>

        <div className="ajd-body">
          <div className="ajd-wrap">
            {loading ? (
              <>
                <div className="ajd-stats">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="ajd-skel" style={{ height: 92 }} />)}</div>
                <div className="ajd-skel" style={{ height: 380 }} />
              </>
            ) : error ? (
              <div className="ajd-card ajd-empty" style={{ color: '#dc2626' }}>{error}</div>
            ) : (
              <>
                {/* ── summary ── */}
                <div className="ajd-stats">
                  <div className="ajd-stat">
                    <div className="ajd-stat-l">Ad visits</div>
                    <div className="ajd-stat-v">{s.total}</div>
                    <div className="ajd-stat-s">{s.device} same browser · {s.ip} same network</div>
                  </div>
                  <div className="ajd-stat">
                    <div className="ajd-stat-l">Before signup</div>
                    <div className="ajd-stat-v" style={{ color: '#4f46e5' }}>{s.before_register}</div>
                    <div className="ajd-stat-s">{s.total - s.before_register} after signup</div>
                  </div>
                  <div className="ajd-stat">
                    <div className="ajd-stat-l">Distinct ads</div>
                    <div className="ajd-stat-v">{s.distinct_ads}</div>
                    <div className="ajd-stat-s">{Object.keys(s.sources || {}).length} sources</div>
                  </div>
                  <div className="ajd-stat">
                    <div className="ajd-stat-l">First touch</div>
                    <div className="ajd-stat-t">{s.first_touch || '—'}</div>
                  </div>
                  <div className="ajd-stat">
                    <div className="ajd-stat-l">Last touch before signup</div>
                    <div className="ajd-stat-t">{s.last_touch || '—'}</div>
                  </div>
                </div>

                <div className="ajd-grid">
                  {/* ── journey ── */}
                  <div className="ajd-card">
                    <div className="ajd-card-h">
                      <span className="ajd-card-t">Journey</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{visits.length} of {s.total}</span>
                      <div style={{ flex: 1 }} />
                      <div className="ajd-seg">
                        {[['all', 'All'], ['before', 'Before signup'], ['after', 'After signup']].map(([k, l]) => (
                          <button key={k} className={when === k ? 'on' : ''} onClick={() => setWhen(k)}>{l}</button>
                        ))}
                      </div>
                      <div className="ajd-seg">
                        {[['all', 'Any match'], ['device', 'Browser'], ['ip', 'Network']].map(([k, l]) => (
                          <button key={k} className={match === k ? 'on' : ''} onClick={() => setMatch(k)}>{l}</button>
                        ))}
                      </div>
                    </div>

                    {visits.length === 0 ? (
                      <div className="ajd-empty">No ad visits match these filters.</div>
                    ) : (
                      <div className="ajd-tl">
                        {visits.map((v, i) => (
                          <div key={`${v.id}-${v.match_type}`}>
                            {i === signupIndex && <SignupMarker reg={reg} />}
                            <VisitItem v={v} reg={reg} open={expanded === v.id}
                              onToggle={() => setExpanded((x) => (x === v.id ? null : v.id))} />
                          </div>
                        ))}
                        {reg && signupIndex === -1 && when !== 'after' && <SignupMarker reg={reg} />}
                      </div>
                    )}
                  </div>

                  {/* ── side panel ── */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div className="ajd-card">
                      <div className="ajd-card-h"><span className="ajd-card-t">Sources</span></div>
                      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="ajd-bar">
                          {Object.entries(s.sources || {}).map(([src, n]) => (
                            <span key={src} style={{ width: `${(n / sourceTotal) * 100}%`, background: sourceColor(src) }} />
                          ))}
                        </div>
                        {Object.entries(s.sources || {}).map(([src, n]) => (
                          <div key={src} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 3, background: sourceColor(src) }} />
                            <span style={{ color: '#0f172a', fontWeight: 600, textTransform: 'capitalize' }}>{src}</span>
                            <span style={{ marginLeft: 'auto', color: '#64748b' }}>{n} visit{n === 1 ? '' : 's'}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="ajd-card">
                      <div className="ajd-card-h"><span className="ajd-card-t">Networks this student used</span></div>
                      {(data.networks || []).length === 0 ? (
                        <div className="ajd-empty" style={{ padding: 24 }}>No IP logged for this student.</div>
                      ) : data.networks.map((n) => (
                        <div key={n.network} className="ajd-net">
                          <div className="ajd-row">
                            <span className="ajd-chip" style={{ background: n.ip_version === 6 ? '#e0e7ff' : '#f1f5f9', color: n.ip_version === 6 ? '#3730a3' : '#475569' }}>
                              IPv{n.ip_version}
                            </span>
                            <code style={{ fontSize: 12, color: '#0f172a', wordBreak: 'break-all' }}>{n.network}</code>
                          </div>
                          <div className="ajd-meta" style={{ marginTop: 6 }}>
                            <span>{n.contexts.map((c) => CONTEXT_LABELS[c] || c).join(', ')}</span>
                            <span>
                              {n.shared_with_users === null ? 'Shared: unknown'
                                : n.shared_with_users === 0 ? 'No other student on it'
                                  : `${n.shared_with_users} other student${n.shared_with_users === 1 ? '' : 's'} on it`}
                            </span>
                          </div>
                          {n.addresses.length > 1 && (
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{n.addresses.length} addresses in this network</div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="ajd-card">
                      <div className="ajd-card-h"><span className="ajd-card-t">How visits are matched</span></div>
                      <div className="ajd-note">
                        <b>Same browser</b>: the visit came from the browser this student later signed up or logged in on. Reliable.<br />
                        <b>Same network</b>: an anonymous visit from a network this student used, within 7 days before or 1 day after.
                        On <b>IPv4</b>, everyone on one Wi-Fi or mobile carrier shares the address, so this can be a classmate.
                        <b>IPv6</b> is matched on the device's network (/64), which is much more specific.
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function SignupMarker({ reg }) {
  return (
    <div className="ajd-signup">
      <span className="ajd-signup-dot"><Svg size={11} strokeWidth={3}><path d="M20 6 9 17l-5-5" /></Svg></span>
      <span className="ajd-signup-pill">Signed up · {fmt(reg)}</span>
    </div>
  );
}

function VisitItem({ v, reg, open, onToggle }) {
  const conf = CONFIDENCE[v.confidence] || CONFIDENCE.medium;
  const color = sourceColor(v.source);
  const rows = [
    ['Campaign', v.campaign || v.utm_campaign],
    ['Ad set', v.adset || v.utm_term],
    ['Ad', v.ad || v.utm_content],
    ['Campaign ID', v.campaign_id],
    ['utm_source / medium', [v.utm_source, v.utm_medium].filter(Boolean).join(' / ')],
    ['Click ID', [v.has_fbclid && 'fbclid', v.has_gclid && 'gclid'].filter(Boolean).join(', ')],
    ['IP address', v.ip_address],
    ['Network', v.network],
    ['Other students on network', v.match_type === 'ip' ? (v.shared_with_users ?? 'unknown') : null],
    ['Landing URL', v.landing_url],
    ['Referrer', v.referrer],
  ].filter(([, val]) => val !== null && val !== undefined && val !== '');

  return (
    <div className="ajd-item">
      <span className="ajd-dot" style={{ background: color }} />
      <div className={`ajd-visit${v.before_register === false ? ' after' : ''}`} onClick={onToggle}>
        <div className="ajd-row">
          <span className="ajd-label">{v.ad_label}</span>
          <span className="ajd-chip" style={{ background: `${color}14`, color, textTransform: 'capitalize' }}>{v.source || 'unknown'}</span>
          <div style={{ flex: 1 }} />
          <span className="ajd-chip" style={{ background: v.match_type === 'device' ? '#ede9fe' : '#f1f5f9', color: v.match_type === 'device' ? '#5b21b6' : '#475569' }}>
            {v.match_type === 'device' ? 'Same browser' : `Same network · IPv${v.ip_version}`}
          </span>
          <span className="ajd-chip" style={{ background: conf.bg, color: conf.fg }}>{conf.label}</span>
        </div>
        <div className="ajd-meta">
          <span>{fmt(v.visited_at)}</span>
          {reg && <span>{relToSignup(v.visited_at, reg)}</span>}
          {v.device && <span style={{ textTransform: 'capitalize' }}>{v.device}</span>}
          <span style={{ marginLeft: 'auto', color: '#4f46e5', fontWeight: 600 }}>{open ? 'Hide details' : 'Details'}</span>
        </div>
        {open && (
          <dl className="ajd-kv" onClick={(e) => e.stopPropagation()}>
            {rows.map(([k, val]) => (
              <div key={k} style={{ display: 'contents' }}>
                <dt>{k}</dt>
                <dd>{String(val)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
