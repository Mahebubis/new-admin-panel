/*
 * Kumo — Blocklist.
 *
 * A clone of the Netcore Blocklist screen (src/pages/netcore/NetcoreBlocklist.jsx →
 * NetcoreListContacts with isBlocklist): same header block, same right-aligned
 * toolbar, same white table card with a sticky head and a spinner veil, same
 * empty state, same footer pager.
 *
 * TWO BLOCKLISTS, ONE SCREEN.
 *
 * Tab 1 — "Blocklist" — is the panel's ONE shared blocklist: the same rows the
 * Netcore Blocklist screen shows, read and written through the panel's own
 * api/lists/lists.php (get_or_create_blocklist → members / add_contact /
 * update_contact / remove_member). It is fully manageable from here, exactly as it
 * is from the Netcore screen: the same request shapes, the same columns, the same
 * edit drawer semantics — including the opt-in write into the real `users` row.
 * Every Kumo send already honours it, so nothing ever needs copying across.
 *
 * Tab 2 — "Kumo suppressions" — is this platform's own automatic suppression store
 * (hard bounces and complaints off the KumoMTA webhooks, unsubscribes, manual and
 * imported rows). It goes through kapi() against api/kumo/kumo.php and is
 * unchanged: blocklist_list / blocklist_add / blocklist_remove, CSV import via
 * contacts_import with as_blocklist, reason chips off by_reason.
 *
 * Class prefix is kmb- rather than the shared km- so nothing here can collide
 * with kumoShared's design kit.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import TopConfirm from '../../components/TopConfirm';
import {
  kapi, KumoStyles, Btn, Card, Pill, Empty, Pagination, SearchInput,
  Modal, Tabs, Toggle, Spinner, Skel, nf, fmtDt, ago,
} from './kumoShared';

/* The panel's own lists endpoint — the very calls the Netcore blocklist screen makes. */
const LISTS_API = '/api/lists/lists.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

/** POST to lists.php and unwrap the {success, data, message} envelope, like kapi() does for Kumo. */
async function lapi(params) {
  const res = await api.post(LISTS_API, new URLSearchParams(params), FORM);
  const body = res && res.data ? res.data : {};
  if (!body.success) throw new Error(body.message || 'Request failed');
  return body.data || {};
}

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());

/* ── reason vocabulary (tab 2 only) ─────────────────────────────────────── */
const REASONS = [
  { id: 'hard_bounce', label: 'Hard bounce', tone: 'red',    color: '#ef4444' },
  { id: 'complaint',   label: 'Complaint',   tone: 'yellow', color: '#f59e0b' },
  { id: 'unsubscribe', label: 'Unsubscribe', tone: 'slate',  color: '#64748b' },
  { id: 'manual',      label: 'Manual',      tone: 'indigo', color: '#6366f1' },
  { id: 'imported',    label: 'Imported',    tone: 'cyan',   color: '#06b6d4' },
  { id: 'invalid',     label: 'Invalid',     tone: 'red',    color: '#a855f7' },
];
const REASON_BY_ID = REASONS.reduce((m, r) => { m[r.id] = r; return m; }, {});

function ReasonPill({ value }) {
  if (value === 'netcore') return <Pill tone="indigo">Netcore</Pill>;
  const r = REASON_BY_ID[value];
  return <Pill tone={r ? r.tone : 'slate'}>{r ? r.label : (value || 'unknown')}</Pill>;
}

