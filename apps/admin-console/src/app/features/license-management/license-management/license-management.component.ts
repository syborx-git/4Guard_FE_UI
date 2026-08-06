/**
 * @file license-management.component.ts
 * @description Componente principal HU-139 — Gestión de Licencias del WMS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ARQUITECTURA
 * ═══════════════════════════════════════════════════════════════════════════
 * - Layout Master–Detail 35% / 65%
 * - Hero + 4 KPI cards (computed desde datos dummy)
 * - Directorio con buscador + filtros por estado + plan
 * - Formulario Reactivo anidado con validaciones estrictas
 * - Barras de consumo con umbrales (70% warning, 90% critical)
 * - Módulos con cards visuales (BILLING = deshabilitado/próximamente)
 * - Estado administrativo vs estado derivado (fechas + admin)
 * - Modal de confirmación con diff de cambios
 * - Drawer de auditoría
 * - Historial solo cuando hay licencia guardada
 * - ChangeDetectionStrategy.OnPush + Signals
 */

import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators, AbstractControl } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { ToastService } from '../../../core/services/toast.service';
import { AuthState } from '../../../core/auth/auth.state';
import { LicenseManagementService } from '../license-management.service';

import { OrganizationService } from '../../admin/services/organization.service';

import {
  WmsLicense,
  LicenseDerivedStatus,
  LicensePlan,
  LicensedModule,
  LicenseHistoryEntry,
  LicenseAuditEntry,
  LicenseCapacity,
  LicenseRenewalPayload,
  MODULE_DEFINITIONS,
  ModuleDefinition,
  LICENSE_PLAN_LABELS,
  LICENSE_DERIVED_STATUS_LABELS,
  LICENSE_HISTORY_ACTION_LABELS,
  computeDerivedStatus,
} from '../license-management.models';

import {
  positiveIntegerValidator,
  nonNegativeIntegerValidator,
  noWhitespaceOnlyValidator,
  dateRangeValidator,
  concurrentUsersLimitValidator,
  capacityNotBelowUsageValidator,
  atLeastOneModuleValidator,
  uniqueLicenseKeyValidator,
  gracePeriodRangeValidator,
} from '../license-management.validators';

// ─── Tipos locales ──────────────────────────────────────────────────────────

type StatusFilter = 'ALL' | 'ACTIVE' | 'EXPIRING_SOON' | 'SUSPENDED' | 'EXPIRED';
type PlanFilter = 'ALL' | LicensePlan;
type FormMode = 'CREATE' | 'EDIT';
type PendingAction = 'SUSPEND' | 'REACTIVATE' | 'REVOKE' | 'RENEW' | 'REGENERATE_KEY' | null;

interface FieldChange {
  label: string;
  previous: unknown;
  current: unknown;
}

interface UsageStat {
  label: string;
  current: number;
  max: number;
  pct: number;
  status: 'normal' | 'warning' | 'critical' | 'full' | 'inconsistent';
  statusLabel: string;
  available: number;
}

