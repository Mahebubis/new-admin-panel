import React, { useState, useEffect, useMemo, useRef, useContext, createContext } from "react";
import { useAuth } from "../../hooks/useAuth";
import { announceExpanded, onExpanded } from "../../hooks/sidebarBus";
/* SheetJS is not an npm dependency of this project — every other page that writes
   .xlsx (see pages/assessments/TotalAssessments.jsx) pulls it from the CDN on demand.
   The promise is cached, so the script is fetched at most once per page load. */
let sheetJsPromise = null;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!sheetJsPromise) {
    sheetJsPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload = () => resolve(window.XLSX);
      s.onerror = () => { sheetJsPromise = null; reject(new Error("Could not load SheetJS")); };
      document.head.appendChild(s);
    });
  }
  return sheetJsPromise;
}
import {
  LayoutDashboard, Ticket, Users, BookOpen, BarChart3, Bot, UsersRound,
  Settings, Search, Plus, Bell, Moon, Sun, ChevronDown, Clock, Activity,
  Inbox, CheckCircle2, CalendarClock, Sparkles, FileDown, UserPlus, PlusCircle,
  LineChart as LineChartIcon, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight, AlertTriangle,
  Eye, Pencil, CheckCheck, Trash2, ArrowUpDown, ChevronLeft, ChevronRight,
  Timer, Gauge, Smile, ShieldCheck, ShieldAlert, Menu, SlidersHorizontal,
  LayoutGrid, Rows3, RotateCcw, Download, X, Mail, MessageCircle, Phone,
  Globe, MessageSquare, UserCheck, Reply, Trash, ShieldX,
  MailWarning, Ticket as TicketIcon, Filter, ArrowLeft, ArrowRight, Building2,
  MessageSquareText, MailX, Forward, Zap, Upload, Copy, Play, Pause, XCircle,
  Clock3, Ban, Send, StickyNote, FolderInput, BellRing, TrendingUp, TrendingDown, Check, Tag as TagIcon,
  Star, MoreHorizontal, PanelRight, Bold, Italic, Underline, Heading1, Heading2,
  List, ListOrdered, Link2, Image as ImageIcon, Table as TableIcon, Code, Paperclip,
  Maximize2, CornerUpLeft, AlertCircle, Type, Lock, GraduationCap, CalendarDays,
  BadgeCheck, Briefcase, PhoneCall, AtSign, FileSpreadsheet, FileText, Printer,
  Loader2, Info, LogIn, ArrowUp, Palette, Droplet, RefreshCw, User, Headphones,
  ChevronsLeft, ChevronsRight,
  Save, Key, KeyRound, Database, Webhook, HardDrive, History, LogOut, MapPin,
  Monitor, Smartphone, Camera, Plug, UserCog, FileUp, ScrollText,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Strikethrough, Subscript, Superscript,
  Highlighter, Undo2, Redo2, IndentIncrease, IndentDecrease, Quote, Minus, Columns,
  Ruler, ZoomIn, ZoomOut, PaintBucket, FilePlus, Folder, FolderOpen, MessageSquarePlus,
  Palette as PaletteIcon,
  PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneForwarded, PhoneOff,
  PlayCircle, PauseCircle, Voicemail as VoicemailIcon,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar,
} from "recharts";

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
      --shadow:0 1px 2px rgba(16,24,40,.04),0 8px 24px rgba(16,24,40,.06);
      --shadow-lg:0 12px 40px rgba(24,26,66,.12);
      font-family:'Inter',system-ui,sans-serif;color:var(--text);background:var(--bg);
      min-height:100vh;transition:background .3s,color .3s}
    .app.dark{--bg:#0E1017;--surface:#171A24;--surface-2:#1F2331;--hover:#20242F;
      --text:#EEF1F8;--muted:#9BA3B7;--faint:#6B7488;--border:#262B3B;
      --primary:#7C7DFF;--primary-soft:#242245;--accent:#38BDF8;--accent-soft:#12303C;
      --success:#34D399;--success-soft:#123027;--warning:#FBBF24;--warning-soft:#3A2E12;--danger:#F87171;--danger-soft:#3A1D1D;
      --shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px rgba(0,0,0,.35);--shadow-lg:0 16px 48px rgba(0,0,0,.5)}
    *{box-sizing:border-box}
    .app ::-webkit-scrollbar{width:9px;height:9px}
    .app ::-webkit-scrollbar-thumb{background:var(--border);border-radius:9px}

    .shell{display:flex;min-height:100vh}
    .main{flex:1;min-width:0;display:flex;flex-direction:column}
    .content{padding:24px 28px 48px;max-width:1600px;width:100%;margin:0 auto}

    /* Right-hand rail — border and offsets mirror a normal left sidebar. */
    .sidebar{width:250px;flex-shrink:0;background:var(--surface);border-left:1px solid var(--border);
      display:flex;flex-direction:column;position:sticky;top:0;height:100vh;z-index:40;
      transition:transform .28s cubic-bezier(.4,0,.2,1)}
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
    .side-foot{margin-top:auto;padding:14px;border-top:1px solid var(--border)}
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
    .icon-btn{position:relative;width:40px;height:40px;border-radius:11px;border:1px solid var(--border);background:var(--surface);color:var(--muted);display:grid;place-items:center;cursor:pointer;transition:all .18s}
    .icon-btn:hover:not(:disabled){color:var(--primary);border-color:var(--primary);transform:translateY(-1px)}
    .icon-btn:disabled{opacity:.4;cursor:not-allowed}
    .dot{position:absolute;top:7px;right:8px;min-width:16px;height:16px;padding:0 4px;border-radius:9px;background:var(--danger);color:#fff;font-size:10px;font-weight:700;display:grid;place-items:center;box-shadow:0 0 0 2px var(--surface)}
    .btn{display:inline-flex;align-items:center;gap:7px;border:0;border-radius:11px;padding:9px 15px;font-weight:600;font-size:13.5px;cursor:pointer;font-family:inherit;transition:all .18s;white-space:nowrap}
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
    .two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:22px}
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
    .page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:18px;flex-wrap:wrap}
    .page-head h1{margin:0;font-size:24px;font-weight:800;letter-spacing:-.02em;display:flex;align-items:center;gap:10px}
    .count-badge{font-size:13px;font-weight:700;color:var(--primary);background:var(--primary-soft);padding:3px 11px;border-radius:20px}
    .page-head p{margin:6px 0 0;color:var(--muted);font-size:13.5px}
    .toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:18px}
    .seg{display:flex;background:var(--surface-2);border-radius:11px;padding:3px}
    .seg button{border:0;background:transparent;display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:9px;font-size:12.5px;font-weight:600;color:var(--muted);cursor:pointer;font-family:inherit;transition:all .16s}
    .seg button.on{background:var(--surface);color:var(--primary);box-shadow:var(--shadow)}
    .dd{position:relative}
    .dd-menu{position:absolute;top:calc(100% + 6px);left:0;z-index:20;min-width:200px;background:var(--surface);border:1px solid var(--border);border-radius:13px;box-shadow:var(--shadow-lg);padding:6px;animation:pop .16s ease}
    .dd-menu button{display:flex;width:100%;align-items:center;gap:9px;padding:9px 11px;border:0;background:transparent;border-radius:9px;font-size:13px;color:var(--text);cursor:pointer;font-family:inherit;text-align:left}
    .dd-menu button:hover{background:var(--hover)}
    .dd-menu button.on{color:var(--primary);font-weight:600;background:var(--primary-soft)}
    @keyframes pop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
    .tickets-layout{display:grid;grid-template-columns:236px 1fr;gap:18px}
    @media(max-width:900px){.tickets-layout{grid-template-columns:1fr}}
    .tnav{align-self:start;position:sticky;top:76px}
    .tnav .grp{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);display:flex;align-items:center;justify-content:space-between;padding:4px 10px 10px}
    .tnav-item{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:11px;font-size:13px;font-weight:500;color:var(--muted);cursor:pointer;transition:all .16s;margin-bottom:2px}
    .tnav-item:hover{background:var(--hover);color:var(--text)}
    .tnav-item.on{background:var(--primary-soft);color:var(--primary);font-weight:600}
    .tnav-item .c{margin-left:auto;font-size:11px;font-weight:700;color:var(--faint);background:var(--surface-2);padding:1px 8px;border-radius:20px}
    .tnav-item.on .c{background:var(--primary);color:#fff}
    .tnav-sep{height:1px;background:var(--border);margin:8px 6px}

    .tcard{position:relative;overflow:hidden;padding:16px 18px;display:flex;flex-direction:column;gap:12px;animation:fadeUp .5s cubic-bezier(.4,0,.2,1) both}
    .tcard::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--pc,var(--primary))}
    .tcard:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);border-color:color-mix(in srgb,var(--pc,var(--primary)) 40%,var(--border))}
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
    .pager .info{font-size:12.5px;color:var(--muted)}
    .pg-btns{display:flex;gap:6px;align-items:center}
    .pg-btns button{min-width:34px;height:34px;border-radius:9px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-weight:600;font-size:12.5px;cursor:pointer;transition:all .15s;padding:0 10px;display:inline-flex;align-items:center;gap:4px}
    .pg-btns button:hover:not(:disabled){border-color:var(--primary);color:var(--primary)}
    .pg-btns button.on{background:var(--primary);color:#fff;border-color:var(--primary)}
    .pg-btns button:disabled{opacity:.4;cursor:not-allowed}
    .perpage{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted)}
    .perpage select{font-family:inherit;font-size:12.5px;font-weight:600;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:6px 8px;cursor:pointer}

    .drawer-overlay{position:fixed;inset:0;background:rgba(10,12,20,.4);z-index:1200;backdrop-filter:blur(2px);animation:fade .2s}
    .drawer{position:fixed;top:0;right:0;bottom:0;width:380px;max-width:92vw;background:var(--surface);z-index:1201;box-shadow:var(--shadow-lg);display:flex;flex-direction:column;animation:slideIn .28s cubic-bezier(.4,0,.2,1)}
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
    .modal-overlay{position:fixed;inset:0;background:rgba(10,12,20,.45);z-index:1200;backdrop-filter:blur(3px);display:grid;place-items:center;padding:20px;animation:fade .2s}
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
    .td-bar{display:flex;align-items:center;gap:8px;padding:10px 14px;margin-bottom:16px;flex-wrap:wrap}
    .td-bar .sp{margin-left:auto}
    .td-grid{display:grid;grid-template-columns:1fr 330px;gap:18px;align-items:start}
    @media(max-width:1100px){.td-grid{grid-template-columns:1fr}}
    .td-subj{display:flex;align-items:flex-start;gap:14px;margin-bottom:8px}
    .td-subj .env{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:var(--primary-soft);color:var(--primary);flex-shrink:0}
    .td-subj h2{margin:0;font-size:21px;font-weight:800;letter-spacing:-.02em;line-height:1.3}
    .msg{display:flex;gap:14px;padding:18px 0}
    .msg-av{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0}
    .msg-head{font-size:13px;color:var(--muted)}
    .msg-head b{color:var(--text);font-weight:700}
    .msg-to{font-size:12.5px;color:var(--muted);margin:8px 0 10px}
    .msg-body{font-size:13.5px;line-height:1.7;white-space:pre-wrap}
    .composer{border:1px solid color-mix(in srgb, var(--border) 80%, transparent);border-radius:18px;overflow:visible;background:var(--surface);position:relative;transition:box-shadow .2s,border-color .2s;width:100%}
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
    .entry{display:flex;gap:14px;padding:18px 0;border-top:1px solid var(--border)}
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
    .tcard.slim{padding:11px 14px;gap:7px}
    .tcard.slim::before{width:3px}
    .slim-row{display:flex;align-items:center;gap:10px;min-width:0}
    .slim-av{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;color:#fff;font-weight:700;font-size:11px;flex-shrink:0}
    .slim-id{font-size:11.5px;font-weight:700;color:var(--primary);flex-shrink:0}
    .slim-name{font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px}
    .slim-subj{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;cursor:pointer}
    .slim-subj:hover{color:var(--primary)}
    .slim-meta{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--muted);flex-wrap:wrap}
    .slim-meta .sm{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
    .badge-xs{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;line-height:1.4;white-space:nowrap}
    .replied{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--accent-soft);color:var(--accent);white-space:nowrap}
    .replied .rd{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:pulse 1.8s ease-in-out infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
    .newct{font-size:10px;font-weight:800;color:#fff;background:var(--danger);border-radius:20px;padding:1px 7px;white-space:nowrap}

    .hp{position:fixed;z-index:80;width:430px;max-width:calc(100vw - 24px);background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-lg);overflow:hidden;animation:hpIn .18s cubic-bezier(.4,0,.2,1);pointer-events:auto}
    /* ---- bulk actions ---- */
    .bulkbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:11px 14px;margin-bottom:14px;border-radius:14px;
      background:var(--primary-soft);border:1px solid color-mix(in srgb,var(--primary) 30%,transparent);animation:slideDown .24s cubic-bezier(.4,0,.2,1)}
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
    .tcard.sel{background:var(--primary-soft);border-color:color-mix(in srgb,var(--primary) 35%,transparent)}
    .tcard.sel::before{width:5px;background:var(--primary)}
    tr.sel td{background:var(--primary-soft)}
    @media(max-width:1100px){.bulkbar .tablet-hide{display:none}}
    @media(max-width:700px){.bulkbar .mobile-hide{display:none}}
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
    .sidebar.collapsed{width:72px}
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
    .sidebar.collapsed .nav-item::after{content:attr(data-label);position:absolute;right:calc(100% + 10px);top:50%;transform:translateY(-50%) scale(.96);
      background:var(--text);color:var(--surface);font-size:11.5px;font-weight:700;padding:5px 9px;border-radius:7px;white-space:nowrap;
      opacity:0;pointer-events:none;transition:opacity .14s,transform .14s;z-index:70;box-shadow:var(--shadow)}
    .sidebar.collapsed .nav-item:hover::after{opacity:1;transform:translateY(-50%) scale(1)}
    .collapse-btn{display:flex;align-items:center;gap:10px;width:100%;padding:9px 11px;margin-top:8px;border-radius:11px;border:1px solid var(--border);
      background:var(--surface);color:var(--muted);font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .16s}
    .collapse-btn:hover{border-color:var(--primary);color:var(--primary)}
    @media(max-width:960px){.hide-sm{display:none}}
    /* ---- settings ---- */
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
    .composer.comp-fs{position:fixed;inset:5vh 6vw;z-index:220;display:flex;flex-direction:column;box-shadow:0 50px 120px -24px rgba(10,14,30,.5);animation:cmdkIn .22s cubic-bezier(.34,1.35,.64,1)}
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
    .main::before,.main::after{content:"";position:fixed;border-radius:50%;filter:blur(90px);opacity:.5;pointer-events:none;z-index:0}
    .main::before{width:480px;height:480px;top:-140px;right:-120px;background:radial-gradient(circle,color-mix(in srgb, var(--primary) 16%, transparent),transparent 70%);animation:auroraA 16s ease-in-out infinite alternate}
    .main::after{width:420px;height:420px;bottom:-160px;left:8%;background:radial-gradient(circle,color-mix(in srgb, var(--accent) 13%, transparent),transparent 70%);animation:auroraB 20s ease-in-out infinite alternate}
    @keyframes auroraA{from{transform:translate(0,0) scale(1)}to{transform:translate(-60px,50px) scale(1.15)}}
    @keyframes auroraB{from{transform:translate(0,0) scale(1)}to{transform:translate(70px,-40px) scale(1.1)}}
    .content{position:relative;z-index:1}
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

/* ============================================================================
   HELPERS + DATA
   ========================================================================== */
const initials = (n) => n.split(" ").map(w => w[0]).slice(0, 2).join("");
const avColor = (n) => ["#5B5CEB","#0EA5E9","#10B981","#F59E0B","#8B5CF6","#EC4899","#64748B"][n.length % 7];
const prioColor = { Critical:"#EF4444", Urgent:"#EF4444", High:"#F59E0B", Medium:"#0EA5E9", Low:"#10B981" };
const prioStyle = (p) => ({ Critical:{bg:"#FEE2E2",fg:"#DC2626"}, Urgent:{bg:"#FEE2E2",fg:"#DC2626"}, High:{bg:"#FEF3C7",fg:"#D97706"}, Medium:{bg:"#E0F2FE",fg:"#0284C7"}, Low:{bg:"#DCFCE7",fg:"#16A34A"} }[p] || {bg:"#F1F5F9",fg:"#64748B"});
const statusStyle = (s) => ({ Open:{bg:"#E0F2FE",fg:"#0284C7"}, "In Progress":{bg:"#EEF0FE",fg:"#5B5CEB"}, Pending:{bg:"#FEF3C7",fg:"#D97706"}, Waiting:{bg:"#FEF3C7",fg:"#D97706"}, New:{bg:"#DCFCE7",fg:"#16A34A"}, Escalated:{bg:"#FEE2E2",fg:"#DC2626"}, Overdue:{bg:"#FEE2E2",fg:"#DC2626"}, Resolved:{bg:"#DCFCE7",fg:"#16A34A"}, Closed:{bg:"#F1F5F9",fg:"#64748B"} }[s] || {bg:"#F1F5F9",fg:"#64748B"});
const slaStyle = { "On track":{bg:"#DCFCE7",fg:"#16A34A"}, "At risk":{bg:"#FEF3C7",fg:"#D97706"}, "Breached":{bg:"#FEE2E2",fg:"#DC2626"} };
const SOURCE_ICON = { Email:Mail, Chat:MessageCircle, WhatsApp:MessageSquare, Phone:Phone, Portal:Globe };

function PrioBadge({ p }) { const s = prioStyle(p); return <span className="badge-pill" style={{background:s.bg,color:s.fg}}><span className="dotc" style={{background:s.fg}} />{p}</span>; }
function StatusBadge({ s }) { const c = statusStyle(s); return <span className="badge-pill" style={{background:c.bg,color:c.fg}}>{s}</span>; }

function useCounter(target, dur = 1100) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf, start;
    const step = (ts) => { if (!start) start = ts; const p = Math.min((ts - start) / dur, 1);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return n;
}

const STATS = [
  { key:"unresolved", label:"Unresolved", value:47, desc:"Awaiting first action", color:"#5B5CEB", icon:Inbox, trend:+8, spark:[12,18,14,22,19,25,23] },
  { key:"overdue", label:"Overdue", value:9, desc:"Past SLA deadline", color:"#EF4444", icon:AlertTriangle, trend:-12, spark:[8,11,9,13,7,6,5] },
  { key:"open", label:"Open", value:63, desc:"Currently in progress", color:"#0EA5E9", icon:Ticket, trend:+5, spark:[40,44,50,48,55,60,63] },
  { key:"closed", label:"Closed", value:412, desc:"Resolved this month", color:"#10B981", icon:CheckCircle2, trend:+21, spark:[280,310,330,360,380,400,412] },
  { key:"due", label:"Due Today", value:14, desc:"Deadline within 24h", color:"#F59E0B", icon:CalendarClock, trend:+3, spark:[6,9,8,11,10,13,14] },
  { key:"new", label:"New", value:26, desc:"Created in last 24h", color:"#8B5CF6", icon:Sparkles, trend:+17, spark:[10,14,12,18,20,24,26] },
];
const ANALYTICS = {
  Day:["9am","11am","1pm","3pm","5pm","7pm","9pm"].map((t,i)=>({t,Received:[8,14,11,17,13,9,5][i],Resolved:[5,10,9,14,12,8,6][i],Pending:[3,7,5,8,6,4,2][i]})),
  Week:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((t,i)=>({t,Received:[62,74,58,81,69,44,38][i],Resolved:[55,66,52,72,64,40,35][i],Pending:[14,18,12,20,15,9,7][i]})),
  Month:Array.from({length:8},(_,i)=>({t:`W${i+1}`,Received:[210,268,234,289,301,255,278,312][i],Resolved:[190,240,220,265,280,238,260,296][i],Pending:[40,52,44,58,55,48,50,44][i]})),
  Year:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((t,i)=>({t,Received:[820,910,880,1020,1180,1240,1310,1290,1150,1080,1220,1360][i],Resolved:[790,880,850,980,1120,1190,1260,1250,1110,1040,1180,1310][i],Pending:[90,110,95,130,150,140,160,145,120,110,135,150][i]})),
  Custom:["01","05","10","15","20","25","30"].map((t,i)=>({t,Received:[45,62,58,71,66,80,74][i],Resolved:[40,55,52,64,60,72,68][i],Pending:[9,13,11,15,12,16,14][i]})),
};
const ACTIVITIES = [
  { name:"Ananya Sharma", id:"#TKT-4821", prio:"High", agent:"Priya Nair", status:"In Progress", when:"2 min ago", action:"replied to", color:"#5B5CEB" },
  { name:"Vikram Patel", id:"#TKT-4818", prio:"Critical", agent:"Rahul Sethi", status:"Escalated", when:"12 min ago", action:"escalated", color:"#EF4444" },
  { name:"Meera Iyer", id:"#TKT-4809", prio:"Medium", agent:"Aisha Khan", status:"Resolved", when:"38 min ago", action:"resolved", color:"#10B981" },
  { name:"Rohan Gupta", id:"#TKT-4802", prio:"Low", agent:"Karan Mehta", status:"Open", when:"1 hr ago", action:"opened", color:"#0EA5E9" },
  { name:"Diya Menon", id:"#TKT-4797", prio:"High", agent:"Sneha Rao", status:"Waiting", when:"2 hr ago", action:"assigned to", color:"#F59E0B" },
];
const DISTRIBUTION = [
  { name:"Technical", value:184, color:"#5B5CEB" }, { name:"Billing", value:126, color:"#0EA5E9" },
  { name:"Internship", value:152, color:"#8B5CF6" }, { name:"Attendance", value:78, color:"#10B981" },
  { name:"Certificate", value:94, color:"#F59E0B" }, { name:"Placement", value:112, color:"#EC4899" },
  { name:"General", value:64, color:"#64748B" },
];
const PERF = [
  { title:"Avg Response Time", sub:"Target under 2h", pct:82, display:"1h 08m", color:"#5B5CEB", icon:Timer },
  { title:"Avg Resolution Time", sub:"Target under 8h", pct:74, display:"5h 24m", color:"#0EA5E9", icon:Gauge },
  { title:"Customer Satisfaction", sub:"CSAT this month", pct:94, display:"94%", color:"#10B981", icon:Smile },
  { title:"First Response SLA", sub:"Compliance rate", pct:88, display:"88%", color:"#F59E0B", icon:ShieldCheck },
  { title:"SLA Breaches", sub:"Down from 11 last wk", pct:16, display:"6", color:"#EF4444", icon:ShieldAlert },
];

const AGENTS = ["Priya Nair", "Rahul Sethi", "Aisha Khan", "Karan Mehta", "Sneha Rao", "Unassigned"];
const CATS = ["Internship","Attendance","Certificate","Placement","Technical","Billing","Account Access","General"];
const DEPTS = ["Student Success","Payments","Tech Support","Placements","Onboarding"];
const SOURCES = ["Email","Chat","WhatsApp","Phone","Portal"];
const RAW = [
  ["Nidhi Maheshwari","Internship start date confirmation","Internship","Critical","New","Email","On track",true,false,false,false],
  ["Jagadish Krishnaa","Course access locked after ₹99 payment","Billing","High","Open","Portal","At risk",false,false,false,false],
  ["Raju Rao","Unable to login to exam portal","Account Access","High","Pending","Chat","On track",true,false,false,false],
  ["Amar Wadwale","Present mark not reflecting in attendance","Attendance","Medium","Open","WhatsApp","On track",false,false,false,false],
  ["Makarand Karangale","Where to find lecture resources","General","Low","Overdue","Email","Breached",false,false,false,false],
  ["Ananya Sharma","Certificate not received after completion","Certificate","High","Open","Portal","At risk",false,false,false,false],
  ["Vikram Patel","Refund for duplicate course charge","Billing","Critical","Pending","Phone","Breached",false,false,false,false],
  ["Meera Iyer","Placement drive eligibility query","Placement","Medium","Resolved","Email","On track",false,false,false,false],
  ["Rohan Gupta","Video lectures not loading on mobile","Technical","Low","Open","Chat","On track",true,false,false,false],
  ["Diya Menon","Offer letter verification pending","Placement","High","New","WhatsApp","At risk",false,false,false,false],
  ["Arjun Reddy","Skill badge missing from profile","Technical","Medium","Open","Portal","On track",false,false,false,false],
  ["Kavya Nair","Batch shift request for training","Internship","Low","Pending","Email","On track",true,false,false,false],
  ["Siddharth Jain","Exam result not showing on dashboard","Technical","High","Overdue","Chat","Breached",false,false,false,false],
  ["Isha Kapoor","Mentor session rescheduling","General","Low","Resolved","Phone","On track",false,false,false,false],
  ["Aditya Rao","GST invoice request for course fee","Billing","Medium","Closed","Email","On track",false,false,false,false],
  ["Nikhil Verma","Bounced mail — mailbox full","General","Low","Open","Email","At risk",false,true,false,false],
  ["Tara Singh","Undelivered result notification","Certificate","Medium","Pending","Email","At risk",false,true,false,false],
  ["Aryan Malhotra","Spam — free crypto internship offer","General","Low","New","Email","On track",false,false,true,false],
  ["Riya Desai","Duplicate ticket for same login issue","Account Access","Low","Closed","Portal","On track",true,false,false,true],
];
const dueTexts = ["in 30 min","in 2 hours","in a day","in 4 hours","overdue by 2h","in 6 hours","tomorrow 10am"];
/* ============================================================================
   STUDENT CONTEXT — structured, AI-ready attributes per customer/ticket
   ========================================================================== */
const STU_ENUMS = {
  registrationStatus: { registered: ["Registered", "g", 1], not_registered: ["Not Registered", "r", 0], pending: ["Registration Pending", "o", 0] },
  examStatus: { not_given: ["Exam Not Given", "x", 0], scheduled: ["Exam Scheduled", "o", 0], completed: ["Exam Completed", "g", 1], failed: ["Exam Failed", "r", 0], passed: ["Exam Passed", "g", 1] },
  projectStatus: { not_started: ["Not Started", "x", 0], in_progress: ["In Progress", "o", 0], submitted: ["Submitted", "b", 0], under_review: ["Under Review", "o", 0], approved: ["Approved", "g", 1], rejected: ["Rejected", "r", 0] },
  refundEligibility: { eligible: ["Refund Eligible", "g", 1], not_eligible: ["Refund Not Eligible", "r", 0], requested: ["Refund Requested", "o", 0], processing: ["Refund Processing", "o", 0], completed: ["Refund Completed", "g", 1] },
  enrollmentStatus: { active: ["Active", "g", 0], completed: ["Completed", "b", 0], on_hold: ["On Hold", "o", 0], cancelled: ["Cancelled", "r", 0], dropped: ["Dropped", "r", 0], expired: ["Expired", "x", 0] },
};
const STU_DOMAINS = ["Data Analytics", "Web Development", "Java Development", "Artificial Intelligence", "Machine Learning", "Cyber Security", "Software Testing", "Full Stack Development", "Python Development", "AWS Cloud", "HR Management"];
const stuMachine = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
const stuDomainLabel = (v) => STU_DOMAINS.find((d) => stuMachine(d) === v) || v;
const stuDateDisplay = (iso) => {
  if (!iso) return "Not Set";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1]} ${y}`;
};
const STU_MONTHS = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

function buildStudentContext(i, t) {
  const domain = stuMachine(t.program);
  const [dd, mon, yy] = (t.startDate || "").split(" ");
  const startIso = mon && STU_MONTHS[mon] ? `${yy}-${STU_MONTHS[mon]}-${String(dd).padStart(2, "0")}` : "";
  const batchCode = t.program.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) + "-B" + ((i % 5) + 12);
  return {
    registrationStatus: t.registered ? "registered" : ["not_registered", "pending"][i % 2],
    domain,
    examStatus: ["completed", "passed", "scheduled", "not_given", "completed", "failed"][i % 6],
    startDate: i % 7 === 6 ? "" : startIso,
    projectStatus: ["submitted", "in_progress", "approved", "not_started", "under_review", "submitted", "rejected"][i % 7],
    refundEligibility: ["eligible", "not_eligible", "requested", "eligible", "processing", "completed"][i % 6],
    batch: batchCode,
    enrollmentStatus: stuMachine(t.planStatus) in STU_ENUMS.enrollmentStatus ? stuMachine(t.planStatus) : "active",
    _meta: {
      examDate: `${(i % 25) + 1} ${["Jul","Aug","Jun"][i % 3]} 2026`,
      examScore: 60 + ((i * 7) % 40),
      domainSelectedOn: `${(i % 27) + 1} ${["May","Jun","Jul"][i % 3]} 2026`,
      refundVerifiedOn: "12 Aug 2026",
    },
  };
}

/* Compact pill descriptors — display text derives from machine values, never the reverse */
function stuPills(ctx) {
  const e = (f) => STU_ENUMS[f][ctx[f]] || ["—", "x", 0];
  const m = ctx._meta || {};
  return [
    { key: "registrationStatus", text: e("registrationStatus")[0], tone: e("registrationStatus")[1], check: e("registrationStatus")[2],
      tip: ["Registration Status", e("registrationStatus")[0], `Enrollment ID linked to this student`] },
    { key: "domain", text: stuDomainLabel(ctx.domain), tone: "b", check: 0,
      tip: ["Selected Domain", stuDomainLabel(ctx.domain), `Selected on: ${m.domainSelectedOn || "—"}`] },
    { key: "examStatus", text: e("examStatus")[0], tone: e("examStatus")[1], check: e("examStatus")[2],
      tip: ["Exam Status", e("examStatus")[0], ...(["completed", "passed", "failed"].includes(ctx.examStatus) ? [`Exam date: ${m.examDate}`, `Score: ${m.examScore}%`] : ctx.examStatus === "scheduled" ? [`Exam date: ${m.examDate}`] : ["No exam attempt recorded yet"])] },
    { key: "batch", text: `Batch: ${stuDateDisplay(ctx.startDate)}`, tone: ctx.startDate ? "b" : "x", check: 0,
      tip: ["Batch", stuDateDisplay(ctx.startDate), ctx.startDate ? "Cohort start date for this student" : "Will be set after batch allocation"] },
    { key: "projectStatus", text: `Project: ${e("projectStatus")[0]}`, tone: e("projectStatus")[1], check: e("projectStatus")[2],
      tip: ["Project Status", e("projectStatus")[0], "Tracked from the student dashboard"] },
    { key: "refundEligibility", text: e("refundEligibility")[0], tone: e("refundEligibility")[1], check: e("refundEligibility")[2],
      tip: ["Refund Eligibility", e("refundEligibility")[0], "Based on: registration date,", "refund policy, project status", `Last verified: ${m.refundVerifiedOn || "—"}`] },
    { key: "enrollmentStatus", text: `Status: ${e("enrollmentStatus")[0]}`, tone: e("enrollmentStatus")[1], check: 0,
      tip: ["Enrollment Status", e("enrollmentStatus")[0], "Overall program standing"] },
  ];
}

const TICKETS = RAW.map((r, i) => {
  const [name, subject, category, priority, status, source, sla, mine, undelivered, spam, trash] = r;
  return {
    id: 336270 - i * 37, name, subject, category, priority, status, source, sla,
    email: name.toLowerCase().replace(/ /g, ".") + "@istudio.in",
    agent: AGENTS[i % AGENTS.length], dept: DEPTS[i % DEPTS.length],
    created: `${["10 minutes","32 minutes","1 hour","2 hours","5 hours","a day","2 days"][i % 7]} ago`,
    createdSort: i, updatedSort: (i * 7) % 19,
    firstResp: dueTexts[i % dueTexts.length], resolution: dueTexts[(i + 3) % dueTexts.length],
    lastActivity: ["just now","5 min ago","20 min ago","1 hr ago","3 hr ago"][i % 5],
    responseStatus: ["Awaiting reply","Agent responded","Customer replied"][i % 3],
    mine, undelivered, spam, trash, unresolved: !["Resolved","Closed"].includes(status),
    // contact + internship profile
    phone: `+91 ${90000 + i * 137} ${10000 + i * 913}`,
    registered: i % 4 !== 3,
    enrollId: `IS-2026-${4821 + i * 17}`,
    program: ["Data Analytics","Full Stack Development","Cyber Security","Python Development","AWS Cloud","HR Management"][i % 6],
    batch: `Batch ${(i % 5) + 12} · ${["Jan","Feb","Mar","Apr","May"][i % 5]} 2026`,
    mentor: ["Priya Nair","Rahul Sethi","Aisha Khan","Karan Mehta"][i % 4],
    startDate: `${(i % 27) + 1} ${["Jan","Feb","Mar","Apr","May","Jun"][i % 6]} 2026`,
    duration: ["4 weeks","6 weeks","8 weeks","12 weeks"][i % 4],
    progress: [82, 45, 100, 67, 23, 91][i % 6],
    planStatus: ["Active","Active","Completed","Active","On Hold","Active"][i % 6],
    college: ["MIT Pune","COEP Pune","VIT Vellore","SPPU Ahmednagar","NIT Nagpur"][i % 5],
    joined: ["3 months ago","6 months ago","1 year ago","2 weeks ago"][i % 4],
    totalTickets: 2 + (i % 7),
    // conversation + reply indicators
    custReplied: i % 3 === 0,
    newReplies: i % 3 === 0 ? 1 + (i % 3) : 0,
    repliedAgo: ["12 minutes ago", "35 minutes ago", "2 hours ago", "yesterday"][i % 4],
    attachments: i % 4 === 0 ? [["screenshot.png", "receipt.pdf"][i % 2]] : [],
    tags: [["Urgent", "VIP"], ["Refund"], ["Escalated"], []][i % 4],
    get studentContext() { return this._sc || (this._sc = buildStudentContext(i, this)); },
    set studentContext(v) { this._sc = v; },
    convo: [
      { who: "agent", msg: `Hello ${name.split(" ")[0]}, we've received your request about "${subject.toLowerCase()}" and are looking into it now.`, at: "17 Jul, 3:20 pm", att: false },
      { who: "cust", msg: "Thank you. Please let me know once it's updated — I need this sorted before my next session.", at: "17 Jul, 4:05 pm", att: i % 4 === 0 },
      { who: "agent", msg: "We've forwarded your request to the academic team and flagged it as priority.", at: "18 Jul, 10:12 am", att: false },
      { who: "cust", msg: "Any update on this? It's been a while and I haven't heard back.", at: "18 Jul, 2:48 pm", att: false },
    ].slice(0, 3 + (i % 2)),
  };
});
/* re-apply agent edits to student context (persisted across sessions) */
try {
  const _savedCtx = JSON.parse(kvGetSync("hh-student-ctx") || "{}");
  TICKETS.forEach((t) => { if (_savedCtx[t.id]) t.studentContext = { ...t.studentContext, ..._savedCtx[t.id] }; });
} catch (e) {}

/* ============================================================================
   CALLER / TELEPHONY — mock call data, AI-ready schema
   ========================================================================== */
const CALL_TYPES = ["Incoming", "Outgoing", "Missed", "Voicemail", "Callback"];
const CALL_STATUS = ["Ringing", "Answered", "Missed", "Rejected", "Completed", "Voicemail"];
const CALL_TYPE_META = {
  Incoming:  { icon: "PhoneIncoming", tone: "g", color: "#22C55E" },
  Outgoing:  { icon: "PhoneOutgoing", tone: "b", color: "#0EA5E9" },
  Missed:    { icon: "PhoneMissed",   tone: "r", color: "#EF4444" },
  Voicemail: { icon: "Voicemail",     tone: "o", color: "#F59E0B" },
  Callback:  { icon: "PhoneForwarded",tone: "b", color: "#8B5CF6" },
};
const fmtDur = (sec) => sec == null ? "—" : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
const AGENT_POOL = ["Priya Nair", "Rahul Sethi", "Aisha Khan", "Karan Mehta", "Sneha Rao"];

const VOICEMAIL_TRANSCRIPTS = [
  "Hello, I am calling to know when my internship will start. I finished my exam last week.",
  "Hi, I submitted my project but the dashboard still shows it as pending. Please check.",
  "I wanted to ask about the refund process. I am not able to continue the program.",
  "My certificate has not been issued yet even though I completed everything. Kindly help.",
  "Please call me back regarding my batch allocation, I have not received any email.",
];

function seedCalls() {
  const days = ["Today", "Today", "Today", "Yesterday", "Yesterday", "2 days ago", "3 days ago"];
  const times = ["10:42 AM", "10:15 AM", "9:58 AM", "3:22 PM", "3:15 PM", "1:04 PM", "11:37 AM", "5:48 PM", "2:26 PM", "8:12 AM"];
  const calls = [];
  let n = 0;
  // derive callers from real tickets so numbers match student profiles
  const students = TICKETS.slice(0, 16);
  for (let i = 0; i < 60; i++) {
    const known = i % 5 !== 4; // ~80% registered
    const stu = students[i % students.length];
    const type = CALL_TYPES[i % 5 === 0 ? 2 : i % 7 === 3 ? 3 : i % 3 === 0 ? 1 : 0]; // mix, weighted to incoming
    const answered = type === "Incoming" || type === "Outgoing" || type === "Callback";
    const status = type === "Missed" ? "Missed" : type === "Voicemail" ? "Voicemail" : (i % 11 === 0 ? "Rejected" : (answered ? (i % 2 ? "Answered" : "Completed") : "Missed"));
    const duration = ["Missed", "Rejected", "Voicemail"].includes(status) ? (type === "Voicemail" ? 60 + (i * 7) % 90 : 0) : 45 + (i * 37) % 600;
    const dayIdx = Math.min(days.length - 1, Math.floor(i / 9));
    calls.push({
      callId: `CALL-${20260 + i}`,
      phoneNumber: known ? stu.phone : `+91 9${(700000000 + i * 137911).toString().slice(0, 9)}`,
      customerId: known ? stu.id : null,
      customerName: known ? stu.name : "Unknown Caller",
      email: known ? stu.email : "",
      agentId: answered ? AGENT_POOL[i % AGENT_POOL.length] : null,
      agent: answered ? AGENT_POOL[i % AGENT_POOL.length] : "—",
      callType: type,
      status,
      day: days[dayIdx],
      time: times[i % times.length],
      startTime: Date.now() - i * 3.4e6,
      duration,
      recordingUrl: answered && status !== "Rejected" && i % 3 !== 0 ? `#rec/${20260 + i}` : null,
      voicemailUrl: type === "Voicemail" ? `#vm/${20260 + i}` : null,
      transcription: type === "Voicemail" ? VOICEMAIL_TRANSCRIPTS[i % VOICEMAIL_TRANSCRIPTS.length] : null,
      transcriptionStatus: type === "Voicemail" ? "completed" : "none",
      ticketId: known && i % 4 === 0 ? stu.id : null,
      notes: answered && i % 5 === 0 ? "Student asked about internship start date. Confirmed batch start. No follow-up required." : "",
      callbackStatus: type === "Missed" ? ["Pending", "Pending", "Completed", "Rescheduled", "Unreachable"][i % 5] : null,
      // AI-ready structured slot (populated later by an AI service)
      ai: { intent: null, sentiment: null, priority: null, summary: null, category: null },
      createdAt: Date.now() - i * 3.4e6,
    });
    n++;
  }
  return calls;
}
const CALLS_SEED = seedCalls();

function callStats(calls) {
  const s = { total: calls.length, incoming: 0, outgoing: 0, missed: 0, answered: 0, voicemail: 0, rejected: 0, dur: 0, durCount: 0, callbacks: 0 };
  const uniq = new Set();
  calls.forEach((c) => {
    uniq.add(c.phoneNumber);
    if (c.callType === "Incoming") s.incoming++;
    if (c.callType === "Outgoing") s.outgoing++;
    if (c.callType === "Missed") s.missed++;
    if (c.callType === "Voicemail") s.voicemail++;
    if (c.callType === "Callback") s.callbacks++;
    if (["Answered", "Completed"].includes(c.status)) { s.answered++; s.dur += c.duration; s.durCount++; }
    if (c.status === "Rejected") s.rejected++;
    if (c.callbackStatus === "Pending") s.callbacks++;
  });
  s.unique = uniq.size;
  s.avgDur = s.durCount ? Math.round(s.dur / s.durCount) : 0;
  s.talkTime = s.dur;
  return s;
}
const isOpen = (t) => t.status === "Open" || t.status === "New";
const VIEWS = [
  { key:"all", label:"All Tickets", icon:Inbox, f:(t)=>!t.trash && !t.spam },
  { key:"unresolved", label:"All Unresolved Tickets", icon:TicketIcon, f:(t)=>t.unresolved && !t.trash && !t.spam },
  { key:"undelivered", label:"All Undelivered Messages", icon:MailWarning, f:(t)=>t.undelivered },
  { key:"open", label:"Open Tickets", icon:Activity, f:(t)=>isOpen(t) && !t.trash && !t.spam },
  { key:"closed", label:"Closed Tickets", icon:CheckCheck, f:(t)=>t.status === "Closed" && !t.trash && !t.spam },
  { key:"mine", label:"Tickets I Raised", icon:UserCheck, f:(t)=>t.mine && !t.trash && !t.spam },
  { key:"trash", label:"Trash", icon:Trash, f:(t)=>t.trash },
  { key:"spam", label:"Spam", icon:ShieldX, f:(t)=>t.spam },
];

/* ============================================================================
   SHARED CHROME
   ========================================================================== */
const NAV = [
  { icon:LayoutDashboard, label:"Dashboard", route:"home" },
  { icon:Gauge, label:"My Dashboard", route:"agentdash" },
  { icon:Ticket, label:"Tickets", route:"tickets", badge:"47" },
  { icon:Users, label:"Customers", route:"customers" },
  { icon:PhoneCall, label:"Caller", route:"caller" }, { icon:BookOpen, label:"Knowledge Base", href:"https://dashboard.tawk.to/#/knowledgebase/610113a8d6e7610a49ad5a1e/articles" },
  { icon:BarChart3, label:"Reports", route:"reports" }, { icon:Bot, label:"Automation", route:"automation" },
  { icon:Settings, label:"Settings", route:"settings" },
];
function Sidebar({ open, route, go, collapsed, setCollapsed }) {
  const item = (it) => (
    it.href ? (
      <a key={it.label} href={it.href} target="_blank" rel="noopener noreferrer"
         className="nav-item" data-label={it.label} style={{ textDecoration: "none" }}>
        <it.icon size={18} /> <span className="lbl">{it.label}</span>{it.badge && <span className="badge">{it.badge}</span>}
      </a>
    ) : (
      <div key={it.label} className={`nav-item ${route === it.route ? "active" : ""}`} data-label={it.label}
           onClick={() => it.route && go(it.route)}>
        <it.icon size={18} /> <span className="lbl">{it.label}</span>{it.badge && <span className="badge">{it.badge}</span>}
      </div>
    )
  );
  return (
    <aside className={`sidebar ${open ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
      {/* No brand/logo block — the admin panel's own header already brands the page. */}
      <nav className="nav">
        <span className="nav-label">Workspace</span>
        {NAV.slice(0, 6).map(item)}
        <span className="nav-label">Organization</span>
        {NAV.slice(6).map(item)}
      </nav>
      <div className="side-foot">
        <div className="side-card"><h5>Upgrade to Pro</h5><p>Unlock automations, SLA reports and unlimited agents.</p><button>View plans</button></div>
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} title={collapsed ? "Show workspace" : "Hide workspace"}>
          {collapsed ? <ChevronsLeft size={16} /> : <ChevronsRight size={16} />}<span className="lbl">Hide workspace</span>
        </button>
      </div>
    </aside>
  );
}
/* ============================================================================
   DASHBOARD INTERACTIVITY — toasts, data, services, modals, panels
   ========================================================================== */
function useClickAway(ref, cb) {
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) cb(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, cb]);
}

const ToastCtx = createContext(() => {});
const useToast = () => useContext(ToastCtx);
function ToastHost({ toasts, dismiss }) {
  const MAP = {
    success: { c: "var(--success)", icon: CheckCircle2 },
    error: { c: "var(--danger)", icon: XCircle },
    info: { c: "var(--primary)", icon: Info },
    warning: { c: "var(--warning)", icon: AlertTriangle },
  };
  return (
    <div className="toast-host">
      {toasts.map((t) => { const m = MAP[t.type] || MAP.info; return (
        <div className="toast" key={t.id} style={{ borderLeftColor: m.c }}>
          <span className="tc" style={{ color: m.c }}><m.icon size={18} /></span>
          <div style={{ minWidth: 0 }}><div className="tt">{t.title}</div>{t.desc && <div className="td">{t.desc}</div>}</div>
          <button className="tx" onClick={() => dismiss(t.id)}><X size={15} /></button>
        </div>
      ); })}
    </div>
  );
}

const TICKET_CATS = ["Internship","Attendance","Certificate","Placement","Technical","Billing","Account Access","General"];
const NOTIFS_SEED = [
  { id:1, icon:UserPlus, color:"#5B5CEB", title:"New ticket assigned", desc:"#336270 “Internship start date confirmation” was assigned to you.", when:"2 min ago", read:false },
  { id:2, icon:ShieldAlert, color:"#EF4444", title:"SLA breach warning", desc:"#335565 is 30 min from breaching its first-response SLA.", when:"18 min ago", read:false },
  { id:3, icon:AlertTriangle, color:"#F59E0B", title:"Ticket overdue", desc:"#336011 resolution is overdue by 2 hours.", when:"40 min ago", read:false },
  { id:4, icon:MessageCircle, color:"#0EA5E9", title:"Customer replied", desc:"Ananya Sharma replied on #336085.", when:"1 hr ago", read:false },
  { id:5, icon:Mail, color:"#8B5CF6", title:"New email received", desc:"A new support email created ticket #336267.", when:"2 hr ago", read:true },
  { id:6, icon:Zap, color:"#10B981", title:"Automation triggered", desc:"“Auto-close Thank-You emails” resolved #336122.", when:"3 hr ago", read:true },
  { id:7, icon:ArrowUp, color:"#EF4444", title:"Ticket escalated", desc:"#336044 was escalated to the support lead.", when:"5 hr ago", read:true },
];
const ACTIVITY_FEED = [
  { type:"Ticket Created", icon:PlusCircle, color:"#5B5CEB", tid:"#336270", cust:"Nidhi Maheshwari", action:"created a new ticket", agent:"System", when:"2 min ago", dt:"18 Jul 2026, 03:10 pm" },
  { type:"Ticket Assigned", icon:UserPlus, color:"#0EA5E9", tid:"#336267", cust:"Jagadish Krishnaa", action:"assigned to Priya Nair", agent:"Admin", when:"12 min ago", dt:"18 Jul 2026, 03:00 pm" },
  { type:"Customer Replied", icon:MessageCircle, color:"#8B5CF6", tid:"#336085", cust:"Ananya Sharma", action:"sent a reply", agent:"—", when:"22 min ago", dt:"18 Jul 2026, 02:50 pm" },
  { type:"Ticket Replied", icon:Reply, color:"#10B981", tid:"#336258", cust:"Raju Rao", action:"replied via email", agent:"Aisha Khan", when:"35 min ago", dt:"18 Jul 2026, 02:37 pm" },
  { type:"Ticket Escalated", icon:ArrowUp, color:"#EF4444", tid:"#336044", cust:"Amar Wadwale", action:"escalated the ticket", agent:"Rahul Sethi", when:"1 hr ago", dt:"18 Jul 2026, 02:12 pm" },
  { type:"Email Sent", icon:Send, color:"#0EA5E9", tid:"#336122", cust:"Vikram Patel", action:"sent a confirmation email", agent:"Sneha Rao", when:"2 hr ago", dt:"18 Jul 2026, 01:05 pm" },
  { type:"Ticket Closed", icon:CheckCheck, color:"#10B981", tid:"#335998", cust:"Meera Iyer", action:"closed the ticket", agent:"Karan Mehta", when:"3 hr ago", dt:"18 Jul 2026, 12:20 pm" },
  { type:"Email Received", icon:Mail, color:"#5B5CEB", tid:"#335880", cust:"Diya Menon", action:"new inbound email", agent:"System", when:"4 hr ago", dt:"18 Jul 2026, 11:40 am" },
  { type:"Ticket Reopened", icon:RotateCcw, color:"#F59E0B", tid:"#335565", cust:"Makarand Karangale", action:"reopened the ticket", agent:"Priya Nair", when:"5 hr ago", dt:"18 Jul 2026, 10:30 am" },
  { type:"Agent Logged In", icon:LogIn, color:"#64748B", tid:"—", cust:"—", action:"Aisha Khan signed in", agent:"Aisha Khan", when:"6 hr ago", dt:"18 Jul 2026, 09:15 am" },
];

/* ---- export / analytics services ---- */
function downloadBlob(data, filename, mime) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function buildExportRows() {
  return TICKETS.map((t) => ({
    "Ticket Number": t.id, "Customer Name": t.name, "Email": t.email, "Phone": t.phone,
    "Subject": t.subject, "Category": t.category, "Priority": t.priority, "Status": t.status,
    "Assigned Agent": t.agent, "Created": t.created,
    "Closed Date": ["Resolved","Closed"].includes(t.status) ? "18 Jul 2026" : "—",
    "Resolution Time": ["Resolved","Closed"].includes(t.status) ? "5h 24m" : "—",
    "SLA Status": t.sla, "Source": t.source, "Department": t.dept,
  }));
}
/* async because SheetJS is fetched on demand. Never rejects — callers fire and forget,
   so a failed CDN load returns false instead of surfacing an unhandled rejection. */
async function exportExcel(rows, filename) {
  try {
    const XLSX = await loadXLSX();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0] || {}).map((k) => ({ wch: Math.max(12, k.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tickets");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(out, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return true;
  } catch {
    return false;
  }
}
function exportCSV(rows, filename) {
  const cols = Object.keys(rows[0] || {});
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  downloadBlob("\uFEFF" + csv, filename, "text/csv;charset=utf-8");
}
function exportPDF(title, columns, rows) {
  const head = columns.map((c) => `<th>${c}</th>`).join("");
  const body = rows.map((r) => `<tr>${columns.map((c) => `<td>${r[c] ?? ""}</td>`).join("")}</tr>`).join("");
  const html = `<!doctype html><html><head><title>${title}</title><meta charset="utf-8"/>
    <style>body{font-family:Inter,Arial,sans-serif;color:#1A1D29;padding:28px}
    h1{font-size:20px;margin:0 0 4px}.sub{color:#6B7280;font-size:12px;margin-bottom:18px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#5B5CEB;color:#fff;text-align:left;padding:7px 8px}
    td{padding:6px 8px;border-bottom:1px solid #E9EBF2}
    tr:nth-child(even) td{background:#F8F9FC}</style></head>
    <body>${(()=>{try{const l=localStorage.getItem("hh-logo");return l?`<img src="${l}" style="height:40px;margin-bottom:10px;border-radius:8px"/>`:""}catch(e){return ""}})()}<h1>${title}</h1><div class="sub">HelpHive · Internship Studio · Generated ${new Date().toLocaleString("en-IN")}</div>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    <script>window.onload=()=>{window.print();}</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html); w.document.close(); return true;
}
function computeAnalytics() {
  const total = TICKETS.length;
  const cnt = (f) => TICKETS.filter(f).length;
  const grp = (key) => {
    const m = {}; TICKETS.forEach((t) => { m[t[key]] = (m[t[key]] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  };
  const resolved = cnt((t) => t.status === "Resolved");
  const closed = cnt((t) => t.status === "Closed");
  return {
    total, open: cnt((t) => t.status === "Open"), closed, resolved,
    pending: cnt((t) => t.status === "Pending"),
    overdue: cnt((t) => t.status === "Overdue" || t.sla === "Breached"),
    isNew: cnt((t) => t.status === "New"),
    resolutionRate: Math.round(((resolved + closed) / total) * 100),
    slaCompliance: Math.round((cnt((t) => t.sla === "On track") / total) * 100),
    csat: 94, avgResp: "1h 08m", avgRes: "5h 24m",
    today: 6, week: 14, month: total,
    byCategory: grp("category").sort((a, b) => b.value - a.value),
    byPriority: ["Critical","High","Medium","Low"].map((p) => ({ name: p, value: cnt((t) => t.priority === p), color: prioColor[p] })),
    byAgent: grp("agent").sort((a, b) => b.value - a.value),
  };
}

function Spinner({ size = 16 }) { return <Loader2 size={size} className="spin" />; }
function EmptyState({ icon: Ic = Inbox, title, desc, action, onAction }) {
  return (
    <div className="empty">
      <span className="eic"><Ic size={26} /></span>
      <h4>{title}</h4>{desc && <p>{desc}</p>}
      {action && <button className="btn btn-primary btn-sm" onClick={onAction}>{action}</button>}
    </div>
  );
}
function AttachField({ files, setFiles }) {
  const ref = useRef(null);
  return (
    <div className="fld">
      <label>Attachments</label>
      <div className="dropzone" onClick={() => ref.current?.click()}>
        <Paperclip size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} /> Click to attach files
        <input ref={ref} type="file" multiple hidden onChange={(e) => setFiles([...files, ...Array.from(e.target.files).map((f) => f.name)])} />
      </div>
      {files.length > 0 && <div>{files.map((f, i) => (<span className="file-pill" key={i}>{f}<button onClick={() => setFiles(files.filter((_, j) => j !== i))}><X size={12} /></button></span>))}</div>}
    </div>
  );
}

/* ---- global search ---- */
function GlobalSearch({ onOpen }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  useClickAway(ref, () => setOpen(false));
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return TICKETS.filter((t) => [t.id, t.name, t.email, t.phone, t.subject, t.category, t.agent].join(" ").toLowerCase().includes(term)).slice(0, 8);
  }, [q]);
  useEffect(() => setHi(0), [q]);
  const choose = (t) => { onOpen(t); setQ(""); setOpen(false); };
  const onKey = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && results[hi]) { choose(results[hi]); }
    else if (e.key === "Escape") setOpen(false);
  };
  return (
    <div className="search-wrap" ref={ref}>
      <div className="searchbox" style={{ maxWidth: "none" }}>
        <Search size={17} />
        <input placeholder="Search tickets, customers, phone, email…" value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey} />
        <kbd>⌘K</kbd>
      </div>
      {open && q.trim() && (
        <div className="search-results">
          {results.length ? (<>
            <div className="sr-lab">{results.length} result{results.length > 1 ? "s" : ""}</div>
            {results.map((t, i) => (
              <div key={t.id} className={`sresult ${i === hi ? "hi" : ""}`} onMouseEnter={() => setHi(i)} onClick={() => choose(t)}>
                <span className="sa" style={{ background: avColor(t.name) }}>{initials(t.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="snm">{t.subject}</div>
                  <div className="smeta"><span>{t.name}</span><span>#{t.id}</span><span>{t.category}</span><span>{t.agent}</span></div>
                </div>
                <span className="badge-pill" style={{ marginLeft: "auto", ...(() => { const c = statusStyle(t.status); return { background: c.bg, color: c.fg }; })() }}>{t.status}</span>
              </div>
            ))}
          </>) : <EmptyState icon={Search} title="No tickets found" desc={`Nothing matches “${q}”. Try a name, email, phone or ticket number.`} />}
        </div>
      )}
    </div>
  );
}

/* ---- New ticket modal ---- */
function TicketModal({ open, onClose }) {
  const push = useToast();
  const [f, setF] = useState({ name: "", email: "", phone: "", subject: "", desc: "", cat: "Internship", prio: "Medium", agent: "Unassigned" });
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  if (!open) return null;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    if (!f.name || !f.email || !f.subject) { push({ type: "error", title: "Missing details", desc: "Name, email and subject are required." }); return; }
    setSaving(true);
    setTimeout(() => { setSaving(false); onClose(); push({ type: "success", title: "Ticket created", desc: `“${f.subject}” added and assigned to ${f.agent}.` }); }, 700);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB", width: 32, height: 32 }}><Ticket size={16} /></span>New Ticket</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <div className="grid2">
            <div className="fld"><label>Customer Name *</label><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Ananya Sharma" /></div>
            <div className="fld"><label>Email *</label><input value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@email.com" /></div>
            <div className="fld"><label>Phone Number</label><input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 …" /></div>
            <div className="fld"><label>Category</label><select value={f.cat} onChange={(e) => set("cat", e.target.value)}>{TICKET_CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div className="fld"><label>Subject *</label><input value={f.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Short summary of the issue" /></div>
          <div className="fld"><label>Description</label><textarea value={f.desc} onChange={(e) => set("desc", e.target.value)} placeholder="Describe the issue in detail…" /></div>
          <div className="grid2">
            <div className="fld"><label>Priority</label><select value={f.prio} onChange={(e) => set("prio", e.target.value)}>{["Low","Medium","High","Critical"].map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="fld"><label>Assigned Agent</label><select value={f.agent} onChange={(e) => set("agent", e.target.value)}>{AGENTS.map((a) => <option key={a}>{a}</option>)}</select></div>
          </div>
          <AttachField files={files} setFiles={setFiles} />
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? <><Spinner /> Saving…</> : <><Check size={15} /> Save Ticket</>}</button></div>
      </div>
    </div>
  );
}

/* ---- Compose email modal ---- */
function EmailComposeModal({ open, onClose, to = "" }) {
  const push = useToast();
  const [f, setF] = useState({ to, cc: "", bcc: "", subject: "", body: "" });
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  if (!open) return null;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const send = () => {
    if (!f.to || !f.subject) { push({ type: "error", title: "Missing details", desc: "A recipient and subject are required." }); return; }
    setSending(true);
    setTimeout(() => { setSending(false); onClose(); push({ type: "success", title: "Email sent", desc: `Your email to ${f.to} has been sent.` }); }, 700);
  };
  const draft = () => { onClose(); push({ type: "info", title: "Saved as draft", desc: "Your email was saved to drafts." }); };
  const RTE = [Bold, Italic, Underline, Heading1, List, ListOrdered, Link2, ImageIcon];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#0EA5E918", color: "#0EA5E9", width: 32, height: 32 }}><Mail size={16} /></span>New Email</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <div className="fld"><label>To *</label><input value={f.to} onChange={(e) => set("to", e.target.value)} placeholder="recipient@email.com" /></div>
          <div className="grid2">
            <div className="fld"><label>Cc</label><input value={f.cc} onChange={(e) => set("cc", e.target.value)} placeholder="cc@email.com" /></div>
            <div className="fld"><label>Bcc</label><input value={f.bcc} onChange={(e) => set("bcc", e.target.value)} placeholder="bcc@email.com" /></div>
          </div>
          <div className="fld"><label>Subject *</label><input value={f.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Email subject" /></div>
          <div className="fld"><label>Message</label>
            <div className="rte" style={{ border: "1px solid var(--border)", borderRadius: "10px 10px 0 0", borderBottom: 0 }}>{RTE.map((Ic, i) => <button key={i} type="button"><Ic size={16} /></button>)}</div>
            <textarea style={{ borderRadius: "0 0 10px 10px", minHeight: 150 }} value={f.body} onChange={(e) => set("body", e.target.value)} placeholder="Write your message…" />
          </div>
          <AttachField files={files} setFiles={setFiles} />
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={draft}>Save as Draft</button><button className="btn btn-primary btn-sm" onClick={send} disabled={sending}>{sending ? <><Spinner /> Sending…</> : <><Send size={15} /> Send Email</>}</button></div>
      </div>
    </div>
  );
}

/* ---- Assign dialog ---- */
function AssignDialog({ open, onClose }) {
  const push = useToast();
  const [tid, setTid] = useState(TICKETS[0].id);
  const [agent, setAgent] = useState("Priya Nair");
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const assign = () => { setBusy(true); setTimeout(() => { setBusy(false); onClose(); push({ type: "success", title: "Ticket assigned", desc: `#${tid} assigned to ${agent}.` }); }, 600); };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#0EA5E918", color: "#0EA5E9", width: 32, height: 32 }}><UserPlus size={16} /></span>Assign Ticket</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <div className="fld"><label>Select Ticket</label><select value={tid} onChange={(e) => setTid(Number(e.target.value))}>{TICKETS.slice(0, 12).map((t) => <option key={t.id} value={t.id}>#{t.id} — {t.subject}</option>)}</select></div>
          <div className="fld"><label>Assign to Agent</label><select value={agent} onChange={(e) => setAgent(e.target.value)}>{AGENTS.filter((a) => a !== "Unassigned").map((a) => <option key={a}>{a}</option>)}</select></div>
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" onClick={assign} disabled={busy}>{busy ? <><Spinner /> Assigning…</> : <><UserCheck size={15} /> Assign</>}</button></div>
      </div>
    </div>
  );
}

/* ---- Analytics modal ---- */
function AnalyticsModal({ open, onClose }) {
  const push = useToast();
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (open) { setLoading(true); const t = setTimeout(() => setLoading(false), 700); return () => clearTimeout(t); } }, [open]);
  const A = useMemo(computeAnalytics, []);
  if (!open) return null;
  const kpis = [
    ["Total Tickets", A.total], ["Open", A.open], ["Closed", A.closed], ["Pending", A.pending],
    ["Overdue", A.overdue], ["Resolution Rate", A.resolutionRate + "%"], ["Avg Response", A.avgResp], ["Avg Resolution", A.avgRes],
    ["CSAT", A.csat + "%"], ["SLA Compliance", A.slaCompliance + "%"], ["Received Today", A.today], ["This Month", A.month],
  ];
  const doExcel = async () => {
    try {
      const XLSX = await loadXLSX();
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpis.map(([k, v]) => ({ Metric: k, Value: v }))), "Summary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(A.byCategory.map((c) => ({ Category: c.name, Tickets: c.value }))), "By Category");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(A.byAgent.map((c) => ({ Agent: c.name, Tickets: c.value }))), "By Agent");
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      downloadBlob(out, "helphive-analytics.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      push({ type: "success", title: "Analytics exported", desc: "helphive-analytics.xlsx downloaded." });
    } catch (e) { push({ type: "error", title: "Export failed", desc: "Could not generate the file." }); }
  };
  const doPDF = () => {
    const ok = exportPDF("Support Analytics Report", ["Metric", "Value"], kpis.map(([k, v]) => ({ Metric: k, Value: v })));
    push(ok ? { type: "success", title: "Opening print dialog", desc: "Choose “Save as PDF”." } : { type: "error", title: "Popup blocked", desc: "Allow popups to export PDF." });
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB", width: 32, height: 32 }}><BarChart3 size={16} /></span>Support Analytics</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn btn-soft btn-sm" onClick={doExcel}><FileSpreadsheet size={14} /> Excel</button>
            <button className="btn btn-soft btn-sm" onClick={doPDF}><FileText size={14} /> PDF</button>
            <button className="icon-btn" onClick={onClose}><X size={17} /></button>
          </div>
        </div>
        <div className="modal-body">
          {loading ? <div style={{ padding: "60px", display: "grid", placeItems: "center", color: "var(--muted)", gap: 12 }}><Spinner size={30} /><span style={{ fontSize: 13, fontWeight: 600 }}>Crunching ticket data…</span></div> : (<>
            <div className="an-kpis">{kpis.map(([k, v]) => (<div className="an-kpi" key={k}><div className="v">{typeof v === "number" ? v.toLocaleString("en-IN") : v}</div><div className="l">{k}</div></div>))}</div>
            <div style={{ marginTop: 16 }}>
              <div className="prog-line"><div className="pl"><span>Resolution Rate</span><span style={{ color: "var(--primary)" }}>{A.resolutionRate}%</span></div><div className="pb"><i style={{ width: A.resolutionRate + "%", background: "var(--primary)" }} /></div></div>
              <div className="prog-line"><div className="pl"><span>SLA Compliance</span><span style={{ color: "var(--success)" }}>{A.slaCompliance}%</span></div><div className="pb"><i style={{ width: A.slaCompliance + "%", background: "var(--success)" }} /></div></div>
              <div className="prog-line"><div className="pl"><span>Customer Satisfaction</span><span style={{ color: "var(--accent)" }}>{A.csat}%</span></div><div className="pb"><i style={{ width: A.csat + "%", background: "var(--accent)" }} /></div></div>
            </div>
            <div className="an-charts">
              <div className="card card-pad"><h4 className="card-title" style={{ marginBottom: 10 }}>Tickets by Category</h4>
                <div style={{ height: 200 }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={A.byCategory} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="none">{A.byCategory.map((d, i) => <Cell key={i} fill={DISTRIBUTION[i % DISTRIBUTION.length].color} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart></ResponsiveContainer></div>
              </div>
              <div className="card card-pad"><h4 className="card-title" style={{ marginBottom: 10 }}>Tickets by Priority</h4>
                <div style={{ height: 200 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={A.byPriority} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--hover)" }} /><Bar dataKey="value" name="Tickets" radius={[7, 7, 0, 0]} maxBarSize={46}>{A.byPriority.map((d, i) => <Cell key={i} fill={d.color} />)}</Bar></BarChart></ResponsiveContainer></div>
              </div>
              <div className="card card-pad" style={{ gridColumn: "1 / -1" }}><h4 className="card-title" style={{ marginBottom: 10 }}>Received vs Resolved (this week)</h4>
                <div style={{ height: 220 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={ANALYTICS.Week} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}><CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} /><XAxis dataKey="t" tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12.5 }} /><Line type="monotone" dataKey="Received" stroke="#5B5CEB" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="Resolved" stroke="#10B981" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div>
              </div>
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}

/* ---- Recent activities drawer ---- */
function RecentActivitiesDrawer({ open, onClose }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  if (!open) return null;
  const types = ["All", "Ticket Created", "Ticket Replied", "Ticket Closed", "Email Sent", "Ticket Escalated"];
  const rows = ACTIVITY_FEED.filter((a) => (filter === "All" || a.type === filter) && (a.type + a.cust + a.tid + a.action).toLowerCase().includes(q.toLowerCase()));
  return (<>
    <div className="drawer-overlay" onClick={onClose} />
    <div className="drawer">
      <div className="drawer-head"><h3 className="card-title"><Activity size={16} style={{ verticalAlign: "-3px", marginRight: 7, color: "var(--primary)" }} />Recent Activities</h3><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
      <div style={{ padding: "14px 20px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="searchbox" style={{ maxWidth: "none" }}><Search size={15} /><input placeholder="Search activities…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="chips">{types.map((t) => <button key={t} className={`fchip ${filter === t ? "on" : ""}`} onClick={() => setFilter(t)}>{t}</button>)}</div>
      </div>
      <div className="drawer-body" style={{ paddingTop: 6 }}>
        {rows.length ? rows.map((a, i) => (
          <div className="act-item" key={i}>
            <span className="ai" style={{ background: `${a.color}18`, color: a.color }}><a.icon size={17} /></span>
            <div style={{ minWidth: 0 }}>
              <div className="at"><b>{a.agent !== "—" && a.agent !== "System" ? a.agent : a.cust}</b> {a.action}{a.tid !== "—" && <> · <b style={{ color: "var(--primary)" }}>{a.tid}</b></>}</div>
              <div className="am"><span className="badge-pill" style={{ background: `${a.color}14`, color: a.color }}>{a.type}</span>{a.cust !== "—" && <span>{a.cust}</span>}<span>·</span><span>{a.when}</span><span style={{ color: "var(--faint)" }}>({a.dt})</span></div>
            </div>
          </div>
        )) : <EmptyState icon={Activity} title="No activities" desc="Nothing matches your search or filter." />}
      </div>
    </div>
  </>);
}

/* ---- Notifications panel ---- */
function NotificationPanel({ notifs, setNotifs, onClose }) {
  const ref = useRef(null);
  useClickAway(ref, onClose);
  const unread = notifs.filter((n) => !n.read).length;
  return (
    <div className="notif-panel" ref={ref}>
      <div className="np-head"><h4><Bell size={16} /> Notifications {unread > 0 && <span className="unread-count">{unread} new</span>}</h4>
        <button className="btn btn-soft btn-sm" onClick={() => setNotifs((ns) => ns.map((n) => ({ ...n, read: true })))}><CheckCheck size={14} /> Mark all read</button></div>
      <div className="np-body">
        {notifs.length ? notifs.map((n) => (
          <div className={`notif-item ${n.read ? "" : "unread"}`} key={n.id}>
            <span className="ni" style={{ background: `${n.color}18`, color: n.color }}><n.icon size={17} /></span>
            <div style={{ minWidth: 0, flex: 1 }} onClick={() => setNotifs((ns) => ns.map((x) => x.id === n.id ? { ...x, read: true } : x))}>
              <div className="nt">{n.title}</div><div className="nd">{n.desc}</div><div className="nw">{n.when}</div>
            </div>
            {!n.read && <span className="unread-dot" />}
            <button className="ndel" title="Delete" onClick={() => setNotifs((ns) => ns.filter((x) => x.id !== n.id))}><Trash2 size={13} /></button>
          </div>
        )) : <EmptyState icon={Bell} title="No notifications" desc="You're all caught up." />}
      </div>
      <div className="np-foot"><button className="btn btn-soft btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => setNotifs([])}>Clear all</button><button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }}>View all</button></div>
    </div>
  );
}

/* ---- Recent tickets table (dashboard) ---- */
function RecentTicketsTable({ onOpen, go }) {
  const rows = TICKETS.slice(0, 6);
  return (
    <div className="card fade" style={{ marginTop: 22, animationDelay: "260ms" }}>
      <div className="section-head" style={{ padding: "18px 20px 0", marginBottom: 12 }}>
        <div><h3 className="card-title">Recent Tickets</h3><p className="card-sub">Latest tickets across the helpdesk — click any row to open</p></div>
        <button className="btn btn-soft btn-sm" onClick={() => go("tickets")}>View all <ChevronRight size={14} /></button>
      </div>
      <div className="table-wrap">
        <table><thead><tr><th style={{ width: 34 }}></th><th>Ticket</th><th>Customer</th><th>Subject</th><th>Category</th><th>Priority</th><th>Agent</th><th>Status</th></tr></thead>
          <tbody>{rows.map((t) => (<tr key={t.id} style={{ cursor: "pointer" }} onClick={() => onOpen(t)}>
            <td style={{ fontWeight: 700, color: "var(--primary)" }}>#{t.id}</td>
            <td><div className="cust"><span className="a" style={{ background: avColor(t.name) }}>{initials(t.name)}</span><div><div className="nm">{t.name}</div><div className="em">{t.email}</div></div></div></td>
            <td><div className="subj" title={t.subject}>{t.subject}</div></td>
            <td style={{ fontWeight: 600, fontSize: 12.5 }}>{t.category}</td>
            <td><PrioBadge p={t.priority} /></td>
            <td style={{ fontWeight: 600, fontSize: 12.5 }}>{t.agent}</td>
            <td><StatusBadge s={t.status} /></td>
          </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

function TopNavbar({ dark, setDark, onBurger, onOpenTicket, onBack, canBack, collapsed, setCollapsed }) {
  const push = useToast();
  const [now, setNow] = useState(new Date());
  const [newOpen, setNewOpen] = useState(false);
  const [acts, setActs] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [modal, setModal] = useState(null); // "ticket" | "email"
  const [notifs, setNotifs] = useState(NOTIFS_SEED);
  const newRef = useRef(null);
  useClickAway(newRef, () => setNewOpen(false));
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const unread = notifs.filter((n) => !n.read).length;
  return (
    <header className="topbar">
      <button className="icon-btn burger" onClick={onBurger}><Menu size={19} /></button>
      <button className="icon-btn hide-sm" title={collapsed ? "Show workspace" : "Hide workspace"} onClick={() => setCollapsed(!collapsed)}><PanelRight size={18} /></button>
      <button className="icon-btn" title={canBack ? "Back" : "Nothing to go back to"} onClick={onBack} disabled={!canBack}><ArrowLeft size={18} /></button>
      <GlobalSearch onOpen={onOpenTicket} />
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <div className="dd-wrap" ref={newRef}>
          <button className="btn btn-primary" onClick={() => setNewOpen((o) => !o)}><Plus size={16} /> New <ChevronDown size={14} /></button>
          {newOpen && (
            <div className="menu menu-top right" style={{ minWidth: 210 }}>
              <button className="mi" onClick={() => { setNewOpen(false); setModal("ticket"); }}><span className="mic" style={{ background: "#5B5CEB18", color: "#5B5CEB" }}><Ticket size={16} /></span><span>New Ticket<small>Log a support request</small></span></button>
              <button className="mi" onClick={() => { setNewOpen(false); setModal("email"); }}><span className="mic" style={{ background: "#0EA5E918", color: "#0EA5E9" }}><Mail size={16} /></span><span>New Email<small>Compose an outbound email</small></span></button>
            </div>
          )}
        </div>
        <button className="btn btn-ghost" onClick={() => setActs(true)}><Activity size={16} /> Recent Activities</button>
        <div className="clock"><Clock size={15} /> {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}</div>
        <div className="dd-wrap">
          <button className="icon-btn" onClick={() => setNotifOpen((o) => !o)}><Bell size={18} />{unread > 0 && <span className="dot">{unread}</span>}</button>
          {notifOpen && <NotificationPanel notifs={notifs} setNotifs={setNotifs} onClose={() => setNotifOpen(false)} />}
        </div>
        <button className="icon-btn" onClick={() => setDark((d) => !d)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        {/* No profile/avatar menu here — the admin panel's own topbar already owns
            identity, settings and sign-out for the logged-in user. */}
      </div>
      <TicketModal open={modal === "ticket"} onClose={() => setModal(null)} />
      <EmailComposeModal open={modal === "email"} onClose={() => setModal(null)} />
      <RecentActivitiesDrawer open={acts} onClose={() => setActs(false)} />
    </header>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (<div className="tooltip-card"><div className="tt-lab">{label}</div>
    {payload.map((p) => (<div className="tt-row" key={p.dataKey}><span className="dotc" style={{background:p.color,width:8,height:8}} />
      <span style={{color:"var(--muted)"}}>{p.dataKey||p.name}</span><b style={{marginLeft:"auto"}}>{p.value}</b></div>))}</div>);
}

/* ============================================================================
   DASHBOARD PAGE
   ========================================================================== */
function StatCard({ s, i, onClick }) {
  const n = useCounter(s.value); const up = s.trend >= 0;
  return (
    <div className="card stat fade clickable" style={{ animationDelay:`${i*70}ms` }} onClick={onClick} title="Filter tickets by this status">
      <div className="ic" style={{ background:`${s.color}18`, color:s.color }}><s.icon size={20} /></div>
      <div className="trend" style={{ color: up ? "var(--success)" : "var(--danger)" }}>{up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(s.trend)}%</div>
      <div className="lab">{s.label}</div><div className="val">{n.toLocaleString("en-IN")}</div><div className="desc">{s.desc}</div>
      <div className="spark"><ResponsiveContainer width="100%" height="100%"><AreaChart data={s.spark.map((v,x)=>({x,v}))} margin={{top:2,right:0,left:0,bottom:0}}>
        <defs><linearGradient id={`sp-${s.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity={.4} /><stop offset="100%" stopColor={s.color} stopOpacity={0} /></linearGradient></defs>
        <Area type="monotone" dataKey="v" stroke={s.color} strokeWidth={2} fill={`url(#sp-${s.key})`} /></AreaChart></ResponsiveContainer></div>
    </div>
  );
}
function AnalyticsChart() {
  const [range, setRange] = useState("Week"); const data = ANALYTICS[range];
  const totals = data.reduce((a, d) => ({ r:a.r+d.Received, s:a.s+d.Resolved, p:a.p+d.Pending }), {r:0,s:0,p:0});
  return (
    <div className="card card-pad fade" style={{ animationDelay:"120ms" }}>
      <div className="section-head" style={{ marginBottom:8 }}>
        <div><h3 className="card-title"><LineChartIcon size={16} style={{verticalAlign:"-2px",marginRight:6,color:"var(--primary)"}} />Ticket Analytics</h3><p className="card-sub">Received, resolved and pending volume over time</p></div>
        <div className="filters">{["Day","Week","Month","Year","Custom"].map((r) => <button key={r} className={range===r?"on":""} onClick={()=>setRange(r)}>{r}</button>)}</div>
      </div>
      <div style={{ height:300, marginTop:8 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{top:12,right:8,left:-14,bottom:0}}>
        <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="t" tick={{fontSize:12,fill:"var(--muted)"}} axisLine={false} tickLine={false} />
        <YAxis tick={{fontSize:12,fill:"var(--muted)"}} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} /><Legend iconType="circle" wrapperStyle={{fontSize:12.5,paddingTop:8}} />
        <Line type="monotone" dataKey="Received" stroke="#5B5CEB" strokeWidth={2.5} dot={false} activeDot={{r:5}} />
        <Line type="monotone" dataKey="Resolved" stroke="#10B981" strokeWidth={2.5} dot={false} activeDot={{r:5}} />
        <Line type="monotone" dataKey="Pending" stroke="#F59E0B" strokeWidth={2.5} strokeDasharray="5 4" dot={false} activeDot={{r:5}} />
      </LineChart></ResponsiveContainer></div>
      <div className="summary-row">
        <div><div className="k">Received today</div><div className="v">{totals.r.toLocaleString("en-IN")}</div></div>
        <div><div className="k">Resolved</div><div className="v" style={{color:"var(--success)"}}>{totals.s.toLocaleString("en-IN")}</div></div>
        <div><div className="k">Pending</div><div className="v" style={{color:"var(--warning)"}}>{totals.p.toLocaleString("en-IN")}</div></div>
        <div><div className="k">Resolution rate</div><div className="v" style={{color:"var(--primary)"}}>{Math.round(totals.s/totals.r*100)}%</div></div>
      </div>
    </div>
  );
}
function TicketTimeline() {
  return (<div className="card card-pad fade" style={{ animationDelay:"180ms" }}>
    <div className="section-head"><div><h3 className="card-title">Recent Ticket Activities</h3><p className="card-sub">Latest actions across the helpdesk</p></div><button className="btn btn-soft" style={{padding:"7px 12px",fontSize:12.5}}>View all</button></div>
    <div className="tl">{ACTIVITIES.map((a) => (<div className="tl-item" key={a.id}>
      <span className="tl-node" style={{color:a.color}} /><div className="tl-av" style={{background:a.color}}>{initials(a.name)}</div>
      <div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <span className="tl-name">{a.name}</span><span className="tl-id">{a.id}</span><PrioBadge p={a.prio} /><span className="tl-time" style={{marginLeft:"auto"}}>{a.when}</span></div>
        <div className="tl-meta">{a.agent} <span style={{color:"var(--faint)"}}>{a.action}</span> this ticket · <StatusBadge s={a.status} /></div></div></div>))}</div>
  </div>);
}
function TicketDistribution() {
  const total = DISTRIBUTION.reduce((a, d) => a + d.value, 0);
  return (<div className="card card-pad fade" style={{ animationDelay:"200ms" }}>
    <div className="section-head"><div><h3 className="card-title">Ticket Distribution</h3><p className="card-sub">By category · {total.toLocaleString("en-IN")} total</p></div></div>
    <div style={{display:"flex",gap:18,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{width:200,height:200,position:"relative",flexShrink:0,margin:"0 auto"}}>
        <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={DISTRIBUTION} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none">{DISTRIBUTION.map((d)=><Cell key={d.name} fill={d.color} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart></ResponsiveContainer>
        <div style={{position:"absolute",inset:0,display:"grid",placeItems:"center",pointerEvents:"none"}}><div style={{textAlign:"center"}}><div style={{fontSize:24,fontWeight:800}}>{total.toLocaleString("en-IN")}</div><div style={{fontSize:11,color:"var(--muted)"}}>Total tickets</div></div></div>
      </div>
      <div style={{flex:1,minWidth:180}}>{DISTRIBUTION.map((d) => (<div className="dist-row" key={d.name}><span className="dotc" style={{background:d.color,width:9,height:9}} /><span className="nm">{d.name}</span><span className="ct">{d.value}</span><span className="pc">{Math.round(d.value/total*100)}%</span></div>))}</div>
    </div>
  </div>);
}
function Ring({ pct, color }) {
  const r = 40, c = 2*Math.PI*r; const [off, setOff] = useState(c);
  useEffect(() => { const t = setTimeout(() => setOff(c - pct/100*c), 120); return () => clearTimeout(t); }, [pct, c]);
  return (<svg width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="9" /><circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 48 48)" style={{transition:"stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)"}} /></svg>);
}
function PerformancePanel() {
  return (<div className="fade" style={{marginTop:22,animationDelay:"240ms"}}>
    <div className="section-head"><div><h3 className="card-title" style={{fontSize:17}}>Support Team Performance</h3><p className="card-sub">Key service metrics for the current period</p></div><button className="btn btn-soft" style={{padding:"7px 12px",fontSize:12.5}}>Last 30 days</button></div>
    <div className="perf-grid">{PERF.map((p) => (<div className="card kpi" key={p.title}><div className="ring"><Ring pct={p.pct} color={p.color} /><b style={{color:p.color}}>{p.display}</b></div><div className="kt"><p.icon size={14} style={{verticalAlign:"-2px",marginRight:5,color:p.color}} />{p.title}</div><div className="ks">{p.sub}</div><div className="bar"><i style={{width:`${p.pct}%`,background:p.color}} /></div></div>))}</div>
  </div>);
}
const STAT_FILTER = { unresolved:["unresolved",[]], overdue:["all",["Overdue"]], open:["open",[]], closed:["all",["Closed"]], due:["all",[]], new:["all",["New"]] };
function DashboardPage({ onOpen, onOpenTickets, go }) {
  const push = useToast();
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const [modal, setModal] = useState(null); // "ticket" | "assign" | "analytics"
  const [expOpen, setExpOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const expRef = useRef(null);
  useClickAway(expRef, () => setExpOpen(false));
  const runExport = (kind) => {
    setExpOpen(false); setExporting(true);
    setTimeout(() => {
      try {
        const rows = buildExportRows();
        if (kind === "xlsx") { exportExcel(rows, "helphive-tickets.xlsx"); push({ type: "success", title: "Export ready", desc: "helphive-tickets.xlsx downloaded." }); }
        else if (kind === "csv") { exportCSV(rows, "helphive-tickets.csv"); push({ type: "success", title: "Export ready", desc: "helphive-tickets.csv downloaded." }); }
        else { const ok = exportPDF("Support Tickets Report", ["Ticket Number","Customer Name","Email","Category","Priority","Status","Assigned Agent"], rows); push(ok ? { type: "success", title: "Opening print dialog", desc: "Choose “Save as PDF”." } : { type: "error", title: "Popup blocked", desc: "Allow popups to export PDF." }); }
      } catch (e) { push({ type: "error", title: "Export failed", desc: "Something went wrong generating the file." }); }
      setExporting(false);
    }, 500);
  };
  return (
    <div className="content route">
      <div className="welcome fade">
        <div><span className="greet"><Sparkles size={14} /> {greet}, Admin</span><h1>Customer Support Dashboard</h1><p>Monitor ticket performance and team productivity in real time.</p></div>
        <div className="qa-row">
          <button className="btn btn-primary" onClick={() => setModal("ticket")}><PlusCircle size={16} /> Create Ticket</button>
          <button className="btn btn-ghost" onClick={() => setModal("assign")}><UserPlus size={16} /> Assign Ticket</button>
          <div className="dd-wrap" ref={expRef}>
            <button className="btn btn-ghost" onClick={() => setExpOpen((o) => !o)} disabled={exporting}>{exporting ? <Spinner /> : <FileDown size={16} />} Export Report <ChevronDown size={13} /></button>
            {expOpen && (
              <div className="menu menu-top right" style={{ minWidth: 180 }}>
                <button className="mi" onClick={() => runExport("xlsx")}><span className="mic" style={{ background: "#10B98118", color: "#10B981" }}><FileSpreadsheet size={15} /></span> Excel (.xlsx)</button>
                <button className="mi" onClick={() => runExport("csv")}><span className="mic" style={{ background: "#0EA5E918", color: "#0EA5E9" }}><FileText size={15} /></span> CSV (.csv)</button>
                <button className="mi" onClick={() => runExport("pdf")}><span className="mic" style={{ background: "#EF444418", color: "#EF4444" }}><Printer size={15} /></span> PDF (print)</button>
              </div>
            )}
          </div>
          <button className="btn btn-ghost" onClick={() => setModal("analytics")}><BarChart3 size={16} /> Generate Analytics</button>
        </div>
      </div>
      <div className="grid-stats">{STATS.map((s, i) => <StatCard key={s.key} s={s} i={i} onClick={() => { const [v, st] = STAT_FILTER[s.key] || ["all", []]; onOpenTickets(v, st); }} />)}</div>
      <DashLiveRow onOpenTickets={onOpenTickets} />
      <AnalyticsChart />
      <div className="two-col"><TicketTimeline /><TicketDistribution /></div>
      <RecentTicketsTable onOpen={onOpen} go={go} />
      <PerformancePanel />

      <TicketModal open={modal === "ticket"} onClose={() => setModal(null)} />
      <AssignDialog open={modal === "assign"} onClose={() => setModal(null)} />
      <AnalyticsModal open={modal === "analytics"} onClose={() => setModal(null)} />
    </div>
  );
}

/* ============================================================================
   TICKETS PAGE
   ========================================================================== */
function TicketSidebar({ view, setView, counts }) {
  return (
    <div className="card card-pad tnav">
      <div className="grp">Default <ChevronDown size={14} /></div>
      {VIEWS.slice(0, 5).map((v) => (
        <div key={v.key} className={`tnav-item ${view === v.key ? "on" : ""}`} onClick={() => setView(v.key)}>
          <v.icon size={16} /> {v.label} <span className="c">{counts[v.key]}</span>
        </div>
      ))}
      <div className="tnav-sep" />
      {VIEWS.slice(5).map((v) => (
        <div key={v.key} className={`tnav-item ${view === v.key ? "on" : ""}`} onClick={() => setView(v.key)}>
          <v.icon size={16} /> {v.label} <span className="c">{counts[v.key]}</span>
        </div>
      ))}
    </div>
  );
}
const SORTS = ["Created Date","Updated Date","Priority","Status","Customer Name","Due Date"];
function SortDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false); const ref = useRef(null);
  useEffect(() => { const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false); document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  return (
    <div className="dd" ref={ref}>
      <button className="btn btn-ghost" onClick={() => setOpen(o => !o)}><ArrowUpDown size={15} /> Sort: <b style={{color:"var(--primary)"}}>{value}</b> <ChevronDown size={14} /></button>
      {open && (<div className="dd-menu">{SORTS.map((s) => (<button key={s} className={value===s?"on":""} onClick={()=>{onChange(s);setOpen(false);}}>{s}{value===s && <CheckCheck size={14} style={{marginLeft:"auto"}} />}</button>))}</div>)}
    </div>
  );
}
function FilterDrawer({ open, onClose, draft, setDraft, onApply, onReset }) {
  if (!open) return null;
  const toggle = (key, val) => setDraft(d => { const arr = d[key]; return { ...d, [key]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] }; });
  const Multi = ({ label, keyName, opts }) => (
    <div className="fld"><label>{label}</label><div className="chips">{opts.map((o) => (<button key={o} className={`fchip ${draft[keyName].includes(o) ? "on" : ""}`} onClick={() => toggle(keyName, o)}>{o}</button>))}</div></div>
  );
  return (<>
    <div className="drawer-overlay" onClick={onClose} />
    <div className="drawer">
      <div className="drawer-head"><h3 className="card-title"><SlidersHorizontal size={16} style={{verticalAlign:"-3px",marginRight:7,color:"var(--primary)"}} />Filter Tickets</h3><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
      <div className="drawer-body">
        <div className="fld"><label>Created Date (from)</label><input type="date" value={draft.createdFrom} onChange={(e)=>setDraft(d=>({...d,createdFrom:e.target.value}))} /></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="fld"><label>Resolved At</label><input type="date" value={draft.resolvedAt} onChange={(e)=>setDraft(d=>({...d,resolvedAt:e.target.value}))} /></div>
          <div className="fld"><label>Closed At</label><input type="date" value={draft.closedAt} onChange={(e)=>setDraft(d=>({...d,closedAt:e.target.value}))} /></div>
        </div>
        <Multi label="Status" keyName="status" opts={["New","Open","Pending","Overdue","Resolved","Closed"]} />
        <Multi label="Priority" keyName="priority" opts={["Low","Medium","High","Critical"]} />
        <Multi label="Category" keyName="category" opts={CATS} />
        <div className="fld"><label>Assigned Agent</label><select value={draft.agent} onChange={(e)=>setDraft(d=>({...d,agent:e.target.value}))}><option value="">Any agent</option>{AGENTS.map(a=><option key={a}>{a}</option>)}</select></div>
        <div className="fld"><label>Customer Name</label><input placeholder="e.g. Ananya" value={draft.customer} onChange={(e)=>setDraft(d=>({...d,customer:e.target.value}))} /></div>
      </div>
      <div className="drawer-foot"><button className="btn btn-soft" style={{flex:1,justifyContent:"center"}} onClick={onReset}><RotateCcw size={15} /> Reset Filters</button><button className="btn btn-primary" style={{flex:1,justifyContent:"center"}} onClick={onApply}><CheckCheck size={15} /> Apply Filters</button></div>
    </div>
  </>);
}
function TicketHoverPreview({ t, anchor, onOpen, onEnter, onLeave, onClose, onAction }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose && onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  useEffect(() => {
    if (!anchor) return;
    const W = 390, H = 420, M = 12;
    const r = anchor.getBoundingClientRect();
    let left = r.right + M;
    if (left + W > window.innerWidth - M) left = r.left - W - M;
    if (left < M) left = Math.max(M, (window.innerWidth - W) / 2);
    let top = r.top - 40;
    if (top + H > window.innerHeight - M) top = Math.max(M, window.innerHeight - H - M);
    if (top < M) top = M;
    setPos({ left, top });
  }, [anchor]);
  if (!pos) return null;

  const last = t.convo[t.convo.length - 1];
  const custLast = last.who === "cust";

  return (
    <div className="hp compact" style={{ left: pos.left, top: pos.top }} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <button className="hp-close" title="Close preview (Esc)" onClick={onClose}><X size={13} /></button>

      {/* ticket */}
      <div className="hp-head">
        <span className="ha" style={{ background: avColor(t.name) }}>{initials(t.name)}</span>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 20 }}>
          <div className="hp-subj" style={{ fontSize: 13 }}>{t.subject}</div>
          <div className="hp-ct" style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            <span style={{ fontWeight: 700, color: "var(--primary)" }}>#{t.id}</span><span>·</span><span>{t.name}</span>
          </div>
        </div>
      </div>

      {/* conversation */}
      <div className="hp-body" style={{ maxHeight: 280 }}>
        <div className="hp-sec" style={{ display: "flex", alignItems: "center", gap: 7 }}>
          Conversation
          {custLast && <span className="newrep"><span className="dotc" style={{ background: "#fff", width: 5, height: 5 }} /> New customer reply</span>}
        </div>
        <div className="chat">
          {t.convo.slice(-5).map((m, i, arr) => {
            const isLastCust = m.who === "cust" && i === arr.length - 1;
            return (
              <div className={`bub ${m.who === "cust" ? "cust" : "agent"}`} key={i}
                   style={isLastCust ? { borderColor: "var(--accent)", background: "var(--accent-soft)", color: "var(--accent)" } : undefined}>
                <div className="who">{m.who === "cust" ? <><User size={10} /> {t.name.split(" ")[0]}</> : <><Headphones size={10} /> Support Agent</>}</div>
                {m.msg}
                <div className="tm"><Clock size={9} /> {m.at}{m.att && <><Paperclip size={9} /> 1 file</>}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* actions */}
      <div className="hp-foot">
        <button onClick={() => onAction("reply", t)}><Reply size={12} /> Reply</button>
        <button onClick={() => onAction("assign", t)}><UserPlus size={12} /> Assign</button>
        <button onClick={() => onAction("close", t)}><CheckCheck size={12} /> Close</button>
      </div>
      <button className="hp-open" onClick={() => onOpen && onOpen(t)}>Open Full Ticket →</button>
    </div>
  );
}

function TicketCard({ t, i, hoverId, onHoverEnter, onHoverLeave, onOpen, selected, onToggle }) {
  const btnRef = useRef(null);
  const sla = slaStyle[t.sla];
  const p = prioStyle(t.priority);
  const st = statusStyle(t.status);
  return (
    <div className={`card tcard slim ${selected ? "sel" : ""}`} style={{ "--pc": prioColor[t.priority], animationDelay: `${i * 35}ms`, cursor: "pointer" }}
         onClick={() => onOpen && onOpen(t)} title="Open ticket">
      <div className="slim-row">
        <button className={`selbox ${selected ? "on" : ""}`} title="Select ticket"
                onClick={(e) => { e.stopPropagation(); onToggle(t.id); }}>{selected ? <Check size={12} /> : null}</button>
        <span className="slim-av" style={{ background: avColor(t.name) }}>{initials(t.name)}</span>
        <span className="slim-id">#{t.id}</span>
        <span className="slim-name">{t.name}</span>
        <span className="slim-subj" title={t.subject}>{t.subject}</span>
        <span className="badge-xs" style={{ background: p.bg, color: p.fg }}><span className="dotc" style={{ background: p.fg, width: 5, height: 5 }} />{t.priority}</span>
        <span className="badge-xs" style={{ background: st.bg, color: st.fg }}>{t.status}</span>
        <button ref={btnRef} className={`view-btn ${hoverId === t.id ? "on" : ""}`} title="Hover for a quick preview"
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={() => onHoverEnter(t, btnRef.current)} onMouseLeave={onHoverLeave}>
          <Eye size={12} /> View
        </button>
      </div>
      <div className="slim-meta">
        <span className="sm">{t.agent === "Unassigned" ? <><UserPlus size={11} /> Unassigned</> : <><UserCheck size={11} /> {t.agent}</>}</span>
        <span>·</span>
        <span className="sm"><CalendarDays size={11} /> {t.created}</span>
        <span>·</span>
        <span className="sm"><Clock size={11} /> {t.lastActivity}</span>
        {t.custReplied ? (<>
          <span className="replied" style={{ marginLeft: "auto" }}><span className="rd" /> Customer replied · {t.repliedAgo}</span>
          {t.newReplies > 0 && <span className="newct">{t.newReplies} new</span>}
        </>) : <span className="badge-xs" style={{ background: sla.bg, color: sla.fg, marginLeft: "auto" }}>{t.sla}</span>}
      </div>
    </div>
  );
}

function TicketTable({ rows, hoverId, onHoverEnter, onHoverLeave, onOpen, sel = [], onToggle }) {
  return (<div className="card card-pad"><div className="table-wrap"><table>
    <thead><tr><th>Ticket</th><th>Customer</th><th>Subject</th><th>Category</th><th>Priority</th><th>Agent</th><th>Source</th><th>Status</th><th style={{textAlign:"right"}}>Actions</th></tr></thead>
    <tbody>{rows.map((t) => (<tr key={t.id} className={sel.includes(t.id) ? "sel" : ""} style={{ cursor: "pointer" }} onClick={() => onOpen && onOpen(t)}>
      <td><button className={`selbox ${sel.includes(t.id) ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); onToggle(t.id); }}>{sel.includes(t.id) ? <Check size={12} /> : null}</button></td>
      <td style={{fontWeight:700,color:"var(--primary)"}}>#{t.id}</td>
      <td><div className="cust"><span className="a" style={{background:avColor(t.name)}}>{initials(t.name)}</span><div><div className="nm">{t.name}</div><div className="em">{t.email}</div></div></div></td>
      <td><div className="subj" title={t.subject}>{t.subject}</div></td>
      <td style={{fontWeight:600,fontSize:12.5}}>{t.category}</td>
      <td><PrioBadge p={t.priority} /></td>
      <td style={{fontWeight:600,fontSize:12.5}}>{t.agent}</td>
      <td style={{fontSize:12.5,color:"var(--muted)"}}>{t.source}</td>
      <td><StatusBadge s={t.status} /></td>
      <td><div className="row-act" style={{justifyContent:"flex-end"}}><button title="Hover for a quick preview" onClick={(e) => e.stopPropagation()} onMouseEnter={(e) => onHoverEnter(t, e.currentTarget)} onMouseLeave={onHoverLeave}><Eye size={15} /></button><button title="Edit"><Pencil size={15} /></button><button title="Resolve"><CheckCheck size={15} /></button><button title="Delete"><Trash2 size={15} /></button></div></td>
    </tr>))}</tbody></table></div></div>);
}
function Skeletons({ layout }) {
  if (layout === "table") return (<div className="card card-pad"><div style={{display:"flex",flexDirection:"column",gap:14}}>{Array.from({length:6}).map((_,i)=>(<div key={i} style={{display:"flex",gap:12,alignItems:"center"}}><div className="sk" style={{width:32,height:32,borderRadius:9}} /><div className="sk" style={{height:14,flex:1}} /><div className="sk" style={{height:14,width:80}} /><div className="sk" style={{height:22,width:70,borderRadius:20}} /></div>))}</div></div>);
  return (<div style={{display:"flex",flexDirection:"column",gap:14}}>{Array.from({length:4}).map((_,i)=>(<div key={i} className="card sk-card">
    <div style={{display:"flex",gap:13}}><div className="sk" style={{width:44,height:44,borderRadius:12}} /><div style={{flex:1}}><div className="sk" style={{height:12,width:120,marginBottom:8}} /><div className="sk" style={{height:16,width:"70%"}} /></div></div>
    <div style={{display:"flex",gap:8}}>{Array.from({length:4}).map((_,j)=><div key={j} className="sk" style={{height:22,width:80,borderRadius:8}} />)}</div>
    <div className="sk" style={{height:32,width:"55%",borderRadius:9}} /></div>))}</div>);
}
/* ============================================================================
   BULK ACTIONS
   ========================================================================== */
const TAG_BANK = ["Urgent", "VIP", "Internship", "Attendance", "Placement", "Certificate", "Refund", "Billing"];
const STATUS_OPTS = ["New", "Open", "Pending", "Resolved", "Closed", "On Hold"];

function BulkAssignModal({ open, count, onClose, onApply }) {
  const [agent, setAgent] = useState("Priya Nair");
  const [dept, setDept] = useState(DEPTS[0]);
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#0EA5E918", color: "#0EA5E9", width: 32, height: 32 }}><UserPlus size={16} /></span>Assign {count} ticket{count > 1 ? "s" : ""}</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <div className="fld"><label>Support Agent</label><select value={agent} onChange={(e) => setAgent(e.target.value)}>{AGENTS.map((a) => <option key={a}>{a}</option>)}</select></div>
          <div className="fld"><label>Department</label><select value={dept} onChange={(e) => setDept(e.target.value)}>{DEPTS.map((d) => <option key={d}>{d}</option>)}</select></div>
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => { setBusy(true); setTimeout(() => { setBusy(false); onApply({ agent, dept }); }, 500); }}>{busy ? <><Spinner /> Assigning…</> : <><UserCheck size={15} /> Assign</>}</button></div>
      </div>
    </div>
  );
}

const TICKET_TYPES = ["Question", "Incident", "Problem", "Feature Request", "Refund"];
const BULK_STATUS = ["Open", "Pending", "Resolved", "Closed"];
const BULK_PRIORITY = ["Low", "Medium", "High", "Urgent"];
const BULK_AGENTS = ["Rahul Sharma", "Priya Patel", "Aman Singh", "Neha Verma", "Karan Mehta", "Sneha Iyer", "Akash Gupta", "Pooja Sharma", "Rohan Desai", "Support Queue (Unassigned)"];

function BulkUpdateModal({ open, count, onClose, onApply }) {
  const KEEP = "";
  const blank = { type: KEEP, status: KEEP, priority: KEEP, agent: KEEP, reply: "" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setF(blank); setBusy(false); } }, [open]);
  if (!open) return null;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const dirty = f.type || f.status || f.priority || f.agent || f.reply.trim();

  const apply = () => {
    if (!dirty) return;
    setBusy(true);
    setTimeout(() => { setBusy(false); onApply({ ...f, reply: f.reply.trim() }); }, 600);
  };

  const Field = ({ label, k, opts }) => (
    <div className="fld">
      <label>{label}</label>
      <select value={f[k]} onChange={(e) => set(k, e.target.value)}>
        <option value="">— keep unchanged —</option>
        {opts.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="panel-title" style={{ fontSize: 15 }}>
            <span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB", width: 32, height: 32 }}><SlidersHorizontal size={16} /></span>
            Bulk Update <span className="count-badge" style={{ marginLeft: 5 }}>{count} ticket{count > 1 ? "s" : ""}</span>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>Only the fields you change will be applied to the selected tickets.</p>
          <Field label="Ticket Type" k="type" opts={TICKET_TYPES} />
          <Field label="Status" k="status" opts={BULK_STATUS} />
          <Field label="Priority" k="priority" opts={BULK_PRIORITY} />
          <Field label="Assigned Agent" k="agent" opts={BULK_AGENTS} />
          <div className="fld">
            <label>Bulk Reply <span style={{ fontWeight: 500, color: "var(--faint)", textTransform: "none", letterSpacing: 0 }}>(optional — sent to every selected ticket)</span></label>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--muted)", margin: "2px 0 7px" }}>
              <Mail size={13} /> From: <b style={{ color: "var(--text)" }}>IS Support</b> (contact@internshipstudio.com)
            </div>
            <div className="bu-editor">
              <textarea placeholder="Add your reply here" value={f.reply} onChange={(e) => set("reply", e.target.value)} style={{ minHeight: 96 }} />
              <div className="rte">
                {[Bold, Italic, Underline, List, ListOrdered, Link2].map((Ic, i) => <button key={i} type="button"><Ic size={15} /></button>)}
                <span className="div" />
                <button type="button" title="Attach"><Paperclip size={15} /></button>
                <button type="button" title="Canned response"><MessageSquareText size={15} /></button>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" disabled={!dirty || busy} onClick={apply}>
            {busy ? <><Spinner /> Updating…</> : <><Check size={15} /> Update Tickets</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function MergeModal({ open, tickets, onClose, onApply }) {
  const [primary, setPrimary] = useState(null);
  useEffect(() => { if (open && tickets.length) setPrimary(tickets[0].id); }, [open, tickets]);
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#8B5CF618", color: "#8B5CF6", width: 32, height: 32 }}><FolderInput size={16} /></span>Merge {tickets.length} tickets</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>Choose the primary ticket. Conversations from the others are preserved and moved into it, then those tickets are closed as duplicates.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tickets.map((t) => (
              <label key={t.id} className="fchip" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer", borderColor: primary === t.id ? "var(--primary)" : undefined, background: primary === t.id ? "var(--primary-soft)" : undefined, color: primary === t.id ? "var(--primary)" : undefined }}>
                <input type="radio" checked={primary === t.id} onChange={() => setPrimary(t.id)} />
                <span style={{ fontWeight: 700 }}>#{t.id}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</span>
                <span style={{ fontSize: 11, opacity: .7 }}>{t.convo.length} msgs</span>
              </label>
            ))}
          </div>
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" onClick={() => onApply(primary)}><FolderInput size={15} /> Merge Tickets</button></div>
      </div>
    </div>
  );
}

function TagsModal({ open, mode, count, existing, onClose, onApply }) {
  const [sel, setSel] = useState([]);
  useEffect(() => { if (open) setSel([]); }, [open]);
  if (!open) return null;
  const opts = mode === "remove" ? existing : TAG_BANK;
  const toggle = (t) => setSel((x) => x.includes(t) ? x.filter((y) => y !== t) : [...x, t]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#F59E0B18", color: "#F59E0B", width: 32, height: 32 }}><TagIcon size={16} /></span>{mode === "remove" ? "Remove tags from" : "Add tags to"} {count} ticket{count > 1 ? "s" : ""}</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          {opts.length ? <div className="chips">{opts.map((t) => <button key={t} className={`fchip ${sel.includes(t) ? "on" : ""}`} onClick={() => toggle(t)}><TagIcon size={12} /> {t}</button>)}</div>
            : <EmptyState icon={TagIcon} title="No tags found" desc="The selected tickets don't have any tags to remove." />}
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" disabled={!sel.length} onClick={() => onApply(sel)}><Check size={15} /> {mode === "remove" ? "Remove" : "Add"} {sel.length || ""}</button></div>
      </div>
    </div>
  );
}

function PickModal({ open, title, icon: Ic, options, onClose, onApply }) {
  const [val, setVal] = useState(options[0]);
  useEffect(() => { if (open) setVal(options[0]); }, [open, options]);
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB", width: 32, height: 32 }}><Ic size={16} /></span>{title}</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body"><div className="chips">{options.map((o) => <button key={o} className={`fchip ${val === o ? "on" : ""}`} onClick={() => setVal(o)}>{o}</button>)}</div></div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" onClick={() => onApply(val)}><Check size={15} /> Apply</button></div>
      </div>
    </div>
  );
}

function BulkBar({ count, selTickets, actions }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [expOpen, setExpOpen] = useState(false);
  const moreRef = useRef(null), expRef = useRef(null);
  useClickAway(moreRef, () => setMoreOpen(false));
  useClickAway(expRef, () => setExpOpen(false));
  const more = [
    ["Add Internal Note", Lock], ["Send Email to Customer", Mail], ["Change Department", Building2],
    ["Duplicate Tickets", Copy], ["Archive Tickets", FolderInput], ["Restore Tickets", RotateCcw], ["Print Ticket Summary", Printer],
  ];
  return (
    <div className="bulkbar">
      <span className="selcount"><CheckCheck size={15} /> {count} Ticket{count > 1 ? "s" : ""} Selected</span>
      <span className="bdiv" />
      <button className="bbtn" onClick={actions.assign}><UserPlus size={13} /> Assign</button>
      <button className="bbtn" onClick={actions.close}><CheckCheck size={13} /> Close</button>
      <button className="bbtn" onClick={actions.bulkUpdate}><SlidersHorizontal size={13} /> Bulk Update</button>
      <button className="bbtn mobile-hide" disabled={count < 2} title={count < 2 ? "Select two or more tickets to merge" : "Merge selected tickets"} onClick={actions.merge}><FolderInput size={13} /> Merge</button>
      <button className="bbtn mobile-hide tablet-hide" onClick={actions.changePriority}><ArrowUp size={13} /> Priority</button>
      <button className="bbtn mobile-hide tablet-hide" onClick={actions.changeStatus}><Activity size={13} /> Status</button>
      <button className="bbtn mobile-hide tablet-hide" onClick={actions.addTags}><TagIcon size={13} /> Add Tags</button>
      <button className="bbtn mobile-hide tablet-hide" onClick={actions.removeTags}><X size={13} /> Remove Tags</button>
      <button className="bbtn mobile-hide tablet-hide" onClick={actions.spam}><ShieldX size={13} /> Spam</button>
      <button className="bbtn mobile-hide tablet-hide" onClick={actions.trash}><Trash size={13} /> Trash</button>
      <div className="dd-wrap mobile-hide" ref={expRef}>
        <button className="bbtn" onClick={() => setExpOpen((o) => !o)}><Download size={13} /> Export <ChevronDown size={12} /></button>
        {expOpen && (<div className="menu menu-top right" style={{ minWidth: 160 }}>
          {[["xlsx", "Excel (.xlsx)", FileSpreadsheet], ["csv", "CSV (.csv)", FileText], ["pdf", "PDF (print)", Printer]].map(([k, l, Ic]) => (
            <button key={k} className="mi" onClick={() => { setExpOpen(false); actions.exportSel(k); }}><span className="mic" style={{ background: "var(--surface-2)" }}><Ic size={14} /></span> {l}</button>
          ))}
        </div>)}
      </div>
      <button className="bbtn danger" onClick={actions.del}><Trash2 size={13} /> Delete</button>
      <div className="dd-wrap" ref={moreRef} style={{ marginLeft: "auto" }}>
        <button className="bbtn" onClick={() => setMoreOpen((o) => !o)} title="More actions"><MoreHorizontal size={15} /></button>
        {moreOpen && (<div className="menu menu-top right" style={{ minWidth: 220 }}>
          {more.map(([label, Ic]) => (
            <button key={label} className="mi" style={{ padding: "9px 11px" }} onClick={() => { setMoreOpen(false); actions.more(label); }}>
              <span className="mic" style={{ background: "var(--surface-2)" }}><Ic size={14} /></span> {label}
            </button>
          ))}
        </div>)}
      </div>
      <button className="bbtn" onClick={actions.clear} title="Clear selection"><X size={13} /> Clear</button>
    </div>
  );
}

const EMPTY = { createdFrom:"", resolvedAt:"", closedAt:"", status:[], priority:[], category:[], agent:"", customer:"" };
function TicketsPage({ onOpen, initialView = "unresolved", initialStatus = [], tickets, setTickets }) {
  const push = useToast();
  const [sel, setSel] = useState([]);                 // selected ticket ids
  const [modal, setModal] = useState(null);           // active bulk modal
  const [confirm, setConfirm] = useState(null);
  const [expOpen, setExpOpen] = useState(false);
  const expRef = useRef(null);
  useClickAway(expRef, () => setExpOpen(false));
  const [view, setView] = useState(initialView);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("Created Date");
  const [layout, setLayout] = useState("card");
  const [perPage, setPerPage] = useState(5);
  const [drawer, setDrawer] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [applied, setApplied] = useState({ ...EMPTY, status: initialStatus });
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState({ t: null, el: null });
  const hoverTimer = useRef(null);
  const clearHoverTimer = () => { if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; } };
  const onHoverEnter = (t, el) => { clearHoverTimer(); setHover({ t, el }); };
  const onHoverLeave = () => { clearHoverTimer(); hoverTimer.current = setTimeout(() => setHover({ t: null, el: null }), 180); };
  const closeHover = () => { clearHoverTimer(); setHover({ t: null, el: null }); };
  const hoverAction = (kind, t) => {
    closeHover();
    if (kind === "reply") { onOpen(t); return; }                       // jump into the reply composer
    setSel([t.id]);
    setModal(kind === "assign" ? "assign" : null);
    if (kind === "close") setConfirm({ title: "Close ticket", msg: `Close #${t.id} — “${t.subject}”?`, label: "Close Ticket",
      run: () => { setTickets((ts) => ts.map((x) => x.id === t.id ? { ...x, status: "Closed", unresolved: false } : x)); push({ type: "success", title: "Ticket closed", desc: `#${t.id} is now Closed.` }); setSel([]); } });
  };
  useEffect(() => clearHoverTimer, []);
  const [page, setPage] = useState(1);
  // navigation history across views AND pages (browser-style back/forward)
  const hist = useRef({ stack: [{ view: initialView, page: 1 }], idx: 0 });
  const skipPush = useRef(false);
  const [histTick, setHistTick] = useState(0);
  useEffect(() => {
    const h = hist.current;
    const cur = h.stack[h.idx];
    if (skipPush.current) { skipPush.current = false; return; }
    if (cur && cur.view === view && cur.page === page) return;
    h.stack = h.stack.slice(0, h.idx + 1).concat({ view, page });
    h.idx = h.stack.length - 1;
    setHistTick((x) => x + 1);
  }, [view, page]);
  const jump = (d) => {
    const h = hist.current;
    const next = h.idx + d;
    if (next < 0 || next > h.stack.length - 1) return;
    h.idx = next;
    const snap = h.stack[next];
    skipPush.current = true;
    setView(snap.view); setPage(snap.page);
    setHistTick((x) => x + 1);
  };
  const goPage = (p) => setPage(p);
  const back = () => jump(-1);
  const fwd = () => jump(1);
  const canBack = hist.current.idx > 0;
  const canFwd = hist.current.idx < hist.current.stack.length - 1;

  const counts = useMemo(() => Object.fromEntries(VIEWS.map(v => [v.key, tickets.filter(v.f).length])), [tickets]);
  const refresh = () => { setLoading(true); setTimeout(() => { setLoading(false); push({ type: "success", title: "Tickets refreshed", desc: "Showing the latest ticket data." }); }, 800); };
  useEffect(refresh, [view]);

  const activeFilterCount = useMemo(() => (
    (applied.createdFrom?1:0)+(applied.resolvedAt?1:0)+(applied.closedAt?1:0)+
    applied.status.length+applied.priority.length+applied.category.length+(applied.agent?1:0)+(applied.customer?1:0)
  ), [applied]);

  const rows = useMemo(() => {
    const vf = VIEWS.find(v => v.key === view).f;
    let r = tickets.filter(vf);
    const term = q.trim().toLowerCase();
    if (term) r = r.filter(t => [t.name, t.subject, t.category, t.agent, String(t.id)].join(" ").toLowerCase().includes(term));
    if (applied.status.length) r = r.filter(t => applied.status.includes(t.status));
    if (applied.priority.length) r = r.filter(t => applied.priority.includes(t.priority));
    if (applied.category.length) r = r.filter(t => applied.category.includes(t.category));
    if (applied.agent) r = r.filter(t => t.agent === applied.agent);
    if (applied.customer) r = r.filter(t => t.name.toLowerCase().includes(applied.customer.toLowerCase()));
    const prioRank = { Critical:4, High:3, Medium:2, Low:1 };
    const cmp = {
      "Created Date": (a,b) => a.createdSort - b.createdSort,
      "Updated Date": (a,b) => a.updatedSort - b.updatedSort,
      "Priority": (a,b) => prioRank[b.priority] - prioRank[a.priority],
      "Status": (a,b) => a.status.localeCompare(b.status),
      "Customer Name": (a,b) => a.name.localeCompare(b.name),
      "Due Date": (a,b) => a.firstResp.localeCompare(b.firstResp),
    }[sort];
    return [...r].sort(cmp);
  }, [tickets, view, q, applied, sort]);

  // ---- bulk action helpers ----
  const selTickets = useMemo(() => tickets.filter((t) => sel.includes(t.id)), [tickets, sel]);
  const selCount = sel.length;
  const toggleSel = (id) => setSel((x) => x.includes(id) ? x.filter((y) => y !== id) : [...x, id]);
  const clearSel = () => setSel([]);
  const patchSel = (patch) => setTickets((ts) => ts.map((t) => sel.includes(t.id) ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t));
  const done = (title, desc) => { push({ type: "success", title, desc }); clearSel(); setModal(null); };
  const selExisting = useMemo(() => Array.from(new Set(selTickets.flatMap((t) => t.tags || []))), [selTickets]);

  const bulkExport = (kind) => {
    try {
      const data = selTickets.map((t) => ({
        "Ticket ID": t.id, "Customer Name": t.name, "Email": t.email, "Subject": t.subject,
        "Category": t.category, "Priority": t.priority, "Status": t.status, "Assigned Agent": t.agent,
        "Created Date": t.created, "Closed Date": ["Resolved", "Closed"].includes(t.status) ? "18 Jul 2026" : "—",
      }));
      if (!data.length) return;
      if (kind === "xlsx") exportExcel(data, "selected-tickets.xlsx");
      else if (kind === "csv") exportCSV(data, "selected-tickets.csv");
      else { const ok = exportPDF("Selected Tickets", ["Ticket ID", "Customer Name", "Subject", "Category", "Priority", "Status", "Assigned Agent"], data); if (!ok) { push({ type: "error", title: "Popup blocked", desc: "Allow popups to export PDF." }); return; } }
      push({ type: "success", title: "Export ready", desc: `${data.length} selected tickets exported.` });
    } catch (e) { push({ type: "error", title: "Export failed" }); }
  };

  const actions = {
    assign: () => setModal("assign"),
    bulkUpdate: () => setModal("update"),
    merge: () => setModal("merge"),
    addTags: () => setModal("addTags"),
    removeTags: () => setModal("removeTags"),
    changePriority: () => setModal("priority"),
    changeStatus: () => setModal("status"),
    exportSel: bulkExport,
    clear: clearSel,
    close: () => setConfirm({ title: "Close tickets", msg: `Are you sure you want to close the selected ${selCount} ticket${selCount > 1 ? "s" : ""}?`, label: "Close Tickets",
      run: () => { patchSel({ status: "Closed", unresolved: false }); done("Tickets closed", `${selCount} moved to Closed.`); } }),
    del: () => setConfirm({ title: "Delete tickets", msg: `Permanently delete ${selCount} ticket${selCount > 1 ? "s" : ""}? This can't be undone.`, label: "Delete", danger: true,
      run: () => { const n = selCount; setTickets((ts) => ts.filter((t) => !sel.includes(t.id))); done("Tickets deleted", `${n} removed.`); } }),
    spam: () => setConfirm({ title: "Mark as spam", msg: `Move ${selCount} ticket${selCount > 1 ? "s" : ""} to Spam?`, label: "Mark as Spam",
      run: () => { patchSel({ spam: true, trash: false }); done("Marked as spam", `${selCount} moved to Spam.`); } }),
    trash: () => setConfirm({ title: "Move to trash", msg: `Move ${selCount} ticket${selCount > 1 ? "s" : ""} to Trash?`, label: "Move to Trash", danger: true,
      run: () => { patchSel({ trash: true, spam: false }); done("Moved to trash", `${selCount} moved to Trash.`); } }),
    more: (label) => {
      if (label === "Duplicate Tickets") { const copies = selTickets.map((t, i) => ({ ...t, id: t.id + 900000 + i, status: "New", created: "just now" })); setTickets((ts) => [...copies, ...ts]); done("Tickets duplicated", `${copies.length} copies created.`); return; }
      if (label === "Archive Tickets") { patchSel({ status: "Closed", trash: false }); done("Tickets archived", `${selCount} archived.`); return; }
      if (label === "Restore Tickets") { patchSel({ trash: false, spam: false }); done("Tickets restored", `${selCount} restored.`); return; }
      if (label === "Print Ticket Summary") { const ok = exportPDF("Ticket Summary", ["Ticket ID", "Customer Name", "Subject", "Status", "Priority"], selTickets.map((t) => ({ "Ticket ID": t.id, "Customer Name": t.name, "Subject": t.subject, "Status": t.status, "Priority": t.priority }))); push(ok ? { type: "success", title: "Opening print dialog" } : { type: "error", title: "Popup blocked" }); return; }
      push({ type: "info", title: label, desc: `${label} applied to ${selCount} ticket${selCount > 1 ? "s" : ""}.` });
      clearSel();
    },
  };

  const doExport = (kind) => {
    setExpOpen(false);
    try {
      const data = rows.map((t) => ({
        "Ticket Number": t.id, "Customer Name": t.name, "Email": t.email, "Phone": t.phone,
        "Subject": t.subject, "Category": t.category, "Priority": t.priority, "Status": t.status,
        "Assigned Agent": t.agent, "Source": t.source, "Department": t.dept,
        "Created": t.created, "Last Activity": t.lastActivity,
        "First Response Due": t.firstResp, "Resolution Due": t.resolution, "SLA Status": t.sla,
      }));
      if (!data.length) { push({ type: "error", title: "Nothing to export", desc: "No tickets match the current view." }); return; }
      const label = VIEWS.find((v) => v.key === view)?.label.replace(/ /g, "-").toLowerCase() || "tickets";
      if (kind === "xlsx") { exportExcel(data, `${label}.xlsx`); push({ type: "success", title: "Export ready", desc: `${data.length} tickets → ${label}.xlsx` }); }
      else if (kind === "csv") { exportCSV(data, `${label}.csv`); push({ type: "success", title: "Export ready", desc: `${data.length} tickets → ${label}.csv` }); }
      else if (kind === "json") { downloadBlob(JSON.stringify(data, null, 2), `${label}.json`, "application/json"); push({ type: "success", title: "Export ready", desc: `${data.length} tickets → ${label}.json` }); }
      else { const ok = exportPDF("Tickets Report", ["Ticket Number","Customer Name","Subject","Category","Priority","Status","Assigned Agent"], data); push(ok ? { type: "success", title: "Opening print dialog", desc: "Choose “Save as PDF”." } : { type: "error", title: "Popup blocked", desc: "Allow popups to export PDF." }); }
    } catch (e) { push({ type: "error", title: "Export failed", desc: "Could not generate the file." }); }
  };

  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const clampedPage = Math.min(page, pages);
  const viewRows = rows.slice((clampedPage-1)*perPage, clampedPage*perPage);
  useEffect(() => { setPage(1); }, [q, applied, perPage, sort]);

  return (
    <div className="content route">
      <div className="page-head">
        <div><h1>All Tickets <span className="count-badge">{counts.all} total</span></h1><p>Manage, monitor, and resolve customer support tickets efficiently.</p></div>
      </div>

      <div className="toolbar">
        <div className="searchbox" style={{ maxWidth:260, flex:"initial", width:260 }}><Search size={16} /><input placeholder="Search tickets..." value={q} onChange={(e)=>setQ(e.target.value)} /></div>
        <SortDropdown value={sort} onChange={setSort} />
        <button className="btn btn-ghost" onClick={() => { setDraft(applied); setDrawer(true); }}>
          <Filter size={15} /> Filters{activeFilterCount > 0 && <span className="count-badge" style={{fontSize:11,padding:"1px 8px"}}>{activeFilterCount}</span>}
        </button>
        <div className="seg" style={{ marginLeft:6 }}>
          <button className={layout==="card"?"on":""} onClick={()=>setLayout("card")}><LayoutGrid size={15} /> Card</button>
          <button className={layout==="table"?"on":""} onClick={()=>setLayout("table")}><Rows3 size={15} /> Table</button>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          <div className="dd-wrap" ref={expRef}>
            <button className="btn btn-ghost" onClick={() => setExpOpen((o) => !o)}><Download size={15} /> Export <ChevronDown size={13} /></button>
            {expOpen && (
              <div className="menu menu-top right" style={{ minWidth: 190 }}>
                <button className="mi" onClick={() => doExport("xlsx")}><span className="mic" style={{ background: "#10B98118", color: "#10B981" }}><FileSpreadsheet size={15} /></span><span>Excel (.xlsx)<small>{rows.length} tickets in view</small></span></button>
                <button className="mi" onClick={() => doExport("csv")}><span className="mic" style={{ background: "#0EA5E918", color: "#0EA5E9" }}><FileText size={15} /></span> CSV (.csv)</button>
                <button className="mi" onClick={() => doExport("json")}><span className="mic" style={{ background: "#5B5CEB18", color: "#5B5CEB" }}><Code size={15} /></span> JSON (.json)</button>
                <button className="mi" onClick={() => doExport("pdf")}><span className="mic" style={{ background: "#EF444418", color: "#EF4444" }}><Printer size={15} /></span> PDF (print)</button>
              </div>
            )}
          </div>
          <button className="icon-btn" title="Refresh tickets" onClick={refresh}>{loading ? <Loader2 size={17} className="spin" /> : <RotateCcw size={17} />}</button>
          <button className="icon-btn" title={canBack ? "Back" : "No history yet"} onClick={back} disabled={!canBack}><ArrowLeft size={17} /></button>
          <button className="icon-btn" title={canFwd ? "Forward" : "Nothing ahead"} onClick={fwd} disabled={!canFwd}><ArrowRight size={17} /></button>
        </div>
      </div>

      {selCount > 0 && <BulkBar count={selCount} selTickets={selTickets} actions={actions} />}

      <div className="tickets-layout">
        <TicketSidebar view={view} setView={setView} counts={counts} />
        <div>
          {!loading && viewRows.length > 0 && (
            <div className="selall">
              <button className={`selbox ${viewRows.every((t) => sel.includes(t.id)) && viewRows.length ? "on" : ""}`}
                onClick={() => { const ids = viewRows.map((t) => t.id); const all = ids.every((id) => sel.includes(id)); setSel(all ? sel.filter((id) => !ids.includes(id)) : Array.from(new Set([...sel, ...ids]))); }}>
                {viewRows.every((t) => sel.includes(t.id)) && viewRows.length ? <Check size={12} /> : null}
              </button>
              Select all {viewRows.length} on this page{selCount > 0 && <span style={{ marginLeft: "auto", color: "var(--primary)", fontWeight: 700 }}>{selCount} selected</span>}
            </div>
          )}
          {loading ? <Skeletons layout={layout} /> : (
            layout === "card" ? (
              viewRows.length ? <div style={{display:"flex",flexDirection:"column",gap:14}}>{viewRows.map((t, i) => <TicketCard key={t.id} t={t} i={i} hoverId={hover.t?.id} onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave} onOpen={onOpen} selected={sel.includes(t.id)} onToggle={toggleSel} />)}</div>
              : <div className="card card-pad" style={{textAlign:"center",padding:"48px",color:"var(--muted)"}}><Inbox size={30} style={{opacity:.4,marginBottom:10}} /><div style={{fontWeight:600}}>No tickets here</div><div style={{fontSize:13,marginTop:4}}>Try a different view or clear your filters.</div></div>
            ) : <TicketTable rows={viewRows} hoverId={hover.t?.id} onHoverEnter={onHoverEnter} onHoverLeave={onHoverLeave} onOpen={onOpen} sel={sel} onToggle={toggleSel} />
          )}

          {!loading && rows.length > 0 && (
            <div className="pager">
              <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
                <div className="info">Showing {(clampedPage-1)*perPage+1}–{Math.min(clampedPage*perPage, rows.length)} of {rows.length} tickets</div>
                <div className="perpage">Per page <select value={perPage} onChange={(e)=>setPerPage(Number(e.target.value))}>{[5,20,80,100].map(n=><option key={n} value={n}>{n}</option>)}</select></div>
              </div>
              <div className="pg-btns">
                <button disabled={clampedPage===1} onClick={()=>goPage(clampedPage-1)}><ChevronLeft size={15} /> Prev</button>
                {Array.from({length:pages},(_,i)=>i+1).map((p) => <button key={p} className={p===clampedPage?"on":""} onClick={()=>goPage(p)}>{p}</button>)}
                <button disabled={clampedPage===pages} onClick={()=>goPage(clampedPage+1)}>Next <ChevronRight size={15} /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {hover.t && hover.el && <TicketHoverPreview t={hover.t} anchor={hover.el} onOpen={onOpen} onEnter={clearHoverTimer} onLeave={onHoverLeave} onClose={closeHover} onAction={hoverAction} />}

      <BulkAssignModal open={modal === "assign"} count={selCount} onClose={() => setModal(null)}
        onApply={({ agent, dept }) => { patchSel({ agent, dept }); done("Tickets assigned", `${selCount} assigned to ${agent}.`); }} />
      <BulkUpdateModal open={modal === "update"} count={selCount} onClose={() => setModal(null)}
        onApply={(f) => {
          const n = selCount;
          patchSel((t) => ({
            ...(f.type ? { type: f.type } : {}),
            ...(f.status ? { status: f.status, unresolved: !["Resolved", "Closed"].includes(f.status) } : {}),
            ...(f.priority ? { priority: f.priority } : {}),
            ...(f.agent ? { agent: f.agent === "Support Queue (Unassigned)" ? "Unassigned" : f.agent } : {}),
            ...(f.reply ? { convo: [...t.convo, { who: "agent", msg: f.reply, at: "just now", att: false }], responseStatus: "Agent responded", custReplied: false, newReplies: 0 } : {}),
            lastActivity: "just now",
          }));
          setModal(null); clearSel();
          refresh();
          push({ type: "success", title: `${n} ticket${n > 1 ? "s" : ""} updated successfully.`, desc: [f.type && `Type: ${f.type}`, f.status && `Status: ${f.status}`, f.priority && `Priority: ${f.priority}`, f.agent && `Agent: ${f.agent}`, f.reply && "Reply sent"].filter(Boolean).join(" · ") });
        }} />
      <MergeModal open={modal === "merge"} tickets={selTickets} onClose={() => setModal(null)}
        onApply={(primaryId) => {
          const others = selTickets.filter((t) => t.id !== primaryId);
          const merged = others.flatMap((t) => t.convo);
          setTickets((ts) => ts.map((t) => t.id === primaryId ? { ...t, convo: [...t.convo, ...merged], tags: Array.from(new Set([...(t.tags || []), "Merged"])) }
            : sel.includes(t.id) ? { ...t, status: "Closed", unresolved: false, subject: t.subject + " (merged)" } : t));
          done("Tickets merged", `${others.length} merged into #${primaryId}; conversations preserved.`);
        }} />
      <TagsModal open={modal === "addTags"} mode="add" count={selCount} existing={selExisting} onClose={() => setModal(null)}
        onApply={(tags) => { patchSel((t) => ({ tags: Array.from(new Set([...(t.tags || []), ...tags])) })); done("Tags added", `${tags.join(", ")} → ${selCount} tickets.`); }} />
      <TagsModal open={modal === "removeTags"} mode="remove" count={selCount} existing={selExisting} onClose={() => setModal(null)}
        onApply={(tags) => { patchSel((t) => ({ tags: (t.tags || []).filter((x) => !tags.includes(x)) })); done("Tags removed", `${tags.join(", ")} removed.`); }} />
      <PickModal open={modal === "priority"} title={`Change priority · ${selCount} tickets`} icon={ArrowUp} options={["Low", "Medium", "High", "Critical"]}
        onClose={() => setModal(null)} onApply={(v) => { patchSel({ priority: v }); done("Priority updated", `${selCount} set to ${v}.`); }} />
      <PickModal open={modal === "status"} title={`Change status · ${selCount} tickets`} icon={Activity} options={STATUS_OPTS}
        onClose={() => setModal(null)} onApply={(v) => { patchSel({ status: v, unresolved: !["Resolved", "Closed"].includes(v) }); done("Status updated", `${selCount} set to ${v}.`); }} />
      <ConfirmDialog open={!!confirm} danger={confirm?.danger} title={confirm?.title || ""} message={confirm?.msg || ""} confirmLabel={confirm?.label || "Confirm"}
        onConfirm={() => confirm?.run()} onClose={() => setConfirm(null)} />

      <FilterDrawer open={drawer} onClose={()=>setDrawer(false)} draft={draft} setDraft={setDraft}
        onApply={()=>{ setApplied(draft); setDrawer(false); }} onReset={()=>{ setDraft(EMPTY); setApplied(EMPTY); }} />
    </div>
  );
}

/* ============================================================================
   TICKET DETAIL  (conversation + reply composer + /c canned responses)
   ========================================================================== */
const bodyFor = (t) => `Hi team,\n\nI'm writing regarding "${t.subject}". I've already tried the usual steps from my ${t.source.toLowerCase()} account but the issue is still not resolved on my end.\n\nCould you please look into this and let me know the next steps? Happy to share screenshots or my registered details if that helps.\n\nThanks,\n${t.name}`;

function CannedPopup({ query, setQuery, onPick, onClose }) {
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  const inputRef = useRef(null);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CANNED_SEED.filter(r => r.active && (r.name + " " + r.cat).toLowerCase().includes(q));
  }, [query]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setHi(0); }, [query]);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setHi(i => Math.min(i + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (list[hi]) onPick(list[hi]); }
  };

  return (
    <div className="canned-pop" ref={ref} onKeyDown={onKey}>
      <div className="cp-search">
        <Search size={16} color="var(--muted)" />
        <input ref={inputRef} placeholder="Search for canned responses" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={onClose}><X size={14} /></button>
      </div>
      <div className="cp-lab">{query.trim() ? "Results" : "Recently used"}</div>
      <div className="cp-list">
        {list.length ? list.map((r, i) => (
          <div key={r.name} className={`cp-item ${i === hi ? "hi" : ""}`} onMouseEnter={() => setHi(i)} onClick={() => onPick(r)}>
            <MessageSquareText size={15} color="var(--primary)" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div className="cp-nm">{r.name}</div>
              <div className="cp-ct">{r.cat} · used {r.uses} times</div>
            </div>
          </div>
        )) : <div className="cp-empty">No canned responses match “{query}”.</div>}
      </div>
    </div>
  );
}

/* ============================================================================
   EMAIL SIGNATURE LAYER — Freshdesk-style auto signatures
   ========================================================================== */
const SIG_KEY = "hh-signature";
const SIG_DEFAULT = {
  enabled: true,
  applyForward: false,
  template: "Regards,\n\n{{Agent Name}}\n{{Designation}}\n{{Company Name}}",
  teams: {}, // e.g. { "Tech Support": "custom template" }
};
const SIG_PLACEHOLDERS = ["{{Agent Name}}", "{{Designation}}", "{{Department}}", "{{Company Name}}", "{{Support Email}}", "{{Phone Number}}"];

function getSigSettings() {
  try { return { ...SIG_DEFAULT, ...JSON.parse(kvGetSync(SIG_KEY) || "{}") }; } catch (e) { return { ...SIG_DEFAULT }; }
}
function saveSigSettings(next) { kvSet(SIG_KEY, JSON.stringify(next)); }

const TEAM_KEY = "hh-team";
function getTeamRoster() {
  try { const r = JSON.parse(kvGetSync(TEAM_KEY) || "null"); if (Array.isArray(r) && r.length) return r; } catch (e) {}
  return SEED_AGENTS;
}

/* Identity resolution for signatures — Freshdesk-style:
   1) who is logged in (auth session)  2) their record in Settings → Team Management
   3) the Admin Profile page  4) safe defaults.  Nothing is hardcoded per-agent. */
function currentAgentProfile() {
  const ses = authApi.sessionSync();
  const email = (ses && ses.email) || "";
  const roster = getTeamRoster();
  const rec = email ? roster.find((a) => (a.email || "").toLowerCase() === email.toLowerCase()) : null;
  if (rec) return { name: rec.name, role: rec.role, dept: rec.dept, team: rec.team, email: rec.email, phone: rec.phone };
  let p = { ...PROFILE_DEFAULT };
  try { p = { ...p, ...JSON.parse(kvGetSync("hh-profile") || "{}") }; } catch (e) {}
  if (ses && ses.name) p.name = ses.name;
  if (email) p.email = email;
  return { name: p.name, role: (p.role || "").split(" - ")[0].trim(), dept: (p.role || "").split(" - ")[1] || "", team: "", email: p.email, phone: p.phone };
}

function resolveSignature(settings, dept) {
  const st = settings || getSigSettings();
  if (!st.enabled) return "";
  const p = currentAgentProfile();
  // priority: this agent's own signature → team signature (ticket dept) → company default
  const tpl = (st.users && p.email && st.users[p.email.toLowerCase()])
    || (dept && st.teams && st.teams[dept])
    || st.template || "";
  return tpl
    .replaceAll("{{Agent Name}}", p.name || "")
    .replaceAll("{{loggedInUser.fullName}}", p.name || "")
    .replaceAll("{{Designation}}", p.role || "Support Executive")
    .replaceAll("{{loggedInUser.designation}}", p.role || "Support Executive")
    .replaceAll("{{Department}}", p.dept || dept || "")
    .replaceAll("{{loggedInUser.department}}", p.dept || dept || "")
    .replaceAll("{{Company Name}}", "Internship Studio")
    .replaceAll("{{loggedInUser.companyName}}", "Internship Studio")
    .replaceAll("{{Support Email}}", "contact@internshipstudio.com")
    .replaceAll("{{loggedInUser.supportEmail}}", "contact@internshipstudio.com")
    .replaceAll("{{Phone Number}}", p.phone || "")
    .replaceAll("{{loggedInUser.phone}}", p.phone || "");
}

function ReplyComposer({ ticket, onSend, mode, focusTick, onClose }) {
  const push = useToast();
  const [tab, setTab] = useState("Reply");
  useEffect(() => { if (mode) setTab(mode); }, [mode]);
  const sigSettings = getSigSettings();
  const sigText = resolveSignature(sigSettings, ticket.dept);
  const greet = `Hi ${ticket.name.split(" ")[0]},\n\n`;
  const initialBody = greet + (sigText ? `\n\n${sigText}` : "");
  useEffect(() => {
    if (!focusTick) return;
    // Focus after the 280ms slide, then park the cursor ABOVE the signature
    setTimeout(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      if (ta.value.startsWith(greet)) ta.setSelectionRange(greet.length, greet.length);
    }, 300);
  }, [focusTick]);
  const [body, setBody] = useState(initialBody);
  const [to, setTo] = useState(ticket.email);
  const [fwdTo, setFwdTo] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [note, setNote] = useState("");
  const [fwdNote, setFwdNote] = useState(() => (sigSettings.applyForward && sigText ? "\n\n" + sigText : ""));
  const [keepThread, setKeepThread] = useState(true);
  const [cpOpen, setCpOpen] = useState(false);
  const [cpQ, setCpQ] = useState("");
  const [trigIdx, setTrigIdx] = useState(-1);
  const [saved, setSaved] = useState(false);
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return;
    const onKey = (e) => { if (e.key === "Escape") setFull(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [full]);
  const taRef = useRef(null);
  const autoGrow = () => { const ta = taRef.current; if (!ta || full) return; ta.style.height = "auto"; ta.style.height = Math.max(420, ta.scrollHeight) + "px"; };

  const isNote = tab === "Note", isFwd = tab === "Forward";
  const value = isNote ? note : isFwd ? fwdNote : body;
  const setValue = isNote ? setNote : isFwd ? setFwdNote : setBody;

  const change = (e) => {
    const v = e.target.value, pos = e.target.selectionStart;
    setValue(v); setSaved(true);
    requestAnimationFrame(autoGrow);
    // "/c" typed → open the canned response search (reply & forward only)
    if (!isNote && /\/c$/i.test(v.slice(0, pos))) { setTrigIdx(pos - 2); setCpQ(""); setCpOpen(true); }
  };
  const pick = (r) => {
    setValue(b => (trigIdx >= 0 ? b.slice(0, trigIdx) + r.body + b.slice(trigIdx + 2) : b + r.body));
    setCpOpen(false); setTrigIdx(-1);
    setTimeout(() => taRef.current?.focus(), 0);
  };
  const closePop = () => { setCpOpen(false); setTrigIdx(-1); taRef.current?.focus(); };

  const send = () => {
    if (!value.trim()) return;
    if (isNote) { onSend({ type:"note", body:note }); setNote(""); }
    else if (isFwd) {
      if (!fwdTo.trim()) return;
      onSend({ type:"forward", body:fwdNote, to:fwdTo, cc, bcc, keepThread });
      setFwdNote(""); setFwdTo("");
    } else { onSend({ type:"reply", body, to }); setBody(initialBody); }
    setSaved(false);
  };

  const RTE = [Bold, Italic, Underline, "d", Heading1, Heading2, Type, "d", List, ListOrdered, "d", Link2, ImageIcon, TableIcon, Code];

  return (
    <>
    {full && <div className="comp-fs-backdrop" onClick={() => setFull(false)} />}
    <div className={`composer ${isNote ? "comp-note" : ""} ${full ? "comp-fs" : ""}`}>
      <div className="comp-tabs">
        {[["Reply", Reply], ["Note", Lock], ["Forward", Forward]].map(([k, Ic]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}><Ic size={15} /> {k}</button>
        ))}
        <button style={{ marginLeft: "auto" }} title={full ? "Exit fullscreen (Esc)" : "Fullscreen compose"} onClick={() => setFull((f) => !f)}><Maximize2 size={15} style={full ? { transform: "rotate(180deg)" } : undefined} /></button>
        {onClose && <button title="Close editor — your draft is kept" onClick={() => { setFull(false); onClose(); }}><X size={16} /></button>}
      </div>

      {isNote && (
        <div className="note-banner"><Lock size={14} /> Internal note — visible to your team only. The customer will never see this.</div>
      )}

      {tab === "Reply" && (<>
        <div className="comp-addr">
          <span className="lb">From</span>
          <span style={{ fontWeight: 700 }}>IS Support</span>
          <span style={{ color: "var(--muted)" }}>(contact@internshipstudio.com)</span>
        </div>
        <div className="comp-addr">
          <span className="lb">To</span>
          <input value={to} onChange={(e) => setTo(e.target.value)} />
          <span className="cc"><button onClick={() => setShowCc(s => !s)}>Cc</button><button onClick={() => setShowCc(s => !s)}>Bcc</button></span>
        </div>
        {showCc && (<>
          <div className="comp-addr"><span className="lb">Cc</span><input placeholder="cc@istudio.in" value={cc} onChange={(e) => setCc(e.target.value)} /></div>
          <div className="comp-addr"><span className="lb">Bcc</span><input placeholder="bcc@istudio.in" value={bcc} onChange={(e) => setBcc(e.target.value)} /></div>
        </>)}
      </>)}

      {isFwd && (<>
        <div className="comp-addr">
          <span className="lb">To</span>
          <input placeholder="Forward to anyone — name@company.com" value={fwdTo} onChange={(e) => setFwdTo(e.target.value)} autoFocus />
          <span className="cc"><button onClick={() => setShowCc(s => !s)}>Cc</button><button onClick={() => setShowCc(s => !s)}>Bcc</button></span>
        </div>
        {showCc && (<>
          <div className="comp-addr"><span className="lb">Cc</span><input placeholder="cc@istudio.in" value={cc} onChange={(e) => setCc(e.target.value)} /></div>
          <div className="comp-addr"><span className="lb">Bcc</span><input placeholder="bcc@istudio.in" value={bcc} onChange={(e) => setBcc(e.target.value)} /></div>
        </>)}
        <div className="comp-addr">
          <span className="lb" style={{ width: "auto" }}>Subject</span>
          <input readOnly value={`Fwd: ${ticket.subject} (#${ticket.id})`} style={{ color: "var(--muted)" }} />
        </div>
      </>)}

      <div className="comp-area">
        <textarea ref={taRef} value={value} onChange={change}
          placeholder={isNote ? "Add an internal note for your team…  (@mention a teammate)"
            : isFwd ? "Add a message above the forwarded conversation…  ( type /c for a canned response )"
            : "Type your response here…  ( type /c to insert a canned response )"} />
        {cpOpen && <CannedPopup query={cpQ} setQuery={setCpQ} onPick={pick} onClose={closePop} />}
      </div>

      {isFwd && (
        <div style={{ padding: "0 16px 12px" }}>
          <div className="quote"><b>---------- Forwarded message ----------</b>{"\n"}From: {ticket.name} &lt;{ticket.email}&gt;{"\n"}Subject: {ticket.subject}{"\n\n"}{bodyFor(ticket).slice(0, 180)}…</div>
          <label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            <Switch on={keepThread} onChange={setKeepThread} /> Retain original email thread
          </label>
        </div>
      )}

      {!isNote && (
        <div className="rte">
          {RTE.map((Ic, i) => Ic === "d" ? <span className="div" key={i} /> : <button key={i}><Ic size={16} /></button>)}
          <span className="div" />
          <button title="Attach"><Paperclip size={16} /></button>
          <button title="Canned responses" onClick={() => { setTrigIdx(-1); setCpQ(""); setCpOpen(true); }}><MessageSquareText size={16} /></button>
          <button title="Knowledge base"><BookOpen size={16} /></button>
        </div>
      )}

      <div className="comp-foot">
        <span className="hint">
          {isNote ? <><Lock size={12} /> Only agents on your team can read this</> : <>Tip: type <code>/c</code> for canned responses</>}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="char-count">{value.trim() ? value.trim().split(/\s+/).length : 0} words · {value.length} chars</span>
          {saved && <span className="saved">Saved</span>}
          <button className="btn btn-soft btn-sm" title="Save draft" onClick={() => { setSaved(true); push({ type: "success", title: "Draft saved", desc: "Your draft is kept until you leave this ticket." }); }}><Save size={14} /> Save Draft</button>
          <button className="icon-btn" title="Discard draft" onClick={() => { setValue(""); setSaved(false); }}><Trash2 size={16} /></button>
          <button className="btn btn-primary" onClick={send}>
            {isNote ? <><Lock size={15} /> Add Note</> : isFwd ? <><Forward size={15} /> Forward</> : <><Send size={15} /> Send</>}
          </button>
        </span>
      </div>
    </div>
    </>
  );
}

/* ---- student / contact profile ---- */
function ContactPanel({ ticket }) {
  const t = ticket;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="who">
        <span className="wa" style={{ background: avColor(t.name) }}>{initials(t.name)}</span>
        <div style={{ minWidth: 0 }}>
          <div className="wn">{t.name}</div>
          <div className="wm">{t.registered ? <>Student · {t.college}</> : <>Contact · not registered</>}</div>
        </div>
        {t.registered && <BadgeCheck size={19} color="var(--success)" style={{ marginLeft: "auto", flexShrink: 0 }} />}
      </div>

      <div className="cp-stu">
        <div className="cp-stu-head">
          <span className="cp-stu-title"><GraduationCap size={13} /> Student Context</span>
          <span className="ai-ready" title="Structured attributes available for AI automation"><Sparkles size={10} /> AI Context Ready</span>
        </div>
        {stuPills(t.studentContext).map((p) => (
          <div key={p.key} className="cp-stu-row">
            <span className="k">{{ registrationStatus: "Registration", domain: "Domain", examStatus: "Exam", startDate: "Start Date", projectStatus: "Project", refundEligibility: "Refund", batch: "Batch", enrollmentStatus: "Enrollment" }[p.key]}</span>
            <span className={`v tv-${p.tone}`}>{!!p.check && <Check size={10} strokeWidth={3.2} />}{p.text.replace(/^(Start|Project|Batch|Status): /, "")}</span>
          </div>
        ))}
      </div>

      {(() => {
        const cc = CALLS_SEED.filter((c) => c.customerId === t.id);
        if (!cc.length) return null;
        const miss = cc.filter((c) => c.callType === "Missed" || c.status === "Missed").length;
        return (
          <div className="cp-calls">
            <div className="cp-calls-head"><PhoneCall size={13} /> Customer Calls</div>
            <div className="cp-calls-row"><b>{cc.length}</b> previous call{cc.length !== 1 ? "s" : ""}{miss > 0 && <span className="cp-miss">{miss} missed</span>}</div>
            <div className="cp-calls-last">Last call: {cc[0].day} — {cc[0].time}</div>
          </div>
        );
      })()}

      <div className="info">
        <div className="info-row"><span className="ii"><AtSign size={14} /></span><div style={{ minWidth: 0 }}><div className="il">Email</div><a className="iv" href={`mailto:${t.email}`}>{t.email}</a></div></div>
        <div className="info-row"><span className="ii"><PhoneCall size={14} /></span><div><div className="il">Contact number</div><a className="iv" href={`tel:${t.phone.replace(/ /g, "")}`}>{t.phone}</a></div></div>
        <div className="info-row"><span className="ii"><Ticket size={14} /></span><div><div className="il">Ticket history</div><div className="iv">{t.totalTickets} tickets · customer since {t.joined}</div></div></div>
      </div>

      {t.registered ? (
        <div className="intern">
          <div className="intern-head">
            <span className="t"><GraduationCap size={13} /> Internship details</span>
            <span className="badge-pill" style={{ background: t.planStatus === "Completed" ? "var(--success-soft)" : t.planStatus === "On Hold" ? "var(--warning-soft)" : "var(--primary-soft)", color: t.planStatus === "Completed" ? "var(--success)" : t.planStatus === "On Hold" ? "var(--warning)" : "var(--primary)" }}>{t.planStatus}</span>
          </div>
          <div className="kv"><span className="k">Enrollment ID</span><span className="v">{t.enrollId}</span></div>
          <div className="kv"><span className="k">Program</span><span className="v">{t.program}</span></div>
          <div className="kv"><span className="k">Batch</span><span className="v">{t.batch}</span></div>
          <div className="kv"><span className="k">Start date</span><span className="v">{t.startDate}</span></div>
          <div className="kv"><span className="k">Duration</span><span className="v">{t.duration}</span></div>
          <div className="kv"><span className="k">Mentor</span><span className="v">{t.mentor}</span></div>
          <div className="prog">
            <div className="pl"><span style={{ color: "var(--muted)" }}>Course progress</span><span style={{ color: "var(--primary)" }}>{t.progress}%</span></div>
            <div className="pb"><i style={{ width: `${t.progress}%` }} /></div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center", marginTop: 14 }}><Briefcase size={14} /> View full profile</button>
        </div>
      ) : (
        <div className="noreg">
          <GraduationCap size={26} color="var(--faint)" />
          <p>No internship registered against this email yet.</p>
          <button className="btn btn-soft btn-sm" style={{ width: "100%", justifyContent: "center" }}><Search size={14} /> Search enrollments</button>
        </div>
      )}
    </div>
  );
}

function PropertiesPanel({ ticket }) {
  const [status, setStatus] = useState(ticket.status);
  const [prio, setPrio] = useState(ticket.priority);
  const [agent, setAgent] = useState(ticket.agent);
  const [tags, setTags] = useState([ticket.category]);
  const [type, setType] = useState(ticket.type || "—");
  const [tq, setTq] = useState("");
  const addTag = (e) => { if (e.key === "Enter" && tq.trim()) { setTags(t => t.includes(tq.trim()) ? t : [...t, tq.trim()]); setTq(""); } };
  const overdue = ticket.sla === "Breached";
  return (
    <div className="card">
      <div className="props-head"><h3>{status}</h3><button className="icon-btn" style={{ width: 32, height: 32 }}><PanelRight size={16} /></button></div>
      <div className="sla-row">
        <span className="si" style={{ background: overdue ? "var(--danger-soft)" : "var(--warning-soft)", color: overdue ? "var(--danger)" : "var(--warning)" }}><CornerUpLeft size={14} /></span>
        <div><div className="st">First response {overdue ? "overdue by an hour" : `due ${ticket.firstResp}`}</div><div className="sd">Sat 18 Jul 2026, 03:11 pm</div></div>
      </div>
      <div className="sla-row">
        <span className="si" style={{ background: "var(--success-soft)", color: "var(--success)" }}><Timer size={14} /></span>
        <div><div className="st">Resolution due {ticket.resolution}</div><div className="sd">Mon 20 Jul 2026, 03:11 pm</div></div>
      </div>
      <div className="props-body">
        <div className="plab">Properties</div>
        <div>
          <label style={{ display: "block", marginBottom: 7, fontSize: 12, fontWeight: 600 }}>Tags</label>
          <input placeholder="Search tags to add" value={tq} onChange={(e) => setTq(e.target.value)} onKeyDown={addTag} />
          <div className="tagbox">{tags.map(t => (<span className="tg" key={t}><TagIcon size={11} /> {t}<button onClick={() => setTags(x => x.filter(y => y !== t))}><X size={11} /></button></span>))}</div>
        </div>
        {[
          ["Type", ["—", "Question", "Incident", "Problem", "Feature Request", "Refund"], type, setType],
          ["Status", ["New", "Open", "Pending", "Overdue", "Resolved", "Closed"], status, setStatus],
          ["Priority", ["Low", "Medium", "High", "Urgent", "Critical"], prio, setPrio],
          ["Group", ["—", "Student Success", "Payments", "Tech Support", "Placements"], null, null],
          ["Agent", AGENTS, agent, setAgent],
        ].map(([lab, opts, val, set]) => (
          <div key={lab}>
            <label style={{ display: "block", marginBottom: 7, fontSize: 12, fontWeight: 600 }}>{lab}{lab === "Status" && <span style={{ color: "var(--danger)" }}> *</span>}</label>
            {set ? <select value={val} onChange={(e) => set(e.target.value)}>{opts.map(o => <option key={o}>{o}</option>)}</select>
                 : <select defaultValue={opts[0]}>{opts.map(o => <option key={o}>{o}</option>)}</select>}
          </div>
        ))}
        <button className="btn btn-primary" style={{ justifyContent: "center", marginTop: 4 }}>Update</button>
      </div>
    </div>
  );
}

function ThreadEntry({ e }) {
  if (e.type === "note") return (
    <div className="entry">
      <div className="msg-av" style={{ background: "var(--warning)" }}>AD</div>
      <div className="note-card">
        <span className="note-tag"><Lock size={11} /> Internal note · team only</span>
        <div className="msg-head" style={{ marginBottom: 7 }}><b>Admin</b> added a private note · <i>{e.when}</i></div>
        <div className="msg-body">{e.body}</div>
      </div>
    </div>
  );
  if (e.type === "forward") return (
    <div className="entry">
      <div className="msg-av" style={{ background: "var(--accent)" }}>AD</div>
      <div className="fwd-card">
        <span className="fwd-tag"><Forward size={11} /> Forwarded</span>
        <div className="msg-head" style={{ marginBottom: 7 }}><b>Admin</b> forwarded this ticket to <b>{e.to}</b> · <i>{e.when}</i></div>
        {e.cc && <div className="msg-to" style={{ margin: "0 0 6px" }}>Cc: {e.cc}</div>}
        {e.body && <div className="msg-body">{e.body}</div>}
        {e.keepThread && <div className="quote">Original conversation was included in the forward.</div>}
      </div>
    </div>
  );
  return (
    <div className="entry">
      <div className="msg-av" style={{ background: "linear-gradient(135deg,var(--primary),var(--accent))" }}>AD</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="msg-head"><b>Admin</b> replied via email · <i>{e.when}</i></div>
        <div className="msg-to">To: {e.to}</div>
        <div className="msg-body">{e.body}</div>
      </div>
    </div>
  );
}

/* ---- ticket-detail sub-modals ---- */
function TdPickModal({ open, title, icon: Ic, options, current, onClose, onApply }) {
  const [v, setV] = useState(current || options[0]);
  useEffect(() => { if (open) setV(current || options[0]); }, [open, current, options]);
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB", width: 32, height: 32 }}><Ic size={16} /></span>{title}</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <div className="chips">{options.map((o) => <button key={o} className={`fchip ${v === o ? "on" : ""}`} onClick={() => setV(o)}>{o}</button>)}</div>
          {current && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Currently: <b style={{ color: "var(--text)" }}>{current}</b></div>}
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" disabled={v === current} onClick={() => onApply(v)}><Check size={15} /> Apply</button></div>
      </div>
    </div>
  );
}

function TdTagsModal({ open, title, existing, bank, onClose, onApply }) {
  const [sel, setSel] = useState([]);
  const [custom, setCustom] = useState("");
  useEffect(() => { if (open) { setSel([]); setCustom(""); } }, [open]);
  if (!open) return null;
  const available = bank.filter((t) => !existing.includes(t));
  const toggle = (t) => setSel((x) => x.includes(t) ? x.filter((y) => y !== t) : [...x, t]);
  const addCustom = () => { const v = custom.trim(); if (!v) return; if (!sel.includes(v)) setSel((x) => [...x, v]); setCustom(""); };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#F59E0B18", color: "#F59E0B", width: 32, height: 32 }}><TagIcon size={16} /></span>{title}</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          {existing.length > 0 && <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 6 }}>Already tagged</div>
            <div className="chips">{existing.map((t) => <span key={t} className="fchip" style={{ cursor: "default", opacity: .7 }}><TagIcon size={11} /> {t}</span>)}</div>
          </div>}
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--faint)", margin: "8px 0 6px" }}>Pick tags</div>
            {available.length ? <div className="chips">{available.map((t) => <button key={t} className={`fchip ${sel.includes(t) ? "on" : ""}`} onClick={() => toggle(t)}><TagIcon size={11} /> {t}</button>)}</div>
              : <div style={{ fontSize: 12.5, color: "var(--muted)" }}>All standard tags are already applied.</div>}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input placeholder="Or add a custom tag…" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
            <button className="btn btn-soft btn-sm" disabled={!custom.trim()} onClick={addCustom}><PlusCircle size={13} /> Add</button>
          </div>
          {sel.length > 0 && <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--faint)", margin: "10px 0 6px" }}>Selected</div>
            <div className="tagbox">{sel.map((t) => <span key={t} className="tg"><TagIcon size={11} /> {t}<button onClick={() => setSel((x) => x.filter((y) => y !== t))}><X size={11} /></button></span>)}</div>
          </div>}
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" disabled={!sel.length} onClick={() => onApply(sel)}><Check size={15} /> Add {sel.length || ""}</button></div>
      </div>
    </div>
  );
}

function TdMergeModal({ open, ticket, tickets, onClose, onApply }) {
  const [q, setQ] = useState("");
  const [target, setTarget] = useState(null);
  useEffect(() => { if (open) { setQ(""); setTarget(null); } }, [open]);
  if (!open) return null;
  const term = q.trim().toLowerCase();
  const candidates = tickets.filter((t) => t.id !== ticket.id && !t.trash && !t.spam)
    .filter((t) => !term || [t.id, t.subject, t.name].join(" ").toLowerCase().includes(term))
    .slice(0, 20);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#8B5CF618", color: "#8B5CF6", width: 32, height: 32 }}><FolderInput size={16} /></span>Merge #{ticket.id} into…</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>Pick the ticket to keep as primary. This ticket's conversation is moved into it, then this one is closed as a duplicate.</p>
          <div className="searchbox"><Search size={16} /><input placeholder="Search by ticket #, subject, or customer…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div style={{ maxHeight: 300, overflow: "auto", border: "1px solid var(--border)", borderRadius: 12 }}>
            {candidates.length ? candidates.map((t) => (
              <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid var(--border)", background: target?.id === t.id ? "var(--primary-soft)" : undefined }}>
                <input type="radio" checked={target?.id === t.id} onChange={() => setTarget(t)} />
                <span className="a" style={{ background: avColor(t.name), width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{initials(t.name)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                    <span style={{ fontWeight: 700, color: "var(--primary)", fontSize: 12 }}>#{t.id}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.name} · {t.status} · {t.convo.length} messages</div>
                </div>
              </label>
            )) : <div style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted)" }}>No matching tickets.</div>}
          </div>
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" disabled={!target} onClick={() => onApply(target)}><FolderInput size={15} /> Merge into #{target?.id || "…"}</button></div>
      </div>
    </div>
  );
}

/* ---- student context UI ---- */
function StuTag({ tone, check, tip, small, children }) {
  return (
    <span className={`stu-tag t-${tone} ${small ? "sm" : ""}`}>
      {!!check && <Check size={small ? 9 : 10} strokeWidth={3.2} />}
      {children}
      {tip && !small && (
        <span className="stu-tip">
          <b>{tip[0]}</b>
          {tip.slice(1).map((l, i2) => <span key={i2}>{l}</span>)}
        </span>
      )}
    </span>
  );
}

function StudentTags({ ticket, onEdit }) {
  const pills = stuPills(ticket.studentContext);
  return (
    <div className="stu-wrap">
      <div className="stu-row">
        {pills.map((p) => <StuTag key={p.key} tone={p.tone} check={p.check} tip={p.tip}>{p.text}</StuTag>)}
        <button className="stu-edit" onClick={onEdit} title="Edit Student Details"><Pencil size={11} /> Edit Student Details</button>
      </div>
      {(ticket.stuActivity || []).length > 0 && (
        <div className="stu-activity">
          {ticket.stuActivity.slice(-2).reverse().map((a, i2) => (
            <span key={i2}><History size={11} /> <b>{a.by}</b> changed {a.field} from "{a.from}" to "{a.to}" — {a.when}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function StudentEditModal({ ticket, onClose, onSave }) {
  const [c, setC] = useState({ ...ticket.studentContext });
  const set = (k, v) => setC((x) => ({ ...x, [k]: v }));
  const Row = ({ label, children }) => (
    <div className="stu-edit-row"><label>{label}</label>{children}</div>
  );
  const EnumSel = ({ field }) => (
    <select value={c[field]} onChange={(e) => set(field, e.target.value)}>
      {Object.entries(STU_ENUMS[field]).map(([v, [lbl]]) => <option key={v} value={v}>{lbl}</option>)}
    </select>
  );
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 470 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "var(--primary-soft)", color: "var(--primary)", width: 32, height: 32 }}><GraduationCap size={16} /></span>Edit Student Details</div>
          <button className="icon-btn" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="modal-body stu-edit-grid">
          <Row label="Registration Status"><EnumSel field="registrationStatus" /></Row>
          <Row label="Domain">
            <select value={c.domain} onChange={(e) => set("domain", e.target.value)}>
              {STU_DOMAINS.map((d) => <option key={d} value={stuMachine(d)}>{d}</option>)}
            </select>
          </Row>
          <Row label="Exam Status"><EnumSel field="examStatus" /></Row>
          <Row label="Start Date"><input type="date" value={c.startDate || ""} onChange={(e) => set("startDate", e.target.value)} /></Row>
          <Row label="Project Status"><EnumSel field="projectStatus" /></Row>
          <Row label="Refund Eligibility"><EnumSel field="refundEligibility" /></Row>
          <Row label="Batch"><input value={c.batch} onChange={(e) => set("batch", e.target.value)} placeholder="DA-B12" /></Row>
          <Row label="Enrollment Status"><EnumSel field="enrollmentStatus" /></Row>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={() => onSave(c)}><Save size={13} /> Save Changes</button>
        </div>
      </div>
    </div>
  );
}

function TicketDetailPage({ ticket, onBack, onPrev, onNext, tickets, setTickets }) {
  const Src = SOURCE_ICON[ticket.source];
  const sla = slaStyle[ticket.sla];
  const push = useToast();
  const [thread, setThread] = useState([]);
  useEffect(() => { setThread([]); setStarred(false); setStatus(ticket.status); setMode(null); setComposerOpen(false); }, [ticket.id]);
  const add = (entry) => setThread(t => [...t, { ...entry, when: "just now" }]);
  const noteCount = thread.filter(e => e.type === "note").length;

  const [starred, setStarred] = useState(false);
  const [status, setStatus] = useState(ticket.status);
  const [mode, setMode] = useState(null);                    // "Reply" | "Note" | "Forward"
  const [composerOpen, setComposerOpen] = useState(false);   // hidden until Reply/Note/Forward is clicked
  const [focusTick, setFocusTick] = useState(0);
  const [confirm, setConfirm] = useState(null);
  const [stuEdit, setStuEdit] = useState(false);
  const saveStudentCtx = async (next) => {
    const prev = ticket.studentContext;
    const FIELD_LBL = { registrationStatus: "Registration Status", domain: "Domain", examStatus: "Exam Status", startDate: "Start Date", projectStatus: "Project Status", refundEligibility: "Refund Eligibility", batch: "Batch", enrollmentStatus: "Enrollment Status" };
    const disp = (f, v) => f === "domain" ? stuDomainLabel(v) : f === "startDate" ? stuDateDisplay(v) : f === "batch" ? v : (STU_ENUMS[f] && STU_ENUMS[f][v] ? STU_ENUMS[f][v][0] : v);
    const by = currentAgentProfile().name;
    const entries = Object.keys(FIELD_LBL).filter((f) => prev[f] !== next[f]).map((f) => ({ by, field: FIELD_LBL[f], from: disp(f, prev[f]), to: disp(f, next[f]), when: "just now", at: Date.now() }));
    if (!entries.length) { setStuEdit(false); return; }
    setTickets((ts) => ts.map((t) => t.id === ticket.id ? { ...t, studentContext: next, stuActivity: [...(t.stuActivity || []), ...entries] } : t));
    try {
      const saved = JSON.parse(kvGetSync("hh-student-ctx") || "{}");
      saved[ticket.id] = next;
      await kvSet("hh-student-ctx", JSON.stringify(saved));
    } catch (e) {}
    setStuEdit(false);
    push({ type: "success", title: "Student details updated", desc: entries.map((e2) => e2.field).join(", ") + " changed." });
  };
  const [moreOpen, setMoreOpen] = useState(false);
  const [acts, setActs] = useState(false);
  const moreRef = useRef(null);
  const composerRef = useRef(null);
  useClickAway(moreRef, () => setMoreOpen(false));

  const focusComposer = (which) => {
    setComposerOpen(true);
    setMode(which);
    setFocusTick((t) => t + 1); // if already open, this just re-focuses the editor
    // re-set null on next tick so a second click on the same tab still switches & re-focuses
    setTimeout(() => { setMode(null); composerRef.current && composerRef.current.scrollIntoView({ behavior: "smooth", block: "center" }); }, 60);
  };
  const closeTicket = () => setConfirm({
    title: "Close ticket",
    msg: `Mark #${ticket.id} as Closed? It will move to Closed Tickets. You can reopen it any time.`,
    label: "Close Ticket",
    run: () => {
      setStatus("Closed");
      if (setTickets) {
        setTickets((ts) => ts.map((x) => x.id === ticket.id
          ? { ...x, status: "Closed", unresolved: false, responseStatus: "Resolved", lastActivity: "just now" }
          : x));
      }
      fireConfetti(); push({ type: "success", title: "Ticket closed", desc: `#${ticket.id} moved to Closed Tickets. Loading next ticket…` });
      // Advance to the next ticket so agents can keep working through the queue
      setTimeout(() => { onNext && onNext(); }, 250);
    },
  });
  const [pickModal, setPickModal] = useState(null);           // "dept" | "tag" | "merge"
  const [duplicateBusy, setDuplicateBusy] = useState(false);

  const doMore = (label) => {
    setMoreOpen(false);
    if (label === "Delete Ticket") {
      setConfirm({ title: "Delete ticket", msg: `Permanently delete #${ticket.id}? This can't be undone.`, label: "Delete", danger: true,
        run: () => { if (setTickets) setTickets((ts) => ts.filter((x) => x.id !== ticket.id)); push({ type: "success", title: "Ticket deleted", desc: `#${ticket.id} removed.` }); setTimeout(() => { onBack && onBack(); }, 200); } });
      return;
    }
    if (label === "Print Summary") { window.print(); return; }
    if (label === "Copy Link") { try { navigator.clipboard.writeText(`${window.location.origin}/tickets/${ticket.id}`); } catch (e) {} push({ type: "success", title: "Link copied" }); return; }
    if (label === "Change Department") { setPickModal("dept"); return; }
    if (label === "Add Tag") { setPickModal("tag"); return; }
    if (label === "Merge with...") { setPickModal("merge"); return; }
    if (label === "Duplicate Ticket") {
      if (!setTickets) return;
      setDuplicateBusy(true);
      setTimeout(() => {
        const copyId = Math.floor(Math.random() * 900000) + 100000;
        const copy = { ...ticket, id: copyId, status: "New", unresolved: true, created: "just now",
          createdSort: -1, lastActivity: "just now", firstResp: "in 30 min", resolution: "in 4 hours",
          responseStatus: "Awaiting reply", convo: ticket.convo.slice(0, 1), custReplied: false,
          newReplies: 0, subject: `${ticket.subject} (copy)` };
        setTickets((ts) => [copy, ...ts]);
        setDuplicateBusy(false);
        push({ type: "success", title: "Ticket duplicated", desc: `Created copy #${copyId}.` });
      }, 300);
      return;
    }
    push({ type: "info", title: label, desc: `${label} applied to #${ticket.id}.` });
  };
  const timeline = [
    { icon: Ticket, color: "#5B5CEB", txt: `${ticket.name} raised the ticket`, when: ticket.created },
    { icon: UserPlus, color: "#0EA5E9", txt: `Assigned to ${ticket.agent}`, when: ticket.created },
    ...thread.map((e) => ({ icon: e.type === "note" ? Lock : e.type === "forward" ? Forward : Reply, color: e.type === "note" ? "#F59E0B" : e.type === "forward" ? "#0EA5E9" : "#10B981",
      txt: e.type === "note" ? "Internal note added" : e.type === "forward" ? `Forwarded to ${e.to}` : "Replied to customer", when: e.when })),
    ...(starred ? [{ icon: Star, color: "#F59E0B", txt: "Ticket starred", when: "just now" }] : []),
    ...(status !== ticket.status ? [{ icon: CheckCheck, color: "#10B981", txt: `Status changed to ${status}`, when: "just now" }] : []),
  ];
  const more = [
    ["Change Department", Building2], ["Duplicate Ticket", Copy], ["Merge with...", FolderInput],
    ["Add Tag", TagIcon], ["Copy Link", Link2], ["Print Summary", Printer], ["Delete Ticket", Trash2],
  ];

  return (
    <div className="content route">
      <div className="crumb">
        <a onClick={onBack}>All unresolved tickets</a> <ChevronRight size={14} /> <span style={{ color: "var(--text)" }}>#{ticket.id}</span>
      </div>

      <div className="card td-bar">
        <button className="icon-btn" title={starred ? "Unstar" : "Star ticket"} onClick={() => { setStarred((v) => !v); push({ type: "success", title: starred ? "Ticket unstarred" : "Ticket starred", desc: `#${ticket.id}` }); }}>
          <Star size={17} fill={starred ? "#F59E0B" : "none"} color={starred ? "#F59E0B" : "currentColor"} />
        </button>
        <button className={`btn btn-ghost btn-sm ${mode === "Reply" ? "on" : ""}`} onClick={() => focusComposer("Reply")}><Reply size={15} /> Reply</button>
        <button className={`btn btn-ghost btn-sm ${mode === "Note" ? "on" : ""}`} onClick={() => focusComposer("Note")}><Lock size={15} /> Note{noteCount > 0 && <span className="count-badge" style={{ fontSize: 10, padding: "0 6px" }}>{noteCount}</span>}</button>
        <button className={`btn btn-ghost btn-sm ${mode === "Forward" ? "on" : ""}`} onClick={() => focusComposer("Forward")}><Forward size={15} /> Forward</button>
        <button className="btn btn-ghost btn-sm" onClick={closeTicket} disabled={status === "Closed"}><CheckCheck size={15} /> {status === "Closed" ? "Closed" : "Close"}</button>
        <div className="dd-wrap" ref={moreRef}>
          <button className="icon-btn" title="More actions" onClick={() => setMoreOpen((o) => !o)}><MoreHorizontal size={17} /></button>
          {moreOpen && (
            <div className="menu menu-top left" style={{ minWidth: 210 }}>
              {more.map(([label, Ic]) => (
                <button key={label} className={`mi ${label === "Delete Ticket" ? "danger" : ""}`} style={{ padding: "9px 11px" }} onClick={() => doMore(label)}>
                  <span className="mic" style={{ background: "var(--surface-2)" }}><Ic size={14} /></span> {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="sp" />
        <button className="btn btn-ghost btn-sm" onClick={() => setActs(true)}><Activity size={15} /> Activities{timeline.length > 0 && <span className="count-badge" style={{ fontSize: 10, padding: "0 6px" }}>{timeline.length}</span>}</button>
        <button className="icon-btn" title="Previous ticket" onClick={onPrev}><ChevronLeft size={17} /></button>
        <button className="icon-btn" title="Next ticket" onClick={onNext}><ChevronRight size={17} /></button>
      </div>

      <div className="td-grid">
        <div className="card card-pad">
          <div className="td-subj">
            <span className="env"><Src size={20} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2>{ticket.subject}</h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <StatusBadge s={status} />
                <PrioBadge p={ticket.priority} />
                <span className="sla" style={{ background: sla.bg, color: sla.fg }}><AlertCircle size={13} /> First response {ticket.sla === "Breached" ? "overdue" : `due ${ticket.firstResp}`}</span>
                <span className="chip">{ticket.category}</span>
                {starred && <span className="badge-pill" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}><Star size={11} fill="var(--warning)" /> Starred</span>}
              </div>
              <StudentTags ticket={ticket} onEdit={() => setStuEdit(true)} />
            </div>
          </div>

          <div className="entry" style={{ marginTop: 8 }}>
            <div className="msg-av" style={{ background: avColor(ticket.name) }}>{initials(ticket.name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="msg-head"><b>{ticket.name}</b> reported via {ticket.source.toLowerCase()} · <i>{ticket.created}</i></div>
              <div className="msg-to">To: contact@internshipstudio.com</div>
              <div className="msg-body">{bodyFor(ticket)}</div>
            </div>
          </div>

          {thread.map((e, i) => <ThreadEntry key={i} e={e} />)}

          {!composerOpen && (
            <div className="reply-bar" ref={composerRef}>
              <button className="btn btn-primary" onClick={() => focusComposer("Reply")}><Reply size={15} /> Reply</button>
              <button className="btn btn-soft" onClick={() => focusComposer("Note")}><Lock size={15} /> Add Note</button>
              <button className="btn btn-soft" onClick={() => focusComposer("Forward")}><Forward size={15} /> Forward</button>
              <span className="hint">Reading mode — the editor opens only when you need it.</span>
            </div>
          )}
          <div ref={composerOpen ? composerRef : undefined} className={`comp-collapse ${composerOpen ? "open" : ""}`} aria-hidden={!composerOpen}>
            <div>
              <div style={{ paddingTop: 18, borderTop: "1px solid var(--border)" }}>
                <ReplyComposer key={ticket.id} ticket={ticket} onSend={add} mode={mode} focusTick={focusTick} onClose={() => setComposerOpen(false)} />
              </div>
            </div>
          </div>
        </div>

        <div className="props">
          <ContactPanel ticket={ticket} />
          {stuEdit && <StudentEditModal ticket={ticket} onClose={() => setStuEdit(false)} onSave={saveStudentCtx} />}
          <PropertiesPanel ticket={ticket} />
        </div>
      </div>

      {/* Activities side drawer */}
      {acts && (<>
        <div className="drawer-overlay" onClick={() => setActs(false)} />
        <div className="drawer">
          <div className="drawer-head">
            <h3 className="card-title"><Activity size={16} style={{ verticalAlign: "-3px", marginRight: 7, color: "var(--primary)" }} />Ticket Activity <span className="count-badge" style={{ marginLeft: 5 }}>{timeline.length}</span></h3>
            <button className="icon-btn" onClick={() => setActs(false)}><X size={17} /></button>
          </div>
          <div className="drawer-body">
            {timeline.length === 0 ? <EmptyState icon={Activity} title="No activity yet" desc="Actions taken on this ticket will show up here." />
              : timeline.map((a, i) => (
                <div className="act-item" key={i} style={{ padding: "12px 0" }}>
                  <span className="ai" style={{ background: `${a.color}18`, color: a.color }}><a.icon size={16} /></span>
                  <div style={{ minWidth: 0 }}><div className="at">{a.txt}</div><div className="am"><span>{a.when}</span></div></div>
                </div>
              ))}
          </div>
        </div>
      </>)}

      <TdPickModal open={pickModal === "dept"} title={`Change department for #${ticket.id}`} icon={Building2}
        current={ticket.dept} options={DEPTS} onClose={() => setPickModal(null)}
        onApply={(v) => { if (setTickets) setTickets((ts) => ts.map((x) => x.id === ticket.id ? { ...x, dept: v, lastActivity: "just now" } : x)); push({ type: "success", title: "Department changed", desc: `#${ticket.id} moved to ${v}.` }); setPickModal(null); }} />

      <TdTagsModal open={pickModal === "tag"} title={`Add tag to #${ticket.id}`}
        existing={ticket.tags || []} bank={TAG_BANK} onClose={() => setPickModal(null)}
        onApply={(tags) => { if (setTickets) setTickets((ts) => ts.map((x) => x.id === ticket.id ? { ...x, tags: Array.from(new Set([...(x.tags || []), ...tags])) } : x)); push({ type: "success", title: tags.length > 1 ? `${tags.length} tags added` : "Tag added", desc: tags.join(", ") }); setPickModal(null); }} />

      <TdMergeModal open={pickModal === "merge"} ticket={ticket} tickets={tickets || []} onClose={() => setPickModal(null)}
        onApply={(target) => {
          if (setTickets) setTickets((ts) => ts.map((x) => x.id === target.id
            ? { ...x, convo: [...x.convo, ...ticket.convo], tags: Array.from(new Set([...(x.tags || []), "Merged"])) }
            : x.id === ticket.id ? { ...x, status: "Closed", unresolved: false, subject: x.subject + " (merged)" } : x));
          push({ type: "success", title: "Tickets merged", desc: `#${ticket.id} merged into #${target.id}.` });
          setPickModal(null);
          setTimeout(() => { onBack && onBack(); }, 250);
        }} />

      <ConfirmDialog open={!!confirm} danger={confirm?.danger} title={confirm?.title || ""} message={confirm?.msg || ""} confirmLabel={confirm?.label || "Confirm"}
        onConfirm={() => confirm?.run()} onClose={() => setConfirm(null)} />
    </div>
  );
}

/* ============================================================================
   CUSTOMERS — directory of everyone who raised a ticket
   ========================================================================== */
const SUBJ_BANK = {
  Internship: ["Internship start date confirmation", "Batch shift request for training", "Internship extension request"],
  Attendance: ["Present mark not reflecting", "Attendance correction request", "Missed session marked absent"],
  Certificate: ["Certificate not received", "Name correction on certificate", "Certificate download not working"],
  Placement: ["Placement drive eligibility", "Offer letter verification pending", "Interview schedule query"],
  Technical: ["Video lectures not loading", "Exam portal not opening", "Dashboard error on login"],
  Billing: ["Course access locked after payment", "Refund for duplicate charge", "GST invoice request"],
  "Account Access": ["Unable to login to portal", "Password reset not working", "Account temporarily locked"],
  General: ["Where to find lecture resources", "Mentor session rescheduling", "General query about program"],
};
const HIST_STATUS = ["Open", "Pending", "Resolved", "Closed", "New", "Resolved", "Overdue"];
const HIST_CREATED = ["2 days ago", "1 week ago", "3 weeks ago", "1 month ago", "2 months ago"];
const HIST_UPDATED = ["1 hr ago", "yesterday", "2 days ago", "5 days ago", "3 weeks ago"];

const CUSTOMERS = TICKETS.map((b, i) => {
  const n = 2 + (i % 4); // 2..5 tickets
  const history = [];
  for (let k = 0; k < n; k++) {
    if (k === 0) { history.push({ ...b, updated: HIST_UPDATED[0], resolvedOn: ["Resolved","Closed"].includes(b.status) ? "18 Jul 2026" : null }); continue; }
    const cat = TICKET_CATS[(i + k) % TICKET_CATS.length];
    const subjArr = SUBJ_BANK[cat] || ["Support request"];
    const status = HIST_STATUS[(i + k) % HIST_STATUS.length];
    const prio = ["Low", "Medium", "High", "Critical"][(i + k) % 4];
    history.push({
      ...b,
      id: Math.abs(b.id - k * 617 - i * 5),
      category: cat, subject: subjArr[k % subjArr.length], status, priority: prio,
      source: SOURCES[(i + k) % SOURCES.length], sla: ["On track", "At risk", "Breached"][(i + k) % 3],
      agent: AGENTS[(i + k) % AGENTS.length], dept: DEPTS[(i + k) % DEPTS.length],
      created: HIST_CREATED[(i + k) % HIST_CREATED.length], updated: HIST_UPDATED[(i + k) % HIST_UPDATED.length],
      createdSort: i * 10 + k, firstResp: "in 2 hours", resolution: "in a day",
      lastActivity: ["1 hr ago", "yesterday", "2 days ago"][k % 3],
      responseStatus: ["Awaiting reply", "Agent responded", "Customer replied"][(i + k) % 3],
      unresolved: !["Resolved", "Closed"].includes(status),
      resolvedOn: ["Resolved", "Closed"].includes(status) ? "1" + (k) + " Jul 2026" : null,
    });
  }
  const cnt = (f) => history.filter(f).length;
  return {
    cid: `CUS-${10480 + i * 13}`, name: b.name, email: b.email, phone: b.phone,
    college: b.college, program: b.program, registered: b.registered, agent: b.agent, mentor: b.mentor,
    history, total: history.length,
    open: cnt((t) => t.status === "Open" || t.status === "New"),
    closed: cnt((t) => t.status === "Closed"),
    pending: cnt((t) => t.status === "Pending"),
    resolved: cnt((t) => t.status === "Resolved"),
    prioRank: Math.max(...history.map((t) => ({ Critical: 4, High: 3, Medium: 2, Low: 1 }[t.priority]))),
    activeStatus: history[0].status,
    lastTicketDate: ["Today", "Yesterday", "2 days ago", "1 week ago"][i % 4],
    lastActivity: ["5 min ago", "1 hr ago", "3 hr ago", "yesterday"][i % 4],
    lastActivitySort: i,
    regDate: ["12 Jan 2026", "03 Feb 2026", "19 Mar 2026", "28 Apr 2026", "07 May 2026"][i % 5],
    regSort: i % 5,
    lastLogin: ["2 hours ago", "yesterday", "3 days ago", "just now"][i % 4],
    firstTicket: ["10 Jan 2026", "01 Feb 2026", "15 Mar 2026", "22 Apr 2026"][i % 4],
    recentTicket: ["18 Jul 2026", "17 Jul 2026", "15 Jul 2026", "10 Jul 2026"][i % 4],
    avgResolution: ["4h 20m", "6h 10m", "1d 2h", "3h 45m"][i % 4],
    avgResponse: ["22m", "48m", "1h 05m", "35m"][i % 4],
    csat: [88, 92, 95, 79, 84][i % 5],
  };
});

const CUST_SORTS = ["Customer Name", "Total Tickets Raised", "Most Recent Ticket", "Oldest Customer", "Last Activity", "Highest Priority Tickets"];
const CUST_EMPTY = { status: [], category: [], priority: [], agent: "", from: "", to: "" };

function CustomerCard({ c, i, onProfile, onEmail }) {
  const st = statusStyle(c.activeStatus);
  return (
    <div className="card ccard" style={{ animationDelay: `${i * 45}ms` }}>
      <div className="ccard-top">
        <span className="cav" style={{ background: avColor(c.name) }}>{initials(c.name)}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="nm" onClick={() => onProfile(c)}>{c.name}{c.registered && <BadgeCheck size={15} color="var(--success)" style={{ verticalAlign: "-2px", marginLeft: 5 }} />}</div>
          <div className="cid">{c.cid}</div>
        </div>
        <span className="badge-pill" style={{ background: st.bg, color: st.fg }}>{c.activeStatus}</span>
      </div>
      <div className="cmini">
        <div className="b"><div className="v">{c.total}</div><div className="l">Total</div></div>
        <div className="b"><div className="v" style={{ color: "var(--accent)" }}>{c.open}</div><div className="l">Open</div></div>
        <div className="b"><div className="v" style={{ color: "var(--success)" }}>{c.closed}</div><div className="l">Closed</div></div>
      </div>
      <div className="ccard-info">
        <div className="r"><AtSign size={14} /><span>{c.email}</span></div>
        <div className="r"><PhoneCall size={14} /><span>{c.phone}</span></div>
        <div className="r"><GraduationCap size={14} /><span>{c.college}</span></div>
        <div className="r"><UserCheck size={14} /><span>{c.agent}</span></div>
        <div className="r"><Clock size={14} /><span>Last ticket {c.lastTicketDate} · active {c.lastActivity}</span></div>
      </div>
      <div className="tactions" style={{ paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <button onClick={() => onProfile(c)}><Eye size={14} /> Profile</button>
        <button onClick={() => onProfile(c)}><Ticket size={14} /> Tickets</button>
        <button onClick={() => onEmail(c)}><Mail size={14} /> Email</button>
        <a href={`tel:${c.phone.replace(/ /g, "")}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 11px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}><Phone size={14} /> Call</a>
      </div>
    </div>
  );
}

function CustomerTable({ rows, onProfile }) {
  return (
    <div className="card"><div className="table-wrap"><table style={{ minWidth: 900 }}>
      <thead><tr><th>Customer</th><th>Customer ID</th><th>Phone</th><th>Total</th><th>Open</th><th>Closed</th><th>Last Ticket</th><th>Agent</th><th>Status</th></tr></thead>
      <tbody>{rows.map((c) => (<tr key={c.cid} style={{ cursor: "pointer" }} onClick={() => onProfile(c)}>
        <td><div className="cust"><span className="a" style={{ background: avColor(c.name) }}>{initials(c.name)}</span><div><div className="nm">{c.name}</div><div className="em">{c.email}</div></div></div></td>
        <td style={{ fontWeight: 600, fontSize: 12.5 }}>{c.cid}</td>
        <td style={{ fontSize: 12.5, color: "var(--muted)" }}>{c.phone}</td>
        <td style={{ fontWeight: 700 }}>{c.total}</td>
        <td style={{ color: "var(--accent)", fontWeight: 700 }}>{c.open}</td>
        <td style={{ color: "var(--success)", fontWeight: 700 }}>{c.closed}</td>
        <td style={{ fontSize: 12.5, color: "var(--muted)" }}>{c.lastTicketDate}</td>
        <td style={{ fontSize: 12.5, fontWeight: 600 }}>{c.agent}</td>
        <td><StatusBadge s={c.activeStatus} /></td>
      </tr>))}</tbody>
    </table></div></div>
  );
}

function CustSort({ value, onChange }) {
  const [open, setOpen] = useState(false); const ref = useRef(null);
  useClickAway(ref, () => setOpen(false));
  return (
    <div className="dd-wrap" ref={ref}>
      <button className="btn btn-ghost" onClick={() => setOpen((o) => !o)}><ArrowUpDown size={15} /> Sort: <b style={{ color: "var(--primary)" }}>{value}</b> <ChevronDown size={14} /></button>
      {open && <div className="menu menu-top left" style={{ minWidth: 210 }}>{CUST_SORTS.map((so) => <button key={so} className="mi" style={{ padding: "9px 11px" }} onClick={() => { onChange(so); setOpen(false); }}>{so}{value === so && <CheckCheck size={14} style={{ marginLeft: "auto" }} />}</button>)}</div>}
    </div>
  );
}

function CustFilterDrawer({ open, onClose, draft, setDraft, onApply, onReset }) {
  if (!open) return null;
  const toggle = (key, val) => setDraft((d) => { const a = d[key]; return { ...d, [key]: a.includes(val) ? a.filter((x) => x !== val) : [...a, val] }; });
  const Multi = ({ label, k, opts }) => (<div className="fld"><label>{label}</label><div className="chips">{opts.map((o) => <button key={o} className={`fchip ${draft[k].includes(o) ? "on" : ""}`} onClick={() => toggle(k, o)}>{o}</button>)}</div></div>);
  return (<>
    <div className="drawer-overlay" onClick={onClose} />
    <div className="drawer">
      <div className="drawer-head"><h3 className="card-title"><SlidersHorizontal size={16} style={{ verticalAlign: "-3px", marginRight: 7, color: "var(--primary)" }} />Filter Customers</h3><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
      <div className="drawer-body">
        <Multi label="Ticket Status" k="status" opts={["New", "Open", "Pending", "Overdue", "Resolved", "Closed"]} />
        <Multi label="Ticket Category" k="category" opts={TICKET_CATS} />
        <Multi label="Priority" k="priority" opts={["Low", "Medium", "High", "Critical"]} />
        <div className="fld"><label>Assigned Agent</label><select value={draft.agent} onChange={(e) => setDraft((d) => ({ ...d, agent: e.target.value }))}><option value="">Any agent</option>{AGENTS.map((a) => <option key={a}>{a}</option>)}</select></div>
        <div className="grid2">
          <div className="fld"><label>From date</label><input type="date" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} /></div>
          <div className="fld"><label>To date</label><input type="date" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} /></div>
        </div>
      </div>
      <div className="drawer-foot"><button className="btn btn-soft" style={{ flex: 1, justifyContent: "center" }} onClick={onReset}><RotateCcw size={15} /> Reset</button><button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={onApply}><CheckCheck size={15} /> Apply</button></div>
    </div>
  </>);
}

function CustomersPage({ onProfile, onOpenTicket }) {
  const push = useToast();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("Customer Name");
  const [layout, setLayout] = useState("card");
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [draft, setDraft] = useState(CUST_EMPTY);
  const [applied, setApplied] = useState(CUST_EMPTY);
  const [emailTo, setEmailTo] = useState(null);
  useEffect(() => { setLoading(true); const t = setTimeout(() => setLoading(false), 700); return () => clearTimeout(t); }, []);

  const activeFilters = applied.status.length + applied.category.length + applied.priority.length + (applied.agent ? 1 : 0) + (applied.from ? 1 : 0) + (applied.to ? 1 : 0);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    let r = CUSTOMERS.filter((c) => {
      if (term && ![c.name, c.email, c.phone, c.cid, ...c.history.map((t) => String(t.id))].join(" ").toLowerCase().includes(term)) return false;
      if (applied.agent && c.agent !== applied.agent && !c.history.some((t) => t.agent === applied.agent)) return false;
      if (applied.status.length && !c.history.some((t) => applied.status.includes(t.status))) return false;
      if (applied.category.length && !c.history.some((t) => applied.category.includes(t.category))) return false;
      if (applied.priority.length && !c.history.some((t) => applied.priority.includes(t.priority))) return false;
      return true;
    });
    const cmp = {
      "Customer Name": (a, b) => a.name.localeCompare(b.name),
      "Total Tickets Raised": (a, b) => b.total - a.total,
      "Most Recent Ticket": (a, b) => a.lastActivitySort - b.lastActivitySort,
      "Oldest Customer": (a, b) => a.regSort - b.regSort,
      "Last Activity": (a, b) => a.lastActivitySort - b.lastActivitySort,
      "Highest Priority Tickets": (a, b) => b.prioRank - a.prioRank,
    }[sort];
    return [...r].sort(cmp);
  }, [q, applied, sort]);

  const doExport = () => {
    try {
      const data = CUSTOMERS.map((c) => ({ "Customer ID": c.cid, "Name": c.name, "Email": c.email, "Phone": c.phone, "College": c.college, "Total Tickets": c.total, "Open": c.open, "Closed": c.closed, "Pending": c.pending, "Resolved": c.resolved, "Assigned Agent": c.agent, "Last Ticket": c.lastTicketDate, "CSAT": c.csat + "%" }));
      exportExcel(data, "helphive-customers.xlsx");
      push({ type: "success", title: "Export ready", desc: "helphive-customers.xlsx downloaded." });
    } catch (e) { push({ type: "error", title: "Export failed", desc: "Could not generate the file." }); }
  };

  return (
    <div className="content route">
      <div className="page-head">
        <div><h1>Customers <span className="count-badge">{CUSTOMERS.length} total</span></h1><p>View and manage customers who have raised support tickets.</p></div>
        <button className="btn btn-soft" onClick={doExport}><FileSpreadsheet size={15} /> Export Customers</button>
      </div>

      <div className="toolbar">
        <div className="searchbox" style={{ maxWidth: 300, flex: "initial", width: 300 }}><Search size={16} /><input placeholder="Search name, email, phone, ID, ticket #…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <CustSort value={sort} onChange={setSort} />
        <button className="btn btn-ghost" onClick={() => { setDraft(applied); setDrawer(true); }}><Filter size={15} /> Filters{activeFilters > 0 && <span className="count-badge" style={{ fontSize: 11, padding: "1px 8px" }}>{activeFilters}</span>}</button>
        <div className="seg" style={{ marginLeft: "auto" }}>
          <button className={layout === "card" ? "on" : ""} onClick={() => setLayout("card")}><LayoutGrid size={15} /> Card</button>
          <button className={layout === "table" ? "on" : ""} onClick={() => setLayout("table")}><Rows3 size={15} /> Table</button>
        </div>
      </div>

      {loading ? (
        <div className="cust-grid">{Array.from({ length: 6 }).map((_, i) => (<div key={i} className="card sk-card"><div style={{ display: "flex", gap: 13 }}><div className="sk" style={{ width: 48, height: 48, borderRadius: 14 }} /><div style={{ flex: 1 }}><div className="sk" style={{ height: 14, width: "60%", marginBottom: 8 }} /><div className="sk" style={{ height: 11, width: "40%" }} /></div></div><div className="sk" style={{ height: 54, borderRadius: 11 }} /><div className="sk" style={{ height: 60 }} /></div>))}</div>
      ) : rows.length === 0 ? (
        <div className="card"><EmptyState icon={Users} title="No customers found" desc="No customers match your search or filters. Try adjusting them." action="Clear filters" onAction={() => { setQ(""); setApplied(CUST_EMPTY); }} /></div>
      ) : layout === "card" ? (
        <div className="cust-grid">{rows.map((c, i) => <CustomerCard key={c.cid} c={c} i={i} onProfile={onProfile} onEmail={(x) => setEmailTo(x.email)} />)}</div>
      ) : <CustomerTable rows={rows} onProfile={onProfile} />}

      <CustFilterDrawer open={drawer} onClose={() => setDrawer(false)} draft={draft} setDraft={setDraft} onApply={() => { setApplied(draft); setDrawer(false); }} onReset={() => { setDraft(CUST_EMPTY); setApplied(CUST_EMPTY); }} />
      <EmailComposeModal key={emailTo || "none"} open={!!emailTo} to={emailTo || ""} onClose={() => setEmailTo(null)} />
    </div>
  );
}

/* ---- customer profile ---- */
function CustomerProfilePage({ customer: c, onBack, onOpenTicket }) {
  const push = useToast();
  const statusDist = ["Open", "Pending", "Resolved", "Closed", "New", "Overdue"].map((s, i) => ({ name: s, value: c.history.filter((t) => t.status === s).length, color: ["#0EA5E9", "#F59E0B", "#10B981", "#64748B", "#8B5CF6", "#EF4444"][i] })).filter((d) => d.value);
  const acts = [
    { icon: PlusCircle, color: "#5B5CEB", txt: `raised ticket ${"#" + c.history[0].id}`, who: c.name, when: "2 days ago" },
    { icon: UserPlus, color: "#0EA5E9", txt: `assigned to ${c.agent}`, who: "Admin", when: "2 days ago" },
    { icon: Reply, color: "#10B981", txt: "replied via email", who: c.agent, when: "1 day ago" },
    { icon: MessageCircle, color: "#8B5CF6", txt: "customer responded", who: c.name, when: "1 day ago" },
    { icon: Lock, color: "#F59E0B", txt: "added an internal note", who: c.agent, when: "22 hr ago" },
    { icon: Send, color: "#0EA5E9", txt: "sent a follow-up email", who: c.agent, when: "5 hr ago" },
    { icon: CheckCheck, color: "#10B981", txt: `closed ticket ${"#" + c.history[0].id}`, who: c.agent, when: "3 hr ago" },
  ];
  const kpis = [
    ["Total Tickets", c.total], ["Open", c.open], ["Closed", c.closed], ["Pending", c.pending],
    ["Resolved", c.resolved], ["Avg Response", c.avgResponse], ["Avg Resolution", c.avgResolution], ["CSAT", c.csat + "%"],
  ];
  return (
    <div className="content route">
      <div className="crumb"><a onClick={onBack}>Customers</a> <ChevronRight size={14} /> <span style={{ color: "var(--text)" }}>{c.name}</span></div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="cprof-head">
          <span className="pav" style={{ background: avColor(c.name) }}>{initials(c.name)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{c.name}{c.registered && <BadgeCheck size={20} color="var(--success)" />}</h1>
            <div className="cprof-meta">
              <span className="m"><Ticket size={13} /> {c.cid}</span>
              <span className="m"><AtSign size={13} /> {c.email}</span>
              <span className="m"><PhoneCall size={13} /> {c.phone}</span>
              <span className="m"><GraduationCap size={13} /> {c.college}</span>
            </div>
            <div className="cprof-meta">
              <span className="m"><CalendarDays size={13} /> Registered {c.regDate}</span>
              <span className="m"><LogIn size={13} /> Last login {c.lastLogin}</span>
              <span className="m"><UserCheck size={13} /> Agent: {c.agent}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-primary btn-sm" onClick={() => push({ type: "info", title: "Compose email", desc: `Opening a new email to ${c.name}.` })}><Mail size={14} /> Email</button>
            <a className="btn btn-ghost btn-sm" href={`tel:${c.phone.replace(/ /g, "")}`} style={{ textDecoration: "none" }}><Phone size={14} /> Call</a>
          </div>
        </div>
      </div>

      <div className="td-grid">
        <div>
          <div className="card card-pad" style={{ marginBottom: 18 }}>
            <h3 className="card-title" style={{ marginBottom: 14 }}>Customer Analytics</h3>
            <div className="an-kpis">{kpis.map(([k, v]) => (<div className="an-kpi" key={k}><div className="v">{typeof v === "number" ? v : v}</div><div className="l">{k}</div></div>))}</div>
            <div style={{ marginTop: 16 }}>
              <div className="prog-line"><div className="pl"><span>Customer Satisfaction</span><span style={{ color: "var(--accent)" }}>{c.csat}%</span></div><div className="pb"><i style={{ width: c.csat + "%", background: "var(--accent)" }} /></div></div>
              <div className="prog-line"><div className="pl"><span>Resolution Rate</span><span style={{ color: "var(--success)" }}>{Math.round(((c.closed + c.resolved) / c.total) * 100)}%</span></div><div className="pb"><i style={{ width: Math.round(((c.closed + c.resolved) / c.total) * 100) + "%", background: "var(--success)" }} /></div></div>
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ width: 150, height: 150, position: "relative" }}>
                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusDist} dataKey="value" nameKey="name" innerRadius={44} outerRadius={68} paddingAngle={2} stroke="none">{statusDist.map((d) => <Cell key={d.name} fill={d.color} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart></ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}><div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800 }}>{c.total}</div><div style={{ fontSize: 10, color: "var(--muted)" }}>tickets</div></div></div>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                {statusDist.map((d) => (<div className="dist-row" key={d.name}><span className="dotc" style={{ background: d.color, width: 9, height: 9 }} /><span className="nm">{d.name}</span><span className="ct">{d.value}</span></div>))}
                <div style={{ display: "flex", gap: 18, marginTop: 10, fontSize: 12, color: "var(--muted)" }}><span>First ticket: <b style={{ color: "var(--text)" }}>{c.firstTicket}</b></span><span>Recent: <b style={{ color: "var(--text)" }}>{c.recentTicket}</b></span></div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-head" style={{ padding: "18px 20px 0", marginBottom: 12 }}>
              <div><h3 className="card-title">Ticket History</h3><p className="card-sub">Every ticket raised by {c.name.split(" ")[0]} — click to open</p></div>
              <span className="count-badge">{c.total} tickets</span>
            </div>
            <div className="table-wrap"><table style={{ minWidth: 820 }}>
              <thead><tr><th>Ticket</th><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Created</th><th>Updated</th><th>Agent</th><th>Resolved</th></tr></thead>
              <tbody>{c.history.map((t) => (<tr key={t.id} style={{ cursor: "pointer" }} onClick={() => onOpenTicket(t)}>
                <td style={{ fontWeight: 700, color: "var(--primary)" }}>#{t.id}</td>
                <td><div className="subj" title={t.subject}>{t.subject}</div></td>
                <td style={{ fontSize: 12.5, fontWeight: 600 }}>{t.category}</td>
                <td><PrioBadge p={t.priority} /></td>
                <td><StatusBadge s={t.status} /></td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{t.created}</td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{t.updated}</td>
                <td style={{ fontSize: 12.5, fontWeight: 600 }}>{t.agent}</td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{t.resolvedOn || "—"}</td>
              </tr>))}</tbody>
            </table></div>
          </div>
        </div>

        <div className="props">
          <div className="card card-pad">
            <h3 className="card-title" style={{ marginBottom: 14 }}><Activity size={15} style={{ verticalAlign: "-2px", marginRight: 7, color: "var(--primary)" }} />Recent Activities</h3>
            <div>{acts.map((a, i) => (
              <div className="act-item" key={i} style={{ padding: "12px 0" }}>
                <span className="ai" style={{ background: `${a.color}18`, color: a.color }}><a.icon size={16} /></span>
                <div style={{ minWidth: 0 }}><div className="at"><b>{a.who}</b> {a.txt}</div><div className="am"><span>{a.when}</span></div></div>
              </div>
            ))}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   AUTOMATION CENTER
   ========================================================================== */
function Switch({ on, onChange }) { return <button className={`switch ${on ? "on" : ""}`} onClick={(e)=>{e.stopPropagation();onChange(!on);}}><i /></button>; }
function StatusChip({ active, label }) {
  const t = label || (active ? "Active" : "Inactive");
  return active
    ? <span className="status-chip" style={{background:"var(--success-soft)",color:"var(--success)"}}><span className="dotc" style={{background:"var(--success)"}} />{t}</span>
    : <span className="status-chip" style={{background:"var(--surface-2)",color:"var(--muted)"}}><span className="dotc" style={{background:"var(--faint)"}} />{t}</span>;
}
const LOG_STYLE = {
  Success:{ bg:"var(--success-soft)", fg:"var(--success)", icon:CheckCircle2 },
  Failed:{ bg:"var(--danger-soft)", fg:"var(--danger)", icon:XCircle },
  Pending:{ bg:"var(--warning-soft)", fg:"var(--warning)", icon:Clock3 },
  Disabled:{ bg:"var(--surface-2)", fg:"var(--muted)", icon:Ban },
};
const CANNED_CATS = ["General Queries","Internship","Attendance","Certificates","Billing","Placement","Technical Support","Refunds","Account Issues"];
const CANNED_SEED = [
  { name:"Internship Start Confirmation", cat:"Internship", by:"Priya Nair", mod:"2 days ago", uses:142, active:true, body:"Hi {Customer Name}, your internship for ticket {Ticket ID} is confirmed to begin on the scheduled date. You'll receive your onboarding kit shortly. Welcome aboard!" },
  { name:"₹99 Refund Acknowledgement", cat:"Refunds", by:"Rahul Sethi", mod:"5 hours ago", uses:88, active:true, body:"Hi {Customer Name}, we've received your refund request for {Ticket Subject}. Your ₹99 will be credited within 5–7 business days." },
  { name:"Certificate Download Steps", cat:"Certificates", by:"Aisha Khan", mod:"1 week ago", uses:210, active:true, body:"Hi {Customer Name}, to download your certificate, go to Dashboard → Certificate Wallet → Download. Reach out if it isn't visible yet." },
  { name:"Attendance Correction Reply", cat:"Attendance", by:"Karan Mehta", mod:"3 days ago", uses:64, active:false, body:"Hi {Customer Name}, we've logged your attendance correction for {Ticket ID}. It will reflect within 24 hours." },
  { name:"Payment Failed – Retry Steps", cat:"Billing", by:"Sneha Rao", mod:"yesterday", uses:176, active:true, body:"Hi {Customer Name}, your payment didn't go through. Please retry from the Course Store using a different method. No amount was deducted." },
  { name:"Placement Eligibility Info", cat:"Placement", by:"Priya Nair", mod:"4 days ago", uses:53, active:true, body:"Hi {Customer Name}, placement eligibility requires course completion + a passing skill score. You're currently eligible for the next drive." },
];
const CLOSURE_SEED = [
  { name:"Auto-close Thank-You emails", cond:'Subject contains "thank you, thanks, resolved"', action:"Mark as Resolved", active:true, mod:"2 days ago", count:320 },
  { name:"Close Out-of-Office replies", cond:'Body contains "out of office, auto-reply"', action:"Close Ticket", active:true, mod:"1 day ago", count:95 },
  { name:"Spam domain closure", cond:'Sender domain = "@promo-blast.co"', action:"Close + Add Note", active:false, mod:"1 week ago", count:12 },
];
const FORWARD_SEED = [
  { name:"Billing → Finance", dest:"finance@istudio.in", cond:"Category = Billing", active:true, last:"3 hours ago" },
  { name:"Placement queries → Team", dest:"placements@istudio.in", cond:"Category = Placement", active:true, last:"1 day ago" },
  { name:"Critical → Support Lead", dest:"lead@istudio.in", cond:"Priority = Critical", active:false, last:"5 days ago" },
];
const TAGS = ["Urgent","VIP","Refund","Attendance","Internship","Placement","Technical Issue","Escalated","Billing","Certificate"];
const NOTIF_SEED = [
  { tag:"Urgent", recip:"ops@istudio.in, lead@istudio.in", tpl:"Urgent Ticket Alert", active:true, last:"20 min ago" },
  { tag:"VIP", recip:"success@istudio.in", tpl:"VIP Customer Notice", active:true, last:"2 hours ago" },
  { tag:"Refund", recip:"finance@istudio.in", tpl:"Refund Requested", active:true, last:"1 day ago" },
  { tag:"Escalated", recip:"lead@istudio.in", tpl:"Escalation Notice", active:false, last:"3 days ago" },
];
const LOGS = [
  { auto:"Auto-close Thank-You emails", by:"System", tid:"#336270", cust:"Nidhi Maheshwari", act:"Marked ticket resolved", when:"Just now", status:"Success" },
  { auto:"Billing → Finance", by:"System", tid:"#336122", cust:"Vikram Patel", act:"Forwarded to finance@istudio.in", when:"5 min ago", status:"Success" },
  { auto:"Urgent tag alert", by:"Priya Nair", tid:"#336085", cust:"Ananya Sharma", act:"Notification email sent", when:"12 min ago", status:"Success" },
  { auto:"Close Out-of-Office replies", by:"System", tid:"#336011", cust:"Raju Rao", act:"Close failed — ticket locked", when:"30 min ago", status:"Failed" },
  { auto:"Placement queries → Team", by:"System", tid:"#335998", cust:"Diya Menon", act:"Forward queued for retry", when:"1 hour ago", status:"Pending" },
  { auto:"Spam domain closure", by:"System", tid:"#335900", cust:"—", act:"Skipped — rule disabled", when:"2 hours ago", status:"Disabled" },
  { auto:"VIP tag alert", by:"System", tid:"#335880", cust:"Meera Iyer", act:"Notification email sent", when:"3 hours ago", status:"Success" },
];
const WEEK = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((t,i)=>({t,runs:[142,168,131,189,203,88,74][i]}));
const RULE_DIST = [
  { name:"Auto-closure", value:9, color:"#5B5CEB" }, { name:"Forwarding", value:6, color:"#0EA5E9" },
  { name:"Notifications", value:5, color:"#F59E0B" }, { name:"Canned", value:4, color:"#10B981" },
];
const KPIS = [
  { lab:"Total Automation Rules", val:"24", color:"#5B5CEB", icon:Zap },
  { lab:"Active Rules", val:"18", color:"#10B981", icon:Play },
  { lab:"Disabled Rules", val:"6", color:"#F59E0B", icon:Pause },
  { lab:"Emails Forwarded Today", val:"143", color:"#0EA5E9", icon:Forward },
  { lab:"Tickets Auto Closed", val:"87", color:"#8B5CF6", icon:MailX },
  { lab:"Notifications Sent", val:"259", color:"#EC4899", icon:BellRing },
  { lab:"Time Saved", val:"32h", color:"#10B981", icon:Timer },
  { lab:"Automation Success Rate", val:"96%", color:"#5B5CEB", icon:TrendingUp },
];
const MODULES = [
  { key:"canned", title:"Canned Responses", icon:MessageSquareText, color:"#5B5CEB", desc:"Create, organize and reuse predefined replies so agents respond in seconds.", active:true },
  { key:"closure", title:"Auto Email Closure", icon:MailX, color:"#0EA5E9", desc:"Automatically resolve or close tickets when emails match your keyword rules.", active:true },
  { key:"forward", title:"Email Forwarding", icon:Forward, color:"#F59E0B", desc:"Route incoming support emails to the right people or departments instantly.", active:false },
  { key:"notify", title:"Tagged Notifications", icon:BellRing, color:"#EC4899", desc:"Alert the right recipients the moment a ticket is tagged Urgent, VIP and more.", active:true },
];
const CLOSURE_ACTIONS = [
  { k:"Close Ticket", icon:MailX }, { k:"Mark as Resolved", icon:CheckCircle2 },
  { k:"Send Confirmation Email", icon:Send }, { k:"Add Internal Note", icon:StickyNote },
  { k:"Assign Category", icon:FolderInput }, { k:"Notify Assigned Agent", icon:BellRing },
];
const PLACEHOLDERS = ["{Customer Name}","{Ticket ID}","{Ticket Subject}","{Ticket Status}","{Assigned Agent}","{Resolution Time}"];

/* ---- automation state seeds ---- */
const RULE_TYPES = ["Canned Response", "Auto Close Ticket", "Email Forwarding", "Tagged Notification"];
const RULE_TRIGGERS = ["Ticket Created", "Ticket Updated", "Ticket Closed", "Email Received", "Status Changed", "Priority Changed", "Tag Added"];
const CANNED_CATS_FULL = ["General", "Internship", "Attendance", "Certificate", "Billing", "Placement", "Technical Support", "Refund", "Account Issues"];
let _uid = 5000;
const uid = () => ++_uid;
const RULES_SEED = [
  { id: uid(), name: "Auto-close Thank-You emails", desc: "Resolve tickets when the customer only replies with thanks.", type: "Auto Close Ticket", trigger: "Email Received", conditions: 'Subject contains "thanks, resolved"', action: "Mark as Resolved", priority: "Low", active: true, created: "12 Jul 2026", modified: "2 days ago" },
  { id: uid(), name: "Billing → Finance", desc: "Forward billing tickets to the finance team.", type: "Email Forwarding", trigger: "Ticket Created", conditions: "Category = Billing", action: "Forward to finance@istudio.in", priority: "Medium", active: true, created: "09 Jul 2026", modified: "1 day ago" },
  { id: uid(), name: "Urgent tag alert", desc: "Notify ops when a ticket is tagged urgent.", type: "Tagged Notification", trigger: "Tag Added", conditions: "Tag = Urgent", action: "Notify ops@, lead@", priority: "High", active: true, created: "05 Jul 2026", modified: "20 min ago" },
  { id: uid(), name: "Internship confirmation reply", desc: "Auto-insert the internship confirmation canned response.", type: "Canned Response", trigger: "Ticket Created", conditions: "Category = Internship", action: "Insert “Internship Start Confirmation”", priority: "Low", active: false, created: "01 Jul 2026", modified: "1 week ago" },
];
const _CANNED_MAP = { Internship: "Internship", Refunds: "Refund", Certificates: "Certificate", Attendance: "Attendance", Billing: "Billing", Placement: "Placement" };
const _CANNED_SHORTCUT = { Internship: "/intern", Refunds: "/refund", Certificates: "/cert", Attendance: "/attend", Billing: "/pay", Placement: "/placement" };
const CANNED_INIT = CANNED_SEED.map((r, i) => ({
  id: uid(), title: r.name, cat: _CANNED_MAP[r.cat] || "General", shortcut: _CANNED_SHORTCUT[r.cat] || "/reply",
  body: r.body, tags: [r.cat], by: r.by, status: r.active ? "Active" : "Inactive",
  created: ["10 Jul 2026", "12 Jul 2026", "05 Jul 2026", "14 Jul 2026", "16 Jul 2026", "08 Jul 2026"][i % 6],
  createdSort: i, updated: r.mod, uses: r.uses,
}));
const ACTIVITY_INIT = [
  { id: uid(), when: "2 min ago", user: "Admin", action: "Created automation “Auto-close Thank-You emails”", module: "Automation", status: "Success" },
  { id: uid(), when: "18 min ago", user: "Priya Nair", action: "Edited canned response “Certificate Download Steps”", module: "Canned Responses", status: "Success" },
  { id: uid(), when: "40 min ago", user: "Admin", action: "Exported 6 canned responses to Excel", module: "Canned Responses", status: "Success" },
  { id: uid(), when: "1 hr ago", user: "Rahul Sethi", action: "Enabled automation “Billing → Finance”", module: "Automation", status: "Info" },
  { id: uid(), when: "3 hr ago", user: "Admin", action: "Imported 4 canned responses", module: "Canned Responses", status: "Success" },
];

function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", danger, onConfirm, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: danger ? "var(--danger-soft)" : "var(--primary-soft)", color: danger ? "var(--danger)" : "var(--primary)", width: 32, height: 32 }}><AlertTriangle size={16} /></span>{title}</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body"><p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6 }}>{message}</p></div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-sm" style={{ background: danger ? "var(--danger)" : "var(--primary)", color: "#fff" }} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button></div>
      </div>
    </div>
  );
}

const CANNED_TOKENS = [
  { key: "{Customer Name}", sample: "Nidhi" },
  { key: "{Ticket ID}", sample: "#336270" },
  { key: "{Agent Name}", sample: "Priya Nair" },
  { key: "{Company Name}", sample: "Internship Studio" },
  { key: "{Support Email}", sample: "contact@internshipstudio.com" },
  { key: "{Support Phone}", sample: "+91 90000 10000" },
];
function fillTokens(text = "") {
  let out = text;
  CANNED_TOKENS.forEach((t) => { out = out.split(t.key).join(t.sample); });
  return out;
}

function CannedModal({ open, initial, onClose, onSave }) {
  const push = useToast();
  const blank = { title: "", cat: "General", shortcut: "", body: "", tags: [], by: "Admin", status: "Active" };
  const [f, setF] = useState(blank);
  const [tag, setTag] = useState("");
  const [showTokens, setShowTokens] = useState(false);
  const bodyRef = useRef(null);
  useEffect(() => { if (open) { setF(initial ? { ...initial } : blank); setTag(""); setShowTokens(false); } }, [open, initial]);
  if (!open) return null;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const addTag = (e) => { if (e.key === "Enter" && tag.trim()) { e.preventDefault(); setF((x) => ({ ...x, tags: x.tags.includes(tag.trim()) ? x.tags : [...x.tags, tag.trim()] })); setTag(""); } };
  const insertToken = (token) => {
    const ta = bodyRef.current;
    if (!ta) { set("body", (f.body || "") + token); return; }
    const start = ta.selectionStart ?? f.body.length;
    const end = ta.selectionEnd ?? f.body.length;
    const next = f.body.slice(0, start) + token + f.body.slice(end);
    set("body", next);
    setTimeout(() => { ta.focus(); const p = start + token.length; ta.setSelectionRange(p, p); }, 0);
  };
  const save = (publish) => {
    if (!f.title.trim() || !f.body.trim()) { push({ type: "error", title: "Missing details", desc: "Title and response content are required." }); return; }
    if (f.shortcut && !f.shortcut.startsWith("/")) { push({ type: "error", title: "Invalid shortcut", desc: "Shortcut must begin with '/'." }); return; }
    onSave({ ...f, status: publish ? "Active" : f.status }, !!initial);
  };
  const RTE = [Bold, Italic, Underline, Heading1, List, ListOrdered, Link2, Code];
  const chars = (f.body || "").length;
  const words = (f.body || "").trim() ? (f.body || "").trim().split(/\s+/).length : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB", width: 32, height: 32 }}><MessageSquareText size={16} /></span>{initial ? "Edit Response" : "New Canned Response"}</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <div className="fld"><label>Response Title *</label><input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Internship Start Confirmation" /></div>
          <div className="grid2">
            <div className="fld"><label>Category</label><select value={f.cat} onChange={(e) => set("cat", e.target.value)}>{CANNED_CATS_FULL.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="fld"><label>Shortcut Keyword</label><input value={f.shortcut} onChange={(e) => set("shortcut", e.target.value)} placeholder="/intern" />
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Type this in a reply to insert the response instantly.</div>
            </div>
          </div>

          <div className="fld">
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span>Response Content *</span>
              <button type="button" className="btn btn-ghost btn-sm" style={{ height: 26, padding: "0 9px", fontSize: 11.5 }} onClick={() => setShowTokens((x) => !x)}>
                <Code size={12} /> {showTokens ? "Hide" : "Insert"} placeholders <ChevronDown size={12} style={{ transform: showTokens ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
              </button>
            </label>
            {showTokens && (
              <div style={{ padding: 10, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Click to insert into the response. They'll fill with real values when sent.</div>
                <div className="chips">
                  {CANNED_TOKENS.map((t) => <button key={t.key} type="button" className="fchip" onClick={() => insertToken(t.key)}><Code size={11} /> {t.key}</button>)}
                </div>
              </div>
            )}
            <div className="rte" style={{ border: "1px solid var(--border)", borderRadius: "10px 10px 0 0", borderBottom: 0 }}>{RTE.map((Ic, i) => <button key={i} type="button"><Ic size={16} /></button>)}</div>
            <textarea ref={bodyRef} style={{ borderRadius: "0 0 10px 10px", minHeight: 140 }} value={f.body} onChange={(e) => set("body", e.target.value)} placeholder="Write the response… use {Customer Name}, {Ticket ID} placeholders." />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
              <span>{words} words · {chars} characters</span>
              {f.body && f.body.match(/\{[^}]+\}/g) && <span><Sparkles size={11} style={{ verticalAlign: "-2px" }} /> {f.body.match(/\{[^}]+\}/g).length} placeholder{f.body.match(/\{[^}]+\}/g).length > 1 ? "s" : ""}</span>}
            </div>
          </div>

          <div className="fld"><label>Tags</label><input value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={addTag} placeholder="Type a tag and press Enter" />
            <div className="tagbox">{f.tags.map((t) => <span className="tg" key={t}><TagIcon size={11} /> {t}<button onClick={() => set("tags", f.tags.filter((x) => x !== t))}><X size={11} /></button></span>)}</div>
          </div>
          <div className="grid2">
            <div className="fld"><label>Created By</label><input value={f.by} onChange={(e) => set("by", e.target.value)} /></div>
            <div className="fld"><label>Status</label><select value={f.status} onChange={(e) => set("status", e.target.value)}><option>Active</option><option>Inactive</option></select></div>
          </div>
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-ghost btn-sm" onClick={() => save(false)}><Check size={15} /> Save</button><button className="btn btn-primary btn-sm" onClick={() => save(true)}><Send size={15} /> Save &amp; Publish</button></div>
      </div>
    </div>
  );
}

function CannedPreviewModal({ resp, onClose }) {
  const [rendered, setRendered] = useState(true);
  if (!resp) return null;
  const shown = rendered ? fillTokens(resp.body) : resp.body;
  const hasTokens = /\{[^}]+\}/.test(resp.body || "");
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#0EA5E918", color: "#0EA5E9", width: 32, height: 32 }}><Eye size={16} /></span>Response Preview</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span className="fchip" style={{ cursor: "default" }}>{resp.cat}</span>
            {resp.shortcut && <span className="fchip" style={{ cursor: "default" }}><Code size={11} /> {resp.shortcut}</span>}
            <StatusChip active={resp.status === "Active"} />
            {hasTokens && (
              <div style={{ marginLeft: "auto", display: "flex", gap: 4, padding: 3, borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <button className={`fchip ${rendered ? "on" : ""}`} style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setRendered(true)}>Rendered</button>
                <button className={`fchip ${!rendered ? "on" : ""}`} style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setRendered(false)}>Raw</button>
              </div>
            )}
          </div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{resp.title}</div>
          <div style={{ padding: 14, borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: 13.5, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{shown}</div>
          {resp.tags && resp.tags.length > 0 && <div className="chips">{resp.tags.map((t) => <span className="fchip" key={t} style={{ cursor: "default" }}><TagIcon size={11} /> {t}</span>)}</div>}
          <div style={{ fontSize: 12, color: "var(--muted)" }}>By {resp.by} · used {resp.uses || 0} times · updated {resp.updated || "—"}</div>
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Close</button><button className="btn btn-primary btn-sm" onClick={onClose}><Send size={15} /> Insert into reply</button></div>
      </div>
    </div>
  );
}

function ImportDialog({ open, onClose, onImport }) {
  const push = useToast();
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState("");
  const ref = useRef(null);
  useEffect(() => { if (!open) { setRows(null); setFileName(""); } }, [open]);
  if (!open) return null;
  const parse = (file) => {
    if (!file) return;
    setFileName(file.name);
    const ext = file.name.split(".").pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let data = [];
        if (ext === "json") { const j = JSON.parse(e.target.result); data = Array.isArray(j) ? j : (j.responses || []); }
        else {
          const XLSX = await loadXLSX();
          const wb = XLSX.read(e.target.result, { type: "array" });
          data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        }
        const norm = data.map((r) => ({ title: r.title || r.Title || r["Response Title"] || "", cat: r.cat || r.Category || "General", shortcut: r.shortcut || r.Shortcut || "/reply", body: r.body || r.Response || r["Response Content"] || r.Body || "", by: r.by || r["Created By"] || "Import", status: r.status || r.Status || "Active" }));
        setRows(norm);
      } catch (err) { push({ type: "error", title: "Could not read file", desc: "Check the format (.xlsx, .csv, .json) and try again." }); }
    };
    if (ext === "json") reader.readAsText(file); else reader.readAsArrayBuffer(file);
  };
  const valid = rows ? rows.filter((r) => r.title && r.body) : [];
  const invalid = rows ? rows.length - valid.length : 0;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#10B98118", color: "#10B981", width: 32, height: 32 }}><Upload size={16} /></span>Import Responses</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <div className="dropzone" onClick={() => ref.current?.click()}><Upload size={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />{fileName || "Click to choose an Excel, CSV or JSON file"}
            <input ref={ref} type="file" accept=".xlsx,.csv,.json" hidden onChange={(e) => parse(e.target.files[0])} /></div>
          {rows && (<>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, textAlign: "center" }}>
              <div className="an-kpi"><div className="v">{rows.length}</div><div className="l">Total records</div></div>
              <div className="an-kpi"><div className="v" style={{ color: "var(--success)" }}>{valid.length}</div><div className="l">Valid</div></div>
              <div className="an-kpi"><div className="v" style={{ color: "var(--danger)" }}>{invalid}</div><div className="l">Invalid</div></div>
            </div>
            <div style={{ maxHeight: 180, overflow: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
              <table style={{ minWidth: 0 }}><thead><tr><th>Title</th><th>Category</th><th>Valid</th></tr></thead>
                <tbody>{rows.slice(0, 20).map((r, i) => (<tr key={i}><td style={{ fontWeight: 600 }}>{r.title || <i style={{ color: "var(--danger)" }}>missing</i>}</td><td style={{ fontSize: 12.5 }}>{r.cat}</td><td>{r.title && r.body ? <Check size={15} color="var(--success)" /> : <X size={15} color="var(--danger)" />}</td></tr>))}</tbody>
              </table>
            </div>
          </>)}
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-ghost btn-sm" disabled={!valid.length} onClick={() => { onImport(valid); onClose(); }}>Skip Invalid ({valid.length})</button>
          <button className="btn btn-primary btn-sm" disabled={!rows || !rows.filter((r) => r.title).length} onClick={() => { onImport(rows.filter((r) => r.title)); onClose(); }}><Check size={15} /> Import All</button>
        </div>
      </div>
    </div>
  );
}

function CreateAutomationModal({ open, initial, onClose, onSave }) {
  const push = useToast();
  const blank = { name: "", desc: "", type: "Canned Response", trigger: "Ticket Created", conditions: "", action: "", priority: "Medium", status: "Active" };
  const [f, setF] = useState(blank);
  useEffect(() => { if (open) setF(initial ? { ...initial, status: initial.active ? "Active" : "Inactive" } : blank); }, [open, initial]);
  if (!open) return null;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = (activate) => {
    if (!f.name.trim() || !f.type || !f.trigger) { push({ type: "error", title: "Missing details", desc: "Name, type and trigger are required." }); return; }
    onSave({ ...f, active: activate ? true : f.status === "Active" }, !!initial);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB", width: 32, height: 32 }}><Zap size={16} /></span>{initial ? "Edit Automation" : "Create Automation"}</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <div className="fld"><label>Automation Name *</label><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Auto-close survey replies" /></div>
          <div className="fld"><label>Description</label><textarea style={{ minHeight: 70 }} value={f.desc} onChange={(e) => set("desc", e.target.value)} placeholder="What does this automation do?" /></div>
          <div className="grid2">
            <div className="fld"><label>Automation Type *</label><select value={f.type} onChange={(e) => set("type", e.target.value)}>{RULE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="fld"><label>Trigger *</label><select value={f.trigger} onChange={(e) => set("trigger", e.target.value)}>{RULE_TRIGGERS.map((t) => <option key={t}>{t}</option>)}</select></div>
          </div>
          <div className="fld"><label>Conditions</label><input value={f.conditions} onChange={(e) => set("conditions", e.target.value)} placeholder='e.g. Category = Billing AND Priority = High' /></div>
          <div className="fld"><label>Action</label><input value={f.action} onChange={(e) => set("action", e.target.value)} placeholder="e.g. Forward to finance@istudio.in" /></div>
          <div className="grid2">
            <div className="fld"><label>Priority</label><select value={f.priority} onChange={(e) => set("priority", e.target.value)}>{["Low", "Medium", "High", "Critical"].map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="fld"><label>Status</label><select value={f.status} onChange={(e) => set("status", e.target.value)}><option>Active</option><option>Inactive</option></select></div>
          </div>
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-ghost btn-sm" onClick={() => save(false)}><Check size={15} /> Save</button><button className="btn btn-primary btn-sm" onClick={() => save(true)}><Play size={15} /> Save &amp; Activate</button></div>
      </div>
    </div>
  );
}

function RuleViewModal({ rule, onClose }) {
  if (!rule) return null;
  const rows = [["Type", rule.type], ["Trigger", rule.trigger], ["Conditions", rule.conditions || "—"], ["Action", rule.action || "—"], ["Priority", rule.priority], ["Status", rule.active ? "Active" : "Inactive"], ["Created", rule.created], ["Last Modified", rule.modified]];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB", width: 32, height: 32 }}><Zap size={16} /></span>{rule.name}</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          {rule.desc && <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{rule.desc}</p>}
          <div>{rows.map(([k, v]) => (<div className="kv" key={k} style={{ borderBottom: "1px solid var(--border)" }}><span className="k">{k}</span><span className="v">{v}</span></div>))}</div>
        </div>
        <div className="modal-foot"><button className="btn btn-primary btn-sm" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

function AutomationRulesTable({ rules, setRules, log, onEdit, onView }) {
  const push = useToast();
  const [confirm, setConfirm] = useState(null);
  const typeColor = { "Canned Response": "#5B5CEB", "Auto Close Ticket": "#0EA5E9", "Email Forwarding": "#F59E0B", "Tagged Notification": "#EC4899" };
  return (
    <div className="card panel">
      <div className="panel-head"><div className="panel-title"><span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB" }}><Zap size={19} /></span>Automation Rules <span className="count-badge" style={{ marginLeft: 4 }}>{rules.length}</span></div></div>
      {rules.length ? (
        <div className="table-wrap"><table style={{ minWidth: 980 }}>
          <thead><tr><th>Name</th><th>Type</th><th>Trigger</th><th>Conditions</th><th>Action</th><th>Status</th><th>Created</th><th>Modified</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
          <tbody>{rules.map((r) => (<tr key={r.id}>
            <td className="rname">{r.name}</td>
            <td><span className="badge-pill" style={{ background: `${typeColor[r.type]}16`, color: typeColor[r.type] }}>{r.type}</span></td>
            <td style={{ fontSize: 12.5 }}>{r.trigger}</td>
            <td style={{ maxWidth: 200, fontSize: 12, color: "var(--muted)" }}>{r.conditions || "—"}</td>
            <td style={{ maxWidth: 180, fontSize: 12, color: "var(--muted)" }}>{r.action || "—"}</td>
            <td><Switch on={r.active} onChange={(v) => { setRules((rs) => rs.map((x) => x.id === r.id ? { ...x, active: v, modified: "just now" } : x)); log(`${v ? "Enabled" : "Disabled"} automation “${r.name}”`, "Automation", "Info"); }} /></td>
            <td style={{ fontSize: 12, color: "var(--muted)" }}>{r.created}</td>
            <td style={{ fontSize: 12, color: "var(--muted)" }}>{r.modified}</td>
            <td><div className="row-act" style={{ justifyContent: "flex-end" }}>
              <button title="View" onClick={() => onView(r)}><Eye size={15} /></button>
              <button title="Edit" onClick={() => onEdit(r)}><Pencil size={15} /></button>
              <button title="Duplicate" onClick={() => { setRules((rs) => [{ ...r, id: uid(), name: "Copy of " + r.name, created: "just now", modified: "just now" }, ...rs]); log(`Duplicated automation “${r.name}”`, "Automation"); push({ type: "success", title: "Automation duplicated" }); }}><Copy size={15} /></button>
              <button className="danger" title="Delete" onClick={() => setConfirm(r)}><Trash2 size={15} /></button>
            </div></td>
          </tr>))}</tbody>
        </table></div>
      ) : <EmptyState icon={Zap} title="No automations yet" desc="Create your first automation rule to start saving your team time." />}
      <ConfirmDialog open={!!confirm} danger title="Delete automation" message={confirm ? `Delete “${confirm.name}”? This can't be undone.` : ""} confirmLabel="Delete"
        onConfirm={() => { setRules((rs) => rs.filter((x) => x.id !== confirm.id)); log(`Deleted automation “${confirm.name}”`, "Automation", "Warning"); push({ type: "success", title: "Automation deleted" }); }}
        onClose={() => setConfirm(null)} />
    </div>
  );
}

function ActivityLog({ logs }) {
  const [q, setQ] = useState(""); const [mod, setMod] = useState("All");
  const push = useToast();
  const mods = ["All", "Automation", "Canned Responses", "Modules"];
  const rows = logs.filter((l) => (mod === "All" || l.module === mod) && (l.action + l.user + l.module).toLowerCase().includes(q.toLowerCase()));
  const stStyle = { Success: { bg: "var(--success-soft)", fg: "var(--success)" }, Info: { bg: "var(--primary-soft)", fg: "var(--primary)" }, Warning: { bg: "var(--warning-soft)", fg: "var(--warning)" }, Failed: { bg: "var(--danger-soft)", fg: "var(--danger)" } };
  const exportLog = () => { try { exportCSV(logs.map((l) => ({ Timestamp: l.when, User: l.user, Action: l.action, Module: l.module, Status: l.status })), "automation-activity-log.csv"); push({ type: "success", title: "Activity log exported" }); } catch (e) { push({ type: "error", title: "Export failed" }); } };
  return (
    <div className="card panel">
      <div className="panel-head"><div className="panel-title"><span className="pic" style={{ background: "#8B5CF618", color: "#8B5CF6" }}><Activity size={19} /></span>Activity Log</div><button className="btn btn-soft btn-sm" onClick={exportLog}><Download size={15} /> Export</button></div>
      <div className="toolbar2"><div className="searchbox" style={{ maxWidth: 240, flex: "initial", width: 240 }}><Search size={16} /><input placeholder="Search activity…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="chips">{mods.map((m) => <button key={m} className={`fchip ${mod === m ? "on" : ""}`} onClick={() => setMod(m)}>{m}</button>)}</div></div>
      {rows.length ? (
        <div className="table-wrap"><table style={{ minWidth: 720 }}>
          <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Module</th><th>Status</th></tr></thead>
          <tbody>{rows.map((l) => { const st = stStyle[l.status] || stStyle.Info; return (<tr key={l.id}>
            <td style={{ fontSize: 12.5, color: "var(--muted)", whiteSpace: "nowrap" }}>{l.when}</td>
            <td style={{ fontSize: 12.5, fontWeight: 600 }}>{l.user}</td>
            <td style={{ fontSize: 12.5 }}>{l.action}</td>
            <td style={{ fontSize: 12.5, color: "var(--muted)" }}>{l.module}</td>
            <td><span className="badge-pill" style={{ background: st.bg, color: st.fg }}>{l.status}</span></td>
          </tr>); })}</tbody>
        </table></div>
      ) : <EmptyState icon={Activity} title="No activity" desc="Nothing matches your search or filter." />}
    </div>
  );
}

function CannedResponses({ canned, setCanned, log, onImport, onExport }) {
  const push = useToast();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [status, setStatus] = useState("All");
  const [by, setBy] = useState("All");
  const [from, setFrom] = useState("");
  const [sort, setSort] = useState("Updated Date");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [expOpen, setExpOpen] = useState(false);
  const expRef = useRef(null);
  useClickAway(expRef, () => setExpOpen(false));
  const authors = ["All", ...Array.from(new Set(canned.map((r) => r.by)))];

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    let r = canned.filter((x) =>
      (cat === "All" || x.cat === cat) && (status === "All" || x.status === status) && (by === "All" || x.by === by) &&
      (!term || [x.title, x.cat, x.shortcut, x.by].join(" ").toLowerCase().includes(term)));
    const cmp = {
      "Response Title": (a, b) => a.title.localeCompare(b.title),
      "Category": (a, b) => a.cat.localeCompare(b.cat),
      "Created Date": (a, b) => a.createdSort - b.createdSort,
      "Updated Date": (a, b) => a.createdSort - b.createdSort,
      "Usage Count": (a, b) => b.uses - a.uses,
    }[sort];
    return [...r].sort(cmp);
  }, [canned, q, cat, status, by, sort]);

  const save = (data, isEdit) => {
    if (isEdit) { setCanned((cs) => cs.map((x) => x.id === data.id ? { ...x, ...data, updated: "just now" } : x)); log(`Edited canned response “${data.title}”`, "Canned Responses"); push({ type: "success", title: "Response updated", desc: data.title }); }
    else { setCanned((cs) => [{ ...data, id: uid(), uses: 0, created: "just now", createdSort: cs.length, updated: "just now" }, ...cs]); log(`Added canned response “${data.title}”`, "Canned Responses"); push({ type: "success", title: "Response added", desc: data.title }); }
    setModal(false); setEditing(null);
  };
  const del = (r) => { setCanned((cs) => cs.filter((x) => x.id !== r.id)); log(`Deleted canned response “${r.title}”`, "Canned Responses", "Warning"); push({ type: "success", title: "Response deleted" }); };
  const dup = (r) => { setCanned((cs) => [{ ...r, id: uid(), title: "Copy of " + r.title, uses: 0, created: "just now", createdSort: cs.length, updated: "just now" }, ...cs]); log(`Duplicated canned response “${r.title}”`, "Canned Responses"); push({ type: "success", title: "Response duplicated" }); };
  const use = (r) => { setCanned((cs) => cs.map((x) => x.id === r.id ? { ...x, uses: x.uses + 1 } : x)); push({ type: "info", title: "Response applied", desc: `“${r.title}” inserted · usage +1` }); };
  const resetFilters = () => { setQ(""); setCat("All"); setStatus("All"); setBy("All"); setFrom(""); };

  return (
    <div className="card panel">
      <div className="panel-head">
        <div className="panel-title"><span className="pic" style={{ background: "#5B5CEB18", color: "#5B5CEB" }}><MessageSquareText size={19} /></span>Canned Responses <span className="count-badge" style={{ marginLeft: 4 }}>{canned.length}</span></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-soft btn-sm" onClick={onImport}><Upload size={14} /> Import</button>
          <div className="dd-wrap" ref={expRef}>
            <button className="btn btn-soft btn-sm" onClick={() => setExpOpen((o) => !o)}><Download size={14} /> Export <ChevronDown size={13} /></button>
            {expOpen && (<div className="menu menu-top right" style={{ minWidth: 150 }}>
              <button className="mi" onClick={() => { onExport("xlsx", rows); setExpOpen(false); }}><span className="mic" style={{ background: "#10B98118", color: "#10B981" }}><FileSpreadsheet size={14} /></span> Excel</button>
              <button className="mi" onClick={() => { onExport("csv", rows); setExpOpen(false); }}><span className="mic" style={{ background: "#0EA5E918", color: "#0EA5E9" }}><FileText size={14} /></span> CSV</button>
              <button className="mi" onClick={() => { onExport("json", rows); setExpOpen(false); }}><span className="mic" style={{ background: "#5B5CEB18", color: "#5B5CEB" }}><Code size={14} /></span> JSON</button>
            </div>)}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setModal(true); }}><PlusCircle size={15} /> New Response</button>
        </div>
      </div>
      <div className="toolbar2" style={{ gap: 8 }}>
        <div className="searchbox" style={{ maxWidth: 220, flex: "initial", width: 220 }}><Search size={16} /><input placeholder="Search title, shortcut, author…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="fchip" style={{ padding: "7px 10px" }} value={status} onChange={(e) => setStatus(e.target.value)}><option>All</option><option>Active</option><option>Inactive</option></select>
        <select className="fchip" style={{ padding: "7px 10px" }} value={by} onChange={(e) => setBy(e.target.value)}>{authors.map((a) => <option key={a}>{a}</option>)}</select>
        <input type="date" className="fchip" style={{ padding: "6px 10px" }} value={from} onChange={(e) => setFrom(e.target.value)} />
        <div className="dd-wrap" style={{ marginLeft: "auto" }}><CannedSort value={sort} onChange={setSort} /></div>
        <button className="btn btn-ghost btn-sm" onClick={resetFilters}><RotateCcw size={14} /> Reset</button>
      </div>
      <div className="chips" style={{ padding: "0 20px 14px" }}>
        <button className={`fchip ${cat === "All" ? "on" : ""}`} onClick={() => setCat("All")}>All</button>
        {CANNED_CATS_FULL.map((c) => <button key={c} className={`fchip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      {rows.length ? (
        <div className="table-wrap"><table style={{ minWidth: 820 }}>
          <thead><tr><th>Response Title</th><th>Category</th><th>Shortcut</th><th>Usage</th><th>Created By</th><th>Updated</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
          <tbody>{rows.map((r) => (<tr key={r.id}>
            <td className="rname">{r.title}</td>
            <td><span className="fchip" style={{ cursor: "default" }}>{r.cat}</span></td>
            <td><span className="chip">{r.shortcut}</span></td>
            <td style={{ fontWeight: 700 }}>{r.uses}</td>
            <td style={{ fontSize: 12.5 }}>{r.by}</td>
            <td style={{ fontSize: 12, color: "var(--muted)" }}>{r.updated}</td>
            <td><StatusChip active={r.status === "Active"} /></td>
            <td><div className="row-act" style={{ justifyContent: "flex-end" }}>
              <button title="Apply (usage +1)" onClick={() => use(r)}><Send size={15} /></button>
              <button title="Preview" onClick={() => setPreview(r)}><Eye size={15} /></button>
              <button title="Edit" onClick={() => { setEditing(r); setModal(true); }}><Pencil size={15} /></button>
              <button title="Duplicate" onClick={() => dup(r)}><Copy size={15} /></button>
              <button className="danger" title="Delete" onClick={() => setConfirm(r)}><Trash2 size={15} /></button>
            </div></td>
          </tr>))}</tbody>
        </table></div>
      ) : <EmptyState icon={MessageSquareText} title="No canned responses" desc="Nothing matches your filters. Create one or adjust your search." action="New Response" onAction={() => { setEditing(null); setModal(true); }} />}

      <CannedModal open={modal} initial={editing} onClose={() => { setModal(false); setEditing(null); }} onSave={save} />
      <CannedPreviewModal resp={preview} onClose={() => setPreview(null)} />
      <ConfirmDialog open={!!confirm} danger title="Delete response" message={confirm ? `Delete “${confirm.title}”? This can't be undone.` : ""} confirmLabel="Delete" onConfirm={() => del(confirm)} onClose={() => setConfirm(null)} />
    </div>
  );
}

function CannedSort({ value, onChange }) {
  const [open, setOpen] = useState(false); const ref = useRef(null);
  useClickAway(ref, () => setOpen(false));
  const opts = ["Response Title", "Category", "Created Date", "Updated Date", "Usage Count"];
  return (
    <div className="dd-wrap" ref={ref}>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}><ArrowUpDown size={14} /> {value} <ChevronDown size={13} /></button>
      {open && <div className="menu menu-top right" style={{ minWidth: 170 }}>{opts.map((o) => <button key={o} className="mi" style={{ padding: "8px 11px" }} onClick={() => { onChange(o); setOpen(false); }}>{o}{value === o && <CheckCheck size={14} style={{ marginLeft: "auto" }} />}</button>)}</div>}
    </div>
  );
}

function AutoClosureRules() {
  const [rows, setRows] = useState(CLOSURE_SEED);
  const [building, setBuilding] = useState(false);
  const [logic, setLogic] = useState("AND");
  const [conds, setConds] = useState([{ field:"Email Subject", op:"contains", val:"" }]);
  const [acts, setActs] = useState(["Mark as Resolved"]);
  const [name, setName] = useState("");
  const toggleAct = (k) => setActs(a => a.includes(k) ? a.filter(x=>x!==k) : [...a,k]);
  const save = () => {
    if (!name.trim()) return;
    const cond = conds.filter(c=>c.val).map(c=>`${c.field} ${c.op} "${c.val}"`).join(` ${logic} `) || "Any email";
    setRows(rs => [{ name, cond, action:acts.join(" + ")||"—", active:true, mod:"just now", count:0 }, ...rs]);
    setBuilding(false); setName(""); setConds([{field:"Email Subject",op:"contains",val:""}]); setActs(["Mark as Resolved"]);
  };
  return (
    <div className="card panel">
      <div className="panel-head">
        <div className="panel-title"><span className="pic" style={{background:"#0EA5E918",color:"#0EA5E9"}}><MailX size={19} /></span>Automatic Email Closure by Keywords</div>
        <button className="btn btn-primary btn-sm" onClick={()=>setBuilding(b=>!b)}>{building ? <><X size={15}/> Cancel</> : <><PlusCircle size={15} /> New Rule</>}</button>
      </div>
      {building && (
        <div style={{padding:20,borderBottom:"1px solid var(--border)",display:"flex",flexDirection:"column",gap:16,background:"var(--surface-2)"}}>
          <div className="fld" style={{maxWidth:360}}><label>Rule Name</label><input placeholder="e.g. Auto-close survey replies" value={name} onChange={(e)=>setName(e.target.value)} /></div>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}><label style={{fontSize:12,fontWeight:600}}>Match conditions</label>
              <div className="andor"><button className={logic==="AND"?"on":""} onClick={()=>setLogic("AND")}>AND</button><button className={logic==="OR"?"on":""} onClick={()=>setLogic("OR")}>OR</button></div></div>
            <div style={{display:"flex",flexDirection:"column",gap:9}}>
              {conds.map((c, i) => (
                <div className="builder-row" key={i}>
                  <select value={c.field} onChange={(e)=>setConds(cs=>cs.map((x,j)=>j===i?{...x,field:e.target.value}:x))}>{["Email Subject","Email Body","Sender Email Domain","Ticket Category","Ticket Status"].map(f=><option key={f}>{f}</option>)}</select>
                  <select value={c.op} onChange={(e)=>setConds(cs=>cs.map((x,j)=>j===i?{...x,op:e.target.value}:x))}>{["contains","equals","starts with"].map(o=><option key={o}>{o}</option>)}</select>
                  <input style={{flex:1,minWidth:160}} placeholder="keywords, comma separated" value={c.val} onChange={(e)=>setConds(cs=>cs.map((x,j)=>j===i?{...x,val:e.target.value}:x))} />
                  {conds.length>1 && <button className="row-act" style={{border:0,background:"transparent"}} onClick={()=>setConds(cs=>cs.filter((_,j)=>j!==i))}><Trash2 size={16} color="var(--danger)" /></button>}
                </div>))}
            </div>
            <button className="btn btn-soft btn-sm" style={{marginTop:10}} onClick={()=>setConds(cs=>[...cs,{field:"Email Body",op:"contains",val:""}])}><Plus size={14} /> Add condition</button>
          </div>
          <div><label style={{fontSize:12,fontWeight:600,display:"block",marginBottom:10}}>Actions to perform</label>
            <div className="chips">{CLOSURE_ACTIONS.map(a => <button key={a.k} className={`fchip ${acts.includes(a.k)?"on":""}`} onClick={()=>toggleAct(a.k)}><a.icon size={13} /> {a.k}</button>)}</div></div>
          <div style={{display:"flex",gap:10}}><button className="btn btn-primary btn-sm" onClick={save}><Check size={15} /> Save Rule</button><button className="btn btn-soft btn-sm" onClick={()=>setBuilding(false)}>Discard</button></div>
        </div>
      )}
      <div className="table-wrap">
        <table><thead><tr><th>Rule Name</th><th>Conditions</th><th>Action</th><th>Status</th><th>Last Modified</th><th>Triggers</th><th style={{textAlign:"right"}}>Actions</th></tr></thead>
          <tbody>{rows.map((r, i) => (<tr key={i}>
            <td className="rname">{r.name}</td>
            <td style={{maxWidth:240,fontSize:12.5,color:"var(--muted)"}}>{r.cond}</td>
            <td><span className="fchip" style={{cursor:"default"}}>{r.action}</span></td>
            <td><Switch on={r.active} onChange={(v)=>setRows(rs=>rs.map((x,j)=>j===i?{...x,active:v}:x))} /></td>
            <td style={{color:"var(--muted)",fontSize:12.5}}>{r.mod}</td>
            <td style={{fontWeight:700}}>{r.count}</td>
            <td><div className="row-act" style={{justifyContent:"flex-end"}}><button title="Edit"><Pencil size={15} /></button><button title="Duplicate" onClick={()=>setRows(rs=>[{...r,name:r.name+" (copy)",count:0},...rs])}><Copy size={15} /></button><button className="danger" title="Delete" onClick={()=>setRows(rs=>rs.filter((_,j)=>j!==i))}><Trash2 size={15} /></button></div></td>
          </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
function EmailForwarding() {
  const [rows, setRows] = useState(FORWARD_SEED);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name:"", cat:"Billing", prio:"Any", dept:"Finance", ctype:"Any", kw:"", dest:"", cc:"", bcc:"", retain:true });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const save = () => { if(!form.name||!form.dest) return; setRows(rs=>[{name:form.name,dest:form.dest,cond:`Category = ${form.cat}`,active:true,last:"just now"},...rs]); setOpen(false); setForm({name:"",cat:"Billing",prio:"Any",dept:"Finance",ctype:"Any",kw:"",dest:"",cc:"",bcc:"",retain:true}); };
  return (
    <div className="card panel">
      <div className="panel-head">
        <div className="panel-title"><span className="pic" style={{background:"#F59E0B18",color:"#F59E0B"}}><Forward size={19} /></span>Email Forwarding Automation</div>
        <button className="btn btn-primary btn-sm" onClick={()=>setOpen(true)}><PlusCircle size={15} /> New Forwarding Rule</button>
      </div>
      <div className="table-wrap">
        <table><thead><tr><th>Rule Name</th><th>Destination</th><th>Condition</th><th>Status</th><th>Last Triggered</th><th style={{textAlign:"right"}}>Actions</th></tr></thead>
          <tbody>{rows.map((r, i) => (<tr key={i}>
            <td className="rname">{r.name}</td>
            <td><span style={{display:"inline-flex",alignItems:"center",gap:6,fontWeight:600}}><Mail size={14} color="var(--muted)" /> {r.dest}</span></td>
            <td><span className="fchip" style={{cursor:"default"}}>{r.cond}</span></td>
            <td><Switch on={r.active} onChange={(v)=>setRows(rs=>rs.map((x,j)=>j===i?{...x,active:v}:x))} /></td>
            <td style={{color:"var(--muted)",fontSize:12.5}}>{r.last}</td>
            <td><div className="row-act" style={{justifyContent:"flex-end"}}><button title="Test send"><Play size={15} /></button><button title="Edit"><Pencil size={15} /></button><button title="Duplicate" onClick={()=>setRows(rs=>[{...r,name:r.name+" (copy)"},...rs])}><Copy size={15} /></button><button className="danger" title="Delete" onClick={()=>setRows(rs=>rs.filter((_,j)=>j!==i))}><Trash2 size={15} /></button></div></td>
          </tr>))}</tbody>
        </table>
      </div>
      {open && (
        <div className="modal-overlay" onClick={()=>setOpen(false)}>
          <div className="modal" onClick={(e)=>e.stopPropagation()}>
            <div className="modal-head"><div className="panel-title" style={{fontSize:15}}><span className="pic" style={{background:"#F59E0B18",color:"#F59E0B",width:32,height:32}}><Forward size={16} /></span>New Forwarding Rule</div><button className="icon-btn" onClick={()=>setOpen(false)}><X size={17} /></button></div>
            <div className="modal-body">
              <div className="fld"><label>Rule Name</label><input placeholder="e.g. Refunds → Finance team" value={form.name} onChange={(e)=>set("name",e.target.value)} /></div>
              <div className="grid2">
                <div className="fld"><label>Ticket Category</label><select value={form.cat} onChange={(e)=>set("cat",e.target.value)}>{["Billing","Placement","Internship","Technical Support","General Queries"].map(c=><option key={c}>{c}</option>)}</select></div>
                <div className="fld"><label>Priority</label><select value={form.prio} onChange={(e)=>set("prio",e.target.value)}>{["Any","Low","Medium","High","Critical"].map(c=><option key={c}>{c}</option>)}</select></div>
                <div className="fld"><label>Department</label><select value={form.dept} onChange={(e)=>set("dept",e.target.value)}>{["Finance","Placements","Tech Support","Student Success"].map(c=><option key={c}>{c}</option>)}</select></div>
                <div className="fld"><label>Customer Type</label><select value={form.ctype} onChange={(e)=>set("ctype",e.target.value)}>{["Any","Student","VIP","Recruiter"].map(c=><option key={c}>{c}</option>)}</select></div>
              </div>
              <div className="fld"><label>Match Keywords (optional)</label><input placeholder="refund, chargeback, payment" value={form.kw} onChange={(e)=>set("kw",e.target.value)} /></div>
              <div className="fld"><label>Destination Email(s)</label><input placeholder="finance@istudio.in, ops@istudio.in" value={form.dest} onChange={(e)=>set("dest",e.target.value)} /></div>
              <div className="grid2">
                <div className="fld"><label>CC</label><input placeholder="cc@istudio.in" value={form.cc} onChange={(e)=>set("cc",e.target.value)} /></div>
                <div className="fld"><label>BCC</label><input placeholder="bcc@istudio.in" value={form.bcc} onChange={(e)=>set("bcc",e.target.value)} /></div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}><Switch on={form.retain} onChange={(v)=>set("retain",v)} /><span style={{fontSize:13,fontWeight:600}}>Retain original email thread</span></div>
            </div>
            <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={()=>setOpen(false)}>Cancel</button><button className="btn btn-primary btn-sm" onClick={save}><Check size={15} /> Create Rule</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
function TaggedNotifications() {
  const [rows, setRows] = useState(NOTIF_SEED);
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState("Urgent"); const [recip, setRecip] = useState("");
  const [tpl, setTpl] = useState("Hi team, ticket {Ticket ID} from {Customer Name} was tagged. Subject: {Ticket Subject}. Please review.");
  const taRef = useRef(null);
  const insert = (token) => { setTpl(t => t + " " + token); taRef.current?.focus(); };
  const save = () => { if(!recip.trim()) return; setRows(rs=>[{tag,recip,tpl:"Custom template",active:true,last:"just now"},...rs]); setOpen(false); setRecip(""); };
  return (
    <div className="card panel">
      <div className="panel-head">
        <div className="panel-title"><span className="pic" style={{background:"#EC489918",color:"#EC4899"}}><BellRing size={19} /></span>Tagged Email Notifications</div>
        <button className="btn btn-primary btn-sm" onClick={()=>setOpen(true)}><PlusCircle size={15} /> New Notification</button>
      </div>
      <div className="table-wrap">
        <table><thead><tr><th>Tag</th><th>Recipients</th><th>Template</th><th>Status</th><th>Last Sent</th><th style={{textAlign:"right"}}>Actions</th></tr></thead>
          <tbody>{rows.map((r, i) => (<tr key={i}>
            <td><span className="fchip on" style={{cursor:"default"}}><TagIcon size={12} /> {r.tag}</span></td>
            <td style={{fontSize:12.5}}>{r.recip}</td>
            <td style={{color:"var(--muted)",fontSize:12.5}}>{r.tpl}</td>
            <td><Switch on={r.active} onChange={(v)=>setRows(rs=>rs.map((x,j)=>j===i?{...x,active:v}:x))} /></td>
            <td style={{color:"var(--muted)",fontSize:12.5}}>{r.last}</td>
            <td><div className="row-act" style={{justifyContent:"flex-end"}}><button title="Edit"><Pencil size={15} /></button><button title="Duplicate" onClick={()=>setRows(rs=>[{...r},...rs])}><Copy size={15} /></button><button className="danger" title="Delete" onClick={()=>setRows(rs=>rs.filter((_,j)=>j!==i))}><Trash2 size={15} /></button></div></td>
          </tr>))}</tbody>
        </table>
      </div>
      {open && (
        <div className="modal-overlay" onClick={()=>setOpen(false)}>
          <div className="modal" onClick={(e)=>e.stopPropagation()}>
            <div className="modal-head"><div className="panel-title" style={{fontSize:15}}><span className="pic" style={{background:"#EC489918",color:"#EC4899",width:32,height:32}}><BellRing size={16} /></span>New Tagged Notification</div><button className="icon-btn" onClick={()=>setOpen(false)}><X size={17} /></button></div>
            <div className="modal-body">
              <div><label style={{fontSize:12,fontWeight:600,display:"block",marginBottom:10}}>Trigger tag</label><div className="chips">{TAGS.map(t=><button key={t} className={`fchip ${tag===t?"on":""}`} onClick={()=>setTag(t)}>{t}</button>)}</div></div>
              <div className="fld"><label>Recipients (comma separated)</label><input placeholder="ops@istudio.in, lead@istudio.in" value={recip} onChange={(e)=>setRecip(e.target.value)} /></div>
              <div className="fld"><label>Notification Template</label>
                <div className="chips" style={{marginBottom:8}}>{PLACEHOLDERS.map(p=><button key={p} className="token" onClick={()=>insert(p)}><Plus size={11} /> {p}</button>)}</div>
                <textarea ref={taRef} value={tpl} onChange={(e)=>setTpl(e.target.value)} />
              </div>
            </div>
            <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={()=>setOpen(false)}>Cancel</button><button className="btn btn-primary btn-sm" onClick={save}><Check size={15} /> Create Notification</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
function AutomationLogs() {
  const [q, setQ] = useState(""); const [status, setStatus] = useState("All");
  const rows = LOGS.filter(l => (status==="All"||l.status===status) && (l.auto+l.cust+l.tid+l.act).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="card panel">
      <div className="panel-head">
        <div className="panel-title"><span className="pic" style={{background:"#8B5CF618",color:"#8B5CF6"}}><Activity size={19} /></span>Automation Activity Log</div>
        <button className="btn btn-soft btn-sm"><Download size={15} /> Export Log</button>
      </div>
      <div className="toolbar2">
        <div className="searchbox" style={{maxWidth:240,flex:"initial",width:240}}><Search size={16} /><input placeholder="Search events..." value={q} onChange={(e)=>setQ(e.target.value)} /></div>
        <div className="chips">{["All","Success","Failed","Pending","Disabled"].map(s=><button key={s} className={`fchip ${status===s?"on":""}`} onClick={()=>setStatus(s)}>{s}</button>)}</div>
      </div>
      <div className="table-wrap">
        <table style={{minWidth:880}}><thead><tr><th>Automation</th><th>Triggered By</th><th>Ticket</th><th>Customer</th><th>Action Performed</th><th>Date &amp; Time</th><th>Status</th></tr></thead>
          <tbody>{rows.map((l, i) => { const st = LOG_STYLE[l.status]; return (<tr key={i}>
            <td className="rname">{l.auto}</td><td style={{fontSize:12.5}}>{l.by}</td>
            <td style={{fontWeight:700,color:"var(--primary)"}}>{l.tid}</td><td style={{fontSize:12.5}}>{l.cust}</td>
            <td style={{fontSize:12.5,color:"var(--muted)"}}>{l.act}</td>
            <td style={{fontSize:12.5,color:"var(--muted)",whiteSpace:"nowrap"}}>{l.when}</td>
            <td><span className="badge-pill" style={{background:st.bg,color:st.fg}}><st.icon size={12} /> {l.status}</span></td>
          </tr>); })}</tbody>
        </table>
      </div>
    </div>
  );
}
function RingLg({ pct, color }) {
  const r=44, c=2*Math.PI*r; const [off,setOff]=useState(c);
  useEffect(()=>{ const t=setTimeout(()=>setOff(c-pct/100*c),150); return ()=>clearTimeout(t); },[pct,c]);
  return (<svg width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="11" /><circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 60 60)" style={{transition:"stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)"}} /></svg>);
}
function AutomationAnalytics() {
  const totalRules = RULE_DIST.reduce((a,d)=>a+d.value,0);
  return (
    <div className="panel">
      <div className="section-head"><div><h3 className="card-title" style={{fontSize:17}}>Automation Analytics</h3><p className="card-sub">Performance and impact across all automation rules</p></div><button className="btn btn-soft btn-sm">Last 30 days</button></div>
      <div className="kpi-grid" style={{marginBottom:16}}>
        {KPIS.map((k) => (<div className="card kpi" key={k.lab}><div className="ic" style={{background:`${k.color}18`,color:k.color}}><k.icon size={22} /></div><div><div className="val">{k.val}</div><div className="lab">{k.lab}</div></div></div>))}
      </div>
      <div className="analytics-grid">
        <div className="card card-pad">
          <h4 className="card-title" style={{marginBottom:4}}>Automations Triggered</h4><p className="card-sub" style={{marginBottom:12}}>Rule runs over the past week</p>
          <div style={{height:220}}><ResponsiveContainer width="100%" height="100%"><BarChart data={WEEK} margin={{top:8,right:6,left:-16,bottom:0}}>
            <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="t" tick={{fontSize:12,fill:"var(--muted)"}} axisLine={false} tickLine={false} />
            <YAxis tick={{fontSize:12,fill:"var(--muted)"}} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{fill:"var(--hover)"}} />
            <Bar dataKey="runs" name="Rule runs" fill="#5B5CEB" radius={[7,7,0,0]} maxBarSize={34} />
          </BarChart></ResponsiveContainer></div>
        </div>
        <div className="card card-pad">
          <h4 className="card-title" style={{marginBottom:4}}>Success Rate</h4><p className="card-sub" style={{marginBottom:12}}>Executions completed successfully</p>
          <div className="ring-wrap"><RingLg pct={96} color="#10B981" /><b style={{color:"#10B981"}}>96%</b></div>
          <div style={{display:"flex",justifyContent:"center",gap:18,marginTop:14,fontSize:12.5}}>
            <span style={{color:"var(--muted)"}}><b style={{color:"var(--success)"}}>2,481</b> success</span>
            <span style={{color:"var(--muted)"}}><b style={{color:"var(--danger)"}}>103</b> failed</span>
          </div>
        </div>
        <div className="card card-pad">
          <h4 className="card-title" style={{marginBottom:4}}>Rule Distribution</h4><p className="card-sub" style={{marginBottom:8}}>By type · {totalRules} active</p>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <div style={{width:130,height:130,position:"relative",flexShrink:0}}>
              <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={RULE_DIST} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2} stroke="none">{RULE_DIST.map(d=><Cell key={d.name} fill={d.color} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart></ResponsiveContainer>
              <div style={{position:"absolute",inset:0,display:"grid",placeItems:"center",pointerEvents:"none"}}><div style={{fontSize:20,fontWeight:800}}>{totalRules}</div></div>
            </div>
            <div style={{flex:1}}>{RULE_DIST.map(d=>(<div className="dist-row" key={d.name}><span className="dotc" style={{background:d.color,width:9,height:9}} /><span className="nm">{d.name}</span><span className="ct">{d.value}</span></div>))}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
function AutomationPage({ onTheme }) {
  const push = useToast();
  const [modules, setModules] = useState(MODULES);
  const [sel, setSel] = useState("canned");
  const [q, setQ] = useState("");
  const [rules, setRules] = useState(RULES_SEED);
  const [canned, setCanned] = useState(CANNED_INIT);
  const [logs, setLogs] = useState(ACTIVITY_INIT);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRule, setEditRule] = useState(null);
  const [viewRule, setViewRule] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 600); return () => clearTimeout(t); }, []);

  const log = (action, module, status = "Success") => setLogs((l) => [{ id: uid(), when: "just now", user: "Admin", action, module, status }, ...l]);
  const toggleMod = (key, v) => { setModules((ms) => ms.map((m) => m.key === key ? { ...m, active: v } : m)); log(`${v ? "Enabled" : "Disabled"} the ${key} module`, "Modules", "Info"); };
  const activeCount = modules.filter((m) => m.active).length;
  const shown = modules.filter((m) => (m.title + m.desc).toLowerCase().includes(q.toLowerCase()));

  const saveRule = (rule, isEdit) => {
    if (isEdit) { setRules((rs) => rs.map((r) => r.id === rule.id ? { ...r, ...rule, modified: "just now" } : r)); log(`Updated automation “${rule.name}”`, "Automation"); push({ type: "success", title: "Automation updated", desc: rule.name }); }
    else { setRules((rs) => [{ ...rule, id: uid(), created: "just now", modified: "just now" }, ...rs]); log(`Created automation “${rule.name}”`, "Automation"); push({ type: "success", title: "Automation created", desc: rule.name }); }
    setCreateOpen(false); setEditRule(null);
  };
  const importCanned = (rows) => {
    setCanned((cs) => [...rows.map((r, i) => ({ id: uid(), title: r.title, cat: r.cat, shortcut: r.shortcut, body: r.body, tags: [], by: r.by, status: r.status === "Inactive" ? "Inactive" : "Active", created: "just now", createdSort: cs.length + i, updated: "just now", uses: 0 })), ...cs]);
    log(`Imported ${rows.length} canned responses`, "Canned Responses"); push({ type: "success", title: "Import complete", desc: `${rows.length} responses added.` });
  };
  const exportCanned = (kind, rows) => {
    try {
      const data = (rows || canned).map((r) => ({ "Response Title": r.title, "Category": r.cat, "Shortcut": r.shortcut, "Status": r.status, "Created By": r.by, "Created Date": r.created, "Last Updated": r.updated }));
      if (kind === "xlsx") exportExcel(data, "canned-responses.xlsx");
      else if (kind === "csv") exportCSV(data, "canned-responses.csv");
      else downloadBlob(JSON.stringify(data, null, 2), "canned-responses.json", "application/json");
      log(`Exported ${data.length} canned responses (${kind.toUpperCase()})`, "Canned Responses"); push({ type: "success", title: "Export ready", desc: `canned-responses.${kind} downloaded.` });
    } catch (e) { push({ type: "error", title: "Export failed" }); }
  };

  return (
    <div className="content route">
      <div className="auto-head fade">
        <div><h1><Zap size={26} color="var(--primary)" /> Automation Center <span className="badge-live"><span className="dotc" style={{ background: "var(--success)" }} /> {activeCount} active</span></h1><p>Automate repetitive support tasks and improve agent productivity.</p></div>
        <div className="head-actions">
          <div className="searchbox" style={{ maxWidth: 220, width: 220, flex: "initial" }}><Search size={16} /><input placeholder="Search modules…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={() => { setEditRule(null); setCreateOpen(true); }}><PlusCircle size={16} /> Create Automation</button>
          <button className="btn btn-ghost" onClick={() => setImportOpen(true)}><Upload size={16} /> Import</button>
          <button className="btn btn-ghost" onClick={() => exportCanned("xlsx")}><Download size={16} /> Export</button>
          <button className="btn btn-ghost" onClick={onTheme}><Palette size={16} /> Customize Theme</button>
        </div>
      </div>

      <div className="mod-grid">
        {shown.map((m, i) => (
          <div key={m.key} className={`card mod ${sel === m.key ? "sel" : ""}`} style={{ animationDelay: `${i * 70}ms` }} onClick={() => setSel(m.key)}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}><div className="ic" style={{ background: `${m.color}18`, color: m.color }}><m.icon size={22} /></div><Switch on={m.active} onChange={(v) => toggleMod(m.key, v)} /></div>
            <div><h4>{m.title}</h4></div><p>{m.desc}</p>
            <div className="mod-foot"><StatusChip active={m.active} /><span style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: 4 }}>Manage <ChevronDown size={13} style={{ transform: "rotate(-90deg)" }} /></span></div>
          </div>
        ))}
      </div>

      {loading ? <div className="card sk-card" style={{ height: 220 }}><div className="sk" style={{ height: 40, width: "40%" }} /><div className="sk" style={{ flex: 1 }} /></div> : (
        sel === "canned" ? <CannedResponses canned={canned} setCanned={setCanned} log={log} onImport={() => setImportOpen(true)} onExport={exportCanned} />
          : sel === "closure" ? <AutoClosureRules />
          : sel === "forward" ? <EmailForwarding />
          : <TaggedNotifications />
      )}

      <AutomationRulesTable rules={rules} setRules={setRules} log={log} onEdit={(r) => { setEditRule(r); setCreateOpen(true); }} onView={setViewRule} />
      <ActivityLog logs={logs} />
      <AutomationAnalytics />

      <CreateAutomationModal open={createOpen} initial={editRule} onClose={() => { setCreateOpen(false); setEditRule(null); }} onSave={saveRule} />
      <RuleViewModal rule={viewRule} onClose={() => setViewRule(null)} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={importCanned} />
    </div>
  );
}

/* ============================================================================
   SETTINGS MODULE
   ========================================================================== */
const SET_SECTIONS = [
  { key: "general", label: "General", icon: Settings },
  { key: "teams", label: "Team Management", icon: UsersRound },
  { key: "approvals", label: "User Approvals", icon: UserCheck },
  { key: "roles", label: "Roles & Permissions", icon: UserCog },
  { key: "ticket", label: "Ticket Settings", icon: Ticket },
  { key: "email", label: "Email Settings", icon: Mail },
  { key: "notif", label: "Notifications", icon: Bell },
  { key: "theme", label: "Theme & Appearance", icon: Palette },
  { key: "autom", label: "Automation", icon: Zap },
  { key: "customer", label: "Customer Settings", icon: Users },
  { key: "kb", label: "Knowledge Base", icon: BookOpen },
  { key: "security", label: "Security", icon: ShieldCheck },
  { key: "backup", label: "Backup & Restore", icon: HardDrive },
  { key: "audit", label: "Audit Logs", icon: ScrollText },
  { key: "api", label: "API & Integrations", icon: Plug },
  { key: "reports", label: "Reports", icon: BarChart3 },
];
const SET_TEAMS = ["Technical Support", "Internship Support", "Attendance Team", "Certificate Team", "Placement Team", "Billing Team", "Customer Success"];
const SET_ROLES = ["Super Admin", "Admin", "Team Lead", "Support Agent", "QA Manager"];
const SET_PERMS = ["Dashboard", "Tickets", "Customers", "Knowledge Base", "Reports", "Automation", "Analytics", "Settings", "Teams", "Export Reports", "Delete Tickets", "Merge Tickets", "Bulk Update", "Assign Tickets", "Close Tickets"];
const SEED_AGENTS = ["Rahul Sharma", "Priya Patel", "Aman Singh", "Neha Verma", "Karan Mehta", "Sneha Iyer", "Akash Gupta", "Pooja Sharma", "Rohan Desai", "Priya Nair", "Rahul Sethi"].map((n, i) => ({
  id: uid(), name: n, emp: `EMP-${1041 + i * 7}`, email: n.toLowerCase().replace(" ", ".") + "@internshipstudio.com",
  phone: `+91 98${(200 + i * 11).toString().padStart(3, "0")} ${(40000 + i * 731).toString().padStart(5, "0")}`,
  dept: DEPTS[i % DEPTS.length], role: ["Admin", "Team Lead", "Support Agent", "Support Agent", "Support Agent", "QA Manager", "Support Agent", "Team Lead", "Support Agent", "Team Lead", "Support Executive"][i],
  team: SET_TEAMS[i % SET_TEAMS.length], active: i !== 6, assigned: 4 + (i * 3) % 11, resolved: 2 + (i * 5) % 9,
  lastLogin: ["just now", "12 min ago", "1 hr ago", "3 hr ago", "yesterday", "2 days ago"][i % 6],
}));

function useSet(defaults, label) {
  const push = useToast();
  const [saved, setSaved] = useState(defaults);
  const [v, setV] = useState(defaults);
  const set = (k, val) => setV((x) => ({ ...x, [k]: val }));
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const save = () => { setSaved(v); push({ type: "success", title: `${label} saved`, desc: "Your changes have been applied." }); };
  const cancel = () => setV(saved);
  const reset = () => { setV(defaults); setSaved(defaults); push({ type: "info", title: `${label} reset`, desc: "Restored default values." }); };
  return { v, set, dirty, save, cancel, reset };
}
function SaveBar({ s }) {
  return (
    <div className="savebar">
      <button className="btn btn-ghost btn-sm" onClick={s.reset}><RotateCcw size={14} /> Reset to Default</button>
      <button className="btn btn-soft btn-sm" disabled={!s.dirty} onClick={s.cancel}>Cancel</button>
      <button className="btn btn-primary btn-sm" disabled={!s.dirty} onClick={s.save}><Save size={14} /> Save</button>
    </div>
  );
}
function SetField({ label, children }) { return <div className="fld"><label>{label}</label>{children}</div>; }
function ToggleRow({ icon: Ic, title, desc, on, onChange }) {
  return (
    <div className="set-row">
      {Ic && <span className="pic" style={{ background: "var(--primary-soft)", color: "var(--primary)", width: 34, height: 34 }}><Ic size={16} /></span>}
      <div style={{ flex: 1 }}><div className="ti">{title}</div>{desc && <div className="td">{desc}</div>}</div>
      <Switch on={on} onChange={onChange} />
    </div>
  );
}
function SecCard({ title, sub, children, right }) {
  return (
    <div className="card card-pad">
      <div className="section-head" style={{ marginBottom: 14 }}>
        <div><h3 className="card-title">{title}</h3>{sub && <p className="card-sub">{sub}</p>}</div>{right}
      </div>
      {children}
    </div>
  );
}

/* ---- 1. general ---- */
function GeneralSettings({ logoApi }) {
  const push = useToast();
  const logo = logoApi?.logo || "";
  const saveLogo = logoApi?.saveLogo || (() => {});
  const fileRef = useRef(null);
  const [logoErr, setLogoErr] = useState("");
  const onLogoFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const okTypes = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
    if (!okTypes.includes(file.type)) { setLogoErr("Invalid file type. Use PNG, JPG, JPEG, SVG or WEBP."); push({ type: "error", title: "Invalid file", desc: "Allowed: PNG, JPG, JPEG, SVG, WEBP." }); return; }
    if (file.size > 5 * 1024 * 1024) { setLogoErr("File too large. Maximum size is 5 MB."); push({ type: "error", title: "File too large", desc: "Maximum logo size is 5 MB." }); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = String(ev.target.result);
      const finish = (dataUrl) => { setLogoErr(""); saveLogo(dataUrl); push({ type: "success", title: "Logo uploaded", desc: "Your logo now appears across the app and persists after refresh." }); };
      if (file.type === "image/svg+xml") { finish(raw); return; }
      // Downscale raster images so they always fit persistent storage quotas
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 512;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          finish(canvas.toDataURL("image/png"));
        } catch (e) { finish(raw); }
      };
      img.onerror = () => finish(raw);
      img.src = raw;
    };
    reader.onerror = () => { setLogoErr("Could not read the file. Try again."); push({ type: "error", title: "Upload failed" }); };
    reader.readAsDataURL(file);
  };
  const removeLogo = () => { saveLogo(""); setLogoErr(""); push({ type: "info", title: "Logo removed", desc: "Reverted to the default HelpHive mark." }); };
  const downloadLogo = () => {
    if (!logo) return;
    const mime = (logo.match(/^data:([^;]+);/) || [])[1] || "image/png";
    const ext = mime.includes("svg") ? "svg" : mime.includes("webp") ? "webp" : mime.includes("jpeg") ? "jpg" : "png";
    const a = document.createElement("a"); a.href = logo; a.download = `company-logo.${ext}`; a.click();
    push({ type: "success", title: "Download started", desc: `company-logo.${ext}` });
  };
  const s = useSet({ org: "Internship Studio", email: "contact@internshipstudio.com", phone: "+91 90000 10000", url: "https://internshipstudio.com", addr: "Baner, Pune, Maharashtra 411045", tz: "Asia/Kolkata (IST)", dateFmt: "DD MMM YYYY", timeFmt: "12-hour", lang: "English", cur: "INR (INR)", landing: "Dashboard" }, "General settings");
  return (
    <SecCard title="General Settings" sub="Organization identity, locale and defaults.">
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
        <label className={`logo-drop ${logo ? "has-img" : ""}`} title={logo ? "Change company logo" : "Upload company logo"}>
          {logo ? <img src={logo} alt="Company logo preview" /> : <Camera size={20} />}
          <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange={onLogoFile} />
        </label>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 800 }}>Company Logo</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>PNG, JPG, SVG or WEBP · max 5 MB. Shown on the sign-in page, sidebar and PDF reports.</div>
          <div style={{ display: "flex", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
            <button className="btn btn-soft btn-sm" onClick={() => fileRef.current?.click()}><Upload size={13} /> {logo ? "Change Logo" : "Upload Logo"}</button>
            {logo && <button className="btn btn-soft btn-sm" onClick={downloadLogo}><Download size={13} /> Download</button>}
            {logo && <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={removeLogo}><Trash2 size={13} /> Remove</button>}
          </div>
        </div>
      </div>
      {logoErr && <div className="logo-err"><AlertTriangle size={13} /> {logoErr}</div>}
      <div style={{ height: 12 }} />
      <div className="set-grid2">
        <SetField label="Organization Name"><input value={s.v.org} onChange={(e) => s.set("org", e.target.value)} /></SetField>
        <SetField label="Support Email"><input value={s.v.email} onChange={(e) => s.set("email", e.target.value)} /></SetField>
        <SetField label="Support Phone"><input value={s.v.phone} onChange={(e) => s.set("phone", e.target.value)} /></SetField>
        <SetField label="Website URL"><input value={s.v.url} onChange={(e) => s.set("url", e.target.value)} /></SetField>
        <SetField label="Time Zone"><select value={s.v.tz} onChange={(e) => s.set("tz", e.target.value)}>{["Asia/Kolkata (IST)", "UTC", "America/New_York (EST)", "Europe/London (GMT)", "Asia/Dubai (GST)"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Date Format"><select value={s.v.dateFmt} onChange={(e) => s.set("dateFmt", e.target.value)}>{["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Time Format"><select value={s.v.timeFmt} onChange={(e) => s.set("timeFmt", e.target.value)}>{["12-hour", "24-hour"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Language"><select value={s.v.lang} onChange={(e) => s.set("lang", e.target.value)}>{["English", "Hindi", "Marathi"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Currency"><select value={s.v.cur} onChange={(e) => s.set("cur", e.target.value)}>{["INR (INR)", "USD (USD)", "EUR (EUR)"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Default Landing Page"><select value={s.v.landing} onChange={(e) => s.set("landing", e.target.value)}>{["Dashboard", "Tickets", "Customers", "Automation"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
      </div>
      <SetField label="Company Address"><textarea style={{ minHeight: 60 }} value={s.v.addr} onChange={(e) => s.set("addr", e.target.value)} /></SetField>
      <SaveBar s={s} />
    </SecCard>
  );
}

/* ---- 2. teams ---- */
function AgentModal({ open, initial, onClose, onSave }) {
  const push = useToast();
  const blank = { name: "", email: "", phone: "", emp: "", dept: DEPTS[0], team: SET_TEAMS[0], desig: "Support Executive", role: "Support Agent", pass: "", pass2: "" };
  const [f, setF] = useState(blank);
  useEffect(() => { if (open) setF(initial ? { ...blank, ...initial } : blank); }, [open, initial]);
  if (!open) return null;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    if (!f.name.trim() || !f.email.trim()) { push({ type: "error", title: "Missing details", desc: "Name and email are required." }); return; }
    if (!initial && (!f.pass || f.pass !== f.pass2)) { push({ type: "error", title: "Password problem", desc: "Passwords must match and can't be empty." }); return; }
    onSave(f, !!initial);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#0EA5E918", color: "#0EA5E9", width: 32, height: 32 }}><UserPlus size={16} /></span>{initial ? "Edit Agent" : "Add Agent"}</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <label className="logo-drop" style={{ width: 56, height: 56, borderRadius: "50%" }}><Camera size={17} /><input type="file" hidden accept="image/*" onChange={() => push({ type: "success", title: "Photo uploaded" })} /></label>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Profile picture (optional)</div>
          </div>
          <div className="set-grid2">
            <SetField label="Full Name *"><input value={f.name} onChange={(e) => set("name", e.target.value)} /></SetField>
            <SetField label="Email *"><input value={f.email} onChange={(e) => set("email", e.target.value)} /></SetField>
            <SetField label="Phone"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></SetField>
            <SetField label="Employee ID"><input value={f.emp} onChange={(e) => set("emp", e.target.value)} placeholder="EMP-1099" /></SetField>
            <SetField label="Department"><select value={f.dept} onChange={(e) => set("dept", e.target.value)}>{DEPTS.map((o) => <option key={o}>{o}</option>)}</select></SetField>
            <SetField label="Team"><select value={f.team} onChange={(e) => set("team", e.target.value)}>{SET_TEAMS.map((o) => <option key={o}>{o}</option>)}</select></SetField>
            <SetField label="Designation"><input value={f.desig} onChange={(e) => set("desig", e.target.value)} /></SetField>
            <SetField label="Role"><select value={f.role} onChange={(e) => set("role", e.target.value)}>{SET_ROLES.map((o) => <option key={o}>{o}</option>)}</select></SetField>
            {!initial && <><SetField label="Password *"><input type="password" value={f.pass} onChange={(e) => set("pass", e.target.value)} /></SetField>
            <SetField label="Confirm Password *"><input type="password" value={f.pass2} onChange={(e) => set("pass2", e.target.value)} /></SetField></>}
          </div>
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" onClick={save}><Check size={15} /> {initial ? "Save Changes" : "Add Agent"}</button></div>
      </div>
    </div>
  );
}
function PerfModal({ agent, onClose }) {
  if (!agent) return null;
  const data = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => ({ d, resolved: 2 + (agent.resolved + i * 3) % 7, assigned: 3 + (agent.assigned + i * 2) % 8 }));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "#10B98118", color: "#10B981", width: 32, height: 32 }}><TrendingUp size={16} /></span>{agent.name} - Performance</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          <div className="an-kpis" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            {[["Assigned", agent.assigned], ["Resolved", agent.resolved], ["Resolution", Math.round(agent.resolved / Math.max(1, agent.assigned) * 100) + "%"], ["CSAT", 82 + agent.resolved + "%"]].map(([k, v]) => <div className="an-kpi" key={k}><div className="v">{v}</div><div className="l">{k}</div></div>)}
          </div>
          <div style={{ height: 190 }}>
            <ResponsiveContainer width="100%" height="100%"><BarChart data={data} barSize={14}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="d" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="assigned" fill="var(--accent)" radius={[4, 4, 0, 0]} /><Bar dataKey="resolved" fill="var(--success)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
          </div>
        </div>
        <div className="modal-foot"><button className="btn btn-primary btn-sm" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
/* ---- pending registration approvals ---- */
function ApprovalSettings() {
  const push = useToast();
  const [tick, setTick] = useState(0);
  const [editRole, setEditRole] = useState({}); // email -> designation
  let regUsers = {};
  try { regUsers = JSON.parse(kvGetSync(USERS_KEY) || "{}"); } catch (e) {}
  const pending = Object.entries(regUsers).filter(([, u]) => u.status === "pending");
  const decided = Object.entries(regUsers).filter(([, u]) => u.status === "active" || u.status === "rejected");

  const decide = async (email, status) => {
    const next = { ...regUsers };
    if (status === "rejected") { next[email] = { ...next[email], status: "rejected" }; }
    else {
      next[email] = { ...next[email], status: "active", designation: editRole[email] || next[email].designation, approvedAt: Date.now() };
      // add approved user to the Team Management roster so signatures resolve
      try {
        const roster = getTeamRoster();
        if (!roster.some((a) => (a.email || "").toLowerCase() === email.toLowerCase())) {
          const u = next[email];
          roster.push({ name: u.name, emp: "EMP" + String(Math.floor(100 + Math.random() * 900)), email, phone: u.phone || "", dept: u.dept || "Technical Support", role: u.designation || "Support Executive", team: u.dept || "Technical Support", active: true });
          kvSet(TEAM_KEY, JSON.stringify(roster));
        }
      } catch (e) {}
    }
    await kvSet(USERS_KEY, JSON.stringify(next));
    push({ type: status === "active" ? "success" : "info", title: status === "active" ? "User approved" : "Registration rejected", desc: email });
    setTick((t) => t + 1);
  };

  return (
    <SecCard title="User Approvals" sub="Review new registrations before they can sign in.">
      {pending.length === 0 && <div className="empty-min"><UserCheck size={22} /><p>No registrations waiting for approval.</p></div>}
      {pending.map(([email, u]) => (
        <div key={email} className="approval-row">
          <span className="msg-av" style={{ background: "linear-gradient(135deg,var(--primary),var(--accent))" }}>{(u.name || email).split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
          <div className="approval-info">
            <b>{u.name}</b>
            <span>{email} · {u.phone}</span>
            <span className="meta">{u.dept ? `${u.dept} · ` : ""}{u.company || "Internship Studio"} · applied {new Date(u.createdAt || Date.now()).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
            <span className="badges"><span className="vbadge"><CheckCircle2 size={11} /> Email verified</span><span className="vbadge"><CheckCircle2 size={11} /> Mobile verified</span></span>
          </div>
          <div className="approval-actions">
            <select value={editRole[email] ?? u.designation} onChange={(e) => setEditRole({ ...editRole, [email]: e.target.value })}>
              {REG_DESIGNATIONS.map((d) => <option key={d}>{d}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" onClick={() => decide(email, "active")}><Check size={13} /> Approve</button>
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => decide(email, "rejected")}><X size={13} /> Reject</button>
          </div>
        </div>
      ))}
      {decided.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: 18 }}><h3 className="card-title" style={{ fontSize: 13 }}>Recent decisions</h3></div>
          {decided.slice(-5).reverse().map(([email, u]) => (
            <div key={email} className="approval-row past">
              <div className="approval-info"><b>{u.name}</b><span>{email}</span></div>
              <span className={`chip ${u.status === "active" ? "chip-green" : "chip-red"}`}>{u.status === "active" ? "Approved" : "Rejected"}</span>
            </div>
          ))}
        </>
      )}
    </SecCard>
  );
}

function TeamSettings() {
  const push = useToast();
  const [agents, setAgents] = useState(getTeamRoster);
  useEffect(() => { kvSet(TEAM_KEY, JSON.stringify(agents)); }, [agents]); // signatures read this live
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [perf, setPerf] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const active = agents.filter((a) => a.active).length;
  const save = (f, isEdit) => {
    if (isEdit) { setAgents((as) => as.map((a) => a.id === f.id ? { ...a, ...f } : a)); push({ type: "success", title: "Agent updated", desc: f.name }); }
    else { setAgents((as) => [{ ...f, id: uid(), emp: f.emp || `EMP-${1100 + as.length}`, active: true, assigned: 0, resolved: 0, lastLogin: "never" }, ...as]); push({ type: "success", title: "Agent added", desc: `${f.name} joined ${f.team}.` }); }
    setModal(false); setEditing(null);
  };
  return (
    <SecCard title="Team Management" sub="Manage support agents, teams and access." right={<button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setModal(true); }}><UserPlus size={14} /> Add Agent</button>}>
      <div className="an-kpis" style={{ gridTemplateColumns: "repeat(5,1fr)", marginBottom: 16 }}>
        {[["Total Agents", agents.length], ["Active", active], ["Offline", agents.length - active], ["Assigned Today", agents.reduce((n, a) => n + a.assigned, 0)], ["Resolution Rate", Math.round(agents.reduce((n, a) => n + a.resolved, 0) / Math.max(1, agents.reduce((n, a) => n + a.assigned, 0)) * 100) + "%"]].map(([k, v]) => <div className="an-kpi" key={k}><div className="v">{v}</div><div className="l">{k}</div></div>)}
      </div>
      <div className="table-wrap"><table style={{ minWidth: 1040 }}>
        <thead><tr><th>Agent</th><th>Employee ID</th><th>Phone</th><th>Department</th><th>Role</th><th>Team</th><th>Status</th><th>Assigned</th><th>Resolved</th><th>Last Login</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
        <tbody>{agents.map((a) => (<tr key={a.id}>
          <td><div className="cust"><span className="a" style={{ background: avColor(a.name) }}>{initials(a.name)}</span><div><div className="nm">{a.name}</div><div className="em">{a.email}</div></div></div></td>
          <td style={{ fontWeight: 600, fontSize: 12 }}>{a.emp}</td>
          <td style={{ fontSize: 12, color: "var(--muted)" }}>{a.phone}</td>
          <td style={{ fontSize: 12.5 }}>{a.dept}</td>
          <td style={{ fontSize: 12.5, fontWeight: 600 }}>{a.role}</td>
          <td style={{ fontSize: 12.5 }}>{a.team}</td>
          <td><Switch on={a.active} onChange={(v) => { setAgents((as) => as.map((x) => x.id === a.id ? { ...x, active: v } : x)); push({ type: "info", title: v ? "Agent activated" : "Agent deactivated", desc: a.name }); }} /></td>
          <td style={{ fontWeight: 700 }}>{a.assigned}</td>
          <td style={{ fontWeight: 700, color: "var(--success)" }}>{a.resolved}</td>
          <td style={{ fontSize: 12, color: "var(--muted)" }}>{a.lastLogin}</td>
          <td><div className="row-act" style={{ justifyContent: "flex-end" }}>
            <button title="View performance" onClick={() => setPerf(a)}><TrendingUp size={15} /></button>
            <button title="Edit" onClick={() => { setEditing(a); setModal(true); }}><Pencil size={15} /></button>
            <button title="Reset password" onClick={() => push({ type: "success", title: "Password reset link sent", desc: `Emailed to ${a.email}.` })}><KeyRound size={15} /></button>
            <button className="danger" title="Remove" onClick={() => setConfirm(a)}><Trash2 size={15} /></button>
          </div></td>
        </tr>))}</tbody>
      </table></div>
      <AgentModal open={modal} initial={editing} onClose={() => { setModal(false); setEditing(null); }} onSave={save} />
      <PerfModal agent={perf} onClose={() => setPerf(null)} />
      <ConfirmDialog open={!!confirm} danger title="Remove agent" message={confirm ? `Remove ${confirm.name} from the team? Their open tickets will move to the Support Queue.` : ""} confirmLabel="Remove"
        onConfirm={() => { setAgents((as) => as.filter((x) => x.id !== confirm.id)); push({ type: "success", title: "Agent removed", desc: confirm.name }); }} onClose={() => setConfirm(null)} />
    </SecCard>
  );
}

/* ---- 3. roles ---- */
function RolesSettings() {
  const push = useToast();
  const base = { "Super Admin": SET_PERMS, "Admin": SET_PERMS.filter((p) => p !== "Settings"), "Team Lead": ["Dashboard", "Tickets", "Customers", "Reports", "Assign Tickets", "Close Tickets", "Merge Tickets", "Bulk Update"], "Agent": ["Dashboard", "Tickets", "Customers", "Close Tickets"] };
  const [roles, setRoles] = useState(Object.fromEntries(Object.entries(base).map(([k, v]) => [k, new Set(v)])));
  const [nr, setNr] = useState("");
  const toggle = (r, p) => setRoles((rs) => { const c = new Set(rs[r]); c.has(p) ? c.delete(p) : c.add(p); return { ...rs, [r]: c }; });
  const names = Object.keys(roles);
  return (
    <SecCard title="Roles & Permissions" sub="Control what each role can see and do.">
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input placeholder="New custom role name..." value={nr} onChange={(e) => setNr(e.target.value)} style={{ maxWidth: 240 }} />
        <button className="btn btn-soft btn-sm" disabled={!nr.trim()} onClick={() => { setRoles((rs) => ({ ...rs, [nr.trim()]: new Set(["Dashboard", "Tickets"]) })); push({ type: "success", title: "Role created", desc: nr.trim() }); setNr(""); }}><PlusCircle size={14} /> Create Role</button>
      </div>
      <div className="table-wrap"><table className="perm-table" style={{ minWidth: 720 }}>
        <thead><tr><th>Permission</th>{names.map((r) => <th key={r}>{r}</th>)}</tr></thead>
        <tbody>{SET_PERMS.map((p) => (<tr key={p}>
          <td style={{ fontSize: 12.5, fontWeight: 600 }}>{p}</td>
          {names.map((r) => (<td key={r}><button className={`cbx ${roles[r].has(p) ? "on" : ""}`} style={{ margin: "0 auto" }} disabled={r === "Super Admin"} onClick={() => toggle(r, p)}>{roles[r].has(p) ? <Check size={11} /> : null}</button></td>))}
        </tr>))}</tbody>
      </table></div>
      <div className="savebar"><button className="btn btn-primary btn-sm" onClick={() => push({ type: "success", title: "Permissions saved", desc: `${names.length} roles updated.` })}><Save size={14} /> Save Permissions</button></div>
    </SecCard>
  );
}

/* ---- 4. ticket ---- */
function TicketSettings() {
  const s = useSet({ status: "New", prio: "Low", type: "Question", auto: true, slaResp: "30 minutes", slaRes: "4 hours", agent: "Support Queue (Unassigned)", fmt: "#336XXX", size: "10 MB", files: "png, jpg, pdf, docx, xlsx" }, "Ticket settings");
  return (
    <SecCard title="Ticket Settings" sub="Defaults applied to every new ticket.">
      <div className="set-grid2">
        <SetField label="Default Status"><select value={s.v.status} onChange={(e) => s.set("status", e.target.value)}>{["New", "Open", "Pending"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Default Priority"><select value={s.v.prio} onChange={(e) => s.set("prio", e.target.value)}>{BULK_PRIORITY.map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Default Ticket Type"><select value={s.v.type} onChange={(e) => s.set("type", e.target.value)}>{TICKET_TYPES.map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Default Agent"><select value={s.v.agent} onChange={(e) => s.set("agent", e.target.value)}>{BULK_AGENTS.map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="SLA - First Response"><select value={s.v.slaResp} onChange={(e) => s.set("slaResp", e.target.value)}>{["15 minutes", "30 minutes", "1 hour", "4 hours", "1 day"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="SLA - Resolution"><select value={s.v.slaRes} onChange={(e) => s.set("slaRes", e.target.value)}>{["4 hours", "8 hours", "1 day", "2 days", "1 week"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Ticket Number Format"><input value={s.v.fmt} onChange={(e) => s.set("fmt", e.target.value)} /></SetField>
        <SetField label="Attachment Size Limit"><select value={s.v.size} onChange={(e) => s.set("size", e.target.value)}>{["5 MB", "10 MB", "25 MB", "50 MB"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
      </div>
      <SetField label="Allowed File Types"><input value={s.v.files} onChange={(e) => s.set("files", e.target.value)} /></SetField>
      <ToggleRow icon={Zap} title="Auto-assign tickets" desc="Distribute new tickets round-robin across active agents." on={s.v.auto} onChange={(v) => s.set("auto", v)} />
      <SaveBar s={s} />
    </SecCard>
  );
}

/* ---- 5. email ---- */
/* ---- signature settings (inside Email Settings) ---- */
function SignatureSettings() {
  const push = useToast();
  const [st, setSt] = useState(getSigSettings);
  const me = currentAgentProfile();
  const meKey = (me.email || "").toLowerCase();
  const [team, setTeam] = useState("My signature");
  const taRef = useRef(null);
  const saveTimer = useRef(null);
  const tpl = team === "My signature" ? ((st.users || {})[meKey] ?? st.template)
    : team === "Default" ? st.template
    : (st.teams[team] ?? st.template);

  const update = (next) => {
    setSt(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveSigSettings(next), 500); // auto-save
  };
  const setTpl = (value) => {
    if (team === "My signature") update({ ...st, users: { ...(st.users || {}), [meKey]: value } });
    else if (team === "Default") update({ ...st, template: value });
    else update({ ...st, teams: { ...st.teams, [team]: value } });
  };
  const insertPh = (ph) => {
    const ta = taRef.current;
    if (!ta) { setTpl(tpl + ph); return; }
    const a = ta.selectionStart ?? tpl.length, b = ta.selectionEnd ?? tpl.length;
    const next = tpl.slice(0, a) + ph + tpl.slice(b);
    setTpl(next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(a + ph.length, a + ph.length); }, 0);
  };
  const explicitSave = () => { saveSigSettings(st); push({ type: "success", title: "Signature saved", desc: "New replies will use the updated signature." }); };
  const preview = resolveSignature({ ...st, template: tpl, enabled: true });

  return (
    <div style={{ marginTop: 6 }}>
      <div className="section-head" style={{ marginBottom: 10 }}>
        <div><h3 className="card-title"><Pencil size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--primary)" }} />Signature Settings</h3>
        <p className="card-sub">Auto-inserted at the bottom of every reply, with the cursor placed above it — Freshdesk style.</p></div>
      </div>
      <ToggleRow icon={CheckCircle2} title="Automatic signature" desc="Insert the signature whenever the Reply editor opens." on={st.enabled} onChange={(v) => update({ ...st, enabled: v })} />
      <ToggleRow icon={Forward} title="Also apply to Forward" desc="Include the signature when forwarding tickets. Internal notes never get a signature." on={st.applyForward} onChange={(v) => update({ ...st, applyForward: v })} />
      <div className="sig-scope">
        <div className="fld" style={{ flex: 1, minWidth: 220 }}>
          <label>Signature for</label>
          <select value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="My signature">My signature{(st.users || {})[meKey] !== undefined ? " ●" : ""}</option>
            <option>Default</option>
            {SET_TEAMS.map((t) => <option key={t}>{t}{st.teams[t] !== undefined ? " ●" : ""}</option>)}
          </select>
        </div>
        <div className="sig-scope-meta">
          {team === "My signature" && <span className="who"><User size={12} /> {me.name} · {me.email || "not signed in"}</span>}
          {team === "My signature" && (st.users || {})[meKey] !== undefined && (
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => { const users = { ...(st.users || {}) }; delete users[meKey]; update({ ...st, users }); push({ type: "info", title: "Your signature now follows the company default" }); }}>
              <RotateCcw size={13} /> Use company default
            </button>
          )}
          {team !== "Default" && team !== "My signature" && st.teams[team] !== undefined && (
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => { const teams = { ...st.teams }; delete teams[team]; update({ ...st, teams }); push({ type: "info", title: `${team} now uses the default signature` }); }}>
              <RotateCcw size={13} /> Revert to default
            </button>
          )}
        </div>
      </div>
      <div className="sig-grid">
        <div className="fld">
          <label>Template{team !== "Default" ? ` — ${team}` : ""}</label>
          <textarea ref={taRef} className="sig-editor" value={tpl} onChange={(e) => setTpl(e.target.value)} />
          <div className="chips" style={{ marginTop: 10 }}>
            {SIG_PLACEHOLDERS.map((p) => <button key={p} className="fchip" onClick={() => insertPh(p)}><Plus size={11} /> {p}</button>)}
          </div>
        </div>
        <div className="fld">
          <label>Live preview — {me.name}</label>
          <div className="sig-preview">{preview || <span style={{ color: "var(--faint)" }}>Signature disabled.</span>}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <span style={{ fontSize: 11.5, color: "var(--faint)", alignSelf: "center", fontWeight: 600 }}>Changes auto-save</span>
        <button className="btn btn-primary btn-sm" onClick={explicitSave}><Save size={13} /> Save Signature</button>
      </div>
    </div>
  );
}

function EmailSettings() {
  const push = useToast();
  const s = useSet({ host: "smtp.netcorecloud.net", port: "587", sender: "contact@internshipstudio.com", name: "IS Support", inMail: "imap.internshipstudio.com", outMail: "smtp.internshipstudio.com", sig: "Warm regards,\nIS Support Team\nInternship Studio", autoReply: true, fwd: false, notif: true }, "Email settings");
  const [testing, setTesting] = useState(false);
  return (
    <SecCard title="Email Settings" sub="Outgoing mail, servers and behaviour." right={
      <button className="btn btn-soft btn-sm" disabled={testing} onClick={() => { setTesting(true); setTimeout(() => { setTesting(false); push({ type: "success", title: "Test email sent", desc: `Delivered to ${s.v.sender}.` }); }, 900); }}>{testing ? <><Spinner /> Sending...</> : <><Send size={14} /> Send Test Email</>}</button>}>
      <div className="set-grid2">
        <SetField label="SMTP Host"><input value={s.v.host} onChange={(e) => s.set("host", e.target.value)} /></SetField>
        <SetField label="SMTP Port"><input value={s.v.port} onChange={(e) => s.set("port", e.target.value)} /></SetField>
        <SetField label="Sender Email"><input value={s.v.sender} onChange={(e) => s.set("sender", e.target.value)} /></SetField>
        <SetField label="Sender Name"><input value={s.v.name} onChange={(e) => s.set("name", e.target.value)} /></SetField>
        <SetField label="Incoming Mail Server"><input value={s.v.inMail} onChange={(e) => s.set("inMail", e.target.value)} /></SetField>
        <SetField label="Outgoing Mail Server"><input value={s.v.outMail} onChange={(e) => s.set("outMail", e.target.value)} /></SetField>
      </div>
      <SignatureSettings />
      <ToggleRow icon={Reply} title="Auto Reply" desc="Send an acknowledgement when a ticket is created." on={s.v.autoReply} onChange={(v) => s.set("autoReply", v)} />
      <ToggleRow icon={Forward} title="Email Forwarding" desc="Forward matching tickets to department inboxes." on={s.v.fwd} onChange={(v) => s.set("fwd", v)} />
      <ToggleRow icon={BellRing} title="Email Notifications" desc="Notify agents about ticket events by email." on={s.v.notif} onChange={(v) => s.set("notif", v)} />
      <SaveBar s={s} />
    </SecCard>
  );
}

/* ---- 6. notifications ---- */
function NotifSettings() {
  const push = useToast();
  const EVENTS = ["New Ticket", "Customer Reply", "Ticket Closed", "SLA Breach", "Agent Assignment", "Ticket Escalation", "Email Failure", "Automation Trigger"];
  const CHANNELS = ["Email", "In-App", "Desktop"];
  const [m, setM] = useState(() => Object.fromEntries(EVENTS.map((e, i) => [e, { Email: true, "In-App": true, Desktop: i < 4 }])));
  return (
    <SecCard title="Notification Settings" sub="Choose which events reach you, and where.">
      <div className="table-wrap"><table className="perm-table" style={{ minWidth: 540 }}>
        <thead><tr><th>Event</th>{CHANNELS.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{EVENTS.map((e) => (<tr key={e}>
          <td style={{ fontSize: 12.5, fontWeight: 600 }}>{e}</td>
          {CHANNELS.map((c) => (<td key={c}><div style={{ display: "flex", justifyContent: "center" }}><Switch on={m[e][c]} onChange={(v) => setM((x) => ({ ...x, [e]: { ...x[e], [c]: v } }))} /></div></td>))}
        </tr>))}</tbody>
      </table></div>
      <div className="savebar"><button className="btn btn-primary btn-sm" onClick={() => push({ type: "success", title: "Notification settings saved" })}><Save size={14} /> Save</button></div>
    </SecCard>
  );
}

/* ---- 7. theme ---- */
function ThemeSettings({ themeApi }) {
  const push = useToast();
  const { theme, setTheme, resetTheme, dark } = themeApi;
  const current = theme || (dark ? THEME_DARK : THEME_DEFAULT);
  const fileRef = useRef(null);
  const activePreset = PRESETS.find((p) => JSON.stringify(p.t) === JSON.stringify(current));
  return (
    <SecCard title="Theme & Appearance" sub="Colors apply live across the whole app.">
      <div className="tm-sec">Preset Themes</div>
      <div className="preset-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", marginBottom: 14 }}>
        {PRESETS.map((p) => (<button key={p.name} className={`preset ${activePreset?.name === p.name ? "on" : ""}`} onClick={() => setTheme({ ...p.t })}>
          <span className="sw"><i style={{ background: p.t.primary }} /><i style={{ background: p.t.accent }} /><i style={{ background: p.t.success }} /></span>{p.name}</button>))}
      </div>
      <div className="tm-sec">Live Preview</div>
      <ThemePreview />
      <div className="tm-sec" style={{ marginTop: 12 }}>Colors</div>
      <div>{THEME_FIELDS.map((f) => <ThemeSwatch key={f.key} field={f} value={current[f.key]} onChange={(v) => setTheme({ ...current, [f.key]: v })} />)}</div>
      <div className="savebar">
        <button className="btn btn-ghost btn-sm" onClick={() => { resetTheme(); push({ type: "info", title: "Theme reset" }); }}><RefreshCw size={14} /> Reset</button>
        <button className="btn btn-soft btn-sm" onClick={() => { downloadBlob(JSON.stringify(current, null, 2), "helphive-theme.json", "application/json"); push({ type: "success", title: "Theme exported" }); }}><Download size={14} /> Export</button>
        <button className="btn btn-soft btn-sm" onClick={() => fileRef.current?.click()}><Upload size={14} /> Import</button>
        <input ref={fileRef} type="file" accept=".json" hidden onChange={(e) => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = (ev) => { try { setTheme({ ...THEME_DEFAULT, ...JSON.parse(ev.target.result) }); push({ type: "success", title: "Theme imported" }); } catch { push({ type: "error", title: "Invalid theme file" }); } }; r.readAsText(file); }} />
        <button className="btn btn-primary btn-sm" onClick={() => { try { localStorage.setItem("helphive-theme", JSON.stringify(current)); push({ type: "success", title: "Theme saved", desc: "Loads automatically next time." }); } catch { push({ type: "error", title: "Couldn't save", desc: "Storage unavailable in this preview." }); } }}><Save size={14} /> Save Theme</button>
      </div>
    </SecCard>
  );
}

/* ---- 8. automation ---- */
function AutomationSettingsPanel({ go }) {
  const push = useToast();
  const [t, setT] = useState({ rules: true, canned: true, emailAuto: false, tagged: true });
  const [prio, setPrio] = useState("Run in listed order");
  const rows = [
    ["rules", Zap, "Automation Rules", "Run trigger-based rules on tickets."],
    ["canned", MessageSquareText, "Canned Responses", "Allow /shortcut insertion in replies."],
    ["emailAuto", Mail, "Email Automation", "Automated follow-ups and sequences."],
    ["tagged", BellRing, "Tagged Notifications", "Alert teams when watched tags are added."],
  ];
  return (
    <SecCard title="Automation Settings" sub="Enable or disable automation modules." right={<button className="btn btn-soft btn-sm" onClick={() => go("automation")}><Zap size={14} /> Open Automation Center</button>}>
      {rows.map(([k, Ic, ti, d]) => <ToggleRow key={k} icon={Ic} title={ti} desc={d} on={t[k]} onChange={(v) => { setT((x) => ({ ...x, [k]: v })); push({ type: "info", title: `${ti} ${v ? "enabled" : "disabled"}` }); }} />)}
      <SetField label="Rule Priority"><select value={prio} onChange={(e) => setPrio(e.target.value)}>{["Run in listed order", "Highest priority first", "Newest rules first"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
      <div className="savebar"><button className="btn btn-primary btn-sm" onClick={() => push({ type: "success", title: "Automation settings saved" })}><Save size={14} /> Save</button></div>
    </SecCard>
  );
}

/* ---- 9. customer ---- */
function CustomerSettingsPanel() {
  const push = useToast();
  const [t, setT] = useState({ reg: true, guest: true, portal: true, verify: true, vis: false, edit: true });
  const rows = [
    ["reg", UserPlus, "Customer Registration", "Allow new customers to create accounts."],
    ["guest", Ticket, "Allow Guest Tickets", "Accept tickets without an account."],
    ["portal", Globe, "Customer Portal Access", "Customers can log in to track tickets."],
    ["verify", BadgeCheck, "Email Verification", "Require verified email before portal access."],
    ["vis", Eye, "Ticket Visibility", "Customers can see other tickets from their college."],
    ["edit", Pencil, "Profile Editing", "Customers can edit their own profile details."],
  ];
  return (
    <SecCard title="Customer Settings" sub="What customers can do on the portal.">
      {rows.map(([k, Ic, ti, d]) => <ToggleRow key={k} icon={Ic} title={ti} desc={d} on={t[k]} onChange={(v) => setT((x) => ({ ...x, [k]: v }))} />)}
      <div className="savebar"><button className="btn btn-primary btn-sm" onClick={() => push({ type: "success", title: "Customer settings saved" })}><Save size={14} /> Save</button></div>
    </SecCard>
  );
}

/* ---- 10. kb ---- */
function KbSettings() {
  const s = useSet({ url: "https://help.internshipstudio.com", cats: "Getting Started, Internships, Certificates, Billing, Technical", vis: "Public", approval: true, index: true }, "Knowledge base settings");
  return (
    <SecCard title="Knowledge Base Settings" sub="Self-service help centre configuration.">
      <SetField label="Knowledge Base URL"><input value={s.v.url} onChange={(e) => s.set("url", e.target.value)} /></SetField>
      <SetField label="Categories (comma separated)"><input value={s.v.cats} onChange={(e) => s.set("cats", e.target.value)} /></SetField>
      <SetField label="Default Article Visibility"><select value={s.v.vis} onChange={(e) => s.set("vis", e.target.value)}>{["Public", "Private", "Logged-in customers only"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
      <ToggleRow icon={CheckCheck} title="Article Approval Workflow" desc="Drafts need approval before publishing." on={s.v.approval} onChange={(v) => s.set("approval", v)} />
      <ToggleRow icon={Search} title="Search Index" desc="Include articles in global search." on={s.v.index} onChange={(v) => s.set("index", v)} />
      <SaveBar s={s} />
    </SecCard>
  );
}

/* ---- 11. security ---- */
function SecuritySettings() {
  const push = useToast();
  const [pw, setPw] = useState({ cur: "", nw: "", cf: "" });
  const [tfa, setTfa] = useState(true);
  const [timeout_, setTimeout_] = useState("30 minutes");
  const [ips, setIps] = useState(["103.86.68.0/24", "49.248.112.10"]);
  const [ip, setIp] = useState("");
  const [pol, setPol] = useState({ len: true, num: true, sym: false });
  const [lock, setLock] = useState("5 failed attempts");
  const [sessions, setSessions] = useState([
    { id: 1, dev: "Chrome, Windows 11", ic: Monitor, loc: "Pune, IN", when: "Active now", me: true },
    { id: 2, dev: "HelpHive Mobile, Android", ic: Smartphone, loc: "Pune, IN", when: "2 hr ago", me: false },
    { id: 3, dev: "Safari, MacBook", ic: Monitor, loc: "Mumbai, IN", when: "yesterday", me: false },
  ]);
  const hist = [["Today, 9:02 am", "Pune, IN", "Success"], ["Yesterday, 8:47 pm", "Pune, IN", "Success"], ["Yesterday, 11:15 am", "Unknown (VPN)", "Blocked"], ["16 Jul, 10:04 am", "Mumbai, IN", "Success"]];
  const changePw = () => {
    if (!pw.cur || !pw.nw || pw.nw !== pw.cf) { push({ type: "error", title: "Check the password fields", desc: "New passwords must match." }); return; }
    setPw({ cur: "", nw: "", cf: "" }); push({ type: "success", title: "Password changed", desc: "Use the new password next login." });
  };
  return (
    <div className="set-sec">
      <SecCard title="Change Password">
        <div className="set-grid2">
          <SetField label="Current Password"><input type="password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} /></SetField>
          <div />
          <SetField label="New Password"><input type="password" value={pw.nw} onChange={(e) => setPw({ ...pw, nw: e.target.value })} /></SetField>
          <SetField label="Confirm New Password"><input type="password" value={pw.cf} onChange={(e) => setPw({ ...pw, cf: e.target.value })} /></SetField>
        </div>
        <div className="savebar"><button className="btn btn-primary btn-sm" onClick={changePw}><Key size={14} /> Update Password</button></div>
      </SecCard>
      <SecCard title="Access & Sessions">
        <ToggleRow icon={ShieldCheck} title="Two-Factor Authentication" desc="OTP required at every login." on={tfa} onChange={(v) => { setTfa(v); push({ type: v ? "success" : "warning", title: `Two-factor ${v ? "enabled" : "disabled"}` }); }} />
        <div className="set-row"><span className="pic" style={{ background: "var(--primary-soft)", color: "var(--primary)", width: 34, height: 34 }}><Clock3 size={16} /></span>
          <div style={{ flex: 1 }}><div className="ti">Session Timeout</div><div className="td">Auto-logout after inactivity.</div></div>
          <select style={{ width: 150 }} value={timeout_} onChange={(e) => setTimeout_(e.target.value)}>{["15 minutes", "30 minutes", "1 hour", "4 hours"].map((o) => <option key={o}>{o}</option>)}</select>
        </div>
        <div className="set-row"><span className="pic" style={{ background: "var(--primary-soft)", color: "var(--primary)", width: 34, height: 34 }}><Ban size={16} /></span>
          <div style={{ flex: 1 }}><div className="ti">Account Lockout</div><div className="td">Lock the account after repeated failures.</div></div>
          <select style={{ width: 170 }} value={lock} onChange={(e) => setLock(e.target.value)}>{["3 failed attempts", "5 failed attempts", "10 failed attempts"].map((o) => <option key={o}>{o}</option>)}</select>
        </div>
        <div style={{ margin: "12px 0 6px", fontSize: 12, fontWeight: 700 }}>Password Policy</div>
        {[["len", "Minimum 10 characters"], ["num", "Require a number"], ["sym", "Require a symbol"]].map(([k, l]) => (
          <div key={k} className="set-row" style={{ padding: "8px 0" }}><div style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{l}</div><Switch on={pol[k]} onChange={(v) => setPol((x) => ({ ...x, [k]: v }))} /></div>))}
        <div style={{ margin: "12px 0 6px", fontSize: 12, fontWeight: 700 }}>Active Sessions</div>
        {sessions.map((x) => (
          <div key={x.id} className="set-row"><span className="pic" style={{ background: "var(--surface-2)", width: 34, height: 34 }}><x.ic size={16} /></span>
            <div style={{ flex: 1 }}><div className="ti">{x.dev} {x.me && <span className="count-badge" style={{ fontSize: 10, padding: "1px 7px", marginLeft: 6 }}>This device</span>}</div><div className="td">{x.loc} - {x.when}</div></div>
            {!x.me && <button className="btn btn-ghost btn-sm" onClick={() => { setSessions((ss) => ss.filter((y) => y.id !== x.id)); push({ type: "success", title: "Session ended", desc: x.dev }); }}><LogOut size={13} /> End</button>}
          </div>))}
        <div style={{ margin: "12px 0 6px", fontSize: 12, fontWeight: 700 }}>IP Whitelist</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input placeholder="Add IP or CIDR..." value={ip} onChange={(e) => setIp(e.target.value)} style={{ maxWidth: 220 }} />
          <button className="btn btn-soft btn-sm" disabled={!ip.trim()} onClick={() => { setIps((xs) => [...xs, ip.trim()]); setIp(""); push({ type: "success", title: "IP whitelisted" }); }}><PlusCircle size={14} /> Add</button>
        </div>
        <div className="chips">{ips.map((x) => <span key={x} className="fchip" style={{ cursor: "default" }}>{x}<button style={{ marginLeft: 6, border: 0, background: "none", cursor: "pointer", color: "inherit" }} onClick={() => setIps((xs) => xs.filter((y) => y !== x))}><X size={11} /></button></span>)}</div>
        <div style={{ margin: "14px 0 6px", fontSize: 12, fontWeight: 700 }}>Login History</div>
        <div className="table-wrap"><table style={{ minWidth: 420 }}><thead><tr><th>When</th><th>Location</th><th>Status</th></tr></thead>
          <tbody>{hist.map(([w, l, st], i) => (<tr key={i}><td style={{ fontSize: 12.5 }}>{w}</td><td style={{ fontSize: 12.5, color: "var(--muted)" }}>{l}</td><td><span className="badge-pill" style={{ background: st === "Success" ? "var(--success-soft)" : "var(--danger-soft)", color: st === "Success" ? "var(--success)" : "var(--danger)" }}>{st}</span></td></tr>))}</tbody></table></div>
      </SecCard>
    </div>
  );
}

/* ---- 12. backup ---- */
function BackupSettings() {
  const push = useToast();
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [hist, setHist] = useState([
    { id: 1, name: "backup-2026-07-17.json", size: "4.2 MB", when: "Today, 2:00 am", type: "Automatic" },
    { id: 2, name: "backup-2026-07-16.json", size: "4.1 MB", when: "Yesterday, 2:00 am", type: "Automatic" },
    { id: 3, name: "backup-2026-07-14.json", size: "4.0 MB", when: "14 Jul, 6:12 pm", type: "Manual" },
  ]);
  const create = () => { setBusy(true); setTimeout(() => { setBusy(false); setHist((h) => [{ id: Date.now(), name: `backup-manual-${Date.now()}.json`, size: "4.3 MB", when: "just now", type: "Manual" }, ...h]); push({ type: "success", title: "Backup created", desc: "Snapshot saved to backup history." }); }, 1000); };
  const download = (b) => { downloadBlob(JSON.stringify({ backup: b.name, tickets: 17, customers: 17, rules: 4, exportedAt: new Date().toISOString() }, null, 2), b.name, "application/json"); push({ type: "success", title: "Backup downloaded", desc: b.name }); };
  return (
    <SecCard title="Backup & Restore" sub="Snapshots of tickets, customers, automations and settings." right={
      <button className="btn btn-primary btn-sm" disabled={busy} onClick={create}>{busy ? <><Spinner /> Backing up...</> : <><HardDrive size={14} /> Create Backup</>}</button>}>
      <ToggleRow icon={History} title="Automatic Daily Backup" desc="Runs every day at 2:00 am IST." on={auto} onChange={(v) => { setAuto(v); push({ type: "info", title: `Daily backup ${v ? "enabled" : "disabled"}` }); }} />
      <div style={{ margin: "12px 0 6px", fontSize: 12, fontWeight: 700 }}>Backup History</div>
      <div className="table-wrap"><table style={{ minWidth: 560 }}>
        <thead><tr><th>Backup</th><th>Size</th><th>Created</th><th>Type</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
        <tbody>{hist.map((b) => (<tr key={b.id}>
          <td style={{ fontWeight: 600, fontSize: 12.5 }}>{b.name}</td><td style={{ fontSize: 12.5 }}>{b.size}</td>
          <td style={{ fontSize: 12.5, color: "var(--muted)" }}>{b.when}</td><td><span className="fchip" style={{ cursor: "default" }}>{b.type}</span></td>
          <td><div className="row-act" style={{ justifyContent: "flex-end" }}>
            <button title="Download" onClick={() => download(b)}><Download size={15} /></button>
            <button title="Restore" onClick={() => setConfirm(b)}><RotateCcw size={15} /></button>
          </div></td>
        </tr>))}</tbody>
      </table></div>
      <ConfirmDialog open={!!confirm} title="Restore backup" message={confirm ? `Restore ${confirm.name}? Current data will be replaced with this snapshot.` : ""} confirmLabel="Restore"
        onConfirm={() => push({ type: "success", title: "Backup restored", desc: confirm.name })} onClose={() => setConfirm(null)} />
    </SecCard>
  );
}

/* ---- 13. audit ---- */
function AuditSettings() {
  const push = useToast();
  const LOGS = [
    ["Admin", "Changed theme to Ocean Blue", "Settings", "Today, 11:40 am", "103.86.68.14", "Success"],
    ["Priya Nair", "Closed ticket #336196", "Tickets", "Today, 11:12 am", "103.86.68.21", "Success"],
    ["Admin", "Created automation 'Urgent tag alert'", "Automation", "Today, 10:05 am", "103.86.68.14", "Success"],
    ["Rahul Sethi", "Exported 17 tickets (xlsx)", "Tickets", "Yesterday, 6:44 pm", "49.248.112.10", "Success"],
    ["Unknown", "Failed login attempt", "Security", "Yesterday, 11:15 am", "185.220.101.4", "Failed"],
    ["Admin", "Added agent Pooja Sharma", "Teams", "16 Jul, 3:20 pm", "103.86.68.14", "Success"],
    ["Aisha Khan", "Merged #336122 into #336159", "Tickets", "16 Jul, 12:02 pm", "103.86.68.29", "Success"],
  ].map((r, i) => ({ id: i, user: r[0], action: r[1], module: r[2], when: r[3], ip: r[4], status: r[5] }));
  const [q, setQ] = useState("");
  const [mod, setMod] = useState("All");
  const mods = ["All", ...Array.from(new Set(LOGS.map((l) => l.module)))];
  const rows = LOGS.filter((l) => (mod === "All" || l.module === mod) && (l.user + l.action + l.ip).toLowerCase().includes(q.toLowerCase()));
  return (
    <SecCard title="Audit Logs" sub="Every administrative action, recorded." right={
      <button className="btn btn-soft btn-sm" onClick={() => { exportCSV(rows.map((l) => ({ User: l.user, Action: l.action, Module: l.module, "Date & Time": l.when, "IP Address": l.ip, Status: l.status })), "audit-logs.csv"); push({ type: "success", title: "Audit logs exported" }); }}><Download size={14} /> Export CSV</button>}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <div className="searchbox" style={{ maxWidth: 240, width: 240, flex: "initial" }}><Search size={16} /><input placeholder="Search user, action, IP..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="chips">{mods.map((m) => <button key={m} className={`fchip ${mod === m ? "on" : ""}`} onClick={() => setMod(m)}>{m}</button>)}</div>
      </div>
      {rows.length ? (
        <div className="table-wrap"><table style={{ minWidth: 760 }}>
          <thead><tr><th>User</th><th>Action</th><th>Module</th><th>Date &amp; Time</th><th>IP Address</th><th>Status</th></tr></thead>
          <tbody>{rows.map((l) => (<tr key={l.id}>
            <td style={{ fontWeight: 600, fontSize: 12.5 }}>{l.user}</td><td style={{ fontSize: 12.5 }}>{l.action}</td>
            <td style={{ fontSize: 12.5, color: "var(--muted)" }}>{l.module}</td><td style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{l.when}</td>
            <td style={{ fontSize: 12, fontFamily: "ui-monospace,monospace" }}>{l.ip}</td>
            <td><span className="badge-pill" style={{ background: l.status === "Success" ? "var(--success-soft)" : "var(--danger-soft)", color: l.status === "Success" ? "var(--success)" : "var(--danger)" }}>{l.status}</span></td>
          </tr>))}</tbody>
        </table></div>
      ) : <EmptyState icon={ScrollText} title="No matching logs" desc="Try a different search or module filter." />}
    </SecCard>
  );
}

/* ---- 14. api ---- */
function ApiSettings() {
  const push = useToast();
  const [keys, setKeys] = useState([{ id: 1, name: "Production", key: "hh_live_9f2a...c8e1", created: "02 Jul 2026", active: true }]);
  const [hooks, setHooks] = useState(["https://api.internshipstudio.com/webhooks/tickets"]);
  const [hook, setHook] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [ints, setInts] = useState({ slack: true, teams: false, gws: true, outlook: false, wa: true });
  const gen = () => { const k = "hh_live_" + Math.random().toString(36).slice(2, 6) + "..." + Math.random().toString(36).slice(2, 6); setKeys((ks) => [{ id: Date.now(), name: `Key ${ks.length + 1}`, key: k, created: "just now", active: true }, ...ks]); push({ type: "success", title: "API key generated", desc: "Copy it now - it won't be shown again." }); };
  const INTS = [["slack", MessageSquare, "Slack", "Ticket alerts in your Slack channels."], ["teams", Users, "Microsoft Teams", "Notifications in Teams channels."], ["gws", Globe, "Google Workspace", "SSO and calendar sync."], ["outlook", Mail, "Outlook", "Two-way email sync."], ["wa", MessageCircle, "WhatsApp API", "Support conversations over WhatsApp."]];
  return (
    <div className="set-sec">
      <SecCard title="API Keys" sub="Authenticate external apps against the HelpHive API." right={<button className="btn btn-primary btn-sm" onClick={gen}><Key size={14} /> Generate Key</button>}>
        <div className="table-wrap"><table style={{ minWidth: 560 }}>
          <thead><tr><th>Name</th><th>Key</th><th>Created</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
          <tbody>{keys.map((k) => (<tr key={k.id}>
            <td style={{ fontWeight: 600, fontSize: 12.5 }}>{k.name}</td>
            <td><span className="keychip">{k.key}</span></td>
            <td style={{ fontSize: 12.5, color: "var(--muted)" }}>{k.created}</td>
            <td><StatusChip active={k.active} /></td>
            <td><div className="row-act" style={{ justifyContent: "flex-end" }}>
              <button title="Copy" onClick={() => { try { navigator.clipboard.writeText(k.key); } catch {} push({ type: "success", title: "Key copied" }); }}><Copy size={15} /></button>
              <button className="danger" title="Revoke" onClick={() => setConfirm(k)}><Ban size={15} /></button>
            </div></td>
          </tr>))}</tbody>
        </table></div>
      </SecCard>
      <SecCard title="Webhooks" sub="POST ticket events to your endpoints.">
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input placeholder="https://your-endpoint.com/webhook" value={hook} onChange={(e) => setHook(e.target.value)} />
          <button className="btn btn-soft btn-sm" disabled={!hook.trim()} onClick={() => { setHooks((hs) => [...hs, hook.trim()]); setHook(""); push({ type: "success", title: "Webhook added" }); }}><PlusCircle size={14} /> Add</button>
        </div>
        {hooks.map((h) => (<div key={h} className="set-row"><span className="pic" style={{ background: "var(--primary-soft)", color: "var(--primary)", width: 34, height: 34 }}><Webhook size={16} /></span>
          <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, wordBreak: "break-all" }}>{h}</div>
          <button className="btn btn-ghost btn-sm" onClick={() => { setHooks((hs) => hs.filter((x) => x !== h)); push({ type: "info", title: "Webhook removed" }); }}><Trash2 size={13} /></button>
        </div>))}
      </SecCard>
      <SecCard title="Integrations">
        {INTS.map(([k, Ic, ti, d]) => <ToggleRow key={k} icon={Ic} title={ti} desc={d} on={ints[k]} onChange={(v) => { setInts((x) => ({ ...x, [k]: v })); push({ type: v ? "success" : "info", title: `${ti} ${v ? "connected" : "disconnected"}` }); }} />)}
      </SecCard>
      <ConfirmDialog open={!!confirm} danger title="Revoke API key" message={confirm ? `Revoke '${confirm.name}'? Apps using it will stop working immediately.` : ""} confirmLabel="Revoke"
        onConfirm={() => { setKeys((ks) => ks.filter((x) => x.id !== confirm.id)); push({ type: "success", title: "API key revoked" }); }} onClose={() => setConfirm(null)} />
    </div>
  );
}

/* ---- 15. reports ---- */
function ReportsSettings() {
  const s = useSet({ freq: "Weekly", day: "Monday", fmt: "Excel (.xlsx)", to: "founder@internshipstudio.com, ops@internshipstudio.com", scheduled: true }, "Report settings");
  return (
    <SecCard title="Reports Settings" sub="Scheduled report delivery.">
      <div className="set-grid2">
        <SetField label="Report Frequency"><select value={s.v.freq} onChange={(e) => s.set("freq", e.target.value)}>{["Daily", "Weekly", "Monthly"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Send On"><select value={s.v.day} onChange={(e) => s.set("day", e.target.value)}>{["Monday", "Friday", "1st of month"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
        <SetField label="Export Format"><select value={s.v.fmt} onChange={(e) => s.set("fmt", e.target.value)}>{["Excel (.xlsx)", "CSV", "PDF"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
      </div>
      <SetField label="Email Recipients"><input value={s.v.to} onChange={(e) => s.set("to", e.target.value)} /></SetField>
      <ToggleRow icon={CalendarClock} title="Scheduled Reports" desc="Email the report automatically on schedule." on={s.v.scheduled} onChange={(v) => s.set("scheduled", v)} />
      <SaveBar s={s} />
    </SecCard>
  );
}

function SettingsPage({ initialSection = "general", themeApi, go, logoApi }) {
  const [sec, setSec] = useState(initialSection);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); const t = setTimeout(() => setLoading(false), 380); return () => clearTimeout(t); }, [sec]);
  const body = () => {
    switch (sec) {
      case "general": return <GeneralSettings logoApi={logoApi} />;
      case "teams": return <TeamSettings />;
      case "approvals": return <ApprovalSettings />;
      case "roles": return <RolesSettings />;
      case "ticket": return <TicketSettings />;
      case "email": return <EmailSettings />;
      case "notif": return <NotifSettings />;
      case "theme": return <ThemeSettings themeApi={themeApi} />;
      case "autom": return <AutomationSettingsPanel go={go} />;
      case "customer": return <CustomerSettingsPanel />;
      case "kb": return <KbSettings />;
      case "security": return <SecuritySettings />;
      case "backup": return <BackupSettings />;
      case "audit": return <AuditSettings />;
      case "api": return <ApiSettings />;
      default: return <ReportsSettings />;
    }
  };
  return (
    <div className="content route">
      <div className="page-head">
        <div><h1>Settings</h1><p>Configure your entire support platform from one place.</p></div>
      </div>
      <div className="set-layout">
        <div className="card set-nav">
          {SET_SECTIONS.map((x) => (<button key={x.key} className={sec === x.key ? "on" : ""} onClick={() => setSec(x.key)}><x.icon size={16} /> {x.label}</button>))}
        </div>
        <div key={sec} className="route">
          {loading ? (<div className="card sk-card" style={{ minHeight: 320 }}><div className="sk" style={{ height: 22, width: "35%" }} /><div className="sk" style={{ height: 14, width: "55%" }} /><div className="sk" style={{ flex: 1, minHeight: 200 }} /></div>) : body()}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   ADMIN PROFILE
   ========================================================================== */
const PROFILE_DEFAULT = { name: "Hemani Raina", role: "Support Lead - Student Success", emp: "EMP-1001", email: "rainahemani14@gmail.com", phone: "+91 90000 10000", joined: "15 Mar 2023", location: "Pune, Maharashtra" };

function EditProfileModal({ open, profile, onClose, onSave }) {
  const [f, setF] = useState(profile);
  const [err, setErr] = useState("");
  useEffect(() => { if (open) { setF(profile); setErr(""); } }, [open]);
  if (!open) return null;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = () => {
    if (!f.name.trim()) { setErr("Name is required."); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) { setErr("Enter a valid email address."); return; }
    if (!f.phone.trim()) { setErr("Phone is required."); return; }
    onSave({ ...f, name: f.name.trim() });
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="panel-title" style={{ fontSize: 15 }}><span className="pic" style={{ background: "var(--primary-soft)", color: "var(--primary)", width: 32, height: 32 }}><Pencil size={15} /></span>Edit Profile</div><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
        <div className="modal-body">
          {err && <div className="logo-err" style={{ marginTop: 0 }}><AlertTriangle size={13} /> {err}</div>}
          <div className="set-grid2">
            <div className="fld"><label>Full Name</label><input value={f.name} onChange={set("name")} /></div>
            <div className="fld"><label>Role / Designation</label><input value={f.role} onChange={set("role")} /></div>
            <div className="fld"><label>Employee ID</label><input value={f.emp} onChange={set("emp")} /></div>
            <div className="fld"><label>Email</label><input type="email" value={f.email} onChange={set("email")} /></div>
            <div className="fld"><label>Phone</label><input value={f.phone} onChange={set("phone")} /></div>
            <div className="fld"><label>Location</label><input value={f.location} onChange={set("location")} /></div>
            <div className="fld"><label>Joined</label><input value={f.joined} onChange={set("joined")} /></div>
          </div>
        </div>
        <div className="modal-foot"><button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" onClick={save}><Save size={14} /> Save Changes</button></div>
      </div>
    </div>
  );
}

function AdminProfilePage({ go, onSignOut }) {
  const push = useToast();
  const [confirm, setConfirm] = useState(null);
  const [profile, setProfile] = useState(() => { try { return { ...PROFILE_DEFAULT, ...JSON.parse(localStorage.getItem("hh-profile") || "{}") }; } catch { return PROFILE_DEFAULT; } });
  const [editOpen, setEditOpen] = useState(false);
  useEffect(() => {
    (async () => { try { if (window.storage) { const r = await window.storage.get("hh-profile"); if (r && r.value) setProfile({ ...PROFILE_DEFAULT, ...JSON.parse(r.value) }); } } catch (e) {} })();
  }, []);
  const saveProfile = async (p) => {
    setProfile(p); setEditOpen(false);
    const json = JSON.stringify(p);
    try { localStorage.setItem("hh-profile", json); } catch (e) {}
    try { if (window.storage) await window.storage.set("hh-profile", json); } catch (e) {}
    push({ type: "success", title: "Profile updated", desc: "Your changes have been saved." });
  };
  const [docs, setDocs] = useState([
    { id: 1, name: "Resume - Admin.pdf", size: "220 KB", icon: FileText, color: "#EF4444" },
    { id: 2, name: "Aadhaar ID Proof.pdf", size: "180 KB", icon: BadgeCheck, color: "#0EA5E9" },
    { id: 3, name: "Employment Contract.docx", size: "96 KB", icon: Briefcase, color: "#5B5CEB" },
  ]);
  const weekly = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => ({ d, tickets: [6, 9, 7, 11, 8, 4, 3][i], resolved: [5, 7, 6, 9, 7, 4, 2][i] }));
  const monthly = ["W1", "W2", "W3", "W4"].map((d, i) => ({ d, resolved: [28, 34, 31, 39][i] }));
  const trend = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"].map((d, i) => ({ d, rate: [82, 85, 88, 86, 91, 93][i] }));
  const acts = [
    [LogIn, "#0EA5E9", "Logged in from Chrome, Windows", "Today, 9:02 am"],
    [UserPlus, "#5B5CEB", "Assigned #336270 to Priya Nair", "Today, 10:15 am"],
    [CheckCheck, "#10B981", "Closed ticket #336196", "Today, 11:12 am"],
    [Pencil, "#F59E0B", "Updated priorities on 5 tickets", "Today, 11:40 am"],
    [Zap, "#8B5CF6", "Created automation 'Urgent tag alert'", "Yesterday, 4:20 pm"],
    [Settings, "#64748B", "Edited email settings", "Yesterday, 6:05 pm"],
  ];
  const kpis = [["Tickets Assigned", 46], ["Tickets Closed", 38], ["Resolution Rate", "83%"], ["Avg Response", "26m"], ["CSAT", "94%"], ["Open Tickets", 8], ["SLA Compliance", "96%"]];
  const dl = (d) => { downloadBlob(`Dummy content for ${d.name}`, d.name.replace(/ /g, "-"), "text/plain"); push({ type: "success", title: "Download started", desc: d.name }); };
  return (
    <div className="content route">
      <div className="crumb"><a onClick={() => go("home")}>Dashboard</a> <ChevronRight size={14} /> <span style={{ color: "var(--text)" }}>Admin Profile</span></div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="cprof-head">
          <span className="pav" style={{ background: "linear-gradient(135deg,var(--primary),var(--accent))" }}>{initials(profile.name)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{profile.name} <BadgeCheck size={20} color="var(--success)" /></h1>
            <div className="cprof-meta">
              <span className="m"><Briefcase size={13} /> {profile.role}</span>
              <span className="m"><Ticket size={13} /> {profile.emp}</span>
              <span className="m"><AtSign size={13} /> {profile.email}</span>
              <span className="m"><PhoneCall size={13} /> {profile.phone}</span>
            </div>
            <div className="cprof-meta">
              <span className="m"><CalendarDays size={13} /> Joined {profile.joined}</span>
              <span className="m"><MapPin size={13} /> {profile.location}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-primary btn-sm" onClick={() => setEditOpen(true)}><Pencil size={14} /> Edit Profile</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { downloadBlob(JSON.stringify({ name: "Hemani Raina", role: "Support Lead", emp: "EMP-1001", email: "rainahemani14@gmail.com", joined: "15 Mar 2023" }, null, 2), "admin-profile.json", "application/json"); push({ type: "success", title: "Profile downloaded" }); }}><FileDown size={14} /> Download</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirm({ t: "logout" })}><LogOut size={14} /> Logout</button>
          </div>
        </div>
      </div>

      <div className="prof-grid">
        <div className="set-sec">
          <SecCard title="Performance Dashboard" sub="This month at a glance.">
            <div className="an-kpis" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
              {kpis.map(([k, v]) => <div className="an-kpi" key={k}><div className="v">{v}</div><div className="l">{k}</div></div>)}
            </div>
            <div className="set-grid2" style={{ marginTop: 14 }}>
              <div><div className="tm-sec" style={{ marginBottom: 8 }}>Weekly Performance</div>
                <div style={{ height: 170 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={weekly} barSize={10}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="d" tick={{ fontSize: 10.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="tickets" fill="var(--accent)" radius={[3, 3, 0, 0]} /><Bar dataKey="resolved" fill="var(--success)" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
              <div><div className="tm-sec" style={{ marginBottom: 8 }}>Monthly Resolved</div>
                <div style={{ height: 170 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthly}><defs><linearGradient id="pm" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity=".3" /><stop offset="100%" stopColor="var(--primary)" stopOpacity="0" /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="d" tick={{ fontSize: 10.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Area dataKey="resolved" stroke="var(--primary)" strokeWidth={2.5} fill="url(#pm)" /></AreaChart></ResponsiveContainer></div></div>
            </div>
            <div className="tm-sec" style={{ margin: "10px 0 8px" }}>Ticket Resolution Trend</div>
            <div style={{ height: 150 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="d" tick={{ fontSize: 10.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><YAxis domain={[75, 100]} tick={{ fontSize: 10.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Line dataKey="rate" stroke="var(--success)" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>
          </SecCard>

          <SecCard title="Security">
            <ToggleRow icon={ShieldCheck} title="Two-Factor Authentication" desc="OTP at every login." on={true} onChange={(v) => push({ type: v ? "success" : "warning", title: `Two-factor ${v ? "enabled" : "disabled"}` })} />
            <div className="set-row"><span className="pic" style={{ background: "var(--primary-soft)", color: "var(--primary)", width: 34, height: 34 }}><Key size={16} /></span>
              <div style={{ flex: 1 }}><div className="ti">Password</div><div className="td">Last changed 34 days ago.</div></div>
              <button className="btn btn-soft btn-sm" onClick={() => go("settings")}>Change</button></div>
            <div className="set-row"><span className="pic" style={{ background: "var(--primary-soft)", color: "var(--primary)", width: 34, height: 34 }}><Monitor size={16} /></span>
              <div style={{ flex: 1 }}><div className="ti">Active Sessions</div><div className="td">3 devices signed in.</div></div>
              <button className="btn btn-soft btn-sm" onClick={() => go("settings")}>View</button></div>
            <div className="set-row"><span className="pic" style={{ background: "var(--danger-soft)", color: "var(--danger)", width: 34, height: 34 }}><LogOut size={16} /></span>
              <div style={{ flex: 1 }}><div className="ti">Logout from all devices</div><div className="td">Ends every session except this one.</div></div>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirm({ t: "all" })}>Logout All</button></div>
          </SecCard>
        </div>

        <div className="set-sec">
          <SecCard title="Activity Timeline">
            {acts.map(([Ic, c, txt, when], i) => (
              <div className="act-item" key={i} style={{ padding: "11px 0" }}>
                <span className="ai" style={{ background: `${c}18`, color: c }}><Ic size={15} /></span>
                <div style={{ minWidth: 0 }}><div className="at">{txt}</div><div className="am"><span>{when}</span></div></div>
              </div>))}
          </SecCard>
          <SecCard title="Preferences">
            <SetField label="Theme"><select defaultValue="Follow app setting" onChange={() => push({ type: "info", title: "Theme preference saved" })}>{["Follow app setting", "Light", "Dark"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
            <SetField label="Language"><select defaultValue="English">{["English", "Hindi", "Marathi"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
            <SetField label="Time Zone"><select defaultValue="Asia/Kolkata (IST)">{["Asia/Kolkata (IST)", "UTC"].map((o) => <option key={o}>{o}</option>)}</select></SetField>
            <ToggleRow icon={BellRing} title="Notification Sounds" on={true} onChange={() => {}} />
          </SecCard>
          <SecCard title="Files & Documents" right={
            <label className="btn btn-soft btn-sm" style={{ cursor: "pointer" }}><FileUp size={14} /> Upload<input type="file" hidden onChange={(e) => { const f = e.target.files[0]; if (!f) return; setDocs((ds) => [{ id: Date.now(), name: f.name, size: Math.round(f.size / 1024) + " KB", icon: FileText, color: "#10B981" }, ...ds]); push({ type: "success", title: "Document uploaded", desc: f.name }); }} /></label>}>
            {docs.map((d) => (
              <div className="doc-row" key={d.id}>
                <span className="di" style={{ background: `${d.color}16`, color: d.color }}><d.icon size={17} /></span>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{d.size}</div></div>
                <button className="icon-btn" style={{ width: 30, height: 30 }} title="Download" onClick={() => dl(d)}><Download size={14} /></button>
              </div>))}
          </SecCard>
        </div>
      </div>

      <EditProfileModal open={editOpen} profile={profile} onClose={() => setEditOpen(false)} onSave={saveProfile} />
      <ConfirmDialog open={!!confirm} title={confirm?.t === "all" ? "Logout from all devices" : "Logout"} message={confirm?.t === "all" ? "End every active session except this one?" : "Log out of HelpHive on this device?"} confirmLabel="Logout"
        onConfirm={() => { if (confirm?.t === "all") { push({ type: "success", title: "All other sessions ended" }); } else { onSignOut && onSignOut(); } }} onClose={() => setConfirm(null)} />
    </div>
  );
}

/* ============================================================================
   THEME MANAGER — drive the app's CSS variables live
   ========================================================================== */
// Each theme field maps to one or more CSS custom properties on `.app`.
const THEME_FIELDS = [
  { key: "primary", label: "Primary Color", vars: ["--primary"], soft: "--primary-soft" },
  { key: "accent", label: "Secondary Color", vars: ["--accent"], soft: "--accent-soft" },
  { key: "success", label: "Accent Color", vars: ["--success"], soft: "--success-soft" },
  { key: "bg", label: "Background Color", vars: ["--bg"] },
  { key: "surface", label: "Card Background", vars: ["--surface"] },
  { key: "surface2", label: "Sidebar Background", vars: ["--surface-2", "--hover"] },
  { key: "warning", label: "Warning Color", vars: ["--warning"], soft: "--warning-soft" },
  { key: "danger", label: "Error / Danger Color", vars: ["--danger"], soft: "--danger-soft" },
  { key: "text", label: "Text Color", vars: ["--text"] },
  { key: "muted", label: "Muted / Secondary Text", vars: ["--muted"] },
  { key: "border", label: "Border Color", vars: ["--border"] },
];
const THEME_DEFAULT = { primary: "#5B5CEB", accent: "#0EA5E9", success: "#10B981", bg: "#F8F9FC", surface: "#FFFFFF", surface2: "#F1F3F9", warning: "#F59E0B", danger: "#EF4444", text: "#1A1D29", muted: "#6B7280", border: "#E9EBF2" };
const THEME_DARK = { primary: "#7C7DFF", accent: "#38BDF8", success: "#34D399", bg: "#0E1017", surface: "#171A24", surface2: "#1F2331", warning: "#FBBF24", danger: "#F87171", text: "#EEF1F8", muted: "#9BA3B7", border: "#262B3B" };
const PRESETS = [
  { name: "Freshdesk Blue", t: { ...THEME_DEFAULT, primary: "#12344D", accent: "#25C16F", success: "#25C16F" } },
  { name: "Zendesk Green", t: { ...THEME_DEFAULT, primary: "#17494D", accent: "#37B24D", success: "#37B24D" } },
  { name: "Salesforce Blue", t: { ...THEME_DEFAULT, primary: "#0176D3", accent: "#1B96FF", success: "#2E844A" } },
  { name: "Royal Purple", t: { ...THEME_DEFAULT, primary: "#7C3AED", accent: "#F472B6", success: "#10B981" } },
  { name: "Sunset Orange", t: { ...THEME_DEFAULT, primary: "#EA580C", accent: "#F59E0B", success: "#22C55E", bg: "#FDF8F3" } },
  { name: "Material Indigo", t: { ...THEME_DEFAULT, primary: "#3F51B5", accent: "#03A9F4", success: "#4CAF50" } },
  { name: "Ocean Blue", t: { ...THEME_DEFAULT, primary: "#0EA5E9", accent: "#06B6D4", success: "#14B8A6", bg: "#F1F7FB" } },
  { name: "Emerald Green", t: { ...THEME_DEFAULT, primary: "#059669", accent: "#10B981", success: "#22C55E", bg: "#F3FBF7" } },
  { name: "Corporate Gray", t: { ...THEME_DEFAULT, primary: "#475569", accent: "#0EA5E9", success: "#16A34A", bg: "#F5F6F8" } },
  { name: "Light Theme", t: { ...THEME_DEFAULT } },
  { name: "Midnight Dark", t: { ...THEME_DARK, primary: "#818CF8", accent: "#22D3EE" } },
  { name: "Dark Theme", t: { ...THEME_DARK } },
];

const hexToRgb = (h) => { const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h || ""); return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : "—"; };
const mix = (hex, pct, base) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || ""); if (!m) return hex;
  const b = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(base);
  const f = (i) => Math.round(parseInt(m[i], 16) * pct + parseInt(b[i], 16) * (1 - pct)).toString(16).padStart(2, "0");
  return `#${f(1)}${f(2)}${f(3)}`;
};
function applyTheme(theme, dark) {
  const root = document.querySelector(".app"); if (!root) return;
  const baseBg = theme.surface || (dark ? "#171A24" : "#fff");
  THEME_FIELDS.forEach((f) => {
    const val = theme[f.key]; if (!val) return;
    f.vars.forEach((v) => root.style.setProperty(v, val));
    if (f.soft) root.style.setProperty(f.soft, mix(val, dark ? 0.22 : 0.12, baseBg));
  });
  root.style.setProperty("--faint", mix(theme.muted || "#9AA1B1", 0.6, theme.bg || "#fff"));
}

function ThemeSwatch({ field, value, onChange }) {
  return (
    <div className="swatch-row">
      <label className="chip-color" style={{ background: value }}><input type="color" value={value} onChange={(e) => onChange(e.target.value)} /></label>
      <div style={{ flex: 1, minWidth: 0 }}><div className="lab">{field.label}</div><div className="rgb">rgb({hexToRgb(value)})</div></div>
      <input className="hex" value={value} onChange={(e) => { let v = e.target.value; if (!v.startsWith("#")) v = "#" + v; onChange(v); }} />
    </div>
  );
}

function ThemePreview() {
  return (
    <div className="tm-preview">
      <div className="tm-pv-nav"><span style={{ width: 22, height: 22, borderRadius: 7, background: "var(--primary)", display: "grid", placeItems: "center" }}><Ticket size={12} color="#fff" /></span><span style={{ fontSize: 12, fontWeight: 700 }}>HelpHive</span><span style={{ marginLeft: "auto", display: "flex", gap: 6 }}><span className="btn btn-primary" style={{ padding: "5px 10px", fontSize: 11 }}>Button</span></span></div>
      <div className="tm-pv-body">
        <div className="tm-pv-side"><i className="a" /><i /><i /><i /></div>
        <div className="tm-pv-main">
          <div className="tm-pv-card"><div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Ticket card</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><span className="badge-pill" style={{ background: "var(--success-soft)", color: "var(--success)" }}>Open</span><span className="badge-pill" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>Pending</span><span className="badge-pill" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>Overdue</span></div>
            <div className="tm-pv-bar"><i /></div>
          </div>
          <div style={{ display: "flex", gap: 6 }}><span className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 11.5 }}>Primary</span><span className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 11.5 }}>Ghost</span></div>
        </div>
      </div>
    </div>
  );
}

function ThemeDrawer({ open, onClose, theme, setTheme, dark, onResetDefault }) {
  const push = useToast();
  const fileRef = useRef(null);
  if (!open) return null;
  const set = (k, v) => setTheme((t) => ({ ...t, [k]: v }));
  const activePreset = PRESETS.find((p) => JSON.stringify(p.t) === JSON.stringify(theme));
  const save = () => { try { localStorage.setItem("helphive-theme", JSON.stringify(theme)); push({ type: "success", title: "Theme saved", desc: "It'll load automatically next time." }); } catch (e) { push({ type: "error", title: "Couldn't save", desc: "Local storage is unavailable here." }); } };
  const exportTheme = () => { downloadBlob(JSON.stringify(theme, null, 2), "helphive-theme.json", "application/json"); push({ type: "success", title: "Theme exported", desc: "helphive-theme.json downloaded." }); };
  const importTheme = (file) => { if (!file) return; const r = new FileReader(); r.onload = (e) => { try { const t = JSON.parse(e.target.result); setTheme({ ...THEME_DEFAULT, ...t }); push({ type: "success", title: "Theme imported", desc: "Applied instantly." }); } catch (err) { push({ type: "error", title: "Invalid file", desc: "That doesn't look like a theme JSON." }); } }; r.readAsText(file); };
  return (<>
    <div className="drawer-overlay" onClick={onClose} />
    <div className="drawer theme-drawer">
      <div className="drawer-head"><h3 className="card-title"><Palette size={16} style={{ verticalAlign: "-3px", marginRight: 7, color: "var(--primary)" }} />Theme Customization</h3><button className="icon-btn" onClick={onClose}><X size={17} /></button></div>
      <div className="drawer-body">
        <div className="tm-sec">Preset Themes</div>
        <div className="preset-grid">
          {PRESETS.map((p) => (
            <button key={p.name} className={`preset ${activePreset?.name === p.name ? "on" : ""}`} onClick={() => setTheme({ ...p.t })}>
              <span className="sw"><i style={{ background: p.t.primary }} /><i style={{ background: p.t.accent }} /><i style={{ background: p.t.success }} /></span>{p.name}
            </button>
          ))}
        </div>
        <div className="tm-sec" style={{ marginTop: 10 }}>Live Preview</div>
        <ThemePreview />
        <div className="tm-sec" style={{ marginTop: 10 }}>Colors</div>
        <div>{THEME_FIELDS.map((f) => <ThemeSwatch key={f.key} field={f} value={theme[f.key]} onChange={(v) => set(f.key, v)} />)}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button className="btn btn-soft btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={exportTheme}><Download size={14} /> Export</button>
          <button className="btn btn-soft btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => fileRef.current?.click()}><Upload size={14} /> Import</button>
          <input ref={fileRef} type="file" accept=".json" hidden onChange={(e) => importTheme(e.target.files[0])} />
        </div>
      </div>
      <div className="drawer-foot">
        <button className="btn btn-soft" style={{ justifyContent: "center" }} onClick={() => { onResetDefault(); push({ type: "info", title: "Theme reset", desc: "Back to the default palette." }); }}><RefreshCw size={15} /> Reset</button>
        <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={save}><Check size={15} /> Save Theme</button>
      </div>
    </div>
  </>);
}

/* ============================================================================
   APP  (lightweight router — swap for react-router-dom in your project)
   ========================================================================== */
/* ============================================================================
   SIGN IN
   ========================================================================== */
/* ============================================================================
   AUTH LAYER — mock API structured for a real backend (SendGrid/SES/SMTP later)
   ========================================================================== */
const SESSION_KEY = "hh-session";
const USERS_KEY = "hh-users";
const SESSION_DAYS = 8;

async function kvSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
  try { if (window.storage) await window.storage.set(key, value); } catch (e) {}
}
async function kvDelete(key) {
  try { localStorage.removeItem(key); } catch (e) {}
  try { if (window.storage) await window.storage.delete(key); } catch (e) {}
}
function kvGetSync(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
async function kvGetAsync(key) {
  try { if (window.storage) { const r = await window.storage.get(key); return r ? r.value : null; } } catch (e) {}
  return null;
}
function parseSession(raw) {
  try { const s = JSON.parse(raw || ""); if (s && s.token && s.exp && Date.now() < s.exp) return s; } catch (e) {}
  return null;
}
function makeToken() {
  try { const a = new Uint8Array(24); crypto.getRandomValues(a); return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join(""); }
  catch (e) { return "t" + Math.random().toString(36).slice(2) + Date.now().toString(36); }
}

/* Mock backend — swap each method's body for a fetch() call when the real API exists.
   Endpoints modelled: /auth/send-otp, /auth/verify-otp, /auth/login,
   /auth/forgot-password, /auth/reset-password, /auth/logout, /auth/session */
const API_BASE = (() => {
  try { return (globalThis.HELPHIVE_API_BASE || localStorage.getItem("hh-api-base") || "").replace(/\/$/, ""); } catch (e) { return ""; }
})();

/* Set this once in the browser console to enable the Google button:
     localStorage.setItem("hh-google-client-id", "YOUR_CLIENT_ID.apps.googleusercontent.com")
   Get a Client ID from https://console.cloud.google.com/apis/credentials
   (OAuth client → Web application → add your app's URL under
   "Authorized JavaScript origins"). The same ID must be set as
   GOOGLE_CLIENT_ID in backend/.env so the server can verify tokens. */
const GOOGLE_CLIENT_ID = (() => {
  try { return globalThis.HELPHIVE_GOOGLE_CLIENT_ID || localStorage.getItem("hh-google-client-id") || ""; } catch (e) { return ""; }
})();

/* When API_BASE is set (e.g. http://localhost:5001) every call below hits the
   real Express backend in /backend. Without it, the mock keeps the demo usable. */
const authApi = (() => {
  const live = !!API_BASE;
  let verifyTokenMem = null; // OTP proof from the backend, held for the login call

  const http = async (path, body, token) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || `Request failed (${res.status}).` };
      return data;
    } catch (e) {
      return { ok: false, error: "Cannot reach the auth server. Is the backend running?" };
    }
  };

  /* ---------- demo fallback (no backend configured) ---------- */
  let users = {
    "rainahemani14@gmail.com": { password: "helphive", name: "Hemani Raina" },
    // Team Management demo agents — same password, so you can see per-agent signatures
    "rahul.sharma@internshipstudio.com": { password: "helphive", name: "Rahul Sharma" },
    "priya.patel@internshipstudio.com": { password: "helphive", name: "Priya Patel" },
    // Ticket-assignee agents — log in as these to see a personalized My Dashboard
    "priya.nair@internshipstudio.com": { password: "helphive", name: "Priya Nair" },
    "rahul.sethi@internshipstudio.com": { password: "helphive", name: "Rahul Sethi" },
  };
  try { users = { ...users, ...JSON.parse(kvGetSync(USERS_KEY) || "{}") }; } catch (e) {}
  const otps = {};
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const OTP_TTL = 120e3, MAX_ATTEMPTS = 5, MAX_RESENDS = 3;

  return {
    live,
    async sendOtp(email, { reset = false, password = "" } = {}) {
      if (live) {
        const r = reset ? await http("/forgot-password", { email }) : await http("/send-otp", { email, password });
        if (!r.ok) return r;
        return { ok: true, ttl: r.ttl || 300e3, resendsLeft: 3 };
      }
      await wait(700);
      if (!users[email]) return { ok: false, error: reset ? "No account found for this email." : "Account not found. Contact your administrator." };
      if (!reset && users[email].status === "pending") return { ok: false, error: "Your account is awaiting administrator approval. You'll be able to sign in once approved." };
      const prev = otps[email];
      const resends = prev ? prev.resends + 1 : 0;
      if (resends > MAX_RESENDS) return { ok: false, error: "Too many OTP requests. Try again later." };
      // Demo environment (no backend configured): a fixed silent code — never shown in the UI.
      otps[email] = { code: "123456", exp: Date.now() + OTP_TTL, attempts: 0, resends, reset };
      return { ok: true, ttl: OTP_TTL, resendsLeft: MAX_RESENDS - resends };
    },
    async resendOtp(email, opts = {}) {
      if (live) {
        const r = opts.reset ? await http("/forgot-password", { email }) : await http("/resend-otp", { email });
        if (!r.ok) return r;
        return { ok: true, ttl: r.ttl || 300e3, resendsLeft: 3 };
      }
      return this.sendOtp(email, opts);
    },
    async verifyOtp(email, code, { reset = false } = {}) {
      if (live) {
        const r = await http(reset ? "/verify-reset-otp" : "/verify-otp", { email, otp: code });
        if (!r.ok) return r;
        verifyTokenMem = r.verifyToken;
        return { ok: true };
      }
      await wait(450);
      const rec = otps[email];
      if (!rec) return { ok: false, error: "No OTP was requested. Send a new code." };
      if (Date.now() > rec.exp) return { ok: false, error: "This code has expired. Request a new OTP.", expired: true };
      rec.attempts++;
      if (rec.attempts > MAX_ATTEMPTS) return { ok: false, error: "Too many incorrect attempts. Request a new OTP.", expired: true };
      if (rec.code !== code) return { ok: false, error: `Incorrect code. ${MAX_ATTEMPTS - rec.attempts} attempt${MAX_ATTEMPTS - rec.attempts !== 1 ? "s" : ""} left.` };
      rec.verified = true;
      return { ok: true };
    },
    async login(email, password) {
      if (live) {
        if (!verifyTokenMem) return { ok: false, error: "Verify the OTP sent to your email first." };
        const r = await http("/login", { email, password, verifyToken: verifyTokenMem });
        if (!r.ok) return r;
        verifyTokenMem = null;
        const session = { token: r.token, email: r.user.email, name: r.user.name, role: r.user.role, exp: Date.now() + (r.expiresInDays || 8) * 864e5 };
        await kvSet(SESSION_KEY, JSON.stringify(session));
        return { ok: true, session };
      }
      await wait(600);
      const rec = otps[email];
      if (!rec || !rec.verified) return { ok: false, error: "Verify the OTP sent to your email first." };
      const u = users[email];
      if (!u || u.password !== password) return { ok: false, error: "Incorrect password." };
      if (u.status === "pending") return { ok: false, error: "Your account is awaiting administrator approval. You'll be able to sign in once approved." };
      if (u.status === "rejected" || u.status === "disabled") return { ok: false, error: "This account is not active. Contact your administrator." };
      delete otps[email];
      const session = { token: makeToken(), email, name: u.name, exp: Date.now() + SESSION_DAYS * 864e5 };
      await kvSet(SESSION_KEY, JSON.stringify(session));
      return { ok: true, session };
    },
    async resetPassword(email, newPassword) {
      if (live) {
        if (!verifyTokenMem) return { ok: false, error: "Verify the OTP first." };
        const r = await http("/reset-password", { email, newPassword, verifyToken: verifyTokenMem });
        if (r.ok) verifyTokenMem = null;
        return r;
      }
      await wait(600);
      const rec = otps[email];
      if (!rec || !rec.verified) return { ok: false, error: "Verify the OTP first." };
      if (!newPassword || newPassword.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
      users[email] = { ...(users[email] || { name: email.split("@")[0] }), password: newPassword };
      delete otps[email];
      await kvSet(USERS_KEY, JSON.stringify(users));
      return { ok: true };
    },
    /* ---------- registration (email + mobile OTP) ---------- */
    async registerSendOtp(kind, dest) {
      if (live) {
        const r = await http(kind === "email" ? "/register/send-email-otp" : "/register/send-mobile-otp", kind === "email" ? { email: dest } : { mobile: dest });
        if (!r.ok) return r;
        return { ok: true, ttl: r.ttl || 300e3 };
      }
      await wait(600);
      let regUsers = {};
      try { regUsers = JSON.parse(kvGetSync(USERS_KEY) || "{}"); } catch (e) {}
      if (kind === "email" && (users[dest] || regUsers[dest])) return { ok: false, error: "An account with this email already exists." };
      otps[`reg-${kind}:${dest}`] = { code: "123456", exp: Date.now() + 300e3, attempts: 0, resends: 0 };
      return { ok: true, ttl: 300e3 };
    },
    async registerVerifyOtp(kind, dest, code) {
      if (live) {
        const r = await http(kind === "email" ? "/register/verify-email-otp" : "/register/verify-mobile-otp", kind === "email" ? { email: dest, otp: code } : { mobile: dest, otp: code });
        if (!r.ok) return r;
        if (kind === "email") this._emailToken = r.verifyToken; else this._mobileToken = r.verifyToken;
        return { ok: true };
      }
      await wait(400);
      const rec = otps[`reg-${kind}:${dest}`];
      if (!rec) return { ok: false, error: "No OTP was requested. Send a new code." };
      if (Date.now() > rec.exp) return { ok: false, error: "This code has expired. Request a new OTP.", expired: true };
      rec.attempts++;
      if (rec.attempts > MAX_ATTEMPTS) return { ok: false, error: "Too many incorrect attempts. Request a new OTP.", expired: true };
      if (rec.code !== code) return { ok: false, error: `Incorrect code. ${MAX_ATTEMPTS - rec.attempts} attempt${MAX_ATTEMPTS - rec.attempts !== 1 ? "s" : ""} left.` };
      rec.verified = true;
      return { ok: true };
    },
    async register(p) {
      if (live) {
        const r = await http("/register", { ...p, emailToken: this._emailToken, mobileToken: this._mobileToken });
        if (r.ok) { this._emailToken = null; this._mobileToken = null; }
        return r;
      }
      await wait(700);
      const em = otps[`reg-email:${p.email}`], mo = otps[`reg-mobile:${p.mobile}`];
      if (!em || !em.verified) return { ok: false, error: "Verify your email address first." };
      if (!mo || !mo.verified) return { ok: false, error: "Verify your mobile number first." };
      let regUsers = {};
      try { regUsers = JSON.parse(kvGetSync(USERS_KEY) || "{}"); } catch (e) {}
      if (users[p.email] || regUsers[p.email]) return { ok: false, error: "An account with this email already exists." };
      if (Object.values(regUsers).some((u) => u.phone === p.mobile)) return { ok: false, error: "An account with this mobile number already exists." };
      regUsers[p.email] = { password: p.password, name: p.fullName, phone: p.mobile, designation: p.designation, dept: p.department || "", company: p.companyName, status: "pending", emailVerified: true, mobileVerified: true, createdAt: Date.now() };
      users[p.email] = regUsers[p.email];
      delete otps[`reg-email:${p.email}`]; delete otps[`reg-mobile:${p.mobile}`];
      await kvSet(USERS_KEY, JSON.stringify(regUsers));
      return { ok: true, status: "pending" };
    },
    async googleLogin(credential) {
      if (live) {
        const r = await http("/google", { credential });
        if (!r.ok) return r;
        const session = { token: r.token, email: r.user.email, name: r.user.name, role: r.user.role, exp: Date.now() + (r.expiresInDays || 8) * 864e5 };
        await kvSet(SESSION_KEY, JSON.stringify(session));
        return { ok: true, session };
      }
      try {
        const b64 = credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(decodeURIComponent(escape(atob(b64))));
        const session = { token: makeToken(), email: payload.email, name: payload.name || (payload.email || "").split("@")[0], exp: Date.now() + SESSION_DAYS * 864e5 };
        await kvSet(SESSION_KEY, JSON.stringify(session));
        return { ok: true, session };
      } catch (e) { return { ok: false, error: "Could not read the Google response." }; }
    },
    async logout() {
      if (live) { const ses = parseSession(kvGetSync(SESSION_KEY)); http("/logout", {}, ses?.token); }
      await kvDelete(SESSION_KEY);
      return { ok: true };
    },
    sessionSync() { return parseSession(kvGetSync(SESSION_KEY)); },
    async sessionAsync() {
      const ses = parseSession(await kvGetAsync(SESSION_KEY)) || parseSession(kvGetSync(SESSION_KEY));
      if (!ses) return null;
      if (live) {
        const r = await http("/me", undefined, ses.token);
        if (!r.ok) { await kvDelete(SESSION_KEY); return null; }   // expired/invalid on server → auto sign-out
      }
      return ses;
    },
  };
})();

const REG_DESIGNATIONS = ["Super Admin", "Admin", "Team Lead", "Support Executive", "Customer Support Executive", "Technical Support Engineer", "QA Executive", "Operations Executive"];


/* ============================================================================
   CALLER MODULE
   ========================================================================== */
const CALL_ICONS = { PhoneIncoming, PhoneOutgoing, PhoneMissed, Voicemail: VoicemailIcon, PhoneForwarded, PhoneCall };
function CallTypeBadge({ type, small }) {
  const m = CALL_TYPE_META[type] || CALL_TYPE_META.Incoming;
  const Ic = CALL_ICONS[m.icon] || PhoneCall;
  return <span className={`call-badge cb-${m.tone} ${small ? "sm" : ""}`}><Ic size={small ? 10 : 12} /> {type}</span>;
}
function callStatusTone(st) {
  return { Answered: "g", Completed: "g", Missed: "r", Rejected: "r", Voicemail: "o", Ringing: "b" }[st] || "x";
}

function CallerKpi({ icon: Ic, tone, label, value }) {
  return (
    <div className="agk">
      <span className={`agk-ic ic-${tone}`}><Ic size={14} /></span>
      <div className="agk-main"><b>{value}</b><span>{label}</span></div>
    </div>
  );
}

/* ---- live incoming call popup ---- */
function IncomingCallPopup({ call, onClose, onAccept, onReject, onCreateTicket }) {
  const [sec, setSec] = useState(0);
  useEffect(() => { const t = setInterval(() => setSec((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const ctx = call.ticket?.studentContext;
  return (
    <div className=" incm-wrap">
      <div className="incm">
        <div className="incm-top">
          <span className="incm-pulse"><PhoneIncoming size={18} /></span>
          <div><b>Incoming Call</b><span>{fmtDur(sec)} · ringing…</span></div>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="incm-num">{call.phoneNumber}</div>
        {call.customerId ? (<>
          <div className="incm-name">{call.customerName} <BadgeCheck size={15} color="var(--success)" /></div>
          <div className="incm-reg">✓ Registered Student</div>
          {ctx && (
            <div className="incm-ctx">
              <span className="stu-tag t-b sm">{stuDomainLabel(ctx.domain)}</span>
              <span className="stu-tag t-b sm">Batch: {stuDateDisplay(ctx.startDate)}</span>
              <span className={`stu-tag t-${(STU_ENUMS.enrollmentStatus[ctx.enrollmentStatus]||["","x"])[1]} sm`}>{(STU_ENUMS.enrollmentStatus[ctx.enrollmentStatus]||["—"])[0]}</span>
            </div>
          )}
          <div className="incm-mini">
            <span>Tickets <b>{call.ticket?.totalTickets ?? 4}</b></span>
            <span>Prev calls <b>{call.prevCalls ?? 6}</b></span>
            <span>Missed <b>{call.missedCount ?? 1}</b></span>
          </div>
        </>) : (<>
          <div className="incm-name">Unknown Caller</div>
          <div className="incm-reg unk">No student record found</div>
        </>)}
        <div className="incm-actions">
          <button className="btn btn-primary btn-sm" onClick={onAccept}><Phone size={14} /> Accept</button>
          <button className="btn btn-soft btn-sm incm-reject" onClick={onReject}><PhoneOff size={14} /> Reject</button>
          <button className="btn btn-ghost btn-sm" onClick={onCreateTicket}><Plus size={13} /> Create Ticket</button>
        </div>
      </div>
    </div>
  );
}

/* ---- caller profile drawer ---- */
function CallerProfile({ phone, calls, onClose, onOpenTicket, onCallback }) {
  const mine = calls.filter((c) => c.phoneNumber === phone);
  const first = mine[0] || {};
  const known = !!first.customerId;
  const ticket = TICKETS.find((t) => t.id === first.customerId);
  const ctx = ticket?.studentContext;
  const st = callStats(mine);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal caller-prof" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="panel-title" style={{ fontSize: 15 }}>
            <span className="wa" style={{ background: avColor(first.customerName || "U"), width: 34, height: 34 }}>{initials(first.customerName || "U")}</span>
            {first.customerName || "Unknown Caller"}
          </div>
          <button className="icon-btn" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="modal-body">
          {known && ctx ? (
            <div className="cp-stu" style={{ border: 0, padding: 0, marginBottom: 14 }}>
              <div className="cp-stu-head"><span className="cp-stu-title"><GraduationCap size={13} /> Student Information</span><span className="ai-ready"><Sparkles size={10} /> AI Context Ready</span></div>
              {stuPills(ctx).map((p) => (
                <div key={p.key} className="cp-stu-row"><span className="k">{{registrationStatus:"Registration",domain:"Domain",examStatus:"Exam",startDate:"Start Date",projectStatus:"Project",refundEligibility:"Refund",batch:"Batch",enrollmentStatus:"Enrollment"}[p.key]}</span><span className={`v tv-${p.tone}`}>{!!p.check && <Check size={10} strokeWidth={3.2} />}{p.text.replace(/^(Start|Project|Batch|Status): /, "")}</span></div>
              ))}
              <div className="cp-stu-row"><span className="k">Phone</span><span className="v">{phone}</span></div>
              <div className="cp-stu-row"><span className="k">Email</span><span className="v">{first.email}</span></div>
            </div>
          ) : <div className="signin-info" style={{ marginBottom: 14 }}><Info size={14} /> Unknown number — not linked to any student record.</div>}

          <div className="caller-stats">
            {[["Total", st.total], ["Incoming", st.incoming], ["Outgoing", st.outgoing], ["Missed", st.missed], ["Voicemails", st.voicemail]].map(([k, v]) => (
              <div key={k}><b>{v}</b><span>{k}</span></div>
            ))}
          </div>

          <div className="section-head" style={{ marginTop: 6 }}><h3 className="card-title" style={{ fontSize: 13 }}>Call Timeline</h3></div>
          <div className="caller-timeline">
            {mine.map((c) => (
              <div key={c.callId} className="ctl-row">
                <span className={`ctl-dot d-${callStatusTone(c.status)}`} />
                <div className="ctl-main">
                  <b>{c.callType} — {c.status}</b>
                  <span>{c.day} · {c.time}{c.duration ? ` · Duration ${fmtDur(c.duration)}` : ""}{c.agent !== "—" ? ` · ${c.agent}` : ""}</span>
                </div>
                {c.recordingUrl && <button className="icon-btn" title="Play recording"><PlayCircle size={16} /></button>}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-soft btn-sm" onClick={() => onCallback(first)}><PhoneForwarded size={13} /> Call Back</button>
          {known && ticket && <button className="btn btn-ghost btn-sm" onClick={() => { onOpenTicket(ticket); onClose(); }}><Ticket size={13} /> Open Ticket</button>}
        </div>
      </div>
    </div>
  );
}

/* ---- voicemail card ---- */
function VoicemailCard({ call, onCreateTicket, onProfile }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="vm-card">
      <div className="vm-head">
        <span className="vm-ic"><VoicemailIcon size={15} /></span>
        <div className="vm-info"><b>{call.customerName}</b><span>Missed call — {call.day} {call.time}</span></div>
        <span className="badge-xs" style={{ background: "var(--warning-soft)", color: "#B45309" }}>{fmtDur(call.duration)}</span>
      </div>
      <button className="vm-play" onClick={() => setPlaying((x) => !x)}>
        {playing ? <PauseCircle size={20} /> : <PlayCircle size={20} />}
        <span className="vm-wave">{Array.from({ length: 22 }).map((_, i) => <i key={i} className={playing ? "on" : ""} style={{ height: `${20 + (i * 37) % 70}%`, animationDelay: `${i * 0.05}s` }} />)}</span>
        <span className="vm-time">{fmtDur(call.duration)}</span>
      </button>
      {call.transcription && (
        <div className="vm-transcript"><span className="vm-tl"><Sparkles size={11} /> Transcription</span>{call.transcription}</div>
      )}
      <div className="vm-actions">
        <button className="btn btn-primary btn-sm" onClick={() => onCreateTicket(call)}><Plus size={12} /> Create Ticket</button>
        <button className="btn btn-ghost btn-sm" onClick={() => onProfile(call.phoneNumber)}><User size={12} /> Profile</button>
      </div>
    </div>
  );
}

function CallerPage({ tickets, onOpenTicket }) {
  const push = useToast();
  const me = currentAgentProfile();
  const roleClass = agdRoleOf(me);
  const [tab, setTab] = useState("dashboard"); // dashboard | history | missed | voicemail | mycalls
  const [calls, setCalls] = useState(CALLS_SEED);
  const [profilePhone, setProfilePhone] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const [newTicket, setNewTicket] = useState(false);
  // filters
  const [fType, setFType] = useState("All");
  const [fStatus, setFStatus] = useState("All");
  const [fAgent, setFAgent] = useState("All");
  const [fDur, setFDur] = useState("All");
  const [q, setQ] = useState("");

  // demo: simulate an incoming call
  const simulate = () => {
    const known = TICKETS[Math.floor(Math.random() * 12)];
    setIncoming({
      phoneNumber: known.phone, customerId: known.id, customerName: known.name, email: known.email,
      ticket: known, prevCalls: 3 + (known.id % 9), missedCount: known.id % 3,
    });
  };
  const acceptCall = () => { push({ type: "success", title: "Call connected", desc: incoming.customerName }); setIncoming(null); };
  const rejectCall = () => {
    if (incoming.customerId) {
      setCalls((cs) => [{ callId: `CALL-${Date.now()}`, phoneNumber: incoming.phoneNumber, customerId: incoming.customerId, customerName: incoming.customerName, email: incoming.email, agent: "—", agentId: null, callType: "Missed", status: "Missed", day: "Today", time: "just now", duration: 0, recordingUrl: null, voicemailUrl: null, transcription: null, ticketId: null, notes: "", callbackStatus: "Pending", ai: {}, createdAt: Date.now() }, ...cs]);
      push({ type: "info", title: "Missed call logged", desc: "Callback task created." });
    }
    setIncoming(null);
  };

  const stats = useMemo(() => callStats(calls), [calls]);
  const durBucket = (d) => d < 60 ? "u1" : d < 300 ? "1-5" : d < 900 ? "5-15" : "15+";
  const filtered = useMemo(() => calls.filter((c) => {
    if (fType !== "All" && c.callType !== fType) return false;
    if (fStatus !== "All" && c.status !== fStatus) return false;
    if (fAgent !== "All" && c.agent !== fAgent) return false;
    if (fDur !== "All" && durBucket(c.duration) !== fDur) return false;
    if (q.trim()) { const s2 = q.toLowerCase(); if (!(c.customerName.toLowerCase().includes(s2) || c.phoneNumber.includes(q) || (c.email || "").toLowerCase().includes(s2) || c.callId.toLowerCase().includes(s2))) return false; }
    return true;
  }), [calls, fType, fStatus, fAgent, fDur, q]);

  const missed = calls.filter((c) => c.callType === "Missed" || c.status === "Missed");
  const missedByPhone = useMemo(() => {
    const map = {};
    missed.forEach((c) => { (map[c.phoneNumber] = map[c.phoneNumber] || { ...c, attempts: 0, list: [] }); map[c.phoneNumber].attempts++; map[c.phoneNumber].list.push(c); });
    return Object.values(map).sort((a, b) => b.attempts - a.attempts);
  }, [calls]);
  const voicemails = calls.filter((c) => c.callType === "Voicemail");
  const myCalls = calls.filter((c) => c.agent === me.name);
  const myStats = callStats(myCalls);

  const createTicketFromCall = (c) => { setNewTicket(true); push({ type: "success", title: "Ticket draft from call", desc: `${c.customerName} · ${c.phoneNumber}` }); };
  const setCallback = (phone, status) => { setCalls((cs) => cs.map((c) => c.phoneNumber === phone && (c.callType === "Missed" || c.status === "Missed") ? { ...c, callbackStatus: status } : c)); push({ type: "success", title: `Callback marked ${status}` }); };

  const exportCSV = () => {
    const rows = [["Call ID", "Date", "Time", "Caller", "Phone", "Type", "Status", "Agent", "Duration"], ...filtered.map((c) => [c.callId, c.day, c.time, c.customerName, c.phoneNumber, c.callType, c.status, c.agent, fmtDur(c.duration)])];
    const csv = rows.map((r) => r.map((x) => `"${x}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv); a.download = "helphive-calls.csv"; a.click();
    push({ type: "success", title: "Call report exported", desc: `${filtered.length} calls · CSV` });
  };

  const TABS = [["dashboard", "Dashboard", PhoneCall], ["history", "Call History", Clock], ["missed", "Missed & Callbacks", PhoneMissed], ["voicemail", "Voicemail", VoicemailIcon], ["mycalls", "My Calls", User]];

  return (
    <div className="route caller">
      <div className="caller-topbar">
        <div className="caller-tabs">
          {TABS.map(([k, lbl, Ic]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              <Ic size={14} /> {lbl}
              {k === "missed" && missedByPhone.length > 0 && <span className="tab-ct">{missedByPhone.length}</span>}
              {k === "voicemail" && voicemails.length > 0 && <span className="tab-ct">{voicemails.length}</span>}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm caller-sim" onClick={simulate}><PhoneIncoming size={13} /> Simulate Incoming Call</button>
      </div>

      {/* DASHBOARD */}
      {tab === "dashboard" && (<>
        <div className="agk-row caller-kpis">
          <CallerKpi icon={PhoneCall} tone="b" label="Total Calls" value={stats.total} />
          <CallerKpi icon={PhoneIncoming} tone="g" label="Incoming" value={stats.incoming} />
          <CallerKpi icon={PhoneOutgoing} tone="b" label="Outgoing" value={stats.outgoing} />
          <CallerKpi icon={PhoneMissed} tone="r" label="Missed" value={stats.missed} />
          <CallerKpi icon={CheckCheck} tone="g" label="Answered" value={stats.answered} />
          <CallerKpi icon={VoicemailIcon} tone="o" label="Voicemails" value={stats.voicemail} />
          <CallerKpi icon={Clock} tone="b" label="Avg Duration" value={fmtDur(stats.avgDur)} />
          <CallerKpi icon={Users} tone="b" label="Unique Callers" value={stats.unique} />
        </div>
        <div className="caller-dash-row">
          <div className="card card-pad" style={{ flex: 2, minWidth: 0 }}>
            <div className="section-head"><h3 className="card-title"><Clock size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--primary)" }} />Recent Calls</h3><button className="agd-link" onClick={() => setTab("history")}>View Call History →</button></div>
            {calls.slice(0, 7).map((c) => (
              <div key={c.callId} className="call-row" onClick={() => setProfilePhone(c.phoneNumber)}>
                <CallTypeBadge type={c.callType} small />
                <span className="call-name">{c.customerName}</span>
                <span className="call-phone">{c.phoneNumber}</span>
                <span className={`badge-xs st-${callStatusTone(c.status)}`}>{c.status}</span>
                <span className="call-dur">{fmtDur(c.duration)}</span>
                <span className="call-time">{c.day} {c.time}</span>
              </div>
            ))}
          </div>
          <div className="card card-pad" style={{ flex: 1, minWidth: 220 }}>
            <div className="section-head"><h3 className="card-title" style={{ color: "var(--danger)" }}><PhoneMissed size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Needs Callback</h3></div>
            {missedByPhone.slice(0, 5).map((m) => (
              <div key={m.phoneNumber} className="mc-mini" onClick={() => setProfilePhone(m.phoneNumber)}>
                <div><b>{m.customerName}</b><span>{m.attempts} missed · {m.list[0].time}</span></div>
                {m.attempts >= 3 && <span className="badge-xs" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>High</span>}
              </div>
            ))}
            {missedByPhone.length === 0 && <div className="agd-empty"><CheckCircle2 size={16} /> No pending callbacks.</div>}
          </div>
        </div>
      </>)}

      {/* HISTORY */}
      {tab === "history" && (<>
        <div className="card card-pad caller-filters">
          <div className="cf-search"><Search size={15} /><input placeholder="Search name, number, email or call ID…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select value={fType} onChange={(e) => setFType(e.target.value)}><option>All</option>{CALL_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option>All</option>{["Answered", "Completed", "Missed", "Rejected", "Voicemail"].map((t) => <option key={t}>{t}</option>)}</select>
          <select value={fAgent} onChange={(e) => setFAgent(e.target.value)}><option>All</option>{AGENT_POOL.map((a) => <option key={a}>{a}</option>)}</select>
          <select value={fDur} onChange={(e) => setFDur(e.target.value)}><option value="All">Any duration</option><option value="u1">Under 1 min</option><option value="1-5">1–5 min</option><option value="5-15">5–15 min</option><option value="15+">15 min+</option></select>
          <button className="btn btn-soft btn-sm" onClick={exportCSV}><Download size={13} /> Export</button>
        </div>
        <div className="card card-pad">
          <div className="table-wrap"><table>
            <thead><tr><th>Time</th><th>Caller</th><th>Phone</th><th>Type</th><th>Agent</th><th>Duration</th><th>Status</th><th>Rec</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
            <tbody>{filtered.slice(0, 40).map((c) => (
              <tr key={c.callId} style={{ cursor: "pointer" }} onClick={() => setProfilePhone(c.phoneNumber)}>
                <td style={{ whiteSpace: "nowrap", fontSize: 12 }}><b>{c.time}</b><div style={{ color: "var(--faint)", fontSize: 11 }}>{c.day}</div></td>
                <td style={{ fontWeight: 600, fontSize: 12.5 }}>{c.customerName}</td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{c.phoneNumber}</td>
                <td><CallTypeBadge type={c.callType} small /></td>
                <td style={{ fontSize: 12.5 }}>{c.agent}</td>
                <td style={{ fontSize: 12.5, fontWeight: 600 }}>{fmtDur(c.duration)}</td>
                <td><span className={`badge-xs st-${callStatusTone(c.status)}`}>{c.status}</span></td>
                <td>{c.recordingUrl ? <PlayCircle size={16} color="var(--primary)" /> : <span style={{ color: "var(--faint)" }}>—</span>}</td>
                <td onClick={(e) => e.stopPropagation()}><div className="row-act" style={{ justifyContent: "flex-end" }}>
                  <button title="Call back"><PhoneForwarded size={14} /></button>
                  <button title="Create ticket" onClick={() => createTicketFromCall(c)}><Plus size={14} /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
          {filtered.length === 0 && <EmptyState icon={PhoneCall} title="No calls match" desc="Try adjusting the filters above." />}
        </div>
      </>)}

      {/* MISSED & CALLBACKS */}
      {tab === "missed" && (
        <div className="caller-missed">
          {missedByPhone.length ? missedByPhone.map((m) => (
            <div key={m.phoneNumber} className="card card-pad mc-card">
              <div className="mc-l">
                <span className="wa" style={{ background: avColor(m.customerName) }}>{initials(m.customerName)}</span>
                <div>
                  <b>{m.customerName}</b>
                  <span className="mc-num">{m.phoneNumber}</span>
                  <div className="mc-meta">
                    <span className={m.attempts >= 3 ? "mc-hi" : ""}>{m.attempts} missed call{m.attempts !== 1 ? "s" : ""}{m.attempts >= 3 && " — High Priority"}</span>
                    <span>· Last: {m.list[0].time}</span>
                    {m.customerId && <span>· Assigned: Support Queue</span>}
                  </div>
                </div>
              </div>
              <div className="mc-r">
                <select value={m.list[0].callbackStatus || "Pending"} onChange={(e) => setCallback(m.phoneNumber, e.target.value)} className="mc-cbstatus">
                  {["Pending", "Completed", "Unreachable", "Rescheduled"].map((x) => <option key={x}>{x}</option>)}
                </select>
                <button className="btn btn-primary btn-sm"><PhoneForwarded size={13} /> Call Back</button>
                <button className="btn btn-soft btn-sm" onClick={() => createTicketFromCall(m)}><Plus size={12} /> Ticket</button>
                <button className="btn btn-ghost btn-sm"><MessageSquare size={12} /> Message</button>
              </div>
            </div>
          )) : <EmptyState icon={CheckCircle2} title="No missed calls" desc="Every caller has been handled." />}
        </div>
      )}

      {/* VOICEMAIL */}
      {tab === "voicemail" && (
        <div className="caller-vms">
          {voicemails.length ? voicemails.map((c) => <VoicemailCard key={c.callId} call={c} onCreateTicket={createTicketFromCall} onProfile={setProfilePhone} />) : <EmptyState icon={VoicemailIcon} title="No voicemails" desc="New voice messages will appear here." />}
        </div>
      )}

      {/* MY CALLS */}
      {tab === "mycalls" && (<>
        <div className="agk-row caller-kpis">
          <CallerKpi icon={CheckCheck} tone="g" label="Answered" value={myStats.answered} />
          <CallerKpi icon={PhoneOutgoing} tone="b" label="Outgoing" value={myStats.outgoing} />
          <CallerKpi icon={PhoneMissed} tone="r" label="Missed" value={myStats.missed} />
          <CallerKpi icon={Clock} tone="b" label="Talk Time" value={`${Math.floor(myStats.talkTime / 3600)}h ${Math.round((myStats.talkTime % 3600) / 60)}m`} />
          <CallerKpi icon={VoicemailIcon} tone="o" label="Voicemails" value={myStats.voicemail} />
          <CallerKpi icon={PhoneForwarded} tone="b" label="Callbacks" value={myStats.callbacks} />
        </div>
        <div className="card card-pad">
          <div className="section-head"><h3 className="card-title"><User size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--primary)" }} />My Recent Calls</h3></div>
          {myCalls.length ? myCalls.slice(0, 12).map((c) => (
            <div key={c.callId} className="call-row" onClick={() => setProfilePhone(c.phoneNumber)}>
              <CallTypeBadge type={c.callType} small />
              <span className="call-name">{c.customerName}</span>
              <span className="call-phone">{c.phoneNumber}</span>
              <span className={`badge-xs st-${callStatusTone(c.status)}`}>{c.status}</span>
              <span className="call-dur">{fmtDur(c.duration)}</span>
              <span className="call-time">{c.day} {c.time}</span>
            </div>
          )) : <EmptyState icon={User} title="No calls handled yet" desc="Calls you answer or place will appear here." />}
        </div>
      </>)}

      {profilePhone && <CallerProfile phone={profilePhone} calls={calls} onClose={() => setProfilePhone(null)} onOpenTicket={onOpenTicket} onCallback={() => push({ type: "info", title: "Dialing…" })} />}
      {incoming && <IncomingCallPopup call={incoming} onClose={() => setIncoming(null)} onAccept={acceptCall} onReject={rejectCall} onCreateTicket={() => { setNewTicket(true); setIncoming(null); }} />}
      <TicketModal open={newTicket} onClose={() => setNewTicket(false)} />
    </div>
  );
}

/* ============================================================================
   AGENT DASHBOARD — personal command center for the logged-in agent
   ========================================================================== */
function agdHash(str) { let h = 0; for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; } return h; }
function agdRand(seedStr) { let x = agdHash(seedStr) || 7; return () => { x = (x * 1103515245 + 12345) >>> 0; return (x % 1000) / 1000; }; }
const AGD_RANGES = [["today","Today",1],["yest","Yesterday",1],["7d","Last 7 Days",7],["30d","Last 30 Days",30],["month","This Month",30],["pmonth","Previous Month",30],["custom","Custom",0]];

function agdRoleOf(me) {
  const email = (me.email || "").toLowerCase();
  if (["rainahemani14@gmail.com", "admin@internshipstudio.com"].includes(email)) return "admin";
  if (/super admin|admin/i.test(me.role || "")) return "admin";
  if (/lead/i.test(me.role || "")) return "lead";
  return "agent";
}

function AgdRing({ pct, size = 92, color = "var(--primary)", label, sub }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="agd-ring-wrap">
      <div className="agd-ring" style={{ width: size, height: size, background: `conic-gradient(${color} ${p * 3.6}deg, var(--surface-2) 0deg)` }}>
        <div className="agd-ring-in"><b>{label ?? `${Math.round(p)}%`}</b></div>
      </div>
      {sub && <span className="agd-ring-sub">{sub}</span>}
    </div>
  );
}

function AgdKpi({ icon: Ic, tone, label, value, delta }) {
  const up = (delta || 0) >= 0;
  return (
    <div className="agk">
      <span className={`agk-ic ic-${tone}`}><Ic size={14} /></span>
      <div className="agk-main"><b>{value}</b><span>{label}</span></div>
      <span className={`agk-tr ${up ? "up" : "dn"}`}>{up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{Math.abs(delta)}%</span>
    </div>
  );
}

function AgentDashboard({ tickets, setTickets, onOpen, go }) {
  const push = useToast();
  const me = currentAgentProfile();
  const roster = getTeamRoster();
  const meRec = roster.find((a) => (a.email || "").toLowerCase() === (me.email || "").toLowerCase());
  const roleClass = agdRoleOf(me);

  const [range, setRange] = useState("7d");
  const RANGES3 = [["today", "Today"], ["7d", "Last 7 Days"], ["month", "This Month"]];
  const [tab, setTab] = useState("all");
  const [actAll, setActAll] = useState(false);
  const [newTicket, setNewTicket] = useState(false);

  const personal = tickets.filter((t) => t.agent === me.name);
  const orgView = roleClass === "admin" && personal.length === 0;
  const scope = (orgView ? tickets.filter((t) => !t.trash && !t.spam) : personal);
  const live = scope.filter((t) => t.unresolved);

  const rnd = agdRand(me.name + range);
  const pct = (lo, hi) => Math.round(lo + rnd() * (hi - lo));
  const counts = {
    open: live.filter((t) => t.status === "Open").length,
    dueToday: live.filter((t) => t.sla === "At risk").length,
    overdue: live.filter((t) => t.sla === "Breached").length,
    waiting: live.filter((t) => t.custReplied).length,
    resolvedAll: scope.filter((t) => ["Resolved", "Closed"].includes(t.status)).length,
  };
  const resolvedToday = Math.max(1, Math.round(counts.resolvedAll * 0.4 + rnd() * 3));
  const slaPct = scope.length ? Math.round(((scope.length - counts.overdue) / scope.length) * 100) : pct(92, 98);
  const resRate = scope.length ? Math.round((counts.resolvedAll / scope.length) * 100) : pct(80, 95);
  const csat = (43 + pct(0, 6)) / 10;
  const trend = useMemo(() => {
    const r2 = agdRand(me.name + "t" + range);
    return Array.from({ length: 7 }, (_, i) => ({ d: i, v: Math.round(2 + r2() * (orgView ? 12 : 6)) }));
  }, [me.name, range, orgView]);

  const tabbed = tab === "due" ? live.filter((t) => t.sla === "At risk")
    : tab === "over" ? live.filter((t) => t.sla === "Breached")
    : tab === "rep" ? live.filter((t) => t.custReplied)
    : live;
  const TABS = [["all", `All (${live.length})`], ["due", `Due Today (${counts.dueToday})`], ["over", `Overdue (${counts.overdue})`], ["rep", `Customer Replied (${counts.waiting})`]];

  const activity = personal.slice(0, actAll ? 10 : 5).map((t, i2) => ({
    verb: ["Resolved", "Replied to", "Assigned", "Added note to", "Updated"][i2 % 5],
    id: t.id, when: ["10 min ago", "25 min ago", "1 hour ago", "2 hours ago", "3 hours ago", "4 hours ago", "yesterday", "yesterday", "2 days ago", "2 days ago"][i2], t,
  }));

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const openSearch = () => { try { window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })); } catch (e) { push({ type: "info", title: "Press Ctrl+K to search" }); } };

  return (
    <div className="route agd agd-lite">
      {/* 1 · header */}
      <div className="agd-head">
        <div className="agd-head-l">
          <span className="agd-av sm" style={{ background: avColor(me.name) }}>{initials(me.name)}</span>
          <div>
            <h1>{greet}, {me.name.split(" ")[0]} 👋</h1>
            <p>{me.role || "Support Executive"} • {me.team || me.dept || "Support"} Team{orgView && " • organization view"}</p>
          </div>
        </div>
        <div className="agd-head-r">
          <div className="agd-qa">
            <button className="btn btn-primary btn-sm" onClick={() => setNewTicket(true)}><Plus size={13} /> New Ticket</button>
            <button className="btn btn-soft btn-sm" onClick={openSearch}><Search size={13} /> Search</button>
            <button className="btn btn-soft btn-sm" onClick={() => go && go("tickets")}><Ticket size={13} /> My Tickets</button>
          </div>
          <div className="agd-ranges tight">
            {RANGES3.map(([k, lbl]) => <button key={k} className={`agd-chip ${range === k ? "on" : ""}`} onClick={() => setRange(k)}>{lbl}</button>)}
          </div>
        </div>
      </div>

      {/* 2 · key metrics */}
      <div className="agk-row">
        <AgdKpi icon={Inbox} tone="b" label="My Open Tickets" value={counts.open} delta={pct(-8, 10)} />
        <AgdKpi icon={Clock} tone="o" label="Due Today" value={counts.dueToday} delta={pct(-12, 8)} />
        <AgdKpi icon={AlertCircle} tone="r" label="Overdue" value={counts.overdue} delta={pct(-20, 4)} />
        <AgdKpi icon={CheckCheck} tone="g" label="Resolved Today" value={resolvedToday} delta={pct(4, 22)} />
        <AgdKpi icon={MessageCircle} tone="b" label="Pending Reply" value={counts.waiting} delta={pct(-9, 11)} />
        <AgdKpi icon={ShieldCheck} tone="g" label="SLA Compliance" value={`${slaPct}%`} delta={pct(-2, 5)} />
      </div>

      {/* 3+4 · my tickets + needs attention */}
      <div className="agd-mainrow">
        <div className="card agd-cardc">
          <div className="agd-cardc-head">
            <h3><Ticket size={14} /> My Tickets</h3>
            <button className="agd-link" onClick={() => go && go("tickets")}>View All Tickets →</button>
          </div>
          <div className="agd-tabs">
            {TABS.map(([k, lbl]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{lbl}</button>)}
          </div>
          {tabbed.length ? tabbed.slice(0, 6).map((t) => (
            <div key={t.id} className="agd-trow" onClick={() => onOpen(t)}>
              <div className="agd-trow-main">
                <b>#{t.id}  {t.subject}</b>
                <span>{t.name}{t.custReplied && <> · <i className="rep">Customer replied • {t.repliedAgo}</i></>}</span>
              </div>
              <div className="agd-trow-side">
                <span className="badge-xs" style={{ background: prioStyle(t.priority).bg, color: prioStyle(t.priority).fg }}>{t.priority}</span>
                <span className="badge-xs" style={{ background: statusStyle(t.status).bg, color: statusStyle(t.status).fg }}>{t.status}</span>
                <span className={`agd-due ${t.sla === "Breached" ? "r" : t.sla === "At risk" ? "o" : ""}`}>{t.sla === "Breached" ? "Overdue" : `Due ${t.firstResp}`}</span>
              </div>
            </div>
          )) : <div className="agd-empty"><CheckCircle2 size={17} /> Nothing here — you're all caught up.</div>}
        </div>

        <div className="card agd-cardc">
          <div className="agd-cardc-head"><h3><AlertCircle size={14} /> Needs Attention</h3></div>
          <button className="agd-natt r" onClick={() => setTab("over")}><span className="d" /> <b>{counts.overdue}</b> Overdue</button>
          <button className="agd-natt o" onClick={() => setTab("due")}><span className="d" /> <b>{counts.dueToday}</b> SLA due soon</button>
          <button className="agd-natt b" onClick={() => setTab("rep")}><span className="d" /> <b>{counts.waiting}</b> Customer replies</button>
          <div className="agd-natt-note">Tap a row to filter My Tickets.</div>
        </div>
      </div>

      {/* 5+6 · performance + activity */}
      <div className="agd-subrow">
        <div className="card agd-cardc">
          <div className="agd-cardc-head">
            <h3><Gauge size={14} /> My Performance</h3>
            <button className="agd-link" onClick={() => go && go("reports")}>View Detailed Performance →</button>
          </div>
          <div className="agd-perfc">
            <div><span>Resolved</span><b>{counts.resolvedAll}</b></div>
            <div><span>Resolution</span><b>{resRate}%</b></div>
            <div><span>CSAT</span><b>{csat.toFixed(1)} <i>★</i></b></div>
            <div><span>SLA</span><b>{slaPct}%</b></div>
          </div>
          <ResponsiveContainer width="100%" height={64}>
            <LineChart data={trend} margin={{ top: 6, bottom: 0, left: 0, right: 0 }}>
              <Line type="monotone" dataKey="v" stroke="var(--primary)" strokeWidth={2} dot={false} />
              <Tooltip contentStyle={{ borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 11 }} labelFormatter={() => "Resolved"} />
            </LineChart>
          </ResponsiveContainer>
          <span className="agd-spark-lbl">Resolution trend · {RANGES3.find((r) => r[0] === range)[1]}</span>
        </div>

        <div className="card agd-cardc">
          <div className="agd-cardc-head">
            <h3><History size={14} /> Today's Activity</h3>
            <button className="agd-link" onClick={() => setActAll((x) => !x)}>{actAll ? "Show Less" : "View All Activity →"}</button>
          </div>
          {activity.length ? activity.map((a, i2) => (
            <div key={i2} className="agd-actc" onClick={() => onOpen(a.t)}>
              <span className="dot" />
              <span>{a.verb} <b>#{a.id}</b></span>
              <i>{a.when}</i>
            </div>
          )) : <div className="agd-empty"><History size={16} /> No activity yet today.</div>}
        </div>
      </div>

      <TicketModal open={newTicket} onClose={() => setNewTicket(false)} />
    </div>
  );
}

/* ============================================================================
   REPORTS & ANALYTICS CENTER
   ========================================================================== */
const RA_DATE_PRESETS = ["Today","Yesterday","Last 7 Days","Last 30 Days","Last 90 Days","This Month","Previous Month","This Year","Custom"];
const RA_STATUSES = ["Open","Pending","Resolved","Closed"];
const RA_SLA = ["Within SLA","Breached"];
const RA_RESTIME = ["Under 1 Hour","1-4 Hours","4-24 Hours","More than 1 Day"];
const RA_SPARK = [4,7,5,9,8,12,10];

function raSpark(seed) {
  return RA_SPARK.map((v, i) => ({ i, v: Math.max(1, Math.round(v * (0.6 + ((seed * 7 + i * 3) % 10) / 10))) }));
}

function RaKpi({ icon: Ic, color, label, value, delta, spark }) {
  const up = (delta || 0) >= 0;
  const numeric = typeof value === "number";
  const counted = useCounter(numeric ? value : 0);
  const shown = numeric ? counted.toLocaleString("en-IN") : value;
  return (
    <div className="card ra-kpi">
      <div className="ra-kpi-top">
        <span className="ic" style={{ background: `${color}18`, color }}><Ic size={17} /></span>
        <span className="trend" style={{ color: up ? "var(--success)" : "var(--danger)" }}>
          {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(delta)}%
        </span>
      </div>
      <div className="val">{shown}</div>
      <div className="lab">{label}</div>
      <div className="ra-spark">
        <ResponsiveContainer width="100%" height={34}>
          <AreaChart data={spark} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
            <defs><linearGradient id={`sg-${label.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".35" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
            <Area dataKey="v" stroke={color} strokeWidth={1.6} fill={`url(#sg-${label.replace(/\W/g, "")})`} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RaSection({ icon: Ic, title, sub, right, children, pad = true }) {
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div style={{ padding: pad ? "18px 20px 0" : "18px 20px 12px" }}>
        <div className="section-head" style={{ marginBottom: pad ? 14 : 0 }}>
          <div><h3 className="card-title">{Ic && <Ic size={15} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--primary)" }} />}{title}</h3>{sub && <p className="card-sub">{sub}</p>}</div>
          {right}
        </div>
      </div>
      {children}
    </div>
  );
}

function ReportsPage({ tickets }) {
  const push = useToast();
  const [range, setRange] = useState("Last 30 Days");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [fStatus, setFStatus] = useState([]);
  const [fPriority, setFPriority] = useState([]);
  const [fType, setFType] = useState([]);
  const [fCat, setFCat] = useState([]);
  const [fAgent, setFAgent] = useState("All Agents");
  const [fTeam, setFTeam] = useState("All Teams");
  const [fCust, setFCust] = useState("");
  const [fSla, setFSla] = useState([]);
  const [fSource, setFSource] = useState([]);
  const [fRes, setFRes] = useState([]);
  const [applied, setApplied] = useState(0);
  const [savedFilters, setSavedFilters] = useState(() => { try { return JSON.parse(localStorage.getItem("hh-report-filters") || "[]"); } catch { return []; } });
  const [histSearch, setHistSearch] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [schedule, setSchedule] = useState({ enabled: false, freq: "Weekly", recipients: "founder@internshipstudio.com", subject: "HelpHive Scheduled Report", type: "Ticket Report" });
  const [history, setHistory] = useState([
    { id: "h1", name: "Ticket Report — July", by: "Hemani Raina", at: Date.now() - 36e5, filters: "Last 30 Days · All agents", type: "XLSX", size: "84 KB" },
    { id: "h2", name: "Agent Performance — Q2", by: "Priya Nair", at: Date.now() - 864e5, filters: "Last 90 Days", type: "PDF", size: "1.2 MB" },
    { id: "h3", name: "SLA Compliance — Week 30", by: "Aisha Khan", at: Date.now() - 2 * 864e5, filters: "Last 7 Days · SLA Breached", type: "CSV", size: "18 KB" },
  ]);

  const toggleIn = (setter) => (v) => setter((xs) => xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]);

  const filtered = useMemo(() => (tickets || []).filter((t) => {
    if (fStatus.length && !fStatus.includes(t.status)) return false;
    if (fPriority.length && !fPriority.includes(t.priority)) return false;
    if (fCat.length && !fCat.includes(t.category)) return false;
    if (fAgent !== "All Agents" && t.agent !== fAgent) return false;
    if (fCust.trim() && !`${t.name} ${t.email}`.toLowerCase().includes(fCust.toLowerCase())) return false;
    if (fSla.length) { const br = t.sla === "Breached"; if (!fSla.includes(br ? "Breached" : "Within SLA")) return false; }
    if (fSource.length && !fSource.includes(t.source)) return false;
    return true;
  }), [tickets, applied]);

  // KPI numbers derived from filtered data (fall back to plausible dummies)
  const n = filtered.length;
  const cnt = (st) => filtered.filter((t) => t.status === st).length;
  const overdue = filtered.filter((t) => t.status === "Overdue" || t.sla === "Breached").length;
  const resolved = cnt("Resolved") + cnt("Closed");
  const kpis = [
    { icon: Ticket, color: "#5B5CEB", label: "Total Tickets", value: n, delta: 12 },
    { icon: Inbox, color: "#0EA5E9", label: "Open Tickets", value: cnt("Open") + cnt("New"), delta: 4 },
    { icon: CheckCheck, color: "#64748B", label: "Closed Tickets", value: cnt("Closed"), delta: 6 },
    { icon: Clock, color: "#F59E0B", label: "Pending Tickets", value: cnt("Pending"), delta: -3 },
    { icon: CheckCircle2, color: "#10B981", label: "Resolved Tickets", value: cnt("Resolved"), delta: 9 },
    { icon: AlertTriangle, color: "#EF4444", label: "Overdue Tickets", value: overdue, delta: -5 },
    { icon: CalendarDays, color: "#8B5CF6", label: "Received Today", value: Math.max(3, Math.round(n * 0.18)), delta: 14 },
    { icon: CalendarClock, color: "#EC4899", label: "Received This Month", value: Math.max(n, Math.round(n * 4.2)), delta: 11 },
    { icon: Timer, color: "#06B6D4", label: "Avg Response Time", value: "26m", delta: -9 },
    { icon: Gauge, color: "#F97316", label: "Avg Resolution Time", value: "3h 40m", delta: -6 },
    { icon: Smile, color: "#84CC16", label: "CSAT Score", value: "93%", delta: 3 },
    { icon: CheckCircle2, color: "#14B8A6", label: "SLA Compliance", value: n ? Math.round(((n - overdue) / n) * 100) + "%" : "92%", delta: 2 },
  ];

  // Chart data (respect filters)
  const trend = ANALYTICS.Week.map((d) => ({ ...d }));
  const catPie = TICKET_CATS.map((c, i) => ({ name: c, value: filtered.filter((t) => t.category === c).length || (i % 4) + 1, color: ["#5B5CEB", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#64748B"][i] }));
  const prioBar = BULK_PRIORITY.map((p, i) => ({ name: p, value: filtered.filter((t) => t.priority === p).length || (i + 1) * 2, color: ["#10B981", "#0EA5E9", "#F59E0B", "#EF4444"][i] }));
  const agentPerf = AGENTS.filter((a) => a !== "Unassigned").map((a, i) => {
    const assigned = filtered.filter((t) => t.agent === a).length || 8 + (i * 5) % 14;
    const closed = Math.max(1, Math.round(assigned * [0.85, 0.78, 0.92, 0.7, 0.8][i % 5]));
    return { name: a.split(" ")[0], full: a, assigned, closed, rate: Math.round((closed / assigned) * 100), avgResp: [24, 32, 18, 41, 29][i % 5] + "m", avgRes: ["3h 20m", "4h 05m", "2h 45m", "5h 12m", "3h 55m"][i % 5], rating: [4.8, 4.4, 4.9, 4.0, 4.3][i % 5] };
  });
  const csat = 93;
  const gaugeData = [{ name: "score", value: csat, color: "#10B981" }, { name: "rest", value: 100 - csat, color: "var(--surface-2)" }];
  const slaBars = [
    { label: "First Response SLA", pct: 92, color: "#10B981" },
    { label: "Resolution SLA", pct: 86, color: "#0EA5E9" },
    { label: "Next Response SLA", pct: 89, color: "#8B5CF6" },
    { label: "Overall Compliance", pct: n ? Math.round(((n - overdue) / n) * 100) : 92, color: "#F59E0B" },
  ];
  const resArea = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => ({ d, hrs: [3.6, 4.1, 3.2, 3.9, 3.4, 4.6, 3.8][i] }));
  const monthlyStack = ANALYTICS.Month.map((m) => ({ d: m.d, Resolved: m.Resolved, Pending: Math.max(2, m.Received - m.Resolved) }));
  const deptDonut = DEPTS.map((d, i) => ({ name: d, value: filtered.filter((t) => t.dept === d).length || (i + 2), color: ["#5B5CEB", "#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6"][i] }));

  const applyFilters = () => { setApplied((x) => x + 1); push({ type: "success", title: "Filters applied", desc: `${filtered.length} tickets in scope` }); };
  const resetFilters = () => { setFStatus([]); setFPriority([]); setFType([]); setFCat([]); setFAgent("All Agents"); setFTeam("All Teams"); setFCust(""); setFSla([]); setFSource([]); setFRes([]); setRange("Last 30 Days"); setFrom(""); setTo(""); setApplied((x) => x + 1); push({ type: "info", title: "Filters reset" }); };
  const saveFilter = () => {
    const name = prompt("Name this filter set:", `${range} · ${fAgent}`); if (!name) return;
    const f = { name, range, from, to, fStatus, fPriority, fType, fCat, fAgent, fTeam, fCust, fSla, fSource, fRes };
    const next = [...savedFilters.filter((x) => x.name !== name), f];
    setSavedFilters(next); localStorage.setItem("hh-report-filters", JSON.stringify(next));
    push({ type: "success", title: "Filter saved", desc: name });
  };
  const loadFilter = (f) => {
    setRange(f.range); setFrom(f.from); setTo(f.to); setFStatus(f.fStatus); setFPriority(f.fPriority); setFType(f.fType); setFCat(f.fCat); setFAgent(f.fAgent); setFTeam(f.fTeam); setFCust(f.fCust); setFSla(f.fSla); setFSource(f.fSource); setFRes(f.fRes); setApplied((x) => x + 1);
    push({ type: "success", title: "Filter loaded", desc: f.name });
  };

  const filterDesc = () => [range, fAgent !== "All Agents" ? fAgent : null, fStatus.join("/") || null, fPriority.join("/") || null].filter(Boolean).join(" · ");

  const ticketRows = () => filtered.map((t) => ({ "Ticket ID": t.id, "Customer Name": t.name, Subject: t.subject, Status: t.status, Priority: t.priority, Agent: t.agent, Team: t.dept, "Created Date": t.created, "Closed Date": ["Resolved", "Closed"].includes(t.status) ? t.lastActivity : "—", "Resolution Time": t.resolution || "—", "SLA Status": t.sla === "Breached" ? "Breached" : "Within SLA", Source: t.source, Category: t.category }));
  const agentRows = () => agentPerf.map((a) => ({ Agent: a.full, "Tickets Assigned": a.assigned, "Tickets Closed": a.closed, "Resolution Rate": a.rate + "%", "Avg Response Time": a.avgResp, "Avg Resolution Time": a.avgRes, "Customer Rating": a.rating }));
  const customerRows = () => {
    const byC = {};
    filtered.forEach((t) => { byC[t.email] = byC[t.email] || { "Customer Name": t.name, Email: t.email, Phone: t.phone || "—", "Total Tickets": 0, "Open Tickets": 0, "Closed Tickets": 0, "Last Activity": t.lastActivity }; byC[t.email]["Total Tickets"]++; if (["Open", "New", "Pending"].includes(t.status)) byC[t.email]["Open Tickets"]++; if (["Resolved", "Closed"].includes(t.status)) byC[t.email]["Closed Tickets"]++; });
    return Object.values(byC);
  };
  const teamRows = () => DEPTS.map((d, i) => { const tt = filtered.filter((t) => t.dept === d); const res = tt.filter((t) => ["Resolved", "Closed"].includes(t.status)).length; return { Team: d, "Total Tickets": tt.length || (i + 3), "Resolution Rate": (tt.length ? Math.round((res / tt.length) * 100) : 78 + i * 3) + "%", "SLA Compliance": 84 + ((i * 5) % 12) + "%" }; });
  const kpiRows = () => kpis.map((k) => ({ Metric: k.label, Value: String(k.value), "Change %": (k.delta >= 0 ? "+" : "") + k.delta + "%" }));

  const logHistory = (name, type, rows) => setHistory((h) => [{ id: "h" + Date.now(), name, by: "Hemani Raina", at: Date.now(), filters: filterDesc(), type, size: Math.max(6, Math.round(JSON.stringify(rows).length / 1024)) + " KB" }, ...h]);

  const generate = (name, rows, fmt) => {
    if (!rows.length) { push({ type: "error", title: "Nothing to export", desc: "No data matches the current filters." }); return; }
    const stem = name.toLowerCase().replace(/[^\w]+/g, "-");
    if (fmt === "xlsx") exportExcel(rows, `${stem}.xlsx`);
    else if (fmt === "csv") exportCSV(rows, `${stem}.csv`);
    else if (fmt === "pptx") { downloadBlob(JSON.stringify({ deck: name, slides: rows.slice(0, 20) }, null, 2), `${stem}.pptx.json`, "application/json"); }
    else { const ok = exportPDF(name, Object.keys(rows[0]), rows); if (!ok) { push({ type: "error", title: "Popup blocked", desc: "Allow popups to export PDF." }); return; } }
    logHistory(name, fmt.toUpperCase(), rows);
    push({ type: "success", title: "Report Generated Successfully", desc: name });
    setTimeout(() => push({ type: "info", title: "Download Started", desc: `${stem}.${fmt}` }), 400);
  };

  const QUICK = [
    ["Open Tickets Report", () => filtered.filter((t) => ["Open", "New"].includes(t.status)), Inbox, "#0EA5E9"],
    ["Closed Tickets Report", () => filtered.filter((t) => t.status === "Closed"), CheckCheck, "#64748B"],
    ["Pending Tickets Report", () => filtered.filter((t) => t.status === "Pending"), Clock, "#F59E0B"],
    ["Refund Report", () => filtered.filter((t) => /refund|payment|billing/i.test(t.subject + t.category)), Ticket, "#F97316"],
    ["Attendance Report", () => filtered.filter((t) => t.category === "Attendance"), CalendarDays, "#06B6D4"],
    ["Internship Report", () => filtered.filter((t) => t.category === "Internship"), GraduationCap, "#84CC16"],
    ["Billing Report", () => filtered.filter((t) => t.category === "Billing"), FileSpreadsheet, "#EC4899"],
    ["Technical Issues Report", () => filtered.filter((t) => t.category === "Technical"), Settings, "#8B5CF6"],
    ["Placement Report", () => filtered.filter((t) => t.category === "Placement"), Briefcase, "#5B5CEB"],
    ["Agent Performance Report", () => null, UsersRound, "#10B981"],
  ];

  const EXPORT_CENTER = [
    ["Entire Dashboard", () => kpiRows()], ["Analytics", () => kpiRows()], ["Filtered Tickets", () => ticketRows()],
    ["Filtered Customers", () => customerRows()], ["Agent Reports", () => agentRows()], ["Team Reports", () => teamRows()],
    ["Automation Reports", () => [{ Module: "Canned Responses", Status: "Active", Runs: 148 }, { Module: "Auto-Closure", Status: "Active", Runs: 62 }, { Module: "Email Forwarding", Status: "Active", Runs: 210 }, { Module: "Tagged Notifications", Status: "Paused", Runs: 34 }]],
    ["Audit Logs", () => [{ Time: "10:42", User: "Hemani Raina", Action: "Exported ticket report" }, { Time: "09:15", User: "Priya Nair", Action: "Updated SLA policy" }]],
    ["Knowledge Base Statistics", () => [{ Article: "Reset password", Views: 1240, Helpful: "92%" }, { Article: "Certificate download", Views: 980, Helpful: "88%" }]],
    ["Settings Backup", () => [{ Section: "General", Items: 12 }, { Section: "Email", Items: 9 }, { Section: "Roles", Items: 6 }]],
  ];

  const histFiltered = history.filter((h) => !histSearch.trim() || `${h.name} ${h.by}`.toLowerCase().includes(histSearch.toLowerCase()));

  const FilterChipGroup = ({ label, options, sel, toggle }) => (
    <div className="fld">
      <label>{label}</label>
      <div className="chips">{options.map((o) => <button key={o} className={`fchip ${sel.includes(o) ? "on" : ""}`} onClick={() => toggle(o)}>{o}</button>)}</div>
    </div>
  );

  return (
    <div className="content route">
      <div className="page-head">
        <div>
          <h1>Reports & Analytics <span className="count-badge">{filtered.length} tickets in scope</span></h1>
          <p>Generate, filter, analyse and download reports across your entire support operation.</p>
        </div>
      </div>

      {/* ===== KPI DASHBOARD ===== */}
      <div className="ra-kpi-grid">
        {kpis.map((k, i) => <RaKpi key={k.label} {...k} spark={raSpark(i)} />)}
      </div>

      {/* ===== FILTER PANEL ===== */}
      <RaSection icon={Filter} title="Report Filters" sub="Every chart, download and export below respects these filters."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-soft btn-sm" onClick={saveFilter}><Save size={13} /> Save Filter</button>
          {savedFilters.length > 0 && (
            <select className="fchip" style={{ padding: "7px 10px" }} value="" onChange={(e) => { const f = savedFilters.find((x) => x.name === e.target.value); if (f) loadFilter(f); }}>
              <option value="" disabled>Load Saved Filter…</option>
              {savedFilters.map((f) => <option key={f.name}>{f.name}</option>)}
            </select>
          )}
          <button className="btn btn-ghost btn-sm" onClick={resetFilters}><RotateCcw size={13} /> Reset</button>
          <button className="btn btn-primary btn-sm" onClick={applyFilters}><Filter size={13} /> Apply Filters</button>
        </div>}>
        <div style={{ padding: "0 20px 20px" }}>
          <div className="fld" style={{ marginBottom: 12 }}>
            <label>Date Range</label>
            <div className="chips">{RA_DATE_PRESETS.map((p) => <button key={p} className={`fchip ${range === p ? "on" : ""}`} onClick={() => setRange(p)}><CalendarDays size={12} /> {p}</button>)}</div>
            {range === "Custom" && (<div className="set-grid2" style={{ marginTop: 10 }}>
              <div className="fld"><label>From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="fld"><label>To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </div>)}
          </div>
          <div className="ra-filter-grid">
            <FilterChipGroup label="Ticket Status" options={RA_STATUSES} sel={fStatus} toggle={toggleIn(setFStatus)} />
            <FilterChipGroup label="Priority" options={BULK_PRIORITY} sel={fPriority} toggle={toggleIn(setFPriority)} />
            <FilterChipGroup label="Ticket Type" options={TICKET_TYPES} sel={fType} toggle={toggleIn(setFType)} />
            <FilterChipGroup label="Category" options={TICKET_CATS} sel={fCat} toggle={toggleIn(setFCat)} />
            <FilterChipGroup label="SLA Status" options={RA_SLA} sel={fSla} toggle={toggleIn(setFSla)} />
            <FilterChipGroup label="Ticket Source" options={SOURCES} sel={fSource} toggle={toggleIn(setFSource)} />
            <FilterChipGroup label="Resolution Time" options={RA_RESTIME} sel={fRes} toggle={toggleIn(setFRes)} />
            <div className="fld"><label>Assigned Agent</label><select value={fAgent} onChange={(e) => setFAgent(e.target.value)}><option>All Agents</option>{AGENTS.map((a) => <option key={a}>{a}</option>)}</select></div>
            <div className="fld"><label>Team</label><select value={fTeam} onChange={(e) => setFTeam(e.target.value)}><option>All Teams</option>{SET_TEAMS.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="fld"><label>Customer</label><input placeholder="Search customer name or email…" value={fCust} onChange={(e) => setFCust(e.target.value)} /></div>
          </div>
        </div>
      </RaSection>

      {/* ===== ANALYTICS ===== */}
      <div className="ra-2col">
        <RaSection icon={LineChartIcon} title="Ticket Trend" sub="Received vs resolved vs pending">
          <div style={{ height: 250, padding: "0 12px 16px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="Received" stroke="#0EA5E9" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line dataKey="Resolved" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line dataKey="Pending" stroke="#F59E0B" strokeWidth={2} dot={{ r: 2.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </RaSection>
        <RaSection icon={PieChartIcon} title="Ticket Categories" sub="Share of tickets by category">
          <div style={{ height: 250, padding: "0 12px 16px", display: "flex", alignItems: "center" }}>
            <ResponsiveContainer width="55%" height="100%">
              <PieChart><Pie data={catPie} dataKey="value" nameKey="name" innerRadius={0} outerRadius={88} paddingAngle={1} stroke="none">{catPie.map((d) => <Cell key={d.name} fill={d.color} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: "grid", gap: 5 }}>
              {catPie.map((d) => <div key={d.name} className="dist-row"><span className="dotc" style={{ background: d.color, width: 9, height: 9 }} /><span className="nm">{d.name}</span><span className="ct">{d.value}</span></div>)}
            </div>
          </div>
        </RaSection>
      </div>

      <div className="ra-2col">
        <RaSection icon={BarChart3} title="Priority Distribution">
          <div style={{ height: 240, padding: "0 12px 16px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={prioBar} barSize={30}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>{prioBar.map((d) => <Cell key={d.name} fill={d.color} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </RaSection>
        <RaSection icon={UsersRound} title="Agent Performance" sub="Assigned vs closed with resolution rate">
          <div style={{ height: 240, padding: "0 12px 16px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agentPerf} layout="vertical" barSize={10} margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={54} />
                <Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="assigned" name="Assigned" fill="#0EA5E9" radius={[0, 4, 4, 0]} />
                <Bar dataKey="closed" name="Closed" fill="#10B981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </RaSection>
      </div>

      <div className="ra-3col">
        <RaSection icon={Smile} title="Customer Satisfaction">
          <div style={{ padding: "0 16px 18px", textAlign: "center" }}>
            <div style={{ height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={gaugeData} dataKey="value" startAngle={180} endAngle={0} innerRadius={58} outerRadius={80} stroke="none" cy="90%">
                    <Cell fill="#10B981" /><Cell fill="var(--surface-2)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: -46 }}>{csat}%</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>1,284 responses · NPS 61</div>
          </div>
        </RaSection>
        <RaSection icon={Gauge} title="SLA Performance">
          <div style={{ padding: "0 20px 18px", display: "grid", gap: 12 }}>
            {slaBars.map((s) => (
              <div key={s.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 5 }}><span>{s.label}</span><span style={{ color: s.color }}>{s.pct}%</span></div>
                <div style={{ height: 8, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}><div style={{ width: s.pct + "%", height: "100%", background: s.color, borderRadius: 4, transition: "width .6s cubic-bezier(.4,0,.2,1)" }} /></div>
              </div>
            ))}
          </div>
        </RaSection>
        <RaSection icon={Timer} title="Avg Resolution Time" sub="Hours per day">
          <div style={{ height: 172, padding: "0 12px 16px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={resArea}>
                <defs><linearGradient id="ra-res" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06B6D4" stopOpacity=".4" /><stop offset="100%" stopColor="#06B6D4" stopOpacity="0" /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area dataKey="hrs" name="Hours" stroke="#06B6D4" strokeWidth={2.5} fill="url(#ra-res)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </RaSection>
      </div>

      <div className="ra-2col">
        <RaSection icon={BarChart3} title="Monthly Ticket Comparison" sub="Resolved vs pending, stacked by month">
          <div style={{ height: 250, padding: "0 12px 16px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyStack} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Resolved" stackId="m" fill="#10B981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Pending" stackId="m" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </RaSection>
        <RaSection icon={PieChartIcon} title="Tickets by Department">
          <div style={{ height: 250, padding: "0 12px 16px", display: "flex", alignItems: "center" }}>
            <ResponsiveContainer width="55%" height="100%">
              <PieChart><Pie data={deptDonut} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={2} stroke="none">{deptDonut.map((d) => <Cell key={d.name} fill={d.color} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: "grid", gap: 6 }}>
              {deptDonut.map((d) => <div key={d.name} className="dist-row"><span className="dotc" style={{ background: d.color, width: 9, height: 9 }} /><span className="nm">{d.name}</span><span className="ct">{d.value}</span></div>)}
            </div>
          </div>
        </RaSection>
      </div>

      {/* ===== DOWNLOAD REPORTS ===== */}
      <RaSection icon={Download} title="Download Reports" sub="Generate polished reports from the current filter scope." pad={false}>
        <div className="ra-dl-grid">
          {[
            { t: "Ticket Report", d: "Complete ticket export — ID, customer, status, priority, agent, SLA and more.", icon: Ticket, color: "#5B5CEB", rows: ticketRows, fmts: ["xlsx", "csv", "pdf"] },
            { t: "Analytics Report", d: "KPIs, charts and summary in one deck-style export.", icon: BarChart3, color: "#0EA5E9", rows: kpiRows, fmts: ["pdf", "pptx", "xlsx"] },
            { t: "Agent Performance Report", d: "Assigned, closed, response & resolution time, ratings.", icon: UsersRound, color: "#10B981", rows: agentRows, fmts: ["xlsx", "pdf"] },
            { t: "Customer Report", d: "Customer contact details and ticket counts.", icon: Users, color: "#F59E0B", rows: customerRows, fmts: ["xlsx", "csv", "pdf"] },
            { t: "Team Performance Report", d: "Team-wise volume, resolution rate and SLA compliance.", icon: UserCheck, color: "#8B5CF6", rows: teamRows, fmts: ["xlsx", "pdf"] },
            { t: "Daily Report", d: "Auto-generated summary for today.", icon: CalendarDays, color: "#06B6D4", rows: () => ticketRows().slice(0, 6), fmts: ["pdf", "xlsx"] },
            { t: "Weekly Report", d: "Auto-generated weekly summary.", icon: CalendarClock, color: "#EC4899", rows: () => ticketRows().slice(0, 12), fmts: ["pdf", "xlsx"] },
            { t: "Monthly Report", d: "Auto-generated monthly summary.", icon: History, color: "#F97316", rows: ticketRows, fmts: ["pdf", "xlsx"] },
            { t: "Custom Report", d: "Exactly what your current filters select — nothing more.", icon: Filter, color: "#14B8A6", rows: ticketRows, fmts: ["xlsx", "csv", "pdf"] },
          ].map((c) => (
            <div key={c.t} className="card ra-dl-card">
              <span className="ic" style={{ background: `${c.color}18`, color: c.color }}><c.icon size={19} /></span>
              <h4>{c.t}</h4><p>{c.d}</p>
              <div className="fmt-row">{c.fmts.map((f) => (
                <button key={f} className="btn btn-soft btn-sm" onClick={() => generate(c.t, c.rows() || [], f)}>
                  {f === "xlsx" ? <FileSpreadsheet size={13} /> : f === "csv" ? <FileText size={13} /> : f === "pptx" ? <Monitor size={13} /> : <Printer size={13} />} {f.toUpperCase()}
                </button>))}
              </div>
            </div>
          ))}
        </div>
      </RaSection>

      {/* ===== QUICK REPORT GENERATOR ===== */}
      <RaSection icon={Sparkles} title="Quick Report Generator" sub="One click → instant Excel download, scoped to current filters." pad={false}>
        <div className="ra-quick">
          {QUICK.map(([label, rowsFn, Ic, color]) => (
            <button key={label} className="ra-quick-btn" onClick={() => {
              const r = label === "Agent Performance Report" ? agentRows() : (rowsFn() || []).map((t) => ({ "Ticket ID": t.id, Customer: t.name, Subject: t.subject, Status: t.status, Priority: t.priority, Agent: t.agent }));
              generate(label, r, "xlsx");
            }}>
              <span className="ic" style={{ background: `${color}18`, color }}><Ic size={15} /></span>{label}
            </button>
          ))}
        </div>
      </RaSection>

      {/* ===== SCHEDULED REPORTS + EXPORT CENTER ===== */}
      <div className="ra-2col">
        <RaSection icon={CalendarClock} title="Scheduled Reports" sub="Deliver reports to your inbox automatically."
          right={<button className={`btn btn-sm ${schedule.enabled ? "btn-soft" : "btn-primary"}`} onClick={() => { setSchedule((s) => ({ ...s, enabled: !s.enabled })); push({ type: schedule.enabled ? "info" : "success", title: schedule.enabled ? "Schedule disabled" : "Schedule enabled", desc: schedule.enabled ? undefined : `${schedule.freq} · ${schedule.type}` }); }}>{schedule.enabled ? <><X size={13} /> Disable Schedule</> : <><CheckCircle2 size={13} /> Enable Schedule</>}</button>}>
          <div style={{ padding: "0 20px 20px" }}>
            {schedule.enabled && <div className="fchip on" style={{ marginBottom: 12, cursor: "default", display: "inline-flex" }}><CheckCircle2 size={12} /> Active — {schedule.freq}, next run Monday 09:00 IST</div>}
            <div className="set-grid2">
              <div className="fld"><label>Frequency</label><select value={schedule.freq} onChange={(e) => setSchedule((s) => ({ ...s, freq: e.target.value }))}>{["Daily", "Weekly", "Monthly"].map((o) => <option key={o}>{o}</option>)}</select></div>
              <div className="fld"><label>Report Type</label><select value={schedule.type} onChange={(e) => setSchedule((s) => ({ ...s, type: e.target.value }))}>{["Ticket Report", "Analytics Report", "Agent Performance Report", "Customer Report", "Team Performance Report"].map((o) => <option key={o}>{o}</option>)}</select></div>
            </div>
            <div className="fld"><label>Email Recipients</label><input value={schedule.recipients} onChange={(e) => setSchedule((s) => ({ ...s, recipients: e.target.value }))} placeholder="comma separated emails" /></div>
            <div className="fld"><label>Subject</label><input value={schedule.subject} onChange={(e) => setSchedule((s) => ({ ...s, subject: e.target.value }))} /></div>
          </div>
        </RaSection>

        <RaSection icon={Upload} title="Export Center" sub="Export any module of the workspace." pad={false}>
          <div style={{ padding: "0 20px 20px", display: "grid", gap: 8 }}>
            {EXPORT_CENTER.map(([label, rowsFn]) => (
              <div key={label} className="set-row" style={{ alignItems: "center" }}>
                <span className="pic" style={{ background: "var(--primary-soft)", color: "var(--primary)", width: 32, height: 32 }}><FileDown size={14} /></span>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{label}</div>
                <div style={{ display: "flex", gap: 5 }}>
                  {["xlsx", "csv", "pdf", "pptx"].map((f) => <button key={f} className="fchip" onClick={() => generate(label, rowsFn(), f)}>{f.toUpperCase()}</button>)}
                </div>
              </div>
            ))}
          </div>
        </RaSection>
      </div>

      {/* ===== REPORT HISTORY ===== */}
      <RaSection icon={History} title="Report History" sub="Previously generated reports."
        right={<div className="searchbox" style={{ maxWidth: 240, width: 240, flex: "initial" }}><Search size={15} /><input placeholder="Search by name, author…" value={histSearch} onChange={(e) => setHistSearch(e.target.value)} /></div>} pad={false}>
        {histFiltered.length === 0 ? <div style={{ padding: "0 20px 22px" }}><EmptyState icon={History} title="No reports found" desc="Generate a report above and it will appear here." /></div> : (
          <div className="table-wrap"><table style={{ minWidth: 860 }}>
            <thead><tr><th>Report Name</th><th>Generated By</th><th>Generated Date</th><th>Filters Used</th><th>File Type</th><th>Size</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
            <tbody>{histFiltered.map((h) => (
              <tr key={h.id}>
                <td className="rname">{h.name}</td>
                <td style={{ fontSize: 12.5 }}>{h.by}</td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{new Date(h.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{h.filters || "—"}</td>
                <td><span className="fchip" style={{ cursor: "default" }}>{h.type}</span></td>
                <td style={{ fontSize: 12 }}>{h.size}</td>
                <td><div className="row-act" style={{ justifyContent: "flex-end" }}>
                  <button title="Download" onClick={() => { generate(h.name, ticketRows(), h.type.toLowerCase() === "pdf" ? "pdf" : h.type.toLowerCase() === "csv" ? "csv" : "xlsx"); }}><Download size={15} /></button>
                  <button title="Rename" onClick={() => { const n2 = prompt("Rename report:", h.name); if (n2) { setHistory((hs) => hs.map((x) => x.id === h.id ? { ...x, name: n2 } : x)); push({ type: "success", title: "Renamed", desc: n2 }); } }}><Pencil size={15} /></button>
                  <button title="Regenerate" onClick={() => generate(h.name + " (regenerated)", ticketRows(), "xlsx")}><RotateCcw size={15} /></button>
                  <button className="danger" title="Delete" onClick={() => setConfirm({ title: "Delete report", msg: `Delete “${h.name}” from history?`, label: "Delete", danger: true, run: () => { setHistory((hs) => hs.filter((x) => x.id !== h.id)); push({ type: "success", title: "Report deleted" }); } })}><Trash2 size={15} /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </RaSection>

      <ConfirmDialog open={!!confirm} danger={confirm?.danger} title={confirm?.title || ""} message={confirm?.msg || ""} confirmLabel={confirm?.label || "Confirm"} onConfirm={() => confirm?.run()} onClose={() => setConfirm(null)} />
    </div>
  );
}

/* ============================================================================
   PREMIUM EXPERIENCE LAYER — confetti, insights, palette, assistant
   ========================================================================== */
function fireConfetti() {
  try {
    const host = document.createElement("div");
    host.className = "confetti-host";
    const colors = ["#5B5CEB", "#0EA5E9", "#22C55E", "#F59E0B", "#EF4444", "#EC4899", "#8B5CF6"];
    for (let i = 0; i < 28; i++) {
      const p = document.createElement("i");
      p.style.left = 45 + Math.random() * 10 + "%";
      p.style.background = colors[i % colors.length];
      p.style.setProperty("--dx", (Math.random() * 2 - 1) * 240 + "px");
      p.style.setProperty("--dy", -(120 + Math.random() * 260) + "px");
      p.style.setProperty("--rz", Math.random() * 720 - 360 + "deg");
      p.style.animationDelay = Math.random() * 0.12 + "s";
      host.appendChild(p);
    }
    document.body.appendChild(host);
    setTimeout(() => host.remove(), 1700);
  } catch (e) {}
}

const DASH_INSIGHTS = [
  { icon: TrendingUp, color: "#0EA5E9", text: "Ticket volume increased by 18% this week — mostly from the Portal channel." },
  { icon: Timer, color: "#22C55E", text: "Average response time improved by 12% after the new canned responses went live." },
  { icon: BookOpen, color: "#8B5CF6", text: "Most support requests this week relate to certificates — consider a KB article." },
  { icon: Sparkles, color: "#F59E0B", text: "Priya Nair resolved 96% of assigned tickets — highest on the team." },
  { icon: AlertTriangle, color: "#EF4444", text: "Billing requests are trending upward today (+9 vs yesterday)." },
];

function DashLiveRow({ onOpenTickets }) {
  const [insight, setInsight] = useState(0);
  const [feed, setFeed] = useState([
    { icon: Inbox, color: "#0EA5E9", t: "New ticket #336291 from Sana Shaikh", when: "just now" },
    { icon: MessageSquareText, color: "#5B5CEB", t: "Customer replied on #336270", when: "1m" },
    { icon: CheckCircle2, color: "#22C55E", t: "Aisha closed #336114 (CSAT 5★)", when: "3m" },
    { icon: UserPlus, color: "#F59E0B", t: "#336196 assigned to Karan Mehta", when: "6m" },
  ]);
  useEffect(() => {
    const ins = setInterval(() => setInsight((i) => (i + 1) % DASH_INSIGHTS.length), 6000);
    const evs = [
      { icon: Inbox, color: "#0EA5E9", t: "New ticket from OffCampusly portal" },
      { icon: MessageSquareText, color: "#5B5CEB", t: "Customer replied on #336233" },
      { icon: CheckCircle2, color: "#22C55E", t: "Ticket resolved by Rahul Sethi" },
      { icon: Bell, color: "#EC4899", t: "SLA reminder: #336159 due in 40m" },
    ];
    const fd = setInterval(() => setFeed((f) => [{ ...evs[Math.floor(Math.random() * evs.length)], when: "just now" }, ...f.slice(0, 5)]), 9000);
    return () => { clearInterval(ins); clearInterval(fd); };
  }, []);
  const I = DASH_INSIGHTS[insight];
  const sla = 92;
  return (
    <div className="dash-live fade" style={{ animationDelay: "60ms" }}>
      <div className="card card-pad ins-card">
        <div className="section-head" style={{ marginBottom: 10 }}>
          <div><h3 className="card-title"><Sparkles size={15} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--primary)" }} />AI Insights</h3><p className="card-sub">Auto-generated from this week's activity.</p></div>
          <div className="ins-dots">{DASH_INSIGHTS.map((_, i) => <button key={i} className={i === insight ? "on" : ""} onClick={() => setInsight(i)} aria-label={`Insight ${i + 1}`} />)}</div>
        </div>
        <div className="ins-body" key={insight}>
          <span className="ic" style={{ background: `${I.color}18`, color: I.color }}><I.icon size={17} /></span>
          <p>{I.text}</p>
        </div>
      </div>
      <div className="card card-pad sla-card">
        <h3 className="card-title" style={{ marginBottom: 4 }}><Gauge size={15} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--primary)" }} />SLA Health</h3>
        <div className="sla-ring-wrap">
          <div className="sla-ring" style={{ background: `conic-gradient(var(--success) ${sla * 3.6}deg, var(--surface-2) 0deg)` }}>
            <div className="sla-ring-in"><b>{sla}%</b><span>on target</span></div>
          </div>
          <div className="sla-mini">
            <div><span className="dotc" style={{ background: "#22C55E" }} />First response <b>92%</b></div>
            <div><span className="dotc" style={{ background: "#0EA5E9" }} />Resolution <b>86%</b></div>
            <button className="btn btn-soft btn-sm" style={{ marginTop: 8 }} onClick={() => onOpenTickets("all", "Overdue")}><AlertTriangle size={13} /> View 3 at risk</button>
          </div>
        </div>
      </div>
      <div className="card card-pad feed-card">
        <h3 className="card-title" style={{ marginBottom: 10 }}><Activity size={15} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--primary)" }} />Live Feed</h3>
        <div className="live-feed">
          {feed.map((f, i) => (
            <div className="lf-item" key={f.t + i} style={{ animationDelay: `${i * 40}ms` }}>
              <span className="ic" style={{ background: `${f.color}18`, color: f.color }}><f.icon size={13} /></span>
              <span className="tx">{f.t}</span><span className="wh">{f.when}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CommandPalette({ open, onClose, tickets, go, openTicket, dark, setDark, openTheme }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { if (open) { setQ(""); setTimeout(() => inputRef.current?.focus(), 40); } }, [open]);
  if (!open) return null;
  const ql = q.toLowerCase();
  const pages = [
    { icon: LayoutDashboard, label: "Go to Dashboard", run: () => go("home") },
    { icon: Ticket, label: "Go to Tickets", run: () => go("tickets") },
    { icon: Users, label: "Go to Customers", run: () => go("customers") },
    { icon: BarChart3, label: "Go to Reports", run: () => go("reports") },
    { icon: Bot, label: "Go to Automation", run: () => go("automation") },
    { icon: Settings, label: "Go to Settings", run: () => go("settings") },
    { icon: User, label: "Open Admin Profile", run: () => go("profile") },
  ].filter((p) => !ql || p.label.toLowerCase().includes(ql));
  const actions = [
    { icon: dark ? Sun : Moon, label: dark ? "Switch to Light Mode" : "Switch to Dark Mode", run: () => setDark(!dark) },
    { icon: Droplet, label: "Customize Theme", run: openTheme },
  ].filter((a) => !ql || a.label.toLowerCase().includes(ql));
  const tix = !ql ? [] : (tickets || []).filter((t) => `${t.id} ${t.name} ${t.subject}`.toLowerCase().includes(ql)).slice(0, 5);
  const custSeen = new Set();
  const custs = !ql ? [] : (tickets || []).filter((t) => { const k = t.email; if (custSeen.has(k)) return false; custSeen.add(k); return `${t.name} ${t.email}`.toLowerCase().includes(ql); }).slice(0, 4);
  const fire = (fn) => { fn(); onClose(); };
  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-in"><Search size={17} /><input ref={inputRef} placeholder="Search tickets, customers, pages, actions…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }} /><kbd>ESC</kbd></div>
        <div className="cmdk-body">
          {pages.length > 0 && <><div className="cmdk-h">Pages</div>{pages.map((p) => <button key={p.label} className="cmdk-item" onClick={() => fire(p.run)}><span className="ic"><p.icon size={15} /></span>{p.label}</button>)}</>}
          {actions.length > 0 && <><div className="cmdk-h">Actions</div>{actions.map((a) => <button key={a.label} className="cmdk-item" onClick={() => fire(a.run)}><span className="ic"><a.icon size={15} /></span>{a.label}</button>)}</>}
          {tix.length > 0 && <><div className="cmdk-h">Tickets</div>{tix.map((t) => <button key={t.id} className="cmdk-item" onClick={() => fire(() => openTicket(t))}><span className="ic" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}><Ticket size={14} /></span><span style={{ flex: 1, textAlign: "left" }}>#{t.id} · {t.subject}</span><span className="cmdk-meta">{t.name}</span></button>)}</>}
          {custs.length > 0 && <><div className="cmdk-h">Customers</div>{custs.map((t) => <button key={t.email} className="cmdk-item" onClick={() => fire(() => go("customers"))}><span className="a" style={{ background: avColor(t.name), width: 24, height: 24, borderRadius: 8, display: "grid", placeItems: "center", color: "#fff", fontSize: 10, fontWeight: 800 }}>{initials(t.name)}</span><span style={{ flex: 1, textAlign: "left" }}>{t.name}</span><span className="cmdk-meta">{t.email}</span></button>)}</>}
          {ql && !pages.length && !actions.length && !tix.length && !custs.length && <div className="cmdk-empty"><Search size={20} />No results for “{q}”</div>}
        </div>
        <div className="cmdk-foot"><span><kbd>↑↓</kbd> browse</span><span><kbd>↵</kbd> open</span><span><kbd>Ctrl K</kbd> toggle</span></div>
      </div>
    </div>
  );
}

function AiAssistant({ tickets, go, openTickets, openTicket }) {
  const push = useToast();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ who: "ai", text: "Hi! I'm your HelpHive copilot. Try: “show overdue tickets”, “open attendance tickets”, or “generate weekly report”." }]);
  const [q, setQ] = useState("");
  const bodyRef = useRef(null);
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [msgs, open]);
  const answer = (text) => {
    const t = text.toLowerCase();
    if (/overdue/.test(t)) { setTimeout(() => { openTickets("all", "Overdue"); }, 500); return "Opening all overdue tickets for you…"; }
    if (/attendance/.test(t)) { const m = (tickets || []).filter((x) => x.category === "Attendance"); return { text: `Found ${m.length} attendance ticket${m.length !== 1 ? "s" : ""}:`, links: m.slice(0, 4) }; }
    if (/certificate/.test(t)) { const m = (tickets || []).filter((x) => x.category === "Certificate"); return { text: `Found ${m.length} certificate ticket${m.length !== 1 ? "s" : ""}:`, links: m.slice(0, 4) }; }
    if (/weekly report|generate.*report/.test(t)) { setTimeout(() => go("reports"), 500); return "Taking you to the Reports centre — use Quick Report Generator for a one-click weekly report."; }
    if (/refund/.test(t)) { const m = (tickets || []).filter((x) => /refund|payment|billing/i.test(x.subject + x.category)); return { text: `There are ${m.length} refund-related tickets. I can bulk-assign them from the Tickets page (select → Assign).`, links: m.slice(0, 3) }; }
    if (/csat|satisfaction/.test(t)) return "CSAT is at 93% this month (▲3%). Detractors are down to 4% — the biggest driver was faster first responses.";
    if (/sla/.test(t)) return "SLA health: first response 92%, resolution 86% against a 90% target. 3 tickets are currently at risk.";
    return "Here's what I can do: navigate (“show overdue tickets”), find by category (“open attendance tickets”), or reporting (“generate weekly report”). More skills coming soon!";
  };
  const send = () => {
    const text = q.trim(); if (!text) return;
    setQ("");
    setMsgs((m) => [...m, { who: "me", text }]);
    setTimeout(() => {
      const a = answer(text);
      setMsgs((m) => [...m, typeof a === "string" ? { who: "ai", text: a } : { who: "ai", text: a.text, links: a.links }]);
    }, 450);
  };
  return (
    <>
      <button className={`ai-fab ${open ? "hidden" : ""}`} onClick={() => setOpen(true)} title="AI Assistant" aria-label="Open AI Assistant"><Sparkles size={20} /></button>
      {open && (
        <div className="ai-panel">
          <div className="ai-head"><span className="ic"><Sparkles size={15} /></span><div style={{ flex: 1 }}><b>HelpHive Copilot</b><span className="st"><span className="dotc" style={{ background: "#22C55E", width: 6, height: 6 }} /> online</span></div><button className="icon-btn" onClick={() => setOpen(false)}><X size={16} /></button></div>
          <div className="ai-body" ref={bodyRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`ai-msg ${m.who}`}>
                <div className="bub">{m.text}
                  {m.links && m.links.length > 0 && <div className="ai-links">{m.links.map((t) => <button key={t.id} onClick={() => { setOpen(false); openTicket(t); }}><Ticket size={12} /> #{t.id} · {t.subject.slice(0, 34)}{t.subject.length > 34 ? "…" : ""}</button>)}</div>}
                </div>
              </div>
            ))}
          </div>
          <div className="ai-in"><input placeholder="Ask me anything…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} /><button className="btn btn-primary btn-sm" onClick={send}><Send size={14} /></button></div>
        </div>
      )}
    </>
  );
}

export default function App() {
  const [dark, setDark] = useState(false);
  /* No sign-in / register screen here: the page is already behind the admin panel's
     ProtectedRoute + PermissionGate ('freshdesk'), so it renders the dashboard directly
     and defers sign-out to the panel's own auth. */
  const { logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [route, setRoute] = useState("home");
  const [activeTicket, setActiveTicket] = useState(null);
  const [activeCustomer, setActiveCustomer] = useState(null);
  const [tFilter, setTFilter] = useState({ view: "unresolved", status: [] });
  const [toasts, setToasts] = useState([]);
  /* This workspace nav is a RIGHT-hand rail, mutually exclusive with the admin
     panel's left sidebar (see hooks/sidebarBus.js). It starts expanded; the left
     sidebar folds away on entering /freshdesk via AUTO_COLLAPSE_ROUTES in
     AdminLayout, which fires on direct page loads too. */
  const [collapsed, setCollapsed] = useState(false);
  /* The moment the admin sidebar is expanded again, this rail gives way. */
  useEffect(() => onExpanded((which) => { if (which === "admin") setCollapsed(true); }), []);
  /* Expanding the rail claims the screen back, so it announces in turn. */
  const setNavCollapsed = (next) => {
    setCollapsed(next);
    if (!next) announceExpanded("freshdesk");
  };
  const [logo, setLogo] = useState(() => { try { return localStorage.getItem("hh-logo") || ""; } catch { return ""; } });
  useEffect(() => {
    (async () => {
      try {
        if (window.storage) {
          const r = await window.storage.get("hh-logo");
          if (r && r.value) setLogo(r.value);
        }
      } catch (e) { /* key missing — fine */ }
    })();
  }, []);
  const saveLogo = async (dataUrl) => {
    setLogo(dataUrl);
    let ok = false;
    try { if (dataUrl) localStorage.setItem("hh-logo", dataUrl); else localStorage.removeItem("hh-logo"); ok = true; } catch (e) {}
    try {
      if (window.storage) {
        if (dataUrl) await window.storage.set("hh-logo", dataUrl); else await window.storage.delete("hh-logo");
        ok = true;
      }
    } catch (e) {}
    if (dataUrl && !ok) push({ type: "warning", title: "Logo saved for this session only", desc: "Persistent storage is unavailable, so it may reset after a refresh." });
  };
  const navHist = useRef([]);
  const [navTick, setNavTick] = useState(0);
  const [theme, setTheme] = useState(null);        // null = untouched defaults
  const [themeOpen, setThemeOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdOpen((o) => !o); }
      if (e.key === "Escape") setCmdOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const [tickets, setTickets] = useState(TICKETS);
  useEffect(() => {                                  // load saved theme once
    try { const raw = localStorage.getItem("helphive-theme"); if (raw) setTheme({ ...THEME_DEFAULT, ...JSON.parse(raw) }); } catch (e) {}
  }, []);
  useEffect(() => { if (theme) applyTheme(theme, dark); }, [theme, dark]);
  const push = (t) => { const id = Date.now() + Math.random(); setToasts((x) => [...x, { id, ...t }]); setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 4200); };
  const dismiss = (id) => setToasts((x) => x.filter((y) => y.id !== id));
  const top = () => window.scrollTo({ top: 0, behavior: "smooth" });
  /* Signing out logs the admin out of the whole panel, not just this page. */
  const signOut = () => { setNavOpen(false); setThemeOpen(false); logout(); };
  const pushHist = () => { navHist.current = [...navHist.current, { route, activeTicket, activeCustomer, tFilter }].slice(-25); setNavTick((x) => x + 1); };
  const go = (r) => { if (r !== route) pushHist(); setRoute(r); setNavOpen(false); top(); };
  const openTicket = (t) => { pushHist(); setActiveTicket(t); setRoute("ticket"); top(); };
  const openTickets = (view, status) => { pushHist(); setTFilter({ view, status }); setRoute("tickets"); top(); };
  const openCustomer = (c) => { pushHist(); setActiveCustomer(c); setRoute("customer"); top(); };
  const goBack = () => {
    const h = navHist.current;
    if (!h.length) return;
    const prev = h[h.length - 1];
    navHist.current = h.slice(0, -1);
    setRoute(prev.route); setActiveTicket(prev.activeTicket); setActiveCustomer(prev.activeCustomer); setTFilter(prev.tFilter);
    setNavTick((x) => x + 1); top();
  };
  const canGoBack = navHist.current.length > 0;
  const resetTheme = () => { setTheme(null); try { localStorage.removeItem("helphive-theme"); } catch (e) {} const root = document.querySelector(".app"); if (root) root.removeAttribute("style"); };
  const themeApi = { theme: theme || (dark ? THEME_DARK : THEME_DEFAULT), setTheme, resetTheme, dark };
  const step = (d) => {
    const i = TICKETS.findIndex(t => t.id === (activeTicket && activeTicket.id));
    if (i < 0) return;
    setActiveTicket(TICKETS[(i + d + TICKETS.length) % TICKETS.length]); window.scrollTo({ top:0, behavior:"smooth" });
  };
  const active = activeTicket;
  return (
    <ToastCtx.Provider value={push}>
    <div className={`app ${dark ? "dark" : ""}`}>
      <Styles />
      <div className="shell">
        {navOpen && <div className="overlay" onClick={() => setNavOpen(false)} />}
        {/* Page first, rail second: `.shell` is a flex row, so DOM order is visual
            order and the rail has to come last to sit on the right. */}
        <div className="main">
          <TopNavbar dark={dark} setDark={setDark} onBurger={() => setNavOpen(true)} onOpenTicket={openTicket} onBack={goBack} canBack={canGoBack} collapsed={collapsed} setCollapsed={setNavCollapsed} />
          {route === "home" ? <DashboardPage onOpen={openTicket} onOpenTickets={openTickets} go={go} />
            : route === "automation" ? <AutomationPage onTheme={() => setThemeOpen(true)} />
            : route === "settings" ? <SettingsPage themeApi={themeApi} go={go} logoApi={{ logo, saveLogo }} />
            : route === "profile" ? <AdminProfilePage go={go} onSignOut={signOut} />
            : route === "agentdash" ? <AgentDashboard tickets={tickets} setTickets={setTickets} onOpen={openTicket} go={go} />
            : route === "caller" ? <CallerPage tickets={tickets} onOpenTicket={openTicket} />
            : route === "reports" ? <ReportsPage tickets={tickets} />
            : route === "customers" ? <CustomersPage onProfile={openCustomer} onOpenTicket={openTicket} />
            : route === "customer" && activeCustomer ? <CustomerProfilePage customer={activeCustomer} onBack={() => go("customers")} onOpenTicket={openTicket} />
            : route === "ticket" && active ? <TicketDetailPage ticket={tickets.find(t => t.id === active.id) || active} onBack={() => go("tickets")} onPrev={() => step(-1)} onNext={() => step(1)} tickets={tickets} setTickets={setTickets} />
            : <TicketsPage key={`${tFilter.view}-${tFilter.status.join()}`} onOpen={openTicket} initialView={tFilter.view} initialStatus={tFilter.status} tickets={tickets} setTickets={setTickets} />}
        </div>
        <Sidebar open={navOpen} route={route === "ticket" ? "tickets" : route === "customer" ? "customers" : route} go={go} collapsed={collapsed} setCollapsed={setNavCollapsed} />
      </div>
      <ToastHost toasts={toasts} dismiss={dismiss} />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} tickets={tickets} go={go} openTicket={openTicket} dark={dark} setDark={setDark} openTheme={() => { setCmdOpen(false); setThemeOpen(true); }} />
      <AiAssistant tickets={tickets} go={go} openTickets={openTickets} openTicket={openTicket} />
      <ThemeDrawer open={themeOpen} onClose={() => setThemeOpen(false)} theme={theme || (dark ? THEME_DARK : THEME_DEFAULT)} setTheme={setTheme} dark={dark} onResetDefault={() => { setTheme(null); try { localStorage.removeItem("helphive-theme"); } catch (e) {} const root = document.querySelector(".app"); if (root) root.removeAttribute("style"); }} />
    </div>
    </ToastCtx.Provider>
  );

}
