// // import { useState, useEffect } from 'react';
// // import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
// // import { useAuth } from '../hooks/useAuth';

// // // ══════════════════════════════════════════════════════════════
// // // Complete sidebar menu — EXACT copy of PHP admin_sidebar.php
// // // Every group, every item, every icon, every perm_key, in order
// // // ══════════════════════════════════════════════════════════════
// // const sidebarMenu = [
// //   { key: 'dashboard', group: 'Dashboard', icon: 'fas fa-gauge-high', items: [
// //     { text: 'Dashboard', link: '/', icon: 'fas fa-gauge-high', perm: 'dashboard' },
// //   ]},
// //   { key: 'student_management', group: 'Student Management', icon: 'fas fa-users', items: [
// //     { text: 'All Students', link: '/students/all', icon: 'fas fa-user-group', perm: 'all_students' },
// //     { text: 'All IIT Students', link: '/students/iit', icon: 'fas fa-graduation-cap', perm: 'all_iit_students' },
// //     { text: 'Unregistered Students', link: '/students/unregistered', icon: 'fas fa-user-xmark', perm: 'unregistered_students' },
// //     { text: 'Registration Checker', link: '/students/registration-checker', icon: 'fas fa-clipboard-check', perm: 'registration_checker' },
// //     { text: 'Download Student Data', link: '/students/download', icon: 'fas fa-file-arrow-down', perm: 'download_student_data' },
// //     { text: 'Students With IP', link: '/students/ip-log', icon: 'fas fa-network-wired', perm: 'students_with_ip' },
// //   ]},
// //   { key: 'referral_management', group: 'Referral Management', icon: 'fas fa-handshake', items: [
// //     { text: 'Manage Referrals', link: '/referrals', icon: 'fas fa-gift', perm: 'manage_referrals' },
// //     { text: 'Manage Withdrawal', link: '/referrals/withdrawals', icon: 'fas fa-money-bill-transfer', perm: 'manage_withdrawal' },
// //   ]},
// //   { key: 'refund_management', group: 'Refund Management', icon: 'fas fa-rotate-left', items: [
// //     { text: 'Manage Refund', link: '/refunds', icon: 'fas fa-receipt', perm: 'manage_refund' },
// //   ]},
// //   { key: 'domain_management', group: 'Domain Management', icon: 'fas fa-globe', items: [
// //     { text: 'Manage Domains', link: '/domains', icon: 'fas fa-earth-asia', perm: 'manage_domains' },
// //   ]},
// //   { key: 'netcore', group: 'Netcore', icon: 'fas fa-network-wired', items: [
// //     { text: 'Netcore Behaviour', link: '/netcore/behaviour', icon: 'fas fa-chart-line', perm: 'netcore_behaviour' },
// //     { text: 'Netcore Filter', link: '/netcore/filter', icon: 'fas fa-filter', perm: 'netcore_filter' },
// //   ]},
// //   { key: 'homepage', group: 'Homepage', icon: 'fas fa-house', items: [
// //     { text: 'Homepage', link: 'https://cit3.internshipstudio.com/jobs', icon: 'fas fa-toolbox', perm: 'homepage', external: true },
// //   ]},
// //   { key: 'internships', group: 'Internships', icon: 'fas fa-briefcase', items: [
// //     { text: 'Internship List', link: '/internships', icon: 'fas fa-list-check', perm: 'internship_list' },
// //     { text: 'Purchased Internships', link: '/internships/purchased', icon: 'fas fa-credit-card', perm: 'purchased_internships' },
// //     { text: 'Allocate Internships', link: '/internships/allocate', icon: 'fas fa-layer-group', perm: 'allocate_internships' },
// //     { text: 'Project Submission', link: '/internships/projects', icon: 'fas fa-file-circle-check', perm: 'project_submission' },
// //     { text: 'Check Payments', link: '/internships/payments', icon: 'fas fa-money-check-dollar', perm: 'check_payments' },
// //     { text: 'Manage Coupons', link: '/internships/coupons', icon: 'fas fa-tag', perm: 'manage_coupons' },
// //   ]},
// //   { key: 'blogs', group: 'Blogs', icon: 'fas fa-pen-nib', items: [
// //     { text: 'Add Blogs', link: '/blogs/add', icon: 'fas fa-pen-to-square', perm: 'add_blogs' },
// //     { text: 'Manage Blogs', link: '/blogs', icon: 'fas fa-newspaper', perm: 'manage_blogs' },
// //   ]},
// //   { key: 'faqs', group: 'FAQs', icon: 'fas fa-circle-question', items: [
// //     { text: 'Manage FAQs', link: '/faqs', icon: 'fas fa-question-circle', perm: 'manage_faqs' },
// //   ]},
// //   { key: 'total_assessments', group: 'Total Assessments', icon: 'fas fa-square-poll-vertical', items: [
// //     { text: 'Total Assessments', link: '/assessments', icon: 'fas fa-chart-bar', perm: 'total_assessments' },
// //   ]},
// //   { key: 'communication', group: 'Communication', icon: 'fas fa-comments', items: [
// //     { text: 'Send Notification', link: '/communication/notification', icon: 'fas fa-bell', perm: 'send_notification' },
// //     { text: 'Delete Notification', link: '/communication/delete-notification', icon: 'fas fa-bell-slash', perm: 'delete_notification' },
// //     { text: 'WhatsApp Community', link: '/communication/whatsapp', icon: 'fab fa-whatsapp', perm: 'whatsapp_community' },
// //     { text: 'Email Templates', link: '/communication/email-templates', icon: 'fas fa-envelope', perm: 'email_templates' },
// //     { text: 'Campaign Emails', link: '/communication/email', icon: 'fas fa-envelope-open-text', perm: 'campaign_emails' },
// //     { text: 'Push Notification', link: '/communication/push', icon: 'fas fa-satellite-dish', perm: 'push_notification' },
// //   ]},
// //   { key: 'examinations', group: 'Examinations', icon: 'fas fa-file-pen', items: [
// //     { text: 'Exam Result', link: '/exams/results', icon: 'fas fa-poll', perm: 'exam_result' },
// //     { text: 'Exam Not Given', link: '/exams/not-given', icon: 'fas fa-ban', perm: 'exam_not_given' },
// //     { text: 'CIT Versions', link: '/exams/versions', icon: 'fas fa-code-branch', perm: 'cit_versions' },
// //     { text: 'Free Internship Applicants', link: '/exams/free-applicants', icon: 'fas fa-list', perm: 'free_internship_applicants' },
// //     { text: 'Exam Panel Admin', link: '/exams/panel', icon: 'fas fa-user-shield', perm: 'exam_panel_admin', external: true },
// //     { text: 'Exam Result (New Panel)', link: '/exams/results-new', icon: 'fas fa-chart-column', perm: 'exam_result_new_panel' },
// //   ]},
// //   { key: 'reporting_analysis', group: 'Reporting & Analysis', icon: 'fas fa-chart-pie', items: [
// //     { text: 'Batch Dates', link: '/reports/batch-dates', icon: 'fas fa-calendar-days', perm: 'batch_dates' },
// //     { text: 'Reports', link: '/reports', icon: 'fas fa-chart-line', perm: 'reports' },
// //     { text: 'Agency Reports 1', link: '/reports/agency-1', icon: 'fas fa-chart-pie', perm: 'agency_reports_1' },
// //     { text: 'Agency Reports 2', link: '/reports/agency-2', icon: 'fas fa-chart-bar', perm: 'agency_reports_2' },
// //     { text: 'Meta Reports (Old)', link: '/reports/meta-old', icon: 'fas fa-clock-rotate-left', perm: 'meta_reports_old', external: true },
// //     { text: 'Meta Reports (New)', link: '/reports/meta-new', icon: 'fas fa-bolt', perm: 'meta_reports_new', external: true },
// //     { text: 'Matching Data', link: '/reports/matching', icon: 'fas fa-database', perm: 'matching_data' },
// //     { text: 'Clarity Data', link: '/reports/clarity', icon: 'fas fa-eye', perm: 'clarity_data' },
// //     { text: 'User Availability', link: '/reports/availability', icon: 'fas fa-user-clock', perm: 'user_availability' },
// //   ]},
// //   { key: 'company_management', group: 'Company Management', icon: 'fas fa-building', items: [
// //     { text: 'All Companies', link: '/companies', icon: 'fas fa-city', perm: 'all_companies' },
// //     { text: 'All IIT Companies', link: '/companies/iit', icon: 'fas fa-university', perm: 'all_iit_companies' },
// //     { text: 'TPO & HOD Details', link: '/companies/tpo-hod', icon: 'fas fa-address-card', perm: 'tpo_hod_details' },
// //   ]},
// //   { key: 'support_management', group: 'Support', icon: 'fas fa-headset', items: [
// //     { text: 'WhatsApp Community Links', link: '/support/wa-links', icon: 'fab fa-whatsapp', perm: 'whatsapp_community_links' },
// //     { text: 'Placement Club Links', link: '/support/placement-links', icon: 'fab fa-whatsapp', perm: 'placement_club_links' },
// //     { text: 'Support Tickets', link: '/support', icon: 'fas fa-life-ring', perm: 'support_tickets' },
// //     { text: 'Support Agents', link: '/support/agents', icon: 'fas fa-user-tie', perm: 'support_agents' },
// //     { text: 'Instant Exam WA Link', link: '/support/instant-wa', icon: 'fas fa-link', perm: 'instant_exam_wa_link' },
// //     { text: 'Custom Placement Date', link: '/support/custom-date', icon: 'fas fa-calendar-plus', perm: 'custom_placement_date' },
// //     { text: 'Placement Link Log', link: '/support/link-log', icon: 'fas fa-triangle-exclamation', perm: 'placement_link_log' },
// //   ]},
// //   { key: 'settings', group: 'Settings', icon: 'fas fa-gear', items: [
// //     { text: 'Settings', link: '/settings', icon: 'fas fa-sliders', perm: 'settings' },
// //     { text: 'Change AWS Instance', link: '/settings/aws', icon: 'fab fa-aws', perm: 'change_aws_instance' },
// //     { text: 'Seed Exam Users', link: '/settings/seed-exam', icon: 'fas fa-seedling', perm: 'seed_exam_users' },
// //     { text: 'Delete Excess Exam Users', link: '/settings/delete-exam-users', icon: 'fas fa-trash-can', perm: 'delete_excess_exam_users' },
// //   ]},
// //   { key: 'admin_panel', group: 'Admin Panel', icon: 'fas fa-screwdriver-wrench', items: [
// //     { text: 'Career Roadmaps', link: 'https://cit3.internshipstudio.com/roadmap', icon: 'fas fa-map-signs', perm: 'career_roadmaps', external: true },
// //     { text: 'Add Data For Result Page', link: '/admin-panel/result-data', icon: 'fas fa-plus-circle', perm: 'add_data_result_page', external: true },
// //     { text: 'Internships (Public)', link: 'https://cit3.internshipstudio.com/internship', icon: 'fas fa-briefcase', perm: 'internships_public', external: true },
// //     { text: 'Skills', link: 'https://cit3.internshipstudio.com/skills', icon: 'fas fa-tools', perm: 'skills', external: true },
// //     { text: 'Submitted Assignments', link: '/admin-panel/assignments', icon: 'fas fa-paper-plane', perm: 'submitted_assignments' },
// //   ]},
// //   { key: 'permissions', group: 'Permissions', icon: 'fas fa-lock', superadminOnly: true, items: [
// //     { text: 'Manage Permissions', link: '/permissions', icon: 'fas fa-user-lock', perm: 'permissions' },
// //   ]},
// // ];

