import { parseBody, requireMember, requireOperator, resolveWorkshopId, send } from "./_lib/firebase-admin.js";
import { getSupabaseAdmin, toVehicle } from "./_lib/supabase-admin.js";

function getId(request) {
  const segments = new URL(request.url, "http://localhost").pathname.split("/").filter(Boolean);
  return segments[2] || null;
}

export default async function handler(request, response) {
  const body = parseBody(request);
  const workshopId = resolveWorkshopId(request, body);
  const id = getId(request);
  const method = request.method;

  try {
    if (id) {
      if (method === "PATCH") {
        await requireOperator(request, workshopId);
        const updates = {};
        if (body.plate   !== undefined) updates.plate    = body.plate?.toUpperCase();
        if (body.brand   !== undefined) updates.brand    = body.brand;
        if (body.model   !== undefined) updates.model    = body.model;
        if (body.year    !== undefined) updates.year     = body.year ? Number(body.year) : null;
        if (body.color   !== undefined) updates.color    = body.color;
        if (body.fuelType !== undefined) updates.fuel_type = body.fuelType;
        if (body.vin     !== undefined) updates.vin      = body.vin;
        if (body.mileage !== undefined) updates.mileage  = Number(body.mileage);
        if (body.notes   !== undefined) updates.notes    = body.notes;
        if (body.active  !== undefined) updates.active   = Boolean(body.active);
        if (!Object.keys(updates).length) return send(response, 400, { error: "Sin campos válidos." });
        const { data, error } = await getSupabaseAdmin().from("vehicles").update(updates).eq("id", id).eq("workshop_id", workshopId).select("*").single();
        if (error) throw new Error(error.message);
        return send(response, 200, { vehicle: toVehicle(data) });
      }
      if (method === "DELETE") {
        await requireOperator(request, workshopId);
        await getSupabaseAdmin().from("vehicles").update({ active: false }).eq("id", id).eq("workshop_id", workshopId);
        return send(response, 200, { ok: true });
      }
      return send(response, 405, { error: "Método no permitido." });
    }

    if (method === "GET") {
      await requireMember(request, workshopId);
      const qs = new URL(request.url, "http://localhost").searchParams;
      const clientId = qs.get("clientId") || "";
      const search   = qs.get("search")   || "";
      let query = getSupabaseAdmin().from("vehicles").select("*, client:clients(id, name, phone, email)").eq("workshop_id", workshopId).eq("active", true).order("plate");
      if (clientId) query = query.eq("client_id", clientId);
      if (search)   query = query.ilike("plate", `%${search}%`);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return send(response, 200, { vehicles: (data || []).map(toVehicle) });
    }
    if (method === "POST") {
      await requireOperator(request, workshopId);
      const { clientId, plate, brand, model, year, color, fuelType, vin, mileage, notes } = body;
      if (!clientId) return send(response, 400, { error: "clientId es requerido." });
      if (!plate?.trim()) return send(response, 400, { error: "La placa es obligatoria." });
      const { data, error } = await getSupabaseAdmin().from("vehicles").insert({
        workshop_id: workshopId, client_id: clientId, plate: plate.toUpperCase(),
        brand: brand || "", model: model || "", year: year ? Number(year) : null,
        color: color || "", fuel_type: fuelType || "Gasolina",
        vin: vin || "", mileage: Number(mileage || 0), notes: notes || "", active: true
      }).select("*").single();
      if (error) throw Object.assign(new Error(error.message), { status: error.code === "23505" ? 409 : 502 });
      return send(response, 201, { vehicle: toVehicle(data) });
    }
    return send(response, 405, { error: "Método no permitido." });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
