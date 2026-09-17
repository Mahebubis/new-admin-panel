// src/config.js
//
// Single place where every knob is read. Everything downstream takes config as
// data, so a check never reaches for process.env itself.

import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const str = (key, fallback = '') => {
    const v = process.env[key];
    return v === undefined || v === '' ? fallback : v;
};

const num = (key, fallback) => {
    const v = Number(process.env[key]);
    return Number.isFinite(v) ? v : fallback;
};

const bool = (key, fallback) => {
    const v = process.env[key];
    if (v === undefined || v === '') return fallback;
    return /^(1|true|yes|on)$/i.test(v.trim());
};

const list = (key) =>
    str(key)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

const trimSlash = (u) => u.replace(/\/+$/, '');

export const config = {
    root: ROOT,

    targets: {
        dashboard: trimSlash(str('DASHBOARD_URL', 'https://dashboard.internshipstudio.com')),
        exam: trimSlash(str('EXAM_URL', 'https://exam.internshipstudio.com')),
        examApi: trimSlash(str('EXAM_API_URL', 'https://examapi.internshipstudio.com')),
        paymentApi: trimSlash(str('PAYMENT_API_URL', 'https://paymentapi.internshipstudio.com')),
        website: trimSlash(str('WEBSITE_URL', '')),
    },

    schedule: {
        light: str('CRON_LIGHT', '*/5 * * * *'),
        journey: str('CRON_JOURNEY', '*/15 * * * *'),
        runOnBoot: bool('RUN_ON_BOOT', true),
    },

    // One fixed account, deleted and re-registered on every journey run.
    student: {
        email: str('MONITOR_EMAIL', 'monitor.test@internshipstudio.com'),
        password: str('MONITOR_PASSWORD', 'M0nitorTest2026'),
        firstName: str('MONITOR_FIRST_NAME', 'Monitor'),
        lastName: str('MONITOR_LAST_NAME', 'Testaccount'),
        phone: str('MONITOR_PHONE', '9000000001'),
        countryCode: str('MONITOR_COUNTRY_CODE', '91'),
    },

    db: {
        cleanupEnabled: bool('DB_CLEANUP_ENABLED', true),
        host: str('DB_HOST'),
        port: num('DB_PORT', 3306),
        user: str('DB_USER'),
        password: str('DB_PASSWORD'),
        database: str('DB_NAME', 'istudio_cit'),
        dryRun: bool('DB_CLEANUP_DRY_RUN', true),
        markTestAccount: bool('DB_MARK_TEST_ACCOUNT', true),
        // Blank = detect it (user_id, then id). Set only to override.
        usersIdColumn: str('DB_USERS_ID_COLUMN'),
        // "table:column" pairs, child rows first. Parsed here so a malformed
        // entry surfaces at start-up rather than halfway through a delete.
        cleanupTables: list('DB_CLEANUP_TABLES')
            .map((entry) => {
                const [table, column = 'user_id'] = entry.split(':').map((s) => s.trim());
                return table ? { table, column } : null;
            })
            .filter(Boolean),
    },

    // History written to a database so the admin panel can read it. A separate
    // database from the application's, so the monitoring user never needs
    // INSERT rights anywhere near real student data.
    report: {
        enabled: bool('DB_REPORT_ENABLED', false),
        host: str('DB_REPORT_HOST') || str('DB_HOST'),
        port: num('DB_REPORT_PORT', num('DB_PORT', 3306)),
        user: str('DB_REPORT_USER') || str('DB_USER'),
        password: str('DB_REPORT_PASSWORD') || str('DB_PASSWORD'),
        database: str('DB_REPORT_NAME', 'monitor'),
        table: str('DB_REPORT_TABLE', 'monitoring_runs'),
        retentionDays: num('DB_REPORT_RETENTION_DAYS', 90),
    },

    exam: {
        // 15 is the mock exam the dashboard uses for practice runs; 1 is the
        // live iCAT. Monitoring must not consume a real attempt.
        examId: str('MONITOR_EXAM_ID', '15'),
        answersToGive: num('MONITOR_EXAM_ANSWERS', 3),
    },

    payment: {
        // Hard gate: completing a payment is never the default, and the runner
        // refuses to act on it unless someone opts in explicitly.
        complete: bool('PAYMENT_COMPLETE', false),
        amount: str('PAYMENT_TEST_AMOUNT', '1.00'),
        internshipName: str('PAYMENT_INTERNSHIP_NAME', 'Monitoring Synthetic Check'),
        returnUrl: str(
            'PAYMENT_RETURN_URL',
            'https://dashboard.internshipstudio.com/payment-status?source=monitoring'
        ),
        useTestingEndpoint: bool('PAYMENT_USE_TESTING_ENDPOINT', true),
        confirmTimeoutMs: num('PAYMENT_CONFIRM_TIMEOUT_MS', 120000),
        card: {
            number: str('PAYMENT_CARD_NUMBER', '4111111111111111'),
            expiryMonth: str('PAYMENT_CARD_EXPIRY_MONTH', '12'),
            expiryYear: str('PAYMENT_CARD_EXPIRY_YEAR', '30'),
            cvv: str('PAYMENT_CARD_CVV', '123'),
            holder: str('PAYMENT_CARD_HOLDER', 'Monitor Testaccount'),
            otp: str('PAYMENT_CARD_OTP', ''),
        },
    },

    alert: {
        enabled: bool('ALERT_ENABLED', true),
        to: list('ALERT_TO'),
        from: str('ALERT_FROM', 'monitoring@internshipstudio.com'),
        subjectPrefix: str('ALERT_SUBJECT_PREFIX', '[iStudio Monitor]'),
        afterConsecutiveFailures: Math.max(1, num('ALERT_AFTER_CONSECUTIVE_FAILURES', 2)),
        // Send on EVERY failing run rather than once plus an hourly reminder.
        everyFailure: bool('ALERT_ON_EVERY_FAILURE', false),
        repeatMinutes: num('ALERT_REPEAT_MINUTES', 60),
        onRecovery: bool('ALERT_ON_RECOVERY', true),
        slackWebhookUrl: str('SLACK_WEBHOOK_URL'),
        genericWebhookUrl: str('GENERIC_WEBHOOK_URL'),
        // Which channel each successive failure uses. The list cycles: the
        // 5th failure goes back to the 1st entry. Escalating gets attention
        // that a 4th identical email would not.
        escalation: list('ALERT_ESCALATION').length
            ? list('ALERT_ESCALATION')
            : ['email'],
    },

    slack: {
        // A bot token (xoxb-…) never expires and is what a monitor should use.
        botToken: str('SLACK_BOT_TOKEN'),
        // A rotating user token (xoxe.xoxp-…) needs the three fields below.
        token: str('SLACK_TOKEN'),
        refreshToken: str('SLACK_REFRESH_TOKEN'),
        clientId: str('SLACK_CLIENT_ID'),
        clientSecret: str('SLACK_CLIENT_SECRET'),
        channel: str('SLACK_CHANNEL'),
    },

    smtp: {
        host: str('SMTP_HOST'),
        port: num('SMTP_PORT', 587),
        secure: bool('SMTP_SECURE', false),
        user: str('SMTP_USER'),
        password: str('SMTP_PASSWORD'),
    },

    runtime: {
        headless: bool('HEADLESS', true),
        stepTimeoutMs: num('STEP_TIMEOUT_MS', 30000),
        checkTimeoutMs: num('CHECK_TIMEOUT_MS', 180000),
        retries: num('CHECK_RETRIES', 1),
        artifactDir: path.resolve(ROOT, str('ARTIFACT_DIR', './artifacts')),
        stateDir: path.resolve(ROOT, 'state'),
        artifactRetentionDays: num('ARTIFACT_RETENTION_DAYS', 7),
        logLevel: str('LOG_LEVEL', 'info'),
    },

    dashboard: {
        enabled: bool('DASHBOARD_ENABLED', true),
        port: num('DASHBOARD_PORT', 8080),
        token: str('DASHBOARD_TOKEN'),
    },
};

