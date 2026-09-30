/**
 * @file releases-submodule.component.ts
 * @description Submódulo de Dictamen de Liberaciones y Destinos de Calidad para Terminal RF.
 */

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthState } from '@4guard/shared-core';
import { RfQualityStateService } from '../../../../core/services/rf-quality-state.service';
import {
  QualityRelease,
  ReleaseDestination,
  RELEASE_DESTINATION_LABELS,
} from '../../models/quality.models';

@Component({
  selector: 'fg-rf-releases-submodule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './releases-submodule.component.html',
  styleUrl: './releases-submodule.component.css',
})
export class RfReleasesSubmoduleComponent {
  protected readonly qmState = inject(RfQualityStateService);
  private readonly authState = inject(AuthState);

  // ─── Filtros ────────────────────────────────────────────────────────────
  protected readonly searchTerm = signal('');
  protected readonly destinationFilter = signal<string>('ALL');

  // ─── Modal de Liberación ────────────────────────────────────────────────
  protected readonly showReleaseModal = signal(false);
  protected readonly selectedBlockId = signal('');
  protected readonly selectedDestination = signal<ReleaseDestination>('DISTRIBUTION');
  protected readonly authorizerType = signal<'CLIENT' | 'QUALITY_4GUARD'>('QUALITY_4GUARD');
  protected readonly supportType = signal<'EMAIL' | 'ELECTRONIC_MEDIA' | 'FORMAL_ACT' | 'OTHER'>('FORMAL_ACT');
  protected readonly supportSubject = signal('ACT-QM-2026-LIB: Lote conforme tras re-muestreo');
  protected readonly authorizedByName = signal('Dra. Elena Ramos');
  protected readonly authorizedByPosition = signal('Auditor Líder QM');
  protected readonly decisionNotes = signal('Liberación técnica autorizada. Tarima apta para retorno a stock disponible.');

  // Bloqueos elegibles para liberar (status === 'BLOCKED' o 'UNDER_INSPECTION')
  protected readonly eligibleBlocks = computed(() => {
    return this.qmState.blocks().filter(b => b.status !== 'RELEASED');
  });

  protected readonly filteredReleases = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const dest = this.destinationFilter();
    return this.qmState.releases().filter(rel => {
      const matchDest = dest === 'ALL' || rel.destination === dest;
      const matchText =
        !term ||
        rel.folio.toLowerCase().includes(term) ||
        rel.sku.toLowerCase().includes(term) ||
        rel.batchNumber.toLowerCase().includes(term) ||
        rel.clientName.toLowerCase().includes(term);
      return matchDest && matchText;
    });
  });

  protected readonly destinationLabels = RELEASE_DESTINATION_LABELS;

  openReleaseModal(blockId?: string): void {
    if (blockId) {
      this.selectedBlockId.set(blockId);
    } else if (this.eligibleBlocks().length > 0) {
      this.selectedBlockId.set(this.eligibleBlocks()[0].id);
    }
    this.showReleaseModal.set(true);
  }

  closeReleaseModal(): void {
    this.showReleaseModal.set(false);
  }

  submitRelease(): void {
    const userName = this.authState.userFullName() || 'Roberto Sánchez (Auditor RF)';

    this.qmState.createRelease({
      blockId: this.selectedBlockId(),
      destination: this.selectedDestination(),
      authorizerType: this.authorizerType(),
      supportType: this.supportType(),
      supportSubject: this.supportSubject(),
      authorizedByName: this.authorizedByName(),
      authorizedByPosition: this.authorizedByPosition(),
      decisionNotes: this.decisionNotes(),
      releasedByUserName: userName,
    });

    this.closeReleaseModal();
  }
}
