/**
 * @file purchase-order-validation.service.ts
 * @description Servicio de Validación Documental Cita vs Orden de Compra (PO) [HU-029].
 * Motor algorítmico de comparación, fingerprinting, re-invalidación, tolerancias y RBAC de dominio.
 */

import { Injectable, signal, inject } from '@angular/core';
import { ReceptionAppointment } from '../models/reception-appointment.models';
import { AuthState } from '../../../core/auth/auth.state';
import {
  PurchaseOrder,
  POValidationResult,
  POValidationStatus,
  POComparisonOutcome,
  PODiscrepancyType,
  LineComparisonResult,
  POAuditEntry,
  POAuditAction,
  CRITICAL_BLOCKED_DISCREPANCIES,
  INITIAL_PURCHASE_ORDERS_SEED,
} from '../models/purchase-order.models';

export interface UserContext {
  performedBy: string;
  userRole: string;
}

@Injectable({ providedIn: 'root' })
export class PurchaseOrderValidationService {
  private readonly authState = inject(AuthState);

  private readonly STORAGE_KEY = '4guard_po_validations_v1';
  private readonly AUDIT_KEY   = '4guard_po_audit_v1';

  // Configuración Extensible de Negocio (Tolerancia en Cantidades)
  private readonly validationConfig = {
    quantityTolerancePercent: 0, // 0 = Comparación exacta (comportamiento estricto)
  };

  // Matriz Centralizada de Permisos (RBAC)
  private readonly ALLOWED_ROLES = {
    CONFIRM: ['ADMIN', 'MANAGER', 'OPERATIONS_MANAGER', 'OPERATIONS_SUPERVISOR', 'WAREHOUSE_OPERATOR', 'MANEUVER_OPERATOR', 'SUPERVISOR', 'OPERATOR'],
    EXCEPTION: ['ADMIN', 'MANAGER', 'OPERATIONS_MANAGER', 'OPERATIONS_SUPERVISOR', 'SUPERVISOR'],
    REJECT: ['ADMIN', 'MANAGER', 'OPERATIONS_MANAGER', 'OPERATIONS_SUPERVISOR', 'SUPERVISOR'],
    NOT_REQUIRED: ['ADMIN', 'MANAGER', 'OPERATIONS_MANAGER'],
  };

  // Signals de estado
  private readonly _purchaseOrders = signal<PurchaseOrder[]>(INITIAL_PURCHASE_ORDERS_SEED);
  private readonly _validationsMap = signal<Record<string, POValidationResult>>({});
  private readonly _poAuditLog     = signal<POAuditEntry[]>([]);

  readonly purchaseOrders = this._purchaseOrders.asReadonly();
  readonly validationsMap = this._validationsMap.asReadonly();
  readonly poAuditLog     = this._poAuditLog.asReadonly();

  constructor() {
    this._rehydrateValidations();
    this._rehydrateAudit();
  }

