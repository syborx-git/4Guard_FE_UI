/**
 * @file claims-submodule.component.ts
 * @description Submódulo de Reclamos e Incidencias de Calidad (F01) para Terminal RF.
 */

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthState } from '@4guard/shared-core';
import { RfQualityStateService } from '../../../../core/services/rf-quality-state.service';
import {
  QualityClaim,
  ClaimStage,
  ClaimDefectType,
  CLAIM_STAGE_LABELS,
  CLAIM_DEFECT_TYPE_LABELS,
} from '../../models/quality.models';

@Component({
  selector: 'fg-rf-claims-submodule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './claims-submodule.component.html',
  styleUrl: './claims-submodule.component.css',
})
export class RfClaimsSubmoduleComponent {
  protected readonly qmState = inject(RfQualityStateService);
  private readonly authState = inject(AuthState);

  protected readonly searchTerm = signal('');
  protected readonly stageFilter = signal<string>('ALL');

  // ─── Modal de Registro de Reclamo ─────────────────────────────────────────
  protected readonly showModal = signal(false);

  protected readonly formRemision = signal('REM-78401');
  protected readonly formSku = signal('LALA-MILK-1L');
  protected readonly formProduct = signal('Leche Lala Entera UHT 1L (Caja 12 pzas)');
  protected readonly formClient = signal('Lala S.A. de C.V.');
  protected readonly formBatch = signal('LOT-2026-LALA-901');
  protected readonly formStage = signal<ClaimStage>('INBOUND_UNLOAD');
  protected readonly formDefectType = signal<ClaimDefectType>('BAD_CONDITIONS');
  protected readonly formDamagedQty = signal(24);
  protected readonly formLostQty = signal(12);
  protected readonly formCost = signal(2880);
  protected readonly formAuthorizedByName = signal('Dra. Elena Ramos');
  protected readonly formAuthorizedByPosition = signal('Auditor Líder QM');
  protected readonly formObservations = signal('Cajas aplastadas por estiba deficiente desde planta proveedora.');

  protected readonly stageLabels = CLAIM_STAGE_LABELS;
  protected readonly defectLabels = CLAIM_DEFECT_TYPE_LABELS;

  protected readonly filteredClaims = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const stage = this.stageFilter();
    return this.qmState.claims().filter(clm => {
      const matchStage = stage === 'ALL' || clm.stage === stage;
      const matchText =
        !term ||
        clm.folio.toLowerCase().includes(term) ||
        clm.sku.toLowerCase().includes(term) ||
        clm.batchNumber.toLowerCase().includes(term) ||
        clm.clientName.toLowerCase().includes(term) ||
        clm.remisionNumber.toLowerCase().includes(term);
      return matchStage && matchText;
    });
  });

  openModal(): void {
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  submitClaim(): void {
    this.qmState.createClaim({
      stage: this.formStage(),
      sku: this.formSku(),
      productDescription: this.formProduct(),
      clientName: this.formClient(),
      batchNumber: this.formBatch(),
      remisionNumber: this.formRemision(),
      defectType: this.formDefectType(),
      damagedQty: this.formDamagedQty(),
      lostQty: this.formLostQty(),
      associatedCost: this.formCost(),
      authorizedByName: this.formAuthorizedByName(),
      authorizedByPosition: this.formAuthorizedByPosition(),
      observations: this.formObservations(),
    });

    this.closeModal();
  }
}
