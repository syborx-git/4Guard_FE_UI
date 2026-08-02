/**
 * @file transport-arrival.models.ts
 * @description Modelos de dominio para HU-027 — Notificar llegada de proveedor (Check-In del Transporte).
 * Define contratos de datos de arribo, tipos de incidencias, matriz de severidades y estados de liberación de patio.
 */

export type ArrivalIncidentSeverity = 'INFORMATIONAL' | 'WARNING' | 'CRITICAL';

export type ArrivalIncidentStatus = 'OPEN' | 'AUTHORIZED' | 'RESOLVED' | 'REJECTED';

export type ArrivalClearanceStatus =
  | 'PENDING'
  | 'CLEARED'
  | 'REVIEW_REQUIRED'
  | 'WARNING_CLEARED'
  | 'BLOCKED'
  | 'REJECTED_AT_GATE';

export type GateDecision = 'ADMITTED' | 'HELD' | 'REJECTED';

export type SealCondition = 'INTACT' | 'DAMAGED' | 'BROKEN' | 'MISSING';

export type ArrivalIncidentType =
  | 'PLATE_MISMATCH'
  | 'DRIVER_MISMATCH'
  | 'CARRIER_MISMATCH'
  | 'VEHICLE_TYPE_MISMATCH'
  | 'EARLY_ARRIVAL'
  | 'LATE_ARRIVAL'
  | 'SEAL_MISMATCH'
  | 'SEAL_DAMAGED'
  | 'DOCUMENTATION_MISSING'
  | 'VEHICLE_VISIBLE_DAMAGE'
  | 'WRONG_SUPPLIER'
  | 'WRONG_BRANCH'
  | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_NOT_FOUND'
  | 'APPOINTMENT_NOT_CONFIRMED'
  | 'OTHER';

export interface ArrivalIncidentPolicyRule {
  severity: ArrivalIncidentSeverity;
  authorizable: boolean;
  requiresSupervisorReview: boolean;
  initialClearance: ArrivalClearanceStatus;
  initialStatus?: ArrivalIncidentStatus;
  userMessage: string;
}

export interface ArrivalIncident {
  id: string;
  type: ArrivalIncidentType;
  severity: ArrivalIncidentSeverity;
  title: string;
  description: string;
  expectedValue?: string;
  actualValue?: string;
  authorizable: boolean;
  requiresSupervisorReview: boolean;
  status: ArrivalIncidentStatus;
  createdAt: string;
  createdBy: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionReason?: string;
}

export interface CheckInInput {
  actualPlates: string;
  actualDriver?: string;
  actualCarrier?: string;
  actualSupplierName?: string;
  actualVehicleType?: string;
  sealPrimary: string;
  sealSecondary?: string;
  sealPrimaryCondition: SealCondition;
  accessGate: string;
  observations?: string;
}

export interface TransportArrivalRecord {
  appointmentId: string;
  actualPlates: string;
  actualDriver: string;
  actualCarrier: string;
  actualVehicleType: string;
  sealPrimary: string;
  sealSecondary?: string;
  sealPrimaryCondition: SealCondition;
  accessGate: string;
  observations?: string;
  arrivedAt: string;
  registeredBy: string;
  userRole: string;
  branchId: string;
  incidents: ArrivalIncident[];
  clearanceStatus: ArrivalClearanceStatus;
  gateDecision: GateDecision;
  clearedBy?: string;
  clearedAt?: string;
  clearanceReason?: string;
}

export interface ArrivalAuditEntry {
  id: string;
  appointmentId: string;
  action: string;
  performedBy: string;
  userRole: string;
  branchId: string;
  performedAt: string;
  previousClearance: ArrivalClearanceStatus;
  newClearance: ArrivalClearanceStatus;
  incidentsCount: number;
  incidentId?: string;
  incidentType?: string;
  reason?: string;
}

// Etiquetas y Clases CSS para Estados de Liberación de Arribo
export const ARRIVAL_CLEARANCE_LABELS: Record<ArrivalClearanceStatus, string> = {
  PENDING: 'CHECK-IN PENDIENTE',
  CLEARED: 'ARRIBO LIBERADO',
  REVIEW_REQUIRED: 'ARRIBO EN REVISIÓN',
  WARNING_CLEARED: 'LIBERADO CON ADVERTENCIA',
  BLOCKED: 'ARRIBO BLOQUEADO',
  REJECTED_AT_GATE: 'RECHAZADO EN CASETA',
};

export const ARRIVAL_CLEARANCE_CLASSES: Record<ArrivalClearanceStatus, string> = {
  PENDING: 'arrival-badge--pending',
  CLEARED: 'arrival-badge--cleared',
  REVIEW_REQUIRED: 'arrival-badge--review',
  WARNING_CLEARED: 'arrival-badge--warning-cleared',
  BLOCKED: 'arrival-badge--blocked',
  REJECTED_AT_GATE: 'arrival-badge--rejected-gate',
};

