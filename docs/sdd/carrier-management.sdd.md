# SDD — Frontend: Módulo Gestión de Transportistas (`4Guard_FE_UI`)

> **Módulo:** `carriers`  
> **Repositorio:** `4Guard_FE_UI` · **Ruta:** `apps/admin-console/src/app/features/admin/carriers/`  
> **Framework:** Angular 17+ (Standalone Components, Signals Reactivos, Reactive Forms)  
> **Rol / Permiso:** `WMS_ADMIN`, `SUPER_ADMIN`, `CARRIERS_MANAGE`  
> **Estado:** 🟢 Golden Standard de Referencia — 100% Integrado con Backend Real  

---

## 1. Objetivo y Alcance

Proporcionar la consola administrativa central para el control del catálogo maestro de **Transportistas y Líneas Fleteras (Carriers)** encargadas del traslado de mercancía en andenes de recepción y despacho del WMS.

Capacidades operativas principales:
1. **Directorio Inteligente y Filtrado:** Búsqueda en tiempo real por razón social, nombre comercial, RFC, código CAAT/SCAC y filtros por estatus operativo.
2. **Layout Split-View Master-Detail (35% / 65%):** Directorio lateral de alta densidad a la izquierda y formulario de detalle enriquecido por secciones a la derecha.
3. **Máquina de Estados Finitos (FSM):** Transiciones auditadas entre estados `ACTIVE`, `SUSPENDED` e `INACTIVE`.
4. **Matriz de Servicios y Contactos:** Gestión dinámica de tipos de transporte autorizados (Caja Seca, Refrigerada, Plataforma, Paquetería) y contactos de despacho.
5. **Auditoría Forense con Deltas:** Visualización de cambios históricos consumidos de `GET /api/v1/carriers/{id}/audit`.

---

## 2. Estructura de Archivos del Módulo

```
apps/admin-console/src/app/features/admin/carriers/
├── carrier-management/
│   ├── carrier-management.component.ts    ← Componente Standalone reactivo con Signals
│   ├── carrier-management.component.html  ← Template con Split-View, KPI cards y modal FSM
│   └── carrier-management.component.css   ← Estilos encapsulados con tokens Synexia
├── carriers.routes.ts                     ← Configuración de enrutamiento lazy loaded
├── models/
│   └── carrier.models.ts                  ← Modelos TypeScript homologados con CarrierResponse.java
└── services/
    └── carrier.service.ts                 ← Servicio HTTP REST conectado a /api/v1/carriers
```

---

## 3. Normativa de Homologación de Componentes (ADR-013)

| Componente | Implementación en este Módulo | Requisitos de Cumplimiento |
|---|---|---|
| **Hero Header** | `.carriers-header` | Icono 52x52px (`local_shipping`), breadcrumb `.btn-back-admin` con retorno a `/admin`, eyebrow `CATÁLOGO MAESTRO` en monospace dorado, H1 `Gestión de Transportistas`. |
| **KPI Cards Grid** | `.carriers-kpi-grid` (4 cards) | Total transportistas, Activos (verde), Suspendidos (ámbar), Inactivos (gris), con skeleton shimmer en carga y barra de acento semántico inferior. |
| **Directorio Split-View** | `.carriers-directory` (35% / 340px) | Buscador con icono `search`, chips de filtro (`Todas`, `Activas`, `Suspendidas`), lista con avatares cromáticos por tipo y scroll independiente. |
| **Formulario por Secciones** | `.carriers-form` (65%) | Leyendas doradas `.section-legend` en mayúsculas (`IDENTIDAD LEGAL`, `DATOS DE OPERACIÓN`, `CONTACTOS Y SERVICIOS`), inputs de 40px con focus dorado. |
| **Selectores & Dropdowns** | `.form-select` | Selector de tipo de transportista (Propio, Tercero 3PL, Paquetería, Cliente) con flecha SVG y validación visual de error. |
| **Diálogos Modales** | `.dialog`, `<fg-confirm-dialog>` | Modal desacoplado de suspensión/reactivación con campo de justificación obligatoria, sin etiqueta `<form>` envolvente para evitar colisión de submit. |
| **Badges de Estatus** | `.carrier-status-badge` | Badges píldora (`radius: 99px`) con colores corporativos: Activo (`#208457`), Suspendido (`#c07520`), Inactivo (`#6f7785`). |

