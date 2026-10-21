import { Router } from 'express';
import { z } from 'zod';
import { db, FieldValue, Timestamp } from '../lib/firebase.js';
import { ah, HttpError, parse } from '../lib/http.js';
import { requireAuth, loadProfile, staffOnly } from '../middleware/auth.js';
import { notify, logActivity } from '../lib/notify.js';

const r = Router();
r.use(requireAuth, loadProfile, staffOnly);

r.post('/', ah(async (req, res) => {
  const b = parse(z.object({
    title: z.string().trim().min(2).max(120), description: z.string().trim().max(1000).optional(),
    assigneeId: z.string().min(5).max(128).optional(), appointmentId: z.string().max(64).optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), priority: z.enum(['low', 'normal', 'high']).default('normal'),
  }).strict(), req.body);
  const assigneeId = b.assigneeId || req.user.uid;
  if (assigneeId !== req.user.uid && req.user.role !== 'admin') throw new HttpError(403, 'Only a supervisor can assign tasks to others.');
  const assignee = (await db.collection('team').doc(assigneeId).get()).data();
  if (!assignee) throw new HttpError(400, 'Choose a team member.');
  let clientName = '';
  if (b.appointmentId) {
    const a = (await db.collection('appointments').doc(b.appointmentId).get()).data();
    if (!a) throw new HttpError(400, 'Appointment not found.');
    clientName = a.clientName;
  }
  const ref = await db.collection('tasks').add({
    title: b.title, description: b.description || '', assigneeId, assigneeName: assignee.name,
    appointmentId: b.appointmentId || null, clientName, priority: b.priority,
    dueDate: b.dueDate ? Timestamp.fromDate(new Date(`${b.dueDate}T23:59:00+02:00`)) : null,
    status: 'todo', createdBy: req.user.uid, createdByName: req.user.name,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  if (assigneeId !== req.user.uid) await notify(assigneeId, { title: 'New task assigned', body: b.title, type: 'task', link: '/app/tasks' });
  await logActivity(req.user, 'task.created', `Created task “${b.title}” for ${assignee.name}`, { type: 'task', id: ref.id });
  res.status(201).json({ id: ref.id });
}));

r.patch('/:id', ah(async (req, res) => {
  const b = parse(z.object({ status: z.enum(['todo', 'in_progress', 'done']) }).strict(), req.body);
  const snap = await db.collection('tasks').doc(req.params.id).get();
  const t = snap.data();
  if (!t) throw new HttpError(404, 'Task not found.');
  if (t.assigneeId !== req.user.uid && t.createdBy !== req.user.uid && req.user.role !== 'admin') throw new HttpError(403, 'You do not have access to this.');
  await snap.ref.update({ status: b.status, updatedAt: FieldValue.serverTimestamp() });
  await logActivity(req.user, 'task.updated', `Moved “${t.title}” to ${b.status.replace('_', ' ')}`, { type: 'task', id: snap.id });
  if (t.createdBy !== req.user.uid) await notify(t.createdBy, { title: 'Task updated', body: `${req.user.name} moved “${t.title}” to ${b.status.replace('_', ' ')}.`, type: 'task', link: '/app/tasks' });
  res.json({ ok: true });
}));

r.delete('/:id', ah(async (req, res) => {
  const snap = await db.collection('tasks').doc(req.params.id).get();
  const t = snap.data();
  if (!t) throw new HttpError(404, 'Task not found.');
  if (t.createdBy !== req.user.uid && req.user.role !== 'admin') throw new HttpError(403, 'Only the creator or a supervisor can delete this task.');
  await snap.ref.delete();
  await logActivity(req.user, 'task.deleted', `Deleted task “${t.title}”`, { type: 'task', id: snap.id });
  res.json({ ok: true });
}));

export default r;
