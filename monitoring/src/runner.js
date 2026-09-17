// src/runner.js
//
// Runs a group of checks end to end: one Chromium per run, one shared context
// object threaded through the journey so registration can hand its session to
// the exam and payment checks, retries on failure, then state + alerting.
//
// Two invariants worth stating outright:
//
//   1. Runs of the same group never overlap. If a journey run is still going
//      when the next cron tick fires, the tick is skipped and logged. Two
//      concurrent journeys would register two students and race each other.
//
//   2. A check whose dependency failed is *skipped*, not failed. When
//      registration is down, exam and payment cannot possibly be evaluated —
//      reporting them as broken would send four emails for one outage and hide
//      which one is the actual cause.

import os from 'node:os';
import crypto from 'node:crypto';
import config from './config.js';
import { createLogger } from './logger.js';
import { Recorder } from './utils/result.js';
import { launchBrowser, closeQuietly } from './browser.js';
import { ensureArtifactDir, pruneArtifacts } from './utils/artifacts.js';
import { recordResult, readState } from './state.js';
import { buildFunnel, funnelHeadline } from './funnel.js';
import { closePool } from './db.js';
import { reportResult, pruneReports, closeReportPool } from './reporter.js';
import { sendAlert } from './alert/index.js';
import { checksInGroup, checks as allChecks } from './checks/index.js';

const log = createLogger('runner');
const HOST = os.hostname();

// One lock per group, so light checks keep running even while a slow journey
// is in flight.
const running = new Set();

const makeRunId = () => {
    const now = new Date();
    const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
    return `${stamp}-${crypto.randomBytes(3).toString('hex')}`;
};

/**
 * Race a promise against the per-check ceiling. Playwright's own timeouts are
 * per-action; this bounds the check as a whole so one wedged step cannot hold
 * the scheduler forever.
 */
function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(
            () => reject(new Error(`${label} exceeded the ${ms}ms check timeout`)),
            ms
        );
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function runSingleCheck(check, ctx) {
    const attempts = config.runtime.retries + 1;
    let lastResult = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const recorder = new Recorder({
            id: check.id,
            name: check.name,
            severity: check.severity,
            group: check.group,
        });

        // Each attempt starts from a clean shared slice: a half-registered
        // student from a failed attempt must not leak into the retry.
        const shared = { ...ctx.sharedSeed };

        try {
            await withTimeout(
                check.run({ ...ctx, recorder, shared, log: ctx.log.child(check.id) }),
                config.runtime.checkTimeoutMs,
                check.name
            );
            lastResult = { ...recorder.finish(), attempts: attempt };
            ctx.shared = shared;
            return lastResult;
        } catch (error) {
            lastResult = { ...recorder.finish(error), attempts: attempt };
            ctx.shared = shared;

            if (attempt < attempts) {
                ctx.log.warn(
                    `${check.id} failed on attempt ${attempt}/${attempts} at "${lastResult.failedStep}" — retrying: ${lastResult.error}`
                );
                // Short backoff: most transient failures are a deploy or a
                // restarting process, and a few seconds is enough to tell that
                // apart from a real outage.
                await new Promise((r) => setTimeout(r, 5000));
            }
        }
    }

    return lastResult;
}

function skippedResult(check, reason) {
    return {
        id: check.id,
        name: check.name,
        severity: check.severity,
        group: check.group,
        ok: true,
        skipped: true,
        skipReason: reason,
        startedAt: new Date().toISOString(),
        durationMs: 0,
        failedStep: null,
        error: null,
        steps: [],
        artifacts: [],
        context: { skipped: reason },
        attempts: 0,
    };
}

/**
 * @param {'light'|'journey'|'all'} group
 * @param {{ only?: string[], alert?: boolean }} options
 */
