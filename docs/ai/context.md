# 4GUARD WMS — Contexto del Proyecto para IA

> Este archivo es el punto de entrada para que asistentes de IA (como Antigravity/Claude) entiendan el proyecto sin necesidad de explorar toda la estructura.

---

## ¿Qué es 4GUARD WMS?

**4GUARD WMS** es un **Warehouse Management System** (Sistema de Gestión de Almacenes) desarrollado por **IronShark / 4ward** para gestión logística enterprise. Es un producto multi-tenant con soporte para múltiples organizaciones y sucursales.

---

## Repositorios del Proyecto

| Repo | Descripción |
|---|---|
| `4Guard_FE_UI` | **Este repo** — Frontend Angular (Nx Monorepo) |
| `4Guard_BEAPI` | Backend Java Spring Boot (API REST) |

---

## Stack Tecnológico Frontend

| Capa | Tecnología |
|---|---|
| Framework | Angular 17+ (Standalone Components) |
| Monorepo | Nx Workspace |
| Estilos | SCSS (7-1 pattern) + CSS Custom Properties |
| Íconos | Material Symbols Outlined |
| Fuentes | Bodoni Moda · DM Sans · Outfit · JetBrains Mono |
| Auth | JWT Bearer Token (interceptor global) |
| Routing | Lazy loading + Guards (authGuard, rbacGuard) |
| Tema | Synexia Theme Engine (dark/light mode toggle) |
| Lenguaje | TypeScript estricto |

---

## Aplicaciones en el Monorepo

### `apps/admin-console` — Consola Web

La aplicación principal. SPA para usuarios administrativos. Puerto dev: `4200`.

**Pantallas clave homologadas:**
- `carrier-management` → Gestión de Transportistas (HU-128)
- `layout-management` → Gestión de Ubicaciones Físicas (HU-127)
- `users-list` → Control de Usuarios
- `dashboard` → Torre de Control + KPIs
- Topología Cromática → visualización cromática de zonas FSM

### `apps/rf-terminal` — Terminal RF / PWA

App para operadores en piso de almacén. Optimizada para touch y teclado RF.

### `libs/shared-core` — Librería compartida

```typescript
import { UserRole, SomeModel } from '@4guard/shared-core';
```

---

## Sistema Visual (Design System)

El sistema se llama internamente **"Synexia"** y usa:

### Paleta principal
- **Navy:** `#172033` — Color estructural
- **Gold (light mode):** `#ad8129` / `--gold` → Acento
- **Gold (dark mode):** `#d0af67` / `--gold` → Acento
- **Background light:** `#f5f4f0` (crema/hueso)
- **Background dark:** `#0b1119` (azul marino profundo)

### Patrón de tema dual
```css
:root, .theme-light { /* tema claro */ }
.theme-dark          { /* tema oscuro */ }
:host-context(.theme-dark) { /* override en componente */ }
```

### Glassmorphism
```css
/* Estándar en tarjetas principales */
background: var(--bg-card);  /* rgba(255,255,255,0.92) light */
backdrop-filter: blur(20px);
border: 1px solid var(--border-card);
border-radius: 18px;
```

---

## Patrones de UI más importantes

### Split View (patrón dominante)
Todas las pantallas de gestión usan Split View:
- **Izquierda (30-35%):** Lista/explorador con búsqueda y filtros
- **Derecha (65-70%):** Formulario de detalle con header/footer sticky

### KPI Cards Header
4 cards en grid al inicio de cada pantalla de gestión con:
- Valor grande (`Outfit 1.75rem bold`)
- Label en mayúsculas (`0.7rem 650 spaced`)
- Barra de color en la base (3px, semántica)
- Hover: `translateY(-2px)`

### FSM Colors
El sistema de estados de máquina finita (ubicaciones, pedidos) usa colores semánticos consistentes:
- Verde (disponible/activo), Amarillo (en proceso), Naranja (advertencia), Rojo (bloqueado/error), Gris (inactivo)

---

## Módulos del Sistema (Rutas)

