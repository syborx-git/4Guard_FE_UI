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
import { catchError, tap, map } from 'rxjs/operators';
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
  ExecutiveKpiData,
  InboundProcessTimesData,
  OperatorProductivityData,
  ShiftProductivityData,
  ProcessFlowTimesData,
  CircuitoDelicadoSummary,
  GateToGateCycleData,
  MovementAuditTimelineItem,
  ExportJobResponse,
  OperationalUserTargets,
  DEFAULT_OPERATIONAL_TARGETS,
} from '../models/performance-kpi.model';

@Injectable({
  providedIn: 'root'
})
export class PerformanceKpiService {
  private readonly http = inject(HttpClient);

  /**
   * URL base del recurso de catálogo de KPIs en el backend WMS.
   */
  private readonly API_URL = `${environment.apiBaseUrl}/api/v1/performance-kpis`;

  /**
   * En modo false intenta conectar al backend primero, con fallback transparente.
   */
  


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
   * Carga la lista de KPIs desde el backend con fallback automático y seguro.
   */
  loadKpis(params?: KpiListParams): Observable<KpiApiResponse<PerformanceKpi[]>> {
    this.loading.set(true);
    this.loadError.set(null);

    const applyFiltersAndFormat = (list: PerformanceKpi[]): PerformanceKpi[] => {
      let result = [...list];
      if (!params?.includeDisabled) {
        result = result.filter(k => k.isEnabled !== false);
      }
      const search = params?.search?.toLowerCase().trim();
      if (search) {
        result = result.filter(k =>
          k.name.toLowerCase().includes(search) ||
          (k.description && k.description.toLowerCase().includes(search)) ||
          (k.sourceConfig?.sourceProcess && k.sourceConfig.sourceProcess.toLowerCase().includes(search))
        );
      }
      if (params?.module) {
        result = result.filter(k => k.module === params.module);
      }
      if (params?.status) {
        result = result.filter(k => k.status === params.status);
      }
      return result.map(k => ({
        ...k,
        status: this.calculateStatus(k.currentValue, k.evaluationType, k.thresholds),
      }));
    };

    return this.http.get<KpiApiResponse<PerformanceKpi[]>>(this.API_URL).pipe(
      map(res => {
        const rawList = Array.isArray(res?.data) ? res.data : [];
        const formatted = applyFiltersAndFormat(rawList);
        return {
          ...res,
          data: formatted,
        };
      }),
      tap(res => {
        this.kpis.set(res.data);
        this.totalCount.set(res.data.length);
        this.loading.set(false);
        this.loadError.set(null);
      }),
      catchError(err => {
        const errMsg = err?.error?.message || err?.message || 'Error al cargar catálogo de KPIs desde el backend';
        this.loadError.set(errMsg);
        this.loading.set(false);
        this.kpis.set([]);
        this.totalCount.set(0);
        return throwError(() => err);
      })
    );
  }

  createKpi(dto: CreateKpiRequest): Observable<KpiApiResponse<PerformanceKpi>> {
    this.saving.set(true);
    return this.http.post<KpiApiResponse<PerformanceKpi>>(this.API_URL, dto).pipe(
      tap(res => {
        if (res.data) {
          this.kpis.update(list => [res.data, ...list]);
          this.totalCount.update(n => n + 1);
        }
        this.saving.set(false);
      }),
      catchError(err => {
        this.saving.set(false);
        return throwError(() => err);
      })
    );
  }

  updateKpi(id: string, dto: UpdateKpiRequest): Observable<KpiApiResponse<PerformanceKpi>> {
    this.saving.set(true);
    return this.http.put<KpiApiResponse<PerformanceKpi>>(`${this.API_URL}/${id}`, dto).pipe(
      tap(res => {
        if (res.data) {
          this.kpis.update(list => list.map(k => k.id === id ? res.data : k));
        }
        this.saving.set(false);
      }),
      catchError(err => {
        this.saving.set(false);
        return throwError(() => err);
      })
    );
  }

  disableKpi(id: string): Observable<KpiApiResponse<PerformanceKpi | null>> {
    this.saving.set(true);
    return this.http.delete<KpiApiResponse<PerformanceKpi>>(`${this.API_URL}/${id}`).pipe(
      tap(() => {
        this.kpis.update(list => list.filter(k => k.id !== id));
        this.totalCount.update(n => Math.max(0, n - 1));
        this.saving.set(false);
      }),
      catchError(err => {
        this.saving.set(false);
        return throwError(() => err);
      })
    );
  }

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

  // ─── ANALÍTICA Y MONITOREO EN TIEMPO REAL (HU-9 / HU-141 / HU-159) ─────────

  readonly userTargets = signal<OperationalUserTargets>(this.loadUserTargetsFromStorage());
  readonly isTargetModalOpen = signal<boolean>(false);

