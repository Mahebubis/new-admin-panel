// src/utils/artifacts.js
//
// When a check fails the alert must carry enough to diagnose without SSH:
// a screenshot of what the synthetic student was looking at, the page HTML,
// and the browser console/network errors leading up to it.

import fs from 'node:fs/promises';
import path from 'node:path';
import config from '../config.js';
import { createLogger } from '../logger.js';

const log = createLogger('artifacts');

export async function ensureArtifactDir(runId) {
    const dir = path.join(config.runtime.artifactDir, runId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

export async function writeText(dir, filename, contents) {
    const file = path.join(dir, filename);
    await fs.writeFile(file, contents, 'utf8');
    return { type: 'text', name: filename, path: file };
}

/**
 * Screenshot + HTML + console log for a page, named after the check and step.
 * Never throws: a failure to capture evidence must not mask the real failure.
 */
export async function capturePage(page, dir, basename, { consoleLines = [] } = {}) {
    const out = [];
    if (!page || page.isClosed?.()) return out;

    const safe = basename.replace(/[^a-z0-9._-]/gi, '_');

    try {
        const file = path.join(dir, `${safe}.png`);
        await page.screenshot({ path: file, fullPage: true, timeout: 15000 });
        out.push({ type: 'image', name: `${safe}.png`, path: file });
    } catch (error) {
        log.warn(`screenshot failed for ${safe}: ${error.message}`);
    }

    try {
        const html = await page.content();
        out.push(await writeText(dir, `${safe}.html`, html));
    } catch (error) {
        log.warn(`html capture failed for ${safe}: ${error.message}`);
    }

    if (consoleLines.length) {
        try {
            out.push(await writeText(dir, `${safe}.console.log`, consoleLines.join('\n')));
        } catch (error) {
            log.warn(`console capture failed for ${safe}: ${error.message}`);
        }
    }

    return out;
}

/** Housekeeping so a long-running box does not fill its disk with screenshots. */
export async function pruneArtifacts() {
    const { artifactDir, artifactRetentionDays } = config.runtime;
    if (!artifactRetentionDays || artifactRetentionDays <= 0) return 0;

    const cutoff = Date.now() - artifactRetentionDays * 24 * 60 * 60 * 1000;
    let removed = 0;

    let entries;
    try {
        entries = await fs.readdir(artifactDir, { withFileTypes: true });
    } catch {
        return 0;
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const full = path.join(artifactDir, entry.name);
        try {
            const stat = await fs.stat(full);
            if (stat.mtimeMs < cutoff) {
                await fs.rm(full, { recursive: true, force: true });
                removed += 1;
            }
        } catch {
            // A directory that vanished under us is already "pruned".
        }
    }

    if (removed) log.info(`pruned ${removed} artifact folder(s) older than ${artifactRetentionDays}d`);
    return removed;
}
