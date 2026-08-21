// ===========================================================================
//  AuthContext.jsx — who is signed in, and how they got here.
//
//  Boot order matters and is deliberate:
//    1. A ?sso=&sig= pair in the URL always wins — the learner has just come
//       from the dashboard and expects to land inside, not on a login form.
//    2. Otherwise an existing PHP session is used (auth.php?action=session),
//       which also re-checks that a handoff session is still same-day.
//    3. Otherwise the day's cookie is replayed, covering a refresh after the
//       URL was scrubbed in step 1.
//    4. Otherwise: signed out.
// ===========================================================================
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setUnauthorizedHandler } from '../lib/api';
import { clearPass, readPass, takePassFromUrl, writePass } from '../lib/handoffCookie';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [method, setMethod] = useState(null);
  const [booting, setBooting] = useState(true);
  const [notice, setNotice] = useState('');
  /* Where the handoff wanted the learner to land, consumed once by App. */
  const [landing, setLanding] = useState(null);
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;      // StrictMode double-invoke guard
    booted.current = true;

    (async () => {
      const fromUrl = takePassFromUrl();

      if (fromUrl) {
        try {
          const d = await api.handoff(fromUrl.id, fromUrl.sig);
          writePass(fromUrl.id, fromUrl.sig);
          setUser(d.user);
          setMethod('handoff');
          if (fromUrl.courseId) {
            setLanding({ courseId: fromUrl.courseId, lessonId: fromUrl.lessonId });
          }
          setBooting(false);
          return;
        } catch (e) {
          /* An expired or tampered link falls through to the normal checks,
             with the reason kept so the login screen can explain itself. */
          clearPass();
          setNotice(e.message);
        }
      }

      try {
        const d = await api.session();
        if (d.authenticated) {
          setUser(d.user);
          setMethod(d.method);
          setBooting(false);
          return;
        }
        if (d.expired) { clearPass(); setNotice(d.message || ''); }
      } catch {
        /* server unreachable — fall through, the login screen will say so */
      }

      const pass = readPass();
      if (pass) {
        try {
          const d = await api.handoff(pass.id, pass.sig);
          setUser(d.user);
          setMethod('handoff');
          setBooting(false);
          return;
        } catch (e) {
          clearPass();
          setNotice(e.message);
        }
      }

      setBooting(false);
    })();
  }, []);

  /* Any guarded endpoint answering 401 means the session died under us —
     an expired handoff, a server restart, a cleared cookie. Drop the local
     user so the router falls back to the login screen instead of leaving a
     signed-in header over a wall of failing requests. */
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearPass();
      setUser(null);
      setMethod(null);
      setNotice('Your session ended. Please sign in again.');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await api.login(email, password);
    setUser(d.user);
    setMethod('password');
    setNotice('');
    return d.user;
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    const d = await api.google(credential);
    setUser(d.user);
    setMethod('google');
    setNotice('');
    return d.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* signing out locally still has to work */ }
    clearPass();
    setUser(null);
    setMethod(null);
  }, []);

  const takeLanding = useCallback(() => {
    setLanding((l) => (l ? null : l));
    return landing;
  }, [landing]);

  const value = useMemo(
    () => ({ user, method, booting, notice, setNotice, login, loginWithGoogle, logout, landing, takeLanding }),
    [user, method, booting, notice, login, loginWithGoogle, logout, landing, takeLanding]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
