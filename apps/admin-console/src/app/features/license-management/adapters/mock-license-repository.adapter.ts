/**
 * @file mock-license-repository.adapter.ts
 * @description Adaptador Mock determinista para ILicenseRepository.
 * Úsalo para pruebas aisladas y modo desarrollo offline (SDOP).
 */

import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ILicenseRepository } from '../license.repository';
import {
  WmsLicense,
  LicenseRenewalPayload,
  ServiceResult,
} from '../license-management.models';

const INITIAL_MOCK_LICENSES: WmsLicense[] = [
  {
    id: 'lic-001',
    organizationId: 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
    organizationName: '4GUARD LOGISTICS CORP',
    licenseName: 'Licencia Master Enterprise Monterrey',
    licenseKey: '4GD-ENT-2026-X9Y2-MTR1',
    maskedLicenseKey: '4GD-ENT-••••-••••-MTR1',
    plan: 'ENTERPRISE',
    description: 'Licencia de operación principal para hub logístico Monterrey',
    validFrom: '2026-01-01T00:00:00.000Z',
    validUntil: '2026-12-31T23:59:59.000Z',
    gracePeriodDays: 15,
    autoRenewal: true,
    adminStatus: 'ACTIVE',
    maxUsers: 50,
    maxConcurrentUsers: 25,
    maxWarehouses: 5,
    maxHandheldDevices: 30,
    maxIntegrations: 10,
    currentUsers: 18,
    concurrentUsersPeak: 12,
    currentWarehouses: 2,
    registeredHandheldDevices: 14,
    activeIntegrations: 4,
    enabledModules: ['INVENTORY', 'RECEIVING', 'SHIPPING', 'QUALITY', 'CONTROL_TOWER'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    id: 'lic-002',
    organizationId: 'b21f0907-8fa5-4bdf-87db-2eb5e7683999',
    organizationName: 'DISTRIBUIDORA DEL NORTE SA',
    licenseName: 'Licencia Operativa Pro Saltillo',
    licenseKey: '4GD-PRO-2026-A1B2-SLT1',
    maskedLicenseKey: '4GD-PRO-••••-••••-SLT1',
    plan: 'PROFESSIONAL',
    description: 'Licencia para sucursal Saltillo',
    validFrom: '2026-02-01T00:00:00.000Z',
    validUntil: '2026-08-01T23:59:59.000Z',
    gracePeriodDays: 10,
    autoRenewal: false,
    adminStatus: 'ACTIVE',
    maxUsers: 20,
    maxConcurrentUsers: 10,
    maxWarehouses: 2,
    maxHandheldDevices: 10,
    maxIntegrations: 3,
    currentUsers: 8,
    concurrentUsersPeak: 6,
    currentWarehouses: 1,
    registeredHandheldDevices: 5,
    activeIntegrations: 1,
    enabledModules: ['INVENTORY', 'RECEIVING', 'SHIPPING'],
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    updatedBy: 'system',
  },
];

@Injectable({
  providedIn: 'root',
})
export class MockLicenseRepositoryAdapter implements ILicenseRepository {
  private readonly _licenses = signal<WmsLicense[]>(INITIAL_MOCK_LICENSES);

  getLicenses(): Observable<ServiceResult<WmsLicense[]>> {
    return of({
      data: this._licenses(),
      message: 'Licencias mock cargadas exitosamente (SDOP Adapter).',
      success: true,
    }).pipe(delay(100));
  }

  getLicenseById(id: string): Observable<ServiceResult<WmsLicense>> {
    const lic = this._licenses().find((l) => l.id === id);
    if (!lic) {
      return of({
        data: undefined as unknown as WmsLicense,
        message: `Licencia mock ${id} no encontrada.`,
        success: false,
      });
    }
    return of({
      data: lic,
      message: 'Licencia mock recuperada.',
      success: true,
    }).pipe(delay(50));
  }

  createLicense(
    payload: Omit<WmsLicense, 'id' | 'createdAt' | 'updatedAt' | 'licenseKey' | 'maskedLicenseKey'>,
    performedBy: string
  ): Observable<ServiceResult<WmsLicense>> {
    const nowIso = new Date().toISOString();
    const newLic: WmsLicense = {
      ...payload,
      id: `lic-mock-${Date.now()}`,
      licenseKey: '4GD-MOCK-XXXX-YYYY',
      maskedLicenseKey: '4GD-MOCK-••••-••••',
      createdAt: nowIso,
      updatedAt: nowIso,
      updatedBy: performedBy || 'mock-admin',
    };
    this._licenses.update((list) => [newLic, ...list]);
    return of({
      data: newLic,
      message: 'Licencia mock creada.',
      success: true,
    }).pipe(delay(100));
  }

  updateLicense(
    id: string,
    payload: Partial<WmsLicense>,
    changedFields: Record<string, { previous: unknown; current: unknown }>,
    performedBy: string
  ): Observable<ServiceResult<WmsLicense>> {
    let updated: WmsLicense = this._licenses().find((l) => l.id === id)!;
    this._licenses.update((list) =>
      list.map((l) => {
        if (l.id === id) {
          updated = { ...l, ...payload, updatedAt: new Date().toISOString(), updatedBy: performedBy };
          return updated;
        }
        return l;
      })
    );
    return of({
      data: updated,
      message: 'Licencia mock actualizada.',
      success: true,
    }).pipe(delay(100));
  }

  renewLicense(
    id: string,
    payload: LicenseRenewalPayload,
    performedBy: string
  ): Observable<ServiceResult<WmsLicense>> {
    let updated: WmsLicense = this._licenses().find((l) => l.id === id)!;
    this._licenses.update((list) =>
      list.map((l) => {
        if (l.id === id) {
          updated = {
            ...l,
            validUntil: new Date(payload.newValidUntil).toISOString(),
            plan: payload.newPlan ?? l.plan,
            updatedAt: new Date().toISOString(),
            updatedBy: performedBy,
          };
          return updated;
        }
        return l;
      })
    );
    return of({
      data: updated,
      message: 'Licencia mock renovada.',
      success: true,
    }).pipe(delay(100));
  }

  suspendLicense(id: string, reason: string, performedBy: string): Observable<ServiceResult<WmsLicense>> {
    let updated: WmsLicense = this._licenses().find((l) => l.id === id)!;
    this._licenses.update((list) =>
      list.map((l) => {
        if (l.id === id) {
          updated = { ...l, adminStatus: 'SUSPENDED', administrativeReason: reason, updatedAt: new Date().toISOString(), updatedBy: performedBy };
          return updated;
        }
        return l;
      })
    );
    return of({
      data: updated,
      message: 'Licencia mock suspendida.',
      success: true,
    }).pipe(delay(100));
  }

  reactivateLicense(id: string, reason: string, performedBy: string): Observable<ServiceResult<WmsLicense>> {
    let updated: WmsLicense = this._licenses().find((l) => l.id === id)!;
    this._licenses.update((list) =>
      list.map((l) => {
        if (l.id === id) {
          updated = { ...l, adminStatus: 'ACTIVE', administrativeReason: reason, updatedAt: new Date().toISOString(), updatedBy: performedBy };
          return updated;
        }
        return l;
      })
    );
    return of({
      data: updated,
      message: 'Licencia mock reactivada.',
      success: true,
    }).pipe(delay(100));
  }

  revokeLicense(id: string, reason: string, performedBy: string): Observable<ServiceResult<WmsLicense>> {
    let updated: WmsLicense = this._licenses().find((l) => l.id === id)!;
    this._licenses.update((list) =>
      list.map((l) => {
        if (l.id === id) {
          updated = { ...l, adminStatus: 'REVOKED', administrativeReason: reason, updatedAt: new Date().toISOString(), updatedBy: performedBy };
          return updated;
        }
        return l;
      })
    );
    return of({
      data: updated,
      message: 'Licencia mock revocada.',
      success: true,
    }).pipe(delay(100));
  }

  regenerateLicenseKey(
    id: string,
    reason: string,
    performedBy: string
  ): Observable<ServiceResult<WmsLicense>> {
    let updated: WmsLicense = this._licenses().find((l) => l.id === id)!;
    const newKey = `4GD-REGEN-${Date.now()}`;
    this._licenses.update((list) =>
      list.map((l) => {
        if (l.id === id) {
          updated = {
            ...l,
            licenseKey: newKey,
            maskedLicenseKey: '4GD-REGEN-••••-••••',
            administrativeReason: reason,
            updatedAt: new Date().toISOString(),
            updatedBy: performedBy,
          };
          return updated;
        }
        return l;
      })
    );
    return of({
      data: updated,
      message: 'Clave mock regenerada.',
      success: true,
    }).pipe(delay(100));
  }

  getLicenseAudit(id: string): Observable<unknown> {
    return of({ success: true, data: [] });
  }
}
