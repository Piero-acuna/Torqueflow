import { auth } from "../firebase/client";

/**
 * fetch() autenticado hacia las funciones serverless en /api. Adjunta el ID
 * token de Firebase Auth como Bearer; el backend valida ese token y la
 * membresía del taller antes de tocar Firestore o Data Connect.
 */
export async function apiRequest(path, { method = "GET", body, params } = {}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sesión no válida. Vuelve a iniciar sesión.");

  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "No se pudo completar la solicitud.");
  return payload;
}
