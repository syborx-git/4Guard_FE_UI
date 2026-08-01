# API Contract — Módulo: Configuración de Turnos y Horarios (HU-140)

**Controller Principal:** `ShiftController.java`  
**Base path:** `/api/v1/shifts`  
**Formato General de Respuesta:** `ApiResponse<T>`  
**RBAC Module (FE):** `shifts`  
**Permission base:** `SHIFTS_CREATE/READ/UPDATE/STATUS_CHANGE/DELETE` o rol `OPERATIONS_MANAGER`  
**ID Type:** `UUID` (string en TypeScript)

---

## 🎯 Resumen de Servicios Requeridos por la Pantalla

Para cubrir la funcionalidad completa del módulo **Configuración de Turnos y Horarios** (Directorio, Master-Detail, KPIs, Formulario Reactivo, Auditoría y Detección de Conflictos), la pantalla consume los siguientes **7 endpoints del Backend**:

| Servicio | Método | Ruta | Permiso RBAC | Propósito en la UI |
|---|---|---|---|---|
| **Crear Turno** | `POST` | `/api/v1/shifts` | `SHIFTS_CREATE` / `OPERATIONS_MANAGER` | Registro de un nuevo turno operativo |
| **Lista de Turnos** | `GET` | `/api/v1/shifts` | `SHIFTS_READ` / `OPERATIONS_MANAGER` | Directorio ordenado cronológicamente por `startTime` |
| **Detalle de Turno** | `GET` | `/api/v1/shifts/{id}` | `SHIFTS_READ` / `OPERATIONS_MANAGER` | Carga de datos detallados de un turno |
| **Actualizar Turno** | `PUT` | `/api/v1/shifts/{id}` | `SHIFTS_UPDATE` / `OPERATIONS_MANAGER` | Edición completa de parámetros del turno |
| **Cambio de Estatus** | `PATCH` | `/api/v1/shifts/{id}/status` | `SHIFTS_STATUS_CHANGE` / `OPERATIONS_MANAGER` | Activar o Desactivar turno (Sin borrado físico) |
| **Eliminar Turno** | `DELETE` | `/api/v1/shifts/{id}` | `SHIFTS_DELETE` / `OPERATIONS_MANAGER` | Soft Delete (Archivado lógico `isDeleted = true`) |
| **Historial Auditoría** | `GET` | `/api/v1/shifts/{id}/audit` | `SHIFTS_READ` / `OPERATIONS_MANAGER` | Historial de modificaciones y trazabilidad de cambios |

---

## 1. Endpoints Detallados

### 1.1 Registrar Nuevo Turno (CREATE)

* **Método:** `POST`
* **Ruta:** `/api/v1/shifts`
* **Permiso:** `SHIFTS_CREATE` o `OPERATIONS_MANAGER`

#### Request Body (`CreateShiftRequest`):
```json
{
  "code": "TRN-MAT-01",
  "name": "Turno Matutino CDMX",
  "description": "Jornada matutina estándar de almacén",
  "startTime": "06:00:00",
  "endTime": "14:00:00",
  "restBreakMinutes": 30,
  "toleranceMinutes": 10,
  "scopeType": "BRANCH",
  "branchId": "b73f0907-9fa5-4bdf-87db-2eb5e7683936",
  "warehouseSectionId": null,
  "operatingDays": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
}
```

#### Respuesta Éxito (HTTP 200 OK):
```json
{
  "success": true,
  "message": "Turno creado con éxito",
  "data": {
    "id": "f13f0907-9fa5-4bdf-87db-2eb5e7683951",
    "code": "TRN-MAT-01",
    "name": "Turno Matutino CDMX",
    "description": "Jornada matutina estándar de almacén",
    "startTime": "06:00:00",
    "endTime": "14:00:00",
    "restBreakMinutes": 30,
    "toleranceMinutes": 10,
    "isOvernight": false,
    "netDurationMinutes": 450,
    "status": "ACTIVE",
    "scopeType": "BRANCH",
    "branchId": "b73f0907-9fa5-4bdf-87db-2eb5e7683936",
    "branchName": "CENTRO DE DISTRIBUCION CDMX",
    "warehouseSectionId": null,
    "warehouseSectionName": null,
    "operatingDays": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"],
    "isDeleted": false,
    "version": 1,
    "createdAt": "2026-08-01T16:00:00Z",
    "createdBy": "enrique"
  },
  "timestamp": "2026-08-01T16:00:00"
}
```

#### Respuesta Error (HTTP 400 Bad Request — Solapamiento o Código Duplicado):
```json
{
  "success": false,
  "message": "El turno genera solapamiento de horarios/días con los siguientes turnos activos: TRN-VES-01",
  "timestamp": "2026-08-01T16:00:00"
}
```

---

