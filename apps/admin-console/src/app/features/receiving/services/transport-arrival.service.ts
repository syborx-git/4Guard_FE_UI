/**
 * @file transport-arrival.service.ts
 * @description Servicio de Check-In del Transporte y Confirmación Operativa de Arribo [HU-027].
 * Motor algorítmico de evaluación de datos presentados vs esperados, incidencias de patio, RBAC y auditoría.
 */

import { Injectable, signal, inject } from '@angular/core';
import { ReceptionAppointment } from '../models/reception-appointment.models';
import { AuthState } from '../../../core/auth/auth.state';
import {
  TransportArrivalRecord,
  ArrivalIncident,
  ArrivalIncidentType,
  ArrivalClearanceStatus,
  GateDecision,
  CheckInInput,
  ArrivalAuditEntry,
  ARRIVAL_INCIDENT_POLICY,
  INCIDENT_TYPE_LABELS,
} from '../models/transport-arrival.models';

export interface ArrivalUserContext {
  performedBy: string;
  userRole: string;
  branchId: string;
}

@Injectable({ providedIn: 'root' })
export class TransportArrivalService {
  private readonly authState = inject(AuthState);

  private readonly STORAGE_KEY = '4guard_transport_arrivals_v1';
  private readonly AUDIT_KEY   = '4guard_arrival_audit_v1';

  // Configuración Centralizada de Tolerancias de Horario
  private readonly arrivalConfig = {
    earlyToleranceMinutes: 30,
    lateToleranceMinutes: 45,
  };

  // Matriz RBAC Centralizada
  private readonly ALLOWED_ROLES = {
    CHECKIN: ['ADMIN', 'MANAGER', 'OPERATIONS_MANAGER', 'OPERATIONS_SUPERVISOR', 'WAREHOUSE_OPERATOR', 'MANEUVER_OPERATOR', 'SUPERVISOR', 'OPERATOR'],
    AUTHORIZE_INCIDENT: ['ADMIN', 'MANAGER', 'OPERATIONS_MANAGER', 'OPERATIONS_SUPERVISOR', 'SHIFT_LEADER', 'SUPERVISOR'],
    RESOLVE_INCIDENT: ['ADMIN', 'MANAGER', 'OPERATIONS_MANAGER', 'OPERATIONS_SUPERVISOR', 'SHIFT_LEADER', 'SUPERVISOR'],
    REJECT_AT_GATE: ['ADMIN', 'MANAGER', 'OPERATIONS_MANAGER', 'OPERATIONS_SUPERVISOR', 'SHIFT_LEADER', 'SUPERVISOR'],
  };

  // Signals de estado
  private readonly _arrivalsMap = signal<Record<string, TransportArrivalRecord>>({});
  private readonly _arrivalAuditLog = signal<ArrivalAuditEntry[]>([]);

  readonly arrivalsMap = this._arrivalsMap.asReadonly();
  readonly arrivalAuditLog = this._arrivalAuditLog.asReadonly();

  constructor() {
    this._rehydrateArrivals();
    this._rehydrateAudit();
  }

