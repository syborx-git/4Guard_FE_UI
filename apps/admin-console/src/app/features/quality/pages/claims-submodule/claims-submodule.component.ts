/**
 * @file claims-submodule.component.ts
 * @description Submódulo 4 de Calidad: Tablero Ejecutivo de KPIs y Concentrado de Reclamos e Incidencias (F01).
 * Reemplaza el control en Excel por un dashboard ejecutivo mensual, tabla histórica y modal integral de captura.
 */

import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QualityStateService } from '../../services/quality-state.service';
import {
  QualityClaim,
  ClaimStage,
  ClaimDefectType,
  CLAIM_STAGE_LABELS,
  CLAIM_DEFECT_TYPE_LABELS,
  AttachedEvidence
} from '../../models/quality.models';
import { SpecularGlowDirective } from '../../../../shared/directives/specular-glow.directive';

@Component({
  selector: 'fg-claims-submodule',
  standalone: true,
  imports: [CommonModule, FormsModule, SpecularGlowDirective],
  templateUrl: './claims-submodule.component.html',
  styleUrl: './claims-submodule.component.css'
})
export class ClaimsSubmoduleComponent {
  protected readonly qualityState = inject(QualityStateService);

  // Filtros de tabla
  protected readonly searchQuery = signal('');
  protected readonly selectedStageFilter = signal<ClaimStage | 'ALL'>('ALL');
  protected readonly selectedDefectFilter = signal<ClaimDefectType | 'ALL'>('ALL');
  protected readonly selectedStatusFilter = signal<string>('ALL');

  // Catálogos auxiliares y constantes
  protected readonly stageLabels = CLAIM_STAGE_LABELS;
  protected readonly defectLabels = CLAIM_DEFECT_TYPE_LABELS;

  protected readonly stageFilterOptions: { key: ClaimStage | 'ALL'; label: string; icon: string }[] = [
    { key: 'ALL', label: 'Todas las Etapas', icon: 'apps' },
    { key: 'INBOUND_UNLOAD', label: '1. Descarga (Inbound)', icon: 'move_to_inbox' },
    { key: 'STORAGE', label: '2. Almacenamiento (Racks)', icon: 'shelves' },
    { key: 'OUTBOUND_LOAD', label: '3. Carga (Outbound)', icon: 'local_shipping' }
  ];

  protected readonly defectFilterOptions: { key: ClaimDefectType | 'ALL'; label: string }[] = [
    { key: 'ALL', label: 'Todos los Defectos' },
    { key: 'NON_COMPLIANT_SPEC', label: 'No cumple especificación' },
    { key: 'QUANTITY_DISCREPANCY', label: 'Discrepancia en cantidad' },
    { key: 'BAD_CONDITIONS', label: 'Malas condiciones' },
    { key: 'OTHER', label: 'Otro' }
  ];

  // Catálogo de productos sugeridos para captura ágil
  protected readonly productPresets: { sku: string; description: string; client: string }[] = [
    { sku: 'LALA-MILK-1L', description: 'Leche Lala Entera UHT 1L (Tarima 80 Cajas)', client: 'Lala S.A. de C.V.' },
    { sku: 'NESP-COFFEE-BOX', description: 'Cápsulas Nespresso Ristretto Intenso Master Box', client: 'Nestlé México S.A.' },
    { sku: 'BIMBO-BREAD-680G', description: 'Pan Cero Cero Bimbo 680g (Tarima 80 Cajas)', client: 'Bimbo de México S.A.' },
    { sku: 'COCA-COLA-600ML', description: 'Refresco Coca Cola Original 600ml (Paquete x24)', client: 'Coca-Cola FEMSA' },
    { sku: 'UNIL-MAIZ-500G', description: 'Fécula de Maíz Maizena Natural 500g', client: 'Unilever México' }
  ];

