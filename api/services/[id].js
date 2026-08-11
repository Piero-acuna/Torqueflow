import { parseBody, requireAdmin, resolveWorkshopId, send } from "../_lib/firebase-admin.js";
import {
  deactivateService, deactivateServiceCategory,
  updateService, updateServiceCategory
} from "../_lib/supabase-admin.js";

export default async function handler(request, response) {
  if (!["PATCH", "DELETE"].includes(request.method)) {
    response.setHeader("Allow", "PATCH, DELETE");
    return send(response, 405, { error: "Método no permitido." });
  }

  const { id } = request.query;
  if (!id) return send(response, 400, { error: "Falta el identificador." });

  try {
    const body = parseBody(request);
    const workshopId = resolveWorkshopId(request, body);
    await requireAdmin(request, workshopId);

    if (body.isCategory) {
      if (request.method === "PATCH") {
        const category = await updateServiceCategory(workshopId, id, body);
        return send(response, 200, { category });
      }
      const result = await deactivateServiceCategory(workshopId, id);
      return send(response, 200, { category: result });
    }

    if (request.method === "PATCH") {
      const service = await updateService(workshopId, id, body);
      return send(response, 200, { service });
    }
    const result = await deactivateService(workshopId, id);
    return send(response, 200, { service: result });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
