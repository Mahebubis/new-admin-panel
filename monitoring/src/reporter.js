// src/reporter.js
//
// Writes every check result into a database table so the admin panel can show
// monitoring history alongside everything else.
//
// This deliberately uses a SEPARATE database (istudio_monitor) rather than
// adding an INSERT grant on istudio_cit. The monitoring user should never be
// able to write rows into the tables holding real student data — the only
// writes it can make there are the DELETE/UPDATE on its own test account. A
// second database keeps that boundary intact while still giving you history.
//
// Reporting is best-effort by design: if the reporting database is unreachable
// the check result is still logged and still alerted on. A monitor that stops
// monitoring because its logbook is full would be worse than useless.

import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import config from './config.js';
import { createLogger } from './logger.js';

const log = createLogger('reporter');

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Every result is written here on the monitoring server FIRST, then pushed to
// MySQL. That ordering is the whole point: the history database lives on the
// same machine being monitored, so the moment it goes down is exactly the
// moment the outage stops being recorded — losing the record of the incident
// you most needed. Writing locally first means an outage is captured on a
// machine the outage cannot reach, and replayed once MySQL answers again.
const QUEUE_FILE = path.join(config.runtime.stateDir, 'pending-reports.jsonl');

// Roughly two weeks of continuous downtime at the default schedules. Far more
// than any real outage, and small enough that the file cannot fill the disk.
const QUEUE_MAX_ROWS = 20000;

let pool = null;
let tableChecked = false;
let disabledReason = null;
let queueWarned = false;

function getPool() {
    if (pool) return pool;

    pool = mysql.createPool({
        host: config.report.host,
        port: config.report.port,
        user: config.report.user,
        password: config.report.password,
        database: config.report.database,
        connectionLimit: 2,
        // Short on purpose. A 15s connect timeout, hit three or four times in
        // one run, stretched a 5-second light run to over two minutes during
        // the outage on 25 Aug — close to overrunning the 5-minute schedule.
        // If the database is down, it is down; waiting longer proves nothing.
        connectTimeout: 4000,
        timezone: 'Z',
        waitForConnections: true,
        enableKeepAlive: false,
    });

    return pool;
}

/* ── local queue ─────────────────────────────────────────────────────────── */

async function enqueue(row) {
    try {
        await fs.mkdir(config.runtime.stateDir, { recursive: true });
        await fs.appendFile(QUEUE_FILE, JSON.stringify(row) + '\n', 'utf8');
        return true;
    } catch (error) {
        log.error(`could not buffer the result locally: ${error.message}`);
        return false;
    }
}

async function readQueue() {
    try {
        const raw = await fs.readFile(QUEUE_FILE, 'utf8');
        return raw
            .split('\n')
            .filter(Boolean)
            .map((line) => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;  // a torn line from a crash mid-write
                }
            })
            .filter(Boolean);
    } catch {
        return [];
    }
}

