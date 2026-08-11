import { parseBody, requireAdmin, requireOperator, requireStaff, resolveWorkshopId, send } from "../_lib/firebase-admin.js";
import { createPart, listParts } from "../_lib/supabase-admin.js";

export default async function handler(request, response) {
  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return send(response, 405, { error: "Método no permitido." });
  }

  try {
    const body = request.method === "GET" ? {} : parseBody(request);
    const workshopId = resolveWorkshopId(request, body);

    if (request.method === "GET") {
      await requireStaff(request, workshopId);
      const search = typeof request.query?.search === "string" ? request.query.search : "";
      const parts = await listParts(workshopId, search);
      return send(response, 200, { parts });
    }

    const actor = await requireOperator(request, workshopId);
    if (!(body.name || "").trim()) return send(response, 400, { error: "El nombre es obligatorio." });
    const part = await createPart(workshopId, body);
    return send(response, 201, { part, createdBy: actor.uid });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
