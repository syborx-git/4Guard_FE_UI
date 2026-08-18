# SDD — Frontend: Módulo Gestión de Clientes (4Guard_FE_UI)

> **Módulo:** `clients`
> **Repositorio:** `4Guard_FE_UI` · **Rama:** `develop` (MERGED)
> **Framework:** Angular 17+ (Signals Reactivos, Standalone Components, Reactive Forms)
> **Estado:** 🟢 Integrado con Backend Real (sin datos simulados)

---

## 1. Objetivo

Proporcionar la interfaz de usuario moderna, reactiva y accesible para la administración integral de **Clientes Depositantes / Owners 3PL**, con soporte para:

1. **Gestión de Datos Maestros y Fiscales:** Razón Social, RFC, Dirección Fiscal, Teléfono, Email, Contraseña Portal de Autoservicio y Estado Operativo.
2. **Matriz Dinámica de Contactos Corporativos:** Inserción, edición y eliminación de contactos por área (Logística, Compras, Finanzas, etc.) con selección de contacto principal.
3. **Direcciones Físicas de Destino (Multi-Bodega / Plantas):** Gestión de *Ship-to Locations* con código correlativo, responsable en sitio, teléfono y estatus.
4. **Línea de Tiempo de Auditoría:** Visualización interactiva de eventos históricos del cliente consumidos en tiempo real del Backend.

---

## 2. Estructura del Módulo

```
apps/admin-console/src/app/features/admin/
├── clients/
│   ├── models/
│   │   └── client.model.ts                  ← Modelos TypeScript homologados 1:1 con DTOs de Java
│   ├── client-management/
│   │   ├── client-management.component.ts   ← Lógica reactiva con Signals y FormArrays
│   │   ├── client-management.component.html ← Template con panel lateral y acordeones
│   │   └── client-management.component.css  ← Estilos modernos BEM
│   └── clients.routes.ts
└── services/
    └── client.service.ts                    ← Servicio HTTP real conectado a /api/v1/clients
```

---

## 3. Interfaces y Modelos de Datos (`client.model.ts`)

### 3.1 Modelos Principales

| Interfaz | Descripción | Equivalente en Backend |
|---|---|---|
| `Client` | Modelo completo de cliente para el estado UI | `ClientResponse.java` |
| `ClientContact` | Contacto corporativo de un cliente | `ClientContactDto.java` |
| `PhysicalDestination` | Dirección física de entrega / bodega | `PhysicalDestinationDto.java` |
| `CreateClientRequest` | DTO para el endpoint `POST /api/v1/clients` | `CreateClientRequest.java` |
| `UpdateClientRequest` | DTO para el endpoint `PUT /api/v1/clients` | `UpdateClientRequest.java` |
| `ClientAuditEntry` | Entrada formateada para la línea de tiempo | `ClientAuditResponse.java` |
| `ApiResponse<T>` | Wrapper genérico de respuesta HTTP | `ApiResponse.java` |

---

## 4. Servicio HTTP (`client.service.ts`)

### 4.1 Signals Reactivos de Estado

| Signal | Tipo | Descripción |
|---|---|---|
| `clients` | `ReadonlySignal<Client[]>` | Lista reactiva inmutable de clientes cargados |
| `loading` | `WritableSignal<boolean>` | Indicador de carga de datos iniciales |
| `saving` | `WritableSignal<boolean>` | Indicador de guardado/actualización en progreso |
| `loadError` | `WritableSignal<string \| null>` | Mensaje de error al consultar el servidor |
| `totalCount` | `ComputedSignal<number>` | KPI: Total de clientes en la organización |
| `activeCount` | `ComputedSignal<number>` | KPI: Clientes con estatus ACTIVE |
| `inactiveCount` | `ComputedSignal<number>` | KPI: Clientes con estatus INACTIVE |
| `totalDestinations` | `ComputedSignal<number>` | KPI: Total de bodegas/plantas activas |

### 4.2 Métodos y Endpoints Consumidos

