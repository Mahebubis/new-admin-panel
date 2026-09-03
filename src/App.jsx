// import { Routes, Route, Navigate } from 'react-router-dom';
// import { useAuth } from './hooks/useAuth';
// import ProtectedRoute from './components/ProtectedRoute';
// import AdminLayout from './layouts/AdminLayout';
// import Login from './pages/Login';
// import Placeholder from './pages/EditBlog';

// import Dashboard from './pages/dashboard/Dashboard';
// import AllStudents from './pages/students/AllStudents';
// import IITStudents from './pages/students/IITStudents';
// import UnregisteredStudents from './pages/students/UnregisteredStudents';
// import RegistrationChecker from './pages/students/RegistrationChecker';
// import DownloadStudentData from './pages/students/DownloadStudentData';
// import StudentsWithIP from './pages/students/StudentsWithIP';
// import EditStudent from './pages/students/EditStudent';
// import ViewStudent from './pages/students/ViewStudent';
// import ReferralList from './pages/referrals/ReferralList';
// import WithdrawalList from './pages/referrals/WithdrawalList';
// import RefundList from './pages/refunds/RefundList';
// import RefundNew from './pages/refunds/RefundNew';
// import DomainList from './pages/domains/DomainList';
// import NetcoreBehaviour from './pages/netcore/NetcoreBehaviour';
// import NetcoreFilter from './pages/netcore/NetcoreFilter';
// import InternshipList from './pages/internships/InternshipList';
// import PurchasedInternships from './pages/internships/PurchasedInternships';
// import AllocateInternships from './pages/internships/AllocateInternships';
// import ProjectSubmission from './pages/internships/ProjectSubmission';
// import CheckPayments from './pages/internships/CheckPayments';
// import ManageCoupons from './pages/internships/ManageCoupons';
// import AddBlog from './pages/blogs/AddBlog';
// import ManageBlogs from './pages/blogs/ManageBlogs';
// import ManageFaqs from './pages/faqs/ManageFaqs';
// import TotalAssessments from './pages/assessments/TotalAssessments';
// import SendNotification from './pages/communication/SendNotification';
// import DeleteNotification from './pages/communication/ManageNotification';
// import WhatsAppCommunity from './pages/communication/WhatsAppCommunity';
// import EmailTemplates from './pages/communication/EmailTemplates';
// import CampaignEmails from './pages/communication/CampaignEmails';
// import PushNotification from './pages/communication/PushNotification';
// import BulkEmail from './pages/communication/BulkEmail';
// import ExamResults from './pages/examinations/ExamResults';
// import ExamNotGiven from './pages/examinations/ExamNotGiven';
// import CITVersions from './pages/examinations/CITVersions';
// import FreeApplicants from './pages/examinations/FreeApplicants';
// import ExamResultsNew from './pages/examinations/ExamResultsNew';
// import BatchDates from './pages/reports/BatchDates';
// import Reports from './pages/reports/Reports';
// import MatchingData from './pages/reports/MatchingData';
// import ClarityData from './pages/reports/ClarityData';
// import CompanyList from './pages/companies/CompanyList';
// import IITCompanies from './pages/companies/IITCompanies';
// import TPODetails from './pages/companies/TPODetails';
// import WALinks from './pages/support/WALinks';
// import PlacementLinks from './pages/support/PlacementLinks';
// import SupportTickets from './pages/support/SupportTickets';
// import SupportAgents from './pages/support/SupportAgents';
// import PlacementLinkLog from './pages/support/PlacementLinkLog';
// import Settings from './pages/settings/Settings';
// import SubmittedAssignments from './pages/admin-panel/SubmittedAssignments';
// import Permissions from './pages/permissions/Permissions';
// import ReferralDetailsForAdmin from './pages/referrals/ReferralDetailsForAdmin';
// import HomePage from './pages/homepage/HomePage';
// import SearchResult from './pages/students/SearchResult';
// import EditBlog from './pages/EditBlog';
// import ManageNotifications from './pages/communication/ManageNotification';
// import ExamPanelForAdmin from './pages/examinations/ExamPanelForAdmin';
// import AutoSubmittedExams from './pages/examinations/AutoSubmittedExams';
// import AgencyReport1 from './pages/reports/AgencyReport1';
// import AgencyReport2 from './pages/reports/AgencyReport2';
// import MetaAdsDashboardOld from './pages/reports/MetaOld';
// import MetaAdsNew from './pages/reports/MetaNew';
// import UserAvailability from './pages/reports/UserAvailibility';
// import PlacementLinksForRefund from './pages/support/PlacementLinksForRefund';
// import ViewTicket from './pages/support/ViewTicket';
// import InstantExamWALinks from './pages/support/InstantExamWaLink';
// import CustomPlacementDates from './pages/support/CustomPlacementDate';
// import AWSInstanceManager from './pages/settings/ChangeAwsInstance';
// import DeleteIncompleteExam from './pages/settings/DeleteIncompleteExam';
// import SyncExamUsers from './pages/settings/SeedExam';
// import CareerRoadmapDashboard from './pages/admin-panel/CareerRoadMapDashboard';
// import DomainManagement from './pages/admin-panel/ResultPageData';
// import { SkillEditSkill, SkillSegments, SkillSegmentSkills } from './pages/admin-panel/Skills';

