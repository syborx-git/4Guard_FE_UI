# SDD — Frontend: Módulo Gestión de Clientes (4Guard_FE_UI)

> **Módulo:** `clients`
> **Repositorio:** `4Guard_FE_UI` · **Rama:** `clientes-ui-destinos`
> **Framework:** Angular 17+ (Signals, Standalone Components)
> **Estado:** 🟢 Integrado con Backend Real (sin datos simulados)

---

## 1. Objetivo

Proporcionar la interfaz de usuario para el módulo **Gestión de Clientes Depositantes / Owners 3PL**, con soporte para:

1. Formulario completo con campos fiscales: RFC, Dirección, Teléfono, Email, Portal.
2. **Matriz Dinámica de Contactos Corporativos:** Agregar / Editar / Eliminar contactos por rol.
3. **Addresses de Destino Físico (Bodegas / Plantas):** CRUD visual de Ship-to Locations.
4. **Auditoría Visual:** Timeline de cambios consumida del Backend.

---

## 2. Estructura del Módulo

```
apps/admin-console/src/app/features/admin/
├── clients/
│   ├── models/
│   │   └── client.model.ts            ← Interfaces TypeScript (homologadas con BE DTOs)
│   ├── components/
│   │   ├── clients-management/        ← Página principal (tabla + filtros)
│   │   ├── client-form/               ← Formulario de creación/edición
│   │   ├── client-contacts-matrix/    ← Sub-componente: Matriz de Contactos
│   │   └── client-destinations/       ← Sub-componente: Destinos Físicos
│   └── clients.routes.ts
└── services/
    └── client.service.ts              ← Servicio HTTP (sin fallback/hardcode)
```

---

## 3. Interfaces y Tipos (`client.model.ts`)

### 3.1 Principales

| Interfaz | Descripción | Homologación BE |
|---|---|---|
| `Client` | Entidad completa del cliente en el FE | `ClientResponse.java` |
| `ClientContact` | Contacto corporativo | `ClientContactDto.java` |
| `PhysicalDestination` | Destino físico de entrega | `PhysicalDestinationDto.java` |
| `CreateClientRequest` | DTO de creación | `CreateClientRequest.java` |
| `UpdateClientRequest` | DTO de actualización | `UpdateClientRequest.java` |
| `ClientAuditEntry` | Entrada de auditoría | `ClientAuditResponse.java` |
| `ApiResponse<T>` | Wrapper de respuesta HTTP | `ApiResponse.java` |

---

## 4. Servicio HTTP (`client.service.ts`)

### 4.1 Signals Reactivos

| Signal | Tipo | Descripción |
|---|---|---|
| `clients` | `ReadonlySignal<Client[]>` | Lista reactiva de clientes |
| `loading` | `WritableSignal<boolean>` | Estado de carga inicial |
| `saving` | `WritableSignal<boolean>` | Estado de operación de escritura |
| `loadError` | `WritableSignal<string or null>` | Mensaje de error HTTP |
| `totalCount` | `ComputedSignal<number>` | Conteo total |
| `activeCount` | `ComputedSignal<number>` | Clientes ACTIVE |
| `totalDestinations` | `ComputedSignal<number>` | Total destinos en todo el portafolio |

### 4.2 Métodos Públicos y Endpoints

| Método | HTTP | Endpoint BE | Descripción |
|---|---|---|---|
| `loadClients()` | GET | `/api/v1/clients?organizationId=` | Carga la lista y actualiza el signal |
| `create(client)` | POST | `/api/v1/clients` | Crea cliente con contactos/destinos |
| `update(id, fields)` | PUT | `/api/v1/clients` | Actualiza cliente + sincroniza listas |
| `delete(id)` | DELETE | `/api/v1/clients/{id}` | Elimina cliente |
| `toggleStatus(id)` | PATCH | `/api/v1/clients/{id}/status` | Toggle ACTIVE ↔ INACTIVE |
| `addDestination(cId, dto)` | POST | `/api/v1/clients/{id}/destinations` | Agrega destino al signal en tiempo real |
| `updateDestination(cId, dId, dto)` | PUT | `/api/v1/clients/{id}/destinations/{dId}` | Actualiza destino en el signal |
| `deleteDestination(cId, dId)` | DELETE | `/api/v1/clients/{id}/destinations/{dId}` | Elimina destino del signal |
| `getClientAudit(id)` | GET | `/api/v1/clients/{id}/audit` | Historial de auditoría con enriquecimiento UI |

---

## 5. Eliminación de Datos Simulados / Hardcode

### Antes vs Ahora

| Código Hardcodeado (ANTES) | Solución (AHORA) |
|---|---|
| Array de clientes en memoria (`mockClients`) | Solo `signal<Client[]>([])` vacío |
| Generación de UUID local (`Date.now()`, `Math.random()`) | UUID generado por el Backend |
| Datos de organizaciones fijos (`id: 'org-001'`) | Obtenido de `localStorage['session'].user.organizationId` |
| Fallback que retornaba datos locales en error | Solo `throwError()` — error real propagado al componente |
| `getAuditLogs()` con eventos mock | Reemplazado por `GET /clients/{id}/audit` real |
| IDs de destino como `destination-${Date.now()}` | UUID generado por `POST /clients/{id}/destinations` |

---

## 6. Auditoría Visual — Timeline

| Acción BE | Icono Material | Color |
|---|---|---|
| `CLIENT_CREATED` | `domain_add` | 🟢 `create` |
| `CLIENT_UPDATED` | `edit_note` | 🔵 `update` |
| `CLIENT_DELETED` | `delete_forever` | 🔴 `delete` |
| `CLIENT_STATUS_CHANGED` | `toggle_on` | 🟡 `status` |
| `CLIENT_DESTINATION_ADDED` | `add_location_alt` | 🟢 `create` |
| `CLIENT_DESTINATION_UPDATED` | `edit_location` | 🔵 `update` |
| `CLIENT_DESTINATION_DELETED` | `location_off` | 🔴 `delete` |
