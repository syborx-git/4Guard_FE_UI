# API Contract — Módulo: Organizaciones

**Controller:** `OrganizationController.java`  
**Base path:** `/api/v1/organizations`  
**RBAC Module (FE):** `admin`  
**Permission base:** `ORGANIZATIONS_CREATE/READ/UPDATE/DELETE` o role `OPERATIONS_MANAGER`

---

## Endpoints

| Método | Ruta | Permission | Descripción |
|---|---|---|---|
| `GET` | `/organizations` | `ORGANIZATIONS_READ` | Lista todas las organizaciones |
| `GET` | `/organizations/{id}` | `ORGANIZATIONS_READ` | Detalle por UUID |
| `GET` | `/organizations/{id}/audit` | `ORGANIZATIONS_READ` o `AUDIT_READ` | Historial |
| `POST` | `/organizations` | `ORGANIZATIONS_CREATE` | Crear organización |
| `PUT` | `/organizations` | `ORGANIZATIONS_UPDATE` | Actualizar (id en body) |
| `DELETE` | `/organizations/{id}` | `ORGANIZATIONS_DELETE` | Eliminar físicamente |

---

## Request DTOs → TypeScript

```typescript
interface CreateOrganizationRequest {
  name: string;
  taxId?: string;          // RFC de la org
  email?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
}

interface UpdateOrganizationRequest {
  id: string;              // UUID en BODY
  name?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
}
```

---

## Response DTOs

```typescript
interface OrganizationResponse {
  id: string;
  name: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}
```

---

## ⚠️ Quirks

1. **Multi-tenant:** Cada organización es un tenant separado. Los usuarios pertenecen a una organización.
2. **`GET /organizations`** no tiene filtro (devuelve todas — solo SYSADMIN/ADMIN debería verlas).
3. **`PUT /organizations`** con `id` en body.
4. Eliminar organización puede tener restricciones de integridad referencial en BE (branches, users).
