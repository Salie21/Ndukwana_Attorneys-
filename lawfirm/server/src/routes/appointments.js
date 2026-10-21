import { Router } from 'express';
import { z } from 'zod';
import { db, FieldValue, Timestamp } from '../lib/firebase.js';
import { ah, HttpError, parse } from '../lib/http.js';
import { requireAuth, loadProfile, clientOnly, staffOnly, adminOnly } from '../middleware/auth.js';
import { notify, notifyAdmins, logActivity, slackAlert } from '../lib/notify.js';
import { CASE_TYPE_IDS, caseLabel, SLOT_HOURS, TZ_OFFSET, MAX_ACTIVE_BOOKINGS_PER_CLIENT } from '../config.js';

const r = Router();
r.use(requireAuth, loadProfile);

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hourNum = z.number().int().refine((h) => SLOT_HOURS.includes(h), 'Pick one of the available times');
const ACTIVE = ['pending', 'approved'];
const pad = (n) => String(n).padStart(2, '0');
const lockId = (staffId, date, hour) => `${staffId}_${date}_${pad(hour)}`;
const fmt = (ts) => ts.toDate().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short' });

function slotStart(date, hour) {
  const d = new Date(`${date}T${pad(hour)}:00:00${TZ_OFFSET}`);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Invalid date.');
  const weekday = new Date(`${date}T12:00:00${TZ_OFFSET}`).getUTCDay();
  if (weekday === 0 || weekday === 6) throw new HttpError(400, 'Consultations are only available Monday to Friday.');
  if (d.getTime() < Date.now() + 60 * 60 * 1000) throw new HttpError(400, 'Choose a time at least one hour from now.');
  if (d.getTime() > Date.now() + 120 * 24 * 3600 * 1000) throw new HttpError(400, 'Bookings open up to four months ahead.');
  return d;
}

async function getAppt(id) {
  const snap = await db.collection('appointments').doc(id).get();
  if (!snap.exists) throw new HttpError(404, 'Appointment not found.');
  return { ref: snap.ref, id: snap.id, ...snap.data() };
}

// Which hours on a day are already taken for a staff member.
r.get('/availability', ah(async (req, res) => {
  const { staffId, date } = parse(z.object({ staffId: z.string().min(5).max(128), date: dateStr }), req.query);
  const snap = await db.collection('slots').where('staffId', '==', staffId).where('date', '==', date).get();
  const taken = snap.docs.map((d) => d.data().hour);
  res.json({ hours: SLOT_HOURS, taken });
}));

