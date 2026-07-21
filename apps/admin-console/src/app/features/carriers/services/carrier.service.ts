/**
 * @file carrier.service.ts
 * @description Servicio de Gestión de Transportistas (HU-128) — 4GUARD WMS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Responsabilidades
 * ═══════════════════════════════════════════════════════════════════════════
 *  - Centralizar todas las llamadas HTTP al recurso /api/v1/carriers
 *  - Exponer el estado reactivo mediante Angular Signals
 *  - Delegar la autorización al jwtInterceptor (Bearer Token automático)
 *  - Contener datos mock mientras el backend no esté disponible
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Módulos que consumirán este servicio en historias posteriores
 * ═══════════════════════════════════════════════════════════════════════════
 *  • Programación de Ventanas de Recepción y Embarque
 *  • Recepción (asignación de transportista a la cita)
 *  • Embarques (selección de transportista para el pedido)
 *  • Smart Gate (validación de acceso por empresa transportista)
 *  • Control de Patio (check-in de unidades por empresa)
 *  • Torre de Control (monitoreo de SLAs)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTA DE AUDITORÍA
 * ═══════════════════════════════════════════════════════════════════════════
 *  El frontend NO genera registros de auditoría directamente.
 *  El backend ejecuta en una sola transacción: guardar + auditoría.
 *  Si cualquier paso falla, el backend realiza rollback completo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ENDPOINTS (ajustar según Swagger real del backend)
 * ═══════════════════════════════════════════════════════════════════════════
 *  GET    /api/v1/carriers               — Listar (filtros + paginación + orden)
 *  GET    /api/v1/carriers/{id}          — Obtener por ID
 *  POST   /api/v1/carriers               — Crear
 *  PUT    /api/v1/carriers/{id}          — Actualizar
 *  PATCH  /api/v1/carriers/{id}/status   — Cambiar estado
 *  GET    /api/v1/carriers/{id}/audit    — Historial de auditoría (línea de tiempo)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PAGINACIÓN DEL LADO DEL SERVIDOR
 * ═══════════════════════════════════════════════════════════════════════════
 *  El servicio está preparado para paginación y ordenamiento server-side.
 *  Mientras USE_MOCK = true, el filtrado y la paginación se realizan localmente.
 *  Al conectar el backend real, cambiar USE_MOCK = false y ajustar los
 *  query params según el contrato del Swagger.
 *
 *  TODO (al integrar backend):
 *   1. Cambiar USE_MOCK = false
 *   2. Ajustar nombres de query params en buildHttpParams()
 *   3. Verificar estructura de respuesta paginada (CarrierPagedResponse)
 *   4. Ajustar la indexación de página (0-indexed vs 1-indexed)
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap, delay, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  Carrier,
  CarrierApiResponse,
  CarrierAuditEntry,
  CarrierAuditDetail,
  CarrierListParams,
  CarrierStatus,
  CarrierStatusChangeRequest,
  CreateCarrierRequest,
  UpdateCarrierRequest,
  AUDIT_ACTION_ICONS,
  AUDIT_ACTION_COLORS,
} from '../models/carrier.model';

// ─── Datos Mock ───────────────────────────────────────────────────────────────
// TODO: Eliminar este bloque cuando el backend de /api/v1/carriers esté disponible.
// Los datos mock son ficticios y representan transportistas del entorno 4GUARD.

const MOCK_CARRIERS: Carrier[] = [
  {
    id: 'car-001',
    businessName: 'Transportes del Noreste S.A. de C.V.',
    tradeName: 'TransNoreste',
    rfc: 'TNO890314AB2',
    carrierType: 'EXTERNAL',
    status: 'ACTIVE',
    contactName: 'Roberto Garza Hernández',
    phone: '8181234567',
    email: 'rgarza@transnoreste.com.mx',
    serviceType: 'FTL',
    coverage: 'Noreste, Centro y Bajío (NL, CDMX, QRO, GTO)',
    coverageRegions: ['NL', 'CDMX', 'QRO', 'GTO'],
    supportedVehicleTypes: ['DRY_BOX', 'TRACTOR_TRAILER', 'FLATBED'],
    permitNumber: 'SCT-NL-00234-2022',
    preferredClients: ['Lala S.A.', 'FEMSA Distribución', 'Grupo Bimbo'],
    notes: 'Transportista preferencial para rutas de alto volumen. Contrato vigente hasta 2027.',
    createdAt: '2024-01-15T09:00:00Z',
    updatedAt: '2025-11-20T14:30:00Z',
    createdBy: 'admin',
    updatedBy: 'jperez',
  },
  {
    id: 'car-002',
    businessName: 'Logística Integral del Valle S.A. de C.V.',
    tradeName: 'LogiValle 3PL',
    rfc: 'LIV031122CD5',
    carrierType: 'THIRD_PARTY_3PL',
    status: 'ACTIVE',
    contactName: 'Ana Martínez Soto',
    phone: '5512345678',
    email: 'amartinez@logivalle.mx',
    serviceType: 'LTL',
    coverage: 'Centro de México (CDMX, EDO. MÉX, HGO, MOR, TLX)',
    coverageRegions: ['CDMX', 'MEX', 'HGO', 'MOR', 'TLX'],
    supportedVehicleTypes: ['DRY_BOX', 'REFRIGERATED_BOX', 'VAN'],
    permitNumber: 'SCT-CDMX-00891-2023',
    preferredClients: ['Walmart de México', 'Soriana'],
    notes: 'Proveedor certificado 3PL. Maneja carga refrigerada para perecederos.',
    createdAt: '2024-03-08T10:15:00Z',
    updatedAt: '2025-09-12T11:00:00Z',
    createdBy: 'admin',
    updatedBy: 'admin',
  },
  {
    id: 'car-003',
    businessName: 'Distribuciones Toluca Express S.A. de C.V.',
    tradeName: 'Toluca Express',
    rfc: 'DTE120501FG9',
    carrierType: 'OWN_TRANSPORT',
    status: 'SUSPENDED',
    contactName: 'Miguel Ángel Torres',
    phone: '7221098765',
    email: 'mtorres@tolucaexpress.com',
    serviceType: 'LAST_MILE',
    coverage: 'Estado de México y Toluca metropolitana',
    coverageRegions: ['MEX'],
    supportedVehicleTypes: ['RABON', 'TORTON', 'VAN'],
    notes: 'Suspendido por incumplimiento de tiempo de entrega. Revisión pendiente con gerencia.',
    createdAt: '2024-06-20T08:00:00Z',
    updatedAt: '2026-02-14T16:45:00Z',
    createdBy: 'jperez',
    updatedBy: 'supervisor01',
  },
];

// ─── Mapeos de Vehículos ──────────────────────────────────────────────────────
const VEHICLE_MAP_FE_TO_BE: Record<string, string> = {
  DRY_BOX: 'CAJA_SECA',
  REFRIGERATED_BOX: 'CAJA_REFRIGERADA',
  FLATBED: 'PLATAFORMA',
  TORTON: 'TORTON',
  RABON: 'RABON',
  TRACTOR_TRAILER: 'TRACTOCAMION',
  VAN: 'VAN',
  MOTORCYCLE: 'MOTOCICLETA'
};

const VEHICLE_MAP_BE_TO_FE: Record<string, string> = {
  CAJA_SECA: 'DRY_BOX',
  CAJA_REFRIGERADA: 'REFRIGERATED_BOX',
  REFRIGERADA: 'REFRIGERATED_BOX',
  PLATAFORMA: 'FLATBED',
  TORTON: 'TORTON',
  RABON: 'RABON',
  TRACTOCAMION: 'TRACTOR_TRAILER',
  VAN: 'VAN',
  MOTOCICLETA: 'MOTORCYCLE'
};

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable({
  providedIn: 'root'
})
export class CarrierService {
  private readonly http = inject(HttpClient);

  /**
   * URL base del recurso carriers.
   */
  private readonly API_URL = `${environment.apiBaseUrl}/api/v1/carriers`;

  /**
   * Cambia a false cuando el backend esté disponible.
   */
  private readonly USE_MOCK = false;

  // ─── Estado reactivo (Signals) ──────────────────────────────────────────────

  /** Lista de transportistas cargados (página actual). */
  readonly carriers = signal<Carrier[]>([]);

  /** Indica si hay una operación de carga en curso. */
  readonly loading = signal<boolean>(false);

  /** Mensaje de error al cargar la lista (null si no hay error). */
  readonly loadError = signal<string | null>(null);

  /** Indica si hay una operación de guardado en curso. */
  readonly saving = signal<boolean>(false);

  // ── Paginación ──────────────────────────────────────────────────────────────

  /** Total de registros en el servidor (para paginación). */
  readonly totalCount = signal<number>(0);

  /** Página actual (0-indexed internamente; ajustar al integrar backend). */
  readonly currentPage = signal<number>(0);

  /** Registros por página. */
  readonly pageSize = signal<number>(20);

  /** Total de páginas calculado. */
  readonly totalPages = computed(() =>
    Math.ceil(this.totalCount() / this.pageSize())
  );

  // ── Contadores de estado (computed) ─────────────────────────────────────────

  /** Total de transportistas en la lista actual. */
  readonly totalInList = computed(() => this.carriers().length);

  /** Transportistas activos. */
  readonly activeCount = computed(() =>
    this.carriers().filter(c => c.status === 'ACTIVE').length
  );

  /** Transportistas suspendidos. */
  readonly suspendedCount = computed(() =>
    this.carriers().filter(c => c.status === 'SUSPENDED').length
  );

  /** Transportistas inactivos. */
  readonly inactiveCount = computed(() =>
    this.carriers().filter(c => c.status === 'INACTIVE').length
  );

  // ─── Métodos Auxiliares de Mapeo ─────────────────────────────────────────────

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

  private mapDtoToItem(dto: any): Carrier {
    return {
      id: dto.id,
      businessName: dto.name,
      tradeName: dto.tradeName,
      rfc: dto.taxId,
      carrierType: dto.carrierType as any,
      status: dto.status as any,
      contactName: dto.contactName,
      phone: dto.contactPhone,
      email: dto.contactEmail,
      serviceType: dto.serviceType as any,
      coverage: dto.geographicCoverage || '',
      supportedVehicleTypes: (dto.vehicleTypes || []).map((vt: string) => VEHICLE_MAP_BE_TO_FE[vt] || vt),
      permitNumber: dto.permitNumber || '',
      preferredClients: (dto.preferredClients || []).map((c: any) => c.name),
      notes: dto.notes || '',
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt,
      createdBy: 'system',
      updatedBy: 'system',
      version: dto.version
    };
  }

  private mapAuditDtoToEntry(dto: any): CarrierAuditEntry {
    const details: CarrierAuditDetail[] = (dto.details || []).map((d: any) => ({
      fieldName: d.fieldName,
      oldValue: d.oldValue,
      newValue: d.newValue
    }));

    const beforeCarrier = dto.beforeState ? {
      id: dto.beforeState.id,
      businessName: dto.beforeState.name,
      tradeName: dto.beforeState.tradeName,
      rfc: dto.beforeState.taxId,
      status: dto.beforeState.status,
      contactName: dto.beforeState.contactName,
      phone: dto.beforeState.contactPhone,
      email: dto.beforeState.contactEmail,
      coverage: dto.beforeState.geographicCoverage,
      notes: dto.beforeState.notes
    } : undefined;

    const afterCarrier = dto.afterState ? {
      id: dto.afterState.id,
      businessName: dto.afterState.name,
      tradeName: dto.afterState.tradeName,
      rfc: dto.afterState.taxId,
      status: dto.afterState.status,
      contactName: dto.afterState.contactName,
      phone: dto.afterState.contactPhone,
      email: dto.afterState.contactEmail,
      coverage: dto.afterState.geographicCoverage,
      notes: dto.afterState.notes
    } : undefined;

    return {
      id: dto.logId || `log-${Date.now()}`,
      carrierId: dto.afterState?.id || dto.beforeState?.id || '',
      action: dto.action,
      performedBy: dto.username,
      performedByFullName: dto.username,
      performedAt: dto.createdAt,
      previousValues: beforeCarrier as any,
      newValues: afterCarrier as any,
      details: details,
      summary: this.getAuditSummary(dto, details)
    };
  }

  private getAuditSummary(dto: any, details?: CarrierAuditDetail[]): string {
    if (dto.action === 'CARRIER_CREATED') {
      const name = dto.afterState?.tradeName || dto.afterState?.name || '';
      return `Registró el transportista ${name ? '"' + name + '"' : ''}`;
    }
    
    if (dto.action === 'CARRIER_STATUS_UPDATED') {
      const statusDetail = details?.find(d => d.fieldName === 'status');
      const reasonDetail = details?.find(d => d.fieldName === 'reason');
      
      const newStatus = statusDetail?.newValue || dto.afterState?.status || '';
      const oldStatus = statusDetail?.oldValue || dto.beforeState?.status || '';
      const reason = reasonDetail?.newValue;

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

    if (dto.action === 'CARRIER_UPDATED') {
      return 'Actualizó la información del transportista';
    }

    if (dto.action === 'CARRIER_DELETED') {
      return 'Eliminó el transportista';
    }

    return dto.action;
  }

  // ─── Métodos de lectura ──────────────────────────────────────────────────────

  /**
   * Carga la lista de transportistas con filtros, paginación y ordenamiento opcionales.
   */
  loadCarriers(params?: CarrierListParams): Observable<CarrierApiResponse<Carrier[]>> {
    this.loading.set(true);
    this.loadError.set(null);

    if (this.USE_MOCK) {
      return of({ success: true, message: '', data: [], timestamp: '' });
    }

    const orgId = this.getSessionOrgId();
    const httpParams = new HttpParams().set('organizationId', orgId);

    return this.http.get<CarrierApiResponse<any[]>>(this.API_URL, { params: httpParams }).pipe(
      map(res => {
        const mappedData = (res.data || []).map(dto => this.mapDtoToItem(dto));
        return {
          ...res,
          data: mappedData
        };
      }),
      tap(res => {
        this.carriers.set(res.data);
        this.totalCount.set(res.data.length);
        this.loading.set(false);
      }),
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Obtiene un transportista por su ID.
   * GET /api/v1/carriers/{id}
   */
  getCarrierById(id: string): Observable<CarrierApiResponse<Carrier>> {
    if (this.USE_MOCK) {
      return throwError(() => new Error('Mock no habilitado'));
    }
    return this.http.get<CarrierApiResponse<any>>(`${this.API_URL}/${id}`).pipe(
      map(res => ({
        ...res,
        data: this.mapDtoToItem(res.data)
      })),
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Obtiene el historial de auditoría de un transportista como línea de tiempo.
   * GET /api/v1/carriers/{id}/audit
   */
  getCarrierAudit(id: string): Observable<CarrierApiResponse<CarrierAuditEntry[]>> {
    if (this.USE_MOCK) {
      return of({ success: true, message: '', data: [], timestamp: '' });
    }
    return this.http.get<CarrierApiResponse<any[]>>(`${this.API_URL}/${id}/audit`).pipe(
      map(res => {
        const mappedData = (res.data || []).map(dto => this.mapAuditDtoToEntry(dto));
        return {
          ...res,
          data: mappedData
        };
      }),
      tap(res => {
        // Enriquecer entradas con iconos y colores si el backend no los envía
        res.data.forEach(entry => {
          if (!entry.timelineIcon) {
            entry.timelineIcon = AUDIT_ACTION_ICONS[entry.action] || 'info';
          }
          if (!entry.timelineColor) {
            entry.timelineColor = AUDIT_ACTION_COLORS[entry.action] || 'update';
          }
        });
      }),
      catchError(err => this.handleError(err))
    );
  }

  // ─── Métodos de escritura ────────────────────────────────────────────────────

  /**
   * Crea un nuevo transportista.
   * POST /api/v1/carriers
   */
  createCarrier(dto: CreateCarrierRequest): Observable<CarrierApiResponse<Carrier>> {
    this.saving.set(true);

    if (this.USE_MOCK) {
      return throwError(() => new Error('Mock no habilitado'));
    }

    const orgId = this.getSessionOrgId();
    const payload = {
      organizationId: orgId,
      name: dto.businessName,
      tradeName: dto.tradeName,
      taxId: dto.rfc,
      carrierType: dto.carrierType,
      contactName: dto.contactName,
      contactPhone: dto.phone,
      contactEmail: dto.email,
      serviceType: dto.serviceType,
      permitNumber: dto.permitNumber || null,
      geographicCoverage: dto.coverage,
      notes: dto.notes || null,
      vehicleTypes: (dto.supportedVehicleTypes || []).map(vt => VEHICLE_MAP_FE_TO_BE[vt] || vt),
      preferredClientIds: []
    };

    return this.http.post<CarrierApiResponse<any>>(this.API_URL, payload).pipe(
      map(res => ({
        ...res,
        data: this.mapDtoToItem(res.data)
      })),
      tap(res => {
        this.carriers.update(list => [...list, res.data]);
        this.totalCount.update(n => n + 1);
        this.saving.set(false);
      }),
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Actualiza un transportista existente.
   * PUT /api/v1/carriers
   */
  updateCarrier(id: string, dto: UpdateCarrierRequest): Observable<CarrierApiResponse<Carrier>> {
    this.saving.set(true);

    if (this.USE_MOCK) {
      return throwError(() => new Error('Mock no habilitado'));
    }

    const orgId = this.getSessionOrgId();
    const existing = this.carriers().find(c => c.id === id);
    const currentVersion = existing ? existing.version || 1 : 1;

    const payload = {
      id: id,
      organizationId: orgId,
      name: dto.businessName,
      tradeName: dto.tradeName,
      taxId: dto.rfc,
      carrierType: dto.carrierType,
      contactName: dto.contactName,
      contactPhone: dto.phone,
      contactEmail: dto.email,
      serviceType: dto.serviceType,
      permitNumber: dto.permitNumber || null,
      geographicCoverage: dto.coverage,
      notes: dto.notes || null,
      vehicleTypes: (dto.supportedVehicleTypes || []).map(vt => VEHICLE_MAP_FE_TO_BE[vt] || vt),
      preferredClientIds: [],
      status: (dto as any).status || existing?.status || 'ACTIVE',
      version: currentVersion
    };

    return this.http.put<CarrierApiResponse<any>>(this.API_URL, payload).pipe(
      map(res => ({
        ...res,
        data: this.mapDtoToItem(res.data)
      })),
      tap(res => {
        this.carriers.update(list => list.map(c => c.id === id ? res.data : c));
        this.saving.set(false);
      }),
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Cambia el estado de un transportista (Activar / Suspender / Desactivar).
   * PATCH /api/v1/carriers/{id}/status
   *
   * El motivo es obligatorio para SUSPENDED e INACTIVE.
   * El backend valida y genera auditoría transaccional.
   */
  changeCarrierStatus(id: string, dto: CarrierStatusChangeRequest): Observable<CarrierApiResponse<Carrier>> {
    this.saving.set(true);

    if (this.USE_MOCK) {
      return throwError(() => new Error('Mock no habilitado'));
    }

    const payload = {
      status: dto.status,
      reason: dto.reason,
      observations: dto.observations || dto.notes || null
    };

    return this.http.patch<CarrierApiResponse<any>>(`${this.API_URL}/${id}/status`, payload).pipe(
      map(res => ({
        ...res,
        data: this.mapDtoToItem(res.data)
      })),
      tap(res => {
        this.carriers.update(list => list.map(c => c.id === id ? res.data : c));
        this.saving.set(false);
      }),
      catchError(err => this.handleError(err))
    );
  }

  // ─── Manejo centralizado de errores ─────────────────────────────────────────

  /**
   * Manejador centralizado de errores HTTP.
   * El interceptor JWT ya maneja el 401 (redirige al login).
   * Este método resetea el estado de carga y propaga el error tipado al componente.
   *
   * Errores que el componente debe manejar:
   *  - 400: Validación fallida (RFC formato inválido, campos requeridos, etc.)
   *  - 404: Transportista no encontrado
   *  - 409: Duplicado — RFC o Razón Social ya registrada
   *  - 409 / optimistic lock: Registro modificado por otro usuario simultáneamente
   *  - 500: Error interno del servidor
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    this.loading.set(false);
    this.saving.set(false);
    return throwError(() => error);
  }
}
