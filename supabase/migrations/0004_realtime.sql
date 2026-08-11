-- ============================================================
-- 0004_realtime.sql
-- Habilita Supabase Realtime (postgres_changes) para las
-- tablas que el frontend suscribe via useSupabaseCollection.
--
-- Supabase Realtime es GRATUITO en el plan Free.
-- Esto NO es lo mismo que "Read Replicas" (que sí es de pago).
--
-- Cómo aplicar:
--   Panel de Supabase → SQL Editor → pega y ejecuta este archivo.
-- ============================================================

-- Activar Realtime para las tablas operativas
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE parts;
ALTER PUBLICATION supabase_realtime ADD TABLE workshops;
ALTER PUBLICATION supabase_realtime ADD TABLE mechanics;
ALTER PUBLICATION supabase_realtime ADD TABLE services;
ALTER PUBLICATION supabase_realtime ADD TABLE members;
ALTER PUBLICATION supabase_realtime ADD TABLE service_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_movements;

-- Verificar qué tablas tienen Realtime activo (opcional)
-- SELECT schemaname, tablename
-- FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime';
