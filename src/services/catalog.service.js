import { apiRequest } from "../lib/apiClient";

/**
 * Fábrica que genera un servicio CRUD que consume los endpoints REST del backend.
 * Reemplaza a createCrudService de base.service.js (que usaba Firestore).
 *
 * @param {string} resource - Nombre del recurso en la URL (ej: "mechanics")
 */
function createApiCrudService(resource) {
  return {
    create:     (payload, workshopId) =>
      apiRequest(`/api/${resource}`,     { method: "POST",   body: { ...payload, workshopId } }),
    update:     (id, payload, workshopId) =>
      apiRequest(`/api/${resource}/${id}`, { method: "PATCH",  body: { ...payload, workshopId } }),
    remove:     (id, workshopId) =>
      apiRequest(`/api/${resource}/${id}`, { method: "DELETE", body: { workshopId } }),
    deactivate: (id, workshopId) =>
      apiRequest(`/api/${resource}/${id}`, { method: "DELETE", body: { workshopId } })
  };
}

export const mechanicsService         = createApiCrudService("mechanics");
export const servicesService          = createApiCrudService("services");

// Categorías de servicios — se distinguen via isCategory en la misma ruta /api/services
// Para DELETE se envía isCategory como query string porque algunos navegadores ignoran el body en DELETE
export const serviceCategoriesService = {
  create: (payload, workshopId) =>
    apiRequest("/api/services", { method: "POST",   body: { ...payload, workshopId, isCategory: true } }),
  update: (id, payload, workshopId) =>
    apiRequest(`/api/services/${id}`, { method: "PATCH",  body: { ...payload, workshopId, isCategory: true } }),
  remove: (id, workshopId) =>
    apiRequest(`/api/services/${id}?isCategory=true`, { method: "DELETE", body: { workshopId } }),
  deactivate: (id, workshopId) =>
    apiRequest(`/api/services/${id}?isCategory=true`, { method: "DELETE", body: { workshopId } })
};
