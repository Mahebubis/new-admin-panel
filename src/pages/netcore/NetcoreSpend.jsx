import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

/*
 * Spend control — the money side of sending, for both channels on one screen.
 *
 * WHY ONE SCREEN FOR TWO CHANNELS
 * The question people actually ask is "what is this account spending on messaging this month",
 * and that question has no per-channel answer. Two screens would give two half-answers and a
 * total that nobody adds up.
 *
 * FOUR THINGS LIVE HERE, AND THEY ARE DELIBERATELY DIFFERENT KINDS OF THING
 *
 *   Caps        a hard ceiling. When it is reached, campaigns pause with their audience intact
 *               and journey messages are suppressed so the student still moves on. This is the
 *               only control on the page that can stop a send.
 *
 *   Prices      what this account is actually charged. Nothing can be capped without them, and
 *               they are editable because a rate card is a contract, not a constant: Meta
 *               re-prices by country, and an SES or Elastic Email plan changes when it is renewed.
 *
 *   Unusual     a watchdog, not a cap. Almost every expensive accident stays under the cap while
 *               spend      it happens — it just does a month's spending in an afternoon. This
 *               compares today, and the last hour, against the days before them.
 *
 *   Weekly      what the week consumed and how the campaigns did, side by side. Cost without
 *   reports     performance is how a cheap campaign nobody reads gets mistaken for a good one.
 *
 * Everything here reads /api/campaigns/spend.php. Building a report on this screen never delivers
 * it anywhere — the weekly cron does that — so opening the page can never post to the team's
 * Slack channel by accident.
 */

const API  = '/api/campaigns/spend.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

const TABS = [
  ['caps',    'Caps & live spend'],
  ['prices',  'Prices'],
  ['unusual', 'Unusual spend'],
  ['reports', 'Weekly reports'],
];

const CHANNELS = [
  ['whatsapp', 'WhatsApp'],
  ['email',    'Email'],
];

const WA_CATEGORIES = ['marketing', 'utility', 'authentication', 'service'];

