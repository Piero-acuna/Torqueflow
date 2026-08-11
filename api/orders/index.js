import { parseBody, requireOperator, requireStaff, resolveWorkshopId, send } from "../_lib/firebase-admin.js";
import { createOrderRpc, listOrders } from "../_lib/supabase-admin.js";

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
      const filters = {};
      if (request.query?.status)   filters.status   = request.query.status;
      if (request.query?.clientId) filters.clientId = request.query.clientId;
      const orders = await listOrders(workshopId, filters);
      return send(response, 200, { orders });
    }

    const actor = await requireOperator(request, workshopId);
    const payload = {
      clientId:          body.clientId          || null,
      vehicleId:         body.vehicleId         || null,
      mechanicId:        body.mechanicId        || null,
      clientName:        body.clientName        || "",
      clientPhone:       body.clientPhone       || "",
      vehicleLabel:      body.vehicleLabel      || "",
      plate:             body.plate             || "",
      mechanicName:      body.mechanicName      || "",
      status:            body.status            || "review",
      priority:          body.priority          || "normal",
      paymentStatus:     body.paymentStatus     || "pending",
      approvalStatus:    body.approvalStatus    || "pending",
      customerComplaint: body.customerComplaint || "",
      diagnosis:         body.diagnosis         || "",
      inspectionNotes:   body.inspectionNotes   || "",
      internalNotes:     body.internalNotes     || "",
      serviceLines:      body.serviceLines      || [],
      laborCost:         Number(body.laborCost  || 0),
      otherCosts:        Number(body.otherCosts || 0),
      discount:          Number(body.discount   || 0),
      budget:            Number(body.budget     || 0),
      fuelLevel:         body.fuelLevel         != null ? Number(body.fuelLevel) : null,
      mileage:           body.mileage           != null ? Number(body.mileage)   : null,
      promisedAt:        body.promisedAt        || "",
      enteredAt:         body.enteredAt         || "",
      createdBy:         actor.uid,
      timeline:          [{
        id:          crypto.randomUUID(),
        type:        "created",
        description: "Orden creada",
        actorId:     actor.uid,
        actorName:   actor.displayName || actor.email || "",
        createdAt:   new Date().toISOString()
      }]
    };

    const order = await createOrderRpc(workshopId, payload);
    return send(response, 201, { order });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
