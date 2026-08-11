import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createClient } from "@supabase/supabase-js";

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

// Cliente Supabase interno para verificar membresías.
// Se instancia aquí (no se importa de supabase-admin.js) para evitar
// dependencias circulares: supabase-admin.js no importa de este módulo.
let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw Object.assign(
      new Error("SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están configurados."),
      { status: 500 }
    );
  }
  _supabase = createClient(url, key, { auth: { persistSession: false } });
  return _supabase;
}

const STAFF_ROLES    = ["admin", "advisor", "mechanic", "cashier"];
const OPERATOR_ROLES = ["admin", "advisor", "mechanic"];

async function verifiedActor(request) {
  const authorization = request.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) throw Object.assign(new Error("Falta el token de autenticación."), { status: 401 });
  return adminAuth().verifyIdToken(token);
}

/**
 * Verifica el token de Firebase Auth y que el usuario sea miembro activo del
 * taller en Supabase. Esta es la única barrera de aislamiento multi-taller:
 * toda función que acceda a datos de un taller DEBE pasar por aquí primero.
 */
export async function requireMember(request, workshopId, roles = STAFF_ROLES) {
  const decoded = await verifiedActor(request);
  const { data: member } = await getSupabase()
    .from("members")
    .select("role, active")
    .eq("workshop_id", workshopId)
    .eq("uid", decoded.uid)
    .maybeSingle();
  if (!member || member.active !== true || !roles.includes(member.role)) {
    throw Object.assign(new Error("No tienes permiso para esta acción."), { status: 403 });
  }
  return { ...decoded, role: member.role };
}

export function send(response, status, payload) {
  response.status(status).setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

export function parseBody(request) {
  return typeof request.body === "string"
    ? JSON.parse(request.body || "{}")
    : (request.body || {});
}

export function resolveWorkshopId(request, body) {
  const fromQuery =
    typeof request.query?.workshopId === "string" ? request.query.workshopId : null;
  const workshopId = fromQuery || body?.workshopId;
  if (!workshopId)
    throw Object.assign(new Error("Falta el taller (workshopId)."), { status: 400 });
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
