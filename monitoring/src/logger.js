// src/logger.js
//
// Line-oriented logging that stays readable in `journalctl -f` and in a
// terminal. Every line is prefixed with an ISO timestamp and a level so the
// systemd journal stays greppable.

import config from './config.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };
const threshold = LEVELS[config.runtime.logLevel] ?? LEVELS.info;

const COLORS = {
    debug: '\x1b[90m',
    info: '\x1b[36m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m',
};

const useColor = process.stdout.isTTY;

function emit(level, scope, message, extra) {
    if (LEVELS[level] < threshold) return;
    const ts = new Date().toISOString();
    const tag = level.toUpperCase().padEnd(5);
    const head = useColor ? `${COLORS[level]}${tag}${COLORS.reset}` : tag;
    const scoped = scope ? ` [${scope}]` : '';
    const line = `${ts} ${head}${scoped} ${message}`;
    const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
    stream.write(line + '\n');
    if (extra !== undefined) {
        const body = extra instanceof Error ? (extra.stack || extra.message) : JSON.stringify(extra, null, 2);
        stream.write(`${' '.repeat(31)}${String(body).split('\n').join(`\n${' '.repeat(31)}`)}\n`);
    }
}

export function createLogger(scope = '') {
    return {
        debug: (m, e) => emit('debug', scope, m, e),
        info: (m, e) => emit('info', scope, m, e),
        warn: (m, e) => emit('warn', scope, m, e),
        error: (m, e) => emit('error', scope, m, e),
        child: (sub) => createLogger(scope ? `${scope}:${sub}` : sub),
    };
}

export const logger = createLogger();
export default logger;