  readonly executiveKpis = signal<ExecutiveKpiData | null>(null);
  readonly inboundTimes = signal<InboundProcessTimesData | null>(null);
  readonly operatorRankings = signal<OperatorProductivityData[]>([]);
  readonly shiftProductivity = signal<ShiftProductivityData[]>([]);
  readonly processFlows = signal<ProcessFlowTimesData[]>([]);
  readonly circuitoDelicado = signal<CircuitoDelicadoSummary | null>(null);
  readonly gateToGateCycle = signal<GateToGateCycleData | null>(null);
  readonly movementAuditTimeline = signal<MovementAuditTimelineItem[]>([]);
  readonly selectedBranchId = signal<string>('');
  readonly selectedDateRange = signal<string>('today');
  readonly lastPolledAt = signal<Date>(new Date());
  readonly isAnalyticsLoading = signal<boolean>(false);
  readonly analyticsError = signal<string | null>(null);

  private readonly STORAGE_TARGETS_KEY = '4guard_operational_user_targets';

  private loadUserTargetsFromStorage(): OperationalUserTargets {
    try {
      const stored = localStorage.getItem('4guard_operational_user_targets');
      if (stored) {
        return { ...DEFAULT_OPERATIONAL_TARGETS, ...JSON.parse(stored) };
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_OPERATIONAL_TARGETS };
  }

  loadUserTargetsFromBackend(): Observable<OperationalUserTargets> {
    return this.http.get<KpiApiResponse<OperationalUserTargets>>(`${this.PERF_API_URL}/targets`).pipe(
      map(res => res.data),
      tap(data => {
        if (data) {
          const merged = { ...DEFAULT_OPERATIONAL_TARGETS, ...data };
          this.userTargets.set(merged);
          try {
            localStorage.setItem(this.STORAGE_TARGETS_KEY, JSON.stringify(merged));
          } catch {
            // ignore
          }
        }
      }),
      catchError(() => of(this.userTargets()))
    );
  }

  updateUserTargets(updated: Partial<OperationalUserTargets>): Observable<OperationalUserTargets> {
    const next = { ...this.userTargets(), ...updated };
    this.userTargets.set(next);
    try {
      localStorage.setItem(this.STORAGE_TARGETS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }

    // Persistir en backend PostgreSQL
    return this.http.put<KpiApiResponse<OperationalUserTargets>>(`${this.PERF_API_URL}/targets`, next).pipe(
      map(res => res.data || next),
      catchError(() => of(next))
    );
  }

  resetUserTargetsToDefault(): void {
    const defaults = { ...DEFAULT_OPERATIONAL_TARGETS };
    this.userTargets.set(defaults);
    try {
      localStorage.removeItem(this.STORAGE_TARGETS_KEY);
    } catch {
      // ignore
    }
    this.http.put<KpiApiResponse<OperationalUserTargets>>(`${this.PERF_API_URL}/targets`, defaults).subscribe({
      error: () => {}
    });
  }

  openTargetModal(): void {
    this.isTargetModalOpen.set(true);
  }

  closeTargetModal(): void {
    this.isTargetModalOpen.set(false);
  }

  private readonly PERF_API_URL = `${environment.apiBaseUrl}/api/v1/performance`;

  /**
   * Carga el resumen ejecutivo de 5 KPIs.
   */
  loadExecutiveKpis(branchId?: string, startDate?: string, endDate?: string): Observable<ExecutiveKpiData> {
    this.isAnalyticsLoading.set(true);
    this.analyticsError.set(null);
    let params: any = {};
    if (branchId && branchId !== 'all') params.branchId = branchId;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    return this.http.get<KpiApiResponse<ExecutiveKpiData>>(`${this.PERF_API_URL}/executive-kpi`, { params }).pipe(
      map(res => res.data),
      tap(data => {
        if (data) {
          this.executiveKpis.set(data);
          this.lastPolledAt.set(new Date());
        }
        this.isAnalyticsLoading.set(false);
      }),
      catchError(err => {
        this.isAnalyticsLoading.set(false);
        const errMsg = err?.error?.message || err?.message || 'Error al conectar con /performance/executive-kpi';
        this.analyticsError.set(errMsg);
        return throwError(() => err);
      })
    );
  }

  loadInboundTimes(branchId?: string): Observable<InboundProcessTimesData> {
    let params: any = {};
    if (branchId && branchId !== 'all') params.branchId = branchId;

    return this.http.get<KpiApiResponse<InboundProcessTimesData>>(`${this.PERF_API_URL}/inbound-times`, { params }).pipe(
      map(res => res.data),
      tap(data => {
        if (data) this.inboundTimes.set(data);
      }),
      catchError(err => throwError(() => err))
    );
  }

  loadOperatorRankings(branchId?: string, shiftId?: string): Observable<OperatorProductivityData[]> {
    let params: any = {};
    if (branchId && branchId !== 'all') params.branchId = branchId;
    if (shiftId) params.shiftId = shiftId;

    return this.http.get<KpiApiResponse<OperatorProductivityData[]>>(`${this.PERF_API_URL}/operator-ranking`, { params }).pipe(
      map(res => res.data || []),
      tap(data => {
        this.operatorRankings.set(data);
      }),
      catchError(err => {
        this.operatorRankings.set([]);
        return throwError(() => err);
      })
    );
  }

  loadShiftProductivity(branchId?: string): Observable<ShiftProductivityData[]> {
    let params: any = {};
    if (branchId && branchId !== 'all') params.branchId = branchId;

    return this.http.get<KpiApiResponse<ShiftProductivityData[]>>(`${this.PERF_API_URL}/shift-productivity`, { params }).pipe(
      map(res => res.data || []),
      tap(data => {
        this.shiftProductivity.set(data);
      }),
      catchError(err => {
        this.shiftProductivity.set([]);
        return throwError(() => err);
      })
    );
  }

  loadProcessFlowTimes(branchId?: string): Observable<ProcessFlowTimesData[]> {
    let params: any = {};
    if (branchId && branchId !== 'all') params.branchId = branchId;

    return this.http.get<KpiApiResponse<ProcessFlowTimesData[]>>(`${this.PERF_API_URL}/process-flow-times`, { params }).pipe(
      map(res => res.data || []),
      tap(data => {
        this.processFlows.set(data);
      }),
      catchError(err => {
        this.processFlows.set([]);
        return throwError(() => err);
      })
    );
  }

  loadCircuitoDelicado(branchId?: string): Observable<CircuitoDelicadoSummary> {
    let params: any = {};
    if (branchId && branchId !== 'all') params.branchId = branchId;

    return this.http.get<KpiApiResponse<CircuitoDelicadoSummary>>(`${this.PERF_API_URL}/delicate-circuit`, { params }).pipe(
      map(res => res.data),
      tap(data => {
        if (data) this.circuitoDelicado.set(data);
      }),
      catchError(err => throwError(() => err))
    );
  }

  loadGateToGateCycle(branchId?: string): Observable<GateToGateCycleData> {
    let params: any = {};
    if (branchId && branchId !== 'all') params.branchId = branchId;

    return this.http.get<KpiApiResponse<GateToGateCycleData>>(`${this.PERF_API_URL}/gate-to-gate-cycle`, { params }).pipe(
      map(res => res.data),
      tap(data => {
        if (data) this.gateToGateCycle.set(data);
      }),
      catchError(err => throwError(() => err))
    );
  }

  loadMovementAuditTimeline(filterParams?: {
    branchId?: string;
    folio?: string;
    sscc?: string;
    operatorCode?: string;
    operationType?: string;
    limit?: number;
  }): Observable<MovementAuditTimelineItem[]> {
    let params: any = {};
    if (filterParams?.branchId && filterParams.branchId !== 'all') params.branchId = filterParams.branchId;
    if (filterParams?.folio) params.folio = filterParams.folio;
    if (filterParams?.sscc) params.sscc = filterParams.sscc;
    if (filterParams?.operatorCode) params.operatorCode = filterParams.operatorCode;
    if (filterParams?.operationType) params.operationType = filterParams.operationType;
    if (filterParams?.limit) params.limit = filterParams.limit.toString();

    return this.http.get<KpiApiResponse<MovementAuditTimelineItem[]>>(`${this.PERF_API_URL}/timeline-audit`, { params }).pipe(
      map(res => res.data || []),
      tap(data => {
        this.movementAuditTimeline.set(data);
      }),
      catchError(err => {
        this.movementAuditTimeline.set([]);
        return throwError(() => err);
      })
    );
  }

  enqueueExportJob(reportType: string = 'FULL_PERFORMANCE_21COL', branchId?: string): Observable<ExportJobResponse> {
    let params: any = { reportType };
    if (branchId && branchId !== 'all') params.branchId = branchId;

    return this.http.post<KpiApiResponse<ExportJobResponse>>(`${this.PERF_API_URL}/export-jobs`, null, { params }).pipe(
      map(res => res.data),
      catchError(err => throwError(() => err))
    );
  }

  refreshAllAnalytics(): void {
    const branch = this.selectedBranchId() || undefined;
    this.loadExecutiveKpis(branch).subscribe();
    this.loadInboundTimes(branch).subscribe();
    this.loadOperatorRankings(branch).subscribe();
    this.loadShiftProductivity(branch).subscribe();
    this.loadProcessFlowTimes(branch).subscribe();
    this.loadCircuitoDelicado(branch).subscribe();
    this.loadGateToGateCycle(branch).subscribe();
    this.loadMovementAuditTimeline({ branchId: branch }).subscribe();
  }

  // ─── Manejo centralizado de errores ─────────────────────────────────────────

  private handleError(error: HttpErrorResponse): Observable<never> {
    this.loading.set(false);
    this.saving.set(false);
    return throwError(() => error);
  }
}
