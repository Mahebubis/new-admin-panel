import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

/*
 * Email domains and their DNS configuration.
 *
 * WHY THIS SCREEN EARNS ITS PLACE
 * Mail sent from a domain the ESP has not authenticated lands in spam, and nothing anywhere
 * reports that: the campaign says 100% delivered and the opens are simply lower than they should
 * be. Domain authentication has the widest gap on the whole panel between "not done" and
 * "visibly not done", so it gets a screen of its own rather than living in the ESP dashboard.
 *
 * The add flow is two steps for a reason that is not decoration: step one is the only thing you
 * can do from here (name the domain — the ESP then generates the records), and step two is a
 * task performed somewhere else entirely, at a DNS host, possibly by a different person on a
 * different day. Putting them on one screen implies the second half happens now, which it
 * usually does not — hence the copy buttons, the CSV download and the "come back and verify"
 * framing throughout.
 */

const API  = '/api/campaigns/domains.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

const STATUS = {
  active:  { label: 'Active',  bg: '#dcfae6', fg: '#067647', bd: '#a9efc5' },
  pending: { label: 'Pending', bg: '#fef0c7', fg: '#b54708', bd: '#fedf89' },
  failed:  { label: 'Failed',  bg: '#fee4e2', fg: '#b42318', bd: '#fecdca' },
};

