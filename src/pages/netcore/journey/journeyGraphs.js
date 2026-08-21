/*
  Serializable sample journey graphs — plain {nodes, edges} in the exact shape the
  builder holds at runtime (node: {id,key,cfg,x,y}; edge: {id,from,branch,to,wait}).
  Used to seed a few flagship journeys with real content so opening them from the list
  renders a genuine flow. The builder loads these verbatim (see initBuilder boot).

  Branch labels must match each node type's outputs in the builder registry, e.g.
  trg_business→['Yes'], act_wa→['Sent','Failed'], cnd_event→['True','False'],
  cnd_split→variant keys, flw_event→['Happened','Timed out'].
*/

const N = (id, key, x, y, cfg) => ({ id, key, cfg, x, y });
const E = (id, from, branch, to, wait = null) => ({ id, from, branch, to, wait });
const g = (nodes, edges) => ({
  nodes: Object.fromEntries(nodes.map(n => [n.id, n])),
  edges: Object.fromEntries(edges.map(e => [e.id, e])),
});

/* Business event → WhatsApp → 20h → joined? → attr / SMS (Failed merges onto SMS) */
export const batchReminderGraph = g(
  [
    N('n1', 'trg_business', 60, 40, { event: 'batch_starts_tomorrow', map: [{ a: 'batch_code', op: 'equals', v: 'BATCH_CODE' }], window: 'In the past 30 days', occ: 'At least once' }),
    N('n2', 'act_wa', 60, 206, { template: 'batch_allotment_v3', sender: '+91 90000 11111 (iStudio)' }),
    N('n3', 'cnd_event', 60, 392, { type: 'App / web activity', event: 'batch_joined', wtype: 'Past number of hours', wamount: '24' }),
    N('n4', 'act_attr', -190, 578, { attr: 'TRAINING_STATUS', value: 'active' }),
    N('n5', 'act_sms', 300, 578, { template: 'BATCH_START_02' }),
  ],
  [
    E('e1', 'n1', 'Yes', 'n2'),
    E('e2', 'n2', 'Sent', 'n3', { amount: '20', unit: 'hours' }),
    E('e3', 'n3', 'True', 'n4'),
    E('e4', 'n3', 'False', 'n5'),
    E('e5', 'n2', 'Failed', 'n5'),
  ],
);

/* Segment → 50/50 split → two emails → wait-for-event (both merge) → exit / attr */
export const dormantGraph = g(
  [
    N('n1', 'trg_segment', 60, 40, { segment: 'Dormant 30+ days', freq: 'Every week', users: 'Only new ones' }),
    N('n2', 'cnd_split', 60, 206, { variants: [{ key: 'A', pct: 50, label: 'Discount' }, { key: 'B', pct: 50, label: 'Social proof' }], metric: 'Course purchased' }),
    N('n3', 'act_email', -190, 392, { template: 'Course store ₹99 offer', from: 'alert.internshipstudio.com' }),
    N('n4', 'act_email', 300, 392, { template: 'OffCampusly welcome + batch', from: 'alert.internshipstudio.com' }),
    N('n5', 'flw_event', 60, 578, { event: 'course_purchased', amount: '7', unit: 'days' }),
    N('n6', 'act_exit', -190, 764, { reason: 'Reactivated' }),
    N('n7', 'act_attr', 300, 764, { attr: 'DORMANT', value: 'true' }),
  ],
  [
    E('e1', 'n1', 'Yes', 'n2'),
    E('e2', 'n2', 'A', 'n3'),
    E('e3', 'n2', 'B', 'n4'),
    E('e4', 'n3', 'Sent', 'n5'),
    E('e5', 'n4', 'Sent', 'n5'),
    E('e6', 'n5', 'Happened', 'n6'),
    E('e7', 'n5', 'Timed out', 'n7'),
  ],
);