---

## 4. Estado Reactivo del Componente (`Signals`)

| Signal | Tipo | Descripción |
|---|---|---|
| `carriers` | `WritableSignal<Carrier[]>` | Lista completa recuperada de la API REST |
| `selectedCarrier` | `WritableSignal<Carrier \| null>` | Transportista actualmente en edición o inspección |
| `filterText` | `WritableSignal<string>` | Cadena de búsqueda para razón social, RFC o CAAT |
| `statusFilter` | `WritableSignal<'ALL' \| 'ACTIVE' \| 'SUSPENDED' \| 'INACTIVE'>` | Filtro por estatus operativo |
| `filteredCarriers` | `ComputedSignal<Carrier[]>` | Lista computada reactivamente aplicando búsqueda y estatus |
| `totalCarriers` | `ComputedSignal<number>` | KPI: Conteo total de transportistas |
| `activeCarriers` | `ComputedSignal<number>` | KPI: Transportistas activos |
| `suspendedCarriers`| `ComputedSignal<number>` | KPI: Transportistas suspendidos |
| `inactiveCarriers` | `ComputedSignal<number>` | KPI: Transportistas inactivos |
| `isLoading` | `WritableSignal<boolean>` | Indicador de carga de datos iniciales |
| `isSaving` | `WritableSignal<boolean>` | Indicador de guardado o mutación en progreso |

---

## 5. Modelos de Datos TypeScript (`carrier.models.ts`)

```typescript
export type CarrierStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
export type CarrierType = 'OWN_FLEET' | 'THIRD_PARTY_3PL' | 'PARCEL_SERVICE' | 'CLIENT_CARRIER';

export interface Carrier {
  id: string;                      // UUID v4
  organizationId: string;          // UUID v4
  code: string;                    // TR-001
  legalName: string;               // Razón Social
  commercialName: string;          // Nombre Comercial
  rfc: string;                     // RFC Fiscal
  caatCode?: string;               // Código CAAT (México)
  scacCode?: string;               // Código SCAC (Internacional)
  type: CarrierType;
  status: CarrierStatus;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  services: string[];              // ['DRY_VAN', 'REFRIGERATED', 'FLATBED']
  createdAt: string;               // ISO-8601 UTC
  updatedAt: string;               // ISO-8601 UTC
}

export interface CreateCarrierRequest {
  legalName: string;
  commercialName: string;
  rfc: string;
  caatCode?: string;
  scacCode?: string;
  type: CarrierType;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  services: string[];
}

export interface UpdateCarrierStatusRequest {
  status: CarrierStatus;
  reason: string;
}
```

---

## 6. Contrato HTTP REST (`CarrierService`)

Todos los métodos consumen el backend Java Spring Boot 3 (`4guard_be`) bajo el prefijo `/api/v1/carriers`:

| Método | Verbo | Endpoint | Descripción |
|---|---|---|---|
| `getCarriers()` | `GET` | `/api/v1/carriers` | Obtiene la lista completa de transportistas de la organización |
| `getCarrierById(id)` | `GET` | `/api/v1/carriers/{id}` | Recupera el detalle completo de un transportista |
| `createCarrier(dto)` | `POST` | `/api/v1/carriers` | Registra un nuevo transportista con validación fiscal de RFC |
| `updateCarrier(id, dto)` | `PUT` | `/api/v1/carriers/{id}` | Actualiza datos maestros y fiscales del transportista |
| `updateCarrierStatus(id, req)` | `PATCH` | `/api/v1/carriers/{id}/status` | Transición FSM con motivo de suspensión o activación |
| `getCarrierAudit(id)` | `GET` | `/api/v1/carriers/{id}/audit` | Recupera el historial de deltas de auditoría |

---

## 7. Validaciones y Manejo de Notificaciones

1. **RFC Mexicano:** Validación estricta con RegExp `^[A-Z&Ñ]{3,4}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{3}$`.
2. **Notificaciones Exclusivas:** Cero banners o textos estáticos en pantalla. Todo feedback operativo se emite mediante `ToastService`:
   - `toast.success('Transportista guardado exitosamente')`
   - `toast.error('Error al cambiar el estatus del transportista')`
3. **Manejo de Errores Backend:** Intercepción tipada de errores `400 Bad Request` (RFC duplicado, código en uso) mostrando el mensaje enviado por el backend.
