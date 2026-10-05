import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QualityStateService } from '../../services/quality-state.service';
import {
  QualityMaterialType,
  QualityConditionDeviation,
  QualityRootCause,
  QualityActionTaken,
  QUALITY_MATERIAL_TYPE_LABELS,
  QUALITY_CONDITION_LABELS,
  QUALITY_ROOT_CAUSE_LABELS,
  QUALITY_ACTION_LABELS,
  CreateQualityDeviationPayload
} from '../../models/quality.models';

@Component({
  selector: 'app-quality-deviation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quality-deviation-modal.component.html',
  styleUrls: ['./quality-deviation-modal.component.css']
})
export class QualityDeviationModalComponent {
  qualityState = inject(QualityStateService);

  @Output() close = new EventEmitter<void>();

  // Form Fields Signals
  remisionNumber = signal<string>('');
  skuId = signal<string>('43857400');
  skuDescription = signal<string>('Tarima Embalajes de Madera');
  uaCode = signal<string>('');
  materialType = signal<QualityMaterialType>('EMBALAJES');
  deviationDate = signal<string>(new Date().toISOString().substring(0, 10));
  deviationTime = signal<string>(new Date().toTimeString().substring(0, 5));
  responsibleCollaborator = signal<string>('');
  bayLocationCode = signal<string>('M1-01');
  damagedUnits = signal<number>(1);
  materialCost = signal<number>(400);
  currency = signal<string>('MXN');
  conditionDeviation = signal<QualityConditionDeviation>('PALLET_DANADO');
  rootCauseMotive = signal<QualityRootCause>('MANEJO_INADECUADO');
  originArea = signal<string>('OPERACIONES');
  actionTaken = signal<QualityActionTaken>('BLOQUEO_CALIDAD');
  observations = signal<string>('');
  evidencePhotoUrls = signal<string[]>([]);

  // Labels and dropdown options
  materialTypeLabels = QUALITY_MATERIAL_TYPE_LABELS;
  conditionLabels = QUALITY_CONDITION_LABELS;
  rootCauseLabels = QUALITY_ROOT_CAUSE_LABELS;
  actionLabels = QUALITY_ACTION_LABELS;

  materialTypeKeys = Object.keys(QUALITY_MATERIAL_TYPE_LABELS) as QualityMaterialType[];
  conditionKeys = Object.keys(QUALITY_CONDITION_LABELS) as QualityConditionDeviation[];
  rootCauseKeys = Object.keys(QUALITY_ROOT_CAUSE_LABELS) as QualityRootCause[];
  actionKeys = Object.keys(QUALITY_ACTION_LABELS) as QualityActionTaken[];

  // SKU presets for quick selection
  skuPresets = [
    { sku: '43857400', desc: 'Tarima Embalajes de Madera', type: 'EMBALAJES' as QualityMaterialType, defaultCost: 400 },
    { sku: '40607772', desc: 'Café Verde Arábica Pergamino', type: 'CAFE_VERDE' as QualityMaterialType, defaultCost: 0 },
    { sku: '43510616', desc: 'Frasco Dolca 50g Culinario', type: 'PRODUCTO_TERMINADO' as QualityMaterialType, defaultCost: 1250 },
    { sku: '43319665', desc: 'Nescafé Clásico 200g Frasco', type: 'PRODUCTO_TERMINADO' as QualityMaterialType, defaultCost: 850 },
    { sku: '43727216', desc: 'Cofre Laminado Nestlé', type: 'EMBALAJES' as QualityMaterialType, defaultCost: 350 }
  ];

  onSkuPresetChange(sku: string): void {
    const found = this.skuPresets.find(p => p.sku === sku);
    if (found) {
      this.skuId.set(found.sku);
      this.skuDescription.set(found.desc);
      this.materialType.set(found.type);
      if (found.defaultCost > 0) {
        this.materialCost.set(found.defaultCost);
      }
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.evidencePhotoUrls.update(urls => [...urls, e.target.result]);
        };
        reader.readAsDataURL(file);
      }
    }
  }

  removePhoto(index: number): void {
    this.evidencePhotoUrls.update(urls => urls.filter((_, i) => i !== index));
  }

  submit(): void {
    if (!this.remisionNumber().trim() || !this.skuId().trim() || !this.uaCode().trim()) {
      alert('Por favor complete los campos obligatorios: Remisión, SKU y Código UA/SSCC.');
      return;
    }

    const payload: CreateQualityDeviationPayload = {
      remisionNumber: this.remisionNumber().trim(),
      skuId: this.skuId().trim(),
      skuDescription: this.skuDescription().trim(),
      uaCode: this.uaCode().trim(),
      materialType: this.materialType(),
      deviationDate: this.deviationDate(),
      deviationTime: this.deviationTime(),
      responsibleCollaborator: this.responsibleCollaborator().trim(),
      bayLocationCode: this.bayLocationCode().trim(),
      damagedUnits: Number(this.damagedUnits() || 0),
      materialCost: Number(this.materialCost() || 0),
      currency: this.currency(),
      conditionDeviation: this.conditionDeviation(),
      rootCauseMotive: this.rootCauseMotive(),
      originArea: this.originArea(),
      actionTaken: this.actionTaken(),
      observations: this.observations().trim(),
      evidencePhotoUrls: this.evidencePhotoUrls()
    };

    this.qualityState.createDeviation(payload);
    this.close.emit();
  }
}
