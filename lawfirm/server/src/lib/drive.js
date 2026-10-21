import { db, FieldValue } from './firebase.js';

// Secondary copy: the firm's Google Drive. Each client gets their own sub-folder under one root folder.
// Uses an OAuth refresh token for the firm's Google account (see scripts/drive-auth.js) and the narrow
// "drive.file" scope, so the app can only touch files and folders it created itself.
export const driveEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_DRIVE_FOLDER_ID);

let cached = null;
async function token() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.value;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(10_000),
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: process.env.GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token' }),
  });
  if (!res.ok) throw new Error(`Drive token refresh failed (${res.status})`);
  const j = await res.json();
  cached = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.value;
}

const authed = async (url, init = {}) => {
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${await token()}` }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Drive request failed (${res.status})`);
  return res;
};

async function clientFolder(clientId, clientName) {
  const ref = db.collection('driveFolders').doc(clientId);
  const snap = await ref.get();
  if (snap.exists) return snap.data().folderId;
  const name = `${clientName.replace(/[\\/:*?"<>|]/g, '').trim() || 'Client'} (${clientId.slice(0, 6)})`;
  const res = await authed('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [process.env.GOOGLE_DRIVE_FOLDER_ID] }),
  });
  const { id } = await res.json();
  await ref.set({ folderId: id, name, createdAt: FieldValue.serverTimestamp() });
  return id;
}

export async function uploadToDrive({ clientId, clientName, name, buffer, contentType }) {
  const parent = await clientFolder(clientId, clientName);
  const boundary = `b${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const meta = JSON.stringify({ name, parents: [parent] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
    buffer, Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await authed('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
  });
  return res.json(); // { id, webViewLink }
}

export async function deleteFromDrive(fileId) {
  await authed(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
}