// export default function App() {
//   const { isAuthenticated } = useAuth();
//   return (
//     <Routes>
//       <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
//       <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
//         <Route index element={<Dashboard />} />
//         <Route path="students/all" element={<AllStudents />} />
//         <Route path="students/iit" element={<IITStudents />} />
//         <Route path="students/unregistered" element={<UnregisteredStudents />} />
//         <Route path="students/registration-checker" element={<RegistrationChecker />} />
//         <Route path="students/download" element={<DownloadStudentData />} />
//         <Route path="students/ip-log" element={<StudentsWithIP />} />
//         <Route path="students/edit/:id" element={<EditStudent />} />
//         <Route path="students/view/:id" element={<ViewStudent />} />
//         <Route path="/search_result" element={<SearchResult />} />
//         <Route path="referrals" element={<ReferralList />} />
//         <Route path="/referral-detail-for-admin" element={<ReferralDetailsForAdmin />} />
//         <Route path="referrals/withdrawals" element={<WithdrawalList />} />
//         <Route path="refunds" element={<RefundList />} />
//         <Route path="refunds/new" element={<RefundNew />} />
//         <Route path="domains" element={<DomainList />} />
//         <Route path="netcore/behaviour" element={<NetcoreBehaviour />} />
//         <Route path="/homepage" element={<HomePage />} />
//         <Route path="netcore/filter" element={<NetcoreFilter />} />
//         <Route path="internships" element={<InternshipList />} />
//         <Route path="internships/purchased" element={<PurchasedInternships />} />
//         <Route path="internships/allocate" element={<AllocateInternships />} />
//         <Route path="internships/projects" element={<ProjectSubmission />} />
//         <Route path="internships/payments" element={<CheckPayments />} />
//         <Route path="internships/coupons" element={<ManageCoupons />} />
//         <Route path="blogs/add" element={<AddBlog />} />
//         <Route path="blogs" element={<ManageBlogs />} />
//         <Route path="blogs/edit/:id" element={<EditBlog />} />
//         <Route path="faqs" element={<ManageFaqs />} />
//         <Route path="assessments" element={<TotalAssessments />} />
//         <Route path="communication/notification" element={<SendNotification />} />
//         <Route path="/communication/manage" element={<ManageNotifications />} />
//         <Route path="communication/whatsapp" element={<WhatsAppCommunity />} />
//         <Route path="communication/email-templates" element={<EmailTemplates />} />
//         <Route path="communication/email" element={<CampaignEmails />} />
//         <Route path="communication/push" element={<PushNotification />} />
//         <Route path="communication/bulk-email" element={<BulkEmail />} />
//         <Route path="exams/results" element={<ExamResults />} />
//         <Route path="exams/not-given" element={<ExamNotGiven />} />
//         <Route path="exams/versions" element={<CITVersions />} />
//         <Route path="exams/free-applicants" element={<FreeApplicants />} />
//         <Route path="exams/panel" element={<ExamPanelForAdmin />} />
//         <Route path="exams/results-new" element={<ExamResultsNew />} />
//         <Route path="exams/auto-submitted" element={<AutoSubmittedExams />} />
//         <Route path="reports/batch-dates" element={<BatchDates />} />
//         <Route path="reports" element={<Reports />} />
//         <Route path="reports/agency-1" element={<AgencyReport1 />} />
//         <Route path="reports/agency-2" element={<AgencyReport2 />} />
//         <Route path="reports/meta-old" element={<MetaAdsDashboardOld />} />
//         <Route path="reports/meta-new" element={<MetaAdsNew />} />
//         <Route path="reports/matching" element={<MatchingData />} />
//         <Route path="reports/clarity" element={<ClarityData />} />
//         <Route path="reports/availability" element={<UserAvailability />} />
//         <Route path="companies" element={<CompanyList />} />
//         <Route path="companies/iit" element={<IITCompanies />} />
//         <Route path="companies/tpo-hod" element={<TPODetails />} />
//         <Route path="support/wa-links" element={<WALinks />} />
//         <Route path="support/placement-links" element={<PlacementLinks />} />
//         <Route path="support/placement-links_for_refund" element={<PlacementLinksForRefund />} />
//         <Route path="support" element={<SupportTickets />} />
//         <Route path="support/agents" element={<SupportAgents />} />
//         <Route path="/support/ticket/:ticket_id" element={<ViewTicket />} />
//         <Route path="support/instant-wa" element={<InstantExamWALinks />} />
//         <Route path="support/custom-date" element={<CustomPlacementDates />} />
//         <Route path="support/link-log" element={<PlacementLinkLog />} />
//         <Route path="settings" element={<Settings />} />
//         <Route path="settings/aws" element={<AWSInstanceManager />} />
//         <Route path="settings/seed-exam" element={<SyncExamUsers />} />
//         <Route path="settings/delete-exam-users" element={<DeleteIncompleteExam />} />
//         <Route path="admin-panel/career-roadmap" element={<CareerRoadmapDashboard />} />
//         <Route path="admin-panel/result-data" element={<DomainManagement />} />
//         <Route path="admin-panel/internship" element={<Placeholder />} />
//         <Route path="admin-panel/skills"                           element={<SkillSegments />} />
// <Route path="skills/:segmentId"               element={<SkillSegmentSkills />} />
// <Route path="skills/:segmentId/edit/:skillId" element={<SkillEditSkill />} />
//         <Route path="admin-panel/assignments" element={<SubmittedAssignments />} />
//         <Route path="permissions" element={<Permissions />} />
//         <Route path="*" element={<Navigate to="/" replace />} />
//       </Route>
//     </Routes>
//   );
// }





