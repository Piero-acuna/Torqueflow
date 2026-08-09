import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length) {
  console.warn(`Firebase no está configurado. Faltan: ${missing.join(", ")}`);
}

export const firebaseConfigured = missing.length === 0;

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

// Antes había un único taller por despliegue (VITE_FIREBASE_WORKSHOP_ID).
// Ahora cada registro crea su propio taller, así que el workshopId real se
// resuelve en tiempo de ejecución (ver AuthContext: lee users/{uid} tras el
// login) y se guarda acá para que src/firebase/paths.js lo use sin tener
// que pasarlo por parámetro en cada llamada de cada servicio existente.
let currentWorkshopId = "";

export function getWorkshopId() {
  return currentWorkshopId;
}

export function setWorkshopId(id) {
  currentWorkshopId = id || "";
}
