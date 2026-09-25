/*
 * Kumo — contacts inside one list.
 *
 * Clone of src/pages/netcore/NetcoreListContacts.jsx: same back button + title
 * block, same search-and-press-Enter box, same white table card with a sticky
 * head, same empty state and the same per-page / Prev / Next footer.
 *
 * Data comes from kapi('list_contacts', …), which pages server-side. The column
 * set follows what kumo_contacts actually stores (status / engagement / last open
 * / last click) instead of Netcore's state-country-city trio.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { kapi } from './kumoShared';
import KumoAddContactDrawer from './KumoAddContactDrawer';

const PER_PAGE_OPTS = [10, 25, 50, 100];

const COLS = ['Email', 'First name', 'Last name', 'Phone', 'Status', 'Engagement', 'Last open', 'Last click', 'Added on'];

const STATUS_TONE = {
  active:       { bg: '#dcfce7', fg: '#15803d' },
  unsubscribed: { bg: '#e2e8f0', fg: '#475569' },
  bounced:      { bg: '#fee2e2', fg: '#b91c1c' },
  complained:   { bg: '#fef3c7', fg: '#92400e' },
};

function fmtDt(s) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d.getTime())) return s;
  const pad = n => String(n).padStart(2, '0');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()} ${pad(d.getHours() % 12 || 12)}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

function Spinner() {
  return <span style={{ display: 'inline-block', width: 32, height: 32, borderRadius: '50%', border: '3px solid #c4b5fd', borderTopColor: '#4f46e5', animation: 'km_spin 0.85s linear infinite' }} />;
}

function StatusPill({ value }) {
  if (!value) return <span style={{ color: '#cbd5e1' }}>—</span>;
  const tone = STATUS_TONE[String(value).toLowerCase()] || { bg: '#f1f5f9', fg: '#475569' };
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: tone.bg, color: tone.fg, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
      {value}
    </span>
  );
}

export default function KumoListContacts({ basePath = '/kumo/lists', idOverride, titleOverride } = {}) {
  const { id: idParam } = useParams();
  const id = idOverride || idParam;
  const nav = useNavigate();

  const [listName, setListName] = useState('');
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [applied, setApplied] = useState('');
  const searchInputRef = useRef(null);
  const [addOpen, setAddOpen] = useState(false);

  /* Guards against React StrictMode's dev-only double-invoke of effects. Keyed by
     id so navigating from one list to another still refetches. */
  const fetchedNameForId = useRef(null);
  const fetchedRowsForId = useRef(null);

  useEffect(() => {
    if (fetchedNameForId.current === id) return;
    fetchedNameForId.current = id;
    (async () => {
      try {
        const d = await kapi('lists_list');
        const row = (d.lists || []).find(l => String(l.id) === String(id));
        if (row) setListName(row.name);
      } catch { /* non-critical */ }
    })();
  }, [id]);

  const pages = Math.max(1, Math.ceil(total / perPage));

  const fetchPage = async (p = page, pp = perPage, s = applied) => {
    setLoading(true);
    try {
      const d = await kapi('list_contacts', { id, page: p, per_page: pp, search: s });
      setRows(d.contacts || []);
      setTotal(Number(d.total || 0));
      setPage(Number(d.page || p));
      setPerPage(Number(d.per_page || pp));
      setApplied(s);
    } catch (e) {
      toast.error(e.message || 'Could not load contacts');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (fetchedRowsForId.current === id) return;
    fetchedRowsForId.current = id;
    fetchPage(1, perPage, '');
  }, [id]); // eslint-disable-line

  const onSearchKey = e => {
    if (e.key === 'Enter') fetchPage(1, perPage, search);
  };

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`@keyframes km_spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexShrink: 0 }}>
        <button onClick={() => nav(basePath)} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#0f172a' }}>{titleOverride || listName || 'List'} <span style={{ fontWeight: 600, color: '#64748b' }}>({total.toLocaleString()})</span></div>
          <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Contacts in this list</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <input ref={searchInputRef} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={onSearchKey}
            placeholder="Search email and press Enter…"
            style={{ padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', width: 260 }} />
          <button onClick={() => fetchPage(1, perPage, applied)} title="Refresh"
            style={{ width: 36, height: 36, border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 8, cursor: 'pointer', color: '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
          </button>
          <button onClick={() => setAddOpen(true)}
            style={{ padding: '9px 16px', border: '1.5px solid #1e3a8a', background: '#fff', color: '#1e3a8a', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + Add contact
          </button>
          <button onClick={() => nav(`${basePath}/${id}/import`)} style={{ padding: '9px 16px', border: 'none', background: '#1e3a8a', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Import contacts
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.05)', overflow: 'hidden', position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.85)', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spinner />
          </div>
        )}
        <div style={{ height: '100%', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2 }}>
              <tr>
                {COLS.map(c => <th key={c} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading
                ? <tr><td colSpan={COLS.length} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>{applied ? `No contacts matching "${applied}".` : 'No contacts in this list yet — import a CSV to add some.'}</td></tr>
                : rows.map(r => (
                    <tr key={r.id}>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#1e3a8a', fontWeight: 600 }}>{r.email}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>{r.first_name || '—'}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>{r.last_name || '—'}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>{r.phone || '—'}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9' }}><StatusPill value={r.status} /></td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#334155', textTransform: 'capitalize' }}>{r.engagement || '—'}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmtDt(r.last_open_at) || '—'}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmtDt(r.last_click_at) || '—'}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmtDt(r.created_at) || '—'}</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 13, color: '#475569', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Per page:</span>
          <select value={perPage} onChange={e => fetchPage(1, parseInt(e.target.value, 10), applied)}
            style={{ padding: '6px 10px', border: '1.5px solid #c4b5fd', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none', background: '#fff', cursor: 'pointer' }}>
            {PER_PAGE_OPTS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Page {page} of {pages || 1}</span>
          <button disabled={page <= 1 || loading} onClick={() => fetchPage(page - 1, perPage, applied)}
            style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Prev</button>
          <button disabled={page >= pages || loading} onClick={() => fetchPage(page + 1, perPage, applied)}
            style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: page >= pages ? 'not-allowed' : 'pointer', opacity: page >= pages ? .4 : 1, fontSize: 12, fontFamily: 'inherit' }}>Next</button>
        </div>
      </div>

      {addOpen && (
        <KumoAddContactDrawer
          listId={id}
          listName={titleOverride || listName}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); fetchPage(1, perPage, applied); }}
        />
      )}
    </div>
  );
}
