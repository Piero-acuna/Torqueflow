-- =============================================================================
-- 0002_full_schema.sql
-- Migración completa: talleres, miembros, mecánicos, servicios, órdenes,
-- repuestos y movimientos de stock migran de Firestore a Postgres.
-- Clientes y vehículos ya existían en 0001_clients_vehicles.sql.
--
-- Cómo aplicar:
--   Dashboard de Supabase → SQL Editor → New query → pega y ejecuta.
--   O: supabase db push (si usas la CLI)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TALLERES
-- Reemplaza la colección workshops/{workshopId} de Firestore.
-- id es UUID generado por Postgres; en el frontend se usa como workshopId.
-- ---------------------------------------------------------------------------
create table if not exists workshops (
  id                    uuid        primary key default gen_random_uuid(),
  business_name         text        not null default '',
  legal_name            text        not null default '',
  tax_id                text        not null default '',
  phone                 text        not null default '',
  email                 text        not null default '',
  address               text        not null default '',
  currency              text        not null default 'PEN',
  tax_rate              numeric     not null default 18,
  labor_hour_rate       numeric     not null default 0,
  daily_goal            numeric     not null default 0,
  order_prefix          text        not null default 'OT',
  next_order_number     integer     not null default 1,
  require_approval      boolean     not null default true,
  prevent_negative_stock boolean    not null default true,
  notify_ready          boolean     not null default true,
  notify_delay          boolean     not null default true,
  active                boolean     not null default true,
  owner_uid             text        not null,
  initialized_at        timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists workshops_owner_idx on workshops (owner_uid);
alter table workshops enable row level security;

-- ---------------------------------------------------------------------------
-- USUARIOS (mapeo Firebase UID → workshopId)
-- Reemplaza la colección users/{uid} de Firestore.
-- uid es el Firebase Auth UID (string). workshop_id es UUID del taller.
-- ---------------------------------------------------------------------------
create table if not exists users (
  uid         text        primary key,
  workshop_id uuid        not null references workshops (id) on delete cascade,
  email       text        not null,
  created_at  timestamptz not null default now()
);

create index if not exists users_workshop_idx on users (workshop_id);
alter table users enable row level security;

-- ---------------------------------------------------------------------------
-- MIEMBROS
-- Reemplaza workshops/{id}/members/{uid} de Firestore.
-- uid es el Firebase Auth UID. role: admin|advisor|mechanic|cashier.
-- ---------------------------------------------------------------------------
create table if not exists members (
  id           uuid        primary key default gen_random_uuid(),
  workshop_id  uuid        not null references workshops (id) on delete cascade,
  uid          text        not null,
  email        text        not null,
  display_name text        not null,
  role         text        not null check (role in ('admin','advisor','mechanic','cashier')),
  active       boolean     not null default true,
  created_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workshop_id, uid)
);

create index if not exists members_uid_idx on members (uid);
create index if not exists members_workshop_idx on members (workshop_id);
alter table members enable row level security;

