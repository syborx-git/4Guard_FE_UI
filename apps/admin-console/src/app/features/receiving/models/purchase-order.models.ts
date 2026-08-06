/**
 * @file purchase-order.models.ts
 * @description Modelos de datos, tipos de discrepancia y seed data para HU-029 — Validación Documental de Cita vs Orden de Compra (PO).
 */

export type POStatus = 'RELEASED' | 'PARTIAL' | 'CLOSED' | 'CANCELLED' | 'EXPIRED';

export type POValidationStatus =
  | 'PENDING'
  | 'VALIDATED'
  | 'EXCEPTED'
  | 'REJECTED'
  | 'NOT_REQUIRED';

export type POComparisonOutcome =
  | 'MATCH'
  | 'WITH_DIFFERENCES'
  | 'BLOCKED';

export type PODiscrepancyType =
  | 'PO_NOT_FOUND'
  | 'PO_CANCELLED'
  | 'PO_EXPIRED'
  | 'BRANCH_MISMATCH'
  | 'CLIENT_MISMATCH'
  | 'SUPPLIER_MISMATCH'
  | 'ASN_MISMATCH'
  | 'SKU_NOT_IN_PO'
  | 'SKU_MISSING_IN_APPOINTMENT'
  | 'QTY_OVER_PO'
  | 'QTY_UNDER_PO'
  | 'UNIT_MISMATCH';

export interface POLine {
  lineId: string;
  sku: string;
  description: string;
  authorizedQty: number;
  previouslyReceivedQty: number;
  pendingQty: number; // authorizedQty - previouslyReceivedQty
  unit: string;
}

export interface PurchaseOrder {
  id: string; // e.g. PO-2026-8801
  poNumber: string;
  asnReference?: string;
  branchId: string;
  branchName: string;
  clientId: string;
  clientName: string;
  supplierId: string;
  supplierName: string;
  status: POStatus;
  issueDate: string;
  expirationDate: string;
  lines: POLine[];
}

export interface LineComparisonResult {
  lineId: string;
  sku: string;
  description: string;
  pendingPOQty: number;
  appointmentQty: number;
  unitPO: string;
  unitAppointment: string;
  status: 'MATCH' | 'DISCREPANCY' | 'EXTRA_IN_APPOINTMENT' | 'MISSING_IN_APPOINTMENT';
  discrepancies: PODiscrepancyType[];
  notes?: string;
}

export interface POValidationResult {
  appointmentId: string;
  poNumber: string;
  calculatedOutcome: POComparisonOutcome;
  validationStatus: POValidationStatus;
  validatedAt?: string;
  validatedBy?: string;
  userRole?: string;
  totalLines: number;
  matchLines: number;
  discrepancyLines: number;
  overallMatchPercent: number;
  discrepancies: PODiscrepancyType[];
  lineResults: LineComparisonResult[];
  supervisorException?: {
    authorizedBy: string;
    authorizedAt: string;
    reason: string;
  };
  rejectionReason?: string;
  notRequiredReason?: string;
  sourceFingerprint: string;
}

export type POAuditAction =
  | 'COMPARISON_EXECUTED'
  | 'VALIDATION_CONFIRMED'
  | 'EXCEPTION_AUTHORIZED'
  | 'VALIDATION_REJECTED'
  | 'MARKED_NOT_REQUIRED'
  | 'VALIDATION_INVALIDATED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_REPLACED'
  | 'DOCUMENT_DOWNLOADED'
  | 'DOCUMENT_VIEWED'
  | 'DOCUMENT_VERSION_RESTORED';

/** Modelo RBAC basado en Capacidades Documentales (EVOLUCIÓN V2) */
export type DocumentCapability =
  | 'DOCUMENT_VIEW'
  | 'DOCUMENT_UPLOAD'
  | 'DOCUMENT_DOWNLOAD'
  | 'DOCUMENT_REPLACE'
  | 'DOCUMENT_VERSION_HISTORY'
  | 'DOCUMENT_DELETE';

