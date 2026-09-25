/*
 * KumoMTA — Platform settings.
 *
 * Five sections behind one tab bar: how the panel reaches the mail server, the
 * identity every message is sent under, the thresholds that colour IP health,
 * the warm-up ladder, and who gets told when something goes wrong.
 *
 * Nothing is written until the sticky save bar is used, and that bar only
 * appears once something actually changed.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  KumoStyles, kapi, usePolling, Card, Btn, Pill, Empty, Skel, Toggle, Tabs, Confirm, T, nf, fmtDt,
  IconServer, IconMail, IconShield, IconFlame, IconAlert, IconBolt, IconCheck, IconCopy,
  IconPlus, IconTrash, IconRefresh, IconGlobe, IconClock,
} from './kumoShared';

/* ── local layout rules ─────────────────────────────────────────────────── */
const SET_CSS = `
.km-set-grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fit, minmax(min(260px, 100%), 1fr)); }
.km-set-grid--3 { display:grid; gap:14px; grid-template-columns:repeat(auto-fit, minmax(min(200px, 100%), 1fr)); }
.km-set-help { font-size:11.5px; color:#64748b; line-height:1.6; margin-top:6px; }
.km-set-bar { position:sticky; bottom:12px; z-index:30; margin-top:18px; }
.km-set-mono { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; }
.km-set-warm td { padding:7px 8px; }
.km-set-warm input { width:100%; }
@media (max-width: 620px) { .km-set-bar { bottom:8px; } }
`;

const TABS = [
  { id: 'connection', label: 'Connection', icon: <IconServer size={14} /> },
  { id: 'sender', label: 'Sender', icon: <IconMail size={14} /> },
  { id: 'health', label: 'Health', icon: <IconShield size={14} /> },
  { id: 'warmup', label: 'Warmup', icon: <IconFlame size={14} /> },
  { id: 'alerts', label: 'Alerts', icon: <IconAlert size={14} /> },
];

const TEXT_KEYS = [
  'bridge_url', 'from_name', 'from_email', 'reply_to', 'bounce_domain', 'tracking_domain', 'public_base_url',
  'th_bounce_yellow', 'th_bounce_red', 'th_complaint_yellow', 'th_complaint_red',
  'th_deferral_yellow', 'th_deferral_red', 'recovery_hours', 'send_window_start', 'send_window_end',
  'spamhaus_dqs_key', 'alert_emails', 'warmup_auto',
];

const THRESHOLDS = [
  { key: 'th_bounce_yellow', label: 'Bounce — watch', unit: '%', tone: 'yellow', help: 'Bounce rate that turns an IP amber.' },
  { key: 'th_bounce_red', label: 'Bounce — critical', unit: '%', tone: 'red', help: 'Bounce rate that marks an IP critical and pauses warmup growth.' },
  { key: 'th_complaint_yellow', label: 'Complaint — watch', unit: '%', tone: 'yellow', help: 'Spam-complaint rate that turns an IP amber. Gmail expects under 0.10%.' },
  { key: 'th_complaint_red', label: 'Complaint — critical', unit: '%', tone: 'red', help: 'Complaint rate treated as an emergency — sending should stop.' },
  { key: 'th_deferral_yellow', label: 'Deferral — watch', unit: '%', tone: 'yellow', help: 'Share of attempts the provider asked us to retry later.' },
  { key: 'th_deferral_red', label: 'Deferral — critical', unit: '%', tone: 'red', help: 'Heavy deferrals mean throttling — usually reputation or rate limits.' },
];

const emptyForm = () => TEXT_KEYS.reduce((a, k) => { a[k] = ''; return a; }, {});

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch (e) { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e) { return false; }
}

function Field({ label, help, children }) {
  return (
    <div className="km-field">
      <label className="km-label">{label}</label>
      {children}
      {help && <div className="km-set-help">{help}</div>}
    </div>
  );
}