-- ---------------------------------------------------------------------------
-- MECÁNICOS
-- Reemplaza workshops/{id}/mechanics/{id} de Firestore.
-- ---------------------------------------------------------------------------
create table if not exists mechanics (
  id           uuid        primary key default gen_random_uuid(),
  workshop_id  uuid        not null references workshops (id) on delete cascade,
  name         text        not null,
  phone        text,
  specialty    text,
  active       boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists mechanics_workshop_idx on mechanics (workshop_id) where active;
alter table mechanics enable row level security;

-- ---------------------------------------------------------------------------
-- CATEGORÍAS DE SERVICIOS
-- Reemplaza workshops/{id}/serviceCategories/{id} de Firestore.
-- ---------------------------------------------------------------------------
create table if not exists service_categories (
  id           uuid        primary key default gen_random_uuid(),
  workshop_id  uuid        not null references workshops (id) on delete cascade,
  name         text        not null,
  description  text,
  active       boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists service_categories_workshop_idx on service_categories (workshop_id) where active;
alter table service_categories enable row level security;

-- ---------------------------------------------------------------------------
-- SERVICIOS
-- Reemplaza workshops/{id}/services/{id} de Firestore.
-- ---------------------------------------------------------------------------
create table if not exists services (
  id           uuid        primary key default gen_random_uuid(),
  workshop_id  uuid        not null references workshops (id) on delete cascade,
  category_id  uuid        references service_categories (id) on delete set null,
  name         text        not null,
  description  text,
  price        numeric     not null default 0,
  active       boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists services_workshop_idx on services (workshop_id) where active;
create index if not exists services_category_idx on services (category_id);
alter table services enable row level security;

-- ---------------------------------------------------------------------------
-- REPUESTOS / INVENTARIO
-- Reemplaza workshops/{id}/parts/{id} de Firestore.
-- stock en unidades enteras; costs y prices en la moneda del taller.
-- ---------------------------------------------------------------------------
create table if not exists parts (
  id              uuid        primary key default gen_random_uuid(),
  workshop_id     uuid        not null references workshops (id) on delete cascade,
  sku             text,
  barcode         text,
  name            text        not null,
  brand           text,
  category        text,
  unit            text        not null default 'unidad',
  compatibility   text,
  location        text,
  supplier        text,
  minimum_stock   integer     not null default 0,
  maximum_stock   integer     not null default 0,
  stock           integer     not null default 0 check (stock >= 0),
  average_cost    numeric     not null default 0,
  sale_price      numeric     not null default 0,
  notes           text,
  active          boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists parts_workshop_idx on parts (workshop_id) where active;
create index if not exists parts_sku_idx on parts (workshop_id, sku) where sku is not null;
alter table parts enable row level security;

-- ---------------------------------------------------------------------------
-- ÓRDENES DE TRABAJO
-- Reemplaza workshops/{id}/orders/{id} de Firestore.
-- Los ítems de servicio, repuestos y trabajos externos se guardan en JSONB
-- para mantener la flexibilidad del esquema actual.
-- ---------------------------------------------------------------------------
create table if not exists orders (
  id               uuid        primary key default gen_random_uuid(),
  workshop_id      uuid        not null references workshops (id) on delete cascade,
  order_number     text        not null,
  sequence         integer     not null,
  -- Referencias (UUIDs de las tablas Supabase; pueden ser null si se crearon
  -- antes de la migración o si el cliente/vehículo se eliminó)
  client_id        uuid        references clients (id) on delete set null,
  vehicle_id       uuid        references vehicles (id) on delete set null,
  mechanic_id      uuid        references mechanics (id) on delete set null,
  -- Snapshots desnormalizados para resiliencia histórica
  client_name      text,
  client_phone     text,
  vehicle_label    text,
  plate            text,
  mechanic_name    text,
  -- Estado del flujo
  status           text        not null default 'review'
                               check (status in ('review','pending','in_progress','paused','ready','delivered','cancelled')),
  priority         text        not null default 'normal'
                               check (priority in ('low','normal','high','urgent')),
  payment_status   text        not null default 'pending'
                               check (payment_status in ('pending','partial','paid','credit')),
  approval_status  text        not null default 'pending'
                               check (approval_status in ('pending','approved','rejected')),
  -- Descripción técnica
  customer_complaint  text,
  diagnosis           text,
  inspection_notes    text,
  internal_notes      text,
  -- Ítems (arrays de objetos JSON)
  service_lines    jsonb       not null default '[]',
  part_lines       jsonb       not null default '[]',
  external_jobs    jsonb       not null default '[]',
  photo_evidence   jsonb       not null default '[]',
  timeline         jsonb       not null default '[]',
  -- Costos y totales
  labor_cost       numeric     not null default 0,
  other_costs      numeric     not null default 0,
  discount         numeric     not null default 0,
  budget           numeric     not null default 0,
  totals           jsonb       not null default '{}',
  -- Recepción
  fuel_level       integer,
  mileage          integer,
  promised_at      timestamptz,
  entered_at       timestamptz,
  completed_at     timestamptz,
  -- Auditoría
  created_by       text,
  active           boolean     not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (workshop_id, order_number)
);

create index if not exists orders_workshop_idx      on orders (workshop_id) where active;
create index if not exists orders_status_idx        on orders (workshop_id, status) where active;
create index if not exists orders_client_idx        on orders (client_id) where client_id is not null;
create index if not exists orders_created_at_idx    on orders (workshop_id, created_at desc);
alter table orders enable row level security;

-- ---------------------------------------------------------------------------
-- MOVIMIENTOS DE STOCK (KARDEX)
-- Reemplaza workshops/{id}/stockMovements/{id} de Firestore.
-- Inmutables: no se actualiza ni elimina ningún registro.
-- ---------------------------------------------------------------------------
create table if not exists stock_movements (
  id              uuid        primary key default gen_random_uuid(),
  workshop_id     uuid        not null references workshops (id) on delete cascade,
  part_id         uuid        not null references parts (id) on delete restrict,
  part_name       text        not null,
  type            text        not null,
  direction       integer     not null check (direction in (-1, 1)),
  quantity        integer     not null check (quantity > 0),
  unit_cost       numeric     not null default 0,
  previous_stock  integer     not null,
  next_stock      integer     not null,
  order_id        uuid        references orders (id) on delete set null,
  order_number    text,
  reference       text,
  supplier        text,
  notes           text,
  actor_id        text        not null,
  actor_name      text        not null,
  created_at      timestamptz not null default now()
);

create index if not exists stock_movements_workshop_idx on stock_movements (workshop_id, created_at desc);
create index if not exists stock_movements_part_idx     on stock_movements (part_id, created_at desc);
alter table stock_movements enable row level security;

-- =============================================================================
-- TRIGGERS updated_at (reutiliza la función definida en 0001)
-- =============================================================================
drop trigger if exists workshops_set_updated_at        on workshops;
drop trigger if exists members_set_updated_at          on members;
drop trigger if exists mechanics_set_updated_at        on mechanics;
drop trigger if exists service_categories_set_updated_at on service_categories;
drop trigger if exists services_set_updated_at         on services;
drop trigger if exists parts_set_updated_at            on parts;
drop trigger if exists orders_set_updated_at           on orders;

create trigger workshops_set_updated_at
  before update on workshops for each row execute function set_updated_at();
create trigger members_set_updated_at
  before update on members for each row execute function set_updated_at();
create trigger mechanics_set_updated_at
  before update on mechanics for each row execute function set_updated_at();
create trigger service_categories_set_updated_at
  before update on service_categories for each row execute function set_updated_at();
create trigger services_set_updated_at
  before update on services for each row execute function set_updated_at();
create trigger parts_set_updated_at
  before update on parts for each row execute function set_updated_at();
create trigger orders_set_updated_at
  before update on orders for each row execute function set_updated_at();

-- =============================================================================
-- RLS POLICIES — Lectura para Supabase Realtime (anon key desde el navegador)
-- Escritura bloqueada para anon: toda mutación pasa por la API con service_role.
-- =============================================================================

-- orders
create policy "realtime_select_orders" on orders
  for select to anon using (true);

-- parts
create policy "realtime_select_parts" on parts
  for select to anon using (true);

-- mechanics
create policy "realtime_select_mechanics" on mechanics
  for select to anon using (true);

-- service_categories
create policy "realtime_select_service_categories" on service_categories
  for select to anon using (true);

-- services
create policy "realtime_select_services" on services
  for select to anon using (true);

-- stock_movements
create policy "realtime_select_stock_movements" on stock_movements
  for select to anon using (true);

-- workshops, members y users: NO lectura anon (solo via API con service_role)
-- (no se crean políticas SELECT — acceso denegado por defecto con RLS habilitado)

-- =============================================================================
-- FUNCIÓN AUXILIAR: calcular totales de una orden
-- =============================================================================
create or replace function calculate_order_totals(
  p_service_lines jsonb,
  p_part_lines    jsonb,
  p_external_jobs jsonb,
  p_labor_cost    numeric,
  p_other_costs   numeric,
  p_discount      numeric
)
returns jsonb
language plpgsql
as $$
declare
  v_services numeric := 0;
  v_parts    numeric := 0;
  v_external numeric := 0;
  v_total    numeric;
begin
  select coalesce(sum(
    coalesce((elem->>'price')::numeric, 0) *
    coalesce((elem->>'quantity')::numeric, 1)
  ), 0)
  into v_services
  from jsonb_array_elements(coalesce(p_service_lines, '[]')) elem;

  select coalesce(sum(
    coalesce((elem->>'unitPrice')::numeric, 0) *
    coalesce((elem->>'quantity')::numeric, 0)
  ), 0)
  into v_parts
  from jsonb_array_elements(coalesce(p_part_lines, '[]')) elem;

  select coalesce(sum(coalesce((elem->>'cost')::numeric, 0)), 0)
  into v_external
  from jsonb_array_elements(coalesce(p_external_jobs, '[]')) elem;

  v_total := greatest(0,
    v_services + v_parts + v_external +
    coalesce(p_labor_cost, 0) +
    coalesce(p_other_costs, 0) -
    coalesce(p_discount, 0)
  );

  return jsonb_build_object(
    'services',  v_services,
    'parts',     v_parts,
    'external',  v_external,
    'labor',     coalesce(p_labor_cost, 0),
    'other',     coalesce(p_other_costs, 0),
    'discount',  coalesce(p_discount, 0),
    'total',     v_total
  );
end;
$$;

-- =============================================================================
-- RPC: create_order
-- Crea una orden de trabajo y de forma atómica incrementa next_order_number
-- del taller. Previene números de orden duplicados bajo carga concurrente.
-- =============================================================================
create or replace function create_order(
  p_workshop_id uuid,
  p_payload     jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_workshop     workshops%rowtype;
  v_sequence     integer;
  v_order_number text;
  v_order_id     uuid;
  v_totals       jsonb;
begin
  -- Bloquear la fila del taller para serializar la asignación de número
  select * into v_workshop from workshops where id = p_workshop_id for update;
  if not found then
    raise exception 'Taller no encontrado' using errcode = 'P0002';
  end if;

  v_sequence     := coalesce(v_workshop.next_order_number, 1);
  v_order_number := coalesce(v_workshop.order_prefix, 'OT') || '-' ||
                    lpad(v_sequence::text, 6, '0');

  -- Incrementar secuencia del taller
  update workshops
  set next_order_number = v_sequence + 1,
      updated_at        = now()
  where id = p_workshop_id;

  -- Calcular totales iniciales
  v_totals := calculate_order_totals(
    coalesce(p_payload->'serviceLines', '[]'::jsonb),
    '[]'::jsonb,
    '[]'::jsonb,
    coalesce((p_payload->>'laborCost')::numeric, 0),
    coalesce((p_payload->>'otherCosts')::numeric, 0),
    coalesce((p_payload->>'discount')::numeric, 0)
  );

  insert into orders (
    id, workshop_id, order_number, sequence,
    client_id, vehicle_id, mechanic_id,
    client_name, client_phone, vehicle_label, plate, mechanic_name,
    status, priority, payment_status, approval_status,
    customer_complaint, diagnosis, inspection_notes, internal_notes,
    service_lines, part_lines, external_jobs, photo_evidence, timeline,
    labor_cost, other_costs, discount, budget, totals,
    fuel_level, mileage, promised_at, entered_at,
    created_by, active, created_at, updated_at
  ) values (
    gen_random_uuid(),
    p_workshop_id,
    v_order_number,
    v_sequence,
    nullif(p_payload->>'clientId', '')::uuid,
    nullif(p_payload->>'vehicleId', '')::uuid,
    nullif(p_payload->>'mechanicId', '')::uuid,
    p_payload->>'clientName',
    p_payload->>'clientPhone',
    p_payload->>'vehicleLabel',
    p_payload->>'plate',
    p_payload->>'mechanicName',
    coalesce(nullif(p_payload->>'status', ''), 'review'),
    coalesce(nullif(p_payload->>'priority', ''), 'normal'),
    coalesce(nullif(p_payload->>'paymentStatus', ''), 'pending'),
    coalesce(nullif(p_payload->>'approvalStatus', ''), 'pending'),
    nullif(p_payload->>'customerComplaint', ''),
    nullif(p_payload->>'diagnosis', ''),
    nullif(p_payload->>'inspectionNotes', ''),
    nullif(p_payload->>'internalNotes', ''),
    coalesce(p_payload->'serviceLines', '[]'::jsonb),
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    coalesce(p_payload->'timeline', '[]'::jsonb),
    coalesce((p_payload->>'laborCost')::numeric, 0),
    coalesce((p_payload->>'otherCosts')::numeric, 0),
    coalesce((p_payload->>'discount')::numeric, 0),
    coalesce((p_payload->>'budget')::numeric, 0),
    v_totals,
    nullif(p_payload->>'fuelLevel', '')::integer,
    nullif(p_payload->>'mileage', '')::integer,
    nullif(p_payload->>'promisedAt', '')::timestamptz,
    coalesce(nullif(p_payload->>'enteredAt', '')::timestamptz, now()),
    nullif(p_payload->>'createdBy', ''),
    true,
    now(),
    now()
  )
  returning id into v_order_id;

  return jsonb_build_object(
    'id',          v_order_id,
    'orderNumber', v_order_number,
    'sequence',    v_sequence
  );
end;
$$;

-- =============================================================================
-- RPC: add_part_to_order
-- Agrega un repuesto a una orden y de forma atómica descuenta el stock
-- del repuesto y registra el movimiento en el Kardex.
-- =============================================================================
create or replace function add_part_to_order(
  p_order_id   uuid,
  p_part_id    uuid,
  p_quantity   integer,
  p_unit_price numeric,
  p_actor_id   text,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_order          orders%rowtype;
  v_part           parts%rowtype;
  v_line_id        uuid;
  v_line           jsonb;
  v_new_part_lines jsonb;
  v_new_timeline   jsonb;
  v_new_totals     jsonb;
  v_prev_stock     integer;
  v_next_stock     integer;
  v_unit_cost      numeric;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'Orden no encontrada'; end if;

  select * into v_part from parts where id = p_part_id for update;
  if not found then raise exception 'Repuesto no encontrado'; end if;

  if p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;

  if v_part.stock < p_quantity then
    raise exception 'Stock insuficiente: disponible %, requerido %', v_part.stock, p_quantity;
  end if;

  v_prev_stock := v_part.stock;
  v_next_stock := v_part.stock - p_quantity;
  v_unit_cost  := coalesce(v_part.average_cost, v_part.sale_price, 0);
  v_line_id    := gen_random_uuid();

  v_line := jsonb_build_object(
    'id',        v_line_id,
    'partId',    p_part_id,
    'sku',       coalesce(v_part.sku, ''),
    'name',      v_part.name,
    'quantity',  p_quantity,
    'unitCost',  v_unit_cost,
    'unitPrice', p_unit_price,
    'addedAt',   now()::text
  );

  v_new_part_lines := coalesce(v_order.part_lines, '[]'::jsonb) || v_line;

  v_new_totals := calculate_order_totals(
    coalesce(v_order.service_lines, '[]'::jsonb),
    v_new_part_lines,
    coalesce(v_order.external_jobs, '[]'::jsonb),
    v_order.labor_cost,
    v_order.other_costs,
    v_order.discount
  );

  v_new_timeline := coalesce(v_order.timeline, '[]'::jsonb) || jsonb_build_object(
    'id',          gen_random_uuid(),
    'type',        'part_added',
    'description', 'Se agregó ' || p_quantity || ' × ' || v_part.name,
    'actorId',     p_actor_id,
    'actorName',   p_actor_name,
    'createdAt',   now()::text
  );

  -- Descontar stock del repuesto
  update parts
  set stock      = v_next_stock,
      updated_at = now()
  where id = p_part_id;

  -- Actualizar la orden
  update orders
  set part_lines = v_new_part_lines,
      totals     = v_new_totals,
      timeline   = v_new_timeline,
      updated_at = now()
  where id = p_order_id;

  -- Registrar movimiento en Kardex
  insert into stock_movements (
    id, workshop_id, part_id, part_name, type, direction,
    quantity, unit_cost, previous_stock, next_stock,
    order_id, order_number, actor_id, actor_name, created_at
  ) values (
    gen_random_uuid(),
    v_order.workshop_id,
    p_part_id,
    v_part.name,
    'order_use',
    -1,
    p_quantity,
    v_unit_cost,
    v_prev_stock,
    v_next_stock,
    p_order_id,
    v_order.order_number,
    p_actor_id,
    p_actor_name,
    now()
  );

  return v_line;
end;
$$;

-- =============================================================================
-- RPC: remove_part_from_order
-- Elimina una línea de repuesto de una orden y devuelve el stock.
-- =============================================================================
create or replace function remove_part_from_order(
  p_order_id   uuid,
  p_line_id    uuid,
  p_actor_id   text,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_order          orders%rowtype;
  v_line           jsonb;
  v_part_id        uuid;
  v_quantity       integer;
  v_part           parts%rowtype;
  v_prev_stock     integer;
  v_next_stock     integer;
  v_new_part_lines jsonb;
  v_new_totals     jsonb;
  v_new_timeline   jsonb;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'Orden no encontrada'; end if;

  -- Buscar la línea dentro del JSONB
  select elem into v_line
  from jsonb_array_elements(coalesce(v_order.part_lines, '[]')) elem
  where (elem->>'id')::uuid = p_line_id
  limit 1;

  if v_line is null then
    raise exception 'Línea de repuesto no encontrada';
  end if;

  v_part_id  := (v_line->>'partId')::uuid;
  v_quantity := (v_line->>'quantity')::integer;

  select * into v_part from parts where id = v_part_id for update;
  if not found then raise exception 'Repuesto no encontrado'; end if;

  v_prev_stock := v_part.stock;
  v_next_stock := v_part.stock + v_quantity;

  -- Eliminar la línea del array
  select jsonb_agg(elem) into v_new_part_lines
  from jsonb_array_elements(coalesce(v_order.part_lines, '[]')) elem
  where (elem->>'id')::uuid != p_line_id;

  v_new_part_lines := coalesce(v_new_part_lines, '[]'::jsonb);

  v_new_totals := calculate_order_totals(
    coalesce(v_order.service_lines, '[]'::jsonb),
    v_new_part_lines,
    coalesce(v_order.external_jobs, '[]'::jsonb),
    v_order.labor_cost,
    v_order.other_costs,
    v_order.discount
  );

  v_new_timeline := coalesce(v_order.timeline, '[]'::jsonb) || jsonb_build_object(
    'id',          gen_random_uuid(),
    'type',        'part_removed',
    'description', 'Se retiró ' || v_quantity || ' × ' || v_part.name,
    'actorId',     p_actor_id,
    'actorName',   p_actor_name,
    'createdAt',   now()::text
  );

  -- Devolver stock
  update parts
  set stock      = v_next_stock,
      updated_at = now()
  where id = v_part_id;

  -- Actualizar orden
  update orders
  set part_lines = v_new_part_lines,
      totals     = v_new_totals,
      timeline   = v_new_timeline,
      updated_at = now()
  where id = p_order_id;

  -- Registrar movimiento (devolución)
  insert into stock_movements (
    id, workshop_id, part_id, part_name, type, direction,
    quantity, unit_cost, previous_stock, next_stock,
    order_id, order_number, notes, actor_id, actor_name, created_at
  ) values (
    gen_random_uuid(),
    v_order.workshop_id,
    v_part_id,
    v_part.name,
    'order_return',
    1,
    v_quantity,
    coalesce(v_part.average_cost, v_part.sale_price, 0),
    v_prev_stock,
    v_next_stock,
    p_order_id,
    v_order.order_number,
    'Devolución al retirar repuesto de la orden',
    p_actor_id,
    p_actor_name,
    now()
  );

  return jsonb_build_object('removedLineId', p_line_id, 'restoredStock', v_quantity);
end;
$$;

-- =============================================================================
-- RPC: register_stock_movement
-- Registra una entrada/salida de inventario (compra, ajuste, etc.) y
-- actualiza el stock y el costo promedio ponderado del repuesto.
-- =============================================================================
create or replace function register_stock_movement(
  p_workshop_id uuid,
  p_part_id     uuid,
  p_type        text,
  p_direction   integer,
  p_quantity    integer,
  p_unit_cost   numeric,
  p_reference   text,
  p_supplier    text,
  p_notes       text,
  p_actor_id    text,
  p_actor_name  text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_part       parts%rowtype;
  v_prev_stock integer;
  v_next_stock integer;
  v_new_avg    numeric;
  v_movement_id uuid;
begin
  select * into v_part from parts
  where id = p_part_id and workshop_id = p_workshop_id for update;
  if not found then
    raise exception 'Repuesto no encontrado en este taller';
  end if;

  if p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;

  v_prev_stock := v_part.stock;
  v_next_stock := v_part.stock + (p_direction * p_quantity);

  if v_next_stock < 0 then
    raise exception 'Stock insuficiente: disponible %, requerido %', v_part.stock, p_quantity;
  end if;

  -- Actualizar costo promedio ponderado solo en entradas
  if p_direction = 1 and p_unit_cost > 0 then
    v_new_avg := (
      (v_part.stock * coalesce(v_part.average_cost, 0)) +
      (p_quantity   * p_unit_cost)
    ) / (v_part.stock + p_quantity);
  else
    v_new_avg := v_part.average_cost;
  end if;

  -- Actualizar repuesto
  update parts
  set stock        = v_next_stock,
      average_cost = v_new_avg,
      updated_at   = now()
  where id = p_part_id;

  -- Insertar movimiento
  insert into stock_movements (
    id, workshop_id, part_id, part_name, type, direction,
    quantity, unit_cost, previous_stock, next_stock,
    reference, supplier, notes, actor_id, actor_name, created_at
  ) values (
    gen_random_uuid(),
    p_workshop_id,
    p_part_id,
    v_part.name,
    p_type,
    p_direction,
    p_quantity,
    coalesce(p_unit_cost, 0),
    v_prev_stock,
    v_next_stock,
    nullif(p_reference, ''),
    nullif(p_supplier, ''),
    nullif(p_notes, ''),
    p_actor_id,
    p_actor_name,
    now()
  )
  returning id into v_movement_id;

  return jsonb_build_object(
    'id',            v_movement_id,
    'previousStock', v_prev_stock,
    'nextStock',     v_next_stock,
    'averageCost',   v_new_avg
  );
end;
$$;

-- Habilitar tablas para Supabase Realtime (replica identity full para UPDATE/DELETE)
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE parts REPLICA IDENTITY FULL;
ALTER TABLE mechanics REPLICA IDENTITY FULL;
ALTER TABLE services REPLICA IDENTITY FULL;
ALTER TABLE service_categories REPLICA IDENTITY FULL;
ALTER TABLE stock_movements REPLICA IDENTITY FULL;
