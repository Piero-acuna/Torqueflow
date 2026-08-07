# Colecciones de Firestore

> Clientes y vehículos ya NO viven aquí: se movieron a Postgres vía Firebase
> Data Connect. Ver `docs/DATACONNECT.md` y `dataconnect/schema/schema.gql`.
> `clients` y `vehicles` siguen bloqueadas en `firestore.rules`
> (`allow read, write: if false`) para datos viejos aún no migrados con
> `scripts/migrate-clients-to-sql.mjs`.

## orders
Documento principal de la orden. Incluye:

- Identificación correlativa.
- `clientId` y `vehicleId`: referencias por valor (UUID) a las tablas `clients`/`vehicles` de Postgres, más nombre/placa desnormalizados para lectura rápida sin ir a buscar a SQL en cada render.
- Diagnóstico, estado, prioridad y fechas.
- `serviceLines`.
- `partLines`.
- `externalJobs`.
- `photoEvidence`.
- `timeline`.
- `totals`.

## parts
Catálogo independiente. El stock inicial es cero y cambia únicamente mediante movimientos o consumo de órdenes.

## stockMovements
Kardex inmutable con stock anterior y resultante.
