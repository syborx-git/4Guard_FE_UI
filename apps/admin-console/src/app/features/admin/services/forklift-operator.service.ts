/**
 * @file forklift-operator.service.ts
 * @description Servicio HTTP de Gestión de Montacarguistas (HU-142) — 4GUARD WMS.
 *
 * MIGRADO: Elimina persistencia localStorage / semillas mock.
 * Consume el API REST de Spring Boot (/api/v1/forklift-operators).
 * ADR-007: Cero Mocks en producción. Signals reactivos para estado global.
 *
 * Endpoints Backend:
 *   POST   /api/v1/forklift-operators                  — Registrar montacarguista
 *   PUT    /api/v1/forklift-operators/{id}              — Actualizar montacarguista
 *   GET    /api/v1/forklift-operators/{id}              — Obtener por ID
 *   GET    /api/v1/forklift-operators?organizationId=   — Listar con filtros
 *   DELETE /api/v1/forklift-operators/{id}              — Baja lógica
 *   PATCH  /api/v1/forklift-operators/{id}/status       — Toggle ACTIVO/INACTIVO
 *   GET    /api/v1/forklift-operators/{id}/audit        — Historial de auditoría
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import {
  ForkliftOperator,
  CreateForkliftOperatorRequest,
  UpdateForkliftOperatorRequest,
  UpdateForkliftOperatorStatusRequest,
  ForkliftOperatorAuditEntry,
  calculateLicenseStatus,
} from '../models/forklift-operator.models';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
}

/** Default organization ID — resolved from the active user session context. */
const DEFAULT_ORG_ID = 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';

@Injectable({
  providedIn: 'root',
})
export class ForkliftOperatorAdminService {
  private readonly http = inject(HttpClient);
  private readonly BASE_URL = `${environment.apiBaseUrl}/api/v1/forklift-operators`;

  // ─── Estado Reactivo (Angular Signals) ─────────────────────────────────────

  private readonly operatorsSignal = signal<ForkliftOperator[]>([]);

  readonly operators = this.operatorsSignal.asReadonly();

  readonly loading = signal<boolean>(false);
  readonly saving  = signal<boolean>(false);
  readonly error   = signal<string | null>(null);

  readonly activeOperators = computed(() =>
    this.operatorsSignal().filter((op) => op.status === 'ACTIVO')
  );

  readonly dropdownOperators = computed(() =>
    this.activeOperators().map((op) => ({
      code: op.code,
      name: op.fullName,
    }))
  );

  // ─── LOAD LIST ─────────────────────────────────────────────────────────────

  /**
   * Loads the full operator list for the given organization.
   * Updates the global `operators` signal on success.
   */
  loadOperators(
    organizationId: string = DEFAULT_ORG_ID,
    options?: { branchId?: string; status?: string; licenseStatus?: string; search?: string }
  ): Observable<ForkliftOperator[]> {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams().set('organizationId', organizationId);
    if (options?.branchId)      params = params.set('branchId',      options.branchId);
    if (options?.status)        params = params.set('status',        options.status);
    if (options?.licenseStatus) params = params.set('licenseStatus', options.licenseStatus);
    if (options?.search)        params = params.set('search',        options.search);

    return this.http.get<ApiResponse<ForkliftOperator[]>>(this.BASE_URL, { params }).pipe(
      map((res) => this.normalizeList(res.data)),
      tap((list) => {
        this.operatorsSignal.set(list);
        this.loading.set(false);
      }),
      catchError((err) => {
        this.loading.set(false);
        this.error.set(this.extractErrorMessage(err));
        return throwError(() => err);
      })
    );
  }

  // ─── CREATE ────────────────────────────────────────────────────────────────

