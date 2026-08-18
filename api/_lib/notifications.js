// api/_lib/notifications.js
//
// Notificaciones automáticas al cliente por correo cuando una orden cambia
// a un estado clave. Se dispara desde api/orders.js después de un PATCH
// exitoso que cambia el status. Nunca debe romper la petición principal:
// cualquier error se registra en consola y se ignora.

import { getSupabaseAdmin } from "./supabase-admin.js";
import { sendEmail } from "./email.js";

function currency(amount, code) {
  const value = Number(amount || 0);
  try {
    return new Intl.NumberFormat("es-PE", { style: "currency", currency: code || "PEN" }).format(value);
  } catch {
    return `${code || "PEN"} ${value.toFixed(2)}`;
  }
}

function baseTemplate({ title, body, workshop }) {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="margin: 0 0 16px;">${title}</h2>
      <div style="font-size: 15px; line-height: 1.6;">${body}</div>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="font-size: 13px; color: #6b7280; margin: 0;">
        ${workshop.businessName || "Taller"}${workshop.phone ? ` · ${workshop.phone}` : ""}${workshop.address ? ` · ${workshop.address}` : ""}
      </p>
    </div>
  `;
}

// Solo estos cambios de status disparan correo; el resto (review, waiting_parts,
// external, cancelled) se ignora para no saturar al cliente con cada movimiento
// interno del taller.
const NOTIFIABLE_STATUSES = new Set(["ready", "delivered"]);

export async function notifyOrderStatusChange(workshopId, order) {
  try {
    if (!NOTIFIABLE_STATUSES.has(order.status)) return;
    if (!order.client_id) return;

    const admin = getSupabaseAdmin();

    const [{ data: workshopRow }, { data: clientRow }] = await Promise.all([
      admin.from("workshops").select("business_name, phone, address, currency, notify_ready, notify_delivered").eq("id", workshopId).maybeSingle(),
      admin.from("clients").select("name, email").eq("id", order.client_id).eq("workshop_id", workshopId).maybeSingle()
    ]);

    if (!clientRow?.email) return; // Sin correo registrado, no hay a quién avisar.
    const workshop = {
      businessName: workshopRow?.business_name || "",
      phone: workshopRow?.phone || "",
      address: workshopRow?.address || "",
      currency: workshopRow?.currency || "PEN"
    };

    if (order.status === "ready") {
      if (workshopRow?.notify_ready === false) return;
      await sendEmail({
        to: clientRow.email,
        subject: `Tu vehículo ${order.plate ? `(${order.plate}) ` : ""}está listo — Orden ${order.order_number}`,
        html: baseTemplate({
          title: "¡Tu vehículo está listo! 🚗",
          body: `
            Hola ${clientRow.name || ""},<br/><br/>
            Tu vehículo${order.vehicle_label ? ` <strong>${order.vehicle_label}</strong>` : ""}${order.plate ? ` (placa ${order.plate})` : ""}
            ya está listo para recoger.<br/><br/>
            <strong>Orden:</strong> ${order.order_number}<br/>
            ${order.totals?.total ? `<strong>Total:</strong> ${currency(order.totals.total, workshop.currency)}<br/>` : ""}
            <br/>Puedes pasar a recogerlo cuando gustes.
          `,
          workshop
        })
      });
    }

    if (order.status === "delivered") {
      if (workshopRow?.notify_delivered === false) return;
      await sendEmail({
        to: clientRow.email,
        subject: `Gracias por tu visita — Orden ${order.order_number} entregada`,
        html: baseTemplate({
          title: "¡Gracias por confiar en nosotros! ✅",
          body: `
            Hola ${clientRow.name || ""},<br/><br/>
            Confirmamos la entrega de tu vehículo${order.vehicle_label ? ` <strong>${order.vehicle_label}</strong>` : ""}${order.plate ? ` (placa ${order.plate})` : ""}.<br/><br/>
            <strong>Orden:</strong> ${order.order_number}<br/>
            ${order.totals?.total ? `<strong>Total pagado:</strong> ${currency(order.totals.total, workshop.currency)}<br/>` : ""}
            <br/>Cualquier consulta sobre el trabajo realizado, contáctanos.
          `,
          workshop
        })
      });
    }
  } catch (error) {
    // Nunca debe tumbar el flujo principal de la orden.
    console.error("[notifications] Error notificando cambio de status:", error);
  }
}
