import { collection, doc } from "firebase/firestore";
import { db, workshopId } from "./client";

export function workshopRef() {
  return doc(db, "workshops", workshopId);
}

export function workshopCollection(name) {
  return collection(db, "workshops", workshopId, name);
}

export function workshopDoc(name, id) {
  return doc(db, "workshops", workshopId, name, id);
}

export function memberRef(uid) {
  return workshopDoc("members", uid);
}
