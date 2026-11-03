/**
 * @file receipt.model.ts
 * @description Modelo de dominio para Recepciones (inbound) de mercancía.
 * Mapea el DTO ReceiptResponseDto del Backend Spring Boot.
 */

import { InventoryStatus } from '../enums/inventory-status.enum';

/**
 * Estados de una recepción.
 */
/**
 * Estados de una recepción en el ciclo de vida operativo WMS.
 */
export enum ReceiptStatus {
  /** Recepción planificada, aún no iniciada */
  PLANNED = 'PLANNED',
  /** Unidad vehicular registrada y asignada a rampa/andén desde caseta */
  RAMP_ASSIGNED = 'RAMP_ASSIGNED',
  /** En proceso de descarga física en andén por el montacarguista */
  IN_PROGRESS = 'IN_PROGRESS',
  /** Descarga física concluida en RF — Visto bueno administrativo pendiente */
  DISCHARGED_PENDING_APPROVAL = 'DISCHARGED_PENDING_APPROVAL',
  /** Recepción completada y aprobada administrativamente; stock ingresado a inventario */
  COMPLETED = 'COMPLETED',
  /** Recepción con discrepancias pendientes de resolución */
  DISCREPANCY = 'DISCREPANCY',
  /** Recepción cancelada */
  CANCELLED = 'CANCELLED',
}

/**
 * Representación granular de una tarima / LPN individual escaneada.
 */
export interface ReceiptPallet {
  /** UUID o consecutivo del pallet */
  id: string;

  /** ID de la línea de recepción padre (SKU/Lote) */
  lineId?: string;

  /** Número consecutivo de tarima (1..N) */
  palletNumber?: number;

  /** Código de tarima / LPN de 18 a 20 dígitos (ej. 037613041909243094) */
  palletCode: string;

  /** Cantidad física exacta de piezas contenidas */
  pieces: number;

  /** Tipo de tarima (CHEP, Madera Nacional, Natural, etc.) */
  palletType: string;

  /** Observaciones específicas de la tarima o estado de embalaje */
  observations?: string;

  /** Ubicación asignada (rampa o posición física en rack) */
  locationCode?: string;

  /** Timestamp en que fue escaneada en terminal RF */
  scannedAt?: string;

  /** Usuario/Montacarguista que realizó el escaneo */
  scannedBy?: string;
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

  /** Cantidad esperada de piezas según ASN (Advance Ship Notice) */
  expectedQuantity: number;

  /** Cantidad físicamente recibida y escaneada */
  receivedQuantity: number;

  /** Total de tarimas esperadas para este SKU/Lote */
  expectedPallets?: number;

  /** Total de tarimas físicamente recibidas y escaneadas */
  receivedPallets?: number;

  /** Diferencia (received - expected): negativo = faltante, positivo = sobrante */
  discrepancy: number;

  /** Estado del ítem generado al recibirlo */
  itemStatus: InventoryStatus;

  /** Número de lote */
  batchNumber: string;

  /** Fecha de elaboración (ISO 8601, null si no aplica) */
  elaborationDate?: string | null;

  /** Fecha de vencimiento (ISO 8601, null si no aplica) */
  expiryDate: string | null;

  /** Código de barras escaneado */
  barcode: string;

  /** Tarimas individuales (LPN/UA) asociadas a esta línea */
  pallets?: ReceiptPallet[];

  /** Notas del operario que recibió */
  notes: string | null;
}

/**
 * Recepción de mercancía en el almacén (Folio maestro).
 */
export interface Receipt {
  /** Identificador único (UUID) */
  id: string;

  /** Folio único operativo de recepción (ej. REC-2026-000001) */
  folio?: string;

  /** Número de referencia del ASN del cliente / Orden de Compra */
  asnReference: string;

  /** Número de remisión / factura del proveedor */
  docNumber?: string;

  /** ID del cliente 3PL */
  clientId: string;

  /** Nombre del cliente */
  clientName: string;

  /** ID de la sucursal */
  branchId: string;

  /** ID del andén o rampa asignada (dock door) */
  dockId: string;

  /** Número de rampa física asignada (1-12) */
  rampNumber?: number | null;

  /** Código de rampa o bahía de staging */
  rampCode?: string;

  /** Estado general de la recepción */
  status: ReceiptStatus;

  /** Total de tarimas esperadas según ASN */
  totalExpectedPallets?: number;

  /** Total de piezas esperadas según ASN */
  totalExpectedPieces?: number;

  /** Total de tarimas físicamente escaneadas */
  totalScannedPallets?: number;

  /** Total de piezas físicamente escaneadas */
  totalScannedPieces?: number;

  /** Fecha/hora planificada de llegada (ISO 8601) */
  scheduledArrival: string;

  /** Fecha/hora real de arribo y registro en caseta (ISO 8601) */
  checkedInAt?: string | null;

  /** Fecha/hora real de inicio de descarga (ISO 8601, null si no inició) */
  startedAt: string | null;

  /** Fecha/hora en que concluyó la descarga física en RF (ISO 8601) */
  dischargedAt?: string | null;

  /** Fecha/hora de visto bueno y aprobación administrativa (ISO 8601) */
  completedAt: string | null;

  /** ID / Nombre del supervisor/líder que aprobó administrativamente la recepción */
  supervisorId: string | null;

  /** Usuario administrativo que otorgó el visto bueno final */
  adminApprovedBy?: string | null;

  /** Notas de la aprobación administrativa */
  adminApprovalNotes?: string | null;

  /** Líneas de detalle de la recepción (Multi-SKU y Multilote) */
  lines: ReceiptLine[];

  /** Notas generales de la recepción */
  notes: string | null;

  /** Horario de corte operativo aplicado (ej. 08:00 AM) */
  shiftCutoffTime?: string;

  /** Fecha de creación (ISO 8601) */
  createdAt: string;

  /** Fecha de última actualización (ISO 8601) */
  updatedAt: string;
}
