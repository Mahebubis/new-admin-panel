// import { useState, useEffect, useRef, lazy, Suspense } from 'react';
// import { useNavigate } from 'react-router-dom';
// import api from '../../api/axios';
// import { useAuth } from '../../hooks/useAuth';

// // Lazy load heavy recharts - don't block initial render
// const LazyCharts = lazy(() => import('recharts').then(m => ({
//   default: ({ chartData, chartDays, setChartDays, donutData, reg, unreg, pct, online }) => {
//     const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } = m;
//     return (
//       <div className="grid gap-2.5" style={{ gridTemplateColumns: '1fr 220px' }}>
//         <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
//           <div className="flex items-center justify-between mb-3">
//             <div className="flex items-center gap-2">
//               <i className="fas fa-chart-line text-indigo-500 text-sm"></i>
//               <span className="text-[13px] font-bold text-gray-800">Registration Trend</span>
//             </div>
//             <div className="flex gap-1">
//               {[7, 30].map(d => (
//                 <button key={d} onClick={() => setChartDays(d)}
//                   className={`px-3 py-1 text-[11px] font-semibold rounded-full transition ${
//                     chartDays === d ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
//                   {d}D
//                 </button>
//               ))}
//             </div>
//           </div>
//           <ResponsiveContainer width="100%" height={240}>
//             <LineChart data={chartData}>
//               <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
//               <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fill: '#94a3b8' }} />
//               <YAxis tick={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fill: '#94a3b8' }} />
//               <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, background: '#0f172a', color: '#fff', border: 'none' }}
//                 labelStyle={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }} />
//               <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
//               <Line type="monotone" dataKey="Total" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} fill="rgba(99,102,241,0.07)" />
//               <Line type="monotone" dataKey="Registered" stroke="#22c55e" strokeWidth={1.5} dot={false} />
//               <Line type="monotone" dataKey="Unregistered" stroke="#f43f5e" strokeWidth={1.5} dot={false} />
//             </LineChart>
//           </ResponsiveContainer>
//         </div>
//         <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
//           <div className="flex items-center gap-2 mb-3">
//             <i className="fas fa-chart-pie text-indigo-500 text-sm"></i>
//             <span className="text-[13px] font-bold text-gray-800">Breakdown</span>
//           </div>
//           <div className="flex justify-center">
//             <PieChart width={130} height={130}>
//               <Pie data={donutData} cx={65} cy={65} innerRadius={42} outerRadius={60} dataKey="value" strokeWidth={0}>
//                 <Cell fill="#6366f1" />
//                 <Cell fill="#e2e8f0" />
//               </Pie>
//             </PieChart>
//           </div>
//           <div className="mt-3 space-y-2">
//             {[
//               { label: 'Registered', color: '#6366f1', val: reg.toLocaleString() },
//               { label: 'Unregistered', color: '#e2e8f0', val: unreg.toLocaleString() },
//               { label: 'Rate', color: '#22c55e', val: `${pct}%` },
//               { label: 'Online', color: '#f59e0b', val: online.toLocaleString() },
//             ].map((item, i) => (
//               <div key={i} className="flex items-center justify-between text-[11px]">
//                 <div className="flex items-center gap-1.5">
//                   <span className="w-2 h-2 rounded-full" style={{ background: item.color }}></span>
//                   <span className="text-gray-500">{item.label}</span>
//                 </div>
//                 <span className="font-bold text-gray-800" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{item.val}</span>
//               </div>
//             ))}
//           </div>
//         </div>
//       </div>
//     );
//   }
// })));

// // Simple in-memory cache for dashboard data
// const dashboardCache = { stats: null, chart: null, chartDays: null };

// function useCountUp(target, duration = 1000) {
//   const [val, setVal] = useState(0);
//   useEffect(() => {
//     if (!target) return;
//     let start = 0;
//     const step = (ts) => {
//       if (!start) start = ts;
//       const p = Math.min((ts - start) / duration, 1);
//       setVal(Math.floor(p * p * target)); // ease-out quadratic
//       if (p < 1) requestAnimationFrame(step);
//       else setVal(target);
//     };
//     requestAnimationFrame(step);
//   }, [target, duration]);
//   return val.toLocaleString();
// }

