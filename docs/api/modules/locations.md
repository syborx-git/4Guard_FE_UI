# API Contract — Módulo: Ubicaciones Físicas

**Controller:** `LocationController.java`  
**Base path:** `/api/v1/locations`  
**RBAC Module (FE):** `layout`  
**Permission base:** `LOCATIONS_CREATE/READ/UPDATE/DELETE` o role `OPERATIONS_MANAGER`

---

## Endpoints

| Método | Ruta | Permission | Descripción |
|---|---|---|---|
| `GET` | `/locations` | `LOCATIONS_READ` | Lista todas (filtra por `?branchId=&availableOnly=bool`) |
| `GET` | `/locations/{id}` | `LOCATIONS_READ` | Detalle por UUID |
| `GET` | `/locations/{id}/audit` | `LOCATIONS_READ` | Historial cronológico |
| `POST` | `/locations` | `LOCATIONS_CREATE` | Crear ubicación (estado inicial: ACTIVE) |
| `PUT` | `/locations` | `LOCATIONS_UPDATE` | Actualizar datos (id en body, NO usa PATCH de status) |
| `PATCH` | `/locations/{id}/status` | `LOCATIONS_UPDATE` | Cambio de estado FSM |
| `DELETE` | `/locations/{id}` | `LOCATIONS_DELETE` | Eliminar físicamente |

---

## Request DTOs → TypeScript

### `CreateLocationRequest`

```typescript
interface CreateLocationRequest {
  code: string;            // código único de ubicación (ej: "A-01-01-01")
  branchId: string;        // UUID de la sucursal
  sectionId?: string;      // UUID de la sección (opcional)
  zone?: string;           // "ZONA A", "REFRIGERACIÓN"
  aisle?: string;          // pasillo
  bay?: string;
  level?: string;          // nivel / altura
  locationType?: string;
  maxCapacity?: number;
  currentOccupancy?: number;
  description?: string;
}
```

### `UpdateLocationRequest`

```typescript
interface UpdateLocationRequest {
  id: string;              // UUID en BODY, NO en path
  code?: string;
  branchId?: string;
  sectionId?: string;
  zone?: string;
  aisle?: string;
  bay?: string;
  level?: string;
  locationType?: string;
  maxCapacity?: number;
  description?: string;
  // ⚠️ NO incluir status — usar PATCH /{id}/status para eso
}
```

### `UpdateLocationStatusRequest`

```typescript
interface UpdateLocationStatusRequest {
  status: LocationStatus;
  reason?: string;   // REQUERIDO para BLOCKED y MAINTENANCE
  observations?: string;
}
```

---

## Response DTOs

### `LocationResponse`

```typescript
interface LocationResponse {
  id: string;
  code: string;
  branchId: string;
  branchName: string;
  sectionId: string | null;
  sectionName: string | null;
  zone: string | null;
  aisle: string | null;
  bay: string | null;
  level: string | null;
  locationType: string | null;
  maxCapacity: number;
  currentOccupancy: number;
  status: LocationStatus;
  description: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}
```

---

## Enums

### `LocationStatus`

```typescript
enum LocationStatus {
  ACTIVE      = 'ACTIVE',      // disponible para uso
  BLOCKED     = 'BLOCKED',     // bloqueada (reason requerido)
  MAINTENANCE = 'MAINTENANCE', // en mantenimiento (reason requerido)
  INACTIVE    = 'INACTIVE'     // inactiva (solo si currentOccupancy = 0)
}
```

---

## FSM — Transiciones Permitidas

```
ACTIVE      → BLOCKED | MAINTENANCE | INACTIVE
BLOCKED     → ACTIVE
MAINTENANCE → ACTIVE
INACTIVE    → ACTIVE
```

**Validaciones del BE:**
- `BLOCKED` y `MAINTENANCE` requieren `reason` en el body.
- `INACTIVE` solo se permite si `currentOccupancy === 0`.
- Transición inválida → 422 Unprocessable Entity.
- Ubicación con inventario para INACTIVE → 409 Conflict.

---

## ⚠️ Quirks Importantes

1. **`GET /locations`** tiene dos params opcionales: `branchId` y `availableOnly=true/false`.
2. **`availableOnly=true`** retorna solo ubicaciones con `status=ACTIVE` y espacio disponible.
3. **`PUT /locations`** para datos generales. **`PATCH /locations/{id}/status`** exclusivamente para FSM.
4. **`PUT /locations`** puede retornar `409 Conflict` si el código ya está asignado a otra ubicación.
5. El `id` va en body del PUT, no en la URL.

---

## KPI Cards sugeridas

| KPI | Filtro | Ícono | Color |
|---|---|---|---|
| Total | todos | `warehouse` | Navy |
| Activas | `status=ACTIVE` | `check_circle` | Success |
| Bloqueadas | `status=BLOCKED` | `block` | Danger |
| Mantenimiento | `status=MAINTENANCE` | `construction` | Warning |
