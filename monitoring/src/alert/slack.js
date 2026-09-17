// src/alert/slack.js
//
// Slack delivery for the escalation ladder.
//
// Two levels:
//   • message  — a normal post to the channel
//   • urgent   — the same post with an @channel mention, which pushes a
//                notification to every member's phone
//
// On "calling": Slack has no public API that rings a person. `calls.add` only
// registers an *external* call (Zoom, Meet) as a Slack object; it does not dial
// anyone, and Huddles cannot be started programmatically at all. So the loudest
// Slack itself can be is an @channel mention, which is what `urgent` does.
//
// For an actual phone call, the channel to add is Twilio Voice — see
// PAGE_PROVIDER in .env.example. That is a genuine ring, not a notification.

import config from '../config.js';
import { createLogger } from '../logger.js';

const log = createLogger('slack');

const API = 'https://slack.com/api';
const TIMEOUT_MS = 10000;

// A rotating user token (xoxe.xoxp-…) expires roughly every 12 hours and must
// be exchanged using the refresh token. Cached in memory only — a restart
// simply refreshes again.
let liveToken = null;
let liveTokenExpiresAt = 0;

async function slackFetch(method, body, token) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${API}/${method}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Exchange the refresh token for a fresh access token.
 * Requires the app's client id and secret — Slack will not rotate without them.
 */
async function refreshToken() {
    const { clientId, clientSecret, refreshToken: rt } = config.slack;
    if (!rt) return null;

    if (!clientId || !clientSecret) {
        // Only reached once the current token has actually expired, so this is
        // a real dead end rather than a warning at startup.
        log.error(
            'The Slack token has expired and cannot be renewed: SLACK_REFRESH_TOKEN is set but ' +
            'SLACK_CLIENT_ID / SLACK_CLIENT_SECRET are missing. Add both (api.slack.com/apps > ' +
            'Basic Information > App Credentials), or switch to a bot token (xoxb-…) which never expires.'
        );
        return null;
    }

    const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: rt,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${API}/oauth.v2.exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params,
            signal: controller.signal,
        });
        const json = await res.json();

        if (!json.ok) {
            log.error(`Slack token refresh failed: ${json.error}`);
            return null;
        }

        liveToken = json.access_token || json.authed_user?.access_token || null;
        // Refresh a minute early so a request never races the expiry.
        liveTokenExpiresAt = Date.now() + Math.max(0, (json.expires_in || 43200) - 60) * 1000;
        log.info('Slack access token refreshed');
        return liveToken;
    } catch (error) {
        log.error(`Slack token refresh error: ${error.message}`);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

async function getToken() {
    // A bot token is static and always preferred.
    if (config.slack.botToken) return config.slack.botToken;

    // A token obtained by an earlier refresh, still inside its lifetime.
    if (liveToken && Date.now() < liveTokenExpiresAt) return liveToken;

    // The configured access token. Try it before attempting any refresh — it
    // is usually still valid, and refreshing needs client credentials that may
    // not be configured. If it has actually expired, chat.postMessage returns
    // token_expired and the retry path below refreshes then.
    if (config.slack.token) return config.slack.token;

    // No usable token: refresh is the only remaining option.
    if (config.slack.refreshToken) return refreshToken();

    return null;
}

const SEV = {
    alert:     { emoji: ':rotating_light:', color: '#dc2626' },
    remind:    { emoji: ':warning:',        color: '#d97706' },
    recovered: { emoji: ':white_check_mark:', color: '#16a34a' },
};

/** The funnel as Slack mrkdwn — the same story the email tells. */
function funnelBlock(funnel) {
    if (!funnel?.stages?.length) return null;

    const marks = {
        pass: ':white_check_mark:',
        fail: ':x:',
        blocked: ':heavy_minus_sign:',
        untested: ':heavy_minus_sign:',
        unknown: ':grey_question:',
    };

    const lines = funnel.stages.map((s) => {
        const detail =
            s.status === 'fail' && s.error ? `  _${String(s.error).slice(0, 120)}_`
                : s.status === 'untested' ? '  _not tested_'
                    : s.stale ? '  _(last checked earlier)_'
                        : '';
        return `${marks[s.status] || ':grey_question:'}  *${s.label}*${detail}`;
    });

    return { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } };
}

/**
 * Post a monitoring alert to Slack.
 *
 * @param {object} result the check result
 * @param {object} meta   action, funnel, runId, host, consecutiveFailures
 * @param {'message'|'urgent'} level
 * @returns {Promise<{sent: boolean, reason?: string}>}
 */
export async function sendSlack(result, meta, level = 'message') {
    const token = await getToken();
    if (!token) {
        return {
            sent: false,
            reason: config.slack.refreshToken
                ? 'the Slack token expired and could not be renewed (see the error above)'
                : 'no Slack token configured — set SLACK_BOT_TOKEN',
        };
    }
    if (!config.slack.channel) return { sent: false, reason: 'SLACK_CHANNEL is not set' };

    const sev = SEV[meta.action] || SEV.alert;
    const recovered = meta.action === 'recovered';
    const urgent = level === 'urgent' && !recovered;

    const title = recovered
        ? `${sev.emoji} RECOVERED: ${result.name} is working again`
        : `${sev.emoji} ${urgent ? 'ESCALATED — ' : ''}${result.name} is FAILING`;

    const blocks = [
        { type: 'header', text: { type: 'plain_text', text: title.slice(0, 150), emoji: true } },
    ];

    if (urgent) {
        // The mention is what turns this into a phone notification for
        // everyone in the channel — the loudest thing Slack can actually do.
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `<!channel> This has now failed *${meta.consecutiveFailures} runs in a row* and needs someone to look at it.`,
            },
        });
    }

    if (!recovered) {
        blocks.push({
            type: 'section',
            fields: [
                { type: 'mrkdwn', text: `*Failed step*\n${result.failedStep || 'unknown'}` },
                { type: 'mrkdwn', text: `*Failing runs*\n${meta.consecutiveFailures}` },
            ],
        });
        if (result.error) {
            blocks.push({
                type: 'section',
                text: { type: 'mrkdwn', text: `*Error*\n\`\`\`${String(result.error).slice(0, 800)}\`\`\`` },
            });
        }
    }

    if (meta.funnelHeadline) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*${meta.funnelHeadline}*` } });
    }

    const fb = funnelBlock(meta.funnel);
    if (fb) blocks.push(fb);

    blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `Run \`${meta.runId}\` · monitor \`${meta.host}\`` }],
    });

    try {
        const json = await slackFetch(
            'chat.postMessage',
            {
                channel: config.slack.channel,
                text: title,                       // fallback for notifications
                blocks,
                link_names: true,                  // makes <!channel> actually notify
                unfurl_links: false,
            },
            token
        );

        if (!json.ok) {
            // An expired rotating token is worth one automatic retry.
            if (json.error === 'token_expired' && config.slack.refreshToken) {
                const fresh = await refreshToken();
                if (fresh) {
                    const retry = await slackFetch(
                        'chat.postMessage',
                        { channel: config.slack.channel, text: title, blocks, link_names: true },
                        fresh
                    );
                    if (retry.ok) return { sent: true };
                    return { sent: false, reason: retry.error };
                }
            }
            log.error(`Slack rejected the message: ${json.error}`);
            return { sent: false, reason: json.error };
        }

        log.info(`Slack ${level} sent to ${config.slack.channel}`);
        return { sent: true };
    } catch (error) {
        log.error(`Slack request failed: ${error.message}`);
        return { sent: false, reason: error.message };
    }
}

export default sendSlack;
