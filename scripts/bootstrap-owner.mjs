import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "./firebase-admin.mjs";

const workshopId = process.env.FIREBASE_WORKSHOP_ID || process.env.VITE_FIREBASE_WORKSHOP_ID;
const email = process.env.OWNER_EMAIL;
const password = process.env.OWNER_PASSWORD;
const displayName = process.env.OWNER_NAME || "Administrador";

if (!workshopId || !email || !password) {
  throw new Error("Configura FIREBASE_WORKSHOP_ID, OWNER_EMAIL y OWNER_PASSWORD en .env.local.");
}

let user;
try {
  user = await adminAuth.getUserByEmail(email);
  await adminAuth.updateUser(user.uid, { displayName, disabled: false });
  console.log(`Usuario existente habilitado: ${email}`);
} catch (error) {
  if (error.code !== "auth/user-not-found") throw error;
  user = await adminAuth.createUser({ email, password, displayName, disabled: false });
  console.log(`Usuario creado: ${email}`);
}

const workshopRef = adminDb.doc(`workshops/${workshopId}`);
await workshopRef.set({
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
  nextOrderNumber: 1,
  requireApproval: true,
  preventNegativeStock: true,
  notifyReady: true,
  notifyDelay: true,
  active: true,
  initializedAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp()
}, { merge: true });

await adminDb.doc(`workshops/${workshopId}/members/${user.uid}`).set({
  uid: user.uid,
  email,
  displayName,
  role: "admin",
  active: true,
  updatedAt: FieldValue.serverTimestamp(),
  createdAt: FieldValue.serverTimestamp()
}, { merge: true });

console.log(`Taller inicializado sin datos de demostración: ${workshopId}`);
console.log("Ahora inicia sesión y agrega clientes, vehículos, servicios, mecánicos y repuestos desde la interfaz.");
