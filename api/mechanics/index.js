import { parseBody, requireAdmin, requireStaff, resolveWorkshopId, send } from "../_lib/firebase-admin.js";
import { createMechanic, listMechanics } from "../_lib/supabase-admin.js";

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
      const mechanics = await listMechanics(workshopId);
      return send(response, 200, { mechanics });
    }

    await requireAdmin(request, workshopId);
    if (!(body.name || "").trim()) return send(response, 400, { error: "El nombre es obligatorio." });
    const mechanic = await createMechanic(workshopId, body);
    return send(response, 201, { mechanic });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
