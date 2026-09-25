/*
 * Kumo — Email templates.
 *
 * A one-for-one clone of the Netcore templates gallery (src/pages/netcore/TemplatesList.jsx):
 * same header, same search + "Create New Template" toolbar, the same real scaled-down
 * iframe thumbnails, the same Archive / Edit / Use row actions and the same footer pager.
 * Only the data layer differs — everything goes through kapi() against api/kumo/kumo.php.
 *
 * Two Kumo-specific wrinkles:
 *   • `templates_list` returns every template in one shot (no server paging), so the pager
 *     runs client-side over the full set, 12 cards to a page — the same page size Netcore asks
 *     the server for.
 *   • that list payload carries only a text `snippet`, not `body_html`, so the HTML behind each
 *     visible card is pulled lazily with `template_get` (cached per id, four at a time) to keep
 *     the thumbnails a true render of the template rather than a text blurb.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { kapi } from './kumoShared';

const PER_PAGE = 12;

function Spinner({ size = 32 }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', border: '3px solid #c4b5fd', borderTopColor: '#4f46e5', animation: 'kmt_spin 0.85s linear infinite' }} />;
}

function fmtDt(s) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d.getTime())) return s;
  const pad = n => String(n).padStart(2, '0');
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()}`;
}

/* Real scaled-down render of the template's actual HTML — the "200% then scale(0.5)"
   trick makes the iframe visually fill the container at any width without JS measuring it.
   sandbox="" disables scripts/forms in case a template's HTML has any — it's a pure preview. */
function TemplateThumbnail({ html, snippet, loading, height = 260 }) {
  if (!html) {
    return (
      <div style={{ height, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22, textAlign: 'center', color: '#94a3b8', fontSize: 11, lineHeight: 1.6, borderBottom: '1px solid #f1f5f9' }}>
        {loading ? <Spinner size={22} /> : (snippet ? String(snippet).slice(0, 220) : 'No preview available')}
      </div>
    );
  }
  return (
    <div style={{ height, background: '#fff', overflow: 'hidden', position: 'relative', borderBottom: '1px solid #f1f5f9' }}>
      <iframe title="template preview" srcDoc={html} sandbox="" scrolling="no"
        style={{ width: '200%', height: '200%', border: 'none', overflow: 'hidden', transform: 'scale(0.5)', transformOrigin: 'top left', pointerEvents: 'none' }} />
    </div>
  );
}