// function StatCard({ title, value, icon, badge, barColor, barWidth, onClick, iconBg, iconColor, badgeBg, badgeColor }) {
//   const display = useCountUp(typeof value === 'number' ? value : 0);
//   return (
//     <div onClick={onClick}
//       className={`bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}>
//       <div className="flex items-start justify-between mb-3">
//         <div className="flex items-center gap-2.5">
//           <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm" style={{ background: iconBg, color: iconColor }}>
//             <i className={icon}></i>
//           </div>
//           <span className="text-[12.5px] font-semibold text-gray-500">{title}</span>
//         </div>
//         <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: badgeBg, color: badgeColor }}>{badge}</span>
//       </div>
//       <p className="text-xl font-extrabold text-gray-900 mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{display}</p>
//       <div className="h-[3px] rounded-full bg-gray-100">
//         <div className="h-full rounded-full transition-all duration-1000" style={{ background: barColor, width: barWidth }}></div>
//       </div>
//     </div>
//   );
// }

// export default function Dashboard() {
//   // Initialize from cache for instant display
//   const [stats, setStats] = useState(dashboardCache.stats);
//   const [chart, setChart] = useState(dashboardCache.chart);
//   const [chartDays, setChartDays] = useState(7);
//   const [loading, setLoading] = useState(!dashboardCache.stats);
//   const { user, hasPermission } = useAuth();
//   const navigate = useNavigate();

//   useEffect(() => {
//     let cancelled = false;

//     // Fetch stats and chart independently - don't let one block the other
//     const fetchStats = async () => {
//       try {
//         const res = await api.get('/api/dashboard/stats.php');
//         if (!cancelled && res.data.success) {
//           setStats(res.data.data);
//           dashboardCache.stats = res.data.data;
//           setLoading(false);
//         }
//       } catch { if (!cancelled) setLoading(false); }
//     };

//     const fetchChart = async () => {
//       try {
//         const res = await api.get(`/api/dashboard/chart.php?days=${chartDays}`);
//         if (!cancelled && res.data.success) {
//           setChart(res.data.data);
//           dashboardCache.chart = res.data.data;
//           dashboardCache.chartDays = chartDays;
//         }
//       } catch {}
//     };

//     // If we have cached stats, show them immediately and fetch in background
//     if (!dashboardCache.stats) setLoading(true);

//     fetchStats();
//     // Only refetch chart if days changed
//     if (!dashboardCache.chart || dashboardCache.chartDays !== chartDays) {
//       fetchChart();
//     }

//     return () => { cancelled = true; };
//   }, [chartDays]);

//   const greeting = () => {
//     const h = new Date().getHours();
//     return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
//   };

//   const now = new Date();
//   const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
//   const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

//   if (loading || !stats) {
//     return (
//       <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
//         <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 flex items-center justify-center animate-pulse">
//           <i className="fas fa-graduation-cap text-white text-xl"></i>
//         </div>
//         <div className="w-[180px] h-[3px] bg-gray-200 rounded-full overflow-hidden">
//           <div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 animate-pulse rounded-full" style={{ width: '60%' }}></div>
//         </div>
//         <p className="text-[13px] font-semibold text-gray-400">Loading Admin Panel...</p>
//       </div>
//     );
//   }

//   const total = stats.total_students || 0;
//   const reg = stats.registered_students || 0;
//   const unreg = stats.unregistered || 0;
//   const online = stats.online_users || 0;
//   const pct = total > 0 ? Math.round((reg / total) * 100) : 0;

//   const chartData = chart ? chart.labels.map((label, i) => ({
//     name: label,
//     Total: chart.total[i] || 0,
//     Registered: chart.registered[i] || 0,
//     Unregistered: chart.unregistered[i] || 0,
//   })) : [];

//   const donutData = [
//     { name: 'Registered', value: reg },
//     { name: 'Unregistered', value: Math.max(unreg, 0) },
//   ];

//   const isSuperadmin = user?.permissions?.includes('__superadmin__');
//   const rolePill = isSuperadmin
//     ? { icon: 'fas fa-crown', text: 'Super Admin', bg: 'rgba(245,158,11,0.12)', color: '#d97706' }
//     : user?.is_admin
//     ? { icon: 'fas fa-user-shield', text: 'Admin', bg: 'rgba(99,102,241,0.1)', color: '#6366f1' }
//     : { icon: 'fas fa-user', text: 'User', bg: 'rgba(100,116,139,0.1)', color: '#64748b' };

