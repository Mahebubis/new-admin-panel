/* Shared event/payload config used by NetcoreBehaviour and NetcoreSegmentCreate.
   Add an event here once and it appears in both pages. */

/* Conversion events shown as fixed cards on the behaviour dashboard. */
export const CONVERSION_EVENTS = [
  { key: 'register',         label: 'Register' },
  { key: 'signin',           label: 'Signin' },
  { key: 'exam_success',     label: 'Exam Success' },
  { key: 'course_purchase',  label: 'Course Purchase' },
  { key: 'payment_success',  label: 'Payment Success' },
];

/* "Other events" — picked via the edit-icon dropdown on the behaviour page,
   and listed alongside conversion events in the segment event picker. */
export const OTHER_EVENTS = [
  { key: 'preferred_domain',            label: 'Preferred Domain' },
  { key: 'result_view',                 label: 'Result View' },
  { key: 'visited_iap',                 label: 'Visited IAP' },
  { key: 'placement_community_link',    label: 'Placement Community Link' },
  { key: 'instantexam_reminder',        label: 'Instantexam Reminder' },
  { key: 'course_edit',                 label: 'Course Edit' },
  { key: 'register_company',            label: 'Register Company' },
  { key: 'company_signin',              label: 'Company Signin' },
  { key: 'company_vacancy_post',        label: 'Company Vacancy Post' },
  { key: 'mark_attendance',             label: 'Mark Attendance' },
  { key: 'came_on_dashboard',           label: 'Came on Dashboard' },
  { key: 'link_assigned',               label: 'Link Assigned' },
  { key: 'exam_reminder',               label: 'Exam Reminder' },
  { key: 'project_submission_reminder', label: 'Project Submission Reminder' },
  { key: 'one_day_before_batch_start',  label: 'One Day Before Batch Start' },
  { key: 'batch_end_reminder',          label: 'Batch End Reminder' },
];

export const ALL_EVENTS = [...CONVERSION_EVENTS, ...OTHER_EVENTS];

/* Payload parameters per event — raw keys only (no 'select parameter' sentinel). */
export const PAYLOAD_OPTIONS = {
  register:                    ['country', 'mobile', 'last_name', 'state', 'first_name', 'email', 'method', 'source', 'referral', 'express', 'instantexam', 'instantresult', 'setreminder', 'campaign', 'adset', 'ad', 'medium', 'is_from_refund', 'full_url', 'register_type', 'device'],
  signin:                      ['email'],
  exam_success:                ['status', 'result_score'],
  course_purchase:             ['amount', 'internship_name', 'batch_date', 'coupon_applied', 'initiated_at'],
  payment_success:             ['paid_amount', 'coupon_applied_success', 'order_id', 'paid_internship_name', 'paid_batch_date', 'paid_at'],
  preferred_domain:            ['preferred_domain'],
  visited_iap:                 ['visited', 'visited_time'],
  result_view:                 ['score', 'viewed_at'],
  placement_community_link:    ['assigned_links', 'refund_non_refund'],
  instantexam_reminder:        ['date_time', 'time_slot'],
  course_edit:                 ['edit_internship_name', 'edit_page_url', 'edit_batch_date', 'edit_type'],
  register_company:            ['company_logo', 'company_mobile', 'company_name', 'company_email'],
  company_signin:              ['company_signin_email', 'company_signin_status', 'company_signin_ip', 'company_signin_user_agent'],
  company_vacancy_post:        ['vp_email', 'vp_job_type', 'vp_job_title', 'vp_mode', 'vp_openings', 'vp_start_date', 'vp_duration', 'vp_salary', 'vp_comp_amount', 'vp_comp_min', 'vp_comp_max', 'vp_comp_type', 'vp_comp_period', 'vp_experience', 'vp_method', 'vp_source'],
  mark_attendance:             ['internship_id', 'attendance_date', 'note', 'character_count', 'marked_at', 'ip_address', 'user_agent'],
  came_on_dashboard:           ['login_date', 'activity_level'],
  link_assigned:               ['wa_link', 'wa_community', 'link_user_type', 'la_assigned_at'],
  exam_reminder:               ['er_exam_date', 'er_time_slot', 'er_status', 'er_email', 'er_cron_run_id'],
  project_submission_reminder: ['psr_internship_name', 'psr_batch', 'psr_duration_label', 'psr_status', 'psr_email', 'psr_cron_run_id'],
  one_day_before_batch_start:  ['odb_internship_name', 'odb_batch', 'odb_duration_label', 'odb_status', 'odb_email', 'odb_cron_run_id'],
  batch_end_reminder:          ['ber_internship_name', 'ber_batch', 'ber_end_date', 'ber_project_status', 'ber_resubmitted', 'ber_status', 'ber_email', 'ber_cron_run_id'],
};

/* Preset value options per payload key — when set, the segment filter value
   input becomes a searchable dropdown; otherwise it stays a free-text input.
   Add keys here for any column that is enum / yes-no / on-off / fixed-set. */
export const PAYLOAD_VALUES = {
  /* yes / no */
  is_from_refund:         ['yes', 'no'],
  referral:               ['yes', 'no'],
  express:                ['yes', 'no'],
  setreminder:            ['yes', 'no'],
  visited:                ['yes', 'no'],
  coupon_applied:         ['yes', 'no'],
  coupon_applied_success: ['yes', 'no'],
  ber_resubmitted:        ['yes', 'no'],

  /* on / off */
  instantexam:            ['on', 'off'],
  instantresult:          ['on', 'off'],

  /* fixed enum values (derived from DB defaults / app code) */
  refund_non_refund:      ['Non Refund', 'Refund'],
  link_user_type:         ['refund', 'non_refund'],
  company_logo:           ['Has Logo', 'No Logo'],
  method:                 ['Google', 'Manual'],
  source:                 ['web', 'app', 'organic', 'paid'],
  device:                 ['mobile', 'desktop', 'tablet'],
  register_type:          ['normal', 'agency', 'iit'],
  status:                 ['Completed', 'In Progress'],
  edit_type:              ['UPDATE', 'EXTEND', 'CREATE'],
  company_signin_status:  ['success', 'failed'],
  vp_job_type:            ['internship', 'full-time', 'part-time'],
  vp_mode:                ['wfo', 'wfh', 'hybrid'],
  vp_comp_type:           ['Fixed', 'Range', 'Performance'],
  vp_comp_period:         ['hour', 'month', 'year'],
  vp_method:              ['full-time', 'part-time', 'contract', 'freelance'],
  vp_source:              ['Direct', 'is_cit'],
  activity_level:         ['low', 'medium', 'high'],
  ber_project_status:     ['Submitted', 'Not Submitted'],

  /* cron reminder log statuses — common pattern across these tables */
  er_status:              ['sent', 'failed', 'skipped', 'pending'],
  psr_status:             ['sent', 'failed', 'skipped', 'pending'],
  odb_status:             ['sent', 'failed', 'skipped', 'pending'],
  ber_status:             ['sent', 'failed', 'skipped', 'pending'],
};
