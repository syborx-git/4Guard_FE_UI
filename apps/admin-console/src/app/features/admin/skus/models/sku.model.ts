/**
 * @file sku.model.ts
 * @description Interfaces y tipos para el Catálogo de Productos / SKUs — 4GUARD WMS.
 */

export type ProductSkuStatus = 'ACTIVE' | 'INACTIVE';

export interface UnitOption {
  value: string;
  label: string;
}

export const UNIT_OPTIONS: UnitOption[] = [
  { value: 'BOX',    label: 'Caja (BOX)' },
  { value: 'PZA',    label: 'Pieza (PZA)' },
  { value: 'PCS',    label: 'Piezas (PCS)' },
  { value: 'KG',     label: 'Kilogramos (KG)' },
  { value: 'PALLET', label: 'Tarima / Pallet (PALLET)' },
  { value: 'LITRO',  label: 'Litros (LITRO)' },
  { value: 'BAG',    label: 'Bolsa / Saco (BAG)' },
];

export interface ProductSku {
  id: string;
  clientId: string;
  clientName: string;
  code: string;        // Código único de SKU (max 50 chars)
  name: string;        // Nombre comercial (max 200 chars)
  description?: string;
  weight?: number;     // Peso decimal (ej. 12.500 kg)
  unit: string;        // Unidad de medida (BOX, KG, PALLET, etc.)
  status?: ProductSkuStatus; // ACTIVE | INACTIVE
  isDeleted?: boolean; // Borrado lógico
  version?: number;
  createdAt?: string;  // ISO 8601
  updatedAt?: string;  // ISO 8601
}

export interface ProductSkuResponse {
  id: string;
  clientId: string;
  clientName: string;
  code: string;
  name: string;
  description?: string;
  weight?: number;
  unit: string;
  status?: ProductSkuStatus;
  isDeleted?: boolean;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateProductSkuRequest {
  clientId: string;
  code: string;
  name: string;
  description?: string;
  weight?: number;
  unit: string;
  status?: ProductSkuStatus;
}

export interface UpdateProductSkuRequest {
  id: string;
  clientId: string;
  code: string;
  name: string;
  description?: string;
  weight?: number;
  unit: string;
  status?: ProductSkuStatus;
}

// ─── Auditoría BE (GET /api/v1/product-skus/{id}/audit) ─────────────────────

export interface AuditDetail {
  fieldName: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
}

export interface ProductSkuAuditLog {
  logId?: string;
  id: string;
  action: 'PRODUCT_SKU_CREATED' | 'PRODUCT_SKU_UPDATED' | 'PRODUCT_SKU_DELETED' | 'PRODUCT_SKU_STATUS_CHANGED' | 'PRODUCT_SKU_SOFT_DELETED' | string;
  username?: string;
  performedBy: string;
  createdAt?: string;
  performedAt: string;
  summary?: string;
  timelineIcon?: string;
  timelineColor?: 'create' | 'update' | 'delete' | 'status';
  details?: AuditDetail[];
}

export interface ApiResponse<T> {
  status?: number;
  message?: string;
  data: T;
  timestamp?: string;
  success?: boolean;
}

/** Icono según la acción de auditoría */
export function getSkuAuditIcon(action: string): string {
  switch (action) {
    case 'PRODUCT_SKU_CREATED':
      return 'inventory_2';
    case 'PRODUCT_SKU_UPDATED':
      return 'edit_note';
    case 'PRODUCT_SKU_STATUS_CHANGED':
      return 'published_with_changes';
    case 'PRODUCT_SKU_SOFT_DELETED':
    case 'PRODUCT_SKU_DELETED':
      return 'delete_forever';
    default:
      return 'history';
  }
}

/** Color según la acción de auditoría */
export function getSkuAuditColor(action: string): 'create' | 'update' | 'delete' | 'status' {
  switch (action) {
    case 'PRODUCT_SKU_CREATED':
      return 'create';
    case 'PRODUCT_SKU_UPDATED':
      return 'update';
    case 'PRODUCT_SKU_STATUS_CHANGED':
      return 'status';
    case 'PRODUCT_SKU_SOFT_DELETED':
    case 'PRODUCT_SKU_DELETED':
      return 'delete';
    default:
      return 'update';
  }
}

/** Resumen según la acción de auditoría */
export function getSkuAuditSummary(action: string): string {
  switch (action) {
    case 'PRODUCT_SKU_CREATED':
      return 'Producto / SKU registrado en el catálogo';
    case 'PRODUCT_SKU_UPDATED':
      return 'Modificación de atributos de producto';
    case 'PRODUCT_SKU_STATUS_CHANGED':
      return 'Cambio de estatus operativo (ACTIVE / INACTIVE)';
    case 'PRODUCT_SKU_SOFT_DELETED':
      return 'Eliminación lógica de producto del catálogo';
    case 'PRODUCT_SKU_DELETED':
      return 'Producto / SKU eliminado permanentemente';
    default:
      return 'Evento de auditoría de SKU';
  }
}
