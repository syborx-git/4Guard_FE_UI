/**
 * @file supplier.service.ts
 * @description Servicio de Gestión de Proveedores (HU-125) — 4GUARD WMS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Responsabilidades
 * ═══════════════════════════════════════════════════════════════════════════
 *  - Centralizar llamadas HTTP al recurso /api/suppliers
 *  - Exponer estado reactivo mediante Angular Signals
 *  - Ofrecer contadores computed (`activeCount`, `unavailableCount`, `preferredCount`, `totalCount`)
 *  - Proporcionar validación preventiva de duplicados (código, RFC/TaxID, Razón social)
 *  - Mantener datos mock robustos con soporte de alcance 3PL (GLOBAL, CLIENT, WAREHOUSE)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ENDPOINTS FUTUROS DE BACKEND (SPRING BOOT + RLS)
 * ═══════════════════════════════════════════════════════════════════════════
 *  GET    /api/suppliers             — Listar proveedores (RLS aplicado en backend)
 *  POST   /api/suppliers             — Crear proveedor (Guardado transaccional en DB)
 *  PUT    /api/suppliers/{id}        — Actualizar proveedor
 *  PATCH  /api/suppliers/{id}/status — Cambiar estado (Activo / Inactivo / Bloqueado)
 *  DELETE /api/suppliers/{id}        — Archivar / Eliminación lógica (active=false, deleted=true)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * REGLAS DE AUDITORÍA Y TRANSACCIONALIDAD
 * ═══════════════════════════════════════════════════════════════════════════
 *  El backend ejecutará dentro de una sola transacción:
 *   1. Guardar/Actualizar la entidad Proveedor, Contacto, Dirección y Condiciones.
 *   2. Generar el registro en la tabla `audit_logs`.
 *   3. En caso de error en cualquier paso, realiza rollback automático.
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap, delay, map } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import {
  Supplier,
  SupplierApiResponse,
  SupplierListParams,
  SupplierStatusChangeRequest,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  normalizeCodeOrTaxId,
  SupplierPagedResponse,
  SupplierAuditEntry,
  SupplierAuditDetail,
} from '../models/supplier.model';

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable({
  providedIn: 'root'
})
export class SupplierService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiBaseUrl}/api/v1/suppliers`;
  private readonly USE_MOCK = false;

  // ─── Estado Reactivo (Signals) ──────────────────────────────────────────────

  readonly suppliers = signal<Supplier[]>([]);
  readonly loading = signal<boolean>(false);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal<boolean>(false);
  readonly totalCount = signal<number>(0);
  readonly currentPage = signal<number>(0);
  readonly pageSize = signal<number>(20);

  // ─── Contadores Computed (Header KPI Cards) ───────────────────────────────

  /** Proveedores activos (status === 'ACTIVE' y no archivados). */
  readonly activeCount = computed(() =>
    this.suppliers().filter(s => s.status === 'ACTIVE' && s.active && !s.deleted).length
  );

  /** Proveedores no disponibles (status === 'INACTIVE' o 'BLOCKED'). */
  readonly unavailableCount = computed(() =>
    this.suppliers().filter(s => (s.status === 'INACTIVE' || s.status === 'BLOCKED') && s.active && !s.deleted).length
  );

  /** Proveedores preferentes (preferred === true). */
  readonly preferredCount = computed(() =>
    this.suppliers().filter(s => s.preferred && s.active && !s.deleted).length
  );

  /** Total de proveedores activos en el directorio. */
  readonly totalActiveCount = computed(() =>
    this.suppliers().filter(s => s.active && !s.deleted).length
  );

  // ─── Métodos de Lectura ──────────────────────────────────────────────────────

  /**
   * Carga la lista de proveedores aplicando filtros en memoria (mock) o query params (backend).
   * TODO: Conectar con GET /api/suppliers
   */
  loadSuppliers(params?: SupplierListParams): Observable<SupplierApiResponse<Supplier[]>> {
    this.loading.set(true);
    this.loadError.set(null);

    const orgId = this.getSessionOrgId();
    let httpParams = new HttpParams()
      .set('organizationId', orgId)
      .set('page', '0')
      .set('size', '1000') // Carga un volumen alto para soportar el filtrado reactivo local en el FE
      .set('sortBy', 'updatedAt')
      .set('sortDir', 'DESC');

    if (params) {
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.status) httpParams = httpParams.set('status', params.status);
      if (params.type) httpParams = httpParams.set('type', params.type);
      if (params.scopeType) httpParams = httpParams.set('scopeType', params.scopeType);
      if (params.clientId) httpParams = httpParams.set('clientId', params.clientId);
      if (params.warehouseId) httpParams = httpParams.set('warehouseId', params.warehouseId);
      if (params.preferredOnly !== undefined) httpParams = httpParams.set('preferredOnly', params.preferredOnly.toString());
    }

    return this.http.get<SupplierApiResponse<SupplierPagedResponse>>(this.API_URL, { params: httpParams }).pipe(
      tap(res => {
        if (res.success && res.data) {
          this.totalCount.set(res.data.totalElements);
        }
      }),
      map(res => ({
        ...res,
        data: res.data ? res.data.content : []
      })),
      tap(res => {
        this.suppliers.set(res.data);
        this.loading.set(false);
      }),
      catchError(err => this.handleError(err))
    );
  }

  // ─── Métodos de Escritura ────────────────────────────────────────────────────

  /**
  /**
   * Obtiene el detalle completo de un proveedor.
   * GET /api/v1/suppliers/{id}
   */
  getSupplierById(id: string): Observable<SupplierApiResponse<Supplier>> {
    return this.http.get<SupplierApiResponse<Supplier>>(`${this.API_URL}/${id}`).pipe(
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Obtiene el historial de auditoría de un proveedor como timeline.
   * GET /api/v1/suppliers/{id}/audit
   */
  getSupplierAudit(id: string): Observable<SupplierApiResponse<SupplierAuditEntry[]>> {
    return this.http.get<SupplierApiResponse<SupplierAuditEntry[]>>(`${this.API_URL}/${id}/audit`).pipe(
      tap(res => {
        // Enriquecer entradas con iconos y colores para el timeline
        res.data?.forEach(entry => {
          entry.timelineIcon = this.getAuditIcon(entry.action);
          entry.timelineColor = this.getAuditColor(entry.action);
          entry.summary = this.getAuditSummary(entry);
        });
      }),
      catchError(err => this.handleError(err))
    );
  }

  private getAuditIcon(action: string): string {
    const map: Record<string, string> = {
      SUPPLIER_CREATED: 'add_circle',
      SUPPLIER_UPDATED: 'edit',
      SUPPLIER_STATUS_UPDATED: 'swap_horiz',
      SUPPLIER_ARCHIVED: 'delete_forever',
    };
    return map[action] ?? 'info';
  }

  private getAuditColor(action: string): 'create' | 'update' | 'status' {
    const map: Record<string, 'create' | 'update' | 'status'> = {
      SUPPLIER_CREATED: 'create',
      SUPPLIER_UPDATED: 'update',
      SUPPLIER_STATUS_UPDATED: 'status',
      SUPPLIER_ARCHIVED: 'status',
    };
    return map[action] ?? 'update';
  }

  private getAuditSummary(entry: SupplierAuditEntry): string {
    if (entry.action === 'SUPPLIER_CREATED') {
      return 'Registró el proveedor en el catálogo maestro';
    }
    if (entry.action === 'SUPPLIER_STATUS_UPDATED') {
      const statusDet = entry.details?.find(d => d.fieldName === 'status');
      const reasonDet = entry.details?.find(d => d.fieldName === 'statusReason');
      
      const newStatus = statusDet?.newValue || '';
      const oldStatus = statusDet?.oldValue || '';
      const reason = reasonDet?.newValue;

      let msg = 'Cambió el estado';
      if (oldStatus && newStatus) {
        msg += ` de ${oldStatus} a ${newStatus}`;
      } else if (newStatus) {
        msg += ` a ${newStatus}`;
      }
      if (reason) {
        msg += `: "${reason}"`;
      }
      return msg;
    }
    if (entry.action === 'SUPPLIER_UPDATED') {
      return 'Actualizó la información del proveedor';
    }
    if (entry.action === 'SUPPLIER_ARCHIVED') {
      return 'Archivó el proveedor (eliminación lógica)';
    }
    return entry.action;
  }

  /**
   * Crea un nuevo proveedor en el catálogo.
   * El backend ejecutará transacción: guardar entidad + contacto + dirección + términos + audit_logs.
   */
  createSupplier(dto: CreateSupplierRequest): Observable<SupplierApiResponse<Supplier>> {
    this.saving.set(true);
    const orgId = this.getSessionOrgId();
    const payload = {
      ...dto,
      organizationId: orgId
    };

    return this.http.post<SupplierApiResponse<Supplier>>(this.API_URL, payload).pipe(
      tap(res => {
        this.suppliers.update(list => [res.data, ...list]);
        this.totalCount.update(n => n + 1);
        this.saving.set(false);
      }),
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Actualiza los datos de un proveedor existente.
   * GET /api/v1/suppliers/{id}
   */
  updateSupplier(id: string, dto: UpdateSupplierRequest): Observable<SupplierApiResponse<Supplier>> {
    this.saving.set(true);
    const orgId = this.getSessionOrgId();
    const existing = this.suppliers().find(s => s.id === id);
    const currentVersion = existing ? existing.version || 1 : 1;
    const payload = {
      ...dto,
      organizationId: orgId,
      version: currentVersion
    };

    return this.http.put<SupplierApiResponse<Supplier>>(`${this.API_URL}/${id}`, payload).pipe(
      tap(res => {
        this.suppliers.update(list => list.map(s => s.id === id ? res.data : s));
        this.saving.set(false);
      }),
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Cambia el estado del proveedor (Activo / Inactivo / Bloqueado) registrando motivo.
   */
  changeSupplierStatus(id: string, dto: SupplierStatusChangeRequest): Observable<SupplierApiResponse<Supplier>> {
    this.saving.set(true);
    return this.http.patch<SupplierApiResponse<Supplier>>(`${this.API_URL}/${id}/status`, dto).pipe(
      tap(res => {
        this.suppliers.update(list => list.map(s => s.id === id ? res.data : s));
        this.saving.set(false);
      }),
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Archiva un proveedor (eliminación lógica).
   * El backend NUNCA borra físicamente registros con historial comercial/operativo.
   */
  archiveSupplier(id: string): Observable<SupplierApiResponse<void>> {
    this.saving.set(true);
    return this.http.delete<SupplierApiResponse<void>>(`${this.API_URL}/${id}`).pipe(
      tap(() => {
        this.suppliers.update(list => list.filter(s => s.id !== id));
        this.totalCount.update(n => Math.max(0, n - 1));
        this.saving.set(false);
      }),
      catchError(err => this.handleError(err))
    );
  }

  // ─── Validaciones Preventivas de Duplicidad ────────────────────────────────

  /** Verifica si un código de proveedor ya existe. */
  isCodeDuplicate(code: string, excludeId?: string): boolean {
    const norm = normalizeCodeOrTaxId(code);
    if (!norm) return false;
    return this.suppliers().some(s => s.id !== excludeId && s.active && normalizeCodeOrTaxId(s.code) === norm);
  }

  /** Verifica si un RFC / Tax ID ya existe dentro del mismo alcance RLS. */
  isTaxIdDuplicate(taxId: string, excludeId?: string): boolean {
    const norm = normalizeCodeOrTaxId(taxId);
    if (!norm) return false;
    return this.suppliers().some(s => s.id !== excludeId && s.active && normalizeCodeOrTaxId(s.taxId) === norm);
  }

  /** Verifica si una Razón Social ya existe normalizada. */
  isLegalNameDuplicate(legalName: string, excludeId?: string): boolean {
    const norm = legalName.trim().toLowerCase();
    if (!norm) return false;
    return this.suppliers().some(s => s.id !== excludeId && s.active && s.legalName.trim().toLowerCase() === norm);
  }

  private getSessionOrgId(): string {
    try {
      const sessionStr = localStorage.getItem('session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session?.user?.organizationId) {
          return session.user.organizationId;
        }
      }
    } catch {}
    return 'a53f0907-9fa5-4bdf-87db-2eb5e7683935'; // Fallback por defecto (4GUARD)
  }

  // ─── Manejo de Errores ──────────────────────────────────────────────────────

  private handleError(error: HttpErrorResponse): Observable<never> {
    this.loading.set(false);
    this.saving.set(false);
    return throwError(() => error);
  }
}
