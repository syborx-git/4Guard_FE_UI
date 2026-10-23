/**
 * @file forklift-operators.component.ts
 * @description Componente de Gestión de Montacarguistas (HU-142) — 4GUARD WMS.
 *
 * MIGRADO: Consume el Backend real mediante ForkliftOperatorAdminService (HTTP).
 * Elimina dependencia de localStorage y semillas mock. ADR-007: Cero Mocks.
 * Homologado al 100% con la arquitectura Split-View (Master/Detail) de Transportistas.
 */

import { Component, inject, signal, computed, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ForkliftOperatorAdminService } from '../services/forklift-operator.service';
import {
  ForkliftOperator,
  CreateForkliftOperatorRequest,
  UpdateForkliftOperatorRequest,
} from '../models/forklift-operator.models';

/** Default organization ID — resolved from the active user session context. */
const DEFAULT_ORG_ID = 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';

export type FormMode = 'idle' | 'create' | 'edit';

@Component({
  selector: 'fg-forklift-operators',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forklift-operators.component.html',
  styleUrl: './forklift-operators.component.css',
})
export class ForkliftOperatorsComponent implements OnInit {
  protected readonly forkliftService = inject(ForkliftOperatorAdminService);
  private readonly fb                = inject(FormBuilder);

  @ViewChild('formSection') formSection!: ElementRef<HTMLElement>;

  // ─── Selección y Modos ──────────────────────────────────────────────────────
  protected readonly selectedOperatorId      = signal<string | null>(null);
  protected readonly formMode                = signal<FormMode>('create');
  protected readonly selectedOperatorForDelete = signal<ForkliftOperator | null>(null);

  // ─── Búsqueda y Filtros ─────────────────────────────────────────────────────
  protected readonly searchTerm    = signal<string>('');
  protected readonly licenseFilter = signal<string>('ALL');

  // ─── Estado de Carga y Vacío ────────────────────────────────────────────────
  protected readonly isLoading   = this.forkliftService.loading;
  protected readonly loadError   = this.forkliftService.error;
  protected readonly isListEmpty = computed(() => !this.isLoading() && this.forkliftService.operators().length === 0);
  protected readonly hasNoResults = computed(
    () => !this.isLoading() && this.forkliftService.operators().length > 0 && this.filteredOperators().length === 0
  );

  // ─── Toast ──────────────────────────────────────────────────────────────────
  protected readonly toastMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  // ─── Auditoría en Tiempo Real ───────────────────────────────────────────────
  protected readonly auditEntries  = signal<any[]>([]);
  protected readonly isLoadingAudit = signal<boolean>(false);

  // ─── Estado: KPIs Comprimidos / Colapsables ─────────────────────────────────
  protected readonly isKpiCollapsed = signal<boolean>(true);

  protected toggleKpiCollapse(): void {
    this.isKpiCollapsed.update((v) => !v);
  }

  // ─── KPI Computeds ──────────────────────────────────────────────────────────
  protected readonly totalOperators       = computed(() => this.forkliftService.operators().length);
  protected readonly activeOperatorsCount = computed(() => this.forkliftService.activeOperators().length);
  protected readonly validLicensesCount   = computed(() =>
    this.forkliftService.operators().filter((op) => op.licenseStatus === 'VIGENTE').length
  );
  protected readonly alertLicensesCount = computed(() =>
    this.forkliftService.operators().filter(
      (op) => op.licenseStatus === 'POR_VENCER' || op.licenseStatus === 'VENCIDA'
    ).length
  );

  // ─── Operador Seleccionado ──────────────────────────────────────────────────
  protected readonly selectedOperator = computed(() => {
    const id = this.selectedOperatorId();
    if (!id) return null;
    return this.forkliftService.operators().find((op) => op.id === id) || null;
  });

