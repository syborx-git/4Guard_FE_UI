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
    // Checklist dinámico según el motivo/tipo de defecto por el que se bloqueó el producto
    effect(() => {
      const currentItem = this.item();
      if (this.isOpen() && currentItem) {
        this.loadChecklistForDefectType(currentItem);
      }
    });

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
    const desc = (item.description || '').toLowerCase();
    const notes = (item.notes || '').toLowerCase();

    if (notes.includes('transporte') || notes.includes('camión') || notes.includes('trailer') || desc.includes('nespresso') || notes.includes('piso') || notes.includes('polvo')) {
      this.checklist.set([
        { id: 'crit-tr-1', label: 'Hermeticidad e Integridad de Caja / Lona', description: 'Caja seca sin filtraciones, sin lonas rotas ni aberturas.', checked: false, critical: true },
        { id: 'crit-tr-2', label: 'Limpieza Exhaustiva de Piso y Paredes', description: 'Libre de astillas, tierra, derrames químicos o polvo excesivo.', checked: false, critical: true },
        { id: 'crit-tr-3', label: 'Ausencia Total de Indicios de Plagas', description: 'Sin presencia de insectos, roedores ni excrementos en la unidad.', checked: false, critical: true },
        { id: 'crit-tr-4', label: 'Ausencia de Olores Extraños / Contaminantes', description: 'Sin olores a solventes, combustibles ni humedad.', checked: false, critical: true },
        { id: 'crit-tr-5', label: 'Sellos y Precintos de Seguridad Validados', description: 'Número de sello coincide con el manifiesto de embarque.', checked: true, critical: false }
      ]);
    } else if (notes.includes('document') || notes.includes('certificado') || notes.includes('factura')) {
      this.checklist.set([
        { id: 'crit-doc-1', label: 'Certificado de Calidad de Origen Validado', description: 'Parámetros físico-químicos avalados por el laboratorio del proveedor.', checked: false, critical: true },
        { id: 'crit-doc-2', label: 'Certificado de Fumigación / Desinfección Vigente', description: 'Fecha de aplicación dentro de los 30 días normativos.', checked: false, critical: true },
        { id: 'crit-doc-3', label: 'Remisión / Factura Coincidente', description: 'Folios, cantidades y claves coinciden con la orden de compra.', checked: false, critical: true },
        { id: 'crit-doc-4', label: 'Etiquetado NOM y Código SSCC Legible', description: 'Código de barras legible sin errores de simbología.', checked: true, critical: false }
      ]);
    } else if (notes.includes('prueba') || notes.includes('muestreo') || notes.includes('laboratorio') || notes.includes('suero') || desc.includes('pharma')) {
      this.checklist.set([
        { id: 'crit-lab-1', label: 'Muestreo Microbiológico y Físico-Químico', description: 'Pruebas de esterilidad y pureza conformes con Farmacopea / NOM.', checked: false, critical: true },
        { id: 'crit-lab-2', label: 'Control Estricto de Cadena de Frío (2°C - 8°C)', description: 'Data logger sin excursiones térmicas fuera de rango.', checked: false, critical: true },
        { id: 'crit-lab-3', label: 'Vo.Bo. del Responsable Sanitario QM', description: 'Dictamen formal emitido y firmado digitalmente.', checked: false, critical: true },
        { id: 'crit-lab-4', label: 'Muestra de Retención en Cepario / Archivo', description: 'Muestra testigo resguardada bajo condiciones normativas.', checked: true, critical: false }
      ]);
    } else {
      // Defecto de Material / Empaque estándar
      this.checklist.set([
        { id: 'crit-mat-1', label: 'Integridad de Cajas y Empaque Primario', description: 'Sin roturas, aplastamientos ni envases perforados.', checked: false, critical: true },
        { id: 'crit-mat-2', label: 'Ausencia de Humedad o Filtraciones', description: 'Tarima seca, sin cartón reblandecido ni condensación.', checked: false, critical: true },
        { id: 'crit-mat-3', label: 'Vida Útil Mínima (> 90 días a caducidad)', description: 'Fecha de caducidad validada contra política de frescura del cliente.', checked: false, critical: true },
        { id: 'crit-mat-4', label: 'Estabilidad de Estiba y Pallet Estándar', description: 'Tarima sin colapso ni inclinación peligrosa para rack.', checked: false, critical: true },
        { id: 'crit-mat-5', label: 'Etiqueta de Identificación de Lote Visible', description: 'Código SSCC y lote legibles a 1.5 metros de distancia.', checked: true, critical: false }
      ]);
    }
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
