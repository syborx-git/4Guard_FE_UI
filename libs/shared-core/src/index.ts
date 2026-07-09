/**
 * @file index.ts
 * @description Barrel exports públicos de la librería @4guard/shared-core.
 *
 * IMPORTANTE: Solo exportar lo que se considera API pública de la librería.
 * Los detalles de implementación internos NO deben exportarse desde aquí.
 *
 * Orden: Domain → Infrastructure → Application
 */

// ─── Domain — Enums ───────────────────────────────────────────────────────────
export {
  InventoryStatus,
  INVENTORY_FSM_TRANSITIONS,
  INVENTORY_STATUS_LABELS,
  isValidTransition,
} from './lib/domain/enums/inventory-status.enum';

export {
  UserRole,
  ROLE_LABELS,
  MODULE_PERMISSIONS,
  hasModuleAccess,
} from './lib/domain/enums/role.enum';

// ─── Domain — Models ──────────────────────────────────────────────────────────
export type { User, JwtPayload, AuthResponse, LoginRequest } from './lib/domain/models/user.model';
export type { Branch, LoginResponse } from './lib/domain/models/login.model';

export {
  UnitOfMeasure,
} from './lib/domain/models/item.model';
export type { Item, ItemFilter, PagedItemResponse } from './lib/domain/models/item.model';

export {
  LocationType,
  getOccupancyPercent,
} from './lib/domain/models/location.model';
export type { Location, Coordinates2D, Coordinates3D } from './lib/domain/models/location.model';

export {
  ReceiptStatus,
} from './lib/domain/models/receipt.model';
export type { Receipt, ReceiptLine } from './lib/domain/models/receipt.model';

export {
  TransferOrderType,
  TransferOrderStatus,
} from './lib/domain/models/transfer-order.model';
export type { TransferOrder, TransferOrderLine } from './lib/domain/models/transfer-order.model';

// ─── Infrastructure — Interceptors ────────────────────────────────────────────
export { jwtInterceptor }    from './lib/infrastructure/interceptors/jwt.interceptor';
export { branchInterceptor } from './lib/infrastructure/interceptors/branch.interceptor';
export { mockBackendInterceptor } from './lib/infrastructure/interceptors/mock-backend.interceptor';

// ─── Infrastructure — Services (Singletons) ───────────────────────────────────
export { AuthService }    from './lib/infrastructure/services/auth.service';
export { LoginService }    from './lib/infrastructure/services/login.service';
export { BackendService } from './lib/infrastructure/services/backend.service';
export type { ApiError, QueryParams } from './lib/infrastructure/services/backend.service';
export { SyncService }    from './lib/infrastructure/services/sync.service';
export type { SyncOperation, SyncStatus } from './lib/infrastructure/services/sync.service';

// ─── Application — State Stores ───────────────────────────────────────────────
export { AuthState }      from './lib/application/state/auth.state';
export { InventoryState } from './lib/application/state/inventory.state';
export { SyncState }      from './lib/application/state/sync.state';
