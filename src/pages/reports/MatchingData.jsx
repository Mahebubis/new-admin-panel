import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/reports/matching_data.php';

/* ─── fetch helpers ─── */
const apiFetch = (qs) => fetch(`${API}?${new URLSearchParams(qs)}`).then(r => r.json());
const apiPost = (data) => fetch(API, { method: 'POST', body: new URLSearchParams(data) }).then(r => r.json());

/* ─── column config ─── */
const COLS = [
  {
    key: 'matching',
    label: 'Matching',
    icon: '✅',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    head: '#15803d',
    badge: { bg: '#dcfce7', color: '#15803d' },
    dot: '#22c55e',
  },
  {
    key: 'only_in_fb',
    label: 'Only in FB Ads',
    icon: '📘',
    bg: '#eff6ff',
    border: '#bfdbfe',
    head: '#1d4ed8',
    badge: { bg: '#dbeafe', color: '#1d4ed8' },
    dot: '#3b82f6',
  },
  {
    key: 'only_in_user',
    label: 'Only in User Campaign',
    icon: '⚠️',
    bg: '#fff7ed',
    border: '#fed7aa',
    head: '#c2410c',
    badge: { bg: '#ffedd5', color: '#c2410c' },
    dot: '#f97316',
  },
];

const TABS = [
  {
    key: 'campaign',
    label: 'Campaigns',
    icon: (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
        <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
      </svg>
    ),
  },
  {
    key: 'adset',
    label: 'Ad Sets',
    icon: (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
        <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
      </svg>
    ),
  },
  {
    key: 'ad',
    label: 'Ads',
    icon: (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
      </svg>
    ),
  },
];

