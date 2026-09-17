// src/utils/result.js
//
// Every check produces the same shape, so the alert template, the state file
// and the status dashboard can all read results without knowing which check
// produced them.
//
// A "step" is one thing a real student would do ("open the register page",
// "submit the form"). Recording steps individually is what lets the alert say
// *which* step broke instead of just "registration failed".

// Playwright errors arrive with ANSI colour codes and a multi-line "Call log:"
// block. Dropped into an email verbatim they render as `[2m` noise, and
// the useful part — *what* it was waiting for — is buried below the fold. Keep
// the headline plus the first call-log line, which together read as a sentence.
// eslint-disable-next-line no-control-regex
const ANSI = /\x1B\[[0-9;]*m/g;

function cleanError(error) {
    const raw = String(error?.message ?? error ?? '').replace(ANSI, '');
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length <= 1) return lines[0] || 'unknown error';

    const detail = lines.find((l) => l.startsWith('- waiting for') || l.startsWith('- navigating'));
    return detail ? `${lines[0]} (${detail.replace(/^-\s*/, '')})` : lines[0];
}

export class Recorder {
    constructor({ id, name, severity = 'critical', group = 'light' }) {
        this.id = id;
        this.name = name;
        this.severity = severity;
        this.group = group;
        this.steps = [];
        this.artifacts = [];
        this.context = {};
        this.startedAt = Date.now();
    }

    /** Attach free-form detail that belongs to the run as a whole. */
    note(key, value) {
        this.context[key] = value;
        return this;
    }

    addArtifact(artifact) {
        if (artifact) this.artifacts.push(artifact);
        return this;
    }

    /**
     * Run one student-visible step. A throw marks the step failed and
     * propagates, which ends the check — later steps in a journey are
     * meaningless once an earlier one has broken.
     */
    async step(name, fn) {
        const startedAt = Date.now();
        try {
            const value = await fn();
            this.steps.push({ name, ok: true, ms: Date.now() - startedAt });
            return value;
        } catch (error) {
            this.steps.push({
                name,
                ok: false,
                ms: Date.now() - startedAt,
                error: cleanError(error),
            });
            error.failedStep = name;
            throw error;
        }
    }

    /**
     * A step whose failure is worth reporting but must not abort the journey
     * (e.g. an optional banner, a secondary endpoint).
     */
    async softStep(name, fn) {
        const startedAt = Date.now();
        try {
            const value = await fn();
            this.steps.push({ name, ok: true, ms: Date.now() - startedAt });
            return value;
        } catch (error) {
            this.steps.push({
                name,
                ok: false,
                soft: true,
                ms: Date.now() - startedAt,
                error: cleanError(error),
            });
            return undefined;
        }
    }

    finish(error = null) {
        const failedStep = this.steps.find((s) => !s.ok && !s.soft);
        return {
            id: this.id,
            name: this.name,
            severity: this.severity,
            group: this.group,
            ok: !error && !failedStep,
            startedAt: new Date(this.startedAt).toISOString(),
            durationMs: Date.now() - this.startedAt,
            failedStep: failedStep?.name || (error ? error.failedStep : null) || null,
            error: error ? cleanError(error) : failedStep?.error || null,
            steps: this.steps,
            artifacts: this.artifacts,
            context: this.context,
        };
    }
}

/** Throw with a message the alert email can show verbatim. */
export function fail(message) {
    throw new Error(message);
}

/** assert-style guard used all over the checks. */
export function expect(condition, message) {
    if (!condition) fail(message);
}
