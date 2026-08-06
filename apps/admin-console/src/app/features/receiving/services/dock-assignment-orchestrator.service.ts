/**
 * @file dock-assignment-orchestrator.service.ts
 * @description Orquestador Coordinado con Rollback Lógico en Frontend para Asignación de Muelles [HU-030].
 * Administra transacciones coordinadas entre LocationService (SSOT Físico), ReceptionAppointmentService (SSOT Citas) y Auditoría.
 */

import { Injectable, inject } from '@angular/core';
import { AuthState } from '../../../core/auth/auth.state';
import { LocationService } from '../../admin/services/location.service';
import { ReceptionAppointmentService } from './reception-appointment.service';
import { ReceptionAppointment } from '../models/reception-appointment.models';
import { DockItem } from '../../inventory/models/warehouse-location.models';
import {
  DockAssignmentStatus,
  DockCapability,
  DockUserContext,
  DockUserContextDTO,
  DockOperationSnapshot,
  DockAuditUserSnapshot,
  resolveDemoDockCapabilities,
  DockEligibilityCheck,
  DockRecommendation,
} from '../models/dock-assignment.models';

export interface DockOperationResult {
  success: boolean;
  appointmentId: string;
  dockCode: string;
  status: DockAssignmentStatus;
  message: string;
  isOverride?: boolean;
}

@Injectable({ providedIn: 'root' })
export class DockAssignmentOrchestratorService {
  private readonly authState = inject(AuthState);
  private readonly locationService = inject(LocationService);
  private readonly appointmentService = inject(ReceptionAppointmentService);

  /**
   * Resuelve el contexto de usuario autenticado.
   * Lanza error de seguridad si no existe sesión válida.
   */
  resolveDockUserContext(): DockUserContext {
    const user = this.authState.currentUser();
    const isAuthenticated = this.authState.isAuthenticated();

    if (!user || !isAuthenticated) {
      throw new Error('Se requiere una sesión activa con permisos para gestionar muelles (Acceso no autorizado).');
    }

    const capabilities = resolveDemoDockCapabilities(user.role);
    const activeBranchId = (this.authState as any).activeBranchId?.() || 'SUC-001';

    return {
      userId: user.id || 'USR-ANON',
      userName: user.fullName || user.username || 'Usuario Autenticado',
      role: user.role || 'GUEST',
      branchId: activeBranchId,
      capabilities,
    };
  }

  /**
   * Formatea el snapshot de usuario para auditoría limpia.
   */
  private _buildAuditUserSnapshot(context: DockUserContext): DockAuditUserSnapshot {
    return {
      performedByUserId: context.userId,
      performedByName: context.userName,
      performedByRole: context.role,
      branchId: context.branchId,
      capabilitiesUsed: Array.from(context.capabilities),
    };
  }

  /**
   * Evalúa la elegibilidad de una cita para asignación.
   */
  evaluateEligibility(appointment: ReceptionAppointment | null): DockEligibilityCheck {
    const context = this.resolveDockUserContext();
    return this.locationService.evaluateEligibility(appointment, context.branchId);
  }

  /**
   * Genera la sugerencia del Recommendation Engine.
   */
  recommendDock(appointment: ReceptionAppointment): DockRecommendation {
    const context = this.resolveDockUserContext();
    return this.locationService.recommendDock(appointment, context.branchId);
  }

  /**
   * Obtiene la lista de muelles de la sucursal activa (Lectura pura).
   */
  getDocksForActiveBranch(): DockItem[] {
    const context = this.resolveDockUserContext();
    return this.locationService.getDocksForBranch(context.branchId);
  }

