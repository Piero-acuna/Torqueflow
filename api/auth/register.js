import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, parseBody, send } from "../_lib/firebase-admin.js";

// Endpoint público (sin requireMember): así es como nace un taller nuevo, no
// puede exigir membresía de algo que todavía no existe. La seguridad acá es
// distinta: valida los datos de entrada, evita duplicar correos, y hace
// limpieza si algo falla a mitad de camino para no dejar un usuario de Auth
// huérfano sin taller.

function validate(body) {
  const workshopName = (body.workshopName || "").trim();
  const ownerName = (body.ownerName || "").trim();
  const email = (body.email || "").trim();
  const password = body.password || "";
  if (!workshopName) return "El nombre del taller es obligatorio.";
  if (!ownerName) return "Tu nombre es obligatorio.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "El correo no es válido.";
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
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
  const ownerName = body.ownerName.trim();
  const email = body.email.trim();
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
      email,
      password,
      displayName: ownerName,
      emailVerified: false,
      disabled: false
    });

    const workshopRef = adminDb().collection("workshops").doc();
    const workshopId = workshopRef.id;
    const batch = adminDb().batch();

    batch.set(workshopRef, {
      businessName: workshopName,
      legalName: "",
      taxId: "",
      phone: "",
      email: "",
      address: "",
      currency: "PEN",
      taxRate: 18,
      laborHourRate: 0,
      dailyGoal: 0,
      orderPrefix: "OT",
      nextOrderNumber: 1,
      requireApproval: true,
      preventNegativeStock: true,
      notifyReady: true,
      notifyDelay: true,
      active: true,
      ownerUid: createdUser.uid,
      initializedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    batch.set(workshopRef.collection("members").doc(createdUser.uid), {
      uid: createdUser.uid,
      email,
      displayName: ownerName,
      role: "admin",
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    batch.set(adminDb().doc(`users/${createdUser.uid}`), {
      workshopId,
      email,
      createdAt: FieldValue.serverTimestamp()
    });

    await batch.commit();

    return send(response, 201, { workshopId, uid: createdUser.uid });
  } catch (error) {
    console.error(error);
    if (createdUser) {
      await adminAuth().deleteUser(createdUser.uid).catch(() => {});
    }
    return send(response, error.status || 500, { error: error.message || "No se pudo completar el registro." });
  }
}
