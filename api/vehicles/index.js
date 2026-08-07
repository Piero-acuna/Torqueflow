import { parseBody, requireOperator, requireStaff, send, workshopIdFromEnv } from "../_lib/firebase-admin.js";
import { createVehicle, listVehicles } from "../_lib/dataconnect-admin.js";

function validateInput(body) {
  if (!body.clientId) return "El cliente es obligatorio.";
  if (!(body.plate || "").trim()) return "La placa es obligatoria.";
  return null;
}

export default async function handler(request, response) {
  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return send(response, 405, { error: "Método no permitido." });
  }

  try {
    const workshopId = workshopIdFromEnv();

    if (request.method === "GET") {
      await requireStaff(request, workshopId);
      const clientId = typeof request.query?.clientId === "string" ? request.query.clientId : null;
      const search = typeof request.query?.search === "string" ? request.query.search : "";
      const vehicles = await listVehicles(workshopId, clientId, search);
      return send(response, 200, { vehicles });
    }

    const actor = await requireOperator(request, workshopId);
    const body = parseBody(request);
    const validationError = validateInput(body);
    if (validationError) return send(response, 400, { error: validationError });

    const vehicle = await createVehicle(workshopId, {
      clientId: body.clientId,
      plate: body.plate.trim().toUpperCase(),
      brand: (body.brand || "").trim() || null,
      model: (body.model || "").trim() || null,
      year: body.year ? Number(body.year) : null,
      color: body.color || null,
      mileage: body.mileage ? Number(body.mileage) : null,
      fuelType: body.fuelType || null,
      vin: body.vin || null,
      notes: body.notes || null
    });
    return send(response, 201, { vehicle, createdBy: actor.uid });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
