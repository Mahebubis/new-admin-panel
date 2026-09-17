// src/alert/template.js
//
// The alert body. It follows the shape the spec asks for — what broke, when,
// which step, the error, and the evidence — and leads with the failing step so
// the subject line and first line of the preview are already actionable on a
// phone.

const esc = (s) =>
    String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const IST = (iso) =>
    new Date(iso).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });

const duration = (ms) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

// ── Journey funnel ─────────────────────────────────────────────────────────
//
// Rendered as a table, not flexbox: Gmail, Outlook and most mobile clients
// still strip or mangle modern layout in email bodies, and a broken alert is
// worse than a plain one.

const FUNNEL_STYLE = {
    pass:     { mark: '&#10003;', bg: '#16a34a', fg: '#ffffff', label: '#0f172a', note: '#64748b' },
    fail:     { mark: '&#10007;', bg: '#dc2626', fg: '#ffffff', label: '#b91c1c', note: '#b91c1c' },
    blocked:  { mark: '&#8210;',  bg: '#cbd5e1', fg: '#475569', label: '#64748b', note: '#94a3b8' },
    untested: { mark: '&#8722;',  bg: '#e2e8f0', fg: '#64748b', label: '#64748b', note: '#94a3b8' },
    unknown:  { mark: '?',        bg: '#e2e8f0', fg: '#64748b', label: '#64748b', note: '#94a3b8' },
};

const STATUS_WORD = {
    pass: 'passed',
    fail: 'FAILED',
    blocked: 'not reached',
    untested: 'not tested',
    unknown: 'no data',
};

function funnelHtml(funnel) {
    if (!funnel || !funnel.stages?.length) return '';

    const rows = funnel.stages.map((s, i) => {
        const st = FUNNEL_STYLE[s.status] || FUNNEL_STYLE.unknown;
        const last = i === funnel.stages.length - 1;

        // The connector is drawn as a bordered cell under the icon, so the
        // chain reads as one flow rather than a list of unrelated rows.
        const connector = last
            ? ''
            : `<tr>
                 <td style="width:28px;text-align:center;padding:0;">
                   <div style="width:2px;height:14px;background:#e2e8f0;margin:0 auto;"></div>
                 </td>
                 <td></td>
               </tr>`;

        const note = s.status === 'fail' && (s.error || s.failedStep)
            ? esc(s.failedStep ? `${s.failedStep} — ${s.error || ''}` : s.error).slice(0, 220)
            : esc(s.detail);

        const timing = s.ms !== null && s.ms !== undefined && s.status === 'pass'
            ? ` <span style="color:#94a3b8;">(${duration(s.ms)})</span>`
            : '';

        const staleTag = s.stale
            ? ` <span style="color:#94a3b8;font-size:11px;">· last checked ${esc(ago(s.at))}</span>`
            : '';

        return `<tr>
            <td style="width:28px;padding:0;vertical-align:top;">
              <div style="width:22px;height:22px;line-height:22px;border-radius:11px;text-align:center;
                          background:${st.bg};color:${st.fg};font-size:13px;font-weight:700;">${st.mark}</div>
            </td>
            <td style="padding:0 0 0 10px;vertical-align:top;">
              <div style="font-size:14px;font-weight:600;color:${st.label};line-height:22px;">
                ${esc(s.label)}
                <span style="font-size:11px;font-weight:700;color:${st.note};letter-spacing:.03em;">
                  ${STATUS_WORD[s.status] || ''}
                </span>${timing}
              </div>
              <div style="font-size:12px;color:${st.note};line-height:1.5;padding-bottom:2px;">
                ${note}${staleTag}
              </div>
            </td>
          </tr>
          ${connector}`;
    }).join('');

    return `
    <h3 style="font-size:14px;color:#334155;margin:24px 0 10px 0;">Student journey</h3>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
      ${rows}
    </table>`;
}

