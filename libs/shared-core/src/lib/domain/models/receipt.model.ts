/**
 * @file receipt.model.ts
 * @description Modelo de dominio para Recepciones (inbound) de mercancía.
 * Mapea el DTO ReceiptResponseDto del Backend Spring Boot.
 */

import { InventoryStatus } from '../enums/inventory-status.enum';

/**
 * Estados de una recepción.
 */
export enum ReceiptStatus {
  /** Recepción planificada, aún no iniciada */
  PLANNED = 'PLANNED',
  /** En proceso de descarga en andén */
  IN_PROGRESS = 'IN_PROGRESS',
  /** Recepción completada y ítems registrados */
  COMPLETED = 'COMPLETED',
  /** Recepción con discrepancias pendientes de resolución */
  DISCREPANCY = 'DISCREPANCY',
  /** Recepción cancelada */
  CANCELLED = 'CANCELLED',
}

/**
 * Línea de detalle de una recepción (cada SKU/lote recibido).
 */
export interface ReceiptLine {
  /** ID de la línea */
  id: string;

  /** ID de la recepción padre */
  receiptId: string;

  /** SKU esperado */
  sku: string;

  /** Descripción del producto */
  description: string;

  /** Cantidad esperada según ASN (Advance Ship Notice) */
  expectedQuantity: number;

  /** Cantidad físicamente recibida y escaneada */
  receivedQuantity: number;

  /** Diferencia (received - expected): negativo = faltante, positivo = sobrante */
  discrepancy: number;

  /** Estado del ítem generado al recibirlo */
  itemStatus: InventoryStatus;

  /** Número de lote */
  batchNumber: string;

  /** Fecha de vencimiento (ISO 8601, null si no aplica) */
  expiryDate: string | null;

  /** Código de barras escaneado */
  barcode: string;

  /** Notas del operario que recibió */
  notes: string | null;
}

/**
 * Recepción de mercancía en el almacén.
 */
export interface Receipt {
  /** Identificador único (UUID) */
  id: string;

  /** Número de referencia del ASN del cliente */
  asnReference: string;

  /** ID del cliente 3PL */
  clientId: string;

  /** Nombre del cliente */
  clientName: string;

  /** ID de la sucursal */
  branchId: string;

  /** ID del andén (dock door) asignado */
  dockId: string;

  /** Estado general de la recepción */
  status: ReceiptStatus;

  /** Fecha/hora planificada de llegada (ISO 8601) */
  scheduledArrival: string;

  /** Fecha/hora real de inicio de descarga (ISO 8601, null si no inició) */
  startedAt: string | null;

  /** Fecha/hora de finalización (ISO 8601, null si no terminó) */
  completedAt: string | null;

  /** ID del supervisor que aprobó la recepción */
  supervisorId: string | null;

  /** Líneas de detalle de la recepción */
  lines: ReceiptLine[];

  /** Notas generales de la recepción */
  notes: string | null;

  /** Fecha de creación (ISO 8601) */
  createdAt: string;

  /** Fecha de última actualización (ISO 8601) */
  updatedAt: string;
}
