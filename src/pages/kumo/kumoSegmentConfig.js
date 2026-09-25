/* Kumo segment builder — event / payload / filter catalogue.
 *
 * A self-contained copy of the Netcore segment config (segmentEngagementConfig.js
 * + eventsConfig.js) so the Kumo builder never reaches into ../netcore/.
 * The condition shapes produced here must stay byte-compatible with the Netcore
 * builder's output — the Kumo backend feeds the saved config to the same
 * buildSegmentSql() resolver.
 */

/* ════════════════════════════════════════════════════════════════════════
   ENGAGEMENT / CONTACTS  (copy of netcore/segmentEngagementConfig.js)
   ════════════════════════════════════════════════════════════════════════ */

/* sources: which "performed in" types an event supports (first one is the default).
   filters: which where-filters the funnel icon offers (campaign source only — journey
   messages keep no per-event user agent / bot flag, so they cannot be filtered).
   disabled: the channel has no provider connected, so nothing is ever recorded for it. */
export const ENGAGEMENT_EVENTS = [
  { key: 'email_opened',      label: 'Email Opened/Read',  channel: 'email',    sources: ['campaign', 'journey', 'tags'], filters: ['open_type', 'platform', 'os', 'browser'] },
  { key: 'email_clicked',     label: 'Email Clicked',      channel: 'email',    sources: ['campaign', 'journey', 'tags'], filters: ['click_type', 'link_url', 'platform', 'os', 'browser'] },
  { key: 'email_soft_bounce', label: 'Email soft bounce',  channel: 'email',    sources: ['campaign', 'tags'], filters: [], info: 'Temporary delivery failure (mailbox full, server busy). Recorded for campaigns only — journey bounces are not classified soft/hard.' },
  { key: 'email_hard_bounce', label: 'Email hard bounce',  channel: 'email',    sources: ['campaign', 'tags'], filters: [], info: 'Permanent delivery failure (address does not exist). Unclassified bounces count as hard. Campaigns only.' },
  { key: 'email_unsubscribe', label: 'Email unsubscribe',  channel: 'email',    sources: ['campaign', 'journey', 'tags'], filters: [], oncePerMessage: true },
  { key: 'email_sent',        label: 'Email Sent',         channel: 'email',    sources: ['campaign', 'journey', 'tags'], filters: [] },
  { key: 'sms_sent',          label: 'SMS Sent',           channel: 'sms',      disabled: true },
  { key: 'sms_delivered',     label: 'SMS Delivered',      channel: 'sms',      disabled: true },
  { key: 'sms_clicked',       label: 'SMS Clicked',        channel: 'sms',      disabled: true },
  { key: 'sms_ndnc_dropped',  label: 'SMS Ndnc Dropped',   channel: 'sms',      disabled: true },
  { key: 'sms_others',        label: 'SMS Others',         channel: 'sms',      disabled: true },
  { key: 'apppush_sent',      label: 'App Push Sent',      channel: 'apppush',  disabled: true },
  { key: 'apppush_delivered', label: 'App Push Delivered', channel: 'apppush',  disabled: true },
  { key: 'apppush_clicked',   label: 'App Push Clicked',   channel: 'apppush',  disabled: true },
  { key: 'apppush_failed',    label: 'App Push Failed',    channel: 'apppush',  disabled: true },
  { key: 'webpush_sent',      label: 'Web Push Sent',      channel: 'webpush',  disabled: true },
  { key: 'webpush_delivered', label: 'Web Push Delivered', channel: 'webpush',  disabled: true },
  { key: 'webpush_closed',    label: 'Web Push Closed',    channel: 'webpush',  disabled: true },
  { key: 'webpush_clicked',   label: 'Web Push Clicked',   channel: 'webpush',  disabled: true },
  { key: 'webmsg_clicked',    label: 'Web Message Clicked',   channel: 'webmsg', disabled: true },
  { key: 'webmsg_viewed',     label: 'Web Message Viewed',    channel: 'webmsg', disabled: true },
  { key: 'webmsg_closed',     label: 'Web Message Closed',    channel: 'webmsg', disabled: true },
  { key: 'webmsg_responded',  label: 'Web Message Responded', channel: 'webmsg', disabled: true },
  { key: 'inapp_clicked',     label: 'In-app Clicked',     channel: 'inapp',    disabled: true },
  { key: 'inapp_viewed',      label: 'In-app Viewed',      channel: 'inapp',    disabled: true },
  { key: 'inapp_closed',      label: 'In-app Closed',      channel: 'inapp',    disabled: true },
  { key: 'list_activity',     label: 'List Activity',      channel: 'list',     sources: ['list'], filters: [], info: 'Contact was added to a list (matched to a registered user by email).' },
  { key: 'wa_sent',           label: 'WhatsApp Sent',        channel: 'whatsapp', sources: ['campaign', 'journey', 'tags'], filters: [] },
  { key: 'wa_read',           label: 'WhatsApp Opened/Read', channel: 'whatsapp', sources: ['campaign', 'journey', 'tags'], filters: [] },
  { key: 'wa_delivered',      label: 'WhatsApp Delivered',   channel: 'whatsapp', sources: ['campaign', 'journey', 'tags'], filters: [] },
  { key: 'wa_clicked',        label: 'WhatsApp Clicked',     channel: 'whatsapp', sources: ['campaign', 'journey', 'tags'], filters: [] },
  { key: 'wa_reply',          label: 'WhatsApp Reply',       channel: 'whatsapp', sources: ['campaign', 'tags'], filters: [], info: 'Replies are recorded for campaigns only.' },
  { key: 'rcs_sent',          label: 'RCS Sent',           channel: 'rcs',      disabled: true },
  { key: 'rcs_read',          label: 'RCS Read',           channel: 'rcs',      disabled: true },
  { key: 'rcs_clicked',       label: 'RCS Clicked',        channel: 'rcs',      disabled: true },
  { key: 'rcs_delivered',     label: 'RCS Delivered',      channel: 'rcs',      disabled: true },
  { key: 'rcs_failed',        label: 'RCS Failed',         channel: 'rcs',      disabled: true },
];

