import { parseBody, requireOperator, resolveWorkshopId, send } from "./_lib/firebase-admin.js";
import { getSupabaseAdmin } from "./_lib/supabase-admin.js";

// direction: +1 = entrada (compra, ajuste+), -1 = salida (consumo, ajuste-)
const MOVEMENT_DIRECTIONS = {
  purchase:      1,
  return:        1,
  adjustment_in: 1,
  adjustment_out: -1,
  order_use:    -1,
  order_return:  1,
  waste:        -1,
  transfer_in:   1,
  transfer_out: -1
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return send(response, 405, { error: "Método no permitido." });
  }
  const body = parseBody(request);
  const workshopId = resolveWorkshopId(request, body);

  try {
    const actor = await requireOperator(request, workshopId);
    const { partId, type, quantity, unitCost, reference, supplier, notes, partName } = body;
    if (!partId || !type) return send(response, 400, { error: "partId y type son requeridos." });

    const direction = MOVEMENT_DIRECTIONS[type] ?? 1;

    const { data, error } = await getSupabaseAdmin().rpc("register_stock_movement", {
      p_workshop_id: workshopId,
      p_part_id:     partId,
      p_type:        type,
      p_direction:   direction,
      p_quantity:    Number(quantity || 0),
      p_unit_cost:   Number(unitCost || 0),
      p_reference:   reference  || "",
      p_supplier:    supplier   || "",
      p_notes:       notes      || "",
      p_actor_id:    actor.uid,
      p_actor_name:  actor.name || actor.email || "Sistema"
    });
    if (error) throw Object.assign(new Error(error.message), { status: error.code === "P0001" ? 400 : 502 });
    return send(response, 200, { result: data });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