/**
 * Problems that would make a run silently useless (alerts that go nowhere,
 * a payment check pointed at a live gateway). Returned rather than thrown so
 * the caller decides between "warn" and "refuse to start".
 */
export function validateConfig(cfg = config) {
    const fatal = [];
    const warn = [];

    if (!cfg.targets.dashboard) fatal.push('DASHBOARD_URL is required.');
    if (!cfg.targets.examApi) fatal.push('EXAM_API_URL is required.');
    if (!cfg.targets.paymentApi) fatal.push('PAYMENT_API_URL is required.');

    if (cfg.alert.enabled) {
        if (cfg.alert.to.length === 0) fatal.push('ALERT_ENABLED=true but ALERT_TO is empty — nobody would be told.');
        if (!cfg.smtp.host) fatal.push('ALERT_ENABLED=true but SMTP_HOST is empty.');
        if (!cfg.smtp.password && cfg.smtp.user) {
            warn.push('SMTP_USER is set but SMTP_PASSWORD is empty — auth will likely fail.');
        }
    } else {
        warn.push('ALERT_ENABLED=false — failures will only be logged.');
    }

    // ── The fixed test account ──────────────────────────────────────────────
    // These rules come from the app itself: the register form's email regex and
    // register2.php's name/phone validation. Catching a bad value here turns a
    // permanent, confusing "registration failed" alert into a start-up error.
    if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(cfg.student.email)) {
        fatal.push(
            `MONITOR_EMAIL="${cfg.student.email}" is rejected by the registration form's own ` +
            'email validation. Use letters, digits, underscore, dot or hyphen only (no "+").'
        );
    }
    if (!/^[6-9]\d{9}$/.test(cfg.student.phone)) {
        fatal.push(
            `MONITOR_PHONE="${cfg.student.phone}" must be exactly 10 digits starting with 6-9.`
        );
    }
    for (const [key, value] of [['MONITOR_FIRST_NAME', cfg.student.firstName], ['MONITOR_LAST_NAME', cfg.student.lastName]]) {
        if (!/^[A-Za-z]+$/.test(value)) {
            fatal.push(`${key}="${value}" must be letters only — register2.php rejects digits and symbols in names.`);
        }
    }

    // ── Delete-and-recreate ─────────────────────────────────────────────────
    if (cfg.db.cleanupEnabled) {
        if (!cfg.db.host) fatal.push('DB_CLEANUP_ENABLED=true but DB_HOST is empty.');
        if (!cfg.db.user) fatal.push('DB_CLEANUP_ENABLED=true but DB_USER is empty.');
        if (!cfg.db.database) fatal.push('DB_CLEANUP_ENABLED=true but DB_NAME is empty.');
        if (cfg.db.dryRun) {
            warn.push(
                'DB_CLEANUP_DRY_RUN=true — the previous test account will NOT be deleted, only logged. ' +
                'Registration will fail on the second run because the email is already taken. ' +
                'Switch this off once the logged tables and row counts look right.'
            );
        }
    } else {
        warn.push(
            'DB_CLEANUP_ENABLED=false — the test account is never removed, so registration will ' +
            'fail with "email already registered" after the first run.'
        );
    }

    if (cfg.payment.complete) {
        warn.push(
            'PAYMENT_COMPLETE=true — the journey will attempt to finish a real payment. ' +
            'Indian cards require an OTP that automation cannot read, so this only completes ' +
            'against a sandbox gateway (Cashfree TEST / Razorpay test keys).'
        );
        if (!cfg.payment.card.number) fatal.push('PAYMENT_COMPLETE=true but PAYMENT_CARD_NUMBER is empty.');
    }

    if (cfg.exam.examId === '1') {
        warn.push(
            'MONITOR_EXAM_ID=1 is the live iCAT exam. Each run consumes a real attempt for ' +
            'the synthetic student; prefer the mock exam (15).'
        );
    }

    return { fatal, warn };
}

export default config;
