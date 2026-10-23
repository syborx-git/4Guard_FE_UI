# ADR-021: Gestión de Reingresos, Logística Inversa y Trazabilidad Multiciclo (Árbol de la Vida)

- **Versión:** 2.0.0 (Auto-Detección Inteligente & Verificación Física en Andén)
- **Estado:** Aceptado / Implementado
- **Fecha:** 2026-10-08
- **Autores:** Equipo de Arquitectura e Ingeniería 4GUARD WMS (Frontend, Backend, Seguridad Patrimonial & Mesa de Control)
- **Módulos Afectados:**
  - `apps/admin-console/src/app/features/security/security-gate`
  - `apps/admin-console/src/app/features/warehouse-movements/pages/receiving-submodule`
  - `apps/admin-console/src/app/features/warehouse-movements/pages/outbound-submodule`
  - `4guard_be/src/main/java/com/fourguard/wms/presentation/controller/WarehouseReceptionController.java`
  - `4guard_be/src/main/java/com/fourguard/wms/application/usecase/WarehouseReceptionService.java`
  - `4guard_be/src/main/java/com/fourguard/wms/infrastructure/persistence/repository/WarehouseOutboundJpaRepository.java`
  - Tablas: `wms.warehouse_receptions`, `wms.warehouse_outbounds`, `wms.warehouse_outbound_items`, `wms.inventory_items`, `wms.inventory_movements`, `wms.inventory_audit_logs`, `wms.security_pre_checkins`
- **ADRs Relacionados:**
  - [ADR-007 (Cero Mocks y Persistencia Real)](./ADR-007-zero-mock-data-architecture.md)
  - [ADR-016 (Despacho Multi-Producto y Ciclo de Vida)](./ADR-016-outbound-multiproduct-pallet-traceability-and-lifecycle.md)
  - [ADR-017 (Caseta Bimodal y Auto-Registro QR Chofer)](./ADR-017-bimodal-security-gate-qr-driver-self-registration.md)
  - [ADR-018 (Check-Out Caseta y Checklist F01)](./ADR-018-security-gate-checkout-and-f01-transport-checklist-homologation.md)
  - [ADR-020 (Flujo Integral Recepción de Almacén y Descarga)](./ADR-020-flujo-integral-recepcion-almacen-caseta-y-descarga.md)

---

## 1. Contexto y Problema Operativo

En las operaciones logísticas y de almacenamiento de 4GUARD WMS:

1. **Incidencias en Ruta y Rechazos de Clientes (Logística Inversa):**
   - Unidades que salieron formalmente de almacén mediante órdenes de despacho (`SAL-YYYY-XXXXXX`) regresan a las instalaciones debido a rechazos totales o parciales, siniestros menores o cancelaciones en ruta.
2. **Auto-Detección Cero Flags Manuales:**
   - La captura manual de caseta y mesa de recepción es propensa a errores si el operador debe marcar manualmente un checkbox de "Devolución". El sistema debe auto-detectar de inmediato si una remisión o folio de salida corresponde a un despacho previo histórico.
3. **Verificación Física Obligatoria en Andén:**
   - Aunque los datos se precarguen desde el manifiesto de salida previo, el montacarguista debe escanear físicamente cada tarima (UA) en el andén para verificar su presencia y calidad, detectando discrepancias o tarimas faltantes.
4. **Máquina de 8 Estados e Inmutabilidad de Trazabilidad:**
   - Cada tarima debe transicionar de `DISPATCHED` (50) ➔ `RETURNED` (80) ➔ `RECEIVED` (10) ➔ `IN_QUALITY` (20, cuarentena) ➔ Decisión de Calidad (`AVAILABLE` 30 o `DAMAGED` 60).
   - Los auditores deben poder consultar el "Árbol de la Vida" de cualquier remisión o UA física para observar su ciclo completo.

---

## 2. Decisión de Arquitectura

### 2.1 Auto-Detección Inteligente de Retornos (`GET /warehouse-receptions/detect-return`)
- Al ingresar el número de remisión o documento en Caseta o Mesa de Recepción, se realiza una búsqueda indexada en `wms.warehouse_outbounds` y `wms.warehouse_outbound_items`.
- Si existe coincidencia:
  * Retorna el manifiesto original con cliente, transportista, operador, placas y la lista de tarimas esperadas (`expectedPallets`).
  * Despliega un banner de precarga rápida en el frontend sin forzar flags manuales.

### 2.2 Verificación Física de UA en Andén (`POST /warehouse-receptions/{id}/verify-pallet`)
- Durante la descarga física (Fase 3: `IN_PROGRESS`), el montacarguista pistolea cada código UA.
- El backend valida si el código pertenece al manifiesto de salida (`sourceOutboundId`):
  * **Coincidencia Confirmada:** Registra la tarima, enlaza el lote en `wms.warehouse_reception_lots` y añade el evento `REENTRY_PALLET_VERIFIED` a `wms.inventory_audit_logs`.
  * **Discrepancia:** Emite respuesta `DISCREPANCY` con mensaje de alerta bloqueante si la tarima escaneada no formaba parte del despacho original.

### 2.3 Árbol de la Vida de Remisión (`GET /warehouse-receptions/remissions/{folio}/tree`)
- Consulta y concatena cronológicamente todos los eventos de auditoría (`wms.inventory_audit_logs`) asociados al folio de remisión y sus UAs.
- Permite visualizar en un modal interactivo el ciclo de vida completo: Despacho ➔ Retorno ➔ Recepción ➔ Re-etiquetado ➔ Inspección de Calidad.

### 2.4 Cero Datos en Memoria / Cero Buffers (ADR-007)
- Toda la lógica opera estrictamente sobre tablas de PostgreSQL y servicios Spring Boot con transaccionalidad `@Transactional`.

---

## 3. Consecuencias y Beneficios

### Positivas
- **Cero Entrada Duplicada:** Datos de transporte y cliente se heredan automáticamente del despacho original.
- **Prevención de Fraude y Faltantes:** Validación física en andén evita ingresos no autorizados de mercancía ajena al manifiesto.
- **Transparencia Regulatoria:** Trazabilidad inmutable punta a punta accesible en 1 clic.
