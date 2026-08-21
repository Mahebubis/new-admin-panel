import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

/*
 * WhatsApp Blocklist — every number that must never receive a WhatsApp message again.
 *
 * The rows are wa_optins with status='optout'. There is deliberately no separate blocklist
 * table: campaign sending already filters on wa_optins (wa_optin_map in WaSendWorker), so a
 * second table would be a second answer to "may we message this person?" and the two would
 * eventually disagree. Blocking here is therefore the same write a STOP reply performs.
 *
 * Numbers arrive here three ways, and the Source column says which:
 *   REPLY    the contact replied STOP / UNSUBSCRIBE / CANCEL … on WhatsApp
 *   WEBHOOK  the provider reported an opt-out (Netcore's consent tab, or a block at Meta)
 *   ADMIN    someone typed it in on this screen
 */

const API  = '/api/whatsapp/wa_settings.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const PER_PAGE = 25;

const SOURCE_LABEL = {
  REPLY:   { text: 'Replied STOP', bg: '#fef2f2', fg: '#b42318', bd: '#fecdca' },
  WEBHOOK: { text: 'Provider',     bg: '#eff6ff', fg: '#1849a9', bd: '#b2ddff' },
  ADMIN:   { text: 'Added by admin', bg: '#f5f3ff', fg: '#5925dc', bd: '#d9d6fe' },
  WEB:     { text: 'Web form',     bg: '#f8fafc', fg: '#475467', bd: '#e4e7ec' },
};

const CSS = `
.wabl { font-family: inherit; color: #101828; }
.wabl-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
.wabl-search { position: relative; flex: 1 1 260px; max-width: 380px; }
.wabl-search input {
  width: 100%; padding: 9px 12px 9px 34px; border: 1px solid #d0d5dd; border-radius: 8px;
  font-size: 13px; font-family: inherit; color: #101828; background: #fff; outline: none;
  transition: border-color 160ms cubic-bezier(.4,0,.2,1), box-shadow 160ms cubic-bezier(.4,0,.2,1);
}
.wabl-search input:hover { border-color: #98a2b3; }
.wabl-search input:focus { border-color: #128C7E; box-shadow: 0 0 0 3px rgba(18,140,126,.14); }
.wabl-search svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: #98a2b3; }

.wabl-btn {
  display: inline-flex; align-items: center; gap: 7px; padding: 9px 15px; border-radius: 8px;
  font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; border: 1px solid transparent;
  transition: background 160ms cubic-bezier(.4,0,.2,1), box-shadow 160ms, transform 90ms, border-color 160ms, color 160ms;
}
.wabl-btn:active:not(:disabled) { transform: translateY(1px); }
.wabl-btn:focus-visible { outline: 2px solid #128C7E; outline-offset: 2px; }
.wabl-btn:disabled { opacity: .55; cursor: default; }
.wabl-btn-solid { background: #128C7E; color: #fff; box-shadow: 0 1px 2px rgba(16,24,40,.06); }
.wabl-btn-solid:hover:not(:disabled) { background: #0f7a6d; box-shadow: 0 4px 10px rgba(18,140,126,.26); }
.wabl-btn-ghost { background: #fff; color: #344054; border-color: #d0d5dd; }
.wabl-btn-ghost:hover:not(:disabled) { background: #f9fafb; border-color: #98a2b3; }

.wabl-card { background: #fff; border: 1px solid #e4e7ec; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px rgba(16,24,40,.05); }
.wabl-table { width: 100%; border-collapse: collapse; }
.wabl-table th {
  text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
  color: #667085; padding: 11px 16px; background: #f9fafb; border-bottom: 1px solid #e4e7ec; white-space: nowrap;
}
.wabl-table td { padding: 13px 16px; font-size: 13px; color: #344054; border-bottom: 1px solid #f2f4f7; vertical-align: middle; }
.wabl-table tbody tr { transition: background 130ms cubic-bezier(.4,0,.2,1); }
.wabl-table tbody tr:hover { background: #f9fafb; }
.wabl-table tbody tr:last-child td { border-bottom: 0; }
.wabl-phone { font-variant-numeric: tabular-nums; font-weight: 650; color: #101828; letter-spacing: .01em; }
.wabl-reason { color: #667085; max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.wabl-chip {
  display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 999px;
  font-size: 11px; font-weight: 700; border: 1px solid transparent; white-space: nowrap;
}

.wabl-unblock {
  padding: 5px 11px; border-radius: 7px; font-size: 12px; font-weight: 650; font-family: inherit;
  border: 1px solid #d0d5dd; background: #fff; color: #475467; cursor: pointer;
  transition: all 160ms cubic-bezier(.4,0,.2,1);
}
.wabl-unblock:hover:not(:disabled) { border-color: #128C7E; color: #128C7E; background: #f0fdf9; }
.wabl-unblock:active:not(:disabled) { transform: scale(.96); }
.wabl-unblock:disabled { opacity: .5; cursor: default; }

.wabl-empty { padding: 56px 24px; text-align: center; color: #667085; }
.wabl-empty b { display: block; font-size: 15px; font-weight: 700; color: #344054; margin-bottom: 5px; }

.wabl-foot { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-top: 1px solid #f2f4f7; background: #fcfcfd; }
.wabl-page { display: flex; gap: 4px; margin-left: auto; }
.wabl-page button {
  min-width: 30px; height: 30px; padding: 0 8px; border-radius: 7px; border: 1px solid #d0d5dd;
  background: #fff; color: #475467; font-size: 12.5px; font-weight: 600; font-family: inherit; cursor: pointer;
  transition: all 150ms cubic-bezier(.4,0,.2,1);
}
.wabl-page button:hover:not(:disabled) { background: #f9fafb; border-color: #98a2b3; }
.wabl-page button:disabled { opacity: .4; cursor: default; }
.wabl-page button[aria-current="true"] { background: #128C7E; border-color: #128C7E; color: #fff; }

/* Add-numbers panel — collapses rather than opening a modal: blocking a number is a small,
   frequent action and a dialog for it is a click of ceremony nobody needs. */
.wabl-add { border: 1px solid #e4e7ec; border-radius: 12px; background: #fff; padding: 16px; margin-bottom: 14px; box-shadow: 0 1px 2px rgba(16,24,40,.05); }
.wabl-add label { display: block; font-size: 12px; font-weight: 700; color: #344054; margin-bottom: 6px; }
.wabl-add textarea, .wabl-add input[type=text] {
  width: 100%; box-sizing: border-box; padding: 9px 12px; border: 1px solid #d0d5dd; border-radius: 8px;
  font-size: 13px; font-family: inherit; color: #101828; outline: none; resize: vertical;
  transition: border-color 160ms cubic-bezier(.4,0,.2,1), box-shadow 160ms cubic-bezier(.4,0,.2,1);
}
.wabl-add textarea:focus, .wabl-add input[type=text]:focus { border-color: #128C7E; box-shadow: 0 0 0 3px rgba(18,140,126,.14); }
.wabl-hint { font-size: 11.5px; color: #667085; margin-top: 5px; line-height: 1.5; }
@keyframes wabl-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
.wabl-add { animation: wabl-in 180ms cubic-bezier(.4,0,.2,1); }
`;

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
    <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
  </svg>
);

