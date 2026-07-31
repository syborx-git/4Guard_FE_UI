# API Contract — Módulo: Transportistas

**Controller:** `CarrierController.java`  
**Base path:** `/api/v1/carriers`  
**RBAC Module (FE):** `carriers`  
**Permission base:** `CARRIERS_CREATE/READ/UPDATE/DELETE` o role `OPERATIONS_MANAGER`

---

## Endpoints

| Método | Ruta | Permission | Descripción |
|---|---|---|---|
| `GET` | `/carriers` | `CARRIERS_READ` | Lista todos (filtra por `?organizationId=`) |
| `GET` | `/carriers/{id}` | `CARRIERS_READ` | Detalle por UUID |
| `GET` | `/carriers/{id}/audit` | `CARRIERS_READ` | Historial de cambios |
| `GET` | `/carriers/validate-rfc?taxId=&organizationId=&excludeId=` | `CARRIERS_READ` | Valida RFC único |
| `POST` | `/carriers` | `CARRIERS_CREATE` | Crear transportista |
| `PUT` | `/carriers` | `CARRIERS_UPDATE` | Actualizar (id en body) |
| `PATCH` | `/carriers/{id}/status` | `CARRIERS_UPDATE` | Cambio de estado FSM |
| `DELETE` | `/carriers/{id}` | `CARRIERS_DELETE` | Eliminar físicamente |

---

## Request DTOs → TypeScript

### `CreateCarrierRequest`

```typescript
// (inferido del controlador — verificar DTO en BE si se agregan campos)
interface CreateCarrierRequest {
  name: string;
  taxId: string;           // RFC — debe ser único por organización
  carrierType: CarrierType;
  organizationId: string;  // UUID
  // + campos de capacidad de vehículos y clientes preferenciales
}
```

### `UpdateCarrierRequest`

```typescript
interface UpdateCarrierRequest {
  id: string;              // UUID en BODY, no en path
  // mismos campos opcionales que CreateCarrierRequest
}
```

### `UpdateCarrierStatusRequest`

```typescript
interface UpdateCarrierStatusRequest {
  status: CarrierStatus;   // nuevo estado
  reason?: string;         // requerido para algunos estados
  observations?: string;
}
```

---

## Response DTOs

### `CarrierResponse`

```typescript
interface CarrierResponse {
  id: string;
  name: string;
  taxId: string;
  carrierType: CarrierType;
  status: CarrierStatus;
  organizationId: string;
  organizationName: string;
  // + campos de vehículos y clientes preferenciales
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}
```

---

## Enums

### `CarrierType`

```typescript
enum CarrierType {
  EXTERNAL = 'EXTERNAL', // Empresa de logística externa
  CLIENT   = 'CLIENT',   // Transportista del cliente
  OWN      = 'OWN',      // Flota propia del almacén
  TPL      = '3PL',      // Third Party Logistics
  PARCEL   = 'PARCEL'    // Mensajería/paquetería
}
```

### `CarrierStatus`

```typescript
enum CarrierStatus {
  ACTIVE    = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  INACTIVE  = 'INACTIVE'
}
```

---

## ⚠️ Quirks Importantes

1. **`GET /carriers`** acepta `?organizationId=UUID` opcional para filtrar por org.
2. **`GET /carriers/validate-rfc`** acepta `?excludeId=UUID` para excluir el carrier en edición (útil en formulario de edición).
3. **`PUT /carriers`** tiene el `id` en el BODY, no en el path.
4. **`PATCH /carriers/{id}/status`** registra automáticamente en bitácora de auditoría.
5. **`DELETE`** es eliminación **física** (no soft delete).

---

## KPI Cards sugeridas

| KPI | Filtro | Ícono | Color |
|---|---|---|---|
| Total | todos | `local_shipping` | Navy |
| Activos | `status=ACTIVE` | `check_circle` | Success |
| Suspendidos | `status=SUSPENDED` | `pause_circle` | Warning |
| Inactivos | `status=INACTIVE` | `cancel` | Muted |