//   return (
//     <div className="flex flex-col gap-3">
//       {/* Welcome Bar */}
//       <div className="bg-white rounded-xl border border-gray-200 px-5 py-3.5 flex items-center justify-between">
//         <div className="flex items-center gap-3">
//           <div className="w-[38px] h-[38px] rounded-[10px] bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-[15px] font-bold">
//             {user?.name?.charAt(0)?.toUpperCase() || 'A'}
//           </div>
//           <div>
//             <div className="flex items-center gap-2">
//               <p className="text-[15px] font-bold text-gray-900">{greeting()}, {user?.name || 'Admin'}</p>
//               <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1"
//                 style={{ background: rolePill.bg, color: rolePill.color }}>
//                 <i className={`${rolePill.icon} text-[9px]`}></i> {rolePill.text}
//               </span>
//             </div>
//             <p className="text-xs text-gray-400">Welcome back to your admin panel</p>
//           </div>
//         </div>
//         <div className="text-right hidden sm:block">
//           <p className="text-[22px] font-bold text-gray-900" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{timeStr}</p>
//           <p className="text-[11px] text-gray-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{dateStr}</p>
//         </div>
//       </div>

//       {/* Stat Cards — 4 columns */}
//       <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
//         <StatCard title="Total Students" value={total} icon="fas fa-users" badge="All time"
//           barColor="#3b82f6" barWidth="100%"
//           iconBg="#eff6ff" iconColor="#3b82f6" badgeBg="#dbeafe" badgeColor="#1d4ed8"
//           onClick={hasPermission('all_students') ? () => navigate('/students/all') : undefined} />
//         <StatCard title="Registered" value={reg} icon="fas fa-user-check" badge={`${pct}%`}
//           barColor="#22c55e" barWidth={`${pct}%`}
//           iconBg="#f0fdf4" iconColor="#16a34a" badgeBg="#dcfce7" badgeColor="#15803d"
//           onClick={hasPermission('all_students') ? () => navigate('/students/all') : undefined} />
//         <StatCard title="Unregistered" value={unreg} icon="fas fa-user-xmark" badge={`${100 - pct}%`}
//           barColor="#ef4444" barWidth={`${100 - pct}%`}
//           iconBg="#fef2f2" iconColor="#dc2626" badgeBg="#fee2e2" badgeColor="#b91c1c"
//           onClick={hasPermission('unregistered_students') ? () => navigate('/students/unregistered') : undefined} />
//         <StatCard title="Online Now" value={online} icon="fas fa-wifi" badge="Live"
//           barColor="#f59e0b" barWidth="60%"
//           iconBg="#fffbeb" iconColor="#d97706" badgeBg="#fef3c7" badgeColor="#b45309" />
//       </div>

//       {/* Charts — lazy loaded so stat cards appear instantly */}
//       <Suspense fallback={
//         <div className="grid gap-2.5" style={{ gridTemplateColumns: '1fr 220px' }}>
//           <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm h-[300px] flex items-center justify-center">
//             <p className="text-[13px] text-gray-400">Loading charts...</p>
//           </div>
//           <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm h-[300px]"></div>
//         </div>
//       }>
//         <LazyCharts
//           chartData={chartData} chartDays={chartDays} setChartDays={setChartDays}
//           donutData={donutData} reg={reg} unreg={unreg} pct={pct} online={online}
//         />
//       </Suspense>
//     </div>
//   );
// }










import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../hooks/useAuth';
import { Helmet } from "react-helmet-async";

