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
  const [theme, setThemeState] = useState(() => { try { return localStorage.getItem('theme') || 'light'; } catch { return 'light'; } });

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

  // Theme: saved preference wins, otherwise the team portal is dark and everything else is light.
  useEffect(() => {
    const pref = profile?.prefs?.theme || (role === 'staff' || role === 'admin' ? 'dark' : null);
    const t = pref || theme;
    document.documentElement.dataset.theme = t;
    try { if (pref) localStorage.setItem('theme', pref); } catch { /* storage unavailable */ }
  }, [profile?.prefs?.theme, role, theme]);

  // Call after the server sets a new role claim so the browser picks it up immediately.
  const refresh = useCallback(async () => {
    const u = auth.currentUser; if (!u) return null;
    await u.getIdToken(true);
    const t = await u.getIdTokenResult();
    setRole(t.claims.role || null); return t.claims.role || null;
  }, []);

  const value = useMemo(() => ({ user, role, profile, loading, refresh, setTheme: setThemeState, logout: () => signOut(auth) }), [user, role, profile, loading, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
