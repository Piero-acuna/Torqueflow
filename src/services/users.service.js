import { apiRequest } from "../lib/apiClient";

/**
 * Los endpoints reales viven en /api/admin (vercel.json reescribe
 * /api/admin/* -> /api/admin). Usamos apiRequest, igual que el resto de
 * servicios, para que las peticiones GET manden workshopId por query string
 * en vez de "body" (un GET con body no es válido y el navegador lo ignora).
 */
export const usersService = {
  list:    (workshopId)          => apiRequest("/api/admin/users", { params: { workshopId } }).then((data) => data.members),
  create:  (workshopId, payload) => apiRequest("/api/admin/users", { method: "POST",   body: { ...payload, workshopId } }),
  update:  (workshopId, payload) => apiRequest("/api/admin/users", { method: "PATCH",  body: { ...payload, workshopId } }),
  disable: (workshopId, payload) => apiRequest("/api/admin/users", { method: "DELETE", body: { ...payload, workshopId } })
};
