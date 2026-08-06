# TorqueFlow

Aplicación web para gestionar un taller mecánico. Esta versión está organizada por módulos, no incluye clientes, órdenes, servicios, mecánicos, repuestos ni movimientos de demostración y utiliza Firebase como fuente única de datos.

## Qué incluye

- React y Vite.
- Firebase Authentication.
- Cloud Firestore con lecturas en tiempo real.
- Firebase Storage para fotografías de recepción.
- Transacciones para numeración de órdenes, consumo de repuestos y Kardex.
- Función de Vercel con Firebase Admin para crear usuarios.
- Reglas de Firestore y Storage por rol.
- GitHub Actions para validar, probar y compilar.
- Diseño completamente responsivo.

## Estructura

```text
.
├── api/                        # Funciones serverless privadas de Vercel
├── public/                     # Archivos públicos
├── scripts/                    # Inicialización, limpieza y validación
├── src/
│   ├── components/             # Componentes visuales reutilizables
│   ├── config/                 # Estados, roles y navegación
│   ├── contexts/               # Autenticación, taller y notificaciones
│   ├── firebase/               # Cliente Firebase y rutas
│   ├── hooks/                  # Hooks reutilizables
│   ├── lib/                    # Cálculos, validadores y formatos
│   ├── modules/                # Dashboard, clientes, órdenes, historial, inventario y configuración
│   ├── services/               # Operaciones de Firestore, Storage y API
│   ├── utils/                  # CSV e identificadores
│   ├── App.jsx
│   ├── InventorySystem.jsx
│   ├── WarehouseModule.jsx
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
6. Crea una cuenta de servicio para los scripts y funciones administrativas.

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

## 5. Eliminar datos existentes

El siguiente comando elimina datos operativos, conserva usuarios y membresías, y reinicia la numeración:

```bash
npm run clear:data -- --confirm=taller-principal
```

Para limpiar también la configuración comercial:

```bash
npm run clear:data -- --confirm=taller-principal --reset-settings
```

El script requiere la cuenta de servicio configurada en `.env.local` y una confirmación que coincida exactamente con el ID del taller.

## 6. Validación

```bash
npm run check
npm test
npm run build
```

## 7. Vercel

1. Sube el proyecto a GitHub.
2. Importa el repositorio en Vercel.
3. Agrega las variables `VITE_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT_JSON` y `FIREBASE_WORKSHOP_ID`.
4. Framework: Vite.
5. Build: `npm run build`.
6. Output: `dist`.

## 8. GitHub Actions

Configura:

- Secret: `FIREBASE_SERVICE_ACCOUNT_JSON`.
- Variable: `FIREBASE_PROJECT_ID`.

El flujo `CI` ejecuta estructura, pruebas y build. El flujo de reglas publica Firestore y Storage cuando cambian en `main`.

## Modelo de datos

```text
workshops/{workshopId}
├── members/{uid}
├── clients/{clientId}
├── vehicles/{vehicleId}
├── mechanics/{mechanicId}
├── serviceCategories/{categoryId}
├── services/{serviceId}
├── orders/{orderId}
├── parts/{partId}
├── stockMovements/{movementId}
└── auditLogs/{logId}
```

Las órdenes guardan líneas de servicios, repuestos, trabajos externos, fotografías y línea de tiempo. El consumo o devolución de repuestos modifica la orden, el stock y el Kardex dentro de una transacción.

## Seguridad

- No subas `.env.local`.
- No guardes `node_modules` ni `dist` en Git.
- Cambia la contraseña inicial.
- Utiliza una cuenta de servicio exclusiva para este proyecto.
- Publica las reglas antes de cargar información real.
- Realiza copias de seguridad periódicas de Firestore.

## Identidad visual

- `public/torqueflow-mark.svg`: símbolo principal y favicon.
- `public/torqueflow-logo.svg`: logotipo completo con el nombre TorqueFlow.
- La interfaz muestra únicamente la marca **TorqueFlow**, sin subtítulos de tecnología o nombres alternativos.
