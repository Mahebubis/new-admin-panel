import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Helmet } from "react-helmet-async";

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/permissions/permissions_api.php';
// const post = d => fetch(API, { method: 'POST', body: new URLSearchParams(d) }).then(r => r.json());
const post = d => {
  const token = localStorage.getItem('token'); // or wherever you store JWT

  return fetch(API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(d)
  }).then(r => r.json());
};

/* ─── extra permissions injected client-side (not in backend get_sections) ───
   Use this when a permission key is already consumed by the app (e.g. via
   hasPermission('...')) but hasn't been registered in the backend permission
   list. The toggle_permission endpoint accepts any string key, so these
   behave identically to backend-defined permissions once granted. */
const EXTRA_SECTION_PERMISSIONS = {
  'Reporting & Analysis': {
    meta_remark2_access: 'Meta Reports (Old) — Remark 2 Column',
  },
  'Notes': {
    notes: 'Team Notes Access',
  },
};

/* ─── section → icon emoji map (mirrors PHP sectionIconMap) ─── */
const SECTION_ICONS = {
  'Dashboard': '📊',
  'Student Management': '🎓',
  'Referral Management': '🤝',
  'Refund Management': '↩️',
  'Domain Management': '🌐',
  'Netcore': '🔌',
  'Homepage': '🏠',
  'Internships': '💼',
  'Blogs': '✍️',
  'FAQs': '❓',
  'Total Assessments': '📈',
  'Communication': '💬',
  'Examinations': '📝',
  'Reporting & Analysis': '📊',
  'Company Management': '🏢',
  'Support': '🎧',
  'Settings': '⚙️',
  'Admin Panel': '🔧',
  'Permissions': '🔐',
  'Notes': '📝',
};

/* ─── helpers ─── */
const initials = s => (s || '?').trim().charAt(0).toUpperCase();
const displayName = u =>
  ((u.fname || '') + ' ' + (u.lname || '')).trim() || u.username || u.email || `User #${u.user_id}`;


/* ─── debounce hook ─── */
function useDebouncedValue(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ─── Toggle switch ─── */
const Toggle = ({ checked, onChange, disabled }) => (
  <label style={{
    position: 'relative', width: 40, height: 22, display: 'inline-block',
    cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0
  }}>
    <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled}
      style={{ opacity: 0, width: 0, height: 0 }} />
    <span style={{
      position: 'absolute', inset: 0, background: checked ? '#4f46e5' : '#e2e8f0',
      borderRadius: 22, transition: 'background .25s'
    }} />
    <span style={{
      position: 'absolute', width: 16, height: 16, top: 3, left: 3,
      background: '#fff', borderRadius: '50%', boxShadow: '0 1px 4px rgba(0,0,0,.18)',
      transition: 'transform .25s', transform: checked ? 'translateX(18px)' : 'translateX(0)'
    }} />
  </label>
);

/* ─── Permission count badge ─── */
const PermBadge = ({ count, total, isSA }) => {
  if (isSA) return <span style={{ ...badgeS, background: '#fef3c7', color: '#d97706' }}>Super</span>;
  if (count === 0) return <span style={{ ...badgeS, background: '#f1f5f9', color: '#94a3b8' }}>None</span>;
  if (count >= total) return <span style={{ ...badgeS, background: '#dcfce7', color: '#16a34a' }}>All</span>;
  return <span style={{ ...badgeS, background: '#eef2ff', color: '#4f46e5' }}>{count}/{total}</span>;
};
const badgeS = { fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, flexShrink: 0 };

