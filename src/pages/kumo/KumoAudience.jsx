/*
 * KumoMTA — Audience.
 *
 * Lists, Contacts and Segments on one screen. The active tab lives in the URL
 * (?tab=) so a link can drop somebody straight onto the right view.
 *
 * Everything that changes data goes through kapi() and reports with a toast;
 * every list has a skeleton while it loads and an empty state when it is bare.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  KumoStyles, kapi, usePolling, useDebounced, Card, StatTile, Btn, Pill, Empty, Skel,
  Tabs, SearchInput, Pagination, Modal, Drawer, Confirm, RowMenu, Toggle, CountUp,
  T, nf, compact, fmtDt, fmtDate, ago,
  IconUsers, IconLayers, IconPlus, IconTrash, IconEdit, IconUpload,
  IconRefresh, IconShield, IconCheck, IconAlert, IconGlobe, IconFlame, IconEye,
  IconActivity, IconX,
} from './kumoShared';

/* ── small helpers ──────────────────────────────────────────────────────── */
const STATUS_TONES = { active: 'green', unsubscribed: 'slate', bounced: 'red', complained: 'yellow' };
const STATUS_CHIPS = [
  { id: '', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'unsubscribed', label: 'Unsubscribed' },
  { id: 'bounced', label: 'Bounced' },
  { id: 'complained', label: 'Complained' },
];
const ENG_TONES = { new: 'indigo', hot: 'red', warm: 'yellow', cold: 'cyan', dormant: 'slate' };
const ENG_LEVELS = ['new', 'hot', 'warm', 'cold', 'dormant'];

const SOURCES = [
  { id: 'kumo_list', label: 'From lists', icon: <IconLayers size={14} />, hint: 'Everyone on the lists you pick.' },
  { id: 'engagement', label: 'By engagement', icon: <IconFlame size={14} />, hint: 'Filter on opens, clicks and domain.' },
  { id: 'netcore', label: 'Netcore segment', icon: <IconGlobe size={14} />, hint: 'Mirror a segment that already exists in Netcore.' },
];
const SOURCE_LABEL = { kumo_list: 'Lists', engagement: 'Engagement', netcore: 'Netcore' };
const SOURCE_TONE = { kumo_list: 'indigo', engagement: 'cyan', netcore: 'slate' };

/* shared inline-style fragments, so the JSX below stays readable */
const CUT = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const CAP = { fontSize: 10.5, color: T.faint, fontWeight: 800, letterSpacing: '.4px', textTransform: 'uppercase', marginTop: 3 };
const bigNum = (grad) => ({ fontSize: 23, fontWeight: 800, letterSpacing: '-.6px', lineHeight: 1.1, background: grad, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' });

const StatusPill = ({ value }) => <Pill tone={STATUS_TONES[value] || 'slate'}>{value || 'unknown'}</Pill>;
const EngPill = ({ value }) => (value ? <Pill tone={ENG_TONES[value] || 'slate'}>{value}</Pill> : <span style={{ color: T.faint }}>—</span>);

function Chip({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={{ border: `1px solid ${active ? 'transparent' : T.line2}`, cursor: 'pointer', borderRadius: 999,
        padding: '6px 13px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
        color: active ? '#fff' : T.muted, background: active ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'rgba(255,255,255,.75)',
        boxShadow: active ? '0 8px 20px -12px rgba(79,70,229,.95)' : 'none', transition: 'all .22s cubic-bezier(.22,1,.36,1)' }}>
      {children}
    </button>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="km-field">
      <label className="km-label">{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 5, lineHeight: 1.55 }}>{hint}</div>}
    </div>
  );
}

