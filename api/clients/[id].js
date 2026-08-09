import { parseBody, requireAdmin, requireOperator, requireStaff, resolveWorkshopId, send } from "../_lib/firebase-admin.js";
import { deactivateClient, getClientWithVehicles, updateClient } from "../_lib/supabase-admin.js";

export default async function handler(request, response) {
  if (!["GET", "PATCH", "DELETE"].includes(request.method)) {
    response.setHeader("Allow", "GET, PATCH, DELETE");
    return send(response, 405, { error: "Método no permitido." });
  }

  const { id } = request.query;
  if (!id) return send(response, 400, { error: "Falta el identificador del cliente." });

  try {
    const body = request.method === "GET" ? {} : parseBody(request);
    const workshopId = resolveWorkshopId(request, body);

    if (request.method === "GET") {
      await requireStaff(request, workshopId);
      const client = await getClientWithVehicles(workshopId, id);
      if (!client) return send(response, 404, { error: "Cliente no encontrado." });
      return send(response, 200, { client });
    }

    if (request.method === "PATCH") {
      await requireOperator(request, workshopId);
      if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        return send(response, 400, { error: "El correo no es válido." });
      }
      const client = await updateClient(workshopId, id, {
        type: body.type ?? undefined,
        documentType: body.documentType ?? null,
        documentNumber: body.documentNumber ?? null,
        name: body.name?.trim() || undefined,
        phone: body.phone ?? null,
        email: body.email ?? null,
        address: body.address ?? null,
        segment: body.segment ?? undefined,
        creditLimit: body.creditLimit !== undefined ? Number(body.creditLimit) : undefined,
        notes: body.notes ?? null
      });
      return send(response, 200, { client });
    }

    await requireAdmin(request, workshopId);
    const result = await deactivateClient(workshopId, id);
    return send(response, 200, { client: result });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
