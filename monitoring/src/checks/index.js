// src/checks/index.js
//
// The check registry. Order matters inside the journey group: each check may
// hand state (session, user id, exam hash) to the next via the shared context,
// and a check whose `requires` are not green is skipped rather than failed —
// which keeps one broken registration from producing five alert emails.

import websiteAvailability from './websiteAvailability.js';
import apiHealth from './apiHealth.js';
import registration from './registration.js';
import loginAndExamStart from './loginAndExamStart.js';
import examSubmission from './examSubmission.js';
import paymentCheckout from './paymentCheckout.js';

export const checks = [
    websiteAvailability,
    apiHealth,
    registration,
    loginAndExamStart,
    examSubmission,
    paymentCheckout,
];

export const GROUPS = ['light', 'journey'];

export function checksInGroup(group) {
    return checks.filter((c) => c.group === group);
}

export function checkById(id) {
    return checks.find((c) => c.id === id);
}

export default checks;
