/**
 * @file business-rules-config.component.ts
 * @description Componente principal HU-131 — Motor de Reglas de Negocio Enterprise.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DISEÑO & ARQUITECTURA
 * ═══════════════════════════════════════════════════════════════════════════
 * - Hero compacto + 5 KPI cards
 * - Barra de filtros reactiva
 * - Layout Split View 35% / 65% (Catálogo de reglas / Formulario Enterprise)
 * - Formulario dividido en 4 Secciones: Identidad, Configuración, Alcance y Control
 * - Soporte nativo para Dark Mode y micro-animaciones (180ms - 260ms)
 */

import {
  Component,
  inject,
  signal,
  computed,
  effect,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { BusinessRulesService } from '../business-rules.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthState } from '../../../core/auth/auth.state';

import {
  BusinessRule,
  RuleScope,
  RuleStatus,
  RuleSeverity,
  RuleModule,
  RuleCategory,
  RuleDataType,
  RuleFunctionalType,
  WMS_RULE_MODULES,
  WMS_RULE_CATEGORIES,
  WMS_RULE_SCOPES,
} from '../business-rules.models';

@Component({
  selector: 'fg-business-rules-config',
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule],
  templateUrl: './business-rules-config.component.html',
  styleUrl: './business-rules-config.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessRulesConfigComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  protected readonly rulesService = inject(BusinessRulesService);
  private readonly toastService = inject(ToastService);
  protected readonly authState = inject(AuthState);
  private readonly destroy$ = new Subject<void>();

  // ─── Signals expuestas ───────────────────────────────────────────────────

  readonly kpis = this.rulesService.kpis;
  readonly filteredRules = this.rulesService.filteredRules;
  readonly selectedRule = this.rulesService.selectedRule;
  readonly selectedRuleId = this.rulesService.selectedRuleId;
  readonly isLoading = this.rulesService.isLoading;

  /** Estado de edición: true para modificar regla existente, false para crear nueva */
  protected readonly isEditMode = signal<boolean>(true);

  /** Indica si hay cambios sin guardar en el formulario */
  protected readonly isFormDirty = signal<boolean>(false);

  // ─── Constantes para opciones en plantilla ────────────────────────────────

  protected readonly allModules = WMS_RULE_MODULES;
  protected readonly allCategories = WMS_RULE_CATEGORIES;
  protected readonly allScopes = WMS_RULE_SCOPES;

  protected readonly dataTypes: { id: RuleDataType; label: string }[] = [
    { id: 'STRING', label: 'Texto libre (String)' },
    { id: 'NUMBER', label: 'Numérico (Integer / Float)' },
    { id: 'BOOLEAN', label: 'Verdadero / Falso (Boolean)' },
    { id: 'PERCENTAGE', label: 'Porcentaje (%)' },
    { id: 'ENUM', label: 'Lista de opciones (Enum)' },
    { id: 'DURATION_MINUTES', label: 'Duración en minutos' },
    { id: 'DAYS', label: 'Días calendario' },
  ];

  protected readonly functionalTypes: { id: RuleFunctionalType; label: string; desc: string }[] = [
    { id: 'DETERMINISTIC', label: 'Determinística', desc: 'Asignación directa y explícita' },
    { id: 'THRESHOLD', label: 'Umbral / Límite', desc: 'Límites numéricos de tolerancia' },
    { id: 'POLICY', label: 'Política Corporativa', desc: 'Regla de negocio no negociable' },
    { id: 'VALIDATION', label: 'Validación de Seguridad', desc: 'Verificación preventiva' },
  ];

  protected readonly statuses: { id: RuleStatus; label: string }[] = [
    { id: 'ACTIVE', label: 'Activa' },
    { id: 'INACTIVE', label: 'Inactiva' },
    { id: 'DRAFT', label: 'Borrador' },
    { id: 'DEPRECATED', label: 'Obsoleta' },
  ];

  protected readonly severities: { id: RuleSeverity; label: string }[] = [
    { id: 'INFO', label: 'Informativa (Info)' },
    { id: 'MEDIUM', label: 'Criticidad Media' },
    { id: 'WARNING', label: 'Advertencia (Warning)' },
    { id: 'HIGH', label: 'Alta Criticidad' },
    { id: 'CRITICAL', label: 'Crítica Bloqueante' },
  ];

  // ─── Formularios Reactivos ───────────────────────────────────────────────

  /** Formulario de filtros superiores */
  protected readonly filterForm: FormGroup = this.fb.group({
    searchTerm: [''],
    module: [''],
    category: [''],
    dataType: [''],
    scope: [''],
    status: [''],
  });

  /** Formulario Enterprise de 4 Secciones */
  protected readonly ruleForm: FormGroup = this.fb.group({
    id: [''],
    // SECCIÓN 1: Identidad
    code: ['', [Validators.required, Validators.pattern(/^[A-Z0-9_]+$/)]],
    name: ['', [Validators.required, Validators.minLength(5)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    module: ['SYSTEM', [Validators.required]],
    category: ['STRATEGY', [Validators.required]],

    // SECCIÓN 2: Configuración
    functionalType: ['POLICY', [Validators.required]],
    dataType: ['STRING', [Validators.required]],
    value: ['', [Validators.required]],
    unit: [''],
    minValue: [null],
    maxValue: [null],

    // SECCIÓN 3: Alcance
    scope: ['GLOBAL', [Validators.required]],

    // SECCIÓN 4: Control
    status: ['ACTIVE', [Validators.required]],
    severity: ['INFO', [Validators.required]],
    effectiveDate: [new Date().toISOString().slice(0, 10), [Validators.required]],
    changeReason: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    // Sincronizar automáticamente el formulario cuando cambia la regla seleccionada
    effect(() => {
      const rule = this.selectedRule();
      if (rule && this.isEditMode()) {
        this.populateForm(rule);
      }
    });
  }

  ngOnInit(): void {
    // Escuchar cambios en los filtros reactivamente
    this.filterForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((filters) => {
        this.rulesService.applyFilters(filters);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Acciones de Catálogo (Panel Izquierdo) ───────────────────────────────

  protected selectRule(rule: BusinessRule): void {
    this.isEditMode.set(true);
    this.rulesService.selectRule(rule.id);
    this.populateForm(rule);
  }

  protected startNewRule(): void {
    this.isEditMode.set(false);
    this.ruleForm.reset({
      id: '',
      code: '',
      name: '',
      description: '',
      module: 'RECEIVING',
      category: 'STRATEGY',
      functionalType: 'POLICY',
      dataType: 'STRING',
      value: '',
      unit: '',
      minValue: null,
      maxValue: null,
      scope: 'GLOBAL',
      status: 'ACTIVE',
      severity: 'INFO',
      effectiveDate: new Date().toISOString().slice(0, 10),
      changeReason: 'Creación inicial de nueva regla de negocio.',
    });
    this.toastService.info('Modo creación: Ingresa los parámetros de la nueva regla.');
  }

  // ─── Formulario (Panel Derecho) ───────────────────────────────────────────

  private populateForm(rule: BusinessRule): void {
    this.ruleForm.patchValue({
      id: rule.id,
      code: rule.code,
      name: rule.name,
      description: rule.description,
      module: rule.module,
      category: rule.category,
      functionalType: rule.functionalType,
      dataType: rule.dataType,
      value: rule.value,
      unit: rule.unit || '',
      minValue: rule.minValue ?? null,
      maxValue: rule.maxValue ?? null,
      scope: rule.scope,
      status: rule.status,
      severity: rule.severity,
      effectiveDate: rule.effectiveDate,
      changeReason: '', // Requerir motivo en cada guardado
    });
    this.ruleForm.markAsPristine();
    this.isFormDirty.set(false);
  }

  protected setScope(scope: RuleScope): void {
    this.ruleForm.patchValue({ scope });
    this.ruleForm.markAsDirty();
  }

  protected resetFilters(): void {
    this.filterForm.reset({
      searchTerm: '',
      module: '',
      category: '',
      dataType: '',
      scope: '',
      status: '',
    });
    this.rulesService.clearFilters();
    this.toastService.info('Filtros restablecidos.');
  }

  protected refresh(): void {
    this.rulesService.refreshData().subscribe(() => {
      this.rulesService.isLoading.set(false);
      this.toastService.success('Motor de reglas actualizado.');
    });
  }

  protected saveConfiguration(): void {
    if (this.ruleForm.invalid) {
      this.ruleForm.markAllAsTouched();
      this.toastService.error(
        'Por favor completa todos los campos requeridos y el motivo del cambio.'
      );
      return;
    }

    const val = this.ruleForm.value;
    this.rulesService.saveRule(val);

    const actionText = this.isEditMode() ? 'actualizada' : 'creada';
    this.toastService.success(
      `Regla "${val.code}" ${actionText} correctamente.`,
      4500
    );

    this.isEditMode.set(true);
    this.ruleForm.markAsPristine();
  }

  // ─── Helpers de diseño & UI ───────────────────────────────────────────────

  protected moduleBadgeClass(mod: RuleModule): string {
    const map: Record<RuleModule, string> = {
      RECEIVING: 'br-badge--receiving',
      INVENTORY: 'br-badge--inventory',
      SHIPPING: 'br-badge--shipping',
      QUALITY: 'br-badge--quality',
      LAYOUT: 'br-badge--layout',
      SYSTEM: 'br-badge--system',
      SECURITY: 'br-badge--security',
    };
    return map[mod] ?? 'br-badge--system';
  }

  protected severityBadgeClass(sev: RuleSeverity): string {
    const map: Record<RuleSeverity, string> = {
      INFO: 'br-sev--info',
      MEDIUM: 'br-sev--medium',
      WARNING: 'br-sev--warning',
      HIGH: 'br-sev--high',
      CRITICAL: 'br-sev--critical',
    };
    return map[sev] ?? 'br-sev--info';
  }

  protected statusBadgeClass(st: RuleStatus): string {
    const map: Record<RuleStatus, string> = {
      ACTIVE: 'br-status--active',
      INACTIVE: 'br-status--inactive',
      DRAFT: 'br-status--draft',
      DEPRECATED: 'br-status--deprecated',
    };
    return map[st] ?? 'br-status--active';
  }

  protected scopeLabel(scope: RuleScope): string {
    const found = this.allScopes.find((s) => s.id === scope);
    return found ? found.label : scope;
  }

  protected moduleIcon(mod: RuleModule): string {
    const map: Record<RuleModule, string> = {
      RECEIVING: 'move_to_inbox',
      INVENTORY: 'shelves',
      SHIPPING: 'local_shipping',
      QUALITY: 'fact_check',
      LAYOUT: 'grid_view',
      SYSTEM: 'settings_suggest',
      SECURITY: 'shield',
    };
    return map[mod] ?? 'tune';
  }

  protected formattedValue(rule: BusinessRule): string {
    if (typeof rule.value === 'boolean') {
      return rule.value ? 'Sí (Habilitado)' : 'No (Deshabilitado)';
    }
    if (rule.unit) {
      return `${rule.value} ${rule.unit}`;
    }
    return String(rule.value);
  }

  protected ruleImpactProcesses(mod: RuleModule): string {
    const map: Record<RuleModule, string> = {
      RECEIVING: 'Recepción • Andenes • Ingresos',
      INVENTORY: 'Inventario • Conteo • Lotes',
      SHIPPING: 'Picking • Despacho • Embarque',
      QUALITY: 'Inspección • Cuarentena • Muestreo',
      LAYOUT: 'Racks • Ubicaciones • Pasillos',
      SYSTEM: 'Sincronización • Motor Base',
      SECURITY: 'Sesiones • Autenticación • RLS',
    };
    return map[mod] ?? 'Operación WMS';
  }
}
