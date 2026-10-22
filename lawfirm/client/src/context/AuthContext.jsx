import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [themeOverride, setThemeOverride] = useState(() => { try { return localStorage.getItem('theme') || ''; } catch { return ''; } });

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u);
    if (!u) { setRole(null); setProfile(null); setLoading(false); return; }
    const t = await u.getIdTokenResult();
    setRole(t.claims.role || null); setLoading(false);
  }), []);

  // Live profile once the account has a role.
  useEffect(() => {
    if (!user || !role) { setProfile(null); return undefined; }
    return onSnapshot(doc(db, 'users', user.uid), (s) => setProfile(s.exists() ? { id: user.uid, ...s.data() } : null), () => setProfile(null));
  }, [user, role]);

  // A locally chosen theme applies immediately; saved profile settings provide the initial choice.
  const theme = themeOverride || profile?.prefs?.theme || (role === 'staff' || role === 'admin' ? 'dark' : 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeOverride(next);
    try { localStorage.setItem('theme', next); } catch { /* storage unavailable */ }
  }, []);

  // Call after the server sets a new role claim so the browser picks it up immediately.
  const refresh = useCallback(async () => {
    const u = auth.currentUser; if (!u) return null;
    await u.getIdToken(true);
    const t = await u.getIdTokenResult();
    setRole(t.claims.role || null); return t.claims.role || null;
  }, []);

  const value = useMemo(() => ({ user, role, profile, loading, refresh, theme, setTheme, logout: () => signOut(auth) }), [user, role, profile, loading, refresh, theme, setTheme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
