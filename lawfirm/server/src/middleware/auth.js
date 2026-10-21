import { auth, db } from '../lib/firebase.js';
import { HttpError } from '../lib/http.js';

// Verifies the Firebase ID token on every request. Role comes ONLY from the signed token claims.
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) throw new HttpError(401, 'Sign in to continue.');
    const decoded = await auth.verifyIdToken(header.slice(7), true); // true = reject revoked tokens
    req.user = { uid: decoded.uid, email: decoded.email, name: decoded.name, role: decoded.role || null };
    next();
  } catch (e) {
    next(e instanceof HttpError ? e : new HttpError(401, 'Your session has expired. Sign in again.'));
  }
}

export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(new HttpError(403, 'You do not have access to this.'));

export const staffOnly = requireRole('staff', 'admin');
export const adminOnly = requireRole('admin');
export const clientOnly = requireRole('client');

// Load the caller's profile (used for display names in audit entries).
export async function loadProfile(req, _res, next) {
  try {
    const snap = await db.collection('users').doc(req.user.uid).get();
    const data = snap.data();
    if (!data || data.status === 'disabled') throw new HttpError(403, 'This account is not active.');
    req.user.name = data.name;
    next();
  } catch (e) { next(e); }
}
