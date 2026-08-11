import { auth } from "../firebase/client";

/**
 * Cliente HTTP para llamar a los endpoints de Vercel (/api/...).
 * Inyecta automáticamente:
 *  - Authorization: Bearer <firebase-id-token>
 *  - Content-Type: application/json
 *
 * Para las rutas GET, los parámetros van en la URL (no en body).
 * Para POST/PATCH/DELETE, el body se envía como JSON.
 */
export async function apiRequest(path, options = {}) {
  const { method = "GET", body, params } = options;

  const token = await auth.currentUser?.getIdToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  let url = path;
  if (params && method === "GET") {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString();
    if (qs) url += `?${qs}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    ...(body && method !== "GET" ? { body: JSON.stringify(body) } : {})
  });

  // Intentar parsear el cuerpo incluso en errores
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw Object.assign(
      new Error(payload.error || `Error ${response.status}`),
      { status: response.status, payload }
    );
  }

  return payload;
}