  private _rehydrateValidations(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          this._validationsMap.set(parsed);
        }
      }
    } catch (e) {
      console.warn('Error al rehidratar validaciones de PO desde localStorage.', e);
    }
  }

  private _rehydrateAudit(): void {
    try {
      const stored = localStorage.getItem(this.AUDIT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this._poAuditLog.set(parsed);
        }
      }
    } catch (e) {
      console.warn('Error al rehidratar auditoría de PO desde localStorage.', e);
    }
  }

  private _saveValidationsStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._validationsMap()));
    } catch (e) {
      console.error('Error al guardar validaciones de PO en localStorage', e);
    }
  }

  private _saveAuditStorage(): void {
    try {
      localStorage.setItem(this.AUDIT_KEY, JSON.stringify(this._poAuditLog()));
    } catch (e) {
      console.error('Error al guardar auditoría de PO en localStorage', e);
    }
  }

  /**
   * Obtiene el contexto actual del usuario desde AuthState o parámetros provistos.
   */
  private _getUserContext(overrideContext?: Partial<UserContext>): UserContext {
    const sessionUser = this.authState.currentUser();
    const sessionRole = this.authState.role() || 'OPERATIONS_MANAGER';

    return {
      performedBy: overrideContext?.performedBy || sessionUser?.fullName || sessionUser?.username || 'OPERATIONS_MANAGER',
      userRole: (overrideContext?.userRole || sessionRole).toUpperCase(),
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
   * Obtiene una Orden de Compra por número de referencia.
   */
  getPOByNumber(poNumber: string): PurchaseOrder | undefined {
    return this._purchaseOrders().find(
      (po) => po.poNumber.trim().toUpperCase() === poNumber.trim().toUpperCase()
    );
  }

  /**
   * Calcula la huella digital (sourceFingerprint) de los datos fuente comparados.
   */
  computeSourceFingerprint(appointment: ReceptionAppointment, po?: PurchaseOrder): string {
    const apptLinesStr = (appointment.lines || [])
      .map((l) => `${l.sku}:${l.expectedQty}:${l.unit}`)
      .sort()
      .join('|');

    const poLinesStr = po
      ? po.lines.map((l) => `${l.sku}:${l.pendingQty}:${l.unit}`).sort().join('|')
      : 'NO_PO';

    const str = [
      appointment.id,
      appointment.asnReference,
      appointment.branchId,
      appointment.clientId,
      appointment.supplierId,
      appointment.poNumber || 'NONE',
      apptLinesStr,
      poLinesStr,
      po?.status || 'NONE',
    ].join('##');

    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return `FP-${Math.abs(hash).toString(16)}-${str.length}`;
  }

  /**
   * Ejecuta el motor algorítmico de comparación entre la Cita y la OC.
   * Aplica tolerancias de cantidad y fingerprinting con re-invalidación trazable.
   */
  validateAppointmentAgainstPO(appointment: ReceptionAppointment, poNumberOverride?: string): POValidationResult {
    const poNum = poNumberOverride || appointment.poNumber || `PO-2026-8801`;
    const po = this.getPOByNumber(poNum);
    const fingerprint = this.computeSourceFingerprint(appointment, po);

    const existing = this._validationsMap()[appointment.id];

    // 1. Inconsistencias en Cabecera
    const headerDiscrepancies: PODiscrepancyType[] = [];

    if (!po) {
      headerDiscrepancies.push('PO_NOT_FOUND');
    } else {
      if (po.status === 'CANCELLED') headerDiscrepancies.push('PO_CANCELLED');
      if (po.status === 'EXPIRED') headerDiscrepancies.push('PO_EXPIRED');
      if (po.branchId !== appointment.branchId) headerDiscrepancies.push('BRANCH_MISMATCH');
      if (po.clientId !== appointment.clientId) headerDiscrepancies.push('CLIENT_MISMATCH');
      if (po.supplierId !== appointment.supplierId) headerDiscrepancies.push('SUPPLIER_MISMATCH');
      if (po.asnReference && po.asnReference.trim().toUpperCase() !== appointment.asnReference.trim().toUpperCase()) {
        headerDiscrepancies.push('ASN_MISMATCH');
      }
    }

    // 2. Inconsistencias en Líneas (con tolerancias configurables)
    const lineResults: LineComparisonResult[] = [];
    const lineDiscrepancies: PODiscrepancyType[] = [];

    const apptLines = appointment.lines || [];
    const poLines = po ? po.lines : [];

    const poLinesBySku = new Map<string, typeof poLines[0]>();
    poLines.forEach((l) => poLinesBySku.set(l.sku.trim().toUpperCase(), l));

    const apptLinesBySku = new Map<string, typeof apptLines[0]>();
    apptLines.forEach((l) => apptLinesBySku.set(l.sku.trim().toUpperCase(), l));

    const tolerancePct = this.validationConfig.quantityTolerancePercent || 0;

    apptLines.forEach((appLine) => {
      const skuKey = appLine.sku.trim().toUpperCase();
      const poLine = poLinesBySku.get(skuKey);

      const discList: PODiscrepancyType[] = [];
      let status: LineComparisonResult['status'] = 'MATCH';

      if (!poLine) {
        status = 'EXTRA_IN_APPOINTMENT';
        discList.push('SKU_NOT_IN_PO');
        if (!lineDiscrepancies.includes('SKU_NOT_IN_PO')) lineDiscrepancies.push('SKU_NOT_IN_PO');
      } else {
        if (poLine.unit.trim().toLowerCase() !== appLine.unit.trim().toLowerCase()) {
          discList.push('UNIT_MISMATCH');
          if (!lineDiscrepancies.includes('UNIT_MISMATCH')) lineDiscrepancies.push('UNIT_MISMATCH');
        }

        // Aplicar tolerancia configurable sobre la cantidad pendiente
        const allowedVariance = (poLine.pendingQty * tolerancePct) / 100;
        const minAllowed = poLine.pendingQty - allowedVariance;
        const maxAllowed = poLine.pendingQty + allowedVariance;

        if (appLine.expectedQty > maxAllowed) {
          discList.push('QTY_OVER_PO');
          if (!lineDiscrepancies.includes('QTY_OVER_PO')) lineDiscrepancies.push('QTY_OVER_PO');
        } else if (appLine.expectedQty < minAllowed) {
          discList.push('QTY_UNDER_PO');
          if (!lineDiscrepancies.includes('QTY_UNDER_PO')) lineDiscrepancies.push('QTY_UNDER_PO');
        }

        if (discList.length > 0) status = 'DISCREPANCY';
      }

      lineResults.push({
        lineId: appLine.lineId,
        sku: appLine.sku,
        description: appLine.description,
        pendingPOQty: poLine ? poLine.pendingQty : 0,
        appointmentQty: appLine.expectedQty,
        unitPO: poLine ? poLine.unit : 'N/A',
        unitAppointment: appLine.unit,
        status,
        discrepancies: discList,
      });
    });

    poLines.forEach((poLine) => {
      const skuKey = poLine.sku.trim().toUpperCase();
      if (!apptLinesBySku.has(skuKey) && poLine.pendingQty > 0) {
        if (!lineDiscrepancies.includes('SKU_MISSING_IN_APPOINTMENT')) {
          lineDiscrepancies.push('SKU_MISSING_IN_APPOINTMENT');
        }

        lineResults.push({
          lineId: poLine.lineId,
          sku: poLine.sku,
          description: poLine.description,
          pendingPOQty: poLine.pendingQty,
          appointmentQty: 0,
          unitPO: poLine.unit,
          unitAppointment: poLine.unit,
          status: 'MISSING_IN_APPOINTMENT',
          discrepancies: ['SKU_MISSING_IN_APPOINTMENT'],
          notes: 'SKU autorizado en la OC omitido en la cita.',
        });
      }
    });

    // 3. Resultado Técnico Calculado (`POComparisonOutcome`)
    const allDiscrepancies = Array.from(new Set([...headerDiscrepancies, ...lineDiscrepancies]));
    const hasCriticalBlocked = allDiscrepancies.some((d) => CRITICAL_BLOCKED_DISCREPANCIES.includes(d));

    let calculatedOutcome: POComparisonOutcome = 'MATCH';
    if (hasCriticalBlocked) {
      calculatedOutcome = 'BLOCKED';
    } else if (allDiscrepancies.length > 0) {
      calculatedOutcome = 'WITH_DIFFERENCES';
    }

    // 4. Porcentaje de Coincidencia Documental
    const matchCount = lineResults.filter((l) => l.status === 'MATCH').length;
    const totalLines = lineResults.length;
    const overallMatchPercent = totalLines > 0 ? Math.round((matchCount / totalLines) * 100) : 0;

    // 5. Decisión Operativa Guardada (`POValidationStatus`) y Re-invalidación Trazable
    let savedStatus: POValidationStatus = appointment.poValidationStatus || 'PENDING';

    if (existing) {
      if (existing.sourceFingerprint !== fingerprint) {
        if (existing.validationStatus === 'VALIDATED' || existing.validationStatus === 'EXCEPTED') {
          savedStatus = 'PENDING';
          const ctx = this._getUserContext();
          this._logAudit({
            appointmentId: appointment.id,
            poNumber: poNum,
            action: 'VALIDATION_INVALIDATED',
            performedBy: ctx.performedBy,
            userRole: ctx.userRole,
            previousStatus: existing.validationStatus,
            newStatus: 'PENDING',
            calculatedOutcome,
            overallMatchPercent,
            discrepancies: allDiscrepancies,
            reason: 'Se detectaron cambios en los datos fuente de la cita o de la OC posterior a la última decisión.',
            sourceFingerprint: fingerprint,
          });
        }
      } else {
        savedStatus = existing.validationStatus;
      }
    }

    const validationResult: POValidationResult = {
      appointmentId: appointment.id,
      poNumber: poNum,
      calculatedOutcome,
      validationStatus: savedStatus,
      validatedAt: existing?.validatedAt,
      validatedBy: existing?.validatedBy,
      userRole: existing?.userRole,
      totalLines,
      matchLines: matchCount,
      discrepancyLines: totalLines - matchCount,
      overallMatchPercent,
      discrepancies: allDiscrepancies,
      lineResults,
      supervisorException: existing?.supervisorException,
      rejectionReason: existing?.rejectionReason,
      notRequiredReason: existing?.notRequiredReason,
      sourceFingerprint: fingerprint,
    };

    this._validationsMap.update((map) => ({ ...map, [appointment.id]: validationResult }));
    this._saveValidationsStorage();

    return validationResult;
  }

  /**
   * Confirmación limpia de validación documental.
   * Regla de Blindaje: Solo permite pasar a VALIDATED cuando calculatedOutcome === 'MATCH'.
   */
  confirmValidation(appointmentId: string, poNumber: string, userContext?: Partial<UserContext>): void {
    const ctx = this._getUserContext(userContext);
    this._assertRoleAllowed(ctx.userRole, this.ALLOWED_ROLES.CONFIRM, 'Confirmar Validación Documental');

    const current = this._validationsMap()[appointmentId];
    if (!current) {
      throw new Error('No existe una comparación calculada previa para esta cita.');
    }

    if (current.calculatedOutcome === 'BLOCKED') {
      throw new Error(
        'La validación contiene discrepancias críticas bloqueantes (ej. Sucursal, Cliente, Proveedor o Estado OC) y NO puede confirmarse.'
      );
    }

    if (current.calculatedOutcome === 'WITH_DIFFERENCES') {
      throw new Error(
        'La validación contiene diferencias de mercancía o ASN. Debe utilizarse el flujo de Autorización de Excepción.'
      );
    }

    const updated: POValidationResult = {
      ...current,
      validationStatus: 'VALIDATED',
      validatedAt: new Date().toISOString(),
      validatedBy: ctx.performedBy,
      userRole: ctx.userRole,
    };

    this._validationsMap.update((map) => ({ ...map, [appointmentId]: updated }));
    this._saveValidationsStorage();

    this._logAudit({
      appointmentId,
      poNumber,
      action: 'VALIDATION_CONFIRMED',
      performedBy: ctx.performedBy,
      userRole: ctx.userRole,
      previousStatus: current.validationStatus,
      newStatus: 'VALIDATED',
      calculatedOutcome: current.calculatedOutcome,
      overallMatchPercent: current.overallMatchPercent,
      discrepancies: current.discrepancies,
      reason: 'Confirmación documental limpia de Orden de Compra (100% Match)',
      sourceFingerprint: current.sourceFingerprint,
    });
  }

  /**
   * Autorización de excepción por Supervisor/Manager.
   * Regla de Blindaje: Solo permite autorizar cuando calculatedOutcome === 'WITH_DIFFERENCES'.
   */
  authorizeException(
    appointmentId: string,
    poNumber: string,
    reason: string,
    userContext?: Partial<UserContext>
  ): void {
    const ctx = this._getUserContext(userContext);
    this._assertRoleAllowed(ctx.userRole, this.ALLOWED_ROLES.EXCEPTION, 'Autorizar Excepción Documental');

    const current = this._validationsMap()[appointmentId];
    if (!current) {
      throw new Error('No existe un resultado de comparación calculado previo.');
    }

    if (current.calculatedOutcome === 'MATCH') {
      throw new Error('La validación no contiene diferencias. Debe utilizar la confirmación limpia de validación.');
    }

    if (current.calculatedOutcome === 'BLOCKED') {
      throw new Error(
        'No es posible autorizar excepción sobre una validación con discrepancias críticas bloqueantes (Sucursal, Cliente, Proveedor u OC Cancelada).'
      );
    }

    if (!reason || reason.trim().length < 10) {
      throw new Error('El motivo de la autorización de excepción es obligatorio y debe tener al menos 10 caracteres.');
    }

    const updated: POValidationResult = {
      ...current,
      validationStatus: 'EXCEPTED',
      validatedAt: new Date().toISOString(),
      validatedBy: ctx.performedBy,
      userRole: ctx.userRole,
      supervisorException: {
        authorizedBy: ctx.performedBy,
        authorizedAt: new Date().toISOString(),
        reason: reason.trim(),
      },
    };

    this._validationsMap.update((map) => ({ ...map, [appointmentId]: updated }));
    this._saveValidationsStorage();

    this._logAudit({
      appointmentId,
      poNumber,
      action: 'EXCEPTION_AUTHORIZED',
      performedBy: ctx.performedBy,
      userRole: ctx.userRole,
      previousStatus: current.validationStatus,
      newStatus: 'EXCEPTED',
      calculatedOutcome: current.calculatedOutcome,
      overallMatchPercent: current.overallMatchPercent,
      discrepancies: current.discrepancies,
      reason: reason.trim(),
      sourceFingerprint: current.sourceFingerprint,
    });
  }

  /**
   * Rechazo de la validación documental por el usuario.
   * Regla de Blindaje: Motivo obligatorio de al menos 10 caracteres y validación de rol.
   */
  rejectValidation(
    appointmentId: string,
    poNumber: string,
    reason: string,
    userContext?: Partial<UserContext>
  ): void {
    const ctx = this._getUserContext(userContext);
    this._assertRoleAllowed(ctx.userRole, this.ALLOWED_ROLES.REJECT, 'Rechazar Validación Documental');

    const current = this._validationsMap()[appointmentId];
    if (!current) {
      throw new Error('No existe una comparación calculada previa para esta cita.');
    }

    if (!reason || reason.trim().length < 10) {
      throw new Error('El motivo de rechazo es obligatorio y debe tener al menos 10 caracteres.');
    }

    const updated: POValidationResult = {
      ...current,
      validationStatus: 'REJECTED',
      validatedAt: new Date().toISOString(),
      validatedBy: ctx.performedBy,
      userRole: ctx.userRole,
      rejectionReason: reason.trim(),
    };

    this._validationsMap.update((map) => ({ ...map, [appointmentId]: updated }));
    this._saveValidationsStorage();

    this._logAudit({
      appointmentId,
      poNumber,
      action: 'VALIDATION_REJECTED',
      performedBy: ctx.performedBy,
      userRole: ctx.userRole,
      previousStatus: current.validationStatus,
      newStatus: 'REJECTED',
      calculatedOutcome: current.calculatedOutcome,
      overallMatchPercent: current.overallMatchPercent,
      discrepancies: current.discrepancies,
      reason: reason.trim(),
      sourceFingerprint: current.sourceFingerprint,
    });
  }

  /**
   * Marca la recepción como Exenta de OC (NOT_REQUIRED).
   * Regla de Blindaje: Preserva la trazabilidad previa, exige motivo >= 10 caracteres y rol de Manager.
   */
  markNotRequired(
    appointmentId: string,
    reason: string,
    userContext?: Partial<UserContext>
  ): void {
    const ctx = this._getUserContext(userContext);
    this._assertRoleAllowed(ctx.userRole, this.ALLOWED_ROLES.NOT_REQUIRED, 'Marcar Recepción como Exenta de OC');

    if (!reason || reason.trim().length < 10) {
      throw new Error('El motivo de exención de Orden de Compra es obligatorio y debe tener al menos 10 caracteres.');
    }

    const current = this._validationsMap()[appointmentId];

    const updated: POValidationResult = {
      appointmentId,
      poNumber: current?.poNumber || 'N/A',
      calculatedOutcome: current?.calculatedOutcome || 'MATCH',
      validationStatus: 'NOT_REQUIRED',
      validatedAt: new Date().toISOString(),
      validatedBy: ctx.performedBy,
      userRole: ctx.userRole,
      totalLines: current?.totalLines || 0,
      matchLines: current?.matchLines || 0,
      discrepancyLines: current?.discrepancyLines || 0,
      overallMatchPercent: current?.overallMatchPercent || 100,
      discrepancies: current?.discrepancies || [],
      lineResults: current?.lineResults || [],
      notRequiredReason: reason.trim(),
      sourceFingerprint: current?.sourceFingerprint || `NR-${appointmentId}`,
    };

    this._validationsMap.update((map) => ({ ...map, [appointmentId]: updated }));
    this._saveValidationsStorage();

    this._logAudit({
      appointmentId,
      poNumber: updated.poNumber,
      action: 'MARKED_NOT_REQUIRED',
      performedBy: ctx.performedBy,
      userRole: ctx.userRole,
      previousStatus: current?.validationStatus || 'PENDING',
      newStatus: 'NOT_REQUIRED',
      calculatedOutcome: updated.calculatedOutcome,
      overallMatchPercent: updated.overallMatchPercent,
      discrepancies: updated.discrepancies,
      reason: reason.trim(),
      sourceFingerprint: updated.sourceFingerprint,
    });
  }

  private _logAudit(entry: Omit<POAuditEntry, 'id' | 'performedAt'>): void {
    const newEntry: POAuditEntry = {
      ...entry,
      id: `POAUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      performedAt: new Date().toISOString(),
    };

    this._poAuditLog.update((logs) => [newEntry, ...logs]);
    this._saveAuditStorage();
  }
}
