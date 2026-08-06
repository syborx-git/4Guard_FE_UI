/**
 * @file reception-creation-preparation.service.ts
 * @description Servicio Fachada de Preparación de Expediente de Recepción [HU-016 Etapa A].
 * Servicio sin persistencia, sin expedientes simulados, sin folios y sin CRUD.
 * Realiza cruce seguro de líneas, derivación de prerrequisitos y verificación estricta.
 */

import { Injectable, inject } from '@angular/core';
import { ReceptionAppointment } from '../models/reception-appointment.models';
import { PurchaseOrder } from '../models/purchase-order.models';
import { AuthState } from '../../../core/auth/auth.state';
import {
  ReceptionCreationViewModel,
  ReceptionCreationLineView,
  InheritedWarningView,
  getOperationalReadiness,
  BranchVerificationResult,
  PriorityInfoView,
  DockInfoView,
  CreateReceptionCommand,
} from '../models/reception-creation.models';
import { DOCK_ASSIGNMENT_STATUS_LABELS, DockAssignmentStatus } from '../models/dock-assignment.models';

@Injectable({ providedIn: 'root' })
export class ReceptionCreationPreparationService {
  private readonly authState = inject(AuthState);

  /**
   * Construye el View Model de preparación cruzando cita y OC de forma segura.
   * Función pura de derivación visual (Sin persistencia local ni mutaciones de estado).
   */
  buildCreationViewModel(
    appointment: ReceptionAppointment,
    po: PurchaseOrder | undefined
  ): ReceptionCreationViewModel {
    // 1. Verificación Estricta de Capacidad (Cero fallbacks de rol)
    const permissions = this.authState.permissions();
    const hasCreatePermission = permissions.includes('RECEIVING_CREATE');

    // 2. Verificación de Sucursal (NOT_VERIFIABLE explícito)
    const user = this.authState.currentUser();
    // AuthenticatedUser no expone branchId en el JWT actual
    const sessionBranchId: string | null = (user as any)?.branchId || null;
    const branchVerification: BranchVerificationResult = {
      status: sessionBranchId ? (sessionBranchId === appointment.branchId ? 'VERIFIED' : 'MISMATCH') : 'NOT_VERIFIABLE',
      sessionBranchId,
      appointmentBranchId: appointment.branchId,
      reason: sessionBranchId
        ? (sessionBranchId === appointment.branchId ? 'Sucursal autenticada coincide con la cita' : 'Sucursal de sesión difiere de la cita')
        : 'El contexto autenticado actual no expone branchId.',
      label: sessionBranchId ? (sessionBranchId === appointment.branchId ? 'Sucursal Verificada' : 'Inconsistencia de Sucursal') : 'Sucursal No Verificable (JWT)',
    };

    // 3. Prioridad Operativa (Decisión real y origen)
    const priorityInfo = this._evaluatePriorityInfo(appointment);

    // 4. Muelle y Reserva (Estados reales de DockAssignmentStatus)
    const dockInfo = this._evaluateDockInfo(appointment);

    // 5. Elegibilidad de la OC (RELEASED o PARTIAL con saldo)
    const isPoEligible = !!po && (po.status === 'RELEASED' || po.status === 'PARTIAL') && po.lines.some((l) => l.pendingQty > 0);
    const poStatusLabel = po ? (po.status === 'RELEASED' ? 'RELEASED (Liberada)' : po.status === 'PARTIAL' ? 'PARTIAL (Parcial)' : `${po.status} (No Elegible)`) : 'NO ENCONTRADA';

    // 6. Readiness Consolidado de Fase 1
    const operationalReadiness = getOperationalReadiness(appointment);

    // 7. Cruce Seguro de Líneas (Prioridades de Matching)
    const lines = this._mapAndMatchLines(appointment, po);

    // 8. Advertencias Heredadas
    const warnings = this._deriveInheritedWarnings(appointment, lines, branchVerification);

    return {
      appointmentId: appointment.id,
      poNumber: appointment.poNumber || po?.poNumber || 'SIN_PO',
      branchId: appointment.branchId,
      branchName: appointment.branchName,
      clientId: appointment.clientId,
      clientName: appointment.clientName,
      supplierId: appointment.supplierId,
      supplierName: appointment.supplierName,
      carrierId: appointment.carrierId,
      carrierName: appointment.carrierName,
      vehiclePlates: appointment.arrivalData?.actualPlates || appointment.expectedPlates,
      driverName: appointment.arrivalData?.actualDriver || appointment.expectedDriver,
      asnReference: appointment.asnReference,
      branchVerification,
      priorityInfo,
      dockInfo,
      isPoEligible,
      poStatusLabel,
      hasCreatePermission,
      operationalReadiness,
      lines,
      warnings,
      isValidatedForCreation: false,
    };
  }

