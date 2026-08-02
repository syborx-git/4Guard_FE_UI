/**
 * @file reception-appointment.models.ts
 * @description Modelos de datos, FSM, auditoría y mock seed data para HU-028 — Centro de Recepciones.
 */

export type AppointmentStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'ARRIVED'
  | 'IN_RECEIVING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'REJECTED';

export type PriorityLevel = 'NORMAL' | 'HIGH' | 'URGENT';
export type ReceptionType = 'NATIONAL' | 'IMPORT' | 'RETURN';

export interface ExpectedLine {
  lineId: string;
  sku: string;
  description: string;
  expectedQty: number;
  unit: string;
  expectedLot?: string;
  expectedExpirationDate?: string; // Preparado para futuras HUs de Calidad y FEFO
}

export interface ArrivalData {
  actualPlates: string;
  actualDriver?: string;
  sealPrimary: string;
  sealSecondary?: string;
  arrivedAt: string;
  registeredBy: string;
}

export interface ReceptionProgress {
  currentStep: 1 | 2;
  startedAt?: string;
  startedBy?: string;
  vehicleDataCompleted: boolean;
  reconciliationCompleted: boolean;
  reconciliationCompletedAt?: string;
  reconciliationCompletedBy?: string;
  receivedQtyByLine: Record<string, number>; // Keyed by lineId
  lastScannedSku?: string;
  lastScanAt?: string;
}

export interface ReceptionAppointment {
  id: string;
  branchId: string;
  branchName: string;
  clientId: string;
  clientName: string;
  supplierId: string;
  supplierName: string;
  supplierActive: boolean;
  receptionType: ReceptionType;
  asnReference: string;
  priority: PriorityLevel;
  observations?: string;

  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  dockNumber: string;

  carrierId: string;
  carrierName: string;
  carrierSuspended: boolean;
  expectedPlates: string;
  expectedDriver?: string;
  vehicleType: string;

  arrivalData?: ArrivalData;
  status: AppointmentStatus;
  lines: ExpectedLine[];
  progress?: ReceptionProgress;

  // HU-029: Integración Documental con Orden de Compra (PO)
  poNumber?: string;
  poValidationStatus?: import('./purchase-order.models').POValidationStatus;
  poValidationResult?: import('./purchase-order.models').POValidationResult;

  // HU-027: Notificar Llegada de Proveedor / Check-In del Transporte
  arrivalClearanceStatus?: import('./transport-arrival.models').ArrivalClearanceStatus;
  transportArrivalRecord?: import('./transport-arrival.models').TransportArrivalRecord;
  arrivalIncidentsCount?: number;
  openArrivalIncidentsCount?: number;

  createdAt: string;
  createdBy: string;
  updatedAt?: string;
}

export interface AppointmentAuditEntry {
  id: string;
  appointmentId: string;
  action:
    | 'CREATE'
    | 'EDIT'
    | 'CONFIRM'
    | 'REGISTER_ARRIVAL'
    | 'START_RECEIVING'
    | 'REPROGRAM'
    | 'CANCEL'
    | 'MARK_NO_SHOW'
    | 'REJECT'
    | 'UPDATE_PROGRESS'
    | 'CLONE_NEW';
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  reason?: string;
  branchId: string;
  performedBy: string;
  performedAt: string;
}

// Labels descriptivos de estado
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  CONFIRMED: 'Confirmada',
  ARRIVED: 'Vehículo en Sitio',
  IN_RECEIVING: 'En Recepción',
  COMPLETED: 'Finalizada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No Presentada (No Show)',
  REJECTED: 'Rechazada / Incidencia',
};

