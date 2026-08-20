# SDD API Contract — Módulo: Configuración de Alertas y Notificaciones (HU-134)

**Controller:** `AlertsConfigController.java`  
**Base path:** `/api/v1/alerts-config`  
**RBAC Module (FE):** `alerts-config`  
**Permission base:** `ALERTS_READ` / `ALERTS_WRITE` o rol `OPERATIONS_MANAGER` / `ADMIN`  
**Autenticación:** `Authorization: Bearer <JWT_TOKEN>`  
**Aislamiento Multi-Tenant:** El `organizationId` se resuelve automáticamente desde la sesión del JWT en el Backend Kernel (RLS). No se envía en el body de creación.

---

## 1. Catálogos y Enums Oficiales de Dominio

| Campo | Valores Permitidos |
|---|---|
| `category` | `'RECEIVING'`, `'INVENTORY'`, `'QUALITY'`, `'PICKING'`, `'SHIPPING'`, `'USERS'`, `'SYSTEM'` |
| `event` | `'WAIT_TIME_EXCEEDED'`, `'LOW_INVENTORY'`, `'LOT_EXPIRATION'`, `'ORDER_DELAYED'`, `'INVENTORY_DISCREPANCY'`, `'UNAUTHORIZED_ACCESS'`, `'SYSTEM_ERROR'` |
| `priority` | `'INFO'`, `'LOW'`, `'MEDIUM'`, `'HIGH'`, `'CRITICAL'` |
| `status` | `'ACTIVE'`, `'INACTIVE'` |
| `channels` *(Array)* | `'SYSTEM'`, `'PUSH'` *(Nota: SMS y EMAIL deshabilitados en esta versión)* |
| `recipients` *(Array)* | `'OPERATOR'`, `'SUPERVISOR'`, `'MANAGER'`, `'CONTROL_DESK'`, `'CLIENT'`, `'ADMIN'` |
| `condition` | `'GREATER_THAN'`, `'LESS_THAN'`, `'EQUAL'`, `'GREATER_OR_EQUAL'`, `'LESS_OR_EQUAL'` |
| `unit` | `'MINUTES'`, `'HOURS'`, `'DAYS'`, `'PERCENTAGE'`, `'UNITS'`, `'PIECES'`, `'PALLETS'` |
| `recurrence` | `'NEVER'`, `'EVERY_15_MIN'`, `'EVERY_30_MIN'`, `'EVERY_HOUR'`, `'DAILY'` |
| `escalation` | `'NONE'`, `'AFTER_15_MIN'`, `'AFTER_30_MIN'`, `'AFTER_60_MIN'` |

---

## 2. Tabla de Endpoints HTTP REST

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `POST` | `/alerts-config` | `ALERTS_WRITE` | Crear una nueva regla de alerta |
| `PUT` | `/alerts-config/{id}` | `ALERTS_WRITE` | Actualizar parámetros de una regla existente |
| `PATCH` | `/alerts-config/{id}/status` | `ALERTS_WRITE` | Cambiar estatus de la regla (`ACTIVE` / `INACTIVE`) |
| `GET` | `/alerts-config` | `ALERTS_READ` | Consultar y filtrar reglas de alerta de la organización |
| `GET` | `/alerts-config/{id}` | `ALERTS_READ` | Consultar el detalle de una regla de alerta por ID |
| `DELETE` | `/alerts-config/{id}` | `ALERTS_WRITE` | Eliminar lógicamente una regla de alerta (Soft Delete) |
| `GET` | `/alerts-config/{id}/audit` | `ALERTS_READ` / `AUDIT_READ` | Consultar historial de auditoría de la regla |

---

## 3. Interfaces DTO TypeScript (Frontend Contracts)

### `CreateAlertConfigRequest`

```typescript
export interface CreateAlertConfigRequest {
  name: string;
  category: 'RECEIVING' | 'INVENTORY' | 'QUALITY' | 'PICKING' | 'SHIPPING' | 'USERS' | 'SYSTEM';
  event: 'WAIT_TIME_EXCEEDED' | 'LOW_INVENTORY' | 'LOT_EXPIRATION' | 'ORDER_DELAYED' | 'INVENTORY_DISCREPANCY' | 'UNAUTHORIZED_ACCESS' | 'SYSTEM_ERROR';
  priority: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'ACTIVE' | 'INACTIVE';
  channels: ('SYSTEM' | 'PUSH')[];
  recipients: ('OPERATOR' | 'SUPERVISOR' | 'MANAGER' | 'CONTROL_DESK' | 'CLIENT' | 'ADMIN')[];
  condition: 'GREATER_THAN' | 'LESS_THAN' | 'EQUAL' | 'GREATER_OR_EQUAL' | 'LESS_OR_EQUAL';
  value: number;
  unit: 'MINUTES' | 'HOURS' | 'DAYS' | 'PERCENTAGE' | 'UNITS' | 'PIECES' | 'PALLETS';
  recurrence: 'NEVER' | 'EVERY_15_MIN' | 'EVERY_30_MIN' | 'EVERY_HOUR' | 'DAILY';
  escalation: 'NONE' | 'AFTER_15_MIN' | 'AFTER_30_MIN' | 'AFTER_60_MIN';
  messageTemplate: string;
  description?: string;
}
```

