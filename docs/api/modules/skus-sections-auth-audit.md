# API Contract — Módulo: SKUs / Catálogo de Productos

**Controller:** `ProductSkuController.java`  
**Base path:** `/api/v1/product-skus`  
**RBAC Module (FE):** `inventory` (skus)  
**Permission base:** `INVENTORY_CREATE/READ/UPDATE/DELETE` o role `OPERATIONS_MANAGER`

---

## Endpoints

| Método | Ruta | Permission | Descripción |
|---|---|---|---|
| `GET` | `/product-skus` | `INVENTORY_READ` | Lista todos (filtra por `?clientId=`) |
| `GET` | `/product-skus/{id}` | `INVENTORY_READ` | Detalle por UUID |
| `POST` | `/product-skus` | `INVENTORY_CREATE` | Registrar SKU |
| `PUT` | `/product-skus` | `INVENTORY_UPDATE` | Actualizar (id en body) |
| `DELETE` | `/product-skus/{id}` | `INVENTORY_DELETE` | Eliminar físicamente |

---

## Request DTOs → TypeScript

```typescript
interface CreateProductSkuRequest {
  sku: string;             // código SKU único
  name: string;
  description?: string;
  clientId: string;        // UUID — propietario del SKU
  unit?: string;           // unidad de medida (PZA, KG, LT...)
  weight?: number;
  dimensions?: string;
  barcode?: string;
  isActive?: boolean;
}

interface UpdateProductSkuRequest {
  id: string;              // UUID en BODY
  sku?: string;
  name?: string;
  description?: string;
  unit?: string;
  weight?: number;
  dimensions?: string;
  barcode?: string;
  isActive?: boolean;
}
```

---

## Response DTOs

```typescript
interface ProductSkuResponse {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  clientId: string;
  clientName: string;      // ✅ resuelto por BE
  unit: string | null;
  weight: number | null;
  dimensions: string | null;
  barcode: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}
```

---

## ⚠️ Quirks

1. **`GET /product-skus?clientId=UUID`** filtra por cliente. Sin param devuelve todos.
2. **`PUT /product-skus`** tiene id en body.
3. SKUs usan permisos de `INVENTORY_*` (no tienen su propio permiso).
4. No hay `/audit` endpoint en este controller.

---

# API Contract — Módulo: Secciones de Almacén

**Controller:** `WarehouseSectionController.java`  
**Base path:** `/api/v1/warehouse-sections`  
**RBAC Module (FE):** `sections`  
**Permission base:** `SECTIONS_CREATE/READ/UPDATE/DELETE` o role `OPERATIONS_MANAGER`

---

## Endpoints

| Método | Ruta | Permission | Descripción |
|---|---|---|---|
| `GET` | `/warehouse-sections` | `SECTIONS_READ` | Lista todas (filtra por `?branchId=`) |
| `GET` | `/warehouse-sections/{id}` | `SECTIONS_READ` | Detalle por UUID |
| `GET` | `/warehouse-sections/{id}/audit` | `SECTIONS_READ` | Historial |
| `POST` | `/warehouse-sections` | `SECTIONS_CREATE` | Crear sección |
| `PUT` | `/warehouse-sections` | `SECTIONS_UPDATE` | Actualizar (id en body) |
| `PATCH` | `/warehouse-sections/{id}/status` | `SECTIONS_UPDATE` | Cambio de estado |
| `DELETE` | `/warehouse-sections/{id}` | `SECTIONS_DELETE` | Eliminar físicamente |

---

## Request DTOs → TypeScript

```typescript
interface CreateWarehouseSectionRequest {
  name: string;
  code?: string;           // código corto de sección
  branchId: string;        // UUID requerido
  sectionType?: string;    // DRY, COLD, HAZMAT, etc.
  description?: string;
  isActive?: boolean;
}

interface UpdateWarehouseSectionRequest {
  id: string;              // UUID en BODY
  name?: string;
  code?: string;
  sectionType?: string;
  description?: string;
}

interface UpdateWarehouseSectionStatusRequest {
  status: 'ACTIVE' | 'INACTIVE';
  reason?: string;
}
```

---

## Response DTOs

```typescript
interface WarehouseSectionResponse {
  id: string;
  name: string;
  code: string | null;
  branchId: string;
  branchName: string;      // ✅ resuelto por BE
  sectionType: string | null;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}
```

---

## ⚠️ Quirks

1. **`GET /warehouse-sections?branchId=UUID`** filtra por sucursal.
2. **Status FSM simple:** solo `ACTIVE` y `INACTIVE` (sin BLOCKED, MAINTENANCE).
3. **Las Ubicaciones** pertenecen a Secciones via `sectionId`.

---

# API Contract — Módulo: Autenticación

**Controller:** `AuthController.java`  
**Base path:** `/api/v1/auth`  
**Público:** Sin JWT requerido (excepto logout)

---

## Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/auth/login` | No | Login con credenciales |
| `POST` | `/auth/refresh` | No | Renovar token |
| `POST` | `/auth/logout` | JWT requerido | Cerrar sesión (registra en auditoría) |

---

## Request DTOs

```typescript
interface LoginRequest {
  username: string;
  password: string;
}

interface RefreshTokenRequest {
  refreshToken: string;
}

interface LogoutRequest {
  refreshToken: string;  // token a invalidar
}
```

## Response DTOs

```typescript
interface AuthResponse {
  token: string;              // JWT access token
  refreshToken: string;
  user: {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    organizationId: string;
    branchId: string;
    changePasswordRequired: boolean; // true → redirigir a /change-password
    permissions: string[];           // ej: ["USERS_READ", "CARRIERS_CREATE"]
  }
}
```

---

# API Contract — Módulo: Auditoría / Sesiones Activas

**Controller:** `AuditController.java`  
**Base path:** `/api/v1/audit`  
**Permission:** `AUDIT_READ` o role `OPERATIONS_MANAGER`

---

## Endpoints

| Método | Ruta | Permission | Descripción |
|---|---|---|---|
| `GET` | `/audit/active-sessions` | `AUDIT_READ` | Sesiones activas (últimas 24h) |
| `DELETE` | `/audit/active-sessions/{userId}` | `AUDIT_WRITE` / `OPERATIONS_MANAGER` | Revocar sesión activa de usuario en caché y registrar en BD |

```typescript
// Query params opcionales en GET
// ?organizationId=UUID&branchId=UUID

interface ActiveSessionResponse {
  userId: string;
  username: string;
  email: string;
  organizationName: string;
  branchName: string;
  loginAt: string;          // ISO 8601
  lastActivity: string;
  ipAddress: string | null;
}

// DELETE /audit/active-sessions/{userId}
// Path param: userId (UUID)
// Respuestas: 200 OK (Sesión revocada), 401 Unauthorized, 403 Forbidden, 404 Not Found
```

---

## ⚠️ Notas sobre Auditoría Global

Cada entidad tiene su propio endpoint de auditoría en su controller:
- `GET /users/{id}/audit`
- `GET /carriers/{id}/audit`
- `GET /locations/{id}/audit`
- `GET /branches/{id}/audit`
- `GET /organizations/{id}/audit`
- `GET /clients/{id}/audit`
- `GET /roles/{id}/audit`
- `GET /permissions/{id}/audit`
- `GET /warehouse-sections/{id}/audit`
- `GET /suppliers/{id}/audit`

El `AuditController` solo expone las sesiones activas globales.
