// src/runOnce.js
//
// One-shot CLI, for the first smoke test after deploying and for debugging a
// specific check without waiting for a cron tick.
//
//   node src/runOnce.js                      # everything
//   node src/runOnce.js --group=light        # availability + API health
//   node src/runOnce.js --group=journey      # register -> exam -> payment
//   node src/runOnce.js --check=registration # one check
//   node src/runOnce.js --check=registration --no-alert
//
// Exits non-zero if anything failed, so it also works as a cron-driven runner
// (see deploy/README) and in CI.

import config, { validateConfig } from './config.js';
import logger from './logger.js';
import { runGroup } from './runner.js';
import { checks, checkById } from './checks/index.js';

/**
 * Expand a check id to itself plus everything it depends on, in registry
 * order. Running `--check=payment-checkout` on its own is meaningless — it
 * needs the session registration creates — so pull the chain in rather than
 * failing on a missing precondition.
 */
function withDependencies(id) {
    const needed = new Set();

    const walk = (checkId) => {
        if (needed.has(checkId)) return;
        needed.add(checkId);
        const check = checkById(checkId);
        for (const dep of check?.requires || []) walk(dep);
    };

    walk(id);
    return checks.filter((c) => needed.has(c.id)).map((c) => c.id);
}

const argv = process.argv.slice(2);

const flag = (name, fallback = undefined) => {
    const match = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (!match) return fallback;
    const [, value] = match.split('=');
    return value === undefined ? true : value;
};

async function main() {
    const { fatal, warn } = validateConfig();
    for (const message of warn) logger.warn(message);

    const alert = !argv.includes('--no-alert');
    if (fatal.length && alert) {
        for (const message of fatal) logger.error(message);
        logger.error('fix .env, or re-run with --no-alert to test the checks without alerting');
        process.exit(2);
    }

    const only = flag('check');
    const group = flag('group', 'all');

    if (only === true) {
        logger.info(`available checks: ${checks.map((c) => c.id).join(', ')}`);
        process.exit(0);
    }

    if (typeof only === 'string' && !checks.some((c) => c.id === only)) {
        logger.error(`unknown check "${only}". Available: ${checks.map((c) => c.id).join(', ')}`);
        process.exit(2);
    }

    const selected = only ? withDependencies(only) : undefined;

    if (selected && selected.length > 1) {
        logger.info(`${only} depends on: ${selected.filter((id) => id !== only).join(', ')} — running those too`);
    }

    logger.info(
        `one-shot run — ${only ? `check=${only}` : `group=${group}`}, alerting ${alert ? 'on' : 'off'}, ` +
        `exam_id=${config.exam.examId}`
    );

    const { results } = await runGroup(only ? 'all' : group, {
        only: selected,
        alert,
    });

    logger.info('');
    logger.info('─────────────────────────────────────────────');
    for (const result of results) {
        const status = result.skipped ? 'SKIP' : result.ok ? 'PASS' : 'FAIL';
        logger.info(`  ${status}  ${result.name}  (${result.durationMs}ms)`);
        if (!result.ok) logger.info(`        ↳ ${result.failedStep}: ${result.error}`);
        if (result.skipped) logger.info(`        ↳ ${result.skipReason}`);
    }
    logger.info('─────────────────────────────────────────────');

    const failed = results.filter((r) => !r.ok).length;
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
    logger.error(`run failed: ${error.message}`, error);
    process.exit(3);
});
