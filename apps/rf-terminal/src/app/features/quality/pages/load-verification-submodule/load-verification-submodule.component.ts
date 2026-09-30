/**
 * @file load-verification-submodule.component.ts
 * @description Submódulo Oficial de Verificación de Carga en Andén F01-PO-GC-8.6-03 Rev. 03 para Terminal RF.
 */

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthState } from '@4guard/shared-core';
import { RfQualityStateService } from '../../../../core/services/rf-quality-state.service';
import {
  LoadVerification,
  VerificationCriterion,
  CriterionValue,
} from '../../models/quality.models';

@Component({
  selector: 'fg-rf-load-verification-submodule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './load-verification-submodule.component.html',
  styleUrl: './load-verification-submodule.component.css',
})
export class RfLoadVerificationSubmoduleComponent {
  protected readonly qmState = inject(RfQualityStateService);
  private readonly authState = inject(AuthState);

  protected readonly searchTerm = signal('');
  protected readonly statusFilter = signal<string>('ALL');

  // ─── Modal de Nueva Inspección F01 ───────────────────────────────────────
  protected readonly showModal = signal(false);

  protected readonly formRemision = signal('REM-78420');
  protected readonly formProduct = signal('Leche Lala Entera UHT 1L (Caja 12 pzas)');
  protected readonly formClient = signal('Lala S.A. de C.V.');
  protected readonly formRamp = signal('Andén 02 (Refrigerado)');
  protected readonly formObservations = signal('Caja térmica en condiciones óptimas. Temperatura estable.');

  protected readonly defaultTransportCriteria: VerificationCriterion[] = [
    { id: 't1', label: 'Caja limpia, seca y libre de olores extraños', value: 'SI', actionIfNo: 'Solicitar lavado o rechazar', responsible: 'Transportista', observations: '', isCritical: true },
    { id: 't2', label: 'Ausencia total de plagas, insectos o roedores', value: 'SI', actionIfNo: 'Rechazo inmediato de la unidad', responsible: 'Calidad 4GUARD', observations: '', isCritical: true },
    { id: 't3', label: 'Temperatura de termoking dentro de rango (2°C a 6°C)', value: 'SI', actionIfNo: 'Detener descarga y notificar a QA', responsible: 'Supervisor Andén', observations: '', isCritical: true },
    { id: 't4', label: 'Sellos fiscales y marchamos coinciden con remisión', value: 'SI', actionIfNo: 'Levantar acta de no conformidad', responsible: 'Seguridad Caseta', observations: '', isCritical: true },
    { id: 't5', label: 'Paredes y piso sin clavos salientes o astillas', value: 'SI', actionIfNo: 'Acondicionar piso con cartón', responsible: 'Cuadrilla descarga', observations: '' },
  ];

  protected readonly defaultProductCriteria: VerificationCriterion[] = [
    { id: 'p1', label: 'Tarimas estandarizadas y libres de humedad', value: 'SI', actionIfNo: 'Reestibar en tarima plástica', responsible: 'Montacarguista', observations: '' },
    { id: 'p2', label: 'Empaque primario y secundario sellado sin fugas', value: 'SI', actionIfNo: 'Separar piezas dañadas', responsible: 'Operador RF', observations: '', isCritical: true },
    { id: 'p3', label: 'Código GS1 / EAN legible por escáner láser', value: 'SI', actionIfNo: 'Reetiquetar marbete interno', responsible: 'Operador RF', observations: '' },
    { id: 'p4', label: 'Fecha de caducidad con vida útil mayor a 90 días', value: 'SI', actionIfNo: 'Rechazar lote por caducidad corta', responsible: 'Calidad', observations: '', isCritical: true },
  ];

  protected currentTransportCriteria = signal<VerificationCriterion[]>(JSON.parse(JSON.stringify(this.defaultTransportCriteria)));
  protected currentProductCriteria = signal<VerificationCriterion[]>(JSON.parse(JSON.stringify(this.defaultProductCriteria)));

  // Cálculo automático del dictamen
  protected readonly computedStatus = computed(() => {
    const allCriteria = [...this.currentTransportCriteria(), ...this.currentProductCriteria()];
    const hasCriticalFail = allCriteria.some(c => c.isCritical && c.value === 'NO');
    const hasNonCriticalFail = allCriteria.some(c => !c.isCritical && c.value === 'NO');

    if (hasCriticalFail) return 'RECHAZADO';
    if (hasNonCriticalFail) return 'ACONDICIONAMIENTO_PENDIENTE';
    return 'APROBADO';
  });

  protected readonly filteredVerifications = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const st = this.statusFilter();
    return this.qmState.loadVerifications().filter(ver => {
      const matchSt = st === 'ALL' || ver.status === st;
      const matchText =
        !term ||
        ver.folio.toLowerCase().includes(term) ||
        ver.remisionNumber.toLowerCase().includes(term) ||
        ver.productDescription.toLowerCase().includes(term) ||
        ver.clientName.toLowerCase().includes(term) ||
        ver.ramp.toLowerCase().includes(term);
      return matchSt && matchText;
    });
  });

  openModal(): void {
    this.currentTransportCriteria.set(JSON.parse(JSON.stringify(this.defaultTransportCriteria)));
    this.currentProductCriteria.set(JSON.parse(JSON.stringify(this.defaultProductCriteria)));
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  setCriterionValue(section: 'transport' | 'product', id: string, val: CriterionValue): void {
    if (section === 'transport') {
      this.currentTransportCriteria.update(list =>
        list.map(c => (c.id === id ? { ...c, value: val } : c))
      );
    } else {
      this.currentProductCriteria.update(list =>
        list.map(c => (c.id === id ? { ...c, value: val } : c))
      );
    }
  }

  submitVerification(): void {
    const inspector = this.authState.userFullName() || 'Roberto Sánchez (Auditor RF)';

    this.qmState.createLoadVerification({
      remisionNumber: this.formRemision(),
      productDescription: this.formProduct(),
      clientName: this.formClient(),
      ramp: this.formRamp(),
      generalObservations: this.formObservations(),
      status: this.computedStatus(),
      transportCriteria: this.currentTransportCriteria(),
      productCriteria: this.currentProductCriteria(),
      inspectorName: inspector,
    });

    this.closeModal();
  }
}