| Método | Verbo HTTP | Endpoint | Descripción |
|---|---|---|---|
| `loadClients()` | `GET` | `/api/v1/clients?organizationId={id}` | Consulta y actualiza el signal `clients` |
| `create(client)` | `POST` | `/api/v1/clients` | Crea cliente con sanitización de UUIDs |
| `update(id, fields)` | `PUT` | `/api/v1/clients` | Actualiza cliente y sincroniza colecciones |
| `delete(id)` | `DELETE` | `/api/v1/clients/{id}` | Elimina cliente |
| `toggleStatus(id)` | `PATCH` | `/api/v1/clients/{id}/status` | Alterna estado ACTIVE ↔ INACTIVE |
| `addDestination(cId, d)` | `POST` | `/api/v1/clients/{cId}/destinations` | Registra nueva bodega de entrega |
| `updateDestination(cId, dId, d)` | `PUT` | `/api/v1/clients/{cId}/destinations/{dId}` | Modifica bodega de entrega |
| `deleteDestination(cId, dId)` | `DELETE` | `/api/v1/clients/{cId}/destinations/{dId}` | Elimina bodega de entrega |
| `getClientAudit(id)` | `GET` | `/api/v1/clients/{id}/audit` | Recupera historial con deltas para el timeline |

### 4.3 Sanitización de UUIDs para Evitar Errores 400/500

El servicio implementa validación de formato UUID antes de emitir cualquier petición al backend:
* Si el contacto o destino es nuevo (creado en la UI sin UUID previo en BD), su `id` se envía como `undefined` (omitiéndose del JSON).
* Si ya cuenta con un UUID válido (proveniente de BD), se envía para permitir la actualización en cascada.

---

## 5. Componente de UI (`ClientManagementComponent`)

### 5.1 Formulario y FormArrays Reactivos

* **FormGroup Principal:** Controla datos maestros (Razón Social, RFC, Dirección Fiscal, Teléfono, Email, Contraseña Portal, Estatus).
* **`contactsFormArray`:** Permite agregar y remover contactos dinámicamente con validación de email y teléfono.
* **`destinationsFormArray`:** Permite agregar múltiples destinos físicos con validación de código de destino y dirección completa.

### 5.2 Barra de Acciones del Formulario

* **Guardar cambios / Crear cliente:** Botón principal de submit con indicador de carga (*spinner*).
* **Cancelar:** Restablece el formulario al estado original o descarta cambios.
* **Suspender / Activar:** Botón contextual (amarillo/verde) que dispara el modal de confirmación para `PATCH /status`.

---

## 6. Visualización de Auditoría (Timeline)

El panel lateral incluye un acordeón de **«Historial y Auditoría del Cliente»** con enriquecimiento visual:

| Acción | Icono Material | Color | Significado |
|---|---|---|---|
| `CLIENT_CREATED` | `domain_add` | 🟢 Verde (`create`) | Registro inicial del cliente |
| `CLIENT_UPDATED` | `edit_note` | 🔵 Azul (`update`) | Modificación de datos maestros |
| `CLIENT_STATUS_CHANGED` | `toggle_on` | 🟡 Amarillo (`status`) | Suspensión o activación |
| `CLIENT_DELETED` | `delete_forever` | 🔴 Rojo (`delete`) | Borrado del cliente |
| `CLIENT_DESTINATION_ADDED` | `add_location_alt` | 🟢 Verde (`create`) | Nueva bodega vinculada |
| `CLIENT_DESTINATION_UPDATED` | `edit_location` | 🔵 Azul (`update`) | Modificación de bodega |
| `CLIENT_DESTINATION_DELETED` | `location_off` | 🔴 Rojo (`delete`) | Baja de bodega |

Cada nodo del timeline renderiza:
1. Resumen en lenguaje natural de la acción realizada.
2. Usuario responsable (`performedBy`) y timestamp con formato `dd/MM/yyyy HH:mm:ss`.
3. Lista de diferencias (*deltas*): `campo: valor_anterior ➔ valor_nuevo`.