/* ── chrome ─────────────────────────────────────────────────────────────── */
const CSS = `
.kmb, .kmb *, .kmb *::before, .kmb *::after { box-sizing: border-box; }
.kmb { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif; }

.kmb-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
.kmb-title { margin: 0; font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -.3px; }
.kmb-title span { font-weight: 600; color: #64748b; }
.kmb-sub { font-size: 12.5px; color: #64748b; margin-top: 4px; max-width: 680px; line-height: 1.6; }
.kmb-tools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }

.kmb-note { display: flex; gap: 10px; align-items: flex-start; padding: 11px 14px; border-radius: 10px;
  background: #eff6ff; border: 1px solid #bfdbfe; color: #1e3a8a; font-size: 12.2px; line-height: 1.6;
  font-weight: 600; margin-bottom: 12px; }
.kmb-note b { font-weight: 800; }

.kmb-cleanup { padding: 11px 14px; border-radius: 10px; font-size: 12.2px; line-height: 1.6;
  color: #334155; margin-bottom: 12px; }

.kmb-filters { display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
.kmb-chips { display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
.kmb-chip { border: 1px solid #e2e8f0; background: rgba(255,255,255,.75); color: #64748b; cursor: pointer;
  border-radius: 999px; padding: 6px 13px; font: 700 12px/1 'Plus Jakarta Sans', sans-serif; white-space: nowrap;
  display: inline-flex; align-items: center; gap: 7px;
  transition: all .22s cubic-bezier(.22,1,.36,1); }
.kmb-chip:hover { color: #334155; background: #fff; }
.kmb-chip i { width: 8px; height: 8px; border-radius: 3px; display: inline-block; }
.kmb-chip b { font-weight: 800; opacity: .8; }
.kmb-chip.is-on { border-color: transparent; color: #fff; box-shadow: 0 8px 20px -12px rgba(79,70,229,.95); }

.kmb-panel { position: relative; background: #fff; border-radius: 10px; border: 1px solid #e6e8f2;
  box-shadow: 0 1px 3px rgba(15,23,42,.06); overflow: hidden; }
.kmb-veil { position: absolute; inset: 0; z-index: 5; display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.85); }
.kmb-scroll { overflow: auto; max-height: 56vh; }
.kmb-scroll::-webkit-scrollbar { width: 9px; height: 9px; }
.kmb-scroll::-webkit-scrollbar-thumb { background: rgba(15,23,42,.18); border-radius: 8px; border: 2px solid transparent; background-clip: content-box; }
.kmb-scroll::-webkit-scrollbar-track { background: transparent; }

.kmb-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.kmb-table thead th { position: sticky; top: 0; z-index: 2; background: #f8fafc; text-align: left;
  padding: 12px 16px; font-size: 11.5px; font-weight: 700; color: #475569;
  border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
.kmb-table tbody td { padding: 11px 16px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
.kmb-table tbody tr { transition: background .16s; }
.kmb-table tbody tr:hover td { background: #f5f3ff; }
.kmb-table tbody tr:last-child td { border-bottom: 0; }
.kmb-email { color: #1e3a8a; font-weight: 600; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kmb-dim { color: #94a3b8; }
.kmb-mono { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11.5px; color: #64748b; }
.kmb-clip { max-width: 340px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #64748b; }

.kmb-rowbtn { border: 0; background: none; cursor: pointer; font: 800 12px/1 'Plus Jakarta Sans', sans-serif;
  padding: 5px 7px; border-radius: 8px; transition: background .16s, opacity .16s; }
.kmb-rowbtn:hover { background: rgba(15,23,42,.05); }
.kmb-rowbtn--edit { color: #1e3a8a; }
.kmb-rowbtn--del { color: #dc2626; }

.kmb-panel-fade { animation: kmb-fade 220ms cubic-bezier(.22,1,.36,1) both; }
@keyframes kmb-fade { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }

.kmb-card2 { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 12px; position: relative; }
.kmb-card2-tag { font-size: 10.5px; font-weight: 800; color: #94a3b8; letter-spacing: .4px; margin-bottom: 9px; }
.kmb-card2-x { position: absolute; top: 8px; right: 8px; border: 0; background: none; color: #94a3b8; cursor: pointer;
  font-size: 15px; line-height: 1; padding: 3px; }
.kmb-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.kmb-addmore { width: 100%; padding: 9px; border: 1.5px dashed #c7d2fe; background: rgba(99,102,241,.05);
  color: #4338ca; border-radius: 10px; font: 800 12px/1 'Plus Jakarta Sans', sans-serif; cursor: pointer; }
.kmb-addmore:hover { background: rgba(99,102,241,.1); }

.kmb-drop { border: 2px dashed #e2e8f0; border-radius: 14px; padding: 26px 18px; text-align: center; cursor: pointer;
  background: rgba(255,255,255,.6); transition: all .22s cubic-bezier(.22,1,.36,1); }
.kmb-drop.is-drag { border-color: #818cf8; background: rgba(99,102,241,.08); transform: scale(1.01); }
.kmb-warn { margin-top: 14px; padding: 10px 13px; border-radius: 12px; background: rgba(245,158,11,.1);
  font-size: 11.8px; color: #92400e; font-weight: 600; line-height: 1.6; }
.kmb-result { margin-top: 14px; padding: 14px; border-radius: 14px; background: rgba(16,185,129,.07); border: 1px solid rgba(16,185,129,.22); }
.kmb-result-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(92px, 1fr)); gap: 9px; }
.kmb-result-cell { padding: 9px 10px; border-radius: 11px; background: rgba(255,255,255,.75); text-align: center; }
.kmb-result-cell span { display: block; font-size: 9.8px; font-weight: 800; letter-spacing: .4px; text-transform: uppercase; color: #94a3b8; }
.kmb-result-cell b { display: block; margin-top: 3px; font-size: 16px; font-weight: 800; }

@media (max-width: 720px) {
  .kmb-title { font-size: 19px; }
  .kmb-tools { justify-content: flex-start; }
  .kmb-grid2 { grid-template-columns: 1fr; }
}
`;

const IconShield = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" />
  </svg>
);
const IconRefresh = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" /><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" /><path d="M21 3v5h-5M3 21v-5h5" />
  </svg>
);
const IconUpload = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 21V9" /><path d="m7 12 5-5 5 5" /><path d="M21 3H3" />
  </svg>
);
const IconPlus = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconTrash = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6" />
  </svg>
);
const IconX = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const IconAlert = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M10.3 3.2 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" />
  </svg>
);
const IconCheck = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m20 6-11 11-5-5" />
  </svg>
);

const SHARED = 'shared';
const MINE = 'mine';

const EMPTY_CONTACT = { email: '', first_name: '', last_name: '', phone: '', state: '', country: '', city: '', reason: '' };

/**
 * The shared blocklist is a single row in campaign_lists (kind='blocklist'), so its id has
 * to be asked for once before anything can be read or written. Guarded by a ref against
 * StrictMode's dev-only double-mount.
 */
