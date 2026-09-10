/*
 * src/pages/freshdesk/fdStyles.jsx
 *
 * The helpdesk's entire stylesheet, as one <style> element.
 *
 * It lives in its own module for one reason: it is ~1,600 lines of CSS that
 * nobody edits while working on behaviour, and leaving it at the top of the
 * page component meant every file-open, search and diff on Freshdesk.jsx waded
 * through it first.
 *
 * Scoped by the .app class rather than CSS modules because this page is dropped
 * inside the admin panel's own layout and must not leak into it.
 */

/* ============================================================================
   DESIGN SYSTEM
   ========================================================================== */
const Styles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    .app{--bg:#F8F9FC;--surface:#FFFFFF;--surface-2:#F1F3F9;--hover:#F5F7FF;
      --text:#1A1D29;--muted:#6B7280;--faint:#9AA1B1;--border:#E9EBF2;
      --primary:#5B5CEB;--primary-soft:#EEEEFE;--accent:#0EA5E9;--accent-soft:#E3F5FD;
      --success:#22C55E;--success-soft:#DCFCE7;--warning:#F59E0B;--warning-soft:#FEF3C7;--danger:#EF4444;--danger-soft:#FEE2E2;
      /* One quiet elevation for resting surfaces, one real one for things that
         genuinely float (menus, drawers, modals). Cards use a border, not a
         shadow -- a border and a drop shadow on the same box is what made every
         panel look like it was peeling off the page. */
      --shadow:0 1px 2px rgba(16,24,40,.03);
      --shadow-lg:0 16px 44px -12px rgba(24,26,66,.18);
      --r-sm:8px; --r:12px; --r-lg:16px;
      font-family:'Inter',system-ui,sans-serif;color:var(--text);background:var(--bg);
      /* height, not min-height: the shell inside owns the scrolling, and a
         min-height here produced a second, outer scrollbar. */
      height:100vh;overflow:hidden;transition:background .3s,color .3s}
    .app.dark{--bg:#0E1017;--surface:#171A24;--surface-2:#1F2331;--hover:#20242F;
      --text:#EEF1F8;--muted:#9BA3B7;--faint:#6B7488;--border:#262B3B;
      --primary:#7C7DFF;--primary-soft:#242245;--accent:#38BDF8;--accent-soft:#12303C;
      --success:#34D399;--success-soft:#123027;--warning:#FBBF24;--warning-soft:#3A2E12;--danger:#F87171;--danger-soft:#3A1D1D;
      --shadow:0 1px 2px rgba(0,0,0,.28);--shadow-lg:0 18px 50px -14px rgba(0,0,0,.6)}
    *{box-sizing:border-box}
    .app ::-webkit-scrollbar{width:9px;height:9px}
    .app ::-webkit-scrollbar-thumb{background:var(--border);border-radius:9px}

    /* App shell: exactly one viewport tall, and the two columns scroll on their
       own. The document itself never scrolls -- that is what kept dragging the
       workspace rail off the top of the screen on a long ticket. */
    /* The admin navbar is hidden on /freshdesk (OWN_CHROME_ROUTES in
       AdminLayout), so this page owns the full window height. The variable
       stays so every height calc below has one place to change if that ever
       goes back. */
    /* The admin panel drops this page into a <main> that pads it 16px top and
       bottom. Counted here, or the shell is 32px taller than the window and the
       whole app -- top bar included -- nudges when you scroll. */
    .app{--admin-nav-h:0px;--admin-pad:32px}
    .shell{display:flex;height:calc(100vh - var(--admin-nav-h) - var(--admin-pad));overflow:hidden}
    .main{flex:1;min-width:0;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;
      scrollbar-gutter:stable}
    /* A page that manages its own scrolling turns the shell's off, or the frame
       ends up scrolling inside a second scroller. */
    .main.main-fixed{overflow-y:hidden;display:grid;grid-template-rows:auto minmax(0,1fr)}
    /* Belt and braces: even if this column is somehow scrolled, both rows move
       together rather than one sliding under the other. */
    .main.main-fixed > .fd-topbar{position:relative;top:auto}
    /* Off by default -- see the note in Freshdesk.jsx about which screens are
       one surface and which are a grid of cards. */
    .fd-stage{display:flex;flex-direction:column}
    .fd-stage.on{background:var(--surface);border:1px solid var(--border);border-bottom:0;
      border-radius:18px 18px 0 0;margin:6px 18px 0}
    /* Only for a screen that manages its own scrolling. On a list, sizing the
       panel to the window and clipping it is how the page stops scrolling. */
    .fd-stage.on.fd-fixed{flex:1;min-height:0;overflow:hidden}
    .fd-stage.on > .content{max-width:none}
    /* The ticket screen IS the panel: edge to edge, no second frame inside. */
    .fd-stage.on > .content.content-fixed{padding:0}
    .fd-stage.on > .content:not(.content-fixed){padding:14px 20px 24px}
    /* The stage draws the border and the corners now, so the grid inside must
       not draw a second set a pixel away from them. */
    .fd-stage.on .td-grid{border-radius:0;box-shadow:none}
    .fd-stage.on .td-grid > .tq{border-radius:0;border-left:0;border-top:0;border-bottom:0}
    .fd-stage.on .td-grid > .props{border-right:0;border-top:0;border-bottom:0}
    .fd-stage.on .td-grid > .td-convo{border-top:0;border-bottom:0}
    .fd-stage.on .td-grid.queue-shut > .td-convo:first-child{border-left:0;border-radius:0}
    .content{padding:14px 24px 32px;max-width:1600px;width:100%;margin:0 auto}
    /* The ticket screen is a fixed frame, so its page never scrolls -- the
       conversation column does. Everything else keeps the normal flow. */
    .content.content-fixed{padding-bottom:14px;flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
    /* The list is a frame as well, but it keeps the padding the ticket screen
       drops: the panel and its header rows hold still and only the rows move.
       Pinning them with sticky offsets instead was wrong twice over -- the top
       bar grows when its search expands, so the offset was a guess, and the
       panel's own top edge still scrolled away with its rounded corners. */
    .content.content-frame{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
    /* The layout takes the height left under the toolbar; both its columns
       scroll on their own rather than growing the page. */
    .content-frame .tickets-layout{flex:1;min-height:0}
    .content-frame .tickets-layout > *{min-height:0;overflow-y:auto}
    /* The content column is a column of its own: pager, select-all, then the
       one part that scrolls. */
    .content-frame .tickets-layout > div:last-child{display:flex;flex-direction:column;overflow:hidden}
    /* overflow-x hidden, not visible: a scroller cannot be visible on one axis,
       and left as auto a card's hover shadow raises a stray sideways scrollbar.
       The table layout does its own sideways scrolling inside .table-wrap. */
    .content-frame .tl-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden}

    /* Right-hand rail — border and offsets mirror a normal left sidebar. */
    /* The rail NEVER scrolls as a whole -- that is what kept sliding its own
       header off the top of the screen. It is a fixed-height column with three
       parts: pinned actions, a scrolling nav list, pinned footer. Only the
       middle moves, and only when there are more nav items than fit. */
    .sidebar{width:250px;flex-shrink:0;background:var(--surface);border-left:1px solid var(--border);
      display:flex;flex-direction:column;height:100%;max-height:100%;z-index:40;
      /* overflow must stay visible or the "New" menu is clipped by the rail.
         .nav below does the scrolling instead. */
      overflow:visible;
      transition:width .22s cubic-bezier(.4,0,.2,1),transform .28s cubic-bezier(.4,0,.2,1)}
    .sidebar .rail-actions{flex:0 0 auto}
    .sidebar .nav{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain}
    .sidebar .side-foot{flex:0 0 auto;margin-top:0}
    .sidebar .nav::-webkit-scrollbar{width:6px}
    .sidebar .nav::-webkit-scrollbar-thumb{background:var(--border);border-radius:6px}
    .brand{display:flex;align-items:center;gap:11px;padding:20px 20px 18px;font-weight:800;font-size:17px}
    .brand .logo{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:#fff;
      background:linear-gradient(135deg,var(--primary),var(--accent));box-shadow:0 6px 16px rgba(91,92,235,.35)}
    /* Top padding stands in for the removed brand block's spacing. */
    .nav{padding:18px 12px 6px;display:flex;flex-direction:column;gap:3px}
    .nav-label{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);padding:14px 12px 6px}
    .nav-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:11px;color:var(--muted);
      font-weight:500;font-size:14px;cursor:pointer;position:relative;transition:background .18s,color .18s,transform .18s}
    .nav-item:hover{background:var(--hover);color:var(--text);transform:translateX(2px)}
    .nav-item .badge{margin-left:auto;background:var(--surface-2);color:var(--muted);font-size:11px;font-weight:700;padding:1px 8px;border-radius:20px}
    .nav-item.active{background:var(--primary-soft);color:var(--primary);font-weight:600}
    .nav-item.active::before{content:"";position:absolute;right:-12px;top:8px;bottom:8px;width:4px;border-radius:4px 0 0 4px;background:var(--primary)}
    .nav-item.active .badge{background:var(--primary);color:#fff}
    .side-foot{margin-top:auto;padding:12px 14px 30px;border-top:1px solid var(--border);
      display:flex;flex-direction:column;gap:9px}
    .side-card{background:linear-gradient(135deg,var(--primary),var(--accent));border-radius:14px;padding:14px;color:#fff}
    .side-card h5{margin:0 0 4px;font-size:13px;font-weight:700}
    .side-card p{margin:0 0 10px;font-size:11.5px;opacity:.9;line-height:1.4}
    .side-card button{width:100%;border:0;border-radius:9px;padding:8px;font-weight:600;font-size:12.5px;background:rgba(255,255,255,.95);color:var(--primary);cursor:pointer}

    .topbar{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:14px;padding:12px 28px;
      border-bottom:1px solid var(--border);background:color-mix(in srgb,var(--surface) 72%,transparent);
      backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%)}
    .searchbox{flex:1;max-width:440px;display:flex;align-items:center;gap:9px;padding:9px 14px;background:var(--surface-2);
      border:1px solid transparent;border-radius:12px;color:var(--muted);transition:border .18s,background .18s}
    .searchbox:focus-within{border-color:var(--primary);background:var(--surface)}
    .searchbox input{border:0;outline:0;background:transparent;flex:1;font-size:13.5px;color:var(--text);font-family:inherit}
    .searchbox kbd{font-size:10.5px;font-weight:600;color:var(--faint);border:1px solid var(--border);border-radius:6px;padding:1px 6px;background:var(--surface)}
    .clock{display:flex;align-items:center;gap:7px;font-variant-numeric:tabular-nums;font-weight:600;font-size:13px;color:var(--muted);padding:8px 12px;border-radius:11px;background:var(--surface-2)}
    .icon-btn{position:relative;width:40px;height:40px;border-radius:11px;border:1px solid var(--border);background:var(--surface);color:var(--muted);display:grid;place-items:center;cursor:pointer;transition:background .15s,color .15s,border-color .15s}
    .icon-btn:hover:not(:disabled){color:var(--primary);border-color:var(--primary);transform:translateY(-1px)}
    .icon-btn:disabled{opacity:.4;cursor:not-allowed}
    .dot{position:absolute;top:7px;right:8px;min-width:16px;height:16px;padding:0 4px;border-radius:9px;background:var(--danger);color:#fff;font-size:10px;font-weight:700;display:grid;place-items:center;box-shadow:0 0 0 2px var(--surface)}
    .btn{display:inline-flex;align-items:center;gap:7px;border:0;border-radius:11px;padding:9px 15px;font-weight:600;font-size:13.5px;cursor:pointer;font-family:inherit;transition:background .15s,color .15s,box-shadow .15s,opacity .15s;white-space:nowrap}
    .btn-primary{background:var(--primary);color:#fff;box-shadow:0 6px 16px rgba(91,92,235,.32)}
    .btn-primary:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(91,92,235,.42)}
    .btn-ghost{background:var(--surface);color:var(--text);border:1px solid var(--border)}
    .btn-ghost:hover{border-color:var(--primary);color:var(--primary)}
    .btn-soft{background:var(--surface-2);color:var(--text)}.btn-soft:hover{background:var(--hover)}
    .profile{display:flex;align-items:center;gap:9px;padding:5px 9px 5px 5px;border-radius:12px;border:1px solid var(--border);background:var(--surface);cursor:pointer;transition:border .18s}
    .profile:hover{border-color:var(--primary)}
    .avatar{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;color:#fff;font-weight:700;font-size:12.5px;background:linear-gradient(135deg,var(--primary),var(--accent))}
    .admin-menu{position:absolute;right:0;top:calc(100% + 10px);z-index:50;width:228px;background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow-lg);overflow:hidden;animation:pop .16s ease}
    .admin-menu-head{padding:15px 16px 13px}
    .admin-menu-head b{display:block;font-size:13.5px;margin-bottom:3px}
    .admin-menu-head span{display:block;font-size:12px;color:var(--muted)}
    .admin-role{display:inline-flex!important;width:max-content;margin-top:9px;padding:3px 9px;border-radius:20px;background:var(--primary-soft);color:var(--primary)!important;font-size:11px!important;font-weight:700}
    .admin-menu-row{width:100%;display:flex;align-items:center;gap:11px;border:0;background:transparent;color:var(--text);padding:14px 16px;font-family:inherit;font-size:13.5px;cursor:pointer;text-align:left;border-top:1px solid var(--border)}
    .admin-menu-row:hover{background:var(--hover)}
    .admin-menu-row.danger{color:var(--danger)}
    .admin-menu-row .ic{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:var(--primary-soft);color:var(--primary);flex-shrink:0}
    .admin-menu-row.danger .ic{background:var(--danger-soft);color:var(--danger)}
    .signin-page{min-height:100vh;display:grid;place-items:center;padding:28px;position:relative;overflow:hidden;
      background:
        radial-gradient(circle at 15% 20%, color-mix(in srgb, var(--primary) 25%, transparent), transparent 45%),
        radial-gradient(circle at 85% 80%, color-mix(in srgb, var(--accent) 20%, transparent), transparent 45%),
        var(--bg)}
    .signin-page::before,.signin-page::after{content:"";position:absolute;border-radius:50%;filter:blur(60px);pointer-events:none;z-index:0}
    .signin-page::before{width:340px;height:340px;background:color-mix(in srgb, var(--primary) 55%, transparent);top:-80px;left:-80px;animation:floaty 14s ease-in-out infinite}
    .signin-page::after{width:400px;height:400px;background:color-mix(in srgb, var(--accent) 45%, transparent);bottom:-120px;right:-100px;animation:floaty 18s ease-in-out infinite reverse}
    @keyframes floaty{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-30px) scale(1.08)}66%{transform:translate(-30px,20px) scale(.94)}}
    :root{--mx:0;--my:0}
    .signin-shell{position:relative;z-index:1;width:min(1220px,100%);display:grid;grid-template-columns:1.15fr .85fr;gap:18px;align-items:stretch;animation:siFadeUp .55s cubic-bezier(.4,0,.2,1) both}
    @keyframes siFadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
    @media(max-width:960px){.signin-shell{grid-template-columns:1fr}}
    .signin-showcase{position:relative;overflow:hidden;border-radius:28px;padding:40px;
      background:linear-gradient(135deg,var(--primary) 0%,color-mix(in srgb, var(--primary) 60%, var(--accent)) 55%,var(--accent) 100%);
      background-size:200% 200%;animation:shGrad 12s ease infinite;
      color:#fff;box-shadow:0 40px 90px -24px color-mix(in srgb, var(--primary) 50%, transparent);
      display:flex;flex-direction:column;justify-content:space-between;gap:22px;min-height:680px}
    @keyframes shGrad{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
    .sv-mesh{position:absolute;inset:0;opacity:.5;pointer-events:none;
      background-image:radial-gradient(rgba(255,255,255,.14) 1px,transparent 1px);background-size:26px 26px;
      -webkit-mask-image:radial-gradient(circle at 50% 30%,#000,transparent 72%);mask-image:radial-gradient(circle at 50% 30%,#000,transparent 72%)}
    .sv-blob{position:absolute;border-radius:50%;filter:blur(50px);pointer-events:none;opacity:.55;
      transform:translate(calc(var(--mx) * var(--px,14px)),calc(var(--my) * var(--py,14px)));transition:transform .4s cubic-bezier(.25,.8,.35,1)}
    .sv-blob.b1{width:260px;height:260px;top:-60px;left:-60px;background:rgba(255,255,255,.35);--px:20px;--py:14px;animation:orb 9s ease-in-out infinite}
    .sv-blob.b2{width:300px;height:300px;right:-80px;bottom:-40px;background:rgba(255,255,255,.22);--px:-16px;--py:-10px;animation:orb 12s ease-in-out infinite reverse}
    .sv-blob.b3{width:180px;height:180px;right:20%;top:38%;background:rgba(255,255,255,.18);--px:12px;--py:-16px;animation:orb 10s ease-in-out infinite}
    @keyframes orb{0%,100%{transform:translate(0,0)}50%{transform:translate(24px,-18px)}}
    .sv-nodes{position:absolute;inset:0;width:100%;height:100%;opacity:.28;pointer-events:none}
    .sv-nodes line{stroke:#fff;stroke-width:1;stroke-dasharray:4 5;animation:nodeFlow 3.5s linear infinite}
    .sv-nodes circle{fill:#fff;animation:nodePulse 2.4s ease-in-out infinite}
    .sv-nodes circle:nth-child(3){animation-delay:.3s}.sv-nodes circle:nth-child(4){animation-delay:.6s}.sv-nodes circle:nth-child(5){animation-delay:.9s}.sv-nodes circle:nth-child(6){animation-delay:1.2s}
    @keyframes nodeFlow{to{stroke-dashoffset:-18}}
    @keyframes nodePulse{0%,100%{opacity:.5;r:3.5}50%{opacity:1;r:5}}
    .signin-particles{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0}
    .signin-particles i{position:absolute;display:block;width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.55);animation:drift linear infinite}
    .signin-particles i:nth-child(1){left:12%;animation-duration:11s;animation-delay:-1s;width:4px;height:4px}
    .signin-particles i:nth-child(2){left:26%;animation-duration:14s;animation-delay:-4s;opacity:.6}
    .signin-particles i:nth-child(3){left:44%;animation-duration:9s;animation-delay:-2s;width:5px;height:5px}
    .signin-particles i:nth-child(4){left:58%;animation-duration:16s;animation-delay:-6s;opacity:.75}
    .signin-particles i:nth-child(5){left:72%;animation-duration:12s;animation-delay:-3s;width:7px;height:7px}
    .signin-particles i:nth-child(6){left:88%;animation-duration:10s;animation-delay:-5s;opacity:.5}
    @keyframes drift{0%{transform:translateY(110%) scale(.6);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:translateY(-20%) scale(1);opacity:0}}
    .signin-hero{position:relative;z-index:2;animation:siStat .6s .05s cubic-bezier(.4,0,.2,1) both}
    .signin-kicker{display:inline-flex;align-items:center;gap:8px;padding:7px 13px;border-radius:20px;background:rgba(255,255,255,.16);font-size:12px;font-weight:700;letter-spacing:.02em;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.18)}
    .signin-showcase h1{margin:18px 0 12px;font-size:38px;line-height:1.08;letter-spacing:-.03em;font-weight:800}
    .signin-showcase h1 .grad{background:linear-gradient(90deg,#fff,rgba(255,255,255,.6));-webkit-background-clip:text;background-clip:text;color:transparent}
    .signin-showcase p{margin:0;max-width:420px;font-size:14.5px;line-height:1.65;color:rgba(255,255,255,.9)}
    .sv-stage{position:relative;z-index:2;flex:1;min-height:220px}
    .fcard{position:absolute;background:rgba(255,255,255,.14);backdrop-filter:blur(16px) saturate(140%);border:1px solid rgba(255,255,255,.22);border-radius:16px;box-shadow:0 18px 40px -14px rgba(10,14,40,.35);color:#fff;animation:cardFloat 6s ease-in-out infinite,siStat .6s cubic-bezier(.4,0,.2,1) both}
    @keyframes cardFloat{0%,100%{transform:translateY(0) rotate(var(--rot,0deg))}50%{transform:translateY(-10px) rotate(var(--rot,0deg))}}
    @keyframes siStat{from{opacity:0;transform:translateY(16px) scale(.94)}to{opacity:1;transform:none}}
    .fc-dash{left:0;top:0;width:230px;padding:16px;--rot:-2deg;animation-delay:.15s,.15s}
    .fc-head{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;opacity:.85;margin-bottom:10px}
    .fc-kpis{display:flex;gap:14px;margin-bottom:12px}
    .fc-kpis b{display:block;font-size:17px;font-weight:800}
    .fc-kpis span{font-size:9.5px;opacity:.8}
    .fc-bars{display:flex;align-items:flex-end;gap:5px;height:34px}
    .fc-bars i{flex:1;background:linear-gradient(180deg,#fff,rgba(255,255,255,.4));border-radius:2px;animation:barGrow 2.4s ease-in-out infinite alternate}
    .fc-bars i:nth-child(2){animation-delay:.15s}.fc-bars i:nth-child(3){animation-delay:.3s}.fc-bars i:nth-child(4){animation-delay:.45s}.fc-bars i:nth-child(5){animation-delay:.6s}.fc-bars i:nth-child(6){animation-delay:.75s}.fc-bars i:nth-child(7){animation-delay:.9s}
    @keyframes barGrow{from{opacity:.6;transform:scaleY(.85)}to{opacity:1;transform:scaleY(1)}}
    .fc-chat{right:0;top:36px;width:250px;padding:13px 15px;--rot:1.5deg;animation-delay:.35s,.35s}
    .fc-chat-row{display:flex;align-items:flex-start;gap:9px}
    .fc-av{width:26px;height:26px;border-radius:9px;background:linear-gradient(135deg,#fff,rgba(255,255,255,.5));color:var(--primary);display:grid;place-items:center;font-size:9.5px;font-weight:800;flex-shrink:0}
    .fc-bub{font-size:11.5px;line-height:1.5}
    .fc-stars{display:block;color:#FDE68A;font-size:10.5px;margin-top:3px;letter-spacing:1px}
    .fc-ai{left:38px;bottom:6px;width:180px;padding:12px 14px;display:flex;align-items:center;gap:10px;--rot:-1deg;animation-delay:.5s,.5s}
    .fc-ai-ring{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center;flex-shrink:0;animation:aiRing 2.6s ease-in-out infinite}
    @keyframes aiRing{0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,.35)}50%{box-shadow:0 0 0 7px rgba(255,255,255,0)}}
    .fc-ai b{display:block;font-size:11.5px;font-weight:800}
    .fc-ai span{font-size:9.5px;opacity:.8}
    .fc-stat{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:11px 13px;width:118px;--rot:0deg}
    .fc-stat b{font-size:16px;font-weight:800;margin-top:3px}
    .fc-stat span{font-size:9px;opacity:.8}
    .fc-stat1{right:16px;top:-14px;animation-delay:.6s,.6s}
    .fc-stat2{left:250px;bottom:64px;animation-delay:.7s,.7s}
    .fc-stat3{left:0;bottom:-8px;animation-delay:.8s,.8s}
    .fc-stat4{right:80px;bottom:0;animation-delay:.9s,.9s}
    @media(max-width:1180px){.fc-stat2,.fc-stat4{display:none}}
    @media(max-width:960px){.sv-stage{display:none}}
    .sv-security{position:relative;z-index:2;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;animation:siStat .5s 1s cubic-bezier(.4,0,.2,1) both}
    @media(max-width:760px){.sv-security{grid-template-columns:repeat(2,1fr)}}
    .sv-security div{display:flex;flex-direction:column;align-items:flex-start;gap:7px;padding:12px;border-radius:13px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(10px);transition:transform .2s,background .2s}
    .sv-security div:hover{transform:translateY(-3px);background:rgba(255,255,255,.17)}
    .sv-security span{font-size:11px;font-weight:600;line-height:1.35;opacity:.92}
    .sv-trusted{position:relative;z-index:2;animation:siStat .5s 1.1s cubic-bezier(.4,0,.2,1) both}
    .sv-trusted>span{display:block;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.65;margin-bottom:8px}
    .sv-trusted-row{display:flex;flex-wrap:wrap;gap:16px}
    .sv-trusted-row span{font-size:13px;font-weight:700;opacity:.55;letter-spacing:.01em}
    .signin-brand{display:flex;align-items:center;gap:12px;margin-bottom:24px}
    .signin-brand .logo{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--primary),var(--accent));box-shadow:0 10px 24px color-mix(in srgb, var(--primary) 42%, transparent);animation:brandPulse 3s ease-in-out infinite}
    @keyframes brandPulse{0%,100%{box-shadow:0 10px 24px color-mix(in srgb, var(--primary) 42%, transparent)}50%{box-shadow:0 14px 34px color-mix(in srgb, var(--primary) 62%, transparent)}}
    .signin-card h1{margin:0;font-size:26px;font-weight:800;letter-spacing:-.02em}
    .signin-card p{margin:7px 0 0;color:var(--muted);font-size:13.5px;line-height:1.5}
    .signin-form{display:flex;flex-direction:column;gap:15px;margin-top:24px}
    .signin-field{animation:siFadeUp .45s cubic-bezier(.4,0,.2,1) both}
    .signin-field:nth-of-type(1){animation-delay:.2s}
    .signin-field:nth-of-type(2){animation-delay:.28s}
    .signin-form label{display:block;font-size:11.5px;font-weight:700;color:var(--muted);margin-bottom:7px;text-transform:uppercase;letter-spacing:.04em}
    .signin-input-wrap{position:relative}
    .signin-input-wrap .ic{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--muted);transition:color .2s;pointer-events:none}
    .signin-input-wrap .eye{position:absolute;right:11px;top:50%;transform:translateY(-50%);background:none;border:0;padding:6px;border-radius:6px;cursor:pointer;color:var(--muted);transition:color .2s,background .2s}
    .signin-input-wrap .eye:hover{color:var(--primary);background:var(--surface-2)}
    .signin-form input{width:100%;height:46px;border:1.5px solid var(--border);background:var(--surface-2);color:var(--text);border-radius:12px;padding:0 14px 0 40px;font-family:inherit;font-size:14px;outline:0;transition:all .22s}
    .signin-form input:focus{border-color:var(--primary);background:var(--surface);box-shadow:0 0 0 4px color-mix(in srgb, var(--primary) 15%, transparent)}
    .signin-input-wrap:focus-within .ic{color:var(--primary)}
    .signin-err{margin-top:9px;padding:10px 12px;border-radius:10px;background:var(--danger-soft);color:var(--danger);font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:8px;animation:siShake .38s ease-in-out}
    @keyframes siShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
    .signin-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 0 8px;font-size:12.5px;color:var(--muted);flex-wrap:wrap}
    .signin-remember{display:inline-flex;align-items:center;gap:8px;cursor:pointer;user-select:none;font-weight:600}
    .signin-remember .box{width:16px;height:16px;border-radius:5px;border:1.5px solid var(--border);display:grid;place-items:center;color:#fff;transition:all .18s}
    .signin-remember input:checked ~ .box{background:var(--primary);border-color:var(--primary)}
    .signin-remember input{position:absolute;opacity:0;pointer-events:none}
    .signin-forgot{color:var(--primary);text-decoration:none;font-weight:700;transition:opacity .18s}
    .signin-forgot:hover{opacity:.8;text-decoration:underline}
    .signin-btn{position:relative;overflow:hidden;width:100%;height:50px;border:0;border-radius:13px;color:#fff;font-family:inherit;font-size:14.5px;font-weight:700;cursor:pointer;
      background:linear-gradient(135deg,var(--primary),var(--accent));background-size:200% 200%;
      box-shadow:0 12px 28px color-mix(in srgb, var(--primary) 40%, transparent);
      display:flex;align-items:center;justify-content:center;gap:9px;letter-spacing:.02em;
      transition:transform .18s cubic-bezier(.4,0,.2,1),box-shadow .22s,background-position .3s}
    .signin-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 18px 36px color-mix(in srgb, var(--primary) 55%, transparent);background-position:100% 50%}
    .signin-btn:active:not(:disabled){transform:translateY(0)}
    .signin-btn:disabled{opacity:.75;cursor:wait}
    .signin-btn::before{content:"";position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent);transition:left .7s;pointer-events:none}
    .signin-btn > *{position:relative;z-index:1;pointer-events:none}
    .signin-btn:hover:not(:disabled)::before{left:100%}
    .signin-divider{display:flex;align-items:center;gap:12px;margin:22px 0 14px;color:var(--faint);font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
    .signin-divider::before,.signin-divider::after{content:"";flex:1;height:1px;background:var(--border)}
    .google-btn-wrap{display:flex;justify-content:center;min-height:44px}
    .google-btn-busy,.google-btn-fallback{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:44px;border-radius:22px;border:1.5px solid var(--border);font-size:13px;font-weight:600;color:var(--muted)}
    .google-btn-disabled{width:100%;height:46px;border-radius:22px;border:1.5px solid var(--border);background:var(--surface-2);color:var(--faint);font-family:inherit;font-size:13.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:9px;cursor:pointer;opacity:.75;transition:opacity .15s}
    .google-btn-disabled:hover{opacity:1}
    .google-btn-hint{display:flex;align-items:center;justify-content:center;gap:5px;width:100%;background:none;border:0;margin-top:8px;padding:2px;font-family:inherit;font-size:11px;font-weight:600;color:var(--faint);cursor:pointer;transition:color .15s}
    .google-btn-hint:hover{color:var(--primary)}
    .google-help-steps{margin:14px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:12px}
    .google-help-steps li{font-size:12.5px;line-height:1.6;color:var(--text)}
    .google-help-steps a{color:var(--primary);font-weight:600;text-decoration:none}
    .google-help-steps a:hover{text-decoration:underline}
    .google-help-code{display:flex;align-items:center;gap:8px;margin:8px 0;padding:9px 11px;border-radius:9px;background:var(--surface-2);border:1px solid var(--border)}
    .google-help-code code{flex:1;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:var(--primary);word-break:break-all}
    .google-help-inline{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;background:var(--surface-2);padding:1px 6px;border-radius:5px;color:var(--primary)}
    .signin-social{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .signin-social button{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:42px;border:1.5px solid var(--border);background:var(--surface);border-radius:11px;font-family:inherit;font-size:12.5px;font-weight:600;color:var(--text);cursor:pointer;transition:all .18s}
    .signin-social button:hover{border-color:var(--primary);color:var(--primary);background:var(--primary-soft);transform:translateY(-1px)}
    .signin-badges{display:flex;justify-content:space-between;margin:14px 0 6px;font-size:12px;color:var(--muted)}
    .signin-badges span{display:inline-flex;align-items:center;gap:6px;font-weight:600}
    .signin-footer{margin-top:20px;text-align:center;font-size:12px;color:var(--faint)}
    .signin-showcase{background-color:var(--primary)}
    /* ======================================================================
       CLEANUP LAYER — flattens the page onto one plane.
       Kept as one block at the end rather than edited into the rules above, so
       the intent stays legible and it can be lifted out in one piece.
       ====================================================================== */
    .app .card{box-shadow:none;border:1px solid var(--border);border-radius:var(--r-lg);
      background:var(--surface);transition:border-color .18s}
    .app .card:hover{box-shadow:none}
    /* Cards no longer lift on hover. The dashboard has a dozen of them; twelve
       boxes rising and falling as the pointer crosses the page is motion that
       communicates nothing. Only genuinely clickable cards react, by border. */
    .app .card.clickable{cursor:pointer}
    .app .card.clickable:hover{border-color:color-mix(in srgb, var(--primary) 45%, var(--border));transform:none}
    .app .stat:hover{transform:none}

    .app .btn{border-radius:var(--r-sm);box-shadow:none}
    .app .btn-primary{background:var(--primary);box-shadow:none}
    .app .btn-primary:hover{background:color-mix(in srgb, var(--primary) 88%, #000)}
    .app .icon-btn{border-radius:var(--r-sm)}
    .app .badge-pill,.app .chip{border-radius:6px;font-weight:600}

    /* nav-item is a <button> now, so it needs the button reset the <div> did
       not; without this it renders with the UA's grey background and centred
       system font inside the rail. */
    .app .nav-item{width:100%;border:0;background:none;font-family:inherit;text-align:left;
      font-size:13.5px;border-radius:var(--r-sm)}
    .app .nav-item:hover{transform:none;background:var(--hover)}
    .app .nav-item.active::before{display:none}
    .app .nav-item.active{background:var(--primary-soft);color:var(--primary)}
    .app .nav-label{padding:16px 10px 6px;font-size:10.5px}

    /* Section headings were competing with the data underneath them. */
    .app .card-title{font-size:14px;font-weight:650;letter-spacing:-.01em}
    .app .card-sub{font-size:12px;color:var(--muted)}
    .app .page-head h1{font-size:22px;font-weight:700;letter-spacing:-.02em}
    .app .page-head p{font-size:13px;color:var(--muted);margin-top:4px}

    /* One accent. The stat row previously used six different hues at full
       saturation, which reads as decoration rather than as meaning. Tone is
       reserved for state that actually matters (overdue, breached, failed). */
    .app .stat .ic{border-radius:var(--r-sm)}
    .app .grid-stats{gap:12px}

    .app .menu,.app .dd-menu,.app .search-results,.app .notif-pop{
      border-radius:var(--r);box-shadow:var(--shadow-lg);border:1px solid var(--border)}
    .app .drawer,.app .modal{border-radius:var(--r-lg)}

    /* ======================================================================
       FOCUS RINGS — one treatment, on the wrapper
       ======================================================================
       The search field showed a rounded outline INSIDE its own box: the panel's
       global stylesheet puts a focus ring on every <input>, and this page also
       lights up the wrapper on :focus-within. Two rings, one nested in the
       other. The control is the wrapper, so that is what should react; the
       input itself carries none. */
    .app input:focus,.app textarea:focus,.app select:focus,
    .app input:focus-visible,.app textarea:focus-visible,.app select:focus-visible{
      outline:none!important;box-shadow:none!important}
    .app .searchbox:focus-within,.app .fld input:focus-within{
      border-color:var(--primary);
      box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 13%,transparent)}
    /* Standalone fields still need a visible ring — they have no wrapper. */
    .app .fld input:focus,.app .fld textarea:focus,.app .fld select:focus{
      border-color:var(--primary)!important;
      box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 13%,transparent)!important}
    /* ...but NOT when the input already sits inside a wrapper that rings.
       To / Cc / Bcc put RecipientInput inside .rcpt-field, which lights up on
       :focus-within -- so the rule above was drawing a second, smaller ring
       inside the first one. The wrapper is the control; the input is invisible.
       Specificity beats the .fld rule above, and both carry !important. */
    .app .rcpt input,.app .fld .rcpt input,
    .app .rcpt input:focus,.app .fld .rcpt input:focus,
    .app .rcpt input:focus-visible,.app .fld .rcpt input:focus-visible,
    .app .rcpt input:focus-within,.app .fld .rcpt input:focus-within{
      border:0!important;outline:0!important;box-shadow:none!important;
      background:transparent!important;padding:0!important;border-radius:0!important}

    /* Keyboard users must still see focus on buttons. */
    .app button:focus-visible,.app a:focus-visible{
      outline:2px solid var(--primary)!important;outline-offset:2px}

    /* ======================================================================
       DIALOG MOTION — quick, no bounce
       ======================================================================
       The old .22s overshoot (cubic-bezier with a 1.4 control point) made every
       dialog wobble into place, which reads as slow however fast it is. A short
       ease-out that settles rather than springs feels immediate. */
    .app .modal{animation:fdPopIn .15s cubic-bezier(.16,1,.3,1)!important}
    .app .modal-overlay{animation:fdFadeIn .12s ease-out!important}
    .app .drawer{animation:fdSlideIn .2s cubic-bezier(.16,1,.3,1)!important}
    .app .drawer-overlay{animation:fdFadeIn .12s ease-out!important}
    @keyframes fdPopIn{from{opacity:0;transform:translateY(6px) scale(.985)}to{opacity:1;transform:none}}
    @keyframes fdFadeIn{from{opacity:0}to{opacity:1}}
    @keyframes fdSlideIn{from{transform:translateX(18px);opacity:.4}to{transform:none;opacity:1}}

    @media(prefers-reduced-motion:reduce){
      .signin-page::before,.signin-page::after,.signin-showcase,.signin-showcase::before,.signin-showcase::after,.signin-particles i,.signin-shell,.signin-card,.signin-field,.signin-brand .logo,.sv-blob,.sv-nodes line,.sv-nodes circle,.fcard,.fc-bars i,.fc-ai-ring,.sv-security,.sv-trusted,.signin-hero,.otp-single,.otp-block{animation:none;transform:none}
    }

    .card{background:var(--surface);border:1px solid var(--border);border-radius:18px;box-shadow:var(--shadow);transition:transform .22s,box-shadow .22s,border-color .22s}
    .card-pad{padding:20px}
    .card-title{font-weight:700;font-size:15.5px;margin:0}
    .card-sub{font-size:12.5px;color:var(--muted);margin:2px 0 0}
    .section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;flex-wrap:wrap}
    .badge-pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;line-height:1.4}
    .dotc{width:6px;height:6px;border-radius:50%}

    .welcome{position:relative;z-index:20;display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:22px;flex-wrap:wrap}
    .welcome h1{margin:0;font-size:26px;font-weight:800;letter-spacing:-.02em}
    .welcome p{margin:6px 0 0;color:var(--muted);font-size:14px}
    .greet{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--primary);background:var(--primary-soft);padding:6px 12px;border-radius:20px;margin-bottom:10px}
    .qa-row{display:flex;gap:10px;flex-wrap:wrap}
    .grid-stats{display:grid;grid-template-columns:repeat(6,1fr);gap:16px;margin-bottom:22px}
    @media(max-width:1400px){.grid-stats{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:820px){.grid-stats{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:480px){.grid-stats{grid-template-columns:1fr}}
    .stat{position:relative;overflow:hidden;padding:18px}
    .stat:hover{transform:translateY(-4px);box-shadow:var(--shadow-lg)}
    .stat .ic{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;margin-bottom:14px}
    .stat .lab{font-size:12.5px;font-weight:600;color:var(--muted)}
    .stat .val{font-size:28px;font-weight:800;letter-spacing:-.02em;line-height:1.1;margin:2px 0 3px}
    .stat .desc{font-size:11.5px;color:var(--faint)}
    .stat .spark{position:absolute;right:12px;bottom:12px;width:74px;height:34px;opacity:.9}
    .stat .trend{position:absolute;top:16px;right:16px;font-size:11.5px;font-weight:700;display:inline-flex;align-items:center;gap:2px}
    .two-col{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;margin-top:22px}
    @media(max-width:1080px){.two-col{grid-template-columns:1fr}}
    .filters{display:flex;gap:6px;background:var(--surface-2);padding:4px;border-radius:12px}
    .filters button{border:0;background:transparent;padding:7px 13px;border-radius:9px;font-size:12.5px;font-weight:600;color:var(--muted);cursor:pointer;font-family:inherit;transition:all .16s}
    .filters button.on{background:var(--surface);color:var(--primary);box-shadow:var(--shadow)}
    .summary-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)}
    @media(max-width:560px){.summary-row{grid-template-columns:repeat(2,1fr)}}
    .summary-row .k{font-size:11.5px;color:var(--muted);font-weight:500}.summary-row .v{font-size:19px;font-weight:800;margin-top:2px}
    .tl{position:relative;padding-left:6px}
    .tl-item{position:relative;display:flex;gap:14px;padding:0 0 20px 22px}
    .tl-item::before{content:"";position:absolute;left:6px;top:22px;bottom:-2px;width:2px;background:var(--border)}
    .tl-item:last-child::before{display:none}
    .tl-node{position:absolute;left:0;top:4px;width:14px;height:14px;border-radius:50%;border:3px solid var(--surface);box-shadow:0 0 0 2px currentColor}
    .tl-av{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0}
    .tl-name{font-weight:700;font-size:13.5px}.tl-id{font-size:11.5px;color:var(--muted);font-weight:600}
    .tl-meta{font-size:12px;color:var(--muted);margin-top:3px}.tl-time{font-size:11px;color:var(--faint);white-space:nowrap}
    .dist-row{display:flex;align-items:center;gap:10px;font-size:12.5px;margin:9px 0}
    .dist-row .nm{flex:1;color:var(--muted);font-weight:500}.dist-row .ct{font-weight:700}.dist-row .pc{color:var(--faint);font-size:11.5px;width:40px;text-align:right}
    .perf-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
    @media(max-width:1200px){.perf-grid{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:680px){.perf-grid{grid-template-columns:repeat(2,1fr)}}
    .kpi{padding:18px;display:flex;flex-direction:column;align-items:center;text-align:center}
    .kpi .ring{position:relative;width:96px;height:96px;margin-bottom:12px}
    .kpi .ring b{position:absolute;inset:0;display:grid;place-items:center;font-size:19px;font-weight:800}
    .kpi .kt{font-size:12.5px;font-weight:600;color:var(--muted)}.kpi .ks{font-size:11px;color:var(--faint);margin-top:3px}
    .bar{height:7px;border-radius:6px;background:var(--surface-2);overflow:hidden;margin-top:10px;width:100%}
    .bar>i{display:block;height:100%;border-radius:6px;transition:width 1.1s cubic-bezier(.4,0,.2,1)}

    /* tickets */
    .page-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:10px;flex-wrap:wrap}
    .page-head h1{margin:0;font-size:24px;font-weight:800;letter-spacing:-.02em;display:flex;align-items:center;gap:10px}
    .count-badge{font-size:13px;font-weight:700;color:var(--primary);background:var(--primary-soft);padding:3px 11px;border-radius:20px}
    .page-head p{margin:6px 0 0;color:var(--muted);font-size:13.5px}
    /* The ticket list's own heading: the view's name at a readable size rather
       than a 24px page title, because the view is a filter, not a destination. */
    .route .page-head h1{font-size:16px;font-weight:700;letter-spacing:0}
    .route .page-head .count-badge{font-size:11px;padding:2px 9px}
    .toolbar{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:12px}
    .seg{display:flex;background:var(--surface-2);border-radius:11px;padding:3px}
    .seg button{border:0;background:transparent;display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:9px;font-size:12.5px;font-weight:600;color:var(--muted);cursor:pointer;font-family:inherit;transition:background .14s,color .14s,box-shadow .14s}
    .seg button.on{background:var(--surface);color:var(--primary);box-shadow:var(--shadow)}
    .dd{position:relative}
    .dd-menu{position:absolute;top:calc(100% + 6px);left:0;z-index:20;min-width:200px;background:var(--surface);border:1px solid var(--border);border-radius:13px;box-shadow:var(--shadow-lg);padding:6px;animation:pop .16s ease}
    .dd-menu button{display:flex;width:100%;align-items:center;gap:9px;padding:9px 11px;border:0;background:transparent;border-radius:9px;font-size:13px;color:var(--text);cursor:pointer;font-family:inherit;text-align:left}
    .dd-menu button:hover{background:var(--hover)}
    .dd-menu button.on{color:var(--primary);font-weight:600;background:var(--primary-soft)}
    @keyframes pop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
    /* minmax(0,1fr), NOT 1fr: a grid track is implicitly minmax(auto,1fr) and
       will not shrink below its content, so one long ticket subject widened the
       column and pushed the pagination off-screen. min-width:0 on the CHILD
       does not help -- the track is what refuses to shrink. */
    .tickets-layout{display:grid;grid-template-columns:236px minmax(0,1fr);gap:18px}
    /* Closed the panel is not rendered at all and the grid is one column, so
       the list gets the full width -- not a narrow strip of leftover gutter. */
    .tickets-layout.nav-shut{grid-template-columns:minmax(0,1fr);gap:0}

    /* The toggle lives in the toolbar; small, and lit while the panel is open. */
    .icon-btn.sm{width:34px;height:34px;border-radius:9px}
    .icon-btn.on{color:var(--primary);border-color:var(--primary);background:var(--primary-soft)}

    /* The read / unread split under the view list. */
    /* Beside the view name in the list header. */
    .head-split{display:inline-flex;align-items:center;gap:5px;margin-left:2px}
    .head-split .ss{font-size:10.5px;font-weight:500;border-radius:20px;padding:1px 8px;line-height:16px}
    .head-split .ss b{font-weight:700}
    .head-split .ss.unread{color:var(--primary);background:var(--primary-soft)}
    .head-split .ss.read{color:var(--faint);background:var(--surface-2)}

    /* The Unresolved card's own breakdown, in place of its description line. */
    .stat-split{display:flex;align-items:center;gap:5px;margin-top:4px;flex-wrap:wrap}
    .stat-split .ss{font-size:9.5px;font-weight:500;border-radius:20px;padding:0 7px;line-height:15px}
    .stat-split .ss b{font-weight:700}
    .stat-split .ss.unread{color:var(--primary);background:var(--primary-soft)}
    .stat-split .ss.read{color:var(--faint);background:var(--surface-2)}

    .tnav-read{display:flex;align-items:center;gap:6px;margin-top:10px;padding-top:9px;
      border-top:1px solid var(--border);font-size:10.5px;color:var(--faint)}
    .tnav-read b{font-weight:700;color:var(--muted)}
    .tnav-read .dot{opacity:.5}
    @media(max-width:900px){.tickets-layout{grid-template-columns:1fr}}
    .tnav{align-self:start;position:sticky;top:76px}
    .tnav .grp{width:100%;font-family:inherit;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
      color:var(--faint);display:flex;align-items:center;gap:7px;padding:5px 10px 9px;background:none;border:0;cursor:pointer}
    .tnav .grp:hover{color:var(--text)}
    .grp-caret{transition:transform .18s cubic-bezier(.4,0,.2,1);flex-shrink:0}
    .grp-caret.shut{transform:rotate(-90deg)}
    .grp-hint{margin-left:auto;font-size:10px;font-weight:700;color:var(--faint);background:var(--surface-2);padding:1px 7px;border-radius:20px}
    .tnav-list{animation:navOpen .18s cubic-bezier(.4,0,.2,1)}
    @keyframes navOpen{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
    .tnav-lab{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .tnav-item{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:11px;font-size:13px;font-weight:500;color:var(--muted);cursor:pointer;transition:background .13s,color .13s;margin-bottom:2px}
    .tnav-item:hover{background:var(--hover);color:var(--text)}
    .tnav-item.on{background:var(--primary-soft);color:var(--primary);font-weight:600}
    .tnav-item .c{margin-left:auto;font-size:11px;font-weight:700;color:var(--faint);background:var(--surface-2);padding:1px 8px;border-radius:20px}
    .tnav-item.on .c{background:var(--primary);color:#fff}
    .tnav-sep{height:1px;background:var(--border);margin:8px 6px}

    .tcard{position:relative;overflow:visible;padding:16px 18px;display:flex;flex-direction:column;gap:12px;
      /* Each row is its own layout/paint island: work inside one cannot make
         the browser reflow the other twenty-nine. */
      contain:layout style}
    .tcard::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--pc,var(--primary));
      border-radius:var(--r-md,14px) 0 0 var(--r-md,14px)}
    /* A list row must not lift: the transform would create a stacking context
       and trap the row's own dropdowns beneath the next row. */
    .tcard.slim:hover{transform:none;box-shadow:var(--shadow-sm,0 1px 2px rgba(0,0,0,.04))}
    /* With no transform in the way, the open menu can simply raise itself. */
    .rsel.open{z-index:40}
    .tcard:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);border-color:color-mix(in srgb,var(--pc,var(--primary)) 40%,var(--border))}
    /* The whole list arrives at once rather than thirty staggered layers. */
    .inbox-list{overflow:hidden;padding:0}
    .inbox-row{display:flex;align-items:center;gap:10px;padding:0 14px 0 0;min-height:42px;
      position:relative;border-bottom:1px solid color-mix(in srgb,var(--border) 65%,transparent);
      transition:background .13s}
    .inbox-row:last-child{border-bottom:0}
    .inbox-row:hover{background:var(--hover)}
    .inbox-row.sel{background:color-mix(in srgb,var(--primary) 7%,transparent)}
    /* Priority as a bar rather than a chip: it costs no column and reads at a
       glance, which is what priority is for in a list this dense. */
    .ib-prio{width:3px;align-self:stretch;flex-shrink:0;margin-right:4px}
    .inbox-row .cbx{flex-shrink:0;margin-left:8px}
    .ib-who{flex:0 0 150px;font-size:12.5px;font-weight:600;color:var(--text);cursor:default;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ib-main{flex:1;min-width:0;display:flex;align-items:baseline;gap:7px;border:0;background:none;
      padding:9px 0;font-family:inherit;text-align:left;cursor:pointer;overflow:hidden;white-space:nowrap}
    .ib-subj{font-size:12.5px;font-weight:600;color:var(--text);flex-shrink:0;max-width:60%;
      overflow:hidden;text-overflow:ellipsis}
    .inbox-row.unread .ib-subj{font-weight:750}
    .ib-main:hover .ib-subj{color:var(--primary)}
    .ib-id{font-size:11.5px;color:var(--faint);flex-shrink:0}
    /* The snippet takes whatever is left and gives up first. */
    .ib-snip{font-size:11.5px;font-weight:350;color:var(--muted);min-width:0;
      overflow:hidden;text-overflow:ellipsis}
    .ib-when{flex-shrink:0;font-size:11.5px;color:var(--faint);white-space:nowrap}
    /* Held open while its menu is: without this the button vanishes under the
       pointer the moment the row loses hover, and the menu closes with it. */
    .ib-menu{flex-shrink:0;opacity:0;transition:opacity .13s}
    .inbox-row:hover .ib-menu,.ib-menu:focus-within{opacity:1}
    .ib-menu .icon-btn{width:26px;height:26px}
    .ib-quick{padding:14px}
    .ib-quick-head{font-size:12.5px;font-weight:700;color:var(--text);margin-bottom:12px}
    .ib-quick-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .ib-quick-grid > label{display:flex;flex-direction:column;gap:6px;
      font-size:11.5px;font-weight:600;color:var(--muted);min-width:0}
    .ib-new{flex-shrink:0;min-width:18px;height:18px;padding:0 6px;border-radius:9px;
      background:#DCFCE7;color:#166534;font-size:10.5px;font-weight:750;
      display:grid;place-items:center}
    @media(max-width:900px){.ib-who{flex-basis:110px}.ib-snip{display:none}}

    .tlist{animation:listIn .18s cubic-bezier(.4,0,.2,1)}
    @keyframes listIn{from{opacity:0}to{opacity:1}}
    .tcard-top{display:flex;gap:13px;align-items:flex-start}
    .tav{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;color:#fff;font-weight:700;font-size:15px;flex-shrink:0}
    .tsubj{font-weight:700;font-size:14.5px;line-height:1.35;margin:2px 0 4px}
    .tmeta{font-size:12px;color:var(--muted);display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center}
    .tmeta .sep{color:var(--faint)}
    .chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:3px 9px;border-radius:8px;background:var(--surface-2);color:var(--muted)}
    .chip-green{background:var(--success-soft);color:var(--success)}
    .chip-red{background:var(--danger-soft);color:var(--danger)}
    /* ---- caller module ---- */
    .cp-calls{padding:12px 16px;border-bottom:1px solid var(--border)}
    .cp-calls-head{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;color:var(--text);text-transform:uppercase;letter-spacing:.05em;margin-bottom:7px}
    .cp-calls-row{font-size:13px;color:var(--muted)}
    .cp-calls-row b{color:var(--text);font-size:15px}
    .cp-miss{margin-left:8px;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:12px;background:var(--danger-soft);color:var(--danger)}
    .cp-calls-last{font-size:11.5px;color:var(--faint);margin-top:3px}
    .caller{display:flex;flex-direction:column;gap:14px}
    .caller-topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .caller-tabs{display:flex;gap:4px;flex-wrap:wrap;background:var(--surface-2);padding:4px;border-radius:12px}
    .caller-tabs button{display:inline-flex;align-items:center;gap:6px;border:0;background:none;color:var(--muted);font-family:inherit;font-size:12.5px;font-weight:700;padding:7px 13px;border-radius:9px;cursor:pointer;transition:all .15s;position:relative}
    .caller-tabs button:hover{color:var(--text)}
    .caller-tabs button.on{background:var(--surface);color:var(--primary);box-shadow:var(--shadow)}
    .tab-ct{background:var(--danger);color:#fff;font-size:9px;font-weight:800;min-width:16px;height:16px;border-radius:8px;display:inline-grid;place-items:center;padding:0 4px}
    .caller-kpis{grid-template-columns:repeat(8,1fr)}
    @media(max-width:1200px){.caller-kpis{grid-template-columns:repeat(4,1fr)}}
    @media(max-width:560px){.caller-kpis{grid-template-columns:repeat(2,1fr)}}
    .caller-dash-row{display:flex;gap:14px;flex-wrap:wrap}
    .call-row{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;cursor:pointer;transition:background .12s;border-bottom:1px solid var(--border)}
    .call-row:last-child{border-bottom:0}
    .call-row:hover{background:var(--hover)}
    .call-name{font-weight:700;font-size:12.5px;min-width:120px}
    .call-phone{font-size:12px;color:var(--muted);flex:1;min-width:100px}
    .call-dur{font-size:12px;font-weight:600;font-variant-numeric:tabular-nums}
    .call-time{font-size:11px;color:var(--faint);white-space:nowrap;min-width:96px;text-align:right}
    .call-badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:14px;white-space:nowrap}
    .call-badge.sm{font-size:10px;padding:2px 7px;gap:3px}
    .cb-g{background:var(--success-soft);color:var(--success)}.cb-b{background:var(--primary-soft);color:var(--primary)}.cb-r{background:var(--danger-soft);color:var(--danger)}.cb-o{background:var(--warning-soft);color:#B45309}.cb-x{background:var(--surface-2);color:var(--faint)}
    .app.dark .cb-o{color:#FBBF24}
    .badge-xs.st-g{background:var(--success-soft);color:var(--success)}.badge-xs.st-r{background:var(--danger-soft);color:var(--danger)}.badge-xs.st-o{background:var(--warning-soft);color:#B45309}.badge-xs.st-b{background:var(--primary-soft);color:var(--primary)}.badge-xs.st-x{background:var(--surface-2);color:var(--faint)}
    .mc-mini{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;border:1px solid var(--border);border-radius:10px;margin-bottom:7px;cursor:pointer;transition:border-color .12s}
    .mc-mini:hover{border-color:var(--primary)}
    .mc-mini b{display:block;font-size:12.5px}
    .mc-mini span{font-size:11px;color:var(--faint)}
    .caller-filters{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
    .cf-search{display:flex;align-items:center;gap:7px;flex:1;min-width:200px;height:38px;padding:0 12px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--faint)}
    .cf-search input{flex:1;border:0;background:none;outline:0;font-family:inherit;font-size:13px;color:var(--text)}
    .caller-filters>select{height:38px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-family:inherit;font-size:12.5px;padding:0 10px;outline:0;cursor:pointer}
    /* live incoming call */
    .incm-wrap{position:fixed;top:20px;right:20px;z-index:300;animation:incmIn .4s cubic-bezier(.34,1.4,.64,1)}
    @keyframes incmIn{from{opacity:0;transform:translateX(30px) scale(.96)}to{opacity:1;transform:none}}
    .incm{width:320px;background:var(--surface);border:1px solid var(--border);border-radius:20px;box-shadow:0 30px 70px -18px rgba(10,14,30,.5);overflow:hidden}
    .incm-top{display:flex;align-items:center;gap:11px;padding:16px 16px 12px;background:linear-gradient(135deg,color-mix(in srgb, var(--success) 12%, var(--surface)),var(--surface))}
    .incm-pulse{width:40px;height:40px;border-radius:50%;background:var(--success);color:#fff;display:grid;place-items:center;flex-shrink:0;animation:incmPulse 1.3s ease-in-out infinite}
    @keyframes incmPulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb, var(--success) 55%, transparent)}50%{box-shadow:0 0 0 10px transparent}}
    .incm-top b{display:block;font-size:14px}.incm-top span{font-size:11.5px;color:var(--muted)}
    .incm-top .icon-btn{margin-left:auto}
    .incm-num{font-size:20px;font-weight:800;letter-spacing:.01em;padding:4px 16px 0;font-variant-numeric:tabular-nums}
    .incm-name{display:flex;align-items:center;gap:6px;font-size:15px;font-weight:700;padding:8px 16px 0}
    .incm-reg{font-size:12px;font-weight:700;color:var(--success);padding:2px 16px 0}
    .incm-reg.unk{color:var(--faint)}
    .incm-ctx{display:flex;gap:5px;flex-wrap:wrap;padding:10px 16px 0}
    .incm-mini{display:flex;gap:14px;padding:12px 16px 4px}
    .incm-mini span{font-size:11px;color:var(--faint);font-weight:600}.incm-mini b{color:var(--text);font-size:14px;display:block}
    .incm-actions{display:flex;gap:7px;padding:14px 16px 16px;flex-wrap:wrap}
    .incm-actions .btn{flex:1}
    .incm-reject{color:var(--danger)}
    /* caller profile */
    .caller-prof{width:460px;max-width:94vw}
    .caller-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px}
    @media(max-width:560px){.caller-stats{grid-template-columns:repeat(3,1fr)}}
    .caller-stats div{text-align:center;padding:10px 6px;border-radius:11px;background:var(--surface-2)}
    .caller-stats b{display:block;font-size:18px}.caller-stats span{font-size:10px;color:var(--faint);font-weight:700}
    .caller-timeline{display:flex;flex-direction:column}
    .ctl-row{display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid var(--border)}
    .ctl-row:last-child{border-bottom:0}
    .ctl-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
    .ctl-dot.d-g{background:var(--success)}.ctl-dot.d-r{background:var(--danger)}.ctl-dot.d-o{background:var(--warning)}.ctl-dot.d-b{background:var(--accent)}.ctl-dot.d-x{background:var(--faint)}
    .ctl-main{flex:1;min-width:0}.ctl-main b{display:block;font-size:12.5px}.ctl-main span{font-size:11px;color:var(--muted)}
    /* missed cards */
    .caller-missed{display:flex;flex-direction:column;gap:10px}
    .mc-card{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
    .mc-l{display:flex;align-items:center;gap:12px}
    .mc-l b{font-size:14px}
    .mc-num{display:block;font-size:12px;color:var(--muted)}
    .mc-meta{display:flex;gap:6px;flex-wrap:wrap;font-size:11.5px;color:var(--faint);margin-top:2px}
    .mc-hi{color:var(--danger);font-weight:800}
    .mc-r{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
    .mc-cbstatus{height:32px;border:1px solid var(--border);border-radius:9px;background:var(--surface-2);color:var(--text);font-family:inherit;font-size:12px;padding:0 8px;outline:0;cursor:pointer}
    /* voicemail */
    .caller-vms{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}
    .vm-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:15px}
    .vm-head{display:flex;align-items:center;gap:10px;margin-bottom:11px}
    .vm-ic{width:34px;height:34px;border-radius:11px;background:var(--warning-soft);color:#B45309;display:grid;place-items:center;flex-shrink:0}
    .app.dark .vm-ic{color:#FBBF24}
    .vm-info{flex:1;min-width:0}.vm-info b{display:block;font-size:13px}.vm-info span{font-size:11px;color:var(--muted)}
    .vm-play{display:flex;align-items:center;gap:10px;width:100%;border:1px solid var(--border);background:var(--surface-2);border-radius:12px;padding:10px 12px;cursor:pointer;color:var(--primary);transition:border-color .15s}
    .vm-play:hover{border-color:var(--primary)}
    .vm-wave{flex:1;display:flex;align-items:center;gap:2px;height:28px}
    .vm-wave i{flex:1;background:var(--border);border-radius:2px;transition:background .2s}
    .vm-wave i.on{background:var(--primary);animation:vmWave .8s ease-in-out infinite alternate}
    @keyframes vmWave{from{transform:scaleY(.5)}to{transform:scaleY(1)}}
    .vm-time{font-size:11.5px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--muted)}
    .vm-transcript{margin-top:11px;padding:10px 12px;border-radius:10px;background:var(--surface-2);font-size:12px;line-height:1.55;color:var(--muted)}
    .vm-tl{display:flex;align-items:center;gap:5px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--primary);margin-bottom:5px}
    .vm-actions{display:flex;gap:7px;margin-top:11px}
    .caller-sim{flex-shrink:0}
    /* ---- agent dashboard (concise) ---- */
    .agd-lite{gap:14px}
    .agd-head{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
    .agd-head-l{display:flex;align-items:center;gap:12px}
    .agd-av.sm{width:44px;height:44px;border-radius:13px;font-size:15px;box-shadow:none}
    .agd-head h1{margin:0;font-size:18px;letter-spacing:-.02em}
    .agd-head p{margin:2px 0 0;font-size:12px;color:var(--muted)}
    .agd-head-r{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
    .agd-qa{display:flex;gap:7px}
    .agd-ranges.tight{gap:5px}
    .agd-ranges.tight .agd-chip{padding:6px 11px;font-size:11.5px}
    .agk-row{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}
    @media(max-width:1100px){.agk-row{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:560px){.agk-row{grid-template-columns:repeat(2,1fr)}}
    .agk{display:flex;align-items:center;gap:9px;padding:11px 12px;background:var(--surface);border:1px solid var(--border);border-radius:12px}
    .agk-ic{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;flex-shrink:0}
    .agk-ic.ic-b{background:var(--primary-soft);color:var(--primary)}
    .agk-ic.ic-g{background:var(--success-soft);color:var(--success)}
    .agk-ic.ic-o{background:var(--warning-soft);color:#B45309}
    .app.dark .agk-ic.ic-o{color:#FBBF24}
    .agk-ic.ic-r{background:var(--danger-soft);color:var(--danger)}
    .agk-main{flex:1;min-width:0}
    .agk-main b{display:block;font-size:17px;line-height:1.1;letter-spacing:-.02em}
    .agk-main span{font-size:10px;font-weight:700;color:var(--faint);white-space:nowrap}
    .agk-tr{display:inline-flex;align-items:center;gap:2px;font-size:9.5px;font-weight:800}
    .agk-tr.up{color:var(--success)}.agk-tr.dn{color:var(--danger)}
    .agd-mainrow{display:grid;grid-template-columns:1.35fr .65fr;gap:14px}
    @media(max-width:900px){.agd-mainrow{grid-template-columns:1fr}}
    .agd-subrow{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    @media(max-width:900px){.agd-subrow{grid-template-columns:1fr}}
    .agd-cardc{padding:14px 16px}
    .agd-cardc-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
    .agd-cardc-head h3{margin:0;font-size:13px;font-weight:800;display:inline-flex;align-items:center;gap:6px}
    .agd-link{border:0;background:none;color:var(--primary);font-family:inherit;font-size:11.5px;font-weight:700;cursor:pointer;padding:2px 0}
    .agd-link:hover{text-decoration:underline}
    .agd-tabs{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:9px}
    .agd-tabs button{border:0;background:none;color:var(--faint);font-family:inherit;font-size:11px;font-weight:700;padding:5px 10px;border-radius:8px;cursor:pointer;transition:all .12s}
    .agd-tabs button:hover{color:var(--text)}
    .agd-tabs button.on{background:var(--primary-soft);color:var(--primary)}
    .agd-trow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 10px;border:1px solid var(--border);border-radius:10px;margin-bottom:6px;cursor:pointer;transition:border-color .12s,background .12s}
    .agd-trow:hover{border-color:var(--primary);background:var(--hover)}
    .agd-trow-main{min-width:0}
    .agd-trow-main b{display:block;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .agd-trow-main span{font-size:11px;color:var(--muted)}
    .agd-trow-main .rep{font-style:normal;color:var(--primary);font-weight:600}
    .agd-trow-side{display:flex;align-items:center;gap:5px;flex-shrink:0}
    .agd-due{font-size:10.5px;font-weight:700;color:var(--faint);white-space:nowrap}
    .agd-due.o{color:#B45309}.app.dark .agd-due.o{color:#FBBF24}
    .agd-due.r{color:var(--danger)}
    .agd-empty{display:flex;align-items:center;gap:8px;justify-content:center;padding:22px 8px;font-size:12px;font-weight:600;color:var(--faint)}
    .agd-natt{display:flex;align-items:center;gap:9px;width:100%;border:1px solid var(--border);background:var(--surface);border-radius:10px;padding:10px 12px;margin-bottom:7px;font-family:inherit;font-size:12.5px;font-weight:600;color:var(--text);cursor:pointer;transition:border-color .12s,background .12s;text-align:left}
    .agd-natt b{font-size:14px}
    .agd-natt .d{width:8px;height:8px;border-radius:50%;flex-shrink:0}
    .agd-natt.r .d{background:var(--danger)}.agd-natt.o .d{background:var(--warning)}.agd-natt.b .d{background:var(--accent)}
    .agd-natt:hover{border-color:var(--primary);background:var(--hover)}
    .agd-natt-note{font-size:10.5px;color:var(--faint);margin-top:2px}
    .agd-perfc{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px}
    @media(max-width:560px){.agd-perfc{grid-template-columns:repeat(2,1fr)}}
    .agd-perfc div{padding:9px 11px;border-radius:10px;background:var(--surface-2)}
    .agd-perfc span{display:block;font-size:10px;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.04em}
    .agd-perfc b{font-size:16px;letter-spacing:-.02em}
    .agd-perfc i{font-style:normal;color:var(--warning);font-size:13px}
    .agd-spark-lbl{display:block;font-size:10.5px;color:var(--faint);font-weight:600;margin-top:2px}
    .agd-actc{display:flex;align-items:center;gap:9px;padding:7.5px 4px;border-bottom:1px solid var(--border);font-size:12.5px;cursor:pointer}
    .agd-actc:last-of-type{border-bottom:0}
    .agd-actc:hover{color:var(--primary)}
    .agd-actc .dot{width:7px;height:7px;border-radius:50%;background:var(--primary);opacity:.55;flex-shrink:0}
    .agd-actc i{margin-left:auto;font-style:normal;font-size:11px;color:var(--faint);white-space:nowrap}
    /* ---- agent dashboard ---- */
    .agd{display:flex;flex-direction:column;gap:16px}
    .agd-hero{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 24px;flex-wrap:wrap;background:linear-gradient(135deg,color-mix(in srgb, var(--primary) 7%, var(--surface)),var(--surface) 60%)}
    .agd-hero-l{display:flex;align-items:center;gap:16px;min-width:0}
    .agd-av{position:relative;width:58px;height:58px;border-radius:18px;display:grid;place-items:center;color:#fff;font-weight:800;font-size:19px;flex-shrink:0;box-shadow:0 12px 26px -8px rgba(15,23,42,.3)}
    .agd-av .st{position:absolute;right:-3px;bottom:-3px;width:14px;height:14px;border-radius:50%;border:2.5px solid var(--surface)}
    .st-online{background:var(--success)}.st-away{background:var(--warning)}.st-offline{background:#94A3B8}
    .agd-hero h1{margin:0 0 3px;font-size:21px;letter-spacing:-.02em}
    .agd-hero p{margin:0 0 8px;font-size:12.5px;color:var(--muted)}
    .agd-meta{display:flex;flex-wrap:wrap;gap:12px}
    .agd-meta span{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;color:var(--faint)}
    .agd-status{height:36px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-family:inherit;font-size:12.5px;font-weight:700;padding:0 12px;outline:0;cursor:pointer}
    .agd-ranges{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
    .agd-chip{border:1px solid var(--border);background:var(--surface);color:var(--muted);font-family:inherit;font-size:12px;font-weight:700;padding:7px 13px;border-radius:20px;cursor:pointer;transition:all .15s}
    .agd-chip:hover{border-color:var(--primary);color:var(--primary)}
    .agd-chip.on{background:var(--primary);border-color:var(--primary);color:#fff;box-shadow:0 6px 16px -6px color-mix(in srgb, var(--primary) 60%, transparent)}
    .agd-custom{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--faint)}
    .agd-custom input{height:32px;border:1px solid var(--border);border-radius:9px;background:var(--surface-2);color:var(--text);font-family:inherit;font-size:12px;padding:0 8px;outline:0}
    .agd-perf-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;align-items:center}
    @media(max-width:1100px){.agd-perf-grid{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:640px){.agd-perf-grid{grid-template-columns:repeat(2,1fr)}}
    .agd-stat{display:flex;flex-direction:column;gap:4px;padding:14px;border-radius:14px;background:var(--surface-2)}
    .agd-stat .k{font-size:11px;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.04em}
    .agd-stat b{font-size:23px;letter-spacing:-.02em}
    .agd-stat .s{font-size:11px;color:var(--muted)}
    .agd-stat .stars{color:var(--warning);letter-spacing:2px;font-size:13px}
    .agd-ring-wrap{display:flex;flex-direction:column;align-items:center;gap:7px}
    .agd-ring{border-radius:50%;display:grid;place-items:center;transition:background .5s}
    .agd-ring-in{width:72%;height:72%;border-radius:50%;background:var(--surface);display:grid;place-items:center}
    .agd-ring-in b{font-size:16px}
    .agd-ring-sub{font-size:11px;font-weight:700;color:var(--muted)}
    .agd-charts{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
    @media(max-width:900px){.agd-charts{grid-template-columns:1fr}}
    .agd-two{display:grid;grid-template-columns:1.2fr .8fr;gap:16px}
    @media(max-width:900px){.agd-two{grid-template-columns:1fr}}
    .agd-three{display:grid;grid-template-columns:1fr 1.1fr .9fr;gap:16px}
    @media(max-width:1100px){.agd-three{grid-template-columns:1fr}}
    .agd-att{display:flex;align-items:center;gap:11px;padding:11px 12px;border:1px solid var(--border);border-radius:12px;margin-bottom:8px;cursor:pointer;transition:border-color .15s,background .15s}
    .agd-att:hover{border-color:var(--primary);background:var(--hover)}
    .agd-att-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;animation:pulse 1.8s ease-in-out infinite}
    .agd-att-main{flex:1;min-width:0}
    .agd-att-main b{display:block;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .agd-att-main span{font-size:11px;color:var(--faint)}
    .agd-att-tags{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}
    .agd-act{display:flex;align-items:center;gap:10px;padding:9px 6px;border-bottom:1px solid var(--border);font-size:12.5px;cursor:pointer}
    .agd-act:last-child{border-bottom:0}
    .agd-act:hover{color:var(--primary)}
    .agd-act-ic{width:26px;height:26px;border-radius:9px;background:var(--primary-soft);color:var(--primary);display:grid;place-items:center;flex-shrink:0}
    .agd-act i{margin-left:auto;font-style:normal;font-size:11px;color:var(--faint);white-space:nowrap}
    .agd-prod{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
    .agd-prod-mini{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:10px;min-width:170px}
    .agd-prod-mini div{padding:10px 12px;border-radius:11px;background:var(--surface-2)}
    .agd-prod-mini b{display:block;font-size:17px}
    .agd-prod-mini span{font-size:10.5px;color:var(--faint);font-weight:600}
    .agd-csat-top{display:flex;align-items:baseline;gap:6px;margin-bottom:10px}
    .agd-csat-top b{font-size:32px;letter-spacing:-.02em}
    .agd-csat-top span{font-size:14px;color:var(--muted)}
    .agd-csat-row{display:flex;align-items:center;gap:9px;margin-bottom:6px;font-size:11.5px;font-weight:700;color:var(--muted)}
    .agd-csat-row .bar{flex:1;height:7px;border-radius:5px;background:var(--surface-2);overflow:hidden}
    .agd-csat-row .bar i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,var(--warning),#FBBF24)}
    .agd-csat-row .v{width:34px;text-align:right;color:var(--faint)}
    .agd-quote{margin-top:9px;padding:10px 13px;border-left:3px solid var(--primary);background:var(--surface-2);border-radius:0 10px 10px 0;font-size:12px;color:var(--muted);font-style:italic}
    .agd-goal{display:grid;grid-template-columns:1fr auto;gap:5px 12px;align-items:center;padding:9px 0;border-bottom:1px solid var(--border)}
    .agd-goal:last-child{border-bottom:0}
    .agd-goal .k{font-size:12.5px;font-weight:700}
    .agd-goal .t{font-size:12px;color:var(--muted);font-weight:700}
    .agd-goal input{width:76px;height:30px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text);font-family:inherit;font-size:12px;padding:0 8px;outline:0;text-align:right}
    .agd-goal .bar{grid-column:1/-1;height:6px;border-radius:5px;background:var(--surface-2);overflow:hidden}
    .agd-goal .bar i{display:block;height:100%;border-radius:5px;transition:width .5s}
    .agd-me{background:var(--primary-soft)}
    .agd-me td{font-weight:700}
    .agd-assign{height:26px;max-width:110px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text);font-family:inherit;font-size:11px;padding:0 5px;outline:0;cursor:pointer}
    .agd-lock{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;color:var(--faint);min-height:220px}
    .agd-lock b{color:var(--muted);font-size:14px}
    .agd-lock p{margin:0;font-size:12px;max-width:260px;line-height:1.55}
    /* ---- student context tags ---- */
    .stu-wrap{margin-top:12px}
    .stu-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
    .stu-tag{position:relative;display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:4px 10px;border-radius:16px;cursor:default;line-height:1.2;white-space:nowrap}
    .stu-tag.sm{font-size:9.5px;padding:2.5px 8px;gap:3px}
    .stu-tag.t-g{background:var(--success-soft);color:var(--success)}
    .stu-tag.t-b{background:var(--primary-soft);color:var(--primary)}
    .stu-tag.t-o{background:var(--warning-soft);color:#B45309}
    .app.dark .stu-tag.t-o{color:#FBBF24}
    .stu-tag.t-r{background:var(--danger-soft);color:var(--danger)}
    .stu-tag.t-x{background:var(--surface-2);color:var(--faint)}
    .stu-tip{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%) translateY(4px);min-width:180px;max-width:240px;background:var(--ink,#1E2433);color:#fff;border-radius:11px;padding:11px 13px;display:flex;flex-direction:column;gap:3px;font-size:11px;font-weight:500;line-height:1.5;box-shadow:0 14px 34px -10px rgba(10,14,30,.4);opacity:0;pointer-events:none;transition:opacity .15s,transform .15s;z-index:60;white-space:normal}
    .stu-tip b{font-size:11.5px;font-weight:800;margin-bottom:2px}
    .stu-tip::after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);border:5px solid transparent;border-top-color:var(--ink,#1E2433)}
    .stu-tag:hover .stu-tip{opacity:1;transform:translateX(-50%) translateY(0)}
    .app.dark .stu-tip{background:#0B0F1A}.app.dark .stu-tip::after{border-top-color:#0B0F1A}
    .stu-edit{display:inline-flex;align-items:center;gap:5px;border:1px dashed var(--border);background:none;color:var(--faint);font-family:inherit;font-size:10.5px;font-weight:700;padding:4px 10px;border-radius:16px;cursor:pointer;transition:all .15s}
    .stu-edit:hover{color:var(--primary);border-color:var(--primary)}
    .stu-activity{display:flex;flex-direction:column;gap:4px;margin-top:9px}
    .stu-activity span{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--faint)}
    .stu-activity b{color:var(--muted);font-weight:700}
    .stu-mini{display:flex;flex-wrap:wrap;gap:5px;padding:0 14px 4px 46px;margin-top:-2px}
    .stu-edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 14px}
    @media(max-width:560px){.stu-edit-grid{grid-template-columns:1fr}}
    .stu-edit-row{display:flex;flex-direction:column;gap:5px}
    .stu-edit-row label{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
    .stu-edit-row select,.stu-edit-row input{height:38px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--text);font-family:inherit;font-size:12.5px;padding:0 10px;outline:0;transition:border .15s}
    .stu-edit-row select:focus,.stu-edit-row input:focus{border-color:var(--primary);background:var(--surface)}
    .cp-stu{padding:12px 16px;border-bottom:1px solid var(--border)}
    .cp-stu-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;gap:8px;flex-wrap:wrap}
    .cp-stu-title{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;color:var(--text);text-transform:uppercase;letter-spacing:.05em}
    .ai-ready{display:inline-flex;align-items:center;gap:4px;font-size:9.5px;font-weight:800;padding:3px 8px;border-radius:12px;background:linear-gradient(135deg,var(--primary-soft),color-mix(in srgb, var(--accent) 18%, transparent));color:var(--primary);letter-spacing:.03em}
    .cp-stu-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:3.5px 0;font-size:12px}
    .cp-stu-row .k{color:var(--faint);font-weight:600}
    .cp-stu-row .v{display:inline-flex;align-items:center;gap:4px;font-weight:700;text-align:right}
    .cp-stu-row .tv-g{color:var(--success)}.cp-stu-row .tv-b{color:var(--primary)}.cp-stu-row .tv-o{color:#B45309}.app.dark .cp-stu-row .tv-o{color:#FBBF24}.cp-stu-row .tv-r{color:var(--danger)}.cp-stu-row .tv-x{color:var(--faint)}
    /* ---- user approvals ---- */
    .approval-row{display:flex;align-items:flex-start;gap:13px;padding:15px 14px;border:1px solid var(--border);border-radius:14px;margin-bottom:10px;animation:fade .3s}
    .approval-row.past{align-items:center;padding:10px 14px;opacity:.8}
    .approval-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
    .approval-info b{font-size:13.5px}
    .approval-info span{font-size:12px;color:var(--muted)}
    .approval-info .meta{font-size:11px;color:var(--faint)}
    .approval-info .badges{display:flex;gap:6px;margin-top:4px}
    .vbadge{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:var(--success-soft);color:var(--success)}
    .approval-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .approval-actions select{height:32px;border:1px solid var(--border);border-radius:9px;background:var(--surface-2);color:var(--text);font-family:inherit;font-size:12px;padding:0 8px;outline:0;cursor:pointer}
    @media(max-width:640px){.approval-row{flex-direction:column}.approval-actions{justify-content:flex-start}}
    .empty-min{display:flex;flex-direction:column;align-items:center;gap:8px;padding:34px 10px;color:var(--faint)}
    .empty-min p{margin:0;font-size:12.5px;font-weight:600}
    .sla{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:9px}
    .tcard-mid{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:2px 0}
    .due{display:flex;flex-direction:column;gap:2px;font-size:11.5px}
    .due .l{color:var(--faint);font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.03em}
    .due .v{font-weight:600}
    .tcard-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:12px;border-top:1px solid var(--border);flex-wrap:wrap}
    .tactions{display:flex;gap:5px;flex-wrap:wrap}
    .tactions button{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 11px;border-radius:9px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s}
    .tactions button:hover{color:var(--primary);border-color:var(--primary);background:var(--primary-soft)}
    .tactions button.danger:hover{color:var(--danger);border-color:var(--danger);background:#FEE2E2}

    .table-wrap{overflow-x:auto}
    table{width:100%;border-collapse:collapse;font-size:13px;min-width:900px}
    thead th{text-align:left;font-size:11.5px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;padding:12px 14px;border-bottom:1px solid var(--border);white-space:nowrap}
    tbody td{padding:12px 14px;border-bottom:1px solid var(--border);vertical-align:middle}
    tbody tr{transition:background .15s}tbody tr:hover{background:var(--hover)}tbody tr:last-child td{border-bottom:0}
    .cust{display:flex;align-items:center;gap:10px}
    .cust .a{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;color:#fff;font-weight:700;font-size:11.5px;flex-shrink:0}
    .cust .nm{font-weight:600}.cust .em{font-size:11px;color:var(--muted)}
    .subj{max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
    .row-act{display:flex;gap:4px}
    .row-act button{width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--muted);display:grid;place-items:center;cursor:pointer;transition:all .15s}
    .row-act button:hover{color:var(--primary);border-color:var(--primary)}

    .pager{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 4px 2px;flex-wrap:wrap}
    .pager.pager-top{padding:0 4px 9px;border-bottom:1px solid var(--border);margin-bottom:10px}
    .pager .info{font-size:12.5px;color:var(--muted)}
    .pg-btns{display:flex;gap:6px;align-items:center}
    .pg-btns button{min-width:34px;height:34px;border-radius:9px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-weight:600;font-size:12.5px;cursor:pointer;transition:all .15s;padding:0 10px;display:inline-flex;align-items:center;gap:4px}
    .pg-btns button:hover:not(:disabled){border-color:var(--primary);color:var(--primary)}
    .pg-btns button.on{background:var(--primary);color:#fff;border-color:var(--primary)}
    .pg-btns button:disabled{opacity:.4;cursor:not-allowed}
    .perpage{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted)}
    .perpage select{font-family:inherit;font-size:12.5px;font-weight:600;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:6px 8px;cursor:pointer}

    .drawer-overlay{position:fixed;inset:0;background:rgba(10,12,20,.42);z-index:1200;animation:fade .16s}
    .drawer{position:fixed;top:0;right:0;bottom:0;width:380px;max-width:92vw;background:var(--surface);z-index:1201;
      box-shadow:var(--shadow-lg);display:flex;flex-direction:column;
      animation:slideIn .22s cubic-bezier(.16,1,.3,1);
      will-change:transform;contain:paint}
    @keyframes slideIn{from{transform:translateX(100%)}to{transform:none}}
    @keyframes fade{from{opacity:0}to{opacity:1}}
    .drawer-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--border)}
    .drawer-body{flex:1;overflow-y:auto;padding:18px 20px;display:flex;flex-direction:column;gap:18px}
    .drawer-foot{display:flex;gap:10px;padding:16px 20px;border-top:1px solid var(--border)}
    .fld label{display:block;font-size:12px;font-weight:600;color:var(--text);margin-bottom:8px}
    .fld input,.fld select{width:100%;font-family:inherit;font-size:13px;color:var(--text);background:var(--surface-2);border:1px solid transparent;border-radius:10px;padding:9px 11px}
    .fld input:focus,.fld select:focus{outline:0;border-color:var(--primary);background:var(--surface)}
    .chips{display:flex;flex-wrap:wrap;gap:7px}
    .fchip{font-size:12px;font-weight:600;padding:6px 11px;border-radius:9px;border:1px solid var(--border);background:var(--surface);color:var(--muted);cursor:pointer;transition:all .15s;font-family:inherit}
    .fchip.on{background:var(--primary);color:#fff;border-color:var(--primary)}

    .sk{position:relative;overflow:hidden;background:var(--surface-2);border-radius:8px}
    .sk::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--surface) 60%,transparent),transparent);animation:shimmer 1.3s infinite}
    @keyframes shimmer{100%{transform:translateX(100%)}}
    .sk-card{padding:16px 18px;display:flex;flex-direction:column;gap:14px}

    @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
    .fade{opacity:0;animation:fadeUp .55s cubic-bezier(.4,0,.2,1) forwards}
    @keyframes routeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
    .route{animation:routeIn .35s cubic-bezier(.4,0,.2,1)}
    .tooltip-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow-lg);padding:10px 13px;font-size:12.5px}
    .tt-lab{font-weight:700;margin-bottom:6px}.tt-row{display:flex;align-items:center;gap:7px;margin:3px 0}

    .overlay{position:fixed;inset:0;background:rgba(10,12,20,.45);z-index:35;backdrop-filter:blur(2px)}
    .burger{display:none}
    @media(max-width:960px){.sidebar{position:fixed;right:0;top:0;transform:translateX(100%)}.sidebar.open{transform:translateX(0);box-shadow:var(--shadow-lg)}.burger{display:grid}.clock,.searchbox kbd{display:none}}
    @media(min-width:961px){.overlay{display:none}}
    /* ---- automation center ---- */
    .auto-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px;flex-wrap:wrap}
    .auto-head h1{margin:0;font-size:25px;font-weight:800;letter-spacing:-.02em;display:flex;align-items:center;gap:11px}
    .auto-head .badge-live{font-size:11px;font-weight:700;color:var(--success);background:var(--success-soft);padding:4px 10px;border-radius:20px;display:inline-flex;align-items:center;gap:5px}
    .auto-head p{margin:7px 0 0;color:var(--muted);font-size:14px}
    .head-actions{display:flex;gap:9px;flex-wrap:wrap;align-items:center}
    .btn-sm{padding:7px 12px;font-size:12.5px}
    .switch{position:relative;width:44px;height:24px;border-radius:20px;background:var(--surface-2);border:1px solid var(--border);cursor:pointer;transition:background .2s,border-color .2s;flex-shrink:0;padding:0}
    .switch.on{background:var(--success);border-color:var(--success)}
    .switch i{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .2s}
    .switch.on i{transform:translateX(20px)}
    .status-chip{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:20px}
    .mod-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
    @media(max-width:1200px){.mod-grid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:600px){.mod-grid{grid-template-columns:1fr}}
    .settings-layout{display:grid;grid-template-columns:260px 1fr;gap:18px;align-items:start}
    @media(max-width:980px){.settings-layout{grid-template-columns:1fr}}
    .settings-nav{position:sticky;top:76px;padding:8px}
    @media(max-width:980px){.settings-nav{position:static;display:flex;overflow-x:auto;gap:6px}}
    .settings-nav button{width:100%;display:flex;align-items:center;gap:10px;border:0;background:transparent;color:var(--muted);border-radius:11px;padding:10px 12px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;text-align:left;transition:all .16s}
    .settings-nav button:hover{background:var(--hover);color:var(--text)}
    .settings-nav button.on{background:var(--primary-soft);color:var(--primary)}
    @media(max-width:980px){.settings-nav button{white-space:nowrap;width:auto}}
    .settings-stack{display:flex;flex-direction:column;gap:16px}
    .settings-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
    @media(max-width:740px){.settings-grid{grid-template-columns:1fr}}
    .settings-card{padding:18px}
    .settings-card h3{margin:0 0 4px;font-size:15.5px;font-weight:800;display:flex;align-items:center;gap:9px}
    .settings-card p{margin:0;color:var(--muted);font-size:12.5px;line-height:1.5}
    .setting-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 0;border-top:1px solid var(--border)}
    .setting-row:first-child{border-top:0;padding-top:0}
    .setting-row .title{font-size:13.5px;font-weight:700}
    .setting-row .desc{font-size:12px;color:var(--muted);margin-top:3px;line-height:1.45}
    .setting-list{margin-top:16px}
    .field-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:16px}
    @media(max-width:620px){.field-grid{grid-template-columns:1fr}}
    .field label{display:block;font-size:11.5px;font-weight:700;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.03em}
    .field input,.field select{width:100%;height:40px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);border-radius:10px;padding:0 11px;font-family:inherit;font-size:13px;outline:0}
    .field input:focus,.field select:focus{border-color:var(--primary);background:var(--surface)}
    .settings-pill-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
    .settings-metric{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--border);border-radius:14px;background:var(--surface-2)}
    .settings-metric .ic{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;background:var(--surface);color:var(--primary)}
    .settings-metric b{font-size:18px}.settings-metric span{display:block;font-size:11.5px;color:var(--muted);margin-top:2px}
    .settings-channel{display:flex;align-items:center;gap:12px;padding:13px;border:1px solid var(--border);border-radius:13px;background:var(--surface)}
    .settings-channel .ic{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;flex-shrink:0}
    .settings-channel b{font-size:13.5px}.settings-channel span{display:block;font-size:12px;color:var(--muted);margin-top:2px}
    .settings-hero{display:grid;grid-template-columns:1.2fr .8fr;gap:16px;margin-bottom:18px}
    @media(max-width:940px){.settings-hero{grid-template-columns:1fr}}
    .settings-profile{display:flex;align-items:center;gap:14px}
    .settings-avatar{width:58px;height:58px;border-radius:16px;display:grid;place-items:center;color:#fff;font-weight:800;font-size:18px;background:linear-gradient(135deg,var(--primary),var(--accent))}
    .settings-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
    .admin-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    @media(max-width:1100px){.admin-grid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:680px){.admin-grid{grid-template-columns:1fr}}
    .agent-card{padding:15px;display:flex;gap:12px;align-items:flex-start}
    .agent-card .meta{flex:1;min-width:0}.agent-card b{font-size:13.5px}.agent-card span{display:block;font-size:12px;color:var(--muted);margin-top:2px}
    .agent-card .acts{display:flex;gap:5px}
    .perm-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
    @media(max-width:760px){.perm-grid{grid-template-columns:1fr}}
    .timeline-list{position:relative;padding-left:6px;margin-top:14px}
    .timeline-row{position:relative;display:flex;gap:12px;padding:0 0 17px 22px}
    .timeline-row:before{content:"";position:absolute;left:6px;top:24px;bottom:-2px;width:2px;background:var(--border)}
    .timeline-row:last-child:before{display:none}
    .timeline-dot{position:absolute;left:0;top:5px;width:14px;height:14px;border-radius:50%;border:3px solid var(--surface);box-shadow:0 0 0 2px currentColor}
    .timeline-row b{font-size:13.5px}.timeline-row span{display:block;font-size:12px;color:var(--muted);margin-top:3px}
    .doc-row{display:flex;align-items:center;gap:12px;padding:13px;border:1px solid var(--border);border-radius:13px;background:var(--surface);margin-top:10px}
    .doc-row .doc-ic{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;background:var(--primary-soft);color:var(--primary);flex-shrink:0}
    .doc-row .doc-main{flex:1;min-width:0}.doc-row b{font-size:13.5px}.doc-row span{display:block;font-size:12px;color:var(--muted);margin-top:2px}
    .doc-row .doc-actions{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}
    .settings-modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    @media(max-width:560px){.settings-modal-grid{grid-template-columns:1fr}}
    .sk-line{height:13px;border-radius:10px;background:linear-gradient(90deg,var(--surface-2),var(--hover),var(--surface-2));background-size:220% 100%;animation:shimmer 1.1s infinite}
    .sk-block{height:92px;border-radius:14px;background:linear-gradient(90deg,var(--surface-2),var(--hover),var(--surface-2));background-size:220% 100%;animation:shimmer 1.1s infinite}
    @keyframes shimmer{from{background-position:120% 0}to{background-position:-120% 0}}
    .mod{padding:18px;cursor:pointer;position:relative;overflow:hidden;display:flex;flex-direction:column;gap:12px;animation:fadeUp .5s cubic-bezier(.4,0,.2,1) both}
    .mod:hover{transform:translateY(-4px);box-shadow:var(--shadow-lg)}
    .mod.sel{border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-soft),var(--shadow)}
    .mod .ic{width:44px;height:44px;border-radius:12px;display:grid;place-items:center}
    .mod h4{margin:0;font-size:15px;font-weight:700}
    .mod p{margin:0;font-size:12.5px;color:var(--muted);line-height:1.5;flex:1}
    .mod-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:12px;border-top:1px solid var(--border)}
    .panel{margin-bottom:24px;animation:fadeUp .4s cubic-bezier(.4,0,.2,1)}
    .panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid var(--border);flex-wrap:wrap}
    .panel-title{display:flex;align-items:center;gap:11px;font-weight:700;font-size:16px}
    .panel-title .pic{width:36px;height:36px;border-radius:10px;display:grid;place-items:center}
    .toolbar2{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:14px 20px;border-bottom:1px solid var(--border)}
    .fchip{display:inline-flex;align-items:center;gap:6px}
    .fchip:hover{border-color:var(--primary);color:var(--primary)}
    thead th{background:var(--surface-2)}
    .rname{font-weight:700}.rsub{font-size:11.5px;color:var(--muted);margin-top:2px}
    .row-act button.danger:hover{color:var(--danger);border-color:var(--danger)}
    .fld textarea{width:100%;font-family:inherit;font-size:13px;color:var(--text);background:var(--surface-2);border:1px solid transparent;border-radius:10px;padding:10px 12px;resize:vertical;min-height:96px;line-height:1.6}
    .fld textarea:focus{outline:0;border-color:var(--primary);background:var(--surface)}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    @media(max-width:560px){.grid2{grid-template-columns:1fr}}
    .builder-row{display:flex;gap:9px;align-items:center;flex-wrap:wrap;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2)}
    .builder-row select,.builder-row input{background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:8px 10px;font-family:inherit;font-size:12.5px;color:var(--text)}
    .andor{display:flex;gap:4px;background:var(--surface-2);border-radius:9px;padding:3px;width:max-content}
    .andor button{border:0;background:transparent;padding:5px 12px;border-radius:7px;font-size:12px;font-weight:700;color:var(--muted);cursor:pointer;font-family:inherit}
    .andor button.on{background:var(--primary);color:#fff}
    .live{background:var(--surface-2);border:1px dashed var(--border);border-radius:12px;padding:16px;font-size:13px;line-height:1.65;color:var(--text)}
    .token{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;padding:5px 9px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--primary);cursor:pointer;font-family:inherit}
    .token:hover{background:var(--primary-soft)}
    .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
    @media(max-width:1100px){.kpi-grid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:480px){.kpi-grid{grid-template-columns:1fr}}
    .kpi{padding:18px;display:flex;gap:14px;align-items:center}
    .kpi .ic{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;flex-shrink:0}
    .kpi .val{font-size:24px;font-weight:800;letter-spacing:-.02em;line-height:1.1}
    .kpi .lab{font-size:12px;color:var(--muted);font-weight:500;margin-top:2px}
    .ring-wrap{position:relative;width:120px;height:120px;margin:0 auto}
    .ring-wrap b{position:absolute;inset:0;display:grid;place-items:center;font-size:26px;font-weight:800}
    .analytics-grid{display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:16px;margin-top:16px}
    @media(max-width:1000px){.analytics-grid{grid-template-columns:1fr}}
    /* Same reasoning as .drawer-overlay: a full-screen blur re-composites the
       entire page behind every modal, for as long as it is open. */
    .modal-overlay{position:fixed;inset:0;background:rgba(10,12,20,.5);z-index:1200;display:grid;place-items:center;padding:20px;animation:fade .16s}
    .modal{width:560px;max-width:100%;max-height:88vh;overflow:auto;background:var(--surface);border-radius:20px;box-shadow:var(--shadow-lg);animation:popm .22s cubic-bezier(.4,0,.2,1)}
    .modal-head{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--surface)}
    .modal-body{padding:20px 22px;display:flex;flex-direction:column;gap:16px}
    .modal-foot{display:flex;gap:10px;justify-content:flex-end;padding:16px 22px;border-top:1px solid var(--border);position:sticky;bottom:0;background:var(--surface)}
    @keyframes popm{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:none}}
    @keyframes fade{from{opacity:0}to{opacity:1}}
    /* ---- ticket detail ---- */
    .crumb{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;color:var(--muted);margin-bottom:14px;flex-wrap:wrap}
    .crumb a{color:var(--primary);cursor:pointer;text-decoration:none}
    .crumb a:hover{text-decoration:underline}
    /* Inside the conversation column now, level with the queue's own header
       and joined to the thread below it. No margin: the gap it used to leave
       was what made the buttons read as a separate, unrelated panel. */
    .td-bar{display:flex;align-items:center;gap:6px;padding:9px 12px;margin:0;flex-wrap:wrap;
      flex:0 0 auto;border-bottom:1px solid var(--border);background:var(--surface);
      position:sticky;top:0;z-index:3}
    .td-bar .sp{margin-left:auto}
    /* The list's title, now sharing the toolbar row rather than owning a band
       of its own above it. */
    /* Where you are, in the bar rather than in a band of its own beneath it. */
    .fd-crumb{display:flex;align-items:center;gap:8px;min-width:0;font-size:14px;font-weight:600;
      color:var(--muted);overflow:hidden;white-space:nowrap}
    .fd-crumb a{color:var(--primary);cursor:pointer;text-decoration:none;flex-shrink:0}
    .fd-crumb a:hover{text-decoration:underline}
    .fd-crumb .cur{color:var(--text);font-weight:700;overflow:hidden;text-overflow:ellipsis}
    .fd-crumb svg{flex-shrink:0;opacity:.6}
    @media(max-width:900px){.fd-crumb{font-size:13px}}
    /* Queue · conversation · properties. minmax(0,…) on the middle track or a
       long subject refuses to shrink and pushes the properties panel off. */
    /* No gutter between the queue and the conversation: they read as one
       surface split by a rule, the way Freshdesk's does. The properties column
       keeps its gap, added as a margin since one grid can only have one gap. */
    .td-grid{display:grid;grid-template-columns:330px minmax(0,1fr) 316px;
      column-gap:0;row-gap:18px;align-items:stretch;
      transition:grid-template-columns .2s cubic-bezier(.4,0,.2,1);
      /* The frame is whatever is left under the toolbar, measured rather than
         guessed -- a fixed calc would be wrong as soon as the toolbar wraps. */
      flex:1;min-height:0}
    /* The whole column scrolls, composer included -- see the note above about
       why pinning it was wrong. The subject stays put at the top, which costs
       nothing and keeps the ticket identified while you read. */
    .td-grid > .td-convo{display:flex;flex-direction:column;min-height:0;overflow-y:auto;
      overscroll-behavior:contain;padding:0}
    .td-convo > .td-subj{flex:0 0 auto;
      padding:16px 18px 13px;margin:0;background:var(--surface);border-bottom:1px solid var(--border)}
    /* Room down the left so the conversation is not flush against the rule
       between it and the queue. */
    .td-thread{padding:6px 26px 0 30px}
    .td-convo > .reply-bar{margin:0;padding:12px 18px 18px}
    .td-convo > .comp-collapse{padding:0 18px 18px}
    /* Closed, there is no third track at all. */
    .td-grid.props-shut{grid-template-columns:330px minmax(0,1fr)}
    .td-grid.queue-shut{grid-template-columns:minmax(0,1fr) 316px}
    .td-grid.queue-shut.props-shut{grid-template-columns:minmax(0,1fr)}
    /* Pushed to the right of the sort label, where Freshdesk keeps it. */
    .tq-toggle{margin-left:auto;width:28px;height:28px}
    /* No gutter anywhere: the three columns are one panel. The radius lives on
       the outer edges, and the seams between them are borders. */
    .td-grid > .props{margin-left:0;border-left:1px solid var(--border);border-radius:0}
    .td-grid > .tq{border-top-left-radius:18px;border-bottom-left-radius:18px}
    .td-grid > .td-convo{border-radius:0;border-left:1px solid var(--border);border-right:0}
    .td-grid > .tq,.td-grid > .td-convo,.td-grid > .props{min-height:0;max-height:100%}
    /* Whichever column is last closes the panel. */
    .td-grid > .props:last-child,
    .td-grid > .td-convo:last-child{border-top-right-radius:18px;border-bottom-right-radius:18px}
    .td-grid.queue-shut > .td-convo:first-child{border-left:1px solid var(--border);
      border-top-left-radius:18px;border-bottom-left-radius:18px}
    /* One shadow around the whole thing, not three overlapping ones. */
    .td-grid > .tq,.td-grid > .td-convo,.td-grid > .props{box-shadow:none}
    .td-grid{box-shadow:var(--shadow);border-radius:18px}

    /* ---- the properties column: fixed, and scrolling inside itself ----
       Only the conversation should move the page. This column stays put and
       runs its own scrollbar when its content is taller than the window. */
    .td-grid > .props{height:100%;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding-right:2px}
    /* (The properties toggle moved into the ticket action bar.) */
    /* The chips moved to the properties column; the header is a title now. */
    .td-subj{align-items:center;padding-bottom:14px}
    .td-subj h2{font-size:17px;line-height:1.35}
    @media(max-width:1400px){.td-grid{grid-template-columns:minmax(0,1fr) 330px}
                             /* The queue is hidden here, so props-shut leaves
                                one column -- without this it kept an empty
                                330px track beside the conversation. */
                             .td-grid.props-shut{grid-template-columns:minmax(0,1fr)}
                             .td-grid > .tq{display:none}}
    @media(max-width:1100px){.td-grid{grid-template-columns:1fr}}

    /* ---- the queue rail ----
       Flush against the conversation: a rule on the right, no card border and
       no rounding on that edge, so the two columns read as one surface. */
    .tq{background:var(--surface);border:1px solid var(--border);border-right:0;
      border-radius:14px 0 0 14px;display:flex;flex-direction:column;
      height:100%;min-height:0}
    .tq-sort{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;
      font-family:inherit;font-size:12px;font-weight:650;color:var(--text);cursor:pointer;
      padding:4px 6px;border-radius:8px;margin-left:-6px}
    .tq-sort:hover{background:var(--hover)}
    .tq-sort svg{opacity:.7}
    .tq-head{display:flex;align-items:center;gap:7px;width:100%;font-size:11.5px;font-weight:600;
      color:var(--muted);background:var(--surface);border-bottom:1px solid var(--border);
      padding:11px 14px;flex-shrink:0}
    .tq-title{flex:1;text-align:left}
    .tq-count{font-size:10.5px;color:var(--faint)}
    .tq-list{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain}

    /* One row: who · when, then the subject, then a line of the message. */
    .tq-item{display:flex;align-items:flex-start;gap:10px;width:100%;text-align:left;font-family:inherit;
      background:none;border:0;border-left:3px solid transparent;
      padding:11px 13px;cursor:pointer;color:var(--text);transition:background .13s}
    .tq-item:hover{background:var(--hover)}
    .tq-item.on{background:var(--primary-soft);border-left-color:var(--primary);cursor:default}
    .tq-av{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;color:#fff;
      font-weight:700;font-size:11px;flex-shrink:0;margin-top:1px}
    .tq-txt{display:flex;flex-direction:column;min-width:0;gap:3px;flex:1}
    .tq-line1{display:flex;align-items:center;gap:8px;min-width:0}
    .tq-who{flex:1;min-width:0;font-size:11.5px;font-weight:400;color:var(--muted);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .tq-ago{display:inline-flex;align-items:center;gap:3px;flex-shrink:0;font-size:10.5px;color:var(--faint)}
    .tq-subj{font-size:12.5px;font-weight:600;line-height:1.35;color:var(--text);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .tq-item.on .tq-subj{color:var(--primary)}
    .tq-snip{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:350;font-style:italic;color:var(--faint);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .tq-snip svg{flex-shrink:0}
    .tq-more{padding:12px;text-align:center;font-size:11px;color:var(--faint)}
    .tq-new{flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:2px;
      margin-top:2px;line-height:1;background:none}
    .tq-new b{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;
      background:#DCFCE7;color:#166534;font-size:9.5px;font-weight:750}
    .tq-new i{font-size:11px;font-weight:650;font-style:normal;color:#166534;letter-spacing:.01em}

    /* The conversation card meets the rail: square that edge and drop the
       duplicated border so there is a single rule between them. */
    .td-grid > .tq + .card{border-top-left-radius:0;border-bottom-left-radius:0}

    /* ---- "someone already replied" ---- */
    /* The "@" picker: one line for the name, a smaller one for the address. */
    .mention-pop .cp-item{align-items:center;gap:10px}
    .men-av{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;color:#fff;
      font-weight:700;font-size:10.5px;flex-shrink:0}
    .men-mail{font-size:11px;color:var(--faint);margin-top:1px;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .men-role{margin-left:auto;flex-shrink:0;font-size:9.5px;font-weight:700;letter-spacing:.03em;
      text-transform:uppercase;color:var(--faint);background:var(--surface-2);border-radius:4px;padding:1px 6px}

    /* Folder headings inside the "/c" picker. */
    .cp-group{padding-bottom:2px}
    .cp-folder{display:flex;align-items:center;gap:6px;padding:8px 12px 4px;font-size:10px;font-weight:700;
      letter-spacing:.05em;text-transform:uppercase;color:var(--faint)}
    .cp-folder span{margin-left:auto;font-weight:600;letter-spacing:0;text-transform:none}
    .cp-sc{margin-left:7px;font-size:10px;font-weight:600;color:var(--primary);
      background:var(--primary-soft);border-radius:4px;padding:0 5px}

    .cp-pv{font-size:11px;color:var(--faint);line-height:1.45;margin-top:3px;
      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

    .comp-warn{display:flex;align-items:flex-start;gap:9px;margin:0 16px 10px;padding:9px 12px;
      font-size:12.5px;line-height:1.5;color:var(--warning);
      background:color-mix(in srgb,var(--warning) 12%,transparent);
      border:1px solid color-mix(in srgb,var(--warning) 30%,transparent);border-radius:10px;
      animation:navOpen .16s cubic-bezier(.4,0,.2,1)}
    .comp-warn b{font-weight:700}
    .comp-warn-sub{color:var(--muted)}
    .td-subj{display:flex;align-items:flex-start;gap:18px;margin-bottom:8px}
    .td-subj .env{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--primary-soft);color:var(--primary);flex-shrink:0}
    .td-subj h2{margin:0;font-size:17px;font-weight:700;letter-spacing:-.015em;line-height:1.35;
      color:color-mix(in srgb,var(--text) 78%,var(--muted))}
    .subj-new{display:inline-block;margin-top:8px;padding:2px 9px;border-radius:6px;
      font-size:11px;font-weight:650;background:#DCFCE7;color:#166534}
    .msg{display:flex;gap:14px;padding:18px 0}
    .msg-av{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0}
    .msg-head{font-size:13px;color:var(--muted);line-height:1.45;margin-bottom:12px}
    .msg-head b{color:var(--primary);font-weight:700}
    /* Not on a private note: those are from a colleague, and colouring them
       like a customer would blur the one distinction that matters there. */
    .entry-note .msg-head b{color:var(--text)}
    .msg-verb{color:var(--muted)}
    .msg-when{color:var(--faint);font-size:12px}
    .msg-to{font-size:12px;color:var(--faint);margin:0 0 9px}
    .msg-to b{color:var(--muted);font-weight:650}
    .msg-body{font-size:13px;line-height:1.6;white-space:pre-wrap;margin-top:0}
    /* ---- real conversation: HTML bodies, attachments, delivery state ----
       Agent replies sit on a tinted card, the customer's on the page itself.
       That is the whole reason Freshdesk's threads read at a glance: you can
       see whose turn each block is before reading a single word. */
    .msg-card{flex:1;min-width:0}
    .msg-card-agent{background:var(--surface-2, #f6f7fb);border:1px solid var(--border);
      border-radius:12px;padding:12px 14px;margin-top:-2px}

    /* 350 rather than 400: the body should read as text, not as UI. Any
       lighter and it thins out badly on a Windows machine without subpixel
       antialiasing, which is what most of this team is reading on. */
    .msg-body,.msg-html{font-weight:350}
    .msg-body b,.msg-body strong,.msg-html b,.msg-html strong{font-weight:600}
    .msg-html b,.msg-html strong{font-weight:600}
    .msg-html{font-size:13px;line-height:1.6;color:var(--text);overflow-wrap:anywhere;
      /* Undo .msg-body's pre-wrap: this element holds MARKUP, and its source
         newlines are formatting, not content. Plain-text bodies keep theirs
         through the inline style MimeParser puts on their wrapper. */
      white-space:normal}
    /* Mail arrives wrapped in a div per line, each carrying the client's own
       margins. Flattening them is what turns a wall of white space back into a
       paragraph. Only the OUTER spacing of real block elements is kept. */
    .msg-html div,.msg-html span,.msg-html font{margin:0}
    .msg-html p{margin:0 0 2px}
    .msg-html p:last-child,.msg-html div:last-child{margin-bottom:0}
    .msg-html ul,.msg-html ol{margin:6px 0 9px;padding-left:22px}
    .msg-html li{margin:2px 0}
    .msg-html h1,.msg-html h2,.msg-html h3,.msg-html h4{font-size:14.5px;font-weight:700;margin:12px 0 6px;line-height:1.35}
    .msg-html hr{border:0;border-top:1px solid var(--border);margin:12px 0}
    /* Padding only -- most tables in email are layout scaffolding for a
       signature, and drawing borders on those turns them into spreadsheets. */
    .msg-html td,.msg-html th{padding:3px 7px;vertical-align:top}
    /* A customer's mail can contain a 2000px-wide table; it scrolls inside its
       own box rather than stretching the whole ticket page sideways. */
    .msg-html table{max-width:100%;display:block;overflow-x:auto;border-collapse:collapse}
    /* An inline picture in the message body: a soft frame while it loads, so a
       slow image reads as "coming" rather than as a hole in the email. */
    .msg-html img[data-fd-loading]{min-width:120px;min-height:90px;
      background:linear-gradient(90deg,var(--surface-2) 0%,var(--hover) 50%,var(--surface-2) 100%);
      background-size:200% 100%;animation:attshimmer 1.1s ease-in-out infinite;
      border:1px solid var(--border)}
    .msg-html img[data-fd-failed]{min-width:160px;min-height:64px;padding:12px;
      border:1px dashed var(--border);background:var(--surface-2);
      border-radius:8px;object-fit:contain}
    .msg-html img{max-width:100%;height:auto;border-radius:6px}
    .msg-html blockquote{margin:8px 0;padding-left:12px;border-left:3px solid var(--border);color:var(--muted)}
    .msg-html a{color:var(--primary);text-decoration:underline}
    .msg-html pre{white-space:pre-wrap;overflow-x:auto;background:var(--surface-2, #f6f7fb);padding:10px;border-radius:8px}
    .entry-note{background:color-mix(in srgb, #F59E0B 7%, transparent);border-radius:12px;padding:12px;margin:8px 0}
    .entry-failed{background:color-mix(in srgb, #EF4444 6%, transparent);border-radius:12px;padding:12px;margin:8px 0}
    .msg-blocked{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted);background:var(--surface-2, #f6f7fb);
      border:1px dashed var(--border);border-radius:8px;padding:6px 10px;margin:9px 0 0}
    .msg-error{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12.5px;color:#DC2626;margin-top:10px}
    /* Images are shown, not just listed -- a screenshot is the message half
       the time and clicking to see it buys nothing. */
    /* ---- attachments on a message ---- */
    /* A framed strip, so a file someone sent never reads as part of the
       message body the way a bare <img> did. */
    .att-strip{margin-top:14px;border:1px solid var(--border);border-radius:14px;background:var(--surface-2);overflow:hidden}
    .att-strip-head{display:flex;align-items:center;gap:7px;padding:9px 13px;font-size:11.5px;font-weight:700;
      letter-spacing:.03em;text-transform:uppercase;color:var(--muted);
      border-bottom:1px solid var(--border);background:var(--surface)}
    .att-grid{display:flex;flex-wrap:wrap;gap:11px;padding:12px 13px}

    .att-card{width:168px;border:1px solid var(--border);border-radius:12px;background:var(--surface);
      overflow:hidden;transition:border-color .15s,box-shadow .15s,transform .15s}
    .att-card:hover{border-color:color-mix(in srgb,var(--primary) 45%,var(--border));
      box-shadow:0 8px 22px -12px rgba(15,23,42,.28);transform:translateY(-1px)}
    .att-card-thumb{position:relative;height:118px;display:grid;place-items:center;
      background:var(--surface-2);overflow:hidden}
    .att-card-thumb img{width:100%;height:100%;object-fit:cover;display:block;transition:opacity .2s}

    /* The shimmer sits behind the image and is simply covered when it arrives,
       so there is no flash of empty tile between the two. */
    .att-card-skel{position:absolute;inset:0;
      background:linear-gradient(90deg,var(--surface-2) 0%,var(--hover) 50%,var(--surface-2) 100%);
      background-size:200% 100%;animation:attshimmer 1.1s ease-in-out infinite}
    @keyframes attshimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}

    /* Hidden until the card is hovered or something inside it has focus --
       keyboard users get the same affordance without a mouse. */
    .att-card{cursor:pointer}
    .att-card:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
    .att-card-acts{position:absolute;inset:0;display:grid;place-items:center;
      background:color-mix(in srgb,#0B0F1A 42%,transparent);opacity:0;transition:opacity .18s}
    .att-card:hover .att-card-acts,.att-card:focus-within .att-card-acts{opacity:1}
    .att-card-acts a{width:38px;height:38px;border-radius:50%;border:0;cursor:pointer;
      display:grid;place-items:center;background:rgba(255,255,255,.95);color:#0B0F1A;
      text-decoration:none;box-shadow:0 6px 20px rgba(10,14,30,.35);
      transition:transform .16s,background .16s}
    .att-card-acts a:hover{background:#fff;transform:scale(1.09)}

    .att-card-meta{padding:8px 10px 9px;display:flex;flex-direction:column;gap:2px;min-width:0}
    .att-card-name{font-size:12px;font-weight:650;color:var(--text);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .att-card-sub{display:flex;align-items:center;gap:5px;font-size:10.5px;color:var(--faint);font-weight:600}

    .msg-atts{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}
    .att-chip{display:inline-flex;align-items:center;gap:7px;max-width:280px;padding:6px 10px;border:1px solid var(--border);
      border-radius:999px;background:var(--surface);font-size:12px;color:var(--text);text-decoration:none;
      font-family:inherit;cursor:pointer;transition:border-color .15s,background .15s}
    .att-chip:hover{border-color:var(--primary);background:color-mix(in srgb, var(--primary) 6%, transparent)}
    .att-chip.att-err{border-color:#EF4444;color:#DC2626}
    .att-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .att-size{color:var(--faint);font-size:11px;flex-shrink:0}
    .att-x{border:0;background:none;cursor:pointer;color:var(--faint);display:inline-flex;padding:0;margin-left:2px}
    .att-x:hover{color:#DC2626}
    .comp-files{display:flex;flex-wrap:wrap;gap:8px;padding:0 16px 12px;align-items:flex-start;
      max-height:118px;overflow-y:auto;overscroll-behavior:contain}
    /* A finished upload is previewable, and says so. */
    .att-chip.att-open{cursor:pointer}
    .att-chip.att-open:hover{border-color:var(--primary);color:var(--primary)}

    /* Image attachments show themselves rather than their filename. */
    .att-thumb{position:relative;display:block;padding:0;border:1px solid var(--border);border-radius:10px;
      background:var(--surface-2);cursor:pointer;overflow:hidden;line-height:0;
      transition:border-color .14s,transform .14s}
    .att-thumb:hover{border-color:var(--primary);transform:translateY(-1px)}
    .att-thumb img{display:block;width:92px;height:72px;object-fit:cover}
    .att-thumb-x{position:absolute;top:4px;right:4px;width:18px;height:18px;border-radius:50%;
      display:grid;place-items:center;background:rgba(10,12,20,.62);color:#fff;cursor:pointer;line-height:0}
    .att-thumb-x:hover{background:var(--danger)}
    .att-thumb-cap{position:absolute;left:0;right:0;bottom:0;padding:2px 6px;font-size:9.5px;line-height:1.5;
      color:#fff;background:linear-gradient(transparent,rgba(10,12,20,.72));text-align:right}
    /* Freshdesk's "···". Small, quiet, and exactly where the eye expects the
       rest of the thread to be hiding. */
    .t-act{flex-shrink:0;font-family:inherit;font-size:12px;font-weight:700;color:var(--primary);
      background:var(--primary-soft);border:1px solid color-mix(in srgb,var(--primary) 28%,transparent);
      border-radius:8px;padding:5px 11px;cursor:pointer;transition:background .15s}
    .t-act:hover{background:color-mix(in srgb,var(--primary) 18%,transparent)}

    /* Ctrl/Cmd-click opens these; the cursor says so on the way past. */

    .quote-dots{display:inline-flex;align-items:center;justify-content:center;margin-top:10px;
      width:34px;height:22px;padding:0;border:1px solid var(--border);border-radius:6px;
      background:var(--surface-2, #f6f7fb);color:var(--muted);cursor:pointer;
      transition:background .15s,color .15s,border-color .15s}
    .quote-dots:hover{background:var(--hover);color:var(--text);border-color:var(--primary)}
    .quote-dots.on{background:var(--primary-soft);color:var(--primary);border-color:var(--primary)}
    .msg-quoted{margin-top:10px;padding-left:12px;border-left:2px solid var(--border);
      color:var(--muted);font-size:12.5px;animation:quoteIn .14s ease-out}
    @keyframes quoteIn{from{opacity:0}to{opacity:1}}

    /* The folded middle of a long thread. */
    .convo-fold{display:flex;align-items:center;gap:12px;padding:13px 0 13px 46px}
    .convo-fold::before,.convo-fold::after{content:"";flex:1;height:1px;background:var(--border)}
    .convo-fold-btn{display:inline-flex;align-items:center;gap:6px;flex-shrink:0;
      font-family:inherit;font-size:12px;font-weight:600;color:var(--primary);
      background:var(--primary-soft);border:1px solid color-mix(in srgb,var(--primary) 25%,transparent);
      border-radius:999px;padding:5px 12px;cursor:pointer;transition:background .15s}
    .convo-fold-btn:hover{background:color-mix(in srgb,var(--primary) 16%,transparent)}

    /* ======================================================================
       WORKSPACE RAIL — now the only chrome on the page
       ====================================================================== */
    .rail-actions{padding:14px 12px 10px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:9px}
    .rail-row{display:flex;align-items:center;gap:6px}
    /* Collapsed rail: icons only, centred, and the labels genuinely gone
       (display:none, not opacity) so they cannot catch clicks. */
    .sidebar.collapsed .rail-row{flex-direction:column}
    .sidebar.collapsed .lbl{display:none}
    .sidebar.collapsed .rail-search{display:none}
    .rail-search{animation:railGrow .16s ease-out}
    @keyframes railGrow{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
    .rail-search .searchbox{width:100%;max-width:none}
    .rail-search .search-results{left:0;right:0}
    .rail-new{width:100%;justify-content:center}
    .sidebar.collapsed .rail-new{padding:9px 0}
    .nav-item.subtle{color:var(--muted);font-weight:600}

    /* No generated avatar colour here: this is the signed-in agent, not a
       customer, and a bright block in the corner of the rail reads as an alert.
       The one status worth showing is the mailbox connection, as a corner dot. */
    .rail-account .acc-av{position:relative;background:var(--surface-2);color:var(--text);font-weight:700}
    .rail-account .acc-av::after{content:"";position:absolute;right:-1px;bottom:-1px;
      width:9px;height:9px;border-radius:50%;border:2px solid var(--surface);background:var(--faint)}
    .rail-account .acc-av.ok::after{background:var(--success)}
    .rail-account .acc-av.warn::after{background:var(--warning)}
    .rail-account .acc-av.bad::after{background:var(--danger)}
    .rail-account{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:10px;
      background:var(--surface-2, #f6f7fb);margin-bottom:8px;min-width:0}
    .rail-account .lbl{display:flex;flex-direction:column;min-width:0;line-height:1.3}
    .rail-account b{font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .rail-account small{font-size:11px;color:var(--faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

    .notif-pop{max-height:60vh;overflow:auto;padding:0}
    .notif-head{display:flex;align-items:center;justify-content:space-between;padding:11px 13px;border-bottom:1px solid var(--border);font-size:13px}
    .notif-empty{padding:22px 14px;text-align:center;color:var(--muted);font-size:12.5px;display:flex;gap:8px;align-items:center;justify-content:center}
    .notif-row{display:flex;gap:10px;align-items:flex-start;width:100%;padding:10px 13px;border:0;background:none;
      cursor:pointer;text-align:left;border-bottom:1px solid color-mix(in srgb, var(--border) 55%, transparent)}
    .notif-row:hover{background:var(--surface-2, #f6f7fb)}
    .notif-ic{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;flex-shrink:0;
      background:var(--primary-soft);color:var(--primary)}
    .notif-txt{display:flex;flex-direction:column;min-width:0;gap:2px}
    .notif-txt b{font-size:12.5px;font-weight:600;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .notif-txt small{font-size:11px;color:var(--faint)}
    .notif-sub{font-size:11.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .notif-tabs{display:flex;align-items:center;gap:6px;padding:9px 13px;border-bottom:1px solid var(--border)}
    .notif-tabs button{border:0;background:transparent;font-family:inherit;font-size:12px;font-weight:600;
      color:var(--muted);padding:5px 10px;border-radius:8px;cursor:pointer}
    .notif-tabs button:hover{background:var(--hover)}
    .notif-tabs button.on{background:var(--primary-soft);color:var(--primary)}
    .notif-clear{margin-left:auto;display:inline-flex;align-items:center;gap:5px;font-size:11.5px}
    .notif-clear:disabled{opacity:.5;cursor:default}
    .notif-row.unread{background:color-mix(in srgb,var(--primary) 5%,transparent)}
    .notif-row.unread .notif-txt b{font-weight:750}
    .notif-row.unread:hover{background:color-mix(in srgb,var(--primary) 9%,transparent)}
    /* Not colour alone: the dot says "unread" to anyone who cannot see the tint. */
    .notif-dot{width:8px;height:8px;border-radius:50%;background:var(--primary);flex-shrink:0;margin-top:7px}

    /* The burger only exists below 1024px, where the rail is off-canvas. */
    .rail-burger{display:none;position:fixed;right:14px;bottom:14px;z-index:60;width:46px;height:46px;border-radius:50%;
      border:0;background:var(--primary);color:#fff;box-shadow:0 10px 26px -8px rgba(15,23,42,.45);cursor:pointer;
      align-items:center;justify-content:center}
    @media(max-width:1024px){.rail-burger{display:flex}}

    .icon-btn.sm{width:26px;height:26px}
    .icon-btn.on{background:var(--primary-soft);color:var(--primary)}

    /* ======================================================================
       TOP BAR — back, expanding search, notifications, theme
       ====================================================================== */
    .fd-topbar{flex:0 0 auto;position:sticky;top:0;z-index:36;display:flex;align-items:center;gap:8px;
      padding:10px 22px;min-height:52px;background:transparent;border-bottom:0;
      transition:background .18s,box-shadow .18s}
    /* Opaque, not translucent: the whole point is that nothing shows through. */
    .fd-topbar.is-scrolled{background:var(--bg);box-shadow:0 4px 16px -10px rgba(15,23,42,.45)}
    /*
     * Not on the ticket screen. There the bar is static and the panel below it
     * has its own top edge, so nothing ever passes underneath -- a shadow would
     * be an affordance for a problem that screen does not have.
     */
    .main-fixed .fd-topbar.is-scrolled{background:transparent;box-shadow:none}
    .fd-topbar-gap{margin-left:auto}

    /* The trigger and the field are the same box widening, so the expansion
       reads as one motion rather than two elements swapping. */
    .fd-search{position:relative;transition:width .26s cubic-bezier(.4,0,.2,1);width:230px;max-width:46vw}
    .fd-search.open{width:min(520px,58vw)}
    .fd-search-btn{display:flex;align-items:center;gap:8px;width:100%;height:34px;padding:0 12px;
      border:1px solid var(--border);border-radius:var(--r-sm, 8px);background:var(--surface-2);
      color:var(--muted);font-size:12.5px;font-weight:500;font-family:inherit;cursor:pointer;
      transition:border-color .16s,background .16s}
    .fd-search-btn:hover{border-color:color-mix(in srgb,var(--primary) 40%,var(--border));background:var(--surface)}
    .fd-search-btn kbd{margin-left:auto;font-size:10.5px;padding:1px 5px;border-radius:4px;
      background:var(--surface);border:1px solid var(--border);color:var(--faint);font-family:inherit}
    /* The student lookup, left of the ticket search. Same height and shape so
       the two read as a pair, but always open -- it has no shortcut to hide
       behind. It gives up width before the ticket search does (flex-shrink),
       and drops off narrow screens where the pair cannot both fit. */
    .fd-stusearch{display:flex;align-items:center;gap:8px;height:34px;padding:0 12px;
      flex:0 1 275px;min-width:160px;
      border:1px solid var(--border);border-radius:var(--r-sm, 8px);background:var(--surface-2);
      color:var(--muted);transition:border-color .16s,background .16s,box-shadow .16s}
    .fd-stusearch svg{flex-shrink:0}
    .fd-stusearch input{flex:1;min-width:0;border:0;background:transparent;padding:0;
      font-family:inherit;font-size:12.5px;color:var(--text)}
    .fd-stusearch input::placeholder{color:var(--faint)}
    /* The wrapper is the control, so the wrapper takes the ring -- see the
       focus-ring note above. */
    .fd-stusearch:focus-within{background:var(--surface);border-color:var(--primary);
      box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 13%,transparent)}
    @media(max-width:1080px){.fd-stusearch{display:none}}

    .fd-search .search-wrap{animation:fdSearchIn .22s cubic-bezier(.34,1.2,.64,1)}
    @keyframes fdSearchIn{from{opacity:0;transform:scaleX(.94);transform-origin:left}to{opacity:1;transform:none}}
    .fd-search .searchbox{height:34px;max-width:none;width:100%}
    /* The input already sits in a bordered box; its own focus ring drew a
       SECOND border inside the first, which is what looked broken. */
    .fd-search .searchbox input,.searchbox input{outline:none!important;box-shadow:none!important;border:0!important;background:transparent}
    .fd-search .searchbox:focus-within{border-color:var(--primary);
      box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 14%,transparent)}
    @media(max-width:760px){.fd-search-btn span{display:none}.fd-search{width:44px}.fd-search.open{width:min(360px,70vw)}}

    /* ======================================================================
       RICH EDITOR
       ====================================================================== */
    .rte-wrap{display:flex;flex-direction:column;min-height:0}
    .rte-body{padding:14px 16px;font-size:14px;line-height:1.65;color:var(--text);outline:none;
      overflow-y:auto;max-height:52vh}
    .rte-body:empty::before,.rte-body[data-empty]::before{content:attr(data-placeholder);color:var(--faint);pointer-events:none}
    .rte-body p{margin:0 0 10px}
    .rte-body h2{font-size:19px;font-weight:700;margin:14px 0 8px}
    .rte-body h3{font-size:16px;font-weight:700;margin:12px 0 6px}
    .rte-body ul,.rte-body ol{margin:8px 0 12px;padding-left:26px}
    .rte-body li{margin:3px 0}
    .rte-body blockquote{margin:10px 0;padding:2px 0 2px 12px;border-left:3px solid var(--border);color:var(--muted)}
    .rte-body pre{background:var(--surface-2);padding:10px 12px;border-radius:8px;white-space:pre-wrap;font-size:13px}
    .rte-body a{color:var(--primary);text-decoration:underline}
    /* Ctrl/Cmd-click opens these; the cursor says so on the way past. */
    .rte-body a:hover{cursor:pointer}
    .rte-body img{max-width:100%;border-radius:6px}
    .rte button.on{background:var(--primary-soft);color:var(--primary)}
    .rte-actions{border-top:1px solid var(--border)}

    /* ======================================================================
       ATTACHMENT PREVIEW
       ====================================================================== */
    .ap-overlay{position:fixed;inset:0;z-index:1500;background:rgba(8,10,18,.82);
      backdrop-filter:blur(3px);display:grid;place-items:center;padding:26px;animation:fade .18s}
    .ap-shell{width:min(1180px,96vw);height:min(88vh,900px);display:flex;flex-direction:column;
      background:var(--surface);border-radius:var(--r-lg,16px);overflow:hidden;box-shadow:var(--shadow-lg);
      animation:apIn .22s cubic-bezier(.34,1.25,.64,1)}
    @keyframes apIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}
    .ap-head{display:flex;align-items:center;gap:12px;padding:11px 14px;border-bottom:1px solid var(--border);flex-shrink:0}
    .ap-title{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:650;min-width:0;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ap-size{color:var(--faint);font-weight:500;font-size:11.5px}
    .ap-tools{margin-left:auto;display:flex;align-items:center;gap:6px;flex-shrink:0}
    .ap-zoom{font-size:11.5px;color:var(--muted);min-width:38px;text-align:center}
    .ap-body{flex:1;min-height:0;position:relative;display:grid;place-items:center;overflow:auto;background:var(--surface-2)}
    .ap-img{max-width:100%;max-height:100%;object-fit:contain;transition:transform .18s ease}
    .ap-frame{width:100%;height:100%;border:0;background:#fff}
    .ap-text{margin:0;padding:20px;width:100%;height:100%;overflow:auto;font-size:12.5px;
      line-height:1.6;white-space:pre-wrap;word-break:break-word;background:var(--surface);align-self:stretch}
    .ap-table-wrap{width:100%;height:100%;overflow:auto;background:var(--surface);align-self:stretch}
    .ap-table{border-collapse:collapse;font-size:12.5px;width:100%}
    .ap-table th,.ap-table td{border:1px solid var(--border);padding:6px 10px;text-align:left;white-space:nowrap}
    .ap-table th{background:var(--surface-2);font-weight:650;position:sticky;top:0}
    .ap-note{padding:10px 14px;font-size:12px;color:var(--muted)}
    /* Workbook tabs, along the top of the grid rather than the bottom: the
       table scrolls and they must not scroll away with it. */
    .ap-sheets{display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid var(--border);
      background:var(--surface);position:sticky;top:0;z-index:2;overflow-x:auto}
    .ap-sheet{border:1px solid var(--border);background:var(--surface-2);color:var(--muted);
      padding:5px 11px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;
      font-family:inherit;white-space:nowrap}
    .ap-sheet:hover{color:var(--text)}
    .ap-sheet.on{background:var(--primary-soft);color:var(--primary);border-color:transparent}
    .ap-loading{gap:12px}
    .ap-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
      padding:40px;color:var(--muted);font-size:13px;text-align:center}
    .ap-nopreview h4{margin:4px 0 0;font-size:14.5px;color:var(--text);word-break:break-word}
    .ap-nopreview p{margin:0;max-width:420px;line-height:1.55}
    .ap-actions{display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;justify-content:center}
    /* Audio sits under its icon; video fills the viewer on black, the way every
       player the agent already uses presents one. */
    .ap-media audio{margin-top:8px}
    .ap-video{max-width:100%;max-height:100%;background:#000;border-radius:8px;outline:0}
    .ap-nav{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;
      border:0;background:rgba(20,22,34,.55);color:#fff;display:grid;place-items:center;cursor:pointer;
      transition:background .15s}
    .ap-nav:hover{background:rgba(20,22,34,.78)}
    .ap-nav.left{left:14px}.ap-nav.right{right:14px}
    .ap-strip{display:flex;gap:8px;padding:10px 14px;border-top:1px solid var(--border);overflow-x:auto;flex-shrink:0}
    .ap-thumb{width:46px;height:46px;border-radius:8px;border:2px solid transparent;background:var(--surface-2);
      overflow:hidden;cursor:pointer;flex-shrink:0;padding:0;display:grid;place-items:center}
    .ap-thumb.on{border-color:var(--primary)}
    .ap-thumb img{width:100%;height:100%;object-fit:cover}
    .ap-thumb-ic{font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase}

    /* clickable attachment chips in the thread */
    .att-clickable{border:1px solid var(--border);background:var(--surface);cursor:pointer;font-family:inherit}
    .att-clickable:hover{border-color:var(--primary);background:color-mix(in srgb,var(--primary) 6%,transparent)}
    .att-thumb{width:22px;height:22px;border-radius:5px;object-fit:cover;flex-shrink:0}
    .msg-html img{cursor:pointer}
    .msg-img{position:relative;display:inline-block;max-width:100%;line-height:0;
      border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--surface-2);
      transition:border-color .15s,box-shadow .15s}
    .msg-img:hover{border-color:color-mix(in srgb,var(--primary) 45%,var(--border));
      box-shadow:0 8px 22px -14px rgba(15,23,42,.4)}
    .msg-img img{display:block;max-width:100%;height:auto;border-radius:0;cursor:pointer}
    /* Top-right rather than centred: the middle of a screenshot is usually the
       part being pointed at, and covering it to offer a download is rude. */
    .msg-img{cursor:pointer}
    .msg-img-acts{position:absolute;inset:0;display:grid;place-items:center;
      background:color-mix(in srgb,#0B0F1A 42%,transparent);
      opacity:0;transition:opacity .18s}
    .msg-img:hover .msg-img-acts,.msg-img:focus-within .msg-img-acts{opacity:1}
    .msg-img-acts button{width:42px;height:42px;border-radius:50%;border:0;cursor:pointer;
      display:grid;place-items:center;line-height:0;color:#0B0F1A;text-decoration:none;
      background:rgba(255,255,255,.95);box-shadow:0 6px 20px rgba(10,14,30,.35);
      transition:transform .16s,background .16s}
    .msg-img-acts button:hover{background:#fff;transform:scale(1.09)}
    .msg-img-acts button svg{width:19px;height:19px}

    /* Each column owns its own scrollbar now, so they stretch to the frame
       rather than sizing to their content. (This was align-items:start, from
       when the whole page scrolled -- it silently defeated the stretch set on
       .td-grid and stopped the conversation scrolling at all.) */
    .app .td-grid{align-items:stretch}
    .app .props{min-width:0}
    .app .props .card{overflow:visible}
    .app .cp-stu,.app .intern,.app .noreg{overflow:visible}

    /* A .fld normally styles its own <input>; RecipientInput brings its own
       wrapper, so the box moves out to that wrapper instead. */
    .rcpt-field{display:flex;align-items:center;width:100%;padding:9px 12px;background:var(--surface-2);
      border:1px solid var(--border);border-radius:var(--r-sm,8px);transition:border-color .16s,box-shadow .16s}
    .rcpt-field:focus-within{border-color:var(--primary);
      box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 13%,transparent);background:var(--surface)}

    .act-loading{display:flex;align-items:center;gap:9px;padding:26px 20px;color:var(--muted);font-size:13px}
    .act-item.act-click{cursor:pointer;border-radius:10px}
    .act-item.act-click:hover{background:var(--hover)}

    /* ======================================================================
       HORIZONTAL OVERFLOW — why the pagination vanished on page 2
       ======================================================================
       .tickets-layout is a grid whose content column is 1fr. A grid (and flex)
       track will NOT shrink below its content's min-content width unless it is
       told to: min-width defaults to auto. One long, unbroken ticket subject
       therefore widened the whole column, pushing everything to its right --
       the page buttons included -- past the viewport, where .main's
       overflow-x:hidden clipped them. Nothing was missing; it was off-screen.

       Two parts to the fix: let the tracks shrink, and make the long text
       actually truncate rather than demand the width. */
    .app .tickets-layout{min-width:0}
    .app .tickets-layout > *{min-width:0}
    .app .td-grid > *{min-width:0}
    .app .two-col > *{min-width:0}

    /* Ticket rows: the subject is the offender, so it ellipsises. */
    .app .tcard{min-width:0}
    .app .tcard .subj,.app .tcard .tsubject{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .app .tc-head,.app .tc-row{min-width:0}
    .app .tc-head > *{min-width:0}
    /* Long addresses and subjects in the table view break instead of stretching. */
    .app .table-wrap{overflow-x:auto}
    .app table .subj{max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}

    /* The pager keeps its buttons on screen: they wrap under the count rather
       than being pushed out of the container. */
    .app .pager{flex-wrap:wrap;row-gap:12px}
    .app .pg-btns{flex-wrap:wrap;justify-content:flex-start}

    /* ---- recipient autocomplete ---- */
    .rcpt{position:relative;flex:1;min-width:0;display:flex;align-items:center}
    .rcpt input{width:100%;border:0;outline:0;background:transparent;font-size:13.5px;color:var(--text);font-family:inherit}
    .rcpt-busy{position:absolute;right:6px;color:var(--faint);pointer-events:none}

    /* ----------------------------------------------------------------------
       SEARCHABLE SELECT
       ----------------------------------------------------------------------
       Replaces the native <select> in the Assign dialog, which had to build a
       popup for every ticket on the click. This renders at most 60 rows and
       animates in over 120ms, so it opens the moment it is asked to. */
    .ssel{position:relative;width:100%}
    .ssel-btn{display:flex;align-items:center;gap:8px;width:100%;font-family:inherit;font-size:13px;
      color:var(--text);background:var(--surface-2);border:1px solid transparent;border-radius:10px;
      padding:9px 11px;cursor:pointer;text-align:left;transition:border-color .16s,box-shadow .16s}
    .ssel-btn:hover{border-color:var(--border)}
    .ssel.open .ssel-btn{border-color:var(--primary);background:var(--surface);
      box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 13%,transparent)}
    .ssel-val{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ssel-val.ph{color:var(--faint)}
    .ssel-caret{flex-shrink:0;color:var(--muted);transition:transform .16s}
    .ssel.open .ssel-caret{transform:rotate(180deg)}

    .ssel-panel{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:1300;
      background:var(--surface);border:1px solid var(--border);border-radius:12px;
      box-shadow:0 18px 44px rgba(0,0,0,.22);overflow:hidden;
      animation:sselIn .12s cubic-bezier(.22,1,.36,1)}
    @keyframes sselIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
    .ssel-search{display:flex;align-items:center;gap:8px;padding:9px 11px;
      border-bottom:1px solid var(--border);color:var(--muted)}
    .app .ssel-search input{flex:1;min-width:0;border:0!important;outline:0!important;box-shadow:none!important;
      background:transparent!important;padding:0!important;border-radius:0!important;
      font-family:inherit;font-size:13px;color:var(--text)}
    .ssel-clear{border:0;background:none;color:var(--faint);cursor:pointer;display:grid;place-items:center;padding:2px}
    .ssel-clear:hover{color:var(--text)}

    .ssel-list{max-height:280px;overflow-y:auto;overscroll-behavior:contain;padding:4px}
    .ssel-row{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:0;background:none;
      cursor:pointer;text-align:left;border-radius:8px;font-family:inherit;color:var(--text)}
    .ssel-row.hi{background:var(--primary-soft)}
    .ssel-row.on b{color:var(--primary)}
    .ssel-txt{display:flex;flex-direction:column;min-width:0;flex:1;line-height:1.35}
    .ssel-txt b{font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ssel-txt small{font-size:11.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ssel-hint{font-size:10.5px;color:var(--faint);white-space:nowrap;flex-shrink:0}
    .ssel-tick{color:var(--primary);flex-shrink:0}
    .ssel-empty{padding:18px 12px;text-align:center;font-size:12.5px;color:var(--muted)}
    .ssel-foot{padding:7px 11px;border-top:1px solid var(--border);background:var(--surface-2);
      font-size:11px;color:var(--faint)}
    .rcpt-menu{position:absolute;top:calc(100% + 6px);left:-6px;right:-6px;z-index:1250;
      background:var(--surface);border:1px solid var(--border);border-radius:var(--r,12px);
      box-shadow:var(--shadow-lg);overflow:hidden;max-height:270px;overflow-y:auto;
      animation:fdPopIn .13s cubic-bezier(.16,1,.3,1)}
    .rcpt-row{display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border:0;background:none;
      cursor:pointer;text-align:left;font-family:inherit}
    .rcpt-row.hi{background:var(--primary-soft)}
    .rcpt-ic{width:26px;height:26px;border-radius:7px;display:grid;place-items:center;flex-shrink:0;
      background:var(--surface-2);color:var(--muted)}
    .rcpt-txt{display:flex;flex-direction:column;min-width:0;line-height:1.35}
    .rcpt-txt b{font-size:12.5px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .rcpt-txt small{font-size:11.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .rcpt-count{margin-left:auto;font-size:10.5px;color:var(--faint);white-space:nowrap;flex-shrink:0}

    /* ---- pagination: a fixed-width control at any depth ---- */
    .pg-gap{padding:0 4px;color:var(--faint);font-size:12.5px;user-select:none}
    .pg-btns{flex-wrap:wrap}

    /* ---- connection / mailbox banner ---- */
    .fd-conn{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12.5px;padding:9px 14px;border-radius:10px;margin-bottom:14px}
    .fd-conn.ok{background:color-mix(in srgb, #10B981 8%, transparent);color:#047857}
    .fd-conn.warn{background:color-mix(in srgb, #F59E0B 10%, transparent);color:#B45309}
    .fd-conn.bad{background:color-mix(in srgb, #EF4444 9%, transparent);color:#B91C1C}
    .fd-conn .dot{width:8px;height:8px;border-radius:50%;background:currentColor;flex-shrink:0}
    .fd-conn .grow{margin-left:auto;display:flex;gap:8px;align-items:center}
    /* The live dot pulses only while genuinely connected -- a static dot on a
       dead connection is exactly the lie this banner exists to prevent. */
    .fd-conn.ok .dot{animation:fdPulse 2s ease-in-out infinite}
    @keyframes fdPulse{0%,100%{opacity:1}50%{opacity:.35}}

    .composer{border:1px solid color-mix(in srgb, var(--border) 80%, transparent);border-radius:18px;overflow:visible;background:var(--surface);position:relative;transition:box-shadow .2s,border-color .2s;width:100%;
      display:flex;flex-direction:column;
      max-height:min(calc(var(--convo-h, 62vh) - 72px), 62vh);min-height:260px}
    /* Forward is a short box, the way Gmail's is: the addresses and the send
       button are the whole point, and the quoted mail underneath is there to
       be glanced at, not read. Everything between them scrolls. */
    .composer.comp-short{max-height:min(calc(var(--convo-h, 46vh) - 72px), 46vh);min-height:300px}
    /* Everything that is not the writing area keeps its size, so the row of
       actions can never be pushed off the bottom by a long draft. Written as
       "everything, then the exception" rather than a list of class names: a
       row added to the header later would otherwise silently start shrinking. */
    .composer > *{flex:0 0 auto}
    .composer > .comp-scroll{flex:1 1 auto;min-height:0}
    .comp-scroll{overflow-y:auto;overscroll-behavior:contain}
    /* Bold, lists and links stay reachable while you scroll through a long
       draft. Sticky rather than pinned outside the scroller, so it keeps the
       editor's own top border and does not become a second toolbar. */
    .comp-scroll .rte-wrap > .rte{position:sticky;top:0;z-index:4;background:var(--surface);
      border-top:0;border-bottom:1px solid color-mix(in srgb, var(--border) 75%, transparent)}
    .comp-note .comp-scroll .rte-wrap > .rte{background:var(--warning-soft)}
    .composer:focus-within{border-color:color-mix(in srgb, var(--primary) 45%, var(--border));box-shadow:0 0 0 3px color-mix(in srgb, var(--primary) 10%, transparent),0 10px 30px -12px rgba(15,23,42,.12)}
    .comp-tabs{display:flex;gap:6px;padding:12px 16px;border-bottom:1px solid color-mix(in srgb, var(--border) 75%, transparent);flex-wrap:wrap}
    .comp-tabs button{display:inline-flex;align-items:center;gap:7px;border:0;background:transparent;padding:8px 13px;border-radius:9px;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;font-family:inherit;transition:all .15s}
    .comp-tabs button:hover{background:var(--hover)}
    .comp-tabs button.on{background:var(--primary-soft);color:var(--primary)}
    .comp-addr{display:flex;align-items:center;gap:10px;padding:12px 20px;border-bottom:1px solid color-mix(in srgb, var(--border) 70%, transparent);font-size:13px;flex-wrap:wrap}
    .comp-addr .lb{width:46px;color:var(--muted);font-weight:600;flex-shrink:0}
    .comp-addr input{flex:1;min-width:160px;border:0;outline:0;background:transparent;font-family:inherit;font-size:13px;color:var(--text);font-weight:600}
    .comp-addr .cc{margin-left:auto;display:flex;gap:12px}
    .comp-addr .cc button{border:0;background:transparent;color:var(--primary);font-weight:600;font-size:12.5px;cursor:pointer;font-family:inherit}
    .comp-area{position:relative;padding:18px 22px}
    /* The editor grows with the text and the middle scrolls; capping the editor
       itself is what made an earlier version of this impossible to type a long
       reply into. */
    .comp-scroll .comp-area .rte-body{max-height:none}
    .comp-area textarea{width:100%;min-height:420px;border:0;outline:0;resize:vertical;background:transparent;font-family:inherit;font-size:15.5px;line-height:1.75;color:var(--text)}
    .rte{display:flex;align-items:center;gap:4px;padding:10px 16px;border-top:1px solid color-mix(in srgb, var(--border) 75%, transparent);flex-wrap:wrap}
    .rte button svg{width:18px;height:18px}
    .rte button{width:32px;height:32px;border-radius:8px;border:0;background:transparent;color:var(--muted);display:grid;place-items:center;cursor:pointer;transition:all .15s}
    .rte button:hover{background:var(--hover);color:var(--primary)}
    .rte .div{width:1px;height:20px;background:var(--border);margin:0 5px}
    .comp-foot{display:flex;align-items:center;gap:10px;padding:13px 18px;border-top:1px solid color-mix(in srgb, var(--border) 75%, transparent);flex-wrap:wrap}
    .char-count{font-size:11.5px;color:var(--faint);font-weight:600}
    .saved{font-size:12.5px;color:var(--faint);font-weight:600}
    .hint{font-size:11.5px;color:var(--faint);display:inline-flex;align-items:center;gap:5px}
    .hint code{background:var(--surface-2);border:1px solid var(--border);border-radius:5px;padding:1px 5px;font-size:11px;font-weight:700;color:var(--primary)}
    /* canned response popup */
    .composer > .canned-pop{top:auto;bottom:58px}
    .canned-pop{position:absolute;z-index:50;left:16px;top:46px;width:400px;max-width:calc(100% - 32px);background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow-lg);overflow:hidden;animation:popm .16s cubic-bezier(.4,0,.2,1)}
    .canned-pop .cp-search{display:flex;align-items:center;gap:9px;padding:11px 14px;border-bottom:1px solid var(--border)}
    .canned-pop .cp-search input{flex:1;border:0;outline:0;background:transparent;font-family:inherit;font-size:13.5px;color:var(--text)}
    .canned-pop .cp-lab{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);padding:11px 14px 6px}
    .canned-pop .cp-list{max-height:260px;overflow-y:auto;padding-bottom:6px}
    .cp-item{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;cursor:pointer;transition:background .12s}
    .cp-item:hover,.cp-item.hi{background:var(--primary-soft)}
    .cp-item .cp-nm{font-size:13.5px;font-weight:600}
    .cp-item .cp-ct{font-size:11.5px;color:var(--muted);margin-top:2px}
    .cp-empty{padding:22px 14px;text-align:center;font-size:13px;color:var(--muted)}
    /* properties */
    .props{position:sticky;top:76px}
    .td-grid > .props > .card{border:0;border-radius:0;box-shadow:none;background:transparent}
    .td-grid > .props > .card + .card{border-top:1px solid var(--border)}
    .props-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--border)}
    .props-head h3{margin:0;font-size:19px;font-weight:800}
    .sla-row{display:flex;gap:11px;padding:13px 18px;border-bottom:1px solid var(--border);align-items:flex-start}
    .sla-row .si{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;flex-shrink:0}
    .sla-row .st{font-size:12.5px;font-weight:600;line-height:1.45}
    .sla-row .sd{font-size:12px;color:var(--muted);margin-top:2px}
    .props-body{padding:16px 18px;display:flex;flex-direction:column;gap:14px}
    .props-body .plab{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}
    .props-body select,.props-body input{width:100%;font-family:inherit;font-size:13px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 11px;cursor:pointer}
    .props-body select:focus,.props-body input:focus{outline:0;border-color:var(--primary)}
    .tagbox{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .tagbox .tg{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;padding:4px 9px;border-radius:8px;background:var(--primary-soft);color:var(--primary)}
    .tagbox .tg button{border:0;background:transparent;color:inherit;cursor:pointer;display:grid;place-items:center;padding:0}
    /* thread entry variants */
    /* 18px top AND bottom on every entry, plus a rule, put roughly a blank
       line between each message and the next. 13px reads as one conversation
       rather than a stack of unrelated cards. */
    .entry{display:flex;gap:12px;padding:13px 0;border-top:1px solid var(--border)}
    .note-card{flex:1;min-width:0;background:var(--warning-soft);border:1px solid color-mix(in srgb,var(--warning) 35%,transparent);border-radius:14px;padding:14px 16px}
    .note-tag{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:var(--warning);background:color-mix(in srgb,var(--warning) 18%,transparent);padding:3px 9px;border-radius:20px;margin-bottom:9px}
    .fwd-card{flex:1;min-width:0;background:var(--accent-soft);border:1px solid color-mix(in srgb,var(--accent) 32%,transparent);border-radius:14px;padding:14px 16px}
    .fwd-tag{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:var(--accent);background:color-mix(in srgb,var(--accent) 16%,transparent);padding:3px 9px;border-radius:20px;margin-bottom:9px}
    .quote{border-left:3px solid var(--border);padding:6px 0 6px 12px;margin-top:10px;font-size:12.5px;color:var(--muted);line-height:1.6;white-space:pre-wrap}
    .comp-note{background:var(--warning-soft)}
    .comp-note .comp-area textarea::placeholder{color:color-mix(in srgb,var(--warning) 75%,var(--muted))}
    .note-banner{display:flex;align-items:center;gap:8px;padding:10px 16px;font-size:12px;font-weight:600;color:var(--warning);background:color-mix(in srgb,var(--warning) 12%,transparent);border-bottom:1px solid color-mix(in srgb,var(--warning) 25%,transparent)}
    /* student profile panel */
    .who{display:flex;gap:13px;align-items:center;padding:18px;border-bottom:1px solid var(--border)}
    .who .wa{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;color:#fff;font-weight:700;font-size:17px;flex-shrink:0}
    .who .wn{font-size:15px;font-weight:800;line-height:1.3}
    .who .wm{font-size:12px;color:var(--muted);margin-top:3px}
    .info{padding:14px 18px;display:flex;flex-direction:column;gap:12px;border-bottom:1px solid var(--border)}
    .info-row{display:flex;gap:11px;align-items:flex-start;font-size:13px}
    .info-row .ii{width:28px;height:28px;border-radius:9px;background:var(--surface-2);color:var(--muted);display:grid;place-items:center;flex-shrink:0}

    /* ---- the properties column, one size down ----
       This is reference material read at a glance. At the conversation's type
       size it competed with the message and pushed the panel past the fold. */
    .cp-compact{font-size:12px}
    .who-btn{display:flex;align-items:center;gap:10px;width:100%;font-family:inherit;
      background:none;border:0;cursor:pointer;padding:12px 14px;text-align:left}
    .who-btn:hover{background:var(--hover)}
    .cp-compact .wa{width:34px;height:34px;font-size:12px;flex-shrink:0}
    .cp-compact .wn{display:block;font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .cp-compact .wm{display:block;font-size:11px;color:var(--muted);margin-top:1px}

    /* The ticket's own chips, moved here from above the conversation. */
    .cp-badges{display:flex;flex-wrap:wrap;gap:5px;padding:0 14px 12px;border-bottom:1px solid var(--border)}
    .cp-badges > *{font-size:10.5px !important}
    .cp-badges .sla{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-weight:600}
    .cp-badges .chip{padding:2px 8px;border-radius:20px}
    /* StudentTags brings its own block layout; inside the chip row it has to
       behave like one more chip group rather than a full-width section. */
    .cp-badges .stu-wrap{width:100%;margin:0}
    .cp-badges .stu-row{flex-wrap:wrap;gap:5px;margin:0}
    .cp-badges .stu-tag,.cp-badges .stu-edit{font-size:10.5px;padding:2px 8px}

    .cp-compact .info{padding:10px 14px}
    .cp-compact .info-row{gap:9px;padding:7px 0}
    .cp-compact .ii{width:26px;height:26px}
    .cp-compact .il{font-size:9.5px;letter-spacing:.05em}
    .cp-compact .iv{font-size:12px}
    .cp-compact .cp-stu,.cp-compact .cp-calls,.cp-compact .intern,.cp-compact .noreg{padding:11px 14px}
    .cp-compact .cp-stu-row,.cp-compact .kv{font-size:11.5px;padding:4px 0}
    .cp-compact .noreg p{font-size:11.5px}
    .cp-compact .intern-head .t{font-size:11.5px}

    .info-row .il{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
    .info-row .iv{font-weight:600;margin-top:2px;word-break:break-word}
    .info-row a.iv{color:var(--primary);text-decoration:none}
    .info-row a.iv:hover{text-decoration:underline}
    .intern{padding:14px 18px;border-bottom:1px solid var(--border)}
    .intern-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
    .intern-head .t{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);display:inline-flex;align-items:center;gap:6px}
    .kv{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;padding:6px 0}
    .kv .k{color:var(--muted)}
    .kv .v{font-weight:600;text-align:right}
    .prog{margin-top:10px}
    .prog .pl{display:flex;justify-content:space-between;font-size:11.5px;font-weight:600;margin-bottom:6px}
    .prog .pb{height:7px;border-radius:6px;background:var(--surface-2);overflow:hidden}
    .prog .pb>i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,var(--primary),var(--accent));transition:width 1s cubic-bezier(.4,0,.2,1)}
    .noreg{padding:20px 18px;text-align:center;border-bottom:1px solid var(--border)}
    .noreg p{margin:8px 0 12px;font-size:12.5px;color:var(--muted);line-height:1.5}
    /* ---- dashboard interactions ---- */
    .dd-wrap{position:relative}
    .menu{position:absolute;z-index:200;background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow-lg);padding:6px;animation:popm .16s cubic-bezier(.4,0,.2,1)}
    .menu.right{right:0}.menu.left{left:0}
    .menu-top{top:calc(100% + 8px)}
    .menu button.mi{display:flex;width:100%;align-items:center;gap:11px;padding:10px 12px;border:0;background:transparent;border-radius:10px;font-size:13.5px;color:var(--text);cursor:pointer;font-family:inherit;text-align:left;font-weight:500}
    .menu button.mi:hover{background:var(--hover)}
    .menu .mi .mic{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;flex-shrink:0}
    .menu .mi small{display:block;font-size:11.5px;color:var(--muted);font-weight:400;margin-top:1px}
    .search-wrap{position:relative;flex:1;max-width:440px}
    .sr-busy{display:flex;align-items:center;gap:9px;padding:18px 16px;font-size:12.5px;color:var(--muted)}
    .search-results{position:absolute;top:calc(100% + 8px);left:0;right:0;z-index:55;background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow-lg);overflow:hidden;animation:popm .16s cubic-bezier(.4,0,.2,1);max-height:420px;overflow-y:auto}
    .sr-lab{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);padding:12px 14px 6px}
    .sresult{display:flex;align-items:center;gap:12px;padding:10px 14px;cursor:pointer;transition:background .12s}
    .sresult:hover,.sresult.hi{background:var(--primary-soft)}
    .sresult .sa{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:#fff;font-weight:700;font-size:12px;flex-shrink:0}
    .sresult .snm{font-size:13.5px;font-weight:600}
    .sresult .smeta{font-size:11.5px;color:var(--muted);margin-top:2px;display:flex;gap:8px;flex-wrap:wrap}
    .notif-panel{position:absolute;top:calc(100% + 10px);right:0;z-index:55;width:390px;max-width:92vw;background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-lg);overflow:hidden;animation:popm .16s cubic-bezier(.4,0,.2,1)}
    .np-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border)}
    .np-head h4{margin:0;font-size:15px;font-weight:800;display:flex;align-items:center;gap:8px}
    .np-head .unread-count{font-size:11px;font-weight:700;color:#fff;background:var(--danger);padding:1px 8px;border-radius:20px}
    .np-body{max-height:400px;overflow-y:auto}
    .np-foot{display:flex;padding:10px 12px;border-top:1px solid var(--border);gap:8px}
    .notif-item{display:flex;gap:12px;padding:13px 16px;border-bottom:1px solid var(--border);position:relative;transition:background .12s}
    .notif-item:hover{background:var(--hover)}.notif-item:last-child{border-bottom:0}
    .notif-item.unread{background:color-mix(in srgb,var(--primary) 5%,transparent)}
    .notif-item .ni{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;flex-shrink:0}
    .notif-item .nt{font-size:13px;font-weight:700}
    .notif-item .nd{font-size:12px;color:var(--muted);margin:2px 0 4px;line-height:1.45}
    .notif-item .nw{font-size:11px;color:var(--faint)}
    .notif-item .ndel{opacity:0;position:absolute;top:10px;right:12px;width:26px;height:26px;border-radius:7px;border:1px solid var(--border);background:var(--surface);color:var(--muted);display:grid;place-items:center;cursor:pointer;transition:all .15s}
    .notif-item:hover .ndel{opacity:1}.notif-item .ndel:hover{color:var(--danger);border-color:var(--danger)}
    .unread-dot{position:absolute;top:16px;right:14px;width:8px;height:8px;border-radius:50%;background:var(--primary)}
    .act-item{display:flex;gap:13px;padding:14px 0;border-bottom:1px solid var(--border)}
    .act-item:last-child{border-bottom:0}
    .act-item .ai{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;flex-shrink:0}
    .act-item .at{font-size:13px;font-weight:600;line-height:1.4}
    .act-item .at b{font-weight:700}
    .act-item .am{font-size:11.5px;color:var(--muted);margin-top:3px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .dropzone{border:1.5px dashed var(--border);border-radius:12px;padding:18px;text-align:center;color:var(--muted);font-size:12.5px;cursor:pointer;transition:all .15s}
    .dropzone:hover{border-color:var(--primary);color:var(--primary);background:var(--primary-soft)}
    .file-pill{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;padding:4px 9px;border-radius:8px;background:var(--surface-2);margin:6px 6px 0 0}
    .file-pill button{border:0;background:transparent;color:var(--muted);cursor:pointer;display:grid;place-items:center;padding:0}
    .modal-wide{width:960px}
    .stat.clickable{cursor:pointer}
    .stat.clickable:active{transform:translateY(-1px)}
    .an-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
    @media(max-width:800px){.an-kpis{grid-template-columns:repeat(2,1fr)}}
    .an-kpi{background:var(--surface-2);border-radius:13px;padding:14px}
    .an-kpi .v{font-size:22px;font-weight:800;letter-spacing:-.02em}
    .an-kpi .l{font-size:11.5px;color:var(--muted);font-weight:500;margin-top:2px}
    .an-charts{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
    @media(max-width:800px){.an-charts{grid-template-columns:1fr}}
    .prog-line{margin:12px 0}
    .prog-line .pl{display:flex;justify-content:space-between;font-size:12.5px;font-weight:600;margin-bottom:6px}
    .prog-line .pb{height:8px;border-radius:6px;background:var(--surface-2);overflow:hidden}
    .prog-line .pb>i{display:block;height:100%;border-radius:6px;transition:width 1s cubic-bezier(.4,0,.2,1)}
    .toast-host{position:fixed;right:20px;bottom:20px;z-index:90;display:flex;flex-direction:column;gap:10px;max-width:calc(100vw - 40px)}
    .toast{display:flex;align-items:flex-start;gap:11px;min-width:280px;max-width:380px;background:var(--surface);border:1px solid var(--border);border-left-width:4px;border-radius:12px;box-shadow:var(--shadow-lg);padding:13px 15px;animation:toastIn .28s cubic-bezier(.4,0,.2,1)}
    @keyframes toastIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}
    .toast .tc{flex-shrink:0;margin-top:1px}
    .toast .tt{font-size:13px;font-weight:700}
    .toast .td{font-size:12px;color:var(--muted);margin-top:2px;line-height:1.45}
    .toast .tx{margin-left:auto;border:0;background:transparent;color:var(--faint);cursor:pointer;padding:0;display:grid;place-items:center}
    .spin{animation:spin 1s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .empty{display:flex;flex-direction:column;align-items:center;text-align:center;padding:40px 20px;color:var(--muted)}
    .empty .eic{width:56px;height:56px;border-radius:16px;background:var(--surface-2);display:grid;place-items:center;color:var(--faint);margin-bottom:14px}
    .empty h4{margin:0 0 4px;font-size:15px;font-weight:700;color:var(--text)}
    .empty p{margin:0 0 14px;font-size:13px;max-width:280px}
    /* ---- customers ---- */
    .cust-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:16px}
    .ccard{padding:18px;display:flex;flex-direction:column;gap:14px;animation:fadeUp .5s cubic-bezier(.4,0,.2,1) both}
    .ccard:hover{transform:translateY(-4px);box-shadow:var(--shadow-lg)}
    .ccard-top{display:flex;gap:13px;align-items:center}
    .ccard .cav{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;color:#fff;font-weight:700;font-size:17px;flex-shrink:0}
    .ccard .nm{font-size:15px;font-weight:800;line-height:1.25;cursor:pointer}
    .ccard .nm:hover{color:var(--primary)}
    .ccard .cid{font-size:11.5px;color:var(--muted);font-weight:600;margin-top:2px}
    .cmini{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center}
    .cmini .b{background:var(--surface-2);border-radius:11px;padding:9px 6px}
    .cmini .v{font-size:17px;font-weight:800;line-height:1}
    .cmini .l{font-size:10px;color:var(--muted);font-weight:600;margin-top:3px}
    .ccard-info{display:flex;flex-direction:column;gap:7px;font-size:12.5px}
    .ccard-info .r{display:flex;align-items:center;gap:9px;color:var(--muted);min-width:0}
    .ccard-info .r span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .cprof-head{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
    .cprof-head .pav{width:64px;height:64px;border-radius:18px;display:grid;place-items:center;color:#fff;font-weight:700;font-size:23px;flex-shrink:0}
    .cprof-head h1{margin:0;font-size:23px;font-weight:800;letter-spacing:-.02em;display:flex;align-items:center;gap:9px}
    .cprof-meta{display:flex;gap:8px 18px;flex-wrap:wrap;margin-top:8px;font-size:12.5px;color:var(--muted)}
    .cprof-meta .m{display:inline-flex;align-items:center;gap:6px}
    /* ---- theme manager ---- */
    .theme-drawer{width:420px}
    .tm-sec{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);margin:4px 0 2px}
    .preset-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
    .preset{display:flex;align-items:center;gap:9px;padding:9px 11px;border:1px solid var(--border);border-radius:11px;background:var(--surface);cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:600;color:var(--text);transition:all .15s;text-align:left}
    .preset:hover{border-color:var(--primary)}
    .preset.on{border-color:var(--primary);background:var(--primary-soft)}
    .preset .sw{display:flex;flex-shrink:0}
    .preset .sw i{width:13px;height:13px;border-radius:4px;margin-left:-4px;border:1.5px solid var(--surface)}
    .preset .sw i:first-child{margin-left:0}
    .swatch-row{display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid var(--border)}
    .swatch-row .chip-color{width:38px;height:38px;border-radius:10px;border:1px solid var(--border);flex-shrink:0;position:relative;overflow:hidden;cursor:pointer}
    .swatch-row .chip-color input[type=color]{position:absolute;inset:-6px;width:150%;height:150%;border:0;padding:0;cursor:pointer}
    .swatch-row .lab{font-size:12.5px;font-weight:600}
    .swatch-row .rgb{font-size:10.5px;color:var(--faint);margin-top:1px;font-variant-numeric:tabular-nums}
    .swatch-row .hex{width:92px;font-family:inherit;font-size:12px;font-weight:600;color:var(--text);background:var(--surface-2);border:1px solid transparent;border-radius:8px;padding:7px 9px;text-transform:uppercase}
    .swatch-row .hex:focus{outline:0;border-color:var(--primary);background:var(--surface)}
    .tm-preview{border:1px solid var(--border);border-radius:14px;overflow:hidden;background:var(--bg)}
    .tm-pv-nav{display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--surface);border-bottom:1px solid var(--border)}
    .tm-pv-body{display:flex;gap:10px;padding:12px}
    .tm-pv-side{width:64px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:6px}
    .tm-pv-side i{height:8px;border-radius:4px;background:var(--surface-2)}
    .tm-pv-side i.a{background:var(--primary-soft)}
    .tm-pv-main{flex:1;display:flex;flex-direction:column;gap:9px}
    .tm-pv-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px}
    .tm-pv-bar{height:7px;border-radius:5px;background:var(--surface-2);overflow:hidden;margin-top:8px}
    .tm-pv-bar>i{display:block;height:100%;width:62%;background:linear-gradient(90deg,var(--primary),var(--accent))}
    /* ---- compact ticket cards + hover preview ---- */
    /* A slim row is now two columns: everything readable on the left, the three
       inline controls stacked on the right, so they line up down the list. */
    .tcard.slim{padding:10px 14px;gap:11px;flex-direction:row;align-items:center}
    .tcard.slim::before{width:3px}
    .tcard.slim.peek{border-color:color-mix(in srgb,var(--primary) 45%,var(--border))}
    .slim-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
    .slim-ctl{display:flex;flex-direction:column;gap:5px;flex-shrink:0;align-items:stretch}
    /* Hover targets for the preview card. */
    .peekable{cursor:pointer;border-radius:5px;transition:color .14s,background .14s}
    .peekable:hover{color:var(--primary);background:var(--primary-soft)}
    .slim-id.peekable:hover{padding:0 3px;margin:0 -3px}

    /* ---- inline row dropdowns ---- */
    .rsel{position:relative}
    .rsel-btn{display:flex;align-items:center;gap:6px;width:100%;font-family:inherit;font-size:11.5px;font-weight:600;
      color:var(--muted);background:transparent;border:1px solid transparent;border-radius:7px;padding:3px 7px;cursor:pointer;
      transition:background .14s,border-color .14s,color .14s}
    .rsel-btn:hover{background:var(--hover);border-color:var(--border);color:var(--text)}
    .rsel-btn:disabled{opacity:.6;cursor:default}
    .rsel.open .rsel-btn{background:var(--surface-2);border-color:var(--primary);color:var(--text)}
    .rsel-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
    .rsel-lab{flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .rsel-caret{flex-shrink:0;opacity:.6;transition:transform .16s}
    .rsel.open .rsel-caret{transform:rotate(180deg)}
    .rsel-menu.fixed{position:fixed;top:auto;right:auto;z-index:1400}
    .rsel-menu{position:absolute;top:calc(100% + 4px);right:0;z-index:60;background:var(--surface);
      border:1px solid var(--border);border-radius:10px;box-shadow:0 14px 34px rgba(0,0,0,.2);padding:4px;
      max-height:230px;overflow-y:auto;
      /* Without this, reaching the end of the agent list chains the scroll to
         the page -- the page moves, and the menu closes itself out from under
         the pointer. Contain stops the chain at the menu's own edge. */
      overscroll-behavior:contain;
      animation:rselIn .12s cubic-bezier(.22,1,.36,1)}
    .rsel-menu.up{top:auto;bottom:calc(100% + 4px)}
    @keyframes rselIn{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}
    .rsel-opt{display:flex;align-items:center;gap:8px;width:100%;font-family:inherit;font-size:12px;color:var(--text);
      background:none;border:0;border-radius:7px;padding:7px 9px;cursor:pointer;text-align:left}
    .rsel-opt:hover{background:var(--hover)}
    .rsel-opt.on{color:var(--primary);font-weight:600;background:var(--primary-soft)}
    .rsel-tick{flex-shrink:0}
    .rsel-empty{padding:12px;font-size:11.5px;color:var(--muted);text-align:center}
    .slim-row{display:flex;align-items:baseline;gap:8px;min-width:0}
    .slim-av{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;color:#fff;font-weight:700;font-size:11px;flex-shrink:0}
    .slim-id{font-size:11.5px;font-weight:600;color:var(--faint);flex-shrink:0}
    /* Bold, and the only bold thing on the row -- it is what you are scanning
       for. The requester is light: it matters after you have found the ticket. */
    .slim-subj{font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;
      text-overflow:ellipsis;flex:0 1 auto;min-width:0;cursor:pointer;line-height:1.4}
    .slim-subj:hover{color:var(--primary)}
    .slim-who{display:inline-flex;align-items:center;gap:5px;font-weight:400;color:var(--muted);
      cursor:pointer;border-radius:5px;padding:0 3px;margin:0 -3px;
      max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      transition:color .13s,background .13s}
    .slim-who:hover{color:var(--primary);background:var(--primary-soft)}
    .slim-meta{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--muted);flex-wrap:wrap}
    .slim-meta .sm{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
    .badge-xs{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;line-height:1.4;white-space:nowrap}
    .replied{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--accent-soft);color:var(--accent);white-space:nowrap}
    .replied .rd{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:pulse 1.8s ease-in-out infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
    .newct{font-size:10px;font-weight:800;color:#166534;background:#DCFCE7;border-radius:20px;padding:1px 8px;white-space:nowrap}

    .hp{position:fixed;z-index:80;width:430px;max-width:calc(100vw - 24px);background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-lg);overflow:hidden;animation:hpIn .14s cubic-bezier(.22,1,.36,1);pointer-events:auto}
    /* ---- bulk actions ---- */
    /* Sticky: tick a box halfway down a long list and the actions have to still
       be on screen. Wraps rather than hiding buttons at narrow widths. */
    .bulkbar{position:sticky;top:8px;z-index:35;display:flex;align-items:center;gap:8px;flex-wrap:wrap;
      padding:11px 14px;margin-bottom:14px;border-radius:14px;
      background:color-mix(in srgb,var(--primary-soft) 92%, var(--surface));
      border:1px solid color-mix(in srgb,var(--primary) 30%,transparent);
      box-shadow:0 6px 20px -10px rgba(16,24,40,.28);
      backdrop-filter:blur(6px);
      animation:slideDown .24s cubic-bezier(.4,0,.2,1)}
    @keyframes slideDown{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:none}}
    .bulkbar .selcount{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:800;color:var(--primary);padding-right:6px;white-space:nowrap}
    .bulkbar .bdiv{width:1px;height:22px;background:color-mix(in srgb,var(--primary) 28%,transparent)}
    .bbtn{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:9px;border:1px solid var(--border);
      background:var(--surface);color:var(--text);font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap}
    .bbtn:hover:not(:disabled){border-color:var(--primary);color:var(--primary);transform:translateY(-1px)}
    .bbtn:disabled{opacity:.45;cursor:not-allowed}
    .bbtn.danger:hover:not(:disabled){border-color:var(--danger);color:var(--danger);background:var(--danger-soft)}
    .selbox{width:17px;height:17px;border-radius:5px;border:1.5px solid var(--border);background:var(--surface);display:grid;place-items:center;
      cursor:pointer;flex-shrink:0;transition:all .15s;padding:0}
    .selbox:hover{border-color:var(--primary)}
    .selbox.on{background:var(--primary);border-color:var(--primary);color:#fff}
    .selall{display:flex;align-items:center;gap:10px;padding:9px 14px;margin-bottom:10px;border-radius:11px;background:var(--surface);
      border:1px solid var(--border);font-size:12px;font-weight:600;color:var(--muted)}
    /* Gmail's rule: what you have dealt with recedes, what you have not stays
       loud. Unread carries the weight and a full-strength surface; read drops to
       the page colour and normal weight. */
    /* Unread: white, bold, a solid border and its priority bar at full strength. */
    .tcard.slim.unread{background:var(--surface);border-color:var(--border)}
    .tcard.slim.unread .slim-subj{font-weight:700;color:var(--text)}
    .tcard.slim.unread .slim-who{color:var(--text)}

    /* Read: on the page colour, so the row stops being a card and recedes into
       the background the way a read mail does. */
    .tcard.slim.read{background:var(--bg);border-color:transparent;box-shadow:none}
    .tcard.slim.read .slim-subj{font-weight:400;color:var(--muted)}
    .tcard.slim.read .slim-who{color:var(--faint)}
    .tcard.slim.read .slim-meta{color:var(--faint)}
    .tcard.slim.read .slim-av{opacity:.5;filter:saturate(.55)}
    .tcard.slim.read .slim-id{opacity:.6}
    .tcard.slim.read::before{opacity:.22}
    .tcard.slim.read .badge-xs,.tcard.slim.read .rsel-btn{opacity:.72}
    /* Hovering lifts it back to full strength so it is still readable. */
    .tcard.slim.read:hover{background:var(--surface);border-color:var(--border)}
    .tcard.slim.read:hover .slim-subj{color:var(--text)}
    .tcard.slim.read:hover .slim-av{opacity:1;filter:none}
    .tcard.slim.read:hover .badge-xs,.tcard.slim.read:hover .rsel-btn{opacity:1}

    /* ---- the two row tags ---- */
    .tag-read{flex-shrink:0;font-size:9.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
      color:var(--faint);background:var(--surface-2);border-radius:4px;padding:1px 5px;line-height:15px}
    .tag-undeliv{flex-shrink:0;font-size:9.5px;font-weight:700;letter-spacing:.03em;
      color:var(--danger);background:var(--danger-soft);border-radius:4px;padding:1px 6px;line-height:15px}
    .read-by{color:var(--faint)}

    /* The requester card, hung off the name on a row. */
    .chc{position:fixed;z-index:1400;background:var(--surface);border:1px solid var(--border);
      border-radius:12px;box-shadow:0 16px 40px rgba(0,0,0,.18);overflow:hidden;
      animation:rselIn .12s cubic-bezier(.22,1,.36,1)}
    .chc-top{display:flex;align-items:center;gap:11px;padding:13px 14px}
    .chc-av{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;color:#fff;
      font-weight:700;font-size:13px;flex-shrink:0}
    .chc-name{font-size:14px;font-weight:700;line-height:1.3;overflow:hidden;
      text-overflow:ellipsis;white-space:nowrap}
    .chc-link{font-family:inherit;font-size:12.5px;font-weight:500;color:var(--primary);
      background:none;border:0;padding:2px 0 0;cursor:pointer}
    .chc-link:hover{text-decoration:underline}
    .chc-mail{display:flex;align-items:center;gap:9px;padding:10px 14px;font-size:12.5px;
      color:var(--muted);background:var(--surface-2);border-top:1px solid var(--border);
      text-decoration:none;overflow:hidden}
    .chc-mail span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .chc-mail:hover{color:var(--primary)}

    .tcard.sel{background:var(--primary-soft);border-color:color-mix(in srgb,var(--primary) 35%,transparent)}
    .tcard.sel::before{width:5px;background:var(--primary)}
    tr.sel td{background:var(--primary-soft)}
    /* The old rules here hid Merge / Spam / Trash / tags below 1100px, which
       the 250px workspace rail makes an ordinary laptop width -- so the actions
       vanished exactly when the window got a little smaller. Everything now
       wraps onto another line instead, and the secondary actions live in the
       More menu regardless of width. */
    @media(max-width:700px){.bulkbar{gap:6px;padding:9px 10px}.bulkbar .bbtn{padding:0 9px;font-size:11px}}
    /* ---- bulk update drawer ---- */
    .bu-drawer{width:460px}
    .bu-row{padding:14px 0;border-bottom:1px solid var(--border)}
    .bu-head{display:flex;align-items:center;gap:10px}
    .bu-head label{font-size:12px;font-weight:600;color:var(--text);cursor:pointer;user-select:none}
    .bu-body{margin-top:9px;padding-left:27px}
    .bu-body.off{opacity:.4;pointer-events:none}
    .bu-from{display:flex;align-items:center;gap:10px;font-size:12.5px;padding:10px 0}
    .bu-from .v{font-weight:700}
    .bu-editor{border:1px solid var(--border);border-radius:11px;overflow:hidden;background:var(--surface)}
    .bu-editor textarea{width:100%;min-height:120px;border:0;outline:0;resize:vertical;padding:12px;font-family:inherit;font-size:13px;line-height:1.6;color:var(--text);background:transparent}
    .bu-editor .rte{border-top:1px solid var(--border);border-bottom:0;background:var(--surface-2);padding:7px 9px}
    .bu-editor .rte button{width:28px;height:28px}
    .cbx{width:16px;height:16px;border-radius:4px;border:1.5px solid var(--border);background:var(--surface);display:grid;place-items:center;cursor:pointer;flex-shrink:0;padding:0;transition:all .15s}
    .cbx:hover{border-color:var(--primary)}
    .cbx.on{background:var(--primary);border-color:var(--primary);color:#fff}
    .hp.compact{width:390px}
    .hp-close{position:absolute;top:7px;right:7px;z-index:5;width:24px;height:24px;border-radius:7px;border:1px solid var(--border);
      background:var(--surface);color:var(--muted);display:grid;place-items:center;cursor:pointer;transition:all .15s;padding:0}
    .hp-close:hover{color:var(--danger);border-color:var(--danger);background:var(--danger-soft)}
    .hp-top{display:flex;align-items:flex-start;gap:8px;padding:13px 14px 0}
    .hp-subj{flex:1;min-width:0;font-size:13.5px;font-weight:700;line-height:1.4;
      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .hp-sub{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 14px 11px;
      font-size:11px;color:var(--muted);border-bottom:1px solid var(--border)}
    .hp-id{font-weight:700;color:var(--primary)}
    .hp-new{display:inline-flex;align-items:center;gap:5px;font-weight:700;color:var(--accent)}
    .hp-when{margin-left:auto;color:var(--faint);white-space:nowrap}
    .hp-msg{padding:12px 14px;max-height:170px;overflow-y:auto}
    .hp-who{font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--faint);margin-bottom:6px}
    .hp-text{font-size:12.5px;line-height:1.6;color:var(--text);white-space:pre-wrap;overflow-wrap:anywhere}
    .hp-text.hp-dim{color:var(--muted)}
    .hp-more{display:inline-flex;align-items:center;gap:5px;margin-top:8px;font-size:11px;color:var(--faint)}
    .hp-foot{display:flex;gap:7px;padding:10px 14px;border-top:1px solid var(--border);background:var(--surface-2)}
    .hp-a{display:inline-flex;align-items:center;gap:6px;font-family:inherit;font-size:12px;font-weight:600;
      color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 11px;cursor:pointer;
      transition:background .14s,border-color .14s,color .14s}
    .hp-a:hover{border-color:var(--primary);color:var(--primary)}
    .hp-a.primary{background:var(--primary);border-color:var(--primary);color:#fff}
    .hp-a.primary:hover{filter:brightness(1.06);color:#fff}
    .hp-a.ghost{margin-left:auto;background:none;border-color:transparent;color:var(--primary)}

    .hp-sum{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:10px 30px 10px 12px;background:var(--surface-2);border-bottom:1px solid var(--border)}
    .hp-sum .c{text-align:center;min-width:0}
    .hp-sum .c .v{font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .hp-sum .c .l{font-size:9px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--faint);margin-top:2px}
    .hp-open{display:block;width:100%;text-align:center;padding:9px;border:0;border-top:1px solid var(--border);background:var(--surface);color:var(--primary);font-family:inherit;font-size:11.5px;font-weight:700;cursor:pointer}
    .hp-open:hover{background:var(--primary-soft)}
    .newrep{display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:800;padding:2px 7px;border-radius:20px;background:var(--danger);color:#fff;text-transform:uppercase;letter-spacing:.03em}
    .view-btn{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;flex-shrink:0}
    .view-btn:hover,.view-btn.on{color:var(--primary);border-color:var(--primary);background:var(--primary-soft)}
    @keyframes hpIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
    .hp-head{padding:13px 15px;border-bottom:1px solid var(--border);display:flex;gap:11px;align-items:flex-start}
    .hp-head .ha{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0}
    .hp-nm{font-size:13.5px;font-weight:800}
    .hp-ct{font-size:11px;color:var(--muted);margin-top:2px;display:flex;flex-direction:column;gap:1px}
    .hp-body{padding:12px 15px;display:flex;flex-direction:column;gap:10px;max-height:340px;overflow-y:auto}
    .hp-subj{font-size:13.5px;font-weight:700;line-height:1.4}
    .hp-desc{font-size:11.5px;color:var(--muted);line-height:1.6;max-height:56px;overflow:hidden;position:relative}
    .hp-kv{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px}
    .hp-kv .r{display:flex;justify-content:space-between;gap:8px;font-size:11px}
    .hp-kv .r .k{color:var(--faint);font-weight:600}
    .hp-kv .r .v{font-weight:700;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .hp-sec{font-size:9.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}
    .chat{display:flex;flex-direction:column;gap:7px}
    .bub{max-width:86%;padding:8px 11px;border-radius:12px;font-size:11.5px;line-height:1.5}
    .bub.agent{align-self:flex-start;background:var(--surface-2);border-bottom-left-radius:4px}
    .bub.cust{align-self:flex-end;background:var(--primary-soft);color:var(--primary);border-bottom-right-radius:4px;border:1px solid color-mix(in srgb,var(--primary) 22%,transparent)}
    .bub .who{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;opacity:.75;margin-bottom:3px;display:flex;align-items:center;gap:5px}
    .bub .tm{font-size:9.5px;opacity:.6;margin-top:4px;display:flex;align-items:center;gap:5px}
    .hp-foot{display:flex;gap:5px;padding:10px 12px;border-top:1px solid var(--border);flex-wrap:wrap;background:var(--surface-2)}
    .hp-foot button{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 9px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit}
    .attn{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;color:var(--muted);background:var(--surface-2);border-radius:7px;padding:3px 8px}
    @media(max-width:900px){.hp{display:none}}
    /* ---- collapsible sidebar ---- */
    .sidebar{transition:width .26s cubic-bezier(.4,0,.2,1),transform .28s cubic-bezier(.4,0,.2,1)}
    .sidebar.collapsed{width:52px}
    /* The shell is the positioning context for the floating rail. */
    .shell{position:relative}
    /* A dropdown opened from the rail must clear the rail itself. */
    .sidebar .dd-wrap{position:relative;z-index:80}
    .sidebar .menu{z-index:90}
    .sidebar.collapsed .brand .btxt,
    .sidebar.collapsed .nav-label,
    .sidebar.collapsed .nav-item .lbl,
    .sidebar.collapsed .nav-item .badge,
    .sidebar.collapsed .side-card{display:none}
    .sidebar.collapsed .brand{justify-content:center;padding:20px 0 18px}
    .sidebar.collapsed .nav{padding:6px 10px}
    .sidebar.collapsed .nav-item{justify-content:center;padding:11px 0}
    .sidebar.collapsed .nav-item:hover{transform:none}
    .sidebar.collapsed .nav-item.active::before{right:-10px}
    .sidebar.collapsed .side-foot{padding:10px}
    .sidebar.collapsed .collapse-btn{justify-content:center}
    .sidebar.collapsed .collapse-btn .lbl{display:none}
    /* Rail sits on the right, so the flyout label points inward (leftwards). */
    .sidebar.collapsed .nav-item,
    .sidebar.collapsed .rail-new,
    .sidebar.collapsed .collapse-btn{position:relative}
    .sidebar.collapsed .rail-new::after,
    .sidebar.collapsed .collapse-btn::after,
    .sidebar.collapsed .nav-item::after{content:attr(data-label);position:absolute;right:calc(100% + 10px);top:50%;transform:translateY(-50%) scale(.96);
      background:var(--text);color:var(--surface);font-size:11.5px;font-weight:700;padding:5px 9px;border-radius:7px;white-space:nowrap;
      opacity:0;pointer-events:none;transition:opacity .14s,transform .14s;z-index:70;box-shadow:var(--shadow)}
    .sidebar.collapsed .nav-item:hover::after,
    .sidebar.collapsed .rail-new:hover::after,
    .sidebar.collapsed .collapse-btn:hover::after{opacity:1;transform:translateY(-50%) scale(1)}

    /* At 52px every control is an icon, so the rail must never need scrolling
       to reach its own foot. */
    .sidebar.collapsed .rail-actions{padding:10px 8px 8px;gap:7px}
    .sidebar.collapsed .nav{gap:2px}

    /* ----------------------------------------------------------------------
       WHAT THE 52px STRIP SHOWS

       Only things that still mean something at icon size. The connection pill
       is a coloured block with its text removed -- an amber rectangle that
       looks like a rendering fault -- so it becomes a dot on the account
       avatar's corner instead. */
    .sidebar.collapsed .fd-conn{display:none}
    .sidebar.collapsed .rail-account{justify-content:center;padding:8px 0;background:none}
    .sidebar.collapsed .rail-account .lbl{display:none}
    .sidebar.collapsed .side-foot{padding:10px 8px 26px;gap:8px;display:flex;
      flex-direction:column;align-items:stretch}

    /* Under 960px the rail is off-canvas and opened by the burger; the plain
       media rule near the top of this file handles it and there is no longer a
       float here to switch off. */
    .collapse-btn{display:flex;align-items:center;gap:10px;width:100%;padding:9px 11px;margin-top:8px;border-radius:11px;border:1px solid var(--border);
      background:var(--surface);color:var(--muted);font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .16s}
    .collapse-btn:hover{border-color:var(--primary);color:var(--primary)}
    @media(max-width:960px){.hide-sm{display:none}}
    /* ---- settings ---- */
    /* ---- canned response manager (Settings) ---- */
    .cr-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
    .cr-split{display:grid;grid-template-columns:236px minmax(0,1fr);gap:16px;align-items:start}
    @media(max-width:900px){.cr-split{grid-template-columns:1fr}}
    .cr-lab{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
      color:var(--faint);padding:2px 4px 8px}
    .cr-folders{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:10px}
    .cr-folder{display:flex;align-items:center;gap:9px;width:100%;font-family:inherit;font-size:12.5px;
      color:var(--text);background:none;border:0;border-radius:9px;padding:8px 10px;cursor:pointer;text-align:left}
    .cr-folder:hover{background:var(--hover)}
    .cr-folder.on{background:var(--primary-soft);color:var(--primary);font-weight:600}
    .cr-folder .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .cr-folder .ct{font-size:10.5px;color:var(--faint)}
    .cr-folder.on .ct{color:var(--primary)}
    .cr-none{padding:16px;font-size:12px;color:var(--muted);display:flex;align-items:center;gap:8px}

    .cr-list{display:flex;flex-direction:column;gap:9px;min-width:0}
    .cr-row{display:flex;align-items:center;gap:14px;background:var(--surface);border:1px solid var(--border);
      border-radius:12px;padding:12px 14px;cursor:pointer;transition:border-color .14s,background .14s}
    .cr-row:hover{border-color:var(--primary)}
    .cr-row-main{flex:1;min-width:0}
    .cr-nm{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600}
    .cr-off{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;
      color:var(--muted);background:var(--surface-2);border-radius:4px;padding:1px 6px}
    .cr-body{font-size:11.5px;color:var(--faint);line-height:1.5;margin-top:3px;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .cr-row-meta{display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0}
    .cr-code{font-size:10.5px;color:var(--primary);background:var(--primary-soft);border-radius:4px;padding:1px 6px}
    .cr-dash{font-size:11px;color:var(--faint)}
    .cr-uses{font-size:10.5px;color:var(--faint)}
    .cr-facts{display:flex;gap:4px;flex-shrink:0}
    .cr-facts button{width:26px;height:26px;display:grid;place-items:center;border:1px solid transparent;
      border-radius:7px;background:none;color:var(--faint);cursor:pointer}
    .cr-facts button:hover{border-color:var(--border);color:var(--text);background:var(--surface-2)}
    .cr-facts button:last-child:hover{color:var(--danger);border-color:var(--danger)}
    .cr-editor{border:1px solid var(--border);border-radius:12px;overflow:hidden}

    .set-layout{display:grid;grid-template-columns:240px 1fr;gap:18px;align-items:start}
    @media(max-width:1000px){.set-layout{grid-template-columns:1fr}}
    .set-nav{position:sticky;top:86px;padding:10px;display:flex;flex-direction:column;gap:2px;max-height:calc(100vh - 110px);overflow-y:auto}
    .set-nav button{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:10px;border:0;background:transparent;color:var(--muted);font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;text-align:left;transition:all .15s;width:100%}
    .set-nav button:hover{background:var(--hover);color:var(--text)}
    .set-nav button.on{background:var(--primary-soft);color:var(--primary)}
    .set-sec{display:flex;flex-direction:column;gap:14px}
    .set-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    @media(max-width:760px){.set-grid2{grid-template-columns:1fr}}
    .set-row{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--border)}
    .set-row:last-child{border-bottom:0}
    .set-row .ti{font-size:13px;font-weight:600}
    .set-row .td{font-size:11.5px;color:var(--muted);margin-top:2px}
    .savebar{display:flex;gap:8px;justify-content:flex-end;padding-top:14px;border-top:1px solid var(--border);margin-top:4px}
    .perm-table th,.perm-table td{text-align:center}
    .perm-table th:first-child,.perm-table td:first-child{text-align:left}
    .keychip{font-family:ui-monospace,monospace;font-size:11.5px;background:var(--surface-2);border-radius:7px;padding:4px 8px}
    .logo-drop{width:74px;height:74px;border-radius:16px;border:1.5px dashed var(--border);display:grid;place-items:center;color:var(--muted);cursor:pointer;transition:all .15s;overflow:hidden;background:var(--surface-2)}
    .logo-drop:hover{border-color:var(--primary);color:var(--primary)}
    /* ---- admin profile ---- */
    .prof-grid{display:grid;grid-template-columns:1fr 330px;gap:18px;align-items:start}
    @media(max-width:1080px){.prof-grid{grid-template-columns:1fr}}
    .doc-row{display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid var(--border)}
    .doc-row:last-child{border-bottom:0}
    .doc-row .di{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;flex-shrink:0}
    /* ---- word-style editor ---- */
    .doc-app{background:linear-gradient(180deg,#F0F1F5 0%,#E8EAF0 100%);min-height:calc(100vh - 66px);margin:0;padding:0;position:relative}
    .app.dark .doc-app{background:linear-gradient(180deg,#0B0F1A 0%,#0F1420 100%)}
    .doc-titlebar{background:linear-gradient(135deg,var(--primary),color-mix(in srgb, var(--primary) 65%, var(--accent)));color:#fff;padding:10px 20px;display:flex;align-items:center;gap:12px;font-size:12.5px;font-weight:600;flex-wrap:wrap}
    .doc-titlebar .name-in{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.18);color:#fff;height:28px;border-radius:6px;padding:0 10px;font-size:12.5px;font-weight:600;min-width:220px;outline:0}
    .doc-titlebar .name-in::placeholder{color:rgba(255,255,255,.72)}
    .doc-titlebar .name-in:focus{background:rgba(255,255,255,.22);border-color:rgba(255,255,255,.35)}
    .doc-titlebar .save-state{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;background:rgba(255,255,255,.16);font-size:11px;font-weight:600}
    .doc-titlebar .save-state .pd{width:6px;height:6px;border-radius:50%;background:#fde047}
    .doc-titlebar .save-state .sv{width:6px;height:6px;border-radius:50%;background:#4ade80;box-shadow:0 0 8px #4ade80}
    .doc-titlebar .tb-actions{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
    .doc-titlebar .tb-actions button{background:rgba(255,255,255,.14);border:0;color:#fff;height:28px;padding:0 10px;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:background .15s}
    .doc-titlebar .tb-actions button:hover{background:rgba(255,255,255,.24)}
    .ribbon{background:var(--surface);border-bottom:1px solid var(--border)}
    .ribbon-tabs{display:flex;gap:2px;padding:6px 12px 0}
    .ribbon-tab{background:transparent;border:0;color:var(--muted);font-family:inherit;font-size:12.5px;font-weight:600;padding:8px 14px;border-radius:8px 8px 0 0;cursor:pointer;letter-spacing:.02em;transition:all .15s;position:relative}
    .ribbon-tab:hover{color:var(--text);background:var(--hover)}
    .ribbon-tab.on{color:var(--primary);background:var(--primary-soft)}
    .ribbon-tab.on::after{content:"";position:absolute;left:14px;right:14px;bottom:-1px;height:2px;background:var(--primary);border-radius:2px}
    .ribbon-body{padding:8px 12px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;min-height:52px;border-top:1px solid var(--border)}
    .rg{display:flex;align-items:center;gap:3px;padding:2px 8px;border-right:1px solid var(--border)}
    .rg:last-child{border-right:0}
    .rb{width:30px;height:30px;border:0;background:transparent;border-radius:6px;color:var(--text);cursor:pointer;display:grid;place-items:center;transition:all .12s;font-family:inherit;font-size:12px;font-weight:600}
    .rb:hover{background:var(--hover)}
    .rb.on{background:var(--primary-soft);color:var(--primary)}
    .rb.rb-wide{width:auto;padding:0 8px;gap:4px;display:inline-flex;align-items:center}
    .rb.rb-color{position:relative}
    .rb.rb-color::after{content:"";position:absolute;bottom:3px;left:5px;right:5px;height:3px;border-radius:1px;background:var(--_c,#EF4444)}
    .r-sel{height:30px;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:6px;padding:0 8px;font-family:inherit;font-size:12.5px;cursor:pointer;outline:0}
    .r-sel:hover{border-color:var(--primary)}
    .doc-scroll{padding:26px 20px 100px;overflow-y:auto}
    .doc-page{margin:0 auto;background:#fff;color:#111;box-shadow:0 24px 60px -20px rgba(15,23,42,.22),0 6px 12px rgba(15,23,42,.06);border-radius:2px;position:relative;transition:transform .18s cubic-bezier(.4,0,.2,1);font-family:"Calibri","Segoe UI",Arial,sans-serif;line-height:1.5;color:#000}
    .app.dark .doc-page{background:#f6f6f6}
    .doc-page[contenteditable="true"]{outline:0}
    .doc-page[data-orient="portrait"]{width:816px;min-height:1056px;padding:96px 96px}
    .doc-page[data-orient="landscape"]{width:1056px;min-height:816px;padding:96px 96px}
    .doc-page.wide{max-width:100%}
    .doc-page.reading{background:#FEFBF3;box-shadow:0 12px 40px rgba(0,0,0,.1)}
    .doc-page h1{font-size:28pt;font-weight:700;margin:16px 0 12px;color:#1a1a1a}
    .doc-page h2{font-size:20pt;font-weight:600;margin:14px 0 10px;color:#2b5797}
    .doc-page h3{font-size:16pt;font-weight:600;margin:12px 0 8px;color:#2b5797}
    .doc-page p{margin:0 0 10px}
    .doc-page ul,.doc-page ol{margin:0 0 10px;padding-left:34px}
    .doc-page li{margin-bottom:4px}
    .doc-page blockquote{border-left:4px solid #5B5CEB;padding:6px 14px;margin:12px 0;background:#f5f5ff;color:#333}
    .doc-page table{border-collapse:collapse;margin:12px 0;width:auto}
    .doc-page table td,.doc-page table th{border:1px solid #999;padding:8px 12px;min-width:60px}
    .doc-page table th{background:#e7eaf3;font-weight:700;text-align:left}
    .doc-page img{max-width:100%;height:auto;margin:8px 0;border-radius:2px}
    .doc-page hr{border:0;border-top:1.5px solid #333;margin:16px 0}
    .doc-page .page-brk{border-top:1.5px dashed #94a3b8;text-align:center;color:#94a3b8;font-size:10pt;font-family:Inter,sans-serif;margin:20px -96px;padding:6px 0;background:#f8fafc}
    .doc-page .comment-mark{background:#fff3cd;border-bottom:2px solid #f0ad4e;cursor:pointer}
    .doc-page.grid-on{background-image:linear-gradient(#e5e7eb 1px,transparent 1px),linear-gradient(90deg,#e5e7eb 1px,transparent 1px);background-size:24px 24px}
    .doc-page.wm::before{content:attr(data-watermark);position:absolute;inset:0;display:grid;place-items:center;font-size:96pt;font-weight:800;color:rgba(15,23,42,.06);transform:rotate(-30deg);pointer-events:none;letter-spacing:.15em;text-transform:uppercase}
    .doc-ruler{background:#fff;color:#94a3b8;font-size:9px;padding:4px 0;text-align:center;font-family:Inter,sans-serif;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:2;margin:0 auto 8px;letter-spacing:.15em}
    .doc-statusbar{position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--border);padding:6px 18px;display:flex;align-items:center;gap:14px;font-size:11.5px;color:var(--muted);font-weight:600;z-index:3}
    .doc-statusbar .sep{width:1px;height:14px;background:var(--border)}
    .doc-zoom{margin-left:auto;display:flex;align-items:center;gap:8px}
    .doc-zoom input[type="range"]{width:120px;accent-color:var(--primary)}
    /* library */
    .rep-hero{background:linear-gradient(135deg,var(--primary),color-mix(in srgb, var(--primary) 55%, var(--accent)));border-radius:18px;padding:26px 28px;color:#fff;position:relative;overflow:hidden;margin-bottom:18px}
    .rep-hero::before{content:"";position:absolute;right:-40px;top:-40px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.08)}
    .rep-hero h1{margin:0;font-size:24px;font-weight:800;letter-spacing:-.02em}
    .rep-hero p{margin:6px 0 0;font-size:13.5px;color:rgba(255,255,255,.9);max-width:520px}
    .rep-hero-cta{position:relative;z-index:1;margin-top:18px;display:flex;gap:10px;flex-wrap:wrap}
    .rep-hero-cta button{background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.22);height:38px;border-radius:10px;padding:0 14px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:background .18s,transform .18s;backdrop-filter:blur(10px)}
    .rep-hero-cta button:hover{background:rgba(255,255,255,.26);transform:translateY(-1px)}
    .rep-hero-cta button.pri{background:#fff;color:var(--primary);border-color:#fff}
    .rep-hero-cta button.pri:hover{background:#f8fafc}
    .doc-card{padding:16px;cursor:pointer;transition:transform .18s cubic-bezier(.4,0,.2,1),box-shadow .18s,border-color .18s;position:relative}
    .doc-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);border-color:var(--primary)}
    .doc-card .thumb{height:140px;border-radius:10px;background:linear-gradient(135deg,#fff 0%,#f8fafc 100%);border:1px solid #e5e7eb;display:grid;place-items:center;position:relative;overflow:hidden;margin-bottom:12px}
    .doc-card .thumb .fake{width:80%;height:80%;background:#fff;border:1px solid #e2e8f0;border-radius:2px;padding:12px 10px;font-size:5.5px;line-height:1.5;color:#94a3b8;overflow:hidden;box-shadow:0 4px 8px rgba(15,23,42,.06)}
    .doc-card .thumb .fake .h{background:#334155;height:8px;width:70%;border-radius:1px;margin-bottom:5px}
    .doc-card .thumb .fake .l{background:#cbd5e1;height:3px;width:100%;border-radius:1px;margin-bottom:3px}
    .doc-card .thumb .fake .l.s{width:60%}
    .doc-card .thumb .ext{position:absolute;top:8px;right:8px;font-size:9px;font-weight:800;padding:2px 6px;border-radius:5px;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.08);letter-spacing:.05em}
    .doc-card h4{margin:0;font-size:13.5px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .doc-card .meta{margin-top:4px;font-size:11px;color:var(--muted);display:flex;align-items:center;gap:5px;flex-wrap:wrap}
    .doc-card .card-acts{position:absolute;top:6px;right:6px;display:flex;gap:3px;opacity:0;transition:opacity .15s}
    .doc-card:hover .card-acts{opacity:1}
    .doc-card .card-acts button{width:28px;height:28px;border-radius:7px;border:0;background:var(--surface);box-shadow:0 2px 6px rgba(0,0,0,.12);color:var(--muted);cursor:pointer;display:grid;place-items:center}
    .doc-card .card-acts button:hover{color:var(--primary);background:var(--primary-soft)}
    .tpl-card{padding:14px;cursor:pointer;transition:all .18s;text-align:left;background:var(--surface);border:1px solid var(--border);border-radius:14px}
    .tpl-card:hover{transform:translateY(-2px);border-color:var(--primary);box-shadow:var(--shadow)}
    .tpl-card .ti{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;margin-bottom:10px}
    .tpl-card h5{margin:0;font-size:13px;font-weight:700}
    .tpl-card p{margin:3px 0 0;font-size:11.5px;color:var(--muted);line-height:1.45}
    /* find & replace / comments */
    .find-bar{position:absolute;top:12px;right:20px;z-index:6;background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow-lg);padding:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;max-width:calc(100vw - 60px)}
    .find-bar input{height:30px;border:1px solid var(--border);background:var(--surface-2);border-radius:6px;padding:0 10px;font-family:inherit;font-size:12px;outline:0;min-width:160px}
    .find-bar input:focus{border-color:var(--primary);background:var(--surface)}
    .comments-panel{position:sticky;top:100px;max-height:calc(100vh - 130px);overflow-y:auto}
    .comment-item{padding:12px;border-radius:10px;background:var(--surface-2);border:1px solid var(--border);margin-bottom:8px}
    .comment-item .txt{font-size:12.5px;color:var(--text);line-height:1.5;margin-top:4px}
    .comment-item .meta{font-size:11px;color:var(--muted);display:flex;align-items:center;justify-content:space-between}
    /* ---- reports & analytics center ---- */
    .ra-kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;margin-bottom:18px}
    .ra-kpi{padding:14px 16px 8px;position:relative;overflow:hidden;transition:transform .18s cubic-bezier(.4,0,.2,1),box-shadow .18s}
    .ra-kpi:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg)}
    .ra-kpi .ra-kpi-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
    .ra-kpi .ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center}
    .ra-kpi .trend{display:inline-flex;align-items:center;gap:2px;font-size:11.5px;font-weight:700}
    .ra-kpi .val{font-size:22px;font-weight:800;letter-spacing:-.02em}
    .ra-kpi .lab{font-size:11.5px;color:var(--muted);font-weight:600;margin-top:1px}
    .ra-kpi .ra-spark{margin:4px -16px -8px}
    .ra-2col{display:grid;grid-template-columns:1fr 1fr;gap:18px}
    .ra-3col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px}
    @media(max-width:1100px){.ra-2col,.ra-3col{grid-template-columns:1fr}}
    .ra-filter-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
    .ra-dl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;padding:0 20px 20px}
    .ra-dl-card{padding:18px;transition:transform .18s cubic-bezier(.4,0,.2,1),box-shadow .18s,border-color .18s}
    .ra-dl-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);border-color:var(--primary)}
    .ra-dl-card .ic{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;margin-bottom:10px}
    .ra-dl-card h4{margin:0;font-size:13.5px;font-weight:700}
    .ra-dl-card p{margin:4px 0 12px;font-size:11.8px;color:var(--muted);line-height:1.5}
    .ra-dl-card .fmt-row{display:flex;gap:6px;flex-wrap:wrap}
    .ra-quick{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;padding:0 20px 20px}
    .ra-quick-btn{display:flex;align-items:center;gap:9px;padding:11px 13px;background:var(--surface);border:1px solid var(--border);border-radius:12px;font-family:inherit;font-size:12.5px;font-weight:700;color:var(--text);cursor:pointer;transition:all .15s;text-align:left}
    .ra-quick-btn:hover{border-color:var(--primary);background:var(--primary-soft);transform:translateY(-1px)}
    .ra-quick-btn .ic{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;flex-shrink:0}
    .signin-card{width:100%;max-width:100%;padding:38px;animation:siFadeUp .55s .15s cubic-bezier(.4,0,.2,1) both;
      background:color-mix(in srgb, var(--surface) 88%, transparent);backdrop-filter:blur(22px) saturate(160%);
      border:1px solid color-mix(in srgb, var(--border) 70%, transparent);
      box-shadow:0 30px 70px -24px rgba(15,23,42,.22),0 0 0 1px rgba(255,255,255,.04) inset;
      display:flex;flex-direction:column;justify-content:center}
    .app.dark .signin-card{box-shadow:0 30px 70px -24px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.03) inset}
    .signin-mode{margin-left:auto;align-self:flex-start;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:4px 9px;border-radius:20px;background:var(--warning-soft);color:#92400E}
    .signin-mode.live{background:var(--success-soft);color:var(--success)}
    .sig-scope{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin:14px 0 4px}
    .sig-scope-meta{display:flex;align-items:center;gap:10px;padding-bottom:2px;flex-wrap:wrap}
    .sig-scope-meta .who{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--muted);background:var(--surface-2);padding:7px 11px;border-radius:9px}
    .sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:stretch;margin:12px 0 14px}
    @media(max-width:900px){.sig-grid{grid-template-columns:1fr}}
    .sig-editor{min-height:190px;height:100%;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;resize:vertical}
    .sig-preview{white-space:pre-wrap;padding:14px 16px;border:1px dashed var(--border);border-radius:12px;background:var(--surface-2);font-size:13px;line-height:1.6;color:var(--text);min-height:190px;height:100%;box-sizing:border-box}
    .otp-demo{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:9px 12px;margin-bottom:10px;border-radius:10px;background:var(--warning-soft);color:#92400E;font-size:12px;font-weight:600;border:1px dashed color-mix(in srgb, var(--warning) 55%, transparent)}
    .otp-demo b{font-size:15px;letter-spacing:.14em;color:#78350F}
    .app.dark .otp-demo{color:#FCD34D}.app.dark .otp-demo b{color:#FDE68A}
    /* ---- registration wizard ---- */
    .reg-card{max-height:88vh;overflow-y:auto}
    .reg-fade{animation:fade .3s}
    .reg-steps{display:flex;align-items:center;gap:8px;margin:2px 0 20px}
    .reg-steps>i{flex:1;height:2px;background:var(--border);border-radius:2px;transition:background .3s}
    .reg-steps>i.on{background:var(--primary)}
    .reg-step{display:flex;align-items:center;gap:7px}
    .reg-step .dot{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800;background:var(--surface-2);color:var(--faint);border:1.5px solid var(--border);transition:all .25s}
    .reg-step.active .dot{background:var(--primary);border-color:var(--primary);color:#fff;box-shadow:0 0 0 4px var(--primary-soft)}
    .reg-step.done .dot{background:var(--success);border-color:var(--success);color:#fff}
    .reg-step .lbl{font-size:12px;font-weight:700;color:var(--faint)}
    .reg-step.active .lbl{color:var(--text)}
    .reg-step.done .lbl{color:var(--success)}
    .reg-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    @media(max-width:560px){.reg-grid2{grid-template-columns:1fr}}
    .signin-field .opt{font-weight:500;color:var(--faint);font-size:11px}
    .signin-input-wrap .okic{position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--success);animation:fade .25s}
    .signin-input-wrap.sel select{width:100%;height:46px;border:1.5px solid var(--border);border-radius:12px;background:var(--surface-2);color:var(--text);font-family:inherit;font-size:13.5px;padding:0 12px 0 40px;outline:0;appearance:auto;cursor:pointer;transition:border .15s,background .15s}
    .signin-input-wrap.sel select:focus{border-color:var(--primary);background:var(--surface)}
    .reg-verify{border:1.5px solid var(--border);border-radius:14px;padding:14px 16px;transition:border-color .25s,background .25s}
    .reg-verify.ok{border-color:color-mix(in srgb, var(--success) 45%, var(--border));background:color-mix(in srgb, var(--success) 5%, var(--surface))}
    .reg-verify-head{display:flex;align-items:center;gap:11px;flex-wrap:wrap}
    .reg-verify-head .ic{width:32px;height:32px;border-radius:10px;background:var(--primary-soft);color:var(--primary);display:grid;place-items:center;flex-shrink:0}
    .reg-verify.ok .reg-verify-head .ic{background:var(--success-soft);color:var(--success)}
    .reg-verify-head>div{flex:1;min-width:120px}
    .reg-verify-head b{display:block;font-size:13px}
    .reg-verify-head span{font-size:11.5px;color:var(--muted);word-break:break-all}
    .reg-verified{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:800;color:var(--success);animation:fade .3s}
    .reg-verify-body{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}
    .reg-nav{display:flex;align-items:center;gap:10px}
    .pw-meter{height:6px;border-radius:4px;background:var(--surface-2);overflow:hidden;margin-top:-6px}
    .pw-meter i{display:block;height:100%;border-radius:4px;transition:width .3s,background .3s}
    .pw-meter i.s1{background:#EF4444}.pw-meter i.s2{background:#F97316}.pw-meter i.s3{background:#EAB308}.pw-meter i.s4{background:#84CC16}.pw-meter i.s5{background:var(--success)}
    .pw-meter-label{font-size:11px;font-weight:700;color:var(--muted);margin-top:-6px}
    .pw-rules{display:flex;flex-wrap:wrap;gap:7px;margin-top:-4px}
    .pw-rules span{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:4px 9px;border-radius:14px;background:var(--surface-2);color:var(--faint);transition:all .2s}
    .pw-rules span.ok{background:var(--success-soft);color:var(--success)}
    .reg-pending{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;padding:26px 8px}
    .reg-pending-ic{width:64px;height:64px;border-radius:50%;background:var(--warning-soft);color:#B45309;display:grid;place-items:center;animation:brandPulse 2.6s ease-in-out infinite}
    .reg-pending h2{margin:0;font-size:20px}
    .reg-pending p{margin:0;font-size:13px;color:var(--muted);line-height:1.65;max-width:360px}
    .signin-create{text-align:center;font-size:12.5px;color:var(--muted);font-weight:600;margin-top:14px}
    .signin-create a{color:var(--primary);font-weight:800;text-decoration:none}
    .signin-create a:hover{text-decoration:underline}
    /* ---- otp sign-in ---- */
    .otp-row{display:flex}
    .otp-single{width:100%;max-width:280px;height:52px;text-align:center;font-size:22px;font-weight:800;letter-spacing:.45em;text-indent:.45em;border:1.5px solid var(--border);border-radius:12px;background:var(--surface-2);color:var(--text);outline:0;transition:border .15s,background .15s,box-shadow .15s;font-family:ui-monospace,Menlo,monospace;animation:otpPop .3s cubic-bezier(.34,1.3,.64,1)}
    .otp-single::placeholder{color:var(--faint);letter-spacing:.35em;font-size:18px}
    .otp-single:focus{border-color:var(--primary);background:var(--surface);box-shadow:0 0 0 3px var(--primary-soft)}
    .otp-block{animation:otpExpand .38s cubic-bezier(.34,1.3,.64,1)}
    @keyframes otpExpand{from{opacity:0;transform:translateY(-8px) scaleY(.85);max-height:0}to{opacity:1;transform:none;max-height:200px}}
    @keyframes otpPop{from{opacity:0;transform:scale(.92) translateY(6px)}to{opacity:1;transform:none}}
    .otp-ttl{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--warning);font-weight:700;margin-left:8px}
    .otp-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
    .otp-send{border:0;background:var(--primary-soft);color:var(--primary);font-family:inherit;font-size:11.5px;font-weight:800;height:30px;padding:0 12px;border-radius:8px;cursor:pointer;transition:all .15s;flex-shrink:0}
    .otp-send:hover:not(:disabled){background:var(--primary);color:#fff}
    .otp-send:disabled{opacity:.55;cursor:not-allowed}
    .signin-ok{display:flex;align-items:center;gap:7px;padding:10px 13px;border-radius:11px;background:var(--success-soft);color:var(--success);font-size:12.5px;font-weight:700;animation:fade .3s}
    .signin-info{display:flex;align-items:center;gap:7px;padding:10px 13px;border-radius:11px;background:var(--primary-soft);color:var(--primary);font-size:12.5px;font-weight:600;animation:fade .3s}
    @media(max-width:480px){.otp-single{height:48px;font-size:19px}}
    .comp-fs-backdrop{position:fixed;inset:0;background:color-mix(in srgb, #0B0F1A 45%, transparent);backdrop-filter:blur(6px);z-index:210;animation:fade .18s}
    .composer.comp-fs{position:fixed;inset:5vh 6vw;z-index:220;display:flex;flex-direction:column;box-shadow:0 50px 120px -24px rgba(10,14,30,.5);animation:cmdkIn .22s cubic-bezier(.34,1.35,.64,1);
      max-height:none;min-height:0}
    /* Fullscreen already hands its height down through flex, so the scroller
       has to keep passing it on or .comp-area's flex:1 has nothing to fill. */
    .composer.comp-fs .comp-scroll{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
    .composer.comp-fs .comp-area{flex:1;display:flex;min-height:0;padding:20px 26px}
    .composer.comp-fs .comp-area textarea{flex:1;height:100%;min-height:0;resize:none;font-size:16px}
    @media(max-width:768px){.composer.comp-fs{inset:2vh 2vw}}
    @media(max-width:768px){.comp-area textarea{min-height:300px;font-size:15px}}
    /* ---- composer collapse (reading mode) ---- */
    .comp-collapse{display:grid;grid-template-rows:0fr;transition:grid-template-rows .28s cubic-bezier(.4,0,.2,1);}
    .comp-collapse.open{grid-template-rows:1fr}
    .comp-collapse>div{overflow:hidden;min-height:0}
    .reply-bar{display:flex;align-items:center;gap:10px;padding:16px 0 4px;border-top:1px solid var(--border);animation:fade .25s}
    .reply-bar .hint{margin-left:auto;font-size:11.5px;color:var(--faint);font-weight:600}
    @media(max-width:768px){.reply-bar{flex-wrap:wrap}.reply-bar .hint{display:none}}
    /* ---- experience layer ---- */
    /* No isolation:isolate here. It used to keep the aurora blobs (below) from
       slipping behind the .app background, but it also made .main a stacking
       context — which trapped every overlay inside it, so drawers and modals
       painted under the admin panel's sidebar (z-300) and topbar (z-400) as well
       as under this page's own rail (z-40). The blobs sit at z-index:0 instead:
       above the .app background (painted earlier, unpositioned) and below the
       content at z-index:1, which gets the same result without the trap. */
    .main{position:relative}
    /* Both aurora blobs in ONE pseudo-element on .app.
       As .app's ::before it is the first child in paint order, so page content
       covers it without .content needing a z-index -- and .content without a
       z-index creates no stacking context, which is what lets every drawer and
       modal on the page actually paint above the workspace rail. */
    /* Gradient stops are CENTRES, where the originals were edge offsets:
       the first blob was right:-120px/top:-140px at 480px square, so its centre
       is 120px past the right edge and 100px down. No filter:blur() — a
       full-viewport blur repainting on every animation frame is expensive, and
       a radial-gradient fading to transparent is already soft. */
    .app::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.55;
      background:
        radial-gradient(480px 480px at calc(100% + 120px) 100px, color-mix(in srgb, var(--primary) 16%, transparent), transparent 70%),
        radial-gradient(420px 420px at calc(8% + 210px) calc(100% - 50px), color-mix(in srgb, var(--accent) 13%, transparent), transparent 70%);
      animation:auroraDrift 18s ease-in-out infinite alternate}
    @keyframes auroraDrift{from{transform:translate(0,0) scale(1)}to{transform:translate(-40px,30px) scale(1.08)}}
    /* position:relative only — adding a z-index here reintroduces the stacking
       context and every overlay on the page falls behind the rail again. */
    .content{position:relative}
    .confetti-host{position:fixed;inset:0;pointer-events:none;z-index:1400}
    .confetti-host i{position:absolute;top:55%;width:9px;height:9px;border-radius:2px;animation:confetti 1.5s cubic-bezier(.2,.7,.4,1) forwards}
    @keyframes confetti{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(var(--dx),var(--dy)) rotate(var(--rz));opacity:0}}
    .dash-live{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:16px;margin-bottom:22px}
    @media(max-width:1100px){.dash-live{grid-template-columns:1fr}}
    .ins-dots{display:flex;gap:5px}
    .ins-dots button{width:7px;height:7px;border-radius:50%;border:0;background:var(--border);cursor:pointer;transition:all .2s;padding:0}
    .ins-dots button.on{background:var(--primary);width:18px;border-radius:4px}
    .ins-body{display:flex;gap:12px;align-items:flex-start;animation:fade .4s}
    .ins-body .ic{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;flex-shrink:0}
    .ins-body p{margin:4px 0 0;font-size:13.5px;line-height:1.55;font-weight:600}
    .sla-ring-wrap{display:flex;gap:16px;align-items:center;margin-top:8px}
    .sla-ring{width:104px;height:104px;border-radius:50%;display:grid;place-items:center;flex-shrink:0}
    .sla-ring-in{width:78px;height:78px;border-radius:50%;background:var(--surface);display:grid;place-items:center;text-align:center;align-content:center}
    .sla-ring-in b{font-size:19px;font-weight:800;display:block}
    .sla-ring-in span{font-size:9.5px;color:var(--muted);font-weight:600}
    .sla-mini{display:grid;gap:5px;font-size:12px;color:var(--muted)}
    .sla-mini b{color:var(--text);margin-left:4px}
    .sla-mini .dotc{width:8px;height:8px;display:inline-block;border-radius:50%;margin-right:6px}
    .live-feed{display:grid;gap:7px;max-height:172px;overflow-y:auto}
    .lf-item{display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:10px;background:var(--surface-2);animation:lfIn .35s cubic-bezier(.25,.8,.35,1) both}
    @keyframes lfIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
    .lf-item .ic{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;flex-shrink:0}
    .lf-item .tx{flex:1;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .lf-item .wh{font-size:10.5px;color:var(--faint);font-weight:600}
    .cmdk-overlay{position:fixed;inset:0;background:color-mix(in srgb, #0B0F1A 40%, transparent);backdrop-filter:blur(6px);z-index:1300;display:flex;justify-content:center;padding-top:12vh;animation:fade .15s}
    .cmdk{width:min(620px,calc(100vw - 32px));max-height:64vh;background:color-mix(in srgb, var(--surface) 92%, transparent);backdrop-filter:blur(20px) saturate(150%);border:1px solid var(--border);border-radius:18px;box-shadow:0 40px 90px -20px rgba(10,14,30,.45);display:flex;flex-direction:column;overflow:hidden;animation:cmdkIn .22s cubic-bezier(.34,1.35,.64,1)}
    @keyframes cmdkIn{from{opacity:0;transform:translateY(-14px) scale(.98)}to{opacity:1;transform:none}}
    .cmdk-in{display:flex;align-items:center;gap:11px;padding:15px 18px;border-bottom:1px solid var(--border);color:var(--muted)}
    .cmdk-in input{flex:1;border:0;background:none;outline:0;font-family:inherit;font-size:15px;color:var(--text)}
    .cmdk-in kbd{font-family:inherit;font-size:10px;font-weight:700;background:var(--surface-2);border:1px solid var(--border);border-radius:5px;padding:3px 6px;color:var(--muted)}
    .cmdk-body{overflow-y:auto;padding:8px}
    .cmdk-h{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);padding:10px 12px 5px}
    .cmdk-item{display:flex;align-items:center;gap:11px;width:100%;padding:9px 12px;border:0;background:none;border-radius:10px;font-family:inherit;font-size:13.5px;font-weight:600;color:var(--text);cursor:pointer;transition:background .1s}
    .cmdk-item:hover,.cmdk-item:focus-visible{background:var(--hover)}
    .cmdk-item .ic{width:28px;height:28px;border-radius:8px;background:var(--surface-2);display:grid;place-items:center;color:var(--muted);flex-shrink:0}
    .cmdk-item:hover .ic{color:var(--primary);background:var(--primary-soft)}
    .cmdk-meta{font-size:11px;color:var(--faint);font-weight:600}
    .cmdk-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:34px;color:var(--faint);font-size:13px;font-weight:600}
    .cmdk-foot{display:flex;gap:16px;padding:10px 18px;border-top:1px solid var(--border);font-size:11px;color:var(--faint);font-weight:600}
    .cmdk-foot kbd{font-family:inherit;font-size:9.5px;font-weight:800;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;padding:2px 5px;margin-right:4px}
    .ai-fab{position:fixed;right:26px;bottom:26px;width:52px;height:52px;border-radius:50%;border:0;background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;cursor:pointer;display:grid;place-items:center;box-shadow:0 14px 34px -8px color-mix(in srgb, var(--primary) 65%, transparent);z-index:120;transition:transform .2s cubic-bezier(.34,1.5,.64,1),box-shadow .2s;animation:fabIn .4s cubic-bezier(.34,1.5,.64,1)}
    .ai-fab:hover{transform:scale(1.1) rotate(8deg);box-shadow:0 18px 44px -8px color-mix(in srgb, var(--primary) 80%, transparent)}
    .ai-fab.hidden{display:none}
    @keyframes fabIn{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}
    .ai-panel{position:fixed;right:26px;bottom:26px;width:min(370px,calc(100vw - 32px));height:min(520px,calc(100vh - 100px));background:var(--surface);border:1px solid var(--border);border-radius:20px;box-shadow:0 40px 90px -20px rgba(10,14,30,.4);display:flex;flex-direction:column;overflow:hidden;z-index:130;animation:aiIn .28s cubic-bezier(.34,1.35,.64,1)}
    @keyframes aiIn{from{opacity:0;transform:translateY(22px) scale(.96)}to{opacity:1;transform:none}}
    .ai-head{display:flex;align-items:center;gap:10px;padding:13px 15px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,color-mix(in srgb, var(--primary) 9%, var(--surface)),var(--surface))}
    .ai-head .ic{width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;display:grid;place-items:center}
    .ai-head b{font-size:13.5px;display:block}
    .ai-head .st{font-size:10.5px;color:var(--muted);font-weight:600;display:inline-flex;align-items:center;gap:4px}
    .ai-body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
    .ai-msg{display:flex}
    .ai-msg.me{justify-content:flex-end}
    .ai-msg .bub{max-width:82%;padding:9px 12px;border-radius:14px;font-size:12.8px;line-height:1.5;font-weight:500;animation:lfIn .25s both}
    .ai-msg.ai .bub{background:var(--surface-2);border-bottom-left-radius:4px}
    .ai-msg.me .bub{background:linear-gradient(135deg,var(--primary),color-mix(in srgb, var(--primary) 70%, var(--accent)));color:#fff;border-bottom-right-radius:4px}
    .ai-links{display:grid;gap:5px;margin-top:8px}
    .ai-links button{display:flex;align-items:center;gap:6px;padding:7px 9px;border:1px solid var(--border);background:var(--surface);border-radius:9px;font-family:inherit;font-size:11.5px;font-weight:700;color:var(--primary);cursor:pointer;transition:all .12s;text-align:left}
    .ai-links button:hover{border-color:var(--primary);background:var(--primary-soft)}
    .ai-in{display:flex;gap:8px;padding:11px;border-top:1px solid var(--border)}
    .ai-in input{flex:1;height:38px;border:1px solid var(--border);background:var(--surface-2);border-radius:11px;padding:0 13px;font-family:inherit;font-size:13px;color:var(--text);outline:0;transition:border .15s,background .15s}
    .ai-in input:focus{border-color:var(--primary);background:var(--surface)}
    @media(max-width:768px){.ai-fab{right:16px;bottom:16px}.ai-panel{right:16px;bottom:16px}}
    /* ---- stunning pass ---- */
    .page-head h1{font-size:24px;font-weight:800;letter-spacing:-.035em}
    .route{animation:routeIn .32s cubic-bezier(.25,.8,.35,1)}
    @keyframes routeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
    .stat,.ra-kpi{background:linear-gradient(160deg,var(--surface) 55%,color-mix(in srgb, var(--primary) 4%, var(--surface)) 100%);position:relative}
    .stat::after,.ra-kpi::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:0 0 0 0 color-mix(in srgb, var(--primary) 25%, transparent);opacity:0;transition:opacity .25s;pointer-events:none}
    .stat:hover::after,.ra-kpi:hover::after{opacity:1;box-shadow:0 14px 40px -14px color-mix(in srgb, var(--primary) 45%, transparent)}
    .btn-primary{background:linear-gradient(135deg,var(--primary),color-mix(in srgb, var(--primary) 70%, var(--accent)));position:relative;overflow:hidden}
    .btn-primary:hover{box-shadow:0 8px 22px -8px color-mix(in srgb, var(--primary) 70%, transparent);filter:brightness(1.05)}
    .btn{position:relative;overflow:hidden}
    .btn::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at var(--rx,50%) var(--ry,50%),rgba(255,255,255,.45) 0%,transparent 60%);opacity:0;transition:opacity .5s;pointer-events:none}
    .btn:active::after{opacity:1;transition:opacity 0s}
    .nav-item{transition:background .18s,color .18s,transform .18s}
    .nav-item.active{background:linear-gradient(90deg,var(--primary-soft),color-mix(in srgb, var(--primary-soft) 30%, transparent))}
    .nav-item.active::before{animation:navInd .3s cubic-bezier(.34,1.5,.64,1)}
    @keyframes navInd{from{transform:scaleY(0)}to{transform:scaleY(1)}}
    .sk::after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,color-mix(in srgb, var(--surface) 65%, transparent),transparent);animation:shimmer 1.4s infinite}
    @keyframes shimmer{100%{transform:translateX(100%)}}
    .empty .eic{width:66px;height:66px;border-radius:20px;background:linear-gradient(135deg,var(--primary-soft),color-mix(in srgb, var(--accent) 14%, var(--surface-2)));color:var(--primary);animation:emptyFloat 3.2s ease-in-out infinite}
    @keyframes emptyFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    .switch.on{background:linear-gradient(135deg,var(--success),color-mix(in srgb, var(--success) 70%, var(--accent)))}
    .toast{animation:toastIn .3s cubic-bezier(.34,1.4,.64,1)}
    @keyframes toastIn{from{opacity:0;transform:translateX(24px) scale(.96)}to{opacity:1;transform:none}}
    .fchip{transition:all .16s}
    .fchip.on{background:linear-gradient(135deg,var(--primary),color-mix(in srgb, var(--primary) 72%, var(--accent)));color:#fff;border-color:transparent}
    /* ---- premium polish pass ---- */
    .brand .logo img,.signin-brand .logo img{width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block}
    .brand .logo:has(img),.signin-brand .logo:has(img){background:#fff;padding:0}
    .logo-drop.has-img{border-style:solid;border-color:var(--border);padding:0}
    .logo-drop img{width:100%;height:100%;object-fit:contain;display:block;background:#fff;border-radius:inherit}
    .logo-err{display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:8px 12px;border-radius:9px;background:var(--danger-soft,#FEF2F2);color:var(--danger);font-size:12px;font-weight:600;animation:fade .25s}
    :is(button,a,input,select,textarea,[tabindex]):focus-visible{outline:2px solid var(--primary);outline-offset:2px;border-radius:8px}
    .btn:active{transform:translateY(0) scale(.985)}
    .btn,.icon-btn,.fchip,.seg button{-webkit-tap-highlight-color:transparent}
    .table-wrap{overflow:auto}
    .table-wrap thead th{position:sticky;top:0;z-index:2;background:var(--surface);box-shadow:inset 0 -1px 0 var(--border)}
    .table-wrap tbody tr{transition:background .12s}
    .table-wrap tbody tr:hover td{background:var(--hover,#F5F7FF)}
    .app.dark .table-wrap tbody tr:hover td{background:color-mix(in srgb, var(--primary) 8%, transparent)}
    ::-webkit-scrollbar{width:10px;height:10px}
    ::-webkit-scrollbar-thumb{background:color-mix(in srgb, var(--muted) 28%, transparent);border-radius:6px;border:2.5px solid transparent;background-clip:padding-box}
    ::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb, var(--muted) 45%, transparent);border:2.5px solid transparent;background-clip:padding-box}
    ::-webkit-scrollbar-track{background:transparent}
    .modal{animation:modalIn .22s cubic-bezier(.34,1.4,.64,1)}
    @keyframes modalIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}
    .card{transition:box-shadow .18s,border-color .18s}
    .menu .mi:hover{background:var(--hover,#F5F7FF)}
    @media(max-width:1024px){.content{padding:18px 16px 40px}.grid-stats{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}}
    @media(max-width:768px){
      .content{padding:14px 12px 36px}
      .page-head{flex-direction:column;align-items:flex-start;gap:10px}
      .topbar{padding:10px 12px;gap:8px}
      .topbar .clockbox,.topbar .newbtn-label{display:none}
      .set-grid2,.td-grid,.ra-2col,.ra-3col{grid-template-columns:1fr !important}
      .ra-kpi-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
      .modal{width:calc(100vw - 28px) !important;max-height:88vh;overflow:auto}
    }
    @media(max-width:480px){
      .ra-kpi-grid{grid-template-columns:1fr 1fr}
      .searchbox{max-width:none}
      .ra-dl-grid,.ra-quick{grid-template-columns:1fr}
    }
    @media(prefers-reduced-motion:reduce){.fade,.route,.tcard,.mod,.panel,.canned-pop,.menu,.notif-panel,.search-results,.toast,.ccard,.hp{animation:none;opacity:1}.card,.stat,.icon-btn,.btn,.mod,.sidebar{transition:none}}
  `}</style>
);

/* Everything above is exported so module order never matters. */
export {
  Styles,
};
