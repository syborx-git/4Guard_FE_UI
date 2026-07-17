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
import { catchError, tap, delay } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  Carrier,
  CarrierApiResponse,
  CarrierAuditEntry,
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
    statusChangedAt: '2026-02-14T16:45:00Z',
    statusChangedBy: 'supervisor01',
    statusChangeReason: 'Incumplimiento reiterado de ventanas horarias acordadas.',
  },
  {
    id: 'car-004',
    businessName: 'Paquetería Rápido Mx S.A. de C.V.',
    tradeName: 'RápidoMx',
    rfc: 'PRM180904HJ3',
    carrierType: 'PARCEL',
    status: 'INACTIVE',
    contactName: 'Claudia Reyes',
    phone: '5598765432',
    email: 'claudia.reyes@rapidomx.com.mx',
    serviceType: 'PARCEL',
    coverage: 'Nacional (cobertura limitada zonas rurales)',
    coverageRegions: ['NAC'],
    supportedVehicleTypes: ['VAN', 'MOTORCYCLE'],
    permitNumber: 'SCT-NAC-04412-2021',
    notes: 'Contrato terminado. Se mantiene registro histórico para trazabilidad de embarques pasados.',
    createdAt: '2024-08-11T13:00:00Z',
    updatedAt: '2025-12-31T23:59:00Z',
    createdBy: 'admin',
    updatedBy: 'admin',
    statusChangedAt: '2025-12-31T23:59:00Z',
    statusChangedBy: 'admin',
    statusChangeReason: 'Contrato no renovado. Proveedor dejó de operar en la región.',
  },
  {
    id: 'car-005',
    businessName: 'Trans-Client Lala Distribución',
    tradeName: 'Lala Trans',
    rfc: 'TCL950630KM7',
    carrierType: 'CLIENT_TRANSPORT',
    status: 'ACTIVE',
    contactName: 'Fernando Ibarra',
    phone: '8441234321',
    email: 'fibarra@lala.com.mx',
    serviceType: 'DEDICATED',
    coverage: 'Rutas dedicadas Norte y Bajío (Torreón - GDL - QRO)',
    coverageRegions: ['COAH', 'JAL', 'QRO', 'AGS'],
    supportedVehicleTypes: ['REFRIGERATED_BOX', 'DRY_BOX', 'TRACTOR_TRAILER'],
    permitNumber: 'SCT-COAH-00155-2020',
    preferredClients: ['Lala S.A.'],
    notes: 'Transporte propio del cliente Lala. Opera bajo instrucciones directas del cliente.',
    createdAt: '2024-09-01T07:30:00Z',
    updatedAt: '2026-05-10T09:00:00Z',
    createdBy: 'admin',
    updatedBy: 'jperez',
  },
];

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable({
  providedIn: 'root'
})
export class CarrierService {
  private readonly http = inject(HttpClient);

  /**
   * URL base del recurso carriers.
   * TODO: Ajustar según contrato real del Swagger del backend.
   */
  private readonly API_URL = `${environment.apiBaseUrl}/api/v1/carriers`;

  /**
   * Cambia a false cuando el backend esté disponible.
   * Con true: filtrado, paginación y ordenamiento se realizan localmente.
   * Con false: se delegan al servidor mediante query params.
   */
  private readonly USE_MOCK = true;

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

  // ─── Métodos de lectura ──────────────────────────────────────────────────────

