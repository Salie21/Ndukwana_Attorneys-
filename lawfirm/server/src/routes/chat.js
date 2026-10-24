import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { ah, parse } from '../lib/http.js';
import { SYSTEM_PROMPT } from '../knowledge.js';
import { chatWithGemini, errorKind, geminiEnabled, GEMINI_MODEL } from '../lib/gemini.js';
import { LANGUAGES, LANGUAGE_CODES } from '../languages.js';

const r = Router();
const limiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 25, standardHeaders: true, legacyHeaders: false, message: { error: 'You are sending messages very quickly. Please wait a moment.' } });

// Open /api/chat/health in a browser to see whether the chatbot can reach Gemini. Never reveals the key.
r.get('/health', rateLimit({ windowMs: 60 * 1000, limit: 6, standardHeaders: true, legacyHeaders: false }), ah(async (_req, res) => {
  if (!geminiEnabled()) return res.json({ ok: false, configured: false, problem: 'GEMINI_API_KEY is not set on the server.' });
  try {
    const { via } = await chatWithGemini({ system: 'Reply with the single word OK.', messages: [{ role: 'user', text: 'Ping' }] });
    res.json({ ok: true, configured: true, model: GEMINI_MODEL(), via });
  } catch (e) {
    res.json({ ok: false, configured: true, model: GEMINI_MODEL(), problem: errorKind(e) });
  }
}));

const FALLBACK = 'I am having trouble answering right now. Please use the Contact page, the WhatsApp button, or call +27 79 628 7607 and the team will help you.';

// Tiny in-memory cache so repeated common questions do not burn the free Gemini quota.
const cache = new Map();
const CACHE_MAX = 200; const CACHE_MS = 60 * 60 * 1000;

r.post('/', limiter, ah(async (req, res) => {
  const { messages, language } = parse(z.object({
    messages: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().trim().min(1).max(500) })).min(1).max(8),
    language: z.enum(LANGUAGE_CODES).default('en'),
  }), req.body);
  if (messages.at(-1).role !== 'user') return res.status(400).json({ error: 'Last message must be from the user.' });

  const key = messages.length === 1 ? `${language}|${messages[0].text.toLowerCase().replace(/\s+/g, ' ')}` : null;
  const hit = key && cache.get(key);
  if (hit && hit.exp > Date.now()) return res.json({ reply: hit.reply });

  if (!geminiEnabled()) return res.json({ reply: FALLBACK, fallback: true });

  // The visitor's chosen site language decides the reply language, but they can still write in any language.
  const langName = LANGUAGES[language];
  const system = language === 'en' || language === 'sasl'
    ? SYSTEM_PROMPT
    : `${SYSTEM_PROMPT}\n\nLANGUAGE: Reply in ${langName} unless the visitor clearly writes in a different language, in which case reply in theirs. Keep phone numbers, emails and the firm name exactly as written.`;

  try {
    const { reply } = await chatWithGemini({ system, messages });
    if (!reply) return res.json({ reply: FALLBACK, fallback: true });
    if (key) { if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value); cache.set(key, { reply, exp: Date.now() + CACHE_MS }); }
    res.json({ reply });
  } catch (e) {
    console.error('Gemini request failed:', e.status || e.name, e.message);
    res.json({ reply: FALLBACK, fallback: true });
  }
}));

export default r;
