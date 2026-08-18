# API Contract — Módulo: Clientes (Depositantes & Destinos 3PL)

> **Documento SDD:** [`docs/sdd/clients-management.sdd.md`](../../sdd/clients-management.sdd.md)  
> **Controller:** `ClientController.java`  
> **Base path:** `/api/v1/clients`  
> **RBAC Module (FE):** `admin` (clients)  
> **Permission base:** `CLIENTS_CREATE/READ/UPDATE/DELETE` o role `OPERATIONS_MANAGER`

---

## Endpoints

| Método | Ruta | Permission | Descripción |
|---|---|---|---|
| `GET` | `/clients` | `CLIENTS_READ` | Lista todos (filtra por `?organizationId=`) |
| `GET` | `/clients/{id}` | `CLIENTS_READ` | Detalle por UUID con contactos y destinos |
| `GET` | `/clients/{id}/audit` | `CLIENTS_READ` | Historial de cambios |
| `POST` | `/clients` | `CLIENTS_CREATE` | Crear cliente con matriz de contactos y destinos |
| `PUT` | `/clients` | `CLIENTS_UPDATE` | Actualizar cliente (id en body) |
| `POST` | `/clients/{id}/destinations` | `CLIENTS_UPDATE` | Agregar nueva dirección de destino / bodega |
| `DELETE` | `/clients/{id}` | `CLIENTS_DELETE` | Desactivar / Eliminar cliente |

---

## Modelos y Request DTOs → TypeScript

```typescript
export interface ClientContactDto {
  id?: string;
  name: string;
  department: string;
  phone: string;
  email: string;
  isPrimary?: boolean;
}

export interface PhysicalDestinationDto {
  id?: string;
  destinationCode?: string;
  plantName: string;
  fullAddress: string;
  contactPerson: string;
  phone: string;
  status?: 'ACTIVO' | 'INACTIVO';
  notes?: string;
}

export interface CreateClientRequest {
  name: string;
  taxId?: string;
  externalId?: string;
  organizationId: string;  // UUID requerido
  email?: string;
  phone?: string;
  address?: string;
  webPortalPassword?: string;
  isActive?: boolean;
  contacts?: ClientContactDto[];
  destinations?: PhysicalDestinationDto[];
}

export interface UpdateClientRequest {
  id: string;              // UUID en BODY
  name?: string;
  taxId?: string;
  externalId?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
  contacts?: ClientContactDto[];
  destinations?: PhysicalDestinationDto[];
}
```

---

## Response DTOs

```typescript
export interface ClientResponse {
  id: string;
  name: string;
  taxId: string | null;
  externalId: string | null;
  organizationId: string;
  organizationName: string; // ✅ resuelto por BE
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  contacts: ClientContactDto[];
  destinations: PhysicalDestinationDto[];
  version: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}
```

---

## ⚠️ Quirks & Reglas de Negocio

1. **Clientes** son los "depositantes" de inventario en el almacén (propietarios de la mercancía en esquemas 3PL).
2. **`GET /clients?organizationId=UUID`** filtra por organización multi-tenant.
3. Los **SKUs** pertenecen a clientes (`productSkus?clientId=UUID`).
4. **Múltiples Destinos (Multi-Bodega):** Un cliente puede tener múltiples plantas o bodegas registradas (`destinations[]`), cada una con su dirección física, contacto local y teléfono.
5. El módulo de **Salidas / Despacho (Outbound)** consume las direcciones de destino para emitir remisiones y guías de transporte.

