import { serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase/client";
import { workshopCollection, workshopDoc } from "../firebase/paths";
import { createCrudService } from "./base.service";

export const clientsService = createCrudService("clients");
export const vehiclesService = createCrudService("vehicles");

export async function createClientWithVehicle(client, vehicle) {
  const batch = writeBatch(db);
  const clientRef = workshopDoc("clients", crypto.randomUUID());
  batch.set(clientRef, {
    ...client,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  let vehicleId = null;
  if (vehicle?.plate) {
    vehicleId = crypto.randomUUID();
    batch.set(workshopDoc("vehicles", vehicleId), {
      ...vehicle,
      clientId: clientRef.id,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
  await batch.commit();
  return { clientId: clientRef.id, vehicleId };
}

export function clientsRef() {
  return workshopCollection("clients");
}

export function vehiclesRef() {
  return workshopCollection("vehicles");
}
