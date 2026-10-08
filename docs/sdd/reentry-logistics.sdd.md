# SDD: Gestión de Reingresos, Logística Inversa y Trazabilidad Multiciclo

- **Versión:** 1.0.0
- **Fecha:** 2026-10-07
- **ADR de Referencia:** [ADR-021](../adr/ADR-021-gestion-reingresos-logistica-inversa-trazabilidad.md)
- **Framework:** SDOP (Spec-Driven Oracle-Bridge)

---

## 1. Alcance y Objetivos

Definir los contratos de datos, reglas de negocio y ciclo de vida para el manejo integral de **Reingresos y Devoluciones** en 4GUARD WMS, garantizando la preservación inmutable del histórico de movimientos de cada tarima (UA).

---

## 2. Contratos de Datos y Endpoints

### 2.1 Enums y Tipos

```typescript
export type ReceptionOperationType = 'ENTRY' | 'REENTRY';

export type ReentryReason =
  | 'RECHAZO_CLIENTE_DESTINO'
  | 'NO_ENTREGA_RUTA'
  | 'DEVOLUCION_CALIDAD'
  | 'CANCELACION_DESPACHO'
  | 'OTRO';
```

### 2.2 Extensiones en Request/Response DTOs

#### CreateSecurityPassRequest (Extensión)
```json
{
  "operationType": "REENTRY",
  "sourceOutboundId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "sourceOutboundFolio": "SAL-2026-000045",
  "reentryReason": "RECHAZO_CLIENTE_DESTINO",
  "reentryNotes": "Cliente rechazó 5 tarimas por horario de recepción vencido"
}
```

#### ReceptionResponse (Extensión)
```json
{
  "id": "UUID",
  "folio": "REC-2026-000180",
  "operationType": "REENTRY",
  "sourceOutboundId": "UUID",
  "sourceOutboundFolio": "SAL-2026-000045",
  "reentryReason": "RECHAZO_CLIENTE_DESTINO",
  "reentryNotes": "...",
  "status": "REGISTERED",
  "pallets": []
}
```

---

## 3. Matriz de Estados y Reglas de Negocio

1. **Escaneo de UAs en Reingreso:**
   - Si la UA existe en estado `DISPATCHED` o `RETURNED`, se permite agregar a la recepción de reingreso.
   - Si la UA ya está activa (`AVAILABLE`, `IN_QUALITY`, etc.) en el almacén y no ha salido, se rechaza la duplicidad.
2. **Cierre de Recepción de Reingreso:**
   - Transiciona `wms.inventory_items.state` a `AVAILABLE`.
   - Inserta `wms.inventory_movements` con `type = 'REENTRY'`.
   - Registra en `wms.inventory_audit_logs` el evento `REENTRY_COMPLETED` vinculando el folio de salida anterior y el folio de reingreso nuevo.
3. **Árbol de la Vida (Tree of Life):**
   - El historial de la UA consolida en orden cronológico todos los eventos de su ciclo de vida.
