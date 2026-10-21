import { Router } from 'express';
import multer from 'multer';
import { Readable } from 'node:stream';
import { z } from 'zod';
import { db, FieldValue } from '../lib/firebase.js';
import { saveBlob, readBlob, removeBlob } from '../lib/storage.js';
import { driveEnabled, uploadToDrive, deleteFromDrive } from '../lib/drive.js';
import { ah, HttpError, parse } from '../lib/http.js';
import { requireAuth, loadProfile } from '../middleware/auth.js';
import { notify, logActivity } from '../lib/notify.js';
import { MAX_UPLOAD_BYTES } from '../config.js';

const r = Router();
r.use(requireAuth, loadProfile);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 4 } });

// Allowed types are verified by file CONTENT (magic bytes), not by the name or browser-supplied MIME type.
const startsWith = (buf, bytes) => bytes.every((b, i) => buf[i] === b);
function detect(buf, ext) {
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46]) && ext === 'pdf') return 'application/pdf';
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47]) && ext === 'png') return 'image/png';
  if (startsWith(buf, [0xff, 0xd8, 0xff]) && ['jpg', 'jpeg'].includes(ext)) return 'image/jpeg';
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) && ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) && ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0]) && ext === 'doc') return 'application/msword';
  return null;
}
const safeName = (n) => n.normalize('NFKD').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 100) || 'document';

r.post('/', upload.single('file'), ah(async (req, res) => {
  const { appointmentId } = parse(z.object({ appointmentId: z.string().min(5).max(64) }), req.body);
  if (!req.file) throw new HttpError(400, 'Choose a file to upload.');
  const apptSnap = await db.collection('appointments').doc(appointmentId).get();
  const a = apptSnap.data();
  if (!a) throw new HttpError(404, 'Appointment not found.');
  const isClient = req.user.role === 'client' && a.clientId === req.user.uid;
  const isStaff = (req.user.role === 'staff' && a.staffId === req.user.uid) || req.user.role === 'admin';
  if (!isClient && !isStaff) throw new HttpError(403, 'You do not have access to this.');
  if (['cancelled', 'declined'].includes(a.status)) throw new HttpError(400, 'This consultation is closed.');

  const name = safeName(req.file.originalname);
  const ext = name.split('.').pop().toLowerCase();
  const contentType = detect(req.file.buffer, ext);
  if (!contentType) throw new HttpError(400, 'Only PDF, Word, Excel, JPG and PNG files are accepted.');

  // 1) Primary copy in the private Vercel Blob store (required).
  const stored = await saveBlob(`documents/${a.clientId}/${appointmentId}/${name}`, req.file.buffer, contentType);

  // 2) Archive copy in the firm's Google Drive (best effort: a Drive problem never blocks the client's upload).
  let drive = { status: 'disabled', fileId: null, link: null };
  if (driveEnabled()) {
    try {
      const f = await uploadToDrive({ clientId: a.clientId, clientName: a.clientName, name, buffer: req.file.buffer, contentType });
      drive = { status: 'synced', fileId: f.id, link: f.webViewLink || null };
    } catch (e) { console.error('Drive upload failed:', e.message); drive = { status: 'failed', fileId: null, link: null }; }
  }

  const ref = await db.collection('documents').add({
    clientId: a.clientId, clientName: a.clientName, staffId: a.staffId, appointmentId, name, contentType,
    size: req.file.size, blobUrl: stored.url, blobPath: stored.pathname,
    driveStatus: drive.status, driveFileId: drive.fileId, driveLink: drive.link,
    uploadedBy: req.user.uid, uploadedByName: req.user.name, uploadedByRole: req.user.role,
    createdAt: FieldValue.serverTimestamp(),
  });
  const target = isClient ? a.staffId : a.clientId;
  await Promise.all([
    notify(target, { title: 'New document', body: `${req.user.name} uploaded “${name}”.`, type: 'document', link: isClient ? '/app/documents' : '/portal/documents' }),
    logActivity(req.user, 'document.uploaded', `Uploaded “${name}” for ${a.clientName}`, { type: 'document', id: ref.id }),
  ]);
  res.status(201).json({ id: ref.id });
}));

async function authorise(req) {
  const snap = await db.collection('documents').doc(req.params.id).get();
  const d = snap.data();
  if (!d) throw new HttpError(404, 'Document not found.');
  const ok = req.user.role === 'admin' || d.clientId === req.user.uid || (req.user.role === 'staff' && d.staffId === req.user.uid);
  if (!ok) throw new HttpError(403, 'You do not have access to this.');
  return { ref: snap.ref, ...d };
}

// Authenticated download: the server checks permission, then streams the file from private storage.
// Every staff download is recorded for the supervisor.
r.get('/:id/file', ah(async (req, res) => {
  const d = await authorise(req);
  const file = await readBlob(d.blobPath);
  if (req.user.role !== 'client') await logActivity(req.user, 'document.viewed', `Opened “${d.name}” (${d.clientName})`, { type: 'document', id: req.params.id });
  res.setHeader('Content-Type', d.contentType);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(d.name)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  Readable.fromWeb(file.stream).pipe(res);
}));

r.delete('/:id', ah(async (req, res) => {
  const d = await authorise(req);
  if (d.uploadedBy !== req.user.uid && req.user.role !== 'admin') throw new HttpError(403, 'Only the uploader or an administrator can delete this.');
  await removeBlob(d.blobUrl).catch((e) => console.error('Blob delete failed:', e.message));
  if (d.driveFileId) await deleteFromDrive(d.driveFileId).catch((e) => console.error('Drive delete failed:', e.message));
  await d.ref.delete();
  await logActivity(req.user, 'document.deleted', `Deleted “${d.name}”`, { type: 'document', id: req.params.id });
  res.json({ ok: true });
}));

export default r;
