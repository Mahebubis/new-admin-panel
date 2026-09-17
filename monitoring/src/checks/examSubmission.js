// src/checks/examSubmission.js
//
// MVP test #4 — "answer -> submit -> verify submission".
//
// The answering half runs in the browser, clicking radio buttons and
// "Save & Next" exactly as a student does; each click fires
// /api/update_exam_data, so this genuinely exercises answer persistence.
//
// The submit itself is issued as the same /api/end_exam call the SPA makes,
// rather than by clicking Submit. The Submit button in QuizPanel only appears
// once the student reaches the *last* question of the paper, and paging
// through an entire question set every 15 minutes would make the check slow
// and flaky without testing anything new. Submission is then verified the way
// the result page does it — by reading the stored result back.

import { capturePage } from '../utils/artifacts.js';
import { expect } from '../utils/result.js';
import { post, snippet } from '../utils/http.js';
import { closeQuietly } from '../browser.js';

export default {
    id: 'exam-submission',
    name: 'Exam answering and submission',
    group: 'journey',
    severity: 'critical',
    needsBrowser: true,
    requires: ['login-exam-start'],

    async run({ config, recorder, artifactDir, shared, log }) {
        const page = shared.examPage;
        const consoleLines = shared.examConsoleLines || [];

        await recorder.step('Precondition: exam in progress', async () => {
            expect(
                page && !page.isClosed(),
                'No open exam page — the exam start check must run first.'
            );
            expect(shared.examHash, 'No exam hash available from the exam start check.');
            return `exam ${config.exam.examId}, user ${shared.userId}`;
        });

        const answered = {};

        try {
            const target = Math.max(1, config.exam.answersToGive);

            for (let i = 0; i < target; i += 1) {
                await recorder.step(`Answer question ${i + 1}`, async () => {
                    await page.waitForSelector('input[type="radio"]', {
                        state: 'visible',
                        timeout: config.runtime.stepTimeoutMs,
                    });

                    // Read the question/option ids straight off the DOM so the
                    // answers sent to end_exam are the ones the student
                    // actually picked.
                    const options = await page
                        .locator('input[type="radio"]')
                        .evaluateAll((nodes) => nodes.map((n) => n.value));

                    expect(options.length >= 1, `Question ${i + 1} rendered with no options.`);

                    const radio = page.locator('input[type="radio"]').first();
                    await radio.click();

                    // "Save & Next" is what POSTs the answer. On the last
                    // question the button becomes "Submit" instead — stop
                    // there rather than opening the summary modal.
                    const saveNext = page.getByRole('button', { name: /^(save & next|next)$/i }).first();
                    const isLast = (await saveNext.count()) === 0;

                    if (isLast) {
                        recorder.note('reachedLastQuestion', true);
                        return 'last question reached';
                    }

                    // Capture the update_exam_data response so a silently
                    // failing save is caught here rather than at submission.
                    const savePromise = page
                        .waitForResponse(
                            (res) => res.url().includes('/api/update_exam_data'),
                            { timeout: config.runtime.stepTimeoutMs }
                        )
                        .catch(() => null);

                    await saveNext.click();
                    const saveResponse = await savePromise;

                    expect(
                        saveResponse,
                        `Answering question ${i + 1} never called /api/update_exam_data — the answer was not saved.`
                    );
                    expect(
                        saveResponse.status() < 400,
                        `update_exam_data returned HTTP ${saveResponse.status()} while saving question ${i + 1}.`
                    );

                    answered[`q${i + 1}`] = options[0];
                    return `saved (HTTP ${saveResponse.status()})`;
                });
            }

            recorder.note('answersGiven', Object.keys(answered).length);

            // ── Submit ──────────────────────────────────────────────────────
            await recorder.step('Submit exam', async () => {
                const res = await post(
                    `${config.targets.examApi}/api/end_exam`,
                    {
                        exam_id: config.exam.examId,
                        user_answers: {},
                        is_web_view: false,
                        instant_result: 'off',
                    },
                    {
                        headers: {
                            userid: String(shared.userId),
                            hash: String(shared.examHash),
                        },
                        expectJson: true,
                        timeoutMs: 45000,
                    }
                );

                expect(
                    res.status < 500,
                    `end_exam returned HTTP ${res.status} — ${snippet(res.text)}`
                );
                expect(
                    res.json && res.json.status === 200,
                    `end_exam did not accept the submission: ${snippet(res.text)}`
                );
                return 'accepted';
            });

            await recorder.step('Verify submission was recorded', async () => {
                // The result row is what the student's result page reads. If
                // end_exam answered 200 but nothing landed here, submissions
                // are being silently lost — the worst possible failure mode.
                let stored = null;

                for (let attempt = 0; attempt < 3 && !stored; attempt += 1) {
                    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));

                    const res = await post(
                        `${config.targets.examApi}/api/fetch_result`,
                        { user_id: shared.userId, exam_id: config.exam.examId },
                        { expectJson: true }
                    );

                    if (res.json && res.json.status === 200 && res.json.data) {
                        stored = res.json.data;
                    } else if (res.status >= 500) {
                        expect(false, `fetch_result returned HTTP ${res.status} — ${snippet(res.text)}`);
                    }
                }

                expect(
                    stored,
                    `No result stored for user ${shared.userId} on exam ${config.exam.examId} after submission — ` +
                    'end_exam reported success but the result was never written.'
                );

                recorder.note('resultStatus', stored.status ?? 'unknown');
                recorder.note('resultScore', stored.score ?? stored.total_score ?? 'n/a');
                log.info(`exam submission verified for user ${shared.userId}`);
                return `result recorded (status=${stored.status ?? 'unknown'})`;
            });
        } catch (error) {
            for (const artifact of await capturePage(page, artifactDir, 'exam-submission', { consoleLines })) {
                recorder.addArtifact(artifact);
            }
            throw error;
        } finally {
            await closeQuietly(shared.examPage);
            await closeQuietly(shared.examContext);
            shared.examPage = null;
            shared.examContext = null;
        }
    },
};
