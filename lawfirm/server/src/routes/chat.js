import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { ah, parse } from '../lib/http.js';
import { SYSTEM_PROMPT } from '../knowledge.js';

const r = Router();
const limiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 25, standardHeaders: true, legacyHeaders: false, message: { error: 'You are sending messages very quickly. Please wait a moment.' } });

const FALLBACK = 'I am having trouble answering right now. Please use the Contact page, the WhatsApp button, or call +27 79 628 7607 and the team will help you.';

// Tiny in-memory cache so repeated common questions do not burn the free Gemini quota.
const cache = new Map();
const CACHE_MAX = 200; const CACHE_MS = 60 * 60 * 1000;

r.post('/', limiter, ah(async (req, res) => {
  const { messages } = parse(z.object({
    messages: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().trim().min(1).max(500) })).min(1).max(8),
  }), req.body);
  if (messages.at(-1).role !== 'user') return res.status(400).json({ error: 'Last message must be from the user.' });

  const key = messages.length === 1 ? messages[0].text.toLowerCase().replace(/\s+/g, ' ') : null;
  const hit = key && cache.get(key);
  if (hit && hit.exp > Date.now()) return res.json({ reply: hit.reply });

  if (!process.env.GEMINI_API_KEY) return res.json({ reply: FALLBACK, fallback: true });
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
        generationConfig: { temperature: 0.3, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!resp.ok) { console.error('Gemini error', resp.status); return res.json({ reply: FALLBACK, fallback: true }); }
    const data = await resp.json();
    const reply = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
    if (!reply) return res.json({ reply: FALLBACK, fallback: true });
    if (key) { if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value); cache.set(key, { reply, exp: Date.now() + CACHE_MS }); }
    res.json({ reply });
  } catch (e) {
    console.error('Gemini request failed:', e.name);
    res.json({ reply: FALLBACK, fallback: true });
  }
}));

export default r;
