/**
 * /api/orders — función consolidada
 *
 * Rutas:
 *   GET    /api/orders                    → listar órdenes del taller
 *   POST   /api/orders                    → crear orden (RPC create_order)
 *   GET    /api/orders/:id                → detalle de una orden
 *   PATCH  /api/orders/:id                → actualizar campos de la orden
 *   POST   /api/orders/parts              → agregar pieza (RPC add_part_to_order)
 *   DELETE /api/orders/parts              → retirar pieza (RPC remove_part_from_order)
 *   POST   /api/orders/external           → agregar trabajo externo
 *   DELETE /api/orders/external           → eliminar trabajo externo
 *   PATCH  /api/orders/photos             → adjuntar evidencias fotográficas
 */
import { parseBody, requireMember, requireOperator, resolveWorkshopId, send } from "./_lib/firebase-admin.js";
import { getSupabaseAdmin, toOrder } from "./_lib/supabase-admin.js";
import { notifyOrderStatusChange } from "./_lib/notifications.js";

function getSegments(request) {
  return new URL(request.url, "http://localhost").pathname
    .split("/").filter(Boolean);
  // ["api", "orders"]           → sub = undefined
  // ["api", "orders", "abc123"] → sub = "abc123"
  // ["api", "orders", "parts"]  → sub = "parts"
}

