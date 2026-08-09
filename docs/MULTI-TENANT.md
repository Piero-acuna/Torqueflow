# Multi-taller y registro

## Modelo

Cada taller es independiente. Un usuario pertenece a exactamente un taller
(no hay, por ahora, un mismo correo perteneciendo a varios talleres a la
vez). La relación usuario → taller vive en un documento top-level:

```text
users/{uid} = { workshopId, email, createdAt }
```

Ese documento solo lo escribe el backend (con el SDK admin), nunca el
cliente — ver `firestore.rules`. Se crea en dos momentos:

1. **Registro público** (`api/auth/register.js`): alguien llena "Crear un
   taller nuevo" en el login → se crea su cuenta de Firebase Auth, un
   `workshops/{id}` nuevo, su membresía como `admin`, y `users/{uid}`
   apuntando a ese taller. Es el único endpoint que no exige sesión previa
   (obviamente: el usuario todavía no existe).
2. **Invitación de un admin** (`api/admin/users.js`, pestaña "Equipo" en
   Configuración): un admin ya autenticado crea una cuenta para un
   compañero, en **su mismo** taller. También escribe `users/{uid}`.

## Cómo se resuelve el taller al iniciar sesión

`src/contexts/AuthContext.jsx`, tras el login:

1. Lee `users/{uid}` → obtiene `workshopId`.
2. Llama a `setWorkshopId(workshopId)` (`src/firebase/client.js`), que queda
   en memoria para toda la sesión — de ahí lo toman `src/firebase/paths.js`
   (rutas de Firestore) y los hooks de `src/services/clients.service.js`
   (que además lo mandan explícitamente en cada llamada a `/api/clients` y
   `/api/vehicles`).
3. Lee `workshops/{workshopId}/members/{uid}` para el rol y el estado
   activo/inactivo, igual que antes.

Si `users/{uid}` no existe (cuenta de Auth huérfana, nunca provisionada),
la app muestra la misma pantalla de "acceso pendiente" que ya existía para
miembros inactivos — no hace falta una pantalla nueva.

## Por qué esto no rompe el aislamiento entre talleres

Las funciones de Vercel (`api/clients/*`, `api/vehicles/*`,
`api/admin/users.js`) ya no leen un `workshopId` fijo de variable de
entorno: lo toman de la petición. Eso es seguro porque **nunca** se usa sin
antes pasar por `requireStaff`/`requireOperator`/`requireAdmin`
(`api/_lib/firebase-admin.js`), que verifica que el uid del token sea
miembro activo de *ese* workshopId exacto. Si alguien intentara mandar el
workshopId de otro taller, esa verificación falla con 403 antes de tocar
cualquier dato — ver también `docs/DATACONNECT.md`.

Las reglas de Firestore (`firestore.rules`) ya estaban escritas de forma
genérica por `{workshopId}` desde el diseño original, así que no necesitaron
cambios estructurales: solo se agregó el bloque para la colección `users`.

## Qué NO incluye esta versión

- Un mismo usuario perteneciendo a varios talleres (por ejemplo, alguien que
  es dueño de dos sucursales independientes con la misma cuenta). Hoy
  tendría que registrarse con dos correos distintos.
- Un directorio o selector de "cambiar de taller" — no aplica mientras lo
  anterior no exista.
- Límites de talleres por dueño, planes de facturación, o cualquier lógica
  de negocio de un SaaS multi-tenant real; esto es solo el aislamiento de
  datos, no un producto de facturación.
