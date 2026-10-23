# API Contract — Módulo: Roles y Permisos

**Controllers:** `RoleController.java` + `PermissionController.java`  
**Base paths:** `/api/v1/roles` y `/api/v1/permissions`  
**RBAC Module (FE):** `admin`  
**Permission roles:** `ROLES_CREATE/READ/UPDATE/DELETE`  
**Permission permisos:** `PERMISSIONS_CREATE/READ/DELETE`

---

## Roles — Endpoints

| Método | Ruta | Permission | Descripción |
|---|---|---|---|
| `GET` | `/roles` | `ROLES_READ` | Lista todos los roles |
| `GET` | `/roles/{id}` | `ROLES_READ` | Detalle con permisos asignados |
| `GET` | `/roles/{id}/audit` | `ROLES_READ` | Historial de cambios |
| `POST` | `/roles` | `ROLES_CREATE` | Crear rol |
| `PUT` | `/roles` | `ROLES_UPDATE` | Actualizar (id en body) |
| `PUT` | `/roles/{id}/permissions` | `ROLES_UPDATE` | Reemplazar permisos del rol |
| `DELETE` | `/roles/{id}` | `ROLES_DELETE` | Eliminar rol |

## Permisos — Endpoints

| Método | Ruta | Permission | Descripción |
|---|---|---|---|
| `GET` | `/permissions` | `PERMISSIONS_READ` | Catálogo completo |
| `GET` | `/permissions/{id}` | `PERMISSIONS_READ` | Detalle por UUID |
| `GET` | `/permissions/{id}/audit` | `PERMISSIONS_READ` | Historial |
| `POST` | `/permissions` | `PERMISSIONS_CREATE` | Crear permiso |
| `DELETE` | `/permissions/{id}` | `PERMISSIONS_DELETE` | Eliminar (cascada en BD) |

---

## Request DTOs → TypeScript

### Roles

```typescript
interface CreateRoleRequest {
  name: string;            // convención: UPPERCASE_SNAKE (ej: WAREHOUSE_ADMIN)
  description?: string;
  level?: number;          // jerarquía del rol
  permissionIds?: string[];// UUIDs — asignar permisos al crear (opcional)
}

interface UpdateRoleRequest {
  id: string;              // UUID en BODY
  name?: string;
  description?: string;
  level?: number;
  permissionIds?: string[];// Si se envía, REEMPLAZA todos los permisos actuales
}
```

### Permisos

```typescript
interface CreatePermissionRequest {
  name: string;            // convención: ENTIDAD_ACCION (ej: INVENTORY_READ)
  description?: string;
  module?: string;         // módulo al que pertenece
}
```

---

## Response DTOs

```typescript
interface RoleResponse {
  id: string;
  name: string;
  description: string | null;
  level: number | null;
  isSystem: boolean;       // los roles de sistema NO se pueden eliminar
  permissions: PermissionResponse[];
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface PermissionResponse {
  id: string;
  name: string;            // ej: "USERS_CREATE"
  description: string | null;
  module: string | null;
}
```

---

## Endpoint especial: Asignar permisos

```http
PUT /api/v1/roles/{id}/permissions
Content-Type: application/json
Authorization: Bearer <token>

["uuid-perm-1", "uuid-perm-2", "uuid-perm-3"]
```

**Body:** Array de UUIDs de permisos. Enviar `[]` para remover todos.  
**Comportamiento:** Reemplaza completamente el set de permisos del rol.

---

## ⚠️ Quirks Importantes

1. **Roles de sistema (`isSystem=true`)** NO se pueden eliminar — el BE retorna 400.
2. **Roles con usuarios asignados** NO se pueden eliminar.
3. **`PUT /roles/{id}/permissions`** usa el id en el PATH (excepción al patrón).
4. **Eliminar un permiso** ejecuta `ON DELETE CASCADE` en BD → todos los roles que lo tenían lo pierden automáticamente.
5. **`PUT /roles`** para datos del rol (nombre, descripción). Si incluye `permissionIds`, REEMPLAZA los permisos también.
6. No hay endpoint de update para permissions (catálogo semi-estático).

---

## Permisos del sistema (convención de naming)

```
USERS_CREATE | USERS_READ | USERS_UPDATE | USERS_DELETE
ROLES_CREATE | ROLES_READ | ROLES_UPDATE | ROLES_DELETE
PERMISSIONS_CREATE | PERMISSIONS_READ | PERMISSIONS_DELETE
CARRIERS_CREATE | CARRIERS_READ | CARRIERS_UPDATE | CARRIERS_DELETE
LOCATIONS_CREATE | LOCATIONS_READ | LOCATIONS_UPDATE | LOCATIONS_DELETE
BRANCHES_CREATE | BRANCHES_READ | BRANCHES_UPDATE | BRANCHES_DELETE
ORGANIZATIONS_CREATE | ORGANIZATIONS_READ | ORGANIZATIONS_UPDATE | ORGANIZATIONS_DELETE
CLIENTS_CREATE | CLIENTS_READ | CLIENTS_UPDATE | CLIENTS_DELETE
SECTIONS_CREATE | SECTIONS_READ | SECTIONS_UPDATE | SECTIONS_DELETE
SUPPLIERS_CREATE | SUPPLIERS_READ | SUPPLIERS_UPDATE | SUPPLIERS_DELETE | SUPPLIERS_STATUS_CHANGE
INVENTORY_CREATE | INVENTORY_READ | INVENTORY_UPDATE | INVENTORY_DELETE
AUDIT_READ
```
