/**
 * @file item.model.ts
 * @description Modelo de dominio para un Ítem de inventario en el WMS 4GUARD.
 * Mapea exactamente el DTO ItemResponseDto del Backend Spring Boot.
 */

import { InventoryStatus } from '../enums/inventory-status.enum';

/**
 * Unidades de medida soportadas por el sistema.
 */
export enum UnitOfMeasure {
  UNIT   = 'UNIT',
  BOX    = 'BOX',
  PALLET = 'PALLET',
  KG     = 'KG',
  LITER  = 'LITER',
}

/**
 * Ítem de inventario en el almacén.
 * Representa la unidad mínima de control de stock.
 */
export interface Item {
  /** Identificador único del ítem (UUID) */
  id: string;

  /** Código SKU del producto */
  sku: string;

  /** Descripción del producto */
  description: string;

  /** ID del cliente 3PL propietario del inventario */
  clientId: string;

  /** Nombre del cliente */
  clientName: string;

  /** Número de lote (batch) */
  batchNumber: string;

  /** Fecha de vencimiento (ISO 8601, null si no aplica) */
  expiryDate: string | null;

  /** Cantidad actual en stock */
  quantity: number;

  /** Unidad de medida */
  unitOfMeasure: UnitOfMeasure;

  /** ID de la ubicación actual en el rack */
  locationId: string | null;

  /** Estado actual en la FSM de inventario */
  status: InventoryStatus;

  /** ID de la sucursal donde se encuentra el ítem */
  branchId: string;

  /** Peso unitario en kilogramos */
  weightKg: number;

  /** Volumen unitario en metros cúbicos */
  volumeM3: number;

  /** Código de barras principal */
  barcode: string;

  /** Código SSCC del pallet (si aplica) */
  sscc: string | null;

  /** Fecha de recepción en el almacén (ISO 8601) */
  receivedAt: string;

  /** Fecha de última modificación de estado (ISO 8601) */
  lastStatusChangeAt: string;

  /** Notas adicionales del inspector o supervisor */
  notes: string | null;

  /** Metadatos adicionales en formato JSON (extensible) */
  metadata: Record<string, unknown> | null;
}

/**
 * Filtros para consulta de ítems.
 */
export interface ItemFilter {
  sku?: string;
  status?: InventoryStatus;
  clientId?: string;
  locationId?: string;
  batchNumber?: string;
  branchId?: string;
  page?: number;
  size?: number;
  sortBy?: keyof Item;
  sortDir?: 'asc' | 'desc';
}

/**
 * Respuesta paginada de la API de ítems.
 */
export interface PagedItemResponse {
  content: Item[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}
