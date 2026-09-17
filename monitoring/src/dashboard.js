// src/dashboard.js
//
// A small status page so the team can see the current state without SSH, plus
// /healthz for an external uptime check.
//
// Worth doing: this monitor is itself a single point of failure. Point a free
// external ping (UptimeRobot, Better Stack, a cron on another box) at
// /healthz, so if the monitoring box dies somebody still finds out.

import fs from 'node:fs/promises';
import express from 'express';
import config from './config.js';
import { createLogger } from './logger.js';
import { readState } from './state.js';
import { runGroup } from './runner.js';
import { pendingCount } from './reporter.js';

const log = createLogger('dashboard');

const esc = (s) =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const ago = (iso) => {
    if (!iso) return 'never';
    const seconds = Math.floor((Date.now() - Date.parse(iso)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
};

function renderPage(state) {
    const entries = Object.entries(state.checks || {});
    const down = entries.filter(([, c]) => !c.ok);

    const rows = entries
        .map(([id, c]) => {
            const color = c.ok ? '#16a34a' : '#dc2626';
            const label = c.ok ? 'OPERATIONAL' : 'FAILING';
            return `<tr>
        <td><strong>${esc(c.name || id)}</strong><div class="muted">${esc(id)}</div></td>
        <td><span class="pill" style="background:${color}">${label}</span></td>
        <td>${esc(ago(c.ok ? c.lastOkAt : c.lastFailureAt))}</td>
        <td>${c.ok ? '—' : `${c.consecutiveFailures} run(s)`}</td>
        <td class="muted">${esc(c.ok ? '' : `${c.lastResult?.failedStep || ''}: ${c.lastResult?.error || ''}`).slice(0, 220)}</td>
      </tr>`;
        })
        .join('');

    const history = (state.history || [])
        .slice(0, 40)
        .map(
            (h) => `<tr>
        <td class="muted">${esc(new Date(h.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))}</td>
        <td>${esc(h.name)}</td>
        <td><span class="dot" style="background:${h.skipped ? '#94a3b8' : h.ok ? '#16a34a' : '#dc2626'}"></span>${h.skipped ? 'skipped' : h.ok ? 'passed' : 'failed'}</td>
        <td class="muted">${h.durationMs}ms</td>
        <td class="muted">${esc(h.error || '').slice(0, 160)}</td>
      </tr>`
        )
        .join('');

    return `<!doctype html>
<html><head><meta charset="utf-8"><title>iStudio Monitoring</title>
<meta http-equiv="refresh" content="30">
<style>
  :root{color-scheme:light dark}
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;background:#f1f5f9;color:#0f172a}
  .wrap{max-width:1080px;margin:0 auto;padding:28px 20px}
  h1{font-size:22px;margin:0 0 4px}
  .sub{color:#64748b;font-size:13px;margin-bottom:22px}
  .banner{padding:14px 18px;border-radius:10px;font-weight:600;margin-bottom:22px;color:#fff}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:28px}
  th{text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0}
  td{padding:12px 14px;border-bottom:1px solid #f1f5f9;font-size:14px;vertical-align:top}
  .muted{color:#64748b;font-size:12px}
  .pill{color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;letter-spacing:.03em}
  .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
</style></head>
<body><div class="wrap">
  <h1>Internship Studio — monitoring</h1>
  <div class="sub">Registration, exam and payment journeys. Auto-refreshes every 30s. Last update ${esc(ago(state.updatedAt))}.</div>

  <div class="banner" style="background:${down.length ? '#dc2626' : '#16a34a'}">
    ${down.length
            ? `${down.length} check(s) failing: ${down.map(([, c]) => esc(c.name)).join(', ')}`
            : 'All monitored journeys are working'}
  </div>

  ${state.pendingHistoryRows > 0
            ? `<div class="banner" style="background:#b45309;font-size:14px;">
                 ${state.pendingHistoryRows} result(s) waiting to reach the history database &mdash;
                 it is unreachable, so they are buffered here and will be written when it returns.
                 Checks and alerts are unaffected.
               </div>`
            : ''}

  <table>
    <tr><th>Check</th><th>Status</th><th>Last run</th><th>Failing for</th><th>Detail</th></tr>
    ${rows || '<tr><td colspan="5" class="muted">No runs recorded yet.</td></tr>'}
  </table>

  <h1 style="font-size:16px">Recent runs</h1>
  <div class="sub">Newest first.</div>
  <table>
    <tr><th>Time (IST)</th><th>Check</th><th>Result</th><th>Duration</th><th>Error</th></tr>
    ${history || '<tr><td colspan="5" class="muted">No history yet.</td></tr>'}
  </table>
</div></body></html>`;
}

export async function startDashboard() {
    const app = express();
    app.disable('x-powered-by');

    // Optional shared-secret gate. Left off by default because the port is
    // expected to sit behind a security group or nginx.
    app.use((req, res, next) => {
        if (!config.dashboard.token) return next();
        if (req.path === '/healthz') return next();
        const supplied = req.query.token || req.get('x-monitor-token');
        if (supplied === config.dashboard.token) return next();
        res.status(401).send('Unauthorized');
    });

    app.get('/healthz', async (_req, res) => {
        const state = await readState();
        const down = Object.values(state.checks || {}).filter((c) => !c.ok);
        res.status(down.length ? 503 : 200).json({
            status: down.length ? 'degraded' : 'ok',
            failing: down.map((c) => c.name),
            updatedAt: state.updatedAt,
            // Non-zero means the history database is unreachable and results
            // are queued on disk. Monitoring itself is unaffected.
            pendingHistoryRows: await pendingCount().catch(() => null),
        });
    });

    app.get('/api/state', async (_req, res) => res.json(await readState()));

    app.get('/', async (_req, res) => {
        const state = await readState();
        state.pendingHistoryRows = await pendingCount().catch(() => 0);
        res.type('html').send(renderPage(state));
    });

    /*
     * Read-only view of the worker logs.
     *
     * The workers moved off the web server, so their log files live here now.
     * Serving them read-only is the safe direction: copying them BACK to
     * cPanel would mean either an SSH key from this machine into production or
     * a write endpoint on the web server — a new path into production, for
     * something that is only ever read.
     *
     * The name is matched against a fixed map, never joined into a path, so
     * "../../etc/passwd" cannot resolve to anything.
     */
    const LOGS = {
        journey: {
            label: 'Journey worker',
            path: '/var/log/istudio-workers/journey.log',
        },
        campaign: {
            label: 'Campaign worker (cron output)',
            path: '/var/log/istudio-workers/campaign.log',
        },
        whatsapp: {
            label: 'WhatsApp worker (cron output)',
            path: '/var/log/istudio-workers/whatsapp.log',
        },
        'campaign-detail': {
            label: 'Campaign worker (detailed)',
            path: '/opt/istudio-workers/react-api/api/campaigns/worker.log',
        },
        'whatsapp-detail': {
            label: 'WhatsApp worker (detailed)',
            path: '/opt/istudio-workers/react-api/api/whatsapp/wa-worker.log',
        },
        'elasticemail-events': {
            label: 'Elastic Email events poller',
            // NOT /var/log/istudio-workers/ee-events.log, which is where the crontab sends
            // this poller's stdout. The poller echoes nothing on a normal run — everything
            // goes through its own ee_poll_log() — so that file stays empty forever and the
            // pane showed nothing on a poller that was running correctly every minute.
            path: '/opt/istudio-workers/react-api/api/campaigns/ee-poll.log',
        },
        freshdesk: {
            label: 'Freshdesk IMAP sync',
            // Unlike the Elastic Email poller above, this one DOES print its result to
            // stdout — one JSON line per run — so the crontab's redirect is the whole log.
            path: '/var/log/istudio-workers/freshdesk.log',
        },
        monitor: {
            label: 'Monitoring service',
            path: null,   // journald, not a file — see below
            journal: 'istudio-monitoring',
        },
    };

    /** Last N lines without reading a large file into memory twice. */
    async function tailFile(path, lines) {
        const handle = await fs.open(path, 'r');
        try {
            const { size } = await handle.stat();
            // 400 bytes per line is generous for these logs; cap the read so a
            // runaway file cannot exhaust memory.
            const want = Math.min(size, Math.max(64 * 1024, lines * 400));
            const buf = Buffer.alloc(want);
            await handle.read(buf, 0, want, size - want);
            const text = buf.toString('utf8');
            // Drop the first line: reading from an offset usually lands
            // mid-line, and a half sentence at the top reads like corruption.
            const all = (size > want ? text.slice(text.indexOf('\n') + 1) : text).split('\n');
            return all.slice(-lines).join('\n');
        } finally {
            await handle.close();
        }
    }

    app.get('/logs', (_req, res) => {
        const token = config.dashboard.token ? `?token=${encodeURIComponent(config.dashboard.token)}` : '';
        const rows = Object.entries(LOGS)
            .map(([name, l]) => `<tr>
                 <td><strong>${esc(l.label)}</strong><div class="muted">${esc(name)}</div></td>
                 <td><a href="/logs/${name}${token}">view</a></td>
                 <td><a href="/logs/${name}${token}${token ? '&' : '?'}lines=500">last 500</a></td>
                 <td class="muted">${esc(l.path || 'systemd journal')}</td>
               </tr>`)
            .join('');
        res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Worker logs</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#f1f5f9;color:#0f172a}
.wrap{max-width:900px;margin:0 auto;padding:28px 20px}h1{font-size:22px}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
td{padding:12px 14px;border-bottom:1px solid #f1f5f9;font-size:14px}tr:last-child td{border-bottom:none}
.muted{color:#64748b;font-size:12px}a{color:#1f5c8b}</style></head><body><div class="wrap">
<h1>Worker logs</h1><p class="muted">Read-only. Auto-refreshes every 15s on a log page.</p>
<table>${rows}</table>
<p style="margin-top:20px"><a href="/${token}">&larr; monitoring status</a></p>
</div></body></html>`);
    });

    app.get('/logs/:name', async (req, res) => {
        const entry = LOGS[req.params.name];
        if (!entry) return res.status(404).type('text/plain').send('Unknown log');

        const lines = Math.min(5000, Math.max(10, parseInt(req.query.lines, 10) || 200));
        let body;

        try {
            if (entry.journal) {
                const { execFile } = await import('node:child_process');
                body = await new Promise((resolve, reject) => {
                    execFile(
                        'journalctl',
                        ['-u', entry.journal, '-n', String(lines), '--no-pager'],
                        { maxBuffer: 8 * 1024 * 1024 },
                        (err, stdout) => (err ? reject(err) : resolve(stdout))
                    );
                });
            } else {
                body = await tailFile(entry.path, lines);
            }
        } catch (error) {
            body = error.code === 'ENOENT'
                ? `This log does not exist yet: ${entry.path}\n\nIt is created the first time the worker writes to it.`
                : `Could not read the log: ${error.message}`;
        }

        if (req.query.raw !== undefined) return res.type('text/plain').send(body);

        const token = config.dashboard.token ? `?token=${encodeURIComponent(config.dashboard.token)}` : '';
        res.type('html').send(`<!doctype html><html><head><meta charset="utf-8">
<title>${esc(entry.label)}</title><meta http-equiv="refresh" content="15">
<style>body{margin:0;background:#0d131c;color:#dde5ee;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.bar{position:sticky;top:0;background:#131b26;border-bottom:1px solid #26333f;padding:10px 16px;
display:flex;gap:16px;align-items:baseline;font-family:-apple-system,Segoe UI,sans-serif}
.bar b{font-size:14px}.bar a{color:#6baadb;font-size:13px}.bar span{color:#8494ab;font-size:12px}
pre{margin:0;padding:16px;white-space:pre-wrap;word-break:break-word;font-size:12.5px;line-height:1.6}
.e{color:#e2726b}.w{color:#d9a441}</style></head><body>
<div class="bar"><b>${esc(entry.label)}</b>
<a href="/logs${token}">all logs</a>
<a href="/logs/${req.params.name}${token}${token ? '&' : '?'}lines=1000">1000 lines</a>
<a href="/logs/${req.params.name}${token}${token ? '&' : '?'}raw">raw</a>
<span>last ${lines} lines &middot; refreshes every 15s</span></div>
<pre>${esc(body)
                .replace(/^(.*(?:FATAL|ERROR|Fatal error|Parse error).*)$/gim, '<span class="e">$1</span>')
                .replace(/^(.*(?:WARN|Warning).*)$/gim, '<span class="w">$1</span>')}</pre>
</body></html>`);
    });

    // Manual re-run, handy right after a fix has been deployed.
    app.post('/run/:group', async (req, res) => {
        const group = req.params.group;
        if (!['light', 'journey', 'all'].includes(group)) {
            return res.status(400).json({ error: 'group must be light, journey or all' });
        }
        res.json({ started: group });
        runGroup(group).catch((error) => log.error(`manual ${group} run failed: ${error.message}`));
    });

    const server = await new Promise((resolve) => {
        const s = app.listen(config.dashboard.port, () => {
            log.info(`status dashboard on http://0.0.0.0:${config.dashboard.port}`);
            resolve(s);
        });
    });

    return () => new Promise((resolve) => server.close(resolve));
}

export default startDashboard;