/** Representa una versión inalterable del documento original de la OC */
export interface PODocumentVersion {
  id: string;
  versionNumber: number;
  versionLabel: string; // e.g. 'v1', 'v2'
  fileName: string;
  fileSizeFormatted: string;
  fileType: 'PDF' | 'IMAGE';
  mimeType: string;
  fileUrl?: string; // URL blob/object o preview sintético
  uploadedBy: string;
  userRole: string;
  uploadedAt: string;
  changeReason?: string;
  source: 'MANUAL_UPLOAD' | 'CAMERA_CAPTURE' | 'ERP_INTEGRATION';
}

/** Expediente Documental Completo de la Orden de Compra */
export interface PODocumentRecord {
  poNumber: string;
  appointmentId: string;
  branchId: string;
  currentVersionNumber: number;
  activeVersion: PODocumentVersion;
  versionsHistory: PODocumentVersion[];
  createdAt: string;
  updatedAt: string;
}


export interface POAuditEntry {
  id: string;
  appointmentId: string;
  poNumber: string;
  action: POAuditAction;
  performedBy: string;
  userRole: string;
  performedAt: string;
  previousStatus: POValidationStatus;
  newStatus: POValidationStatus;
  calculatedOutcome: POComparisonOutcome;
  overallMatchPercent: number;
  discrepancies: PODiscrepancyType[];
  reason?: string;
  sourceFingerprint: string;
}

// Labels descriptivos para la UI
export const PO_VALIDATION_STATUS_LABELS: Record<POValidationStatus, string> = {
  PENDING: 'Pendiente de Revisión Documental',
  VALIDATED: 'Aprobada Documentalmente',
  EXCEPTED: 'Autorizada por Excepción Documental',
  REJECTED: 'Rechazo Documental',
  NOT_REQUIRED: 'Sin OC Requerida',
};

export const PO_COMPARISON_OUTCOME_LABELS: Record<POComparisonOutcome, string> = {
  MATCH: 'Coincidencia Total (100%)',
  WITH_DIFFERENCES: 'Diferencias Detectadas',
  BLOCKED: 'Bloqueo Técnico por Discrepancia',
};

export const PO_VALIDATION_STATUS_CLASSES: Record<POValidationStatus, string> = {
  PENDING: 'po-badge--pending',
  VALIDATED: 'po-badge--validated',
  EXCEPTED: 'po-badge--excepted',
  REJECTED: 'po-badge--rejected',
  NOT_REQUIRED: 'po-badge--not-required',
};

export const DISCREPANCY_LABELS: Record<PODiscrepancyType, string> = {
  PO_NOT_FOUND: 'Orden de Compra No Encontrada',
  PO_CANCELLED: 'Orden de Compra Cancelada',
  PO_EXPIRED: 'Orden de Compra Vencida',
  BRANCH_MISMATCH: 'Sucursal Difiere entre Cita y OC',
  CLIENT_MISMATCH: 'Cliente 3PL Difiere de la OC',
  SUPPLIER_MISMATCH: 'Proveedor Difiere de la OC',
  ASN_MISMATCH: 'ASN Difiere del Esperado en OC',
  SKU_NOT_IN_PO: 'SKU No Autorizado en OC',
  SKU_MISSING_IN_APPOINTMENT: 'SKU Faltante en Programación de Cita',
  QTY_OVER_PO: 'Exceso sobre Cantidad Pendiente en OC',
  QTY_UNDER_PO: 'Cantidad Menor a la Pendiente en OC',
  UNIT_MISMATCH: 'Unidad de Medida Difiere',
};

// Discrepancias no autorizables como excepción
export const CRITICAL_BLOCKED_DISCREPANCIES: PODiscrepancyType[] = [
  'PO_NOT_FOUND',
  'PO_CANCELLED',
  'BRANCH_MISMATCH',
  'CLIENT_MISMATCH',
  'SUPPLIER_MISMATCH',
];

