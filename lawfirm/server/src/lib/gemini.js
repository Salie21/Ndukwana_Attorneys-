import { GoogleGenAI } from '@google/genai';

// One shared client. The key only ever lives on the server (GEMINI_API_KEY in .env).
let client;
const ai = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));

export const geminiEnabled = () => Boolean(process.env.GEMINI_API_KEY);
export const GEMINI_MODEL = () => process.env.GEMINI_MODEL || 'gemini-3.8-flash';

const text = (t) => [{ type: 'text', text: t }];

// Stateless multi-turn call using the Interactions API. We keep history in the browser,
// so store:false and every turn is sent again as steps.
export async function chatWithGemini({ system, messages, temperature = 0.3 }) {
  const steps = messages.map((m) => (m.role === 'user'
    ? { type: 'user_input', content: text(m.text) }
    : { type: 'model_output', content: text(m.text) }));
  const base = { model: GEMINI_MODEL(), system_instruction: system, store: false, generation_config: { temperature } };
  try {
    const out = await ai().interactions.create({ ...base, input: steps });
    if (out.output_text?.trim()) return out.output_text.trim();
  } catch (e) {
    console.error('Gemini structured call failed, retrying as transcript:', e.status || e.name);
  }
  // Fallback: flatten the conversation into one prompt so a history-format change never breaks the chat.
  const transcript = messages.map((m) => `${m.role === 'user' ? 'Visitor' : 'Assistant'}: ${m.text}`).join('\n');
  const out = await ai().interactions.create({ ...base, input: `${transcript}\nAssistant:` });
  return out.output_text?.trim() || '';
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
