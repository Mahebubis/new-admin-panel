// ===========================================================================
//  lmsTheme.js — the Learnyst design system for the LMS section.
//
//  Everything lives under a single `.lms-root` scope so none of it leaks into
//  the rest of the admin panel (which runs on its own indigo/Inter theme).
//  Colours, radii, font sizes and the loader animation are matched to the
//  Learnyst admin-v3 console.
//
//  Components that consume these tokens live in LmsStyles.jsx.
// ===========================================================================
import { useEffect } from 'react';

export const LMS_CSS = `
.lms-root{
  /* surfaces */
  --lms-bg:#ffffff; --lms-bg-page:#fbfbfc; --lms-bg-soft:#f6f7f9; --lms-bg-row:#eef2fa;
  --lms-bg-row-hover:#e7edf9; --lms-bg-add:#e9f9ef;
  /* text */
  --lms-text:#16191d; --lms-text-2:#5b6472; --lms-text-3:#98a1ae;
  /* brand */
  --lms-green:#12b76a; --lms-green-dark:#027a48; --lms-green-soft:#ecfdf3;
  --lms-nav-active:#dff5e7; --lms-black:#101828; --lms-blue:#4a5df9; --lms-blue-soft:#eef0ff;
  --lms-amber:#f79009; --lms-amber-soft:#fffaeb; --lms-amber-dark:#b54708;
  --lms-red:#f04438; --lms-red-soft:#fef3f2; --lms-red-dark:#b42318;
  /* lines + depth */
  --lms-border:#e4e7ec; --lms-border-2:#d0d5dd;
  --lms-shadow-xs:0 1px 2px rgba(16,24,40,.05);
  --lms-shadow:0 1px 3px rgba(16,24,40,.1),0 1px 2px rgba(16,24,40,.06);
  --lms-shadow-lg:0 12px 16px -4px rgba(16,24,40,.08),0 4px 6px -2px rgba(16,24,40,.03);
  --lms-r:8px; --lms-r-lg:12px;
  font-family:'Poppins','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  font-size:14px; color:var(--lms-text); background:var(--lms-bg); -webkit-font-smoothing:antialiased;
}
.lms-root *,.lms-root *::before,.lms-root *::after{box-sizing:border-box;}
/* Every element reset is wrapped in :where() so it carries ZERO specificity.
   Written bare, '.lms-root button' is (0,1,1) and OUT-SPECIFIES a component
   class like '.lms-btn' (0,1,0) — so the reset's 'padding:0' and 'border:none'
   quietly beat the button system. That is why the primary buttons rendered as
   flush, borderless pills with the label touching the pill edge, and why the
   "Add lesson" / "Add Section" bars in the course builder collapsed into thin
   strips. The same trap made '.lms-root a' swallow the colour of
   <Link className="lms-btn lms-btn-dark">.
   With :where() the resets are a floor any class can override, and the
   '.lms-root'-scoped colour variants below keep working unchanged. */
.lms-root :where(button){font-family:inherit;cursor:pointer;border:none;background:none;color:inherit;padding:0;}
.lms-root :where(button:disabled){cursor:not-allowed;}
.lms-root :where(input,textarea,select){font-family:inherit;}
.lms-root :where(a){color:inherit;text-decoration:none;}

/* ── page scaffold ────────────────────────────────────────────── */
.lms-page{padding:28px 32px 60px;max-width:1360px;margin:0 auto;}
.lms-page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px 20px;flex-wrap:wrap;margin-bottom:24px;}
/* The title block takes the slack and its text wraps; the actions keep their
   natural size and stay pinned right. Without this the long page subtitles made
   the title block as wide as its longest line, which shoved the primary button
   onto its own row and squeezed it narrower than its own label. */
.lms-page-head > :first-child{flex:1 1 320px;min-width:0;}
.lms-page-actions{display:flex;align-items:center;gap:10px;flex:0 0 auto;margin-left:auto;flex-wrap:wrap;}
.lms-h1{font-size:26px;font-weight:600;letter-spacing:-.01em;margin:0;line-height:1.25;}
.lms-sub{font-size:13.5px;color:var(--lms-text-2);margin:5px 0 0;max-width:70ch;}
.lms-h2{font-size:17px;font-weight:600;margin:0;}
.lms-h3{font-size:14.5px;font-weight:600;margin:0;}

/* ── top tab bar (the LMS System tabs) ────────────────────────── */
.lms-tabbar{position:sticky;top:0;z-index:40;background:var(--lms-bg);border-bottom:1px solid var(--lms-border);padding:0 32px;}
.lms-tabbar-inner{display:flex;align-items:center;gap:2px;overflow-x:auto;scrollbar-width:none;}
.lms-tabbar-inner::-webkit-scrollbar{display:none;}
.lms-tab{display:inline-flex;align-items:center;gap:8px;padding:15px 14px;font-size:13.5px;font-weight:500;
  color:var(--lms-text-2);white-space:nowrap;border-bottom:2px solid transparent;transition:color .15s,border-color .15s;}
.lms-tab:hover{color:var(--lms-text);}
.lms-tab.active{color:var(--lms-green-dark);border-bottom-color:var(--lms-green);font-weight:600;}

/* ── right-hand navigation rail (replaces the old top tab bar) ──
   Mutually exclusive with the admin panel's left sidebar — see
   hooks/sidebarBus.js.

   The rail is a FLEX SIBLING of the page, not position:fixed with a matching
   margin on the body. Fixed positioning is measured against the viewport while
   the body's margin is measured against its own (already sidebar-inset)
   container, so the two disagreed by the width of the admin sidebar: the page
   ran off the right edge, the window grew a horizontal scrollbar, and the
   "Create" button sat outside it. As a flex row with min-width:0 on the page,
   that mismatch cannot happen at any window size. */
.lms-root{display:flex;align-items:flex-start;}
.lms-rail{position:sticky;top:62px;flex:0 0 auto;align-self:stretch;z-index:45;
  height:calc(100vh - 62px);display:flex;flex-direction:column;
  background:var(--lms-bg);border-left:1px solid var(--lms-border);
  box-shadow:-2px 0 12px rgba(16,24,40,.045);overflow:hidden;
  transition:width .26s cubic-bezier(.4,0,.2,1);}
/* min-width:0 is what lets the page shrink instead of forcing the row wider. */
.lms-rail-body{flex:1 1 auto;min-width:0;}
.lms-rail-toggle{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;height:38px;flex-shrink:0;
  border-bottom:1px solid var(--lms-border);background:var(--lms-green-soft);color:var(--lms-green-dark);
  font-size:12px;font-weight:600;white-space:nowrap;transition:background .16s,color .16s;}
.lms-rail-toggle:hover{background:#d6f7e3;}
.lms-rail-nav{flex:1;overflow-y:auto;overflow-x:hidden;padding:10px 8px;display:flex;flex-direction:column;gap:2px;}
.lms-rail-nav::-webkit-scrollbar{width:4px;}
.lms-rail-nav::-webkit-scrollbar-thumb{background:var(--lms-border-2);border-radius:4px;}
.lms-rail-item{position:relative;display:flex;align-items:center;gap:11px;padding:10px 10px;border-radius:var(--lms-r);
  font-size:13.5px;font-weight:500;color:var(--lms-text-2);white-space:nowrap;
  transition:background .16s,color .16s,transform .12s cubic-bezier(.4,0,.2,1);}
.lms-rail-item:hover{background:var(--lms-bg-soft);color:var(--lms-text);}
.lms-rail-item:active{transform:scale(.98);}
.lms-rail-item.active{background:var(--lms-nav-active);color:var(--lms-green-dark);font-weight:600;}
.lms-rail-item.active::before{content:'';position:absolute;right:-8px;top:8px;bottom:8px;width:3px;
  border-radius:3px 0 0 3px;background:var(--lms-green);}
.lms-rail-ico{display:inline-flex;align-items:center;justify-content:center;width:22px;flex-shrink:0;}
.lms-rail-label{overflow:hidden;text-overflow:ellipsis;transition:opacity .18s;}
.lms-rail:not(.open) .lms-rail-label{opacity:0;width:0;}
.lms-rail:not(.open) .lms-rail-item{justify-content:center;padding:10px 0;}
.lms-rail:not(.open) .lms-rail-item.active::before{right:0;}

/* ── buttons ──────────────────────────────────────────────────── */
.lms-root .lms-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:13.5px;font-weight:500;flex-shrink:0;
  padding:10px 18px;min-height:40px;line-height:1.25;border-radius:var(--lms-r);transition:background .18s cubic-bezier(.4,0,.2,1),box-shadow .18s cubic-bezier(.4,0,.2,1),border-color .18s,color .18s,opacity .15s,transform .12s cubic-bezier(.4,0,.2,1);
  border:1px solid transparent;white-space:nowrap;}
.lms-root .lms-btn:hover:not(:disabled){box-shadow:var(--lms-shadow);}
.lms-root .lms-btn:active:not(:disabled){transform:translateY(0) scale(.985);box-shadow:var(--lms-shadow-xs);}
.lms-root .lms-btn:disabled{opacity:.5;cursor:not-allowed;}
.lms-root .lms-btn:focus-visible{outline:2px solid var(--lms-green);outline-offset:2px;}
/* Icons inside a pill never shrink and never pull the label off-centre. */
.lms-root .lms-btn > svg{flex-shrink:0;}
.lms-root .lms-btn-dark{background:var(--lms-black);color:#fff;box-shadow:var(--lms-shadow-xs);}
.lms-root .lms-btn-dark:hover:not(:disabled){background:#1d2939;color:#fff;transform:translateY(-1px);box-shadow:0 4px 10px rgba(16,24,40,.18);}
.lms-root .lms-btn-green{background:var(--lms-green);color:#fff;box-shadow:var(--lms-shadow-xs);}
.lms-root .lms-btn-green:hover:not(:disabled){background:#039855;color:#fff;transform:translateY(-1px);box-shadow:0 4px 10px rgba(18,183,106,.28);}
.lms-root .lms-btn-blue{background:var(--lms-blue);color:#fff;box-shadow:var(--lms-shadow-xs);}
.lms-root .lms-btn-blue:hover:not(:disabled){filter:brightness(1.06);}
.lms-root .lms-btn-ghost{background:#fff;border-color:var(--lms-border-2);color:var(--lms-text);box-shadow:var(--lms-shadow-xs);}
.lms-root .lms-btn-ghost:hover:not(:disabled){background:var(--lms-bg-soft);border-color:var(--lms-text-3);color:var(--lms-text);}
.lms-root .lms-btn-red{background:var(--lms-red);color:#fff;}
.lms-root .lms-btn-red:hover:not(:disabled){background:#d92d20;color:#fff;transform:translateY(-1px);box-shadow:0 4px 10px rgba(240,68,56,.26);}
.lms-root .lms-btn-quiet{color:var(--lms-text-2);padding:8px 10px;}
.lms-root .lms-btn-quiet:hover:not(:disabled){background:var(--lms-bg-soft);color:var(--lms-text);}
.lms-root .lms-btn-sm{padding:7px 13px;min-height:32px;font-size:12.5px;}
.lms-root .lms-btn-lg{padding:12px 24px;min-height:46px;font-size:14px;}
.lms-root .lms-icon-btn{width:32px;height:32px;padding:0;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;
  color:var(--lms-text-3);transition:background .14s,color .14s;flex-shrink:0;}
.lms-root .lms-icon-btn:hover:not(:disabled){background:var(--lms-bg-soft);color:var(--lms-text);}
.lms-root .lms-icon-btn:disabled{opacity:.35;}
.lms-root .lms-icon-btn.danger:hover:not(:disabled){background:var(--lms-red-soft);color:var(--lms-red-dark);}
.lms-root .lms-icon-btn:focus-visible{outline:2px solid var(--lms-green);outline-offset:1px;}

/* ── cards + stat strip ───────────────────────────────────────── */
.lms-card{background:var(--lms-bg);border:1px solid var(--lms-border);border-radius:var(--lms-r-lg);box-shadow:var(--lms-shadow-xs);}
.lms-card-pad{padding:20px 22px;}
.lms-stat-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:24px;}
.lms-stat{background:var(--lms-bg);border:1px solid var(--lms-border);border-radius:var(--lms-r-lg);padding:18px 20px;
  display:flex;align-items:flex-start;justify-content:space-between;gap:12px;box-shadow:var(--lms-shadow-xs);}
.lms-stat-label{font-size:12.5px;color:var(--lms-text-2);font-weight:500;margin-bottom:7px;}
.lms-stat-value{font-size:26px;font-weight:600;letter-spacing:-.02em;line-height:1.1;}
.lms-stat-ico{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
  background:var(--lms-green-soft);color:var(--lms-green-dark);}

/* ── course grid ──────────────────────────────────────────────── */
.lms-course-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:22px;}
.lms-course-card{background:var(--lms-bg);border:1px solid var(--lms-border);border-radius:var(--lms-r-lg);position:relative;
  display:flex;flex-direction:column;text-align:left;transition:box-shadow .18s,transform .18s,border-color .18s;
  animation:lms-pop .26s ease both;}
.lms-course-card:hover{box-shadow:var(--lms-shadow-lg);transform:translateY(-2px);border-color:var(--lms-border-2);}
/* Whichever card has an open menu is lifted above the rest of the grid, so
   the dropdown is never painted under the next card. */
.lms-course-card:has(.lms-menu){z-index:80;}
.lms-course-thumb{position:relative;aspect-ratio:16/9;background:linear-gradient(135deg,#f2f4f7,#e4e7ec);
  border-radius:calc(var(--lms-r-lg) - 1px) calc(var(--lms-r-lg) - 1px) 0 0;
  display:flex;align-items:center;justify-content:center;overflow:hidden;}
.lms-course-thumb img{width:100%;height:100%;object-fit:cover;}
.lms-course-thumb-ph{font-size:22px;font-weight:600;color:#98a1ae;letter-spacing:.02em;text-align:center;padding:0 12px;}
.lms-validity{position:absolute;top:9px;left:9px;display:inline-flex;align-items:center;gap:5px;background:rgba(16,24,40,.78);
  color:#fff;font-size:10.5px;font-weight:500;padding:4px 9px;border-radius:999px;backdrop-filter:blur(4px);}
.lms-course-body{padding:14px 15px 16px;display:flex;flex-direction:column;gap:7px;flex:1;}
.lms-course-title{font-size:14.5px;font-weight:600;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;
  -webkit-box-orient:vertical;overflow:hidden;}
.lms-course-meta{font-size:11.5px;color:var(--lms-text-3);}
.lms-course-price{font-size:16px;font-weight:600;margin-top:2px;}
.lms-course-foot{margin-top:auto;padding-top:12px;border-top:1px solid var(--lms-border);
  display:flex;align-items:center;justify-content:space-between;gap:8px;}

/* ── pills ────────────────────────────────────────────────────── */
.lms-pill{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:500;padding:3px 10px;
  border-radius:999px;white-space:nowrap;}
.lms-pill.green{background:var(--lms-green-soft);color:var(--lms-green-dark);}
.lms-pill.grey{background:var(--lms-bg-soft);color:var(--lms-text-2);}
.lms-pill.amber{background:var(--lms-amber-soft);color:var(--lms-amber-dark);}
.lms-pill.red{background:var(--lms-red-soft);color:var(--lms-red-dark);}
.lms-pill.blue{background:var(--lms-blue-soft);color:#3538cd;}

/* ── counter strip (Total course / Encrypted / ...) ───────────── */
.lms-counters{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin:20px 0 24px;}
.lms-counter{border:1px solid var(--lms-border);border-radius:var(--lms-r);padding:13px 16px;display:flex;
  align-items:center;justify-content:space-between;gap:10px;background:var(--lms-bg);}
.lms-counter-label{font-size:11.5px;color:var(--lms-text-2);margin-bottom:3px;}
.lms-counter-value{font-size:20px;font-weight:600;line-height:1;}

/* ── toolbar / filters ────────────────────────────────────────── */
.lms-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px;}
.lms-search{position:relative;flex:1;min-width:220px;max-width:340px;}
.lms-search input{width:100%;padding:9px 14px 9px 36px;font-size:13.5px;border:1px solid var(--lms-border-2);
  border-radius:var(--lms-r);background:var(--lms-bg);color:var(--lms-text);outline:none;transition:border-color .15s,box-shadow .15s;}
.lms-search input:focus{border-color:var(--lms-green);box-shadow:0 0 0 3px rgba(18,183,106,.14);}
.lms-search svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--lms-text-3);}
.lms-segment{display:inline-flex;padding:3px;background:var(--lms-bg-soft);border-radius:var(--lms-r);gap:2px;}
.lms-segment button{padding:6px 15px;font-size:13px;font-weight:500;border-radius:6px;color:var(--lms-text-2);transition:background .14s,color .14s;}
.lms-segment button.active{background:#fff;color:var(--lms-text);box-shadow:var(--lms-shadow-xs);font-weight:600;}
/* A locked source tab stays readable — it is showing that the capability
   exists, not hiding it — but reads as unavailable. */
.lms-root .lms-seg button.locked,.lms-root .lms-segment button.locked{opacity:.45;cursor:not-allowed;}
.lms-root .lms-seg button.locked:hover{background:none;}

/* ── content builder: section rows + lesson rows ──────────────── */
.lms-section-row{background:var(--lms-bg-row);border-radius:var(--lms-r);margin-bottom:12px;overflow:hidden;
  position:relative;animation:lms-pop .22s ease both;}
/* overflow:hidden above is what rounds off the lesson rows, but it also sliced
   the ⋮ dropdown in half — the menu is a child of a lesson row, so it had
   nowhere to go. While a menu is open the row stops clipping and lifts above
   its neighbours; the rest of the time the rounded corners are back. Same
   trick as .lms-course-card:has(.lms-menu) further up. */
.lms-section-row:has(.lms-menu){overflow:visible;z-index:70;}
.lms-section-row:has(.lms-menu) .lms-lesson-list{border-radius:0 0 var(--lms-r) var(--lms-r);}
.lms-section-head{display:flex;align-items:center;gap:14px;padding:15px 18px;cursor:pointer;transition:background .14s;}

/* ── drag to reorder ─────────────────────────────────────────── */
/* Only the handle is draggable, not the whole row: the row is also a
   click target (expand/collapse) and a text-selection surface, and making
   all of it draggable breaks both. */
.lms-drag-handle{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;
  width:20px;color:var(--lms-text-3);cursor:grab;border-radius:4px;transition:color .14s,background .14s;}
.lms-drag-handle:hover{color:var(--lms-text);background:rgba(16,24,40,.06);}
.lms-drag-handle:active{cursor:grabbing;}
.lms-section-row[draggable="true"],.lms-lesson-row[draggable="true"]{cursor:grabbing;}
/* An inset line, not a border — a real border would shift every row by 2px
   as the drop target moves, making the list twitch under the cursor. */
.lms-section-row.drop-target{box-shadow:inset 0 3px 0 0 var(--lms-green);}
.lms-lesson-row.drop-target{box-shadow:inset 0 3px 0 0 var(--lms-green);background:var(--lms-green-soft);}
.lms-section-head:hover{background:var(--lms-bg-row-hover);}
.lms-section-num{font-size:14px;font-weight:600;color:var(--lms-text-2);min-width:14px;}
.lms-section-title{font-size:14.5px;font-weight:600;flex:1;}
.lms-section-meta{font-size:12.5px;color:var(--lms-text-2);white-space:nowrap;}
.lms-section-actions{display:flex;align-items:center;gap:2px;}
.lms-lesson-list{background:var(--lms-bg);}
.lms-lesson-row{display:flex;align-items:center;gap:12px;padding:13px 18px;border-top:1px solid var(--lms-border);
  transition:background .12s;}
.lms-lesson-row:hover{background:var(--lms-bg-page);}
/* The lesson you came back from. It stays marked for as long as the outline
   is on screen rather than flashing once and fading — the point is to answer
   "where was I?" at a glance, and a 2-second flash is gone by the time the
   smooth scroll has finished. The pulse only announces the arrival. */
.lms-lesson-row.is-current{background:var(--lms-green-soft);
  box-shadow:inset 3px 0 0 0 var(--lms-green);animation:lms-return .9s ease-out both;}
.lms-lesson-row.is-current:hover{background:#dcf7e7;}
.lms-lesson-row.is-current .lms-lesson-title{font-weight:600;color:var(--lms-green-dark);}
@keyframes lms-return{
  0%{background:#c7f0d8;}
  100%{background:var(--lms-green-soft);}
}
@media (prefers-reduced-motion:reduce){
  .lms-lesson-row.is-current{animation:none;}
}
.lms-lesson-num{font-size:13px;color:var(--lms-text-2);min-width:16px;}
.lms-lesson-ico{color:var(--lms-green);display:flex;flex-shrink:0;}
.lms-lesson-title{font-size:13.5px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;}
.lms-lesson-title:hover{color:var(--lms-green-dark);text-decoration:underline;}
.lms-lesson-chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--lms-text-2);
  background:var(--lms-bg-soft);padding:3px 8px;border-radius:6px;white-space:nowrap;}
.lms-root .lms-add-lesson{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px 18px;
  background:var(--lms-bg-add);color:var(--lms-green-dark);font-size:13.5px;font-weight:500;border-top:1px solid var(--lms-border);
  transition:background .14s,color .14s;}
.lms-root .lms-add-lesson:hover{background:#d6f5e2;}
.lms-root .lms-add-lesson:focus-visible{outline:2px solid var(--lms-green);outline-offset:-2px;}
.lms-root .lms-add-section{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:16px 18px;
  background:var(--lms-bg-row);color:var(--lms-text);font-size:14px;font-weight:500;border-radius:var(--lms-r);
  transition:background .14s;margin-top:4px;}
.lms-root .lms-add-section:hover{background:var(--lms-bg-row-hover);}
.lms-root .lms-add-section:focus-visible{outline:2px solid var(--lms-green);outline-offset:-2px;}

/* builder header strip (0 Hidden · 19 Lessons · 0 Quizzes · 40 mins) */
.lms-builder-stats{display:flex;align-items:center;gap:22px;flex-wrap:wrap;font-size:13.5px;color:var(--lms-text-2);}
.lms-builder-stats span{display:inline-flex;align-items:center;gap:7px;}

/* ── course capability card (the ⓘ on a course card) ──────────── */
.lms-flags{position:absolute;right:0;bottom:calc(100% + 8px);z-index:200;min-width:232px;
  background:#fff;border:1px solid var(--lms-border);border-radius:var(--lms-r);
  box-shadow:var(--lms-shadow-lg);padding:8px;animation:lms-pop .14s ease both;}
.lms-flag{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:6px;
  font-size:12.5px;color:var(--lms-text-3);cursor:default;}
.lms-flag svg{flex-shrink:0;color:var(--lms-red);}
.lms-flag.on{color:var(--lms-text);}
.lms-flag.on svg{color:var(--lms-green);}
.lms-flag:hover{background:var(--lms-bg-soft);}

/* ── image field (LmsImageField) ──────────────────────────────── */
.lms-imgfield{display:inline-flex;align-items:center;flex-shrink:0;}
.lms-imgfield-preview{position:relative;display:inline-block;}
.lms-imgfield-preview img{display:block;height:38px;width:auto;max-width:120px;object-fit:cover;
  border:1px solid var(--lms-border-2);border-radius:var(--lms-r);background:var(--lms-bg-soft);}
.lms-imgfield:not(.compact) .lms-imgfield-preview img{height:120px;max-width:100%;}
.lms-root .lms-imgfield-x{position:absolute;top:-7px;right:-7px;width:20px;height:20px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;background:var(--lms-red);color:#fff;
  box-shadow:var(--lms-shadow-xs);}
.lms-root .lms-imgfield-x:hover{background:#d92d20;}
@keyframes lms-spin{to{transform:rotate(360deg);}}
.lms-spin{animation:lms-spin .9s linear infinite;}

/* ── rich text (LmsRichText) ──────────────────────────────────── */
/* TinyMCE ships its own chrome, so this only reconciles the frame with the
   panel: matching border, radius and focus ring. */
.lms-rte .tox-tinymce{border:1px solid var(--lms-border-2)!important;border-radius:var(--lms-r)!important;}
.lms-rte .tox-tinymce:focus-within{border-color:var(--lms-green)!important;
  box-shadow:0 0 0 3px rgba(18,183,106,.14)!important;}
.lms-rte .tox-statusbar{border-top:1px solid var(--lms-border)!important;}
/* Menus and dialogs are portalled to <body>, so they need to clear the
   drawer/modal layer (1201) or they open behind the dialog that spawned them. */
.tox-tinymce-aux,.tox .tox-dialog-wrap{z-index:1400!important;}

/* the same typography, applied to what the editor produced */
.lms-rich{line-height:1.7;color:var(--lms-text-2);font-size:13.5px;}
.lms-rich > :first-child{margin-top:0;}
.lms-rich > :last-child{margin-bottom:0;}
.lms-rich h1{font-size:20px;} .lms-rich h2{font-size:17px;} .lms-rich h3{font-size:15px;}
.lms-rich h1,.lms-rich h2,.lms-rich h3,.lms-rich h4{color:var(--lms-text);font-weight:600;
  margin:1.1em 0 .45em;line-height:1.35;}
.lms-rich p{margin:0 0 .75em;}
.lms-rich ul,.lms-rich ol{margin:0 0 .75em;padding-left:1.35em;}
.lms-rich li{margin-bottom:.3em;}
.lms-rich a{color:var(--lms-green-dark);text-decoration:underline;}
.lms-rich img{max-width:100%;height:auto;border-radius:var(--lms-r);}
.lms-rich blockquote{border-left:3px solid var(--lms-green);margin:.9em 0;padding:.2em 1em;
  color:var(--lms-text-2);}
.lms-rich pre{background:var(--lms-bg-soft);padding:12px;border-radius:var(--lms-r);
  overflow-x:auto;font-size:12.5px;}
.lms-rich code{background:var(--lms-bg-soft);padding:1px 5px;border-radius:4px;font-size:12.5px;}
.lms-rich table{border-collapse:collapse;width:100%;margin:.9em 0;font-size:13px;}
.lms-rich table td,.lms-rich table th{border:1px solid var(--lms-border);padding:7px 10px;}
.lms-rich hr{border:none;border-top:1px solid var(--lms-border);margin:1.2em 0;}
/* Card previews clamp to three lines — a long description would otherwise
   push the stats below the fold. */
.lms-rich.clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;
  overflow:hidden;}

/* ── filter bar (Users / Enrollments) ─────────────────────────── */
.lms-filter-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px 16px;}

/* ── searchable select (LmsCombobox) ──────────────────────────── */
.lms-combo{position:relative;width:100%;}
.lms-root .lms-combo-control{display:flex;align-items:center;gap:8px;width:100%;padding:9px 11px 9px 13px;
  font-size:13.5px;text-align:left;border:1px solid var(--lms-border-2);border-radius:var(--lms-r);
  background:var(--lms-bg);color:var(--lms-text);transition:border-color .15s,box-shadow .15s;}
.lms-root .lms-combo-control:hover:not(:disabled){border-color:var(--lms-text-3);}
.lms-root .lms-combo-control.open,.lms-root .lms-combo-control:focus-visible{
  border-color:var(--lms-green);box-shadow:0 0 0 3px rgba(18,183,106,.14);outline:none;}
.lms-root .lms-combo-control:disabled{background:var(--lms-bg-soft);color:var(--lms-text-3);cursor:not-allowed;}
.lms-combo-value{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.lms-combo-value.placeholder{color:var(--lms-text-3);}
.lms-combo-clear{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;
  border-radius:50%;color:var(--lms-text-3);flex-shrink:0;cursor:pointer;transition:background .14s,color .14s;}
.lms-combo-clear:hover{background:var(--lms-bg-soft);color:var(--lms-text);}
.lms-combo-caret{color:var(--lms-text-3);flex-shrink:0;}

/* z-index sits above .lms-menu (900) but below the drawer/modal layer
   (1200+), so a combobox inside a drawer still paints over its fields. */
.lms-combo-pop{position:absolute;z-index:1000;top:calc(100% + 5px);left:0;right:0;background:#fff;
  border:1px solid var(--lms-border);border-radius:var(--lms-r);box-shadow:var(--lms-shadow-lg);
  overflow:hidden;animation:lms-pop .13s ease both;}
.lms-combo-search{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid var(--lms-border);
  color:var(--lms-text-3);}
.lms-combo-search input{flex:1;min-width:0;border:none;outline:none;background:none;font-size:13.5px;
  color:var(--lms-text);}
.lms-combo-list{max-height:264px;overflow-y:auto;overscroll-behavior:contain;padding:5px;
  scrollbar-width:thin;scrollbar-color:var(--lms-border-2) transparent;}
.lms-combo-list::-webkit-scrollbar{width:8px;}
.lms-combo-list::-webkit-scrollbar-thumb{background:var(--lms-border-2);border-radius:8px;border:2px solid #fff;}
.lms-combo-group{font-size:10.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;
  color:var(--lms-text-3);padding:9px 11px 5px;}
.lms-root .lms-combo-item{display:flex;align-items:center;gap:10px;width:100%;padding:9px 11px;
  font-size:13.5px;text-align:left;border-radius:6px;color:var(--lms-text);}
.lms-combo-item .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.lms-root .lms-combo-item.active{background:var(--lms-bg-soft);}
.lms-root .lms-combo-item.selected{color:var(--lms-green-dark);font-weight:600;}
.lms-root .lms-combo-item.selected.active{background:var(--lms-green-soft);}
.lms-combo-empty{padding:22px 12px;text-align:center;font-size:12.5px;color:var(--lms-text-3);}

/* ── quiz picker: the same popup, but each row carries badges ──── */
/* A quiz row is two lines — title, then the internship badge, the draft flag
   and the question count — so it overrides the single-line combo item rather
   than trying to squeeze all of that onto one baseline. */
.lms-root .lms-combo-item.lms-qpick-item{align-items:flex-start;padding:10px 11px;}
.lms-qpick-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;text-align:left;}
.lms-qpick-title{font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.lms-qpick-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.lms-qpick-count{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:var(--lms-text-3);}
/* The closed control shows the same badges as the row it came from, so the
   answer to "which internship is bound here?" is on screen without opening
   the list again. */
.lms-qpick-picked{flex:1;min-width:0;display:flex;align-items:center;gap:8px;overflow:hidden;}
.lms-qpick-picked .t{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.lms-qpick-picked .lms-pill{flex-shrink:0;max-width:190px;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;display:inline-block;}
.lms-filter-grid .lms-help{margin-top:5px;}

/* ── forms ────────────────────────────────────────────────────── */
.lms-field{margin-bottom:18px;}
.lms-label{display:block;font-size:13px;font-weight:500;margin-bottom:6px;}
.lms-label .req{color:var(--lms-red);margin-left:2px;}
.lms-help{font-size:11.5px;color:var(--lms-text-3);margin:6px 0 0;line-height:1.5;}
.lms-input,.lms-textarea,.lms-select{width:100%;padding:9px 13px;font-size:13.5px;border:1px solid var(--lms-border-2);
  border-radius:var(--lms-r);background:var(--lms-bg);color:var(--lms-text);outline:none;
  transition:border-color .15s,box-shadow .15s;}
.lms-input:focus,.lms-textarea:focus,.lms-select:focus{border-color:var(--lms-green);box-shadow:0 0 0 3px rgba(18,183,106,.14);}
.lms-input:disabled,.lms-textarea:disabled,.lms-select:disabled{background:var(--lms-bg-soft);color:var(--lms-text-3);cursor:not-allowed;}
.lms-textarea{resize:vertical;min-height:96px;line-height:1.6;}
.lms-select{appearance:none;background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%2398a1ae' stroke-width='2'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 11px center;padding-right:32px;}
.lms-select[multiple]{background-image:none;padding-right:13px;}
.lms-row-2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.lms-row-3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
.lms-char-count{float:right;font-size:11.5px;color:var(--lms-text-3);font-weight:400;}
.lms-check{display:inline-flex;align-items:center;gap:9px;font-size:13.5px;cursor:pointer;user-select:none;}
.lms-check input{width:16px;height:16px;accent-color:var(--lms-green);cursor:pointer;}
.lms-radio-card{display:flex;gap:11px;padding:15px;border:1px solid var(--lms-border-2);border-radius:var(--lms-r);
  cursor:pointer;transition:border-color .15s,background .15s;margin-bottom:12px;}
.lms-radio-card:hover{background:var(--lms-bg-page);}
.lms-radio-card.on{border-color:var(--lms-green);background:var(--lms-green-soft);}
.lms-radio-card input{margin-top:2px;accent-color:var(--lms-green);width:16px;height:16px;flex-shrink:0;}
.lms-dropzone{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;padding:30px 20px;
  border:1.5px dashed var(--lms-border-2);border-radius:var(--lms-r-lg);background:var(--lms-bg-page);text-align:center;
  cursor:pointer;transition:border-color .15s,background .15s;width:100%;}
.lms-dropzone:hover{border-color:var(--lms-green);background:var(--lms-green-soft);}
.lms-dropzone .t{font-size:13.5px;font-weight:500;}
.lms-dropzone .s{font-size:11.5px;color:var(--lms-text-3);}

/* ── lesson-type picker (the Add Lesson modal) ────────────────── */
.lms-type-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:10px;}
.lms-root .lms-type-card{display:flex;flex-direction:column;align-items:flex-start;gap:5px;padding:13px;
  border:1px solid var(--lms-border-2);border-radius:var(--lms-r);background:var(--lms-bg);text-align:left;
  transition:border-color .15s,background .15s,box-shadow .15s,transform .12s cubic-bezier(.4,0,.2,1);}
.lms-root .lms-type-card:hover{border-color:var(--lms-green);background:var(--lms-green-soft);
  transform:translateY(-1px);box-shadow:var(--lms-shadow-xs);}
.lms-root .lms-type-card.on{border-color:var(--lms-green);background:var(--lms-green-soft);
  box-shadow:0 0 0 3px rgba(18,183,106,.14);}
.lms-root .lms-type-card:focus-visible{outline:2px solid var(--lms-green);outline-offset:2px;}
.lms-type-card .i{display:flex;color:var(--lms-text-2);transition:color .15s;}
.lms-type-card.on .i,.lms-type-card:hover .i{color:var(--lms-green-dark);}
.lms-type-card .t{font-size:13px;font-weight:600;line-height:1.3;}
.lms-type-card .s{font-size:11px;color:var(--lms-text-3);line-height:1.45;}

/* ── toggle ───────────────────────────────────────────────────── */
.lms-toggle{width:40px;height:22px;border-radius:999px;background:#e4e7ec;position:relative;flex-shrink:0;
  transition:background .16s;border:none;}
.lms-toggle.on{background:var(--lms-green);}
.lms-toggle::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;
  background:#fff;transition:transform .16s;box-shadow:0 1px 3px rgba(16,24,40,.2);}
.lms-toggle.on::after{transform:translateX(18px);}
.lms-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 0;
  border-bottom:1px solid var(--lms-border);}
.lms-toggle-row:last-child{border-bottom:none;}

/* The course-level routing switch on the builder header. Boxed, because it is
   the one control up there that reports a state rather than starting an
   action, and a bare toggle beside two buttons reads as a third button. */
.lms-course-switch{display:flex;align-items:center;gap:14px;padding:7px 14px;
  border:1px solid var(--lms-border);border-radius:var(--lms-r);background:var(--lms-bg);}
.lms-course-switch-label{font-size:13px;font-weight:600;line-height:1.3;white-space:nowrap;}
.lms-course-switch-hint{font-size:11px;color:var(--lms-text-3);line-height:1.3;white-space:nowrap;}

/* The same switch on a course card, sitting opposite the sections/enrolled
   line. Smaller than the builder's, because here it is one control among
   several rather than the header's main statement. */
.lms-course-foot-row{display:flex;align-items:center;justify-content:space-between;gap:12px;}
.lms-card-switch{display:inline-flex;align-items:center;gap:7px;flex-shrink:0;cursor:default;}
.lms-card-switch-label{font-size:11px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;
  color:var(--lms-text-3);transition:color .16s;}
.lms-card-switch-label.on{color:var(--lms-green-dark);}
/* 40x22 is right on a settings row and heavy on a card footer. */
.lms-card-switch .lms-toggle{width:32px;height:18px;}
.lms-card-switch .lms-toggle::after{width:14px;height:14px;}
.lms-card-switch .lms-toggle.on::after{transform:translateX(14px);}

/* ── spreadsheet question import ──────────────────────────────────────── */
/* The column key. Two columns on a wide modal, one on a narrow one — the
   names are the contract with the file, so they get to be legible. */
.lms-import-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:1px;
  background:var(--lms-border);border:1px solid var(--lms-border);border-radius:var(--lms-r);overflow:hidden;}
.lms-import-col{display:flex;flex-direction:column;gap:1px;padding:9px 12px;background:var(--lms-bg);}
.lms-import-col b{font-size:12.5px;font-weight:600;}
.lms-import-col span{font-size:11.5px;color:var(--lms-text-3);}

.lms-import-summary{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:16px;
  padding:11px 14px;background:var(--lms-bg-soft);border-radius:var(--lms-r);font-size:13px;}
.lms-import-summary span{display:inline-flex;align-items:center;gap:6px;}
.lms-import-summary .ok{color:var(--lms-green-dark);font-weight:600;}
.lms-import-summary .bad{color:var(--lms-red-dark);font-weight:600;}
.lms-import-summary .muted{color:var(--lms-text-3);margin-left:auto;font-size:12px;}

/* Capped and scrollable: ten questions is enough to catch a systematic
   mis-read, and an unbounded list would push the Import button off screen —
   which is the button the whole preview exists to inform. */
.lms-import-preview{max-height:320px;overflow-y:auto;border:1px solid var(--lms-border);
  border-radius:var(--lms-r);padding:6px;display:flex;flex-direction:column;gap:6px;}
.lms-import-q{padding:10px 12px;border-radius:6px;background:var(--lms-bg-page);}
.lms-import-q-head{display:flex;align-items:flex-start;gap:9px;flex-wrap:wrap;margin-bottom:8px;}
.lms-import-q-head .n{font-size:12px;font-weight:600;color:var(--lms-text-3);min-width:16px;padding-top:2px;}
.lms-import-q-head p{margin:0;}
.lms-import-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:4px 14px;
  padding-left:25px;}
.lms-import-opt{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--lms-text-2);
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.lms-import-opt.right{color:var(--lms-green-dark);font-weight:600;}
.lms-import-opt .dot{width:13px;height:13px;border:1.5px solid var(--lms-border-2);border-radius:50%;flex-shrink:0;}
.lms-import-opt svg{flex-shrink:0;}

/* ── batch quiz create (one quiz per uploaded file) ────────────────────── */
/* The row list IS the contract of the feature: pick N files, get N quizzes
   with exactly these titles. Showing the title before the run is what stops
   "why is this one called (7)?" being asked after it. The same rows carry the
   per-file status during the run, so nothing has to move on screen. */
.lms-batch{border:1px solid var(--lms-border);border-radius:var(--lms-r);overflow:hidden;}
.lms-batch-row{display:flex;align-items:center;gap:11px;padding:9px 12px;font-size:13px;
  background:var(--lms-bg);border-bottom:1px solid var(--lms-border);}
.lms-batch-row:last-child{border-bottom:none;}
.lms-batch-row.bad{background:var(--lms-red-soft);}
.lms-batch-n{min-width:18px;flex-shrink:0;font-size:11.5px;font-weight:600;color:var(--lms-text-3);}
.lms-batch-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;}
.lms-batch-title{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lms-batch-note{font-size:11.5px;color:var(--lms-text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lms-batch-row.bad .lms-batch-note{color:var(--lms-red-dark);}
.lms-batch-row.done .lms-batch-note{color:var(--lms-green-dark);}
.lms-batch-row > svg{flex-shrink:0;}
.lms-batch-spin{animation:lms-spin .8s linear infinite;}

/* ── tables ───────────────────────────────────────────────────── */
.lms-table-wrap{border:1px solid var(--lms-border);border-radius:var(--lms-r-lg);overflow:hidden;background:var(--lms-bg);}
.lms-table-scroll{overflow-x:auto;}
.lms-table{width:100%;border-collapse:collapse;font-size:13.5px;min-width:720px;}
.lms-table th{text-align:left;font-size:12.5px;font-weight:600;color:var(--lms-text-2);padding:13px 18px;
  background:var(--lms-bg-page);border-bottom:1px solid var(--lms-border);white-space:nowrap;}
.lms-table td{padding:15px 18px;border-bottom:1px solid var(--lms-border);vertical-align:middle;}
.lms-table tbody tr:last-child td{border-bottom:none;}
.lms-table tbody tr:hover{background:var(--lms-bg-page);}
.lms-user-cell{display:flex;align-items:center;gap:11px;}
.lms-avatar{width:34px;height:34px;border-radius:50%;background:var(--lms-green-soft);color:var(--lms-green-dark);
  display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex-shrink:0;text-transform:uppercase;}
.lms-user-name{font-weight:500;line-height:1.35;}
.lms-user-mail{font-size:12px;color:var(--lms-text-2);}
.lms-pager{display:flex;align-items:center;justify-content:flex-end;gap:14px;padding:12px 18px;
  border-bottom:1px solid var(--lms-border);font-size:13px;color:var(--lms-text-2);flex-wrap:wrap;}
.lms-progress-bar{height:6px;border-radius:999px;background:var(--lms-bg-soft);overflow:hidden;min-width:70px;flex:1;max-width:120px;}
.lms-progress-bar i{display:block;height:100%;background:var(--lms-green);border-radius:999px;transition:width .3s;}

/* ── media picker (course thumbnail, lesson video) ────────────── */
.lms-media{border:1px solid var(--lms-border);border-radius:var(--lms-r);overflow:hidden;background:var(--lms-bg-soft);}
.lms-media-frame{aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;background:#101828;position:relative;}
.lms-media-frame img,.lms-media-frame video,.lms-media-frame iframe{width:100%;height:100%;object-fit:contain;border:0;display:block;}
.lms-media-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
  color:var(--lms-text-3);font-size:12.5px;text-align:center;padding:18px;}
.lms-media-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;background:var(--lms-bg);
  border-top:1px solid var(--lms-border);}
.lms-media-name{font-size:11.5px;color:var(--lms-text-3);word-break:break-all;flex:1;min-width:120px;}

/* segmented control — pick where the media comes from */
.lms-seg{display:inline-flex;padding:3px;gap:2px;background:var(--lms-bg-soft);border-radius:var(--lms-r);
  border:1px solid var(--lms-border);flex-wrap:wrap;}
.lms-seg button{padding:7px 13px;border-radius:6px;font-size:12.5px;font-weight:500;color:var(--lms-text-2);
  white-space:nowrap;transition:background .15s,color .15s,box-shadow .15s;}
.lms-seg button:hover{color:var(--lms-text);}
.lms-seg button.on{background:var(--lms-bg);color:var(--lms-text);font-weight:600;box-shadow:var(--lms-shadow-xs);}

/* the "this uploads to S3" warning shown before a direct upload */
.lms-warn{display:flex;gap:11px;padding:13px 14px;border-radius:var(--lms-r);
  background:var(--lms-amber-soft);border:1px solid rgba(247,144,9,.28);}
.lms-warn-ico{color:var(--lms-amber-dark);flex-shrink:0;margin-top:1px;}
.lms-warn-body{font-size:12.5px;line-height:1.6;color:var(--lms-amber-dark);}
.lms-warn-body b{display:block;font-size:13px;margin-bottom:3px;color:var(--lms-amber-dark);}

/* ── drawer / modal ───────────────────────────────────────────── */
.lms-backdrop{position:fixed;inset:0;background:rgba(16,24,40,.5);z-index:1200;animation:lms-fadein .16s ease;}
.lms-drawer{position:fixed;top:0;right:0;bottom:0;width:min(560px,96vw);background:var(--lms-bg);z-index:1201;
  display:flex;flex-direction:column;box-shadow:var(--lms-shadow-lg);animation:lms-slide .22s cubic-bezier(.2,.7,.3,1);}
@keyframes lms-slide{from{transform:translateX(36px);opacity:.5;}to{transform:none;opacity:1;}}
.lms-drawer-head{padding:20px 24px;border-bottom:1px solid var(--lms-border);display:flex;align-items:flex-start;
  justify-content:space-between;gap:14px;flex:0 0 auto;background:var(--lms-bg);}
.lms-drawer-title{font-size:17px;font-weight:600;line-height:1.35;}
.lms-drawer-sub{font-size:12.5px;color:var(--lms-text-2);margin-top:3px;}
.lms-drawer-body{padding:24px;overflow-y:auto;overscroll-behavior:contain;flex:1 1 auto;min-height:0;
  scrollbar-width:thin;scrollbar-color:var(--lms-border-2) transparent;}
.lms-drawer-body::-webkit-scrollbar{width:9px;}
.lms-drawer-body::-webkit-scrollbar-track{background:transparent;}
.lms-drawer-body::-webkit-scrollbar-thumb{background:var(--lms-border-2);border-radius:9px;border:3px solid var(--lms-bg);}
.lms-drawer-body::-webkit-scrollbar-thumb:hover{background:var(--lms-text-3);}
/* The last field in a scrolling body shouldn't leave a double gap above the footer. */
.lms-drawer-body > .lms-field:last-child{margin-bottom:0;}
.lms-drawer-foot{padding:16px 24px;border-top:1px solid var(--lms-border);display:flex;gap:10px;justify-content:flex-end;
  flex:0 0 auto;flex-wrap:wrap;background:var(--lms-bg);}
/* The modal is centred with a transform, so it CANNOT borrow the shared
   'lms-pop' keyframes: their 'to{transform:none}' — held after the run by
   'animation-fill-mode:both' — wiped out the centring the instant the animation
   settled. The dialog's top-left corner then sat on the middle of the screen,
   its lower half fell past the bottom of the viewport, and the body had nowhere
   left to scroll. Its own keyframes therefore re-state the translate in both
   the from and to steps. */
.lms-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
  width:min(560px,94vw);max-height:min(86vh,880px);overflow:hidden;
  background:var(--lms-bg);border-radius:var(--lms-r-lg);z-index:1201;display:flex;flex-direction:column;
  box-shadow:var(--lms-shadow-lg);animation:lms-modal-pop .2s cubic-bezier(.2,.7,.3,1) both;}
@keyframes lms-modal-pop{
  from{opacity:0;transform:translate(-50%,-50%) scale(.97);}
  to{opacity:1;transform:translate(-50%,-50%) scale(1);}}
@media (prefers-reduced-motion:reduce){
  .lms-modal,.lms-drawer,.lms-backdrop{animation-duration:.01ms;}}
.lms-menu{position:absolute;right:0;top:calc(100% + 6px);min-width:216px;max-width:min(280px,90vw);
  max-height:min(340px,60vh);overflow-y:auto;overscroll-behavior:contain;background:#fff;border:1px solid var(--lms-border);
  border-radius:var(--lms-r);box-shadow:var(--lms-shadow-lg);padding:6px;z-index:900;animation:lms-pop .14s ease both;}
.lms-menu::-webkit-scrollbar{width:8px;}
.lms-menu::-webkit-scrollbar-thumb{background:var(--lms-border-2);border-radius:8px;border:2px solid #fff;}
.lms-menu button{display:flex;align-items:center;gap:10px;width:100%;padding:9px 11px;font-size:13.5px;
  border-radius:6px;text-align:left;color:var(--lms-text);transition:background .12s;}
.lms-menu button:hover{background:var(--lms-bg-soft);}
.lms-menu button.danger{color:var(--lms-red-dark);}
.lms-menu button.danger:hover{background:var(--lms-red-soft);}
.lms-menu-sep{height:1px;background:var(--lms-border);margin:5px 0;}
/* Nested list under "Move To Another Section" — indented and labelled so it
   reads as "pick one of these", not as more top-level actions. */
.lms-submenu{margin:2px 0 6px;padding-left:10px;border-left:2px solid var(--lms-border);}
.lms-submenu-label{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;
  color:var(--lms-text-3);padding:6px 11px 4px;}
.lms-root .lms-submenu button{font-size:12.5px;padding:8px 11px;}
.lms-submenu-empty{font-size:12px;color:var(--lms-text-3);padding:6px 11px 8px;line-height:1.5;}

/* ── the Learnyst loader ──────────────────────────────────────── */
.lms-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:90px 20px;}
.lms-dots{display:flex;gap:9px;}
.lms-dots i{width:13px;height:13px;border-radius:50%;background:var(--lms-blue);display:block;
  animation:lms-bounce 1.1s infinite ease-in-out both;}
.lms-dots i:nth-child(1){animation-delay:-.24s;}
.lms-dots i:nth-child(2){animation-delay:-.12s;}
@keyframes lms-bounce{0%,80%,100%{transform:scale(.55);opacity:.55;}40%{transform:scale(1);opacity:1;}}
.lms-loading-title{font-size:38px;font-weight:600;letter-spacing:-.02em;line-height:1;}
.lms-loading-sub{font-size:15px;color:var(--lms-text-2);}
.lms-loading.inline{padding:44px 20px;gap:11px;}
.lms-loading.inline .lms-loading-title{font-size:22px;}
.lms-loading.inline .lms-loading-sub{font-size:13px;}

/* ── empty state ──────────────────────────────────────────────── */
.lms-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:70px 20px;text-align:center;}
.lms-empty-ico{width:56px;height:56px;border-radius:14px;background:var(--lms-bg-soft);color:var(--lms-text-3);
  display:flex;align-items:center;justify-content:center;margin-bottom:8px;}
.lms-empty h3{font-size:15.5px;font-weight:600;margin:0;}
.lms-empty p{font-size:13px;color:var(--lms-text-2);margin:0;max-width:420px;line-height:1.6;}

/* ── misc ─────────────────────────────────────────────────────── */
.lms-breadcrumb{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--lms-text-2);margin-bottom:6px;flex-wrap:wrap;}
.lms-breadcrumb a:hover{color:var(--lms-green-dark);text-decoration:underline;}
.lms-topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 32px;
  border-bottom:1px solid var(--lms-border);background:var(--lms-bg);flex-wrap:wrap;}
.lms-divider{height:1px;background:var(--lms-border);margin:24px 0;}
.lms-chip-row{display:flex;gap:8px;flex-wrap:wrap;}
@keyframes lms-pop{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}
@keyframes lms-fadein{from{opacity:0;}to{opacity:1;}}
.lms-fade{animation:lms-pop .2s ease both;}
@media (max-width:820px){
  .lms-page{padding:20px 16px 50px;}
  .lms-tabbar{padding:0 16px;}
  .lms-topbar{padding:12px 16px;}
  .lms-row-2,.lms-row-3{grid-template-columns:1fr;}
  .lms-drawer{width:100vw;}
  .lms-modal{width:calc(100vw - 24px);max-height:calc(100vh - 32px);}
  .lms-drawer-head{padding:16px 18px;}
  .lms-drawer-body{padding:18px;}
  .lms-drawer-foot{padding:14px 18px;}
  /* Stacked footers read better than two half-width pills on a phone. */
  .lms-drawer-foot .lms-btn{flex:1 1 auto;}
}
`;

/**
 * Writes LMS_CSS into a single <style id="lms-styles"> tag, creating it the
 * first time and overwriting it after that.
 *
 * This runs as a MODULE-LEVEL side effect, not only from the hook. A hot
 * reload re-evaluates this module but does not remount <LmsLayout>, so a
 * mount-only effect left the previous stylesheet in the document: the JSX on
 * screen was the new one while every rule styling it was stale, and the only
 * way out was a hard refresh. Re-running on evaluation keeps the two in step.
 */
function syncLmsStyles() {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('lms-styles');
  if (!el) {
    el = document.createElement('style');
    el.id = 'lms-styles';
    document.head.appendChild(el);
  }
  if (el.textContent !== LMS_CSS) el.textContent = LMS_CSS;
}

syncLmsStyles();

/** Kept as a hook so LmsLayout still guarantees the sheet on first paint. */
export function useLmsStyles() {
  useEffect(syncLmsStyles, []);
}

/** Closes a dropdown when the user clicks anywhere outside `ref`. */
export function useOutsideClose(ref, onClose, active = true) {
  useEffect(() => {
    if (!active) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onClose, active]);
}
