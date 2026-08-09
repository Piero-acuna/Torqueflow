# TorqueFlow

Aplicación web para gestionar un taller mecánico. Cada cuenta puede crear su propio taller desde la pantalla de login ("Crear un taller nuevo") — son espacios de trabajo completamente independientes entre sí. Esta versión está organizada por módulos, no incluye clientes, órdenes, servicios, mecánicos, repuestos ni movimientos de demostración y usa un modelo de datos híbrido: **Cloud Firestore** para todo lo operativo/tiempo-real, y **Postgres (Supabase)** solo para clientes y vehículos. Ver `docs/MULTI-TENANT.md` para el detalle de cómo funciona el registro y el aislamiento entre talleres, y `docs/SUPABASE.md` para el detalle de por qué Supabase y cómo está protegido.

## Qué incluye

- React y Vite.
- Firebase Authentication (login con bloqueo por intentos fallidos y recuperación de contraseña).
- Cloud Firestore con lecturas en tiempo real para órdenes, repuestos, mecánicos, servicios y Kardex.
- **Postgres vía Supabase** para clientes y vehículos (datos relacionales, con búsqueda y reportes en mente).
- Firebase Storage para fotografías de recepción.
- Transacciones para numeración de órdenes, consumo de repuestos y Kardex.
- Funciones de Vercel con Firebase Admin para: crear usuarios, y leer/escribir clientes y vehículos en Supabase (el navegador nunca habla directo con Supabase).
- Reglas de Firestore y Storage por rol.
- GitHub Actions para validar, probar y compilar.
- Diseño completamente responsivo.

## Por qué SQL solo para clientes y vehículos

Supabase no puede evaluar la membresía de un taller (eso vive en `workshops/{id}/members/{uid}` en Firestore), así que el aislamiento entre talleres para estos datos **lo garantiza la capa de API** (`api/clients`, `api/vehicles`), no la base de datos: cada función verifica el token de Firebase y el rol del usuario contra Firestore antes de leer o escribir en Supabase. Las tablas de Supabase tienen Row Level Security habilitado y sin políticas — nunca se exponen directamente al cliente, ni con la clave pública ni con un usuario autenticado. El resto del dominio (órdenes, stock, mecánicos) se queda en Firestore porque depende de listeners en tiempo real y transacciones optimistas que encajan mejor con ese modelo. Detalle completo en `docs/SUPABASE.md`.

## Estructura

```text
.
├── api/                        # Funciones serverless privadas de Vercel
│   ├── admin/                  # Gestión de usuarios
│   ├── auth/                   # Registro público (crea taller + admin)
│   ├── clients/                # CRUD de clientes (Postgres/Supabase)
│   ├── vehicles/                # CRUD de vehículos (Postgres/Supabase)
│   └── _lib/                   # Firebase Admin y cliente admin de Supabase
├── supabase/
│   └── migrations/             # SQL de las tablas clients y vehicles
├── public/                     # Archivos públicos
├── scripts/                    # Inicialización, limpieza, validación y migración
├── src/
│   ├── components/             # Componentes visuales reutilizables
│   ├── config/                 # Estados, roles y navegación
│   ├── contexts/               # Autenticación, taller y notificaciones
│   ├── firebase/               # Cliente Firebase y rutas
│   ├── hooks/                  # Hooks reutilizables
│   ├── lib/                    # Cálculos, validadores, formatos y cliente de API
│   ├── modules/                # Dashboard, clientes, órdenes, historial, inventario y configuración
│   ├── services/               # Operaciones de Firestore, Storage y API (clientes/vehículos vía /api)
│   ├── utils/                  # CSV e identificadores
│   ├── App.jsx
│   ├── InventorySystem.jsx
│   └── main.jsx
├── firestore.rules
├── storage.rules
├── firestore.indexes.json
├── firebase.json
├── vercel.json
└── package.json
```

`node_modules/` y `dist/` se generan con `npm install` y `npm run build`; no deben guardarse en GitHub.

