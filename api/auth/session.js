import { parseBody, requireStaff, resolveWorkshopId, send } from "../_lib/firebase-admin.js";
import { getSupabaseAdmin } from "../_lib/supabase-admin.js";

/**
 * GET /api/auth/session?workshopId=xxx
 *
 * Verifica el token de Firebase Auth y devuelve los datos del taller y
 * del miembro autenticado desde Supabase. Lo llama AuthContext.jsx justo
 * después del login para resolver workshopId → member sin pasar por Firestore.
 */
export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return send(response, 405, { error: "Método no permitido." });
  }

  try {
    const workshopId = resolveWorkshopId(request, {});
    const actor = await requireStaff(request, workshopId);

    const supabase = getSupabaseAdmin();

    const [{ data: workshop }, { data: member }] = await Promise.all([
      supabase.from("workshops").select("id, business_name, currency, order_prefix").eq("id", workshopId).maybeSingle(),
      supabase.from("members").select("id, uid, email, display_name, role, active").eq("workshop_id", workshopId).eq("uid", actor.uid).maybeSingle()
    ]);

    if (!workshop || !member) {
      return send(response, 404, { error: "Taller o miembro no encontrado." });
    }

    return send(response, 200, {
      workshopId: workshop.id,
      workshop: {
        id: workshop.id,
        businessName: workshop.business_name,
        currency: workshop.currency,
        orderPrefix: workshop.order_prefix
      },
      member: {
        id: member.id,
        uid: member.uid,
        email: member.email,
        displayName: member.display_name,
        role: member.role,
        active: member.active
      }
    });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
