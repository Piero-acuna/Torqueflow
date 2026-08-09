// Migra los documentos existentes en Firestore ("clients" y "vehicles" bajo
// workshops/{workshopId}) hacia las tablas de Supabase. Es idempotente: cada
// documento migrado se marca con migratedToSql=true en Firestore para poder
// reintentar sin duplicar filas si el script se corta.
//
// Uso:
//   node scripts/migrate-clients-to-sql.mjs --workshop=<workshopId> [--dry-run]
//
// Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local, además de
// lo que ya usa el resto de scripts/ (ver scripts/firebase-admin.mjs).

import { createClient } from "@supabase/supabase-js";
import { adminDb } from "./firebase-admin.mjs";
import { loadLocalEnv } from "./env.mjs";

loadLocalEnv();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.");
}
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? true];
  })
);

const workshopId = args.workshop;
const dryRun = Boolean(args["dry-run"]);

if (!workshopId) {
  console.error("Falta --workshop=<workshopId>");
  process.exit(1);
}

async function insertClient(payload) {
  const { data, error } = await supabase.from("clients").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

async function insertVehicle(payload) {
  const { data, error } = await supabase.from("vehicles").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

async function migrateClients() {
  const snapshot = await adminDb
    .collection(`workshops/${workshopId}/clients`)
    .where("migratedToSql", "!=", true)
    .get();

  console.log(`Clientes por migrar: ${snapshot.size}`);
  const idMap = new Map();

  for (const doc of snapshot.docs) {
    const client = doc.data();
    const payload = {
      workshop_id: workshopId,
      type: client.type || "person",
      document_type: client.documentType || null,
      document_number: client.documentNumber || null,
      name: client.name || "(sin nombre)",
      phone: client.phone || null,
      email: client.email || null,
      address: client.address || null,
      segment: client.segment || "new",
      credit_limit: Number(client.creditLimit || 0),
      notes: client.notes || null,
      active: client.active !== false
    };

    if (dryRun) {
      console.log(`[dry-run] cliente ${doc.id} -> ${payload.name}`);
      continue;
    }

    const newId = await insertClient(payload);
    idMap.set(doc.id, newId);
    await doc.ref.update({ migratedToSql: true, sqlId: newId });
    console.log(`Migrado cliente ${doc.id} -> ${newId}`);
  }

  return idMap;
}

async function migrateVehicles(clientIdMap) {
  const snapshot = await adminDb
    .collection(`workshops/${workshopId}/vehicles`)
    .where("migratedToSql", "!=", true)
    .get();

  console.log(`Vehículos por migrar: ${snapshot.size}`);

  for (const doc of snapshot.docs) {
    const vehicle = doc.data();
    const newClientId = clientIdMap.get(vehicle.clientId);
    if (!newClientId) {
      console.warn(`Vehículo ${doc.id} apunta a un cliente no migrado (${vehicle.clientId}); se omite. Corre el script de nuevo después de migrar ese cliente.`);
      continue;
    }

    const payload = {
      workshop_id: workshopId,
      client_id: newClientId,
      plate: (vehicle.plate || "").toUpperCase(),
      brand: vehicle.brand || null,
      model: vehicle.model || null,
      year: vehicle.year ? Number(vehicle.year) : null,
      color: vehicle.color || null,
      mileage: vehicle.mileage ? Number(vehicle.mileage) : null,
      fuel_type: vehicle.fuelType || vehicle.fuel || null,
      vin: vehicle.vin || null,
      notes: vehicle.notes || null,
      active: vehicle.active !== false
    };

    if (dryRun) {
      console.log(`[dry-run] vehículo ${doc.id} -> ${payload.plate}`);
      continue;
    }

    const newId = await insertVehicle(payload);
    await doc.ref.update({ migratedToSql: true, sqlId: newId });
    console.log(`Migrado vehículo ${doc.id} -> ${newId}`);
  }
}

async function main() {
  console.log(`Migrando taller ${workshopId}${dryRun ? " (dry-run, no escribe nada)" : ""}`);
  const clientIdMap = await migrateClients();
  await migrateVehicles(clientIdMap);
  console.log("Listo. Revisa los datos en Supabase antes de bloquear las colecciones viejas en firestore.rules (ya quedaron bloqueadas por defecto en este cambio).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
