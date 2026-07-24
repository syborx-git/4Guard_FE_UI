/**
 * @file section-management.component.ts
 * @description Componente principal de Secciones de Almacén — 4GUARD WMS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ALCANCE
 * ═══════════════════════════════════════════════════════════════════════════
 *  Gestión del catálogo de secciones/zonas lógicas de almacén.
 *  Consume SectionService (HTTP real: /api/v1/warehouse-sections).
 *  Soporta cambio de estatus ACTIVE/INACTIVE y consulta de historial de auditoría.
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
import { RouterLink } from '@angular/router';

import {
  SectionService,
  WarehouseSection,
  SectionAuditLogEntry,
} from '../../services/section.service';
import { BranchService } from '../../services/branch.service';
import { ToastService } from '../../../../core/services/toast.service';

// ─── Tipos internos ───────────────────────────────────────────────────────────

type FormMode = 'idle' | 'new' | 'edit';

// ─── Validadores personalizados ───────────────────────────────────────────────

/** Valida que el valor no sea únicamente espacios en blanco. */
function noWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  return (control.value as string).trim().length === 0 ? { whitespaceOnly: true } : null;
}

/** Valida que el código contenga solo letras mayúsculas, números y guiones (sin espacios). */
function codeFormatValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  const codePattern = /^[A-Z0-9\-_]+$/i;
  return codePattern.test(control.value.trim()) ? null : { invalidCode: true };
}

