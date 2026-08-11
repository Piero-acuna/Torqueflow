import { parseBody, requireAdmin, requireMember, resolveWorkshopId, send } from "./_lib/firebase-admin.js";
import { getSupabaseAdmin, toMechanic } from "./_lib/supabase-admin.js";

function getId(request) {
  const segments = new URL(request.url, "http://localhost").pathname.split("/").filter(Boolean);
  return segments[2] || null; // ["api", "mechanics", ":id"]
}

export default async function handler(request, response) {
  const body = parseBody(request);
  const workshopId = resolveWorkshopId(request, body);
  const id = getId(request);
  const method = request.method;

  try {
    // ── /api/mechanics/:id ──────────────────────────────────────────────────
    if (id) {
      if (method === "PATCH") {
        await requireAdmin(request, workshopId);
        const updates = {};
        if (body.name      !== undefined) updates.name       = body.name;
        if (body.phone     !== undefined) updates.phone      = body.phone;
        if (body.specialty !== undefined) updates.specialty  = body.specialty;
        if (body.hourlyCost !== undefined) updates.hourly_cost = Number(body.hourlyCost);
        if (body.active    !== undefined) updates.active     = Boolean(body.active);
        if (!Object.keys(updates).length) return send(response, 400, { error: "Sin campos válidos." });
        const { data, error } = await getSupabaseAdmin().from("mechanics").update(updates).eq("id", id).eq("workshop_id", workshopId).select("*").single();
        if (error) throw new Error(error.message);
        return send(response, 200, { mechanic: toMechanic(data) });
      }
      if (method === "DELETE") {
        await requireAdmin(request, workshopId);
        const { error } = await getSupabaseAdmin().from("mechanics").update({ active: false }).eq("id", id).eq("workshop_id", workshopId);
        if (error) throw new Error(error.message);
        return send(response, 200, { ok: true });
      }
      return send(response, 405, { error: "Método no permitido." });
    }

    // ── /api/mechanics (list + create) ──────────────────────────────────────
    if (method === "GET") {
      await requireMember(request, workshopId);
      const { data, error } = await getSupabaseAdmin().from("mechanics").select("*").eq("workshop_id", workshopId).order("name");
      if (error) throw new Error(error.message);
      return send(response, 200, { mechanics: (data || []).map(toMechanic) });
    }
    if (method === "POST") {
      await requireAdmin(request, workshopId);
      const { name, phone, specialty, hourlyCost } = body;
      if (!name?.trim()) return send(response, 400, { error: "El nombre es obligatorio." });
      const { data, error } = await getSupabaseAdmin().from("mechanics").insert({ workshop_id: workshopId, name: name.trim(), phone: phone || "", specialty: specialty || "", hourly_cost: Number(hourlyCost || 0), active: true }).select("*").single();
      if (error) throw new Error(error.message);
      return send(response, 201, { mechanic: toMechanic(data) });
    }
    return send(response, 405, { error: "Método no permitido." });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
