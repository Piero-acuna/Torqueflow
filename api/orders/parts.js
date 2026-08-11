import { parseBody, requireOperator, resolveWorkshopId, send } from "../_lib/firebase-admin.js";
import { addPartToOrderRpc, removePartFromOrderRpc } from "../_lib/supabase-admin.js";

export default async function handler(request, response) {
  if (!["POST", "DELETE"].includes(request.method)) {
    response.setHeader("Allow", "POST, DELETE");
    return send(response, 405, { error: "Método no permitido." });
  }

  try {
    const body = parseBody(request);
    const workshopId = resolveWorkshopId(request, body);
    const actor = await requireOperator(request, workshopId);
    const orderId = body.orderId;
    if (!orderId) return send(response, 400, { error: "Falta el ID de la orden." });

    if (request.method === "POST") {
      const { partId, quantity, unitPrice } = body;
      if (!partId)          return send(response, 400, { error: "Falta el ID del repuesto." });
      if (!(quantity > 0))  return send(response, 400, { error: "La cantidad debe ser mayor a cero." });
      const line = await addPartToOrderRpc(
        orderId, partId, Number(quantity), Number(unitPrice || 0), actor
      );
      return send(response, 201, { line });
    }

    const { lineId } = body;
    if (!lineId) return send(response, 400, { error: "Falta el ID de la línea." });
    const result = await removePartFromOrderRpc(orderId, lineId, actor);
    return send(response, 200, { result });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
