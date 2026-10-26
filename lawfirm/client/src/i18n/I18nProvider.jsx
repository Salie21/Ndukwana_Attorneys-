import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { setFormatLocale } from '../lib/format';
import en from './en';
import zu from './zu';
import xh from './xh';
import af from './af';
import nso from './nso';
import tn from './tn';
import st from './st';
import ts from './ts';
import ss from './ss';
import ve from './ve';
import nr from './nr';
import { LANGUAGE_CODES, htmlLang, localeFor } from './languages';

// Every language ships inside the app, so switching language is instant and needs no server.
// Anything missing from a language falls back to English rather than showing a blank or a key.
// South African Sign Language has no written form, so it shows the English text.
const DICTS = { en, zu, xh, af, nso, tn, st, ts, ss, ve, nr, sasl: en };

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

const Ctx = createContext({ lang: 'en', setLang: () => {}, t: (k) => en[k] ?? k });
export const useI18n = () => useContext(Ctx);
export const useT = () => useContext(Ctx).t;

export function I18nProvider({ children }) {
  const { user, profile } = useAuth();
  const [lang, setLangState] = useState(() => { const s = read('lang'); return LANGUAGE_CODES.includes(s) ? s : 'en'; });

  // Dates and times are written in the chosen language too. Set during render so children see it straight away.
  setFormatLocale(localeFor(lang));

  // Signed-in people keep their language across devices: use the saved choice if this browser has none.
  useEffect(() => {
    const saved = profile?.prefs?.language;
    if (saved && LANGUAGE_CODES.includes(saved) && !read('lang')) setLangState(saved);
  }, [profile?.prefs?.language]);

  useEffect(() => { document.documentElement.lang = htmlLang(lang); }, [lang]);

  const setLang = useCallback((code) => {
    if (!LANGUAGE_CODES.includes(code)) return;
    setLangState(code);
    write('lang', code);
    if (user) api('/profile/me', { method: 'PATCH', body: { prefs: { language: code } } }).catch(() => { /* the choice still works locally */ });
  }, [user]);

  const t = useCallback((key, vars) => {
    let s = DICTS[lang]?.[key] ?? en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
