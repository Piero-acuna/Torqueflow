import { parseBody, requireOperator, requireStaff, resolveWorkshopId, send } from "../_lib/firebase-admin.js";
import { listStockMovements, registerStockMovementRpc } from "../_lib/supabase-admin.js";
import { STOCK_MOVEMENT_TYPES } from "../../src/config/constants.js";

function movementDirection(type) {
  const found = (STOCK_MOVEMENT_TYPES || []).find((item) => item.value === type);
  return found?.direction || 0;
}

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
      const partId = typeof request.query?.partId === "string" ? request.query.partId : null;
      const movements = await listStockMovements(workshopId, partId);
      return send(response, 200, { movements });
    }

    const actor = await requireOperator(request, workshopId);
    const { partId, type, quantity } = body;
    if (!partId)        return send(response, 400, { error: "Falta el ID del repuesto." });
    if (!type)          return send(response, 400, { error: "Falta el tipo de movimiento." });
    if (!(quantity > 0)) return send(response, 400, { error: "La cantidad debe ser mayor a cero." });

    const direction = movementDirection(type);
    if (!direction) return send(response, 400, { error: "Tipo de movimiento no válido." });

    const result = await registerStockMovementRpc(workshopId, body, direction, actor);
    return send(response, 201, { result });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
