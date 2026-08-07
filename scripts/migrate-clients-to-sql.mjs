// Migra los documentos existentes en Firestore ("clients" y "vehicles" bajo
// workshops/{workshopId}) hacia las tablas SQL de Data Connect. Es
// idempotente: cada documento migrado se marca con migratedToSql=true en
// Firestore para poder reintentar sin duplicar filas si el script se corta.
//
// Uso:
//   node scripts/migrate-clients-to-sql.mjs --workshop=<workshopId> [--dry-run]
//
// Requiere las mismas variables que el resto de scripts/ (ver
// scripts/firebase-admin.mjs) más las credenciales de Data Connect, que ya
// usa el mismo service account de Firebase Admin.

import { getDataConnect } from "firebase-admin/data-connect";
import { adminDb } from "./firebase-admin.mjs";

const app = adminDb.app;
const connectorConfig = {
  connector: "torqueflow-connector",
  service: "torqueflow-service",
  location: "southamerica-east1"
};

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

async function run(query, variables) {
  const response = await getDataConnect(connectorConfig, app).executeGraphql(query, { variables });
  if (response.errors?.length) {
    throw new Error(response.errors.map((error) => error.message).join(" / "));
  }
  return response.data;
}

async function insertClient(data) {
  const result = await run(
    `mutation InsertClient($data: Client_Data!) { client_insert(data: $data) }`,
    { data }
  );
  return result.client_insert.id;
}

async function insertVehicle(data) {
  const result = await run(
    `mutation InsertVehicle($data: Vehicle_Data!) { vehicle_insert(data: $data) }`,
    { data }
  );
  return result.vehicle_insert.id;
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
      workshopId,
      type: client.type || "person",
      documentType: client.documentType || null,
      documentNumber: client.documentNumber || null,
      name: client.name || "(sin nombre)",
      phone: client.phone || null,
      email: client.email || null,
      address: client.address || null,
      segment: client.segment || "new",
      creditLimit: Number(client.creditLimit || 0),
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
      workshopId,
      clientId: newClientId,
      plate: (vehicle.plate || "").toUpperCase(),
      brand: vehicle.brand || null,
      model: vehicle.model || null,
      year: vehicle.year ? Number(vehicle.year) : null,
      color: vehicle.color || null,
      mileage: vehicle.mileage ? Number(vehicle.mileage) : null,
      fuelType: vehicle.fuelType || vehicle.fuel || null,
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
  console.log("Listo. Revisa los datos en Postgres antes de bloquear las colecciones viejas en firestore.rules (ya quedaron bloqueadas por defecto en este cambio).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
