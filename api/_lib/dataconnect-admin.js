import { getDataConnect } from "firebase-admin/data-connect";
import { adminApp } from "./firebase-admin.js";

// Debe coincidir con dataconnect/dataconnect.yaml y
// dataconnect/torqueflow-connector/connector.yaml.
const connectorConfig = {
  connector: "torqueflow-connector",
  service: "torqueflow-service",
  location: "southamerica-east1"
};

function dataConnect() {
  return getDataConnect(connectorConfig, adminApp());
}

/**
 * Ejecuta una operación GraphQL definida en connector.gql con privilegios de
 * administrador (el SDK admin ignora los @auth del conector, por eso
 * requireMember/requireOperator/requireAdmin deben correr ANTES de llamar
 * esto, y workshopId debe salir siempre del token verificado, nunca del
 * body de la petición).
 */
async function run(query, variables) {
  const response = await dataConnect().executeGraphql(query, { variables });
  if (response.errors?.length) {
    const message = response.errors.map((error) => error.message).join(" / ");
    throw Object.assign(new Error(message), { status: 502 });
  }
  return response.data;
}

const CLIENT_FIELDS = `
  id
  type
  documentType
  documentNumber
  name
  phone
  email
  address
  segment
  creditLimit
  notes
  createdAt
  updatedAt
`;

const VEHICLE_FIELDS = `
  id
  plate
  brand
  model
  year
  color
  mileage
  fuelType
  vin
  notes
`;

export async function listClients(workshopId, search) {
  const data = await run(
    `query ListClients($workshopId: String!, $search: String) {
      clients(
        where: {
          workshopId: { eq: $workshopId }
          active: { eq: true }
          _or: [
            { name: { contains: $search } }
            { documentNumber: { contains: $search } }
            { phone: { contains: $search } }
          ]
        }
        orderBy: { name: ASC }
      ) { ${CLIENT_FIELDS} }
    }`,
    { workshopId, search: search || "" }
  );
  return data.clients;
}

export async function getClientWithVehicles(workshopId, id) {
  const data = await run(
    `query GetClient($id: UUID!) {
      client(id: $id) {
        ${CLIENT_FIELDS}
        workshopId
        active
        vehicles: vehicles_on_client(where: { active: { eq: true } }, orderBy: { plate: ASC }) {
          ${VEHICLE_FIELDS}
        }
      }
    }`,
    { id }
  );
  if (!data.client || data.client.workshopId !== workshopId) return null;
  return data.client;
}

export async function createClient(workshopId, input) {
  const data = await run(
    `mutation CreateClient($data: Client_Data!) {
      client_insert(data: $data)
    }`,
    { data: { workshopId, ...input } }
  );
  return data.client_insert;
}

export async function updateClient(workshopId, id, input) {
  const existing = await getClientWithVehicles(workshopId, id);
  if (!existing) throw Object.assign(new Error("El cliente no existe en este taller."), { status: 404 });
  await run(
    `mutation UpdateClient($id: UUID!, $data: Client_Data!) {
      client_update(id: $id, data: $data)
    }`,
    { id, data: { ...input, updatedAt_expr: "request.time" } }
  );
  return getClientWithVehicles(workshopId, id);
}

export async function deactivateClient(workshopId, id) {
  const existing = await getClientWithVehicles(workshopId, id);
  if (!existing) throw Object.assign(new Error("El cliente no existe en este taller."), { status: 404 });
  await run(
    `mutation DeactivateClient($id: UUID!) {
      client_update(id: $id, data: { active: false, updatedAt_expr: "request.time" })
    }`,
    { id }
  );
  return { id, active: false };
}

export async function listVehicles(workshopId, clientId, search) {
  const data = await run(
    `query ListVehicles($workshopId: String!, $clientId: UUID, $search: String) {
      vehicles(
        where: {
          workshopId: { eq: $workshopId }
          active: { eq: true }
          clientId: { eq: $clientId }
          _or: [
            { plate: { contains: $search } }
            { brand: { contains: $search } }
            { model: { contains: $search } }
          ]
        }
        orderBy: { plate: ASC }
      ) {
        ${VEHICLE_FIELDS}
        client { id name phone }
      }
    }`,
    { workshopId, clientId: clientId || null, search: search || "" }
  );
  return data.vehicles;
}

export async function getVehicle(workshopId, id) {
  const data = await run(
    `query GetVehicle($id: UUID!) {
      vehicle(id: $id) {
        ${VEHICLE_FIELDS}
        workshopId
        active
        client { id name phone email }
      }
    }`,
    { id }
  );
  if (!data.vehicle || data.vehicle.workshopId !== workshopId) return null;
  return data.vehicle;
}

export async function createVehicle(workshopId, input) {
  const client = await getClientWithVehicles(workshopId, input.clientId);
  if (!client) throw Object.assign(new Error("El cliente no existe en este taller."), { status: 404 });
  const data = await run(
    `mutation CreateVehicle($data: Vehicle_Data!) {
      vehicle_insert(data: $data)
    }`,
    { data: { workshopId, ...input } }
  );
  return data.vehicle_insert;
}

export async function updateVehicle(workshopId, id, input) {
  const existing = await getVehicle(workshopId, id);
  if (!existing) throw Object.assign(new Error("El vehículo no existe en este taller."), { status: 404 });
  await run(
    `mutation UpdateVehicle($id: UUID!, $data: Vehicle_Data!) {
      vehicle_update(id: $id, data: $data)
    }`,
    { id, data: { ...input, updatedAt_expr: "request.time" } }
  );
  return getVehicle(workshopId, id);
}

export async function deactivateVehicle(workshopId, id) {
  const existing = await getVehicle(workshopId, id);
  if (!existing) throw Object.assign(new Error("El vehículo no existe en este taller."), { status: 404 });
  await run(
    `mutation DeactivateVehicle($id: UUID!) {
      vehicle_update(id: $id, data: { active: false, updatedAt_expr: "request.time" })
    }`,
    { id }
  );
  return { id, active: false };
}