  /**
   * Carga la lista de transportistas con filtros, paginación y ordenamiento opcionales.
   *
   * Con USE_MOCK = true: filtrado/paginación local, simula latencia de red.
   * Con USE_MOCK = false: delega al servidor mediante query params.
   *
   * La búsqueda por `search` incluye:
   *  - Razón social (businessName)
   *  - Nombre comercial (tradeName)
   *  - RFC
   *  - Nombre del contacto (contactName)
   *  - Teléfono (phone)
   *  - Correo electrónico (email)
   */
  loadCarriers(params?: CarrierListParams): Observable<CarrierApiResponse<Carrier[]>> {
    this.loading.set(true);
    this.loadError.set(null);

    if (this.USE_MOCK) {
      // Filtrado local del mock
      let result = [...MOCK_CARRIERS];
      const search = params?.search?.toLowerCase().trim();

      if (search) {
        result = result.filter(c =>
          c.tradeName.toLowerCase().includes(search)      ||
          c.businessName.toLowerCase().includes(search)   ||
          c.rfc.toLowerCase().includes(search)            ||
          c.contactName.toLowerCase().includes(search)    ||
          c.phone.replace(/\D/g, '').includes(search.replace(/\D/g, '')) ||
          c.email.toLowerCase().includes(search)
        );
      }

      if (params?.status) {
        result = result.filter(c => c.status === params.status);
      }

      if (params?.carrierType) {
        result = result.filter(c => c.carrierType === params.carrierType);
      }

      // Ordenamiento local
      if (params?.sort) {
        const { field, direction } = params.sort;
        result.sort((a, b) => {
          const va = String(a[field] ?? '');
          const vb = String(b[field] ?? '');
          return direction === 'ASC' ? va.localeCompare(vb) : vb.localeCompare(va);
        });
      }

      // Paginación local
      const page = params?.pagination?.page ?? 0;
      const size = params?.pagination?.size ?? 20;
      this.totalCount.set(result.length);
      const paginated = result.slice(page * size, page * size + size);

      const mockResponse: CarrierApiResponse<Carrier[]> = {
        success: true,
        message: 'Transportistas cargados correctamente (mock).',
        data: paginated,
        timestamp: new Date().toISOString(),
      };

      return of(mockResponse).pipe(
        delay(550),
        tap(res => {
          this.carriers.set(res.data);
          this.loading.set(false);
        }),
        catchError(err => this.handleError(err))
      );
    }

    // ── Modo servidor ──────────────────────────────────────────────────────────
    // TODO: Verificar y ajustar nombres de query params según Swagger del backend.
    const httpParams = this.buildHttpParams(params);
    return this.http.get<CarrierApiResponse<Carrier[]>>(this.API_URL, { params: httpParams }).pipe(
      tap(res => {
        this.carriers.set(res.data);
        this.loading.set(false);
        // TODO: Si el backend retorna paginación en res.data o en headers, extraer aquí:
        // this.totalCount.set(res.totalCount ?? res.data.length);
      }),
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Construye los HttpParams para la petición al servidor.
   * TODO: Ajustar los nombres de los parámetros según el Swagger real del backend.
   */
  private buildHttpParams(params?: CarrierListParams): HttpParams {
    let hp = new HttpParams();
    if (params?.search)                    hp = hp.set('search',    params.search);
    if (params?.status)                    hp = hp.set('status',    params.status);
    if (params?.carrierType)               hp = hp.set('type',      params.carrierType);
    if (params?.pagination?.page != null)  hp = hp.set('page',      String(params.pagination.page));
    if (params?.pagination?.size)          hp = hp.set('size',      String(params.pagination.size));
    if (params?.sort?.field)               hp = hp.set('sortBy',    params.sort.field);
    if (params?.sort?.direction)           hp = hp.set('sortDir',   params.sort.direction);
    return hp;
  }

  /**
   * Obtiene un transportista por su ID.
   * GET /api/v1/carriers/{id}
   */
  getCarrierById(id: string): Observable<CarrierApiResponse<Carrier>> {
    if (this.USE_MOCK) {
      const found = MOCK_CARRIERS.find(c => c.id === id);
      if (found) {
        return of({ success: true, message: '', data: found, timestamp: new Date().toISOString() }).pipe(delay(200));
      }
      return throwError(() => ({ status: 404, error: { message: 'Transportista no encontrado.' } }));
    }
    return this.http.get<CarrierApiResponse<Carrier>>(`${this.API_URL}/${id}`).pipe(
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Obtiene el historial de auditoría de un transportista como línea de tiempo.
   * GET /api/v1/carriers/{id}/audit
   *
   * La respuesta se enriquece con iconos y colores para la visualización
   * en línea de tiempo si el backend no los provee.
   *
   * Preparado para integración futura — botón "Ver historial" en el componente.
   */
  getCarrierAudit(id: string): Observable<CarrierApiResponse<CarrierAuditEntry[]>> {
    if (this.USE_MOCK) {
      // TODO: Reemplazar con datos mock representativos cuando se implemente la UI de timeline.
      return of({ success: true, message: '', data: [], timestamp: new Date().toISOString() }).pipe(delay(300));
    }
    return this.http.get<CarrierApiResponse<CarrierAuditEntry[]>>(`${this.API_URL}/${id}/audit`).pipe(
      tap(res => {
        // Enriquecer entradas con iconos y colores si el backend no los envía
        res.data.forEach(entry => {
          if (!entry.timelineIcon) {
            entry.timelineIcon = AUDIT_ACTION_ICONS[entry.action];
          }
          if (!entry.timelineColor) {
            entry.timelineColor = AUDIT_ACTION_COLORS[entry.action];
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
   *
   * El backend ejecuta en una sola transacción:
   *  1. Guarda el transportista
   *  2. Genera el registro de auditoría
   *  3. Confirma (o rollback si falla algún paso)
   */
  createCarrier(dto: CreateCarrierRequest): Observable<CarrierApiResponse<Carrier>> {
    this.saving.set(true);

    if (this.USE_MOCK) {
      const newCarrier: Carrier = {
        ...dto,
        id: `car-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'current-user', // TODO: Obtener de AuthService.getCurrentUser()
        updatedBy: 'current-user',
      };
      MOCK_CARRIERS.push(newCarrier);
      const res: CarrierApiResponse<Carrier> = {
        success: true,
        message: 'Transportista creado correctamente.',
        data: newCarrier,
        timestamp: new Date().toISOString(),
      };
      return of(res).pipe(
        delay(700),
        tap(() => {
          this.carriers.update(list => [...list, newCarrier]);
          this.totalCount.update(n => n + 1);
          this.saving.set(false);
        }),
        catchError(err => this.handleError(err))
      );
    }

    return this.http.post<CarrierApiResponse<Carrier>>(this.API_URL, dto).pipe(
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
   * PUT /api/v1/carriers/{id}
   */
  updateCarrier(id: string, dto: UpdateCarrierRequest): Observable<CarrierApiResponse<Carrier>> {
    this.saving.set(true);

    if (this.USE_MOCK) {
      const idx = MOCK_CARRIERS.findIndex(c => c.id === id);
      if (idx === -1) {
        return throwError(() => ({ status: 404, error: { message: 'Transportista no encontrado.' } }));
      }
      const updated: Carrier = {
        ...MOCK_CARRIERS[idx],
        ...dto,
        id,
        updatedAt: new Date().toISOString(),
        updatedBy: 'current-user',
      };
      MOCK_CARRIERS[idx] = updated;
      const res: CarrierApiResponse<Carrier> = {
        success: true,
        message: 'Transportista actualizado correctamente.',
        data: updated,
        timestamp: new Date().toISOString(),
      };
      return of(res).pipe(
        delay(700),
        tap(() => {
          this.carriers.update(list => list.map(c => c.id === id ? updated : c));
          this.saving.set(false);
        }),
        catchError(err => this.handleError(err))
      );
    }

    return this.http.put<CarrierApiResponse<Carrier>>(`${this.API_URL}/${id}`, dto).pipe(
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
      const idx = MOCK_CARRIERS.findIndex(c => c.id === id);
      if (idx === -1) {
        return throwError(() => ({ status: 404, error: { message: 'Transportista no encontrado.' } }));
      }
      const updated: Carrier = {
        ...MOCK_CARRIERS[idx],
        status: dto.status,
        updatedAt: new Date().toISOString(),
        updatedBy: 'current-user',
        statusChangedAt: new Date().toISOString(),
        statusChangedBy: 'current-user',
        statusChangeReason: dto.reason,
      };
      MOCK_CARRIERS[idx] = updated;
      const res: CarrierApiResponse<Carrier> = {
        success: true,
        message: `Estado actualizado a ${dto.status}.`,
        data: updated,
        timestamp: new Date().toISOString(),
      };
      return of(res).pipe(
        delay(550),
        tap(() => {
          this.carriers.update(list => list.map(c => c.id === id ? updated : c));
          this.saving.set(false);
        }),
        catchError(err => this.handleError(err))
      );
    }

    return this.http.patch<CarrierApiResponse<Carrier>>(`${this.API_URL}/${id}/status`, dto).pipe(
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