  /**
   * Genera el DTO del Comando Transaccional preliminar para previsualización técnica en Dev/QA panel.
   */
  buildCreationCommandPreview(vm: ReceptionCreationViewModel): CreateReceptionCommand {
    const timeBucket = Math.floor(Date.now() / 300000);
    return {
      appointmentId: vm.appointmentId,
      poNumber: vm.poNumber,
      idempotencyKey: `CMD-${vm.appointmentId}-${timeBucket}`,
      expectedLines: vm.lines
        .filter((l) => l.expectedQty !== null && l.expectedQty > 0)
        .map((l) => ({
          lineId: l.lineId,
          sku: l.sku,
          expectedQty: l.expectedQty as number,
        })),
    };
  }

  /**
   * Evaluador de Prioridad Operativa: Distingue sugerencia vs decisión humana.
   */
  private _evaluatePriorityInfo(appt: ReceptionAppointment): PriorityInfoView {
    if (appt.priorityDecision) {
      const isManual = appt.priorityDecision.source === 'MANUAL';
      return {
        level: appt.priority || 'NORMAL',
        origin: isManual ? 'Confirmada por supervisión de turno' : 'Asignada por motor de priorización (HU-026)',
        isVerifiable: true,
      };
    }

    if (appt.priority) {
      return {
        level: appt.priority,
        origin: 'Prioridad programada en cita',
        isVerifiable: true,
      };
    }

    return {
      level: 'NORMAL',
      origin: 'Prioridad final no verificable',
      isVerifiable: false,
    };
  }

  /**
   * Evaluador de Muelle: Inspecciona estados reales de DockAssignmentStatus.
   */
  private _evaluateDockInfo(appt: ReceptionAppointment): DockInfoView {
    const dockNumber = appt.dockNumber || null;
    const dockStatus = (appt.dockAssignmentStatus || 'UNASSIGNED') as DockAssignmentStatus | 'UNASSIGNED';
    const statusLabel = DOCK_ASSIGNMENT_STATUS_LABELS[dockStatus] || 'Sin Estado';

    if (!dockNumber || dockStatus === 'UNASSIGNED') {
      return {
        dockNumber: null,
        dockStatus: 'UNASSIGNED',
        isValid: false,
        isExpired: false,
        label: 'Sin Muelle Asignado',
        detail: 'La cita no cuenta con muelle de descarga reservado ni asignado.',
      };
    }

    const expiresAt = appt.dockReservationExpiresAt;
    const isExpired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;

    if (dockStatus === 'EXPIRED' || isExpired) {
      return {
        dockNumber,
        dockStatus: 'EXPIRED',
        isValid: false,
        isExpired: true,
        label: `Muelle ${dockNumber} (Reserva Expirada)`,
        detail: `La reserva del muelle ${dockNumber} venció. Se requiere reasignación en HU-030.`,
      };
    }

    if (dockStatus === 'SUGGESTED') {
      return {
        dockNumber,
        dockStatus: 'SUGGESTED',
        isValid: false,
        isExpired: false,
        label: `Muelle ${dockNumber} (Sugerido)`,
        detail: `El muelle ${dockNumber} fue sugerido pero aún no ha sido reservado formalmente.`,
      };
    }

    const validStates: DockAssignmentStatus[] = ['RESERVED', 'ASSIGNED', 'POSITIONING', 'OCCUPIED'];
    const isValid = validStates.includes(dockStatus);

    return {
      dockNumber,
      dockStatus,
      isValid,
      isExpired: false,
      label: `Muelle ${dockNumber} (${statusLabel})`,
      detail: isValid ? `Muelle ${dockNumber} reservado/asignado vigente.` : `Muelle en estado no operativo ('${statusLabel}').`,
    };
  }

