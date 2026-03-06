import { initializeApp, applicationDefault, getApps, getApp } from 'firebase-admin/app';
import { getAuth as firebaseGetAuth } from 'firebase-admin/auth';
import { getFirestore as firebaseGetFirestore } from 'firebase-admin/firestore';

const projectId =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.PROJECT_ID;

function initApp() {
  if (!getApps().length) {
    const options = { credential: applicationDefault() };
    if (projectId) options.projectId = projectId;
    initializeApp(options);
  }
  return getApp();
}

export function getAdminAuth() {
  const app = initApp();
  return firebaseGetAuth(app);
}

export function getAdminDb() {
  const app = initApp();
  return firebaseGetFirestore(app);
}
