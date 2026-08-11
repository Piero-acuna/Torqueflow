import { adminAuth } from "./_lib/firebase-admin.js";
import { parseBody, requireAdmin, resolveWorkshopId, send } from "./_lib/firebase-admin.js";
import { getSupabaseAdmin } from "./_lib/supabase-admin.js";

export default async function handler(request, response) {
  const body = parseBody(request);
  const workshopId = resolveWorkshopId(request, body);

  try {
    await requireAdmin(request, workshopId);

    if (request.method === "POST") {
      const { email, password, displayName, role } = body;
      if (!email || !password || !displayName) return send(response, 400, { error: "email, password y displayName son requeridos." });

      let createdUser = null;
      try {
        try { await adminAuth().getUserByEmail(email); return send(response, 409, { error: "Ya existe una cuenta con ese correo." }); }
        catch (lookupError) { if (lookupError.code !== "auth/user-not-found") throw lookupError; }

        createdUser = await adminAuth().createUser({ email, password, displayName, emailVerified: false, disabled: false });
        const supabase = getSupabaseAdmin();
        const [{ error: memberError }, { error: userError }] = await Promise.all([
          supabase.from("members").insert({ workshop_id: workshopId, uid: createdUser.uid, email, display_name: displayName, role: role || "advisor", active: true }),
          supabase.from("users").insert({ uid: createdUser.uid, workshop_id: workshopId, email })
        ]);
        if (memberError) throw memberError;
        if (userError)   throw userError;
        return send(response, 201, { uid: createdUser.uid });
      } catch (error) {
        if (createdUser) await adminAuth().deleteUser(createdUser.uid).catch(() => {});
        throw error;
      }
    }

    if (request.method === "PATCH") {
      const { uid, displayName, role, active } = body;
      if (!uid) return send(response, 400, { error: "uid es requerido." });
      const updates = {};
      if (displayName !== undefined) updates.display_name = displayName;
      if (role        !== undefined) updates.role         = role;
      if (active      !== undefined) updates.active       = Boolean(active);
      if (Object.keys(updates).length) {
        const { error } = await getSupabaseAdmin().from("members").update(updates).eq("uid", uid).eq("workshop_id", workshopId);
        if (error) throw new Error(error.message);
      }
      if (displayName) await adminAuth().updateUser(uid, { displayName }).catch(() => {});
      return send(response, 200, { ok: true });
    }

    if (request.method === "DELETE") {
      const { uid } = body;
      if (!uid) return send(response, 400, { error: "uid es requerido." });
      await getSupabaseAdmin().from("members").update({ active: false }).eq("uid", uid).eq("workshop_id", workshopId);
      return send(response, 200, { ok: true });
    }

    response.setHeader("Allow", "POST, PATCH, DELETE");
    return send(response, 405, { error: "Método no permitido." });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
