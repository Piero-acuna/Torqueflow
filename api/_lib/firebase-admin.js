import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON no está configurado.");
  const parsed = JSON.parse(raw);
  if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  return parsed;
}

export function adminApp() {
  if (getApps().length) return getApps()[0];
  return initializeApp({ credential: cert(serviceAccount()) });
}

export function adminAuth() {
  return getAuth(adminApp());
}

export function adminDb() {
  return getFirestore(adminApp());
}

export async function requireAdmin(request, workshopId) {
  const authorization = request.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) throw Object.assign(new Error("Falta el token de autenticación."), { status: 401 });
  const decoded = await adminAuth().verifyIdToken(token);
  const member = await adminDb().doc(`workshops/${workshopId}/members/${decoded.uid}`).get();
  if (!member.exists || member.data().active !== true || member.data().role !== "admin") {
    throw Object.assign(new Error("Se requiere rol administrador."), { status: 403 });
  }
  return decoded;
}
