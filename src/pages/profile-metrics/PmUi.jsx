/*
 * src/pages/profile-metrics/PmUi.jsx
 *
 * The pieces the metrics page is built from. They live here rather than inline
 * because the page's whole premise is that a number looks the same everywhere
 * it appears -- on a tile, in a chart legend, in a drawer three levels down --
 * and that only holds if there is one card, one table and one drawer.
 *
 * The motion is deliberate and small: 180-260ms, ease-out, and every animation
 * is a transform or an opacity so it stays off the layout thread. Anything
 * slower reads as lag on a page whose job is to answer a question quickly.
 * `prefers-reduced-motion` collapses all of it to a fade.
 */
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ChevronRight, Info, Search, Check, ArrowUpRight, ArrowDownRight,
  Minus, Inbox, AlertCircle, ChevronLeft,
} from 'lucide-react';
import { INK } from './pmApi';

/* ── one stylesheet, injected once ────────────────────────────────────────
   Keyframes and the few selectors Tailwind utilities cannot express (a custom
   scrollbar, a shimmer). Injected rather than added to index.css so the whole
   feature stays in its own folder and nothing else in the panel changes. */
const CSS = `
@keyframes pm-fade      { from { opacity: 0 } to { opacity: 1 } }
@keyframes pm-slide-in  { from { transform: translateX(100%) } to { transform: translateX(0) } }
@keyframes pm-rise      { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
@keyframes pm-pop       { from { opacity: 0; transform: scale(.96) } to { opacity: 1; transform: scale(1) } }
@keyframes pm-shimmer   { from { background-position: -420px 0 } to { background-position: 420px 0 } }
@keyframes pm-count     { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }

.pm-fade     { animation: pm-fade .2s ease-out both }
.pm-rise     { animation: pm-rise .26s cubic-bezier(.22,1,.36,1) both }
.pm-pop      { animation: pm-pop .18s cubic-bezier(.22,1,.36,1) both }
.pm-slide    { animation: pm-slide-in .26s cubic-bezier(.22,1,.36,1) both }
.pm-count    { animation: pm-count .32s cubic-bezier(.22,1,.36,1) both }

.pm-shimmer {
  background: linear-gradient(90deg, #f1f5f9 8%, #e2e8f0 18%, #f1f5f9 33%);
  background-size: 840px 100%;
  animation: pm-shimmer 1.3s linear infinite;
}

/* A card lifts a little on hover and settles back down on press -- the whole
   affordance for "this number opens something". */
.pm-card { transition: box-shadow .2s ease, transform .2s ease, border-color .2s ease }
.pm-card-i:hover { transform: translateY(-2px); box-shadow: 0 12px 28px -12px rgba(15,23,42,.22); border-color: #c7d2fe }
.pm-card-i:active { transform: translateY(0); box-shadow: 0 2px 8px -4px rgba(15,23,42,.2) }

.pm-row { transition: background-color .14s ease }
.pm-row:hover { background: #f8fafc }
.pm-row:active { background: #f1f5f9 }

.pm-chip { transition: background-color .16s ease, color .16s ease, box-shadow .16s ease, transform .12s ease }
.pm-chip:active { transform: scale(.97) }

.pm-scroll::-webkit-scrollbar { width: 10px; height: 10px }
.pm-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 9999px; border: 3px solid transparent; background-clip: content-box }
.pm-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; background-clip: content-box }
.pm-scroll::-webkit-scrollbar-track { background: transparent }

@media (prefers-reduced-motion: reduce) {
  .pm-rise, .pm-pop, .pm-slide, .pm-count { animation: pm-fade .12s ease-out both }
  .pm-card-i:hover { transform: none }
  .pm-shimmer { animation: none }
}
`;

