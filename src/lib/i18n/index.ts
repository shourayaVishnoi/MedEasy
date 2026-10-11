/**
 * Translation scaffold. Strings are looked up by key with English fallback, so
 * a new language is added by dropping in a dictionary – no component rewrites.
 * Clinical values, units and test names are never translated.
 */
import en from "./en.json";
import hi from "./hi.json";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi) – partial" },
];

const DICTS: Record<string, Record<string, string>> = { en, hi };

export function t(key: keyof typeof en, lang = "en", vars: Record<string, string | number> = {}): string {
  const s = DICTS[lang]?.[key] ?? en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
