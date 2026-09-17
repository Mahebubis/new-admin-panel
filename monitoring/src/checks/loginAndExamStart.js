// src/checks/loginAndExamStart.js
//
// MVP test #3 — "Login + exam start".
//
// Signs in as the student registered a moment ago on a *fresh* browser context
// (so it exercises login.php and the session cookie for real, not the session
// registration left behind), then walks the exam hand-off the dashboard
// performs: user_login_initiate -> open exam.internshipstudio.com with the
// returned hash -> Start Exam -> first question on screen.

import { newContext, collectConsole, gotoOk, closeQuietly } from '../browser.js';
import { capturePage } from '../utils/artifacts.js';
import { expect } from '../utils/result.js';
import { post, snippet } from '../utils/http.js';

export default {
    id: 'login-exam-start',
    name: 'Login and exam start',
    group: 'journey',
    severity: 'critical',
    needsBrowser: true,
    requires: ['registration'],

    async run({ config, recorder, browser, artifactDir, shared, log }) {
        const student = shared.student;
        expect(student, 'No synthetic student available — registration did not run.');

        const context = await newContext(browser);
        const page = await context.newPage();
        const consoleLines = collectConsole(page);

        try {
            // ── Login ───────────────────────────────────────────────────────
            await recorder.step('Open login page', async () => {
                await gotoOk(page, `${config.targets.dashboard}/login`, { waitUntil: 'domcontentloaded' });
                await page.waitForSelector('input[name="email"], #email', {
                    state: 'visible',
                    timeout: config.runtime.stepTimeoutMs,
                });
            });

            await recorder.step('Sign in', async () => {
                await page.fill('input[name="email"], #email', student.email);
                await page.fill('input[name="password"], #password', student.password);
                await page.locator('form button[type="submit"]').first().click();

                const timeout = config.runtime.stepTimeoutMs;

                // Success is "we left /login". The app routes new students to
                // several different landing pages depending on their state, so
                // asserting a specific destination would be brittle.
                const left = page
                    .waitForURL((url) => !/\/login\b/.test(url.pathname), { timeout })
                    .then(() => ({ kind: 'success' }))
                    .catch(() => null);

                const swalError = page
                    .locator('.swal2-popup')
                    .waitFor({ state: 'visible', timeout })
                    .then(async () => ({
                        kind: 'error',
                        message:
                            (await page
                                .locator('#swal2-html-container, .swal2-html-container')
                                .first()
                                .textContent()
                                .catch(() => '')) || 'unknown error',
                    }))
                    .catch(() => null);

                const outcome = await Promise.race([
                    left,
                    swalError,
                    new Promise((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), timeout)),
                ]);

                if (outcome && outcome.kind === 'error') {
                    expect(false, `Login rejected: "${outcome.message.trim()}"`);
                }
                expect(
                    outcome && outcome.kind === 'success',
                    `Login submitted but the app stayed on the login page (${page.url()}).`
                );
                return page.url();
            });

            await recorder.step('Verify logged-in session', async () => {
                const session = await page.evaluate(async (base) => {
                    const res = await fetch(`${base}/api/get_user_profile.php`, {
                        method: 'GET',
                        credentials: 'include',
                    });
                    let body = null;
                    try {
                        body = await res.json();
                    } catch {
                        body = null;
                    }
                    return { status: res.status, status_field: body && body.status };
                }, config.targets.dashboard);

                expect(
                    session.status < 400 && session.status_field !== 'unauthenticated',
                    `Session invalid after login (HTTP ${session.status}, status="${session.status_field}").`
                );
                return 'session ok';
            });

            // ── Exam hand-off ───────────────────────────────────────────────
            const hash = await recorder.step('Request exam access token', async () => {
                const res = await post(
                    `${config.targets.examApi}/api/user_login_initiate`,
                    { user_id: shared.userId, exam_id: config.exam.examId },
                    { expectJson: true }
                );

                expect(res.status < 500, `user_login_initiate returned HTTP ${res.status} — ${snippet(res.text)}`);
                const userHash = res.json && res.json.data && res.json.data.user_hash;
                expect(
                    userHash,
                    `No user_hash returned for exam ${config.exam.examId} — students cannot enter the exam. ` +
                    `Body: ${snippet(res.text)}`
                );

                shared.examHash = userHash;
                recorder.note('examId', config.exam.examId);
                return userHash;
            });

            await recorder.step('Open exam portal', async () => {
                const examUrl =
                    `${config.targets.exam}/?user_id=${encodeURIComponent(shared.userId)}` +
                    `&hash=${encodeURIComponent(hash)}`;

                await gotoOk(page, examUrl, { waitUntil: 'domcontentloaded' });

                // The exam SPA verifies the hash and, on failure, hard-redirects
                // back to the dashboard. Catching that bounce is the whole
                // point of this step.
                await page.waitForTimeout(2500);
                expect(
                    !page.url().startsWith(config.targets.dashboard),
                    'Exam portal bounced back to the dashboard — user_login_verify rejected the hash.'
                );

                await page.waitForSelector('button', {
                    state: 'visible',
                    timeout: config.runtime.stepTimeoutMs,
                });

                const bodyText = (await page.textContent('body')) || '';
                expect(
                    !/^\s*Loading\.\.\.\s*$/.test(bodyText),
                    'Exam portal never got past "Loading..." — user_login_verify did not answer.'
                );
                return page.url();
            });

            await recorder.step('Click Start Exam', async () => {
                const startButton = page
                    .getByRole('button', { name: /start (exam|retest)/i })
                    .first();

                await startButton.waitFor({ state: 'visible', timeout: config.runtime.stepTimeoutMs });
                await startButton.click();

                await page.waitForURL(/\/quiz/, { timeout: config.runtime.stepTimeoutMs });
                return page.url();
            });

            await recorder.step('First question renders', async () => {
                // QuizPanel calls start_exam_process on mount and then paints
                // the options. Radio inputs appearing is the proof that the
                // whole chain — auth, exam session, question bank — worked.
                await page.waitForSelector('input[type="radio"]', {
                    state: 'visible',
                    timeout: config.runtime.stepTimeoutMs,
                });

                const optionCount = await page.locator('input[type="radio"]').count();
                expect(
                    optionCount >= 2,
                    `Exam loaded with only ${optionCount} option(s) on the first question.`
                );

                recorder.note('optionsOnFirstQuestion', optionCount);
                log.info(`exam ${config.exam.examId} started for user ${shared.userId}`);
                return `${optionCount} options`;
            });

            // Handed to the submission check, which continues in this same tab.
            shared.examContext = context;
            shared.examPage = page;
            shared.examConsoleLines = consoleLines;
        } catch (error) {
            for (const artifact of await capturePage(page, artifactDir, 'login-exam-start', { consoleLines })) {
                recorder.addArtifact(artifact);
            }
            await closeQuietly(page);
            await closeQuietly(context);
            throw error;
        }
    },
};
