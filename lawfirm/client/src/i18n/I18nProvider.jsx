import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import en from './en';
import zu from './zu';
import xh from './xh';
import af from './af';
import { LANGUAGE_CODES, htmlLang } from './languages';

// Languages written by hand ship with the app. Everything else is translated once by Gemini on the
// server (POST /api/translate), then cached in this browser so it loads instantly next time.
const STATIC = { en, zu, xh, af };
const KEYS = Object.keys(en);
const ITEMS = KEYS.map((k) => en[k]);
// Changing any English text changes this value, which invalidates old cached translations.
const VERSION = (() => { let h = 0; for (const s of ITEMS) for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); })();
const cacheKey = (lang) => `i18n:${VERSION}:${lang}`;

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

const Ctx = createContext({ lang: 'en', setLang: () => {}, t: (k) => en[k] ?? k, status: 'ready' });
export const useI18n = () => useContext(Ctx);
export const useT = () => useContext(Ctx).t;

export function I18nProvider({ children }) {
  const { user, profile } = useAuth();
  const [lang, setLangState] = useState(() => { const s = read('lang'); return LANGUAGE_CODES.includes(s) ? s : 'en'; });
  const [remote, setRemote] = useState({});
  const [status, setStatus] = useState('ready'); // ready | loading | failed

  // Signed-in people keep their language across devices: use the saved choice if this browser has none.
  useEffect(() => {
    const saved = profile?.prefs?.language;
    if (saved && LANGUAGE_CODES.includes(saved) && !read('lang')) setLangState(saved);
  }, [profile?.prefs?.language]);

  useEffect(() => { document.documentElement.lang = htmlLang(lang); }, [lang]);

  useEffect(() => {
    if (STATIC[lang] || lang === 'sasl' || remote[lang]) { setStatus('ready'); return undefined; }
    const cached = read(cacheKey(lang));
    if (cached) {
      try { const arr = JSON.parse(cached); if (arr.length === KEYS.length) { setRemote((r) => ({ ...r, [lang]: Object.fromEntries(KEYS.map((k, i) => [k, arr[i]])) })); setStatus('ready'); return undefined; } } catch { /* fall through and fetch */ }
    }
    let cancelled = false;
    setStatus('loading');
    api('/translate', { method: 'POST', body: { language: lang, items: ITEMS }, auth: false })
      .then(({ translations }) => {
        if (cancelled || !Array.isArray(translations) || translations.length !== KEYS.length) throw new Error('bad translation');
        write(cacheKey(lang), JSON.stringify(translations));
        setRemote((r) => ({ ...r, [lang]: Object.fromEntries(KEYS.map((k, i) => [k, translations[i]])) }));
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('failed'); });
    return () => { cancelled = true; };
  }, [lang, remote]);

  const setLang = useCallback((code) => {
    if (!LANGUAGE_CODES.includes(code)) return;
    setLangState(code);
    write('lang', code);
    if (user) api('/profile/me', { method: 'PATCH', body: { prefs: { language: code } } }).catch(() => { /* the choice still works locally */ });
  }, [user]);

  const t = useCallback((key, vars) => {
    const dict = STATIC[lang] || remote[lang];
    let s = dict?.[key] ?? en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  }, [lang, remote]);

  const value = useMemo(() => ({ lang, setLang, t, status }), [lang, setLang, t, status]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
