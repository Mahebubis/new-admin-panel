// import { createContext, useContext, useState, useEffect, useCallback } from 'react';
// import api from '../api/axios';

// const AuthContext = createContext(null);

// export function AuthProvider({ children }) {
//   const [user, setUser] = useState(() => {
//     const saved = localStorage.getItem('user');
//     return saved ? JSON.parse(saved) : null;
//   });
//   const [token, setToken] = useState(() => localStorage.getItem('token'));
//   const [loading, setLoading] = useState(false);

//   const isAuthenticated = !!token && !!user;

//   const login = useCallback(async (email, password) => {
//     const res = await api.post('/api/auth/send-otp.php', { email, password });
//     return res.data;
//   }, []);

//   const verifyOtp = useCallback(async (email, otp) => {
//     const res = await api.post('/api/auth/verify-otp.php', { email, otp });
//     if (res.data.success) {
//       const { token: jwt, user: userData } = res.data.data;
//       setToken(jwt);
//       setUser(userData);
//       localStorage.setItem('token', jwt);
//       localStorage.setItem('user', JSON.stringify(userData));
//     }
//     return res.data;
//   }, []);

//   const resendOtp = useCallback(async (email) => {
//     const res = await api.post('/api/auth/resend-otp.php', { email });
//     return res.data;
//   }, []);

//   const logout = useCallback(async () => {
//     try { await api.post('/api/auth/logout.php'); } catch {}
//     setToken(null);
//     setUser(null);
//     localStorage.removeItem('token');
//     localStorage.removeItem('user');
//   }, []);

//   const refreshUser = useCallback(async () => {
//     if (!token) return;
//     try {
//       const res = await api.get('/api/auth/me.php');
//       if (res.data.success) {
//         setUser(res.data.data.user);
//         localStorage.setItem('user', JSON.stringify(res.data.data.user));
//       }
//     } catch { /* handled by interceptor */ }
//   }, [token]);

//   const hasPermission = useCallback((key) => {
//     if (!user?.permissions) return false;
//     if (user.permissions.includes('__superadmin__')) return true;
//     if (key === 'dashboard') return true;
//     return user.permissions.includes(key);
//   }, [user]);

//   return (
//     <AuthContext.Provider value={{
//       user, token, loading, isAuthenticated,
//       login, verifyOtp, resendOtp, logout, refreshUser, hasPermission,
//     }}>
//       {children}
//     </AuthContext.Provider>
//   );
// }

// export function useAuth() {
//   const ctx = useContext(AuthContext);
//   if (!ctx) throw new Error('useAuth must be used within AuthProvider');
//   return ctx;
// }


import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

/* ──────────────────────────────────────────────────────────
   Normalize permissions from backend into a clean string[]
   Accepts:
     - array: ["dashboard","all_students"]
     - object map: { dashboard: true, all_students: 1 }
     - string: "dashboard,all_students"
     - null / undefined
   Always returns: string[]
   ────────────────────────────────────────────────────────── */
function normalizePerms(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === 'string') {
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (typeof raw === 'object') {
    return Object.keys(raw).filter(k => !!raw[k]);
  }
  return [];
}

function normalizeUser(u) {
  if (!u) return null;
  return {
    ...u,
    permissions: normalizePerms(u.permissions),
    is_admin: !!u.is_admin,
    is_superadmin: !!u.is_superadmin,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? normalizeUser(JSON.parse(saved)) : null;
    } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);

  const isAuthenticated = !!token && !!user;

  const persist = (u) => {
    const norm = normalizeUser(u);
    setUser(norm);
    localStorage.setItem('user', JSON.stringify(norm));
  };

  const login = useCallback(async (email, password) => {
    const res = await api.post('/api/auth/send-otp.php', { email, password });
    return res.data;
  }, []);

  /* Used when send-otp returns a token directly (bypass_otp = 1) */
  const loginDirect = useCallback((payload) => {
    const { token: jwt, user: userData } = payload || {};
    if (jwt) {
      setToken(jwt);
      localStorage.setItem('token', jwt);
    }
    if (userData) persist(userData);
  }, []);

  const verifyOtp = useCallback(async (email, otp) => {
    const res = await api.post('/api/auth/verify-otp.php', { email, otp });
    if (res.data?.success) {
      const { token: jwt, user: userData } = res.data.data || {};
      if (jwt) {
        setToken(jwt);
        localStorage.setItem('token', jwt);
      }
      persist(userData);
    }
    return res.data;
  }, []);

  const resendOtp = useCallback(async (email) => {
    const res = await api.post('/api/auth/resend-otp.php', { email });
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/api/auth/logout.php'); } catch { /* ignore */ }
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/api/auth/me.php');
      if (res.data?.success) persist(res.data.data.user);
    } catch { /* handled by interceptor */ }
  }, [token]);

  const isSuperadmin = !!user && (
    user.is_superadmin === true ||
    (Array.isArray(user.permissions) && user.permissions.includes('__superadmin__'))
  );

  const isAdmin = !!user && (isSuperadmin || !!user.is_admin);

  const hasPermission = useCallback((key) => {
    if (!user) return false;
    if (isSuperadmin) return true;
    if (!key) return true;
    if (key === 'dashboard') return true; // dashboard is open to everyone
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    return perms.includes(key);
  }, [user, isSuperadmin]);

  useEffect(() => {
  if (token) {
    refreshUser();
  }
}, [token]);

  return (
    <AuthContext.Provider value={{
      user, token, loading, isAuthenticated,
      isAdmin, isSuperadmin,
      login, loginDirect, verifyOtp, resendOtp, logout, refreshUser, hasPermission,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}