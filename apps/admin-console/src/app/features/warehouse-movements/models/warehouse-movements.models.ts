/**
 * @file warehouse-movements.models.ts
 * @description Modelos e interfaces TypeScript para el módulo Movimientos de Almacén.
 */

export type PalletType =
  | 'MADERA_OWENS'
  | 'MADERA_ESTANDAR'
  | 'PLASTICO_NEGRO_OWENS'
  | 'PLASTICO_AZUL'
  | 'TARIMA_CHEP_NACIONAL'
  | 'TARIMA_CHEP_EXPORTACION'
  | 'TARIMA_PLASTICO_NEGRO_ESTANDAR';

export const PALLET_TYPE_LABELS: Record<PalletType, string> = {
  MADERA_OWENS: 'Madera Owens',
  MADERA_ESTANDAR: 'Madera Estándar',
  PLASTICO_NEGRO_OWENS: 'Plástico Negro Owens',
  PLASTICO_AZUL: 'Plástico Azul',
  TARIMA_CHEP_NACIONAL: 'Tarima CHEP Nacional',
  TARIMA_CHEP_EXPORTACION: 'Tarima CHEP Exportación',
  TARIMA_PLASTICO_NEGRO_ESTANDAR: 'Tarima Plástico Negro Estándar',
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
  id?: string;
  code: string;
  rampNumber: number;
  name: string;
}

export interface RampOccupancyStatus {
  rampNumber: number;
  code: string;
  name: string;
  status: 'AVAILABLE' | 'OCCUPIED_INBOUND' | 'OCCUPIED_OUTBOUND';
  statusLabel: string;
  operationType?: 'INBOUND' | 'OUTBOUND';
  operationFolio?: string;
  docNumber?: string;
  driverName?: string;
  carrierName?: string;
  forkliftOperator?: string;
  startedAt?: string;
}

export const STANDARD_WAREHOUSE_RAMPS: RampItem[] = Array.from({ length: 12 }, (_, i) => {
  const num = i + 1;
  const pad = String(num).padStart(2, '0');
  const hexSuffix = (0x925 + i).toString(16);
  return {
    id: `e13f0907-9fa5-4bdf-87db-2eb5e7683${hexSuffix}`,
    code: `LOC-RAMP-${pad}`,
    rampNumber: num,
    name: `Rampa ${pad}`,
  };
});

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
  forkliftOperator?: string; // Montacarguista Nombre (asignado en recepción)
  driverName: string;       // Operador (Chofer)
  tractorPlates: string;    // Placas Tracto
  boxPlates: string;        // Placas Caja
  sealNumber: string;       // No. Sello
  sealNumbers?: string[];   // Lista de sellos agregados
  economicNumber?: string;  // Número económico del vehículo
  transportType?: string;   // Tipo de transporte
  medidasCaja?: string;     // Medidas de la caja
  noCartaPorte?: string;    // Carta Porte
  observations?: string;    // Observaciones / Resumen Check List
  securityApproved?: boolean; // Visto bueno de seguridad patrimonial
  securityApprovedAt?: string;
  securityApprovedBy?: string;
  dockAssignedAt?: string;
  dischargeStartedAt?: string;
  dischargeEndedAt?: string;
}

export interface PatioUnitMonitor {
  id: string;
  folio: string;
  driverName: string;
  carrierLine: string;
  tractorPlates: string;
  boxPlates: string;
  economicNumber?: string;
  registeredAt: string;
  rampNumber?: number;
  rampAssignedAt?: string;
  dischargeStartedAt?: string;
  dischargeEndedAt?: string;
  status: 'CHECKED_IN' | 'RAMP_ASSIGNED' | 'DISCHARGING' | 'DISCHARGED_PENDING_EXIT' | 'COMPLETED';
  forkliftOperator?: string;
  palletType?: PalletType;
  waitTimeMinutes: number;
  dischargeTimeMinutes: number;
  hasWaitAlert: boolean; // Alerta > 8 horas en espera
  hasDischargeAlert: boolean; // Alerta > 2.5 horas en descarga
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
  locationCode?: string;    // Ubicación física de la tarima
  lotNumber?: string;       // Lote
  expirationDate?: string;  // Fecha de caducidad
}

