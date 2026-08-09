import { collection, doc } from "firebase/firestore";
import { db, getWorkshopId } from "./client";

function requireWorkshopId() {
  const workshopId = getWorkshopId();
  if (!workshopId) throw new Error("No se pudo determinar el taller activo. Vuelve a iniciar sesión.");
  return workshopId;
}

export function workshopRef() {
  return doc(db, "workshops", requireWorkshopId());
}

export function workshopCollection(name) {
  return collection(db, "workshops", requireWorkshopId(), name);
}

export function workshopDoc(name, id) {
  return doc(db, "workshops", requireWorkshopId(), name, id);
}

export function memberRef(uid) {
  return workshopDoc("members", uid);
}

export function userRef(uid) {
  return doc(db, "users", uid);
}