  private _rehydrateArrivals(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          this._arrivalsMap.set(parsed);
        }
      }
    } catch (e) {
      console.warn('Error al rehidratar registros de arribo desde localStorage.', e);
    }
  }

  private _rehydrateAudit(): void {
    try {
      const stored = localStorage.getItem(this.AUDIT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this._arrivalAuditLog.set(parsed);
        }
      }
    } catch (e) {
      console.warn('Error al rehidratar auditoría de arribos desde localStorage.', e);
    }
  }

  private _saveArrivalsStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._arrivalsMap()));
    } catch (e) {
      console.error('Error al guardar registros de arribo en localStorage', e);
    }
  }

  private _saveAuditStorage(): void {
    try {
      localStorage.setItem(this.AUDIT_KEY, JSON.stringify(this._arrivalAuditLog()));
    } catch (e) {
      console.error('Error al guardar auditoría de arribo en localStorage', e);
    }
  }

  /**
   * Obtiene y valida el contexto actual del usuario desde AuthState o parámetros provistos.
   * Regla de Seguridad: NUNCA asume usuarios o roles privilegiados por defecto.
   */
  private _getUserContext(overrideContext?: Partial<ArrivalUserContext>, appointmentBranchId?: string): ArrivalUserContext {
    const sessionUser = this.authState.currentUser();
    const sessionRole = this.authState.role();

    const performedBy = (overrideContext?.performedBy || sessionUser?.fullName || sessionUser?.username || '').trim();
    const userRole = (overrideContext?.userRole || sessionRole || '').trim();
    const branchId = (overrideContext?.branchId || appointmentBranchId || 'SUC-CDMX-01').trim();

    if (!performedBy || !userRole) {
      throw new Error('No existe una sesión autenticada válida para ejecutar esta acción.');
    }

    return {
      performedBy,
      userRole: userRole.toUpperCase(),
      branchId,
    };
  }

  /**
   * Valida centralizadamente si el rol tiene autorización para ejecutar la acción.
   */
  private _assertRoleAllowed(userRole: string, allowedRoles: string[], actionName: string): void {
    const normRole = (userRole || '').trim().toUpperCase();
    const isAllowed = allowedRoles.some((r) => r.toUpperCase() === normRole);

    if (!isAllowed) {
      throw new Error(
        `Acceso denegado: El rol '${normRole}' no cuenta con permisos para ejecutar la acción '${actionName}'.`
      );
    }
  }

  /**
   * Valida estrictamente los campos de entrada de Check-In.
   */
  private _validateCheckInInput(input: CheckInInput): void {
    if (!input.actualPlates || !input.actualPlates.trim()) {
      throw new Error('Las placas reales del vehículo son obligatorias.');
    }
    if (!input.sealPrimary || !input.sealPrimary.trim()) {
      throw new Error('El sello primario de seguridad es obligatorio.');
    }
    if (!input.accessGate || !input.accessGate.trim()) {
      throw new Error('El punto de acceso o caseta es obligatorio.');
    }
    if (!input.sealPrimaryCondition) {
      throw new Error('La condición física del sello de seguridad es obligatoria.');
    }
  }

  /**
   * Compara los datos esperados de la cita contra los presentados en caseta.
   * Genera la lista de incidencias usando UN ÚNICO contexto de usuario y determina el clearanceStatus inicial.
   */
  evaluateArrival(
    appointment: ReceptionAppointment,
    input: CheckInInput,
    ctx: ArrivalUserContext
  ): {
    incidents: ArrivalIncident[];
    clearanceStatus: ArrivalClearanceStatus;
    gateDecision: GateDecision;
  } {
    const incidents: ArrivalIncident[] = [];
    const now = new Date();

    // 1. Sucursal (Branch)
    if (ctx.branchId && appointment.branchId && ctx.branchId.toUpperCase() !== appointment.branchId.toUpperCase()) {
      incidents.push(
        this._createIncident(
          'WRONG_BRANCH',
          `Sucursal ${appointment.branchId}`,
          `Sucursal ${ctx.branchId}`,
          ctx
        )
      );
    }

    // 2. Proveedor Presentado (si fue ingresado)
    if (input.actualSupplierName && input.actualSupplierName.trim()) {
      const expectedSupplier = (appointment.supplierName || '').trim().toUpperCase();
      const actualSupplier = input.actualSupplierName.trim().toUpperCase();

      if (expectedSupplier && actualSupplier !== expectedSupplier) {
        incidents.push(
          this._createIncident(
            'WRONG_SUPPLIER',
            appointment.supplierName,
            input.actualSupplierName.trim(),
            ctx
          )
        );
      }
    }

    // 3. Placas
    const expectedPlates = (appointment.expectedPlates || '').trim().toUpperCase();
    const actualPlates = (input.actualPlates || '').trim().toUpperCase();
    if (expectedPlates && expectedPlates !== actualPlates) {
      incidents.push(this._createIncident('PLATE_MISMATCH', expectedPlates, actualPlates, ctx));
    }

    // 4. Chofer
    const expectedDriver = (appointment.expectedDriver || '').trim().toUpperCase();
    const actualDriver = (input.actualDriver || '').trim().toUpperCase();
    if (expectedDriver && actualDriver && expectedDriver !== actualDriver) {
      incidents.push(this._createIncident('DRIVER_MISMATCH', expectedDriver, actualDriver, ctx));
    }

    // 5. Transportista
    const expectedCarrier = (appointment.carrierName || '').trim().toUpperCase();
    const actualCarrier = (input.actualCarrier || appointment.carrierName || '').trim().toUpperCase();
    if (expectedCarrier && actualCarrier && expectedCarrier !== actualCarrier) {
      incidents.push(this._createIncident('CARRIER_MISMATCH', expectedCarrier, actualCarrier, ctx));
    }

    // 6. Tipo de Vehículo
    const expectedVehicleType = (appointment.vehicleType || '').trim().toUpperCase();
    const actualVehicleType = (input.actualVehicleType || appointment.vehicleType || '').trim().toUpperCase();
    if (expectedVehicleType && actualVehicleType && expectedVehicleType !== actualVehicleType) {
      incidents.push(this._createIncident('VEHICLE_TYPE_MISMATCH', expectedVehicleType, actualVehicleType, ctx));
    }

    // 7. Horario (Tolerancias)
    if (appointment.scheduledDate && appointment.scheduledTime) {
      const scheduledDt = new Date(`${appointment.scheduledDate}T${appointment.scheduledTime}:00`);
      if (!isNaN(scheduledDt.getTime())) {
        const diffMs = now.getTime() - scheduledDt.getTime();
        const diffMinutes = Math.round(diffMs / (60 * 1000));

        if (diffMinutes < -this.arrivalConfig.earlyToleranceMinutes) {
          incidents.push(
            this._createIncident(
              'EARLY_ARRIVAL',
              `Tolerancia -${this.arrivalConfig.earlyToleranceMinutes}m`,
              `Anticipado ${Math.abs(diffMinutes)}m`,
              ctx
            )
          );
        } else if (diffMinutes > this.arrivalConfig.lateToleranceMinutes) {
          incidents.push(
            this._createIncident(
              'LATE_ARRIVAL',
              `Tolerancia +${this.arrivalConfig.lateToleranceMinutes}m`,
              `Retrasado ${diffMinutes}m`,
              ctx
            )
          );
        }
      }
    }

    // 8. Comparación de Sello Esperado vs Presentado
    const expectedSeal = (appointment.arrivalData?.sealPrimary || '').trim().toUpperCase();
    const actualSeal = (input.sealPrimary || '').trim().toUpperCase();
    if (expectedSeal && actualSeal && expectedSeal !== actualSeal) {
      incidents.push(this._createIncident('SEAL_MISMATCH', expectedSeal, actualSeal, ctx));
    }

    // 9. Condición Física del Sello
    if (input.sealPrimaryCondition === 'DAMAGED' || input.sealPrimaryCondition === 'BROKEN' || input.sealPrimaryCondition === 'MISSING') {
      incidents.push(
        this._createIncident(
          'SEAL_DAMAGED',
          'Sello INTACTO',
          `Sello ${input.sealPrimaryCondition}`,
          ctx
        )
      );
    }

    // 10. Estado FSM Especial
    if (appointment.status === 'CANCELLED') {
      incidents.push(this._createIncident('APPOINTMENT_CANCELLED', 'CONFIRMED', 'CANCELLED', ctx));
    } else if (appointment.status === 'SCHEDULED') {
      incidents.push(this._createIncident('APPOINTMENT_NOT_CONFIRMED', 'CONFIRMED', 'SCHEDULED', ctx));
    }

    // Calcular clearance inicial
    const clearanceStatus = this.recalculateClearance(incidents, 'ADMITTED');
    const gateDecision: GateDecision = clearanceStatus === 'REJECTED_AT_GATE' ? 'REJECTED' : 'ADMITTED';

    return { incidents, clearanceStatus, gateDecision };
  }

  private _createIncident(
    type: ArrivalIncidentType,
    expectedVal: string | undefined,
    actualVal: string | undefined,
    ctx: ArrivalUserContext
  ): ArrivalIncident {
    const policy = ARRIVAL_INCIDENT_POLICY[type];

    return {
      id: `INC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      severity: policy.severity,
      title: INCIDENT_TYPE_LABELS[type] || type,
      description: policy.userMessage,
      expectedValue: expectedVal,
      actualValue: actualVal,
      authorizable: policy.authorizable,
      requiresSupervisorReview: policy.requiresSupervisorReview,
      status: policy.initialStatus || 'OPEN',
      createdAt: new Date().toISOString(),
      createdBy: ctx.performedBy,
    };
  }

  /**
   * Recalcula el estado de liberación de arribo en función de las incidencias activas y resueltas.
   */
  recalculateClearance(incidents: ArrivalIncident[], currentGateDecision: GateDecision = 'ADMITTED'): ArrivalClearanceStatus {
    if (currentGateDecision === 'REJECTED') {
      return 'REJECTED_AT_GATE';
    }

    const openIncidents = incidents.filter((i) => i.status === 'OPEN');
    if (openIncidents.length === 0) {
      const warningOrCriticalResolved = incidents.some(
        (i) => (i.severity === 'WARNING' || i.severity === 'CRITICAL') && (i.status === 'AUTHORIZED' || i.status === 'RESOLVED')
      );
      return warningOrCriticalResolved ? 'WARNING_CLEARED' : 'CLEARED';
    }

    const hasCriticalBlocked = openIncidents.some(
      (i) => i.severity === 'CRITICAL' || !i.authorizable
    );

    if (hasCriticalBlocked) {
      return 'BLOCKED';
    }

    const hasWarnings = openIncidents.some((i) => i.severity === 'WARNING' || i.requiresSupervisorReview);
    if (hasWarnings) {
      return 'REVIEW_REQUIRED';
    }

    return 'CLEARED';
  }

  /**
   * Ejecuta el Check-In del transporte.
   * Regla de Idempotencia: Si la llegada ya fue registrada previamente, registra la auditoría y lanza error controlado.
   */
  processTransportCheckIn(
    appointment: ReceptionAppointment,
    input: CheckInInput,
    userContext?: Partial<ArrivalUserContext>
  ): TransportArrivalRecord {
    const ctx = this._getUserContext(userContext, appointment.branchId);
    this._assertRoleAllowed(ctx.userRole, this.ALLOWED_ROLES.CHECKIN, 'Ejecutar Check-In de Transporte');
    this._validateCheckInInput(input);

    if (appointment.status === 'COMPLETED' || appointment.status === 'CANCELLED' || appointment.status === 'IN_RECEIVING') {
      throw new Error(`No es posible registrar el arribo de una cita en estado '${appointment.status}'.`);
    }

    const existing = this._arrivalsMap()[appointment.id];
    if (existing && appointment.status === 'ARRIVED') {
      this._logAudit({
        appointmentId: appointment.id,
        action: 'DUPLICATE_ARRIVAL_ATTEMPT',
        performedBy: ctx.performedBy,
        userRole: ctx.userRole,
        branchId: ctx.branchId,
        performedAt: new Date().toISOString(),
        previousClearance: existing.clearanceStatus,
        newClearance: existing.clearanceStatus,
        incidentsCount: existing.incidents.length,
        reason: 'Intento de registro de llegada duplicado bloqueado.',
      });
      throw new Error('La llegada de esta cita ya fue registrada previamente.');
    }

    const evaluation = this.evaluateArrival(appointment, input, ctx);

    const record: TransportArrivalRecord = {
      appointmentId: appointment.id,
      actualPlates: input.actualPlates.trim().toUpperCase(),
      actualDriver: (input.actualDriver || appointment.expectedDriver || 'No especificado').trim(),
      actualCarrier: (input.actualCarrier || appointment.carrierName || 'No especificado').trim(),
      actualVehicleType: (input.actualVehicleType || appointment.vehicleType || 'Caja Seca 53ft').trim(),
      sealPrimary: input.sealPrimary.trim().toUpperCase(),
      sealSecondary: input.sealSecondary ? input.sealSecondary.trim().toUpperCase() : undefined,
      sealPrimaryCondition: input.sealPrimaryCondition || 'INTACT',
      accessGate: input.accessGate.trim(),
      observations: input.observations?.trim(),
      arrivedAt: new Date().toISOString(),
      registeredBy: ctx.performedBy,
      userRole: ctx.userRole,
      branchId: appointment.branchId,
      incidents: evaluation.incidents,
      clearanceStatus: evaluation.clearanceStatus,
      gateDecision: evaluation.gateDecision,
    };

    this._arrivalsMap.update((map) => ({ ...map, [appointment.id]: record }));
    this._saveArrivalsStorage();

    this._logAudit({
      appointmentId: appointment.id,
      action: 'ARRIVAL_REGISTERED',
      performedBy: ctx.performedBy,
      userRole: ctx.userRole,
      branchId: ctx.branchId,
      performedAt: record.arrivedAt,
      previousClearance: 'PENDING',
      newClearance: record.clearanceStatus,
      incidentsCount: record.incidents.length,
      reason: `Check-In de unidad completado. Clearance: ${record.clearanceStatus}`,
    });

    return record;
  }

  /**
   * Autoriza una incidencia de arribo (solo para incidencias autorizables con motivo >= 10 chars).
   */
  authorizeArrivalIncident(
    appointmentId: string,
    incidentId: string,
    reason: string,
    userContext?: Partial<ArrivalUserContext>
  ): TransportArrivalRecord {
    const ctx = this._getUserContext(userContext);
    this._assertRoleAllowed(ctx.userRole, this.ALLOWED_ROLES.AUTHORIZE_INCIDENT, 'Autorizar Incidencia de Arribo');

    const record = this._arrivalsMap()[appointmentId];
    if (!record) throw new Error('No existe un registro de arribo para esta cita.');

    if (!reason || reason.trim().length < 10) {
      throw new Error('El motivo de la autorización de incidencia es obligatorio y debe tener al menos 10 caracteres.');
    }

    const incidentIndex = record.incidents.findIndex((i) => i.id === incidentId);
    if (incidentIndex === -1) throw new Error('Incidencia no encontrada.');

    const incident = record.incidents[incidentIndex];
    if (!incident.authorizable) {
      throw new Error(`La incidencia '${incident.title}' es crítica de seguridad y NO puede ser autorizada por excepción.`);
    }

    const updatedIncidents = [...record.incidents];
    updatedIncidents[incidentIndex] = {
      ...incident,
      status: 'AUTHORIZED',
      resolvedBy: ctx.performedBy,
      resolvedAt: new Date().toISOString(),
      resolutionReason: reason.trim(),
    };

    const newClearance = this.recalculateClearance(updatedIncidents, record.gateDecision);

    const updatedRecord: TransportArrivalRecord = {
      ...record,
      incidents: updatedIncidents,
      clearanceStatus: newClearance,
      clearedBy: newClearance === 'CLEARED' || newClearance === 'WARNING_CLEARED' ? ctx.performedBy : record.clearedBy,
      clearedAt: newClearance === 'CLEARED' || newClearance === 'WARNING_CLEARED' ? new Date().toISOString() : record.clearedAt,
    };

    this._arrivalsMap.update((map) => ({ ...map, [appointmentId]: updatedRecord }));
    this._saveArrivalsStorage();

    this._logAudit({
      appointmentId,
      action: 'ARRIVAL_INCIDENT_AUTHORIZED',
      performedBy: ctx.performedBy,
      userRole: ctx.userRole,
      branchId: record.branchId,
      performedAt: new Date().toISOString(),
      previousClearance: record.clearanceStatus,
      newClearance: updatedRecord.clearanceStatus,
      incidentsCount: updatedIncidents.length,
      incidentId: incident.id,
      incidentType: incident.type,
      reason: `Incidencia '${incident.title}' autorizada por supervisor: ${reason.trim()}`,
    });

    return updatedRecord;
  }

  /**
   * Resuelve físicamente o documentalmente una incidencia OPEN.
   */
  resolveArrivalIncident(
    appointmentId: string,
    incidentId: string,
    reason: string,
    userContext?: Partial<ArrivalUserContext>
  ): TransportArrivalRecord {
    const ctx = this._getUserContext(userContext);
    this._assertRoleAllowed(ctx.userRole, this.ALLOWED_ROLES.RESOLVE_INCIDENT, 'Resolver Incidencia de Arribo');

    const record = this._arrivalsMap()[appointmentId];
    if (!record) throw new Error('No existe un registro de arribo para esta cita.');

    if (!reason || reason.trim().length < 10) {
      throw new Error('El motivo de resolución de incidencia es obligatorio y debe tener al menos 10 caracteres.');
    }

    const incidentIndex = record.incidents.findIndex((i) => i.id === incidentId);
    if (incidentIndex === -1) throw new Error('Incidencia no encontrada.');

    const incident = record.incidents[incidentIndex];
    if (incident.status !== 'OPEN') {
      throw new Error(`La incidencia '${incident.title}' ya fue procesada anteriormente.`);
    }

    const updatedIncidents = [...record.incidents];
    updatedIncidents[incidentIndex] = {
      ...incident,
      status: 'RESOLVED',
      resolvedBy: ctx.performedBy,
      resolvedAt: new Date().toISOString(),
      resolutionReason: reason.trim(),
    };

    const newClearance = this.recalculateClearance(updatedIncidents, record.gateDecision);

    const updatedRecord: TransportArrivalRecord = {
      ...record,
      incidents: updatedIncidents,
      clearanceStatus: newClearance,
      clearedBy: newClearance === 'CLEARED' || newClearance === 'WARNING_CLEARED' ? ctx.performedBy : record.clearedBy,
      clearedAt: newClearance === 'CLEARED' || newClearance === 'WARNING_CLEARED' ? new Date().toISOString() : record.clearedAt,
    };

    this._arrivalsMap.update((map) => ({ ...map, [appointmentId]: updatedRecord }));
    this._saveArrivalsStorage();

    this._logAudit({
      appointmentId,
      action: 'ARRIVAL_INCIDENT_RESOLVED',
      performedBy: ctx.performedBy,
      userRole: ctx.userRole,
      branchId: record.branchId,
      performedAt: new Date().toISOString(),
      previousClearance: record.clearanceStatus,
      newClearance: updatedRecord.clearanceStatus,
      incidentsCount: updatedIncidents.length,
      incidentId: incident.id,
      incidentType: incident.type,
      reason: `Incidencia '${incident.title}' resuelta: ${reason.trim()}`,
    });

    return updatedRecord;
  }

  /**
   * Rechaza el ingreso de la unidad en caseta (`REJECTED_AT_GATE`).
   */
  rejectAtGate(
    appointmentId: string,
    reason: string,
    userContext?: Partial<ArrivalUserContext>
  ): TransportArrivalRecord {
    const ctx = this._getUserContext(userContext);
    this._assertRoleAllowed(ctx.userRole, this.ALLOWED_ROLES.REJECT_AT_GATE, 'Rechazar Unidad en Caseta');

    const record = this._arrivalsMap()[appointmentId];
    if (!record) throw new Error('No existe un registro de arribo previo para esta cita.');

    if (!reason || reason.trim().length < 10) {
      throw new Error('El motivo de rechazo en caseta es obligatorio y debe tener al menos 10 caracteres.');
    }

    const updatedRecord: TransportArrivalRecord = {
      ...record,
      gateDecision: 'REJECTED',
      clearanceStatus: 'REJECTED_AT_GATE',
      clearanceReason: reason.trim(),
      clearedBy: ctx.performedBy,
      clearedAt: new Date().toISOString(),
    };

    this._arrivalsMap.update((map) => ({ ...map, [appointmentId]: updatedRecord }));
    this._saveArrivalsStorage();

    this._logAudit({
      appointmentId,
      action: 'ARRIVAL_REJECTED_AT_GATE',
      performedBy: ctx.performedBy,
      userRole: ctx.userRole,
      branchId: record.branchId,
      performedAt: new Date().toISOString(),
      previousClearance: record.clearanceStatus,
      newClearance: 'REJECTED_AT_GATE',
      incidentsCount: record.incidents.length,
      reason: `Unidad rechazada en caseta: ${reason.trim()}`,
    });

    return updatedRecord;
  }

  private _logAudit(entry: Omit<ArrivalAuditEntry, 'id'>): void {
    const newEntry: ArrivalAuditEntry = {
      ...entry,
      id: `ARRAUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };

    this._arrivalAuditLog.update((logs) => [newEntry, ...logs]);
    this._saveAuditStorage();
  }
}
