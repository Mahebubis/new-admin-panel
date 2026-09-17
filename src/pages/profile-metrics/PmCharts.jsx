/*
 * src/pages/profile-metrics/PmCharts.jsx
 *
 * The visual blocks every tab is assembled from: the stat tile, the three chart
 * shapes the data actually needs, and the breakdown list.
 *
 * Chart forms were chosen by the job the data does, not by variety:
 *   - change over time, several things at once -> stacked bars on a day axis
 *     (a day is a discrete bucket, so bars, not an area)
 *   - change over time, one or two things compared -> lines
 *   - ranking a handful of named things -> horizontal bars, sorted, labelled
 *   - a single headline -> a number, not a chart
 *
 * There is no dual-axis chart anywhere here and there will not be one: two
 * measures at different scales get two charts. The tile sparkline is the one
 * plot without a tooltip, because the tile is the tooltip.
 */
import { useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import {
  Card, CardHead, Delta, InfoDot, EmptyState,
  Skeleton, ChartTooltip, Legend, axisProps, gridProps, useCountUp,
} from './PmUi';
import { fmtNum, fmtCompact, fmtAxisDate, fmtDate, SERIES, INK } from './pmApi';

/* ── stat tile ────────────────────────────────────────────────────────────
   A headline number, what it is, how it moved against the previous window of
   the same length, and the shape it made getting there. The sparkline is
   deliberately unlabelled and unhoverable: it is there for the shape, and the
   numbers behind it are one click away in the drawer. */
/* Module-level so the count-up hook's dependency on it never changes identity. */
const DASH = () => '—';

export function StatTile({ card, color = SERIES[0], onOpen, loading, muted = false, invert = false }) {
  const valueRef = useCountUp(card?.error ? 0 : card?.total ?? 0, card?.error ? DASH : fmtNum);
  const spark = useMemo(
    () => (card?.series || []).map((p) => ({ x: p.date, y: p.value })),
    [card]
  );
  /* A single-day range gives the sparkline one point, which draws as a stray dot
     with no trend to read. Same treatment as an all-zero series: a flat rule,
     which says "nothing to plot here" instead of pretending to. */
  const flat = spark.length < 2 || spark.every((p) => p.y === 0);

  if (loading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-7 w-20" />
        <Skeleton className="mt-3 h-8 w-full" />
      </Card>
    );
  }
  if (!card) return null;

  return (
    /* The whole tile opens the breakdown, but it is NOT a <button> -- the info
       tooltip inside it is one, and a button inside a button is invalid HTML
       that browsers resolve by dropping one of them. So the click target is a
       transparent overlay beneath the header row instead: the card is clickable
       everywhere, the tooltip still takes its own clicks, and both are reachable
       from the keyboard in the order they are read. */
    <Card
      interactive={!!onOpen}
      className={`group relative w-full overflow-hidden p-4 ${muted ? 'opacity-90' : ''}`}
    >
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Break down: ${card.label}`}
          className="absolute inset-0 z-10 cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400"
        />
      )}
      {/* The accent edge is the tile's link to its colour in the charts below. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] opacity-70 transition-opacity group-hover:opacity-100"
        style={{ background: color }}
      />
      {/* The label gets the FULL width of the tile and two lines to use it. The
          delta pill used to sit beside it, which left about 100px for the name
          at five tiles to a row -- "Profile section edits" clipped to "Profile
          section…" and "Applications" to "Applicatio". It now sits next to the
          number, which is what it qualifies anyway.
          The min-height keeps every number in a row on one baseline whether its
          label ran to one line or two. */}
      <div className="relative z-20 flex min-h-[30px] items-start gap-1">
        <span className="line-clamp-2 text-[11.5px] font-medium leading-[1.25] text-slate-500">
          {card.label}
        </span>
        <span className="mt-[1px]"><InfoDot text={card.hint} /></span>
      </div>

      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        {/* No children: the count-up hook owns this text node. */}
        <p
          ref={valueRef}
          className="pm-count text-[26px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums"
        />
        {/* A counter whose query failed says so. A zero and a failed query look
            identical on screen and only one of them is a fact. */}
        {card.error ? (
          <span
            title={card.error}
            className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-[3px] text-[10.5px] font-semibold text-rose-700"
          >
            <AlertTriangle size={11} /> unavailable
          </span>
        ) : (
          <Delta value={card.delta} prev={card.prev} total={card.total} invert={invert} />
        )}
      </div>

      <p className="mt-1 text-[10.5px] text-slate-400">
        {card.error ? card.error : `${fmtNum(card.prev)} in the period before`}
      </p>

      <div className="mt-2.5 h-9">
        {flat ? (
          <div className="flex h-full items-end">
            <span className="h-[2px] w-full rounded-full bg-slate-100" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`sp-${card.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone" dataKey="y" stroke={color} strokeWidth={2}
                fill={`url(#sp-${card.key})`} isAnimationActive={false} dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {onOpen && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-3 right-3 z-20 flex items-center gap-0.5 text-[10.5px] font-medium text-indigo-500 opacity-0 transition-opacity group-hover:opacity-100"
        >
          Break down <ArrowRight size={11} />
        </span>
      )}
    </Card>
  );
}

