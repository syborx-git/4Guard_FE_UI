# 4GUARD WMS — Contrato Global de API

> Aplica a TODOS los módulos del sistema.

---

## Base URL

```
DEV:  http://localhost:8080/api/v1
PROD: https://api.4guard.mx/api/v1
```

---

## Autenticación

Todos los endpoints (excepto `/auth/login`, `/auth/refresh`, `/users/reset-password-temp` por username) requieren:

```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

El `AuthInterceptor` de Angular adjunta el token automáticamente.

---

## Wrapper ApiResponse

**Todo** response del BE viene en este formato:

```typescript
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
```

En el servicio Angular, siempre extraer `.data`:

```typescript
this.http.get<ApiResponse<UserResponse[]>>(url).pipe(map(r => r.data))
```

---

## Paginación (solo Suppliers por ahora)

```typescript
// Spring Page<T>
interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;   // página actual (0-indexed)
  size: number;
  first: boolean;
  last: boolean;
}
```

---

## Errores Standard

```typescript
// 400 — Validación / bad request
{ success: false, message: "Datos de entrada inválidos", data: null }

// 401 — No autenticado
{ success: false, message: "No autorizado", data: null }

// 403 — Sin permiso
{ success: false, message: "Permisos insuficientes", data: null }

// 404 — No encontrado
{ success: false, message: "[Entidad] no encontrada", data: null }

// 409 — Conflicto (duplicado / inventario activo)
{ success: false, message: "...", data: null }

// 422 — Transición FSM inválida
{ success: false, message: "...", data: null }
```

---

## Patrón de IDs

**Todos los IDs son UUID** (`string` en TypeScript, no `number`).

```typescript
// ✅ Correcto
const id: string = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

// ❌ Incorrecto
const id: number = 123;
```

---

## Patrón de Fechas

Todas las fechas vienen en **ISO 8601 / OffsetDateTime**:

```
"2024-07-30T18:35:11-06:00"
```

Usar `new Date(dateStr)` o una librería como `date-fns` para parsear.

---

## Patrón de IDs en Body vs Path

⚠️ **INCONSISTENCIA CONOCIDA DEL BE:**

| Controller | PUT usa id en... |
|---|---|
| `UserController` | BODY (`request.id`) |
| `CarrierController` | BODY (`request.id`) |
| `LocationController` | BODY (`request.id`) |
| `BranchController` | BODY (`request.id`) |
| `OrganizationController` | BODY (`request.id`) |
| `ClientController` | BODY (`request.id`) |
| `RoleController` | BODY (`request.id`) |
| `ProductSkuController` | BODY (`request.id`) |
| `WarehouseSectionController` | BODY (`request.id`) |
| `SupplierController` | **PATH** (`PUT /suppliers/{id}`) ← excepción |

---

## Patrón de Auditoría

Cada entidad tiene su propio audit endpoint:

```
GET /api/v1/{entity}/{id}/audit
```

Devuelve `AuditEntry[]` con el historial cronológico de cambios.

---

## Patrón de Status Change (FSM)

Las entidades con FSM usan:

```
PATCH /api/v1/{entity}/{id}/status
```

Con body:
```typescript
{ status: NewStatus, reason?: string, observations?: string }
```

`reason` es **obligatorio** en algunos estados (BLOCKED, MAINTENANCE, INACTIVE).

---

## Módulos documentados

| Módulo | Archivo |
|---|---|
| Autenticación | [skus-sections-auth-audit.md](./modules/skus-sections-auth-audit.md) |
| Usuarios | [users.md](./modules/users.md) |
| Transportistas | [carriers.md](./modules/carriers.md) |
| Ubicaciones | [locations.md](./modules/locations.md) |
| Sucursales | [branches.md](./modules/branches.md) |
| Organizaciones | [organizations.md](./modules/organizations.md) |
| Clientes | [clients.md](./modules/clients.md) |
| Roles y Permisos | [roles-permissions.md](./modules/roles-permissions.md) |
| Proveedores | [suppliers.md](./modules/suppliers.md) |
| SKUs | [skus-sections-auth-audit.md](./modules/skus-sections-auth-audit.md) |
| Secciones | [skus-sections-auth-audit.md](./modules/skus-sections-auth-audit.md) |
| Auditoría / Sesiones | [skus-sections-auth-audit.md](./modules/skus-sections-auth-audit.md) |