export function PmStyles() {
  useLayoutEffect(() => {
    if (document.getElementById('pm-styles')) return;
    const el = document.createElement('style');
    el.id = 'pm-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
  return null;
}

/* ── card ─────────────────────────────────────────────────────────────── */
export function Card({ children, className = '', interactive = false, as: Tag = 'div', ...rest }) {
  return (
    <Tag
      className={`pm-card rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,.04)] ${
        interactive ? 'pm-card-i cursor-pointer text-left' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function CardHead({ title, subtitle, hint, right }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-[13.5px] font-semibold tracking-tight text-slate-800">{title}</h3>
          {hint && <InfoDot text={hint} />}
        </div>
        {subtitle && <p className="mt-0.5 truncate text-[11.5px] text-slate-500">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/* ── info tooltip ─────────────────────────────────────────────────────────
   Every counter on this page is a decision about what to count. The tooltip is
   where that decision is written down, in the words a non-technical reader
   would use, so nobody has to ask what "profiles updated" means. */
export function InfoDot({ text }) {
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  /*
   * Rendered into document.body rather than next to the icon.
   *
   * These sit inside stat tiles and card headers, which are `overflow-hidden` so
   * the accent bar and the rounded corners clip cleanly — and that clipped the
   * tooltip too, leaving a dark sliver at the top edge of the card with the text
   * cut off. Any ancestor with overflow, a transform, or a lower stacking
   * context does the same thing, and on a page made of cards there is always
   * one. A portal has no ancestors to be clipped by.
   *
   * Position is measured from the trigger at open time and fixed to the
   * viewport: above when there is room, below when there is not, and clamped so
   * an icon at the right edge of the screen does not push the box off it.
   */
  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const W = 264;                       // matches the width below
    const margin = 10;
    const above = r.top > 150;
    const left = Math.min(
      Math.max(margin, r.left + r.width / 2 - W / 2),
      window.innerWidth - W - margin
    );
    setPos({ left, top: above ? r.top - 8 : r.bottom + 8, above });
  }, []);

  /* Scrolling or resizing while it is open would leave the box behind, so it
     closes rather than chasing the icon. */
  useEffect(() => {
    if (!pos) return undefined;
    const close = () => setPos(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  if (!text) return null;

  return (
    <>
      <span
        ref={ref}
        className="inline-flex shrink-0"
        onMouseEnter={place}
        onMouseLeave={() => setPos(null)}
      >
        <button
          type="button"
          aria-label="What this counts"
          className="text-slate-300 transition-colors hover:text-indigo-500 focus:text-indigo-500 focus:outline-none"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); pos ? setPos(null) : place(); }}
          onFocus={place}
          onBlur={() => setPos(null)}
        >
          <Info size={13} />
        </button>
      </span>
      {pos && createPortal(
        <span
          role="tooltip"
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            width: 264,
            transform: pos.above ? 'translateY(-100%)' : undefined,
          }}
          className="pm-pop pointer-events-none z-[2000] block rounded-xl bg-slate-900 px-3 py-2 text-[11.5px] font-normal leading-relaxed text-slate-100 shadow-xl"
        >
          {text}
        </span>,
        document.body
      )}
    </>
  );
}

/* ── delta pill ───────────────────────────────────────────────────────────
   Against the equal-length window immediately before the one on screen. A null
   delta means the previous window was empty, where a percentage would be a
   division by zero dressed up as insight -- so it says "new" instead. */
export function Delta({ value, prev, total, invert = false }) {
  if (value === null || value === undefined) {
    /* A null delta means the previous window was empty. That is "new" only if
       something happened in THIS window too — nothing-then-nothing is a quiet
       fortnight, and calling it new is just wrong. */
    if (!total) {
      return <span className="px-1 text-[11px] font-medium text-slate-300">—</span>;
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-[3px] text-[10.5px] font-semibold text-indigo-600">
        new
      </span>
    );
  }
  const flat = Math.abs(value) < 0.05;
  const up = value > 0;
  const good = invert ? !up : up;
  const cls = flat
    ? 'bg-slate-100 text-slate-500'
    : good
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-rose-50 text-rose-700';
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-[3px] text-[10.5px] font-semibold ${cls}`}
      title={`Previous period: ${Number(prev || 0).toLocaleString('en-IN')}`}
    >
      <Icon size={11} strokeWidth={2.6} />
      {flat ? '0%' : `${Math.abs(value).toFixed(1)}%`}
    </span>
  );
}

/* ── segmented control ────────────────────────────────────────────────── */
export function Segmented({ options, value, onChange, size = 'md' }) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-[11.5px]' : 'px-3.5 py-1.5 text-[12.5px]';
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`pm-chip rounded-lg font-medium ${pad} ${
              on ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── multi-select ─────────────────────────────────────────────────────────
   Company lists run to thousands of rows, so this filters as you type and only
   ever renders the first 200 matches -- a dropdown that stutters is a dropdown
   nobody uses. */
export function MultiSelect({ label, options, value = [], onChange, placeholder = 'All', icon = null, width = 'w-56' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const sel = new Set(value.map(String));
  const needle = q.trim().toLowerCase();
  const shown = (needle
    ? options.filter((o) => String(o.label).toLowerCase().includes(needle))
    : options
  ).slice(0, 200);

  const toggle = (id) => {
    const k = String(id);
    const next = sel.has(k) ? value.filter((v) => String(v) !== k) : [...value, id];
    onChange(next);
  };

  const summary = value.length === 0
    ? placeholder
    : value.length === 1
    ? (options.find((o) => String(o.id) === String(value[0]))?.label ?? `1 selected`)
    : `${value.length} selected`;

  return (
    <div ref={box} className={`relative ${width}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`pm-chip flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-[12.5px] ${
          value.length
            ? 'border-indigo-200 bg-indigo-50/60 text-indigo-800'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
        }`}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">
          <span className="text-[10.5px] uppercase tracking-wide text-slate-400">{label}</span>
          <span className="block truncate font-medium">{summary}</span>
        </span>
        <ChevronRight size={13} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="pm-pop absolute z-40 mt-2 w-full min-w-[260px] origin-top rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search size={13} className="shrink-0 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type to filter…"
              className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-slate-400"
            />
            {value.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>
          <div className="pm-scroll max-h-64 overflow-y-auto py-1">
            {shown.length === 0 && (
              <p className="px-3 py-6 text-center text-[12px] text-slate-400">Nothing matches “{q}”</p>
            )}
            {shown.map((o) => {
              const on = sel.has(String(o.id));
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(o.id)}
                  className="pm-row flex w-full items-center gap-2.5 px-3 py-1.5 text-left"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {on && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-700">{o.label}</span>
                  {o.meta !== undefined && (
                    <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{o.meta}</span>
                  )}
                </button>
              );
            })}
            {!needle && options.length > shown.length && (
              <p className="px-3 py-2 text-center text-[11px] text-slate-400">
                {options.length - shown.length} more — type to narrow
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── drawer stack ─────────────────────────────────────────────────────────
   Levels stack rather than replace: the breadcrumb across the top is the path
   the reader took to get here (Applications -> Infosys -> Backend Intern), and
   Back is one step up it, not a reset to the page.
   The whole stack is one portal with one backdrop, so three levels deep is
   still one dimming layer, not three.
   Escape closes the top level; the browser Back button is left alone, because
   this is a lens on the page, not a new page. */
export function DrawerStack({ levels, onPop, onClose, renderLevel }) {
  const open = levels.length > 0;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onPop(); } };
    document.addEventListener('keydown', onKey);
    /* The page behind must not scroll under the drawer. Restoring the exact
       previous value (rather than setting '') keeps any other lock intact. */
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onPop]);

  if (!open) return null;

  const top = levels.length - 1;

  return createPortal(
    /* Above AdminLayout's own chrome, which stacks its sticky navbar at z-400
       and the account menu at z-999. At anything lower the drawer opens
       *underneath* the panel's top bar and loses its first 60px. */
    <div className="fixed inset-0 z-[1200]">
      {/* Dim only, no blur. A backdrop-filter over the entire page forces the
          browser to re-blur everything behind the drawer whenever anything in
          front of it repaints — every scroll step and hover in a long list — and
          on an integrated GPU that alone is visible lag. */}
      <div className="pm-fade absolute inset-0 bg-slate-900/45" onClick={onClose} />
      {levels.map((lv, i) => {
        /* Lower levels stay mounted and slide left behind the top one, so
           going back is instant and scroll position is where it was left. */
        const depth = top - i;
        if (depth > 2) return null;
        return (
          <section
            key={lv.id}
            aria-hidden={depth > 0}
            className="pm-slide absolute inset-y-0 right-0 flex w-full max-w-[min(1120px,94vw)] flex-col bg-slate-50 shadow-2xl"
            style={{
              transform: depth ? `translateX(${-depth * 26}px) scale(${1 - depth * 0.018})` : undefined,
              transition: 'transform .26s cubic-bezier(.22,1,.36,1)',
              zIndex: 10 + i,
              pointerEvents: depth ? 'none' : 'auto',
            }}
          >
            {/* The "pushed back" shade on a lower level. A translucent layer on
                top instead of `filter: brightness()` on the whole panel: a filter
                makes the browser re-rasterise the entire level, table and all,
                while an overlay is a single composited rectangle. */}
            {depth > 0 && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-20 bg-slate-900"
                style={{ opacity: depth * 0.06 }}
              />
            )}
            <header className="flex items-start gap-3 border-b border-slate-200 bg-white px-5 py-3.5">
              {levels.length > 1 && (
                <button
                  type="button"
                  onClick={onPop}
                  className="pm-chip mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  title="Back (Esc)"
                >
                  <ChevronLeft size={17} />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <nav className="flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
                  {levels.map((b, bi) => (
                    <span key={b.id} className="flex items-center gap-1">
                      {bi > 0 && <ChevronRight size={11} className="text-slate-300" />}
                      <span className={bi === top ? 'font-semibold text-slate-600' : ''}>{b.crumb}</span>
                    </span>
                  ))}
                </nav>
                <h2 className="mt-0.5 truncate text-[15px] font-semibold tracking-tight text-slate-900">{lv.title}</h2>
                {lv.subtitle && <p className="truncate text-[11.5px] text-slate-500">{lv.subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="pm-chip mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="Close"
              >
                <X size={17} />
              </button>
            </header>
            <div className="pm-scroll flex-1 overflow-y-auto">{renderLevel(lv, i === top)}</div>
          </section>
        );
      })}
    </div>,
    document.body
  );
}

/* ── table ────────────────────────────────────────────────────────────────
   One table for every list on the page. The bar behind each count is the
   secondary encoding the drawer owes the charts: the same magnitudes readable
   without relying on a colour difference. */
export function DataTable({ columns, rows, onRowClick, empty = 'Nothing in this range', maxBar = 0, loading = false, busy = false }) {
  /* A skeleton only for the very first load. Changing page keeps the current
     rows on screen, dimmed, until the next page lands — swapping to a skeleton
     and back unmounts and remounts every row and jumps the scroll height. */
  if (loading && !rows?.length) return <TableSkeleton cols={columns.length} />;
  if (!rows?.length) return <EmptyState text={empty} />;

  return (
    <div
      className={`overflow-x-auto transition-opacity duration-150 ${busy ? 'pointer-events-none opacity-50' : ''}`}
      aria-busy={busy || undefined}
    >
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          {/* Solid, not translucent-with-backdrop-blur: a backdrop filter on a
              sticky header is re-rasterised on every scroll frame, which is a
              large part of what made scrolling a long drawer list stutter. */}
          <tr className="sticky top-0 z-10 bg-slate-50">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`whitespace-nowrap border-b border-slate-200 px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 ${
                  c.align === 'right' ? 'text-right' : 'text-left'
                }`}
                style={c.width ? { width: c.width } : undefined}
              >
                {c.label}
              </th>
            ))}
            {onRowClick && <th className="w-10 border-b border-slate-200" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.__key ?? i}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={`border-b border-slate-100 ${onRowClick ? 'pm-row cursor-pointer' : ''}`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-4 py-2.5 align-middle ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${
                    c.className || 'text-slate-700'
                  }`}
                >
                  {c.render ? c.render(r, maxBar) : r[c.key]}
                </td>
              ))}
              {onRowClick && (
                <td className="pr-3 text-right">
                  <ChevronRight size={14} className="inline text-slate-300" />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── pager ────────────────────────────────────────────────────────────────
   Every drawer list is server-paginated. Rendering a few hundred rows at once —
   each with a bar, hover styles and a chevron — while up to two lower drawer
   levels stay mounted underneath was enough to make a laptop stutter, and none
   of those rows past the first screen were being read anyway.

   Page numbers are shown around the current page with the ends pinned, so a
   list of 40 pages is still one short line. When the total is unknown (a leaf
   listing that only knows whether there is a next page) it degrades to
   Previous / Next. */
export const PAGE_SIZES = [25, 50, 100];

export function Pager({ page, pageSize, total, hasMore, busy, onPage, onPageSize }) {
  const known = Number.isFinite(total) && total !== null;
  const pages = known ? Math.max(1, Math.ceil(total / pageSize)) : null;
  const from = (page - 1) * pageSize + 1;
  const to = known ? Math.min(total, page * pageSize) : page * pageSize;
  const canNext = known ? page < pages : !!hasMore;

  if (known && total <= pageSize && page === 1) {
    /* Everything is already on screen: say how much, offer nothing to click. */
    return (
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-[11.5px] text-slate-400">
        <span>{total === 0 ? 'No rows' : `Showing all ${total.toLocaleString('en-IN')}`}</span>
      </div>
    );
  }

  const nums = [];
  if (pages) {
    const push = (n) => nums.push(n);
    const lo = Math.max(2, page - 1);
    const hi = Math.min(pages - 1, page + 1);
    push(1);
    if (lo > 2) push('…l');
    for (let n = lo; n <= hi; n++) push(n);
    if (hi < pages - 1) push('…r');
    if (pages > 1) push(pages);
  }

  const btn = 'pm-chip min-w-[30px] rounded-lg px-2 py-1 text-[12px] font-medium tabular-nums disabled:opacity-40';

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5">
      <span className="text-[11.5px] tabular-nums text-slate-500">
        {known
          ? <>Showing <b className="font-semibold text-slate-700">{from.toLocaleString('en-IN')}–{to.toLocaleString('en-IN')}</b> of {total.toLocaleString('en-IN')}</>
          : <>Page {page}</>}
      </span>

      <div className="flex items-center gap-1">
        <button type="button" disabled={page === 1 || busy} onClick={() => onPage(page - 1)}
                className={`${btn} text-slate-600 hover:bg-slate-100`}>
          <ChevronLeft size={14} className="inline" />
        </button>
        {nums.map((n) =>
          typeof n === 'string' ? (
            <span key={n} className="px-1 text-[12px] text-slate-300">…</span>
          ) : (
            <button
              key={n}
              type="button"
              disabled={busy}
              onClick={() => n !== page && onPage(n)}
              className={`${btn} ${n === page ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {n}
            </button>
          )
        )}
        <button type="button" disabled={!canNext || busy} onClick={() => onPage(page + 1)}
                className={`${btn} text-slate-600 hover:bg-slate-100`}>
          <ChevronRight size={14} className="inline" />
        </button>

        {onPageSize && (
          <select
            value={pageSize}
            disabled={busy}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="ml-2 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[11.5px] text-slate-600 outline-none focus:border-indigo-400"
            aria-label="Rows per page"
          >
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

/** A count with its share of the largest value drawn behind it. */
export function BarCell({ value, max, color = '#4f46e5', fmt }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <span className="inline-flex w-full items-center justify-end gap-2.5">
      <span className="relative hidden h-[7px] w-24 overflow-hidden rounded-full bg-slate-100 sm:block">
        <span
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </span>
      <span className="min-w-[3.5rem] font-semibold tabular-nums text-slate-800">{fmt ? fmt(value) : value}</span>
    </span>
  );
}

export function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    indigo: 'bg-indigo-50 text-indigo-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    sky: 'bg-sky-50 text-sky-700',
  };
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