@Component({
  selector: 'fg-section-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './section-management.component.html',
  styleUrl: './section-management.component.css',
})
export class SectionManagementComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  protected readonly sectionService = inject(SectionService);
  protected readonly branchService = inject(BranchService);
  private readonly toastService = inject(ToastService);
  private readonly destroy$ = new Subject<void>();

  // ─── Estado de la vista ──────────────────────────────────────────────────────

  protected readonly selectedSection = signal<WarehouseSection | null>(null);
  protected readonly formMode = signal<FormMode>('idle');
  protected readonly submitAttempted = signal<boolean>(false);
  protected readonly saveSuccess = signal<boolean>(false);
  protected readonly backendError = signal<string | null>(null);

  // ─── Historial de Auditoría ──────────────────────────────────────────────────

  protected readonly auditEntries = signal<SectionAuditLogEntry[]>([]);
  protected readonly isLoadingAudit = signal<boolean>(false);

  // ─── Filtros del directorio ──────────────────────────────────────────────────

  protected filterText = signal<string>('');
  protected filterBranchId = signal<string>('');
  protected filterStatus = signal<string>('');

  // ─── Lista filtrada en el cliente (computed) ─────────────────────────────────

  protected readonly filteredSections = computed(() => {
    let list = this.sectionService.sections();
    const search = this.filterText().toLowerCase().trim();

    if (search) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(search) ||
          s.code.toLowerCase().includes(search) ||
          (s.branchName || '').toLowerCase().includes(search)
      );
    }

    const branchFilter = this.filterBranchId();
    if (branchFilter) {
      list = list.filter((s) => s.branchId === branchFilter);
    }

    const statusFilter = this.filterStatus();
    if (statusFilter) {
      list = list.filter((s) => (s.status || 'ACTIVE') === statusFilter);
    }

    return list;
  });

  // ─── KPIs computados ─────────────────────────────────────────────────────────

  protected readonly totalSections = computed(() => this.sectionService.sections().length);

  protected readonly activeSectionsCount = computed(
    () => this.sectionService.sections().filter((s) => (s.status || 'ACTIVE') === 'ACTIVE').length
  );

  protected readonly inactiveSectionsCount = computed(
    () => this.sectionService.sections().filter((s) => s.status === 'INACTIVE').length
  );

  protected readonly totalBranches = computed(
    () => new Set(this.sectionService.sections().map((s) => s.branchId)).size
  );

  // ─── Señales de estado UI ────────────────────────────────────────────────────

  protected readonly isLoading = signal<boolean>(false);
  protected readonly hasLoadError = signal<boolean>(false);
  protected readonly loadErrorMessage = signal<string>('');
  protected readonly isSaving = signal<boolean>(false);

  // ─── Formulario reactivo ─────────────────────────────────────────────────────

  protected readonly form: FormGroup = this.fb.group({
    branchId: ['', Validators.required],
    code: [
      '',
      [
        Validators.required,
        Validators.maxLength(10),
        noWhitespaceValidator,
        codeFormatValidator,
      ],
    ],
    name: [
      '',
      [
        Validators.required,
        Validators.maxLength(100),
        noWhitespaceValidator,
      ],
    ],
    status: ['ACTIVE', Validators.required],
  });

  // ─── Ciclo de vida ───────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Carga de datos ──────────────────────────────────────────────────────────

  protected loadData(): void {
    this.isLoading.set(true);
    this.hasLoadError.set(false);

    const loadBranches$ =
      this.branchService.branches().length === 0
        ? this.branchService.loadBranches()
        : null;

    if (loadBranches$) {
      loadBranches$.pipe(takeUntil(this.destroy$)).subscribe({
        next: () => this.loadSections(),
        error: () => this.loadSections(),
      });
    } else {
      this.loadSections();
    }
  }

  private loadSections(): void {
    this.sectionService
      .loadSections()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isLoading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.isLoading.set(false);
          this.hasLoadError.set(true);
          this.loadErrorMessage.set(
            err?.error?.message || err?.message || 'Error al cargar las secciones.'
          );
        },
      });
  }

  // ─── Filtros ─────────────────────────────────────────────────────────────────

  protected clearFilters(): void {
    this.filterText.set('');
    this.filterBranchId.set('');
    this.filterStatus.set('');
  }

  // ─── Selección del directorio ─────────────────────────────────────────────────

  protected selectSection(section: WarehouseSection): void {
    this.selectedSection.set(section);
    this.formMode.set('edit');
    this.populateForm(section);
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
    this.loadAuditLogs(section.id);
  }

  protected startNewSection(): void {
    const firstBranch = this.branchService.branches()[0];
    this.selectedSection.set(null);
    this.formMode.set('new');
    this.form.reset({ branchId: firstBranch?.id || '', status: 'ACTIVE' });
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
    this.auditEntries.set([]);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  protected cancelForm(): void {
    const section = this.selectedSection();
    if (section) {
      this.formMode.set('edit');
      this.populateForm(section);
      this.loadAuditLogs(section.id);
    } else {
      this.formMode.set('idle');
      this.auditEntries.set([]);
    }
    this.submitAttempted.set(false);
    this.backendError.set(null);
    this.saveSuccess.set(false);
  }

  // ─── Auditoría ────────────────────────────────────────────────────────────────

  private loadAuditLogs(sectionId: string): void {
    this.isLoadingAudit.set(true);
    this.sectionService
      .getSectionAudit(sectionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isLoadingAudit.set(false);
          this.auditEntries.set(res.data || []);
        },
        error: (err) => {
          this.isLoadingAudit.set(false);
          console.error('Error al cargar historial de auditoría:', err);
          this.auditEntries.set([]);
        },
      });
  }

  // ─── Cambiar Estatus ──────────────────────────────────────────────────────────

  protected changeStatus(targetStatus: 'ACTIVE' | 'INACTIVE'): void {
    const current = this.selectedSection();
    if (!current) return;

    this.isSaving.set(true);
    this.backendError.set(null);

    this.sectionService
      .updateStatus(current.id, targetStatus)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isSaving.set(false);
          if (res.success && res.data) {
            this.selectedSection.set(res.data);
            this.populateForm(res.data);
            this.toastService.success(
              `Estatus actualizado a ${targetStatus === 'ACTIVE' ? 'ACTIVO' : 'INACTIVO'}`
            );
            this.loadAuditLogs(current.id);
          }
        },
        error: (err: HttpErrorResponse) => {
          this.isSaving.set(false);
          this.handleBackendError(err);
        },
      });
  }

  // ─── Helpers del formulario ────────────────────────────────────────────────────

  private populateForm(section: WarehouseSection): void {
    this.form.patchValue({
      branchId: section.branchId,
      code: section.code,
      name: section.name,
      status: section.status || 'ACTIVE',
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
    if (ctrl.errors['required']) return 'Este campo es obligatorio.';
    if (ctrl.errors['whitespaceOnly']) return 'No puede contener solo espacios.';
    if (ctrl.errors['maxlength'])
      return `Máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    if (ctrl.errors['invalidCode'])
      return 'Solo letras, números y guiones. Sin espacios.';
    return 'Campo inválido.';
  }

  // ─── Guardar ──────────────────────────────────────────────────────────────────

  protected saveSection(): void {
    this.submitAttempted.set(true);
    this.backendError.set(null);

    if (this.form.invalid) return;

    const raw = this.form.getRawValue();
    const mode = this.formMode();
    this.isSaving.set(true);

    if (mode === 'new') {
      const createPayload = {
        branchId: raw.branchId,
        code: raw.code.trim().toUpperCase(),
        name: raw.name.trim(),
        status: raw.status as 'ACTIVE' | 'INACTIVE',
      };
      this.sectionService
        .create(createPayload)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.isSaving.set(false);
            if (res.success && res.data) {
              this.saveSuccess.set(true);
              this.selectedSection.set(res.data);
              this.formMode.set('edit');
              this.submitAttempted.set(false);
              this.form.markAsPristine();
              this.toastService.success('Sección creada con éxito');
              this.loadAuditLogs(res.data.id);
              setTimeout(() => this.saveSuccess.set(false), 3500);
            }
          },
          error: (err: HttpErrorResponse) => {
            this.isSaving.set(false);
            this.handleBackendError(err);
          },
        });
    } else if (mode === 'edit' && this.selectedSection()) {
      this.sectionService
        .update(this.selectedSection()!.id, {
          branchId: raw.branchId,
          code: raw.code.trim().toUpperCase(),
          name: raw.name.trim(),
          status: raw.status as 'ACTIVE' | 'INACTIVE',
        })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.isSaving.set(false);
            if (res.success && res.data) {
              this.saveSuccess.set(true);
              this.selectedSection.set(res.data);
              this.submitAttempted.set(false);
              this.form.markAsPristine();
              this.toastService.success('Sección actualizada con éxito');
              this.loadAuditLogs(res.data.id);
              setTimeout(() => this.saveSuccess.set(false), 3500);
            }
          },
          error: (err: HttpErrorResponse) => {
            this.isSaving.set(false);
            this.handleBackendError(err);
          },
        });
    }
  }



  // ─── Manejo de errores del backend ────────────────────────────────────────────

  private handleBackendError(err: HttpErrorResponse): void {
    const status = err.status;
    const serverMsg = err?.error?.message || err?.message;

    if (status === 409) {
      if (serverMsg?.toLowerCase().includes('code') || serverMsg?.toLowerCase().includes('código')) {
        this.backendError.set('El código ingresado ya está registrado para esta sucursal.');
      } else if (serverMsg?.toLowerCase().includes('version') || serverMsg?.toLowerCase().includes('modificado')) {
        this.backendError.set('El registro fue modificado por otro usuario. Recarga y vuelve a intentarlo.');
      } else {
        this.backendError.set(serverMsg || 'Conflicto al guardar. Verifica los datos ingresados.');
      }
    } else if (status === 404) {
      this.backendError.set('Sección no encontrada. Es posible que haya sido eliminada.');
    } else if (status === 400) {
      this.backendError.set(serverMsg || 'Datos inválidos. Revisa los campos del formulario.');
    } else {
      this.backendError.set('Error interno del servidor. Intenta de nuevo más tarde.');
    }
  }

  // ─── Helpers del template ─────────────────────────────────────────────────────

  protected isSelectedSection(section: WarehouseSection): boolean {
    return this.selectedSection()?.id === section.id;
  }

  /** Obtiene las iniciales del nombre de la sección para el avatar. */
  protected getInitials(section: WarehouseSection): string {
    const words = section.name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  /** Retorna la clase CSS del avatar según el índice de la sección. */
  protected getAvatarClass(section: WarehouseSection): string {
    const colors = [
      'avatar--a',
      'avatar--b',
      'avatar--c',
      'avatar--d',
      'avatar--e',
    ];
    const charSum = section.code
      .split('')
      .reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return colors[charSum % colors.length];
  }

  protected get isFormDirty(): boolean { return this.form.dirty; }

  protected get isListEmpty(): boolean {
    return !this.isLoading() && !this.hasLoadError() && this.sectionService.sections().length === 0;
  }

  protected get hasNoResults(): boolean {
    return (
      !this.isLoading() &&
      !this.hasLoadError() &&
      this.sectionService.sections().length > 0 &&
      this.filteredSections().length === 0
    );
  }

  protected get hasActiveFilters(): boolean {
    return !!this.filterText() || !!this.filterBranchId() || !!this.filterStatus();
  }

  /** Nombre legible de la sucursal seleccionada en el formulario. */
  protected get selectedBranchName(): string {
    const branchId = this.form.get('branchId')?.value;
    return this.branchService.branches().find((b) => b.id === branchId)?.name || '';
  }
}
