import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import {
  OrganizationService,
  Organization,
  OrganizationType,
  OrganizationStatus,
  OrganizationAuditLogDto
} from '../services/organization.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialogComponent } from '../users/confirm-dialog/confirm-dialog.component';

type FormMode = 'idle' | 'new' | 'edit';

function noWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  return (control.value as string).trim().length === 0 ? { whitespaceOnly: true } : null;
}

function jsonSyntaxValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  try {
    JSON.parse(control.value);
    return null;
  } catch (e) {
    return { invalidJson: true };
  }
}

@Component({
  selector: 'fg-organization-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ConfirmDialogComponent,
  ],
  templateUrl: './organization-management.component.html',
  styleUrl: './organization-management.component.css'
})
export class OrganizationManagementComponent implements OnInit, OnDestroy {
  // ── Servicios ────────────────────────────────────────────
  private readonly fb = inject(FormBuilder);
  protected readonly orgService = inject(OrganizationService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  // ── Estado de la vista ───────────────────────────────────
  protected readonly selectedOrg = signal<Organization | null>(null);
  protected readonly formMode = signal<FormMode>('idle');
  protected readonly submitAttempted = signal<boolean>(false);
  protected readonly saveSuccess = signal<boolean>(false);
  protected readonly backendError = signal<string | null>(null);
  protected readonly isLoadingOrgs = signal<boolean>(true);
  protected readonly loadOrgsError = signal<string | null>(null);

  // ── Audit Logs ───────────────────────────────────────────
  protected readonly auditEntries = signal<OrganizationAuditLogDto[]>([]);
  protected readonly isLoadingAudit = signal<boolean>(false);

  // ── Filtros del directorio (Señales Reactivas) ─────────────
  protected readonly filterText = signal('');
  protected readonly filterStatus = signal<OrganizationStatus | ''>('');
  protected readonly filterType = signal<OrganizationType | ''>('');

  // ── Estado: Eliminación de Organización ──────────────────
  protected readonly deletingOrg = signal<Organization | null>(null);
  protected readonly isDeleting = signal(false);

  // ── Formulario Reactivo ─────────────────────────────────
  protected readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100), noWhitespaceValidator]],
    code: ['', [Validators.required, Validators.maxLength(50), noWhitespaceValidator]],
    taxId: ['', [Validators.maxLength(30)]],
    type: ['LOGISTICS', Validators.required],
    status: ['ACTIVE', Validators.required],
    settings: ['{\n  "theme": "dark",\n  "notifications_email": "true",\n  "max_branches": "5"\n}', [Validators.required, jsonSyntaxValidator]]
  });

  // ── Tipos de Organización Disponibles ─────────────────────
  protected readonly organizationTypes: { value: OrganizationType; label: string; icon: string }[] = [
    { value: 'LOGISTICS', label: 'Operador Logístico (3PL)', icon: 'local_shipping' },
    { value: 'WAREHOUSE', label: 'Almacén / Depósito', icon: 'warehouse' },
    { value: 'DISTRIBUTION', label: 'Centro de Distribución', icon: 'hub' },
    { value: 'MANUFACTURING', label: 'Planta de Manufactura', icon: 'factory' },
    { value: 'RETAIL', label: 'Comercio Retail', icon: 'storefront' },
    { value: 'THIRD_PARTY', label: 'Terceros (External Owner)', icon: 'partner_exchange' },
  ];

  // ── Computed KPIs ────────────────────────────────────────
  protected readonly totalOrgs = computed(() => this.orgService.organizations().length);
  protected readonly kpiActive = computed(() => this.orgService.organizations().filter(o => o.status === 'ACTIVE').length);
  protected readonly kpiSuspended = computed(() => this.orgService.organizations().filter(o => o.status === 'SUSPENDED' || o.status === 'INACTIVE').length);
  protected readonly kpiUniqueTypes = computed(() => new Set(this.orgService.organizations().map(o => o.type)).size);

  // ── Computed Lista Filtrada (Reactiva en tiempo real) ─────
  protected readonly filteredOrganizations = computed(() => {
    let list = this.orgService.organizations();
    const search = this.filterText().toLowerCase().trim();
    const statusVal = this.filterStatus();
    const typeVal = this.filterType();

    if (search) {
      list = list.filter(o => {
        const name = (o.name || '').toLowerCase();
        const code = (o.code || '').toLowerCase();
        const taxId = (o.taxId || '').toLowerCase();
        return name.includes(search) || code.includes(search) || taxId.includes(search);
      });
    }

    if (statusVal) {
      list = list.filter(o => o.status === statusVal);
    }

    if (typeVal) {
      list = list.filter(o => o.type === typeVal);
    }

    return list;
  });

  // ── Ciclo de Vida ────────────────────────────────────────
  ngOnInit(): void {
    this.loadOrganizations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Navegación a Dashboard / Menú ────────────────────────
  protected goBack(): void {
    this.router.navigate(['/admin']);
  }

  // ── Carga de Organizaciones ─────────────────────────────
  protected loadOrganizations(): void {
    this.isLoadingOrgs.set(true);
    this.loadOrgsError.set(null);
    this.orgService.loadOrganizations().pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isLoadingOrgs.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoadingOrgs.set(false);
        const msg = err?.error?.message || 'Error al cargar las organizaciones del backend.';
        this.loadOrgsError.set(msg);
        this.toastService.error(msg);
      }
    });
  }

  // ── Carga de Auditoría ──────────────────────────────────
  protected loadAuditLogs(orgId: string): void {
    this.isLoadingAudit.set(true);
    this.orgService.getAuditHistory(orgId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        this.isLoadingAudit.set(false);
        if (response && response.data) {
          this.auditEntries.set(response.data);
        } else {
          this.auditEntries.set([]);
        }
      },
      error: (err) => {
        this.isLoadingAudit.set(false);
        console.error('Error al cargar la auditoría de la organización:', err);
        this.auditEntries.set([]);
      }
    });
  }

  // ── Selección y Filtros ──────────────────────────────────
  protected clearFilters(): void {
    this.filterText.set('');
    this.filterStatus.set('');
    this.filterType.set('');
  }

  protected selectOrg(org: Organization): void {
    this.selectedOrg.set(org);
    this.formMode.set('edit');
    this.populateForm(org);
    this.loadAuditLogs(org.id);
  }

  protected openNewForm(): void {
    this.selectedOrg.set(null);
    this.formMode.set('new');
    this.submitAttempted.set(false);
    this.saveSuccess.set(false);
    this.backendError.set(null);
    this.auditEntries.set([]);

    this.form.reset({
      name: '',
      code: '',
      taxId: '',
      type: 'LOGISTICS',
      status: 'ACTIVE',
      settings: '{\n  "theme": "dark",\n  "notifications_email": "true",\n  "max_branches": "5"\n}'
    });

    this.form.get('code')?.enable();
  }

  protected cancelForm(): void {
    const current = this.selectedOrg();
    if (current) {
      this.populateForm(current);
      this.formMode.set('edit');
    } else {
      this.formMode.set('idle');
      this.form.reset();
    }
  }

  private populateForm(org: Organization): void {
    this.submitAttempted.set(false);
    this.saveSuccess.set(false);
    this.backendError.set(null);

    this.form.patchValue({
      name: org.name,
      code: org.code,
      taxId: org.taxId,
      type: org.type,
      status: org.status,
      settings: org.settings
    });

    // Código inmutable en edición
    this.form.get('code')?.disable();
  }

  // ── Formateo Automático de JSONB ─────────────────────────
  protected formatSettingsJson(): void {
    const val = this.form.get('settings')?.value;
    if (!val) return;
    try {
      const parsed = JSON.parse(val);
      const formatted = JSON.stringify(parsed, null, 2);
      this.form.patchValue({ settings: formatted });
    } catch (e) {
      this.toastService.warning('Sintaxis JSON no válida. Revisa la estructura.');
    }
  }

  // ── Guardar (Alta / Modificación) ───────────────────────
  protected saveOrg(): void {
    this.submitAttempted.set(true);
    this.backendError.set(null);
    this.saveSuccess.set(false);

    if (this.form.invalid) {
      this.toastService.error('Revisa los campos del formulario antes de guardar.');
      return;
    }

    const formVal = this.form.getRawValue();

    if (this.formMode() === 'new') {
      const payload: Omit<Organization, 'id' | 'createdAt'> = {
        name: formVal.name.trim(),
        code: formVal.code.trim().toUpperCase(),
        taxId: formVal.taxId ? formVal.taxId.trim().toUpperCase() : '',
        type: formVal.type,
        status: formVal.status,
        settings: formVal.settings
      };

      this.orgService.create(payload).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          this.saveSuccess.set(true);
          this.toastService.success('Organización creada con éxito.');
          if (res.data) {
            const newOrg = this.orgService.organizations().find(o => o.id === res.data?.id);
            if (newOrg) this.selectOrg(newOrg);
          }
        },
        error: (err: HttpErrorResponse) => {
          const msg = err?.error?.message || 'Error al crear la organización.';
          this.backendError.set(msg);
          this.toastService.error(msg);
        }
      });
    } else if (this.formMode() === 'edit' && this.selectedOrg()) {
      const id = this.selectedOrg()!.id;
      const payload: Partial<Organization> = {
        name: formVal.name.trim(),
        taxId: formVal.taxId ? formVal.taxId.trim().toUpperCase() : '',
        type: formVal.type,
        status: formVal.status,
        settings: formVal.settings
      };

      this.orgService.update(id, payload).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          this.saveSuccess.set(true);
          this.toastService.success('Organización actualizada con éxito.');
          if (res.data) {
            const updated = this.orgService.organizations().find(o => o.id === id);
            if (updated) {
              this.selectedOrg.set(updated);
              this.loadAuditLogs(id);
            }
          }
        },
        error: (err: HttpErrorResponse) => {
          const msg = err?.error?.message || 'Error al actualizar la organización.';
          this.backendError.set(msg);
          this.toastService.error(msg);
        }
      });
    }
  }

  // ── Cambiar Estado Operativo (Toggle) ────────────────────
  protected toggleOrgStatus(org: Organization): void {
    this.orgService.toggleStatus(org.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        const nextStatus = org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        this.toastService.success(`Organización ${org.name} pasó a estado ${nextStatus}.`);
        if (this.selectedOrg()?.id === org.id) {
          const updated = this.orgService.organizations().find(o => o.id === org.id);
          if (updated) this.selectOrg(updated);
        }
      },
      error: (err) => {
        this.toastService.error(err?.error?.message || 'No se pudo cambiar el estado de la organización.');
      }
    });
  }

  // ── Eliminación ──────────────────────────────────────────
  protected promptDelete(org: Organization): void {
    this.deletingOrg.set(org);
  }

  protected cancelDelete(): void {
    this.deletingOrg.set(null);
  }

  protected confirmDelete(): void {
    const org = this.deletingOrg();
    if (!org) return;

    this.isDeleting.set(true);
    this.orgService.delete(org.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.deletingOrg.set(null);
        this.toastService.success(`Organización ${org.name} eliminada.`);

        if (this.selectedOrg()?.id === org.id) {
          this.selectedOrg.set(null);
          this.formMode.set('idle');
          this.form.reset();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.isDeleting.set(false);
        this.deletingOrg.set(null);
        this.toastService.error(err?.error?.message || 'Error al eliminar la organización.');
      }
    });
  }

  // ── Helpers de UI ────────────────────────────────────────
  protected getTypeLabel(type: OrganizationType): string {
    const found = this.organizationTypes.find(t => t.value === type);
    return found ? found.label : type;
  }

  protected getStatusBadgeClass(status: OrganizationStatus): string {
    switch (status) {
      case 'ACTIVE': return 'badge-success';
      case 'SUSPENDED': return 'badge-warning';
      case 'INACTIVE': return 'badge-danger';
      default: return 'badge-neutral';
    }
  }

  protected getStatusLabel(status: OrganizationStatus): string {
    switch (status) {
      case 'ACTIVE': return 'ACTIVA';
      case 'SUSPENDED': return 'SUSPENDIDA';
      case 'INACTIVE': return 'INACTIVA';
      default: return status;
    }
  }

  protected fieldHasError(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl && ctrl.invalid && (ctrl.touched || this.submitAttempted()));
  }

  protected getFieldError(field: string): string {
    const ctrl = this.form.get(field);
    if (!ctrl || !ctrl.errors) return '';
    if (ctrl.errors['required']) return 'Este campo es obligatorio.';
    if (ctrl.errors['maxlength']) return `Máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    if (ctrl.errors['whitespaceOnly']) return 'No se permiten sólo espacios en blanco.';
    if (ctrl.errors['invalidJson']) return 'Estructura JSON inválida. Verifique sintaxis.';
    return 'Campo inválido.';
  }

  protected isSelectedOrg(org: Organization): boolean {
    return this.selectedOrg()?.id === org.id;
  }

  protected get hasActiveFilters(): boolean {
    return !!this.filterText() || !!this.filterStatus() || !!this.filterType();
  }

  protected getAuditNodeColor(action: string): string {
    switch (action) {
      case 'ORGANIZATION_CREATED': return 'org-tl-node--green';
      case 'ORGANIZATION_UPDATED': return 'org-tl-node--gold';
      case 'ORGANIZATION_DELETED': return 'org-tl-node--red';
      default: return 'org-tl-node--blue';
    }
  }

  protected getAuditSummary(action: string): string {
    switch (action) {
      case 'ORGANIZATION_CREATED': return 'Organización registrada en el sistema Multi-Tenant';
      case 'ORGANIZATION_UPDATED': return 'Modificación de parámetros / estatus operativo';
      case 'ORGANIZATION_DELETED': return 'Eliminación de tenant';
      default: return action;
    }
  }
}
