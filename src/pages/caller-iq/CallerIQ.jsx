import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CSS, nf, pctText, PRESETS, resolveRange, rangeParams, rangeKey, rangeLabel, DAY_START, DAY_END, todayYmd,
  CountUp, ripple, Skel, Popover,
} from '../netcore/analytics/maShared';
import {
  errText, CIQ_CSS, Ic, MAIN_TYPES, TYPE, OUTCOMES, outcomeColor, typeIcon, fmtDur, fmtAgo, Avatar, StatusDot, Delta, toDate,
  ciqPeek, ciqCached, ciqInvalidate,
} from './ciqShared';
import { EMPTY_FILTERS, normalize, activeCount, filterChips, loadViews, storeViews, PRESET_VIEWS } from './ciqFilters';
import LiveCallsBar from './LiveCalls';
import OverviewTab from './OverviewTab';
import CallLogTab from './CallLogTab';
import NumbersTab from './NumbersTab';
import AgentsTab from './AgentsTab';
import SimsTab from './SimsTab';
import FilterDrawer from './FilterDrawer';
import NumberDrawer from './NumberDrawer';
import AgentDrawer from './AgentDrawer';
import { AgentModal, SetupModal, SimModal } from './ciqModals';

/*
 * Caller IQ — calls made and received on counselors' Android phones (caller-IQ-project/), synced to
 * react-api/api/caller-iq/log_call.php and analysed by caller_iq.php.
 *
 * Layout: title bar with the four tabs → sticky filter bar + nine stat tiles (shared by every tab)
 * → the tab. The overview request feeds the tiles, the filter option lists and the Overview tab;
 * the other tabs fetch their own rows with the very same range and filters.
 *
 * Date range and tab live in the URL (shareable, survive refresh). Filters live in session storage
 * so they survive a refresh without leaking into a link someone else opens.
 */

const TABS = [['overview', 'Overview'], ['calls', 'Call log'], ['numbers', 'Numbers'], ['agents', 'Agents'], ['sims', 'SIMs']];
const FILTER_KEY = 'ciq.filters.v1';

const readFilters = () => { try { return normalize(JSON.parse(sessionStorage.getItem(FILTER_KEY) || 'null')); } catch { return { ...EMPTY_FILTERS }; } };