// // export default function AdminLayout() {
// //   const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === '1');
// //   const [mobileOpen, setMobileOpen] = useState(false);
// //   const [openGroup, setOpenGroup] = useState('');
// //   const [searchQuery, setSearchQuery] = useState('');
// //   const [avatarOpen, setAvatarOpen] = useState(false);
// //   const [navSearch, setNavSearch] = useState('');
// //   const { user, logout, hasPermission } = useAuth();
// //   const navigate = useNavigate();
// //   const location = useLocation();

// //   const isSuperadmin = user?.permissions?.includes('__superadmin__');
// //   const isAdmin = user?.is_admin || isSuperadmin;

// //   // Role label matching PHP
// //   const roleLabel = isSuperadmin ? 'Super Admin' : isAdmin ? 'Admin' : 'User';
// //   const roleIcon = isSuperadmin ? 'fas fa-crown' : isAdmin ? 'fas fa-user-shield' : 'fas fa-user';
// //   const roleClass = isSuperadmin ? 'role-superadmin' : isAdmin ? 'role-admin' : 'role-user';

// //   // Find active group on route change
// //   useEffect(() => {
// //     for (const group of sidebarMenu) {
// //       for (const item of group.items) {
// //         if (!item.external && (item.link === location.pathname || (item.link !== '/' && location.pathname.startsWith(item.link)))) {
// //           setOpenGroup(group.key);
// //           return;
// //         }
// //       }
// //     }
// //   }, [location.pathname]);

// //   // Close avatar dropdown on outside click
// //   useEffect(() => {
// //     const handler = (e) => { if (!e.target.closest('.is-navbar-avatar-wrap')) setAvatarOpen(false); };
// //     document.addEventListener('click', handler);
// //     return () => document.removeEventListener('click', handler);
// //   }, []);

// //   const toggleCollapsed = () => {
// //     const next = !collapsed;
// //     setCollapsed(next);
// //     localStorage.setItem('sidebarCollapsed', next ? '1' : '0');
// //   };

// //   const handleLogout = async () => { await logout(); navigate('/login'); };

// //   const isActive = (link) => {
// //     if (link === '/') return location.pathname === '/';
// //     return location.pathname === link || location.pathname.startsWith(link + '/');
// //   };

// //   // Filter menu by permissions and search
// //   const filteredMenu = sidebarMenu
// //     .filter(g => !g.superadminOnly || isSuperadmin)
// //     .map(g => ({
// //       ...g,
// //       items: g.items.filter(item => {
// //         if (!hasPermission(item.perm)) return false;
// //         if (searchQuery) return item.text.toLowerCase().includes(searchQuery.toLowerCase()) || g.group.toLowerCase().includes(searchQuery.toLowerCase());
// //         return true;
// //       }),
// //     }))
// //     .filter(g => g.items.length > 0);

// //   const navInitial = user?.name?.charAt(0)?.toUpperCase() || 'A';

// //   return (
// //     <div className="flex min-h-screen" style={{ background: '#f1f4f9' }}>
// //       {/* Mobile overlay */}
// //       {mobileOpen && <div className="fixed inset-0 bg-black/40 z-[299] lg:hidden backdrop-blur-sm" onClick={() => setMobileOpen(false)} />}

// //       {/* ══════ SIDEBAR ══════ */}
// //       <aside className={`fixed top-[62px] left-0 h-[calc(100vh-62px)] bg-white z-[300] flex flex-col transition-all duration-300 overflow-hidden
// //         ${collapsed ? 'w-[56px]' : 'w-[268px]'}
// //         ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
// //         style={{ borderRight: '2px solid #e2e8f0', boxShadow: '2px 0 12px rgba(0,0,0,0.05)' }}>

// //         {/* Sidebar search */}
// //         {!collapsed && (
// //           <div className="sticky top-0 z-50 bg-white px-2.5 py-2.5" style={{ borderBottom: '1px solid #e2e8f0' }}>
// //             <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
// //               placeholder="Search menu..."
// //               className="w-full pl-8 pr-3 py-2 text-[12.5px] border rounded-lg outline-none"
// //               style={{ borderColor: '#e2e8f0', background: '#f8fafc' }} />
// //             <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: '#94a3b8' }}></i>
// //           </div>
// //         )}

// //         {/* Nav groups */}
// //         <nav className="flex-1 overflow-y-auto overflow-x-hidden px-1.5 py-2 space-y-0.5"
// //           style={{ scrollbarWidth: 'thin', scrollbarColor: '#e2e8f0 #f8fafc' }}>
// //           {filteredMenu.map(group => {
// //             const isGroupActive = group.items.some(item => !item.external && isActive(item.link));
// //             const isOpen = openGroup === group.key || !!searchQuery;

// //             return (
// //               <div key={group.key} className="relative group/sb">
// //                 {/* Group header */}
// //                 <button onClick={() => { if (!collapsed) setOpenGroup(isOpen && !searchQuery ? '' : group.key); }}
// //                   className="w-full flex items-center gap-2.5 py-2 rounded-lg cursor-pointer select-none transition-all"
// //                   style={{
// //                     padding: collapsed ? '8px' : '8px 10px',
// //                     justifyContent: collapsed ? 'center' : 'flex-start',
// //                     background: isGroupActive ? '#eef2ff' : isOpen ? '#e8eeff50' : 'transparent',
// //                   }}>
// //                   <span className="w-[30px] h-[30px] rounded-[7px] flex items-center justify-center shrink-0 text-[13px] transition-all"
// //                     style={{
// //                       background: isGroupActive ? '#4f46e5' : isOpen ? '#e0e7ff' : '#f1f5f9',
// //                       color: isGroupActive ? '#fff' : isOpen ? '#4f46e5' : '#64748b',
// //                     }}>
// //                     <i className={group.icon}></i>
// //                   </span>
// //                   {!collapsed && (
// //                     <>
// //                       <span className="flex-1 text-[13px] font-semibold text-left truncate transition-colors"
// //                         style={{ color: isGroupActive ? '#4f46e5' : isOpen ? '#1e293b' : '#475569', fontWeight: isGroupActive ? 700 : 600 }}>
// //                         {group.group}
// //                       </span>
// //                       <i className={`fas fa-chevron-down text-[10px] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
// //                         style={{ color: isOpen ? '#94a3b8' : '#cbd5e1' }}></i>
// //                     </>
// //                   )}
// //                 </button>

// //                 {/* Collapsed tooltip flyout */}
// //                 {collapsed && (
// //                   <div className="absolute left-[52px] top-0 min-w-[200px] bg-white border rounded-xl shadow-xl z-[9000] p-1.5 opacity-0 pointer-events-none -translate-x-2 transition-all group-hover/sb:opacity-100 group-hover/sb:pointer-events-auto group-hover/sb:translate-x-0"
// //                     style={{ borderColor: '#e2e8f0' }}>
// //                     <div className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5" style={{ color: '#94a3b8' }}>{group.group}</div>
// //                     {group.items.map(item => item.external ? (
// //                       <a key={item.link} href={item.link} target="_blank" rel="noopener"
// //                         className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap text-gray-500 hover:bg-gray-50 hover:text-indigo-600">
// //                         <i className={`${item.icon} text-[11px] w-3.5`}></i>{item.text}<i className="fas fa-arrow-up-right-from-square text-[8px] ml-auto opacity-40"></i>
// //                       </a>
// //                     ) : (
// //                       <NavLink key={item.link} to={item.link}
// //                         className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${isActive(item.link) ? 'text-indigo-600 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-indigo-600'}`}
// //                         style={isActive(item.link) ? { background: '#eef2ff' } : {}}>
// //                         <i className={`${item.icon} text-[11px] w-3.5`}></i>{item.text}
// //                       </NavLink>
// //                     ))}
// //                   </div>
// //                 )}

// //                 {/* Expanded items list */}
// //                 {!collapsed && (
// //                   <div className="overflow-hidden transition-all duration-300"
// //                     style={{ maxHeight: isOpen ? '900px' : '0px', opacity: isOpen ? 1 : 0 }}>
// //                     <ul className="py-0.5" style={isOpen ? { background: '#e8eeff30', borderRadius: '0 0 8px 8px' } : {}}>
// //                       {group.items.map(item => item.external ? (
// //                         <li key={item.link}>
// //                           <a href={item.link} target="_blank" rel="noopener"
// //                             className="flex items-center gap-2 mx-1 ml-2 px-2.5 py-[7px] rounded-[7px] text-[12.5px] font-medium transition relative text-gray-500 hover:text-indigo-600"
// //                             style={{ color: '#64748b' }}>
// //                             <i className={`${item.icon} text-[12px] w-3.5`} style={{ color: '#94a3b8' }}></i>
// //                             <span className="truncate">{item.text}</span>
// //                             <i className="fas fa-arrow-up-right-from-square text-[8px] ml-auto opacity-40"></i>
// //                           </a>
// //                         </li>
// //                       ) : (
// //                         <li key={item.link}>
// //                           <NavLink to={item.link} onClick={() => setMobileOpen(false)}
// //                             className="flex items-center gap-2 mx-1 ml-2 px-2.5 py-[7px] rounded-[7px] text-[12.5px] font-medium transition relative"
// //                             style={isActive(item.link)
// //                               ? { background: '#4f46e5', color: '#fff', fontWeight: 600 }
// //                               : { color: '#64748b' }}>
// //                             {isActive(item.link) && <span className="absolute left-0 top-[18%] h-[64%] w-[3px] bg-white rounded-r"></span>}
// //                             <i className={`${item.icon} text-[12px] w-3.5`}
// //                               style={{ color: isActive(item.link) ? '#fff' : '#94a3b8' }}></i>
// //                             <span className="truncate">{item.text}</span>
// //                           </NavLink>
// //                         </li>
// //                       ))}
// //                     </ul>
// //                   </div>
// //                 )}
// //               </div>
// //             );
// //           })}
// //         </nav>
// //       </aside>

// //       {/* ══════ EDGE TOGGLE BUTTON ══════ */}
// //       <button onClick={toggleCollapsed}
// //         className="fixed z-[1001] hidden lg:flex items-center justify-center cursor-pointer border-none text-white"
// //         style={{
// //           top: 65, left: collapsed ? 50 : 266,
// //           width: 26, height: 38,
// //           borderRadius: '0 28px 28px 0',
// //           background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
// //           boxShadow: '0 6px 16px rgba(79,70,229,0.25)',
// //           transition: 'left 0.28s cubic-bezier(.4,0,.2,1)',
// //         }}>
// //         <i className={`fas fa-chevron-${collapsed ? 'right' : 'left'} text-[12px]`}></i>
// //       </button>

// //       {/* ══════ MAIN CONTENT ══════ */}
// //       <div className="flex-1 min-w-0 transition-all duration-300"
// //         style={{ marginLeft: collapsed ? 56 : 268 }}>

// //         {/* ══════ NAVBAR — exact copy of PHP admin_navbar.php ══════ */}
// //         <header className="sticky top-0 z-[400] flex items-center gap-4 px-5"
// //           style={{ height: 62, background: '#fff', boxShadow: '0 1px 0 0 #e2e8f0', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>

