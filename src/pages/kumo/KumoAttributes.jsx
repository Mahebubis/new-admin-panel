/*
 * Kumo — Attributes.
 *
 * The Netcore Attributes screen (src/pages/netcore/NetcoreAttributes.jsx) with its data
 * layer intact: the same header and toolbar, the same table chrome and category pills, the
 * same 3-dot row menu, the same create/edit drawer and the same per-page footer.
 *
 * TWO STORES IN ONE TABLE
 * -----------------------
 * The rows come from two places and every row says which:
 *
 *   - SHARED rows, from the panel's own attribute endpoint (ATTR_API). These are the exact
 *     attributes the Netcore screen manages — creating, editing or deleting one here does
 *     the same thing it does there, because it is the same record. Badged "Netcore".
 *   - KUMO rows, from kapi('attributes_list', { include_netcore: 0 }). These live in this
 *     module's own table and are only usable by Kumo campaigns. Badged "Kumo".
 *
 * Both kinds are fully editable; Edit and Delete each go to the backend that owns the row.
 * The Origin filter (All / Kumo / Netcore) and the Category filter live in the URL, so a
 * filtered view can be linked to.
 *
 * The shared endpoint pages its list server-side; this screen wants one merged set to filter
 * and sort over, so it walks those pages once on load and does the searching, filtering and
 * paging in the browser.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import TopConfirm from '../../components/TopConfirm';
import { kapi, KumoStyles, Pill } from './kumoShared';
import KumoCreateAttributeModal from './KumoCreateAttributeModal';
import { chainSummary } from './KumoAttributeChainBuilder';

const ATTR_API = '/api/attributes/attributes.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

const PER_PAGE_OPTS = [10, 25, 50, 100];

// system = one mapped column, linked = a multi-step lookup chain, custom = no database
// source at all (a default value, or per-contact data from a CSV import).
const CATEGORY_STYLE = {
  system: { color: '#1d4ed8', background: '#dbeafe' },
  linked: { color: '#0f766e', background: '#ccfbf1' },
  custom: { color: '#7c3aed', background: '#ede9fe' },
};

const CATEGORY_FILTERS = [
  { id: 'all',    label: 'All' },
  { id: 'custom', label: 'Custom' },
  { id: 'system', label: 'System' },
  { id: 'linked', label: 'Linked' },
];
const ORIGIN_FILTERS = [
  { id: 'all',     label: 'All' },
  { id: 'kumo',    label: 'Kumo' },
  { id: 'netcore', label: 'Netcore' },
];

const originOf = (r) => ((r?.origin || 'netcore') === 'kumo' ? 'kumo' : 'netcore');

function fmtDt(s) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d.getTime())) return s;
  const pad = n => String(n).padStart(2, '0');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()}`;
}

function Spinner({ size = 32 }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', border: '3px solid #c4b5fd', borderTopColor: '#4f46e5', animation: 'kma_spin 0.85s linear infinite' }} />;
}

/** The segmented filter used for both Category and Origin, so the two read as one control. */
function FilterGroup({ title, options, value, counts, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>{title}</span>
      <div style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 9, background: '#f1f5f9', border: '1.5px solid #e2e8f0' }}>
        {options.map(o => {
          const active = o.id === value;
          const n = counts?.[o.id];
          return (
            <button key={o.id} type="button" onClick={() => onChange(o.id)}
              style={{
                border: 'none', borderRadius: 6, cursor: 'pointer', padding: '5px 11px', fontSize: 11.5, fontWeight: 700,
                fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all .18s',
                background: active ? '#1e3a8a' : 'transparent', color: active ? '#fff' : '#475569',
              }}>
              {o.label}
              {n !== undefined && (
                <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 999, background: active ? 'rgba(255,255,255,.22)' : '#e2e8f0', color: active ? '#fff' : '#64748b' }}>
                  {Number(n || 0).toLocaleString()}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Walk the shared endpoint's pages once so the whole set can be merged with Kumo's own. */
async function fetchAllShared() {
  const out = [];
  let page = 1;
  for (let guard = 0; guard < 25; guard += 1) {
    const res = await api.post(ATTR_API, new URLSearchParams({ action: 'list', page, per_page: 100, search: '' }), FORM);
    if (!res.data.success) throw new Error(res.data.message || 'Could not load shared attributes');
    const d = res.data.data || {};
    out.push(...(d.attributes || []));
    const pages = Number(d.pages || 1);
    if (page >= pages) break;
    page += 1;
  }
  return out;
}

export default function KumoAttributes() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();

  const [all, setAll]         = useState([]);
  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [loading, setLoading] = useState(true);

  const category = CATEGORY_FILTERS.some(c => c.id === params.get('category')) ? params.get('category') : 'all';
  const origin   = ORIGIN_FILTERS.some(o => o.id === params.get('origin')) ? params.get('origin') : 'all';

  const [search, setSearch]               = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [searchOpen, setSearchOpen]       = useState(false);
  const searchInputRef = useRef(null);

  const [menuFor, setMenuFor] = useState(null);
  const menuRef = useRef(null);
  const [modalMode, setModalMode] = useState(null); // null | 'create' | { editRow }
  const [delRow, setDelRow]   = useState(null);
  const [delBusy, setDelBusy] = useState(false);

  /* Both stores are asked in parallel; if one is down the other still fills the table. */
  const load = async () => {
    setLoading(true); setMenuFor(null);
    const [shared, own] = await Promise.allSettled([
      fetchAllShared(),
      kapi('attributes_list', { include_netcore: 0 }),
    ]);

    const rowsOut = [];
    if (shared.status === 'fulfilled') {
      rowsOut.push(...shared.value.map(a => ({ ...a, origin: 'netcore' })));
    } else {
      toast.error(shared.reason?.message || 'Could not load shared attributes');
    }
    if (own.status === 'fulfilled') {
      rowsOut.push(...(own.value.attributes || []).map(a => ({ ...a, origin: 'kumo' })));
    } else {
      toast.error(own.reason?.message || 'Could not load Kumo attributes');
    }

    rowsOut.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    setAll(rowsOut);
    setLoading(false);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  useEffect(() => {
    if (!menuFor) return;
    const onDown = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuFor(null); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuFor]);

  /* The filters live in the URL so a filtered view is linkable. */
  const setFilter = (key, val) => {
    const next = new URLSearchParams(params);
    if (val === 'all') next.delete(key); else next.set(key, val);
    setParams(next, { replace: true });
    setPage(1); setMenuFor(null);
  };

  /* Everything is held in memory, so filtering, searching and paging happen here. */
  const filtered = useMemo(() => {
    const q = appliedSearch.trim().toLowerCase();
    return all.filter(r => {
      if (category !== 'all' && r.category !== category) return false;
      if (origin !== 'all' && originOf(r) !== origin) return false;
      if (!q) return true;
      return String(r.name || '').toLowerCase().includes(q)
        || String(r.mapped_table || '').toLowerCase().includes(q)
        || String(r.mapped_column || '').toLowerCase().includes(q)
        || String(r.default_value || '').toLowerCase().includes(q)
        || String(r.id).includes(q);
    });
  }, [all, appliedSearch, category, origin]);

  const tally = useMemo(() => {
    const c = { all: all.length, custom: 0, system: 0, linked: 0, kumo: 0, netcore: 0 };
    all.forEach(r => {
      if (c[r.category] !== undefined) c[r.category] += 1;
      c[originOf(r)] += 1;
    });
    return c;
  }, [all]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  /* Delete goes to whichever backend owns the row. */
  const doDelete = async () => {
    if (!delRow) return;
    setDelBusy(true);
    const t = toast.loading('Deleting…');
    try {
      if (originOf(delRow) === 'kumo') {
        await kapi('attribute_delete', { id: delRow.id });
      } else {
        const res = await api.post(ATTR_API, new URLSearchParams({ action: 'delete', id: delRow.id }), FORM);
        if (!res.data.success) throw new Error(res.data.message || 'Failed');
      }
      toast.success('Deleted', { id: t });
      setDelRow(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || 'Failed', { id: t });
    } finally { setDelBusy(false); }
  };

  const onSearchKey = e => {
    if (e.key === 'Enter') { setAppliedSearch(search); setPage(1); }
    else if (e.key === 'Escape') { setSearchOpen(false); if (appliedSearch) { setSearch(''); setAppliedSearch(''); setPage(1); } }
  };
  const toggleSearch = () => {
    setSearchOpen(o => {
      const next = !o;
      if (next) setTimeout(() => searchInputRef.current?.focus(), 50);
      else if (appliedSearch) { setSearch(''); setAppliedSearch(''); setPage(1); }
      return next;
    });
  };

  const sourceCell = (r) => {
    if (r.category === 'system') {
      return <span title={r.mapped_join_col ? `joined via ${r.mapped_join_col}` : undefined}>{r.mapped_db}.{r.mapped_table}.{r.mapped_column}</span>;
    }
    if (r.category === 'linked') {
      return <span style={{ fontSize: 11.5 }}>{r.chain_summary || chainSummary(r.resolver_json) || '— multi-step lookup —'}</span>;
    }
    return r.default_value
      ? <span style={{ color: '#94a3b8' }}>always “{r.default_value}”</span>
      : <span style={{ color: '#cbd5e1' }}>— custom per-contact value —</span>;
  };

  return (
    <>
      <KumoStyles />
      <style>{`
        @keyframes kma_spin { to { transform: rotate(360deg); } }
        .kma-attr *{ box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .kma-attr-row .kma-attr-dots { opacity: 1; background: none; border: none; cursor: pointer; padding: 4px; color: #1e293b; transition: color .15s; }
        .kma-attr-row .kma-attr-dots:hover { color: #1e3a8a; }
        .kma-attr-dots.menu-open { color: #1e3a8a; }
        .kma-attr-row:hover td { background: #f5f3ff; }
      `}</style>

      <div className="km km-page kma-attr" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
              Attributes <span style={{ fontWeight: 600, color: '#64748b' }}>({total.toLocaleString()})</span>
            </h2>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
              Personalization fields usable as [NAME] tokens in any campaign template — map one to a real database column, or let CSV imports create them automatically.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button title="Refresh" onClick={load}
                style={{ width: 36, height: 36, border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, cursor: 'pointer', color: '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
              </button>
              {searchOpen ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #1e3a8a', borderRadius: 8, background: '#fff', padding: '0 8px 0 10px', height: 36 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input ref={searchInputRef} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={onSearchKey}
                    placeholder="Search attributes and press Enter…"
                    style={{ border: 'none', outline: 'none', fontSize: 12.5, fontFamily: 'inherit', width: 240, background: 'transparent' }} />
                  <button onClick={toggleSearch} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, lineHeight: 1, padding: 2 }}>×</button>
                </div>
              ) : (
                <button title="Search" onClick={toggleSearch}
                  style={{ width: 36, height: 36, border: `1.5px solid ${appliedSearch ? '#1e3a8a' : '#e2e8f0'}`, background: appliedSearch ? '#eff6ff' : '#fff', borderRadius: 8, cursor: 'pointer', color: appliedSearch ? '#1e3a8a' : '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                </button>
              )}
              <button onClick={() => nav('/kumo/attributes/logs')}
                style={{ padding: '9px 16px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#1e3a8a', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Logs
              </button>
              <button onClick={() => setModalMode('create')}
                style={{ padding: '10px 20px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: '.4px', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                + Create New
              </button>
            </div>
          </div>
        </div>

        {/* Category + origin filters — the origin one separates what this module owns from the
            shared attributes every module can see. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 12, flexShrink: 0, flexWrap: 'wrap' }}>
          <FilterGroup title="Category" options={CATEGORY_FILTERS} value={category} counts={tally} onChange={v => setFilter('category', v)} />
          <FilterGroup title="Origin" options={ORIGIN_FILTERS} value={origin} counts={{ all: tally.all, kumo: tally.kumo, netcore: tally.netcore }} onChange={v => setFilter('origin', v)} />
        </div>

        <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.05)', overflow: 'hidden', position: 'relative' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.85)', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spinner />
            </div>
          )}
          <div style={{ height: '100%', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2 }}>
                <tr>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Attribute info</th>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Category</th>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Data type</th>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Mapped source</th>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Created on</th>
                  <th style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading
                  ? <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                      {appliedSearch ? `No attributes matching "${appliedSearch}".`
                        : (category !== 'all' || origin !== 'all') ? 'No attributes match these filters.'
                        : 'No attributes yet. Click "Create New" to add one.'}
                    </td></tr>
                  : rows.map(r => {
                      const isKumo = originOf(r) === 'kumo';
                      const rowKey = `${originOf(r)}-${r.id}`; // ids repeat across the two stores
                      return (
                      <tr key={rowKey} className="kma-attr-row">
                        <td style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ color: '#0f172a', fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>[{r.name}]</span>
                            <Pill tone={isKumo ? 'indigo' : 'slate'}>{isKumo ? 'Kumo' : 'Netcore'}</Pill>
                          </div>
                          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>ID - {r.id}</div>
                        </td>
                        <td style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{
                            fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                            ...(CATEGORY_STYLE[r.category] || CATEGORY_STYLE.custom),
                          }}>{String(r.category || 'custom').toUpperCase()}</span>
                        </td>
                        <td style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>
                          {r.data_type}
                          {r.data_type === 'date' && r.date_format && (
                            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>formatted</div>
                          )}
                        </td>
                        <td style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', color: '#475569', fontSize: 12 }}>
                          {sourceCell(r)}
                        </td>
                        <td style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{fmtDt(r.created_at)}</td>
                        <td style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                          <div style={{ position: 'relative' }}>
                            <button className={`kma-attr-dots${menuFor === rowKey ? ' menu-open' : ''}`}
                              onClick={e => { e.stopPropagation(); setMenuFor(menuFor === rowKey ? null : rowKey); }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5"  r="2.2" />
                                <circle cx="12" cy="12" r="2.2" />
                                <circle cx="12" cy="19" r="2.2" />
                              </svg>
                            </button>
                            {menuFor === rowKey && (
                              <div ref={menuRef}
                                style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: '#fff', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', border: '1px solid #e2e8f0', zIndex: 50, width: 170, padding: 6 }}>
                                <button onClick={() => { setMenuFor(null); setModalMode({ editRow: r }); }}
                                  style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#334155', textAlign: 'left', borderRadius: 6 }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <span>Edit</span><span style={{ color: '#94a3b8', fontSize: 14 }}>✎</span>
                                </button>
                                <button onClick={() => { setMenuFor(null); setDelRow(r); }}
                                  style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#dc2626', textAlign: 'left', borderRadius: 6 }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <span>Delete</span><span style={{ color: '#94a3b8', fontSize: 14 }}>🗑</span>
                                </button>
                                <div style={{ padding: '6px 12px 4px', fontSize: 10.5, color: '#94a3b8', lineHeight: 1.5 }}>
                                  {isKumo ? 'Stored in Kumo — changes affect Kumo campaigns only.'
                                    : 'Shared attribute — changes apply everywhere, Netcore included.'}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 13, color: '#475569', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Per page:</span>
            <select value={perPage}
              onChange={e => { setPerPage(parseInt(e.target.value, 10)); setPage(1); }}
              style={{ padding: '6px 10px', border: '1.5px solid #c4b5fd', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none', background: '#fff', cursor: 'pointer' }}>
              {PER_PAGE_OPTS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Page {safePage} of {pages || 1}</span>
            <button disabled={safePage <= 1 || loading} onClick={() => { setPage(safePage - 1); setMenuFor(null); }}
              style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: safePage <= 1 ? 'not-allowed' : 'pointer', opacity: safePage <= 1 ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Prev</button>
            <button disabled={safePage >= pages || loading} onClick={() => { setPage(safePage + 1); setMenuFor(null); }}
              style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: safePage >= pages ? 'not-allowed' : 'pointer', opacity: safePage >= pages ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Next</button>
          </div>
        </div>
      </div>

      {modalMode && (
        <KumoCreateAttributeModal
          editRow={modalMode === 'create' ? null : modalMode.editRow}
          onClose={() => setModalMode(null)}
          onSaved={() => { setModalMode(null); load(); }}
        />
      )}

      <TopConfirm
        open={!!delRow}
        title="Delete attribute"
        message={`Delete [${delRow?.name || ''}]? Any campaign template still using its token will show a blank value instead.`}
        detail={delRow && originOf(delRow) === 'kumo'
          ? 'This attribute is stored in Kumo, so only Kumo campaigns are affected.'
          : 'This is a shared attribute — deleting it removes it from Netcore and every other module too.'}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        busy={delBusy}
        onConfirm={doDelete}
        onCancel={() => setDelRow(null)}
      />
    </>
  );
}
