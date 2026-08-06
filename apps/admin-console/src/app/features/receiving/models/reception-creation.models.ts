/**
 * @file reception-creation.models.ts
 * @description View Models y tipos de derivación visual para HU-016 — Preparación de Expediente de Recepción.
 * Exclusivo para la Etapa A (Sin persistencia, sin expedientes simulados, sin folios).
 */

import { DockAssignmentStatus } from './dock-assignment.models';
import { ReceptionAppointment } from './reception-appointment.models';

export type LineMatchingStatus = 'MATCHED' | 'UNMATCHED' | 'AMBIGUOUS';

export interface ReceptionCreationLineView {
  lineId: string;
  sku: string;
  description: string;
  unit: string;
  authorizedQty: number;          // POLine.authorizedQty
  previouslyReceivedQty: number;  // POLine.previouslyReceivedQty
  pendingQty: number;             // Saldo abierto en OC (authorizedQty - previouslyReceivedQty)
  expectedQty: number | null;     // ExpectedLine.expectedQty (NULLABLE si no fue anunciada)
  matchingStatus: LineMatchingStatus;
  matchingNote?: string;
}

export interface InheritedWarningView {
  code: string;
  label: string;
  severity: 'WARNING' | 'INFO';
  source: 'PO_VALIDATION' | 'CHECKIN' | 'DOCK' | 'PRIORITY';
}

export type BranchVerificationStatus = 'VERIFIED' | 'MISMATCH' | 'NOT_VERIFIABLE';

export interface BranchVerificationResult {
  status: BranchVerificationStatus;
  sessionBranchId: string | null;
  appointmentBranchId: string;
  reason: string;
  label: string;
}

export interface PriorityInfoView {
  level: string;
  origin: string;
  isVerifiable: boolean;
}

export interface DockInfoView {
  dockNumber: string | null;
  dockStatus: DockAssignmentStatus | 'UNASSIGNED';
  isValid: boolean;
  isExpired: boolean;
  label: string;
  detail: string;
}

export interface OperationalReadinessRequirement {
  name: string;
  status: 'SUCCESS' | 'WARNING' | 'PENDING' | 'BLOCKED' | 'NOT_VERIFIABLE';
  detail: string;
}

export interface OperationalReadinessResult {
  overallState: 'READY' | 'READY_WITH_WARNINGS' | 'BLOCKED';
  overallLabel: string;
  overallClass: string;
  requirements: OperationalReadinessRequirement[];
}

/**
 * Evaluador Visual de Preparación Operativa (Contrato Fase 1 → Fase 2).
 * Función pura y compartida para garantizar el mismo resultado en HU-028 y HU-016.
 */
