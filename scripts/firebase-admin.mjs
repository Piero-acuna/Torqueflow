import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { loadLocalEnv } from "./env.mjs";

loadLocalEnv();

function credentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Configura FIREBASE_SERVICE_ACCOUNT_JSON en .env.local.");
  const parsed = JSON.parse(raw);
  if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  return parsed;
}

const app = getApps()[0] || initializeApp({ credential: cert(credentials()) });
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
