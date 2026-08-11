import { parseBody, requireAdmin, requireOperator, requireStaff, resolveWorkshopId, send } from "../_lib/firebase-admin.js";
import { deactivatePart, getPart, updatePart } from "../_lib/supabase-admin.js";

export default async function handler(request, response) {
  if (!["GET", "PATCH", "DELETE"].includes(request.method)) {
    response.setHeader("Allow", "GET, PATCH, DELETE");
    return send(response, 405, { error: "Método no permitido." });
  }

  const { id } = request.query;
  if (!id) return send(response, 400, { error: "Falta el identificador del repuesto." });

  try {
    const body = request.method === "GET" ? {} : parseBody(request);
    const workshopId = resolveWorkshopId(request, body);

    if (request.method === "GET") {
      await requireStaff(request, workshopId);
      const part = await getPart(workshopId, id);
      if (!part) return send(response, 404, { error: "Repuesto no encontrado." });
      return send(response, 200, { part });
    }

    if (request.method === "PATCH") {
      await requireOperator(request, workshopId);
      const part = await updatePart(workshopId, id, body);
      return send(response, 200, { part });
    }

    await requireAdmin(request, workshopId);
    const result = await deactivatePart(workshopId, id);
    return send(response, 200, { part: result });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
