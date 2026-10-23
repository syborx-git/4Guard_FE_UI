# Contrato API — Módulo de Licencias WMS (HU-139)

> **Base URL:** `/api/v1/licenses`  
> **Formato de Comunicación:** `application/json`  
> **Autenticación:** `Bearer <JWT_TOKEN>` en Header `Authorization`  

---

## 📌 1. Estructura Estándar de Respuesta Backend

### Respuesta de Éxito (`ApiResponse<T>`)
```json
{
  "success": true,
  "message": "Operación ejecutada con éxito",
  "data": { ... }
}
```

### Respuesta de Error Estándar (`ApiErrorResponse`)
```json
{
  "success": false,
  "message": "Mensaje descriptivo del error para el usuario",
  "status": 400,
  "timestamp": "2026-08-02T06:30:00Z"
}
```

---

## 🎨 2. Catálogo de Enums para Frontend (TypeScript Interfaces)

```typescript
export type LicensePlan = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' | 'CUSTOM';

export type LicenseAdminStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export type LicenseHistoryAction =
  | 'CREATED'
  | 'UPDATED'
  | 'RENEWED'
  | 'SUSPENDED'
  | 'REACTIVATED'
  | 'REVOKED'
  | 'CAPACITY_CHANGED'
  | 'MODULES_CHANGED'
  | 'KEY_REGENERATED';
```

---

## 📋 3. Matriz Resumen de Endpoints

| Método | Endpoint | Descripción | RBAC Permisos / Roles |
|---|---|---|---|
| `GET` | `/api/v1/licenses` | Listar licencias WMS | `ROLE_ADMIN`, `ROLE_OPS`, `ROLE_SUPER_ADMIN` |
| `GET` | `/api/v1/licenses/{id}` | Obtener detalle y consumos reales | `ROLE_ADMIN`, `ROLE_OPS`, `ROLE_SUPER_ADMIN` |
| `POST` | `/api/v1/licenses` | Emitir/Registrar nueva licencia | `ROLE_SUPER_ADMIN` |
| `PUT` | `/api/v1/licenses/{id}` | Modificar capacidades/módulos/metadatos | `ROLE_SUPER_ADMIN` |
| `POST` | `/api/v1/licenses/{id}/renew` | Renovar vigencia contractual | `ROLE_SUPER_ADMIN` |
| `POST` | `/api/v1/licenses/{id}/suspend` | Suspender administrativamente | `ROLE_SUPER_ADMIN` |
| `POST` | `/api/v1/licenses/{id}/reactivate` | Reactivar licencia suspendida | `ROLE_SUPER_ADMIN` |
| `POST` | `/api/v1/licenses/{id}/revoke` | Revocar permanentemente licencia | `ROLE_SUPER_ADMIN` |
| `POST` | `/api/v1/licenses/{id}/regenerate-key` | Regenerar clave secreta | `ROLE_SUPER_ADMIN` |
| `GET` | `/api/v1/licenses/{id}/history` | Consultar bitácora de historial de cambios | `ROLE_ADMIN`, `ROLE_SUPER_ADMIN` |

---

## ⚙️ 4. Especificación Detallada de Endpoints

### 4.1. Listar Licencias WMS
* **Método:** `GET`
* **URL:** `/api/v1/licenses`
* **Query Params:** `organizationId` (opcional, UUID)

#### Respuesta Exitosa (200 OK):
```json
{
  "success": true,
  "message": "Lista de licencias obtenida con éxito",
  "data": [
    {
      "id": "e13f0907-9fa5-4bdf-87db-2eb5e7683990",
      "organizationId": "a53f0907-9fa5-4bdf-87db-2eb5e7683935",
      "organizationName": "4GUARD LOGISTICS CORP",
      "licenseName": "Licencia Enterprise 4GUARD Corporate",
      "maskedLicenseKey": "4GD-ENT-••••-••••-9X21",
      "plan": "ENTERPRISE",
      "description": "Licencia corporativa ilimitada",
      "validFrom": "2026-07-03T00:00:00Z",
      "validUntil": "2027-07-03T00:00:00Z",
      "gracePeriodDays": 15,
      "autoRenewal": true,
      "adminStatus": "ACTIVE",
      "maxUsers": 50,
      "maxConcurrentUsers": 25,
      "maxWarehouses": 5,
      "maxHandheldDevices": 20,
      "maxIntegrations": 10,
      "enabledModules": ["WMS_CORE", "INVENTORY", "QUALITY", "CARRIERS", "SHIFTS", "ALERTS"],
      "administrativeReason": null,
      "observations": "Cliente VIP Corporativo",
      "createdAt": "2026-07-03T00:00:00Z",
      "updatedAt": "2026-08-02T00:00:00Z",
      "updatedBy": "enrique"
    }
  ]
}
```

---

### 4.2. Obtener Detalle de Licencia y Consumo Real
* **Método:** `GET`
* **URL:** `/api/v1/licenses/{id}`

