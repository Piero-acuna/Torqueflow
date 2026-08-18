import { apiRequest } from "../lib/apiClient";

/**
 * Guarda la configuración del taller (PATCH /api/workshops).
 * Reemplaza el antiguo saveWorkshopSettings que usaba setDoc de Firestore.
 */
export async function saveWorkshopSettings(payload, workshopId) {
  return apiRequest("/api/workshops", {
    method: "PATCH",
    body: { ...payload, workshopId }
  });
}
