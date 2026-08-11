import { apiRequest } from "../lib/apiClient";

/**
 * Fábrica que genera un servicio CRUD que consume los endpoints REST del backend.
 * Reemplaza a createCrudService de base.service.js (que usaba Firestore).
 *
 * @param {string} resource - Nombre del recurso en la URL (ej: "mechanics")
 */
function createApiCrudService(resource) {
  return {
    create: (payload, workshopId) =>
      apiRequest(`/api/${resource}`, { method: "POST", body: { ...payload, workshopId } }),
    update: (id, payload, workshopId) =>
      apiRequest(`/api/${resource}/${id}`, { method: "PATCH", body: { ...payload, workshopId } }),
    remove: (id, workshopId) =>
      apiRequest(`/api/${resource}/${id}`, { method: "DELETE", body: { workshopId } }),
    deactivate: (id, workshopId) =>
      apiRequest(`/api/${resource}/${id}`, { method: "DELETE", body: { workshopId } })
  };
}

export const mechanicsService          = createApiCrudService("mechanics");
export const serviceCategoriesService  = createApiCrudService("services");
export const servicesService           = createApiCrudService("services");

// Para la API de servicios, las categorías se diferencian con isCategory: true
serviceCategoriesService.create = (payload, workshopId) =>
  apiRequest("/api/services", { method: "POST", body: { ...payload, workshopId, isCategory: true } });
serviceCategoriesService.update = (id, payload, workshopId) =>
  apiRequest(`/api/services/${id}`, { method: "PATCH", body: { ...payload, workshopId, isCategory: true } });
serviceCategoriesService.remove = (id, workshopId) =>
  apiRequest(`/api/services/${id}`, { method: "DELETE", body: { workshopId, isCategory: true } });