#### Respuesta Exitosa (200 OK):
```json
{
  "success": true,
  "message": "Detalle de licencia obtenido con éxito",
  "data": {
    "license": {
      "id": "e13f0907-9fa5-4bdf-87db-2eb5e7683990",
      "organizationId": "a53f0907-9fa5-4bdf-87db-2eb5e7683935",
      "organizationName": "4GUARD LOGISTICS CORP",
      "licenseName": "Licencia Enterprise 4GUARD Corporate",
      "maskedLicenseKey": "4GD-ENT-••••-••••-9X21",
      "plan": "ENTERPRISE",
      "validFrom": "2026-07-03T00:00:00Z",
      "validUntil": "2027-07-03T00:00:00Z",
      "adminStatus": "ACTIVE",
      "maxUsers": 50,
      "maxConcurrentUsers": 25,
      "maxWarehouses": 5,
      "maxHandheldDevices": 20,
      "maxIntegrations": 10,
      "enabledModules": ["WMS_CORE", "INVENTORY", "QUALITY"]
    },
    "usage": {
      "licenseId": "e13f0907-9fa5-4bdf-87db-2eb5e7683990",
      "currentUsers": 3,
      "concurrentUsersPeak": 0,
      "currentWarehouses": 1,
      "registeredHandheldDevices": 0,
      "activeIntegrations": 0
    }
  }
}
```

---

### 4.3. Emitir Nueva Licencia WMS
* **Método:** `POST`
* **URL:** `/api/v1/licenses`

#### Entrada Body JSON (`CreateLicenseRequest`):
```json
{
  "organizationId": "a53f0907-9fa5-4bdf-87db-2eb5e7683935",
  "licenseName": "Licencia Sucursal Monterrey",
  "plan": "PROFESSIONAL",
  "description": "Licencia contratada para centro de distribución MTY",
  "validFrom": "2026-08-01T00:00:00Z",
  "validUntil": "2027-08-01T00:00:00Z",
  "gracePeriodDays": 15,
  "autoRenewal": false,
  "maxUsers": 20,
  "maxConcurrentUsers": 10,
  "maxWarehouses": 2,
  "maxHandheldDevices": 8,
  "maxIntegrations": 3,
  "enabledModules": ["WMS_CORE", "INVENTORY", "CARRIERS"],
  "observations": "Contrato folio MTY-2026-A"
}
```

---

### 4.4. Modificar Licencia WMS
* **Método:** `PUT`
* **URL:** `/api/v1/licenses/{id}`

#### Entrada Body JSON (`UpdateLicenseRequest`):
```json
{
  "licenseName": "Licencia Enterprise Ampliada 4GUARD",
  "plan": "ENTERPRISE",
  "maxUsers": 100,
  "maxConcurrentUsers": 40,
  "enabledModules": ["WMS_CORE", "INVENTORY", "QUALITY", "CARRIERS", "SHIFTS", "ALERTS"],
  "administrativeReason": "Ampliación de capacidad contratada",
  "observations": "Adenda de contrato firmada"
}
```

---

### 4.5. Renovar Licencia WMS
* **Método:** `POST`
* **URL:** `/api/v1/licenses/{id}/renew`

#### Entrada Body JSON (`RenewLicenseRequest`):
```json
{
  "newValidUntil": "2028-08-01T00:00:00Z",
  "newPlan": "ENTERPRISE",
  "autoRenewal": true,
  "reason": "Renovación de contrato por 2 años adicionales"
}
```

---

### 4.6. Suspender Licencia WMS
* **Método:** `POST`
* **URL:** `/api/v1/licenses/{id}/suspend`

#### Entrada Body JSON (`SuspendLicenseRequest`):
```json
{
  "reason": "Suspensión administrativa por falta de pago del periodo Julio 2026"
}
```

---

### 4.7. Reactivar Licencia Suspendida
* **Método:** `POST`
* **URL:** `/api/v1/licenses/{id}/reactivate`

---

### 4.8. Revocar Licencia Permanentemente
* **Método:** `POST`
* **URL:** `/api/v1/licenses/{id}/revoke?reason=Terminacion+anticipada+de+contrato`

---

### 4.9. Regenerar Clave Secreta de Licencia
* **Método:** `POST`
* **URL:** `/api/v1/licenses/{id}/regenerate-key`

#### Respuesta Exitosa (200 OK):
> **Nota:** `rawLicenseKey` sólo se entrega una única vez en esta respuesta.
```json
{
  "success": true,
  "message": "Clave de licencia regenerada con éxito",
  "data": {
    "licenseId": "e13f0907-9fa5-4bdf-87db-2eb5e7683990",
    "rawLicenseKey": "4GD-ENT-A8F2-99B1-9X21",
    "maskedLicenseKey": "4GD-ENT-A8F2-••••-9X21",
    "message": "Clave secreta de licencia regenerada con éxito. Guarde esta clave plana en un lugar seguro."
  }
}
```

---

### 4.10. Consultar Bitácora de Historial de Licencia
* **Método:** `GET`
* **URL:** `/api/v1/licenses/{id}/history`

#### Respuesta Exitosa (200 OK):
```json
{
  "success": true,
  "message": "Historial de la licencia obtenido con éxito",
  "data": [
    {
      "id": "f13f0907-9fa5-4bdf-87db-2eb5e7683991",
      "licenseId": "e13f0907-9fa5-4bdf-87db-2eb5e7683990",
      "action": "CAPACITY_CHANGED",
      "description": "Modificación de capacidades contratadas",
      "previousValue": "{\"plan\":\"ENTERPRISE\",\"maxUsers\":50,\"adminStatus\":\"ACTIVE\"}",
      "newValue": "{\"plan\":\"ENTERPRISE\",\"maxUsers\":100,\"adminStatus\":\"ACTIVE\"}",
      "performedBy": "enrique",
      "performedAt": "2026-08-02T00:27:00Z"
    }
  ]
}
```
