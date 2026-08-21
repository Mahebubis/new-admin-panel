import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getJourney, createJourney, saveGraph, addVersion, listVersions,
  setStatus as setJourneyStatus, loadOptions, sendTest,
  previewTemplate, uploadAttachment, deleteAttachment,
} from './journeyStore';

/*
  Journey builder — canvas, node palette, edge connections, wait-on-link, merges,
  validation, journey settings and lifecycle. Ported from the iStudio Engage design
  spec into a self-contained React component.

  Design notes:
  - The canvas engine is imperative (drag/link/zoom/minimap) and runs once on mount
    against the component's own DOM subtree (rootRef) — every lookup is scoped to the
    component, never `document`, so multiple sections never collide.
  - All CSS is nested under `.jb-root`, so none of these generic class names
    (.node, .field, .card …) leak into the rest of the netcore panel.
  - This is the frontend design layer only — no backend calls. State lives in-memory,
    matching the "design of journey" scope.
*/

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
.jb-root{
  --ink:#131632; --ink2:#3a3f63; --muted:#767ca3; --faint:#9ba0c0;
  --paper:#f4f5fb; --line:#e3e6f3; --line2:#eceef8; --white:#fff;
  --indigo:#22265c; --indigo-deep:#12142e; --indigo-soft:#eef0ff;
  --orange:#ff6a1f; --orange-ink:#c74300; --orange-soft:#fff0e7;
  --teal:#0d9488; --teal-soft:#e4f6f3;
  --amber:#b07408; --amber-soft:#fdf2dc;
  --red:#d92d20; --red-soft:#fdeceb; --green:#0f9d58;
  --shadow-1:0 1px 2px rgba(19,22,50,.06), 0 1px 3px rgba(19,22,50,.05);
  --shadow-2:0 12px 32px rgba(19,22,50,.12), 0 2px 8px rgba(19,22,50,.06);
  --shadow-3:-24px 0 60px rgba(19,22,50,.16);
  --font-d:"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif;
  --font-b:"Inter Tight", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-m:"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  height:100vh; overflow:hidden; margin:0;
  font-family:var(--font-b); color:var(--ink); background:var(--paper);
  -webkit-font-smoothing:antialiased;

  *{box-sizing:border-box}
  button{font:inherit;color:inherit;cursor:pointer;border:0;background:none}
  input,select{font:inherit;color:inherit}
  :focus-visible{outline:2px solid var(--orange);outline-offset:2px;border-radius:6px}

  .app{display:grid;grid-template-rows:52px 1fr;height:100vh}
  .topbar{display:flex;align-items:center;gap:10px;padding:0 14px;background:var(--indigo-deep);color:#fff}
  .back{flex:none;display:grid;place-items:center;width:30px;height:30px;border-radius:8px;color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.14)}
  .back:hover{background:rgba(255,255,255,.08);color:#fff}
  .brand{flex:none;display:flex;align-items:center;gap:9px;padding-right:12px;border-right:1px solid rgba(255,255,255,.14)}
  .mark{width:26px;height:26px;border-radius:8px;background:linear-gradient(145deg,var(--orange),#ff9a4d);
    display:grid;place-items:center;font-family:var(--font-d);font-weight:800;font-size:14px;color:#2a1000}
  .brand b{font-family:var(--font-d);font-weight:700;font-size:14.5px}
  .brand span{font-size:10.5px;color:rgba(255,255,255,.55);letter-spacing:.08em;text-transform:uppercase}
  .jname{font-family:var(--font-d);font-weight:600;font-size:15px;background:transparent;border:1px solid transparent;
    color:#fff;padding:5px 9px;border-radius:8px;flex:1 1 200px;min-width:100px;max-width:270px}
  .jname:hover{background:rgba(255,255,255,.07)}
  .jname:focus{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.25);outline:none}
  .pill{flex:none;font-family:var(--font-m);font-size:10.5px;letter-spacing:.1em;padding:4px 8px;border-radius:5px;
    background:rgba(255,106,31,.18);color:#ffb083}
  .meta{flex:none;white-space:nowrap;font-size:11.5px;color:rgba(255,255,255,.45);font-family:var(--font-m)}
  .spacer{flex:1}
  .tb-btn{flex:none;white-space:nowrap;display:flex;align-items:center;gap:7px;padding:7px 11px;border-radius:8px;
    font-size:13px;font-weight:500;color:rgba(255,255,255,.82);border:1px solid rgba(255,255,255,.16)}
  .tb-btn:hover{background:rgba(255,255,255,.09);color:#fff}
  .tb-btn.primary{background:var(--orange);border-color:var(--orange);color:#fff;font-weight:600}
  .tb-btn.primary:hover{background:#ff7d3b}
  .tb-btn.ghost{border-color:transparent}
  .tb-btn.icon{padding:7px 9px}
  .tb-btn[disabled]{opacity:.35;cursor:not-allowed}
  @media (max-width:1560px){.meta{display:none}}
  @media (max-width:1330px){.tb-btn .lbl{display:none}.tb-btn{padding:7px 9px}}

  .wrap{display:grid;grid-template-columns:250px 1fr;min-height:0}
  .palette{background:var(--white);border-right:1px solid var(--line);overflow-y:auto;padding:14px 0 40px}
  .pal-head{padding:0 16px 12px}
  .pal-head h2{font-family:var(--font-d);font-size:13px;margin:0 0 3px}
  .pal-head p{margin:0;font-size:11.5px;color:var(--muted);line-height:1.45}
  .grp{border-top:1px solid var(--line2);padding:12px 14px 4px}
  .grp-h{display:flex;align-items:center;gap:8px;width:100%;padding:0 0 10px;text-align:left}
  .grp-h b{font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink2)}
  .grp-h .dot{width:6px;height:6px;border-radius:2px}
  .grp-h .chev{margin-left:auto;color:var(--faint);transition:transform .16s}
  .grp.closed .chev{transform:rotate(-90deg)}
  .grp.closed .grp-body{display:none}
  .grp-body{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding-bottom:10px}
  .tile{border:1px solid var(--line);border-radius:9px;padding:9px 8px;display:flex;flex-direction:column;gap:6px;
    background:#fff;text-align:left;transition:border-color .14s,box-shadow .14s;min-height:64px;cursor:grab;
    user-select:none;-webkit-user-select:none}
  .tile:hover{border-color:var(--c);box-shadow:var(--shadow-1)}
  .tile:active{cursor:grabbing}
  .tile .ic{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;background:var(--bg);color:var(--c)}
  .tile span{font-size:11.5px;font-weight:500;line-height:1.25;color:var(--ink2)}
  .dragpreview{position:fixed;z-index:200;pointer-events:none;opacity:.9;transform:translate(-50%,-50%) rotate(-1.5deg)}
  .pal-search{padding:0 14px 12px;position:relative}
  .pal-search input{width:100%;padding:8px 10px 8px 30px;border:1px solid var(--line);border-radius:8px;font-size:12.5px;background:#fff}
  .pal-search input:focus{outline:none;border-color:var(--indigo);box-shadow:0 0 0 3px rgba(34,38,92,.1)}
  .pal-search .si{position:absolute;left:23px;top:9px;color:var(--faint);pointer-events:none}
  .pal-empty{display:none;padding:2px 16px 12px;font-size:12px;color:var(--faint)}

  .stage{position:relative;overflow:hidden;background:
    radial-gradient(circle at 1px 1px, #d9ddee 1px, transparent 0) 0 0/22px 22px, var(--paper);cursor:grab}
  .stage.panning{cursor:grabbing}
  .stage.dropzone{background:radial-gradient(circle at 1px 1px, #c3c9e6 1px, transparent 0) 0 0/22px 22px, #eef0fa;
    box-shadow:inset 0 0 0 2px rgba(255,106,31,.35)}
  #world{position:absolute;top:0;left:0;transform-origin:0 0}
  #edges{position:absolute;top:0;left:0;overflow:visible;transform-origin:0 0;pointer-events:none}
  .edge{pointer-events:auto}

  .node{position:absolute;z-index:15;width:262px;background:#fff;border:1.5px solid var(--line);border-radius:12px;
    box-shadow:var(--shadow-1);display:flex;transition:box-shadow .15s,border-color .15s;cursor:grab;
    user-select:none;-webkit-user-select:none}
  .node:active{cursor:grabbing}
  .node.dragging{box-shadow:var(--shadow-2);z-index:30;cursor:grabbing}
  .node:hover{box-shadow:var(--shadow-2)}
  .node.sel{border-color:var(--indigo);box-shadow:0 0 0 3px rgba(34,38,92,.12),var(--shadow-2)}
  .node.invalid{border-color:var(--red)}
  .node.linktarget{border-color:var(--orange);box-shadow:0 0 0 4px rgba(255,106,31,.18)}
  .node .side{width:44px;flex:none;display:grid;place-items:center;background:var(--bg);color:var(--c);
    border-right:1px solid var(--line2);border-radius:10px 0 0 10px}
  .node .nb{flex:1;padding:9px 11px;min-width:0;display:block}
  .node .kind{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);font-weight:600}
  .node .ttl{font-family:var(--font-d);font-size:13.5px;font-weight:600;margin-top:1px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .node .sub{font-size:11px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .node .sub.warn{color:var(--red)}
  .node .count{flex:none;display:flex;flex-direction:column;justify-content:center;align-items:center;
    padding:0 9px;border-left:1px solid var(--line2);background:#fbfbff;border-radius:0 10px 10px 0}
  .node .count b{font-family:var(--font-m);font-size:11.5px;font-weight:700}
  .node .count i{font-style:normal;font-size:8.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}
  /* Students parked on this step right now — amber, because a number that keeps
     climbing here is the first sign of a journey stuck behind a wait. */
  .node .count u{text-decoration:none;font-size:8.5px;font-weight:600;color:var(--amber);margin-top:2px;white-space:nowrap}
  .node-tools{position:absolute;top:-13px;left:8px;display:none;gap:3px;background:#fff;border:1px solid var(--line);
    border-radius:7px;padding:2px;box-shadow:var(--shadow-1);z-index:25}
  .node:hover .node-tools,.node.sel .node-tools{display:flex}
  .node-tools button{width:22px;height:20px;display:grid;place-items:center;color:var(--muted);border-radius:5px}
  .node-tools button:hover{background:var(--paper);color:var(--ink)}
  .node-tools button.del:hover{background:var(--red-soft);color:var(--red)}

  .pin,.pout{position:absolute;border-radius:50%;background:#fff;border:1.5px solid #b9bfd8;z-index:22}
  .pin{width:11px;height:11px;transform:translate(-50%,-55%)}
  .pout{width:14px;height:14px;transform:translate(-50%,-45%);cursor:crosshair;display:grid;place-items:center;color:transparent}
  .pout:hover,.pout.hot{border-color:var(--orange);background:var(--orange);color:#fff;transform:translate(-50%,-45%) scale(1.25)}
  .pout svg{width:8px;height:8px}
  .pin.armed{border-color:var(--orange);background:var(--orange-soft);width:15px;height:15px}
  .pout.used{background:#b9bfd8}
  .blabel{position:absolute;transform:translate(-50%,0);font-size:9.5px;font-weight:700;letter-spacing:.03em;
    color:var(--faint);white-space:nowrap;pointer-events:none;z-index:21;max-width:90px;overflow:hidden;text-overflow:ellipsis}
  .blabel.t{color:var(--teal)}
  .blabel.f{color:var(--orange-ink)}

  .emid{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;gap:5px;z-index:12}
  .emid .ecut{display:none}
  .emid:hover .ecut,.emid.on .ecut{display:grid}
  .echip{position:relative;display:inline-flex;align-items:center;gap:4px;background:var(--amber-soft);
    border:1px solid #f0dcae;border-radius:7px;padding:2px 7px;font-family:var(--font-m);font-size:10px;
    color:var(--amber);white-space:nowrap;cursor:pointer}
  .echip.empty{background:#fff;border-style:dashed;border-color:#c9cee4;color:var(--faint);padding:3px;border-radius:50%}
  .echip:hover{border-color:var(--amber);color:var(--amber)}
  .ecut{position:relative;width:18px;height:18px;border-radius:50%;background:#fff;flex:none;
    border:1px solid var(--line);place-items:center;color:var(--muted)}
  .ecut:hover{border-color:var(--red);color:var(--red);background:var(--red-soft)}
  .edge-hit{stroke:transparent;stroke-width:16;fill:none;cursor:pointer;pointer-events:stroke}
  .edge-line{fill:none;stroke:#aab0cc;stroke-width:1.7;stroke-linejoin:round;pointer-events:none}
  .edge.on .edge-line{stroke:var(--orange);stroke-width:2.2}
  .temp-line{fill:none;stroke:var(--orange);stroke-width:2;stroke-dasharray:5 5;pointer-events:none}

  .hud{position:absolute;right:16px;top:16px;display:flex;flex-direction:column;gap:10px;align-items:flex-end;z-index:30}
  .zoomer{display:flex;flex-direction:column;background:#fff;border:1px solid var(--line);border-radius:9px;
    box-shadow:var(--shadow-1);overflow:hidden}
  .zoomer button{width:32px;height:30px;display:grid;place-items:center;color:var(--ink2);border-bottom:1px solid var(--line2)}
  .zoomer button:last-child{border-bottom:0}
  .zoomer button:hover{background:var(--paper)}
  .minimap{width:186px;height:112px;background:#fff;border:1px solid var(--line);border-radius:9px;
    box-shadow:var(--shadow-1);padding:6px}
  .toggle{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--line);border-radius:20px;
    padding:5px 11px;font-size:11.5px;color:var(--ink2);box-shadow:var(--shadow-1);cursor:pointer}
  .sw{width:26px;height:15px;border-radius:20px;background:#d5d9ea;position:relative;transition:.16s;flex:none}
  .sw::after{content:"";position:absolute;top:2px;left:2px;width:11px;height:11px;border-radius:50%;background:#fff;transition:.16s}
  .sw.on{background:var(--green)}
  .sw.on::after{transform:translateX(11px)}
  .hint-bar{position:absolute;left:16px;bottom:16px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;z-index:30}
  .lg{display:flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--line);border-radius:20px;
    padding:5px 11px;font-size:11px;color:var(--ink2);box-shadow:var(--shadow-1)}
  .lg i{width:7px;height:7px;border-radius:2px;display:block}
  .lg.tip{color:var(--muted)}
  .empty-hint{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;z-index:5}
  .empty-hint div{text-align:center;color:var(--faint);font-size:13px;line-height:1.7}
  .empty-hint b{display:block;font-family:var(--font-d);font-size:15px;color:var(--muted);margin-bottom:4px}

  .scrim{position:fixed;inset:0;background:rgba(19,22,50,.32);opacity:0;pointer-events:none;transition:.2s;z-index:40}
  .scrim.on{opacity:1;pointer-events:auto}
  .drawer{position:fixed;top:0;right:0;height:100%;width:460px;max-width:95vw;background:#fff;z-index:50;
    transform:translateX(102%);transition:transform .24s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;
    box-shadow:var(--shadow-3)}
  .drawer.on{transform:none}
  .dr-head{padding:18px 22px 14px;border-bottom:1px solid var(--line2);display:flex;align-items:flex-start;gap:12px}
  .dr-head .ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--bg);color:var(--c);flex:none}
  .dr-head h3{font-family:var(--font-d);font-size:16px;margin:0}
  .dr-head p{margin:2px 0 0;font-size:12px;color:var(--muted);line-height:1.45}
  .dr-x{margin-left:auto;color:var(--muted);width:28px;height:28px;display:grid;place-items:center;border-radius:7px}
  .dr-x:hover{background:var(--paper);color:var(--ink)}
  .dr-body{flex:1;overflow-y:auto;padding:18px 22px 24px}
  .dr-foot{padding:14px 22px;border-top:1px solid var(--line2);display:flex;gap:10px;align-items:center;background:#fcfcff}
  .btn{padding:9px 15px;border-radius:8px;font-size:13px;font-weight:600;border:1px solid var(--line)}
  .btn:hover{background:var(--paper)}
  .btn.primary{background:var(--indigo-deep);color:#fff;border-color:var(--indigo-deep)}
  .btn.primary:hover{background:#1f2350}
  .btn.danger{color:var(--red);border-color:#f3c8c4}
  .btn.danger:hover{background:var(--red-soft)}
  .btn.sm{padding:6px 11px;font-size:12px;font-weight:500}

  .field{margin-bottom:16px}
  .field label{display:block;font-size:11.5px;font-weight:600;color:var(--ink2);margin-bottom:6px}
  .field label .req{color:var(--orange);margin-left:2px}
  .field .hint{font-size:11px;color:var(--muted);margin-top:5px;line-height:1.45}
  .ctl{width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:8px;background:#fff;font-size:13px}
  .ctl:focus{outline:none;border-color:var(--indigo);box-shadow:0 0 0 3px rgba(34,38,92,.1)}
  select.ctl{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a80a6' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat:no-repeat;background-position:right 10px center;padding-right:30px}
  .ctl.sm{padding:7px 9px;font-size:12.5px}

  /* ── searchable dropdown ──────────────────────────────────────────────
     Sized and coloured off the same tokens as .ctl so it reads as the same
     control family, not a bolted-on widget. */
  .cb{position:relative;width:100%;min-width:0}
  .cb-btn{width:100%;display:flex;align-items:center;gap:8px;padding:9px 11px;
    border:1px solid var(--line);border-radius:8px;background:#fff;font-size:13px;
    text-align:left;cursor:pointer;color:var(--ink);transition:border-color .12s,box-shadow .12s,background .12s}
  .cb-btn:hover{border-color:#b9bed8;background:#fcfcff}
  .cb-btn:focus-visible{outline:none;border-color:var(--indigo);box-shadow:0 0 0 3px rgba(34,38,92,.1)}
  .cb.open .cb-btn{border-color:var(--indigo);box-shadow:0 0 0 3px rgba(34,38,92,.1);background:#fff}
  .cb-btn svg{flex:0 0 auto;margin-left:auto;color:#7a80a6;transition:transform .16s ease}
  .cb.open .cb-btn svg{transform:rotate(180deg)}
  .cb-val{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
  .cb-val.ph{color:#9aa0bf}
  .cb.sm .cb-btn{padding:7px 9px;font-size:12.5px}

  .cb-pop{position:absolute;z-index:60;left:0;right:0;top:calc(100% + 5px);
    background:#fff;border:1px solid var(--line);border-radius:10px;
    box-shadow:0 12px 32px -8px rgba(20,24,60,.24),0 2px 6px rgba(20,24,60,.08);
    overflow:hidden;animation:cbIn .13s ease}
  .cb.up .cb-pop{top:auto;bottom:calc(100% + 5px)}
  @keyframes cbIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
  @media (prefers-reduced-motion:reduce){.cb-pop{animation:none}.cb-btn svg{transition:none}}

  .cb-search{display:flex;align-items:center;gap:7px;padding:8px 10px;border-bottom:1px solid var(--line);color:#9aa0bf}
  .cb-search svg{flex:0 0 auto}
  .cb-q{flex:1;min-width:0;border:0;outline:none;font-size:12.5px;background:none;color:var(--ink)}
  .cb-q::placeholder{color:#9aa0bf}

  .cb-list{max-height:252px;overflow-y:auto;padding:4px;overscroll-behavior:contain}
  .cb-opt{display:block;width:100%;text-align:left;padding:8px 10px;border:0;background:none;
    border-radius:6px;font-size:12.8px;color:var(--ink);cursor:pointer;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  /* .hl is keyboard focus, :hover is the pointer — both get the same treatment so
     moving between the two never makes the highlight jump to two places at once. */
  .cb-opt:hover,.cb-opt.hl{background:#eef0ff;color:var(--indigo)}
  .cb-opt.on{font-weight:600;color:var(--indigo)}
  .cb-opt.on::after{content:'✓';float:right;margin-left:8px;font-weight:700}
  .cb-none{padding:16px 12px;text-align:center;font-size:12.5px;color:#9aa0bf}
  .cb-list::-webkit-scrollbar{width:9px}
  .cb-list::-webkit-scrollbar-thumb{background:#d7dae8;border-radius:9px;border:2px solid #fff}
  .cb-list::-webkit-scrollbar-thumb:hover{background:#c2c6dc}
  .cb.locked .cb-btn{background:var(--paper);color:var(--muted);cursor:not-allowed}

  /* ── label row with an inline action (Preview) ── */
  .lab-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
  .lnk-btn{display:inline-flex;align-items:center;gap:5px;border:0;background:none;padding:0 0 6px;
    color:var(--indigo);font-size:12px;font-weight:600;cursor:pointer}
  .lnk-btn:hover:not(:disabled){text-decoration:underline}
  .lnk-btn:disabled{color:#b6bad2;cursor:not-allowed}

  /* ── split sender address ── */
  .addr{display:grid;grid-template-columns:1fr auto 1.4fr;align-items:center;gap:6px}
  .addr .at{color:var(--muted);font-size:13px}

  /* ── attachment rows ── */
  .filerow{display:grid;grid-template-columns:auto 1fr auto 26px;align-items:center;gap:8px;
    padding:8px 10px;border:1px solid var(--line);border-radius:8px;margin-bottom:6px;background:#fff}
  .filerow svg{color:var(--muted)}
  .filerow .fn{font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .filerow .fs{font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums}

  /* ── bottom sheet ─────────────────────────────────────────────────────── */
  /* fixed, matching .scrim/.drawer — .jb-root sets no position, so absolute would
     escape to whatever ancestor happens to be positioned. */
  .sheet{position:fixed;inset:0;z-index:80;pointer-events:none}
  .sheet.on{pointer-events:auto}
  .sheet-scrim{position:absolute;inset:0;background:rgba(16,20,45,.42);opacity:0;transition:opacity .26s ease}
  .sheet.on .sheet-scrim{opacity:1}
  .sheet-panel{position:absolute;left:0;right:0;bottom:0;max-height:82%;display:flex;flex-direction:column;
    background:#fff;border-radius:18px 18px 0 0;box-shadow:0 -18px 48px -12px rgba(16,20,45,.34);
    transform:translateY(101%);transition:transform .3s cubic-bezier(.22,.9,.3,1)}
  .sheet.on .sheet-panel{transform:none}
  @media (prefers-reduced-motion:reduce){.sheet-panel,.sheet-scrim{transition:none}}
  .sheet-grip{width:38px;height:4px;border-radius:4px;background:#dfe2ef;margin:9px auto 2px;flex:0 0 auto}
  .sheet-head{display:flex;align-items:flex-start;gap:12px;padding:8px 20px 14px;border-bottom:1px solid var(--line);flex:0 0 auto}
  .sheet-head h3{font-size:15px;font-weight:700;color:var(--ink);margin:0}
  .sheet-head p{font-size:12.5px;color:var(--muted);margin:2px 0 0}
  .sheet-head .dr-x{margin-left:auto}
  .sheet-body{padding:16px 20px 22px;overflow:auto;flex:1 1 auto}

  .pv-loading{padding:40px 12px;text-align:center;color:var(--muted);font-size:13px}
  .pv-meta{display:flex;gap:10px;align-items:baseline;font-size:12.5px;margin-bottom:12px}
  .pv-meta b{color:var(--muted);font-weight:600;min-width:56px}
  .pv-meta .ok{color:var(--green)} .pv-meta .bad{color:var(--red)}
  .pv-frame{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}
  .pv-frame iframe{display:block;width:100%;height:46vh;border:0;background:#fff}
  .pv-note{display:flex;gap:8px;margin-top:12px;padding:10px 12px;background:var(--paper);
    border-radius:8px;font-size:12px;color:var(--muted);line-height:1.5}
  .pv-note svg{flex:0 0 auto;margin-top:1px}

  /* WhatsApp preview — the familiar chat bubble, so what you see maps to the phone. */
  .wa-wrap{background:#e9e2d9;border-radius:12px;padding:18px;display:flex;flex-direction:column;gap:8px;align-items:flex-start}
  .wa-bubble{background:#fff;border-radius:10px 10px 10px 2px;padding:11px 13px;max-width:min(420px,100%);
    box-shadow:0 1px 1px rgba(0,0,0,.12);font-size:13.4px;line-height:1.5;color:#111b21}
  .wa-h{font-weight:700;margin-bottom:5px}
  .wa-media{background:#f0f2f5;border-radius:6px;padding:20px;text-align:center;color:#667781;
    font-size:11px;letter-spacing:.06em;margin-bottom:7px}
  .wa-f{color:#667781;font-size:11.5px;margin-top:7px}
  .wa-btns{display:flex;flex-direction:column;gap:5px;width:min(420px,100%)}
  .wa-btn{background:#fff;border-radius:8px;padding:9px;text-align:center;color:#0096de;
    font-size:13px;font-weight:500;box-shadow:0 1px 1px rgba(0,0,0,.12)}
  .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .seg{display:flex;background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:3px;gap:3px}
  .seg button{flex:1;padding:6px 8px;border-radius:6px;font-size:12px;font-weight:500;color:var(--muted)}
  .seg button.on{background:#fff;color:var(--ink);box-shadow:var(--shadow-1);font-weight:600}
  .note{display:flex;gap:9px;padding:10px 12px;background:var(--indigo-soft);border-radius:9px;font-size:11.5px;
    color:#3b4180;line-height:1.5;margin-bottom:18px}
  .note.warn{background:var(--amber-soft);color:#7a5406}
  .note svg{flex:none;margin-top:1px}
  .sect{font-family:var(--font-d);font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
    color:var(--faint);margin:22px 0 12px;padding-top:16px;border-top:1px solid var(--line2)}
  .card{border:1px solid var(--line);border-radius:10px;padding:14px;margin-bottom:12px}
  .card-h{display:flex;align-items:center;gap:10px;margin-bottom:2px}
  .card-h b{font-size:13px;font-weight:600}
  .card-h .sw{margin-left:auto}
  .card p{margin:0;font-size:11.5px;color:var(--muted);line-height:1.5}

  .rrow{display:grid;gap:6px;align-items:center;margin-bottom:7px}
  .rrow.r3{grid-template-columns:1fr 1fr 1fr 26px}
  .rrow.r2{grid-template-columns:1fr 1fr 26px}
  .rrow .x{width:26px;height:26px;border-radius:6px;display:grid;place-items:center;color:var(--faint)}
  .rrow .x:hover{background:var(--red-soft);color:var(--red)}
  .addrow{width:100%;padding:8px;border:1px dashed var(--line);border-radius:8px;font-size:12px;font-weight:600;
    color:var(--muted);display:flex;align-items:center;justify-content:center;gap:6px}
  .addrow:hover{border-color:var(--indigo);color:var(--indigo);background:#fafbff}
  .addrow[disabled]{opacity:.45;cursor:not-allowed}
  .cap{font-size:10.5px;color:var(--faint);font-family:var(--font-m);margin-top:6px}

  .prio{border:1px solid var(--line);border-radius:9px;overflow:hidden}
  .prio-item{display:flex;align-items:center;gap:9px;padding:9px 11px;border-bottom:1px solid var(--line2);font-size:12.5px}
  .prio-item:last-child{border-bottom:0}
  .prio-item .n{font-family:var(--font-m);font-size:10.5px;color:var(--faint);width:14px}
  .prio-item .mv{margin-left:auto;display:flex;gap:2px}
  .prio-item .mv button{width:22px;height:22px;border-radius:5px;display:grid;place-items:center;color:var(--muted)}
  .prio-item .mv button:hover{background:var(--paper);color:var(--ink)}
  .prio-item .mv button[disabled]{opacity:.3;cursor:not-allowed}

  .vrow{display:grid;grid-template-columns:26px 1fr 88px 26px;gap:8px;align-items:center;margin-bottom:7px}
  .vrow .k{font-family:var(--font-m);font-size:12px;font-weight:700;color:var(--ink2);text-align:center}
  .sum{font-size:11.5px;font-weight:600;margin-top:8px}
  .sum.bad{color:var(--red)}
  .sum.ok{color:var(--green)}

  .days{display:flex;gap:6px;margin:12px 0}
  .day{width:34px;height:34px;border-radius:8px;border:1px solid var(--line);font-size:12px;font-weight:600;color:var(--muted)}
  .day.on{background:var(--indigo-deep);border-color:var(--indigo-deep);color:#fff}
  .dgrid{display:grid;grid-template-columns:86px 1fr 16px 1fr;gap:7px;align-items:center;margin-bottom:6px}
  .dgrid span{font-size:12px;color:var(--ink2)}
  .dgrid .to{font-size:11px;color:var(--faint);text-align:center}
  .dgrid.off{opacity:.4}
  .copyall{font-size:11.5px;font-weight:600;color:var(--orange-ink);margin-top:6px}
  .copyall:hover{text-decoration:underline}

  .tmplrow{display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:9px;padding:10px 12px;
    margin-bottom:8px;width:100%;text-align:left}
  .tmplrow:hover{border-color:var(--indigo);background:#fafbff}
  .tmplrow .tag{margin-left:auto;font-family:var(--font-m);font-size:10px;color:var(--muted)}
  .prob{display:flex;gap:9px;align-items:flex-start;padding:10px 12px;border:1px solid #f3d7d4;background:#fffafa;
    border-radius:9px;margin-bottom:8px;font-size:12px;line-height:1.5;width:100%;text-align:left}
  .prob.warn{border-color:#f0dcae;background:#fffdf6}
  .prob svg{color:var(--red);flex:none;margin-top:2px}
  .prob.warn svg{color:var(--amber)}
  .prob:hover{border-color:var(--red)}
  .ok-box{display:flex;gap:9px;padding:12px 14px;background:#f0fbf5;border:1px solid #bfe9d2;border-radius:9px;
    font-size:12.5px;color:#0b6b3e;line-height:1.5}

  .toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,20px);background:var(--indigo-deep);color:#fff;
    padding:11px 18px;border-radius:10px;font-size:13px;box-shadow:var(--shadow-2);opacity:0;pointer-events:none;
    transition:.2s;z-index:80;display:flex;align-items:center;gap:9px;max-width:560px}
  .toast.on{opacity:1;transform:translate(-50%,0)}
  .toast .ok{color:#6ee7b7}.toast .bad{color:#fca5a5}
}
`;

function initBuilder(root, bootOpts = {}) {
  const gid = id => root.querySelector('#' + id);
  const { initial = null, onPersist = null, onVersion = null, loadVersions = null,
          onStatus = null, sendTest = null, options = null, api = {},
          loadPreview = null, uploadAttachment = null, deleteAttachment = null,
          liveVersion = null, deployedGraph = null } = bootOpts;
  let currentJourneyId = bootOpts.journeyId || null;
  // All persistent listeners register on this signal so cleanup tears them down in one call.
  // Under React StrictMode the effect runs twice in dev; without this, canvas/palette listeners
  // would stack and every interaction would fire twice.
  const ac = new AbortController();
  const signal = ac.signal;

  /* ============================ icons ============================ */
  const I = {
    bolt: '<path d="M13 2L4.09 12.97a1 1 0 0 0 .77 1.63H11l-1 7.4 8.91-10.97a1 1 0 0 0-.77-1.63H12z"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    server: '<rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><path d="M6 7h.01M6 17h.01"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>',
    sms: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    push: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
    hook: '<path d="M18 16.98h-5.99M6.38 17.02 9 12M12 5v6M4.5 10.5 8 12M19.5 10.5 16 12"/><circle cx="12" cy="4" r="2"/><circle cx="4" cy="16" r="2"/><circle cx="20" cy="16" r="2"/>',
    tag: '<path d="M20.59 13.41 12 22l-9-9V3h10z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    exit: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    minus: '<circle cx="12" cy="12" r="9"/><path d="M9 12h6"/>',
    attr: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 11 2 2 4-4"/>',
    star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
    split: '<path d="M12 3v6M12 15v6M6 12H3M21 12h-3"/><circle cx="12" cy="12" r="3"/>',
    reach: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="4" cy="6" r="1.6"/><circle cx="4" cy="12" r="1.6"/><circle cx="4" cy="18" r="1.6"/>',
    seg: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6.5 4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    hour: '<path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.41L14 14l2.41-2.41A2 2 0 0 0 17 10.17V2M7 22v-4.17a2 2 0 0 1 .59-1.41L10 14l-2.41-2.41A2 2 0 0 1 7 10.17V2"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    warn: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.2-4.2"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    clip: '<path d="M21.4 11.05 12.25 20.2a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 0 1 5.65 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.83l8.49-8.48"/>',
  };
  const fmtBytes = b => {
    b = +b || 0;
    return b < 1024 ? b + ' B' : (b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : (b / 1048576).toFixed(1) + ' MB');
  };
  const svg = (p, s = 16, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

  /* ============================ domain data ============================ */
  const GROUPS = {
    trigger: { label: 'Trigger', c: '#4c5bd4', bg: '#eef0ff' },
    action: { label: 'Messages & actions', c: '#ff6a1f', bg: '#fff0e7' },
    cond: { label: 'Conditions', c: '#0d9488', bg: '#e4f6f3' },
    flow: { label: 'Wait & flow', c: '#b07408', bg: '#fdf2dc' },
  };
  /*
    ── Dropdown data ──────────────────────────────────────────────────────────
    These come from the server (journeys.php?action=options): the real event keys
    from $EVENT_SOURCE, the real netcore_segments, campaign_lists,
    campaign_templates, wa_templates, wa_senders and attribute names.

    The literals below are the FALLBACK, used only when the options call failed.
    They exist so a network blip degrades the dropdowns instead of leaving the
    builder unusable — but note that a journey configured against a fallback name
    that does not exist in the database will be refused at publish time, which is
    the correct outcome: better a clear refusal than a journey that silently sends
    nothing.
  */
  const OPT = options || {};
  const pick = (arr, fallback) => (Array.isArray(arr) && arr.length ? arr : fallback);
  const names = arr => (Array.isArray(arr) ? arr.map(x => (typeof x === 'string' ? x : x.name)) : []);

  const EVENTS = pick(OPT.events, ['register', 'signin', 'exam_success', 'course_purchase', 'payment_success',
    'mark_attendance', 'came_on_dashboard', 'result_view', 'visited_iap', 'link_assigned']);
  const BIZ_EVENTS = pick(OPT.businessEvents, ['batch_starts_tomorrow', 'exam_window_opens',
    'project_deadline_minus_24h', 'new_batch_published']);
  const ATTRS = pick(OPT.attributes, ['MOBILE', 'EMAIL', 'FIRST_NAME', 'LAST_NAME', 'CITY', 'COLLEGE',
    'GRAD_YEAR', 'EXAM_SCORE', 'EXAM_ATTEMPTED', 'BATCH_CODE', 'TRAINING_STATUS']);
  /*
    Values a WhatsApp template variable can take. TRACKED_LINK is not a profile attribute:
    it resolves at send time to THIS student's own link — the template's destination plus
    phone, medium and the message's rid on the query string. That is the only way a tap can
    be credited to a person who never signs in, because the approved button URL is identical
    in every copy of the message and Netcore will not carry a per-recipient button parameter.
  */
  const TVARS = ['TRACKED_LINK', ...ATTRS];
  const OPS = ['Exists', 'Does not exist', 'Is', 'Is not', 'Contains', 'Does not contain', 'Starts with', 'Ends with', 'Is one of', 'Is not one of'];
  const NOVAL = ['Exists', 'Does not exist'];
  // Order matters: this is the default cost priority for the Reachable-on node.
  // SMS and App push stay listed so the node keeps Netcore's shape, but the engine
  // can never route a student down them — there is no transport (see liveChannels).
  const CHANNELS = ['Email', 'WhatsApp', 'App push', 'SMS'];
  const LIVE_CHANNELS = pick(OPT.liveChannels, ['email', 'whatsapp']);
  const WA = pick(names(OPT.waTemplates), ['(no WhatsApp templates found)']);
  const EM = pick(names(OPT.emailTemplates), ['(no email templates found)']);
  const SMST = ['(SMS has no provider configured)'];
  const SEGS = pick(names(OPT.segments), ['(no segments found)']);
  const LISTS = pick(names(OPT.lists), ['(no lists found)']);
  const WA_SENDERS = pick((OPT.waSenders || []).map(s => s.label), ['(no WhatsApp number configured)']);
  const WA_PROVIDERS = ['netcore', 'meta'];
  /*
    Sending routes a journey can be PINNED to.

    A journey freezes its provider the moment it is published, so flipping the account from
    SendGrid to SES tomorrow leaves everything already running exactly where it is. The blank
    choice means "follow whatever is active", and it carries the current active provider in
    its own label — otherwise the drawer would show an empty field for the most common case
    and give no clue what that actually resolves to.
  */
  const ESP_LABELS = { sendgrid: 'SendGrid', elasticemail: 'Elastic Email', ses: 'Amazon SES' };
  const ESP_ROUTES = pick((OPT.espRoutes || []).map(r => r.id), ['sendgrid', 'elasticemail', 'ses']);
  const WA_ROUTES = pick((OPT.waRoutes || []).map(r => r.id), WA_PROVIDERS);
  const routeName = k => ESP_LABELS[k] || (k ? k[0].toUpperCase() + k.slice(1) : '');
  const ESP_AUTO = `Follow the active provider${OPT.espActive ? ` (${routeName(OPT.espActive)} today)` : ''}`;
  const WA_AUTO = `Follow the number’s provider${OPT.waActive ? ` (${routeName(OPT.waActive)} today)` : ''}`;
  const routeLabel = (v, auto) => (v && v !== 'auto' ? routeName(v) : auto);
  const routeValue = (label, list, auto) => (label === auto ? 'auto' : (list.find(k => routeName(k) === label) || 'auto'));
  const SEND_DOMAINS = pick(OPT.sendingDomains, ['alert.internshipstudio.com']);
  const OTHER_JOURNEYS = pick(names(OPT.journeys), ['(no other journeys)']);
  const REPEAT = ['Every time this event happens', 'First time this event happens', 'Every day', 'Every week',
    'Every month', 'Once every specific duration', 'Skip user if already in the journey'];
  const CHECK_FREQ = ['Every hour', 'Every day', 'Every week', 'Every 2 weeks', 'Every month', 'Every 2 months', 'Once every specific duration'];
  const ACT_TYPES = ['App / web activity', 'Email activity', 'WhatsApp activity', 'SMS activity', 'App push activity', 'Web push activity'];
  /*
    The statuses each channel can actually report, which is not the same as the statuses the
    reference product lists. Only what this panel records is offered, because a dropdown entry
    that no source can ever produce is a trigger that looks configured and never fires — the
    exact failure this whole feature existed to fix. See journey_engagement_spec() in
    lib/JourneyEngagement.php; the two lists are meant to stay in step.

    'Deliver' is absent for email on purpose: whether it can ever be true depends entirely on
    provider setup, so offering it would be offering a trigger that silently never fires on
    some configurations. Elastic Email's webhooks are a paid feature; Amazon SES reports
    delivery for free but only once a configuration set with an SNS event destination is wired
    up (see campaigns/ses-webhook.php). If delivery receipts are confirmed arriving — journeys
    → health shows last7Days.email.delivered climbing — this can be added; the backend half
    already exists (journey_engagement_spec() maps 'deliver' for email).
  */
  const STATUSES = {
    'Email activity': ['Open', 'Click', 'Hard bounce', 'Unsubscribe', 'Spam report'],
    'WhatsApp activity': ['Open / Read', 'Deliver', 'Click', 'Reply', 'Fail'],
    'SMS activity': [], 'App push activity': [], 'Web push activity': [],
  };
  /** Channels with no transport on this server: selectable, but the node says so plainly. */
  const DEAD_ACT_TYPES = ['SMS activity', 'App push activity', 'Web push activity'];
  const isEngagement = c => c.type && c.type !== 'App / web activity';

  /*
    Communication scoping — "opened THE email" rather than "opened AN email".
    Without it an engagement trigger fires on any message the person has ever engaged with,
    which in an account sending 6,000 campaigns means it fires constantly and for no clear reason.
  */
  const COMMS = ['Any message', 'Campaign', 'Journey'];
  /* Parsed back to hours by journey_backfill_hours() — the label carries the number. */
  const BACKFILL_OPTS = ['Only from now on', 'Last 1 hour', 'Last 6 hours', 'Last 24 hours',
                         'Last 3 days', 'Last 7 days', 'Last 30 days'];
  const ALL_CAMPAIGNS = Array.isArray(OPT.campaigns) ? OPT.campaigns : [];
  const campaignsFor = c => {
    const want = c.type === 'WhatsApp activity' ? 'whatsapp' : 'email';
    const list = ALL_CAMPAIGNS.filter(x => x.channel === want);
    return list.length ? list.map(x => `${x.name} #${x.id}`) : ['(no sent campaigns on this channel)'];
  };
  /* The id rides along in the label ("iCAT 175 Last Batch #9642") so these stay plain string
     selects; the server pulls it back out (journey_engagement_scope_from_cfg). Keeping the name
     in the saved config is what makes a journey readable when it is reopened months later.

     The journey being edited is excluded. On a TRIGGER a self-reference is circular and can
     never fire — nobody is in the journey until it fires, and it cannot send until they are in.
     On a condition or a wait it is merely the wrong tool: "did they open what I just sent them"
     is what the Wait-for-event step is for, and that watches forward from the student's actual
     position instead of scanning the journey's whole history.

     A config saved before this still displays its value — the dropdown shows the stored label
     whether or not it is in the list — it just cannot be re-picked. */
  const JOURNEY_LABELS = (OPT.journeys || [])
    .filter(j => !currentJourneyId || Number(j.id) !== Number(currentJourneyId))
    .map(j => `${j.name} #${j.id}`);

  /*
    The message steps of the journey currently picked, as labels the server can parse back.
    "Welcome email (n4)" carries the node id in brackets the same way the journey picker carries
    its id after a #, which keeps every field in this group a plain string select.

    Empty is not an error state: a journey with no message steps yet, or one whose steps are all
    on the other channel, legitimately offers nothing but "Any message".
  */
  const ANY_MESSAGE = 'Any message in that journey';
  /*
    The message steps of the chosen journey.

    Two sources, and the order matters:

      the live canvas   when the chosen journey is THIS one. The options payload is a snapshot
                        taken when the builder mounted, so a step added in this session — or one
                        added and saved but not yet re-fetched — would otherwise be missing from
                        its own picker, which reads as the feature being broken.
      the options list  for any other journey, parsed server-side from its saved graph.

    An empty result is never rendered as a bare "Any message": that is indistinguishable from a
    list that failed to load. It says which channel it looked for and that the journey has none,
    so a mismatch (Email activity pointed at a WhatsApp-only journey) explains itself.
  */
  const messageStepsFor = c => {
    const jid  = Number((/#(\d+)\s*$/.exec(String(c.journeyRefId || '')) || [])[1] || 0);
    const want = c.type === 'WhatsApp activity' ? 'whatsapp' : 'email';
    const nodeKey = want === 'whatsapp' ? 'act_wa' : 'act_email';
    const chLabel = want === 'whatsapp' ? 'WhatsApp' : 'Email';

    if (!jid) return [ANY_MESSAGE];

    /* The live canvas when the reference is to this journey — only reachable now through a
       config saved before self-references were removed from the picker, but it still has to
       render its steps rather than look broken. */
    let steps;
    if (currentJourneyId && Number(currentJourneyId) === jid) {
      steps = Object.values(nodes)
        .filter(n => n.key === nodeKey)
        .map(n => ({ id: n.id, label: (n.cfg && n.cfg.template) || `${chLabel} step` }));
    } else {
      const j = (OPT.journeys || []).find(x => Number(x.id) === jid);
      steps = (j?.steps || []).filter(s => s.channel === want);
    }

    if (!steps.length) return [ANY_MESSAGE, `(that journey has no ${chLabel} steps)`];
    return [ANY_MESSAGE, ...steps.map(s => `${s.label} (${s.id})`)];
  };

  /*
    The scoping fields, shared verbatim by the trigger, the condition and the wait node. Written
    once because the three must agree exactly — a wait that watches a wider scope than the
    condition that follows it produces a journey where "wait until they open it" and "did they
    open it" disagree, which is close to impossible to debug from the canvas.
  */
  const ENGAGEMENT_SCOPE_FIELDS = [
    { k: 'comm', t: 'select', l: 'Which message', o: COMMS, d: 'Any message', when: isEngagement,
      hint: 'Narrow this to one campaign or one journey, or leave it on Any message to react to engagement with anything we have sent.' },
    { k: 'campaignId', t: 'select', l: 'Campaign', o: c => campaignsFor(c), req: 1, ph: 'Select a campaign',
      when: c => isEngagement(c) && c.comm === 'Campaign' },
    { k: 'journeyRefId', t: 'select', l: 'Journey', o: JOURNEY_LABELS.length ? JOURNEY_LABELS : ['(no journeys yet)'],
      req: 1, ph: 'Select a journey', when: c => isEngagement(c) && c.comm === 'Journey' },
    /*
      Which send inside that journey. A journey routinely carries four or five emails and
      WhatsApps, so "opened something from the nurture journey" is almost never the branch
      anyone means — this is where the choice actually gets made. Filtered to the activity type
      already chosen: picking Email activity and then being offered WhatsApp steps would be
      offering a combination that can never match.
    */
    { k: 'messageNodeId', t: 'select', l: 'Which message step', o: c => messageStepsFor(c),
      ph: 'Any message in that journey',
      when: c => isEngagement(c) && c.comm === 'Journey',
      hint: 'Leave on “Any message” to react to engagement with any send from that journey, or pick one step to react only to that message.' },
    { k: '__deadch', t: 'note', when: c => DEAD_ACT_TYPES.includes(c.type),
      text: 'This channel has no provider configured on this server, so it never produces events and this step can never fire. Use Email activity or WhatsApp activity.' },
  ];

  const T = {
    trg_activity: {
      g: 'trigger', ic: I.bolt, name: 'Activity', kind: 'Trigger',
      desc: 'Start the journey the moment a student does something.', out: ['Yes'],
      f: [{ k: 'type', t: 'select', l: 'Activity type', o: ACT_TYPES, req: 1, d: 'App / web activity' },
      { k: 'event', t: 'select', l: 'Event', o: EVENTS, req: 1, ph: 'Select an event', when: c => c.type === 'App / web activity' },
      { k: 'status', t: 'select', l: 'Status', o: c => STATUSES[c.type] || [], req: 1, ph: 'Select a status', when: c => c.type !== 'App / web activity' },
      ...ENGAGEMENT_SCOPE_FIELDS,
      /*
        The look-back. Without it this trigger only ever sees engagement that happens AFTER the
        journey is published — which breaks the obvious way to use it, because the natural order
        of work is send the campaign, look at the opens, then build the journey to chase them.
        By then every open it was built for is already in the past and the journey silently
        enrols nobody.

        Applied once, on the first tick after publishing; the watermark takes over from there,
        so nothing is ever read twice. Default is off, because retroactively enrolling people
        into a live journey is a decision rather than a default.
      */
      { k: 'backfillHours', t: 'select', l: 'Include engagement from before publishing',
        o: BACKFILL_OPTS, d: 'Only from now on', when: isEngagement,
        hint: 'Runs once, the first time the journey ticks after you publish. The repeat-frequency rule below still applies, so nobody is enrolled twice.' },
      { k: 'params', t: 'rules', l: 'Match on event parameters', max: 5, keys: 'payload', hint: 'Optional. Up to 5 parameters from the event payload.',
        when: c => !isEngagement(c) },
      { k: 'repeat', t: 'select', l: 'Repeat frequency', o: REPEAT, req: 1, d: 'First time this event happens' },
      { k: 'ramount', t: 'number', l: 'Every', d: '5', when: c => c.repeat === 'Once every specific duration' },
      { k: 'runit', t: 'select', l: 'Unit', o: ['days', 'weeks', 'months'], d: 'days', when: c => c.repeat === 'Once every specific duration' },
      { k: 'skip', t: 'check', l: 'Skip the student if they are already inside this journey', hint: 'A student counts as inside the journey while they are sitting at a wait or a delay.' }],
      s: c => (c.type === 'App / web activity' ? c.event : (c.type && c.status ? c.type.split(' ')[0] + ' · ' + c.status : '')) || 'Pick an event',
    },
    trg_segment: {
      g: 'trigger', ic: I.users, name: 'Segment', kind: 'Trigger',
      desc: 'Start when a student enters a saved segment.', out: ['Yes'],
      f: [{ k: 'segment', t: 'select', l: 'Segment', o: SEGS, req: 1, ph: 'Select a segment' },
      { k: 'freq', t: 'select', l: 'Check the segment', o: CHECK_FREQ, req: 1, d: 'Every day' },
      { k: 'famount', t: 'number', l: 'Every', d: '5', when: c => c.freq === 'Once every specific duration' },
      { k: 'funit', t: 'select', l: 'Unit', o: ['days', 'weeks', 'months'], d: 'days', when: c => c.freq === 'Once every specific duration' },
      { k: 'users', t: 'seg', l: 'Who enters', o: ['All students', 'Only new ones'], d: 'Only new ones', hint: 'Locked once the journey is published.' }],
      s: c => c.segment || 'Pick a segment',
    },
    trg_list: {
      g: 'trigger', ic: I.list, name: 'List', kind: 'Trigger',
      desc: 'Start for everyone on an uploaded list.', out: ['Yes'],
      f: [{ k: 'list', t: 'select', l: 'List', o: LISTS, req: 1, ph: 'Select a list' },
      { k: 'freq', t: 'select', l: 'Check the list', o: CHECK_FREQ, req: 1, d: 'Every day' },
      { k: 'users', t: 'seg', l: 'Who enters', o: ['All students', 'Only new ones'], d: 'Only new ones', hint: 'Locked once the journey is published.' }],
      s: c => c.list || 'Pick a list',
    },
    trg_business: {
      g: 'trigger', ic: I.server, name: 'Business event', kind: 'Trigger',
      desc: 'Start from something your systems do — a batch starting, a deadline approaching — and target students by their own history.',
      out: ['Yes'],
      f: [{ k: 'event', t: 'select', l: 'Business event', o: BIZ_EVENTS, req: 1, ph: 'Select an event' },
      { k: 'source', t: 'select', l: 'Source', o: ['Any source', 'Any website', 'Any app', 'A specific website', 'A specific app'], d: 'Any source' },
      { k: 'sourceRef', t: 'text', l: 'Which one', ph: 'domain or app id', when: c => c.source === 'A specific website' || c.source === 'A specific app' },
      { k: 'map', t: 'rules', l: 'Match the event to students', max: 5, keys: 'ctx', req: 1, hint: 'Context mapping. “batch_code equals BATCH_CODE” sends the batch-start event only to students in that batch.' },
      { k: 'timeCond', t: 'select', l: 'When the student activity happened', o: ['Any day', 'Between two dates', 'In the past N days', 'Exactly N days before'], d: 'In the past N days' },
      { k: 'fromDate', t: 'date', l: 'From', when: c => c.timeCond === 'Between two dates' },
      { k: 'toDate', t: 'date', l: 'To', when: c => c.timeCond === 'Between two dates' },
      { k: 'nDays', t: 'number', l: 'Number of days', d: '30', when: c => c.timeCond === 'In the past N days' || c.timeCond === 'Exactly N days before' },
      { k: 'occ', t: 'select', l: 'Occurrences', o: ['At least once', 'All occurrences', 'A specific number of times', 'Number of visits', 'Occurrences in a visit'], d: 'At least once' },
      { k: 'occN', t: 'number', l: 'How many', d: '1', when: c => ['A specific number of times', 'Number of visits', 'Occurrences in a visit'].includes(c.occ) }],
      s: c => c.event || 'Pick a business event',
    },
    act_wa: {
      g: 'action', ic: I.chat, name: 'WhatsApp', kind: 'Message', desc: 'Send an approved WhatsApp template.',
      out: ['Sent', 'Failed'], test: 1,
      f: [{ k: 'template', t: 'select', l: 'Template', o: WA, req: 1, ph: 'Select a template', preview: 'whatsapp' },
      { k: 'sender', t: 'select', l: 'Sender number', o: WA_SENDERS, d: WA_SENDERS[0] },
      // Blank follows WhatsApp Settings for that number. Pinning it here means a step
      // cannot silently change route the day someone edits Settings.
      { k: 'provider', t: 'select', l: 'Send through', o: WA_PROVIDERS, ph: 'Use the number’s default',
        hint: 'Netcore is the working route today — a direct Meta Cloud send needs the Meta app connected to the WABA.' },
      { k: 'params', t: 'rules', l: 'Template variables', max: 5, keys: 'tvar',
        hint: 'Map {{1}}, {{2}} … to student attributes. Pick TRACKED_LINK to put this student’s own link in the message — it carries their phone and this message’s id, so the tap is logged and credited to them even if they never sign in.' },
      { k: 'buttonUrl', t: 'text', l: 'Button link value', ph: 'Leave blank — the button URL is fixed at approval',
        hint: 'Only for templates whose button URL ends in a variable, and only on the Meta route: Netcore accepts a button parameter and never delivers it, so WhatsApp rejects the whole message (131008). Use a TRACKED_LINK variable in the body instead.' }],
      s: c => c.template || 'Pick a template',
    },
    act_email: {
      g: 'action', ic: I.mail, name: 'Email', kind: 'Message', desc: 'Send a transactional or campaign email.',
      out: ['Sent', 'Failed'], test: 1,
      f: [{ k: 'template', t: 'select', l: 'Template', o: EM, req: 1, ph: 'Select a template', preview: 'email' },
      { k: 'senderName', t: 'text', l: 'Sender name', ph: 'iStudio' },
      { k: 'senderLocal', t: 'addr', l: 'Sender email', domainKey: 'from', domains: SEND_DOMAINS, ph: 'contact' },
      { k: 'subject', t: 'text', l: 'Subject line override', ph: 'Leave blank to use the template subject' },
      { k: 'preheader', t: 'text', l: 'Pre-header', ph: 'Shown next to the subject in most inboxes' },
      { k: 'replyTo', t: 'text', l: 'Reply-to email', ph: 'Optional — replies go to the sender address otherwise' },
      { k: 'attachments', t: 'files', l: 'Attachments', hint: 'Max 5MB per file, 15MB per step.' }],
      s: c => c.template || 'Pick a template',
    },
    act_sms: {
      g: 'action', ic: I.sms, name: 'SMS', kind: 'Message', desc: 'Send a DLT-approved SMS.', out: ['Sent', 'Failed'], test: 1,
      f: [{ k: 'template', t: 'select', l: 'DLT template', o: SMST, req: 1, ph: 'Select a template' }],
      s: c => c.template || 'Pick a template',
    },
    act_push: {
      g: 'action', ic: I.push, name: 'App push', kind: 'Message', desc: 'Send a push notification to the iStudio app.',
      out: ['Sent', 'Failed'], test: 1,
      f: [{ k: 'title', t: 'text', l: 'Title', req: 1, ph: 'Your batch starts tomorrow' },
      { k: 'body', t: 'text', l: 'Body', ph: 'Tap to see your joining link' },
      { k: 'deeplink', t: 'text', l: 'Deep link', ph: 'istudio://batch/current' }],
      s: c => c.title || 'Write the push copy',
    },
    act_attr: {
      g: 'action', ic: I.tag, name: 'Update attribute', kind: 'Action', desc: 'Write a value back onto the student profile.',
      out: ['Done'],
      f: [{ k: 'attr', t: 'select', l: 'Attribute', o: ATTRS, req: 1, ph: 'Select an attribute' },
      { k: 'value', t: 'text', l: 'New value', req: 1, ph: 'e.g. active' }],
      s: c => c.attr ? `${c.attr} = ${c.value || '…'}` : 'Pick an attribute',
    },
    act_remove: {
      g: 'action', ic: I.minus, name: 'Remove from journey', kind: 'Action',
      desc: 'Pull the student out of another journey — including any delay they are waiting in.', out: ['Done'],
      f: [{ k: 'journey', t: 'select', l: 'Journey', o: OTHER_JOURNEYS, req: 1, ph: 'Select a journey' }],
      s: c => c.journey || 'Pick a journey',
    },
    act_hook: {
      g: 'action', ic: I.hook, name: 'Call a service', kind: 'Action',
      desc: 'Call an iStudio endpoint — unlock the portal, issue a certificate, sync a CRM.', out: ['Called', 'Failed'],
      f: [{ k: 'url', t: 'text', l: 'Endpoint', req: 1, ph: 'https://api.internshipstudio.com/v1/…' },
      { k: 'method', t: 'seg', l: 'Method', o: ['POST', 'PUT', 'GET'], d: 'POST' },
      { k: 'body', t: 'text', l: 'Payload keys', ph: 'user_id, batch_code' }],
      s: c => c.url || 'Add an endpoint',
    },
    act_exit: {
      g: 'action', ic: I.exit, name: 'Exit journey', kind: 'Action', desc: 'The student leaves the journey here.', out: [],
      f: [{ k: 'reason', t: 'text', l: 'Reason (for reporting)', req: 1, ph: 'Converted' }],
      s: c => c.reason || 'Give it a reason',
    },
    cnd_attr: {
      g: 'cond', ic: I.attr, name: 'Check attribute', kind: 'Condition',
      desc: 'Split on what the profile says right now.', out: ['True', 'False'],
      f: [{ k: 'match', t: 'seg', l: 'Match', o: ['All rules', 'Any rule'], d: 'All rules' },
      { k: 'rules', t: 'rules', l: 'Rules', max: 10, keys: 'attr', req: 1 },
      { k: '__note', t: 'note', text: 'Attribute checks are skipped for anonymous students — they will take the False path.' }],
      s: c => {
        const r = (c.rules || [])[0];
        if (!r || !r.a) return 'Set a rule';
        const more = (c.rules.length > 1) ? ` +${c.rules.length - 1}` : '';
        return `${r.a} ${(r.op || 'is').toLowerCase()} ${NOVAL.includes(r.op) ? '' : (r.v || '')}${more}`.trim();
      },
    },
    cnd_event: {
      g: 'cond', ic: I.star, name: 'Has done event', kind: 'Condition',
      desc: 'Split on whether the student acted inside a time window.', out: ['True', 'False'],
      f: [{ k: 'type', t: 'select', l: 'Activity type', o: ACT_TYPES, req: 1, d: 'App / web activity' },
      { k: 'event', t: 'select', l: 'Event', o: EVENTS, req: 1, ph: 'Select an event', when: c => c.type === 'App / web activity' },
      { k: 'status', t: 'select', l: 'Status', o: c => STATUSES[c.type] || [], req: 1, ph: 'Select a status', when: c => c.type !== 'App / web activity' },
      ...ENGAGEMENT_SCOPE_FIELDS,
      { k: 'wtype', t: 'select', l: 'Look back', o: ['Past number of minutes', 'Past number of hours', 'Past number of days', 'Custom date range', 'Last 180 days'], req: 1, d: 'Past number of hours' },
      { k: 'wamount', t: 'number', l: 'How many', d: '24', req: 1, when: c => c.wtype !== 'Last 180 days' && c.wtype !== 'Custom date range', hint: '180 days is the furthest the event store goes back.' },
      { k: 'wfrom', t: 'date', l: 'From', when: c => c.wtype === 'Custom date range' },
      { k: 'wto', t: 'date', l: 'To', when: c => c.wtype === 'Custom date range' },
      { k: 'params', t: 'rules', l: 'Match on event parameters', max: 5, keys: 'payload', when: c => !isEngagement(c) }],
      s: c => {
        const e = c.type === 'App / web activity' ? c.event : c.status;
        if (!e) return 'Pick an event';
        if (c.wtype === 'Last 180 days') return `${e} · last 180 days`;
        if (c.wtype === 'Custom date range') return `${e} · custom range`;
        return `${e} · past ${c.wamount || ''} ${(c.wtype || '').replace('Past number of ', '')}`;
      },
    },
    cnd_reach: {
      g: 'cond', ic: I.reach, name: 'Reachable on', kind: 'Condition',
      desc: 'Try channels in order of cost. Each student takes the first branch they are reachable on.',
      out: c => (c.channels && c.channels.length ? c.channels : CHANNELS).concat(['Unreachable']),
      f: [{ k: 'channels', t: 'priority', l: 'Channel priority', d: ['Email', 'App push', 'WhatsApp', 'SMS'], hint: 'Cheapest first. A student unreachable on every channel takes the Unreachable branch.' }],
      s: c => (c.channels || ['Email', 'App push', 'WhatsApp', 'SMS']).join(' → '),
    },
    cnd_split: {
      g: 'cond', ic: I.split, name: 'Split traffic', kind: 'Condition',
      desc: 'Send a share down each path to compare them.',
      out: c => (c.variants || [{ key: 'A' }, { key: 'B' }]).map(v => v.key),
      f: [{ k: 'variants', t: 'variants', l: 'Variants', max: 5, d: [{ key: 'A', pct: 50 }, { key: 'B', pct: 50 }], req: 1 },
      { k: 'metric', t: 'select', l: 'Compare on', o: ['Exam started', 'Batch joined', 'Course purchased', 'Portal login'], d: 'Exam started' },
      { k: '__note', t: 'note', text: 'A student keeps the same variant if they re-enter the journey. Changing the percentages after publishing can move students to a different variant.' }],
      s: c => (c.variants || []).map(v => v.pct + '%').join(' / ') || 'Set the split',
    },
    cnd_in_segment: {
      g: 'cond', ic: I.seg, name: 'Is in segment', kind: 'Condition',
      desc: 'Check whether the student is currently in a segment.', out: ['True', 'False'],
      f: [{ k: 'segments', t: 'multi', l: 'Segments', o: SEGS, max: 5, req: 1, hint: 'Up to 5. True if the student is in any of them.' }],
      s: c => (c.segments || []).length ? `${c.segments.length} segment${c.segments.length > 1 ? 's' : ''}` : 'Pick a segment',
    },
    cnd_in_list: {
      g: 'cond', ic: I.list, name: 'Is in list', kind: 'Condition',
      desc: 'Check whether the student is on a list.', out: ['True', 'False'],
      f: [{ k: 'lists', t: 'multi', l: 'Lists', o: LISTS, max: 5, req: 1, hint: 'Up to 5.' }],
      s: c => (c.lists || []).length ? `${c.lists.length} list${c.lists.length > 1 ? 's' : ''}` : 'Pick a list',
    },
    flw_wait: {
      g: 'flow', ic: I.hour, name: 'Wait', kind: 'Wait', desc: 'Hold the student here before the next step.', out: ['Next'],
      f: [{ k: 'mode', t: 'select', l: 'Wait for', o: ['A fixed period', 'A specific time of day', 'A specific day of the week'], req: 1, d: 'A fixed period' },
      { k: 'amount', t: 'number', l: 'Duration', d: '1', req: 1, when: c => c.mode === 'A fixed period' },
      { k: 'unit', t: 'select', l: 'Unit', o: ['minutes', 'hours', 'days'], d: 'hours', when: c => c.mode === 'A fixed period' },
      { k: 'time', t: 'time', l: 'Time', d: '10:00', when: c => c.mode === 'A specific time of day' },
      { k: 'dow', t: 'select', l: 'Day', o: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], d: 'Monday', when: c => c.mode === 'A specific day of the week' }],
      s: c => c.mode === 'A fixed period' ? `${c.amount || 1} ${c.unit || 'hours'}` : (c.mode === 'A specific time of day' ? `daily at ${c.time || '10:00'}` : (c.dow || 'Set a wait')),
    },
    flw_event: {
      g: 'flow', ic: I.clock, name: 'Wait for event', kind: 'Wait',
      desc: 'Hold until the student acts, or until the window closes.', out: ['Happened', 'Timed out'],
      /*
        The activity-type selector is what turns this node into the one everybody actually
        reaches for: "send the email, wait a day, and take the Timed out branch for the people
        who never opened it." Before it, this node could only watch app events, so the open —
        the single most useful thing to wait on — was unreachable.
      */
      f: [{ k: 'type', t: 'select', l: 'Wait for', o: ACT_TYPES, req: 1, d: 'App / web activity' },
      { k: 'event', t: 'select', l: 'Event', o: EVENTS, req: 1, ph: 'Select an event', when: c => !isEngagement(c) },
      { k: 'status', t: 'select', l: 'Status', o: c => STATUSES[c.type] || [], req: 1, ph: 'Select a status', when: isEngagement },
      ...ENGAGEMENT_SCOPE_FIELDS,
      { k: 'amount', t: 'number', l: 'Give up after', d: '24', req: 1 },
      { k: 'unit', t: 'select', l: 'Unit', o: ['minutes', 'hours', 'days'], d: 'hours' },
      { k: '__watch', t: 'note',
        text: 'Only what happens AFTER the student reaches this step counts — an open from before they got here does not resolve the wait.' }],
      s: c => {
        const what = isEngagement(c) ? (c.status ? `${c.type.split(' ')[0]} ${c.status.toLowerCase()}` : '') : c.event;
        return what ? `${what} · ${c.amount || 24} ${c.unit || 'hours'}` : 'Pick something to wait for';
      },
    },
  };

  const PALETTE = [
    { g: 'trigger', keys: ['trg_activity', 'trg_segment', 'trg_list', 'trg_business'] },
    { g: 'action', keys: ['act_wa', 'act_email', 'act_sms', 'act_push', 'act_attr', 'act_remove', 'act_hook', 'act_exit'] },
    { g: 'cond', keys: ['cnd_attr', 'cnd_event', 'cnd_reach', 'cnd_split', 'cnd_in_segment', 'cnd_in_list'] },
    { g: 'flow', keys: ['flw_wait', 'flw_event'] },
  ];

  function OUT(n) { const t = T[n.key]; return typeof t.out === 'function' ? t.out(n.cfg || {}) : t.out; }
  const TRUEISH = ['True', 'Happened', 'Yes', 'A', 'Sent', 'Called', 'Done'];
  const FALSEISH = ['False', 'Timed out', 'B', 'Failed', 'Unreachable'];

  /* ============================ state ============================ */
  const NW = 262, NH = 66, GRID = 10, OFF = 10000;
  let nodes = {}, edges = {}, seq = 1, sel = null, selEdge = null, showCounts = true, snap = true;
  let selSet = new Set();          // multi-selection of node ids
  let serverProblems = [];         // blocking reasons returned by the last publish attempt
  let counts = bootOpts.counts || null;   // real per-node counts from the engine
  let clipboard = null;            // { nodes:[{key,cfg,dx,dy}], edges:[{from,branch,to}] }
  let guideEls = [];               // active alignment guide lines during a drag
  const lastTest = {};             // remembers the last test recipient per channel kind
  let view = { x: 100, y: 60, k: 1 }, undoStack = [], redoStack = [], status = 'DRAFT';
  let settings = {
    start: '2026-08-06T10:00', end: 'Never ending', endDate: '', tags: ['offcampusly', 'icat'],
    goal: false, goalEvent: 'batch_allotted', goalWindow: '72',
    control: false, controlMode: 'Percentage', controlPct: 10,
    dnd: true, dndDays: [1, 1, 1, 1, 1, 1, 1], dndTimes: Array.from({ length: 7 }, () => ({ f: '21:00', t: '09:30' })),
    /*
      Cap OFF by default. Netcore's own rule is that frequency capping is on for
      broadcasts and OFF for journeys — a journey is a designed sequence, and silently
      dropping its third step because an unrelated journey messaged the student this
      morning is almost never what the author meant. Shipping it on at 2/day meant
      every new journey suppressed itself the moment a student was in two journeys.
    */
    cap: false, capN: 2, capScope: 'Per channel',
  };
  // Dirty tracking: compare the current graph/settings/name against the last saved baseline.
  const baseline = () => JSON.stringify({ nodes, edges, settings, name: gid('jname').value });
  let savedBaseline = '';

  /*
    ── "Saved" and "live" are two different things ─────────────────────────────
    A deployed journey runs the version PINNED at publish time, never the draft, so
    that a half-finished edit cannot leak out to students mid-flight. The cost is
    that Save draft on a running journey changes NOTHING for the engine — which is
    how a canvas showing "Email → wait 3 minutes → WhatsApp" ends up live as a
    version that has no WhatsApp step at all, sending the email and stopping dead.

    deployedFp is the fingerprint of the version actually executing. Everything that
    changes execution is in it; positions are not, so Tidy up never claims the
    journey is out of date.
  */
  let liveVersionNo = liveVersion;
  const sortDeep = v => Array.isArray(v) ? v.map(sortDeep)
    : (v && typeof v === 'object'
        ? Object.keys(v).sort().reduce((o, k) => { o[k] = sortDeep(v[k]); return o; }, {})
        : v);
  function execFp(ns, es) {
    const n = Object.values(ns || {})
      .map(x => `${x.id}|${x.key}|${JSON.stringify(sortDeep(x.cfg || {}))}`).sort();
    const e = Object.values(es || {})
      .map(x => `${x.from}|${x.branch}|${x.to}|${x.wait ? `${parseInt(x.wait.amount, 10) || 0} ${x.wait.unit || 'hours'}` : ''}`).sort();
    return JSON.stringify([n, e]);
  }
  let deployedFp = deployedGraph ? execFp(deployedGraph.nodes, deployedGraph.edges) : null;
  const isLiveStatus = () => status === 'ONGOING' || status === 'SCHEDULED';
  const changesAreLive = () => !deployedFp || deployedFp === execFp(nodes, edges);

  const uid = p => p + (seq++);
  const snapv = v => snap ? Math.round(v / GRID) * GRID : Math.round(v);

  const snapState = () => JSON.stringify({ nodes, edges, seq });
  function undoBtns() {
    const u = gid('btnUndo'), r = gid('btnRedo');
    if (u) u.disabled = !undoStack.length;
    if (r) r.disabled = !redoStack.length;
  }
  function snapshot() {
    undoStack.push(snapState()); if (undoStack.length > 60) undoStack.shift();
    redoStack = [];              // a new action forks history — the redo branch is gone
    undoBtns();
  }
  function restore(s) {
    const st = JSON.parse(s);
    nodes = st.nodes; edges = st.edges; seq = st.seq;
    sel = null; selEdge = null; selSet.clear();
  }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapState());
    restore(undoStack.pop());
    undoBtns(); render(); toast('Undone.');
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapState());
    restore(redoStack.pop());
    undoBtns(); render(); toast('Redone.');
  }

  function defaults(t) { const o = {}; (t.f || []).forEach(f => { if (f.d !== undefined) o[f.k] = JSON.parse(JSON.stringify(f.d)); }); return o; }
  function addNode(key, x, y, cfg) {
    const n = { id: uid('n'), key, cfg: Object.assign(defaults(T[key]), cfg || {}), x: snapv(x), y: snapv(y) };
    nodes[n.id] = n; return n;
  }
  function connect(from, branch, to, wait) {
    if (from === to) return { err: 'A step can’t connect to itself.' };
    if (reaches(to, from)) return { err: 'That would loop the journey back on itself.' };
    Object.values(edges).forEach(e => { if (e.from === from && e.branch === branch) delete edges[e.id]; });
    const e = { id: uid('e'), from, branch, to, wait: wait || null }; edges[e.id] = e; return { e };
  }
  function reaches(a, b) {
    const seen = new Set(), st = [a];
    while (st.length) {
      const c = st.pop(); if (c === b) return true; if (seen.has(c)) continue; seen.add(c);
      Object.values(edges).forEach(e => { if (e.from === c) st.push(e.to); });
    }
    return false;
  }
  function delNode(id) {
    delete nodes[id];
    Object.values(edges).forEach(e => { if (e.from === id || e.to === id) delete edges[e.id]; });
  }
  const outEdges = id => Object.values(edges).filter(e => e.from === id);
  const inEdges = id => Object.values(edges).filter(e => e.to === id);
  const triggers = () => Object.values(nodes).filter(n => T[n.key].g === 'trigger');

  function pruneEdges(n) {
    const valid = new Set(OUT(n)); let dropped = 0;
    outEdges(n.id).forEach(e => { if (!valid.has(e.branch)) { delete edges[e.id]; dropped++; } });
    return dropped;
  }
  function visibleFields(n) { return (T[n.key].f || []).filter(f => f.t !== 'note' && (!f.when || f.when(n.cfg))); }
  function badCfg(n) {
    const c = n.cfg;
    for (const f of visibleFields(n)) {
      if (!f.req) continue;
      const v = c[f.k];
      if (f.t === 'rules') { if (!Array.isArray(v) || !v.length || v.some(r => !r.a || !r.op || (!NOVAL.includes(r.op) && !String(r.v || '').trim()))) return true; }
      else if (f.t === 'multi') { if (!Array.isArray(v) || !v.length) return true; }
      else if (f.t === 'variants') {
        if (!Array.isArray(v) || v.length < 2) return true;
        if (v.reduce((s, x) => s + (+x.pct || 0), 0) !== 100) return true;
      }
      else if (!String(v ?? '').trim()) return true;
    }
    return false;
  }

  function outPort(n, i) { const c = OUT(n).length || 1; return { x: n.x + NW * ((i + 1) / (c + 1)), y: n.y + NH }; }
  const inPort = n => ({ x: n.x + NW / 2, y: n.y });

  /* ============================ seed ============================ */
  function seed() {
    nodes = {}; edges = {}; seq = 1;
    const a = addNode('trg_activity', 60, 40, { type: 'App / web activity', event: 'registration_complete', repeat: 'First time this event happens', skip: true });
    const c = addNode('cnd_attr', 60, 206, { match: 'All rules', rules: [{ a: 'EXAM_ATTEMPTED', op: 'Is', v: 'No' }] });
    const wa = addNode('act_wa', -210, 392, { template: 'icat_exam_nudge' });
    const em = addNode('act_email', 330, 392, { template: 'iCAT v172 — exam reminder' });
    const hd = addNode('cnd_event', -210, 578, { type: 'App / web activity', event: 'exam_started', wtype: 'Past number of hours', wamount: '24' });
    const ex = addNode('act_exit', -460, 764, { reason: 'Started the exam' });
    const sm = addNode('act_sms', -70, 764, { template: 'ICAT_REMIND_01' });
    const ex2 = addNode('act_exit', 330, 578, { reason: 'Already attempted' });
    connect(a.id, 'Yes', c.id, { amount: '5', unit: 'minutes' });
    connect(c.id, 'True', wa.id, { amount: '1', unit: 'hours' });
    connect(c.id, 'False', em.id);
    connect(wa.id, 'Sent', hd.id, { amount: '24', unit: 'hours' });
    connect(hd.id, 'True', ex.id);
    connect(hd.id, 'False', sm.id);
    connect(em.id, 'Sent', ex2.id);
    connect(wa.id, 'Failed', sm.id);
  }

  /* ============================ render ============================ */
  const stage = gid('stage'), world = gid('world'), esvg = gid('edges');

  function edgePath(ax, ay, bx, by) {
    const x1 = ax + OFF, y1 = ay + OFF, x2 = bx + OFF, y2 = by + OFF;
    if (y2 - y1 > 44) {
      const my = y1 + Math.max(28, (y2 - y1) / 2);
      return `M${x1} ${y1} L${x1} ${my} L${x2} ${my} L${x2} ${y2 - 5}`;
    }
    const d = 40, mx = x1 + (x2 >= x1 ? 1 : -1) * Math.max(Math.abs(x2 - x1) / 2, NW / 2 + 40);
    return `M${x1} ${y1} L${x1} ${y1 + d} L${mx} ${y1 + d} L${mx} ${y2 - d} L${x2} ${y2 - d} L${x2} ${y2 - 5}`;
  }
  function pathMid(x1, y1, x2, y2) {
    if (y2 - y1 > 44) return { x: (x1 + x2) / 2, y: y1 + Math.max(28, (y2 - y1) / 2) };
    const side = (x2 >= x1 ? 1 : -1) * Math.max(Math.abs(x2 - x1) / 2, NW / 2 + 40);
    return { x: x1 + side, y: (y1 + y2) / 2 };
  }
  function branchClass(b) { return TRUEISH.includes(b) ? ' t' : (FALSEISH.includes(b) ? ' f' : ''); }

  function render() {
    world.innerHTML = ''; let s = '';
    gid('emptyHint').style.display = Object.keys(nodes).length ? 'none' : 'grid';
    s += `<defs><marker id="ah" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
        <path d="M1 1 L5 4 L1 7" fill="none" stroke="#8b91b0" stroke-width="1.6" stroke-linecap="round"/></marker>
        <marker id="ahs" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
        <path d="M1 1 L5 4 L1 7" fill="none" stroke="#ff6a1f" stroke-width="1.8" stroke-linecap="round"/></marker></defs>`;

    Object.values(edges).forEach(e => {
      const a = nodes[e.from], b = nodes[e.to]; if (!a || !b) { delete edges[e.id]; return; }
      const i = OUT(a).indexOf(e.branch), p = outPort(a, i < 0 ? 0 : i), q = inPort(b);
      const d = edgePath(p.x, p.y, q.x, q.y), on = selEdge === e.id;
      s += `<g class="edge${on ? ' on' : ''}" data-edge="${e.id}">
          <path class="edge-line" d="${d}" marker-end="url(#${on ? 'ahs' : 'ah'})"/>
          <path class="edge-hit" d="${d}"/></g>`;
      const m = pathMid(p.x, p.y, q.x, q.y);
      const mid = document.createElement('div');
      mid.className = 'emid' + (on ? ' on' : ''); mid.dataset.mid = e.id;
      mid.style.left = m.x + 'px'; mid.style.top = m.y + 'px';
      mid.innerHTML = `<button class="echip${e.wait ? '' : ' empty'}" data-wait="${e.id}"
          title="${e.wait ? 'Edit the delay on this connection' : 'Add a delay before the next step'}">
          ${e.wait ? `${svg(I.hour, 10)} ${e.wait.amount} ${e.wait.unit}` : svg(I.clock, 12)}</button>
        <button class="ecut" data-cut="${e.id}" title="Remove this connection">${svg(I.x, 10)}</button>`;
      world.appendChild(mid);
    });
    esvg.innerHTML = s;

    Object.values(nodes).forEach(n => {
      const t = T[n.key], g = GROUPS[t.g], bad = badCfg(n), outs = OUT(n);
      const el = document.createElement('div');
      el.className = 'node' + ((selSet.has(n.id) || sel === n.id) ? ' sel' : '') + (bad ? ' invalid' : '');
      el.style.cssText = `left:${n.x}px;top:${n.y}px;--c:${g.c};--bg:${g.bg}`;
      el.dataset.node = n.id;
      el.innerHTML = `<div class="node-tools">
          <button data-act="cfg" title="Configure">${svg(I.gear, 12)}</button>
          <button data-act="dup" title="Duplicate">${svg(I.copy, 12)}</button>
          <button data-act="del" class="del" title="Delete step">${svg(I.trash, 12)}</button></div>
        <div class="side">${svg(t.ic, 17)}</div>
        <div class="nb"><div class="kind">${t.kind}</div><div class="ttl">${esc(n.cfg.__label || t.name)}</div>
          <div class="sub${bad ? ' warn' : ''}">${bad ? 'Needs setup' : esc(t.s(n.cfg))}</div></div>
        ${showCounts ? (() => {
          const c = nodeCount(n.id);
          const waiting = c.waiting ? `<u title="${c.waiting} waiting here right now">${c.waiting} waiting</u>` : '';
          return `<div class="count" title="${countLabel(n.id) === 'audience'
            ? 'How many contacts are in this list or segment right now'
            : 'Distinct students who have reached this step'}">
              <b>${fmtCount(c.n)}</b><i>${countLabel(n.id)}</i>${waiting}</div>`;
        })() : ''}`;
      world.appendChild(el);

      if (t.g !== 'trigger') {
        const ip = document.createElement('div'); ip.className = 'pin'; ip.dataset.in = n.id;
        ip.style.left = (n.x + NW / 2) + 'px'; ip.style.top = n.y + 'px'; world.appendChild(ip);
      }
      outs.forEach((b, i) => {
        const p = outPort(n, i), used = outEdges(n.id).some(e => e.branch === b);
        const op = document.createElement('div');
        op.className = 'pout' + (used ? ' used' : ''); op.dataset.out = n.id; op.dataset.branch = b;
        op.style.left = p.x + 'px'; op.style.top = p.y + 'px'; op.title = `Drag to connect · ${b}`;
        op.innerHTML = svg(I.plus, 8, 3); world.appendChild(op);
        const lb = document.createElement('div');
        lb.className = 'blabel' + branchClass(b);
        lb.style.left = p.x + 'px'; lb.style.top = (p.y + 9) + 'px'; lb.textContent = b; world.appendChild(lb);
      });
    });
    applyView(); drawMini(); meta();
  }
  /*
    Real counts from the engine, keyed by node id.

    This used to be a decay formula off the node's depth — 48,200 at the trigger,
    62% of that at each step down. It looked like data and was pure decoration, which
    is worse than showing nothing: you cannot tell a working journey from a broken one
    if the numbers are the same either way.

      trigger  the live size of the list or segment it draws from. Activity and
               business-event triggers show a dash, because the population is not
               knowable ahead of time.
      others   how many distinct students have actually reached that step.
  */
  function nodeCount(id) {
    const c = (counts && counts[id]) || null;
    const n = T[nodes[id]?.key]?.g === 'trigger'
      ? (c && c.audience !== null && c.audience !== undefined ? c.audience : null)
      : (c ? c.reached : 0);
    return { n, waiting: c ? c.waiting : 0 };
  }
  function countLabel(id) {
    return T[nodes[id]?.key]?.g === 'trigger' ? 'audience' : 'reached';
  }
  const fmtCount = v => {
    if (v === null || v === undefined) return '—';
    return v >= 10000 ? (v / 1000).toFixed(v >= 100000 ? 0 : 1).replace('.0', '') + 'k' : v.toLocaleString('en-US');
  };
  // depth() lived here only to drive the old simulated node counters. Those now come
  // from the engine, and nothing else walked the graph upwards, so it is gone.
  function applyView() {
    world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`;
    esvg.style.transform = `translate(${view.x - OFF * view.k}px,${view.y - OFF * view.k}px) scale(${view.k})`;
    miniVp();
  }
  function repaintEdges() {
    esvg.querySelectorAll('g.edge').forEach(g => {
      const e = edges[g.dataset.edge]; if (!e) return;
      const a = nodes[e.from], b = nodes[e.to];
      const i = OUT(a).indexOf(e.branch), p = outPort(a, i < 0 ? 0 : i), q = inPort(b);
      const d = edgePath(p.x, p.y, q.x, q.y);
      g.querySelector('.edge-line').setAttribute('d', d);
      g.querySelector('.edge-hit').setAttribute('d', d);
      const m = pathMid(p.x, p.y, q.x, q.y), mid = world.querySelector(`[data-mid="${e.id}"]`);
      if (mid) { mid.style.left = m.x + 'px'; mid.style.top = m.y + 'px'; }
    });
  }
  function movePorts(n) {
    const outs = OUT(n);
    const ip = world.querySelector(`[data-in="${n.id}"]`);
    if (ip) { ip.style.left = (n.x + NW / 2) + 'px'; ip.style.top = n.y + 'px'; }
    world.querySelectorAll(`[data-out="${n.id}"]`).forEach(op => {
      const i = outs.indexOf(op.dataset.branch), p = outPort(n, i < 0 ? 0 : i);
      op.style.left = p.x + 'px'; op.style.top = p.y + 'px';
    });
  }
  function drawLabels() {
    world.querySelectorAll('.blabel').forEach(b => b.remove());
    Object.values(nodes).forEach(n => OUT(n).forEach((b, i) => {
      const p = outPort(n, i), lb = document.createElement('div');
      lb.className = 'blabel' + branchClass(b);
      lb.style.left = p.x + 'px'; lb.style.top = (p.y + 9) + 'px'; lb.textContent = b; world.appendChild(lb);
    }));
  }

  function bounds() {
    const xs = [], ys = []; Object.values(nodes).forEach(n => { xs.push(n.x, n.x + NW); ys.push(n.y, n.y + NH); });
    if (!xs.length) return { x: 0, y: 0, w: 800, h: 600 };
    const x = Math.min(...xs) - 60, y = Math.min(...ys) - 60;
    return { x, y, w: Math.max(...xs) - x + 60, h: Math.max(...ys) - y + 60 };
  }
  function drawMini() {
    const m = gid('mini'), b = bounds(), s = Math.min(174 / b.w, 100 / b.h);
    let o = '';
    Object.values(edges).forEach(e => {
      const a = nodes[e.from], c = nodes[e.to]; if (!a || !c) return;
      o += `<line x1="${(a.x + NW / 2 - b.x) * s}" y1="${(a.y + NH - b.y) * s}" x2="${(c.x + NW / 2 - b.x) * s}" y2="${(c.y - b.y) * s}" stroke="#c3c9e6" stroke-width="1"/>`;
    });
    Object.values(nodes).forEach(n => {
      const g = GROUPS[T[n.key].g];
      o += `<rect x="${(n.x - b.x) * s}" y="${(n.y - b.y) * s}" width="${NW * s}" height="${NH * s}" rx="2" fill="${g.c}" opacity=".8"/>`;
    });
    o += '<rect id="mvp" fill="none" stroke="#131632" stroke-width="1" opacity=".45"/>';
    m.innerHTML = o; m.dataset.bx = b.x; m.dataset.by = b.y; m.dataset.s = s; miniVp();
  }
  function miniVp() {
    const m = gid('mini'), r = m.querySelector('#mvp'); if (!r) return;
    const bx = +m.dataset.bx, by = +m.dataset.by, s = +m.dataset.s;
    r.setAttribute('x', (-view.x / view.k - bx) * s); r.setAttribute('y', (-view.y / view.k - by) * s);
    r.setAttribute('width', Math.min(174, stage.clientWidth / view.k * s));
    r.setAttribute('height', Math.min(100, stage.clientHeight / view.k * s));
  }
  function fit() {
    const b = bounds();
    view.k = Math.max(.3, Math.min((stage.clientWidth - 120) / b.w, (stage.clientHeight - 120) / b.h, 1.1));
    view.x = (stage.clientWidth - b.w * view.k) / 2 - b.x * view.k;
    view.y = (stage.clientHeight - b.h * view.k) / 2 - b.y * view.k; applyView();
  }
  const toWorld = (cx, cy) => {
    const r = stage.getBoundingClientRect();
    return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k };
  };

  /* ============================ palette + drag in ============================ */
  function buildPalette() {
    const pal = gid('palette');
    pal.querySelectorAll('.grp').forEach(el => el.remove()); // idempotent re-init (StrictMode)
    PALETTE.forEach(sec => {
      const g = GROUPS[sec.g], d = document.createElement('div'); d.className = 'grp';
      d.innerHTML = `<button class="grp-h"><i class="dot" style="background:${g.c}"></i><b>${g.label}</b><span class="chev">${svg(I.down, 13)}</span></button>
        <div class="grp-body">${sec.keys.map(k => {
        const t = T[k];
        return `<div class="tile" data-key="${k}" style="--c:${g.c};--bg:${g.bg}" title="Drag me onto the canvas">
            <span class="ic">${svg(t.ic, 14)}</span><span>${t.name}</span></div>`;
      }).join('')}</div>`;
      d.querySelector('.grp-h').onclick = () => d.classList.toggle('closed');
      pal.appendChild(d);
    });
    pal.addEventListener('mousedown', e => {
      const tile = e.target.closest('.tile'); if (!tile) return;
      e.preventDefault(); startPaletteDrag(tile, e);
    }, { signal });
  }
  function wirePaletteSearch() {
    const ps = gid('palSearch'); if (!ps) return;
    ps.addEventListener('input', () => {
      const q = ps.value.trim().toLowerCase();
      let anyGlobal = false;
      root.querySelectorAll('.palette .grp').forEach(grp => {
        let any = false;
        grp.querySelectorAll('.tile').forEach(tile => {
          const t = T[tile.dataset.key] || {};
          const show = !q || `${t.name || ''} ${t.kind || ''}`.toLowerCase().includes(q);
          tile.style.display = show ? '' : 'none';
          if (show) any = true;
        });
        grp.style.display = any ? '' : 'none';
        if (q) grp.classList.remove('closed');   // expand so matches are visible while searching
        if (any) anyGlobal = true;
      });
      const empty = gid('palEmpty');
      if (empty) empty.style.display = (q && !anyGlobal) ? 'block' : 'none';
    }, { signal });
  }
  function startPaletteDrag(tile, ev) {
    const key = tile.dataset.key, t = T[key], g = GROUPS[t.g];
    const gh = document.createElement('div'); gh.className = 'dragpreview';
    gh.innerHTML = `<div class="node" style="position:static;--c:${g.c};--bg:${g.bg};width:${NW}px">
      <div class="side">${svg(t.ic, 17)}</div><div class="nb"><div class="kind">${t.kind}</div>
      <div class="ttl">${t.name}</div><div class="sub">Drop to place</div></div></div>`;
    root.appendChild(gh);
    const move = e => {
      gh.style.left = e.clientX + 'px'; gh.style.top = e.clientY + 'px';
      const r = stage.getBoundingClientRect();
      stage.classList.toggle('dropzone', e.clientX > r.left && e.clientY > r.top);
    };
    move(ev);
    const up = e => {
      gh.remove(); stage.classList.remove('dropzone');
      removeEventListener('mousemove', move); removeEventListener('mouseup', up);
      const r = stage.getBoundingClientRect();
      if (e.clientX < r.left || e.clientY < r.top) return;
      if (t.g === 'trigger' && triggers().length) { toast('A journey has one entry point. Delete the current trigger first.', 1); return; }
      snapshot();
      const w = toWorld(e.clientX, e.clientY);
      const n = addNode(key, w.x - NW / 2, w.y - NH / 2);
      sel = n.id; render(); openConfig(n.id);
    };
    addEventListener('mousemove', move); addEventListener('mouseup', up);
  }

  /* ============================ canvas interaction ============================ */
  stage.addEventListener('mousedown', e => {
    const out = e.target.closest('.pout');
    if (out) { e.preventDefault(); e.stopPropagation(); startLink(out); return; }

    /*
      The node's hover toolbar (configure / duplicate / delete) is driven by a CLICK
      handler, and a click only lands if the element that received mousedown is still
      in the document at mouseup. Falling through to the canvas branch below used to
      call render(), which rebuilds every node — destroying the very button being
      pressed, so the click was dispatched on an ancestor and the action was lost.
      Bail out here and let the click handler own it.
    */
    if (e.target.closest('.node-tools')) return;

    const nodeEl = e.target.closest('[data-node]');
    if (nodeEl) { e.preventDefault(); startNodeDrag(nodeEl, e); return; }
    if (e.target.closest('.emid,.hud')) return;
    const hit = e.target.closest('[data-edge]');
    if (hit) { selEdge = hit.dataset.edge; sel = null; selSet.clear(); render(); return; }
    if (e.shiftKey) { startMarquee(e); return; }   // shift-drag on empty canvas = box select
    sel = null; selEdge = null; selSet.clear(); render();
    stage.classList.add('panning');
    const sx = e.clientX - view.x, sy = e.clientY - view.y;
    const mv = ev => { view.x = ev.clientX - sx; view.y = ev.clientY - sy; applyView(); };
    const up = () => { stage.classList.remove('panning'); removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  }, { signal });
  function startNodeDrag(el, ev) {
    const n = nodes[el.dataset.node]; selEdge = null;
    // Shift-click toggles this node in/out of the multi-selection (no drag).
    if (ev.shiftKey) {
      if (selSet.has(n.id)) { selSet.delete(n.id); if (sel === n.id) sel = null; }
      else { selSet.add(n.id); sel = n.id; }
      render(); return;
    }
    // Plain click on a node outside the current selection selects it alone; inside it keeps
    // the group so the whole selection drags together.
    if (!selSet.has(n.id)) selSet = new Set([n.id]);
    sel = n.id;
    // Reflect selection with class tweaks (not a full render) so double-click-to-configure still fires.
    root.querySelectorAll('.node.sel').forEach(x => { if (!selSet.has(x.dataset.node)) x.classList.remove('sel'); });
    const group = [...selSet].map(id => nodes[id]).filter(Boolean);
    group.forEach(g => { const gel = world.querySelector(`[data-node="${g.id}"]`); if (gel) { gel.classList.add('sel'); gel.classList.add('dragging'); } });
    const start = {}; group.forEach(g => { start[g.id] = { x: g.x, y: g.y }; });
    const s = toWorld(ev.clientX, ev.clientY), ox = s.x - n.x, oy = s.y - n.y; let moved = false;
    const single = group.length === 1;
    const mv = e => {
      const w = toWorld(e.clientX, e.clientY);
      let nx = snapv(w.x - ox), ny = snapv(w.y - oy), guides = [];
      if (single) { const snapped = computeSnap(n, nx, ny); nx = snapped.sx; ny = snapped.sy; guides = snapped.guides; }
      const dx = nx - n.x, dy = ny - n.y;
      if (dx || dy) {
        if (!moved && (Math.abs(nx - start[n.id].x) > 2 || Math.abs(ny - start[n.id].y) > 2)) { snapshot(); moved = true; }
        group.forEach(g => {
          g.x += dx; g.y += dy;
          const gel = world.querySelector(`[data-node="${g.id}"]`);
          if (gel) { gel.style.left = g.x + 'px'; gel.style.top = g.y + 'px'; }
          movePorts(g);
        });
        repaintEdges(); drawLabels();
      }
      if (single && guides.length) drawGuides(guides, n); else clearGuides();
    };
    // Only repaint if the node actually moved. A plain click on a node would otherwise
    // rebuild the DOM on mouseup, which swallows the follow-up click (and the second
    // half of a double-click) exactly the way the toolbar bug above did.
    const up = () => {
      clearGuides();
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up);
      group.forEach(g => { const gel = world.querySelector(`[data-node="${g.id}"]`); if (gel) gel.classList.remove('dragging'); });
      if (moved) { render(); return; }
      // Didn't move — treat it as a click and open the step's settings. Dragging a
      // step and configuring it are the two things you do with a node, and requiring
      // a double-click for the second one is a tax on the common case.
      openConfig(n.id);
    };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  }
  /* Alignment snapping: when the dragged node's edge/centre lines up with another node's,
     snap to it and show a guide line. Nodes share width/height so x-alignments collapse to
     "same x" — we still surface the nearest matching edge as the guide. */
  function computeSnap(n, nx, ny) {
    const TH = 6;
    let bestX = null, bestY = null;
    const cand = (a, b, snap) => (Math.abs(a - b) <= TH ? { d: Math.abs(a - b), line: b, snap } : null);
    Object.values(nodes).forEach(o => {
      if (o.id === n.id) return;
      [cand(nx + NW / 2, o.x + NW / 2, o.x), cand(nx, o.x, o.x), cand(nx + NW, o.x + NW, o.x)]
        .forEach(c => { if (c && (!bestX || c.d < bestX.d)) bestX = { ...c, o }; });
      [cand(ny + NH / 2, o.y + NH / 2, o.y), cand(ny, o.y, o.y), cand(ny + NH, o.y + NH, o.y)]
        .forEach(c => { if (c && (!bestY || c.d < bestY.d)) bestY = { ...c, o }; });
    });
    const guides = [];
    if (bestX) guides.push({ type: 'v', at: bestX.line, o: bestX.o });
    if (bestY) guides.push({ type: 'h', at: bestY.line, o: bestY.o });
    return { sx: bestX ? bestX.snap : nx, sy: bestY ? bestY.snap : ny, guides };
  }
  function clearGuides() { guideEls.forEach(el => el.remove()); guideEls = []; }
  function drawGuides(guides, n) {
    clearGuides();
    guides.forEach(gd => {
      const o = gd.o, el = document.createElement('div');
      if (gd.type === 'v') {
        const top = Math.min(n.y, o.y) - 24, bot = Math.max(n.y + NH, o.y + NH) + 24;
        el.style.cssText = `position:absolute;left:${gd.at}px;top:${top}px;height:${bot - top}px;width:0;border-left:1px dashed var(--orange);z-index:14;pointer-events:none`;
      } else {
        const left = Math.min(n.x, o.x) - 24, right = Math.max(n.x + NW, o.x + NW) + 24;
        el.style.cssText = `position:absolute;top:${gd.at}px;left:${left}px;width:${right - left}px;height:0;border-top:1px dashed var(--orange);z-index:14;pointer-events:none`;
      }
      world.appendChild(el); guideEls.push(el);
    });
  }
  /* Shift-drag box select on the empty canvas. Additive over the existing selection. */
  function startMarquee(ev) {
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;border:1.5px solid var(--orange);background:rgba(255,106,31,.09);z-index:35;pointer-events:none';
    stage.appendChild(box);
    const r0 = stage.getBoundingClientRect(), sx = ev.clientX, sy = ev.clientY, base = new Set(selSet);
    const mv = e => {
      const x1 = Math.min(sx, e.clientX), y1 = Math.min(sy, e.clientY), x2 = Math.max(sx, e.clientX), y2 = Math.max(sy, e.clientY);
      box.style.left = (x1 - r0.left) + 'px'; box.style.top = (y1 - r0.top) + 'px';
      box.style.width = (x2 - x1) + 'px'; box.style.height = (y2 - y1) + 'px';
      const a = toWorld(x1, y1), b = toWorld(x2, y2);
      selSet = new Set(base);
      Object.values(nodes).forEach(n => { if (n.x + NW >= a.x && n.x <= b.x && n.y + NH >= a.y && n.y <= b.y) selSet.add(n.id); });
      render();
    };
    const up = () => { box.remove(); removeEventListener('mousemove', mv); removeEventListener('mouseup', up); render(); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  }
  function copySelection() {
    const ids = selSet.size ? [...selSet] : (sel ? [sel] : []);
    if (!ids.length) { toast('Select one or more steps to copy first.', 1); return; }
    const set = new Set(ids);
    const baseX = Math.min(...ids.map(id => nodes[id].x)), baseY = Math.min(...ids.map(id => nodes[id].y));
    clipboard = {
      nodes: ids.map(id => ({ id, key: nodes[id].key, cfg: JSON.parse(JSON.stringify(nodes[id].cfg)), dx: nodes[id].x - baseX, dy: nodes[id].y - baseY })),
      edges: Object.values(edges).filter(e => set.has(e.from) && set.has(e.to)).map(e => ({ from: e.from, branch: e.branch, to: e.to, wait: e.wait ? { ...e.wait } : null })),
    };
    toast(`Copied ${ids.length} step${ids.length > 1 ? 's' : ''}.`);
  }
  function pasteClipboard() {
    if (!clipboard || !clipboard.nodes.length) { toast('Nothing to paste.', 1); return; }
    snapshot();
    const w = toWorld(stage.clientWidth / 2, stage.clientHeight / 2);
    const idMap = {}; const newIds = []; let skippedTrigger = false;
    clipboard.nodes.forEach(cn => {
      if (T[cn.key].g === 'trigger' && triggers().length) { skippedTrigger = true; return; }
      const nn = addNode(cn.key, w.x - NW / 2 + cn.dx, w.y - NH / 2 + cn.dy, JSON.parse(JSON.stringify(cn.cfg)));
      idMap[cn.id] = nn.id; newIds.push(nn.id);
    });
    clipboard.edges.forEach(ce => {
      const from = idMap[ce.from], to = idMap[ce.to];
      if (from && to) { const e = { id: uid('e'), from, branch: ce.branch, to, wait: ce.wait ? { ...ce.wait } : null }; edges[e.id] = e; }
    });
    if (!newIds.length) { undoStack.pop(); undoBtns(); toast('Nothing pasted — only a trigger was copied and one already exists.', 1); return; }
    selSet = new Set(newIds); sel = newIds[newIds.length - 1]; selEdge = null;
    render();
    toast(skippedTrigger ? `Pasted ${newIds.length} — trigger skipped (one entry point only).` : `Pasted ${newIds.length} step${newIds.length > 1 ? 's' : ''}.`);
  }
  function startLink(out) {
    const from = out.dataset.out, branch = out.dataset.branch;
    out.classList.add('hot');
    const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tmp.setAttribute('class', 'temp-line'); esvg.appendChild(tmp);
    world.querySelectorAll('.pin').forEach(p => { if (p.dataset.in !== from) p.classList.add('armed'); });
    const p0 = outPort(nodes[from], OUT(nodes[from]).indexOf(branch));
    let target = null;
    const mv = e => {
      const w = toWorld(e.clientX, e.clientY);
      tmp.setAttribute('d', edgePath(p0.x, p0.y, w.x, w.y + 5));
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cand = el && (el.closest('[data-node]') || el.closest('[data-in]'));
      const id = cand ? (cand.dataset.node || cand.dataset.in) : null;
      if (target && target !== id) { const t = world.querySelector(`[data-node="${target}"]`); t && t.classList.remove('linktarget'); }
      target = (id && id !== from && T[nodes[id].key].g !== 'trigger') ? id : null;
      if (target) { const t = world.querySelector(`[data-node="${target}"]`); t && t.classList.add('linktarget'); }
    };
    const up = () => {
      tmp.remove(); out.classList.remove('hot');
      world.querySelectorAll('.pin').forEach(p => p.classList.remove('armed'));
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up);
      if (target) {
        snapshot();
        const r = connect(from, branch, target);
        if (r.err) { undoStack.pop(); toast(r.err, 1); }
        else toast(inEdges(target).length > 1 ? 'Connected — this step now has two paths feeding it.' : 'Connected.');
      }
      render();
    };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  }
  world.addEventListener('click', e => {
    const chip = e.target.closest('[data-wait]'); if (chip) { openWait(chip.dataset.wait); return; }
    const cut = e.target.closest('[data-cut]');
    if (cut) { snapshot(); delete edges[cut.dataset.cut]; selEdge = null; render(); toast('Connection removed.'); return; }
    const tool = e.target.closest('.node-tools button');
    if (tool) {
      const id = tool.closest('[data-node]').dataset.node, act = tool.dataset.act;
      if (act === 'cfg') openConfig(id);
      if (act === 'del') { snapshot(); delNode(id); selSet.delete(id); sel = null; render(); toast('Step deleted.'); }
      if (act === 'dup') {
        snapshot(); const s = nodes[id];
        const n = addNode(s.key, s.x + 40, s.y + 40, JSON.parse(JSON.stringify(s.cfg))); sel = n.id; render(); toast('Step duplicated.');
      }
      return;
    }
  }, { signal });
  world.addEventListener('dblclick', e => { const el = e.target.closest('[data-node]'); if (el) openConfig(el.dataset.node); }, { signal });
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const k = Math.min(1.8, Math.max(.3, view.k * (e.deltaY < 0 ? 1.1 : .9)));
    const r = stage.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    view.x = mx - (mx - view.x) * (k / view.k); view.y = my - (my - view.y) * (k / view.k); view.k = k; applyView();
  }, { passive: false, signal });

  function onKey(e) {
    const ae = document.activeElement;
    if (ae && /INPUT|SELECT|TEXTAREA/.test(ae.tagName)) return;
    // A focused combobox trigger is a <button>, not a <select>, so the tag test above
    // no longer covers it. Without this, pressing Delete while a dropdown has focus
    // would delete the selected step instead of doing nothing.
    if (ae && ae.closest && ae.closest('.cb')) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k === 'c') { e.preventDefault(); copySelection(); return; }
    if (mod && k === 'v') { e.preventDefault(); pasteClipboard(); return; }
    if (mod && k === 'a') { e.preventDefault(); selSet = new Set(Object.keys(nodes)); sel = null; selEdge = null; render(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const ids = selSet.size ? [...selSet] : (sel ? [sel] : []);
      if (ids.length) { snapshot(); ids.forEach(delNode); selSet.clear(); sel = null; render(); toast(`Deleted ${ids.length} step${ids.length > 1 ? 's' : ''}.`); e.preventDefault(); }
      else if (selEdge) { snapshot(); delete edges[selEdge]; selEdge = null; render(); toast('Connection removed.'); e.preventDefault(); }
    }
    if (e.key === 'Escape') {
      // The sheet sits on top of the drawer, so Escape peels one layer at a time
      // instead of clearing everything at once.
      const sheet = root.querySelector('.sheet.on');
      if (sheet) { closeSheet(); return; }
      closeDrawer(); sel = null; selEdge = null; selSet.clear(); render();
    }
  }
  window.addEventListener('keydown', onKey, { signal });

  function arrange() {
    const roots = Object.values(nodes).filter(n => !inEdges(n.id).length);
    if (!roots.length) { toast('Nothing to arrange yet.', 1); return; }
    snapshot();
    let wc = {};
    function w(id) {
      if (wc[id] != null) return wc[id]; wc[id] = NW;
      const kids = outEdges(id).map(e => e.to); if (!kids.length) return NW;
      let tot = 0; kids.forEach((k, i) => { tot += w(k) + (i ? 40 : 0); }); return wc[id] = Math.max(NW, tot);
    }
    function put(id, cx, depth, seen) {
      if (seen.has(id)) return; seen.add(id);
      nodes[id].x = snapv(cx - NW / 2); nodes[id].y = snapv(depth * (NH + 110));
      const kids = outEdges(id).map(e => e.to).filter(k => !seen.has(k));
      if (!kids.length) return;
      let tot = 0; kids.forEach((k, i) => { tot += w(k) + (i ? 40 : 0); });
      let left = cx - tot / 2;
      kids.forEach(k => { const kw = w(k); put(k, left + kw / 2, depth + 1, seen); left += kw + 40; });
    }
    let offset = 0;
    roots.forEach(r => { wc = {}; const seen = new Set(); put(r.id, offset + w(r.id) / 2, 0, seen); offset += w(r.id) + 120; });
    render(); fit(); toast('Arranged.');
  }

  /* ============================ drawer ============================ */
  const drawer = gid('drawer'), scrim = gid('scrim'),
    drHead = gid('drHead'), drBody = gid('drBody'), drFoot = gid('drFoot');
  function closeDrawer() { drawer.classList.remove('on'); scrim.classList.remove('on'); drBody.onclick = null; }
  scrim.onclick = closeDrawer; window.closeDrawer = closeDrawer;
  function head(ic, c, bg, t, s) {
    drHead.innerHTML = `<div class="ic" style="--c:${c};--bg:${bg}">${svg(ic, 17)}</div>
     <div><h3>${t}</h3><p>${s}</p></div><button class="dr-x" onclick="closeDrawer()">${svg(I.x, 15)}</button>`;
  }
  const opts = (f, cfg) => typeof f.o === 'function' ? f.o(cfg) : (f.o || []);

  function ruleRow(fk, i, r, kind) {
    if (kind === 'attr')
      return `<div class="rrow r3" data-rrow="${fk}:${i}">
        ${combo('data-rk="a"', ATTRS, r.a, 'Attribute', true)}
        ${combo('data-rk="op"', OPS, r.op, 'Is', true)}
        ${NOVAL.includes(r.op) ? '<span class="cap" style="margin:0">—</span>'
          : `<input class="ctl sm" data-rk="v" value="${esc(r.v)}" placeholder="Value">`}
        <button class="x" data-rdel="${fk}:${i}">${svg(I.x, 12)}</button></div>`;
    if (kind === 'ctx')
      return `<div class="rrow r3" data-rrow="${fk}:${i}">
        <input class="ctl sm" data-rk="a" value="${esc(r.a)}" placeholder="event param">
        ${combo('data-rk="op"', ['equals', 'contains'], r.op, 'equals', true)}
        ${combo('data-rk="v"', ATTRS, r.v, 'student attribute', true)}
        <button class="x" data-rdel="${fk}:${i}">${svg(I.x, 12)}</button></div>`;
    if (kind === 'tvar')
      return `<div class="rrow r2" data-rrow="${fk}:${i}">
        <input class="ctl sm" data-rk="a" value="${esc(r.a)}" placeholder="{{1}}">
        ${combo('data-rk="v"', TVARS, r.v, 'attribute', true)}
        <button class="x" data-rdel="${fk}:${i}">${svg(I.x, 12)}</button></div>`;
    return `<div class="rrow r3" data-rrow="${fk}:${i}">
      <input class="ctl sm" data-rk="a" value="${esc(r.a)}" placeholder="param">
      ${combo('data-rk="op"', ['is', 'is not', 'contains', 'greater than', 'less than'], r.op, 'is', true)}
      <input class="ctl sm" data-rk="v" value="${esc(r.v)}" placeholder="value">
      <button class="x" data-rdel="${fk}:${i}">${svg(I.x, 12)}</button></div>`;
  }
  /* ═══════════════════════ searchable dropdown ═══════════════════════
     Replaces every native <select> in the drawer. A native select is unusable
     once a list is long — the WhatsApp template list alone runs to dozens of
     entries with no way to find one except scrolling. This gives type-to-filter,
     full keyboard control, and a hover/active treatment that matches the rest of
     the panel.

     It stays compatible with the existing binding code by keeping a hidden input
     that carries the same data-k / data-mk / data-rk attribute the old <select>
     had. Choosing an option writes that input and dispatches a real `change`
     event, so nothing downstream had to learn about comboboxes.
  ═══════════════════════════════════════════════════════════════════════ */
  let comboSeq = 0;
  function combo(dataAttr, list, value, placeholder, small, disabled) {
    const id = 'cb' + (++comboSeq);
    const has = value !== undefined && value !== null && value !== '';
    if (disabled) {
      // Locked (e.g. the conversion goal after publish). Rendered as a plain read-only
      // field rather than a dead dropdown, so it's obvious it can't be changed.
      return `<div class="cb locked"><input type="hidden" ${dataAttr} value="${esc(has ? value : '')}">
        <div class="cb-btn" aria-disabled="true"><span class="cb-val${has ? '' : ' ph'}">${esc(has ? value : (placeholder || 'Select'))}</span></div></div>`;
    }
    const items = (list || []).map(o => {
      const s = String(o);
      return `<button type="button" class="cb-opt${s === value ? ' on' : ''}" data-v="${esc(s)}" role="option"
                aria-selected="${s === value}">${esc(s)}</button>`;
    }).join('');
    return `<div class="cb${small ? ' sm' : ''}" data-cb="${id}">
      <input type="hidden" ${dataAttr} value="${esc(has ? value : '')}">
      <button type="button" class="cb-btn" aria-haspopup="listbox" aria-expanded="false">
        <span class="cb-val${has ? '' : ' ph'}">${esc(has ? value : (placeholder || 'Select'))}</span>
        ${svg(I.chev, 13)}
      </button>
      <div class="cb-pop" role="listbox" hidden>
        <div class="cb-search">${svg(I.search, 13)}<input class="cb-q" type="text" placeholder="Type to search…" autocomplete="off" spellcheck="false"></div>
        <div class="cb-list">${items}</div>
        <div class="cb-none" hidden>No matches</div>
      </div>
    </div>`;
  }

  function fieldHtml(f, cfg) {
    const v = cfg[f.k], lab = `<label>${f.l}${f.req ? '<span class="req">*</span>' : ''}</label>`;
    const hint = f.hint ? `<div class="hint">${f.hint}</div>` : '';
    switch (f.t) {
      case 'note':
        return `<div class="note">${svg(I.info, 14)}<div>${f.text}</div></div>`;
      case 'select': {
        // A template field gets a Preview button beside its label — checking what
        // actually goes out should not require sending a test to yourself first.
        const prev = f.preview
          ? `<button type="button" class="lnk-btn" data-preview="${f.preview}" ${v ? '' : 'disabled'}>${svg(I.eye, 12)} Preview</button>`
          : '';
        return `<div class="field"><div class="lab-row">${lab}${prev}</div>
          ${combo(`data-k="${f.k}"`, opts(f, cfg), v, f.ph || 'Select')}${hint}</div>`;
      }

      /* Sender address, split the way the campaign wizard splits it: a local part you
         type and a verified domain you pick. Typing a whole address by hand is how
         people end up sending from an unverified domain and land in spam. */
      case 'addr': {
        const dom = cfg[f.domainKey] || f.domains[0];
        return `<div class="field">${lab}
          <div class="addr">
            <input class="ctl" data-k="${f.k}" value="${esc(v)}" placeholder="${esc(f.ph || '')}">
            <span class="at">@</span>
            ${combo(`data-k="${f.domainKey}"`, f.domains, dom, f.domains[0])}
          </div>${hint}</div>`;
      }

      case 'files': {
        const list = Array.isArray(v) ? v : [];
        const total = list.reduce((s, a) => s + (+a.size || 0), 0);
        return `<div class="field">${lab}
          ${list.map((a, i) => `<div class="filerow">
            ${svg(I.clip, 13)}<span class="fn" title="${esc(a.filename)}">${esc(a.filename)}</span>
            <span class="fs">${fmtBytes(a.size)}</span>
            <button class="x" data-fdel="${f.k}:${i}" title="Remove">${svg(I.x, 12)}</button></div>`).join('')}
          <button class="addrow" data-fadd="${f.k}">${svg(I.plus, 12)} Add attachment</button>
          <div class="cap">${fmtBytes(total)} of 15 MB used</div>${hint}</div>`;
      }
      case 'seg':
        return `<div class="field">${lab}<div class="seg" data-k="${f.k}">
          ${opts(f, cfg).map(o => `<button data-v="${esc(o)}" class="${o === v ? 'on' : ''}">${esc(o)}</button>`).join('')}</div>${hint}</div>`;
      case 'check':
        return `<div class="field"><label style="display:flex;gap:9px;align-items:flex-start;cursor:pointer">
          <input type="checkbox" data-k="${f.k}" ${v ? 'checked' : ''} style="margin-top:1px">
          <span style="font-weight:500">${f.l}</span></label>${hint}</div>`;
      case 'time':
        return `<div class="field">${lab}<input class="ctl" type="time" data-k="${f.k}" value="${esc(v || '10:00')}">${hint}</div>`;
      case 'date':
        return `<div class="field">${lab}<input class="ctl" type="date" data-k="${f.k}" value="${esc(v || '')}">${hint}</div>`;
      case 'number':
        return `<div class="field">${lab}<input class="ctl" type="number" min="1" data-k="${f.k}" value="${esc(v)}" placeholder="${esc(f.ph || '')}">${hint}</div>`;
      case 'rules': {
        const rows = Array.isArray(v) ? v : [];
        return `<div class="field">${lab}
          <div data-rules="${f.k}">${rows.map((r, i) => ruleRow(f.k, i, r, f.keys)).join('')}</div>
          <button class="addrow" data-radd="${f.k}" ${rows.length >= f.max ? 'disabled' : ''}>${svg(I.plus, 12)} Add ${f.keys === 'ctx' ? 'mapping' : (f.keys === 'tvar' ? 'variable' : (f.keys === 'attr' ? 'rule' : 'parameter'))}</button>
          <div class="cap">${rows.length} / ${f.max} used</div>${hint}</div>`;
      }
      case 'multi': {
        const chosen = Array.isArray(v) ? v : [];
        return `<div class="field">${lab}
          ${chosen.map((c, i) => `<div class="rrow r2" style="grid-template-columns:1fr 26px">
            ${combo(`data-mk="${f.k}:${i}"`, opts(f, cfg), c, 'Select', true)}
            <button class="x" data-mdel="${f.k}:${i}">${svg(I.x, 12)}</button></div>`).join('')}
          <button class="addrow" data-madd="${f.k}" ${chosen.length >= f.max ? 'disabled' : ''}>${svg(I.plus, 12)} Add</button>
          <div class="cap">${chosen.length} / ${f.max} used</div>${hint}</div>`;
      }
      case 'priority': {
        const list = Array.isArray(v) ? v : CHANNELS;
        return `<div class="field">${lab}<div class="prio">
          ${list.map((c, i) => `<div class="prio-item"><span class="n">${i + 1}</span>${esc(c)}
            <span class="mv"><button data-pmv="${f.k}:${i}:-1" ${i === 0 ? 'disabled' : ''}>${svg(I.up, 12)}</button>
            <button data-pmv="${f.k}:${i}:1" ${i === list.length - 1 ? 'disabled' : ''}>${svg(I.down, 12)}</button></span></div>`).join('')}
          </div>${hint}</div>`;
      }
      case 'variants': {
        const list = Array.isArray(v) ? v : [];
        const sum = list.reduce((s, x) => s + (+x.pct || 0), 0);
        return `<div class="field">${lab}
          ${list.map((x, i) => `<div class="vrow">
            <span class="k">${x.key}</span>
            <input class="ctl sm" data-vk="${f.k}:${i}:label" value="${esc(x.label || '')}" placeholder="Variant ${x.key} — what's different?">
            <input class="ctl sm" type="number" min="0" max="100" data-vk="${f.k}:${i}:pct" value="${x.pct}">
            <button class="x" data-vdel="${f.k}:${i}" ${list.length <= 2 ? 'disabled' : ''}>${svg(I.x, 12)}</button></div>`).join('')}
          <button class="addrow" data-vadd="${f.k}" ${list.length >= f.max ? 'disabled' : ''}>${svg(I.plus, 12)} Add variant</button>
          <div class="sum ${sum === 100 ? 'ok' : 'bad'}">Total ${sum}% ${sum === 100 ? '✓' : '— must be exactly 100%'}</div>
          <div class="cap">${list.length} / ${f.max} variants</div></div>`;
      }
      default:
        return `<div class="field">${lab}<input class="ctl" data-k="${f.k}" value="${esc(v)}" placeholder="${esc(f.ph || '')}">${hint}</div>`;
    }
  }

  function openConfig(id) {
    const n = nodes[id]; if (!n) return;
    sel = id; selEdge = null;
    const t = T[n.key], g = GROUPS[t.g];
    head(t.ic, g.c, g.bg, t.name, t.desc);
    let pre = '';
    if (n.key === 'act_hook') pre = `<div class="note warn">${svg(I.warn, 14)}<div>Beyond Netcore parity — Netcore has no generic outbound call node. Ours needs retry and timeout rules on the engine side.</div></div>`;
    if (n.key === 'cnd_reach') pre = `<div class="note">${svg(I.info, 14)}<div>Reachable counts can only be shown when the journey starts from a list or a segment. With an event trigger the engine can't know the population in advance — priority is still honoured.</div></div>`;
    drBody.innerHTML = pre + (T[n.key].f || []).filter(f => !f.when || f.when(n.cfg)).map(f => fieldHtml(f, n.cfg)).join('') +
      `<div class="sect">Reporting</div><div class="field"><label>Step label</label>
       <input class="ctl" data-k="__label" value="${esc(n.cfg.__label || '')}" placeholder="${esc(t.name)}">
       <div class="hint">Shown on the card and in journey reports — e.g. “48h exam nudge”.</div></div>`;
    bindConfig(n);
    drFoot.innerHTML = `<button class="btn primary" onclick="closeDrawer()">Save step</button>
      ${t.test ? '<button class="btn" id="dTest">Send test</button>' : ''}
      <div style="flex:1"></div><button class="btn danger" id="dDel">Delete step</button>`;
    gid('dDel').onclick = () => { snapshot(); delNode(id); sel = null; closeDrawer(); render(); toast('Step deleted.'); };
    const tb = gid('dTest');
    if (tb) tb.onclick = () => {
      if (badCfg(n)) { toast('Finish setting the step up before sending a test.', 1); return; }
      openSendTest(n);
    };
    drawer.classList.add('on'); scrim.classList.add('on'); render();
  }

  /* ── combobox controller ──────────────────────────────────────────────
     One delegated set of listeners on `root`, registered once. The drawer
     re-renders its innards constantly, so per-element handlers would have to be
     re-bound on every keystroke; delegation survives all of it.
  ──────────────────────────────────────────────────────────────────────── */
  function cbClose(cb) {
    if (!cb) return;
    const pop = cb.querySelector('.cb-pop');
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    cb.classList.remove('open');
    cb.querySelector('.cb-btn').setAttribute('aria-expanded', 'false');
    const q = cb.querySelector('.cb-q'); if (q) q.value = '';
    cb.querySelectorAll('.cb-opt').forEach(o => { o.hidden = false; o.classList.remove('hl'); });
    cb.querySelector('.cb-none').hidden = true;
  }
  const cbCloseAll = except => root.querySelectorAll('.cb.open').forEach(c => { if (c !== except) cbClose(c); });

  function cbOpen(cb) {
    cbCloseAll(cb);
    const pop = cb.querySelector('.cb-pop');
    pop.hidden = false;
    cb.classList.add('open');
    cb.querySelector('.cb-btn').setAttribute('aria-expanded', 'true');
    // If the list would run off the bottom of the drawer, flip it above the button.
    const r = cb.getBoundingClientRect();
    cb.classList.toggle('up', r.bottom + 300 > window.innerHeight && r.top > 320);
    const cur = cb.querySelector('.cb-opt.on') || cb.querySelector('.cb-opt:not([hidden])');
    if (cur) { cur.classList.add('hl'); cur.scrollIntoView({ block: 'nearest' }); }
    cb.querySelector('.cb-q').focus();
  }

  function cbPick(cb, opt) {
    const input = cb.querySelector('input[type="hidden"]');
    const val = opt.dataset.v;
    input.value = val;
    cb.querySelector('.cb-val').textContent = val;
    cb.querySelector('.cb-val').classList.remove('ph');
    cb.querySelectorAll('.cb-opt').forEach(o => { o.classList.remove('on'); o.setAttribute('aria-selected', 'false'); });
    opt.classList.add('on'); opt.setAttribute('aria-selected', 'true');
    cbClose(cb);
    // The rest of the builder listens for `change` on [data-k]/[data-mk]/[data-rk],
    // exactly as it did when these were native selects.
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function cbFilter(cb) {
    const q = cb.querySelector('.cb-q').value.trim().toLowerCase();
    let shown = 0, firstVisible = null;
    cb.querySelectorAll('.cb-opt').forEach(o => {
      const hit = !q || o.textContent.toLowerCase().includes(q);
      o.hidden = !hit;
      o.classList.remove('hl');
      if (hit) { shown++; if (!firstVisible) firstVisible = o; }
    });
    cb.querySelector('.cb-none').hidden = shown > 0;
    if (firstVisible) firstVisible.classList.add('hl');
  }

  function cbMove(cb, dir) {
    const list = [...cb.querySelectorAll('.cb-opt:not([hidden])')];
    if (!list.length) return;
    const i = list.findIndex(o => o.classList.contains('hl'));
    const next = list[Math.max(0, Math.min(list.length - 1, (i < 0 ? 0 : i + dir)))];
    list.forEach(o => o.classList.remove('hl'));
    next.classList.add('hl');
    next.scrollIntoView({ block: 'nearest' });
  }

  root.addEventListener('mousedown', e => {
    // Closing on mousedown rather than click means a click that lands outside
    // dismisses the popup before the other element's own handler runs.
    if (!e.target.closest('.cb')) cbCloseAll(null);
  }, { signal });

  root.addEventListener('click', e => {
    const btn = e.target.closest('.cb-btn');
    if (btn) {
      e.preventDefault(); e.stopPropagation();
      const cb = btn.closest('.cb');
      cb.classList.contains('open') ? cbClose(cb) : cbOpen(cb);
      return;
    }
    const opt = e.target.closest('.cb-opt');
    if (opt) { e.preventDefault(); e.stopPropagation(); cbPick(opt.closest('.cb'), opt); }
  }, { signal });

  root.addEventListener('input', e => {
    if (e.target.classList.contains('cb-q')) cbFilter(e.target.closest('.cb'));
  }, { signal });

  root.addEventListener('keydown', e => {
    const cb = e.target.closest('.cb.open');
    if (!cb) {
      // Space / Enter / Down on a closed trigger opens it, like a native select.
      const t = e.target.closest('.cb-btn');
      if (t && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) { e.preventDefault(); cbOpen(t.closest('.cb')); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); cbMove(cb, 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cbMove(cb, -1); }
    else if (e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation();
      const hl = cb.querySelector('.cb-opt.hl:not([hidden])');
      if (hl) cbPick(cb, hl);
    } else if (e.key === 'Escape') {
      // Stop the drawer's own Escape handler from closing the whole panel — the
      // first Escape should only dismiss the dropdown.
      e.preventDefault(); e.stopPropagation();
      cbClose(cb);
      cb.querySelector('.cb-btn').focus();
    } else if (e.key === 'Tab') {
      cbClose(cb);
    }
  }, { signal });

  /* ═══════════════════════ preview sheet ═══════════════════════
     Slides up from the bottom rather than replacing the config drawer, so the
     step's settings stay on screen behind it — you can see the template and the
     configuration that points at it at the same time.
  ═══════════════════════════════════════════════════════════════ */
  function openSheet(title, sub, bodyHtml) {
    let sheet = root.querySelector('.sheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.className = 'sheet';
      sheet.innerHTML = `<div class="sheet-scrim"></div>
        <div class="sheet-panel" role="dialog" aria-modal="true">
          <div class="sheet-grip"></div>
          <div class="sheet-head"><div><h3></h3><p></p></div>
            <button class="dr-x" data-sheet-close>${svg(I.x, 15)}</button></div>
          <div class="sheet-body"></div>
        </div>`;
      root.appendChild(sheet);
      sheet.addEventListener('click', e => {
        if (e.target.closest('[data-sheet-close]') || e.target.classList.contains('sheet-scrim')) closeSheet();
      });
    }
    sheet.querySelector('h3').textContent = title;
    sheet.querySelector('.sheet-head p').textContent = sub;
    sheet.querySelector('.sheet-body').innerHTML = bodyHtml;
    requestAnimationFrame(() => sheet.classList.add('on'));
  }
  function closeSheet() {
    const sheet = root.querySelector('.sheet');
    if (sheet) sheet.classList.remove('on');
  }

  async function showPreview(kind, ref, subjectOverride) {
    if (!ref) { toast('Pick a template first.', 1); return; }
    openSheet(kind === 'email' ? 'Email preview' : 'WhatsApp preview', 'Loading…',
      '<div class="pv-loading">Loading the template…</div>');
    let d = null;
    try { d = loadPreview ? await loadPreview(kind, ref, subjectOverride) : null; }
    catch (e) { d = null; }
    if (!d) {
      openSheet(kind === 'email' ? 'Email preview' : 'WhatsApp preview', ref,
        `<div class="pv-loading">That template could not be loaded. It may have been archived or renamed —
          reopen the dropdown to pick a current one.</div>`);
      return;
    }

    if (kind === 'email') {
      openSheet('Email preview', d.name,
        `<div class="pv-meta"><b>Subject</b><span>${esc(d.subject || '(no subject)')}</span></div>
         <div class="pv-frame"><iframe sandbox="" title="Email preview"></iframe></div>
         <div class="pv-note">${svg(I.info, 13)}<div>Merge tags are shown as-is. Each student's real values are
           substituted at send time, and tracking is added to every link.</div></div>`);
      // Written through srcdoc into a sandboxed frame: a template is arbitrary HTML
      // from the template editor, and it must not be able to run script in, or restyle,
      // the builder around it.
      const f = root.querySelector('.pv-frame iframe');
      if (f) f.srcdoc = d.html || '<p style="font-family:system-ui;color:#888">This template is empty.</p>';
      return;
    }

    const btns = (d.buttons || []).map(b => `<div class="wa-btn">${esc(b.text || b.label || 'Button')}</div>`).join('');
    openSheet('WhatsApp preview', `${d.name} · ${d.language || 'en'}`,
      `<div class="pv-meta"><b>Status</b><span class="${d.approved ? 'ok' : 'bad'}">${d.approved ? 'Approved by Meta' : esc(d.approval || 'not approved')}</span></div>
       <div class="wa-wrap"><div class="wa-bubble">
         ${d.headerText ? `<div class="wa-h">${esc(d.headerText)}</div>` : ''}
         ${d.headerMedia ? `<div class="wa-media">${esc(String(d.headerType || 'media').toUpperCase())} header</div>` : ''}
         <div class="wa-b">${esc(d.body || '').replace(/\n/g, '<br>')}</div>
         ${d.footer ? `<div class="wa-f">${esc(d.footer)}</div>` : ''}
       </div>${btns ? `<div class="wa-btns">${btns}</div>` : ''}</div>
       <div class="pv-note">${svg(I.info, 13)}<div>Placeholders like {{1}} are filled from this step's
         Template variables. An unmapped variable falls back to the template's sample value.</div></div>`);
  }

  function bindConfig(n) {
    const refresh = () => {
      const d = pruneEdges(n); render(); openConfig(n.id);
      if (d) toast(`${d} connection${d > 1 ? 's' : ''} removed — those branches no longer exist.`, 1);
    };

    drBody.querySelectorAll('[data-k]').forEach(el => {
      if (el.classList.contains('seg')) {
        el.onclick = ev => {
          const b = ev.target.closest('button'); if (!b) return;
          el.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on');
          n.cfg[el.dataset.k] = b.dataset.v; render();
        };
      } else if (el.type === 'checkbox') {
        el.onchange = () => { n.cfg[el.dataset.k] = el.checked; render(); };
      } else {
        const h = () => { n.cfg[el.dataset.k] = el.value; render(); };
        el.oninput = h;
        el.onchange = () => {
          h();
          const f = (T[n.key].f || []).find(x => x.k === el.dataset.k);
          if (f && f.t === 'select' && (T[n.key].f || []).some(x => x.when)) openConfig(n.id);
        };
      }
    });
    drBody.querySelectorAll('[data-preview]').forEach(b => b.onclick = () => {
      showPreview(b.dataset.preview, n.cfg.template, n.cfg.subject);
    });

    /* Attachments. The file goes to storage first and only lands in the step's config
       once the server confirms it — an upload that fails leaves no phantom row. */
    drBody.querySelectorAll('[data-fadd]').forEach(b => b.onclick = () => {
      const fk = b.dataset.fadd;
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.onchange = async () => {
        const file = inp.files && inp.files[0];
        if (!file) return;
        const list = Array.isArray(n.cfg[fk]) ? n.cfg[fk] : [];
        b.disabled = true; b.textContent = 'Uploading…';
        try {
          if (!(await persist())) { toast('Save the step first — the upload was cancelled.', 1); return; }
          const used = list.reduce((s, a) => s + (+a.size || 0), 0);
          const meta = uploadAttachment ? await uploadAttachment(file, used) : null;
          if (!meta) return;
          n.cfg[fk] = list.concat([meta]);
          await persist();
          openConfig(n.id);
          toast(`${meta.filename} attached.`);
        } catch (e) {
          toast(e?.message || 'Upload failed.', 1);
        } finally { b.disabled = false; }
      };
      inp.click();
    });

    drBody.querySelectorAll('[data-fdel]').forEach(b => b.onclick = async () => {
      const [fk, i] = b.dataset.fdel.split(':');
      const list = Array.isArray(n.cfg[fk]) ? n.cfg[fk] : [];
      const gone = list[+i];
      n.cfg[fk] = list.filter((_, j) => j !== +i);
      await persist();
      openConfig(n.id);
      // Best-effort storage cleanup; the step is already correct either way.
      if (gone && gone.s3_key && deleteAttachment) deleteAttachment(gone.s3_key).catch(() => {});
      toast('Attachment removed.');
    });

    drBody.querySelectorAll('[data-rules]').forEach(box => {
      const fk = box.dataset.rules;
      box.querySelectorAll('[data-rrow]').forEach(row => {
        const i = +row.dataset.rrow.split(':')[1];
        row.querySelectorAll('[data-rk]').forEach(inp => {
          const set = () => { n.cfg[fk][i][inp.dataset.rk] = inp.value; render(); };
          inp.oninput = set;
          inp.onchange = () => { set(); if (inp.dataset.rk === 'op') openConfig(n.id); };
        });
      });
    });
    drBody.querySelectorAll('[data-radd]').forEach(b => b.onclick = () => {
      const fk = b.dataset.radd; n.cfg[fk] = n.cfg[fk] || [];
      n.cfg[fk].push({ a: '', op: fk === 'map' ? 'equals' : (T[n.key].f.find(f => f.k === fk).keys === 'attr' ? 'Is' : 'is'), v: '' });
      openConfig(n.id);
    });
    drBody.querySelectorAll('[data-rdel]').forEach(b => b.onclick = () => {
      const [fk, i] = b.dataset.rdel.split(':'); n.cfg[fk].splice(+i, 1); openConfig(n.id);
    });
    drBody.querySelectorAll('[data-mk]').forEach(s => s.onchange = () => {
      const [fk, i] = s.dataset.mk.split(':'); n.cfg[fk][+i] = s.value; render();
    });
    drBody.querySelectorAll('[data-madd]').forEach(b => b.onclick = () => {
      const fk = b.dataset.madd, f = T[n.key].f.find(x => x.k === fk);
      n.cfg[fk] = n.cfg[fk] || []; n.cfg[fk].push(opts(f, n.cfg)[0]); openConfig(n.id);
    });
    drBody.querySelectorAll('[data-mdel]').forEach(b => b.onclick = () => {
      const [fk, i] = b.dataset.mdel.split(':'); n.cfg[fk].splice(+i, 1); openConfig(n.id);
    });
    drBody.querySelectorAll('[data-pmv]').forEach(b => b.onclick = () => {
      const [fk, i, d] = b.dataset.pmv.split(':'), arr = n.cfg[fk], a = +i, bIdx = a + +d;
      [arr[a], arr[bIdx]] = [arr[bIdx], arr[a]]; refresh();
    });
    drBody.querySelectorAll('[data-vk]').forEach(inp => {
      const [fk, i, key] = inp.dataset.vk.split(':');
      inp.oninput = () => {
        n.cfg[fk][+i][key] = key === 'pct' ? +inp.value : inp.value; render();
        const box = drBody.querySelector('.sum');
        if (box) {
          const s = n.cfg[fk].reduce((a, x) => a + (+x.pct || 0), 0);
          box.className = 'sum ' + (s === 100 ? 'ok' : 'bad');
          box.textContent = `Total ${s}% ${s === 100 ? '✓' : '— must be exactly 100%'}`;
        }
      };
    });
    drBody.querySelectorAll('[data-vadd]').forEach(b => b.onclick = () => {
      const fk = b.dataset.vadd, arr = n.cfg[fk];
      arr.push({ key: 'ABCDE'[arr.length], pct: 0 }); refresh();
    });
    drBody.querySelectorAll('[data-vdel]').forEach(b => b.onclick = () => {
      const [fk, i] = b.dataset.vdel.split(':'), arr = n.cfg[fk];
      arr.splice(+i, 1); arr.forEach((v, ix) => v.key = 'ABCDE'[ix]); refresh();
    });
  }

  function openWait(eid) {
    const e = edges[eid]; if (!e) return;
    const w = e.wait || { amount: '1', unit: 'hours' };
    head(I.hour, GROUPS.flow.c, GROUPS.flow.bg, 'Delay on this connection', 'Nothing is sent while a student sits in this delay.');
    drBody.innerHTML = `<div class="row2">
        <div class="field"><label>Wait for<span class="req">*</span></label><input class="ctl" id="wA" type="number" min="1" value="${w.amount}"></div>
        <div class="field"><label>Unit</label>${combo('id="wU"', ['minutes', 'hours', 'days'], w.unit, 'hours')}</div></div>
      <div class="note">${svg(I.info, 14)}<div>Quiet hours still apply. A delay that ends inside a quiet window is held, not dropped — the message goes out when the window opens.</div></div>`;
    drFoot.innerHTML = `<button class="btn primary" id="wS">Save delay</button><button class="btn" onclick="closeDrawer()">Cancel</button>
      <div style="flex:1"></div>${e.wait ? '<button class="btn danger" id="wD">Remove delay</button>' : ''}`;
    gid('wS').onclick = () => {
      e.wait = { amount: gid('wA').value || '1', unit: gid('wU').value };
      closeDrawer(); render(); toast('Delay saved.');
    };
    const d = gid('wD');
    if (d) d.onclick = () => { e.wait = null; closeDrawer(); render(); toast('Delay removed.'); };
    drawer.classList.add('on'); scrim.classList.add('on');
  }

  /* ---- send test ---- */
  function testField(n) {
    if (n.key === 'act_email') return { label: 'Test email address', ph: 'you@internshipstudio.com', kind: 'email' };
    if (n.key === 'act_wa') return { label: 'Test WhatsApp number', ph: '+91 90000 00000', kind: 'phone' };
    if (n.key === 'act_sms') return { label: 'Test mobile number', ph: '+91 90000 00000', kind: 'phone' };
    if (n.key === 'act_push') return { label: 'Test device token', ph: 'device token or test device id', kind: 'text' };
    return { label: 'Test recipient', ph: '', kind: 'text' };
  }
  function testPreview(n) {
    const c = n.cfg;
    const row = (label, val) => `<div style="margin-top:8px"><b style="font-size:12px">${label}</b><div style="font-size:12.5px;color:var(--ink2)">${val}</div></div>`;
    if (n.key === 'act_wa') {
      const vars = (c.params || []).filter(r => r.a).map(r => `${esc(r.a)} → ${esc(r.v || '—')}`).join('<br>') || '<span style="color:var(--faint)">No variables mapped</span>';
      return row('Template', esc(c.template || '—')) + row('Sender', esc(c.sender || '—')) + row('Variables', `<span style="font-family:var(--font-m);font-size:11px">${vars}</span>`);
    }
    if (n.key === 'act_email') return row('Template', esc(c.template || '—')) + row('Subject', esc(c.subject || 'Template default subject')) + row('From', esc(c.from || '—'));
    if (n.key === 'act_sms') return row('DLT template', esc(c.template || '—'));
    if (n.key === 'act_push') return row('Title', esc(c.title || '—')) + row('Body', esc(c.body || '—')) + row('Deep link', `<span style="font-family:var(--font-m);font-size:11px">${esc(c.deeplink || '—')}</span>`);
    return '';
  }
  function validRecipient(kind, v) {
    v = String(v || '').trim();
    if (!v) return false;
    if (kind === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    if (kind === 'phone') return /^\+?[0-9][0-9\s-]{6,15}$/.test(v);
    return v.length > 0;
  }
  function openSendTest(n) {
    const t = T[n.key], g = GROUPS[t.g], fld = testField(n);
    head(I.send, g.c, g.bg, `Send a test · ${t.name}`, 'Fire this step to a nominated contact. Nothing else in the journey runs.');
    drBody.innerHTML = `
      <div class="field"><label>${fld.label}<span class="req">*</span></label>
        <input class="ctl" id="tRcpt" value="${esc(lastTest[fld.kind] || '')}" placeholder="${esc(fld.ph)}"></div>
      <div class="sect">Preview</div>
      <div class="card">${testPreview(n)}</div>
      <div class="note">${svg(I.info, 14)}<div>Test sends use sample attribute values and don't count toward reporting, frequency caps or the journey audience.</div></div>`;
    drFoot.innerHTML = `<button class="btn primary" id="tSend">Send test</button><button class="btn" id="tBack">Back</button>`;
    gid('tBack').onclick = () => openConfig(n.id);
    gid('tSend').onclick = async () => {
      const v = gid('tRcpt').value.trim();
      if (!validRecipient(fld.kind, v)) { toast(`Enter a valid ${fld.kind === 'email' ? 'email address' : fld.kind === 'phone' ? 'phone number' : 'recipient'}.`, 1); return; }
      lastTest[fld.kind] = v;

      /*
        A real send through the real transport. The step must be SAVED first —
        the server reads the node's config from the stored graph, so testing an
        unsaved edit would test the previous version of the step.
      */
      const btn = gid('tSend');
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        if (!(await persist())) { toast('Could not save the step, so the test was not sent.', 1); return; }
        const res = sendTest ? await sendTest(n.id, v) : null;
        if (!res) { toast('Test could not be sent.', 1); return; }
        if (res.outcome === 'suppressed') toast(res.detail || 'Nothing was sent.', 1);
        else toast(`Test ${t.name} sent to ${v}.`);
        openConfig(n.id);
      } catch (e) {
        toast(e?.message || 'Test send failed.', 1);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Send test'; }
      }
    };
    drawer.classList.add('on'); scrim.classList.add('on');
  }

  /* ---- journey settings ---- */
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DLET = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  function openSettings() {
    head(I.gear, '#4c5bd4', '#eef0ff', 'Journey settings', 'Applies to everyone who enters this journey.');
    const live = status !== 'DRAFT';
    drBody.innerHTML = `
     ${live ? `<div class="note warn">${svg(I.warn, 14)}<div>This journey is ${status.toLowerCase()}. The goal and the entry criteria are locked — everything else can still be edited.</div></div>` : ''}
     <div class="row2"><div class="field"><label>Starts<span class="req">*</span></label>
       <input class="ctl" id="sStart" type="datetime-local" value="${esc(settings.start)}"></div>
     <div class="field"><label>Ends</label>${combo('id="sEnd"', ['Never ending', 'On a date'], settings.end, 'Never ending')}</div></div>
     ${settings.end === 'On a date' ? `<div class="field"><label>End date</label><input class="ctl" id="sEndDate" type="datetime-local" value="${esc(settings.endDate)}"></div>` : ''}
     <div class="field"><label>Tags</label><input class="ctl" id="sTags" value="${esc(settings.tags.join(', '))}" placeholder="Up to 5, comma separated">
       <div class="hint">Product first, then audience — e.g. <b>offcampusly, icat</b>.</div></div>

     <div class="sect">Measurement</div>
     <div class="card"><div class="card-h"><b>Conversion goal</b><span class="sw ${settings.goal ? 'on' : ''}" data-t="goal"></span></div>
       <p>Count a student as converted when they fire this event after entering. Attribution is on their last click before it.</p>
       <div class="row2" style="margin-top:12px">
         <div class="field" style="margin:0"><label>Event</label>
           ${combo('id="sGoal"', EVENTS, settings.goalEvent, 'Select an event', false, live)}</div>
         <div class="field" style="margin:0"><label>Window (hours)</label>
           <input class="ctl" id="sWin" type="number" value="${settings.goalWindow}" ${live ? 'disabled' : ''}></div></div>
       <div class="hint">Locked once published. If another live journey shares this goal, both will claim the same conversion.</div>
     </div>
     <div class="card"><div class="card-h"><b>Holdout group</b><span class="sw ${settings.control ? 'on' : ''}" data-t="control"></span></div>
       <p>Keep a slice out of the journey. Their behaviour is what tells you the messages did anything at all.</p>
       <div class="field" style="margin:12px 0 0"><div class="seg" id="sCtlMode">
         ${['Percentage', 'Uploaded list'].map(o => `<button data-v="${o}" class="${o === settings.controlMode ? 'on' : ''}">${o}</button>`).join('')}</div></div>
       ${settings.controlMode === 'Percentage'
        ? `<div class="row2" style="margin-top:10px"><div class="field" style="margin:0"><label>Hold back (%)</label>
            <input class="ctl" id="sCtl" type="number" min="0" max="50" value="${settings.controlPct}"></div><div></div></div>`
        : `<div class="field" style="margin-top:10px"><label>Control list</label>
            ${combo('id="sCtlList"', LISTS, settings.controlList, 'Select a list')}</div>`}
     </div>

     <div class="sect">Sending rules</div>
     <div class="card"><div class="card-h"><b>Sending route</b></div>
       <p>Which provider this journey's messages actually go out through. It is <b>frozen when the
          journey is published</b> — switching the account's active provider afterwards leaves this
          journey on the one it started with. Change it here to move this journey alone.</p>
       <div class="row2" style="margin-top:12px">
         <div class="field" style="margin:0"><label>Email</label>
           ${combo('id="sEsp"', [ESP_AUTO, ...ESP_ROUTES.map(routeName)], routeLabel(settings.espTransport, ESP_AUTO), ESP_AUTO)}</div>
         <div class="field" style="margin:0"><label>WhatsApp</label>
           ${combo('id="sWap"', [WA_AUTO, ...WA_ROUTES.map(routeName)], routeLabel(settings.waProvider, WA_AUTO), WA_AUTO)}</div>
       </div>
       <div class="hint">Only configured providers are listed. A step that picks its own WhatsApp
         route still wins over this — this is the journey-wide default.</div>
     </div>
     <div class="card"><div class="card-h"><b>Quiet hours</b><span class="sw ${settings.dnd ? 'on' : ''}" data-t="dnd"></span></div>
       <p>Pick the days quiet hours apply on, then set the blocked window for each. Unselected days have no restriction.</p>
       <div class="days" id="sDays">${DLET.map((d, i) => `<button class="day ${settings.dndDays[i] ? 'on' : ''}" data-i="${i}">${d}</button>`).join('')}</div>
       ${DAYS.map((d, i) => `<div class="dgrid ${settings.dndDays[i] ? '' : 'off'}">
          <span>${d}</span>
          <input class="ctl sm" type="time" data-dnd="${i}:f" value="${settings.dndTimes[i].f}" ${settings.dndDays[i] ? '' : 'disabled'}>
          <span class="to">to</span>
          <input class="ctl sm" type="time" data-dnd="${i}:t" value="${settings.dndTimes[i].t}" ${settings.dndDays[i] ? '' : 'disabled'}></div>`).join('')}
       <button class="copyall" id="sCopy">Copy the first selected day to all</button>
       <div class="hint" style="margin-top:8px">An end time earlier than the start carries the window into the next day — 21:00 to 09:30 blocks the night. To block a whole day, set 00:01 to 23:59. Evaluated in IST.</div>
     </div>
     <div class="card"><div class="card-h"><b>One message per student</b><span class="sw ${settings.onePerStudent ? 'on' : ''}" data-t="onePerStudent"></span></div>
       <p>Send each student at most <b>one</b> message from this journey, whichever step reaches
          them first. Later message steps are skipped and the student still walks the rest of the
          path. Leave this off for a journey that is meant to be a sequence — a nudge and then a
          follow-up are two messages by design.</p>
     </div>

     <div class="card"><div class="card-h"><b>Message cap</b><span class="sw ${settings.cap ? 'on' : ''}" data-t="cap"></span></div>
       <p>Skip a message when the student has already had this many today. The count spans
          <b>every journey</b>, not just this one — so a student messaged by another journey
          this morning may be skipped here.</p>
       ${settings.cap ? `
       <div class="row2" style="margin-top:12px">
         <div class="field" style="margin:0"><label>Cap per day</label>
           <input class="ctl" id="sCap" type="number" min="1" value="${settings.capN}"></div>
         <div class="field" style="margin:0"><label>Count</label>
           <div class="seg" id="sCapScope">
             ${['Per channel', 'All channels together'].map(o =>
               `<button data-v="${o}" class="${o === (settings.capScope || 'Per channel') ? 'on' : ''}">${o}</button>`).join('')}
           </div></div>
       </div>
       <div class="note">${svg(I.info, 14)}<div><b>Per channel</b> counts WhatsApp and email separately, so a
         WhatsApp step cannot use up the allowance for an email step. <b>All channels together</b> is a
         single budget across both.</div></div>` : ''}
     </div>`;

    drBody.querySelectorAll('.sw[data-t]').forEach(sw => sw.onclick = () => {
      const k = sw.dataset.t; settings[k] = !settings[k]; sw.classList.toggle('on', settings[k]);
    });
    drBody.querySelector('#sDays').onclick = e => {
      const b = e.target.closest('.day'); if (!b) return;
      const i = +b.dataset.i; settings.dndDays[i] = settings.dndDays[i] ? 0 : 1; saveSettings(); openSettings();
    };
    drBody.querySelectorAll('[data-dnd]').forEach(inp => inp.onchange = () => {
      const [i, k] = inp.dataset.dnd.split(':'); settings.dndTimes[+i][k] = inp.value;
    });
    drBody.querySelector('#sCopy').onclick = () => {
      const first = settings.dndDays.findIndex(d => d);
      if (first < 0) { toast('Select at least one day first.', 1); return; }
      const src = settings.dndTimes[first];
      settings.dndTimes = settings.dndTimes.map((_, i) => settings.dndDays[i] ? { ...src } : settings.dndTimes[i]);
      openSettings(); toast('Copied to every selected day.');
    };
    const cm = drBody.querySelector('#sCtlMode');
    if (cm) cm.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      settings.controlMode = b.dataset.v; saveSettings(); openSettings();
    };
    const endSel = drBody.querySelector('#sEnd');
    endSel.onchange = () => { settings.end = endSel.value; saveSettings(); openSettings(); };

    drFoot.innerHTML = `<button class="btn primary" id="sSave">Save settings</button><button class="btn" onclick="closeDrawer()">Cancel</button>`;
    /*
      Save settings has to reach the SERVER, not just this object. It used to read the
      form into `settings` and toast "Settings saved." while nothing was written — the
      change only reached the database later, if you happened to press Save draft or
      Publish afterwards. Turning the message cap off and watching it keep suppressing
      is exactly what that produced.
    */
    gid('sSave').onclick = async () => {
      saveSettings();
      const btn = gid('sSave');
      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        if (await persist()) { closeDrawer(); meta(); toast('Settings saved.'); }
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Save settings'; }
      }
    };
    drawer.classList.add('on'); scrim.classList.add('on');
  }
  function saveSettings() {
    const g = id => gid(id);
    if (g('sStart')) settings.start = g('sStart').value;
    if (g('sEnd')) settings.end = g('sEnd').value;
    if (g('sEndDate')) settings.endDate = g('sEndDate').value;
    if (g('sTags')) settings.tags = g('sTags').value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
    if (g('sGoal')) settings.goalEvent = g('sGoal').value;
    if (g('sWin')) settings.goalWindow = g('sWin').value;
    if (g('sCtl')) settings.controlPct = g('sCtl').value;
    // Was never persisted, so picking "Uploaded list" as the holdout mode silently
    // saved no list and the backend fell through to an empty control group.
    if (g('sCtlList')) settings.controlList = g('sCtlList').value;
    if (g('sCap')) settings.capN = g('sCap').value;
    // 'auto' is a real stored value, not an absent one — it is what lets you go BACK to
    // following the active provider after pinning a journey to a specific one.
    if (g('sEsp')) settings.espTransport = routeValue(g('sEsp').value, ESP_ROUTES, ESP_AUTO);
    if (g('sWap')) settings.waProvider = routeValue(g('sWap').value, WA_ROUTES, WA_AUTO);
    const scopeEl = drBody.querySelector('#sCapScope .on');
    if (scopeEl) settings.capScope = scopeEl.dataset.v;
  }

  /* ---- templates ---- */
  const TEMPLATES = [
    { n: 'Entrance exam nudge', d: 'Registered but hasn’t taken iCAT', t: 'OffCampusly', b: seed },
    {
      n: 'Batch start reminders', d: 'Fired by your scheduler, targeted by batch code', t: 'Business event', b: () => {
        nodes = {}; edges = {}; seq = 1;
        const a = addNode('trg_business', 60, 40, { event: 'batch_starts_tomorrow', map: [{ a: 'batch_code', op: 'equals', v: 'BATCH_CODE' }] });
        const w = addNode('act_wa', 60, 206, { template: 'batch_allotment_v3' });
        const h = addNode('cnd_event', 60, 392, { type: 'App / web activity', event: 'batch_joined', wtype: 'Past number of hours', wamount: '24' });
        const u = addNode('act_attr', -190, 578, { attr: 'TRAINING_STATUS', value: 'active' });
        const s = addNode('act_sms', 300, 578, { template: 'BATCH_START_02' });
        connect(a.id, 'Yes', w.id); connect(w.id, 'Sent', h.id, { amount: '20', unit: 'hours' });
        connect(h.id, 'True', u.id); connect(h.id, 'False', s.id); connect(w.id, 'Failed', s.id);
      }
    },
    {
      n: 'Payment recovery', d: 'Cheapest reachable channel first, then a split test', t: 'Revenue', b: () => {
        nodes = {}; edges = {}; seq = 1;
        const a = addNode('trg_activity', 60, 40, { type: 'App / web activity', event: 'payment_failed', repeat: 'Every time this event happens' });
        const c = addNode('cnd_reach', 60, 206, { channels: ['WhatsApp', 'Email', 'SMS', 'App push'] });
        const w = addNode('act_wa', -460, 392, { template: 'offer_extension_48h' });
        const m = addNode('act_email', -170, 392, { template: 'Course store ₹99 offer' });
        const s = addNode('act_sms', 120, 392, { template: 'PAY_FAIL_03' });
        const p = addNode('act_push', 410, 392, { title: 'Your seat is still held' });
        const x = addNode('act_exit', 700, 392, { reason: 'No channel available' });
        connect(a.id, 'Yes', c.id, { amount: '15', unit: 'minutes' });
        connect(c.id, 'WhatsApp', w.id); connect(c.id, 'Email', m.id);
        connect(c.id, 'SMS', s.id); connect(c.id, 'App push', p.id); connect(c.id, 'Unreachable', x.id);
      }
    },
    {
      n: 'Dormant reactivation', d: 'Segment trigger with a holdout group', t: 'Retention', b: () => {
        nodes = {}; edges = {}; seq = 1;
        const a = addNode('trg_segment', 60, 40, { segment: 'Dormant 30+ days', freq: 'Every week', users: 'Only new ones' });
        const sp = addNode('cnd_split', 60, 206, { variants: [{ key: 'A', pct: 50, label: 'Discount' }, { key: 'B', pct: 50, label: 'Social proof' }], metric: 'Course purchased' });
        const e1 = addNode('act_email', -190, 392, { template: 'Course store ₹99 offer' });
        const e2 = addNode('act_email', 300, 392, { template: 'OffCampusly welcome + batch' });
        const wf = addNode('flw_event', 60, 578, { event: 'course_purchased', amount: '7', unit: 'days' });
        const ex = addNode('act_exit', -190, 764, { reason: 'Reactivated' });
        const dm = addNode('act_attr', 300, 764, { attr: 'DORMANT', value: 'true' });
        connect(a.id, 'Yes', sp.id); connect(sp.id, 'A', e1.id); connect(sp.id, 'B', e2.id);
        connect(e1.id, 'Sent', wf.id); connect(e2.id, 'Sent', wf.id);
        connect(wf.id, 'Happened', ex.id); connect(wf.id, 'Timed out', dm.id);
      }
    },
    { n: 'Blank canvas', d: 'Start with nothing on the board', t: 'Blank', b: () => { nodes = {}; edges = {}; seq = 1; } },
  ];
  function openTemplates() {
    head(I.list, '#ff6a1f', '#fff0e7', 'Templates', 'Replaces everything on the canvas.');
    drBody.innerHTML = TEMPLATES.map((t, i) => `<button class="tmplrow" data-i="${i}">
      <div><div style="font-weight:600;font-size:13px">${t.n}</div>
      <div style="font-size:11.5px;color:var(--muted);margin-top:2px">${t.d}</div></div><span class="tag">${t.t}</span></button>`).join('');
    drBody.onclick = e => {
      const b = e.target.closest('.tmplrow'); if (!b) return;
      snapshot(); const t = TEMPLATES[+b.dataset.i]; t.b(); sel = null; selEdge = null; closeDrawer(); render(); fit();
      gid('jname').value = t.t === 'Blank' ? 'Untitled journey' : 'OffCampusly · ' + t.n;
      toast('Template loaded.');
    };
    drFoot.innerHTML = `<button class="btn" onclick="closeDrawer()">Cancel</button>`;
    drawer.classList.add('on'); scrim.classList.add('on');
  }

  /* ---- version history ---- */
  function openHistory() {
    const vs = (loadVersions ? loadVersions() : []).slice().reverse();
    head(I.clock, GROUPS.flow.c, GROUPS.flow.bg, 'Version history', 'Every publish snapshots the graph. Restore one to bring it back to the canvas.');
    drBody.innerHTML = vs.length
      ? vs.map(v => `<div class="tmplrow" style="cursor:default">
          <div><div style="font-weight:600;font-size:13px">Version ${v.no}${v.name ? ` · ${esc(v.name)}` : ''}</div>
          <div style="font-size:11.5px;color:var(--muted);margin-top:2px">${esc(v.at)} · ${Object.keys(v.nodes || {}).length} steps${v.status ? ` · ${esc(String(v.status).toLowerCase())}` : ''}</div></div>
          <button class="btn sm" data-restore="${v.no}">Restore</button></div>`).join('')
      : `<div class="ok-box">${svg(I.info, 15)}<div>No versions yet. Publishing the journey saves the first one.</div></div>`;
    drBody.onclick = e => { const b = e.target.closest('[data-restore]'); if (!b) return; restoreVersion(+b.dataset.restore); };
    drFoot.innerHTML = `<button class="btn" onclick="closeDrawer()">Close</button>`;
    drawer.classList.add('on'); scrim.classList.add('on');
  }
  function restoreVersion(no) {
    const v = (loadVersions ? loadVersions() : []).find(x => x.no === no);
    if (!v) return;
    snapshot();   // restoring is undoable
    nodes = JSON.parse(JSON.stringify(v.nodes || {}));
    edges = JSON.parse(JSON.stringify(v.edges || {}));
    if (v.settings) settings = { ...settings, ...v.settings };
    if (v.name) gid('jname').value = v.name;
    seq = computeSeq();
    sel = null; selEdge = null; selSet.clear();
    closeDrawer(); render(); fit();
    toast(`Restored version ${no} to the canvas. Save or publish to keep it.`);
  }

  /* ---- validation ---- */
  function describe(n) {
    const t = T[n.key];
    if (n.cfg.__label) return n.cfg.__label;
    const sum = badCfg(n) ? '' : t.s(n.cfg);
    return sum && sum !== t.name ? `${t.name} (${sum})` : t.name;
  }
  function reachableSet() {
    const tg = triggers(); if (!tg.length) return new Set();
    const seen = new Set(), st = [tg[0].id];
    while (st.length) { const c = st.pop(); if (seen.has(c)) continue; seen.add(c); outEdges(c).forEach(e => st.push(e.to)); }
    return seen;
  }
  function problems() {
    const p = [], tg = triggers();
    if (!tg.length) p.push({ m: 'This journey has no trigger — nobody can enter it.' });
    if (tg.length > 1) p.push({ m: 'More than one trigger. A journey has exactly one entry point.', id: tg[1].id });
    const reach = reachableSet();
    Object.values(nodes).forEach(n => {
      const t = T[n.key];
      if (badCfg(n)) {
        const v = n.cfg.variants;
        if (t.name === 'Split traffic' && Array.isArray(v) && v.reduce((s, x) => s + (+x.pct || 0), 0) !== 100)
          p.push({ m: `${describe(n)}: the variant percentages don’t add up to 100.`, id: n.id });
        else p.push({ m: `${describe(n)} is missing a required setting.`, id: n.id });
      }
      if (t.g !== 'trigger' && !inEdges(n.id).length)
        p.push({ m: `${describe(n)} isn’t connected to anything above it.`, id: n.id });
      else if (t.g !== 'trigger' && tg.length && !reach.has(n.id))
        p.push({ m: `${describe(n)} can’t be reached from the trigger.`, id: n.id });
      // A branch with no connector ends the path — the engine completes the student
      // and records why, so this is advice rather than a blocker. Requiring it would
      // mean an Exit step after every single message just to publish.
      OUT(n).forEach(b => {
        if (!outEdges(n.id).some(e => e.branch === b)) {
          p.push({
            m: (t.g === 'cond' || t.g === 'flow')
              ? `${describe(n)} → ${b} goes nowhere, so students taking that branch finish the journey immediately.`
              : `${describe(n)} → ${b} goes nowhere. Students finish the journey after this step.`,
            id: n.id, soft: 1,
          });
        }
      });
    });
    if (settings.end === 'On a date' && settings.endDate && settings.endDate <= settings.start)
      p.push({ m: 'The end date is on or before the start date.' });
    const warn = [];
    if (!Object.values(nodes).some(n => n.key === 'act_exit'))
      warn.push({ m: 'No exit step anywhere. Students will sit at the last node until the journey ends.', soft: 1 });
    if (!settings.goal) warn.push({ m: 'No conversion goal set — you won’t be able to measure whether this worked.', soft: 1 });
    if (settings.control === false) warn.push({ m: 'No holdout group. Without one you can’t separate the journey’s effect from what students would have done anyway.', soft: 1 });
    return p.concat(warn);
  }
  function openProblems() {
    // Anything the SERVER refused on the last publish attempt is shown alongside our
    // own findings, and cleared once it is opened — a stale server complaint about a
    // node you already fixed is worse than no complaint.
    const all = problems().concat(serverProblems), hard = all.filter(x => !x.soft), soft = all.filter(x => x.soft);
    serverProblems = [];
    head(hard.length ? I.warn : I.check, hard.length ? '#d92d20' : '#0f9d58', hard.length ? '#fdeceb' : '#f0fbf5',
      hard.length ? `${hard.length} thing${hard.length > 1 ? 's' : ''} to fix` : 'Ready to publish',
      hard.length ? 'Click one to jump to that step.' : (soft.length ? 'No blocking errors. A few things worth a look.' : 'Everything checks out.'));
    const jump = (x, i, kind) => x.id
      ? `<button class="prob${kind === 'soft' ? ' warn' : ''}" data-${kind}="${i}">${svg(kind === 'soft' ? I.info : I.warn, 14)}<span>${esc(x.m)}</span></button>`
      : `<div class="prob${kind === 'soft' ? ' warn' : ''}">${svg(kind === 'soft' ? I.info : I.warn, 14)}<span>${esc(x.m)}</span></div>`;

    drBody.innerHTML = (hard.length ? hard.map((x, i) => jump(x, i, 'i')).join('')
      : `<div class="ok-box">${svg(I.check, 15)}<div>Every step is configured and every node is reachable from the trigger. This journey can go live.</div></div>`)
      // Warnings that name a step are clickable too — they are the ones most likely to
      // send you back to the canvas, and having to hunt for the step defeats the point.
      + (soft.length ? `<div class="sect">Worth checking</div>` + soft.map((x, i) => jump(x, i, 'soft')).join('') : '');

    const focusNode = id => {
      const n = nodes[id]; if (!n) return;
      sel = id;
      view.k = 1; view.x = stage.clientWidth / 2 - (n.x + NW / 2); view.y = stage.clientHeight / 2 - (n.y + NH / 2);
      closeDrawer(); render();
    };
    drBody.onclick = e => {
      const h = e.target.closest('.prob[data-i]');
      if (h) { const x = hard[+h.dataset.i]; if (x && x.id) focusNode(x.id); return; }
      const s = e.target.closest('.prob[data-soft]');
      if (s) { const x = soft[+s.dataset.soft]; if (x && x.id) focusNode(x.id); }
    };
    drFoot.innerHTML = `<button class="btn" onclick="closeDrawer()">Close</button>`;
    drawer.classList.add('on'); scrim.classList.add('on');
  }

  /* ---- lifecycle ---- */
  const PILL = {
    DRAFT: ['rgba(255,106,31,.18)', '#ffb083'], SCHEDULED: ['rgba(76,91,212,.25)', '#b9c1ff'],
    ONGOING: ['rgba(15,157,88,.2)', '#7ee2b0'], STOPPED: ['rgba(217,45,32,.2)', '#ffb4ad'],
    PAUSED: ['rgba(194,65,12,.22)', '#ffc196'],
    COMPLETED: ['rgba(255,255,255,.12)', 'rgba(255,255,255,.7)'], ARCHIVED: ['rgba(255,255,255,.08)', 'rgba(255,255,255,.45)'],
  };
  const KNOWN_PILL = new Set(Object.keys(PILL));
  function setStatus(s) {
    if (!KNOWN_PILL.has(s)) s = 'DRAFT';
    status = s; const p = gid('statusPill');
    p.textContent = s; p.style.background = PILL[s][0]; p.style.color = PILL[s][1];
    /*
      A running journey used to have NO publish button at all, which made editing it a
      dead end: you could redraw the whole canvas, press Save draft, and the engine
      would keep running the version pinned weeks ago with nothing to tell you. The
      server has always accepted a re-deploy (it snapshots version N+1 and re-points
      the journey at it, superseding rather than stacking, so nobody gets a duplicate);
      only the button was missing.
    */
    const b = gid('btnPublish');
    b.style.display = '';
    b.textContent = (s === 'ONGOING' || s === 'SCHEDULED') ? 'Update live journey'
                  : ((s === 'STOPPED' || s === 'PAUSED') ? 'Reactivate' : 'Publish');
    b.style.display = (s === 'COMPLETED' || s === 'ARCHIVED') ? 'none' : '';
    b.title = (s === 'ONGOING' || s === 'SCHEDULED')
      ? 'Push the canvas to the engine. Students inside the journey continue from where they are.'
      : '';
    gid('btnStop').style.display = (s === 'ONGOING' || s === 'SCHEDULED' || s === 'PAUSED') ? '' : 'none';
    meta();
  }
  /*
    Publishing is a SERVER decision. The client validator runs first purely to save a
    round trip on the obvious mistakes; the server re-runs the same rules and is the
    one that can actually refuse. Nothing goes live until it says so — the status
    pill is only moved after the API confirms, so the canvas can never claim a
    journey is running when the database still has it as a draft.
  */
  const btnPublish = gid('btnPublish');
  btnPublish.onclick = async () => {
    const hard = problems().filter(x => !x.soft);
    if (hard.length) { toast(`Can’t publish yet — ${hard[0].m}`, 1); openProblems(); return; }

    const wasLive = isLiveStatus();
    const future = settings.start && new Date(settings.start) > new Date();
    // Re-deploying a running journey keeps it running — never demote an ONGOING
    // journey back to 'scheduled' because its start date is in the future.
    const want = (future && !wasLive) ? 'scheduled' : 'ongoing';

    btnPublish.disabled = true;
    const prev = status;
    try {
      await persist();                        // the server validates what is SAVED, so save first
      const updated = onStatus ? await onStatus(want) : null;
      if (!updated) { setStatus(prev); return; }
      // The canvas IS the running version now — clear the "not live" warning.
      deployedFp = execFp(nodes, edges);
      if (updated.liveVersion) liveVersionNo = updated.liveVersion;
      // The server stamps the real start the moment a journey goes live, so a draft
      // built days ago does not keep claiming it started back then. Take that value
      // back rather than guessing it here — the engine reads the column, not this field.
      if (updated.startAt) settings.start = updated.startAt;
      setStatus((updated.status || want).toUpperCase());
      if (wasLive) {
        // Stay on the canvas: an update is an edit, and you almost always make
        // another one. Leaving for the listing here would feel like a mis-click.
        toast('Live journey updated. The engine now runs this canvas — students already '
            + 'inside continue from the step they are on.');
        return;
      }
      toast(future
        ? `Scheduled. Students start entering ${String(settings.start).replace('T', ' ')}.`
        : 'Published. Students are entering now.');
      // Back to the listing once it is live — the canvas is for building, and after
      // publishing what you want to see is the journey among the others, running.
      if (api.afterPublish) setTimeout(() => api.afterPublish(), 700);
    } catch (e) {
      // The refusal list from the server — shown in the same drawer as our own.
      setStatus(prev);
      const list = (e && e.problems) || [];
      if (list.length) {
        serverProblems = list.map(m => ({ m }));
        openProblems();
      }
      toast(list.length ? `Can’t publish — ${list[0]}` : (e.message || 'Publish failed.'), 1);
    } finally {
      btnPublish.disabled = false;
    }
  };

  gid('btnStop').onclick = async () => {
    const prev = status;
    try {
      const updated = onStatus ? await onStatus('stopped') : null;
      setStatus(updated ? (updated.status || 'stopped').toUpperCase() : prev);
      toast('Stopped. Students already waiting inside will not receive anything further.');
    } catch (e) { setStatus(prev); toast(e.message || 'Could not stop the journey.', 1); }
  };
  gid('btnSettings').onclick = openSettings;
  gid('btnTemplates').onclick = openTemplates;
  gid('btnValidate').onclick = openProblems;
  gid('btnHistory').onclick = openHistory;
  gid('btnArrange').onclick = arrange;
  gid('btnUndo').onclick = undo;
  gid('btnRedo').onclick = redo;
  gid('zIn').onclick = () => { view.k = Math.min(1.8, view.k * 1.15); applyView(); };
  gid('zOut').onclick = () => { view.k = Math.max(.3, view.k / 1.15); applyView(); };
  gid('zFit').onclick = fit;
  gid('tglCounts').onclick = () => { showCounts = !showCounts; gid('swCounts').classList.toggle('on', showCounts); render(); };
  gid('tglSnap').onclick = () => { snap = !snap; gid('swSnap').classList.toggle('on', snap); };

  function meta() {
    const merges = Object.values(nodes).filter(n => inEdges(n.id).length > 1).length;
    const idLabel = currentJourneyId ? `ID ${currentJourneyId}` : 'Unsaved';
    gid('metaLine').textContent =
      `${idLabel} · ${Object.keys(nodes).length} steps · ${Object.keys(edges).length} connections${merges ? ` · ${merges} merge${merges > 1 ? 's' : ''}` : ''}`;
    livePill();
  }
  /*
    The one thing the canvas could never say before: "what you are looking at is not
    what is running". Shown only when it is true and only when it is actionable — a
    live journey whose executing version differs from the canvas.
  */
  function livePill() {
    const el = gid('livePill'); if (!el) return;
    const stale = isLiveStatus() && !changesAreLive();
    el.style.display = stale ? '' : 'none';
    if (!stale) return;
    el.textContent = liveVersionNo ? `NOT LIVE · RUNNING v${liveVersionNo}` : 'NOT LIVE';
    el.title = 'Students are running the version pinned when this journey was last published. '
             + 'Press "Update live journey" to make this canvas the one the engine executes.';
  }
  let toastTimer = null;
  function toast(m, bad) {
    const t = gid('toast');
    t.innerHTML = `<span class="${bad ? 'bad' : 'ok'}">${svg(bad ? I.warn : I.check, 14)}</span>${esc(m)}`;
    t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 3200);
  }

  /* serialize the whole canvas for persistence */
  function serialize() {
    return { nodes, edges, settings, name: gid('jname').value, status: status.toLowerCase() };
  }
  /*
    onPersist is an HTTP round trip now, so this is async. The baseline is only
    reset AFTER the server confirms — otherwise a failed save would mark the canvas
    clean and the "unsaved changes" guard would let you walk away from work that
    never reached the database.
  */
  async function persist(msg) {
    if (onPersist) {
      try {
        const savedId = await onPersist(serialize());
        if (!savedId) return false;
        currentJourneyId = savedId;
      } catch (e) {
        toast(e?.message || 'Could not save. Your changes are still on the canvas.', 1);
        return false;
      }
    }
    savedBaseline = baseline();   // canvas is now clean
    meta();
    if (msg) toast(msg);
    return true;
  }
  gid('btnSave').onclick = () => persist('Saved as draft.');

  /* boot — load the journey passed in; never auto-seed. Demo graphs come only from Templates. */
  function computeSeq() {
    let m = 0;
    Object.keys(nodes).forEach(k => { const v = parseInt(String(k).slice(1)); if (v > m) m = v; });
    Object.keys(edges).forEach(k => { const v = parseInt(String(k).slice(1)); if (v > m) m = v; });
    return m + 1;
  }
  buildPalette();
  wirePaletteSearch();
  if (initial && initial.nodes && Object.keys(initial.nodes).length) {
    nodes = initial.nodes; edges = initial.edges || {}; seq = computeSeq();
  } else {
    nodes = {}; edges = {};
  }
  if (initial && initial.settings) settings = { ...settings, ...initial.settings };
  if (!settings.espTransport) settings.espTransport = 'auto';
  if (!settings.waProvider) settings.waProvider = 'auto';
  if (initial && initial.name) gid('jname').value = initial.name;
  render(); fit(); setStatus((initial && initial.status) || 'DRAFT');
  undoBtns();
  savedBaseline = baseline();
  api.isDirty = () => baseline() !== savedBaseline;
  function onResize() { miniVp(); }
  window.addEventListener('resize', onResize, { signal });

  /* cleanup on unmount (and between StrictMode's dev double-invoke) — one abort drops every
     persistent listener registered above; transient drag listeners self-remove per gesture. */
  return () => {
    ac.abort();
    clearTimeout(toastTimer);
    if (window.closeDrawer === closeDrawer) delete window.closeDrawer;
  };
}

const Ic = ({ d, s = 15, w = 2 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
);

export default function JourneyBuilder() {
  const rootRef = useRef(null);
  const inited = useRef(false);
  const apiRef = useRef({});
  const navigate = useNavigate();
  const { id } = useParams();

  const guardedBack = () => {
    if (apiRef.current.isDirty && apiRef.current.isDirty() && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    navigate('/netcore/journeys');
  };

  useEffect(() => {
    // Native prompt on tab close / refresh while there are unsaved edits.
    const onBeforeUnload = e => { if (apiRef.current.isDirty && apiRef.current.isDirty()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || inited.current) return;
    inited.current = true;

    let cleanup = null;
    let cancelled = false;

    /*
      The canvas is an imperative DOM app, so it can only be built once and cannot
      re-render when data arrives late. Everything it needs — the journey record,
      the version history, and the REAL dropdown data (events, segments, lists,
      templates, senders, attributes) — is therefore fetched BEFORE initBuilder is
      called, and handed in as plain values.

      loadOptions() is what makes the node config drawers reflect this database
      instead of the hard-coded sample lists the prototype shipped with. It is
      allowed to fail: initBuilder falls back to its built-in lists so a network
      blip degrades the dropdowns rather than the whole builder.
    */
    (async () => {
      const [rec, options] = await Promise.all([
        id && id !== 'new' ? getJourney(id) : Promise.resolve(null),
        loadOptions(),
      ]);
      if (cancelled) return;

      let liveId = rec ? rec.id : null;
      // Versions are read once up front and kept warm here, because the version
      // drawer opens synchronously and cannot await.
      let versions = rec && Array.isArray(rec.versions) ? rec.versions : [];

      const initial = rec ? {
        nodes: rec.graph?.nodes || {},
        edges: rec.graph?.edges || {},
        settings: rec.settings || null,
        name: rec.name,
        status: (rec.status || 'draft').toUpperCase(),
      } : null;

      /*
        The graph the ENGINE is running, not the one on the canvas. The server names the
        pinned version; the snapshot itself is already in the versions payload, so this
        costs nothing extra to hand over. Without it the builder cannot tell "saved" from
        "live", which is the whole reason an edited-but-not-republished journey looked
        like a broken delay.
      */
      const deployedGraph = rec && rec.liveVersion
        ? (versions.find(v => v.no === rec.liveVersion) || null)
        : null;

      cleanup = initBuilder(root, {
        initial,
        journeyId: liveId,
        options,
        liveVersion: rec ? (rec.liveVersion || null) : null,
        deployedGraph: deployedGraph ? { nodes: deployedGraph.nodes, edges: deployedGraph.edges } : null,
        counts: rec ? rec.nodeCounts : null,
        // Returns the id the graph was saved under so the builder can show it and
        // subsequent saves target the same record (handles the /new → first-save case).
        onPersist: async (payload) => {
          if (!liveId) {
            const created = await createJourney({ name: payload.name });
            if (!created?.id) return null;
            liveId = created.id;
            navigate(`/netcore/journeys/${liveId}`, { replace: true });
          }
          await saveGraph(liveId, payload);
          return liveId;
        },
        // Publishing is server-validated. A rejection carries .problems, which the
        // builder shows in the same "things to fix" drawer as its own validator —
        // so a graph the client thought was fine still cannot go live if the
        // server disagrees.
        onStatus: async (status) => {
          if (!liveId) return null;
          const updated = await setJourneyStatus(liveId, status);
          if (updated) versions = await listVersions(liveId);
          return updated;
        },
        onVersion: async (payload) => {
          if (!liveId) return;
          await addVersion(liveId, payload);
          versions = await listVersions(liveId);
        },
        loadVersions: () => versions,
        sendTest: (nodeId, to) => (liveId ? sendTest(liveId, nodeId, to) : Promise.resolve(null)),
        loadPreview: (kind, ref, subject) => previewTemplate(liveId, kind, ref, subject),
        uploadAttachment: (file, usedBytes) => (liveId ? uploadAttachment(liveId, file, usedBytes) : Promise.resolve(null)),
        deleteAttachment: (key) => deleteAttachment(key),
        api: Object.assign(apiRef.current, {
          // The canvas is imperative and has no router access of its own.
          afterPublish: () => navigate('/netcore/journeys'),
        }),
      });
    })();

    return () => { cancelled = true; inited.current = false; if (cleanup) cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="jb-root" ref={rootRef}>
      <style>{CSS}</style>
      <div className="app">
        <header className="topbar">
          <button className="back" title="Back to journeys" onClick={guardedBack}>
            <Ic d='<path d="m15 18-6-6 6-6"/>' />
          </button>
          <div className="brand"><div className="mark">iS</div><div><b>Engage</b><br /><span>Journeys</span></div></div>
          <input className="jname" id="jname" defaultValue="Untitled journey" aria-label="Journey name" />
          <span className="pill" id="statusPill">DRAFT</span>
          <span className="pill" id="livePill"
            style={{ display: 'none', background: 'rgba(217,45,32,.2)', color: '#ffb4ad', cursor: 'help' }}>NOT LIVE</span>
          <span className="meta" id="metaLine"></span>
          <div className="spacer"></div>
          <button className="tb-btn ghost icon" id="btnUndo" title="Undo (Ctrl+Z)" aria-label="Undo">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
          </button>
          <button className="tb-btn ghost icon" id="btnRedo" title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></svg>
          </button>
          <button className="tb-btn ghost" id="btnTemplates"><span className="lbl">Templates</span></button>
          <button className="tb-btn" id="btnArrange"><span className="lbl">Tidy up</span></button>
          <button className="tb-btn" id="btnSettings"><span className="lbl">Journey settings</span></button>
          <button className="tb-btn" id="btnValidate"><span className="lbl">Check for errors</span></button>
          <button className="tb-btn ghost icon" id="btnHistory" title="Version history" aria-label="Version history">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></svg>
          </button>
          <button className="tb-btn" id="btnSave"><span className="lbl">Save draft</span></button>
          <button className="tb-btn primary" id="btnPublish">Publish</button>
          <button className="tb-btn" id="btnStop" style={{ display: 'none' }}>Stop</button>
        </header>

        <div className="wrap">
          <aside className="palette" id="palette">
            <div className="pal-head">
              <h2>Build the journey</h2>
              <p>Drag a step onto the canvas, then drag from a node's bottom dot to another node to connect them. Two branches can meet on the same node.</p>
            </div>
            <div className="pal-search">
              <svg className="si" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input id="palSearch" type="text" placeholder="Search steps…" aria-label="Search steps" />
            </div>
            <div className="pal-empty" id="palEmpty">No steps match your search.</div>
          </aside>

          <main className="stage" id="stage">
            <svg id="edges" width="20000" height="20000"></svg>
            <div id="world"></div>
            <div className="empty-hint" id="emptyHint" style={{ display: 'none' }}>
              <div><b>Nothing here yet</b>Drag a trigger from the left onto the canvas.</div>
            </div>
            <div className="hud">
              <div className="zoomer">
                <button id="zIn" title="Zoom in"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg></button>
                <button id="zOut" title="Zoom out"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 12h14" /></svg></button>
                <button id="zFit" title="Fit to screen"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" /></svg></button>
              </div>
              <div className="minimap"><svg id="mini" width="174" height="100"></svg></div>
              <button className="toggle" id="tglCounts"><span className="sw on" id="swCounts"></span> Audience at each step</button>
              <button className="toggle" id="tglSnap"><span className="sw on" id="swSnap"></span> Snap to grid</button>
            </div>
            <div className="hint-bar">
              <span className="lg"><i style={{ background: '#4c5bd4' }}></i> Trigger</span>
              <span className="lg"><i style={{ background: '#ff6a1f' }}></i> Message &amp; action</span>
              <span className="lg"><i style={{ background: '#0d9488' }}></i> Condition</span>
              <span className="lg"><i style={{ background: '#b07408' }}></i> Wait</span>
              <span className="lg tip">Shift-drag to box-select · Shift-click to add · Ctrl+C / Ctrl+V copy · Ctrl+Z / Ctrl+Shift+Z undo</span>
            </div>
          </main>
        </div>
      </div>

      <div className="scrim" id="scrim"></div>
      <aside className="drawer" id="drawer" role="dialog" aria-modal="true">
        <div className="dr-head" id="drHead"></div>
        <div className="dr-body" id="drBody"></div>
        <div className="dr-foot" id="drFoot"></div>
      </aside>
      <div className="toast" id="toast"></div>
    </div>
  );
}
