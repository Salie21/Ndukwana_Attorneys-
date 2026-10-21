import { put, get, del } from '@vercel/blob';
import { HttpError } from './http.js';

// Primary document store: a PRIVATE Vercel Blob store. The browser only ever receives files
// through our authenticated download route. Vercel deployments use SDK OIDC; local and other
// hosting environments use BLOB_READ_WRITE_TOKEN.
export const blobEnabled = () => Boolean(
  process.env.BLOB_READ_WRITE_TOKEN ||
  (process.env.VERCEL === '1' && process.env.BLOB_STORE_ID),
);

export async function saveBlob(pathname, buffer, contentType) {
  if (!blobEnabled()) throw new HttpError(503, 'Document storage is not configured yet. Please contact the firm.');
  const r = await put(pathname, buffer, { access: 'private', contentType, addRandomSuffix: true });
  return { url: r.url, pathname: r.pathname };
}

export async function readBlob(pathname) {
  const r = await get(pathname, { access: 'private' });
  if (!r || r.statusCode !== 200) throw new HttpError(404, 'File not found.');
  return r; // { stream, blob: { contentType, ... } }
}

export const removeBlob = (url) => del(url);
