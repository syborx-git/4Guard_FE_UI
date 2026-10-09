import { Component, input, output, signal, computed, ElementRef, ViewChild, inject, effect, OnDestroy } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Item, InventoryStatus, INVENTORY_STATUS_LABELS } from '@4guard/shared-core';
import { AttachedEvidence } from '../../models/quality.models';

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
  dataUrl?: string;  // Base64 preview URL for images
}

export interface InspectionStatusUpdateEvent {
  itemId: string;
  newStatus: InventoryStatus;
  notes: string;
  evidenceFiles: AttachedEvidence[];
}

@Component({
  selector: 'fg-quality-inspection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, SpecularGlowDirective],
  templateUrl: './quality-inspection-modal.component.html',
  styleUrl: './quality-inspection-modal.component.css'
})
export class QualityInspectionModalComponent implements OnDestroy {
  @ViewChild('fileInputRef') private fileInputRef!: ElementRef<HTMLInputElement>;

  private readonly elementRef = inject(ElementRef);
  private readonly document = inject(DOCUMENT);

  // Inputs
  item = input<Item | null>(null);
  isOpen = input<boolean>(false);

  // Outputs
  closeModal = output<void>();
  updateStatus = output<InspectionStatusUpdateEvent>();

  // State Signals
  protected readonly notes = signal<string>('');

  protected readonly attachedFiles = signal<AttachedFile[]>([]);

  protected readonly checklist = signal<InspectionCheckItem[]>([
    {
      id: 'crit-empaque-tarima',
      label: 'Empaque Secundario y Tarima Intactos',
      description: 'Sin rasgaduras, abolladuras, parches húmedos ni tarimas rotas.',
      checked: false,
      critical: true
    },
    {
      id: 'crit-vida-util',
      label: 'Vida Útil Mínima y Caducidad Vigente',
      description: 'Cumple con margen mínimo de anaquel (> 90 días).',
      checked: false,
      critical: true
    },
    {
      id: 'crit-cadena-frio',
      label: 'Control de Cadena de Frío (2°C - 6°C)',
      description: 'Termómetro de recepción dentro de parámetros normativos.',
      checked: false,
      critical: true
    },
    {
      id: 'crit-ausencia-plagas',
      label: 'Ausencia de Plagas o Contaminación Cruzada',
      description: 'Libre de indicios de plagas, humedad excesiva o fauna nociva.',
      checked: false,
      critical: true
    },
    {
      id: 'crit-etiquetado-sscc',
      label: 'Etiquetado NOM / Código SSCC y Certificado Legible',
      description: 'Código de barras escaneable y certificado de origen adjunto.',
      checked: false,
      critical: true
    }
  ]);

  constructor() {
    // Inicialización y reseteo de checklist normativo F01 al abrir lote
    effect(() => {
      const currentItem = this.item();
      if (this.isOpen() && currentItem) {
        this.loadChecklistForDefectType(currentItem);
      }
    }, { allowSignalWrites: true });

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

  private loadChecklistForDefectType(item: Item): void {
    // Matriz de 5 Criterios Normativos Obligatorios (Formato F01 - Operación Planta)
    this.checklist.set([
      {
        id: 'crit-empaque-tarima',
        label: 'Empaque Secundario y Tarima Intactos',
        description: 'Sin rasgaduras, abolladuras, parches húmedos ni tarimas rotas.',
        checked: false,
        critical: true
      },
      {
        id: 'crit-vida-util',
        label: 'Vida Útil Mínima y Caducidad Vigente',
        description: 'Cumple con margen mínimo de anaquel (> 90 días).',
        checked: false,
        critical: true
      },
      {
        id: 'crit-cadena-frio',
        label: 'Control de Cadena de Frío (2°C - 6°C)',
        description: 'Termómetro de recepción dentro de parámetros normativos.',
        checked: false,
        critical: true
      },
      {
        id: 'crit-ausencia-plagas',
        label: 'Ausencia de Plagas o Contaminación Cruzada',
        description: 'Libre de indicios de plagas, humedad excesiva o fauna nociva.',
        checked: false,
        critical: true
      },
      {
        id: 'crit-etiquetado-sscc',
        label: 'Etiquetado NOM / Código SSCC y Certificado Legible',
        description: 'Código de barras escaneable y certificado de origen adjunto.',
        checked: false,
        critical: true
      }
    ]);
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

  protected triggerFileInput(): void {
    this.fileInputRef?.nativeElement.click();
  }

  protected onFilesSelected(event: Event): void {
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

      const newFile: AttachedFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        size: sizeStr,
        type: isImage ? 'image' : 'pdf'
      };

      if (isImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
          newFile.dataUrl = e.target?.result as string;
          this.attachedFiles.update(files => [...files, { ...newFile }]);
        };
        reader.readAsDataURL(file);
      } else {
        this.attachedFiles.update(files => [...files, newFile]);
      }
    });

    // Reset input so same file can be re-selected
    input.value = '';
  }

  protected removeAllFiles(): void {
    this.attachedFiles.set([]);
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

    const evidenceList: AttachedEvidence[] = this.attachedFiles().map(f => ({
      id: f.id,
      name: f.name,
      size: f.size,
      type: f.type,
      url: f.dataUrl,
      uploadedAt: new Date().toISOString()
    }));

    this.updateStatus.emit({
      itemId: currentItem.id,
      newStatus: InventoryStatus.AVAILABLE,
      notes: this.notes() || 'Aprobado y liberado tras inspección técnica de calidad QM (Checklist F01 5/5 conforme).',
      evidenceFiles: evidenceList
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

    const evidenceList: AttachedEvidence[] = this.attachedFiles().map(f => ({
      id: f.id,
      name: f.name,
      size: f.size,
      type: f.type,
      url: f.dataUrl,
      uploadedAt: new Date().toISOString()
    }));

    this.updateStatus.emit({
      itemId: currentItem.id,
      newStatus: InventoryStatus.QM_BLOCKED,
      notes: this.notes(),
      evidenceFiles: evidenceList
    });
    this.handleClose();
  }

  protected getStatusLabel(status: InventoryStatus): string {
    return INVENTORY_STATUS_LABELS[status] || String(status);
  }
}