export const CONTACT_EVENTS = [
  { key: 'list',    label: 'List' },
  { key: 'segment', label: 'Segment' },
];

export const SOURCE_TYPES = {
  campaign: { label: 'Campaign', any: 'Any Campaign', specific: 'Specific Campaign', pick: 'Select Campaign', noun: 'Campaign' },
  journey:  { label: 'Journey',  any: 'Any Journey',  specific: 'Specific Journey',  pick: 'Select Journey',  noun: 'Journey' },
  tags:     { label: 'Tags',     pick: 'Select Tags', noun: 'Tag' },
  list:     { label: 'List',     any: 'Any List',     specific: 'Specific List',     pick: 'Select List',     noun: 'List' },
};

/* where-filters. `values` → dropdown; no values → free-text input. */
export const ENGAGEMENT_FILTERS = {
  open_type:  { label: 'Open Type',  ops: ['is', 'is_not'], values: [{ value: 'any', label: 'Any' }, { value: 'bot', label: 'Bot Open' }, { value: 'user', label: 'User Open' }], defaultValue: 'user' },
  click_type: { label: 'Click Type', ops: ['is', 'is_not'], values: [{ value: 'any', label: 'Any' }, { value: 'bot', label: 'Bot Click' }, { value: 'user', label: 'User Click' }], defaultValue: 'user' },
  platform:   { label: 'Platform',   ops: ['is', 'is_not'], values: [{ value: 'mobile', label: 'Mobile' }, { value: 'tablet', label: 'Tablet' }, { value: 'desktop', label: 'Desktop' }, { value: 'unknown', label: 'Unknown' }] },
  os:         { label: 'OS',         ops: ['is', 'is_not'], values: [{ value: 'android', label: 'Android' }, { value: 'ios', label: 'iOS' }, { value: 'windows', label: 'Windows' }, { value: 'macos', label: 'macOS' }, { value: 'linux', label: 'Linux' }] },
  browser:    { label: 'Browser',    ops: ['is', 'is_not'], values: [{ value: 'chrome', label: 'Chrome' }, { value: 'safari', label: 'Safari' }, { value: 'firefox', label: 'Firefox' }, { value: 'edge', label: 'Edge' }, { value: 'opera', label: 'Opera' }, { value: 'samsung', label: 'Samsung Internet' }] },
  link_url:   { label: 'Link URL',   ops: ['contains', 'does_not_contain', 'is', 'is_not'] },
};

