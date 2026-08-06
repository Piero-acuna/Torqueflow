import {
  doc,
  runTransaction,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { db } from "../firebase/client";
import { workshopCollection, workshopDoc, workshopRef } from "../firebase/paths";
import { calculateOrderTotals } from "../lib/calculations";

export const ordersRef = () => workshopCollection("orders");

function timelineEvent(type, description, actor) {
  return {
    id: crypto.randomUUID(),
    type,
    description,
    actorId: actor?.uid || "",
    actorName: actor?.displayName || actor?.email || "",
    createdAt: new Date().toISOString()
  };
}

export async function createOrder(input, actor) {
  const orderRef = doc(workshopCollection("orders"));
  return runTransaction(db, async (transaction) => {
    const workshopSnapshot = await transaction.get(workshopRef());
    if (!workshopSnapshot.exists()) {
      throw new Error("El taller no está inicializado. Ejecuta npm run bootstrap:owner.");
    }
    const workshop = workshopSnapshot.data();
    const sequence = Number(workshop.nextOrderNumber || 1);
    const prefix = workshop.orderPrefix || "OT";
    const orderNumber = `${prefix}-${String(sequence).padStart(6, "0")}`;
    const baseOrder = {
      ...input,
      orderNumber,
      sequence,
      status: input.status || "review",
      priority: input.priority || "normal",
      paymentStatus: input.paymentStatus || "pending",
      serviceLines: input.serviceLines || [],
      partLines: [],
      externalJobs: [],
      photoEvidence: [],
      timeline: [timelineEvent("created", "Orden creada", actor)],
      laborCost: Number(input.laborCost || 0),
      otherCosts: Number(input.otherCosts || 0),
      discount: Number(input.discount || 0),
      budget: Number(input.budget || 0),
      active: true,
      createdBy: actor?.uid || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const totals = calculateOrderTotals(baseOrder);
    transaction.set(orderRef, { ...baseOrder, totals });
    transaction.update(workshopRef(), {
      nextOrderNumber: sequence + 1,
      updatedAt: serverTimestamp()
    });
    return { id: orderRef.id, orderNumber };
  });
}

export async function updateOrder(orderId, payload, actor) {
  const orderRef = workshopDoc("orders", orderId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists()) throw new Error("La orden no existe.");
    const current = snapshot.data();
    const next = { ...current, ...payload };
    const totals = calculateOrderTotals(next);
    const timeline = [
      ...(current.timeline || []),
      timelineEvent("updated", "Datos de la orden actualizados", actor)
    ];
    transaction.update(orderRef, {
      ...payload,
      totals,
      timeline,
      updatedAt: serverTimestamp()
    });
  });
}

export async function changeOrderStatus(orderId, status, actor) {
  const orderRef = workshopDoc("orders", orderId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists()) throw new Error("La orden no existe.");
    const order = snapshot.data();
    const timeline = [
      ...(order.timeline || []),
      timelineEvent("status", `Estado actualizado a ${status}`, actor)
    ];
    transaction.update(orderRef, {
      status,
      timeline,
      ...(status === "delivered" ? { completedAt: new Date().toISOString() } : {}),
      updatedAt: serverTimestamp()
    });
  });
}

export async function addPartToOrder(orderId, input, actor) {
  const orderRef = workshopDoc("orders", orderId);
  const partRef = workshopDoc("parts", input.partId);
  const movementRef = doc(workshopCollection("stockMovements"));

  return runTransaction(db, async (transaction) => {
    const [orderSnapshot, partSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(partRef)
    ]);
    if (!orderSnapshot.exists()) throw new Error("La orden no existe.");
    if (!partSnapshot.exists()) throw new Error("El repuesto no existe.");

    const order = orderSnapshot.data();
    const part = partSnapshot.data();
    const quantity = Number(input.quantity || 0);
    const previousStock = Number(part.stock || 0);
    if (quantity <= 0) throw new Error("La cantidad debe ser mayor que cero.");
    if (previousStock < quantity) throw new Error("Stock insuficiente.");

    const line = {
      id: crypto.randomUUID(),
      partId: input.partId,
      sku: part.sku || "",
      name: part.name || "",
      quantity,
      unitCost: Number(part.averageCost || part.cost || 0),
      unitPrice: Number(input.unitPrice ?? part.salePrice ?? 0),
      addedAt: new Date().toISOString()
    };
    const partLines = [...(order.partLines || []), line];
    const nextOrder = { ...order, partLines };
    const totals = calculateOrderTotals(nextOrder);
    const nextStock = previousStock - quantity;

    transaction.update(partRef, { stock: nextStock, updatedAt: serverTimestamp() });
    transaction.update(orderRef, {
      partLines,
      totals,
      timeline: [...(order.timeline || []), timelineEvent("part", `Se agregó ${quantity} × ${part.name}`, actor)],
      updatedAt: serverTimestamp()
    });
    transaction.set(movementRef, {
      type: "order_use",
      partId: input.partId,
      partName: part.name || "",
      orderId,
      orderNumber: order.orderNumber || "",
      quantity,
      direction: -1,
      previousStock,
      nextStock,
      unitCost: line.unitCost,
      actorId: actor?.uid || "",
      actorName: actor?.displayName || actor?.email || "",
      createdAt: serverTimestamp()
    });
    return line;
  });
}

