/**
 * @file license-management.service.ts
 * @description Servicio de Gestión de Licencias del WMS (HU-139) — 4GUARD WMS.
 *
 * Conectado al API REST de Spring Boot (/api/v1/licenses) con Angular Signals,
 * HttpClient y patrón ServiceResult<T> homologado con SDD Level 5. Cero Mocks.
 */

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../core/services/toast.service';
import {
  WmsLicense,
  LicenseCapacity,
  LicenseUsage,
  LicenseHistoryEntry,
  LicenseAuditEntry,
  LicenseRenewalPayload,
  ServiceResult,
  computeDerivedStatus,
} from './license-management.models';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  error?: {
    code: string;
    details?: string[];
  };
}

@Injectable({
  providedIn: 'root',
})
export class LicenseManagementService {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly apiUrl = `${environment.apiBaseUrl}/api/v1/licenses`;

  // ─── Estado Interno Mutable (Signals — Cero Mocks ADR-007) ────────────────
  private readonly _licenses = signal<WmsLicense[]>([]);
  private readonly _history = signal<LicenseHistoryEntry[]>([]);
  private readonly _auditLog = signal<LicenseAuditEntry[]>([]);

  // ─── Señales Públicas (solo lectura) ──────────────────────────────────────
  readonly licenses = this._licenses.asReadonly();
  readonly historyEntries = this._history.asReadonly();
  readonly auditEntries = this._auditLog.asReadonly();

  /** Enmascara la parte central de una clave de licencia. */
  maskLicenseKey(key: string): string {
    if (!key) return '';
    const parts = key.split('-');
    if (parts.length < 4) return key.replace(/.(?=.{4})/g, '•');
    return parts
      .map((part, i) => (i > 1 && i < parts.length - 1 ? '••••' : part))
      .join('-');
  }

