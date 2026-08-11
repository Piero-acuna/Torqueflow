-- =============================================================================
-- 0003_storage.sql
-- Crea el bucket "order-photos" en Supabase Storage y sus políticas RLS.
-- Ejecutar DESPUÉS de 0002_full_schema.sql.
-- =============================================================================

-- Crear el bucket (privado: no sirve URLs públicas sin firma)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-photos',
  'order-photos',
  false,
  10485760,  -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Política de subida: cualquier cliente autenticado (anon key) puede subir
-- fotos. La validación de que el path pertenece al workshopId correcto la
-- hace storage.service.js antes de llamar a supabase.storage.upload().
create policy "upload_order_photos"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'order-photos');

-- Política de lectura: cualquier cliente puede leer fotos de este bucket.
-- Las URLs incluyen el workshopId/orderId en el path, lo que actúa como
-- oscuridad adicional. No se comparte la URL al público sin firmar.
create policy "read_order_photos"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'order-photos');

-- Política de eliminación: solo vía service_role (API de Vercel).
-- Sin políticas de DELETE para anon = bloqueado.
