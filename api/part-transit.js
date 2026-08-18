import { parseBody, requireOperator, resolveWorkshopId, send } from "./_lib/firebase-admin.js";
import { getSupabaseAdmin, toPartTransit } from "./_lib/supabase-admin.js";

function getId(request) {
  const segments = new URL(request.url, "http://localhost").pathname.split("/").filter(Boolean);
  return segments[2] || null;
}

export default async function handler(request, response) {
  try {
    const body = parseBody(request);
    const workshopId = resolveWorkshopId(request, body);
    const id = getId(request);
    const method = request.method;
    const actor = await requireOperator(request, workshopId);

    // ── /api/part-transit/:id — recibir o cancelar un envío puntual ─────────
    if (id) {
      if (method !== "PATCH") {
        response.setHeader("Allow", "PATCH");
        return send(response, 405, { error: "Método no permitido." });
      }
      const { action } = body;

      if (action === "receive") {
        const { data, error } = await getSupabaseAdmin().rpc("receive_part_transit", {
          p_workshop_id: workshopId,
          p_transit_id:  id,
          p_actor_id:    actor.uid,
          p_actor_name:  actor.name || actor.email || "Sistema"
        });
        if (error) throw Object.assign(new Error(error.message), { status: error.code === "P0001" ? 400 : 502 });
        return send(response, 200, { result: data });
      }

      if (action === "cancel") {
        const { data, error } = await getSupabaseAdmin()
          .from("part_transit")
          .update({ status: "cancelled" })
          .eq("id", id).eq("workshop_id", workshopId).eq("status", "in_transit")
          .select("*").single();
        if (error) throw new Error(error.message);
        if (!data) return send(response, 409, { error: "El envío ya no está en tránsito." });
        return send(response, 200, { transit: toPartTransit(data) });
      }

      return send(response, 400, { error: "action debe ser 'receive' o 'cancel'." });
    }

    // ── GET /api/part-transit — listar envíos en tránsito del taller ────────
    if (method === "GET") {
      const qs = new URL(request.url, "http://localhost").searchParams;
      const status = qs.get("status"); // opcional: in_transit | received | cancelled
      let query = getSupabaseAdmin().from("part_transit").select("*").eq("workshop_id", workshopId).order("expected_date", { ascending: true, nullsFirst: false });
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return send(response, 200, { transit: (data || []).map(toPartTransit) });
    }

    // ── POST /api/part-transit — registrar un nuevo envío en tránsito ───────
    if (method === "POST") {
      const { partId, quantity, unitCost, supplier, reference, expectedDate, notes } = body;
      if (!partId) return send(response, 400, { error: "partId es requerido." });
      if (!(Number(quantity) > 0)) return send(response, 400, { error: "La cantidad debe ser mayor a cero." });

      const { data: part, error: partError } = await getSupabaseAdmin()
        .from("parts").select("id, name").eq("id", partId).eq("workshop_id", workshopId).single();
      if (partError || !part) return send(response, 404, { error: "Repuesto no encontrado en este taller." });

      const { data, error } = await getSupabaseAdmin().from("part_transit").insert({
        workshop_id:   workshopId,
        part_id:       part.id,
        part_name:     part.name,
        quantity:      Number(quantity),
        unit_cost:     Number(unitCost || 0),
        supplier:      supplier || "",
        reference:     reference || "",
        expected_date: expectedDate || null,
        notes:         notes || "",
        status:        "in_transit",
        actor_id:      actor.uid,
        actor_name:    actor.name || actor.email || "Sistema"
      }).select("*").single();
      if (error) throw new Error(error.message);
      return send(response, 201, { transit: toPartTransit(data) });
    }

    response.setHeader("Allow", "GET, POST, PATCH");
    return send(response, 405, { error: "Método no permitido." });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
