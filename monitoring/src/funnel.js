// src/funnel.js
//
// The student journey as a chain of stages, so an alert email answers the
// question people actually have: "how far can a student get right now?"
//
// A single check's pass/fail says "registration is broken". The funnel says
// "students can load the site and that's it" — which is the sentence you need
// before deciding whether to wake anyone.
//
// Stages are assembled from two sources:
//   • the checks that ran in THIS run (authoritative, just measured)
//   • the last known result of the others, from the state file (marked stale,
//     because the journey group only runs every 15 minutes while the light
//     group runs every 5)

/**
 * One stage maps to a whole check, or to a single named step inside one.
 * `step` is matched against the step names recorded by the Recorder.
 */
const STAGES = [
    {
        key: 'website',
        label: 'Website loaded',
        detail: 'Dashboard and login pages reachable',
        checkId: 'website-availability',
    },
    {
        key: 'register',
        label: 'Registration',
        detail: 'A student can create an account',
        checkId: 'registration',
    },
    {
        key: 'login',
        label: 'Login',
        detail: 'Sign in with the new account',
        checkId: 'login-exam-start',
        step: /^sign in$/i,
    },
    {
        key: 'exam',
        label: 'Exam',
        detail: 'Start, answer and submit',
        checkId: 'exam-submission',
    },
    {
        key: 'order',
        label: 'Order created',
        detail: 'Payment order accepted by the gateway',
        checkId: 'payment-checkout',
        step: /create payment order/i,
    },
    {
        key: 'checkout',
        label: 'Payment page opened',
        detail: 'Cashfree checkout renders with payment methods',
        checkId: 'payment-checkout',
        step: /load payment gateway checkout/i,
    },
    {
        key: 'paid',
        label: 'Payment success',
        // Deliberately never exercised: Indian cards need a bank OTP that no
        // automated browser can read. Saying so in the email is better than
        // showing a cross every time and training people to ignore it.
        detail: 'Not tested — a real payment needs a bank OTP',
        untested: true,
    },
];

export const FUNNEL_STAGE_COUNT = STAGES.length;

/** Find a check's result in this run, else fall back to the stored state. */
function resolveCheck(checkId, currentResults, storedChecks) {
    const live = currentResults.find((r) => r.id === checkId);
    if (live) return { result: live, stale: false };

    const stored = storedChecks?.[checkId]?.lastResult;
    if (stored) return { result: stored, stale: true, at: storedChecks[checkId].lastResult.at };

    return { result: null, stale: false };
}

function stageFromStep(result, stepPattern) {
    const steps = result.steps || [];
    const step = steps.find((s) => stepPattern.test(s.name || ''));

    if (!step) {
        // The check failed before reaching this step — the stage was never
        // attempted, which is different from having failed.
        return { status: result.ok ? 'pass' : 'blocked', ms: null, error: null };
    }
    return {
        status: step.ok ? 'pass' : 'fail',
        ms: step.ms ?? null,
        error: step.error || null,
    };
}

/**
 * @param {object[]} currentResults results produced in this run
 * @param {object}   storedChecks   state.checks, for anything that did not run
 * @returns {{stages: object[], reachedIndex: number, brokeAt: object|null}}
 */
export function buildFunnel(currentResults = [], storedChecks = {}) {
    const stages = STAGES.map((def) => {
        if (def.untested) {
            return { ...def, status: 'untested', ms: null, error: null, stale: false };
        }

        const { result, stale, at } = resolveCheck(def.checkId, currentResults, storedChecks);

        if (!result) {
            return { ...def, status: 'unknown', ms: null, error: null, stale: false };
        }

        // A skipped check means an earlier dependency broke, so this stage was
        // never reachable — not a failure of its own.
        if (result.skipped) {
            return { ...def, status: 'blocked', ms: null, error: null, stale, at };
        }

        if (def.step) {
            const s = stageFromStep(result, def.step);
            return { ...def, ...s, stale, at };
        }

        return {
            ...def,
            status: result.ok ? 'pass' : 'fail',
            ms: result.durationMs ?? null,
            error: result.ok ? null : result.error || null,
            failedStep: result.ok ? null : result.failedStep || null,
            stale,
            at,
        };
    });

    // How far a student gets before hitting a wall.
    let reachedIndex = -1;
    for (let i = 0; i < stages.length; i += 1) {
        if (stages[i].status === 'pass') reachedIndex = i;
        else break;
    }

    const brokeAt = stages.find((s) => s.status === 'fail') || null;

    return { stages, reachedIndex, brokeAt };
}

/** One-line summary for the email subject and the plain-text body. */
export function funnelHeadline({ stages, reachedIndex, brokeAt }) {
    if (brokeAt) {
        const got = reachedIndex >= 0 ? stages[reachedIndex].label : 'nothing';
        return `Students get as far as: ${got} — then "${brokeAt.label}" fails`;
    }
    const testable = stages.filter((s) => s.status !== 'untested');
    const allOk = testable.every((s) => s.status === 'pass');
    if (allOk) return 'Students can complete the whole journey';
    return 'Journey partially verified — some stages were not reached';
}

export default buildFunnel;
