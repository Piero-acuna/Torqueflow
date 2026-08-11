import { parseBody, requireOperator, resolveWorkshopId, send } from "../_lib/firebase-admin.js";
import { attachPhotosToOrder } from "../_lib/supabase-admin.js";

export default async function handler(request, response) {
  if (request.method !== "PATCH") {
    response.setHeader("Allow", "PATCH");
    return send(response, 405, { error: "Método no permitido." });
  }

  try {
    const body = parseBody(request);
    const workshopId = resolveWorkshopId(request, body);
    await requireOperator(request, workshopId);
    const { orderId, photoEvidence } = body;
    if (!orderId)      return send(response, 400, { error: "Falta el ID de la orden." });
    if (!Array.isArray(photoEvidence)) return send(response, 400, { error: "photoEvidence debe ser un array." });
    await attachPhotosToOrder(workshopId, orderId, photoEvidence);
    return send(response, 200, { updated: true });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
