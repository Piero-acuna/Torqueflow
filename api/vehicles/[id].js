import { parseBody, requireAdmin, requireOperator, requireStaff, resolveWorkshopId, send } from "../_lib/firebase-admin.js";
import { deactivateVehicle, getVehicle, updateVehicle } from "../_lib/dataconnect-admin.js";

export default async function handler(request, response) {
  if (!["GET", "PATCH", "DELETE"].includes(request.method)) {
    response.setHeader("Allow", "GET, PATCH, DELETE");
    return send(response, 405, { error: "Método no permitido." });
  }

  const { id } = request.query;
  if (!id) return send(response, 400, { error: "Falta el identificador del vehículo." });

  try {
    const body = request.method === "GET" ? {} : parseBody(request);
    const workshopId = resolveWorkshopId(request, body);

    if (request.method === "GET") {
      await requireStaff(request, workshopId);
      const vehicle = await getVehicle(workshopId, id);
      if (!vehicle) return send(response, 404, { error: "Vehículo no encontrado." });
      return send(response, 200, { vehicle });
    }

    if (request.method === "PATCH") {
      await requireOperator(request, workshopId);
      const vehicle = await updateVehicle(workshopId, id, {
        plate: body.plate?.trim().toUpperCase() || undefined,
        brand: body.brand?.trim() || undefined,
        model: body.model?.trim() || undefined,
        year: body.year ? Number(body.year) : undefined,
        color: body.color ?? undefined,
        mileage: body.mileage ? Number(body.mileage) : undefined,
        fuelType: body.fuelType ?? undefined,
        vin: body.vin ?? undefined,
        notes: body.notes ?? undefined
      });
      return send(response, 200, { vehicle });
    }

    await requireAdmin(request, workshopId);
    const result = await deactivateVehicle(workshopId, id);
    return send(response, 200, { vehicle: result });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
