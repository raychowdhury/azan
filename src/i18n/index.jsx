import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from './en.json';
import ar from './ar.json';

// Lightweight in-house i18n. No runtime dependency. Add new locales by:
// 1. Drop {locale}.json next to en.json with the same keys.
// 2. Register it in CATALOGS + LANGUAGES below.
// Future locales planned: bn, ur, id, tr, fr, ms.

const CATALOGS = { en, ar };

export const LANGUAGES = [
  { id: 'en', label: 'English',  nativeLabel: 'English', dir: 'ltr' },
  { id: 'ar', label: 'Arabic',   nativeLabel: 'العربية', dir: 'rtl' },
];

const STORAGE_KEY = 'lang';
const I18nContext = createContext(null);

function detectInitialLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && CATALOGS[stored]) return stored;
  } catch {}
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en') || 'en';
  return nav.startsWith('ar') ? 'ar' : 'en';
}

function format(template, vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? `{${key}}`));
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(detectInitialLanguage);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
    const meta = LANGUAGES.find(l => l.id === lang) ?? LANGUAGES[0];
    document.documentElement.setAttribute('lang', meta.id);
    document.documentElement.setAttribute('dir', meta.dir);
  }, [lang]);

  const t = useCallback((key, vars) => {
    const catalog = CATALOGS[lang] ?? CATALOGS.en;
    const value = catalog[key] ?? CATALOGS.en[key] ?? key;
    return format(value, vars);
  }, [lang]);

  const value = useMemo(() => ({
    lang,
    setLang,
    t,
    languages: LANGUAGES,
    dir: (LANGUAGES.find(l => l.id === lang) ?? LANGUAGES[0]).dir,
  }), [lang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used inside <I18nProvider>');
  return ctx;
}
