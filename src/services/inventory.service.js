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

