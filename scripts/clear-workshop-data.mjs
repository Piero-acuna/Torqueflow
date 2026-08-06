import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin.mjs";

const workshopId = process.env.FIREBASE_WORKSHOP_ID || process.env.VITE_FIREBASE_WORKSHOP_ID;
const confirm = process.argv.find((arg) => arg.startsWith("--confirm="))?.split("=")[1];
const resetSettings = process.argv.includes("--reset-settings");

if (!workshopId) throw new Error("FIREBASE_WORKSHOP_ID no está configurado.");
if (confirm !== workshopId) {
  throw new Error(`Confirmación requerida: npm run clear:data -- --confirm=${workshopId}`);
}

const collections = [
  "clients",
  "vehicles",
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
