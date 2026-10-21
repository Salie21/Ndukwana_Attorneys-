import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { auth, db, FieldValue } from '../lib/firebase.js';
import { ah, HttpError, parse } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { logActivity, notifyAdmins } from '../lib/notify.js';

const r = Router();
export const hashCode = (code) => crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');

async function loadAuthUser(uid) {
  const u = await auth.getUser(uid);
  if (u.customClaims?.role) throw new HttpError(409, 'This account is already set up. Sign in instead.');
  return u;
}

// Public sign-up creates CLIENT accounts only. The role is set here, on the server.
r.post('/register-client', requireAuth, ah(async (req, res) => {
  const body = parse(z.object({ name: z.string().trim().min(2).max(80), phone: z.string().trim().max(30).optional() }), req.body);
  const u = await loadAuthUser(req.user.uid);
  await auth.setCustomUserClaims(u.uid, { role: 'client' });
  await auth.updateUser(u.uid, { displayName: body.name });
  await db.collection('users').doc(u.uid).set({
    name: body.name, email: u.email, phone: body.phone || '', role: 'client', status: 'active', avatar: '',
    prefs: { theme: 'light' }, createdAt: FieldValue.serverTimestamp(),
  });
  res.status(201).json({ role: 'client' });
}));

// Staff/admin sign-up requires a one-time invite code issued by an administrator.
r.post('/register-staff', requireAuth, ah(async (req, res) => {
  const body = parse(z.object({
    name: z.string().trim().min(2).max(80), code: z.string().trim().min(6).max(40), title: z.string().trim().max(80).optional(),
  }), req.body);
  const u = await loadAuthUser(req.user.uid);
  const inviteRef = db.collection('invites').doc(hashCode(body.code));

  const role = await db.runTransaction(async (tx) => {
    const snap = await tx.get(inviteRef);
    const inv = snap.data();
    if (!inv || inv.usedBy || inv.revoked || inv.expiresAt.toMillis() < Date.now()) throw new HttpError(400, 'That invite code is invalid or has expired. Ask an administrator for a new one.');
    if (inv.email && inv.email.toLowerCase() !== (u.email || '').toLowerCase()) throw new HttpError(400, 'That invite was issued to a different email address.');
    tx.update(inviteRef, { usedBy: u.uid, usedAt: FieldValue.serverTimestamp() });
    return inv.role;
  });

  await auth.setCustomUserClaims(u.uid, { role });
  await auth.updateUser(u.uid, { displayName: body.name });
  const profile = { name: body.name, email: u.email, role, status: 'active', avatar: '', title: body.title || '', bio: '', specialties: [], bookable: true };
  await db.collection('users').doc(u.uid).set({ ...profile, phone: '', prefs: { theme: 'dark' }, createdAt: FieldValue.serverTimestamp() });
  const { email: _private, ...publicProfile } = profile; // staff directory never exposes email
  await db.collection('team').doc(u.uid).set({ ...publicProfile, createdAt: FieldValue.serverTimestamp() });
  const actor = { uid: u.uid, name: body.name, role };
  await logActivity(actor, 'staff.joined', `${body.name} joined as ${role}`, { type: 'user', id: u.uid });
  await notifyAdmins({ title: 'New team member', body: `${body.name} joined as ${role}.`, type: 'team', link: '/app/team' });
  res.status(201).json({ role });
}));

export default r;
