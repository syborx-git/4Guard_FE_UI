# SDD — Cambio de Almacén (Reubicación de Inventario)

**Proyecto:** 4GUARD WMS  
**Módulo:** Movimientos de Almacén → Cambio de Almacén  
**Tipo:** Operación transaccional de inventario  
**Estado:** Aprobado / En Implementación  
**Versión:** 1.0  
**Patrón:** Spec-Driven Development (SDD)  

---

## 1. Objetivo

Implementar el módulo **Cambio de Almacén** para permitir al personal autorizado reubicar una o más unidades de inventario (tarimas / UAs) desde una bahía de origen hacia una bahía destino disponible, manteniendo la integridad del inventario, trazabilidad completa de la operación, segregación por cliente y registro de auditoría.

La operación genera un **folio único de Cambio de Almacén (ej. `CAM-2026-000001`)** y un comprobante imprimible con el detalle de la operación realizada.

La operación representa un movimiento real de inventario mediante la actualización transaccional de la ubicación del inventario y la generación del registro correspondiente en `inventory_movements` y `audit_logs`.

---

## 2. Alcance funcional

El módulo está compuesto por dos funcionalidades principales:

### 2.1 Alta de Cambio de Almacén (Flujo de 5 Pasos)
Permite ejecutar una operación de reubicación: **Bahía origen → Bahía destino**, incluyendo:
1. **Paso 1:** Selección obligatoria de montacarguista certificado con turno activo.
2. **Paso 2:** Selección de bahía origen con inventario, inspección de metadatos (Zona, Pasillo, Rack, Nivel, Capacidad, Ocupación) y selección de tarimas completas a trasladar.
3. **Paso 3:** Selección de bahía destino con validación estricta de disponibilidad y capacidad libre (regla en ceros / espacios suficientes).
4. **Paso 4:** Captura de motivo de reubicación y observaciones operativas.
5. **Paso 5:** Resumen de confirmación, ejecución atómica, asignación de folio único y generación de formato imprimible.

### 2.2 Consulta Histórica de Cambios de Almacén
Permite consultar operaciones previamente realizadas mediante diferentes criterios de búsqueda (Folio, Cliente, SKU, Bahía Origen, Bahía Destino, Montacarguista, Rango de Fechas, Motivo, Estado) y acceder al detalle y reimpresión de comprobante en modo solo lectura.

---

## 3. Modelo de Datos

### Entidad Principal: `WarehouseTransfer`
* `id`: string (UUID)
* `folio`: string (Formato humano `CAM-YYYY-XXXXXX`)
* `organizationId`: string
* `branchId`: string
* `userId`: string (Usuario que autoriza/registra)
* `forkliftOperatorId`: string
* `forkliftOperatorName`: string
* `originLocationId`: string
* `destinationLocationId`: string
* `originLocation`: LocationDetail
* `destinationLocation`: LocationDetail
* `reasonId`: string
* `reasonLabel`: string
* `observations`: string
* `items`: WarehouseTransferItem[]
* `totalPallets`: number
* `totalPieces`: number
* `distinctSkus`: number
* `status`: `'DRAFT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'`
* `createdAt`: string
* `completedAt`: string

### Entidad de Detalle: `WarehouseTransferItem`
* `id`: string
* `transferId`: string
* `inventoryItemId`: string
* `palletCode`: string (UA / SSCC)
* `productId`: string (SKU)
* `description`: string
* `clientName`: string
* `lotNumber`: string
* `expirationDate`: string
* `pieces`: number
* `palletTypeId`: string
* `palletTypeLabel`: string

---

## 4. Reglas de Negocio (RN)

* **RN-001 — Montacarguista Obligatorio:** Toda operación requiere un montacarguista activo asignado.
* **RN-002 — Bahía Origen con Stock:** La bahía origen debe contener existencias y al menos 1 tarima debe ser seleccionada.
* **RN-003 — Validación Destino:** La bahía destino debe existir, pertenecer a la misma sucursal, no estar bloqueada y contar con capacidad suficiente.
* **RN-004 — Movimiento por Unidad Completa (UA):** El traslado se realiza por tarimas/UAs completas para preservar la integridad del lote y empaque.
* **RN-005 — Atomicidad Transaccional:** La salida de la bahía origen, la entrada en la bahía destino, la creación del registro documental y la auditoría se ejecutan en un único paso atómico.
* **RN-006 — Inmutabilidad del Histórico:** Las operaciones completadas no pueden ser editadas ni modificadas.
* **RN-007 — Folio Humano:** Toda operación completada genera un folio correlativo único `CAM-2026-XXXXXX`.

---

## 5. Comprobante Oficial Imprimible

El comprobante incluye:
1. Encabezado con logotipo 4GUARD, nombre de almacén y Folio `CAM-2026-XXXXXX`.
2. Ficha de responsables: Usuario registrador y Montacarguista asignado.
3. Desglose de reubicación: Bahía Origen (Zona/Pasillo/Nivel) ➔ Bahía Destino (Zona/Pasillo/Nivel).
4. Motivo y observaciones del movimiento.
5. Tabla completa de tarimas (Código UA, SKU, Descripción, Lote, Caducidad, Cantidad de Piezas).
6. Totalizadores (Total Tarimas, Piezas y SKUs distintos).
7. Secciones de firmas operativas (Montacarguista, Operador WMS y Supervisor).
