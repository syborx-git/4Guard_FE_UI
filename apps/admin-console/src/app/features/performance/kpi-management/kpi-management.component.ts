/**
 * @file kpi-management.component.ts
 * @description Componente principal de Gestión de KPIs (HU-138) — 4GUARD WMS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ALCANCE
 * ═══════════════════════════════════════════════════════════════════════════
 *  Consola administrativa para definir indicadores, metas, umbrales y alertas.
 *  NO incluye: dashboards de visualización, gráficas, ni captura de productividad.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CONSUMIDORES FUTUROS DE ESTE CATÁLOGO
 * ═══════════════════════════════════════════════════════════════════════════
 *  • Dashboard de KPIs    • Gráficas y tendencias    • Comparativos
 *  • Rendimiento histórico    • Indicadores por turno/operador/cliente
 *  • Monitor de patio    • Torre de Control
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PERMISOS RBAC
 * ═══════════════════════════════════════════════════════════════════════════
 *  TODO: Descomentar las llamadas reales cuando los permisos KPI_*
 *  estén registrados en el backend y en el JWT del usuario.
 */

import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { PerformanceKpiService } from '../services/performance-kpi.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  PerformanceKpi,
  KpiModule,
  KpiUnit,
  KpiStatus,
  EvaluationType,
  FrequencyUnit,
  CreateKpiRequest,
  UpdateKpiRequest,
  KPI_MODULE_LABELS,
  KPI_UNIT_LABELS,
  EVALUATION_TYPE_LABELS,
  KPI_STATUS_LABELS,
  FREQUENCY_UNIT_LABELS,
} from '../models/performance-kpi.model';

// ─── Tipos internos ───────────────────────────────────────────────────────────

type FormMode = 'idle' | 'new' | 'edit';

// ─── Validadores personalizados ───────────────────────────────────────────────

/** Valida que el valor no sea únicamente espacios en blanco. */
function noWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  return (control.value as string).trim().length === 0 ? { whitespaceOnly: true } : null;
}