## 1. Crear el proyecto Firebase

En Firebase Console:

1. Crea un proyecto.
2. Registra una aplicación web.
3. Activa **Authentication > Email/Password** (Authentication → Comenzar → habilita el proveedor de correo/contraseña; no viene activado por defecto).
4. Crea la base de datos en **Firestore Database** (botón "Crear base de datos" — necesita el plan **Blaze** de facturación activado en el proyecto de Google Cloud, aunque te quedes dentro de la cuota gratis).
5. Activa **Storage** (Storage → Comenzar). Es opcional: solo lo usa la foto de recepción de una orden; si no lo activas, todo lo demás funciona igual.
6. Crea una cuenta de servicio para los scripts y funciones administrativas: Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada. Descarga el `.json` y pega su contenido completo en `FIREBASE_SERVICE_ACCOUNT_JSON`.

## 2. Crear el proyecto en Supabase

1. Crea una cuenta y un proyecto en [supabase.com](https://supabase.com) (tier gratis, sin tarjeta).
2. Ve a **SQL Editor** → New query, pega el contenido completo de `supabase/migrations/0001_clients_vehicles.sql` y ejecútalo.
3. En **Settings → API**, copia `Project URL` (→ `SUPABASE_URL`) y la clave `service_role` (→ `SUPABASE_SERVICE_ROLE_KEY`, es secreta). Detalle de por qué y cómo está protegido en `docs/SUPABASE.md`.

## 3. Variables de entorno

Copia `.env.example` a `.env.local` y completa todos los valores:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

FIREBASE_SERVICE_ACCOUNT_JSON={...}
```

Las variables con prefijo `VITE_` llegan al navegador. Nunca coloques la cuenta de servicio en una variable `VITE_`.

> `FIREBASE_WORKSHOP_ID` / `VITE_FIREBASE_WORKSHOP_ID` ya **no** son obligatorias: existían cuando había un único taller fijo por despliegue. Ahora cada cuenta crea su propio taller desde el login (ver sección 4). Solo hacen falta si vas a usar `bootstrap:owner` o `clear:data` para el flujo antiguo de un solo taller (por ejemplo, para tener un taller de pruebas fijo en desarrollo).

## 4. Instalar y crear la primera cuenta

```bash
npm install
npm run firebase:rules
npm run dev
```

Con esto ya puedes entrar a la app y usar **"Crear un taller nuevo"** en la pantalla de login: pide nombre del taller, tu nombre, correo y contraseña, y te deja como administrador de un taller vacío (sin clientes, órdenes, mecánicos, servicios ni repuestos de demostración).

### Alternativa: `bootstrap:owner` (flujo de un solo taller fijo)

Si prefieres seguir usando un `workshopId` fijo por variable de entorno (por ejemplo, para un entorno de desarrollo reproducible) en vez de registrarte desde la UI:

```bash
OWNER_EMAIL=administrador@correo.com OWNER_PASSWORD=una-clave-segura OWNER_NAME=Administrador FIREBASE_WORKSHOP_ID=taller-principal npm run bootstrap:owner
```

El script `bootstrap:owner` crea únicamente el documento del taller, el primer usuario administrador y su membresía — nada de datos operativos.

## 5. Operación inicial

Después de ingresar:

1. Completa los datos del taller en **Configuración > Negocio**.
2. Crea categorías y servicios en **Configuración > Servicios**.
3. Registra mecánicos en **Configuración > Equipo**.
4. Registra clientes y vehículos.
5. Crea repuestos y luego registra la entrada inicial mediante Kardex.
6. Genera la primera orden de trabajo.

## 6. Migrar clientes y vehículos existentes a SQL

Si ya tenías clientes/vehículos guardados en Firestore de una versión anterior, muévelos a Postgres antes de usar el módulo de clientes:

```bash
node scripts/migrate-clients-to-sql.mjs --workshop=taller-principal --dry-run
node scripts/migrate-clients-to-sql.mjs --workshop=taller-principal
```

Es idempotente (marca cada documento migrado), así que puedes correrlo varias veces sin duplicar datos. Después de migrar, `firestore.rules` ya bloquea `clients` y `vehicles` en Firestore por defecto.

## 7. Eliminar datos existentes

El siguiente comando elimina datos operativos de un taller puntual, conserva usuarios y membresías, y reinicia la numeración:

```bash
npm run clear:data -- --workshop=<workshopId> --confirm=<workshopId>
```

Para limpiar también la configuración comercial, o incluir clientes/vehículos en Postgres:

```bash
npm run clear:data -- --workshop=<workshopId> --confirm=<workshopId> --reset-settings --include-sql
```

El script requiere la cuenta de servicio configurada en `.env.local` y una confirmación que coincida exactamente con el ID del taller. Encuentra el `workshopId` de un taller en Firebase Console (Firestore → colección `workshops`) o en el documento `users/{uid}` del dueño.

## 8. Validación

```bash
npm run check
npm test
npm run build
```

## 9. Vercel

1. Sube el proyecto a GitHub.
2. Importa el repositorio en Vercel.
3. Agrega las variables `VITE_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (`FIREBASE_WORKSHOP_ID` ya no es obligatoria, ver sección 3).
4. Framework: Vite.
5. Build: `npm run build`.
6. Output: `dist`.
7. Confirma que ya corriste la migración SQL en Supabase (sección 2) antes del primer deploy, o las funciones `api/clients` y `api/vehicles` fallarán en producción aunque el resto de la app funcione.

## 10. GitHub Actions

Configura:

- Secret: `FIREBASE_SERVICE_ACCOUNT_JSON`.
- Variable: `FIREBASE_PROJECT_ID`.

El flujo `CI` ejecuta estructura, pruebas y build. El flujo de reglas publica Firestore y Storage cuando cambian en `main`.

## Modelo de datos

**Postgres (Supabase)**:

```text
clients   (id, workshop_id, type, document_type, document_number, name, phone, email, address, segment, credit_limit, notes, active, created_at, updated_at)
vehicles  (id, workshop_id, client_id → clients.id, plate, brand, model, year, color, mileage, fuel_type, vin, notes, active, created_at, updated_at)
```

**Firestore** — todo lo demás:

```text
users/{uid}                    # apunta al workshopId de cada cuenta (ver docs/MULTI-TENANT.md)
workshops/{workshopId}
├── members/{uid}
├── mechanics/{mechanicId}
├── serviceCategories/{categoryId}
├── services/{serviceId}
├── orders/{orderId}          # clientId y vehicleId referencian filas de Postgres por UUID
├── parts/{partId}
├── stockMovements/{movementId}
└── auditLogs/{logId}
```

Las órdenes guardan líneas de servicios, repuestos, trabajos externos, fotografías y línea de tiempo. El consumo o devolución de repuestos modifica la orden, el stock y el Kardex dentro de una transacción. `order.clientId` y `order.vehicleId` son referencias "débiles" (por valor, no por join) a las tablas SQL: si se borra un cliente en Postgres, las órdenes históricas no se actualizan automáticamente.

## Seguridad

- No subas `.env.local`.
- No guardes `node_modules` ni `dist` en Git.
- Cambia la contraseña inicial.
- Utiliza una cuenta de servicio exclusiva para este proyecto.
- Publica las reglas antes de cargar información real.
- Realiza copias de seguridad periódicas de Firestore y de Supabase (el free tier no incluye backups automáticos con point-in-time recovery — ver `docs/SUPABASE.md`).

## Identidad visual

- `public/torqueflow-mark.svg`: símbolo principal y favicon.
- `public/torqueflow-logo.svg`: logotipo completo con el nombre TorqueFlow.
- La interfaz muestra únicamente la marca **TorqueFlow**, sin subtítulos de tecnología o nombres alternativos.