```
/dashboard        → Torre de Control
/inventory        → Inventario
/layout           → Ubicaciones Físicas + Topología
/receiving        → Recepción de mercancía
/quality          → Control de Calidad
/shipping         → Despacho
/users            → Control de Usuarios
/organizations    → Multi-Tenancy
/branches         → Sucursales
/clients          → Clientes
/skus             → Catálogo de Productos
/roles            → Roles y Permisos
/carriers         → Transportistas (HU-128)
/sections         → Secciones del Almacén
/suppliers        → Proveedores (HU-125)
/performance      → Monitoreo de Rendimiento
/shifts           → Turnos y Horarios
/sessions         → Sesiones Activas
/user-activity    → Actividad por Usuario
/business-rules   → Motor de Reglas
/currency-exchange→ Divisas
/alerts-config    → Configuración de Alertas
/licenses         → Licencias WMS
```

---

## Convenciones que siempre se cumplen

1. **Lazy loading** en todas las rutas de features
2. **RBAC guard** con `data: { module: '...' }` en cada ruta protegida
3. **Variables CSS locales** en `:host` de cada componente
4. **Dark mode** siempre implementado con `:host-context(.theme-dark)`
5. **Skeleton loaders** en listas y KPIs durante carga
6. **Empty state** con icon + title + descripción cuando no hay datos
7. **Sticky** header y footer en todos los formularios de detalle
8. **BEM** con prefijo de módulo para todas las clases CSS
9. **Cero Datos Hardcodeados / BD Obligatoria:** Todos los componentes, dropdowns y listas consumen estrictamente del Backend `4Guard_BEAPI`. Queda prohibido mantener datos o fallbacks mock fijos en producción. En caso de error, mostrar pantalla vacía (`empty state`) + `ToastService.error()`.

---

## 📋 Protocolo: Cómo leer docs antes de implementar

Antes de implementar cualquier módulo CRUD, leer en este orden:

1. **`docs/ai/context.md`** (este archivo) — diseño y convenciones globales
2. **`docs/api/contracts.md`** — patrones globales del BE (wrapper, IDs, fechas, errores)
3. **`docs/api/modules/[modulo].md`** — contrato exacto del BE para ese módulo
4. **`docs/patterns/`** — Seleccionar el patrón UI adecuado (`split-view-master-detail`, `dashboard-kpi-bento`, `audit-log-drawer`, `wizard-multi-step`, `fsm-chromatic-grid`). Si el usuario **no especifica un patrón en el prompt**, evaluar las palabras clave usando el **Motor de Auto-Detección** de `docs/patterns/README.md`, seleccionar el patrón automáticamente e informarlo en la respuesta.
5. **`docs/design/component-specs.md`** — patrón visual de pantallas de referencia
6. **`docs/coding/conventions.md`** — checklist de implementación
7. **`docs/examples/feature-template.md`** — template a seguir

### Módulos disponibles en docs/api/modules/

| Archivo | Cubre |
|---|---|
| `users.md` | Usuarios, reset password, audit |
| `carriers.md` | Transportistas, validate-RFC |
| `locations.md` | Ubicaciones, FSM completo |
| `branches.md` | Sucursales |
| `organizations.md` | Organizaciones (multi-tenant) |
| `clients.md` | Clientes (depositantes) |
| `roles-permissions.md` | RBAC: Roles y Permisos |
| `suppliers.md` | Proveedores con paginación |
| `skus-sections-auth-audit.md` | SKUs, Secciones, Auth, Sesiones Activas |

---

## Cómo pedirme que haga algo correctamente

### ✅ Correcto
```
"Crea una nueva pantalla de Gestión de Proveedores
homologada con la de Transportistas: mismo split view,
KPI cards, dark mode, RBAC guard con module: 'suppliers'"
```

### ❌ Incorrecto
```
"Crea una pantalla de proveedores" (sin contexto)
```

---

## Archivos clave para entender el proyecto

| Archivo | Propósito |
|---|---|
| `apps/admin-console/src/styles/themes/_dark.scss` | Tokens light + dark mode |
| `apps/admin-console/src/styles/abstracts/_variables.scss` | Variables SCSS base |
| `apps/admin-console/src/app/app.routes.ts` | Todas las rutas del sistema |
| `apps/admin-console/src/app/features/admin/carriers/carrier-management/carrier-management.component.css` | Referencia de estilos homologados |
| `libs/shared-core/src/index.ts` | Exports de la librería compartida |
