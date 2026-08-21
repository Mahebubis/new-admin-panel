import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import { WA_SET_API, FORM, WA, WA_CSS, WA_EXPECTED_API_VERSION, inp, label, card, fmtDt, n0 } from './waShared';
import { Spinner, WhatsAppIcon, Notice } from './WaUi';
import WaSenderModal from './WaSenderModal';
import WaAddNumberModal from './WaAddNumberModal';

// Same base + fallback as src/api/axios.js — the webhook URL shown below has to be the real
// public one the provider will POST to, which is never localhost even in dev.
const API_BASE = import.meta.env.VITE_API_URL || 'https://cit3.internshipstudio.com/admin/react-api';

/* One row of the "is this actually going to work" checklist. This page exists as much to
   explain the failure modes as to store credentials — a WhatsApp integration can be fully
   "connected" by every visible signal and still deliver nothing. */
function CheckRow({ ok, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '11px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: ok ? '#dcfce7' : '#fee2e2', color: ok ? '#16a34a' : '#dc2626', fontSize: 12, fontWeight: 800 }}>
        {ok ? '✓' : '!'}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: ok ? '#0f172a' : '#dc2626' }}>{title}</div>
        {children && <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3, lineHeight: 1.55 }}>{children}</div>}
      </div>
    </div>
  );
}