function funnelText(funnel) {
    if (!funnel || !funnel.stages?.length) return '';
    const marks = { pass: '[OK]  ', fail: '[FAIL]', blocked: '[--]  ', untested: '[  ]  ', unknown: '[?]   ' };
    const lines = ['', 'Student journey:'];
    for (const s of funnel.stages) {
        const detail = s.status === 'fail' && s.error
            ? ` — ${s.failedStep ? `${s.failedStep}: ` : ''}${s.error}`
            : s.status === 'untested' ? ` — ${s.detail}` : '';
        // Without this, a stage that passed 15 minutes ago reads as though it
        // were just verified — during an outage that is actively misleading.
        const stale = s.stale ? ` (last checked ${ago(s.at)})` : '';
        lines.push(`  ${marks[s.status] || '[?]   '} ${s.label}${stale}${detail}`);
        if (s !== funnel.stages[funnel.stages.length - 1]) lines.push('     |');
    }
    return lines.join('\n');
}

/** Relative time, kept local so the template has no imports of its own. */
function ago(iso) {
    if (!iso) return 'unknown';
    const secs = Math.floor((Date.now() - Date.parse(iso)) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
}

export function subjectFor(result, { action, consecutiveFailures }) {
    if (action === 'recovered') return `RECOVERED: ${result.name} is working again`;
    const prefix = action === 'remind' ? 'STILL FAILING' : 'CRITICAL';
    const step = result.failedStep ? ` — ${result.failedStep}` : '';
    const count = action === 'remind' ? ` (${consecutiveFailures} runs)` : '';
    return `${prefix}: ${result.name} Failed${step}${count}`;
}

export function textBody(result, meta) {
    const lines = [];

    if (meta.action === 'recovered') {
        lines.push(`RECOVERED: ${result.name}`);
        lines.push(`Time: ${IST(result.startedAt)} IST`);
        if (meta.downSince) lines.push(`Was failing since: ${IST(meta.downSince)} IST`);
        lines.push('');
        lines.push('The check passed on its most recent run. No further action needed.');
        return lines.join('\n');
    }

    lines.push(`${meta.action === 'remind' ? 'STILL FAILING' : 'CRITICAL'}: ${result.name} Failed`);
    lines.push(`Time: ${IST(result.startedAt)} IST`);
    lines.push(`Failed step: ${result.failedStep || 'unknown'}`);
    lines.push(`Error: ${result.error || 'unknown'}`);
    lines.push(`Attempts: ${result.attempts || 1} (retried before alerting)`);
    lines.push(`Consecutive failing runs: ${meta.consecutiveFailures}`);
    if (meta.downSince) lines.push(`Failing since: ${IST(meta.downSince)} IST`);
    if (meta.lastOkAt) lines.push(`Last successful run: ${IST(meta.lastOkAt)} IST`);
    lines.push(`Total time: ${duration(result.durationMs)}`);

    if (meta.funnel) {
        lines.push('');
        lines.push(meta.funnelHeadline || '');
        lines.push(funnelText(meta.funnel));
    }

    lines.push('');
    lines.push('Steps:');
    for (const step of result.steps || []) {
        const mark = step.ok ? 'PASS' : step.soft ? 'WARN' : 'FAIL';
        lines.push(`  [${mark}] ${step.name} (${duration(step.ms)})${step.error ? ` — ${step.error}` : ''}`);
    }

    if (Object.keys(result.context || {}).length) {
        lines.push('');
        lines.push('Context:');
        for (const [key, value] of Object.entries(result.context)) {
            lines.push(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
        }
    }

    if ((result.artifacts || []).length) {
        lines.push('');
        lines.push('Attached: ' + result.artifacts.map((a) => a.name).join(', '));
    }

    lines.push('');
    lines.push(`Run id: ${meta.runId}`);
    lines.push(`Monitor host: ${meta.host}`);
    return lines.join('\n');
}

export function htmlBody(result, meta) {
    const recovered = meta.action === 'recovered';
    const accent = recovered ? '#16a34a' : '#dc2626';
    const heading = recovered
        ? `RECOVERED: ${esc(result.name)}`
        : `${meta.action === 'remind' ? 'STILL FAILING' : 'CRITICAL'}: ${esc(result.name)} Failed`;

    const row = (label, value) =>
        value === undefined || value === null || value === ''
            ? ''
            : `<tr>
                 <td style="padding:6px 12px 6px 0;color:#64748b;white-space:nowrap;vertical-align:top;">${esc(label)}</td>
                 <td style="padding:6px 0;color:#0f172a;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${esc(value)}</td>
               </tr>`;

    const steps = (result.steps || [])
        .map((step) => {
            const color = step.ok ? '#16a34a' : step.soft ? '#d97706' : '#dc2626';
            const mark = step.ok ? '&#10003;' : step.soft ? '!' : '&#10007;';
            return `<li style="margin:0 0 6px 0;color:#0f172a;">
                      <span style="color:${color};font-weight:700;">${mark}</span>
                      ${esc(step.name)}
                      <span style="color:#94a3b8;">(${duration(step.ms)})</span>
                      ${step.error ? `<div style="color:#b91c1c;font-size:13px;margin-top:2px;">${esc(step.error)}</div>` : ''}
                    </li>`;
        })
        .join('');

    const context = Object.entries(result.context || {})
        .map(([k, v]) => row(k, typeof v === 'object' ? JSON.stringify(v) : v))
        .join('');

    return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:${accent};color:#ffffff;padding:18px 24px;">
      <div style="font-size:18px;font-weight:700;">${heading}</div>
      <div style="font-size:13px;opacity:.9;margin-top:4px;">${esc(IST(result.startedAt))} IST</div>
    </div>

    <div style="padding:20px 24px;">
      ${recovered
            ? `<p style="margin:0 0 16px 0;color:#0f172a;">The check passed on its most recent run.${meta.downSince ? ` It had been failing since <strong>${esc(IST(meta.downSince))} IST</strong>.` : ''}</p>`
            : `<table style="border-collapse:collapse;font-size:14px;width:100%;">
                 ${row('Failed step', result.failedStep || 'unknown')}
                 ${row('Error', result.error || 'unknown')}
                 ${row('Attempts', `${result.attempts || 1} (retried before alerting)`)}
                 ${row('Consecutive failures', meta.consecutiveFailures)}
                 ${meta.downSince ? row('Failing since', `${IST(meta.downSince)} IST`) : ''}
                 ${meta.lastOkAt ? row('Last success', `${IST(meta.lastOkAt)} IST`) : ''}
                 ${row('Total time', duration(result.durationMs))}
               </table>`
        }

      ${meta.funnel
            ? `<div style="margin-top:20px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                 <div style="font-size:13px;font-weight:600;color:#0f172a;">${esc(meta.funnelHeadline || '')}</div>
               </div>
               ${funnelHtml(meta.funnel)}`
            : ''
        }

      <h3 style="font-size:14px;color:#334155;margin:24px 0 8px 0;">Steps in this check</h3>
      <ul style="margin:0;padding-left:18px;font-size:14px;list-style:none;">${steps}</ul>

      ${context
            ? `<h3 style="font-size:14px;color:#334155;margin:22px 0 8px 0;">Context</h3>
               <table style="border-collapse:collapse;font-size:13px;width:100%;">${context}</table>`
            : ''
        }

      ${(result.artifacts || []).length
            ? `<p style="margin:22px 0 0 0;font-size:13px;color:#64748b;">
                 Screenshot and page HTML are attached to this email.
               </p>`
            : ''
        }
    </div>

    <div style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
      Run <code>${esc(meta.runId)}</code> &middot; monitor host <code>${esc(meta.host)}</code>
    </div>
  </div>
</body></html>`;
}
