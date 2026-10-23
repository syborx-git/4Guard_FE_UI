# API Contract — Módulo: Sucursales

**Controller:** `BranchController.java`  
**Base path:** `/api/v1/branches`  
**RBAC Module (FE):** `admin` (branches)  
**Permission base:** `BRANCHES_CREATE/READ/UPDATE/DELETE` o role `OPERATIONS_MANAGER`

---

## Endpoints

| Método | Ruta | Permission | Descripción |
|---|---|---|---|
| `GET` | `/branches` | `BRANCHES_READ` | Lista todas (filtra por `?organizationId=`) |
| `GET` | `/branches/{id}` | `BRANCHES_READ` | Detalle por UUID |
| `GET` | `/branches/{id}/audit` | `BRANCHES_READ` | Historial de cambios |
| `POST` | `/branches` | `BRANCHES_CREATE` | Crear sucursal |
| `PUT` | `/branches` | `BRANCHES_UPDATE` | Actualizar (id en body) |
| `DELETE` | `/branches/{id}` | `BRANCHES_DELETE` | Eliminar físicamente |

---

## Request DTOs → TypeScript

```typescript
interface CreateBranchRequest {
  name: string;
  organizationId: string;  // UUID
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  isActive?: boolean;
}

interface UpdateBranchRequest {
  id: string;              // UUID en BODY
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  isActive?: boolean;
}
```

---

## Response DTOs

```typescript
interface BranchResponse {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string; // ✅ resuelto por BE
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}
```

---

## ⚠️ Quirks

1. **`GET /branches?organizationId=UUID`** filtra por organización. Sin param devuelve todas.
2. **`PUT /branches`** tiene `id` en body.
3. No hay PATCH de status (isActive se edita desde el PUT normal).

---

## KPI Cards sugeridas

| KPI | Filtro | Ícono |
|---|---|---|
| Total | todos | `store` |
| Activas | `isActive=true` | `check_circle` |
| Inactivas | `isActive=false` | `cancel` |