// //           {/* Brand */}
// //           <a href="/" className="flex items-center gap-2.5 no-underline shrink-0" style={{ width: collapsed ? 36 : 'auto' }}>
// //             <div className="flex items-center justify-center shrink-0"
// //               style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg, #6366f1, #818cf8)', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }}>
// //               <i className="fas fa-graduation-cap text-white text-[16px]"></i>
// //             </div>
// //             {!collapsed && (
// //               <div className="flex flex-col leading-tight overflow-hidden whitespace-nowrap">
// //                 <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Internship Studio</span>
// //                 <span style={{ fontSize: 10, fontWeight: 500, color: '#94a3b8', letterSpacing: '0.03em', textTransform: 'uppercase' }}>ADMIN PANEL</span>
// //               </div>
// //             )}
// //           </a>

// //           {/* Divider */}
// //           <div style={{ width: 1, height: 28, background: '#e2e8f0', flexShrink: 0 }}></div>

// //           {/* Mobile hamburger */}
// //           <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
// //             <i className="fas fa-bars text-gray-600"></i>
// //           </button>

// //           {/* Global search */}
// //           <div className="flex-1 max-w-[420px] relative hidden sm:block">
// //             <i className="fas fa-search absolute left-[13px] top-1/2 -translate-y-1/2 text-[13px]" style={{ color: '#94a3b8' }}></i>
// //             <input type="text" value={navSearch} onChange={e => setNavSearch(e.target.value)}
// //               placeholder="Search students, settings..."
// //               className="w-full outline-none"
// //               style={{ height: 38, padding: '0 16px 0 40px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#f8fafc', fontSize: '13.5px', color: '#1e293b', fontFamily: 'inherit' }} />
// //           </div>

// //           {/* Right side */}
// //           <div className="ml-auto flex items-center gap-2">
// //             {/* Role tag */}
// //             <span className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold ${roleClass}`}
// //               style={{
// //                 background: isSuperadmin ? 'rgba(245,158,11,0.12)' : isAdmin ? 'rgba(99,102,241,0.1)' : 'rgba(100,116,139,0.1)',
// //                 color: isSuperadmin ? '#d97706' : isAdmin ? '#6366f1' : '#64748b',
// //               }}>
// //               <i className={`${roleIcon} text-[10px]`}></i> {roleLabel}
// //             </span>

// //             {/* Notification bell */}
// //             <button className="relative w-[38px] h-[38px] border-none bg-transparent cursor-pointer rounded-[10px] flex items-center justify-center hover:bg-gray-100 transition"
// //               style={{ color: '#64748b', fontSize: 16 }}
// //               onClick={() => hasPermission('send_notification') ? navigate('/communication/notification') : null}>
// //               <i className="fas fa-bell"></i>
// //               <span className="absolute w-2 h-2 rounded-full" style={{ top: 5, right: 5, background: '#ef4444', border: '1.5px solid #fff' }}></span>
// //             </button>

// //             {/* All students shortcut */}
// //             <button className="w-[38px] h-[38px] border-none bg-transparent cursor-pointer rounded-[10px] flex items-center justify-center hover:bg-gray-100 transition"
// //               style={{ color: '#64748b', fontSize: 16 }}
// //               onClick={() => hasPermission('all_students') ? navigate('/students/all') : null}>
// //               <i className="fas fa-users"></i>
// //             </button>

// //             {/* Avatar dropdown */}
// //             <div className="is-navbar-avatar-wrap relative">
// //               <div onClick={() => setAvatarOpen(!avatarOpen)}
// //                 className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold cursor-pointer shrink-0"
// //                 style={{ background: 'linear-gradient(135deg, #6366f1, #a78bfa)', border: '2px solid #e0e7ff' }}>
// //                 {user?.photo ? <img src={user.photo} className="w-full h-full rounded-full object-cover" /> : navInitial}
// //               </div>

// //               {avatarOpen && (
// //                 <div className="absolute top-[calc(100%+10px)] right-0 w-[230px] bg-white rounded-[14px] overflow-hidden z-[999]"
// //                   style={{ border: '1.5px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
// //                   <div className="px-4 py-3.5" style={{ borderBottom: '1px solid #f1f5f9' }}>
// //                     <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>{user?.name || 'Admin'}</div>
// //                     <div style={{ fontSize: '11.5px', color: '#94a3b8', wordBreak: 'break-all' }}>{user?.email}</div>
// //                     <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold"
// //                       style={{
// //                         background: isSuperadmin ? 'rgba(245,158,11,0.12)' : isAdmin ? 'rgba(99,102,241,0.1)' : 'rgba(100,116,139,0.1)',
// //                         color: isSuperadmin ? '#d97706' : isAdmin ? '#6366f1' : '#64748b',
// //                       }}>{roleLabel}</span>
// //                   </div>
// //                   {isSuperadmin && (
// //                     <a onClick={() => { setAvatarOpen(false); navigate('/permissions'); }}
// //                       className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer transition hover:bg-gray-50 no-underline" style={{ color: '#475569', fontSize: 13 }}>
// //                       <span className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[12px]" style={{ background: '#f1f5f9', color: '#6366f1' }}><i className="fas fa-user-lock"></i></span>
// //                       Manage Permissions
// //                     </a>
// //                   )}
// //                   <a onClick={() => { setAvatarOpen(false); navigate('/settings'); }}
// //                     className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer transition hover:bg-gray-50 no-underline" style={{ color: '#475569', fontSize: 13 }}>
// //                     <span className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[12px]" style={{ background: '#f1f5f9', color: '#6366f1' }}><i className="fas fa-gear"></i></span>
// //                     Settings
// //                   </a>
// //                   <a onClick={handleLogout}
// //                     className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer transition hover:bg-red-50 no-underline" style={{ color: '#ef4444', fontSize: 13 }}>
// //                     <span className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[12px]" style={{ background: '#fef2f2', color: '#ef4444' }}><i className="fas fa-right-from-bracket"></i></span>
// //                     Sign Out
// //                   </a>
// //                 </div>
// //               )}
// //             </div>
// //           </div>
// //         </header>

// //         {/* Page content */}
// //         <main style={{ padding: '16px 20px', minHeight: 'calc(100vh - 62px)' }}>
// //           <Outlet />
// //         </main>
// //       </div>
// //     </div>
// //   );
// // }












// import { useState, useEffect } from 'react';
// import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
// import { useAuth } from '../hooks/useAuth';

