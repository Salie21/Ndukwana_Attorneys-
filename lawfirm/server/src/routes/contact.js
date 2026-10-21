import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { db, FieldValue } from '../lib/firebase.js';
import { ah, parse } from '../lib/http.js';
import { notifyAdmins, slackAlert } from '../lib/notify.js';

const r = Router();
const limiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many messages. Please try again later or call the office.' } });

r.post('/', limiter, ah(async (req, res) => {
  const b = parse(z.object({
    name: z.string().trim().min(2).max(80), email: z.string().trim().email().max(120),
    phone: z.string().trim().max(30).optional(), message: z.string().trim().min(10).max(3000),
    website: z.string().max(0).optional(), // honeypot: real people leave it empty
  }), req.body);
  if (b.website) return res.status(201).json({ ok: true }); // silently drop bots
  await db.collection('contactMessages').add({ name: b.name, email: b.email, phone: b.phone || '', message: b.message, handled: false, createdAt: FieldValue.serverTimestamp() });
  await Promise.all([
    notifyAdmins({ title: 'New contact form message', body: `${b.name} sent a message.`, type: 'contact', link: '/app/inbox' }),
    slackAlert('New website contact form message. Open the dashboard to read it.'),
  ]);
  res.status(201).json({ ok: true });
}));

export default r;