  /** Normaliza la entidad de licencia garantizando que capacities y usage estén siempre definidos. */
  private normalizeLicense(item: WmsLicense): WmsLicense {
    if (!item) return item;
    const capacities: LicenseCapacity = item.capacities ?? {
      maxUsers: item.maxUsers ?? 10,
      maxConcurrentUsers: item.maxConcurrentUsers ?? 5,
      maxWarehouses: item.maxWarehouses ?? 1,
      maxHandheldDevices: item.maxHandheldDevices ?? 5,
      maxIntegrations: item.maxIntegrations ?? 1,
    };

    const usage: LicenseUsage = item.usage ?? {
      currentUsers: item.currentUsers ?? 0,
      concurrentUsersPeak: item.concurrentUsersPeak ?? 0,
      currentWarehouses: item.currentWarehouses ?? 0,
      registeredHandheldDevices: item.registeredHandheldDevices ?? 0,
      activeIntegrations: item.activeIntegrations ?? 0,
    };

    return {
      ...item,
      capacities,
      usage,
      maxUsers: capacities.maxUsers,
      maxConcurrentUsers: capacities.maxConcurrentUsers,
      maxWarehouses: capacities.maxWarehouses,
      maxHandheldDevices: capacities.maxHandheldDevices,
      maxIntegrations: capacities.maxIntegrations,
      currentUsers: usage.currentUsers,
      concurrentUsersPeak: usage.concurrentUsersPeak,
      currentWarehouses: usage.currentWarehouses,
      registeredHandheldDevices: usage.registeredHandheldDevices,
      activeIntegrations: usage.activeIntegrations,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSULTAS REST HTTP (Spring Boot Backend API)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Retorna todas las licencias consumiendo la API REST de Spring Boot (GET /api/v1/licenses). */
  getLicenses(): Observable<ServiceResult<WmsLicense[]>> {
    return this.http.get<ApiResponse<WmsLicense[]>>(this.apiUrl).pipe(
      map((res) => {
        const normalizedData = (res.data || []).map((l) => this.normalizeLicense(l));
        return {
          ...res,
          data: normalizedData,
        };
      }),
      tap((res) => {
        if (res.success && Array.isArray(res.data)) {
          this._licenses.set(res.data);
        }
      }),
      map((res) => ({
        data: res.data || [],
        message: res.message || 'Licencias cargadas correctamente desde el servidor backend.',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        const errMsg: string = String(err?.error?.message || err?.message || 'Error al consultar las licencias en el servidor.');
        this.toast.error(errMsg);
        return throwError(() => ({
          success: false,
          message: errMsg,
          data: [],
        }));
      })
    );
  }

  /** Retorna una licencia por ID (GET /api/v1/licenses/{id}). */
  getLicenseById(id: string): Observable<ServiceResult<WmsLicense>> {
    return this.http.get<ApiResponse<WmsLicense>>(`${this.apiUrl}/${id}`).pipe(
      map((res) => {
        const dataAny = res.data as unknown;
        let lic: WmsLicense;
        if (dataAny && typeof dataAny === 'object' && 'license' in dataAny) {
          const detail = dataAny as { license: WmsLicense; usage: LicenseUsage };
          lic = this.normalizeLicense({
            ...detail.license,
            usage: detail.usage,
          });
        } else {
          lic = this.normalizeLicense(res.data);
        }
        return {
          data: lic,
          message: res.message || 'Licencia encontrada en backend.',
          success: res.success ?? true,
        };
      }),
      catchError((err: any) => {
        const errMsg: string = String(err?.error?.message || err?.message || `Licencia con ID "${id}" no encontrada en servidor.`);
        this.toast.error(errMsg);
        return throwError(() => ({
          success: false,
          message: errMsg,
        }));
      })
    );
  }

  /** Retorna el historial de una licencia específica. */
  getLicenseHistory(licenseId: string): LicenseHistoryEntry[] {
    return this._history().filter(h => h.licenseId === licenseId);
  }

  /** Retorna las entradas de auditoría de una licencia específica desde el Backend (GET /api/v1/licenses/{id}/audit). */
  getLicenseAudit(id: string): Observable<ApiResponse<LicenseAuditEntry[]>> {
    return this.http.get<ApiResponse<LicenseAuditEntry[]>>(`${this.apiUrl}/${id}/audit`).pipe(
      tap((res) => {
        if (res.data) {
          this._auditLog.set(res.data);
        }
      }),
      catchError((err: any) => {
        console.error('Error al cargar la auditoría de la licencia:', err);
        return throwError(() => err);
      })
    );
  }

  /** Retorna las entradas de auditoría en memoria del signal. */
  getAuditEntries(licenseId: string): LicenseAuditEntry[] {
    return this._auditLog().filter(a => a.licenseId === licenseId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MUTACIONES REST HTTP (Spring Boot Backend API)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Crea una nueva licencia (POST /api/v1/licenses). */
  createLicense(
    payload: Omit<WmsLicense, 'id' | 'createdAt' | 'updatedAt' | 'licenseKey' | 'maskedLicenseKey'>,
    performedBy: string
  ): Observable<ServiceResult<WmsLicense>> {
    return this.http.post<ApiResponse<WmsLicense>>(this.apiUrl, payload).pipe(
      tap((res) => {
        if (res.success && res.data) {
          const normalized = this.normalizeLicense(res.data);
          this._licenses.update((list) => [normalized, ...list]);
        }
      }),
      map((res) => ({
        data: res.data,
        message: res.message || 'Licencia creada exitosamente en servidor.',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        const errMsg: string = String(err?.error?.message || err?.message || 'Error al crear la licencia en el servidor.');
        this.toast.error(errMsg);
        return throwError(() => ({
          success: false,
          message: errMsg,
        }));
      })
    );
  }

  /** Actualiza datos generales de una licencia existente (PUT /api/v1/licenses/{id}). */
  updateLicense(
    id: string,
    payload: Partial<WmsLicense>,
    changedFields: Record<string, { previous: unknown; current: unknown }>,
    performedBy: string
  ): Observable<ServiceResult<WmsLicense>> {
    return this.http.put<ApiResponse<WmsLicense>>(`${this.apiUrl}/${id}`, payload).pipe(
      tap((res) => {
        if (res.success && res.data) {
          const normalized = this.normalizeLicense(res.data);
          this._licenses.update((list) => list.map((l) => (l.id === id ? normalized : l)));
        }
      }),
      map((res) => ({
        data: res.data,
        message: res.message || 'Licencia actualizada correctamente.',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        const errMsg: string = String(err?.error?.message || err?.message || 'Error al actualizar la licencia en el servidor.');
        this.toast.error(errMsg);
        return throwError(() => ({
          success: false,
          message: errMsg,
        }));
      })
    );
  }

  /** Renueva la vigencia de una licencia (POST /api/v1/licenses/{id}/renew). */
  renewLicense(
    id: string,
    payload: LicenseRenewalPayload,
    performedBy: string
  ): Observable<ServiceResult<WmsLicense>> {
    return this.http.post<ApiResponse<WmsLicense>>(`${this.apiUrl}/${id}/renew`, payload).pipe(
      tap((res) => {
        if (res.success && res.data) {
          const normalized = this.normalizeLicense(res.data);
          this._licenses.update((list) => list.map((l) => (l.id === id ? normalized : l)));
        }
      }),
      map((res) => ({
        data: res.data,
        message: res.message || 'Licencia renovada exitosamente.',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        const errMsg: string = String(err?.error?.message || err?.message || 'Error al renovar la licencia en el servidor.');
        this.toast.error(errMsg);
        return throwError(() => ({
          success: false,
          message: errMsg,
        }));
      })
    );
  }

  /** Suspende una licencia activa (POST /api/v1/licenses/{id}/suspend). */
  suspendLicense(id: string, reason: string, performedBy: string): Observable<ServiceResult<WmsLicense>> {
    return this.http.post<ApiResponse<WmsLicense>>(`${this.apiUrl}/${id}/suspend`, { reason }).pipe(
      tap((res) => {
        if (res.success && res.data) {
          const normalized = this.normalizeLicense(res.data);
          this._licenses.update((list) => list.map((l) => (l.id === id ? normalized : l)));
        }
      }),
      map((res) => ({
        data: res.data,
        message: res.message || 'Licencia suspendida correctamente.',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        const errMsg: string = String(err?.error?.message || err?.message || 'Error al suspender la licencia en el servidor.');
        this.toast.error(errMsg);
        return throwError(() => ({
          success: false,
          message: errMsg,
        }));
      })
    );
  }

  /** Reactiva una licencia suspendida (POST /api/v1/licenses/{id}/reactivate). */
  reactivateLicense(id: string, reason: string, performedBy: string): Observable<ServiceResult<WmsLicense>> {
    return this.http.post<ApiResponse<WmsLicense>>(`${this.apiUrl}/${id}/reactivate`, { reason }).pipe(
      tap((res) => {
        if (res.success && res.data) {
          const normalized = this.normalizeLicense(res.data);
          this._licenses.update((list) => list.map((l) => (l.id === id ? normalized : l)));
        }
      }),
      map((res) => ({
        data: res.data,
        message: res.message || 'Licencia reactivada correctamente.',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        const errMsg: string = String(err?.error?.message || err?.message || 'Error al reactivar la licencia en el servidor.');
        this.toast.error(errMsg);
        return throwError(() => ({
          success: false,
          message: errMsg,
        }));
      })
    );
  }

  /** Revoca una licencia de forma permanente (POST /api/v1/licenses/{id}/revoke). */
  revokeLicense(id: string, reason: string, performedBy: string): Observable<ServiceResult<WmsLicense>> {
    return this.http.post<ApiResponse<WmsLicense>>(`${this.apiUrl}/${id}/revoke`, { reason }).pipe(
      tap((res) => {
        if (res.success && res.data) {
          const normalized = this.normalizeLicense(res.data);
          this._licenses.update((list) => list.map((l) => (l.id === id ? normalized : l)));
        }
      }),
      map((res) => ({
        data: res.data,
        message: res.message || 'Licencia revocada correctamente.',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        const errMsg: string = String(err?.error?.message || err?.message || 'Error al revocar la licencia en el servidor.');
        this.toast.error(errMsg);
        return throwError(() => ({
          success: false,
          message: errMsg,
        }));
      })
    );
  }

  /** Actualiza una licencia en el signal local en memoria. */
  updateLocalLicense(updated: WmsLicense): void {
    this._licenses.update(list => list.map(l => l.id === updated.id ? updated : l));
  }

  /** Regenera la clave de licencia (POST /api/v1/licenses/{id}/regenerate-key). */
  regenerateLicenseKey(id: string, reason: string, performedBy: string): Observable<ServiceResult<WmsLicense>> {
    return this.http.post<ApiResponse<WmsLicense>>(`${this.apiUrl}/${id}/regenerate-key`, { reason }).pipe(
      tap((res) => {
        if (res.success && res.data) {
          const normalized = this.normalizeLicense(res.data);
          this._licenses.update((list) => list.map((l) => (l.id === id ? normalized : l)));
        }
      }),
      map((res) => ({
        data: res.data,
        message: res.message || 'Clave de licencia regenerada exitosamente.',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        const errMsg: string = String(err?.error?.message || err?.message || 'Error al regenerar la clave de licencia en el servidor.');
        this.toast.error(errMsg);
        return throwError(() => ({
          success: false,
          message: errMsg,
        }));
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════════════════════════════════════════

  /** Calcula el estado derivado de una licencia. Delegado al modelo. */
  getDerivedStatus = computeDerivedStatus;
}