export type ReceptionStatus =
  | 'REGISTERED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'DISCHARGED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ReceptionHeader {
  id?: string;               // UUID del backend
  folio: string;             // ej. 26506 / REC-2026-000001
  status: ReceptionStatus;
  checkIn: CheckInCasetaData;
  lotNumber: string;
  elaborationDate: string;
  expirationDate: string;
  productId: string;
  skuCode?: string;          // Código de 8 dígitos del producto
  productName: string;
  supplierName?: string;     // Nombre del proveedor seleccionado
  storageLocation?: string;  // Lugar de almacenaje (ej. Pasillo A - Rack 01)
  storageLocationId?: string;
  storageLocationCode?: string;
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

export type OutboundStatus = 'DRAFT' | 'REGISTERED' | 'ASSIGNED' | 'IN_PROGRESS' | 'LOADED' | 'COMPLETED' | 'CANCELLED';
export type TransportType = 'CAMION' | 'TORTON' | 'TRAILER';

export interface OutboundItem {
  id: string;
  palletCode: string;        // Código UA / SSCC (ej. 'UA-8810-1')
  productId: string;         // SKU
  description: string;       // Descripción del producto
  clientName?: string;       // Cliente propietario
  inboundRemisionNo?: string;// Remisión de entrada original
  lotNumber: string;         // Lote de fabricación
  expirationDate: string;    // Fecha de caducidad
  pieces: number;            // Piezas en la tarima
  palletTypeId: string;      // Tipo de tarima
  palletTypeLabel: string;
  locationCode?: string;     // Bahía de origen
  palletNumber?: number;     // Número / posición de tarima
  pabloStatus?: 'PABLO_ALERT' | 'OPTIMAL' | 'EXPIRED';
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
  rampId?: string;
  rampNumber?: number;
  rampCode?: string;
  forkliftOperator?: string;
  forkliftOperatorId?: string;
  driverName: string;
  economicNumber: string;
  boxEconomicNumber?: string;
  tractorPlates: string;
  boxPlates: string;
  transportType: TransportType;
  sealNumber: string;

  // Mercancía
  remisionNo: string;
  observations?: string;
  items: OutboundItem[];
  totalPallets: number;
  totalPieces: number;
  distinctSkus: number;

  // Auditoría
  completedAt?: string;
  leaderAuthorizedBy?: string;
  dispatchedAt: string;
  dispatchedBy: string;
  timestamp?: string;         // HH:mm para tarjeta del directorio
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
  { id: 'b9c6beee-1e5b-4e3c-8e46-32f0390bf0df', clientCode: 'c9b4e182-7d3f-4e91-8845-a4b5c6d7e8f9', name: 'CENTRO DE NEGOCIO PAC', address: 'Planta Nestlé PAC', city: 'Toluca', state: 'Estado de México', status: 'ACTIVO' },
  { id: 'e2a4b891-3c7d-4f1e-9a52-78d1f046b9a2', clientCode: 'c9b4e182-7d3f-4e91-8845-a4b5c6d7e8f9', name: 'CENTRO DE NEGOCIO CULINARIOS', address: 'Planta Culinarios Nestlé', city: 'Toluca', state: 'Estado de México', status: 'ACTIVO' },
  { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', clientCode: 'c9b4e182-7d3f-4e91-8845-a4b5c6d7e8f9', name: 'CENTRO DE NEGOCIO CAFES', address: 'Planta Cafés Nestlé', city: 'Toluca', state: 'Estado de México', status: 'ACTIVO' },
  { id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8', clientCode: 'c9b4e182-7d3f-4e91-8845-a4b5c6d7e8f9', name: 'CENTRO DE NEGOCIO CAF', address: 'Planta Nestlé CAF', city: 'Toluca', state: 'Estado de México', status: 'ACTIVO' },
  { id: '550e8400-e29b-41d4-a716-446655440000', clientCode: 'c9b4e182-7d3f-4e91-8845-a4b5c6d7e8f9', name: 'CENTRO DE NEGOCIO CHOCOLATES', address: 'Planta Chocolates Nestlé', city: 'Toluca', state: 'Estado de México', status: 'ACTIVO' },
  { id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', clientCode: 'c9b4e182-7d3f-4e91-8845-a4b5c6d7e8f9', name: 'CENTRO DE NEGOCIO CAFÉ VERDE', address: 'Planta Nestlé Café Verde', city: 'Toluca', state: 'Estado de México', status: 'ACTIVO' },
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

