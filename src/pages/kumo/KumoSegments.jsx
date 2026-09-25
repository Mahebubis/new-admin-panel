/*
 * KumoMTA — Segments list.
 *
 * A clone of the Netcore segments screen (NetcoreSegments): the same table,
 * the same sortable "Created on" / "Refreshed on" headers, the same 3-dot row
 * menu, the same auto-refresh of recently used segments with the little
 * animated dot loader, and the same per-page footer.
 *
 * Data layer only: everything goes through kapi() against api/kumo/kumo.php.
 * segments_list returns every segment in one shot, so the search, the sort and
 * the paging are done here on the client.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { kapi, KumoStyles, Confirm } from './kumoShared';

const PER_PAGE_OPTS = [10, 25, 50, 100];
const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

const SOURCE_LABEL = { rules: 'Rules', kumo_list: 'Lists', engagement: 'Engagement', netcore: 'Netcore' };
const SOURCE_COLOR = {
  rules:      { bg: '#dbeafe', fg: '#1e3a8a' },
  kumo_list:  { bg: '#e0e7ff', fg: '#4338ca' },
  engagement: { bg: '#cffafe', fg: '#0e7490' },
  netcore:    { bg: '#f1f5f9', fg: '#475569' },
};

function fmtDt(s) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d.getTime())) return s;
  const pad = n => String(n).padStart(2, '0');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()} ${pad(d.getHours() % 12 || 12)}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/* server-style timestamp for a count we just took */
function nowStamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/* horizontal animated 3-dot loader for cells whose count is still being refreshed */
function DotLoad() {
  return (
    <span className="km-dot-load">
      <span /><span /><span />
    </span>
  );
}

function Spinner({ size = 32 }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', border: '3px solid #c4b5fd', borderTopColor: '#4f46e5', animation: 'km_seg_spin 0.85s linear infinite' }} />;
}

