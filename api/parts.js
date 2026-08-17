import { parseBody, requireAdmin, requireMember, resolveWorkshopId, send } from "./_lib/firebase-admin.js";
import { getSupabaseAdmin, toPart } from "./_lib/supabase-admin.js";

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

    if (id) {
      if (method === "PATCH") {
        await requireAdmin(request, workshopId);
        const updates = {};
        if (body.sku          !== undefined) updates.sku           = body.sku;
        if (body.barcode      !== undefined) updates.barcode       = body.barcode;
        if (body.name         !== undefined) updates.name          = body.name;
        if (body.brand        !== undefined) updates.brand         = body.brand;
        if (body.category     !== undefined) updates.category      = body.category;
        if (body.unit         !== undefined) updates.unit          = body.unit;
        if (body.compatibility !== undefined) updates.compatibility = body.compatibility;
        if (body.location     !== undefined) updates.location      = body.location;
        if (body.supplier     !== undefined) updates.supplier      = body.supplier;
        if (body.minimumStock !== undefined) updates.minimum_stock = Number(body.minimumStock);
        if (body.maximumStock !== undefined) updates.maximum_stock = Number(body.maximumStock);
        if (body.averageCost  !== undefined) updates.average_cost  = Number(body.averageCost);
        if (body.salePrice    !== undefined) updates.sale_price    = Number(body.salePrice);
        if (body.notes        !== undefined) updates.notes         = body.notes;
        if (body.active       !== undefined) updates.active        = Boolean(body.active);
        if (!Object.keys(updates).length) return send(response, 400, { error: "Sin campos válidos." });
        const { data, error } = await getSupabaseAdmin().from("parts").update(updates).eq("id", id).eq("workshop_id", workshopId).select("*").single();
        if (error) throw new Error(error.message);
        return send(response, 200, { part: toPart(data) });
      }
      if (method === "DELETE") {
        await requireAdmin(request, workshopId);
        const { error } = await getSupabaseAdmin().from("parts").update({ active: false }).eq("id", id).eq("workshop_id", workshopId);
        if (error) throw new Error(error.message);
        return send(response, 200, { ok: true });
      }
      return send(response, 405, { error: "Método no permitido." });
    }

    if (method === "GET") {
      await requireMember(request, workshopId);
      const qs = new URL(request.url, "http://localhost").searchParams;
      const search = qs.get("search") || "";
      let query = getSupabaseAdmin().from("parts").select("*").eq("workshop_id", workshopId).order("name");
      if (search) query = query.ilike("name", `%${search}%`);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return send(response, 200, { parts: (data || []).map(toPart) });
    }
    if (method === "POST") {
      await requireAdmin(request, workshopId);
      const { sku, barcode, name, brand, category, unit, compatibility, location, supplier, minimumStock, maximumStock, averageCost, salePrice, notes } = body;
      if (!name?.trim()) return send(response, 400, { error: "El nombre es obligatorio." });
      const { data, error } = await getSupabaseAdmin().from("parts").insert({
        workshop_id: workshopId, sku: sku || "", barcode: barcode || "",
        name: name.trim(), brand: brand || "", category: category || "",
        unit: unit || "unidad", compatibility: compatibility || "",
        location: location || "", supplier: supplier || "",
        minimum_stock: Number(minimumStock || 0), maximum_stock: Number(maximumStock || 0),
        average_cost: Number(averageCost || 0), sale_price: Number(salePrice || 0),
        stock: 0, notes: notes || "", active: true
      }).select("*").single();
      if (error) throw Object.assign(new Error(error.message), { status: error.code === "23505" ? 409 : 502 });
      return send(response, 201, { part: toPart(data) });
    }
    return send(response, 405, { error: "Método no permitido." });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
