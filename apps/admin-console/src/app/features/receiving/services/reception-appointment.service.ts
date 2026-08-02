/**
 * @file reception-appointment.service.ts
 * @description Servicio de Gestión de Citas de Recepción [HU-028].
 * Maneja el estado centralizado mediante Angular Signals y persistencia local defensiva en localStorage.
 */

import { Injectable, signal, computed } from '@angular/core';
import {
  ReceptionAppointment,
  AppointmentAuditEntry,
  AppointmentStatus,
  ReceptionProgress,
  ArrivalData,
  INITIAL_APPOINTMENTS_SEED,
} from '../models/reception-appointment.models';
import { ArrivalClearanceStatus, TransportArrivalRecord, ArrivalIncident } from '../models/transport-arrival.models';

@Injectable({ providedIn: 'root' })
export class ReceptionAppointmentService {
  private readonly STORAGE_KEY = '4guard_reception_appointments_v1';
  private readonly AUDIT_KEY = '4guard_reception_audit_v1';

  // State Signals
  private readonly _appointments = signal<ReceptionAppointment[]>([]);
  private readonly _auditLog = signal<AppointmentAuditEntry[]>([]);
  private readonly _selectedAppointmentId = signal<string | null>(null);

  // Readonly Signals Public Interfaces
  readonly appointments = this._appointments.asReadonly();
  readonly auditLog = this._auditLog.asReadonly();
  readonly selectedAppointmentId = this._selectedAppointmentId.asReadonly();

  readonly selectedAppointment = computed(() => {
    const id = this._selectedAppointmentId();
    if (!id) return null;
    return this._appointments().find((a) => a.id === id) ?? null;
  });

  constructor() {
    this._rehydrateAppointments();
    this._rehydrateAudit();
  }

  /**
   * Rehidrata citas desde localStorage de manera defensiva.
   */
  private _rehydrateAppointments(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this._appointments.set(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn('Error al rehidratar citas desde localStorage. Usando datos iniciales.', e);
    }
    // Seed por defecto si está vacío o falla
    this._appointments.set(INITIAL_APPOINTMENTS_SEED);
    this._saveAppointmentsStorage();
  }