/* ─── Section badge ─── */
const SecBadge = ({ count, total, isSA }) => {
  if (isSA) return <span style={{ ...secBS, background: '#fef3c7', color: '#d97706' }}>Super</span>;
  if (count === 0) return <span style={{ ...secBS, background: '#e2e8f0', color: '#94a3b8' }}>{count}/{total}</span>;
  if (count >= total) return <span style={{ ...secBS, background: '#dcfce7', color: '#16a34a' }}>All</span>;
  return <span style={{ ...secBS, background: '#4f46e5', color: '#fff' }}>{count}/{total}</span>;
};
const secBS = { fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, flexShrink: 0 };

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
export default function ManagePermissions() {
  const [sections, setSections] = useState({});
  const [totalPerms, setTotalPerms] = useState(0);
  const [adminUsers, setAdminUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [userFilter, setUserFilter] = useState('');
  const [secFilter, setSecFilter] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [modalFilter, setModalFilter] = useState('');
  const searchRef = useRef(null);

  /* ── load sections + admin users ── */
  // useEffect(() => {
  //   Promise.all([
  //     post({ action: 'get_sections' }),
  //     post({ action: 'get_admin_users' }),
  //   ]).then(([sRes, uRes]) => {
  //     // if (sRes.success) { setSections(sRes.sections || {}); setTotalPerms(sRes.total_perms || 0); }
  //     // if (uRes.success) setAdminUsers(uRes.users || []);
  //     if (sRes.success) {
  //       setSections(sRes.data?.sections || {});
  //       setTotalPerms(sRes.data?.total_perms || 0);
  //     }

  //     if (uRes.success) {
  //       setAdminUsers(uRes.data?.users || []);
  //     }
  //     setLoading(false);
  //   }).catch(() => setLoading(false));
  // }, []);

  /* ── load sections + admin users (guarded against StrictMode double-fire) ── */
  const didFetch = useRef(false);
  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    Promise.all([
      post({ action: 'get_sections' }),
      post({ action: 'get_admin_users' }),
    ]).then(([sRes, uRes]) => {
      if (sRes.success) {
        const apiSections = sRes.data?.sections || {};
        const merged = { ...apiSections };
        let extraCount = 0;
        for (const [sec, items] of Object.entries(EXTRA_SECTION_PERMISSIONS)) {
          const existing = merged[sec] || {};
          const additions = {};
          for (const [k, label] of Object.entries(items)) {
            if (!(k in existing)) {
              additions[k] = label;
              extraCount++;
            }
          }
          merged[sec] = { ...existing, ...additions };
        }
        setSections(merged);
        setTotalPerms((sRes.data?.total_perms || 0) + extraCount);
      }
      if (uRes.success) {
        setAdminUsers(uRes.data?.users || []);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  /* ── select user ── */
  const selectUser = useCallback((u) => {
    const perms = Array.isArray(u.permissions)
      ? Object.fromEntries(u.permissions.map(k => [k, true]))
      : { ...u.permissions };
    setCurrentUser({ ...u, permissions: perms });
    const firstSec = Object.keys(sections)[0];
    if (firstSec) setActiveSection(firstSec);
  }, [sections]);

  /* ── toggle single permission ── */
  const togglePerm = async (key, granted) => {
    const res = await post({ action: 'toggle_permission', user_id: currentUser.user_id, permission_key: key, granted: granted ? 1 : 0 });
    if (res.success) {
      const perms = { ...currentUser.permissions };
      if (granted) perms[key] = true; else delete perms[key];
      setCurrentUser(p => ({ ...p, permissions: perms }));
      updateUserListBadge(currentUser.user_id, perms);
      toast.success(granted ? '✓ Granted' : '✗ Revoked', { duration: 1800 });
    } else toast.error(res.message || 'Error');
  };

  /* ── toggle all in section ── */
  const toggleSection = async (secName, granted) => {
    const keys = Object.keys(sections[secName] || {});
    const res = await post({ action: 'toggle_all_section', user_id: currentUser.user_id, granted: granted ? 1 : 0, keys: JSON.stringify(keys) });
    if (res.success) {
      const perms = { ...currentUser.permissions };
      keys.forEach(k => granted ? (perms[k] = true) : delete perms[k]);
      setCurrentUser(p => ({ ...p, permissions: perms }));
      updateUserListBadge(currentUser.user_id, perms);
      toast.success(granted ? `All granted in ${secName}` : `All revoked in ${secName}`, { duration: 2000 });
    } else toast.error(res.message || 'Error');
  };

  /* ── toggle all perms (Grant All / Revoke All) ── */
  const toggleAllPerms = async (granted) => {
    const allKeys = Object.values(sections).flatMap(s => Object.keys(s));
    const res = await post({ action: 'toggle_all_section', user_id: currentUser.user_id, granted: granted ? 1 : 0, keys: JSON.stringify(allKeys) });
    if (res.success) {
      const perms = granted ? Object.fromEntries(allKeys.map(k => [k, true])) : {};
      setCurrentUser(p => ({ ...p, permissions: perms }));
      updateUserListBadge(currentUser.user_id, perms);
      toast.success(granted ? 'All permissions granted' : 'All permissions revoked', { duration: 2000 });
    }
  };

  /* ── toggle admin ── */
  const toggleAdmin = async (isAdmin) => {
    const res = await post({ action: 'toggle_admin', user_id: currentUser.user_id, is_admin: isAdmin ? 1 : 0 });
    if (res.success) {
      setCurrentUser(p => ({ ...p, is_admin: isAdmin }));
      toast.success(isAdmin ? 'Admin access granted' : 'Admin access revoked', { duration: 2000 });
    } else toast.error('Error');
  };

  /* ── search user ── */
  // const searchUser = async () => {

  //   if (searchQ.trim().length < 2) { toast.error('Enter at least 2 characters'); return; }
  //   setSearching(true);
  //   const res = await post({ action: 'search_user', query: searchQ });
  //   setSearching(false);
  //   if (!res.success) { toast.error(res.message || 'Error'); return; }

  //   const foundUsers = res.data?.users || [];
  //   const newUsers = foundUsers.filter(u => !adminUsers.find(a => a.user_id == u.user_id));

  //   if (!foundUsers.length) { toast.error('No users found'); return; }

  //   if (newUsers.length) {
  //     setAdminUsers(p => [...p, ...newUsers]);
  //     toast.success(`Found ${foundUsers.length} user(s)`);
  //   } else {
  //     toast('User already in list', { icon: '👁' });
  //   }

  //   // auto-select if only 1 result
  //   if (foundUsers.length === 1) selectUser(foundUsers[0]);
  // };

  /* ── search user (opens modal with results) ── */
  // const searchUser = async () => {
  //   if (searchQ.trim().length < 2) { toast.error('Enter at least 2 characters'); return; }
  //   setSearching(true);
  //   const res = await post({ action: 'search_user', query: searchQ });
  //   setSearching(false);
  //   if (!res.success) { toast.error(res.message || 'Error'); return; }

  //   const foundUsers = res.data?.users || [];
  //   if (!foundUsers.length) { toast.error('No users found'); return; }

  //   setSearchResults(foundUsers);
  //   setShowSearchModal(true);
  // };

  /* ── search user (modal only if >1 result, else direct add) ── */
  // const searchUser = async () => {
  //   if (searchQ.trim().length < 2) { toast.error('Enter at least 2 characters'); return; }
  //   setSearching(true);
  //   const res = await post({ action: 'search_user', query: searchQ });
  //   setSearching(false);
  //   if (!res.success) { toast.error(res.message || 'Error'); return; }

  //   const foundUsers = res.data?.users || [];
  //   if (!foundUsers.length) { toast.error('No users found'); return; }

  //   // Only 1 match: add directly + select, skip popup
  //   if (foundUsers.length === 1) {
  //     const u = foundUsers[0];
  //     const alreadyInList = adminUsers.some(a => a.user_id == u.user_id);
  //     if (!alreadyInList) {
  //       setAdminUsers(prev => [...prev, u]);
  //       toast.success(`Added ${displayName(u)}`);
  //     } else {
  //       toast('User already in list', { icon: '👁' });
  //     }
  //     selectUser(u);
  //     setSearchQ('');
  //     return;
  //   }

  //   // Multiple matches: show modal
  //   setSearchResults(foundUsers);
  //   setModalFilter('');
  //   setShowSearchModal(true);
  // };

  /* ── search user (modal only if >1 result, else direct add) ── */
  const searchUser = async () => {
    if (searchQ.trim().length < 2) { toast.error('Enter at least 2 characters'); return; }
    setSearching(true);
    const res = await post({ action: 'search_user', query: searchQ });
    setSearching(false);
    if (!res.success) { toast.error(res.message || 'Error'); return; }

    const foundUsers = res.data?.users || [];
    if (!foundUsers.length) { toast.error('No users found'); return; }

    // Only 1 match: add directly + select, skip popup
    if (foundUsers.length === 1) {
      const u = foundUsers[0];
      const alreadyInList = adminUsers.some(a => a.user_id == u.user_id);
      if (!alreadyInList) {
        setAdminUsers(prev => [...prev, u]);
        toast.success(`Added ${displayName(u)}`);
      } else {
        toast('User already in list', { icon: '👁' });
      }
      selectUser(u);
      setSearchQ('');
      return;
    }

    // Multiple matches: show modal
    setSearchResults(foundUsers);
    setModalFilter('');
    setShowSearchModal(true);
  };

  /* ── pick a user from search modal ── */
  const pickSearchUser = (u) => {
    // add to admin users list if not already there
    setAdminUsers(prev => prev.find(a => a.user_id == u.user_id) ? prev : [...prev, u]);
    // select it
    selectUser(u);
    // close popup + clear
    setShowSearchModal(false);
    setSearchResults([]);
    setModalFilter('');
    setSearchQ('');
  };
  /* ── update admin users list badge ── */
  const updateUserListBadge = (uid, perms) => {
    setAdminUsers(prev => prev.map(u => u.user_id == uid ? { ...u, permissions: perms } : u));
  };

  /* ── debounced inputs so we don't re-filter on every keystroke ── */
  const userFilterDebounced = useDebouncedValue(userFilter, 150);
  const secFilterDebounced = useDebouncedValue(secFilter, 150);

  /* ── filtered users list (memoized) ── */
  const filteredUsers = useMemo(() => {
    const q = userFilterDebounced.trim().toLowerCase();
    if (!q) return adminUsers;
    return adminUsers.filter(u => {
      const n = displayName(u).toLowerCase();
      const e = (u.email || '').toLowerCase();
      return n.includes(q) || e.includes(q);
    });
  }, [adminUsers, userFilterDebounced]);

  /* ── filtered sections (memoized) ── */
  const filteredSections = useMemo(() => {
    const q = secFilterDebounced.trim().toLowerCase();
    if (!q) return sections;
    return Object.fromEntries(
      Object.entries(sections).filter(([k]) => k.toLowerCase().includes(q))
    );
  }, [sections, secFilterDebounced]);

  const isSA = currentUser && parseInt(currentUser.is_superadmin) === 1;
  const grantedCount = currentUser ? Object.keys(currentUser.permissions || {}).length : 0;

  /* ─── styles ─── */
  const panelCardS = {
    background: '#fff', border: '1.5px solid #ede9fe', borderRadius: 14,
    overflow: 'hidden', boxShadow: '0 1px 6px rgba(79,70,229,.06)',
  };

  return (
    <>
    <Helmet>
        <title>Manage Permission | Admin Panel</title>
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .mp-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .mp-urow:hover { background:#f0f4ff!important; }
        .mp-urow.sel { background:#eef2ff!important; }
        .mp-urow.sel::before { content:'';position:absolute;left:0;top:20%;height:60%;width:3px;background:#4f46e5;border-radius:0 3px 3px 0; }
        .mp-secrow:hover { background:#f0f4ff!important; color:#4f46e5!important; }
        .mp-secrow.active { background:#eef2ff!important; color:#4f46e5!important; }
        .mp-secrow.active::before { content:'';position:absolute;left:0;top:18%;height:64%;width:3px;background:#4f46e5;border-radius:0 3px 3px 0; }
        .mp-pitem { background:#fff;border:1.5px solid #e2e8f0;border-radius:9px;transition:border .2s,background .2s; }
        .mp-pitem.on { background:rgba(99,102,241,.04);border-color:#c7d2fe; }
        .mp-inp:focus { border-color:#4f46e5!important; box-shadow:0 0 0 3px rgba(79,70,229,.1)!important; outline:none; }
        @keyframes mp_spin { to { transform:rotate(360deg); } }
        @keyframes mp_fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes mp_slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .mp-spin { display:inline-block;width:14px;height:14px;border:2px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:mp_spin .7s linear infinite; }
        .mp-scroll { overflow-y:auto;scrollbar-width:thin;scrollbar-color:#e2e8f0 transparent; }
        .mp-scroll::-webkit-scrollbar { width:4px; }
        .mp-scroll::-webkit-scrollbar-thumb { background:#e2e8f0;border-radius:4px; }
      `}</style>

      <div className="mp-root" style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100vh - 62px)', background: '#f5f3ff', overflow: 'hidden'
      }}>

        {/* ══ HEADER ══ */}
        <div style={{
          background: '#fff', borderBottom: '1.5px solid #e2e8f0', padding: '13px 22px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, gap: 14, flexWrap: 'wrap'
        }}>
          <div>
            <div style={{
              fontSize: 15, fontWeight: 800, color: '#0f172a',
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              🔐 Manage Permissions
            </div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>
              Select a user on the left to edit their permissions
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 10, top: '50%',
                transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 12
              }}>🔍</span>
              <input ref={searchRef} className="mp-inp" value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchUser()}
                placeholder="Search by email or name..."
                style={{
                  height: 36, width: 260, padding: '0 12px 0 32px',
                  border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 13,
                  fontFamily: 'inherit', color: '#1e293b', background: '#f8fafc'
                }} />
            </div>
            <button onClick={searchUser} disabled={searching}
              style={{
                height: 36, padding: '0 16px', background: '#4f46e5', color: '#fff',
                border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
                opacity: searching ? .7 : 1
              }}>
              {searching ? <><span className="mp-spin" /> Searching...</> : '🔍 Search'}
            </button>
          </div>
        </div>

        {/* ══ BODY ══ */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* ── LEFT: User List ── */}
          <div style={{
            width: 280, flexShrink: 0, borderRight: '1.5px solid #e2e8f0',
            background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            {/* panel head */}
            <div style={{
              padding: '10px 14px 8px', borderBottom: '1px solid #f1f5f9',
              fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase',
              letterSpacing: '.07em', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', flexShrink: 0
            }}>
              <span>Admin Users</span>
              <span style={{
                background: '#eef2ff', color: '#4f46e5', padding: '2px 8px',
                borderRadius: 10, fontSize: 11
              }}>{adminUsers.length}</span>
            </div>
            {/* user filter */}
            <div style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                  color: '#94a3b8', fontSize: 11
                }}>🔍</span>
                <input className="mp-inp" value={userFilter} onChange={e => setUserFilter(e.target.value)}
                  placeholder="Filter users..."
                  style={{
                    width: '100%', height: 30, padding: '0 8px 0 24px', border: '1.5px solid #e2e8f0',
                    borderRadius: 7, fontSize: 12, fontFamily: 'inherit', background: '#f8fafc', color: '#1e293b'
                  }} />
              </div>
            </div>
            {/* user list */}
            <div className="mp-scroll" style={{ flex: 1, padding: 6 }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>
                  <span className="mp-spin" style={{ width: 20, height: 20, borderWidth: 2.5, margin: '0 auto 8px', display: 'block' }} />
                  <div style={{ fontSize: 12 }}>Loading...</div>
                </div>
              ) : !filteredUsers.length ? (
                <div style={{ textAlign: 'center', padding: '30px 14px', color: '#94a3b8' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>👥</div>
                  <div style={{ fontSize: 12 }}>No admin users found</div>
                </div>
              ) : filteredUsers.map(u => {
                const name = displayName(u);
                const isSuperA = parseInt(u.is_superadmin) === 1;
                const pCount = u.permissions
                  ? (Array.isArray(u.permissions) ? u.permissions.length : Object.keys(u.permissions).length)
                  : 0;
                const isSelected = currentUser?.user_id == u.user_id;
                return (
                  <div key={u.user_id} className={`mp-urow${isSelected ? ' sel' : ''}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
                      borderRadius: 9, cursor: 'pointer', position: 'relative', transition: 'background .15s'
                    }}
                    onClick={() => selectUser(u)}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                      background: isSuperA
                        ? 'linear-gradient(135deg,#f59e0b,#fbbf24)'
                        : 'linear-gradient(135deg,#6366f1,#a78bfa)',
                      color: '#fff', fontSize: 13, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {initials(name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: '#1e293b',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>{name}</div>
                      <div style={{
                        fontSize: 11, color: '#94a3b8',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>{u.email}</div>
                    </div>
                    <PermBadge count={pCount} total={totalPerms} isSA={isSuperA} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── RIGHT: Permission Panel ── */}
          <div style={{
            flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
            background: '#f8fafc', overflow: 'hidden'
          }}>
            {!currentUser ? (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', color: '#94a3b8', gap: 12
              }}>
                <div style={{ fontSize: 52, color: '#e2e8f0' }}>☝️</div>
                <div style={{ fontSize: 13.5 }}>Select a user from the left to manage their permissions</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

                {/* selected user header */}
                <div style={{
                  background: '#fff', borderBottom: '1.5px solid #e2e8f0',
                  padding: '13px 18px', display: 'flex', alignItems: 'center',
                  gap: 14, flexShrink: 0, flexWrap: 'wrap'
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg,#6366f1,#a78bfa)',
                    color: '#fff', fontSize: 16, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {initials(displayName(currentUser))}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{displayName(currentUser)}</div>
                    <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>{currentUser.email}</div>
                    {isSA
                      ? <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5,
                        fontWeight: 700, padding: '2px 8px', borderRadius: 10, marginTop: 3,
                        background: 'rgba(245,158,11,.12)', color: '#d97706'
                      }}>
                        👑 Super Admin
                      </span>
                      : <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5,
                        fontWeight: 700, padding: '2px 8px', borderRadius: 10, marginTop: 3,
                        background: 'rgba(99,102,241,.1)', color: '#4f46e5'
                      }}>
                        {grantedCount >= totalPerms ? '🛡 Admin' : '👤 User'}
                      </span>}
                  </div>
                  {/* actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {isSA ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px',
                        borderRadius: 20, background: 'linear-gradient(135deg,#fbbf24,#f59e0b)',
                        color: '#fff', fontSize: 11.5, fontWeight: 700
                      }}>
                        👑 Superadmin — all permissions
                      </span>
                    ) : (
                      <>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5,
                          fontWeight: 600, color: '#64748b'
                        }}>
                          <span>Admin Access</span>
                          <Toggle checked={Number(currentUser.is_admin) === 1} onChange={e => toggleAdmin(e.target.checked)} />
                        </div>
                        <button onClick={() => toggleAllPerms(true)}
                          style={{
                            height: 32, padding: '0 13px', background: '#f0f4ff', color: '#4f46e5',
                            border: '1.5px solid #c7d2fe', borderRadius: 8, fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5
                          }}>
                          ✓ Grant All
                        </button>
                        <button onClick={() => toggleAllPerms(false)}
                          style={{
                            height: 32, padding: '0 13px', background: '#fef2f2', color: '#ef4444',
                            border: '1.5px solid #fecaca', borderRadius: 8, fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5
                          }}>
                          ✕ Revoke All
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* sections + items */}
                <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                  {/* sections list */}
                  <div style={{
                    width: 200, flexShrink: 0, borderRight: '1px solid #e2e8f0',
                    background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden'
                  }}>
                    {/* section filter */}
                    <div style={{ padding: '6px 7px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                      <div style={{ position: 'relative' }}>
                        <span style={{
                          position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)',
                          color: '#94a3b8', fontSize: 11
                        }}>🔍</span>
                        <input className="mp-inp" value={secFilter} onChange={e => setSecFilter(e.target.value)}
                          placeholder="Filter sections..."
                          style={{
                            width: '100%', height: 28, padding: '0 7px 0 22px', border: '1.5px solid #e2e8f0',
                            borderRadius: 7, fontSize: 11.5, fontFamily: 'inherit', background: '#f8fafc', color: '#1e293b'
                          }} />
                      </div>
                    </div>
                    <div className="mp-scroll" style={{ flex: 1, padding: 6 }}>
                      {Object.entries(filteredSections).map(([sec, items]) => {
                        const keys = Object.keys(items);
                        const gCt = isSA ? keys.length : keys.filter(k => currentUser.permissions[k]).length;
                        const icon = SECTION_ICONS[sec] || '📋';
                        const isActive = activeSection === sec;
                        return (
                          <div key={sec} className={`mp-secrow${isActive ? ' active' : ''}`}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px',
                              borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                              color: '#475569', transition: 'background .15s', position: 'relative'
                            }}
                            onClick={() => setActiveSection(sec)}>
                            <span style={{ fontSize: 13, flexShrink: 0 }}>{icon}</span>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {sec}
                            </span>
                            <SecBadge count={gCt} total={keys.length} isSA={isSA} />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* items panel */}
                  <div className="mp-scroll" style={{ flex: 1, minWidth: 0, padding: '14px 16px' }}>
                    {!activeSection || !sections[activeSection] ? (
                      <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                        Select a section on the left
                      </div>
                    ) : (() => {
                      const items = sections[activeSection];
                      const keys = Object.keys(items);
                      const allOn = isSA || keys.every(k => currentUser.permissions[k]);
                      const icon = SECTION_ICONS[activeSection] || '📋';
                      return (
                        <>
                          {/* section title bar */}
                          <div style={{
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between', marginBottom: 12,
                            paddingBottom: 10, borderBottom: '1.5px solid #e2e8f0'
                          }}>
                            <div style={{
                              fontSize: 13, fontWeight: 700, color: '#0f172a',
                              display: 'flex', alignItems: 'center', gap: 7
                            }}>
                              <span>{icon}</span>{activeSection}
                            </div>
                            {!isSA && (
                              <button onClick={() => toggleSection(activeSection, !allOn)}
                                style={{
                                  height: 30, padding: '0 13px', borderRadius: 8, fontSize: 12,
                                  fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                                  display: 'flex', alignItems: 'center', gap: 5, border: '1.5px solid',
                                  background: allOn ? '#fef2f2' : '#f0f4ff',
                                  color: allOn ? '#ef4444' : '#4f46e5',
                                  borderColor: allOn ? '#fecaca' : '#c7d2fe'
                                }}>
                                {allOn ? '✕ Revoke All' : '✓ Grant All'}
                              </button>
                            )}
                          </div>
                          {/* permission items */}
                          {keys.map(k => {
                            const granted = isSA || !!currentUser.permissions[k];
                            const label = items[k];
                            return (
                              <div key={k} className={`mp-pitem${granted ? ' on' : ''}`}
                                style={{
                                  display: 'flex', alignItems: 'center',
                                  justifyContent: 'space-between', padding: '10px 13px',
                                  marginBottom: 6
                                }}>
                                <div style={{
                                  display: 'flex', alignItems: 'center', gap: 9,
                                  fontSize: 13, fontWeight: 500, color: granted ? '#1e293b' : '#475569'
                                }}>
                                  <span style={{ fontSize: 12, color: granted ? '#4f46e5' : '#e2e8f0' }}>●</span>
                                  {label}
                                </div>
                                <Toggle checked={granted} disabled={isSA}
                                  onChange={e => !isSA && togglePerm(k, e.target.checked)} />
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
      {/* ══ SEARCH RESULTS MODAL ══ */}
      {showSearchModal && (() => {
        const q = modalFilter.trim().toLowerCase();
        const filteredList = q
          ? searchResults.filter(u =>
            displayName(u).toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q))
          : searchResults;

        return (
          <div
            onClick={() => setShowSearchModal(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 9999, padding: 20, backdropFilter: 'blur(3px)',
              animation: 'mp_fadeIn .15s ease-out'
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="mp-root"
              style={{
                background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480,
                maxHeight: '75vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 60px rgba(0,0,0,.3)', overflow: 'hidden',
                animation: 'mp_slideUp .2s ease-out'
              }}
            >
              {/* header */}
              <div style={{
                padding: '14px 18px', borderBottom: '1.5px solid #e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexShrink: 0
              }}>
                <div>
                  <div style={{
                    fontSize: 14, fontWeight: 800, color: '#0f172a',
                    display: 'flex', alignItems: 'center', gap: 7
                  }}>
                    🔍 Search Results
                  </div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                    {filteredList.length} of {searchResults.length} user(s) for "{searchQ}"
                  </div>
                </div>
                <button
                  onClick={() => setShowSearchModal(false)}
                  style={{
                    width: 30, height: 30, border: 'none', background: '#f1f5f9',
                    borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#64748b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'inherit', fontWeight: 700
                  }}
                >
                  ✕
                </button>
              </div>

              {/* local filter input */}
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    color: '#94a3b8', fontSize: 12
                  }}>🔍</span>
                  <input
                    className="mp-inp"
                    autoFocus
                    value={modalFilter}
                    onChange={e => setModalFilter(e.target.value)}
                    placeholder="Filter users in this list..."
                    style={{
                      width: '100%', height: 34, padding: '0 12px 0 32px',
                      border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5,
                      fontFamily: 'inherit', background: '#f8fafc', color: '#1e293b'
                    }}
                  />
                </div>
              </div>

              {/* list */}
              <div className="mp-scroll" style={{ flex: 1, padding: 8, overflowY: 'auto' }}>
                {filteredList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: 12 }}>
                    No users match "{modalFilter}"
                  </div>
                ) : filteredList.map(u => {
                  const name = displayName(u);
                  const isSuperA = parseInt(u.is_superadmin) === 1;
                  const alreadyInList = adminUsers.some(a => a.user_id == u.user_id);
                  return (
                    <div
                      key={u.user_id}
                      className="mp-urow"
                      onClick={() => pickSearchUser(u)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 11,
                        padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
                        transition: 'background .15s', position: 'relative'
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: isSuperA
                          ? 'linear-gradient(135deg,#f59e0b,#fbbf24)'
                          : 'linear-gradient(135deg,#6366f1,#a78bfa)',
                        color: '#fff', fontSize: 14, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {initials(name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 600, color: '#1e293b',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>{name}</div>
                        <div style={{
                          fontSize: 11, color: '#94a3b8',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>{u.email}</div>
                      </div>
                      {alreadyInList ? (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '3px 9px',
                          borderRadius: 10, background: '#dcfce7', color: '#16a34a',
                          flexShrink: 0
                        }}>✓ In list</span>
                      ) : (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '3px 9px',
                          borderRadius: 10, background: '#eef2ff', color: '#4f46e5',
                          flexShrink: 0
                        }}>+ Add</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}