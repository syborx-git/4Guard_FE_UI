/**
 * @file blocks-submodule.component.ts
 * @description Submódulo de Bloqueos de Producto No Conforme (PNC) y Cuarentenas para Terminal RF.
 * Diseñado con Tarjetas Ejecutivas Compactas y Botones de Acción Directa.
 */

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UnitOfMeasure, AuthState, ToastService } from '@4guard/shared-core';
import { RfQualityStateService } from '../../../../core/services/rf-quality-state.service';
import { AudioFeedbackService } from '../../../../core/services/audio-feedback.service';
import {
  QualityBlockItem,
  DetectionStage,
  DefectCategory,
  DETECTION_STAGE_LABELS,
  DEFECT_CATEGORY_LABELS,
} from '../../models/quality.models';

@Component({
  selector: 'fg-rf-blocks-submodule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './blocks-submodule.component.html',
  styleUrl: './blocks-submodule.component.css',
})
export class RfBlocksSubmoduleComponent {
  protected readonly qmState = inject(RfQualityStateService);
  private readonly authState = inject(AuthState);
  private readonly toast = inject(ToastService);
  private readonly audio = inject(AudioFeedbackService);
  private readonly router = inject(Router);

  // ─── Estado de Filtros ──────────────────────────────────────────────────
  protected readonly searchTerm = signal('');
  protected readonly selectedStageFilter = signal<string>('ALL');

  // ─── Modal de Nuevo Bloqueo ─────────────────────────────────────────────
  protected readonly showCreateModal = signal(false);

  // ─── Modal de Detalle Ejecutivo ─────────────────────────────────────────
  protected readonly showDetailModal = signal(false);
  protected readonly selectedBlockDetail = signal<QualityBlockItem | null>(null);

  // ─── Formulario de Nuevo Bloqueo ────────────────────────────────────────
  protected readonly formSku = signal('LALA-MILK-1L');
  protected readonly formDescription = signal('Leche Lala Entera UHT 1L');
  protected readonly formClientName = signal('Lala S.A. de C.V.');
  protected readonly formBatchNumber = signal('LOT-2026-LALA-905');
  protected readonly formSscc = signal('375010203040500099');
  protected readonly formQuantity = signal(120);
  protected readonly formUnit = signal<UnitOfMeasure>(UnitOfMeasure.BOX);
  protected readonly formLocation = signal('LOC-QM-HOLD-01');
  protected readonly formStage = signal<DetectionStage>('INBOUND_UNLOAD');
  protected readonly formCategory = signal<DefectCategory>('MATERIAL');
  protected readonly formSeverity = signal<'CRITICAL' | 'WARNING' | 'INFO'>('CRITICAL');
  protected readonly formNotes = signal('');

  protected readonly availableCriteria = [
    'Material con humedad',
    'Embalaje en malas condiciones',
    'Caducidad vencida o menor a 90 días',
    'Discrepancia en certificado COA',
    'Tarima rota o desnivelada',
    'Fuga o derrame visible',
    'Código GS1 no legible',
  ];
  protected readonly selectedCriteria = signal<string[]>(['Material con humedad']);

  // ─── Lista Filtrada ─────────────────────────────────────────────────────
  protected readonly filteredBlocks = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const stage = this.selectedStageFilter();
    return this.qmState.blocks().filter(item => {
      const matchStage = stage === 'ALL' || item.stage === stage;
      const matchText =
        !term ||
        item.folio.toLowerCase().includes(term) ||
        item.sku.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.batchNumber.toLowerCase().includes(term) ||
        item.sscc.includes(term);
      return matchStage && matchText;
    });
  });

  protected readonly stageLabels = DETECTION_STAGE_LABELS;
  protected readonly categoryLabels = DEFECT_CATEGORY_LABELS;

  // ─── Acciones Directas desde Tarjeta ─────────────────────────────────────

  openCreateModal(): void {
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  openDetail(item: QualityBlockItem): void {
    this.selectedBlockDetail.set(item);
    this.showDetailModal.set(true);
    this.audio.playSuccess();
  }

  closeDetail(): void {
    this.showDetailModal.set(false);
    this.selectedBlockDetail.set(null);
  }

  goToRelease(item: QualityBlockItem): void {
    this.audio.playSuccess();
    this.router.navigate(['/quality/releases']);
  }

  goToInspection(item: QualityBlockItem): void {
    this.audio.playSuccess();
    this.router.navigate(['/quality/inspection']);
  }

  printHoldTag(item: QualityBlockItem, event?: Event): void {
    if (event) event.stopPropagation();
    this.audio.playSuccess();
    this.toast.success(`Marbete Hold QR enviado a impresora Zebra: ${item.folio} (SSCC: ${item.sscc})`, 'MARBETE HOLD IMPRESO');
  }

  toggleCriterion(crit: string): void {
    const current = this.selectedCriteria();
    if (current.includes(crit)) {
      this.selectedCriteria.set(current.filter(c => c !== crit));
    } else {
      this.selectedCriteria.set([...current, crit]);
    }
  }

  submitBlock(): void {
    const reporter = this.authState.userFullName() || 'Roberto Sánchez (Operador QM)';

    this.qmState.createBlock({
      sku: this.formSku(),
      description: this.formDescription(),
      clientId: 'cli-01',
      clientName: this.formClientName(),
      batchNumber: this.formBatchNumber(),
      sscc: this.formSscc(),
      quantity: this.formQuantity(),
      unitOfMeasure: this.formUnit(),
      locationId: this.formLocation(),
      stage: this.formStage(),
      defectCategory: this.formCategory(),
      defectCriteria: this.selectedCriteria(),
      severity: this.formSeverity(),
      reportedBy: reporter,
      notes: this.formNotes() || 'Bloqueo registrado desde Terminal RF en piso.',
      evidenceFiles: [],
    });

    this.closeCreateModal();
  }
}
