import { parseBody, requireAdmin, requireMember, resolveWorkshopId, send } from "./_lib/firebase-admin.js";
import { getSupabaseAdmin, toService } from "./_lib/supabase-admin.js";

function getId(request) {
  const segments = new URL(request.url, "http://localhost").pathname.split("/").filter(Boolean);
  return segments[2] || null;
}

export default async function handler(request, response) {
  try {
    const body = parseBody(request);
    const workshopId = resolveWorkshopId(request, body);
    const id = getId(request);
    const method = request.method;
    const isCategory = body.isCategory === true;
    const table = isCategory ? "service_categories" : "services";

    if (id) {
      if (method === "PATCH") {
        await requireAdmin(request, workshopId);
        const updates = {};
        if (body.name        !== undefined) updates.name         = body.name;
        if (body.description !== undefined) updates.description  = body.description;
        if (body.price       !== undefined) updates.price        = Number(body.price);
        if (body.categoryId  !== undefined) updates.category_id  = body.categoryId || null;
        if (body.estimatedHours !== undefined) updates.estimated_hours = Number(body.estimatedHours);
        if (body.active      !== undefined) updates.active       = Boolean(body.active);
        if (!Object.keys(updates).length) return send(response, 400, { error: "Sin campos válidos." });
        const { data, error } = await getSupabaseAdmin().from(table).update(updates).eq("id", id).eq("workshop_id", workshopId).select("*").single();
        if (error) throw new Error(error.message);
        return send(response, 200, { item: toService(data) });
      }
      if (method === "DELETE") {
        await requireAdmin(request, workshopId);
        const { error } = await getSupabaseAdmin().from(table).update({ active: false }).eq("id", id).eq("workshop_id", workshopId);
        if (error) throw new Error(error.message);
        return send(response, 200, { ok: true });
      }
      return send(response, 405, { error: "Método no permitido." });
    }

    if (method === "GET") {
      await requireMember(request, workshopId);
      const { data, error } = await getSupabaseAdmin().from(table).select("*").eq("workshop_id", workshopId).order("name");
      if (error) throw new Error(error.message);
      return send(response, 200, { items: (data || []).map(toService) });
    }
    if (method === "POST") {
      await requireAdmin(request, workshopId);
      const { name, description, categoryId, price, estimatedHours } = body;
      if (!name?.trim()) return send(response, 400, { error: "El nombre es obligatorio." });
      const insert = isCategory
        ? { workshop_id: workshopId, name: name.trim(), description: description || "", active: true }
        : { workshop_id: workshopId, name: name.trim(), description: description || "", category_id: categoryId || null, price: Number(price || 0), estimated_hours: Number(estimatedHours || 0), active: true };
      const { data, error } = await getSupabaseAdmin().from(table).insert(insert).select("*").single();
      if (error) throw new Error(error.message);
      return send(response, 201, { item: toService(data) });
    }
    return send(response, 405, { error: "Método no permitido." });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
