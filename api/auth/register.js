import { parseBody, send } from "../_lib/firebase-admin.js";
import { adminAuth } from "../_lib/firebase-admin.js";
import { getSupabaseAdmin } from "../_lib/supabase-admin.js";

// Endpoint público (sin requireMember): así es como nace un taller nuevo.
// La seguridad acá valida los datos de entrada y evita duplicar correos.

function validate(body) {
  const workshopName = (body.workshopName || "").trim();
  const ownerName    = (body.ownerName    || "").trim();
  const email        = (body.email        || "").trim();
  const password     = body.password      || "";
  if (!workshopName) return "El nombre del taller es obligatorio.";
  if (!ownerName)    return "Tu nombre es obligatorio.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "El correo no es válido.";
  if (password.length < 8)  return "La contraseña debe tener al menos 8 caracteres.";
  return null;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return send(response, 405, { error: "Método no permitido." });
  }

  const body = parseBody(request);
  const validationError = validate(body);
  if (validationError) return send(response, 400, { error: validationError });

  const workshopName = body.workshopName.trim();
  const ownerName    = body.ownerName.trim();
  const email        = body.email.trim();
  const { password } = body;

  let createdUser = null;
  try {
    // Verificar que el correo no esté tomado
    try {
      await adminAuth().getUserByEmail(email);
      return send(response, 409, { error: "Ya existe una cuenta con ese correo." });
    } catch (lookupError) {
      if (lookupError.code !== "auth/user-not-found") throw lookupError;
    }

    // Crear usuario en Firebase Auth
    createdUser = await adminAuth().createUser({
      email,
      password,
      displayName: ownerName,
      emailVerified: false,
      disabled: false
    });

    const supabase = getSupabaseAdmin();

    // Insertar taller en Supabase
    const { data: workshop, error: workshopError } = await supabase
      .from("workshops")
      .insert({
        business_name:          workshopName,
        legal_name:             "",
        tax_id:                 "",
        phone:                  "",
        email:                  "",
        address:                "",
        currency:               "PEN",
        tax_rate:               18,
        labor_hour_rate:        0,
        daily_goal:             0,
        order_prefix:           "OT",
        next_order_number:      1,
        require_approval:       true,
        prevent_negative_stock: true,
        notify_ready:           true,
        notify_delay:           true,
        active:                 true,
        owner_uid:              createdUser.uid
      })
      .select("id")
      .single();

    if (workshopError) throw workshopError;
    const workshopId = workshop.id;

    // Insertar miembro (admin) y user (mapeo uid → workshopId)
    const [{ error: memberError }, { error: userError }] = await Promise.all([
      supabase.from("members").insert({
        workshop_id:  workshopId,
        uid:          createdUser.uid,
        email,
        display_name: ownerName,
        role:         "admin",
        active:       true
      }),
      supabase.from("users").insert({
        uid:         createdUser.uid,
        workshop_id: workshopId,
        email
      })
    ]);

    if (memberError) throw memberError;
    if (userError)   throw userError;

    return send(response, 201, { workshopId, uid: createdUser.uid });
  } catch (error) {
    console.error(error);
    // Limpiar el usuario de Firebase Auth si algo falló después de crearlo
    if (createdUser) {
      await adminAuth().deleteUser(createdUser.uid).catch(() => {});
    }
    return send(response, error.status || 500, {
      error: error.message || "No se pudo completar el registro."
    });
  }
}
