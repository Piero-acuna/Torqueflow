import { parseBody, requireAdmin, requireStaff, resolveWorkshopId, send } from "../_lib/firebase-admin.js";
import {
  createService, createServiceCategory,
  listServiceCategories, listServices
} from "../_lib/supabase-admin.js";

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
      const type = request.query?.type;
      if (type === "categories") {
        const categories = await listServiceCategories(workshopId);
        return send(response, 200, { categories });
      }
      const [services, categories] = await Promise.all([
        listServices(workshopId),
        listServiceCategories(workshopId)
      ]);
      return send(response, 200, { services, categories });
    }

    await requireAdmin(request, workshopId);
    if (body.isCategory) {
      if (!(body.name || "").trim()) return send(response, 400, { error: "El nombre es obligatorio." });
      const category = await createServiceCategory(workshopId, body);
      return send(response, 201, { category });
    }
    if (!(body.name || "").trim()) return send(response, 400, { error: "El nombre es obligatorio." });
    const service = await createService(workshopId, body);
    return send(response, 201, { service });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
