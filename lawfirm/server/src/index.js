import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import './lib/firebase.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import apptRoutes from './routes/appointments.js';
import docRoutes from './routes/documents.js';
import taskRoutes from './routes/tasks.js';
import adminRoutes from './routes/admin.js';
import contactRoutes from './routes/contact.js';
import chatRoutes from './routes/chat.js';

const app = express();
app.set('trust proxy', 1); // behind one proxy (Render/Railway/etc.) so rate limits use the real IP
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }, // API serves JSON only
  crossOriginResourcePolicy: { policy: 'same-site' },
}));

const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim());
app.use(cors({
  origin: (origin, cb) => (!origin || origins.includes(origin) ? cb(null, true) : cb(new Error('CORS'))),
  methods: ['GET', 'POST', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'], maxAge: 600,
}));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: '20kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }), authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/appointments', apptRoutes);
app.use('/api/documents', docRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/chat', chatRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));
// Never leak stack traces or internals to the browser.
app.use((err, _req, res, _next) => {
  if (err.message === 'CORS') return res.status(403).json({ error: 'Origin not allowed.' });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'That file is larger than 10 MB.' });
  if (err.name === 'MulterError') return res.status(400).json({ error: 'Upload failed. Check the file and try again.' });
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') return res.status(400).json({ error: 'Invalid request.' });
  const status = err.status && err.status < 600 ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Something went wrong. Please try again.' : err.message });
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`API listening on :${port}`));
