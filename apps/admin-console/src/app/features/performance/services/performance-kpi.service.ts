/**
 * @file performance-kpi.service.ts
 * @description Servicio de Gestión de KPIs de Rendimiento (HU-138) — 4GUARD WMS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Responsabilidades
 * ═══════════════════════════════════════════════════════════════════════════
 *  - Centralizar llamadas HTTP al recurso /api/performance-kpis
 *  - Exponer estado reactivo mediante Angular Signals
 *  - Calcular el status de cada KPI en base a currentValue + evaluationType + thresholds
 *  - Contener datos mock mientras el backend no esté disponible
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ENDPOINTS (ajustar según Swagger real del backend)
 * ═══════════════════════════════════════════════════════════════════════════
 *  GET    /api/performance-kpis              — Listar
 *  POST   /api/performance-kpis              — Crear
 *  PUT    /api/performance-kpis/{id}         — Actualizar
 *  DELETE /api/performance-kpis/{id}         — Desactivar (lógico)
 *  GET    /api/performance-kpis/{id}/audit   — Historial de auditoría
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTA DE AUDITORÍA
 * ═══════════════════════════════════════════════════════════════════════════
 *  El frontend NO genera registros de auditoría directamente.
 *  El backend ejecuta en una sola transacción: guardar + auditoría.
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap, delay } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  PerformanceKpi,
  KpiApiResponse,
  KpiListParams,
  KpiStatus,
  KpiThresholds,
  CreateKpiRequest,
  UpdateKpiRequest,
  EvaluationType,
} from '../models/performance-kpi.model';

// ─── Datos Mock ───────────────────────────────────────────────────────────────
// TODO: Eliminar este bloque cuando el backend de /api/performance-kpis esté disponible.

const MOCK_KPIS: PerformanceKpi[] = [
  {
    id: 'kpi-001',
    name: 'Tiempo de descarga',
    description: 'Tiempo promedio desde la llegada del camión hasta que se completa la descarga total de mercancía en el andén de recepción.',
    module: 'RECEIVING',
    unit: 'MINUTES',
    evaluationType: 'LOWER_IS_BETTER',
    thresholds: { target: 45, warning: 60, critical: 90 },
    currentValue: 38,
    lastMeasuredAt: '2026-07-20T14:30:00Z',
    status: 'OPTIMAL',
    sourceConfig: {
      sourceProcess: 'Recepción',
      startEvent: 'Llegada del camión',
      endEvent: 'Fin de descarga',
      frequencyValue: 5,
      frequencyUnit: 'MINUTES',
      active: true,
    },
    isEnabled: true,
    createdAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-07-20T14:30:00Z',
    createdBy: 'admin',
    updatedBy: 'jperez',
  },
  {
    id: 'kpi-002',
    name: 'Exactitud de inventario',
    description: 'Porcentaje de coincidencia entre el inventario físico y el registrado en el sistema WMS. Mide la precisión del control de existencias.',
    module: 'INVENTORY',
    unit: 'PERCENTAGE',
    evaluationType: 'HIGHER_IS_BETTER',
    thresholds: { target: 99, warning: 95, critical: 90 },
    currentValue: 96.2,
    lastMeasuredAt: '2026-07-20T12:00:00Z',
    status: 'WARNING',
    sourceConfig: {
      sourceProcess: 'Inventario cíclico',
      startEvent: 'Inicio de conteo cíclico',
      endEvent: 'Cierre de conteo cíclico',
      frequencyValue: 1,
      frequencyUnit: 'HOURS',
      active: true,
    },
    isEnabled: true,
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-07-20T12:00:00Z',
    createdBy: 'admin',
    updatedBy: 'admin',
  },
  {
    id: 'kpi-003',
    name: 'Ocupación del almacén',
    description: 'Porcentaje de ubicaciones ocupadas respecto al total de ubicaciones disponibles. El rango ideal evita tanto la subutilización como la saturación.',
    module: 'INVENTORY',
    unit: 'PERCENTAGE',
    evaluationType: 'RANGE',
    thresholds: { target: 0, warning: 10, critical: 20, rangeLow: 60, rangeHigh: 85 },
    currentValue: 72,
    lastMeasuredAt: '2026-07-20T13:00:00Z',
    status: 'OPTIMAL',
    sourceConfig: {
      sourceProcess: 'Gestión de ubicaciones',
      startEvent: 'Cálculo de ocupación',
      endEvent: 'Reporte de ocupación',
      frequencyValue: 30,
      frequencyUnit: 'MINUTES',
      active: true,
    },
    isEnabled: true,
    createdAt: '2026-02-15T08:00:00Z',
    updatedAt: '2026-07-20T13:00:00Z',
    createdBy: 'admin',
    updatedBy: 'supervisor01',
  },
  {
    id: 'kpi-004',
    name: 'Productividad de picking',
    description: 'Cantidad de unidades o líneas procesadas por hora por operador durante la operación de picking.',
    module: 'PICKING',
    unit: 'UNITS_PER_HOUR',
    evaluationType: 'HIGHER_IS_BETTER',
    thresholds: { target: 120, warning: 90, critical: 60 },
    currentValue: 115,
    lastMeasuredAt: '2026-07-20T15:00:00Z',
    status: 'OPTIMAL',
    sourceConfig: {
      sourceProcess: 'Picking',
      startEvent: 'Asignación de tarea de picking',
      endEvent: 'Confirmación de picking completo',
      frequencyValue: 15,
      frequencyUnit: 'MINUTES',
      active: true,
    },
    isEnabled: true,
    createdAt: '2026-03-10T07:00:00Z',
    updatedAt: '2026-07-20T15:00:00Z',
    createdBy: 'admin',
    updatedBy: 'jperez',
  },
  {
    id: 'kpi-005',
    name: 'Tiempo de embarque',
    description: 'Tiempo promedio desde el inicio de la carga del camión hasta el cierre del embarque y la liberación del andén.',
    module: 'SHIPPING',
    unit: 'MINUTES',
    evaluationType: 'LOWER_IS_BETTER',
    thresholds: { target: 30, warning: 50, critical: 75 },
    currentValue: 82,
    lastMeasuredAt: '2026-07-20T16:00:00Z',
    status: 'CRITICAL',
    sourceConfig: {
      sourceProcess: 'Embarques',
      startEvent: 'Inicio de carga',
      endEvent: 'Cierre de embarque',
      frequencyValue: 10,
      frequencyUnit: 'MINUTES',
      active: true,
    },
    isEnabled: true,
    createdAt: '2026-04-05T11:00:00Z',
    updatedAt: '2026-07-20T16:00:00Z',
    createdBy: 'jperez',
    updatedBy: 'jperez',
  },
  {
    id: 'kpi-006',
    name: 'Puntualidad de transportistas',
    description: 'Porcentaje de transportistas que llegan dentro de la ventana horaria programada respecto al total de citas agendadas.',
    module: 'CARRIERS',
    unit: 'PERCENTAGE',
    evaluationType: 'HIGHER_IS_BETTER',
    thresholds: { target: 95, warning: 85, critical: 70 },
    currentValue: 83,
    lastMeasuredAt: '2026-07-20T14:00:00Z',
    status: 'WARNING',
    sourceConfig: {
      sourceProcess: 'Control de citas',
      startEvent: 'Hora programada de cita',
      endEvent: 'Check-in real del transportista',
      frequencyValue: 1,
      frequencyUnit: 'HOURS',
      active: true,
    },
    isEnabled: true,
    createdAt: '2026-05-01T09:00:00Z',
    updatedAt: '2026-07-20T14:00:00Z',
    createdBy: 'admin',
    updatedBy: 'supervisor01',
  },
];

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable({
  providedIn: 'root'
})
export class PerformanceKpiService {
  private readonly http = inject(HttpClient);

  /**
   * URL base del recurso.
   * TODO: Ajustar según contrato real del Swagger del backend.
   */
  private readonly API_URL = `${environment.apiBaseUrl}/api/performance-kpis`;

  /**
   * Cambia a false cuando el backend esté disponible.
   */
  private readonly USE_MOCK = true;

  // ─── Estado reactivo (Signals) ──────────────────────────────────────────────

  readonly kpis = signal<PerformanceKpi[]>([]);
  readonly loading = signal<boolean>(false);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal<boolean>(false);
  readonly totalCount = signal<number>(0);

  // ── Contadores de estado (computed) ─────────────────────────────────────────

  readonly enabledKpis = computed(() =>
    this.kpis().filter(k => k.isEnabled)
  );

  readonly optimalCount = computed(() =>
    this.enabledKpis().filter(k => k.status === 'OPTIMAL').length
  );

  readonly warningCount = computed(() =>
    this.enabledKpis().filter(k => k.status === 'WARNING').length
  );

  readonly criticalCount = computed(() =>
    this.enabledKpis().filter(k => k.status === 'CRITICAL').length
  );

  readonly totalEnabled = computed(() =>
    this.enabledKpis().length
  );

  // ─── Cálculo de estado ──────────────────────────────────────────────────────

  /**
   * Calcula el estado de un KPI basándose en su valor actual, tipo de evaluación
   * y umbrales configurados.
   */
  calculateStatus(
    currentValue: number | null,
    evaluationType: EvaluationType,
    thresholds: KpiThresholds
  ): KpiStatus {
    if (currentValue === null || currentValue === undefined) {
      return 'NO_DATA';
    }

    switch (evaluationType) {
      case 'HIGHER_IS_BETTER':
        // target=99, warning=95, critical=90 → value >= 99 → OPTIMAL
        if (currentValue >= thresholds.target)  return 'OPTIMAL';
        if (currentValue >= thresholds.warning) return 'WARNING';
        return 'CRITICAL';

      case 'LOWER_IS_BETTER':
        // target=45, warning=60, critical=90 → value <= 45 → OPTIMAL
        if (currentValue <= thresholds.target)  return 'OPTIMAL';
        if (currentValue <= thresholds.warning) return 'WARNING';
        return 'CRITICAL';

      case 'RANGE':
        // rangeLow=60, rangeHigh=85, warning=10, critical=20
        // Dentro de [60, 85] → OPTIMAL
        // Distancia del rango <= warning (10) → WARNING
        // Distancia del rango > warning → CRITICAL
        if (thresholds.rangeLow != null && thresholds.rangeHigh != null) {
          if (currentValue >= thresholds.rangeLow && currentValue <= thresholds.rangeHigh) {
            return 'OPTIMAL';
          }
          const distanceFromRange = currentValue < thresholds.rangeLow
            ? thresholds.rangeLow - currentValue
            : currentValue - thresholds.rangeHigh;

          if (distanceFromRange <= thresholds.warning) return 'WARNING';
          return 'CRITICAL';
        }
        return 'NO_DATA';

      default:
        return 'NO_DATA';
    }
  }

  // ─── Métodos de lectura ──────────────────────────────────────────────────────

  /**
   * Carga la lista de KPIs.
   * TODO: Integrar GET /api/performance-kpis
   */
  loadKpis(params?: KpiListParams): Observable<KpiApiResponse<PerformanceKpi[]>> {
    this.loading.set(true);
    this.loadError.set(null);

    if (this.USE_MOCK) {
      let result = [...MOCK_KPIS];

      // Filtrar desactivados por defecto
      if (!params?.includeDisabled) {
        result = result.filter(k => k.isEnabled);
      }

      const search = params?.search?.toLowerCase().trim();
      if (search) {
        result = result.filter(k =>
          k.name.toLowerCase().includes(search) ||
          k.description.toLowerCase().includes(search) ||
          k.sourceConfig.sourceProcess.toLowerCase().includes(search)
        );
      }

      if (params?.module) {
        result = result.filter(k => k.module === params.module);
      }

      if (params?.status) {
        result = result.filter(k => k.status === params.status);
      }

      // Recalcular estado de cada KPI
      result = result.map(k => ({
        ...k,
        status: this.calculateStatus(k.currentValue, k.evaluationType, k.thresholds),
      }));

      const mockResponse: KpiApiResponse<PerformanceKpi[]> = {
        success: true,
        message: 'KPIs cargados correctamente (mock).',
        data: result,
        timestamp: new Date().toISOString(),
      };

      return of(mockResponse).pipe(
        delay(500),
        tap(res => {
          this.kpis.set(res.data);
          this.totalCount.set(res.data.length);
          this.loading.set(false);
        }),
        catchError(err => this.handleError(err))
      );
    }

    // TODO: Integrar GET /api/performance-kpis
    return this.http.get<KpiApiResponse<PerformanceKpi[]>>(this.API_URL).pipe(
      tap(res => {
        this.kpis.set(res.data);
        this.totalCount.set(res.data.length);
        this.loading.set(false);
      }),
      catchError(err => this.handleError(err))
    );
  }

  // ─── Métodos de escritura ────────────────────────────────────────────────────

  /**
   * Crea un nuevo KPI.
   * TODO: Integrar POST /api/performance-kpis
   * TODO: Registrar auditoría (backend transaccional)
   */
  createKpi(dto: CreateKpiRequest): Observable<KpiApiResponse<PerformanceKpi>> {
    this.saving.set(true);

    if (this.USE_MOCK) {
      const newKpi: PerformanceKpi = {
        ...dto,
        id: `kpi-${Date.now()}`,
        currentValue: null,
        lastMeasuredAt: null,
        status: 'NO_DATA',
        isEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'current-user', // TODO: Obtener de AuthService.getCurrentUser()
        updatedBy: 'current-user',
      };
      MOCK_KPIS.push(newKpi);
      const res: KpiApiResponse<PerformanceKpi> = {
        success: true,
        message: 'KPI creado correctamente.',
        data: newKpi,
        timestamp: new Date().toISOString(),
      };
      return of(res).pipe(
        delay(700),
        tap(() => {
          this.kpis.update(list => [...list, newKpi]);
          this.totalCount.update(n => n + 1);
          this.saving.set(false);
        }),
        catchError(err => this.handleError(err))
      );
    }

    // TODO: Integrar POST /api/performance-kpis
    return this.http.post<KpiApiResponse<PerformanceKpi>>(this.API_URL, dto).pipe(
      tap(res => {
        this.kpis.update(list => [...list, res.data]);
        this.totalCount.update(n => n + 1);
        this.saving.set(false);
      }),
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Actualiza un KPI existente.
   * TODO: Integrar PUT /api/performance-kpis/{id}
   * TODO: Registrar auditoría (backend transaccional)
   */
  updateKpi(id: string, dto: UpdateKpiRequest): Observable<KpiApiResponse<PerformanceKpi>> {
    this.saving.set(true);

    if (this.USE_MOCK) {
      const idx = MOCK_KPIS.findIndex(k => k.id === id);
      if (idx === -1) {
        this.saving.set(false);
        return throwError(() => ({ status: 404, error: { message: 'KPI no encontrado.' } }));
      }
      const updated: PerformanceKpi = {
        ...MOCK_KPIS[idx],
        ...dto,
        id,
        status: this.calculateStatus(MOCK_KPIS[idx].currentValue, dto.evaluationType, dto.thresholds),
        updatedAt: new Date().toISOString(),
        updatedBy: 'current-user',
      };
      MOCK_KPIS[idx] = updated;
      const res: KpiApiResponse<PerformanceKpi> = {
        success: true,
        message: 'KPI actualizado correctamente.',
        data: updated,
        timestamp: new Date().toISOString(),
      };
      return of(res).pipe(
        delay(700),
        tap(() => {
          this.kpis.update(list => list.map(k => k.id === id ? updated : k));
          this.saving.set(false);
        }),
        catchError(err => this.handleError(err))
      );
    }

    // TODO: Integrar PUT /api/performance-kpis/{id}
    return this.http.put<KpiApiResponse<PerformanceKpi>>(`${this.API_URL}/${id}`, dto).pipe(
      tap(res => {
        this.kpis.update(list => list.map(k => k.id === id ? res.data : k));
        this.saving.set(false);
      }),
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Desactiva un KPI (eliminación lógica).
   * TODO: Integrar DELETE /api/performance-kpis/{id}
   * TODO: Registrar auditoría (backend transaccional)
   */
  disableKpi(id: string): Observable<KpiApiResponse<PerformanceKpi>> {
    this.saving.set(true);

    if (this.USE_MOCK) {
      const idx = MOCK_KPIS.findIndex(k => k.id === id);
      if (idx === -1) {
        this.saving.set(false);
        return throwError(() => ({ status: 404, error: { message: 'KPI no encontrado.' } }));
      }
      const updated: PerformanceKpi = {
        ...MOCK_KPIS[idx],
        isEnabled: false,
        updatedAt: new Date().toISOString(),
        updatedBy: 'current-user',
      };
      MOCK_KPIS[idx] = updated;
      const res: KpiApiResponse<PerformanceKpi> = {
        success: true,
        message: 'KPI desactivado correctamente.',
        data: updated,
        timestamp: new Date().toISOString(),
      };
      return of(res).pipe(
        delay(550),
        tap(() => {
          this.kpis.update(list => list.filter(k => k.id !== id));
          this.totalCount.update(n => Math.max(0, n - 1));
          this.saving.set(false);
        }),
        catchError(err => this.handleError(err))
      );
    }

    // TODO: Integrar DELETE /api/performance-kpis/{id}
    return this.http.delete<KpiApiResponse<PerformanceKpi>>(`${this.API_URL}/${id}`).pipe(
      tap(res => {
        this.kpis.update(list => list.filter(k => k.id !== id));
        this.totalCount.update(n => Math.max(0, n - 1));
        this.saving.set(false);
      }),
      catchError(err => this.handleError(err))
    );
  }

  // ─── Validación de duplicados ──────────────────────────────────────────────

  /**
   * Verifica si ya existe un KPI con el mismo nombre normalizado
   * dentro del mismo módulo y proceso origen.
   * Permite varios KPIs del mismo proceso siempre que tengan nombres distintos.
   */
  isDuplicate(name: string, module: string, sourceProcess: string, excludeId?: string): boolean {
    const normalizedName = name.trim().toLowerCase();
    const normalizedProcess = sourceProcess.trim().toLowerCase();
    return this.kpis().some(k =>
      k.id !== excludeId &&
      k.isEnabled &&
      k.name.trim().toLowerCase() === normalizedName &&
      k.module === module &&
      k.sourceConfig.sourceProcess.trim().toLowerCase() === normalizedProcess
    );
  }

  // ─── Manejo centralizado de errores ─────────────────────────────────────────

  private handleError(error: HttpErrorResponse): Observable<never> {
    this.loading.set(false);
    this.saving.set(false);
    return throwError(() => error);
  }
}