/* Activity: registration_complete → attribute check → WhatsApp/email → event check → SMS/exit (Failed merges) */
export const entranceNudgeGraph = g(
  [
    N('n1', 'trg_activity', 60, 40, { type: 'App / web activity', event: 'registration_complete', repeat: 'First time this event happens', skip: true }),
    N('n2', 'cnd_attr', 60, 206, { match: 'All rules', rules: [{ a: 'EXAM_ATTEMPTED', op: 'Is', v: 'No' }] }),
    N('n3', 'act_wa', -210, 392, { template: 'icat_exam_nudge', sender: '+91 90000 11111 (iStudio)' }),
    N('n4', 'act_email', 330, 392, { template: 'iCAT v172 — exam reminder', from: 'alert.internshipstudio.com' }),
    N('n5', 'cnd_event', -210, 578, { type: 'App / web activity', event: 'exam_started', wtype: 'Past number of hours', wamount: '24' }),
    N('n6', 'act_exit', -460, 764, { reason: 'Started the exam' }),
    N('n7', 'act_sms', -70, 764, { template: 'ICAT_REMIND_01' }),
    N('n8', 'act_exit', 330, 578, { reason: 'Already attempted' }),
  ],
  [
    E('e1', 'n1', 'Yes', 'n2', { amount: '5', unit: 'minutes' }),
    E('e2', 'n2', 'True', 'n3', { amount: '1', unit: 'hours' }),
    E('e3', 'n2', 'False', 'n4'),
    E('e4', 'n3', 'Sent', 'n5', { amount: '24', unit: 'hours' }),
    E('e5', 'n5', 'True', 'n6'),
    E('e6', 'n5', 'False', 'n7'),
    E('e7', 'n4', 'Sent', 'n8'),
    E('e8', 'n3', 'Failed', 'n7'),
  ],
);

/* Activity: payment_failed → reachable-channel fan-out (WhatsApp/Email/SMS/Push) → exit */
export const paymentRecoveryGraph = g(
  [
    N('n1', 'trg_activity', 60, 40, { type: 'App / web activity', event: 'payment_failed', repeat: 'Every time this event happens' }),
    N('n2', 'cnd_reach', 60, 206, { channels: ['WhatsApp', 'Email', 'SMS', 'App push'] }),
    N('n3', 'act_wa', -460, 392, { template: 'offer_extension_48h', sender: '+91 90000 11111 (iStudio)' }),
    N('n4', 'act_email', -170, 392, { template: 'Course store ₹99 offer', from: 'alert.internshipstudio.com' }),
    N('n5', 'act_sms', 120, 392, { template: 'PAY_FAIL_03' }),
    N('n6', 'act_push', 410, 392, { title: 'Your seat is still held', body: 'Tap to retry your payment' }),
    N('n7', 'act_exit', 700, 392, { reason: 'No channel available' }),
  ],
  [
    E('e1', 'n1', 'Yes', 'n2', { amount: '15', unit: 'minutes' }),
    E('e2', 'n2', 'WhatsApp', 'n3'),
    E('e3', 'n2', 'Email', 'n4'),
    E('e4', 'n2', 'SMS', 'n5'),
    E('e5', 'n2', 'App push', 'n6'),
    E('e6', 'n2', 'Unreachable', 'n7'),
  ],
);

/* Activity: certificate_issued → email → 2d → WhatsApp → wait-for-event → attr / exit */
export const referralGraph = g(
  [
    N('n1', 'trg_activity', 60, 40, { type: 'App / web activity', event: 'certificate_issued', repeat: 'First time this event happens' }),
    N('n2', 'act_email', 60, 206, { template: 'Certificate ready', from: 'alert.internshipstudio.com' }),
    N('n3', 'act_wa', 60, 392, { template: 'referral_share', sender: '+91 90000 11111 (iStudio)' }),
    N('n4', 'flw_event', 60, 578, { event: 'referral_signup', amount: '30', unit: 'days' }),
    N('n5', 'act_attr', -120, 764, { attr: 'SOURCE', value: 'referrer' }),
    N('n6', 'act_exit', 220, 764, { reason: 'No referral in window' }),
  ],
  [
    E('e1', 'n1', 'Yes', 'n2'),
    E('e2', 'n2', 'Sent', 'n3', { amount: '2', unit: 'days' }),
    E('e3', 'n3', 'Sent', 'n4'),
    E('e4', 'n4', 'Happened', 'n5'),
    E('e5', 'n4', 'Timed out', 'n6'),
  ],
);