export default function KumoSegments() {
  const nav = useNavigate();
  const [all, setAll]         = useState([]);
  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [refreshingIds, setRefreshingIds] = useState(new Set());
  const [delSeg, setDelSeg]   = useState(null);
  const [delBusy, setDelBusy] = useState(false);

  const [search, setSearch]               = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [searchOpen, setSearchOpen]       = useState(false);
  const searchInputRef = useRef(null);

  const [menuFor, setMenuFor] = useState(null);
  const menuRef = useRef(null);

  /* sort state — '' | 'created_at' | 'refreshed' */
  const [sortBy, setSortBy]   = useState('');
  const [sortOrder, setOrder] = useState('desc');

  const fetchPage = async ({ autoRefreshAfter = true } = {}) => {
    setLoading(true); setMenuFor(null);
    try {
      const d = await kapi('segments_list');
      const segs = (d.segments || []).map(s => ({ ...s, cached_count: Number(s.cached_count || 0) }));
      setAll(segs);
      if (autoRefreshAfter) autoRefresh(segs);
    } catch (err) {
      toast.error(err?.message || 'Failed to load segments');
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchPage(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* click a sortable header → toggle order, or switch column */
  const toggleSort = col => {
    let newOrder = 'desc';
    if (sortBy === col) newOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(col); setOrder(newOrder); setPage(1);
  };
  const SortIcon = ({ col }) => (
    <span style={{ display: 'inline-flex', flexDirection: 'column', marginLeft: 6, lineHeight: 1, color: '#94a3b8' }}>
      <svg width="8" height="6" viewBox="0 0 8 6" fill={sortBy === col && sortOrder === 'asc' ? '#1e3a8a' : 'currentColor'}><path d="M4 0 L8 6 L0 6 Z" /></svg>
      <svg width="8" height="6" viewBox="0 0 8 6" fill={sortBy === col && sortOrder === 'desc' ? '#1e3a8a' : 'currentColor'} style={{ marginTop: 2 }}><path d="M0 0 L8 0 L4 6 Z" /></svg>
    </span>
  );

  /* auto-refresh stale-but-recent segments one by one */
  const autoRefresh = async (segs) => {
    const now = Date.now();
    const ts = v => (v ? new Date(String(v).replace(' ', 'T')).getTime() || 0 : 0);
    const eligible = segs.filter(s => (now - ts(s.created_at) < FIFTEEN_DAYS_MS) || (now - ts(s.counted_at) < FIFTEEN_DAYS_MS));
    if (eligible.length === 0) return;
    setRefreshingIds(new Set(eligible.map(s => s.id)));
    for (const seg of eligible) {
      try {
        const d = await kapi('segment_count', { id: seg.id });
        setAll(prev => prev.map(r => r.id === seg.id
          ? { ...r, cached_count: Number(d.count || 0), counted_at: nowStamp() }
          : r));
      } catch { /* keep going */ }
      setRefreshingIds(prev => { const next = new Set(prev); next.delete(seg.id); return next; });
    }
  };

  /* close menu on outside click */
  useEffect(() => {
    if (!menuFor) return;
    const onDown = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuFor(null); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuFor]);

  /* row actions */
  const doRefresh = async (id) => {
    setMenuFor(null);
    setRefreshingIds(prev => new Set(prev).add(id));
    const t = toast.loading('Recounting…');
    try {
      const d = await kapi('segment_count', { id });
      setAll(prev => prev.map(r => r.id === id ? { ...r, cached_count: Number(d.count || 0), counted_at: nowStamp() } : r));
      toast.success(`${Number(d.count || 0).toLocaleString()} contacts`, { id: t });
    } catch (err) { toast.error(err?.message || 'Recount failed', { id: t }); }
    setRefreshingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const doDelete = async () => {
    const id = delSeg?.id;
    setDelBusy(true);
    try {
      await kapi('segment_delete', { id });
      toast.success('Deleted');
      setDelSeg(null);
      setAll(prev => prev.filter(r => r.id !== id));
    } catch (err) { toast.error(err?.message || 'Delete failed'); }
    finally { setDelBusy(false); }
  };

  const openEdit = (r) => {
    setMenuFor(null);
    if ((r.source || 'rules') === 'rules') nav(`/kumo/segments/${r.id}/edit`);
    else { toast('This segment was built on the Audience page — editing it there.'); nav('/kumo/audience?tab=segments'); }
  };

  /* search handlers */
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

  /* filter → sort → page, all on the client */
  const filtered = useMemo(() => {
    const q = appliedSearch.trim().toLowerCase();
    if (!q) return all;
    return all.filter(r => `${r.name || ''} ${r.description || ''} ${r.id}`.toLowerCase().includes(q));
  }, [all, appliedSearch]);

  const sorted = useMemo(() => {
    if (!sortBy) return filtered;
    const key = sortBy === 'refreshed' ? 'counted_at' : 'created_at';
    const ts = v => (v ? new Date(String(v).replace(' ', 'T')).getTime() || 0 : 0);
    return [...filtered].sort((a, b) => (sortOrder === 'asc' ? 1 : -1) * (ts(a[key]) - ts(b[key])));
  }, [filtered, sortBy, sortOrder]);

  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const curPage = Math.min(page, pages);
  const rows = sorted.slice((curPage - 1) * perPage, curPage * perPage);

  return (
    <>
      <KumoStyles />
      <style>{`
        @keyframes km_seg_spin { to { transform: rotate(360deg); } }
        @keyframes km_dot_pulse { 0%, 80%, 100% { opacity: 0.2; transform: scale(.8); } 40% { opacity: 1; transform: scale(1); } }
        .km-seg *{ box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }

        .km-dot-load { display: inline-flex; gap: 4px; align-items: center; }
        .km-dot-load span { width: 6px; height: 6px; border-radius: 50%; background: #1e3a8a; animation: km_dot_pulse 1.2s infinite ease-in-out; }
        .km-dot-load span:nth-child(2) { animation-delay: .15s; }
        .km-dot-load span:nth-child(3) { animation-delay: .30s; }

        .km-seg-row .km-seg-dots { opacity: 1; background: none; border: none; cursor: pointer; padding: 4px; color: #1e293b; transition: color .15s; }
        .km-seg-row .km-seg-dots:hover { color: #1e3a8a; }
        .km-seg-dots.menu-open { color: #1e3a8a; }
        .km-seg-row:hover td { background: #f5f3ff; }
        .km-seg-sortable { cursor: pointer; user-select: none; transition: color .15s; }
        .km-seg-sortable:hover { color: #1e3a8a !important; }
      `}</style>

      <div className="km-seg" style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
              Segments <span style={{ fontWeight: 600, color: '#64748b' }}>({total.toLocaleString()})</span>
            </h2>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
              Define audience segments based on behavior, attributes, and activity for precise targeting
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button title="Refresh" onClick={() => fetchPage()}
                style={{ width: 36, height: 36, border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, cursor: 'pointer', color: '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
              </button>
              {searchOpen ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #1e3a8a', borderRadius: 8, background: '#fff', padding: '0 8px 0 10px', height: 36 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input ref={searchInputRef} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={onSearchKey}
                    placeholder="Search segments and press Enter…"
                    style={{ border: 'none', outline: 'none', fontSize: 12.5, fontFamily: 'inherit', width: 240, background: 'transparent' }} />
                  <button onClick={toggleSearch} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, lineHeight: 1, padding: 2 }}>×</button>
                </div>
              ) : (
                <button title="Search" onClick={toggleSearch}
                  style={{ width: 36, height: 36, border: `1.5px solid ${appliedSearch ? '#1e3a8a' : '#e2e8f0'}`, background: appliedSearch ? '#eff6ff' : '#fff', borderRadius: 8, cursor: 'pointer', color: appliedSearch ? '#1e3a8a' : '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                </button>
              )}
              <button onClick={() => nav('/kumo/segments/new')}
                style={{ padding: '10px 20px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: '.4px', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                + Create Segment
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
              *Segments used/created within the last 15 days are auto-refreshed at page reload.
            </div>
          </div>
        </div>

        {/* table card */}
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
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Segment info</th>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Source</th>
                  <th onClick={() => toggleSort('created_at')} className="km-seg-sortable"
                      style={{ padding: '14px 18px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: sortBy === 'created_at' ? '#1e3a8a' : '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                    Created on <SortIcon col="created_at" />
                  </th>
                  <th onClick={() => toggleSort('refreshed')} className="km-seg-sortable"
                      style={{ padding: '14px 18px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: sortBy === 'refreshed' ? '#1e3a8a' : '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                    Refreshed on <SortIcon col="refreshed" />
                  </th>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Contacts</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading
                  ? <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>{appliedSearch ? `No segments matching "${appliedSearch}".` : 'No segments yet. Click "Create Segment" to start.'}</td></tr>
                  : rows.map(r => {
                    const isRefreshing = refreshingIds.has(r.id);
                    const src = r.source || 'rules';
                    const tone = SOURCE_COLOR[src] || SOURCE_COLOR.netcore;
                    return (
                      <tr key={r.id} className="km-seg-row">
                        <td style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ width: 30, height: 30, borderRadius: 8, background: '#dbeafe', color: '#1e3a8a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" />
                              </svg>
                            </span>
                            <div style={{ minWidth: 0 }}>
                              {/* plain text — not clickable; use the row's 3-dot menu → Edit instead */}
                              <span style={{ color: '#0f172a', fontWeight: 600, fontSize: 13 }}>{r.name}</span>
                              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2, maxWidth: 420, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                title={r.description || ''}>
                                ID - {r.id}{r.description ? ` · ${r.description}` : ''}{r.updated_by ? ` · by ${r.updated_by}` : ''}
                              </div>
                            </div>

                            <div style={{ position: 'relative', marginLeft: 'auto' }}>
                              <button className={`km-seg-dots${menuFor === r.id ? ' menu-open' : ''}`}
                                onClick={e => { e.stopPropagation(); setMenuFor(menuFor === r.id ? null : r.id); }}>
                                {/* bolder 3-dot — bigger filled circles */}
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                  <circle cx="12" cy="5"  r="2.2" />
                                  <circle cx="12" cy="12" r="2.2" />
                                  <circle cx="12" cy="19" r="2.2" />
                                </svg>
                              </button>
                              {menuFor === r.id && (
                                <div ref={menuRef}
                                  style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: '#fff', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', border: '1px solid #e2e8f0', zIndex: 50, width: 200, padding: 6 }}>
                                  {[
                                    { label: 'Edit',       icon: '✎', action: () => openEdit(r) },
                                    { label: 'View users', icon: '👥', action: () => { setMenuFor(null); nav(`/kumo/segments/${r.id}/users`); } },
                                    { label: 'Recount',    icon: '↻', action: () => doRefresh(r.id) },
                                    { label: 'Delete',     icon: '🗑', action: () => { setMenuFor(null); setDelSeg(r); }, danger: true },
                                  ].map(opt => (
                                    <button key={opt.label} onClick={opt.action}
                                      style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: opt.danger ? '#dc2626' : '#334155', textAlign: 'left', borderRadius: 6 }}
                                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                      <span>{opt.label}</span>
                                      <span style={{ color: '#94a3b8', fontSize: 14 }}>{opt.icon}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: tone.bg, color: tone.fg }}>
                            {SOURCE_LABEL[src] || src}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{fmtDt(r.created_at)}</td>
                        <td style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>
                          {isRefreshing ? <DotLoad /> : (fmtDt(r.counted_at) || <span style={{ color: '#94a3b8' }}>never</span>)}
                        </td>
                        <td style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                          {isRefreshing ? <DotLoad /> :
                            <Link to={`/kumo/segments/${r.id}/users`} style={{ color: '#1e3a8a', fontWeight: 600, textDecoration: 'none' }}>
                              {Number(r.cached_count || 0).toLocaleString()}
                            </Link>}
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* pagination */}
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
            <span>Page {curPage} of {pages || 1}</span>
            <button disabled={curPage <= 1 || loading} onClick={() => setPage(curPage - 1)}
              style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: curPage <= 1 ? 'not-allowed' : 'pointer', opacity: curPage <= 1 ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Prev</button>
            <button disabled={curPage >= pages || loading} onClick={() => setPage(curPage + 1)}
              style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: curPage >= pages ? 'not-allowed' : 'pointer', opacity: curPage >= pages ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Next</button>
          </div>
        </div>
      </div>

      <Confirm open={!!delSeg} title="Delete segment"
        message={`Delete "${delSeg?.name || ''}"? Campaigns that still point at this segment will lose their audience.`}
        confirmLabel="Delete" busy={delBusy} onConfirm={doDelete} onCancel={() => setDelSeg(null)} />
    </>
  );
}
