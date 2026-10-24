import { auth } from '../firebase';

const BASE = import.meta.env.VITE_API_URL || '';

// Every call carries the user's Firebase ID token. The server verifies it and decides what is allowed.
export async function api(path, { method = 'GET', body, form, raw = false, auth: needsAuth = true, signal } = {}) {
  const headers = {};
  if (needsAuth) {
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in to continue.');
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }
  if (body) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined), signal });
  } catch (e) {
    if (e?.name === 'AbortError' || e?.name === 'TimeoutError') throw new Error('The server took too long to answer. Please try again.');
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }
  if (raw && res.ok) return res; // used for authenticated file downloads
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}