// const sidebarMenu = [
//   {
//     key: 'dashboard', group: 'Dashboard', icon: 'fas fa-gauge-high', items: [
//       { text: 'Dashboard', link: '/', icon: 'fas fa-gauge-high', perm: 'dashboard' },
//     ]
//   },
//   {
//     key: 'student_management', group: 'Student Management', icon: 'fas fa-users', items: [
//       { text: 'All Students', link: '/students/all', icon: 'fas fa-user-group', perm: 'all_students' },
//       { text: 'All IIT Students', link: '/students/iit', icon: 'fas fa-graduation-cap', perm: 'all_iit_students' },
//       { text: 'Unregistered Students', link: '/students/unregistered', icon: 'fas fa-user-xmark', perm: 'unregistered_students' },
//       { text: 'Registration Checker', link: '/students/registration-checker', icon: 'fas fa-clipboard-check', perm: 'registration_checker' },
//       { text: 'Download Student Data', link: '/students/download', icon: 'fas fa-file-arrow-down', perm: 'download_student_data' },
//       { text: 'Students With IP', link: '/students/ip-log', icon: 'fas fa-network-wired', perm: 'students_with_ip' },
//     ]
//   },
//   {
//     key: 'referral_management', group: 'Referral Management', icon: 'fas fa-handshake', items: [
//       { text: 'Manage Referrals', link: '/referrals', icon: 'fas fa-gift', perm: 'manage_referrals', exact: true },
//       { text: 'Manage Withdrawal', link: '/referrals/withdrawals', icon: 'fas fa-money-bill-transfer', perm: 'manage_withdrawal' },
//     ]
//   },
//   {
//     key: 'refund_management', group: 'Refund Management', icon: 'fas fa-rotate-left', items: [
//       { text: 'Manage Refund', link: '/refunds', icon: 'fas fa-receipt', perm: 'manage_refund', exact: true },
//       { text: 'Refund (New)', link: '/refunds/new', icon: 'fas fa-gift', perm: 'manage_refund' },
//     ]
//   },
//   // {
//   //   key: 'domain_management', group: 'Domain Management', icon: 'fas fa-globe', items: [
//   //     { text: 'Manage Domains', link: '/domains', icon: 'fas fa-earth-asia', perm: 'manage_domains' },
//   //   ]
//   // },
//   {
//     key: 'netcore', group: 'Netcore', icon: 'fas fa-network-wired', items: [
//       { text: 'Netcore Behaviour', link: '/netcore/behaviour', icon: 'fas fa-chart-line', perm: 'netcore_behaviour' },
//       // { text: 'Netcore Filter', link: '/netcore/filter', icon: 'fas fa-filter', perm: 'netcore_filter' },
//     ]
//   },
//   {
//     key: 'homepage', group: 'Homepage', icon: 'fas fa-house', items: [
//       { text: 'Homepage', link: '/homepage', icon: 'fas fa-toolbox', perm: 'homepage' },
//     ]
//   },
//   {
//     key: 'internships', group: 'Internships', icon: 'fas fa-briefcase', items: [
//       { text: 'Internship List', link: '/internships', icon: 'fas fa-list-check', perm: 'internship_list', exact: true },
//       { text: 'Purchased Internships', link: '/internships/purchased', icon: 'fas fa-credit-card', perm: 'purchased_internships' },
//       { text: 'Allocate Internships', link: '/internships/allocate', icon: 'fas fa-layer-group', perm: 'allocate_internships' },
//       { text: 'Project Submission', link: '/internships/projects', icon: 'fas fa-file-circle-check', perm: 'project_submission' },
//       { text: 'Check Payments', link: '/internships/payments', icon: 'fas fa-money-check-dollar', perm: 'check_payments' },
//       { text: 'Manage Coupons', link: '/internships/coupons', icon: 'fas fa-tag', perm: 'manage_coupons' },
//     ]
//   },
//   {
//     key: 'blogs', group: 'Blogs', icon: 'fas fa-pen-nib', items: [
//       { text: 'Add Blogs', link: '/blogs/add', icon: 'fas fa-pen-to-square', perm: 'add_blogs' },
//       { text: 'Manage Blogs', link: '/blogs', icon: 'fas fa-newspaper', perm: 'manage_blogs', exact: true },
//     ]
//   },
//   {
//     key: 'faqs', group: 'FAQs', icon: 'fas fa-circle-question', items: [
//       { text: 'Manage FAQs', link: '/faqs', icon: 'fas fa-question-circle', perm: 'manage_faqs' },
//     ]
//   },
//   {
//     key: 'total_assessments', group: 'Total Assessments', icon: 'fas fa-square-poll-vertical', items: [
//       { text: 'Total Assessments', link: '/assessments', icon: 'fas fa-chart-bar', perm: 'total_assessments' },
//     ]
//   },
//   {
//     key: 'communication', group: 'Communication', icon: 'fas fa-comments', items: [
//       { text: 'Send Notification', link: '/communication/notification', icon: 'fas fa-bell', perm: 'send_notification' },
//       { text: 'Manage Notification', link: '/communication/manage', icon: 'fas fa-bell-slash', perm: 'delete_notification' },
//       { text: 'WhatsApp Community', link: '/communication/whatsapp', icon: 'fab fa-whatsapp', perm: 'whatsapp_community' },
//       { text: 'Email Templates', link: '/communication/email-templates', icon: 'fas fa-envelope', perm: 'email_templates' },
//       { text: 'Small Campaign Emails', link: '/communication/email', icon: 'fas fa-envelope-open-text', perm: 'campaign_emails' },
//       { text: 'Push Notification', link: '/communication/push', icon: 'fas fa-satellite-dish', perm: 'push_notification' },
//     ]
//   },
//   {
//     key: 'examinations', group: 'Examinations', icon: 'fas fa-file-pen', items: [
//       { text: 'Exam Result', link: '/exams/results', icon: 'fas fa-poll', perm: 'exam_result', exact: true },
//       { text: 'Exam Not Given', link: '/exams/not-given', icon: 'fas fa-ban', perm: 'exam_not_given' },
//       { text: 'CIT Versions', link: '/exams/versions', icon: 'fas fa-code-branch', perm: 'cit_versions' },
//       { text: 'Free Internship Applicants', link: '/exams/free-applicants', icon: 'fas fa-list', perm: 'free_internship_applicants' },
//       { text: 'Exam Panel Admin', link: '/exams/panel', icon: 'fas fa-user-shield', perm: 'exam_panel_admin' },
//       { text: 'Exam Results For New Panel', link: '/exams/results-new', icon: 'fas fa-user-shield', perm: 'exam_results-new' },
//       { text: 'Auto Submitted Exams', link: '/exams/auto-submitted', icon: 'fas fa-warning', perm: 'auto_submitted_exams' },
//     ]
//   },
//   {
//     key: 'reporting_analysis', group: 'Reporting & Analysis', icon: 'fas fa-chart-pie', items: [
//       { text: 'Batch Dates', link: '/reports/batch-dates', icon: 'fas fa-calendar-days', perm: 'batch_dates' },
//       { text: 'Reports', link: '/reports', icon: 'fas fa-chart-line', perm: 'reports', exact: true },
//       { text: 'Agency Reports 1', link: '/reports/agency-1', icon: 'fas fa-chart-pie', perm: 'agency_reports_1' },
//       { text: 'Agency Reports 2', link: '/reports/agency-2', icon: 'fas fa-chart-bar', perm: 'agency_reports_2' },
//       { text: 'Meta Reports (Old)', link: '/reports/meta-old', icon: 'fas fa-clock-rotate-left', perm: 'meta_reports_old' },
//       { text: 'Meta Reports (New)', link: '/reports/meta-new', icon: 'fas fa-bolt', perm: 'meta_reports_new' },
//       { text: 'Matching Data', link: '/reports/matching', icon: 'fas fa-database', perm: 'matching_data' },
//       { text: 'Clarity Data', link: '/reports/clarity', icon: 'fas fa-eye', perm: 'clarity_data' },
//       { text: 'User Availability', link: '/reports/availability', icon: 'fas fa-user-clock', perm: 'user_availability' },
//     ]
//   },
//   {
//     key: 'company_management', group: 'Company Management', icon: 'fas fa-building', items: [
//       { text: 'All Companies', link: '/companies', icon: 'fas fa-city', perm: 'all_companies', exact: true },
//       { text: 'All IIT Companies', link: '/companies/iit', icon: 'fas fa-university', perm: 'all_iit_companies' },
//       { text: 'TPO & HOD Details', link: '/companies/tpo-hod', icon: 'fas fa-address-card', perm: 'tpo_hod_details' },
//     ]
//   },
//   {
//     key: 'support_management', group: 'Support', icon: 'fas fa-headset', items: [
//       { text: 'WhatsApp Community Links', link: '/support/wa-links', icon: 'fab fa-whatsapp', perm: 'whatsapp_community_links' },
//       { text: 'Whatsapp Placement Club Links', link: '/support/placement-links', icon: 'fab fa-whatsapp', perm: 'whatsapp_placement_club_links' },
//       { text: 'Whatsapp For Refund', link: '/support/placement-links_for_refund', icon: 'fab fa-whatsapp', perm: 'whatsapp_placement_club_links_for_refund' },
//       { text: 'Support Tickets', link: '/support', icon: 'fas fa-life-ring', perm: 'support_tickets', exact: true },
//       { text: 'Support Agents', link: '/support/agents', icon: 'fas fa-user-tie', perm: 'support_agents' },
//       { text: 'Instant Exam WA Link', link: '/support/instant-wa', icon: 'fas fa-link', perm: 'instant_exam_wa_link' },
//       { text: 'Custom Placement Date', link: '/support/custom-date', icon: 'fas fa-calendar-plus', perm: 'custom_placement_date' },
//       { text: 'Placement Link Log', link: '/support/link-log', icon: 'fas fa-triangle-exclamation', perm: 'placement_link_log' },
//     ]
//   },
//   {
//     key: 'settings', group: 'Settings', icon: 'fas fa-gear', items: [
//       { text: 'Settings', link: '/settings', icon: 'fas fa-sliders', perm: 'settings', exact: true },
//       { text: 'Change AWS Instance', link: '/settings/aws', icon: 'fab fa-aws', perm: 'change_aws_instance' },
//       { text: 'Seed Exam Users', link: '/settings/seed-exam', icon: 'fas fa-seedling', perm: 'seed_exam_users' },
//       { text: 'Delete Excess Exam Users', link: '/settings/delete-exam-users', icon: 'fas fa-trash-can', perm: 'delete_excess_exam_users' },
//     ]
//   },
//   {
//     key: 'admin_panel', group: 'Admin Panel', icon: 'fas fa-screwdriver-wrench', items: [
//       { text: 'Career Roadmaps', link: '/admin-panel/career-roadmap', icon: 'fas fa-map-signs', perm: 'career_roadmaps' },
//       { text: 'Add Data For Result Page', link: '/admin-panel/result-data', icon: 'fas fa-plus-circle', perm: 'add_data_result_page' },
//       { text: 'Internships', link: '/admin-panel/internship', icon: 'fas fa-briefcase', perm: 'internships' },
//       { text: 'Skills', link: '/admin-panel/skills', icon: 'fas fa-tools', perm: 'skills', },
//       { text: 'Submitted Assignments', link: '/admin-panel/assignments', icon: 'fas fa-paper-plane', perm: 'submitted_assignments' },
//     ]
//   },
//   {
//     key: 'permissions', group: 'Permissions', icon: 'fas fa-lock', superadminOnly: true, items: [
//       { text: 'Manage Permissions', link: '/permissions', icon: 'fas fa-user-lock', perm: 'permissions' },
//     ]
//   },
// ];

// export default function AdminLayout() {
//   const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === '1');
//   const [mobileOpen, setMobileOpen] = useState(false);
//   const [openGroup, setOpenGroup] = useState('');
//   const [searchQuery, setSearchQuery] = useState('');
//   const [avatarOpen, setAvatarOpen] = useState(false);
//   // const [navSearch, setNavSearch] = useState('');
//   const [navSearch, setNavSearch] = useState('');

//   const handleNavSearch = (e) => {
//     if (e.key === 'Enter' && navSearch.trim()) {
//       navigate(`/search_result?q=${encodeURIComponent(navSearch.trim())}`);
//       setNavSearch('');
//     }
//   };
//   const { user, logout, hasPermission } = useAuth();
//   const navigate = useNavigate();
//   const location = useLocation();

//   const isSuperadmin = user?.permissions?.includes('__superadmin__');
//   const isAdmin = user?.is_admin || isSuperadmin;
//   const roleLabel = isSuperadmin ? 'Super Admin' : isAdmin ? 'Admin' : 'User';
//   const roleIcon = isSuperadmin ? 'fas fa-crown' : isAdmin ? 'fas fa-user-shield' : 'fas fa-user';

//   /* ── isActive respects exact flag ── */
//   const isActive = (link, exact = false) => {
//     if (link === '/') return location.pathname === '/';
//     if (exact) return location.pathname === link;
//     return location.pathname === link || location.pathname.startsWith(link + '/');
//   };

//   /* ── auto-open the group containing the active route ── */
//   useEffect(() => {
//     for (const group of sidebarMenu) {
//       for (const item of group.items) {
//         if (!item.external && isActive(item.link, item.exact)) {
//           setOpenGroup(group.key);
//           return;
//         }
//       }
//     }
//   }, [location.pathname]);

//   /* ── close avatar on outside click ── */
//   useEffect(() => {
//     const handler = (e) => { if (!e.target.closest('.is-navbar-avatar-wrap')) setAvatarOpen(false); };
//     document.addEventListener('click', handler);
//     return () => document.removeEventListener('click', handler);
//   }, []);

//   const toggleCollapsed = () => {
//     const next = !collapsed;
//     setCollapsed(next);
//     localStorage.setItem('sidebarCollapsed', next ? '1' : '0');
//   };

//   const handleLogout = async () => { await logout(); navigate('/login'); };

//   const filteredMenu = sidebarMenu
//     .filter(g => !g.superadminOnly || isSuperadmin)
//     .map(g => ({
//       ...g,
//       items: g.items.filter(item => {
//         if (!hasPermission(item.perm)) return false;
//         if (searchQuery) return item.text.toLowerCase().includes(searchQuery.toLowerCase()) || g.group.toLowerCase().includes(searchQuery.toLowerCase());
//         return true;
//       }),
//     }))
//     .filter(g => g.items.length > 0);

//   const navInitial = user?.name?.charAt(0)?.toUpperCase() || 'A';


//   return (
//     <div className="flex min-h-screen" style={{ background: '#f1f4f9' }}>
//       {/* Mobile overlay */}
//       {mobileOpen && (
//         <div className="fixed inset-0 bg-black/40 z-[299] lg:hidden backdrop-blur-sm"
//           onClick={() => setMobileOpen(false)} />
//       )}

//       {/* ══════ SIDEBAR ══════ */}
//       <aside
//         className={`fixed top-[0px] left-0 h-[calc(100vh-62px)] bg-white z-[300] flex flex-col transition-all duration-300 overflow-hidden
//           ${collapsed ? 'w-[56px]' : 'w-[268px]'}
//           ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
//         style={{ borderRight: '2px solid #e2e8f0', boxShadow: '2px 0 12px rgba(0,0,0,0.05)' }}>

//         {/* Search bar */}
//         {!collapsed && (
//           <div className="sticky top-0 z-50 bg-white px-2.5 py-2.5" style={{ borderBottom: '1px solid #e2e8f0' }}>
//             <div className="relative">
//               <input
//                 type="text"
//                 value={searchQuery}
//                 onChange={e => setSearchQuery(e.target.value)}
//                 placeholder="Search menu..."
//                 className="w-full pl-8 pr-3 py-2 text-[12.5px] border rounded-lg outline-none"
//                 style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}
//               />
//               <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: '#94a3b8' }}></i>
//             </div>
//           </div>
//         )}

