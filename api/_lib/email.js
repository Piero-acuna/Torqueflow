// api/_lib/email.js
//
// Envío de correo transaccional vía Resend (https://resend.com).
// Free tier: 3,000 correos/mes, 100/día, 1 dominio verificado — suficiente
// para las notificaciones de un taller (no es una plataforma de marketing).
//
// Variables de entorno requeridas (Vercel → Project Settings → Environment
// Variables):
//   RESEND_API_KEY   - tu API key de Resend (empieza con "re_")
//   RESEND_FROM_EMAIL - remitente verificado, ej: notificaciones@tutaller.com
//                       Si no configuras un dominio propio, puedes usar
//                       "onboarding@resend.dev" para probar (Resend lo da
//                       gratis, sin verificar dominio, pero se ve menos
//                       profesional para el cliente final).
//
// El envío de correo NUNCA debe tumbar una operación principal (ej. cambiar
// el estado de una orden): todas las funciones de este archivo atrapan sus
// propios errores y devuelven { ok: false, error } en vez de lanzar.

const RESEND_API_URL = "https://api.resend.com/emails";

export async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY no configurada — correo no enviado:", subject, "→", to);
    return { ok: false, error: "RESEND_API_KEY no configurada." };
  }
  if (!to) {
    return { ok: false, error: "Destinatario vacío." };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ from, to, subject, html, text })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[email] Resend error:", payload);
      return { ok: false, error: payload?.message || `Resend respondió ${response.status}` };
    }
    return { ok: true, id: payload?.id };
  } catch (error) {
    console.error("[email] Error de red enviando correo:", error);
    return { ok: false, error: error.message };
  }
}
