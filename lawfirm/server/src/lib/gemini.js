import { GoogleGenAI } from '@google/genai';

// One shared client. The key only ever lives on the server (GEMINI_API_KEY in .env).
let client;
const ai = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));

export const geminiEnabled = () => Boolean(process.env.GEMINI_API_KEY);
export const GEMINI_MODEL = () => process.env.GEMINI_MODEL || 'gemini-3.8-flash';

const text = (t) => [{ type: 'text', text: t }];

// Chat with Gemini. Tries, in order:
//   1. Interactions API with proper history steps
//   2. Interactions API with the history flattened into one prompt
//   3. Classic generateContent (gemini-2.5-flash) as a safety net
// so one unsupported model name or request shape never takes the whole chatbot down.
const CLASSIC_MODEL = () => process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash';

export async function chatWithGemini({ system, messages, temperature = 0.3 }) {
  const base = { model: GEMINI_MODEL(), system_instruction: system, store: false, generation_config: { temperature } };
  const steps = messages.map((m) => (m.role === 'user'
    ? { type: 'user_input', content: text(m.text) }
    : { type: 'model_output', content: text(m.text) }));
  const transcript = `${messages.map((m) => `${m.role === 'user' ? 'Visitor' : 'Assistant'}: ${m.text}`).join('\n')}\nAssistant:`;

  const attempts = [
    ['interactions', async () => (await ai().interactions.create({ ...base, input: steps })).output_text],
    ['interactions-transcript', async () => (await ai().interactions.create({ ...base, input: transcript })).output_text],
    ['generateContent', async () => (await ai().models.generateContent({
      model: CLASSIC_MODEL(),
      contents: messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
      config: { systemInstruction: system, temperature, maxOutputTokens: 600, thinkingConfig: { thinkingBudget: 0 } },
    })).text],
  ];
  let lastError;
  for (const [via, run] of attempts) {
    try {
      const reply = (await run())?.trim();
      if (reply) return { reply, via };
    } catch (e) {
      lastError = e;
      console.error(`Gemini ${via} failed:`, e.status || e.name, String(e.message || '').slice(0, 200));
    }
  }
  const err = new Error(lastError?.message || 'No reply from Gemini');
  err.status = lastError?.status;
  throw err;
}

// Short, safe category for a Gemini failure (never includes keys or raw provider text).
export function errorKind(e) {
  const s = Number(e?.status);
  if (s === 400 || s === 401 || s === 403) return 'key_rejected';
  if (s === 404) return 'model_not_found';
  if (s === 429) return 'quota_exceeded';
  return 'error';
}

// Returns an array of strings, the same length and order as `items`, translated into `languageName`.
export async function translateStrings({ languageName, items }) {
  const schema = {
    type: 'object',
    properties: { translations: { type: 'array', items: { type: 'string' } } },
    required: ['translations'],
  };
  const system = `You are a professional translator for the website of a South African law firm. Translate every string from English into ${languageName}.
Rules: keep the same number and order of strings; keep proper nouns (Ndukwana, Johannesburg, WhatsApp, FICA, LLB) unchanged; keep placeholders like {name} or {count} exactly as written; use natural, polite, plain wording a client would understand; do not add explanations. Return JSON only.`;
  const out = await ai().interactions.create({
    model: GEMINI_MODEL(),
    system_instruction: system,
    input: JSON.stringify(items),
    store: false,
    generation_config: { temperature: 0.1 },
    response_format: { type: 'text', mime_type: 'application/json', schema },
  });
  const parsed = JSON.parse(out.output_text);
  if (!Array.isArray(parsed.translations) || parsed.translations.length !== items.length) throw new Error('translation length mismatch');
  return parsed.translations.map((s, i) => (typeof s === 'string' && s.trim() ? s : items[i]));
}
