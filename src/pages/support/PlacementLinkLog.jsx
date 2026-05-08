import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Helmet } from "react-helmet-async";

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/support/wa_link_log.php';
const POLL_MS = 5000;
const post = d => fetch(API, { method: 'POST', body: new URLSearchParams(d) }).then(r => r.json());

/* ─── format timestamp ─── */
const fmtDT = d => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    });
  } catch { return d; }
};

/* ─── link name badge ─── */
const LinkBadge = ({ name, variant }) => {
  const cfg = {
    closed: { bg: 'linear-gradient(135deg,#dc2626,#b91c1c)', icon: '🔴' },
    activated: { bg: 'linear-gradient(135deg,#16a34a,#15803d)', icon: '✅' },
  };
  const c = cfg[variant];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600,
      color: '#fff', background: c.bg, maxWidth: 240,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
    }}>
      <span style={{ flexShrink: 0 }}>{c.icon}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || '—'}</span>
    </span>
  );
};

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
export default function WALinkLog() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const [live, setLive] = useState(true);
  const [search, setSearch] = useState('');
  const pollRef = useRef(null);

  /* ── fetch ── */
  const fetchRows = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await post({ action: 'fetch_all' });
      if (res.success) { setRows(res.data || []); setLastSync(new Date()); }
    } catch (e) { if (!silent) toast.error(e.message); }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  /* ── real-time polling ── */
  useEffect(() => {
    clearInterval(pollRef.current);
    if (live) pollRef.current = setInterval(() => fetchRows(true), POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [live, fetchRows]);

  /* ── filtered rows ── */
  const filtered = search.trim()
    ? rows.filter(r =>
      (r.old_link_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.new_link_name || '').toLowerCase().includes(search.toLowerCase())
    )
    : rows;

  const thS = {
    padding: '11px 14px', fontSize: 10.5, fontWeight: 700, color: '#fff',
    textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap',
    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
    borderRight: '1px solid rgba(255,255,255,.15)', position: 'sticky', top: 0, zIndex: 2,
  };
  const tdS = {
    padding: '12px 14px', fontSize: 12.5, color: '#1e293b',
    borderBottom: '1px solid #f5f3ff', verticalAlign: 'middle',
  };

  return (
    <>
    <Helmet>
        <title>WA Link Log | Admin Panel</title>
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .wal-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .wal-tr:hover td { background:#faf9ff!important; }
        .wal-inp:focus { border-color:#4f46e5!important; box-shadow:0 0 0 3px rgba(79,70,229,.1)!important; }
        @keyframes wal_spin { to { transform:rotate(360deg); } }
        .wal-spin { display:inline-block;width:18px;height:18px;border:2.5px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:wal_spin .7s linear infinite; }
        @keyframes wal_pulse { 0%,100%{opacity:1}50%{opacity:.5} }
        .live-dot { display:inline-block;width:7px;height:7px;border-radius:50%;background:#22c55e;animation:wal_pulse 2s infinite; }
      `}</style>

      <div className="wal-root" style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100vh - 62px)', padding: 20, gap: 14, overflow: 'hidden', background: '#f5f3ff'
      }}>

        {/* ── HEADER ── */}
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: 10
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>
              📋 WhatsApp Link Change Log
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Audit trail of all WhatsApp link activations and closures
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* live pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
              background: '#fff', borderRadius: 8, border: '1.5px solid #e2e8f0',
              fontSize: 12, fontWeight: 600, color: '#64748b'
            }}>
              {live && <span className="live-dot" />}
              <span style={{ color: live ? '#15803d' : '#64748b' }}>
                {live ? `Live (${POLL_MS / 1000}s)` : 'Paused'}
              </span>
              <button onClick={() => setLive(p => !p)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: '#4f46e5', fontWeight: 700, marginLeft: 2
                }}>
                {live ? 'Pause' : 'Resume'}
              </button>
            </div>
            {lastSync && (
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                🕐 {lastSync.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            )}
            <button onClick={() => fetchRows()}
              style={{
                padding: '7px 13px', border: '1.5px solid #e2e8f0', borderRadius: 8,
                background: '#fff', color: '#64748b', fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit'
              }}>🔄 Refresh</button>
          </div>
        </div>

        {/* ── STAT CHIPS + SEARCH ── */}
        <div style={{ flexShrink: 0, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* stat chips */}
          {[
            { label: 'Total Events', value: rows.length, bg: '#ede9fe', color: '#4f46e5', border: '#c4b5fd' },
            { label: 'Showing', value: filtered.length, bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' },
          ].map(s => (
            <div key={s.label} style={{
              background: s.bg, border: `1.5px solid ${s.border}`,
              borderRadius: 10, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8
            }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, color: s.color,
                textTransform: 'uppercase', letterSpacing: '.04em'
              }}>{s.label}</span>
            </div>
          ))}

          {/* search */}
          <div style={{ flex: 1, maxWidth: 320, position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: '#94a3b8', fontSize: 14
            }}>🔍</span>
            <input className="wal-inp" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search link names..."
              style={{
                width: '100%', padding: '8px 12px 8px 32px', border: '1.5px solid #e2e8f0',
                borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none',
                color: '#1e293b', background: '#fff'
              }} />
            {search && (
              <button onClick={() => setSearch('')}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16
                }}>×</button>
            )}
          </div>
        </div>

        {/* ── TABLE CARD ── */}
        <div style={{
          flex: 1, minHeight: 0, background: '#fff', borderRadius: 14,
          border: '1.5px solid #ede9fe', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', boxShadow: '0 1px 8px rgba(79,70,229,.07)'
        }}>

          {/* live banner */}
          <div style={{
            padding: '7px 16px', background: '#f0fdf4', borderBottom: '1.5px solid #bbf7d0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5,
              color: '#15803d', fontWeight: 500
            }}>
              {loading
                ? <><span className="wal-spin" /> Loading log entries...</>
                : <><span className="live-dot" /> {filtered.length} entries — auto-refreshing every {POLL_MS / 1000}s</>}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              Read-only · <code style={{
                background: '#f5f3ff', padding: '1px 5px',
                borderRadius: 4, color: '#4f46e5', fontSize: 10.5
              }}>whatsapp_link_log</code>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 700 }}>
              <thead>
                <tr>
                  {['ID', 'Old Link Name (Closed)', 'New Link Name (Activated)', 'Activated / Closed On'].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && !rows.length ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 50, color: '#94a3b8' }}>
                    <div className="wal-spin" style={{ width: 28, height: 28, margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 13 }}>Loading log entries...</div>
                  </td></tr>
                ) : !filtered.length ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 50, color: '#94a3b8' }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>
                      {search ? 'No entries match your search' : 'No log entries found'}
                    </div>
                  </td></tr>
                ) : filtered.map((row, idx) => (
                  <tr key={row.id} className="wal-tr"
                    style={{ background: idx % 2 === 0 ? '#fff' : '#fafafe' }}>

                    {/* ID */}
                    <td style={{
                      ...tdS, fontFamily: 'monospace', color: '#6b7280',
                      fontSize: 12, width: 60
                    }}>
                      #{row.id}
                    </td>

                    {/* Old link — closed (red) */}
                    <td style={tdS}>
                      <LinkBadge name={row.old_link_name} variant="closed" />
                    </td>

                    {/* New link — activated (green) */}
                    <td style={tdS}>
                      <LinkBadge name={row.new_link_name} variant="activated" />
                    </td>

                    {/* Timestamp */}
                    <td style={{ ...tdS, fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>🕐</span>
                        {fmtDT(row.change_timestamp)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* footer */}
          <div style={{
            padding: '8px 16px', borderTop: '1.5px solid #f5f3ff', flexShrink: 0,
            display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#94a3b8'
          }}>
            <span>🔒 Read-only audit log — no edits or deletes</span>
            <span>{filtered.length} of {rows.length} entries</span>
          </div>
        </div>
      </div>
    </>
  );
}