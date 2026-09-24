// ===========================================================================
//  supportStyles.js — the Support tab's own CSS (queue + chat panel + viewer).
//  Scoped under `sp-` and built on the --lms-* tokens from lmsTheme.js, so it
//  follows the LMS look without touching the shared sheet.
// ===========================================================================
export const SUPPORT_CSS = `
/* ── queue: bucket cards ─────────────────────────────────────────── */
.sp-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:20px 0 20px;}
.sp-card{display:flex;align-items:center;gap:14px;padding:15px 18px;border:1px solid var(--lms-border);
  border-radius:var(--lms-r-lg,12px);background:var(--lms-bg);text-align:left;cursor:pointer;position:relative;
  transition:border-color .15s,box-shadow .15s,transform .15s;}
.sp-card:hover{border-color:var(--lms-border-2);box-shadow:var(--lms-shadow-xs);transform:translateY(-1px);}
.sp-card.active{border-color:var(--sp-tone);box-shadow:0 0 0 3px color-mix(in srgb,var(--sp-tone) 16%,transparent);}
.sp-card-ico{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;flex-shrink:0;
  background:color-mix(in srgb,var(--sp-tone) 12%,transparent);color:var(--sp-tone);}
.sp-card-label{font-size:12.5px;color:var(--lms-text-2);font-weight:500;}
.sp-card-value{font-size:24px;font-weight:650;line-height:1.15;color:var(--lms-text);}
.sp-card-hint{font-size:11.5px;color:var(--lms-text-3);margin-top:2px;}
.sp-card-hint b{color:var(--lms-green-dark);font-weight:600;}
.sp-card.sp-card-total{cursor:default;background:var(--lms-bg-soft);}
.sp-card.sp-card-total:hover{transform:none;box-shadow:none;border-color:var(--lms-border);}
.sp-course-hint{display:inline-block;margin-left:6px;font-size:10px;font-weight:600;padding:0 6px;border-radius:999px;
  background:var(--lms-bg-soft);color:var(--lms-text-3);border:1px solid var(--lms-border);vertical-align:1px;}

/* pagination */
.sp-pager{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 16px;border-top:1px solid var(--lms-border);
  font-size:12.5px;color:var(--lms-text-2);}
.sp-pager b{color:var(--lms-text);font-weight:600;}
.sp-pager-size{display:inline-flex;align-items:center;gap:8px;}
.sp-pager-size .lms-select{width:auto;padding:5px 28px 5px 10px;font-size:12.5px;}
.sp-pager-pages{display:flex;align-items:center;gap:4px;margin-left:auto;}
.sp-pager-pages button{min-width:32px;height:32px;padding:0 8px;border-radius:8px;border:1px solid var(--lms-border);
  background:var(--lms-bg);color:var(--lms-text-2);font-size:12.5px;font-weight:500;display:inline-flex;align-items:center;justify-content:center;}
.sp-pager-pages button:hover:not(:disabled){border-color:var(--lms-green);color:var(--lms-green-dark);}
.sp-pager-pages button.on{background:var(--lms-green);border-color:var(--lms-green);color:#fff;font-weight:600;}
.sp-pager-pages button:disabled{opacity:.4;cursor:not-allowed;}
.sp-pager-gap{padding:0 4px;color:var(--lms-text-3);}

/* ── queue: toolbar + advanced filters ───────────────────────────── */
.sp-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;}
.sp-toolbar .lms-search{max-width:360px;}
.sp-seg-count{margin-left:6px;font-size:11px;padding:1px 7px;border-radius:999px;background:var(--lms-bg-soft);
  color:var(--lms-text-2);font-weight:600;}
.lms-segment button.active .sp-seg-count{background:var(--lms-green-soft);color:var(--lms-green-dark);}
.sp-filter-btn{position:relative;}
.sp-filter-dot{position:absolute;top:-5px;right:-5px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;
  background:var(--lms-green);color:#fff;font-size:10.5px;font-weight:700;display:grid;place-items:center;}
.sp-adv{border:1px solid var(--lms-border);border-radius:var(--lms-r-lg,12px);background:var(--lms-bg);
  padding:14px 16px;margin-bottom:14px;display:grid;gap:14px;
  grid-template-columns:repeat(auto-fit,minmax(200px,1fr));animation:spFade .16s ease;}
.sp-adv-field{display:flex;flex-direction:column;gap:6px;min-width:0;}
.sp-adv-field > label{font-size:11.5px;font-weight:600;color:var(--lms-text-2);text-transform:uppercase;letter-spacing:.03em;}
.sp-adv-wide{grid-column:1/-1;}
.sp-presets{display:flex;flex-wrap:wrap;gap:6px;}
.sp-preset{padding:6px 12px;font-size:12.5px;border-radius:999px;border:1px solid var(--lms-border-2);
  background:var(--lms-bg);color:var(--lms-text-2);cursor:pointer;transition:all .14s;}
.sp-preset:hover{border-color:var(--lms-green);color:var(--lms-green-dark);}
.sp-preset.on{background:var(--lms-green-soft);border-color:var(--lms-green);color:var(--lms-green-dark);font-weight:600;}
.sp-range{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.sp-range input{padding:7px 10px;border:1px solid var(--lms-border-2);border-radius:8px;font-size:13px;
  background:var(--lms-bg);color:var(--lms-text);}
.sp-active-filters{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:12px;}
.sp-af{display:inline-flex;align-items:center;gap:5px;padding:4px 6px 4px 10px;border-radius:999px;font-size:12px;
  background:var(--lms-bg-soft);color:var(--lms-text-2);border:1px solid var(--lms-border);}
.sp-af button{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;color:var(--lms-text-3);}
.sp-af button:hover{background:var(--lms-border);color:var(--lms-text);}
.sp-af-clear{font-size:12px;color:var(--lms-red-dark);font-weight:500;padding:4px 8px;border-radius:6px;}
.sp-af-clear:hover{background:var(--lms-red-soft);}
.sp-result-note{font-size:12px;color:var(--lms-text-3);margin-left:auto;}

/* ── queue: rows ─────────────────────────────────────────────────── */
.sp-row{cursor:pointer;}
.sp-row.unread td{background:color-mix(in srgb,var(--lms-green-soft) 55%,transparent);}
.sp-subj{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px;}
.sp-row.unread .sp-subj{font-weight:650;}
.sp-badges{display:flex;gap:5px;flex-wrap:wrap;margin-top:3px;align-items:center;}
.sp-id{font-size:11.5px;color:var(--lms-text-3);}
.sp-badge{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:650;padding:1px 7px;
  border-radius:999px;letter-spacing:.01em;}
.sp-badge.new{background:var(--lms-green);color:#fff;animation:spPulse 2s ease-in-out infinite;}
.sp-badge.reopen{background:var(--lms-amber-soft);color:var(--lms-amber-dark);border:1px solid color-mix(in srgb,var(--lms-amber) 40%,transparent);}
.sp-last{font-size:11.5px;color:var(--lms-text-3);display:block;margin-top:3px;white-space:nowrap;}
.sp-last.learner{color:var(--lms-amber-dark);font-weight:500;}
@keyframes spPulse{0%,100%{box-shadow:0 0 0 0 rgba(18,183,106,.45);}50%{box-shadow:0 0 0 4px rgba(18,183,106,0);}}
@keyframes spFade{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:none;}}

/* ── chat panel ──────────────────────────────────────────────────── */
.sp-backdrop{position:fixed;inset:0;background:rgba(16,24,40,.42);z-index:1190;animation:spFadeIn .18s ease;}
.sp-panel{position:fixed;top:0;right:0;bottom:0;max-width:100vw;background:var(--lms-bg);z-index:1191;
  display:flex;flex-direction:column;box-shadow:-18px 0 50px rgba(16,24,40,.18);animation:spSlide .24s cubic-bezier(.2,.8,.2,1);}
.sp-panel.maxed{left:0;}
@keyframes spSlide{from{transform:translateX(40px);opacity:.4;}to{transform:none;opacity:1;}}
@keyframes spFadeIn{from{opacity:0;}to{opacity:1;}}
.sp-grip{position:absolute;left:-4px;top:0;bottom:0;width:9px;cursor:ew-resize;z-index:3;}
.sp-grip::after{content:'';position:absolute;left:3px;top:50%;width:3px;height:44px;margin-top:-22px;border-radius:3px;
  background:var(--lms-border-2);opacity:.0;transition:opacity .15s;}
.sp-grip:hover::after,body.sp-resizing .sp-grip::after{opacity:1;background:var(--lms-green);}
body.sp-resizing{cursor:ew-resize !important;user-select:none;}
body.sp-resizing iframe,body.sp-resizing video{pointer-events:none;}

.sp-head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--lms-border);
  background:var(--lms-bg);flex-shrink:0;}
.sp-head-main{flex:1;min-width:0;}
.sp-head-title{display:flex;align-items:center;gap:10px;min-width:0;}
.sp-head-subj{font-size:16.5px;font-weight:650;color:var(--lms-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sp-head-sub{font-size:12.5px;color:var(--lms-text-3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sp-head-actions{display:flex;align-items:center;gap:6px;flex-shrink:0;}
.sp-head-sep{width:1px;height:22px;background:var(--lms-border);margin:0 4px;}
.lms-root .sp-btn-sm{padding:6px 11px;font-size:12.5px;gap:6px;}
.lms-icon-btn.sp-on{background:var(--lms-green-soft);color:var(--lms-green-dark);}

.sp-body{flex:1;display:flex;min-height:0;position:relative;}
.sp-chat{flex:1;min-width:0;display:flex;flex-direction:column;position:relative;background:var(--lms-bg-soft);}
.sp-thread{flex:1;overflow-y:auto;padding:18px 22px 10px;scroll-behavior:auto;overscroll-behavior:contain;
  background-image:radial-gradient(color-mix(in srgb,var(--lms-border) 70%,transparent) 1px,transparent 1px);
  background-size:18px 18px;}
.sp-thread-loading{display:flex;align-items:center;justify-content:center;gap:10px;height:100%;color:var(--lms-text-3);font-size:13px;}
.sp-spinner{width:16px;height:16px;border-radius:50%;border:2px solid var(--lms-border-2);border-top-color:var(--lms-green);animation:spSpin .7s linear infinite;}
@keyframes spSpin{to{transform:rotate(360deg);}}
.sp-day{display:flex;justify-content:center;margin:14px 0 12px;position:sticky;top:0;z-index:1;}
.sp-day span{font-size:11px;font-weight:600;color:var(--lms-text-2);background:var(--lms-bg);border:1px solid var(--lms-border);
  padding:3px 11px;border-radius:999px;box-shadow:var(--lms-shadow-xs);}

.sp-msg{display:flex;align-items:flex-end;gap:8px;margin-bottom:12px;animation:spFade .18s ease;}
.sp-msg.us{justify-content:flex-end;}
.sp-msg-av{width:30px;height:30px;border-radius:50%;flex-shrink:0;display:grid;place-items:center;font-size:12.5px;
  font-weight:650;background:var(--lms-bg);border:1px solid var(--lms-border);color:var(--lms-text-2);}
.sp-bubble{max-width:min(78%,640px);min-width:120px;padding:9px 13px 10px;border-radius:14px 14px 14px 4px;
  background:var(--lms-bg);border:1px solid var(--lms-border);box-shadow:var(--lms-shadow-xs);}
.sp-msg.us .sp-bubble{border-radius:14px 14px 4px 14px;background:var(--lms-green-soft);
  border-color:color-mix(in srgb,var(--lms-green) 28%,transparent);}
.sp-msg-head{display:flex;justify-content:space-between;align-items:baseline;gap:14px;margin-bottom:3px;}
.sp-msg-head strong{font-size:12.5px;color:var(--lms-text);}
.sp-msg.us .sp-msg-head strong{color:var(--lms-green-dark);}
.sp-msg-head span{font-size:10.5px;color:var(--lms-text-3);white-space:nowrap;}
.sp-msg-body{font-size:13.8px;line-height:1.6;color:var(--lms-text);white-space:pre-wrap;word-break:break-word;}
.sp-link{color:#1570ef;font-weight:500;text-decoration:underline;text-decoration-color:color-mix(in srgb,#1570ef 40%,transparent);
  text-underline-offset:2px;background:color-mix(in srgb,#1570ef 8%,transparent);border-radius:4px;padding:0 3px;word-break:break-all;}
.sp-link:hover{text-decoration-color:#1570ef;background:color-mix(in srgb,#1570ef 14%,transparent);}

/* attachments in bubbles */
.sp-att-img{display:block;position:relative;margin-top:8px;padding:0;border:0;background:none;cursor:zoom-in;border-radius:10px;overflow:hidden;}
.sp-att-img img{display:block;max-width:100%;max-height:280px;border-radius:10px;border:1px solid var(--lms-border);object-fit:cover;}
.sp-att-zoom{position:absolute;right:8px;bottom:8px;width:26px;height:26px;border-radius:7px;display:grid;place-items:center;
  background:rgba(16,24,40,.6);color:#fff;opacity:0;transition:opacity .15s;}
.sp-att-img:hover .sp-att-zoom{opacity:1;}
.sp-att-media{margin-top:8px;border-radius:10px;overflow:hidden;border:1px solid var(--lms-border);background:#0c111d;}
.sp-att-media video{display:block;width:100%;max-height:320px;background:#000;}
.sp-att-media audio{display:block;width:100%;background:var(--lms-bg);}
.sp-att-media-bar{display:flex;align-items:center;gap:7px;padding:6px 10px;background:var(--lms-bg);font-size:12px;}
.sp-att-media-bar a{color:var(--lms-text-2);display:grid;place-items:center;}
.sp-att-card{display:flex;align-items:center;gap:10px;margin-top:8px;padding:8px 8px 8px 10px;border-radius:10px;
  border:1px solid var(--lms-border);background:var(--lms-bg);min-width:220px;}
.sp-att-ico{width:36px;height:36px;border-radius:8px;display:grid;place-items:center;background:var(--lms-bg-soft);flex-shrink:0;}
.sp-att-meta{flex:1;min-width:0;display:flex;flex-direction:column;}
.sp-att-name{font-size:12.8px;font-weight:500;color:var(--lms-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;}
.sp-att-size{font-size:11px;color:var(--lms-text-3);}
.sp-att-act{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;gap:4px;height:28px;min-width:28px;padding:0 9px;
  border-radius:7px;font-size:12px;font-weight:500;color:var(--lms-text-2);border:1px solid var(--lms-border);background:var(--lms-bg);cursor:pointer;}
.sp-att-act:hover{border-color:var(--lms-green);color:var(--lms-green-dark);}

.sp-jump{position:absolute;right:22px;bottom:128px;z-index:2;display:inline-flex;align-items:center;gap:5px;
  padding:7px 12px;border-radius:999px;font-size:12px;font-weight:600;background:var(--lms-black);color:#fff;
  box-shadow:var(--lms-shadow-lg);animation:spFade .16s ease;}
.sp-drop{position:absolute;inset:10px;z-index:4;border:2px dashed var(--lms-green);border-radius:14px;
  background:color-mix(in srgb,var(--lms-green-soft) 88%,transparent);display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:6px;color:var(--lms-green-dark);pointer-events:none;}
.sp-drop span{font-size:12px;color:var(--lms-text-2);}

/* composer */
.sp-composer{flex-shrink:0;padding:10px 16px 12px;border-top:1px solid var(--lms-border);background:var(--lms-bg);}
.sp-composer-note{font-size:12px;color:var(--lms-amber-dark);background:var(--lms-amber-soft);padding:6px 10px;border-radius:8px;margin-bottom:8px;}
.sp-files{display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;}
.sp-file{display:flex;align-items:center;gap:8px;padding:5px 6px 5px 5px;border:1px solid var(--lms-border);border-radius:10px;
  background:var(--lms-bg-soft);flex-shrink:0;max-width:230px;animation:spFade .15s ease;}
.sp-file img,.sp-file-ico{width:34px;height:34px;border-radius:7px;object-fit:cover;flex-shrink:0;}
.sp-file-ico{display:grid;place-items:center;background:var(--lms-bg);}
.sp-file-meta{display:flex;flex-direction:column;min-width:0;}
.sp-file-name{font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sp-file-size{font-size:10.5px;color:var(--lms-text-3);}
.sp-file-x{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;color:var(--lms-text-3);flex-shrink:0;}
.sp-file-x:hover{background:var(--lms-red-soft);color:var(--lms-red-dark);}
.sp-compose-box{display:flex;align-items:flex-end;gap:8px;border:1px solid var(--lms-border-2);border-radius:14px;
  padding:6px 6px 6px 6px;background:var(--lms-bg);transition:border-color .15s,box-shadow .15s;}
.sp-compose-box:focus-within{border-color:var(--lms-green);box-shadow:0 0 0 3px rgba(18,183,106,.14);}
.sp-attach{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;color:var(--lms-text-2);flex-shrink:0;}
.sp-attach:hover:not(:disabled){background:var(--lms-bg-soft);color:var(--lms-green-dark);}
.sp-input{flex:1;min-width:0;border:0;outline:none;resize:none;font:inherit;font-size:13.8px;line-height:1.5;
  padding:8px 4px;max-height:220px;background:transparent;color:var(--lms-text);}
/* The box around it shows focus; the global textarea focus ring must not. */
.sp-input,.sp-input:focus,.sp-input:focus-visible,.sp-input:hover{border:0 !important;outline:none !important;box-shadow:none !important;background:transparent !important;}
.lms-root .sp-send{border-radius:10px;height:38px;flex-shrink:0;}
.sp-compose-hint{display:flex;justify-content:space-between;gap:10px;margin-top:6px;font-size:11px;color:var(--lms-text-3);}

/* post-reply prompt — drops from the top of the panel */
.sp-prompt{position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:10;width:min(620px,calc(100% - 24px));
  display:flex;align-items:center;gap:12px;padding:12px 40px 14px 14px;border-radius:14px;overflow:hidden;
  background:var(--lms-bg);border:1px solid color-mix(in srgb,var(--lms-green) 35%,var(--lms-border));
  box-shadow:0 18px 40px rgba(16,24,40,.18);animation:spDrop .34s cubic-bezier(.2,1.2,.3,1);}
@keyframes spDrop{from{transform:translate(-50%,-130%);opacity:0;}to{transform:translate(-50%,0);opacity:1;}}
.sp-prompt-ico{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--lms-green-soft);color:var(--lms-green-dark);flex-shrink:0;}
.sp-prompt-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}
.sp-prompt-text strong{font-size:13.5px;}
.sp-prompt-text span{font-size:12px;color:var(--lms-text-2);}
.sp-prompt-actions{display:flex;gap:6px;flex-shrink:0;}
.sp-prompt-x{position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;color:var(--lms-text-3);}
.sp-prompt-x:hover{background:var(--lms-bg-soft);color:var(--lms-text);}
.sp-prompt-timer{position:absolute;left:0;bottom:0;height:3px;background:var(--lms-green);width:100%;
  transform-origin:left;animation:spTimer 15s linear forwards;}
@keyframes spTimer{from{transform:scaleX(1);}to{transform:scaleX(0);}}

/* student panel */
.sp-side{width:320px;flex-shrink:0;border-left:1px solid var(--lms-border);background:var(--lms-bg);overflow-y:auto;}
.sp-side.floating{position:absolute;top:0;right:0;bottom:0;z-index:6;width:min(340px,92%);
  box-shadow:-14px 0 34px rgba(16,24,40,.16);animation:spSlide .2s ease;}
.sp-side-x{position:absolute;top:10px;right:10px;z-index:1;}
.sp-side-inner{padding:18px 16px 22px;}
.sp-stu-head{display:flex;align-items:center;gap:11px;padding-bottom:14px;border-bottom:1px solid var(--lms-border);}
.sp-side.floating .sp-stu-head{padding-right:34px;}
.sp-stu-av{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:17px;flex-shrink:0;
  background:linear-gradient(135deg,var(--lms-green-soft),color-mix(in srgb,var(--lms-green) 30%,var(--lms-bg)));color:var(--lms-green-dark);}
.sp-stu-name{font-size:14.5px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sp-stu-sub{font-size:11.5px;color:var(--lms-text-3);}
.sp-copy-all{margin-left:auto;display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;padding:5px 9px;
  border-radius:7px;border:1px solid var(--lms-border);color:var(--lms-text-2);flex-shrink:0;}
.sp-copy-all:hover{border-color:var(--lms-green);color:var(--lms-green-dark);}
.sp-kv{display:flex;flex-direction:column;gap:6px;margin-top:14px;}
.sp-kv-row,.sp-domain{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 10px;border-radius:10px;
  border:1px solid var(--lms-border);background:var(--lms-bg-soft);color:var(--lms-text-3);}
.sp-kv-body{flex:1;min-width:0;display:flex;flex-direction:column;}
.sp-kv-body label{font-size:10.5px;color:var(--lms-text-3);font-weight:500;}
.sp-kv-body span{font-size:13px;color:var(--lms-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sp-kv-row .sp-kv-body{order:0;}
.sp-kv-row > svg{flex-shrink:0;}
.sp-domain img,.sp-domain-ph{width:30px;height:30px;border-radius:7px;object-fit:contain;background:var(--lms-bg);flex-shrink:0;
  border:1px solid var(--lms-border);display:grid;place-items:center;}
.sp-domain-name{font-weight:600;white-space:normal !important;}
.sp-domains{display:flex;flex-direction:column;gap:6px;}
.sp-copy{width:28px;height:28px;border-radius:7px;display:grid;place-items:center;color:var(--lms-text-3);
  border:1px solid transparent;flex-shrink:0;transition:all .14s;}
.sp-copy:hover{background:var(--lms-bg);border-color:var(--lms-border);color:var(--lms-green-dark);}
.sp-copy.done{color:var(--lms-green-dark);background:var(--lms-green-soft);}
.sp-side-title{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:650;text-transform:uppercase;letter-spacing:.04em;
  color:var(--lms-text-2);margin:18px 0 8px;}
.sp-side-empty{font-size:12.5px;color:var(--lms-text-3);padding:8px 10px;border:1px dashed var(--lms-border-2);border-radius:10px;}
.sp-chips{display:flex;flex-wrap:wrap;gap:6px;}
.sp-chip{font-size:12px;padding:4px 10px;border-radius:999px;background:var(--lms-blue-soft);color:#3538cd;}
.sp-chip.muted{background:var(--lms-bg-soft);color:var(--lms-text-3);text-decoration:line-through;}
.sp-facts{display:grid;gap:7px;}
.sp-facts > div{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:12.5px;}
.sp-facts label{color:var(--lms-text-3);flex-shrink:0;}
.sp-facts span{text-align:right;color:var(--lms-text);min-width:0;}
.sp-history{display:flex;flex-direction:column;gap:5px;}
.sp-history-item{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;border-radius:8px;
  border:1px solid var(--lms-border);font-size:12.5px;text-align:left;background:var(--lms-bg);}
.sp-history-item:hover{border-color:var(--lms-green);}
.sp-history-subj{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}

/* full-screen file viewer */
.sp-pv{position:fixed;inset:0;z-index:1400;background:rgba(12,17,29,.86);display:flex;flex-direction:column;animation:spFadeIn .16s ease;}
.sp-pv-bar{display:flex;align-items:center;gap:10px;padding:12px 16px;color:#fff;background:rgba(0,0,0,.35);}
.sp-pv-name{flex:1;min-width:0;font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sp-pv-size{font-size:12px;opacity:.7;}
.sp-pv-btn{width:36px;height:36px;border-radius:9px;display:grid;place-items:center;color:#fff;}
.sp-pv-btn:hover{background:rgba(255,255,255,.14);color:#fff;}
.sp-pv-stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:16px;}
.sp-pv-img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.4);background:#fff;}
.sp-pv-video{max-width:100%;max-height:100%;border-radius:8px;background:#000;}
.sp-pv-frame{width:min(1200px,100%);height:100%;border:0;border-radius:8px;background:#fff;}
.sp-pv-table-wrap{width:min(1200px,100%);max-height:100%;overflow:auto;background:#fff;border-radius:8px;}
.sp-pv-table{border-collapse:collapse;font-size:12.5px;min-width:100%;color:#101828;}
.sp-pv-table th,.sp-pv-table td{border:1px solid #eaecf0;padding:6px 10px;text-align:left;white-space:nowrap;}
.sp-pv-table th{position:sticky;top:0;background:#f2f4f7;font-weight:600;}
.sp-pv-table td:first-child,.sp-pv-table th:first-child{color:#98a2b3;background:#f9fafb;}
.sp-pv-text{width:min(1100px,100%);max-height:100%;overflow:auto;margin:0;padding:18px;background:#fff;color:#101828;
  border-radius:8px;font-size:12.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word;}
.sp-pv-note{color:#fff;opacity:.8;font-size:13px;padding:10px;}
.sp-pv-table-wrap .sp-pv-note{color:#475467;}
.sp-pv-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:34px 30px;background:#fff;border-radius:14px;
  text-align:center;max-width:420px;color:#101828;}
.sp-pv-empty span{font-size:13px;color:#667085;}

/* ── small screens ───────────────────────────────────────────────── */
@media (max-width: 1100px){
  .sp-cards{grid-template-columns:repeat(2,minmax(0,1fr));}
}
@media (max-width: 900px){
  .sp-cards{gap:8px;}
  .sp-card{padding:11px 12px;gap:10px;}
  .sp-card-ico{display:none;}
  .sp-card-value{font-size:20px;}
  .sp-hide-sm{display:none;}
}
@media (max-width: 640px){
  .sp-cards{grid-template-columns:1fr 1fr;}
  .sp-pager-pages{margin-left:0;width:100%;justify-content:center;}
  .sp-card-hint{display:none;}
  .sp-panel{width:100vw !important;}
  .sp-grip,.sp-hide-xs{display:none !important;}
  .sp-head{padding:10px 12px;gap:8px;}
  .sp-head-subj{font-size:14.5px;}
  .sp-head-sep{display:none;}
  .sp-thread{padding:12px 10px 8px;}
  .sp-bubble{max-width:88%;}
  .sp-msg-av{display:none;}
  .sp-composer{padding:8px 10px 10px;}
  .sp-compose-hint span:last-child{display:none;}
  .sp-prompt{flex-wrap:wrap;}
  .sp-prompt-actions{width:100%;justify-content:flex-end;}
  .sp-toolbar .lms-search{max-width:none;}
}

/* ── compact layout: as many tickets on screen as possible ──────── */
.lms-page.sp-page{padding-top:14px;padding-bottom:0;max-width:none;}
.sp-page .lms-page-head{margin-bottom:10px;align-items:center;}
.sp-page .lms-h1{font-size:22px;}
.sp-page .lms-sub{font-size:12.5px;margin-top:2px;}
.sp-page .lms-page-head .lms-btn{padding:7px 12px;font-size:13px;}
.sp-page .sp-cards{margin:0 0 12px;gap:10px;}
.sp-page .sp-card{padding:9px 14px;gap:11px;}
.sp-page .sp-card-ico{width:32px;height:32px;border-radius:8px;}
.sp-page .sp-card-ico svg{width:17px;height:17px;}
.sp-page .sp-card-label{font-size:11.5px;}
.sp-page .sp-card-value{font-size:19px;line-height:1.2;}
.sp-page .sp-card-hint{font-size:11px;margin-top:0;}
.sp-page .sp-toolbar{margin-bottom:10px;gap:8px;}
.sp-page .sp-toolbar .lms-search input,.sp-page .sp-toolbar .lms-select{padding-top:7px;padding-bottom:7px;font-size:13px;}
.sp-page .sp-toolbar .lms-btn{padding:7px 12px;font-size:13px;}
.sp-page .lms-segment button{padding:5px 12px;font-size:12.5px;}

/* the table: one dense line per learner, header and pager always in view */
.sp-tablewrap{display:flex;flex-direction:column;max-height:max(320px,calc(100vh - 300px));}
.sp-tablewrap .lms-table-scroll{flex:1;min-height:0;overflow:auto;}
.sp-table{font-size:13px;}
.sp-table thead th{position:sticky;top:0;z-index:1;background:var(--lms-bg-soft);padding:8px 12px;font-size:12px;white-space:nowrap;}
.sp-table td{padding:6px 12px;line-height:1.35;}
.sp-table .lms-user-cell{gap:8px;}
.sp-table .lms-avatar{width:26px;height:26px;font-size:11.5px;}
.sp-table .lms-user-name{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px;}
.sp-table .lms-user-mail{font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px;}
.sp-table .sp-subj{max-width:230px;font-size:13px;}
.sp-table{min-width:0;}
.sp-table th,.sp-table td{padding-left:10px;padding-right:10px;}
.sp-table .sp-badges{margin-top:1px;}
.sp-table .lms-pill{padding:1px 8px;font-size:11px;}
.sp-table .lms-icon-btn{width:28px;height:28px;}
.sp-cell-clip{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12.5px;}
.sp-cell-muted{color:var(--lms-text-2);}
.sp-table .sp-last{display:inline;margin:0 0 0 6px;font-size:11px;}
.sp-tablewrap .sp-pager{flex-shrink:0;padding:8px 14px;background:var(--lms-bg);box-shadow:0 -1px 0 var(--lms-border);}
.sp-tablewrap .sp-pager-pages button{min-width:28px;height:28px;}

/* ── bulk selection ─────────────────────────────────────────────── */
.sp-check-cell{width:34px;padding-right:0 !important;cursor:pointer;}
.sp-check{width:15px;height:15px;accent-color:var(--lms-green);cursor:pointer;vertical-align:middle;margin:0;}
.sp-row.picked td{background:color-mix(in srgb,var(--lms-blue-soft) 75%,transparent) !important;}
.sp-bulk{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 12px;flex-shrink:0;
  background:var(--lms-blue-soft);border-bottom:1px solid var(--lms-border);font-size:12.5px;animation:spFade .14s ease;}
.sp-bulk-count{color:var(--lms-text);}
.sp-bulk-count b{font-weight:700;}
.sp-bulk-link{color:#3538cd;font-weight:600;font-size:12.5px;text-decoration:underline;text-underline-offset:2px;}
.sp-bulk-sep{width:1px;height:18px;background:var(--lms-border-2);margin:0 4px;}
.sp-bulk-label{color:var(--lms-text-2);}
.sp-bulk .lms-btn-ghost{background:var(--lms-bg);}
.sp-bulk-clear{margin-left:auto;display:inline-flex;align-items:center;gap:4px;color:var(--lms-text-2);font-size:12.5px;
  padding:5px 8px;border-radius:6px;}
.sp-bulk-clear:hover{background:var(--lms-bg);color:var(--lms-text);}
`;
