# 4GUARD WMS Frontend — Angular 17+ Monorepo

> **Sistema de Gestión de Almacenes 3PL (WMS)** para la empresa 4GUARD.
> Arquitectura monorepo con dos aplicaciones diferenciadas y una librería compartida de lógica de negocio.

---

## 🏗️ Estructura del Workspace

```
4guard_FE/
│
├── apps/
│   ├── admin-console/          ← SPA Desktop (Consola Administrativa)
│   └── rf-terminal/            ← PWA Offline-First (Terminal de Tablet RF)
│
├── libs/
│   └── shared-core/            ← Librería central de lógica compartida
│       └── src/lib/
│           ├── domain/         ← Modelos e Interfaces (FSM, Enums)
│           ├── infrastructure/ ← Servicios HTTP, Interceptores
│           └── application/    ← Signal Stores (Estado reactivo)
│
├── angular.json                ← Configuración del monorepo
├── tsconfig.base.json          ← Path alias: @4guard/shared-core
├── package.json                ← Dependencias raíz
└── README.md
```

---

## 🧭 Decisiones de Arquitectura

### ¿Por qué Monorepo?

Separar físicamente el código de la **Consola Administrativa** del código de la **Terminal RF** es crítico porque:

- La tablet requiere un **Service Worker** y soporte **IndexedDB** para trabajar offline, lo cual no es necesario en la versión de escritorio.
- Los bundles de producción son completamente independientes y optimizados para cada contexto de uso.
- Los cambios en la lógica de negocio se propagan automáticamente a ambas apps desde `libs/shared-core`.

### ¿Por qué `libs/shared-core` como Autoridad de Verdad?

- La **FSM de 8 estados** (10→80) reside aquí. Si el backend cambia una regla de transición (ej: de estado 20 a estado 30), se cambia **una sola vez** y ambas apps se actualizan.
- Los **modelos TypeScript** mapean exactamente los DTOs del Backend (Spring Boot), garantizando que el frontend hable el mismo "idioma" que el backend.
- Los **servicios Singleton** (Auth, Backend, Sync) se instancian una sola vez en toda la aplicación.

---

## 🎯 Aplicaciones

### `apps/admin-console` — SPA Desktop
**Puerto de desarrollo:** `localhost:4200`

| Característica | Detalle |
|---|---|
| Tipo | Single Page Application (SPA) |
| Dispositivo objetivo | Desktop/PC (resolución ≥ 1280px) |
| Gestión de estado | Angular Signals + Signal Stores |
| Rutas | Lazy loading por feature module |
| Roles con acceso | Todos (filtrado por RBAC por módulo) |

**Módulos funcionales:**
- 📊 **Dashboard** — KPIs en tiempo real, alertas de cuarentena y bloqueos QM
- 📦 **Inventario** — Lista paginada, detalle de ítem, visor de FSM
- 🚛 **Recepción** — Gestión de ASNs y recepciones de mercancía
- 🔍 **Calidad** — Gestión de cuarentenas, aprobaciones e inspecciones QM
- 📤 **Despacho** — Órdenes de transferencia y despacho
- ⚙️ **Administración** — Usuarios, configuración (solo `ROLE_ADMIN`)

### `apps/rf-terminal` — PWA Tablet Offline-First
**Puerto de desarrollo:** `localhost:4201`