export function getOperationalReadiness(appt: ReceptionAppointment | null): OperationalReadinessResult {
  if (!appt) {
    return {
      overallState: 'BLOCKED',
      overallLabel: 'Bloqueada para continuar',
      overallClass: 'readiness--blocked',
      requirements: [],
    };
  }

  const reqs: OperationalReadinessRequirement[] = [];

  // 1. Documentación (PO)
  const poStatus = appt.poValidationStatus;
  if (poStatus === 'VALIDATED' || poStatus === 'NOT_REQUIRED') {
    reqs.push({ name: 'Documentación Documental (OC)', status: 'SUCCESS', detail: poStatus === 'VALIDATED' ? 'Aprobada documentalmente contra PO' : 'Sin Orden de Compra requerida' });
  } else if (poStatus === 'EXCEPTED') {
    reqs.push({ name: 'Documentación Documental (OC)', status: 'WARNING', detail: 'Autorizada por excepción documental' });
  } else if (poStatus === 'REJECTED') {
    reqs.push({ name: 'Documentación Documental (OC)', status: 'BLOCKED', detail: 'Rechazo documental por discrepancia crítica' });
  } else if (poStatus === 'PENDING') {
    reqs.push({ name: 'Documentación Documental (OC)', status: 'PENDING', detail: 'Pendiente de revisión documental' });
  } else {
    reqs.push({ name: 'Documentación Documental (OC)', status: 'NOT_VERIFIABLE', detail: 'No verificable con los datos actuales' });
  }

  // 2. Caseta & Arribo
  const clearance = appt.arrivalClearanceStatus;
  const hasIncidents = (appt.openArrivalIncidentsCount ?? 0) > 0;
  if (clearance === 'CLEARED' && !hasIncidents) {
    reqs.push({ name: 'Control de Caseta & Arribo', status: 'SUCCESS', detail: 'Ingreso a patio autorizado sin incidencias' });
  } else if (clearance === 'WARNING_CLEARED' || (clearance === 'CLEARED' && hasIncidents)) {
    reqs.push({ name: 'Control de Caseta & Arribo', status: 'WARNING', detail: 'Ingreso autorizado con advertencias/incidencias' });
  } else if (clearance === 'REVIEW_REQUIRED') {
    reqs.push({ name: 'Control de Caseta & Arribo', status: 'WARNING', detail: 'Revisión técnica en caseta requerida' });
  } else if (clearance === 'BLOCKED' || clearance === 'REJECTED_AT_GATE') {
    reqs.push({ name: 'Control de Caseta & Arribo', status: 'BLOCKED', detail: 'Ingreso bloqueado o rechazado físicamente en caseta' });
  } else if (!clearance || clearance === 'PENDING') {
    reqs.push({ name: 'Control de Caseta & Arribo', status: 'PENDING', detail: 'Check-In de transporte pendiente' });
  } else {
    reqs.push({ name: 'Control de Caseta & Arribo', status: 'NOT_VERIFIABLE', detail: 'No verificable con los datos actuales' });
  }

  // 3. Priorización Operativa
  if (appt.priorityDecision || appt.priority) {
    const isManual = appt.priorityDecision?.source === 'MANUAL';
    const pLevel = appt.priority || 'NORMAL';
    reqs.push({
      name: 'Priorización Operativa',
      status: 'SUCCESS',
      detail: isManual ? `Prioridad ${pLevel} confirmada por supervisión` : `Prioridad ${pLevel} asignada por motor de reglas`,
    });
  } else {
    reqs.push({ name: 'Priorización Operativa', status: 'NOT_VERIFIABLE', detail: 'No verificable con los datos actuales' });
  }

  // 4. Reserva / Asignación de Muelle
  const dockCode = appt.dockNumber;
  const dockStatus = appt.dockAssignmentStatus;
  if (dockCode && (dockStatus === 'RESERVED' || dockStatus === 'ASSIGNED' || dockStatus === 'POSITIONING' || dockStatus === 'OCCUPIED')) {
    const expiresAt = appt.dockReservationExpiresAt;
    const isExpired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;

    if (isExpired) {
      reqs.push({ name: 'Reserva de Muelle de Descarga', status: 'WARNING', detail: `Muelle ${dockCode} con reserva vencida (Pendiente de liberación/renovación)` });
    } else {
      reqs.push({ name: 'Reserva de Muelle de Descarga', status: 'SUCCESS', detail: `Muelle ${dockCode} reservado y vigente` });
    }
  } else if (!dockCode || dockStatus === 'UNASSIGNED') {
    reqs.push({ name: 'Reserva de Muelle de Descarga', status: 'PENDING', detail: 'Sin muelle asignado' });
  } else {
    reqs.push({ name: 'Reserva de Muelle de Descarga', status: 'NOT_VERIFIABLE', detail: 'No verificable con los datos actuales' });
  }

  // Determinar Estado Global
  const hasBlocked = reqs.some((r) => r.status === 'BLOCKED' || r.status === 'PENDING');
  const hasWarningOrUnverifiable = reqs.some((r) => r.status === 'WARNING' || r.status === 'NOT_VERIFIABLE');

  if (hasBlocked) {
    return {
      overallState: 'BLOCKED',
      overallLabel: 'Bloqueada para continuar',
      overallClass: 'readiness--blocked',
      requirements: reqs,
    };
  }

  if (hasWarningOrUnverifiable) {
    return {
      overallState: 'READY_WITH_WARNINGS',
      overallLabel: 'Lista con advertencias',
      overallClass: 'readiness--warning',
      requirements: reqs,
    };
  }

  return {
    overallState: 'READY',
    overallLabel: 'Lista para crear recepción',
    overallClass: 'readiness--ready',
    requirements: reqs,
  };
}

export interface ReceptionCreationViewModel {
  appointmentId: string;
  poNumber: string;
  branchId: string;
  branchName: string;
  clientId: string;
  clientName: string;
  supplierId: string;
  supplierName: string;
  carrierId: string;
  carrierName: string;
  vehiclePlates: string;
  driverName?: string;
  asnReference: string;
  
  // Evaluaciones de preparación
  branchVerification: BranchVerificationResult;
  priorityInfo: PriorityInfoView;
  dockInfo: DockInfoView;
  isPoEligible: boolean;
  poStatusLabel: string;
  hasCreatePermission: boolean;
  operationalReadiness: OperationalReadinessResult;

  // Desglose y advertencias
  lines: ReceptionCreationLineView[];
  warnings: InheritedWarningView[];
  
  // Estado de preparación UI
  isValidatedForCreation: boolean;
  validatedAt?: string;
}

/**
 * Previsualización Técnica del Comando Transaccional (CreateReceptionCommand)
 * Solo para uso en panel colapsable de Dev/QA. No representa persistencia real.
 */
export interface CreateReceptionCommand {
  appointmentId: string;
  poNumber: string;
  idempotencyKey: string;
  expectedLines: {
    lineId: string;
    sku: string;
    expectedQty: number;
  }[];
}
