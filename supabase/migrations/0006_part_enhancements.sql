-- =============================================================================
-- 0006_part_enhancements.sql
--
-- Mejoras de inventario:
--   1) parts.condition        — Estado de la pieza (nuevo / usado / reacondicionado)
--   2) parts.warranty_months  — Garantía del proveedor, en meses
--   3) tabla part_transit     — Repuestos en tránsito (comprados, aún no llegan)
--      + función receive_part_transit(): al marcar "recibido" ingresa el stock
--        y registra el movimiento en el Kardex de forma atómica, igual que
--        register_stock_movement().
--
-- Cómo aplicar:
--   Dashboard de Supabase → SQL Editor → New query → pega y ejecuta.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Estado de la pieza
-- ---------------------------------------------------------------------------
alter table parts
  add column if not exists condition text not null default 'nuevo';

alter table parts
  drop constraint if exists parts_condition_check;

alter table parts
  add constraint parts_condition_check
  check (condition in ('nuevo','usado','reacondicionado'));

-- ---------------------------------------------------------------------------
-- 2) Garantía del proveedor (en meses; 0 = sin garantía)
-- ---------------------------------------------------------------------------
alter table parts
  add column if not exists warranty_months integer not null default 0;

alter table parts
  drop constraint if exists parts_warranty_months_check;

alter table parts
  add constraint parts_warranty_months_check
  check (warranty_months >= 0);

-- ---------------------------------------------------------------------------
-- 3) Repuestos en tránsito
-- ---------------------------------------------------------------------------
create table if not exists part_transit (
  id              uuid        primary key default gen_random_uuid(),
  workshop_id     uuid        not null references workshops (id) on delete cascade,
  part_id         uuid        not null references parts (id) on delete cascade,
  part_name       text        not null,
  quantity        integer     not null check (quantity > 0),
  unit_cost       numeric     not null default 0,
  supplier        text,
  reference       text,   -- N° de orden de compra / factura proforma / tracking
  expected_date   date,
  status          text        not null default 'in_transit',
  notes           text,
  actor_id        text        not null,
  actor_name      text        not null,
  received_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table part_transit
  drop constraint if exists part_transit_status_check;

alter table part_transit
  add constraint part_transit_status_check
  check (status in ('in_transit','received','cancelled'));

create index if not exists part_transit_workshop_idx on part_transit (workshop_id);
create index if not exists part_transit_part_idx      on part_transit (part_id);

drop trigger if exists set_updated_at on part_transit;
create trigger set_updated_at
  before update on part_transit for each row execute function set_updated_at();

alter table part_transit enable row level security;

-- Igual que el resto del inventario: lectura en vivo para anon (Realtime),
-- toda escritura pasa por la API con service_role.
drop policy if exists "realtime_select_part_transit" on part_transit;
create policy "realtime_select_part_transit" on part_transit
  for select to anon using (true);

alter table part_transit replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'part_transit'
  ) then
    alter publication supabase_realtime add table part_transit;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Función: marcar un envío en tránsito como recibido.
-- Ingresa el stock del repuesto y registra el movimiento en stock_movements,
-- todo en una sola transacción (mismo patrón que register_stock_movement).
-- ---------------------------------------------------------------------------
create or replace function receive_part_transit(
  p_workshop_id uuid,
  p_transit_id  uuid,
  p_actor_id    text,
  p_actor_name  text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_transit    part_transit%rowtype;
  v_part       parts%rowtype;
  v_prev_stock integer;
  v_next_stock integer;
  v_new_avg    numeric;
  v_movement_id uuid;
begin
  select * into v_transit from part_transit
  where id = p_transit_id and workshop_id = p_workshop_id for update;
  if not found then
    raise exception 'Envío en tránsito no encontrado en este taller';
  end if;

  if v_transit.status <> 'in_transit' then
    raise exception 'Este envío ya fue % ', v_transit.status;
  end if;

  select * into v_part from parts
  where id = v_transit.part_id and workshop_id = p_workshop_id for update;
  if not found then
    raise exception 'Repuesto no encontrado en este taller';
  end if;

  v_prev_stock := v_part.stock;
  v_next_stock := v_part.stock + v_transit.quantity;

  if v_transit.unit_cost > 0 then
    v_new_avg := (
      (v_part.stock          * coalesce(v_part.average_cost, 0)) +
      (v_transit.quantity    * v_transit.unit_cost)
    ) / (v_part.stock + v_transit.quantity);
  else
    v_new_avg := v_part.average_cost;
  end if;

  update parts
  set stock        = v_next_stock,
      average_cost = v_new_avg,
      updated_at   = now()
  where id = v_part.id;

  insert into stock_movements (
    id, workshop_id, part_id, part_name, type, direction,
    quantity, unit_cost, previous_stock, next_stock,
    reference, supplier, notes, actor_id, actor_name, created_at
  ) values (
    gen_random_uuid(),
    p_workshop_id,
    v_part.id,
    v_part.name,
    'transit_received',
    1,
    v_transit.quantity,
    coalesce(v_transit.unit_cost, 0),
    v_prev_stock,
    v_next_stock,
    nullif(v_transit.reference, ''),
    nullif(v_transit.supplier, ''),
    nullif(v_transit.notes, ''),
    p_actor_id,
    p_actor_name,
    now()
  )
  returning id into v_movement_id;

  update part_transit
  set status      = 'received',
      received_at = now(),
      updated_at  = now()
  where id = p_transit_id;

  return jsonb_build_object(
    'movementId',    v_movement_id,
    'previousStock', v_prev_stock,
    'nextStock',     v_next_stock,
    'averageCost',   v_new_avg
  );
end;
$$;
