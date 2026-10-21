import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const opts = {};
if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
  opts.projectId = process.env.FIREBASE_PROJECT_ID || 'demo-ndukwana'; // local emulators need no credentials
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  opts.credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
} else {
  opts.credential = applicationDefault(); // GOOGLE_APPLICATION_CREDENTIALS file
}
const app = initializeApp(opts);

export const auth = getAuth(app);
export const db = getFirestore(app);
export { FieldValue, Timestamp };
