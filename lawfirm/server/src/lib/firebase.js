
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const opts = {};

if (
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  process.env.FIRESTORE_EMULATOR_HOST
) {
  // Local emulator configuration
  opts.projectId = process.env.FIREBASE_PROJECT_ID || 'demo-ndukwana';
} else {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) {
    throw new Error(
      'Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable'
    );
  }

  let serviceAccount;

  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. ' +
      'Check that private_key newlines are escaped as \\n.'
    );
  }

  opts.credential = cert(serviceAccount);
}

const app = initializeApp(opts);

export const auth = getAuth(app);
export const db = getFirestore(app);
export { FieldValue, Timestamp };
