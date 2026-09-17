// src/index.js
//
// The long-running process: two cron schedules (cheap availability checks
// every few minutes, the full student journey less often), plus the optional
// status dashboard.
//
// Run it under systemd or pm2 — see deploy/.

import cron from 'node-cron';
import config, { validateConfig } from './config.js';
import logger from './logger.js';
import { runGroup } from './runner.js';
import { startDashboard } from './dashboard.js';

const log = logger;

function banner() {
    log.info('Internship Studio — synthetic monitoring');
    log.info(`  dashboard : ${config.targets.dashboard}`);
    log.info(`  exam      : ${config.targets.exam}  (api ${config.targets.examApi})`);
    log.info(`  payment   : ${config.targets.paymentApi}`);
    log.info(`  light     : ${config.schedule.light}`);
    log.info(`  journey   : ${config.schedule.journey}  (exam_id=${config.exam.examId})`);
    log.info(`  alerts    : ${config.alert.enabled ? config.alert.to.join(', ') : 'DISABLED'}`);
}

async function main() {
    const { fatal, warn } = validateConfig();

    for (const message of warn) log.warn(message);
    if (fatal.length) {
        for (const message of fatal) log.error(message);
        log.error('refusing to start with an invalid configuration — fix .env and try again');
        process.exit(1);
    }

    banner();

    if (!cron.validate(config.schedule.light)) {
        log.error(`CRON_LIGHT is not a valid cron expression: "${config.schedule.light}"`);
        process.exit(1);
    }
    if (!cron.validate(config.schedule.journey)) {
        log.error(`CRON_JOURNEY is not a valid cron expression: "${config.schedule.journey}"`);
        process.exit(1);
    }

    const tasks = [
        cron.schedule(config.schedule.light, () => {
            runGroup('light').catch((error) => log.error(`light run crashed: ${error.message}`, error));
        }),
        cron.schedule(config.schedule.journey, () => {
            runGroup('journey').catch((error) => log.error(`journey run crashed: ${error.message}`, error));
        }),
    ];

    let stopDashboard = null;
    if (config.dashboard.enabled) {
        stopDashboard = await startDashboard();
    }

    if (config.schedule.runOnBoot) {
        log.info('running both groups once on boot');
        // Sequential, not parallel: a 1-2 GB monitoring box should only ever
        // have one Chromium alive at a time.
        runGroup('light')
            .then(() => runGroup('journey'))
            .catch((error) => log.error(`boot run crashed: ${error.message}`, error));
    }

    const shutdown = async (signal) => {
        log.info(`${signal} received — shutting down`);
        for (const task of tasks) task.stop();
        if (stopDashboard) await stopDashboard();
        // Give an in-flight run a moment to finish writing state/artifacts.
        setTimeout(() => process.exit(0), 3000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
        log.error(`unhandled rejection: ${reason?.message || reason}`, reason);
    });
    process.on('uncaughtException', (error) => {
        log.error(`uncaught exception: ${error.message}`, error);
    });
}

main();