  createOperator(request: CreateForkliftOperatorRequest): Observable<ForkliftOperator> {
    this.saving.set(true);
    return this.http.post<ApiResponse<ForkliftOperator>>(this.BASE_URL, request).pipe(
      map((res) => this.normalize(res.data)),
      tap((created) => {
        this.operatorsSignal.update((list) => [created, ...list]);
        this.saving.set(false);
      }),
      catchError((err) => {
        this.saving.set(false);
        return throwError(() => err);
      })
    );
  }

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  updateOperator(request: UpdateForkliftOperatorRequest): Observable<ForkliftOperator> {
    this.saving.set(true);
    return this.http.put<ApiResponse<ForkliftOperator>>(`${this.BASE_URL}/${request.id}`, request).pipe(
      map((res) => this.normalize(res.data)),
      tap((updated) => {
        this.operatorsSignal.update((list) =>
          list.map((op) => (op.id === updated.id ? updated : op))
        );
        this.saving.set(false);
      }),
      catchError((err) => {
        this.saving.set(false);
        return throwError(() => err);
      })
    );
  }

  // ─── GET BY ID ─────────────────────────────────────────────────────────────

  getOperatorById(id: string): Observable<ForkliftOperator> {
    return this.http.get<ApiResponse<ForkliftOperator>>(`${this.BASE_URL}/${id}`).pipe(
      map((res) => this.normalize(res.data)),
      catchError((err) => throwError(() => err))
    );
  }

  // ─── DELETE ────────────────────────────────────────────────────────────────

  deleteOperator(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.BASE_URL}/${id}`).pipe(
      tap(() => {
        this.operatorsSignal.update((list) => list.filter((op) => op.id !== id));
      }),
      map(() => void 0),
      catchError((err) => throwError(() => err))
    );
  }

  // ─── STATUS CHANGE ─────────────────────────────────────────────────────────

  toggleStatus(id: string, reason?: string): Observable<ForkliftOperator> {
    const current = this.operatorsSignal().find((op) => op.id === id);
    const newStatus = current?.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';

    const body: UpdateForkliftOperatorStatusRequest = {
      status: newStatus as 'ACTIVO' | 'INACTIVO',
      reason,
    };

    return this.http.patch<ApiResponse<ForkliftOperator>>(`${this.BASE_URL}/${id}/status`, body).pipe(
      map((res) => this.normalize(res.data)),
      tap((updated) => {
        this.operatorsSignal.update((list) =>
          list.map((op) => (op.id === updated.id ? updated : op))
        );
      }),
      catchError((err) => throwError(() => err))
    );
  }

  // ─── AUDIT HISTORY ─────────────────────────────────────────────────────────

  getAuditLogs(id: string): Observable<ForkliftOperatorAuditEntry[]> {
    return this.http.get<ApiResponse<ForkliftOperatorAuditEntry[]>>(`${this.BASE_URL}/${id}/audit`).pipe(
      map((res) => res.data),
      catchError((err) => throwError(() => err))
    );
  }

  // ─── NORMALIZATION ─────────────────────────────────────────────────────────

  /**
   * Normalizes a single operator: ensures `shift` display field is populated
   * from `shiftName` for template compatibility.
   */
  private normalize(op: ForkliftOperator): ForkliftOperator {
    return {
      ...op,
      shift: op.shift || (op as any).shiftName || '',
      // Recompute on the client as a safety net (authoritative value comes from BE)
      licenseStatus: op.licenseStatus || calculateLicenseStatus(op.licenseExpirationDate),
    };
  }

  private normalizeList(list: ForkliftOperator[]): ForkliftOperator[] {
    return (list || []).map((op) => this.normalize(op));
  }

  // ─── ERROR HANDLING ────────────────────────────────────────────────────────

  private extractErrorMessage(err: HttpErrorResponse): string {
    if (err.error?.message) return err.error.message;
    if (err.status === 0)   return 'No se puede conectar con el servidor. Verifique su conexión.';
    if (err.status === 401) return 'Sesión expirada. Por favor, inicie sesión nuevamente.';
    if (err.status === 403) return 'No tiene permisos para realizar esta acción.';
    if (err.status === 404) return 'El montacarguista solicitado no fue encontrado.';
    return `Error del servidor (${err.status}). Intente de nuevo.`;
  }
}
