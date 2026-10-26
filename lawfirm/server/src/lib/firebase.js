import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const opts = {};
if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
  opts.projectId = process.env.FIREBASE_PROJECT_ID || 'demo-ndukwana'; // local emulators need no credentials
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  let key;
  try {
    key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim());
    if (typeof key.private_key === 'string') key.private_key = key.private_key.replace(/\\n/g, '\n'); // Render sometimes stores the key's line breaks as text
  } catch {
    console.error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the whole service-account file as one value.');
    process.exit(1);
  }
  opts.credential = cert(key);
} else {
  console.error('FIREBASE_SERVICE_ACCOUNT_JSON is not set. Add it in the Render environment settings.');
  opts.credential = applicationDefault(); // GOOGLE_APPLICATION_CREDENTIALS file
}
const app = initializeApp(opts);

export const auth = getAuth(app);
export const db = getFirestore(app);
export { FieldValue, Timestamp };