/** Application statuses use the panel's status colours, never a series hue. */
export function StatusBadge({ value }) {
  const v = String(value || '').toLowerCase();
  const tone =
    v === 'hired' || v === 'selected' ? 'emerald'
    : v === 'rejected' ? 'rose'
    : v === 'shortlisted' || v === 'interview' ? 'sky'
    : v === 'received' || v === 'submitted' ? 'indigo'
    : 'slate';
  return <Badge tone={tone}>{value || 'unknown'}</Badge>;
}

export function EmptyState({ text, sub, icon: Icon = Inbox }) {
  return (
    <div className="pm-fade flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon size={19} />
      </span>
      <p className="text-[13px] font-medium text-slate-600">{text}</p>
      {sub && <p className="max-w-sm text-[11.5px] leading-relaxed text-slate-400">{sub}</p>}
    </div>
  );
}

export function ErrorState({ text, onRetry }) {
  return (
    <div className="pm-fade flex flex-col items-center justify-center gap-2.5 px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-500">
        <AlertCircle size={19} />
      </span>
      <p className="max-w-md text-[12.5px] text-slate-600">{text}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="pm-chip rounded-lg bg-slate-900 px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-slate-700"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className = '', style }) {
  return <div className={`pm-shimmer rounded-lg ${className}`} style={style} />;
}

