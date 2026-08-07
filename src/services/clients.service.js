import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/apiClient";

const CLIENTS_KEY = "clients";
const VEHICLES_KEY = "vehicles";

export function useClients(search = "") {
  return useQuery({
    queryKey: [CLIENTS_KEY, search],
    queryFn: () => apiRequest("/api/clients", { params: { search } }).then((data) => data.clients),
    placeholderData: (previous) => previous
  });
}

export function useClient(id) {
  return useQuery({
    queryKey: [CLIENTS_KEY, "detail", id],
    queryFn: () => apiRequest(`/api/clients/${id}`).then((data) => data.client),
    enabled: Boolean(id)
  });
}

export function useVehicles({ clientId, search } = {}) {
  return useQuery({
    queryKey: [VEHICLES_KEY, clientId || "all", search || ""],
    queryFn: () => apiRequest("/api/vehicles", { params: { clientId, search } }).then((data) => data.vehicles),
    placeholderData: (previous) => previous
  });
}

export function useClientMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] });

  const create = useMutation({
    mutationFn: (payload) => apiRequest("/api/clients", { method: "POST", body: payload }),
    onSuccess: invalidate
  });
  const update = useMutation({
    mutationFn: ({ id, ...payload }) => apiRequest(`/api/clients/${id}`, { method: "PATCH", body: payload }),
    onSuccess: invalidate
  });
  const deactivate = useMutation({
    mutationFn: (id) => apiRequest(`/api/clients/${id}`, { method: "DELETE" }),
    onSuccess: invalidate
  });

  return { create, update, deactivate };
}

export function useVehicleMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [VEHICLES_KEY] });

  const create = useMutation({
    mutationFn: (payload) => apiRequest("/api/vehicles", { method: "POST", body: payload }),
    onSuccess: invalidate
  });
  const update = useMutation({
    mutationFn: ({ id, ...payload }) => apiRequest(`/api/vehicles/${id}`, { method: "PATCH", body: payload }),
    onSuccess: invalidate
  });
  const deactivate = useMutation({
    mutationFn: (id) => apiRequest(`/api/vehicles/${id}`, { method: "DELETE" }),
    onSuccess: invalidate
  });

  return { create, update, deactivate };
}
