# SDD — Frontend: Módulo Turnos y Horarios Operativos (`4Guard_FE_UI`)

> **Módulo:** `shifts`  
> **Repositorio:** `4Guard_FE_UI` · **Ruta:** `apps/admin-console/src/app/features/admin/shifts/`  
> **Framework:** Angular 17+ (Standalone Components, Signals Reactivos, Reactive Forms)  
> **Rol / Permiso:** `WMS_ADMIN`, `OPERATIONS_SUPERVISOR`, `SHIFTS_MANAGE`  
> **Estado:** 🟢 Golden Standard — Integrado con Backend Real (`ShiftController.java`)  

---

## 1. Objetivo y Alcance

Permitir la configuración, administración y monitoreo de los **Turnos Laborales y Ventanas de Operación** en almacén (Turno Matutino, Vespertino, Nocturno, Mixto o Jornadas Especiales 24/7).

Capacidades operativas clave:
1. **Definición de Jornadas:** Configuración de hora de inicio, hora de fin, días laborables de la semana y tolerancia de entrada/salida en minutos.
2. **Intervalos de Descanso (Break Time):** Configuración de ventanas de comida y descansos que pausan temporalmente los cronómetros de productividad de la terminal RF.
3. **Asignación Operativa:** Vinculación directa con montacarguistas y operadores de andén para control de asistencia y asignación automática de tareas de picking/putaway.
4. **Validación Horaria Cruzada:** Prevención reactiva de traslapes en turnos configurados para una misma cuadrilla o andén.

---

## 2. Estructura de Archivos del Módulo

```
apps/admin-console/src/app/features/admin/shifts/
├── shift-management/
│   ├── shift-management.component.ts    ← Componente Standalone reactivo
│   ├── shift-management.component.html  ← Template Split-View con matriz de días
│   └── shift-management.component.css   ← Estilos con tokens Synexia
├── models/
│   └── shift.models.ts                  ← Modelos TypeScript homologados con ShiftResponse.java
└── services/
    └── shift.service.ts                 ← Servicio HTTP REST conectado a /api/v1/shifts
```

---

## 3. Normativa de Homologación de Componentes (ADR-013)

| Componente | Implementación en este Módulo | Requisitos de Cumplimiento |
|---|---|---|
| **Hero Header** | `.hero-header` | Icono navy 52x52px (`schedule`), botón badge `.btn-back-admin` hacia `/admin`, eyebrow `CONFIGURACIÓN OPERATIVA` en monospace dorado, H1 `Turnos y Horarios de Trabajo`. |
| **KPI Cards Grid** | `.carriers-kpi-grid` | Total de Turnos, Turnos Activos (verde), Operadores Asignados (dorado), Horas Promedio Semanales (azul). |
| **Directorio Split-View** | `.carriers-directory` (35%) | Lista de turnos con indicadores de hora (ej. `06:00 - 14:00`), badge de estatus y chips de días activos (L, M, M, J, V, S, D). |
| **Selectores de Hora** | `.form-input` | Inputs tipo `time` (`HH:mm`) con altura de 40px, borde dorado en focus y validación de fin posterior a inicio (o cálculo de cruce de medianoche). |
| **Matriz de Días (Checkbox Chips)**| `.day-selector-group` | Botones chip interactivos para cada día de la semana con estado activo en Prestige Gold. |
| **Modales de Confirmación** | `<fg-confirm-dialog>` | Confirmación modal ante desactivación de turnos con operadores actualmente asignados. |

---

## 4. Estado Reactivo del Componente (`Signals`)

| Signal | Tipo | Descripción |
|---|---|---|
| `shifts` | `WritableSignal<Shift[]>` | Lista completa de turnos obtenida del backend |
| `selectedShift` | `WritableSignal<Shift \| null>` | Turno actualmente abierto en el formulario de edición |
| `activeFilter` | `WritableSignal<string>` | Filtro por estatus de turno (`ALL`, `ACTIVE`, `INACTIVE`) |
| `searchTerm` | `WritableSignal<string>` | Búsqueda por nombre o código de turno |
| `filteredShifts` | `ComputedSignal<Shift[]>` | Lista de turnos reactiva con filtros aplicados |
| `totalShifts` | `ComputedSignal<number>` | KPI: Total de turnos en catálogo |
| `activeShifts` | `ComputedSignal<number>` | KPI: Conteo de turnos activos |
| `isLoading` | `WritableSignal<boolean>` | Indicador de carga de datos inicial |
| `isSaving` | `WritableSignal<boolean>` | Indicador de persistencia en proceso |

---

## 5. Modelos de Datos TypeScript (`shift.models.ts`)

```typescript
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface ShiftBreak {
  id?: string;
  name: string;                    // 'Comida', 'Descanso Matutino'
  startTime: string;               // '12:00'
  endTime: string;                 // '13:00'
  isPaid: boolean;
}

export interface Shift {
  id: string;                      // UUID v4
  organizationId: string;          // UUID v4
  code: string;                    // TUR-01
  name: string;                    // 'Turno Matutino'
  startTime: string;               // '06:00'
  endTime: string;                 // '14:00'
  toleranceMinutes: number;        // 15
  workingDays: DayOfWeek[];
  breaks: ShiftBreak[];
  isActive: boolean;
  assignedOperatorsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShiftRequest {
  name: string;
  startTime: string;
  endTime: string;
  toleranceMinutes: number;
  workingDays: DayOfWeek[];
  breaks: ShiftBreak[];
  isActive: boolean;
}
```

---

## 6. Contrato HTTP REST (`ShiftService`)

| Método | Verbo | Endpoint | Descripción |
|---|---|---|---|
| `getShifts()` | `GET` | `/api/v1/shifts` | Consulta la lista de turnos configurados |
| `getShiftById(id)` | `GET` | `/api/v1/shifts/{id}` | Recupera la definición completa del turno |
| `createShift(dto)` | `POST` | `/api/v1/shifts` | Crea un nuevo turno con validación de horarios |
| `updateShift(id, dto)` | `PUT` | `/api/v1/shifts/{id}` | Modifica horario, descansos y días laborales |
| `toggleShiftStatus(id)` | `PATCH` | `/api/v1/shifts/{id}/toggle` | Alterna entre activo e inactivo |
| `getShiftAudit(id)` | `GET` | `/api/v1/shifts/{id}/audit` | Recupera historial de deltas de auditoría |

---

## 7. Validaciones y Notificaciones

1. **Cálculo de Jornada:** El formulario calcula automáticamente las horas efectivas de trabajo restando la duración acumulada de los descansos no remunerados.
2. **Validación de Cruce de Medianoche:** Se admite que `endTime < startTime` (ej. Turno Nocturno 22:00 a 06:00), marcando automáticamente la bandera de cruce de día.
3. **Notificaciones:** Todo resultado de guardado o cambio de estado se comunica a través de `ToastService`.