export default function CallerIQ() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'overview';
  const preset = PRESETS.some(p => p.key === params.get('range')) ? params.get('range') : 'today';
  const pFrom = params.get('from'); const pTo = params.get('to'); const pFt = params.get('ft'); const pTt = params.get('tt');
  const range = useMemo(() => resolveRange(preset, pFrom, pTo, pFt, pTt), [preset, pFrom, pTo, pFt, pTt]);
  const rangeBody = useMemo(() => rangeParams(range), [range]);

  const [filters, setFiltersState] = useState(readFilters);
  const fKey = `${rangeKey(range)}|${range.all ? 'all' : ''}|${JSON.stringify(filters)}`;

  const [data, setData] = useState(() => ciqPeek('overview', { range: rangeBody, filters }) || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [menu, setMenu] = useState(null);
  const [draft, setDraft] = useState(null);
  const [search, setSearch] = useState(filters.q);
  const [views, setViews] = useState(loadViews);
  const [filterOpen, setFilterOpen] = useState(false);
  const [numberTarget, setNumberTarget] = useState(null);
  const [agentOpen, setAgentOpen] = useState(null);
  const [agentEdit, setAgentEdit] = useState(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [simEdit, setSimEdit] = useState(null);
  const reqId = useRef(0);

  const setParam = useCallback(patch => setParams(p => {
    const n = new URLSearchParams(p);
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === '') n.delete(k); else n.set(k, v); }
    return n;
  }, { replace: true }), [setParams]);

  const setFilters = useCallback(next => {
    setFiltersState(prev => {
      const f = normalize(typeof next === 'function' ? next(prev) : next);
      try { sessionStorage.setItem(FILTER_KEY, JSON.stringify(f)); } catch { /* storage blocked */ }
      return f;
    });
  }, []);
  /** Merge a filter patch; optionally jump to a tab (charts and tiles drill into the call log). */
  const applyFilter = useCallback((patch, toTab) => {
    setFilters(f => ({ ...f, ...patch }));
    if (patch.q !== undefined) setSearch(patch.q);
    if (toTab && toTab !== tab) setParam({ tab: toTab === 'overview' ? null : toTab });
  }, [setFilters, setParam, tab]);


  /* Search box → filter, debounced so typing a number costs one request. */
  useEffect(() => {
    if (search === filters.q) return undefined;
    const t = setTimeout(() => setFilters(f => ({ ...f, q: search.trim() })), 380);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async ({ force = false, quiet = false } = {}) => {
    const hit = ciqPeek('overview', { range: rangeBody, filters });
    if (hit && !force) setData(hit); else if (!hit) setData(null);
    const my = ++reqId.current;
    if (!quiet) setBusy(true);
    setError(null);
    try {
      const d = await ciqCached('overview', { range: rangeBody, filters }, { force });
      if (my !== reqId.current) return;
      setData(d);
      if (force) toast.success(`Refreshed in ${d.took_ms} ms`, { id: 'ciq-refresh' });
    } catch (e) {
      if (my === reqId.current) setError(errText(e));
    } finally { if (my === reqId.current) setBusy(false); }
  }, [fKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  /* The only way fresh data is fetched: clear every tab's cache, then reload this one and
     tell the open tab to reload itself. Nothing else in the page reaches the server. */
  const refresh = useCallback(() => { ciqInvalidate(); load({ force: true }); setReloadTick(t => t + 1); }, [load]);

  /* No background refresh. Phones sync after every call, but fetching on a timer spends a
     request a minute on data nobody is looking at — the refresh button asks when you want it. */

  const devices = useMemo(() => data?.devices || [], [data]);
  const deviceById = useMemo(() => Object.fromEntries(devices.map(d => [d.device_id, d])), [devices]);
  const deviceLabel = useCallback(id => (id === '__none__' ? 'Unidentified phone' : deviceById[id]?.label || id), [deviceById]);
  const chips = filterChips(filters, { deviceLabel });
  const nActive = activeCount(filters);

  /* ── Menus ─────────────────────────────────────────────────────────── */
  const openMenu = (id, e) => { const el = e.currentTarget; setMenu(m => (m?.id === id ? null : { id, el })); };
  const closeMenu = useCallback(() => setMenu(null), []);
  const pickPreset = (k, e) => {
    if (k === 'custom') { setDraft({ from: range.from, to: range.to, ft: range.fromTime, tt: range.toTime }); openMenu('custom', e); return; }
    setMenu(null);
    setParam({ range: k === 'today' ? null : k, from: null, to: null, ft: null, tt: null });
  };
  const applyCustom = () => {
    if (!draft?.from || !draft?.to) { toast.error('Pick both dates'); return; }
    const ft = draft.ft || DAY_START; const tt = draft.tt || DAY_END;
    setParam({ range: 'custom', from: draft.from, to: draft.to, ft: ft === DAY_START ? null : ft, tt: tt === DAY_END ? null : tt });
    setMenu(null);
  };
  const toggleIn = (key, v) => setFilters(f => ({ ...f, [key]: f[key].includes(v) ? f[key].filter(x => x !== v) : [...f[key], v] }));

  const saveView = (name, f) => {
    const next = [{ name, filters: normalize(f) }, ...views.filter(v => v.name !== name)];
    setViews(next); storeViews(next);
    toast.success(`Saved view “${name}”`);
  };
  const deleteView = name => { const next = views.filter(v => v.name !== name); setViews(next); storeViews(next); };

  /* ── Tiles ─────────────────────────────────────────────────────────── */
  const T = data?.totals || {}; const P = data?.prev || {};
  const loadingFirst = !data && busy;
  const missedAll = (T.missed || 0) + (T.rejected || 0);
  const tiles = [
    { key: 'total', label: 'Total calls', c: '#1e3a8a', value: T.total, sub: <Delta cur={T.total} prev={P.total} />, go: () => applyFilter({ types: [], connected: '' }, 'calls') },
    { key: 'out', label: 'Outgoing', c: TYPE.OUTGOING.color, value: T.outgoing, sub: <><b>{pctText(T.out_connected, T.outgoing)}</b> connected</>, go: () => applyFilter({ types: ['OUTGOING'] }, 'calls') },
    { key: 'in', label: 'Incoming', c: TYPE.INCOMING.color, value: T.incoming, sub: <Delta cur={T.incoming} prev={P.incoming} />, go: () => applyFilter({ types: ['INCOMING'] }, 'calls') },
    { key: 'missed', label: 'Missed', c: TYPE.MISSED.color, value: missedAll, sub: <Delta cur={missedAll} prev={(P.missed || 0) + (P.rejected || 0)} invert />, go: () => applyFilter({ types: ['MISSED', 'REJECTED'] }, 'calls') },
    { key: 'rate', label: 'Connect rate', c: '#059669', value: T.total ? Math.round((T.connected / T.total) * 100) : 0, fmt: v => `${v}%`, sub: <>{nf(T.connected)} connected</>, go: () => applyFilter({ connected: 'yes' }, 'calls') },
    { key: 'talk', label: 'Talk time', c: '#4f46e5', value: T.talk_sec, fmt: fmtDur, sub: <Delta cur={T.talk_sec} prev={P.talk_sec} />, go: () => applyFilter({ connected: 'yes' }, 'calls') },
    { key: 'avg', label: 'Avg call', c: '#0891b2', value: T.connected ? Math.round(T.talk_sec / T.connected) : 0, fmt: fmtDur, sub: <>longest {fmtDur(T.longest_sec)}</>, go: () => applyFilter({ connected: 'yes', min_dur: 180 }, 'calls') },
    { key: 'people', label: 'Unique numbers', c: '#7c3aed', value: T.unique_numbers, sub: <Delta cur={T.unique_numbers} prev={P.unique_numbers} />, go: () => setParam({ tab: 'numbers' }) },
    { key: 'pending', label: 'Callbacks due', c: '#dc2626', value: T.pending_numbers, sub: T.returned_calls ? <>returned in <b>{fmtDur(T.avg_return_sec)}</b></> : <>missed, not returned</>, go: () => applyFilter({ callback: 'pending' }, 'calls') },
  ];

  const typeText = !filters.types.length ? 'All' : filters.types.length === 1 ? TYPE[filters.types[0]]?.label : `${filters.types.length} types`;
  const agentText = !filters.devices.length ? 'All' : filters.devices.length === 1 ? deviceLabel(filters.devices[0]) : `${filters.devices.length} agents`;
  const outcomeText = !filters.outcomes.length ? 'All' : filters.outcomes.length === 1 ? (filters.outcomes[0] === '__none__' ? 'Untagged' : filters.outcomes[0]) : `${filters.outcomes.length} outcomes`;
  const outcomeOptions = data?.outcome_options || [];
  const allOutcomes = [...OUTCOMES.map(o => o.key), ...outcomeOptions.filter(o => !OUTCOMES.some(x => x.key === o)), '__none__'];

  const lastSync = data?.meta?.last_sync_at;
  const stale = !lastSync || (Date.now() - toDate(lastSync).getTime()) > 6 * 3600 * 1000;
  const tabProps = { rangeBody, filters, fKey, deviceById, reloadTick, onOpenNumber: setNumberTarget };

  return (
    <div className="ma ciq">
      <style>{CSS}</style>
      <style>{CIQ_CSS}</style>

      {/* ── Title + tabs ───────────────────────────────────────────── */}
      <div className="ciq-top">
        <div className="ciq-brand">
          <span className="ciq-logo">{Ic.phone(17)}</span>
          <div style={{ minWidth: 0 }}>
            <h1>Caller IQ</h1>
            <p>{rangeLabel(range)} · counselor phone calls{data ? ` · updated ${data.generated_at.slice(11, 16)} · ${data.took_ms} ms` : ''}</p>
          </div>
        </div>
        <nav className="ciq-tabs" role="tablist" aria-label="Caller IQ views">
          {TABS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className="ma-rip" onPointerDown={ripple} data-on={tab === k ? '1' : undefined}
                    onClick={() => setParam({ tab: k === 'overview' ? null : k })}>
              {l}
              {k === 'agents' && devices.length > 0 && <span className="n">{devices.filter(d => !Number(d.is_hidden)).length}</span>}
              {k === 'calls' && T.total > 0 && <span className="n">{nf(T.total)}</span>}
            </button>
          ))}
        </nav>
        <div className="ciq-top-r">
          <span className="ciq-sync" data-stale={stale ? '1' : undefined} title={lastSync ? `Last call received from a phone: ${lastSync}` : 'No phone has synced yet'}>
            <i />{lastSync ? `Last sync ${fmtAgo(lastSync)}` : 'Waiting for first sync'}
          </span>
          <button className="ma-btn sm ma-rip" onPointerDown={ripple} onClick={() => setSetupOpen(true)}>{Ic.phone(13)} Connect phone</button>
        </div>
      </div>

      {/* Calls in progress right now — pushed by the phones, not read from the call log, which
          does not exist until a call ends. Shown on every tab: it is what someone watching the
          floor wants in front of them whatever else they are looking at. */}
      <LiveCallsBar onOpenNumber={setNumberTarget} />

      {/*
        Only the filter row is pinned. The stat tiles used to be pinned too and shrank as you
        scrolled — tiles resizing, sub-lines vanishing, the grid turning into a row — which read as
        the numbers jumping about. They now scroll like ordinary content: nothing moves that the
        reader did not move.
      */}
      <div className="ma-sticky">
        <div className="ma-progress" data-on={busy ? '1' : undefined} />
        <div className="ma-filters" data-pop={menu ? '1' : undefined}>
          <div className="ma-seg" role="tablist" aria-label="Date range">
            {PRESETS.map(p => (
              <button key={p.key} role="tab" onPointerDown={ripple} data-on={preset === p.key ? '1' : undefined} onClick={e => pickPreset(p.key, e)}>
                {p.key === 'custom' && <span className="ic">{Ic.cal}</span>}{p.key === 'custom' && preset === 'custom' ? rangeLabel(range) : p.label}
              </button>
            ))}
          </div>

          <button className="ma-dd ma-rip" onPointerDown={ripple} onClick={e => openMenu('type', e)} data-active={filters.types.length ? '1' : undefined} data-open={menu?.id === 'type' ? '1' : undefined}>
            Type <b>{filters.types.length === 1 && <span style={{ color: TYPE[filters.types[0]]?.fg, display: 'inline-flex' }}>{typeIcon(filters.types[0], 12)}</span>}{typeText}</b>{Ic.caret}
          </button>
          <button className="ma-dd ma-rip" onPointerDown={ripple} onClick={e => openMenu('agent', e)} data-active={filters.devices.length ? '1' : undefined} data-open={menu?.id === 'agent' ? '1' : undefined}>
            Agent <b>{agentText}</b>{Ic.caret}
          </button>
          <button className="ma-dd ma-rip" onPointerDown={ripple} onClick={e => openMenu('outcome', e)} data-active={filters.outcomes.length ? '1' : undefined} data-open={menu?.id === 'outcome' ? '1' : undefined}>
            Outcome <b>{filters.outcomes.length === 1 && <i style={{ width: 8, height: 8, borderRadius: '50%', background: outcomeColor(filters.outcomes[0] === '__none__' ? '' : filters.outcomes[0]) }} />}{outcomeText}</b>{Ic.caret}
          </button>
          <button className="ma-dd ma-rip" onPointerDown={ripple} onClick={() => setFilterOpen(true)} data-active={nActive ? '1' : undefined}>
            {Ic.filter} <b>More filters</b>{nActive > 0 && <span className="ciq-badge">{nActive}</span>}
          </button>
          <button className="ma-dd ma-rip" onPointerDown={ripple} onClick={e => openMenu('views', e)} data-open={menu?.id === 'views' ? '1' : undefined}>
            {Ic.bookmark} <b>Views</b>{Ic.caret}
          </button>

          <div className="ciq-searchbox">
            {Ic.search}
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search number, agent, note…" aria-label="Search calls" />
            {search && <button className="clr" onClick={() => { setSearch(''); setFilters(f => ({ ...f, q: '' })); }} aria-label="Clear search">{Ic.x}</button>}
          </div>

          {/* Reset sits next to More filters and is impossible to miss while a filter is on: a
              page showing less than someone expects should always say so, and offer the way out. */}
          {nActive > 0 && (
            <button className="ciq-reset ma-rip" onPointerDown={ripple}
                    onClick={() => { setFilters({ ...EMPTY_FILTERS }); setSearch(''); }}
                    title="Remove every filter and show all calls again">
              {Ic.x} Reset all <span className="n">{nActive}</span>
            </button>
          )}
          <button className="ma-iconbtn ma-rip" style={{ marginLeft: 'auto', width: 30, height: 30 }} onPointerDown={ripple}
                  onClick={refresh} disabled={busy} title="Refresh" aria-label="Refresh">{Ic.refresh(busy ? 'spin' : '')}</button>
        </div>

        {chips.length > 0 && (
          <div className="ciq-chips" data-on="1">
            <span className="ciq-chips-lead">
              {Ic.filter}
              <b>{nActive}</b> filter{nActive === 1 ? '' : 's'} on — showing a narrowed list
            </span>
            {chips.map(c => (
              <span key={c.key} className="ciq-fchip">
                <em>{c.label}:</em>{c.value}
                <button onClick={() => { setFilters(f => ({ ...f, ...c.clear })); if (c.key === 'q') setSearch(''); }} aria-label={`Remove ${c.label} filter`}>{Ic.x}</button>
              </span>
            ))}
            <button className="ciq-chips-clear" onClick={() => { setFilters({ ...EMPTY_FILTERS }); setSearch(''); }}>Clear all</button>
          </div>
        )}
      </div>

      <div className="ma-stats">
        {tiles.map(k => (
          <button key={k.key} className="ma-stat ma-rip" onPointerDown={ripple} style={{ '--c': k.c }} onClick={k.go} title={`Open ${k.label.toLowerCase()}`}>
            <span className="k">{k.label}</span>
            <span className="row">
              <span className="v">{loadingFirst ? <Skel w={48} h={18} /> : <CountUp value={k.value || 0} format={k.fmt || nf} />}</span>
            </span>
            {!loadingFirst && <span className="cs"><span className="s" style={{ fontSize: 10.5 }}>{k.sub}</span></span>}
            <span className="go">{Ic.arrow}</span>
          </button>
        ))}
      </div>

      {/* ── Menus (portalled) ─────────────────────────────────────── */}
      {menu?.id === 'type' && (
        <Popover anchor={menu.el} onClose={closeMenu} width={230}>
          {[...MAIN_TYPES, TYPE.BLOCKED, TYPE.UNKNOWN].map(t => (
            <button key={t.key} className="ma-opt" data-on={filters.types.includes(t.key) ? '1' : undefined} onClick={() => toggleIn('types', t.key)}>
              <span className="box">{filters.types.includes(t.key) && Ic.tick}</span>
              <span style={{ color: t.fg, display: 'inline-flex' }}>{typeIcon(t.key, 13)}</span>{t.label}
              <span className="cnt">{data && MAIN_TYPES.some(m => m.key === t.key) ? nf(T[t.key.toLowerCase()]) : ''}</span>
            </button>
          ))}
          <div className="foot"><button onClick={() => setFilters(f => ({ ...f, types: [] }))}>All types</button><button onClick={closeMenu}>Done</button></div>
        </Popover>
      )}
      {menu?.id === 'agent' && (
        <Popover anchor={menu.el} onClose={closeMenu} width={300}>
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {!devices.length && <div style={{ padding: 12, fontSize: 12.5, color: '#94a3b8' }}>No phones have synced yet.</div>}
            {devices.map(d => {
              const id = d.device_id === '' ? '__none__' : d.device_id;
              const on = filters.devices.includes(id);
              return (
                <button key={id} className="ma-opt" data-on={on ? '1' : undefined} onClick={() => toggleIn('devices', id)}>
                  <span className="box">{on && Ic.tick}</span>
                  <Avatar name={d.label} size={22} />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
                    <span style={{ display: 'block', fontSize: 10.5, color: '#94a3b8', fontWeight: 500 }}>{d.team || d.device_model || 'Android phone'}</span>
                  </span>
                  <StatusDot status={d.status} />
                </button>
              );
            })}
          </div>
          <div className="foot"><button onClick={() => setFilters(f => ({ ...f, devices: [] }))}>All agents</button><button onClick={closeMenu}>Done</button></div>
        </Popover>
      )}
      {menu?.id === 'outcome' && (
        <Popover anchor={menu.el} onClose={closeMenu} width={250}>
          {allOutcomes.map(o => {
            const on = filters.outcomes.includes(o);
            const n = (data?.outcomes || []).find(x => (x.o || '__none__') === o)?.n;
            return (
              <button key={o} className="ma-opt" data-on={on ? '1' : undefined} onClick={() => toggleIn('outcomes', o)}>
                <span className="box">{on && Ic.tick}</span>
                <span className="dot" style={{ background: outcomeColor(o === '__none__' ? '' : o), borderRadius: '50%' }} />
                {o === '__none__' ? 'Untagged' : o}
                <span className="cnt">{n ? nf(n) : ''}</span>
              </button>
            );
          })}
          <div className="foot"><button onClick={() => setFilters(f => ({ ...f, outcomes: [] }))}>All outcomes</button><button onClick={closeMenu}>Done</button></div>
        </Popover>
      )}
      {menu?.id === 'views' && (
        <Popover anchor={menu.el} onClose={closeMenu} width={290}>
          {views.length > 0 && <div className="grp">Your saved views</div>}
          {views.map(v => (
            <div key={v.name} style={{ display: 'flex', alignItems: 'center' }}>
              <button className="ma-opt" style={{ flex: 1 }} onClick={() => { setFilters(v.filters); setSearch(v.filters.q || ''); closeMenu(); toast.success(`View “${v.name}” applied`); }}>
                {Ic.bookmark}{v.name}<span className="cnt">{activeCount(normalize(v.filters))}</span>
              </button>
              <button className="ma-x" style={{ width: 28, height: 28 }} title="Delete view" onClick={() => deleteView(v.name)}>{Ic.x}</button>
            </div>
          ))}
          <div className="grp">Quick views</div>
          {PRESET_VIEWS.map(v => (
            <button key={v.name} className="ma-opt" onClick={() => { setFilters({ ...EMPTY_FILTERS, ...v.filters }); setSearch(''); closeMenu(); if (tab === 'overview' || tab === 'agents') setParam({ tab: 'calls' }); }}>
              {Ic.filter}{v.name}
            </button>
          ))}
          <div className="foot"><span style={{ fontSize: 11, color: '#94a3b8', padding: '4px 6px' }}>Save the current filters from More filters</span></div>
        </Popover>
      )}
      {menu?.id === 'custom' && draft && (
        <Popover anchor={menu.el} onClose={closeMenu} width={330} className="form">
          <h4>Custom date &amp; time</h4>
          <div className="times">
            <label>From date<input type="date" value={draft.from} max={todayYmd()} onChange={e => setDraft(d => ({ ...d, from: e.target.value }))} /></label>
            <label>From time<input type="time" step="1" value={draft.ft} onChange={e => setDraft(d => ({ ...d, ft: e.target.value || DAY_START }))} /></label>
            <label>To date<input type="date" value={draft.to} max={todayYmd()} min={draft.from} onChange={e => setDraft(d => ({ ...d, to: e.target.value }))} /></label>
            <label>To time<input type="time" step="1" value={draft.tt} onChange={e => setDraft(d => ({ ...d, tt: e.target.value || DAY_END }))} /></label>
          </div>
          <div className="hint">Whole days by default. Narrow the times for a single shift.</div>
          <div className="row">
            <button className="ma-btn ma-rip" style={{ marginRight: 'auto' }} onPointerDown={ripple} onClick={() => setDraft(d => ({ ...d, ft: DAY_START, tt: DAY_END }))}>Whole day</button>
            <button className="ma-btn ma-rip" onPointerDown={ripple} onClick={closeMenu}>Cancel</button>
            <button className="ma-btn primary ma-rip" onPointerDown={ripple} onClick={applyCustom}>Apply</button>
          </div>
        </Popover>
      )}

      {error && (
        <div className="ma-card" style={{ padding: 12, marginBottom: 12, borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c', display: 'flex', gap: 10, alignItems: 'center' }}>
          {Ic.alert}<span style={{ flex: 1 }}>{error}</span>
          <button className="ma-btn sm ma-rip" onPointerDown={ripple} onClick={refresh}>Try again</button>
        </div>
      )}

      {/* The API answers even when the database has not caught up with the code; say which detail
          is missing rather than letting a column quietly read as zero. */}
      {data?.schema_missing?.length > 0 && (
        <div className="ma-note" style={{ marginBottom: 12 }}>
          {Ic.alert}
          <span>
            The database is missing <b>{data.schema_missing.join(', ')}</b>, so {data.schema_missing.length === 1 ? 'that detail is' : 'those details are'} blank
            for now. Deploy the latest <b>react-api/api/caller-iq/ciq_lib.php</b> and reload — the column{data.schema_missing.length === 1 ? ' is' : 's are'} added automatically.
          </span>
        </div>
      )}

      {/* A SIM that lapses stops a counselor working, so it is said on every tab. */}
      {(Number(data?.sim_alerts?.expired) > 0 || Number(data?.sim_alerts?.soon) > 0) && tab !== 'sims' && (
        <div className="ma-note" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          {Ic.alert}
          <span style={{ flex: 1 }}>
            {Number(data.sim_alerts.expired) > 0 && <><b>{nf(data.sim_alerts.expired)} SIM{Number(data.sim_alerts.expired) === 1 ? ' has' : 's have'} expired</b></>}
            {Number(data.sim_alerts.expired) > 0 && Number(data.sim_alerts.soon) > 0 && ' and '}
            {Number(data.sim_alerts.soon) > 0 && <><b>{nf(data.sim_alerts.soon)} run{Number(data.sim_alerts.soon) === 1 ? 's' : ''} out within 5 days</b></>}
            {' '}— a lapsed SIM stops that phone making calls.
          </span>
          <button className="ma-btn sm ma-rip" onPointerDown={ripple} onClick={() => setParam({ tab: 'sims' })}>Open SIMs {Ic.arrow}</button>
        </div>
      )}

      {data && !Number(data.meta?.all_calls) && tab !== 'agents' && (
        <div className="ma-card ma-fade" style={{ padding: '14px 16px', marginBottom: 12, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', borderColor: '#c7d2fe', background: 'linear-gradient(90deg,#eef2ff,#fff)' }}>
          <span className="ciq-logo">{Ic.phone(17)}</span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <b style={{ fontSize: 14 }}>No calls have reached the panel yet</b>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>Point the Caller IQ app on each counselor's phone at this panel. Calls appear here within a minute of ending.</div>
          </div>
          <button className="ma-btn primary ma-rip" onPointerDown={ripple} onClick={() => setSetupOpen(true)}>Connect a phone</button>
        </div>
      )}

      <div key={tab} className="ma-fade">
        {tab === 'overview' && (
          <OverviewTab data={data} loading={busy} deviceById={deviceById} filters={filters} onFilter={applyFilter}
                       onOpenNumber={setNumberTarget} onOpenAgent={setAgentOpen} />
        )}
        {tab === 'calls' && <CallLogTab {...tabProps} />}
        {tab === 'numbers' && <NumbersTab {...tabProps} />}
        {tab === 'agents' && (
          <AgentsTab {...tabProps} onOpenAgent={setAgentOpen} onEdit={setAgentEdit} onSetup={() => setSetupOpen(true)} />
        )}
        {tab === 'sims' && <SimsTab {...tabProps} onEdit={setSimEdit} />}
      </div>

      {/* ── Overlays ──────────────────────────────────────────────── */}
      {filterOpen && (
        <FilterDrawer filters={filters} devices={devices} outcomeOptions={outcomeOptions} teams={data?.teams || []}
                      onApply={f => { setFilters(f); setSearch(f.q || ''); }} onClose={() => setFilterOpen(false)} onSaveView={saveView} />
      )}
      {agentOpen && (
        <AgentDrawer device={deviceById[agentOpen.device_id] || agentOpen} range={range} rangeBody={rangeBody} filters={filters}
                     onClose={() => setAgentOpen(null)} onEdit={setAgentEdit} onOpenNumber={setNumberTarget}
                     onShowCalls={id => { setAgentOpen(null); applyFilter({ devices: [id] }, 'calls'); }} />
      )}
      {numberTarget && (
        <NumberDrawer key={`${numberTarget.number_norm}|${numberTarget.number}|${numberTarget.focusId || ''}`} target={numberTarget}
                      deviceById={deviceById} outcomeOptions={outcomeOptions}
                      onClose={() => setNumberTarget(null)} onChanged={() => { ciqInvalidate(); load({ quiet: true }); setReloadTick(t => t + 1); }} />
      )}
      {agentEdit && (
        <AgentModal device={deviceById[agentEdit.device_id] || agentEdit} teams={data?.teams || []} onClose={() => setAgentEdit(null)}
                    onSaved={() => { ciqInvalidate(); load({ quiet: true }); setReloadTick(t => t + 1); }} />
      )}
      {simEdit && (
        <SimModal sim={simEdit} onClose={() => setSimEdit(null)}
                  onSaved={() => { ciqInvalidate(); load({ quiet: true }); setReloadTick(t => t + 1); }} />
      )}
      {setupOpen && <SetupModal ingestUrl={data?.ingest_url || 'https://cit3.internshipstudio.com/admin/react-api/api/caller-iq/log_call.php'} onClose={() => setSetupOpen(false)} />}
    </div>
  );
}
