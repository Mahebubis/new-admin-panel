import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

/*
 * Custom detailed report — pick the columns, get a CSV.
 *
 * One row per RECIPIENT, not per campaign, which is what makes this different from the list
 * export in the toolbar. Three column groups, because they answer three separate questions:
 * which send is this, what did the person do, and who are they.
 *
 * NO EMAIL, NO PASSWORD
 * The product this mirrors mails the file to an address and protects it with a password sent to
 * a phone. That exists because its export runs on a queue on another machine. Ours is a single
 * indexed query over one campaign's recipients, so it downloads directly — asking someone to
 * wait for an email and then go and find a password would be ceremony wrapped around nothing,
 * and it puts recipient data into an inbox that did not have it before.
 */

const API = '/api/campaigns/all_campaigns.php';

const CSS = `
.drm-scrim { position:fixed; inset:0; background:rgba(16,24,40,.5); z-index:80; display:grid; place-items:center;
  padding:24px; animation:drm-fade 180ms cubic-bezier(.4,0,.2,1); }
@keyframes drm-fade { from { opacity:0 } to { opacity:1 } }
.drm { width:760px; max-width:100%; max-height:90vh; background:#fff; border-radius:14px; display:flex;
  flex-direction:column; box-shadow:0 24px 64px rgba(16,24,40,.28);
  animation:drm-in 220ms cubic-bezier(.4,0,.2,1); }
@keyframes drm-in { from { opacity:0; transform:translateY(12px) scale(.985) } to { opacity:1; transform:none } }

.drm-head { flex:none; padding:18px 22px 15px; border-bottom:1px solid #f2f4f7; display:flex; align-items:flex-start; gap:12px; }
.drm-head h2 { font-size:16.5px; font-weight:750; color:#101828; margin:0 0 3px; }
.drm-head p { font-size:12.5px; color:#667085; margin:0; line-height:1.55; }
.drm-x { margin-left:auto; width:30px; height:30px; display:grid; place-items:center; border:0; background:none;
  border-radius:8px; color:#667085; cursor:pointer; flex:none; transition:background 150ms, color 150ms; }
.drm-x:hover { background:#f2f4f7; color:#101828; }

.drm-body { flex:1; overflow-y:auto; padding:18px 22px 22px; }
.drm-scope { background:#f9fafb; border:1px solid #eaecf0; border-radius:9px; padding:11px 14px; margin-bottom:18px;
  font-size:12.5px; color:#475467; display:flex; align-items:center; gap:9px; }
.drm-scope b { color:#101828; }

.drm-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:14px; }
@media (max-width:720px) { .drm-grid { grid-template-columns:1fr; } }

.drm-col > h3 { font-size:12px; font-weight:700; color:#344054; margin:0 0 8px; display:flex; align-items:center; gap:7px; }
.drm-col > h3 .n { font-size:10.5px; font-weight:700; color:#4f46e5; background:#eef2ff; padding:1px 7px; border-radius:999px; }
.drm-box { border:1px solid #d0d5dd; border-radius:9px; overflow:hidden; display:flex; flex-direction:column; height:246px; }
.drm-search { flex:none; border:0; border-bottom:1px solid #eaecf0; padding:9px 11px; font-size:12.5px;
  font-family:inherit; color:#101828; outline:none; background:#fcfcfd; }
.drm-search:focus { background:#fff; box-shadow:inset 0 -2px 0 #4f46e5; }
.drm-opts { flex:1; overflow-y:auto; padding:5px; }
.drm-opt { display:flex; align-items:center; gap:9px; padding:6px 9px; border-radius:7px; cursor:pointer;
  font-size:12.5px; color:#344054; transition:background 130ms; }
.drm-opt:hover { background:#f9fafb; }
.drm-opt input { accent-color:#4f46e5; cursor:pointer; flex:none; }
.drm-opt.all { font-weight:700; color:#101828; border-bottom:1px solid #f2f4f7; border-radius:0; margin-bottom:4px; }
.drm-grouphead { font-size:10.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:#98a2b3;
  padding:9px 9px 4px; }
.drm-none { padding:18px 12px; font-size:12px; color:#98a2b3; text-align:center; }

.drm-foot { flex:none; display:flex; align-items:center; gap:10px; padding:15px 22px; border-top:1px solid #f2f4f7;
  background:#fcfcfd; border-radius:0 0 14px 14px; }
.drm-btn { padding:10px 20px; border-radius:8px; font-size:13px; font-weight:650; font-family:inherit; cursor:pointer;
  border:1px solid transparent;
  transition:background 160ms cubic-bezier(.4,0,.2,1), box-shadow 160ms, transform 90ms, border-color 160ms; }
.drm-btn:active:not(:disabled) { transform:translateY(1px); }
.drm-btn:focus-visible { outline:2px solid #4f46e5; outline-offset:2px; }
.drm-btn:disabled { opacity:.5; cursor:not-allowed; }
.drm-btn-solid { background:#4f46e5; color:#fff; }
.drm-btn-solid:hover:not(:disabled) { background:#4338ca; box-shadow:0 5px 14px rgba(79,70,229,.3); }
.drm-btn-ghost { background:#fff; color:#344054; border-color:#d0d5dd; }
.drm-btn-ghost:hover { background:#f9fafb; border-color:#98a2b3; }
`;