r.post('/', clientOnly, ah(async (req, res) => {
  const b = parse(z.object({
    caseType: z.enum(CASE_TYPE_IDS), staffId: z.string().min(5).max(128),
    description: z.string().trim().min(10, 'Describe your matter in a few sentences').max(2000),
    date: dateStr, hour: hourNum,
  }).strict(), req.body);
  const start = slotStart(b.date, b.hour);

  const staffSnap = await db.collection('team').doc(b.staffId).get();
  const staff = staffSnap.data();
  if (!staff || staff.status !== 'active' || staff.bookable === false) throw new HttpError(400, 'That staff member is not available for booking.');
  if (b.caseType !== 'other' && !(staff.specialties || []).includes(b.caseType)) throw new HttpError(400, 'That staff member does not handle this type of case.');

  const active = await db.collection('appointments').where('clientId', '==', req.user.uid).where('status', 'in', ACTIVE).count().get();
  if (active.data().count >= MAX_ACTIVE_BOOKINGS_PER_CLIENT) throw new HttpError(429, 'You have the maximum number of open consultations. Cancel one or wait for a decision.');

  const apptRef = db.collection('appointments').doc();
  const lockRef = db.collection('slots').doc(lockId(b.staffId, b.date, b.hour));
  await db.runTransaction(async (tx) => {
    if ((await tx.get(lockRef)).exists) throw new HttpError(409, 'That time was just taken. Pick another slot.');
    tx.set(lockRef, { staffId: b.staffId, date: b.date, hour: b.hour, appointmentId: apptRef.id });
    tx.set(apptRef, {
      clientId: req.user.uid, clientName: req.user.name, clientEmail: req.user.email,
      staffId: b.staffId, staffName: staff.name, caseType: b.caseType, caseLabel: caseLabel(b.caseType),
      description: b.description, startsAt: Timestamp.fromDate(start), slotDate: b.date, slotHour: b.hour,
      status: 'pending', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await Promise.all([
    notify(req.user.uid, { title: 'Consultation requested', body: `Your request with ${staff.name} is awaiting approval.`, type: 'appointment', link: '/portal/appointments' }),
    notify(b.staffId, { title: 'New consultation request', body: `${req.user.name} – ${caseLabel(b.caseType)}`, type: 'appointment', link: '/app/cases' }),
    notifyAdmins({ title: 'New consultation request', body: `${req.user.name} requested ${staff.name} – ${caseLabel(b.caseType)}`, type: 'appointment', link: '/app/consultations' }),
    logActivity(req.user, 'appointment.created', `${req.user.name} requested a consultation with ${staff.name}`, { type: 'appointment', id: apptRef.id }),
    slackAlert(`New consultation request (${caseLabel(b.caseType)}). Open the dashboard to review.`),
  ]);
  res.status(201).json({ id: apptRef.id });
}));

r.patch('/:id/reschedule', clientOnly, ah(async (req, res) => {
  const b = parse(z.object({ date: dateStr, hour: hourNum }).strict(), req.body);
  const a = await getAppt(req.params.id);
  if (a.clientId !== req.user.uid) throw new HttpError(403, 'You do not have access to this.');
  if (!ACTIVE.includes(a.status)) throw new HttpError(400, 'This consultation can no longer be rescheduled.');
  const start = slotStart(b.date, b.hour);
  const oldLock = db.collection('slots').doc(lockId(a.staffId, a.slotDate, a.slotHour));
  const newLock = db.collection('slots').doc(lockId(a.staffId, b.date, b.hour));
  await db.runTransaction(async (tx) => {
    if (newLock.path !== oldLock.path && (await tx.get(newLock)).exists) throw new HttpError(409, 'That time was just taken. Pick another slot.');
    tx.delete(oldLock);
    tx.set(newLock, { staffId: a.staffId, date: b.date, hour: b.hour, appointmentId: a.id });
    tx.update(a.ref, { startsAt: Timestamp.fromDate(start), slotDate: b.date, slotHour: b.hour, status: 'pending', updatedAt: FieldValue.serverTimestamp() });
  });
  const when = fmt(Timestamp.fromDate(start));
  await Promise.all([
    notify(req.user.uid, { title: 'Consultation rescheduled', body: `New time: ${when}. It needs approval again.`, type: 'appointment', link: '/portal/appointments' }),
    notify(a.staffId, { title: 'Consultation rescheduled', body: `${a.clientName} moved their consultation to ${when}.`, type: 'appointment', link: '/app/cases' }),
    logActivity(req.user, 'appointment.rescheduled', `${a.clientName} rescheduled to ${when}`, { type: 'appointment', id: a.id }),
  ]);
  res.json({ ok: true });
}));

// Cancel: the client (own), the assigned staff member, or an admin.
r.patch('/:id/cancel', ah(async (req, res) => {
  const b = parse(z.object({ reason: z.string().trim().max(300).optional() }).strict(), req.body);
  const a = await getAppt(req.params.id);
  const isOwner = a.clientId === req.user.uid;
  const isAssigned = a.staffId === req.user.uid && (req.user.role === 'staff' || req.user.role === 'admin');
  if (!isOwner && !isAssigned && req.user.role !== 'admin') throw new HttpError(403, 'You do not have access to this.');
  if (!ACTIVE.includes(a.status)) throw new HttpError(400, 'This consultation is already closed.');
  await db.runTransaction(async (tx) => {
    tx.delete(db.collection('slots').doc(lockId(a.staffId, a.slotDate, a.slotHour)));
    tx.update(a.ref, { status: 'cancelled', cancelledBy: req.user.uid, cancelReason: b.reason || '', updatedAt: FieldValue.serverTimestamp() });
  });
  const when = fmt(a.startsAt);
  const others = isOwner ? [a.staffId] : [a.clientId];
  await Promise.all([
    ...others.map((id) => notify(id, { title: 'Consultation cancelled', body: `${isOwner ? a.clientName : req.user.name} cancelled the consultation on ${when}.`, type: 'appointment', link: isOwner ? '/app/cases' : '/portal/appointments' })),
    logActivity(req.user, 'appointment.cancelled', `Consultation on ${when} cancelled`, { type: 'appointment', id: a.id }),
  ]);
  res.json({ ok: true });
}));

// Approve / decline / complete: the assigned staff member or an admin.
r.patch('/:id/status', staffOnly, ah(async (req, res) => {
  const b = parse(z.object({ status: z.enum(['approved', 'declined', 'completed']), note: z.string().trim().max(300).optional() }).strict(), req.body);
  const a = await getAppt(req.params.id);
  if (a.staffId !== req.user.uid && req.user.role !== 'admin') throw new HttpError(403, 'You do not have access to this.');
  const allowed = { approved: ['pending'], declined: ['pending'], completed: ['approved'] };
  if (!allowed[b.status].includes(a.status)) throw new HttpError(400, `A ${a.status} consultation cannot be marked ${b.status}.`);
  await db.runTransaction(async (tx) => {
    if (b.status === 'declined') tx.delete(db.collection('slots').doc(lockId(a.staffId, a.slotDate, a.slotHour)));
    tx.update(a.ref, { status: b.status, statusNote: b.note || '', decidedBy: req.user.uid, updatedAt: FieldValue.serverTimestamp() });
  });
  const when = fmt(a.startsAt);
  const copy = {
    approved: ['Consultation approved', `Your consultation with ${a.staffName} on ${when} is confirmed.`],
    declined: ['Consultation declined', `${a.staffName} could not accept the ${when} slot.${b.note ? ` Note: ${b.note}` : ''} Please book another time.`],
    completed: ['Consultation completed', `Your consultation on ${when} is marked complete.`],
  }[b.status];
  await Promise.all([
    notify(a.clientId, { title: copy[0], body: copy[1], type: 'appointment', link: '/portal/appointments' }),
    logActivity(req.user, `appointment.${b.status}`, `${b.status[0].toUpperCase() + b.status.slice(1)} ${a.clientName}'s consultation (${when})`, { type: 'appointment', id: a.id }),
  ]);
  res.json({ ok: true });
}));

// Supervisor re-assigns a consultation to a different staff member.
r.patch('/:id/reassign', adminOnly, ah(async (req, res) => {
  const b = parse(z.object({ staffId: z.string().min(5).max(128) }).strict(), req.body);
  const a = await getAppt(req.params.id);
  if (!ACTIVE.includes(a.status)) throw new HttpError(400, 'Only open consultations can be reassigned.');
  const staff = (await db.collection('team').doc(b.staffId).get()).data();
  if (!staff || staff.status !== 'active') throw new HttpError(400, 'That staff member is not active.');
  const oldLock = db.collection('slots').doc(lockId(a.staffId, a.slotDate, a.slotHour));
  const newLock = db.collection('slots').doc(lockId(b.staffId, a.slotDate, a.slotHour));
  await db.runTransaction(async (tx) => {
    if ((await tx.get(newLock)).exists) throw new HttpError(409, `${staff.name} already has a consultation at that time.`);
    tx.delete(oldLock);
    tx.set(newLock, { staffId: b.staffId, date: a.slotDate, hour: a.slotHour, appointmentId: a.id });
    tx.update(a.ref, { staffId: b.staffId, staffName: staff.name, updatedAt: FieldValue.serverTimestamp() });
  });
  await Promise.all([
    notify(b.staffId, { title: 'Consultation assigned to you', body: `${a.clientName} – ${a.caseLabel}`, type: 'appointment', link: '/app/cases' }),
    notify(a.staffId, { title: 'Consultation reassigned', body: `${a.clientName}'s consultation moved to ${staff.name}.`, type: 'appointment', link: '/app/cases' }),
    notify(a.clientId, { title: 'Your consultation has a new attorney', body: `${staff.name} will now handle your consultation.`, type: 'appointment', link: '/portal/appointments' }),
    logActivity(req.user, 'appointment.reassigned', `Reassigned ${a.clientName} from ${a.staffName} to ${staff.name}`, { type: 'appointment', id: a.id }),
  ]);
  res.json({ ok: true });
}));

export default r;
