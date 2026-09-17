// src/checks/websiteAvailability.js
//
// MVP test #1 — "is anything reachable at all".
//
// This is the check that catches server.accofin.in going down. It runs on the
// light schedule (every 5 min) because it is cheap: no browser, just HTTP.
// It deliberately loads the dashboard in a browser too, because a Vite SPA can
// return 200 for index.html while the JS bundle 404s and every student sees a
// blank page.

import { get, snippet } from '../utils/http.js';
import { expect } from '../utils/result.js';
import { newContext, collectConsole, gotoOk, closeQuietly } from '../browser.js';
import { capturePage } from '../utils/artifacts.js';

// A response slower than this is reported, but does not on its own fail the
// check — the site is up, just unhappy.
const SLOW_MS = 5000;

export default {
    id: 'website-availability',
    name: 'Website availability',
    group: 'light',
    severity: 'critical',
    needsBrowser: true,

    async run({ config, recorder, browser, artifactDir }) {
        const endpoints = [
            { label: 'Student dashboard', url: `${config.targets.dashboard}/` },
            { label: 'Login page', url: `${config.targets.dashboard}/login` },
            { label: 'Registration page', url: `${config.targets.dashboard}/register` },
            { label: 'Exam frontend', url: `${config.targets.exam}/` },
        ];

        if (config.targets.website) {
            endpoints.push({ label: 'Public website', url: `${config.targets.website}/` });
        }

        const slow = [];

        for (const endpoint of endpoints) {
            await recorder.step(`HTTP ${endpoint.label}`, async () => {
                const res = await get(endpoint.url, { timeoutMs: 20000 });
                expect(
                    res.status < 400,
                    `${endpoint.label} returned HTTP ${res.status} — ${snippet(res.text, 200)}`
                );
                if (res.ms > SLOW_MS) slow.push(`${endpoint.label} ${res.ms}ms`);
                return res.status;
            });
        }

        if (slow.length) recorder.note('slowResponses', slow);

        // Render the dashboard for real. A 200 on index.html proves nothing
        // about whether the app actually boots.
        const context = await newContext(browser);
        const page = await context.newPage();
        const consoleLines = collectConsole(page);

        try {
            await recorder.step('Dashboard app renders', async () => {
                await gotoOk(page, `${config.targets.dashboard}/login`, { waitUntil: 'domcontentloaded' });

                // The login form is the first thing a logged-out student sees.
                // Waiting for it proves React mounted and the bundle loaded.
                await page.waitForSelector('input[name="email"], #email', {
                    state: 'visible',
                    timeout: config.runtime.stepTimeoutMs,
                });

                const bodyText = (await page.textContent('body')) || '';
                expect(
                    bodyText.trim().length > 50,
                    'Dashboard rendered an effectively empty page (bundle or API failure).'
                );

                const fatal = consoleLines.filter((l) => l.includes('pageerror') || l.includes('http5xx'));
                expect(
                    fatal.length === 0,
                    `Dashboard raised browser errors: ${fatal.slice(0, 3).join(' | ')}`
                );
            });
        } catch (error) {
            for (const artifact of await capturePage(page, artifactDir, 'website-availability', { consoleLines })) {
                recorder.addArtifact(artifact);
            }
            throw error;
        } finally {
            await closeQuietly(page);
            await closeQuietly(context);
        }
    },
};
