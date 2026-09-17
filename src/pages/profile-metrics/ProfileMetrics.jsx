/*
 * src/pages/profile-metrics/ProfileMetrics.jsx
 *
 * Resume / Profile Metrics — what learners do with their profile, and what
 * happens to them in the hiring portal, day by day.
 *
 * The page is built around one idea: every number on it is a door. A tile, a
 * bar, a day on a chart — clicking any of them opens a drawer that groups the
 * same number one dimension finer (a day -> the companies in it -> the roles at
 * that company -> the learners), and the filters on the page hold all the way
 * down. Nothing is a dead end and nothing silently changes population.
 *
 * Written to be read by somebody who does not know the database. Every counter
 * carries a one-line explanation of exactly what it counts, in words, including
 * the two places where the honest answer is "this is the best the data can do":
 *
 *   - "Profiles updated" is LAST TOUCH. users.last_updated is one overwritten
 *     column, so a learner who edited on five days appears on the fifth only.
 *     It is the only measure that covers the old history, so it stays, labelled.
 *
 *   - Resume uploads and section-by-section edits were never recorded at all
 *     before the student dashboard was instrumented. The banner at the top of
 *     the Profile & Resume tab names the exact date tracking began, so a zero
 *     before it reads as "not recorded" rather than "nobody did it".
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Activity, AlertTriangle, Bookmark, BookmarkPlus, Briefcase, CalendarDays,
  ClipboardCheck, Download, ExternalLink, Filter, Info, MessageSquare, PauseCircle, RefreshCw,
  RotateCcw, Search, Sparkles, Trash2, TrendingUp, UserCircle2, X,
} from 'lucide-react';

import {
  pm, RANGE_PRESETS, iso, fmtNum, fmtDate, fmtDateTime, rangeLabel,
  sectionLabel, dimLabel, nextDim, dimFilter, SERIES, STATE,
  toCsv, downloadCsv, stamp, loadPresets, savePresets,
} from './pmApi';
import {
  PmStyles, Card, Segmented, MultiSelect, DrawerStack, DataTable,
  BarCell, Badge, StatusBadge, EmptyState, ErrorState, InfoDot, Pager, PAGE_SIZES, useDebounced,
} from './PmUi';
import { StatTile, TrendChart, BreakdownCard, CompositionCard, ReadSplit, RateCard } from './PmCharts';

/* ── tabs ─────────────────────────────────────────────────────────────────
   Named for the question each one answers, not for the tables behind it. */
const TABS = [
  { key: 'overview',  label: 'Overview',            icon: Activity },
  { key: 'profile',   label: 'Profile & Resume',    icon: UserCircle2 },
  { key: 'hiring',    label: 'Applications',        icon: Briefcase },
  { key: 'work',      label: 'Assignments & Interviews', icon: ClipboardCheck },
  { key: 'messaging', label: 'Messages',            icon: MessageSquare },
];
/* 'work' shares the hiring metric set on the server — it is the same family of
   tables, split into two tabs because they answer different questions. */
const SERVER_TAB = (t) => (t === 'work' ? 'hiring' : t);

const EMPTY_FILTERS = {
  employer_id: [], job_id: [], job_type: [], job_mode: [], app_status: [],
  section: [], read_state: '', q: '', include_test: false, include_revoked: false,
};

const countActive = (f) =>
  (f.employer_id?.length ? 1 : 0) + (f.job_id?.length ? 1 : 0) +
  (f.job_type?.length ? 1 : 0) + (f.job_mode?.length ? 1 : 0) +
  (f.app_status?.length ? 1 : 0) + (f.section?.length ? 1 : 0) +
  (f.read_state ? 1 : 0) + (f.q?.trim() ? 1 : 0) +
  (f.include_test ? 1 : 0) + (f.include_revoked ? 1 : 0);

let uid = 0;

