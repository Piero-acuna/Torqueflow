import { supabase } from "../lib/supabaseClient";

// C5: solo imágenes de tipo conocido — bloquea .php, .htaccess, .exe, etc.
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const ALLOWED_MIME_TYPES  = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Sube fotos de recepción al bucket "order-photos" en Supabase Storage.
 * Path: workshops/{workshopId}/orders/{orderId}/{uuid}.{ext}
 *
 * IMPORTANTE: esta función necesita el workshopId que se obtiene de
 * AuthContext. Como los servicios son módulos puros (no hooks), recibe
 * workshopId como parámetro para no violar las reglas de hooks.
 */
export async function uploadOrderPhotos(orderId, files = [], workshopId) {
  if (!workshopId) throw new Error("workshopId requerido para subir fotos.");

  const uploads = Array.from(files).map(async (file) => {
    // C5: validar extensión
    const extension = (file.name.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new Error(`Tipo de archivo no permitido: .${extension}. Solo se permiten JPG, PNG o WebP.`);
    }

    // C5: validar MIME type (segunda barrera — el OS puede mentir en la extensión)
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw new Error(`Tipo MIME no permitido: ${file.type}. Solo se permiten imágenes JPG, PNG o WebP.`);
    }

    // C5: limitar tamaño a 10 MB por foto
    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      throw new Error(`La imagen "${file.name}" supera el límite de 10 MB.`);
    }

    const uniqueName = `${crypto.randomUUID()}.${extension}`;
    const path = `workshops/${workshopId}/orders/${orderId}/${uniqueName}`;

    const { data, error } = await supabase.storage
      .from("order-photos")
      .upload(path, file, {
        contentType: file.type,
        upsert: false
      });

    if (error) throw new Error(`Error al subir ${file.name}: ${error.message}`);

    // Generar URL firmada con 7 días de validez (las fotos son privadas)
    const { data: signedData } = await supabase.storage
      .from("order-photos")
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    return {
      name: file.name,
      path,
      url: signedData?.signedUrl || ""
    };
  });

  return Promise.all(uploads);
}

/**
 * Genera una URL firmada de corta duración para mostrar una foto ya subida.
 * Útil cuando la URL firmada original expiró.
 */
export async function getSignedPhotoUrl(path, expiresInSeconds = 3600) {
  const { data, error } = await supabase.storage
    .from("order-photos")
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
