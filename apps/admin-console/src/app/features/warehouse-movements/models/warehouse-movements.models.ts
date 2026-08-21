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
  destinations?: ClientDestination[];
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
  id: string;               // ID consecutivo o timestamp (o UUID de inventory_items)
  palletNumber?: number;    // N. Tarima (1, 2, 3...)
  palletCode: string;       // Código Tarima / UA (ej. 037613041909243094)
  description: string;      // Descripción SKU
  productId: string;        // SKU (ej. 12572733)
  supplierName?: string;    // Proveedor (ej. LE MEXICO S.A DE C.V)
  pieces: number;           // Cant X Tarima (ej. 40.00)
  observations?: string;    // Observaciones
  palletTypeId: PalletType; // Tipo Tarima key
  palletTypeLabel: string;  // Tipo Tarima nombre legible
  status?: string;          // Estado de la tarima (ej. SCANNED, STORED, DISPATCHED)
}

export interface ReceptionHeader {
  id?: string;               // UUID del backend
  folio: string;             // ej. 26506 / REC-2026-000001
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
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
}

export interface LocationStockInfo {
  locationCode: string;
  /** UUID del Backend — necesario para enviar originLocationId / destinationLocationId al BE */
  locationId?: string;
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

// ─── SALIDA DE ALMACÉN (OUTBOUND MVP1) ────────────────────────────────────────

export type OutboundStatus = 'COMPLETED' | 'CANCELLED';
export type TransportType = 'CAMION' | 'TORTON' | 'TRAILER';

export interface OutboundItem {
  id: string;
  palletCode: string;        // Código UA / SSCC (ej. 'UA-8810-1')
  productId: string;         // SKU
  description: string;       // Descripción del producto
  lotNumber: string;         // Lote de fabricación
  expirationDate: string;    // Fecha de caducidad
  pieces: number;            // Piezas en la tarima
  palletTypeId: string;      // Tipo de tarima
  palletTypeLabel: string;
  locationCode?: string;     // Bahía de origen
}

export interface WarehouseOutbound {
  id: string;
  folio: string;             // 'SAL-YYYY-XXXXXX'
  status: OutboundStatus;

  // Cliente / Destino (Snapshot)
  clientCode: string;
  clientName: string;
  destinationId: string;
  destinationName: string;
  destinationAddress?: string;

  // Transportista / Vehículo (Snapshot)
  carrierCode: string;
  carrierName: string;
  driverName: string;
  economicNumber: string;
  tractorPlates: string;
  boxPlates: string;
  transportType: TransportType;
  sealNumber: string;

  // Mercancía
  remisionNo: string;
  items: OutboundItem[];
  totalPallets: number;
  totalPieces: number;
  distinctSkus: number;

  // Auditoría
  dispatchedAt: string;
  dispatchedBy: string;
  timestamp: string;         // HH:mm para tarjeta del directorio
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
}

export interface ClientDestination {
  id: string;
  clientCode: string;
  name: string;
  address: string;
  city: string;
  state: string;
  contactName?: string;
  contactPhone?: string;
  status: 'ACTIVO' | 'INACTIVO';
}

export const TRANSPORT_TYPES: { id: TransportType; label: string }[] = [
  { id: 'CAMION',  label: 'Camión' },
  { id: 'TORTON',  label: 'Tórtón' },
  { id: 'TRAILER', label: 'Tráiler' },
];

export const CLIENT_DESTINATIONS: ClientDestination[] = [
  // Nestlé México (CLI-001)
  { id: 'DEST-CLI001-TOLUCA', clientCode: 'CLI-001', name: 'CEDIS Toluca',      address: 'Blvd. Aeropuerto 2112', city: 'Toluca',            state: 'Estado de México', status: 'ACTIVO' },
  { id: 'DEST-CLI001-MTY',    clientCode: 'CLI-001', name: 'CEDIS Monterrey',   address: 'Av. Industrial 450',    city: 'Monterrey',         state: 'Nuevo León',      status: 'ACTIVO' },
  { id: 'DEST-CLI001-GDL',    clientCode: 'CLI-001', name: 'CEDIS Guadalajara', address: 'Carr. Zapopan 1800',    city: 'Guadalajara',       state: 'Jalisco',         status: 'ACTIVO' },
  { id: 'DEST-CLI001-CDMX',   clientCode: 'CLI-001', name: 'CEDIS CDMX Norte',  address: 'Av. Insurgentes 5500',  city: 'Ciudad de México',  state: 'CDMX',            status: 'ACTIVO' },
  // Nestlé Planta Toluca (CLI-002)
  { id: 'DEST-CLI002-TOLUCA', clientCode: 'CLI-002', name: 'Planta Toluca',     address: 'Blvd. Toluca Industrial 90', city: 'Toluca',       state: 'Estado de México', status: 'ACTIVO' },
  // Nestlé Planta Querétaro (CLI-003)
  { id: 'DEST-CLI003-QRO',    clientCode: 'CLI-003', name: 'Planta Querétaro',  address: 'Parque Industrial Querétaro', city: 'Querétaro',   state: 'Querétaro',       status: 'ACTIVO' },
  // Nestlé Planta Veracruz (CLI-004)
  { id: 'DEST-CLI004-VER',    clientCode: 'CLI-004', name: 'Planta Veracruz',   address: 'Km. 4.5 Carr. Veracruz-Xalapa', city: 'Veracruz',  state: 'Veracruz',        status: 'ACTIVO' },
];

// ─── CONTROL Y AUDITORÍA DE MOVIMIENTOS ──────────────────────────────────────

export interface MovementAuditDetail {
  fieldName: string;
  oldValue?: string;
  newValue?: string;
}

export interface MovementAuditEntry {
  id?: string;
  action: string;
  actionLabel?: string;
  username: string;
  timestamp: string;
  details?: MovementAuditDetail[];
  reason?: string;
  authorizedBy?: string;
  observations?: string;
}

