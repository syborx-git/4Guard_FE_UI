/**
 * @file alerts-config.service.ts
 * @description Servicio de Configuración de Alertas y Notificaciones (HU-134) — 4GUARD WMS.
 *
 * Conectado al API REST de Spring Boot (/api/v1/alerts-config) con Angular Signals,
 * HttpClient y patrón ApiResponse<T> homologado con SDD Level 5.
 */

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  AlertConfiguration,
  CreateAlertConfigRequest,
  UpdateAlertConfigRequest,
  UpdateAlertConfigStatusRequest,
  AlertConfigAuditResponse,
  AlertHistoryEntry,
  AlertAuditEntry,
  AlertStatus,
  DUMMY_ALERTS,
  DUMMY_ALERT_HISTORY,
  DUMMY_ALERT_AUDIT,
} from './alerts-config.models';

export interface ServiceResult<T> {
  data: T;
  message: string;
  success: boolean;
}

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
export class AlertsConfigService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiBaseUrl}/api/v1/alerts-config`;

  // ─── Estado interno mutable en Signals ─────────────────────────────────
  private _alerts = signal<AlertConfiguration[]>([...DUMMY_ALERTS]);
  private _historyEntries = signal<AlertHistoryEntry[]>([...DUMMY_ALERT_HISTORY]);
  private _auditEntries = signal<AlertAuditEntry[]>([...DUMMY_ALERT_AUDIT]);

  // ─── Señales públicas de solo lectura ──────────────────────────────────
  readonly alerts = this._alerts.asReadonly();
  readonly historyEntries = this._historyEntries.asReadonly();
  readonly auditEntries = this._auditEntries.asReadonly();

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSULTAS REST HTTP (GET)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Obtiene la lista de reglas de alerta desde GET /api/v1/alerts-config
   */
  getAlerts(filters?: {
    category?: string;
    event?: string;
    priority?: string;
    status?: string;
    search?: string;
  }): Observable<ServiceResult<AlertConfiguration[]>> {
    let params = new HttpParams();
    if (filters?.category && filters.category !== 'ALL') {
      params = params.set('category', filters.category);
    }
    if (filters?.event) {
      params = params.set('event', filters.event);
    }
    if (filters?.priority) {
      params = params.set('priority', filters.priority);
    }
    if (filters?.status && filters.status !== 'ALL') {
      params = params.set('status', filters.status);
    }
    if (filters?.search) {
      params = params.set('search', filters.search);
    }

    return this.http.get<ApiResponse<AlertConfiguration[]>>(this.API_URL, { params }).pipe(
      map((res) => {
        const list = res.data || [];
        this._alerts.set(list);
        return {
          data: list,
          message: res.message || 'Reglas de alerta cargadas correctamente.',
          success: res.success ?? true,
        };
      }),
      catchError((err: HttpErrorResponse) => {
        console.warn('[AlertsConfigService] Error HTTP al consultar Backend. Usando estado local:', err.message);
        return of({
          data: [...this._alerts()],
          message: 'Reglas de alerta (estado local).',
          success: true,
        });
      })
    );
  }

  /**
   * Obtiene el detalle de una regla por ID desde GET /api/v1/alerts-config/{id}
   */
  getAlertById(id: string): Observable<ServiceResult<AlertConfiguration>> {
    return this.http.get<ApiResponse<AlertConfiguration>>(`${this.API_URL}/${id}`).pipe(
      map((res) => ({
        data: res.data,
        message: res.message || 'Regla encontrada.',
        success: res.success ?? true,
      })),
      catchError(() => {
        const found = this._alerts().find((a) => a.id === id);
        if (!found) {
          return throwError(() => ({ success: false, message: 'Regla no encontrada.' }));
        }
        return of({ data: { ...found }, message: 'Regla encontrada.', success: true });
      })
    );
  }

  /**
   * Consulta la auditoría de cambios desde GET /api/v1/alerts-config/{id}/audit
   */
  getAlertAuditApi(id: string): Observable<ServiceResult<AlertConfigAuditResponse[]>> {
    return this.http.get<ApiResponse<AlertConfigAuditResponse[]>>(`${this.API_URL}/${id}/audit`).pipe(
      map((res) => ({
        data: res.data || [],
        message: res.message || 'Historial de auditoría recuperado.',
        success: res.success ?? true,
      })),
      catchError(() => of({ data: [], message: 'Sin historial remoto.', success: false }))
    );
  }

  /** Retorna el historial de cambios local para fallback UI */
  getAlertHistory(alertId: string): AlertHistoryEntry[] {
    return this._historyEntries().filter((h) => h.alertId === alertId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MUTACIONES REST HTTP (POST / PUT / PATCH / DELETE)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Crea una nueva regla de alerta mediante POST /api/v1/alerts-config
   */
  createAlert(
    payload: CreateAlertConfigRequest | Omit<AlertConfiguration, 'id' | 'createdAt' | 'updatedAt'> | Omit<AlertConfiguration, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>
  ): Observable<ServiceResult<AlertConfiguration>> {
    return this.http.post<ApiResponse<AlertConfiguration>>(this.API_URL, payload).pipe(
      tap((res) => {
        if (res.data) {
          this._alerts.update((list) => [res.data, ...list]);
        }
      }),
      map((res) => ({
        data: res.data,
        message: res.message || `Regla de alerta "${payload.name}" creada exitosamente.`,
        success: res.success ?? true,
      })),
      catchError((err: HttpErrorResponse) => {
        const backendMessage = err.error?.message || err.message;
        if (err.status > 0) {
          return throwError(() => ({ success: false, message: backendMessage }));
        }
        // Fallback local solo si el servidor backend no responde (Network Offline)
        const now = new Date().toISOString();
        const newAlert: AlertConfiguration = {
          ...(payload as any),
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'e13f0907-9fa5-4bdf-87db-2eb5e7683999',
          createdAt: now,
          updatedAt: now,
        };
        this._alerts.update((list) => [newAlert, ...list]);
        return of({
          data: newAlert,
          message: `Regla de alerta "${newAlert.name}" guardada localmente.`,
          success: true,
        });
      })
    );
  }

  /**
   * Actualiza una regla existente mediante PUT /api/v1/alerts-config/{id}
   */
  updateAlert(
    id: string,
    payload: UpdateAlertConfigRequest | Partial<Omit<AlertConfiguration, 'id' | 'organizationId' | 'createdAt'>>,
    performedBy: string
  ): Observable<ServiceResult<AlertConfiguration>> {
    return this.http.put<ApiResponse<AlertConfiguration>>(`${this.API_URL}/${id}`, payload).pipe(
      tap((res) => {
        if (res.data) {
          this._alerts.update((arr) => {
            const copy = [...arr];
            const idx = copy.findIndex((a) => a.id === id);
            if (idx !== -1) copy[idx] = res.data;
            return copy;
          });
        }
      }),
      map((res) => ({
        data: res.data,
        message: res.message || 'Regla de alerta actualizada correctamente.',
        success: res.success ?? true,
      })),
      catchError((err: HttpErrorResponse) => {
        const backendMessage = err.error?.message || err.message;
        if (err.status > 0) {
          return throwError(() => ({ success: false, message: backendMessage }));
        }
        // Fallback local
        const list = this._alerts();
        const idx = list.findIndex((a) => a.id === id);
        if (idx === -1) {
          return throwError(() => ({ success: false, message: 'Regla no encontrada.' }));
        }
        const updated: AlertConfiguration = {
          ...list[idx],
          ...(payload as any),
          updatedAt: new Date().toISOString(),
          updatedBy: performedBy,
        };
        this._alerts.update((arr) => {
          const copy = [...arr];
          copy[idx] = updated;
          return copy;
        });
        return of({
          data: updated,
          message: `Regla "${updated.name}" actualizada localmente.`,
          success: true,
        });
      })
    );
  }

  /**
   * Cambia el estatus (ACTIVE / INACTIVE) mediante PATCH /api/v1/alerts-config/{id}/status
   */
  toggleAlertStatus(
    id: string,
    newStatus: AlertStatus,
    performedBy: string
  ): Observable<ServiceResult<AlertConfiguration>> {
    const statusPayload: UpdateAlertConfigStatusRequest = { status: newStatus };

    return this.http.patch<ApiResponse<AlertConfiguration>>(`${this.API_URL}/${id}/status`, statusPayload).pipe(
      tap((res) => {
        if (res.data) {
          this._alerts.update((arr) => {
            const copy = [...arr];
            const idx = copy.findIndex((a) => a.id === id);
            if (idx !== -1) copy[idx] = res.data;
            return copy;
          });
        }
      }),
      map((res) => ({
        data: res.data,
        message: res.message || `Estatus actualizado a ${newStatus}.`,
        success: res.success ?? true,
      })),
      catchError(() => this.updateAlert(id, { status: newStatus }, performedBy))
    );
  }

  /**
   * Elimina una regla mediante DELETE /api/v1/alerts-config/{id}
   */
  deleteAlert(id: string): Observable<ServiceResult<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.API_URL}/${id}`).pipe(
      tap(() => {
        this._alerts.update((list) => list.filter((a) => a.id !== id));
      }),
      map((res) => ({
        data: null,
        message: res.message || 'Regla de alerta eliminada exitosamente.',
        success: res.success ?? true,
      })),
      catchError(() => {
        this._alerts.update((list) => list.filter((a) => a.id !== id));
        return of({ data: null, message: 'Regla eliminada localmente.', success: true });
      })
    );
  }
}
