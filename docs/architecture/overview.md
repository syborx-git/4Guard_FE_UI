# 4GUARD WMS — Arquitectura General del Sistema Frontend

> **Versión:** 2.x | **Stack:** Angular 17+ (Standalone) | **Estructura:** Nx Monorepo

---

## Visión General

4GUARD WMS Frontend es un **Nx monorepo** que contiene dos aplicaciones Angular independientes y una librería compartida. Está diseñado para operar en entornos de **almacenes logísticos multi-tenant**, con autenticación JWT, control de acceso basado en roles (RBAC), y comunicación con el backend `4Guard_BEAPI` (Java Spring Boot).

```
4Guard_FE_UI/                        ← Nx Monorepo Root
├── apps/
│   ├── admin-console/               ← Consola Web de Administración (SPA)
│   └── rf-terminal/                 ← Terminal RF / PWA Tablet (Operaciones)
├── libs/
│   └── shared-core/                 ← Modelos, servicios y constantes compartidas
├── docs/                            ← Documentación SDD (este directorio)
├── angular.json                     ← Configuración del workspace Nx
├── tsconfig.base.json               ← Paths alias: @4guard/shared-core
└── package.json
```

---

## Aplicaciones

### `admin-console`
- **Propósito:** Consola de administración web para supervisores, administradores de almacén y sysadmins.
- **Puerto dev:** `http://localhost:4200`
- **Usuarios objetivo:** Admin, Supervisor, Warehouse Manager, Sysadmin
- **Características clave:**
  - Dashboard de KPIs con Torre de Control
  - Gestión de Transportistas (HU-128)
  - Gestión de Layout / Ubicaciones Físicas (HU-127)
  - Topología Cromática (visualización de zonas con colores FSM)
  - Control de Usuarios, Roles y Permisos (RBAC)
  - Gestión de Sucursales, Clientes, SKUs, Proveedores
  - Inventario, Recepción, Despacho, Control de Calidad
  - Motor de Reglas de Negocio (HU-131)
  - Divisas y Tipos de Cambio (HU-148)
  - Licencias WMS (HU-139)
  - Configuración de Alertas (HU-134)
  - Monitoreo de Rendimiento (HU-138)
  - Auditoría y Sesiones Activas (HU-011, HU-146)

### `rf-terminal`
- **Propósito:** Aplicación PWA para terminales RF y tablets de operación en piso de almacén.
- **Usuarios objetivo:** Operadores de almacén, picking/packing staff
- **Características clave:** Flujos optimizados para touch y teclado RF

---

## `shared-core` Library

Librería Nx compartida entre ambas apps. Expone:

```typescript
// Importar en cualquier app:
import { UserRole, SomeModel, SomeService } from '@4guard/shared-core';
```

- **Modelos de dominio** compartidos (interfaces TypeScript)
- **Enums de roles:** `UserRole` (SYSADMIN, ADMIN, SUPERVISOR, OPERATOR, VIEWER)
- **Servicios compartidos** (auth helpers, environment resolvers)
- **Constantes de configuración**

---

## Comunicación con Backend

| Aspecto | Detalle |
|---|---|
| **Backend** | Java Spring Boot (`4Guard_BEAPI`) |
| **Protocolo** | REST / JSON |
| **Autenticación** | JWT Bearer Token |
| **Intercept** | `AuthInterceptor` adjunta el token a cada request |
| **Ambientes** | `environments/environment.ts` (dev) · `environment.prod.ts` (prod) |

---

## Routing Architecture

El sistema usa **lazy loading** a nivel de ruta para todas las features:

```
/login                → LoginComponent          (público)
/forgot-password      → ForgotPasswordComponent (público)
/change-password      → ChangePasswordComponent (authGuard + changePasswordGuard)
/                     → ShellComponent          (authGuard)
  /dashboard          → dashboardRoutes         (lazy)
  /users              → UsersListComponent      (rbacGuard: 'admin')
  /organizations      → organizationRoutes      (rbacGuard: 'admin')
  /branches           → branchesRoutes          (rbacGuard: 'admin')
  /clients            → clientsRoutes           (rbacGuard: 'admin')
  /skus               → skusRoutes              (rbacGuard: 'admin')
  /roles              → rolesRoutes             (rbacGuard: 'admin')
  /carriers           → carriersRoutes          (rbacGuard: 'carriers')
  /sections           → sectionsRoutes          (rbacGuard: 'sections')
  /suppliers          → supplierRoutes          (rbacGuard: 'suppliers')
  /layout             → layoutRoutes            (rbacGuard: 'layout')
  /inventory          → inventoryRoutes         (rbacGuard: 'inventory')
  /receiving          → receivingRoutes         (rbacGuard: 'receiving')
  /quality            → qualityRoutes           (rbacGuard: 'quality')
  /shipping           → shippingRoutes          (rbacGuard: 'shipping')
  /performance        → performanceRoutes       (rbacGuard: 'performance')
  /shifts             → ShiftManagementComponent(rbacGuard: 'shifts')
  /sessions           → ActiveSessionsMonitor   (authGuard)
  /user-activity      → userActivityRoutes      (rbacGuard: 'user-activity')
  /business-rules     → businessRulesRoutes     (rbacGuard: 'business-rules')
  /currency-exchange  → currencyExchangeRoutes  (rbacGuard: 'currency-exchange')
  /alerts-config      → alertsConfigRoutes      (rbacGuard: 'alerts-config')
  /licenses           → licenseManagementRoutes (rbacGuard: 'license-management')
```

---

## Guards de Seguridad

| Guard | Propósito |
|---|---|
| `authGuard` | Verifica que el usuario tenga sesión JWT activa |
| `rbacGuard` | Verifica que el usuario tenga permiso al módulo (data.module) |
| `changePasswordGuard` | Fuerza cambio de contraseña al primer login |
| `lockoutGuard` | Bloquea la pantalla de login si el usuario está en lockout (HU-010) |

---

## Patrón de Módulos (Feature Structure)

Cada feature sigue este patrón:

```
features/
└── admin/
    └── carriers/
        ├── carrier-management/
        │   ├── carrier-management.component.ts   ← Standalone Component
        │   ├── carrier-management.component.html
        │   └── carrier-management.component.css  ← Estilos encapsulados
        ├── models/                               ← Interfaces / DTOs
        ├── services/                             ← HTTP Services
        └── carriers.routes.ts                    ← Lazy routes
```

---

## Diagrama de Capas

```
┌──────────────────────────────────────────────┐
│              Browser (SPA)                   │
│  ┌────────────────┐  ┌──────────────────┐   │
│  │  admin-console  │  │   rf-terminal    │   │
│  └────────┬───────┘  └────────┬─────────┘   │
│           │                   │              │
│  ┌────────▼───────────────────▼─────────┐   │
│  │           @4guard/shared-core         │   │
│  └───────────────────────────────────────┘   │
└──────────────────────────┬───────────────────┘
                           │ HTTPS / REST
                    ┌──────▼──────┐
                    │ 4Guard_BEAPI │
                    │ Spring Boot  │
                    └─────────────┘
```
