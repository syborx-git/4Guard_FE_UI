import {
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WarehouseLayoutService } from '../../services/warehouse-layout.service';
import { SkuService } from '../../../admin/services/sku.service';
import { ToastService } from '../../../../core/services/toast.service';
import { InitializeSectionRequest } from '../../models/warehouse-catalog.models';

export interface SetupModalSectionData {
  id: string;
  code: string;
  name: string;
  category?: string;
  posFijas?: number;
  capacidadTarimas?: number;
  factorEstiba?: string;
  notes?: string;
}

@Component({
  selector: 'fg-warehouse-section-setup-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './warehouse-section-setup-modal.component.html',
  styleUrl: './warehouse-section-setup-modal.component.css'
})
export class WarehouseSectionSetupModalComponent implements OnInit {
  private readonly layoutService = inject(WarehouseLayoutService);
  protected readonly skuService = inject(SkuService);
  private readonly toastService = inject(ToastService);

  // Inputs / Outputs
  readonly isOpen = model<boolean>(false);
  readonly section = input<SetupModalSectionData | null>(null);

  readonly saved = output<any>();
  readonly closed = output<void>();

  // Form State
  readonly category = signal<string>('Secos & Producto Terminado');
  readonly posFijas = signal<number>(36);
  readonly factorEstiba = signal<string>('22 tarimas/pos');
  readonly notes = signal<string>('');
  readonly generateLocations = signal<boolean>(true);
  readonly selectedSkuIds = signal<string[]>([]);
  readonly skuSearch = signal<string>('');

  readonly isSaving = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  // Categorías estándar
  readonly categoryOptions: string[] = [
    'Secos & Producto Terminado',
    'Materia Prima & Insumos',
    'Empaque & Vidrio Industrial',
    'General Central & Palletizado',
    'Insumos Especiales',
    'Granel & Tambores',
    'Cuarentena & Retenidos',
    'Almacén Anexo Exterior',
    'Área Técnica'
  ];

  // Factores de estiba estándar
  readonly factorOptions: string[] = [
    '22 tarimas/pos',
    '20 tarimas/pos',
    '40 tarimas/pos',
    '15 tarimas/pos',
    '10 tarimas/pos'
  ];

  // Cálculo reactivo de tarimas por posición
  readonly tarimasPorPos = computed<number>(() => {
    const raw = this.factorEstiba();
    const match = raw.match(/\d+/);
    return match ? parseInt(match[0], 10) : 22;
  });

  // Capacidad total calculada en vivo
  readonly capacidadTarimas = computed<number>(() => {
    const count = this.posFijas();
    const perPos = this.tarimasPorPos();
    return Math.max(0, count * perPos);
  });

  // SKUs filtrados por búsqueda
  readonly filteredSkus = computed(() => {
    const list = this.skuService.skus();
    const q = this.skuSearch().trim().toLowerCase();
    if (!q) return list;
    return list.filter(s =>
      s.code?.toLowerCase().includes(q) ||
      s.name?.toLowerCase().includes(q)
    );
  });

  constructor() {
    // Sincronizar estado inicial cuando cambia la sección seleccionada
    effect(() => {
      const sec = this.section();
      if (sec) {
        this.category.set(
          sec.category && sec.category !== 'Área Futura' && sec.category !== 'General'
            ? sec.category
            : 'Secos & Producto Terminado'
        );
        this.posFijas.set(sec.posFijas && sec.posFijas > 0 ? sec.posFijas : 36);
        this.factorEstiba.set(
          sec.factorEstiba && sec.factorEstiba !== '--' ? sec.factorEstiba : '22 tarimas/pos'
        );
        this.notes.set(sec.notes && !sec.notes.includes('Pendiente de carga') ? sec.notes : '');
        this.selectedSkuIds.set([]);
        this.errorMessage.set(null);
      }
    });
  }

  ngOnInit(): void {
    if (this.skuService.skus().length === 0) {
      this.skuService.loadSkus().subscribe({
        error: (err) => console.error('Error cargando catálogo de SKUs para el modal:', err)
      });
    }
  }

  protected close(): void {
    this.isOpen.set(false);
    this.closed.emit();
  }

  protected toggleSku(skuId: string): void {
    const current = this.selectedSkuIds();
    if (current.includes(skuId)) {
      this.selectedSkuIds.set(current.filter(id => id !== skuId));
    } else {
      this.selectedSkuIds.set([...current, skuId]);
    }
  }

  protected isSkuSelected(skuId: string): boolean {
    return this.selectedSkuIds().includes(skuId);
  }

  protected setPosFijas(value: number): void {
    this.posFijas.set(Math.max(1, value));
  }

  protected getPaddedPosCount(): string {
    return String(this.posFijas()).padStart(3, '0');
  }

  protected getCleanPrefix(): string {
    const c = this.section()?.code || '';
    return c.replace('SEC-ALM-', '').replace('SEC-', '');
  }

  protected submit(): void {
    const sec = this.section();
    if (!sec || !sec.id) {
      this.errorMessage.set('No se ha especificado la sección a inicializar.');
      return;
    }

    if (this.posFijas() <= 0) {
      this.errorMessage.set('Debe ingresar un número de posiciones mayor a 0.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const payload: InitializeSectionRequest = {
      category: this.category(),
      posFijas: this.posFijas(),
      capacidadTarimas: this.capacidadTarimas(),
      factorEstiba: this.factorEstiba(),
      notes: this.notes().trim(),
      generateLocations: this.generateLocations(),
      authorizedSkuIds: this.selectedSkuIds()
    };

    this.layoutService.initializeSection(sec.id, payload).subscribe({
      next: (response) => {
        this.isSaving.set(false);
        this.toastService.success(
          `Nave ${sec.code} inicializada exitosamente con ${this.posFijas()} posiciones.`
        );
        this.isOpen.set(false);
        this.saved.emit(response);
      },
      error: (err) => {
        this.isSaving.set(false);
        const msg = err.error?.message || 'Error al inicializar la nave de almacén.';
        this.errorMessage.set(msg);
        this.toastService.error(msg);
      }
    });
  }
}