// Clases CSS de estado
export const APPOINTMENT_STATUS_CLASSES: Record<AppointmentStatus, string> = {
  DRAFT: 'rc-badge--draft',
  SCHEDULED: 'rc-badge--scheduled',
  CONFIRMED: 'rc-badge--confirmed',
  ARRIVED: 'rc-badge--arrived',
  IN_RECEIVING: 'rc-badge--receiving',
  COMPLETED: 'rc-badge--completed',
  CANCELLED: 'rc-badge--cancelled',
  NO_SHOW: 'rc-badge--noshow',
  REJECTED: 'rc-badge--rejected',
};

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  NORMAL: 'Normal',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export const RECEPTION_TYPE_LABELS: Record<ReceptionType, string> = {
  NATIONAL: 'Nacional',
  IMPORT: 'Importación',
  RETURN: 'Devolución',
};

// Mock Seed Data (6 Citas iniciales)
export const INITIAL_APPOINTMENTS_SEED: ReceptionAppointment[] = [
  {
    id: 'APT-0001',
    branchId: 'SUC-001',
    branchName: 'Planta Central CDMX',
    clientId: 'CLI-3PL-01',
    clientName: 'Nestlé México 3PL',
    supplierId: 'SUP-101',
    supplierName: 'Café de Altura S.A. de C.V.',
    supplierActive: true,
    receptionType: 'NATIONAL',
    asnReference: 'ASN-2026-0891',
    priority: 'HIGH',
    observations: 'Entrega prioritaria de sacos de café verde y molido.',

    scheduledDate: '2026-07-30',
    scheduledTime: '08:30',
    durationMinutes: 60,
    dockNumber: 'AND-01',

    carrierId: 'CAR-501',
    carrierName: 'Transportes Express del Norte',
    carrierSuspended: false,
    expectedPlates: '77-AB-9C',
    expectedDriver: 'Carlos Mendoza',
    vehicleType: 'Tráiler 53ft',

    arrivalData: {
      actualPlates: '77-AB-9C',
      actualDriver: 'Carlos Mendoza',
      sealPrimary: 'SL-994821',
      sealSecondary: 'SL-994822',
      arrivedAt: '2026-07-30T08:15:00.000Z',
      registeredBy: 'OPERATIONS_MANAGER',
    },

    status: 'ARRIVED',
    poNumber: 'PO-2026-8801',
    poValidationStatus: 'VALIDATED',
    lines: [
      { lineId: 'LNE-001', sku: 'SKU-CAFE-001', description: 'Café Molido 500g', expectedQty: 48, unit: 'Caja', expectedLot: 'LOT-2026-A1' },
      { lineId: 'LNE-002', sku: 'SKU-CAFE-002', description: 'Café Soluble 200g', expectedQty: 36, unit: 'Caja', expectedLot: 'LOT-2026-A2' },
      { lineId: 'LNE-003', sku: 'SKU-CAPSULA-001', description: 'Cápsulas Espresso x10', expectedQty: 120, unit: 'Caja', expectedLot: 'LOT-2026-B1' },
    ],
    createdAt: '2026-07-29T14:00:00.000Z',
    createdBy: 'OPERATIONS_MANAGER',
  },
  {
    id: 'APT-0002',
    branchId: 'SUC-001',
    branchName: 'Planta Central CDMX',
    clientId: 'CLI-3PL-02',
    clientName: 'Unilever Logística',
    supplierId: 'SUP-102',
    supplierName: 'Distribuidora Química del Valle',
    supplierActive: true,
    receptionType: 'IMPORT',
    asnReference: 'ASN-2026-0895',
    priority: 'URGENT',
    observations: 'Requiere revisión documental de aduana y sello fiscal.',

    scheduledDate: '2026-07-30',
    scheduledTime: '10:00',
    durationMinutes: 90,
    dockNumber: 'AND-02',

    carrierId: 'CAR-502',
    carrierName: 'Logística Fletera del Golfo',
    carrierSuspended: false,
    expectedPlates: '44-XY-1Z',
    expectedDriver: 'Roberto Gómez',
    vehicleType: 'Torton 15t',

    status: 'CONFIRMED',
    poNumber: 'PO-2026-8802',
    poValidationStatus: 'PENDING',
    lines: [
      { lineId: 'LNE-010', sku: 'SKU-SHAMPOO-01', description: 'Shampoo Acondicionador 750ml', expectedQty: 200, unit: 'Caja' },
      { lineId: 'LNE-011', sku: 'SKU-JABON-02', description: 'Jabón Líquido Antibacterial 5L', expectedQty: 150, unit: 'Caja' },
    ],
    createdAt: '2026-07-29T16:30:00.000Z',
    createdBy: 'OPERATIONS_MANAGER',
  },
  {
    id: 'APT-0003',
    branchId: 'SUC-001',
    branchName: 'Planta Central CDMX',
    clientId: 'CLI-3PL-01',
    clientName: 'Nestlé México 3PL',
    supplierId: 'SUP-103',
    supplierName: 'Empaques e Insumos Industriales',
    supplierActive: true,
    receptionType: 'NATIONAL',
    asnReference: 'ASN-2026-0901',
    priority: 'NORMAL',
    observations: 'Cajas de cartón corrugado para embalaje secundario.',

    scheduledDate: '2026-07-30',
    scheduledTime: '11:30',
    durationMinutes: 45,
    dockNumber: 'AND-03',

    carrierId: 'CAR-503',
    carrierName: 'Autotransportes de Carga Real',
    carrierSuspended: false,
    expectedPlates: '12-JK-88',
    expectedDriver: 'Fernando Silva',
    vehicleType: 'Rabón 8t',

    status: 'SCHEDULED',
    poNumber: 'PO-2026-8803',
    poValidationStatus: 'PENDING',
    lines: [
      { lineId: 'LNE-020', sku: 'SKU-EMPAQUE-C1', description: 'Caja Cartón Doble Corrugado 40x40', expectedQty: 500, unit: 'Pieza' },
    ],
    createdAt: '2026-07-30T07:00:00.000Z',
    createdBy: 'OPERATIONS_MANAGER',
  },
  {
    id: 'APT-0004',
    branchId: 'SUC-001',
    branchName: 'Planta Central CDMX',
    clientId: 'CLI-3PL-03',
    clientName: 'Procter & Gamble 3PL',
    supplierId: 'SUP-104',
    supplierName: 'Plásticos y Envases de México',
    supplierActive: true,
    receptionType: 'NATIONAL',
    asnReference: 'ASN-2026-0888',
    priority: 'NORMAL',

    scheduledDate: '2026-07-30',
    scheduledTime: '07:00',
    durationMinutes: 60,
    dockNumber: 'AND-04',

    carrierId: 'CAR-504',
    carrierName: 'Fletes Directos de Puebla',
    carrierSuspended: false,
    expectedPlates: '99-ZZ-01',
    expectedDriver: 'Manuel Vargas',
    vehicleType: 'Tráiler 53ft',

    arrivalData: {
      actualPlates: '99-ZZ-01',
      actualDriver: 'Manuel Vargas',
      sealPrimary: 'SL-883110',
      arrivedAt: '2026-07-30T06:50:00.000Z',
      registeredBy: 'OPERATIONS_MANAGER',
    },

    status: 'IN_RECEIVING',
    poNumber: 'PO-2026-8804',
    poValidationStatus: 'REJECTED',
    lines: [
      { lineId: 'LNE-030', sku: 'SKU-DETERGENTE-1', description: 'Detergente En Polvo 1kg', expectedQty: 300, unit: 'Caja', expectedLot: 'LOT-PG-101' },
      { lineId: 'LNE-031', sku: 'SKU-SUAVIZANTE-2', description: 'Suavizante De Telas 3L', expectedQty: 180, unit: 'Caja', expectedLot: 'LOT-PG-102' },
    ],
    progress: {
      currentStep: 2,
      startedAt: '2026-07-30T07:05:00.000Z',
      startedBy: 'OPERATIONS_MANAGER',
      vehicleDataCompleted: true,
      reconciliationCompleted: false,
      receivedQtyByLine: {
        'LNE-030': 300,
        'LNE-031': 100,
      },
      lastScannedSku: 'SKU-SUAVIZANTE-2',
      lastScanAt: '2026-07-30T07:40:00.000Z',
    },

    createdAt: '2026-07-28T10:00:00.000Z',
    createdBy: 'OPERATIONS_MANAGER',
  },
  {
    id: 'APT-0005',
    branchId: 'SUC-001',
    branchName: 'Planta Central CDMX',
    clientId: 'CLI-3PL-01',
    clientName: 'Nestlé México 3PL',
    supplierId: 'SUP-105',
    supplierName: 'Lácteos E Insumos Del Norte',
    supplierActive: true,
    receptionType: 'NATIONAL',
    asnReference: 'ASN-2026-0820',
    priority: 'HIGH',

    scheduledDate: '2026-07-29',
    scheduledTime: '15:00',
    durationMinutes: 60,
    dockNumber: 'AND-01',

    carrierId: 'CAR-501',
    carrierName: 'Transportes Express del Norte',
    carrierSuspended: false,
    expectedPlates: '55-MM-22',
    expectedDriver: 'Juan Pérez',
    vehicleType: 'Rabón 8t',

    arrivalData: {
      actualPlates: '55-MM-22',
      actualDriver: 'Juan Pérez',
      sealPrimary: 'SL-771920',
      arrivedAt: '2026-07-29T14:50:00.000Z',
      registeredBy: 'OPERATIONS_MANAGER',
    },

    status: 'COMPLETED',
    poNumber: 'PO-2026-8805',
    poValidationStatus: 'EXCEPTED',
    lines: [
      { lineId: 'LNE-040', sku: 'SKU-LECHE-001', description: 'Leche Entera UHT 1L', expectedQty: 1000, unit: 'Caja', expectedLot: 'LOT-LAC-99' },
    ],
    progress: {
      currentStep: 2,
      startedAt: '2026-07-29T15:00:00.000Z',
      startedBy: 'OPERATIONS_MANAGER',
      vehicleDataCompleted: true,
      reconciliationCompleted: true,
      reconciliationCompletedAt: '2026-07-29T16:10:00.000Z',
      reconciliationCompletedBy: 'OPERATIONS_MANAGER',
      receivedQtyByLine: {
        'LNE-040': 1000,
      },
    },

    createdAt: '2026-07-28T09:00:00.000Z',
    createdBy: 'OPERATIONS_MANAGER',
  },
  {
    id: 'APT-0006',
    branchId: 'SUC-001',
    branchName: 'Planta Central CDMX',
    clientId: 'CLI-3PL-02',
    clientName: 'Unilever Logística',
    supplierId: 'SUP-106',
    supplierName: 'Proveedora Logística Del Pacífico',
    supplierActive: true,
    receptionType: 'NATIONAL',
    asnReference: 'ASN-2026-0811',
    priority: 'NORMAL',

    scheduledDate: '2026-07-29',
    scheduledTime: '09:00',
    durationMinutes: 60,
    dockNumber: 'AND-05',

    carrierId: 'CAR-505',
    carrierName: 'Fletes Peninsulares S.A.',
    carrierSuspended: false,
    expectedPlates: '88-KK-33',
    expectedDriver: 'Esteban Ramírez',
    vehicleType: 'Camioneta 3.5t',

    status: 'NO_SHOW',
    poValidationStatus: 'NOT_REQUIRED',
    lines: [
      { lineId: 'LNE-050', sku: 'SKU-ACEITE-01', description: 'Aceite Vegetal Comestible 1L', expectedQty: 120, unit: 'Caja' },
    ],

    createdAt: '2026-07-28T11:00:00.000Z',
    createdBy: 'OPERATIONS_MANAGER',
  },
];