  // Modal de Captura de Nuevo Reclamo
  protected readonly isCreateModalOpen = signal(false);
  protected readonly newDate = signal(new Date().toISOString().split('T')[0]);
  protected readonly newTime = signal(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }));
  protected readonly newStage = signal<ClaimStage>('INBOUND_UNLOAD');
  protected readonly newSku = signal('LALA-MILK-1L');
  protected readonly newProductDescription = signal('Leche Lala Entera UHT 1L (Tarima 80 Cajas)');
  protected readonly newClientName = signal('Lala S.A. de C.V.');
  protected readonly newBatchNumber = signal('');
  protected readonly newRemisionNumber = signal('');
  protected readonly newDefectType = signal<ClaimDefectType>('BAD_CONDITIONS');
  protected readonly newDefectCustomType = signal('');
  protected readonly newDamagedQty = signal<number>(0);
  protected readonly newLostQty = signal<number>(0);
  protected readonly newAssociatedCost = signal<number>(0);
  protected readonly newAuthorizedByName = signal('Laura Valdés (Auditora QM)');
  protected readonly newAuthorizedByPosition = signal('Superintendencia de Aseguramiento de Calidad');
  protected readonly newObservations = signal('');
  protected readonly newEvidenceFiles = signal<AttachedEvidence[]>([]);

  // Modal de Detalle / Inspección de Reclamo
  protected readonly isDetailModalOpen = signal(false);
  protected readonly selectedClaim = signal<QualityClaim | null>(null);

  // Lista de reclamos filtrada reactivamente
  protected readonly filteredClaims = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const stage = this.selectedStageFilter();
    const defect = this.selectedDefectFilter();
    const status = this.selectedStatusFilter();

    return this.qualityState.claims().filter(c => {
      if (stage !== 'ALL' && c.stage !== stage) return false;
      if (defect !== 'ALL' && c.defectType !== defect) return false;
      if (status !== 'ALL' && c.status !== status) return false;

      if (q) {
        const matchFolio = c.folio.toLowerCase().includes(q);
        const matchSku = c.sku.toLowerCase().includes(q);
        const matchDesc = c.productDescription.toLowerCase().includes(q);
        const matchClient = c.clientName.toLowerCase().includes(q);
        const matchBatch = c.batchNumber.toLowerCase().includes(q);
        const matchRemision = c.remisionNumber.toLowerCase().includes(q);
        return matchFolio || matchSku || matchDesc || matchClient || matchBatch || matchRemision;
      }

      return true;
    });
  });

  // Apertura y reseteo del modal
  protected openCreateClaimModal(): void {
    const now = new Date();
    this.newDate.set(now.toISOString().split('T')[0]);
    this.newTime.set(now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }));
    this.newStage.set('INBOUND_UNLOAD');
    this.newSku.set(this.productPresets[0].sku);
    this.newProductDescription.set(this.productPresets[0].description);
    this.newClientName.set(this.productPresets[0].client);
    this.newBatchNumber.set(`LOT-2026-${now.getTime().toString().slice(-4)}`);
    this.newRemisionNumber.set(`REM-2026-${now.getTime().toString().slice(-4)}`);
    this.newDefectType.set('BAD_CONDITIONS');
    this.newDefectCustomType.set('');
    this.newDamagedQty.set(10);
    this.newLostQty.set(0);
    this.newAssociatedCost.set(4500);
    this.newAuthorizedByName.set('Laura Valdés (Auditora QM)');
    this.newAuthorizedByPosition.set('Superintendencia de Aseguramiento de Calidad');
    this.newObservations.set('');
    this.newEvidenceFiles.set([]);
    this.isCreateModalOpen.set(true);
  }

  protected closeCreateClaimModal(): void {
    this.isCreateModalOpen.set(false);
  }

  protected onPresetProductChange(sku: string): void {
    const preset = this.productPresets.find(p => p.sku === sku);
    if (preset) {
      this.newSku.set(preset.sku);
      this.newProductDescription.set(preset.description);
      this.newClientName.set(preset.client);
    }
  }

  protected onFileSelected(event: Event): void {
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
        this.newEvidenceFiles.update(files => [...files, newEvidence]);
      };
      reader.readAsDataURL(file);
    });
    input.value = '';
  }

  protected removeEvidenceFile(id: string): void {
    this.newEvidenceFiles.update(files => files.filter(f => f.id !== id));
  }

  protected saveNewClaim(): void {
    if (!this.newBatchNumber().trim()) {
      alert('Por favor ingrese el número de Lote afectado.');
      return;
    }

    if (!this.newRemisionNumber().trim()) {
      alert('Por favor ingrese el número o folio de la Remisión.');
      return;
    }

    if (this.newDefectType() === 'OTHER' && !this.newDefectCustomType().trim()) {
      alert('Por favor especifique la descripción del defecto en el campo correspondiente.');
      return;
    }

    if (!this.newAuthorizedByName().trim()) {
      alert('Por favor ingrese el nombre del autorizador o responsable del reporte.');
      return;
    }

    const created = this.qualityState.createClaim({
      date: this.newDate(),
      time: this.newTime(),
      stage: this.newStage(),
      sku: this.newSku(),
      productDescription: this.newProductDescription(),
      clientName: this.newClientName(),
      batchNumber: this.newBatchNumber().trim(),
      remisionNumber: this.newRemisionNumber().trim(),
      defectType: this.newDefectType(),
      defectCustomType: this.newDefectType() === 'OTHER' ? this.newDefectCustomType().trim() : undefined,
      damagedQty: Number(this.newDamagedQty()) || 0,
      lostQty: Number(this.newLostQty()) || 0,
      associatedCost: Number(this.newAssociatedCost()) || 0,
      currency: 'MXN',
      authorizedByName: this.newAuthorizedByName().trim(),
      authorizedByPosition: this.newAuthorizedByPosition().trim(),
      observations: this.newObservations().trim() || 'Sin observaciones adicionales.',
      evidenceFiles: this.newEvidenceFiles(),
      status: 'OPEN'
    });

    this.closeCreateClaimModal();
    alert(`✅ ¡Reclamo ${created.folio} registrado exitosamente!\n\n• Impacto: $${created.associatedCost.toLocaleString('es-MX')} MXN\n• Lote: ${created.batchNumber} | Remisión: ${created.remisionNumber}\n• Se actualizó el tablero de KPIs en tiempo real.`);
  }

  protected openClaimDetail(claim: QualityClaim): void {
    this.selectedClaim.set(claim);
    this.isDetailModalOpen.set(true);
  }

  protected closeClaimDetail(): void {
    this.isDetailModalOpen.set(false);
    this.selectedClaim.set(null);
  }

  protected formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(amount);
  }
}
