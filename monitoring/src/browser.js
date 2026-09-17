// src/browser.js
//
// One Chromium instance is launched per check run and torn down afterwards.
// Sharing a browser across runs would be cheaper, but a wedged renderer would
// then poison every subsequent check — and a monitor that lies is worse than
// one that is slightly slower.

import { chromium } from 'playwright';
import config from './config.js';
import { createLogger } from './logger.js';

const log = createLogger('browser');

const LAUNCH_ARGS = [
    // Required on most small cloud VMs: /dev/shm is tiny there and Chromium
    // crashes mid-navigation without this.
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
];

export async function launchBrowser() {
    const browser = await chromium.launch({
        headless: config.runtime.headless,
        args: LAUNCH_ARGS,
    });
    return browser;
}

/**
 * A context with a realistic viewport and UA. The monitor marker lives in the
 * User-Agent, which is where analytics filtering should key off it anyway.
 *
 * Deliberately NO custom request header here. A header like `X-Monitor-Probe`
 * turns every cross-origin XHR the app makes into a preflighted request, and
 * payment-backend's CORS middleware answers preflights with a hardcoded
 * `Access-Control-Allow-Headers: Content-Type, Authorization` — so the browser
 * blocks the call. The monitor would then report a payment outage that no real
 * student experiences. A synthetic check has to send exactly what a real
 * browser sends, or it tests something other than production.
 */
export async function newContext(browser, overrides = {}) {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata',
        ignoreHTTPSErrors: false,
        userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/131.0.0.0 Safari/537.36 InternshipStudioMonitor/1.0',
        ...overrides,
    });

    context.setDefaultTimeout(config.runtime.stepTimeoutMs);
    context.setDefaultNavigationTimeout(config.runtime.stepTimeoutMs);
    return context;
}

/**
 * Attach console/pageerror/failed-request listeners. The returned array is
 * live — read it after a failure to see what the browser was complaining
 * about, which is usually the fastest route to the cause.
 */
export function collectConsole(page) {
    const lines = [];
    const push = (kind, text) => {
        lines.push(`[${new Date().toISOString()}] ${kind} ${text}`);
        if (lines.length > 500) lines.shift();
    };

    page.on('console', (msg) => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
            push(`console.${msg.type()}`, msg.text());
        }
    });
    page.on('pageerror', (error) => push('pageerror', error.message));
    page.on('requestfailed', (req) => {
        push('requestfailed', `${req.method()} ${req.url()} — ${req.failure()?.errorText || 'unknown'}`);
    });
    page.on('response', (res) => {
        if (res.status() >= 500) push('http5xx', `${res.status()} ${res.url()}`);
    });

    return lines;
}

/**
 * Navigate and assert the response was actually served. Playwright resolves
 * goto() happily on a 500, so the status has to be checked explicitly — a
 * "page loaded" that is really an error page is exactly the bug class this
 * system exists to catch.
 */
export async function gotoOk(page, url, { waitUntil = 'domcontentloaded' } = {}) {
    const response = await page.goto(url, { waitUntil });
    if (!response) {
        throw new Error(`No response received for ${url}`);
    }
    if (response.status() >= 400) {
        throw new Error(`HTTP ${response.status()} loading ${url}`);
    }
    return response;
}

export async function closeQuietly(resource) {
    if (!resource) return;
    try {
        await resource.close();
    } catch (error) {
        log.debug(`close failed: ${error.message}`);
    }
}