/* ─── rename modal ─── */
function RenameModal({ item, onClose, onSave }) {
  const [val, setVal] = useState(item.value);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!val.trim() || val.trim() === item.value) { onClose(); return; }
    setSaving(true);
    try {
      const res = await apiPost({ action: 'rename', old_value: item.value, new_value: val.trim(), field: item.field });
      if (res.success) {
        toast.success(res.message || 'Renamed successfully!');
        onSave(item.value, val.trim(), item.field);
        onClose();
      } else {
        toast.error(res.message || 'Rename failed');
      }
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '28px 28px 24px', width: 420,
        maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,.2)'
      }}>
        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>✏️ Rename Item</div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 20,
            color: '#94a3b8', lineHeight: 1, padding: 4
          }}>×</button>
        </div>

        {/* current */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
            letterSpacing: '.5px', display: 'block', marginBottom: 6
          }}>Current Name</label>
          <div style={{
            padding: '10px 14px', background: '#f8fafc', borderRadius: 8,
            border: '1.5px solid #e2e8f0', fontSize: 13, color: '#1e293b', wordBreak: 'break-all'
          }}>
            {item.value}
          </div>
        </div>

        {/* new name */}
        <div style={{ marginBottom: 22 }}>
          <label style={{
            fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
            letterSpacing: '.5px', display: 'block', marginBottom: 6
          }}>New Name</label>
          <input
            autoFocus
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            style={{
              width: '100%', padding: '10px 14px', border: '1.5px solid #c4b5fd', borderRadius: 8,
              fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#1e293b',
              boxShadow: '0 0 0 3px rgba(124,58,237,.1)'
            }}
          />
        </div>

        {/* actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose}
            style={{
              padding: '9px 18px', border: '1.5px solid #e2e8f0', borderRadius: 8,
              background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit'
            }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{
              padding: '9px 22px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', color: '#fff',
              background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', opacity: saving ? .7 : 1,
              display: 'flex', alignItems: 'center', gap: 7
            }}>
            {saving ? '⏳ Saving...' : '💾 Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── single column card ─── */
function ComparisonColumn({ col, items, field, onRename, search }) {
  const filtered = search
    ? items.filter(v => v.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div style={{
      border: `1.5px solid ${col.border}`, borderRadius: 12, overflow: 'hidden',
      background: '#fff', display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0
    }}>
      {/* column header */}
      <div style={{
        padding: '12px 16px', background: col.bg, borderBottom: `1.5px solid ${col.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.dot, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: col.head }}>{col.icon} {col.label}</span>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99,
          background: col.badge.bg, color: col.badge.color
        }}>
          {filtered.length} items
        </span>
      </div>

      {/* items */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>
            No items found
          </div>
        ) : (
          filtered.map((value, i) => (
            <div key={value + i}
              style={{
                padding: '12px 16px', borderBottom: '1px solid #f8fafc',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                transition: 'background .12s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{
                fontSize: 12.5, color: '#1e293b', fontWeight: 500, wordBreak: 'break-all',
                lineHeight: 1.5
              }}>
                {value}
              </div>
              <button
                onClick={() => onRename({ value, field })}
                style={{
                  flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', border: '1.5px solid #e2e8f0', borderRadius: 7,
                  background: '#fff', color: '#475569', fontSize: 11.5, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#c4b5fd'; e.currentTarget.style.color = '#4f46e5'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Rename
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
export default function MatchingData() {
  const [activeTab, setActiveTab] = useState('campaign');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [renameItem, setRenameItem] = useState(null);
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch({ action: 'get_data' });
      if (!res.success) { toast.error(res.message || 'Failed to load'); return; }
      setData(res);
      setLastUpdated(new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* live-update state after a successful rename */
  const handleRenamed = (oldVal, newVal, field) => {
    setData(prev => {
      if (!prev) return prev;
      const update = (arr) => arr.map(v => v === oldVal ? newVal : v);
      return {
        ...prev,
        [field]: {
          matching: update(prev[field].matching),
          only_in_fb: update(prev[field].only_in_fb),
          only_in_user: update(prev[field].only_in_user),
        },
      };
    });
  };

  const tabData = data?.[activeTab] || { matching: [], only_in_fb: [], only_in_user: [] };
  const totalItems = tabData.matching.length + tabData.only_in_fb.length + tabData.only_in_user.length;

  /* ── styles ── */
  const thS = {
    fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.7)', textTransform: 'uppercase',
    letterSpacing: '.5px', padding: '10px 14px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
    border: 'none', userSelect: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
    gap: 7, transition: 'color .15s'
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .md-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        @keyframes md_spin { to { transform:rotate(360deg); } }
        .md-spin { display:inline-block;width:22px;height:22px;border:2.5px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:md_spin .7s linear infinite; }
      `}</style>

      <div className="md-root" style={{
        display: 'flex', flexDirection: 'column', height: 'calc(100vh - 62px)',
        padding: 20, gap: 14, overflow: 'hidden', background: '#f5f3ff'
      }}>

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>🔗 Data Matching Analysis</div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
              Compare <code style={{ background: '#ede9fe', padding: '1px 6px', borderRadius: 4, color: '#4f46e5', fontSize: 11 }}>fb_ads_details</code> vs <code style={{ background: '#ede9fe', padding: '1px 6px', borderRadius: 4, color: '#4f46e5', fontSize: 11 }}>user_campaign</code>
              {lastUpdated && <span style={{ marginLeft: 10, color: '#94a3b8' }}>· Updated {lastUpdated}</span>}
            </div>
          </div>
          <button onClick={loadData} disabled={loading}
            style={{
              padding: '8px 18px', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', color: '#fff',
              background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', gap: 7,
              opacity: loading ? .7 : 1, fontFamily: 'inherit'
            }}>
            {loading ? <span className="md-spin" /> : '🔄'} Refresh
          </button>
        </div>

        {/* ── MAIN CARD ── */}
        <div style={{
          flex: 1, minHeight: 0, background: '#fff', borderRadius: 14,
          border: '1.5px solid #ede9fe', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 1px 8px rgba(79,70,229,.07)'
        }}>

          {/* ── TABS + SEARCH ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 20px', borderBottom: '1.5px solid #f5f3ff', flexShrink: 0, flexWrap: 'wrap', gap: 8
          }}>
            {/* tabs */}
            <div style={{ display: 'flex' }}>
              {TABS.map(t => {
                const isActive = activeTab === t.key;
                const cnt = data ? (data[t.key]?.matching?.length || 0) + (data[t.key]?.only_in_fb?.length || 0) + (data[t.key]?.only_in_user?.length || 0) : 0;
                return (
                  <button key={t.key} onClick={() => { setActiveTab(t.key); setSearch(''); }}
                    style={{
                      padding: '14px 18px', border: 'none', background: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: isActive ? 700 : 600, color: isActive ? '#4f46e5' : '#64748b',
                      borderBottom: isActive ? '2.5px solid #4f46e5' : '2.5px solid transparent',
                      display: 'flex', alignItems: 'center', gap: 7, transition: 'all .15s',
                      fontFamily: 'inherit', marginBottom: '-1.5px'
                    }}>
                    <span style={{ color: isActive ? '#4f46e5' : '#94a3b8' }}>{t.icon}</span>
                    {t.label}
                    {cnt > 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
                        background: isActive ? '#ede9fe' : '#f1f5f9', color: isActive ? '#4f46e5' : '#64748b'
                      }}>
                        {cnt}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* search */}
            <div style={{
              display: 'flex', alignItems: 'center', border: '1.5px solid #e2e8f0', borderRadius: 8,
              background: '#f8fafc', overflow: 'hidden', minWidth: 220
            }}>
              <span style={{ padding: '0 10px', color: '#94a3b8', fontSize: 13 }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${activeTab}s...`}
                style={{
                  border: 'none', outline: 'none', background: 'transparent', padding: '7px 8px 7px 0',
                  fontSize: 12.5, color: '#1e293b', flex: 1, fontFamily: 'inherit'
                }} />
              {search && <button onClick={() => setSearch('')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
                  padding: '0 8px', fontSize: 16
                }}>×</button>}
            </div>
          </div>

          {/* ── CONTENT ── */}
          {loading && !data ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 12, color: '#94a3b8', fontSize: 13
            }}>
              <span className="md-spin" />
              Loading comparison data...
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, padding: 16, display: 'flex', gap: 14, overflow: 'hidden' }}>
              {COLS.map(col => (
                <ComparisonColumn
                  key={col.key}
                  col={col}
                  items={tabData[col.key] || []}
                  field={activeTab}
                  onRename={setRenameItem}
                  search={search}
                />
              ))}
            </div>
          )}

          {/* ── FOOTER SUMMARY ── */}
          {data && (
            <div style={{
              padding: '9px 20px', borderTop: '1.5px solid #f5f3ff', flexShrink: 0,
              display: 'flex', gap: 20, flexWrap: 'wrap'
            }}>
              {COLS.map(col => (
                <div key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: col.dot }} />
                  <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500 }}>
                    {col.label}: <strong style={{ color: '#1e293b' }}>{tabData[col.key]?.length || 0}</strong>
                  </span>
                </div>
              ))}
              <div style={{ marginLeft: 'auto', fontSize: 11.5, color: '#94a3b8' }}>
                Total: {totalItems} {activeTab}s
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── RENAME MODAL ── */}
      {renameItem && (
        <RenameModal
          item={renameItem}
          onClose={() => setRenameItem(null)}
          onSave={handleRenamed}
        />
      )}
    </>
  );
}