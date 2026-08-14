/**
 * @file outbound-submodule.component.ts
 * @description Submódulo 3: Salidas de Almacén (Despacho / Outbound).
 * Incluye Algoritmo Sugerido FIFO/FEFO y Selección Granular de UAs por checkbox.
 */

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ToastService } from '../../../../core/services/toast.service';
import { WarehouseMovementsService } from '../../services/warehouse-movements.service';
import {
  InventoryBatch,
  OutboundDispatch,
  ReceptionPalletItem,
} from '../../models/warehouse-movements.models';
import { PrintDispatchLayoutComponent } from '../../components/print-layouts/print-dispatch-layout.component';

type OutboundTab = 'alta-salidas' | 'consulta-salidas';

@Component({
  selector: 'fg-outbound-submodule',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PrintDispatchLayoutComponent],
  templateUrl: './outbound-submodule.component.html',
  styleUrl: './outbound-submodule.component.css',
})
export class OutboundSubmoduleComponent {
  private readonly movementsService = inject(WarehouseMovementsService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  activeTab = signal<OutboundTab>('alta-salidas');

  // Plantas físicas destino de Nestlé / Clientes
  destinationPlants = [
    'Nestlé Planta Toluca',
    'Nestlé Querétaro',
    'Nestlé Lagos de Moreno',
    'Unilever Planta CIVAC',
    'Walmart CEDIS Chalco',
  ];

  transportTypes = ['Camioneta', 'Torton', 'Tráiler'] as const;

  // Formulario Transporte / Destino
  outboundForm = this.fb.group({
    client: ['Nestlé México', [Validators.required]],
    destinationPlant: ['Nestlé Planta Toluca', [Validators.required]],
    sealNumber: ['SL-88401', [Validators.required]],
    carrierName: ['Transportes Castores', [Validators.required]],
    driverName: ['Juan Pérez', [Validators.required]],
    economicNumber: ['ECO-901', [Validators.required]],
    tractorPlates: ['12-AA-34', [Validators.required]],
    boxPlates: ['78-BB-90', [Validators.required]],
    transportType: ['Tráiler' as 'Camioneta' | 'Torton' | 'Tráiler', [Validators.required]],
    forkliftOperator: ['Pablo Hernández', [Validators.required]],
    productId: ['SKU-NES-680', [Validators.required]],
  });

  // Lotes disponibles filtrados por SKU
  selectedBatch = signal<InventoryBatch | null>(null);

  availableBatches = computed(() => {
    const batches = this.movementsService.inventoryBatches();
    const prodId = this.outboundForm.value.productId || 'SKU-NES-680';
    return batches.filter((b) => b.productId === prodId);
  });

  // UAs seleccionadas de forma granular por Checkbox
  selectedPalletsMap = signal<Record<string, boolean>>({});

  selectedPalletsList = computed<ReceptionPalletItem[]>(() => {
    const batch = this.selectedBatch();
    if (!batch) return [];
    const map = this.selectedPalletsMap();
    return batch.pallets.filter((p) => !!map[p.id]);
  });

  totalSelectedPallets = computed(() => this.selectedPalletsList().length);
  totalSelectedPieces = computed(() =>
    this.selectedPalletsList().reduce((acc, p) => acc + p.pieces, 0)
  );

  // Modal Impresión
  showPrintModal = signal(false);
  selectedPrintDispatch = signal<OutboundDispatch | null>(null);

  // ── PESTAÑA CONSULTA ──
  searchClient = signal('');
  searchCarrier = signal('');
  searchFolio = signal('');

  filteredDispatches = computed(() => {
    const list = this.movementsService.dispatches();
    const c = this.searchClient().toLowerCase().trim();
    const carr = this.searchCarrier().toLowerCase().trim();
    const f = this.searchFolio().toLowerCase().trim();

    return list.filter((d) => {
      const matchC = !c || d.client.toLowerCase().includes(c);
      const matchCarr = !carr || d.carrierName.toLowerCase().includes(carr);
      const matchF = !f || d.folio.toLowerCase().includes(f);
      return matchC && matchCarr && matchF;
    });
  });

  constructor() {
    // Al iniciar, seleccionar el lote por defecto
    const b = this.availableBatches();
    if (b.length > 0) {
      this.selectBatch(b[0]);
    }
  }

  selectBatch(batch: InventoryBatch): void {
    this.selectedBatch.set(batch);
    // Pre-seleccionar todas las UAs por defecto para facilidad de usuario
    const initialMap: Record<string, boolean> = {};
    batch.pallets.forEach((p) => {
      initialMap[p.id] = true;
    });
    this.selectedPalletsMap.set(initialMap);
  }

  togglePalletSelection(palletId: string, event?: Event): void {
    const checked = event ? (event.target as HTMLInputElement).checked : !this.selectedPalletsMap()[palletId];
    this.selectedPalletsMap.update((map) => ({
      ...map,
      [palletId]: checked,
    }));
  }

  confirmOutbound(): void {
    this.executeDispatch();
  }

  toggleAllPallets(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const batch = this.selectedBatch();
    if (!batch) return;

    const newMap: Record<string, boolean> = {};
    batch.pallets.forEach((p) => {
      newMap[p.id] = checked;
    });
    this.selectedPalletsMap.set(newMap);
  }

  executeDispatch(): void {
    if (this.outboundForm.invalid) {
      this.toast.warning('Por favor completa los datos obligatorios del transporte.');
      return;
    }
    if (this.totalSelectedPallets() === 0) {
      this.toast.warning('Debes seleccionar al menos 1 Tarima/UA para autorizar la salida.');
      return;
    }

    const batch = this.selectedBatch();
    if (!batch) return;

    const dispatchData = {
      client: this.outboundForm.value.client || 'Cliente General',
      destinationPlant: this.outboundForm.value.destinationPlant || 'Nestlé Toluca',
      sealNumber: this.outboundForm.value.sealNumber || 'SL-000',
      carrierName: this.outboundForm.value.carrierName || 'Transportista',
      driverName: this.outboundForm.value.driverName || 'Chofer',
      economicNumber: this.outboundForm.value.economicNumber || 'ECO-1',
      tractorPlates: this.outboundForm.value.tractorPlates || '00-XX-00',
      boxPlates: this.outboundForm.value.boxPlates || '00-YY-00',
      transportType: (this.outboundForm.value.transportType as any) || 'Tráiler',
      forkliftOperator: this.outboundForm.value.forkliftOperator || 'Montacarguista',
      productId: batch.productId,
      productName: batch.productName,
      selectedPallets: this.selectedPalletsList(),
      totalPallets: this.totalSelectedPallets(),
      totalPieces: this.totalSelectedPieces(),
      dispatchedBy: 'Christian Durán',
    };

    const result = this.movementsService.executeDispatch(dispatchData);
    this.toast.success(`Despacho #${result.folio} autorizado y listo para salida`);
    this.selectedPrintDispatch.set(result);
    this.showPrintModal.set(true);
  }

  openPrintPreview(dispatch: OutboundDispatch): void {
    this.selectedPrintDispatch.set(dispatch);
    this.showPrintModal.set(true);
  }

  triggerBrowserPrint(): void {
    window.print();
  }

  closePrintModal(): void {
    this.showPrintModal.set(false);
    this.selectedPrintDispatch.set(null);
  }
}
