// ===========================================================================
//  lmsTabs.js — the LMS System tab registry.
//
//  Tab → route → permission key. Adding a tab here is all it takes on the nav
//  side; register the same key in EXTRA_SECTION_PERMISSIONS['LMS'] (see
//  pages/permissions/Permissions.jsx) and add the route in App.jsx.
// ===========================================================================
import {
  LayoutDashboard, BookOpen, Users, GraduationCap, HelpCircle,
  ClipboardList, BarChart3, LifeBuoy, Settings as SettingsIcon,
} from 'lucide-react';

export const LMS_TABS = [
  { key: 'dashboard',   label: 'Dashboard',      to: '/lms',             end: true, perm: 'lms_dashboard',   icon: LayoutDashboard },
  { key: 'courses',     label: 'Courses',        to: '/lms/courses',                perm: 'lms_courses',     icon: BookOpen },
  { key: 'learners',    label: 'Users',          to: '/lms/learners',               perm: 'lms_learners',    icon: Users },
  { key: 'enrollments', label: 'Enrollments',    to: '/lms/enrollments',            perm: 'lms_enrollments', icon: GraduationCap },
  { key: 'quizzes',     label: 'Quizzes',        to: '/lms/quizzes',                perm: 'lms_quizzes',     icon: HelpCircle },
  { key: 'responses',   label: 'Form Responses', to: '/lms/responses',              perm: 'lms_forms',       icon: ClipboardList },
  { key: 'reports',     label: 'Reports',        to: '/lms/reports',                perm: 'lms_reports',     icon: BarChart3 },
  /* Tickets raised by learners in the portal's /support screen. Sits directly
     below Reports because it is read the same way — a queue, not a builder. */
  { key: 'support',     label: 'Support',        to: '/lms/support',                perm: 'lms_support',     icon: LifeBuoy },
  { key: 'settings',    label: 'Settings',       to: '/lms/settings',               perm: 'lms_settings',    icon: SettingsIcon },
];
