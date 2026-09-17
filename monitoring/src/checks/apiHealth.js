// src/checks/apiHealth.js
//
// The APIs behind registration, exam and payment, probed directly. This runs
// on the light schedule and is what separates "the API is down" from "the UI
// changed" when the journey checks fail.
//
// Every probe here is read-only or explicitly invalid input. Nothing written,
// no order created, no money moved.

import { get, post, snippet } from '../utils/http.js';
import { expect } from '../utils/result.js';
import { ping } from '../db.js';

/**
 * An endpoint that answers *anything* structured is alive. What we are looking
 * for is a 502/504/connection-refused (process down, nginx orphaned) or a 500
 * (crashed handler) — a 4xx on deliberately bad input is a healthy answer.
 */
const isAlive = (status) => status > 0 && status < 500;

export default {
    id: 'api-health',
    name: 'API health (registration, exam, payment, webhook)',
    group: 'light',
    severity: 'critical',
    needsBrowser: false,

    async run({ config, recorder }) {
        const { dashboard, examApi, paymentApi } = config.targets;

        // ── Database ───────────────────────────────────────────────────────
        // Every one of the APIs below is a thin layer over this database, so
        // when it is unreachable the whole platform is down. Checking it
        // directly turns five confusing API failures into one clear cause.
        if (config.db.cleanupEnabled) {
            await recorder.step('Database reachable', async () => {
                await ping();
                return `${config.db.host}/${config.db.database}`;
            });
        }

        // ── Dashboard / PHP API ────────────────────────────────────────────
        await recorder.step('Dashboard API: exam date', async () => {
            const res = await get(`${dashboard}/api/get_current_exam_date.php`, { expectJson: true });
            expect(res.status < 500, `HTTP ${res.status} — ${snippet(res.text)}`);
            expect(res.json !== null, `Non-JSON response — ${snippet(res.text)}`);
            return res.json?.exam_date?.exam_date ?? 'no-date';
        });

        await recorder.step('Dashboard API: registration endpoint', async () => {
            // The register form calls this on blur to check whether an email is
            // taken. A syntactically valid but unused address is a safe probe:
            // it reads, it never writes.
            const res = await post(
                `${dashboard}/api/register.php`,
                {
                    action: 'verify_email_phone',
                    email: `monitor-probe-${Date.now()}@internshipstudio.com`,
                    phone: '',
                    countryCode: config.student.countryCode,
                },
                { expectJson: true }
            );
            expect(isAlive(res.status), `HTTP ${res.status} — ${snippet(res.text)}`);
            expect(res.json !== null, `register.php returned non-JSON — ${snippet(res.text)}`);
            return res.json?.status ?? 'unknown';
        });

        await recorder.step('Dashboard API: session check', async () => {
            const res = await get(`${dashboard}/api/reauthenticate.php`, { expectJson: true });
            // Unauthenticated is the expected answer — we only care that the
            // PHP process answered rather than the gateway timing out.
            expect(isAlive(res.status), `HTTP ${res.status} — ${snippet(res.text)}`);
            return res.status;
        });

        // ── Exam API (Node/Express) ────────────────────────────────────────
        await recorder.step('Exam API: fetch_all_exams', async () => {
            const res = await post(`${examApi}/api/fetch_all_exams`, {}, { expectJson: true });
            expect(res.status < 500, `HTTP ${res.status} — ${snippet(res.text)}`);
            expect(res.json !== null, `Non-JSON response — ${snippet(res.text)}`);
            const exams = res.json?.data?.exams;
            expect(
                Array.isArray(exams) && exams.length > 0,
                `No exams returned — the exam DB connection is probably down. Body: ${snippet(res.text)}`
            );
            return `${exams.length} exams`;
        });

        await recorder.step('Exam API: fetch_exam_by_id', async () => {
            const res = await post(
                `${examApi}/api/fetch_exam_by_id`,
                { exam_id: config.exam.examId },
                { expectJson: true }
            );
            expect(res.status < 500, `HTTP ${res.status} — ${snippet(res.text)}`);
            expect(
                res.json?.data?.exam,
                `Exam ${config.exam.examId} not returned — ${snippet(res.text)}`
            );
            return `exam ${config.exam.examId} ok`;
        });

        await recorder.step('Exam API: question bank', async () => {
            const res = await post(
                `${examApi}/api/fetch_random_questions`,
                { exam_id: config.exam.examId, total_questions: 1 },
                { expectJson: true }
            );
            expect(res.status < 500, `HTTP ${res.status} — ${snippet(res.text)}`);
            const questions = res.json?.data?.questions;
            expect(
                Array.isArray(questions) && questions.length > 0,
                `Question bank empty for exam ${config.exam.examId} — students would see a blank exam. ` +
                `Body: ${snippet(res.text)}`
            );
            return `${questions.length} question(s)`;
        });

        // ── Payment API (Go/chi) ───────────────────────────────────────────
        await recorder.step('Payment API: order endpoint reachable', async () => {
            // Deliberately empty body. A healthy service replies 400 "Invalid
            // request body"; a dead one gives 502/504 or never answers.
            const res = await post(`${paymentApi}/create-order`, {}, { expectJson: true });
            expect(
                isAlive(res.status),
                `create-order returned HTTP ${res.status} — ${snippet(res.text)}`
            );
            return `HTTP ${res.status}`;
        });

        await recorder.step('Payment API: payment details endpoint', async () => {
            const res = await post(`${paymentApi}/get-payment-details`, {}, { expectJson: true });
            expect(
                isAlive(res.status),
                `get-payment-details returned HTTP ${res.status} — ${snippet(res.text)}`
            );
            return `HTTP ${res.status}`;
        });

        await recorder.step('Payment API: Cashfree webhook reachable', async () => {
            // An unsigned body must be rejected, not crash the handler. Both a
            // rejection and a 200-with-ignored are fine; a 5xx or a timeout is
            // the failure that silently loses real payment callbacks.
            const res = await post(
                `${paymentApi}/payment-webhook`,
                { monitor: true, type: 'MONITOR_PROBE' },
                { headers: { 'x-webhook-signature': 'monitor-probe' }, expectJson: true }
            );
            expect(
                isAlive(res.status),
                `payment-webhook returned HTTP ${res.status} — real Cashfree callbacks would be dropped. ` +
                `Body: ${snippet(res.text)}`
            );
            return `HTTP ${res.status}`;
        });

        await recorder.step('Payment API: Razorpay webhook reachable', async () => {
            const res = await post(
                `${paymentApi}/razorpay-webhook`,
                { monitor: true, event: 'monitor.probe' },
                { headers: { 'x-razorpay-signature': 'monitor-probe' }, expectJson: true }
            );
            expect(
                isAlive(res.status),
                `razorpay-webhook returned HTTP ${res.status} — ${snippet(res.text)}`
            );
            return `HTTP ${res.status}`;
        });
    },
};
