/**
 * @file sku-management.component.ts
 * @description Componente principal de Catálogo de Productos / SKUs — 4GUARD WMS.
 * Homologado con Gestión de Transportistas, Clientes, Sucursales y Usuarios.
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

import { SkuService } from '../../services/sku.service';
import { ClientService } from '../../services/client.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  ProductSku,
  ProductSkuStatus,
  ProductSkuAuditLog,
  UNIT_OPTIONS,
} from '../models/sku.model';

type FormMode = 'idle' | 'new' | 'edit';

/** Valida que el valor no sea únicamente espacios en blanco. */
function noWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  return (control.value as string).trim().length === 0 ? { whitespaceOnly: true } : null;
}

@Component({
  selector: 'fg-sku-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './sku-management.component.html',
  styleUrl: './sku-management.component.css',
})
export class SkuManagementComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  protected readonly skuService = inject(SkuService);
  protected readonly clientService = inject(ClientService);
  private readonly toastService = inject(ToastService);
  private readonly destroy$ = new Subject<void>();

  // ─── Estado de la Vista (Signals Reactivos) ─────────────────────────────────

  protected readonly selectedSku = signal<ProductSku | null>(null);
  protected readonly formMode = signal<FormMode>('idle');
  protected readonly submitAttempted = signal<boolean>(false);
  protected readonly saveSuccess = signal<boolean>(false);
  protected readonly backendError = signal<string | null>(null);

  // ─── Audit Logs (Línea de tiempo BE) ───────────────────────────────────────

  protected readonly auditEntries = signal<ProductSkuAuditLog[]>([]);
  protected readonly isLoadingAudit = signal<boolean>(false);

  // ─── Diálogo de Confirmación para Eliminación Lógica ────────────────────────

  protected readonly statusDialogOpen = signal<boolean>(false);

  // ─── Filtros del Directorio (Señales Reactivas) ─────────────────────────────

  protected readonly filterText = signal<string>('');
  protected readonly filterClientId = signal<string>('');
  protected readonly filterStatus = signal<string>(''); // '' | 'ACTIVE' | 'INACTIVE'

  // ─── Paginación Reactiva del Directorio ─────────────────────────────────────

  protected readonly pageSize = signal<number>(10);
  protected readonly currentPage = signal<number>(1);
  protected readonly pageSizeOptions: number[] = [10, 30, 50];

  // ─── Opciones Estándar de Unidades ──────────────────────────────────────────

  protected readonly unitOptions = UNIT_OPTIONS;

  // ─── Clientes Depositantes Disponibles ──────────────────────────────────────

  protected readonly availableClients = computed(() => {
    const list = this.clientService.clients();
    if (list && list.length > 0) return list;
    return [
      { id: '55c89bd2-24e5-42da-b1af-c39434c251dc', name: 'Nestlé México' }
    ];
  });

  // ─── Computed Lista Filtrada ────────────────────────────────────────────────

  protected readonly filteredSkus = computed(() => {
    let list = this.skuService.skus();
    const search = this.filterText().toLowerCase().trim();
    const clientVal = this.filterClientId();
    const statusVal = this.filterStatus();

    if (search) {
      list = list.filter(s => {
        const codeMatch = (s.code || '').toLowerCase().includes(search);
        const nameMatch = (s.name || '').toLowerCase().includes(search);
        const descMatch = (s.description || '').toLowerCase().includes(search);
        const clientMatch = (s.clientName || '').toLowerCase().includes(search);
        return codeMatch || nameMatch || descMatch || clientMatch;
      });
    }

    if (clientVal) {
      list = list.filter(s => s.clientId === clientVal);
    }

    if (statusVal) {
      list = list.filter(s => (s.status || 'ACTIVE') === statusVal);
    }

    return list;
  });

  // ─── Computed Paginación ────────────────────────────────────────────────────

  protected readonly totalPages = computed(() => {
    return Math.ceil(this.filteredSkus().length / this.pageSize()) || 1;
  });

  protected readonly paginatedSkus = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredSkus().slice(start, start + this.pageSize());
  });

  protected readonly startIndex = computed(() => {
    if (this.filteredSkus().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  protected readonly endIndex = computed(() => {
    return Math.min(this.currentPage() * this.pageSize(), this.filteredSkus().length);
  });

  // ─── Computed KPIs ──────────────────────────────────────────────────────────

  protected readonly totalSkus    = computed(() => this.skuService.totalCount());
  protected readonly activeSkus   = computed(() => this.skuService.activeCount());
  protected readonly inactiveSkus = computed(() => this.skuService.inactiveCount());

  // ─── Formulario Reactivo ─────────────────────────────────────────────────────

  protected readonly form: FormGroup = this.fb.group({
    clientId: ['', [Validators.required]],
    code: ['', [Validators.required, Validators.maxLength(50), noWhitespaceValidator]],
    name: ['', [Validators.required, Validators.maxLength(200), noWhitespaceValidator]],
    description: ['', [Validators.maxLength(500)]],
    weight: [1.000, [Validators.required, Validators.min(0)]],
    unit: ['BOX', [Validators.required]],
    status: ['ACTIVE', [Validators.required]],
  });

  // ─── Ciclo de Vida ───────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadClients();
    this.loadSkus();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Carga de Datos ──────────────────────────────────────────────────────────

  protected loadSkus(): void {
    this.skuService.loadSkus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: (err: HttpErrorResponse) => {
          const msg = err?.error?.message || err?.message || 'Error al cargar los SKUs.';
          this.toastService.error(msg);
        }
      });
  }

  private loadClients(): void {
    this.clientService.loadClients()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: (err) => console.error('Error al precargar clientes depositantes:', err)
      });
  }

  // ─── Manejo de Filtros y Paginación ─────────────────────────────────────────

  protected updateFilterText(text: string): void {
    this.filterText.set(text);
    this.currentPage.set(1);
  }

  protected updateFilterClient(clientId: string): void {
    this.filterClientId.set(clientId);
    this.currentPage.set(1);
  }

  protected updateFilterStatus(status: string): void {
    this.filterStatus.set(status);
    this.currentPage.set(1);
  }

  protected clearFilters(): void {
    this.filterText.set('');
    this.filterClientId.set('');
    this.filterStatus.set('');
    this.currentPage.set(1);
  }

  protected onPageSizeChange(newSize: string | number): void {
    this.pageSize.set(Number(newSize));
    this.currentPage.set(1);
  }

  protected nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  protected prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  // ─── Selección y Modos de Formulario ─────────────────────────────────────────

  protected selectSku(sku: ProductSku): void {
    this.selectedSku.set(sku);
    this.formMode.set('edit');
    this.populateForm(sku);
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
    this.loadAuditLogs(sku.id);
  }

  protected startNewSku(): void {
    this.selectedSku.set(null);
    this.formMode.set('new');
    const defaultClient = this.availableClients()[0]?.id || '';
    this.form.reset({
      clientId: defaultClient,
      code: '',
      name: '',
      description: '',
      weight: 1.000,
      unit: 'BOX',
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
    const sku = this.selectedSku();
    if (sku) {
      this.formMode.set('edit');
      this.populateForm(sku);
    } else {
      this.formMode.set('idle');
    }
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
  }

  private populateForm(sku: ProductSku): void {
    this.form.patchValue({
      clientId: sku.clientId,
      code: sku.code,
      name: sku.name,
      description: sku.description || '',
      weight: sku.weight ?? 0,
      unit: sku.unit || 'BOX',
      status: sku.status || 'ACTIVE',
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  // ─── Carga de Historial de Auditoría (BE Endpoint GET /api/v1/product-skus/{id}/audit) ──

  protected loadAuditLogs(skuId: string): void {
    this.isLoadingAudit.set(true);
    this.auditEntries.set([]);
    this.skuService.getSkuAudit(skuId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isLoadingAudit.set(false);
          this.auditEntries.set(res.data || []);
        },
        error: (err) => {
          this.isLoadingAudit.set(false);
          console.error('Error al cargar historial de auditoría del SKU:', err);
        }
      });
  }

  // ─── Guardar SKU (Crear / Actualizar) ────────────────────────────────────────

  protected saveSku(): void {
    this.submitAttempted.set(true);
    this.backendError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const mode = this.formMode();

    if (mode === 'new') {
      this.skuService.create({
        clientId: raw.clientId,
        code: raw.code.trim().toUpperCase(),
        name: raw.name.trim(),
        description: raw.description ? raw.description.trim() : '',
        weight: Number(raw.weight),
        unit: raw.unit,
        status: raw.status || 'ACTIVE'
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.saveSuccess.set(true);
          const newSku = this.skuService.skus().find(s => s.code === raw.code.trim().toUpperCase());
          if (newSku) {
            this.selectedSku.set(newSku);
            this.loadAuditLogs(newSku.id);
          }
          this.formMode.set('edit');
          this.submitAttempted.set(false);
          this.toastService.success('Producto / SKU registrado con éxito.');
          setTimeout(() => this.saveSuccess.set(false), 3500);
        },
        error: (err: HttpErrorResponse) => this.handleBackendError(err),
      });
    } else if (mode === 'edit' && this.selectedSku()) {
      const skuId = this.selectedSku()!.id;
      this.skuService.update(skuId, {
        clientId: raw.clientId,
        code: raw.code.trim().toUpperCase(),
        name: raw.name.trim(),
        description: raw.description ? raw.description.trim() : '',
        weight: Number(raw.weight),
        unit: raw.unit,
        status: raw.status || 'ACTIVE'
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.saveSuccess.set(true);
          const updated = this.skuService.skus().find(s => s.id === skuId);
          if (updated) {
            this.selectedSku.set(updated);
          }
          this.submitAttempted.set(false);
          this.form.markAsPristine();
          this.loadAuditLogs(skuId);
          this.toastService.success('Producto / SKU actualizado con éxito.');
          setTimeout(() => this.saveSuccess.set(false), 3500);
        },
        error: (err: HttpErrorResponse) => this.handleBackendError(err),
      });
    }
  }

  // ─── Cambiar Estatus Operativo (Suspender / Activar) ─────────────────────────

  protected toggleStatus(): void {
    const sku = this.selectedSku();
    if (!sku) return;

    const currentStatus = sku.status || 'ACTIVE';
    const newStatus: ProductSkuStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const actionLabel = newStatus === 'ACTIVE' ? 'activado' : 'suspendido / desactivado';

    this.skuService.updateStatus(sku.id, newStatus)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          const updated = { ...sku, status: newStatus };
          this.selectedSku.set(updated);
          this.form.patchValue({ status: newStatus });
          this.loadAuditLogs(sku.id);
          this.toastService.success(`Producto / SKU ${actionLabel} con éxito.`);
        },
        error: (err: HttpErrorResponse) => this.handleBackendError(err)
      });
  }

  // ─── Eliminación Lógica con Diálogo Modal (PATCH /soft-delete) ──────────────

  protected openStatusDialog(): void {
    this.statusDialogOpen.set(true);
  }

  protected closeStatusDialog(): void {
    this.statusDialogOpen.set(false);
  }

  protected confirmStatusDialog(): void {
    const sku = this.selectedSku();
    if (!sku) return;

    this.skuService.softDelete(sku.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.closeStatusDialog();
          this.selectedSku.set(null);
          this.formMode.set('idle');
          this.toastService.success('Producto / SKU eliminado lógicamente del catálogo.');
        },
        error: (err: HttpErrorResponse) => {
          this.closeStatusDialog();
          this.handleBackendError(err);
        }
      });
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
    if (ctrl.errors['min'])            return 'El peso no puede ser negativo.';
    return 'Campo inválido.';
  }

  /** Retorna las iniciales del código SKU para el avatar. */
  protected getInitials(sku: ProductSku): string {
    const code = (sku.code || '').replace(/[^a-zA-Z0-9]/g, '');
    if (code.length >= 3) return code.substring(0, 3).toUpperCase();
    if (code.length > 0) return code.toUpperCase();
    return 'SKU';
  }

  protected isSelectedSku(sku: ProductSku): boolean {
    return this.selectedSku()?.id === sku.id;
  }

  protected getUnitLabel(unitValue: string): string {
    const found = this.unitOptions.find(u => u.value === unitValue);
    return found ? found.label : unitValue;
  }

  // ─── Manejo de Errores Backend ───────────────────────────────────────────────

  private handleBackendError(err: HttpErrorResponse): void {
    const status = err.status;
    const serverMsg = err?.error?.message || err?.message;

    if (status === 409) {
      if (serverMsg?.toLowerCase().includes('code') || serverMsg?.toLowerCase().includes('sku')) {
        this.backendError.set('El código de SKU ya existe en el sistema para este cliente.');
      } else {
        this.backendError.set(serverMsg || 'Conflicto al guardar el SKU.');
      }
    } else if (status === 404) {
      this.backendError.set('Producto / SKU no encontrado. Es posible que haya sido eliminado.');
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
  protected get isSaving():    boolean  { return this.skuService.saving(); }
  protected get isLoading():   boolean  { return this.skuService.loading(); }
  protected get hasLoadError():boolean  { return !!this.skuService.loadError(); }
  protected get loadErrorMessage(): string { return this.skuService.loadError() ?? ''; }

  protected get isListEmpty(): boolean {
    return !this.isLoading && !this.hasLoadError && this.skuService.skus().length === 0;
  }

  protected get hasNoResults(): boolean {
    return (
      !this.isLoading &&
      !this.hasLoadError &&
      this.skuService.skus().length > 0 &&
      this.filteredSkus().length === 0
    );
  }

  protected get hasActiveFilters(): boolean {
    return !!this.filterText() || !!this.filterClientId() || !!this.filterStatus();
  }
}
