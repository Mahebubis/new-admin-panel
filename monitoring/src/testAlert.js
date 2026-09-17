// src/testAlert.js
//
// Fire a sample alert down any rung of the escalation ladder, so each channel
// is proven to work before an incident depends on it.
//
//   npm run test:alert                        # email
//   node src/testAlert.js --channel=slack         # normal Slack post
//   node src/testAlert.js --channel=slack-urgent  # @channel push
//   node src/testAlert.js --channel=all           # every channel at once
//   node src/testAlert.js --ladder                # walk the whole ladder
//
// The sample carries a real journey funnel, so what arrives looks exactly like
// a genuine alert — including the "nothing is actually broken" note.

import os from 'node:os';
import config, { validateConfig } from './config.js';
import logger from './logger.js';
import { sendAlert, verifyTransport } from './alert/index.js';
import { buildFunnel, funnelHeadline } from './funnel.js';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
    const match = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (!match) return fallback;
    const [, value] = match.split('=');
    return value === undefined ? true : value;
};

const now = new Date().toISOString();
const minsAgo = (n) => new Date(Date.now() - n * 60000).toISOString();

/* A failing website check, with the journey stages passing a few minutes ago —
   the shape a real mid-outage alert takes. */
const sample = {
    id: 'website-availability',
    name: 'Website availability',
    group: 'light',
    ok: false,
    startedAt: now,
    durationMs: 45120,
    attempts: 2,
    failedStep: 'HTTP Student dashboard',
    error: 'Timed out after 20000ms: GET https://dashboard.internshipstudio.com/',
    steps: [
        { name: 'HTTP Student dashboard', ok: false, ms: 20000, error: 'Timed out after 20000ms' },
    ],
    artifacts: [],
    context: { note: 'THIS IS A TEST — nothing is actually broken.' },
};

const storedChecks = {
    registration: {
        lastResult: { id: 'registration', ok: true, at: minsAgo(9), durationMs: 12400, steps: [] },
    },
    'login-exam-start': {
        lastResult: {
            id: 'login-exam-start', ok: true, at: minsAgo(9), durationMs: 8500,
            steps: [{ name: 'Open login page', ok: true, ms: 900 }, { name: 'Sign in', ok: true, ms: 3100 }],
        },
    },
    'exam-submission': {
        lastResult: { id: 'exam-submission', ok: true, at: minsAgo(9), durationMs: 780, steps: [] },
    },
    'payment-checkout': {
        lastResult: {
            id: 'payment-checkout', ok: true, at: minsAgo(9), durationMs: 6300,
            steps: [
                { name: 'Create payment order', ok: true, ms: 1840 },
                { name: 'Load payment gateway checkout', ok: true, ms: 3900 },
            ],
        },
    },
};

const funnel = buildFunnel([sample], storedChecks);

function metaFor(channel, n) {
    return {
        action: 'alert',
        channel,
        notificationNumber: n,
        consecutiveFailures: n,
        downSince: minsAgo(5),
        lastOkAt: minsAgo(10),
        runId: 'TEST-ALERT',
        host: os.hostname(),
        funnel,
        funnelHeadline: funnelHeadline(funnel),
    };
}

const DESCRIBE = {
    email: `email to ${config.alert.to.join(', ') || '(nobody — ALERT_TO is empty)'}`,
    slack: `Slack message to ${config.slack.channel || '(no SLACK_CHANNEL set)'}`,
    'slack-urgent': `Slack @channel push to ${config.slack.channel || '(no SLACK_CHANNEL set)'}`,
    all: 'every channel at once',
};

async function fire(channel, n) {
    logger.info(`sending ${DESCRIBE[channel] || channel}`);
    const result = await sendAlert(sample, metaFor(channel, n));
    if (result.sent) {
        logger.info(`  delivered via ${result.channel}`);
        return true;
    }
    logger.error(`  NOT delivered: ${result.reason}`);
    return false;
}

async function main() {
    const { fatal, warn } = validateConfig();
    for (const message of warn) logger.warn(message);

    const channel = String(flag('channel', 'email'));
    const ladder = Boolean(flag('ladder', false));

    // Only email needs SMTP; a Slack-only test should not be blocked by it.
    const needsEmail = ladder || channel === 'email' || channel === 'all';
    if (needsEmail && fatal.length) {
        for (const message of fatal) logger.error(message);
        process.exit(2);
    }

    if (needsEmail) {
        logger.info(`verifying SMTP ${config.smtp.host}:${config.smtp.port} as ${config.smtp.user || '(no auth)'}`);
        await verifyTransport();
        logger.info('SMTP connection OK');
    }

    if ((channel === 'slack' || channel === 'slack-urgent' || channel === 'all' || ladder)) {
        const hasToken = config.slack.botToken || config.slack.token || config.slack.refreshToken;
        if (!hasToken) {
            logger.error('No Slack token configured — set SLACK_BOT_TOKEN (starts xoxb-) in .env');
            if (channel !== 'all' && !ladder) process.exit(2);
        }
        if (!config.slack.channel) {
            logger.error('SLACK_CHANNEL is not set — e.g. SLACK_CHANNEL=#alerts');
            if (channel !== 'all' && !ladder) process.exit(2);
        }
    }

    let ok = true;

    if (ladder) {
        logger.info(`walking the escalation ladder: ${config.alert.escalation.join(' -> ')}`);
        logger.info('this sends one notification per rung — expect several');
        let n = 1;
        for (const rung of config.alert.escalation) {
            ok = (await fire(rung, n)) && ok;
            n += 1;
            // A brief gap so they arrive in order and read as a sequence.
            await new Promise((r) => setTimeout(r, 1500));
        }
    } else {
        ok = await fire(channel, 1);
    }

    logger.info('');
    logger.info(ok ? 'Done — check the inbox / channel.' : 'Some channels failed; see the errors above.');
    process.exit(ok ? 0 : 1);
}

main().catch((error) => {
    logger.error(`test alert failed: ${error.message}`, error);
    process.exit(1);
});
