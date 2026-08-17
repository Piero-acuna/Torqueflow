import { parseBody, requireMember, requireOperator, resolveWorkshopId, send } from "./_lib/firebase-admin.js";
import { getSupabaseAdmin, toClient, toVehicle } from "./_lib/supabase-admin.js";

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
      if (method === "GET") {
        await requireMember(request, workshopId);
        const { data, error } = await getSupabaseAdmin().from("clients").select("*, vehicles(*)").eq("id", id).eq("workshop_id", workshopId).maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return send(response, 404, { error: "Cliente no encontrado." });
        return send(response, 200, { client: toClient(data) });
      }
      if (method === "PATCH") {
        await requireOperator(request, workshopId);
        const fields = ["type","document_type","document_number","name","phone","email","address","segment","credit_limit","notes"];
        const updates = {};
        if (body.type           !== undefined) updates.type            = body.type;
        if (body.documentType   !== undefined) updates.document_type   = body.documentType;
        if (body.documentNumber !== undefined) updates.document_number = body.documentNumber;
        if (body.name           !== undefined) updates.name            = body.name;
        if (body.phone          !== undefined) updates.phone           = body.phone;
        if (body.email          !== undefined) updates.email           = body.email;
        if (body.address        !== undefined) updates.address         = body.address;
        if (body.segment        !== undefined) updates.segment         = body.segment;
        if (body.creditLimit    !== undefined) updates.credit_limit    = Number(body.creditLimit);
        if (body.notes          !== undefined) updates.notes           = body.notes;
        if (!Object.keys(updates).length) return send(response, 400, { error: "Sin campos válidos." });
        const { data, error } = await getSupabaseAdmin().from("clients").update(updates).eq("id", id).eq("workshop_id", workshopId).select("*").single();
        if (error) throw new Error(error.message);
        return send(response, 200, { client: toClient(data) });
      }
      if (method === "DELETE") {
        await requireOperator(request, workshopId);
        await getSupabaseAdmin().from("clients").update({ active: false }).eq("id", id).eq("workshop_id", workshopId);
        return send(response, 200, { ok: true });
      }
      return send(response, 405, { error: "Método no permitido." });
    }

    if (method === "GET") {
      await requireMember(request, workshopId);
      const qs = new URL(request.url, "http://localhost").searchParams;
      const search = qs.get("search") || "";
      let query = getSupabaseAdmin().from("clients").select("*").eq("workshop_id", workshopId).eq("active", true).order("name");
      if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,document_number.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return send(response, 200, { clients: (data || []).map(toClient) });
    }
    if (method === "POST") {
      await requireOperator(request, workshopId);
      const { type, documentType, documentNumber, name, phone, email, address, segment, creditLimit, notes } = body;
      if (!name?.trim()) return send(response, 400, { error: "El nombre es obligatorio." });
      const { data, error } = await getSupabaseAdmin().from("clients").insert({
        workshop_id: workshopId, type: type || "person",
        document_type: documentType || "DNI", document_number: documentNumber || "",
        name: name.trim(), phone: phone || "", email: email || "",
        address: address || "", segment: segment || "new",
        credit_limit: Number(creditLimit || 0), notes: notes || "", active: true
      }).select("*").single();
      if (error) throw new Error(error.message);
      return send(response, 201, { client: toClient(data) });
    }
    return send(response, 405, { error: "Método no permitido." });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