  /**
   * Reservar Muelle (Orquestación coordinada con compensación)
   */
  async reserveDock(params: {
    appointmentId: string;
    dockCode: string;
    expectedDockVersion?: number;
    expectedAppointmentVersion?: number;
    overrideReasonCode?: string;
    overrideReasonNotes?: string;
  }): Promise<DockOperationResult> {
    const context = this.resolveDockUserContext();

    if (!context.capabilities.has('DOCK_ASSIGN')) {
      throw new Error('Su rol no cuenta con la capacidad DOCK_ASSIGN requerida para reservar muelles.');
    }

    const appt = this.appointmentService.getAppointmentById(params.appointmentId);
    if (!appt) throw new Error(`Cita ${params.appointmentId} no encontrada.`);

    // Validar compuertas de elegibilidad
    const eligibility = this.locationService.evaluateEligibility(appt, context.branchId);
    if (!eligibility.isEligible) {
      throw new Error(`Asignación bloqueada: ${eligibility.blockers.join(' | ')}`);
    }

    // Tomar Snapshot antes de la mutación
    const dockBefore = this.locationService.getDockByCode(params.dockCode);
    const snapshot: DockOperationSnapshot = {
      dockBefore: dockBefore ? { ...dockBefore } : undefined,
      appointmentBefore: { ...appt },
      timestamp: new Date().toISOString(),
    };

    try {
      // 1. Mutar Muelle Físico
      const updatedDock = this.locationService.reserveDock(
        params.dockCode,
        params.appointmentId,
        params.expectedDockVersion,
        20
      );

      // 2. Mutar Referencia en Cita de Recepción
      this.appointmentService.assignDockToAppointment(
        params.appointmentId,
        params.dockCode,
        'RESERVED',
        context.userName
      );

      // 3. Auditoría Única
      const isOverride = !!params.overrideReasonCode;
      this.appointmentService.logCustomAudit({
        appointmentId: params.appointmentId,
        action: isOverride ? 'DOCK_OVERRIDE_APPLIED' : 'DOCK_RESERVED',
        previousValues: { dockNumber: appt.dockNumber, status: appt.dockAssignmentStatus },
        newValues: { dockNumber: params.dockCode, status: 'RESERVED', overrideReason: params.overrideReasonCode },
        reason: isOverride ? `Excepción de muelle: ${params.overrideReasonCode}` : `Muelle ${params.dockCode} reservado`,
        userSnapshot: this._buildAuditUserSnapshot(context),
      });

      return {
        success: true,
        appointmentId: params.appointmentId,
        dockCode: params.dockCode,
        status: 'RESERVED',
        message: `Muelle ${params.dockCode} reservado exitosamente.`,
        isOverride,
      };
    } catch (e: any) {
      // Rollback Lógico si ocurrió algún error compensable
      if (snapshot.dockBefore) {
        this.locationService.restoreDockSnapshot(snapshot.dockBefore);
      }
      throw e;
    }
  }

