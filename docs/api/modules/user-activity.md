# API Contract — Módulo: Reporte de Actividad por Usuario (HU-146)

**Controller Principal:** `AuditController.java` + `UserController.java`  
**Base paths:** `/api/v1/audit` y `/api/v1/users`  
**RBAC Module (FE):** `user-activity`  
**Permission base:** `AUDIT_READ` o rol `OPERATIONS_MANAGER`  
**ID Type:** `UUID` (string en TypeScript)

---

## 🎯 Resumen de Servicios Requeridos por la Pantalla

Para llenar toda la funcionalidad del **Reporte de Actividad por Usuario** (KPIs, Tabla de Actividad, Filtro por Usuario y Detalle), la pantalla consume **3 endpoints del Backend**:

| Servicio | Método | Ruta | Propósito en la UI |
|---|---|---|---|
| **Actividad por Usuario** | `GET` | `/api/v1/audit/user-activity` | **Servicio Principal**: Tabla cronológica y filtros (fecha, usuario, acción) |
| **Sesiones Activas** | `GET` | `/api/v1/audit/active-sessions` | **KPI Card**: Conteo de usuarios/sesiones activas en tiempo real |
| **Catálogo de Usuarios** | `GET` | `/api/v1/users` | **Filtro UI**: Poblar el selector/combo "Filtrar por usuario" |

---

## 1. Endpoints Detallados

### 1.1 Endpoint Principal: `GET /api/v1/audit/user-activity`

Recupera el historial de actividad de los usuarios con filtros dinámicos opcionales.

* **Permiso requerido:** `AUDIT_READ` o rol `OPERATIONS_MANAGER`
* **Query Parameters (Todos Opcionales):**

| Parámetro | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| `userId` | `UUID` | ID del usuario específico sobre el cual consultar actividad | `?userId=98765432-10fe-dcba-0987-654321fedcba` |
| `action` | `String` | Acción realizada (`LOGIN`, `LOGOUT`, `CREATE`, `UPDATE`, `DELETE`, `STATUS_CHANGE`) | `?action=LOGIN` |
| `fromDate` | `ISO-8601` | Fecha/hora inicial (UTC) | `?fromDate=2026-07-01T00:00:00Z` |
| `toDate` | `ISO-8601` | Fecha/hora final (UTC) | `?toDate=2026-07-31T23:59:59Z` |

---

### 1.2 Endpoint Auxiliar: `GET /api/v1/audit/active-sessions`

Recupera el listado de usuarios con sesión activa (logueados en las últimas 24 horas y sin logout).

* **Permiso requerido:** `AUDIT_READ` o rol `OPERATIONS_MANAGER`
* **Query Parameters (Opcionales):** `organizationId`, `branchId`

---

### 1.3 Endpoint Auxiliar: `GET /api/v1/users`

Recupera la lista de todos los usuarios registrados para llenar el selector de filtros en la pantalla.

* **Permiso requerido:** `USERS_READ` o `AUDIT_READ`

---

## 2. Request & Response DTOs → TypeScript

### `UserActivityFilterParams` (Filtros en el servicio Angular)

```typescript
export interface UserActivityFilterParams {
  userId?: string;     // UUID opcional
  action?: string;     // 'LOGIN' | 'CREATE' | 'UPDATE' | 'DELETE' | etc.
  fromDate?: string;   // ISO 8601 (ej. '2026-07-01T00:00:00Z')
  toDate?: string;     // ISO 8601
}
```

### `UserActivityLogResponse` (Item de la tabla)

```typescript
export interface UserActivityDetail {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface UserActivityLogResponse {
  logId: string;       // UUID
  userId: string;      // UUID
  username: string;
  action: string;      // 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | etc.
  entityType: string;  // 'AUTH' | 'USER' | 'CARRIER' | 'LOCATION' | etc.
  entityId: string;    // UUID de la entidad afectada
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;   // ISO 8601
  details: UserActivityDetail[]; // Diff de campos para el Drawer lateral
}
```

### `ActiveSessionResponse` (Para KPI Card de Sesiones Activas)