const CSS = `
.ed { padding:20px 24px 40px; height:100%; overflow-y:auto; box-sizing:border-box; }
.ed-h { display:flex; align-items:flex-start; gap:14px; margin-bottom:20px; flex-wrap:wrap; }
.ed-h h1 { font-size:21px; font-weight:750; color:#101828; margin:0 0 4px; }
.ed-h p { font-size:13px; color:#667085; margin:0; max-width:620px; line-height:1.6; }

.ed-btn { display:inline-flex; align-items:center; gap:8px; padding:10px 17px; border-radius:9px;
  font-size:13.5px; font-weight:650; font-family:inherit; cursor:pointer; border:1px solid transparent;
  transition:background 170ms cubic-bezier(.4,0,.2,1), box-shadow 170ms, transform 90ms, border-color 170ms, color 170ms; }
.ed-btn:active:not(:disabled) { transform:translateY(1px); }
.ed-btn:focus-visible { outline:2px solid #4f46e5; outline-offset:2px; }
.ed-btn:disabled { opacity:.5; cursor:not-allowed; }
.ed-btn-solid { background:#4f46e5; color:#fff; box-shadow:0 1px 2px rgba(16,24,40,.06); }
.ed-btn-solid:hover:not(:disabled) { background:#4338ca; box-shadow:0 6px 16px rgba(79,70,229,.32); }
.ed-btn-ghost { background:#fff; color:#344054; border-color:#d0d5dd; }
.ed-btn-ghost:hover:not(:disabled) { background:#f9fafb; border-color:#98a2b3; }
.ed-btn-sm { padding:6px 12px; font-size:12.5px; border-radius:7px; }

.ed-card { background:#fff; border:1px solid #e4e7ec; border-radius:12px; overflow:hidden;
  box-shadow:0 1px 2px rgba(16,24,40,.05); }
.ed-tbl { width:100%; border-collapse:collapse; }
.ed-tbl th { text-align:left; font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase;
  color:#667085; padding:12px 16px; background:#f9fafb; border-bottom:1px solid #e4e7ec; }
.ed-tbl td { padding:15px 16px; font-size:13px; color:#344054; border-bottom:1px solid #f2f4f7; vertical-align:middle; }
.ed-tbl tbody tr { transition:background 130ms cubic-bezier(.4,0,.2,1); }
.ed-tbl tbody tr:hover { background:#f9fafb; }
.ed-tbl tbody tr:last-child td { border-bottom:0; }
.ed-dom { font-weight:650; color:#101828; display:inline-flex; align-items:center; gap:8px; }
.ed-badge { display:inline-flex; padding:3px 10px; border-radius:999px; font-size:10.5px; font-weight:800;
  letter-spacing:.04em; text-transform:uppercase; border:1px solid transparent; }
.ed-default { font-size:10px; font-weight:700; color:#3730a3; background:#eef2ff; border:1px solid #c7d7fe;
  border-radius:5px; padding:1px 7px; }

.ed-prog { display:inline-flex; align-items:center; gap:8px; font-size:12px; color:#667085; }
.ed-prog .bar { width:74px; height:6px; border-radius:999px; background:#eaecf0; overflow:hidden; }
.ed-prog .bar i { display:block; height:100%; border-radius:999px; background:#12b76a;
  transition:width 420ms cubic-bezier(.4,0,.2,1); }

.ed-empty { padding:60px 24px; text-align:center; color:#667085; }
.ed-empty b { display:block; font-size:15.5px; font-weight:700; color:#344054; margin-bottom:6px; }

/* ── wizard ─────────────────────────────────────────────────────────────────────────────── */
.ed-wz { position:fixed; inset:0; z-index:70; background:#fff; display:flex; flex-direction:column;
  animation:ed-in 240ms cubic-bezier(.4,0,.2,1); }
@keyframes ed-in { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
.ed-wz-head { flex:none; display:flex; align-items:center; gap:16px; padding:14px 24px;
  border-bottom:1px solid #e4e7ec; }
.ed-back { width:34px; height:34px; display:grid; place-items:center; border:1px solid #e4e7ec; background:#fff;
  border-radius:9px; color:#475467; cursor:pointer; transition:all 160ms cubic-bezier(.4,0,.2,1); }
.ed-back:hover { background:#f9fafb; border-color:#98a2b3; color:#101828; }
.ed-steps { display:flex; align-items:center; gap:12px; }
.ed-step { display:inline-flex; align-items:center; gap:9px; font-size:13px; font-weight:650; color:#98a2b3; }
.ed-step .n { width:26px; height:26px; border-radius:50%; display:grid; place-items:center; font-size:12px;
  border:1.5px solid #d0d5dd; color:#98a2b3; background:#fff;
  transition:all 220ms cubic-bezier(.4,0,.2,1); }
.ed-step.on { color:#101828; }
.ed-step.on .n { border-color:#4f46e5; color:#4f46e5; background:#eef2ff; }
.ed-step.done { color:#067647; }
.ed-step.done .n { border-color:#12b76a; background:#12b76a; color:#fff; }
.ed-rule { width:56px; height:1.5px; background:#e4e7ec; }
.ed-rule.done { background:#12b76a; }

.ed-wz-body { flex:1; overflow-y:auto; padding:34px 24px 40px; }
.ed-wz-inner { max-width:960px; margin:0 auto; }
.ed-wz-inner h2 { font-size:20px; font-weight:750; color:#101828; margin:0 0 6px; }
.ed-wz-inner > p { font-size:13.5px; color:#667085; margin:0 0 24px; max-width:620px; line-height:1.65; }

.ed-label { display:block; font-size:12.5px; font-weight:700; color:#344054; margin-bottom:7px; }
.ed-input { width:100%; max-width:520px; box-sizing:border-box; padding:11px 14px; border:1px solid #d0d5dd;
  border-radius:9px; font-size:14px; font-family:inherit; color:#101828; outline:none;
  transition:border-color 170ms cubic-bezier(.4,0,.2,1), box-shadow 170ms; }
.ed-input:hover { border-color:#98a2b3; }
.ed-input:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,.14); }
.ed-help { font-size:12px; color:#98a2b3; margin-top:8px; max-width:520px; line-height:1.6; }

.ed-dns { width:100%; border-collapse:collapse; }
.ed-dns th { text-align:left; font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase;
  color:#667085; padding:11px 14px; background:#f9fafb; border-bottom:1px solid #e4e7ec; }
.ed-dns td { padding:13px 14px; font-size:12.5px; color:#344054; border-bottom:1px solid #f2f4f7; vertical-align:top; }
.ed-dns tr:last-child td { border-bottom:0; }
.ed-mono { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; color:#101828;
  background:#f9fafb; border:1px solid #eaecf0; border-radius:7px; padding:7px 9px;
  display:flex; align-items:center; gap:8px; word-break:break-all; }
.ed-copy { flex:none; width:24px; height:24px; display:grid; place-items:center; border:0; border-radius:6px;
  background:none; color:#98a2b3; cursor:pointer; transition:background 140ms, color 140ms; }
.ed-copy:hover { background:#eef2ff; color:#4f46e5; }
.ed-copy.ok { color:#12b76a; }

.ed-rowstatus { display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:700;
  padding:3px 9px; border-radius:999px; white-space:nowrap; }

.ed-note { display:flex; gap:10px; padding:13px 15px; border-radius:10px; font-size:12.5px; line-height:1.65;
  margin-bottom:20px; }
.ed-note svg { flex:none; margin-top:2px; }
.ed-note-info { background:#f5f8ff; border:1px solid #d1e0ff; color:#1849a9; }
.ed-note-warn { background:#fffaeb; border:1px solid #fedf89; color:#93370d; }
.ed-note-ok   { background:#ecfdf3; border:1px solid #a9efc5; color:#067647; }
`;