/** One checklist column with its own search and a Select all. */
function Picker({ title, options, selected, onToggle, onAll, grouped }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? options.filter(o => o.label.toLowerCase().includes(n)) : options;
  }, [options, q]);

  const allShown = shown.length > 0 && shown.every(o => selected.includes(o.id));

  /* Group headers only where the source actually groups (attributes), so the simple lists stay
     flat. Computed up front rather than tracked through the map — a mutable cursor inside JSX
     survives across renders and starts producing headers in the wrong places. */
  const headerAt = useMemo(() => {
    if (!grouped) return {};
    const out = {};
    let last = null;
    shown.forEach(o => { if (o.group && o.group !== last) { out[o.id] = o.group; last = o.group; } });
    return out;
  }, [shown, grouped]);

  return (
    <div className="drm-col">
      <h3>{title}{selected.length > 0 && <span className="n">{selected.length}</span>}</h3>
      <div className="drm-box">
        <input className="drm-search" value={q} onChange={e => setQ(e.target.value)}
               placeholder="Search" aria-label={`Search ${title}`} />
        <div className="drm-opts">
          {shown.length > 0 && (
            <label className="drm-opt all">
              <input type="checkbox" checked={allShown}
                     onChange={() => onAll(shown.map(o => o.id), !allShown)} />
              Select all{q.trim() ? ' shown' : ''}
            </label>
          )}
          {shown.map(o => {
            const head = headerAt[o.id];
            return (
              <div key={o.id}>
                {head && <div className="drm-grouphead">{head}</div>}
                <label className="drm-opt">
                  <input type="checkbox" checked={selected.includes(o.id)} onChange={() => onToggle(o.id)} />
                  {o.label}
                </label>
              </div>
            );
          })}
          {!shown.length && <div className="drm-none">Nothing matches “{q}”</div>}
        </div>
      </div>
    </div>
  );
}

export default function DetailedReportModal({ campaign, onClose }) {
  const [cols, setCols] = useState({ campaign: [], activity: [], attributes: [] });
  const [sel, setSel]   = useState({
    // A sensible file rather than an empty one: these four are what every export ends up wanting,
    // and starting from nothing makes the Download button look broken.
    campaign: ['campaign_name', 'campaign_id'],
    activity: ['delivery_status', 'open_time'],
    attributes: [],
  });
  const [loading, setLoading] = useState(true);
  const dialogRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(API, { params: { action: 'report_columns' } });
      if (res.data?.success) setCols(res.data.data);
      else toast.error(res.data?.message || 'Could not load the column list');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not load the column list');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => dialogRef.current?.focus(), 50);
    return () => { document.removeEventListener('keydown', onKey); clearTimeout(t); };
  }, [onClose]);

  const toggle = (group, id) => setSel(s => ({
    ...s,
    [group]: s[group].includes(id) ? s[group].filter(x => x !== id) : [...s[group], id],
  }));
  const setAll = (group, ids, on) => setSel(s => ({
    ...s,
    [group]: on ? Array.from(new Set([...s[group], ...ids])) : s[group].filter(x => !ids.includes(x)),
  }));

  const total = sel.campaign.length + sel.activity.length + sel.attributes.length;

  const download = () => {
    const qs = new URLSearchParams({
      action: 'detailed_report',
      channel: campaign.channel,
      id: String(campaign.id),
      campaign_cols: sel.campaign.join(','),
      activity_cols: sel.activity.join(','),
      attribute_cols: sel.attributes.join(','),
    }).toString();
    // A plain navigation, so the browser's own download machinery handles the auth cookie, the
    // filename from Content-Disposition, and a large file streaming to disk rather than to memory.
    window.open(`${API}?${qs}`, '_blank');
    onClose();
  };

  return (
    <div className="drm-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{CSS}</style>
      <div className="drm" role="dialog" aria-modal="true" aria-label="Custom detailed report"
           tabIndex={-1} ref={dialogRef}>
        <div className="drm-head">
          <div>
            <h2>Custom detailed report</h2>
            <p>One row per recipient. Pick the columns you want and it downloads as a CSV.</p>
          </div>
          <button className="drm-x" onClick={onClose} aria-label="Close">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="drm-body">
          <div className="drm-scope">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
            <span>
              Reporting on <b>{campaign.name}</b> ({campaign.channel === 'whatsapp' ? 'WhatsApp' : 'Email'} · ID {campaign.id}).
              {' '}The recipient&apos;s {campaign.channel === 'whatsapp' ? 'phone number' : 'email address'} is always included.
            </span>
          </div>

          {loading ? (
            <div className="drm-none" style={{ padding: 60 }}>Loading columns…</div>
          ) : (
            <div className="drm-grid">
              <Picker title="Campaign details" options={cols.campaign} selected={sel.campaign}
                      onToggle={id => toggle('campaign', id)} onAll={(ids, on) => setAll('campaign', ids, on)} />
              <Picker title="Activity details" options={cols.activity} selected={sel.activity}
                      onToggle={id => toggle('activity', id)} onAll={(ids, on) => setAll('activity', ids, on)} />
              <Picker title="Attribute details" options={cols.attributes} selected={sel.attributes} grouped
                      onToggle={id => toggle('attributes', id)} onAll={(ids, on) => setAll('attributes', ids, on)} />
            </div>
          )}
        </div>

        <div className="drm-foot">
          <span style={{ fontSize: 12.5, color: '#667085' }}>
            {total === 0 ? 'Pick at least one column' : `${total} column${total === 1 ? '' : 's'} selected`}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <button className="drm-btn drm-btn-ghost" onClick={onClose}>Cancel</button>
            <button className="drm-btn drm-btn-solid" onClick={download} disabled={total === 0 || loading}>
              Download CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
