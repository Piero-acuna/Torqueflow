import { parseBody, requireAdmin, requireOperator, requireStaff, resolveWorkshopId, send } from "../_lib/firebase-admin.js";
import { deleteOrder, getOrder, updateOrder } from "../_lib/supabase-admin.js";

export default async function handler(request, response) {
  if (!["GET", "PATCH", "DELETE"].includes(request.method)) {
    response.setHeader("Allow", "GET, PATCH, DELETE");
    return send(response, 405, { error: "Método no permitido." });
  }

  const { id } = request.query;
  if (!id) return send(response, 400, { error: "Falta el identificador de la orden." });

  try {
    const body = request.method === "GET" ? {} : parseBody(request);
    const workshopId = resolveWorkshopId(request, body);

    if (request.method === "GET") {
      await requireStaff(request, workshopId);
      const order = await getOrder(workshopId, id);
      if (!order) return send(response, 404, { error: "Orden no encontrada." });
      return send(response, 200, { order });
    }

    if (request.method === "PATCH") {
      const actor = await requireOperator(request, workshopId);
      const order = await updateOrder(workshopId, id, body, actor);
      return send(response, 200, { order });
    }

    await requireAdmin(request, workshopId);
    const result = await deleteOrder(workshopId, id);
    return send(response, 200, { order: result });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