function useSharedBlocklistId() {
  const [id, setId] = useState(null);
  const [err, setErr] = useState('');
  const fetched = useRef(false);
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    (async () => {
      try {
        const d = await lapi({ action: 'get_or_create_blocklist' });
        setId(d.id || null);
      } catch (e) {
        setErr(e.message || 'Could not open the shared blocklist');
      }
    })();
  }, []);
  return [id, err];
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════════════════ */
export default function KumoBlocklist() {
  const [tab, setTab] = useState(SHARED);
  const [sharedId, sharedIdErr] = useSharedBlocklistId();

  const [search, setSearch] = useState('');
  const [dq, setDq] = useState('');
  const [reason, setReason] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [byReason, setByReason] = useState({});
  const [cleanup, setCleanup] = useState(null);
  const [readonly, setReadonly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [counts, setCounts] = useState({ shared: null, mine: null });

  /* typing shouldn't fire a request per keystroke */
  useEffect(() => {
    const t = setTimeout(() => setDq(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setError('');
    if (tab === SHARED && !sharedId) { setLoading(true); return; }
    setLoading(true);
    try {
      if (tab === SHARED) {
        /* Exactly the call the Netcore blocklist table makes. */
        const d = await lapi({ action: 'members', id: sharedId, page, per_page: perPage, search: dq });
        const t = Number(d.total || 0);
        setRows(Array.isArray(d.members) ? d.members : []);
        setTotal(t);
        setByReason({});
        setCleanup(d.bounce_cleanup || null);
        setReadonly(false);
        setCounts((c) => ({ ...c, shared: dq ? c.shared : t }));
      } else {
        const d = await kapi('blocklist_list', { page, per_page: perPage, search: dq, reason });
        const t = Number(d.total || 0);
        setRows(Array.isArray(d.rows) ? d.rows : []);
        setTotal(t);
        setByReason(d.by_reason || {});
        setCleanup(null);
        setReadonly(Number(d.readonly || 0) === 1);
        setCounts((c) => ({
          shared: d.netcore_total != null ? Number(d.netcore_total) : c.shared,
          mine: !dq && !reason ? t : c.mine,
        }));
      }
    } catch (e) {
      setError(e.message || 'Could not load the blocklist');
      setRows([]); setTotal(0); setByReason({}); setCleanup(null);
    } finally {
      setLoading(false);
    }
  }, [tab, sharedId, page, perPage, dq, reason]);

  useEffect(() => { load(); }, [load]);

  /* One cheap call keeps both header totals honest whichever tab you're on. */
  const loadCounts = useCallback(async () => {
    try {
      const d = await kapi('blocklist_list', { page: 1, per_page: 1 });
      setCounts({ shared: Number(d.netcore_total || 0), mine: Number(d.total || 0) });
    } catch { /* header counts are cosmetic — never block the table on them */ }
  }, []);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  const refreshAll = useCallback(() => { load(); loadCounts(); }, [load, loadCounts]);

  const goTab = (id) => { setTab(id); setPage(1); setSearch(''); setDq(''); setReason(''); };
  const onSearch = (v) => { setSearch(v); setPage(1); };
  const pickReason = (id) => { setReason((r) => (r === id ? '' : id)); setPage(1); };

  const reasonTotal = useMemo(
    () => REASONS.reduce((s, r) => s + (Number(byReason[r.id]) || 0), 0),
    [byReason]
  );

  /* ══ SHARED TAB — add / edit / remove, through lists.php ════════════════ */

  /* ── add contacts ─────────────────────────────────────────────────────── */
  const [addOpen, setAddOpen] = useState(false);
  const [addRows, setAddRows] = useState([{ ...EMPTY_CONTACT }]);
  const [addContactBusy, setAddContactBusy] = useState(false);
  const openAddContacts = () => { setAddRows([{ ...EMPTY_CONTACT }]); setAddOpen(true); };
  const setAddField = (i, field, value) =>
    setAddRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const addAnotherRow = () => setAddRows((rs) => [...rs, { ...EMPTY_CONTACT }]);
  const dropRow = (i) => setAddRows((rs) => rs.filter((_, idx) => idx !== i));

  const submitAddContacts = async () => {
    const valid = addRows.filter((r) => String(r.email || '').trim());
    if (valid.length === 0) { toast.error('Enter at least one email address'); return; }
    const bad = valid.find((r) => !isValidEmail(r.email));
    if (bad) { toast.error(`"${bad.email}" isn't a valid email address`); return; }

    setAddContactBusy(true);
    const t = toast.loading(valid.length > 1 ? `Blocking ${valid.length} addresses…` : 'Blocking address…');
    let ok = 0, failed = 0;
    for (const r of valid) {
      try {
        await lapi({
          action: 'add_contact', list_id: sharedId, email: String(r.email).trim(),
          first_name: r.first_name, last_name: r.last_name, phone: r.phone,
          state: r.state, country: r.country, city: r.city, reason: r.reason,
        });
        ok += 1;
      } catch { failed += 1; }
    }
    if (failed === 0) toast.success(ok > 1 ? `${nf(ok)} addresses blocked` : 'Address blocked', { id: t });
    else toast.error(`${nf(ok)} blocked, ${nf(failed)} failed`, { id: t });
    setAddContactBusy(false);
    if (ok > 0) { setAddOpen(false); refreshAll(); }
  };

  /* ── edit one contact ─────────────────────────────────────────────────── */
  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_CONTACT });
  const [editReal, setEditReal] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const openEdit = (r) => {
    setEditRow(r);
    setEditForm({
      email: r.email || '', first_name: r.first_name || '', last_name: r.last_name || '',
      phone: r.phone || '', state: r.state || '', country: r.country || '', city: r.city || '', reason: '',
    });
    setEditReal(false);
  };
  const setEditField = (field, value) => setEditForm((f) => ({ ...f, [field]: value }));

  const submitEdit = async () => {
    if (!editRow) return;
    if (!isValidEmail(editForm.email)) { toast.error('Enter a valid email address'); return; }
    setEditBusy(true);
    const t = toast.loading('Saving…');
    try {
      await lapi({
        action: 'update_contact', contact_id: editRow.id, email: String(editForm.email).trim(),
        ...(editReal ? {
          first_name: editForm.first_name, last_name: editForm.last_name, phone: editForm.phone,
          state: editForm.state, country: editForm.country, city: editForm.city,
        } : {}),
        update_real_table: editReal ? '1' : '0',
      });
      toast.success(editReal ? 'Saved — the real database record was updated too' : 'Saved', { id: t });
      setEditRow(null);
      refreshAll();
    } catch (e) {
      toast.error(e.message || 'Could not save', { id: t });
    } finally {
      setEditBusy(false);
    }
  };

  /* ── remove one shared entry ──────────────────────────────────────────── */
  const [sharedRemove, setSharedRemove] = useState(null);
  const [sharedRemoveBusy, setSharedRemoveBusy] = useState(false);
  const doSharedRemove = async () => {
    if (!sharedRemove) return;
    setSharedRemoveBusy(true);
    try {
      await lapi({ action: 'remove_member', list_id: sharedId, contact_id: sharedRemove.id });
      toast.success(`${sharedRemove.email} can receive mail again`);
      setSharedRemove(null);
      refreshAll();
    } catch (e) { toast.error(e.message || 'Could not remove that address'); }
    finally { setSharedRemoveBusy(false); }
  };

  /* ══ KUMO SUPPRESSIONS TAB — unchanged ═════════════════════════════════ */

  /* ── add addresses ────────────────────────────────────────────────────── */
  const [addTextOpen, setAddTextOpen] = useState(false);
  const [addText, setAddText] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const addCount = useMemo(
    () => addText.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean).length,
    [addText]
  );
  const openAdd = () => { setAddText(''); setAddTextOpen(true); };
  const doAdd = async () => {
    if (!addText.trim()) { toast.error('Paste at least one address'); return; }
    setAddBusy(true);
    try {
      const r = await kapi('blocklist_add', { emails: addText });
      toast.success(`${nf(r.added || 0)} address${Number(r.added) === 1 ? '' : 'es'} blocklisted`);
      setAddTextOpen(false); setAddText('');
      refreshAll();
    } catch (e) { toast.error(e.message || 'Could not add those addresses'); }
    finally { setAddBusy(false); }
  };

  /* ── import CSV ───────────────────────────────────────────────────────── */
  const [impOpen, setImpOpen] = useState(false);
  const [csv, setCsv] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [impBusy, setImpBusy] = useState(false);
  const [impResult, setImpResult] = useState(null);
  const fileRef = useRef(null);

  const takeFile = (file) => {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => setCsv({ name: file.name, size: file.size, text: String(fr.result || '') });
    fr.onerror = () => toast.error('Could not read that file');
    fr.readAsText(file);
  };
  const openImport = () => { setCsv(null); setImpResult(null); setImpOpen(true); };
  const doImport = async () => {
    if (!csv || !csv.text.trim()) { toast.error('Choose a CSV file first'); return; }
    setImpBusy(true); setImpResult(null);
    try {
      const r = await kapi('contacts_import', { csv: csv.text, as_blocklist: 1 });
      setImpResult(r);
      toast.success(`${nf(r.imported || 0)} address${Number(r.imported) === 1 ? '' : 'es'} suppressed`);
      refreshAll();
    } catch (e) { toast.error(e.message || 'Import failed'); }
    finally { setImpBusy(false); }
  };

  /* ── remove one suppression ───────────────────────────────────────────── */
  const [removeRow, setRemoveRow] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const doRemove = async () => {
    if (!removeRow) return;
    setRemoveBusy(true);
    try {
      await kapi('blocklist_remove', { email: removeRow.email });
      toast.success(`${removeRow.email} can receive mail again`);
      setRemoveRow(null);
      refreshAll();
    } catch (e) { toast.error(e.message || 'Could not remove that address'); }
    finally { setRemoveBusy(false); }
  };

  /* ── render ───────────────────────────────────────────────────────────── */
  const isShared = tab === SHARED;
  const canRemove = isShared ? !!sharedId : !readonly;
  const filtered = !!dq || (!isShared && !!reason);
  const headTotals = `${nf(counts.shared || 0)} shared · ${nf(counts.mine || 0)} suppressed by Kumo`;
  const shownError = error || (isShared ? sharedIdErr : '');
  const cleanupMsgs = cleanup && Array.isArray(cleanup.phases)
    ? cleanup.phases.reduce((n, p) => n + Number(p.messages || 0), 0)
    : 0;

  const clearFilters = () => { setSearch(''); setDq(''); setReason(''); setPage(1); };

  return (
    <div className="km km-page kmb">
      <KumoStyles />
      <style>{CSS}</style>

      {/* ── header ───────────────────────────────────────────────────────── */}
      <div className="kmb-head">
        <div>
          <h1 className="kmb-title">
            Blocklist <span>({nf(total)})</span>
          </h1>
          <div className="kmb-sub">
            People who must never be contacted again. The list is enforced at send time, so a blocked
            address is skipped no matter which list or segment it sits in · {headTotals}
          </div>
        </div>
        <div className="kmb-tools">
          <Btn variant="ghost" size="sm" loading={loading} onClick={refreshAll} icon={<IconRefresh />}>Refresh</Btn>
          {isShared
            ? <Btn size="sm" onClick={openAddContacts} disabled={!sharedId} icon={<IconPlus />}>Add contacts</Btn>
            : (
              <>
                <Btn variant="ghost" size="sm" onClick={openImport} icon={<IconUpload />}>Import CSV</Btn>
                <Btn size="sm" onClick={openAdd} icon={<IconPlus />}>Add addresses</Btn>
              </>
            )}
        </div>
      </div>

      {/* ── tabs ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 12 }}>
        <Tabs
          value={tab}
          onChange={goTab}
          tabs={[
            { id: SHARED, label: 'Blocklist', count: counts.shared == null ? undefined : nf(counts.shared) },
            { id: MINE,   label: 'Kumo suppressions', count: counts.mine == null ? undefined : nf(counts.mine) },
          ]}
        />
      </div>

      {isShared && (
        <div className="kmb-note">
          <span style={{ flexShrink: 0, marginTop: 1 }}><IconShield size={15} /></span>
          <span>
            These addresses live in the panel's <b>shared blocklist</b> — the same rows the Netcore
            Blocklist screen shows, and they can be added, edited and released from either screen.
            Every Kumo send already honours them, so nothing needs copying across.
          </span>
        </div>
      )}

      {/*
        WHY THESE PEOPLE ARE BLOCKED.
        Thousands of rows nobody remembers adding is alarming rather than reassuring, and the
        answer — the mail servers' own "this account does not exist" replies — is not visible in
        any single row. Shown only once the bounce cleanup has actually run.
      */}
      {isShared && cleanup && Number(cleanup.hard_bounce_total) > 0 && (
        <div className="kmb-cleanup" style={{
          background: cleanup.all_done ? '#f0fdf4' : '#fffbeb',
          border: '1px solid ' + (cleanup.all_done ? '#bbf7d0' : '#fde68a'),
        }}>
          <strong style={{ color: cleanup.all_done ? '#15803d' : '#b45309' }}>
            {cleanup.all_done ? 'Bounce cleanup complete' : 'Bounce cleanup in progress'}
          </strong>
          {' — '}
          <strong>{nf(cleanup.hard_bounce_total)}</strong> of these addresses were blocked automatically
          because the receiving mail server said the account does not exist. Read from{' '}
          <strong>{nf(cleanupMsgs)}</strong> delivery reports in the contact@ mailbox
          {cleanup.all_done ? '.' : ' (still reading…).'}{' '}
          A mailbox that was merely full is never blocked.
        </div>
      )}

      {shownError && (
        <Card style={{ marginBottom: 12, borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#b91c1c', fontWeight: 600, fontSize: 13 }}>
            <IconAlert size={16} /> {shownError}
          </div>
        </Card>
      )}

      {/* ── toolbar ──────────────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 14 }}>
        <div className="kmb-filters">
          <div className="kmb-chips">
            <SearchInput value={search} onChange={onSearch} placeholder="Search an address…" width={248} />
            {!isShared && (
              <>
                <button className={`kmb-chip${reason ? '' : ' is-on'}`} onClick={() => pickReason('')}
                  style={reason ? undefined : { background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  All reasons{reasonTotal ? <b>{nf(reasonTotal)}</b> : null}
                </button>
                {REASONS.map((r) => {
                  const on = reason === r.id;
                  const n = Number(byReason[r.id]) || 0;
                  return (
                    <button key={r.id} className={`kmb-chip${on ? ' is-on' : ''}`} onClick={() => pickReason(r.id)}
                      style={on ? { background: `linear-gradient(135deg, ${r.color}, #7c3aed)` } : undefined}>
                      <i style={{ background: on ? 'rgba(255,255,255,.85)' : r.color }} />
                      {r.label}{n ? <b>{nf(n)}</b> : null}
                    </button>
                  );
                })}
              </>
            )}
          </div>
          {filtered && (
            <Btn variant="ghost" size="sm" icon={<IconX />} onClick={clearFilters}>Clear filters</Btn>
          )}
        </div>
      </Card>

      {/* ── table ────────────────────────────────────────────────────────── */}
      <div className="kmb-panel kmb-panel-fade" key={tab}>
        {loading && rows.length > 0 && (
          <div className="kmb-veil"><Spinner size={28} /></div>
        )}

        {loading && rows.length === 0 ? (
          <div style={{ display: 'grid', gap: 8, padding: 14 }}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skel key={i} h={38} r={10} />)}
          </div>
        ) : rows.length === 0 ? (
          <Empty
            icon={<IconShield size={22} />}
            title={filtered ? 'Nothing matched' : (isShared ? 'The shared blocklist is empty' : 'Kumo has not suppressed anyone yet')}
            sub={filtered
              ? (isShared ? 'Try a different address.' : 'Try a different address, or clear the reason filter.')
              : (isShared
                  ? 'Nobody has been blocked yet. Anything added here is honoured by every Kumo send, and shows up on the Netcore Blocklist screen too.'
                  : 'Good news — nothing has bounced hard or complained yet. Suppressions land here on their own as the webhooks come in.')}
            action={filtered
              ? <Btn variant="ghost" onClick={clearFilters}>Clear filters</Btn>
              : (isShared
                  ? <Btn onClick={openAddContacts} disabled={!sharedId} icon={<IconPlus />}>Add contacts</Btn>
                  : <Btn onClick={openAdd} icon={<IconPlus />}>Add addresses</Btn>)}
          />
        ) : (
          <div className="kmb-scroll">
            <table className="kmb-table">
              <thead>
                {isShared ? (
                  <tr>
                    <th>Email</th>
                    <th>First name</th>
                    <th>Last name</th>
                    <th>Phone</th>
                    <th>State</th>
                    <th>Country</th>
                    <th>City</th>
                    <th>Added on</th>
                    <th style={{ width: 130 }} />
                  </tr>
                ) : (
                  <tr>
                    <th>Email</th>
                    <th>Reason</th>
                    <th>Detail</th>
                    <th>Campaign</th>
                    <th>Added on</th>
                    {canRemove && <th style={{ width: 110 }} />}
                  </tr>
                )}
              </thead>
              <tbody>
                {isShared
                  ? rows.map((r) => (
                      <tr key={`s-${r.id}`}>
                        <td className="kmb-email" title={r.email}>{r.email}</td>
                        <td>{r.first_name || '—'}</td>
                        <td>{r.last_name || '—'}</td>
                        <td>{r.phone || '—'}</td>
                        <td>{r.state || '—'}</td>
                        <td>{r.country || '—'}</td>
                        <td>{r.city || '—'}</td>
                        <td className="kmb-dim" style={{ whiteSpace: 'nowrap' }} title={fmtDt(r.added_at)}>{r.added_at || '—'}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button className="kmb-rowbtn kmb-rowbtn--edit" onClick={() => openEdit(r)} title="Edit contact">Edit</button>
                          <button className="kmb-rowbtn kmb-rowbtn--del" onClick={() => setSharedRemove(r)} title="Remove from the blocklist">Remove</button>
                        </td>
                      </tr>
                    ))
                  : rows.map((r) => (
                      <tr key={`${r.id}-${r.email}`}>
                        <td className="kmb-email" title={r.email}>{r.email}</td>
                        <td><ReasonPill value={r.reason} /></td>
                        <td className="kmb-clip" title={r.detail || ''}>{r.detail || '—'}</td>
                        <td className="kmb-mono">{r.campaign_id ? `#${r.campaign_id}` : '—'}</td>
                        <td className="kmb-dim" style={{ whiteSpace: 'nowrap' }} title={fmtDt(r.created_at)}>{ago(r.created_at)}</td>
                        {canRemove && (
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <Btn variant="ghost" size="sm" onClick={() => setRemoveRow(r)} icon={<IconTrash />}>Remove</Btn>
                          </td>
                        )}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── pagination ───────────────────────────────────────────────────── */}
      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        onPage={setPage}
        onPerPage={(n) => { setPerPage(n); setPage(1); }}
      />

      {/* ══ MODAL: add contacts to the shared blocklist ══════════════════ */}
      <Modal
        open={addOpen}
        onClose={() => !addContactBusy && setAddOpen(false)}
        width={620}
        title="Block addresses"
        subtitle="Added to the panel's shared blocklist — honoured by every Kumo send and by the Netcore screens."
        footer={<>
          <Btn variant="ghost" onClick={() => setAddOpen(false)} disabled={addContactBusy}>Cancel</Btn>
          <Btn loading={addContactBusy} onClick={submitAddContacts} icon={<IconShield size={14} />}>
            {addRows.length > 1 ? `Block ${nf(addRows.length)} contacts` : 'Block contact'}
          </Btn>
        </>}>
        {addRows.map((r, i) => (
          <div key={i} className="kmb-card2">
            {addRows.length > 1 && (
              <button type="button" className="kmb-card2-x" onClick={() => dropRow(i)} title="Remove this row">×</button>
            )}
            <div className="kmb-card2-tag">CONTACT {i + 1}</div>
            <div className="km-field">
              <label className="km-label">Email *</label>
              <input className="km-input" value={r.email} placeholder="name@example.com"
                onChange={(e) => setAddField(i, 'email', e.target.value)} />
            </div>
            <div className="kmb-grid2" style={{ marginBottom: 12 }}>
              <div>
                <label className="km-label">First name</label>
                <input className="km-input" value={r.first_name} placeholder="First name"
                  onChange={(e) => setAddField(i, 'first_name', e.target.value)} />
              </div>
              <div>
                <label className="km-label">Last name</label>
                <input className="km-input" value={r.last_name} placeholder="Last name"
                  onChange={(e) => setAddField(i, 'last_name', e.target.value)} />
              </div>
            </div>
            <div className="km-field">
              <label className="km-label">Phone</label>
              <input className="km-input" value={r.phone} placeholder="Phone number"
                onChange={(e) => setAddField(i, 'phone', e.target.value)} />
            </div>
            <div className="kmb-grid2" style={{ marginBottom: 12 }}>
              <div>
                <label className="km-label">State</label>
                <input className="km-input" value={r.state} placeholder="State"
                  onChange={(e) => setAddField(i, 'state', e.target.value)} />
              </div>
              <div>
                <label className="km-label">Country</label>
                <input className="km-input" value={r.country} placeholder="Country"
                  onChange={(e) => setAddField(i, 'country', e.target.value)} />
              </div>
            </div>
            <div className="kmb-grid2">
              <div>
                <label className="km-label">City</label>
                <input className="km-input" value={r.city} placeholder="City"
                  onChange={(e) => setAddField(i, 'city', e.target.value)} />
              </div>
              <div>
                <label className="km-label">Reason</label>
                <input className="km-input" value={r.reason} placeholder="Why block them? (optional)"
                  onChange={(e) => setAddField(i, 'reason', e.target.value)} />
              </div>
            </div>
          </div>
        ))}
        <button type="button" className="kmb-addmore" onClick={addAnotherRow}>+ Add another contact</button>
      </Modal>

      {/* ══ MODAL: edit one shared contact ═══════════════════════════════ */}
      <Modal
        open={!!editRow}
        onClose={() => !editBusy && setEditRow(null)}
        width={560}
        title="Edit contact"
        subtitle="Updates this blocklist's own copy of the contact."
        footer={<>
          <Btn variant="ghost" onClick={() => setEditRow(null)} disabled={editBusy}>Cancel</Btn>
          <Btn loading={editBusy} onClick={submitEdit}>Save</Btn>
        </>}>
        <div className="km-field">
          <label className="km-label">Email</label>
          <input className="km-input" value={editForm.email} placeholder="name@example.com"
            onChange={(e) => setEditField('email', e.target.value)} />
        </div>

        <div style={{ padding: 12, borderRadius: 12, background: 'rgba(15,23,42,.035)', border: '1px solid #e8ecf5', marginBottom: 14 }}>
          <Toggle
            checked={editReal}
            onChange={setEditReal}
            label="Edit real database value also"
            hint={editReal
              ? 'On — if this email belongs to a registered student, these changes also update their real record (users.fname/lname/phone/state/country).'
              : 'Off — only this blocklist\'s own copy is edited (just the email above). The real student record, if any, is left untouched.'}
          />
        </div>

        {editReal && (
          <>
            <div className="kmb-grid2" style={{ marginBottom: 12 }}>
              <div>
                <label className="km-label">First name</label>
                <input className="km-input" value={editForm.first_name} placeholder="First name"
                  onChange={(e) => setEditField('first_name', e.target.value)} />
              </div>
              <div>
                <label className="km-label">Last name</label>
                <input className="km-input" value={editForm.last_name} placeholder="Last name"
                  onChange={(e) => setEditField('last_name', e.target.value)} />
              </div>
            </div>
            <div className="km-field">
              <label className="km-label">Phone</label>
              <input className="km-input" value={editForm.phone} placeholder="Phone number"
                onChange={(e) => setEditField('phone', e.target.value)} />
            </div>
            <div className="kmb-grid2" style={{ marginBottom: 12 }}>
              <div>
                <label className="km-label">State</label>
                <input className="km-input" value={editForm.state} placeholder="State"
                  onChange={(e) => setEditField('state', e.target.value)} />
              </div>
              <div>
                <label className="km-label">Country</label>
                <input className="km-input" value={editForm.country} placeholder="Country"
                  onChange={(e) => setEditField('country', e.target.value)} />
              </div>
            </div>
            <div className="km-field">
              <label className="km-label">City</label>
              <input className="km-input" value={editForm.city} placeholder="City"
                onChange={(e) => setEditField('city', e.target.value)} />
            </div>
          </>
        )}
      </Modal>

      {/* ══ MODAL: add addresses (Kumo suppressions) ═════════════════════ */}
      <Modal
        open={addTextOpen}
        onClose={() => setAddTextOpen(false)}
        width={560}
        title="Add addresses to the Kumo blocklist"
        subtitle="They are suppressed from every Kumo campaign, immediately."
        footer={<>
          <Btn variant="ghost" onClick={() => setAddTextOpen(false)}>Cancel</Btn>
          <Btn loading={addBusy} onClick={doAdd} icon={<IconShield size={14} />}>
            Block {addCount ? `${nf(addCount)} address${addCount === 1 ? '' : 'es'}` : 'addresses'}
          </Btn>
        </>}>
        <div className="km-field">
          <label className="km-label">Email addresses</label>
          <textarea className="km-textarea" rows={8} autoFocus value={addText}
            placeholder={'someone@example.com\nanother@example.com, third@example.com'}
            style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12.5, lineHeight: 1.7 }}
            onChange={(e) => setAddText(e.target.value)} />
          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 5, lineHeight: 1.55 }}>
            Separate with commas, spaces or new lines — pasting a whole column out of a spreadsheet works fine.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <Pill tone={addCount ? 'indigo' : 'slate'}>{nf(addCount)} detected</Pill>
          <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Reason will be recorded as “manual”.</span>
        </div>
      </Modal>

      {/* ══ MODAL: import CSV (Kumo suppressions) ════════════════════════ */}
      <Modal
        open={impOpen}
        onClose={() => setImpOpen(false)}
        width={600}
        title="Import a CSV to the Kumo blocklist"
        subtitle="Every address in the file is suppressed rather than added as a sendable contact."
        footer={<>
          <Btn variant="ghost" onClick={() => setImpOpen(false)}>Close</Btn>
          <Btn loading={impBusy} onClick={doImport} icon={<IconUpload />}>Suppress these addresses</Btn>
        </>}>
        <div
          className={`kmb-drop${dragging ? ' is-drag' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); takeFile(e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null); }}
          onClick={() => fileRef.current && fileRef.current.click()}>
          <div style={{ width: 46, height: 46, borderRadius: 14, margin: '0 auto 10px', display: 'grid', placeItems: 'center',
            background: 'linear-gradient(135deg, rgba(239,68,68,.14), rgba(99,102,241,.14))', color: '#ef4444' }}>
            <IconShield size={20} />
          </div>
          {csv ? (
            <>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#334155', wordBreak: 'break-all' }}>{csv.name}</div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 5 }}>
                ~{nf(Math.max(0, csv.text.split(/\r?\n/).filter((l) => l.trim()).length - 1))} data rows · {nf(csv.size)} bytes · click to replace
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#334155' }}>
                {dragging ? 'Drop it here' : 'Drop a CSV here, or click to browse'}
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6, lineHeight: 1.6 }}>
                Only the <b>email</b> column is needed. A suppression list exported from another ESP works as-is.
              </div>
            </>
          )}
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" style={{ display: 'none' }}
            onChange={(e) => { takeFile(e.target.files && e.target.files[0]); e.target.value = ''; }} />
        </div>

        {csv && (
          <div style={{ marginTop: 10, textAlign: 'right' }}>
            <Btn variant="ghost" size="sm" onClick={() => setCsv(null)} icon={<IconX />}>Clear file</Btn>
          </div>
        )}

        <div className="kmb-warn" style={{ display: 'flex', gap: 9 }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}><IconAlert /></span>
          <span>This cannot be undone in bulk. Addresses can only be released one at a time from the table.</span>
        </div>

        {impResult && (
          <div className="kmb-result">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 13, color: '#047857', marginBottom: 11 }}>
              <IconCheck /> Import finished
            </div>
            <div className="kmb-result-grid">
              {[
                ['Rows read', impResult.rows, '#64748b'],
                ['Suppressed', impResult.imported, '#059669'],
                ['Invalid', impResult.invalid, '#dc2626'],
                ['Already blocked', impResult.suppressed, '#d97706'],
                ['Duplicates', impResult.duplicate, '#4f46e5'],
              ].map(([k, v, c]) => (
                <div key={k} className="kmb-result-cell">
                  <span>{k}</span>
                  <b style={{ color: c }}>{nf(v || 0)}</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* ══ CONFIRM: release a shared blocklist entry ════════════════════ */}
      <TopConfirm
        open={!!sharedRemove}
        tone="danger"
        busy={sharedRemoveBusy}
        title="Let this address receive mail again?"
        confirmLabel="Remove from blocklist"
        cancelLabel="Keep blocked"
        onCancel={() => setSharedRemove(null)}
        onConfirm={doSharedRemove}
        message={<>
          <b>{sharedRemove ? sharedRemove.email : ''}</b> is on the panel's shared blocklist. Removing it
          here removes it everywhere — Kumo and the Netcore screens both stop skipping this address, and the
          matching suppressions are lifted at the ESPs too.
        </>}
        detail={sharedRemove && sharedRemove.added_at
          ? <>Blocked on {sharedRemove.added_at}. Their account and any other data are untouched.</>
          : 'Their account and any other data are untouched.'}
      />

      {/* ══ CONFIRM: release a Kumo suppression ══════════════════════════ */}
      <TopConfirm
        open={!!removeRow}
        tone="danger"
        busy={removeBusy}
        title="Let this address receive mail again?"
        confirmLabel="Remove from blocklist"
        cancelLabel="Keep blocked"
        onCancel={() => setRemoveRow(null)}
        onConfirm={doRemove}
        message={<>
          <b>{removeRow ? removeRow.email : ''}</b> was suppressed because of a{' '}
          <b>{((removeRow && REASON_BY_ID[removeRow.reason] && REASON_BY_ID[removeRow.reason].label) || (removeRow && removeRow.reason) || 'suppression').toLowerCase()}</b>
          {removeRow && removeRow.created_at ? <> {ago(removeRow.created_at)}</> : null}.
          {' '}Removing it means future campaigns <b>will</b> send to it again. If the original reason was a
          hard bounce or a spam complaint, that mail is very likely to bounce or be reported a second time,
          and repeated attempts damage the reputation of every IP you send from.
        </>}
        detail={removeRow && removeRow.detail ? removeRow.detail : undefined}
      />

      <div style={{ height: 20 }} />
    </div>
  );
}
