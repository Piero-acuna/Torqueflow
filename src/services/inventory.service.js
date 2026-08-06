import {
  doc,
  runTransaction,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase/client";
import { workshopCollection, workshopDoc } from "../firebase/paths";
import { STOCK_MOVEMENT_TYPES } from "../config/constants";
import { createCrudService } from "./base.service";

export const partsService = createCrudService("parts");
export const partsRef = () => workshopCollection("parts");
export const stockMovementsRef = () => workshopCollection("stockMovements");

function movementDirection(type) {
  return STOCK_MOVEMENT_TYPES.find((item) => item.value === type)?.direction || 0;
}

export async function registerStockMovement(input, actor) {
  const movementRef = doc(workshopCollection("stockMovements"));
  const partRef = workshopDoc("parts", input.partId);

  return runTransaction(db, async (transaction) => {
    const partSnapshot = await transaction.get(partRef);
    if (!partSnapshot.exists()) throw new Error("El repuesto seleccionado no existe.");

    const part = partSnapshot.data();
    const quantity = Number(input.quantity || 0);
    if (quantity <= 0) throw new Error("La cantidad debe ser mayor que cero.");

    const direction = movementDirection(input.type);
    if (!direction) throw new Error("El tipo de movimiento no es válido.");

    const previousStock = Number(part.stock || 0);
    const nextStock = previousStock + direction * quantity;
    if (nextStock < 0) throw new Error("Stock insuficiente para registrar la salida.");

    let averageCost = Number(part.averageCost || part.cost || 0);
    const unitCost = Number(input.unitCost || averageCost || 0);
    if (direction > 0 && input.type === "purchase") {
      const previousValue = previousStock * averageCost;
      const incomingValue = quantity * unitCost;
      averageCost = nextStock > 0 ? (previousValue + incomingValue) / nextStock : unitCost;
    }

    transaction.update(partRef, {
      stock: nextStock,
      averageCost,
      updatedAt: serverTimestamp()
    });
    transaction.set(movementRef, {
      ...input,
      quantity,
      unitCost,
      previousStock,
      nextStock,
      direction,
      actorId: actor?.uid || "",
      actorName: actor?.displayName || actor?.email || "",
      createdAt: serverTimestamp()
    });

    return { movementId: movementRef.id, previousStock, nextStock, averageCost };
  });
}
