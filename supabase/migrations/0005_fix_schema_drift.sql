-- =============================================================================
-- 0005_fix_schema_drift.sql
--
-- La API (api/*.js) y el frontend quedaron por delante del esquema real de
-- la base de datos: usan columnas y valores de status que 0002_full_schema.sql
-- nunca creó. Esta migración pone la base de datos al día sin tocar datos
-- existentes.
--
-- Cómo aplicar:
--   Dashboard de Supabase → SQL Editor → New query → pega y ejecuta.
--   O: supabase db push (si usas la CLI)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) mechanics.hourly_cost
--    api/mechanics.js lee/escribe body.hourlyCost -> hourly_cost, pero la
--    columna nunca se creó. Causaba:
--    "Could not find the 'hourly_cost' column of 'mechanics' in the schema cache"
-- ---------------------------------------------------------------------------
alter table mechanics
  add column if not exists hourly_cost numeric not null default 0;

-- ---------------------------------------------------------------------------
-- 2) services.estimated_hours
--    api/services.js lee/escribe body.estimatedHours -> estimated_hours.
--    Causaba:
--    "Could not find the 'estimated_hours' column of 'services' in the schema cache"
-- ---------------------------------------------------------------------------
alter table services
  add column if not exists estimated_hours numeric not null default 0;

-- ---------------------------------------------------------------------------
-- 3) workshops.terms / workshops.document_footer
--    api/workshops.js y la pestaña "Documentos" de Configuración leen/escriben
--    body.terms -> terms y body.documentFooter -> document_footer.
--    Causaba:
--    "Could not find the 'document_footer' column of 'workshops' in the schema cache"
--    Como el PATCH es un solo UPDATE, al fallar por esta columna NINGÚN otro
--    campo del formulario se guardaba tampoco (por eso "no se han guardado
--    los pocos datos que tenía en configuración").
-- ---------------------------------------------------------------------------
alter table workshops
  add column if not exists terms text not null default '';

alter table workshops
  add column if not exists document_footer text not null default '';

-- ---------------------------------------------------------------------------
-- 4) orders.status: el constraint no coincide con los valores reales que usa
--    el tablero Kanban (src/config/constants.js -> ORDER_STATUSES).
--
--    Constraint viejo (0002): review, pending, in_progress, paused, ready,
--                              delivered, cancelled
--    Valores que envía el frontend: review, waiting_parts, external, ready,
--                              delivered, cancelled
--
--    Al mover una orden a "Esperando repuestos" o "En trabajo externo" caía
--    en: "new row for relation "orders" violates check constraint
--    "orders_status_check"". Se actualiza el constraint para reflejar los
--    estados reales del Kanban.
-- ---------------------------------------------------------------------------
alter table orders
  drop constraint if exists orders_status_check;

-- Si alguna orden vieja quedó con un status que ya no existe (pending,
-- in_progress, paused), la migramos a un equivalente razonable ANTES de
-- crear el constraint nuevo, para que la validación no falle sobre datos
-- existentes.
update orders set status = 'review'   where status = 'pending';
update orders set status = 'external' where status = 'in_progress';
update orders set status = 'external' where status = 'paused';

alter table orders
  add constraint orders_status_check
  check (status in ('review','waiting_parts','external','ready','delivered','cancelled'));
