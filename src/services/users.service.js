import { auth } from "../firebase/client";

async function request(method, body) {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch("/api/admin/users", {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "No se pudo gestionar el usuario.");
  return payload;
}

export const usersService = {
  create:  (workshopId, payload) => request("POST",   { ...payload, workshopId }),
  update:  (workshopId, payload) => request("PATCH",  { ...payload, workshopId }),
  disable: (workshopId, payload) => request("DELETE", { ...payload, workshopId })
};
