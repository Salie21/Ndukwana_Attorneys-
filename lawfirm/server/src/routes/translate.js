import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { ah, parse } from '../lib/http.js';
import { geminiEnabled, translateStrings } from '../lib/gemini.js';
import { LANGUAGES, LANGUAGE_CODES } from '../languages.js';

// Translates the site's interface text (never user data) into a South African language.
// Results are cached per language + content, so Gemini is called once per language per site update.
const r = Router();
const limiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many translation requests. Please try again later.' } });
const cache = new Map();

r.post('/', limiter, ah(async (req, res) => {
  const { language, items } = parse(z.object({
    language: z.enum(LANGUAGE_CODES),
    items: z.array(z.string().max(500)).min(1).max(250),
  }), req.body);

  if (language === 'en' || language === 'sasl') return res.json({ translations: items });
  if (!geminiEnabled()) return res.status(503).json({ error: 'Translation is not available right now.' });

  const key = `${language}|${items.join('\u0001')}`;
  const hit = cache.get(key);
  if (hit) return res.json({ translations: hit });

  try {
    const translations = await translateStrings({ languageName: LANGUAGES[language], items });
    cache.set(key, translations);
    if (cache.size > 40) cache.delete(cache.keys().next().value);
    res.json({ translations });
  } catch (e) {
    console.error('Translate failed:', e.status || e.name, e.message);
    res.status(502).json({ error: 'Translation failed. The page will stay in English for now.' });
  }
}));

export default r;