async function writeQueue(rows) {
    // Keep the newest if the queue ever grows past the cap — old results
    // matter less than not filling the disk.
    const kept = rows.slice(-QUEUE_MAX_ROWS);
    if (rows.length > kept.length) {
        log.warn(`history queue exceeded ${QUEUE_MAX_ROWS} rows — dropped the oldest ${rows.length - kept.length}`);
    }
    try {
        await fs.mkdir(config.runtime.stateDir, { recursive: true });
        if (kept.length === 0) {
            await fs.rm(QUEUE_FILE, { force: true });
        } else {
            await fs.writeFile(QUEUE_FILE, kept.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
        }
    } catch (error) {
        log.error(`could not rewrite the history queue: ${error.message}`);
    }
}

/** How many results are waiting to reach MySQL. Surfaced on the status page. */
export async function pendingCount() {
    return (await readQueue()).length;
}

export async function closeReportPool() {
    if (!pool) return;
    try {
        await pool.end();
    } catch (error) {
        log.debug(`report pool close failed: ${error.message}`);
    }
    pool = null;
    tableChecked = false;
}

async function ensureTable(conn) {
    if (tableChecked) return true;

    const [rows] = await conn.query(
        'SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
        [config.report.database, config.report.table]
    );

    if (rows[0]?.n > 0) {
        tableChecked = true;
        return true;
    }

    throw new Error(
        `Table \`${config.report.database}\`.\`${config.report.table}\` does not exist. ` +
        'Create it with the SQL in deploy/monitoring-report-table.sql.'
    );
}

/** MySQL DATETIME wants 'YYYY-MM-DD HH:MM:SS' in UTC, not an ISO string. */
const toMysqlDatetime = (iso) => new Date(iso).toISOString().slice(0, 19).replace('T', ' ');

const statusOf = (result) => (result.skipped ? 'skip' : result.ok ? 'pass' : 'fail');

/** Long error text would bloat the row; the full detail is in the artifacts. */
const clamp = (value, max) => {
    if (value === null || value === undefined) return null;
    const s = String(value);
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

/**
 * Record one check result. Never throws — a reporting failure must not turn a
 * passing check into a failing one.
 *
 * @returns {Promise<boolean>} whether the row was written
 */
export async function reportResult(result, meta = {}) {
    if (!config.report.enabled) return false;

    if (!IDENT.test(config.report.table)) {
        if (!disabledReason) {
            disabledReason = `invalid DB_REPORT_TABLE "${config.report.table}"`;
            log.error(`reporting disabled — ${disabledReason}`);
        }
        return false;
    }

    // Buffer to disk first, unconditionally. This is the whole reason the
    // queue exists: the history database sits on the machine being monitored,
    // so the moment it goes down is exactly the moment the outage stops being
    // recorded — losing the record of the incident you most needed. Writing
    // locally first captures it on a machine the outage cannot reach.
    await enqueue(toRow(result, meta));

    return (await flushQueue()) > 0;
}

/** Flatten a result into the columns the history table stores. */
function toRow(result, meta) {
    return {
        run_id: clamp(meta.runId, 40),
        check_id: clamp(result.id, 64),
        check_name: clamp(result.name, 160),
        check_group: clamp(result.group, 32),
        status: statusOf(result),
        started_at: toMysqlDatetime(result.startedAt),
        duration_ms: result.durationMs || 0,
        attempts: result.attempts || 0,
        failed_step: clamp(result.failedStep, 160),
        error: clamp(result.error, 2000),
        steps_json: JSON.stringify(
            (result.steps || []).map((s) => ({
                name: s.name,
                ok: s.ok,
                ms: s.ms,
                soft: s.soft || undefined,
                error: s.error ? clamp(s.error, 500) : undefined,
            }))
        ),
        context_json: JSON.stringify(result.context || {}),
        alerted: meta.alerted ? 1 : 0,
        host: clamp(meta.host, 64),
    };
}

const REPORT_COLUMNS = [
    'run_id', 'check_id', 'check_name', 'check_group', 'status', 'started_at',
    'duration_ms', 'attempts', 'failed_step', 'error', 'steps_json',
    'context_json', 'alerted', 'host',
];

/**
 * Push everything buffered on disk into MySQL, oldest first, keeping only what
 * could not be written.
 *
 * Never throws. A history database that is down must not stop the monitoring
 * that exists to tell you it is down.
 *
 * @returns {Promise<number>} rows written
 */
export async function flushQueue() {
    const rows = await readQueue();
    if (rows.length === 0) return 0;

    const placeholders = REPORT_COLUMNS.map(() => '?').join(', ');
    const sql =
        'INSERT INTO `' + config.report.table + '` (' + REPORT_COLUMNS.join(', ') + ') ' +
        'VALUES (' + placeholders + ')';

    let conn;
    let done = 0;

    try {
        conn = await getPool().getConnection();
        await ensureTable(conn);

        // One statement per row rather than a single multi-row INSERT: one
        // malformed row would otherwise reject the entire backlog with it.
        for (const row of rows) {
            try {
                await conn.query(sql, REPORT_COLUMNS.map((c) => row[c] ?? null));
            } catch (error) {
                // A row the database will never accept would block the queue
                // forever. Drop it, loudly, and keep going.
                log.error(
                    `dropping an unwritable history row (${row.check_id} @ ${row.started_at}): ${error.message}`
                );
            }
            done += 1;
        }

        await writeQueue(rows.slice(done));

        if (done > 1) log.info(`flushed ${done} buffered history row(s) to the database`);
        queueWarned = false;
        return done;
    } catch (error) {
        // Connection-level failure: keep everything and retry next run.
        if (!queueWarned) {
            log.warn(
                `history database unreachable (${error.message}) — ` +
                `${rows.length} result(s) buffered locally, will be written when it returns`
            );
            queueWarned = true;
        }
        // Anything already inserted before the connection died must not be
        // written twice on the next attempt.
        if (done > 0) await writeQueue(rows.slice(done));
        return done;
    } finally {
        if (conn) conn.release();
    }
}

/**
 * Drop rows older than the retention window. Called once per run, cheaply —
 * without it the table grows by ~600 rows/day forever.
 */
export async function pruneReports() {
    if (!config.report.enabled || disabledReason) return 0;
    if (!config.report.retentionDays || config.report.retentionDays <= 0) return 0;
    if (!IDENT.test(config.report.table)) return 0;

    let conn;
    try {
        conn = await getPool().getConnection();
        const [res] = await conn.query(
            `DELETE FROM \`${config.report.table}\` WHERE started_at < (NOW() - INTERVAL ? DAY)`,
            [config.report.retentionDays]
        );
        if (res.affectedRows) {
            log.info(`pruned ${res.affectedRows} history row(s) older than ${config.report.retentionDays}d`);
        }
        return res.affectedRows;
    } catch (error) {
        log.warn(`history prune failed: ${error.message}`);
        return 0;
    } finally {
        if (conn) conn.release();
    }
}
