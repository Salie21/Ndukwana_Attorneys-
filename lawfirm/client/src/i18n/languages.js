// South Africa's official languages. Each is listed under its own name so people can always find theirs.
// SASL (South African Sign Language) became the 12th official language in 2023. It has no written
// form, so choosing it keeps the on-screen text in English.
export const LANGUAGES = [
  { code: 'en', native: 'English' },
  { code: 'zu', native: 'isiZulu' },
  { code: 'xh', native: 'isiXhosa' },
  { code: 'af', native: 'Afrikaans' },
  { code: 'nso', native: 'Sepedi' },
  { code: 'tn', native: 'Setswana' },
  { code: 'st', native: 'Sesotho' },
  { code: 'ts', native: 'Xitsonga' },
  { code: 'ss', native: 'siSwati' },
  { code: 've', native: 'Tshivenda' },
  { code: 'nr', native: 'isiNdebele' },
  { code: 'sasl', native: 'South African Sign Language (SASL)' },
];
export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);
// Value for <html lang>. SASL text is English.
export const htmlLang = (code) => (code === 'sasl' ? 'en' : code);
