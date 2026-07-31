# API Contract — Módulo: Clientes

**Controller:** `ClientController.java`  
**Base path:** `/api/v1/clients`  
**RBAC Module (FE):** `admin` (clients)  
**Permission base:** `CLIENTS_CREATE/READ/UPDATE/DELETE` o role `OPERATIONS_MANAGER`

---

## Endpoints

| Método | Ruta | Permission | Descripción |
|---|---|---|---|
| `GET` | `/clients` | `CLIENTS_READ` | Lista todos (filtra por `?organizationId=`) |
| `GET` | `/clients/{id}` | `CLIENTS_READ` | Detalle por UUID |
| `GET` | `/clients/{id}/audit` | `CLIENTS_READ` | Historial de cambios |
| `POST` | `/clients` | `CLIENTS_CREATE` | Crear cliente |
| `PUT` | `/clients` | `CLIENTS_UPDATE` | Actualizar (id en body) |
| `DELETE` | `/clients/{id}` | `CLIENTS_DELETE` | Eliminar físicamente |

---

## Request DTOs → TypeScript

```typescript
interface CreateClientRequest {
  name: string;
  taxId?: string;
  organizationId: string;  // UUID requerido
  email?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
}

interface UpdateClientRequest {
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
interface ClientResponse {
  id: string;
  name: string;
  taxId: string | null;
  organizationId: string;
  organizationName: string; // ✅ resuelto por BE
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

1. **Clientes** son los "depositantes" de inventario en el almacén (propietarios de la mercancía).
2. **`GET /clients?organizationId=UUID`** filtra por organización.
3. Los **SKUs** pertenecen a clientes (`productSkus?clientId=UUID`).
