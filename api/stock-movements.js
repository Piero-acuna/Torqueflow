import { parseBody, requireOperator, resolveWorkshopId, send } from "./_lib/firebase-admin.js";
import { getSupabaseAdmin } from "./_lib/supabase-admin.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return send(response, 405, { error: "Método no permitido." });
  }
  const body = parseBody(request);
  const workshopId = resolveWorkshopId(request, body);

  try {
    await requireOperator(request, workshopId);
    const { partId, type, quantity, unitCost, reference, supplier, notes, partName } = body;
    if (!partId || !type) return send(response, 400, { error: "partId y type son requeridos." });
    const { data, error } = await getSupabaseAdmin().rpc("register_stock_movement", {
      p_workshop_id: workshopId,
      p_part_id:     partId,
      p_type:        type,
      p_quantity:    Number(quantity || 0),
      p_unit_cost:   Number(unitCost || 0),
      p_reference:   reference || "",
      p_supplier:    supplier  || "",
      p_notes:       notes     || "",
      p_part_name:   partName  || ""
    });
    if (error) throw Object.assign(new Error(error.message), { status: error.code === "P0001" ? 400 : 502 });
    return send(response, 200, { result: data });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
