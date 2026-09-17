// src/db.js
//
// The delete-and-recreate cycle for the fixed test account.
//
// Every journey run starts by removing the previous test account so the
// registration flow can be exercised again with the same email. That means
// this module issues DELETEs against the production database, so it is written
// defensively:
//
//   • It only ever resolves rows by `WHERE email = ?` with the exact
//     MONITOR_EMAIL value. There is no LIKE, no pattern, no wildcard, and no
//     code path that deletes by anything other than an id it looked up itself.
//   • It refuses to run if the configured email is empty or does not look like
//     a test address, so a mistyped .env cannot point it at a real student.
//   • DB_CLEANUP_DRY_RUN reports exactly what it would delete and changes
//     nothing, which is how you should run it the first few times.
//   • A missing table is a warning, not an error — schemas differ, and a
//     half-configured cleanup should still remove what it can.

import mysql from 'mysql2/promise';
import config from './config.js';
import { createLogger } from './logger.js';

const log = createLogger('db');

// Only bare identifiers are allowed through to SQL. Table and column names
// cannot be parameterised, so they are whitelisted by shape instead of being
// interpolated on trust.
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

// One test account, used once per run, cannot legitimately own many child
// rows. If a table reports more than this, the WHERE clause is matching more
// than intended — abort rather than delete and find out afterwards.
const MAX_CHILD_ROWS_PER_TABLE = 50;

let pool = null;

function getPool() {
    if (pool) return pool;

    pool = mysql.createPool({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        connectionLimit: 2,
        connectTimeout: 15000,
        timezone: 'Z',
        // A monitoring job must never sit on a connection: a stalled DB is one
        // of the outages we are here to detect.
        waitForConnections: true,
        enableKeepAlive: false,
    });

    return pool;
}

export async function closePool() {
    if (!pool) return;
    try {
        await pool.end();
    } catch (error) {
        log.debug(`pool close failed: ${error.message}`);
    }
    pool = null;
}

/**
 * Guard against a .env that points this at a real account. The email must
 * contain a recognisable test marker — this is the last thing standing between
 * a typo and a deleted student.
 */
function assertSafeTarget(email) {
    if (!email) {
        throw new Error('MONITOR_EMAIL is empty — refusing to run any cleanup.');
    }
    const local = email.split('@')[0].toLowerCase();
    if (!/(monitor|test|synthetic|healthcheck)/.test(local)) {
        throw new Error(
            `Refusing to delete "${email}": the local part contains no test marker. ` +
            'MONITOR_EMAIL must include "monitor", "test", "synthetic" or "healthcheck" ' +
            'so a misconfiguration cannot target a real student.'
        );
    }
}

async function tableExists(conn, table) {
    const [rows] = await conn.query(
        'SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
        [config.db.database, table]
    );
    return rows[0]?.n > 0;
}

// The users table's primary key is `user_id` here, but `id` in plenty of other
// schemas. Detecting it beats hardcoding either one — a wrong guess fails with
// "Unknown column", which reads like a broken monitor rather than a schema
// mismatch. Cached per process; the schema does not change under us mid-run.
let usersIdColumnCache = null;

async function usersIdColumn(conn) {
    if (usersIdColumnCache) return usersIdColumnCache;

    if (config.db.usersIdColumn) {
        usersIdColumnCache = config.db.usersIdColumn;
        return usersIdColumnCache;
    }

    for (const candidate of ['user_id', 'id']) {
        if (await columnExists(conn, 'users', candidate)) {
            usersIdColumnCache = candidate;
            log.debug(`users primary key detected as "${candidate}"`);
            return candidate;
        }
    }

    throw new Error(
        'Could not find a primary key column on `users` (looked for user_id and id). ' +
        'Set DB_USERS_ID_COLUMN in .env to the correct column name.'
    );
}

async function columnExists(conn, table, column) {
    const [rows] = await conn.query(
        'SELECT COUNT(*) AS n FROM information_schema.COLUMNS ' +
        'WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
        [config.db.database, table, column]
    );
    return rows[0]?.n > 0;
}

/**
 * Every table with a foreign key pointing at users, read from the schema
 * itself.
 *
 * This database has 76 of them. Listing those by hand in DB_CLEANUP_TABLES
 * would be wrong the first time somebody adds a table, and MySQL refuses to
 * delete the user row while any of them still holds a reference — so the list
 * has to come from the database, not from configuration.
 */
