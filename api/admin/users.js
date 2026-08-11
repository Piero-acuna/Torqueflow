import { adminAuth } from "../_lib/firebase-admin.js";
import { parseBody, requireAdmin, resolveWorkshopId, send } from "../_lib/firebase-admin.js";
import { createMember, createUserRecord, updateMember } from "../_lib/supabase-admin.js";

function validateRole(role) {
  return ["admin", "advisor", "mechanic", "cashier"].includes(role);
}

export default async function handler(request, response) {
  if (!["POST", "PATCH", "DELETE"].includes(request.method)) {
    response.setHeader("Allow", "POST, PATCH, DELETE");
    return send(response, 405, { error: "Método no permitido." });
  }

  try {
    const body = parseBody(request);
    const workshopId = resolveWorkshopId(request, body);
    const actor = await requireAdmin(request, workshopId);

    if (request.method === "POST") {
      const { email, password, displayName, role } = body;
      if (!email || !password || !displayName || !validateRole(role)) {
        return send(response, 400, { error: "Correo, contraseña, nombre y rol válido son obligatorios." });
      }
      const user = await adminAuth().createUser({
        email, password, displayName, emailVerified: false, disabled: false
      });
      await Promise.all([
        createMember(workshopId, { uid: user.uid, email, displayName, role, createdBy: actor.uid }),
        createUserRecord(user.uid, workshopId, email)
      ]);
      return send(response, 201, { uid: user.uid, email, displayName, role });
    }

    const { uid } = body;
    if (!uid) return send(response, 400, { error: "El UID es obligatorio." });

    if (request.method === "PATCH") {
      const authUpdates = {};
      if (body.email)                           authUpdates.email       = body.email;
      if (body.displayName)                     authUpdates.displayName = body.displayName;
      if (typeof body.disabled === "boolean")   authUpdates.disabled    = body.disabled;
      if (Object.keys(authUpdates).length) await adminAuth().updateUser(uid, authUpdates);

      const memberUpdates = {};
      if (body.email)                           memberUpdates.email       = body.email;
      if (body.displayName)                     memberUpdates.displayName = body.displayName;
      if (body.role && validateRole(body.role)) memberUpdates.role        = body.role;
      if (typeof body.active === "boolean")     memberUpdates.active      = body.active;
      await updateMember(workshopId, uid, memberUpdates);
      return send(response, 200, { uid, updated: true });
    }

    // DELETE
    if (uid === actor.uid)
      return send(response, 400, { error: "No puedes desactivar tu propia cuenta." });
    await adminAuth().updateUser(uid, { disabled: true });
    await updateMember(workshopId, uid, { active: false });
    return send(response, 200, { uid, disabled: true });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
