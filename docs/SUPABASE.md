# Supabase (Postgres) — clientes y vehículos

## Por qué existe

Todo el resto del sistema vive en Firestore. Clientes y vehículos viven en
Postgres porque son datos relacionales por naturaleza (un cliente tiene
muchos vehículos, se buscan por documento/placa, y con el tiempo van a
necesitar reportes y filtros que SQL resuelve mejor que Firestore).

Originalmente esto corría sobre Firebase Data Connect (Cloud SQL), pero
Cloud SQL exige el plan de facturación Blaze de Google Cloud desde el
primer minuto. Se migró a Supabase porque da Postgres real con un tier
gratuito sin pedir tarjeta.

## Esquema

`supabase/migrations/0001_clients_vehicles.sql` — dos tablas, `clients` y
`vehicles`, cada una con `workshop_id` para separar los datos de cada
taller. Para aplicarlo: pega el contenido de ese archivo en el **SQL
Editor** de tu proyecto de Supabase y ejecútalo (o usa `supabase db push`
si tienes la CLI de Supabase instalada).

## Cómo está protegido

Supabase no puede leer la membresía de un taller (eso vive en
`workshops/{id}/members/{uid}`, en Firestore). Por eso:

1. Las tablas tienen **Row Level Security (RLS) habilitado y sin
   políticas** — eso significa acceso denegado por defecto para cualquiera
   que no sea `service_role`. Ni la `anon key` (pública) ni un JWT de
   usuario de Supabase Auth pueden leer o escribir ahí, aunque quisieran.
2. El único camino es a través de `api/clients/*` y `api/vehicles/*`
   (funciones de Vercel). Cada una llama a `requireStaff`/`requireOperator`/
   `requireAdmin` (`api/_lib/firebase-admin.js`), que verifica el ID token
   de **Firebase** y que el usuario sea miembro activo del taller con el
   rol adecuado, antes de tocar Supabase.
3. Esas funciones usan `api/_lib/supabase-admin.js`, que se conecta con la
   **`service_role` key** — esa clave ignora RLS por completo, por eso
   nunca debe usarse en el navegador. Solo vive en la variable de entorno
   del servidor `SUPABASE_SERVICE_ROLE_KEY`.
4. `workshopId` viaja en cada petición (query param en GET, campo del body
   en el resto), validado siempre contra la membresía real en Firestore
   antes de llegar a Supabase — igual que con cualquier otro endpoint de
   `/api`. Ver `docs/MULTI-TENANT.md`.

No uses la Supabase Auth ni el cliente público (`anon key`) para nada de
clientes/vehículos: toda la autenticación de la app sigue siendo Firebase
Auth. Supabase aquí es solo una base de datos Postgres con API, nada más.

## Qué se eliminó al migrar desde Data Connect

- La carpeta `dataconnect/` completa (schema.gql, connector.gql,
  connector.yaml, dataconnect.yaml).
- `api/_lib/dataconnect-admin.js` → reemplazado por
  `api/_lib/supabase-admin.js`, con exactamente las mismas funciones
  exportadas (`listClients`, `getClientWithVehicles`, `createClient`,
  `updateClient`, `deactivateClient`, `listVehicles`, `getVehicle`,
  `createVehicle`, `updateVehicle`, `deactivateVehicle`), así que
  `api/clients/*` y `api/vehicles/*` casi no cambiaron.
- El bloque `dataconnect` de `firebase.json`.

## Variables de entorno

```env
SUPABASE_URL=https://tuproyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Settings → API → service_role — SECRETA, nunca VITE_
```

Ambas van **solo** en el servidor (Vercel → Environment Variables), nunca
con prefijo `VITE_`. El frontend nunca habla directo con Supabase — todo
pasa por `/api/clients` y `/api/vehicles`, igual que antes.

## Migración de datos existentes

Ver `scripts/migrate-clients-to-sql.mjs` y el paso 5 del `README.md` (el
script ya apunta a Supabase).

## Seguimiento pendiente (no bloquea producción, pero conviene)

- Paginación real en `listClients`/`listVehicles` (hoy traen todo el
  resultado filtrado; está bien para el volumen de un taller, pero conviene
  ponerle un límite si algún taller crece mucho).
- Backups: Supabase free tier no incluye backups automáticos con
  point-in-time recovery — si el volumen de datos importa, considera subir
  de plan o exportar periódicamente con `pg_dump`.