import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import PermissionGate from './components/PermissionGate';
import AdminLayout from './layouts/AdminLayout';
import Login from './pages/Login';
import Placeholder from './pages/EditBlog';

import Dashboard from './pages/dashboard/Dashboard';
import AllStudents from './pages/students/AllStudents';
import IITStudents from './pages/students/IITStudents';
import UnregisteredStudents from './pages/students/UnregisteredStudents';
import RegistrationChecker from './pages/students/RegistrationChecker';
import DownloadStudentData from './pages/students/DownloadStudentData';
import StudentsWithIP from './pages/students/StudentsWithIP';
import EditStudent from './pages/students/EditStudent';
import ViewStudent from './pages/students/ViewStudent';
import ReferralList from './pages/referrals/ReferralList';
import WithdrawalList from './pages/referrals/WithdrawalList';
import RefundList from './pages/refunds/RefundList';
import RefundNew from './pages/refunds/RefundNew';
import RefundMapList from './pages/refunds/RefundMapList';
import Attendance from './pages/attendance/Attendance';
import DomainList from './pages/domains/DomainList';
import NetcoreBehaviour from './pages/netcore/NetcoreBehaviour';
import NetcoreFilter from './pages/netcore/NetcoreFilter';
import NetcoreLayout from './pages/netcore/NetcoreLayout';
import NetcoreContacts from './pages/netcore/NetcoreContacts';
import NetcoreUserTimeline from './pages/netcore/NetcoreUserTimeline';
import NetcoreSegments from './pages/netcore/NetcoreSegments';
import NetcoreSegmentCreate from './pages/netcore/NetcoreSegmentCreate';
import NetcoreSegmentUsers from './pages/netcore/NetcoreSegmentUsers';
import NetcoreLists from './pages/netcore/NetcoreLists';
import NetcoreListContacts from './pages/netcore/NetcoreListContacts';
import JourneyList from './pages/netcore/journey/JourneyList';
import JourneyBuilder from './pages/netcore/journey/JourneyBuilder';
import JourneyReport from './pages/netcore/journey/JourneyReport';
import DndSettings from './pages/netcore/journey/DndSettings';
import JourneyOutbox from './pages/netcore/journey/JourneyOutbox';
import ImportContactsWizard from './pages/netcore/ImportContactsWizard';
import ContactLogs from './pages/netcore/ContactLogs';
import { NetcoreBlocklist, BlocklistLogs, BlocklistImport } from './pages/netcore/NetcoreBlocklist';
import NetcoreAttributes from './pages/netcore/NetcoreAttributes';
import AttributeLogs from './pages/netcore/AttributeLogs';
import CampaignsUnified from './pages/netcore/CampaignsUnified';
import CampaignDetail from './pages/netcore/CampaignDetail';
import CampaignWizard from './pages/netcore/CampaignWizard';
import CampaignReport from './pages/netcore/CampaignReport';
import TemplatesList from './pages/netcore/TemplatesList';
import TemplateEditor from './pages/netcore/TemplateEditor';
import EspSettings from './pages/netcore/EspSettings';
import EmailDomains from './pages/netcore/EmailDomains';
import WaCampaignsList from './pages/netcore/whatsapp/WaCampaignsList';
import WaCampaignWizard from './pages/netcore/whatsapp/WaCampaignWizard';
import WaCampaignReport from './pages/netcore/whatsapp/WaCampaignReport';
import WaTemplatesList from './pages/netcore/whatsapp/WaTemplatesList';
import WaTemplateEditor from './pages/netcore/whatsapp/WaTemplateEditor';
import WaSettings from './pages/netcore/whatsapp/WaSettings';
import WaInbox from './pages/netcore/whatsapp/WaInbox';
import InternshipList from './pages/internships/InternshipList';
import PurchasedInternships from './pages/internships/PurchasedInternships';
import PurchasedStarterKit from './pages/internships/PurchasedStarterKit';
import AllocateInternships from './pages/internships/AllocateInternships';
import ProjectSubmission from './pages/internships/ProjectSubmission';
import CheckPayments from './pages/internships/CheckPayments';
import ManageCoupons from './pages/internships/ManageCoupons';
import InternshipSimulation2 from './pages/internships/InternshipSimulation2';
import ProblemStatements from './pages/internships/ProblemStatements';
import AssignmentPanel from './pages/internships/AssignmentPanel';
import AddBlog from './pages/blogs/AddBlog';
import ManageBlogs from './pages/blogs/ManageBlogs';
import ManageFaqs from './pages/faqs/ManageFaqs';
import TotalAssessments from './pages/assessments/TotalAssessments';
import SendNotification from './pages/communication/SendNotification';
import WhatsAppCommunity from './pages/communication/WhatsAppCommunity';
import EmailTemplates from './pages/communication/EmailTemplates';
import CampaignEmails from './pages/communication/CampaignEmails';
import PushNotification from './pages/communication/PushNotification';
import BulkEmail from './pages/communication/BulkEmail';
import ExamResults from './pages/examinations/ExamResults';
import ExamNotGiven from './pages/examinations/ExamNotGiven';
import CITVersions from './pages/examinations/CITVersions';
import NotAttemptedExam from './pages/examinations/NotAttemptedExam';
import FreeApplicants from './pages/examinations/FreeApplicants';
import ExamResultsNew from './pages/examinations/ExamResultsNew';
import ResultPublish from './pages/examinations/ResultPublish';
import ResultPublishTest from './pages/examinations/ResultPublishTest';
import BatchDates from './pages/reports/BatchDates';
import Reports from './pages/reports/Reports';
import MatchingData from './pages/reports/MatchingData';
import ClarityData from './pages/reports/ClarityData';
import CompanyList from './pages/companies/CompanyList';
import IITCompanies from './pages/companies/IITCompanies';
import CompanySurveyTabs from './pages/companies/CompanySurveyTabs';
import WALinks from './pages/support/WALinks';
import PlacementLinks from './pages/support/PlacementLinks';
import SupportTickets from './pages/support/SupportTickets';
import SupportAgents from './pages/support/SupportAgents';
import PlacementLinkLog from './pages/support/PlacementLinkLog';
import Settings from './pages/settings/Settings';
import SubmittedAssignments from './pages/admin-panel/SubmittedAssignments';
import Permissions from './pages/permissions/Permissions';
import ReferralDetailsForAdmin from './pages/referrals/ReferralDetailsForAdmin';
import HomePage from './pages/homepage/HomePage';
import SearchResult from './pages/students/SearchResult';
import EditBlog from './pages/EditBlog';
import ManageNotifications from './pages/communication/ManageNotification';
import ExamPanelForAdmin from './pages/examinations/ExamPanelForAdmin';
import AutoSubmittedExams from './pages/examinations/AutoSubmittedExams';
import AgencyReport1 from './pages/reports/AgencyReport1';
import AgencyReport2 from './pages/reports/AgencyReport2';
import MetaAdsDashboardOld from './pages/reports/MetaOld';
import MetaAdsNew from './pages/reports/MetaNew';
import UserAvailability from './pages/reports/UserAvailibility';
import PlacementLinksForRefund from './pages/support/PlacementLinksForRefund';
import PlacementLinksForNonQualified from './pages/support/PlacementLinksForNonQualified';
import ViewTicket from './pages/support/ViewTicket';
import InstantExamWALinks from './pages/support/InstantExamWaLink';
import CustomPlacementDates from './pages/support/CustomPlacementDate';
import AWSInstanceManager from './pages/settings/ChangeAwsInstance';
import DeleteIncompleteExam from './pages/settings/DeleteIncompleteExam';
import SyncExamUsers from './pages/settings/SeedExam';
import CareerRoadmapDashboard from './pages/admin-panel/CareerRoadMapDashboard';
import DomainManagement from './pages/admin-panel/ResultPageData';
import { SkillEditSkill, SkillSegments, SkillSegmentSkills } from './pages/admin-panel/Skills';
import Notes from './pages/notes/Notes';
import FunnelEconomicsView from './pages/reports/FunnelEconomics';
import LmsLayout, { LmsGate } from './pages/lms/LmsLayout';
import LmsDashboard from './pages/lms/LmsDashboard';
import LmsCourses from './pages/lms/LmsCourses';
import LmsCourseBuilder from './pages/lms/LmsCourseBuilder';
import LmsLessonEditor from './pages/lms/LmsLessonEditor';
import LmsLearners from './pages/lms/LmsLearners';
import LmsEnrollments from './pages/lms/LmsEnrollments';
import LmsQuizzes from './pages/lms/LmsQuizzes';
import LmsQuizBuilder from './pages/lms/LmsQuizBuilder';
import LmsResponses from './pages/lms/LmsResponses';
import LmsReports from './pages/lms/LmsReports';
import LmsSupport from './pages/lms/LmsSupport';
import LmsSettings from './pages/lms/LmsSettings';
import Monitoring from './pages/Monitoring/Monitoring';
import Freshdesk from './pages/freshdesk/Freshdesk';
import EnrollmentAudit from './pages/enrollment-audit/EnrollmentAudit';