//         {/* <button
//           onClick={toggleCollapsed}
//           className="flex items-center justify-center cursor-pointer border-none shrink-0 transition-all duration-200"
//           style={{
//             height: 44,
//             borderTop: '2px solid #e2e8f0',
//             background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
//             width: '100%',
//             color: '#4f46e5',
//             fontSize: 13,
//             gap: 8,
//             fontFamily: 'inherit',
//             fontWeight: 700,
//           }}
//           onMouseEnter={e => e.currentTarget.style.background = '#ede9fe'}
//           onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, #f5f3ff, #ede9fe)'}>
//           <i className={`fas fa-chevron-${collapsed ? 'right' : 'left'} text-[13px]`}></i>
//           {!collapsed && <span style={{ fontSize: 12 }}>Collapse sidebar</span>}
//         </button> */}
//         <button
//           onClick={toggleCollapsed}
//           style={{
//             display: 'flex', alignItems: 'center', justifyContent: 'center',
//             width: '100%', height: 36, border: 'none', borderBottom: '1px solid #e2e8f0',
//             background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)',
//             color: '#4f46e5', fontSize: 12, fontWeight: 700, gap: 6,
//             cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
//           }}
//           onMouseEnter={e => e.currentTarget.style.background = '#ede9fe'}
//           onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg,#f5f3ff,#ede9fe)'}>
//           <i className={`fas fa-chevron-${collapsed ? 'right' : 'left'} text-[12px]`}></i>
//           {!collapsed && <span>Collapse sidebar</span>}
//         </button>

//         {/* Nav groups */}
//         <nav
//           className="flex-1 overflow-y-auto overflow-x-hidden px-1.5 py-2 space-y-0.5"
//           style={{ scrollbarWidth: 'thin', scrollbarColor: '#e2e8f0 #f8fafc' }}>
//           {filteredMenu.map(group => {
//             const isGroupActive = group.items.some(item => !item.external && isActive(item.link, item.exact));
//             const isOpen = openGroup === group.key || !!searchQuery;

//             return (
//               <div key={group.key} className="relative group/sb">

//                 {/* Group header button */}
//                 <button
//                   onClick={() => { if (!collapsed) setOpenGroup(isOpen && !searchQuery ? '' : group.key); }}
//                   className="w-full flex items-center gap-2.5 rounded-lg cursor-pointer select-none transition-all"
//                   style={{
//                     padding: collapsed ? '8px' : '8px 10px',
//                     justifyContent: collapsed ? 'center' : 'flex-start',
//                     background: isGroupActive ? '#eef2ff' : isOpen ? '#e8eeff50' : 'transparent',
//                   }}>
//                   <span
//                     className="w-[30px] h-[30px] rounded-[7px] flex items-center justify-center shrink-0 text-[13px] transition-all"
//                     style={{
//                       background: isGroupActive ? '#4f46e5' : isOpen ? '#e0e7ff' : '#f1f5f9',
//                       color: isGroupActive ? '#fff' : isOpen ? '#4f46e5' : '#64748b',
//                     }}>
//                     <i className={group.icon}></i>
//                   </span>
//                   {!collapsed && (
//                     <>
//                       <span
//                         className="flex-1 text-[13px] text-left truncate transition-colors"
//                         style={{
//                           color: isGroupActive ? '#4f46e5' : isOpen ? '#1e293b' : '#475569',
//                           fontWeight: isGroupActive ? 700 : 600,
//                         }}>
//                         {group.group}
//                       </span>
//                       <i
//                         className={`fas fa-chevron-down text-[10px] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
//                         style={{ color: isOpen ? '#94a3b8' : '#cbd5e1' }}>
//                       </i>
//                     </>
//                   )}
//                 </button>

//                 {/* Collapsed tooltip flyout */}
//                 {collapsed && (
//                   <div
//                     className="absolute left-[52px] top-0 min-w-[200px] bg-white border rounded-xl shadow-xl z-[9000] p-1.5 opacity-0 pointer-events-none -translate-x-2 transition-all group-hover/sb:opacity-100 group-hover/sb:pointer-events-auto group-hover/sb:translate-x-0"
//                     style={{ borderColor: '#e2e8f0' }}>
//                     <div className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5" style={{ color: '#94a3b8' }}>
//                       {group.group}
//                     </div>
//                     {group.items.map(item => item.external ? (
//                       <a key={item.link} href={item.link} target="_blank" rel="noopener"
//                         className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap text-gray-500 hover:bg-gray-50 hover:text-indigo-600">
//                         <i className={`${item.icon} text-[11px] w-3.5`}></i>
//                         {item.text}
//                         <i className="fas fa-arrow-up-right-from-square text-[8px] ml-auto opacity-40"></i>
//                       </a>
//                     ) : (
//                       <NavLink key={item.link} to={item.link}
//                         className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${isActive(item.link, item.exact) ? 'text-indigo-600 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-indigo-600'}`}
//                         style={isActive(item.link, item.exact) ? { background: '#eef2ff' } : {}}>
//                         <i className={`${item.icon} text-[11px] w-3.5`}></i>
//                         {item.text}
//                       </NavLink>
//                     ))}
//                   </div>
//                 )}

//                 {/* Expanded items */}
//                 {!collapsed && (
//                   <div
//                     className="overflow-hidden transition-all duration-300"
//                     style={{ maxHeight: isOpen ? '900px' : '0px', opacity: isOpen ? 1 : 0 }}>
//                     <ul className="py-0.5" style={isOpen ? { background: '#e8eeff30', borderRadius: '0 0 8px 8px' } : {}}>
//                       {group.items.map(item => item.external ? (
//                         <li key={item.link}>
//                           <a href={item.link} target="_blank" rel="noopener"
//                             className="flex items-center gap-2 mx-1 ml-2 px-2.5 py-[7px] rounded-[7px] text-[12.5px] font-medium transition relative"
//                             style={{ color: '#64748b' }}>
//                             <i className={`${item.icon} text-[12px] w-3.5`} style={{ color: '#94a3b8' }}></i>
//                             <span className="truncate">{item.text}</span>
//                             <i className="fas fa-arrow-up-right-from-square text-[8px] ml-auto opacity-40"></i>
//                           </a>
//                         </li>
//                       ) : (
//                         <li key={item.link}>
//                           <NavLink
//                             to={item.link}
//                             onClick={() => setMobileOpen(false)}
//                             // className="flex items-center gap-2 mx-1 ml-2 px-2.5 py-[7px] rounded-[7px] text-[12.5px] font-medium transition relative"
//                             className="flex items-center gap-2 mx-1 ml-2 px-2.5 py-[7px] rounded-[7px] text-[12.5px] font-medium transition-all duration-200 relative hover:bg-indigo-50 hover:text-indigo-600"
//                             style={isActive(item.link, item.exact)
//                               ? { background: '#4f46e5', color: '#fff', fontWeight: 600 }
//                               : { color: '#64748b' }}>
//                             {isActive(item.link, item.exact) && (
//                               <span className="absolute left-0 top-[18%] h-[64%] w-[3px] bg-white rounded-r"></span>
//                             )}
//                             <i
//                               className={`${item.icon} text-[12px] w-3.5`}
//                               style={{ color: isActive(item.link, item.exact) ? '#fff' : '#94a3b8' }}>
//                             </i>
//                             <span className="truncate">{item.text}</span>
//                           </NavLink>
//                         </li>
//                       ))}
//                     </ul>
//                   </div>
//                 )}
//               </div>
//             );
//           })}
//         </nav>

//         {/* ── Collapse toggle — pinned to bottom of sidebar ── */}
//         {/* <button
//           onClick={toggleCollapsed}
//           className="flex items-center justify-center cursor-pointer border-none shrink-0 transition-all duration-200 hover:bg-indigo-50"
//           style={{
//             height: 44,
//             borderTop: '1px solid #e2e8f0',
//             background: '#fff',
//             width: '100%',
//             color: '#6366f1',
//             fontSize: 13,
//             gap: 8,
//             fontFamily: 'inherit',
//             fontWeight: 600,
//           }}>
//           <i className={`fas fa-chevron-${collapsed ? 'right' : 'left'} text-[13px]`}></i>
//           {!collapsed && <span style={{ fontSize: 12, color: '#64748b' }}>Collapse sidebar</span>}
//         </button> */}


//       </aside>

//       {/* ══════ MAIN CONTENT ══════ */}
//       <div
//         className="flex-1 min-w-0 transition-all duration-300"
//         style={{ marginLeft: collapsed ? 56 : 268 }}>

//         {/* ══════ NAVBAR ══════ */}
//         <header
//           className="sticky top-0 z-[400] flex items-center gap-4 px-5"
//           style={{ height: 62, background: '#fff', boxShadow: '0 1px 0 0 #e2e8f0', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>

//           {/* Brand */}
//           <a href="/" className="flex items-center gap-2.5 no-underline shrink-0">
//             <div
//               className="flex items-center justify-center shrink-0"
//               style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg, #6366f1, #818cf8)', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }}>
//               <i className="fas fa-graduation-cap text-white text-[16px]"></i>
//             </div>
//             {!collapsed && (
//               <div className="flex flex-col leading-tight overflow-hidden whitespace-nowrap">
//                 <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Internship Studio</span>
//                 <span style={{ fontSize: 10, fontWeight: 500, color: '#94a3b8', letterSpacing: '0.03em', textTransform: 'uppercase' }}>ADMIN PANEL</span>
//               </div>
//             )}
//           </a>

//           <div style={{ width: 1, height: 28, background: '#e2e8f0', flexShrink: 0 }}></div>

//           {/* Mobile hamburger */}
//           <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
//             <i className="fas fa-bars text-gray-600"></i>
//           </button>

//           {/* Global search */}
//           <div className="flex-1 max-w-[420px] relative hidden sm:block">
//             <i className="fas fa-search absolute left-[13px] top-1/2 -translate-y-1/2 text-[13px]" style={{ color: '#94a3b8' }}></i>
//             {/* <input
//               type="text"
//               value={navSearch}
//               onChange={e => setNavSearch(e.target.value)}
//               placeholder="Search students, settings..."
//               className="w-full outline-none"
//               style={{ height: 38, padding: '0 16px 0 40px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#f8fafc', fontSize: '13.5px', color: '#1e293b', fontFamily: 'inherit' }}
//             /> */}
//             <input
//               type="text"
//               value={navSearch}
//               onChange={e => setNavSearch(e.target.value)}
//               onKeyDown={handleNavSearch}
//               placeholder="Search students, settings..."
//               className="w-full outline-none"
//               style={{
//                 height: 38, padding: '0 16px 0 40px', border: '1.5px solid #e2e8f0',
//                 borderRadius: 10, background: '#f8fafc', fontSize: '13.5px',
//                 color: '#1e293b', fontFamily: 'inherit'
//               }}
//             />
//           </div>

//           {/* Right side */}
//           <div className="ml-auto flex items-center gap-2">

//             {/* Role tag */}
//             <span
//               className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold"
//               style={{
//                 background: isSuperadmin ? 'rgba(245,158,11,0.12)' : isAdmin ? 'rgba(99,102,241,0.1)' : 'rgba(100,116,139,0.1)',
//                 color: isSuperadmin ? '#d97706' : isAdmin ? '#6366f1' : '#64748b',
//               }}>
//               <i className={`${roleIcon} text-[10px]`}></i> {roleLabel}
//             </span>

//             {/* Notification bell */}
//             <button
//               className="relative w-[38px] h-[38px] border-none bg-transparent cursor-pointer rounded-[10px] flex items-center justify-center hover:bg-gray-100 transition"
//               style={{ color: '#64748b', fontSize: 16 }}
//               onClick={() => hasPermission('send_notification') && navigate('/communication/notification')}>
//               <i className="fas fa-bell"></i>
//               <span className="absolute w-2 h-2 rounded-full" style={{ top: 5, right: 5, background: '#ef4444', border: '1.5px solid #fff' }}></span>
//             </button>

