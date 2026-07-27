import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/campaigns/templates.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

function Spinner() {
  return <span style={{ display: 'inline-block', width: 32, height: 32, borderRadius: '50%', border: '3px solid #c4b5fd', borderTopColor: '#4f46e5', animation: 'nc_spin 0.85s linear infinite' }} />;
}
function fmtDt(s) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d.getTime())) return s;
  const pad = n => String(n).padStart(2, '0');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()}`;
}

/* Real scaled-down render of the template's actual HTML — the "400% then scale(0.25)"
   trick makes the iframe visually fill the container at any width without JS measuring it.
   sandbox="" disables scripts/forms in case a template's HTML has any — it's a pure preview. */
function TemplateThumbnail({ html, height = 260 }) {
  if (!html) {
    return (
      <div style={{ height, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 11, borderBottom: '1px solid #f1f5f9' }}>
        No preview available
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

export default function TemplatesList() {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchPage = async (p = 1, s = search) => {
    setLoading(true);
    try {
      const res = await api.post(API, new URLSearchParams({ action: 'list', page: p, per_page: 12, search: s }), FORM);
      if (res.data.success) {
        const d = res.data.data;
        setRows(d.templates || []); setPage(d.page); setPages(d.pages); setTotal(d.total);
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchPage(1, ''); }, []); // eslint-disable-line

  const archive = async (id) => {
    if (!window.confirm('Archive this template?')) return;
    const t = toast.loading('Archiving…');
    try {
      const res = await api.post(API, new URLSearchParams({ action: 'archive', id }), FORM);
      if (res.data.success) { toast.success('Archived', { id: t }); fetchPage(page); }
      else toast.error(res.data.message || 'Failed', { id: t });
    } catch { toast.error('Network error', { id: t }); }
  };

  return (
    <>
      <style>{`
        @keyframes nc_spin { to { transform: rotate(360deg); } }
        .nc-tpl *{ box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .nc-tpl-card { transition: box-shadow .15s, border-color .15s; }
        .nc-tpl-card:hover { border-color:#1e3a8a; box-shadow:0 6px 18px rgba(30,58,138,.10); }
      `}</style>
      <div className="nc-tpl" style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Email templates <span style={{ fontWeight: 600, color: '#64748b', fontSize: 15 }}>({total})</span></h2>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>Reusable HTML templates for your email campaigns</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchPage(1, search)}
              placeholder="Search templates…" style={{ padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', width: 220 }} />
            <button onClick={() => nav('/netcore/templates/new')}
              style={{ padding: '11px 20px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: '.4px', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              + Create New Template
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' }}>
          {loading && rows.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><Spinner /></div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 13 }}>No templates yet. Click "Create New Template" to start.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
              {rows.map(t => (
                <div key={t.id} className="nc-tpl-card" style={{ border: '1.5px solid #e2e8f0', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
                  <TemplateThumbnail html={t.body_html} />
                  <div style={{ padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{t.name}</div>
                    <div style={{ fontSize: 10.5, color: '#94a3b8', marginBottom: 12 }}>ID: {t.id} · {fmtDt(t.updated_at)}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => archive(t.id)} style={{ flex: 1, padding: '8px 0', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>Archive</button>
                      <button onClick={() => nav(`/netcore/templates/${t.id}`)} style={{ flex: 1, padding: '8px 0', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#1e3a8a', cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => nav(`/netcore/campaigns/new?template_id=${t.id}`)} style={{ flex: 1, padding: '8px 0', border: 'none', background: '#1e3a8a', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>Use</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14, flexShrink: 0 }}>
            <button disabled={page <= 1} onClick={() => fetchPage(page - 1)} style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? .4 : 1, fontSize: 12 }}>Prev</button>
            <span style={{ fontSize: 12.5, color: '#475569', alignSelf: 'center' }}>Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => fetchPage(page + 1)} style={{ padding: '6px 14px', border: '1.5px solid #c4b5fd', borderRadius: 6, background: '#fff', cursor: page >= pages ? 'not-allowed' : 'pointer', opacity: page >= pages ? .4 : 1, fontSize: 12 }}>Next</button>
          </div>
        )}
      </div>
    </>
  );
}
