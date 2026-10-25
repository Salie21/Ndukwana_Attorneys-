// South Africa's official languages. Each is listed under its own name so people can always find theirs.
// SASL (South African Sign Language) became the 12th official language in 2023. It has no written
// form, so choosing it keeps the on-screen text in English.
// `locale` controls how dates and times are written.
export const LANGUAGES = [
  { code: 'en', native: 'English', locale: 'en-ZA' },
  { code: 'zu', native: 'isiZulu', locale: 'zu-ZA' },
  { code: 'xh', native: 'isiXhosa', locale: 'xh-ZA' },
  { code: 'af', native: 'Afrikaans', locale: 'af-ZA' },
  { code: 'nso', native: 'Sepedi', locale: 'nso-ZA' },
  { code: 'tn', native: 'Setswana', locale: 'tn-ZA' },
  { code: 'st', native: 'Sesotho', locale: 'st-ZA' },
  { code: 'ts', native: 'Xitsonga', locale: 'ts-ZA' },
  { code: 'ss', native: 'siSwati', locale: 'ss-ZA' },
  { code: 've', native: 'Tshivenda', locale: 've-ZA' },
  { code: 'nr', native: 'isiNdebele', locale: 'nr-ZA' },
  { code: 'sasl', native: 'South African Sign Language (SASL)', locale: 'en-ZA' },
];
export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);
export const localeFor = (code) => LANGUAGES.find((l) => l.code === code)?.locale || 'en-ZA';
// Value for <html lang>. SASL text is English.
export const htmlLang = (code) => (code === 'sasl' ? 'en' : code);
