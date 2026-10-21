export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// zod parse -> 400 with a short, safe message
export function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new HttpError(400, `${first.path.join('.') || 'request'}: ${first.message}`);
  }
  return r.data;
}
