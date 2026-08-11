import { apiRequest } from "../lib/apiClient";

/**
 * Todos los métodos de este servicio delegan la lógica transaccional al
 * backend (Vercel Functions), que a su vez llama a funciones RPC de Postgres.
 * No hay ninguna referencia a Firestore.
 */

export async function createOrder(input, actor, workshopId) {
  const { order } = await apiRequest("/api/orders", {
    method: "POST",
    body: { ...input, workshopId }
  });
  return order;
}

export async function updateOrder(orderId, payload, actor, workshopId) {
  const { order } = await apiRequest(`/api/orders/${orderId}`, {
    method: "PATCH",
    body: { ...payload, workshopId }
  });
  return order;
}

export async function changeOrderStatus(orderId, status, actor, workshopId) {
  return updateOrder(orderId, { status }, actor, workshopId);
}

export async function addPartToOrder(orderId, input, actor, workshopId) {
  const { line } = await apiRequest("/api/orders/parts", {
    method: "POST",
    body: { orderId, ...input, workshopId }
  });
  return line;
}

export async function removePartFromOrder(orderId, lineId, actor, workshopId) {
  return apiRequest("/api/orders/parts", {
    method: "DELETE",
    body: { orderId, lineId, workshopId }
  });
}

export async function addExternalJob(orderId, input, actor, workshopId) {
  const { job } = await apiRequest("/api/orders/external", {
    method: "POST",
    body: { orderId, ...input, workshopId }
  });
  return job;
}

export async function removeExternalJob(orderId, jobId, actor, workshopId) {
  return apiRequest("/api/orders/external", {
    method: "DELETE",
    body: { orderId, jobId, workshopId }
  });
}

export async function attachOrderPhotos(orderId, photoEvidence, workshopId) {
  return apiRequest("/api/orders/photos", {
    method: "PATCH",
    body: { orderId, photoEvidence, workshopId }
  });
}
