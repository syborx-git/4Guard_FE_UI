/**
 * @file dock-assignment.models.ts
 * @description Modelos de datos de recepción, capacidades RBAC, auditoría y orquestación de muelles [HU-030].
 */

import { DockItem, DockOperationalStatus } from '../../inventory/models/warehouse-location.models';

export { DockItem, DockOperationalStatus };

/** Estado del Proceso de Asignación en la Cita de Recepción */
export type DockAssignmentStatus =
  | 'UNASSIGNED'           // Sin muelle asignado
  | 'SUGGESTED'            // Muelle sugerido por el engine
  | 'RESERVED'             // Muelle reservado para la cita
  | 'ASSIGNED'             // Muelle asignado formalmente
  | 'POSITIONING'          // Vehículo trasladándose al muelle
  | 'OCCUPIED'             // Vehículo acoplado y en descarga
  | 'RELEASED'             // Muelle liberado tras completar
  | 'REASSIGNED'           // Reasignado a otro muelle
  | 'EXPIRED'              // Reserva vencida por timeout
  | 'REASSIGNMENT_REQUIRED'// Requiere cambio por contingencia
  | 'CANCELLED';           // Asignación cancelada

/** Categoría de Recomendación Emitida por el Engine */
export type DockRecommendationCategory =
  | 'OPTIMAL'              // Recomendación Óptima (Sugerido preferente)
  | 'ALTERNATIVE'          // Recomendación Alternativa (Disponible secundario)
  | 'UNAVAILABLE';         // No Recomendado / No Disponible

/** Modelo RBAC basado en Capacidades para Gestión de Muelles */
export type DockCapability =
  | 'DOCK_VIEW'                 // Consultar estado de muelles
  | 'DOCK_SUGGEST'              // Generar sugerencia automática
  | 'DOCK_ASSIGN'               // Asignar o reservar un muelle
  | 'DOCK_REASSIGN'             // Cambiar asignación existente
  | 'DOCK_CONFIRM_POSITIONING'  // Confirmar inicio de movimiento
  | 'DOCK_CONFIRM_OCCUPANCY'    // Confirmar acoplamiento/ocupación
  | 'DOCK_RELEASE'              // Liberar muelle manualmente
  | 'DOCK_OVERRIDE'             // Seleccionar muelle distinto al recomendado
  | 'DOCK_VIEW_AUDIT';          // Consultar bitácora de muelles

/** Contexto de Usuario Autenticado para Operaciones de Muelle */
export interface DockUserContext {
  userId: string;
  userName: string;
  role: string;
  branchId: string;
  capabilities: Set<DockCapability>;
}

export interface DockUserContextDTO {
  userId: string;
  userName: string;
  role: string;
  branchId: string;
  capabilities: DockCapability[];
}

/** Adaptador Demo de Capacidades por Roles Existentes en 4GUARD */
export function resolveDemoDockCapabilities(role: string): Set<DockCapability> {
  const caps = new Set<DockCapability>();
  caps.add('DOCK_VIEW');

  const normalizedRole = (role || '').toUpperCase().replace('ROLE_', '');

  switch (normalizedRole) {
    case 'ADMIN':
    case 'OPERATIONS_MANAGER':
    case 'WAREHOUSE_MANAGER':
      caps.add('DOCK_SUGGEST');
      caps.add('DOCK_ASSIGN');
      caps.add('DOCK_REASSIGN');
      caps.add('DOCK_CONFIRM_POSITIONING');
      caps.add('DOCK_CONFIRM_OCCUPANCY');
      caps.add('DOCK_RELEASE');
      caps.add('DOCK_OVERRIDE');
      caps.add('DOCK_VIEW_AUDIT');
      break;

    case 'DOCK_SUPERVISOR':
      caps.add('DOCK_SUGGEST');
      caps.add('DOCK_ASSIGN');
      caps.add('DOCK_REASSIGN');
      caps.add('DOCK_CONFIRM_POSITIONING');
      caps.add('DOCK_CONFIRM_OCCUPANCY');
      caps.add('DOCK_RELEASE');
      caps.add('DOCK_OVERRIDE');
      caps.add('DOCK_VIEW_AUDIT');
      break;

    case 'WAREHOUSE_OPERATOR':
      caps.add('DOCK_CONFIRM_POSITIONING');
      caps.add('DOCK_CONFIRM_OCCUPANCY');
      caps.add('DOCK_VIEW_AUDIT');
      break;

    default:
      break;
  }
  return caps;
}

