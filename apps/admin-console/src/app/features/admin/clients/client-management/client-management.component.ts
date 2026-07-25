/**
 * @file client-management.component.ts
 * @description Componente principal de Gestión de Clientes (Depositantes / Owners 3PL) — 4GUARD WMS.
 *
 * Homologado con Gestión de Transportistas, Sucursales y Usuarios.
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

import { ClientService } from '../../services/client.service';
import { OrganizationService } from '../../services/organization.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  Client,
  ClientStatus,
  CLIENT_STATUS_LABELS,
  ClientAuditEntry,
} from '../models/client.model';

type FormMode = 'idle' | 'new' | 'edit';

/** Valida que el valor no sea únicamente espacios en blanco. */
function noWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  return (control.value as string).trim().length === 0 ? { whitespaceOnly: true } : null;
}

@Component({
  selector: 'fg-client-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './client-management.component.html',
  styleUrl: './client-management.component.css',
})
export class ClientManagementComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  protected readonly clientService = inject(ClientService);
  protected readonly orgService = inject(OrganizationService);
  private readonly toastService = inject(ToastService);
  private readonly destroy$ = new Subject<void>();

  // ─── Estado de la Vista (Signals Reactivos) ─────────────────────────────────

  protected readonly selectedClient = signal<Client | null>(null);
  protected readonly formMode = signal<FormMode>('idle');
  protected readonly submitAttempted = signal<boolean>(false);
  protected readonly saveSuccess = signal<boolean>(false);
  protected readonly backendError = signal<string | null>(null);

  // ─── Audit Logs (Línea de tiempo BE) ───────────────────────────────────────

  protected readonly auditEntries = signal<ClientAuditEntry[]>([]);
  protected readonly isLoadingAudit = signal<boolean>(false);

  // ─── Diálogo de Confirmación para Desactivación / Eliminación ───────────────

  protected readonly statusDialogOpen = signal<boolean>(false);
  protected readonly statusDialogAction = signal<'toggle' | 'delete'>('toggle');

  // ─── Filtros del Directorio (Señales Reactivas) ─────────────────────────────

  protected readonly filterText = signal<string>('');
  protected readonly filterStatus = signal<ClientStatus | ''>('');

  // ─── Organizaciones disponibles para asignación ─────────────────────────────

  protected readonly availableOrganizations = computed(() => {
    const list = this.orgService.organizations();
    if (list && list.length > 0) return list;
    return [
      { id: 'a53f0907-9fa5-4bdf-87db-2eb5e7683935', name: '4GUARD LOGISTICS CORP' }
    ];
  });

  // ─── Computed Lista Filtrada ────────────────────────────────────────────────

  protected readonly filteredClients = computed(() => {
    let list = this.clientService.clients();
    const search = this.filterText().toLowerCase().trim();
    const statusVal = this.filterStatus();

    if (search) {
      list = list.filter(c => {
        const nameMatch = (c.name || '').toLowerCase().includes(search);
        const codeMatch = (c.externalId || '').toLowerCase().includes(search);
        const orgMatch = (c.orgName || '').toLowerCase().includes(search);
        return nameMatch || codeMatch || orgMatch;
      });
    }

    if (statusVal) {
      list = list.filter(c => c.status === statusVal);
    }

    return list;
  });

  // ─── Computed KPIs ──────────────────────────────────────────────────────────

  protected readonly totalClients = computed(() => this.clientService.totalCount());
  protected readonly kpiActive    = computed(() => this.clientService.activeCount());
  protected readonly kpiInactive  = computed(() => this.clientService.inactiveCount());

  // ─── Formulario Reactivo ─────────────────────────────────────────────────────

  protected readonly form: FormGroup = this.fb.group({
    organizationId: ['a53f0907-9fa5-4bdf-87db-2eb5e7683935', [Validators.required]],
    name: ['', [Validators.required, Validators.maxLength(150), noWhitespaceValidator]],
    externalId: ['', [Validators.required, Validators.maxLength(50), noWhitespaceValidator]],
    status: ['ACTIVE', [Validators.required]],
  });

  protected readonly clientStatusLabels = CLIENT_STATUS_LABELS;

  // ─── Ciclo de Vida ───────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadOrganizations();
    this.loadClients();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Carga de Datos ──────────────────────────────────────────────────────────

  protected loadClients(): void {
    this.clientService.loadClients()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: (err: HttpErrorResponse) => {
          const msg = err?.error?.message || err?.message || 'Error al cargar los clientes.';
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

  protected clearFilters(): void {
    this.filterText.set('');
    this.filterStatus.set('');
  }

  // ─── Selección y Modos de Formulario ─────────────────────────────────────────

  protected selectClient(client: Client): void {
    this.selectedClient.set(client);
    this.formMode.set('edit');
    this.populateForm(client);
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
    this.loadAuditLogs(client.id);
  }

  protected startNewClient(): void {
    this.selectedClient.set(null);
    this.formMode.set('new');
    const defaultOrg = this.availableOrganizations()[0]?.id || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';
    this.form.reset({
      organizationId: defaultOrg,
      name: '',
      externalId: '',
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
    const client = this.selectedClient();
    if (client) {
      this.formMode.set('edit');
      this.populateForm(client);
    } else {
      this.formMode.set('idle');
    }
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
  }

  private populateForm(client: Client): void {
    this.form.patchValue({
      organizationId: client.orgId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
      name: client.name,
      externalId: client.externalId,
      status: client.status,
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  // ─── Carga de Historial de Auditoría (BE Endpoint GET /api/v1/clients/{id}/audit) ──

  protected loadAuditLogs(clientId: string): void {
    this.isLoadingAudit.set(true);
    this.auditEntries.set([]);
    this.clientService.getClientAudit(clientId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isLoadingAudit.set(false);
          this.auditEntries.set(res.data || []);
        },
        error: (err) => {
          this.isLoadingAudit.set(false);
          console.error('Error al cargar historial de auditoría del cliente:', err);
        }
      });
  }

  // ─── Guardar Cliente (Crear / Actualizar) ────────────────────────────────────

  protected saveClient(): void {
    this.submitAttempted.set(true);
    this.backendError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const mode = this.formMode();

    if (mode === 'new') {
      this.clientService.create({
        orgId: raw.organizationId,
        orgName: this.availableOrganizations().find(o => o.id === raw.organizationId)?.name || '4GUARD LOGISTICS CORP',
        name: raw.name.trim(),
        externalId: raw.externalId.trim().toUpperCase(),
        status: raw.status,
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          this.saveSuccess.set(true);
          const newClient = this.clientService.clients().find(c => c.externalId === raw.externalId.trim().toUpperCase());
          if (newClient) {
            this.selectedClient.set(newClient);
            this.loadAuditLogs(newClient.id);
          }
          this.formMode.set('edit');
          this.submitAttempted.set(false);
          this.toastService.success('Cliente creado con éxito.');
          setTimeout(() => this.saveSuccess.set(false), 3500);
        },
        error: (err: HttpErrorResponse) => this.handleBackendError(err),
      });
    } else if (mode === 'edit' && this.selectedClient()) {
      const clientId = this.selectedClient()!.id;
      this.clientService.update(clientId, {
        orgId: raw.organizationId,
        orgName: this.availableOrganizations().find(o => o.id === raw.organizationId)?.name || '4GUARD LOGISTICS CORP',
        name: raw.name.trim(),
        externalId: raw.externalId.trim().toUpperCase(),
        status: raw.status,
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          this.saveSuccess.set(true);
          const updated = this.clientService.clients().find(c => c.id === clientId);
          if (updated) {
            this.selectedClient.set(updated);
          }
          this.submitAttempted.set(false);
          this.form.markAsPristine();
          this.loadAuditLogs(clientId);
          this.toastService.success('Cliente actualizado con éxito.');
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
    const client = this.selectedClient();
    if (!client) return;

    if (this.statusDialogAction() === 'toggle') {
      this.clientService.toggleStatus(client.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            const updated = this.clientService.clients().find(c => c.id === client.id);
            if (updated) {
              this.selectedClient.set(updated);
              this.populateForm(updated);
            }
            this.closeStatusDialog();
            this.loadAuditLogs(client.id);
            this.toastService.success(`Cliente ${client.status === 'ACTIVE' ? 'desactivado' : 'activado'} con éxito.`);
          },
          error: (err: HttpErrorResponse) => {
            this.closeStatusDialog();
            this.handleBackendError(err);
          }
        });
    } else if (this.statusDialogAction() === 'delete') {
      this.clientService.delete(client.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.closeStatusDialog();
            this.selectedClient.set(null);
            this.formMode.set('idle');
            this.toastService.success('Cliente eliminado correctamente.');
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

  /** Retorna las iniciales del nombre del cliente para el avatar. */
  protected getInitials(client: Client): string {
    const words = (client.name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'CLI';
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  protected isSelectedClient(client: Client): boolean {
    return this.selectedClient()?.id === client.id;
  }

  // ─── Manejo de Errores Backend ───────────────────────────────────────────────

  private handleBackendError(err: HttpErrorResponse): void {
    const status = err.status;
    const serverMsg = err?.error?.message || err?.message;

    if (status === 409) {
      if (serverMsg?.toLowerCase().includes('externalid') || serverMsg?.toLowerCase().includes('código')) {
        this.backendError.set('El código de cliente (External ID / RFC) ya existe en el sistema.');
      } else {
        this.backendError.set(serverMsg || 'Conflicto al guardar. Verifica los datos ingresados.');
      }
    } else if (status === 404) {
      this.backendError.set('Cliente no encontrado. Es posible que haya sido eliminado.');
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
  protected get isSaving():    boolean  { return this.clientService.saving(); }
  protected get isLoading():   boolean  { return this.clientService.loading(); }
  protected get hasLoadError():boolean  { return !!this.clientService.loadError(); }
  protected get loadErrorMessage(): string { return this.clientService.loadError() ?? ''; }

  protected get isListEmpty(): boolean {
    return !this.isLoading && !this.hasLoadError && this.clientService.clients().length === 0;
  }

  protected get hasNoResults(): boolean {
    return (
      !this.isLoading &&
      !this.hasLoadError &&
      this.clientService.clients().length > 0 &&
      this.filteredClients().length === 0
    );
  }

  protected get hasActiveFilters(): boolean {
    return !!this.filterText() || !!this.filterStatus();
  }
}
