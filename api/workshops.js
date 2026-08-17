import { parseBody, requireAdmin, requireMember, resolveWorkshopId, send } from "./_lib/firebase-admin.js";
import { getSupabaseAdmin, toWorkshop } from "./_lib/supabase-admin.js";

export default async function handler(request, response) {
  try {
    const body = parseBody(request);
    const workshopId = resolveWorkshopId(request, body);

    if (request.method === "GET") {
      await requireMember(request, workshopId);
      const { data, error } = await getSupabaseAdmin()
        .from("workshops")
        .select("*")
        .eq("id", workshopId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return send(response, 404, { error: "Taller no encontrado." });
      return send(response, 200, { workshop: toWorkshop(data) });
    }

    if (request.method === "PATCH") {
      await requireAdmin(request, workshopId);
      const updates = {};
      if (body.businessName         !== undefined) updates.business_name           = body.businessName;
      if (body.legalName            !== undefined) updates.legal_name              = body.legalName;
      if (body.taxId                !== undefined) updates.tax_id                  = body.taxId;
      if (body.phone                !== undefined) updates.phone                   = body.phone;
      if (body.email                !== undefined) updates.email                   = body.email;
      if (body.address              !== undefined) updates.address                 = body.address;
      if (body.currency             !== undefined) updates.currency                = body.currency;
      if (body.taxRate              !== undefined) updates.tax_rate                = Number(body.taxRate);
      if (body.laborHourRate        !== undefined) updates.labor_hour_rate         = Number(body.laborHourRate);
      if (body.dailyGoal            !== undefined) updates.daily_goal              = Number(body.dailyGoal);
      if (body.orderPrefix          !== undefined) updates.order_prefix            = body.orderPrefix;
      if (body.requireApproval      !== undefined) updates.require_approval        = Boolean(body.requireApproval);
      if (body.preventNegativeStock !== undefined) updates.prevent_negative_stock  = Boolean(body.preventNegativeStock);
      if (body.notifyReady          !== undefined) updates.notify_ready            = Boolean(body.notifyReady);
      if (body.notifyDelay          !== undefined) updates.notify_delay            = Boolean(body.notifyDelay);
      if (body.terms                !== undefined) updates.terms                   = body.terms;
      if (body.documentFooter       !== undefined) updates.document_footer         = body.documentFooter;

      if (!Object.keys(updates).length) {
        return send(response, 400, { error: "No hay campos válidos para actualizar." });
      }

      const { data, error } = await getSupabaseAdmin()
        .from("workshops")
        .update(updates)
        .eq("id", workshopId)
        .select("*")
        .single();

      if (error) throw error;
      return send(response, 200, { workshop: toWorkshop(data) });
    }

    response.setHeader("Allow", "GET, PATCH");
    return send(response, 405, { error: "Método no permitido." });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
