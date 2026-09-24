import { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

/*
  All Students → ad-visit filter. The panel edits a draft; Apply hands it to AllStudents, which then
  swaps the student table for <AdFilterResults>. Filtering runs server-side (action=filter in
  api/students/ad_visits.php), so the list is paginated and cached for a minute.
*/

import {
  COUNT_PRESETS, COMMON_SOURCES, DATE_PRESETS, DEFAULT_FILTER, MATCH, SORT, TIMING,
  dateLabel, filterChips, fmtDate, fmtDateTime, sourceColor,
} from './adVisitFilterConfig';


const FilterIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
  </svg>
);


/** The funnel button that opens the panel. */
export function AdFilterButton({ open, active, onClick }) {
  return (
    <button className={`af-btn${open || active ? ' on' : ''}`} onClick={onClick} title="Filter by ad visits">
      <FilterIcon />
      {active > 0 && <span className="af-badge">{active}</span>}
    </button>
  );
}

/** The expanding panel. Edits a local draft; nothing changes until Apply. */
export function AdFilterPanel({ open, value, sources, onApply, onReset, onClose }) {
  const [d, setD] = useState(value);
  const [more, setMore] = useState(false);
  /* Each time the panel opens, start the draft from what is applied (reset during render, not in
     an effect, so the panel never shows a stale draft for a frame). */
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setD(value);
  }
  const set = (patch) => setD((x) => ({ ...x, ...patch }));

  const pickPreset = (p) => {
    if (p.key === 'custom') { set({ preset: 'custom' }); return; }
    const [from, to] = p.range();
    set({ preset: p.key, from, to });
  };

  const apply = () => {
    if (!d.from || !d.to) { toast.error('Pick both dates'); return; }
    const days = (new Date(d.to) - new Date(d.from)) / 864e5;
    if (days < 0) { toast.error('"From" must be before "To"'); return; }
    if (days > 31) { toast.error('Pick a range of 31 days or less'); return; }
    onApply({ ...d, min: Math.max(1, parseInt(d.min, 10) || 1) });
  };

  const sourceOptions = Array.from(new Set([...Object.keys(sources || {}), ...COMMON_SOURCES]));
  const customMin = !COUNT_PRESETS.some((c) => c.min === Number(d.min));

  return (
    <div className={`af-collapse${open ? ' open' : ''}`}>
      <div>
        <div className="af-panel" onKeyDown={(e) => e.key === 'Enter' && apply()}>
          <div className="af-grid">
            <div>
              <div className="af-label">Registered</div>
              <div className="af-chips">
                {DATE_PRESETS.map((p) => (
                  <button key={p.key} className={`af-chip${d.preset === p.key ? ' on' : ''}`} onClick={() => pickPreset(p)}>{p.label}</button>
                ))}
              </div>
              {d.preset === 'custom' && (
                <div className="af-chips" style={{ marginTop: 8, animation: 'af-in .25s ease both' }}>
                  <input type="date" className="af-input" value={d.from} max={d.to || undefined} onChange={(e) => set({ from: e.target.value })} />
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>→</span>
                  <input type="date" className="af-input" value={d.to} min={d.from || undefined} onChange={(e) => set({ to: e.target.value })} />
                </div>
              )}
            </div>

            <div>
              <div className="af-label">Ad visits</div>
              <div className="af-chips">
                {COUNT_PRESETS.map((c) => (
                  <button key={c.min} className={`af-chip${Number(d.min) === c.min ? ' on' : ''}`} onClick={() => set({ min: c.min })}>{c.label}</button>
                ))}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', marginLeft: 4 }}>
                  at least
                  <input type="number" min={1} max={100} className="af-input" style={{ width: 64, borderColor: customMin ? '#818cf8' : undefined }}
                    value={d.min} onChange={(e) => set({ min: e.target.value })} />
                </span>
              </div>
            </div>
          </div>

          <button className={`af-more${more ? ' open' : ''}`} onClick={() => setMore((m) => !m)}>
            Advanced filters
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          <div className={`af-collapse${more ? ' open' : ''}`}>
            <div>
              <div className="af-grid" style={{ paddingTop: 12 }}>
                <div>
                  <div className="af-label">Source</div>
                  <select className="af-input" style={{ width: '100%', textTransform: 'capitalize' }} value={d.source} onChange={(e) => set({ source: e.target.value })}>
                    <option value="">Any source</option>
                    {sourceOptions.map((s) => (
                      <option key={s} value={s}>{s}{sources?.[s] ? ` (${sources[s]})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="af-label">Matched by</div>
                  <div className="af-chips">
                    {Object.entries(MATCH).map(([k, l]) => (
                      <button key={k} className={`af-chip${d.match === k ? ' on' : ''}`} onClick={() => set({ match: k })}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="af-label">Ad visit timing</div>
                  <div className="af-chips">
                    {Object.entries(TIMING).map(([k, l]) => (
                      <button key={k} className={`af-chip${d.timing === k ? ' on' : ''}`} onClick={() => set({ timing: k })}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="af-label">Sort by</div>
                  <div className="af-chips">
                    {Object.entries(SORT).map(([k, l]) => (
                      <button key={k} className={`af-chip${d.sort === k ? ' on' : ''}`} onClick={() => set({ sort: k })}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="af-foot">
            <button className="af-apply" onClick={apply}>Apply filter</button>
            <button className="af-ghost" onClick={() => { setD(DEFAULT_FILTER); onReset(); }}>Reset</button>
            <div style={{ flex: 1 }} />
            <button className="af-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Row of applied-filter chips with the result count and a reset. */
export function AdFilterApplied({ value, total, loading, onChange, onReset }) {
  return (
    <div className="af-applied">
      {filterChips(value).map((c) => (
        <span key={c.key} className="af-pill">
          {c.label}
          {c.reset && <button onClick={() => onChange({ ...value, ...c.reset })} title="Remove">×</button>}
        </span>
      ))}
      <span className="af-count">{loading ? 'Loading…' : `${(total || 0).toLocaleString()} student${total === 1 ? '' : 's'}`}</span>
      <button className="af-reset" onClick={onReset}>Reset filter</button>
    </div>
  );
}

const PER_PAGE = 25;

/** The filtered list that replaces the student table. */
export function AdFilterResults({ filter, onOpen, onLoaded }) {
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const fkey = JSON.stringify(filter);

  useEffect(() => { setPage(1); }, [fkey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    const { preset: _preset, ...params } = filter;
    api.get('/api/students/ad_visits.php', { params: { action: 'filter', ...params, page, per_page: PER_PAGE } })
      .then((r) => {
        if (cancelled) return;
        if (r.data.success) { setRes(r.data.data); onLoaded?.(r.data.data); }
        else setError(r.data.message || 'Could not load');
      })
      .catch((e) => { if (!cancelled) setError(e.response?.data?.message || 'Could not load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fkey, page]);

  const s = res?.summary;
  const pages = Math.max(1, Math.ceil((res?.total || 0) / PER_PAGE));
  const srcTotal = s ? Object.values(s.sources || {}).reduce((a, b) => a + b, 0) : 0;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  if (error) return <div className="afr"><div className="afr-empty" style={{ color: '#dc2626' }}>{error}</div></div>;

  return (
    <div className="afr">
      <div className="afr-stats">
        {!s ? [0, 1, 2, 3].map((i) => <div key={i} className="afr-skel" style={{ height: 78 }} />) : (
          <>
            <div className="afr-stat">
              <div className="afr-stat-l">Students</div>
              <div className="afr-stat-v" style={{ color: '#4f46e5' }}>{s.students.toLocaleString()}</div>
              <div className="afr-stat-s">registered {dateLabel(filter).toLowerCase()}</div>
            </div>
            <div className="afr-stat">
              <div className="afr-stat-l">Ad visits</div>
              <div className="afr-stat-v">{s.visits.toLocaleString()}</div>
              <div className="afr-stat-s">{s.students ? (s.visits / s.students).toFixed(1) : 0} per student</div>
            </div>
            <div className="afr-stat">
              <div className="afr-stat-l">Before signup</div>
              <div className="afr-stat-v">{pct(s.before_register, s.visits)}%</div>
              <div className="afr-stat-s">{pct(s.device, s.visits)}% matched by same browser</div>
            </div>
            <div className="afr-stat">
              <div className="afr-stat-l">Sources</div>
              <div className="afr-bar">
                {Object.entries(s.sources || {}).map(([k, n]) => (
                  <span key={k} title={`${k}: ${n}`} style={{ width: `${pct(n, srcTotal)}%`, background: sourceColor(k) }} />
                ))}
              </div>
              <div className="afr-stat-s" style={{ marginTop: 6, textTransform: 'capitalize' }}>
                {Object.entries(s.sources || {}).slice(0, 3).map(([k, n]) => `${k} ${pct(n, srcTotal)}%`).join(' · ') || '—'}
              </div>
            </div>
          </>
        )}
      </div>

      {loading && !res ? (
        <div className="afr-list">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="afr-skel" style={{ height: 64, flexShrink: 0 }} />)}</div>
      ) : !res?.students?.length ? (
        <div className="afr-empty">
          <FilterIcon size={28} />
          No students match this filter.
        </div>
      ) : (
        <div className="afr-list" style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .2s' }}>
          {res.students.map((st, i) => (
            <div key={st.user_id} className="afr-row" style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div className="afr-av">{(st.name || '?').trim().slice(0, 1).toUpperCase()}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="afr-name">{st.name || '—'} <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>#{st.user_id}</span></div>
                  <div className="afr-sub">{st.email}</div>
                  <div className="afr-sub">{st.phone || '—'} · Joined {fmtDate(st.registered_at)}</div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span className="afr-big">{st.visits}</span>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>visits · {st.distinct_ads} ads</span>
                </div>
                <div className="afr-mini" title={`${st.device} same browser · ${st.ip} same network`}>
                  <span style={{ width: `${pct(st.device, st.visits)}%`, background: '#7c3aed' }} />
                  <span style={{ width: `${pct(st.ip, st.visits)}%`, background: '#cbd5e1' }} />
                </div>
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>{st.before_register} before signup</div>
              </div>

              <div className="afr-touch">
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b>First</b>{st.first_touch || '—'}</div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b>Last before signup</b>{st.last_touch || '—'}</div>
                <div style={{ color: '#94a3b8', fontSize: 10.5, marginTop: 2 }}>
                  {fmtDateTime(st.first_visit_at)} → {fmtDateTime(st.last_visit_at)}
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {Object.entries(st.sources || {}).map(([k, n]) => (
                  <span key={k} className="afr-src" style={{ background: `${sourceColor(k)}14`, color: sourceColor(k) }}>{k} · {n}</span>
                ))}
                {(st.devices || []).map((dv) => (
                  <span key={dv} className="afr-src" style={{ background: '#f1f5f9', color: '#475569' }}>{dv}</span>
                ))}
              </div>

              <div style={{ textAlign: 'right' }}>
                <button className="afr-view" onClick={() => onOpen(st)}>View journey</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {res && res.total > PER_PAGE && (
        <div className="afr-foot">
          <span>Page <b>{page}</b> of <b>{pages}</b> · {res.total.toLocaleString()} students</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="pg-btn" disabled={page <= 1} onClick={() => setPage(1)}>«</button>
            <button className="pg-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
            <button className="pg-btn active">{page}</button>
            <button className="pg-btn" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>›</button>
            <button className="pg-btn" disabled={page >= pages} onClick={() => setPage(pages)}>»</button>
          </div>
        </div>
      )}
    </div>
  );
}
