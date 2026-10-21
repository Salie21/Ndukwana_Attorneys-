// One-time setup for the Google Drive archive. Run on YOUR computer:  npm run drive-auth
// Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env (OAuth client type "Desktop app").
// Opens a consent link, receives the code on localhost, creates the root folder, and prints the two values to add to .env.
import http from 'node:http';

const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) { console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server/.env first.'); process.exit(1); }
const PORT = 53682, redirect = `http://localhost:${PORT}`;
const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: id, redirect_uri: redirect, response_type: 'code', access_type: 'offline', prompt: 'consent',
  scope: 'https://www.googleapis.com/auth/drive.file',
});
console.log('\nOpen this link, sign in with the FIRM\'s Google account, and allow access:\n\n' + url + '\n');

http.createServer(async (req, res) => {
  const code = new URL(req.url, redirect).searchParams.get('code');
  if (!code) { res.end('Waiting for Google…'); return; }
  try {
    const t = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: 'authorization_code' }) })).json();
    if (!t.refresh_token) throw new Error(t.error_description || 'No refresh token returned. Remove the app at myaccount.google.com/permissions and try again.');
    const f = await (await fetch('https://www.googleapis.com/drive/v3/files?fields=id', { method: 'POST',
      headers: { Authorization: `Bearer ${t.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ndukwana Attorneys - Client Documents', mimeType: 'application/vnd.google-apps.folder' }) })).json();
    res.end('Done. You can close this tab and return to the terminal.');
    console.log('\nAdd these to server/.env:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${t.refresh_token}`);
    console.log(`GOOGLE_DRIVE_FOLDER_ID=${f.id}\n`);
    process.exit(0);
  } catch (e) { res.end('Something went wrong. See the terminal.'); console.error(e.message); process.exit(1); }
}).listen(PORT);
