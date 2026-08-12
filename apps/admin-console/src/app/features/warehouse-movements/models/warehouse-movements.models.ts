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
  palletCode: string;       // Código Tarima / UA (ej. UA-90821)
  description: string;      // Descripción SKU
  productId: string;        // ID Producto
  pieces: number;           // Pzas
  observations?: string;    // Observaciones
  palletTypeId: PalletType; // Tipo Tarima key
  palletTypeLabel: string;  // Tipo Tarima nombre legible
}

export interface ReceptionHeader {
  folio: string;             // ej. 26510
  status: 'REGISTERED' | 'COMPLETED' | 'CANCELLED';
  checkIn: CheckInCasetaData;
  lotNumber: string;
  elaborationDate: string;
  expirationDate: string;
  productId: string;
  productName: string;
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

export interface WarehouseTransfer {
  folio: string;             // ej. TR-4081
  forkliftOperator: string;  // Montacarguista
  originLocation: string;    // ej. A-14
  destinationLocation: string; // ej. M-98
  pallets: ReceptionPalletItem[];
  totalPallets: number;
  totalPieces: number;
  transferredAt: string;
  transferredBy: string;
}

export interface LocationStockInfo {
  locationCode: string;
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
