/**
 * @file forklift-catalog.component.ts
 * @description Catálogo de Montacarguistas y Scorecard de Rendimiento Operativo.
 * Jerarquía de Pestañas: 1. Alta de Montacarguistas -> 2. Baja Definitiva -> 3. Consulta / Scorecard.
 */

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CatalogsService } from '../../services/catalogs.service';
import { ForkliftOperator, LicenseStatus } from '../../models/forklift-catalog.models';

type ForkliftSubTab = 'create' | 'delete' | 'scorecard';

@Component({
  selector: 'fg-forklift-catalog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forklift-catalog.component.html',
  styleUrl: './forklift-catalog.component.css',
})
export class ForkliftCatalogComponent {
  protected readonly catalogsService = inject(CatalogsService);
  private readonly fb = inject(FormBuilder);

  // Jerarquía: Alta por defecto
  protected readonly activeTab = signal<ForkliftSubTab>('create');

  protected readonly searchTerm = signal<string>('');
  protected readonly licenseStatusFilter = signal<string>('ALL');

  // Modal para confirmación de Baja Definitiva (Hard Delete)
  protected readonly selectedOperatorForDelete = signal<ForkliftOperator | null>(null);

  // Toast Alert
  protected readonly toastMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  // Formulario Alta de Montacarguistas
  protected readonly operatorForm = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastNamePaterno: ['', [Validators.required, Validators.minLength(2)]],
    lastNameMaterno: ['', [Validators.required]],
    licenseNumber: ['', [Validators.required]],
    licenseExpirationDate: ['', [Validators.required]],
    shift: ['Turno 1 - Matutino', [Validators.required]],
  });

  protected readonly filteredOperators = computed(() => {
    const list = this.catalogsService.forkliftOperators();
    const lFilter = this.licenseStatusFilter();
    const query = this.searchTerm().toLowerCase().trim();

    return list.filter((op) => {
      const matchLic = lFilter === 'ALL' || op.licenseStatus === lFilter;
      const matchQuery =
        !query ||
        op.fullName.toLowerCase().includes(query) ||
        op.employeeCode.toLowerCase().includes(query) ||
        op.licenseNumber.toLowerCase().includes(query);

      return matchLic && matchQuery;
    });
  });

  onSubmitCreateOperator(): void {
    if (this.operatorForm.invalid) {
      this.operatorForm.markAllAsTouched();
      return;
    }

    const val = this.operatorForm.value;
    this.catalogsService.createForkliftOperator({
      firstName: val.firstName!,
      lastNamePaterno: val.lastNamePaterno!,
      lastNameMaterno: val.lastNameMaterno!,
      licenseNumber: val.licenseNumber!,
      licenseExpirationDate: val.licenseExpirationDate!,
      shift: val.shift!,
    });

    this.showToast('success', `Montacarguista ${val.firstName} ${val.lastNamePaterno} registrado con éxito.`);
    this.operatorForm.reset({ shift: 'Turno 1 - Matutino' });
    this.activeTab.set('scorecard');
  }

  openDeleteModal(operator: ForkliftOperator): void {
    this.selectedOperatorForDelete.set(operator);
  }

  closeDeleteModal(): void {
    this.selectedOperatorForDelete.set(null);
  }

  confirmHardDelete(): void {
    const op = this.selectedOperatorForDelete();
    if (!op) return;

    this.catalogsService.deleteForkliftOperator(op.id);
    this.showToast('success', `Registro del operador ${op.fullName} ELIMINADO FÍSICAMENTE de la base de datos.`);
    this.closeDeleteModal();
  }

  private showToast(type: 'success' | 'error', text: string): void {
    this.toastMessage.set({ type, text });
    setTimeout(() => this.toastMessage.set(null), 4000);
  }
}