export default function WaSettings() {
  const nav = useNavigate();
  const [row, setRow] = useState(null);
  const [webhookPath, setWebhookPath] = useState('/api/whatsapp/webhook.php');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosis, setDiagnosis] = useState(null);

  const [optinPhones, setOptinPhones] = useState('');
  const [optinBusy, setOptinBusy] = useState(false);
  const [optins, setOptins] = useState([]);
  const [optinTotal, setOptinTotal] = useState(0);

  const [senders, setSenders] = useState([]);
  const [senderModal, setSenderModal] = useState(null); // { sender } | { sender: null } for "add"
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [importingNumbers, setImportingNumbers] = useState(false);
  const [addNumberOpen, setAddNumberOpen] = useState(false);
  // The sender being re-registered to this app, when that flow is open.
  const [takeover, setTakeover] = useState(null);
  const [webhookSub, setWebhookSub] = useState(null);
  const [webhookBusy, setWebhookBusy] = useState(false);
  // Guards the automatic pull so a load() triggered by the import itself can't loop.
  const autoSyncedRef = useRef(false);
  // Absent on any backend older than v1's stamp, so undefined means "old" too.
  const [apiVersion, setApiVersion] = useState(null);

  const load = async ({ allowAutoSync = true } = {}) => {
    setLoading(true);
    try {
      const res = await api.post(WA_SET_API, new URLSearchParams({ action: 'get' }), FORM);
      if (res.data.success) {
        const s = res.data.data.settings;
        const list = res.data.data.senders || [];
        setRow(s);
        setSenders(list);
        setApiVersion(Number(res.data.data.api_version) || 0);

        /*
         * Numbers come from Meta, so the panel asks Meta rather than making you press a button.
         * Runs once per page load, and only when there is something to gain: a Meta token
         * exists, and either no numbers are stored yet or one is missing its phone_number_id.
         * A number added in Business Manager tomorrow appears here simply by opening this page.
         * The button stays for an explicit refresh.
         */
        const needsIds = list.length === 0 || list.some(x => !x.phone_number_id);
        if (allowAutoSync && s.has_meta_token && needsIds && !autoSyncedRef.current) {
          autoSyncedRef.current = true;
          importNumbers({ silent: true });
        }
        setWebhookPath(res.data.data.webhook_path || '/api/whatsapp/webhook.php');
        setForm({
          meta_access_token: '',
          meta_app_secret: '',
          default_country_code: s.default_country_code || '91',
          webhook_secret: s.webhook_secret || '',
        });
      }
    } finally { setLoading(false); }
  };

  /* Reads the WABA's numbers from Meta and fills in each one's phone_number_id — the value
     Cloud API sends through, and the one nobody should be transcribing by hand. */
  const importNumbers = async ({ silent = false } = {}) => {
    setImportingNumbers(true);
    // The automatic pull stays quiet unless it actually changed something — a toast on every
    // page load would be noise.
    const t = silent ? null : toast.loading('Reading your business numbers from Meta…');
    try {
      const res = await api.post(WA_SET_API, new URLSearchParams({ action: 'import_numbers' }), FORM);
      if (res.data.success) {
        const d = res.data.data;
        const changed = (d.imported || 0) + (d.updated || 0) > 0;
        if (!silent) toast.success(`${d.imported} added, ${d.updated} updated`, { id: t });
        else if (d.imported > 0) toast.success(`${d.imported} sending number(s) found on your WhatsApp account`);
        if (changed) load({ allowAutoSync: false });
      } else if (!silent) {
        toast.error(res.data.message || 'Import failed', { id: t, duration: 12000 });
      }
    } catch (e) {
      if (!silent) toast.error(e?.response?.data?.message || 'Import failed', { id: t, duration: 12000 });
    } finally { setImportingNumbers(false); }
  };

  /* "Invalid action" is the API's catch-all for an action it doesn't recognise, which in
     practice means one thing: the PHP on the server predates this build. Saying that beats
     echoing a message that reads like the request was malformed. */
  const explainError = (msg) => (
    String(msg || '').toLowerCase().includes('invalid action')
      ? 'The WhatsApp backend on the server is older than this page — re-upload public/react-api/api/whatsapp/ and reload.'
      : (msg || 'Something went wrong')
  );

  const checkWebhookSub = async () => {
    setWebhookBusy(true);
    try {
      const res = await api.post(WA_SET_API, new URLSearchParams({ action: 'webhook_status' }), FORM);
      if (res.data.success) setWebhookSub(res.data.data);
      else toast.error(explainError(res.data.message), { duration: 12000 });
    } catch (e) { toast.error(explainError(e?.response?.data?.message), { duration: 12000 }); }
    finally { setWebhookBusy(false); }
  };

  const subscribeWebhook = async () => {
    setWebhookBusy(true);
    const t = toast.loading('Subscribing the app to this WABA…');
    try {
      const res = await api.post(WA_SET_API, new URLSearchParams({ action: 'webhook_subscribe' }), FORM);
      if (res.data.success) {
        toast.success('Subscribed — delivery events will now arrive', { id: t });
        checkWebhookSub();
      } else toast.error(explainError(res.data.message), { id: t, duration: 12000 });
    } catch (e) { toast.error(explainError(e?.response?.data?.message), { id: t, duration: 12000 }); }
    finally { setWebhookBusy(false); }
  };

  const senderAction = async (action, id) => {
    const t = toast.loading('Working…');
    try {
      const res = await api.post(WA_SET_API, new URLSearchParams({ action, id }), FORM);
      if (res.data.success) {
        const affected = res.data.data?.affected_drafts;
        toast.success(
          affected ? `Done — ${affected} draft(s) will fall back to the default number` : 'Done',
          { id: t, duration: affected ? 6000 : 3000 },
        );
        load();
      } else toast.error(res.data.message || 'Failed', { id: t });
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error', { id: t }); }
  };

  const loadOptins = async () => {
    try {
      const res = await api.post(WA_SET_API, new URLSearchParams({ action: 'optin_list', page: 1, per_page: 10 }), FORM);
      if (res.data.success) { setOptins(res.data.data.optins || []); setOptinTotal(res.data.data.total || 0); }
    } catch { /* non-critical */ }
  };

  // Mount only — load() is recreated every render and listing it would refetch in a loop.
  useEffect(() => { load(); loadOptins(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    const t = toast.loading('Saving…');
    try {
      const body = { action: 'save', ...form };
      // An untouched credential field must not blank what's stored.
      if (!body.meta_access_token) delete body.meta_access_token;
      if (!body.meta_app_secret) delete body.meta_app_secret;
      const res = await api.post(WA_SET_API, new URLSearchParams(body), FORM);
      if (res.data.success) { toast.success('Saved', { id: t }); load(); }
      else toast.error(res.data.message || 'Failed', { id: t });
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error', { id: t }); }
    finally { setSaving(false); }
  };

  /* Asks Meta what this token is actually allowed to do, and turns the answer into the specific
     click-path that fixes it. Exists because Meta returns one identical #200 for three unrelated
     causes, each with a different remedy. */
  const runDiagnose = async (senderId = 0) => {
    setDiagnosing(true); setDiagnosis(null);
    try {
      // Aimed at ONE number when asked. The account-level checks are the same either way, but
      // "is this number registered on Cloud API" is per number — running it against the default
      // sender while a different number is the one failing answers the wrong question.
      const body = { action: 'diagnose' };
      if (senderId) body.sender_id = String(senderId);
      const res = await api.post(WA_SET_API, new URLSearchParams(body), FORM);
      if (res.data.success) setDiagnosis(res.data.data);
      else toast.error(explainError(res.data.message), { duration: 12000 });
    } catch (e) { toast.error(explainError(e?.response?.data?.message), { duration: 12000 }); }
    finally { setDiagnosing(false); }
  };

  const runTest = async () => {
    if (!testPhone.trim()) return toast.error('Enter a number to test against — your own works well');
    setTesting(true); setTestResult(null);
    try {
      const res = await api.post(WA_SET_API, new URLSearchParams({ action: 'test', phone: testPhone }), FORM);
      if (res.data.success) { setTestResult(res.data.data); loadOptins(); }
      else setTestResult({ ok: false, message: res.data.message || 'Test failed', notes: [] });
    } catch (e) {
      setTestResult({ ok: false, message: e?.response?.data?.message || 'Network error', notes: [] });
    } finally { setTesting(false); }
  };

  const registerConsent = async (type) => {
    if (!optinPhones.trim()) return toast.error('Enter at least one number');
    setOptinBusy(true);
    const t = toast.loading(type === 'optin' ? 'Registering opt-in…' : 'Registering opt-out…');
    try {
      const res = await api.post(WA_SET_API, new URLSearchParams({ action: 'optin', phones: optinPhones, type }), FORM);
      if (res.data.success) {
        const d = res.data.data;
        toast.success(`${d.registered} number(s) registered${d.invalid.length ? `, ${d.invalid.length} invalid` : ''}`, { id: t });
        if (d.errors?.length) toast.error(d.errors[0], { duration: 6000 });
        setOptinPhones('');
        loadOptins(); load();
      } else toast.error(res.data.message || 'Failed', { id: t });
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error', { id: t }); }
    finally { setOptinBusy(false); }
  };

  if (loading || !row) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}><Spinner /></div>;
  }

  const webhookUrl = API_BASE + webhookPath;

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#f8fafc', minHeight: '100%' }}>
      <style>{WA_CSS}</style>

      {/* Full width, two columns. The old 860px centred column left half the screen empty and
          pushed the webhook section three scrolls down; side-by-side, the whole page fits. */}
      <div style={{ padding: '20px 24px 60px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <button onClick={() => nav('/netcore/whatsapp')}
            style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <span style={{ width: 36, height: 36, borderRadius: 9, background: WA.green, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <WhatsAppIcon size={20} color="#fff" />
          </span>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#0f172a' }}>WhatsApp settings</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Credentials and sending identity for the WhatsApp Business API</div>
          </div>
        </div>

        {/* The one mismatch that makes this page lie: a saved field the running backend doesn't
            know about is accepted by the form and then ignored, with nothing to show for it. */}
        {apiVersion !== null && apiVersion < WA_EXPECTED_API_VERSION && (
          <Notice tone="danger" title="The WhatsApp backend on the server is out of date" style={{ marginBottom: 18 }}>
            This page needs API v{WA_EXPECTED_API_VERSION} but the server is running
            v{apiVersion || '1'}. Until it's updated, the per-number <b>API key</b> field is
            ignored on save — which is exactly why a number can still show <b>NO API KEY</b> right
            after you entered one.
            <div style={{ marginTop: 6 }}>
              Re-upload <code>public/react-api/api/whatsapp/</code> (all files, including
              <code> lib/</code>) to the server, then reload this page.
            </div>
          </Notice>
        )}

        {/* ── Readiness checklist ──────────────────────────────────────────────────────── */}
        <div style={{ ...card, borderColor: row.ready ? '#bbf7d0' : '#fed7aa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Connection status</div>
            <span style={{ padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: '.3px', background: row.ready ? '#dcfce7' : '#fef3c7', color: row.ready ? '#15803d' : '#b45309' }}>
              {row.ready ? 'READY TO SEND' : 'SETUP INCOMPLETE'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
            The first two must be true to send at all. The third is what decides whether the message
            actually arrives.
          </div>

          <CheckRow ok={row.usable_senders > 0} title="A sending number with a phone number ID">
            {row.usable_senders > 0
              ? `${row.usable_senders} of ${row.sender_count} number(s) can send.`
              : (row.sender_count > 0
                ? 'Numbers are saved, but none has a phone number ID yet — press Refresh to read them from Meta.'
                : 'No sending numbers added yet.')}
            {' '}Sending goes straight to Meta Cloud API, so the credential is the account's Meta token
            plus each number's <b>phone number ID</b> — that ID is what decides which number a message
            goes out from. There is no per-number API key.
          </CheckRow>
          <CheckRow ok={row.template_count > 0} title="Approved templates registered">
            {row.template_count > 0
              ? `${row.template_count} template(s) registered here.`
              : 'None yet. Use "Sync from provider" on the Templates page to import the ones Meta already approved.'}
            {' '}<b>An unapproved template name is accepted by the API and then silently dropped</b> — the
            most common reason a campaign reports thousands sent with nobody receiving anything.
          </CheckRow>
          {/* Replaces the old "Source key" row. Source keys were Netcore's way of routing a
              delivery receipt back to the right endpoint; Meta has no such concept — it routes
              by which app is subscribed to the WABA, which is the thing actually worth checking. */}
          <CheckRow ok={!!row.has_app_secret} title="Webhook ready (Delivered / Read / replies)">
            {row.has_app_secret
              ? 'App secret saved — incoming webhooks are signature-verified.'
              : 'No Meta app secret saved yet, so callbacks are accepted without verification.'}
            {' '}Delivered / Read / Clicked and Live Chat all depend on the webhook: the send API
            returning success means <b>accepted</b>, not delivered. Below, confirm this app is
            subscribed to the WABA — and remember Meta sends <b>nothing</b> to an unpublished app.
          </CheckRow>
          <div style={{ display: 'flex', gap: 10, padding: '11px 0' }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 800 }}>i</span>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>Consent</div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3, lineHeight: 1.55 }}>
                {n0(row.optin_count)} opt-in(s) recorded here. Opt-in is not required for approved utility
                templates on this account — what matters is <b>opt-out</b>: anyone who opted out or replied
                STOP is excluded from every campaign automatically.
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
        {/* ── Account-level settings ──────────────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Account settings</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
            One Meta token covers the whole account; each number carries its own phone number ID.
          </div>

          <div style={{ maxWidth: 260 }}>
            <label style={label}>Default country code</label>
            <input style={inp} value={form.default_country_code} onChange={e => set('default_country_code', e.target.value.replace(/\D/g, ''))} placeholder="91" />
            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>Prefixed to stored contact numbers that have none (a bare 10-digit mobile).</div>
          </div>

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <button className="wa-btn wa-btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* ── Sending numbers ─────────────────────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Sending numbers</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, lineHeight: 1.5 }}>
                Read automatically from your WhatsApp Business Account each time this page opens — add a
                number in Meta and it appears here on its own. Campaigns pick which one they go out from.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="wa-btn wa-btn-outlined wa-btn-sm" onClick={() => importNumbers()} disabled={importingNumbers}
                title="Re-read your business numbers from the WhatsApp Business Account">
                {importingNumbers ? 'Refreshing…' : 'Refresh'}
              </button>
              {/*
                Refresh only finds numbers on the WABAs this panel already knows about, and
                "+ Add number" registers a brand-new number with Meta. Neither covers the case of
                pointing the panel at a number that exists on a DIFFERENT WABA — a test account,
                or a second business account — where you already have the ids and just need a row.
                Without this there is no way to enter one by hand.
              */}
              <button className="wa-btn wa-btn-text wa-btn-sm" onClick={() => setSenderModal({ sender: null })}
                title="Type in a number that already exists on another WhatsApp Business Account">
                Add manually
              </button>
              <button className="wa-btn wa-btn-contained wa-btn-sm" onClick={() => setAddNumberOpen(true)}
                title="Register a new business number on your WhatsApp Business Account">
                + Add number
              </button>
            </div>
          </div>

          {senders.length === 0 ? (
            <Notice tone="warn" style={{ marginTop: 14 }} title="No sending numbers yet">
              Press <b>Refresh</b> to pull the numbers already on your WhatsApp Business Account, or
              <b> + Add number</b> to register a new one — verification and Cloud API registration happen
              right here.
            </Notice>
          ) : (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {senders.map(s => (
                <div key={s.id} style={{
                  border: `1.5px solid ${s.is_default ? WA.greenDark : '#e2e8f0'}`,
                  background: s.is_default ? '#f0fdf4' : '#fff',
                  borderRadius: 10, padding: '13px 15px', opacity: s.is_active ? 1 : .6,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{s.business_number}</span>
                        {s.display_name && <span style={{ fontSize: 12, color: '#64748b' }}>{s.display_name}</span>}
                        {s.is_default === 1 && (
                          <span style={{ background: WA.greenDark, color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, letterSpacing: '.3px' }}>DEFAULT</span>
                        )}
                        {s.is_active !== 1 && (
                          <span style={{ background: '#f1f5f9', color: '#64748b', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999 }}>OFF</span>
                        )}
                        <span style={{ background: s.ready ? '#dcfce7' : '#fee2e2', color: s.ready ? '#15803d' : '#dc2626', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, letterSpacing: '.3px' }}>
                          {s.ready ? 'CAN SEND' : 'NOT READY'}
                        </span>
                        {/* The route matters as much as readiness here: two numbers can both say
                            CAN SEND while going out through completely different APIs. */}
                        <span title={s.provider === 'netcore'
                          ? 'Sends through Netcore using this number\'s API key'
                          : 'Sends straight to Meta Cloud API using the account token + phone number ID'}
                          style={{
                            background: s.provider === 'netcore' ? '#ede9fe' : '#e0f2fe',
                            color: s.provider === 'netcore' ? '#6d28d9' : '#0369a1',
                            fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, letterSpacing: '.3px',
                          }}>
                          {s.provider === 'netcore' ? 'VIA NETCORE' : 'VIA META'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                        WABA {s.waba_id}{s.waba_name ? ` · ${s.waba_name}` : ''}
                        {s.quality_rating ? ` · quality ${s.quality_rating}` : ''}
                        {s.messaging_limit ? ` · ${s.messaging_limit}` : ''}
                      </div>
                      {/* Show the credential the chosen route actually needs — a Netcore number
                          being told its phone number ID is missing is noise, not a problem. */}
                      <div style={{ fontSize: 10.5, color: s.ready ? '#64748b' : '#dc2626', marginTop: 3, wordBreak: 'break-all' }}>
                        {s.provider === 'netcore'
                          ? <>Netcore API key: {s.has_api_key ? s.api_key_masked : 'not set — press Edit to add it'}
                            {s.has_source ? ` · source ${s.source_id}` : ''}</>
                          : <>Phone number ID: {s.phone_number_id || 'not set — press Refresh'}</>}
                      </div>
                      {s.notes && <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 3 }}>{s.notes}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {s.is_default !== 1 && (
                        <button className="wa-btn wa-btn-text wa-btn-sm" title="Use for new campaigns"
                          onClick={() => senderAction('sender_default', s.id)}>
                          Default
                        </button>
                      )}
                      {/* Only offered once the number has a phone_number_id, since the whole flow
                          addresses Meta by that id. This is the fix for #200 when a BSP still holds
                          the number — destructive enough that the modal itself leads with a warning
                          rather than hiding it behind a tooltip here. */}
                      {!!s.phone_number_id && (
                        <button className="wa-btn wa-btn-outlined wa-btn-sm"
                          title="Register this number to your own Meta app (disconnects your current provider)"
                          onClick={() => setTakeover(s)}>
                          Connect
                        </button>
                      )}
                      {/* Runs the same checks as the Diagnostics panel but aimed at THIS number,
                          including the Cloud API registration check — the one that explains a send
                          rejected with #133010 while the token and WABA both read back fine. */}
                      <button className="wa-btn wa-btn-text wa-btn-sm" disabled={diagnosing}
                        title="Check this number against Meta — token, WABA access and Cloud API registration"
                        onClick={() => { runDiagnose(s.id); document.getElementById('wa-diagnostics')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
                        Check
                      </button>
                      <button className="wa-btn wa-btn-outlined wa-btn-sm" onClick={() => setSenderModal({ sender: s })}>
                        Edit
                      </button>
                      <button className="wa-btn wa-btn-text wa-btn-sm" style={{ color: '#dc2626' }}
                        onClick={() => setConfirmDelete(s)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

          </div>

          <div style={{ minWidth: 0 }}>
        {/* ── Template sync ───────────────────────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Template sync</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14, lineHeight: 1.55 }}>
            Templates belong to your WhatsApp Business Account and <b>Meta</b> approves them, so the list is
            read straight from Meta — which means the approval status you see here is the real one.
          </div>

          <label style={label}>
            Meta access token
            <span style={{ fontWeight: 500, color: '#94a3b8' }}> (currently {row.meta_token_masked})</span>
          </label>
          <input style={inp} type="password" value={form.meta_access_token}
            onChange={e => set('meta_access_token', e.target.value)}
            placeholder="Paste the System User token — leave blank to keep the current one"
            autoComplete="new-password" />

          <Notice tone="info" style={{ marginTop: 12 }} title="How to get the token (one time, ~3 minutes)">
            <div>1. <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noreferrer" style={{ color: '#1e3a8a', fontWeight: 700 }}>business.facebook.com → Business settings → Users → System users</a></div>
            <div>2. Pick (or add) a system user → <b>Generate new token</b>.</div>
            {/* All THREE scopes, and the order they're listed in is the order they bite. Missing
                the messaging one is the nastiest failure on this integration: templates sync
                perfectly, the checklist above goes green, and then every send comes back
                "(#200) You do not have the necessary permissions" — because reading templates
                and sending messages are governed by different scopes. */}
            <div>3. Select the app connected to your WABA, then tick <b>all three</b> scopes:</div>
            <div style={{ margin: '4px 0 4px 14px', lineHeight: 1.7 }}>
              <div><b>whatsapp_business_messaging</b> — sending. Without this, campaigns fail with <b>#200</b>.</div>
              <div><b>whatsapp_business_management</b> — reading and submitting templates.</div>
              <div><b>business_management</b> — numbers and webhook subscription.</div>
            </div>
            <div>4. Under <b>Assigned assets → WhatsApp Accounts</b>, add your WABA with <b>Full control</b>.
              The scope alone is not enough — the asset has to be assigned to the system user too.</div>
            <div>5. Copy the token and paste it above. Choose a <b>never-expiring</b> token, or you'll be
              back here in 60 days.</div>
            <div style={{ marginTop: 6 }}>
              This one token covers everything: reading templates, registering numbers, and sending.
            </div>
          </Notice>

          {/* Its own Save button: this card sits well below the Account settings one, and a field
              whose only save control is off-screen in another card reads as broken. Both write
              through the same endpoint. */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginTop: 14 }}>
            <div style={{ fontSize: 11.5, color: '#64748b', minWidth: 0 }}>
              Reads from WABA <b>{senders[0]?.waba_id || 'the sending number\'s WABA ID'}</b> using
              <code> GET /{'{waba_id}'}/message_templates</code>. Run it from the Templates page.
            </div>
            <button onClick={save} disabled={saving}
              style={{ padding: '10px 24px', border: 'none', background: WA.primary, color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', flexShrink: 0 }}>
              {saving ? 'Saving…' : 'Save token'}
            </button>
          </div>
        </div>

        {/* ── Connection test ─────────────────────────────────────────────────────────── */}
        <div id="wa-diagnostics" style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Check the credentials</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
            Reads your WhatsApp Business Account back from Meta: a success proves the token is live and has
            the right scopes. It does <b>not</b> prove your templates are approved — only a delivered message
            does, so send a test from a campaign too.
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, maxWidth: 280 }}>
              <label style={label}>Your WhatsApp number</label>
              <input style={inp} value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="9921079337" />
            </div>
            <button onClick={runTest} disabled={testing}
              style={{ padding: '10px 20px', border: `1.5px solid ${WA.greenDark}`, background: '#fff', color: WA.greenDark, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: testing ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
              {testing ? 'Checking…' : 'Run check'}
            </button>
            {/* Separate from "Run check" because it answers a different question. Run check asks
                "does the token work at all"; this asks "WHY does it not work" — it reads the
                token's own scopes and asset grants back from Meta, which is the only way to tell
                Meta's three different causes of #200 apart. */}
            <button onClick={() => runDiagnose()} disabled={diagnosing}
              style={{ padding: '10px 20px', border: '1.5px solid #e2e8f0', background: '#fff', color: WA.primary, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: diagnosing ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
              {diagnosing ? 'Reading…' : 'Diagnose #200'}
            </button>
          </div>

          {testResult && (
            <Notice tone={testResult.ok ? 'success' : 'danger'} style={{ marginTop: 14 }}
              title={testResult.ok ? 'Credentials accepted' : 'The provider rejected the request'}>
              {testResult.message}
              {(testResult.notes || []).map((n, i) => <div key={i} style={{ marginTop: 6 }}>• {n}</div>)}
            </Notice>
          )}

          {diagnosis && (
            <div style={{ marginTop: 14, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: diagnosis.ok ? '#f0fdf4' : '#fef2f2', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: diagnosis.ok ? '#15803d' : '#dc2626' }}>
                  {diagnosis.ok ? 'Token permissions look correct' : 'Found the problem'}
                </div>
                <div style={{ fontSize: 11.5, color: '#475569', marginTop: 3, lineHeight: 1.55 }}>{diagnosis.summary}</div>
              </div>
              {(diagnosis.checks || []).map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 9, padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: c.ok ? '#dcfce7' : '#fee2e2', color: c.ok ? '#16a34a' : '#dc2626', fontSize: 11, fontWeight: 800 }}>
                    {c.ok ? '✓' : '!'}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c.ok ? '#0f172a' : '#dc2626' }}>{c.title}</div>
                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2, lineHeight: 1.55, wordBreak: 'break-word' }}>{c.detail}</div>
                    {c.fix && (
                      <div style={{ fontSize: 11.5, color: '#0f172a', marginTop: 5, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '7px 9px', lineHeight: 1.6 }}>
                        <b>Fix:</b> {c.fix}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {(diagnosis.scopes || []).length > 0 && (
                <div style={{ padding: '9px 14px', background: '#f8fafc', fontSize: 10.5, color: '#94a3b8', wordBreak: 'break-word' }}>
                  Token scopes: {diagnosis.scopes.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Consent ─────────────────────────────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Consent management</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
            <b>Opt-out is what matters here</b> — those numbers are excluded from every campaign
            automatically, and a contact replying "STOP" is added for you by the webhook. Meta has no opt-in
            API, so consent itself is your own record; this list is the suppression side of it.
          </div>
          <label style={label}>Numbers <span style={{ fontWeight: 500, color: '#94a3b8' }}>(comma, semicolon or newline separated)</span></label>
          <textarea rows={3} style={{ ...inp, resize: 'vertical' }} value={optinPhones}
            onChange={e => setOptinPhones(e.target.value)} placeholder="9921079337, 919876543210" />
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button onClick={() => registerConsent('optin')} disabled={optinBusy}
              style={{ padding: '9px 18px', border: 'none', background: WA.green, color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: optinBusy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
              Register opt-in
            </button>
            <button onClick={() => registerConsent('optout')} disabled={optinBusy}
              style={{ padding: '9px 18px', border: '1.5px solid #fecaca', background: '#fff', color: '#dc2626', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: optinBusy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
              Register opt-out
            </button>
          </div>

          {optins.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: '#475569', marginBottom: 8 }}>
                MOST RECENT ({n0(optinTotal)} total)
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                {optins.map((o, i) => (
                  <div key={o.phone} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '8px 12px', fontSize: 11.5, borderBottom: i < optins.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>+{o.phone}</span>
                    <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ color: '#94a3b8' }}>{o.source}</span>
                      <span style={{ color: '#94a3b8' }}>{fmtDt(o.updated_at)}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 9.5, fontWeight: 800, background: o.status === 'optin' ? '#dcfce7' : '#fee2e2', color: o.status === 'optin' ? '#15803d' : '#dc2626' }}>
                        {o.status === 'optin' ? 'OPTED IN' : 'OPTED OUT'}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Webhook ─────────────────────────────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Delivery webhook</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
            Register this URL on your Meta app: <b>App dashboard → WhatsApp → Configuration → Callback
            URL</b>, then subscribe to the <b>messages</b> field. It is the only thing that can move
            Delivered / Read / Clicked — the send API returning success means "accepted", not "delivered",
            so those counters stay at 0 until it's wired up.
          </div>
          <div style={{ padding: '11px 13px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 14 }}>
            <code style={{ fontSize: 11.5, color: WA.primary, wordBreak: 'break-all' }}>{webhookUrl}</code>
          </div>
          <label style={label}>Webhook secret <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional)</span></label>
          {/* Its own Save button. This card sits at the bottom of the column and the account
              Save is off-screen above it — a field whose only save control you can't see reads
              as broken. Both write through the same endpoint. */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input style={{ ...inp, flex: 1, minWidth: 0 }} value={form.webhook_secret} onChange={e => set('webhook_secret', e.target.value)}
              placeholder="Leave blank to accept unauthenticated callbacks" />
            <button className="wa-btn wa-btn-primary" onClick={save} disabled={saving} style={{ flexShrink: 0 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>
            This is the <b>Verify token</b> Meta asks for when you save the callback URL, and it is used
            for exactly that — the one-time handshake. Save it here first, then paste the same value into Meta.
          </div>

          {/*
            Separate from the verify token above, and the distinction matters: Meta never echoes the
            verify token back on a delivery. It signs the raw body with the APP SECRET
            (X-Hub-Signature-256). Without this value the endpoint has to accept unsigned calls,
            which means anyone who learns the URL could post a fake "delivered" or inject a message
            into the inbox.
          */}
          <div style={{ marginTop: 14 }}>
            <label style={label}>
              Meta app secret <span style={{ fontWeight: 500, color: '#94a3b8' }}>(recommended)</span>
              {row?.has_app_secret && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#15803d' }}>
                  ✓ SIGNATURES VERIFIED
                </span>
              )}
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input style={{ ...inp, flex: 1, minWidth: 0 }} type="password" autoComplete="off"
                value={form.meta_app_secret} onChange={e => set('meta_app_secret', e.target.value)}
                placeholder={row?.has_app_secret ? row.app_secret_masked : 'App dashboard → App settings → Basic → App secret'} />
              <button className="wa-btn wa-btn-primary" onClick={save} disabled={saving} style={{ flexShrink: 0 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4, lineHeight: 1.5 }}>
              Found under <b>App settings → Basic → App secret</b> (click Show). Meta signs every webhook
              body with it; leaving this blank means callbacks are accepted without verification.
            </div>
          </div>

          {/* Setting the Callback URL is only half of it — the app must also be subscribed to
              this specific WABA, or Meta verifies the URL and then sends nothing at all. That
              step has no visible signal anywhere in the app dashboard, so it's surfaced here. */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>Apps subscribed to this WABA</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, lineHeight: 1.5 }}>
                  {webhookSub === null
                    ? 'Not checked yet.'
                    : webhookSub.subscribed
                      ? <>Currently: <b>{webhookSub.apps.map(a => a.name || a.id).join(', ')}</b>. Several apps
                        can be subscribed at once — yours must be one of them, or events go only to the others.</>
                      : 'None. Meta will accept the callback URL and then send nothing — the usual reason Delivered stays at 0.'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="wa-btn wa-btn-text wa-btn-sm" onClick={checkWebhookSub} disabled={webhookBusy}>Check</button>
                {/* Offered even when something is already subscribed: a WABA can carry several
                    subscribed apps, and a BSP's app being on the list says nothing about whether
                    OURS is. Subscribing is additive and doesn't displace anyone. */}
                <button className="wa-btn wa-btn-contained wa-btn-sm" onClick={subscribeWebhook} disabled={webhookBusy}>
                  Subscribe this app
                </button>
              </div>
            </div>
          </div>
        </div>
          </div>
        </div>
      </div>

      {addNumberOpen && (
        <WaAddNumberModal
          wabaId={senders[0]?.waba_id || ''}
          onClose={() => setAddNumberOpen(false)}
          onDone={() => load({ allowAutoSync: false })}
        />
      )}

      {takeover && (
        <WaAddNumberModal
          wabaId={takeover.waba_id || ''}
          existing={takeover}
          onClose={() => setTakeover(null)}
          onDone={() => load({ allowAutoSync: false })}
        />
      )}

      {senderModal && (
        <WaSenderModal
          sender={senderModal.sender}
          // Offered as suggestions when adding a second number — in practice every number
          // belongs to the same WABA, and retyping a 16-digit id is how they end up mismatched.
          existingWabas={Object.values(senders.reduce((acc, s) => {
            if (!acc[s.waba_id]) acc[s.waba_id] = { waba_id: s.waba_id, waba_name: s.waba_name };
            return acc;
          }, {}))}
          onClose={() => setSenderModal(null)}
          onSaved={() => { setSenderModal(null); load(); }}
        />
      )}

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 960, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setConfirmDelete(null)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 26, width: 420, fontFamily: "'Plus Jakarta Sans',sans-serif" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
              Remove {confirmDelete.business_number}?
            </div>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, marginBottom: 20 }}>
              Campaigns that already sent or are scheduled keep their own copy of this number, so nothing
              in flight changes. Drafts pointing at it will fall back to the default number.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)}
                style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>CANCEL</button>
              <button onClick={() => { senderAction('sender_delete', confirmDelete.id); setConfirmDelete(null); }}
                style={{ padding: '9px 18px', border: 'none', background: '#dc2626', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>REMOVE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
