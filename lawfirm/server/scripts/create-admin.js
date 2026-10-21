// Usage: npm run create-admin -- you@firm.co.za "Full Name"
// Creates (or upgrades) the first supervisor account. Run this on YOUR machine only – never expose it as an endpoint.
import { auth, db, FieldValue } from '../src/lib/firebase.js';

const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ') || 'Administrator';
if (!email) { console.error('Usage: npm run create-admin -- email "Full Name"'); process.exit(1); }

let user;
try { user = await auth.getUserByEmail(email); } catch {
  const password = (await import('node:crypto')).randomBytes(12).toString('base64url');
  user = await auth.createUser({ email, password, displayName: name, emailVerified: true });
  console.log(`Created user. Temporary password (change it after first sign-in): ${password}`);
}
await auth.setCustomUserClaims(user.uid, { role: 'admin' });
const base = { name, role: 'admin', status: 'active', avatar: '', title: 'Supervisor', bio: '', specialties: [], bookable: false };
await db.collection('users').doc(user.uid).set({ ...base, email, phone: '', prefs: { theme: 'dark' }, createdAt: FieldValue.serverTimestamp() }, { merge: true });
await db.collection('team').doc(user.uid).set({ ...base, createdAt: FieldValue.serverTimestamp() }, { merge: true });
console.log(`${email} is now an admin. Sign in at /staff.`);
process.exit(0);
