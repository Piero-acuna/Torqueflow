import { parseBody, requireOperator, requireStaff, resolveWorkshopId, send } from "../_lib/firebase-admin.js";
import { createClient, listClients } from "../_lib/dataconnect-admin.js";

function validateInput(body) {
  const name = (body.name || "").trim();
  if (!name) return "El nombre es obligatorio.";
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return "El correo no es válido.";
  return null;
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
      const search = typeof request.query?.search === "string" ? request.query.search : "";
      const clients = await listClients(workshopId, search);
      return send(response, 200, { clients });
    }

    const actor = await requireOperator(request, workshopId);
    const validationError = validateInput(body);
    if (validationError) return send(response, 400, { error: validationError });

    const client = await createClient(workshopId, {
      type: body.type || "person",
      documentType: body.documentType || null,
      documentNumber: body.documentNumber || null,
      name: body.name.trim(),
      phone: body.phone || null,
      email: body.email || null,
      address: body.address || null,
      segment: body.segment || "new",
      creditLimit: body.creditLimit ? Number(body.creditLimit) : 0,
      notes: body.notes || null
    });
    return send(response, 201, { client, createdBy: actor.uid });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