export function TableSkeleton({ cols = 4, rows = 6 }) {
  return (
    <div className="px-4 py-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-slate-100 py-3">
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton key={j} className={`h-3.5 ${j === 0 ? 'w-1/3' : 'w-20'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── count-up ─────────────────────────────────────────────────────────────
   The tiles roll to their new value when a filter changes. Without it a change
   from 812 to 819 is invisible and the page looks like it ignored the click.

   It writes into the DOM node rather than through state on purpose: sixty
   setState calls a second to animate one number would re-render the tile, its
   sparkline and its delta pill sixty times for a digit nobody is reading mid-
   flight. The returned ref goes on an element with NO React children, so React
   never owns that text node and the two cannot fight over it. Laid out before
   paint, so there is no empty frame, and skipped entirely under reduced motion
   or when the jump is too large for the roll to mean anything. */
export function useCountUp(target, format = (n) => String(n), duration = 420) {
  const ref = useRef(null);
  const from = useRef(target);
  const raf = useRef(0);
  const latest = useRef(target);
  latest.current = target;

  /* A callback ref, not a plain one, because the element does not exist for the
     first render or two -- the tile shows a skeleton while the numbers load. A
     plain ref would leave the effect with nothing to write to, and if the value
     then arrived UNCHANGED (a metric that is genuinely zero) the effect's
     dependencies would not have moved, it would never re-run, and the tile
     would sit there blank. Painting on attach closes that hole. */
  const attach = useCallback(
    (el) => {
      ref.current = el;
      if (el) el.textContent = format(latest.current);
    },
    [format]
  );

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const start = from.current;
    const delta = target - start;

    if (reduce || delta === 0 || Math.abs(delta) > 250000) {
      from.current = target;
      el.textContent = format(target);
      return undefined;
    }

    el.textContent = format(start);
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(Math.round(start + delta * eased));
      if (p < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        from.current = target;
        el.textContent = format(target);
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration, format]);

  return attach;
}

/** Debounce for the free-text search, so typing does not fire a query a letter. */
export function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/* ── chart chrome ─────────────────────────────────────────────────────────
   One tooltip and one legend for every chart on the page, so a series looks
   and reads the same wherever it appears. The legend is always present for two
   or more series -- identity is never carried by colour alone. */
export function ChartTooltip({ active, payload, label, labelFmt, valueFmt }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value !== null && p.value !== undefined);
  const total = rows.reduce((s, p) => s + Number(p.value || 0), 0);
  return (
    <div className="pm-pop min-w-[180px] rounded-xl border border-slate-200 bg-white/97 px-3 py-2 shadow-xl backdrop-blur">
      <p className="mb-1.5 text-[11px] font-semibold text-slate-500">{labelFmt ? labelFmt(label) : label}</p>
      {rows.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 py-[1px] text-[12px]">
          <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: p.color || p.fill }} />
          <span className="min-w-0 flex-1 truncate text-slate-600">{p.name}</span>
          <span className="font-semibold tabular-nums text-slate-900">
            {valueFmt ? valueFmt(p.value) : p.value}
          </span>
        </p>
      ))}
      {rows.length > 1 && (
        <p className="mt-1.5 flex items-center gap-2 border-t border-slate-100 pt-1.5 text-[11.5px]">
          <span className="min-w-0 flex-1 text-slate-500">Total</span>
          <span className="font-semibold tabular-nums text-slate-900">{valueFmt ? valueFmt(total) : total}</span>
        </p>
      )}
    </div>
  );
}

export function Legend({ items, active, onToggle }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((it) => {
        const off = active && !active.includes(it.key);
        return (
          <button
            key={it.key}
            type="button"
            onClick={onToggle ? () => onToggle(it.key) : undefined}
            className={`pm-chip flex items-center gap-1.5 text-[11.5px] ${
              onToggle ? 'cursor-pointer' : 'cursor-default'
            } ${off ? 'opacity-35' : ''}`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: it.color }} />
            <span className="text-slate-600">{it.label}</span>
            {it.value !== undefined && (
              <span className="font-semibold tabular-nums text-slate-800">{it.value}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* Recharts axis styling, kept in one place so grid and ticks stay recessive
   and identical on every chart. */
export const axisProps = {
  tick: { fill: INK.muted, fontSize: 10.5 },
  tickLine: false,
  axisLine: false,
};
export const gridProps = {
  stroke: INK.grid,
  strokeDasharray: '0',
  vertical: false,
};

/** Copy-to-clipboard used by the learner rows. */
export function useCopy() {
  const [copied, setCopied] = useState('');
  const copy = useCallback((text, id) => {
    try {
      navigator.clipboard?.writeText(String(text));
      setCopied(id);
      setTimeout(() => setCopied(''), 1400);
    } catch { /* clipboard blocked — the value is still selectable on screen */ }
  }, []);
  return [copied, copy];
}