export async function removePartFromOrder(orderId, lineId, actor) {
  const orderRef = workshopDoc("orders", orderId);
  return runTransaction(db, async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists()) throw new Error("La orden no existe.");
    const order = orderSnapshot.data();
    const line = (order.partLines || []).find((item) => item.id === lineId);
    if (!line) throw new Error("La pieza no está registrada en la orden.");
    const partRef = workshopDoc("parts", line.partId);
    const partSnapshot = await transaction.get(partRef);
    if (!partSnapshot.exists()) throw new Error("El repuesto relacionado no existe.");
    const part = partSnapshot.data();
    const previousStock = Number(part.stock || 0);
    const nextStock = previousStock + Number(line.quantity || 0);
    const partLines = (order.partLines || []).filter((item) => item.id !== lineId);
    const totals = calculateOrderTotals({ ...order, partLines });
    const movementRef = doc(workshopCollection("stockMovements"));

    transaction.update(partRef, { stock: nextStock, updatedAt: serverTimestamp() });
    transaction.update(orderRef, {
      partLines,
      totals,
      timeline: [...(order.timeline || []), timelineEvent("part_return", `Se retiró ${line.name} y se devolvió al stock`, actor)],
      updatedAt: serverTimestamp()
    });
    transaction.set(movementRef, {
      type: "return",
      partId: line.partId,
      partName: line.name,
      orderId,
      orderNumber: order.orderNumber || "",
      quantity: Number(line.quantity || 0),
      direction: 1,
      previousStock,
      nextStock,
      unitCost: Number(line.unitCost || 0),
      actorId: actor?.uid || "",
      actorName: actor?.displayName || actor?.email || "",
      createdAt: serverTimestamp()
    });
  });
}

export async function addExternalJob(orderId, input, actor) {
  const orderRef = workshopDoc("orders", orderId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists()) throw new Error("La orden no existe.");
    const order = snapshot.data();
    const job = { id: crypto.randomUUID(), ...input, cost: Number(input.cost || 0), createdAt: new Date().toISOString() };
    const externalJobs = [...(order.externalJobs || []), job];
    const totals = calculateOrderTotals({ ...order, externalJobs });
    transaction.update(orderRef, {
      externalJobs,
      totals,
      timeline: [...(order.timeline || []), timelineEvent("external", `Trabajo externo registrado: ${job.description}`, actor)],
      updatedAt: serverTimestamp()
    });
    return job;
  });
}

export async function removeExternalJob(orderId, jobId, actor) {
  const orderRef = workshopDoc("orders", orderId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists()) throw new Error("La orden no existe.");
    const order = snapshot.data();
    const externalJobs = (order.externalJobs || []).filter((item) => item.id !== jobId);
    const totals = calculateOrderTotals({ ...order, externalJobs });
    transaction.update(orderRef, {
      externalJobs,
      totals,
      timeline: [...(order.timeline || []), timelineEvent("external_removed", "Trabajo externo eliminado", actor)],
      updatedAt: serverTimestamp()
    });
  });
}

export async function attachOrderPhotos(orderId, photoEvidence) {
  await updateDoc(workshopDoc("orders", orderId), {
    photoEvidence,
    updatedAt: serverTimestamp()
  });
}