### `UpdateAlertConfigRequest`

```typescript
export interface UpdateAlertConfigRequest {
  id?: string;                        // Requerido si el BE valida la presencia en payload
  name?: string;
  category?: 'RECEIVING' | 'INVENTORY' | 'QUALITY' | 'PICKING' | 'SHIPPING' | 'USERS' | 'SYSTEM';
  event?: 'WAIT_TIME_EXCEEDED' | 'LOW_INVENTORY' | 'LOT_EXPIRATION' | 'ORDER_DELAYED' | 'INVENTORY_DISCREPANCY' | 'UNAUTHORIZED_ACCESS' | 'SYSTEM_ERROR';
  priority?: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status?: 'ACTIVE' | 'INACTIVE';
  channels?: ('SYSTEM' | 'PUSH')[];
  recipients?: ('OPERATOR' | 'SUPERVISOR' | 'MANAGER' | 'CONTROL_DESK' | 'CLIENT' | 'ADMIN')[];
  condition?: 'GREATER_THAN' | 'LESS_THAN' | 'EQUAL' | 'GREATER_OR_EQUAL' | 'LESS_OR_EQUAL';
  value?: number;
  unit?: 'MINUTES' | 'HOURS' | 'DAYS' | 'PERCENTAGE' | 'UNITS' | 'PIECES' | 'PALLETS';
  recurrence?: 'NEVER' | 'EVERY_15_MIN' | 'EVERY_30_MIN' | 'EVERY_HOUR' | 'DAILY';
  escalation?: 'NONE' | 'AFTER_15_MIN' | 'AFTER_30_MIN' | 'AFTER_60_MIN';
  messageTemplate?: string;
  description?: string;
}
```

### `UpdateAlertConfigStatusRequest`

```typescript
export interface UpdateAlertConfigStatusRequest {
  status: 'ACTIVE' | 'INACTIVE';
}
```

### `AlertConfigResponse`

```typescript
export interface AlertConfigResponse {
  id: string;
  organizationId: string;
  name: string;
  category: 'RECEIVING' | 'INVENTORY' | 'QUALITY' | 'PICKING' | 'SHIPPING' | 'USERS' | 'SYSTEM';
  event: string;
  priority: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'ACTIVE' | 'INACTIVE';
  channels: ('SYSTEM' | 'PUSH')[];
  recipients: ('OPERATOR' | 'SUPERVISOR' | 'MANAGER' | 'CONTROL_DESK' | 'CLIENT' | 'ADMIN')[];
  condition: string;
  value: number;
  unit: string;
  recurrence: string;
  escalation: string;
  messageTemplate: string;
  description: string | null;
  createdAt: string;                  // ISO-8601 UTC
  updatedAt: string;                  // ISO-8601 UTC
  createdBy?: string;
  updatedBy?: string;
}
```

### `AlertConfigAuditResponse` & `AlertConfigAuditDetail`

```typescript
export interface AlertConfigAuditDetail {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface AlertConfigAuditResponse {
  logId: string;
  action: string;
  username: string;
  ipAddress?: string;
  createdAt: string;                  // ISO-8601 UTC
  changes: AlertConfigAuditDetail[];
}
```

---

## 4. Ejemplos de Solicitud y Respuesta (Payloads Reales)

### 4.1 Crear Regla (`POST /api/v1/alerts-config`)

**Request:**
```json
{
  "name": "Tiempo Excedido en Rampa de Recepción",
  "category": "RECEIVING",
  "event": "WAIT_TIME_EXCEEDED",
  "priority": "HIGH",
  "status": "ACTIVE",
  "channels": ["SYSTEM", "PUSH"],
  "recipients": ["SUPERVISOR", "MANAGER"],
  "condition": "GREATER_THAN",
  "value": 30.00,
  "unit": "MINUTES",
  "recurrence": "EVERY_15_MIN",
  "escalation": "AFTER_15_MIN",
  "messageTemplate": "El camión {{truck}} en la Rampa {{ramp}} ha superado los {{value}} minutos de espera.",
  "description": "Alerta crítica para evitar cuellos de botella en la descarga de andenes"
}
```