// ─── Lazy Charts ───────────────────────────────────────────────────────────────
const LazyCharts = lazy(() =>
  import('recharts').then(m => ({
    default: ({ chartData, chartDays, setChartDays, donutData, reg, unreg, pct, online }) => {
      const {
        LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
        ResponsiveContainer, Legend, PieChart, Pie, Cell, Area, AreaChart
      } = m;

      return (
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 240px' }}>
          {/* Line Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <i className="fas fa-chart-line text-indigo-500 text-sm"></i>
                </div>
                <div>
                  <span className="text-[13px] font-bold text-gray-900">Registration Trend</span>
                  <p className="text-[10px] text-gray-400">Daily student activity</p>
                </div>
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {[7, 30].map(d => (
                  <button
                    key={d}
                    onClick={() => setChartDays(d)}
                    className={`px-4 py-1.5 text-[11px] font-bold rounded-[10px] transition-all duration-200 ${
                      chartDays === d
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {d}D
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fill: '#94a3b8' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fill: '#94a3b8' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12, borderRadius: 12,
                    background: '#0f172a', color: '#fff',
                    border: 'none', padding: '10px 14px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                  }}
                  labelStyle={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, marginBottom: 4 }}
                  cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                  iconSize={8}
                  iconType="circle"
                />
                <Area type="monotone" dataKey="Total" stroke="#6366f1" strokeWidth={2.5}
                  fill="url(#totalGrad)" dot={false} activeDot={{ r: 4, fill: '#6366f1' }} />
                <Area type="monotone" dataKey="Registered" stroke="#22c55e" strokeWidth={2}
                  fill="url(#regGrad)" dot={false} activeDot={{ r: 3, fill: '#22c55e' }} />
                <Line type="monotone" dataKey="Unregistered" stroke="#f43f5e" strokeWidth={1.5}
                  dot={false} activeDot={{ r: 3, fill: '#f43f5e' }} strokeDasharray="5 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Donut + Stats */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                <i className="fas fa-chart-pie text-indigo-500 text-sm"></i>
              </div>
              <div>
                <span className="text-[13px] font-bold text-gray-900">Breakdown</span>
                <p className="text-[10px] text-gray-400">Registration split</p>
              </div>
            </div>

            <div className="flex justify-center relative my-2">
              <PieChart width={150} height={150}>
                <Pie
                  data={donutData}
                  cx={75} cy={75}
                  innerRadius={50} outerRadius={68}
                  dataKey="value"
                  strokeWidth={0}
                  startAngle={90}
                  endAngle={-270}
                >
                  <Cell fill="#6366f1" />
                  <Cell fill="#e2e8f0" />
                </Pie>
              </PieChart>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[22px] font-black text-gray-900"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}>{pct}%</span>
                <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Rate</span>
              </div>
            </div>

            <div className="mt-auto space-y-2.5">
              {[
                { label: 'Registered', color: '#6366f1', val: reg.toLocaleString(), icon: 'fas fa-user-check' },
                { label: 'Unregistered', color: '#e2e8f0', textColor: '#94a3b8', val: unreg.toLocaleString(), icon: 'fas fa-user-xmark' },
                { label: 'Rate', color: '#22c55e', val: `${pct}%`, icon: 'fas fa-percent' },
                { label: 'Online Now', color: '#f59e0b', val: online.toLocaleString(), icon: 'fas fa-wifi' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                      style={{ background: item.color + '20' }}>
                      <i className={`${item.icon} text-[9px]`} style={{ color: item.color === '#e2e8f0' ? '#94a3b8' : item.color }}></i>
                    </div>
                    <span className="text-[11px] font-semibold text-gray-500">{item.label}</span>
                  </div>
                  <span className="text-[12px] font-black text-gray-800"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}>{item.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
  }))
);

// ─── In-Memory Cache ────────────────────────────────────────────────────────────
// Using Map for O(1) lookup + TTL support
const cache = new Map();
const cacheGet = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { cache.delete(key); return null; }
  return entry.data;
};
const cacheSet = (key, data, ttlMs) => cache.set(key, { data, expires: Date.now() + ttlMs });

// ─── Count-Up Hook ──────────────────────────────────────────────────────────────
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3); // cubic ease-out
      setVal(Math.floor(ease * target));
      if (p < 1) requestAnimationFrame(step);
      else setVal(target);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val.toLocaleString();
}

// ─── Three Dot Loader ──────────────────────────────────────────────────────────
function ThreeDotsLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-5">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-200">
        <i className="fas fa-graduation-cap text-white text-lg"></i>
      </div>
      <div className="flex items-center gap-2">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"
            style={{
              animation: 'dotBounce 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.18}s`,
              opacity: 0.8,
            }}
          />
        ))}
      </div>
      <p className="text-[12px] font-semibold text-gray-400 tracking-wide">Loading Dashboard</p>
      <style>{`
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-10px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Mini Sparkline Bar ────────────────────────────────────────────────────────
function SparkBar({ width, color }) {
  return (
    <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{
          background: color,
          width,
          transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)',
        }}
      />
    </div>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ title, value, subtitle, icon, badge, barColor, barWidth, onClick, iconBg, iconColor, badgeBg, badgeColor, trend }) {
  const display = useCountUp(typeof value === 'number' ? value : 0);

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}`}
    >
      {/* subtle bg gradient circle */}
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-[0.06]"
        style={{ background: barColor }} />

      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
          style={{ background: iconBg, color: iconColor }}>
          <i className={icon}></i>
        </div>
        <span
          className="text-[10px] font-black px-2.5 py-1 rounded-full"
          style={{ background: badgeBg, color: badgeColor }}
        >
          {badge}
        </span>
      </div>

      <p className="text-[11px] font-semibold text-gray-400 mb-1">{title}</p>
      <p className="text-2xl font-black text-gray-900 mb-1 tabular-nums"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {display}
      </p>
      {subtitle && (
        <p className="text-[10px] text-gray-400 mb-3">{subtitle}</p>
      )}
      <SparkBar width={barWidth} color={barColor} />
    </div>
  );
}