async function discoverChildTables(conn, idCol) {
    const [rows] = await conn.query(
        `SELECT TABLE_NAME AS t, COLUMN_NAME AS c
         FROM   information_schema.KEY_COLUMN_USAGE
         WHERE  TABLE_SCHEMA = ?
           AND  REFERENCED_TABLE_NAME = 'users'
           AND  REFERENCED_COLUMN_NAME = ?`,
        [config.db.database, idCol]
    );

    return rows
        .filter((r) => IDENT.test(r.t) && IDENT.test(r.c))
        .map((r) => ({ table: r.t, column: r.c }));
}

/** MySQL's "you cannot delete this, something still points at it" error. */
const isForeignKeyError = (error) =>
    error?.errno === 1451 || /foreign key constraint fails/i.test(error?.message || '');

/**
 * MySQL puts the offending table and constraint in sqlMessage, not message.
 * Without it the alert just says "a foreign key constraint fails", which names
 * neither the table nor the column and is nearly useless at 3am.
 */
const describeSqlError = (error) => error?.sqlMessage || error?.message || String(error);

/**
 * Find the test account, delete its child rows, then delete the account.
 *
 * @returns {Promise<{found: boolean, userId?: number, deleted: object, dryRun: boolean}>}
 */
export async function resetTestAccount() {
    const email = config.student.email;
    assertSafeTarget(email);

    const conn = await getPool().getConnection();
    const deleted = {};

    try {
        const idCol = await usersIdColumn(conn);
        const [users] = await conn.query(
            `SELECT \`${idCol}\` AS id FROM users WHERE email = ?`,
            [email]
        );

        if (users.length === 0) {
            log.info(`no existing test account for ${email} — nothing to remove`);
            return { found: false, deleted, dryRun: config.db.dryRun };
        }

        // Exactly one account is expected. More than one means something is
        // not as assumed — a duplicated email, or a query that matched more
        // broadly than intended. Either way, stop: a monitor must never be the
        // thing that deletes an unexpected row.
        if (users.length > 1) {
            throw new Error(
                `${users.length} accounts share ${email}. Expected exactly one. ` +
                'Refusing to delete anything until this is resolved by hand.'
            );
        }

        const userIds = users.map((u) => u.id);
        log.info(`existing test account found: ${email} (user_id ${userIds.join(', ')})`);

        // Schema-driven list, plus anything explicitly configured (for tables
        // that reference users without a declared foreign key).
        const discovered = await discoverChildTables(conn, idCol);
        const extra = [];

        for (const { table, column } of config.db.cleanupTables) {
            if (!IDENT.test(table) || !IDENT.test(column)) {
                log.warn(`skipping malformed cleanup entry "${table}:${column}"`);
                continue;
            }
            if (discovered.some((d) => d.table === table)) continue;
            if (!(await tableExists(conn, table))) {
                log.warn(`cleanup table "${table}" does not exist in ${config.db.database} — skipped`);
                continue;
            }
            if (!(await columnExists(conn, table, column))) {
                log.warn(`cleanup table "${table}" has no column "${column}" — skipped`);
                continue;
            }
            extra.push({ table, column });
        }

        const targets = [...discovered, ...extra];
        log.info(
            `cleaning ${targets.length} related table(s) ` +
            `(${discovered.length} discovered from foreign keys, ${extra.length} configured)`
        );

        // Several passes, because a child table can itself be referenced by
        // another child. Deleting in an arbitrary order hits foreign key
        // errors; retrying what failed lets the graph unwind itself without
        // having to model the dependency order here.
        let pending = targets;

        for (let pass = 1; pass <= 5 && pending.length > 0; pass += 1) {
            const blocked = [];

            for (const { table, column } of pending) {
                const [countRows] = await conn.query(
                    `SELECT COUNT(*) AS n FROM \`${table}\` WHERE \`${column}\` IN (?)`,
                    [userIds]
                );
                const n = countRows[0]?.n || 0;

                if (n === 0) continue;
                deleted[table] = n;

                if (n > MAX_CHILD_ROWS_PER_TABLE) {
                    throw new Error(
                        `Refusing to delete: ${table} has ${n} rows for user ${userIds.join(', ')}, ` +
                        `which is above the safety limit of ${MAX_CHILD_ROWS_PER_TABLE}. ` +
                        'The test account should never own this many rows — check the data by hand.'
                    );
                }

                if (config.db.dryRun) {
                    log.info(`[dry-run] would delete ${n} row(s) from ${table}`);
                    continue;
                }

                try {
                    const [res] = await conn.query(
                        `DELETE FROM \`${table}\` WHERE \`${column}\` IN (?)`,
                        [userIds]
                    );
                    log.info(`deleted ${res.affectedRows} row(s) from ${table}`);
                } catch (error) {
                    if (isForeignKeyError(error)) {
                        // Something else still points at these rows; try again
                        // on the next pass once that table has been cleared.
                        blocked.push({ table, column });
                        continue;
                    }
                    throw error;
                }
            }

            if (blocked.length === pending.length) {
                throw new Error(
                    'Could not clear these tables — they reference each other in a way this ' +
                    `cannot unwind: ${blocked.map((b) => b.table).join(', ')}`
                );
            }
            pending = blocked;
        }

        if (config.db.dryRun) {
            log.info(`[dry-run] would delete ${userIds.length} row(s) from users`);
            deleted.users = userIds.length;
        } else {
            try {
                const [res] = await conn.query('DELETE FROM users WHERE email = ?', [email]);
                deleted.users = res.affectedRows;
                log.info(`deleted ${res.affectedRows} row(s) from users`);
            } catch (error) {
                if (isForeignKeyError(error)) {
                    // Name the blocking table. MySQL knows it; without this the
                    // alert would just say "a foreign key constraint fails".
                    throw new Error(
                        'Could not delete the test account — a table still references it, and it ' +
                        'has no declared foreign key so it was not discovered automatically. ' +
                        `Add it to DB_CLEANUP_TABLES. MySQL said: ${describeSqlError(error)}`
                    );
                }
                throw error;
            }
        }

        return { found: true, userId: userIds[0], deleted, dryRun: config.db.dryRun };
    } finally {
        conn.release();
    }
}