| Característica | Detalle |
|---|---|
| Tipo | Progressive Web App (PWA) |
| Dispositivo objetivo | Tablet industrial (10-12") en landscape |
| Soporte offline | Service Worker + localStorage queue |
| Targets táctiles | Mínimo 44x44px (WCAG 2.5.5) |
| Tema | Oscuro — Alto contraste para almacén |
| Orientación | Landscape (`orientation: landscape` en manifest) |

**Flujos operativos:**
- 🚛 **Recepción** — Escaneo de mercancía en andén
- 📍 **Putaway** — Ubicación de ítems en rack por escaneo
- 📋 **Picking** — Confirmación de ítems por orden de transferencia
- 🔢 **Conteo** — Conteo físico de inventario
- 🔍 **Calidad** — Inspección QM en campo

---

## 📚 `libs/shared-core` — API Pública

Importar desde: `@4guard/shared-core`

### Domain — Modelos e Interfaces

```typescript
import { Item, Location, Receipt, TransferOrder, User } from '@4guard/shared-core';
import { InventoryStatus, UserRole } from '@4guard/shared-core';
```

### FSM de Inventario (8 Estados)

| Código | Estado | Color |
|--------|--------|-------|
| `10` | Recibido | Azul Naval |
| `20` | Cuarentena | Ámbar |
| `30` | Disponible | Verde Esmeralda |
| `40` | Reservado | Azul Oscuro |
| `50` | En Picking | Naranja |
| `60` | Despachado | Verde Oscuro |
| `70` | Bloqueado QM | Rojo Vibrante |
| `80` | Dado de Baja | Gris |

```typescript
import { isValidTransition, InventoryStatus } from '@4guard/shared-core';

// Verificar si la transición es válida
isValidTransition(InventoryStatus.QUARANTINE, InventoryStatus.AVAILABLE); // true
isValidTransition(InventoryStatus.DISPATCHED, InventoryStatus.AVAILABLE); // false
```

### Infrastructure — Servicios Singleton

```typescript
import { AuthService, BackendService, SyncService } from '@4guard/shared-core';
// Todos son providedIn: 'root' → instancia única en toda la app
```

### Interceptores HTTP

```typescript
import { jwtInterceptor, branchInterceptor } from '@4guard/shared-core';

// En app.config.ts:
provideHttpClient(withInterceptors([jwtInterceptor, branchInterceptor]))
// → Inyecta automáticamente: Authorization: Bearer <JWT> y X-Branch-Id
```

### Application — Signal Stores

```typescript
import { AuthState, InventoryState, SyncState } from '@4guard/shared-core';

// En un componente:
readonly inventoryState = inject(InventoryState);
readonly items = this.inventoryState.items; // Signal<Item[]>
```

---

## 🎨 Design System Antigravity

### Paleta de Color Semántica

```css
/* Azul Naval — Autoridad / UI Base */
--color-primary:   #1B2B4B;

/* Rojo Vibrante — Alertas Críticas / Bloqueo QM */
--color-danger:    #E53935;

/* Amarillo Ámbar — Cuarentena / Estado 20 */
--color-warning:   #F9A825;

/* Verde Esmeralda — Disponible / Estado 30 */
--color-success:   #00897B;
```

### Tipografía
- **Inter** (Google Fonts) — Interfaz principal
- **JetBrains Mono** — Códigos de barras, SKUs, IDs técnicos

### Componentes Clave

| Componente | Ubicación | Descripción |
|---|---|---|
| `StatusBadgeComponent` | `admin-console/shared/components` | Badge semántico por estado FSM |
| `ShellComponent` | `admin-console/shared/components` | Layout con sidebar + header |
| `ScanInputComponent` | `rf-terminal/shared/components` | Input táctil 44px para escáner |
| `StatusLabelPipe` | `admin-console/shared/pipes` | `{{ item.status \| statusLabel }}` |
| `RbacDirective` | `admin-console/shared/directives` | `*fgRbac="[UserRole.ADMIN]"` |

---

## 🔐 RBAC — 7 Roles del Sistema

| Rol | Módulos con Acceso |
|-----|--------------------|
| `ROLE_ADMIN` | Todos |
| `ROLE_WAREHOUSE_MANAGER` | Dashboard, Inventario, Recepción, Picking, Calidad, Despacho, Conteo |
| `ROLE_DOCK_SUPERVISOR` | Inventario, Recepción, Picking, Despacho |
| `ROLE_WAREHOUSE_OPERATOR` | Recepción, Putaway, Picking, Despacho, Conteo (RF Terminal) |
| `ROLE_QM_INSPECTOR` | Calidad |
| `ROLE_AUDITOR` | Dashboard, Inventario, Conteo (solo lectura) |
| `ROLE_CLIENT` | Dashboard, Inventario (solo lectura del propio cliente) |

---

## 🚀 Comandos de Desarrollo

### Instalación
```bash
npm install
```

### 🖥️ Admin Console (Puerto 4200)

```bash
# LOCAL — apunta a http://localhost:8080
npm run start:admin

# DEVELOP — apunta a https://fourguard-be.onrender.com
npm run start:admin:dev
```

### 📟 RF Terminal PWA (Puerto 4201)

```bash
# LOCAL — apunta a http://localhost:8080
npm run start:rf

# DEVELOP — apunta a https://fourguard-be.onrender.com
npm run start:rf:dev
```

### 📦 Builds

```bash
# Build de producción
npm run build:admin
npm run build:rf

# Build apuntando al backend de develop (Render)
npm run build:admin:dev
npm run build:rf:dev
```

### 🔧 Utilidades

```bash
# Linting
npm run lint

# Formateo
npm run format
```

> **¿Cómo funciona el cambio de entorno?**
> Angular reemplaza automáticamente `environment.ts` por `environment.develop.ts` en tiempo de compilación
> dependiendo del flag `--configuration`. No se requiere ningún cambio manual en el código.
>
> | Configuración | Archivo activo | Backend |
> |---|---|---|
> | `development` (default) | `environment.ts` | `http://localhost:8080` |
> | `develop` | `environment.develop.ts` | `https://fourguard-be.onrender.com` |
> | `production` | `environment.ts` | `http://localhost:8080` *(actualizar para prod)* |



---

## 📐 Convenciones del Proyecto

### Nomenclatura de Archivos
```
feature/
  feature.component.ts   ← Lógica del componente
  feature.component.html ← Template (NUNCA inline)
  feature.component.css  ← Estilos (NUNCA inline)
  feature.routes.ts      ← Rutas lazy del feature
```

### Prefijos de Selectores
- `fg-admin-*` — Componentes de admin-console
- `fg-rf-*` — Componentes de rf-terminal
- `fg-*` — Componentes de shared-core

### Patrón de Signal Store
```typescript
// Siempre: signals privadas + computed públicos de solo lectura
private readonly _state = signal<StateShape>(INITIAL_STATE);
readonly items = computed(() => this._state().items);
readonly isLoading = computed(() => this._state().isLoading);

// Métodos de actualización (actions)
loadItems(): Observable<...> { ... }
setFilters(f: Partial<Filter>): void { ... }
```

---

## 🏛️ Principios de Capas (Clean Architecture Simplificada)

```
Presentation   → Componentes Angular (Templates + CSS)
Application    → Signal Stores (Estado reactivo)
Infrastructure → Servicios HTTP + Interceptores
Domain         → Modelos (Interfaces TypeScript) + Enums (FSM, Roles)
```

**Regla de dependencia:** Las capas superiores dependen de las inferiores. **Nunca al revés.**

---

## 📦 Dependencias Principales

| Paquete | Versión | Uso |
|---------|---------|-----|
| `@angular/core` | ^17.3 | Framework principal |
| `@angular/router` | ^17.3 | Routing con lazy loading |
| `@angular/service-worker` | ^17.3 | PWA offline (rf-terminal) |
| `rxjs` | ~7.8 | Programación reactiva |
| `dexie` | ^3.2 | IndexedDB para almacenamiento offline |
| `zone.js` | ~0.14 | Change detection Angular |

---

*Generado con Angular 17+ Workspace — 4GUARD WMS 3PL*
