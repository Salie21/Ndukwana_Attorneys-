import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { auth, db, FieldValue, Timestamp } from '../lib/firebase.js';
import { ah, HttpError, parse } from '../lib/http.js';
import { requireAuth, loadProfile, adminOnly } from '../middleware/auth.js';
import { logActivity } from '../lib/notify.js';
import { hashCode } from './auth.js';
import { CASE_TYPE_IDS } from '../config.js';

const r = Router();
r.use(requireAuth, loadProfile, adminOnly);

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alike characters
const makeCode = () => Array.from(crypto.randomBytes(12), (b) => ALPHABET[b % ALPHABET.length]).join('').replace(/(.{4})(?=.)/g, '$1-');

// The plain code is shown once; only its SHA-256 hash is stored.
r.post('/invites', ah(async (req, res) => {
  const b = parse(z.object({ role: z.enum(['staff', 'admin']), email: z.string().email().max(120).optional(), note: z.string().trim().max(120).optional() }).strict(), req.body);
  const code = makeCode();
  await db.collection('invites').doc(hashCode(code)).set({
    role: b.role, email: b.email?.toLowerCase() || '', note: b.note || '', createdBy: req.user.uid, createdByName: req.user.name,
    expiresAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 3600 * 1000), usedBy: null, revoked: false, createdAt: FieldValue.serverTimestamp(),
  });
  await logActivity(req.user, 'invite.created', `Created a ${b.role} invite${b.note ? ` (${b.note})` : ''}`);
  res.status(201).json({ code, expiresInDays: 7 });
}));

r.get('/invites', ah(async (_req, res) => {
  const snap = await db.collection('invites').orderBy('createdAt', 'desc').limit(50).get();
  res.json(snap.docs.map((d) => {
    const v = d.data();
    return { id: d.id, role: v.role, email: v.email, note: v.note, used: !!v.usedBy, revoked: v.revoked, expiresAt: v.expiresAt.toMillis(), createdAt: v.createdAt?.toMillis() ?? null };
  }));
}));

r.delete('/invites/:id', ah(async (req, res) => {
  await db.collection('invites').doc(req.params.id).update({ revoked: true });
  res.json({ ok: true });
}));

// Activate/deactivate a team member and set the case types they handle.
r.patch('/users/:uid', ah(async (req, res) => {
  const b = parse(z.object({ status: z.enum(['active', 'disabled']).optional(), specialties: z.array(z.enum(CASE_TYPE_IDS)).max(10).optional(), bookable: z.boolean().optional() }).strict(), req.body);
  const uid = req.params.uid;
  if (uid === req.user.uid && b.status === 'disabled') throw new HttpError(400, 'You cannot deactivate your own account.');
  const teamRef = db.collection('team').doc(uid);
  if (!(await teamRef.get()).exists) throw new HttpError(404, 'Team member not found.');
  if (b.status) {
    await auth.updateUser(uid, { disabled: b.status === 'disabled' });
    if (b.status === 'disabled') await auth.revokeRefreshTokens(uid);
    await db.collection('users').doc(uid).update({ status: b.status });
  }
  await teamRef.set(b, { merge: true });
  await logActivity(req.user, 'user.updated', `Updated team member ${uid}: ${Object.keys(b).join(', ')}`, { type: 'user', id: uid });
  res.json({ ok: true });
}));

export default r;
