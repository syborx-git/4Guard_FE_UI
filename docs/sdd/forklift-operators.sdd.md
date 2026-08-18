# SDD: Gestión de Montacarguistas — Frontend

> **Módulo:** Admin → Montacarguistas
> **HU:** HU-142 — Gestión de Montacarguistas
> **Versión:** 2.0.0 (Migrado a HTTP Real — ADR-007: Cero Mocks)
> **Estado:** ✅ Implementado
> **Rama:** `catalogo-montacarga-UI`

---

## 1. Descripción del Módulo

Pantalla de administración del catálogo de montacarguistas certificados DC-3. Permite registrar, actualizar, activar/desactivar y eliminar operadores desde el catálogo maestro del WMS.

> **Nota:** Los montacarguistas no son usuarios del sistema. Son referencias operativas para asignar responsables en los movimientos de almacén (Movimientos de Almacén / WarehouseMovements).

---

## 2. Arquitectura Frontend

### Componentes involucrados

| Archivo | Responsabilidad |
|---|---|
| `forklift-operators.component.ts` | Componente principal (Master/Detail Split View) |
| `forklift-operators.component.html` | Plantilla con KPIs, directorio, formulario y modal |
| `forklift-operators.component.css` | Estilos homologados con carriers (Transportistas) |
| `forklift-operator.service.ts` | Servicio HTTP reactivo (Signals) |
| `forklift-operator.models.ts` | Interfaces homologadas con DTOs del Backend |

### Servicios dependientes

| Servicio | Uso |
|---|---|
| `ForkliftOperatorAdminService` | CRUD principal vía REST |
| `ShiftService` | Catálogo de turnos maestro para selector en formulario |
| `WarehouseMovementsService` | Consume `dropdownOperators` reactivamente para andenes |

---

## 3. Estado Reactivo (Angular Signals)

| Signal | Tipo | Descripción |
|---|---|---|
| `operators` | `Signal<ForkliftOperator[]>` | Lista completa cargada del BE |
| `activeOperators` | `computed` | Filtro de `status === 'ACTIVO'` |
| `dropdownOperators` | `computed` | Lista simplificada `{ code, name }` para selectores |
| `loading` | `Signal<boolean>` | Estado de carga de lista |
| `saving` | `Signal<boolean>` | Estado de guardado de formulario |
| `error` | `Signal<string \| null>` | Último mensaje de error del servidor |

---

## 4. Flujos de Usuario

### 4.1 Cargar Catálogo
1. `ngOnInit` → `ForkliftOperatorAdminService.loadOperators(organizationId)`
2. BE: `GET /api/v1/forklift-operators?organizationId=<uuid>`
3. Signal `operators` se actualiza → Vista reactiva se re-renderiza
4. Se selecciona automáticamente el primer operador de la lista

### 4.2 Registrar Montacarguista
1. Usuario click **"Nuevo montacarguista"** → `formMode = 'create'`
2. Completa formulario (firstName, lastNamePaternal, lastNameMaternal, licenseNumberDc3, licenseExpirationDate, shift)
3. Submit → `createOperator(CreateForkliftOperatorRequest)` → `POST /api/v1/forklift-operators`
4. BE genera código `MC-XXX` y calcula `licenseStatus`
5. Signal `operators` actualizado → Operador aparece en lista con código asignado

### 4.3 Editar Montacarguista
1. Usuario selecciona operador → click **"Editar"** → `formMode = 'edit'`
2. Formulario pre-populado con datos actuales
3. Submit → `updateOperator(UpdateForkliftOperatorRequest)` → `PUT /api/v1/forklift-operators/{id}`
4. Signal actualizado reactivamente en lista y detalle

### 4.4 Cambiar Estatus
1. Click **"Cambiar Estatus"** → `toggleOperatorStatus(op)`
2. Detecta estatus actual → envía el contrario
3. `PATCH /api/v1/forklift-operators/{id}/status` con `{ status: 'ACTIVO' | 'INACTIVO' }`
4. Signal `operators` actualizado → Badge de estatus cambia en tiempo real

### 4.5 Eliminar Montacarguista
1. Click **"Eliminar"** → Modal de confirmación
2. Confirm → `deleteOperator(id)` → `DELETE /api/v1/forklift-operators/{id}`
3. BE realiza soft delete (registro permanece en BD)
4. Signal `operators` actualizado → Operador desaparece de la lista

---

## 5. Modelo de Datos (TypeScript)

```typescript
export interface ForkliftOperator {
  id: string;
  organizationId: string;
  code: string;              // MC-001, MC-002 (auto-generado por BE)
  firstName: string;
  lastNamePaternal: string;
  lastNameMaternal: string;
  fullName: string;          // calculado por BE
  licenseNumberDc3: string;
  licenseExpirationDate: string; // YYYY-MM-DD
  licenseStatus: 'VIGENTE' | 'POR_VENCER' | 'VENCIDA'; // calculado por BE
  shiftId?: string;          // UUID del turno
  shift: string;             // nombre del turno para display
  status: 'ACTIVO' | 'INACTIVO';
  version?: number;
}
```

---

## 6. Endpoints Consumidos

| Método | URL | Uso |
|---|---|---|
| `GET` | `/api/v1/forklift-operators?organizationId=` | Cargar lista en `ngOnInit` |
| `POST` | `/api/v1/forklift-operators` | Crear nuevo operador |
| `PUT` | `/api/v1/forklift-operators/{id}` | Actualizar operador |
| `DELETE` | `/api/v1/forklift-operators/{id}` | Baja lógica |
| `PATCH` | `/api/v1/forklift-operators/{id}/status` | Cambiar ACTIVO/INACTIVO |
| `GET` | `/api/v1/forklift-operators/{id}/audit` | Historial de auditoría |
| `GET` | `/api/v1/shifts` | Catálogo de turnos para el selector |

---

## 7. KPIs del Header

| KPI | Fuente |
|---|---|
| Total | `operators().length` |
| Activos | `activeOperators().length` |
| DC-3 Vigentes | `operators().filter(op => op.licenseStatus === 'VIGENTE').length` |
| Licencias en Alerta | `operators().filter(op => ['POR_VENCER','VENCIDA'].includes(op.licenseStatus)).length` |

---

## 8. Integración con Movimientos de Almacén

`WarehouseMovementsService` consume reactivamente `ForkliftOperatorAdminService.dropdownOperators` para poblar el selector de operador en los formularios de recepción, traspaso y despacho. Al actualizarse la lista de montacarguistas activos, todos los módulos que usan este computed se actualizan automáticamente.

---

## 9. Manejo de Errores

- **404**: Toast rojo "El montacarguista solicitado no fue encontrado."
- **400**: Toast rojo con el `message` del backend (ej. "DC-3 duplicado")
- **0 (sin conexión)**: Toast rojo "No se puede conectar con el servidor."
- **401/403**: Toast rojo con indicación de sesión o permisos

---

## 10. Changelog

| Versión | Cambio | Fecha |
|---|---|---|
| 1.0.0 | Implementación inicial con localStorage y datos mock | 2026-01 |
| 2.0.0 | Migración completa a HTTP real (Cero Mocks — ADR-007) | 2026-08-18 |
