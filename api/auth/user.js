import { adminAuth } from "../_lib/firebase-admin.js";
import { send } from "../_lib/firebase-admin.js";
import { getUserRecord } from "../_lib/supabase-admin.js";

/**
 * GET /api/auth/user
 *
 * Resuelve uid -> workshopId leyendo la tabla users de Supabase.
 * No requiere workshopId previo. Solo valida el token de Firebase Auth.
 */
export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return send(response, 405, { error: "Método no permitido." });
  }

  try {
    const authorization = request.headers.authorization || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return send(response, 401, { error: "Falta el token de autenticación." });

    const decoded = await adminAuth().verifyIdToken(token);
    const userRecord = await getUserRecord(decoded.uid);

    if (!userRecord) {
      return send(response, 404, { error: "Usuario no encontrado." });
    }

    return send(response, 200, { workshopId: userRecord.workshopId });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
