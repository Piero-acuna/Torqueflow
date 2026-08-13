import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/apiClient";
import { useAuth } from "../contexts/AuthContext";

const CLIENTS_KEY = "clients";
const VEHICLES_KEY = "vehicles";

export function useClients(search = "") {
  const { workshopId } = useAuth();
  return useQuery({
    queryKey: [CLIENTS_KEY, workshopId, search],
    queryFn: () => apiRequest("/api/clients", { params: { workshopId, search } }).then((data) => data.clients),
    enabled: Boolean(workshopId),
    placeholderData: (previous) => previous
  });
}

export function useClient(id) {
  const { workshopId } = useAuth();
  return useQuery({
    queryKey: [CLIENTS_KEY, "detail", workshopId, id],
    queryFn: () => apiRequest(`/api/clients/${id}`, { params: { workshopId } }).then((data) => data.client),
    enabled: Boolean(workshopId && id)
  });
}

export function useVehicles({ clientId, search } = {}) {
  const { workshopId } = useAuth();
  return useQuery({
    queryKey: [VEHICLES_KEY, workshopId, clientId || "all", search || ""],
    queryFn: () => apiRequest("/api/vehicles", { params: { workshopId, clientId, search } }).then((data) => data.vehicles),
    enabled: Boolean(workshopId),
    placeholderData: (previous) => previous
  });
}

export function useClientMutations() {
  const { workshopId } = useAuth();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] });

  const create = useMutation({
    mutationFn: (payload) => apiRequest("/api/clients", { method: "POST", body: { ...payload, workshopId } }),
    onSuccess: invalidate
  });
  const update = useMutation({
    mutationFn: ({ id, ...payload }) => apiRequest(`/api/clients/${id}`, { method: "PATCH", body: { ...payload, workshopId } }),
    onSuccess: invalidate
  });
  const deactivate = useMutation({
    mutationFn: (id) => apiRequest(`/api/clients/${id}`, { method: "DELETE", body: { workshopId } }),
    onSuccess: invalidate
  });

  return { create, update, deactivate };
}

export function useVehicleMutations() {
  const { workshopId } = useAuth();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [VEHICLES_KEY] });

  const create = useMutation({
    mutationFn: (payload) => apiRequest("/api/vehicles", { method: "POST", body: { ...payload, workshopId } }),
    onSuccess: invalidate
  });
  const update = useMutation({
    mutationFn: ({ id, ...payload }) => apiRequest(`/api/vehicles/${id}`, { method: "PATCH", body: { ...payload, workshopId } }),
    onSuccess: invalidate
  });
  const deactivate = useMutation({
    mutationFn: (id) => apiRequest(`/api/vehicles/${id}`, { method: "DELETE", body: { workshopId } }),
    onSuccess: invalidate
  });

  return { create, update, deactivate };
}