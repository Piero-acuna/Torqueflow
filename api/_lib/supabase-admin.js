import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// service_role ignora RLS por completo — por eso NUNCA debe usarse esta
// clave en el navegador (a diferencia de la anon key, que sí es pública).
// Solo vive en la variable de entorno del servidor SUPABASE_SERVICE_ROLE_KEY.
// Ver supabase/migrations/0001_clients_vehicles.sql: las tablas tienen RLS
// habilitado y sin políticas, así que sin esta clave nadie puede leer ni
// escribir nada — ni con la anon key ni con un JWT de usuario.
let cachedClient = null;

function supabase() {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw Object.assign(new Error("SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están configurados."), { status: 500 });
  }
  cachedClient = createSupabaseClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return cachedClient;
}

function fail(error) {
  throw Object.assign(new Error(error.message), { status: error.code === "23505" ? 409 : 502 });
}

const CLIENT_SELECT = "id, type, document_type, document_number, name, phone, email, address, segment, credit_limit, notes, created_at, updated_at";
const VEHICLE_SELECT = "id, plate, brand, model, year, color, mileage, fuel_type, vin, notes";

function toClient(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    documentType: row.document_type,
    documentNumber: row.document_number,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    segment: row.segment,
    creditLimit: row.credit_limit,
    notes: row.notes,
    active: row.active,
    workshopId: row.workshop_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    vehicles: row.vehicles ? row.vehicles.map(toVehicle) : undefined
  };
}

function toVehicle(row) {
  if (!row) return null;
  return {
    id: row.id,
    plate: row.plate,
    brand: row.brand,
    model: row.model,
    year: row.year,
    color: row.color,
    mileage: row.mileage,
    fuelType: row.fuel_type,
    vin: row.vin,
    notes: row.notes,
    active: row.active,
    workshopId: row.workshop_id,
    client: row.client ? { id: row.client.id, name: row.client.name, phone: row.client.phone, email: row.client.email } : undefined
  };
}

function fromClientInput(input) {
  return {
    type: input.type,
    document_type: input.documentType,
    document_number: input.documentNumber,
    name: input.name,
    phone: input.phone,
    email: input.email,
    address: input.address,
    segment: input.segment,
    credit_limit: input.creditLimit,
    notes: input.notes
  };
}

function fromVehicleInput(input) {
  return {
    client_id: input.clientId,
    plate: input.plate,
    brand: input.brand,
    model: input.model,
    year: input.year,
    color: input.color,
    mileage: input.mileage,
    fuel_type: input.fuelType,
    vin: input.vin,
    notes: input.notes
  };
}

export async function listClients(workshopId, search) {
  let query = supabase()
    .from("clients")
    .select(CLIENT_SELECT)
    .eq("workshop_id", workshopId)
    .eq("active", true)
    .order("name", { ascending: true });
  if (search) {
    query = query.or(`name.ilike.%${search}%,document_number.ilike.%${search}%,phone.ilike.%${search}%`);
  }
  const { data, error } = await query;
  if (error) fail(error);
  return data.map(toClient);
}

export async function getClientWithVehicles(workshopId, id) {
  const { data, error } = await supabase()
    .from("clients")
    .select(`*, vehicles!vehicles_client_id_fkey(${VEHICLE_SELECT}, active)`)
    .eq("id", id)
    .maybeSingle();
  if (error) fail(error);
  if (!data || data.workshop_id !== workshopId) return null;
  const client = toClient(data);
  client.vehicles = (data.vehicles || []).filter((vehicle) => vehicle.active).map(toVehicle);
  return client;
}

export async function createClient(workshopId, input) {
  const { data, error } = await supabase()
    .from("clients")
    .insert({ workshop_id: workshopId, ...fromClientInput(input) })
    .select(CLIENT_SELECT)
    .single();
  if (error) fail(error);
  return toClient(data);
}

export async function updateClient(workshopId, id, input) {
  const existing = await getClientWithVehicles(workshopId, id);
  if (!existing) throw Object.assign(new Error("El cliente no existe en este taller."), { status: 404 });
  const payload = Object.fromEntries(Object.entries(fromClientInput(input)).filter(([, value]) => value !== undefined));
  const { error } = await supabase().from("clients").update(payload).eq("id", id);
  if (error) fail(error);
  return getClientWithVehicles(workshopId, id);
}

export async function deactivateClient(workshopId, id) {
  const existing = await getClientWithVehicles(workshopId, id);
  if (!existing) throw Object.assign(new Error("El cliente no existe en este taller."), { status: 404 });
  const { error } = await supabase().from("clients").update({ active: false }).eq("id", id);
  if (error) fail(error);
  return { id, active: false };
}

export async function listVehicles(workshopId, clientId, search) {
  let query = supabase()
    .from("vehicles")
    .select(`${VEHICLE_SELECT}, client:clients(id, name, phone)`)
    .eq("workshop_id", workshopId)
    .eq("active", true)
    .order("plate", { ascending: true });
  if (clientId) query = query.eq("client_id", clientId);
  if (search) query = query.or(`plate.ilike.%${search}%,brand.ilike.%${search}%,model.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) fail(error);
  return data.map(toVehicle);
}

export async function getVehicle(workshopId, id) {
  const { data, error } = await supabase()
    .from("vehicles")
    .select(`*, client:clients(id, name, phone, email)`)
    .eq("id", id)
    .maybeSingle();
  if (error) fail(error);
  if (!data || data.workshop_id !== workshopId) return null;
  return toVehicle(data);
}

export async function createVehicle(workshopId, input) {
  const client = await getClientWithVehicles(workshopId, input.clientId);
  if (!client) throw Object.assign(new Error("El cliente no existe en este taller."), { status: 404 });
  const { data, error } = await supabase()
    .from("vehicles")
    .insert({ workshop_id: workshopId, ...fromVehicleInput(input) })
    .select(VEHICLE_SELECT)
    .single();
  if (error) fail(error);
  return toVehicle(data);
}

export async function updateVehicle(workshopId, id, input) {
  const existing = await getVehicle(workshopId, id);
  if (!existing) throw Object.assign(new Error("El vehículo no existe en este taller."), { status: 404 });
  const payload = Object.fromEntries(Object.entries(fromVehicleInput(input)).filter(([, value]) => value !== undefined));
  delete payload.client_id; // no se reasigna el dueño desde update
  const { error } = await supabase().from("vehicles").update(payload).eq("id", id);
  if (error) fail(error);
  return getVehicle(workshopId, id);
}

export async function deactivateVehicle(workshopId, id) {
  const existing = await getVehicle(workshopId, id);
  if (!existing) throw Object.assign(new Error("El vehículo no existe en este taller."), { status: 404 });
  const { error } = await supabase().from("vehicles").update({ active: false }).eq("id", id);
  if (error) fail(error);
  return { id, active: false };
}