export default function KumoTemplates() {
  const nav = useNavigate();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [cat, setCat] = useState('');
  const [page, setPage] = useState(1);

  const [htmlById, setHtmlById] = useState({});
  const inflight = useRef(new Set());

  const [menuFor, setMenuFor] = useState(null);
  const menuRef = useRef(null);
  const [dupId, setDupId] = useState(0);
  const [preview, setPreview] = useState(null);   // { name, html }
  const [device, setDevice] = useState('desktop');
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);

  const load = async (s = appliedSearch) => {
    setLoading(true); setMenuFor(null);
    try {
      const d = await kapi('templates_list', { search: s });
      setAll(d.templates || []);
    } catch (e) {
      toast.error(e.message || 'Could not load templates');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(''); }, []); // eslint-disable-line

  useEffect(() => {
    if (!menuFor) return undefined;
    const onDown = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuFor(null); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuFor]);

  const categories = useMemo(() => {
    const seen = new Map();
    all.forEach(t => {
      const c = String(t.category || '').trim();
      if (!c) return;
      seen.set(c, (seen.get(c) || 0) + 1);
    });
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [all]);

  /* The endpoint hands back every template, so category filtering and paging happen here. */
  const filtered = useMemo(() => (cat ? all.filter(t => String(t.category || '') === cat) : all), [all, cat]);
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const rowsKey = rows.map(r => r.id).join(',');

  /* Pull the real HTML for whatever is on screen, four requests at a time, once per id. */
  useEffect(() => {
    let cancelled = false;
    const todo = rows.filter(r => htmlById[r.id] === undefined && !inflight.current.has(r.id));
    if (!todo.length) return undefined;
    (async () => {
      for (let i = 0; i < todo.length; i += 4) {
        const batch = todo.slice(i, i + 4);
        batch.forEach(t => inflight.current.add(t.id));
        // eslint-disable-next-line no-await-in-loop
        const got = await Promise.all(batch.map(async t => {
          try {
            const d = await kapi('template_get', { id: t.id });
            return [t.id, d?.template?.body_html || ''];
          } catch {
            return [t.id, ''];
          } finally { inflight.current.delete(t.id); }
        }));
        if (cancelled) return;
        setHtmlById(m => { const n = { ...m }; got.forEach(([id, h]) => { n[id] = h; }); return n; });
      }
    })();
    return () => { cancelled = true; };
  }, [rowsKey]); // eslint-disable-line

  const applySearch = (s) => { setAppliedSearch(s); setPage(1); setHtmlById({}); load(s); };

  const openPreview = async (t) => {
    setMenuFor(null);
    let html = htmlById[t.id];
    if (html === undefined) {
      try {
        const d = await kapi('template_get', { id: t.id });
        html = d?.template?.body_html || '';
        setHtmlById(m => ({ ...m, [t.id]: html }));
      } catch (e) { toast.error(e.message || 'Could not load that template'); return; }
    }
    setDevice('desktop');
    setPreview({ name: t.name, html });
  };

  const duplicate = async (t) => {
    setMenuFor(null); setDupId(t.id);
    const id = toast.loading('Duplicating…');
    try {
      const d = await kapi('template_get', { id: t.id });
      const s = d?.template || {};
      await kapi('template_save', {
        name: `${s.name || t.name || 'Untitled'} (copy)`,
        category: s.category || t.category || '',
        subject: s.subject || t.subject || '',
        preheader: s.preheader || '',
        body_html: s.body_html || '',
        body_text: s.body_text || '',
      });
      toast.success('Template duplicated', { id });
      load();
    } catch (e) { toast.error(e.message || 'Could not duplicate', { id }); }
    finally { setDupId(0); }
  };

  const doArchive = async () => {
    if (!archiveTarget) return;
    const target = archiveTarget;
    setArchiving(true);
    const id = toast.loading('Archiving…');
    try {
      await kapi('template_delete', { id: target.id });
      toast.success('Archived', { id });
      setArchiveTarget(null);
      setHtmlById(m => { const n = { ...m }; delete n[target.id]; return n; });
      load();
    } catch (e) { toast.error(e.message || 'Failed', { id }); }
    finally { setArchiving(false); }
  };

  return (
    <>
      <style>{`
        @keyframes kmt_spin { to { transform: rotate(360deg); } }
        @keyframes kmt_fade_in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes kmt_pop_in { from { opacity: 0; transform: scale(.94) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .kmt-tpl *{ box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .kmt-tpl-card { transition: box-shadow .15s, border-color .15s; position: relative; }
        .kmt-tpl-card:hover { border-color:#1e3a8a; box-shadow:0 6px 18px rgba(30,58,138,.10); }
        .kmt-tpl-dots { opacity: 0; background: rgba(255,255,255,.94); border: 1px solid #e2e8f0; border-radius: 8px;
          cursor: pointer; padding: 3px 4px; color: #334155; transition: opacity .15s, color .15s; line-height: 0; }
        .kmt-tpl-card:hover .kmt-tpl-dots, .kmt-tpl-dots.menu-open { opacity: 1; }
        .kmt-tpl-dots:hover { color: #1e3a8a; }
        .kmt-tpl-chip { border:1.5px solid #e2e8f0; background:#fff; color:#475569; cursor:pointer; border-radius:999px;
          padding:6px 13px; font-size:11.5px; font-weight:700; font-family:inherit; white-space:nowrap; transition:all .15s; }
        .kmt-tpl-chip:hover { border-color:#c4b5fd; color:#1e3a8a; }
        .kmt-tpl-chip.on { border-color:#1e3a8a; background:#eff6ff; color:#1e3a8a; }
        .kmt-tpl-act { flex:1; padding:8px 0; border:1.5px solid #e2e8f0; background:#fff; border-radius:6px;
          font-size:11px; font-weight:700; font-family:inherit; cursor:pointer; transition:background .15s, border-color .15s; }
        .kmt-tpl-act:hover { background:#f8fafc; border-color:#c4b5fd; }
        .kmt-tpl-act:disabled { opacity:.5; cursor:not-allowed; }
        .kmt-tpl-act--primary { border:none; background:#1e3a8a; color:#fff; }
        .kmt-tpl-act--primary:hover { background:#1e40af; border:none; }
      `}</style>

      <div className="kmt-tpl" style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
              Email templates <span style={{ fontWeight: 600, color: '#64748b', fontSize: 15 }}>({total})</span>
            </h2>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>Reusable HTML templates for your Kumo email campaigns</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button title="Refresh" onClick={() => { setHtmlById({}); load(); }}
              style={{ width: 38, height: 38, border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, cursor: 'pointer', color: '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
            </button>
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applySearch(search); if (e.key === 'Escape') { setSearch(''); applySearch(''); } }}
              placeholder="Search templates…"
              style={{ padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', width: 220 }} />
            <button onClick={() => nav('/kumo/templates/new')}
              style={{ padding: '11px 20px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: '.4px', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              + Create New Template
            </button>
          </div>
        </div>

        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexShrink: 0, overflowX: 'auto', paddingBottom: 2 }}>
            <button className={`kmt-tpl-chip${cat === '' ? ' on' : ''}`} onClick={() => { setCat(''); setPage(1); }}>All ({all.length})</button>
            {categories.map(([c, n]) => (
              <button key={c} className={`kmt-tpl-chip${cat === c ? ' on' : ''}`} onClick={() => { setCat(c); setPage(1); }}>{c} ({n})</button>
            ))}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' }}>
          {loading && rows.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><Spinner /></div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 13 }}>
              {appliedSearch || cat ? 'No templates match that filter.' : 'No templates yet. Click "Create New Template" to start.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
              {rows.map(t => (
                <div key={t.id} className="kmt-tpl-card" style={{ border: '1.5px solid #e2e8f0', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
                  <TemplateThumbnail html={htmlById[t.id]} snippet={t.snippet} loading={htmlById[t.id] === undefined} />

                  <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 3 }}>
                    <button className={`kmt-tpl-dots${menuFor === t.id ? ' menu-open' : ''}`}
                      onClick={e => { e.stopPropagation(); setMenuFor(menuFor === t.id ? null : t.id); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2.2" /><circle cx="12" cy="12" r="2.2" /><circle cx="12" cy="19" r="2.2" />
                      </svg>
                    </button>
                    {menuFor === t.id && (
                      <div ref={menuRef}
                        style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: '#fff', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', border: '1px solid #e2e8f0', zIndex: 50, width: 190, padding: 6 }}>
                        {[
                          { label: 'Preview', icon: '👁', action: () => openPreview(t) },
                          { label: 'Edit', icon: '✎', action: () => { setMenuFor(null); nav(`/kumo/templates/${t.id}`); } },
                          { label: 'Duplicate', icon: '⧉', action: () => duplicate(t) },
                          { label: 'Use in campaign', icon: '➤', action: () => { setMenuFor(null); nav(`/kumo/campaigns/new?template_id=${t.id}`); } },
                          { label: 'Archive', icon: '🗑', action: () => { setMenuFor(null); setArchiveTarget(t); }, danger: true },
                        ].map(opt => (
                          <button key={opt.label} onClick={opt.action}
                            style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: opt.danger ? '#dc2626' : '#334155', textAlign: 'left', borderRadius: 6 }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                            <span>{opt.label}</span>
                            <span style={{ color: '#94a3b8', fontSize: 14 }}>{opt.icon}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                      {t.category && <span style={{ fontSize: 9.5, fontWeight: 800, color: '#1e3a8a', background: '#eef2ff', padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>{String(t.category).toUpperCase()}</span>}
                      {t.status && t.status !== 'active' && <span style={{ fontSize: 9.5, fontWeight: 800, color: '#b45309', background: '#fef3c7', padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>{String(t.status).toUpperCase()}</span>}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#94a3b8', marginBottom: 4 }}>ID: {t.id} · {fmtDt(t.updated_at || t.created_at)}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12, height: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject || '—'}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="kmt-tpl-act" style={{ color: '#64748b' }} disabled={dupId === t.id} onClick={() => setArchiveTarget(t)}>Archive</button>
                      <button className="kmt-tpl-act" style={{ color: '#1e3a8a' }} onClick={() => nav(`/kumo/templates/${t.id}`)}>Edit</button>
                      <button className="kmt-tpl-act kmt-tpl-act--primary" onClick={() => nav(`/kumo/campaigns/new?template_id=${t.id}`)}>Use</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14, flexShrink: 0 }}>
            <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}
              style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: safePage <= 1 ? 'not-allowed' : 'pointer', opacity: safePage <= 1 ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Prev</button>
            <span style={{ fontSize: 12.5, color: '#475569', alignSelf: 'center' }}>Page {safePage} of {pages}</span>
            <button disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}
              style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: safePage >= pages ? 'not-allowed' : 'pointer', opacity: safePage >= pages ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Next</button>
          </div>
        )}
      </div>

      {preview && (
        <div onClick={() => setPreview(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 960, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'kmt_fade_in .15s ease' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, width: 'min(960px, 92vw)', height: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Plus Jakarta Sans',sans-serif", animation: 'kmt_pop_in .18s cubic-bezier(.16,1,.3,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{preview.name}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {['desktop', 'mobile'].map(d => (
                  <button key={d} onClick={() => setDevice(d)}
                    style={{ padding: '7px 14px', border: `1.5px solid ${device === d ? '#1e3a8a' : '#e2e8f0'}`, background: device === d ? '#eff6ff' : '#fff', color: device === d ? '#1e3a8a' : '#475569', borderRadius: 6, fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', textTransform: 'capitalize' }}>{d}</button>
                ))}
                <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 22, lineHeight: 1, padding: '0 4px' }}>×</button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, background: '#f1f5f9', display: 'flex', justifyContent: 'center', padding: 16 }}>
              <iframe title="preview" srcDoc={preview.html || '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">This template has no HTML body.</p>'} sandbox=""
                style={{ width: device === 'mobile' ? 390 : '100%', height: '100%', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }} />
            </div>
          </div>
        </div>
      )}

      {archiveTarget && (
        <div onClick={() => !archiving && setArchiveTarget(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'kmt_fade_in .15s ease' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, padding: '26px 26px 22px', width: 380, maxWidth: '90vw', boxShadow: '0 24px 60px rgba(15,23,42,.28)', animation: 'kmt_pop_in .18s cubic-bezier(.16,1,.3,1)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Archive this template?</div>
            <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.55, marginBottom: 22 }}>
              &ldquo;{archiveTarget.name}&rdquo; will be removed from the gallery. Campaigns already built from it keep the copy of the HTML they were sent with.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button disabled={archiving} onClick={() => setArchiveTarget(null)}
                style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#334155', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: archiving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button disabled={archiving} onClick={doArchive}
                style={{ padding: '9px 18px', border: 'none', background: '#dc2626', color: '#fff', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: archiving ? 'not-allowed' : 'pointer', opacity: archiving ? .75 : 1, fontFamily: 'inherit' }}>
                {archiving ? 'Please wait…' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
