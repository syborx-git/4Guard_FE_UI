import { Component, input, output, signal, computed, ElementRef, inject, effect, OnDestroy } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Item, InventoryStatus, INVENTORY_STATUS_LABELS } from '@4guard/shared-core';

import { SpecularGlowDirective } from '../../../../shared/directives/specular-glow.directive';

export interface InspectionCheckItem {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  critical: boolean;
}

export interface AttachedFile {
  id: string;
  name: string;
  size: string;
  type: 'image' | 'pdf';
}

@Component({
  selector: 'fg-quality-inspection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, SpecularGlowDirective],
  templateUrl: './quality-inspection-modal.component.html',
  styleUrl: './quality-inspection-modal.component.css'
})
export class QualityInspectionModalComponent implements OnDestroy {
  private readonly elementRef = inject(ElementRef);
  private readonly document = inject(DOCUMENT);

  // Inputs
  item = input<Item | null>(null);
  isOpen = input<boolean>(false);

  // Outputs
  closeModal = output<void>();
  updateStatus = output<{ itemId: string; newStatus: InventoryStatus; notes: string }>();

  // State Signals
  protected readonly notes = signal<string>('');

  protected readonly attachedFiles = signal<AttachedFile[]>([
    { id: 'file-1', name: 'foto_empaque_dano_lote.jpg', size: '1.8 MB', type: 'image' },
    { id: 'file-2', name: 'certificado_calidad_origen_lala.pdf', size: '420 KB', type: 'pdf' }
  ]);

  protected readonly checklist = signal<InspectionCheckItem[]>([
    {
      id: 'crit-empaque',
      label: 'Empaque Secundario y Tarima Intactos',
      description: 'Sin rasgaduras, abolladuras, parches húmedos ni tarimas rotas.',
      checked: false,
      critical: true
    },
    {
      id: 'crit-caducidad',
      label: 'Vida Útil Mínima y Caducidad Vigente',
      description: 'Cumple con margen mínimo de vida anaquel (> 90 días).',
      checked: false,
      critical: true
    },
    {
      id: 'crit-temperatura',
      label: 'Control de Cadena de Frío (2°C - 6°C)',
      description: 'Termómetro de recepción dentro de parámetros normativos.',
      checked: false,
      critical: true
    },
    {
      id: 'crit-etiquetado',
      label: 'Etiquetado NOM / Código SSCC Legible',
      description: 'Código de barras escaneable sin errores de formateo.',
      checked: true,
      critical: false
    },
    {
      id: 'crit-certificado',
      label: 'Certificado de Calidad de Origen Adjunto',
      description: 'Muestreo de laboratorio y ficha técnica validados.',
      checked: false,
      critical: false
    }
  ]);

  constructor() {
    // Portal Teleportation to document.body so modal sits over topbar & sidebar (100% viewport)
    effect(() => {
      if (this.isOpen()) {
        if (this.elementRef.nativeElement.parentNode !== this.document.body) {
          this.document.body.appendChild(this.elementRef.nativeElement);
        }
        this.document.body.style.overflow = 'hidden';
      } else {
        if (this.elementRef.nativeElement.parentNode === this.document.body) {
          this.document.body.removeChild(this.elementRef.nativeElement);
        }
        this.document.body.style.overflow = '';
      }
    });
  }

  ngOnDestroy(): void {
    if (this.elementRef.nativeElement.parentNode === this.document.body) {
      this.document.body.removeChild(this.elementRef.nativeElement);
    }
    this.document.body.style.overflow = '';
  }

  // Computed properties for Checklist Validation
  protected readonly completedCount = computed(() =>
    this.checklist().filter(c => c.checked).length
  );

  protected readonly totalCount = computed(() =>
    this.checklist().length
  );

  protected readonly completedCriticalCount = computed(() =>
    this.checklist().filter(c => c.critical && c.checked).length
  );

  protected readonly totalCriticalCount = computed(() =>
    this.checklist().filter(c => c.critical).length
  );

  protected readonly areCriticalChecksComplete = computed(() =>
    this.completedCriticalCount() === this.totalCriticalCount()
  );

  protected readonly completionPercentage = computed(() =>
    Math.round((this.completedCount() / this.totalCount()) * 100)
  );

  protected readonly isChecklistComplete = computed(() =>
    this.checklist().every(c => c.checked)
  );

  protected readonly isNotesValidForRejection = computed(() =>
    this.notes().trim().length >= 5
  );

  protected toggleCheck(id: string): void {
    this.checklist.update(items =>
      items.map(item =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  }

  protected selectAllChecklist(): void {
    this.checklist.update(items => items.map(i => ({ ...i, checked: true })));
  }

  protected resetChecklist(): void {
    this.checklist.update(items => items.map(i => ({ ...i, checked: false })));
  }

  protected addSimulatedFile(): void {
    const newId = `file-${Date.now()}`;
    const newFiles: AttachedFile[] = [
      ...this.attachedFiles(),
      {
        id: newId,
        name: `evidencia_andem_foto_${this.attachedFiles().length + 1}.jpg`,
        size: '2.1 MB',
        type: 'image'
      }
    ];
    this.attachedFiles.set(newFiles);
  }

  protected removeFile(id: string): void {
    this.attachedFiles.update(files => files.filter(f => f.id !== id));
  }

  protected handleClose(): void {
    this.closeModal.emit();
  }

  protected handleApprove(): void {
    const currentItem = this.item();
    if (!currentItem) return;

    if (!this.areCriticalChecksComplete()) {
      alert(`No se puede aprobar el lote ${currentItem.batchNumber}. Se requiere validar los ${this.totalCriticalCount()} criterios OBLIGATORIOS del checklist.`);
      return;
    }

    this.updateStatus.emit({
      itemId: currentItem.id,
      newStatus: InventoryStatus.AVAILABLE,
      notes: this.notes() || 'Aprobado y liberado tras inspección técnica de calidad QM.'
    });
    this.handleClose();
  }

  protected handleBlock(): void {
    const currentItem = this.item();
    if (!currentItem) return;

    if (!this.isNotesValidForRejection()) {
      alert('Debe ingresar un motivo u observación (mínimo 5 caracteres) para bloquear el lote.');
      return;
    }

    this.updateStatus.emit({
      itemId: currentItem.id,
      newStatus: InventoryStatus.QM_BLOCKED,
      notes: this.notes()
    });
    this.handleClose();
  }

  protected getStatusLabel(status: InventoryStatus): string {
    return INVENTORY_STATUS_LABELS[status] || String(status);
  }
}