### 1.2 Consultar Lista de Turnos con Filtros (READ LIST)

* **Método:** `GET`
* **Ruta:** `/api/v1/shifts`
* **Permiso:** `SHIFTS_READ` o `OPERATIONS_MANAGER`
* **Query Parameters (Opcionales):**

| Parámetro | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| `branchId` | `UUID` | Filtra turnos aplicables a una sucursal específica | `?branchId=b73f0907-9fa5-4bdf-87db-2eb5e7683936` |
| `warehouseSectionId` | `UUID` | Filtra turnos de una sección de almacén específica | `?warehouseSectionId=a11f0907-9fa5-4bdf-87db-2eb5e7683900` |
| `status` | `String` | Estado del turno (`ACTIVE`, `INACTIVE`) | `?status=ACTIVE` |
| `scopeType` | `String` | Ámbito (`GLOBAL`, `BRANCH`, `WAREHOUSE_SECTION`) | `?scopeType=BRANCH` |
| `dayOfWeek` | `String` | Filtra turnos activos en un día (`MONDAY`, `TUESDAY`, etc.) | `?dayOfWeek=MONDAY` |
| `search` | `String` | Búsqueda por código o nombre | `?search=matutino` |

#### Respuesta Éxito (HTTP 200 OK):
```json
{
  "success": true,
  "message": "Lista de turnos recuperada con éxito",
  "data": [
    {
      "id": "f13f0907-9fa5-4bdf-87db-2eb5e7683951",
      "code": "TRN-MAT-01",
      "name": "Turno Matutino CDMX",
      "startTime": "06:00:00",
      "endTime": "14:00:00",
      "isOvernight": false,
      "netDurationMinutes": 450,
      "status": "ACTIVE",
      "scopeType": "BRANCH",
      "branchId": "b73f0907-9fa5-4bdf-87db-2eb5e7683936",
      "branchName": "CENTRO DE DISTRIBUCION CDMX",
      "operatingDays": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
    }
  ],
  "timestamp": "2026-08-01T16:00:00"
}
```

---

### 1.3 Obtener Detalle de Turno por ID (READ ONE)

* **Método:** `GET`
* **Ruta:** `/api/v1/shifts/{id}`
* **Permiso:** `SHIFTS_READ` o `OPERATIONS_MANAGER`

#### Respuesta Error (HTTP 404 Not Found):
```json
{
  "success": false,
  "message": "Turno no encontrado con ID: f13f0907-9fa5-4bdf-87db-2eb5e7683999",
  "timestamp": "2026-08-01T16:00:00"
}
```

---

### 1.4 Actualizar Turno Completo (UPDATE)

* **Método:** `PUT`
* **Ruta:** `/api/v1/shifts/{id}`
* **Permiso:** `SHIFTS_UPDATE` o `OPERATIONS_MANAGER`
* **Request Body:** Mismos campos que `CreateShiftRequest`.
* **Respuesta Éxito:** Retorna `ApiResponse<ShiftResponse>` actualizado.

---

### 1.5 Cambiar Estado del Turno (PATCH STATUS)

* **Método:** `PATCH`
* **Ruta:** `/api/v1/shifts/{id}/status`
* **Permiso:** `SHIFTS_STATUS_CHANGE` o `OPERATIONS_MANAGER`

#### Request Body (`UpdateShiftStatusRequest`):
```json
{
  "status": "INACTIVE"
}
```

#### Respuesta Éxito (HTTP 200 OK):
```json
{
  "success": true,
  "message": "Estatus de turno actualizado con éxito",
  "data": {
    "id": "f13f0907-9fa5-4bdf-87db-2eb5e7683951",
    "code": "TRN-MAT-01",
    "status": "INACTIVE"
  },
  "timestamp": "2026-08-01T16:00:00"
}
```

---

### 1.6 Eliminar Turno — Soft Delete (DELETE)

* **Método:** `DELETE`
* **Ruta:** `/api/v1/shifts/{id}`
* **Permiso:** `SHIFTS_DELETE` o `OPERATIONS_MANAGER`

#### Respuesta Éxito (HTTP 200 OK):
```json
{
  "success": true,
  "message": "Turno eliminado con éxito",
  "timestamp": "2026-08-01T16:00:00"
}
```

---

### 1.7 Historial de Auditoría del Turno (AUDIT LOGS)

* **Método:** `GET`
* **Ruta:** `/api/v1/shifts/{id}/audit`
* **Permiso:** `SHIFTS_READ` o `OPERATIONS_MANAGER`

