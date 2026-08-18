-- =============================================================================
-- 0007_notify_delivered.sql
--
-- Agrega un toggle independiente para notificar por correo cuando la orden
-- pasa a "Entregado" (además del ya existente notify_ready, que hasta ahora
-- existía en la tabla pero ningún código lo usaba).
--
-- Cómo aplicar:
--   Dashboard de Supabase → SQL Editor → New query → pega y ejecuta.
-- =============================================================================

alter table workshops
  add column if not exists notify_delivered boolean not null default true;
