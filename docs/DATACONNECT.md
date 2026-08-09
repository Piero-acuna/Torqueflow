# Data Connect (Postgres) — clientes y vehículos

## Por qué existe

Todo el resto del sistema vive en Firestore. Clientes y vehículos se movieron
a Postgres porque son datos relacionales por naturaleza (un cliente tiene
muchos vehículos, se buscan por documento/placa, y con el tiempo van a
necesitar reportes y filtros que SQL resuelve mejor que Firestore).

## Cómo está protegido

Data Connect **no puede leer la membresía de un taller** (eso vive en
`workshops/{id}/members/{uid}`, en Firestore). Por eso:

1. `connector.gql` marca **todas** las operaciones como `@auth(level: NO_ACCESS)`.
   El navegador nunca puede llamarlas directamente, ni con un usuario
   autenticado.
2. El único camino es a través de `api/clients/*` y `api/vehicles/*`
   (funciones de Vercel). Cada una llama a `requireStaff`/`requireOperator`/
   `requireAdmin` (`api/_lib/firebase-admin.js`), que verifica el ID token de
   Firebase **y** que el usuario sea miembro activo del taller con el rol
   adecuado, antes de tocar Postgres.
3. Esas funciones usan el SDK admin (`firebase-admin/data-connect`,
   ver `api/_lib/dataconnect-admin.js`), que sí puede ejecutar las
   operaciones porque ignora los `@auth` del conector — por diseño, solo se
   invoca después del paso 2.
4. `workshopId` viaja en cada petición (query param en GET, campo del body en
   el resto) — ya **no** hay un único taller fijo por variable de entorno,
   porque desde que existe el registro público (`api/auth/register.js`) cada
   cuenta puede crear su propio taller. Esto es seguro porque el paso 2 no es
   opcional: si el uid del token no es miembro activo de *ese* workshopId
   exacto, `requireMember` responde 403 sin que la petición llegue a tocar
   Postgres — no importa qué workshopId haya mandado el cliente. La
   protección la da la verificación de membresía, no el origen del dato.

## Por qué no hay SDK generado

`firebase dataconnect:sdk:generate` necesita descargar el emulador de Data
Connect. En el entorno donde se escribió esta capa no había salida de red
para hacerlo, así que `api/_lib/dataconnect-admin.js` ejecuta las consultas
como strings GraphQL crudos con `executeGraphql`. Es más verboso que un SDK
tipado, pero no depende de un paso de generación que pueda desincronizarse
del esquema. Si prefieres el SDK tipado: agrega de nuevo la sección
`generate` en `dataconnect/torqueflow-connector/connector.yaml` y corre el
comando donde sí tengas acceso a internet completo.

## Antes de desplegar

`connector.gql` se escribió a mano siguiendo la sintaxis documentada de Data
Connect (`where`, `_or`, `contains`, `orderBy`, `_insert`/`_update`
generados por tabla), pero **no se validó contra el CLI real**. Antes de
producción:

```bash
firebase deploy --only dataconnect --dry-run   # valida el esquema/conector
```

y revisa cualquier error de sintaxis que reporte el CLI — son ajustes
menores de nombres de operadores, no de arquitectura.

## Migración de datos existentes

Ver `scripts/migrate-clients-to-sql.mjs` y el paso 5 del `README.md`.

## Seguimiento pendiente (no bloquea producción, pero conviene)

- Restricción `UNIQUE (workshop_id, plate)` en `vehicles` vía migración SQL
  manual (hoy la duplicidad de placas solo se evita a nivel de aplicación).
- Índices compuestos `(workshop_id, name)` en `clients` y
  `(workshop_id, plate)` en `vehicles` para acelerar las búsquedas cuando
  crezca el volumen.
- Paginación real en `ListClients`/`ListVehicles` (hoy traen todo el
  resultado filtrado; está bien para el volumen de un taller, pero conviene
  ponerle un límite si algún taller crece mucho).