const Ico = {
  copy: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
  ok:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>,
  back: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>,
  info: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>,
  warn: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
  down: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 11l5 5 5-5M4 21h16" /></svg>,
};

function CopyField({ text }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    } catch { toast.error('Could not copy — select the text instead'); }
  };
  return (
    <div className="ed-mono">
      <span style={{ flex: 1 }}>{text}</span>
      <button className={`ed-copy${done ? ' ok' : ''}`} onClick={copy}
              aria-label={done ? 'Copied' : `Copy ${text}`}>{done ? Ico.ok : Ico.copy}</button>
    </div>
  );
}

/** Per-record verification state. Three states, not two — "resolves, but to something else" is
 *  a different problem from "not there yet" and has a different fix. */
function RecordStatus({ rec }) {
  const local = rec.local || {};
  if (rec.status === 'verified' || local.match) {
    return <span className="ed-rowstatus" style={{ background: '#dcfae6', color: '#067647' }}>Verified</span>;
  }
  if (local.resolved && !local.match) {
    return (
      <span className="ed-rowstatus" style={{ background: '#fee4e2', color: '#b42318' }}
            title={`Currently resolves to ${local.found}`}>Points elsewhere</span>
    );
  }
  return <span className="ed-rowstatus" style={{ background: '#fef0c7', color: '#b54708' }}>Not updated</span>;
}