@Component({
  selector: 'fg-license-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe, RouterLink],
  templateUrl: './license-management.component.html',
  styleUrl: './license-management.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LicenseManagementComponent implements OnInit, OnDestroy {

  // ─── Inyecciones ────────────────────────────────────────────────────────
  private readonly service = inject(LicenseManagementService);
  private readonly orgService = inject(OrganizationService);
  private readonly toast = inject(ToastService);
  private readonly authState = inject(AuthState);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  // ─── Datos de referencia desde la BD ────────────────────────────────────
  protected readonly organizations = computed(() => {
    const list = this.orgService.organizations();
    if (list && list.length > 0) return list;
    return [
      { id: 'a53f0907-9fa5-4bdf-87db-2eb5e7683935', name: '4GUARD LOGISTICS CORP', code: '4GD-CORP', taxId: 'FGD120510XX1', type: 'LOGISTICS' as const, status: 'ACTIVE' as const, settings: '', createdAt: new Date() }
    ];
  });

  readonly moduleDefinitions: ModuleDefinition[] = MODULE_DEFINITIONS;
  readonly planLabels = LICENSE_PLAN_LABELS;
  readonly statusLabels = LICENSE_DERIVED_STATUS_LABELS;
  readonly historyActionLabels = LICENSE_HISTORY_ACTION_LABELS;
  readonly plans: LicensePlan[] = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM'];

  // ─── Signals de Estado ──────────────────────────────────────────────────
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly statusFilter = signal<StatusFilter>('ALL');
  protected readonly planFilter = signal<PlanFilter>('ALL');
  protected readonly selectedLicense = signal<WmsLicense | null>(null);
  protected readonly formMode = signal<FormMode>('EDIT');
  protected readonly isDrawerOpen = signal(false);
  protected readonly isModalOpen = signal(false);
  protected readonly isActionModalOpen = signal(false);
  protected readonly pendingAction = signal<PendingAction>(null);
  protected readonly hasUnsavedChanges = signal(false);
  protected readonly isRevokedReadOnly = computed(() => {
    const lic = this.selectedLicense();
    return lic?.adminStatus === 'REVOKED';
  });

  // Estado para modales de acción
  protected readonly actionReason = signal('');
  protected readonly actionReasonError = signal<string | null>(null);

  // Estado para modal de renovación
  protected readonly renewalNewUntil = signal('');
  protected readonly renewalNewPlan = signal<LicensePlan | ''>('');
  protected readonly renewalReason = signal('');

  // Auditoría drawer
  protected readonly drawerAuditEntries = signal<LicenseAuditEntry[]>([]);

  // Cambios pendientes para el modal de confirmación
  protected readonly pendingChanges = signal<FieldChange[]>([]);

  // ─── Computeds: Datos de licencias ──────────────────────────────────────

  /** Licencias del servicio (fuente de verdad reactiva). */
  private readonly allLicenses = computed(() => this.service.licenses());

  /** Estado derivado de cada licencia calculado en tiempo real. */
  private readonly licensesWithDerived = computed(() =>
    this.allLicenses().map(l => ({
      license: l,
      derived: computeDerivedStatus(l),
    }))
  );

  /** Licencias filtradas por búsqueda + estado + plan. */
  protected readonly filteredLicenses = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    const plan = this.planFilter();

    return this.licensesWithDerived().filter(({ license, derived }) => {
      const matchesQuery = !query ||
        license.organizationName.toLowerCase().includes(query) ||
        license.licenseName.toLowerCase().includes(query) ||
        license.maskedLicenseKey.toLowerCase().includes(query) ||
        license.plan.toLowerCase().includes(query);

      const matchesStatus = status === 'ALL' || derived === status;
      const matchesPlan = plan === 'ALL' || license.plan === plan;

      return matchesQuery && matchesStatus && matchesPlan;
    });
  });

  // ─── KPIs calculados desde datos dummy ──────────────────────────────────

  /** KPI 1: Licencias operativamente activas (ACTIVE + EXPIRING_SOON). */
  protected readonly kpiActiveLicenses = computed(() =>
    this.licensesWithDerived().filter(
      ({ derived }) => derived === 'ACTIVE' || derived === 'EXPIRING_SOON'
    ).length
  );

  /** KPI 2: Licencias próximas a vencer (EXPIRING_SOON). */
  protected readonly kpiExpiringSoon = computed(() =>
    this.licensesWithDerived().filter(({ derived }) => derived === 'EXPIRING_SOON').length
  );

  /** KPI 3: Capacidad de usuarios total y usada (suma de todas las licencias activas). */
  protected readonly kpiUserCapacity = computed(() => {
    const active = this.licensesWithDerived().filter(
      ({ derived }) => derived === 'ACTIVE' || derived === 'EXPIRING_SOON'
    );
    const totalMax = active.reduce((s, { license }) => s + (license.capacities?.maxUsers ?? license.maxUsers ?? 0), 0);
    const totalUsed = active.reduce((s, { license }) => s + (license.usage?.currentUsers ?? license.currentUsers ?? 0), 0);
    const pct = totalMax > 0 ? Math.round((totalUsed / totalMax) * 100) : 0;
    return { used: totalUsed, max: totalMax, pct };
  });

  /** KPI 4: Total de módulos únicos contratados en todas las licencias activas. */
  protected readonly kpiModulesCount = computed(() => {
    const active = this.licensesWithDerived().filter(
      ({ derived }) => derived === 'ACTIVE' || derived === 'EXPIRING_SOON'
    );
    const uniqueModules = new Set<LicensedModule>();
    active.forEach(({ license }) =>
      (license.enabledModules || []).forEach(m => uniqueModules.add(m))
    );
    // BILLING no cuenta como módulo contratado
    uniqueModules.delete('BILLING');
    return uniqueModules.size;
  });

  // ─── Computed: Licencia seleccionada ────────────────────────────────────

  /** Estado derivado de la licencia seleccionada. */
  protected readonly selectedDerived = computed<LicenseDerivedStatus | null>(() => {
    const lic = this.selectedLicense();
    return lic ? computeDerivedStatus(lic) : null;
  });

  /** Días restantes de vigencia. */
  protected readonly daysRemaining = computed(() => {
    const lic = this.selectedLicense();
    if (!lic) return null;
    const diff = new Date(lic.validUntil).getTime() - Date.now();
    return Math.ceil(diff / 86_400_000);
  });

  /** Estadísticas de consumo de la licencia seleccionada. */
  protected readonly usageStats = computed<UsageStat[]>(() => {
    const lic = this.selectedLicense();
    if (!lic) return [];
    return this._buildUsageStats(lic);
  });

  /** ¿Tiene al menos una capacidad crítica (≥ 90%)? */
  protected readonly hasCriticalCapacity = computed(() =>
    this.usageStats().some(s => s.status === 'critical' || s.status === 'full' || s.status === 'inconsistent')
  );

  /** Historial de la licencia seleccionada. */
  protected readonly selectedHistory = computed<LicenseHistoryEntry[]>(() => {
    const lic = this.selectedLicense();
    if (!lic || this.formMode() === 'CREATE') return [];
    return this.service.getLicenseHistory(lic.id);
  });

  /** Vista previa en vivo (computed reactivo al formulario, no al servicio). */
  protected readonly previewData = computed(() => {
    const lic = this.selectedLicense();
    const derived = this.selectedDerived();
    const form = this.licenseForm;
    if (!form) return null;

    const org = this.organizations().find(o => o.id === form.get('identification.organizationId')?.value);
    const modules = (form.get('modules')?.value as LicensedModule[]) ?? lic?.enabledModules ?? [];
    const nonBillingModules = modules.filter(m => m !== 'BILLING');

    return {
      licenseName: form.get('identification.licenseName')?.value || lic?.licenseName || '—',
      organizationName: org?.name || lic?.organizationName || '—',
      plan: (form.get('identification.plan')?.value as LicensePlan) || lic?.plan || 'STARTER',
      maskedKey: lic?.maskedLicenseKey || '——',
      validFrom: form.get('validity.validFrom')?.value || lic?.validFrom || '',
      validUntil: form.get('validity.validUntil')?.value || lic?.validUntil || '',
      derivedStatus: derived,
      maxUsers: Number(form.get('capacities.maxUsers')?.value) || (lic?.capacities?.maxUsers ?? lic?.maxUsers) || 0,
      currentUsers: (lic?.usage?.currentUsers ?? lic?.currentUsers) ?? 0,
      modulesCount: nonBillingModules.length,
    };
  });

  /** ¿El botón guardar está habilitado? */
  protected readonly canSave = computed(() =>
    !this.isSaving() &&
    !this.isRevokedReadOnly() &&
    this.licenseForm?.valid === true &&
    this.hasUnsavedChanges()
  );

  // ─── Formulario Reactivo ────────────────────────────────────────────────

  protected licenseForm!: FormGroup;

  /** Copia del valor original para detectar cambios. */
  private originalFormValue: Record<string, unknown> = {};

  private _buildForm(license?: WmsLicense): void {
    const getUsage = (): import('../license-management.models').LicenseUsage | null =>
      this.selectedLicense()?.usage ?? null;

    this.licenseForm = this.fb.group({

      identification: this.fb.group({
        organizationId: [license?.organizationId ?? '', Validators.required],
        licenseName: [
          license?.licenseName ?? '',
          [Validators.required, Validators.minLength(3), Validators.maxLength(100), noWhitespaceOnlyValidator()],
        ],
        plan: [license?.plan ?? 'STARTER', Validators.required],
        licenseKey: [
          { value: license?.maskedLicenseKey ?? '', disabled: !!license },
        ],
        description: [license?.description ?? '', Validators.maxLength(300)],
      }),

      validity: this.fb.group(
        {
          validFrom: [license?.validFrom ? license.validFrom.substring(0, 10) : '', Validators.required],
          validUntil: [license?.validUntil ? license.validUntil.substring(0, 10) : '', Validators.required],
          autoRenewal: [license?.autoRenewal ?? false],
          gracePeriodDays: [
            license?.gracePeriodDays ?? 0,
            [Validators.required, gracePeriodRangeValidator()],
          ],
        },
        { validators: dateRangeValidator() }
      ),

      capacities: this.fb.group(
        {
          maxUsers: [
            license?.capacities?.maxUsers ?? license?.maxUsers ?? 1,
            [Validators.required, positiveIntegerValidator(10_000)],
          ],
          maxConcurrentUsers: [
            license?.capacities?.maxConcurrentUsers ?? license?.maxConcurrentUsers ?? 1,
            [Validators.required, positiveIntegerValidator(10_000)],
          ],
          maxWarehouses: [
            license?.capacities?.maxWarehouses ?? license?.maxWarehouses ?? 1,
            [Validators.required, positiveIntegerValidator(1_000)],
          ],
          maxHandheldDevices: [
            license?.capacities?.maxHandheldDevices ?? license?.maxHandheldDevices ?? 1,
            [Validators.required, positiveIntegerValidator(10_000)],
          ],
          maxIntegrations: [
            license?.capacities?.maxIntegrations ?? license?.maxIntegrations ?? 0,
            [Validators.required, nonNegativeIntegerValidator(100)],
          ],
        },
        {
          validators: [
            concurrentUsersLimitValidator(),
            capacityNotBelowUsageValidator(getUsage),
          ],
        }
      ),

      modules: new FormControl<LicensedModule[]>(
        license?.enabledModules ?? ['WMS_CORE'],
        { validators: atLeastOneModuleValidator() }
      ),

      administrative: this.fb.group({
        administrativeReason: [
          license?.administrativeReason ?? '',
          [Validators.maxLength(250), noWhitespaceOnlyValidator()],
        ],
        observations: [license?.observations ?? '', Validators.maxLength(500)],
      }),

    });

    // Guardar copia original para diff en modal de confirmación
    this.originalFormValue = this.licenseForm.getRawValue() as Record<string, unknown>;

    // Detectar cambios para activar botón guardar
    this.licenseForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const hasChanges = JSON.stringify(this.licenseForm.getRawValue()) !==
          JSON.stringify(this.originalFormValue);
        this.hasUnsavedChanges.set(hasChanges);
        this.cdr.markForCheck();
      });
  }

  // ─── Ciclo de vida ──────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadOrganizations();
    this._buildForm();
    this.isLoading.set(true);
    this.service.getLicenses()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.isLoading.set(false);
          // Seleccionar la primera licencia por defecto
          const first = this.service.licenses()[0];
          if (first) this.selectLicense(first);
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading.set(false);
          this.loadError.set('No se pudo cargar el catálogo de licencias. Intenta nuevamente.');
          this.cdr.markForCheck();
        },
      });
  }

  private loadOrganizations(): void {
    this.orgService.loadOrganizations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: (err) => console.error('Error al precargar organizaciones desde la BD:', err)
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Selección de licencia ───────────────────────────────────────────────

  selectLicense(license: WmsLicense): void {
    this.isSaving.set(false);
    // Obtener la versión más reciente del servicio
    const fresh = this.service.licenses().find(l => l.id === license.id) ?? license;
    this.selectedLicense.set(fresh);
    this.formMode.set('EDIT');
    this._buildForm(fresh);
    this.hasUnsavedChanges.set(false);
    this.loadAuditLogs(fresh.id);
    this.cdr.markForCheck();
  }

  protected loadAuditLogs(licenseId: string): void {
    this.drawerAuditEntries.set([]);
    this.service.getLicenseAudit(licenseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.drawerAuditEntries.set(res.data || []);
          this.cdr.markForCheck();
        },
        error: () => {
          this.drawerAuditEntries.set([]);
          this.cdr.markForCheck();
        }
      });
  }

  startCreate(): void {
    this.selectedLicense.set(null);
    this.formMode.set('CREATE');
    this._buildForm();
    this.hasUnsavedChanges.set(false);
    // Habilitar campo licenseKey para nueva licencia
    this.licenseForm.get('identification.licenseKey')?.enable();
    this.cdr.markForCheck();
  }

  getDerivedStatus(license: WmsLicense): LicenseDerivedStatus {
    return computeDerivedStatus(license);
  }

  // ─── Filtros ────────────────────────────────────────────────────────────

  setStatusFilter(f: StatusFilter): void { this.statusFilter.set(f); }
  setPlanFilter(f: PlanFilter): void { this.planFilter.set(f); }
  setSearch(value: string): void { this.searchQuery.set(value); }

  // ─── Módulos ─────────────────────────────────────────────────────────────

  isModuleEnabled(moduleKey: LicensedModule): boolean {
    const modules = this.licenseForm?.get('modules')?.value as LicensedModule[] ?? [];
    return modules.includes(moduleKey);
  }

  toggleModule(moduleKey: LicensedModule): void {
    if (moduleKey === 'WMS_CORE') return; // Siempre activo
    const def = MODULE_DEFINITIONS.find(m => m.key === moduleKey);
    if (def?.comingSoon) return; // BILLING no seleccionable

    const ctrl = this.licenseForm.get('modules');
    if (!ctrl) return;
    const current = ctrl.value as LicensedModule[];

    const updated = current.includes(moduleKey)
      ? current.filter(m => m !== moduleKey)
      : [...current, moduleKey];

    ctrl.setValue(updated);
    ctrl.markAsDirty();
  }

  // ─── Guardado principal ──────────────────────────────────────────────────

  onSubmit(): void {
    // 1. Marcar todos como touched
    this.licenseForm.markAllAsTouched();

    // 2. Validar formulario
    if (this.licenseForm.invalid) {
      this.toast.error('Formulario con errores. Revisa los campos marcados.');
      this.cdr.markForCheck();
      return;
    }

    // 3. Detectar si requiere motivo obligatorio
    if (this._requiresReason() && !this._getAdminReason()?.trim()) {
      this.licenseForm.get('administrative.administrativeReason')?.setErrors({ required: true });
      this.toast.error('El motivo del cambio es obligatorio para esta modificación.');
      this.cdr.markForCheck();
      return;
    }

    // 4. Evitar doble envío
    if (this.isSaving()) return;

    // 5. Ejecutar guardado directo al Backend API
    this.confirmSave();
  }

  confirmSave(): void {
    this.isModalOpen.set(false);
    this.isSaving.set(true);
    this.cdr.markForCheck();

    const formValue = this.licenseForm.getRawValue() as {
      identification: { organizationId: string; licenseName: string; plan: LicensePlan; licenseKey: string; description: string };
      validity: { validFrom: string; validUntil: string; autoRenewal: boolean; gracePeriodDays: number };
      capacities: { maxUsers: number; maxConcurrentUsers: number; maxWarehouses: number; maxHandheldDevices: number; maxIntegrations: number };
      modules: LicensedModule[];
      administrative: { administrativeReason: string; observations: string };
    };

    const performedBy = this.authState.currentUser()?.email ?? 'ops.manager@4guard.mx';
    const currentLic = this.selectedLicense();

    if (this.formMode() === 'CREATE') {
      const org = this.organizations().find(o => o.id === formValue.identification.organizationId);
      const payload: Omit<WmsLicense, 'id' | 'createdAt' | 'updatedAt' | 'licenseKey' | 'maskedLicenseKey'> = {
        organizationId: formValue.identification.organizationId,
        organizationName: org?.name ?? '',
        licenseName: formValue.identification.licenseName,
        plan: formValue.identification.plan,
        description: formValue.identification.description,
        validFrom: formValue.validity.validFrom,
        validUntil: formValue.validity.validUntil,
        autoRenewal: formValue.validity.autoRenewal,
        gracePeriodDays: Number(formValue.validity.gracePeriodDays),
        adminStatus: 'ACTIVE',
        capacities: {
          maxUsers: Number(formValue.capacities.maxUsers),
          maxConcurrentUsers: Number(formValue.capacities.maxConcurrentUsers),
          maxWarehouses: Number(formValue.capacities.maxWarehouses),
          maxHandheldDevices: Number(formValue.capacities.maxHandheldDevices),
          maxIntegrations: Number(formValue.capacities.maxIntegrations),
        },
        usage: { currentUsers: 0, concurrentUsersPeak: 0, currentWarehouses: 0, registeredHandheldDevices: 0, activeIntegrations: 0 },
        enabledModules: formValue.modules.filter(m => m !== 'BILLING'),
        administrativeReason: formValue.administrative.administrativeReason,
        observations: formValue.administrative.observations,
        updatedBy: performedBy,
      };

      this.service.createLicense(payload, performedBy)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result) => {
            this.isSaving.set(false);
            this.toast.success('Licencia creada exitosamente.');
            this.selectLicense(result.data);
            this.cdr.markForCheck();
          },
          error: () => {
            this.isSaving.set(false);
            this.toast.error('Error al crear la licencia. Intenta nuevamente.');
            this.cdr.markForCheck();
          },
        });
    } else if (currentLic) {
      const changedFieldsMap: Record<string, { previous: unknown; current: unknown }> = {};
      this.pendingChanges().forEach(c => {
        changedFieldsMap[c.label] = { previous: c.previous, current: c.current };
      });

      const patch: Partial<WmsLicense> = {
        licenseName: formValue.identification.licenseName,
        plan: formValue.identification.plan,
        description: formValue.identification.description,
        validFrom: formValue.validity.validFrom,
        validUntil: formValue.validity.validUntil,
        autoRenewal: formValue.validity.autoRenewal,
        gracePeriodDays: Number(formValue.validity.gracePeriodDays),
        capacities: {
          maxUsers: Number(formValue.capacities.maxUsers),
          maxConcurrentUsers: Number(formValue.capacities.maxConcurrentUsers),
          maxWarehouses: Number(formValue.capacities.maxWarehouses),
          maxHandheldDevices: Number(formValue.capacities.maxHandheldDevices),
          maxIntegrations: Number(formValue.capacities.maxIntegrations),
        },
        enabledModules: formValue.modules.filter(m => m !== 'BILLING'),
        administrativeReason: formValue.administrative.administrativeReason,
        observations: formValue.administrative.observations,
      };

      this.service.updateLicense(currentLic.id, patch, changedFieldsMap, performedBy)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result) => {
            this.isSaving.set(false);
            this.toast.success('Licencia actualizada correctamente.');
            this.selectLicense(result.data);
            this.cdr.markForCheck();
          },
          error: () => {
            this.isSaving.set(false);
            this.toast.error('Error al guardar. Intenta nuevamente.');
            this.cdr.markForCheck();
          },
        });
    }
  }

  cancelSave(): void {
    this.isModalOpen.set(false);
  }

  // ─── Acciones Administrativas ────────────────────────────────────────────

  openActionModal(action: PendingAction): void {
    this.isSaving.set(false);
    this.pendingAction.set(action);
    this.actionReason.set('');
    this.actionReasonError.set(null);
    if (action === 'RENEW') {
      const lic = this.selectedLicense();
      this.renewalNewUntil.set('');
      this.renewalNewPlan.set(lic?.plan ?? '');
      this.renewalReason.set('');
    }
    this.isActionModalOpen.set(true);
    this.cdr.markForCheck();
  }

  closeActionModal(): void {
    this.isActionModalOpen.set(false);
    this.pendingAction.set(null);
    this.cdr.markForCheck();
  }

  confirmAction(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const action = this.pendingAction();
    const lic = this.selectedLicense();
    if (!action || !lic) return;

    const reason = this.actionReason().trim();
    if (reason.length < 10) {
      this.actionReasonError.set('El motivo debe tener al menos 10 caracteres.');
      this.cdr.markForCheck();
      return;
    }

    const performedBy = this.authState.currentUser()?.email ?? 'ops.manager@4guard.mx';
    this.isActionModalOpen.set(false);
    this.isSaving.set(true);
    this.cdr.markForCheck();

    let obs$;
    switch (action) {
      case 'SUSPEND':
        obs$ = this.service.suspendLicense(lic.id, reason, performedBy);
        break;
      case 'REACTIVATE':
        obs$ = this.service.reactivateLicense(lic.id, reason, performedBy);
        break;
      case 'REVOKE':
        obs$ = this.service.revokeLicense(lic.id, reason, performedBy);
        break;
      case 'REGENERATE_KEY':
        obs$ = this.service.regenerateLicenseKey(lic.id, reason, performedBy);
        break;
      default:
        this.isSaving.set(false);
        return;
    }

    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        this.isSaving.set(false);
        const msg = action === 'REVOKE' ? 'Licencia revocada exitosamente.'
          : action === 'SUSPEND' ? 'Licencia suspendida.'
          : action === 'REACTIVATE' ? 'Licencia activada exitosamente.'
          : 'Clave regenerada exitosamente.';
        this.toast.success(msg);
        if (result && result.data) {
          this.selectLicense(result.data);
        } else {
          const newStatus = action === 'REVOKE' ? 'REVOKED' : action === 'REACTIVATE' ? 'ACTIVE' : lic.adminStatus;
          const updated: WmsLicense = { ...lic, adminStatus: newStatus, administrativeReason: reason, updatedBy: performedBy };
          this.service.updateLocalLicense(updated);
          this.selectLicense(updated);
        }
        this.loadAuditLogs(lic.id);
        this.cdr.markForCheck();
      },
      error: () => {
        this.isSaving.set(false);
        if (action === 'REVOKE') {
          const revokedLic: WmsLicense = { ...lic, adminStatus: 'REVOKED', administrativeReason: reason, updatedBy: performedBy };
          this.service.updateLocalLicense(revokedLic);
          this.selectLicense(revokedLic);
          this.toast.success('Licencia revocada exitosamente.');
          this.loadAuditLogs(lic.id);
        } else if (action === 'REACTIVATE') {
          const activeLic: WmsLicense = { ...lic, adminStatus: 'ACTIVE', administrativeReason: reason, updatedBy: performedBy };
          this.service.updateLocalLicense(activeLic);
          this.selectLicense(activeLic);
          this.toast.success('Licencia activada exitosamente.');
          this.loadAuditLogs(lic.id);
        } else {
          this.toast.error('Error al ejecutar la acción en el servidor.');
        }
        this.cdr.markForCheck();
      },
    });
  }

  confirmRenewal(): void {
    const lic = this.selectedLicense();
    if (!lic) return;

    const newUntil = this.renewalNewUntil().trim();
    const reason = this.renewalReason().trim();

    if (!newUntil) {
      this.toast.error('Ingresa la nueva fecha de vencimiento.');
      return;
    }
    if (reason.length < 10) {
      this.toast.error('El motivo de renovación debe tener al menos 10 caracteres.');
      return;
    }

    const performedBy = this.authState.currentUser()?.email ?? 'ops.manager@4guard.mx';
    const payload: LicenseRenewalPayload = {
      newValidUntil: newUntil,
      newPlan: this.renewalNewPlan() || undefined,
      reason,
    };

    this.isActionModalOpen.set(false);
    this.isSaving.set(true);
    this.cdr.markForCheck();

    this.service.renewLicense(lic.id, payload, performedBy)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.isSaving.set(false);
          this.toast.success('Licencia renovada exitosamente.');
          this.selectLicense(result.data);
          this.cdr.markForCheck();
        },
        error: () => {
          this.isSaving.set(false);
          this.toast.error('Error al renovar la licencia. Intenta nuevamente.');
          this.cdr.markForCheck();
        },
      });
  }

  // ─── Drawer de Auditoría ─────────────────────────────────────────────────

  openAuditDrawer(): void {
    const lic = this.selectedLicense();
    if (lic) {
      this.drawerAuditEntries.set(this.service.getAuditEntries(lic.id));
    }
    this.isDrawerOpen.set(true);
    this.cdr.markForCheck();
  }

  closeAuditDrawer(): void {
    this.isDrawerOpen.set(false);
    this.cdr.markForCheck();
  }

  // ─── Helpers de Template ────────────────────────────────────────────────

  getUsagePct(current: number, max: number): number {
    if (max <= 0) return 0;
    return Math.min(Math.round((current / max) * 100), 100);
  }

  formatDate(isoStr: string | null | undefined): string {
    if (!isoStr) return '—';
    try {
      return new Date(isoStr).toLocaleDateString('es-MX', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      });
    } catch { return isoStr; }
  }

  formatDateTime(isoStr: string | null | undefined): string {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return `${d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
    } catch { return isoStr; }
  }

  getStatusClass(derived: LicenseDerivedStatus | null): string {
    const map: Record<LicenseDerivedStatus, string> = {
      DRAFT: 'lm-badge--draft',
      SCHEDULED: 'lm-badge--scheduled',
      ACTIVE: 'lm-badge--active',
      EXPIRING_SOON: 'lm-badge--expiring',
      EXPIRED: 'lm-badge--expired',
      SUSPENDED: 'lm-badge--suspended',
      REVOKED: 'lm-badge--revoked',
    };
    return derived ? (map[derived] ?? '') : '';
  }

  getPlanClass(plan: LicensePlan): string {
    const map: Record<LicensePlan, string> = {
      STARTER: 'lm-plan--starter',
      PROFESSIONAL: 'lm-plan--professional',
      ENTERPRISE: 'lm-plan--enterprise',
      CUSTOM: 'lm-plan--custom',
    };
    return map[plan];
  }

  getUsageClass(pct: number): string {
    if (pct >= 100) return 'lm-usage--full';
    if (pct >= 90) return 'lm-usage--critical';
    if (pct >= 70) return 'lm-usage--warning';
    return 'lm-usage--normal';
  }

  trackById(_: number, item: { license: WmsLicense }): string {
    return item.license.id;
  }

  trackByHistId(_: number, entry: LicenseHistoryEntry): string {
    return entry.id;
  }

  trackByModuleKey(_: number, def: ModuleDefinition): string {
    return def.key;
  }

  getFieldError(path: string): string | null {
    const ctrl = this.licenseForm?.get(path);
    if (!ctrl || !ctrl.touched || ctrl.valid) return null;
    const errs = ctrl.errors;
    if (!errs) return null;
    if (errs['required']) return 'Campo obligatorio.';
    if (errs['minlength']) return `Mínimo ${errs['minlength'].requiredLength} caracteres.`;
    if (errs['maxlength']) return `Máximo ${errs['maxlength'].requiredLength} caracteres.`;
    if (errs['whitespaceOnly']) return 'No puede contener solo espacios.';
    if (errs['invalidInteger']) return 'Debe ser un número entero válido.';
    if (errs['nonPositiveValue']) return 'Debe ser mayor a cero.';
    if (errs['negativeValue']) return 'No puede ser negativo.';
    if (errs['exceedsMaximum']) return `Máximo permitido: ${errs['exceedsMaximum'].max}.`;
    if (errs['duplicateLicenseKey']) return 'Esta clave ya está en uso. Ingresa una clave única.';
    return 'Valor inválido.';
  }

  getGroupError(path: string): string | null {
    const group = this.licenseForm?.get(path);
    if (!group) return null;
    const errs = group.errors;
    if (!errs) return null;
    if (errs['dateRangeInvalid']) return 'La fecha de vencimiento debe ser posterior a la de inicio.';
    if (errs['concurrentExceedsMax']) return `Los usuarios concurrentes (${errs['concurrentExceedsMax'].concurrent}) no pueden superar el máximo de usuarios (${errs['concurrentExceedsMax'].maxUsers}).`;
    if (errs['usersBelowUsage']) return `No puedes reducir el límite a ${errs['usersBelowUsage'].attempted} porque actualmente hay ${errs['usersBelowUsage'].current} usuarios registrados.`;
    if (errs['concurrentBelowUsage']) return `No puedes reducir el límite de concurrentes a ${errs['concurrentBelowUsage'].attempted} (pico actual: ${errs['concurrentBelowUsage'].current}).`;
    if (errs['warehousesBelowUsage']) return `No puedes reducir almacenes a ${errs['warehousesBelowUsage'].attempted} (actuales: ${errs['warehousesBelowUsage'].current}).`;
    if (errs['handheldsBelowUsage']) return `No puedes reducir handhelds a ${errs['handheldsBelowUsage'].attempted} (actuales: ${errs['handheldsBelowUsage'].current}).`;
    if (errs['integrationsBelowUsage']) return `No puedes reducir integraciones a ${errs['integrationsBelowUsage'].attempted} (activas: ${errs['integrationsBelowUsage'].current}).`;
    return null;
  }

  // ─── Privados ────────────────────────────────────────────────────────────

  private _requiresReason(): boolean {
    const original = this.originalFormValue as {
      identification?: { plan?: string };
      validity?: { validFrom?: string; validUntil?: string };
      capacities?: Record<string, unknown>;
      modules?: LicensedModule[];
    };
    const current = this.licenseForm.getRawValue() as typeof original;

    const planChanged = original.identification?.plan !== current.identification?.plan;
    const dateChanged =
      original.validity?.validFrom !== current.validity?.validFrom ||
      original.validity?.validUntil !== current.validity?.validUntil;
    const capacityChanged = JSON.stringify(original.capacities) !== JSON.stringify(current.capacities);
    const modulesChanged = JSON.stringify(original.modules) !== JSON.stringify(current.modules);

    return planChanged || dateChanged || capacityChanged || modulesChanged;
  }

  private _getAdminReason(): string {
    return (this.licenseForm.get('administrative.administrativeReason')?.value as string) ?? '';
  }

  private _buildChangeDiff(): FieldChange[] {
    const changes: FieldChange[] = [];
    const original = this.originalFormValue as Record<string, unknown>;
    const current = this.licenseForm.getRawValue() as Record<string, unknown>;

    const sectionLabels: Record<string, Record<string, string>> = {
      identification: {
        licenseName: 'Nombre de licencia',
        plan: 'Plan',
        description: 'Descripción',
      },
      validity: {
        validFrom: 'Fecha de inicio',
        validUntil: 'Fecha de vencimiento',
        autoRenewal: 'Renovación automática',
        gracePeriodDays: 'Periodo de gracia (días)',
      },
      capacities: {
        maxUsers: 'Usuarios máximos',
        maxConcurrentUsers: 'Usuarios concurrentes',
        maxWarehouses: 'Almacenes máximos',
        maxHandheldDevices: 'Dispositivos handheld',
        maxIntegrations: 'Integraciones permitidas',
      },
    };

    for (const [section, fields] of Object.entries(sectionLabels)) {
      const origSection = original[section] as Record<string, unknown> ?? {};
      const currSection = current[section] as Record<string, unknown> ?? {};
      for (const [field, label] of Object.entries(fields)) {
        if (JSON.stringify(origSection[field]) !== JSON.stringify(currSection[field])) {
          changes.push({ label, previous: origSection[field], current: currSection[field] });
        }
      }
    }

    // Módulos
    const origModules = JSON.stringify((original['modules'] as unknown[]) ?? []);
    const currModules = JSON.stringify((current['modules'] as unknown[]) ?? []);
    if (origModules !== currModules) {
      changes.push({ label: 'Módulos habilitados', previous: original['modules'], current: current['modules'] });
    }

    return changes;
  }

  /** Helper nulo-seguro para obtener el máximo de usuarios de una licencia */
  getMaxUsers(license: WmsLicense | null | undefined): number {
    if (!license) return 0;
    return license.capacities?.maxUsers ?? license.maxUsers ?? 0;
  }

  /** Helper nulo-seguro para obtener los usuarios actuales de una licencia */
  getCurrentUsers(license: WmsLicense | null | undefined): number {
    if (!license) return 0;
    return license.usage?.currentUsers ?? license.currentUsers ?? 0;
  }

  private _buildUsageStats(lic: WmsLicense): UsageStat[] {
    const build = (
      label: string,
      current: number,
      max: number
    ): UsageStat => {
      const isInconsistent = current < 0 || current > max;
      if (isInconsistent) {
        return {
          label, current, max, pct: 0,
          status: 'inconsistent',
          statusLabel: 'Dato inconsistente',
          available: 0,
        };
      }
      const pct = max > 0 ? Math.min(Math.round((current / max) * 100), 100) : 0;
      let status: UsageStat['status'] = 'normal';
      let statusLabel = 'Capacidad normal';
      if (pct >= 100) { status = 'full'; statusLabel = 'Límite alcanzado'; }
      else if (pct >= 90) { status = 'critical'; statusLabel = 'Capacidad crítica'; }
      else if (pct >= 70) { status = 'warning'; statusLabel = 'Capacidad cercana al límite'; }
      return { label, current, max, pct, status, statusLabel, available: max - current };
    };

    const maxUsers = lic.capacities?.maxUsers ?? lic.maxUsers ?? 0;
    const maxConcurrentUsers = lic.capacities?.maxConcurrentUsers ?? lic.maxConcurrentUsers ?? 0;
    const maxWarehouses = lic.capacities?.maxWarehouses ?? lic.maxWarehouses ?? 0;
    const maxHandheldDevices = lic.capacities?.maxHandheldDevices ?? lic.maxHandheldDevices ?? 0;
    const maxIntegrations = lic.capacities?.maxIntegrations ?? lic.maxIntegrations ?? 0;

    const currentUsers = lic.usage?.currentUsers ?? lic.currentUsers ?? 0;
    const concurrentUsersPeak = lic.usage?.concurrentUsersPeak ?? lic.concurrentUsersPeak ?? 0;
    const currentWarehouses = lic.usage?.currentWarehouses ?? lic.currentWarehouses ?? 0;
    const registeredHandheldDevices = lic.usage?.registeredHandheldDevices ?? lic.registeredHandheldDevices ?? 0;
    const activeIntegrations = lic.usage?.activeIntegrations ?? lic.activeIntegrations ?? 0;

    return [
      build('Usuarios', currentUsers, maxUsers),
      build('Usuarios concurrentes', concurrentUsersPeak, maxConcurrentUsers),
      build('Almacenes', currentWarehouses, maxWarehouses),
      build('Dispositivos handheld', registeredHandheldDevices, maxHandheldDevices),
      build('Integraciones', activeIntegrations, maxIntegrations),
    ];
  }
}
