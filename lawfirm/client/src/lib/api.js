import { auth } from '../firebase';

const BASE = import.meta.env.VITE_API_URL || '';
const IS_PROD = import.meta.env.PROD;

// Every call carries the user's Firebase ID token. The server verifies it and decides what is allowed.
export async function api(path, { method = 'GET', body, form, raw = false, auth: needsAuth = true } = {}) {
  const headers = {};
  if (needsAuth) {
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in to continue.');
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }
  if (body) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) });
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }
  if (raw && res.ok) return res; // used for authenticated file downloads
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (path === '/chat') {
      throw new Error(`The chat API returned a webpage instead of JSON (HTTP ${res.status}). Check that VITE_API_URL points to the server deployment.`);
    }
    throw new Error(`The API returned an unexpected response (HTTP ${res.status}). Check the API server deployment.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}