// ─── Info Card (for smaller metrics) ──────────────────────────────────────────
function InfoCard({ icon, label, value, bg, color, onClick }) {
  const display = useCountUp(typeof value === 'number' ? value : 0, 800);
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-3 ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
        style={{ background: bg, color }}>
        <i className={icon}></i>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-gray-400 truncate">{label}</p>
        <p className="text-[15px] font-black text-gray-900"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {typeof value === 'string' ? value : display}
        </p>
      </div>
    </div>
  );
}

// ─── Live Clock ────────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const timeStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateStr = time.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="text-right hidden sm:block">
      <p className="text-[22px] font-black text-gray-900 tabular-nums"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}>{timeStr}</p>
      <p className="text-[11px] text-gray-400"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}>{dateStr}</p>
    </div>
  );
}

// ─── Welcome Only Email (limited-access user) ──────────────────────────────────
const WELCOME_ONLY_EMAIL = 'accounts@balistro.com';

// ─── Welcome View (for limited-access user) ────────────────────────────────────
function WelcomeView({ user }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const h = time.getHours();
  const greeting = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  const timeStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateStr = time.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const dayNum = time.toLocaleDateString('en-IN', { day: '2-digit' });
  const monthShort = time.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase();
  const weekday = time.toLocaleDateString('en-IN', { weekday: 'long' });
  const firstName = (user?.name || 'there').split(' ')[0];

  const features = [
    { icon: 'fas fa-shield-halved', title: 'Secure Access', desc: 'Permission-based access to your assigned modules', bg: 'from-indigo-500/10 to-indigo-500/5', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600' },
    { icon: 'fas fa-chart-line', title: 'Live Analytics', desc: 'Real-time reporting & analysis at your fingertips', bg: 'from-purple-500/10 to-purple-500/5', iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
    { icon: 'fas fa-bolt', title: 'Fast & Reliable', desc: 'Lightning-fast queries with cached responses', bg: 'from-pink-500/10 to-pink-500/5', iconBg: 'bg-pink-100', iconColor: 'text-pink-600' },
    { icon: 'fas fa-headset', title: 'Need Help?', desc: 'Contact a Super Admin for additional permissions', bg: 'from-amber-500/10 to-amber-500/5', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
  ];

  return (
    <>
      <Helmet><title>Welcome | Admin Panel</title></Helmet>
      <div className="relative overflow-hidden"
           style={{
             minHeight: 'calc(100vh - 62px)',
             margin: '-16px -20px',
             width: 'calc(100% + 40px)',
             background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #faf5ff 100%)',
           }}>

        {/* Animated background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-32 w-[36rem] h-[36rem] rounded-full opacity-40 blur-3xl"
               style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)', animation: 'floatA 14s ease-in-out infinite' }} />
          <div className="absolute -bottom-40 -right-32 w-[40rem] h-[40rem] rounded-full opacity-35 blur-3xl"
               style={{ background: 'radial-gradient(circle, #a855f7, transparent 70%)', animation: 'floatB 16s ease-in-out infinite' }} />
          <div className="absolute top-1/3 left-1/2 w-[28rem] h-[28rem] rounded-full opacity-25 blur-3xl"
               style={{ background: 'radial-gradient(circle, #ec4899, transparent 70%)', animation: 'floatC 18s ease-in-out infinite' }} />
          <div className="absolute top-10 right-1/4 w-72 h-72 rounded-full opacity-20 blur-3xl"
               style={{ background: 'radial-gradient(circle, #06b6d4, transparent 70%)', animation: 'floatA 20s ease-in-out infinite reverse' }} />
        </div>

        {/* Subtle grid overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
             style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '50px 50px' }} />

        {/* Content wrapper */}
        <div className="relative z-10 w-full mx-auto px-6 sm:px-10 py-10" style={{ maxWidth: '1600px' }}>

          {/* ═══ HERO STRIP ═══ */}
          <div className="relative bg-white/70 backdrop-blur-2xl rounded-[32px] border border-white/80 overflow-hidden mb-6"
               style={{ boxShadow: '0 25px 70px -15px rgba(99,102,241,0.25), 0 10px 25px -10px rgba(168,85,247,0.18)' }}>

            {/* gradient accent strip */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

            {/* decorative blobs inside hero */}
            <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-gradient-to-br from-purple-200/40 to-pink-200/40 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-gradient-to-br from-indigo-200/40 to-cyan-200/40 blur-2xl pointer-events-none" />

            <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 p-8 sm:p-12">

              {/* ─── Left: Greeting ─── */}
              <div className="flex flex-col justify-center">
                {/* brand badge */}
                <div className="inline-flex items-center gap-2 self-start mb-6 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <span className="text-[10px] font-black tracking-[0.22em] uppercase text-indigo-600">Internship Studio</span>
                </div>

                {/* avatar + greeting row */}
                <div className="flex items-center gap-5 mb-6">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white text-3xl font-black flex-shrink-0 relative"
                       style={{ boxShadow: '0 12px 30px -8px rgba(99,102,241,0.55)' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                    </span>
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-md">
                      <i className="fas fa-check text-[10px] text-green-500" />
                    </span>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-indigo-500 mb-1">{greeting}</p>
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05]"
                        style={{
                          background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 50%, #ec4899 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        }}>
                      Hi, {firstName}!
                    </h1>
                  </div>
                </div>

                {/* welcome message */}
                <p className="text-[15px] text-gray-600 leading-relaxed max-w-xl mb-6">
                  Welcome back to your <span className="font-bold text-gray-900">personalized workspace</span>.
                  Your assigned modules are ready in the sidebar — just click and explore.
                </p>

                {/* tag pills */}
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    <i className="fas fa-user-shield text-[10px]" />
                    Authenticated
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-100">
                    <i className="fas fa-circle-check text-[10px]" />
                    Active Session
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                    <i className="fas fa-chart-pie text-[10px]" />
                    Reports Access
                  </span>
                </div>
              </div>

              {/* ─── Right: Live Clock + Date ─── */}
              <div className="flex flex-col gap-4">
                {/* Live Clock */}
                <div className="relative bg-gradient-to-br from-gray-900 via-indigo-950 to-purple-950 rounded-3xl p-6 overflow-hidden flex-1 min-h-[180px] flex flex-col justify-center"
                     style={{ boxShadow: '0 15px 40px -10px rgba(15,23,42,0.4)' }}>
                  {/* sparkles */}
                  <div className="absolute top-4 left-4 w-1 h-1 rounded-full bg-white/40" />
                  <div className="absolute top-8 right-12 w-1.5 h-1.5 rounded-full bg-white/30" />
                  <div className="absolute bottom-6 right-8 w-1 h-1 rounded-full bg-white/40" />
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-purple-500/20 blur-2xl" />
                  <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-indigo-500/20 blur-2xl" />

                  <div className="relative flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black tracking-[0.22em] uppercase text-indigo-300">Local Time</span>
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-black tracking-widest uppercase text-red-300 bg-red-500/20 px-2 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                      Live
                    </span>
                  </div>
                  <p className="relative text-[42px] sm:text-[54px] font-black text-white tabular-nums leading-none mb-2"
                     style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em', textShadow: '0 2px 20px rgba(168,85,247,0.5)' }}>
                    {timeStr}
                  </p>
                  <p className="relative text-[11px] font-semibold text-indigo-200 tracking-wide"
                     style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {dateStr}
                  </p>
                </div>

                {/* Date Block */}
                <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-gray-100 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex flex-col items-center justify-center text-white flex-shrink-0"
                       style={{ boxShadow: '0 8px 20px -6px rgba(236,72,153,0.45)' }}>
                    <span className="text-[8px] font-black tracking-widest uppercase leading-none mt-1">{monthShort}</span>
                    <span className="text-2xl font-black leading-none mt-0.5"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}>{dayNum}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black tracking-[0.18em] uppercase text-gray-400 mb-0.5">Today is</p>
                    <p className="text-[18px] font-black text-gray-900">{weekday}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ FEATURE GRID ═══ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {features.map((f, i) => (
              <div key={i}
                   className={`relative bg-white/70 backdrop-blur-md rounded-2xl border border-white/80 p-5 hover:-translate-y-1 transition-all duration-300 overflow-hidden bg-gradient-to-br ${f.bg}`}
                   style={{ boxShadow: '0 10px 30px -10px rgba(99,102,241,0.15)' }}>
                <div className={`w-11 h-11 rounded-xl ${f.iconBg} flex items-center justify-center mb-4`}>
                  <i className={`${f.icon} ${f.iconColor} text-[16px]`} />
                </div>
                <h3 className="text-[14px] font-black text-gray-900 mb-1.5">{f.title}</h3>
                <p className="text-[12px] text-gray-500 leading-relaxed">{f.desc}</p>
                <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-white/30 blur-xl pointer-events-none" />
              </div>
            ))}
          </div>

          {/* ═══ FOOTER STRIP ═══ */}
          <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-5 sm:p-6 overflow-hidden"
               style={{ boxShadow: '0 15px 40px -12px rgba(99,102,241,0.4)' }}>
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                  <i className="fas fa-arrow-left text-white text-sm" />
                </div>
                <div>
                  <p className="text-[14px] font-black text-white leading-tight">Use the sidebar to access your modules</p>
                  <p className="text-[11px] text-white/80">Your assigned sections are highlighted and ready to use</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-white/90 text-[11px] font-bold">
                <i className="fas fa-shield-halved" />
                <span>Powered by Internship Studio</span>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes floatA { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,30px) scale(1.08)} }
          @keyframes floatB { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-40px,-40px) scale(1.1)} }
          @keyframes floatC { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-30px,40px) scale(1.12)} }
        `}</style>
      </div>
    </>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats] = useState(() => cacheGet('stats'));
  const [chart, setChart] = useState(() => cacheGet('chart_7'));
  const [chartDays, setChartDays] = useState(7);
  const [loading, setLoading] = useState(!cacheGet('stats'));
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const abortRef = useRef(null);

  const isWelcomeOnly = user?.email === WELCOME_ONLY_EMAIL;

  useEffect(() => {
    if (isWelcomeOnly) { setLoading(false); return; }

    const controller = new AbortController();
    abortRef.current = controller;

    const fetchStats = async () => {
      const hit = cacheGet('stats');
      if (hit) { setStats(hit); setLoading(false); return; }
      try {
        const res = await api.get('/api/dashboard/stats.php', { signal: controller.signal });
        if (res.data.success) {
          setStats(res.data.data);
          cacheSet('stats', res.data.data, 5 * 60 * 1000); // 5 min TTL
          setLoading(false);
        }
      } catch (e) {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    const fetchChart = async () => {
      const key = `chart_${chartDays}`;
      const hit = cacheGet(key);
      if (hit) { setChart(hit); return; }
      try {
        const res = await api.get(`/api/dashboard/chart.php?days=${chartDays}`, { signal: controller.signal });
        if (res.data.success) {
          setChart(res.data.data);
          cacheSet(key, res.data.data, 60 * 1000); // 1 min TTL
        }
      } catch {}
    };

    // Fire both requests in parallel — don't await one before starting the other
    Promise.all([fetchStats(), fetchChart()]);

    return () => controller.abort();
  }, [chartDays, isWelcomeOnly]);

  if (isWelcomeOnly) return <WelcomeView user={user} />;

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  };

  if (loading || !stats) return <ThreeDotsLoader />;

  const total   = stats.total_students        || 0;
  const reg     = stats.registered_students   || 0;
  const unreg   = stats.unregistered          || 0;
  const online  = stats.online_users          || 0;
  const today   = stats.today_signups         || 0;
  const week    = stats.week_signups          || 0;
  const revenue = stats.total_revenue         || '₹0';
  const refunds = stats.pending_refunds       || 0;
  const tickets = stats.open_tickets          || 0;
  const interns = stats.active_internships    || 0;
  const pct     = total > 0 ? Math.round((reg / total) * 100) : 0;

  const chartData = chart
    ? chart.labels.map((label, i) => ({
        name: label,
        Total: chart.total[i] || 0,
        Registered: chart.registered[i] || 0,
        Unregistered: chart.unregistered[i] || 0,
      }))
    : [];

  const donutData = [
    { name: 'Registered', value: reg },
    { name: 'Unregistered', value: Math.max(unreg, 0) },
  ];

  const isSuperadmin = user?.permissions?.includes('__superadmin__');
  const rolePill = isSuperadmin
    ? { icon: 'fas fa-crown', text: 'Super Admin', bg: 'rgba(245,158,11,0.12)', color: '#d97706' }
    : user?.is_admin
    ? { icon: 'fas fa-user-shield', text: 'Admin', bg: 'rgba(99,102,241,0.1)', color: '#6366f1' }
    : { icon: 'fas fa-user', text: 'User', bg: 'rgba(100,116,139,0.1)', color: '#64748b' };

  const canSeeAll  = hasPermission('all_students');
  const canSeeUnreg = hasPermission('unregistered_students');

  return (
    <>
    <Helmet>
        <title>Dashboard | Admin Panel</title>
      </Helmet>
    <div className="flex flex-col gap-3 h-full">

      {/* ── Welcome Bar ── */}
      <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-[16px] font-black shadow-md shadow-indigo-200">
            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[15px] font-bold text-gray-900">{greeting()}, {user?.name || 'Admin'}</p>
              <span
                className="text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: rolePill.bg, color: rolePill.color }}
              >
                <i className={`${rolePill.icon} text-[9px]`}></i> {rolePill.text}
              </span>
            </div>
            <p className="text-[11px] text-gray-400">Welcome back to your admin panel</p>
          </div>
        </div>
        <LiveClock />
      </div>

      {/* ── Primary Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-shrink-0">
        <StatCard
          title="Total Students" value={total}
          subtitle="All time registrations"
          icon="fas fa-users" badge="All time"
          barColor="#3b82f6" barWidth="100%"
          iconBg="#eff6ff" iconColor="#3b82f6"
          badgeBg="#dbeafe" badgeColor="#1d4ed8"
          onClick={canSeeAll ? () => navigate('/students/all') : undefined}
        />
        <StatCard
          title="Registered" value={reg}
          subtitle={`${pct}% of total students`}
          icon="fas fa-user-check" badge={`${pct}%`}
          barColor="#22c55e" barWidth={`${pct}%`}
          iconBg="#f0fdf4" iconColor="#16a34a"
          badgeBg="#dcfce7" badgeColor="#15803d"
          onClick={canSeeAll ? () => navigate('/students/all') : undefined}
        />
        <StatCard
          title="Unregistered" value={unreg}
          subtitle={`${100 - pct}% pending registration`}
          icon="fas fa-user-xmark" badge={`${100 - pct}%`}
          barColor="#ef4444" barWidth={`${100 - pct}%`}
          iconBg="#fef2f2" iconColor="#dc2626"
          badgeBg="#fee2e2" badgeColor="#b91c1c"
          onClick={canSeeUnreg ? () => navigate('/students/unregistered') : undefined}
        />
        <StatCard
          title="Online Now" value={online}
          subtitle="Active users right now"
          icon="fas fa-wifi" badge="Live"
          barColor="#f59e0b" barWidth="60%"
          iconBg="#fffbeb" iconColor="#d97706"
          badgeBg="#fef3c7" badgeColor="#b45309"
        />
      </div>

      {/* ── Charts ── */}
      <div className="flex-1 min-h-0">
        <Suspense
          fallback={
            <div className="grid gap-3 h-full" style={{ gridTemplateColumns: '1fr 240px' }}>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center justify-center h-full min-h-[320px]">
                <div className="flex items-center gap-2">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-2 h-2 rounded-full bg-indigo-400"
                      style={{ animation: 'dotBounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.18}s` }} />
                  ))}
                  <style>{`@keyframes dotBounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-8px);opacity:1}}`}</style>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-full min-h-[320px]" />
            </div>
          }
        >
          <LazyCharts
            chartData={chartData}
            chartDays={chartDays}
            setChartDays={(d) => {
              setChartDays(d);
              const hit = cacheGet(`chart_${d}`);
              if (hit) setChart(hit);
            }}
            donutData={donutData}
            reg={reg} unreg={unreg} pct={pct} online={online}
          />
        </Suspense>
      </div>

      {/* ── Secondary Info Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 flex-shrink-0">
        <InfoCard
          icon="fas fa-user-plus" label="Today Signups" value={today}
          bg="#eff6ff" color="#3b82f6"
        />
        <InfoCard
          icon="fas fa-calendar-week" label="This Week" value={week}
          bg="#f0fdf4" color="#16a34a"
        />
        <InfoCard
          icon="fas fa-indian-rupee-sign" label="Total Revenue" value={revenue}
          bg="#fefce8" color="#ca8a04"
        />
        <InfoCard
          icon="fas fa-rotate-left" label="Pending Refunds" value={refunds}
          bg="#fff7ed" color="#ea580c"
          onClick={() => navigate('/refunds')}
        />
        <InfoCard
          icon="fas fa-headset" label="Open Tickets" value={tickets}
          bg="#fdf4ff" color="#9333ea"
          onClick={() => navigate('/support')}
        />
        <InfoCard
          icon="fas fa-briefcase" label="Active Internships" value={interns}
          bg="#f0fdfa" color="#0d9488"
          onClick={() => navigate('/internships')}
        />
      </div>
    </div>
    </>
  );
}