  /**
   * Cruce Seguro de Líneas entre la Orden de Compra (OC) y la Cita/ASN.
   * Reglas de Prioridad:
   * 1. poLineId / lineId exacta
   * 2. SKU + Unidad de Medida exacta
   * 3. SKU solo cuando exista ÚNICAMENTE UNA coincidencia en la cita
   * 4. 0 o >1 coincidencias => UNMATCHED o AMBIGUOUS (expectedQty = null)
   */
  private _mapAndMatchLines(
    appointment: ReceptionAppointment,
    po: PurchaseOrder | undefined
  ): ReceptionCreationLineView[] {
    if (!po || !po.lines || po.lines.length === 0) {
      return [];
    }

    const apptLines = appointment.lines || [];

    return po.lines.map((pol) => {
      // Intentar Regla 1: Coincidencia por lineId explícito
      const matchByLineId = apptLines.find((al) => al.lineId && al.lineId === pol.lineId);
      if (matchByLineId) {
        return {
          lineId: pol.lineId,
          sku: pol.sku,
          description: pol.description,
          unit: pol.unit,
          authorizedQty: pol.authorizedQty,
          previouslyReceivedQty: pol.previouslyReceivedQty,
          pendingQty: pol.pendingQty,
          expectedQty: matchByLineId.expectedQty,
          matchingStatus: 'MATCHED',
          matchingNote: 'Coincidencia exacta por ID de línea',
        };
      }

      // Intentar Regla 2: Coincidencia por SKU + Unidad
      const matchesBySkuAndUnit = apptLines.filter(
        (al) => al.sku.trim().toUpperCase() === pol.sku.trim().toUpperCase() && al.unit.trim().toUpperCase() === pol.unit.trim().toUpperCase()
      );

      if (matchesBySkuAndUnit.length === 1) {
        return {
          lineId: pol.lineId,
          sku: pol.sku,
          description: pol.description,
          unit: pol.unit,
          authorizedQty: pol.authorizedQty,
          previouslyReceivedQty: pol.previouslyReceivedQty,
          pendingQty: pol.pendingQty,
          expectedQty: matchesBySkuAndUnit[0].expectedQty,
          matchingStatus: 'MATCHED',
          matchingNote: 'Coincidencia por SKU y unidad de medida',
        };
      }

      if (matchesBySkuAndUnit.length > 1) {
        return {
          lineId: pol.lineId,
          sku: pol.sku,
          description: pol.description,
          unit: pol.unit,
          authorizedQty: pol.authorizedQty,
          previouslyReceivedQty: pol.previouslyReceivedQty,
          pendingQty: pol.pendingQty,
          expectedQty: null, // NULLABLE en ambigüedad
          matchingStatus: 'AMBIGUOUS',
          matchingNote: `Ambiguo: ${matchesBySkuAndUnit.length} líneas en cita coinciden con SKU y unidad`,
        };
      }

      // Intentar Regla 3: Coincidencia solo por SKU
      const matchesBySku = apptLines.filter((al) => al.sku.trim().toUpperCase() === pol.sku.trim().toUpperCase());

      if (matchesBySku.length === 1) {
        return {
          lineId: pol.lineId,
          sku: pol.sku,
          description: pol.description,
          unit: pol.unit,
          authorizedQty: pol.authorizedQty,
          previouslyReceivedQty: pol.previouslyReceivedQty,
          pendingQty: pol.pendingQty,
          expectedQty: matchesBySku[0].expectedQty,
          matchingStatus: 'MATCHED',
          matchingNote: 'Coincidencia por SKU único',
        };
      }

      if (matchesBySku.length > 1) {
        return {
          lineId: pol.lineId,
          sku: pol.sku,
          description: pol.description,
          unit: pol.unit,
          authorizedQty: pol.authorizedQty,
          previouslyReceivedQty: pol.previouslyReceivedQty,
          pendingQty: pol.pendingQty,
          expectedQty: null, // NULLABLE
          matchingStatus: 'AMBIGUOUS',
          matchingNote: `Ambiguo: Múltiples líneas (${matchesBySku.length}) en cita con el mismo SKU`,
        };
      }

      // Regla 4: Sin coincidencia (Línea de OC no anunciada en esta cita)
      return {
        lineId: pol.lineId,
        sku: pol.sku,
        description: pol.description,
        unit: pol.unit,
        authorizedQty: pol.authorizedQty,
        previouslyReceivedQty: pol.previouslyReceivedQty,
        pendingQty: pol.pendingQty,
        expectedQty: null, // SIN FALLBACK A CERO!
        matchingStatus: 'UNMATCHED',
        matchingNote: 'No anunciada en esta cita',
      };
    });
  }

  /**
   * Deriva advertencias operativas heredadas de Fase 1.
   */
  private _deriveInheritedWarnings(
    appointment: ReceptionAppointment,
    lines: ReceptionCreationLineView[],
    branchVerif: BranchVerificationResult
  ): InheritedWarningView[] {
    const warnings: InheritedWarningView[] = [];

    // Advertencia de Branch
    if (branchVerif.status === 'NOT_VERIFIABLE') {
      warnings.push({
        code: 'BRANCH_NOT_VERIFIABLE',
        label: branchVerif.reason,
        severity: 'INFO',
        source: 'CHECKIN',
      });
    }

    // Advertencia de Check-In
    if (appointment.arrivalClearanceStatus === 'WARNING_CLEARED') {
      warnings.push({
        code: 'GATE_WARNING',
        label: 'Vehículo ingresó a patio con advertencia u observación registrada en caseta.',
        severity: 'WARNING',
        source: 'CHECKIN',
      });
    }

    // Advertencia de Validación PO
    if (appointment.poValidationStatus === 'EXCEPTED') {
      warnings.push({
        code: 'PO_EXCEPTED',
        label: 'La Orden de Compra fue aprobada documentalmente por excepción supervisada.',
        severity: 'WARNING',
        source: 'PO_VALIDATION',
      });
    }

    // Advertencias por líneas UNMATCHED o AMBIGUOUS
    const unmatchedCount = lines.filter((l) => l.matchingStatus === 'UNMATCHED').length;
    if (unmatchedCount > 0) {
      warnings.push({
        code: 'LINES_UNMATCHED',
        label: `${unmatchedCount} línea(s) de la OC no están anunciadas para entrega en esta cita.`,
        severity: 'WARNING',
        source: 'PO_VALIDATION',
      });
    }

    const ambiguousCount = lines.filter((l) => l.matchingStatus === 'AMBIGUOUS').length;
    if (ambiguousCount > 0) {
      warnings.push({
        code: 'LINES_AMBIGUOUS',
        label: `${ambiguousCount} línea(s) presentan coincidencia ambigua en la programación de la cita.`,
        severity: 'WARNING',
        source: 'PO_VALIDATION',
      });
    }

    return warnings;
  }
}