// Helper to keep the route table readable
const G = (perm, Element) => (
  <PermissionGate perm={perm}>{Element}</PermissionGate>
);

export default function App() {
  const { isAuthenticated, user, hasPermission } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />

      {/* Full-screen authenticated pages — no AdminLayout chrome (no sidebar / topbar / netcore navs) */}
      <Route path="/netcore/segments/new"      element={<ProtectedRoute>{G('netcore_behaviour', <NetcoreSegmentCreate />)}</ProtectedRoute>} />
      <Route path="/netcore/segments/edit/:id" element={<ProtectedRoute>{G('netcore_behaviour', <NetcoreSegmentCreate />)}</ProtectedRoute>} />
      <Route path="/netcore/lists/:listId/import" element={<ProtectedRoute>{G('netcore_behaviour', <ImportContactsWizard />)}</ProtectedRoute>} />
      <Route path="/netcore/blocklist/import"      element={<ProtectedRoute>{G('netcore_behaviour', <BlocklistImport />)}</ProtectedRoute>} />
      <Route path="/netcore/campaigns/new"        element={<ProtectedRoute>{G('netcore_behaviour', <CampaignWizard />)}</ProtectedRoute>} />
      <Route path="/netcore/campaigns/:id"        element={<ProtectedRoute>{G('netcore_behaviour', <CampaignWizard />)}</ProtectedRoute>} />
      <Route path="/netcore/campaigns/:id/report" element={<ProtectedRoute>{G('netcore_behaviour', <CampaignReport />)}</ProtectedRoute>} />
      <Route path="/netcore/templates/new"        element={<ProtectedRoute>{G('netcore_behaviour', <TemplateEditor />)}</ProtectedRoute>} />
      <Route path="/netcore/templates/:id"        element={<ProtectedRoute>{G('netcore_behaviour', <TemplateEditor />)}</ProtectedRoute>} />
      {/* WhatsApp campaigns — same full-screen (no AdminLayout chrome) treatment as the email
          wizard/editor, since each of these owns the whole viewport. */}
      <Route path="/netcore/whatsapp/new"           element={<ProtectedRoute>{G('netcore_behaviour', <WaCampaignWizard />)}</ProtectedRoute>} />
      <Route path="/netcore/whatsapp/templates/new" element={<ProtectedRoute>{G('netcore_behaviour', <WaTemplateEditor />)}</ProtectedRoute>} />
      <Route path="/netcore/whatsapp/templates/:id" element={<ProtectedRoute>{G('netcore_behaviour', <WaTemplateEditor />)}</ProtectedRoute>} />
      <Route path="/netcore/whatsapp/:id/report"    element={<ProtectedRoute>{G('netcore_behaviour', <WaCampaignReport />)}</ProtectedRoute>} />
      <Route path="/netcore/whatsapp/:id"           element={<ProtectedRoute>{G('netcore_behaviour', <WaCampaignWizard />)}</ProtectedRoute>} />

      {/* Journey builder — full-screen canvas, same treatment as the campaign wizards above */}
      <Route path="/netcore/journeys/new"           element={<ProtectedRoute>{G('netcore_behaviour', <JourneyBuilder />)}</ProtectedRoute>} />
      <Route path="/netcore/journeys/:id"           element={<ProtectedRoute>{G('netcore_behaviour', <JourneyBuilder />)}</ProtectedRoute>} />

      <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        {/* Dashboard is open to every authenticated user */}
        <Route index element={<Dashboard />} />

        {/* Student Management */}
        <Route path="students/all" element={G('all_students', <AllStudents />)} />
        <Route path="students/iit" element={G('all_iit_students', <IITStudents />)} />
        <Route path="students/unregistered" element={G('unregistered_students', <UnregisteredStudents />)} />
        <Route path="students/registration-checker" element={G('registration_checker', <RegistrationChecker />)} />
        <Route path="students/download" element={G('download_student_data', <DownloadStudentData />)} />
        <Route path="students/ip-log" element={G('students_with_ip', <StudentsWithIP />)} />
        <Route path="students/edit/:id" element={G('all_students', <EditStudent />)} />
        <Route path="students/view/:id" element={G('all_students', <ViewStudent />)} />
        <Route path="/search_result" element={G('all_students', <SearchResult />)} />

        {/* Referral Management */}
        <Route path="referrals" element={G('manage_referrals', <ReferralList />)} />
        <Route path="/referral-detail-for-admin" element={G('manage_referrals', <ReferralDetailsForAdmin />)} />
        <Route path="referrals/withdrawals" element={G('manage_withdrawal', <WithdrawalList />)} />

        {/* Refund Management */}
        <Route path="refunds" element={G('manage_refund', <RefundList />)} />
        <Route path="refunds/new" element={G('manage_refund', <RefundNew />)} />
        <Route path="refunds/map-list" element={G('refund_map_list', <RefundMapList />)} />

        {/* Attendance */}
        <Route path="attendance" element={G('attendance', <Attendance />)} />

        {/* Domain Management */}
        <Route path="domains" element={G('manage_domains', <DomainList />)} />

        {/* Netcore — sub-layout with sidebar + sub-sidebar (Dashboard + Audience + Engage + Content) */}
        <Route path="netcore" element={G('netcore_behaviour', <NetcoreLayout />)}>
          <Route index element={<NetcoreBehaviour />} />
          <Route path="behaviour" element={<NetcoreBehaviour />} />
          <Route path="contacts" element={<NetcoreContacts />} />
          <Route path="contacts/:email" element={<NetcoreUserTimeline />} />
          <Route path="segments" element={<NetcoreSegments />} />
          <Route path="segments/:id/users" element={<NetcoreSegmentUsers />} />
          <Route path="lists" element={<NetcoreLists />} />
          <Route path="lists/logs" element={<ContactLogs />} />
          <Route path="lists/:id/contacts" element={<NetcoreListContacts />} />
          <Route path="blocklist" element={<NetcoreBlocklist />} />
          <Route path="blocklist/logs" element={<BlocklistLogs />} />
          <Route path="attributes" element={<NetcoreAttributes />} />
          <Route path="attributes/logs" element={<AttributeLogs />} />
          {/* One list for both channels. CampaignsList (email-only) is retired from routing —
              its wizard, report and create flow are all still reachable from here. */}
          <Route path="campaigns" element={<CampaignsUnified />} />
          <Route path="templates" element={<TemplatesList />} />
          <Route path="domains" element={<EmailDomains />} />
          {/* Settings live INSIDE the sub-layout so the Settings sub-nav stays visible while
              moving between them. They used to be full-screen routes with nothing linking to
              them at all. */}
          <Route path="settings" element={<EspSettings />} />
          <Route path="whatsapp/settings" element={<WaSettings />} />
          {/* Performance + Preview for one campaign, either channel. Static 'campaigns/:channel/:id'
              cannot collide with the full-screen wizard route, which is /netcore/campaigns/:id. */}
          <Route path="campaigns/:channel/:id" element={<CampaignDetail />} />
          <Route path="journeys" element={<JourneyList />} />
          <Route path="journeys/:id/report" element={<JourneyReport />} />
          {/* Account-level quiet hours. Static, so it outranks journeys/:id/report. */}
          <Route path="journeys/dnd" element={<DndSettings />} />
          {/* The engine's queue — overdue steps, quiet-hours holds, retries and failures.
              Static like journeys/dnd, so it outranks journeys/:id/report. */}
          <Route path="journeys/outbox" element={<JourneyOutbox />} />
          {/* Static paths, so they outrank the full-screen /netcore/whatsapp/:id route above
              (React Router v6 ranks by specificity, not declaration order). */}
          {/* Retired — the merged Campaigns list covers both channels. Kept as a redirect so
              old bookmarks and any link left in an email still land somewhere sensible. */}
          <Route path="whatsapp" element={<Navigate to="/netcore/campaigns" replace />} />
          <Route path="whatsapp/templates" element={<WaTemplatesList />} />
          <Route path="whatsapp/inbox" element={<WaInbox />} />
        </Route>
        <Route path="netcore/filter" element={G('netcore_filter', <NetcoreFilter />)} />

        {/* Homepage */}
        <Route path="/homepage" element={G('homepage', <HomePage />)} />

        {/* Internships */}
        <Route path="internships" element={G('internship_list', <InternshipList />)} />
        <Route path="internships/purchased" element={G('purchased_internships', <PurchasedInternships />)} />
        <Route path="internships/starter-kit" element={G('purchased_starter_kit', <PurchasedStarterKit />)} />
        <Route path="internships/allocate" element={G('allocate_internships', <AllocateInternships />)} />
        <Route path="internships/projects" element={G('project_submission', <ProjectSubmission />)} />
        <Route path="internships/payments" element={G('check_payments', <CheckPayments />)} />
        <Route path="internships/coupons" element={G('manage_coupons', <ManageCoupons />)} />
        <Route path="internships/simulation" element={G('internship_simulation', <InternshipSimulation2 />)} />
        <Route path="internships/problem-statements" element={G('problem_statement', <ProblemStatements />)} />
        <Route path="internships/problem-statements/:internshipId" element={G('problem_statement', <ProblemStatements />)} />
        <Route path="internships/assignment-panel" element={G('assignment_panel', <AssignmentPanel />)} />

        {/* Blogs */}
        <Route path="blogs/add" element={G('add_blogs', <AddBlog />)} />
        <Route path="blogs" element={G('manage_blogs', <ManageBlogs />)} />
        <Route path="blogs/edit/:id" element={G('manage_blogs', <EditBlog />)} />

        {/* FAQs */}
        <Route path="faqs" element={G('manage_faqs', <ManageFaqs />)} />

        {/* Assessments */}
        <Route path="assessments" element={G('total_assessments', <TotalAssessments />)} />

        {/* Communication */}
        <Route path="communication/notification" element={G('send_notification', <SendNotification />)} />
        <Route path="/communication/manage" element={G('delete_notification', <ManageNotifications />)} />
        <Route path="communication/whatsapp" element={G('whatsapp_community', <WhatsAppCommunity />)} />
        <Route path="communication/email-templates" element={G('email_templates', <EmailTemplates />)} />
        <Route path="communication/email" element={G('campaign_emails', <CampaignEmails />)} />
        <Route path="communication/push" element={G('push_notification', <PushNotification />)} />
        <Route path="communication/bulk-email" element={G('campaign_emails', <BulkEmail />)} />

        {/* Examinations */}
        <Route path="exams/results" element={G('exam_result', <ExamResults />)} />
        <Route path="exams/not-given" element={G('exam_not_given', <ExamNotGiven />)} />
        <Route path="exams/versions" element={G('cit_versions', <CITVersions />)} />
        <Route path="exams/free-applicants" element={G('free_internship_applicants', <FreeApplicants />)} />
        <Route path="exams/panel" element={G('exam_panel_admin', <ExamPanelForAdmin />)} />
        <Route path="exams/results-new" element={G('exam_results_new', <ExamResultsNew />)} />
        <Route path="exams/auto-submitted" element={G('auto_submitted_exams', <AutoSubmittedExams />)} />
        <Route path="exams/publish-result" element={G('publish_result', <ResultPublish />)} />
        <Route path="exams/publish-result-test" element={G('publish_result_test', <ResultPublishTest />)} />
        <Route path="exams/not-attempted-exam" element={G('not-attempted-exam', <NotAttemptedExam/>)} />

        {/* Reporting & Analysis */}
        <Route path="reports/batch-dates" element={G('batch_dates', <BatchDates />)} />
        <Route path="reports" element={G('reports', <Reports />)} />
        <Route path="reports/agency-1" element={G('agency_reports_1', <AgencyReport1 />)} />
        <Route path="reports/agency-2" element={G('agency_reports_2', <AgencyReport2 />)} />
        <Route path="reports/meta-old" element={G('meta_reports_old', <MetaAdsDashboardOld user={user} canAccessRemark2={hasPermission('meta_remark2_access')} />)} />
        <Route path="reports/meta-new" element={G('meta_reports_new', <MetaAdsNew />)} />
        <Route path="reports/funnel-economy" element={G('funnel_economics', <FunnelEconomicsView />)} />
        <Route path="reports/matching" element={G('matching_data', <MatchingData />)} />
        <Route path="reports/clarity" element={G('clarity_data', <ClarityData />)} />
        <Route path="reports/availability" element={G('user_availability', <UserAvailability />)} />

        {/* Companies */}
        <Route path="companies" element={G('all_companies', <CompanyList />)} />
        <Route path="companies/iit" element={G('all_iit_companies', <IITCompanies />)} />
        <Route path="companies/tpo-hod" element={G('tpo_hod_details', <CompanySurveyTabs />)} />

        {/* Support */}
        <Route path="support/wa-links" element={G('whatsapp_community_links', <WALinks />)} />
        <Route path="support/placement-links" element={G('whatsapp_placement_club_links', <PlacementLinks />)} />
        <Route path="support/placement-links_for_refund" element={G('whatsapp_placement_club_links_for_refund', <PlacementLinksForRefund />)} />
        <Route path="support/placement-links_for_non_qualified" element={G('whatsapp_placement_club_links_for_non_qualified', <PlacementLinksForNonQualified />)} />
        <Route path="support" element={G('support_tickets', <SupportTickets />)} />
        <Route path="support/agents" element={G('support_agents', <SupportAgents />)} />
        <Route path="/support/ticket/:ticket_id" element={G('support_tickets', <ViewTicket />)} />
        <Route path="support/instant-wa" element={G('instant_exam_wa_link', <InstantExamWALinks />)} />
        <Route path="support/custom-date" element={G('custom_placement_date', <CustomPlacementDates />)} />
        <Route path="support/link-log" element={G('placement_link_log', <PlacementLinkLog />)} />

        {/* Settings */}
        <Route path="settings" element={G('settings', <Settings />)} />
        <Route path="settings/aws" element={G('change_aws_instance', <AWSInstanceManager />)} />
        <Route path="settings/seed-exam" element={G('seed_exam_users', <SyncExamUsers />)} />
        <Route path="settings/delete-exam-users" element={G('delete_excess_exam_users', <DeleteIncompleteExam />)} />

        {/* Admin Panel */}
        <Route path="admin-panel/career-roadmap" element={G('career_roadmaps', <CareerRoadmapDashboard />)} />
        <Route path="admin-panel/result-data" element={G('add_data_result_page', <DomainManagement />)} />
        <Route path="admin-panel/internship" element={G('internships', <Placeholder />)} />
        <Route path="admin-panel/skills" element={G('skills', <SkillSegments />)} />
        <Route path="skills/:segmentId" element={G('skills', <SkillSegmentSkills />)} />
        <Route path="skills/:segmentId/edit/:skillId" element={G('skills', <SkillEditSkill />)} />
        <Route path="admin-panel/assignments" element={G('submitted_assignments', <SubmittedAssignments />)} />

        {/* Permissions — SUPERADMIN ONLY */}
        <Route
          path="permissions"
          element={
            <PermissionGate superadminOnly>
              <Permissions />
            </PermissionGate>
          }
        />

        {/* LMS System — one gated page, then a permission per tab (see LMS_TABS) */}
        <Route path="lms" element={G('lms_system', <LmsLayout />)}>
          <Route index element={<LmsGate perm="lms_dashboard"><LmsDashboard /></LmsGate>} />
          <Route path="courses" element={<LmsGate perm="lms_courses"><LmsCourses /></LmsGate>} />
          <Route path="courses/:courseId" element={<LmsGate perm="lms_courses"><LmsCourseBuilder /></LmsGate>} />
          <Route path="courses/:courseId/lessons/:lessonId" element={<LmsGate perm="lms_courses"><LmsLessonEditor /></LmsGate>} />
          <Route path="learners" element={<LmsGate perm="lms_learners"><LmsLearners /></LmsGate>} />
          <Route path="enrollments" element={<LmsGate perm="lms_enrollments"><LmsEnrollments /></LmsGate>} />
          <Route path="quizzes" element={<LmsGate perm="lms_quizzes"><LmsQuizzes /></LmsGate>} />
          <Route path="quizzes/:quizId" element={<LmsGate perm="lms_quizzes"><LmsQuizBuilder /></LmsGate>} />
          <Route path="responses" element={<LmsGate perm="lms_forms"><LmsResponses /></LmsGate>} />
          <Route path="reports" element={<LmsGate perm="lms_reports"><LmsReports /></LmsGate>} />
          <Route path="support" element={<LmsGate perm="lms_support"><LmsSupport /></LmsGate>} />
          <Route path="settings" element={<LmsGate perm="lms_settings"><LmsSettings /></LmsGate>} />
        </Route>

        <Route path="notes" element={G('notes', <Notes />)} />

        {/* Monitoring — synthetic checks, run history & incidents */}
        <Route path="monitoring" element={G('monitoring', <Monitoring />)} />

        {/* Freshdesk */}
        <Route path="freshdesk" element={G('freshdesk', <Freshdesk />)} />

        {/* Enrollment Audit — upload an enrollment export, check it against users + store orders */}
        <Route path="enrollment-audit" element={G('enrollment_audit', <EnrollmentAudit />)} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
