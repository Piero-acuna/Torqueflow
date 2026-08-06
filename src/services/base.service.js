import {
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { workshopCollection, workshopDoc } from "../firebase/paths";

export function createCrudService(collectionName) {
  return {
    ref: () => workshopCollection(collectionName),
    async create(payload) {
      const result = await addDoc(workshopCollection(collectionName), {
        ...payload,
        active: payload.active ?? true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return result.id;
    },
    async set(id, payload, merge = true) {
      await setDoc(
        workshopDoc(collectionName, id),
        { ...payload, updatedAt: serverTimestamp() },
        { merge }
      );
      return id;
    },
    async update(id, payload) {
      await updateDoc(workshopDoc(collectionName, id), {
        ...payload,
        updatedAt: serverTimestamp()
      });
    },
    async remove(id) {
      await deleteDoc(workshopDoc(collectionName, id));
    },
    async deactivate(id) {
      await updateDoc(workshopDoc(collectionName, id), {
        active: false,
        updatedAt: serverTimestamp()
      });
    }
  };
}