export const INCIDENT_TYPE_LABELS: Record<ArrivalIncidentType, string> = {
  PLATE_MISMATCH: 'Placas Diferentes a las Programadas',
  DRIVER_MISMATCH: 'Chofer Diferente al Programado',
  CARRIER_MISMATCH: 'Línea Transportista Diferente',
  VEHICLE_TYPE_MISMATCH: 'Tipo de Unidad Incompatible',
  EARLY_ARRIVAL: 'Llegada Anticipada fuera de Umbral',
  LATE_ARRIVAL: 'Llegada Retrasada fuera de Umbral',
  SEAL_MISMATCH: 'Número de Sello no Coincide',
  SEAL_DAMAGED: 'Sello Roto o Maltratado',
  DOCUMENTATION_MISSING: 'Documentación Incompleta',
  VEHICLE_VISIBLE_DAMAGE: 'Daño Físico Visible en Unidad',
  WRONG_SUPPLIER: 'Proveedor no Corresponde',
  WRONG_BRANCH: 'Sucursal de Destino Incorrecta',
  APPOINTMENT_CANCELLED: 'Cita en Estado Cancelado',
  APPOINTMENT_NOT_FOUND: 'Cita Inexistente en Sistema',
  APPOINTMENT_NOT_CONFIRMED: 'Cita Registrada sin Confirmación Previa',
  OTHER: 'Incidencia Operativa no Especificada',
};

/** Matriz Centralizada de Políticas de Incidencias de Arribo */
export const ARRIVAL_INCIDENT_POLICY: Record<ArrivalIncidentType, ArrivalIncidentPolicyRule> = {
  PLATE_MISMATCH: {
    severity: 'WARNING',
    authorizable: true,
    requiresSupervisorReview: true,
    initialClearance: 'REVIEW_REQUIRED',
    userMessage: 'Las placas presentadas difieren de las programadas en la cita.',
  },
  DRIVER_MISMATCH: {
    severity: 'WARNING',
    authorizable: true,
    requiresSupervisorReview: false,
    initialClearance: 'REVIEW_REQUIRED',
    userMessage: 'El chofer presentado difiere del chofer registrado en la cita.',
  },
  CARRIER_MISMATCH: {
    severity: 'WARNING',
    authorizable: true,
    requiresSupervisorReview: false,
    initialClearance: 'REVIEW_REQUIRED',
    userMessage: 'La empresa transportista no coincide con la agendada.',
  },
  VEHICLE_TYPE_MISMATCH: {
    severity: 'WARNING',
    authorizable: true,
    requiresSupervisorReview: true,
    initialClearance: 'REVIEW_REQUIRED',
    userMessage: 'El tipo de vehículo presentado difiere del andén agendado.',
  },
  EARLY_ARRIVAL: {
    severity: 'INFORMATIONAL',
    authorizable: true,
    requiresSupervisorReview: false,
    initialClearance: 'CLEARED',
    initialStatus: 'RESOLVED',
    userMessage: 'La unidad arribó con más de 30 minutos de anticipación.',
  },
  LATE_ARRIVAL: {
    severity: 'WARNING',
    authorizable: true,
    requiresSupervisorReview: false,
    initialClearance: 'CLEARED',
    userMessage: 'La unidad arribó con más de 45 minutos de retraso sobre la hora agendada.',
  },
  SEAL_MISMATCH: {
    severity: 'CRITICAL',
    authorizable: true,
    requiresSupervisorReview: true,
    initialClearance: 'BLOCKED',
    userMessage: 'El número de sello presentado no coincide con la cita.',
  },
  SEAL_DAMAGED: {
    severity: 'CRITICAL',
    authorizable: true,
    requiresSupervisorReview: true,
    initialClearance: 'BLOCKED',
    userMessage: 'El sello primario de seguridad se encuentra roto, violado o maltratado.',
  },
  DOCUMENTATION_MISSING: {
    severity: 'WARNING',
    authorizable: true,
    requiresSupervisorReview: true,
    initialClearance: 'REVIEW_REQUIRED',
    userMessage: 'Falta carta porte, remisión o documentación de amparo.',
  },
  VEHICLE_VISIBLE_DAMAGE: {
    severity: 'CRITICAL',
    authorizable: true,
    requiresSupervisorReview: true,
    initialClearance: 'BLOCKED',
    userMessage: 'El remolque/unidad presenta filtración o daño físico en estructura.',
  },
  WRONG_SUPPLIER: {
    severity: 'CRITICAL',
    authorizable: false,
    requiresSupervisorReview: true,
    initialClearance: 'BLOCKED',
    userMessage: 'El transportista declara entregar mercancía de otro proveedor no agendado.',
  },
  WRONG_BRANCH: {
    severity: 'CRITICAL',
    authorizable: false,
    requiresSupervisorReview: true,
    initialClearance: 'BLOCKED',
    userMessage: 'Esta cita está programada para otra sucursal del WMS.',
  },
  APPOINTMENT_CANCELLED: {
    severity: 'CRITICAL',
    authorizable: false,
    requiresSupervisorReview: true,
    initialClearance: 'REJECTED_AT_GATE',
    userMessage: 'La cita asociada se encuentra cancelada en el sistema.',
  },
  APPOINTMENT_NOT_FOUND: {
    severity: 'CRITICAL',
    authorizable: false,
    requiresSupervisorReview: true,
    initialClearance: 'REJECTED_AT_GATE',
    userMessage: 'La cita de recepción no existe o no fue encontrada.',
  },
  APPOINTMENT_NOT_CONFIRMED: {
    severity: 'WARNING',
    authorizable: true,
    requiresSupervisorReview: true,
    initialClearance: 'REVIEW_REQUIRED',
    userMessage: 'La unidad arribó sin confirmación previa de la cita agendada.',
  },
  OTHER: {
    severity: 'WARNING',
    authorizable: true,
    requiresSupervisorReview: true,
    initialClearance: 'REVIEW_REQUIRED',
    userMessage: 'Incidencia operativa registrada manualmente en caseta.',
  },
};
