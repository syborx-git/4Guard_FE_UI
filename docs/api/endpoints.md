# 4GUARD WMS — Contrato de API con Backend

> **Backend:** `4Guard_BEAPI` (Java Spring Boot)  
> **Autenticación:** JWT Bearer Token  
> **Base URL Dev:** `http://localhost:8080/api`

---

## Autenticación

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin@4guard.mx",
  "password": "***"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "ADMIN",
    "changePasswordRequired": false
  }
}
```

```http
POST /api/auth/refresh
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/verify-otp
POST /api/auth/reset-password
```

---

## Interceptor JWT

```typescript
// AuthInterceptor adjunta el token automáticamente
Authorization: Bearer <token>
```

---

## Endpoints por Módulo

### Usuarios y Seguridad
```http
GET    /api/users
POST   /api/users
PUT    /api/users/{id}
DELETE /api/users/{id}
GET    /api/users/{id}/sessions
DELETE /api/users/{id}/sessions/{sessionId}
```

### Transportistas (HU-128)
```http
GET    /api/carriers
POST   /api/carriers
GET    /api/carriers/{id}
PUT    /api/carriers/{id}
PATCH  /api/carriers/{id}/status
DELETE /api/carriers/{id}
```

### Ubicaciones / Layout (HU-127)
```http
GET    /api/locations
POST   /api/locations
GET    /api/locations/{id}
PUT    /api/locations/{id}
PATCH  /api/locations/{id}/status
DELETE /api/locations/{id}
GET    /api/locations/tree          ← Estructura jerárquica (Zona > Pasillo > Bay > Ubicación)
GET    /api/locations/stats         ← KPIs para cabecera
```

### Inventario
```http
GET    /api/inventory
GET    /api/inventory/{id}
POST   /api/inventory/adjustments
GET    /api/inventory/movements
```

### Recepción
```http
GET    /api/receiving/orders
POST   /api/receiving/orders/{id}/receive
GET    /api/receiving/stats
```

### Sucursales
```http
GET    /api/branches
POST   /api/branches
PUT    /api/branches/{id}
```

### Organizaciones
```http
GET    /api/organizations
POST   /api/organizations
PUT    /api/organizations/{id}
```

### Clientes
```http
GET    /api/clients
POST   /api/clients
PUT    /api/clients/{id}
```

### SKUs / Catálogo
```http
GET    /api/skus
POST   /api/skus
PUT    /api/skus/{id}
```

### Roles y Permisos
```http
GET    /api/roles
POST   /api/roles
PUT    /api/roles/{id}
GET    /api/permissions
```

### Proveedores (HU-125)
```http
GET    /api/suppliers
POST   /api/suppliers
PUT    /api/suppliers/{id}
```

### Divisas (HU-148)
```http
GET    /api/currencies
GET    /api/exchange-rates
POST   /api/exchange-rates
```

### Alertas (HU-134)
```http
GET    /api/alerts/config
POST   /api/alerts/config
GET    /api/alerts/active
```

### Licencias (HU-139)
```http
GET    /api/licenses
POST   /api/licenses/activate
```

---

## Patrones de Response

### Success List
```json
{
  "data": [...],
  "total": 42,
  "page": 0,
  "size": 20
}
```

### Success Single
```json
{
  "data": { ... }
}
```

### Error
```json
{
  "error": {
    "code": "CARRIER_NOT_FOUND",
    "message": "El transportista con ID 99 no existe",
    "status": 404
  }
}
```

---

## Configuración de Entornos

```typescript
// environments/environment.ts (desarrollo)
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
};

// environments/environment.prod.ts (producción)
export const environment = {
  production: true,
  apiUrl: 'https://api.4guard.mx/api',
};
```
