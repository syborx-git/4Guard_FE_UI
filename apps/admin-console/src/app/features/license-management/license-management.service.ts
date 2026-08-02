/**
 * @file license-management.service.ts
 * @description Servicio dummy tipado para HU-139 — Gestión de Licencias del WMS.
 *
 * Simula todas las operaciones CRUD con:
 * - Angular Signals para estado interno reactivo.
 * - RxJS Observable<ServiceResult<T>> para operaciones asíncronas simuladas.
 * - Transacciones atómicas: si falla cualquier paso, no se producen cambios parciales.
 * - Delay mock de 600ms para simular latencia de red.
 *
 * TODO (integración real):
 * - Reemplazar `of(...)` por `this.http.post/put/patch(...)` del HttpClient.
 * - Mantener la misma firma Observable<ServiceResult<T>> para no modificar componentes.
 * - El backend debe implementar RLS y audit_logs de forma nativa.
 */

import { Injectable, signal } from '@angular/core';
import { Observable, of, throwError, delay } from 'rxjs';
import {
  WmsLicense,
  LicenseHistoryEntry,
  LicenseAuditEntry,
  LicenseRenewalPayload,
  LicensePlan,
  ServiceResult,
  DUMMY_LICENSES,
  DUMMY_LICENSE_HISTORY,
  DUMMY_LICENSE_AUDIT,
  computeDerivedStatus,
} from './license-management.models';

@Injectable({
  providedIn: 'root',
})
export class LicenseManagementService {

  // ─── Estado Interno Mutable (Signals) ─────────────────────────────────────
  private readonly _licenses = signal<WmsLicense[]>([
    ...DUMMY_LICENSES.map(l => ({ ...l })),
  ]);
  private readonly _history = signal<LicenseHistoryEntry[]>([
    ...DUMMY_LICENSE_HISTORY.map(h => ({ ...h })),
  ]);
  private readonly _auditLog = signal<LicenseAuditEntry[]>([
    ...DUMMY_LICENSE_AUDIT.map(a => ({ ...a })),
  ]);

  // ─── Señales Públicas (solo lectura) ──────────────────────────────────────
  readonly licenses = this._licenses.asReadonly();
  readonly historyEntries = this._history.asReadonly();
  readonly auditEntries = this._auditLog.asReadonly();

  /** Delay simulado de red en ms. */
  private readonly MOCK_DELAY = 600;