/* ── drawer body: the contacts on one list ──────────────────────────────── */
function ListContacts({ list }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const dq = useDebounced(q, 350);
  useEffect(() => { setPage(1); }, [dq]);

  const { data, loading, error } = usePolling(
    () => kapi('list_contacts', { id: list.id, page, per_page: perPage, search: dq }),
    [list.id, page, perPage, dq]
  );
  const rows = data?.contacts || [];

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 12 }}>
        <SearchInput value={q} onChange={setQ} placeholder="Search this list…" width={240} />
        <Pill tone="indigo">{nf(data?.total || 0)} on this list</Pill>
      </div>

      {error && (
        <Card style={{ marginBottom: 12, borderLeft: `4px solid ${T.red}`, color: T.red, fontSize: 12.5, fontWeight: 600 }}>{error}</Card>
      )}

      {loading && !rows.length ? (
        <div style={{ display: 'grid', gap: 8 }}>{[0, 1, 2, 3, 4, 5].map((i) => <Skel key={i} h={40} r={12} />)}</div>
      ) : rows.length === 0 ? (
        <Empty title="No contacts here" sub={dq ? 'Nothing matched that search.' : 'Import a CSV or add contacts to fill this list.'} />
      ) : (
        <div className="km-tablewrap km-scroll">
          <table className="km-table">
            <thead><tr><th>Email</th><th>Name</th><th>Status</th><th>Engagement</th><th>Last open</th><th>Added</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 700, maxWidth: 240, ...CUT }} title={c.email}>{c.email}</td>
                  <td>{[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}</td>
                  <td><StatusPill value={c.status} /></td>
                  <td><EngPill value={c.engagement} /></td>
                  <td style={{ color: T.muted }} title={c.last_open_at ? fmtDt(c.last_open_at) : ''}>{c.last_open_at ? ago(c.last_open_at) : '—'}</td>
                  <td style={{ color: T.muted }}>{fmtDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} perPage={perPage} total={data?.total || 0} onPage={setPage} onPerPage={(n) => { setPerPage(n); setPage(1); }} />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════════════════ */
export default function KumoAudience() {
  const [sp, setSp] = useSearchParams();
  const tab = ['lists', 'contacts', 'segments'].includes(sp.get('tab')) ? sp.get('tab') : 'lists';
  const setTab = (id) => { const n = new URLSearchParams(sp); n.set('tab', id); setSp(n, { replace: true }); };

  /* ── data ─────────────────────────────────────────────────────────────── */
  const listsQ = usePolling(() => kapi('lists_list'), []);
  const segsQ = usePolling(() => kapi('segments_list'), []);
  const statsQ = usePolling(async () => {
    const [all, active, blocked] = await Promise.all([
      kapi('contacts_list', { page: 1, per_page: 1 }),
      kapi('contacts_list', { page: 1, per_page: 1, status: 'active' }),
      kapi('blocklist_list', { page: 1, per_page: 1 }),
    ]);
    return { contacts: all.total || 0, sendable: active.total || 0, blocked: blocked.total || 0 };
  }, []);

  const lists = listsQ.data?.lists || [];
  const segments = segsQ.data?.segments || [];
  const stats = statsQ.data || {};

  /* contacts tab */
  const [cq, setCq] = useState('');
  const [cStatus, setCStatus] = useState('');
  const [cPage, setCPage] = useState(1);
  const [cPer, setCPer] = useState(25);
  const dcq = useDebounced(cq, 350);
  useEffect(() => { setCPage(1); }, [dcq, cStatus]);
  const contactsQ = usePolling(
    () => kapi('contacts_list', { page: cPage, per_page: cPer, search: dcq, status: cStatus }),
    [cPage, cPer, dcq, cStatus]
  );
  const contacts = contactsQ.data?.contacts || [];

  const listsReload = listsQ.reload, segsReload = segsQ.reload, statsReload = statsQ.reload, contactsReload = contactsQ.reload;
  const refreshAll = useCallback((quiet = true) => {
    listsReload(quiet); segsReload(quiet); statsReload(quiet); contactsReload(quiet);
  }, [listsReload, segsReload, statsReload, contactsReload]);

  /* ── list modal ───────────────────────────────────────────────────────── */
  const [listForm, setListForm] = useState(null); // {id?, name, description}
  const [listBusy, setListBusy] = useState(false);
  const saveList = async () => {
    if (!listForm?.name?.trim()) { toast.error('Give the list a name'); return; }
    setListBusy(true);
    try {
      await kapi('list_save', { id: listForm.id, name: listForm.name.trim(), description: listForm.description || '' });
      toast.success(listForm.id ? 'List renamed' : 'List created');
      setListForm(null);
      listsReload(true); statsReload(true);
    } catch (e) { toast.error(e.message); } finally { setListBusy(false); }
  };

  const [delList, setDelList] = useState(null);
  const [delBusy, setDelBusy] = useState(false);
  const doDelList = async () => {
    setDelBusy(true);
    try {
      await kapi('list_delete', { id: delList.id });
      toast.success(`“${delList.name}” deleted`);
      setDelList(null); listsReload(true); statsReload(true);
    } catch (e) { toast.error(e.message); } finally { setDelBusy(false); }
  };

  const [openList, setOpenList] = useState(null);

  /* ── contact modal ────────────────────────────────────────────────────── */
  const [contactForm, setContactForm] = useState(null);
  const [contactBusy, setContactBusy] = useState(false);
  const saveContact = async () => {
    const f = contactForm || {};
    if (!f.email || !/^\S+@\S+\.\S+$/.test(String(f.email).trim())) { toast.error('A valid email address is required'); return; }
    setContactBusy(true);
    try {
      await kapi('contact_save', {
        id: f.id, email: String(f.email).trim(), first_name: f.first_name || '',
        last_name: f.last_name || '', phone: f.phone || '', list_id: f.list_id || undefined,
      });
      toast.success(f.id ? 'Contact updated' : 'Contact added');
      setContactForm(null); contactsReload(true); statsReload(true); listsReload(true);
    } catch (e) { toast.error(e.message); } finally { setContactBusy(false); }
  };

  const [addToList, setAddToList] = useState(null); // contact row
  const [addListId, setAddListId] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const doAddToList = async () => {
    if (!addListId) { toast.error('Pick a list'); return; }
    setAddBusy(true);
    try {
      await kapi('contact_save', {
        id: addToList.id, email: addToList.email, first_name: addToList.first_name || '',
        last_name: addToList.last_name || '', phone: addToList.phone || '', list_id: addListId,
      });
      toast.success(`${addToList.email} added to the list`);
      setAddToList(null); setAddListId(''); listsReload(true);
    } catch (e) { toast.error(e.message); } finally { setAddBusy(false); }
  };

  const [delContact, setDelContact] = useState(null);
  const [delCBusy, setDelCBusy] = useState(false);
  const doDelContact = async () => {
    setDelCBusy(true);
    try {
      await kapi('contact_delete', { id: delContact.id });
      toast.success('Contact deleted');
      setDelContact(null); contactsReload(true); statsReload(true);
    } catch (e) { toast.error(e.message); } finally { setDelCBusy(false); }
  };

  /* ── import modal ─────────────────────────────────────────────────────── */
  const [impOpen, setImpOpen] = useState(false);
  const [impMode, setImpMode] = useState('csv');
  const [csv, setCsv] = useState(null);           // {name, size, text}
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const [dest, setDest] = useState('');           // '' | listId | '__new__'
  const [destNew, setDestNew] = useState('');
  const [impBusy, setImpBusy] = useState(false);
  const [impResult, setImpResult] = useState(null);
  const [nseg, setNseg] = useState(null);
  const [nsegLoading, setNsegLoading] = useState(false);
  const [nsegQ, setNsegQ] = useState('');
  const [nsegPick, setNsegPick] = useState('');
  const [nsegLimit, setNsegLimit] = useState(5000);

  const openImport = (listId = '') => {
    setImpOpen(true); setImpMode('csv'); setCsv(null); setImpResult(null);
    setDest(listId ? String(listId) : ''); setDestNew(''); setNsegPick(''); setNsegQ('');
  };

  const [segForm, setSegForm] = useState(null);
  const needNetcore = (impOpen && impMode === 'netcore') || segForm?.source === 'netcore';
  useEffect(() => {
    if (!needNetcore || nseg || nsegLoading) return;
    setNsegLoading(true);
    kapi('netcore_segments')
      .then((d) => setNseg(d.segments || []))
      .catch((e) => { toast.error(e.message); setNseg([]); })
      .finally(() => setNsegLoading(false));
  }, [needNetcore, nseg, nsegLoading]);

  const takeFile = (file) => {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => setCsv({ name: file.name, size: file.size, text: String(fr.result || '') });
    fr.onerror = () => toast.error('Could not read that file');
    fr.readAsText(file);
  };

  /** Resolves the destination list, creating it first when the user typed a new name. */
  const resolveDest = async () => {
    if (dest !== '__new__') return dest || undefined;
    if (!destNew.trim()) throw new Error('Name the new list first');
    const r = await kapi('list_save', { name: destNew.trim(), description: 'Created during import' });
    listsReload(true);
    return r.id;
  };

  const runCsvImport = async () => {
    if (!csv?.text?.trim()) { toast.error('Choose a CSV file first'); return; }
    setImpBusy(true); setImpResult(null);
    try {
      const listId = await resolveDest();
      const r = await kapi('contacts_import', { csv: csv.text, list_id: listId, as_blocklist: 0 });
      setImpResult(r);
      toast.success(`${nf(r.imported || 0)} contact${Number(r.imported) === 1 ? '' : 's'} imported`);
      refreshAll();
    } catch (e) { toast.error(e.message); } finally { setImpBusy(false); }
  };

  const runNetcoreImport = async () => {
    if (!nsegPick) { toast.error('Pick a Netcore segment'); return; }
    setImpBusy(true); setImpResult(null);
    try {
      const listId = await resolveDest();
      if (!listId) throw new Error('Pick a destination list');
      const r = await kapi('import_from_netcore_segment', {
        netcore_segment_id: nsegPick, list_id: listId, limit: Math.max(1, Number(nsegLimit) || 1000),
      });
      setImpResult({ rows: (r.imported || 0) + (r.skipped || 0), imported: r.imported, invalid: 0, suppressed: 0, duplicate: r.skipped });
      toast.success(`${nf(r.imported || 0)} imported · ${nf(r.skipped || 0)} skipped`);
      refreshAll();
    } catch (e) { toast.error(e.message); } finally { setImpBusy(false); }
  };

  const nsegFiltered = useMemo(() => {
    const q = nsegQ.trim().toLowerCase();
    const all = nseg || [];
    return q ? all.filter((s) => String(s.name || '').toLowerCase().includes(q) || String(s.id).includes(q)) : all;
  }, [nseg, nsegQ]);

  /* ── segment modal ────────────────────────────────────────────────────── */
  const [segBusy, setSegBusy] = useState(false);
  const [segPreview, setSegPreview] = useState(null);
  const [segPreviewBusy, setSegPreviewBusy] = useState(false);

  const openSegment = (seg) => {
    setSegPreview(null);
    const blank = {
      name: '', description: '', source: 'kumo_list', list_ids: [], engaged_days: 30,
      never_opened: false, domain: '', engagement: '', netcore_segment_id: '',
    };
    if (!seg) { setSegForm(blank); return; }
    const c = seg.config || {};
    setSegForm({
      ...blank, id: seg.id, name: seg.name || '', description: seg.description || '',
      source: seg.source || 'kumo_list',
      list_ids: Array.isArray(c.list_ids) ? c.list_ids.map(String) : [],
      engaged_days: c.engaged_days === undefined || c.engaged_days === null ? 30 : c.engaged_days,
      never_opened: !!Number(c.never_opened),
      domain: c.domain || '', engagement: c.engagement || '',
      netcore_segment_id: c.netcore_segment_id ? String(c.netcore_segment_id) : '',
    });
  };

  const segConfig = (f) => {
    if (!f) return {};
    if (f.source === 'kumo_list') return { list_ids: f.list_ids.map(Number).filter(Boolean) };
    if (f.source === 'netcore') return { netcore_segment_id: f.netcore_segment_id };
    return {
      engaged_days: Number(f.engaged_days) || 0,
      never_opened: f.never_opened ? 1 : 0,
      domain: String(f.domain || '').trim(),
      engagement: f.engagement || '',
    };
  };
  const patchSeg = (patch) => { setSegPreview(null); setSegForm((f) => ({ ...f, ...patch })); };

  const previewSegment = async () => {
    setSegPreviewBusy(true);
    try {
      const r = await kapi('segment_count', { source: segForm.source, config: segConfig(segForm) });
      setSegPreview(Number(r.count) || 0);
      toast.success(`${nf(r.count || 0)} contacts match`);
    } catch (e) { toast.error(e.message); } finally { setSegPreviewBusy(false); }
  };

  const saveSegment = async () => {
    if (!segForm?.name?.trim()) { toast.error('Give the segment a name'); return; }
    if (segForm.source === 'kumo_list' && segForm.list_ids.length === 0) { toast.error('Pick at least one list'); return; }
    if (segForm.source === 'netcore' && !segForm.netcore_segment_id) { toast.error('Pick a Netcore segment'); return; }
    setSegBusy(true);
    try {
      const r = await kapi('segment_save', {
        id: segForm.id, name: segForm.name.trim(), description: segForm.description || '',
        source: segForm.source, config: segConfig(segForm),
      });
      toast.success(`Segment saved · ${nf(r.count || 0)} contacts`);
      setSegForm(null); segsReload(true); statsReload(true);
    } catch (e) { toast.error(e.message); } finally { setSegBusy(false); }
  };

  const [delSeg, setDelSeg] = useState(null);
  const [delSBusy, setDelSBusy] = useState(false);
  const doDelSeg = async () => {
    setDelSBusy(true);
    try {
      await kapi('segment_delete', { id: delSeg.id });
      toast.success('Segment deleted');
      setDelSeg(null); segsReload(true); statsReload(true);
    } catch (e) { toast.error(e.message); } finally { setDelSBusy(false); }
  };

  const recount = async (seg) => {
    try {
      const r = await kapi('segment_count', { id: seg.id });
      toast.success(`${seg.name}: ${nf(r.count || 0)} contacts`);
      segsReload(true);
    } catch (e) { toast.error(e.message); }
  };

  /* ── render ───────────────────────────────────────────────────────────── */
  return (
    <div className="km km-page">
      <KumoStyles />

      <div className="km-head">
        <div>
          <h1 className="km-h1">Audience</h1>
          <div className="km-sub">
            Lists, contacts and segments for your own sending platform · {nf(stats.contacts || 0)} contacts ·
            {' '}{nf(lists.length)} list{lists.length === 1 ? '' : 's'} · {nf(segments.length)} segment{segments.length === 1 ? '' : 's'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn variant="ghost" size="sm" onClick={() => refreshAll(false)} icon={<IconRefresh size={14} />}>Refresh</Btn>
          <Btn size="sm" onClick={() => openImport()} icon={<IconUpload size={14} />}>Import contacts</Btn>
        </div>
      </div>

      {/* ── KPI row ──────────────────────────────────────────────────────── */}
      <div className="km-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginBottom: 16 }}>
        <StatTile label="Contacts" value={stats.contacts} format={compact} tone="indigo" icon={<IconUsers size={15} />}
          loading={statsQ.loading} sub={`${nf(stats.contacts || 0)} in the database`} onClick={() => setTab('contacts')} />
        <StatTile label="Sendable" value={stats.sendable} format={compact} tone="green" icon={<IconCheck size={15} />} loading={statsQ.loading} sub="Status active" />
        <StatTile label="Blocklisted" value={stats.blocked} format={compact} tone="red" icon={<IconShield size={15} />}
          loading={statsQ.loading} sub="Suppressed from every send" />
        <StatTile label="Lists" value={lists.length} tone="cyan" icon={<IconLayers size={15} />}
          loading={listsQ.loading} sub="Curated by hand" onClick={() => setTab('lists')} />
        <StatTile label="Segments" value={segments.length} tone="amber" icon={<IconActivity size={15} />}
          loading={segsQ.loading} sub="Rebuilt on demand" onClick={() => setTab('segments')} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <Tabs value={tab} onChange={setTab} tabs={[
          { id: 'lists', label: 'Lists', icon: <IconLayers size={14} />, count: lists.length },
          { id: 'contacts', label: 'Contacts', icon: <IconUsers size={14} />, count: contactsQ.data?.total },
          { id: 'segments', label: 'Segments', icon: <IconActivity size={14} />, count: segments.length }, ]} />
      </div>

      {/* ══ LISTS ═══════════════════════════════════════════════════════ */}
      {tab === 'lists' && (
        <div className="km-fade">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <h2 className="km-h2">Your lists</h2>
              <div className="km-sub">A list is a fixed set of people — it only changes when you change it. Segments are rules that recount themselves.</div>
            </div>
            <Btn size="sm" onClick={() => setListForm({ name: '', description: '' })} icon={<IconPlus size={14} />}>New list</Btn>
          </div>

          {listsQ.error && (
            <Card style={{ marginBottom: 12, borderLeft: `4px solid ${T.red}`, color: T.red, fontSize: 13, fontWeight: 600 }}>{listsQ.error}</Card>
          )}

          {listsQ.loading && !lists.length ? (
            <div className="km-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(214px, 1fr))' }}>
              {[0, 1, 2, 3].map((i) => <Skel key={i} h={156} r={18} />)}
            </div>
          ) : lists.length === 0 ? (
            <Card><Empty icon={<IconLayers size={22} />} title="No lists yet" sub="Create a list, then import a CSV or pull people across from an existing Netcore segment."
              action={<Btn onClick={() => setListForm({ name: '', description: '' })} icon={<IconPlus size={14} />}>Create your first list</Btn>} /></Card>
          ) : (
            <div className="km-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(214px, 1fr))' }}>
              {lists.map((l) => (
                <Card key={l.id} hover className="km-fade" style={{ cursor: 'pointer', minWidth: 0 }} onClick={() => setOpenList(l)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 28, height: 28, borderRadius: 9, display: 'grid', placeItems: 'center', flexShrink: 0,
                          background: 'linear-gradient(135deg, rgba(99,102,241,.16), rgba(6,182,212,.16))', color: T.brand }}><IconLayers size={14} /></span>
                        <span style={{ fontWeight: 800, fontSize: 14.5, color: T.ink, letterSpacing: '-.2px', minWidth: 0, ...CUT }} title={l.name}>{l.name}</span>
                      </div>
                      <div style={{ fontSize: 11.8, color: T.muted, marginTop: 8, lineHeight: 1.5, minHeight: 17 }}>
                        {l.description || <span style={{ color: T.faint }}>No description</span>}
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
                      <RowMenu items={[
                        { label: 'Open', icon: <IconEye size={14} />, onClick: () => setOpenList(l) },
                        { label: 'Rename', icon: <IconEdit size={14} />, onClick: () => setListForm({ id: l.id, name: l.name, description: l.description || '' }) },
                        { label: 'Import contacts', icon: <IconUpload size={14} />, onClick: () => openImport(l.id) },
                        { label: 'Delete', icon: <IconTrash size={14} />, tone: 'danger', onClick: () => setDelList(l) }, ]} />
                    </div>
                  </div>
                  <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={bigNum('linear-gradient(120deg,#6366f1,#8b5cf6)')}><CountUp value={l.contact_count} /></div>
                      <div style={CAP}>contacts</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {l.kind && <Pill tone="slate">{l.kind}</Pill>}
                      <div style={{ fontSize: 10.8, color: T.faint, marginTop: 6, fontWeight: 600 }}>{fmtDate(l.created_at)}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ CONTACTS ════════════════════════════════════════════════════ */}
      {tab === 'contacts' && (
        <div className="km-fade">
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <SearchInput value={cq} onChange={setCq} placeholder="Search name, email, phone…" width={248} />
                {STATUS_CHIPS.map((s) => (
                  <Chip key={s.id || 'all'} active={cStatus === s.id} onClick={() => setCStatus(s.id)}>{s.label}</Chip>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn variant="ghost" size="sm" onClick={() => openImport()} icon={<IconUpload size={14} />}>Import</Btn>
                <Btn size="sm" icon={<IconPlus size={14} />}
                  onClick={() => setContactForm({ email: '', first_name: '', last_name: '', phone: '', list_id: '' })}>Add contact</Btn>
              </div>
            </div>
          </Card>

          <Card pad={false} style={{ padding: '6px 10px 4px' }}>
            {contactsQ.error && (
              <div style={{ margin: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(239,68,68,.07)',
                color: T.red, fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconAlert size={14} /> {contactsQ.error}
              </div>
            )}
            {contactsQ.loading && !contacts.length ? (
              <div style={{ display: 'grid', gap: 8, padding: 12 }}>{[0, 1, 2, 3, 4, 5, 6].map((i) => <Skel key={i} h={40} r={12} />)}</div>
            ) : contacts.length === 0 ? (
              <Empty icon={<IconUsers size={22} />} title="No contacts found"
                sub={dcq || cStatus ? 'Nothing matched those filters — try clearing the search or the status chip.' : 'Import a CSV or add someone by hand to get started.'}
                action={<Btn onClick={() => openImport()} icon={<IconUpload size={14} />}>Import contacts</Btn>} />
            ) : (
              <div className="km-tablewrap km-scroll">
                <table className="km-table">
                  <thead>
                    <tr>
                      <th>Email</th><th>Name</th><th>Status</th><th>Engagement</th>
                      <th>Last open</th><th>Last click</th><th>Created</th><th style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 700, maxWidth: 260, ...CUT }} title={c.email}>{c.email}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}</td>
                        <td><StatusPill value={c.status} /></td>
                        <td><EngPill value={c.engagement} /></td>
                        <td style={{ color: T.muted, whiteSpace: 'nowrap' }} title={c.last_open_at ? fmtDt(c.last_open_at) : ''}>{c.last_open_at ? ago(c.last_open_at) : '—'}</td>
                        <td style={{ color: T.muted, whiteSpace: 'nowrap' }} title={c.last_click_at ? fmtDt(c.last_click_at) : ''}>{c.last_click_at ? ago(c.last_click_at) : '—'}</td>
                        <td style={{ color: T.muted, whiteSpace: 'nowrap' }}>{fmtDate(c.created_at)}</td>
                        <td>
                          <RowMenu items={[
                            { label: 'Edit', icon: <IconEdit size={14} />, onClick: () => setContactForm({ ...c, list_id: '' }) },
                            { label: 'Add to list', icon: <IconLayers size={14} />, onClick: () => { setAddToList(c); setAddListId(lists[0]?.id ? String(lists[0].id) : ''); } },
                            { label: 'Delete', icon: <IconTrash size={14} />, tone: 'danger', onClick: () => setDelContact(c) }, ]} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={cPage} perPage={cPer} total={contactsQ.data?.total || 0} onPage={setCPage} onPerPage={(n) => { setCPer(n); setCPage(1); }} />
          </Card>
        </div>
      )}

      {/* ══ SEGMENTS ════════════════════════════════════════════════════ */}
      {tab === 'segments' && (
        <div className="km-fade">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <h2 className="km-h2">Segments</h2>
              <div className="km-sub">Rules, not snapshots — a segment is recounted every time a campaign uses it.</div>
            </div>
            <Btn size="sm" onClick={() => openSegment(null)} icon={<IconPlus size={14} />}>New segment</Btn>
          </div>

          {segsQ.error && (
            <Card style={{ marginBottom: 12, borderLeft: `4px solid ${T.red}`, color: T.red, fontSize: 13, fontWeight: 600 }}>{segsQ.error}</Card>
          )}

          {segsQ.loading && !segments.length ? (
            <div className="km-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(219px, 1fr))' }}>
              {[0, 1, 2].map((i) => <Skel key={i} h={162} r={18} />)}
            </div>
          ) : segments.length === 0 ? (
            <Card><Empty icon={<IconActivity size={22} />} title="No segments yet"
              sub="Build one from your lists, from engagement behaviour, or mirror a segment that already exists in Netcore."
              action={<Btn onClick={() => openSegment(null)} icon={<IconPlus size={14} />}>Create a segment</Btn>} /></Card>
          ) : (
            <div className="km-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(219px, 1fr))' }}>
              {segments.map((s) => (
                <Card key={s.id} hover className="km-fade" style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14.5, color: T.ink, letterSpacing: '-.2px', ...CUT }} title={s.name}>{s.name}</div>
                      <div style={{ marginTop: 8 }}><Pill tone={SOURCE_TONE[s.source] || 'slate'}>{SOURCE_LABEL[s.source] || s.source}</Pill></div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <RowMenu items={[
                        { label: 'Recount now', icon: <IconRefresh size={14} />, onClick: () => recount(s) },
                        { label: 'Edit', icon: <IconEdit size={14} />, onClick: () => openSegment(s) },
                        { label: 'Delete', icon: <IconTrash size={14} />, tone: 'danger', onClick: () => setDelSeg(s) }, ]} />
                    </div>
                  </div>
                  <div style={{ fontSize: 11.8, color: T.muted, marginTop: 9, lineHeight: 1.5, minHeight: 17 }}>
                    {s.description || <span style={{ color: T.faint }}>No description</span>}
                  </div>
                  <div style={{ marginTop: 13, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={bigNum('linear-gradient(120deg,#06b6d4,#6366f1)')}><CountUp value={s.cached_count} /></div>
                      <div style={CAP}>contacts</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 10.8, color: T.faint, fontWeight: 600, lineHeight: 1.6 }}>
                      <div>counted {s.counted_at ? ago(s.counted_at) : 'never'}</div>
                      <div>made {fmtDate(s.created_at)}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ DRAWER: the contacts on one list ════════════════════════════ */}
      <Drawer open={!!openList} onClose={() => setOpenList(null)} width={820} title={openList?.name || 'List'}
        subtitle={openList ? `${nf(openList.contact_count || 0)} contacts · created ${fmtDate(openList.created_at)}${openList.created_by ? ` by ${openList.created_by}` : ''}` : ''}
        footer={<> <Btn variant="ghost" onClick={() => openList && openImport(openList.id)} icon={<IconUpload size={14} />}>Import into this list</Btn>
          <Btn onClick={() => setOpenList(null)}>Done</Btn> </>}>
        {openList && <ListContacts list={openList} />}
      </Drawer>

      {/* ══ MODAL: list create / rename ═════════════════════════════════ */}
      <Modal open={!!listForm} onClose={() => setListForm(null)} width={480} title={listForm?.id ? 'Rename list' : 'New list'}
        subtitle={listForm?.id ? 'Only the name and description change — the contacts stay put.' : 'A named bucket you can import into and send to.'} footer={<>
          <Btn variant="ghost" onClick={() => setListForm(null)}>Cancel</Btn> <Btn loading={listBusy} onClick={saveList}>{listForm?.id ? 'Save' : 'Create list'}</Btn> </>}>
        <Field label="Name">
          <input className="km-input" autoFocus value={listForm?.name || ''} placeholder="e.g. Placement drive — Nov"
            onChange={(e) => setListForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Description" hint="Optional, but future-you will thank present-you.">
          <textarea className="km-textarea" rows={3} value={listForm?.description || ''} placeholder="Who is on this list and where they came from"
            onChange={(e) => setListForm((f) => ({ ...f, description: e.target.value }))} />
        </Field>
      </Modal>

      {/* ══ MODAL: contact add / edit ═══════════════════════════════════ */}
      <Modal open={!!contactForm} onClose={() => setContactForm(null)} width={520} title={contactForm?.id ? 'Edit contact' : 'Add contact'}
        subtitle={contactForm?.id ? contactForm.email : 'One person, added by hand.'} footer={<> <Btn variant="ghost" onClick={() => setContactForm(null)}>Cancel</Btn>
          <Btn loading={contactBusy} onClick={saveContact}>{contactForm?.id ? 'Save changes' : 'Add contact'}</Btn> </>}>
        <Field label="Email address">
          <input className="km-input" type="email" autoFocus value={contactForm?.email || ''} placeholder="name@example.com"
            onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <Field label="First name">
            <input className="km-input" value={contactForm?.first_name || ''} onChange={(e) => setContactForm((f) => ({ ...f, first_name: e.target.value }))} />
          </Field>
          <Field label="Last name">
            <input className="km-input" value={contactForm?.last_name || ''} onChange={(e) => setContactForm((f) => ({ ...f, last_name: e.target.value }))} />
          </Field>
        </div>
        <Field label="Phone">
          <input className="km-input" value={contactForm?.phone || ''} placeholder="Optional" onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))} />
        </Field>
        <Field label="Add to list" hint="Optional — you can always add them to a list later.">
          <select className="km-select" value={contactForm?.list_id || ''} onChange={(e) => setContactForm((f) => ({ ...f, list_id: e.target.value }))}>
            <option value="">No list</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
      </Modal>

      {/* ══ MODAL: add an existing contact to a list ════════════════════ */}
      <Modal open={!!addToList} onClose={() => setAddToList(null)} width={440} title="Add to list" subtitle={addToList?.email} footer={<>
          <Btn variant="ghost" onClick={() => setAddToList(null)}>Cancel</Btn> <Btn loading={addBusy} onClick={doAddToList} disabled={lists.length === 0}>Add</Btn> </>}>
        {lists.length === 0 ? (
          <Empty title="No lists yet" sub="Create a list first, then come back." />
        ) : (
          <Field label="List">
            <select className="km-select" value={addListId} onChange={(e) => setAddListId(e.target.value)}>
              <option value="">Choose a list…</option>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({nf(l.contact_count)})</option>)}
            </select>
          </Field>
        )}
      </Modal>

      {/* ══ MODAL: import ═══════════════════════════════════════════════ */}
      <Modal open={impOpen} onClose={() => setImpOpen(false)} width={660} title="Import contacts"
        subtitle="Upload a CSV, or copy people across from a Netcore segment you already have." footer={<>
          <Btn variant="ghost" onClick={() => setImpOpen(false)}>Close</Btn> {impMode === 'csv'
            ? <Btn loading={impBusy} onClick={runCsvImport} icon={<IconUpload size={14} />}>Import CSV</Btn>
            : <Btn loading={impBusy} onClick={runNetcoreImport} icon={<IconGlobe size={14} />}>Import from Netcore</Btn>} </>}>
        <div style={{ marginBottom: 16 }}>
          <Tabs size="sm" value={impMode} onChange={(m) => { setImpMode(m); setImpResult(null); }} tabs={[
            { id: 'csv', label: 'CSV file', icon: <IconUpload size={13} /> }, { id: 'netcore', label: 'Netcore segment', icon: <IconGlobe size={13} /> }, ]} />
        </div>

        {impMode === 'csv' && (
          <>
            <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); takeFile(e.dataTransfer?.files?.[0]); }} onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${dragging ? '#818cf8' : T.line2}`, borderRadius: 16, padding: '26px 18px',
                textAlign: 'center', cursor: 'pointer', transition: 'all .22s cubic-bezier(.22,1,.36,1)',
                background: dragging ? 'rgba(99,102,241,.08)' : 'rgba(255,255,255,.6)', transform: dragging ? 'scale(1.01)' : 'none' }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, margin: '0 auto 10px', display: 'grid', placeItems: 'center',
                background: 'linear-gradient(135deg, rgba(99,102,241,.14), rgba(6,182,212,.14))', color: T.brand }}>
                <IconUpload size={20} />
              </div>
              {csv ? (
                <>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: T.ink2, wordBreak: 'break-all' }}>{csv.name}</div>
                  <div style={{ fontSize: 11.5, color: T.muted, marginTop: 5 }}>
                    ~{nf(Math.max(0, csv.text.split(/\r?\n/).filter((l) => l.trim()).length - 1))} data rows · {compact(csv.size)} bytes · click to replace
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: T.ink2 }}>{dragging ? 'Drop it here' : 'Drop a CSV here, or click to browse'}</div>
                  <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6, lineHeight: 1.6 }}>
                    First row is the header. Recognised columns: <b>email</b>, first_name, last_name, phone.
                  </div>
                </>
              )}
              <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" style={{ display: 'none' }}
                onChange={(e) => { takeFile(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            {csv && (
              <div style={{ marginTop: 10, textAlign: 'right' }}>
                <Btn variant="ghost" size="sm" onClick={() => setCsv(null)} icon={<IconX size={13} />}>Clear file</Btn>
              </div>
            )}
            <div style={{ height: 14 }} />
          </>
        )}

        {impMode === 'netcore' && (
          <>
            <div style={{ padding: '10px 13px', borderRadius: 12, background: 'rgba(6,182,212,.08)', fontSize: 11.8,
              color: '#0e7490', fontWeight: 600, lineHeight: 1.6, marginBottom: 14 }}>
              This only <b>reads</b> your existing Netcore segments. Nothing is created, changed or sent in Netcore —
              the matching contacts are simply copied into the Kumo list you choose.
            </div>
            <Field label="Find a segment">
              <SearchInput value={nsegQ} onChange={setNsegQ} placeholder="Search Netcore segments…" width="100%" />
            </Field>
            <div className="km-scroll" style={{ maxHeight: 230, overflow: 'auto', border: `1px solid ${T.line}`, borderRadius: 13, padding: 6, marginBottom: 14 }}>
              {nsegLoading ? (
                <div style={{ display: 'grid', gap: 6, padding: 6 }}>{[0, 1, 2, 3].map((i) => <Skel key={i} h={38} r={10} />)}</div>
              ) : nsegFiltered.length === 0 ? (
                <Empty title="No segments" sub={nsegQ ? 'Nothing matched that search.' : 'No Netcore segments were returned.'} />
              ) : nsegFiltered.map((s) => {
                const active = String(nsegPick) === String(s.id);
                return (
                  <button key={s.id} onClick={() => setNsegPick(String(s.id))}
                    style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                      border: 0, cursor: 'pointer', borderRadius: 10, padding: '9px 11px', textAlign: 'left',
                      background: active ? 'rgba(99,102,241,.12)' : 'transparent', transition: 'background .18s' }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 12.8, fontWeight: 700, color: active ? T.brand : T.ink2, ...CUT }}>{s.name}</span>
                      <span style={{ display: 'block', fontSize: 11, color: T.muted, marginTop: 2 }}>
                        id {s.id} · {nf(s.email_count || 0)} emails · {nf(s.user_count || 0)} users</span>
                    </span>
                    {active && <span style={{ color: T.brand, flexShrink: 0 }}><IconCheck size={15} /></span>}
                  </button>
                );
              })}
            </div>
            <Field label="Maximum contacts to copy" hint="Keeps a very large segment from flooding the list in one go.">
              <input className="km-input" type="number" min={1} value={nsegLimit} onChange={(e) => setNsegLimit(e.target.value)} />
            </Field>
          </>
        )}

        <Field label="Destination list"
          hint={impMode === 'netcore' ? 'Required — imported contacts land on this list.' : 'Optional for a CSV; the contacts are stored either way.'}>
          <select className="km-select" value={dest} onChange={(e) => setDest(e.target.value)}>
            <option value="">{impMode === 'netcore' ? 'Choose a list…' : 'No list (contacts only)'}</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({nf(l.contact_count)})</option>)}
            <option value="__new__">+ Create a new list…</option>
          </select>
        </Field>
        {dest === '__new__' && (
          <Field label="New list name">
            <input className="km-input" value={destNew} placeholder="e.g. Netcore — hot leads" onChange={(e) => setDestNew(e.target.value)} />
          </Field>
        )}

        {impResult && (
          <div className="km-pop" style={{ marginTop: 6, padding: 14, borderRadius: 14, background: 'rgba(16,185,129,.07)', border: '1px solid rgba(16,185,129,.22)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 13, color: '#047857', marginBottom: 11 }}>
              <IconCheck size={15} /> Import finished
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: 9 }}>
              {[
                ['Rows read', impResult.rows, '#64748b'],
                ['Imported', impResult.imported, '#059669'],
                ['Invalid', impResult.invalid, '#dc2626'],
                ['Suppressed', impResult.suppressed, '#d97706'],
                ['Duplicates', impResult.duplicate, '#4f46e5'],
              ].map(([k, v, c]) => (
                <div key={k} style={{ padding: '9px 10px', borderRadius: 11, background: 'rgba(255,255,255,.75)', textAlign: 'center' }}>
                  <div style={{ fontSize: 9.8, fontWeight: 800, letterSpacing: '.4px', textTransform: 'uppercase', color: T.faint }}>{k}</div>
                  <div style={{ marginTop: 3, fontSize: 16, fontWeight: 800, color: c }}>{nf(v || 0)}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11.2, color: T.muted, lineHeight: 1.6 }}>
              “Suppressed” means the address is already on the blocklist, so it was skipped rather than added as sendable.
            </div>
          </div>
        )}
      </Modal>

      {/* ══ MODAL: segment builder ══════════════════════════════════════ */}
      <Modal open={!!segForm} onClose={() => setSegForm(null)} width={640} title={segForm?.id ? 'Edit segment' : 'New segment'}
        subtitle="Segments are rules. The count is recalculated whenever a campaign sends." footer={<> <Btn variant="ghost" onClick={() => setSegForm(null)}>Cancel</Btn>
          <Btn variant="ghost" loading={segPreviewBusy} onClick={previewSegment} icon={<IconEye size={14} />}>Preview count</Btn>
          <Btn loading={segBusy} onClick={saveSegment}>{segForm?.id ? 'Save segment' : 'Create segment'}</Btn> </>}>
        <Field label="Name">
          <input className="km-input" autoFocus value={segForm?.name || ''} placeholder="e.g. Opened in the last 30 days"
            onChange={(e) => setSegForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Description">
          <input className="km-input" value={segForm?.description || ''} placeholder="Optional"
            onChange={(e) => setSegForm((f) => ({ ...f, description: e.target.value }))} />
        </Field>

        <label className="km-label">Source</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 9, marginBottom: 16 }}>
          {SOURCES.map((s) => {
            const active = segForm?.source === s.id;
            return (
              <button key={s.id} onClick={() => patchSeg({ source: s.id })} style={{ textAlign: 'left', cursor: 'pointer', borderRadius: 13, padding: '11px 13px',
                  border: `1px solid ${active ? 'rgba(99,102,241,.45)' : T.line2}`, background: active ? 'rgba(99,102,241,.09)' : 'rgba(255,255,255,.7)',
                  boxShadow: active ? '0 10px 26px -18px rgba(79,70,229,.9)' : 'none', transition: 'all .22s cubic-bezier(.22,1,.36,1)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800, fontSize: 12.8, color: active ? T.brand : T.ink2 }}>
                  {s.icon}{s.label}
                </span>
                <span style={{ display: 'block', fontSize: 11, color: T.muted, marginTop: 5, lineHeight: 1.5 }}>{s.hint}</span>
              </button>
            );
          })}
        </div>

        {segForm?.source === 'kumo_list' && (
          <Field label="Lists in this segment" hint="Anyone on any of the selected lists is included.">
            {lists.length === 0 ? <Empty title="No lists yet" sub="Create a list first." /> : (
              <div className="km-scroll" style={{ maxHeight: 210, overflow: 'auto', border: `1px solid ${T.line}`, borderRadius: 13, padding: 6 }}>
                {lists.map((l) => {
                  const on = segForm.list_ids.includes(String(l.id));
                  return (
                    <button key={l.id} onClick={() => patchSeg({ list_ids: on ? segForm.list_ids.filter((x) => x !== String(l.id)) : [...segForm.list_ids, String(l.id)] })}
                      style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, border: 0, cursor: 'pointer',
                        borderRadius: 10, padding: '8px 10px', textAlign: 'left', background: on ? 'rgba(99,102,241,.1)' : 'transparent', transition: 'background .18s' }}>
                      <span style={{ width: 18, height: 18, borderRadius: 6, display: 'grid', placeItems: 'center', flexShrink: 0,
                        border: `1px solid ${on ? 'transparent' : T.line2}`, color: '#fff', background: on ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#fff' }}>
                        {on && <IconCheck size={12} />}
                      </span>
                      <span style={{ fontSize: 12.8, fontWeight: 700, color: T.ink2, minWidth: 0, ...CUT }}>{l.name}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11.5, color: T.muted, fontWeight: 700, flexShrink: 0 }}>{nf(l.contact_count)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Field>
        )}

        {segForm?.source === 'engagement' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(149px, 1fr))', gap: 12 }}>
              <Field label="Engaged in the last (days)" hint="0 keeps everyone, regardless of recency.">
                <input className="km-input" type="number" min={0} value={segForm.engaged_days} onChange={(e) => patchSeg({ engaged_days: e.target.value })} />
              </Field>
              <Field label="Engagement level" hint="How the scoring job classified them.">
                <select className="km-select" value={segForm.engagement} onChange={(e) => patchSeg({ engagement: e.target.value })}>
                  <option value="">Any level</option>
                  {ENG_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Email domain" hint="Optional. e.g. gmail.com — handy for provider-specific warmup sends.">
              <input className="km-input" value={segForm.domain} placeholder="gmail.com" onChange={(e) => patchSeg({ domain: e.target.value })} />
            </Field>
            <div style={{ padding: '11px 13px', borderRadius: 12, background: 'rgba(15,23,42,.035)', marginBottom: 14 }}>
              <Toggle checked={!!segForm.never_opened} onChange={(v) => patchSeg({ never_opened: v })} label="Only people who have never opened"
                hint="Useful for a re-permission run — or to know who to leave out of your best sends." />
            </div>
          </>
        )}

        {segForm?.source === 'netcore' && (
          <Field label="Netcore segment" hint="Read-only — the segment stays in Netcore, this rule just points at it.">
            {nsegLoading ? (
              <div style={{ display: 'grid', gap: 6 }}>{[0, 1, 2].map((i) => <Skel key={i} h={38} r={10} />)}</div>
            ) : (
              <select className="km-select" value={segForm.netcore_segment_id} onChange={(e) => patchSeg({ netcore_segment_id: e.target.value })}>
                <option value="">Choose a segment…</option>
                {(nseg || []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name} · {nf(s.email_count || 0)} emails</option>
                ))}
              </select>
            )}
          </Field>
        )}

        {segPreview !== null && (
          <div className="km-pop" style={{ padding: '13px 16px', borderRadius: 14, background: 'rgba(99,102,241,.08)',
            border: '1px solid rgba(99,102,241,.22)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="km-h3" style={{ fontSize: 10.5 }}>Matching contacts</div>
              <div style={{ marginTop: 4, fontSize: 26, fontWeight: 800, letterSpacing: '-.6px', lineHeight: 1.1,
                background: 'linear-gradient(120deg,#4f46e5,#06b6d4)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                <CountUp value={segPreview} />
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 600, maxWidth: 260, lineHeight: 1.55 }}>
              Counted right now. Blocklisted and unsubscribed addresses are removed again at send time.
            </div>
          </div>
        )}
      </Modal>

      {/* ══ CONFIRMS ════════════════════════════════════════════════════ */}
      <Confirm open={!!delList} busy={delBusy} title="Delete this list?"
        message={<>Deleting <b>{delList?.name}</b> removes the list and its membership. The contacts themselves stay in the database and on any other list they belong to.</>}
        confirmLabel="Delete list" onCancel={() => setDelList(null)} onConfirm={doDelList} />

      <Confirm open={!!delContact} busy={delCBusy} title="Delete this contact?"
        message={<><b>{delContact?.email}</b> will be removed from every list and segment. Their delivery history stays on the campaigns they were part of.</>}
        confirmLabel="Delete contact" onCancel={() => setDelContact(null)} onConfirm={doDelContact} />

      <Confirm open={!!delSeg} busy={delSBusy} title="Delete this segment?"
        message={<>Deleting <b>{delSeg?.name}</b> removes the rule only — no contacts are touched. Campaigns already using it will need a new audience.</>}
        confirmLabel="Delete segment" onCancel={() => setDelSeg(null)} onConfirm={doDelSeg} />

      <div style={{ height: 20 }} />
    </div>
  );
}
