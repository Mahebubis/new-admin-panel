// src/alert/index.js
//
// Delivery. Email is the primary channel (it is what the team asked for);
// Slack and a generic webhook are optional extras that never block or fail the
// email.
//
// Nothing here throws: an alert that cannot be delivered is logged loudly, but
// it must not crash the monitor — a dead monitor reports nothing at all.

import os from 'node:os';
import nodemailer from 'nodemailer';
import config from '../config.js';
import { createLogger } from '../logger.js';
import { subjectFor, textBody, htmlBody } from './template.js';
import { sendSlack as sendSlackAlert } from './slack.js';

const log = createLogger('alert');

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;
    if (!config.smtp.host) return null;

    transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
        // A hung SMTP connection must not stall the next scheduled run.
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 30000,
    });

    return transporter;
}

/** Screenshots and page HTML, attached so the alert is self-contained. */
function attachmentsFor(result) {
    return (result.artifacts || [])
        .filter((a) => a && a.path)
        .slice(0, 6)
        .map((a) => ({ filename: a.name, path: a.path }));
}

/**
 * Deliver one notification on the rung of the escalation ladder that
 * `meta.channel` names.
 *
 * The ladder exists because a fourth identical email is easy to ignore.
 * Changing medium — inbox, then Slack, then an @channel push — is what
 * actually gets attention as an outage drags on.
 */
export async function sendAlert(result, meta) {
    if (!config.alert.enabled) {
        log.warn(`alerting disabled — would have sent: ${subjectFor(result, meta)}`);
        return { sent: false, reason: 'disabled' };
    }

    const enriched = { ...meta, host: meta.host || os.hostname() };
    const subject = `${config.alert.subjectPrefix} ${subjectFor(result, enriched)}`.trim();

    // 'all' is used for recovery: tell every channel the outage touched, so
    // nobody is left believing it is still broken.
    const channel = meta.channel || 'email';
    const wants = (name) => channel === 'all' || channel === name;

    const attempts = [];

    if (wants('email')) {
        attempts.push(
            deliverEmail(subject, result, enriched).then((r) => ({ channel: 'email', ...r }))
        );
    }
    if (wants('slack')) {
        attempts.push(sendSlackAlert(result, enriched, 'message').then((r) => ({ channel: 'slack', ...r })));
    }
    if (wants('slack-urgent')) {
        attempts.push(sendSlackAlert(result, enriched, 'urgent').then((r) => ({ channel: 'slack-urgent', ...r })));
    }

    if (attempts.length === 0) {
        log.error(`unknown escalation channel "${channel}" — falling back to email`);
        attempts.push(deliverEmail(subject, result, enriched).then((r) => ({ channel: 'email', ...r })));
    }

    // Extra channels, always, independent of the ladder.
    void sendSlackWebhook(subject, result, enriched);
    void sendWebhook(result, enriched);

    const settled = await Promise.all(attempts);
    const delivered = settled.filter((s) => s.sent);
    const failed = settled.filter((s) => !s.sent);

    for (const f of failed) log.error(`${f.channel} notification failed: ${f.reason}`);

    if (delivered.length === 0) {
        // Everything on this rung failed. Email is the fallback of last
        // resort — silence during an outage is the worst outcome there is.
        if (!wants('email')) {
            log.warn(`falling back to email after ${channel} failed`);
            const fallback = await deliverEmail(subject, result, enriched);
            if (fallback.sent) return { sent: true, channel: 'email (fallback)' };
        }
        return { sent: false, reason: failed.map((f) => f.reason).join('; ') };
    }

    log.info(
        `${meta.action} #${meta.notificationNumber || 1} for ${result.id} sent via ` +
        delivered.map((d) => d.channel).join(' + ')
    );
    return { sent: true, channel: delivered.map((d) => d.channel).join('+') };
}

/** Email, wrapped so a failure is a value rather than a throw. */
async function deliverEmail(subject, result, meta) {
    if (config.alert.to.length === 0) {
        return { sent: false, reason: 'ALERT_TO is empty' };
    }
    try {
        await sendEmail(subject, result, meta);
        return { sent: true };
    } catch (error) {
        return { sent: false, reason: error.message };
    }
}

async function sendEmail(subject, result, meta) {
    const mailer = getTransporter();
    if (!mailer) throw new Error('SMTP_HOST is not configured');

    await mailer.sendMail({
        from: config.alert.from,
        to: config.alert.to.join(', '),
        subject,
        text: textBody(result, meta),
        html: htmlBody(result, meta),
        attachments: meta.action === 'recovered' ? [] : attachmentsFor(result),
    });
}

async function sendSlackWebhook(subject, result, meta) {
    if (!config.alert.slackWebhookUrl) return;

    const emoji = meta.action === 'recovered' ? ':white_check_mark:' : ':rotating_light:';
    const body = {
        text: `${emoji} ${subject}`,
        blocks: [
            { type: 'section', text: { type: 'mrkdwn', text: `${emoji} *${subject}*` } },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text:
                        meta.action === 'recovered'
                            ? '_Check is green again._'
                            : `*Failed step:* ${result.failedStep || 'unknown'}\n*Error:* \`${(result.error || '').slice(0, 400)}\``,
                },
            },
        ],
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        await fetch(config.alert.slackWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
    } catch (error) {
        log.warn(`slack alert failed: ${error.message}`);
    } finally {
        clearTimeout(timer);
    }
}

async function sendWebhook(result, meta) {
    if (!config.alert.genericWebhookUrl) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        await fetch(config.alert.genericWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...meta, result }),
            signal: controller.signal,
        });
    } catch (error) {
        log.warn(`generic webhook failed: ${error.message}`);
    } finally {
        clearTimeout(timer);
    }
}

/** Used by `npm run test:alert` to prove SMTP works before an incident does. */
export async function verifyTransport() {
    const mailer = getTransporter();
    if (!mailer) throw new Error('SMTP_HOST is not configured');
    await mailer.verify();
    return true;
}