export async function runGroup(group, options = {}) {
    if (running.has(group)) {
        log.warn(`previous "${group}" run is still in progress — skipping this tick`);
        return { runId: null, skipped: true, results: [] };
    }
    running.add(group);

    const runId = makeRunId();
    const runLog = log.child(runId);
    const startedAt = Date.now();

    let selected =
        group === 'all' ? allChecks : checksInGroup(group);

    if (options.only && options.only.length) {
        selected = allChecks.filter((c) => options.only.includes(c.id));
    }

    if (selected.length === 0) {
        running.delete(group);
        log.warn(`no checks matched group="${group}" only=${JSON.stringify(options.only || [])}`);
        return { runId, skipped: false, results: [] };
    }

    runLog.info(`starting run: ${selected.map((c) => c.id).join(', ')}`);

    const artifactDir = await ensureArtifactDir(runId);
    const needsBrowser = selected.some((c) => c.needsBrowser);
    let browser = null;
    const results = [];
    // Both failures and skips make downstream checks unevaluable: if the exam
    // start was skipped because registration broke, the submission check has
    // no session to work with either. Tracking only failures here would let
    // that second-order dependency run and report a misleading failure.
    const unavailableIds = new Set();

    try {
        if (needsBrowser) {
            browser = await launchBrowser();
        }

        const ctx = {
            config,
            browser,
            artifactDir,
            runId,
            log: runLog,
            shared: {},
            sharedSeed: {},
        };

        for (const check of selected) {
            const unmet = (check.requires || []).filter((id) => unavailableIds.has(id));

            let result;
            if (unmet.length) {
                const reason = `dependency unavailable: ${unmet.join(', ')}`;
                result = skippedResult(check, reason);
                unavailableIds.add(check.id);
                runLog.warn(`${check.id} skipped — ${reason}`);
            } else {
                // Carry forward what previous checks in this run produced.
                ctx.sharedSeed = ctx.shared;
                result = await runSingleCheck(check, ctx);

                if (result.ok) {
                    runLog.info(`${check.id} OK (${result.durationMs}ms)`);
                } else {
                    unavailableIds.add(check.id);
                    runLog.error(
                        `${check.id} FAILED at "${result.failedStep}" after ${result.attempts} attempt(s): ${result.error}`
                    );
                }
            }

            results.push(result);

            // Skipped checks carry no signal for the failure counters — folding
            // them in would silently "heal" a check that never ran. They are
            // still worth recording in the history, so that happens first.
            if (result.skipped) {
                await reportResult(result, { runId, host: HOST, alerted: false });
                continue;
            }

            const decision = await recordResult(result);
            const willAlert = decision.action !== 'none' && options.alert !== false;

            await reportResult(result, { runId, host: HOST, alerted: willAlert });

            if (willAlert) {
                // The funnel spans every check, but an alert fires for one.
                // Combine what this run measured with the last known state of
                // everything else, so the email can answer "how far does a
                // student actually get right now?" rather than only naming the
                // one check that happened to trip.
                const state = await readState();
                const funnel = buildFunnel(results, state.checks);

                await sendAlert(result, {
                    ...decision,
                    runId,
                    host: HOST,
                    funnel,
                    funnelHeadline: funnelHeadline(funnel),
                });
            }
        }
    } catch (error) {
        runLog.error(`run aborted: ${error.message}`, error);
    } finally {
        // The journey checks hand contexts along; close whatever is still open.
        await closeQuietly(browser);
        // Held-open MySQL connections between runs would sit idle for minutes
        // and eventually be reaped by the server, producing spurious errors on
        // the next run.
        await closePool();
        running.delete(group);
    }

    await pruneArtifacts().catch(() => { });
    // Prune before closing, so this does not open a connection just to shut it.
    await pruneReports().catch(() => { });
    await closeReportPool();

    const failed = results.filter((r) => !r.ok);
    const skipped = results.filter((r) => r.skipped);
    runLog.info(
        `run finished in ${Date.now() - startedAt}ms — ` +
        `${results.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped`
    );

    return { runId, skipped: false, results, durationMs: Date.now() - startedAt };
}

export default runGroup;