#### Respuesta Éxito (HTTP 200 OK):
```json
{
  "success": true,
  "message": "Historial de auditoría recuperado con éxito",
  "data": [
    {
      "logId": "7a9f0907-9fa5-4bdf-87db-2eb5e7683901",
      "action": "SHIFT_STATUS_UPDATED",
      "username": "enrique",
      "createdAt": "2026-08-01T16:05:00Z",
      "details": [
        {
          "fieldName": "status",
          "oldValue": "ACTIVE",
          "newValue": "INACTIVE"
        }
      ]
    }
  ],
  "timestamp": "2026-08-01T16:05:00"
}
```

---

## 2. Request & Response DTOs → TypeScript

```typescript
export type OperatingDay =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export type ShiftStatus = 'ACTIVE' | 'INACTIVE';
export type ScopeType = 'GLOBAL' | 'BRANCH' | 'WAREHOUSE_SECTION';

export interface CreateShiftRequest {
  code: string;
  name: string;
  description?: string;
  startTime: string; // "HH:mm:ss" o "HH:mm"
  endTime: string;   // "HH:mm:ss" o "HH:mm"
  restBreakMinutes?: number;
  toleranceMinutes?: number;
  scopeType: ScopeType;
  branchId?: string | null;
  warehouseSectionId?: string | null;
  operatingDays: OperatingDay[];
}

export interface UpdateShiftRequest extends CreateShiftRequest {}

export interface UpdateShiftStatusRequest {
  status: ShiftStatus;
}

export interface ShiftResponse {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  restBreakMinutes: number;
  toleranceMinutes: number;
  isOvernight: boolean;
  netDurationMinutes: number;
  status: ShiftStatus;
  scopeType: ScopeType;
  branchId?: string | null;
  branchName?: string | null;
  warehouseSectionId?: string | null;
  warehouseSectionName?: string | null;
  operatingDays: OperatingDay[];
  isDeleted: boolean;
  version: number;
  createdAt: string;
  createdBy: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface ShiftSummaryResponse {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  isOvernight: boolean;
  netDurationMinutes: number;
  status: ShiftStatus;
  scopeType: ScopeType;
  branchId?: string | null;
  branchName?: string | null;
  operatingDays: OperatingDay[];
}

export interface ShiftAuditLogDetail {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface ShiftAuditLogResponse {
  logId: string;
  action: string;
  username: string;
  createdAt: string;
  details: ShiftAuditLogDetail[];
}

export interface ShiftFilterParams {
  branchId?: string;
  warehouseSectionId?: string;
  status?: ShiftStatus;
  scopeType?: ScopeType;
  dayOfWeek?: OperatingDay;
  search?: string;
}
```

---

## 3. Criterios de Aceptación (HU-140) — Metodología SDD

### CA-01: Layout Master-Detail Split View Homologado
* **Dado** que el usuario accede a `/shifts`.
* **Cuando** carga la pantalla.
* **Entonces** debe visualizar un layout Split View de 2 columnas (35% directorio a la izquierda y 65% formulario interactivo a la derecha).
* **Y** la lista izquierda debe mostrar los turnos ordenados cronológicamente por `startTime`.

### CA-02: Creación de Turno & Validación de Unicidad y Solapamiento
* **Dado** que el administrador llena el formulario de registro de turno.
* **Cuando** ingresa un código ya existente o un rango de horas/días que se solapa con un turno activo de la misma sucursal.
* **Entonces** el Backend debe responder con error `HTTP 400 Bad Request` indicando el turno en conflicto.
* **Y** la interfaz debe destacar visualmente el mensaje de error mediante un toast informativo y alert contextual.

### CA-03: Soporte de Jornadas Nocturnas (Overnight Shifts)
* **Dado** que un turno tiene una hora de fin menor o igual a la de inicio (ej. `22:00` a `06:00`).
* **Cuando** el usuario ingresa los horarios.
* **Entonces** el sistema debe marcar `isOvernight = true`, calcular la duración cruzando la medianoche y mostrar un badge distintivo `"Cruza medianoche"` en la interfaz.

### CA-04: Selección de Días Operativos Requerida
* **Dado** el selector interactivo de 7 días (L, M, X, J, V, S, D).
* **Cuando** el usuario intenta guardar sin seleccionar al menos un día.
* **Entonces** el formulario debe marcarse como inválido con el error `"Debe seleccionar al menos un día operativo"`.

### CA-05: Gestión de Estado y Soft Delete
* **Dado** un turno activo.
* **Cuando** el usuario presiona "Desactivar" o "Eliminar".
* **Entonces** la desactivación utiliza `PATCH /api/v1/shifts/{id}/status` y la eliminación ejecuta un `DELETE /api/v1/shifts/{id}` que realiza un archivado lógico (`isDeleted = true`) preservando el historial de auditoría.

### CA-06: Seguridad & RBAC (Read-Only Guard)
* **Dado** un usuario con rol de lectura como `SHIFT_LEADER`.
* **Cuando** navega a la pantalla de turnos.
* **Entonces** puede consultar todo el directorio, pero los botones de crear, guardar y cambiar estatus permanecen deshabilitados con una nota aclaratoria.

