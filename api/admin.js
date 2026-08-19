import { adminAuth, parseBody, requireAdmin, resolveWorkshopId, send } from "./_lib/firebase-admin.js";
import { getSupabaseAdmin, toMember } from "./_lib/supabase-admin.js";

// C1: whitelist estricta de roles — la DB ya tiene CHECK constraint, pero
// validamos aquí también para evitar errores 500 con mensajes de Postgres
// expuestos al cliente, y para tener un mensaje de error legible.
const ALLOWED_ROLES = new Set(["admin", "advisor", "mechanic", "cashier"]);

export default async function handler(request, response) {
  try {
    const body = parseBody(request);
    const workshopId = resolveWorkshopId(request, body);

    // requireAdmin devuelve el actor (uid + role) del token verificado.
    // Lo guardamos para las comprobaciones de C2 (anti-automodificación).
    const actor = await requireAdmin(request, workshopId);

    // ── GET /api/admin/users — lista los miembros del taller ────────────────
    if (request.method === "GET") {
      const { data, error } = await getSupabaseAdmin()
        .from("members")
        .select("*")
        .eq("workshop_id", workshopId)
        .order("display_name");
      if (error) throw new Error(error.message);
      return send(response, 200, { members: (data || []).map(toMember) });
    }

    if (request.method === "POST") {
      const { email, password, displayName, role } = body;

      // C4: validaciones de entrada antes de tocar Firebase / Supabase
      if (!email || !displayName)
        return send(response, 400, { error: "email y displayName son requeridos." });
      if (!password || password.length < 8)
        return send(response, 400, { error: "La contraseña debe tener al menos 8 caracteres." });
      if (!/[0-9]/.test(password))
        return send(response, 400, { error: "La contraseña debe contener al menos un número." });

      // C1: solo roles válidos del sistema
      const assignedRole = role || "advisor";
      if (!ALLOWED_ROLES.has(assignedRole))
        return send(response, 400, { error: `Rol no válido. Permitidos: ${[...ALLOWED_ROLES].join(", ")}.` });

      let createdUser = null;
      try {
        try {
          await adminAuth().getUserByEmail(email);
          return send(response, 409, { error: "Ya existe una cuenta con ese correo." });
        } catch (lookupError) {
          if (lookupError.code !== "auth/user-not-found") throw lookupError;
        }

        createdUser = await adminAuth().createUser({ email, password, displayName, emailVerified: false, disabled: false });
        const supabase = getSupabaseAdmin();
        const [{ error: memberError }, { error: userError }] = await Promise.all([
          supabase.from("members").insert({ workshop_id: workshopId, uid: createdUser.uid, email, display_name: displayName, role: assignedRole, active: true }),
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

      // C2: un admin no puede modificar su propio rol ni desactivar su propia cuenta
      if (uid === actor.uid)
        return send(response, 403, { error: "No puedes modificar tu propio rol o estado de cuenta." });

      // C1: si llega un rol, verificar que sea válido
      if (role !== undefined && !ALLOWED_ROLES.has(role))
        return send(response, 400, { error: `Rol no válido. Permitidos: ${[...ALLOWED_ROLES].join(", ")}.` });

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

      // C2: un admin no puede desactivar su propia cuenta
      if (uid === actor.uid)
        return send(response, 403, { error: "No puedes desactivar tu propia cuenta." });

      await getSupabaseAdmin().from("members").update({ active: false }).eq("uid", uid).eq("workshop_id", workshopId);
      return send(response, 200, { ok: true });
    }

    response.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return send(response, 405, { error: "Método no permitido." });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
