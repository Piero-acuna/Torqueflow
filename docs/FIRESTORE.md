# Colecciones de Firestore

## clients
Datos de personas o empresas. No contiene vehículos embebidos.

## vehicles
Cada vehículo conserva `clientId` para relacionarlo con su propietario.

## orders
Documento principal de la orden. Incluye:

- Identificación correlativa.
- Cliente y vehículo desnormalizados para lectura rápida.
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