  /**
   * Rehidrata el historial de auditoría desde localStorage de manera independiente.
   */
  private _rehydrateAudit(): void {
    try {
      const stored = localStorage.getItem(this.AUDIT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this._auditLog.set(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn('Error al rehidratar auditoría desde localStorage. Inicializando vacío.', e);
    }
    this._auditLog.set([]);
  }

  private _saveAppointmentsStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._appointments()));
    } catch (e) {
      console.error('Error al guardar citas en localStorage', e);
    }
  }

  private _saveAuditStorage(): void {
    try {
      localStorage.setItem(this.AUDIT_KEY, JSON.stringify(this._auditLog()));
    } catch (e) {
      console.error('Error al guardar auditoría en localStorage', e);
    }
  }

  /**
   * Matriz explícita de transiciones permitidas según FSM aprobada.
   */
  canTransition(currentStatus: AppointmentStatus, nextStatus: AppointmentStatus): boolean {
    const validTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
      DRAFT: ['SCHEDULED', 'CANCELLED'],
      SCHEDULED: ['CONFIRMED', 'CANCELLED', 'NO_SHOW', 'SCHEDULED'],
      CONFIRMED: ['ARRIVED', 'CANCELLED', 'NO_SHOW', 'SCHEDULED'],
      ARRIVED: ['IN_RECEIVING', 'REJECTED'],
      IN_RECEIVING: ['COMPLETED'],
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: [], // Estado terminal
      REJECTED: [],
    };
    return validTransitions[currentStatus]?.includes(nextStatus) ?? false;
  }

  /**
   * Selecciona una cita activa por ID.
   */
  setSelectedAppointmentId(id: string | null): void {
    this._selectedAppointmentId.set(id);
  }

  /**
   * Obtiene una cita por ID.
   */
  getAppointmentById(id: string): ReceptionAppointment | undefined {
    return this._appointments().find((a) => a.id === id);
  }

  /**
   * Valida solapamiento de horarios y andenes ocupados.
   */
  validateDockAvailability(
    scheduledDate: string,
    scheduledTime: string,
    durationMinutes: number,
    dockNumber: string,
    excludeAppointmentId?: string
  ): { valid: boolean; conflictMessage?: string } {
    const activeAppts = this._appointments().filter(
      (a) =>
        a.id !== excludeAppointmentId &&
        a.dockNumber === dockNumber &&
        a.scheduledDate === scheduledDate &&
        ['SCHEDULED', 'CONFIRMED', 'ARRIVED', 'IN_RECEIVING'].includes(a.status)
    );

    const newStart = this._timeToMinutes(scheduledTime);
    const newEnd = newStart + durationMinutes;

    for (const appt of activeAppts) {
      const apptStart = this._timeToMinutes(appt.scheduledTime);
      const apptEnd = apptStart + appt.durationMinutes;

      if (newStart < apptEnd && newEnd > apptStart) {
        return {
          valid: false,
          conflictMessage: `El andén ${dockNumber} está ocupado por la cita ${appt.id} (${appt.asnReference}) entre ${appt.scheduledTime} y ${this._minutesToTime(apptEnd)}.`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Valida si el ASN ya existe y está activo.
   */
  validateAsnUniqueness(asn: string, excludeAppointmentId?: string): boolean {
    const existing = this._appointments().find(
      (a) =>
        a.id !== excludeAppointmentId &&
        a.asnReference.trim().toUpperCase() === asn.trim().toUpperCase() &&
        !['CANCELLED', 'COMPLETED', 'NO_SHOW', 'REJECTED'].includes(a.status)
    );
    return !existing;
  }

  /**
   * Crea una nueva cita.
   */
  createAppointment(dto: Partial<ReceptionAppointment>): ReceptionAppointment {
    const nextNum = this._appointments().length + 1;
    const newId = `APT-${String(nextNum).padStart(4, '0')}`;

    const newAppt: ReceptionAppointment = {
      id: newId,
      branchId: dto.branchId || 'SUC-001',
      branchName: dto.branchName || 'Planta Central CDMX',
      clientId: dto.clientId || 'CLI-3PL-01',
      clientName: dto.clientName || 'Cliente Genérico 3PL',
      supplierId: dto.supplierId || 'SUP-101',
      supplierName: dto.supplierName || 'Proveedor General S.A.',
      supplierActive: dto.supplierActive ?? true,
      receptionType: dto.receptionType || 'NATIONAL',
      asnReference: dto.asnReference || `ASN-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      priority: dto.priority || 'NORMAL',
      observations: dto.observations,

      scheduledDate: dto.scheduledDate || new Date().toISOString().split('T')[0],
      scheduledTime: dto.scheduledTime || '09:00',
      durationMinutes: dto.durationMinutes || 60,
      dockNumber: dto.dockNumber || 'AND-01',

      carrierId: dto.carrierId || 'CAR-501',
      carrierName: dto.carrierName || 'Transportes Express del Norte',
      carrierSuspended: dto.carrierSuspended ?? false,
      expectedPlates: dto.expectedPlates || '00-AA-00',
      expectedDriver: dto.expectedDriver,
      vehicleType: dto.vehicleType || 'Tráiler 53ft',

      status: dto.status || 'SCHEDULED',
      lines: dto.lines || [],

      createdAt: new Date().toISOString(),
      createdBy: 'OPERATIONS_MANAGER',
    };

    this._appointments.update((list) => [newAppt, ...list]);
    this._saveAppointmentsStorage();

    this._logAudit({
      appointmentId: newId,
      action: 'CREATE',
      newValues: { status: newAppt.status, asn: newAppt.asnReference, dock: newAppt.dockNumber },
      branchId: newAppt.branchId,
      reason: 'Creación de cita en Centro de Recepciones',
    });

    return newAppt;
  }

  /**
   * Edita una cita existente.
   */
  updateAppointment(id: string, updates: Partial<ReceptionAppointment>): ReceptionAppointment {
    const current = this.getAppointmentById(id);
    if (!current) throw new Error(`Cita ${id} no encontrada.`);

    const updated: ReceptionAppointment = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this._appointments.update((list) => list.map((a) => (a.id === id ? updated : a)));
    this._saveAppointmentsStorage();

    this._logAudit({
      appointmentId: id,
      action: 'EDIT',
      previousValues: { dock: current.dockNumber, scheduledTime: current.scheduledTime },
      newValues: { dock: updated.dockNumber, scheduledTime: updated.scheduledTime },
      branchId: updated.branchId,
      reason: 'Modificación de parámetros de la cita',
    });

    return updated;
  }

  /**
   * Confirma una cita (SCHEDULED -> CONFIRMED).
   */
  confirmAppointment(id: string): void {
    const appt = this.getAppointmentById(id);
    if (!appt || !this.canTransition(appt.status, 'CONFIRMED')) return;

    this.updateAppointment(id, { status: 'CONFIRMED' });
    this._logAudit({
      appointmentId: id,
      action: 'CONFIRM',
      previousValues: { status: appt.status },
      newValues: { status: 'CONFIRMED' },
      branchId: appt.branchId,
      reason: 'Confirmación de cita por proveedor/transportista',
    });
  }

  /**
   * Registra la llegada física del vehículo (CONFIRMED -> ARRIVED) con datos completos de Check-In (HU-027).
   */
  registerArrival(
    id: string,
    actualPlates: string,
    actualDriver: string | undefined,
    sealPrimary: string,
    sealSecondary?: string,
    clearanceStatus: ArrivalClearanceStatus = 'CLEARED',
    transportRecord?: TransportArrivalRecord
  ): void {
    const appt = this.getAppointmentById(id);
    if (!appt || !this.canTransition(appt.status, 'ARRIVED')) return;

    const arrivalData: ArrivalData = {
      actualPlates,
      actualDriver,
      sealPrimary,
      sealSecondary,
      arrivedAt: transportRecord?.arrivedAt || new Date().toISOString(),
      registeredBy: transportRecord?.registeredBy || 'OPERATIONS_MANAGER',
    };

    this.updateAppointment(id, {
      status: 'ARRIVED',
      arrivalData,
      arrivalClearanceStatus: clearanceStatus,
      transportArrivalRecord: transportRecord,
      arrivalIncidentsCount: transportRecord?.incidents?.length || 0,
      openArrivalIncidentsCount: transportRecord?.incidents?.filter((i: ArrivalIncident) => i.status === 'OPEN').length || 0,
    });

    this._logAudit({
      appointmentId: id,
      action: 'REGISTER_ARRIVAL',
      previousValues: { status: appt.status, arrivalClearanceStatus: appt.arrivalClearanceStatus || 'PENDING' },
      newValues: { status: 'ARRIVED', arrivalClearanceStatus: clearanceStatus, arrivalData },
      branchId: appt.branchId,
      reason: `Vehículo registrado en patio/andén (Clearance: ${clearanceStatus})`,
    });
  }

  /**
   * Actualiza el estado de liberación de arribo (HU-027).
   */
  updateArrivalClearanceStatus(
    id: string,
    clearanceStatus: ArrivalClearanceStatus,
    transportRecord?: TransportArrivalRecord
  ): void {
    const appt = this.getAppointmentById(id);
    if (!appt) return;

    this.updateAppointment(id, {
      arrivalClearanceStatus: clearanceStatus,
      transportArrivalRecord: transportRecord || appt.transportArrivalRecord,
      arrivalIncidentsCount: transportRecord?.incidents?.length ?? appt.arrivalIncidentsCount ?? 0,
      openArrivalIncidentsCount: transportRecord?.incidents?.filter((i: ArrivalIncident) => i.status === 'OPEN').length ?? appt.openArrivalIncidentsCount ?? 0,
    });
  }

  /**
   * Inicia la recepción (ARRIVED -> IN_RECEIVING).
   * Aplica la Triple Compuerta Operativa: FSM ARRIVED + HU-029 Documental + HU-027 Check-In Arribo.
   */
  startReceiving(id: string): void {
    const appt = this.getAppointmentById(id);
    if (!appt || !this.canTransition(appt.status, 'IN_RECEIVING')) return;

    // 1. HU-029: Compuerta Documental de Orden de Compra (PO)
    const poStatus = appt.poValidationStatus || 'PENDING';
    const allowedPOStatuses = ['VALIDATED', 'EXCEPTED', 'NOT_REQUIRED'];
    if (!allowedPOStatuses.includes(poStatus)) {
      throw new Error(
        `No es posible iniciar la recepción física. La validación documental de la Orden de Compra se encuentra en estado '${poStatus}'. Debe ser VALIDATED, EXCEPTED o NOT_REQUIRED.`
      );
    }

    // 2. HU-027: Compuerta Operativa de Check-In del Transporte (Regla de Oro: NUNCA asumimos CLEARED por defecto)
    const arrivalClearance = appt.arrivalClearanceStatus ?? 'PENDING';
    const allowedArrivalClearances = ['CLEARED', 'WARNING_CLEARED'];

    if (!allowedArrivalClearances.includes(arrivalClearance)) {
      if (arrivalClearance === 'PENDING') {
        throw new Error('No es posible iniciar la recepción física: El Check-In del Transporte aún no ha sido completado.');
      }
      if (arrivalClearance === 'REVIEW_REQUIRED') {
        throw new Error('No es posible iniciar la recepción física: El arribo requiere revisión de un supervisor antes de iniciar la recepción.');
      }
      if (arrivalClearance === 'BLOCKED') {
        throw new Error('No es posible iniciar la recepción física: El vehículo presenta incidencias críticas de arribo sin resolver.');
      }
      if (arrivalClearance === 'REJECTED_AT_GATE') {
        throw new Error('No es posible iniciar la recepción física: La unidad fue rechazada en el punto de acceso.');
      }
      throw new Error(`No es posible iniciar la recepción física: Estatus de arribo no autorizado ('${arrivalClearance}').`);
    }

    const progress: ReceptionProgress = appt.progress || {
      currentStep: 1,
      startedAt: new Date().toISOString(),
      startedBy: 'OPERATIONS_MANAGER',
      vehicleDataCompleted: true,
      reconciliationCompleted: false,
      receivedQtyByLine: {},
    };

    this.updateAppointment(id, {
      status: 'IN_RECEIVING',
      progress,
    });

    this._logAudit({
      appointmentId: id,
      action: 'START_RECEIVING',
      previousValues: { status: appt.status },
      newValues: { status: 'IN_RECEIVING' },
      branchId: appt.branchId,
      reason: 'Inicio de recepción dentro de La Bóveda Wizard',
    });
  }

  /**
   * Actualiza el estado de validación de la Orden de Compra en la cita.
   */
  updatePOValidationStatus(
    id: string,
    poValidationStatus: import('../models/purchase-order.models').POValidationStatus,
    poValidationResult?: import('../models/purchase-order.models').POValidationResult
  ): void {
    const appt = this.getAppointmentById(id);
    if (!appt) return;

    this.updateAppointment(id, {
      poValidationStatus,
      poValidationResult,
    });
  }

  /**
   * Actualiza el progreso de la recepción (escaneos, paso actual).
   */
  updateProgress(id: string, progressUpdates: Partial<ReceptionProgress>): void {
    const appt = this.getAppointmentById(id);
    if (!appt) return;

    const currentProgress = appt.progress || {
      currentStep: 1,
      vehicleDataCompleted: true,
      reconciliationCompleted: false,
      receivedQtyByLine: {},
    };

    const newProgress: ReceptionProgress = {
      ...currentProgress,
      ...progressUpdates,
    };

    this.updateAppointment(id, { progress: newProgress });
  }

  /**
   * Reprograma una cita (mantiene estado SCHEDULED y audita cambio).
   */
  reprogramAppointment(
    id: string,
    newDate: string,
    newTime: string,
    newDock: string,
    reason: string
  ): void {
    const appt = this.getAppointmentById(id);
    if (!appt) return;

    const prevDate = appt.scheduledDate;
    const prevTime = appt.scheduledTime;
    const prevDock = appt.dockNumber;

    this.updateAppointment(id, {
      scheduledDate: newDate,
      scheduledTime: newTime,
      dockNumber: newDock,
      status: 'SCHEDULED', // Permanece en SCHEDULED
    });

    this._logAudit({
      appointmentId: id,
      action: 'REPROGRAM',
      previousValues: { scheduledDate: prevDate, scheduledTime: prevTime, dockNumber: prevDock },
      newValues: { scheduledDate: newDate, scheduledTime: newTime, dockNumber: newDock },
      branchId: appt.branchId,
      reason: `Reprogramación auditada: ${reason}`,
    });
  }

  /**
   * Cancela una cita.
   */
  cancelAppointment(id: string, reason: string): void {
    const appt = this.getAppointmentById(id);
    if (!appt || !this.canTransition(appt.status, 'CANCELLED')) return;

    this.updateAppointment(id, { status: 'CANCELLED' });

    this._logAudit({
      appointmentId: id,
      action: 'CANCEL',
      previousValues: { status: appt.status },
      newValues: { status: 'CANCELLED' },
      branchId: appt.branchId,
      reason,
    });
  }

  /**
   * Marca cita como No Show (Estado terminal).
   */
  markNoShow(id: string, reason?: string): void {
    const appt = this.getAppointmentById(id);
    if (!appt || !this.canTransition(appt.status, 'NO_SHOW')) return;

    this.updateAppointment(id, { status: 'NO_SHOW' });

    this._logAudit({
      appointmentId: id,
      action: 'MARK_NO_SHOW',
      previousValues: { status: appt.status },
      newValues: { status: 'NO_SHOW' },
      branchId: appt.branchId,
      reason: reason || 'Vehículo no se presentó en la fecha y hora programada',
    });
  }

  /**
   * Marca cita como Rechazada / Incidencia.
   */
  rejectAppointment(id: string, reason: string): void {
    const appt = this.getAppointmentById(id);
    if (!appt || !this.canTransition(appt.status, 'REJECTED')) return;

    this.updateAppointment(id, { status: 'REJECTED' });

    this._logAudit({
      appointmentId: id,
      action: 'REJECT',
      previousValues: { status: appt.status },
      newValues: { status: 'REJECTED' },
      branchId: appt.branchId,
      reason,
    });
  }

  /**
   * Clona una cita (utilizado principalmente para crear nueva cita basada en un NO_SHOW).
   */
  cloneAsNewAppointment(originalId: string, newDate: string, newTime: string, newDock: string): ReceptionAppointment {
    const original = this.getAppointmentById(originalId);
    if (!original) throw new Error(`Cita original ${originalId} no encontrada.`);

    const newAppt = this.createAppointment({
      branchId: original.branchId,
      branchName: original.branchName,
      clientId: original.clientId,
      clientName: original.clientName,
      supplierId: original.supplierId,
      supplierName: original.supplierName,
      supplierActive: original.supplierActive,
      receptionType: original.receptionType,
      asnReference: `${original.asnReference}-R`,
      priority: original.priority,
      observations: `Re-agendada desde cita No Show ${original.id}. ${original.observations || ''}`,

      scheduledDate: newDate,
      scheduledTime: newTime,
      durationMinutes: original.durationMinutes,
      dockNumber: newDock,

      carrierId: original.carrierId,
      carrierName: original.carrierName,
      carrierSuspended: original.carrierSuspended,
      expectedPlates: original.expectedPlates,
      expectedDriver: original.expectedDriver,
      vehicleType: original.vehicleType,

      status: 'SCHEDULED',
      lines: original.lines.map(l => ({ ...l })),
    });

    this._logAudit({
      appointmentId: newAppt.id,
      action: 'CLONE_NEW',
      previousValues: { clonedFromAppointmentId: originalId },
      newValues: { newAppointmentId: newAppt.id, scheduledDate: newDate, dockNumber: newDock },
      branchId: newAppt.branchId,
      reason: `Nueva cita creada a partir de No Show ${originalId}`,
    });

    return newAppt;
  }

  /**
   * Registra una entrada en la auditoría.
   */
  private _logAudit(entry: Omit<AppointmentAuditEntry, 'id' | 'performedBy' | 'performedAt'>): void {
    const newEntry: AppointmentAuditEntry = {
      ...entry,
      id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      performedBy: 'OPERATIONS_MANAGER',
      performedAt: new Date().toISOString(),
    };

    this._auditLog.update((logs) => [newEntry, ...logs]);
    this._saveAuditStorage();
  }

  // Helpers de conversión de tiempo
  private _timeToMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  private _minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