export default function KumoSettings() {
  const [tab, setTab] = useState('connection');
  const [form, setForm] = useState(emptyForm);
  const [plan, setPlan] = useState([]);
  const [token, setToken] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [maskedToken, setMaskedToken] = useState('');
  const [tokenSet, setTokenSet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [resetAsk, setResetAsk] = useState(false);
  const baseline = useRef('');

  const { data, loading, error, reload } = usePolling(() => kapi('settings_get', {}), []);

  /* hydrate the form whenever the server sends a fresh copy */
  useEffect(() => {
    if (!data) return;
    const s = data.settings || {};
    const next = emptyForm();
    TEXT_KEYS.forEach((k) => { next[k] = s[k] === undefined || s[k] === null ? '' : String(s[k]); });
    const rows = (data.warmup_plan || []).map((r, i) => ({
      key: r.id || `p${i}`,
      day_from: String(r.day_from ?? ''),
      day_to: String(r.day_to ?? ''),
      daily_cap: String(r.daily_cap ?? ''),
    }));
    setForm(next);
    setPlan(rows);
    setToken('');
    setMaskedToken(s.bridge_token || '');
    setTokenSet(String(s.bridge_token_set || '0') === '1');
    setWebhookUrl(data.webhook_url || '');
    baseline.current = JSON.stringify({ next, rows });
  }, [data]);

  const dirty = useMemo(
    () => !loading && baseline.current !== '' && (JSON.stringify({ next: form, rows: plan }) !== baseline.current || token !== ''),
    [form, plan, token, loading],
  );

  const set = useCallback((k, v) => setForm((f) => ({ ...f, [k]: v })), []);

  /* ── warmup ladder helpers ────────────────────────────────────────── */
  const addRow = () => {
    const last = plan[plan.length - 1];
    const from = last ? Number(last.day_to || 0) + 1 : 1;
    setPlan([...plan, {
      key: `n${Date.now()}`,
      day_from: String(from),
      day_to: String(from + 2),
      daily_cap: String(last ? Math.round(Number(last.daily_cap || 100) * 2) : 50),
    }]);
  };
  const setRow = (i, k, v) => setPlan(plan.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const delRow = (i) => setPlan(plan.filter((_, idx) => idx !== i));

  const ladder = useMemo(() => {
    const rows = plan
      .map((r) => ({ from: Number(r.day_from || 0), to: Number(r.day_to || 0), cap: Number(r.daily_cap || 0) }))
      .filter((r) => r.from > 0 && r.to >= r.from)
      .sort((a, b) => a.from - b.from);
    const points = [];
    rows.forEach((r) => {
      points.push({ day: r.from, cap: r.cap });
      if (r.to !== r.from) points.push({ day: r.to, cap: r.cap });
    });
    return points;
  }, [plan]);

  const planIssue = useMemo(() => {
    for (let i = 0; i < plan.length; i += 1) {
      const f = Number(plan[i].day_from);
      const t = Number(plan[i].day_to);
      const c = Number(plan[i].daily_cap);
      if (!Number.isFinite(f) || !Number.isFinite(t) || f < 1 || t < f) return `Row ${i + 1}: day range is not valid.`;
      if (!Number.isFinite(c) || c < 0) return `Row ${i + 1}: daily cap must be a number.`;
      if (i > 0 && f <= Number(plan[i - 1].day_to)) return `Row ${i + 1} overlaps the previous step.`;
    }
    return '';
  }, [plan]);

  /* ── actions ──────────────────────────────────────────────────────── */
  const save = async () => {
    if (planIssue) { toast.error(planIssue); setTab('warmup'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (token) payload.bridge_token = token;
      payload.warmup_plan = plan.map((r) => ({
        day_from: Number(r.day_from || 0),
        day_to: Number(r.day_to || 0),
        daily_cap: Number(r.daily_cap || 0),
      }));
      await kapi('settings_save', payload);
      toast.success('Settings saved');
      setToken('');
      reload(true);
    } catch (e) {
      toast.error(e.message || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  const doReset = () => {
    if (!baseline.current) return;
    try {
      const b = JSON.parse(baseline.current);
      setForm(b.next);
      setPlan(b.rows);
      setToken('');
      setResetAsk(false);
      toast.success('Changes reverted');
    } catch (e) { setResetAsk(false); }
  };

  const testBridge = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const params = { bridge_url: form.bridge_url };
      if (token) params.bridge_token = token;
      const d = await kapi('bridge_test', params);
      setTestResult({ ok: true, ...d });
      toast.success(`Bridge reachable in ${nf(d?.latency_ms || 0)} ms`);
    } catch (e) {
      setTestResult({ ok: false, message: e.message || 'Bridge unreachable' });
      toast.error(e.message || 'Bridge unreachable');
    } finally {
      setTesting(false);
    }
  };

  const copyWebhook = async () => {
    const ok = await copyText(webhookUrl);
    if (ok) toast.success('Webhook URL copied'); else toast.error('Clipboard blocked by the browser');
  };

  /* ── render ───────────────────────────────────────────────────────── */
  if (loading && !data) {
    return (
      <div className="km km-page">
        <KumoStyles />
        <div className="km-head"><div><h1 className="km-h1">Platform settings</h1><div className="km-sub">Loading…</div></div></div>
        <Card><div style={{ display: 'grid', gap: 12 }}>{[0, 1, 2, 3, 4, 5].map((i) => <Skel key={i} h={44} r={12} />)}</div></Card>
      </div>
    );
  }

  return (
    <div className="km">
      <KumoStyles />
      <style>{SET_CSS}</style>

      <div className="km-head">
        <div>
          <h1 className="km-h1">Platform settings</h1>
          <div className="km-sub">
            How the panel talks to KumoMTA, who mail comes from, and when an IP is considered unhealthy
            {data?.settings?.updated_at ? ` · updated ${fmtDt(data.settings.updated_at)}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {dirty && <Pill tone="yellow" pulse>Unsaved changes</Pill>}
          <Btn variant="ghost" size="sm" loading={loading} onClick={() => reload()} icon={<IconRefresh size={14} />}>Reload</Btn>
        </div>
      </div>

      {error && (
        <Card style={{ marginBottom: 12, borderLeft: `4px solid ${T.red}` }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: T.red, fontWeight: 600, fontSize: 13 }}>
            <IconAlert size={16} /> {error}
          </div>
        </Card>
      )}

      <div style={{ marginBottom: 16 }}>
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </div>

      {/* ══ CONNECTION ═══════════════════════════════════════════════ */}
      {tab === 'connection' && (
        <div className="km-grid km-fade" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
          <Card>
            <h2 className="km-h2" style={{ marginBottom: 4 }}>Bridge to the mail server</h2>
            <div className="km-sub" style={{ marginBottom: 16 }}>
              The small HTTP service that runs next to KumoMTA and accepts injections from this panel.
            </div>

            <div className="km-set-grid">
              <Field label="Bridge URL"
                help="Full base URL of the injection bridge, e.g. https://mail.nitrocampus.com:8008. Must be reachable from the web server this panel runs on.">
                <input className="km-input km-set-mono" value={form.bridge_url} placeholder="https://mail.example.com:8008"
                  onChange={(e) => set('bridge_url', e.target.value)} />
              </Field>

              <Field label="Bridge token"
                help={tokenSet
                  ? 'A token is already stored. Leave this blank to keep it; type a new one to replace it.'
                  : 'No token stored yet. Whatever you type here is sent to the bridge as its shared secret.'}>
                <input className="km-input km-set-mono" type="password" value={token} autoComplete="new-password"
                  placeholder={tokenSet ? (maskedToken || '••••••••••••') : 'Paste the shared secret'}
                  onChange={(e) => setToken(e.target.value)} />
                <div style={{ marginTop: 7 }}>
                  {token
                    ? <Pill tone="yellow">New token will be saved</Pill>
                    : <Pill tone={tokenSet ? 'green' : 'slate'}>{tokenSet ? 'Token stored' : 'Not configured'}</Pill>}
                </div>
              </Field>
            </div>

            <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
              <Btn variant="ghost" loading={testing} onClick={testBridge} icon={<IconBolt size={14} />}>Test connection</Btn>
              <span style={{ fontSize: 11.5, color: T.muted }}>
                Tests the URL above (and the new token, if you typed one) without saving anything.
              </span>
            </div>

            {testResult && (
              <div className="km-pop" style={{
                marginTop: 14, padding: '14px 16px', borderRadius: 14,
                background: testResult.ok ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.07)',
                border: `1px solid ${testResult.ok ? 'rgba(16,185,129,.28)' : 'rgba(239,68,68,.28)'}`,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 9, fontWeight: 800, fontSize: 13,
                  color: testResult.ok ? '#047857' : T.red,
                }}>
                  {testResult.ok ? <IconCheck size={15} /> : <IconAlert size={15} />}
                  {testResult.ok ? 'Bridge responded' : 'Bridge unreachable'}
                </div>
                {testResult.ok ? (
                  <div className="km-set-grid--3" style={{ marginTop: 12 }}>
                    {[
                      ['Latency', `${nf(testResult.latency_ms || 0)} ms`],
                      ['Queue size', nf(testResult.queue_size || 0)],
                      ['Scheduled', nf(testResult.scheduled || 0)],
                    ].map(([k, v]) => (
                      <div key={k} style={{ padding: '9px 11px', borderRadius: 11, background: 'rgba(255,255,255,.66)' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: T.faint }}>{k}</div>
                        <div style={{ marginTop: 3, fontSize: 15.5, fontWeight: 800, color: T.ink2 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: 7, fontSize: 12.2, color: T.red, lineHeight: 1.6, wordBreak: 'break-word' }}>
                    {testResult.message}
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="km-h2" style={{ marginBottom: 4 }}>Log-hook webhook</h2>
            <div className="km-sub" style={{ marginBottom: 14 }}>
              KumoMTA pushes every delivery, bounce, deferral and complaint to this URL. Without it the message log
              stays empty and IP health never updates.
            </div>
            {webhookUrl ? (
              <>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 13,
                  background: 'rgba(15,23,42,.045)', border: `1px solid ${T.line2}`, flexWrap: 'wrap',
                }}>
                  <span style={{ color: T.brand, display: 'flex', flexShrink: 0 }}><IconGlobe size={15} /></span>
                  <span className="km-set-mono" style={{ flex: '1 1 200px', minWidth: 0, wordBreak: 'break-all', color: T.ink2 }}>
                    {webhookUrl}
                  </span>
                  <Btn variant="ghost" size="sm" onClick={copyWebhook} icon={<IconCopy size={13} />}>Copy</Btn>
                </div>
                <div className="km-set-help">
                  Configure this as the <strong>log-hook URL</strong> in KumoMTA on the mail server
                  (the <span className="km-set-mono">log_hooks</span> / webhook target in your policy file), then reload
                  the Kumo configuration. It is read-only here because the panel derives it from the public base URL.
                </div>
              </>
            ) : (
              <Empty title="No webhook URL yet" sub="Set the public base URL on the Sender tab and save — the webhook URL is derived from it." />
            )}
          </Card>
        </div>
      )}

      {/* ══ SENDER ═══════════════════════════════════════════════════ */}
      {tab === 'sender' && (
        <Card className="km-fade">
          <h2 className="km-h2" style={{ marginBottom: 4 }}>Sender identity</h2>
          <div className="km-sub" style={{ marginBottom: 16 }}>
            The defaults every campaign inherits. Each domain below must have its own DNS records in place.
          </div>
          <div className="km-set-grid">
            <Field label="From name" help="The display name recipients see in their inbox, e.g. “Internship Studio”.">
              <input className="km-input" value={form.from_name} placeholder="Internship Studio"
                onChange={(e) => set('from_name', e.target.value)} />
            </Field>
            <Field label="From email" help="The envelope sender. Its domain needs SPF and DKIM pointing at your KumoMTA IPs.">
              <input className="km-input km-set-mono" type="email" value={form.from_email} placeholder="hello@example.com"
                onChange={(e) => set('from_email', e.target.value)} />
            </Field>
            <Field label="Reply-to" help="Where human replies land. Leave blank to use the from address.">
              <input className="km-input km-set-mono" type="email" value={form.reply_to} placeholder="support@example.com"
                onChange={(e) => set('reply_to', e.target.value)} />
            </Field>
            <Field label="Bounce domain" help="Return-path domain used for VERP bounce addresses. Must have an MX record reaching KumoMTA.">
              <input className="km-input km-set-mono" value={form.bounce_domain} placeholder="bounce.example.com"
                onChange={(e) => set('bounce_domain', e.target.value)} />
            </Field>
            <Field label="Tracking domain" help="CNAME used for open pixels and click redirects. Keeping it on your own domain protects reputation.">
              <input className="km-input km-set-mono" value={form.tracking_domain} placeholder="track.example.com"
                onChange={(e) => set('tracking_domain', e.target.value)} />
            </Field>
            <Field label="Public base URL" help="Where this panel's public endpoints live. Unsubscribe links, the tracking pixel and the log-hook webhook are all built from it.">
              <input className="km-input km-set-mono" value={form.public_base_url} placeholder="https://panel.example.com"
                onChange={(e) => set('public_base_url', e.target.value)} />
            </Field>
          </div>
        </Card>
      )}

      {/* ══ HEALTH ═══════════════════════════════════════════════════ */}
      {tab === 'health' && (
        <div className="km-grid km-fade" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
          <Card>
            <h2 className="km-h2" style={{ marginBottom: 4 }}>Health thresholds</h2>
            <div className="km-sub" style={{ marginBottom: 16 }}>
              These decide the colour of every IP on the dashboard. Rates are percentages of messages attempted in the
              scoring window — an IP turns amber at the “watch” value and critical at the “critical” value.
            </div>
            <div className="km-set-grid">
              {THRESHOLDS.map((t) => (
                <div key={t.key} style={{
                  padding: '13px 14px', borderRadius: 14,
                  background: t.tone === 'red' ? 'rgba(239,68,68,.06)' : 'rgba(245,158,11,.07)',
                  border: `1px solid ${t.tone === 'red' ? 'rgba(239,68,68,.2)' : 'rgba(245,158,11,.22)'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span className="km-label" style={{ margin: 0 }}>{t.label}</span>
                    <Pill tone={t.tone}>{t.tone === 'red' ? 'Critical' : 'Watch'}</Pill>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input className="km-input km-set-mono" type="number" step="0.01" min="0" value={form[t.key]}
                      onChange={(e) => set(t.key, e.target.value)} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: T.muted }}>{t.unit}</span>
                  </div>
                  <div className="km-set-help">{t.help}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="km-h2" style={{ marginBottom: 4 }}>Recovery &amp; send window</h2>
            <div className="km-sub" style={{ marginBottom: 16 }}>
              How long a bad IP has to behave before it is trusted again, and the hours of the day it may send in.
            </div>
            <div className="km-set-grid--3">
              <Field label="Recovery hours" help="Consecutive clean hours an IP needs before its health can climb back to healthy.">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input className="km-input km-set-mono" type="number" min="0" step="1" value={form.recovery_hours}
                    onChange={(e) => set('recovery_hours', e.target.value)} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: T.muted, whiteSpace: 'nowrap' }}>hours</span>
                </div>
              </Field>
              <Field label="Send window — start" help="Local hour (0–23) the scheduler may begin sending.">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input className="km-input km-set-mono" type="number" min="0" max="23" step="1" value={form.send_window_start}
                    onChange={(e) => set('send_window_start', e.target.value)} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: T.muted }}>:00</span>
                </div>
              </Field>
              <Field label="Send window — end" help="Local hour (0–23) sending must stop. Campaigns queued outside the window wait.">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input className="km-input km-set-mono" type="number" min="0" max="23" step="1" value={form.send_window_end}
                    onChange={(e) => set('send_window_end', e.target.value)} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: T.muted }}>:00</span>
                </div>
              </Field>
            </div>
            <div style={{
              marginTop: 6, display: 'flex', gap: 9, alignItems: 'center', fontSize: 11.5, color: T.muted,
              background: 'rgba(99,102,241,.06)', padding: '9px 12px', borderRadius: 11,
            }}>
              <span style={{ color: T.brand, display: 'flex' }}><IconClock size={14} /></span>
              Sending between {form.send_window_start || '0'}:00 and {form.send_window_end || '0'}:00 server time.
            </div>
          </Card>
        </div>
      )}

      {/* ══ WARMUP ═══════════════════════════════════════════════════ */}
      {tab === 'warmup' && (
        <div className="km-grid km-fade" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <h2 className="km-h2">Warm-up ladder</h2>
                <div className="km-sub" style={{ marginTop: 4 }}>
                  The daily cap a new IP is allowed, by age in days. Raising volume gradually is what keeps mailbox
                  providers from treating a fresh IP as a spam source.
                </div>
              </div>
              <Toggle checked={String(form.warmup_auto) === '1' || form.warmup_auto === true}
                onChange={(v) => set('warmup_auto', v ? '1' : '0')}
                label="Automatic warmup"
                hint="Apply this ladder to every IP automatically" />
            </div>

            <div style={{ height: 232, marginTop: 16 }}>
              {ladder.length < 2 ? (
                <Empty icon={<IconFlame size={20} />} title="Add at least two steps"
                  sub="The preview chart appears once the ladder has a couple of valid rows." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ladder} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                    <defs>
                      <linearGradient id="kmWarm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(15,23,42,.08)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                      tickFormatter={(d) => `D${d}`} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={58}
                      tickFormatter={(v) => nf(v)} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(15,23,42,.08)', fontSize: 12 }}
                      formatter={(v) => [`${nf(v)} / day`, 'Cap']} labelFormatter={(d) => `Day ${d}`} />
                    <Area type="stepAfter" dataKey="cap" stroke="#f59e0b" strokeWidth={2.4} fill="url(#kmWarm)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card pad={false} style={{ overflow: 'hidden' }}>
            <div style={{
              padding: '14px 18px', borderBottom: `1px solid ${T.line}`, display: 'flex',
              justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            }}>
              <h2 className="km-h2">Ladder steps</h2>
              <Btn size="sm" variant="ghost" onClick={addRow} icon={<IconPlus size={13} />}>Add step</Btn>
            </div>

            {plan.length === 0 ? (
              <Empty icon={<IconFlame size={20} />} title="No warm-up steps defined"
                sub="Without a ladder, new IPs are not capped at all — which is the fastest way to get blocklisted."
                action={<Btn onClick={addRow} icon={<IconPlus size={14} />}>Add the first step</Btn>} />
            ) : (
              <div className="km-tablewrap km-scroll">
                <table className="km-table km-set-warm">
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>Day from</th>
                      <th style={{ width: 110 }}>Day to</th>
                      <th>Daily cap</th>
                      <th style={{ width: 56 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {plan.map((r, i) => (
                      <tr key={r.key}>
                        <td>
                          <input className="km-input km-set-mono" type="number" min="1" step="1" value={r.day_from}
                            onChange={(e) => setRow(i, 'day_from', e.target.value)} />
                        </td>
                        <td>
                          <input className="km-input km-set-mono" type="number" min="1" step="1" value={r.day_to}
                            onChange={(e) => setRow(i, 'day_to', e.target.value)} />
                        </td>
                        <td>
                          <input className="km-input km-set-mono" type="number" min="0" step="1" value={r.daily_cap}
                            onChange={(e) => setRow(i, 'daily_cap', e.target.value)} />
                        </td>
                        <td>
                          <Btn variant="ghost" size="sm" aria-label={`Remove step ${i + 1}`} style={{ color: T.red }}
                            onClick={() => delRow(i)} icon={<IconTrash size={13} />} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {planIssue && (
              <div style={{
                margin: '12px 18px 16px', padding: '9px 12px', borderRadius: 11, fontSize: 12, fontWeight: 600,
                color: T.red, background: 'rgba(239,68,68,.07)', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <IconAlert size={14} /> {planIssue}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ══ ALERTS ═══════════════════════════════════════════════════ */}
      {tab === 'alerts' && (
        <Card className="km-fade">
          <h2 className="km-h2" style={{ marginBottom: 4 }}>Alerting &amp; blocklist monitoring</h2>
          <div className="km-sub" style={{ marginBottom: 16 }}>
            Who to wake up when an IP crosses a threshold, and the key used to check your IPs against Spamhaus.
          </div>
          <div className="km-set-grid">
            <Field label="Alert emails"
              help="Comma-separated. Everyone listed gets an email when an IP turns critical, a blocklisting is detected, or the bridge goes offline.">
              <input className="km-input" value={form.alert_emails} placeholder="ops@example.com, founder@example.com"
                onChange={(e) => set('alert_emails', e.target.value)} />
            </Field>
            <Field label="Spamhaus DQS key"
              help="Your Data Query Service key. Without it, blocklist checks fall back to the public mirrors, which rate-limit hard and will silently stop answering.">
              <input className="km-input km-set-mono" type="password" autoComplete="new-password" value={form.spamhaus_dqs_key}
                placeholder="Paste your DQS key" onChange={(e) => set('spamhaus_dqs_key', e.target.value)} />
            </Field>
          </div>
          <div style={{
            marginTop: 4, padding: '11px 13px', borderRadius: 12, background: 'rgba(99,102,241,.06)',
            fontSize: 11.5, color: T.muted, lineHeight: 1.7,
          }}>
            Alerts are raised by the health scorer, so they follow the thresholds set on the <strong>Health</strong> tab.
            Leave the email list empty to record alerts in the dashboard only.
          </div>
        </Card>
      )}

      {/* ══ sticky save bar ══════════════════════════════════════════ */}
      {dirty && (
        <div className="km-set-bar km-fade">
          <Card style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
            background: 'rgba(255,255,255,.92)', boxShadow: '0 -2px 0 rgba(255,255,255,.7), 0 26px 50px -22px rgba(15,23,42,.6)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={{
                width: 30, height: 30, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(245,158,11,.18), rgba(239,68,68,.16))', color: T.amber,
              }}><IconAlert size={15} /></span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.ink2 }}>You have unsaved changes</div>
                <div style={{ fontSize: 11.5, color: T.muted }}>
                  {token ? 'Includes a new bridge token. ' : ''}Nothing is applied until you save.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <Btn variant="ghost" onClick={() => setResetAsk(true)}>Reset</Btn>
              <Btn variant="success" loading={saving} onClick={save} icon={<IconCheck size={14} />}>Save changes</Btn>
            </div>
          </Card>
        </div>
      )}

      <Confirm
        open={resetAsk}
        title="Revert your changes?"
        message="Every field goes back to the values currently stored on the server, including the warm-up ladder and any token you typed."
        confirmLabel="Revert changes"
        onCancel={() => setResetAsk(false)}
        onConfirm={doReset}
      />

      <div style={{ height: 20 }} />
    </div>
  );
}
