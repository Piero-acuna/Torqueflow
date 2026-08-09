-- Clientes y vehículos, aislados por taller (workshop_id). El resto del
-- sistema (órdenes, stock, mecánicos) sigue en Firestore — ver
-- docs/SUPABASE.md para por qué solo esto vive en SQL.
--
-- Cómo correr esto en Supabase:
--   1. Dashboard de tu proyecto → SQL Editor → New query.
--   2. Pega TODO este archivo y ejecuta (Run).
-- (O, si usas la CLI de Supabase: `supabase db push`.)

create extension if not exists "pgcrypto";

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  workshop_id text not null,
  type text not null default 'person',
  document_type text,
  document_number text,
  name text not null,
  phone text,
  email text,
  address text,
  segment text not null default 'new',
  credit_limit numeric not null default 0,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_workshop_idx on clients (workshop_id) where active;
create index if not exists clients_workshop_name_idx on clients (workshop_id, name);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  workshop_id text not null,
  client_id uuid not null references clients (id) on delete restrict,
  plate text not null,
  brand text,
  model text,
  year integer,
  color text,
  mileage integer,
  fuel_type text,
  vin text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicles_workshop_idx on vehicles (workshop_id) where active;
create index if not exists vehicles_client_idx on vehicles (client_id);
create unique index if not exists vehicles_workshop_plate_unique on vehicles (workshop_id, plate) where active;

-- RLS habilitado y SIN políticas: nadie puede leer ni escribir estas tablas
-- con la clave pública (anon key) ni con un JWT de usuario, pase lo que
-- pase. Solo la service_role key (usada exclusivamente en
-- api/_lib/supabase-admin.js, del lado del servidor) puede tocarlas —
-- service_role ignora RLS por diseño de Supabase. Esto reemplaza el
-- @auth(level: NO_ACCESS) que tenía el conector de Data Connect: el
-- aislamiento real entre talleres lo sigue dando la verificación de
-- membresía en Firestore (requireStaff/requireOperator/requireAdmin) antes
-- de que cualquier función de Vercel llegue a llamar a Supabase.
alter table clients enable row level security;
alter table vehicles enable row level security;

-- Mantiene updated_at al día en cada UPDATE, para no tener que mandarlo
-- manualmente desde cada mutación del backend.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists clients_set_updated_at on clients;
create trigger clients_set_updated_at
  before update on clients
  for each row execute function set_updated_at();

drop trigger if exists vehicles_set_updated_at on vehicles;
create trigger vehicles_set_updated_at
  before update on vehicles
  for each row execute function set_updated_at();