//             {/* All students shortcut */}
//             <button
//               className="w-[38px] h-[38px] border-none bg-transparent cursor-pointer rounded-[10px] flex items-center justify-center hover:bg-gray-100 transition"
//               style={{ color: '#64748b', fontSize: 16 }}
//               onClick={() => hasPermission('all_students') && navigate('/students/all')}>
//               <i className="fas fa-users"></i>
//             </button>

//             {/* Avatar dropdown */}
//             <div className="is-navbar-avatar-wrap relative">
//               <div
//                 onClick={() => setAvatarOpen(!avatarOpen)}
//                 className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold cursor-pointer shrink-0"
//                 style={{ background: 'linear-gradient(135deg, #6366f1, #a78bfa)', border: '2px solid #e0e7ff' }}>
//                 {user?.photo
//                   ? <img src={user.photo} className="w-full h-full rounded-full object-cover" alt="" />
//                   : navInitial}
//               </div>

//               {avatarOpen && (
//                 <div
//                   className="absolute top-[calc(100%+10px)] right-0 w-[230px] bg-white rounded-[14px] overflow-hidden z-[999]"
//                   style={{ border: '1.5px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
//                   <div className="px-4 py-3.5" style={{ borderBottom: '1px solid #f1f5f9' }}>
//                     <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>{user?.name || 'Admin'}</div>
//                     <div style={{ fontSize: '11.5px', color: '#94a3b8', wordBreak: 'break-all' }}>{user?.email}</div>
//                     <span
//                       className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold"
//                       style={{
//                         background: isSuperadmin ? 'rgba(245,158,11,0.12)' : isAdmin ? 'rgba(99,102,241,0.1)' : 'rgba(100,116,139,0.1)',
//                         color: isSuperadmin ? '#d97706' : isAdmin ? '#6366f1' : '#64748b',
//                       }}>
//                       {roleLabel}
//                     </span>
//                   </div>
//                   {isSuperadmin && (
//                     <a
//                       onClick={() => { setAvatarOpen(false); navigate('/permissions'); }}
//                       className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer transition hover:bg-gray-50 no-underline"
//                       style={{ color: '#475569', fontSize: 13 }}>
//                       <span className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[12px]" style={{ background: '#f1f5f9', color: '#6366f1' }}>
//                         <i className="fas fa-user-lock"></i>
//                       </span>
//                       Manage Permissions
//                     </a>
//                   )}
//                   <a
//                     onClick={() => { setAvatarOpen(false); navigate('/settings'); }}
//                     className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer transition hover:bg-gray-50 no-underline"
//                     style={{ color: '#475569', fontSize: 13 }}>
//                     <span className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[12px]" style={{ background: '#f1f5f9', color: '#6366f1' }}>
//                       <i className="fas fa-gear"></i>
//                     </span>
//                     Settings
//                   </a>
//                   <a
//                     onClick={handleLogout}
//                     className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer transition hover:bg-red-50 no-underline"
//                     style={{ color: '#ef4444', fontSize: 13 }}>
//                     <span className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[12px]" style={{ background: '#fef2f2', color: '#ef4444' }}>
//                       <i className="fas fa-right-from-bracket"></i>
//                     </span>
//                     Sign Out
//                   </a>
//                 </div>
//               )}
//             </div>
//           </div>
//         </header>

//         {/* Page content */}
//         <main style={{ padding: '16px 20px', minHeight: 'calc(100vh - 62px)' }}>
//           <Outlet />
//         </main>
//       </div>
//     </div>
//   );
// }






import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import RestrictedPopup from '../components/RestrictedPopup';
import { announceExpanded, onExpanded } from '../hooks/sidebarBus';

// ══════════════════════════════════════════════════════════════
// Complete sidebar menu
// `superadminOnly: true` → only Super Admins see it
// `adminHidden: true`    → hidden from Admins too (reserved for superadmin)
// ══════════════════════════════════════════════════════════════
const sidebarMenu = [
  {
    key: 'dashboard', group: 'Dashboard', icon: 'fas fa-gauge-high', items: [
      { text: 'Dashboard', link: '/', icon: 'fas fa-gauge-high', perm: 'dashboard' },
    ]
  },
  {
    key: 'student_management', group: 'Student Management', icon: 'fas fa-users', items: [
      { text: 'All Students', link: '/students/all', icon: 'fas fa-user-group', perm: 'all_students' },
      { text: 'All IIT Students', link: '/students/iit', icon: 'fas fa-graduation-cap', perm: 'all_iit_students' },
      { text: 'Unregistered Students', link: '/students/unregistered', icon: 'fas fa-user-xmark', perm: 'unregistered_students' },
      { text: 'Registration Checker', link: '/students/registration-checker', icon: 'fas fa-clipboard-check', perm: 'registration_checker' },
      { text: 'Download Student Data', link: '/students/download', icon: 'fas fa-file-arrow-down', perm: 'download_student_data' },
      { text: 'Students With IP', link: '/students/ip-log', icon: 'fas fa-network-wired', perm: 'students_with_ip' },
    ]
  },
  {
    key: 'referral_management', group: 'Referral Management', icon: 'fas fa-handshake', items: [
      { text: 'Manage Referrals', link: '/referrals', icon: 'fas fa-gift', perm: 'manage_referrals', exact: true },
      { text: 'Manage Withdrawal', link: '/referrals/withdrawals', icon: 'fas fa-money-bill-transfer', perm: 'manage_withdrawal' },
    ]
  },
  {
    key: 'refund_management', group: 'Refund Management', icon: 'fas fa-rotate-left', items: [
      { text: 'Manage Refund', link: '/refunds', icon: 'fas fa-receipt', perm: 'manage_refund', exact: true },
      { text: 'Refund (New)', link: '/refunds/new', icon: 'fas fa-gift', perm: 'manage_refund' },
      { text: 'Refund Map List', link: '/refunds/map-list', icon: 'fas fa-filter', perm: 'refund_map_list' },
    ]
  },
  {
    key: 'attendance', group: 'Attendance', icon: 'fas fa-calendar-check', items: [
      { text: 'Attendance', link: '/attendance', icon: 'fas fa-calendar-check', perm: 'attendance' },
    ]
  },
  {
    key: 'netcore', group: 'Netcore', icon: 'fas fa-network-wired', items: [
      { text: 'Netcore Behaviour', link: '/netcore/behaviour', icon: 'fas fa-chart-line', perm: 'netcore_behaviour' },
    ]
  },
  {
    key: 'homepage', group: 'Homepage', icon: 'fas fa-house', items: [
      { text: 'Homepage', link: '/homepage', icon: 'fas fa-toolbox', perm: 'homepage' },
    ]
  },
  {
    key: 'internships', group: 'Internships', icon: 'fas fa-briefcase', items: [
      { text: 'Internship List', link: '/internships', icon: 'fas fa-list-check', perm: 'internship_list', exact: true },
      { text: 'Purchased Internships', link: '/internships/purchased', icon: 'fas fa-credit-card', perm: 'purchased_internships' },
      { text: 'Purchased Starter Kit', link: '/internships/starter-kit', icon: 'fas fa-box-open', perm: 'purchased_starter_kit' },
      { text: 'Allocate Internships', link: '/internships/allocate', icon: 'fas fa-layer-group', perm: 'allocate_internships' },
      { text: 'Project Submission', link: '/internships/projects', icon: 'fas fa-file-circle-check', perm: 'project_submission' },
      { text: 'Check Payments', link: '/internships/payments', icon: 'fas fa-money-check-dollar', perm: 'check_payments' },
      { text: 'Manage Coupons', link: '/internships/coupons', icon: 'fas fa-tag', perm: 'manage_coupons' },
      { text: 'Internship Simulation 2.2', link: '/internships/simulation', icon: 'fas fa-gamepad', perm: 'internship_simulation' },
      { text: 'Problem Statement', link: '/internships/problem-statements', icon: 'fas fa-file-lines', perm: 'problem_statement' },
      { text: 'Assignment Panel', link: '/internships/assignment-panel', icon: 'fas fa-clipboard-list', perm: 'assignment_panel' },
    ]
  },
  {
    key: 'blogs', group: 'Blogs', icon: 'fas fa-pen-nib', items: [
      { text: 'Add Blogs', link: '/blogs/add', icon: 'fas fa-pen-to-square', perm: 'add_blogs' },
      { text: 'Manage Blogs', link: '/blogs', icon: 'fas fa-newspaper', perm: 'manage_blogs', exact: true },
    ]
  },
  {
    key: 'faqs', group: 'FAQs', icon: 'fas fa-circle-question', items: [
      { text: 'Manage FAQs', link: '/faqs', icon: 'fas fa-question-circle', perm: 'manage_faqs' },
    ]
  },
  {
    key: 'total_assessments', group: 'Total Assessments', icon: 'fas fa-square-poll-vertical', items: [
      { text: 'Total Assessments', link: '/assessments', icon: 'fas fa-chart-bar', perm: 'total_assessments' },
    ]
  },
  {
    key: 'communication', group: 'Communication', icon: 'fas fa-comments', items: [
      { text: 'Send Notification', link: '/communication/notification', icon: 'fas fa-bell', perm: 'send_notification' },
      { text: 'Manage Notification', link: '/communication/manage', icon: 'fas fa-bell-slash', perm: 'delete_notification' },
      // { text: 'WhatsApp Community', link: '/communication/whatsapp', icon: 'fab fa-whatsapp', perm: 'whatsapp_community' },
      { text: 'Email Templates', link: '/communication/email-templates', icon: 'fas fa-envelope', perm: 'email_templates' },
      // { text: 'Small Campaign Emails', link: '/communication/email', icon: 'fas fa-envelope-open-text', perm: 'campaign_emails' },
      // { text: 'Push Notification', link: '/communication/push', icon: 'fas fa-satellite-dish', perm: 'push_notification' },
    ]
  },
  {
    key: 'examinations', group: 'Examinations', icon: 'fas fa-file-pen', items: [
      // { text: 'Exam Result', link: '/exams/results', icon: 'fas fa-poll', perm: 'exam_result', exact: true },
      // { text: 'Exam Not Given', link: '/exams/not-given', icon: 'fas fa-ban', perm: 'exam_not_given' },
      { text: 'CIT Versions', link: '/exams/versions', icon: 'fas fa-code-branch', perm: 'cit_versions' },
      // { text: 'Free Internship Applicants', link: '/exams/free-applicants', icon: 'fas fa-list', perm: 'free_internship_applicants' },
      { text: 'Exam Panel Admin', link: '/exams/panel', icon: 'fas fa-user-shield', perm: 'exam_panel_admin' },
      { text: 'Exam Results For New Panel', link: '/exams/results-new', icon: 'fas fa-user-shield', perm: 'exam_results_new' },
      { text: 'Auto Submitted Exams', link: '/exams/auto-submitted', icon: 'fas fa-warning', perm: 'auto_submitted_exams' },
      { text: 'Publish Result', link: '/exams/publish-result', icon: 'fas fa-bullhorn', perm: 'publish_result' },
      { text: 'Publish Result (Test)', link: '/exams/publish-result-test', icon: 'fas fa-flask', perm: 'publish_result_test' },
      { text: 'Not Attempted Exam', link: '/exams/not-attempted-exam', icon: 'fas fa-user-clock', perm: 'not-attempted-exam' },
    ]
  },
  {
    key: 'reporting_analysis', group: 'Reporting & Analysis', icon: 'fas fa-chart-pie', items: [
      { text: 'Batch Dates', link: '/reports/batch-dates', icon: 'fas fa-calendar-days', perm: 'batch_dates' },
      { text: 'Reports', link: '/reports', icon: 'fas fa-chart-line', perm: 'reports', exact: true },
      { text: 'Agency Reports 1', link: '/reports/agency-1', icon: 'fas fa-chart-pie', perm: 'agency_reports_1' },
      { text: 'Agency Reports 2', link: '/reports/agency-2', icon: 'fas fa-chart-bar', perm: 'agency_reports_2' },
      { text: 'Meta Reports', link: '/reports/meta-old', icon: 'fas fa-clock-rotate-left', perm: 'meta_reports_old' },
      // { text: 'Meta Reports (New)', link: '/reports/meta-new', icon: 'fas fa-bolt', perm: 'meta_reports_new' },
      { text: 'Matching Data', link: '/reports/matching', icon: 'fas fa-database', perm: 'matching_data' },
      { text: 'Clarity Data', link: '/reports/clarity', icon: 'fas fa-eye', perm: 'clarity_data' },
      { text: 'Funnel Economics', link: '/reports/funnel-economy', icon: 'fas fa-funnel-dollar', perm: 'funnel_economics' },
      // { text: 'User Availability', link: '/reports/availability', icon: 'fas fa-user-clock', perm: 'user_availability' },
    ]
  },
  {
    key: 'company_management', group: 'Company Management', icon: 'fas fa-building', items: [
      { text: 'All Companies', link: '/companies', icon: 'fas fa-city', perm: 'all_companies', exact: true },
      { text: 'All IIT Companies', link: '/companies/iit', icon: 'fas fa-university', perm: 'all_iit_companies' },
      { text: 'Survey Q & A', link: '/companies/tpo-hod', icon: 'fas fa-clipboard-list', perm: 'tpo_hod_details' },
    ]
  },
  {
    key: 'support_management', group: 'Support', icon: 'fas fa-headset', items: [
      // { text: 'WhatsApp Community Links', link: '/support/wa-links', icon: 'fab fa-whatsapp', perm: 'whatsapp_community_links' },
      { text: 'Whatsapp Placement Club Links', link: '/support/placement-links', icon: 'fab fa-whatsapp', perm: 'whatsapp_placement_club_links' },
      { text: 'Whatsapp For Refund', link: '/support/placement-links_for_refund', icon: 'fab fa-whatsapp', perm: 'whatsapp_placement_club_links_for_refund' },
      { text: 'Whatsapp For Non Qualified', link: '/support/placement-links_for_non_qualified', icon: 'fab fa-whatsapp', perm: 'whatsapp_placement_club_links_for_non_qualified' },
      { text: 'Support Tickets', link: '/support', icon: 'fas fa-life-ring', perm: 'support_tickets', exact: true },
      { text: 'Support Agents', link: '/support/agents', icon: 'fas fa-user-tie', perm: 'support_agents' },
      { text: 'Instant Exam WA Link', link: '/support/instant-wa', icon: 'fas fa-link', perm: 'instant_exam_wa_link' },
      { text: 'Custom Placement Date', link: '/support/custom-date', icon: 'fas fa-calendar-plus', perm: 'custom_placement_date' },
      // { text: 'Placement Link Log', link: '/support/link-log', icon: 'fas fa-triangle-exclamation', perm: 'placement_link_log' },
    ]
  },
  {
    key: 'settings', group: 'Settings', icon: 'fas fa-gear', items: [
      { text: 'Settings', link: '/settings', icon: 'fas fa-sliders', perm: 'settings', exact: true },
      { text: 'Change AWS Instance', link: '/settings/aws', icon: 'fab fa-aws', perm: 'change_aws_instance' },
      { text: 'Seed Exam Users', link: '/settings/seed-exam', icon: 'fas fa-seedling', perm: 'seed_exam_users' },
      { text: 'Delete Excess Exam Users', link: '/settings/delete-exam-users', icon: 'fas fa-trash-can', perm: 'delete_excess_exam_users' },
    ]
  },
  {
    key: 'admin_panel', group: 'Admin Panel', icon: 'fas fa-screwdriver-wrench', items: [
      { text: 'Career Roadmaps', link: '/admin-panel/career-roadmap', icon: 'fas fa-map-signs', perm: 'career_roadmaps' },
      { text: 'Add Data For Result Page', link: '/admin-panel/result-data', icon: 'fas fa-plus-circle', perm: 'add_data_result_page' },
      { text: 'Internships', link: '/admin-panel/internship', icon: 'fas fa-briefcase', perm: 'internships' },
      { text: 'Skills', link: '/admin-panel/skills', icon: 'fas fa-tools', perm: 'skills' },
      { text: 'Submitted Assignments', link: '/admin-panel/assignments', icon: 'fas fa-paper-plane', perm: 'submitted_assignments' },
    ]
  },
  {
    key: 'permissions', group: 'Permissions', icon: 'fas fa-lock', superadminOnly: true, items: [
      { text: 'Manage Permissions', link: '/permissions', icon: 'fas fa-user-lock', perm: 'permissions' },
    ]
  },

  {
    key: 'notes', group: 'Notes', icon: 'fas fa-book', items: [
      { text: 'Notes', link: '/notes', icon: 'fas fa-attendance', perm: 'notes' },
    ]
  },

  {
    key: 'lms', group: 'LMS', icon: 'fas fa-graduation-cap', items: [
      { text: 'LMS System', link: '/lms', icon: 'fas fa-chalkboard-teacher', perm: 'lms_system' },
    ]
  },
];

