import { parseBody, requireAdmin, resolveWorkshopId, send } from "../_lib/firebase-admin.js";
import { deactivateMechanic, updateMechanic } from "../_lib/supabase-admin.js";

export default async function handler(request, response) {
  if (!["PATCH", "DELETE"].includes(request.method)) {
    response.setHeader("Allow", "PATCH, DELETE");
    return send(response, 405, { error: "Método no permitido." });
  }

  const { id } = request.query;
  if (!id) return send(response, 400, { error: "Falta el identificador del mecánico." });

  try {
    const body = parseBody(request);
    const workshopId = resolveWorkshopId(request, body);
    await requireAdmin(request, workshopId);

    if (request.method === "PATCH") {
      const mechanic = await updateMechanic(workshopId, id, body);
      return send(response, 200, { mechanic });
    }
    const result = await deactivateMechanic(workshopId, id);
    return send(response, 200, { mechanic: result });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