// Seed Data de Órdenes de Compra (Asociadas a las Citas de HU-028)
export const INITIAL_PURCHASE_ORDERS_SEED: PurchaseOrder[] = [
  {
    id: 'PO-2026-8801',
    poNumber: 'PO-2026-8801',
    asnReference: 'ASN-2026-0891',
    branchId: 'SUC-001',
    branchName: 'Planta Central CDMX',
    clientId: 'CLI-3PL-01',
    clientName: 'Nestlé México 3PL',
    supplierId: 'SUP-101',
    supplierName: 'Café de Altura S.A. de C.V.',
    status: 'RELEASED',
    issueDate: '2026-07-20',
    expirationDate: '2026-08-30',
    lines: [
      { lineId: 'POL-001', sku: 'SKU-CAFE-001', description: 'Café Molido 500g', authorizedQty: 100, previouslyReceivedQty: 52, pendingQty: 48, unit: 'Caja' },
      { lineId: 'POL-002', sku: 'SKU-CAFE-002', description: 'Café Soluble 200g', authorizedQty: 80, previouslyReceivedQty: 44, pendingQty: 36, unit: 'Caja' },
      { lineId: 'POL-003', sku: 'SKU-CAPSULA-001', description: 'Cápsulas Espresso x10', authorizedQty: 200, previouslyReceivedQty: 80, pendingQty: 120, unit: 'Caja' },
    ],
  },
  {
    id: 'PO-2026-8802',
    poNumber: 'PO-2026-8802',
    asnReference: 'ASN-2026-0895',
    branchId: 'SUC-001',
    branchName: 'Planta Central CDMX',
    clientId: 'CLI-3PL-02',
    clientName: 'Unilever Logística',
    supplierId: 'SUP-102',
    supplierName: 'Distribuidora Química del Valle',
    status: 'PARTIAL',
    issueDate: '2026-07-22',
    expirationDate: '2026-08-25',
    lines: [
      { lineId: 'POL-010', sku: 'SKU-SHAMPOO-01', description: 'Shampoo Acondicionador 750ml', authorizedQty: 300, previouslyReceivedQty: 100, pendingQty: 200, unit: 'Caja' },
      { lineId: 'POL-011', sku: 'SKU-JABON-02', description: 'Jabón Líquido Antibacterial 5L', authorizedQty: 200, previouslyReceivedQty: 50, pendingQty: 150, unit: 'Caja' },
    ],
  },
  {
    id: 'PO-2026-8803',
    poNumber: 'PO-2026-8803',
    asnReference: 'ASN-2026-0901',
    branchId: 'SUC-001',
    branchName: 'Planta Central CDMX',
    clientId: 'CLI-3PL-01',
    clientName: 'Nestlé México 3PL',
    supplierId: 'SUP-103',
    supplierName: 'Empaques e Insumos Industriales',
    status: 'RELEASED',
    issueDate: '2026-07-25',
    expirationDate: '2026-08-28',
    lines: [
      { lineId: 'POL-020', sku: 'SKU-EMPAQUE-C1', description: 'Caja Cartón Doble Corrugado 40x40', authorizedQty: 1000, previouslyReceivedQty: 500, pendingQty: 500, unit: 'Pieza' },
    ],
  },
  {
    id: 'PO-2026-8804',
    poNumber: 'PO-2026-8804',
    asnReference: 'ASN-2026-0888',
    branchId: 'SUC-001',
    branchName: 'Planta Central CDMX',
    clientId: 'CLI-3PL-03',
    clientName: 'Procter & Gamble 3PL',
    supplierId: 'SUP-104',
    supplierName: 'Plásticos y Envases de México',
    status: 'CANCELLED',
    issueDate: '2026-07-15',
    expirationDate: '2026-07-28',
    lines: [
      { lineId: 'POL-030', sku: 'SKU-DETERGENTE-1', description: 'Detergente En Polvo 1kg', authorizedQty: 500, previouslyReceivedQty: 200, pendingQty: 300, unit: 'Caja' },
    ],
  },
  {
    id: 'PO-2026-8805',
    poNumber: 'PO-2026-8805',
    asnReference: 'ASN-2026-0820',
    branchId: 'SUC-001',
    branchName: 'Planta Central CDMX',
    clientId: 'CLI-3PL-01',
    clientName: 'Nestlé México 3PL',
    supplierId: 'SUP-105',
    supplierName: 'Lácteos E Insumos Del Norte',
    status: 'CLOSED',
    issueDate: '2026-07-10',
    expirationDate: '2026-08-10',
    lines: [
      { lineId: 'POL-040', sku: 'SKU-LECHE-001', description: 'Leche Entera UHT 1L', authorizedQty: 1000, previouslyReceivedQty: 0, pendingQty: 1000, unit: 'Caja' },
    ],
  },
];