export default async function handler(request, response) {
  try {
    const body = parseBody(request);
    const workshopId = resolveWorkshopId(request, body);
    const segments = getSegments(request);
    const sub = segments[2]; // may be undefined | uuid | "parts" | "external" | "photos"
    const method = request.method;

    // ── /api/orders/parts ───────────────────────────────────────────────────
    if (sub === "parts") {
      if (method === "POST") {
        const actor = await requireOperator(request, workshopId);
        const { orderId, partId, quantity, unitPrice } = body;
        if (!orderId || !partId) return send(response, 400, { error: "orderId y partId son requeridos." });
        const { data, error } = await getSupabaseAdmin().rpc("add_part_to_order", {
          p_order_id:   orderId,
          p_part_id:    partId,
          p_quantity:   Number(quantity || 1),
          p_unit_price: Number(unitPrice || 0),
          p_actor_id:   actor.uid,
          p_actor_name: actor.name || actor.email || "Sistema"
        });
        if (error) throw Object.assign(new Error(error.message), { status: error.code === "P0001" ? 400 : 502 });
        return send(response, 200, { line: data });
      }
      if (method === "DELETE") {
        const actor = await requireOperator(request, workshopId);
        const { orderId, lineId } = body;
        if (!orderId || !lineId) return send(response, 400, { error: "orderId y lineId son requeridos." });
        const { error } = await getSupabaseAdmin().rpc("remove_part_from_order", {
          p_order_id:   orderId,
          p_line_id:    lineId,
          p_actor_id:   actor.uid,
          p_actor_name: actor.name || actor.email || "Sistema"
        });
        if (error) throw new Error(error.message);
        return send(response, 200, { ok: true });
      }
      return send(response, 405, { error: "Método no permitido." });
    }

    // ── /api/orders/external ────────────────────────────────────────────────
    if (sub === "external") {
      if (method === "POST") {
        await requireOperator(request, workshopId);
        const { orderId, provider, description, sentAt, returnedAt, cost, status } = body;
        if (!orderId || !description) return send(response, 400, { error: "orderId y description son requeridos." });
        const supabase = getSupabaseAdmin();
        const { data: order, error: fetchError } = await supabase.from("orders").select("external_jobs, totals").eq("id", orderId).eq("workshop_id", workshopId).maybeSingle();
        if (fetchError || !order) return send(response, 404, { error: "Orden no encontrada." });
        const job = { id: crypto.randomUUID(), provider: provider || "", description, sentAt: sentAt || null, returnedAt: returnedAt || null, cost: Number(cost || 0), status: status || "sent" };
        const externalJobs = [...(order.external_jobs || []), job];
        const externalTotal = externalJobs.reduce((sum, j) => sum + Number(j.cost || 0), 0);
        const t = order.totals || {};
        const totals = { ...t, external: externalTotal, total: Math.max(0, (t.services || 0) + (t.parts || 0) + externalTotal + (t.labor || 0) + (t.other || 0) - (t.discount || 0)) };
        const { error: updateError } = await supabase.from("orders").update({ external_jobs: externalJobs, totals }).eq("id", orderId).eq("workshop_id", workshopId);
        if (updateError) throw new Error(updateError.message);
        return send(response, 200, { job });
      }
      if (method === "DELETE") {
        await requireOperator(request, workshopId);
        const { orderId, jobId } = body;
        if (!orderId || !jobId) return send(response, 400, { error: "orderId y jobId son requeridos." });
        const supabase = getSupabaseAdmin();
        const { data: order, error: fetchError } = await supabase.from("orders").select("external_jobs, totals").eq("id", orderId).eq("workshop_id", workshopId).maybeSingle();
        if (fetchError || !order) return send(response, 404, { error: "Orden no encontrada." });
        const externalJobs = (order.external_jobs || []).filter((j) => j.id !== jobId);
        const externalTotal = externalJobs.reduce((sum, j) => sum + Number(j.cost || 0), 0);
        const t = order.totals || {};
        const totals = { ...t, external: externalTotal, total: Math.max(0, (t.services || 0) + (t.parts || 0) + externalTotal + (t.labor || 0) + (t.other || 0) - (t.discount || 0)) };
        const { error: updateError } = await supabase.from("orders").update({ external_jobs: externalJobs, totals }).eq("id", orderId).eq("workshop_id", workshopId);
        if (updateError) throw new Error(updateError.message);
        return send(response, 200, { ok: true });
      }
      return send(response, 405, { error: "Método no permitido." });
    }

    // ── /api/orders/photos ──────────────────────────────────────────────────
    if (sub === "photos") {
      if (method === "PATCH") {
        await requireOperator(request, workshopId);
        const { orderId, photoEvidence } = body;
        if (!orderId) return send(response, 400, { error: "orderId es requerido." });
        const { error } = await getSupabaseAdmin().from("orders").update({ photo_evidence: photoEvidence || [] }).eq("id", orderId).eq("workshop_id", workshopId);
        if (error) throw new Error(error.message);
        return send(response, 200, { ok: true });
      }
      return send(response, 405, { error: "Método no permitido." });
    }

    // ── /api/orders/:id ─────────────────────────────────────────────────────
    if (sub && sub !== "parts" && sub !== "external" && sub !== "photos") {
      const orderId = sub;

      if (method === "GET") {
        await requireMember(request, workshopId);
        const { data, error } = await getSupabaseAdmin().from("orders").select("*").eq("id", orderId).eq("workshop_id", workshopId).maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return send(response, 404, { error: "Orden no encontrada." });
        return send(response, 200, { order: toOrder(data) });
      }

      if (method === "PATCH") {
        await requireOperator(request, workshopId);
        const updates = {};
        if (body.status            !== undefined) updates.status             = body.status;
        if (body.priority          !== undefined) updates.priority           = body.priority;
        if (body.mechanicId        !== undefined) updates.mechanic_id        = body.mechanicId   || null;
        if (body.mechanicName      !== undefined) updates.mechanic_name      = body.mechanicName;
        if (body.clientId          !== undefined) updates.client_id          = body.clientId     || null;
        if (body.vehicleId         !== undefined) updates.vehicle_id         = body.vehicleId    || null;
        if (body.diagnosis         !== undefined) updates.diagnosis          = body.diagnosis;
        if (body.customerComplaint !== undefined) updates.customer_complaint = body.customerComplaint;
        if (body.internalNotes     !== undefined) updates.internal_notes     = body.internalNotes;
        if (body.promisedAt        !== undefined) updates.promised_at        = body.promisedAt || null;
        if (body.budget            !== undefined) updates.budget             = Number(body.budget);
        if (body.laborCost         !== undefined) updates.labor_cost         = Number(body.laborCost);
        if (body.otherCosts        !== undefined) updates.other_costs        = Number(body.otherCosts);
        if (body.discount          !== undefined) updates.discount           = Number(body.discount);
        if (body.paymentStatus     !== undefined) updates.payment_status     = body.paymentStatus;
        if (body.approvalStatus    !== undefined) updates.approval_status    = body.approvalStatus;

        // Recalcular totals si cambian costos
        if (updates.labor_cost !== undefined || updates.other_costs !== undefined || updates.discount !== undefined) {
          const { data: current } = await getSupabaseAdmin().from("orders").select("totals").eq("id", orderId).maybeSingle();
          const t = current?.totals || {};
          const labor    = updates.labor_cost  ?? t.labor    ?? 0;
          const other    = updates.other_costs ?? t.other    ?? 0;
          const discount = updates.discount    ?? t.discount ?? 0;
          updates.totals = { ...t, labor, other, discount, total: (t.services || 0) + (t.parts || 0) + (t.external || 0) + Number(labor) + Number(other) - Number(discount) };
        }

        // Para saber si el status REALMENTE cambió (y no reenviar el correo si
        // guardan la orden de nuevo con el mismo status).
        let previousStatus = null;
        if (updates.status !== undefined) {
          const { data: current } = await getSupabaseAdmin().from("orders").select("status").eq("id", orderId).maybeSingle();
          previousStatus = current?.status || null;
        }

        if (!Object.keys(updates).length) return send(response, 400, { error: "Sin campos válidos para actualizar." });
        const { data, error } = await getSupabaseAdmin().from("orders").update(updates).eq("id", orderId).eq("workshop_id", workshopId).select("*").single();
        if (error) throw new Error(error.message);

        // Notificar al cliente por correo si el status cambió a un estado clave
        // (listo / entregado). No bloquea la respuesta ni la revienta si falla.
        if (updates.status !== undefined && updates.status !== previousStatus) {
          notifyOrderStatusChange(workshopId, data).catch((err) => console.error("[orders] notifyOrderStatusChange:", err));
        }

        return send(response, 200, { order: toOrder(data) });
      }

      return send(response, 405, { error: "Método no permitido." });
    }

    // ── /api/orders (list + create) ─────────────────────────────────────────
    if (method === "GET") {
      await requireMember(request, workshopId);
      const qs = new URL(request.url, "http://localhost").searchParams;
      const status = qs.get("status");
      let query = getSupabaseAdmin().from("orders").select("*").eq("workshop_id", workshopId).order("created_at", { ascending: false }).limit(200);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return send(response, 200, { orders: (data || []).map(toOrder) });
    }

    if (method === "POST") {
      await requireOperator(request, workshopId);
      const payload = {
        clientId:           body.clientId        || null,
        vehicleId:          body.vehicleId        || null,
        mechanicId:         body.mechanicId       || null,
        clientName:         body.clientName       || "",
        clientPhone:        body.clientPhone      || "",
        vehicleLabel:       body.vehicleLabel     || "",
        plate:              body.plate            || "",
        mechanicName:       body.mechanicName     || "Sin asignar",
        status:             body.status           || "review",
        priority:           body.priority         || "normal",
        paymentStatus:      body.paymentStatus    || "pending",
        approvalStatus:     body.approvalStatus   || "pending",
        customerComplaint:  body.customerComplaint || "",
        diagnosis:          body.diagnosis        || "",
        inspectionNotes:    body.inspectionNotes  || "",
        internalNotes:      body.internalNotes    || "",
        serviceLines:       body.serviceLines     || [],
        laborCost:          Number(body.laborCost   || 0),
        otherCosts:         Number(body.otherCosts  || 0),
        discount:           Number(body.discount    || 0),
        budget:             Number(body.budget      || 0),
        fuelLevel:          Number(body.fuelLevel   || 0),
        mileage:            Number(body.mileage     || 0),
        enteredAt:          body.enteredAt        || new Date().toISOString(),
        promisedAt:         body.promisedAt       || null
      };
      const { data, error } = await getSupabaseAdmin().rpc("create_order", {
        p_workshop_id: workshopId,
        p_payload:     payload
      });
      if (error) throw Object.assign(new Error(error.message), { status: 502 });
      return send(response, 201, { order: toOrder(data) });
    }

    response.setHeader("Allow", "GET, POST");
    return send(response, 405, { error: "Método no permitido." });

  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
