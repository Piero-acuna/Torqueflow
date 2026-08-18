import { apiRequest } from "../lib/apiClient";

export async function registerStockMovement(input, actor, workshopId) {
  const { result } = await apiRequest("/api/stock-movements", {
    method: "POST",
    body: { ...input, workshopId }
  });
  return result;
}

export const partsService = {
  create: (payload, workshopId) =>
    apiRequest("/api/parts", { method: "POST", body: { ...payload, workshopId } }),
  update: (id, payload, workshopId) =>
    apiRequest(`/api/parts/${id}`, { method: "PATCH", body: { ...payload, workshopId } }),
  deactivate: (id, workshopId) =>
    apiRequest(`/api/parts/${id}`, { method: "DELETE", body: { workshopId } }),
  remove: (id, workshopId) =>
    apiRequest(`/api/parts/${id}`, { method: "DELETE", body: { workshopId } })
};

// Repuestos en tránsito: comprados/pedidos al proveedor pero que aún no
// llegan al taller. "receive" ingresa el stock y genera el Kardex en una
// sola transacción (ver receive_part_transit en supabase/migrations).
export const partTransitService = {
  create: (payload, workshopId) =>
    apiRequest("/api/part-transit", { method: "POST", body: { ...payload, workshopId } }),
  receive: (id, workshopId) =>
    apiRequest(`/api/part-transit/${id}`, { method: "PATCH", body: { action: "receive", workshopId } }),
  cancel: (id, workshopId) =>
    apiRequest(`/api/part-transit/${id}`, { method: "PATCH", body: { action: "cancel", workshopId } })
};
