import { Router } from 'express';
import { z } from 'zod';
import { auth, db, FieldValue } from '../lib/firebase.js';
import { ah, parse } from '../lib/http.js';
import { requireAuth, loadProfile, staffOnly } from '../middleware/auth.js';
import { CASE_TYPE_IDS, CASE_TYPES } from '../config.js';

const r = Router();
r.use(requireAuth, loadProfile);

r.get('/case-types', (_req, res) => res.json(CASE_TYPES));

// Avatars are resized in the browser to ~256px and stored as a small data URL (no Storage needed).
const avatar = z.string().max(120_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/).or(z.literal(''));

r.patch('/me', ah(async (req, res) => {
  const body = parse(z.object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z.string().trim().max(30).optional(),
    title: z.string().trim().max(80).optional(),
    bio: z.string().trim().max(600).optional(),
    avatar: avatar.optional(),
    specialties: z.array(z.enum(CASE_TYPE_IDS)).max(10).optional(),
    bookable: z.boolean().optional(),
    prefs: z.object({ theme: z.enum(['light', 'dark']).optional(), browserAlerts: z.boolean().optional() }).optional(),
  }).strict(), req.body);

  const isTeam = req.user.role === 'staff' || req.user.role === 'admin';
  const own = { ...body };
  if (!isTeam) { delete own.title; delete own.bio; delete own.specialties; delete own.bookable; }
  const flat = {};
  for (const [k, v] of Object.entries(own)) {
    if (k === 'prefs') for (const [pk, pv] of Object.entries(v)) flat[`prefs.${pk}`] = pv; else flat[k] = v;
  }
  flat.updatedAt = FieldValue.serverTimestamp();
  await db.collection('users').doc(req.user.uid).update(flat);

  if (isTeam) {
    const pub = {};
    for (const k of ['name', 'title', 'bio', 'avatar', 'specialties', 'bookable']) if (k in own) pub[k] = own[k];
    if (Object.keys(pub).length) await db.collection('team').doc(req.user.uid).set(pub, { merge: true });
  }
  if (body.name) await auth.updateUser(req.user.uid, { displayName: body.name });
  res.json({ ok: true });
}));

// "Sign out everywhere": invalidates every refresh token for this account.
r.post('/revoke-sessions', ah(async (req, res) => {
  await auth.revokeRefreshTokens(req.user.uid);
  res.json({ ok: true });
}));

// Clients pick a staff member for their case type. Only minimal public details are returned.
r.get('/staff', ah(async (req, res) => {
  const caseType = String(req.query.caseType || '');
  const snap = await db.collection('team').where('status', '==', 'active').get();
  const list = snap.docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .filter((m) => m.bookable !== false && (caseType === 'other' || !caseType || (m.specialties || []).includes(caseType)))
    .map((m) => ({ uid: m.uid, name: m.name, title: m.title || '', avatar: m.avatar || '', bio: m.bio || '', specialties: m.specialties || [] }));
  res.json(list);
}));

export default r;
