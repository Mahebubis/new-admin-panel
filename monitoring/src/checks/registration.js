// src/checks/registration.js
//
// MVP test #2 — the test student completes the real registration form on
// dashboard.internshipstudio.com, exactly as a person would: typing into the
// fields, submitting, and confirming they land on the thank-you page.
//
// The run begins by deleting the account left behind by the previous run, so
// the same fixed email can register again and the exam/payment checks
// downstream inherit a clean account (no exam already taken, no paid order).

import { newContext, collectConsole, gotoOk } from '../browser.js';
import { capturePage } from '../utils/artifacts.js';
import { expect } from '../utils/result.js';
import { getTestStudent } from '../utils/testUser.js';
import { fillPhoneInput } from '../utils/phoneInput.js';
import { resetTestAccount, markAsTestAccount, checkPhoneAvailable } from '../db.js';

export default {
    id: 'registration',
    name: 'Student registration',
    group: 'journey',
    severity: 'critical',
    needsBrowser: true,

    async run({ config, recorder, browser, artifactDir, shared, log }) {
        const student = getTestStudent();
        shared.student = student;

        recorder.note('email', student.email);
        recorder.note('phone', `+${student.countryCode} ${student.phone}`);

        // Its own step so a database problem is reported as a database problem
        // — otherwise it would surface as "email already registered", which
        // points the on-call person at entirely the wrong system.
        await recorder.step('Remove previous test account', async () => {
            if (!config.db.cleanupEnabled) {
                return 'skipped (DB_CLEANUP_ENABLED=false)';
            }
            const result = await resetTestAccount();
            recorder.note('cleanup', result.deleted);

            // The reset frees the email; the phone is a separate unique key and
            // could be held by someone else entirely. Catching that here names
            // the real problem instead of letting the form say "Mobile number
            // already exists", which looks like a broken signup.
            const phone = await checkPhoneAvailable();
            expect(
                phone.available,
                `MONITOR_PHONE ${student.countryCode}-${student.phone} is registered to a different ` +
                `account (user ${phone.heldBy?.id}, ${phone.heldBy?.email}). The reset only deletes ` +
                'by email, so that row will never be freed. Set MONITOR_PHONE to a number no real ' +
                'student uses.'
            );

            if (result.dryRun) {
                return 'dry run — nothing deleted';
            }
            return result.found
                ? `removed user ${result.userId} and its rows`
                : 'no previous account to remove';
        });

        const context = await newContext(browser);
        const page = await context.newPage();
        const consoleLines = collectConsole(page);
        // The exam and payment checks reuse this logged-in session, so the
        // context is handed on rather than closed here.
        shared.context = context;
        shared.consoleLines = consoleLines;

        try {
            await recorder.step('Open registration page', async () => {
                await gotoOk(page, `${config.targets.dashboard}/register`, { waitUntil: 'domcontentloaded' });

                // The page has a maintenance branch that replaces the whole
                // form. Detect it explicitly so the alert says "maintenance
                // mode" rather than "email field not found".
                const maintenance = await page
                    .getByText('Maintenance in Progress', { exact: false })
                    .count()
                    .catch(() => 0);
                expect(
                    maintenance === 0,
                    'Registration is showing "Maintenance in Progress!" — the signup form is not rendered.'
                );

                await page.waitForSelector('input[name="email"]', {
                    state: 'visible',
                    timeout: config.runtime.stepTimeoutMs,
                });
            });

            await recorder.step('Fill registration form', async () => {
                await page.fill('input[name="email"]', student.email);

                // The phone field is a masked, controlled component that
                // pre-fills its own dial code — see utils/phoneInput.js for
                // why typing into it needs more care than fill().
                await fillPhoneInput(page, 'input[name="phone"]', {
                    countryCode: student.countryCode,
                    phone: student.phone,
                    timeout: config.runtime.stepTimeoutMs,
                });

                await page.fill('input[name="fname"]', student.firstName);
                await page.fill('input[name="lname"]', student.lastName);
                await page.fill('input[name="password"]', student.password);
                await page.fill('input[name="cpassword"]', student.password);

                // The form validates email and phone against the server on
                // blur; give that request a beat to land so a duplicate is
                // reported as a form error rather than a submit failure.
                await page.locator('input[name="cpassword"]').blur();
                await page.waitForTimeout(1200);
            });

            await recorder.step('Submit registration', async () => {
                const submit = page.locator('form button[type="submit"]');
                await submit.waitFor({ state: 'visible', timeout: config.runtime.stepTimeoutMs });
                await submit.click();

                // Three possible outcomes: the thank-you route (success), a
                // SweetAlert error popup, or an inline field error. Race them
                // so a failure is reported with the message the student saw.
                const timeout = config.runtime.stepTimeoutMs;

                const success = page
                    .waitForURL(/\/register\/thank-you/, { timeout })
                    .then(() => ({ kind: 'success' }))
                    .catch(() => null);

                const swalError = page
                    .locator('.swal2-popup')
                    .waitFor({ state: 'visible', timeout })
                    .then(async () => ({
                        kind: 'swal',
                        message:
                            (await page
                                .locator('#swal2-html-container, .swal2-html-container')
                                .first()
                                .textContent()
                                .catch(() => '')) || 'unknown error',
                    }))
                    .catch(() => null);

                const inlineError = page
                    .locator('p.text-red-500')
                    .first()
                    .waitFor({ state: 'visible', timeout })
                    .then(async () => ({
                        kind: 'inline',
                        message:
                            (await page.locator('p.text-red-500').first().textContent().catch(() => '')) || '',
                    }))
                    .catch(() => null);

                const outcome = await Promise.race([
                    success,
                    swalError,
                    inlineError,
                    new Promise((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), timeout)),
                ]);

                if (outcome && outcome.kind === 'swal') {
                    expect(false, `Registration rejected by the server: "${outcome.message.trim()}"`);
                }
                if (outcome && outcome.kind === 'inline') {
                    expect(false, `Registration form validation failed: "${outcome.message.trim()}"`);
                }
                if (!outcome || outcome.kind !== 'success') {
                    expect(
                        false,
                        `Registration submitted but never reached the thank-you page (still on ${page.url()}).`
                    );
                }
                return page.url();
            });

            await recorder.step('Verify registration succeeded', async () => {
                const stored = await page.evaluate(() => ({
                    userId: localStorage.getItem('user_id'),
                    status: localStorage.getItem('registerStatus'),
                    instantExam: localStorage.getItem('instant_exam'),
                }));

                expect(
                    stored.userId,
                    'Landed on the thank-you page but no user_id was stored — register2.php did not return a user.'
                );
                expect(
                    stored.status === 'success',
                    `Registration status was "${stored.status}" instead of "success".`
                );

                shared.userId = stored.userId;
                shared.instantExam = stored.instantExam;
                recorder.note('userId', stored.userId);
                log.info(`registered test account ${student.email} (user_id=${stored.userId})`);
                return stored.userId;
            });

            // Best-effort: the flag is for the team's reporting, so a schema
            // without the column must not fail an otherwise healthy check.
            await recorder.softStep('Flag row as a test account', async () => {
                if (!config.db.cleanupEnabled || config.db.dryRun) return 'skipped';
                const marked = await markAsTestAccount(shared.userId);
                return marked ? 'is_test_account = 1' : 'column not present';
            });

            // Confirms the new account has a real, usable session — the thing
            // that actually matters for everything the student does next.
            await recorder.step('Verify authenticated session', async () => {
                const profile = await page.evaluate(async (base) => {
                    const res = await fetch(`${base}/api/get_user_profile.php`, {
                        method: 'GET',
                        credentials: 'include',
                    });
                    return { status: res.status, body: (await res.text()).slice(0, 500) };
                }, config.targets.dashboard);

                expect(
                    profile.status < 400,
                    `Profile fetch after registration returned HTTP ${profile.status}: ${profile.body}`
                );
                return `HTTP ${profile.status}`;
            });

            shared.page = page;
        } catch (error) {
            for (const artifact of await capturePage(page, artifactDir, 'registration', { consoleLines })) {
                recorder.addArtifact(artifact);
            }
            throw error;
        }
    },
};
