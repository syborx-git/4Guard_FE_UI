# API Contract — Módulo: Proveedores (HU-125)

**Controller:** `SupplierController.java`  
**Base path:** `/api/v1/suppliers`  
**RBAC Module (FE):** `suppliers`  
**Permission base:** `SUPPLIERS_CREATE/READ/UPDATE/DELETE/STATUS_CHANGE` o role `OPERATIONS_MANAGER`

---

## Endpoints

| Método | Ruta | Permission | Descripción |
|---|---|---|---|
| `GET` | `/suppliers` | `SUPPLIERS_READ` | Lista paginada con filtros dinámicos |
| `GET` | `/suppliers/{id}` | `SUPPLIERS_READ` | Detalle completo |
| `GET` | `/suppliers/{id}/audit` | `SUPPLIERS_READ` | Historial |
| `GET` | `/suppliers/catalogs/types` | `SUPPLIERS_READ` | Catálogo de tipos |
| `GET` | `/suppliers/catalogs/currencies` | `SUPPLIERS_READ` | Catálogo de monedas |
| `POST` | `/suppliers` | `SUPPLIERS_CREATE` | Crear (genera código PRV-XXXX automáticamente) |
| `PUT` | `/suppliers/{id}` | `SUPPLIERS_UPDATE` | Actualizar (id en PATH) |
| `PATCH` | `/suppliers/{id}/status` | `SUPPLIERS_STATUS_CHANGE` | Cambio de estado |
| `DELETE` | `/suppliers/{id}` | `SUPPLIERS_DELETE` | **Soft delete** (archivado lógico) |

---

## Request DTOs → TypeScript

### `CreateSupplierRequest`

```typescript
interface CreateSupplierRequest {
  name: string;
  taxId?: string;            // RFC fiscal
  supplierType?: string;     // de catálogo /suppliers/catalogs/types
  organizationId?: string;   // UUID
  // Contacto
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  // Dirección
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  // Condiciones comerciales
  paymentTerms?: string;
  currencyCode?: string;     // de catálogo /suppliers/catalogs/currencies
  preferredSupplier?: boolean;
  scopeType?: string;        // LOCAL | NATIONAL | INTERNATIONAL
}
```

### `UpdateSupplierRequest`

```typescript
// Igual que Create, todos opcionales.
// id va en el PATH: PUT /suppliers/{id}
interface UpdateSupplierRequest {
  name?: string;
  taxId?: string;
  supplierType?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  paymentTerms?: string;
  currencyCode?: string;
  preferredSupplier?: boolean;
  scopeType?: string;
}
```

### `UpdateSupplierStatusRequest`

```typescript
interface UpdateSupplierStatusRequest {
  status: SupplierStatus;   // nuevo estado
  reason?: string;          // REQUERIDO para INACTIVE y BLOCKED
  observations?: string;
}
```

---

## Response DTOs

### `SupplierResponse` (detalle completo)

```typescript
interface SupplierResponse {
  id: string;
  code: string;              // PRV-XXXX generado por BE
  name: string;
  taxId: string | null;
  supplierType: string | null;
  status: SupplierStatus;
  preferredSupplier: boolean;
  scopeType: string | null;
  organizationId: string | null;
  // Contacto
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  // Dirección
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  // Términos
  paymentTerms: string | null;
  currencyCode: string | null;
  // Auditoría
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}
```

### `SupplierSummaryResponse` (en lista paginada)

```typescript
interface SupplierSummaryResponse {
  id: string;
  code: string;
  name: string;
  taxId: string | null;
  supplierType: string | null;
  status: SupplierStatus;
  preferredSupplier: boolean;
  contactName: string | null;
  city: string | null;
}
```

---

## Paginación (GET /suppliers)

El endpoint de lista es **paginado** y filtrable:

```typescript
// Query params
interface SupplierFilterParams {
  organizationId?: string;
  search?: string;           // búsqueda libre
  status?: string;
  type?: string;
  scopeType?: string;
  clientId?: string;
  warehouseId?: string;
  preferredOnly?: boolean;
  page?: number;             // default: 0
  size?: number;             // default: 20
  sortBy?: string;           // default: 'updatedAt'
  sortDir?: 'ASC' | 'DESC'; // default: 'DESC'
}

// Response (Spring Page envuelto en ApiResponse)
interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;       // página actual (0-indexed)
  size: number;
}
```

---

## Enums

```typescript
enum SupplierStatus {
  ACTIVE   = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED  = 'BLOCKED'
}
```

---

## ⚠️ Quirks Importantes

1. **DELETE es SOFT DELETE** (archivado lógico). El proveedor queda con `is_deleted=true`. Historial y auditoría se preservan.
2. **`PUT /suppliers/{id}`** usa el id en el PATH (excepción — a diferencia de Users, Carriers, Branches).
3. **`GET /suppliers`** devuelve `Page<SupplierSummaryResponse>` (lista resumida). Para el detalle usar `GET /suppliers/{id}`.
4. **Código `PRV-XXXX`** se genera automáticamente en el BE al crear. NO enviar en el create request.
5. **Sub-entidades** (contacto, dirección, términos) se actualizan en la misma transacción del PUT.
6. **INACTIVE y BLOCKED** requieren `reason` en el body del PATCH status.
7. Catálogos auxiliares: `/suppliers/catalogs/types` y `/suppliers/catalogs/currencies` — cargar antes de renderizar el formulario.