const fmtWhen = v => {
  if (!v) return '—';
  const d = new Date(String(v).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function WaBlocklist() {
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [pages, setPages]     = useState(1);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState('');

  const [search, setSearch]     = useState('');
  const [debounced, setDebounced] = useState('');

  const [addOpen, setAddOpen]   = useState(false);
  const [phones, setPhones]     = useState('');
  const [reason, setReason]     = useState('');
  const firstField = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(API, {
        params: { action: 'optin_list', status: 'optout', search: debounced, page, per_page: PER_PAGE },
      });
      if (res.data?.success) {
        const d = res.data.data;
        setRows(d.optins || []);
        setTotal(d.total || 0);
        setPages(d.pages || 1);
      } else {
        toast.error(res.data?.message || 'Could not load the blocklist');
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not load the blocklist');
    } finally { setLoading(false); }
  }, [debounced, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (addOpen) firstField.current?.focus(); }, [addOpen]);

  const block = async () => {
    const list = phones.trim();
    if (!list) { toast.error('Enter at least one number'); return; }
    setBusy('add');
    try {
      const res = await api.post(API, new URLSearchParams({
        action: 'optin', type: 'optout', phones: list, reason: reason.trim(),
      }), FORM);
      if (res.data?.success) {
        const d = res.data.data;
        toast.success(`${d.registered} number${d.registered === 1 ? '' : 's'} blocked`);
        if (d.invalid?.length) toast.error(`Skipped ${d.invalid.length} that didn't look like numbers`);
        setPhones(''); setReason(''); setAddOpen(false); setPage(1); load();
      } else toast.error(res.data?.message || 'Could not block those numbers');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not block those numbers');
    } finally { setBusy(''); }
  };

  const unblock = async phone => {
    setBusy(phone);
    try {
      const res = await api.post(API, new URLSearchParams({
        action: 'optin', type: 'optin', phones: phone,
        reason: 'Unblocked by an admin from the WhatsApp blocklist',
      }), FORM);
      if (res.data?.success) { toast.success(`${phone} can receive WhatsApp again`); load(); }
      else toast.error(res.data?.message || 'Could not unblock');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not unblock');
    } finally { setBusy(''); }
  };

  const pageBtns = useMemo(() => {
    const out = [];
    const from = Math.max(1, Math.min(page - 2, pages - 4));
    const to   = Math.min(pages, from + 4);
    for (let i = from; i <= to; i++) out.push(i);
    return out;
  }, [page, pages]);

  return (
    <div className="wabl">
      <style>{CSS}</style>

      <div className="wabl-bar">
        <div className="wabl-search">
          <SearchIcon />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search a number" />
        </div>
        <span style={{ fontSize: 12.5, color: '#667085', fontWeight: 600 }}>
          {loading ? 'Loading…' : `${total.toLocaleString('en-IN')} blocked`}
        </span>
        <button className="wabl-btn wabl-btn-ghost" style={{ marginLeft: 'auto' }} onClick={load} disabled={loading}>
          Refresh
        </button>
        <button className="wabl-btn wabl-btn-solid" onClick={() => setAddOpen(o => !o)}>
          {addOpen ? 'Cancel' : 'Block numbers'}
        </button>
      </div>

      {addOpen && (
        <div className="wabl-add">
          <label htmlFor="wabl-phones">Numbers to block</label>
          <textarea
            id="wabl-phones" ref={firstField} rows={3} value={phones}
            onChange={e => setPhones(e.target.value)}
            placeholder="9876543210, 919812345678&#10;one per line, or comma separated" />
          <p className="wabl-hint">
            Numbers without a country code are treated as Indian. Blocking takes effect on the very next
            campaign and on every journey — nothing already sent is recalled.
          </p>

          <label htmlFor="wabl-reason" style={{ marginTop: 12 }}>Why (optional)</label>
          <input id="wabl-reason" type="text" value={reason} onChange={e => setReason(e.target.value)}
                 placeholder="e.g. asked us to stop over a call" />

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="wabl-btn wabl-btn-solid" onClick={block} disabled={busy === 'add'}>
              {busy === 'add' ? 'Blocking…' : 'Block'}
            </button>
            <button className="wabl-btn wabl-btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="wabl-card">
        <table className="wabl-table">
          <thead>
            <tr>
              <th style={{ width: '20%' }}>Number</th>
              <th style={{ width: '16%' }}>How</th>
              <th>Reason</th>
              <th style={{ width: '20%' }}>Blocked on</th>
              <th style={{ width: 110 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const s = SOURCE_LABEL[(r.source || '').toUpperCase()] || SOURCE_LABEL.WEB;
              return (
                <tr key={r.phone}>
                  <td className="wabl-phone">+{String(r.phone).replace(/^\+/, '')}</td>
                  <td>
                    <span className="wabl-chip" style={{ background: s.bg, color: s.fg, borderColor: s.bd }}>{s.text}</span>
                  </td>
                  <td className="wabl-reason" title={r.reason || ''}>{r.reason || '—'}</td>
                  <td style={{ color: '#667085', whiteSpace: 'nowrap' }}>{fmtWhen(r.blocked_at || r.updated_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="wabl-unblock" onClick={() => unblock(r.phone)} disabled={busy === r.phone}>
                      {busy === r.phone ? 'Working…' : 'Unblock'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && !rows.length && (
              <tr><td colSpan={5}>
                <div className="wabl-empty">
                  <b>{debounced ? 'No blocked number matches that' : 'Nobody is blocked on WhatsApp'}</b>
                  {debounced
                    ? 'Try a different number.'
                    : 'Anyone who replies STOP, UNSUBSCRIBE or CANCEL lands here automatically, and stops receiving campaigns and journeys from that moment.'}
                </div>
              </td></tr>
            )}
            {loading && !rows.length && (
              <tr><td colSpan={5}><div className="wabl-empty">Loading…</div></td></tr>
            )}
          </tbody>
        </table>

        {pages > 1 && (
          <div className="wabl-foot">
            <span style={{ fontSize: 12, color: '#667085' }}>Page {page} of {pages}</span>
            <div className="wabl-page">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
              {pageBtns.map(p => (
                <button key={p} aria-current={p === page} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