**Response (HTTP 201 Created):**
```json
{
  "success": true,
  "message": "Regla de alerta creada exitosamente",
  "data": {
    "id": "e13f0907-9fa5-4bdf-87db-2eb5e7683961",
    "organizationId": "a53f0907-9fa5-4bdf-87db-2eb5e7683935",
    "name": "Tiempo Excedido en Rampa de Recepción",
    "category": "RECEIVING",
    "event": "WAIT_TIME_EXCEEDED",
    "priority": "HIGH",
    "status": "ACTIVE",
    "channels": ["SYSTEM", "PUSH"],
    "recipients": ["SUPERVISOR", "MANAGER"],
    "condition": "GREATER_THAN",
    "value": 30.00,
    "unit": "MINUTES",
    "recurrence": "EVERY_15_MIN",
    "escalation": "AFTER_15_MIN",
    "messageTemplate": "El camión {{truck}} en la Rampa {{ramp}} ha superado los {{value}} minutos de espera.",
    "description": "Alerta crítica para evitar cuellos de botella en la descarga de andenes",
    "createdAt": "2026-08-01T19:20:00Z",
    "updatedAt": "2026-08-01T19:20:00Z",
    "createdBy": "enrique"
  }
}
```

---

### 4.2 Cambiar Estatus (`PATCH /api/v1/alerts-config/{id}/status`)

**Request:**
```json
{
  "status": "INACTIVE"
}
```

**Response (HTTP 200 OK):**
```json
{
  "success": true,
  "message": "Estatus de la regla de alerta actualizado a INACTIVE",
  "data": {
    "id": "e13f0907-9fa5-4bdf-87db-2eb5e7683961",
    "status": "INACTIVE",
    "updatedAt": "2026-08-01T19:22:00Z"
  }
}
```

---

### 4.3 Consultar Historial de Auditoría (`GET /api/v1/alerts-config/{id}/audit`)

**Response (HTTP 200 OK):**
```json
{
  "success": true,
  "message": "Historial de auditoría de la regla de alerta recuperado",
  "data": [
    {
      "logId": "a98f0907-9fa5-4bdf-87db-2eb5e7683999",
      "action": "ALERT_CONFIG_UPDATED",
      "username": "enrique",
      "ipAddress": "192.168.1.50",
      "createdAt": "2026-08-01T19:21:00Z",
      "changes": [
        {
          "field": "value",
          "oldValue": "20.00",
          "newValue": "30.00"
        },
        {
          "field": "priority",
          "oldValue": "MEDIUM",
          "newValue": "HIGH"
        }
      ]
    }
  ]
}
```

---

## 5. Respuestas de Error Estándar (`ApiResponse<T>`)

### 400 Bad Request (Error de Validación DTO):
```json
{
  "success": false,
  "message": "Error de validación en la solicitud",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      "El valor del umbral debe ser mayor a 0",
      "Debe especificar al menos un canal de notificación",
      "Debe especificar al menos un destinatario"
    ]
  }
}
```

### 409 Conflict (Nombre Duplicado en la Organización):
```json
{
  "success": false,
  "message": "Ya existe una regla de alerta activa con el nombre 'Tiempo Excedido en Rampa de Recepción' en tu organización",
  "error": {
    "code": "DUPLICATE_NAME"
  }
}
```

### 404 Not Found:
```json
{
  "success": false,
  "message": "No se encontró la regla de alerta solicitada o fue eliminada",
  "error": {
    "code": "NOT_FOUND"
  }
}
```

### 403 Forbidden:
```json
{
  "success": false,
  "message": "No tiene permisos para modificar la configuración de alertas (requiere ALERTS_WRITE)",
  "error": {
    "code": "FORBIDDEN"
  }
}
```

---

## 6. Reglas de Negocio & Quirks de Integración (FE / BE)

1. **Aislamiento Multi-Tenant (RLS Kernel):** El Backend resuelve `organizationId` automáticamente del token JWT del usuario. El Frontend **no envía** `organizationId` en los payloads de `POST` ni `PUT`.
2. **Canales Habilitados:** En esta versión, el arreglo `channels` solo permite los valores `'SYSTEM'` y `'PUSH'`. Si el usuario envía `'EMAIL'` o `'SMS'`, el Backend retornará `400 Bad Request`.
3. **Unicidad por Organización:** No pueden existir dos reglas con el mismo nombre (`name`) dentro del mismo `organizationId`. El Backend responde `409 Conflict` con el código `DUPLICATE_NAME`.
4. **Notificaciones Toast Globales (Zero Duplicación):** Todas las respuestas exitosas y errores del Backend deben notificarse en Frontend utilizando **exclusivamente `ToastService`** (`toast.success` / `toast.error`). Queda prohibido incluir banners inline estáticos en el template HTML.
5. **Auditoría con Estructura `changes`:** El endpoint `GET /alerts-config/{id}/audit` devuelve un arreglo con el atributo `changes: [{ field, oldValue, newValue }]`, homologado con el componente de la línea de tiempo de auditoría.
