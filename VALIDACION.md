# Validación de la entrega

Fecha: 2026-08-05

## Comprobaciones ejecutadas

- 60 archivos JavaScript/JSX analizados con el parser de TypeScript.
- 0 errores de sintaxis JSX.
- 0 importaciones relativas rotas.
- 49 archivos fuente revisados por el script estructural.
- 0 coincidencias de los datos de demostración usados en versiones anteriores.
- 5 pruebas unitarias aprobadas.
- Archivos JavaScript sin JSX comprobados con `node --check`.
- Reglas separadas para Firestore y Storage.
- Operaciones de orden y stock implementadas mediante transacciones.

## Resultado de pruebas

```text
5 pruebas aprobadas
0 pruebas fallidas
```

## Comprobación que debe ejecutarse en el equipo del usuario

El build completo requiere instalar dependencias desde npm:

```bash
npm install
npm run build
```

El entorno de generación no pudo descargar npm desde su registro interno, por lo que no se generaron `node_modules`, `package-lock.json` ni `dist`. Estos elementos deben generarse en el equipo de desarrollo y no deben subirse al repositorio, salvo que el equipo tenga una política distinta para `package-lock.json`.

## Datos existentes en Firebase

El código entregado no carga registros de demostración. Los datos que ya existan en el proyecto Firebase del usuario no pueden eliminarse sin sus credenciales. Se incluyó el comando seguro:

```bash
npm run clear:data -- --confirm=ID_DEL_TALLER --reset-settings
```

## Identidad visual

- Se agregó el símbolo industrial de TorqueFlow en SVG.
- El logo se muestra en el menú lateral, acceso, carga y pantalla de configuración pendiente.
- El favicon utiliza el mismo símbolo.
- La interfaz visible conserva únicamente el nombre **TorqueFlow**, sin subtítulos de tecnología ni nombres alternativos.