const nUS = n => Number(n || 0).toLocaleString('en-US');
const money = (cur, n) => `${cur || 'INR'} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CSS = `
.sp { max-width: 1080px; }
.sp-h1 { font-size:19px; font-weight:780; color:#101828; margin:0 0 6px; letter-spacing:-.2px; }
.sp-lede { font-size:13px; color:#667085; margin:0 0 20px; line-height:1.65; max-width:760px; }
.sp-tabs { display:flex; gap:2px; border-bottom:1px solid #e4e7ec; margin-bottom:22px; flex-wrap:wrap; }
.sp-tab { padding:10px 18px; font-size:13px; font-weight:650; color:#475467; background:none; border:0;
  border-bottom:3px solid transparent; margin-bottom:-1px; cursor:pointer; font-family:inherit;
  transition:color 160ms, border-color 160ms; }
.sp-tab:hover { color:#4f46e5; }
.sp-tab[aria-selected="true"] { color:#4f46e5; border-bottom-color:#4f46e5; }

.sp-card { background:#fff; border:1px solid #e4e7ec; border-radius:12px; padding:20px 22px; margin-bottom:16px;
  box-shadow:0 1px 2px rgba(16,24,40,.05); }
.sp-card h2 { font-size:14.5px; font-weight:750; color:#101828; margin:0 0 4px; display:flex; align-items:center; gap:9px; }
.sp-card p.hint { font-size:12.5px; color:#667085; margin:0 0 16px; line-height:1.6; max-width:680px; }
.sp-head { display:flex; align-items:flex-start; gap:16px; margin-bottom:4px; }
.sp-head > div:first-child { flex:1; min-width:0; }

.sp-sw { position:relative; width:42px; height:24px; border-radius:999px; border:0; padding:0; flex:none;
  background:#d0d5dd; cursor:pointer; transition:background 200ms cubic-bezier(.4,0,.2,1); }
.sp-sw::after { content:''; position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%;
  background:#fff; box-shadow:0 1px 3px rgba(16,24,40,.25); transition:transform 220ms cubic-bezier(.4,0,.2,1); }
.sp-sw[aria-checked="true"] { background:#4f46e5; }
.sp-sw[aria-checked="true"]::after { transform:translateX(18px); }
.sp-sw:focus-visible { outline:2px solid #4f46e5; outline-offset:3px; }
.sp-sw:disabled { opacity:.45; cursor:not-allowed; }

.sp-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:14px 18px; margin-bottom:6px; }
.sp-f label { display:block; font-size:11.5px; font-weight:680; color:#475467; margin-bottom:5px; letter-spacing:.01em; }
.sp-f input, .sp-f select { width:100%; box-sizing:border-box; padding:8px 11px; font-size:13px; font-family:inherit;
  color:#101828; background:#fff; border:1.5px solid #d0d5dd; border-radius:8px; transition:border-color 150ms, box-shadow 150ms; }
.sp-f input:focus, .sp-f select:focus { outline:none; border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,.12); }
.sp-f small { display:block; font-size:11px; color:#98a2b3; margin-top:4px; line-height:1.45; }

.sp-btn { padding:9px 18px; font-size:13px; font-weight:680; font-family:inherit; border-radius:8px; cursor:pointer;
  border:1.5px solid transparent; background:#4f46e5; color:#fff; transition:filter 150ms, transform 120ms; }
.sp-btn:hover:not(:disabled) { filter:brightness(1.08); }
.sp-btn:active:not(:disabled) { transform:translateY(1px); }
.sp-btn:disabled { opacity:.5; cursor:not-allowed; }
.sp-btn.ghost { background:#fff; color:#344054; border-color:#d0d5dd; }
.sp-btn.ghost:hover:not(:disabled) { background:#f9fafb; }
.sp-actions { display:flex; gap:10px; align-items:center; margin-top:18px; flex-wrap:wrap; }

.sp-meter { height:9px; border-radius:999px; background:#f2f4f7; overflow:hidden; margin:10px 0 6px; }
.sp-meter > span { display:block; height:100%; border-radius:999px; transition:width 420ms cubic-bezier(.4,0,.2,1); }
.sp-stat { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-bottom:4px; }
.sp-stat > div { background:#f9fafb; border:1px solid #eef0f3; border-radius:10px; padding:11px 13px; }
.sp-stat b { display:block; font-size:17px; font-weight:760; color:#101828; letter-spacing:-.2px; }
.sp-stat span { font-size:11.5px; color:#667085; }

.sp-pill { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:700; padding:3px 9px;
  border-radius:999px; letter-spacing:.02em; }
.sp-table { width:100%; border-collapse:collapse; font-size:12.5px; }
.sp-table th { text-align:left; font-size:11px; font-weight:700; color:#667085; text-transform:uppercase;
  letter-spacing:.04em; padding:8px 10px; border-bottom:1px solid #e4e7ec; white-space:nowrap; }
.sp-table td { padding:9px 10px; border-bottom:1px solid #f2f4f7; color:#344054; vertical-align:top; }
.sp-table tr:last-child td { border-bottom:0; }
.sp-table input { width:100%; box-sizing:border-box; padding:6px 9px; font-size:12.5px; font-family:inherit;
  border:1.5px solid #d0d5dd; border-radius:7px; }
.sp-table input:focus { outline:none; border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,.12); }
.sp-empty { font-size:12.5px; color:#98a2b3; padding:18px 2px; line-height:1.6; }
.sp-note { font-size:12.5px; line-height:1.65; border-radius:10px; padding:12px 14px; margin-bottom:16px; }
.sp-bars { display:flex; align-items:flex-end; gap:3px; height:74px; margin-top:12px; }
.sp-bars > div { flex:1; min-width:2px; background:#c7d2fe; border-radius:2px 2px 0 0; transition:height 300ms; }
.sp-bars > div[data-hot="1"] { background:#f97316; }
`;

/* A cap's headline state as one coloured phrase, so the page answers "am I about to be stopped?"
   before anyone reads a number. */
function capTone(state) {
  if (!state?.enabled) return ['Off', '#475467', '#f2f4f7', 'Nothing is being limited. Sends are only bounded by the provider.'];
  const pct = Math.max(Number(state.month_pct || 0), Number(state.month_msg_pct || 0));
  if (state.on_breach === 'warn') return ['Warn only', '#b45309', '#fef3c7', 'At the cap you are told, but nothing is stopped.'];
  if (pct >= 100) return ['At the cap', '#b42318', '#fee4e2', 'Sending is paused. Campaign audiences are intact and resume when there is room.'];
  if (pct >= 80)  return ['Close to the cap', '#b45309', '#fef3c7', 'Sending stops when this reaches 100%.'];
  return ['Enforcing', '#027a48', '#d1fadf', 'Sending stops automatically at the cap.'];
}

function Meter({ pct, color }) {
  const p = Math.max(0, Math.min(100, Number(pct || 0)));
  return <div className="sp-meter"><span style={{ width: `${p}%`, background: color }} /></div>;
}

function Field({ label, hint, children }) {
  return <div className="sp-f"><label>{label}</label>{children}{hint ? <small>{hint}</small> : null}</div>;
}

export default function NetcoreSpend() {
  const [tab, setTab]         = useState('caps');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState('');
  const [data, setData]       = useState(null);
  /* The forms are held separately from the server's copy so a half-typed cap is never mistaken
     for the live one — and so Cancel means something. */
  const [form, setForm]       = useState({ whatsapp: null, email: null });
  const [rates, setRates]     = useState({ whatsapp: [], email: [] });
  const [history, setHistory] = useState(null);
  const [report, setReport]   = useState({ kind: 'bills', data: null, loading: false });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.post(API, new URLSearchParams({ action: 'get' }), FORM);
      const d = r.data?.data || r.data || {};
      setData(d);
      setForm({
        whatsapp: { ...(d.whatsapp?.cap || {}) },
        email:    { ...(d.email?.cap || {}) },
      });
      setRates({ whatsapp: d.whatsapp?.rates || [], email: d.email?.rates || [] });
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not load spend settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* The chart and the reports are only fetched when their tab is opened — neither is needed to
     answer the question the page opens on. */
  useEffect(() => {
    if (tab !== 'unusual' || history) return;
    api.post(API, new URLSearchParams({ action: 'history', days: '30' }), FORM)
      .then(r => setHistory(r.data?.data || r.data || {}))
      .catch(() => {});
  }, [tab, history]);

  const loadReport = useCallback(async (kind, build = false) => {
    setReport(p => ({ ...p, kind, loading: true }));
    try {
      const body = new URLSearchParams({ action: 'report', kind });
      if (build) body.set('build', '1');
      const r = await api.post(API, body, FORM);
      setReport({ kind, data: r.data?.data || r.data || null, loading: false });
    } catch (e) {
      setReport(p => ({ ...p, loading: false }));
      toast.error(e?.response?.data?.message || 'Could not load the report');
    }
  }, []);

  useEffect(() => { if (tab === 'reports' && !report.data && !report.loading) loadReport('bills'); }, [tab, report, loadReport]);

  const setCap = (ch, k, v) => setForm(p => ({ ...p, [ch]: { ...p[ch], [k]: v } }));

  const saveCap = async (ch) => {
    const f = form[ch] || {};
    setSaving(`cap:${ch}`);
    try {
      const body = new URLSearchParams({
        action: 'save_cap', channel: ch,
        enabled: Number(f.enabled) ? '1' : '0',
        currency: f.currency || 'INR',
        monthly_cap: String(f.monthly_cap ?? 0),
        daily_cap: String(f.daily_cap ?? 0),
        on_breach: f.on_breach === 'warn' ? 'warn' : 'block',
        alert_at: f.alert_at || '50,80,100',
        month_start_day: String(f.month_start_day ?? 1),
        auto_resume: Number(f.auto_resume) ? '1' : '0',
      });
      if (ch === 'email') {
        body.set('monthly_messages', String(f.monthly_messages ?? 0));
        body.set('daily_messages', String(f.daily_messages ?? 0));
      }
      await api.post(API, body, FORM);
      toast.success('Saved');
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not save');
    } finally { setSaving(''); }
  };

  const saveRates = async (ch) => {
    setSaving(`rates:${ch}`);
    try {
      await api.post(API, new URLSearchParams({
        action: 'save_rates', channel: ch, rates: JSON.stringify(rates[ch] || []),
      }), FORM);
      toast.success('Prices saved');
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not save the prices');
    } finally { setSaving(''); }
  };

  const resume = async (ch) => {
    setSaving(`resume:${ch}`);
    try {
      const r = await api.post(API, new URLSearchParams({ action: 'resume', channel: ch }), FORM);
      toast.success(r.data?.message || 'Done');
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not resume');
    } finally { setSaving(''); }
  };

  const scanNow = async () => {
    setSaving('scan');
    try {
      const r = await api.post(API, new URLSearchParams({ action: 'scan' }), FORM);
      const n = (r.data?.data?.findings || []).length;
      toast.success(n ? `${n} finding(s)` : 'Nothing unusual');
      setHistory(null);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'The scan failed');
    } finally { setSaving(''); }
  };

  const pausedTotal = useMemo(
    () => (data?.paused?.whatsapp?.length || 0) + (data?.paused?.email?.length || 0), [data]);

  if (loading) {
    return <div className="sp"><style>{CSS}</style><div className="sp-empty">Loading spend settings…</div></div>;
  }

  return (
    <div className="sp">
      <style>{CSS}</style>

      <h1 className="sp-h1">Spend control</h1>
      <p className="sp-lede">
        What this account may spend on messaging, what it is spending right now, and whether today
        looks like the days before it. The cap is the only thing here that can stop a send: when it
        is reached, campaigns pause with every remaining recipient still queued, and journey
        messages are recorded as suppressed so the student continues to their next step.
      </p>

      {pausedTotal > 0 && (
        <div className="sp-note" style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e' }}>
          <b>{pausedTotal} campaign{pausedTotal > 1 ? 's are' : ' is'} paused by the spend cap.</b>{' '}
          Nobody has been dropped — their recipients are still queued. They restart on their own when
          the period has room again, or immediately if you raise the cap and press Resume.
        </div>
      )}

      <div className="sp-tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} className="sp-tab" role="tab" aria-selected={tab === k}
                  onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {/* ── Caps & live spend ────────────────────────────────────────────── */}
      {tab === 'caps' && CHANNELS.map(([ch, label]) => {
        const st = data?.[ch]?.state || {};
        const f  = form[ch] || {};
        const [tone, toneFg, toneBg, toneWhy] = capTone(st);
        const pct = Math.max(Number(st.month_pct || 0), Number(st.month_msg_pct || 0));
        const barColor = pct >= 100 ? '#d92d20' : pct >= 80 ? '#f79009' : '#4f46e5';
        const paused = data?.paused?.[ch] || [];

        return (
          <div className="sp-card" key={ch}>
            <div className="sp-head">
              <div>
                <h2>
                  {label} spend cap
                  <span className="sp-pill" style={{ color: toneFg, background: toneBg }}>{tone}</span>
                </h2>
                <p className="hint">{toneWhy}</p>
              </div>
              <button className="sp-sw" role="switch" aria-checked={!!Number(f.enabled)}
                      aria-label={`${label} cap on or off`}
                      onClick={() => setCap(ch, 'enabled', Number(f.enabled) ? 0 : 1)} />
            </div>

            {st.enabled && (
              <>
                <Meter pct={pct} color={barColor} />
                <div className="sp-stat">
                  <div><b>{money(st.currency, st.month_spent)}</b>
                       <span>this period{st.month_cap > 0 ? ` of ${money(st.currency, st.month_cap)}` : ''}</span></div>
                  <div><b>{money(st.currency, st.today_spent)}</b>
                       <span>today{st.day_cap > 0 ? ` of ${money(st.currency, st.day_cap)}` : ''}</span></div>
                  <div><b>{nUS(st.month_messages)}</b>
                       <span>messages this period{st.month_message_cap > 0 ? ` of ${nUS(st.month_message_cap)}` : ''}</span></div>
                  {/* The two channels answer 'what is left' differently, because they are capped
                      differently: WhatsApp by money (every message has a price), email usually by
                      volume (a plan is a block of messages). Showing the wrong one would print a
                      dash next to the only number that matters. */}
                  {ch === 'email' ? (
                    <div><b>{st.remaining_messages === null ? '—' : nUS(st.remaining_messages)}</b>
                         <span>messages still allowed</span></div>
                  ) : (
                    <div><b>{st.remaining === null || st.remaining === undefined ? '—' : money(st.currency, st.remaining)}</b>
                         <span>still allowed to spend</span></div>
                  )}
                </div>
                <p className="hint" style={{ margin: '12px 0 0' }}>
                  Period {st.period?.from} → {st.period?.to}.
                  {' '}Normal day for this channel: {money(st.currency, data?.[ch]?.baseline?.median)}
                  {' '}(median of the last {data?.[ch]?.baseline?.days || 0} day(s)).
                </p>
              </>
            )}

            <div style={{ height: 18 }} />
            <div className="sp-grid">
              <Field label="Currency" hint="Only a label — no conversion is done anywhere.">
                <input value={f.currency ?? 'INR'} maxLength={8}
                       onChange={e => setCap(ch, 'currency', e.target.value)} />
              </Field>
              <Field label="Cap per period" hint="0 means no money cap.">
                <input type="number" min="0" step="0.01" value={f.monthly_cap ?? 0}
                       onChange={e => setCap(ch, 'monthly_cap', e.target.value)} />
              </Field>
              <Field label="Cap per day" hint="A second, tighter ceiling. Must not exceed the period cap.">
                <input type="number" min="0" step="0.01" value={f.daily_cap ?? 0}
                       onChange={e => setCap(ch, 'daily_cap', e.target.value)} />
              </Field>
              {ch === 'email' && (
                <>
                  <Field label="Messages per period"
                         hint="For email this usually bites before the money does — an Elastic Email plan is a block of messages.">
                    <input type="number" min="0" step="1" value={f.monthly_messages ?? 0}
                           onChange={e => setCap(ch, 'monthly_messages', e.target.value)} />
                  </Field>
                  <Field label="Messages per day"
                         hint="Set this a little under the provider's own 24-hour limit — SES allows 50,000.">
                    <input type="number" min="0" step="1" value={f.daily_messages ?? 0}
                           onChange={e => setCap(ch, 'daily_messages', e.target.value)} />
                  </Field>
                </>
              )}
              <Field label="At the cap"
                     hint="Warn only never stops a send — useful while you find out what a normal month costs.">
                <select value={f.on_breach ?? 'block'} onChange={e => setCap(ch, 'on_breach', e.target.value)}>
                  <option value="block">Stop sending</option>
                  <option value="warn">Warn but keep sending</option>
                </select>
              </Field>
              <Field label="Tell me at" hint="Percentages of the period cap, comma separated.">
                <input value={f.alert_at ?? '50,80,100'}
                       onChange={e => setCap(ch, 'alert_at', e.target.value)} />
              </Field>
              <Field label="Period starts on day"
                     hint="Match your invoice date, so the cap and the bill cover the same days.">
                <input type="number" min="1" max="28" value={f.month_start_day ?? 1}
                       onChange={e => setCap(ch, 'month_start_day', e.target.value)} />
              </Field>
              <Field label="Resume automatically"
                     hint="Paused campaigns restart by themselves once the period has room.">
                <select value={Number(f.auto_resume) ? '1' : '0'}
                        onChange={e => setCap(ch, 'auto_resume', e.target.value)}>
                  <option value="1">Yes</option>
                  <option value="0">No — I will restart them myself</option>
                </select>
              </Field>
            </div>

            <div className="sp-actions">
              <button className="sp-btn" disabled={saving === `cap:${ch}`} onClick={() => saveCap(ch)}>
                {saving === `cap:${ch}` ? 'Saving…' : 'Save'}
              </button>
              <button className="sp-btn ghost" disabled={saving === `resume:${ch}`} onClick={() => resume(ch)}>
                {saving === `resume:${ch}` ? 'Resuming…' : 'Resume paused campaigns'}
              </button>
            </div>

            {paused.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <table className="sp-table">
                  <thead><tr><th>Paused by the cap</th><th>Why</th><th>When</th></tr></thead>
                  <tbody>
                    {paused.map(p => (
                      <tr key={p.campaign_id}>
                        <td>#{p.campaign_id} {p.name || ''}</td>
                        <td>{p.reason}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{p.paused_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Prices ───────────────────────────────────────────────────────── */}
      {tab === 'prices' && (
        <>
          <div className="sp-note" style={{ background: '#eff8ff', border: '1px solid #b2ddff', color: '#175cd3' }}>
            These are the prices the cap counts with, and nothing checks them against the provider —
            they cannot be. Meta prices WhatsApp by country and template category; SES, Elastic Email
            and SendGrid each bill differently. Put your own rate card in, and the caps, the estimates
            and the weekly bill all become real numbers rather than indications.
          </div>

          <div className="sp-card">
            <h2>WhatsApp — price per message</h2>
            <p className="hint">
              Matched by dialling code, longest prefix first, then by the category Meta has the
              template filed under. The <b>*</b> row is the fallback for every country without a
              row of its own — without it an unexpected country would be counted as free.
            </p>
            <table className="sp-table">
              <thead><tr><th style={{ width: 130 }}>Dialling code</th><th>Category</th><th style={{ width: 160 }}>Price</th></tr></thead>
              <tbody>
                {(rates.whatsapp || []).map((r, i) => (
                  <tr key={`${r.country_code}-${r.category}`}>
                    <td>{r.country_code === '*' ? 'Any other country' : `+${r.country_code}`}</td>
                    <td>{r.category}</td>
                    <td>
                      <input type="number" min="0" step="0.00001" value={r.price}
                             onChange={e => setRates(p => ({
                               ...p, whatsapp: p.whatsapp.map((x, j) => j === i ? { ...x, price: e.target.value } : x),
                             }))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sp-actions">
              <button className="sp-btn" disabled={saving === 'rates:whatsapp'} onClick={() => saveRates('whatsapp')}>
                {saving === 'rates:whatsapp' ? 'Saving…' : 'Save WhatsApp prices'}
              </button>
              <AddWaRate onAdd={row => setRates(p => ({ ...p, whatsapp: [...p.whatsapp, row] }))}
                         existing={rates.whatsapp || []} />
            </div>
          </div>

          <div className="sp-card">
            <h2>Email — price per thousand</h2>
            <p className="hint">
              Per thousand because that is the unit every provider quotes. <b>Included per month</b> is
              what the plan already covers — recorded for the weekly bill, so a plan allowance and a
              per-message charge are not read as the same thing.
            </p>
            <table className="sp-table">
              <thead><tr><th>Provider</th><th style={{ width: 170 }}>Price per 1,000</th><th style={{ width: 170 }}>Included per month</th></tr></thead>
              <tbody>
                {(rates.email || []).map((r, i) => (
                  <tr key={r.provider}>
                    <td>{r.provider}</td>
                    <td>
                      <input type="number" min="0" step="0.0001" value={r.price_per_1000}
                             onChange={e => setRates(p => ({
                               ...p, email: p.email.map((x, j) => j === i ? { ...x, price_per_1000: e.target.value } : x),
                             }))} />
                    </td>
                    <td>
                      <input type="number" min="0" step="1" value={r.monthly_included}
                             onChange={e => setRates(p => ({
                               ...p, email: p.email.map((x, j) => j === i ? { ...x, monthly_included: e.target.value } : x),
                             }))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sp-actions">
              <button className="sp-btn" disabled={saving === 'rates:email'} onClick={() => saveRates('email')}>
                {saving === 'rates:email' ? 'Saving…' : 'Save email prices'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Unusual spend ────────────────────────────────────────────────── */}
      {tab === 'unusual' && (
        <>
          <div className="sp-card">
            <div className="sp-head">
              <div>
                <h2>What counts as unusual</h2>
                <p className="hint">
                  Today is compared with the <b>median</b> of the last {data?.watch?.baseline_days || 14} completed
                  days — the median and not the average, because one previous runaway day would lift an
                  average enough to make the next one look ordinary. A day over{' '}
                  {data?.watch?.day_multiple || 3}× that, or an hour over {data?.watch?.hour_multiple || 6}× a
                  typical hour, raises an alert. Nothing is stopped: only the cap stops a send.
                </p>
              </div>
              <button className="sp-btn ghost" disabled={saving === 'scan'} onClick={scanNow}>
                {saving === 'scan' ? 'Scanning…' : 'Scan now'}
              </button>
            </div>

            {(history?.pulse?.length || 0) > 0 && CHANNELS.map(([ch, label]) => {
              const rows = (history.pulse || []).filter(p => p.channel === ch);
              if (!rows.length) return null;
              const max = Math.max(...rows.map(r => Number(r.amount)));
              return (
                <div key={ch} style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475467' }}>
                    {label} — the last 48 hours, hour by hour
                  </div>
                  <div className="sp-bars">
                    {rows.map(r => (
                      <div key={r.bucket_start} data-hot={max > 0 && Number(r.amount) >= max * 0.9 ? '1' : '0'}
                           title={`${r.bucket_start} · ${money(history.currency?.[ch], r.amount)} · ${nUS(r.messages)} messages`}
                           style={{ height: `${max > 0 ? Math.max(3, (Number(r.amount) / max) * 100) : 3}%` }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sp-card">
            <h2>Findings</h2>
            <p className="hint">Each finding is recorded once per period, so a spike that lasts all afternoon says so once.</p>
            {(data?.anomalies?.length || 0) === 0 ? (
              <div className="sp-empty">Nothing unusual has been recorded. That is the expected state.</div>
            ) : (
              <table className="sp-table">
                <thead><tr><th>When</th><th>Channel</th><th>What</th><th style={{ width: 90 }}>Ratio</th></tr></thead>
                <tbody>
                  {data.anomalies.map((a, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap' }}>{a.seen_at}</td>
                      <td>{a.channel}</td>
                      <td>{a.detail}</td>
                      <td>{Number(a.ratio) > 0 ? `${Number(a.ratio).toFixed(1)}×` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── Weekly reports ──────────────────────────────────────────────── */}
      {tab === 'reports' && (
        <div className="sp-card">
          <div className="sp-head">
            <div>
              <h2>Last week</h2>
              <p className="hint">
                Always the last <b>complete</b> week, Monday to Sunday. A report that included today
                would change after it was sent, and then two people reading the same week would
                disagree. Both reports go out from the Monday cron; opening this screen delivers
                nothing anywhere.
              </p>
            </div>
          </div>

          <div className="sp-actions" style={{ marginTop: 0, marginBottom: 16 }}>
            <button className={`sp-btn${report.kind === 'bills' ? '' : ' ghost'}`}
                    onClick={() => loadReport('bills')}>Consumables bill</button>
            <button className={`sp-btn${report.kind === 'campaigns' ? '' : ' ghost'}`}
                    onClick={() => loadReport('campaigns')}>Campaign performance</button>
            <button className="sp-btn ghost" onClick={() => loadReport(report.kind, true)}>Rebuild from live data</button>
          </div>

          {report.loading && <div className="sp-empty">Building…</div>}

          {!report.loading && report.data && report.kind === 'bills' && (
            <BillsReport r={report.data} />
          )}
          {!report.loading && report.data && report.kind === 'campaigns' && (
            <CampaignsReport r={report.data} />
          )}
          {!report.loading && !report.data && (
            <div className="sp-empty">No report for that week yet. Rebuild from live data to see it now.</div>
          )}
        </div>
      )}
    </div>
  );
}

/* Adding a country rate by hand — a rate card grows one country at a time, and re-seeding the
   table to add Nepal would be a strange way to do it. */
function AddWaRate({ onAdd, existing }) {
  const [cc, setCc] = useState('');
  const add = () => {
    const code = cc.replace(/[^0-9]/g, '');
    if (!code) { toast.error('Enter a dialling code, e.g. 977 for Nepal'); return; }
    if (existing.some(r => r.country_code === code)) { toast.error(`+${code} is already in the list`); return; }
    /* All four categories at once: a country with a marketing price and no utility price would
       silently count utility messages as free. */
    WA_CATEGORIES.forEach(category => onAdd({ country_code: code, category, price: 0 }));
    setCc('');
    toast.success(`+${code} added — set its prices and save`);
  };
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <input value={cc} onChange={e => setCc(e.target.value)} placeholder="Dialling code" maxLength={4}
             style={{ width: 120, padding: '8px 11px', fontSize: 13, fontFamily: 'inherit',
                      border: '1.5px solid #d0d5dd', borderRadius: 8 }} />
      <button className="sp-btn ghost" onClick={add}>Add a country</button>
    </span>
  );
}

function BillsReport({ r }) {
  const p = r.payload || {};
  const delta = (now, then) => {
    if (!then) return Number(now) > 0 ? 'new this week' : 'no change';
    const d = Math.round((Number(now) / Number(then) - 1) * 100);
    return `${d >= 0 ? '+' : ''}${d}% on last week`;
  };
  return (
    <>
      <div className="sp-stat">
        <div><b>{money(p.whatsapp?.currency, p.whatsapp?.amount)}</b>
             <span>WhatsApp · {nUS(p.whatsapp?.messages)} messages · {delta(p.whatsapp?.amount, p.whatsapp?.previous_amount)}</span></div>
        <div><b>{money(p.email?.currency, p.email?.amount)}</b>
             <span>Email · {nUS(p.email?.messages)} messages · {delta(p.email?.amount, p.email?.previous_amount)}</span></div>
        <div><b>{money(p.whatsapp?.currency, p.total)}</b><span>total for the week</span></div>
      </div>
      <p className="hint" style={{ marginTop: 14 }}>
        {r.period?.from} → {r.period?.to}. Built {r.built_at}
        {r.delivered ? ' and delivered to Slack and the alert list.' : '. Not delivered from here.'}
      </p>
      {Object.keys(p.whatsapp?.by_category || {}).length > 0 && (
        <table className="sp-table" style={{ marginTop: 12 }}>
          <thead><tr><th>WhatsApp by template category</th><th>Messages</th><th>Cost</th></tr></thead>
          <tbody>
            {Object.entries(p.whatsapp.by_category).map(([k, v]) => (
              <tr key={k}><td>{k}</td><td>{nUS(v.messages)}</td><td>{money(p.whatsapp.currency, v.amount)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {Object.keys(p.email?.by_provider || {}).length > 0 && (
        <table className="sp-table" style={{ marginTop: 12 }}>
          <thead><tr><th>Email by provider</th><th>Messages</th><th>Cost</th></tr></thead>
          <tbody>
            {Object.entries(p.email.by_provider).map(([k, v]) => (
              <tr key={k}><td>{k}</td><td>{nUS(v.messages)}</td><td>{money(p.email.currency, v.amount)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function CampaignsReport({ r }) {
  const p = r.payload || {};
  const t = p.totals || {};
  const pct = (n, d) => (Number(d) > 0 ? `${((Number(n) / Number(d)) * 100).toFixed(1)}%` : '—');
  return (
    <>
      <div className="sp-stat">
        <div><b>{nUS(t.email_sent)}</b><span>emails sent · {(p.email || []).length} campaign(s)</span></div>
        <div><b>{money('INR', t.email_cost)}</b><span>email cost</span></div>
        <div><b>{nUS(t.wa_sent)}</b><span>WhatsApp sent · {(p.whatsapp || []).length} campaign(s)</span></div>
        <div><b>{money('INR', t.wa_cost)}</b><span>WhatsApp cost</span></div>
      </div>
      <p className="hint" style={{ marginTop: 14 }}>{r.period?.from} → {r.period?.to}. Percentages are of messages sent.</p>

      {(p.email || []).length > 0 && (
        <table className="sp-table" style={{ marginTop: 12 }}>
          <thead><tr><th>Email campaign</th><th>Sent</th><th>Delivered</th><th>Opened</th><th>Clicked</th><th>Bounced</th><th>Cost</th></tr></thead>
          <tbody>
            {p.email.map(c => (
              <tr key={c.id}>
                <td>#{c.id} {c.name}</td>
                <td>{nUS(c.sent_count)}</td>
                <td>{pct(c.delivered_count, c.sent_count)}</td>
                <td>{pct(c.unique_open_count, c.sent_count)}</td>
                <td>{pct(c.unique_click_count, c.sent_count)}</td>
                <td>{pct(c.bounce_count, c.sent_count)}</td>
                <td>{money('INR', c.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(p.whatsapp || []).length > 0 && (
        <table className="sp-table" style={{ marginTop: 16 }}>
          <thead><tr><th>WhatsApp campaign</th><th>Sent</th><th>Delivered</th><th>Read</th><th>Clicked</th><th>Failed</th><th>Cost</th></tr></thead>
          <tbody>
            {p.whatsapp.map(c => (
              <tr key={c.id}>
                <td>#{c.id} {c.name}</td>
                <td>{nUS(c.sent_count)}</td>
                <td>{pct(c.delivered_count, c.sent_count)}</td>
                <td>{pct(c.read_count, c.sent_count)}</td>
                <td>{pct(c.click_count, c.sent_count)}</td>
                <td>{pct(c.failed_count, c.sent_count)}</td>
                <td>{money('INR', c.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(p.email || []).length === 0 && (p.whatsapp || []).length === 0 && (
        <div className="sp-empty">No campaign started in that week.</div>
      )}
    </>
  );
}