  /**
   * Reasignación Operativa de Muelle (Secuencia Corregida con Snapshot)
   */
  async reassignDock(params: {
    appointmentId: string;
    oldDockCode: string;
    newDockCode: string;
    expectedOldDockVersion?: number;
    expectedNewDockVersion?: number;
    overrideReasonCode: string;
    overrideReasonNotes?: string;
  }): Promise<DockOperationResult> {
    const context = this.resolveDockUserContext();

    if (!context.capabilities.has('DOCK_REASSIGN') || !context.capabilities.has('DOCK_OVERRIDE')) {
      throw new Error('Se requieren las capacidades DOCK_REASSIGN y DOCK_OVERRIDE para reasignar muelles.');
    }

    if (!params.overrideReasonCode) {
      throw new Error('La reasignación de muelle exige un motivo de excepción obligatorio.');
    }

    const appt = this.appointmentService.getAppointmentById(params.appointmentId);
    if (!appt) throw new Error(`Cita ${params.appointmentId} no encontrada.`);

    const oldDock = this.locationService.getDockByCode(params.oldDockCode);
    const newDock = this.locationService.getDockByCode(params.newDockCode);

    if (!oldDock || !newDock) throw new Error('Uno o ambos muelles especificados no existen.');

    // Snapshot para compensación atómica en frontend
    const snapshot: DockOperationSnapshot = {
      dockBefore: { ...oldDock },
      secondDockBefore: { ...newDock },
      appointmentBefore: { ...appt },
      timestamp: new Date().toISOString(),
    };

    try {
      // 1. Reservar Nuevo Muelle
      this.locationService.reserveDock(params.newDockCode, params.appointmentId, params.expectedNewDockVersion);

      // 2. Actualizar Cita Logística
      this.appointmentService.assignDockToAppointment(
        params.appointmentId,
        params.newDockCode,
        'REASSIGNED',
        context.userName
      );

      // 3. Liberar Muelle Anterior
      this.locationService.releaseDock(params.oldDockCode, params.appointmentId, params.expectedOldDockVersion);

      // 4. Auditoría Única de Reasignación
      this.appointmentService.logCustomAudit({
        appointmentId: params.appointmentId,
        action: 'DOCK_REASSIGNED',
        previousValues: { dockNumber: params.oldDockCode },
        newValues: { dockNumber: params.newDockCode, overrideReasonCode: params.overrideReasonCode },
        reason: `Reasignación de ${params.oldDockCode} a ${params.newDockCode}: ${params.overrideReasonCode}`,
        userSnapshot: this._buildAuditUserSnapshot(context),
      });

      return {
        success: true,
        appointmentId: params.appointmentId,
        dockCode: params.newDockCode,
        status: 'REASSIGNED',
        message: `Muelle reasignado de ${params.oldDockCode} a ${params.newDockCode} correctamente.`,
        isOverride: true,
      };
    } catch (e: any) {
      // Rollback Lógico completo
      if (snapshot.dockBefore) this.locationService.restoreDockSnapshot(snapshot.dockBefore);
      if (snapshot.secondDockBefore) this.locationService.restoreDockSnapshot(snapshot.secondDockBefore);
      throw e;
    }
  }

  /**
   * Iniciar Traslado / Posicionamiento
   */
  async startPositioning(params: { appointmentId: string; dockCode: string; expectedVersion?: number }): Promise<DockOperationResult> {
    const context = this.resolveDockUserContext();

    if (!context.capabilities.has('DOCK_CONFIRM_POSITIONING')) {
      throw new Error('Su rol no cuenta con la capacidad DOCK_CONFIRM_POSITIONING.');
    }

    const appt = this.appointmentService.getAppointmentById(params.appointmentId);
    if (!appt) throw new Error(`Cita ${params.appointmentId} no encontrada.`);

    const dockBefore = this.locationService.getDockByCode(params.dockCode);
    const snapshot: DockOperationSnapshot = {
      dockBefore: dockBefore ? { ...dockBefore } : undefined,
      appointmentBefore: { ...appt },
      timestamp: new Date().toISOString(),
    };

    try {
      this.locationService.startPositioning(params.dockCode, params.appointmentId, params.expectedVersion);
      this.appointmentService.updateDockAssignmentStatus(params.appointmentId, 'POSITIONING');

      this.appointmentService.logCustomAudit({
        appointmentId: params.appointmentId,
        action: 'DOCK_POSITIONING_STARTED',
        newValues: { dockNumber: params.dockCode, status: 'POSITIONING' },
        reason: `Inicio de traslado del vehículo hacia el muelle ${params.dockCode}`,
        userSnapshot: this._buildAuditUserSnapshot(context),
      });

      return {
        success: true,
        appointmentId: params.appointmentId,
        dockCode: params.dockCode,
        status: 'POSITIONING',
        message: `Vehículo en traslado hacia el muelle ${params.dockCode}.`,
      };
    } catch (e: any) {
      if (snapshot.dockBefore) this.locationService.restoreDockSnapshot(snapshot.dockBefore);
      throw e;
    }
  }

