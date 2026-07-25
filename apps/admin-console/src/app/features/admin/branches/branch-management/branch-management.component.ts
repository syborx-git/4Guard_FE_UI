/**
 * @file branch-management.component.ts
 * @description Componente principal de Gestión de Sucursales (Branches) — 4GUARD WMS.
 *
 * Homologado con Gestión de Transportistas y Gestión de Usuarios.
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
  FormsModule,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { BranchService } from '../../services/branch.service';
import { OrganizationService } from '../../services/organization.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  Branch,
  BranchStatus,
  BRANCH_STATUS_LABELS,
  BranchAuditEntry,
  CreateBranchRequest,
  UpdateBranchRequest,
} from '../models/branch.model';

type FormMode = 'idle' | 'new' | 'edit';

/** Valida que el valor no sea únicamente espacios en blanco. */
function noWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  return (control.value as string).trim().length === 0 ? { whitespaceOnly: true } : null;
}

@Component({
  selector: 'fg-branch-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './branch-management.component.html',
  styleUrl: './branch-management.component.css',
})
export class BranchManagementComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  protected readonly branchService = inject(BranchService);
  protected readonly orgService = inject(OrganizationService);
  private readonly toastService = inject(ToastService);
  private readonly destroy$ = new Subject<void>();

  // ─── Estado de la Vista (Signals Reactivos) ─────────────────────────────────

  protected readonly selectedBranch = signal<Branch | null>(null);
  protected readonly formMode = signal<FormMode>('idle');
  protected readonly submitAttempted = signal<boolean>(false);
  protected readonly saveSuccess = signal<boolean>(false);
  protected readonly backendError = signal<string | null>(null);

  // ─── Audit Logs (Línea de tiempo BE) ───────────────────────────────────────

  protected readonly auditEntries = signal<BranchAuditEntry[]>([]);
  protected readonly isLoadingAudit = signal<boolean>(false);

  // ─── Diálogo de Confirmación para Desactivación / Eliminación ───────────────

  protected readonly statusDialogOpen = signal<boolean>(false);
  protected readonly statusDialogAction = signal<'toggle' | 'delete'>('toggle');

  // ─── Filtros del Directorio (Señales Reactivas) ─────────────────────────────

  protected readonly filterText = signal<string>('');
  protected readonly filterStatus = signal<BranchStatus | ''>('');

  // ─── Catálogo de Zonas Horarias ──────────────────────────────────────────────

  protected readonly timezones = [
    { value: 'America/Mexico_City', label: 'Centro (CDMX / MTY / GDL)' },
    { value: 'America/Monterrey', label: 'Noreste (Monterrey)' },
    { value: 'America/Tijuana', label: 'Pacífico (Tijuana)' },
    { value: 'America/Hermosillo', label: 'Sonora (Hermosillo)' },
    { value: 'America/Cancun', label: 'Sureste (Cancún)' },
    { value: 'UTC', label: 'Tiempo Universal (UTC)' },
  ];

  // ─── Organizaciones disponibles para asignación ─────────────────────────────

  protected readonly availableOrganizations = computed(() => {
    const list = this.orgService.organizations();
    if (list && list.length > 0) return list;
    return [
      { id: 'a53f0907-9fa5-4bdf-87db-2eb5e7683935', name: '4GUARD LOGISTICS CORP' }
    ];
  });

  // ─── Computed Lista Filtrada ────────────────────────────────────────────────

  protected readonly filteredBranches = computed(() => {
    let list = this.branchService.branches();
    const search = this.filterText().toLowerCase().trim();
    const statusVal = this.filterStatus();

    if (search) {
      list = list.filter(b => {
        const nameMatch = (b.name || '').toLowerCase().includes(search);
        const codeMatch = (b.code || '').toLowerCase().includes(search);
        const orgMatch = (b.orgName || '').toLowerCase().includes(search);
        const addrMatch = (b.addressLine1 || '').toLowerCase().includes(search);
        const tzMatch = (b.timezone || '').toLowerCase().includes(search);
        return nameMatch || codeMatch || orgMatch || addrMatch || tzMatch;
      });
    }

    if (statusVal) {
      list = list.filter(b => b.status === statusVal);
    }

    return list;
  });

  // ─── Computed KPIs ──────────────────────────────────────────────────────────

  protected readonly totalBranches = computed(() => this.branchService.totalCount());
  protected readonly kpiActive     = computed(() => this.branchService.activeCount());
  protected readonly kpiInactive   = computed(() => this.branchService.inactiveCount());

  // ─── Formulario Reactivo ─────────────────────────────────────────────────────

  protected readonly form: FormGroup = this.fb.group({
    organizationId: ['a53f0907-9fa5-4bdf-87db-2eb5e7683935', [Validators.required]],
    name: ['', [Validators.required, Validators.maxLength(150), noWhitespaceValidator]],
    code: ['', [Validators.required, Validators.maxLength(50), noWhitespaceValidator]],
    timezone: ['America/Mexico_City', [Validators.required]],
    addressLine1: ['', [Validators.required, Validators.maxLength(300), noWhitespaceValidator]],
    status: ['ACTIVE', [Validators.required]],
  });

  protected readonly branchStatusLabels = BRANCH_STATUS_LABELS;

  // ─── Ciclo de Vida ───────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadOrganizations();
    this.loadBranches();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Carga de Datos ──────────────────────────────────────────────────────────

  protected loadBranches(): void {
    this.branchService.loadBranches()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: (err: HttpErrorResponse) => {
          const msg = err?.error?.message || err?.message || 'Error al cargar las sucursales.';
          this.toastService.error(msg);
        }
      });
  }

  private loadOrganizations(): void {
    this.orgService.loadOrganizations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: (err) => console.error('Error al precargar organizaciones:', err)
      });
  }

  // ─── Filtros ─────────────────────────────────────────────────────────────────

  protected onFilterChange(): void {
    // La lista reactiva se re-calcula mediante la señal computed filteredBranches
  }

  protected clearFilters(): void {
    this.filterText.set('');
    this.filterStatus.set('');
  }

  // ─── Selección y Modos de Formulario ─────────────────────────────────────────

  protected selectBranch(branch: Branch): void {
    this.selectedBranch.set(branch);
    this.formMode.set('edit');
    this.populateForm(branch);
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
    this.loadAuditLogs(branch.id);
  }

  protected startNewBranch(): void {
    this.selectedBranch.set(null);
    this.formMode.set('new');
    const defaultOrg = this.availableOrganizations()[0]?.id || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';
    this.form.reset({
      organizationId: defaultOrg,
      name: '',
      code: '',
      timezone: 'America/Mexico_City',
      addressLine1: '',
      status: 'ACTIVE',
    });
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
    this.auditEntries.set([]);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  protected cancelForm(): void {
    const branch = this.selectedBranch();
    if (branch) {
      this.formMode.set('edit');
      this.populateForm(branch);
    } else {
      this.formMode.set('idle');
    }
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
  }

  private populateForm(branch: Branch): void {
    this.form.patchValue({
      organizationId: branch.orgId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
      name: branch.name,
      code: branch.code,
      timezone: branch.timezone || 'America/Mexico_City',
      addressLine1: branch.addressLine1,
      status: branch.status,
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  // ─── Carga de Historial de Auditoría (BE Endpoint) ──────────────────────────

  protected loadAuditLogs(branchId: string): void {
    this.isLoadingAudit.set(true);
    this.auditEntries.set([]);
    this.branchService.getBranchAudit(branchId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isLoadingAudit.set(false);
          this.auditEntries.set(res.data || []);
        },
        error: (err) => {
          this.isLoadingAudit.set(false);
          console.error('Error al cargar historial de auditoría de la sucursal:', err);
        }
      });
  }

  // ─── Guardar Sucursal (Crear / Actualizar) ────────────────────────────────────

  protected saveBranch(): void {
    this.submitAttempted.set(true);
    this.backendError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const mode = this.formMode();

    if (mode === 'new') {
      this.branchService.create({
        orgId: raw.organizationId,
        name: raw.name.trim(),
        code: raw.code.trim().toUpperCase(),
        timezone: raw.timezone,
        addressLine1: raw.addressLine1.trim(),
        status: raw.status,
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          this.saveSuccess.set(true);
          const newBranch = this.branchService.branches().find(b => b.code === raw.code.trim().toUpperCase());
          if (newBranch) {
            this.selectedBranch.set(newBranch);
            this.loadAuditLogs(newBranch.id);
          }
          this.formMode.set('edit');
          this.submitAttempted.set(false);
          this.toastService.success('Sucursal creada con éxito.');
          setTimeout(() => this.saveSuccess.set(false), 3500);
        },
        error: (err: HttpErrorResponse) => this.handleBackendError(err),
      });
    } else if (mode === 'edit' && this.selectedBranch()) {
      const branchId = this.selectedBranch()!.id;
      this.branchService.update(branchId, {
        orgId: raw.organizationId,
        name: raw.name.trim(),
        code: raw.code.trim().toUpperCase(),
        timezone: raw.timezone,
        addressLine1: raw.addressLine1.trim(),
        status: raw.status,
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          this.saveSuccess.set(true);
          const updated = this.branchService.branches().find(b => b.id === branchId);
          if (updated) {
            this.selectedBranch.set(updated);
          }
          this.submitAttempted.set(false);
          this.form.markAsPristine();
          this.loadAuditLogs(branchId);
          this.toastService.success('Sucursal actualizada con éxito.');
          setTimeout(() => this.saveSuccess.set(false), 3500);
        },
        error: (err: HttpErrorResponse) => this.handleBackendError(err),
      });
    }
  }

  // ─── Cambios de Estado & Eliminación ──────────────────────────────────────────

  protected openStatusDialog(action: 'toggle' | 'delete'): void {
    this.statusDialogAction.set(action);
    this.statusDialogOpen.set(true);
  }

  protected closeStatusDialog(): void {
    this.statusDialogOpen.set(false);
  }

  protected confirmStatusDialog(): void {
    const branch = this.selectedBranch();
    if (!branch) return;

    if (this.statusDialogAction() === 'toggle') {
      this.branchService.toggleStatus(branch.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            const updated = this.branchService.branches().find(b => b.id === branch.id);
            if (updated) {
              this.selectedBranch.set(updated);
              this.populateForm(updated);
            }
            this.closeStatusDialog();
            this.loadAuditLogs(branch.id);
            this.toastService.success(`Sucursal ${branch.status === 'ACTIVE' ? 'desactivada' : 'activada'} con éxito.`);
          },
          error: (err: HttpErrorResponse) => {
            this.closeStatusDialog();
            this.handleBackendError(err);
          }
        });
    } else if (this.statusDialogAction() === 'delete') {
      this.branchService.delete(branch.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.closeStatusDialog();
            this.selectedBranch.set(null);
            this.formMode.set('idle');
            this.toastService.success('Sucursal eliminada correctamente.');
          },
          error: (err: HttpErrorResponse) => {
            this.closeStatusDialog();
            this.handleBackendError(err);
          }
        });
    }
  }

  // ─── Helpers de Errores y Validaciones UI ────────────────────────────────────

  protected fieldHasError(name: string): boolean {
    const ctrl = this.form.get(name);
    return !!ctrl && ctrl.invalid && (ctrl.touched || this.submitAttempted());
  }

  protected getFieldError(name: string): string {
    const ctrl = this.form.get(name);
    if (!ctrl || !ctrl.errors) return '';
    if (ctrl.errors['required'])       return 'Este campo es obligatorio.';
    if (ctrl.errors['whitespaceOnly']) return 'No puede contener solo espacios.';
    if (ctrl.errors['maxlength'])      return `Máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    return 'Campo inválido.';
  }

  /** Retorna las iniciales del nombre de la sucursal para el avatar. */
  protected getInitials(branch: Branch): string {
    const words = (branch.name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'SUC';
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  protected isSelectedBranch(branch: Branch): boolean {
    return this.selectedBranch()?.id === branch.id;
  }

  // ─── Manejo de Errores Backend ───────────────────────────────────────────────

  private handleBackendError(err: HttpErrorResponse): void {
    const status = err.status;
    const serverMsg = err?.error?.message || err?.message;

    if (status === 409) {
      if (serverMsg?.toLowerCase().includes('code') || serverMsg?.toLowerCase().includes('código')) {
        this.backendError.set('El código de sucursal ingresado ya existe en el sistema.');
      } else {
        this.backendError.set(serverMsg || 'Conflicto al guardar. Verifica los datos ingresados.');
      }
    } else if (status === 404) {
      this.backendError.set('Sucursal no encontrada. Es posible que haya sido eliminada.');
    } else if (status === 400) {
      this.backendError.set(serverMsg || 'Datos inválidos. Revisa los campos del formulario.');
    } else {
      this.backendError.set('Error interno del servidor. Intenta de nuevo más tarde.');
    }
  }

  // ─── Permisos RBAC ────────────────────────────────────────────────────────────

  protected canCreate():    boolean { return true; }
  protected canUpdate():    boolean { return true; }
  protected canDelete():    boolean { return true; }
  protected canViewAudit(): boolean { return true; }

  // ─── UI State Getters ─────────────────────────────────────────────────────────

  protected get isFormDirty(): boolean  { return this.form.dirty; }
  protected get isSaving():    boolean  { return this.branchService.saving(); }
  protected get isLoading():   boolean  { return this.branchService.loading(); }
  protected get hasLoadError():boolean  { return !!this.branchService.loadError(); }
  protected get loadErrorMessage(): string { return this.branchService.loadError() ?? ''; }

  protected get isListEmpty(): boolean {
    return !this.isLoading && !this.hasLoadError && this.branchService.branches().length === 0;
  }

  protected get hasNoResults(): boolean {
    return (
      !this.isLoading &&
      !this.hasLoadError &&
      this.branchService.branches().length > 0 &&
      this.filteredBranches().length === 0
    );
  }

  protected get hasActiveFilters(): boolean {
    return !!this.filterText() || !!this.filterStatus();
  }
}
