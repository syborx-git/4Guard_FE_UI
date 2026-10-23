/**
 * @file releases-submodule.component.ts
 * @description Submódulo 2 de Calidad: Liberaciones y Destinos Finales (Diagrama 2).
 */

import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { QualityStateService } from '../../services/quality-state.service';
import {
  QualityRelease,
  QualityBlockItem,
  ReleaseAuthorizerType,
  ReleaseSupportType,
  ReleaseDestination,
  RELEASE_DESTINATION_LABELS,
  AttachedEvidence
} from '../../models/quality.models';
import { SpecularGlowDirective } from '../../../../shared/directives/specular-glow.directive';

@Component({
  selector: 'fg-releases-submodule',
  standalone: true,
  imports: [CommonModule, FormsModule, SpecularGlowDirective],
  templateUrl: './releases-submodule.component.html',
  styleUrl: './releases-submodule.component.css'
})
export class ReleasesSubmoduleComponent implements OnInit {
  protected readonly qualityState = inject(QualityStateService);
  private readonly route = inject(ActivatedRoute);

  // Tab activo: 'pending' (Lotes retenidos por dictaminar) vs 'completed' (Liberaciones emitidas)
  protected readonly activeTab = signal<'pending' | 'completed'>('completed');
  protected readonly searchQuery = signal('');
  protected readonly selectedDestinationFilter = signal<ReleaseDestination | 'ALL'>('ALL');

  // Modal de Dictamen de Liberación
  protected readonly isReleaseModalOpen = signal(false);
  protected readonly selectedBlockToRelease = signal<QualityBlockItem | null>(null);

  // Campos del formulario de liberación (Diagrama 2)
  protected readonly authorizerType = signal<ReleaseAuthorizerType>('CLIENT');
  protected readonly supportType = signal<ReleaseSupportType>('EMAIL');
  protected readonly supportCustomType = signal('');
  protected readonly supportSubject = signal('');
  protected readonly supportFileName = signal('correo_autorizacion_cliente.eml');
  protected readonly authorizedByName = signal('');
  protected readonly authorizedByPosition = signal('');
  protected readonly destination = signal<ReleaseDestination>('DISTRIBUTION');
  protected readonly decisionNotes = signal('');
  protected readonly releaseEvidenceFiles = signal<AttachedEvidence[]>([]);

  // Info del destino
  protected readonly destinationLabels = RELEASE_DESTINATION_LABELS;

  ngOnInit(): void {
    // Si viene queryParam 'blockId', abrir directamente el modal
    this.route.queryParams.subscribe(params => {
      if (params['blockId']) {
        const found = this.qualityState.blocks().find(b => b.id === params['blockId']);
        if (found) {
          this.openReleaseModal(found);
        }
      }
    });
  }

  // Lotes retenidos esperando dictamen
  protected readonly pendingBlocks = computed(() =>
    this.qualityState.blocks().filter(b => b.status === 'BLOCKED' || b.status === 'UNDER_INSPECTION')
  );

  // Liberaciones completadas con filtros
  protected readonly filteredReleases = computed(() => {
    const dest = this.selectedDestinationFilter();
    const q = this.searchQuery().toLowerCase().trim();

    return this.qualityState.releases().filter(r => {
      if (dest !== 'ALL' && r.destination !== dest) return false;
      if (q) {
        return (
          r.folio.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q) ||
          r.batchNumber.toLowerCase().includes(q) ||
          r.clientName.toLowerCase().includes(q) ||
          r.authorizedByName.toLowerCase().includes(q) ||
          r.supportSubject.toLowerCase().includes(q)
        );
      }
      return true;
    });
  });

  protected openReleaseModal(block: QualityBlockItem): void {
    this.selectedBlockToRelease.set(block);
    this.authorizerType.set('CLIENT');
    this.supportType.set('EMAIL');
    this.supportCustomType.set('');
    this.supportSubject.set(`RE: Vo.Bo. Lote ${block.batchNumber} - ${block.clientName}`);
    this.authorizedByName.set('');
    this.authorizedByPosition.set('');
    this.destination.set('DISTRIBUTION');
    this.decisionNotes.set('');
    this.releaseEvidenceFiles.set(block.evidenceFiles ? [...block.evidenceFiles] : []);
    this.isReleaseModalOpen.set(true);
  }

  protected closeReleaseModal(): void {
    this.isReleaseModalOpen.set(false);
    this.selectedBlockToRelease.set(null);
  }

  protected setDestination(dest: ReleaseDestination): void {
    this.destination.set(dest);
  }

  protected onReleaseFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const MAX_SIZE_MB = 15;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

    Array.from(input.files).forEach(file => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        alert(`Formato no permitido: ${file.name}. Use JPG, PNG, WEBP o PDF.`);
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        alert(`El archivo "${file.name}" supera el límite de ${MAX_SIZE_MB} MB.`);
        return;
      }

      const isImage = file.type.startsWith('image/');
      const sizeStr = file.size < 1024 * 1024
        ? `${(file.size / 1024).toFixed(0)} KB`
        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

      const reader = new FileReader();
      reader.onload = () => {
        const newEvidence: AttachedEvidence = {
          id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          size: sizeStr,
          type: isImage ? 'image' : 'pdf',
          url: reader.result as string,
          uploadedAt: new Date().toISOString()
        };
        this.releaseEvidenceFiles.update(files => [...files, newEvidence]);
      };
      reader.readAsDataURL(file);
    });
    input.value = '';
  }

  protected removeReleaseEvidenceFile(fileId: string): void {
    this.releaseEvidenceFiles.update(files => files.filter(f => f.id !== fileId));
  }

  protected submitRelease(): void {
    const block = this.selectedBlockToRelease();
    if (!block) return;

    if (this.supportType() === 'OTHER' && !this.supportCustomType().trim()) {
      alert('Por favor especifique el tipo de soporte documental en el campo requerido.');
      return;
    }

    if (!this.authorizedByName().trim() || !this.authorizedByPosition().trim()) {
      alert('Debe ingresar el Nombre y Puesto de la persona que autoriza la liberación.');
      return;
    }

    if (!this.decisionNotes().trim() || this.decisionNotes().length < 5) {
      alert('Debe ingresar las notas o justificación técnica del dictamen (mínimo 5 caracteres).');
      return;
    }

    const created = this.qualityState.releaseBlock(block.id, {
      authorizerType: this.authorizerType(),
      supportType: this.supportType(),
      supportCustomType: this.supportType() === 'OTHER' ? this.supportCustomType().trim() : undefined,
      supportSubject: this.supportSubject() || 'Autorización formal de calidad',
      supportFileName: this.supportFileName(),
      authorizedByName: this.authorizedByName(),
      authorizedByPosition: this.authorizedByPosition(),
      destination: this.destination(),
      decisionNotes: this.decisionNotes(),
      evidenceFiles: this.releaseEvidenceFiles()
    });

    this.closeReleaseModal();
    this.activeTab.set('completed');
    alert(`¡Liberación ${created?.folio} registrada exitosamente con destino: ${this.destinationLabels[this.destination()].label}!`);
  }
}
