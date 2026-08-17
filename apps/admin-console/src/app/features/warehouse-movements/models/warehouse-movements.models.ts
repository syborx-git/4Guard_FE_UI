/**
 * @file warehouse-movements.models.ts
 * @description Modelos e interfaces TypeScript para el módulo Movimientos de Almacén.
 */

export type PalletType =
  | 'MADERA'
  | 'PLASTICO'
  | 'PLASTICO_AZUL'
  | 'MADERA_EXPORTACION'
  | 'SIN_TARIMA'
  | 'MADERA_ESTANDAR'
  | 'TARIMA_CHEP';

export const PALLET_TYPE_LABELS: Record<PalletType, string> = {
  MADERA: 'Madera',
  PLASTICO: 'Plástico',
  PLASTICO_AZUL: 'Plástico Azul',
  MADERA_EXPORTACION: 'Madera Exportación',
  SIN_TARIMA: 'Sin Tarima',
  MADERA_ESTANDAR: 'Madera Estándar',
  TARIMA_CHEP: 'Tarima CHEP',
};

export interface CarrierLineItem {
  code: string;
  name: string;
}

export interface ClientItem {
  code: string;
  name: string;
}

export interface RampItem {
  code: string;
  rampNumber: number;
  name: string;
}

export interface ForkliftOperatorItem {
  code: string;
  name: string;
}

export interface CheckInCasetaData {
  carrierLineCode?: string; // Código Línea Transportadora (ej. TR-01)
  carrierLine: string;      // Línea Transportadora Descripción
  receptionTime: string;    // Hora Recepción (ej. 09:15)
  docNumber: string;        // Doc. No. (Remisión/Factura)
  elaborationDate?: string; // F. Elaboración
  expirationDate?: string;  // Caducidad
  lotNumber?: string;       // Lote de Recepción
  docDate: string;          // Fecha Doc.
  clientCode?: string;      // Código Cliente (ej. CLI-004)
  client: string;           // Cliente Descripción
  rampCode?: string;        // Código Rampa
  rampNumber: number;       // Rampa No. (1-12)
  forkliftOperatorCode?: string; // ID Montacarguista
  forkliftOperator: string; // Montacarguista Nombre
  driverName: string;       // Operador (Chofer)
  tractorPlates: string;    // Placas Tracto
  boxPlates: string;        // Placas Caja
  sealNumber: string;       // No. Sello
  sealNumbers?: string[];   // Lista de sellos agregados
}

export interface ReceptionPalletItem {
  id: string;               // ID consecutivo o timestamp
  palletNumber?: number;    // N. Tarima (1, 2, 3...)
  palletCode: string;       // Código Tarima / UA (ej. 037613041909243094)
  description: string;      // Descripción SKU
  productId: string;        // SKU (ej. 12572733)
  supplierName?: string;    // Proveedor (ej. LE MEXICO S.A DE C.V)
  pieces: number;           // Cant X Tarima (ej. 40.00)
  observations?: string;    // Observaciones
  palletTypeId: PalletType; // Tipo Tarima key
  palletTypeLabel: string;  // Tipo Tarima nombre legible
}

export interface ReceptionHeader {
  folio: string;             // ej. 26506
  status: 'REGISTERED' | 'COMPLETED' | 'CANCELLED';
  checkIn: CheckInCasetaData;
  lotNumber: string;
  elaborationDate: string;
  expirationDate: string;
  productId: string;
  productName: string;
  supplierName?: string;     // Nombre del proveedor seleccionado
  storageLocation?: string;  // Lugar de almacenaje (ej. Bodega M 98)
  piecesPerPallet: number;
  selectedPalletType: PalletType;
  observations?: string;
  pallets: ReceptionPalletItem[];
  createdAt: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  capturedBy: string;        // Nombre del usuario activo
  leaderAuthorizedBy?: string; // Nombre del líder que autorizó
}

export interface TransferReasonItem {
  id: string;
  label: string;
  description: string;
  requiresObservation?: boolean;
}

export const TRANSFER_REASONS: TransferReasonItem[] = [
  { id: 'OPT_ESPACIO', label: 'Optimización de espacio', description: 'Reorganización de ubicaciones para mejorar el aprovechamiento volumétrico.' },
  { id: 'REUB_OPERATIVA', label: 'Reubicación operativa', description: 'Movimiento preventivo o preparativo para surtido y despacho.' },
  { id: 'LIB_BAHIA', label: 'Liberación de bahía', description: 'Desocupación de bahía para recepción, auditoría o mantenimiento.' },
  { id: 'CONSOLIDACION', label: 'Consolidación de inventario', description: 'Agrupación de lotes y UAs compatibles en una sola posición.' },
  { id: 'SOL_CLIENTE', label: 'Solicitud del cliente', description: 'Instrucción directa del cliente para segregar o trasladar mercancía.' },
  { id: 'INCIDENCIA', label: 'Incidencia / Desvío de calidad', description: 'Aislamiento temporal de tarimas por inspección de calidad QM.' },
  { id: 'OTRO', label: 'Otro motivo (especificar)', description: 'Motivo extraordinario no catalogado.', requiresObservation: true },
];

export interface WarehouseTransfer {
  id?: string;
  folio: string;             // ej. CAM-2026-000001
  status?: 'DRAFT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  forkliftOperator: string;  // Montacarguista responsable
  forkliftOperatorId?: string;
  originLocation: string;    // ej. A-14
  destinationLocation: string; // ej. M-98
  reasonId?: string;
  reasonLabel?: string;
  observations?: string;
  pallets: ReceptionPalletItem[];
  totalPallets: number;
  totalPieces: number;
  distinctSkus?: number;
  timestamp?: string;
  transferredAt: string;
  transferredBy: string;
  clientName?: string;
}

export interface LocationStockInfo {
  locationCode: string;
  warehouseName?: string;
  zone?: string;
  aisle?: string;
  rack?: string;
  level?: string;
  capacity?: number;
  occupancy?: number;
  availableCapacity?: number;
  isBlocked?: boolean;
  blockReason?: string;
  totalPallets: number;
  totalPieces: number;
  pallets: ReceptionPalletItem[];
}

export interface InventoryBatch {
  remisionNo: string;
  client: string;
  productId: string;
  productName: string;
  lotNumber: string;
  elaborationDate: string;
  expirationDate: string;
  availablePallets: number;
  totalPieces: number;
  locationCode: string;
  isFifoSuggested?: boolean; // Highlight visual para el más antiguo
  pallets: ReceptionPalletItem[];
}

export interface OutboundDispatch {
  folio: string;             // ej. DESP-8821
  client: string;
  destinationPlant: string;  // ej. Nestlé Planta Toluca
  sealNumber: string;        // No. Sello/Cincho (Obligatorio)
  carrierName: string;       // Transportista
  driverName: string;
  economicNumber: string;
  tractorPlates: string;
  boxPlates: string;
  transportType: 'Camioneta' | 'Torton' | 'Tráiler';
  forkliftOperator: string;
  productId: string;
  productName: string;
  selectedPallets: ReceptionPalletItem[];
  totalPallets: number;
  totalPieces: number;
  dispatchedAt: string;
  dispatchedBy: string;
}