/* ── time series ──────────────────────────────────────────────────────────
   One y-scale, always. `mode` picks bars (discrete daily buckets, the default)
   or lines (comparing two trajectories, where bars would be noise).
   Toggling the legend hides a series without changing anybody else's colour —
   colour follows the series, never its position. */
export function TrendChart({
  title, subtitle, hint, metrics = [], days = [], loading, mode: requestedMode = 'bar',
  colors = SERIES, stacked = true, height = 260, right = null, onPointClick,
}) {
  const [hidden, setHidden] = useState([]);
  const visible = metrics.filter((m) => !hidden.includes(m.key));

  const data = useMemo(() => {
    const byDay = new Map(days.map((d) => [d, { date: d }]));
    metrics.forEach((m) => {
      (m.series || []).forEach((p) => {
        const row = byDay.get(p.date);
        if (row) row[m.key] = p.value;
      });
    });
    return [...byDay.values()].map((r) => {
      metrics.forEach((m) => { if (r[m.key] === undefined) r[m.key] = 0; });
      return r;
    });
  }, [metrics, days]);

  const totals = useMemo(() => {
    const t = {};
    metrics.forEach((m) => { t[m.key] = (m.series || []).reduce((s, p) => s + p.value, 0); });
    return t;
  }, [metrics]);

  const colorOf = (k) => colors[metrics.findIndex((m) => m.key === k) % colors.length];
  const anyData = metrics.some((m) => (m.series || []).some((p) => p.value > 0));

  /* One day in range means one point per series, and a line through one point is
     not a line — it renders as a couple of stray dots floating in an empty plot.
     Bars show the same single day as something you can actually read and compare.
     Matters because Today is the default range. */
  const mode = days.length < 2 ? 'bar' : requestedMode;

  return (
    <Card className="overflow-hidden">
      <CardHead title={title} subtitle={subtitle} hint={hint} right={right} />
      <div className="px-4 pb-2 pt-3">
        {/* Legend above the plot and always present for two or more series: it
            is the only thing that makes identity readable without colour. */}
        {metrics.length > 1 && (
          <div className="mb-2 px-1">
            <Legend
              items={metrics.map((m) => ({
                key: m.key, label: m.label, color: colorOf(m.key), value: fmtNum(totals[m.key]),
              }))}
              active={metrics.filter((m) => !hidden.includes(m.key)).map((m) => m.key)}
              onToggle={(k) =>
                setHidden((h) => {
                  const next = h.includes(k) ? h.filter((x) => x !== k) : [...h, k];
                  /* Never let the last series be switched off — an empty plot
                     looks like missing data rather than a hidden series. */
                  return next.length >= metrics.length ? h : next;
                })
              }
            />
          </div>
        )}

        {loading ? (
          <Skeleton className="w-full" style={{ height }} />
        ) : !anyData ? (
          <div style={{ height }} className="flex items-center">
            <EmptyState text="No activity in this range" sub="Try a wider date range, or clear a filter." />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            {mode === 'line' ? (
              <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} tickFormatter={fmtAxisDate} minTickGap={22} />
                <YAxis {...axisProps} tickFormatter={fmtCompact} width={46} allowDecimals={false} />
                <Tooltip
                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                  content={<ChartTooltip labelFmt={fmtDate} valueFmt={fmtNum} />}
                />
                {visible.map((m) => (
                  <Line
                    key={m.key} type="monotone" dataKey={m.key} name={m.label}
                    stroke={colorOf(m.key)} strokeWidth={2} dot={false}
                    activeDot={{ r: 4.5, strokeWidth: 2, stroke: INK.surface }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            ) : (
              <BarChart
                data={data}
                margin={{ top: 6, right: 8, bottom: 0, left: -18 }}
                onClick={
                  onPointClick
                    ? (e) => e?.activeLabel && onPointClick(e.activeLabel)
                    : undefined
                }
              >
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} tickFormatter={fmtAxisDate} minTickGap={22} />
                <YAxis {...axisProps} tickFormatter={fmtCompact} width={46} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,.12)' }}
                  content={<ChartTooltip labelFmt={fmtDate} valueFmt={fmtNum} />}
                />
                {visible.map((m, i) => (
                  <Bar
                    key={m.key}
                    dataKey={m.key}
                    name={m.label}
                    stackId={stacked ? 'a' : undefined}
                    fill={colorOf(m.key)}
                    /* A 2px stroke in the surface colour is the gap between
                       stacked segments — without it two adjacent fills read as
                       one block for anyone who cannot separate the hues. */
                    stroke={stacked ? INK.surface : undefined}
                    strokeWidth={stacked ? 2 : 0}
                    radius={i === visible.length - 1 ? [4, 4, 0, 0] : 0}
                    maxBarSize={38}
                    isAnimationActive={false}
                    cursor={onPointClick ? 'pointer' : undefined}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
        {onPointClick && anyData && !loading && (
          <p className="px-1 pb-1 pt-1.5 text-[10.5px] text-slate-400">Click a day to open it.</p>
        )}
      </div>
    </Card>
  );
}

/* ── ranked breakdown ─────────────────────────────────────────────────────
   Horizontal bars because the labels are names — company names, section names
   — and a name reads left-to-right, not rotated under a vertical bar. Sorted
   by value, every bar directly labelled, one sequential hue: these are one
   quantity measured across many things, not many different things. */
export function BreakdownCard({
  title, subtitle, hint, rows = [], loading, color = SERIES[0],
  labelFmt = (r) => r.label, limit = 8, onRowClick, onViewAll, emptyText = 'Nothing in this range',
  total, groups, error,
}) {
  const top = rows.slice(0, limit);
  const max = Math.max(1, ...top.map((r) => r.count));
  /* The card is sent only the first page of the list, so percentages and the
     "View all N" count come from the server's whole-list figures. The length of
     `rows` stopped being the number of companies when it got capped. */
  const sum = total ?? rows.reduce((s, r) => s + r.count, 0);
  const groupCount = groups ?? rows.length;

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHead
        title={title}
        subtitle={subtitle}
        hint={hint}
        right={
          onViewAll && groupCount > limit ? (
            <button
              type="button"
              onClick={onViewAll}
              className="pm-chip rounded-lg px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
            >
              View all {groupCount.toLocaleString('en-IN')}
            </button>
          ) : null
        }
      />
      <div className="flex-1 px-4 py-3">
        {loading ? (
          <div className="space-y-3 py-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
          </div>
        ) : error ? (
          <EmptyState icon={AlertTriangle} text="This list could not be loaded" sub={error} />
        ) : top.length === 0 ? (
          <EmptyState text={emptyText} />
        ) : (
          <ul className="space-y-1">
            {top.map((r) => {
              const pct = sum > 0 ? (r.count / sum) * 100 : 0;
              return (
                <li key={String(r.id)}>
                  <button
                    type="button"
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                    disabled={!onRowClick}
                    className={`pm-row group flex w-full items-center gap-3 rounded-lg px-2 py-[7px] text-left ${
                      onRowClick ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] text-slate-700 group-hover:text-slate-900">
                        {labelFmt(r)}
                      </span>
                      <span className="relative mt-1 block h-[6px] w-full overflow-hidden rounded-full bg-slate-100">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
                          style={{ width: `${Math.max(2, (r.count / max) * 100)}%`, background: color }}
                        />
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[12.5px] font-semibold tabular-nums text-slate-900">
                        {fmtNum(r.count)}
                      </span>
                      <span className="block text-[10px] tabular-nums text-slate-400">{pct.toFixed(1)}%</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

/* ── read / not-read ──────────────────────────────────────────────────────
   Two states of one thing, so this is a share, not a comparison of two
   categories: one bar, split, with both halves labelled in words. A donut was
   the alternative and loses — comparing two arc lengths is harder than
   comparing two lengths on a line, and the percentage is the whole point. */
export function ReadSplit({ title, subtitle, hint, sent, read, unread, loading, onOpen, colorRead, colorUnread }) {
  const total = sent || 0;
  const pct = total > 0 ? (read / total) * 100 : 0;

  return (
    <Card className="overflow-hidden">
      <CardHead title={title} subtitle={subtitle} hint={hint} />
      <div className="px-5 py-4">
        {loading ? (
          <>
            <Skeleton className="h-8 w-28" />
            <Skeleton className="mt-4 h-4 w-full" />
          </>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[26px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums">
                  {fmtNum(total)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">messages sent in this range</p>
              </div>
              <div className="text-right">
                <p className="text-[19px] font-semibold leading-none text-slate-900 tabular-nums">
                  {total > 0 ? `${pct.toFixed(1)}%` : '—'}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">opened</p>
              </div>
            </div>

            <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
              {read > 0 && (
                <span
                  className="h-full transition-[width] duration-500 ease-out"
                  style={{ width: `${pct}%`, background: colorRead, marginRight: unread > 0 ? 2 : 0 }}
                  title={`Opened: ${fmtNum(read)}`}
                />
              )}
              {unread > 0 && (
                <span
                  className="h-full flex-1 transition-[width] duration-500 ease-out"
                  style={{ background: colorUnread }}
                  title={`Not opened: ${fmtNum(unread)}`}
                />
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onOpen ? () => onOpen('read') : undefined}
                className="pm-row flex items-center gap-2 rounded-lg px-2 py-1.5 text-left"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: colorRead }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-slate-500">Opened</span>
                  <span className="block text-[13px] font-semibold tabular-nums text-slate-900">{fmtNum(read)}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={onOpen ? () => onOpen('unread') : undefined}
                className="pm-row flex items-center gap-2 rounded-lg px-2 py-1.5 text-left"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] ring-1 ring-inset ring-slate-300" style={{ background: colorUnread }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-slate-500">Not opened yet</span>
                  <span className="block text-[13px] font-semibold tabular-nums text-slate-900">{fmtNum(unread)}</span>
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

/* ── composition donut ────────────────────────────────────────────────────
   Strictly part-to-whole: the slices are the pieces of one total, never a set
   of unrelated counters. That rules out putting the tile row in here — you
   cannot add applications to messages to new profiles and call the sum
   anything — so each tab hands this the one breakdown that genuinely sums.

   Two rules it keeps:
     - At most six slices. Everything past the fifth is rolled into "Other"
       rather than given a seventh colour, because adjacent hues blur past
       about seven classes and a ring makes neighbours of the first and last.
     - Never two slices. A share of a whole with one cut is a meter or a stat
       tile; there is a ReadSplit above for exactly that, and drawing it as a
       circle makes it harder to read, not easier.

   The legend carries the value AND the percentage for every slice. That is the
   direct labelling the low-contrast steps in the palette owe the reader, and it
   doubles as the table view — so nothing here depends on telling two colours
   apart. */
export function CompositionCard({
  title, subtitle, hint, rows = [], loading, total,
  labelFmt = (r) => r.label, onSliceClick, emptyText = 'Nothing in this range', height = 210,
}) {
  const slices = useMemo(() => {
    const sorted = [...rows].filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
    const listSum = sorted.reduce((s, r) => s + r.count, 0);
    /* Only the first page of the list is sent. When the server's total is
       bigger than what arrived, the list is longer than the rows here, so the
       remainder has to become "Other" even if six or fewer rows came back —
       and it has to be sized from that total, or the ring would claim the top
       five were the whole of it. */
    const truncated = Number.isFinite(total) && total > listSum;

    if (sorted.length <= 6 && !truncated) {
      return sorted.map((r, i) => ({ ...r, color: SERIES[i % SERIES.length] }));
    }
    const head = sorted.slice(0, 5).map((r, i) => ({ ...r, color: SERIES[i] }));
    const headSum = head.reduce((s, r) => s + r.count, 0);
    const restCount = truncated ? total - headSum : sorted.slice(5).reduce((s, r) => s + r.count, 0);
    if (restCount <= 0) return head;
    return [
      ...head,
      { id: '__other__', label: 'Other', count: restCount, color: '#94a3b8', isOther: true },
    ];
  }, [rows, total]);

  const sum = total ?? slices.reduce((s, r) => s + r.count, 0);

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHead title={title} subtitle={subtitle} hint={hint} />
      <div className="flex flex-1 flex-col px-4 py-3">
        {loading ? (
          <>
            <Skeleton className="mx-auto h-[150px] w-[150px] rounded-full" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-3.5 w-full" />)}
            </div>
          </>
        ) : !slices.length ? (
          <EmptyState text={emptyText} />
        ) : (
          <>
            <div className="relative" style={{ height }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="count"
                    nameKey="label"
                    innerRadius="58%"
                    outerRadius="88%"
                    paddingAngle={2}
                    /* The 2px surface ring is the gap between segments: without
                       it two adjacent fills read as one wedge. */
                    stroke={INK.surface}
                    strokeWidth={2}
                    isAnimationActive={false}
                    onClick={onSliceClick ? (d) => d?.payload && !d.payload.isOther && onSliceClick(d.payload) : undefined}
                    cursor={onSliceClick ? 'pointer' : undefined}
                  >
                    {slices.map((s) => <Cell key={String(s.id)} fill={s.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip valueFmt={fmtNum} />} />
                </PieChart>
              </ResponsiveContainer>
              {/* The hole is the total it is a composition of, which is the one
                  number a ring cannot show. */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[20px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums">
                  {fmtNum(sum)}
                </span>
                <span className="mt-0.5 text-[10px] text-slate-400">total</span>
              </div>
            </div>

            <ul className="mt-3 space-y-0.5">
              {slices.map((s) => {
                const pct = sum > 0 ? (s.count / sum) * 100 : 0;
                const clickable = onSliceClick && !s.isOther;
                return (
                  <li key={String(s.id)}>
                    <button
                      type="button"
                      onClick={clickable ? () => onSliceClick(s) : undefined}
                      disabled={!clickable}
                      className={`pm-row flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left ${
                        clickable ? 'cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
                      <span className="min-w-0 flex-1 truncate text-[11.5px] text-slate-600">{labelFmt(s)}</span>
                      <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-slate-800">
                        {fmtNum(s.count)}
                      </span>
                      <span className="w-11 shrink-0 text-right text-[10.5px] tabular-nums text-slate-400">
                        {pct.toFixed(1)}%
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}

/* ── conversion strip ─────────────────────────────────────────────────────
   Two counts and the rate between them — a hero number, not a chart. Used for
   "assignments sent -> submitted", where a two-bar chart would be a picture of
   a fraction. */
export function RateCard({ title, hint, numerator, denominator, numLabel, denLabel, loading, tone = SERIES[2] }) {
  const rate = denominator > 0 ? (numerator / denominator) * 100 : null;
  return (
    <Card className="overflow-hidden">
      <CardHead title={title} hint={hint} />
      <div className="px-5 py-4">
        {loading ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <>
            <p className="text-[30px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums">
              {rate === null ? '—' : `${rate.toFixed(1)}%`}
            </p>
            <p className="mt-1.5 text-[11.5px] text-slate-500">
              {fmtNum(numerator)} {numLabel} out of {fmtNum(denominator)} {denLabel}
            </p>
            <span className="mt-3 block h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <span
                className="block h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${Math.min(100, rate || 0)}%`, background: tone }}
              />
            </span>
          </>
        )}
      </div>
    </Card>
  );
}