```typescript
export interface ActiveSessionResponse {
  userId: string;
  username: string;
  email: string;
  organizationName: string;
  branchName: string;
  loginAt: string;       // ISO 8601
  lastActivity: string;
  ipAddress: string | null;
}
```

---

## 3. Enums & Tipos de Acción

```typescript
export enum AuditAction {
  LOGIN         = 'LOGIN',
  LOGOUT        = 'LOGOUT',
  CREATE        = 'CREATE',
  UPDATE        = 'UPDATE',
  DELETE        = 'DELETE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  PASSWORD_RESET= 'PASSWORD_RESET'
}

export enum AuditEntityType {
  AUTH         = 'AUTH',
  USER         = 'USER',
  CARRIER      = 'CARRIER',
  LOCATION     = 'LOCATION',
  BRANCH       = 'BRANCH',
  ORGANIZATION = 'ORGANIZATION',
  CLIENT       = 'CLIENT',
  ROLE         = 'ROLE',
  PERMISSION   = 'PERMISSION',
  SUPPLIER     = 'SUPPLIER',
  SKU          = 'SKU',
  SECTION      = 'SECTION'
}
```

---

## 4. ⚠️ Quirks & Reglas del Backend (No Obvias)

1. **Fechas ISO 8601:** Los query params `fromDate` y `toDate` deben enviarse formateados en UTC completo (`yyyy-MM-ddTHH:mm:ssZ`).
2. **`details` Array:** El campo `details` contiene la lista de modificaciones de campos. Si la acción es `LOGIN` o `LOGOUT`, el campo `fieldName` suele ser `"status"` con `newValue: "SUCCESS"`.
3. **Paginación vs Array:** El endpoint devuelve un `data: UserActivityLogResponse[]` (array envuelto en `ApiResponse<T>`).
4. **Fallback si no hay `userId`:** Si no se pasa `userId`, el endpoint devuelve la actividad combinada de **todos** los usuarios de la organización.

---

## 5. TypeScript Service Pattern (Servicio Angular)

```typescript
// user-activity.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  ApiResponse,
  UserActivityLogResponse,
  UserActivityFilterParams,
  ActiveSessionResponse
} from './user-activity.models';

@Injectable({ providedIn: 'root' })
export class UserActivityService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1`;

  /**
   * Consulta el historial de actividad por usuario con filtros opcionales.
   * Endpoint: GET /api/v1/audit/user-activity
   */
  getUserActivityLogs(filters: UserActivityFilterParams): Observable<UserActivityLogResponse[]> {
    let params = new HttpParams();

    if (filters.userId)   params = params.set('userId', filters.userId);
    if (filters.action)   params = params.set('action', filters.action);
    if (filters.fromDate) params = params.set('fromDate', filters.fromDate);
    if (filters.toDate)   params = params.set('toDate', filters.toDate);

    return this.http
      .get<ApiResponse<UserActivityLogResponse[]>>(`${this.baseUrl}/audit/user-activity`, { params })
      .pipe(map(res => res.data));
  }

  /**
   * Consulta las sesiones activas en las últimas 24h.
   * Endpoint: GET /api/v1/audit/active-sessions
   */
  getActiveSessions(): Observable<ActiveSessionResponse[]> {
    return this.http
      .get<ApiResponse<ActiveSessionResponse[]>>(`${this.baseUrl}/audit/active-sessions`)
      .pipe(map(res => res.data));
  }
}
```

---

## 6. KPI Cards Sugeridas para el Header

| KPI Card | Fuente de datos | Ícono Material | Color Accent |
|---|---|---|---|
| **Total Eventos** | `logs.length` | `manage_search` | Navy |
| **Operaciones de Escritura** | `filter(action IN ['CREATE','UPDATE','DELETE'])` | `edit_note` | Gold |
| **Sesiones Activas** | `activeSessions.length` | `sensors` | Success (Verde) |
| **Logins / Autenticaciones** | `filter(action === 'LOGIN')` | `badge` | Info (Azul) |
