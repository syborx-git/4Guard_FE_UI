/**
 * @file reception-priority.models.ts
 * @description Modelos de datos, tipos y etiquetas para HU-026 — Priorización Operativa de Recepciones.
 */

import { PriorityLevel, AppointmentStatus } from './reception-appointment.models';

export type PrioritySource = 'SYSTEM' | 'MANUAL';

export type PriorityReasonCode =
  | 'CUSTOMER_COMMITMENT'
  | 'PRODUCTION_IMPACT'
  | 'COLD_CHAIN'
  | 'HAZARDOUS_MATERIAL'
  | 'SLA_RISK'
  | 'DELIVERY_WINDOW'
  | 'OPERATIONAL_CONTINGENCY'
  | 'MANAGEMENT_DECISION'
  | 'DELAY_ESCALATION'
  | 'OTHER';

export type PriorityExpirationPolicy =
  | 'UNTIL_RECEIVING_START'
  | 'SPECIFIC_TIME'
  | 'PERMANENT';

export type OperationalAvailability =
  | 'READY'               // Lista para iniciar (Arribada + OC Validada + Sin bloqueos)
  | 'WAITING_DOCUMENTS'  // Esperando validación OC (HU-029)
  | 'WAITING_CHECKIN'    // Esperando Check-In de Caseta (HU-027)
  | 'REVIEW_REQUIRED'    // Con Incidencias o Diferencias documentales/de arribo
  | 'BLOCKED'            // Bloqueada por OC rechazada o Check-in denegado
  | 'IN_RECEIVING';      // En proceso físico en andén

export type PriorityFactorCode =
  | 'INITIAL_DECLARED_PRIORITY'
  | 'APPOINTMENT_SCHEDULE_DELAY'
  | 'PATIO_WAITING_TIME'
  | 'MANUAL_OVERRIDE_ACTIVE'
  | 'RECEPTION_TYPE_WEIGHT'
  | 'COLD_CHAIN_RISK'
  | 'HAZARDOUS_MATERIAL_RISK'
  | 'CUSTOMER_SLA_RISK';

export interface PriorityFactorResult {
  code: PriorityFactorCode;
  points: number;
  valueNumeric?: number;
  valueText?: string;
}

export const PRIORITY_FACTOR_LABELS: Record<PriorityFactorCode, (factor: PriorityFactorResult) => string> = {
  INITIAL_DECLARED_PRIORITY: (f) => `Prioridad declarada al programar (${f.valueText || 'NORMAL'})`,
  APPOINTMENT_SCHEDULE_DELAY: (f) => `${f.valueNumeric || 0} min de retraso sobre hora programada`,
  PATIO_WAITING_TIME: (f) => `${f.valueNumeric || 0} min en espera tras registro de arribo`,
  MANUAL_OVERRIDE_ACTIVE: () => `Prioridad manual ejecutiva vigente`,
  RECEPTION_TYPE_WEIGHT: (f) => `Tipo de recepción (${f.valueText || 'Nacional'})`,
  COLD_CHAIN_RISK: () => `Riesgo de cadena de frío (preparado)`,
  HAZARDOUS_MATERIAL_RISK: () => `Material peligroso (preparado)`,
  CUSTOMER_SLA_RISK: () => `Riesgo contractual SLA (preparado)`,
};

export const PRIORITY_REASON_LABELS: Record<PriorityReasonCode, string> = {
  CUSTOMER_COMMITMENT: 'Compromiso comercial / Cliente estratégico',
  PRODUCTION_IMPACT: 'Riesgo de paro en línea de producción',
  COLD_CHAIN: 'Cadena de frío / Caducidad crítica',
  HAZARDOUS_MATERIAL: 'Material peligroso / Protocolo de seguridad',
  SLA_RISK: 'Riesgo de penalización contractual / SLA',
  DELIVERY_WINDOW: 'Ventana de entrega límite / Horario exclusivo',
  OPERATIONAL_CONTINGENCY: 'Contingencia operativa en patio/andén',
  MANAGEMENT_DECISION: 'Decisión ejecutiva de gerencia',
  DELAY_ESCALATION: 'Escalamiento por retraso acumulado',
  OTHER: 'Otra razón operativa (especificar)',
};

export interface PrioritySuggestion {
  priority: PriorityLevel;
  score: number;
  factors: PriorityFactorResult[];
  calculatedAt: string;
}

export interface ReceptionPriorityDecision {
  suggestedPriority: PriorityLevel;
  appliedPriority: PriorityLevel;
  source: PrioritySource;

  reasonCode?: PriorityReasonCode;
  reason?: string;

  expirationPolicy: PriorityExpirationPolicy;
  expiresAt?: string;

  assignedBy: string;
  assignedByRole: string;
  assignedByUserId: string;
  assignedAt: string;

  revertedBy?: string;
  revertedAt?: string;
  revertReason?: string;
  active?: boolean;
}

export const OPERATIONAL_AVAILABILITY_LABELS: Record<OperationalAvailability, string> = {
  READY: 'Lista para Iniciar',
  WAITING_DOCUMENTS: 'Esperando Validación OC',
  WAITING_CHECKIN: 'Esperando Check-In Caseta',
  REVIEW_REQUIRED: 'Requiere Revisión Supervisor',
  BLOCKED: 'Bloqueada (Atención Requerida)',
  IN_RECEIVING: 'En Recepción Física',
};

export const OPERATIONAL_AVAILABILITY_CLASSES: Record<OperationalAvailability, string> = {
  READY: 'op-avail--ready',
  WAITING_DOCUMENTS: 'op-avail--waiting-doc',
  WAITING_CHECKIN: 'op-avail--waiting-checkin',
  REVIEW_REQUIRED: 'op-avail--review',
  BLOCKED: 'op-avail--blocked',
  IN_RECEIVING: 'op-avail--receiving',
};
