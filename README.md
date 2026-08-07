# TorqueFlow

Aplicación web para gestionar un taller mecánico. Esta versión está organizada por módulos, no incluye clientes, órdenes, servicios, mecánicos, repuestos ni movimientos de demostración y usa un modelo de datos híbrido: **Cloud Firestore** para todo lo operativo/tiempo-real, y **Postgres (Firebase Data Connect)** solo para clientes y vehículos.

## Qué incluye

- React y Vite.
- Firebase Authentication (login con bloqueo por intentos fallidos y recuperación de contraseña).
- Cloud Firestore con lecturas en tiempo real para órdenes, repuestos, mecánicos, servicios y Kardex.
- **Postgres vía Firebase Data Connect** para clientes y vehículos (datos relacionales, con búsqueda y reportes en mente).
- Firebase Storage para fotografías de recepción.
- Transacciones para numeración de órdenes, consumo de repuestos y Kardex.
- Funciones de Vercel con Firebase Admin para: crear usuarios, y leer/escribir clientes y vehículos en Postgres (el navegador nunca habla directo con Data Connect).
- Reglas de Firestore y Storage por rol.
- GitHub Actions para validar, probar y compilar.
- Diseño completamente responsivo.

## Por qué SQL solo para clientes y vehículos

Data Connect no puede evaluar la membresía de un taller (eso vive en `workshops/{id}/members/{uid}` en Firestore), así que el aislamiento entre talleres para estos datos **lo garantiza la capa de API** (`api/clients`, `api/vehicles`), no la base de datos: cada función verifica el token de Firebase y el rol del usuario contra Firestore antes de leer o escribir en Postgres. Por eso todas las operaciones del conector están marcadas `@auth(level: NO_ACCESS)` — nunca se exponen directamente al cliente. El resto del dominio (órdenes, stock, mecánicos) se queda en Firestore porque depende de listeners en tiempo real y transacciones optimistas que encajan mejor con ese modelo.

## Estructura

```text
.
├── api/                        # Funciones serverless privadas de Vercel
│   ├── admin/                  # Gestión de usuarios
│   ├── clients/                # CRUD de clientes (Postgres)
│   ├── vehicles/                # CRUD de vehículos (Postgres)
│   └── _lib/                   # Firebase Admin y wrapper de Data Connect
├── dataconnect/                 # Esquema y conector de Postgres (Data Connect)
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
3. Activa **Authentication > Email/Password**.
4. Crea una base **Cloud Firestore**.
5. Activa **Storage**.
6. Activa **Data Connect** y crea la instancia de Cloud SQL declarada en `dataconnect/dataconnect.yaml` (`serviceId: torqueflow-service`, región `southamerica-east1`). Puedes cambiar región/nombre, pero deben coincidir en `dataconnect.yaml` y en `api/_lib/dataconnect-admin.js`.
7. Despliega el esquema y el conector: `firebase deploy --only dataconnect`.
8. Crea una cuenta de servicio para los scripts y funciones administrativas (necesita permisos sobre Firestore, Auth y Cloud SQL/Data Connect).

## 2. Variables de entorno

Copia `.env.example` a `.env.local` y completa todos los valores:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_WORKSHOP_ID=taller-principal

FIREBASE_SERVICE_ACCOUNT_JSON={...}
FIREBASE_WORKSHOP_ID=taller-principal
OWNER_EMAIL=administrador@correo.com
OWNER_PASSWORD=una-clave-segura
OWNER_NAME=Administrador
```

Las variables con prefijo `VITE_` llegan al navegador. Nunca coloques la cuenta de servicio en una variable `VITE_`.

## 3. Instalar y crear el propietario

```bash
npm install
npm run bootstrap:owner
npm run firebase:rules
npm run dev
```

El script `bootstrap:owner` crea únicamente:

- El documento principal del taller con campos vacíos.
- El primer usuario administrador.
- La membresía del administrador.

No crea clientes, vehículos, órdenes, mecánicos, servicios, categorías ni repuestos.

## 4. Operación inicial

Después de ingresar:

1. Completa los datos del taller en **Configuración > Negocio**.
2. Crea categorías y servicios en **Configuración > Servicios**.
3. Registra mecánicos en **Configuración > Equipo**.
4. Registra clientes y vehículos.
5. Crea repuestos y luego registra la entrada inicial mediante Kardex.
6. Genera la primera orden de trabajo.

## 5. Migrar clientes y vehículos existentes a SQL

Si ya tenías clientes/vehículos guardados en Firestore de una versión anterior, muévelos a Postgres antes de usar el módulo de clientes:

```bash
node scripts/migrate-clients-to-sql.mjs --workshop=taller-principal --dry-run
node scripts/migrate-clients-to-sql.mjs --workshop=taller-principal
```

Es idempotente (marca cada documento migrado), así que puedes correrlo varias veces sin duplicar datos. Después de migrar, `firestore.rules` ya bloquea `clients` y `vehicles` en Firestore por defecto.

## 6. Eliminar datos existentes

El siguiente comando elimina datos operativos, conserva usuarios y membresías, y reinicia la numeración:

```bash
npm run clear:data -- --confirm=taller-principal
```

Para limpiar también la configuración comercial:

```bash
npm run clear:data -- --confirm=taller-principal --reset-settings
```

El script requiere la cuenta de servicio configurada en `.env.local` y una confirmación que coincida exactamente con el ID del taller.

## 7. Validación

```bash
npm run check
npm test
npm run build
```

## 8. Vercel

1. Sube el proyecto a GitHub.
2. Importa el repositorio en Vercel.
3. Agrega las variables `VITE_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT_JSON` y `FIREBASE_WORKSHOP_ID`.
4. Framework: Vite.
5. Build: `npm run build`.
6. Output: `dist`.
7. Confirma que la cuenta de servicio tenga permisos sobre Cloud SQL/Data Connect, o las funciones `api/clients` y `api/vehicles` fallarán en producción aunque el resto de la app funcione.

## 9. GitHub Actions

Configura:

- Secret: `FIREBASE_SERVICE_ACCOUNT_JSON`.
- Variable: `FIREBASE_PROJECT_ID`.

El flujo `CI` ejecuta estructura, pruebas y build. El flujo de reglas publica Firestore y Storage cuando cambian en `main`.

## Modelo de datos

**Postgres (Data Connect)** — `torqueflow-service`:

```text
clients   (id, workshopId, type, documentType, documentNumber, name, phone, email, address, segment, creditLimit, notes, active, createdAt, updatedAt)
vehicles  (id, workshopId, clientId → clients.id, plate, brand, model, year, color, mileage, fuelType, vin, notes, active, createdAt, updatedAt)
```

**Firestore** — todo lo demás:

```text
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
- Realiza copias de seguridad periódicas de Firestore y de la instancia de Cloud SQL (Data Connect no las hace por ti).

## Identidad visual

- `public/torqueflow-mark.svg`: símbolo principal y favicon.
- `public/torqueflow-logo.svg`: logotipo completo con el nombre TorqueFlow.
- La interfaz muestra únicamente la marca **TorqueFlow**, sin subtítulos de tecnología o nombres alternativos.
