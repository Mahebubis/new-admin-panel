// src/state.js
//
// Failure bookkeeping, persisted to disk so a restart does not re-alert on
// something the team already knows about.
//
// The rules this implements:
//   • a check must fail N consecutive runs before the first alert (a single
//     blip during a deploy is not worth waking anyone for);
//   • while it stays broken, remind at most every ALERT_REPEAT_MINUTES;
//   • when it goes green again, send one RECOVERED note and reset.

import fs from 'node:fs/promises';
import path from 'node:path';
import config from './config.js';
import { createLogger } from './logger.js';

const log = createLogger('state');
const STATE_FILE = path.join(config.runtime.stateDir, 'state.json');
const HISTORY_LIMIT = 200;

const emptyState = () => ({ checks: {}, history: [], updatedAt: null });

let cache = null;

async function load() {
    if (cache) return cache;
    try {
        const raw = await fs.readFile(STATE_FILE, 'utf8');
        cache = { ...emptyState(), ...JSON.parse(raw) };
    } catch {
        cache = emptyState();
    }
    return cache;
}

async function persist() {
    if (!cache) return;
    cache.updatedAt = new Date().toISOString();
    await fs.mkdir(config.runtime.stateDir, { recursive: true });
    await fs.writeFile(STATE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

export async function readState() {
    return load();
}

/**
 * Fold one check result into the stored state.
 *
 * Returns what the caller should do about it:
 *   { action: 'none' | 'alert' | 'remind' | 'recovered', consecutiveFailures, ... }
 */
export async function recordResult(result) {
    const state = await load();
    const now = Date.now();
    const prev = state.checks[result.id] || {
        consecutiveFailures: 0,
        alerted: false,
        lastAlertAt: null,
        lastOkAt: null,
        lastFailureAt: null,
    };

    let action = 'none';

    if (result.ok) {
        if (prev.alerted && config.alert.onRecovery) action = 'recovered';

        state.checks[result.id] = {
            ...prev,
            name: result.name,
            ok: true,
            consecutiveFailures: 0,
            alerted: false,
            lastAlertAt: null,
            lastOkAt: new Date(now).toISOString(),
            lastResult: summarise(result),
            downSince: null,
            // A recovery ends the incident, so the next outage starts the
            // ladder from the first rung again rather than resuming mid-cycle.
            notificationsSent: 0,
        };
    } else {
        const consecutiveFailures = prev.consecutiveFailures + 1;
        const threshold = config.alert.afterConsecutiveFailures;
        const repeatMs = config.alert.repeatMinutes * 60 * 1000;
        const sinceLastAlert = prev.lastAlertAt ? now - Date.parse(prev.lastAlertAt) : Infinity;

        if (config.alert.everyFailure && consecutiveFailures >= threshold) {
            // Every failing run sends. Noisier by design: the intent is that a
            // second failure escalates to Slack or WhatsApp later, and that
            // escalation needs a signal on every run, not one per hour.
            action = prev.alerted ? 'remind' : 'alert';
        } else if (!prev.alerted && consecutiveFailures >= threshold) {
            action = 'alert';
        } else if (prev.alerted && repeatMs > 0 && sinceLastAlert >= repeatMs) {
            action = 'remind';
        }

        state.checks[result.id] = {
            ...prev,
            name: result.name,
            ok: false,
            consecutiveFailures,
            alerted: prev.alerted || action === 'alert',
            lastAlertAt:
                action === 'alert' || action === 'remind' ? new Date(now).toISOString() : prev.lastAlertAt,
            lastFailureAt: new Date(now).toISOString(),
            lastResult: summarise(result),
            downSince: prev.downSince || new Date(now).toISOString(),
        };
    }

    state.history.unshift(summarise(result));
    state.history = state.history.slice(0, HISTORY_LIMIT);

    await persist();

    const entry = state.checks[result.id];

    // Which rung of the escalation ladder this notification uses. The Nth
    // notification for one continuous outage takes the Nth entry, and the list
    // wraps — so a long outage keeps cycling email → Slack → escalated Slack
    // rather than sending the same email forever.
    const ladder = config.alert.escalation;
    let channel = ladder[0];

    if (action === 'alert' || action === 'remind') {
        const sent = entry.notificationsSent || 0;
        channel = ladder[sent % ladder.length];
        entry.notificationsSent = sent + 1;
        await persist();
    } else if (action === 'recovered') {
        // Recovery goes everywhere the outage went, so nobody is left thinking
        // it is still broken.
        channel = 'all';
    }

    return {
        action,
        channel,
        notificationNumber: entry.notificationsSent || 0,
        consecutiveFailures: entry.consecutiveFailures,
        downSince: entry.downSince,
        lastOkAt: entry.lastOkAt,
    };
}

/** Trim a result down to what the dashboard and history need. */
function summarise(result) {
    return {
        id: result.id,
        name: result.name,
        ok: result.ok,
        skipped: result.skipped || false,
        at: result.startedAt,
        durationMs: result.durationMs,
        failedStep: result.failedStep || null,
        error: result.error || null,
        attempts: result.attempts || 1,
        steps: (result.steps || []).map((s) => ({ name: s.name, ok: s.ok, ms: s.ms })),
    };
}

export async function resetState() {
    cache = emptyState();
    await persist();
    log.info('state reset');
}