export default function ProfileMetrics() {
  /* ── range ──
     Opens on Today. The page is read as "what happened today", and a default of
     thirty days made every visit start by changing the range. */
  const [preset, setPreset] = useState('today');
  const [range, setRange] = useState(() => RANGE_PRESETS.find((p) => p.key === 'today').make());
  const [customOpen, setCustomOpen] = useState(false);

  /* ── filters ── */
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 400);
  const effFilters = useMemo(() => ({ ...filters, q: debouncedSearch }), [filters, debouncedSearch]);

  /* ── page state ── */
  const [tab, setTab] = useState('overview');
  const [boot, setBoot] = useState(null);
  const [bootErr, setBootErr] = useState('');
  const [stock, setStock] = useState(null);
  /* Firing ten full-table scans that are all going to time out helps nobody and
     hammers the database while it is already struggling, so the metric queries
     wait until the indexes exist — or until somebody says go anyway. */
  const [forceLoad, setForceLoad] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [extra, setExtra] = useState({});      // per-tab breakdown panels
  const [refreshedAt, setRefreshedAt] = useState(null);

  /* ── drawer ── */
  const [levels, setLevels] = useState([]);

  /* ── saved views ── */
  const [presets, setPresets] = useState(() => loadPresets());
  const [presetMenu, setPresetMenu] = useState(false);

  /* Every fetch carries a token; a response whose token is stale is dropped.
     Without this, changing the range twice quickly can leave the slower of the
     two requests painting the page — the classic "I clicked 7 days and got 30". */
  const reqId = useRef(0);

  /* ── bootstrap ──
     Deliberately the only call that must always succeed: it carries the index
     health that tells the page how to make itself fast. Nothing expensive runs
     inside it, and the learner totals it used to compute now come from their own
     request below, which is allowed to fail quietly. */
  useEffect(() => {
    let alive = true;
    pm.bootstrap()
      .then((d) => alive && setBoot(d))
      .catch((e) => alive && setBootErr(e.message || 'Could not load the filter options'));
    pm.stock()
      .then((s) => alive && setStock(s))
      .catch(() => { /* the coverage card shows a dash; nothing else depends on it */ });
    return () => { alive = false; };
  }, []);

  /* ── main load ── */
  const load = useCallback(async () => {
    /* Hold until bootstrap has reported, and until the indexes it reports are
       either there or explicitly overridden. */
    if (!boot) return;
    if (boot.missing_indexes?.length && !forceLoad) {
      setLoading(false);
      return;
    }

    const my = ++reqId.current;
    setLoading(true);
    setErr('');
    try {
      const d = await pm.overview(SERVER_TAB(tab), range, effFilters);
      if (my !== reqId.current) return;
      setData(d);
      setRefreshedAt(new Date());
      await loadExtras(tab, range, effFilters, my);
    } catch (e) {
      if (my !== reqId.current) return;
      setErr(e.message || 'Could not load these numbers');
    } finally {
      if (my === reqId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, range, effFilters, boot, forceLoad]);

  /* The ranked panels under the charts. Fired as a group per tab rather than
     one call per card, and guarded by the same token as the main load. */
  const loadExtras = useCallback(async (t, r, f, my) => {
    const want = {
      overview:  [['companies', 'applications', 'employer'], ['sections', 'profile_section_updated', 'section']],
      profile:   [['sections', 'profile_section_updated', 'section'], ['kinds', 'resume_uploaded', 'resume_kind']],
      hiring:    [['companies', 'applications', 'employer'], ['status', 'applications', 'app_status'],
                  ['types', 'applications', 'job_type'], ['jobs', 'applications', 'job']],
      work:      [['companies', 'assignments_sent', 'employer'], ['ivCompanies', 'interviews_scheduled', 'employer']],
      messaging: [['companies', 'msg_from_company', 'employer'], ['studentCompanies', 'msg_from_student', 'employer']],
    }[t] || [];

    const out = {};
    await Promise.all(
      want.map(async ([slot, metric, dim]) => {
        try {
          /* Cards draw at most the top 13 and the donut the top 5, so 60 rows
             is plenty. The whole-list group count and total ride along with
             this first page, so nothing downstream needs the other 440. */
          const d = await pm.breakdown(metric, dim, r, f, 60);
          out[slot] = d;
        } catch (e) {
          /* One panel failing must not take the tab down with it — a metric can
             be unavailable on an older copy of the database. The reason is kept
             so the card can say so rather than looking like an empty range. */
          out[slot] = { rows: [], error: e.message || 'Could not load this list' };
        }
      })
    );
    if (my === reqId.current) setExtra(out);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── range helpers ── */
  const applyPreset = (key) => {
    setPreset(key);
    if (key === 'custom') { setCustomOpen(true); return; }
    setCustomOpen(false);
    setRange(RANGE_PRESETS.find((p) => p.key === key).make());
  };

  const resetAll = () => {
    setFilters(EMPTY_FILTERS);
    setSearch('');
    applyPreset('today');
    toast.success('Filters cleared');
  };

  const setF = (patch) => setFilters((f) => ({ ...f, ...patch }));

  /* ── saved views ── */
  const saveView = () => {
    const name = window.prompt('Name this view (e.g. "Last 30 days · Infosys · internships")');
    if (!name?.trim()) return;
    const next = [
      { id: `v${Date.now()}`, name: name.trim(), preset, range, filters: { ...filters, q: search }, tab },
      ...presets.filter((p) => p.name !== name.trim()),
    ];
    setPresets(next);
    savePresets(next);
    toast.success('View saved');
  };
  const applyView = (v) => {
    setPreset(v.preset);
    setRange(v.range);
    setFilters({ ...EMPTY_FILTERS, ...v.filters, q: '' });
    setSearch(v.filters?.q || '');
    if (v.tab) setTab(v.tab);
    setPresetMenu(false);
    toast.success(`Showing “${v.name}”`);
  };
  const deleteView = (id) => {
    const next = presets.filter((p) => p.id !== id);
    setPresets(next);
    savePresets(next);
  };

  /* ── drawer ────────────────────────────────────────────────────────────
     A level is "this metric, grouped this way, under these filters, over this
     range". Pushing one is the only way down, popping the only way back, and
     the range can narrow as you go (clicking a day) but never widens. */
  const pushLevel = useCallback((lv) => {
    setLevels((ls) => [...ls, { id: `l${++uid}`, ...lv }]);
  }, []);
  const popLevel = useCallback(() => setLevels((ls) => ls.slice(0, -1)), []);
  /* A level can change its own grouping from inside the drawer; its header is
     drawn by the stack, so the new wording has to be written back up here or
     the title keeps describing the grouping it was opened with. */
  const retitleLevel = useCallback(
    (id, patch) => setLevels((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l))),
    []
  );
  const closeDrawer = useCallback(() => setLevels([]), []);

  /** Open a metric at its most useful first grouping. */
  const openMetric = useCallback((metricKey, opts = {}) => {
    const meta = boot?.metrics?.[metricKey];
    if (!meta) return;
    const dims = meta.dims || [];
    const dim = opts.dim
      ?? (dims.includes('employer') ? 'employer'
        : dims.includes('section') ? 'section'
        : dims.includes('day') ? 'day'
        : dims[0]);
    pushLevel({
      crumb: meta.label,
      title: meta.label,
      subtitle: `${rangeLabel(opts.range || range)} · grouped by ${dimLabel(dim).toLowerCase()}`,
      metric: metricKey,
      dim,
      filters: { ...effFilters, ...(opts.filters || {}) },
      range: opts.range || range,
      hint: meta.hint,
    });
  }, [boot, range, effFilters, pushLevel]);

  /* ── derived ── */
  const cards = useMemo(() => {
    const m = {};
    (data?.cards || []).forEach((c) => { m[c.key] = c; });
    return m;
  }, [data]);

  const activeCount = countActive({ ...filters, q: search });
  /* Nothing has been counted yet: the indexes are missing and nobody has asked
     to run the queries anyway. Distinct from "loaded and empty". */
  const paused = !!(boot?.missing_indexes?.length && !forceLoad);
  const trackingSince = boot?.tracking?.since;

  /* ══════════════════════════════════════════════════════════════════════ */
  if (bootErr) {
    return (
      <div className="p-6">
        <ErrorState text={bootErr} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 pb-16">
      <PmStyles />
      <Helmet><title>Resume / Profile Metrics · Admin</title></Helmet>

      {/* ── header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/92 backdrop-blur">
        <div className="mx-auto max-w-[1600px] px-5 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-[19px] font-semibold tracking-tight text-slate-900">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                  <TrendingUp size={16} />
                </span>
                Resume / Profile Metrics
              </h1>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Profiles, resumes and everything that happens in the hiring portal — day by day, with every
                number openable.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {refreshedAt && (
                <span className="hidden text-[11px] text-slate-400 sm:inline">
                  Updated {refreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="pm-chip flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {/* ── range chips ── */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <CalendarDays size={14} className="text-slate-400" />
            <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1">
              {RANGE_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  className={`pm-chip rounded-lg px-3 py-1.5 text-[12px] font-medium ${
                    preset === p.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {(customOpen || preset === 'custom') && (
              <span className="pm-pop flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/60 px-2.5 py-1.5">
                <input
                  type="date"
                  value={range.start}
                  max={range.end}
                  onChange={(e) => { setPreset('custom'); setRange((r) => ({ ...r, start: e.target.value })); }}
                  className="rounded-md border border-indigo-200 bg-white px-2 py-1 text-[11.5px] text-slate-700 outline-none focus:border-indigo-400"
                />
                <span className="text-[11px] text-slate-400">to</span>
                <input
                  type="date"
                  value={range.end}
                  min={range.start}
                  max={iso(new Date())}
                  onChange={(e) => { setPreset('custom'); setRange((r) => ({ ...r, end: e.target.value })); }}
                  className="rounded-md border border-indigo-200 bg-white px-2 py-1 text-[11.5px] text-slate-700 outline-none focus:border-indigo-400"
                />
              </span>
            )}

            <span className="ml-auto text-[11.5px] text-slate-500">
              {rangeLabel(range)}
              <span className="ml-2 text-slate-400">
                vs {rangeLabel({ start: data?.range?.prev_start, end: data?.range?.prev_end })}
              </span>
            </span>
          </div>

          {/* ── filters ── */}
          <FilterBar
            boot={boot}
            filters={filters}
            setF={setF}
            search={search}
            setSearch={setSearch}
            activeCount={activeCount}
            onReset={resetAll}
            presets={presets}
            presetMenu={presetMenu}
            setPresetMenu={setPresetMenu}
            onSaveView={saveView}
            onApplyView={applyView}
            onDeleteView={deleteView}
          />

          {/* ── tabs ── */}
          <nav className="-mb-px mt-3 flex gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              const on = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`pm-chip flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[12.5px] font-medium ${
                    on
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-800'
                  }`}
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ── body ────────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-[1600px] px-5 pt-5">
        <IndexNotice
          boot={boot}
          forced={forceLoad}
          onLoadAnyway={() => setForceLoad(true)}
          onDone={() => {
            /* Re-read health rather than assuming: an ALTER can fail on one
               table and succeed on the rest, and the banner must reflect that. */
            pm.bootstrap(true).then(setBoot).catch(() => {});
            pm.stock().then(setStock).catch(() => {});
            setForceLoad(true);
          }}
        />
        <DegradedNotice notes={data?.degraded || boot?.degraded} />

        {paused ? (
          /* An explicit "not asked yet" state. Rendering the normal empty tabs
             here would put "No activity in this range" under every chart, which
             is a factual claim about the data and the exact wrong thing to say
             when nothing has been counted. */
          <Card>
            <EmptyState
              icon={PauseCircle}
              text="Waiting for the database indexes"
              sub="Nothing has been counted yet. Create the indexes above and these numbers will fill in — or choose “Load anyway” to run the queries as they are."
            />
          </Card>
        ) : err ? (
          <Card><ErrorState text={err} onRetry={load} /></Card>
        ) : (
          <div key={tab} className="pm-rise space-y-4">
            {tab === 'overview' && (
              <OverviewTab {...{ cards, data, loading, extra, boot, openMetric, range, effFilters, pushLevel }} />
            )}
            {tab === 'profile' && (
              <ProfileTab {...{ cards, data, loading, extra, stock, openMetric, range, effFilters, pushLevel, trackingSince }} />
            )}
            {tab === 'hiring' && (
              <HiringTab {...{ cards, data, loading, extra, boot, openMetric, range, effFilters, pushLevel }} />
            )}
            {tab === 'work' && (
              <WorkTab {...{ cards, data, loading, extra, boot, openMetric, range, effFilters, pushLevel }} />
            )}
            {tab === 'messaging' && (
              <MessagingTab {...{ cards, data, loading, extra, boot, openMetric, range, effFilters, pushLevel }} />
            )}
          </div>
        )}
      </main>

      <DrawerStack
        levels={levels}
        onPop={popLevel}
        onClose={closeDrawer}
        renderLevel={(lv) => <DrawerLevel level={lv} boot={boot} onDrill={pushLevel} onRetitle={retitleLevel} />}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Filter bar
══════════════════════════════════════════════════════════════════════════ */
function FilterBar({
  boot, filters, setF, search, setSearch, activeCount, onReset,
  presets, presetMenu, setPresetMenu, onSaveView, onApplyView, onDeleteView,
}) {
  const [open, setOpen] = useState(false);

  const employerOpts = useMemo(
    () => (boot?.employers || []).map((e) => ({ id: e.id, label: e.label, meta: e.applications || undefined })),
    [boot]
  );
  const asOpts = (arr, fmt = (x) => x) => (arr || []).map((v) => ({ id: v, label: fmt(v) }));

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a learner by name, email, phone or ID…"
            className="w-72 rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-8 text-[12.5px] outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`pm-chip flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-medium ${
            open || activeCount
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          }`}
        >
          <Filter size={13} />
          Filters
          {activeCount > 0 && (
            <span className="ml-0.5 rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>

        {/* saved views */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setPresetMenu((v) => !v)}
            className="pm-chip flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-medium text-slate-600 hover:border-slate-300"
          >
            <Bookmark size={13} />
            Saved views
            {presets.length > 0 && <span className="text-[10.5px] text-slate-400">{presets.length}</span>}
          </button>
          {presetMenu && (
            <div className="pm-pop absolute right-0 z-40 mt-2 w-72 origin-top-right rounded-xl border border-slate-200 bg-white shadow-xl">
              <button
                type="button"
                onClick={onSaveView}
                className="pm-row flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-left text-[12.5px] font-medium text-indigo-600"
              >
                <BookmarkPlus size={14} /> Save the current view
              </button>
              <div className="pm-scroll max-h-72 overflow-y-auto py-1">
                {presets.length === 0 ? (
                  <p className="px-3 py-6 text-center text-[11.5px] leading-relaxed text-slate-400">
                    Nothing saved yet.<br />Set a range and some filters, then save them here.
                  </p>
                ) : (
                  presets.map((p) => (
                    <div key={p.id} className="pm-row flex items-center gap-2 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onApplyView(p)}
                        className="min-w-0 flex-1 truncate text-left text-[12.5px] text-slate-700"
                      >
                        {p.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteView(p.id)}
                        className="shrink-0 text-slate-300 hover:text-rose-500"
                        title="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="pm-chip flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <RotateCcw size={12} /> Clear all
          </button>
        )}
      </div>

      {open && (
        <div className="pm-rise mt-2.5 flex flex-wrap items-start gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <MultiSelect
            label="Company" icon={<Briefcase size={13} className="text-slate-400" />}
            options={employerOpts} value={filters.employer_id}
            onChange={(v) => setF({ employer_id: v })} width="w-64"
          />
          <MultiSelect
            label="Opportunity type" options={asOpts(boot?.job_types)}
            value={filters.job_type} onChange={(v) => setF({ job_type: v })} width="w-48"
          />
          <MultiSelect
            label="Work mode" options={asOpts(boot?.job_modes)}
            value={filters.job_mode} onChange={(v) => setF({ job_mode: v })} width="w-44"
          />
          <MultiSelect
            label="Application status" options={asOpts(boot?.app_status)}
            value={filters.app_status} onChange={(v) => setF({ app_status: v })} width="w-48"
          />
          <MultiSelect
            label="Profile section" options={asOpts(boot?.sections, sectionLabel)}
            value={filters.section} onChange={(v) => setF({ section: v })} width="w-52"
          />

          <div className="w-44">
            <p className="px-1 text-[10.5px] uppercase tracking-wide text-slate-400">Read status</p>
            <div className="mt-1">
              <Segmented
                size="sm"
                options={[
                  { key: '', label: 'All' },
                  { key: 'read', label: 'Read' },
                  { key: 'unread', label: 'Unread' },
                ]}
                value={filters.read_state}
                onChange={(v) => setF({ read_state: v })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 self-center pl-1">
            <Check
              label="Include test accounts"
              hint="Staff and QA rigs are hidden by default — they would sit at the top of every company and every day."
              checked={filters.include_test}
              onChange={(v) => setF({ include_test: v })}
            />
            <Check
              label="Include revoked applications"
              hint="Applications a learner withdrew. Only applies where the database flags them rather than deleting the row."
              checked={filters.include_revoked}
              onChange={(v) => setF({ include_revoked: v })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Check({ label, hint, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[11.5px] text-slate-600">
      <span
        onClick={() => onChange(!checked)}
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
          checked ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'
        }`}
      >
        {checked && <span className="text-[9px] font-bold leading-none">✓</span>}
      </span>
      <span onClick={() => onChange(!checked)}>{label}</span>
      <InfoDot text={hint} />
    </label>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Tabs
══════════════════════════════════════════════════════════════════════════ */
const Grid = ({ children, cols = 'lg:grid-cols-5' }) => (
  <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${cols}`}>{children}</div>
);

/* Stat tiles on the left, the composition donut on the right. Collapses to one
   column below xl, where the donut would be too narrow to read. */
const StatsWithPie = ({ children, pie, cols = 'lg:grid-cols-3' }) => (
  /* items-start, so the two columns keep their natural heights. Left to stretch,
     the shorter column matches the taller one and the tiles grow a band of empty
     space under every number. */
  <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,2.6fr)_minmax(0,1fr)]">
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${cols}`}>{children}</div>
    {pie}
  </div>
);

function OverviewTab({ cards, data, loading, extra, openMetric, range, effFilters, pushLevel }) {
  const order = ['new_profiles', 'profiles_updated', 'resume_uploaded', 'profile_section_updated',
                 'applications', 'assignments_sent', 'assignments_submitted',
                 'interviews_scheduled', 'msg_from_company', 'msg_from_student'];
  /* The slices are the same five streams the stacked chart below totals, so the
     donut is that chart's bar height broken open — not a set of unrelated
     counters glued into a circle. Anything genuinely incomparable (you cannot
     add applications to messages and call the sum a quantity) stays out. */
  const mixKeys = ['new_profiles', 'profiles_updated', 'resume_uploaded', 'applications', 'msg_from_company'];
  const mix = mixKeys
    .filter((k) => cards[k])
    .map((k) => ({ id: k, label: cards[k].label, count: cards[k].total }));

  return (
    <>
      <StatsWithPie
        cols="lg:grid-cols-4 xl:grid-cols-4"
        pie={
          <CompositionCard
            title="Activity mix"
            subtitle={rangeLabel(range)}
            hint="The share each kind of activity makes up of everything tracked in this range — the same five streams stacked in the chart below, shown as proportions. Click a slice to break it down."
            rows={mix}
            loading={loading}
            emptyText="No activity in this range"
            onSliceClick={(s) => openMetric(s.id)}
          />
        }
      >
        {order.map((k, i) => (
          <StatTile
            key={k} card={cards[k]} loading={loading}
            color={SERIES[i % SERIES.length]}
            onOpen={cards[k] ? () => openMetric(k) : undefined}
          />
        ))}
      </StatsWithPie>

      <TrendChart
        title="Everything, day by day"
        subtitle="Profile activity and hiring activity on one timeline"
        hint="Each bar is one day. Segments stack so the height is the total amount of activity that day. Click a day to open it."
        metrics={[cards.new_profiles, cards.profiles_updated, cards.resume_uploaded,
                  cards.applications, cards.msg_from_company].filter(Boolean)}
        days={data?.days || []}
        loading={loading}
        height={300}
        onPointClick={(day) =>
          pushLevel({
            crumb: fmtDate(day),
            title: `Everything on ${fmtDate(day)}`,
            subtitle: 'Applications on this day, by company',
            metric: 'applications', dim: 'employer',
            filters: effFilters, range: { start: day, end: day },
          })
        }
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <BreakdownCard
          title="Companies receiving the most applications"
          subtitle={rangeLabel(range)}
          hint="Every application in the range, grouped by the company that posted the job. Click a company to see its individual roles."
          rows={extra.companies?.rows || []}
          error={extra.companies?.error}
          total={extra.companies?.total ?? undefined}
          groups={extra.companies?.groups ?? undefined}
          loading={loading}
          color={SERIES[0]}
          onRowClick={(r) =>
            pushLevel({
              crumb: r.label, title: r.label, subtitle: `Applications · ${rangeLabel(range)}`,
              metric: 'applications', dim: 'job',
              filters: { ...effFilters, ...dimFilter('employer', r) }, range,
            })
          }
          onViewAll={() => openMetric('applications', { dim: 'employer' })}
        />
        <BreakdownCard
          title="Profile sections learners edit most"
          subtitle={rangeLabel(range)}
          hint="One count per section saved — a learner who saves their education twice counts twice."
          rows={extra.sections?.rows || []}
          error={extra.sections?.error}
          total={extra.sections?.total ?? undefined}
          groups={extra.sections?.groups ?? undefined}
          loading={loading}
          color={SERIES[2]}
          labelFmt={(r) => sectionLabel(r.id)}
          onRowClick={(r) =>
            pushLevel({
              crumb: sectionLabel(r.id), title: sectionLabel(r.id),
              subtitle: `Learners who edited this section · ${rangeLabel(range)}`,
              metric: 'profile_section_updated', dim: 'user',
              filters: { ...effFilters, ...dimFilter('section', r) }, range,
            })
          }
          onViewAll={() => openMetric('profile_section_updated', { dim: 'section' })}
          emptyText="No section edits recorded in this range"
        />
      </div>
    </>
  );
}

function ProfileTab({ cards, data, loading, extra, stock, openMetric, range, effFilters, pushLevel, trackingSince }) {
  const order = ['new_profiles', 'profiles_updated', 'resume_uploaded', 'resume_first_upload',
                 'resume_replaced', 'resume_removed', 'profile_section_updated',
                 'profile_editors', 'profile_photo_updated'];
  return (
    <>
      <TrackingNotice since={trackingSince} range={range} />

      <StatsWithPie
        cols="lg:grid-cols-4 xl:grid-cols-3"
        pie={
          <CompositionCard
            title="Which parts of the profile"
            subtitle={rangeLabel(range)}
            hint="Every section save in this range, as a share of the total. Work experience, education, certifications and the rest — the thirteen sections the profile is made of. Click a slice for the learners behind it."
            rows={extra.sections?.rows || []}
            total={extra.sections?.total ?? undefined}
            loading={loading}
            labelFmt={(r) => (r.isOther ? r.label : sectionLabel(r.id))}
            emptyText="No section edits recorded in this range"
            onSliceClick={(s) =>
              pushLevel({
                crumb: sectionLabel(s.id), title: sectionLabel(s.id),
                subtitle: `Learners who edited this · ${rangeLabel(range)}`,
                metric: 'profile_section_updated', dim: 'user',
                filters: { ...effFilters, ...dimFilter('section', s) }, range,
              })
            }
          />
        }
      >
        {order.map((k, i) => (
          <StatTile
            key={k} card={cards[k]} loading={loading}
            color={SERIES[i % SERIES.length]}
            invert={k === 'resume_removed'}
            onOpen={cards[k] ? () => openMetric(k) : undefined}
          />
        ))}
      </StatsWithPie>

      {/* The original question, on its own chart: how many new, how many old. */}
      <TrendChart
        title="New profiles vs. existing profiles updated"
        subtitle="The two lines the request started from"
        hint={
          'New profiles: accounts created that day. ' +
          'Existing profiles updated: learners whose profile was last touched that day — because the database ' +
          'keeps only the most recent edit date per learner, somebody who edited on five days is counted once, on the fifth. ' +
          'Edits on the same day as signup are excluded so a new signup is not also counted as an update.'
        }
        metrics={[cards.new_profiles, cards.profiles_updated].filter(Boolean)}
        days={data?.days || []}
        loading={loading}
        mode="line"
        height={280}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <TrendChart
          title="Resumes uploaded"
          subtitle="First-time uploads and replacements, separated"
          hint="A first-time upload is a learner who had nothing on file. A replacement overwrote an existing resume — usually a learner improving it."
          metrics={[cards.resume_first_upload, cards.resume_replaced].filter(Boolean)}
          days={data?.days || []}
          loading={loading}
          colors={[SERIES[0], SERIES[3]]}
          height={240}
          onPointClick={(day) =>
            pushLevel({
              crumb: fmtDate(day), title: `Resumes uploaded on ${fmtDate(day)}`,
              subtitle: 'The learners behind the number',
              metric: 'resume_uploaded', dim: 'user',
              filters: effFilters, range: { start: day, end: day },
            })
          }
        />
        <TrendChart
          title="Profile section edits"
          subtitle="Every save, across all thirteen sections"
          hint="Counted per section saved, so one learner filling in education and then certifications is two."
          metrics={[cards.profile_section_updated, cards.profile_editors].filter(Boolean)}
          days={data?.days || []}
          loading={loading}
          mode="line"
          colors={[SERIES[2], SERIES[1]]}
          height={240}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <BreakdownCard
          title="Which parts of the profile get edited"
          subtitle={rangeLabel(range)}
          hint="Work experience, education, certifications, personal details and the rest — counted separately, most-edited first."
          rows={extra.sections?.rows || []}
          error={extra.sections?.error}
          total={extra.sections?.total ?? undefined}
          groups={extra.sections?.groups ?? undefined}
          loading={loading}
          color={SERIES[2]}
          limit={13}
          labelFmt={(r) => sectionLabel(r.id)}
          onRowClick={(r) =>
            pushLevel({
              crumb: sectionLabel(r.id), title: sectionLabel(r.id),
              subtitle: `Learners who edited this · ${rangeLabel(range)}`,
              metric: 'profile_section_updated', dim: 'user',
              filters: { ...effFilters, ...dimFilter('section', r) }, range,
            })
          }
          emptyText="No section edits recorded in this range"
        />
        {/* The section list runs to thirteen rows; this column holds two
            shorter cards so the row does not end in a block of empty white. */}
        <div className="flex flex-col gap-3">
          <BreakdownCard
            title="First upload or replacement"
            subtitle={rangeLabel(range)}
            hint="Splits every resume upload by whether the learner already had one on file."
            rows={extra.kinds?.rows || []}
            error={extra.kinds?.error}
          total={extra.kinds?.total ?? undefined}
          groups={extra.kinds?.groups ?? undefined}
            loading={loading}
            color={SERIES[0]}
            onRowClick={(r) =>
              pushLevel({
                crumb: r.label, title: r.label,
                subtitle: `Learners · ${rangeLabel(range)}`,
                metric: r.id === 'replaced' ? 'resume_replaced' : 'resume_first_upload',
                dim: 'user', filters: effFilters, range,
              })
            }
            emptyText="No resume uploads recorded in this range"
          />
          {/* The denominator the flow numbers above are missing: uploads per day
              mean one thing against 130k learners who have a resume and quite
              another against 13k. Not affected by the date range — it is a
              standing total, and the caption says so. */}
          <RateCard
            title="Learners with a resume on file"
            hint="Everyone who has a resume stored right now, as a share of all registered learners. This is a running total of the whole base — the date range above does not change it."
            numerator={stock?.with_resume || 0}
            denominator={stock?.learners || 0}
            numLabel="have a resume"
            denLabel="registered learners"
            loading={!stock}
            tone={SERIES[0]}
          />
        </div>
      </div>
    </>
  );
}

function HiringTab({ cards, data, loading, extra, openMetric, range, effFilters, pushLevel }) {
  return (
    <>
      <StatsWithPie
        cols="lg:grid-cols-3"
        pie={
          <CompositionCard
            title="Where applications stand"
            subtitle={rangeLabel(range)}
            hint="The current status of every application submitted in this range. Status changes after the fact, so this is today's picture of that cohort, not where they stood on the day. Click a slice for the companies behind it."
            rows={extra.status?.rows || []}
            total={extra.status?.total ?? undefined}
            loading={loading}
            emptyText="No applications in this range"
            onSliceClick={(s) =>
              pushLevel({
                crumb: String(s.label), title: `Applications: ${s.label}`,
                subtitle: `By company · ${rangeLabel(range)}`,
                metric: 'applications', dim: 'employer',
                filters: { ...effFilters, ...dimFilter('app_status', s) }, range,
              })
            }
          />
        }
      >
        {['applications', 'invites'].map((k, i) => (
          <StatTile key={k} card={cards[k]} loading={loading} color={SERIES[i]}
                    onOpen={cards[k] ? () => openMetric(k) : undefined} />
        ))}
        <Card className="p-4">
          <p className="text-[11.5px] font-medium text-slate-500">Companies involved</p>
          <p className="pm-count mt-1.5 text-[26px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums">
            {loading ? '—' : fmtNum(extra.companies?.groups ?? extra.companies?.rows?.length ?? 0)}
          </p>
          <p className="mt-1 text-[10.5px] leading-relaxed text-slate-400">
            received at least one application in this range · {fmtNum(extra.jobs?.groups ?? extra.jobs?.rows?.length ?? 0)} distinct roles
          </p>
        </Card>
      </StatsWithPie>

      <TrendChart
        title="Applications per day"
        subtitle="Jobs, internships and contracts in the hiring portal"
        hint="One count per application submitted. Revoking an application deletes its row in the student dashboard, so a past day can shrink after the fact. Click a day to see the companies in it."
        metrics={[cards.applications, cards.invites].filter(Boolean)}
        days={data?.days || []}
        loading={loading}
        height={290}
        onPointClick={(day) =>
          pushLevel({
            crumb: fmtDate(day), title: `Applications on ${fmtDate(day)}`,
            subtitle: 'Grouped by company', metric: 'applications', dim: 'employer',
            filters: effFilters, range: { start: day, end: day },
          })
        }
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <BreakdownCard
          title="Applications by company"
          subtitle={`${rangeLabel(range)} · click for that company's roles`}
          hint="Every application grouped by the company that posted the job."
          rows={extra.companies?.rows || []}
          error={extra.companies?.error}
          total={extra.companies?.total ?? undefined}
          groups={extra.companies?.groups ?? undefined}
          loading={loading}
          limit={10}
          color={SERIES[0]}
          onRowClick={(r) =>
            pushLevel({
              crumb: r.label, title: r.label, subtitle: `Applications by role · ${rangeLabel(range)}`,
              metric: 'applications', dim: 'job',
              filters: { ...effFilters, ...dimFilter('employer', r) }, range,
            })
          }
          onViewAll={() => openMetric('applications', { dim: 'employer' })}
        />
        <BreakdownCard
          title="Most-applied-to roles"
          subtitle={`${rangeLabel(range)} · click for the applicants`}
          hint="Individual jobs and internships, across every company."
          rows={extra.jobs?.rows || []}
          error={extra.jobs?.error}
          total={extra.jobs?.total ?? undefined}
          groups={extra.jobs?.groups ?? undefined}
          loading={loading}
          limit={10}
          color={SERIES[1]}
          labelFmt={(r) => (
            <>
              {r.label}
              {r.extra && <span className="ml-1.5 text-[11px] text-slate-400">· {r.extra}</span>}
            </>
          )}
          onRowClick={(r) =>
            pushLevel({
              crumb: r.label, title: r.label, subtitle: `Applicants · ${rangeLabel(range)}`,
              metric: 'applications', dim: 'user',
              filters: { ...effFilters, ...dimFilter('job', r) }, range,
            })
          }
          onViewAll={() => openMetric('applications', { dim: 'job' })}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <BreakdownCard
          title="Where applications stand"
          subtitle={rangeLabel(range)}
          hint="The current status of applications submitted in this range — status changes later, so this is today's picture of that cohort."
          rows={extra.status?.rows || []}
          error={extra.status?.error}
          total={extra.status?.total ?? undefined}
          groups={extra.status?.groups ?? undefined}
          loading={loading}
          color={SERIES[2]}
          onRowClick={(r) =>
            pushLevel({
              crumb: r.label, title: `Applications: ${r.label}`,
              subtitle: `By company · ${rangeLabel(range)}`,
              metric: 'applications', dim: 'employer',
              filters: { ...effFilters, ...dimFilter('app_status', r) }, range,
            })
          }
        />
        <BreakdownCard
          title="Jobs vs internships vs contracts"
          subtitle={rangeLabel(range)}
          hint="Applications split by the type of opportunity."
          rows={extra.types?.rows || []}
          error={extra.types?.error}
          total={extra.types?.total ?? undefined}
          groups={extra.types?.groups ?? undefined}
          loading={loading}
          color={SERIES[3]}
          onRowClick={(r) =>
            pushLevel({
              crumb: r.label, title: `${r.label} applications`,
              subtitle: `By company · ${rangeLabel(range)}`,
              metric: 'applications', dim: 'employer',
              filters: { ...effFilters, ...dimFilter('job_type', r) }, range,
            })
          }
        />
      </div>
    </>
  );
}

function WorkTab({ cards, data, loading, extra, openMetric, range, effFilters, pushLevel }) {
  const sent = cards.assignments_sent?.total || 0;
  const done = cards.assignments_submitted?.total || 0;
  const sched = cards.interviews_scheduled?.total || 0;
  const resch = cards.reschedule_requests?.total || 0;

  return (
    <>
      <StatsWithPie
        cols="lg:grid-cols-3"
        pie={
          <CompositionCard
            title="Assignments by company"
            subtitle={rangeLabel(range)}
            hint="Every assignment sent in this range, as a share of the total, by the company that sent it. Click a slice for that company's roles."
            rows={extra.companies?.rows || []}
            total={extra.companies?.total ?? undefined}
            loading={loading}
            emptyText="No assignments sent in this range"
            onSliceClick={(s) =>
              pushLevel({
                crumb: String(s.label), title: String(s.label),
                subtitle: `Assignments sent, by role · ${rangeLabel(range)}`,
                metric: 'assignments_sent', dim: 'job',
                filters: { ...effFilters, ...dimFilter('employer', s) }, range,
              })
            }
          />
        }
      >
        {['assignments_sent', 'assignments_submitted', 'interviews_scheduled',
          'interviews_held', 'reschedule_requests'].map((k, i) => (
          <StatTile key={k} card={cards[k]} loading={loading} color={SERIES[i % SERIES.length]}
                    invert={k === 'reschedule_requests'}
                    onOpen={cards[k] ? () => openMetric(k) : undefined} />
        ))}
      </StatsWithPie>

      <div className="grid gap-3 lg:grid-cols-3">
        <RateCard
          title="Assignment submission rate"
          hint="Submissions in this range as a share of assignments sent in this range. An assignment sent on the last day may be submitted after it — a low rate at the edge of a short range usually means that, not that candidates ignored it."
          numerator={done} denominator={sent}
          numLabel="submitted" denLabel="sent"
          loading={loading} tone={SERIES[2]}
        />
        <RateCard
          title="Interviews asked to be moved"
          hint="Reschedule requests as a share of interviews scheduled. Worth watching — a rising share usually means slots are being booked at short notice."
          numerator={resch} denominator={sched}
          numLabel="reschedule requests" denLabel="interviews"
          loading={loading} tone={SERIES[5]}
        />
        <Card className="p-4">
          <p className="text-[11.5px] font-medium text-slate-500">Companies running assignments</p>
          <p className="pm-count mt-1.5 text-[26px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums">
            {loading ? '—' : fmtNum(extra.companies?.groups ?? extra.companies?.rows?.length ?? 0)}
          </p>
          <p className="mt-1 text-[10.5px] text-slate-400">
            {fmtNum(extra.ivCompanies?.groups ?? extra.ivCompanies?.rows?.length ?? 0)} scheduled at least one interview
          </p>
        </Card>
      </div>

      <TrendChart
        title="Assignments sent and submitted"
        subtitle="Company action and candidate response on one timeline"
        hint="Sent is counted on the day the company issued it; submitted on the day the candidate uploaded. The two will not line up day for day — that gap is the turnaround time."
        metrics={[cards.assignments_sent, cards.assignments_submitted].filter(Boolean)}
        days={data?.days || []}
        loading={loading}
        mode="line"
        colors={[SERIES[1], SERIES[2]]}
        height={270}
      />

      <TrendChart
        title="Interviews"
        subtitle="Booked, due, and asked to be moved"
        hint="'Booked' counts the day the company created the slot. 'Due' counts the interview date itself — the same interview appears on two different days on this chart, which is the point."
        metrics={[cards.interviews_scheduled, cards.interviews_held, cards.reschedule_requests].filter(Boolean)}
        days={data?.days || []}
        loading={loading}
        stacked={false}
        /* Grouped bars, so all three sit side by side on the same day and every
           PAIR has to be separable — not just neighbours in a stack. Indigo /
           aqua / orange is the one trio in the palette that clears the
           all-pairs gates; the obvious red for "reschedule" sat 13.2 ΔE from
           magenta, under the 15 floor, and status colours are reserved anyway. */
        colors={[SERIES[0], SERIES[2], SERIES[1]]}
        height={250}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <BreakdownCard
          title="Companies sending the most assignments"
          subtitle={`${rangeLabel(range)} · click for their roles`}
          rows={extra.companies?.rows || []}
          error={extra.companies?.error}
          total={extra.companies?.total ?? undefined}
          groups={extra.companies?.groups ?? undefined}
          loading={loading}
          color={SERIES[1]}
          onRowClick={(r) =>
            pushLevel({
              crumb: r.label, title: r.label, subtitle: `Assignments sent, by role · ${rangeLabel(range)}`,
              metric: 'assignments_sent', dim: 'job',
              filters: { ...effFilters, ...dimFilter('employer', r) }, range,
            })
          }
          onViewAll={() => openMetric('assignments_sent', { dim: 'employer' })}
        />
        <BreakdownCard
          title="Companies scheduling the most interviews"
          subtitle={`${rangeLabel(range)} · click for their roles`}
          rows={extra.ivCompanies?.rows || []}
          error={extra.ivCompanies?.error}
          total={extra.ivCompanies?.total ?? undefined}
          groups={extra.ivCompanies?.groups ?? undefined}
          loading={loading}
          color={SERIES[0]}
          onRowClick={(r) =>
            pushLevel({
              crumb: r.label, title: r.label, subtitle: `Interviews, by role · ${rangeLabel(range)}`,
              metric: 'interviews_scheduled', dim: 'job',
              filters: { ...effFilters, ...dimFilter('employer', r) }, range,
            })
          }
          onViewAll={() => openMetric('interviews_scheduled', { dim: 'employer' })}
        />
      </div>
    </>
  );
}

function MessagingTab({ cards, data, loading, extra, openMetric, range, effFilters, pushLevel }) {
  const openSide = (metric, state) =>
    pushLevel({
      crumb: state === 'read' ? 'Opened' : 'Not opened',
      title: state === 'read' ? 'Messages that were opened' : 'Messages still unopened',
      subtitle: `${rangeLabel(range)} · by company`,
      metric, dim: 'employer',
      filters: { ...effFilters, read_state: state }, range,
    });

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-2">
        <ReadSplit
          title="Companies → students"
          subtitle="Chat messages a company sent to a candidate"
          hint="Counted on the day the company sent it. 'Opened' is the message's current state — a message sent yesterday and read this morning counts as opened on yesterday's bar."
          sent={cards.msg_from_company?.total || 0}
          read={cards.msg_from_company_read?.total || 0}
          unread={cards.msg_from_company_unread?.total || 0}
          loading={loading}
          colorRead={STATE.read}
          colorUnread={STATE.unread}
          onOpen={(state) => openSide('msg_from_company', state)}
        />
        <ReadSplit
          title="Students → companies"
          subtitle="Chat messages a candidate sent to a company"
          hint="The mirror image: how much of what learners send is actually being opened on the employer side."
          sent={cards.msg_from_student?.total || 0}
          read={cards.msg_from_student_read?.total || 0}
          unread={cards.msg_from_student_unread?.total || 0}
          loading={loading}
          colorRead={STATE.read}
          colorUnread={STATE.unread}
          onOpen={(state) => openSide('msg_from_student', state)}
        />
      </div>

      <StatsWithPie
        cols="lg:grid-cols-3"
        pie={
          <CompositionCard
            title="Who is doing the talking"
            subtitle={rangeLabel(range)}
            hint="Messages companies sent in this range, as a share of the total, by company. The read/unread split is the bar above — a share with one cut reads better as a bar than as a circle. Click a slice for that company's roles."
            rows={extra.companies?.rows || []}
            total={extra.companies?.total ?? undefined}
            loading={loading}
            emptyText="No company messages in this range"
            onSliceClick={(s) =>
              pushLevel({
                crumb: String(s.label), title: String(s.label),
                subtitle: `Messages sent, by role · ${rangeLabel(range)}`,
                metric: 'msg_from_company', dim: 'job',
                filters: { ...effFilters, ...dimFilter('employer', s) }, range,
              })
            }
          />
        }
      >
        {['msg_from_company', 'msg_from_company_read', 'msg_from_company_unread',
          'msg_from_student', 'msg_from_student_read', 'msg_from_student_unread'].map((k, i) => (
          <StatTile key={k} card={cards[k]} loading={loading}
                    color={k.endsWith('unread') ? SERIES[5] : SERIES[i < 3 ? 0 : 2]}
                    invert={k.endsWith('unread')}
                    onOpen={cards[k] ? () => openMetric(k) : undefined} />
        ))}
      </StatsWithPie>

      <TrendChart
        title="Messages from companies, opened or not"
        subtitle="Every bar is one day's outbound messages, split by whether the candidate has opened them"
        hint="The unopened part of a recent day is normal — candidates have not got to it yet. A tall unopened segment on an old day is the one worth asking about."
        metrics={[cards.msg_from_company_read, cards.msg_from_company_unread].filter(Boolean)}
        days={data?.days || []}
        loading={loading}
        colors={[STATE.read, STATE.unread]}
        height={250}
        onPointClick={(day) =>
          pushLevel({
            crumb: fmtDate(day), title: `Company messages on ${fmtDate(day)}`,
            subtitle: 'By company', metric: 'msg_from_company', dim: 'employer',
            filters: effFilters, range: { start: day, end: day },
          })
        }
      />

      <TrendChart
        title="Messages from students, opened or not"
        subtitle="The same split, in the other direction"
        metrics={[cards.msg_from_student_read, cards.msg_from_student_unread].filter(Boolean)}
        days={data?.days || []}
        loading={loading}
        colors={[STATE.read, STATE.unread]}
        height={250}
        onPointClick={(day) =>
          pushLevel({
            crumb: fmtDate(day), title: `Student messages on ${fmtDate(day)}`,
            subtitle: 'By company', metric: 'msg_from_student', dim: 'employer',
            filters: effFilters, range: { start: day, end: day },
          })
        }
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <BreakdownCard
          title="Companies talking to candidates most"
          subtitle={rangeLabel(range)}
          rows={extra.companies?.rows || []}
          error={extra.companies?.error}
          total={extra.companies?.total ?? undefined}
          groups={extra.companies?.groups ?? undefined}
          loading={loading}
          color={SERIES[0]}
          onRowClick={(r) =>
            pushLevel({
              crumb: r.label, title: r.label, subtitle: `Messages sent, by role · ${rangeLabel(range)}`,
              metric: 'msg_from_company', dim: 'job',
              filters: { ...effFilters, ...dimFilter('employer', r) }, range,
            })
          }
          onViewAll={() => openMetric('msg_from_company', { dim: 'employer' })}
        />
        <BreakdownCard
          title="Companies candidates write to most"
          subtitle={rangeLabel(range)}
          rows={extra.studentCompanies?.rows || []}
          error={extra.studentCompanies?.error}
          total={extra.studentCompanies?.total ?? undefined}
          groups={extra.studentCompanies?.groups ?? undefined}
          loading={loading}
          color={SERIES[2]}
          onRowClick={(r) =>
            pushLevel({
              crumb: r.label, title: r.label, subtitle: `Messages received, by role · ${rangeLabel(range)}`,
              metric: 'msg_from_student', dim: 'job',
              filters: { ...effFilters, ...dimFilter('employer', r) }, range,
            })
          }
          onViewAll={() => openMetric('msg_from_student', { dim: 'employer' })}
        />
      </div>
    </>
  );
}

/* ── index notice ─────────────────────────────────────────────────────────
   The single thing that decides whether this page answers in milliseconds or
   times out. Every panel filters by a date range first; without an index on the
   date column, "last 30 days" is a full scan of chat_messages and
   hiring_applications_new, repeated once per counter.
   Offered as a button rather than run automatically: these are ALTERs on large
   live tables, and a dashboard should not start one on its own. */
function IndexNotice({ boot, onDone, onLoadAnyway, forced }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const missing = boot?.missing_indexes || [];

  if (!missing.length) return null;

  /* One index per request, looping until the server says none are left. The
     progress line matters: these ALTERs can each take minutes, and a button that
     just says "Creating…" for ten of them looks indistinguishable from hung. */
  const run = async () => {
    setBusy(true);
    setProgress(null);
    const failures = [];
    let madeOk = 0;

    try {
      const total = missing.length;
      // Hard stop well above the real count, so a server that never reports
      // `done` cannot spin this forever.
      for (let i = 0; i < total + 5; i++) {
        const res = await pm.installIndexes(1);
        const made = res.created || [];
        if (!made.length) break;

        made.forEach((c) => (c.ok ? madeOk++ : failures.push(c)));
        setProgress({
          done: total - (res.remaining ?? 0),
          total,
          last: made[made.length - 1],
        });
        if (res.done) break;
      }

      if (failures.length) {
        toast.error(`${failures[0].index} on ${failures[0].table} could not be created — ${failures[0].error}`);
      } else if (madeOk) {
        toast.success(`${madeOk} ${madeOk === 1 ? 'index' : 'indexes'} created. This page should be fast now.`);
      }
      onDone?.();
    } catch (e) {
      toast.error(e.message || 'Could not create the indexes');
      onDone?.();           // whatever DID land should be reflected
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const tables = [...new Set(missing.map((m) => m.table))];

  return (
    <div className="pm-rise mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3.5">
      <div className="flex flex-wrap items-start gap-3">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-amber-900">
            {missing.length} database {missing.length === 1 ? 'index is' : 'indexes are'} missing — the numbers
            below are paused until they exist.
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-amber-800">
            Every counter on this page filters by a date range first. With no index on that date column each one
            reads the whole of {tables.slice(0, 3).join(', ')}
            {tables.length > 3 ? ` and ${tables.length - 3} more` : ''}, which is why requests were timing out
            after thirty seconds. Running them anyway would just be ten full table scans that all fail, so the page
            waits instead. Creating the indexes is a one-off; on large tables it takes a few minutes.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="pm-chip rounded-lg bg-amber-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create indexes'}
          </button>
          {!forced && (
            <button
              type="button"
              onClick={onLoadAnyway}
              className="pm-chip rounded-lg px-2 py-1.5 text-[12px] font-medium text-amber-700 hover:bg-amber-100"
            >
              Load anyway
            </button>
          )}
        </div>
      </div>
      {busy && (
        <div className="mt-2.5 border-t border-amber-200 pt-2.5">
          <p className="text-[11px] text-amber-800">
            {progress
              ? <>Created {progress.done} of {progress.total} — last: <code className="rounded bg-amber-100 px-1">{progress.last?.index}</code> on {progress.last?.table}{progress.last?.ms ? ` (${(progress.last.ms / 1000).toFixed(1)}s)` : ''}</>
              : 'Starting…'}
          </p>
          <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-amber-200">
            <span
              className="block h-full rounded-full bg-amber-600 transition-[width] duration-500 ease-out"
              style={{ width: progress ? `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` : '4%' }}
            />
          </span>
          <p className="mt-1.5 text-[11px] text-amber-700">
            Each index is a separate request, so nothing is lost if one takes a while. Leave the tab open.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── degraded notices ─────────────────────────────────────────────────────
   A counter that quietly drops a filter to stay fast is a number that means
   something slightly different from what its label says. Whenever that happens
   the server says so, and it gets printed rather than swallowed. */
function DegradedNotice({ notes }) {
  const list = Object.entries(notes || {});
  if (!list.length) return null;
  return (
    <div className="pm-rise mb-4 flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <Info size={15} className="mt-0.5 shrink-0 text-slate-400" />
      <div className="min-w-0 space-y-1">
        {list.map(([k, msg]) => (
          <p key={k} className="text-[11.5px] leading-relaxed text-slate-600">{msg}</p>
        ))}
      </div>
    </div>
  );
}

/* ── tracking notice ──────────────────────────────────────────────────────
   The single most important caption on the page. Resume uploads and section
   edits have no history before instrumentation, and a chart is very good at
   making "not recorded" look like "nobody did it". */
function TrackingNotice({ since, range }) {
  if (!since) {
    return (
      <div className="pm-rise flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <Info size={15} className="mt-0.5 shrink-0 text-amber-600" />
        <p className="text-[12px] leading-relaxed text-amber-900">
          <strong className="font-semibold">Resume and section tracking is not recording yet.</strong>{' '}
          The student dashboard writes these events into <code className="rounded bg-amber-100 px-1">user_activity_log</code>.
          Until the updated dashboard is deployed and that table exists, the resume and profile-section
          counters here will stay at zero. Everything on the other tabs — applications, assignments,
          interviews, messages — is unaffected and shows full history.
        </p>
      </div>
    );
  }

  const sinceDay = String(since).slice(0, 10);
  const partial = range.start < sinceDay;

  return (
    <div
      className={`pm-rise flex items-start gap-2.5 rounded-2xl border px-4 py-3 ${
        partial ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'
      }`}
    >
      <Sparkles size={15} className={`mt-0.5 shrink-0 ${partial ? 'text-amber-600' : 'text-indigo-500'}`} />
      <p className={`text-[12px] leading-relaxed ${partial ? 'text-amber-900' : 'text-slate-600'}`}>
        <strong className="font-semibold">Resume uploads and section-by-section edits have been recorded since {fmtDate(sinceDay)}.</strong>{' '}
        {partial ? (
          <>
            This range starts before that, so the days before {fmtDate(sinceDay)} show zero because nothing
            was written down — not because nothing happened. “New profiles” and “Profiles updated” are the
            two counters that do cover the older history.
          </>
        ) : (
          <>Every day in this range is fully covered.</>
        )}
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Drawer level — a breakdown list, or the individual records at the bottom
══════════════════════════════════════════════════════════════════════════ */
function DrawerLevel({ level, boot, onDrill, onRetitle }) {
  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [dim, setDim] = useState(level.dim);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [exporting, setExporting] = useState(false);
  const rootRef = useRef(null);

  /* The whole-list figures only come back with page one (they are extra
     queries), so they are held here and survive paging through the rest. They
     reset whenever the list itself changes — a new grouping or page size. */
  const [listTotals, setListTotals] = useState({ groups: null, total: null, scaleMax: 1 });

  const metricMeta = boot?.metrics?.[level.metric];
  const dims = (metricMeta?.dims || []).filter((d) => d !== 'day' || level.range.start !== level.range.end);

  useEffect(() => { setDim(level.dim); setPage(1); }, [level.dim]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr('');
    const offset = (page - 1) * pageSize;
    const run = dim
      ? pm.breakdown(level.metric, dim, level.range, level.filters, pageSize, offset)
      : pm.rows(level.metric, level.range, level.filters, page, pageSize);
    run
      .then((d) => {
        if (!alive) return;
        const list = d.rows || [];
        setRows(list);
        setMeta(d);

        if (page === 1) {
          setListTotals({
            groups: dim ? (d.groups ?? list.length) : null,
            total: d.total ?? null,
            /* Bars are scaled against the biggest value in the WHOLE list, not
               the page. Groupings are ordered largest first, so page one's top
               row is that value — otherwise every page would redraw its own top
               row at full width and page 4 would look as busy as page 1. */
            scaleMax: Math.max(1, ...list.map((r) => r.count || 0)),
          });
        } else {
          /* The date grouping is ordered by day, not size, so a later page can
             hold a bigger value; grow the scale if it does. */
          setListTotals((t) => ({ ...t, scaleMax: Math.max(t.scaleMax, ...list.map((r) => r.count || 0)) }));
        }

        /* Back to the top of the drawer, so "next page" lands on its first row
           rather than wherever the previous page was scrolled to. */
        rootRef.current?.closest('.pm-scroll')?.scrollTo({ top: 0 });
      })
      .catch((e) => alive && setErr(e.message || 'Could not load this list'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [level.metric, level.range, level.filters, dim, page, pageSize]);

  const goPage = (n) => setPage(Math.max(1, n));
  const changePageSize = (s) => { setPageSize(s); setPage(1); };
  const pagerTotal = dim ? listTotals.groups : listTotals.total;

  /* Export pulls a fresh, larger page rather than writing out what is on
     screen — the point of an export is the whole list, not the first hundred. */
  const exportCsv = async () => {
    setExporting(true);
    try {
      if (dim) {
        const d = await pm.breakdown(level.metric, dim, level.range, level.filters, 20000);
        const csv = toCsv(d.rows || [], [
          { label: dimLabel(dim), get: (r) => (dim === 'section' ? sectionLabel(r.id) : r.label) },
          /* `extra` carries a company logo URL on the company grouping and a
             human detail everywhere else; a column of image URLs is noise in a
             spreadsheet, so it only travels when it is the latter. */
          { label: 'Detail', get: (r) => (isUrl(r.extra) ? '' : r.extra ?? '') },
          { label: 'Count', get: (r) => r.count },
        ]);
        downloadCsv(`${level.metric}_by_${dim}_${stamp()}.csv`, csv);
      } else {
        const d = await pm.rows(level.metric, level.range, level.filters, 1, 5000);
        const cols = leafColumns(level.metric, metricMeta);
        const csv = toCsv(d.rows || [], cols.filter((c) => c.csv !== false).map((c) => ({
          label: c.label, get: (r) => c.csvGet ? c.csvGet(r) : r[c.key] ?? '',
        })));
        downloadCsv(`${level.metric}_records_${stamp()}.csv`, csv);
      }
      toast.success('Downloaded');
    } catch (e) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (err) return <ErrorState text={err} />;

  /* Whole-list figures, never the page's — "171 resumes across 154 learners"
     has to stay true on page 5. */
  const summaryBits = [
    rangeLabel(level.range),
    dim
      ? `${fmtNum(listTotals.total ?? meta?.sum ?? 0)} ${(metricMeta?.label || '').toLowerCase()} across ${fmtNum(listTotals.groups ?? rows?.length ?? 0)} ${dimLabel(dim).toLowerCase()}${(listTotals.groups ?? 0) === 1 ? '' : 's'}`
      : listTotals.total !== null
      ? `${fmtNum(listTotals.total)} records`
      : `${fmtNum(rows?.length || 0)} records on this page`,
  ];

  return (
    <div ref={rootRef} className="pm-fade p-4">
      {/* toolbar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] text-slate-600">{summaryBits.join(' · ')}</p>
          {metricMeta?.hint && <p className="mt-0.5 max-w-3xl text-[11px] leading-relaxed text-slate-400">{metricMeta.hint}</p>}
        </div>
        <div className="flex items-center gap-2">
          {dims.length > 1 && (
            <span className="flex items-center gap-1.5">
              <span className="text-[10.5px] uppercase tracking-wide text-slate-400">Group by</span>
              <select
                value={dim || ''}
                onChange={(e) => {
                  const next = e.target.value || null;
                  setDim(next);
                  setPage(1);
                  setRows(null);   // different columns — do not dim the old table under the new ones
                  setListTotals({ groups: null, total: null, scaleMax: 1 });
                  onRetitle?.(level.id, {
                    subtitle: `${rangeLabel(level.range)} · ${next ? `grouped by ${dimLabel(next).toLowerCase()}` : 'individual records'}`,
                  });
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-700 outline-none focus:border-indigo-400"
              >
                {dims.map((d) => <option key={d} value={d}>{dimLabel(d)}</option>)}
                <option value="">Individual records</option>
              </select>
            </span>
          )}
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting || loading}
            className="pm-chip flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
          >
            <Download size={13} className={exporting ? 'animate-pulse' : ''} />
            {exporting ? 'Preparing…' : 'Export CSV'}
          </button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {dim ? (
          <>
          <DataTable
            loading={loading}
            busy={loading && !!rows?.length}
            maxBar={listTotals.scaleMax}
            rows={(rows || []).map((r) => ({ ...r, __key: String(r.id) }))}
            columns={breakdownColumns(dim)}
            empty="Nothing in this range with these filters"
            onRowClick={
              nextDim(dim, dims)
                ? (r) =>
                    onDrill({
                      crumb: dim === 'section' ? sectionLabel(r.id) : String(r.label),
                      title: dim === 'section' ? sectionLabel(r.id) : String(r.label),
                      subtitle: `${metricMeta?.label} · grouped by ${dimLabel(nextDim(dim, dims)).toLowerCase()}`,
                      metric: level.metric,
                      dim: nextDim(dim, dims),
                      filters:
                        dim === 'day'
                          ? level.filters
                          : { ...level.filters, ...dimFilter(dim, r) },
                      range: dim === 'day' ? { start: r.id, end: r.id } : level.range,
                    })
                : undefined
            }
          />
          {!!rows?.length && (
            <Pager
              page={page} pageSize={pageSize} total={pagerTotal} hasMore={meta?.more}
              busy={loading} onPage={goPage} onPageSize={changePageSize}
            />
          )}
          </>
        ) : (
          <>
            <DataTable
              loading={loading}
              busy={loading && !!rows?.length}
              rows={(rows || []).map((r, i) => ({ ...r, __key: `${r.row_key ?? i}-${i}` }))}
              columns={leafColumns(level.metric, metricMeta)}
              empty="No individual records in this range"
            />
            {!!rows?.length && (
              <Pager
                page={page} pageSize={pageSize} total={pagerTotal} hasMore={meta?.more}
                busy={loading} onPage={goPage} onPageSize={changePageSize}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}

/* ── column sets ──────────────────────────────────────────────────────── */
function breakdownColumns(dim) {
  const label = {
    key: 'label',
    label: dimLabel(dim),
    render: (r) => (
      <span className="flex items-center gap-2">
        {r.extra && dim === 'employer' && isUrl(r.extra) && (
          <img src={r.extra} alt="" className="h-6 w-6 shrink-0 rounded-md object-cover ring-1 ring-slate-200" />
        )}
        <span className="min-w-0">
          <span className="block truncate font-medium text-slate-800">
            {dim === 'section' ? sectionLabel(r.id) : dim === 'day' ? fmtDate(r.label) : r.label}
          </span>
          {r.extra && !isUrl(r.extra) && (
            <span className="block truncate text-[11px] text-slate-400">{r.extra}</span>
          )}
        </span>
      </span>
    ),
  };
  const cols = [label];
  if (dim === 'job' || dim === 'user') {
    cols.push({
      key: 'extra2',
      label: dim === 'user' ? 'Phone' : 'Type',
      render: (r) => <span className="text-[11.5px] text-slate-500">{r.extra2 || '—'}</span>,
    });
  }
  cols.push({
    key: 'count',
    label: 'Count',
    align: 'right',
    width: 200,
    render: (r, max) => <BarCell value={r.count} max={max} fmt={fmtNum} />,
  });
  return cols;
}

function leafColumns(metric, metricMeta) {
  const has = (k) => (metricMeta?.dims || []).includes(k);
  const cols = [
    {
      key: 'occurred_at',
      label: 'When',
      width: 165,
      render: (r) => <span className="whitespace-nowrap text-slate-600">{fmtDateTime(r.occurred_at)}</span>,
      csvGet: (r) => r.occurred_at,
    },
  ];

  if (has('user')) {
    cols.push({
      key: 'user_name',
      label: 'Learner',
      render: (r) => (
        <span className="min-w-0">
          <Link
            to={`/students/view/${r.user_id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline"
          >
            {r.user_name}
            <ExternalLink size={11} className="opacity-60" />
          </Link>
          <span className="block truncate text-[11px] text-slate-400">{r.user_email || r.user_phone || `#${r.user_id}`}</span>
        </span>
      ),
      csvGet: (r) => r.user_name,
    });
    cols.push({ key: 'user_email', label: 'Email', render: (r) => <span className="text-[11.5px] text-slate-500">{r.user_email || '—'}</span> });
    cols.push({ key: 'user_phone', label: 'Phone', render: (r) => <span className="text-[11.5px] text-slate-500">{r.user_phone || '—'}</span> });
  }

  if (has('section')) {
    cols.push({
      key: 'section',
      label: 'Section',
      render: (r) => <Badge tone="indigo">{sectionLabel(r.section)}</Badge>,
      csvGet: (r) => sectionLabel(r.section),
    });
  }
  if (metric.startsWith('resume_')) {
    cols.push({
      key: 'replaced',
      label: 'Upload type',
      render: (r) =>
        r.replaced === undefined || r.replaced === null
          ? <span className="text-slate-400">—</span>
          : <Badge tone={String(r.replaced) === '1' ? 'amber' : 'emerald'}>
              {String(r.replaced) === '1' ? 'Replaced' : 'First upload'}
            </Badge>,
      csvGet: (r) => (String(r.replaced) === '1' ? 'Replaced' : 'First upload'),
    });
  }

  if (has('employer')) {
    cols.push({
      key: 'employer_name',
      label: 'Company',
      render: (r) => (
        <span className="flex items-center gap-2">
          {isUrl(r.employer_logo) && (
            <img src={r.employer_logo} alt="" className="h-6 w-6 shrink-0 rounded-md object-cover ring-1 ring-slate-200" />
          )}
          <span className="truncate text-slate-700">{r.employer_name || '—'}</span>
        </span>
      ),
      csvGet: (r) => r.employer_name,
    });
  }
  if (has('job')) {
    cols.push({
      key: 'job_title',
      label: 'Role',
      render: (r) => (
        <span className="min-w-0">
          <span className="block truncate text-slate-700">{r.job_title || '—'}</span>
          {r.job_type && <span className="block text-[11px] text-slate-400">{r.job_type}</span>}
        </span>
      ),
      csvGet: (r) => r.job_title,
    });
  }
  if (has('app_status')) {
    cols.push({
      key: 'application_status',
      label: 'Status',
      render: (r) => <StatusBadge value={r.application_status} />,
      csvGet: (r) => r.application_status,
    });
  }
  if (metric.startsWith('msg_')) {
    cols.push({
      key: 'message_status',
      label: 'Opened',
      render: (r) =>
        String(r.message_status) === 'read'
          ? <Badge tone="emerald">Opened</Badge>
          : <Badge tone="slate">Not opened</Badge>,
      csvGet: (r) => (String(r.message_status) === 'read' ? 'Opened' : 'Not opened'),
    });
    cols.push({
      key: 'message_text',
      label: 'Message',
      render: (r) => (
        <span className="block max-w-sm truncate text-[11.5px] text-slate-500" title={r.message_text || ''}>
          {r.message_text || (Number(r.has_attachment) ? 'Attachment only' : '—')}
        </span>
      ),
      csvGet: (r) => r.message_text,
    });
  }

  return cols;
}

const isUrl = (s) => typeof s === 'string' && /^https?:\/\//i.test(s);