### CA-07: Prevención de Pérdida de Cambios no Guardados
* **Dado** que el usuario ha modificado campos en el formulario (`dirty = true`).
* **Cuando** intenta seleccionar otro turno o presiona "Nuevo Turno".
* **Entonces** se debe desplegar un modal de confirmación impidiendo la pérdida accidental de datos.

---

## 4. ⚠️ Quirks & Reglas del Backend (No Obvias)

1. **Formato de Horas:** El Backend acepta y devuelve las horas en formato `HH:mm:ss` (ej: `"06:00:00"`). El Frontend Angular debe formatear adecuadamente los inputs de tipo `time` (`HH:mm`).
2. **Duración Neta:** El campo `netDurationMinutes` devuelto por el BE ya resta el tiempo de descanso `restBreakMinutes`.
3. **Ordenamiento Cronológico Obligatorio:** Toda consulta `GET /api/v1/shifts` devuelve los turnos ordenados cronológicamente por `startTime`.
4. **Soft Delete:** El endpoint `DELETE /api/v1/shifts/{id}` no borra físicamente el registro de la BD PostgreSQL, garantizando la integridad de auditoría en caso de referencias operativas pasadas.

---

## 5. TypeScript Service Pattern (Servicio Angular)

```typescript
// shift.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../../core/models/api-response.model';
import {
  ShiftResponse,
  ShiftSummaryResponse,
  CreateShiftRequest,
  UpdateShiftRequest,
  UpdateShiftStatusRequest,
  ShiftFilterParams,
  ShiftAuditLogResponse
} from '../models/shift.model';

@Injectable({ providedIn: 'root' })
export class ShiftService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1/shifts`;

  public readonly shifts = signal<ShiftSummaryResponse[]>([]);
  public readonly loading = signal<boolean>(false);
  public readonly selectedShiftId = signal<string | null>(null);

  /** Carga la lista de turnos desde el API Backend */
  public loadShifts(filters?: ShiftFilterParams): Observable<ShiftSummaryResponse[]> {
    this.loading.set(true);
    let params = new HttpParams();

    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    if (filters?.warehouseSectionId) params = params.set('warehouseSectionId', filters.warehouseSectionId);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.scopeType) params = params.set('scopeType', filters.scopeType);
    if (filters?.dayOfWeek) params = params.set('dayOfWeek', filters.dayOfWeek);
    if (filters?.search) params = params.set('search', filters.search);

    return this.http.get<ApiResponse<ShiftSummaryResponse[]>>(this.baseUrl, { params }).pipe(
      map(res => res.data),
      tap(data => {
        this.shifts.set(data);
        this.loading.set(false);
      })
    );
  }

  /** Registra un nuevo turno */
  public createShift(request: CreateShiftRequest): Observable<ShiftResponse> {
    return this.http.post<ApiResponse<ShiftResponse>>(this.baseUrl, request).pipe(
      map(res => res.data)
    );
  }

  /** Actualiza un turno existente */
  public updateShift(id: string, request: UpdateShiftRequest): Observable<ShiftResponse> {
    return this.http.put<ApiResponse<ShiftResponse>>(`${this.baseUrl}/${id}`, request).pipe(
      map(res => res.data)
    );
  }

  /** Cambia el estado (ACTIVE / INACTIVE) */
  public updateStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Observable<any> {
    const body: UpdateShiftStatusRequest = { status };
    return this.http.patch<ApiResponse<any>>(`${this.baseUrl}/${id}/status`, body).pipe(
      map(res => res.data)
    );
  }

  /** Elimina lógicamente un turno */
  public deleteShift(id: string): Observable<any> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/${id}`).pipe(
      map(res => res.data)
    );
  }

  /** Consulta el historial de auditoría de un turno */
  public getAuditLogs(id: string): Observable<ShiftAuditLogResponse[]> {
    return this.http.get<ApiResponse<ShiftAuditLogResponse[]>>(`${this.baseUrl}/${id}/audit`).pipe(
      map(res => res.data)
    );
  }
}
```

---

## 6. KPI Cards Sugeridas para el Header

| KPI Card | Fuente de datos | Ícono Material | Color Accent |
|---|---|---|---|
| **Total Turnos** | `shifts.length` | `schedule` | Primary (Azul WMS) |
| **Turnos Activos** | `shifts.filter(s => s.status === 'ACTIVE').length` | `check_circle` | Success (Verde) |
| **Conflictos de Solapamiento** | Conteo de turnos solapados | `warning` | Warning (Naranja / Rojo) |
| **Jornadas Nocturnas** | `shifts.filter(s => s.isOvernight).length` | `bedtime` | Purple / Dark |
