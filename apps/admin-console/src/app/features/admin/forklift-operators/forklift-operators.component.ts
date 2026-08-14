/**
 * @file forklift-operators.component.ts
 * @description Componente de Administración de Montacarguistas (Administrar -> Montacarguistas).
 * Homologado al 100% con la arquitectura, Split-View (Master/Detail), tokens y KPIs de Transportistas (carriers).
 */

import { Component, inject, signal, computed, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ForkliftOperatorAdminService } from '../services/forklift-operator.service';
import { ForkliftOperator, LicenseStatus } from '../models/forklift-operator.models';
import { ShiftService } from '../shifts/services/shift.service';

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
  protected readonly shiftService = inject(ShiftService);
  private readonly fb = inject(FormBuilder);

  @ViewChild('formSection') formSection!: ElementRef<HTMLElement>;

  // Selección y Modos
  protected readonly selectedOperatorId = signal<string | null>(null);
  protected readonly formMode = signal<FormMode>('idle');
  protected readonly selectedOperatorForDelete = signal<ForkliftOperator | null>(null);

  // Búsqueda y Filtros
  protected readonly searchTerm = signal<string>('');
  protected readonly licenseFilter = signal<string>('ALL');

  // Mensaje Toast
  protected readonly toastMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  // KPI Computeds (Idénticos a Carriers Header)
  protected readonly totalOperators = computed(() => this.forkliftService.operators().length);
  protected readonly activeOperatorsCount = computed(() => this.forkliftService.activeOperators().length);
  protected readonly validLicensesCount = computed(() =>
    this.forkliftService.operators().filter((op) => op.licenseStatus === 'VIGENTE').length
  );
  protected readonly alertLicensesCount = computed(() =>
    this.forkliftService.operators().filter((op) => op.licenseStatus === 'POR_VENCER' || op.licenseStatus === 'VENCIDA').length
  );

  // Turnos dinámicos del Catálogo Maestro de Turnos y Horarios
  protected readonly availableShifts = computed(() => {
    const catalogShifts = this.shiftService.shifts();
    if (catalogShifts && catalogShifts.length > 0) {
      return catalogShifts.map((s) => ({
        id: s.id,
        name: s.name,
        displayName: `${s.name} (${s.startTime?.substring(0, 5) || '06:00'} - ${s.endTime?.substring(0, 5) || '14:00'})`,
      }));
    }
    return [
      { id: 'shift-1', name: 'Turno 1 - Matutino', displayName: 'Turno 1 - Matutino (06:00 - 14:00)' },
      { id: 'shift-2', name: 'Turno 2 - Vespertino', displayName: 'Turno 2 - Vespertino (14:00 - 22:00)' },
      { id: 'shift-3', name: 'Turno 3 - Nocturno', displayName: 'Turno 3 - Nocturno (22:00 - 06:00)' },
    ];
  });

  // Operador Seleccionado
  protected readonly selectedOperator = computed(() => {
    const id = this.selectedOperatorId();
    if (!id) return null;
    return this.forkliftService.operators().find((op) => op.id === id) || null;
  });

  // Lista Filtrada Computada
  protected readonly filteredOperators = computed(() => {
    const list = this.forkliftService.operators();
    const query = this.searchTerm().toLowerCase().trim();
    const lFilter = this.licenseFilter();

    return list.filter((op) => {
      const matchesLic = lFilter === 'ALL' || op.licenseStatus === lFilter;
      const matchesQuery =
        !query ||
        op.fullName.toLowerCase().includes(query) ||
        op.code.toLowerCase().includes(query) ||
        op.licenseNumberDc3.toLowerCase().includes(query);

      return matchesLic && matchesQuery;
    });
  });

  // Formulario Reactivo (Los 6 Campos del Cliente)
  protected readonly operatorForm = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastNamePaternal: ['', [Validators.required, Validators.minLength(2)]],
    lastNameMaternal: ['', [Validators.required, Validators.minLength(2)]],
    licenseNumberDc3: ['', [Validators.required]],
    licenseExpirationDate: ['', [Validators.required]],
    shift: ['Turno 1 - Matutino (06:00 - 14:00)', [Validators.required]],
  });

  ngOnInit(): void {
    try {
      this.shiftService.loadShifts();
    } catch (e) {
      console.warn('Cargando turnos desde respaldo local:', e);
    }

    const first = this.filteredOperators()[0];
    if (first) {
      this.selectOperator(first);
    }
  }

  selectOperator(op: ForkliftOperator): void {
    this.selectedOperatorId.set(op.id);
    if (this.formMode() === 'edit') {
      this.populateForm(op);
    }
  }

  startNewOperator(): void {
    this.selectedOperatorId.set(null);
    this.formMode.set('create');
    this.resetForm();
    this.scrollToForm();
  }

  editOperator(op: ForkliftOperator): void {
    this.selectedOperatorId.set(op.id);
    this.formMode.set('edit');
    this.populateForm(op);
    this.scrollToForm();
  }

  private populateForm(op: ForkliftOperator): void {
    this.operatorForm.patchValue({
      firstName: op.firstName,
      lastNamePaternal: op.lastNamePaternal,
      lastNameMaternal: op.lastNameMaternal,
      licenseNumberDc3: op.licenseNumberDc3,
      licenseExpirationDate: op.licenseExpirationDate,
      shift: op.shift,
    });
  }

  onSubmitOperator(): void {
    if (this.operatorForm.invalid) {
      this.operatorForm.markAllAsTouched();
      return;
    }

    const val = this.operatorForm.value;
    const selectedId = this.selectedOperatorId();
    const mode = this.formMode();

    if (mode === 'edit' && selectedId) {
      this.forkliftService.updateOperator(selectedId, {
        firstName: val.firstName!,
        lastNamePaternal: val.lastNamePaternal!,
        lastNameMaternal: val.lastNameMaternal!,
        licenseNumberDc3: val.licenseNumberDc3!,
        licenseExpirationDate: val.licenseExpirationDate!,
        shift: val.shift!,
      });
      this.showToast('success', `Montacarguista ${val.firstName} ${val.lastNamePaternal} actualizado correctamente.`);
      this.formMode.set('idle');
    } else {
      const created = this.forkliftService.createOperator({
        firstName: val.firstName!,
        lastNamePaternal: val.lastNamePaternal!,
        lastNameMaternal: val.lastNameMaternal!,
        licenseNumberDc3: val.licenseNumberDc3!,
        licenseExpirationDate: val.licenseExpirationDate!,
        shift: val.shift!,
      });
      this.showToast('success', `Montacarguista ${created.fullName} (${created.code}) registrado correctamente.`);
      this.selectedOperatorId.set(created.id);
      this.formMode.set('idle');
    }
  }

  cancelForm(): void {
    this.formMode.set('idle');
    const selected = this.selectedOperator();
    if (!selected && this.filteredOperators().length > 0) {
      this.selectOperator(this.filteredOperators()[0]);
    }
  }

  resetForm(): void {
    this.operatorForm.reset({
      shift: 'Turno 1 - Matutino (06:00 - 14:00)',
    });
  }

  toggleOperatorStatus(op: ForkliftOperator, event?: Event): void {
    event?.stopPropagation();
    this.forkliftService.toggleStatus(op.id);
    const newStatus = op.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    this.showToast('success', `Estatus de ${op.fullName} cambiado a ${newStatus}.`);
  }

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

    this.forkliftService.deleteOperator(op.id);
    this.showToast('success', `Operador ${op.fullName} (${op.code}) ELIMINADO FÍSICAMENTE de la base de datos.`);
    this.closeDeleteModal();

    if (this.selectedOperatorId() === op.id) {
      const remaining = this.filteredOperators();
      if (remaining.length > 0) {
        this.selectOperator(remaining[0]);
      } else {
        this.selectedOperatorId.set(null);
      }
    }
  }

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
    setTimeout(() => this.toastMessage.set(null), 4000);
  }
}