// Routes that need maximum table width — collapse sidebar on entry.
const AUTO_COLLAPSE_ROUTES = ['/reports/meta-old', '/reports/agency-2'];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  const [searchBlocked, setSearchBlocked] = useState(false);

  const { user, logout, hasPermission, isAdmin, isSuperadmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-collapse sidebar when entering wide-table routes. Does not touch
  // localStorage, so user's saved preference is preserved for other pages.
  useEffect(() => {
    if (AUTO_COLLAPSE_ROUTES.some(p => location.pathname.startsWith(p))) {
      setCollapsed(true);
    }
  }, [location.pathname]);

  // The LMS section navigates from its own right-hand rail; the two are
  // mutually exclusive, so whenever that rail expands this sidebar folds.
  // LmsLayout announces on mount, which is what collapses us on entering /lms.
  useEffect(() => onExpanded(which => { if (which === 'lms') setCollapsed(true); }), []);

  // Collapsed-sidebar tooltip flyout — rendered via portal so it escapes
  // the sidebar's overflow-hidden clipping.
  const [hoverGroup,  setHoverGroup]  = useState(null);   // { key, items, group, top }
  const hideTimerRef = useRef(null);
  const showTooltip = (group, evt) => {
    if (!collapsed) return;
    clearTimeout(hideTimerRef.current);
    const r = evt.currentTarget.getBoundingClientRect();
    setHoverGroup({ ...group, top: r.top, left: r.right + 8 });
  };
  const scheduleHide = () => {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setHoverGroup(null), 120);
  };
  const cancelHide = () => clearTimeout(hideTimerRef.current);
  // Hide on collapse change or route change
  useEffect(() => { setHoverGroup(null); }, [collapsed, location.pathname]);

  const handleNavSearch = (e) => {
    if (e.key !== 'Enter') return;
    const q = navSearch.trim();
    if (!q) return;
    if (!hasPermission('all_students')) {
      setSearchBlocked(true);
      return;
    }
    navigate(`/search_result?q=${encodeURIComponent(q)}`);
    setNavSearch('');
  };

  const roleLabel = isSuperadmin ? 'Super Admin' : isAdmin ? 'Admin' : 'User';
  const roleIcon = isSuperadmin ? 'fas fa-crown' : isAdmin ? 'fas fa-user-shield' : 'fas fa-user';

  const isActive = (link, exact = false) => {
    if (link === '/') return location.pathname === '/';
    if (exact) return location.pathname === link;
    return location.pathname === link || location.pathname.startsWith(link + '/');
  };

  useEffect(() => {
    const isLimitedUser = user?.email === 'accounts@balistro.com';

    for (const group of sidebarMenu) {
      // For the limited-access user, skip the Dashboard group so its '/' link
      // doesn't short-circuit before the reporting_analysis fallback below.
      if (isLimitedUser && group.key === 'dashboard') continue;
      for (const item of group.items) {
        if (!item.external && isActive(item.link, item.exact)) {
          setOpenGroup(group.key);
          return;
        }
      }
    }

    // Default-expand Reporting & Analysis for limited-access user
    if (isLimitedUser) {
      setOpenGroup('reporting_analysis');
    }
  }, [location.pathname, user?.email]);

  useEffect(() => {
    const handler = (e) => { if (!e.target.closest('.is-navbar-avatar-wrap')) setAvatarOpen(false); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebarCollapsed', next ? '1' : '0');
    // Expanding here pushes the LMS rail closed (see hooks/sidebarBus.js).
    if (!next) announceExpanded('admin');
  };

  const handleLogout = async () => { await logout(); navigate('/login'); };

  /* ── filter menu by role + per-item permission + search ─────────
     Super Admin: sees everything.
     Admin:       sees all groups except `superadminOnly` (Permissions hidden).
     User:        sees only items their permissions allow.
     Dashboard is always visible (hasPermission handles that). */
  const filteredMenu = sidebarMenu
    .filter(g => !g.superadminOnly || isSuperadmin)
    .map(g => ({
      ...g,
      items: g.items.filter(item => {
        // Admin sees all items in non-superadmin groups regardless of granular perm
        const visible = isAdmin ? true : hasPermission(item.perm);
        if (!visible) return false;
        if (searchQuery) {
          return (
            item.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
            g.group.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
        return true;
      }),
    }))
    .filter(g => g.items.length > 0);

  const navInitial = user?.name?.charAt(0)?.toUpperCase() || 'A';

  return (
    <div className="flex min-h-screen" style={{ background: '#f1f4f9' }}>
      {/* Restricted popup for navbar search */}
      <RestrictedPopup
        open={searchBlocked}
        onClose={() => setSearchBlocked(false)}
        title="Search Restricted"
        message="You need the 'All Students' permission to search for students. Please contact a Super Admin to request access."
        permission="all_students"
      />

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-[299] lg:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)} />
      )}

      {/* ══════ SIDEBAR ══════ */}
      <aside
        className={`fixed top-[0px] left-0 h-[calc(100vh)] bg-white z-[300] flex flex-col transition-all duration-300 overflow-hidden
          ${collapsed ? 'w-[56px]' : 'w-[268px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ borderRight: '2px solid #e2e8f0', boxShadow: '2px 0 12px rgba(0,0,0,0.05)' }}>

        {/* Sidebar search */}
        {!collapsed && (
          <div className="sticky top-0 z-50 bg-white px-2.5 py-2.5" style={{ borderBottom: '1px solid #e2e8f0' }}>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search menu..."
                className="w-full pl-8 pr-3 py-2 text-[12.5px] border rounded-lg outline-none"
                style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}
              />
              <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: '#94a3b8' }} />
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapsed}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '100%', height: 36, border: 'none', borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)',
            color: '#4f46e5', fontSize: 12, fontWeight: 700, gap: 6,
            cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#ede9fe'}
          onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg,#f5f3ff,#ede9fe)'}>
          <i className={`fas fa-chevron-${collapsed ? 'right' : 'left'} text-[12px]`} />
          {!collapsed && <span>Collapse sidebar</span>}
        </button>

        {/* Nav groups */}
        <nav
          className="flex-1 overflow-y-auto overflow-x-hidden px-1.5 py-2 space-y-0.5"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#e2e8f0 #f8fafc' }}>
          {filteredMenu.map(group => {
            const isGroupActive = group.items.some(item => !item.external && isActive(item.link, item.exact));
            const isOpen = openGroup === group.key || !!searchQuery;

            return (
              <div key={group.key}
                className="relative"
                onMouseEnter={(e) => showTooltip(group, e)}
                onMouseLeave={scheduleHide}>
                <button
                  onClick={() => { if (!collapsed) setOpenGroup(isOpen && !searchQuery ? '' : group.key); }}
                  className="w-full flex items-center gap-2.5 rounded-lg cursor-pointer select-none transition-all"
                  style={{
                    padding: collapsed ? '8px' : '8px 10px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    background: isGroupActive ? '#eef2ff' : isOpen ? '#e8eeff50' : 'transparent',
                  }}>
                  <span
                    className="w-[30px] h-[30px] rounded-[7px] flex items-center justify-center shrink-0 text-[13px] transition-all"
                    style={{
                      background: isGroupActive ? '#4f46e5' : isOpen ? '#e0e7ff' : '#f1f5f9',
                      color: isGroupActive ? '#fff' : isOpen ? '#4f46e5' : '#64748b',
                    }}>
                    <i className={group.icon} />
                  </span>
                  {!collapsed && (
                    <>
                      <span
                        className="flex-1 text-[13px] text-left truncate transition-colors"
                        style={{
                          color: isGroupActive ? '#4f46e5' : isOpen ? '#1e293b' : '#475569',
                          fontWeight: isGroupActive ? 700 : 600,
                        }}>
                        {group.group}
                      </span>
                      <i
                        className={`fas fa-chevron-down text-[10px] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                        style={{ color: isOpen ? '#94a3b8' : '#cbd5e1' }} />
                    </>
                  )}
                </button>

                {/* Tooltip flyout for collapsed mode is rendered at the bottom of
                    AdminLayout via createPortal — see hoverGroup state. */}

                {/* Expanded items */}
                {!collapsed && (
                  <div
                    className="overflow-hidden transition-all duration-300"
                    style={{ maxHeight: isOpen ? '900px' : '0px', opacity: isOpen ? 1 : 0 }}>
                    <ul className="py-0.5" style={isOpen ? { background: '#e8eeff30', borderRadius: '0 0 8px 8px' } : {}}>
                      {group.items.map(item => (
                        <li key={item.link}>
                          <NavLink
                            to={item.link}
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center gap-2 mx-1 ml-2 px-2.5 py-[7px] rounded-[7px] text-[12.5px] font-medium transition-all duration-200 relative hover:bg-indigo-50 hover:text-indigo-600"
                            style={isActive(item.link, item.exact)
                              ? { background: '#4f46e5', color: '#fff', fontWeight: 600 }
                              : { color: '#64748b' }}>
                            {isActive(item.link, item.exact) && (
                              <span className="absolute left-0 top-[18%] h-[64%] w-[3px] bg-white rounded-r" />
                            )}
                            <i
                              className={`${item.icon} text-[12px] w-3.5`}
                              style={{ color: isActive(item.link, item.exact) ? '#fff' : '#94a3b8' }} />
                            <span className="truncate">{item.text}</span>
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ══════ MAIN CONTENT ══════ */}
      <div
        className="flex-1 min-w-0 transition-all duration-300"
        style={{ marginLeft: collapsed ? 56 : 268 }}>

        {/* ══════ NAVBAR ══════ */}
        <header
          className="sticky top-0 z-[400] flex items-center gap-4 px-5"
          style={{ height: 62, background: '#fff', boxShadow: '0 1px 0 0 #e2e8f0', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>

          {/* Brand */}
          <a href="/" className="flex items-center gap-2.5 no-underline shrink-0">
            <div
              className="flex items-center justify-center shrink-0"
              style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg, #6366f1, #818cf8)', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }}>
              <i className="fas fa-graduation-cap text-white text-[16px]" />
            </div>
            {!collapsed && (
              <div className="flex flex-col leading-tight overflow-hidden whitespace-nowrap">
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Internship Studio</span>
                <span style={{ fontSize: 10, fontWeight: 500, color: '#94a3b8', letterSpacing: '0.03em', textTransform: 'uppercase' }}>ADMIN PANEL</span>
              </div>
            )}
          </a>

          <div style={{ width: 1, height: 28, background: '#e2e8f0', flexShrink: 0 }} />

          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
            <i className="fas fa-bars text-gray-600" />
          </button>

          {/* Global search (student search) */}
          <div className="flex-1 max-w-[420px] relative hidden sm:block">
            <i className="fas fa-search absolute left-[13px] top-1/2 -translate-y-1/2 text-[13px]" style={{ color: '#94a3b8' }} />
            <input
              type="text"
              value={navSearch}
              onChange={e => setNavSearch(e.target.value)}
              onKeyDown={handleNavSearch}
              placeholder={hasPermission('all_students') ? 'Search students, settings...' : 'Search (restricted)'}
              className="w-full outline-none"
              style={{
                height: 38, padding: '0 16px 0 40px', border: '1.5px solid #e2e8f0',
                borderRadius: 10, background: '#f8fafc', fontSize: '13.5px',
                color: '#1e293b', fontFamily: 'inherit',
                opacity: hasPermission('all_students') ? 1 : 0.75,
              }}
            />
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            <span
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold"
              style={{
                background: isSuperadmin ? 'rgba(245,158,11,0.12)' : isAdmin ? 'rgba(99,102,241,0.1)' : 'rgba(100,116,139,0.1)',
                color: isSuperadmin ? '#d97706' : isAdmin ? '#6366f1' : '#64748b',
              }}>
              <i className={`${roleIcon} text-[10px]`} /> {roleLabel}
            </span>

            <button
              className="relative w-[38px] h-[38px] border-none bg-transparent cursor-pointer rounded-[10px] flex items-center justify-center hover:bg-gray-100 transition"
              style={{ color: '#64748b', fontSize: 16 }}
              onClick={() => hasPermission('send_notification') && navigate('/communication/notification')}>
              <i className="fas fa-bell" />
              <span className="absolute w-2 h-2 rounded-full" style={{ top: 5, right: 5, background: '#ef4444', border: '1.5px solid #fff' }} />
            </button>

            <button
              className="w-[38px] h-[38px] border-none bg-transparent cursor-pointer rounded-[10px] flex items-center justify-center hover:bg-gray-100 transition"
              style={{ color: '#64748b', fontSize: 16 }}
              onClick={() => {
                if (hasPermission('all_students')) navigate('/students/all');
                else setSearchBlocked(true);
              }}>
              <i className="fas fa-users" />
            </button>

            {/* Avatar dropdown */}
            <div className="is-navbar-avatar-wrap relative">
              <div
                onClick={() => setAvatarOpen(!avatarOpen)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold cursor-pointer shrink-0"
                style={{ background: 'linear-gradient(135deg, #6366f1, #a78bfa)', border: '2px solid #e0e7ff' }}>
                {user?.photo
                  ? <img src={user.photo} className="w-full h-full rounded-full object-cover" alt="" />
                  : navInitial}
              </div>

              {avatarOpen && (
                <div
                  className="absolute top-[calc(100%+10px)] right-0 w-[230px] bg-white rounded-[14px] overflow-hidden z-[999]"
                  style={{ border: '1.5px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                  <div className="px-4 py-3.5" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>{user?.name || 'Admin'}</div>
                    <div style={{ fontSize: '11.5px', color: '#94a3b8', wordBreak: 'break-all' }}>{user?.email}</div>
                    <span
                      className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold"
                      style={{
                        background: isSuperadmin ? 'rgba(245,158,11,0.12)' : isAdmin ? 'rgba(99,102,241,0.1)' : 'rgba(100,116,139,0.1)',
                        color: isSuperadmin ? '#d97706' : isAdmin ? '#6366f1' : '#64748b',
                      }}>
                      {roleLabel}
                    </span>
                  </div>

                  {isSuperadmin && (
                    <a
                      onClick={() => { setAvatarOpen(false); navigate('/permissions'); }}
                      className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer transition hover:bg-gray-50 no-underline"
                      style={{ color: '#475569', fontSize: 13 }}>
                      <span className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[12px]" style={{ background: '#f1f5f9', color: '#6366f1' }}>
                        <i className="fas fa-user-lock" />
                      </span>
                      Manage Permissions
                    </a>
                  )}
                  <a
                    onClick={() => { setAvatarOpen(false); navigate('/settings'); }}
                    className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer transition hover:bg-gray-50 no-underline"
                    style={{ color: '#475569', fontSize: 13 }}>
                    <span className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[12px]" style={{ background: '#f1f5f9', color: '#6366f1' }}>
                      <i className="fas fa-gear" />
                    </span>
                    Settings
                  </a>
                  <a
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer transition hover:bg-red-50 no-underline"
                    style={{ color: '#ef4444', fontSize: 13 }}>
                    <span className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[12px]" style={{ background: '#fef2f2', color: '#ef4444' }}>
                      <i className="fas fa-right-from-bracket" />
                    </span>
                    Sign Out
                  </a>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ padding: '16px 20px', minHeight: 'calc(100vh - 62px)' }}>
          <Outlet />
        </main>
      </div>

      {/* ══════ Collapsed-sidebar tooltip flyout (portaled to body so it
              escapes the aside's overflow-hidden) ══════ */}
      {collapsed && hoverGroup && createPortal(
        <div
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
          style={{
            position: 'fixed',
            top: hoverGroup.top,
            left: hoverGroup.left,
            minWidth: 210,
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            padding: 6,
            zIndex: 9999,
            boxShadow: '0 12px 32px -8px rgba(79,70,229,.22), 0 4px 14px rgba(0,0,0,.06)',
            animation: 'sb-flyout-in .18s ease-out',
          }}>
          <style>{`
            @keyframes sb-flyout-in {
              from { opacity: 0; transform: translateX(-6px) scale(.97); }
              to   { opacity: 1; transform: translateX(0) scale(1); }
            }
          `}</style>
          {/* Triangle pointer */}
          <span aria-hidden style={{
            position: 'absolute', top: 14, left: -6, width: 12, height: 12,
            transform: 'rotate(45deg)', background: '#fff',
            borderLeft: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0',
          }} />
          {/* Header */}
          <div style={{
            fontSize: 10.5, fontWeight: 700, color: '#94a3b8',
            textTransform: 'uppercase', letterSpacing: '.05em',
            padding: '6px 10px 8px', borderBottom: '1px solid #f1f5f9', marginBottom: 4,
          }}>
            {hoverGroup.group}
          </div>
          {/* Items */}
          {hoverGroup.items.map(item => {
            const active = isActive(item.link, item.exact);
            return (
              <NavLink key={item.link} to={item.link}
                onClick={() => setHoverGroup(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  textDecoration: 'none', whiteSpace: 'nowrap',
                  background: active ? '#eef2ff' : 'transparent',
                  color: active ? '#4f46e5' : '#475569',
                  transition: 'all .15s',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = '#f5f3ff'; e.currentTarget.style.color = '#4f46e5'; }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569'; }}}>
                <i className={item.icon} style={{ fontSize: 11, width: 14, textAlign: 'center' }} />
                {item.text}
              </NavLink>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}