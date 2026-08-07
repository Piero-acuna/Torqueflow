import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, parseBody, requireAdmin, send, workshopIdFromEnv } from "../_lib/firebase-admin.js";

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
    const workshopId = workshopIdFromEnv();
    const actor = await requireAdmin(request, workshopId);

    if (request.method === "POST") {
      const { email, password, displayName, role } = body;
      if (!email || !password || !displayName || !validateRole(role)) {
        return send(response, 400, { error: "Correo, contraseña, nombre y rol válido son obligatorios." });
      }
      const user = await adminAuth().createUser({ email, password, displayName, emailVerified: false, disabled: false });
      await adminDb().doc(`workshops/${workshopId}/members/${user.uid}`).set({
        uid: user.uid,
        email,
        displayName,
        role,
        active: true,
        createdBy: actor.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      return send(response, 201, { uid: user.uid, email, displayName, role });
    }

    const { uid } = body;
    if (!uid) return send(response, 400, { error: "El UID es obligatorio." });

    if (request.method === "PATCH") {
      const updates = {};
      if (body.email) updates.email = body.email;
      if (body.displayName) updates.displayName = body.displayName;
      if (typeof body.disabled === "boolean") updates.disabled = body.disabled;
      if (Object.keys(updates).length) await adminAuth().updateUser(uid, updates);
      const memberUpdates = { updatedAt: FieldValue.serverTimestamp() };
      if (body.email) memberUpdates.email = body.email;
      if (body.displayName) memberUpdates.displayName = body.displayName;
      if (body.role && validateRole(body.role)) memberUpdates.role = body.role;
      if (typeof body.active === "boolean") memberUpdates.active = body.active;
      await adminDb().doc(`workshops/${workshopId}/members/${uid}`).set(memberUpdates, { merge: true });
      return send(response, 200, { uid, updated: true });
    }

    if (uid === actor.uid) return send(response, 400, { error: "No puedes desactivar tu propia cuenta." });
    await adminAuth().updateUser(uid, { disabled: true });
    await adminDb().doc(`workshops/${workshopId}/members/${uid}`).set({ active: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return send(response, 200, { uid, disabled: true });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