/** Evaluación de Elegibilidad realizada por el Engine */
export interface DockEligibilityCheck {
  isEligible: boolean;
  blockers: string[]; // Motivos de rechazo si no es elegible
}

/** Sugerencia emitida por el Operational Dock Recommendation Engine */
export interface DockRecommendation {
  suggestedDockId: string;
  suggestedDockCode: string;
  category: DockRecommendationCategory;
  algorithm: 'DETERMINISTIC_FIRST_AVAILABLE_V1';
  reasons: string[];
  evaluatedDocksCount: number;
  generatedAt: string;
}

/** Snapshot para Rollback y Auditoría */
export interface DockOperationSnapshot {
  dockBefore?: DockItem;
  secondDockBefore?: DockItem;
  appointmentBefore?: any;
  timestamp: string;
}

export interface DockAuditUserSnapshot {
  performedByUserId: string;
  performedByName: string;
  performedByRole: string;
  branchId: string;
  capabilitiesUsed: DockCapability[];
}

/** Registro de Asignación de Muelle para Auditoría */
export interface DockAssignmentRecord {
  id: string;
  appointmentId: string;
  asnReference: string;
  branchId: string;
  suggestedDockCode?: string;
  assignedDockCode: string;
  previousDockCode?: string;
  status: DockAssignmentStatus;
  source: 'SYSTEM_RECOMMENDED' | 'MANUAL_OVERRIDE';
  overrideReasonCode?: string;
  overrideReasonNotes?: string;
  assignedBy: string;
  userRole: string;
  assignedAt: string;
  reservationExpiresAt?: string;
  positioningStartedAt?: string;
  occupiedAt?: string;
  releasedAt?: string;
}

/** Motivos Predefinidos para Excepción Humana */
export const DOCK_OVERRIDE_REASONS: Record<string, string> = {
  OPERATIONAL_REORGANIZATION: 'Reorganización operativa de patio/muelles',
  RESERVED_OTHER_OPERATION: 'Muelle reservado para otra operación prioritaria',
  UNRECORDED_MAINTENANCE: 'Mantenimiento o falla técnica no registrada',
  SUPERVISOR_INSTRUCTION: 'Instrucción directa de supervisión de turno',
  YARD_CONTINGENCY: 'Contingencia o saturación en zona de maniobras',
  LOAD_DISTRIBUTION: 'Distribución de carga en zona de staging',
  OTHER: 'Otro motivo operativo especificado en observaciones',
};

/** Labels para UI */
export const DOCK_ASSIGNMENT_STATUS_LABELS: Record<DockAssignmentStatus, string> = {
  UNASSIGNED: 'Sin Asignar',
  SUGGESTED: 'Muelle Sugerido',
  RESERVED: 'Muelle Reservado',
  ASSIGNED: 'Muelle Asignado',
  POSITIONING: 'Vehículo Posicionándose',
  OCCUPIED: 'Muelle Ocupado',
  RELEASED: 'Muelle Liberado',
  REASSIGNED: 'Muelle Reasignado',
  EXPIRED: 'Reserva Expirada',
  REASSIGNMENT_REQUIRED: 'Reasignación Requerida',
  CANCELLED: 'Asignación Cancelada',
};

export const DOCK_ASSIGNMENT_STATUS_CLASSES: Record<DockAssignmentStatus, string> = {
  UNASSIGNED: 'dock-chip--unassigned',
  SUGGESTED: 'dock-chip--suggested',
  RESERVED: 'dock-chip--reserved',
  ASSIGNED: 'dock-chip--assigned',
  POSITIONING: 'dock-chip--positioning',
  OCCUPIED: 'dock-chip--occupied',
  RELEASED: 'dock-chip--released',
  REASSIGNED: 'dock-chip--assigned',
  EXPIRED: 'dock-chip--warning',
  REASSIGNMENT_REQUIRED: 'dock-chip--warning',
  CANCELLED: 'dock-chip--cancelled',
};
