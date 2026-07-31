# 4GUARD WMS — Librería `@4guard/shared-core`

> **Path:** `libs/shared-core/src/`  
> **Import:** `import { ... } from '@4guard/shared-core';`  
> **Scope:** Compartida entre `admin-console` y `rf-terminal`

---

## ⚠️ Contexto importante: BackendService es MOCK

`BackendService` (`@4guard/shared-core`) es un **backend simulado en localStorage**. Se usa para el `rf-terminal` PWA que opera offline en piso de almacén.

**Las features de `admin-console` usan `HttpClient` directo con `4Guard_BEAPI`.**  
No mezclar `BackendService` con los servicios HTTP de `admin-console`.

---

## Mapa de exports públicos

### 1. Enums de Dominio

#### `UserRole` — Roles del sistema

```typescript
import { UserRole, ROLE_LABELS, MODULE_PERMISSIONS, hasModuleAccess } from '@4guard/shared-core';

enum UserRole {
  ADMIN             = 'ROLE_ADMIN',
  WAREHOUSE_MANAGER = 'ROLE_WAREHOUSE_MANAGER',
  DOCK_SUPERVISOR   = 'ROLE_DOCK_SUPERVISOR',
  WAREHOUSE_OPERATOR= 'ROLE_WAREHOUSE_OPERATOR',
  QM_INSPECTOR      = 'ROLE_QM_INSPECTOR',
  AUDITOR           = 'ROLE_AUDITOR',
  CLIENT            = 'ROLE_CLIENT',
}
```

> ⚠️ Estos roles son del `rf-terminal`. El `admin-console` usa permisos granulares
> (`USERS_CREATE`, `CARRIERS_READ`, etc.) del JWT, no los roles directamente.

#### `MODULE_PERMISSIONS` — Mapa de acceso por módulo

```typescript
// Quién puede acceder a qué módulo
MODULE_PERMISSIONS = {
  'admin':     [ADMIN],
  'layout':    [ADMIN, WAREHOUSE_MANAGER],
  'dashboard': [ADMIN, WAREHOUSE_MANAGER, AUDITOR, CLIENT],
  'inventory': [ADMIN, WAREHOUSE_MANAGER, DOCK_SUPERVISOR, AUDITOR, CLIENT],
  'receiving': [ADMIN, WAREHOUSE_MANAGER, DOCK_SUPERVISOR, WAREHOUSE_OPERATOR],
  'quality':   [ADMIN, WAREHOUSE_MANAGER, QM_INSPECTOR],
  'shipping':  [ADMIN, WAREHOUSE_MANAGER, DOCK_SUPERVISOR, WAREHOUSE_OPERATOR],
  'counting':  [ADMIN, WAREHOUSE_MANAGER, WAREHOUSE_OPERATOR, AUDITOR],
}

// Verificar acceso
hasModuleAccess(role: UserRole, module: string): boolean
```

#### `InventoryStatus` — Estados del inventario

```typescript
import { InventoryStatus, INVENTORY_FSM_TRANSITIONS, isValidTransition } from '@4guard/shared-core';

// Estados + transiciones FSM para inventario
```

---

### 2. Modelos de Dominio

```typescript
import type { User, JwtPayload, AuthResponse, LoginRequest } from '@4guard/shared-core';
import type { Branch, LoginResponse } from '@4guard/shared-core';
import type { Item, ItemFilter, PagedItemResponse } from '@4guard/shared-core';
import type { Location, Coordinates2D, Coordinates3D } from '@4guard/shared-core';
import type { Receipt, ReceiptLine } from '@4guard/shared-core';
import type { TransferOrder, TransferOrderLine } from '@4guard/shared-core';
```

---

### 3. Interceptores HTTP (para `rf-terminal`)

```typescript
import { jwtInterceptor }         from '@4guard/shared-core'; // JWT Bearer Token
import { branchInterceptor }      from '@4guard/shared-core'; // Inyecta branchId en headers
import { mockBackendInterceptor } from '@4guard/shared-core'; // Mock para desarrollo offline
```

> ✅ En `admin-console` se usa el `authInterceptor` local (`core/interceptors/auth.interceptor.ts`), **no** el `jwtInterceptor` de shared-core.

---

### 4. Estado Global (Application Layer)

#### `AuthState` — Estado de sesión

```typescript
import { AuthState } from '@4guard/shared-core';

// En componente de admin-console:
private authState = inject(AuthState);

// Signals disponibles:
authState.user()          // User | null — usuario autenticado
authState.isAuthenticated() // boolean
authState.role()          // UserRole | null
authState.branchId()      // string | null
authState.isLoading()     // boolean
authState.userFullName()  // 'Juan García'
authState.userInitials()  // 'JG' — para avatar
authState.roleLabel()     // 'Administrador'

// Métodos:
authState.canAccessModule('carriers') // boolean
authState.hasRole(UserRole.ADMIN)     // boolean
authState.login(credentials)          // Observable<User>
authState.logout()                    // void
```

#### `InventoryState` — Estado de inventario (rf-terminal)

```typescript
import { InventoryState } from '@4guard/shared-core';
// Usado principalmente en rf-terminal para estado del inventario en memoria
```

#### `SyncState` — Estado de sincronización offline

```typescript
import { SyncState } from '@4guard/shared-core';
// Para la cola de operaciones offline del rf-terminal
```

---

### 5. `AuthService` (shared-core) vs `AuthService` (admin-console)

⚠️ **Hay DOS AuthService:**

| | `@4guard/shared-core` AuthService | `core/services/auth.service.ts` |
|---|---|---|
| Scope | rf-terminal + compartido | admin-console únicamente |
| Accede a | `AuthState` signals | `SessionStorageService`, `4g_token` |
| Usar en | rf-terminal | admin-console features |

**En `admin-console`, siempre usar `AuthState` de shared-core para leer el estado de sesión.**

---

## Reglas de uso

```typescript
// ✅ Correcto en admin-console
import { AuthState, UserRole } from '@4guard/shared-core';
import { UsersService } from '../../../core/services/users.service';  // HTTP local

// ❌ Incorrecto en admin-console
import { BackendService } from '@4guard/shared-core'; // Es el mock de rf-terminal
```

---

## Token almacenado

El JWT de sesión se guarda en `localStorage` con la clave:

```
localStorage.getItem('4g_token')  ← access token
```

El `authInterceptor` de `admin-console` lo lee desde ahí y lo adjunta como `Bearer`.