export const FILTER_OP_LABELS = { is: 'Is', is_not: 'Is not', contains: 'Contains', does_not_contain: 'Does not contain' };

export const engagementEvent = key => ENGAGEMENT_EVENTS.find(e => e.key === key);

/* A fresh condition for a picked item. kind: 'behaviour' | 'engagement' | 'contacts'. */
export function newCondition(kind, eventKey, prev = {}) {
  const base = { did: prev.did === 'did_not_do' ? 'did_not_do' : 'did', condConnector: prev.condConnector || 'AND', day: { type: 'any' } };
  if (kind === 'engagement') {
    const ev = engagementEvent(eventKey);
    return {
      ...base, kind: 'engagement', event: eventKey, measure: 'total', operator: '>=', count: 1,
      source: { type: ev?.sources?.[0] || 'campaign', scope: 'any', ids: [], tags: [] },
      filter: null,
    };
  }
  if (kind === 'contacts') {
    return { did: base.did, condConnector: base.condConnector, kind: 'contacts', event: eventKey, ids: [] };
  }
  return { ...base, kind: 'behaviour', event: eventKey, operator: '>=', count: 1, source: { type: 'any', value: '' }, filter: null };
}

/* Returns a human message for the first incomplete condition, or null when the config is ready. */
export function validateSegmentConfig(config) {
  const sides = [['include', 'Include users'], ['exclude', 'Exclude users']];
  for (const [side, sideLabel] of sides) {
    const blocks = config[side]?.blocks || [];
    for (let b = 0; b < blocks.length; b++) {
      const conds = blocks[b].conditions || [];
      for (let i = 0; i < conds.length; i++) {
        const c = conds[i];
        const where = `${sideLabel} → Block ${b + 1}, condition ${i + 1}`;
        if (!c.event) return `${where}: pick an event.`;
        if (c.kind === 'contacts') {
          if (!c.ids?.length) return `${where}: select at least one ${c.event === 'list' ? 'list' : 'segment'}.`;
        } else if (c.kind === 'engagement') {
          const src = c.source || {};
          const noun = (SOURCE_TYPES[src.type] || SOURCE_TYPES.campaign).noun.toLowerCase();
          if (src.type === 'tags' && !src.tags?.length) return `${where}: select at least one tag.`;
          if (src.type !== 'tags' && src.scope === 'specific' && !src.ids?.length) return `${where}: select at least one ${noun}.`;
          if (c.filter && (!c.filter.payload || c.filter.value === '' || c.filter.value == null)) return `${where}: complete or remove the "where" filter.`;
        }
        if (c.day?.type === 'between' && (!c.day.from || !c.day.to)) return `${where}: pick both dates for "Between".`;
        if (c.day?.type === 'between' && c.day.from > c.day.to) return `${where}: the start date is after the end date.`;
      }
    }
  }
  return null;
}

/* ════════════════════════════════════════════════════════════════════════
   BEHAVIOUR EVENTS + PAYLOADS  (copy of netcore/eventsConfig.js)
   ════════════════════════════════════════════════════════════════════════ */

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
