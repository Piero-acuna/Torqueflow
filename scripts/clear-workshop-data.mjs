import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin.mjs";

// Antes había un solo taller por despliegue (FIREBASE_WORKSHOP_ID). Ahora
// cada registro crea el suyo, así que hay que indicar cuál limpiar:
//   npm run clear:data -- --workshop=<id> --confirm=<id>
const argWorkshop = process.argv.find((arg) => arg.startsWith("--workshop="))?.split("=")[1];
const workshopId = argWorkshop || process.env.FIREBASE_WORKSHOP_ID || process.env.VITE_FIREBASE_WORKSHOP_ID;
const confirm = process.argv.find((arg) => arg.startsWith("--confirm="))?.split("=")[1];
const resetSettings = process.argv.includes("--reset-settings");
const clearSql = process.argv.includes("--include-sql");

if (!workshopId) throw new Error("Indica --workshop=<id> (o configura FIREBASE_WORKSHOP_ID para el flujo antiguo de un solo taller).");
if (confirm !== workshopId) {
  throw new Error(`Confirmación requerida: npm run clear:data -- --workshop=${workshopId} --confirm=${workshopId}`);
}

// clients y vehicles ya NO viven en Firestore, se movieron a Postgres
// (Supabase). Por defecto este script solo limpia Firestore; pasa
// --include-sql para borrar también los clientes/vehículos de ese taller
// en Postgres.
const collections = [
  "mechanics",
  "serviceCategories",
  "services",
  "orders",
  "parts",
  "stockMovements",
  "auditLogs"
];

async function deleteCollection(path, batchSize = 250) {
  while (true) {
    const snapshot = await adminDb.collection(path).limit(batchSize).get();
    if (snapshot.empty) return;
    const batch = adminDb.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
    console.log(`Eliminados ${snapshot.size} documentos de ${path}`);
  }
}

for (const name of collections) {
  await deleteCollection(`workshops/${workshopId}/${name}`);
}

if (clearSql) {
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para usar --include-sql.");
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  const { error: vehiclesError } = await supabase.from("vehicles").delete().eq("workshop_id", workshopId);
  if (vehiclesError) throw new Error(vehiclesError.message);
  const { error: clientsError } = await supabase.from("clients").delete().eq("workshop_id", workshopId);
  if (clientsError) throw new Error(clientsError.message);
  console.log("Clientes y vehículos eliminados de Supabase.");
}

const update = {
  nextOrderNumber: 1,
  updatedAt: FieldValue.serverTimestamp()
};

if (resetSettings) {
  Object.assign(update, {
    businessName: "",
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
    requireApproval: true,
    preventNegativeStock: true,
    notifyReady: true,
    notifyDelay: true,
    terms: "",
    documentFooter: ""
  });
}

await adminDb.doc(`workshops/${workshopId}`).set(update, { merge: true });
console.log("Datos operativos eliminados. Las cuentas y membresías se conservaron.");
