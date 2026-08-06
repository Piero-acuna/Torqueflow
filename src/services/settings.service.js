import { serverTimestamp, setDoc } from "firebase/firestore";
import { workshopRef } from "../firebase/paths";

export async function saveWorkshopSettings(payload) {
  await setDoc(
    workshopRef(),
    { ...payload, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