  /** Genera un ID único para nuevas entidades. */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  }

  /** Genera una clave de licencia dummy. La UI siempre mostrará la versión enmascarada. */
  private generateLicenseKey(plan: LicensePlan, orgId: string): string {
    const planCode = plan.substring(0, 3).toUpperCase();
    const year = new Date().getFullYear();
    const suffix = Math.floor(Math.random() * 9_000 + 1_000).toString();
    const orgCode = orgId.split('-').pop()?.toUpperCase() ?? 'XXX';
    return `4GD-${planCode}-${year}-${orgCode}-${suffix}`;
  }

  /** Enmascara la parte central de una clave de licencia. */
  maskLicenseKey(key: string): string {
    const parts = key.split('-');
    if (parts.length < 4) return key.replace(/.(?=.{4})/g, '•');
    return parts
      .map((part, i) => (i > 1 && i < parts.length - 1 ? '••••' : part))
      .join('-');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSULTAS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Retorna todas las licencias. */
  getLicenses(): Observable<ServiceResult<WmsLicense[]>> {
    // TODO: GET /api/licenses
    return of({
      data: this._licenses().map(l => ({ ...l })),
      message: 'Licencias cargadas correctamente.',
      success: true,
    }).pipe(delay(this.MOCK_DELAY));
  }

  /** Retorna una licencia por ID. */
  getLicenseById(id: string): Observable<ServiceResult<WmsLicense>> {
    // TODO: GET /api/licenses/:id
    const found = this._licenses().find(l => l.id === id);
    if (!found) {
      return throwError(() => ({
        success: false,
        message: `Licencia con ID "${id}" no encontrada.`,
      })).pipe(delay(200));
    }
    return of({ data: { ...found }, message: 'Licencia encontrada.', success: true })
      .pipe(delay(200));
  }

  /** Retorna el historial de una licencia específica. */
  getLicenseHistory(licenseId: string): LicenseHistoryEntry[] {
    // TODO: GET /api/licenses/:id/history
    return this._history().filter(h => h.licenseId === licenseId);
  }

  /** Retorna las entradas de auditoría de una licencia específica. */
  getAuditEntries(licenseId: string): LicenseAuditEntry[] {
    // TODO: GET /api/audit-logs?licenseId=:id
    return this._auditLog().filter(a => a.licenseId === licenseId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MUTACIONES — Todas son transacciones atómicas simuladas.
  // Si se produce un error simulado, no se modifica ninguna señal.
  // ═══════════════════════════════════════════════════════════════════════════

  /** Crea una nueva licencia. */
  createLicense(
    payload: Omit<WmsLicense, 'id' | 'createdAt' | 'updatedAt' | 'licenseKey' | 'maskedLicenseKey'>,
    performedBy: string
  ): Observable<ServiceResult<WmsLicense>> {
    // TODO: POST /api/licenses

    const licenseKey = this.generateLicenseKey(payload.plan, payload.organizationId);
    const maskedLicenseKey = this.maskLicenseKey(licenseKey);
    const now = new Date().toISOString();

    const newLicense: WmsLicense = {
      ...payload,
      id: this.generateId('lic'),
      licenseKey,
      maskedLicenseKey,
      createdAt: now,
      updatedAt: now,
      updatedBy: performedBy,
    };

    const historyEntry: LicenseHistoryEntry = {
      id: this.generateId('hist'),
      licenseId: newLicense.id,
      action: 'CREATED',
      description: `Licencia "${newLicense.licenseName}" creada para ${newLicense.organizationName}.`,
      previousValue: null,
      newValue: { plan: newLicense.plan, adminStatus: newLicense.adminStatus },
      performedBy,
      performedAt: now,
    };

    const auditEntry: LicenseAuditEntry = {
      id: this.generateId('aud'),
      organizationId: newLicense.organizationId,
      licenseId: newLicense.id,
      action: 'CREATED',
      previousValue: null,
      newValue: { plan: newLicense.plan, adminStatus: newLicense.adminStatus, maxUsers: newLicense.capacities.maxUsers },
      reason: newLicense.administrativeReason,
      performedBy,
      performedAt: now,
      transactionStatus: 'SUCCESS',
    };

    // Transacción atómica: actualizar las tres señales en un solo bloque
    this._licenses.update(list => [...list, newLicense]);
    this._history.update(list => [historyEntry, ...list]);
    this._auditLog.update(list => [auditEntry, ...list]);

    return of({ data: { ...newLicense }, message: 'Licencia creada exitosamente.', success: true })
      .pipe(delay(this.MOCK_DELAY));
  }

  /** Actualiza datos generales de una licencia existente. */
  updateLicense(
    id: string,
    payload: Partial<WmsLicense>,
    changedFields: Record<string, { previous: unknown; current: unknown }>,
    performedBy: string
  ): Observable<ServiceResult<WmsLicense>> {
    // TODO: PUT /api/licenses/:id

    const idx = this._licenses().findIndex(l => l.id === id);
    if (idx === -1) {
      return throwError(() => ({ success: false, message: 'Licencia no encontrada.' }));
    }

    const original = this._licenses()[idx];
    const now = new Date().toISOString();

    const updated: WmsLicense = {
      ...original,
      ...payload,
      id: original.id,             // Proteger ID
      licenseKey: original.licenseKey,  // Proteger clave
      maskedLicenseKey: original.maskedLicenseKey,
      organizationId: original.organizationId, // No cambiar org sin proceso
      createdAt: original.createdAt,
      updatedAt: now,
      updatedBy: performedBy,
    };

    const hasCapacityChange = Object.keys(changedFields).some(k =>
      ['maxUsers', 'maxConcurrentUsers', 'maxWarehouses', 'maxHandheldDevices', 'maxIntegrations'].includes(k)
    );
    const hasModuleChange = 'enabledModules' in changedFields;
    const action = hasCapacityChange
      ? 'CAPACITY_CHANGED'
      : hasModuleChange
        ? 'MODULES_CHANGED'
        : 'UPDATED';

    const historyEntry: LicenseHistoryEntry = {
      id: this.generateId('hist'),
      licenseId: id,
      action,
      description: `Licencia actualizada. Campos modificados: ${Object.keys(changedFields).join(', ')}.`,
      previousValue: Object.fromEntries(Object.entries(changedFields).map(([k, v]) => [k, v.previous])),
      newValue: Object.fromEntries(Object.entries(changedFields).map(([k, v]) => [k, v.current])),
      performedBy,
      performedAt: now,
    };

    const auditEntry: LicenseAuditEntry = {
      id: this.generateId('aud'),
      organizationId: original.organizationId,
      licenseId: id,
      action,
      previousValue: Object.fromEntries(Object.entries(changedFields).map(([k, v]) => [k, v.previous])),
      newValue: Object.fromEntries(Object.entries(changedFields).map(([k, v]) => [k, v.current])),
      reason: payload.administrativeReason ?? original.administrativeReason,
      performedBy,
      performedAt: now,
      transactionStatus: 'SUCCESS',
    };

    // Transacción atómica
    this._licenses.update(list => list.map(l => l.id === id ? updated : l));
    this._history.update(list => [historyEntry, ...list]);
    this._auditLog.update(list => [auditEntry, ...list]);

    return of({ data: { ...updated }, message: 'Licencia actualizada correctamente.', success: true })
      .pipe(delay(this.MOCK_DELAY));
  }

  /** Renueva la vigencia de una licencia. */
  renewLicense(
    id: string,
    payload: LicenseRenewalPayload,
    performedBy: string
  ): Observable<ServiceResult<WmsLicense>> {
    // TODO: POST /api/licenses/:id/renew

    const idx = this._licenses().findIndex(l => l.id === id);
    if (idx === -1) {
      return throwError(() => ({ success: false, message: 'Licencia no encontrada.' }));
    }

    const original = this._licenses()[idx];
    const now = new Date().toISOString();

    const renewed: WmsLicense = {
      ...original,
      ...(payload.newPlan ? { plan: payload.newPlan } : {}),
      ...(payload.newCapacities ? { capacities: { ...original.capacities, ...payload.newCapacities } } : {}),
      validUntil: payload.newValidUntil,
      adminStatus: 'ACTIVE',
      administrativeReason: payload.reason,
      updatedAt: now,
      updatedBy: performedBy,
    };

    const historyEntry: LicenseHistoryEntry = {
      id: this.generateId('hist'),
      licenseId: id,
      action: 'RENEWED',
      description: `Licencia renovada. Nueva vigencia hasta ${new Date(payload.newValidUntil).toLocaleDateString('es-MX')}.`,
      previousValue: { validUntil: original.validUntil, plan: original.plan },
      newValue: { validUntil: payload.newValidUntil, plan: renewed.plan },
      performedBy,
      performedAt: now,
    };

    const auditEntry: LicenseAuditEntry = {
      id: this.generateId('aud'),
      organizationId: original.organizationId,
      licenseId: id,
      action: 'RENEWED',
      previousValue: { validUntil: original.validUntil, plan: original.plan, adminStatus: original.adminStatus },
      newValue: { validUntil: payload.newValidUntil, plan: renewed.plan, adminStatus: 'ACTIVE' },
      reason: payload.reason,
      performedBy,
      performedAt: now,
      transactionStatus: 'SUCCESS',
    };

    this._licenses.update(list => list.map(l => l.id === id ? renewed : l));
    this._history.update(list => [historyEntry, ...list]);
    this._auditLog.update(list => [auditEntry, ...list]);

    return of({ data: { ...renewed }, message: 'Licencia renovada exitosamente.', success: true })
      .pipe(delay(this.MOCK_DELAY));
  }

  /** Suspende una licencia activa. */
  suspendLicense(
    id: string,
    reason: string,
    performedBy: string
  ): Observable<ServiceResult<WmsLicense>> {
    // TODO: POST /api/licenses/:id/suspend
    return this._changeAdminStatus(id, 'SUSPENDED', 'SUSPENDED', reason, performedBy,
      'Licencia suspendida. Las nuevas operaciones pueden ser restringidas. Los datos históricos se conservan.');
  }

  /** Reactiva una licencia suspendida. */
  reactivateLicense(
    id: string,
    reason: string,
    performedBy: string
  ): Observable<ServiceResult<WmsLicense>> {
    // TODO: POST /api/licenses/:id/reactivate
    return this._changeAdminStatus(id, 'ACTIVE', 'REACTIVATED', reason, performedBy,
      'Licencia reactivada. Las operaciones se restituyen conforme a la vigencia contractual.');
  }

  /** Revoca una licencia de forma permanente en esta interfaz.
   * NOTA: La recuperación de una licencia revocada requiere un proceso administrativo externo.
   */
  revokeLicense(
    id: string,
    reason: string,
    performedBy: string
  ): Observable<ServiceResult<WmsLicense>> {
    // TODO: POST /api/licenses/:id/revoke
    return this._changeAdminStatus(id, 'REVOKED', 'REVOKED', reason, performedBy,
      'Licencia revocada. La interfaz pasa a modo solo lectura. Cualquier recuperación requiere proceso administrativo externo.');
  }

  /** Regenera la clave de licencia. La clave anterior queda registrada en auditoría (enmascarada). */
  regenerateLicenseKey(
    id: string,
    reason: string,
    performedBy: string
  ): Observable<ServiceResult<WmsLicense>> {
    // TODO: POST /api/licenses/:id/regenerate-key

    const idx = this._licenses().findIndex(l => l.id === id);
    if (idx === -1) {
      return throwError(() => ({ success: false, message: 'Licencia no encontrada.' }));
    }

    const original = this._licenses()[idx];
    const now = new Date().toISOString();

    const newKey = this.generateLicenseKey(original.plan, original.organizationId);
    const newMaskedKey = this.maskLicenseKey(newKey);

    const updated: WmsLicense = {
      ...original,
      licenseKey: newKey,
      maskedLicenseKey: newMaskedKey,
      administrativeReason: reason,
      updatedAt: now,
      updatedBy: performedBy,
    };

    const historyEntry: LicenseHistoryEntry = {
      id: this.generateId('hist'),
      licenseId: id,
      action: 'KEY_REGENERATED',
      description: `Clave de licencia regenerada. Clave anterior registrada en auditoría (enmascarada).`,
      previousValue: { maskedKey: original.maskedLicenseKey },
      newValue: { maskedKey: newMaskedKey },
      performedBy,
      performedAt: now,
    };

    const auditEntry: LicenseAuditEntry = {
      id: this.generateId('aud'),
      organizationId: original.organizationId,
      licenseId: id,
      action: 'KEY_REGENERATED',
      previousValue: { maskedKey: original.maskedLicenseKey }, // Nunca exponer clave completa
      newValue: { maskedKey: newMaskedKey },
      reason,
      performedBy,
      performedAt: now,
      transactionStatus: 'SUCCESS',
    };

    this._licenses.update(list => list.map(l => l.id === id ? updated : l));
    this._history.update(list => [historyEntry, ...list]);
    this._auditLog.update(list => [auditEntry, ...list]);

    return of({ data: { ...updated }, message: 'Clave de licencia regenerada exitosamente.', success: true })
      .pipe(delay(this.MOCK_DELAY));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MÉTODO PRIVADO COMPARTIDO — Cambio de estado administrativo
  // ═══════════════════════════════════════════════════════════════════════════

  private _changeAdminStatus(
    id: string,
    newAdminStatus: WmsLicense['adminStatus'],
    historyAction: LicenseHistoryEntry['action'],
    reason: string,
    performedBy: string,
    description: string
  ): Observable<ServiceResult<WmsLicense>> {
    const idx = this._licenses().findIndex(l => l.id === id);
    if (idx === -1) {
      return throwError(() => ({ success: false, message: 'Licencia no encontrada.' }));
    }

    const original = this._licenses()[idx];
    const now = new Date().toISOString();

    const updated: WmsLicense = {
      ...original,
      adminStatus: newAdminStatus,
      administrativeReason: reason,
      updatedAt: now,
      updatedBy: performedBy,
    };

    const historyEntry: LicenseHistoryEntry = {
      id: this.generateId('hist'),
      licenseId: id,
      action: historyAction,
      description,
      previousValue: { adminStatus: original.adminStatus },
      newValue: { adminStatus: newAdminStatus },
      performedBy,
      performedAt: now,
    };

    const auditEntry: LicenseAuditEntry = {
      id: this.generateId('aud'),
      organizationId: original.organizationId,
      licenseId: id,
      action: historyAction,
      previousValue: { adminStatus: original.adminStatus },
      newValue: { adminStatus: newAdminStatus },
      reason,
      performedBy,
      performedAt: now,
      transactionStatus: 'SUCCESS',
    };

    // Transacción atómica
    this._licenses.update(list => list.map(l => l.id === id ? updated : l));
    this._history.update(list => [historyEntry, ...list]);
    this._auditLog.update(list => [auditEntry, ...list]);

    const actionLabel = historyAction.charAt(0) + historyAction.slice(1).toLowerCase();
    return of({ data: { ...updated }, message: `Licencia ${actionLabel} correctamente.`, success: true })
      .pipe(delay(this.MOCK_DELAY));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════════════════════════════════════════

  /** Calcula el estado derivado de una licencia. Delegado al modelo. */
  getDerivedStatus = computeDerivedStatus;
}
