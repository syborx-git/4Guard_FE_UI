# ADR-021: Gestión de Reingresos, Logística Inversa y Trazabilidad Multiciclo (Árbol de la Vida)

- **Estado:** Aceptado / En Implementación
- **Fecha:** 2026-10-07
- **Autores:** Equipo de Arquitectura e Ingeniería 4GUARD WMS (Frontend, Backend, Seguridad Patrimonial & Mesa de Control)
- **Módulos Afectados:**
  - `apps/admin-console/src/app/features/security/security-gate`
  - `apps/admin-console/src/app/features/warehouse-movements/pages/receiving-submodule`
  - `apps/admin-console/src/app/features/warehouse-movements/pages/outbound-submodule`
  - `4guard_be/src/main/java/com/fourguard/wms/application/usecase/WarehouseReceptionService.java`
  - `4guard_be/src/main/java/com/fourguard/wms/application/usecase/SecurityGateService.java`
  - Tablas: `wms.warehouse_receptions`, `wms.inventory_items`, `wms.inventory_movements`, `wms.inventory_audit_logs`, `wms.security_pre_checkins`
- **ADRs Relacionados:**
  - [ADR-016 (Despacho Multi-Producto y Ciclo de Vida)](./ADR-016-outbound-multiproduct-pallet-traceability-and-lifecycle.md)
  - [ADR-017 (Caseta Bimodal y Auto-Registro QR Chofer)](./ADR-017-bimodal-security-gate-qr-driver-self-registration.md)
  - [ADR-018 (Check-Out Caseta y Checklist F01)](./ADR-018-security-gate-checkout-and-f01-transport-checklist-homologation.md)
  - [ADR-020 (Flujo Integral Recepción de Almacén y Descarga)](./ADR-020-flujo-integral-recepcion-almacen-caseta-y-descarga.md)

---

## 1. Contexto y Problema Operativo

En las operaciones logísticas y de almacenamiento de 4GUARD WMS:

1. **Incidencias en Ruta y Rechazos de Clientes (Logística Inversa):**
   - Frecuentemente, unidades que salieron formalmente de almacén mediante órdenes de despacho (`SAL-YYYY-XXXXXX`) regresan a las instalaciones debido a:
     * Rechazo total o parcial del cliente receptor en destino (discrepancias en factura, caducidad, empaque, etc.).
     * Retornos forzados a medio camino (unidad descompuesta, cierre de almacén destino o reprogramación de cita).
2. **Conflicto de Unicidad y Riesgo de Destrucción de Historia:**
   - La regla estricta del WMS establece que cada tarima (UA / SSCC) es única mientras esté activa en inventario.
   - Cuando una tarima salió (`DISPATCHED`), su código se liberó del inventario activo. Sin embargo, al reingresar, no debe tratarse como un simple borrado o "rollback" de la salida previa, sino como un **Reingreso Formal (F01-R)**.
3. **Auditoría Integral y Cadena de Custodia (Árbol de la Vida):**
   - Auditores internos y autoridades regulatorias requieren poder consultar el historial completo de una UA física y observar:
     `Entrada Proveedor (F01) ➔ Almacenaje ➔ Salida (F03) ➔ Retorno Caseta ➔ Reingreso F01-R ➔ Re-ubicación`.

---

## 2. Decisión de Arquitectura

### 2.1 Clasificación de Operación en Caseta y Recepción
Se incorpora el tipo de operación `operationType`:
- `ENTRY` (Recepción normal de proveedor).
- `REENTRY` (Reingreso / Devolución de mercancía despachada previamente).

Si la operación es `REENTRY`, se puede asociar opcionalmente el folio de salida de origen (`sourceOutboundId` / `sourceOutboundFolio`) y el motivo de retorno (`reentryReason`).

### 2.2 Reingreso Limpio de UAs y Transición de Estados
- Cuando una tarima que se encuentra en estado `DISPATCHED` o `RETURNED` es escaneada en una sesión de reingreso:
  * El sistema permite su incorporación sin arrojar error de duplicado.
  * Al completar la recepción de reingreso (`POST /receptions/{id}/complete`), el ítem en `wms.inventory_items` transiciona de `DISPATCHED` a `AVAILABLE` (o `IN_QUALITY`), asignando la nueva bahía de almacenaje.
  * Se registra un movimiento `MovementType.REENTRY` en `wms.inventory_movements` con referencia cruzada al folio de recepción y al folio de salida previo.

### 2.3 Línea de Trazabilidad Unificada (Tree of Life)
La tabla `wms.inventory_audit_logs` registra eventos específicos de reingreso:
- `REENTRY_SCANNED`: Tarima escaneada en andén durante proceso de reingreso.
- `REENTRY_COMPLETED`: Tarima reingresada a inventario activo con nueva ubicación.

---

## 3. Consecuencias y Beneficios

### Positivas
- **Cero Pérdida de Trazabilidad:** El Kardex y los logs de auditoría preservan todas las entradas, salidas y reingresos históricos de cada UA.
- **Flexibilidad Operativa:** El personal de caseta y almacén puede procesar devoluciones y rechazos con la misma fluidez que una recepción estándar.
- **Cumplimiento Regulatorio y de Calidad:** Visibilidad completa para inspecciones de calidad y auditorías de inventario 3PL.
