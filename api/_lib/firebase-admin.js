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

const STAFF_ROLES = ["admin", "advisor", "mechanic", "cashier"];
const OPERATOR_ROLES = ["admin", "advisor", "mechanic"];

async function verifiedActor(request) {
  const authorization = request.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) throw Object.assign(new Error("Falta el token de autenticación."), { status: 401 });
  return adminAuth().verifyIdToken(token);
}

/**
 * Verifica el token de Firebase Auth y que el usuario sea miembro activo del
 * taller con alguno de los roles permitidos. Esta es la única barrera real
 * de aislamiento multi-taller para los datos en SQL (Data Connect no puede
 * evaluar la membresía de Firestore), así que toda función que lea o
 * escriba clientes/vehículos debe pasar por aquí antes de tocar Postgres.
 */
export async function requireMember(request, workshopId, roles = STAFF_ROLES) {
  const decoded = await verifiedActor(request);
  const member = await adminDb().doc(`workshops/${workshopId}/members/${decoded.uid}`).get();
  if (!member.exists || member.data().active !== true || !roles.includes(member.data().role)) {
    throw Object.assign(new Error("No tienes permiso para esta acción."), { status: 403 });
  }
  return { ...decoded, role: member.data().role };
}

export function send(response, status, payload) {
  response.status(status).setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

export function parseBody(request) {
  return typeof request.body === "string" ? JSON.parse(request.body || "{}") : (request.body || {});
}

export function workshopIdFromEnv() {
  const workshopId = process.env.FIREBASE_WORKSHOP_ID;
  if (!workshopId) throw Object.assign(new Error("FIREBASE_WORKSHOP_ID no está configurado."), { status: 400 });
  return workshopId;
}

export async function requireAdmin(request, workshopId) {
  return requireMember(request, workshopId, ["admin"]);
}

export async function requireOperator(request, workshopId) {
  return requireMember(request, workshopId, OPERATOR_ROLES);
}

export async function requireStaff(request, workshopId) {
  return requireMember(request, workshopId, STAFF_ROLES);
}
