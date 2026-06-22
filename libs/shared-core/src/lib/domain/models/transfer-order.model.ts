/**
 * @file transfer-order.model.ts
 * @description Modelo de dominio para Órdenes de Transferencia (picking/despacho).
 * Mapea el DTO TransferOrderResponseDto del Backend Spring Boot.
 */

import { InventoryStatus } from '../enums/inventory-status.enum';

/**
 * Tipo de orden de transferencia.
 */
export enum TransferOrderType {
  /** Salida del almacén hacia el cliente final */
  OUTBOUND = 'OUTBOUND',
  /** Movimiento interno entre ubicaciones del mismo almacén */
  INTERNAL = 'INTERNAL',
  /** Devolución de cliente al almacén */
  RETURN = 'RETURN',
}

/**
 * Estados de una orden de transferencia.
 */
export enum TransferOrderStatus {
  /** Orden creada, pendiente de asignación */
  PENDING = 'PENDING',
  /** Orden asignada a un operario */
  ASSIGNED = 'ASSIGNED',
  /** Picking en proceso */
  IN_PICKING = 'IN_PICKING',
  /** Ítems listos en zona de staging */
  READY_TO_SHIP = 'READY_TO_SHIP',
  /** Despacho completado */
  DISPATCHED = 'DISPATCHED',
  /** Orden cancelada */
  CANCELLED = 'CANCELLED',
}

/**
 * Línea de detalle de una orden de transferencia.
 */
export interface TransferOrderLine {
  /** ID de la línea */
  id: string;

  /** ID de la orden padre */
  transferOrderId: string;

  /** SKU del ítem a mover */
  sku: string;

  /** Descripción del producto */
  description: string;

  /** ID del ítem específico en inventario */
  itemId: string;

  /** Cantidad solicitada */
  requestedQuantity: number;

  /** Cantidad pickeada/movida */
  pickedQuantity: number;

  /** Ubicación de origen */
  fromLocationId: string;

  /** Ubicación de destino */
  toLocationId: string;

  /** Estado actual del ítem asociado */
  itemStatus: InventoryStatus;

  /** Número de lote */
  batchNumber: string;

  /** Confirmación del operario (escaneo) */
  confirmedByScan: boolean;
}

/**
 * Orden de Transferencia (Picking / Despacho / Movimiento interno).
 */
export interface TransferOrder {
  /** Identificador único (UUID) */
  id: string;

  /** Número de orden legible (ej: TO-2024-00123) */
  orderNumber: string;

  /** Tipo de transferencia */
  type: TransferOrderType;

  /** Estado actual */
  status: TransferOrderStatus;

  /** ID del cliente 3PL */
  clientId: string;

  /** Nombre del cliente */
  clientName: string;

  /** ID de la sucursal */
  branchId: string;

  /** ID del operario asignado (null si aún no asignado) */
  assignedOperatorId: string | null;

  /** Nombre del operario asignado */
  assignedOperatorName: string | null;

  /** Prioridad: 1 (máxima) a 5 (mínima) */
  priority: 1 | 2 | 3 | 4 | 5;

  /** Fecha límite de despacho (ISO 8601) */
  dueDate: string;

  /** Fecha de inicio de picking (ISO 8601, null si no inició) */
  startedAt: string | null;

  /** Fecha de finalización (ISO 8601, null si no terminó) */
  completedAt: string | null;

  /** Referencia de la orden del cliente */
  clientOrderReference: string | null;

  /** Líneas de detalle */
  lines: TransferOrderLine[];

  /** Notas adicionales */
  notes: string | null;

  /** Fecha de creación (ISO 8601) */
  createdAt: string;

  /** Fecha de última actualización (ISO 8601) */
  updatedAt: string;
}
