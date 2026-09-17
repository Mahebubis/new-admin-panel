// src/utils/http.js
//
// Thin fetch wrapper: every request is bounded by a timeout (a hung socket is
// the exact failure mode we are here to catch, so it must never hang *us*),
// and timing is returned because "slow" is a signal worth alerting on too.

const DEFAULT_TIMEOUT_MS = 20000;
const UA = 'InternshipStudio-Monitor/1.0 (+synthetic health check)';

// Safe here — these are server-to-server calls with no browser and therefore
// no CORS preflight. The browser contexts deliberately do NOT send this; see
// the comment in browser.js.
const PROBE_HEADER = { 'X-Monitor-Probe': 'istudio-monitoring' };

export async function request(url, options = {}) {
    const {
        method = 'GET',
        headers = {},
        body,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        expectJson = false,
    } = options;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    try {
        const init = {
            method,
            signal: controller.signal,
            headers: { 'User-Agent': UA, Accept: '*/*', ...PROBE_HEADER, ...headers },
            redirect: 'follow',
        };

        if (body !== undefined && body !== null) {
            if (typeof body === 'string' || body instanceof URLSearchParams) {
                init.body = body;
            } else {
                init.body = JSON.stringify(body);
                init.headers['Content-Type'] = init.headers['Content-Type'] || 'application/json';
            }
        }

        const response = await fetch(url, init);
        const text = await response.text();
        const ms = Date.now() - startedAt;

        let json = null;
        if (expectJson || (response.headers.get('content-type') || '').includes('application/json')) {
            try {
                json = JSON.parse(text);
            } catch {
                json = null;
            }
        }

        return {
            ok: response.ok,
            status: response.status,
            ms,
            headers: Object.fromEntries(response.headers.entries()),
            text,
            json,
            url: response.url,
        };
    } catch (error) {
        const ms = Date.now() - startedAt;
        if (error.name === 'AbortError') {
            const e = new Error(`Timed out after ${timeoutMs}ms: ${method} ${url}`);
            e.code = 'ETIMEDOUT';
            e.ms = ms;
            throw e;
        }
        const e = new Error(`Network error on ${method} ${url}: ${error.message}`);
        e.code = error.cause?.code || error.code || 'ENETWORK';
        e.ms = ms;
        throw e;
    } finally {
        clearTimeout(timer);
    }
}

export const get = (url, options) => request(url, { ...options, method: 'GET' });
export const post = (url, body, options) => request(url, { ...options, method: 'POST', body });

/** First N characters of a response body, for alert emails. */
export function snippet(text, max = 400) {
    if (!text) return '';
    const clean = String(text).replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}