@Component({
  selector: 'fg-kpi-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './kpi-management.component.html',
  styleUrl: './kpi-management.component.css',
})
export class KpiManagementComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  protected readonly kpiService = inject(PerformanceKpiService);
  private readonly authService = inject(AuthService);
  private readonly destroy$ = new Subject<void>();

  // ─── Estado de la vista ──────────────────────────────────────────────────────

  protected readonly selectedKpi = signal<PerformanceKpi | null>(null);
  protected readonly formMode = signal<FormMode>('idle');
  protected readonly submitAttempted = signal<boolean>(false);
  protected readonly saveSuccess = signal<boolean>(false);
  protected readonly backendError = signal<string | null>(null);
  protected readonly showDisableDialog = signal<boolean>(false);
  protected readonly showUnsavedDialog = signal<boolean>(false);

  /** KPI pendiente de selección cuando hay cambios sin guardar. */
  private pendingKpi: PerformanceKpi | null = null;
  private pendingAction: 'select' | 'new' | 'cancel' | null = null;

  // ─── Filtros del catálogo ───────────────────────────────────────────────────

  protected filterText = '';
  protected filterModule: KpiModule | '' = '';
  protected filterStatus: KpiStatus | '' = '';

  // ─── Lista filtrada (computed) ──────────────────────────────────────────────

  protected readonly filteredKpis = computed(() => {
    let list = this.kpiService.kpis();
    const search = this.filterText.toLowerCase().trim();

    if (search) {
      list = list.filter(k =>
        k.name.toLowerCase().includes(search) ||
        k.description.toLowerCase().includes(search) ||
        k.sourceConfig.sourceProcess.toLowerCase().includes(search)
      );
    }

    if (this.filterModule) {
      list = list.filter(k => k.module === this.filterModule);
    }

    if (this.filterStatus) {
      list = list.filter(k => k.status === this.filterStatus);
    }

    return list;
  });

  // ─── KPIs computados para la cabecera ───────────────────────────────────────

  protected readonly totalKpis     = computed(() => this.kpiService.totalEnabled());
  protected readonly kpiOptimal    = computed(() => this.kpiService.optimalCount());
  protected readonly kpiWarning    = computed(() => this.kpiService.warningCount());
  protected readonly kpiCritical   = computed(() => this.kpiService.criticalCount());

  // ─── Formulario reactivo ─────────────────────────────────────────────────────

  protected readonly form: FormGroup = this.fb.group({
    // Sección 1 — Información General
    name:           ['', [Validators.required, Validators.maxLength(150), noWhitespaceValidator]],
    description:    ['', [Validators.required, Validators.maxLength(500), noWhitespaceValidator]],
    module:         ['', Validators.required],
    unit:           ['', Validators.required],
    evaluationType: ['', Validators.required],

    // Sección 2 — Umbrales
    thresholdTarget:   [null as number | null, [Validators.required, Validators.min(0)]],
    thresholdWarning:  [null as number | null, [Validators.required, Validators.min(0)]],
    thresholdCritical: [null as number | null, [Validators.required, Validators.min(0)]],
    rangeLow:          [null as number | null],
    rangeHigh:         [null as number | null],

    // Sección 3 — Origen del indicador
    sourceProcess:   ['', [Validators.required, Validators.maxLength(150), noWhitespaceValidator]],
    startEvent:      ['', [Validators.required, Validators.maxLength(200), noWhitespaceValidator]],
    endEvent:        ['', [Validators.required, Validators.maxLength(200), noWhitespaceValidator]],
    frequencyValue:  [null as number | null, [Validators.required, Validators.min(1)]],
    frequencyUnit:   ['MINUTES', Validators.required],
    active:          [true],
  });

  // ─── Catálogos para selects ──────────────────────────────────────────────────

  protected readonly modules: { value: KpiModule; label: string }[] = [
    { value: 'RECEIVING',  label: KPI_MODULE_LABELS['RECEIVING'] },
    { value: 'QUALITY',    label: KPI_MODULE_LABELS['QUALITY'] },
    { value: 'INVENTORY',  label: KPI_MODULE_LABELS['INVENTORY'] },
    { value: 'PICKING',    label: KPI_MODULE_LABELS['PICKING'] },
    { value: 'SHIPPING',   label: KPI_MODULE_LABELS['SHIPPING'] },
    { value: 'YARD',       label: KPI_MODULE_LABELS['YARD'] },
    { value: 'CARRIERS',   label: KPI_MODULE_LABELS['CARRIERS'] },
  ];

  protected readonly units: { value: KpiUnit; label: string }[] = [
    { value: 'MINUTES',         label: KPI_UNIT_LABELS['MINUTES'] },
    { value: 'HOURS',           label: KPI_UNIT_LABELS['HOURS'] },
    { value: 'PERCENTAGE',      label: KPI_UNIT_LABELS['PERCENTAGE'] },
    { value: 'PIECES',          label: KPI_UNIT_LABELS['PIECES'] },
    { value: 'CASES',           label: KPI_UNIT_LABELS['CASES'] },
    { value: 'PALLETS',         label: KPI_UNIT_LABELS['PALLETS'] },
    { value: 'UNITS_PER_HOUR',  label: KPI_UNIT_LABELS['UNITS_PER_HOUR'] },
    { value: 'ORDERS_PER_HOUR', label: KPI_UNIT_LABELS['ORDERS_PER_HOUR'] },
  ];

  protected readonly evaluationTypes: { value: EvaluationType; label: string }[] = [
    { value: 'HIGHER_IS_BETTER', label: EVALUATION_TYPE_LABELS['HIGHER_IS_BETTER'] },
    { value: 'LOWER_IS_BETTER',  label: EVALUATION_TYPE_LABELS['LOWER_IS_BETTER'] },
    { value: 'RANGE',            label: EVALUATION_TYPE_LABELS['RANGE'] },
  ];

  protected readonly frequencyUnits: { value: FrequencyUnit; label: string }[] = [
    { value: 'MINUTES', label: FREQUENCY_UNIT_LABELS['MINUTES'] },
    { value: 'HOURS',   label: FREQUENCY_UNIT_LABELS['HOURS'] },
    { value: 'DAYS',    label: FREQUENCY_UNIT_LABELS['DAYS'] },
  ];

  protected readonly statusLabels   = KPI_STATUS_LABELS;
  protected readonly moduleLabels   = KPI_MODULE_LABELS;

  // ─── Ciclo de vida ───────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadKpis();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Carga del catálogo ──────────────────────────────────────────────────────

  protected loadKpis(): void {
    // TODO: Obtener catálogo de módulos desde el backend
    this.kpiService.loadKpis().pipe(takeUntil(this.destroy$)).subscribe({
      error: (err: HttpErrorResponse) => {
        const msg = err?.error?.message || err?.message || 'Error al cargar los KPIs.';
        this.kpiService.loadError.set(msg);
      },
    });
  }

  // ─── Filtros ────────────────────────────────────────────────────────────────

  protected onFilterChange(): void {
    this.kpiService.kpis.update(list => [...list]);
  }

  protected clearFilters(): void {
    this.filterText = '';
    this.filterModule = '';
    this.filterStatus = '';
    this.onFilterChange();
  }

  // ─── Detección de cambios no guardados ──────────────────────────────────────

  private checkUnsavedChanges(action: 'select' | 'new' | 'cancel', kpi?: PerformanceKpi): boolean {
    if (this.form.dirty && this.formMode() !== 'idle') {
      this.pendingKpi = kpi ?? null;
      this.pendingAction = action;
      this.showUnsavedDialog.set(true);
      return true; // hay cambios sin guardar
    }
    return false; // no hay cambios, proceder
  }

  protected confirmDiscardChanges(): void {
    this.showUnsavedDialog.set(false);
    const action = this.pendingAction;
    const kpi = this.pendingKpi;
    this.pendingAction = null;
    this.pendingKpi = null;

    // Resetear dirty
    this.form.markAsPristine();

    if (action === 'select' && kpi) {
      this.selectKpi(kpi);
    } else if (action === 'new') {
      this.startNewKpi();
    } else if (action === 'cancel') {
      this.cancelForm();
    }
  }

  protected cancelDiscardChanges(): void {
    this.showUnsavedDialog.set(false);
    this.pendingAction = null;
    this.pendingKpi = null;
  }

  // ─── Selección del catálogo ──────────────────────────────────────────────────

  protected selectKpi(kpi: PerformanceKpi): void {
    if (this.checkUnsavedChanges('select', kpi)) return;
    this.selectedKpi.set(kpi);
    this.formMode.set('edit');
    this.populateForm(kpi);
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
  }

  protected startNewKpi(): void {
    if (this.checkUnsavedChanges('new')) return;
    this.selectedKpi.set(null);
    this.formMode.set('new');
    this.form.reset({ active: true, frequencyUnit: 'MINUTES' });
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  protected cancelForm(): void {
    if (this.checkUnsavedChanges('cancel')) return;
    const kpi = this.selectedKpi();
    if (kpi) {
      this.formMode.set('edit');
      this.populateForm(kpi);
    } else {
      this.formMode.set('idle');
    }
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
  }

  // ─── Helpers del formulario ────────────────────────────────────────────────

  private populateForm(kpi: PerformanceKpi): void {
    this.form.patchValue({
      name:              kpi.name,
      description:       kpi.description,
      module:            kpi.module,
      unit:              kpi.unit,
      evaluationType:    kpi.evaluationType,
      thresholdTarget:   kpi.thresholds.target,
      thresholdWarning:  kpi.thresholds.warning,
      thresholdCritical: kpi.thresholds.critical,
      rangeLow:          kpi.thresholds.rangeLow ?? null,
      rangeHigh:         kpi.thresholds.rangeHigh ?? null,
      sourceProcess:     kpi.sourceConfig.sourceProcess,
      startEvent:        kpi.sourceConfig.startEvent,
      endEvent:          kpi.sourceConfig.endEvent,
      frequencyValue:    kpi.sourceConfig.frequencyValue,
      frequencyUnit:     kpi.sourceConfig.frequencyUnit,
      active:            kpi.sourceConfig.active,
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  /** Verifica si un campo del formulario tiene errores visibles al usuario. */
  protected fieldHasError(name: string): boolean {
    const ctrl = this.form.get(name);
    return !!ctrl && ctrl.invalid && (ctrl.touched || this.submitAttempted());
  }

  /** Retorna el primer mensaje de error de un campo de forma legible. */
  protected getFieldError(name: string): string {
    const ctrl = this.form.get(name);
    if (!ctrl || !ctrl.errors) return '';
    if (ctrl.errors['required'])       return 'Este campo es obligatorio.';
    if (ctrl.errors['whitespaceOnly']) return 'No puede contener solo espacios.';
    if (ctrl.errors['maxlength'])      return `Máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    if (ctrl.errors['min'])            return `El valor mínimo es ${ctrl.errors['min'].min}.`;
    return 'Campo inválido.';
  }

  /** Determina si la sección de rango debe mostrarse. */
  protected get isRangeMode(): boolean {
    return this.form.get('evaluationType')?.value === 'RANGE';
  }

  /** Devuelve el evaluationType seleccionado. */
  protected get currentEvaluationType(): EvaluationType | '' {
    return this.form.get('evaluationType')?.value || '';
  }

  /** Retorna el label del umbral objetivo según el tipo de evaluación. */
  protected get targetLabel(): string {
    if (this.currentEvaluationType === 'RANGE') return 'No aplica (rango)';
    return 'Objetivo';
  }

  // ─── Barra visual de umbrales ───────────────────────────────────────────────

  /**
   * Calcula los segmentos porcentuales para la barra visual de umbrales.
   * Retorna un arreglo de 3 segmentos: [optimalWidth, warningWidth, criticalWidth]
   */
  protected get thresholdBarSegments(): number[] {
    const evalType = this.currentEvaluationType;
    const target   = this.form.get('thresholdTarget')?.value ?? 0;
    const warning  = this.form.get('thresholdWarning')?.value ?? 0;
    const critical = this.form.get('thresholdCritical')?.value ?? 0;

    if (!evalType || target === 0 && warning === 0 && critical === 0) {
      return [33, 34, 33];
    }

    if (evalType === 'RANGE') {
      const rangeLow  = this.form.get('rangeLow')?.value ?? 0;
      const rangeHigh = this.form.get('rangeHigh')?.value ?? 0;
      if (rangeHigh <= 0) return [33, 34, 33];
      const total = rangeHigh + critical;
      if (total <= 0) return [33, 34, 33];
      const optW = ((rangeHigh - rangeLow) / total) * 100;
      const warnW = (warning / total) * 100;
      const critW = 100 - optW - warnW;
      return [Math.max(10, optW), Math.max(10, warnW), Math.max(10, critW)];
    }

    // HIGHER_IS_BETTER or LOWER_IS_BETTER
    const maxVal = Math.max(target, warning, critical, 1);
    if (evalType === 'LOWER_IS_BETTER') {
      const optW  = (target / maxVal) * 100;
      const warnW = ((warning - target) / maxVal) * 100;
      const critW = 100 - optW - warnW;
      return [Math.max(10, optW), Math.max(10, Math.abs(warnW)), Math.max(10, Math.abs(critW))];
    }

    // HIGHER_IS_BETTER
    const critW = (critical / maxVal) * 100;
    const warnW = ((warning - critical) / maxVal) * 100;
    const optW  = 100 - critW - warnW;
    return [Math.max(10, Math.abs(optW)), Math.max(10, Math.abs(warnW)), Math.max(10, Math.abs(critW))];
  }

  // ─── Validación de umbrales cruzada ─────────────────────────────────────────

  protected get thresholdError(): string | null {
    const evalType = this.currentEvaluationType;
    const target   = this.form.get('thresholdTarget')?.value;
    const warning  = this.form.get('thresholdWarning')?.value;
    const critical = this.form.get('thresholdCritical')?.value;

    if (target == null || warning == null || critical == null) return null;

    if (evalType === 'HIGHER_IS_BETTER') {
      if (!(target > warning && warning > critical)) {
        return 'Para "Mayor es mejor": Objetivo debe ser > Advertencia > Crítico.';
      }
    } else if (evalType === 'LOWER_IS_BETTER') {
      if (!(target < warning && warning < critical)) {
        return 'Para "Menor es mejor": Objetivo debe ser < Advertencia < Crítico.';
      }
    } else if (evalType === 'RANGE') {
      const rangeLow  = this.form.get('rangeLow')?.value;
      const rangeHigh = this.form.get('rangeHigh')?.value;
      if (rangeLow != null && rangeHigh != null && rangeLow >= rangeHigh) {
        return 'El límite inferior debe ser menor que el superior.';
      }
    }

    return null;
  }

  // ─── Validación de duplicados ───────────────────────────────────────────────

  protected get duplicateError(): string | null {
    const name = this.form.get('name')?.value;
    const module = this.form.get('module')?.value;
    const sourceProcess = this.form.get('sourceProcess')?.value;
    if (!name || !module || !sourceProcess) return null;

    const excludeId = this.formMode() === 'edit' ? this.selectedKpi()?.id : undefined;
    if (this.kpiService.isDuplicate(name, module, sourceProcess, excludeId)) {
      return 'Ya existe un indicador con ese nombre para el mismo módulo y proceso.';
    }
    return null;
  }

  // ─── Guardar ──────────────────────────────────────────────────────────────────

  protected saveKpi(): void {
    this.submitAttempted.set(true);
    this.backendError.set(null);

    if (this.form.invalid) return;
    if (this.thresholdError) return;
    if (this.duplicateError) return;

    const raw = this.form.getRawValue();
    const dto: CreateKpiRequest = {
      name:           raw.name.trim(),
      description:    raw.description.trim(),
      module:         raw.module,
      unit:           raw.unit,
      evaluationType: raw.evaluationType,
      thresholds: {
        target:    raw.thresholdTarget,
        warning:   raw.thresholdWarning,
        critical:  raw.thresholdCritical,
        rangeLow:  raw.evaluationType === 'RANGE' ? raw.rangeLow : undefined,
        rangeHigh: raw.evaluationType === 'RANGE' ? raw.rangeHigh : undefined,
      },
      sourceConfig: {
        sourceProcess:  raw.sourceProcess.trim(),
        startEvent:     raw.startEvent.trim(),
        endEvent:       raw.endEvent.trim(),
        frequencyValue: raw.frequencyValue,
        frequencyUnit:  raw.frequencyUnit,
        active:         raw.active,
      },
    };

    const mode = this.formMode();

    if (mode === 'new') {
      this.kpiService.createKpi(dto).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          this.saveSuccess.set(true);
          this.selectedKpi.set(res.data);
          this.formMode.set('edit');
          this.submitAttempted.set(false);
          this.form.markAsPristine();
          setTimeout(() => this.saveSuccess.set(false), 3500);
        },
        error: (err: HttpErrorResponse) => this.handleBackendError(err),
      });
    } else if (mode === 'edit' && this.selectedKpi()) {
      const updateDto: UpdateKpiRequest = dto;
      this.kpiService.updateKpi(this.selectedKpi()!.id, updateDto)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.saveSuccess.set(true);
            this.selectedKpi.set(res.data);
            this.submitAttempted.set(false);
            this.form.markAsPristine();
            setTimeout(() => this.saveSuccess.set(false), 3500);
          },
          error: (err: HttpErrorResponse) => this.handleBackendError(err),
        });
    }
  }

  // ─── Desactivar (eliminación lógica) ──────────────────────────────────────

  protected openDisableDialog(): void {
    this.showDisableDialog.set(true);
  }

  protected closeDisableDialog(): void {
    this.showDisableDialog.set(false);
  }

  protected confirmDisable(): void {
    const kpiId = this.selectedKpi()?.id;
    if (!kpiId) return;

    this.kpiService.disableKpi(kpiId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.closeDisableDialog();
          this.selectedKpi.set(null);
          this.formMode.set('idle');
          this.form.reset();
          this.form.markAsPristine();
          this.saveSuccess.set(true);
          setTimeout(() => this.saveSuccess.set(false), 3500);
        },
        error: (err: HttpErrorResponse) => {
          this.handleBackendError(err);
          this.closeDisableDialog();
        },
      });
  }

  // ─── Manejo de errores del backend ────────────────────────────────────────

  private handleBackendError(err: HttpErrorResponse): void {
    const status = err.status;
    const serverMsg = err?.error?.message || err?.message;

    if (status === 409) {
      this.backendError.set(serverMsg || 'Ya existe un indicador con esos datos. Verifica los campos.');
    } else if (status === 404) {
      this.backendError.set('Indicador no encontrado. Es posible que haya sido desactivado.');
    } else if (status === 400) {
      this.backendError.set(serverMsg || 'Datos inválidos. Revisa los campos del formulario.');
    } else {
      this.backendError.set('Error interno del servidor. Intenta de nuevo más tarde.');
    }
  }

  // ─── Permisos RBAC ────────────────────────────────────────────────────────────
  //
  // TODO: Descomentar las líneas reales cuando los permisos KPI_*
  // estén registrados en el backend y disponibles en el JWT del usuario.

  protected canCreate(): boolean { /* return this.authService.hasPermission('KPI_CREATE'); */ return true; }
  protected canUpdate(): boolean { /* return this.authService.hasPermission('KPI_UPDATE'); */ return true; }
  protected canDelete(): boolean { /* return this.authService.hasPermission('KPI_DELETE'); */ return true; }

  // ─── Helpers del template ─────────────────────────────────────────────────────

  protected isSelectedKpi(kpi: PerformanceKpi): boolean {
    return this.selectedKpi()?.id === kpi.id;
  }

  /** Retorna la clase CSS del badge según el estado del KPI. */
  protected getStatusBadgeClass(status: KpiStatus): string {
    const map: Record<KpiStatus, string> = {
      OPTIMAL:  'kpi-badge--optimal',
      WARNING:  'kpi-badge--warning',
      CRITICAL: 'kpi-badge--critical',
      NO_DATA:  'kpi-badge--nodata',
    };
    return map[status] ?? 'kpi-badge--nodata';
  }

  /** Retorna el ícono del estado. */
  protected getStatusIcon(status: KpiStatus): string {
    const map: Record<KpiStatus, string> = {
      OPTIMAL:  'check_circle',
      WARNING:  'warning',
      CRITICAL: 'error',
      NO_DATA:  'help_outline',
    };
    return map[status] ?? 'help_outline';
  }

  /** Formatea la frecuencia para mostrar en tarjeta. */
  protected formatFrequency(kpi: PerformanceKpi): string {
    const val = kpi.sourceConfig.frequencyValue;
    const unit = FREQUENCY_UNIT_LABELS[kpi.sourceConfig.frequencyUnit];
    return `Cada ${val} ${unit.toLowerCase()}`;
  }

  /** Formatea fecha relativa simple. */
  protected formatRelativeDate(isoDate: string | null): string {
    if (!isoDate) return 'Sin datos';
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays}d`;
  }

  protected get isFormDirty(): boolean  { return this.form.dirty; }
  protected get isSaving():    boolean  { return this.kpiService.saving(); }
  protected get isLoading():   boolean  { return this.kpiService.loading(); }
  protected get hasLoadError():boolean  { return !!this.kpiService.loadError(); }
  protected get loadErrorMessage(): string { return this.kpiService.loadError() ?? ''; }

  protected get isListEmpty(): boolean {
    return !this.isLoading && !this.hasLoadError && this.kpiService.kpis().length === 0;
  }

  protected get hasNoResults(): boolean {
    return (
      !this.isLoading &&
      !this.hasLoadError &&
      this.kpiService.kpis().length > 0 &&
      this.filteredKpis().length === 0
    );
  }

  protected get hasActiveFilters(): boolean {
    return !!this.filterText || !!this.filterModule || !!this.filterStatus;
  }
}