function DnsTable({ records }) {
  return (
    <div className="ed-card">
      <table className="ed-dns">
        <thead>
          <tr>
            <th style={{ width: '24%' }}>Purpose</th>
            <th style={{ width: 90 }}>Type</th>
            <th style={{ width: '26%' }}>Host name</th>
            <th>Value</th>
            <th style={{ width: 130 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={`${r.host}-${i}`}>
              <td style={{ color: '#475467' }}>{r.purpose}</td>
              <td style={{ fontWeight: 650 }}>{r.type}</td>
              <td><CopyField text={r.host} /></td>
              <td><CopyField text={r.value} /></td>
              <td><RecordStatus rec={r} />{r.reason && <div style={{ fontSize: 11, color: '#b42318', marginTop: 5 }}>{r.reason}</div>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EmailDomains() {
  const [domains, setDomains] = useState([]);
  const [provider, setProvider] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(0);

  const [wizard, setWizard] = useState(null);   // { step, domain, id, records }
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(API, { params: { action: 'list' } });
      if (res.data?.success) {
        setDomains(res.data.data.domains || []);
        setProvider(res.data.data.active_provider || '');
      } else toast.error(res.data?.message || 'Could not load domains');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not load domains');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startAdd = () => { setWizard({ step: 1, domain: '', id: null, records: [] }); setVerifyMsg(null); };

  const submitDomain = async () => {
    const d = (wizard.domain || '').trim();
    if (!d) { toast.error('Enter a domain name'); return; }
    setAdding(true);
    try {
      const res = await api.post(API, new URLSearchParams({ action: 'add', domain: d }), FORM);
      if (res.data?.success) {
        setWizard(w => ({ ...w, step: 2, id: res.data.data.id, domain: res.data.data.domain, records: res.data.data.records || [] }));
        load();
      } else toast.error(res.data?.message || 'Could not add the domain');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not add the domain');
    } finally { setAdding(false); }
  };

  const openDomain = async id => {
    setBusy(id);
    try {
      const res = await api.get(API, { params: { action: 'get', id } });
      if (res.data?.success) {
        const d = res.data.data.domain;
        setWizard({ step: 2, id: d.id, domain: d.domain, records: d.records || [] });
        setVerifyMsg(null);
      }
    } catch (e) { toast.error(e?.response?.data?.message || 'Could not open the domain'); }
    finally { setBusy(0); }
  };

  const verify = async () => {
    setVerifying(true);
    try {
      const res = await api.post(API, new URLSearchParams({ action: 'verify', id: String(wizard.id) }), FORM);
      if (res.data?.success) {
        const d = res.data.data;
        setWizard(w => ({ ...w, records: d.records || w.records }));
        setVerifyMsg({ ok: d.status === 'active', text: d.message, espError: d.esp_error });
        if (d.status === 'active') toast.success('Domain verified');
        load();
      } else toast.error(res.data?.message || 'Could not verify');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not verify');
    } finally { setVerifying(false); }
  };

  const setDefault = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await api.post(API, new URLSearchParams({ action: 'set_default', id: String(id) }), FORM);
      if (res.data?.success) { toast.success('Default sending domain updated'); load(); }
      else toast.error(res.data?.message || 'Could not set the default');
    } catch (err) { toast.error(err?.response?.data?.message || 'Could not set the default'); }
  };

  const remove = async (d, e) => {
    e.stopPropagation();
    if (!window.confirm(`Remove ${d.domain}? It will also be removed from ${provider}, and campaigns sending from it will start failing.`)) return;
    try {
      const res = await api.post(API, new URLSearchParams({ action: 'delete', id: String(d.id) }), FORM);
      if (res.data?.success) { toast.success('Domain removed'); load(); }
      else toast.error(res.data?.message || 'Could not remove');
    } catch (err) { toast.error(err?.response?.data?.message || 'Could not remove'); }
  };

  /** The record table as a CSV — DNS is usually entered by whoever owns the registrar, not by
   *  whoever is looking at this screen, and that handoff happens as a file or a paste. */
  const downloadCsv = () => {
    const rows = [['Purpose', 'Type', 'Host name', 'Value'],
      ...wizard.records.map(r => [r.purpose, r.type, r.host, r.value])];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `dns-${wizard.domain}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  /* ── wizard ─────────────────────────────────────────────────────────────────────────── */
  if (wizard) {
    const verifiedCount = wizard.records.filter(r => r.status === 'verified' || r.local?.match).length;
    return (
      <div className="ed-wz">
        <style>{CSS}</style>
        <div className="ed-wz-head">
          <button className="ed-back" onClick={() => setWizard(null)} aria-label="Back to domains">{Ico.back}</button>
          <div className="ed-steps">
            <span className={`ed-step ${wizard.step === 1 ? 'on' : 'done'}`}>
              <span className="n">{wizard.step === 1 ? '1' : Ico.ok}</span> Domain
            </span>
            <span className={`ed-rule ${wizard.step === 2 ? 'done' : ''}`} />
            <span className={`ed-step ${wizard.step === 2 ? 'on' : ''}`}>
              <span className="n">2</span> DNS configuration
            </span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            {wizard.step === 1
              ? <button className="ed-btn ed-btn-solid" onClick={submitDomain} disabled={adding || !wizard.domain.trim()}>
                  {adding ? 'Creating…' : 'Next step'}
                </button>
              : <button className="ed-btn ed-btn-solid" onClick={() => setWizard(null)}>Done</button>}
          </div>
        </div>

        <div className="ed-wz-body">
          <div className="ed-wz-inner">
            {wizard.step === 1 ? (
              <>
                <h2>Domain name</h2>
                <p>
                  The domain your campaigns will send from. Authenticating it is what stops mail
                  being filtered as spam — and nothing reports when that is happening, so an
                  unauthenticated domain simply performs badly for no visible reason.
                </p>
                <label className="ed-label" htmlFor="ed-domain">Domain name *</label>
                <input id="ed-domain" className="ed-input" value={wizard.domain} autoFocus
                       placeholder="alert.internshipstudio.com"
                       onChange={e => setWizard(w => ({ ...w, domain: e.target.value }))}
                       onKeyDown={e => { if (e.key === 'Enter') submitDomain(); }} />
                <p className="ed-help">
                  Use the exact host your <b>From</b> address uses. A subdomain such as
                  <b> alert.yourdomain.com</b> is the usual choice: it keeps campaign reputation
                  separate from the domain your staff email runs on, so a bad campaign cannot damage
                  ordinary mail delivery.
                </p>
                <div className="ed-note ed-note-info" style={{ marginTop: 22, maxWidth: 620 }}>
                  {Ico.info}
                  <div>
                    The DNS records come from <b>{provider || 'your ESP'}</b>, which is the provider
                    currently sending. Switching provider later means adding the domain again — the
                    records are provider-specific and are not interchangeable.
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2>DNS configuration</h2>
                <p>
                  Add these records at your DNS host, then press Verify. Propagation usually takes
                  a few minutes and can take up to 48 hours — nothing is lost by closing this and
                  coming back to verify later.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#101828' }}>
                    Domain name: <span style={{ fontWeight: 600, color: '#475467' }}>{wizard.domain}</span>
                  </div>
                  <span className="ed-prog" style={{ marginLeft: 8 }}>
                    <span className="bar"><i style={{ width: `${wizard.records.length ? (verifiedCount / wizard.records.length) * 100 : 0}%` }} /></span>
                    {verifiedCount} of {wizard.records.length} verified
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 9 }}>
                    <button className="ed-btn ed-btn-ghost ed-btn-sm" onClick={downloadCsv}>{Ico.down} Download</button>
                    <button className="ed-btn ed-btn-solid ed-btn-sm" onClick={verify} disabled={verifying}>
                      {verifying ? 'Checking…' : 'Verify'}
                    </button>
                  </div>
                </div>

                {verifyMsg && (
                  <div className={`ed-note ${verifyMsg.ok ? 'ed-note-ok' : 'ed-note-warn'}`}>
                    {verifyMsg.ok ? Ico.ok : Ico.warn}
                    <div>
                      {verifyMsg.text}
                      {verifyMsg.espError && (
                        <div style={{ marginTop: 6, fontSize: 11.5, opacity: .85 }}>
                          Provider said: {verifyMsg.espError}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <DnsTable records={wizard.records} />

                <div className="ed-note ed-note-info" style={{ marginTop: 18 }}>
                  {Ico.info}
                  <div>
                    <b>Points elsewhere</b> means the host resolves, but to a different value — almost
                    always a record left behind by a previous provider. Replace it rather than adding
                    a second one; two CNAMEs on the same host is invalid and neither will work.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── list ───────────────────────────────────────────────────────────────────────────── */
  return (
    <div className="ed">
      <style>{CSS}</style>
      <div className="ed-h">
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1>Email domains</h1>
          <p>
            Domains your campaigns can send from. Only a verified domain is authenticated at the
            provider — anything else risks being filtered, silently.
          </p>
        </div>
        <button className="ed-btn ed-btn-solid" onClick={startAdd}>{Ico.plus} Add domain</button>
      </div>

      <div className="ed-card">
        <table className="ed-tbl">
          <thead>
            <tr>
              <th style={{ width: '34%' }}>Domain name</th>
              <th style={{ width: '20%' }}>Submitted on</th>
              <th style={{ width: '22%' }}>DNS records</th>
              <th style={{ width: 120 }}>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {domains.map(d => {
              const s = STATUS[d.status] || STATUS.pending;
              const pct = d.record_count ? (d.verified_count / d.record_count) * 100 : 0;
              return (
                <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => openDomain(d.id)}>
                  <td>
                    <span className="ed-dom">
                      {d.domain}
                      {d.is_default ? <span className="ed-default">Default</span> : null}
                    </span>
                    <div style={{ fontSize: 11, color: '#98a2b3', marginTop: 3 }}>via {d.provider}</div>
                  </td>
                  <td style={{ color: '#667085' }}>{String(d.created_at || '').replace('T', ' ').slice(0, 16) || '—'}</td>
                  <td>
                    <span className="ed-prog">
                      <span className="bar"><i style={{ width: `${pct}%` }} /></span>
                      {d.verified_count}/{d.record_count}
                    </span>
                  </td>
                  <td>
                    <span className="ed-badge" style={{ background: s.bg, color: s.fg, borderColor: s.bd }}>{s.label}</span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
                      <button className="ed-btn ed-btn-ghost ed-btn-sm" onClick={() => openDomain(d.id)} disabled={busy === d.id}>
                        {busy === d.id ? 'Opening…' : 'DNS'}
                      </button>
                      {!d.is_default && d.status === 'active' && (
                        <button className="ed-btn ed-btn-ghost ed-btn-sm" onClick={e => setDefault(d.id, e)}>Make default</button>
                      )}
                      <button className="ed-btn ed-btn-ghost ed-btn-sm" onClick={e => remove(d, e)}
                              style={{ color: '#b42318', borderColor: '#fecdca' }}>Remove</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && !domains.length && (
              <tr><td colSpan={5}>
                <div className="ed-empty">
                  <b>No sending domain has been added yet</b>
                  Campaigns sent from an unauthenticated domain are far more likely to land in spam,
                  and nothing in the reports will tell you that is what happened.
                </div>
              </td></tr>
            )}
            {loading && !domains.length && (
              <tr><td colSpan={5}><div className="ed-empty">Loading domains…</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