  /**
   * Confirmar Ocupación Física del Muelle
   */
  async confirmOccupancy(params: { appointmentId: string; dockCode: string; expectedVersion?: number }): Promise<DockOperationResult> {
    const context = this.resolveDockUserContext();

    if (!context.capabilities.has('DOCK_CONFIRM_OCCUPANCY')) {
      throw new Error('Su rol no cuenta con la capacidad DOCK_CONFIRM_OCCUPANCY.');
    }

    const appt = this.appointmentService.getAppointmentById(params.appointmentId);
    if (!appt) throw new Error(`Cita ${params.appointmentId} no encontrada.`);

    const dockBefore = this.locationService.getDockByCode(params.dockCode);
    const snapshot: DockOperationSnapshot = {
      dockBefore: dockBefore ? { ...dockBefore } : undefined,
      appointmentBefore: { ...appt },
      timestamp: new Date().toISOString(),
    };

    try {
      this.locationService.confirmOccupancy(params.dockCode, params.appointmentId, params.expectedVersion);
      this.appointmentService.updateDockAssignmentStatus(params.appointmentId, 'OCCUPIED');

      this.appointmentService.logCustomAudit({
        appointmentId: params.appointmentId,
        action: 'DOCK_OCCUPIED',
        newValues: { dockNumber: params.dockCode, status: 'OCCUPIED' },
        reason: `Ocupación física confirmada en muelle ${params.dockCode}`,
        userSnapshot: this._buildAuditUserSnapshot(context),
      });

      return {
        success: true,
        appointmentId: params.appointmentId,
        dockCode: params.dockCode,
        status: 'OCCUPIED',
        message: `Muelle ${params.dockCode} ocupado físicamente por el transporte.`,
      };
    } catch (e: any) {
      if (snapshot.dockBefore) this.locationService.restoreDockSnapshot(snapshot.dockBefore);
      throw e;
    }
  }

  /**
   * Liberar Muelle de Descarga
   */
  async releaseDock(params: { appointmentId: string; dockCode: string; expectedVersion?: number }): Promise<DockOperationResult> {
    const context = this.resolveDockUserContext();

    if (!context.capabilities.has('DOCK_RELEASE')) {
      throw new Error('Su rol no cuenta con la capacidad DOCK_RELEASE.');
    }

    const appt = this.appointmentService.getAppointmentById(params.appointmentId);
    if (!appt) throw new Error(`Cita ${params.appointmentId} no encontrada.`);

    const dockBefore = this.locationService.getDockByCode(params.dockCode);
    const snapshot: DockOperationSnapshot = {
      dockBefore: dockBefore ? { ...dockBefore } : undefined,
      appointmentBefore: { ...appt },
      timestamp: new Date().toISOString(),
    };

    try {
      this.locationService.releaseDock(params.dockCode, params.appointmentId, params.expectedVersion);
      this.appointmentService.updateDockAssignmentStatus(params.appointmentId, 'RELEASED');

      this.appointmentService.logCustomAudit({
        appointmentId: params.appointmentId,
        action: 'DOCK_RELEASED',
        newValues: { dockNumber: params.dockCode, status: 'RELEASED' },
        reason: `Muelle ${params.dockCode} liberado tras desanclaje de unidad`,
        userSnapshot: this._buildAuditUserSnapshot(context),
      });

      return {
        success: true,
        appointmentId: params.appointmentId,
        dockCode: params.dockCode,
        status: 'RELEASED',
        message: `Muelle ${params.dockCode} liberado exitosamente.`,
      };
    } catch (e: any) {
      if (snapshot.dockBefore) this.locationService.restoreDockSnapshot(snapshot.dockBefore);
      throw e;
    }
  }

  /**
   * Expirar Reserva por Timeout (Invocado imperativamente)
   */
  expireReservation(dockCode: string, appointmentId: string): void {
    const context = this.resolveDockUserContext();
    this.locationService.releaseDock(dockCode, appointmentId);
    this.appointmentService.updateDockAssignmentStatus(appointmentId, 'EXPIRED');

    this.appointmentService.logCustomAudit({
      appointmentId,
      action: 'DOCK_RESERVATION_EXPIRED',
      newValues: { dockNumber: dockCode, status: 'EXPIRED' },
      reason: `Reserva de muelle ${dockCode} expirada automáticamente por timeout`,
      userSnapshot: this._buildAuditUserSnapshot(context),
    });
  }

  /**
   * Resetea todos los datos demo de forma 100% reactiva en SPA.
   */
  resetAllDemoData(): void {
    this.locationService.resetToInitialSeed();
    this.appointmentService.resetToSeedData();
  }
}
