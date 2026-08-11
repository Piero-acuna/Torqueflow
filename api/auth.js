/**
 * /api/auth  — función consolidada
 *
 * Rutas soportadas (resueltas por query ?action= o por el path parseado):
 *   POST /api/auth?action=register  → registrar taller nuevo
 *   GET  /api/auth?action=session   → datos del taller y miembro autenticado
 *   GET  /api/auth?action=user      → uid → workshopId (bootstrap)
 *
 * vercel.json reescribe /api/auth/* → /api/auth, por lo que
 * la sub-ruta llega como la parte después del primer segmento.
 * Ej: /api/auth/register → req.url contiene "/api/auth/register"
 */
import { adminAuth } from "./_lib/firebase-admin.js";
import { parseBody, requireStaff, resolveWorkshopId, send } from "./_lib/firebase-admin.js";
import { getSupabaseAdmin, getUserRecord } from "./_lib/supabase-admin.js";

function resolveAction(request) {
  // Intentar desde query string: ?action=register
  const qs = new URL(request.url, "http://localhost").searchParams;
  if (qs.get("action")) return qs.get("action");
  // Intentar desde el path: /api/auth/register → "register"
  const segments = new URL(request.url, "http://localhost").pathname.split("/").filter(Boolean);
  // segments: ["api", "auth", "register"] → índice 2
  return segments[2] || "";
}

export default async function handler(request, response) {
  const action = resolveAction(request);

  // ── POST /api/auth/register ──────────────────────────────────────────────
  if (action === "register" || (request.method === "POST" && !action)) {
    if (request.method !== "POST") {
      return send(response, 405, { error: "Método no permitido." });
    }
    const body = parseBody(request);

    function validate(b) {
      const workshopName = (b.workshopName || "").trim();
      const ownerName    = (b.ownerName    || "").trim();
      const email        = (b.email        || "").trim();
      const password     = b.password      || "";
      if (!workshopName) return "El nombre del taller es obligatorio.";
      if (!ownerName)    return "Tu nombre es obligatorio.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "El correo no es válido.";
      if (password.length < 8)  return "La contraseña debe tener al menos 8 caracteres.";
      return null;
    }

    const validationError = validate(body);
    if (validationError) return send(response, 400, { error: validationError });

    const workshopName = body.workshopName.trim();
    const ownerName    = body.ownerName.trim();
    const email        = body.email.trim();
    const { password } = body;

    let createdUser = null;
    try {
      try {
        await adminAuth().getUserByEmail(email);
        return send(response, 409, { error: "Ya existe una cuenta con ese correo." });
      } catch (lookupError) {
        if (lookupError.code !== "auth/user-not-found") throw lookupError;
      }

      createdUser = await adminAuth().createUser({
        email, password, displayName: ownerName,
        emailVerified: false, disabled: false
      });

      const supabase = getSupabaseAdmin();

      const { data: workshop, error: workshopError } = await supabase
        .from("workshops")
        .insert({
          business_name: workshopName, legal_name: "", tax_id: "", phone: "",
          email: "", address: "", currency: "PEN", tax_rate: 18,
          labor_hour_rate: 0, daily_goal: 0, order_prefix: "OT",
          next_order_number: 1, require_approval: true,
          prevent_negative_stock: true, notify_ready: true,
          notify_delay: true, active: true, owner_uid: createdUser.uid
        })
        .select("id").single();

      if (workshopError) throw workshopError;
      const workshopId = workshop.id;

      const [{ error: memberError }, { error: userError }] = await Promise.all([
        supabase.from("members").insert({
          workshop_id: workshopId, uid: createdUser.uid, email,
          display_name: ownerName, role: "admin", active: true
        }),
        supabase.from("users").insert({
          uid: createdUser.uid, workshop_id: workshopId, email
        })
      ]);

      if (memberError) throw memberError;
      if (userError)   throw userError;

      return send(response, 201, { workshopId, uid: createdUser.uid });
    } catch (error) {
      console.error(error);
      if (createdUser) await adminAuth().deleteUser(createdUser.uid).catch(() => {});
      return send(response, error.status || 500, { error: error.message || "No se pudo completar el registro." });
    }
  }

  // ── GET /api/auth/user ───────────────────────────────────────────────────
  if (action === "user") {
    if (request.method !== "GET") return send(response, 405, { error: "Método no permitido." });
    try {
      const authorization = request.headers.authorization || "";
      const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
      if (!token) return send(response, 401, { error: "Falta el token de autenticación." });
      const decoded = await adminAuth().verifyIdToken(token);
      const userRecord = await getUserRecord(decoded.uid);
      if (!userRecord) return send(response, 404, { error: "Usuario no encontrado." });
      return send(response, 200, { workshopId: userRecord.workshopId });
    } catch (error) {
      console.error(error);
      return send(response, error.status || 500, { error: error.message || "Error interno." });
    }
  }

  // ── GET /api/auth/session ────────────────────────────────────────────────
  if (action === "session" || request.method === "GET") {
    try {
      const workshopId = resolveWorkshopId(request, {});
      const actor = await requireStaff(request, workshopId);
      const supabase = getSupabaseAdmin();

      const [{ data: workshop }, { data: member }] = await Promise.all([
        supabase.from("workshops").select("id, business_name, currency, order_prefix").eq("id", workshopId).maybeSingle(),
        supabase.from("members").select("id, uid, email, display_name, role, active").eq("workshop_id", workshopId).eq("uid", actor.uid).maybeSingle()
      ]);

      if (!workshop || !member) return send(response, 404, { error: "Taller o miembro no encontrado." });

      return send(response, 200, {
        workshopId: workshop.id,
        workshop: {
          id: workshop.id, businessName: workshop.business_name,
          currency: workshop.currency, orderPrefix: workshop.order_prefix
        },
        member: {
          id: member.id, uid: member.uid, email: member.email,
          displayName: member.display_name, role: member.role, active: member.active
        }
      });
    } catch (error) {
      console.error(error);
      return send(response, error.status || 500, { error: error.message || "Error interno." });
    }
  }

  return send(response, 404, { error: "Ruta no encontrada." });
}