  // ─── Lista Filtrada Computada ───────────────────────────────────────────────
  protected readonly filteredOperators = computed(() => {
    const list    = this.forkliftService.operators();
    const query   = this.searchTerm().toLowerCase().trim();
    const lFilter = this.licenseFilter();

    return list.filter((op) => {
      const matchesLic   = lFilter === 'ALL' || op.licenseStatus === lFilter;
      const matchesQuery =
        !query ||
        op.fullName.toLowerCase().includes(query) ||
        op.code.toLowerCase().includes(query) ||
        (op.jobTitle && op.jobTitle.toLowerCase().includes(query)) ||
        op.licenseNumberDc3.toLowerCase().includes(query);

      return matchesLic && matchesQuery;
    });
  });

  // ─── Modal de Restablecer PIN / Contraseña ────────────────────────────────
  protected readonly isResetPinModalOpen   = signal<boolean>(false);
  protected readonly resetPinOperator       = signal<ForkliftOperator | null>(null);
  protected readonly newPinValue            = signal<string>('1234');
  protected readonly isSubmittingPin        = signal<boolean>(false);

  // ─── Formulario Reactivo ────────────────────────────────────────────────────
  protected readonly operatorForm = this.fb.group({
    firstName:             ['', [Validators.required, Validators.minLength(2)]],
    lastNamePaternal:      ['', [Validators.required, Validators.minLength(2)]],
    lastNameMaternal:      ['', [Validators.required, Validators.minLength(2)]],
    licenseNumberDc3:      [''],
    licenseExpirationDate: [''],
    createAccess:          [true],
    username:              [''],
    pin:                   ['1234', [Validators.minLength(4)]],
  });

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.startNewOperator();
    this.reloadOperators();
  }

  reloadOperators(): void {
    const orgId = this.forkliftService.getSessionOrgId();
    this.forkliftService.loadOperators(orgId).subscribe({
      next: (list) => {
        if (this.selectedOperatorId()) {
          const current = list.find((op) => op.id === this.selectedOperatorId());
          if (current) {
            this.populateForm(current);
          }
        }
      },
      error: (err) => {
        console.error('Error loading forklift operators:', err);
        this.showToast('error', 'No se pudo cargar el catálogo de montacarguistas. Verifique la conexión con el servidor.');
      },
    });
  }

  // ─── Selección y Navegación ─────────────────────────────────────────────────

  selectOperator(op: ForkliftOperator): void {
    this.selectedOperatorId.set(op.id);
    this.formMode.set('edit');
    this.populateForm(op);
    this.loadAuditLogs(op.id);
  }

  loadAuditLogs(id: string): void {
    this.isLoadingAudit.set(true);
    this.forkliftService.getAuditLogs(id).subscribe({
      next: (logs) => {
        this.auditEntries.set(logs || []);
        this.isLoadingAudit.set(false);
      },
      error: (err) => {
        console.warn('Error loading audit logs:', err);
        this.auditEntries.set([]);
        this.isLoadingAudit.set(false);
      },
    });
  }

  // ─── Audit Helpers ─────────────────────────────────────────────────────────

  getAuditIcon(action: string): string {
    switch (action) {
      case 'FORKLIFT_OPERATOR_CREATED':        return 'person_add';
      case 'FORKLIFT_OPERATOR_UPDATED':        return 'edit_note';
      case 'FORKLIFT_OPERATOR_STATUS_CHANGED': return 'swap_horiz';
      case 'FORKLIFT_OPERATOR_DELETED':        return 'delete_forever';
      default:                                 return 'history';
    }
  }

  getAuditColorClass(action: string): string {
    switch (action) {
      case 'FORKLIFT_OPERATOR_CREATED':        return 'carriers-tl-node--emerald';
      case 'FORKLIFT_OPERATOR_UPDATED':        return 'carriers-tl-node--blue';
      case 'FORKLIFT_OPERATOR_STATUS_CHANGED': return 'carriers-tl-node--amber';
      case 'FORKLIFT_OPERATOR_DELETED':        return 'carriers-tl-node--red';
      default:                                 return 'carriers-tl-node--indigo';
    }
  }

  getAuditSummary(action: string): string {
    switch (action) {
      case 'FORKLIFT_OPERATOR_CREATED':        return 'Montacarguista Registrado en Catálogo';
      case 'FORKLIFT_OPERATOR_UPDATED':        return 'Actualización de Datos Operativos';
      case 'FORKLIFT_OPERATOR_STATUS_CHANGED': return 'Cambio de Estatus Operativo';
      case 'FORKLIFT_OPERATOR_DELETED':        return 'Baja Lógica del Operador';
      default:                                 return action;
    }
  }

  startNewOperator(): void {
    this.selectedOperatorId.set(null);
    this.auditEntries.set([]);
    this.formMode.set('create');
    this.resetForm();
    this.scrollToForm();
  }

  editOperator(op: ForkliftOperator): void {
    this.selectOperator(op);
    this.scrollToForm();
  }

  private populateForm(op: ForkliftOperator): void {
    this.operatorForm.patchValue({
      firstName:             op.firstName,
      lastNamePaternal:      op.lastNamePaternal,
      lastNameMaternal:      op.lastNameMaternal,
      licenseNumberDc3:      op.licenseNumberDc3 || '',
      licenseExpirationDate: op.licenseExpirationDate || '',
      createAccess:          !!op.userId,
      username:              op.username || '',
      pin:                   '',
    });
  }

  // ─── Envío del Formulario ───────────────────────────────────────────────────

  onSubmitOperator(): void {
    if (this.operatorForm.invalid) {
      this.operatorForm.markAllAsTouched();
      return;
    }

    const val        = this.operatorForm.value;
    const selectedId = this.selectedOperatorId();
    const mode       = this.formMode();
    const orgId      = this.forkliftService.getSessionOrgId();

    if (mode === 'edit' && selectedId) {
      const currentOp = this.selectedOperator();
      const request: UpdateForkliftOperatorRequest = {
        id:                    selectedId,
        organizationId:        currentOp?.organizationId || orgId,
        jobTitle:              currentOp?.jobTitle || 'Montacarguista',
        firstName:             val.firstName!,
        lastNamePaternal:      val.lastNamePaternal!,
        lastNameMaternal:      val.lastNameMaternal!,
        licenseNumberDc3:      val.licenseNumberDc3?.trim() || undefined,
        licenseExpirationDate: val.licenseExpirationDate || undefined,
        version:               currentOp?.version,
      };

      this.forkliftService.updateOperator(request).subscribe({
        next: (updated) => {
          this.showToast('success', `Montacarguista ${updated.fullName} actualizado correctamente.`);
          this.selectedOperatorId.set(updated.id);
          this.formMode.set('edit');
          this.populateForm(updated);
          this.loadAuditLogs(updated.id);
        },
        error: (err) => {
          const msg = err?.error?.message || 'Error al actualizar el montacarguista. Intente de nuevo.';
          this.showToast('error', msg);
        },
      });
    } else {
      const request: CreateForkliftOperatorRequest = {
        organizationId:        orgId,
        jobTitle:              'Montacarguista',
        firstName:             val.firstName!,
        lastNamePaternal:      val.lastNamePaternal!,
        lastNameMaternal:      val.lastNameMaternal!,
        licenseNumberDc3:      val.licenseNumberDc3?.trim() || undefined,
        licenseExpirationDate: val.licenseExpirationDate || undefined,
        createAccess:          val.createAccess ?? true,
        username:              val.username?.trim() || undefined,
        pin:                   val.pin?.trim() || '1234',
      };

      this.forkliftService.createOperator(request).subscribe({
        next: (created) => {
          this.showToast('success', `Montacarguista ${created.fullName} (${created.code}) registrado correctamente.`);
          this.selectedOperatorId.set(created.id);
          this.formMode.set('edit');
          this.populateForm(created);
          this.loadAuditLogs(created.id);
        },
        error: (err) => {
          const msg = err?.error?.message || 'Error al registrar el montacarguista. Intente de nuevo.';
          this.showToast('error', msg);
        },
      });
    }
  }

  // ─── Acciones del Formulario ────────────────────────────────────────────────

  cancelForm(): void {
    const selected = this.selectedOperator();
    if (selected) {
      this.populateForm(selected);
    } else {
      this.startNewOperator();
    }
  }

  resetForm(): void {
    this.operatorForm.reset({
      firstName: '',
      lastNamePaternal: '',
      lastNameMaternal: '',
      licenseNumberDc3: '',
      licenseExpirationDate: '',
      createAccess: true,
      username: '',
      pin: '1234',
    });
  }

  // ─── Toggle Estatus ─────────────────────────────────────────────────────────

  toggleOperatorStatus(op: ForkliftOperator, event?: Event): void {
    event?.stopPropagation();
    const newStatus = op.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';

    this.forkliftService.toggleStatus(op.id).subscribe({
      next: () => {
        this.showToast('success', `Estatus de ${op.fullName} cambiado a ${newStatus}.`);
        this.loadAuditLogs(op.id);
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al cambiar el estatus. Intente de nuevo.';
        this.showToast('error', msg);
      },
    });
  }

  // ─── Modal de Confirmación de Baja ─────────────────────────────────────────

  openDeleteModal(op: ForkliftOperator, event?: Event): void {
    event?.stopPropagation();
    this.selectedOperatorForDelete.set(op);
  }

  closeDeleteModal(): void {
    this.selectedOperatorForDelete.set(null);
  }

  confirmHardDelete(): void {
    const op = this.selectedOperatorForDelete();
    if (!op) return;

    this.forkliftService.deleteOperator(op.id).subscribe({
      next: () => {
        this.showToast('success', `Operador ${op.fullName} (${op.code}) eliminado del catálogo.`);
        this.closeDeleteModal();

        if (this.selectedOperatorId() === op.id) {
          const remaining = this.filteredOperators();
          if (remaining.length > 0) {
            this.selectOperator(remaining[0]);
          } else {
            this.selectedOperatorId.set(null);
          }
        }
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al eliminar el montacarguista. Intente de nuevo.';
        this.showToast('error', msg);
        this.closeDeleteModal();
      },
    });
  }

  // ─── Modal de Restablecer PIN / Contraseña ────────────────────────────────

  openResetPinModal(op: ForkliftOperator, event?: Event): void {
    event?.stopPropagation();
    this.resetPinOperator.set(op);
    this.newPinValue.set('1234');
    this.isResetPinModalOpen.set(true);
  }

  closeResetPinModal(): void {
    this.isResetPinModalOpen.set(false);
    this.resetPinOperator.set(null);
  }

  onPinInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.newPinValue.set(input.value);
  }

  submitResetPin(): void {
    const op = this.resetPinOperator();
    const pin = this.newPinValue().trim();
    if (!op) return;
    if (!pin || pin.length < 4) {
      this.showToast('error', 'El PIN debe tener al menos 4 caracteres.');
      return;
    }

    this.isSubmittingPin.set(true);
    this.forkliftService.resetPin(op.id, pin).subscribe({
      next: (updated) => {
        this.isSubmittingPin.set(false);
        this.closeResetPinModal();
        this.showToast('success', `PIN restablecido exitosamente para ${updated.fullName} (@${updated.username}).`);
        this.selectedOperatorId.set(updated.id);
        this.populateForm(updated);
        this.loadAuditLogs(updated.id);
      },
      error: (err) => {
        this.isSubmittingPin.set(false);
        const msg = err?.error?.message || 'Error al restablecer el PIN. Intente de nuevo.';
        this.showToast('error', msg);
      }
    });
  }

  // ─── Utilidades ─────────────────────────────────────────────────────────────

  scrollToForm(): void {
    if (this.formSection) {
      this.formSection.nativeElement.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.licenseFilter.set('ALL');
  }

  private showToast(type: 'success' | 'error', text: string): void {
    this.toastMessage.set({ type, text });
    setTimeout(() => this.toastMessage.set(null), 4500);
  }
}
