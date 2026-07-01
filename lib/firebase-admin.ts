import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const ADMIN_APP_NAME = "lotto-board-admin";

export const getAdminDb = () => {
  const existingApp = getApps().find((app) => app.name === ADMIN_APP_NAME);
  if (existingApp) return getFirestore(existingApp);

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin environment variables are not configured.");
  }

  const app = initializeApp(
    {
      credential: cert({ projectId, clientEmail, privateKey }),
    },
    ADMIN_APP_NAME,
  );

  return getFirestore(app);
};
