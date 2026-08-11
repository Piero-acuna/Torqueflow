import { parseBody, requireOperator, resolveWorkshopId, send } from "../_lib/firebase-admin.js";
import { addExternalJobToOrder, removeExternalJobFromOrder } from "../_lib/supabase-admin.js";

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
      if (!(body.description || "").trim())
        return send(response, 400, { error: "Describe el trabajo externo." });
      const job = await addExternalJobToOrder(workshopId, orderId, body, actor);
      return send(response, 201, { job });
    }

    const { jobId } = body;
    if (!jobId) return send(response, 400, { error: "Falta el ID del trabajo externo." });
    await removeExternalJobFromOrder(workshopId, orderId, jobId, actor);
    return send(response, 200, { removed: true });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
