# SDD — Frontend: Módulo Gestión de Licencias WMS (`4Guard_FE_UI`)

> **Módulo:** `license-management`  
> **HU:** HU-139 — Gestión de Licencias Corporativas WMS  
> **Repositorio:** `4Guard_FE_UI` · **Ruta:** `apps/admin-console/src/app/features/license-management/`  
> **Framework:** Angular 17+ (Standalone Components, Signals Reactivos, Reactive Forms)  
> **Rol / Permiso:** `SUPER_ADMIN`, `LICENSES_MANAGE`  
> **Estado:** 🟢 Golden Standard — Integrado con `WmsLicenseController.java`  

---

## 1. Objetivo y Alcance

Permitir la activación, validación criptográfica, auditoría y control de cuotas de las **Licencias de Uso de 4GUARD WMS** para cada organización o centro de distribución:

1. **Gestión de Claves Criptográficas:** Activación y verificación de firma digital de licencias expedidas por Syborx Enterprise.
2. **Control de Cuotas Operativas:** Límites concurrentes de Handhelds RF, usuarios de consola web, almacenes activos y transacciones mensuales.
3. **Monitoreo de Vigencia y Alertas:** Indicadores de días restantes para expiración, estado de gracia (Grace Period) y advertencias visuales de renovación.
4. **Auditoría de Activaciones:** Registro de huellas digitales de hardware (Hardware ID / MAC Address) asociadas a cada licencia.

---

## 2. Estructura de Archivos del Módulo

```
apps/admin-console/src/app/features/license-management/
├── license-management/
│   ├── license-management.component.ts    ← Lógica reactiva con Signals
│   ├── license-management.component.html  ← Template con visualizador de cuotas
│   └── license-management.component.css   ← Estilos con tokens Synexia
├── license-management.models.ts           ← Modelos TypeScript homologados con WmsLicenseResponse.java
├── license-management.routes.ts           ← Rutas del módulo
├── license-management.service.ts          ← Servicio HTTP REST hacia /api/v1/licenses
└── license-management.validators.ts       ← Validador de formato de clave de producto
```

---

## 3. Normativa de Homologación de Componentes (ADR-013)

| Componente | Implementación en este Módulo | Requisitos de Cumplimiento |
|---|---|---|
| **Hero Header** | `.hero-header` | Icono navy 52x52px (`verified_user`), botón badge `.btn-back-admin` hacia `/admin`, eyebrow `GOBERNANZA & LICENCIAMIENTO` en monospace dorado, H1 `Gestión de Licencias WMS`. |
| **KPI Cards Grid** | `.carriers-kpi-grid` | Nivel de Licencia (Tier), Terminales RF Habilitadas (dorado), Días de Vigencia Restantes (verde/ámbar), Dispositivos Conectados (azul). |
| **Directorio Split-View** | `.carriers-directory` (35%) | Lista de licencias históricas y activas con chip de Tier (`ENTERPRISE`, `PROFESSIONAL`, `STARTER`). |
| **Barras de Consumo de Cuota**| `.lm-occupancy-panel` | Barras de progreso de cuota con cambio de color semántico (<80% verde, 80-95% ámbar, >95% rojo). |
| **Input de Clave Criptográfica**| `.form-input` con clase `.td-mono` | Input con máscara de formato `XXXX-XXXX-XXXX-XXXX` y botón de validación inmediata. |
| **Diálogo de Confirmación** | `<fg-confirm-dialog>` | Confirmación obligatoria para revocación de licencias activas. |

---

## 4. Estado Reactivo del Componente (`Signals`)

| Signal | Tipo | Descripción |
|---|---|---|
| `licenses` | `WritableSignal<WmsLicense[]>` | Lista de licencias de la organización |
| `activeLicense` | `ComputedSignal<WmsLicense \| undefined>` | Licencia actualmente vigente en el sistema |
| `selectedLicense` | `WritableSignal<WmsLicense \| null>` | Licencia en inspección en el panel derecho |
| `daysRemaining` | `ComputedSignal<number>` | Días calculados hasta la fecha de expiración |
| `rfQuotaUsagePct` | `ComputedSignal<number>` | Porcentaje de handhelds utilizadas sobre el límite |
| `isLoading` | `WritableSignal<boolean>` | Indicador de carga |
| `isActivating` | `WritableSignal<boolean>` | Indicador de validación de clave criptográfica |

---

## 5. Modelos de Datos TypeScript (`license-management.models.ts`)

```typescript
export type LicenseTier = 'COMMUNITY' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type LicenseStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'GRACE_PERIOD';

export interface WmsLicense {
  id: string;                      // UUID v4
  organizationId: string;
  licenseKey: string;              // Clave formateada
  tier: LicenseTier;
  status: LicenseStatus;
  issuedTo: string;                // Nombre de la empresa cliente
  maxRfTerminals: number;
  activeRfTerminals: number;
  maxWebUsers: number;
  activeWebUsers: number;
  maxWarehouses: number;
  issuedAt: string;                // ISO-8601 UTC
  expiresAt: string;               // ISO-8601 UTC
  featuresEnabled: string[];       // ['ZPL_PRINTING', 'OFFLINE_FIRST', 'ZONE_LEASE']
  createdAt: string;
  updatedAt: string;
}

export interface ActivateLicenseRequest {
  licenseKey: string;
  hardwareFingerprint?: string;
}
```

---

## 6. Contrato HTTP REST (`LicenseManagementService`)

| Método | Verbo | Endpoint | Descripción |
|---|---|---|---|
| `getLicenses()` | `GET` | `/api/v1/licenses` | Consulta las licencias vinculadas a la organización |
| `getActiveLicense()` | `GET` | `/api/v1/licenses/active` | Obtiene la licencia actualmente en vigor |
| `activateLicense(dto)` | `POST` | `/api/v1/licenses/activate` | Valida y activa una nueva clave de licencia |
| `revokeLicense(id, reason)`| `POST` | `/api/v1/licenses/{id}/revoke` | Revoca la licencia activa |
| `getLicenseAudit(id)` | `GET` | `/api/v1/licenses/{id}/audit` | Trazabilidad de activaciones y hardware asociado |

---

## 7. Validaciones y Notificaciones

1. **Validación de Clave:** Validador RegExp de 16 caracteres hexadecimales divididos por guiones.
2. **Notificaciones:** Mensajes de éxito y error gestionados por `ToastService`.
