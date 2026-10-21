import { db, FieldValue } from './firebase.js';

export async function notify(userId, { title, body, type = 'info', link = null }) {
  if (!userId) return;
  await db.collection('notifications').add({
    userId, title, body, type, link, read: false, createdAt: FieldValue.serverTimestamp(),
  });
}

export async function notifyAdmins(payload) {
  const snap = await db.collection('users').where('role', '==', 'admin').where('status', '==', 'active').get();
  await Promise.all(snap.docs.map((d) => notify(d.id, payload)));
}

// Supervisor audit trail – who did what, and when.
export async function logActivity(actor, action, summary, target = {}) {
  await db.collection('activity').add({
    actorId: actor.uid, actorName: actor.name || actor.email || 'Unknown', actorRole: actor.role,
    action, summary, targetType: target.type ?? null, targetId: target.id ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
}

// Optional Slack alert. Only ever sends generic text – never client names, case details or documents.
export async function slackAlert(text) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(4000) });
  } catch { /* alerts are best-effort */ }
}