/**
 * The reset deletes by email. If MONITOR_PHONE happens to belong to a
 * *different* account, that row survives and registration then fails forever
 * with "Mobile number already exists" — which reads like a broken signup form
 * rather than a configuration problem.
 *
 * Deleting a stranger's row to free the number would be indefensible, so this
 * reports the conflict instead and asks for a different number.
 *
 * @returns {Promise<{available: boolean, heldBy?: {id: number, email: string}}>}
 */
export async function checkPhoneAvailable() {
    const conn = await getPool().getConnection();
    try {
        if (!(await columnExists(conn, 'users', 'phone'))) {
            log.debug('users.phone not present — skipping the phone conflict check');
            return { available: true };
        }

        const idCol = await usersIdColumn(conn);
        const [rows] = await conn.query(
            `SELECT \`${idCol}\` AS id, email FROM users WHERE phone = ? AND email <> ? LIMIT 1`,
            [config.student.phone, config.student.email]
        );

        if (rows.length === 0) return { available: true };
        return { available: false, heldBy: { id: rows[0].id, email: rows[0].email } };
    } finally {
        conn.release();
    }
}

/**
 * Flag the freshly created row so reporting can exclude it. Best-effort: a
 * schema without the column is a warning, not a failed check.
 */
export async function markAsTestAccount(userId) {
    if (!config.db.markTestAccount) return false;

    const conn = await getPool().getConnection();
    try {
        if (!(await columnExists(conn, 'users', 'is_test_account'))) {
            log.warn('users.is_test_account does not exist — skipping the test-account flag');
            return false;
        }
        const idCol = await usersIdColumn(conn);
        // Keyed on both the id and the email so a stale id can never update
        // somebody else's row.
        const [res] = await conn.query(
            `UPDATE users SET is_test_account = 1 WHERE \`${idCol}\` = ? AND email = ?`,
            [userId, config.student.email]
        );
        log.info(`flagged user ${userId} as a test account (${res.affectedRows} row updated)`);
        return res.affectedRows > 0;
    } finally {
        conn.release();
    }
}

/** Used by the api-health check: proves the DB itself is reachable. */
export async function ping() {
    const conn = await getPool().getConnection();
    try {
        await conn.query('SELECT 1');
        return true;
    } finally {
        conn.release();
    }
}
